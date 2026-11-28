//! Platform-specific extensions to `std` for Darwin / Apple platforms.
//!
//! 此功能可在以下操作系统上使用：
//! - macOS
//! - iOS
//! - tvOS
//! - watchOS
//! - visionOS
//!
//! 注意：该模块被称为“Darwin”，因为上述操作系统的基础
//! core OS of the above operating systems, but it should not be confused with
//! the `-darwin` suffix in the `x86_64-apple-darwin` and
//! `aarch64-apple-darwin` target names, which are mostly named that way for
//! legacy reasons.

#![stable(feature = "os_darwin", since = "1.84.0")]
#![doc(cfg(target_vendor = "apple"))]

pub mod fs;
pub mod objc;

// deprecated, but used for public reexport under `std::os::unix::raw`, as
// well as `std::os::macos`/`std::os::ios`, because those modules precede the
// decision to remove these.
pub(super) mod raw;
