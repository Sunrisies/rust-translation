//! 针对数组基本类型提供的工具函数。
//!
//! *[See also the array primitive type](array).*

#![stable(feature = "core_array", since = "1.35.0")]

use crate::borrow::{Borrow, BorrowMut};
use crate::clone::TrivialClone;
use crate::cmp::Ordering;
use crate::error::Error;
use crate::hash::{self, Hash};
use crate::intrinsics::transmute_unchecked;
use crate::iter::{TrustedLen, repeat_n};
use crate::marker::Destruct;
use crate::mem::{self, ManuallyDrop, MaybeUninit};
use crate::ops::{
    ChangeOutputType, ControlFlow, FromResidual, Index, IndexMut, NeverShortCircuit, Residual, Try,
};
use crate::ptr::{null, null_mut};
use crate::slice::{Iter, IterMut};
use crate::{fmt, ptr};

mod ascii;
mod drain;
mod equality;
mod iter;

#[stable(feature = "array_value_iter", since = "1.51.0")]
pub use iter::IntoIter;

/// Creates an array of type `[T; N]` by repeatedly cloning a value.
///
/// This is the same as `[val; N]`, but it also works for types that do not
/// implement [`Copy`].
///
/// 提供的值将作为结果数组的元素被使用，并且
/// 会被克隆 N - 1 次以填充剩余部分。如果 N 为零，该值
/// 将被丢弃。
///
/// # 示例
///
/// Creating multiple copies of a `String`:
/// ```rust
/// use std::array;
///
/// let string = "Hello there!".to_string();
/// let strings = array::repeat(string);
/// assert_eq!(strings, ["Hello there!", "Hello there!"]);
/// ```
#[inline]
#[must_use = "cloning is often expensive and is not expected to have side effects"]
#[stable(feature = "array_repeat", since = "1.91.0")]
pub fn repeat<T: Clone, const N: usize>(val: T) -> [T; N] {
    let mut iter = repeat_n(val, N);
    // SAFETY: Unless a panic occurs, from_fn will call the closure N times,
    // and repeat_n's next() will return Some for N times.
    from_fn(move |_| unsafe { iter.next().unwrap_unchecked() })
}

/// Creates an array where each element is produced by calling `f` with
/// 在遍历数组时依次进行此操作。
///
/// 这本质上与编写
/// ```text
/// [f(0), f(1), f(2), …, f(N - 2), f(N - 1)]
/// ```
/// and is similar to `(0..i).map(f)`, just for arrays not iterators.
///
/// If `N == 0`, this produces an empty array without ever calling `f`.
///
/// # 示例
///
/// ```rust
/// // type inference is helping us here, the way `from_fn` knows how many
/// // elements to produce is the length of array down there: only arrays of
/// // equal lengths can be compared, so the const generic parameter `N` is
/// // inferred to be 5, thus creating array of 5 elements.
///
/// let array = core::array::from_fn(|i| i);
/// // indexes are:    0  1  2  3  4
/// assert_eq!(array, [0, 1, 2, 3, 4]);
///
/// let array2: [usize; 8] = core::array::from_fn(|i| i * 2);
/// // indexes are:     0  1  2  3  4  5   6   7
/// assert_eq!(array2, [0, 2, 4, 6, 8, 10, 12, 14]);
///
/// let bool_arr = core::array::from_fn::<_, 5, _>(|i| i % 2 == 0);
/// // indexes are:       0     1      2     3      4
/// assert_eq!(bool_arr, [true, false, true, false, true]);
/// ```
///
/// 你还可以捕获某些内容，例如创建一个充满克隆的数组
/// where you can't just use `[item; N]` because it's not `Copy`:
/// ```
/// let my_string: [String; 2] = std::array::from_fn(|i| format!("Hello {i}"));
/// assert_eq!(my_string, ["Hello 0", "Hello 1"]);
/// ```
///
/// 数组按递增索引顺序生成，从前端开始
/// 并向后端方向排列，因此可以使用具有可变状态的闭包：
/// ```
/// let mut state = 1;
/// let a = std::array::from_fn(|_| { let x = state; state *= 2; x });
/// assert_eq!(a, [1, 2, 4, 8, 16, 32]);
/// ```
#[inline]
#[stable(feature = "array_from_fn", since = "1.63.0")]
#[rustc_const_unstable(feature = "const_array", issue = "147606")]
pub const fn from_fn<T: [const] Destruct, const N: usize, F>(f: F) -> [T; N]
where
    F: [const] FnMut(usize) -> T + [const] Destruct,
{
    try_from_fn(NeverShortCircuit::wrap_mut_1(f)).0
}

/// Creates an array `[T; N]` where each fallible array element `T` is returned by the `cb` call.
/// Unlike [`from_fn`], where the element creation can't fail, this version will return an error
/// 如果任何元素创建失败，则返回错误类型。
///
/// 此函数的返回类型取决于闭包的返回类型。
/// If you return `Result<T, E>` from the closure, you'll get a `Result<[T; N], E>`.
/// If you return `Option<T>` from the closure, you'll get an `Option<[T; N]>`.
///
/// # 参数
///
/// * `cb`: Callback where the passed argument is the current array index.
///
/// # 示例
///
/// ```rust
/// #![feature(array_try_from_fn)]
///
/// let array: Result<[u8; 5], _> = std::array::try_from_fn(|i| i.try_into());
/// assert_eq!(array, Ok([0, 1, 2, 3, 4]));
///
/// let array: Result<[i8; 200], _> = std::array::try_from_fn(|i| i.try_into());
/// assert!(array.is_err());
///
/// let array: Option<[_; 4]> = std::array::try_from_fn(|i| i.checked_add(100));
/// assert_eq!(array, Some([100, 101, 102, 103]));
///
/// let array: Option<[_; 4]> = std::array::try_from_fn(|i| i.checked_sub(100));
/// assert_eq!(array, None);
/// ```
#[inline]
#[unstable(feature = "array_try_from_fn", issue = "89379")]
#[rustc_const_unstable(feature = "array_try_from_fn", issue = "89379")]
pub const fn try_from_fn<R, const N: usize, F>(cb: F) -> ChangeOutputType<R, [R::Output; N]>
where
    R: [const] Try<Residual: [const] Residual<[R::Output; N]>, Output: [const] Destruct>,
    F: [const] FnMut(usize) -> R + [const] Destruct,
{
    let mut array = [const { MaybeUninit::uninit() }; N];
    match try_from_fn_erased(&mut array, cb) {
        ControlFlow::Break(r) => FromResidual::from_residual(r),
        ControlFlow::Continue(()) => {
            // SAFETY: All elements of the array were populated.
            try { unsafe { MaybeUninit::array_assume_init(array) } }
        }
    }
}

