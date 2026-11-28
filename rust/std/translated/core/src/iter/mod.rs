//! 可组合的外部迭代器。
//!
//! 如果你发现自己有一个某种集合，并且需要
//! 对该集合的元素执行操作，你会很快发现
//! 它们变成了“迭代器”。在地道的 Rust 代码中，迭代器被大量使用，因此
//! 值得熟悉一下它们。
//!
//! 在进一步解释之前，让我们先谈谈这个模块的结构：
//!
//! # 组织结构
//!
//! 这个模块主要按类型进行组织：
//!
//! * [trait] 是核心部分：这些 trait 定义了存在哪些类型的迭代器以及你可以对它们做什么。这些 trait 的方法值得
//! 花一些额外的时间研究。
//! * [function] 提供了一些创建基本迭代器的有用方法。
//! * [struct] 通常是该模块 trait 上各种方法的返回类型。你通常应该查看创建
//! * [Structs] are often the return types of the various methods on this
//!   module's traits. You'll usually want to look at the method that creates
//!   the `struct`, rather than the `struct` itself. For more detail about why,
//!   see '[Implementing Iterator](#implementing-iterator)'.
//!
//! [Traits]: #traits
//! [Functions]: #functions
//! [Structs]: #structs
//!
//! That's it! Let's dig into iterators.
//!
//! # Iterator
//!
//! The heart and soul of this module is the [`Iterator`] trait. The core of
//! [`Iterator`] looks like this:
//!
//! ```
//! trait Iterator {
//!     type Item;
//!     fn next(&mut self) -> Option<Self::Item>;
//! }
//! ```
//!
//! An iterator has a method, [`next`], which when called, returns an
//! <code>[Option]\<Item></code>. Calling [`next`] will return [`Some(Item)`] as long as there
//! are elements, and once they've all been exhausted, will return `None` to
//! 迭代器也是可组合的，通常将它们串联起来以实现
//! resume iteration, and so calling [`next`] again may or may not eventually
//! start returning [`Some(Item)`] again at some point (for example, see [`TryIter`]).
//!
//! [`Iterator`]'s full definition includes a number of other methods as well,
//! but they are default methods, built on top of [`next`], and so you get
//! them for free.
//!
//! Iterators are also composable, and it's common to chain them together to do
//! more complex forms of processing. See the [Adapters](#adapters) section
//! # 实现 Iterator
//!
//! [`Some(Item)`]: Some
//! [`next`]: Iterator::next
//! [`TryIter`]: ../../std/sync/mpsc/struct.TryIter.html
//!
//! # The three forms of iteration
//!
//! There are three common methods which can create iterators from a collection:
//!
//! * `iter()`, which iterates over `&T`.
//! * `iter_mut()`, which iterates over `&mut T`.
//! * `into_iter()`, which iterates over `T`.
//!
//! Various things in the standard library may implement one or more of the
//! three, where appropriate.
//!
//! # Implementing Iterator
//!
//! Creating an iterator of your own involves two steps: creating a `struct` to
//! hold the iterator's state, and then implementing [`Iterator`] for that `struct`.
//! This is why there are so many `struct`s in this module: there is one for
//! each iterator and iterator adapter.
//!
//! Let's make an iterator named `Counter` which counts from `1` to `5`:
//!
//! ```
//! // First, the struct:
//!
//! /// An iterator which counts from one to five
//! struct Counter {
//!     count: usize,
//! }
//!
//! // we want our count to start at one, so let's add a new() method to help.
//! // This isn't strictly necessary, but is convenient. Note that we start
//! // `count` at zero, we'll see why in `next()`'s implementation below.
//! impl Counter {
//!     fn new() -> Counter {
//!         Counter { count: 0 }
//!     }
//! }
//!
//! // Then, we implement `Iterator` for our `Counter`:
//!
//! impl Iterator for Counter {
//!     // we will be counting with usize
//!     type Item = usize;
//!
//!     // next() is the only required method
//!     fn next(&mut self) -> Option<Self::Item> {
//!         // Increment our count. This is why we started at zero.
//!         self.count += 1;
//!
//!         // Check to see if we've finished counting or not.
//!         if self.count < 6 {
//!             Some(self.count)
//!         } else {
//!             None
//!         }
//!     }
//! }
//!
//! // And now we can use it!
//!
//! let mut counter = Counter::new();
//!
//! assert_eq!(counter.next(), Some(1));
//! assert_eq!(counter.next(), Some(2));
//! assert_eq!(counter.next(), Some(3));
//! assert_eq!(counter.next(), Some(4));
//! assert_eq!(counter.next(), Some(5));
//! assert_eq!(counter.next(), None);
//! ```
//!
//! Calling [`next`] this way gets repetitive. Rust has a construct which can
//! call [`next`] on your iterator, until it reaches `None`. Let's go over that
//! 接下来。
//!
//! Also note that `Iterator` provides a default implementation of methods such as `nth` and `fold`
//! which call `next` internally. However, it is also possible to write a custom implementation of
//! methods like `nth` and `fold` if an iterator can compute them more efficiently without calling
//! `next`.
//!
//! # `for` loops and `IntoIterator`
//!
//! Rust's `for` loop syntax is actually sugar for iterators. Here's a basic
//! example of `for`:
//!
//! ```
//! let values = vec![1, 2, 3, 4, 5];
//!
//! for x in values {
//!     println!("{x}");
//! }
//! ```
//!
//! 这将打印数字 1 到 5，每个数字独占一行。但是
//! 你会注意到这里的一件事：我们从未对向量调用任何操作来生成迭代器。这是为什么？
//! 标准库中有一个 trait 用于将某物转换为
//!
//! There's a trait in the standard library for converting something into an
//! iterator: [`IntoIterator`]. This trait has one method, [`into_iter`],
//! which converts the thing implementing [`IntoIterator`] into an iterator.
//! Let's take a look at that `for` loop again, and what the compiler converts
//! it into:
//!
//! [`into_iter`]: IntoIterator::into_iter
//!
//! ```
//! let values = vec![1, 2, 3, 4, 5];
//!
//! for x in values {
//!     println!("{x}");
//! }
//! ```
//!
//! Rust de-sugars this into:
//!
//! ```
//! let values = vec![1, 2, 3, 4, 5];
//! {
//!     let result = match IntoIterator::into_iter(values) {
//!         mut iter => loop {
//!             let next;
//!             match iter.next() {
//!                 Some(val) => next = val,
//!                 None => break,
//!             };
//!             let x = next;
//!             let () = { println!("{x}"); };
//!         },
//!     };
//!     result
//! }
//! ```
//!
//! First, we call `into_iter()` on the value. Then, we match on the iterator
//! that returns, calling [`next`] over and over until we see a `None`. At
//! that point, we `break` out of the loop, and we're done iterating.
//!
//! There's one more subtle bit here: the standard library contains an
//! interesting implementation of [`IntoIterator`]:
//!
//! ```ignore (only-for-syntax-highlight)
//! impl<I: Iterator> IntoIterator for I
//! ```
//!
//! In other words, all [`Iterator`]s implement [`IntoIterator`], by just
//! returning themselves. This means two things:
//!
//! 1. If you're writing an [`Iterator`], you can use it with a `for` loop.
//! 2. If you're creating a collection, implementing [`IntoIterator`] for it
//!    will allow your collection to be used with the `for` loop.
//!
//! # Iterating by reference
//!
//! Since [`into_iter()`] takes `self` by value, using a `for` loop to iterate
//! over a collection consumes that collection. Often, you may want to iterate
//! over a collection without consuming it. Many collections offer methods that
//! provide iterators over references, conventionally called `iter()` and
//! `iter_mut()` respectively:
//!
//! ```
//! let mut values = vec![41];
//! for x in values.iter_mut() {
//!     *x += 1;
//! }
//! for x in values.iter() {
//!     assert_eq!(*x, 42);
//! }
//! assert_eq!(values.len(), 1); // `values` is still owned by this function.
//! ```
//!
//! If a collection type `C` provides `iter()`, it usually also implements
//! `IntoIterator` for `&C`, with an implementation that just calls `iter()`.
//! Likewise, a collection `C` that provides `iter_mut()` generally implements
//! `IntoIterator` for `&mut C` by delegating to `iter_mut()`. This enables a
//! 
//!
//! ```
//! let mut values = vec![41];
//! for x in &mut values {
//!     //   ^ same as `values.iter_mut()`
//!     *x += 1;
//! }
//! for x in &values {
//!     //   ^ same as `values.iter()`
//!     assert_eq!(*x, 42);
//! }
//! assert_eq!(values.len(), 1);
//! ```
//!
//! While many collections offer `iter()`, not all offer `iter_mut()`. For
//! example, mutating the keys of a [`HashSet<T>`] could put the collection
//! into an inconsistent state if the key hashes change, so this collection
//! only offers `iter()`.
//!
//! [`into_iter()`]: IntoIterator::into_iter
//! [`HashSet<T>`]: ../../std/collections/struct.HashSet.html
//!
//! # Adapters
//!
//! Functions which take an [`Iterator`] and return another [`Iterator`] are
//! 模式”的一种形式。
//! pattern'.
//!
//! Common iterator adapters include [`map`], [`take`], and [`filter`].
//! 如果迭代器适配器发生 panic，迭代器将处于一个未指定（但
//!
//! 内存安全）的状态。这种状态也不保证在 Rust 的不同版本中保持不变，因此不应依赖
//! 发生 panic 的迭代器返回的确切值。
//! # 惰性
//! returned by an iterator which panicked.
//!
//! [`map`]: Iterator::map
//! [`take`]: Iterator::take
//! [`filter`]: Iterator::filter
//!
//! # Laziness
//!
//! Iterators (and iterator [adapters](#adapters)) are *lazy*. This means that
//! 方法会对其遍历的每个元素调用一个闭包：
//! until you call [`next`]. This is sometimes a source of confusion when
//! creating an iterator solely for its side effects. For example, the [`map`]
//! method calls a closure on each element it iterates over:
//!
//! ```
//! # #![allow(unused_must_use)]
//! # #![allow(map_unit_fn)]
//! let v = vec![1, 2, 3, 4, 5];
//! v.iter().map(|x| println!("{x}"));
//! ```
//!
//! This will not print any values, as we only created an iterator, rather than
//! 方法来生成一个新的集合。
//!
//! ```text
//! warning: unused result that must be used: iterators are lazy and
//! do nothing unless consumed
//! ```
//!
//! The idiomatic way to write a [`map`] for its side effects is to use a
//! `for` loop or call the [`for_each`] method:
//!
//! ```
//! let v = vec![1, 2, 3, 4, 5];
//!
//! v.iter().for_each(|x| println!("{x}"));
//! // or
//! for x in &v {
//!     println!("{x}");
//! }
//! ```
//!
//! [`map`]: Iterator::map
//! [`for_each`]: Iterator::for_each
//!
//! Another common way to evaluate an iterator is to use the [`collect`]
//! 迭代器转换为有限迭代器：
//!
//! [`collect`]: Iterator::collect
//!
//! # Infinity
//!
//! 请注意，即使对于那些可以在有限时间内数学上确定结果的无限迭代器方法，也可能不会终止。
//! an infinite iterator:
//!
//! ```
//! let numbers = 0..;
//! ```
//!
//! It is common to use the [`take`] iterator adapter to turn an infinite
//! iterator into a finite one:
//!
//! ```
//! let numbers = 0..;
//! let five_numbers = numbers.take(5);
//!
//! for number in five_numbers {
//!     println!("{number}");
//! }
//! ```
//!
//! This will print the numbers `0` through `4`, each on their own line.
//!
//! Bear in mind that methods on infinite iterators, even those for which a
//! result can be determined mathematically in finite time, might not terminate.
//! Specifically, methods such as [`min`], which in the general case require
//! 遍历迭代器中的每个元素，很可能无法
//! 对任何无限迭代器都成功返回。
//!
//! ```no_run
//! let ones = std::iter::repeat(1);
//! let least = ones.min().unwrap(); // Oh no! An infinite loop!
//! // `ones.min()` causes an infinite loop, so we won't reach this point!
//! println!("The smallest number one is {least}.");
//! ```
//!
//! [`take`]: Iterator::take
//! [`min`]: Iterator::min

