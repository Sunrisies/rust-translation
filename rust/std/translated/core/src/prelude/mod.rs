//! 核心预lude
//!
//! 此模块适用于未链接 std 库的核心用户。
//! This module is imported by default when `#![no_std]` is used in the same
//! 类似于标准库中的预lude。

// No formatting: this file is nothing but re-exports, and their order is worth preserving.
#![cfg_attr(rustfmt, rustfmt::skip)]

#![stable(feature = "core_prelude", since = "1.4.0")]

pub mod v1;

/// 2015 年版本的核心预lude。
///
/// See the [module-level documentation](self) for more.
#[stable(feature = "prelude_2015", since = "1.55.0")]
pub mod rust_2015 {
    #[stable(feature = "prelude_2015", since = "1.55.0")]
    #[doc(no_inline)]
    pub use super::v1::*;
}

/// 2018 年版本的核心预lude。
///
/// See the [module-level documentation](self) for more.
#[stable(feature = "prelude_2018", since = "1.55.0")]
pub mod rust_2018 {
    #[stable(feature = "prelude_2018", since = "1.55.0")]
    #[doc(no_inline)]
    pub use super::v1::*;
}

/// 2021 年版本的核心预lude。
///
/// See the [module-level documentation](self) for more.
#[stable(feature = "prelude_2021", since = "1.55.0")]
pub mod rust_2021 {
    #[stable(feature = "prelude_2021", since = "1.55.0")]
    #[doc(no_inline)]
    pub use super::v1::*;

    #[stable(feature = "prelude_2021", since = "1.55.0")]
    #[doc(no_inline)]
    pub use crate::iter::FromIterator;

    #[stable(feature = "prelude_2021", since = "1.55.0")]
    #[doc(no_inline)]
    pub use crate::convert::{TryFrom, TryInto};
}

/// 2024 年版本的核心预lude。
///
/// See the [module-level documentation](self) for more.
#[stable(feature = "prelude_2024", since = "1.85.0")]
pub mod rust_2024 {
    #[stable(feature = "rust1", since = "1.0.0")]
    #[doc(no_inline)]
    pub use super::v1::*;

    #[stable(feature = "prelude_2021", since = "1.55.0")]
    #[doc(no_inline)]
    pub use crate::iter::FromIterator;

    #[stable(feature = "prelude_2021", since = "1.55.0")]
    #[doc(no_inline)]
    pub use crate::convert::{TryFrom, TryInto};

    #[stable(feature = "prelude_2024", since = "1.85.0")]
    #[doc(no_inline)]
    pub use crate::future::{Future, IntoFuture};
}

/// 未来版本的核心预lude。
///
/// See the [module-level documentation](self) for more.
#[doc(hidden)]
#[unstable(feature = "prelude_future", issue = "none")]
pub mod rust_future {
    #[stable(feature = "rust1", since = "1.0.0")]
    #[doc(no_inline)]
    pub use super::v1::*;

    #[stable(feature = "prelude_2021", since = "1.55.0")]
    #[doc(no_inline)]
    pub use crate::iter::FromIterator;

    #[stable(feature = "prelude_2021", since = "1.55.0")]
    #[doc(no_inline)]
    pub use crate::convert::{TryFrom, TryInto};

    #[stable(feature = "prelude_2024", since = "1.85.0")]
    #[doc(no_inline)]
    pub use crate::future::{Future, IntoFuture};
}
