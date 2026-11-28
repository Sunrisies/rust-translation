use super::TrustedLen;

/// Conversion from an [`Iterator`].
///
/// By implementing `FromIterator` for a type, you define how it will be
/// 如何从迭代器创建。这适用于描述某种
/// 集合类型的类型。
///
/// 如果你想根据迭代器的内容创建集合，
/// [`Iterator::collect()`] method is preferred. However, when you need to
/// specify the container type, [`FromIterator::from_iter()`] can be more
/// readable than using a turbofish (e.g. `::<Vec<_>>()`). See the
/// [`Iterator::collect()`] documentation for more examples of its use.
///
/// See also: [`IntoIterator`].
///
/// # 示例
///
/// 基本用法：
///
/// ```
/// let five_fives = std::iter::repeat(5).take(5);
///
/// let v = Vec::from_iter(five_fives);
///
/// assert_eq!(v, vec![5, 5, 5, 5, 5]);
/// ```
///
/// Using [`Iterator::collect()`] to implicitly use `FromIterator`:
///
/// ```
/// let five_fives = std::iter::repeat(5).take(5);
///
/// let v: Vec<i32> = five_fives.collect();
///
/// assert_eq!(v, vec![5, 5, 5, 5, 5]);
/// ```
///
/// Using [`FromIterator::from_iter()`] as a more readable alternative to
/// [`Iterator::collect()`]:
///
/// ```
/// use std::collections::VecDeque;
/// let first = (0..10).collect::<VecDeque<i32>>();
/// let second = VecDeque::from_iter(0..10);
///
/// assert_eq!(first, second);
/// ```
///
/// Implementing `FromIterator` for your type:
///
/// ```
/// // A sample collection, that's just a wrapper over Vec<T>
/// #[derive(Debug)]
/// struct MyCollection(Vec<i32>);
///
/// // Let's give it some methods so we can create one and add things
/// // to it.
/// impl MyCollection {
///     fn new() -> MyCollection {
///         MyCollection(Vec::new())
///     }
///
///     fn add(&mut self, elem: i32) {
///         self.0.push(elem);
///     }
/// }
///
/// // and we'll implement FromIterator
/// impl FromIterator<i32> for MyCollection {
///     fn from_iter<I: IntoIterator<Item=i32>>(iter: I) -> Self {
///         let mut c = MyCollection::new();
///
///         for i in iter {
///             c.add(i);
///         }
///
///         c
///     }
/// }
///
/// // Now we can make a new iterator...
/// let iter = (0..5).into_iter();
///
/// // ... and make a MyCollection out of it
/// let c = MyCollection::from_iter(iter);
///
/// assert_eq!(c.0, vec![0, 1, 2, 3, 4]);
///
/// // collect works too!
///
/// let iter = (0..5).into_iter();
/// let c: MyCollection = iter.collect();
///
/// assert_eq!(c.0, vec![0, 1, 2, 3, 4]);
/// ```
#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_on_unimplemented(
    on(
        Self = "&[{T}]",
        message = "a slice of type `{Self}` cannot be built since we need to store the elements somewhere",
        label = "try explicitly collecting into a `Vec<{T}>`",
    ),
    on(
        all(T = "{integer}", any(Self = "&[{integral}]",)),
        message = "a slice of type `{Self}` cannot be built since we need to store the elements somewhere",
        label = "try explicitly collecting into a `Vec<{T}>`",
    ),
    on(
        Self = "[{T}]",
        message = "a slice of type `{Self}` cannot be built since `{Self}` has no definite size",
        label = "try explicitly collecting into a `Vec<{T}>`",
    ),
    on(
        all(T = "{integer}", any(Self = "[{integral}]",)),
        message = "a slice of type `{Self}` cannot be built since `{Self}` has no definite size",
        label = "try explicitly collecting into a `Vec<{T}>`",
    ),
    on(
        Self = "[{T}; _]",
        message = "an array of type `{Self}` cannot be built directly from an iterator",
        label = "try collecting into a `Vec<{T}>`, then using `.try_into()`",
    ),
    on(
        all(T = "{integer}", any(Self = "[{integral}; _]",)),
        message = "an array of type `{Self}` cannot be built directly from an iterator",
        label = "try collecting into a `Vec<{T}>`, then using `.try_into()`",
    ),
    message = "a value of type `{Self}` cannot be built from an iterator \
               over elements of type `{T}`",
    label = "value of type `{Self}` cannot be built from `std::iter::Iterator<Item={T}>`"
)]
#[rustc_diagnostic_item = "FromIterator"]
pub trait FromIterator<T>: Sized {
    /// 从迭代器创建值。
    ///
    /// 请参阅 [模块级文档] 以了解更多信息。
    ///
    /// [module-level documentation]: crate::iter
    ///
    /// # 示例
    ///
    /// ```
    /// let five_fives = std::iter::repeat(5).take(5);
    ///
    /// let v = Vec::from_iter(five_fives);
    ///
    /// assert_eq!(v, vec![5, 5, 5, 5, 5]);
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_diagnostic_item = "from_iter_fn"]
    fn from_iter<I: IntoIterator<Item = T>>(iter: I) -> Self;
}

