#[cfg(test)]
mod tests;

use hashbrown::hash_set as base;

use super::map::map_try_reserve_error;
use crate::alloc::{Allocator, Global};
use crate::borrow::Borrow;
use crate::collections::TryReserveError;
use crate::fmt;
use crate::hash::{BuildHasher, Hash, RandomState};
use crate::iter::{Chain, FusedIterator};
use crate::ops::{BitAnd, BitOr, BitXor, Sub};

/// A [hash set] implemented as a `HashMap` where the value is `()`.
///
/// As with the [`HashMap`] type, a `HashSet` requires that the elements
/// implement the [`Eq`] and [`Hash`] traits. This can frequently be achieved by
/// using `#[derive(PartialEq, Eq, Hash)]`. If you implement these yourself,
/// 重要的是要满足以下属性：
///
/// ```text
/// k1 == k2 -> hash(k1) == hash(k2)
/// ```
///
/// 换句话说，如果两个键相等，它们的哈希值也必须相等。
/// 违反此属性会导致逻辑错误。
///
/// It is also a logic error for a key to be modified in such a way that the key's
/// hash, as determined by the [`Hash`] trait, or its equality, as determined by
/// the [`Eq`] trait, changes while it is in the map. This is normally only
/// possible through [`Cell`], [`RefCell`], global state, I/O, or unsafe code.
///
/// The behavior resulting from either logic error is not specified, but will
/// be encapsulated to the `HashSet` that observed the logic error and not
/// # 示例
/// aborts, memory leaks, and non-termination.
///
/// # Examples
///
/// ```
/// use std::collections::HashSet;
/// // Type inference lets us omit an explicit type signature (which
/// // would be `HashSet<String>` in this example).
/// let mut books = HashSet::new();
///
/// // Add some books.
/// books.insert("A Dance With Dragons".to_string());
/// books.insert("To Kill a Mockingbird".to_string());
/// books.insert("The Odyssey".to_string());
/// books.insert("The Great Gatsby".to_string());
///
/// // Check for a specific one.
/// if !books.contains("The Winds of Winter") {
///     println!("We have {} books, but The Winds of Winter ain't one.",
///              books.len());
/// }
///
/// // Remove a book.
/// books.remove("The Odyssey");
///
/// // Iterate over everything.
/// for book in &books {
///     println!("{book}");
/// }
/// ```
///
/// The easiest way to use `HashSet` with a custom type is to derive
/// [`Eq`] and [`Hash`]. We must also derive [`PartialEq`],
/// which is required if [`Eq`] is derived.
///
/// ```
/// use std::collections::HashSet;
/// #[derive(Hash, Eq, PartialEq, Debug)]
/// struct Viking {
///     name: String,
///     power: usize,
/// }
///
/// let mut vikings = HashSet::new();
///
/// vikings.insert(Viking { name: "Einar".to_string(), power: 9 });
/// vikings.insert(Viking { name: "Einar".to_string(), power: 9 });
/// vikings.insert(Viking { name: "Olaf".to_string(), power: 4 });
/// vikings.insert(Viking { name: "Harald".to_string(), power: 8 });
///
/// // Use derived implementation to print the vikings.
/// for x in &vikings {
///     println!("{x:?}");
/// }
/// ```
///
/// A `HashSet` with a known list of items can be initialized from an array:
///
/// ```
/// use std::collections::HashSet;
///
/// let viking_names = HashSet::from(["Einar", "Olaf", "Harald"]);
/// ```
///
/// [hash set]: crate::collections#use-the-set-variant-of-any-of-these-maps-when
/// [`HashMap`]: crate::collections::HashMap
/// [`RefCell`]: crate::cell::RefCell
/// [`Cell`]: crate::cell::Cell
///
/// # Usage in `const` and `static`
///
/// Like `HashMap`, `HashSet` is randomly seeded: each `HashSet` instance uses a different seed,
/// which means that `HashSet::new` cannot be used in const context. To construct a `HashSet` in the
/// initializer of a `const` or `static` item, you will have to use a different hasher that does not
/// involve a random seed, as demonstrated in the following example. **A `HashSet` constructed this
/// 哈希集最初以容量为 0 创建，因此直到被插入之前不会分配内存。
///
/// ```rust
/// use std::collections::HashSet;
/// use std::hash::{BuildHasherDefault, DefaultHasher};
/// use std::sync::Mutex;
///
/// const EMPTY_SET: HashSet<String, BuildHasherDefault<DefaultHasher>> =
///     HashSet::with_hasher(BuildHasherDefault::new());
/// static SET: Mutex<HashSet<String, BuildHasherDefault<DefaultHasher>>> =
///     Mutex::new(HashSet::with_hasher(BuildHasherDefault::new()));
/// ```
#[cfg_attr(not(test), rustc_diagnostic_item = "HashSet")]
#[stable(feature = "rust1", since = "1.0.0")]
pub struct HashSet<
    T,
    S = RandomState,
    #[unstable(feature = "allocator_ext", issue = "163177", implied_by = "allocator_api")] A: Allocator = Global,
> {
    base: base::HashSet<T, S, A>,
}

impl<T> HashSet<T, RandomState> {
    /// Creates an empty `HashSet`.
    ///
    /// The hash set is initially created with a capacity of 0, so it will not allocate until it
    /// is first inserted into.
    ///
    /// # Examples
    ///
    /// ```
    /// use std::collections::HashSet;
    /// let set: HashSet<i32> = HashSet::new();
    /// ```
    #[inline]
    #[must_use]
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn new() -> HashSet<T, RandomState> {
        Default::default()
    }

    /// Creates an empty `HashSet` with at least the specified capacity.
    ///
    /// The hash set will be able to hold at least `capacity` elements without
    /// 哈希集最初以容量为 0 创建，因此直到被插入之前不会分配内存。
    /// `capacity`. If `capacity` is zero, the hash set will not allocate.
    ///
    /// # Examples
    ///
    /// ```
    /// use std::collections::HashSet;
    /// let set: HashSet<i32> = HashSet::with_capacity(10);
    /// assert!(set.capacity() >= 10);
    /// ```
    #[inline]
    #[must_use]
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn with_capacity(capacity: usize) -> HashSet<T, RandomState> {
        HashSet::with_capacity_and_hasher(capacity, Default::default())
    }
}

impl<T, A: Allocator> HashSet<T, RandomState, A> {
    /// Creates an empty `HashSet` in the provided allocator.
    ///
    /// The hash set is initially created with a capacity of 0, so it will not allocate until it
    /// 首先被插入到。
    /// # 示例
    ///
    /// ```
    /// # #![feature(allocator_ext)]
    /// use std::alloc::Global;
    /// use std::collections::HashSet;
    ///
    /// let set: HashSet<i32> = HashSet::new_in(Global);
    /// ```
    #[inline]
    #[must_use]
    #[unstable(feature = "allocator_ext", issue = "163177", implied_by = "allocator_api")]
    pub fn new_in(alloc: A) -> HashSet<T, RandomState, A> {
        HashSet::with_hasher_in(Default::default(), alloc)
    }

    /// Creates an empty `HashSet` with at least the specified capacity.
    ///
    /// The hash set will be able to hold at least `capacity` elements without
    /// 重新分配内存。此方法可以分配更多元素的内存空间。
    /// `capacity`. If `capacity` is zero, the hash set will not allocate.
    ///
    /// # 示例
    ///
    /// ```
    /// # #![feature(allocator_ext)]
    /// use std::collections::HashSet;
    /// use std::alloc::Global;
    ///
    /// let set: HashSet<i32> = HashSet::with_capacity_in(10, Global);
    /// ```
    #[inline]
    #[must_use]
    #[unstable(feature = "allocator_ext", issue = "163177", implied_by = "allocator_api")]
    pub fn with_capacity_in(capacity: usize, alloc: A) -> HashSet<T, RandomState, A> {
        HashSet::with_capacity_and_hasher_in(capacity, Default::default(), alloc)
    }
}

impl<T, S> HashSet<T, S> {
    /// 创建一个新的空哈希集合，它将使用给定的哈希器对键进行哈希处理。
    /// keys.
    ///
    /// 哈希集合也以默认初始容量创建。
    ///
    /// Warning: `hasher` is normally randomly generated, and
    /// is designed to allow `HashSet`s to be resistant to attacks that
    /// 可能会暴露DoS攻击的漏洞。
    /// manually using this function can expose a DoS attack vector.
    ///
    /// The `hash_builder` passed should implement the [`BuildHasher`] trait for
    /// the `HashSet` to be useful, see its documentation for details.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::HashSet;
    /// use std::hash::RandomState;
    ///
    /// let s = RandomState::new();
    /// let mut set = HashSet::with_hasher(s);
    /// set.insert(2);
    /// ```
    #[inline]
    #[must_use]
    #[stable(feature = "hashmap_build_hasher", since = "1.7.0")]
    #[rustc_const_stable(feature = "const_collections_with_hasher", since = "1.85.0")]
    pub const fn with_hasher(hasher: S) -> HashSet<T, S> {
        HashSet { base: base::HashSet::with_hasher(hasher) }
    }

