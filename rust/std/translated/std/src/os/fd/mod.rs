//! 拥有权和借用的类 Unix 文件描述符。
//!
//! 此模块在 Unix 平台和 WASI 上得到支持，这两种平台都使用
//! 类似的文件描述符系统来引用操作系统资源。

#![stable(feature = "os_fd", since = "1.66.0")]
#![deny(unsafe_op_in_unsafe_fn)]

// `RawFd`, `AsRawFd`, etc.
mod raw;

// `OwnedFd`, `AsFd`, etc.
mod owned;

// Implementations for `AsRawFd` etc. for network types.
#[cfg(not(target_os = "trusty"))]
mod net;

// Implementation of stdio file descriptor constants.
mod stdio;

#[cfg(test)]
#[cfg(not(target_os = "l4re"))]
mod tests;

// Export the types and traits for the public API.
#[stable(feature = "os_fd", since = "1.66.0")]
pub use owned::*;
#[stable(feature = "os_fd", since = "1.66.0")]
pub use raw::*;
#[unstable(feature = "stdio_fd_consts", issue = "150836")]
pub use stdio::*;
