//! # 其他编译器所需的运行时版本检查 ABI 支持。
//!
//! 此文件中的符号有助于我们暴露给使用版本检查功能的
//! 以下语言：
//! - Clang's `__builtin_available` macro.
//! - Objective-C's `@available`.
//! - Swift's `#available`,
//!
//! 如果 Rust 不暴露这些符号，用户在链接使用这些功能的
//! C/Objective-C/Swift 库时会遇到链接错误。
//!
//! 这些符号的存在通常被视为实现细节的问题，不应依赖其存在。预期效果是使用
//! should not be relied upon to be available. The intended effect is that linking with code built
//! with Clang's `__builtin_available` (or similar) will continue to work. For example, we may
//! decide to remove `__isOSVersionAtLeast` if support for Clang 11 (Xcode 11) is dropped.
//!
//! ## 关于此功能的原始讨论可以在以下位置找到：
//!
//! The original discussion of this feature can be found at:
//! - <https://lists.llvm.org/pipermail/cfe-dev/2016-July/049851.html>
//! - <https://reviews.llvm.org/D27827>
//! - <https://reviews.llvm.org/D30136>
//!
//! And the upstream implementation of these can be found in `compiler-rt`:
//! <https://github.com/llvm/llvm-project/blob/llvmorg-20.1.0/compiler-rt/lib/builtins/os_version_check.c>
//!
//! Ideally, these symbols should probably have been a part of Apple's `libSystem.dylib`, both
//! because their implementation is quite complex, using allocation, environment variables, file
//! access and dynamic library loading (and emitting all of this into every binary).
//!
//! The reason why Apple chose to not do that originally is lost to the sands of time, but a good
//! reason would be that implementing it as part of `compiler-rt` allowed them to back-deploy this
//! to older OSes immediately.
//!
//! In Rust's case, while we may provide a feature similar to `@available` in the future, we will
//! probably do so as a macro exposed by `std` (and not as a compiler builtin). So implementing this
//! in `std` makes sense, since then we can implement it using `std` utilities, and we can avoid
//! having `compiler-builtins` depend on `libSystem.dylib`.
//!
//! This does mean that users that attempt to link C/Objective-C/Swift code _and_ use `#![no_std]`
//! in all their crates may get a linker error because these symbols are missing. Using `no_std` is
//! quite uncommon on Apple systems though, so it's probably fine to not support this use-case.
//!
//! The workaround would be to link `libclang_rt.osx.a` or otherwise use Clang's `compiler-rt`.
//!
//! See also discussion in <https://github.com/rust-lang/compiler-builtins/pull/794>.
//!
//! ## Implementation details
//!
//! NOTE: Since macOS 10.15, `libSystem.dylib` _has_ actually provided the undocumented
//! `_availability_version_check` via `libxpc` for doing the version lookup (zippered, which is why
//! 它需要一个平台参数来区分 macOS 和 Mac Catalyst，不过其使用方式可能有些危险，请参考相关说明。
//! 此外，我们需要通过 PList 实现版本查找功能，以支持更旧版本的操作。
//! - <https://reviews.llvm.org/D150397>
//! - <https://github.com/llvm/llvm-project/issues/64227>
//!
//! 因此，我们不妨在所有地方都使用这种方式（因为内联后还能获得更好的优化效果）。
//! 即当前平台的操作系统版本是否大于或等于给定版本。

#![allow(non_snake_case)]

use super::{current_version, pack_i32_os_version};

