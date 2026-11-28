//! 针对通用 I/O 基本操作的 WASI 特定扩展。

#![stable(feature = "io_safety_wasi", since = "1.65.0")]

#[stable(feature = "io_safety_wasi", since = "1.65.0")]
pub use crate::os::fd::*;

// Tests for this module
#[cfg(test)]
mod tests;
