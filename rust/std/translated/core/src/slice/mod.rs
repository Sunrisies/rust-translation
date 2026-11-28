//! 切片的管理与操作。
//!
//! For more details see [`std::slice`].
//!
//! [`std::slice`]: ../../std/slice/index.html

#![stable(feature = "rust1", since = "1.0.0")]

use crate::clone::TrivialClone;
use crate::cmp::Ordering::{self, Equal, Greater, Less};
use crate::intrinsics::{exact_div, unchecked_sub};
use crate::marker::Destruct;
use crate::mem::{self, MaybeUninit, SizedTypeProperties};
use crate::num::NonZero;
use crate::ops::{OneSidedRange, OneSidedRangeBound, Range, RangeBounds, RangeInclusive};
use crate::panic::const_panic;
use crate::simd::{self, Simd};
use crate::ub_checks::assert_unsafe_precondition;
use crate::{fmt, hint, ptr, range, slice};

#[unstable(
    feature = "slice_internals",
    issue = "none",
    reason = "exposed from core to be reused in std; use the memchr crate"
)]
#[doc(hidden)]
/// 来自 rust-memchr 的纯 Rust memchr 实现。
pub mod memchr;

#[unstable(
    feature = "slice_internals",
    issue = "none",
    reason = "exposed from core to be reused in std;"
)]
#[doc(hidden)]
pub mod sort;

mod ascii;
mod cmp;
pub(crate) mod index;
mod iter;
mod raw;
mod rotate;
mod specialize;

#[stable(feature = "inherent_ascii_escape", since = "1.60.0")]
pub use ascii::EscapeAscii;
#[unstable(feature = "u8_split_ascii_whitespace", issue = "147878")]
pub use ascii::SplitAsciiWhitespace;
#[unstable(feature = "str_internals", issue = "none")]
#[doc(hidden)]
pub use ascii::is_ascii_simple;
#[stable(feature = "slice_get_slice", since = "1.28.0")]
pub use index::SliceIndex;
#[unstable(feature = "slice_range", issue = "76393")]
pub use index::{range, try_range};
#[stable(feature = "array_windows", since = "1.94.0")]
pub use iter::ArrayWindows;
#[stable(feature = "slice_group_by", since = "1.77.0")]
pub use iter::{ChunkBy, ChunkByMut};
#[stable(feature = "rust1", since = "1.0.0")]
pub use iter::{Chunks, ChunksMut, Windows};
#[stable(feature = "chunks_exact", since = "1.31.0")]
pub use iter::{ChunksExact, ChunksExactMut};
#[stable(feature = "rust1", since = "1.0.0")]
pub use iter::{Iter, IterMut};
#[stable(feature = "rchunks", since = "1.31.0")]
pub use iter::{RChunks, RChunksExact, RChunksExactMut, RChunksMut};
#[stable(feature = "slice_rsplit", since = "1.27.0")]
pub use iter::{RSplit, RSplitMut};
#[stable(feature = "rust1", since = "1.0.0")]
pub use iter::{RSplitN, RSplitNMut, Split, SplitMut, SplitN, SplitNMut};
#[stable(feature = "split_inclusive", since = "1.51.0")]
pub use iter::{SplitInclusive, SplitInclusiveMut};
#[stable(feature = "from_ref", since = "1.28.0")]
pub use raw::{from_mut, from_ref};
#[unstable(feature = "slice_from_ptr_range", issue = "89792")]
pub use raw::{from_mut_ptr_range, from_ptr_range};
#[stable(feature = "rust1", since = "1.0.0")]
pub use raw::{from_raw_parts, from_raw_parts_mut};

/// 计算单边范围的方向和分割点。
///
/// This is a helper function for `split_off` and `split_off_mut` that returns
/// the direction of the split (front or back) as well as the index at
/// which to split. Returns `None` if the split index would overflow.
#[inline]
fn split_point_of(range: impl OneSidedRange<usize>) -> Option<(Direction, usize)> {
    use OneSidedRangeBound::{End, EndInclusive, StartInclusive};

    Some(match range.bound() {
        (StartInclusive, i) => (Direction::Back, i),
        (End, i) => (Direction::Front, i),
        (EndInclusive, i) => (Direction::Front, i.checked_add(1)?),
    })
}

enum Direction {
    Front,
    Back,
}

impl<T> [T] {
    /// 返回切片中的元素数量。
    ///
    /// # 示例
    ///
    /// ```
    /// let a = [1, 2, 3];
    /// assert_eq!(a.len(), 3);
    /// ```
    #[lang = "slice_len_fn"]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_slice_len", since = "1.39.0")]
    #[lint::no_implicit_autorefs]
    #[inline]
    #[must_use]
    pub const fn len(&self) -> usize {
        ptr::metadata(self)
    }

    /// Returns `true` if the slice has a length of 0.
    ///
    /// # 示例
    ///
    /// ```
    /// let a = [1, 2, 3];
    /// assert!(!a.is_empty());
    ///
    /// let b: &[i32] = &[];
    /// assert!(b.is_empty());
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_slice_is_empty", since = "1.39.0")]
    #[lint::no_implicit_autorefs]
    #[inline]
    #[must_use]
    pub const fn is_empty(&self) -> bool {
        self.len() == 0
    }

    /// Returns the first element of the slice, or `None` if it is empty.
    ///
    /// # 示例
    ///
    /// ```
    /// let v = [10, 40, 30];
    /// assert_eq!(Some(&10), v.first());
    ///
    /// let w: &[i32] = &[];
    /// assert_eq!(None, w.first());
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_slice_first_last_not_mut", since = "1.56.0")]
    #[inline]
    #[must_use]
    pub const fn first(&self) -> Option<&T> {
        if let [first, ..] = self { Some(first) } else { None }
    }

    /// Returns a mutable reference to the first element of the slice, or `None` if it is empty.
    ///
    /// # 示例
    ///
    /// ```
    /// let x = &mut [0, 1, 2];
    ///
    /// if let Some(first) = x.first_mut() {
    ///     *first = 5;
    /// }
    /// assert_eq!(x, &[5, 1, 2]);
    ///
    /// let y: &mut [i32] = &mut [];
    /// assert_eq!(None, y.first_mut());
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_slice_first_last", since = "1.83.0")]
    #[inline]
    #[must_use]
    pub const fn first_mut(&mut self) -> Option<&mut T> {
        if let [first, ..] = self { Some(first) } else { None }
    }

    /// Returns the first and all the rest of the elements of the slice, or `None` if it is empty.
    ///
    /// # 示例
    ///
    /// ```
    /// let many = &[0, 1, 2];
    /// assert_eq!(many.split_first(), Some((&0, &[1, 2][..])));
    ///
    /// let one = &[42];
    /// assert_eq!(one.split_first(), Some((&42, &[][..])));
    ///
    /// let none: &[i32] = &[];
    /// assert_eq!(none.split_first(), None);
    /// ```
    #[stable(feature = "slice_splits", since = "1.5.0")]
    #[rustc_const_stable(feature = "const_slice_first_last_not_mut", since = "1.56.0")]
    #[inline]
    #[must_use]
    pub const fn split_first(&self) -> Option<(&T, &[T])> {
        if let [first, tail @ ..] = self { Some((first, tail)) } else { None }
    }

    /// Returns the first and all the rest of the elements of the slice, or `None` if it is empty.
    ///
    /// # 示例
    ///
    /// ```
    /// let many = &mut [0, 1, 2];
    ///
    /// if let Some((first, rest)) = many.split_first_mut() {
    ///     *first = 3;
    ///     rest[0] = 4;
    ///     rest[1] = 5;
    /// }
    /// assert_eq!(many, &[3, 4, 5]);
    ///
    /// let mut one = [42];
    /// let (first, rest) = one.split_first_mut().unwrap();
    /// assert_eq!(*first, 42);
    /// assert!(rest.is_empty());
    ///
    /// let none: &mut [i32] = &mut [];
    /// assert!(none.split_first_mut().is_none());
    /// ```
    #[stable(feature = "slice_splits", since = "1.5.0")]
    #[rustc_const_stable(feature = "const_slice_first_last", since = "1.83.0")]
    #[inline]
    #[must_use]
    pub const fn split_first_mut(&mut self) -> Option<(&mut T, &mut [T])> {
        if let [first, tail @ ..] = self { Some((first, tail)) } else { None }
    }

    /// Returns the last and all the rest of the elements of the slice, or `None` if it is empty.
    ///
    /// # 示例
    ///
    /// ```
    /// let many = &[0, 1, 2];
    /// assert_eq!(many.split_last(), Some((&2, &[0, 1][..])));
    ///
    /// let one = &[42];
    /// assert_eq!(one.split_last(), Some((&42, &[][..])));
    ///
    /// let none: &[i32] = &[];
    /// assert_eq!(none.split_last(), None);
    /// ```
    #[stable(feature = "slice_splits", since = "1.5.0")]
    #[rustc_const_stable(feature = "const_slice_first_last_not_mut", since = "1.56.0")]
    #[inline]
    #[must_use]
    pub const fn split_last(&self) -> Option<(&T, &[T])> {
        if let [init @ .., last] = self { Some((last, init)) } else { None }
    }

    /// Returns the last and all the rest of the elements of the slice, or `None` if it is empty.
    ///
    /// # 示例
    ///
    /// ```
    /// let many = &mut [0, 1, 2];
    ///
    /// if let Some((last, rest)) = many.split_last_mut() {
    ///     *last = 3;
    ///     rest[0] = 4;
    ///     rest[1] = 5;
    /// }
    /// assert_eq!(many, &[4, 5, 3]);
    ///
    /// let mut one = [42];
    /// let (last, rest) = one.split_last_mut().unwrap();
    /// assert_eq!(*last, 42);
    /// assert!(rest.is_empty());
    ///
    /// let none: &mut [i32] = &mut [];
    /// assert!(none.split_last_mut().is_none());
    /// ```
    #[stable(feature = "slice_splits", since = "1.5.0")]
    #[rustc_const_stable(feature = "const_slice_first_last", since = "1.83.0")]
    #[inline]
    #[must_use]
    pub const fn split_last_mut(&mut self) -> Option<(&mut T, &mut [T])> {
        if let [init @ .., last] = self { Some((last, init)) } else { None }
    }

    /// Returns the last element of the slice, or `None` if it is empty.
    ///
    /// # 示例
    ///
    /// ```
    /// let v = [10, 40, 30];
    /// assert_eq!(Some(&30), v.last());
    ///
    /// let w: &[i32] = &[];
    /// assert_eq!(None, w.last());
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_slice_first_last_not_mut", since = "1.56.0")]
    #[inline]
    #[must_use]
    pub const fn last(&self) -> Option<&T> {
        if let [.., last] = self { Some(last) } else { None }
    }

    /// Returns a mutable reference to the last item in the slice, or `None` if it is empty.
    ///
    /// # 示例
    ///
    /// ```
    /// let x = &mut [0, 1, 2];
    ///
    /// if let Some(last) = x.last_mut() {
    ///     *last = 10;
    /// }
    /// assert_eq!(x, &[0, 1, 10]);
    ///
    /// let y: &mut [i32] = &mut [];
    /// assert_eq!(None, y.last_mut());
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_slice_first_last", since = "1.83.0")]
    #[inline]
    #[must_use]
    pub const fn last_mut(&mut self) -> Option<&mut T> {
        if let [.., last] = self { Some(last) } else { None }
    }

    /// Returns an array reference to the first `N` items in the slice.
    ///
    /// If the slice is not at least `N` in length, this will return `None`.
    ///
    /// # 示例
    ///
    /// ```
    /// let u = [10, 40, 30];
    /// assert_eq!(Some(&[10, 40]), u.first_chunk::<2>());
    ///
    /// let v: &[i32] = &[10];
    /// assert_eq!(None, v.first_chunk::<2>());
    ///
    /// let w: &[i32] = &[];
    /// assert_eq!(Some(&[]), w.first_chunk::<0>());
    /// ```
    #[inline]
    #[stable(feature = "slice_first_last_chunk", since = "1.77.0")]
    #[rustc_const_stable(feature = "slice_first_last_chunk", since = "1.77.0")]
    pub const fn first_chunk<const N: usize>(&self) -> Option<&[T; N]> {
        if self.len() < N {
            None
        } else {
            // SAFETY: We explicitly check for the correct number of elements,
            //   and do not let the reference outlive the slice.
            Some(unsafe { &*(self.as_ptr().cast_array()) })
        }
    }

    /// Returns a mutable array reference to the first `N` items in the slice.
    ///
    /// If the slice is not at least `N` in length, this will return `None`.
    ///
    /// # 示例
    ///
    /// ```
    /// let x = &mut [0, 1, 2];
    ///
    /// if let Some(first) = x.first_chunk_mut::<2>() {
    ///     first[0] = 5;
    ///     first[1] = 4;
    /// }
    /// assert_eq!(x, &[5, 4, 2]);
    ///
    /// assert_eq!(None, x.first_chunk_mut::<4>());
    /// ```
    #[inline]
    #[stable(feature = "slice_first_last_chunk", since = "1.77.0")]
    #[rustc_const_stable(feature = "const_slice_first_last_chunk", since = "1.83.0")]
    pub const fn first_chunk_mut<const N: usize>(&mut self) -> Option<&mut [T; N]> {
        if self.len() < N {
            None
        } else {
            // SAFETY: We explicitly check for the correct number of elements,
            //   do not let the reference outlive the slice,
            //   and require exclusive access to the entire slice to mutate the chunk.
            Some(unsafe { &mut *(self.as_mut_ptr().cast_array()) })
        }
    }

    /// Returns an array reference to the first `N` items in the slice and the remaining slice.
    ///
    /// If the slice is not at least `N` in length, this will return `None`.
    ///
    /// # 示例
    ///
    /// ```
    /// let x = &[0, 1, 2];
    ///
    /// if let Some((first, elements)) = x.split_first_chunk::<2>() {
    ///     assert_eq!(first, &[0, 1]);
    ///     assert_eq!(elements, &[2]);
    /// }
    ///
    /// assert_eq!(None, x.split_first_chunk::<4>());
    /// ```
    #[inline]
    #[stable(feature = "slice_first_last_chunk", since = "1.77.0")]
    #[rustc_const_stable(feature = "slice_first_last_chunk", since = "1.77.0")]
    pub const fn split_first_chunk<const N: usize>(&self) -> Option<(&[T; N], &[T])> {
        let Some((first, tail)) = self.split_at_checked(N) else { return None };

        // SAFETY: We explicitly check for the correct number of elements,
        //   and do not let the references outlive the slice.
        Some((unsafe { &*(first.as_ptr().cast_array()) }, tail))
    }

    /// Returns a mutable array reference to the first `N` items in the slice and the remaining
    /// slice.
    ///
    /// If the slice is not at least `N` in length, this will return `None`.
    ///
    /// # 示例
    ///
    /// ```
    /// let x = &mut [0, 1, 2];
    ///
    /// if let Some((first, elements)) = x.split_first_chunk_mut::<2>() {
    ///     first[0] = 3;
    ///     first[1] = 4;
    ///     elements[0] = 5;
    /// }
    /// assert_eq!(x, &[3, 4, 5]);
    ///
    /// assert_eq!(None, x.split_first_chunk_mut::<4>());
    /// ```
    #[inline]
    #[stable(feature = "slice_first_last_chunk", since = "1.77.0")]
    #[rustc_const_stable(feature = "const_slice_first_last_chunk", since = "1.83.0")]
    pub const fn split_first_chunk_mut<const N: usize>(
        &mut self,
    ) -> Option<(&mut [T; N], &mut [T])> {
        let Some((first, tail)) = self.split_at_mut_checked(N) else { return None };

        // SAFETY: We explicitly check for the correct number of elements,
        //   do not let the reference outlive the slice,
        //   and enforce exclusive mutability of the chunk by the split.
        Some((unsafe { &mut *(first.as_mut_ptr().cast_array()) }, tail))
    }

    /// Returns an array reference to the last `N` items in the slice and the remaining slice.
    ///
    /// If the slice is not at least `N` in length, this will return `None`.
    ///
    /// # 示例
    ///
    /// ```
    /// let x = &[0, 1, 2];
    ///
    /// if let Some((elements, last)) = x.split_last_chunk::<2>() {
    ///     assert_eq!(elements, &[0]);
    ///     assert_eq!(last, &[1, 2]);
    /// }
    ///
    /// assert_eq!(None, x.split_last_chunk::<4>());
    /// ```
    #[inline]
    #[stable(feature = "slice_first_last_chunk", since = "1.77.0")]
    #[rustc_const_stable(feature = "slice_first_last_chunk", since = "1.77.0")]
    pub const fn split_last_chunk<const N: usize>(&self) -> Option<(&[T], &[T; N])> {
        let Some(index) = self.len().checked_sub(N) else { return None };
        let (init, last) = self.split_at(index);

        // SAFETY: We explicitly check for the correct number of elements,
        //   and do not let the references outlive the slice.
        Some((init, unsafe { &*(last.as_ptr().cast_array()) }))
    }

    /// Returns a mutable array reference to the last `N` items in the slice and the remaining
    /// slice.
    ///
    /// If the slice is not at least `N` in length, this will return `None`.
    ///
    /// # 示例
    ///
    /// ```
    /// let x = &mut [0, 1, 2];
    ///
    /// if let Some((elements, last)) = x.split_last_chunk_mut::<2>() {
    ///     last[0] = 3;
    ///     last[1] = 4;
    ///     elements[0] = 5;
    /// }
    /// assert_eq!(x, &[5, 3, 4]);
    ///
    /// assert_eq!(None, x.split_last_chunk_mut::<4>());
    /// ```
    #[inline]
    #[stable(feature = "slice_first_last_chunk", since = "1.77.0")]
    #[rustc_const_stable(feature = "const_slice_first_last_chunk", since = "1.83.0")]
    pub const fn split_last_chunk_mut<const N: usize>(
        &mut self,
    ) -> Option<(&mut [T], &mut [T; N])> {
        let Some(index) = self.len().checked_sub(N) else { return None };
        let (init, last) = self.split_at_mut(index);

        // SAFETY: We explicitly check for the correct number of elements,
        //   do not let the reference outlive the slice,
        //   and enforce exclusive mutability of the chunk by the split.
        Some((init, unsafe { &mut *(last.as_mut_ptr().cast_array()) }))
    }

    /// Returns an array reference to the last `N` items in the slice.
    ///
    /// If the slice is not at least `N` in length, this will return `None`.
    ///
    /// # 示例
    ///
    /// ```
    /// let u = [10, 40, 30];
    /// assert_eq!(Some(&[40, 30]), u.last_chunk::<2>());
    ///
    /// let v: &[i32] = &[10];
    /// assert_eq!(None, v.last_chunk::<2>());
    ///
    /// let w: &[i32] = &[];
    /// assert_eq!(Some(&[]), w.last_chunk::<0>());
    /// ```
    #[inline]
    #[stable(feature = "slice_first_last_chunk", since = "1.77.0")]
    #[rustc_const_stable(feature = "const_slice_last_chunk", since = "1.80.0")]
    pub const fn last_chunk<const N: usize>(&self) -> Option<&[T; N]> {
        // FIXME(const-hack): Without const traits, we need this instead of `get`.
        let Some(index) = self.len().checked_sub(N) else { return None };
        let (_, last) = self.split_at(index);

        // SAFETY: We explicitly check for the correct number of elements,
        //   and do not let the references outlive the slice.
        Some(unsafe { &*(last.as_ptr().cast_array()) })
    }

    /// Returns a mutable array reference to the last `N` items in the slice.
    ///
    /// If the slice is not at least `N` in length, this will return `None`.
    ///
    /// # 示例
    ///
    /// ```
    /// let x = &mut [0, 1, 2];
    ///
    /// if let Some(last) = x.last_chunk_mut::<2>() {
    ///     last[0] = 10;
    ///     last[1] = 20;
    /// }
    /// assert_eq!(x, &[0, 10, 20]);
    ///
    /// assert_eq!(None, x.last_chunk_mut::<4>());
    /// ```
    #[inline]
    #[stable(feature = "slice_first_last_chunk", since = "1.77.0")]
    #[rustc_const_stable(feature = "const_slice_first_last_chunk", since = "1.83.0")]
    pub const fn last_chunk_mut<const N: usize>(&mut self) -> Option<&mut [T; N]> {
        // FIXME(const-hack): Without const traits, we need this instead of `get`.
        let Some(index) = self.len().checked_sub(N) else { return None };
        let (_, last) = self.split_at_mut(index);

        // SAFETY: We explicitly check for the correct number of elements,
        //   do not let the reference outlive the slice,
        //   and require exclusive access to the entire slice to mutate the chunk.
        Some(unsafe { &mut *(last.as_mut_ptr().cast_array()) })
    }

    /// 根据索引的类型返回对元素或子切片的引用。
    /// 索引。
    ///
    /// - If given a position, returns a reference to the element at that
    ///   position or `None` if out of bounds.
    /// - 如果提供范围，则返回该范围对应的子切片。
    ///   or `None` if out of bounds.
    ///
    /// # 示例
    ///
    /// ```
    /// let v = [10, 40, 30];
    /// assert_eq!(Some(&40), v.get(1));
    /// assert_eq!(Some(&[10, 40][..]), v.get(0..2));
    /// assert_eq!(None, v.get(3));
    /// assert_eq!(None, v.get(0..4));
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[lint::no_implicit_autorefs]
    #[inline]
    #[must_use]
    #[rustc_const_unstable(feature = "const_index", issue = "143775")]
    pub const fn get<I>(&self, index: I) -> Option<&I::Output>
    where
        I: [const] SliceIndex<Self>,
    {
        index.get(self)
    }

    /// Returns a mutable reference to an element or subslice depending on the
    /// type of index (see [`get`]) or `None` if the index is out of bounds.
    ///
    /// [`get`]: slice::get
    ///
    /// # 示例
    ///
    /// ```
    /// let x = &mut [0, 1, 2];
    ///
    /// if let Some(elem) = x.get_mut(1) {
    ///     *elem = 42;
    /// }
    /// assert_eq!(x, &[0, 42, 2]);
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[lint::no_implicit_autorefs]
    #[inline]
    #[must_use]
    #[rustc_const_unstable(feature = "const_index", issue = "143775")]
    #[rustc_no_writable]
    pub const fn get_mut<I>(&mut self, index: I) -> Option<&mut I::Output>
    where
        I: [const] SliceIndex<Self>,
    {
        index.get_mut(self)
    }

    /// 返回对元素或子切片的引用，无需进行边界检查。
    /// checking.
    ///
    /// For a safe alternative see [`get`].
    ///
    /// # 安全性
    ///
    /// 使用超出范围的索引调用此方法属于 *[未定义行为]*。
    /// 即使返回的引用未被使用也是如此。
    ///
    /// You can think of this like `.get(index).unwrap_unchecked()`.  It's UB
    /// to call `.get_unchecked(len)`, even if you immediately convert to a
    /// pointer.  And it's UB to call `.get_unchecked(..len + 1)`,
    /// `.get_unchecked(..=len)`, or similar.
    ///
    /// [`get`]: slice::get
    /// [undefined behavior]: https://doc.rust-lang.org/reference/behavior-considered-undefined.html
    ///
    /// # 示例
    ///
    /// ```
    /// let x = &[1, 2, 4];
    ///
    /// unsafe {
    ///     assert_eq!(x.get_unchecked(1), &2);
    /// }
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[lint::no_implicit_autorefs]
    #[inline]
    #[must_use]
    #[track_caller]
    #[rustc_const_unstable(feature = "const_index", issue = "143775")]
    pub const unsafe fn get_unchecked<I>(&self, index: I) -> &I::Output
    where
        I: [const] SliceIndex<Self>,
    {
        // SAFETY: the caller must uphold most of the safety requirements for `get_unchecked`;
        // the slice is dereferenceable because `self` is a safe reference.
        // The returned pointer is safe because impls of `SliceIndex` have to guarantee that it is.
        unsafe { &*index.get_unchecked(self) }
    }

    /// 返回对元素或子切片的可修改引用，无需进行边界检查。
    /// bounds checking.
    ///
    /// For a safe alternative see [`get_mut`].
    ///
    /// # 使用超出范围的索引调用此方法属于 *[未定义行为]*。
    ///
    /// 即使返回的引用未被使用也是如此。
    /// 未定义行为（UB）。
    ///
    /// You can think of this like `.get_mut(index).unwrap_unchecked()`.  It's
    /// UB to call `.get_unchecked_mut(len)`, even if you immediately convert
    /// to a pointer.  And it's UB to call `.get_unchecked_mut(..len + 1)`,
    /// `.get_unchecked_mut(..=len)`, or similar.
    ///
    /// [`get_mut`]: slice::get_mut
    /// [undefined behavior]: https://doc.rust-lang.org/reference/behavior-considered-undefined.html
    ///
    /// # 示例
    ///
    /// ```
    /// let x = &mut [1, 2, 4];
    ///
    /// unsafe {
    ///     let elem = x.get_unchecked_mut(1);
    ///     *elem = 13;
    /// }
    /// assert_eq!(x, &[1, 13, 4]);
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[lint::no_implicit_autorefs]
    #[inline]
    #[must_use]
    #[track_caller]
    #[rustc_const_unstable(feature = "const_index", issue = "143775")]
    #[rustc_no_writable]
    pub const unsafe fn get_unchecked_mut<I>(&mut self, index: I) -> &mut I::Output
    where
        I: [const] SliceIndex<Self>,
    {
        // SAFETY: the caller must uphold the safety requirements for `get_unchecked_mut`;
        // the slice is dereferenceable because `self` is a safe reference.
        // The returned pointer is safe because impls of `SliceIndex` have to guarantee that it is.
        unsafe { &mut *index.get_unchecked_mut(self) }
    }

    /// 返回指向切片缓冲区的原始指针。
    ///
    /// 调用者必须确保切片在该函数返回的指针之后存在，否则会导致悬空指针。
    /// function returns, or else it will end up dangling.
    ///
    /// 修改此切片所引用的容器可能会导致其缓冲区重新分配，从而使所有指向它的指针失效。
    /// is never written to (except inside an `UnsafeCell`) using this pointer or any pointer
    /// derived from it. If you need to mutate the contents of the slice, use [`as_mut_ptr`].
    ///
    /// 调用者必须确保切片在指针之后存在，否则会导致悬空指针。
    /// 未定义行为（UB）。
    ///
    /// # Examples
    ///
    /// ```
    /// let x = &[1, 2, 4];
    /// let x_ptr = x.as_ptr();
    ///
    /// unsafe {
    ///     for i in 0..x.len() {
    ///         assert_eq!(x.get_unchecked(i), &*x_ptr.add(i));
    ///     }
    /// }
    /// ```
    ///
    /// [`as_mut_ptr`]: slice::as_mut_ptr
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_slice_as_ptr", since = "1.32.0")]
    #[inline(always)]
    #[must_use]
    #[lint::as_ptr]
    #[lint::never_returns_null_ptr]
    pub const fn as_ptr(&self) -> *const T {
        self as *const [T] as *const T
    }

    /// Returns an unsafe mutable pointer to the slice's buffer.
    ///
    /// The caller must ensure that the slice outlives the pointer this
    /// 如果函数不返回结果，则会导致悬空状态。
    ///
    /// 修改此切片所引用的容器可能会使其缓冲区
    /// 被重新分配，这也会使指向它的任何指针失效。
    ///
    /// # 示例
    ///
    /// ```
    /// let x = &mut [1, 2, 4];
    /// let x_ptr = x.as_mut_ptr();
    ///
    /// unsafe {
    ///     for i in 0..x.len() {
    ///         *x_ptr.add(i) += 2;
    ///     }
    /// }
    /// assert_eq!(x, &[3, 4, 6]);
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_ptr_offset", since = "1.61.0")]
    #[lint::as_ptr]
    #[lint::never_returns_null_ptr]
    #[inline(always)]
    #[must_use]
    #[rustc_no_writable]
    pub const fn as_mut_ptr(&mut self) -> *mut T {
        self as *mut [T] as *mut T
    }

