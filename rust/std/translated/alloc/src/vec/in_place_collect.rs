//! Inplace iterate-and-collect specialization for `Vec`
//!
//! 注意：本文档介绍了 `Vec` 的内部机制，以下部分将解释实现细节
//! 以及模块源代码，建议结合源代码一起阅读。
//!
//! 本模块的特化适用于以下形式的迭代器：
//! `source.adapter().adapter().adapter().collect::<Vec<U>>()`
//! where `source` is an owning iterator obtained from [`Vec<T>`], [`Box<[T]>`][box] (by conversion to `Vec`)
//! or [`BinaryHeap<T>`], the adapters guarantee to consume enough items per step to make room
//! for the results (represented by [`InPlaceIterable`]), provide transitive access to `source`
//! (via [`SourceIter`]) and thus the underlying allocation.
//! 最后还有对齐和大小限制需要考虑，目前通过
//! const eval instead of trait bounds in the specialized [`SpecFromIter`] implementation.
//!
//! [`BinaryHeap<T>`]: crate::collections::BinaryHeap
//! [box]: crate::boxed::Box
//!
//! By extension some other collections which use `collect::<Vec<_>>()` internally in their
//! `FromIterator` implementation benefit from this too.
//!
//! 对底层源的访问通过额外的间接层通过私有
//! trait [`AsVecIntoIter`] to hide the implementation detail that other collections may use
//! `vec::IntoIter` internally.
//!
//! 就地迭代依赖于多个 unsafe trait 的交互、实现细节
//! 迭代器管道中多个部分的细节，通常需要整体考虑
//! 多个结构体，因为迭代器是协作执行的，而不是有一个
//! 中央评估器/访问者结构体执行所有迭代器组件。
//!
//! # 从同一分配器中读取和写入
//!
//! By its nature collecting in place means that the reader and writer side of the iterator
//! use the same allocation. Since `try_fold()` (used in [`SpecInPlaceCollect`]) takes a
//! 读取值步骤和获取引用以写入步骤。相反，必须在读取者和写入者侧使用原始指针。
//! the step of reading a value and getting a reference to write to. Instead raw pointers must be
//! # 布局限制
//!
//! That writes never clobber a yet-to-be-read items is ensured by the [`InPlaceIterable`] requirements.
//!
//! # 这意味着输入和输出的布局必须“匹配”。
//!
//! When recycling an allocation between different types we must uphold the [`Allocator`] contract
//! which means that the input and output Layouts have to "fit".
//!
//! To complicate things further `InPlaceIterable` supports splitting or merging items into smaller/
//! larger ones to enable (de)aggregation of arrays.
//!
//! 最终，迭代器的每一步都必须在源数据中释放足够的 *bytes* 以腾出空间
//! 用于下一个输出项。
//! If `T` and `U` have the same size no fixup is needed.
//! If `T`'s size is a multiple of `U`'s we can compensate by multiplying the capacity accordingly.
//! 否则，输入容量（从而布局）以字节为单位可能无法被输出表示。
//! `Vec<U>`. In that case `alloc.shrink()` is used to update the allocation's layout.
//!
//! Alignments of `T` must be the same or larger than `U`. Since alignments are always a power
//! 意味着 _是的倍数_。
//!
//! See `in_place_collectible()` for the current conditions.
//!
//! 此外，这种特化对于 ZST 没有意义，因为不存在重新分配来
//! 避免这种情况，并且会使指针运算更加复杂。
//!
//! [`Allocator`]: core::alloc::Allocator
//!
//! # Drop-和 panic-安全性
//!
//! 迭代可能会触发 panic，需要丢弃已写入的部分以及剩余的
//! 源数据。迭代还可能留下一些未消耗的源项，这些项也必须被丢弃。
//! 所有这些丢弃都可能引发 panic，然后必须要么泄露分配空间，要么中止以避免
//! 双重丢弃。
//!
//! This is handled by the [`InPlaceDrop`] guard for sink items (`U`) and by
//! [`vec::IntoIter::forget_allocation_drop_remaining()`] for remaining source items (`T`).
//!
//! If dropping any remaining source item (`T`) panics then [`InPlaceDstDataSrcBufDrop`] will handle dropping
//! the already collected sink items (`U`) and freeing the allocation.
//!
//! [`vec::IntoIter::forget_allocation_drop_remaining()`]: super::IntoIter::forget_allocation_drop_remaining()
//!
//! # O(1) 收集
//!
//! 当迭代器实现
//! [`TrustedRandomAccessNoCoerce`] to let the optimizer see that it is a counted loop with a single
//! [归纳变量] 的计数循环。这可以使某些迭代器变成无操作，即将其从 O(n) 降为
//! O(1)。这种特定优化非常不可靠，并不总是有效，请参阅 [#79308]
//!
//! [#79308]: https://github.com/rust-lang/rust/issues/79308
//! [induction variable]: https://en.wikipedia.org/wiki/Induction_variable
//!
//! Since unchecked accesses through that trait do not advance the read pointer of `IntoIter`
//! 这会与上述关于丢弃尾部的要求产生不合理的交互。
//! But since the normal `Drop` implementation of `IntoIter` would suffer from the same problem it
//! is only correct for `TrustedRandomAccessNoCoerce` to be implemented when the items don't
//! 析构函数时，这种隐含要求使得特化对于
//! 就地收集是安全的。
//! Note that this safety concern is about the correctness of `impl Drop for IntoIter`,
//! not the guarantees of `InPlaceIterable`.
//!
//! # Adapter 实现
//!
//! The invariants for adapters are documented in [`SourceIter`] and [`InPlaceIterable`], but
//! 由于多种有时非局部的原因，正确实现它们可能相当微妙。
//! For example `InPlaceIterable` would be valid to implement for [`Peekable`], except
//! that it is stateful, cloneable and `IntoIter`'s clone implementation shortens the underlying
//! 分配空间，这意味着如果迭代器被查看后又被克隆，就不再有足够空间，从而破坏不变量 ([#85322])。
//! # 示例
//!
//! [#85322]: https://github.com/rust-lang/rust/issues/85322
//! [`Peekable`]: core::iter::Peekable
//!
//!
//! # Examples
//!
//! Some cases that are optimized by this specialization, more can be found in the `Vec`
//! 基准测试：
//!
//! ```rust
//! # #[allow(dead_code)]
//! /// Converts a usize vec into an isize one.
//! pub fn cast(vec: Vec<usize>) -> Vec<isize> {
//!   // Does not allocate, free or panic. On optlevel>=2 it does not loop.
//!   // Of course this particular case could and should be written with `into_raw_parts` and
//!   // `from_raw_parts` instead.
//!   vec.into_iter().map(|u| u as isize).collect()
//! }
//! ```
//!
//! ```rust
//! # #[allow(dead_code)]
//! /// Drops remaining items in `src` and if the layouts of `T` and `U` match it
//! /// returns an empty Vec backed by the original allocation. Otherwise it returns a new
//! /// empty vec.
//! pub fn recycle_allocation<T, U>(src: Vec<T>) -> Vec<U> {
//!   src.into_iter().filter_map(|_| None).collect()
//! }
//! ```
//!
//! ```rust
//! let vec = vec![13usize; 1024];
//! let _ = vec.into_iter()
//!   .enumerate()
//!   .filter_map(|(idx, val)| if idx % 2 == 0 { Some(val+idx) } else {None})
//!   .collect::<Vec<_>>();
//!
//! // is equivalent to the following, but doesn't require bounds checks
//!
//! let mut vec = vec![13usize; 1024];
//! let mut write_idx = 0;
//! for idx in 0..vec.len() {
//!    if idx % 2 == 0 {
//!       vec[write_idx] = vec[idx] + idx;
//!       write_idx += 1;
//!    }
//! }
//! vec.truncate(write_idx);
//! ```