/// Conversion into an [`Iterator`].
///
/// By implementing `IntoIterator` for a type, you define how it will be
/// 如何转换为迭代器。这适用于描述某种
/// 集合类型的类型。
///
/// One benefit of implementing `IntoIterator` is that your type will [work
/// with Rust's `for` loop syntax](crate::iter#for-loops-and-intoiterator).
///
/// See also: [`FromIterator`].
///
/// # 示例
///
/// 基本用法：
///
/// ```
/// let v = [1, 2, 3];
/// let mut iter = v.into_iter();
///
/// assert_eq!(Some(1), iter.next());
/// assert_eq!(Some(2), iter.next());
/// assert_eq!(Some(3), iter.next());
/// assert_eq!(None, iter.next());
/// ```
/// Implementing `IntoIterator` for your type:
///
/// ```
/// // A sample collection, that's just a wrapper over Vec<T>
/// #[derive(Debug)]
/// struct MyCollection(Vec<i32>);
///
/// // Let's give it some methods so we can create one and add things
/// // to it.
/// impl MyCollection {
///     fn new() -> MyCollection {
///         MyCollection(Vec::new())
///     }
///
///     fn add(&mut self, elem: i32) {
///         self.0.push(elem);
///     }
/// }
///
/// // and we'll implement IntoIterator
/// impl IntoIterator for MyCollection {
///     type Item = i32;
///     type IntoIter = std::vec::IntoIter<Self::Item>;
///
///     fn into_iter(self) -> Self::IntoIter {
///         self.0.into_iter()
///     }
/// }
///
/// // Now we can make a new collection...
/// let mut c = MyCollection::new();
///
/// // ... add some stuff to it ...
/// c.add(0);
/// c.add(1);
/// c.add(2);
///
/// // ... and then turn it into an Iterator:
/// for (i, n) in c.into_iter().enumerate() {
///     assert_eq!(i as i32, n);
/// }
/// ```
///
/// It is common to use `IntoIterator` as a trait bound. This allows
/// 输入集合类型发生变化，只要它仍然是
/// 迭代器即可。可以通过限制被迭代的元素类型来指定额外的约束。
/// `Item`:
///
/// ```rust
/// fn collect_as_strings<T>(collection: T) -> Vec<String>
/// where
///     T: IntoIterator,
///     T::Item: std::fmt::Debug,
/// {
///     collection
///         .into_iter()
///         .map(|item| format!("{item:?}"))
///         .collect()
/// }
/// ```
#[rustc_diagnostic_item = "IntoIterator"]
#[rustc_on_unimplemented(
    on(
        Self = "core::ops::range::RangeTo<Idx>",
        label = "if you meant to iterate until a value, add a starting value",
        note = "`..end` is a `RangeTo`, which cannot be iterated on; you might have meant to have a \
              bounded `Range`: `0..end`"
    ),
    on(
        Self = "core::ops::range::RangeToInclusive<Idx>",
        label = "if you meant to iterate until a value (including it), add a starting value",
        note = "`..=end` is a `RangeToInclusive`, which cannot be iterated on; you might have meant \
              to have a bounded `RangeInclusive`: `0..=end`"
    ),
    on(
        Self = "[]",
        label = "`{Self}` is not an iterator; try calling `.into_iter()` or `.iter()`"
    ),
    on(Self = "&[]", label = "`{Self}` is not an iterator; try calling `.iter()`"),
    on(
        Self = "alloc::vec::Vec<T, A>",
        label = "`{Self}` is not an iterator; try calling `.into_iter()` or `.iter()`"
    ),
    on(Self = "&str", label = "`{Self}` is not an iterator; try calling `.chars()` or `.bytes()`"),
    on(
        Self = "alloc::string::String",
        label = "`{Self}` is not an iterator; try calling `.chars()` or `.bytes()`"
    ),
    on(
        Self = "{integral}",
        note = "if you want to iterate between `start` until a value `end`, use the exclusive range \
              syntax `start..end` or the inclusive range syntax `start..=end`"
    ),
    on(
        Self = "{float}",
        note = "if you want to iterate between `start` until a value `end`, use the exclusive range \
              syntax `start..end` or the inclusive range syntax `start..=end`"
    ),
    label = "`{Self}` is not an iterator",
    message = "`{Self}` is not an iterator"
)]
#[rustc_skip_during_method_dispatch(array, boxed_slice)]
#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_const_unstable(feature = "const_iter", issue = "92476")]
pub const trait IntoIterator {
    /// 我们将其转换为哪种类型的迭代器？
    #[rustc_diagnostic_item = "IntoIteratorItem"]
    #[stable(feature = "rust1", since = "1.0.0")]
    type Item;

    /// 我们正在将其转换为哪种类型的迭代器？
    #[stable(feature = "rust1", since = "1.0.0")]
    type IntoIter: Iterator<Item = Self::Item>;

    /// 从值创建迭代器。
    ///
    /// 请参阅 [模块级文档] 以了解更多信息。
    ///
    /// [module-level documentation]: crate::iter
    ///
    /// # 示例
    ///
    /// ```
    /// let v = [1, 2, 3];
    /// let mut iter = v.into_iter();
    ///
    /// assert_eq!(Some(1), iter.next());
    /// assert_eq!(Some(2), iter.next());
    /// assert_eq!(Some(3), iter.next());
    /// assert_eq!(None, iter.next());
    /// ```
    #[lang = "into_iter"]
    #[stable(feature = "rust1", since = "1.0.0")]
    fn into_iter(self) -> Self::IntoIter;
}