/// Converts a reference to `T` into a reference to an array of length 1 (without copying).
#[stable(feature = "array_from_ref", since = "1.53.0")]
#[rustc_const_stable(feature = "const_array_from_ref_shared", since = "1.63.0")]
pub const fn from_ref<T>(s: &T) -> &[T; 1] {
    // SAFETY: Converting `&T` to `&[T; 1]` is sound.
    unsafe { &*(s as *const T).cast::<[T; 1]>() }
}

/// Converts a mutable reference to `T` into a mutable reference to an array of length 1 (without copying).
#[stable(feature = "array_from_ref", since = "1.53.0")]
#[rustc_const_stable(feature = "const_array_from_ref", since = "1.83.0")]
pub const fn from_mut<T>(s: &mut T) -> &mut [T; 1] {
    // SAFETY: Converting `&mut T` to `&mut [T; 1]` is sound.
    unsafe { &mut *(s as *mut T).cast::<[T; 1]>() }
}

/// 从切片转换为数组失败时返回的错误类型。
#[stable(feature = "try_from", since = "1.34.0")]
#[derive(Debug, Copy, Clone)]
pub struct TryFromSliceError(());

#[stable(feature = "core_array", since = "1.35.0")]
impl fmt::Display for TryFromSliceError {
    #[inline]
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        "could not convert slice to array".fmt(f)
    }
}

#[stable(feature = "try_from", since = "1.34.0")]
impl Error for TryFromSliceError {}