use core::alloc::{Allocator, Layout};
use core::iter::{InPlaceIterable, SourceIter, TrustedRandomAccessNoCoerce};
use core::marker::PhantomData;
use core::mem::{self, ManuallyDrop, SizedTypeProperties};
use core::num::NonZero;
use core::ptr;

use super::{InPlaceDrop, InPlaceDstDataSrcBufDrop, SpecFromIter, SpecFromIterNested, Vec};
use crate::alloc::{Global, handle_alloc_error};

const fn in_place_collectible<DEST, SRC>(
    step_merge: Option<NonZero<usize>>,
    step_expand: Option<NonZero<usize>>,
) -> bool {
    // Require matching alignments because an alignment-changing realloc is inefficient on many
    // system allocators and better implementations would require the unstable Allocator trait.
    if const { SRC::IS_ZST || DEST::IS_ZST || align_of::<SRC>() != align_of::<DEST>() } {
        return false;
    }

    match (step_merge, step_expand) {
        (Some(step_merge), Some(step_expand)) => {
            // At least N merged source items -> at most M expanded destination items
            // e.g.
            // - 1 x [u8; 4] -> 4x u8, via flatten
            // - 4 x u8 -> 1x [u8; 4], via array_chunks
            size_of::<SRC>() * step_merge.get() >= size_of::<DEST>() * step_expand.get()
        }
        // Fall back to other from_iter impls if an overflow occurred in the step merge/expansion
        // tracking.
        _ => false,
    }
}