    /// Creates an empty `HashSet` with at least the specified capacity, using
    /// `hasher` to hash the keys.
    ///
    /// The hash set will be able to hold at least `capacity` elements without
    /// 重新分配内存。此方法可以分配更多元素的内存空间。
    /// `capacity`. If `capacity` is zero, the hash set will not allocate.
    ///
    /// Warning: `hasher` is normally randomly generated, and
    /// is designed to allow `HashSet`s to be resistant to attacks that
    /// 可能会暴露DoS攻击的漏洞。
    /// manually using this function can expose a DoS attack vector.
    ///
    /// The `hash_builder` passed should implement the [`BuildHasher`] trait for
    /// the `HashSet` to be useful, see its documentation for details.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::HashSet;
    /// use std::hash::RandomState;
    ///
    /// let s = RandomState::new();
    /// let mut set = HashSet::with_capacity_and_hasher(10, s);
    /// set.insert(1);
    /// ```
    #[inline]
    #[must_use]
    #[stable(feature = "hashmap_build_hasher", since = "1.7.0")]
    pub fn with_capacity_and_hasher(capacity: usize, hasher: S) -> HashSet<T, S> {
        HashSet { base: base::HashSet::with_capacity_and_hasher(capacity, hasher) }
    }
}

impl<T, S, A: Allocator> HashSet<T, S, A> {
    /// 创建一个新的空哈希集合，它将使用给定的哈希器对键进行哈希处理。
    /// keys and will allocate memory using the provided allocator.
    ///
    /// 哈希集合也以默认初始容量创建。
    ///
    /// Warning: `hasher` is normally randomly generated, and
    /// is designed to allow `HashSet`s to be resistant to attacks that
    /// 可能会暴露DoS攻击的漏洞。
    /// 手动使用此函数设置它
    ///
    /// The `hash_builder` passed should implement the [`BuildHasher`] trait for
    /// the `HashSet` to be useful, see its documentation for details.
    ///
    /// # 示例
    ///
    /// ```
    /// # #![feature(allocator_ext)]
    /// use std::alloc::Global;
    /// use std::collections::HashSet;
    /// use std::hash::RandomState;
    ///
    /// let s = RandomState::new();
    /// let set: HashSet<i32> = HashSet::with_hasher_in(s, Global);
    /// ```
    #[inline]
    #[must_use]
    #[unstable(feature = "allocator_ext", issue = "163177", implied_by = "allocator_api")]
    pub fn with_hasher_in(hasher: S, alloc: A) -> HashSet<T, S, A> {
        HashSet { base: base::HashSet::with_hasher_in(hasher, alloc) }
    }

    /// Creates an empty `HashSet` with at least the specified capacity, using
    /// `hasher` to hash the keys and `alloc` to allocate memory.
    ///
    /// The hash set will be able to hold at least `capacity` elements without
    /// 重新分配。此方法允许为超过当前容量的元素分配内存。
    /// `capacity`. If `capacity` is zero, the hash set will not allocate.
    ///
    /// Warning: `hasher` is normally randomly generated, and
    /// is designed to allow `HashSet`s to be resistant to attacks that
    /// 导致大量冲突和性能极差的攻击。手动使用此函数设置它
    /// 可能会暴露DoS攻击途径。
    ///
    /// The `hash_builder` passed should implement the [`BuildHasher`] trait for
    /// the `HashSet` to be useful, see its documentation for details.
    ///
    /// # 示例
    ///
    /// ```
    /// # #![feature(allocator_ext)]
    /// use std::alloc::Global;
    /// use std::collections::HashSet;
    /// use std::hash::RandomState;
    ///
    /// let s = RandomState::new();
    /// let set: HashSet<i32> = HashSet::with_capacity_and_hasher_in(10, s, Global);
    /// ```
    #[inline]
    #[must_use]
    #[unstable(feature = "allocator_ext", issue = "163177", implied_by = "allocator_api")]
    pub fn with_capacity_and_hasher_in(capacity: usize, hasher: S, alloc: A) -> HashSet<T, S, A> {
        HashSet { base: base::HashSet::with_capacity_and_hasher_in(capacity, hasher, alloc) }
    }

    /// 返回集合在不重新分配的情况下能容纳的元素数量。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::HashSet;
    /// let set: HashSet<i32> = HashSet::with_capacity(100);
    /// assert!(set.capacity() >= 100);
    /// ```
    #[inline]
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn capacity(&self) -> usize {
        self.base.capacity()
    }

    /// 一个以任意顺序访问所有元素的迭代器。
    /// The iterator element type is `&'a T`.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::HashSet;
    /// let mut set = HashSet::new();
    /// set.insert("a");
    /// set.insert("b");
    ///
    /// // Will print in an arbitrary order.
    /// for x in set.iter() {
    ///     println!("{x}");
    /// }
    /// ```
    ///
    /// # 性能
    ///
    /// 在当前实现中，遍历集合的时间复杂度为 O(capacity)，
    /// 而不是 O(len)，因为内部也会访问空桶。
    #[inline]
    #[rustc_lint_query_instability]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[cfg_attr(not(test), rustc_diagnostic_item = "hashset_iter")]
    pub fn iter(&self) -> Iter<'_, T> {
        Iter { base: self.base.iter() }
    }

    /// 返回集合中的元素数量。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::HashSet;
    ///
    /// let mut v = HashSet::new();
    /// assert_eq!(v.len(), 0);
    /// v.insert(1);
    /// assert_eq!(v.len(), 1);
    /// ```
    #[inline]
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn len(&self) -> usize {
        self.base.len()
    }

    /// Returns `true` if the set contains no elements.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::HashSet;
    ///
    /// let mut v = HashSet::new();
    /// assert!(v.is_empty());
    /// v.insert(1);
    /// assert!(!v.is_empty());
    /// ```
    #[inline]
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn is_empty(&self) -> bool {
        self.base.is_empty()
    }

    /// 清空集合，以迭代器形式返回所有元素。保留
    /// 已分配的内存以便重复使用。
    ///
    /// 如果返回的迭代器在完全消耗前被丢弃，它
    /// 会丢弃剩余的元素。返回的迭代器保持对集合的可变
    /// 借用以优化其实现。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::HashSet;
    ///
    /// let mut set = HashSet::from([1, 2, 3]);
    /// assert!(!set.is_empty());
    ///
    /// // print 1, 2, 3 in an arbitrary order
    /// for i in set.drain() {
    ///     println!("{i}");
    /// }
    ///
    /// assert!(set.is_empty());
    /// ```
    #[inline]
    #[rustc_lint_query_instability]
    #[stable(feature = "drain", since = "1.6.0")]
    pub fn drain(&mut self) -> Drain<'_, T, A> {
        Drain { base: self.base.drain() }
    }

    /// 创建一个使用闭包确定是否应移除元素的迭代器。
    ///
    /// If the closure returns `true`, the element is removed from the set and
    /// yielded. If the closure returns `false`, or panics, the element remains
    /// 并将不会被yield。
    ///
    /// If the returned `ExtractIf` is not exhausted, e.g. because it is dropped without iterating
    /// 或迭代过程短路，则剩余元素将被保留。
    /// Use [`retain`] with a negated predicate if you do not need the returned iterator.
    ///
    /// [`retain`]: HashSet::retain
    ///
    /// # 示例
    ///
    /// 将集合拆分为偶数和奇数值，并重复使用原始集合：
    ///
    /// ```
    /// use std::collections::HashSet;
    ///
    /// let mut set: HashSet<i32> = (0..8).collect();
    /// let extracted: HashSet<i32> = set.extract_if(|v| v % 2 == 0).collect();
    ///
    /// let mut evens = extracted.into_iter().collect::<Vec<_>>();
    /// let mut odds = set.into_iter().collect::<Vec<_>>();
    /// evens.sort();
    /// odds.sort();
    ///
    /// assert_eq!(evens, vec![0, 2, 4, 6]);
    /// assert_eq!(odds, vec![1, 3, 5, 7]);
    /// ```
    #[inline]
    #[rustc_lint_query_instability]
    #[stable(feature = "hash_extract_if", since = "1.88.0")]
    pub fn extract_if<F>(&mut self, pred: F) -> ExtractIf<'_, T, F, A>
    where
        F: FnMut(&T) -> bool,
    {
        ExtractIf { base: self.base.extract_if(pred) }
    }

    /// 仅保留由谓词指定的元素。
    ///
    /// In other words, remove all elements `e` for which `f(&e)` returns `false`.
    /// 元素以未排序（且未指定）的顺序被访问。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::HashSet;
    ///
    /// let mut set = HashSet::from([1, 2, 3, 4, 5, 6]);
    /// set.retain(|&k| k % 2 == 0);
    /// assert_eq!(set, HashSet::from([2, 4, 6]));
    /// ```
    ///
    /// # 性能
    ///
    /// 在当前实现中，此操作的时间复杂度为 O(capacity)，
    /// 而不是 O(len)，因为内部也会访问空桶。
    #[rustc_lint_query_instability]
    #[stable(feature = "retain_hash_collection", since = "1.18.0")]
    pub fn retain<F>(&mut self, f: F)
    where
        F: FnMut(&T) -> bool,
    {
        self.base.retain(f)
    }

    /// 清空集合，移除所有值。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::HashSet;
    ///
    /// let mut v = HashSet::new();
    /// v.insert(1);
    /// v.clear();
    /// assert!(v.is_empty());
    /// ```
    #[inline]
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn clear(&mut self) {
        self.base.clear()
    }

    /// Returns a reference to the set's [`BuildHasher`].
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::HashSet;
    /// use std::hash::RandomState;
    ///
    /// let hasher = RandomState::new();
    /// let set: HashSet<i32> = HashSet::with_hasher(hasher);
    /// let hasher: &RandomState = set.hasher();
    /// ```
    #[inline]
    #[stable(feature = "hashmap_public_hasher", since = "1.9.0")]
    pub fn hasher(&self) -> &S {
        self.base.hasher()
    }
}