#[stable(feature = "try_from_slice_error", since = "1.36.0")]
#[rustc_const_unstable(feature = "const_convert", issue = "143773")]
const impl From<!> for TryFromSliceError {
    fn from(x: !) -> TryFromSliceError {
        match x {}
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_const_unstable(feature = "const_convert", issue = "143773")]
const impl<T, const N: usize> AsRef<[T]> for [T; N] {
    #[inline]
    fn as_ref(&self) -> &[T] {
        &self[..]
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_const_unstable(feature = "const_convert", issue = "143773")]
const impl<T, const N: usize> AsMut<[T]> for [T; N] {
    #[inline]
    fn as_mut(&mut self) -> &mut [T] {
        &mut self[..]
    }
}

#[stable(feature = "array_borrow", since = "1.4.0")]
#[rustc_const_unstable(feature = "const_convert", issue = "143773")]
const impl<T, const N: usize> Borrow<[T]> for [T; N] {
    fn borrow(&self) -> &[T] {
        self
    }
}

#[stable(feature = "array_borrow", since = "1.4.0")]
#[rustc_const_unstable(feature = "const_convert", issue = "143773")]
const impl<T, const N: usize> BorrowMut<[T]> for [T; N] {
    fn borrow_mut(&mut self) -> &mut [T] {
        self
    }
}

/// Tries to create an array `[T; N]` by copying from a slice `&[T]`.
/// Succeeds if `slice.len() == N`.
///
/// ```
/// let bytes: [u8; 3] = [1, 0, 2];
///
/// let bytes_head: [u8; 2] = <[u8; 2]>::try_from(&bytes[0..2]).unwrap();
/// assert_eq!(1, u16::from_le_bytes(bytes_head));
///
/// let bytes_tail: [u8; 2] = bytes[1..3].try_into().unwrap();
/// assert_eq!(512, u16::from_le_bytes(bytes_tail));
/// ```
#[stable(feature = "try_from", since = "1.34.0")]
#[rustc_const_unstable(feature = "const_convert", issue = "143773")]
const impl<T, const N: usize> TryFrom<&[T]> for [T; N]
where
    T: Copy,
{
    type Error = TryFromSliceError;

    #[inline]
    fn try_from(slice: &[T]) -> Result<[T; N], TryFromSliceError> {
        <&Self>::try_from(slice).copied()
    }
}

/// Tries to create an array `[T; N]` by copying from a mutable slice `&mut [T]`.
/// Succeeds if `slice.len() == N`.
///
/// ```
/// let mut bytes: [u8; 3] = [1, 0, 2];
///
/// let bytes_head: [u8; 2] = <[u8; 2]>::try_from(&mut bytes[0..2]).unwrap();
/// assert_eq!(1, u16::from_le_bytes(bytes_head));
///
/// let bytes_tail: [u8; 2] = (&mut bytes[1..3]).try_into().unwrap();
/// assert_eq!(512, u16::from_le_bytes(bytes_tail));
/// ```
#[stable(feature = "try_from_mut_slice_to_array", since = "1.59.0")]
#[rustc_const_unstable(feature = "const_convert", issue = "143773")]
const impl<T, const N: usize> TryFrom<&mut [T]> for [T; N]
where
    T: Copy,
{
    type Error = TryFromSliceError;

    #[inline]
    fn try_from(slice: &mut [T]) -> Result<[T; N], TryFromSliceError> {
        <Self>::try_from(&*slice)
    }
}

/// Tries to create an array ref `&[T; N]` from a slice ref `&[T]`. Succeeds if
/// `slice.len() == N`.
///
/// ```
/// let bytes: [u8; 3] = [1, 0, 2];
///
/// let bytes_head: &[u8; 2] = <&[u8; 2]>::try_from(&bytes[0..2]).unwrap();
/// assert_eq!(1, u16::from_le_bytes(*bytes_head));
///
/// let bytes_tail: &[u8; 2] = bytes[1..3].try_into().unwrap();
/// assert_eq!(512, u16::from_le_bytes(*bytes_tail));
/// ```
#[stable(feature = "try_from", since = "1.34.0")]
#[rustc_const_unstable(feature = "const_convert", issue = "143773")]
const impl<'a, T, const N: usize> TryFrom<&'a [T]> for &'a [T; N] {
    type Error = TryFromSliceError;

    #[inline]
    fn try_from(slice: &'a [T]) -> Result<&'a [T; N], TryFromSliceError> {
        slice.as_array().ok_or(TryFromSliceError(()))
    }
}

/// Tries to create a mutable array ref `&mut [T; N]` from a mutable slice ref
/// `&mut [T]`. Succeeds if `slice.len() == N`.
///
/// ```
/// let mut bytes: [u8; 3] = [1, 0, 2];
///
/// let bytes_head: &mut [u8; 2] = <&mut [u8; 2]>::try_from(&mut bytes[0..2]).unwrap();
/// assert_eq!(1, u16::from_le_bytes(*bytes_head));
///
/// let bytes_tail: &mut [u8; 2] = (&mut bytes[1..3]).try_into().unwrap();
/// assert_eq!(512, u16::from_le_bytes(*bytes_tail));
/// ```
#[stable(feature = "try_from", since = "1.34.0")]
#[rustc_const_unstable(feature = "const_convert", issue = "143773")]
const impl<'a, T, const N: usize> TryFrom<&'a mut [T]> for &'a mut [T; N] {
    type Error = TryFromSliceError;

    #[inline]
    fn try_from(slice: &'a mut [T]) -> Result<&'a mut [T; N], TryFromSliceError> {
        slice.as_mut_array().ok_or(TryFromSliceError(()))
    }
}

/// 数组的哈希值与对应的切片相同。
/// as required by the `Borrow` implementation.
///
/// ```
/// use std::hash::BuildHasher;
///
/// let b = std::hash::RandomState::new();
/// let a: [u8; 3] = [0xa8, 0x3c, 0x09];
/// let s: &[u8] = &[0xa8, 0x3c, 0x09];
/// assert_eq!(b.hash_one(a), b.hash_one(s));
/// ```
#[stable(feature = "rust1", since = "1.0.0")]
impl<T: Hash, const N: usize> Hash for [T; N] {
    fn hash<H: hash::Hasher>(&self, state: &mut H) {
        Hash::hash(&self[..], state)
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T: fmt::Debug, const N: usize> fmt::Debug for [T; N] {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        fmt::Debug::fmt(&&self[..], f)
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<'a, T, const N: usize> IntoIterator for &'a [T; N] {
    type Item = &'a T;
    type IntoIter = Iter<'a, T>;

    fn into_iter(self) -> Iter<'a, T> {
        self.iter()
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<'a, T, const N: usize> IntoIterator for &'a mut [T; N] {
    type Item = &'a mut T;
    type IntoIter = IterMut<'a, T>;

    fn into_iter(self) -> IterMut<'a, T> {
        self.iter_mut()
    }
}

#[stable(feature = "index_trait_on_arrays", since = "1.50.0")]
#[rustc_const_unstable(feature = "const_index", issue = "143775")]
const impl<T, I, const N: usize> Index<I> for [T; N]
where
    [T]: [const] Index<I>,
{
    type Output = <[T] as Index<I>>::Output;

    #[inline]
    fn index(&self, index: I) -> &Self::Output {
        Index::index(self as &[T], index)
    }
}

#[stable(feature = "index_trait_on_arrays", since = "1.50.0")]
#[rustc_const_unstable(feature = "const_index", issue = "143775")]
const impl<T, I, const N: usize> IndexMut<I> for [T; N]
where
    [T]: [const] IndexMut<I>,
{
    #[inline]
    fn index_mut(&mut self, index: I) -> &mut Self::Output {
        IndexMut::index_mut(self as &mut [T], index)
    }
}

/// Implements comparison of arrays [lexicographically](Ord#lexicographical-comparison).
#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_const_unstable(feature = "const_cmp", issue = "143800")]
const impl<T: [const] PartialOrd, const N: usize> PartialOrd for [T; N] {
    #[inline]
    fn partial_cmp(&self, other: &[T; N]) -> Option<Ordering> {
        <[T] as PartialOrd>::partial_cmp(self, other)
    }

    #[inline]
    fn lt(&self, other: &[T; N]) -> bool {
        <[T] as PartialOrd>::lt(self, other)
    }
    #[inline]
    fn le(&self, other: &[T; N]) -> bool {
        <[T] as PartialOrd>::le(self, other)
    }
    #[inline]
    fn ge(&self, other: &[T; N]) -> bool {
        <[T] as PartialOrd>::ge(self, other)
    }
    #[inline]
    fn gt(&self, other: &[T; N]) -> bool {
        <[T] as PartialOrd>::gt(self, other)
    }

    #[inline]
    fn __chaining_less(&self, other: &[T; N]) -> ControlFlow<bool> {
        <[T] as PartialOrd>::__chaining_less(self, other)
    }
    #[inline]
    fn __chaining_greater(&self, other: &[T; N]) -> ControlFlow<bool> {
        <[T] as PartialOrd>::__chaining_greater(self, other)
    }
}

/// Implements comparison of arrays [lexicographically](Ord#lexicographical-comparison).
#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_const_unstable(feature = "const_cmp", issue = "143800")]
const impl<T: [const] Ord, const N: usize> Ord for [T; N] {
    #[inline]
    fn cmp(&self, other: &[T; N]) -> Ordering {
        Ord::cmp(&&self[..], &&other[..])
    }
}

#[stable(feature = "copy_clone_array_lib", since = "1.58.0")]
impl<T: Copy, const N: usize> Copy for [T; N] {}

#[stable(feature = "copy_clone_array_lib", since = "1.58.0")]
impl<T: Clone, const N: usize> Clone for [T; N] {
    #[inline]
    fn clone(&self) -> Self {
        SpecArrayClone::clone(self)
    }

    #[inline]
    fn clone_from(&mut self, other: &Self) {
        self.clone_from_slice(other);
    }
}

#[doc(hidden)]
#[unstable(feature = "trivial_clone", issue = "none")]
unsafe impl<T: TrivialClone, const N: usize> TrivialClone for [T; N] {}

trait SpecArrayClone: Clone {
    fn clone<const N: usize>(array: &[Self; N]) -> [Self; N];
}

impl<T: Clone> SpecArrayClone for T {
    #[inline]
    default fn clone<const N: usize>(array: &[T; N]) -> [T; N] {
        let mut ptr: *const T = array.as_ptr();
        // SAFETY: Unless a panic occurs, from_fn will call the closure N times,
        // so our pointer arithmetic will be in bounds for the N-element array.
        // This works even for ZSTs, since in that case, add() is a no-op.
        from_fn(move |_| unsafe {
            let old = ptr;
            ptr = ptr.add(1);
            (&*old).clone()
        })
    }
}

impl<T: TrivialClone> SpecArrayClone for T {
    #[inline]
    fn clone<const N: usize>(array: &[T; N]) -> [T; N] {
        // SAFETY: `TrivialClone` implies that this is equivalent to calling
        // `Clone` on every element.
        unsafe { ptr::read(array) }
    }
}

// The Default impls cannot be done with const generics because `[T; 0]` doesn't
// require Default to be implemented, and having different impl blocks for
// different numbers isn't supported yet.
//
// Trying to improve the `[T; 0]` situation has proven to be difficult.
// Please see these issues for more context on past attempts and crater runs:
// - https://github.com/rust-lang/rust/issues/61415
// - https://github.com/rust-lang/rust/pull/145457

macro_rules! array_impl_default {
    {$n:expr, $t:ident $($ts:ident)*} => {
        #[stable(since = "1.4.0", feature = "array_default")]
        impl<T> Default for [T; $n] where T: Default {
            fn default() -> [T; $n] {
                [$t::default(), $($ts::default()),*]
            }
        }
        array_impl_default!{($n - 1), $($ts)*}
    };
    {$n:expr,} => {
        #[stable(since = "1.4.0", feature = "array_default")]
        impl<T> Default for [T; $n] {
            fn default() -> [T; $n] { [] }
        }
    };
}

array_impl_default! {32, T T T T T T T T T T T T T T T T T T T T T T T T T T T T T T T T}

impl<T, const N: usize> [T; N] {
    /// Returns an array of the same size as `self`, with function `f` applied to each element
    /// 按顺序排列。
    ///
    /// If you don't necessarily need a new fixed-size array, consider using
    /// [`Iterator::map`] instead.
    ///
    ///
    /// # Note on performance and stack usage
    ///
    /// Note that this method is *eager*.  It evaluates `f` all `N` times before
    /// 而后者则交错调用这些函数。
    ///
    /// That means that `arr.map(f).map(g)` is, in general, *not* equivalent to
    /// `array.map(|x| g(f(x)))`, as the former calls `f` 4 times then `g` 4 times,
    /// whereas the latter interleaves the calls (`fgfgfgfg`).
    ///
    /// 那么请务必使用此方法。其实现使用了多种技巧来帮助优化器正确处理。对于简单的数组，
    /// in debug mode or for long arrays.  The backend may be able to optimize it
    /// 然而，如果你实际上不需要特定的 *数组* 形式的结果，
    ///
    /// If you're doing a one-step `map` and really want an array as the result,
    /// 例如，与其在前面将数组中的所有元素进行数组到数组的映射，
    /// 而是在完成后才迭代，
    /// like `[u8; 3]` or `[f32; 4]`, there's nothing to be concerned about.
    ///
    /// # 示例
    /// just to process them, then you likely want [`Iterator::map`] instead.
    ///
    /// 此函数的返回类型取决于闭包的返回类型。
    /// in the array up-front and only iterating after that completes,
    ///
    /// ```
    /// # let my_array = [1, 2, 3];
    /// # let f = |x: i32| x + 1;
    /// for x in my_array.map(f) {
    ///     // ...
    /// }
    /// ```
    ///
    /// It's often better to use an iterator along the lines of
    ///
    /// ```
    /// # let my_array = [1, 2, 3];
    /// # let f = |x: i32| x + 1;
    /// for x in my_array.into_iter().map(f) {
    ///     // ...
    /// }
    /// ```
    ///
    /// # 示例
    ///
    ///
    /// # Examples
    ///
    /// ```
    /// let x = [1, 2, 3];
    /// let y = x.map(|v| v + 1);
    /// assert_eq!(y, [2, 3, 4]);
    ///
    /// let x = [1, 2, 3];
    /// let mut temp = 0;
    /// let y = x.map(|v| { temp += 1; v * temp });
    /// assert_eq!(y, [1, 4, 9]);
    ///
    /// let x = ["Ferris", "Bueller's", "Day", "Off"];
    /// let y = x.map(|v| v.len());
    /// assert_eq!(y, [6, 9, 3, 3]);
    /// ```
    #[must_use]
    #[stable(feature = "array_map", since = "1.55.0")]
    #[rustc_const_unstable(feature = "const_array", issue = "147606")]
    pub const fn map<F, U>(self, f: F) -> [U; N]
    where
        F: [const] FnMut(T) -> U + [const] Destruct,
        U: [const] Destruct,
        T: [const] Destruct,
    {
        self.try_map(NeverShortCircuit::wrap_mut_1(f)).0
    }

    /// A fallible function `f` applied to each element on array `self` in order to
    /// return an array the same size as `self` or the first error encountered.
    ///
    /// 此函数的返回类型取决于闭包的返回类型。
    /// If you return `Result<T, E>` from the closure, you'll get a `Result<[T; N], E>`.
    /// If you return `Option<T>` from the closure, you'll get an `Option<[T; N]>`.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(array_try_map)]
    ///
    /// let a = ["1", "2", "3"];
    /// let b = a.try_map(|v| v.parse::<u32>()).unwrap().map(|v| v + 1);
    /// assert_eq!(b, [2, 3, 4]);
    ///
    /// let a = ["1", "2a", "3"];
    /// let b = a.try_map(|v| v.parse::<u32>());
    /// assert!(b.is_err());
    ///
    /// use std::num::NonZero;
    ///
    /// let z = [1, 2, 0, 3, 4];
    /// assert_eq!(z.try_map(NonZero::new), None);
    ///
    /// let a = [1, 2, 3];
    /// let b = a.try_map(NonZero::new);
    /// let c = b.map(|x| x.map(NonZero::get));
    /// assert_eq!(c, Some(a));
    /// ```
    #[unstable(feature = "array_try_map", issue = "79711")]
    #[rustc_const_unstable(feature = "array_try_map", issue = "79711")]
    pub const fn try_map<R>(
        self,
        mut f: impl [const] FnMut(T) -> R + [const] Destruct,
    ) -> ChangeOutputType<R, [R::Output; N]>
    where
        R: [const] Try<Residual: [const] Residual<[R::Output; N]>, Output: [const] Destruct>,
        T: [const] Destruct,
    {
        let mut me = ManuallyDrop::new(self);
        // SAFETY: try_from_fn calls `f` N times.
        let mut f = unsafe { drain::Drain::new(&mut me, &mut f) };
        try_from_fn(&mut f)
    }

    /// Returns a slice containing the entire array. Equivalent to `&s[..]`.
    #[stable(feature = "array_as_slice", since = "1.57.0")]
    #[rustc_const_stable(feature = "array_as_slice", since = "1.57.0")]
    pub const fn as_slice(&self) -> &[T] {
        self
    }

    /// Returns a mutable slice containing the entire array. Equivalent to
    /// `&mut s[..]`.
    #[stable(feature = "array_as_slice", since = "1.57.0")]
    #[rustc_const_stable(feature = "const_array_as_mut_slice", since = "1.89.0")]
    pub const fn as_mut_slice(&mut self) -> &mut [T] {
        self
    }

    /// 借用每个元素，并返回具有相同大小的引用数组。
    /// size as `self`.
    ///
    ///
    /// # 示例
    ///
    /// ```
    /// let floats = [3.1, 2.7, -1.0];
    /// let float_refs: [&f64; 3] = floats.each_ref();
    /// assert_eq!(float_refs, [&3.1, &2.7, &-1.0]);
    /// ```
    ///
    /// 如果与其他方法结合使用，此方法特别有用。
    /// [`map`](#method.map). This way, you can avoid moving the original
    /// array if its elements are not [`Copy`].
    ///
    /// ```
    /// let strings = ["Ferris".to_string(), "♥".to_string(), "Rust".to_string()];
    /// let is_ascii = strings.each_ref().map(|s| s.is_ascii());
    /// assert_eq!(is_ascii, [true, false, true]);
    ///
    /// // We can still access the original array: it has not been moved.
    /// assert_eq!(strings.len(), 3);
    /// ```
    #[stable(feature = "array_methods", since = "1.77.0")]
    #[rustc_const_stable(feature = "const_array_each_ref", since = "1.91.0")]
    pub const fn each_ref(&self) -> [&T; N] {
        let mut buf = [null::<T>(); N];

        // FIXME(const_trait_impl): We would like to simply use iterators for this (as in the original implementation), but this is not allowed in constant expressions.
        let mut i = 0;
        while i < N {
            buf[i] = &raw const self[i];

            i += 1;
        }

        // SAFETY: `*const T` has the same layout as `&T`, and we've also initialised each pointer as a valid reference.
        unsafe { transmute_unchecked(buf) }
    }

    /// 可修改地借用每个元素，并返回一个可修改的引用数组。
    /// with the same size as `self`.
    ///
    ///
    /// # 示例
    ///
    /// ```
    ///
    /// let mut floats = [3.1, 2.7, -1.0];
    /// let float_refs: [&mut f64; 3] = floats.each_mut();
    /// *float_refs[0] = 0.0;
    /// assert_eq!(float_refs, [&mut 0.0, &mut 2.7, &mut -1.0]);
    /// assert_eq!(floats, [0.0, 2.7, -1.0]);
    /// ```
    #[stable(feature = "array_methods", since = "1.77.0")]
    #[rustc_const_stable(feature = "const_array_each_ref", since = "1.91.0")]
    pub const fn each_mut(&mut self) -> [&mut T; N] {
        let mut buf = [null_mut::<T>(); N];

        // FIXME(const_trait_impl): We would like to simply use iterators for this (as in the original implementation), but this is not allowed in constant expressions.
        let mut i = 0;
        while i < N {
            buf[i] = &raw mut self[i];

            i += 1;
        }

        // SAFETY: `*mut T` has the same layout as `&mut T`, and we've also initialised each pointer as a valid reference.
        unsafe { transmute_unchecked(buf) }
    }

    /// 在指定索引处将一个数组引用分成两部分。
    ///
    /// The first will contain all indices from `[0, M)` (excluding
    /// the index `M` itself) and the second will contain all
    /// indices from `[M, N)` (excluding the index `N` itself).
    ///
    /// # 恐慌
    ///
    /// Panics if `M > N`.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(split_array)]
    ///
    /// let v = [1, 2, 3, 4, 5, 6];
    ///
    /// {
    ///    let (left, right) = v.split_array_ref::<0>();
    ///    assert_eq!(left, &[]);
    ///    assert_eq!(right, &[1, 2, 3, 4, 5, 6]);
    /// }
    ///
    /// {
    ///     let (left, right) = v.split_array_ref::<2>();
    ///     assert_eq!(left, &[1, 2]);
    ///     assert_eq!(right, &[3, 4, 5, 6]);
    /// }
    ///
    /// {
    ///     let (left, right) = v.split_array_ref::<6>();
    ///     assert_eq!(left, &[1, 2, 3, 4, 5, 6]);
    ///     assert_eq!(right, &[]);
    /// }
    /// ```
    #[unstable(
        feature = "split_array",
        reason = "return type should have array as 2nd element",
        issue = "90091"
    )]
    #[inline]
    pub fn split_array_ref<const M: usize>(&self) -> (&[T; M], &[T]) {
        self.split_first_chunk::<M>().unwrap()
    }

    /// 在指定索引处将一个可修改的数组引用分成两部分。
    ///
    /// The first will contain all indices from `[0, M)` (excluding
    /// the index `M` itself) and the second will contain all
    /// indices from `[M, N)` (excluding the index `N` itself).
    ///
    /// # Panics
    ///
    /// Panics if `M > N`.
    ///
    /// # 在末尾的指定索引处将一个可修改的数组引用分成两部分。
    ///
    /// ```
    /// #![feature(split_array)]
    ///
    /// let mut v = [1, 0, 3, 0, 5, 6];
    /// let (left, right) = v.split_array_mut::<2>();
    /// assert_eq!(left, &mut [1, 0][..]);
    /// assert_eq!(right, &mut [3, 0, 5, 6]);
    /// left[1] = 2;
    /// right[1] = 4;
    /// assert_eq!(v, [1, 2, 3, 4, 5, 6]);
    /// ```
    #[unstable(
        feature = "split_array",
        reason = "return type should have array as 2nd element",
        issue = "90091"
    )]
    #[inline]
    pub fn split_array_mut<const M: usize>(&mut self) -> (&mut [T; M], &mut [T]) {
        self.split_first_chunk_mut::<M>().unwrap()
    }

    /// Divides one array reference into two at an index from the end.
    ///
    /// The first will contain all indices from `[0, N - M)` (excluding
    /// the index `N - M` itself) and the second will contain all
    /// indices from `[N - M, N)` (excluding the index `N` itself).
    ///
    /// # 示例
    ///
    /// Panics if `M > N`.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(split_array)]
    ///
    /// let v = [1, 2, 3, 4, 5, 6];
    ///
    /// {
    ///    let (left, right) = v.rsplit_array_ref::<0>();
    ///    assert_eq!(left, &[1, 2, 3, 4, 5, 6]);
    ///    assert_eq!(right, &[]);
    /// }
    ///
    /// {
    ///     let (left, right) = v.rsplit_array_ref::<2>();
    ///     assert_eq!(left, &[1, 2, 3, 4]);
    ///     assert_eq!(right, &[5, 6]);
    /// }
    ///
    /// {
    ///     let (left, right) = v.rsplit_array_ref::<6>();
    ///     assert_eq!(left, &[]);
    ///     assert_eq!(right, &[1, 2, 3, 4, 5, 6]);
    /// }
    /// ```
    #[unstable(
        feature = "split_array",
        reason = "return type should have array as 2nd element",
        issue = "90091"
    )]
    #[inline]
    pub fn rsplit_array_ref<const M: usize>(&self) -> (&[T], &[T; M]) {
        self.split_last_chunk::<M>().unwrap()
    }

    /// 在末尾的指定索引处将一个可修改的数组引用分成两部分。
    ///
    /// The first will contain all indices from `[0, N - M)` (excluding
    /// the index `N - M` itself) and the second will contain all
    /// indices from `[N - M, N)` (excluding the index `N` itself).
    ///
    /// # Panics
    ///
    /// Panics if `M > N`.
    ///
    /// # Examples
    ///
    /// ```
    /// #![feature(split_array)]
    ///
    /// let mut v = [1, 0, 3, 0, 5, 6];
    /// let (left, right) = v.rsplit_array_mut::<4>();
    /// assert_eq!(left, &mut [1, 0]);
    /// assert_eq!(right, &mut [3, 0, 5, 6][..]);
    /// left[1] = 2;
    /// right[1] = 4;
    /// assert_eq!(v, [1, 2, 3, 4, 5, 6]);
    /// ```
    #[unstable(
        feature = "split_array",
        reason = "return type should have array as 2nd element",
        issue = "90091"
    )]
    #[inline]
    pub fn rsplit_array_mut<const M: usize>(&mut self) -> (&mut [T], &mut [T; M]) {
        self.split_last_chunk_mut::<M>().unwrap()
    }
}