    /// 返回跨越该切片的两个原始指针。
    ///
    /// 返回的区间是半开的，这意味着结束指针
    /// 指向切片最后一个元素之后。这样，一个空的
    /// 切片由两个相等的指针表示，两个指针之间的差值
    /// 代表切片的大小。
    ///
    /// See [`as_ptr`] for warnings on using these pointers. The end pointer
    /// 需要特别小心，因为它不指向切片中的有效元素。
    /// 此函数适用于与外部接口交互，这些接口
    ///
    /// 使用两个指针来引用内存中的一段元素，这在 C++ 中很常见。
    /// 也可以用来检查指向元素的指针是否指向该切片的某个元素：
    /// 返回跨越该切片的两个不安全的可变指针。
    ///
    /// 返回的区间是半开的，这意味着结束指针
    /// 指向切片最后一个元素之后。这样，一个空的
    ///
    /// ```
    /// let a = [1, 2, 3];
    /// let x = &a[1] as *const _;
    /// let y = &5 as *const _;
    ///
    /// assert!(a.as_ptr_range().contains(&x));
    /// assert!(!a.as_ptr_range().contains(&y));
    /// ```
    ///
    /// [`as_ptr`]: slice::as_ptr
    #[stable(feature = "slice_ptr_range", since = "1.48.0")]
    #[rustc_const_stable(feature = "const_ptr_offset", since = "1.61.0")]
    #[inline]
    #[must_use]
    pub const fn as_ptr_range(&self) -> Range<*const T> {
        let start = self.as_ptr();
        // SAFETY: The `add` here is safe, because:
        //
        //   - Both pointers are part of the same object, as pointing directly
        //     past the object also counts.
        //
        //   - The size of the slice is never larger than `isize::MAX` bytes, as
        //     noted here:
        //       - https://github.com/rust-lang/unsafe-code-guidelines/issues/102#issuecomment-473340447
        //       - https://doc.rust-lang.org/reference/behavior-considered-undefined.html
        //       - https://doc.rust-lang.org/core/slice/fn.from_raw_parts.html#safety
        //     (This doesn't seem normative yet, but the very same assumption is
        //     made in many places, including the Index implementation of slices.)
        //
        //   - There is no wrapping around involved, as slices do not wrap past
        //     the end of the address space.
        //
        // See the documentation of [`pointer::add`].
        let end = unsafe { start.add(self.len()) };
        start..end
    }

    /// 切片由两个相等的指针表示，两个指针之间的差值
    ///
    /// 代表切片的大小。
    /// points *one past* the last element of the slice. This way, an empty
    /// 指针需要特别小心，因为它不指向切片中的有效元素。
    /// 此函数适用于与外部接口交互，这些接口
    ///
    /// See [`as_mut_ptr`] for warnings on using these pointers. The end
    /// 获取对底层数组的引用。
    /// in the slice.
    ///
    /// 获取对切片底层数组的可变引用。
    /// use two pointers to refer to a range of elements in memory, as is
    /// 交换切片中的两个元素。
    ///
    /// [`as_mut_ptr`]: slice::as_mut_ptr
    #[stable(feature = "slice_ptr_range", since = "1.48.0")]
    #[rustc_const_stable(feature = "const_ptr_offset", since = "1.61.0")]
    #[inline]
    #[must_use]
    pub const fn as_mut_ptr_range(&mut self) -> Range<*mut T> {
        let start = self.as_mut_ptr();
        // SAFETY: See as_ptr_range() above for why `add` here is safe.
        let end = unsafe { start.add(self.len()) };
        start..end
    }

    /// Gets a reference to the underlying array.
    ///
    /// If `N` is not exactly equal to the length of `self`, then this method returns `None`.
    #[stable(feature = "core_slice_as_array", since = "1.93.0")]
    #[rustc_const_stable(feature = "core_slice_as_array", since = "1.93.0")]
    #[inline]
    #[must_use]
    pub const fn as_array<const N: usize>(&self) -> Option<&[T; N]> {
        if self.len() == N {
            let ptr = self.as_ptr().cast_array();

            // SAFETY: The underlying array of a slice can be reinterpreted as an actual array `[T; N]` if `N` is not greater than the slice's length.
            let me = unsafe { &*ptr };
            Some(me)
        } else {
            None
        }
    }

    /// * a - 第一个元素的索引
    ///
    /// If `N` is not exactly equal to the length of `self`, then this method returns `None`.
    #[stable(feature = "core_slice_as_array", since = "1.93.0")]
    #[rustc_const_stable(feature = "core_slice_as_array", since = "1.93.0")]
    #[inline]
    #[must_use]
    pub const fn as_mut_array<const N: usize>(&mut self) -> Option<&mut [T; N]> {
        if self.len() == N {
            let ptr = self.as_mut_ptr().cast_array();

            // SAFETY: The underlying array of a slice can be reinterpreted as an actual array `[T; N]` if `N` is not greater than the slice's length.
            let me = unsafe { &mut *ptr };
            Some(me)
        } else {
            None
        }
    }

    /// # 异常
    ///
    /// If `a` equals `b`, it's guaranteed that elements won't change value.
    ///
    /// # 示例
    ///
    /// * a - 第一个元素的索引
    /// * b - 第二个元素的索引
    ///
    /// # Panics
    ///
    /// Panics if `a` or `b` are out of bounds.
    ///
    /// # Examples
    ///
    /// ```
    /// let mut v = ["a", "b", "c", "d", "e"];
    /// v.swap(2, 4);
    /// assert!(v == ["a", "b", "e", "d", "c"]);
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_swap", since = "1.85.0")]
    #[inline]
    #[track_caller]
    pub const fn swap(&mut self, a: usize, b: usize) {
        // Bounds checks that panic exactly like indexing would.
        let _ = &self[a];
        let _ = &self[b];
        // SAFETY: `a` and `b` were checked to be in bounds above.
        unsafe {
            self.swap_unchecked(a, b);
        }
    }

    /// Swaps two elements in the slice, without doing bounds checking.
    ///
    /// For a safe alternative see [`swap`].
    ///
    /// # Arguments
    ///
    /// * a - The index of the first element
    /// * b - The index of the second element
    ///
    /// # 安全性
    ///
    /// 使用超出边界的索引调用此方法属于 *[未定义行为]*。
    /// The caller has to ensure that `a < self.len()` and `b < self.len()`.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(slice_swap_unchecked)]
    ///
    /// let mut v = ["a", "b", "c", "d"];
    /// // SAFETY: we know that 1 and 3 are both indices of the slice
    /// unsafe { v.swap_unchecked(1, 3) };
    /// assert!(v == ["a", "d", "c", "b"]);
    /// ```
    ///
    /// [`swap`]: slice::swap
    /// [undefined behavior]: https://doc.rust-lang.org/reference/behavior-considered-undefined.html
    #[unstable(feature = "slice_swap_unchecked", issue = "88539")]
    #[track_caller]
    pub const unsafe fn swap_unchecked(&mut self, a: usize, b: usize) {
        assert_unsafe_precondition!(
            check_library_ub,
            "slice::swap_unchecked requires that the indices are within the slice",
            (
                len: usize = self.len(),
                a: usize = a,
                b: usize = b,
            ) => a < len && b < len,
        );

        let ptr = self.as_mut_ptr();
        // SAFETY: caller has to guarantee that `a < self.len()` and `b < self.len()`
        unsafe {
            ptr::swap(ptr.add(a), ptr.add(b));
        }
    }

    /// 原地反转切片中元素的顺序。
    ///
    /// # 示例
    ///
    /// ```
    /// let mut v = [1, 2, 3];
    /// v.reverse();
    /// assert!(v == [3, 2, 1]);
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_slice_reverse", since = "1.90.0")]
    #[inline]
    pub const fn reverse(&mut self) {
        let half_len = self.len() / 2;
        let Range { start, end } = self.as_mut_ptr_range();

        // These slices will skip the middle item for an odd length,
        // since that one doesn't need to move.
        let (front_half, back_half) =
            // SAFETY: Both are subparts of the original slice, so the memory
            // range is valid, and they don't overlap because they're each only
            // half (or less) of the original slice.
            unsafe {
                (
                    slice::from_raw_parts_mut(start, half_len),
                    slice::from_raw_parts_mut(end.sub(half_len), half_len),
                )
            };

        // Introducing a function boundary here means that the two halves
        // get `noalias` markers, allowing better optimization as LLVM
        // knows that they're disjoint, unlike in the original slice.
        revswap(front_half, back_half, half_len);

        #[inline]
        const fn revswap<T>(a: &mut [T], b: &mut [T], n: usize) {
            debug_assert!(a.len() == n);
            debug_assert!(b.len() == n);

            // Because this function is first compiled in isolation,
            // this check tells LLVM that the indexing below is
            // in-bounds. Then after inlining -- once the actual
            // lengths of the slices are known -- it's removed.
            // FIXME(const_trait_impl) replace with let (a, b) = (&mut a[..n], &mut b[..n]);
            let (a, _) = a.split_at_mut(n);
            let (b, _) = b.split_at_mut(n);

            let mut i = 0;
            while i < n {
                mem::swap(&mut a[i], &mut b[n - 1 - i]);
                i += 1;
            }
        }
    }