const fn needs_realloc<SRC, DEST>(src_cap: usize, dst_cap: usize) -> bool {
    if const { align_of::<SRC>() != align_of::<DEST>() } {
        // FIXME(const-hack): use unreachable! once that works in const
        panic!("in_place_collectible() prevents this");
    }

    // If src type size is an integer multiple of the destination type size then
    // the caller will have calculated a `dst_cap` that is an integer multiple of
    // `src_cap` without remainder.
    if const {
        let src_sz = size_of::<SRC>();
        let dest_sz = size_of::<DEST>();
        dest_sz != 0 && src_sz % dest_sz == 0
    } {
        return false;
    }

    // type layouts don't guarantee a fit, so do a runtime check to see if
    // the allocations happen to match
    src_cap > 0 && src_cap * size_of::<SRC>() != dst_cap * size_of::<DEST>()
}

/// 由于本地类型别名不存在，这提供了源类型的简写形式。
#[rustc_specialization_trait]
trait InPlaceCollect: SourceIter<Source: AsVecIntoIter> + InPlaceIterable {
    type Src;
}

impl<T> InPlaceCollect for T
where
    T: SourceIter<Source: AsVecIntoIter> + InPlaceIterable,
{
    type Src = <<T as SourceIter>::Source as AsVecIntoIter>::Item;
}

impl<T, I> SpecFromIter<T, I> for Vec<T>
where
    I: Iterator<Item = T> + InPlaceCollect,
    <I as SourceIter>::Source: AsVecIntoIter,
{
    default fn from_iter(iterator: I) -> Self {
        // Select the implementation in const eval to avoid codegen of the dead branch to improve compile times.
        let fun: fn(I) -> Vec<T> = const {
            // See "Layout constraints" section in the module documentation. We use const conditions here
            // since these conditions currently cannot be expressed as trait bounds
            if in_place_collectible::<T, I::Src>(I::MERGE_BY, I::EXPAND_BY) {
                from_iter_in_place
            } else {
                // fallback
                SpecFromIterNested::<T, I>::from_iter
            }
        };

        fun(iterator)
    }
}

