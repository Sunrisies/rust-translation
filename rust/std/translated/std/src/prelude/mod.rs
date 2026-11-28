//! # Rust Prelude
//!
//! Rust 的标准库包含了许多内容。然而，如果
//! 你必须手动导入每一个使用的模块，那会非常
//! 繁琐。但导入大量程序根本不会使用的模块也不好。
//! 需要找到一个平衡点。
//!
//! *prelude* 是指 Rust 自动导入到
//! 每个 Rust 程序中的内容列表。它被保持尽可能简短，并且专注于
//! 那些几乎在每一个 Rust 程序中都会使用的 trait。
//! # 其他 preludes
//!
//! # 其他 preludes
//!
//! Preludes 可以被视为一种模式，使使用多种类型更加
//! 方便。因此，你会在标准库中找到其他 preludes，
//! such as [`std::io::prelude`]. Various libraries in the Rust ecosystem may
//! 定义自己的 preludes。
//!
//! [`std::io::prelude`]: crate::io::prelude
//!
//! ‘the prelude’ 与其他 preludes 的区别在于它们
//! are not automatically `use`'d, and must be imported manually. This is still
//! 简单。
//!
//! # Prelude 内容
//!
//! prelude 中包含的内容取决于 crate 的版本。
//! prelude 的第一个版本用于 Rust 2015 和 Rust 2018，
//! and lives in [`std::prelude::v1`].
//! [`std::prelude::rust_2015`] and [`std::prelude::rust_2018`] re-export this prelude.
//! 它重新导出了以下内容：
//!
//! * <code>[std::marker]::{[Copy], [Send], [Sized], [Sync], [Unpin]}</code>,
//! 表示类型基本属性的标记 trait。
//! * <code>[std::ops]::{[Fn], [FnMut], [FnOnce]}</code>, and their analogous
//!   async traits, <code>[std::ops]::{[AsyncFn], [AsyncFnMut], [AsyncFnOnce]}</code>.
//! * <code>[std::ops]::[Drop]</code>, for implementing destructors.
//! * <code>[std::mem]::[drop]</code>, a convenience function for explicitly
//! 释放值。
//! * <code>[std::mem]::{[size_of], [size_of_val]}</code>, to get the size of
//! 
//! * <code>[std::mem]::{[align_of], [align_of_val]}</code>, to get the
//!   alignment of a type or value.
//! * <code>[std::boxed]::[Box]</code>, a way to allocate values on the heap.
//! * <code>[std::borrow]::[ToOwned]</code>, the conversion trait that defines
//!   [`to_owned`], the generic method for creating an owned type from a
//!   borrowed type.
//! * <code>[std::clone]::[Clone]</code>, the ubiquitous trait that defines
//!   [`clone`][Clone::clone], the method for producing a copy of a value.
//! * <code>[std::cmp]::{[PartialEq], [PartialOrd], [Eq], [Ord]}</code>, the
//! 比较 trait，它们实现了比较运算符，通常出现在 trait 边界中。
//! ...
//! * <code>[std::convert]::{[AsRef], [AsMut], [Into], [From]}</code>, generic
//! 转换操作，被聪明的 API 作者用来创建重载方法。
//! * <code>[std::default]::[Default]</code>, types that have default values.
//! * <code>[std::iter]::{[Iterator], [Extend], [IntoIterator], [DoubleEndedIterator],
//!   [ExactSizeIterator]}</code>, iterators of various kinds.
//! * 大多数标准宏。
//! * <code>[std::option]::[Option]::{[self][Option], [Some], [None]}</code>, a
//! 类型，表示值的存在或缺失。这种类型非常常用，其变体也被导出。
//!   commonly used, its variants are also exported.
//! * <code>[std::result]::[Result]::{[self][Result], [Ok], [Err]}</code>, a type
//!   for functions that may succeed or fail. Like [`Option`], its variants are
//!   exported as well.
//! * <code>[std::string]::{[String], [ToString]}</code>, heap-allocated strings.
//! * <code>[std::vec]::[Vec]</code>, a growable, heap-allocated vector.
//!
//! The prelude used in Rust 2021, [`std::prelude::rust_2021`], includes all of the above,
//! and in addition re-exports:
//!
//! * <code>[std::convert]::{[TryFrom], [TryInto]}</code>.
//! * <code>[std::iter]::[FromIterator]</code>.
//!
//! The prelude used in Rust 2024, [`std::prelude::rust_2024`], includes all of the above,
//! Rust 标准库前奏的 2015 版本。
//!
//! * <code>[std::future]::{[Future], [IntoFuture]}</code>.
//!
//! [std::borrow]: crate::borrow
//! [std::boxed]: crate::boxed
//! [std::clone]: crate::clone
//! [std::cmp]: crate::cmp
//! [std::convert]: crate::convert
//! [std::default]: crate::default
//! [std::future]: crate::future
//! [std::iter]: crate::iter
//! [std::marker]: crate::marker
//! [std::mem]: crate::mem
//! [std::ops]: crate::ops
//! [std::option]: crate::option
//! [`std::prelude::v1`]: v1
//! [`std::prelude::rust_2015`]: rust_2015
//! [`std::prelude::rust_2018`]: rust_2018
//! [`std::prelude::rust_2021`]: rust_2021
//! [`std::prelude::rust_2024`]: rust_2024
//! [std::result]: crate::result
//! [std::slice]: crate::slice
//! [std::string]: crate::string
//! [std::vec]: mod@crate::vec
//! [`to_owned`]: crate::borrow::ToOwned::to_owned
//! [book-closures]: ../../book/ch13-01-closures.html
//! [book-dtor]: ../../book/ch15-03-drop.html
//! [book-enums]: ../../book/ch06-01-defining-an-enum.html
//! [book-iter]: ../../book/ch13-02-iterators.html
//! [Future]: crate::future::Future
//! [IntoFuture]: crate::future::IntoFuture

