//! I/O 预处理模块。
//!
//! 该模块的目的是通过为依赖大量常见 I/O trait 的模块顶部添加全局导入，从而减少这些导入。
//! 在 I/O 密集型模块的开头添加全局导入即可实现此效果。
//!
//! ```
//! # #![feature(core_io)]
//! # #![allow(unused_imports)]
//! use core::io::prelude::*;
//! ```

#[stable(feature = "rust1", since = "1.0.0")]
pub use crate::io::{Seek, Write};