    /// 返回一个针对切片的迭代器。
    ///
    /// 迭代器会输出从开始到结束的所有元素。
    ///
    /// # 示例
    ///
    /// ```
    /// let x = &[1, 2, 4];
    /// let mut iterator = x.iter();
    ///
    /// assert_eq!(iterator.next(), Some(&1));
    /// assert_eq!(iterator.next(), Some(&2));
    /// assert_eq!(iterator.next(), Some(&4));
    /// assert_eq!(iterator.next(), None);
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_unstable(feature = "const_slice_make_iter", issue = "137737")]
    #[inline]
    #[rustc_diagnostic_item = "slice_iter"]
    pub const fn iter(&self) -> Iter<'_, T> {
        Iter::new(self)
    }

    /// 返回一个允许修改每个值的迭代器。
    ///
    /// 迭代器会输出从开始到结束的所有元素。
    ///
    /// # 示例
    ///
    /// ```
    /// let x = &mut [1, 2, 4];
    /// for elem in x.iter_mut() {
    ///     *elem += 2;
    /// }
    /// assert_eq!(x, &[3, 4, 6]);
    /// ```
    #[rustc_const_unstable(feature = "const_slice_make_iter", issue = "137737")]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    pub const fn iter_mut(&mut self) -> IterMut<'_, T> {
        IterMut::new(self)
    }

    /// Returns an iterator over all contiguous windows of length
    /// `size`. The windows overlap. If the slice is shorter than
    /// `size`, the iterator returns no values.
    ///
    /// # 恐慌
    ///
    /// Panics if `size` is zero.
    ///
    /// # 示例
    ///
    /// ```
    /// let slice = ['l', 'o', 'r', 'e', 'm'];
    /// let mut iter = slice.windows(3);
    /// assert_eq!(iter.next().unwrap(), &['l', 'o', 'r']);
    /// assert_eq!(iter.next().unwrap(), &['o', 'r', 'e']);
    /// assert_eq!(iter.next().unwrap(), &['r', 'e', 'm']);
    /// assert!(iter.next().is_none());
    /// ```
    ///
    /// If the slice is shorter than `size`:
    ///
    /// ```
    /// let slice = ['f', 'o', 'o'];
    /// let mut iter = slice.windows(4);
    /// assert!(iter.next().is_none());
    /// ```
    ///
    /// 因为 [Iterator] trait 无法表示所需的生命周期，
    /// there is no `windows_mut` analog to `windows`;
    /// `[0,1,2].windows_mut(2).collect()` would violate [the rules of references]
    /// （尽管可以使用 [LendingIterator] 类似物）。有时可以结合使用
    /// [`Cell::as_slice_of_cells`](crate::cell::Cell::as_slice_of_cells) in
    /// conjunction with `windows` instead:
    ///
    /// [the rules of references]: https://doc.rust-lang.org/book/ch04-02-references-and-borrowing.html#the-rules-of-references
    /// [LendingIterator]: https://blog.rust-lang.org/2022/10/28/gats-stabilization.html
    /// ```
    /// use std::cell::Cell;
    ///
    /// let mut array = ['R', 'u', 's', 't', ' ', '2', '0', '1', '5'];
    /// let slice = &mut array[..];
    /// let slice_of_cells: &[Cell<char>] = Cell::from_mut(slice).as_slice_of_cells();
    /// for w in slice_of_cells.windows(3) {
    ///     Cell::swap(&w[0], &w[2]);
    /// }
    /// assert_eq!(array, ['s', 't', ' ', '2', '0', '1', '5', 'u', 'R']);
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_unstable(feature = "const_slice_make_iter", issue = "137737")]
    #[inline]
    #[track_caller]
    pub const fn windows(&self, size: usize) -> Windows<'_, T> {
        let size = NonZero::new(size).expect("window size must be non-zero");
        Windows::new(self, size)
    }

    /// Returns an iterator over `chunk_size` elements of the slice at a time, starting at the
    /// 开始处开始。
    ///
    /// The chunks are slices and do not overlap. If `chunk_size` does not divide the length of the
    /// slice, then the last chunk will not have length `chunk_size`.
    ///
    /// See [`chunks_exact`] for a variant of this iterator that returns chunks of always exactly
    /// `chunk_size` elements, and [`rchunks`] for the same iterator but starting at the end of the
    /// # 恐慌
    ///
    /// If your `chunk_size` is a constant, consider using [`as_chunks`] instead, which will
    /// 提供指向恰好该长度数组的引用，而不是切片。
    ///
    /// # 恐慌
    ///
    /// Panics if `chunk_size` is zero.
    ///
    /// # 示例
    ///
    /// ```
    /// let slice = ['l', 'o', 'r', 'e', 'm'];
    /// let mut iter = slice.chunks(2);
    /// assert_eq!(iter.next().unwrap(), &['l', 'o']);
    /// assert_eq!(iter.next().unwrap(), &['r', 'e']);
    /// assert_eq!(iter.next().unwrap(), &['m']);
    /// assert!(iter.next().is_none());
    /// ```
    ///
    /// [`chunks_exact`]: slice::chunks_exact
    /// [`rchunks`]: slice::rchunks
    /// [`as_chunks`]: slice::as_chunks
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_unstable(feature = "const_slice_make_iter", issue = "137737")]
    #[inline]
    #[track_caller]
    pub const fn chunks(&self, chunk_size: usize) -> Chunks<'_, T> {
        assert!(chunk_size != 0, "chunk size must be non-zero");
        Chunks::new(self, chunk_size)
    }

    /// Returns an iterator over `chunk_size` elements of the slice at a time, starting at the
    /// 开始处开始。
    ///
    /// The chunks are mutable slices, and do not overlap. If `chunk_size` does not divide the
    /// length of the slice, then the last chunk will not have length `chunk_size`.
    ///
    /// See [`chunks_exact_mut`] for a variant of this iterator that returns chunks of always
    /// exactly `chunk_size` elements, and [`rchunks_mut`] for the same iterator but starting at
    /// 切片的结束处开始。
    ///
    /// If your `chunk_size` is a constant, consider using [`as_chunks_mut`] instead, which will
    /// 提供指向恰好该长度数组的引用，而不是切片。
    ///
    /// # 恐慌
    ///
    /// Panics if `chunk_size` is zero.
    ///
    /// # 示例
    ///
    /// ```
    /// let v = &mut [0, 0, 0, 0, 0];
    /// let mut count = 1;
    ///
    /// for chunk in v.chunks_mut(2) {
    ///     for elem in chunk.iter_mut() {
    ///         *elem += count;
    ///     }
    ///     count += 1;
    /// }
    /// assert_eq!(v, &[1, 1, 2, 2, 3]);
    /// ```
    ///
    /// [`chunks_exact_mut`]: slice::chunks_exact_mut
    /// [`rchunks_mut`]: slice::rchunks_mut
    /// [`as_chunks_mut`]: slice::as_chunks_mut
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_unstable(feature = "const_slice_make_iter", issue = "137737")]
    #[inline]
    #[track_caller]
    pub const fn chunks_mut(&mut self, chunk_size: usize) -> ChunksMut<'_, T> {
        assert!(chunk_size != 0, "chunk size must be non-zero");
        ChunksMut::new(self, chunk_size)
    }

    /// Returns an iterator over `chunk_size` elements of the slice at a time, starting at the
    /// 切片的起始位置。
    ///
    /// The chunks are slices and do not overlap. If `chunk_size` does not divide the length of the
    /// slice, then the last up to `chunk_size-1` elements will be omitted and can be retrieved
    /// from the `remainder` function of the iterator.
    ///
    /// Due to each chunk having exactly `chunk_size` elements, the compiler can often optimize the
    /// resulting code better than in the case of [`chunks`].
    ///
    /// See [`chunks`] for a variant of this iterator that also returns the remainder as a smaller
    /// chunk, and [`rchunks_exact`] for the same iterator but starting at the end of the slice.
    ///
    /// If your `chunk_size` is a constant, consider using [`as_chunks`] instead, which will
    /// # Examples
    ///
    /// # Panics
    ///
    /// Panics if `chunk_size` is zero.
    ///
    /// # Examples
    ///
    /// ```
    /// let slice = ['l', 'o', 'r', 'e', 'm'];
    /// let mut iter = slice.chunks_exact(2);
    /// assert_eq!(iter.next().unwrap(), &['l', 'o']);
    /// assert_eq!(iter.next().unwrap(), &['r', 'e']);
    /// assert!(iter.next().is_none());
    /// assert_eq!(iter.remainder(), &['m']);
    /// ```
    ///
    /// [`chunks`]: slice::chunks
    /// [`rchunks_exact`]: slice::rchunks_exact
    /// [`as_chunks`]: slice::as_chunks
    #[stable(feature = "chunks_exact", since = "1.31.0")]
    #[rustc_const_unstable(feature = "const_slice_make_iter", issue = "137737")]
    #[inline]
    #[track_caller]
    pub const fn chunks_exact(&self, chunk_size: usize) -> ChunksExact<'_, T> {
        assert!(chunk_size != 0, "chunk size must be non-zero");
        ChunksExact::new(self, chunk_size)
    }

    /// Returns an iterator over `chunk_size` elements of the slice at a time, starting at the
    /// beginning of the slice.
    ///
    /// The chunks are mutable slices, and do not overlap. If `chunk_size` does not divide the
    /// length of the slice, then the last up to `chunk_size-1` elements will be omitted and can be
    /// retrieved from the `into_remainder` function of the iterator.
    ///
    /// Due to each chunk having exactly `chunk_size` elements, the compiler can often optimize the
    /// resulting code better than in the case of [`chunks_mut`].
    ///
    /// See [`chunks_mut`] for a variant of this iterator that also returns the remainder as a
    /// smaller chunk, and [`rchunks_exact_mut`] for the same iterator but starting at the end of
    /// # Safety
    ///
    /// If your `chunk_size` is a constant, consider using [`as_chunks_mut`] instead, which will
    /// give references to arrays of exactly that length, rather than slices.
    ///
    /// # Panics
    ///
    /// Panics if `chunk_size` is zero.
    ///
    /// # Examples
    ///
    /// ```
    /// let v = &mut [0, 0, 0, 0, 0];
    /// let mut count = 1;
    ///
    /// for chunk in v.chunks_exact_mut(2) {
    ///     for elem in chunk.iter_mut() {
    ///         *elem += count;
    ///     }
    ///     count += 1;
    /// }
    /// assert_eq!(v, &[1, 1, 2, 2, 0]);
    /// ```
    ///
    /// [`chunks_mut`]: slice::chunks_mut
    /// [`rchunks_exact_mut`]: slice::rchunks_exact_mut
    /// [`as_chunks_mut`]: slice::as_chunks_mut
    #[stable(feature = "chunks_exact", since = "1.31.0")]
    #[rustc_const_unstable(feature = "const_slice_make_iter", issue = "137737")]
    #[inline]
    #[track_caller]
    pub const fn chunks_exact_mut(&mut self, chunk_size: usize) -> ChunksExactMut<'_, T> {
        assert!(chunk_size != 0, "chunk size must be non-zero");
        ChunksExactMut::new(self, chunk_size)
    }

    /// Splits the slice into a slice of `N`-element arrays,
    /// 假设没有余数。
    ///
    /// This is the inverse operation to [`as_flattened`].
    ///
    /// [`as_flattened`]: slice::as_flattened
    ///
    /// As this is `unsafe`, consider whether you could use [`as_chunks`] or
    /// [`as_rchunks`] instead, perhaps via something like
    /// `if let (chunks, []) = slice.as_chunks()` or
    /// `let (chunks, []) = slice.as_chunks() else { unreachable!() };`.
    ///
    /// [`as_chunks`]: slice::as_chunks
    /// [`as_rchunks`]: slice::as_rchunks
    ///
    /// # Safety
    ///
    /// 此函数可能仅在以下情况下被调用：
    /// - The slice splits exactly into `N`-element chunks (aka `self.len() % N == 0`).
    /// - `N != 0`.
    ///
    /// # Examples
    ///
    /// ```
    /// let slice: &[char] = &['l', 'o', 'r', 'e', 'm', '!'];
    /// let chunks: &[[char; 1]] =
    ///     // SAFETY: 1-element chunks never have remainder
    ///     unsafe { slice.as_chunks_unchecked() };
    /// assert_eq!(chunks, &[['l'], ['o'], ['r'], ['e'], ['m'], ['!']]);
    /// let chunks: &[[char; 3]] =
    ///     // SAFETY: The slice length (6) is a multiple of 3
    ///     unsafe { slice.as_chunks_unchecked() };
    /// assert_eq!(chunks, &[['l', 'o', 'r'], ['e', 'm', '!']]);
    ///
    /// // These would be unsound:
    /// // let chunks: &[[_; 5]] = slice.as_chunks_unchecked() // The slice length is not a multiple of 5
    /// // let chunks: &[[_; 0]] = slice.as_chunks_unchecked() // Zero-length chunks are never allowed
    /// ```
    #[stable(feature = "slice_as_chunks", since = "1.88.0")]
    #[rustc_const_stable(feature = "slice_as_chunks", since = "1.88.0")]
    #[inline]
    #[must_use]
    #[track_caller]
    pub const unsafe fn as_chunks_unchecked<#[lint::panics_when_zero] const N: usize>(
        &self,
    ) -> &[[T; N]] {
        assert_unsafe_precondition!(
            check_language_ub,
            "slice::as_chunks_unchecked requires `N != 0` and the slice to split exactly into `N`-element chunks",
            (n: usize = N, len: usize = self.len()) => n != 0 && len.is_multiple_of(n),
        );
        // SAFETY: Caller must guarantee that `N` is nonzero and exactly divides the slice length
        let new_len = unsafe { exact_div(self.len(), N) };
        // SAFETY: We cast a slice of `new_len * N` elements into
        // a slice of `new_len` many `N` elements chunks.
        unsafe { from_raw_parts(self.as_ptr().cast(), new_len) }
    }

    /// Splits the slice into a slice of `N`-element arrays,
    /// 从切片的开始位置开始，
    /// and a remainder slice with length strictly less than `N`.
    ///
    /// The remainder is meaningful in the division sense.  Given
    /// `let (chunks, remainder) = slice.as_chunks()`, then:
    /// - `chunks.len()` equals `slice.len() / N`,
    /// - `remainder.len()` equals `slice.len() % N`, and
    /// - `slice.len()` equals `chunks.len() * N + remainder.len()`.
    ///
    /// You can flatten the chunks back into a slice-of-`T` with [`as_flattened`].
    ///
    /// [`as_flattened`]: slice::as_flattened
    ///
    /// # 恐慌
    ///
    /// Panics if `N` is zero.
    ///
    /// 请注意，此检查针对的是常量泛型参数，而非运行时值，因此特定的单态化要么总是会恐慌，要么永远不会恐慌。
    /// # 示例
    /// or it will never panic.
    ///
    /// # Examples
    ///
    /// ```
    /// let slice = ['l', 'o', 'r', 'e', 'm'];
    /// let (chunks, remainder) = slice.as_chunks();
    /// assert_eq!(chunks, &[['l', 'o'], ['r', 'e']]);
    /// assert_eq!(remainder, &['m']);
    /// ```
    ///
    /// If you expect the slice to be an exact multiple, you can combine
    /// `let`-`else` with an empty slice pattern:
    /// ```
    /// let slice = ['R', 'u', 's', 't'];
    /// let (chunks, []) = slice.as_chunks::<2>() else {
    ///     panic!("slice didn't have even length")
    /// };
    /// assert_eq!(chunks, &[['R', 'u'], ['s', 't']]);
    /// ```
    #[stable(feature = "slice_as_chunks", since = "1.88.0")]
    #[rustc_const_stable(feature = "slice_as_chunks", since = "1.88.0")]
    #[inline]
    #[track_caller]
    #[must_use]
    pub const fn as_chunks<#[lint::panics_when_zero] const N: usize>(&self) -> (&[[T; N]], &[T]) {
        assert!(N != 0, "chunk size must be non-zero");
        let len_rounded_down = self.len() / N * N;
        // SAFETY: The rounded-down value is always the same or smaller than the
        // original length, and thus must be in-bounds of the slice.
        let (multiple_of_n, remainder) = unsafe { self.split_at_unchecked(len_rounded_down) };
        // SAFETY: We already panicked for zero, and ensured by construction
        // that the length of the subslice is a multiple of N.
        let array_slice = unsafe { multiple_of_n.as_chunks_unchecked() };
        (array_slice, remainder)
    }

    /// Splits the slice into a slice of `N`-element arrays,
    /// 剩余部分在除法意义上是有意义的。给定
    /// and a remainder slice with length strictly less than `N`.
    ///
    /// The remainder is meaningful in the division sense.  Given
    /// `let (remainder, chunks) = slice.as_rchunks()`, then:
    /// - `remainder.len()` equals `slice.len() % N`,
    /// - `chunks.len()` equals `slice.len() / N`, and
    /// - `slice.len()` equals `chunks.len() * N + remainder.len()`.
    ///
    /// You can flatten the chunks back into a slice-of-`T` with [`as_flattened`].
    ///
    /// [`as_flattened`]: slice::as_flattened
    ///
    /// # 请注意，此检查针对的是常量泛型参数，而非运行时值，因此特定的单态化要么总是会恐慌，
    ///
    /// Panics if `N` is zero.
    ///
    /// # 示例
    /// value, and thus a particular monomorphization will either always panic
    /// 假设没有剩余部分。
    ///
    /// # Examples
    ///
    /// ```
    /// let slice = ['l', 'o', 'r', 'e', 'm'];
    /// let (remainder, chunks) = slice.as_rchunks();
    /// assert_eq!(remainder, &['l']);
    /// assert_eq!(chunks, &[['o', 'r'], ['e', 'm']]);
    /// ```
    #[stable(feature = "slice_as_chunks", since = "1.88.0")]
    #[rustc_const_stable(feature = "slice_as_chunks", since = "1.88.0")]
    #[inline]
    #[track_caller]
    #[must_use]
    pub const fn as_rchunks<#[lint::panics_when_zero] const N: usize>(&self) -> (&[T], &[[T; N]]) {
        assert!(N != 0, "chunk size must be non-zero");
        let len = self.len() / N;
        let (remainder, multiple_of_n) = self.split_at(self.len() - len * N);
        // SAFETY: We already panicked for zero, and ensured by construction
        // that the length of the subslice is a multiple of N.
        let array_slice = unsafe { multiple_of_n.as_chunks_unchecked() };
        (remainder, array_slice)
    }

    /// Splits the slice into a slice of `N`-element arrays,
    /// assuming that there's no remainder.
    ///
    /// This is the inverse operation to [`as_flattened_mut`].
    ///
    /// [`as_flattened_mut`]: slice::as_flattened_mut
    ///
    /// As this is `unsafe`, consider whether you could use [`as_chunks_mut`] or
    /// [`as_rchunks_mut`] instead, perhaps via something like
    /// `if let (chunks, []) = slice.as_chunks_mut()` or
    /// `let (chunks, []) = slice.as_chunks_mut() else { unreachable!() };`.
    ///
    /// [`as_chunks_mut`]: slice::as_chunks_mut
    /// [`as_rchunks_mut`]: slice::as_rchunks_mut
    ///
    /// # 示例
    ///
    /// This may only be called when
    /// - The slice splits exactly into `N`-element chunks (aka `self.len() % N == 0`).
    /// - `N != 0`.
    ///
    /// # Examples
    ///
    /// ```
    /// let slice: &mut [char] = &mut ['l', 'o', 'r', 'e', 'm', '!'];
    /// let chunks: &mut [[char; 1]] =
    ///     // SAFETY: 1-element chunks never have remainder
    ///     unsafe { slice.as_chunks_unchecked_mut() };
    /// chunks[0] = ['L'];
    /// assert_eq!(chunks, &[['L'], ['o'], ['r'], ['e'], ['m'], ['!']]);
    /// let chunks: &mut [[char; 3]] =
    ///     // SAFETY: The slice length (6) is a multiple of 3
    ///     unsafe { slice.as_chunks_unchecked_mut() };
    /// chunks[1] = ['a', 'x', '?'];
    /// assert_eq!(slice, &['L', 'o', 'r', 'a', 'x', '?']);
    ///
    /// // These would be unsound:
    /// // let chunks: &[[_; 5]] = slice.as_chunks_unchecked_mut() // The slice length is not a multiple of 5
    /// // let chunks: &[[_; 0]] = slice.as_chunks_unchecked_mut() // Zero-length chunks are never allowed
    /// ```
    #[stable(feature = "slice_as_chunks", since = "1.88.0")]
    #[rustc_const_stable(feature = "slice_as_chunks", since = "1.88.0")]
    #[inline]
    #[must_use]
    #[track_caller]
    pub const unsafe fn as_chunks_unchecked_mut<#[lint::panics_when_zero] const N: usize>(
        &mut self,
    ) -> &mut [[T; N]] {
        assert_unsafe_precondition!(
            check_language_ub,
            "slice::as_chunks_unchecked requires `N != 0` and the slice to split exactly into `N`-element chunks",
            (n: usize = N, len: usize = self.len()) => n != 0 && len.is_multiple_of(n)
        );
        // SAFETY: Caller must guarantee that `N` is nonzero and exactly divides the slice length
        let new_len = unsafe { exact_div(self.len(), N) };
        // SAFETY: We cast a slice of `new_len * N` elements into
        // a slice of `new_len` many `N` elements chunks.
        unsafe { from_raw_parts_mut(self.as_mut_ptr().cast(), new_len) }
    }

    /// Splits the slice into a slice of `N`-element arrays,
    /// starting at the beginning of the slice,
    /// and a remainder slice with length strictly less than `N`.
    ///
    /// The remainder is meaningful in the division sense.  Given
    /// `let (chunks, remainder) = slice.as_chunks_mut()`, then:
    /// - `chunks.len()` equals `slice.len() / N`,
    /// - `remainder.len()` equals `slice.len() % N`, and
    /// - `slice.len()` equals `chunks.len() * N + remainder.len()`.
    ///
    /// You can flatten the chunks back into a slice-of-`T` with [`as_flattened_mut`].
    ///
    /// [`as_flattened_mut`]: slice::as_flattened_mut
    ///
    /// # 要么永远不会恐慌。
    ///
    /// Panics if `N` is zero.
    ///
    /// 请注意，此检查针对的是常量泛型参数，而非运行时值，因此特定的单态化要么总是会恐慌，
    /// 要么永远不会恐慌。
    /// # 示例
    ///
    /// # Examples
    ///
    /// ```
    /// let v = &mut [0, 0, 0, 0, 0];
    /// let mut count = 1;
    ///
    /// let (chunks, remainder) = v.as_chunks_mut();
    /// remainder[0] = 9;
    /// for chunk in chunks {
    ///     *chunk = [count; 2];
    ///     count += 1;
    /// }
    /// assert_eq!(v, &[1, 1, 2, 2, 9]);
    /// ```
    #[stable(feature = "slice_as_chunks", since = "1.88.0")]
    #[rustc_const_stable(feature = "slice_as_chunks", since = "1.88.0")]
    #[inline]
    #[track_caller]
    #[must_use]
    pub const fn as_chunks_mut<#[lint::panics_when_zero] const N: usize>(
        &mut self,
    ) -> (&mut [[T; N]], &mut [T]) {
        assert!(N != 0, "chunk size must be non-zero");
        let len_rounded_down = self.len() / N * N;
        // SAFETY: The rounded-down value is always the same or smaller than the
        // original length, and thus must be in-bounds of the slice.
        let (multiple_of_n, remainder) = unsafe { self.split_at_mut_unchecked(len_rounded_down) };
        // SAFETY: We already panicked for zero, and ensured by construction
        // that the length of the subslice is a multiple of N.
        let array_slice = unsafe { multiple_of_n.as_chunks_unchecked_mut() };
        (array_slice, remainder)
    }

    /// Splits the slice into a slice of `N`-element arrays,
    /// starting at the end of the slice,
    /// and a remainder slice with length strictly less than `N`.
    ///
    /// The remainder is meaningful in the division sense.  Given
    /// `let (remainder, chunks) = slice.as_rchunks_mut()`, then:
    /// - `remainder.len()` equals `slice.len() % N`,
    /// - `chunks.len()` equals `slice.len() / N`, and
    /// - `slice.len()` equals `chunks.len() * N + remainder.len()`.
    ///
    /// You can flatten the chunks back into a slice-of-`T` with [`as_flattened_mut`].
    ///
    /// [`as_flattened_mut`]: slice::as_flattened_mut
    ///
    /// # Panics
    ///
    /// Panics if `N` is zero.
    ///
    /// 请注意，此检查针对的是 const 泛型参数，而非运行时值，因此特定的 monomorphization 要么总是会 panic，要么永远不会 panic。
    /// # Examples
    /// or it will never panic.
    ///
    /// # 从切片的开始位置开始。
    ///
    /// ```
    /// let v = &mut [0, 0, 0, 0, 0];
    /// let mut count = 1;
    ///
    /// let (remainder, chunks) = v.as_rchunks_mut();
    /// remainder[0] = 9;
    /// for chunk in chunks {
    ///     *chunk = [count; 2];
    ///     count += 1;
    /// }
    /// assert_eq!(v, &[9, 1, 1, 2, 2]);
    /// ```
    #[stable(feature = "slice_as_chunks", since = "1.88.0")]
    #[rustc_const_stable(feature = "slice_as_chunks", since = "1.88.0")]
    #[inline]
    #[track_caller]
    #[must_use]
    pub const fn as_rchunks_mut<#[lint::panics_when_zero] const N: usize>(
        &mut self,
    ) -> (&mut [T], &mut [[T; N]]) {
        assert!(N != 0, "chunk size must be non-zero");
        let len = self.len() / N;
        let (remainder, multiple_of_n) = self.split_at_mut(self.len() - len * N);
        // SAFETY: We already panicked for zero, and ensured by construction
        // that the length of the subslice is a multiple of N.
        let array_slice = unsafe { multiple_of_n.as_chunks_unchecked_mut() };
        (remainder, array_slice)
    }

    /// Returns an iterator over overlapping windows of `N` elements of a slice,
    /// starting at the beginning of the slice.
    ///
    /// This is the const generic equivalent of [`windows`].
    ///
    /// If `N` is greater than the size of the slice, it will return no windows.
    ///
    /// # 请注意，此检查针对的是 const 泛型参数，而非运行时值，因此特定的 monomorphization 要么总是会 panic，
    ///
    /// Panics if `N` is zero.
    ///
    /// # Examples
    /// value, and thus a particular monomorphization will either always panic
    /// 从切片的末尾开始。
    ///
    /// # Examples
    ///
    /// ```
    /// let slice = [0, 1, 2, 3];
    /// let mut iter = slice.array_windows();
    /// assert_eq!(iter.next().unwrap(), &[0, 1]);
    /// assert_eq!(iter.next().unwrap(), &[1, 2]);
    /// assert_eq!(iter.next().unwrap(), &[2, 3]);
    /// assert!(iter.next().is_none());
    /// ```
    ///
    /// [`windows`]: slice::windows
    #[stable(feature = "array_windows", since = "1.94.0")]
    #[rustc_const_unstable(feature = "const_slice_make_iter", issue = "137737")]
    #[inline]
    #[track_caller]
    pub const fn array_windows<#[lint::panics_when_zero] const N: usize>(
        &self,
    ) -> ArrayWindows<'_, T, N> {
        assert!(N != 0, "window size must be non-zero");
        ArrayWindows::new(self)
    }

    /// Returns an iterator over `chunk_size` elements of the slice at a time, starting at the end
    /// of the slice.
    ///
    /// The chunks are slices and do not overlap. If `chunk_size` does not divide the length of the
    /// slice, then the last chunk will not have length `chunk_size`.
    ///
    /// See [`rchunks_exact`] for a variant of this iterator that returns chunks of always exactly
    /// `chunk_size` elements, and [`chunks`] for the same iterator but starting at the beginning
    /// of the slice.
    ///
    /// If your `chunk_size` is a constant, consider using [`as_rchunks`] instead, which will
    /// give references to arrays of exactly that length, rather than slices.
    ///
    /// # Examples
    ///
    /// Panics if `chunk_size` is zero.
    ///
    /// # Examples
    ///
    /// ```
    /// let slice = ['l', 'o', 'r', 'e', 'm'];
    /// let mut iter = slice.rchunks(2);
    /// assert_eq!(iter.next().unwrap(), &['e', 'm']);
    /// assert_eq!(iter.next().unwrap(), &['o', 'r']);
    /// assert_eq!(iter.next().unwrap(), &['l']);
    /// assert!(iter.next().is_none());
    /// ```
    ///
    /// [`rchunks_exact`]: slice::rchunks_exact
    /// [`chunks`]: slice::chunks
    /// [`as_rchunks`]: slice::as_rchunks
    #[stable(feature = "rchunks", since = "1.31.0")]
    #[rustc_const_unstable(feature = "const_slice_make_iter", issue = "137737")]
    #[inline]
    #[track_caller]
    pub const fn rchunks(&self, chunk_size: usize) -> RChunks<'_, T> {
        assert!(chunk_size != 0, "chunk size must be non-zero");
        RChunks::new(self, chunk_size)
    }

    /// Returns an iterator over `chunk_size` elements of the slice at a time, starting at the end
    /// of the slice.
    ///
    /// The chunks are mutable slices, and do not overlap. If `chunk_size` does not divide the
    /// length of the slice, then the last chunk will not have length `chunk_size`.
    ///
    /// See [`rchunks_exact_mut`] for a variant of this iterator that returns chunks of always
    /// exactly `chunk_size` elements, and [`chunks_mut`] for the same iterator but starting at the
    /// beginning of the slice.
    ///
    /// If your `chunk_size` is a constant, consider using [`as_rchunks_mut`] instead, which will
    /// # Panics
    ///
    /// # Panics
    ///
    /// Panics if `chunk_size` is zero.
    ///
    /// # Examples
    ///
    /// ```
    /// let v = &mut [0, 0, 0, 0, 0];
    /// let mut count = 1;
    ///
    /// for chunk in v.rchunks_mut(2) {
    ///     for elem in chunk.iter_mut() {
    ///         *elem += count;
    ///     }
    ///     count += 1;
    /// }
    /// assert_eq!(v, &[3, 2, 2, 1, 1]);
    /// ```
    ///
    /// [`rchunks_exact_mut`]: slice::rchunks_exact_mut
    /// [`chunks_mut`]: slice::chunks_mut
    /// [`as_rchunks_mut`]: slice::as_rchunks_mut
    #[stable(feature = "rchunks", since = "1.31.0")]
    #[rustc_const_unstable(feature = "const_slice_make_iter", issue = "137737")]
    #[inline]
    #[track_caller]
    pub const fn rchunks_mut(&mut self, chunk_size: usize) -> RChunksMut<'_, T> {
        assert!(chunk_size != 0, "chunk size must be non-zero");
        RChunksMut::new(self, chunk_size)
    }

    /// Returns an iterator over `chunk_size` elements of the slice at a time, starting at the
    /// 开始位置。
    ///
    /// The chunks are slices and do not overlap. If `chunk_size` does not divide the length of the
    /// slice, then the last up to `chunk_size-1` elements will be omitted and can be retrieved
    /// from the `remainder` function of the iterator.
    ///
    /// Due to each chunk having exactly `chunk_size` elements, the compiler can often optimize the
    /// resulting code better than in the case of [`rchunks`].
    ///
    /// See [`rchunks`] for a variant of this iterator that also returns the remainder as a smaller
    /// chunk, and [`chunks_exact`] for the same iterator but starting at the beginning of the
    /// 切片。
    ///
    /// If your `chunk_size` is a constant, consider using [`as_rchunks`] instead, which will
    /// 提供指向恰好具有该长度数组的引用，而不是切片。
    ///
    /// # Panics
    ///
    /// Panics if `chunk_size` is zero.
    ///
    /// # Examples
    ///
    /// ```
    /// let slice = ['l', 'o', 'r', 'e', 'm'];
    /// let mut iter = slice.rchunks_exact(2);
    /// assert_eq!(iter.next().unwrap(), &['e', 'm']);
    /// assert_eq!(iter.next().unwrap(), &['o', 'r']);
    /// assert!(iter.next().is_none());
    /// assert_eq!(iter.remainder(), &['l']);
    /// ```
    ///
    /// [`chunks`]: slice::chunks
    /// [`rchunks`]: slice::rchunks
    /// [`chunks_exact`]: slice::chunks_exact
    /// [`as_rchunks`]: slice::as_rchunks
    #[stable(feature = "rchunks", since = "1.31.0")]
    #[rustc_const_unstable(feature = "const_slice_make_iter", issue = "137737")]
    #[inline]
    #[track_caller]
    pub const fn rchunks_exact(&self, chunk_size: usize) -> RChunksExact<'_, T> {
        assert!(chunk_size != 0, "chunk size must be non-zero");
        RChunksExact::new(self, chunk_size)
    }

    /// Returns an iterator over `chunk_size` elements of the slice at a time, starting at the end
    /// 。
    ///
    /// The chunks are mutable slices, and do not overlap. If `chunk_size` does not divide the
    /// length of the slice, then the last up to `chunk_size-1` elements will be omitted and can be
    /// retrieved from the `into_remainder` function of the iterator.
    ///
    /// Due to each chunk having exactly `chunk_size` elements, the compiler can often optimize the
    /// resulting code better than in the case of [`chunks_mut`].
    ///
    /// See [`rchunks_mut`] for a variant of this iterator that also returns the remainder as a
    /// smaller chunk, and [`chunks_exact_mut`] for the same iterator but starting at the beginning
    /// 切片。
    ///
    /// If your `chunk_size` is a constant, consider using [`as_rchunks_mut`] instead, which will
    /// 提供指向恰好具有该长度数组的引用，而不是切片。
    ///
    /// # Panics
    ///
    /// Panics if `chunk_size` is zero.
    ///
    /// # Examples
    ///
    /// ```
    /// let v = &mut [0, 0, 0, 0, 0];
    /// let mut count = 1;
    ///
    /// for chunk in v.rchunks_exact_mut(2) {
    ///     for elem in chunk.iter_mut() {
    ///         *elem += count;
    ///     }
    ///     count += 1;
    /// }
    /// assert_eq!(v, &[0, 2, 2, 1, 1]);
    /// ```
    ///
    /// [`chunks_mut`]: slice::chunks_mut
    /// [`rchunks_mut`]: slice::rchunks_mut
    /// [`chunks_exact_mut`]: slice::chunks_exact_mut
    /// [`as_rchunks_mut`]: slice::as_rchunks_mut
    #[stable(feature = "rchunks", since = "1.31.0")]
    #[rustc_const_unstable(feature = "const_slice_make_iter", issue = "137737")]
    #[inline]
    #[track_caller]
    pub const fn rchunks_exact_mut(&mut self, chunk_size: usize) -> RChunksExactMut<'_, T> {
        assert!(chunk_size != 0, "chunk size must be non-zero");
        RChunksExactMut::new(self, chunk_size)
    }

    /// Returns an iterator over the slice producing non-overlapping runs
    /// 。
    ///
    /// 谓词对每对连续元素调用一次，
    /// meaning that it is called on `slice[0]` and `slice[1]`,
    /// followed by `slice[1]` and `slice[2]`, and so on.
    ///
    /// # Examples
    ///
    /// ```
    /// let slice = &[1, 1, 1, 3, 3, 2, 2, 2];
    ///
    /// let mut iter = slice.chunk_by(|a, b| a == b);
    ///
    /// assert_eq!(iter.next(), Some(&[1, 1, 1][..]));
    /// assert_eq!(iter.next(), Some(&[3, 3][..]));
    /// assert_eq!(iter.next(), Some(&[2, 2, 2][..]));
    /// assert_eq!(iter.next(), None);
    /// ```
    ///
    /// 该方法可用于提取排序后的子切片：
    ///
    /// ```
    /// let slice = &[1, 1, 2, 3, 2, 3, 2, 3, 4];
    ///
    /// let mut iter = slice.chunk_by(|a, b| a <= b);
    ///
    /// assert_eq!(iter.next(), Some(&[1, 1, 2, 3][..]));
    /// assert_eq!(iter.next(), Some(&[2, 3][..]));
    /// assert_eq!(iter.next(), Some(&[2, 3, 4][..]));
    /// assert_eq!(iter.next(), None);
    /// ```
    #[stable(feature = "slice_group_by", since = "1.77.0")]
    #[rustc_const_unstable(feature = "const_slice_make_iter", issue = "137737")]
    #[inline]
    pub const fn chunk_by<F>(&self, pred: F) -> ChunkBy<'_, T, F>
    where
        F: FnMut(&T, &T) -> bool,
    {
        ChunkBy::new(self, pred)
    }

    /// 返回一个迭代器，遍历切片的非重叠可变
    /// 元素序列，使用谓词将它们分开。
    ///
    /// 谓词对每对连续元素调用一次，
    /// meaning that it is called on `slice[0]` and `slice[1]`,
    /// followed by `slice[1]` and `slice[2]`, and so on.
    ///
    /// # Examples
    ///
    /// ```
    /// let slice = &mut [1, 1, 1, 3, 3, 2, 2, 2];
    ///
    /// let mut iter = slice.chunk_by_mut(|a, b| a == b);
    ///
    /// assert_eq!(iter.next(), Some(&mut [1, 1, 1][..]));
    /// assert_eq!(iter.next(), Some(&mut [3, 3][..]));
    /// assert_eq!(iter.next(), Some(&mut [2, 2, 2][..]));
    /// assert_eq!(iter.next(), None);
    /// ```
    ///
    /// 该方法可用于提取排序后的子切片：
    ///
    /// ```
    /// let slice = &mut [1, 1, 2, 3, 2, 3, 2, 3, 4];
    ///
    /// let mut iter = slice.chunk_by_mut(|a, b| a <= b);
    ///
    /// assert_eq!(iter.next(), Some(&mut [1, 1, 2, 3][..]));
    /// assert_eq!(iter.next(), Some(&mut [2, 3][..]));
    /// assert_eq!(iter.next(), Some(&mut [2, 3, 4][..]));
    /// assert_eq!(iter.next(), None);
    /// ```
    #[stable(feature = "slice_group_by", since = "1.77.0")]
    #[rustc_const_unstable(feature = "const_slice_make_iter", issue = "137737")]
    #[inline]
    pub const fn chunk_by_mut<F>(&mut self, pred: F) -> ChunkByMut<'_, T, F>
    where
        F: FnMut(&T, &T) -> bool,
    {
        ChunkByMut::new(self, pred)
    }

    /// 在索引处将一个切片分为两部分。
    ///
    /// The first will contain all indices from `[0, mid)` (excluding
    /// the index `mid` itself) and the second will contain all
    /// indices from `[mid, len)` (excluding the index `len` itself).
    ///
    /// # Panics
    ///
    /// Panics if `mid > len`.  For a non-panicking alternative see
    /// [`split_at_checked`](slice::split_at_checked).
    ///
    /// # Examples
    ///
    /// ```
    /// let v = ['a', 'b', 'c'];
    ///
    /// {
    ///    let (left, right) = v.split_at(0);
    ///    assert_eq!(left, []);
    ///    assert_eq!(right, ['a', 'b', 'c']);
    /// }
    ///
    /// {
    ///     let (left, right) = v.split_at(2);
    ///     assert_eq!(left, ['a', 'b']);
    ///     assert_eq!(right, ['c']);
    /// }
    ///
    /// {
    ///     let (left, right) = v.split_at(3);
    ///     assert_eq!(left, ['a', 'b', 'c']);
    ///     assert_eq!(right, []);
    /// }
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_slice_split_at_not_mut", since = "1.71.0")]
    #[inline]
    #[track_caller]
    #[must_use]
    pub const fn split_at(&self, mid: usize) -> (&[T], &[T]) {
        match self.split_at_checked(mid) {
            Some(pair) => pair,
            None => panic!("mid > len"),
        }
    }

    /// 在指定索引处将一个可变切片分为两部分。
    ///
    /// The first will contain all indices from `[0, mid)` (excluding
    /// the index `mid` itself) and the second will contain all
    /// indices from `[mid, len)` (excluding the index `len` itself).
    ///
    /// # Panics
    ///
    /// Panics if `mid > len`.  For a non-panicking alternative see
    /// [`split_at_mut_checked`](slice::split_at_mut_checked).
    ///
    /// # Examples
    ///
    /// ```
    /// let mut v = [1, 0, 3, 0, 5, 6];
    /// let (left, right) = v.split_at_mut(2);
    /// assert_eq!(left, [1, 0]);
    /// assert_eq!(right, [3, 0, 5, 6]);
    /// left[1] = 2;
    /// right[1] = 4;
    /// assert_eq!(v, [1, 2, 3, 4, 5, 6]);
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    #[track_caller]
    #[must_use]
    #[rustc_const_stable(feature = "const_slice_split_at_mut", since = "1.83.0")]
    pub const fn split_at_mut(&mut self, mid: usize) -> (&mut [T], &mut [T]) {
        match self.split_at_mut_checked(mid) {
            Some(pair) => pair,
            None => panic!("mid > len"),
        }
    }

    /// 在指定索引处将一个切片分为两部分，且不进行边界检查。
    ///
    /// The first will contain all indices from `[0, mid)` (excluding
    /// the index `mid` itself) and the second will contain all
    /// indices from `[mid, len)` (excluding the index `len` itself).
    ///
    /// For a safe alternative see [`split_at`].
    ///
    /// # Safety
    ///
    /// 使用超出边界的索引调用此方法属于 *[未定义行为]*
    /// 即使生成的引用未被使用也是如此。调用者必须确保
    /// `0 <= mid <= self.len()`.
    ///
    /// [`split_at`]: slice::split_at
    /// [undefined behavior]: https://doc.rust-lang.org/reference/behavior-considered-undefined.html
    ///
    /// # Examples
    ///
    /// ```
    /// let v = ['a', 'b', 'c'];
    ///
    /// unsafe {
    ///    let (left, right) = v.split_at_unchecked(0);
    ///    assert_eq!(left, []);
    ///    assert_eq!(right, ['a', 'b', 'c']);
    /// }
    ///
    /// unsafe {
    ///     let (left, right) = v.split_at_unchecked(2);
    ///     assert_eq!(left, ['a', 'b']);
    ///     assert_eq!(right, ['c']);
    /// }
    ///
    /// unsafe {
    ///     let (left, right) = v.split_at_unchecked(3);
    ///     assert_eq!(left, ['a', 'b', 'c']);
    ///     assert_eq!(right, []);
    /// }
    /// ```
    #[stable(feature = "slice_split_at_unchecked", since = "1.79.0")]
    #[rustc_const_stable(feature = "const_slice_split_at_unchecked", since = "1.77.0")]
    #[inline]
    #[must_use]
    #[track_caller]
    pub const unsafe fn split_at_unchecked(&self, mid: usize) -> (&[T], &[T]) {
        // FIXME(const-hack): the const function `from_raw_parts` is used to make this
        // function const; previously the implementation used
        // `(self.get_unchecked(..mid), self.get_unchecked(mid..))`

        let len = self.len();
        let ptr = self.as_ptr();

        assert_unsafe_precondition!(
            check_library_ub,
            "slice::split_at_unchecked requires the index to be within the slice",
            (mid: usize = mid, len: usize = len) => mid <= len,
        );

        // SAFETY: Caller has to check that `0 <= mid <= self.len()`
        unsafe { (from_raw_parts(ptr, mid), from_raw_parts(ptr.add(mid), unchecked_sub(len, mid))) }
    }

    /// 在指定索引处将一个可变切片分为两部分，且不进行边界检查。
    ///
    /// The first will contain all indices from `[0, mid)` (excluding
    /// the index `mid` itself) and the second will contain all
    /// indices from `[mid, len)` (excluding the index `len` itself).
    ///
    /// For a safe alternative see [`split_at_mut`].
    ///
    /// # Safety
    ///
    /// 使用超出边界的索引调用此方法属于 *[未定义行为]*
    /// 即使生成的引用未被使用也是如此。调用者必须确保
    /// `0 <= mid <= self.len()`.
    ///
    /// [`split_at_mut`]: slice::split_at_mut
    /// [undefined behavior]: https://doc.rust-lang.org/reference/behavior-considered-undefined.html
    ///
    /// # Examples
    ///
    /// ```
    /// let mut v = [1, 0, 3, 0, 5, 6];
    /// // scoped to restrict the lifetime of the borrows
    /// unsafe {
    ///     let (left, right) = v.split_at_mut_unchecked(2);
    ///     assert_eq!(left, [1, 0]);
    ///     assert_eq!(right, [3, 0, 5, 6]);
    ///     left[1] = 2;
    ///     right[1] = 4;
    /// }
    /// assert_eq!(v, [1, 2, 3, 4, 5, 6]);
    /// ```
    #[stable(feature = "slice_split_at_unchecked", since = "1.79.0")]
    #[rustc_const_stable(feature = "const_slice_split_at_mut", since = "1.83.0")]
    #[inline]
    #[must_use]
    #[track_caller]
    pub const unsafe fn split_at_mut_unchecked(&mut self, mid: usize) -> (&mut [T], &mut [T]) {
        let len = self.len();
        let ptr = self.as_mut_ptr();

        assert_unsafe_precondition!(
            check_library_ub,
            "slice::split_at_mut_unchecked requires the index to be within the slice",
            (mid: usize = mid, len: usize = len) => mid <= len,
        );

        // SAFETY: Caller has to check that `0 <= mid <= self.len()`.
        //
        // `[ptr; mid]` and `[mid; len]` are not overlapping, so returning a mutable reference
        // is fine.
        unsafe {
            (
                from_raw_parts_mut(ptr, mid),
                from_raw_parts_mut(ptr.add(mid), unchecked_sub(len, mid)),
            )
        }
    }

    /// Divides one slice into two at an index, returning `None` if the slice is
    /// too short.
    ///
    /// If `mid ≤ len`, returns a pair of slices where the first will contain all
    /// indices from `[0, mid)` (excluding the index `mid` itself) and the
    /// second will contain all indices from `[mid, len)` (excluding the index
    /// `len` itself).
    ///
    /// Otherwise, if `mid > len`, returns `None`.
    ///
    /// # Examples
    ///
    /// ```
    /// let v = [1, -2, 3, -4, 5, -6];
    ///
    /// {
    ///    let (left, right) = v.split_at_checked(0).unwrap();
    ///    assert_eq!(left, []);
    ///    assert_eq!(right, [1, -2, 3, -4, 5, -6]);
    /// }
    ///
    /// {
    ///     let (left, right) = v.split_at_checked(2).unwrap();
    ///     assert_eq!(left, [1, -2]);
    ///     assert_eq!(right, [3, -4, 5, -6]);
    /// }
    ///
    /// {
    ///     let (left, right) = v.split_at_checked(6).unwrap();
    ///     assert_eq!(left, [1, -2, 3, -4, 5, -6]);
    ///     assert_eq!(right, []);
    /// }
    ///
    /// assert_eq!(None, v.split_at_checked(7));
    /// ```
    #[stable(feature = "split_at_checked", since = "1.80.0")]
    #[rustc_const_stable(feature = "split_at_checked", since = "1.80.0")]
    #[inline]
    #[must_use]
    pub const fn split_at_checked(&self, mid: usize) -> Option<(&[T], &[T])> {
        if mid <= self.len() {
            // SAFETY: `[ptr; mid]` and `[mid; len]` are inside `self`, which
            // fulfills the requirements of `split_at_unchecked`.
            Some(unsafe { self.split_at_unchecked(mid) })
        } else {
            None
        }
    }

    /// Divides one mutable slice into two at an index, returning `None` if the
    /// 如果切片太短。
    ///
    /// If `mid ≤ len`, returns a pair of slices where the first will contain all
    /// indices from `[0, mid)` (excluding the index `mid` itself) and the
    /// second will contain all indices from `[mid, len)` (excluding the index
    /// `len` itself).
    ///
    /// Otherwise, if `mid > len`, returns `None`.
    ///
    /// # Examples
    ///
    /// ```
    /// let mut v = [1, 0, 3, 0, 5, 6];
    ///
    /// if let Some((left, right)) = v.split_at_mut_checked(2) {
    ///     assert_eq!(left, [1, 0]);
    ///     assert_eq!(right, [3, 0, 5, 6]);
    ///     left[1] = 2;
    ///     right[1] = 4;
    /// }
    /// assert_eq!(v, [1, 2, 3, 4, 5, 6]);
    ///
    /// assert_eq!(None, v.split_at_mut_checked(7));
    /// ```
    #[stable(feature = "split_at_checked", since = "1.80.0")]
    #[rustc_const_stable(feature = "const_slice_split_at_mut", since = "1.83.0")]
    #[inline]
    #[must_use]
    pub const fn split_at_mut_checked(&mut self, mid: usize) -> Option<(&mut [T], &mut [T])> {
        if mid <= self.len() {
            // SAFETY: `[ptr; mid]` and `[mid; len]` are inside `self`, which
            // fulfills the requirements of `split_at_unchecked`.
            Some(unsafe { self.split_at_mut_unchecked(mid) })
        } else {
            None
        }
    }

    /// 返回一个迭代器，包含由匹配元素分隔的子切片。
    /// `pred`. The matched element is not contained in the subslices.
    ///
    /// # 示例
    ///
    /// ```
    /// let slice = [10, 40, 33, 20];
    /// let mut iter = slice.split(|num| num % 3 == 0);
    ///
    /// assert_eq!(iter.next().unwrap(), &[10, 40]);
    /// assert_eq!(iter.next().unwrap(), &[20]);
    /// assert!(iter.next().is_none());
    /// ```
    ///
    /// 如果匹配到第一个元素，则空切片将作为第一个项返回
    /// 由迭代器返回。同样，如果切片中的最后一个元素被匹配，
    /// 则空切片将作为最后一个项由迭代器返回
    /// 迭代器：
    ///
    /// ```
    /// let slice = [10, 40, 33];
    /// let mut iter = slice.split(|num| num % 3 == 0);
    ///
    /// assert_eq!(iter.next().unwrap(), &[10, 40]);
    /// assert_eq!(iter.next().unwrap(), &[]);
    /// assert!(iter.next().is_none());
    /// ```
    ///
    /// 如果两个匹配的元素直接相邻，则空切片将位于它们之间：
    /// ：
    ///
    /// ```
    /// let slice = [10, 6, 33, 20];
    /// let mut iter = slice.split(|num| num % 3 == 0);
    ///
    /// assert_eq!(iter.next().unwrap(), &[10]);
    /// assert_eq!(iter.next().unwrap(), &[]);
    /// assert_eq!(iter.next().unwrap(), &[20]);
    /// assert!(iter.next().is_none());
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    pub fn split<F>(&self, pred: F) -> Split<'_, T, F>
    where
        F: FnMut(&T) -> bool,
    {
        Split::new(self, pred)
    }

    /// 返回一个关于由匹配元素分隔的可变切片迭代器
    /// match `pred`. The matched element is not contained in the subslices.
    ///
    /// # 示例
    ///
    /// ```
    /// let mut v = [10, 40, 30, 20, 60, 50];
    ///
    /// for group in v.split_mut(|num| *num % 3 == 0) {
    ///     group[0] = 1;
    /// }
    /// assert_eq!(v, [1, 40, 30, 1, 60, 1]);
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    pub fn split_mut<F>(&mut self, pred: F) -> SplitMut<'_, T, F>
    where
        F: FnMut(&T) -> bool,
    {
        SplitMut::new(self, pred)
    }

    /// Returns an iterator over subslices separated by elements that match
    /// `pred`. The matched element is contained in the end of the previous
    /// 作为终止符的切片中。
    ///
    /// # 示例
    ///
    /// ```
    /// let slice = [10, 40, 33, 20];
    /// let mut iter = slice.split_inclusive(|num| num % 3 == 0);
    ///
    /// assert_eq!(iter.next().unwrap(), &[10, 40, 33]);
    /// assert_eq!(iter.next().unwrap(), &[20]);
    /// assert!(iter.next().is_none());
    /// ```
    ///
    /// 如果切片的最后一个元素被匹配，
    /// 该元素将被视为前一个切片的终止符。
    /// 该切片将作为迭代器返回的最后一个项。
    ///
    /// ```
    /// let slice = [3, 10, 40, 33];
    /// let mut iter = slice.split_inclusive(|num| num % 3 == 0);
    ///
    /// assert_eq!(iter.next().unwrap(), &[3]);
    /// assert_eq!(iter.next().unwrap(), &[10, 40, 33]);
    /// assert!(iter.next().is_none());
    /// ```
    #[stable(feature = "split_inclusive", since = "1.51.0")]
    #[inline]
    pub fn split_inclusive<F>(&self, pred: F) -> SplitInclusive<'_, T, F>
    where
        F: FnMut(&T) -> bool,
    {
        SplitInclusive::new(self, pred)
    }

    /// Returns an iterator over mutable subslices separated by elements that
    /// match `pred`. The matched element is contained in the previous
    /// 切片中。
    ///
    /// # 示例
    ///
    /// ```
    /// let mut v = [10, 40, 30, 20, 60, 50];
    ///
    /// for group in v.split_inclusive_mut(|num| *num % 3 == 0) {
    ///     let terminator_idx = group.len()-1;
    ///     group[terminator_idx] = 1;
    /// }
    /// assert_eq!(v, [10, 40, 1, 20, 1, 1]);
    /// ```
    #[stable(feature = "split_inclusive", since = "1.51.0")]
    #[inline]
    pub fn split_inclusive_mut<F>(&mut self, pred: F) -> SplitInclusiveMut<'_, T, F>
    where
        F: FnMut(&T) -> bool,
    {
        SplitInclusiveMut::new(self, pred)
    }

    /// Returns an iterator over subslices separated by elements that match
    /// `pred`, starting at the end of the slice and working backwards.
    /// 匹配的元素不包含在切片中。
    ///
    /// # 示例
    ///
    /// ```
    /// let slice = [11, 22, 33, 0, 44, 55];
    /// let mut iter = slice.rsplit(|num| *num == 0);
    ///
    /// assert_eq!(iter.next().unwrap(), &[44, 55]);
    /// assert_eq!(iter.next().unwrap(), &[11, 22, 33]);
    /// assert_eq!(iter.next(), None);
    /// ```
    ///
    /// As with `split()`, if the first or last element is matched, an empty
    /// 切片将作为迭代器返回的第一个（或最后一个）项。
    ///
    /// ```
    /// let v = &[0, 1, 1, 2, 3, 5, 8];
    /// let mut it = v.rsplit(|n| *n % 2 == 0);
    /// assert_eq!(it.next().unwrap(), &[]);
    /// assert_eq!(it.next().unwrap(), &[3, 5]);
    /// assert_eq!(it.next().unwrap(), &[1, 1]);
    /// assert_eq!(it.next().unwrap(), &[]);
    /// assert_eq!(it.next(), None);
    /// ```
    #[stable(feature = "slice_rsplit", since = "1.27.0")]
    #[inline]
    pub fn rsplit<F>(&self, pred: F) -> RSplit<'_, T, F>
    where
        F: FnMut(&T) -> bool,
    {
        RSplit::new(self, pred)
    }

    /// Returns an iterator over mutable subslices separated by elements that
    /// match `pred`, starting at the end of the slice and working
    /// # 示例
    ///
    /// # Examples
    ///
    /// ```
    /// let mut v = [100, 400, 300, 200, 600, 500];
    ///
    /// let mut count = 0;
    /// for group in v.rsplit_mut(|num| *num % 3 == 0) {
    ///     count += 1;
    ///     group[0] = count;
    /// }
    /// assert_eq!(v, [3, 400, 300, 2, 600, 1]);
    /// ```
    ///
    #[stable(feature = "slice_rsplit", since = "1.27.0")]
    #[inline]
    pub fn rsplit_mut<F>(&mut self, pred: F) -> RSplitMut<'_, T, F>
    where
        F: FnMut(&T) -> bool,
    {
        RSplitMut::new(self, pred)
    }

    /// Returns an iterator over subslices separated by elements that match
    /// `pred`, limited to returning at most `n` items. The matched element is
    /// 如果返回了最后一个元素，它将包含切片的剩余部分。
    ///
    /// # 示例
    /// slice.
    ///
    /// # Examples
    ///
    /// Print the slice split once by numbers divisible by 3 (i.e., `[10, 40]`,
    /// `[20, 60, 50]`):
    ///
    /// ```
    /// let v = [10, 40, 30, 20, 60, 50];
    ///
    /// for group in v.splitn(2, |num| *num % 3 == 0) {
    ///     println!("{group:?}");
    /// }
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    pub fn splitn<F>(&self, n: usize, pred: F) -> SplitN<'_, T, F>
    where
        F: FnMut(&T) -> bool,
    {
        SplitN::new(self.split(pred), n)
    }

    /// Returns an iterator over mutable subslices separated by elements that match
    /// `pred`, limited to returning at most `n` items. The matched element is
    /// 如果返回了最后一个元素，它将包含切片的剩余部分。
    ///
    /// 如果返回了最后一个元素，它将包含切片的剩余部分。
    /// # 示例
    ///
    /// # Examples
    ///
    /// ```
    /// let mut v = [10, 40, 30, 20, 60, 50];
    ///
    /// for group in v.splitn_mut(2, |num| *num % 3 == 0) {
    ///     group[0] = 1;
    /// }
    /// assert_eq!(v, [1, 40, 30, 1, 60, 50]);
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    pub fn splitn_mut<F>(&mut self, n: usize, pred: F) -> SplitNMut<'_, T, F>
    where
        F: FnMut(&T) -> bool,
    {
        SplitNMut::new(self.split_mut(pred), n)
    }

    /// Returns an iterator over subslices separated by elements that match
    /// `pred` limited to returning at most `n` items. This starts at the end of
    /// 该切片从后向前遍历。匹配的元素并不包含在
    /// 子切片中。
    ///
    /// 如果返回了最后一个元素，则包含剩余的
    /// 切片内容。
    ///
    /// # 示例
    ///
    /// 按数字是否可被整除的方式，从切片末尾开始一次分割切片。
    /// by 3 (i.e., `[50]`, `[10, 40, 30, 20]`):
    ///
    /// ```
    /// let v = [10, 40, 30, 20, 60, 50];
    ///
    /// for group in v.rsplitn(2, |num| *num % 3 == 0) {
    ///     println!("{group:?}");
    /// }
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    pub fn rsplitn<F>(&self, n: usize, pred: F) -> RSplitN<'_, T, F>
    where
        F: FnMut(&T) -> bool,
    {
        RSplitN::new(self.rsplit(pred), n)
    }

    /// 返回一个迭代器，遍历由匹配元素分隔的子切片。
    /// `pred` limited to returning at most `n` items. This starts at the end of
    /// 该切片从后向前遍历。匹配的元素并不包含在
    /// 子切片中。
    ///
    /// 如果返回了最后一个元素，则包含剩余的
    /// 切片内容。
    ///
    /// # 示例
    ///
    /// ```
    /// let mut s = [10, 40, 30, 20, 60, 50];
    ///
    /// for group in s.rsplitn_mut(2, |num| *num % 3 == 0) {
    ///     group[0] = 1;
    /// }
    /// assert_eq!(s, [1, 40, 30, 20, 60, 1]);
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    pub fn rsplitn_mut<F>(&mut self, n: usize, pred: F) -> RSplitNMut<'_, T, F>
    where
        F: FnMut(&T) -> bool,
    {
        RSplitNMut::new(self.rsplit_mut(pred), n)
    }

    /// 根据指定的谓词，在第一个匹配元素处分割切片。
    /// predicate。
    ///
    /// 如果切片中存在任何匹配元素，则返回匹配前的前缀和匹配后的后缀。匹配元素本身不
    /// before the match and suffix after. The matching element itself is not
    /// included. If no elements match, returns `None`.
    ///
    /// # 根据指定的谓词，在最后一个匹配元素处分割切片。
    ///
    /// ```
    /// let s = [1, 2, 3, 2, 4];
    /// assert_eq!(s.split_once(|&x| x == 2), Some((
    ///     &[1][..],
    ///     &[3, 2, 4][..]
    /// )));
    /// assert_eq!(s.split_once(|&x| x == 0), None);
    /// ```
    #[stable(feature = "slice_split_once", since = "1.101.0")]
    #[inline]
    pub fn split_once<F>(&self, pred: F) -> Option<(&[T], &[T])>
    where
        F: FnMut(&T) -> bool,
    {
        let index = self.iter().position(pred)?;
        // Slice bounds checks optimized are away (as of June 2026)
        Some((&self[..index], &self[index + 1..]))
    }

    /// predicate。
    /// 如果切片中存在任何匹配元素，则返回匹配前的前缀和匹配后的后缀。匹配元素本身不
    ///
    /// If any matching elements are present in the slice, returns the prefix
    /// # 示例
    /// included. If no elements match, returns `None`.
    ///
    /// # 此操作的时间复杂度为 *O*(*n*)。
    ///
    /// ```
    /// let s = [1, 2, 3, 2, 4];
    /// assert_eq!(s.rsplit_once(|&x| x == 2), Some((
    ///     &[1, 2, 3][..],
    ///     &[4][..]
    /// )));
    /// assert_eq!(s.rsplit_once(|&x| x == 0), None);
    /// ```
    #[stable(feature = "slice_split_once", since = "1.101.0")]
    #[inline]
    pub fn rsplit_once<F>(&self, pred: F) -> Option<(&[T], &[T])>
    where
        F: FnMut(&T) -> bool,
    {
        let index = self.iter().rposition(pred)?;
        // Slice bounds checks optimized are away (as of June 2026)
        Some((&self[..index], &self[index + 1..]))
    }

    /// Returns `true` if the slice contains an element with the given value.
    ///
    /// # 示例
    ///
    /// Note that if you have a sorted slice, [`binary_search`] may be faster.
    ///
    /// [`binary_search`]: slice::binary_search
    ///
    /// # Examples
    ///
    /// ```
    /// let v = [10, 40, 30];
    /// assert!(v.contains(&30));
    /// assert!(!v.contains(&50));
    /// ```
    ///
    /// If you do not have a `&T`, but some other value that you can compare
    /// with one (for example, `String` implements `PartialEq<str>`), you can
    /// use `iter().any`:
    ///
    /// ```
    /// let v = [String::from("hello"), String::from("world")]; // slice of `String`
    /// assert!(v.iter().any(|e| e == "hello")); // search with `&str`
    /// assert!(!v.iter().any(|e| e == "hi"));
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    #[must_use]
    pub fn contains(&self, x: &T) -> bool
    where
        T: PartialEq,
    {
        cmp::SliceContains::slice_contains(x, self)
    }

    /// Returns `true` if `needle` is a prefix of the slice or equal to the slice.
    ///
    /// # Examples
    ///
    /// ```
    /// let v = [10, 40, 30];
    /// assert!(v.starts_with(&[10]));
    /// assert!(v.starts_with(&[10, 40]));
    /// assert!(v.starts_with(&v));
    /// assert!(!v.starts_with(&[50]));
    /// assert!(!v.starts_with(&[10, 50]));
    /// ```
    ///
    /// Always returns `true` if `needle` is an empty slice:
    ///
    /// ```
    /// let v = &[10, 40, 30];
    /// assert!(v.starts_with(&[]));
    /// let v: &[u8] = &[];
    /// assert!(v.starts_with(&[]));
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[must_use]
    pub fn starts_with(&self, needle: &[T]) -> bool
    where
        T: PartialEq,
    {
        let n = needle.len();
        self.len() >= n && needle == &self[..n]
    }

    /// Returns `true` if `needle` is a suffix of the slice or equal to the slice.
    ///
    /// # 示例
    ///
    /// ```
    /// let v = [10, 40, 30];
    /// assert!(v.ends_with(&[30]));
    /// assert!(v.ends_with(&[40, 30]));
    /// assert!(v.ends_with(&v));
    /// assert!(!v.ends_with(&[50]));
    /// assert!(!v.ends_with(&[50, 30]));
    /// ```
    ///
    /// Always returns `true` if `needle` is an empty slice:
    ///
    /// ```
    /// let v = &[10, 40, 30];
    /// assert!(v.ends_with(&[]));
    /// let v: &[u8] = &[];
    /// assert!(v.ends_with(&[]));
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[must_use]
    pub fn ends_with(&self, needle: &[T]) -> bool
    where
        T: PartialEq,
    {
        let (m, n) = (self.len(), needle.len());
        m >= n && needle == &self[m - n..]
    }

    /// 返回去除前缀后的子切片。
    ///
    /// If the slice starts with `prefix`, returns the subslice after the prefix, wrapped in `Some`.
    /// If `prefix` is empty, simply returns the original slice. If `prefix` is equal to the
    /// 原始切片相等，则返回空切片。
    ///
    /// If the slice does not start with `prefix`, returns `None`.
    ///
    /// # 示例
    ///
    /// ```
    /// let v = &[10, 40, 30];
    /// assert_eq!(v.strip_prefix(&[10]), Some(&[40, 30][..]));
    /// assert_eq!(v.strip_prefix(&[10, 40]), Some(&[30][..]));
    /// assert_eq!(v.strip_prefix(&[10, 40, 30]), Some(&[][..]));
    /// assert_eq!(v.strip_prefix(&[50]), None);
    /// assert_eq!(v.strip_prefix(&[10, 50]), None);
    ///
    /// let prefix : &str = "he";
    /// assert_eq!(b"hello".strip_prefix(prefix.as_bytes()),
    ///            Some(b"llo".as_ref()));
    /// ```
    #[must_use = "returns the subslice without modifying the original"]
    #[stable(feature = "slice_strip", since = "1.51.0")]
    pub fn strip_prefix<P: SlicePattern<Item = T> + ?Sized>(&self, prefix: &P) -> Option<&[T]>
    where
        T: PartialEq,
    {
        // This function will need rewriting if and when SlicePattern becomes more sophisticated.
        let prefix = prefix.as_slice();
        let n = prefix.len();
        if n <= self.len() {
            let (head, tail) = self.split_at(n);
            if head == prefix {
                return Some(tail);
            }
        }
        None
    }

    /// 返回去除后缀后的子切片。
    ///
    /// If the slice ends with `suffix`, returns the subslice before the suffix, wrapped in `Some`.
    /// If `suffix` is empty, simply returns the original slice. If `suffix` is equal to the
    /// 原始切片，返回一个空切片。
    ///
    /// If the slice does not end with `suffix`, returns `None`.
    ///
    /// # 示例
    ///
    /// ```
    /// let v = &[10, 40, 30];
    /// assert_eq!(v.strip_suffix(&[30]), Some(&[10, 40][..]));
    /// assert_eq!(v.strip_suffix(&[40, 30]), Some(&[10][..]));
    /// assert_eq!(v.strip_suffix(&[10, 40, 30]), Some(&[][..]));
    /// assert_eq!(v.strip_suffix(&[50]), None);
    /// assert_eq!(v.strip_suffix(&[50, 30]), None);
    /// ```
    #[must_use = "returns the subslice without modifying the original"]
    #[stable(feature = "slice_strip", since = "1.51.0")]
    pub fn strip_suffix<P: SlicePattern<Item = T> + ?Sized>(&self, suffix: &P) -> Option<&[T]>
    where
        T: PartialEq,
    {
        // This function will need rewriting if and when SlicePattern becomes more sophisticated.
        let suffix = suffix.as_slice();
        let (len, n) = (self.len(), suffix.len());
        if n <= len {
            let (head, tail) = self.split_at(len - n);
            if tail == suffix {
                return Some(head);
            }
        }
        None
    }

    /// 返回去除前缀和后缀后的子切片。
    ///
    /// If the slice starts with `prefix`, ends with `suffix`, and
    /// 前缀和后缀不重叠，则返回在
    /// the prefix and before the suffix, wrapped in `Some`.
    ///
    /// If the slice does not start with `prefix`, does not end with `suffix`,
    /// or the prefix and suffix overlap in the slice, returns `None`.
    ///
    /// # 示例
    ///
    /// ```
    /// let v = &[10, 50, 40, 30];
    /// assert_eq!(v.strip_circumfix(&[10], &[30]), Some(&[50, 40][..]));
    /// assert_eq!(v.strip_circumfix(&[10], &[40, 30]), Some(&[50][..]));
    /// assert_eq!(v.strip_circumfix(&[10, 50], &[40, 30]), Some(&[][..]));
    /// assert_eq!(v.strip_circumfix(&[50], &[30]), None);
    /// assert_eq!(v.strip_circumfix(&[10], &[40]), None);
    /// assert_eq!(v.strip_circumfix(&[], &[40, 30]), Some(&[10, 50][..]));
    /// assert_eq!(v.strip_circumfix(&[10, 50], &[]), Some(&[40, 30][..]));
    /// assert_eq!(v.strip_circumfix(&[10, 50, 40], &[50, 40, 30]), None);
    /// ```
    #[must_use = "returns the subslice without modifying the original"]
    #[stable(feature = "strip_circumfix", since = "1.98.0")]
    pub fn strip_circumfix<S, P>(&self, prefix: &P, suffix: &S) -> Option<&[T]>
    where
        T: PartialEq,
        S: SlicePattern<Item = T> + ?Sized,
        P: SlicePattern<Item = T> + ?Sized,
    {
        self.strip_prefix(prefix)?.strip_suffix(suffix)
    }

    /// 返回去除可选前缀后的子切片。
    ///
    /// If the slice starts with `prefix`, returns the subslice after the prefix.  If `prefix`
    /// is empty or the slice does not start with `prefix`, simply returns the original slice.
    /// If `prefix` is equal to the original slice, returns an empty slice.
    ///
    /// # 示例
    ///
    /// ```
    /// let v = &[10, 40, 30];
    ///
    /// // Prefix present - removes it
    /// assert_eq!(v.trim_prefix(&[10]), &[40, 30][..]);
    /// assert_eq!(v.trim_prefix(&[10, 40]), &[30][..]);
    /// assert_eq!(v.trim_prefix(&[10, 40, 30]), &[][..]);
    ///
    /// // Prefix absent - returns original slice
    /// assert_eq!(v.trim_prefix(&[50]), &[10, 40, 30][..]);
    /// assert_eq!(v.trim_prefix(&[10, 50]), &[10, 40, 30][..]);
    ///
    /// let prefix : &str = "he";
    /// assert_eq!(b"hello".trim_prefix(prefix.as_bytes()), b"llo".as_ref());
    /// ```
    #[must_use = "returns the subslice without modifying the original"]
    #[stable(feature = "trim_prefix_suffix", since = "1.100.0")]
    pub fn trim_prefix<P: SlicePattern<Item = T> + ?Sized>(&self, prefix: &P) -> &[T]
    where
        T: PartialEq,
    {
        // This function will need rewriting if and when SlicePattern becomes more sophisticated.
        let prefix = prefix.as_slice();
        let n = prefix.len();
        if n <= self.len() {
            let (head, tail) = self.split_at(n);
            if head == prefix {
                return tail;
            }
        }
        self
    }

    /// 返回去除可选后缀后的子切片。
    ///
    /// If the slice ends with `suffix`, returns the subslice before the suffix.  If `suffix`
    /// is empty or the slice does not end with `suffix`, simply returns the original slice.
    /// If `suffix` is equal to the original slice, returns an empty slice.
    ///
    /// # 示例
    ///
    /// ```
    /// let v = &[10, 40, 30];
    ///
    /// // Suffix present - removes it
    /// assert_eq!(v.trim_suffix(&[30]), &[10, 40][..]);
    /// assert_eq!(v.trim_suffix(&[40, 30]), &[10][..]);
    /// assert_eq!(v.trim_suffix(&[10, 40, 30]), &[][..]);
    ///
    /// // Suffix absent - returns original slice
    /// assert_eq!(v.trim_suffix(&[50]), &[10, 40, 30][..]);
    /// assert_eq!(v.trim_suffix(&[50, 30]), &[10, 40, 30][..]);
    /// ```
    #[must_use = "returns the subslice without modifying the original"]
    #[stable(feature = "trim_prefix_suffix", since = "1.100.0")]
    pub fn trim_suffix<P: SlicePattern<Item = T> + ?Sized>(&self, suffix: &P) -> &[T]
    where
        T: PartialEq,
    {
        // This function will need rewriting if and when SlicePattern becomes more sophisticated.
        let suffix = suffix.as_slice();
        let (len, n) = (self.len(), suffix.len());
        if n <= len {
            let (head, tail) = self.split_at(len - n);
            if tail == suffix {
                return head;
            }
        }
        self
    }

    /// 对此切片进行二分查找给定元素。
    /// 如果切片未排序，返回的结果未指定且
    /// 无意义。
    ///
    /// If the value is found then [`Result::Ok`] is returned, containing the
    /// 索引。如果有多个匹配项，则返回任意一个匹配项。索引是确定性的，
    /// 但在 Rust 的后续版本中可能会变化。
    /// deterministically, but is subject to change in future versions of Rust.
    /// If the value is not found then [`Result::Err`] is returned, containing
    /// the index where a matching element could be inserted while maintaining
    /// # 示例
    ///
    /// See also [`binary_search_by`], [`binary_search_by_key`], and [`partition_point`].
    ///
    /// [`binary_search_by`]: slice::binary_search_by
    /// [`binary_search_by_key`]: slice::binary_search_by_key
    /// [`partition_point`]: slice::partition_point
    ///
    /// # Examples
    ///
    /// Looks up a series of four elements. The first is found, with a
    /// uniquely determined position; the second and third are not
    /// found; the fourth could match any position in `[1, 4]`.
    ///
    /// ```
    /// let s = [0, 1, 1, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55];
    ///
    /// assert_eq!(s.binary_search(&13),  Ok(9));
    /// assert_eq!(s.binary_search(&4),   Err(7));
    /// assert_eq!(s.binary_search(&100), Err(13));
    /// let r = s.binary_search(&1);
    /// assert!(match r { Ok(1..=4) => true, _ => false, });
    /// ```
    ///
    /// 比较器函数应返回指示顺序的代码
    /// an arbitrary matching one, that can be done using [`partition_point`]:
    /// ```
    /// let s = [0, 1, 1, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55];
    ///
    /// let low = s.partition_point(|x| x < &1);
    /// assert_eq!(low, 1);
    /// let high = s.partition_point(|x| x <= &1);
    /// assert_eq!(high, 5);
    /// let r = s.binary_search(&1);
    /// assert!((low..high).contains(&r.unwrap()));
    ///
    /// assert!(s[..low].iter().all(|&x| x < 1));
    /// assert!(s[low..high].iter().all(|&x| x == 1));
    /// assert!(s[high..].iter().all(|&x| x > 1));
    ///
    /// // For something not found, the "range" of equal items is empty
    /// assert_eq!(s.partition_point(|x| x < &11), 9);
    /// assert_eq!(s.partition_point(|x| x <= &11), 9);
    /// assert_eq!(s.binary_search(&11), Err(9));
    /// ```
    ///
    /// If you want to insert an item to a sorted vector, while maintaining
    /// sort order, consider using [`partition_point`]:
    ///
    /// ```
    /// let mut s = vec![0, 1, 1, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55];
    /// let num = 42;
    /// let idx = s.partition_point(|&x| x <= num);
    /// // If `num` is unique, `s.partition_point(|&x| x < num)` (with `<`) is equivalent to
    /// // `s.binary_search(&num).unwrap_or_else(|x| x)`, but using `<=` will allow `insert`
    /// // to shift less elements.
    /// s.insert(idx, num);
    /// assert_eq!(s, [0, 1, 1, 1, 1, 2, 3, 5, 8, 13, 21, 34, 42, 55]);
    /// ```
    #[rustc_const_unstable(feature = "const_binary_search", issue = "159532")]
    #[stable(feature = "rust1", since = "1.0.0")]
    pub const fn binary_search(&self, x: &T) -> Result<usize, usize>
    where
        T: [const] Ord,
    {
        self.binary_search_by(const |p| p.cmp(x))
    }

    /// Binary searches this slice with a comparator function.
    ///
    /// The comparator function should return an order code that indicates
    /// whether its argument is `Less`, `Equal` or `Greater` the desired
    /// 目标。
    /// 如果切片未排序或比较函数未能
    /// 实现与底层切片排序顺序一致的排序规则，则返回结果不明确且无意义。
    /// slice, the returned result is unspecified and meaningless.
    ///
    /// If the value is found then [`Result::Ok`] is returned, containing the
    /// index of the matching element. If there are multiple matches, then any
    /// # 示例
    /// deterministically, but is subject to change in future versions of Rust.
    /// If the value is not found then [`Result::Err`] is returned, containing
    /// 假设切片按键排序，例如使用相同的键提取函数。
    /// 如果切片不是按键排序，则返回结果不明确且无意义。
    ///
    /// See also [`binary_search`], [`binary_search_by_key`], and [`partition_point`].
    ///
    /// [`binary_search`]: slice::binary_search
    /// [`binary_search_by_key`]: slice::binary_search_by_key
    /// [`partition_point`]: slice::partition_point
    ///
    /// # 示例
    ///
    /// Looks up a series of four elements. The first is found, with a
    /// 使用键提取函数对切片进行二分查找。
    /// found; the fourth could match any position in `[1, 4]`.
    ///
    /// ```
    /// let s = [0, 1, 1, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55];
    ///
    /// let seek = 13;
    /// assert_eq!(s.binary_search_by(|probe| probe.cmp(&seek)), Ok(9));
    /// let seek = 4;
    /// assert_eq!(s.binary_search_by(|probe| probe.cmp(&seek)), Err(7));
    /// let seek = 100;
    /// assert_eq!(s.binary_search_by(|probe| probe.cmp(&seek)), Err(13));
    /// let seek = 1;
    /// let r = s.binary_search_by(|probe| probe.cmp(&seek));
    /// assert!(match r { Ok(1..=4) => true, _ => false, });
    /// ```
    #[rustc_const_unstable(feature = "const_binary_search", issue = "159532")]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    pub const fn binary_search_by<'a, F>(&'a self, mut f: F) -> Result<usize, usize>
    where
        F: [const] FnMut(&'a T) -> Ordering + [const] Destruct,
    {
        let mut size = self.len();
        if size == 0 {
            return Err(0);
        }
        let mut base = 0usize;

        // This loop intentionally doesn't have an early exit if the comparison
        // returns Equal. We want the number of loop iterations to depend *only*
        // on the size of the input slice so that the CPU can reliably predict
        // the loop count.
        while size > 1 {
            let half = size / 2;
            let mid = base + half;

            // SAFETY: the call is made safe by the following invariants:
            // - `mid >= 0`: by definition
            // - `mid < size`: `mid = size / 2 + size / 4 + size / 8 ...`
            let cmp = f(unsafe { self.get_unchecked(mid) });

            // Binary search interacts poorly with branch prediction, so force
            // the compiler to use conditional moves if supported by the target
            // architecture.
            base = hint::select_unpredictable(cmp == Greater, base, mid);

            // This is imprecise in the case where `size` is odd and the
            // comparison returns Greater: the mid element still gets included
            // by `size` even though it's known to be larger than the element
            // being searched for.
            //
            // This is fine though: we gain more performance by keeping the
            // loop iteration count invariant (and thus predictable) than we
            // lose from considering one additional element.
            size -= half;
        }

        // SAFETY: base is always in [0, size) because base <= mid.
        let cmp = f(unsafe { self.get_unchecked(base) });
        if cmp == Equal {
            // SAFETY: same as the `get_unchecked` above.
            unsafe { hint::assert_unchecked(base < self.len()) };
            Ok(base)
        } else {
            let result = base + (cmp == Less) as usize;
            // SAFETY: same as the `get_unchecked` above.
            // Note that this is `<=`, unlike the assume in the `Ok` path.
            unsafe { hint::assert_unchecked(result <= self.len()) };
            Err(result)
        }
    }

    /// 如果切片不是按键排序，则返回结果不明确且无意义。
    ///
    /// Assumes that the slice is sorted by the key, for instance with
    /// [`sort_by_key`] using the same key extraction function.
    /// If the slice is not sorted by the key, the returned result is
    /// # 示例
    ///
    /// If the value is found then [`Result::Ok`] is returned, containing the
    /// 将切片按升序排序，**但不**保持相等元素的原始顺序。
    /// 此排序是不稳定的（即可能重新排序相等元素），是原地排序的（即不
    /// 分配内存），且最坏情况下为 *O*(*n* \* log(*n*))。
    /// If the value is not found then [`Result::Err`] is returned, containing
    /// the index where a matching element could be inserted while maintaining
    /// sorted order.
    ///
    /// See also [`binary_search`], [`binary_search_by`], and [`partition_point`].
    ///
    /// [`sort_by_key`]: slice::sort_by_key
    /// [`binary_search`]: slice::binary_search
    /// [`binary_search_by`]: slice::binary_search_by
    /// [`partition_point`]: slice::partition_point
    ///
    /// # Examples
    ///
    /// Looks up a series of four elements in a slice of pairs sorted by
    /// their second elements. The first is found, with a uniquely
    /// determined position; the second and third are not found; the
    /// fourth could match any position in `[1, 4]`.
    ///
    /// ```
    /// let s = [(0, 0), (2, 1), (4, 1), (5, 1), (3, 1),
    ///          (1, 2), (2, 3), (4, 5), (5, 8), (3, 13),
    ///          (1, 21), (2, 34), (4, 55)];
    ///
    /// assert_eq!(s.binary_search_by_key(&13, |&(a, b)| b),  Ok(9));
    /// assert_eq!(s.binary_search_by_key(&4, |&(a, b)| b),   Err(7));
    /// assert_eq!(s.binary_search_by_key(&100, |&(a, b)| b), Err(13));
    /// let r = s.binary_search_by_key(&1, |&(a, b)| b);
    /// assert!(match r { Ok(1..=4) => true, _ => false, });
    /// ```
    // Lint rustdoc::broken_intra_doc_links is allowed as `slice::sort_by_key` is
    // in crate `alloc`, and as such doesn't exists yet when building `core`: #74481.
    // This breaks links when slice is displayed in core, but changing it to use relative links
    // would break when the item is re-exported. So allow the core links to be broken for now.
    #[allow(rustdoc::broken_intra_doc_links)]
    #[rustc_const_unstable(feature = "const_binary_search", issue = "159532")]
    #[stable(feature = "slice_binary_search_by_key", since = "1.10.0")]
    #[inline]
    pub const fn binary_search_by_key<'a, B, F>(&'a self, b: &B, mut f: F) -> Result<usize, usize>
    where
        F: [const] FnMut(&'a T) -> B + [const] Destruct,
        B: [const] Ord + [const] Destruct,
    {
        self.binary_search_by(const |k| f(k).cmp(b))
    }

    /// Sorts the slice in ascending order **without** preserving the initial order of equal elements.
    ///
    /// This sort is unstable (i.e., may reorder equal elements), in-place (i.e., does not
    /// allocate), and *O*(*n* \* log(*n*)) worst-case.
    ///
    /// If the implementation of [`Ord`] for `T` does not implement a [total order], the function
    /// may panic; even if the function exits normally, the resulting order of elements in the slice
    /// 未指定。请参阅下面的 panic 说明。
    ///
    /// For example `|a, b| (a - b).cmp(a)` is a comparison function that is neither transitive nor
    /// reflexive nor total, `a < b < c < a` with `a = 1, b = 2, c = 3`. For more information and
    /// examples see the [`Ord`] documentation.
    ///
    ///
    /// 所有原始元素将保留在切片中，任何通过内部
    /// mutability are observed in the input. Same is true if the implementation of [`Ord`] for `T` panics.
    ///
    /// Sorting types that only implement [`PartialOrd`] such as [`f32`] and [`f64`] require
    /// additional precautions. For example, `f32::NAN != f32::NAN`, which doesn't fulfill the
    /// reflexivity requirement of [`Ord`]. By using an alternative comparison function with
    /// `slice::sort_unstable_by` such as [`f32::total_cmp`] or [`f64::total_cmp`] that defines a
    /// [全序] 用户可以对包含浮点值的切片进行排序。或者，如果切片中的所有
    /// values in the slice are guaranteed to be in a subset for which [`PartialOrd::partial_cmp`]
    /// 形成的 [全序]，则可以使用 `sort_unstable_by(|a, b|
    /// a.partial_cmp(b).unwrap())` 对切片进行排序。
    ///
    /// # 当前实现
    ///
    /// 当前实现基于 Lukas Bergdoll 和 Orson Peters 的 [ipnsort]，该算法
    /// 结合了快速平均情况的快速排序和快速最坏情况的堆排序，实现了
    /// 在完全排序和反向输入上的线性时间复杂度。对于包含 k 个不同元素的输入，
    /// 排序数据的预期时间为 *O*(*n* \* log(*k*))。
    ///
    /// 通常比稳定排序更快，但在少数特殊情况下除外，例如当切片部分已排序时。
    /// # panic
    ///
    /// # Panics
    ///
    /// May panic if the implementation of [`Ord`] for `T` does not implement a [total order], or if
    /// the [`Ord`] implementation panics.
    ///
    /// # 使用比较函数将切片按升序排序，**不会**保留
    ///
    /// ```
    /// let mut v = [4, -5, 1, -3, 2];
    ///
    /// v.sort_unstable();
    /// assert_eq!(v, [-5, -3, 1, 2, 4]);
    /// ```
    ///
    /// [ipnsort]: https://github.com/Voultapher/sort-research-rs/tree/main/ipnsort
    /// [total order]: https://en.wikipedia.org/wiki/Total_order
    #[stable(feature = "sort_unstable", since = "1.20.0")]
    #[inline]
    pub fn sort_unstable(&mut self)
    where
        T: Ord,
    {
        sort::unstable::sort(self, &mut T::lt);
    }

    /// 相等元素的初始顺序。
    /// 此排序是不稳定的（即可能重新排序相等元素），是原地排序（即不
    ///
    /// 分配内存），最坏情况为 *O*(*n* \* log(*n*))。
    /// allocate), and *O*(*n* \* log(*n*)) worst-case.
    ///
    /// If the comparison function `compare` does not implement a [total order], the function
    /// may panic; even if the function exits normally, the resulting order of elements in the slice
    /// is unspecified. See also the note on panicking below.
    ///
    /// For example `|a, b| (a - b).cmp(a)` is a comparison function that is neither transitive nor
    /// reflexive nor total, `a < b < c < a` with `a = 1, b = 2, c = 3`. For more information and
    /// examples see the [`Ord`] documentation.
    ///
    /// 所有原始元素将保留在切片中，任何通过内部机制进行的修改均会生效。
    /// mutability are observed in the input. Same is true if `compare` panics.
    ///
    /// # 当前实现
    ///
    /// 当前实现基于 Lukas Bergdoll 和 Orson Peters 编写的 [ipnsort]，该算法
    /// 结合了快速排序的平均性能与堆排序的最坏性能，从而实现
    /// 在完全排序和反转输入上达到线性时间复杂度。对于包含 k 个不同元素的输入，
    /// 排序数据的预期时间为 *O*(*n* \* log(*k*))。
    ///
    /// 通常比稳定排序更快，但在少数特殊情况下会慢，例如当切片部分已排序时。
    /// # panic 情况
    ///
    /// # Panics
    ///
    /// May panic if the `compare` does not implement a [total order], or if
    /// the `compare` itself panics.
    ///
    /// # 使用键提取函数将切片按升序排序，**但不**保留相等元素的初始顺序。
    ///
    /// ```
    /// let mut v = [4, -5, 1, -3, 2];
    /// v.sort_unstable_by(|a, b| a.cmp(b));
    /// assert_eq!(v, [-5, -3, 1, 2, 4]);
    ///
    /// // reverse sorting
    /// v.sort_unstable_by(|a, b| b.cmp(a));
    /// assert_eq!(v, [4, 2, 1, -3, -5]);
    /// ```
    ///
    /// [ipnsort]: https://github.com/Voultapher/sort-research-rs/tree/main/ipnsort
    /// [total order]: https://en.wikipedia.org/wiki/Total_order
    #[stable(feature = "sort_unstable", since = "1.20.0")]
    #[inline]
    pub fn sort_unstable_by<F>(&mut self, mut compare: F)
    where
        F: FnMut(&T, &T) -> Ordering,
    {
        sort::unstable::sort(self, &mut |a, b| compare(a, b) == Ordering::Less);
    }

    /// 此排序是不稳定的（即可能重新排序相等元素），是原地排序（即不分配内存），且最坏情况为 *O*(*n* \* log(*n*))。
    /// the initial order of equal elements.
    ///
    /// This sort is unstable (i.e., may reorder equal elements), in-place (i.e., does not
    /// allocate), and *O*(*n* \* log(*n*)) worst-case.
    ///
    /// If the implementation of [`Ord`] for `K` does not implement a [total order], the function
    /// # 当前实现
    /// 当前实现基于 Lukas Bergdoll 和 Orson Peters 编写的 [ipnsort]，该算法
    ///
    /// For example `|a, b| (a - b).cmp(a)` is a comparison function that is neither transitive nor
    /// reflexive nor total, `a < b < c < a` with `a = 1, b = 2, c = 3`. For more information and
    /// examples see the [`Ord`] documentation.
    ///
    /// 通常比稳定排序更快，但在少数特殊情况下会慢，例如当切片部分已排序时。
    /// mutability are observed in the input. Same is true if the implementation of [`Ord`] for `K` panics.
    ///
    /// # Current implementation
    ///
    /// The current implementation is based on [ipnsort] by Lukas Bergdoll and Orson Peters, which
    /// combines the fast average case of quicksort with the fast worst case of heapsort, achieving
    /// linear time on fully sorted and reversed inputs. On inputs with k distinct elements, the
    /// expected time to sort the data is *O*(*n* \* log(*k*)).
    ///
    /// It is typically faster than stable sorting, except in a few special cases, e.g., when the
    /// slice is partially sorted.
    ///
    /// # Panics
    ///
    /// May panic if the implementation of [`Ord`] for `K` does not implement a [total order], or if
    /// the [`Ord`] implementation panics.
    ///
    /// # 示例
    ///
    /// ```
    /// let mut v = [4i32, -5, 1, -3, 2];
    ///
    /// v.sort_unstable_by_key(|k| k.abs());
    /// assert_eq!(v, [1, 2, -3, 4, -5]);
    /// ```
    ///
    /// [ipnsort]: https://github.com/Voultapher/sort-research-rs/tree/main/ipnsort
    /// [total order]: https://en.wikipedia.org/wiki/Total_order
    #[stable(feature = "sort_unstable", since = "1.20.0")]
    #[inline]
    pub fn sort_unstable_by_key<K, F>(&mut self, mut f: F)
    where
        F: FnMut(&T) -> K,
        K: Ord,
    {
        sort::unstable::sort(self, &mut |a, b| f(a).lt(&f(b)));
    }

    /// 仅部分地对切片进行升序排序，**不**保留相等元素的原始顺序。
    ///
    /// Upon completion, for the specified range `start..end`, it's guaranteed that:
    ///
    /// 1. Every element in `self[..start]` is smaller than or equal to
    /// 2. Every element in `self[start..end]`, which is sorted, and smaller than or equal to
    /// 3. Every element in `self[end..]`.
    ///
    /// 这种部分排序是不稳定的，意味着它可能会重新排序指定范围内的相等元素。
    /// 它也可能重新排序指定范围外的元素，但上述保证仍然成立。
    ///
    /// 这种部分排序是原地进行的（即不分配内存），最坏情况下为*O*(*n* + *k* \* log(*k*))，
    /// 其中*n*是切片的长度，*k*是指定范围的长度。
    ///
    /// See the documentation of [`sort_unstable`] for implementation notes.
    ///
    /// # panic
    ///
    /// May panic if the implementation of [`Ord`] for `T` does not implement a total order, or if
    /// the [`Ord`] implementation panics, or if the specified range is out of bounds.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(slice_partial_sort_unstable)]
    ///
    /// let mut v = [4, -5, 1, -3, 2];
    ///
    /// // empty range at the beginning, nothing changed
    /// v.partial_sort_unstable(0..0);
    /// assert_eq!(v, [4, -5, 1, -3, 2]);
    ///
    /// // empty range in the middle, partitioning the slice
    /// v.partial_sort_unstable(2..2);
    /// for i in 0..2 {
    ///    assert!(v[i] <= v[2]);
    /// }
    /// for i in 3..v.len() {
    ///   assert!(v[2] <= v[i]);
    /// }
    ///
    /// // single element range, same as select_nth_unstable
    /// v.partial_sort_unstable(2..3);
    /// for i in 0..2 {
    ///    assert!(v[i] <= v[2]);
    /// }
    /// for i in 3..v.len() {
    ///   assert!(v[2] <= v[i]);
    /// }
    ///
    /// // partial sort a subrange
    /// v.partial_sort_unstable(1..4);
    /// assert_eq!(&v[1..4], [-3, 1, 2]);
    ///
    /// // partial sort the whole range, same as sort_unstable
    /// v.partial_sort_unstable(..);
    /// assert_eq!(v, [-5, -3, 1, 2, 4]);
    /// ```
    ///
    /// [`sort_unstable`]: slice::sort_unstable
    #[unstable(feature = "slice_partial_sort_unstable", issue = "149046")]
    #[inline]
    pub fn partial_sort_unstable<R>(&mut self, range: R)
    where
        T: Ord,
        R: RangeBounds<usize>,
    {
        sort::unstable::partial_sort(self, range, T::lt);
    }

    /// 使用比较函数部分地对切片进行升序排序，**不**
    /// 保留相等元素的原始顺序。
    ///
    /// Upon completion, for the specified range `start..end`, it's guaranteed that:
    ///
    /// 1. Every element in `self[..start]` is smaller than or equal to
    /// 2. Every element in `self[start..end]`, which is sorted, and smaller than or equal to
    /// 3. Every element in `self[end..]`.
    ///
    /// 这种部分排序是不稳定的，意味着它可能会重新排序指定范围内的相等元素。
    /// 它也可能重新排序指定范围外的元素，但上述保证仍然成立。
    ///
    /// 这种部分排序是原地进行的（即不分配内存），最坏情况下为*O*(*n* + *k* \* log(*k*))，
    /// 其中*n*是切片的长度，*k*是指定范围的长度。
    ///
    /// See the documentation of [`sort_unstable_by`] for implementation notes.
    ///
    /// # panic
    ///
    /// May panic if the `compare` does not implement a total order, or if
    /// the `compare` itself panics, or if the specified range is out of bounds.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(slice_partial_sort_unstable)]
    ///
    /// let mut v = [4, -5, 1, -3, 2];
    ///
    /// // empty range at the beginning, nothing changed
    /// v.partial_sort_unstable_by(0..0, |a, b| b.cmp(a));
    /// assert_eq!(v, [4, -5, 1, -3, 2]);
    ///
    /// // empty range in the middle, partitioning the slice
    /// v.partial_sort_unstable_by(2..2, |a, b| b.cmp(a));
    /// for i in 0..2 {
    ///    assert!(v[i] >= v[2]);
    /// }
    /// for i in 3..v.len() {
    ///   assert!(v[2] >= v[i]);
    /// }
    ///
    /// // single element range, same as select_nth_unstable
    /// v.partial_sort_unstable_by(2..3, |a, b| b.cmp(a));
    /// for i in 0..2 {
    ///    assert!(v[i] >= v[2]);
    /// }
    /// for i in 3..v.len() {
    ///   assert!(v[2] >= v[i]);
    /// }
    ///
    /// // partial sort a subrange
    /// v.partial_sort_unstable_by(1..4, |a, b| b.cmp(a));
    /// assert_eq!(&v[1..4], [2, 1, -3]);
    ///
    /// // partial sort the whole range, same as sort_unstable
    /// v.partial_sort_unstable_by(.., |a, b| b.cmp(a));
    /// assert_eq!(v, [4, 2, 1, -3, -5]);
    /// ```
    ///
    /// [`sort_unstable_by`]: slice::sort_unstable_by
    #[unstable(feature = "slice_partial_sort_unstable", issue = "149046")]
    #[inline]
    pub fn partial_sort_unstable_by<F, R>(&mut self, range: R, mut compare: F)
    where
        F: FnMut(&T, &T) -> Ordering,
        R: RangeBounds<usize>,
    {
        sort::unstable::partial_sort(self, range, |a, b| compare(a, b) == Less);
    }

    /// 使用键提取函数部分地对切片进行升序排序，**不**
    /// 保留相等元素的原始顺序。
    ///
    /// Upon completion, for the specified range `start..end`, it's guaranteed that:
    ///
    /// 1. Every element in `self[..start]` is smaller than or equal to
    /// 2. Every element in `self[start..end]`, which is sorted, and smaller than or equal to
    /// 3. Every element in `self[end..]`.
    ///
    /// 这种部分排序是不稳定的，意味着它可能会重新排序指定范围内的相等元素。
    /// 它也可能重新排序指定范围外的元素，但上述保证仍然成立。
    ///
    /// 这种部分排序是原地进行的（即不分配内存），最坏情况下为 *O*(*n* + *k* \* log(*k*))。
    /// 其中 *n* 是切片的长度，*k* 是指定范围的长度。
    ///
    /// See the documentation of [`sort_unstable_by_key`] for implementation notes.
    ///
    /// # 异常
    ///
    /// May panic if the implementation of [`Ord`] for `K` does not implement a total order, or if
    /// the [`Ord`] implementation panics, or if the specified range is out of bounds.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(slice_partial_sort_unstable)]
    ///
    /// let mut v = [4i32, -5, 1, -3, 2];
    ///
    /// // empty range at the beginning, nothing changed
    /// v.partial_sort_unstable_by_key(0..0, |k| k.abs());
    /// assert_eq!(v, [4, -5, 1, -3, 2]);
    ///
    /// // empty range in the middle, partitioning the slice
    /// v.partial_sort_unstable_by_key(2..2, |k| k.abs());
    /// for i in 0..2 {
    ///    assert!(v[i].abs() <= v[2].abs());
    /// }
    /// for i in 3..v.len() {
    ///   assert!(v[2].abs() <= v[i].abs());
    /// }
    ///
    /// // single element range, same as select_nth_unstable
    /// v.partial_sort_unstable_by_key(2..3, |k| k.abs());
    /// for i in 0..2 {
    ///    assert!(v[i].abs() <= v[2].abs());
    /// }
    /// for i in 3..v.len() {
    ///   assert!(v[2].abs() <= v[i].abs());
    /// }
    ///
    /// // partial sort a subrange
    /// v.partial_sort_unstable_by_key(1..4, |k| k.abs());
    /// assert_eq!(&v[1..4], [2, -3, 4]);
    ///
    /// // partial sort the whole range, same as sort_unstable
    /// v.partial_sort_unstable_by_key(.., |k| k.abs());
    /// assert_eq!(v, [1, 2, -3, 4, -5]);
    /// ```
    ///
    /// [`sort_unstable_by_key`]: slice::sort_unstable_by_key
    #[unstable(feature = "slice_partial_sort_unstable", issue = "149046")]
    #[inline]
    pub fn partial_sort_unstable_by_key<K, F, R>(&mut self, range: R, mut f: F)
    where
        F: FnMut(&T) -> K,
        K: Ord,
        R: RangeBounds<usize>,
    {
        sort::unstable::partial_sort(self, range, |a, b| f(a).lt(&f(b)));
    }

    /// Reorders the slice such that the element at `index` is at a sort-order position. All
    /// elements before `index` will be `<=` to this value, and all elements after will be `>=` to
    /// it.
    ///
    /// 这种重新排序是不稳定的（即任何与第 n 个元素相等的元素都可能结束于该位置），是原地进行的（即不分配内存），运行时间为 *O*(*n*)。
    /// 此函数在其他库中也被称为“第 k 个元素”。
    /// 返回一个三元组来划分重新排序后的切片：
    ///
    /// Returns a triple that partitions the reordered slice:
    ///
    /// * The unsorted subslice before `index`, whose elements all satisfy `x <= self[index]`.
    ///
    /// * The element at `index`.
    ///
    /// * The unsorted subslice after `index`, whose elements all satisfy `x >= self[index]`.
    ///
    /// # 当前实现
    ///
    /// The current algorithm is an introselect implementation based on [ipnsort] by Lukas Bergdoll
    /// and Orson Peters, which is also the basis for [`sort_unstable`]. The fallback algorithm is
    /// # 异常
    /// for all inputs.
    ///
    /// [`sort_unstable`]: slice::sort_unstable
    ///
    /// # 异常
    ///
    /// Panics when `index >= len()`, and so always panics on empty slices.
    ///
    /// May panic if the implementation of [`Ord`] for `T` does not implement a [total order].
    ///
    /// # 示例
    ///
    /// ```
    /// let mut v = [-5i32, 4, 2, -3, 1];
    ///
    /// // Find the items `<=` to the median, the median itself, and the items `>=` to it.
    /// let (lesser, median, greater) = v.select_nth_unstable(2);
    ///
    /// assert!(lesser == [-3, -5] || lesser == [-5, -3]);
    /// assert_eq!(median, &mut 1);
    /// assert!(greater == [4, 2] || greater == [2, 4]);
    ///
    /// // We are only guaranteed the slice will be one of the following, based on the way we sort
    /// // about the specified index.
    /// assert!(v == [-3, -5, 1, 2, 4] ||
    ///         v == [-5, -3, 1, 2, 4] ||
    ///         v == [-3, -5, 1, 4, 2] ||
    ///         v == [-5, -3, 1, 4, 2]);
    /// ```
    ///
    /// [ipnsort]: https://github.com/Voultapher/sort-research-rs/tree/main/ipnsort
    /// [total order]: https://en.wikipedia.org/wiki/Total_order
    #[stable(feature = "slice_select_nth_unstable", since = "1.49.0")]
    #[inline]
    pub fn select_nth_unstable(&mut self, index: usize) -> (&mut [T], &mut T, &mut [T])
    where
        T: Ord,
    {
        sort::select::partition_at_index(self, index, T::lt)
    }

    /// Reorders the slice with a comparator function such that the element at `index` is at a
    /// sort-order position. All elements before `index` will be `<=` to this value, and all
    /// elements after will be `>=` to it, according to the comparator function.
    ///
    /// 这种重新排序是不稳定的（即任何与第 n 个元素相等的元素都可能结束于该位置）。
    /// 该算法位于该位置，采用原地操作（即不分配内存），运行时间为 *O*(*n*)。此函数
    /// 在其他库中也被称为“第 k 个元素”函数。
    ///
    /// 返回一个三元组，对重新排序的切片进行划分：
    ///
    /// * The unsorted subslice before `index`, whose elements all satisfy
    ///   `compare(x, self[index]).is_le()`.
    ///
    /// * The element at `index`.
    ///
    /// * The unsorted subslice after `index`, whose elements all satisfy
    ///   `compare(x, self[index]).is_ge()`.
    ///
    /// # 当前实现
    ///
    /// The current algorithm is an introselect implementation based on [ipnsort] by Lukas Bergdoll
    /// and Orson Peters, which is also the basis for [`sort_unstable`]. The fallback algorithm is
    /// 使用 Tukey 的 Ninther 进行中位数中位数选择作为枢轴选择方法，可保证所有输入数据的线性运行时间。
    /// # 异常
    ///
    /// [`sort_unstable`]: slice::sort_unstable
    ///
    /// # Panics
    ///
    /// Panics when `index >= len()`, and so always panics on empty slices.
    ///
    /// May panic if `compare` does not implement a [total order].
    ///
    /// # 示例
    ///
    /// ```
    /// let mut v = [-5i32, 4, 2, -3, 1];
    ///
    /// // Find the items `>=` to the median, the median itself, and the items `<=` to it, by using
    /// // a reversed comparator.
    /// let (before, median, after) = v.select_nth_unstable_by(2, |a, b| b.cmp(a));
    ///
    /// assert!(before == [4, 2] || before == [2, 4]);
    /// assert_eq!(median, &mut 1);
    /// assert!(after == [-3, -5] || after == [-5, -3]);
    ///
    /// // We are only guaranteed the slice will be one of the following, based on the way we sort
    /// // about the specified index.
    /// assert!(v == [2, 4, 1, -5, -3] ||
    ///         v == [2, 4, 1, -3, -5] ||
    ///         v == [4, 2, 1, -5, -3] ||
    ///         v == [4, 2, 1, -3, -5]);
    /// ```
    ///
    /// [ipnsort]: https://github.com/Voultapher/sort-research-rs/tree/main/ipnsort
    /// [total order]: https://en.wikipedia.org/wiki/Total_order
    #[stable(feature = "slice_select_nth_unstable", since = "1.49.0")]
    #[inline]
    pub fn select_nth_unstable_by<F>(
        &mut self,
        index: usize,
        mut compare: F,
    ) -> (&mut [T], &mut T, &mut [T])
    where
        F: FnMut(&T, &T) -> Ordering,
    {
        sort::select::partition_at_index(self, index, |a: &T, b: &T| compare(a, b) == Less)
    }

    /// Reorders the slice with a key extraction function such that the element at `index` is at a
    /// sort-order position. All elements before `index` will have keys `<=` to the key at `index`,
    /// and all elements after will have keys `>=` to it.
    ///
    /// 这种重新排序是不稳定的（即任何与第 n 个元素相等的元素都可能最终位于该位置），采用原地操作（即不分配内存），运行时间为 *O*(*n*)。此函数
    /// 在其他库中也被称为“第 k 个元素”函数。
    /// 返回一个三元组，对重新排序的切片进行划分：
    ///
    /// Returns a triple partitioning the reordered slice:
    ///
    /// * The unsorted subslice before `index`, whose elements all satisfy `f(x) <= f(self[index])`.
    ///
    /// * The element at `index`.
    ///
    /// * The unsorted subslice after `index`, whose elements all satisfy `f(x) >= f(self[index])`.
    ///
    /// # Current implementation
    ///
    /// 使用 Tukey 的 Ninther 进行中位数中位数选择作为枢轴选择方法，可保证所有输入数据的线性运行时间。
    /// and Orson Peters, which is also the basis for [`sort_unstable`]. The fallback algorithm is
    /// Median of Medians using Tukey's Ninther for pivot selection, which guarantees linear runtime
    /// for all inputs.
    ///
    /// [`sort_unstable`]: slice::sort_unstable
    ///
    /// # 示例
    ///
    /// Panics when `index >= len()`, meaning it always panics on empty slices.
    ///
    /// May panic if `K: Ord` does not implement a total order.
    ///
    /// # 第二个切片包含所有重复元素，但顺序不确定。
    ///
    /// ```
    /// let mut v = [-5i32, 4, 1, -3, 2];
    ///
    /// // Find the items `<=` to the absolute median, the absolute median itself, and the items
    /// // `>=` to it.
    /// let (lesser, median, greater) = v.select_nth_unstable_by_key(2, |a| a.abs());
    ///
    /// assert!(lesser == [1, 2] || lesser == [2, 1]);
    /// assert_eq!(median, &mut -3);
    /// assert!(greater == [4, -5] || greater == [-5, 4]);
    ///
    /// // We are only guaranteed the slice will be one of the following, based on the way we sort
    /// // about the specified index.
    /// assert!(v == [1, 2, -3, 4, -5] ||
    ///         v == [1, 2, -3, -5, 4] ||
    ///         v == [2, 1, -3, 4, -5] ||
    ///         v == [2, 1, -3, -5, 4]);
    /// ```
    ///
    /// [ipnsort]: https://github.com/Voultapher/sort-research-rs/tree/main/ipnsort
    /// [total order]: https://en.wikipedia.org/wiki/Total_order
    #[stable(feature = "slice_select_nth_unstable", since = "1.49.0")]
    #[inline]
    pub fn select_nth_unstable_by_key<K, F>(
        &mut self,
        index: usize,
        mut f: F,
    ) -> (&mut [T], &mut T, &mut [T])
    where
        F: FnMut(&T) -> K,
        K: Ord,
    {
        sort::select::partition_at_index(self, index, |a: &T, b: &T| f(a).lt(&f(b)))
    }

    /// 如果切片已排序，第一个返回的切片将不包含重复元素。
    /// [`PartialEq`] trait implementation.
    ///
    /// Returns two slices. The first contains no consecutive repeated elements.
    /// The second contains all the duplicates in no specified order.
    ///
    /// If the slice is sorted, the first returned slice contains no duplicates.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(slice_partition_dedup)]
    ///
    /// let mut slice = [1, 2, 2, 3, 3, 2, 1, 1];
    ///
    /// let (dedup, duplicates) = slice.partition_dedup();
    ///
    /// assert_eq!(dedup, [1, 2, 3, 2, 1]);
    /// assert_eq!(duplicates, [2, 3, 1]);
    /// ```
    #[unstable(feature = "slice_partition_dedup", issue = "54279")]
    #[inline]
    pub fn partition_dedup(&mut self) -> (&mut [T], &mut [T])
    where
        T: PartialEq,
    {
        self.partition_dedup_by(|a, b| a == b)
    }

    /// 将连续元素中除第一个之外的所有元素移动到切片的末尾，
    /// 根据给定的谓词函数判断为“相等”。
    ///
    /// 返回两个切片。第一个切片中没有连续的重复元素。
    /// 第二个切片中包含所有的重复元素，但顺序不确定。
    ///
    /// The predicate `same_bucket(x, p)` is passed references to two elements from
    /// the slice and must determine if the elements compare equal. The element `p` occurs
    /// *before* `x` in the slice (`[.., p, .., x, ..]`), so `same_bucket(x, p)`
    /// 是以相反的顺序接收它们的。
    ///
    /// 如果切片已排序，第一个返回的切片中没有重复元素。对于更复杂的
    /// 谓词，顺序（升序或降序）可能很重要。
    ///
    /// Both references passed to `same_bucket` are mutable.
    /// This allows merged elements in the first slice by mutating `p` and returning `true`.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(slice_partition_dedup)]
    ///
    /// let mut slice = ["foo", "Foo", "BAZ", "Bar", "bar", "baz", "BAZ"];
    ///
    /// let (dedup, duplicates) = slice.partition_dedup_by(|x, p| x.eq_ignore_ascii_case(p));
    ///
    /// assert_eq!(dedup, ["foo", "BAZ", "Bar", "baz"]);
    /// assert_eq!(duplicates, ["bar", "Foo", "BAZ"]);
    /// ```
    #[unstable(feature = "slice_partition_dedup", issue = "54279")]
    #[inline]
    pub fn partition_dedup_by<F>(&mut self, mut same_bucket: F) -> (&mut [T], &mut [T])
    where
        F: FnMut(&mut T, &mut T) -> bool,
    {
        // Although we have a mutable reference to `self`, we cannot make
        // *arbitrary* changes. The `same_bucket` calls could panic, so we
        // must ensure that the slice is in a valid state at all times.
        //
        // The way that we handle this is by using swaps; we iterate
        // over all the elements, swapping as we go so that at the end
        // the elements we wish to keep are in the front, and those we
        // wish to reject are at the back. We can then split the slice.
        // This operation is still `O(n)`.
        //
        // Example: We start in this state, where `r` represents "next
        // read" and `w` represents "next_write".
        //
        //           r
        //     +---+---+---+---+---+---+
        //     | 0 | 1 | 1 | 2 | 3 | 3 |
        //     +---+---+---+---+---+---+
        //           w
        //
        // Comparing self[r] against self[w-1], this is not a duplicate, so
        // we swap self[r] and self[w] (no effect as r==w) and then increment both
        // r and w, leaving us with:
        //
        //               r
        //     +---+---+---+---+---+---+
        //     | 0 | 1 | 1 | 2 | 3 | 3 |
        //     +---+---+---+---+---+---+
        //               w
        //
        // Comparing self[r] against self[w-1], this value is a duplicate,
        // so we increment `r` but leave everything else unchanged:
        //
        //                   r
        //     +---+---+---+---+---+---+
        //     | 0 | 1 | 1 | 2 | 3 | 3 |
        //     +---+---+---+---+---+---+
        //               w
        //
        // Comparing self[r] against self[w-1], this is not a duplicate,
        // so swap self[r] and self[w] and advance r and w:
        //
        //                       r
        //     +---+---+---+---+---+---+
        //     | 0 | 1 | 2 | 1 | 3 | 3 |
        //     +---+---+---+---+---+---+
        //                   w
        //
        // Not a duplicate, repeat:
        //
        //                           r
        //     +---+---+---+---+---+---+
        //     | 0 | 1 | 2 | 3 | 1 | 3 |
        //     +---+---+---+---+---+---+
        //                       w
        //
        // Duplicate, advance r. End of slice. Split at w.

        let len = self.len();
        if len <= 1 {
            return (self, &mut []);
        }

        let ptr = self.as_mut_ptr();
        let mut next_read: usize = 1;
        let mut next_write: usize = 1;

        // SAFETY: the `while` condition guarantees `next_read` and `next_write`
        // are less than `len`, thus are inside `self`. `prev_ptr_write` points to
        // one element before `ptr_write`, but `next_write` starts at 1, so
        // `prev_ptr_write` is never less than 0 and is inside the slice.
        // This fulfills the requirements for dereferencing `ptr_read`, `prev_ptr_write`
        // and `ptr_write`, and for using `ptr.add(next_read)`, `ptr.add(next_write - 1)`
        // and `prev_ptr_write.offset(1)`.
        //
        // `next_write` is also incremented at most once per loop at most meaning
        // no element is skipped when it may need to be swapped.
        //
        // `ptr_read` and `prev_ptr_write` never point to the same element. This
        // is required for `&mut *ptr_read`, `&mut *prev_ptr_write` to be safe.
        // The explanation is simply that `next_read >= next_write` is always true,
        // thus `next_read > next_write - 1` is too.
        unsafe {
            // Avoid bounds checks by using raw pointers.
            while next_read < len {
                let ptr_read = ptr.add(next_read);
                let prev_ptr_write = ptr.add(next_write - 1);
                if !same_bucket(&mut *ptr_read, &mut *prev_ptr_write) {
                    if next_read != next_write {
                        let ptr_write = prev_ptr_write.add(1);
                        mem::swap(&mut *ptr_read, &mut *ptr_write);
                    }
                    next_write += 1;
                }
                next_read += 1;
            }
        }

        self.split_at_mut(next_write)
    }

    /// 将连续元素中除第一个之外的所有元素移动到切片的末尾，这些元素满足
    /// 相同的键。
    ///
    /// 返回两个切片。第一个切片中没有连续的重复元素。
    /// 第二个切片中包含所有的重复元素，但顺序不确定。
    ///
    /// 如果切片已排序，第一个返回的切片中没有重复元素。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(slice_partition_dedup)]
    ///
    /// let mut slice = [10, 20, 21, 30, 30, 20, 11, 13];
    ///
    /// let (dedup, duplicates) = slice.partition_dedup_by_key(|i| *i / 10);
    ///
    /// assert_eq!(dedup, [10, 20, 30, 20, 11]);
    /// assert_eq!(duplicates, [21, 30, 13]);
    /// ```
    #[unstable(feature = "slice_partition_dedup", issue = "54279")]
    #[inline]
    pub fn partition_dedup_by_key<K, F>(&mut self, mut key: F) -> (&mut [T], &mut [T])
    where
        F: FnMut(&mut T) -> K,
        K: PartialEq,
    {
        self.partition_dedup_by(|a, b| key(a) == key(b))
    }

    /// Rotates the slice in-place such that the first `mid` elements of the
    /// slice move to the end while the last `self.len() - mid` elements move to
    /// the front.
    ///
    /// After calling `rotate_left`, the element previously at index `mid` will
    /// # 恐慌
    ///
    /// # Panics
    ///
    /// This function will panic if `mid` is greater than the length of the
    /// slice. Note that `mid == self.len()` does _not_ panic and is a no-op
    /// # 复杂度
    ///
    /// # Complexity
    ///
    /// Takes linear (in `self.len()`) time.
    ///
    /// # 示例
    ///
    /// ```
    /// let mut a = ['a', 'b', 'c', 'd', 'e', 'f'];
    /// a.rotate_left(2);
    /// assert_eq!(a, ['c', 'd', 'e', 'f', 'a', 'b']);
    /// ```
    ///
    /// 旋转子切片：
    ///
    /// ```
    /// let mut a = ['a', 'b', 'c', 'd', 'e', 'f'];
    /// a[1..5].rotate_left(1);
    /// assert_eq!(a, ['a', 'c', 'd', 'e', 'b', 'f']);
    /// ```
    #[stable(feature = "slice_rotate", since = "1.26.0")]
    #[rustc_const_stable(feature = "const_slice_rotate", since = "1.92.0")]
    pub const fn rotate_left(&mut self, mid: usize) {
        assert!(mid <= self.len());
        let k = self.len() - mid;
        let p = self.as_mut_ptr();

        // SAFETY: The range `[p.add(mid) - mid, p.add(mid) + k)` is trivially
        // valid for reading and writing, as required by `ptr_rotate`.
        unsafe {
            rotate::ptr_rotate(mid, p.add(mid), k);
        }
    }

    /// Rotates the slice in-place such that the first `self.len() - k`
    /// elements of the slice move to the end while the last `k` elements move
    /// to the front.
    ///
    /// After calling `rotate_right`, the element previously at index
    /// `self.len() - k` will become the first element in the slice.
    ///
    /// # Panics
    ///
    /// This function will panic if `k` is greater than the length of the
    /// slice. Note that `k == self.len()` does _not_ panic and is a no-op
    /// # 复杂度
    ///
    /// # Complexity
    ///
    /// Takes linear (in `self.len()`) time.
    ///
    /// # 示例
    ///
    /// ```
    /// let mut a = ['a', 'b', 'c', 'd', 'e', 'f'];
    /// a.rotate_right(2);
    /// assert_eq!(a, ['e', 'f', 'a', 'b', 'c', 'd']);
    /// ```
    ///
    /// 旋转子切片：
    ///
    /// ```
    /// let mut a = ['a', 'b', 'c', 'd', 'e', 'f'];
    /// a[1..5].rotate_right(1);
    /// assert_eq!(a, ['a', 'e', 'b', 'c', 'd', 'f']);
    /// ```
    #[stable(feature = "slice_rotate", since = "1.26.0")]
    #[rustc_const_stable(feature = "const_slice_rotate", since = "1.92.0")]
    pub const fn rotate_right(&mut self, k: usize) {
        assert!(k <= self.len());
        let mid = self.len() - k;
        let p = self.as_mut_ptr();

        // SAFETY: The range `[p.add(mid) - mid, p.add(mid) + k)` is trivially
        // valid for reading and writing, as required by `ptr_rotate`.
        unsafe {
            rotate::ptr_rotate(mid, p.add(mid), k);
        }
    }

    /// Moves the elements of this slice `N` places to the left, returning the ones
    /// that "fall off" the front, and putting `inserted` at the end.
    ///
    /// Equivalently, you can think of concatenating `self` and `inserted` into one
    /// long sequence, then returning the left-most `N` items and the rest into `self`:
    ///
    /// ```text
    ///           self (before)    inserted
    ///           vvvvvvvvvvvvvvv  vvv
    ///           [1, 2, 3, 4, 5]  [9]
    ///        ↙   ↙  ↙  ↙  ↙   ↙
    ///      [1]  [2, 3, 4, 5, 9]
    ///      ^^^  ^^^^^^^^^^^^^^^
    /// returned  self (after)
    /// ```
    ///
    /// See also [`Self::shift_right`] and compare [`Self::rotate_left`].
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(slice_shift)]
    ///
    /// // Same as the diagram above
    /// let mut a = [1, 2, 3, 4, 5];
    /// let inserted = [9];
    /// let returned = a.shift_left(inserted);
    /// assert_eq!(returned, [1]);
    /// assert_eq!(a, [2, 3, 4, 5, 9]);
    ///
    /// // You can shift multiple items at a time
    /// let mut a = *b"Hello world";
    /// assert_eq!(a.shift_left(*b" peace"), *b"Hello ");
    /// assert_eq!(a, *b"world peace");
    ///
    /// // The name comes from this operation's similarity to bitshifts
    /// let mut a: u8 = 0b10010110;
    /// a <<= 3;
    /// assert_eq!(a, 0b10110000_u8);
    /// let mut a: [_; 8] = [1, 0, 0, 1, 0, 1, 1, 0];
    /// a.shift_left([0; 3]);
    /// assert_eq!(a, [1, 0, 1, 1, 0, 0, 0, 0]);
    ///
    /// // Remember you can sub-slice to affect less that the whole slice.
    /// // For example, this is similar to `.remove(1)` + `.insert(4, 'Z')`
    /// let mut a = ['a', 'b', 'c', 'd', 'e', 'f'];
    /// assert_eq!(a[1..=4].shift_left(['Z']), ['b']);
    /// assert_eq!(a, ['a', 'c', 'd', 'e', 'Z', 'f']);
    ///
    /// // If the size matches it's equivalent to `mem::replace`
    /// let mut a = [1, 2, 3];
    /// assert_eq!(a.shift_left([7, 8, 9]), [1, 2, 3]);
    /// assert_eq!(a, [7, 8, 9]);
    ///
    /// // Some of the "inserted" elements end up returned if the slice is too short
    /// let mut a = [];
    /// assert_eq!(a.shift_left([1, 2, 3]), [1, 2, 3]);
    /// let mut a = [9];
    /// assert_eq!(a.shift_left([1, 2, 3]), [9, 1, 2]);
    /// assert_eq!(a, [3]);
    /// ```
    #[unstable(feature = "slice_shift", issue = "151772")]
    pub const fn shift_left<const N: usize>(&mut self, inserted: [T; N]) -> [T; N] {
        if let Some(shift) = self.len().checked_sub(N) {
            // SAFETY: Having just checked that the inserted/returned arrays are
            // shorter than (or the same length as) the slice:
            // 1. The read for the items to return is in-bounds
            // 2. We can `memmove` the slice over to cover the items we're returning
            //    to ensure those aren't double-dropped
            // 3. Then we write (in-bounds for the same reason as the read) the
            //    inserted items atop the items of the slice that we just duplicated
            //
            // And none of this can panic, so there's no risk of intermediate unwinds.
            unsafe {
                let ptr = self.as_mut_ptr();
                let returned = ptr.cast_array::<N>().read();
                ptr.copy_from(ptr.add(N), shift);
                ptr.add(shift).cast_array::<N>().write(inserted);
                returned
            }
        } else {
            // SAFETY: Having checked that the slice is strictly shorter than the
            // inserted/returned arrays, it means we'll be copying the whole slice
            // into the returned array, but that's not enough on its own.  We also
            // need to copy some of the inserted array into the returned array,
            // with the rest going into the slice.  Because `&mut` is exclusive
            // and we own both `inserted` and `returned`, they're all disjoint
            // allocations from each other as we can use `nonoverlapping` copies.
            //
            // We avoid double-frees by `ManuallyDrop`ing the inserted items,
            // since we always copy them to other locations that will drop them
            // instead.  Plus nothing in here can panic -- it's just memcpy three
            // times -- so there's no intermediate unwinds to worry about.
            unsafe {
                let len = self.len();
                let slice = self.as_mut_ptr();
                let inserted = mem::ManuallyDrop::new(inserted);
                let inserted = (&raw const inserted).cast::<T>();

                let mut returned = MaybeUninit::<[T; N]>::uninit();
                let ptr = returned.as_mut_ptr().cast::<T>();
                ptr.copy_from_nonoverlapping(slice, len);
                ptr.add(len).copy_from_nonoverlapping(inserted, N - len);
                slice.copy_from_nonoverlapping(inserted.add(N - len), len);
                returned.assume_init()
            }
        }
    }

    /// Moves the elements of this slice `N` places to the right, returning the ones
    /// that "fall off" the back, and putting `inserted` at the beginning.
    ///
    /// Equivalently, you can think of concatenating `inserted` and `self` into one
    /// long sequence, then returning the right-most `N` items and the rest into `self`:
    ///
    /// ```text
    /// inserted  self (before)
    ///      vvv  vvvvvvvvvvvvvvv
    ///      [0]  [5, 6, 7, 8, 9]
    ///        ↘   ↘  ↘  ↘  ↘   ↘
    ///           [0, 5, 6, 7, 8]  [9]
    ///           ^^^^^^^^^^^^^^^  ^^^
    ///           self (after)     returned
    /// ```
    ///
    /// See also [`Self::shift_left`] and compare [`Self::rotate_right`].
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(slice_shift)]
    ///
    /// // Same as the diagram above
    /// let mut a = [5, 6, 7, 8, 9];
    /// let inserted = [0];
    /// let returned = a.shift_right(inserted);
    /// assert_eq!(returned, [9]);
    /// assert_eq!(a, [0, 5, 6, 7, 8]);
    ///
    /// // The name comes from this operation's similarity to bitshifts
    /// let mut a: u8 = 0b10010110;
    /// a >>= 3;
    /// assert_eq!(a, 0b00010010_u8);
    /// let mut a: [_; 8] = [1, 0, 0, 1, 0, 1, 1, 0];
    /// a.shift_right([0; 3]);
    /// assert_eq!(a, [0, 0, 0, 1, 0, 0, 1, 0]);
    ///
    /// // Remember you can sub-slice to affect less that the whole slice.
    /// // For example, this is similar to `.remove(4)` + `.insert(1, 'Z')`
    /// let mut a = ['a', 'b', 'c', 'd', 'e', 'f'];
    /// assert_eq!(a[1..=4].shift_right(['Z']), ['e']);
    /// assert_eq!(a, ['a', 'Z', 'b', 'c', 'd', 'f']);
    ///
    /// // If the size matches it's equivalent to `mem::replace`
    /// let mut a = [1, 2, 3];
    /// assert_eq!(a.shift_right([7, 8, 9]), [1, 2, 3]);
    /// assert_eq!(a, [7, 8, 9]);
    ///
    /// // Some of the "inserted" elements end up returned if the slice is too short
    /// let mut a = [];
    /// assert_eq!(a.shift_right([1, 2, 3]), [1, 2, 3]);
    /// let mut a = [9];
    /// assert_eq!(a.shift_right([1, 2, 3]), [2, 3, 9]);
    /// assert_eq!(a, [1]);
    /// ```
    #[unstable(feature = "slice_shift", issue = "151772")]
    pub const fn shift_right<const N: usize>(&mut self, inserted: [T; N]) -> [T; N] {
        if let Some(shift) = self.len().checked_sub(N) {
            // SAFETY: Having just checked that the inserted/returned arrays are
            // shorter than (or the same length as) the slice:
            // 1. The read for the items to return is in-bounds
            // 2. We can `memmove` the slice over to cover the items we're returning
            //    to ensure those aren't double-dropped
            // 3. Then we write (in-bounds for the same reason as the read) the
            //    inserted items atop the items of the slice that we just duplicated
            //
            // And none of this can panic, so there's no risk of intermediate unwinds.
            unsafe {
                let ptr = self.as_mut_ptr();
                let returned = ptr.add(shift).cast_array::<N>().read();
                ptr.add(N).copy_from(ptr, shift);
                ptr.cast_array::<N>().write(inserted);
                returned
            }
        } else {
            // SAFETY: Having checked that the slice is strictly shorter than the
            // inserted/returned arrays, it means we'll be copying the whole slice
            // into the returned array, but that's not enough on its own.  We also
            // need to copy some of the inserted array into the returned array,
            // with the rest going into the slice.  Because `&mut` is exclusive
            // and we own both `inserted` and `returned`, they're all disjoint
            // allocations from each other as we can use `nonoverlapping` copies.
            //
            // We avoid double-frees by `ManuallyDrop`ing the inserted items,
            // since we always copy them to other locations that will drop them
            // instead.  Plus nothing in here can panic -- it's just memcpy three
            // times -- so there's no intermediate unwinds to worry about.
            unsafe {
                let len = self.len();
                let slice = self.as_mut_ptr();
                let inserted = mem::ManuallyDrop::new(inserted);
                let inserted = (&raw const inserted).cast::<T>();

                let mut returned = MaybeUninit::<[T; N]>::uninit();
                let ptr = returned.as_mut_ptr().cast::<T>();
                ptr.add(N - len).copy_from_nonoverlapping(slice, len);
                ptr.copy_from_nonoverlapping(inserted.add(len), N - len);
                slice.copy_from_nonoverlapping(inserted, len);
                returned.assume_init()
            }
        }
    }

    /// Fills `self` with elements by cloning `value`.
    ///
    /// # 示例
    ///
    /// ```
    /// let mut buf = vec![0; 10];
    /// buf.fill(1);
    /// assert_eq!(buf, vec![1; 10]);
    /// ```
    #[doc(alias = "memset")]
    #[stable(feature = "slice_fill", since = "1.50.0")]
    pub fn fill(&mut self, value: T)
    where
        T: Clone,
    {
        specialize::SpecFill::spec_fill(self, value);
    }

    /// Fills `self` with elements returned by calling a closure repeatedly.
    ///
    /// 此方法使用闭包创建新值。如果你更愿意
    /// [`Clone`] a given value, use [`fill`]. If you want to use the [`Default`]
    /// trait to generate values, you can pass [`Default::default`] as the
    /// 参数传递。
    ///
    /// [`fill`]: slice::fill
    ///
    /// # 示例
    ///
    /// ```
    /// let mut buf = vec![1; 10];
    /// buf.fill_with(Default::default);
    /// assert_eq!(buf, vec![0; 10]);
    /// ```
    #[stable(feature = "slice_fill_with", since = "1.51.0")]
    pub fn fill_with<F>(&mut self, mut f: F)
    where
        F: FnMut() -> T,
    {
        for el in self {
            *el = f();
        }
    }

    /// Copies the elements from `src` into `self`.
    ///
    /// The length of `src` must be the same as `self`.
    ///
    /// # 恐慌
    ///
    /// 如果两个切片长度不同，此函数会触发恐慌。
    ///
    /// # 示例
    ///
    /// 将切片中的两个元素克隆到另一个切片中：
    ///
    /// ```
    /// let src = [1, 2, 3, 4];
    /// let mut dst = [0, 0];
    ///
    /// // Because the slices have to be the same length,
    /// // we slice the source slice from four elements
    /// // to two. It will panic if we don't do this.
    /// dst.clone_from_slice(&src[2..]);
    ///
    /// assert_eq!(src, [1, 2, 3, 4]);
    /// assert_eq!(dst, [3, 4]);
    /// ```
    ///
    /// Rust 规定一个特定数据片段只能有一个可修改的引用，不能有
    /// immutable references to a particular piece of data in a particular
    /// scope. Because of this, attempting to use `clone_from_slice` on a
    /// 切片：
    ///
    /// ```compile_fail
    /// let mut slice = [1, 2, 3, 4, 5];
    ///
    /// slice[..2].clone_from_slice(&slice[3..]); // compile fail!
    /// ```
    ///
    /// To work around this, we can use [`split_at_mut`] to create two distinct
    /// sub-slices from a slice:
    ///
    /// ```
    /// let mut slice = [1, 2, 3, 4, 5];
    ///
    /// {
    ///     let (left, right) = slice.split_at_mut(2);
    ///     left.clone_from_slice(&right[1..]);
    /// }
    ///
    /// assert_eq!(slice, [4, 5, 3, 4, 5]);
    /// ```
    ///
    /// [`copy_from_slice`]: slice::copy_from_slice
    /// [`split_at_mut`]: slice::split_at_mut
    #[stable(feature = "clone_from_slice", since = "1.7.0")]
    #[track_caller]
    #[rustc_const_unstable(feature = "const_clone", issue = "142757")]
    pub const fn clone_from_slice(&mut self, src: &[T])
    where
        T: [const] Clone + [const] Destruct,
    {
        self.spec_clone_from(src);
    }

    /// Copies all elements from `src` into `self`, using a memcpy.
    ///
    /// The length of `src` must be the same as `self`.
    ///
    /// If `T` does not implement `Copy`, use [`clone_from_slice`].
    ///
    /// # 示例
    ///
    /// 将切片中的两个元素复制到另一个切片中：
    ///
    /// # Rust 规定一个特定数据片段只能有一个可修改的引用，不能有
    ///
    /// Copying two elements from a slice into another:
    ///
    /// ```
    /// let src = [1, 2, 3, 4];
    /// let mut dst = [0, 0];
    ///
    /// // Because the slices have to be the same length,
    /// // we slice the source slice from four elements
    /// // to two. It will panic if we don't do this.
    /// dst.copy_from_slice(&src[2..]);
    ///
    /// assert_eq!(src, [1, 2, 3, 4]);
    /// assert_eq!(dst, [3, 4]);
    /// ```
    ///
    /// Rust enforces that there can only be one mutable reference with no
    /// 切片：
    /// scope. Because of this, attempting to use `copy_from_slice` on a
    /// single slice will result in a compile failure:
    ///
    /// ```compile_fail
    /// let mut slice = [1, 2, 3, 4, 5];
    ///
    /// slice[..2].copy_from_slice(&slice[3..]); // compile fail!
    /// ```
    ///
    /// To work around this, we can use [`split_at_mut`] to create two distinct
    /// 切片：
    ///
    /// ```
    /// let mut slice = [1, 2, 3, 4, 5];
    ///
    /// {
    ///     let (left, right) = slice.split_at_mut(2);
    ///     left.copy_from_slice(&right[1..]);
    /// }
    ///
    /// assert_eq!(slice, [4, 5, 3, 4, 5]);
    /// ```
    ///
    /// [`clone_from_slice`]: slice::clone_from_slice
    /// [`split_at_mut`]: slice::split_at_mut
    #[doc(alias = "memcpy")]
    #[inline]
    #[stable(feature = "copy_from_slice", since = "1.9.0")]
    #[rustc_const_stable(feature = "const_copy_from_slice", since = "1.87.0")]
    #[track_caller]
    pub const fn copy_from_slice(&mut self, src: &[T])
    where
        T: Copy,
    {
        // SAFETY: `T` implements `Copy`.
        unsafe { copy_from_slice_impl(self, src) }
    }

    /// 将切片的一部分元素复制到其另一部分，
    /// 使用 memmove 函数。
    ///
    /// `src` is the range within `self` to copy from. `dest` is the starting
    /// index of the range within `self` to copy to, which will have the same
    /// length as `src`. The two ranges may overlap. The ends of the two ranges
    /// must be less than or equal to `self.len()`.
    ///
    /// # Panics
    ///
    /// 如果任一范围超过切片的末尾，
    /// or if the end of `src` is before the start.
    ///
    /// # 示例
    ///
    /// 在切片中复制四个字节：
    ///
    /// ```
    /// let mut bytes = *b"Hello, World!";
    ///
    /// bytes.copy_within(1..5, 8);
    ///
    /// assert_eq!(&bytes, b"Hello, Wello!");
    /// ```
    #[inline]
    #[stable(feature = "copy_within", since = "1.37.0")]
    #[track_caller]
    pub fn copy_within<R: RangeBounds<usize>>(&mut self, src: R, dest: usize)
    where
        T: Copy,
    {
        let Range { start: src_start, end: src_end } = slice::range(src, ..self.len());
        let count = src_end - src_start;
        assert!(dest <= self.len() - count, "dest is out of bounds");
        // SAFETY: the conditions for `ptr::copy` have all been checked above,
        // as have those for `ptr::add`.
        unsafe {
            // Derive both `src_ptr` and `dest_ptr` from the same loan
            let ptr = self.as_mut_ptr();
            let src_ptr = ptr.add(src_start);
            let dest_ptr = ptr.add(dest);
            ptr::copy(src_ptr, dest_ptr, count);
        }
    }

    /// Swaps all elements in `self` with those in `other`.
    ///
    /// The length of `other` must be the same as `self`.
    ///
    /// # Panics
    ///
    /// 如果两个切片长度不同，此函数将引发 panic。
    ///
    /// # 示例
    ///
    /// 在切片之间交换两个元素：
    ///
    /// ```
    /// let mut slice1 = [0, 0];
    /// let mut slice2 = [1, 2, 3, 4];
    ///
    /// slice1.swap_with_slice(&mut slice2[2..]);
    ///
    /// assert_eq!(slice1, [3, 4]);
    /// assert_eq!(slice2, [1, 2, 0, 0]);
    /// ```
    ///
    /// Rust 规定在特定作用域中只能有一个对特定数据部分的可变引用。因此，
    /// particular piece of data in a particular scope. Because of this,
    /// attempting to use `swap_with_slice` on a single slice will result in
    /// 可变切片：
    ///
    /// ```compile_fail
    /// let mut slice = [1, 2, 3, 4, 5];
    /// slice[..2].swap_with_slice(&mut slice[3..]); // compile fail!
    /// ```
    ///
    /// To work around this, we can use [`split_at_mut`] to create two distinct
    /// 将切片转换为另一种类型的切片，确保类型对齐得以保持。
    ///
    /// ```
    /// let mut slice = [1, 2, 3, 4, 5];
    ///
    /// {
    ///     let (left, right) = slice.split_at_mut(2);
    ///     left.swap_with_slice(&mut right[1..]);
    /// }
    ///
    /// assert_eq!(slice, [4, 5, 3, 1, 2]);
    /// ```
    ///
    /// [`split_at_mut`]: slice::split_at_mut
    #[stable(feature = "swap_with_slice", since = "1.27.0")]
    #[rustc_const_unstable(feature = "const_swap_with_slice", issue = "142204")]
    #[track_caller]
    pub const fn swap_with_slice(&mut self, other: &mut [T]) {
        assert!(self.len() == other.len(), "destination and source slices have different lengths");
        // SAFETY: `self` is valid for `self.len()` elements by definition, and `src` was
        // checked to have the same length. The slices cannot overlap because
        // mutable references are exclusive.
        unsafe {
            ptr::swap_nonoverlapping(self.as_mut_ptr(), other.as_mut_ptr(), self.len());
        }
    }

    /// Function to calculate lengths of the middle and trailing slice for `align_to{,_mut}`.
    fn align_to_offsets<U>(&self) -> (usize, usize) {
        // What we gonna do about `rest` is figure out what multiple of `U`s we can put in a
        // lowest number of `T`s. And how many `T`s we need for each such "multiple".
        //
        // Consider for example T=u8 U=u16. Then we can put 1 U in 2 Ts. Simple. Now, consider
        // for example a case where size_of::<T> = 16, size_of::<U> = 24. We can put 2 Us in
        // place of every 3 Ts in the `rest` slice. A bit more complicated.
        //
        // Formula to calculate this is:
        //
        // Us = lcm(size_of::<T>, size_of::<U>) / size_of::<U>
        // Ts = lcm(size_of::<T>, size_of::<U>) / size_of::<T>
        //
        // Expanded and simplified:
        //
        // Us = size_of::<T> / gcd(size_of::<T>, size_of::<U>)
        // Ts = size_of::<U> / gcd(size_of::<T>, size_of::<U>)
        //
        // Luckily since all this is constant-evaluated... performance here matters not!
        const fn gcd(a: usize, b: usize) -> usize {
            if b == 0 { a } else { gcd(b, a % b) }
        }

        // Explicitly wrap the function call in a const block so it gets
        // constant-evaluated even in debug mode.
        let gcd: usize = const { gcd(size_of::<T>(), size_of::<U>()) };
        let ts: usize = size_of::<U>() / gcd;
        let us: usize = size_of::<T>() / gcd;

        // Armed with this knowledge, we can find how many `U`s we can fit!
        let us_len = self.len() / ts * us;
        // And how many `T`s will be in the trailing slice!
        let ts_len = self.len() % ts;
        (us_len, ts_len)
    }

    /// 以及新类型的后缀切片。在给定对齐约束和元素大小下，中间部分将尽可能大。
    /// 当输入或输出元素为零尺寸时，此方法没有意义，并将返回原始切片而不进行任何分割。
    ///
    /// 此方法将切片分割成三个不同的部分：前缀、正确对齐的中间部分
    /// 以及新类型的后缀切片。在给定对齐约束和元素大小下，中间部分将尽可能大。
    /// 当输入或输出元素为零尺寸时，此方法没有意义，并将返回原始切片而不进行任何分割。
    ///
    /// This method has no purpose when either input element `T` or output element `U` are
    /// # 安全性
    ///
    /// # 此方法与返回的
    ///
    /// This method is essentially a `transmute` with respect to the elements in the returned
    /// middle slice, so all the usual caveats pertaining to `transmute::<T, U>` also apply here.
    ///
    /// # 基本用法：
    ///
    /// 基本使用：
    ///
    /// ```
    /// unsafe {
    ///     let bytes: [u8; 7] = [1, 2, 3, 4, 5, 6, 7];
    ///     let (prefix, shorts, suffix) = bytes.align_to::<u16>();
    ///     // less_efficient_algorithm_for_bytes(prefix);
    ///     // more_efficient_algorithm_for_aligned_shorts(shorts);
    ///     // less_efficient_algorithm_for_bytes(suffix);
    /// }
    /// ```
    #[stable(feature = "slice_align_to", since = "1.30.0")]
    #[must_use]
    pub unsafe fn align_to<U>(&self) -> (&[T], &[U], &[T]) {
        // Note that most of this function will be constant-evaluated,
        if U::IS_ZST || T::IS_ZST {
            // handle ZSTs specially, which is – don't handle them at all.
            return (self, &[], &[]);
        }

        // First, find at what point do we split between the first and 2nd slice. Easy with
        // ptr.align_offset.
        let ptr = self.as_ptr();
        // SAFETY: See the `align_to_mut` method for the detailed safety comment.
        let offset = unsafe { crate::ptr::align_offset(ptr, align_of::<U>()) };
        if offset > self.len() {
            (self, &[], &[])
        } else {
            let (left, rest) = self.split_at(offset);
            let (us_len, ts_len) = rest.align_to_offsets::<U>();
            // Inform Miri that we want to consider the "middle" pointer to be suitably aligned.
            #[cfg(miri)]
            crate::intrinsics::miri_promise_symbolic_alignment(
                rest.as_ptr().cast(),
                align_of::<U>(),
            );
            // SAFETY: now `rest` is definitely aligned, so `from_raw_parts` below is okay,
            // since the caller guarantees that we can transmute `T` to `U` safely.
            unsafe {
                (
                    left,
                    from_raw_parts(rest.as_ptr() as *const U, us_len),
                    from_raw_parts(rest.as_ptr().add(rest.len() - ts_len), ts_len),
                )
            }
        }
    }

    /// 将可变切片转换为另一种类型的可变切片，确保类型对齐得以保持。
    /// 此方法将切片分割成三个不同的部分：前缀、正确对齐的中间部分
    ///
    /// 以及新类型的后缀切片。在给定对齐约束和元素大小下，中间部分将尽可能大。
    /// 当输入或输出元素为零尺寸时，此方法没有意义，并将返回原始切片而不进行任何分割。
    /// 当输入或输出元素为零尺寸时，此方法没有意义，并将返回原始切片而不进行任何分割。
    ///
    /// This method has no purpose when either input element `T` or output element `U` are
    /// 当输入或输出元素为零尺寸时，此方法没有意义，并将返回原始切片而不进行任何分割。
    ///
    /// # 安全性
    ///
    /// This method is essentially a `transmute` with respect to the elements in the returned
    /// middle slice, so all the usual caveats pertaining to `transmute::<T, U>` also apply here.
    ///
    /// # 示例
    ///
    /// 基本用法：
    ///
    /// ```
    /// unsafe {
    ///     let mut bytes: [u8; 7] = [1, 2, 3, 4, 5, 6, 7];
    ///     let (prefix, shorts, suffix) = bytes.align_to_mut::<u16>();
    ///     // less_efficient_algorithm_for_bytes(prefix);
    ///     // more_efficient_algorithm_for_aligned_shorts(shorts);
    ///     // less_efficient_algorithm_for_bytes(suffix);
    /// }
    /// ```
    #[stable(feature = "slice_align_to", since = "1.30.0")]
    #[must_use]
    pub unsafe fn align_to_mut<U>(&mut self) -> (&mut [T], &mut [U], &mut [T]) {
        // Note that most of this function will be constant-evaluated,
        if U::IS_ZST || T::IS_ZST {
            // handle ZSTs specially, which is – don't handle them at all.
            return (self, &mut [], &mut []);
        }

        // First, find at what point do we split between the first and 2nd slice. Easy with
        // ptr.align_offset.
        let ptr = self.as_ptr();
        // SAFETY: Here we are ensuring we will use aligned pointers for U for the
        // rest of the method. This is done by passing a pointer to &[T] with an
        // alignment targeted for U.
        // `crate::ptr::align_offset` is called with a correctly aligned and
        // valid pointer `ptr` (it comes from a reference to `self`) and with
        // a size that is a power of two (since it comes from the alignment for U),
        // satisfying its safety constraints.
        let offset = unsafe { crate::ptr::align_offset(ptr, align_of::<U>()) };
        if offset > self.len() {
            (self, &mut [], &mut [])
        } else {
            let (left, rest) = self.split_at_mut(offset);
            let (us_len, ts_len) = rest.align_to_offsets::<U>();
            let rest_len = rest.len();
            let mut_ptr = rest.as_mut_ptr();
            // Inform Miri that we want to consider the "middle" pointer to be suitably aligned.
            #[cfg(miri)]
            crate::intrinsics::miri_promise_symbolic_alignment(
                mut_ptr.cast() as *const (),
                align_of::<U>(),
            );
            // We can't use `rest` again after this, that would invalidate its alias `mut_ptr`!
            // SAFETY: see comments for `align_to`.
            unsafe {
                (
                    left,
                    from_raw_parts_mut(mut_ptr as *mut U, us_len),
                    from_raw_parts_mut(mut_ptr.add(rest_len - ts_len), ts_len),
                )
            }
        }
    }

    /// 将切片分为前缀、对齐的 SIMD 类型中间部分以及后缀。
    ///
    /// This is a safe wrapper around [`slice::align_to`], so inherits the same
    /// 保证。
    ///
    /// # 异常
    ///
    /// 如果 SIMD 类型的大小不是标量大小的
    /// `LANES` times that of the scalar.
    ///
    /// At the time of writing, the trait restrictions on `Simd<T, LANES>` keeps
    /// 这种情况从未发生过，因为仅支持二幂数通道数。
    /// 未来这些限制可能会被解除，从而可以观察到来自该方法的 panic。
    /// be lifted in a way that would make it possible to see panics from this
    /// method for something like `LANES == 3`.
    ///
    /// # 将可变的切片分为可变的前缀、对齐的 SIMD 类型中间部分以及可变的后缀。
    ///
    /// ```
    /// #![feature(portable_simd)]
    /// use core::simd::prelude::*;
    ///
    /// let short = &[1, 2, 3];
    /// let (prefix, middle, suffix) = short.as_simd::<4>();
    /// assert_eq!(middle, []); // Not enough elements for anything in the middle
    ///
    /// // They might be split in any possible way between prefix and suffix
    /// let it = prefix.iter().chain(suffix).copied();
    /// assert_eq!(it.collect::<Vec<_>>(), vec![1, 2, 3]);
    ///
    /// fn basic_simd_sum(x: &[f32]) -> f32 {
    ///     use std::ops::Add;
    ///     let (prefix, middle, suffix) = x.as_simd();
    ///     let sums = f32x4::from_array([
    ///         prefix.iter().copied().sum(),
    ///         0.0,
    ///         0.0,
    ///         suffix.iter().copied().sum(),
    ///     ]);
    ///     let sums = middle.iter().copied().fold(sums, f32x4::add);
    ///     sums.reduce_sum()
    /// }
    ///
    /// let numbers: Vec<f32> = (1..101).map(|x| x as _).collect();
    /// assert_eq!(basic_simd_sum(&numbers[1..99]), 4949.0);
    /// ```
    #[unstable(feature = "portable_simd", issue = "86656")]
    #[must_use]
    pub fn as_simd<const LANES: usize>(&self) -> (&[T], &[Simd<T, LANES>], &[T])
    where
        Simd<T, LANES>: AsRef<[T; LANES]>,
        T: simd::SimdElement,
    {
        // These are expected to always match, as vector types are laid out like
        // arrays per <https://llvm.org/docs/LangRef.html#vector-type>, but we
        // might as well double-check since it'll optimize away anyhow.
        assert_eq!(size_of::<Simd<T, LANES>>(), size_of::<[T; LANES]>());

        // SAFETY: The simd types have the same layout as arrays, just with
        // potentially-higher alignment, so the de-facto transmutes are sound.
        unsafe { self.align_to() }
    }

    /// Splits a mutable slice into a mutable prefix, a middle of aligned SIMD types,
    /// 保证。
    ///
    /// This is a safe wrapper around [`slice::align_to_mut`], so inherits the same
    /// 保证。
    ///
    /// This is the mutable version of [`slice::as_simd`]; see that for examples.
    ///
    /// # 异常
    ///
    /// 如果 SIMD 类型的大小不是标量的
    /// `LANES` times that of the scalar.
    ///
    /// At the time of writing, the trait restrictions on `Simd<T, LANES>` keeps
    /// 这种情况从未发生过，因为仅支持二幂数通道数。
    /// 未来这些限制可能会被解除，从而可以观察到来自该方法的 panic。
    /// be lifted in a way that would make it possible to see panics from this
    /// method for something like `LANES == 3`.
    #[unstable(feature = "portable_simd", issue = "86656")]
    #[must_use]
    pub fn as_simd_mut<const LANES: usize>(&mut self) -> (&mut [T], &mut [Simd<T, LANES>], &mut [T])
    where
        Simd<T, LANES>: AsMut<[T; LANES]>,
        T: simd::SimdElement,
    {
        // These are expected to always match, as vector types are laid out like
        // arrays per <https://llvm.org/docs/LangRef.html#vector-type>, but we
        // might as well double-check since it'll optimize away anyhow.
        assert_eq!(size_of::<Simd<T, LANES>>(), size_of::<[T; LANES]>());

        // SAFETY: The simd types have the same layout as arrays, just with
        // potentially-higher alignment, so the de-facto transmutes are sound.
        unsafe { self.align_to_mut() }
    }

    /// Checks if the elements of this slice are sorted.
    ///
    /// That is, for each element `a` and its following element `b`, `a <= b` must hold. If the
    /// slice yields exactly zero or one element, `true` is returned.
    ///
    /// Note that if `Self::Item` is only `PartialOrd`, but not `Ord`, the above definition
    /// implies that this function returns `false` if any two consecutive items are not
    /// comparable.
    ///
    /// # 示例
    ///
    /// ```
    /// let empty: [i32; 0] = [];
    ///
    /// assert!([1, 2, 2, 9].is_sorted());
    /// assert!(![1, 3, 2, 4].is_sorted());
    /// assert!([0].is_sorted());
    /// assert!(empty.is_sorted());
    /// assert!(![0.0, 1.0, f32::NAN].is_sorted());
    /// ```
    #[inline]
    #[stable(feature = "is_sorted", since = "1.82.0")]
    #[must_use]
    pub fn is_sorted(&self) -> bool
    where
        T: PartialOrd,
    {
        // This odd number works the best. 32 + 1 extra due to overlapping chunk boundaries.
        const CHUNK_SIZE: usize = 33;
        if self.len() < CHUNK_SIZE {
            return self.windows(2).all(|w| w[0] <= w[1]);
        }
        let mut i = 0;
        // Check in chunks for autovectorization.
        while i < self.len() - CHUNK_SIZE {
            let chunk = &self[i..i + CHUNK_SIZE];
            if !chunk.windows(2).fold(true, |acc, w| acc & (w[0] <= w[1])) {
                return false;
            }
            // We need to ensure that chunk boundaries are also sorted.
            // Overlap the next chunk with the last element of our last chunk.
            i += CHUNK_SIZE - 1;
        }
        self[i..].windows(2).all(|w| w[0] <= w[1])
    }

    /// 使用给定的比较器函数检查此切片的元素是否有序。
    ///
    /// Instead of using `PartialOrd::partial_cmp`, this function uses the given `compare`
    /// 函数来确定两个元素是否应被视为有序顺序。
    ///
    /// # 示例
    ///
    /// ```
    /// assert!([1, 2, 2, 9].is_sorted_by(|a, b| a <= b));
    /// assert!(![1, 2, 2, 9].is_sorted_by(|a, b| a < b));
    ///
    /// assert!([0].is_sorted_by(|a, b| true));
    /// assert!([0].is_sorted_by(|a, b| false));
    ///
    /// let empty: [i32; 0] = [];
    /// assert!(empty.is_sorted_by(|a, b| false));
    /// assert!(empty.is_sorted_by(|a, b| true));
    /// ```
    #[stable(feature = "is_sorted", since = "1.82.0")]
    #[must_use]
    pub fn is_sorted_by<'a, F>(&'a self, mut compare: F) -> bool
    where
        F: FnMut(&'a T, &'a T) -> bool,
    {
        self.array_windows().all(|[a, b]| compare(a, b))
    }

    /// 使用给定的键提取函数检查此切片的元素是否有序。
    ///
    /// Instead of comparing the slice's elements directly, this function compares the keys of the
    /// elements, as determined by `f`. Apart from that, it's equivalent to [`is_sorted`]; see its
    /// 更多相关信息请参阅文档。
    ///
    /// [`is_sorted`]: slice::is_sorted
    ///
    /// # 示例
    ///
    /// ```
    /// assert!(["c", "bb", "aaa"].is_sorted_by_key(|s| s.len()));
    /// assert!(![-2i32, -1, 0, 3].is_sorted_by_key(|n| n.abs()));
    /// ```
    #[inline]
    #[stable(feature = "is_sorted", since = "1.82.0")]
    #[must_use]
    pub fn is_sorted_by_key<'a, F, K>(&'a self, f: F) -> bool
    where
        F: FnMut(&'a T) -> K,
        K: PartialOrd,
    {
        self.iter().is_sorted_by_key(f)
    }

    /// 根据给定条件返回分区点的索引
    /// （即第二个分区的第一个元素的索引）。
    ///
    /// 假设切片是根据给定条件被分区的。
    /// 这意味着所有满足条件为真的元素都位于切片的起始位置
    /// 而所有满足条件为假的元素都位于末尾。
    /// For example, `[7, 15, 3, 5, 4, 12, 6]` is partitioned under the predicate `x % 2 != 0`
    /// （所有奇数位于开头，所有偶数位于末尾）。
    ///
    /// 如果此切片未被分区，返回的结果将是未指定的且无意义，
    /// 因为该方法执行了一种二进制搜索。
    ///
    /// See also [`binary_search`], [`binary_search_by`], and [`binary_search_by_key`].
    ///
    /// [`binary_search`]: slice::binary_search
    /// [`binary_search_by`]: slice::binary_search_by
    /// [`binary_search_by_key`]: slice::binary_search_by_key
    ///
    /// # 示例
    ///
    /// ```
    /// let v = [1, 2, 3, 3, 5, 6, 7];
    /// let i = v.partition_point(|&x| x < 5);
    ///
    /// assert_eq!(i, 4);
    /// assert!(v[..i].iter().all(|&x| x < 5));
    /// assert!(v[i..].iter().all(|&x| !(x < 5)));
    /// ```
    ///
    /// 如果切片中的所有元素都满足条件，包括当切片
    /// 为空时，将返回切片的长度：
    ///
    /// ```
    /// let a = [2, 4, 8];
    /// assert_eq!(a.partition_point(|x| x < &100), a.len());
    /// let a: [i32; 0] = [];
    /// assert_eq!(a.partition_point(|x| x < &100), 0);
    /// ```
    ///
    /// 如果您想向已排序的向量插入项，同时保持
    /// 排序顺序：
    ///
    /// ```
    /// let mut s = vec![0, 1, 1, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55];
    /// let num = 42;
    /// let idx = s.partition_point(|&x| x <= num);
    /// s.insert(idx, num);
    /// assert_eq!(s, [0, 1, 1, 1, 1, 2, 3, 5, 8, 13, 21, 34, 42, 55]);
    /// ```
    #[rustc_const_unstable(feature = "const_binary_search", issue = "159532")]
    #[stable(feature = "partition_point", since = "1.52.0")]
    #[must_use]
    pub const fn partition_point<P>(&self, mut pred: P) -> usize
    where
        P: [const] FnMut(&T) -> bool + [const] Destruct,
    {
        self.binary_search_by(const |x| if pred(x) { Less } else { Greater })
            .unwrap_or_else(const |i| i)
    }

    /// 移除与给定范围对应的子切片
    /// 并返回对其的引用。
    ///
    /// Returns `None` and does not modify the slice if the given
    /// range is out of bounds.
    ///
    /// 注意，该方法仅接受单边范围，如
    /// `2..` or `..6`, but not `2..6`.
    ///
    /// # 示例
    ///
    /// 移除切片的前三个元素：
    ///
    /// ```
    /// let mut slice: &[_] = &['a', 'b', 'c', 'd'];
    /// let mut first_three = slice.split_off(..3).unwrap();
    ///
    /// assert_eq!(slice, &['d']);
    /// assert_eq!(first_three, &['a', 'b', 'c']);
    /// ```
    ///
    /// 移除从第三个元素开始的切片：
    ///
    /// ```
    /// let mut slice: &[_] = &['a', 'b', 'c', 'd'];
    /// let mut tail = slice.split_off(2..).unwrap();
    ///
    /// assert_eq!(slice, &['a', 'b']);
    /// assert_eq!(tail, &['c', 'd']);
    /// ```
    ///
    /// Getting `None` when `range` is out of bounds:
    ///
    /// ```
    /// let mut slice: &[_] = &['a', 'b', 'c', 'd'];
    ///
    /// assert_eq!(None, slice.split_off(5..));
    /// assert_eq!(None, slice.split_off(..5));
    /// assert_eq!(None, slice.split_off(..=4));
    /// let expected: &[char] = &['a', 'b', 'c', 'd'];
    /// assert_eq!(Some(expected), slice.split_off(..4));
    /// ```
    #[inline]
    #[must_use = "method does not modify the slice if the range is out of bounds"]
    #[stable(feature = "slice_take", since = "1.87.0")]
    pub fn split_off<'a, R: OneSidedRange<usize>>(
        self: &mut &'a Self,
        range: R,
    ) -> Option<&'a Self> {
        let (direction, split_index) = split_point_of(range)?;
        if split_index > self.len() {
            return None;
        }
        let (front, back) = self.split_at(split_index);
        match direction {
            Direction::Front => {
                *self = back;
                Some(front)
            }
            Direction::Back => {
                *self = front;
                Some(back)
            }
        }
    }

    /// 移除与给定范围对应的子切片
    /// 并返回对其的可变引用。
    ///
    /// Returns `None` and does not modify the slice if the given
    /// range is out of bounds.
    ///
    /// 注意，该方法仅接受单边范围，如
    /// `2..` or `..6`, but not `2..6`.
    ///
    /// # 示例
    ///
    /// 移除切片的前三个元素：
    ///
    /// ```
    /// let mut slice: &mut [_] = &mut ['a', 'b', 'c', 'd'];
    /// let mut first_three = slice.split_off_mut(..3).unwrap();
    ///
    /// assert_eq!(slice, &mut ['d']);
    /// assert_eq!(first_three, &mut ['a', 'b', 'c']);
    /// ```
    ///
    /// 移除从第三个元素开始的切片：
    ///
    /// ```
    /// let mut slice: &mut [_] = &mut ['a', 'b', 'c', 'd'];
    /// let mut tail = slice.split_off_mut(2..).unwrap();
    ///
    /// assert_eq!(slice, &mut ['a', 'b']);
    /// assert_eq!(tail, &mut ['c', 'd']);
    /// ```
    ///
    /// Getting `None` when `range` is out of bounds:
    ///
    /// ```
    /// let mut slice: &mut [_] = &mut ['a', 'b', 'c', 'd'];
    ///
    /// assert_eq!(None, slice.split_off_mut(5..));
    /// assert_eq!(None, slice.split_off_mut(..5));
    /// assert_eq!(None, slice.split_off_mut(..=4));
    /// let expected: &mut [_] = &mut ['a', 'b', 'c', 'd'];
    /// assert_eq!(Some(expected), slice.split_off_mut(..4));
    /// ```
    #[inline]
    #[must_use = "method does not modify the slice if the range is out of bounds"]
    #[stable(feature = "slice_take", since = "1.87.0")]
    pub fn split_off_mut<'a, R: OneSidedRange<usize>>(
        self: &mut &'a mut Self,
        range: R,
    ) -> Option<&'a mut Self> {
        let (direction, split_index) = split_point_of(range)?;
        if split_index > self.len() {
            return None;
        }
        let (front, back) = mem::take(self).split_at_mut(split_index);
        match direction {
            Direction::Front => {
                *self = back;
                Some(front)
            }
            Direction::Back => {
                *self = front;
                Some(back)
            }
        }
    }

    /// 移除切片的第一个元素并返回引用
    /// to it.
    ///
    /// Returns `None` if the slice is empty.
    ///
    /// # 示例
    ///
    /// ```
    /// let mut slice: &[_] = &['a', 'b', 'c'];
    /// let first = slice.split_off_first().unwrap();
    ///
    /// assert_eq!(slice, &['b', 'c']);
    /// assert_eq!(first, &'a');
    /// ```
    #[inline]
    #[stable(feature = "slice_take", since = "1.87.0")]
    #[rustc_const_unstable(feature = "const_split_off_first_last", issue = "138539")]
    pub const fn split_off_first<'a>(self: &mut &'a Self) -> Option<&'a T> {
        // FIXME(const-hack): Use `?` when available in const instead of `let-else`.
        let Some((first, rem)) = self.split_first() else { return None };
        *self = rem;
        Some(first)
    }

    /// 移除切片的第一个元素并返回其可变
    /// 引用。
    ///
    /// Returns `None` if the slice is empty.
    ///
    /// # 示例
    ///
    /// ```
    /// let mut slice: &mut [_] = &mut ['a', 'b', 'c'];
    /// let first = slice.split_off_first_mut().unwrap();
    /// *first = 'd';
    ///
    /// assert_eq!(slice, &['b', 'c']);
    /// assert_eq!(first, &'d');
    /// ```
    #[inline]
    #[stable(feature = "slice_take", since = "1.87.0")]
    #[rustc_const_unstable(feature = "const_split_off_first_last", issue = "138539")]
    pub const fn split_off_first_mut<'a>(self: &mut &'a mut Self) -> Option<&'a mut T> {
        // FIXME(const-hack): Use `mem::take` and `?` when available in const.
        // Original: `mem::take(self).split_first_mut()?`
        let Some((first, rem)) = mem::replace(self, &mut []).split_first_mut() else { return None };
        *self = rem;
        Some(first)
    }

    /// 移除切片的最后一个元素并返回引用
    /// to it.
    ///
    /// Returns `None` if the slice is empty.
    ///
    /// # 示例
    ///
    /// ```
    /// let mut slice: &[_] = &['a', 'b', 'c'];
    /// let last = slice.split_off_last().unwrap();
    ///
    /// assert_eq!(slice, &['a', 'b']);
    /// assert_eq!(last, &'c');
    /// ```
    #[inline]
    #[stable(feature = "slice_take", since = "1.87.0")]
    #[rustc_const_unstable(feature = "const_split_off_first_last", issue = "138539")]
    pub const fn split_off_last<'a>(self: &mut &'a Self) -> Option<&'a T> {
        // FIXME(const-hack): Use `?` when available in const instead of `let-else`.
        let Some((last, rem)) = self.split_last() else { return None };
        *self = rem;
        Some(last)
    }

    /// 移除切片的最后一个元素并返回其可变
    /// 引用。
    ///
    /// Returns `None` if the slice is empty.
    ///
    /// # 示例
    ///
    /// ```
    /// let mut slice: &mut [_] = &mut ['a', 'b', 'c'];
    /// let last = slice.split_off_last_mut().unwrap();
    /// *last = 'd';
    ///
    /// assert_eq!(slice, &['a', 'b']);
    /// assert_eq!(last, &'d');
    /// ```
    #[inline]
    #[stable(feature = "slice_take", since = "1.87.0")]
    #[rustc_const_unstable(feature = "const_split_off_first_last", issue = "138539")]
    pub const fn split_off_last_mut<'a>(self: &mut &'a mut Self) -> Option<&'a mut T> {
        // FIXME(const-hack): Use `mem::take` and `?` when available in const.
        // Original: `mem::take(self).split_last_mut()?`
        let Some((last, rem)) = mem::replace(self, &mut []).split_last_mut() else { return None };
        *self = rem;
        Some(last)
    }

    /// 无需进行任何检查，即可一次性返回多个索引的可变引用。
    ///
    /// An index can be either a `usize`, a [`Range`] or a [`RangeInclusive`]. Note
    /// 该方法接受数组作为参数，因此所有索引必须属于同一类型。
    /// If passed an array of `usize`s this method gives back an array of mutable references
    /// 切片的可变引用数组。
    /// mutable references to slices.
    ///
    /// For a safe alternative see [`get_disjoint_mut`].
    ///
    /// # 安全性
    ///
    /// 使用重叠或超出边界的索引调用该方法属于 *[未定义行为]*，
    /// 即使生成的引用未被使用也是如此。
    ///
    /// # 示例
    ///
    /// ```
    /// let x = &mut [1, 2, 4];
    ///
    /// unsafe {
    ///     let [a, b] = x.get_disjoint_unchecked_mut([0, 2]);
    ///     *a *= 10;
    ///     *b *= 100;
    /// }
    /// assert_eq!(x, &[10, 2, 400]);
    ///
    /// unsafe {
    ///     let [a, b] = x.get_disjoint_unchecked_mut([0..1, 1..3]);
    ///     a[0] = 8;
    ///     b[0] = 88;
    ///     b[1] = 888;
    /// }
    /// assert_eq!(x, &[8, 88, 888]);
    ///
    /// unsafe {
    ///     let [a, b] = x.get_disjoint_unchecked_mut([1..=2, 0..=0]);
    ///     a[0] = 11;
    ///     a[1] = 111;
    ///     b[0] = 1;
    /// }
    /// assert_eq!(x, &[1, 11, 111]);
    /// ```
    ///
    /// [`get_disjoint_mut`]: slice::get_disjoint_mut
    /// [undefined behavior]: https://doc.rust-lang.org/reference/behavior-considered-undefined.html
    #[stable(feature = "get_many_mut", since = "1.86.0")]
    #[inline]
    #[track_caller]
    pub unsafe fn get_disjoint_unchecked_mut<I, const N: usize>(
        &mut self,
        indices: [I; N],
    ) -> [&mut I::Output; N]
    where
        I: GetDisjointMutIndex + SliceIndex<Self>,
    {
        // NB: This implementation is written as it is because any variation of
        // `indices.map(|i| self.get_unchecked_mut(i))` would make miri unhappy,
        // or generate worse code otherwise. This is also why we need to go
        // through a raw pointer here.
        let slice: *mut [T] = self;
        let mut arr: MaybeUninit<[&mut I::Output; N]> = MaybeUninit::uninit();
        let arr_ptr = arr.as_mut_ptr();

        // SAFETY: We expect `indices` to contain disjunct values that are
        // in bounds of `self`.
        unsafe {
            for i in 0..N {
                let idx = indices.get_unchecked(i).clone();
                arr_ptr.cast::<&mut I::Output>().add(i).write(&mut *slice.get_unchecked_mut(idx));
            }
            arr.assume_init()
        }
    }

    /// 一次性返回多个索引的可变引用。
    ///
    /// An index can be either a `usize`, a [`Range`] or a [`RangeInclusive`]. Note
    /// 该方法接受数组作为参数，因此所有索引必须属于同一类型。
    /// If passed an array of `usize`s this method gives back an array of mutable references
    /// 切片的可变引用数组。
    /// 如果任何索引超出边界或存在重叠索引，则返回错误。
    ///
    /// Returns an error if any index is out-of-bounds, or if there are overlapping indices.
    /// 如果空范围位于另一个范围的开始或末尾，则不视为重叠；但如果位于中间，则视为重叠。
    /// 该方法进行 O(n^2) 检查以确保没有重叠索引，因此传递多个索引时请小心。
    ///
    /// # 示例
    /// 返回元素引用所指向的索引。
    ///
    /// # Examples
    ///
    /// ```
    /// let v = &mut [1, 2, 3];
    /// if let Ok([a, b]) = v.get_disjoint_mut([0, 2]) {
    ///     *a = 413;
    ///     *b = 612;
    /// }
    /// assert_eq!(v, &[413, 2, 612]);
    ///
    /// if let Ok([a, b]) = v.get_disjoint_mut([0..1, 1..3]) {
    ///     a[0] = 8;
    ///     b[0] = 88;
    ///     b[1] = 888;
    /// }
    /// assert_eq!(v, &[8, 88, 888]);
    ///
    /// if let Ok([a, b]) = v.get_disjoint_mut([1..=2, 0..=0]) {
    ///     a[0] = 11;
    ///     a[1] = 111;
    ///     b[0] = 1;
    /// }
    /// assert_eq!(v, &[1, 11, 111]);
    /// ```
    #[stable(feature = "get_many_mut", since = "1.86.0")]
    #[inline]
    pub fn get_disjoint_mut<I, const N: usize>(
        &mut self,
        indices: [I; N],
    ) -> Result<[&mut I::Output; N], GetDisjointMutError>
    where
        I: GetDisjointMutIndex + SliceIndex<Self>,
    {
        get_disjoint_check_valid(&indices, self.len())?;
        // SAFETY: The `get_disjoint_check_valid()` call checked that all indices
        // are disjunct and in bounds.
        unsafe { Ok(self.get_disjoint_unchecked_mut(indices)) }
    }

    /// Returns the index that an element reference points to.
    ///
    /// Returns `None` if `element` does not point to the start of an element within the slice.
    ///
    /// This method is useful for extending slice iterators like [`slice::split`].
    ///
    /// # Panics
    /// To find the index of an element via comparison, use
    /// [`.iter().position()`](crate::iter::Iterator::position) instead.
    ///
    /// # 基本用法：
    /// Panics if `T` is zero-sized.
    ///
    /// # 示例
    /// 基本使用方式：
    /// ```
    /// let nums: &[u32] = &[1, 7, 1, 1];
    /// let num = &nums[2];
    ///
    /// assert_eq!(num, &1);
    /// assert_eq!(nums.element_offset(num), Some(2));
    /// ```
    /// Returning `None` with an unaligned element:
    /// ```
    /// let arr: &[[u32; 2]] = &[[0, 1], [2, 3]];
    /// let flat_arr: &[u32] = arr.as_flattened();
    ///
    /// let ok_elm: &[u32; 2] = flat_arr[0..2].try_into().unwrap();
    /// let weird_elm: &[u32; 2] = flat_arr[1..3].try_into().unwrap();
    ///
    /// assert_eq!(ok_elm, &[0, 1]);
    /// assert_eq!(weird_elm, &[1, 2]);
    ///
    /// assert_eq!(arr.element_offset(ok_elm), Some(0)); // Points to element 0
    /// assert_eq!(arr.element_offset(weird_elm), None); // Points between element 0 and 1
    /// ```
    #[must_use]
    #[stable(feature = "element_offset", since = "1.94.0")]
    pub fn element_offset(&self, element: &T) -> Option<usize> {
        if T::IS_ZST {
            panic!("elements are zero-sized");
        }

        let self_start = self.as_ptr().addr();
        let elem_start = ptr::from_ref(element).addr();

        let byte_offset = elem_start.wrapping_sub(self_start);

        if !byte_offset.is_multiple_of(size_of::<T>()) {
            return None;
        }

        let offset = byte_offset / size_of::<T>();

        if offset < self.len() { Some(offset) } else { None }
    }

    /// 返回子切片所指向的索引范围。
    ///
    /// Returns `None` if `subslice` does not point within the slice or if it is not aligned with the
    /// elements in the slice.
    ///
    /// This method **does not compare elements**. Instead, this method finds the location in the slice that
    /// `subslice` was obtained from. To find the index of a subslice via comparison, instead use
    /// [`.windows()`](slice::windows)[`.position()`](crate::iter::Iterator::position).
    ///
    /// This method is useful for extending slice iterators like [`slice::split`].
    ///
    /// Note that this may return a false positive (either `Some(0..0)` or `Some(self.len()..self.len())`)
    /// if `subslice` has a length of zero and points to the beginning or end of another, separate, slice.
    ///
    /// # 恐慌
    /// Panics if `T` is zero-sized.
    ///
    /// # 示例
    /// 基本用法：
    /// ```
    /// use core::range::Range;
    ///
    /// let nums = &[0, 5, 10, 0, 0, 5];
    ///
    /// let mut iter = nums
    ///     .split(|t| *t == 0)
    ///     .map(|n| nums.subslice_range(n).unwrap());
    ///
    /// assert_eq!(iter.next(), Some(Range { start: 0, end: 0 }));
    /// assert_eq!(iter.next(), Some(Range { start: 1, end: 3 }));
    /// assert_eq!(iter.next(), Some(Range { start: 4, end: 4 }));
    /// assert_eq!(iter.next(), Some(Range { start: 5, end: 6 }));
    /// ```
    /// Returning `None` with a slice not aligned to the elements of the base array:
    /// ```
    /// use core::range::Range;
    /// use core::slice::from_ref;
    ///
    /// let arr: &[[u8; 4]] = &[[0, 1, 2, 3], [4, 5, 6, 7]];
    /// let flattened: &[u8] = arr.as_flattened();
    ///
    /// // This sub-slice is aligned with the first element of `arr`:
    /// // &[[0, 1, 2, 3], [4, 5, 6, 7]]
    /// // &[[0, 1, 2, 3]]
    /// let aligned_elem: &[u8; 4] = flattened[0..4].try_into().unwrap();
    /// let aligned_slice: &[[u8; 4]] = from_ref(aligned_elem);
    ///
    /// // `aligned_slice` is `&arr[0..1]`
    /// assert_eq!(arr.subslice_range(aligned_slice), Some(Range { start: 0, end: 1 }));
    ///
    /// // This sub-slice is **not** aligned to the elements of `arr`, despite pointing inside it:
    /// // &[[0, 1, 2, 3], [4, 5, 6, 7]]
    /// //    &[[1, 2, 3,   4]]
    /// let misaligned_elem: &[u8; 4] = flattened[1..5].try_into().unwrap();
    /// let misaligned_slice: &[[u8; 4]] = from_ref(misaligned_elem);
    ///
    /// // `misaligned_slice` has no corresponding slice of `arr`
    /// assert_eq!(arr.subslice_range(misaligned_slice), None);
    /// ```
    #[must_use]
    #[stable(feature = "substr_range", since = "1.98.0")]
    pub fn subslice_range(&self, subslice: &[T]) -> Option<core::range::Range<usize>> {
        if T::IS_ZST {
            panic!("elements are zero-sized");
        }

        let self_start = self.as_ptr().addr();
        let subslice_start = subslice.as_ptr().addr();

        let byte_start = subslice_start.wrapping_sub(self_start);

        if !byte_start.is_multiple_of(size_of::<T>()) {
            return None;
        }

        let start = byte_start / size_of::<T>();
        let end = start.wrapping_add(subslice.len());

        if start <= self.len() && end <= self.len() {
            Some(core::range::Range { start, end })
        } else {
            None
        }
    }

    /// Returns the same slice `&[T]`.
    ///
    /// This method is redundant when used directly on `&[T]`, but
    /// 它有助于将其他“容器”类型转换为切片，
    /// for example `Box<[T]>` or `Arc<[T]>`.
    #[inline]
    #[unstable(feature = "str_as_str", issue = "130366")]
    pub const fn as_slice(&self) -> &[T] {
        self
    }

    /// Returns the same slice `&mut [T]`.
    ///
    /// This method is redundant when used directly on `&mut [T]`, but
    /// 它有助于将其他“容器”类型转换为切片，
    /// for example `Box<[T]>` or `MutexGuard<[T]>`.
    #[inline]
    #[unstable(feature = "str_as_str", issue = "130366")]
    pub const fn as_mut_slice(&mut self) -> &mut [T] {
        self
    }
}