#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_const_unstable(feature = "const_iter", issue = "92476")]
const impl<I: [const] Iterator> IntoIterator for I {
    type Item = I::Item;
    type IntoIter = I;

    #[inline]
    fn into_iter(self) -> I {
        self
    }
}

/// 通过迭代器的内容扩展集合。
///
/// Iterators produce a series of values, and collections can also be thought
/// of as a series of values. The `Extend` trait bridges this gap, allowing you
/// 用已存在的键扩展集合时，该条目会被更新；
/// 对于允许多个具有相同键的条目的集合，该条目会被插入。
/// # 示例
/// 基本用法：
///
/// # Examples
///
/// 通过迭代器的内容扩展集合。
///
/// ```
/// // You can extend a String with some chars:
/// let mut message = String::from("The first three letters are: ");
///
/// message.extend(&['a', 'b', 'c']);
///
/// assert_eq!("abc", &message[29..32]);
/// ```
///
/// Implementing `Extend`:
///
/// ```
/// // A sample collection, that's just a wrapper over Vec<T>
/// #[derive(Debug)]
/// struct MyCollection(Vec<i32>);
///
/// // Let's give it some methods so we can create one and add things
/// // to it.
/// impl MyCollection {
///     fn new() -> MyCollection {
///         MyCollection(Vec::new())
///     }
///
///     fn add(&mut self, elem: i32) {
///         self.0.push(elem);
///     }
/// }
///
/// // since MyCollection has a list of i32s, we implement Extend for i32
/// impl Extend<i32> for MyCollection {
///
///     // This is a bit simpler with the concrete type signature: we can call
///     // extend on anything which can be turned into an Iterator which gives
///     // us i32s. Because we need i32s to put into MyCollection.
///     fn extend<I: IntoIterator<Item=i32>>(&mut self, iter: I) {
///
///         // The implementation is very straightforward: loop through the
///         // iterator, and add() each element to ourselves.
///         for elem in iter {
///             self.add(elem);
///         }
///     }
/// }
///
/// let mut c = MyCollection::new();
///
/// c.add(5);
/// c.add(6);
/// c.add(7);
///
/// // let's extend our collection with three more numbers
/// c.extend(vec![1, 2, 3]);
///
/// // we've added these elements onto the end
/// assert_eq!("MyCollection([5, 6, 7, 1, 2, 3])", format!("{c:?}"));
/// ```
#[stable(feature = "rust1", since = "1.0.0")]
pub trait Extend<T> {
    /// 包含更多细节。
    ///
    /// # 示例
    /// 用恰好一个元素扩展集合。
    ///
    /// [trait-level]: Extend
    ///
    /// # 为给定的额外元素数量在集合中预留容量。
    ///
    /// ```
    /// // You can extend a String with some chars:
    /// let mut message = String::from("abc");
    ///
    /// message.extend(['d', 'e', 'f'].iter());
    ///
    /// assert_eq!("abcdef", &message);
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    fn extend<I: IntoIterator<Item = T>>(&mut self, iter: I);

