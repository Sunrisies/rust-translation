//! Platform-specific extensions to `std` for Windows.
//!
//! 提供对 Windows 平台级信息的访问，并暴露
//! Windows-specific idioms that would otherwise be inappropriate as part
//! the core `std` library. These extensions allow developers to use
//! `std` types and idioms with Windows in a way that the normal
//! # 示例
//!
//! # 示例
//!
#![cfg_attr(windows, doc = "```no_run")]
#![cfg_attr(not(windows), doc = "```ignore (needs windows)")]
//! use std::fs::File;
//! use std::os::windows::prelude::*;
//!
//! fn main() -> std::io::Result<()> {
//! let f = File::create("foo.txt")?;
//! let handle = f.as_raw_handle();
//!
//! // 使用 handle 与原生 Windows 绑定协同工作
//!
//!     Ok(())
//! }
//! ```

#![stable(feature = "rust1", since = "1.0.0")]
#![doc(cfg(windows))]
#![deny(unsafe_op_in_unsafe_fn)]

pub mod ffi;
pub mod fs;
pub mod io;
#[unstable(feature = "windows_unix_domain_sockets", issue = "150487")]
pub mod net;
pub mod process;
pub mod raw;
pub mod thread;

#[unstable(feature = "codeview_annotation", issue = "163964")]
#[cfg(windows)]
pub use core::os::windows::{CodeViewAnnotationArgs, codeview_annotation};

/// A prelude for conveniently writing platform-specific code.
///
/// Includes all extension traits, and some important type definitions.
#[stable(feature = "rust1", since = "1.0.0")]
pub mod prelude {
    #[doc(no_inline)]
    #[stable(feature = "rust1", since = "1.0.0")]
    pub use super::ffi::{OsStrExt, OsStringExt};
    #[doc(no_inline)]
    #[stable(feature = "file_offset", since = "1.15.0")]
    pub use super::fs::FileExt;
    #[doc(no_inline)]
    #[stable(feature = "rust1", since = "1.0.0")]
    pub use super::fs::{MetadataExt, OpenOptionsExt};
    #[doc(no_inline)]
    #[stable(feature = "rust1", since = "1.0.0")]
    pub use super::io::{
        AsHandle, AsSocket, BorrowedHandle, BorrowedSocket, FromRawHandle, FromRawSocket,
        HandleOrInvalid, IntoRawHandle, IntoRawSocket, OwnedHandle, OwnedSocket,
    };
    #[doc(no_inline)]
    #[stable(feature = "rust1", since = "1.0.0")]
    pub use super::io::{AsRawHandle, AsRawSocket, RawHandle, RawSocket};
}