/// Version of [`try_from_fn`] using a passed-in slice in order to avoid
/// 它接受生成器而不是迭代器，因此 *在类型层面*，
///
/// 它永远不必担心项目耗尽的问题。当与
/// it never needs to worry about running out of items.  When combined with
/// an infallible `Try` type, that means the loop canonicalizes easily, allowing
/// it to optimize well.
///
/// It would be *possible* to unify this and [`iter_next_chunk_erased`] into one
/// 因此，如果你尝试这样做，请务必关注代码生成测试中的情况。
/// 用于数组增量初始化的恐慌保护机制。
/// 一旦数组初始化完成，即可解除该保护机制。
/// # 安全性
#[inline]
#[rustc_const_unstable(feature = "array_try_from_fn", issue = "89379")]
const fn try_from_fn_erased<R: [const] Try<Output: [const] Destruct>>(
    buffer: &mut [MaybeUninit<R::Output>],
    mut generator: impl [const] FnMut(usize) -> R + [const] Destruct,
) -> ControlFlow<R::Residual> {
    let mut guard = Guard { array_mut: buffer, initialized: 0 };

    while guard.initialized < guard.array_mut.len() {
        let item = generator(guard.initialized).branch()?;

        // SAFETY: The loop condition ensures we have space to push the item
        unsafe { guard.push_unchecked(item) };
    }

    mem::forget(guard);
    ControlFlow::Continue(())
}