impl<T> [MaybeUninit<T>] {
    /// 将不可初始化的可变切片转换为另一种类型的不可初始化的可变切片，确保类型对齐得以保持。
    /// 这是一个安全的包装器，因此具有与该方法相同的保证。
    ///
    /// This is a safe wrapper around [`slice::align_to_mut`], so inherits the same
    /// 与该方法相同。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(align_to_uninit_mut)]
    /// use std::mem::MaybeUninit;
    ///
    /// pub struct BumpAllocator<'scope> {
    ///     memory: &'scope mut [MaybeUninit<u8>],
    /// }
    ///
    /// impl<'scope> BumpAllocator<'scope> {
    ///     pub fn new(memory: &'scope mut [MaybeUninit<u8>]) -> Self {
    ///         Self { memory }
    ///     }
    ///     pub fn try_alloc_uninit<T>(&mut self) -> Option<&'scope mut MaybeUninit<T>> {
    ///         let first_end = self.memory.as_ptr().align_offset(align_of::<T>()) + size_of::<T>();
    ///         let prefix = self.memory.split_off_mut(..first_end)?;
    ///         Some(&mut prefix.align_to_uninit_mut::<T>().1[0])
    ///     }
    ///     pub fn try_alloc_u32(&mut self, value: u32) -> Option<&'scope mut u32> {
    ///         let uninit = self.try_alloc_uninit()?;
    ///         Some(uninit.write(value))
    ///     }
    /// }
    ///
    /// let mut memory = [MaybeUninit::<u8>::uninit(); 10];
    /// let mut allocator = BumpAllocator::new(&mut memory);
    /// let v = allocator.try_alloc_u32(42);
    /// assert_eq!(v, Some(&mut 42));
    /// ```
    #[unstable(feature = "align_to_uninit_mut", issue = "139062")]
    #[inline]
    #[must_use]
    pub fn align_to_uninit_mut<U>(&mut self) -> (&mut Self, &mut [MaybeUninit<U>], &mut Self) {
        // SAFETY: `MaybeUninit` is transparent. Correct size and alignment are guaranteed by
        // `align_to_mut` itself. Therefore the only thing that we have to ensure for a safe
        // `transmute` is that the values are valid for the types involved. But for `MaybeUninit`
        // any values are valid, so this operation is safe.
        unsafe { self.align_to_mut() }
    }
}

