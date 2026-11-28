use crate::iter::{FusedIterator, TrustedLen};
use crate::num::NonZero;

/// 创建一个不断重复单一元素的迭代器。
///
/// The `repeat()` function repeats a single value over and over again.
///
/// Infinite iterators like `repeat()` are often used with adapters like
/// [`Iterator::take()`], in order to make them finite.
///
/// If you know the number of repetitions in advance, consider using [`repeat_n()`]
/// instead, as it is more efficient and conveys the intent more clearly.
///
/// Use [`str::repeat()`] instead of this function if you just want to repeat
/// a char/string `n` times.
///
/// If the element type of the iterator you need does not implement `Clone`,
/// # 示例
/// instead use the [`repeat_with()`] function.
///
/// [`repeat_n()`]: crate::iter::repeat_n
/// [`repeat_with()`]: crate::iter::repeat_with
/// [`str::repeat()`]: ../../std/primitive.str.html#method.repeat
///
/// # Examples
///
/// 基本用法：
///
/// ```
/// use std::iter;
///
/// // the number four 4ever:
/// let mut fours = iter::repeat(4);
///
/// assert_eq!(Some(4), fours.next());
/// assert_eq!(Some(4), fours.next());
/// assert_eq!(Some(4), fours.next());
/// assert_eq!(Some(4), fours.next());
/// assert_eq!(Some(4), fours.next());
///
/// // yup, still four
/// assert_eq!(Some(4), fours.next());
/// ```
///
/// Going finite with [`Iterator::take()`]:
///
/// ```
/// use std::iter;
///
/// // that last example was too many fours. Let's only have four fours.
/// let mut four_fours = iter::repeat(4).take(4);
///
/// assert_eq!(Some(4), four_fours.next());
/// assert_eq!(Some(4), four_fours.next());
/// assert_eq!(Some(4), four_fours.next());
/// assert_eq!(Some(4), four_fours.next());
///
/// // ... and now we're done
/// assert_eq!(None, four_fours.next());
/// ```
#[inline]
#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_diagnostic_item = "iter_repeat"]
pub fn repeat<T: Clone>(elt: T) -> Repeat<T> {
    Repeat { element: elt }
}

/// 一个不断重复元素的迭代器。
///
/// This `struct` is created by the [`repeat()`] function. See its documentation for more.
#[derive(Clone, Debug)]
#[stable(feature = "rust1", since = "1.0.0")]
pub struct Repeat<A> {
    element: A,
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<A: Clone> Iterator for Repeat<A> {
    type Item = A;

    #[inline]
    fn next(&mut self) -> Option<A> {
        Some(self.element.clone())
    }

    #[inline]
    fn size_hint(&self) -> (usize, Option<usize>) {
        (usize::MAX, None)
    }

    #[inline]
    fn advance_by(&mut self, n: usize) -> Result<(), NonZero<usize>> {
        // Advancing an infinite iterator of a single element is a no-op.
        let _ = n;
        Ok(())
    }

    #[inline]
    fn nth(&mut self, n: usize) -> Option<A> {
        let _ = n;
        Some(self.element.clone())
    }

    /// 消耗迭代器并引发 panic。
    ///
    /// # panic
    ///
    /// This method always panics because `Repeat` is infinite.
    #[track_caller]
    fn last(self) -> Option<A> {
        panic!("iterator is infinite");
    }

    /// 消耗迭代器并引发 panic。
    ///
    /// # panic
    ///
    /// This method always panics because `Repeat` is infinite.
    #[track_caller]
    fn count(self) -> usize {
        panic!("iterator is infinite");
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<A: Clone> DoubleEndedIterator for Repeat<A> {
    #[inline]
    fn next_back(&mut self) -> Option<A> {
        Some(self.element.clone())
    }

    #[inline]
    fn advance_back_by(&mut self, n: usize) -> Result<(), NonZero<usize>> {
        // Advancing an infinite iterator of a single element is a no-op.
        let _ = n;
        Ok(())
    }

    #[inline]
    fn nth_back(&mut self, n: usize) -> Option<A> {
        let _ = n;
        Some(self.element.clone())
    }
}

#[stable(feature = "fused", since = "1.26.0")]
impl<A: Clone> FusedIterator for Repeat<A> {}

#[unstable(feature = "trusted_len", issue = "37572")]
unsafe impl<A: Clone> TrustedLen for Repeat<A> {}
