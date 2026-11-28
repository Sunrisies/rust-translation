//! I/O 前置处理模块。
//!
//! 该模块的目的是通过为依赖大量常见 I/O trait 的模块顶部添加全局导入，从而减少这些导入。
//! 在 I/O 密集型模块的开头添加全局导入即可实现此功能。
//!
//! ```
//! # #![feature(alloc_io)]
//! # #![allow(unused_imports)]
//! use alloc::io::prelude::*;
//! ```

#[stable(feature = "rust1", since = "1.0.0")]
pub use crate::io::{BufRead, Read, Seek, Write};