impl<T, S, A> HashSet<T, S, A>
where
    T: Eq + Hash,
    S: BuildHasher,
    A: Allocator,
{
    /// Reserves capacity for at least `additional` more elements to be inserted
    /// in the `HashSet`. The collection may reserve more space to speculatively
    /// avoid frequent reallocations. After calling `reserve`,
    /// capacity will be greater than or equal to `self.len() + additional`.
    /// 如果容量已经足够，则不做任何操作。
    ///
    /// # 恐慌
    ///
    /// Panics if the new allocation size overflows `usize`.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::HashSet;
    /// let mut set: HashSet<i32> = HashSet::new();
    /// set.reserve(10);
    /// assert!(set.capacity() >= 10);
    /// ```
    #[inline]
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn reserve(&mut self, additional: usize) {
        self.base.reserve(additional)
    }

    /// Tries to reserve capacity for at least `additional` more elements to be inserted
    /// in the `HashSet`. The collection may reserve more space to speculatively
    /// avoid frequent reallocations. After calling `try_reserve`,
    /// capacity will be greater than or equal to `self.len() + additional` if
    /// it returns `Ok(())`.
    /// 如果容量已经足够，则不做任何操作。
    ///
    /// # 错误
    ///
    /// 如果容量溢出或分配器报告失败，则返回错误。
    /// # 示例
    ///
    /// # 尽可能缩小集合的容量。它将尽可能减少容量，同时遵循内部规则
    ///
    /// ```
    /// use std::collections::HashSet;
    /// let mut set: HashSet<i32> = HashSet::new();
    /// set.try_reserve(10).expect("why is the test harness OOMing on a handful of bytes?");
    /// ```
    #[inline]
    #[stable(feature = "try_reserve", since = "1.57.0")]
    pub fn try_reserve(&mut self, additional: usize) -> Result<(), TryReserveError> {
        self.base.try_reserve(additional).map_err(map_try_reserve_error)
    }

    /// 并可能根据调整策略留下一些空间。
    /// # 示例
    /// 以较低限制缩小集合的容量。它将至少减少至提供的限制值，同时遵循内部规则
    ///
    /// # 并可能根据调整策略留下一些空间。
    ///
    /// ```
    /// use std::collections::HashSet;
    ///
    /// let mut set = HashSet::with_capacity(100);
    /// set.insert(1);
    /// set.insert(2);
    /// assert!(set.capacity() >= 100);
    /// set.shrink_to_fit();
    /// assert!(set.capacity() >= 2);
    /// ```
    #[inline]
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn shrink_to_fit(&mut self) {
        self.base.shrink_to_fit()
    }

    /// 以更低限制缩小集合的容量。它将至少减少至该限制值，同时遵循内部规则
    /// 并可能根据调整策略留下一些空间。
    /// 如果当前容量低于较低限制，则无需操作。
    ///
    /// # 示例
    /// # 访问表示差异的值，
    ///
    /// ```
    /// use std::collections::HashSet;
    ///
    /// let mut set = HashSet::with_capacity(100);
    /// set.insert(1);
    /// set.insert(2);
    /// assert!(set.capacity() >= 100);
    /// set.shrink_to(10);
    /// assert!(set.capacity() >= 10);
    /// set.shrink_to(0);
    /// assert!(set.capacity() >= 2);
    /// ```
    #[inline]
    #[stable(feature = "shrink_to", since = "1.56.0")]
    pub fn shrink_to(&mut self, min_capacity: usize) {
        self.base.shrink_to(min_capacity)
    }

    /// Visits the values representing the difference,
    /// i.e., the values that are in `self` but not in `other`.
    ///
    /// # 访问表示对称差异的值，
    ///
    /// ```
    /// use std::collections::HashSet;
    /// let a = HashSet::from([1, 2, 3]);
    /// let b = HashSet::from([4, 2, 3, 4]);
    ///
    /// // Can be seen as `a - b`.
    /// for x in a.difference(&b) {
    ///     println!("{x}"); // Print 1
    /// }
    ///
    /// let diff: HashSet<_> = a.difference(&b).collect();
    /// assert_eq!(diff, [1].iter().collect());
    ///
    /// // Note that difference is not symmetric,
    /// // and `b - a` means something else:
    /// let diff: HashSet<_> = b.difference(&a).collect();
    /// assert_eq!(diff, [4].iter().collect());
    /// ```
    #[inline]
    #[rustc_lint_query_instability]
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn difference<'a>(&'a self, other: &'a HashSet<T, S, A>) -> Difference<'a, T, S, A> {
        Difference { iter: self.iter(), other }
    }

    /// Visits the values representing the symmetric difference,
    /// i.e., the values that are in `self` or in `other` but not in both.
    ///
    /// # 访问表示交集的值，
    ///
    /// ```
    /// use std::collections::HashSet;
    /// let a = HashSet::from([1, 2, 3]);
    /// let b = HashSet::from([4, 2, 3, 4]);
    ///
    /// // Print 1, 4 in arbitrary order.
    /// for x in a.symmetric_difference(&b) {
    ///     println!("{x}");
    /// }
    ///
    /// let diff1: HashSet<_> = a.symmetric_difference(&b).collect();
    /// let diff2: HashSet<_> = b.symmetric_difference(&a).collect();
    ///
    /// assert_eq!(diff1, diff2);
    /// assert_eq!(diff1, [1, 4].iter().collect());
    /// ```
    #[inline]
    #[rustc_lint_query_instability]
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn symmetric_difference<'a>(
        &'a self,
        other: &'a HashSet<T, S, A>,
    ) -> SymmetricDifference<'a, T, S, A> {
        SymmetricDifference { iter: self.difference(other).chain(other.difference(self)) }
    }

    /// Visits the values representing the intersection,
    /// i.e., the values that are both in `self` and `other`.
    ///
    /// When an equal element is present in `self` and `other`
    /// then the resulting `Intersection` may yield references to
    /// one or the other. This can be relevant if `T` contains fields which
    /// are not compared by its `Eq` implementation, and may hold different
    /// value between the two equal copies of `T` in the two sets.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::HashSet;
    /// let a = HashSet::from([1, 2, 3]);
    /// let b = HashSet::from([4, 2, 3, 4]);
    ///
    /// // Print 2, 3 in arbitrary order.
    /// for x in a.intersection(&b) {
    ///     println!("{x}");
    /// }
    ///
    /// let intersection: HashSet<_> = a.intersection(&b).collect();
    /// assert_eq!(intersection, [2, 3].iter().collect());
    /// ```
    #[inline]
    #[rustc_lint_query_instability]
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn intersection<'a>(&'a self, other: &'a HashSet<T, S, A>) -> Intersection<'a, T, S, A> {
        if self.len() <= other.len() {
            Intersection { iter: self.iter(), other }
        } else {
            Intersection { iter: other.iter(), other: self }
        }
    }

    /// 访问表示并集的值，
    /// i.e., all the values in `self` or `other`, without duplicates.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::HashSet;
    /// let a = HashSet::from([1, 2, 3]);
    /// let b = HashSet::from([4, 2, 3, 4]);
    ///
    /// // Print 1, 2, 3, 4 in arbitrary order.
    /// for x in a.union(&b) {
    ///     println!("{x}");
    /// }
    ///
    /// let union: HashSet<_> = a.union(&b).collect();
    /// assert_eq!(union, [1, 2, 3, 4].iter().collect());
    /// ```
    #[inline]
    #[rustc_lint_query_instability]
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn union<'a>(&'a self, other: &'a HashSet<T, S, A>) -> Union<'a, T, S, A> {
        if self.len() >= other.len() {
            Union { iter: self.iter().chain(other.difference(self)) }
        } else {
            Union { iter: other.iter().chain(self.difference(other)) }
        }
    }

    /// Returns `true` if the set contains a value.
    ///
    /// 该值可以是集合值类型的任何借用形式，但
    /// [`Hash`] and [`Eq`] on the borrowed form *must* match those for
    /// 值类型。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::HashSet;
    ///
    /// let set = HashSet::from([1, 2, 3]);
    /// assert_eq!(set.contains(&1), true);
    /// assert_eq!(set.contains(&4), false);
    /// ```
    #[inline]
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn contains<Q: ?Sized>(&self, value: &Q) -> bool
    where
        T: Borrow<Q>,
        Q: Hash + Eq,
    {
        self.base.contains(value)
    }

    /// 返回集合中等于给定值的元素的引用，如果存在的话。
    ///
    /// 该值可以是集合值类型的任何借用形式，但
    /// [`Hash`] and [`Eq`] on the borrowed form *must* match those for
    /// 值类型。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::HashSet;
    ///
    /// let set = HashSet::from([1, 2, 3]);
    /// assert_eq!(set.get(&2), Some(&2));
    /// assert_eq!(set.get(&4), None);
    /// ```
    #[inline]
    #[stable(feature = "set_recovery", since = "1.9.0")]
    pub fn get<Q: ?Sized>(&self, value: &Q) -> Option<&T>
    where
        T: Borrow<Q>,
        Q: Hash + Eq,
    {
        self.base.get(value)
    }

    /// Inserts the given `value` into the set if it is not present, then
    /// 返回集合中该元素的引用。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(hash_set_entry)]
    ///
    /// use std::collections::HashSet;
    ///
    /// let mut set = HashSet::from([1, 2, 3]);
    /// assert_eq!(set.len(), 3);
    /// assert_eq!(set.get_or_insert(2), &2);
    /// assert_eq!(set.get_or_insert(100), &100);
    /// assert_eq!(set.len(), 4); // 100 was inserted
    /// ```
    #[inline]
    #[unstable(feature = "hash_set_entry", issue = "60896")]
    pub fn get_or_insert(&mut self, value: T) -> &T {
        // Although the raw entry gives us `&mut T`, we only return `&T` to be consistent with
        // `get`. Key mutation is "raw" because you're not supposed to affect `Eq` or `Hash`.
        self.base.get_or_insert(value)
    }

    /// Inserts a value computed from `f` into the set if the given `value` is
    /// # 示例
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(hash_set_entry)]
    ///
    /// use std::collections::HashSet;
    ///
    /// let mut set: HashSet<String> = ["cat", "dog", "horse"]
    ///     .iter().map(|&pet| pet.to_owned()).collect();
    ///
    /// assert_eq!(set.len(), 3);
    /// for &pet in &["cat", "dog", "fish"] {
    ///     let value = set.get_or_insert_with(pet, str::to_owned);
    ///     assert_eq!(value, pet);
    /// }
    /// assert_eq!(set.len(), 4); // a new "fish" was inserted
    /// ```
    #[inline]
    #[unstable(feature = "hash_set_entry", issue = "60896")]
    pub fn get_or_insert_with<Q: ?Sized, F>(&mut self, value: &Q, f: F) -> &T
    where
        T: Borrow<Q>,
        Q: Hash + Eq,
        F: FnOnce(&Q) -> T,
    {
        // Although the raw entry gives us `&mut T`, we only return `&T` to be consistent with
        // `get`. Key mutation is "raw" because you're not supposed to affect `Eq` or `Hash`.
        self.base.get_or_insert_with(value, f)
    }

    /// 获取集合中给定值的对应条目以便就地操作。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(hash_set_entry)]
    ///
    /// use std::collections::HashSet;
    /// use std::collections::hash_set::Entry::*;
    ///
    /// let mut singles = HashSet::new();
    /// let mut dupes = HashSet::new();
    ///
    /// for ch in "a short treatise on fungi".chars() {
    ///     if let Vacant(dupe_entry) = dupes.entry(ch) {
    ///         // We haven't already seen a duplicate, so
    ///         // check if we've at least seen it once.
    ///         match singles.entry(ch) {
    ///             Vacant(single_entry) => {
    ///                 // We found a new character for the first time.
    ///                 single_entry.insert()
    ///             }
    ///             Occupied(single_entry) => {
    ///                 // We've already seen this once, "move" it to dupes.
    ///                 single_entry.remove();
    ///                 dupe_entry.insert();
    ///             }
    ///         }
    ///     }
    /// }
    ///
    /// assert!(!singles.contains(&'t') && dupes.contains(&'t'));
    /// assert!(singles.contains(&'u') && !dupes.contains(&'u'));
    /// assert!(!singles.contains(&'v') && !dupes.contains(&'v'));
    /// ```
    #[inline]
    #[unstable(feature = "hash_set_entry", issue = "60896")]
    pub fn entry(&mut self, value: T) -> Entry<'_, T, S, A> {
        map_entry(self.base.entry(value))
    }

    /// Returns `true` if `self` has no elements in common with `other`.
    /// 这相当于检查是否存在空交集。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::HashSet;
    ///
    /// let a = HashSet::from([1, 2, 3]);
    /// let mut b = HashSet::new();
    ///
    /// assert_eq!(a.is_disjoint(&b), true);
    /// b.insert(4);
    /// assert_eq!(a.is_disjoint(&b), true);
    /// b.insert(1);
    /// assert_eq!(a.is_disjoint(&b), false);
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn is_disjoint(&self, other: &HashSet<T, S, A>) -> bool {
        if self.len() <= other.len() {
            self.iter().all(|v| !other.contains(v))
        } else {
            other.iter().all(|v| !self.contains(v))
        }
    }

    /// Returns `true` if the set is a subset of another,
    /// i.e., `other` contains at least all the values in `self`.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::HashSet;
    ///
    /// let sup = HashSet::from([1, 2, 3]);
    /// let mut set = HashSet::new();
    ///
    /// assert_eq!(set.is_subset(&sup), true);
    /// set.insert(2);
    /// assert_eq!(set.is_subset(&sup), true);
    /// set.insert(4);
    /// assert_eq!(set.is_subset(&sup), false);
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn is_subset(&self, other: &HashSet<T, S, A>) -> bool {
        if self.len() <= other.len() { self.iter().all(|v| other.contains(v)) } else { false }
    }

    /// Returns `true` if the set is a superset of another,
    /// i.e., `self` contains at least all the values in `other`.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::HashSet;
    ///
    /// let sub = HashSet::from([1, 2]);
    /// let mut set = HashSet::new();
    ///
    /// assert_eq!(set.is_superset(&sub), false);
    ///
    /// set.insert(0);
    /// set.insert(1);
    /// assert_eq!(set.is_superset(&sub), false);
    ///
    /// set.insert(2);
    /// assert_eq!(set.is_superset(&sub), true);
    /// ```
    #[inline]
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn is_superset(&self, other: &HashSet<T, S, A>) -> bool {
        other.is_subset(self)
    }

    /// 向集合中添加值。
    ///
    /// 返回该值是否被新插入。具体为：
    ///
    /// - If the set did not previously contain this value, `true` is returned.
    /// - If the set already contained this value, `false` is returned,
    /// 并且集合未被修改：原始值未被替换，
    /// 并传递的参数值被丢弃。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::HashSet;
    ///
    /// let mut set = HashSet::new();
    ///
    /// assert_eq!(set.insert(2), true);
    /// assert_eq!(set.insert(2), false);
    /// assert_eq!(set.len(), 1);
    /// ```
    #[inline]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_confusables("push", "append", "put")]
    pub fn insert(&mut self, value: T) -> bool {
        self.base.insert(value)
    }

    /// 向集合中添加值，替换存在的等于给定值的元素。
    /// 如果存在一个，则返回被替换的值。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::HashSet;
    ///
    /// let mut set = HashSet::new();
    /// set.insert(Vec::<i32>::new());
    ///
    /// assert_eq!(set.get(&[][..]).unwrap().capacity(), 0);
    /// set.replace(Vec::with_capacity(10));
    /// assert_eq!(set.get(&[][..]).unwrap().capacity(), 10);
    /// ```
    #[inline]
    #[stable(feature = "set_recovery", since = "1.9.0")]
    #[rustc_confusables("swap")]
    pub fn replace(&mut self, value: T) -> Option<T> {
        self.base.replace(value)
    }

    /// 从集合中移除值。返回该值是否
    /// 存在于集合中。
    ///
    /// 该值可以是集合值类型的任何借用形式，但
    /// [`Hash`] and [`Eq`] on the borrowed form *must* match those for
    /// 值类型。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::HashSet;
    ///
    /// let mut set = HashSet::new();
    ///
    /// set.insert(2);
    /// assert_eq!(set.remove(&2), true);
    /// assert_eq!(set.remove(&2), false);
    /// ```
    #[inline]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_confusables("delete", "take")]
    pub fn remove<Q: ?Sized>(&mut self, value: &Q) -> bool
    where
        T: Borrow<Q>,
        Q: Hash + Eq,
    {
        self.base.remove(value)
    }

    /// 移除并返回集合中等于给定值的元素，如果存在的话。
    ///
    /// 该值可以是集合值类型的任何借用形式，但
    /// [`Hash`] and [`Eq`] on the borrowed form *must* match those for
    /// 值类型。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::HashSet;
    ///
    /// let mut set = HashSet::from([1, 2, 3]);
    /// assert_eq!(set.take(&2), Some(2));
    /// assert_eq!(set.take(&2), None);
    /// ```
    #[inline]
    #[stable(feature = "set_recovery", since = "1.9.0")]
    pub fn take<Q: ?Sized>(&mut self, value: &Q) -> Option<T>
    where
        T: Borrow<Q>,
        Q: Hash + Eq,
    {
        self.base.take(value)
    }
}