// No formatting: this file is nothing but re-exports, and their order is worth preserving.
#![cfg_attr(rustfmt, rustfmt::skip)]

#![stable(feature = "rust1", since = "1.0.0")]

pub mod v1;

/// Rust 标准库前奏的 2018 版本。
///
/// See the [module-level documentation](self) for more.
#[stable(feature = "prelude_2015", since = "1.55.0")]
pub mod rust_2015 {
    #[stable(feature = "prelude_2015", since = "1.55.0")]
    #[doc(no_inline)]
    pub use super::v1::*;
}

/// Rust 标准库前奏的 2018 版本。
///
/// See the [module-level documentation](self) for more.
#[stable(feature = "prelude_2018", since = "1.55.0")]
pub mod rust_2018 {
    #[stable(feature = "prelude_2018", since = "1.55.0")]
    #[doc(no_inline)]
    pub use super::v1::*;
}

/// Rust 标准库前奏的 2021 版本。
///
/// See the [module-level documentation](self) for more.
#[stable(feature = "prelude_2021", since = "1.55.0")]
pub mod rust_2021 {
    #[stable(feature = "prelude_2021", since = "1.55.0")]
    #[doc(no_inline)]
    pub use super::v1::*;

    #[stable(feature = "prelude_2021", since = "1.55.0")]
    #[doc(no_inline)]
    pub use core::prelude::rust_2021::*;

    // There are two different panic macros, one in `core` and one in `std`. They are slightly
    // different. For `std` we explicitly want the one defined in `std`.
    #[stable(feature = "prelude_2021", since = "1.55.0")]
    pub use super::v1::panic;
}

/// Rust 标准库前奏的 2024 版本。
///
/// See the [module-level documentation](self) for more.
#[stable(feature = "prelude_2024", since = "1.85.0")]
pub mod rust_2024 {
    #[stable(feature = "rust1", since = "1.0.0")]
    #[doc(no_inline)]
    pub use super::v1::*;

    #[stable(feature = "prelude_2024", since = "1.85.0")]
    #[doc(no_inline)]
    pub use core::prelude::rust_2024::*;

    // There are two different panic macros, one in `core` and one in `std`. They are slightly
    // different. For `std` we explicitly want the one defined in `std`.
    #[stable(feature = "prelude_2024", since = "1.85.0")]
    pub use super::v1::panic;
}

/// Rust 标准库前奏的 Future 版本。
///
/// See the [module-level documentation](self) for more.
#[doc(hidden)]
#[unstable(feature = "prelude_future", issue = "none")]
pub mod rust_future {
    #[stable(feature = "rust1", since = "1.0.0")]
    #[doc(no_inline)]
    pub use super::v1::*;

    #[unstable(feature = "prelude_next", issue = "none")]
    #[doc(no_inline)]
    pub use core::prelude::rust_future::*;

    // There are two different panic macros, one in `core` and one in `std`. They are slightly
    // different. For `std` we explicitly want the one defined in `std`.
    #[unstable(feature = "prelude_next", issue = "none")]
    pub use super::v1::panic;
}
