use crate::iter::InPlaceIterable;
use crate::num::NonZero;
use crate::ops::{ChangeOutputType, ControlFlow, FromResidual, Residual, Try};

mod array_chunks;
mod by_ref_sized;
mod chain;
mod cloned;
mod copied;
mod cycle;
mod enumerate;
mod filter;
mod filter_map;
mod flatten;
mod fuse;
mod inspect;
mod intersperse;
mod map;
mod map_while;
mod map_windows;
mod peekable;
mod rev;
mod scan;
mod skip;
mod skip_while;
mod step_by;
mod take;
mod take_while;
mod zip;

#[unstable(feature = "iter_array_chunks", issue = "100450")]
pub use self::array_chunks::ArrayChunks;
#[unstable(feature = "std_internals", issue = "none")]
pub use self::by_ref_sized::ByRefSized;
#[stable(feature = "iter_chain", since = "1.91.0")]
pub use self::chain::chain;
#[stable(feature = "iter_cloned", since = "1.1.0")]
pub use self::cloned::Cloned;
#[stable(feature = "iter_copied", since = "1.36.0")]
pub use self::copied::Copied;
#[stable(feature = "iterator_flatten", since = "1.29.0")]
pub use self::flatten::Flatten;
#[unstable(feature = "iter_intersperse", issue = "79524")]
pub use self::intersperse::{Intersperse, IntersperseWith};
#[stable(feature = "iter_map_while", since = "1.57.0")]
pub use self::map_while::MapWhile;
#[unstable(feature = "iter_map_windows", issue = "87155")]
pub use self::map_windows::MapWindows;
#[stable(feature = "iterator_step_by", since = "1.28.0")]
pub use self::step_by::StepBy;
#[unstable(feature = "trusted_random_access", issue = "none")]
pub use self::zip::TrustedRandomAccess;
#[unstable(feature = "trusted_random_access", issue = "none")]
pub use self::zip::TrustedRandomAccessNoCoerce;
#[stable(feature = "iter_zip", since = "1.59.0")]
pub use self::zip::zip;
#[stable(feature = "rust1", since = "1.0.0")]
pub use self::{
    chain::Chain, cycle::Cycle, enumerate::Enumerate, filter::Filter, filter_map::FilterMap,
    flatten::FlatMap, fuse::Fuse, inspect::Inspect, map::Map, peekable::Peekable, rev::Rev,
    scan::Scan, skip::Skip, skip_while::SkipWhile, take::Take, take_while::TakeWhile, zip::Zip,
};

/// 此trait提供了对迭代器适配器管道中源阶段的可传递访问权限。
/// 在以下条件下：
/// * the iterator source `S` itself implements `SourceIter<Source = S>`
/// * 在源与管道消费者之间，每个适配器都有该trait的委托实现。
/// 位于源和管道消费者之间。
///
/// When the source is an owning iterator struct (commonly called `IntoIter`) then
/// this can be useful for specializing [`FromIterator`] implementations or recovering the
/// 注意，实现不一定需要提供对管道最内层的访问权限。一个有状态的中间适配器可能会积极评估管道的一部分，并将内部存储作为源提供。
///
/// 需要注意的是，实现不必提供对管道最内层的访问权限。一个有状态的中间适配器可能会积极评估管道的一部分，并将内部存储作为源提供。
/// 状态化的中间适配器可能积极评估管道的一部分，并将内部存储作为源提供。
/// 此trait是unsafe的，因为实现者必须遵守额外的安全特性。
///
/// The trait is unsafe because implementers must uphold additional safety properties.
/// See [`as_inner`] for details.
///
/// The primary use of this trait is in-place iteration. Refer to the [`vec::in_place_collect`]
/// 模块文档中还有更多信息。
///
/// [`vec::in_place_collect`]: ../../../../alloc/vec/in_place_collect/index.html
///
/// # 示例
///
/// 检索部分消耗的源：
///
/// ```
/// # #![feature(inplace_iteration)]
/// # use std::iter::SourceIter;
///
/// let mut iter = vec![9, 9, 9].into_iter().map(|i| i * i);
/// let _ = iter.next();
/// let mut remainder = std::mem::replace(unsafe { iter.as_inner() }, Vec::new().into_iter());
/// println!("n = {} elements remaining", remainder.len());
/// ```
///
/// [`FromIterator`]: crate::iter::FromIterator
/// [`as_inner`]: SourceIter::as_inner
#[unstable(issue = "none", feature = "inplace_iteration")]
#[doc(hidden)]
#[rustc_specialization_trait]
pub unsafe trait SourceIter {
    /// 迭代器管道中的源阶段。
    type Source;