fn from_iter_in_place<I, T>(mut iterator: I) -> Vec<T>
where
    I: Iterator<Item = T> + InPlaceCollect,
    <I as SourceIter>::Source: AsVecIntoIter,
{
    // ignore-tidy-undocumented-unsafe
    let (src_buf, src_ptr, src_cap, mut dst_buf, dst_end, dst_cap) = unsafe {
        let inner = iterator.as_inner().as_into_iter();
        (
            inner.buf,
            inner.ptr,
            inner.cap,
            inner.buf.cast::<T>(),
            inner.end as *const T,
            // SAFETY: the multiplication can not overflow, since `inner.cap * size_of::<I::SRC>()` is the size of the allocation.
            inner.cap.unchecked_mul(size_of::<I::Src>()) / size_of::<T>(),
        )
    };

    // SAFETY: `dst_buf` and `dst_end` are the start and end of the buffer.
    let len = unsafe {
        SpecInPlaceCollect::collect_in_place(&mut iterator, dst_buf.as_ptr() as *mut T, dst_end)
    };

    // ignore-tidy-undocumented-unsafe
    let src = unsafe { iterator.as_inner().as_into_iter() };
    // check if SourceIter contract was upheld
    // caveat: if they weren't we might not even make it to this point
    debug_assert_eq!(src_buf, src.buf);
    // check InPlaceIterable contract. This is only possible if the iterator advanced the
    // source pointer at all. If it uses unchecked access via TrustedRandomAccess
    // then the source pointer will stay in its initial position and we can't use it as reference
    if src.ptr != src_ptr {
        debug_assert!(
            // ignore-tidy-undocumented-unsafe
            unsafe { dst_buf.add(len).cast() } <= src.ptr,
            "InPlaceIterable contract violation, write pointer advanced beyond read pointer"
        );
    }

    // The ownership of the source allocation and the new `T` values is temporarily moved into `dst_guard`.
    // This is safe because
    // * `forget_allocation_drop_remaining` immediately forgets the allocation
    // before any panic can occur in order to avoid any double free, and then proceeds to drop
    // any remaining values at the tail of the source.
    // * the shrink either panics without invalidating the allocation, aborts or
    //   succeeds. In the last case we disarm the guard.
    //
    // Note: This access to the source wouldn't be allowed by the TrustedRandomIteratorNoCoerce
    // contract (used by SpecInPlaceCollect below). But see the "O(1) collect" section in the
    // module documentation why this is ok anyway.
    let dst_guard =
        InPlaceDstDataSrcBufDrop { ptr: dst_buf, len, src_cap, src: PhantomData::<I::Src> };
    src.forget_allocation_drop_remaining();

    // Adjust the allocation if the source had a capacity in bytes that wasn't a multiple
    // of the destination type size.
    // Since the discrepancy should generally be small this should only result in some
    // bookkeeping updates and no memmove.
    if needs_realloc::<I::Src, T>(src_cap, dst_cap) {
        let alloc = Global;
        debug_assert_ne!(src_cap, 0);
        debug_assert_ne!(dst_cap, 0);
        // ignore-tidy-undocumented-unsafe
        unsafe {
            // The old allocation exists, therefore it must have a valid layout.
            let src_align = align_of::<I::Src>();
            let src_size = size_of::<I::Src>().unchecked_mul(src_cap);
            let old_layout = Layout::from_size_align_unchecked(src_size, src_align);

            // The allocation must be equal or smaller for in-place iteration to be possible
            // therefore the new layout must be ≤ the old one and therefore valid.
            let dst_align = align_of::<T>();
            let dst_size = size_of::<T>().unchecked_mul(dst_cap);
            let new_layout = Layout::from_size_align_unchecked(dst_size, dst_align);

            let result = alloc.shrink(dst_buf.cast(), old_layout, new_layout);
            let Ok(reallocated) = result else { handle_alloc_error(new_layout) };
            dst_buf = reallocated.cast::<T>();
        }
    } else {
        debug_assert_eq!(src_cap * size_of::<I::Src>(), dst_cap * size_of::<T>());
    }

    mem::forget(dst_guard);

    // ignore-tidy-undocumented-unsafe
    unsafe { Vec::from_parts(dst_buf, len, dst_cap) }
}