/// 对此结构的所有写入访问都是不安全的，必须保持正确的
///
/// Disarm the guard with `mem::forget` once the array has been initialized.
///
/// # Safety
///
/// All write accesses to this structure are unsafe and must maintain a correct
/// count of `initialized` elements.
///
/// 为了减少间接性，字段仍然是公开的（pub），但调用者至少应该使用
/// `push_unchecked` to signal that something unsafe is going on.
struct Guard<'a, T> {
    /// 要初始化的数组。
    pub array_mut: &'a mut [MaybeUninit<T>],
    /// 目前已初始化的元素数量。
    pub initialized: usize,
}

impl<T> Guard<'_, T> {
    /// 向数组添加一个元素，并更新已初始化元素计数器。
    ///
    /// # 安全性
    ///
    /// 最多只能初始化 N 个元素。
    #[inline]
    #[rustc_const_unstable(feature = "array_try_from_fn", issue = "89379")]
    pub(crate) const unsafe fn push_unchecked(&mut self, item: T) {
        // SAFETY: If `initialized` was correct before and the caller does not
        // invoke this method more than N times, then writes will be in-bounds
        // and slots will not be initialized more than once.
        unsafe {
            self.array_mut.get_unchecked_mut(self.initialized).write(item);
            self.initialized = self.initialized.unchecked_add(1);
        }
    }
}