    /// Extends a collection with exactly one element.
    #[unstable(feature = "extend_one", issue = "72631")]
    fn extend_one(&mut self, item: T) {
        self.extend(Some(item));
    }

    /// Reserves capacity in a collection for the given number of additional elements.
    ///
    /// 默认实现不会执行任何操作。
    #[unstable(feature = "extend_one", issue = "72631")]
    fn extend_reserve(&mut self, additional: usize) {
        let _ = additional;
    }

    /// 向集合添加一个元素，而不检查是否有足够的容量容纳该元素。
    ///
    /// # 安全性
    ///
    /// **For callers:** This must only be called when we know the collection has enough capacity
    /// to contain the new item, for example because we previously called `extend_reserve`.
    ///
    /// 调用者可以假设，如果为它们分配了足够的空间，就可以调用此方法。
    /// invoke UB if they are violated), it must implement `extend_reserve` correctly. In other words,
    /// callers may assume that if they `extend_reserve`ed enough space they can call this method.
    // This method is for internal usage only. It is only on the trait because of specialization's limitations.
    #[unstable(feature = "extend_one_unchecked", issue = "none")]
    #[doc(hidden)]
    unsafe fn extend_one_unchecked(&mut self, item: T)
    where
        Self: Sized,
    {
        self.extend_one(item);
    }
}

#[stable(feature = "extend_for_unit", since = "1.28.0")]
impl Extend<()> for () {
    fn extend<I: IntoIterator<Item = ()>>(&mut self, iter: I) {
        iter.into_iter().for_each(drop)
    }
    fn extend_one(&mut self, _item: ()) {}
}

/// This trait is implemented for tuples up to twelve items long. The `impl`s for
/// 1- and 3- through 12-ary tuples were stabilized after 2-tuples, in 1.85.0.
#[doc(fake_variadic)] // the other implementations are below.
#[stable(feature = "extend_for_tuple", since = "1.56.0")]
impl<T, ExtendT> Extend<(T,)> for (ExtendT,)
where
    ExtendT: Extend<T>,
{
    /// Allows to `extend` a tuple of collections that also implement `Extend`.
    ///
    /// See also: [`Iterator::unzip`]
    ///
    /// # 示例
    /// ```
    /// // Example given for a 2-tuple, but 1- through 12-tuples are supported
    /// let mut tuple = (vec![0], vec![1]);
    /// tuple.extend([(2, 3), (4, 5), (6, 7)]);
    /// assert_eq!(tuple.0, [0, 2, 4, 6]);
    /// assert_eq!(tuple.1, [1, 3, 5, 7]);
    ///
    /// // also allows for arbitrarily nested tuples as elements
    /// let mut nested_tuple = (vec![1], (vec![2], vec![3]));
    /// nested_tuple.extend([(4, (5, 6)), (7, (8, 9))]);
    ///
    /// let (a, (b, c)) = nested_tuple;
    /// assert_eq!(a, [1, 4, 7]);
    /// assert_eq!(b, [2, 5, 8]);
    /// assert_eq!(c, [3, 6, 9]);
    /// ```
    fn extend<I: IntoIterator<Item = (T,)>>(&mut self, iter: I) {
        self.0.extend(iter.into_iter().map(|t| t.0));
    }

    fn extend_one(&mut self, item: (T,)) {
        self.0.extend_one(item.0)
    }

    fn extend_reserve(&mut self, additional: usize) {
        self.0.extend_reserve(additional)
    }

    unsafe fn extend_one_unchecked(&mut self, item: (T,)) {
        // SAFETY: the caller guarantees all preconditions.
        unsafe { self.0.extend_one_unchecked(item.0) }
    }
}