impl<T, const N: usize> [[T; N]] {
    /// Takes a `&[[T; N]]`, and flattens it to a `&[T]`.
    ///
    /// For the opposite operation, see [`as_chunks`] and [`as_rchunks`].
    ///
    /// [`as_chunks`]: slice::as_chunks
    /// [`as_rchunks`]: slice::as_rchunks
    ///
    /// # 恐慌
    ///
    /// This panics if the length of the resulting slice would overflow a `usize`.
    ///
    /// 这仅在展平零大小数组类型的切片时可能，因此在实践中通常无关紧要。如果
    /// types, and thus tends to be irrelevant in practice. If
    /// `size_of::<T>() > 0`, this will never panic.
    ///
    /// # Examples
    ///
    /// ```
    /// assert_eq!([[1, 2, 3], [4, 5, 6]].as_flattened(), &[1, 2, 3, 4, 5, 6]);
    ///
    /// assert_eq!(
    ///     [[1, 2, 3], [4, 5, 6]].as_flattened(),
    ///     [[1, 2], [3, 4], [5, 6]].as_flattened(),
    /// );
    ///
    /// let slice_of_empty_arrays: &[[i32; 0]] = &[[], [], [], [], []];
    /// assert!(slice_of_empty_arrays.as_flattened().is_empty());
    ///
    /// let empty_slice_of_arrays: &[[u32; 10]] = &[];
    /// assert!(empty_slice_of_arrays.as_flattened().is_empty());
    /// ```
    #[stable(feature = "slice_flatten", since = "1.80.0")]
    #[rustc_const_stable(feature = "const_slice_flatten", since = "1.87.0")]
    pub const fn as_flattened(&self) -> &[T] {
        let len = if T::IS_ZST {
            self.len().checked_mul(N).expect("slice len overflow")
        } else {
            // SAFETY: `self.len() * N` cannot overflow because `self` is
            // already in the address space.
            unsafe { self.len().unchecked_mul(N) }
        };
        // SAFETY: `[T]` is layout-identical to `[T; N]`
        unsafe { from_raw_parts(self.as_ptr().cast(), len) }
    }