#[rustc_const_unstable(feature = "array_try_from_fn", issue = "89379")]
const impl<T: [const] Destruct> Drop for Guard<'_, T> {
    #[inline]
    fn drop(&mut self) {
        debug_assert!(self.initialized <= self.array_mut.len());
        // SAFETY: this slice will contain only initialized objects.
        unsafe {
            self.array_mut.get_unchecked_mut(..self.initialized).assume_init_drop();
        }
    }
}

/// 用于从数组末尾逐步初始化的 panic 保护机制。
///
/// 数组的元素从末尾向开头填充。
/// Disarm the guard with `mem::forget` once the array has been fully initialized.
///
/// # 安全性
///
/// 对此结构的所有写访问都是不安全的，必须保持正确的
/// count of `initialized` elements.
struct GuardBack<'a, T> {
    /// 要初始化的数组（将从末尾填充）。
    pub array_mut: &'a mut [MaybeUninit<T>],
    /// 目前已初始化的元素数量。
    pub initialized: usize,
}

impl<T> GuardBack<'_, T> {
    /// 向数组添加一个元素，并更新已初始化元素计数器。
    ///
    /// # 安全性
    ///
    /// 最多只能初始化 N 个元素。
    #[inline]
    pub(crate) unsafe fn push_unchecked(&mut self, item: T) {
        // SAFETY: If `initialized` was correct before and the caller does not
        // invoke this method more than N times, then writes will be in-bounds
        // and slots will not be initialized more than once.
        unsafe {
            let offset = self.initialized.unchecked_add(1);
            let index = self.array_mut.len().unchecked_sub(offset);
            self.array_mut.get_unchecked_mut(index).write(item);
            self.initialized = offset;
        }
    }
}