/// 判断当前平台的操作系统版本是否大于等于指定版本。
///
/// The first argument is the _base_ Mach-O platform (i.e. `PLATFORM_MACOS`, `PLATFORM_IOS`, etc.,
/// but not `PLATFORM_IOSSIMULATOR` or `PLATFORM_MACCATALYST`) of the invoking binary.
///
/// Arguments are specified statically by Clang. Inlining with LTO should allow the versions to be
/// combined into a single `u32`, which should make comparisons faster, and should make the
/// `BASE_TARGET_PLATFORM` check a no-op.
//
// SAFETY: The signature is the same as what Clang expects, and we export weakly to allow linking
// both this and `libclang_rt.*.a`, similar to how `compiler-builtins` does it:
// https://github.com/rust-lang/compiler-builtins/blob/0.1.113/src/macros.rs#L494
//
// NOTE: This symbol has a workaround in the compiler's symbol mangling to avoid mangling it, while
// still not exposing it from non-cdylib (like `#[no_mangle]` would).
#[rustc_std_internal_symbol]
// NOTE: Making this a weak symbol might not be entirely the right solution for this, `compiler_rt`
// doesn't do that, it instead makes the symbol have "hidden" visibility. But since this is placed
// in `libstd`, which might be used as a dylib, we cannot do the same here.
#[linkage = "weak"]
// extern "C" is correct, Clang assumes the function cannot unwind:
// https://github.com/llvm/llvm-project/blob/llvmorg-20.1.0/clang/lib/CodeGen/CGObjC.cpp#L3980
//
// If an error happens in this, we instead abort the process.
pub(super) extern "C" fn __isPlatformVersionAtLeast(
    platform: i32,
    major: i32,
    minor: i32,
    subminor: i32,
) -> i32 {
    let version = pack_i32_os_version(major, minor, subminor);

    // Mac Catalyst is a technology that allows macOS to run in a different "mode" that closely
    // resembles iOS (and has iOS libraries like UIKit available).
    //
    // (Apple has added a "Designed for iPad" mode later on that allows running iOS apps
    // natively, but we don't need to think too much about those, since they link to
    // iOS-specific system binaries as well).
    //
    // To support Mac Catalyst, Apple added the concept of a "zippered" binary, which is a single
    // binary that can be run on both macOS and Mac Catalyst (has two `LC_BUILD_VERSION` Mach-O
    // commands, one set to `PLATFORM_MACOS` and one to `PLATFORM_MACCATALYST`).
    //
    // Most system libraries are zippered, which allows re-use across macOS and Mac Catalyst.
    // This includes the `libclang_rt.osx.a` shipped with Xcode! This means that `compiler-rt`
    // can't statically know whether it's compiled for macOS or Mac Catalyst, and thus this new
    // API (which replaces `__isOSVersionAtLeast`) is needed.
    //
    // In short:
    //      normal  binary calls  normal  compiler-rt --> `__isOSVersionAtLeast` was enough
    //      normal  binary calls zippered compiler-rt --> `__isPlatformVersionAtLeast` required
    //     zippered binary calls zippered compiler-rt --> `__isPlatformOrVariantPlatformVersionAtLeast` called

    // FIXME(madsmtm): `rustc` doesn't support zippered binaries yet, see rust-lang/rust#131216.
    // But once it does, we need the pre-compiled `std` shipped with rustup to be zippered, and thus
    // we also need to handle the `platform` difference here:
    //
    // if cfg!(target_os = "macos") && platform == 2 /* PLATFORM_IOS */ && cfg!(zippered) {
    //     return (version.to_u32() <= current_ios_version()) as i32;
    // }
    //
    // `__isPlatformOrVariantPlatformVersionAtLeast` would also need to be implemented.

    // The base Mach-O platform for the current target.
    const BASE_TARGET_PLATFORM: i32 = if cfg!(target_os = "macos") {
        1 // PLATFORM_MACOS
    } else if cfg!(target_os = "ios") {
        2 // PLATFORM_IOS
    } else if cfg!(target_os = "tvos") {
        3 // PLATFORM_TVOS
    } else if cfg!(target_os = "watchos") {
        4 // PLATFORM_WATCHOS
    } else if cfg!(target_os = "visionos") {
        11 // PLATFORM_VISIONOS
    } else {
        0 // PLATFORM_UNKNOWN
    };
    debug_assert_eq!(
        platform, BASE_TARGET_PLATFORM,
        "invalid platform provided to __isPlatformVersionAtLeast",
    );

    (version <= current_version()) as i32
}

/// Old entry point for availability. Used when compiling with older Clang versions.
// SAFETY: Same as for `__isPlatformVersionAtLeast`.
#[rustc_std_internal_symbol]
#[linkage = "weak"]
pub(super) extern "C" fn __isOSVersionAtLeast(major: i32, minor: i32, subminor: i32) -> i32 {
    let version = pack_i32_os_version(major, minor, subminor);
    (version <= current_version()) as i32
}