#[inline]
fn map_entry<'a, K: 'a, V: 'a, A: Allocator>(raw: base::Entry<'a, K, V, A>) -> Entry<'a, K, V, A> {
    match raw {
        base::Entry::Occupied(base) => Entry::Occupied(OccupiedEntry { base }),
        base::Entry::Vacant(base) => Entry::Vacant(VacantEntry { base }),
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T, S, A> Clone for HashSet<T, S, A>
where
    T: Clone,
    S: Clone,
    A: Allocator + Clone,
{
    #[inline]
    fn clone(&self) -> Self {
        Self { base: self.base.clone() }
    }

    /// Overwrites the contents of `self` with a clone of the contents of `source`.
    ///
    /// This method is preferred over simply assigning `source.clone()` to `self`,
    /// 因为它在可能的情况下避免重新分配。
    #[inline]
    fn clone_from(&mut self, other: &Self) {
        self.base.clone_from(&other.base);
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T, S, A> PartialEq for HashSet<T, S, A>
where
    T: Eq + Hash,
    S: BuildHasher,
    A: Allocator,
{
    fn eq(&self, other: &HashSet<T, S, A>) -> bool {
        if self.len() != other.len() {
            return false;
        }

        self.iter().all(|key| other.contains(key))
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T, S, A> Eq for HashSet<T, S, A>
where
    T: Eq + Hash,
    S: BuildHasher,
    A: Allocator,
{
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T, S, A> fmt::Debug for HashSet<T, S, A>
where
    T: fmt::Debug,
    A: Allocator,
{
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_set().entries(self.iter()).finish()
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T, S> FromIterator<T> for HashSet<T, S>
where
    T: Eq + Hash,
    S: BuildHasher + Default,
{
    #[inline]
    fn from_iter<I: IntoIterator<Item = T>>(iter: I) -> HashSet<T, S> {
        let mut set = HashSet::with_hasher(Default::default());
        set.extend(iter);
        set
    }
}

#[stable(feature = "std_collections_from_array", since = "1.56.0")]
// Note: as what is currently the most convenient built-in way to construct
// a HashSet, a simple usage of this function must not *require* the user
// to provide a type annotation in order to infer the third type parameter
// (the hasher parameter, conventionally "S").
// To that end, this impl is defined using RandomState as the concrete
// type of S, rather than being generic over `S: BuildHasher + Default`.
// It is expected that users who want to specify a hasher will manually use
// `with_capacity_and_hasher`.
// If type parameter defaults worked on impls, and if type parameter
// defaults could be mixed with const generics, then perhaps
// this could be generalized.
// See also the equivalent impl on HashMap.
impl<T, const N: usize> From<[T; N]> for HashSet<T, RandomState>
where
    T: Eq + Hash,
{
    /// Converts a `[T; N]` into a `HashSet<T>`.
    ///
    /// 如果数组中包含任何相等的值，
    /// 除了一个之外，所有值都会被删除。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::HashSet;
    ///
    /// let set1 = HashSet::from([1, 2, 3, 4]);
    /// let set2: HashSet<_> = [1, 2, 3, 4].into();
    /// assert_eq!(set1, set2);
    /// ```
    fn from(arr: [T; N]) -> Self {
        Self::from_iter(arr)
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T, S, A> Extend<T> for HashSet<T, S, A>
where
    T: Eq + Hash,
    S: BuildHasher,
    A: Allocator,
{
    #[inline]
    fn extend<I: IntoIterator<Item = T>>(&mut self, iter: I) {
        self.base.extend(iter);
    }

    #[inline]
    fn extend_one(&mut self, item: T) {
        self.base.insert(item);
    }

    #[inline]
    fn extend_reserve(&mut self, additional: usize) {
        self.base.extend_reserve(additional);
    }
}

#[stable(feature = "hash_extend_copy", since = "1.4.0")]
impl<'a, T, S, A> Extend<&'a T> for HashSet<T, S, A>
where
    T: 'a + Eq + Hash + Copy,
    S: BuildHasher,
    A: Allocator,
{
    #[inline]
    fn extend<I: IntoIterator<Item = &'a T>>(&mut self, iter: I) {
        self.extend(iter.into_iter().cloned());
    }

    #[inline]
    fn extend_one(&mut self, &item: &'a T) {
        self.base.insert(item);
    }

    #[inline]
    fn extend_reserve(&mut self, additional: usize) {
        Extend::<T>::extend_reserve(self, additional)
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_const_unstable(feature = "const_default", issue = "143894")]
const impl<T, S> Default for HashSet<T, S>
where
    S: [const] Default,
{
    /// Creates an empty `HashSet<T, S>` with the `Default` value for the hasher.
    #[inline]
    fn default() -> HashSet<T, S> {
        HashSet { base: base::HashSet::with_hasher(Default::default()) }
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T, S> BitOr<&HashSet<T, S>> for &HashSet<T, S>
where
    T: Eq + Hash + Clone,
    S: BuildHasher + Default,
{
    type Output = HashSet<T, S>;

    /// Returns the union of `self` and `rhs` as a new `HashSet<T, S>`.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::HashSet;
    ///
    /// let a = HashSet::from([1, 2, 3]);
    /// let b = HashSet::from([3, 4, 5]);
    ///
    /// let set = &a | &b;
    ///
    /// let mut i = 0;
    /// let expected = [1, 2, 3, 4, 5];
    /// for x in &set {
    ///     assert!(expected.contains(x));
    ///     i += 1;
    /// }
    /// assert_eq!(i, expected.len());
    /// ```
    fn bitor(self, rhs: &HashSet<T, S>) -> HashSet<T, S> {
        self.union(rhs).cloned().collect()
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T, S> BitAnd<&HashSet<T, S>> for &HashSet<T, S>
where
    T: Eq + Hash + Clone,
    S: BuildHasher + Default,
{
    type Output = HashSet<T, S>;

    /// Returns the intersection of `self` and `rhs` as a new `HashSet<T, S>`.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::HashSet;
    ///
    /// let a = HashSet::from([1, 2, 3]);
    /// let b = HashSet::from([2, 3, 4]);
    ///
    /// let set = &a & &b;
    ///
    /// let mut i = 0;
    /// let expected = [2, 3];
    /// for x in &set {
    ///     assert!(expected.contains(x));
    ///     i += 1;
    /// }
    /// assert_eq!(i, expected.len());
    /// ```
    fn bitand(self, rhs: &HashSet<T, S>) -> HashSet<T, S> {
        self.intersection(rhs).cloned().collect()
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T, S> BitXor<&HashSet<T, S>> for &HashSet<T, S>
where
    T: Eq + Hash + Clone,
    S: BuildHasher + Default,
{
    type Output = HashSet<T, S>;

    /// Returns the symmetric difference of `self` and `rhs` as a new `HashSet<T, S>`.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::HashSet;
    ///
    /// let a = HashSet::from([1, 2, 3]);
    /// let b = HashSet::from([3, 4, 5]);
    ///
    /// let set = &a ^ &b;
    ///
    /// let mut i = 0;
    /// let expected = [1, 2, 4, 5];
    /// for x in &set {
    ///     assert!(expected.contains(x));
    ///     i += 1;
    /// }
    /// assert_eq!(i, expected.len());
    /// ```
    fn bitxor(self, rhs: &HashSet<T, S>) -> HashSet<T, S> {
        self.symmetric_difference(rhs).cloned().collect()
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T, S> Sub<&HashSet<T, S>> for &HashSet<T, S>
where
    T: Eq + Hash + Clone,
    S: BuildHasher + Default,
{
    type Output = HashSet<T, S>;

    /// Returns the difference of `self` and `rhs` as a new `HashSet<T, S>`.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::HashSet;
    ///
    /// let a = HashSet::from([1, 2, 3]);
    /// let b = HashSet::from([3, 4, 5]);
    ///
    /// let set = &a - &b;
    ///
    /// let mut i = 0;
    /// let expected = [1, 2];
    /// for x in &set {
    ///     assert!(expected.contains(x));
    ///     i += 1;
    /// }
    /// assert_eq!(i, expected.len());
    /// ```
    fn sub(self, rhs: &HashSet<T, S>) -> HashSet<T, S> {
        self.difference(rhs).cloned().collect()
    }
}

/// An iterator over the items of a `HashSet`.
///
/// This `struct` is created by the [`iter`] method on [`HashSet`].
/// 更多详情请参阅其文档。
///
/// [`iter`]: HashSet::iter
///
/// # 示例
///
/// ```
/// use std::collections::HashSet;
///
/// let a = HashSet::from([1, 2, 3]);
///
/// let mut iter = a.iter();
/// ```
#[stable(feature = "rust1", since = "1.0.0")]
#[cfg_attr(not(test), rustc_diagnostic_item = "hashset_iter_ty")]
pub struct Iter<'a, K: 'a> {
    base: base::Iter<'a, K>,
}

#[stable(feature = "default_iters_hash", since = "1.83.0")]
impl<K> Default for Iter<'_, K> {
    #[inline]
    fn default() -> Self {
        Iter { base: Default::default() }
    }
}

/// An owning iterator over the items of a `HashSet`.
///
/// This `struct` is created by the [`into_iter`] method on [`HashSet`]
/// (provided by the [`IntoIterator`] trait). See its documentation for more.
///
/// [`into_iter`]: IntoIterator::into_iter
///
/// # 示例
///
/// ```
/// use std::collections::HashSet;
///
/// let a = HashSet::from([1, 2, 3]);
///
/// let mut iter = a.into_iter();
/// ```
#[stable(feature = "rust1", since = "1.0.0")]
pub struct IntoIter<
    K,
    #[unstable(feature = "allocator_ext", issue = "163177", implied_by = "allocator_api")] A: Allocator = Global,
> {
    base: base::IntoIter<K, A>,
}

#[stable(feature = "default_iters_hash", since = "1.83.0")]
impl<K> Default for IntoIter<K> {
    #[inline]
    fn default() -> Self {
        IntoIter { base: Default::default() }
    }
}

/// A draining iterator over the items of a `HashSet`.
///
/// This `struct` is created by the [`drain`] method on [`HashSet`].
/// 更多详情请参阅其文档。
///
/// [`drain`]: HashSet::drain
///
/// # 示例
///
/// ```
/// use std::collections::HashSet;
///
/// let mut a = HashSet::from([1, 2, 3]);
///
/// let mut drain = a.drain();
/// ```
#[stable(feature = "rust1", since = "1.0.0")]
#[cfg_attr(not(test), rustc_diagnostic_item = "hashset_drain_ty")]
pub struct Drain<
    'a,
    K: 'a,
    #[unstable(feature = "allocator_ext", issue = "163177", implied_by = "allocator_api")] A: Allocator = Global,
> {
    base: base::Drain<'a, K, A>,
}

/// A draining, filtering iterator over the items of a `HashSet`.
///
/// This `struct` is created by the [`extract_if`] method on [`HashSet`].
///
/// [`extract_if`]: HashSet::extract_if
///
/// # 示例
///
/// ```
/// use std::collections::HashSet;
///
/// let mut a = HashSet::from([1, 2, 3]);
///
/// let mut extract_ifed = a.extract_if(|v| v % 2 == 0);
/// ```
#[stable(feature = "hash_extract_if", since = "1.88.0")]
#[must_use = "iterators are lazy and do nothing unless consumed; \
    use `retain` to remove and discard elements"]
pub struct ExtractIf<
    'a,
    K,
    F,
    #[unstable(feature = "allocator_ext", issue = "163177", implied_by = "allocator_api")] A: Allocator = Global,
> {
    base: base::ExtractIf<'a, K, F, A>,
}

/// A lazy iterator producing elements in the intersection of `HashSet`s.
///
/// This `struct` is created by the [`intersection`] method on [`HashSet`].
/// 更多详情请参阅其文档。
///
/// [`intersection`]: HashSet::intersection
///
/// # 示例
///
/// ```
/// use std::collections::HashSet;
///
/// let a = HashSet::from([1, 2, 3]);
/// let b = HashSet::from([4, 2, 3, 4]);
///
/// let mut intersection = a.intersection(&b);
/// ```
#[must_use = "this returns the intersection as an iterator, \
              without modifying either input set"]
#[stable(feature = "rust1", since = "1.0.0")]
pub struct Intersection<
    'a,
    T: 'a,
    S: 'a,
    #[unstable(feature = "allocator_ext", issue = "163177", implied_by = "allocator_api")] A: Allocator = Global,
> {
    // iterator of the first set
    iter: Iter<'a, T>,
    // the second set
    other: &'a HashSet<T, S, A>,
}

/// A lazy iterator producing elements in the difference of `HashSet`s.
///
/// This `struct` is created by the [`difference`] method on [`HashSet`].
/// 更多详情请参阅其文档。
///
/// [`difference`]: HashSet::difference
///
/// # 示例
///
/// ```
/// use std::collections::HashSet;
///
/// let a = HashSet::from([1, 2, 3]);
/// let b = HashSet::from([4, 2, 3, 4]);
///
/// let mut difference = a.difference(&b);
/// ```
#[must_use = "this returns the difference as an iterator, \
              without modifying either input set"]
#[stable(feature = "rust1", since = "1.0.0")]
pub struct Difference<
    'a,
    T: 'a,
    S: 'a,
    #[unstable(feature = "allocator_ext", issue = "163177", implied_by = "allocator_api")] A: Allocator = Global,
> {
    // iterator of the first set
    iter: Iter<'a, T>,
    // the second set
    other: &'a HashSet<T, S, A>,
}

/// A lazy iterator producing elements in the symmetric difference of `HashSet`s.
///
/// This `struct` is created by the [`symmetric_difference`] method on
/// [`HashSet`]. See its documentation for more.
///
/// [`symmetric_difference`]: HashSet::symmetric_difference
///
/// # 示例
///
/// ```
/// use std::collections::HashSet;
///
/// let a = HashSet::from([1, 2, 3]);
/// let b = HashSet::from([4, 2, 3, 4]);
///
/// let mut intersection = a.symmetric_difference(&b);
/// ```
#[must_use = "this returns the difference as an iterator, \
              without modifying either input set"]
#[stable(feature = "rust1", since = "1.0.0")]
pub struct SymmetricDifference<
    'a,
    T: 'a,
    S: 'a,
    #[unstable(feature = "allocator_ext", issue = "163177", implied_by = "allocator_api")] A: Allocator = Global,
> {
    iter: Chain<Difference<'a, T, S, A>, Difference<'a, T, S, A>>,
}

/// A lazy iterator producing elements in the union of `HashSet`s.
///
/// This `struct` is created by the [`union`] method on [`HashSet`].
/// 更多详情请参阅其文档。
///
/// [`union`]: HashSet::union
///
/// # 示例
///
/// ```
/// use std::collections::HashSet;
///
/// let a = HashSet::from([1, 2, 3]);
/// let b = HashSet::from([4, 2, 3, 4]);
///
/// let mut union_iter = a.union(&b);
/// ```
#[must_use = "this returns the union as an iterator, \
              without modifying either input set"]
#[stable(feature = "rust1", since = "1.0.0")]
pub struct Union<
    'a,
    T: 'a,
    S: 'a,
    #[unstable(feature = "allocator_ext", issue = "163177", implied_by = "allocator_api")] A: Allocator = Global,
> {
    iter: Chain<Iter<'a, T>, Difference<'a, T, S, A>>,
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<'a, T, S, A: Allocator> IntoIterator for &'a HashSet<T, S, A> {
    type Item = &'a T;
    type IntoIter = Iter<'a, T>;

    #[inline]
    #[rustc_lint_query_instability]
    fn into_iter(self) -> Iter<'a, T> {
        self.iter()
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T, S, A: Allocator> IntoIterator for HashSet<T, S, A> {
    type Item = T;
    type IntoIter = IntoIter<T, A>;

    /// 创建一个消耗型迭代器，即按任意顺序移出集合中的每个元素。调用
    /// 此函数后，集合无法继续使用。
    /// # 示例
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::HashSet;
    /// let mut set = HashSet::new();
    /// set.insert("a".to_string());
    /// set.insert("b".to_string());
    ///
    /// // Not possible to collect to a Vec<String> with a regular `.iter()`.
    /// let v: Vec<String> = set.into_iter().collect();
    ///
    /// // Will print in an arbitrary order.
    /// for x in &v {
    ///     println!("{x}");
    /// }
    /// ```
    #[inline]
    #[rustc_lint_query_instability]
    fn into_iter(self) -> IntoIter<T, A> {
        IntoIter { base: self.base.into_iter() }
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<K> Clone for Iter<'_, K> {
    #[inline]
    fn clone(&self) -> Self {
        Iter { base: self.base.clone() }
    }
}
#[stable(feature = "rust1", since = "1.0.0")]
impl<'a, K> Iterator for Iter<'a, K> {
    type Item = &'a K;

    #[inline]
    fn next(&mut self) -> Option<&'a K> {
        self.base.next()
    }
    #[inline]
    fn size_hint(&self) -> (usize, Option<usize>) {
        self.base.size_hint()
    }
    #[inline]
    fn count(self) -> usize {
        self.base.len()
    }
    #[inline]
    fn fold<B, F>(self, init: B, f: F) -> B
    where
        Self: Sized,
        F: FnMut(B, Self::Item) -> B,
    {
        self.base.fold(init, f)
    }
}
#[stable(feature = "rust1", since = "1.0.0")]
impl<K> ExactSizeIterator for Iter<'_, K> {
    #[inline]
    fn len(&self) -> usize {
        self.base.len()
    }
}
#[stable(feature = "fused", since = "1.26.0")]
impl<K> FusedIterator for Iter<'_, K> {}

#[stable(feature = "std_debug", since = "1.16.0")]
impl<K: fmt::Debug> fmt::Debug for Iter<'_, K> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_list().entries(self.clone()).finish()
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<K, A: Allocator> Iterator for IntoIter<K, A> {
    type Item = K;

    #[inline]
    fn next(&mut self) -> Option<K> {
        self.base.next()
    }
    #[inline]
    fn size_hint(&self) -> (usize, Option<usize>) {
        self.base.size_hint()
    }
    #[inline]
    fn count(self) -> usize {
        self.base.len()
    }
    #[inline]
    fn fold<B, F>(self, init: B, f: F) -> B
    where
        Self: Sized,
        F: FnMut(B, Self::Item) -> B,
    {
        self.base.fold(init, f)
    }
}
#[stable(feature = "rust1", since = "1.0.0")]
impl<K, A: Allocator> ExactSizeIterator for IntoIter<K, A> {
    #[inline]
    fn len(&self) -> usize {
        self.base.len()
    }
}
#[stable(feature = "fused", since = "1.26.0")]
impl<K, A: Allocator> FusedIterator for IntoIter<K, A> {}

#[stable(feature = "std_debug", since = "1.16.0")]
impl<K: fmt::Debug, A: Allocator> fmt::Debug for IntoIter<K, A> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        fmt::Debug::fmt(&self.base, f)
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<'a, K, A: Allocator> Iterator for Drain<'a, K, A> {
    type Item = K;

    #[inline]
    fn next(&mut self) -> Option<K> {
        self.base.next()
    }
    #[inline]
    fn size_hint(&self) -> (usize, Option<usize>) {
        self.base.size_hint()
    }
    #[inline]
    fn fold<B, F>(self, init: B, f: F) -> B
    where
        Self: Sized,
        F: FnMut(B, Self::Item) -> B,
    {
        self.base.fold(init, f)
    }
}
#[stable(feature = "rust1", since = "1.0.0")]
impl<K, A: Allocator> ExactSizeIterator for Drain<'_, K, A> {
    #[inline]
    fn len(&self) -> usize {
        self.base.len()
    }
}
#[stable(feature = "fused", since = "1.26.0")]
impl<K, A: Allocator> FusedIterator for Drain<'_, K, A> {}

#[stable(feature = "std_debug", since = "1.16.0")]
impl<K: fmt::Debug, A: Allocator> fmt::Debug for Drain<'_, K, A> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        fmt::Debug::fmt(&self.base, f)
    }
}

#[stable(feature = "hash_extract_if", since = "1.88.0")]
impl<K, F, A: Allocator> Iterator for ExtractIf<'_, K, F, A>
where
    F: FnMut(&K) -> bool,
{
    type Item = K;

    #[inline]
    fn next(&mut self) -> Option<K> {
        self.base.next()
    }
    #[inline]
    fn size_hint(&self) -> (usize, Option<usize>) {
        self.base.size_hint()
    }
}

#[stable(feature = "hash_extract_if", since = "1.88.0")]
impl<K, F, A: Allocator> FusedIterator for ExtractIf<'_, K, F, A> where F: FnMut(&K) -> bool {}

#[stable(feature = "hash_extract_if", since = "1.88.0")]
impl<K, F, A: Allocator> fmt::Debug for ExtractIf<'_, K, F, A>
where
    K: fmt::Debug,
{
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("ExtractIf").finish_non_exhaustive()
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T, S, A: Allocator> Clone for Intersection<'_, T, S, A> {
    #[inline]
    fn clone(&self) -> Self {
        Intersection { iter: self.iter.clone(), ..*self }
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<'a, T, S, A> Iterator for Intersection<'a, T, S, A>
where
    T: Eq + Hash,
    S: BuildHasher,
    A: Allocator,
{
    type Item = &'a T;

    #[inline]
    fn next(&mut self) -> Option<&'a T> {
        loop {
            let elt = self.iter.next()?;
            if self.other.contains(elt) {
                return Some(elt);
            }
        }
    }

    #[inline]
    fn size_hint(&self) -> (usize, Option<usize>) {
        let (_, upper) = self.iter.size_hint();
        (0, upper)
    }

    #[inline]
    fn fold<B, F>(self, init: B, mut f: F) -> B
    where
        Self: Sized,
        F: FnMut(B, Self::Item) -> B,
    {
        self.iter.fold(init, |acc, elt| if self.other.contains(elt) { f(acc, elt) } else { acc })
    }
}

#[stable(feature = "std_debug", since = "1.16.0")]
impl<T, S, A> fmt::Debug for Intersection<'_, T, S, A>
where
    T: fmt::Debug + Eq + Hash,
    S: BuildHasher,
    A: Allocator,
{
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_list().entries(self.clone()).finish()
    }
}

#[stable(feature = "fused", since = "1.26.0")]
impl<T, S, A> FusedIterator for Intersection<'_, T, S, A>
where
    T: Eq + Hash,
    S: BuildHasher,
    A: Allocator,
{
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T, S, A: Allocator> Clone for Difference<'_, T, S, A> {
    #[inline]
    fn clone(&self) -> Self {
        Difference { iter: self.iter.clone(), ..*self }
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<'a, T, S, A> Iterator for Difference<'a, T, S, A>
where
    T: Eq + Hash,
    S: BuildHasher,
    A: Allocator,
{
    type Item = &'a T;

    #[inline]
    fn next(&mut self) -> Option<&'a T> {
        loop {
            let elt = self.iter.next()?;
            if !self.other.contains(elt) {
                return Some(elt);
            }
        }
    }

    #[inline]
    fn size_hint(&self) -> (usize, Option<usize>) {
        let (_, upper) = self.iter.size_hint();
        (0, upper)
    }

    #[inline]
    fn fold<B, F>(self, init: B, mut f: F) -> B
    where
        Self: Sized,
        F: FnMut(B, Self::Item) -> B,
    {
        self.iter.fold(init, |acc, elt| if self.other.contains(elt) { acc } else { f(acc, elt) })
    }
}

#[stable(feature = "fused", since = "1.26.0")]
impl<T, S, A> FusedIterator for Difference<'_, T, S, A>
where
    T: Eq + Hash,
    S: BuildHasher,
    A: Allocator,
{
}

#[stable(feature = "std_debug", since = "1.16.0")]
impl<T, S, A> fmt::Debug for Difference<'_, T, S, A>
where
    T: fmt::Debug + Eq + Hash,
    S: BuildHasher,
    A: Allocator,
{
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_list().entries(self.clone()).finish()
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T, S, A: Allocator> Clone for SymmetricDifference<'_, T, S, A> {
    #[inline]
    fn clone(&self) -> Self {
        SymmetricDifference { iter: self.iter.clone() }
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<'a, T, S, A> Iterator for SymmetricDifference<'a, T, S, A>
where
    T: Eq + Hash,
    S: BuildHasher,
    A: Allocator,
{
    type Item = &'a T;

    #[inline]
    fn next(&mut self) -> Option<&'a T> {
        self.iter.next()
    }
    #[inline]
    fn size_hint(&self) -> (usize, Option<usize>) {
        self.iter.size_hint()
    }
    #[inline]
    fn fold<B, F>(self, init: B, f: F) -> B
    where
        Self: Sized,
        F: FnMut(B, Self::Item) -> B,
    {
        self.iter.fold(init, f)
    }
}

#[stable(feature = "fused", since = "1.26.0")]
impl<T, S, A> FusedIterator for SymmetricDifference<'_, T, S, A>
where
    T: Eq + Hash,
    S: BuildHasher,
    A: Allocator,
{
}

#[stable(feature = "std_debug", since = "1.16.0")]
impl<T, S, A> fmt::Debug for SymmetricDifference<'_, T, S, A>
where
    T: fmt::Debug + Eq + Hash,
    S: BuildHasher,
    A: Allocator,
{
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_list().entries(self.clone()).finish()
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T, S, A: Allocator> Clone for Union<'_, T, S, A> {
    #[inline]
    fn clone(&self) -> Self {
        Union { iter: self.iter.clone() }
    }
}

#[stable(feature = "fused", since = "1.26.0")]
impl<T, S, A: Allocator> FusedIterator for Union<'_, T, S, A>
where
    T: Eq + Hash,
    S: BuildHasher,
{
}

#[stable(feature = "std_debug", since = "1.16.0")]
impl<T, S, A: Allocator> fmt::Debug for Union<'_, T, S, A>
where
    T: fmt::Debug + Eq + Hash,
    S: BuildHasher,
    A: Allocator,
{
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_list().entries(self.clone()).finish()
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<'a, T, S, A> Iterator for Union<'a, T, S, A>
where
    T: Eq + Hash,
    S: BuildHasher,
    A: Allocator,
{
    type Item = &'a T;

    #[inline]
    fn next(&mut self) -> Option<&'a T> {
        self.iter.next()
    }
    #[inline]
    fn size_hint(&self) -> (usize, Option<usize>) {
        self.iter.size_hint()
    }
    #[inline]
    fn count(self) -> usize {
        self.iter.count()
    }
    #[inline]
    fn fold<B, F>(self, init: B, f: F) -> B
    where
        Self: Sized,
        F: FnMut(B, Self::Item) -> B,
    {
        self.iter.fold(init, f)
    }
}

/// 对集合中单个条目的视图，该条目可能是空的或被占用的。
///
/// This `enum` is constructed from the [`entry`] method on [`HashSet`].
///
/// [`HashSet`]: struct.HashSet.html
/// [`entry`]: struct.HashSet.html#method.entry
///
/// # 示例
///
/// ```
/// #![feature(hash_set_entry)]
///
/// use std::collections::hash_set::HashSet;
///
/// let mut set = HashSet::new();
/// set.extend(["a", "b", "c"]);
/// assert_eq!(set.len(), 3);
///
/// // Existing value (insert)
/// let entry = set.entry("a");
/// let _raw_o = entry.insert();
/// assert_eq!(set.len(), 3);
/// // Nonexistent value (insert)
/// set.entry("d").insert();
///
/// // Existing value (or_insert)
/// set.entry("b").or_insert();
/// // Nonexistent value (or_insert)
/// set.entry("e").or_insert();
///
/// println!("Our HashSet: {:?}", set);
///
/// let mut vec: Vec<_> = set.iter().copied().collect();
/// // The `Iter` iterator produces items in arbitrary order, so the
/// // items must be sorted to test them against a sorted array.
/// vec.sort_unstable();
/// assert_eq!(vec, ["a", "b", "c", "d", "e"]);
/// ```
#[unstable(feature = "hash_set_entry", issue = "60896")]
pub enum Entry<
    'a,
    T,
    S,
    #[unstable(feature = "allocator_ext", issue = "163177", implied_by = "allocator_api")] A: Allocator = Global,
> {
    /// 被占用的条目。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(hash_set_entry)]
    ///
    /// use std::collections::hash_set::{Entry, HashSet};
    ///
    /// let mut set = HashSet::from(["a", "b"]);
    ///
    /// match set.entry("a") {
    ///     Entry::Vacant(_) => unreachable!(),
    ///     Entry::Occupied(_) => { }
    /// }
    /// ```
    Occupied(OccupiedEntry<'a, T, S, A>),

    /// 空着的条目。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(hash_set_entry)]
    ///
    /// use std::collections::hash_set::{Entry, HashSet};
    ///
    /// let mut set = HashSet::new();
    ///
    /// match set.entry("a") {
    ///     Entry::Occupied(_) => unreachable!(),
    ///     Entry::Vacant(_) => { }
    /// }
    /// ```
    Vacant(VacantEntry<'a, T, S, A>),
}

#[unstable(feature = "hash_set_entry", issue = "60896")]
impl<T: fmt::Debug, S, A: Allocator> fmt::Debug for Entry<'_, T, S, A> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match *self {
            Entry::Vacant(ref v) => f.debug_tuple("Entry").field(v).finish(),
            Entry::Occupied(ref o) => f.debug_tuple("Entry").field(o).finish(),
        }
    }
}

/// A view into an occupied entry in a `HashSet`.
/// It is part of the [`Entry`] enum.
///
/// [`Entry`]: enum.Entry.html
///
/// # 示例
///
/// ```
/// #![feature(hash_set_entry)]
///
/// use std::collections::hash_set::{Entry, HashSet};
///
/// let mut set = HashSet::new();
/// set.extend(["a", "b", "c"]);
///
/// let _entry_o = set.entry("a").insert();
/// assert_eq!(set.len(), 3);
///
/// // Existing key
/// match set.entry("a") {
///     Entry::Vacant(_) => unreachable!(),
///     Entry::Occupied(view) => {
///         assert_eq!(view.get(), &"a");
///     }
/// }
///
/// assert_eq!(set.len(), 3);
///
/// // Existing key (take)
/// match set.entry("c") {
///     Entry::Vacant(_) => unreachable!(),
///     Entry::Occupied(view) => {
///         assert_eq!(view.remove(), "c");
///     }
/// }
/// assert_eq!(set.get(&"c"), None);
/// assert_eq!(set.len(), 2);
/// ```
#[unstable(feature = "hash_set_entry", issue = "60896")]
pub struct OccupiedEntry<
    'a,
    T,
    S,
    #[unstable(feature = "allocator_ext", issue = "163177", implied_by = "allocator_api")] A: Allocator = Global,
> {
    base: base::OccupiedEntry<'a, T, S, A>,
}

#[unstable(feature = "hash_set_entry", issue = "60896")]
impl<T: fmt::Debug, S, A: Allocator> fmt::Debug for OccupiedEntry<'_, T, S, A> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("OccupiedEntry").field("value", self.get()).finish()
    }
}

/// A view into a vacant entry in a `HashSet`.
/// It is part of the [`Entry`] enum.
///
/// [`Entry`]: enum.Entry.html
///
/// # 示例
///
/// ```
/// #![feature(hash_set_entry)]
///
/// use std::collections::hash_set::{Entry, HashSet};
///
/// let mut set = HashSet::<&str>::new();
///
/// let entry_v = match set.entry("a") {
///     Entry::Vacant(view) => view,
///     Entry::Occupied(_) => unreachable!(),
/// };
/// entry_v.insert();
/// assert!(set.contains("a") && set.len() == 1);
///
/// // Nonexistent key (insert)
/// match set.entry("b") {
///     Entry::Vacant(view) => view.insert(),
///     Entry::Occupied(_) => unreachable!(),
/// }
/// assert!(set.contains("b") && set.len() == 2);
/// ```
#[unstable(feature = "hash_set_entry", issue = "60896")]
pub struct VacantEntry<
    'a,
    T,
    S,
    #[unstable(feature = "allocator_ext", issue = "163177", implied_by = "allocator_api")] A: Allocator = Global,
> {
    base: base::VacantEntry<'a, T, S, A>,
}

#[unstable(feature = "hash_set_entry", issue = "60896")]
impl<T: fmt::Debug, S, A: Allocator> fmt::Debug for VacantEntry<'_, T, S, A> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_tuple("VacantEntry").field(self.get()).finish()
    }
}

impl<'a, T, S, A: Allocator> Entry<'a, T, S, A> {
    /// 设置条目的值，并返回 OccupiedEntry 类型。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(hash_set_entry)]
    ///
    /// use std::collections::HashSet;
    ///
    /// let mut set = HashSet::new();
    /// let entry = set.entry("horseyland").insert();
    ///
    /// assert_eq!(entry.get(), &"horseyland");
    /// ```
    #[inline]
    #[unstable(feature = "hash_set_entry", issue = "60896")]
    pub fn insert(self) -> OccupiedEntry<'a, T, S, A>
    where
        T: Hash,
        S: BuildHasher,
    {
        match self {
            Entry::Occupied(entry) => entry,
            Entry::Vacant(entry) => entry.insert_entry(),
        }
    }

    /// 如果条目为空，则插入内容以确保其存在于条目中。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(hash_set_entry)]
    ///
    /// use std::collections::HashSet;
    ///
    /// let mut set = HashSet::new();
    ///
    /// // nonexistent key
    /// set.entry("poneyland").or_insert();
    /// assert!(set.contains("poneyland"));
    ///
    /// // existing key
    /// set.entry("poneyland").or_insert();
    /// assert!(set.contains("poneyland"));
    /// assert_eq!(set.len(), 1);
    /// ```
    #[inline]
    #[unstable(feature = "hash_set_entry", issue = "60896")]
    pub fn or_insert(self)
    where
        T: Hash,
        S: BuildHasher,
    {
        if let Entry::Vacant(entry) = self {
            entry.insert();
        }
    }

    /// 返回对该条目值的引用。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(hash_set_entry)]
    ///
    /// use std::collections::HashSet;
    ///
    /// let mut set = HashSet::new();
    /// set.entry("poneyland").or_insert();
    ///
    /// // existing key
    /// assert_eq!(set.entry("poneyland").get(), &"poneyland");
    /// // nonexistent key
    /// assert_eq!(set.entry("horseland").get(), &"horseland");
    /// ```
    #[inline]
    #[unstable(feature = "hash_set_entry", issue = "60896")]
    pub fn get(&self) -> &T {
        match *self {
            Entry::Occupied(ref entry) => entry.get(),
            Entry::Vacant(ref entry) => entry.get(),
        }
    }
}

impl<T, S, A: Allocator> OccupiedEntry<'_, T, S, A> {
    /// 获取条目的值的引用。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(hash_set_entry)]
    ///
    /// use std::collections::hash_set::{Entry, HashSet};
    ///
    /// let mut set = HashSet::new();
    /// set.entry("poneyland").or_insert();
    ///
    /// match set.entry("poneyland") {
    ///     Entry::Vacant(_) => panic!(),
    ///     Entry::Occupied(entry) => assert_eq!(entry.get(), &"poneyland"),
    /// }
    /// ```
    #[inline]
    #[unstable(feature = "hash_set_entry", issue = "60896")]
    pub fn get(&self) -> &T {
        self.base.get()
    }

    /// 从条目中取出值并返回它。
    /// 保留分配的内存以供重复使用。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(hash_set_entry)]
    ///
    /// use std::collections::HashSet;
    /// use std::collections::hash_set::Entry;
    ///
    /// let mut set = HashSet::new();
    /// // The set is empty
    /// assert!(set.is_empty() && set.capacity() == 0);
    ///
    /// set.entry("poneyland").or_insert();
    /// let capacity_before_remove = set.capacity();
    ///
    /// if let Entry::Occupied(o) = set.entry("poneyland") {
    ///     assert_eq!(o.remove(), "poneyland");
    /// }
    ///
    /// assert_eq!(set.contains("poneyland"), false);
    /// // Now set hold none elements but capacity is equal to the old one
    /// assert!(set.len() == 0 && set.capacity() == capacity_before_remove);
    /// ```
    #[inline]
    #[unstable(feature = "hash_set_entry", issue = "60896")]
    pub fn remove(self) -> T {
        self.base.remove()
    }
}

impl<'a, T, S, A: Allocator> VacantEntry<'a, T, S, A> {
    /// Gets a reference to the value that would be used when inserting
    /// through the `VacantEntry`.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(hash_set_entry)]
    ///
    /// use std::collections::HashSet;
    ///
    /// let mut set = HashSet::new();
    /// assert_eq!(set.entry("poneyland").get(), &"poneyland");
    /// ```
    #[inline]
    #[unstable(feature = "hash_set_entry", issue = "60896")]
    pub fn get(&self) -> &T {
        self.base.get()
    }

    /// 获得该值的所有权。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(hash_set_entry)]
    ///
    /// use std::collections::hash_set::{Entry, HashSet};
    ///
    /// let mut set = HashSet::new();
    ///
    /// match set.entry("poneyland") {
    ///     Entry::Occupied(_) => panic!(),
    ///     Entry::Vacant(v) => assert_eq!(v.into_value(), "poneyland"),
    /// }
    /// ```
    #[inline]
    #[unstable(feature = "hash_set_entry", issue = "60896")]
    pub fn into_value(self) -> T {
        self.base.into_value()
    }

    /// 使用 VacantEntry 的值设置条目的值。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(hash_set_entry)]
    ///
    /// use std::collections::HashSet;
    /// use std::collections::hash_set::Entry;
    ///
    /// let mut set = HashSet::new();
    ///
    /// if let Entry::Vacant(o) = set.entry("poneyland") {
    ///     o.insert();
    /// }
    /// assert!(set.contains("poneyland"));
    /// ```
    #[inline]
    #[unstable(feature = "hash_set_entry", issue = "60896")]
    pub fn insert(self)
    where
        T: Hash,
        S: BuildHasher,
    {
        self.base.insert();
    }

    #[inline]
    fn insert_entry(self) -> OccupiedEntry<'a, T, S, A>
    where
        T: Hash,
        S: BuildHasher,
    {
        OccupiedEntry { base: self.base.insert() }
    }
}

#[allow(dead_code)]
fn assert_covariance() {
    fn set<'new>(v: HashSet<&'static str>) -> HashSet<&'new str> {
        v
    }
    fn iter<'a, 'new>(v: Iter<'a, &'static str>) -> Iter<'a, &'new str> {
        v
    }
    fn into_iter<'new>(v: IntoIter<&'static str>) -> IntoIter<&'new str> {
        v
    }
    fn difference<'a, 'new>(
        v: Difference<'a, &'static str, RandomState>,
    ) -> Difference<'a, &'new str, RandomState> {
        v
    }
    fn symmetric_difference<'a, 'new>(
        v: SymmetricDifference<'a, &'static str, RandomState>,
    ) -> SymmetricDifference<'a, &'new str, RandomState> {
        v
    }
    fn intersection<'a, 'new>(
        v: Intersection<'a, &'static str, RandomState>,
    ) -> Intersection<'a, &'new str, RandomState> {
        v
    }
    fn union<'a, 'new>(
        v: Union<'a, &'static str, RandomState>,
    ) -> Union<'a, &'new str, RandomState> {
        v
    }
    fn drain<'new>(d: Drain<'static, &'static str>) -> Drain<'new, &'new str> {
        d
    }
}
