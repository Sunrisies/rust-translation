//! 集合类型。
//!
//! Rust 的标准集合库提供了高效实现
//! 最常见的通用编程数据结构。通过使用这些标准实现，两个库
//! 应该能够在不进行大量数据转换的情况下进行通信。
//! communicate without significant data conversion.
//!
//! To get this out of the way: you should probably just use [`Vec`] or [`HashMap`].
//! 处理的使用场景。它们在执行其功能方面非常出色。标准库中的其他所有
//! 集合都有特定的使用场景，在这些场景下它们是最佳选择，但相比之下这些场景属于边缘的 *小众* 情况。
//! collections in the standard library have specific use cases where they are
//! 开始使用的足够好的选择。
//! Even when `Vec` and `HashMap` are technically suboptimal, they're probably a
//! good enough choice to get started.
//!
//! Rust's collections can be grouped into four major categories:
//!
//! * Sequences: [`Vec`], [`VecDeque`], [`LinkedList`]
//! * Maps: [`HashMap`], [`BTreeMap`]
//! * Sets: [`HashSet`], [`BTreeSet`]
//! * Misc: [`BinaryHeap`]
//!
//! # 
//!
//! These are fairly high-level and quick break-downs of when each collection
//! 应何时考虑使用这些集合的详细讨论可以在各自的文档页面中找到。
//! individual collections can be found on their own documentation pages.
//!
//! ### Use a [`Vec`] when:
//! * 你希望以特定顺序排列元素序列，并且只会在末尾追加（或接近末尾）。
//! * 你需要一个栈。
//! * 你需要一个可调整大小的数组。
//! * 你需要一个堆分配数组。
//! * You want a stack.
//! * You want a resizable array.
//! * 你希望一个队列。
//!
//! ### Use a [`VecDeque`] when:
//! * You want a [`Vec`] that supports efficient insertion at both ends of the
//!   sequence.
//! * 你希望一个队列。
//! * 你希望一个双端队列（deque）。
//!
//! ### Use a [`LinkedList`] when:
//! * You want a [`Vec`] or [`VecDeque`] of unknown size, and can't tolerate
//! * 你希望高效地分割和追加列表。
//! * 你 *绝对* 确定你需要一个双向链接列表。
//! * You are *absolutely* certain you *really*, *truly*, want a doubly linked
//! * 你希望将任意键与任意值关联起来。
//!
//! ### Use a [`HashMap`] when:
//! * 你希望一个没有额外功能的映射。
//! * You want a cache.
//! * 你希望一个按键排序的映射。
//!
//! ### Use a [`BTreeMap`] when:
//! * You want a map sorted by its keys.
//! * You want to be able to get a range of entries on-demand.
//! * 您想知道最小的或最大的键值对是什么。
//! * 您希望找到比某些值小或大的最大或最小键。
//! ＞某些值。
//!
//! ### Use the `Set` variant of any of these `Map`s when:
//! * 您只是想记住已经看到的键。
//! * 您的键没有有意义的值可以关联。
//! * 您只需要一个集合。
//!
//! ### Use a [`BinaryHeap`] when:
//!
//! * 您想要存储大量元素，但只需要在任何时候处理
//! “最大”或“最重要的”一个。
//! * 您需要一个优先队列。
//!
//! # 性能
//!
//! 选择适合任务的集合需要了解
//! 每个集合擅长什么。这里我们简要总结了
//! 不同集合在某些重要操作中的性能。更多细节，
//! 请参阅每种类型的文档，请注意实际方法的名称可能
//! 与下面的表格有所不同。
//!
//! 在文档中，我们将遵循以下约定
//! 用于操作符号：
//!
//! * The collection's size is denoted by `n`.
//! * If a second collection is involved, its size is denoted by `m`.
//! * Item indices are denoted by `i`.
//! * Operations which have an *amortized* cost are suffixed with a `*`.
//! * Operations with an *expected* cost are suffixed with a `~`.
//!
//! 调用向集合添加操作的代码有时需要
//! 调整集合大小——这是一个需要 *O*(*n*) 时间的额外操作。
//!
//! *平均* 成本是为了在大量操作中考虑这种调整的时间成本而计算的。单个
//! 操作可能因为集合
//! 大小的随机性而更慢或更快，但每个操作的平均成本将接近平均成本。
//! Rust 的集合永远不会自动缩小，因此删除操作不是
//! 平均的。
//!
//! Rust's collections never automatically shrink, so removal operations aren't
//! amortized.
//!
//! [`HashMap`] uses *expected* costs. It is theoretically possible, though very
//! unlikely, for [`HashMap`] to experience significantly worse performance than
//! 需要额外的计算来修正。
//! ## 集合操作的成本
//! |                | get(i)                 | insert(i)               | remove(i)              | append(Vec(m))    | split_off(i)           | range           | append       |
//!
//! ## Cost of Collection Operations
//!
//!
//! |                | get(i)                 | insert(i)               | remove(i)              | append(Vec(m))    | split_off(i)           | range           | append       |
//! |----------------|------------------------|-------------------------|------------------------|-------------------|------------------------|-----------------|--------------|
//! | [`Vec`]        | *O*(1)                 | *O*(*n*-*i*)*           | *O*(*n*-*i*)           | *O*(*m*)*         | *O*(*n*-*i*)           | N/A             | N/A          |
//! | [`VecDeque`]   | *O*(1)                 | *O*(min(*i*, *n*-*i*))* | *O*(min(*i*, *n*-*i*)) | *O*(*m*)*         | *O*(min(*i*, *n*-*i*)) | N/A             | N/A          |
//! | [`LinkedList`] | *O*(min(*i*, *n*-*i*)) | *O*(min(*i*, *n*-*i*))  | *O*(min(*i*, *n*-*i*)) | *O*(1)            | *O*(min(*i*, *n*-*i*)) | N/A             | N/A          |
//! | [`HashMap`]    | *O*(1)~                | *O*(1)~*                | *O*(1)~                | N/A               | N/A                    | N/A             | N/A          |
//! | [`BTreeMap`]   | *O*(log(*n*))          | *O*(log(*n*))           | *O*(log(*n*))          | N/A               | N/A                    | *O*(log(*n*))   | *O*(*n*+*m*) |
//!
//! Note that where ties occur, [`Vec`] is generally going to be faster than
//! [`VecDeque`], and [`VecDeque`] is generally going to be faster than
//! [`LinkedList`].
//!
//! 对于 Sets，所有操作的成本与等效的 Map 操作相同。
//!
//! # 集合的正确高效使用
//!
//! 当然，知道哪种集合适合特定任务并不
//! 立即让你能够正确使用它。以下是一些快速提示，用于
//! 一般标准集合的高效正确使用。如果你
//! 对如何使用特定集合感兴趣，请查阅其文档以获取详细讨论和代码示例。
//! ## 容量管理
//!
//! ## 许多集合提供多种构造函数和方法，这些方法都涉及
//!
//! “容量”的概念。这些集合通常基于数组构建。
//! 理想情况下，该数组的大小应恰好能容纳集合中存储的所有元素，但要让集合实现这一点会
//! 非常低效。如果底层数组在所有情况下都恰好达到正确大小，那么每次插入元素时，集合都必须
//! 扩展数组以容纳它。由于大多数计算机上内存的分配和管理方式，
//! 几乎肯定需要分配一个新的数组并将旧数组中的每个元素复制到新数组中。
//! 希望你能看到，这种操作在每次执行时都不会非常高效。
//! 因此，大多数集合使用*平均*分配策略。它们通常允许有一定量的未占用空间，因此
//! 只需偶尔扩展一次。当它们扩展时，会分配一个
//! 大得多的数组来移动元素，这样就需要另一次扩展才能满足需求。虽然这种策略很好，但
//! Hopefully you can see that this wouldn't be very efficient to do on every
//! operation.
//!
//! Most collections therefore use an *amortized* allocation strategy. They
//! generally let themselves have a fair amount of unoccupied space so that they
//! only have to grow on occasion. When they do grow, they allocate a
//! substantially larger array to move the elements into so that it will take a
//! while for another grow to be required. While this strategy is great in
//! 一般来说，如果集合*永远*不需要调整大小会更好。
//! 不幸的是，集合本身没有足够的信息来自行完成此操作。因此，由我们程序员来提供提示。
//! 提示信息。
//! it hints.
//!
//! Any `with_capacity` constructor will instruct the collection to allocate
//! enough space for the specified number of elements. Ideally this will be for
//! 至少要有这样一个合理的上限。
//! this. See collection-specific documentation for details. In general, use
//! `with_capacity` when you know exactly how many elements will be inserted, or
//! at least have a reasonable upper-bound on that number.
//!
//! When anticipating a large influx of elements, the `reserve` family of
//! [Iterators][crate::iter]
//! for the coming items. As with `with_capacity`, the precise behavior of
//! these methods will be specific to the collection of interest.
//!
//! For optimal performance, collections will generally avoid shrinking
//! themselves. If you believe that a collection will not soon contain any more
//! elements, or just really need the memory, the `shrink_to_fit` method prompts
//! the collection to shrink the backing array to the minimum size capable of
//! holding its elements.
//!
//! Finally, if ever you're interested in what the actual capacity of the
//! collection is, most collections provide a `capacity` method to query this
//! information on demand. This can be useful for debugging purposes, or for
//! use with the `reserve` methods.
//!
//! ## Iterators
//!
//! [Iterators][crate::iter]
//! are a powerful and robust mechanism used throughout Rust's
//! standard libraries. Iterators provide a sequence of values in a generic,
//! safe, efficient and convenient way. The contents of an iterator are usually
//! *lazily* evaluated, so that only the values that are actually needed are
//! ever actually produced, and no allocation need be done to temporarily store
//! them. Iterators are primarily consumed using a `for` loop, although many
//! functions also take iterators where a collection or sequence of values is
//! desired.
//!
//! All of the standard collections provide several iterators for performing
//! bulk manipulation of their contents. The three primary iterators almost
//! every collection should provide are `iter`, `iter_mut`, and `into_iter`.
//! 有些内容在集合中提供会显得不合理或
//! 不适当。
//!
//! `iter` provides an iterator of immutable references to all the contents of a
//! collection in the most "natural" order. For sequence collections like [`Vec`],
//! 这意味着元素将按照索引递增的顺序被输出，从 0 开始。
//! at 0. For ordered collections like [`BTreeMap`], this means that the items
//! will be yielded in sorted order. For unordered collections like [`HashMap`],
//! 元素将按内部表示方式最方便的顺序被输出。这对于快速浏览集合中的所有内容非常有用。
//! most convenient. This is great for reading through all the contents of the
//! collection.
//!
//! ```
//! let vec = vec![1, 2, 3, 4];
//! for x in vec.iter() {
//!    println!("vec contained {x:?}");
//! }
//! ```
//!
//! `iter_mut` provides an iterator of *mutable* references in the same order as
//! `iter`. This is great for mutating all the contents of the collection.
//!
//! ```
//! let mut vec = vec![1, 2, 3, 4];
//! for x in vec.iter_mut() {
//!    *x += 1;
//! }
//! ```
//!
//! `into_iter` transforms the actual collection into an iterator over its
//! 是将一个集合的内容移动到另一个集合的主要方式。
//! needed, and the values are needed elsewhere. Using `extend` with `into_iter`
//! is the main way that contents of one collection are moved into another.
//! `extend` automatically calls `into_iter`, and takes any <code>T: [IntoIterator]</code>.
//! Calling `collect` on an iterator itself is also a great way to convert one
//! collection into another. Both of these methods should internally use the
//! capacity management tools discussed in the previous section to do this as
//! efficiently as possible.
//!
//! ```
//! let mut vec1 = vec![1, 2, 3, 4];
//! let vec2 = vec![10, 20, 30, 40];
//! vec1.extend(vec2);
//! ```
//!
//! ```
//! use std::collections::VecDeque;
//!
//! let vec = [1, 2, 3, 4];
//! let buf: VecDeque<_> = vec.into_iter().collect();
//! ```
//!
//! 集合都提供可逆迭代器，以逆序方式遍历它们。
//! threads to sequences. Among the adapters are functional favorites like `map`,
//! `fold`, `skip` and `take`. Of particular interest to collections is the
//! `rev` adapter, which reverses any iterator that supports this operation. Most
//! 逆序方式遍历它们。
//! 其他几种集合方法也返回迭代器来生成结果序列，但避免分配整个集合来存储结果。
//!
//! ```
//! let vec = vec![1, 2, 3, 4];
//! for x in vec.iter().rev() {
//!    println!("vec contained {x:?}");
//! }
//! ```
//!
//! 这提供了最大的灵活性，因为
//! of results but avoid allocating an entire collection to store the result in.
//! This provides maximum flexibility as
//! [`collect`][crate::iter::Iterator::collect] or
//! [`extend`][crate::iter::Extend::extend] can be called to
//! "pipe" the sequence into any collection if desired. Otherwise, the sequence
//! can be looped over with a `for` loop. The iterator can also be discarded
//! 在部分使用后，避免计算未使用的项。
//!
//! ## 条目
//!
//! The `entry` API is intended to provide an efficient mechanism for
//! 根据键的存在与否条件性地操作映射的内容。
//! 或不是。主要的应用场景是提供高效的
//! 累积映射。例如，如果希望维护每个键出现的
//! 次数，他们必须执行一些逻辑判断，以决定这是否是第一次出现该键。
//! conditional logic on whether this is the first time the key has been seen or
//! not. Normally, this would require a `find` followed by an `insert`,
//! effectively duplicating the search effort on each insertion.
//!
//! When a user calls `map.entry(key)`, the map will search for the key and
//! then yield a variant of the `Entry` enum.
//!
//! If a `Vacant(entry)` is yielded, then the key *was not* found. In this case
//! the only valid operation is to `insert` a value into the entry. When this is
//! done, the vacant entry is consumed and converted into a mutable reference to
//! the value that was inserted. This allows for further manipulation of the
//! value beyond the lifetime of the search itself. This is useful if complex
//! ### 示例
//! just inserted.
//!
//! If an `Occupied(entry)` is yielded, then the key *was* found. In this case,
//! the user has several options: they can `get`, `insert` or `remove` the
//! 当需要对值进行的逻辑更复杂时，我们可以简单地使用
//! entry into a mutable reference to its value, providing symmetry to the
//! vacant `insert` case.
//!
//! # 插入和复杂的键
//!
//! Here are the two primary ways in which `entry` is used. First, a simple
//! 不会更新键的值。例如：
//!
//! #### 使用二次探测和 SIMD 查找实现的哈希映射。
//!
//! ```
//! use std::collections::btree_map::BTreeMap;
//!
//! let mut count = BTreeMap::new();
//! let message = "she sells sea shells by the sea shore";
//!
//! for c in message.chars() {
//!     *count.entry(c).or_insert(0) += 1;
//! }
//!
//! assert_eq!(count.get(&'s'), Some(&8));
//!
//! println!("Number of occurrences of each character");
//! for (char, count) in &count {
//!     println!("{char}: {count}");
//! }
//! ```
//!
//! When the logic to be performed on the value is more complex, we may simply
//! use the `entry` API to ensure that the value is initialized and perform the
//! logic afterwards.
//!
//! #### Tracking the inebriation of customers at a bar
//!
//! ```
//! use std::collections::btree_map::BTreeMap;
//!
//! // A client of the bar. They have a blood alcohol level.
//! struct Person { blood_alcohol: f32 }
//!
//! // All the orders made to the bar, by client ID.
//! let orders = vec![1, 2, 1, 2, 3, 4, 1, 2, 2, 3, 4, 1, 1, 1];
//!
//! // Our clients.
//! let mut blood_alcohol = BTreeMap::new();
//!
//! for id in orders {
//!     // If this is the first time we've seen this customer, initialize them
//!     // with no blood alcohol. Otherwise, just retrieve them.
//!     let person = blood_alcohol.entry(id).or_insert(Person { blood_alcohol: 0.0 });
//!
//!     // Reduce their blood alcohol level. It takes time to order and drink a beer!
//!     person.blood_alcohol *= 0.9;
//!
//!     // Check if they're sober enough to have another beer.
//!     if person.blood_alcohol > 0.3 {
//!         // Too drunk... for now.
//!         println!("Sorry {id}, I have to cut you off");
//!     } else {
//!         // Have another!
//!         person.blood_alcohol += 0.1;
//!     }
//! }
//! ```
//!
//! # Insert and complex keys
//!
//! If we have a more complex key, calls to `insert` will
//! not update the value of the key. For example:
//!
//! ```
//! use std::cmp::Ordering;
//! use std::collections::BTreeMap;
//! use std::hash::{Hash, Hasher};
//!
//! #[derive(Debug)]
//! struct Foo {
//!     a: u32,
//!     b: &'static str,
//! }
//!
//! // we will compare `Foo`s by their `a` value only.
//! impl PartialEq for Foo {
//!     fn eq(&self, other: &Self) -> bool { self.a == other.a }
//! }
//!
//! impl Eq for Foo {}
//!
//! // we will hash `Foo`s by their `a` value only.
//! impl Hash for Foo {
//!     fn hash<H: Hasher>(&self, h: &mut H) { self.a.hash(h); }
//! }
//!
//! impl PartialOrd for Foo {
//!     fn partial_cmp(&self, other: &Self) -> Option<Ordering> { self.a.partial_cmp(&other.a) }
//! }
//!
//! impl Ord for Foo {
//!     fn cmp(&self, other: &Self) -> Ordering { self.a.cmp(&other.a) }
//! }
//!
//! let mut map = BTreeMap::new();
//! map.insert(Foo { a: 1, b: "baz" }, 99);
//!
//! // We already have a Foo with an a of 1, so this will be updating the value.
//! map.insert(Foo { a: 1, b: "xyz" }, 100);
//!
//! // The value has been updated...
//! assert_eq!(map.values().next().unwrap(), &100);
//!
//! // ...but the key hasn't changed. b is still "baz", not "xyz".
//! assert_eq!(map.keys().next().unwrap().b, "baz");
//! ```