    /// Takes a `&mut [[T; N]]`, and flattens it to a `&mut [T]`.
    ///
    /// For the opposite operation, see [`as_chunks_mut`] and [`as_rchunks_mut`].
    ///
    /// [`as_chunks_mut`]: slice::as_chunks_mut
    /// [`as_rchunks_mut`]: slice::as_rchunks_mut
    ///
    /// # Panics
    ///
    /// This panics if the length of the resulting slice would overflow a `usize`.
    ///
    /// This is only possible when flattening a slice of arrays of zero-sized
    /// # 示例
    /// `size_of::<T>() > 0`, this will never panic.
    ///
    /// # 此排序是原地进行的（即不分配内存），最坏情况为 *O*(*n* \* log(*n*))，并使用
    ///
    /// ```
    /// fn add_5_to_all(slice: &mut [i32]) {
    ///     for i in slice {
    ///         *i += 5;
    ///     }
    /// }
    ///
    /// let mut array = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];
    /// add_5_to_all(array.as_flattened_mut());
    /// assert_eq!(array, [[6, 7, 8], [9, 10, 11], [12, 13, 14]]);
    /// ```
    #[stable(feature = "slice_flatten", since = "1.80.0")]
    #[rustc_const_stable(feature = "const_slice_flatten", since = "1.87.0")]
    pub const fn as_flattened_mut(&mut self) -> &mut [T] {
        let len = if T::IS_ZST {
            self.len().checked_mul(N).expect("slice len overflow")
        } else {
            // SAFETY: `self.len() * N` cannot overflow because `self` is
            // already in the address space.
            unsafe { self.len().unchecked_mul(N) }
        };
        // SAFETY: `[T]` is layout-identical to `[T; N]`
        unsafe { from_raw_parts_mut(self.as_mut_ptr().cast(), len) }
    }
}