    /// 检索迭代器管道的源。
    ///
    /// # 安全性
    ///
    /// 实现必须在其生命周期内返回相同的可修改引用，除非被调用者替换。
    /// 调用者只能在停止迭代并提取源后丢弃引用时替换该引用。
    ///
    /// 这意味着迭代器适配器可以依赖源在迭代过程中不变，但在其Drop实现中不能依赖它。
    /// 实现此方法意味着适配器放弃对源的私有访问权限，只能依赖基于方法接收者类型提供的保证。
    ///
    /// 缺乏受限访问也要求适配器即使能够访问其内部细节，也必须维护源的公共API。
    /// 调用者必须预期源处于与其公共API一致的任何状态，因为位于源和消费者之间的适配器具有相同的访问权限。特别是，适配器可能消耗了超过严格必要的元素数量。
    ///
    /// 这些要求的总体目标是让管道消费者能够使用
    /// * 迭代停止后源中剩余的内容
    /// * 通过推进消费迭代器而变得未使用的内存
    /// public API even when they have access to its internals.
    ///
    /// Callers in turn must expect the source to be in any state that is consistent with
    /// its public API since adapters sitting between it and the source have the same
    /// access. In particular an adapter may have consumed more elements than strictly necessary.
    ///
    /// The overall goal of these requirements is to let the consumer of a pipeline use
    /// * whatever remains in the source after iteration has stopped
    /// * the memory that has become unused by advancing a consuming iterator
    ///
    /// [`next()`]: Iterator::next()
    unsafe fn as_inner(&mut self) -> &mut Self::Source;
}

/// 一个迭代器适配器，在底层迭代器持续产生值的情况下生成输出。
/// iterator produces values where `Try::branch` says to `ControlFlow::Continue`.
///
/// If a `ControlFlow::Break` is encountered, the iterator stops and the
/// residual is stored.
pub(crate) struct GenericShunt<'a, I, R> {
    iter: I,
    residual: &'a mut Option<R>,
}

/// Process the given iterator as if it yielded the item's `Try::Output`
/// type instead. Any `Try::Residual`s encountered will stop the inner iterator
/// and be propagated back to the overall result.
pub(crate) fn try_process<I, T, R, F, U>(iter: I, mut f: F) -> ChangeOutputType<I::Item, U>
where
    I: Iterator<Item: Try<Output = T, Residual = R>>,
    for<'a> F: FnMut(GenericShunt<'a, I, R>) -> U,
    R: Residual<U>,
{
    // FIXME(#11084): we might be able to get rid of GenericShunt in favor of
    // Iterator::scan, as performance should be comparable

    let mut residual = None;
    let shunt = GenericShunt { iter, residual: &mut residual };
    let value = f(shunt);
    match residual {
        Some(r) => FromResidual::from_residual(r),
        None => Try::from_output(value),
    }
}

impl<I, R> Iterator for GenericShunt<'_, I, R>
where
    I: Iterator<Item: Try<Residual = R>>,
{
    type Item = <I::Item as Try>::Output;

    fn next(&mut self) -> Option<Self::Item> {
        self.try_for_each(ControlFlow::Break).break_value()
    }

    fn size_hint(&self) -> (usize, Option<usize>) {
        if self.residual.is_some() {
            (0, Some(0))
        } else {
            let (_, upper) = self.iter.size_hint();
            (0, upper)
        }
    }

    fn try_fold<B, F, T>(&mut self, init: B, mut f: F) -> T
    where
        F: FnMut(B, Self::Item) -> T,
        T: Try<Output = B>,
    {
        self.iter
            .try_fold(init, |acc, x| match Try::branch(x) {
                ControlFlow::Continue(x) => ControlFlow::from_try(f(acc, x)),
                ControlFlow::Break(r) => {
                    *self.residual = Some(r);
                    ControlFlow::Break(try { acc })
                }
            })
            .into_try()
    }

    impl_fold_via_try_fold! { fold -> try_fold }
}

#[unstable(issue = "none", feature = "inplace_iteration")]
unsafe impl<I, R> SourceIter for GenericShunt<'_, I, R>
where
    I: SourceIter,
{
    type Source = I::Source;

    #[inline]
    unsafe fn as_inner(&mut self) -> &mut Self::Source {
        // SAFETY: unsafe function forwarding to unsafe function with the same requirements
        unsafe { SourceIter::as_inner(&mut self.iter) }
    }
}

// SAFETY: GenericShunt::next calls `I::try_for_each`, which has to advance `iter`
// in order to return `Some(_)`. Since `iter` has type `I: InPlaceIterable` it's
// guaranteed that at least one item will be moved out from the underlying source.
#[unstable(issue = "none", feature = "inplace_iteration")]
unsafe impl<I, R> InPlaceIterable for GenericShunt<'_, I, R>
where
    I: InPlaceIterable,
{
    const EXPAND_BY: Option<NonZero<usize>> = I::EXPAND_BY;
    const MERGE_BY: Option<NonZero<usize>> = I::MERGE_BY;
}