fn write_in_place_with_drop<T>(
    src_end: *const T,
) -> impl FnMut(InPlaceDrop<T>, T) -> Result<InPlaceDrop<T>, !> {
    move |mut sink, item| {
        // the InPlaceIterable contract cannot be verified precisely here since
        // try_fold has an exclusive reference to the source pointer
        // all we can do is check if it's still in range
        debug_assert!(sink.dst as *const _ <= src_end, "InPlaceIterable contract violation");
        // ignore-tidy-undocumented-unsafe
        unsafe {
            ptr::write(sink.dst, item);
            // Since this executes user code which can panic we have to bump the pointer
            // after each step.
            sink.dst = sink.dst.add(1);
        }
        Ok(sink)
    }
}

/// 用于保存就地迭代收集循环的特化实现的辅助 trait。
trait SpecInPlaceCollect<T, I>: Iterator<Item = T> {
    /// Collects an iterator (`self`) into the destination buffer (`dst`) and returns the number of items
    /// collected. `end` is the last writable element of the allocation and used for bounds checks.
    ///
    /// 此方法具有特化性，其实现之一利用了
    /// `Iterator::__iterator_get_unchecked` calls with a `TrustedRandomAccessNoCoerce` bound
    /// on `I` which means the caller of this method must take the safety conditions
    /// 的约束。
    unsafe fn collect_in_place(&mut self, dst: *mut T, end: *const T) -> usize;
}

impl<T, I> SpecInPlaceCollect<T, I> for I
where
    I: Iterator<Item = T>,
{
    #[inline]
    default unsafe fn collect_in_place(&mut self, dst_buf: *mut T, end: *const T) -> usize {
        // use try-fold since
        // - it vectorizes better for some iterator adapters
        // - unlike most internal iteration methods, it only takes a &mut self
        // - it lets us thread the write pointer through its innards and get it back in the end
        let sink = InPlaceDrop { inner: dst_buf, dst: dst_buf };
        let sink =
            self.try_fold::<_, _, Result<_, !>>(sink, write_in_place_with_drop(end)).into_ok();
        // iteration succeeded, don't drop head
        // ignore-tidy-undocumented-unsafe
        unsafe { ManuallyDrop::new(sink).dst.offset_from_unsigned(dst_buf) }
    }
}

impl<T, I> SpecInPlaceCollect<T, I> for I
where
    I: Iterator<Item = T> + TrustedRandomAccessNoCoerce,
{
    #[inline]
    unsafe fn collect_in_place(&mut self, dst_buf: *mut T, end: *const T) -> usize {
        let len = self.size();
        let mut drop_guard = InPlaceDrop { inner: dst_buf, dst: dst_buf };
        for i in 0..len {
            // SAFETY: InplaceIterable contract guarantees that for every element we read
            // one slot in the underlying storage will have been freed up and we can immediately
            // write back the result.
            unsafe {
                let dst = dst_buf.add(i);
                debug_assert!(dst as *const _ <= end, "InPlaceIterable contract violation");
                ptr::write(dst, self.__iterator_get_unchecked(i));
                // Since this executes user code which can panic we have to bump the pointer
                // after each step.
                drop_guard.dst = dst.add(1);
            }
        }
        mem::forget(drop_guard);
        len
    }
}

/// 用于就地迭代特化的内部辅助 trait。
///
/// Currently this is only implemented by [`vec::IntoIter`] - returning a reference to itself - and
/// [`binary_heap::IntoIter`] which returns a reference to its inner representation.
///
/// Since this is an internal trait it hides the implementation detail `binary_heap::IntoIter`
/// uses `vec::IntoIter` internally.
///
/// [`vec::IntoIter`]: super::IntoIter
/// [`binary_heap::IntoIter`]: crate::collections::binary_heap::IntoIter
///
/// # 安全性
///
/// In-place iteration relies on implementation details of `vec::IntoIter`, most importantly that
/// 它在迭代过程中不会创建对整个分配的引用，只使用原始指针。
#[rustc_specialization_trait]
pub(crate) unsafe trait AsVecIntoIter {
    type Item;
    fn as_into_iter(&mut self) -> &mut super::IntoIter<Self::Item>;
}