impl [f32] {
    /// Sorts the slice of floats.
    ///
    /// # 当前实现
    /// the ordering defined by [`f32::total_cmp`].
    ///
    /// # 示例
    ///
    /// This uses the same sorting algorithm as [`sort_unstable_by`](slice::sort_unstable_by).
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(sort_floats)]
    /// let mut v = [2.6, -5e-8, f32::NAN, 8.29, f32::INFINITY, -1.0, 0.0, -f32::INFINITY, -0.0];
    ///
    /// v.sort_floats();
    /// let sorted = [-f32::INFINITY, -1.0, -5e-8, -0.0, 0.0, 2.6, 8.29, f32::INFINITY, f32::NAN];
    /// assert_eq!(&v[..8], &sorted[..8]);
    /// assert!(v[8].is_nan());
    /// ```
    #[unstable(feature = "sort_floats", issue = "93396")]
    #[inline]
    pub fn sort_floats(&mut self) {
        self.sort_unstable_by(f32::total_cmp);
    }
}

impl [f64] {
    /// 对浮点数列表进行排序。
    ///
    /// 此排序是原地进行的（即不分配内存），最坏情况为 *O*(*n* \* log(*n*))，并使用
    /// the ordering defined by [`f64::total_cmp`].
    ///
    /// # 当前实现
    ///
    /// This uses the same sorting algorithm as [`sort_unstable_by`](slice::sort_unstable_by).
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(sort_floats)]
    /// let mut v = [2.6, -5e-8, f64::NAN, 8.29, f64::INFINITY, -1.0, 0.0, -f64::INFINITY, -0.0];
    ///
    /// v.sort_floats();
    /// let sorted = [-f64::INFINITY, -1.0, -5e-8, -0.0, 0.0, 2.6, 8.29, f64::INFINITY, f64::NAN];
    /// assert_eq!(&v[..8], &sorted[..8]);
    /// assert!(v[8].is_nan());
    /// ```
    #[unstable(feature = "sort_floats", issue = "93396")]
    #[inline]
    pub fn sort_floats(&mut self) {
        self.sort_unstable_by(f64::total_cmp);
    }
}

