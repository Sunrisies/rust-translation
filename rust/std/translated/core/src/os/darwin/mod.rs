//! Platform-specific extensions to `core` for Darwin / Apple platforms.
//!
//! 此功能可在以下操作系统上使用：
//! - macOS
//! - iOS
//! - tvOS
//! - watchOS
//! - visionOS
//!
//! 注意：该模块被称为“Darwin”，因为这是上述操作系统的底层
//! core OS of the above operating systems, but it should not be confused with
//! the `-darwin` suffix in the `x86_64-apple-darwin` and
//! `aarch64-apple-darwin` target names, which are mostly named that way for
//! legacy reasons.

#![unstable(feature = "darwin_objc", issue = "145496")]
#![doc(cfg(target_vendor = "apple"))]

pub mod objc;