/// This implementation turns an iterator of tuples into a tuple of types which implement
/// [`Default`] and [`Extend`].
///
/// This is similar to [`Iterator::unzip`], but is also composable with other [`FromIterator`]
/// implementations:
///
/// ```rust
/// # fn main() -> Result<(), core::num::ParseIntError> {
/// let string = "1,2,123,4";
///
/// // Example given for a 2-tuple, but 1- through 12-tuples are supported
/// let (numbers, lengths): (Vec<_>, Vec<_>) = string
///     .split(',')
///     .map(|s| s.parse().map(|n: u32| (n, s.len())))
///     .collect::<Result<_, _>>()?;
///
/// assert_eq!(numbers, [1, 2, 123, 4]);
/// assert_eq!(lengths, [1, 1, 3, 1]);
/// # Ok(()) }
/// ```
#[doc(fake_variadic)] // the other implementations are below.
#[stable(feature = "from_iterator_for_tuple", since = "1.79.0")]
impl<T, ExtendT> FromIterator<(T,)> for (ExtendT,)
where
    ExtendT: Default + Extend<T>,
{
    fn from_iter<Iter: IntoIterator<Item = (T,)>>(iter: Iter) -> Self {
        let mut res = ExtendT::default();
        res.extend(iter.into_iter().map(|t| t.0));
        (res,)
    }
}

/// An implementation of [`extend`](Extend::extend) that calls `extend_one` or
/// `extend_one_unchecked` for each element of the iterator.
fn default_extend<ExtendT, I, T>(collection: &mut ExtendT, iter: I)
where
    ExtendT: Extend<T>,
    I: IntoIterator<Item = T>,
{
    // Specialize on `TrustedLen` and call `extend_one_unchecked` where
    // applicable.
    trait SpecExtend<I> {
        fn extend(&mut self, iter: I);
    }

    // Extracting these to separate functions avoid monomorphising the closures
    // for every iterator type.
    fn extender<ExtendT, T>(collection: &mut ExtendT) -> impl FnMut(T) + use<'_, ExtendT, T>
    where
        ExtendT: Extend<T>,
    {
        move |item| collection.extend_one(item)
    }

    unsafe fn unchecked_extender<ExtendT, T>(
        collection: &mut ExtendT,
    ) -> impl FnMut(T) + use<'_, ExtendT, T>
    where
        ExtendT: Extend<T>,
    {
        // SAFETY: we make sure that there is enough space at the callsite of
        // this function.
        move |item| unsafe { collection.extend_one_unchecked(item) }
    }

    impl<ExtendT, I, T> SpecExtend<I> for ExtendT
    where
        ExtendT: Extend<T>,
        I: Iterator<Item = T>,
    {
        default fn extend(&mut self, iter: I) {
            let (lower_bound, _) = iter.size_hint();
            if lower_bound > 0 {
                self.extend_reserve(lower_bound);
            }

            iter.for_each(extender(self))
        }
    }

    impl<ExtendT, I, T> SpecExtend<I> for ExtendT
    where
        ExtendT: Extend<T>,
        I: TrustedLen<Item = T>,
    {
        fn extend(&mut self, iter: I) {
            let (lower_bound, upper_bound) = iter.size_hint();
            if lower_bound > 0 {
                self.extend_reserve(lower_bound);
            }

            if upper_bound.is_none() {
                // We cannot reserve more than `usize::MAX` items, and this is likely to go out of memory anyway.
                iter.for_each(extender(self))
            } else {
                // SAFETY: We reserve enough space for the `size_hint`, and the iterator is
                // `TrustedLen` so its `size_hint` is exact.
                iter.for_each(unsafe { unchecked_extender(self) })
            }
        }
    }

    SpecExtend::extend(collection, iter.into_iter());
}