/// Copies `src` to `dest`.
///
/// # 安全性
/// `T` must implement one of `Copy` or `TrivialClone`.
#[track_caller]
const unsafe fn copy_from_slice_impl<T: Clone>(dest: &mut [T], src: &[T]) {
    // The panic code path was put into a cold function to not bloat the
    // call site.
    #[cfg_attr(not(panic = "immediate-abort"), inline(never), cold)]
    #[cfg_attr(panic = "immediate-abort", inline)]
    #[track_caller]
    const fn len_mismatch_fail(dst_len: usize, src_len: usize) -> ! {
        const_panic!(
            "copy_from_slice: source slice length does not match destination slice length",
            "copy_from_slice: source slice length ({src_len}) does not match destination slice length ({dst_len})",
            src_len: usize,
            dst_len: usize,
        )
    }

    if dest.len() != src.len() {
        len_mismatch_fail(dest.len(), src.len());
    }

    // SAFETY: `self` is valid for `self.len()` elements by definition, and `src` was
    // checked to have the same length. The slices cannot overlap because
    // mutable references are exclusive.
    unsafe {
        ptr::copy_nonoverlapping(src.as_ptr(), dest.as_mut_ptr(), dest.len());
    }
}

#[rustc_const_unstable(feature = "const_clone", issue = "142757")]
const trait CloneFromSpec<T> {
    fn spec_clone_from(&mut self, src: &[T])
    where
        T: [const] Destruct;
}

#[rustc_const_unstable(feature = "const_clone", issue = "142757")]
const impl<T> CloneFromSpec<T> for [T]
where
    T: [const] Clone + [const] Destruct,
{
    #[track_caller]
    default fn spec_clone_from(&mut self, src: &[T]) {
        assert!(self.len() == src.len(), "destination and source slices have different lengths");
        // NOTE: We need to explicitly slice them to the same length
        // to make it easier for the optimizer to elide bounds checking.
        // But since it can't be relied on we also have an explicit specialization for T: Copy.
        let len = self.len();
        let src = &src[..len];
        // FIXME(const_hack): make this a `for idx in 0..self.len()` loop.
        let mut idx = 0;
        while idx < self.len() {
            self[idx].clone_from(&src[idx]);
            idx += 1;
        }
    }
}

#[rustc_const_unstable(feature = "const_clone", issue = "142757")]
const impl<T> CloneFromSpec<T> for [T]
where
    T: [const] TrivialClone + [const] Destruct,
{
    #[track_caller]
    fn spec_clone_from(&mut self, src: &[T]) {
        // SAFETY: `T` implements `TrivialClone`.
        unsafe {
            copy_from_slice_impl(self, src);
        }
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_const_unstable(feature = "const_default", issue = "143894")]
const impl<T> Default for &[T] {
    /// 创建一个空的切片。
    fn default() -> Self {
        &[]
    }
}

#[stable(feature = "mut_slice_default", since = "1.5.0")]
#[rustc_const_unstable(feature = "const_default", issue = "143894")]
const impl<T> Default for &mut [T] {
    /// 创建一个可变的空切片。
    fn default() -> Self {
        &mut []
    }
}

#[unstable(feature = "slice_pattern", issue = "none", reason = "stopgap trait for slice patterns")]
/// Patterns in slices - currently, only used by `strip_prefix` and `strip_suffix`.  At a future
/// point, we hope to generalise `core::str::Pattern` (which at the time of writing is limited to
/// `str`) to slices, and then this trait will be replaced or abolished.
pub trait SlicePattern {
    /// 匹配的切片的元素类型。
    type Item;

    /// Currently, the consumers of `SlicePattern` need a slice.
    fn as_slice(&self) -> &[Self::Item];
}

#[stable(feature = "slice_strip", since = "1.51.0")]
impl<T> SlicePattern for [T] {
    type Item = T;

    #[inline]
    fn as_slice(&self) -> &[Self::Item] {
        self
    }
}

#[stable(feature = "slice_strip", since = "1.51.0")]
impl<T, const N: usize> SlicePattern for [T; N] {
    type Item = T;

    #[inline]
    fn as_slice(&self) -> &[Self::Item] {
        self
    }
}

/// This checks every index against each other, and against `len`.
///
/// This will do `binomial(N + 1, 2) = N * (N + 1) / 2 = 0, 1, 3, 6, 10, ..`
/// 比较操作。
#[inline]
fn get_disjoint_check_valid<I: GetDisjointMutIndex, const N: usize>(
    indices: &[I; N],
    len: usize,
) -> Result<(), GetDisjointMutError> {
    // NB: The optimizer should inline the loops into a sequence
    // of instructions without additional branching.
    for (i, idx) in indices.iter().enumerate() {
        if !idx.is_in_bounds(len) {
            return Err(GetDisjointMutError::IndexOutOfBounds);
        }
        for idx2 in &indices[..i] {
            if idx.is_overlapping(idx2) {
                return Err(GetDisjointMutError::OverlappingIndices);
            }
        }
    }
    Ok(())
}

/// The error type returned by [`get_disjoint_mut`][`slice::get_disjoint_mut`].
///
/// 它表示两种可能的错误之一：
/// - 索引超出范围。
/// - 同一索引在数组中出现多次。
/// （或当提供范围时，是不同但重叠的索引）。
///
/// # 示例
///
/// ```
/// use std::slice::GetDisjointMutError;
///
/// let v = &mut [1, 2, 3];
/// assert_eq!(v.get_disjoint_mut([0, 999]), Err(GetDisjointMutError::IndexOutOfBounds));
/// assert_eq!(v.get_disjoint_mut([1, 1]), Err(GetDisjointMutError::OverlappingIndices));
/// ```
#[stable(feature = "get_many_mut", since = "1.86.0")]
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum GetDisjointMutError {
    /// 提供的索引超出了切片的边界。
    IndexOutOfBounds,
    /// 提供的两个索引是重叠的。
    OverlappingIndices,
}

#[stable(feature = "get_many_mut", since = "1.86.0")]
impl fmt::Display for GetDisjointMutError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let msg = match self {
            GetDisjointMutError::IndexOutOfBounds => "an index is out of bounds",
            GetDisjointMutError::OverlappingIndices => "there were overlapping indices",
        };
        fmt::Display::fmt(msg, f)
    }
}

/// A helper trait for `<[T]>::get_disjoint_mut()`.
///
/// # 安全性
///
/// If `is_in_bounds()` returns `true` and `is_overlapping()` returns `false`,
/// 则使用这些索引对切片进行索引操作必须是安全的。
#[unstable(feature = "get_disjoint_mut_helpers", issue = "none")]
pub impl(self) unsafe trait GetDisjointMutIndex: Clone {
    /// Returns `true` if `self` is in bounds for `len` slice elements.
    #[unstable(feature = "get_disjoint_mut_helpers", issue = "none")]
    fn is_in_bounds(&self, len: usize) -> bool;

    /// Returns `true` if `self` overlaps with `other`.
    ///
    /// 注意，我们并不认为零长度范围在开头或结尾处会重叠，
    /// 但确实认为它们在中间会重叠。
    #[unstable(feature = "get_disjoint_mut_helpers", issue = "none")]
    fn is_overlapping(&self, other: &Self) -> bool;
}

#[unstable(feature = "get_disjoint_mut_helpers", issue = "none")]
// SAFETY: We implement `is_in_bounds()` and `is_overlapping()` correctly.
unsafe impl GetDisjointMutIndex for usize {
    #[inline]
    fn is_in_bounds(&self, len: usize) -> bool {
        *self < len
    }

    #[inline]
    fn is_overlapping(&self, other: &Self) -> bool {
        *self == *other
    }
}

#[unstable(feature = "get_disjoint_mut_helpers", issue = "none")]
// SAFETY: We implement `is_in_bounds()` and `is_overlapping()` correctly.
unsafe impl GetDisjointMutIndex for Range<usize> {
    #[inline]
    fn is_in_bounds(&self, len: usize) -> bool {
        (self.start <= self.end) & (self.end <= len)
    }

    #[inline]
    fn is_overlapping(&self, other: &Self) -> bool {
        (self.start < other.end) & (other.start < self.end)
    }
}

#[unstable(feature = "get_disjoint_mut_helpers", issue = "none")]
// SAFETY: We implement `is_in_bounds()` and `is_overlapping()` correctly.
unsafe impl GetDisjointMutIndex for RangeInclusive<usize> {
    #[inline]
    fn is_in_bounds(&self, len: usize) -> bool {
        (self.start <= self.end) & (self.end < len)
    }

    #[inline]
    fn is_overlapping(&self, other: &Self) -> bool {
        (self.start <= other.end) & (other.start <= self.end)
    }
}

#[unstable(feature = "get_disjoint_mut_helpers", issue = "none")]
// SAFETY: We implement `is_in_bounds()` and `is_overlapping()` correctly.
unsafe impl GetDisjointMutIndex for range::Range<usize> {
    #[inline]
    fn is_in_bounds(&self, len: usize) -> bool {
        Range::from(*self).is_in_bounds(len)
    }

    #[inline]
    fn is_overlapping(&self, other: &Self) -> bool {
        Range::from(*self).is_overlapping(&Range::from(*other))
    }
}

#[unstable(feature = "get_disjoint_mut_helpers", issue = "none")]
// SAFETY: We implement `is_in_bounds()` and `is_overlapping()` correctly.
unsafe impl GetDisjointMutIndex for range::RangeInclusive<usize> {
    #[inline]
    fn is_in_bounds(&self, len: usize) -> bool {
        RangeInclusive::from(*self).is_in_bounds(len)
    }

    #[inline]
    fn is_overlapping(&self, other: &Self) -> bool {
        RangeInclusive::from(*self).is_overlapping(&RangeInclusive::from(*other))
    }
}