#![stable(feature = "rust1", since = "1.0.0")]

#[stable(feature = "try_reserve", since = "1.57.0")]
pub use alloc_crate::collections::TryReserveError;
#[unstable(
    feature = "try_reserve_kind",
    reason = "Uncertain how much info should be exposed",
    issue = "48043"
)]
pub use alloc_crate::collections::TryReserveErrorKind;
#[stable(feature = "rust1", since = "1.0.0")]
pub use alloc_crate::collections::{BTreeMap, BTreeSet, BinaryHeap};
#[stable(feature = "rust1", since = "1.0.0")]
pub use alloc_crate::collections::{LinkedList, VecDeque};
#[stable(feature = "rust1", since = "1.0.0")]
pub use alloc_crate::collections::{binary_heap, btree_map, btree_set};
#[stable(feature = "rust1", since = "1.0.0")]
pub use alloc_crate::collections::{linked_list, vec_deque};

#[stable(feature = "rust1", since = "1.0.0")]
#[doc(inline)]
pub use self::hash_map::HashMap;
#[stable(feature = "rust1", since = "1.0.0")]
#[doc(inline)]
pub use self::hash_set::HashSet;
#[stable(feature = "rust1", since = "1.0.0")]
// FIXME(#82080) The deprecation here is only theoretical, and does not actually produce a warning.
#[deprecated(note = "moved to `std::ops::Bound`", since = "1.26.0")]
#[doc(hidden)]
pub use crate::ops::Bound;

mod hash;

#[stable(feature = "rust1", since = "1.0.0")]
pub mod hash_map {
    //! A hash map implemented with quadratic probing and SIMD lookup.
    #[stable(feature = "rust1", since = "1.0.0")]
    pub use super::hash::map::*;
    #[stable(feature = "hashmap_build_hasher", since = "1.7.0")]
    pub use crate::hash::random::DefaultHasher;
    #[stable(feature = "hashmap_build_hasher", since = "1.7.0")]
    pub use crate::hash::random::RandomState;
}

#[stable(feature = "rust1", since = "1.0.0")]
pub mod hash_set {
    //! A hash set implemented as a `HashMap` where the value is `()`.
    #[stable(feature = "rust1", since = "1.0.0")]
    pub use super::hash::set::*;
}