impl<T: Destruct> Drop for GuardBack<'_, T> {
    #[inline]
    fn drop(&mut self) {
        debug_assert!(self.initialized <= self.array_mut.len());
        let len = self.array_mut.len();
        // SAFETY: this slice will contain only initialized objects.
        unsafe {
            self.array_mut.get_unchecked_mut(len - self.initialized..len).assume_init_drop();
        }
    }
}

/// Pulls `N` items from `iter` and returns them as an array. If the iterator
/// yields fewer than `N` items, `Err` is returned containing an iterator over
/// 已产生元素的迭代器。
///
/// Since the iterator is passed as a mutable reference and this function calls
/// `next` at most `N` times, the iterator can still be used afterwards to
/// retrieve the remaining items.
///
/// If `iter.next()` panics, all items already yielded by the iterator are
/// dropped.
///
/// Used for [`Iterator::next_chunk`].
#[rustc_const_unstable(feature = "const_iter", issue = "92476")]
#[inline]
pub(crate) const fn iter_next_chunk<T, const N: usize>(
    iter: &mut impl [const] Iterator<Item = T>,
) -> Result<[T; N], IntoIter<T, N>> {
    iter.spec_next_chunk()
}

pub(crate) const trait SpecNextChunk<T, const N: usize>: Iterator<Item = T> {
    fn spec_next_chunk(&mut self) -> Result<[T; N], IntoIter<T, N>>;
}
#[rustc_const_unstable(feature = "const_iter", issue = "92476")]
const impl<I: [const] Iterator<Item = T>, T, const N: usize> SpecNextChunk<T, N> for I {
    #[inline]
    default fn spec_next_chunk(&mut self) -> Result<[T; N], IntoIter<T, N>> {
        let mut array = [const { MaybeUninit::uninit() }; N];
        let r = iter_next_chunk_erased(&mut array, self);
        match r {
            Ok(()) => {
                // SAFETY: All elements of `array` were populated.
                Ok(unsafe { MaybeUninit::array_assume_init(array) })
            }
            Err(initialized) => {
                // SAFETY: Only the first `initialized` elements were populated
                Err(unsafe { IntoIter::new_unchecked(array, 0..initialized) })
            }
        }
    }
}
#[rustc_const_unstable(feature = "const_iter", issue = "92476")]
const impl<I: [const] Iterator<Item = T> + TrustedLen, T, const N: usize> SpecNextChunk<T, N>
    for I
{
    fn spec_next_chunk(&mut self) -> Result<[T; N], IntoIter<T, N>> {
        let len = (*self).size_hint().0;
        let mut array = [const { MaybeUninit::uninit() }; N];
        if len < N {
            // SAFETY: `TrustedLen`, an unsafe trait, requires that i can get len items out of it.
            unsafe { write(&mut array, self, len) };
            // SAFETY: Only the first `len` elements were populated
            Err(unsafe { IntoIter::new_unchecked(array, 0..len) })
        } else {
            // SAFETY: `TrustedLen`, an unsafe trait, requires that i can get N items out of it.
            unsafe { write(&mut array, self, N) };
            // SAFETY: All N items were populated
            Ok(unsafe { MaybeUninit::array_assume_init(array) })
        }
    }
}
// SAFETY: `from` must have len items, and len items must be < N.
#[rustc_const_unstable(feature = "const_iter", issue = "92476")]
const unsafe fn write<T, const N: usize>(
    to: &mut [MaybeUninit<T>; N],
    from: &mut impl [const] Iterator<Item = T>,
    len: usize,
) {
    let mut guard = Guard { array_mut: to, initialized: 0 };
    while guard.initialized < len {
        // SAFETY: caller has guaranteed, from has len items.
        let item = unsafe { from.next().unwrap_unchecked() };
        // SAFETY: guard.initialized < len < N
        unsafe { guard.push_unchecked(item) };
    }
    crate::mem::forget(guard);
}