// Implements `Extend` and `FromIterator` for tuples with length larger than one.
macro_rules! impl_extend_tuple {
    ($(($ty:tt, $extend_ty:tt, $index:tt)),+) => {
        #[doc(hidden)]
        #[stable(feature = "extend_for_tuple", since = "1.56.0")]
        impl<$($ty,)+ $($extend_ty,)+> Extend<($($ty,)+)> for ($($extend_ty,)+)
        where
            $($extend_ty: Extend<$ty>,)+
        {
            fn extend<Iter: IntoIterator<Item = ($($ty,)+)>>(&mut self, iter: Iter) {
                default_extend(self, iter)
            }

            fn extend_one(&mut self, item: ($($ty,)+)) {
                $(self.$index.extend_one(item.$index);)+
            }

            fn extend_reserve(&mut self, additional: usize) {
                $(self.$index.extend_reserve(additional);)+
            }

            unsafe fn extend_one_unchecked(&mut self, item: ($($ty,)+)) {
                // SAFETY: Those are our safety preconditions, and we correctly forward `extend_reserve`.
                unsafe {
                    $(self.$index.extend_one_unchecked(item.$index);)+
                }
            }
        }

        #[doc(hidden)]
        #[stable(feature = "from_iterator_for_tuple", since = "1.79.0")]
        impl<$($ty,)+ $($extend_ty,)+> FromIterator<($($ty,)+)> for ($($extend_ty,)+)
        where
            $($extend_ty: Default + Extend<$ty>,)+
        {
            fn from_iter<Iter: IntoIterator<Item = ($($ty,)+)>>(iter: Iter) -> Self {
                let mut res = Self::default();
                res.extend(iter);
                res
            }
        }
    };
}

impl_extend_tuple!((A, ExA, 0), (B, ExB, 1));
impl_extend_tuple!((A, ExA, 0), (B, ExB, 1), (C, ExC, 2));
impl_extend_tuple!((A, ExA, 0), (B, ExB, 1), (C, ExC, 2), (D, ExD, 3));
impl_extend_tuple!((A, ExA, 0), (B, ExB, 1), (C, ExC, 2), (D, ExD, 3), (E, ExE, 4));
impl_extend_tuple!((A, ExA, 0), (B, ExB, 1), (C, ExC, 2), (D, ExD, 3), (E, ExE, 4), (F, ExF, 5));
impl_extend_tuple!(
    (A, ExA, 0),
    (B, ExB, 1),
    (C, ExC, 2),
    (D, ExD, 3),
    (E, ExE, 4),
    (F, ExF, 5),
    (G, ExG, 6)
);
impl_extend_tuple!(
    (A, ExA, 0),
    (B, ExB, 1),
    (C, ExC, 2),
    (D, ExD, 3),
    (E, ExE, 4),
    (F, ExF, 5),
    (G, ExG, 6),
    (H, ExH, 7)
);
impl_extend_tuple!(
    (A, ExA, 0),
    (B, ExB, 1),
    (C, ExC, 2),
    (D, ExD, 3),
    (E, ExE, 4),
    (F, ExF, 5),
    (G, ExG, 6),
    (H, ExH, 7),
    (I, ExI, 8)
);
impl_extend_tuple!(
    (A, ExA, 0),
    (B, ExB, 1),
    (C, ExC, 2),
    (D, ExD, 3),
    (E, ExE, 4),
    (F, ExF, 5),
    (G, ExG, 6),
    (H, ExH, 7),
    (I, ExI, 8),
    (J, ExJ, 9)
);
impl_extend_tuple!(
    (A, ExA, 0),
    (B, ExB, 1),
    (C, ExC, 2),
    (D, ExD, 3),
    (E, ExE, 4),
    (F, ExF, 5),
    (G, ExG, 6),
    (H, ExH, 7),
    (I, ExI, 8),
    (J, ExJ, 9),
    (K, ExK, 10)
);
impl_extend_tuple!(
    (A, ExA, 0),
    (B, ExB, 1),
    (C, ExC, 2),
    (D, ExD, 3),
    (E, ExE, 4),
    (F, ExF, 5),
    (G, ExG, 6),
    (H, ExH, 7),
    (I, ExI, 8),
    (J, ExJ, 9),
    (K, ExK, 10),
    (L, ExL, 11)
);
