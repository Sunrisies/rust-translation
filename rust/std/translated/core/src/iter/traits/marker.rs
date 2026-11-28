use crate::iter::Step;
use crate::num::NonZero;

/// 与 FusedIterator 相同
///
/// # 安全性
///
/// 此特性用于特化，因此实现不得依赖
/// 生命周期。
#[unstable(issue = "none", feature = "trusted_fused")]
#[doc(hidden)]
#[rustc_specialization_trait]
pub unsafe trait TrustedFused {}

/// An iterator that always continues to yield `None` when exhausted.
///
/// Calling next on a fused iterator that has returned `None` once is guaranteed
/// to return [`None`] again. This trait should be implemented by all iterators
/// that behave this way because it allows optimizing [`Iterator::fuse()`].
///
/// Note: In general, you should not use `FusedIterator` in generic bounds if
/// you need a fused iterator. Instead, you should just call [`Iterator::fuse()`]
/// on the iterator. If the iterator is already fused, the additional [`Fuse`]
/// wrapper will be a no-op with no performance penalty.
///
/// [`Fuse`]: crate::iter::Fuse
#[stable(feature = "fused", since = "1.26.0")]
#[unsafe(rustc_allow_lifetime_dependent_specialization)]
// FIXME: this should be a #[marker] and have another blanket impl for T: TrustedFused
// but that ICEs iter::Fuse specializations.
#[lang = "fused_iterator"]
pub trait FusedIterator: Iterator {}

#[stable(feature = "fused", since = "1.26.0")]
impl<I: FusedIterator + ?Sized> FusedIterator for &mut I {}

/// An iterator that reports an accurate length using size_hint.
///
/// The iterator reports a size hint where it is either exact
/// (lower bound is equal to upper bound), or the upper bound is [`None`].
/// The upper bound must only be [`None`] if the actual iterator length is
/// larger than [`usize::MAX`]. In that case, the lower bound must be
/// [`usize::MAX`], resulting in an [`Iterator::size_hint()`] of
/// `(usize::MAX, None)`.
///
/// The iterator must produce exactly the number of elements it reported
/// or diverge before reaching the end.
///
/// # When *shouldn't* an adapter be `TrustedLen`?
///
/// # 安全性
/// usually incorrect for that adapter to implement `TrustedLen`.  The inner
/// iterator might return more than `usize::MAX` items, but there's no way to
/// know what `k` elements less than that will be, since the `size_hint` from
/// the inner iterator has already saturated and lost that information.
///
/// This is why [`Skip<I>`](crate::iter::Skip) isn't `TrustedLen`, even when
/// `I` implements `TrustedLen`.
///
/// # 换句话说，此 trait 表明迭代器管道可以在原地收集。
///
/// This trait must only be implemented when the contract is upheld. Consumers
/// of this trait must inspect [`Iterator::size_hint()`]’s upper bound.
#[unstable(feature = "trusted_len", issue = "37572")]
#[unsafe(rustc_allow_lifetime_dependent_specialization)]
#[rustc_const_unstable(feature = "const_iter", issue = "92476")]
pub const unsafe trait TrustedLen: [const] Iterator {}

#[unstable(feature = "trusted_len", issue = "37572")]
#[rustc_const_unstable(feature = "const_iter", issue = "92476")]
unsafe impl<I: TrustedLen + ?Sized> TrustedLen for &mut I {}

/// An iterator that when yielding an item will have taken at least one element
/// from its underlying [`SourceIter`].
///
/// Calling any method that advances the iterator, e.g.  [`next()`] or [`try_fold()`],
/// guarantees that for each step at least one value of the iterator's underlying source
/// has been moved out and the result of the iterator chain could be inserted
/// in its place, assuming structural constraints of the source allow such an insertion.
/// In other words this trait indicates that an iterator pipeline can be collected in place.
///
/// The primary use of this trait is in-place iteration. Refer to the [`vec::in_place_collect`]
/// 更多信息请参考模块文档。
///
/// [`vec::in_place_collect`]: ../../../../alloc/vec/in_place_collect/index.html
/// [`SourceIter`]: crate::iter::SourceIter
/// [`next()`]: Iterator::next
/// [`try_fold()`]: Iterator::try_fold
#[unstable(issue = "none", feature = "inplace_iteration")]
#[doc(hidden)]
#[rustc_specialization_trait]
pub unsafe trait InPlaceIterable {
    /// 这是迭代器管道中发生的“一对一”项展开的乘积结果。
    /// E.g. [[u8; 4]; 4].iter().flatten().flatten() would have a `EXPAND_BY` of 16.
    /// 这是一个上限，即转换操作最多会产生此数量的项。
    /// 它用于布局计算。
    const EXPAND_BY: Option<NonZero<usize>>;
    /// 这是迭代器管道中发生的“多对一”项减少的乘积结果。
    /// E.g. [u8].iter().array_chunks::<4>().array_chunks::<4>() would have a `MERGE_BY` of 16.
    /// 这是一个下限，即转换操作至少会消耗此数量的项。
    /// 用于输出结果。
    const MERGE_BY: Option<NonZero<usize>>;
}

/// A type that upholds all invariants of [`Step`].
///
/// The invariants of [`Step::steps_between()`] are a superset of the invariants
/// of [`TrustedLen`]. As such, [`TrustedLen`] is implemented for all range
/// types with the same generic type argument.
///
/// # 消费者可以在 unsafe 代码中使用这些不变量，无需担心。
///
/// The implementation of [`Step`] for the given type must guarantee all
/// invariants of all methods are upheld. See the [`Step`] trait's documentation
/// for details. Consumers are free to rely on the invariants in unsafe code.
#[unstable(feature = "trusted_step", issue = "85731")]
#[rustc_specialization_trait]
pub unsafe trait TrustedStep: Step + Copy {}