#![stable(feature = "rust1", since = "1.0.0")]

// This needs to be up here in order to be usable in the child modules
macro_rules! impl_fold_via_try_fold {
    (fold -> try_fold) => {
        impl_fold_via_try_fold! { @internal fold -> try_fold }
    };
    (rfold -> try_rfold) => {
        impl_fold_via_try_fold! { @internal rfold -> try_rfold }
    };
    (spec_fold -> spec_try_fold) => {
        impl_fold_via_try_fold! { @internal spec_fold -> spec_try_fold }
    };
    (spec_rfold -> spec_try_rfold) => {
        impl_fold_via_try_fold! { @internal spec_rfold -> spec_try_rfold }
    };
    (@internal $fold:ident -> $try_fold:ident) => {
        #[inline]
        fn $fold<AAA, FFF>(mut self, init: AAA, fold: FFF) -> AAA
        where
            FFF: FnMut(AAA, Self::Item) -> AAA,
        {
            use crate::ops::NeverShortCircuit;

            self.$try_fold(init, NeverShortCircuit::wrap_mut_2(fold)).0
        }
    };
}

#[unstable(feature = "iter_array_chunks", issue = "100450")]
pub use self::adapters::ArrayChunks;
#[unstable(feature = "std_internals", issue = "none")]
pub use self::adapters::ByRefSized;
#[stable(feature = "iter_cloned", since = "1.1.0")]
pub use self::adapters::Cloned;
#[stable(feature = "iter_copied", since = "1.36.0")]
pub use self::adapters::Copied;
#[stable(feature = "iterator_flatten", since = "1.29.0")]
pub use self::adapters::Flatten;
#[stable(feature = "iter_map_while", since = "1.57.0")]
pub use self::adapters::MapWhile;
#[unstable(feature = "iter_map_windows", issue = "87155")]
pub use self::adapters::MapWindows;
#[unstable(feature = "inplace_iteration", issue = "none")]
pub use self::adapters::SourceIter;
#[stable(feature = "iterator_step_by", since = "1.28.0")]
pub use self::adapters::StepBy;
#[unstable(feature = "trusted_random_access", issue = "none")]
pub use self::adapters::TrustedRandomAccess;
#[unstable(feature = "trusted_random_access", issue = "none")]
pub use self::adapters::TrustedRandomAccessNoCoerce;
#[stable(feature = "iter_chain", since = "1.91.0")]
pub use self::adapters::chain;
pub(crate) use self::adapters::try_process;
#[stable(feature = "iter_zip", since = "1.59.0")]
pub use self::adapters::zip;
#[stable(feature = "rust1", since = "1.0.0")]
pub use self::adapters::{
    Chain, Cycle, Enumerate, Filter, FilterMap, FlatMap, Fuse, Inspect, Map, Peekable, Rev, Scan,
    Skip, SkipWhile, Take, TakeWhile, Zip,
};
#[unstable(feature = "iter_intersperse", issue = "79524")]
pub use self::adapters::{Intersperse, IntersperseWith};
#[unstable(
    feature = "step_trait",
    reason = "likely to be replaced by finer-grained traits",
    issue = "42168"
)]
pub use self::range::Step;
#[unstable(feature = "iter_macro", issue = "142269", reason = "generators are unstable")]
pub use self::sources::iter;
#[stable(feature = "iter_empty", since = "1.2.0")]
pub use self::sources::{Empty, empty};
#[unstable(
    feature = "iter_from_coroutine",
    issue = "43122",
    reason = "coroutines are unstable"
)]
pub use self::sources::{FromCoroutine, from_coroutine};
#[stable(feature = "iter_from_fn", since = "1.34.0")]
pub use self::sources::{FromFn, from_fn};
#[stable(feature = "iter_once", since = "1.2.0")]
pub use self::sources::{Once, once};
#[stable(feature = "iter_once_with", since = "1.43.0")]
pub use self::sources::{OnceWith, once_with};
#[stable(feature = "rust1", since = "1.0.0")]
pub use self::sources::{Repeat, repeat};
#[stable(feature = "iter_repeat_n", since = "1.82.0")]
pub use self::sources::{RepeatN, repeat_n};
#[stable(feature = "iterator_repeat_with", since = "1.28.0")]
pub use self::sources::{RepeatWith, repeat_with};
#[stable(feature = "iter_successors", since = "1.34.0")]
pub use self::sources::{Successors, successors};
#[stable(feature = "fused", since = "1.26.0")]
pub use self::traits::FusedIterator;
#[unstable(issue = "none", feature = "inplace_iteration")]
pub use self::traits::InPlaceIterable;
#[stable(feature = "rust1", since = "1.0.0")]
pub use self::traits::Iterator;
#[unstable(issue = "none", feature = "trusted_fused")]
pub use self::traits::TrustedFused;
#[unstable(feature = "trusted_len", issue = "37572")]
pub use self::traits::TrustedLen;
#[unstable(feature = "trusted_step", issue = "85731")]
pub use self::traits::TrustedStep;
#[stable(feature = "rust1", since = "1.0.0")]
pub use self::traits::{
    DoubleEndedIterator, ExactSizeIterator, Extend, FromIterator, IntoIterator, Product, Sum,
};

mod adapters;
mod range;
mod sources;
mod traits;
