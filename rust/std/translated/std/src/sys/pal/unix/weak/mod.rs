//! 支持在 Unix 上对符号采用“弱链接”方式。
//!
//! 我们在标准库中进行的某些 I/O 操作需要较新版本的操作系统，但目前我们
//! 需要保持与旧版本之间的二进制兼容性。为了能够使用新功能，我们使用此模块进行检测。
//! 这里的一个选择是采用弱链接方式，但遗憾的是，这仅适用于 ELF 格式。
//!
//! 否则，可以使用 dlsym 在运行时获取符号值。这样做也是为了与旧版本的 glibc 保持兼容，
//! 并避免依赖 GLIBC_PRIVATE 符号。它假设我们已动态链接到该符号所在的库，
//! 但对于 libpthread/libc 这类库来说，目前总是如此。
//! 很久以前，__pthread_get_minstack 符号采用弱链接方式，但这导致 Debian 检测到一个不必要的严格版本依赖
//! we've been dynamically linked to the library the symbol comes from, but that
//! 进行该符号的运行时查找，以避免 ELF 版本的依赖问题。
//!
//! A long time ago this used weak linkage for the __pthread_get_minstack
//! symbol, but that caused Debian to detect an unnecessarily strict versioned
//! dependency on libc6 (#23628) because it is GLIBC_PRIVATE. We now use `dlsym`
//! for a runtime lookup of that symbol to avoid the ELF versioned dependency.

#![forbid(unsafe_op_in_unsafe_fn)]

cfg_select! {
    // On non-ELF targets, use the dlsym approximation of weak linkage.
    target_vendor = "apple" => {
        mod dlsym;
        pub(crate) use dlsym::weak;
    }

    // Some targets don't need and support weak linkage at all...
    target_os = "espidf" => {}

    // ... but ELF targets support true weak linkage.
    _ => {
        // There are a variety of `#[cfg]`s controlling which targets are involved in
        // each instance of `weak!`. Rather than trying to unify all of
        // that, we'll just allow that some unix targets don't use this macro at all.
        #[cfg_attr(not(target_os = "linux"), allow(unused_macros, dead_code))]
        mod weak_linkage;
        #[cfg_attr(not(target_os = "linux"), allow(unused_imports))]
        pub(crate) use weak_linkage::weak;
    }
}

// GNU/Linux needs the `dlsym` variant to avoid linking to private glibc symbols.
#[cfg(all(target_os = "linux", target_env = "gnu"))]
mod dlsym;
#[cfg(all(target_os = "linux", target_env = "gnu"))]
pub(crate) use dlsym::weak as dlsym;

#[cfg(any(target_os = "android", target_os = "linux"))]
mod syscall;
#[cfg(any(target_os = "android", target_os = "linux"))]
pub(crate) use syscall::syscall;
