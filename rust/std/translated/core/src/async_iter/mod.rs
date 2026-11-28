//! 可组合的异步迭代器。
//!
//! 如果你发现自己处理某种异步集合，
//! 并且需要对该集合的元素执行操作，
//! 你很快就会遇到“异步迭代器”。异步迭代器在
//! 符合语法的异步 Rust 代码中被广泛使用，因此值得熟悉它们。
//!
//! 在进一步解释之前，我们先来谈谈这个模块的结构：
//!
//! # 组织结构
//!
//! 这个模块主要按类型进行组织：
//!
//! * [trait] 是核心部分：这些 trait 定义了存在哪些类型的异步迭代器以及你可以对它们做什么。这些 trait 的方法值得
//! 花一些额外的时间研究。
//! * 函数提供了创建基本异步迭代器的几种方法。
//! * 结构体通常是该模块 trait 各种方法的返回类型。你通常应该关注创建
//! * Structs are often the return types of the various methods on this
//!   module's traits. You'll usually want to look at the method that creates
//!   the `struct`, rather than the `struct` itself. For more detail about why,
//!   see '[Implementing Async Iterator](#implementing-async-iterator)'.
//!
//! [Traits]: #traits
//!
//! That's it! Let's dig into async iterators.
//!
//! # Async Iterators
//!
//! The heart and soul of this module is the [`AsyncIterator`] trait. The core of
//! [`AsyncIterator`] looks like this:
//!
//! ```
//! # use core::task::{Context, Poll};
//! # use core::pin::Pin;
//! trait AsyncIterator {
//!     type Item;
//!     fn poll_next(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>>;
//! }
//! ```
//!
//! Unlike `Iterator`, `AsyncIterator` makes a distinction between the [`poll_next`]
//! method which is used when implementing an `AsyncIterator`, and a (to-be-implemented)
//! `next` method which is used when consuming an async iterator. Consumers of `AsyncIterator`
//! only need to consider `next`, which when called, returns a future which
//! yields `Option<AsyncIterator::Item>`.
//!
//! The future returned by `next` will yield `Some(Item)` as long as there are
//! elements, and once they've all been exhausted, will yield `None` to indicate
//! that iteration is finished. If we're waiting on something asynchronous to
//! # 实现 Async Iterator
//!
//! Individual async iterators may choose to resume iteration, and so calling `next`
//! again may or may not eventually yield `Some(Item)` again at some point.
//!
//! [`AsyncIterator`]'s full definition includes a number of other methods as well,
//! but they are default methods, built on top of [`poll_next`], and so you get
//! them for free.
//!
//! [`Poll`]: super::task::Poll
//! [`poll_next`]: AsyncIterator::poll_next
//!
//! # Implementing Async Iterator
//!
//! Creating an async iterator of your own involves two steps: creating a `struct` to
//! hold the async iterator's state, and then implementing [`AsyncIterator`] for that
//! `struct`.
//!
//! Let's make an async iterator named `Counter` which counts from `1` to `5`:
//!
//! ```no_run
//! #![feature(async_iterator)]
//! # use core::async_iter::AsyncIterator;
//! # use core::task::{Context, Poll};
//! # use core::pin::Pin;
//!
//! // First, the struct:
//!
//! /// An async iterator which counts from one to five
//! struct Counter {
//!     count: usize,
//! }
//!
//! // we want our count to start at one, so let's add a new() method to help.
//! // This isn't strictly necessary, but is convenient. Note that we start
//! // `count` at zero, we'll see why in `poll_next()`'s implementation below.
//! impl Counter {
//!     fn new() -> Counter {
//!         Counter { count: 0 }
//!     }
//! }
//!
//! // Then, we implement `AsyncIterator` for our `Counter`:
//!
//! impl AsyncIterator for Counter {
//!     // we will be counting with usize
//!     type Item = usize;
//!
//!     // poll_next() is the only required method
//!     fn poll_next(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
//!         // Increment our count. This is why we started at zero.
//!         self.count += 1;
//!
//!         // Check to see if we've finished counting or not.
//!         if self.count < 6 {
//!             Poll::Ready(Some(self.count))
//!         } else {
//!             Poll::Ready(None)
//!         }
//!     }
//! }
//! ```
//!
//! # 惰性性
//!
//! 异步迭代器是 *惰性* 的。这意味着仅仅创建一个异步迭代器并不会
//! _do_ a whole lot. Nothing really happens until you call `poll_next`. This is
//! 是仅因其副作用而创建异步迭代器时造成困惑的原因。编译器会对这种行为发出警告：
//! effects. The compiler will warn us about this kind of behavior:
//!
//! ```text
//! warning: unused result that must be used: async iterators do nothing unless polled
//! ```

mod async_iter;
mod from_iter;

pub use async_iter::{AsyncIterator, IntoAsyncIterator};
pub use from_iter::{FromIter, from_iter};