/// Version of [`iter_next_chunk`] using a passed-in slice in order to avoid
/// needing to monomorphize for every array length.
///
/// Unfortunately this loop has two exit conditions, the buffer filling up
/// 对已产生元素的迭代器。
#[rustc_const_unstable(feature = "const_iter", issue = "92476")]
#[inline]
const fn iter_next_chunk_erased<T>(
    buffer: &mut [MaybeUninit<T>],
    iter: &mut impl [const] Iterator<Item = T>,
) -> Result<(), usize> {
    // if `Iterator::next` panics, this guard will drop already initialized items
    let mut guard = Guard { array_mut: buffer, initialized: 0 };
    while guard.initialized < guard.array_mut.len() {
        let Some(item) = iter.next() else {
            // Unlike `try_from_fn_erased`, we want to keep the partial results,
            // so we need to defuse the guard instead of using `?`.
            let initialized = guard.initialized;
            mem::forget(guard);
            return Err(initialized);
        };

        // SAFETY: The loop condition ensures we have space to push the item
        unsafe { guard.push_unchecked(item) };
    }

    mem::forget(guard);
    Ok(())
}

/// Pulls `N` items from the back of `iter` and returns them as an array.
/// If the iterator yields fewer than `N` items, `Err` is returned containing
/// an iterator over the already yielded items.
///
/// Since the iterator is passed as a mutable reference and this function calls
/// `next_back` at most `N` times, the iterator can still be used afterwards to
/// 需要针对每个数组长度进行单态化。
///
/// If `iter.next_back()` panics, all items already yielded by the iterator are
/// dropped.
///
/// Used for [`DoubleEndedIterator::next_chunk_back`].
#[inline]
pub(crate) fn iter_next_chunk_back<T, const N: usize>(
    iter: &mut impl DoubleEndedIterator<Item = T>,
) -> Result<[T; N], IntoIter<T, N>> {
    iter.spec_next_chunk_back()
}

pub(crate) trait SpecNextChunkBack<T, const N: usize>:
    DoubleEndedIterator<Item = T>
{
    fn spec_next_chunk_back(&mut self) -> Result<[T; N], IntoIter<T, N>>;
}

impl<I: DoubleEndedIterator<Item = T>, T, const N: usize> SpecNextChunkBack<T, N> for I {
    #[inline]
    default fn spec_next_chunk_back(&mut self) -> Result<[T; N], IntoIter<T, N>> {
        let mut array = [const { MaybeUninit::uninit() }; N];
        let r = iter_next_chunk_back_erased(&mut array, self);
        match r {
            Ok(()) => {
                // SAFETY: All elements of `array` were populated.
                Ok(unsafe { MaybeUninit::array_assume_init(array) })
            }
            Err(initialized) => {
                // SAFETY: Only the last `initialized` elements were populated
                Err(unsafe { IntoIter::new_unchecked(array, N - initialized..N) })
            }
        }
    }
}

impl<I: DoubleEndedIterator<Item = T> + TrustedLen, T, const N: usize> SpecNextChunkBack<T, N>
    for I
{
    fn spec_next_chunk_back(&mut self) -> Result<[T; N], IntoIter<T, N>> {
        let len = (*self).size_hint().0;
        let mut array = [const { MaybeUninit::uninit() }; N];
        if len < N {
            // SAFETY: `TrustedLen`, an unsafe trait, requires that i can get len items out of it.
            unsafe { write_back(&mut array, self, len) };
            // SAFETY: Only the last `len` elements were populated
            Err(unsafe { IntoIter::new_unchecked(array, N - len..N) })
        } else {
            // SAFETY: `TrustedLen`, an unsafe trait, requires that i can get N items out of it.
            unsafe { write_back(&mut array, self, N) };
            // SAFETY: All N items were populated
            Ok(unsafe { MaybeUninit::array_assume_init(array) })
        }
    }
}

// SAFETY: `from` must have len items, and len items must be < N.
unsafe fn write_back<T, const N: usize>(
    to: &mut [MaybeUninit<T>; N],
    from: &mut impl DoubleEndedIterator<Item = T>,
    len: usize,
) {
    let mut guard = GuardBack { array_mut: to, initialized: 0 };
    while guard.initialized < len {
        // SAFETY: caller has guaranteed, from has len items.
        let item = unsafe { from.next_back().unwrap_unchecked() };
        // SAFETY: guard.initialized < len < N
        unsafe { guard.push_unchecked(item) };
    }
    crate::mem::forget(guard);
}

/// Version of [`iter_next_chunk_back`] using a passed-in slice
/// 需要针对每个数组长度进行单态化。
///
/// 不幸的是，此循环有两个退出条件：缓冲区填满或迭代器没有更多元素，导致优化效果较差。
/// 或者迭代器缺少元素，导致优化效果较差。
#[inline]
fn iter_next_chunk_back_erased<T>(
    buffer: &mut [MaybeUninit<T>],
    iter: &mut impl DoubleEndedIterator<Item = T>,
) -> Result<(), usize> {
    // if `Iterator::next_back` panics, this guard will drop already initialized items
    let mut guard = GuardBack { array_mut: buffer, initialized: 0 };
    while guard.initialized < guard.array_mut.len() {
        let Some(item) = iter.next_back() else {
            let initialized = guard.initialized;
            mem::forget(guard);
            return Err(initialized);
        };

        // SAFETY: The loop condition ensures we have space to push the item
        unsafe { guard.push_unchecked(item) };
    }

    mem::forget(guard);
    Ok(())
}
