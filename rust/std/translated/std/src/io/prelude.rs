//! I/O 预处理模块。
//!
//! 该模块的目的是通过为依赖大量常见 I/O trait 的 I/O 密集型模块添加全局导入，从而减少导入代码的数量。
//! 通过向 I/O 密集型模块顶部添加全局导入。
//!
//! ```
//! # #![allow(unused_imports)]
//! use std::io::prelude::*;
//! ```

#![stable(feature = "rust1", since = "1.0.0")]

#[stable(feature = "rust1", since = "1.0.0")]
pub use super::{BufRead, Read, Seek, Write};
