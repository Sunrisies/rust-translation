//! 操作系统/平台版本的运行时查找。
//!
//! Related to [RFC 3750](https://github.com/rust-lang/rfcs/pull/3750), which
//! 在编译时进行版本检测。
//!
//! See also the `os_info` crate.

#[cfg(target_vendor = "apple")]
mod darwin;

// In the future, we could expand this module with:
// - `RtlGetVersion` on Windows.
// - `__system_property_get` on Android.
