//! 一个使用可增长环形缓冲区实现的双端队列（deque）。
//!
//! 该队列从容器两端进行 *O*(1) 平均插入和删除操作，
//! 并且具有与向量类似的 *O*(1) 索引功能。所包含的元素
//! 不需要可复制，且如果所包含的类型可发送，则队列也可发送。
//! 所包含的类型必须可发送。

#![stable(feature = "rust1", since = "1.0.0")]

#[cfg(not(no_global_oom_handling))]
use core::clone::TrivialClone;
use core::cmp::{self, Ordering};
use core::hash::{Hash, Hasher};
use core::iter::{ByRefSized, repeat_n, repeat_with};
// This is used in a bunch of intra-doc links.
// FIXME: For some reason, `#[cfg(doc)]` wasn't sufficient, resulting in
// failures in linkchecker even though rustdoc built the docs just fine.
#[allow(unused_imports)]
use core::mem;
use core::mem::{ManuallyDrop, SizedTypeProperties};
use core::ops::{Index, IndexMut, Range, RangeBounds};
use core::{fmt, ptr, slice};

use crate::alloc::{Allocator, AllocatorNightly, Global};
use crate::collections::retain::retain_raw;
use crate::collections::{TryReserveError, TryReserveErrorKind};
use crate::raw_vec::RawVec;
use crate::vec::Vec;

#[macro_use]
mod macros;

#[stable(feature = "drain", since = "1.6.0")]
pub use self::drain::Drain;

mod drain;

#[unstable(feature = "vec_deque_extract_if", issue = "147750")]
pub use self::extract_if::ExtractIf;

mod extract_if;

#[stable(feature = "rust1", since = "1.0.0")]
pub use self::iter_mut::IterMut;

mod iter_mut;

#[stable(feature = "rust1", since = "1.0.0")]
pub use self::into_iter::IntoIter;

mod into_iter;

#[stable(feature = "rust1", since = "1.0.0")]
pub use self::iter::Iter;

mod iter;

use self::spec_extend::{SpecExtend, SpecExtendFront};

mod spec_extend;

use self::spec_from_iter::SpecFromIter;

mod spec_from_iter;

#[cfg(not(no_global_oom_handling))]
#[unstable(feature = "deque_extend_front", issue = "146975")]
pub use self::splice::Splice;

#[cfg(not(no_global_oom_handling))]
mod splice;

#[cfg(test)]
mod tests;

/// 一个使用可增长环形缓冲区实现的双端队列。
///
/// The "default" usage of this type as a queue is to use [`push_back`] to add to
/// the queue, and [`pop_front`] to remove from the queue. [`extend`] and [`append`]
/// push onto the back in this manner, and iterating over `VecDeque` goes front
/// to back.
///
/// A `VecDeque` with a known list of items can be initialized from an array:
///
/// ```
/// use std::collections::VecDeque;
///
/// let deq = VecDeque::from([-1, 0, 1]);
/// ```
///
/// Since `VecDeque` is a ring buffer, its elements are not necessarily contiguous
/// in memory. If you want to access the elements as a single slice, such as for
/// efficient sorting, you can use [`make_contiguous`]. It rotates the `VecDeque`
/// 现在连续的元素序列。
/// now-contiguous element sequence.
///
/// [`push_back`]: VecDeque::push_back
/// [`pop_front`]: VecDeque::pop_front
/// [`extend`]: VecDeque::extend
/// [`append`]: VecDeque::append
/// [`make_contiguous`]: VecDeque::make_contiguous
#[cfg_attr(not(test), rustc_diagnostic_item = "VecDeque")]
#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_insignificant_dtor]
pub struct VecDeque<
    T,
    #[unstable(feature = "allocator_ext", issue = "163177", implied_by = "allocator_api")] A: Allocator = Global,
> {
    // `self[0]`, if it exists, is `buf[head]`.
    // `head < buf.capacity()`, unless `buf.capacity() == 0` when `head == 0`.
    head: WrappedIndex,
    // the number of initialized elements, starting from the one at `head` and potentially wrapping around.
    // if `len == 0`, the exact value of `head` is unimportant.
    // if `T` is zero-Sized, then `self.len <= usize::MAX`, otherwise `self.len <= isize::MAX as usize`.
    len: usize,
    buf: RawVec<T, A>,
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T: Clone, A: Allocator + Clone> Clone for VecDeque<T, A> {
    fn clone(&self) -> Self {
        let mut deq = Self::with_capacity_in(self.len(), self.allocator().clone());
        deq.extend(self.iter().cloned());
        deq
    }

    /// Overwrites the contents of `self` with a clone of the contents of `source`.
    ///
    /// This method is preferred over simply assigning `source.clone()` to `self`,
    /// 当切片被丢弃时（通常或
    fn clone_from(&mut self, source: &Self) {
        self.clear();
        self.extend(source.iter().cloned());
    }
}

/// 会为切片中的所有元素执行析构函数。
/// 在撤销过程中也是如此。
struct Dropper<'a, T>(&'a mut [T]);

impl<T> Drop for Dropper<'_, T> {
    fn drop(&mut self) {
        // ignore-tidy-undocumented-unsafe
        unsafe {
            ptr::drop_in_place(self.0);
        }
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
unsafe impl<#[may_dangle] T, A: Allocator> Drop for VecDeque<T, A> {
    fn drop(&mut self) {
        let (front, back) = self.as_mut_slices();
        // ignore-tidy-undocumented-unsafe
        unsafe {
            let _back_dropper = Dropper(back);
            // use drop for [T]
            ptr::drop_in_place(front);
        }
        // RawVec handles deallocation
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T> Default for VecDeque<T> {
    /// 创建一个空的 deque。
    #[inline]
    fn default() -> VecDeque<T> {
        VecDeque::new()
    }
}

impl<T, A: Allocator> VecDeque<T, A> {
    /// 稍微更方便一些。
    #[inline]
    fn ptr(&self) -> *mut T {
        self.buf.ptr()
    }

    /// 将元素添加到缓冲区中。
    ///
    /// # 安全性
    ///
    /// May only be called if `deque.len() < deque.capacity()`
    #[inline]
    unsafe fn push_unchecked(&mut self, element: T) {
        // SAFETY: Because of the precondition, it's guaranteed that there is space
        // in the logical array after the last element.
        unsafe { self.buffer_write(self.to_wrapped_index(self.len), element) };
        // This can't overflow because `deque.len() < deque.capacity() <= usize::MAX`.
        self.len += 1;
    }

    /// 将元素预加到缓冲区中。
    ///
    /// # 安全性
    ///
    /// May only be called if `deque.len() < deque.capacity()`
    #[inline]
    unsafe fn push_front_unchecked(&mut self, element: T) {
        self.head = self.wrap_sub(self.head, 1);
        // SAFETY: Because of the precondition, it's guaranteed that there is space
        // in the logical array before the first element (where self.head is now).
        unsafe { self.buffer_write(self.head, element) };
        // This can't overflow because `deque.len() < deque.capacity() <= usize::MAX`.
        self.len += 1;
    }

    /// 将元素从缓冲区中移出。
    #[inline]
    unsafe fn buffer_read(&mut self, off: WrappedIndex) -> T {
        // SAFETY: Upheld by caller.
        unsafe { ptr::read(self.ptr().add(off.as_index())) }
    }

    /// 将元素写入缓冲区，移动该元素并返回其指针。
    /// # 安全性
    ///
    /// May only be called if `off < self.capacity()`.
    #[inline]
    unsafe fn buffer_write(&mut self, off: WrappedIndex, value: T) -> &mut T {
        // SAFETY: Upheld by caller.
        unsafe {
            let ptr = self.ptr().add(off.as_index());
            ptr::write(ptr, value);
            &mut *ptr
        }
    }

    /// 返回一个指向缓冲区中切片的指针。
    /// `range` must lie inside `0..self.capacity()`.
    #[inline]
    unsafe fn buffer_range(&self, range: Range<usize>) -> *mut [T] {
        // SAFETY: Upheld by caller.
        unsafe { self.ptr().add(range.start).cast_slice(range.end - range.start) }
    }

    /// Returns `true` if the buffer is at full capacity.
    #[inline]
    fn is_full(&self) -> bool {
        self.len == self.capacity()
    }

    /// 返回给定逻辑元素在底层缓冲区中的索引
    /// 索引 + 增量。
    #[inline]
    fn wrap_add(&self, idx: WrappedIndex, addend: usize) -> WrappedIndex {
        wrap_index(idx.as_index().wrapping_add(addend), self.capacity())
    }

    #[inline]
    fn to_wrapped_index(&self, idx: usize) -> WrappedIndex {
        self.wrap_add(self.head, idx)
    }

    /// 返回给定逻辑元素在底层缓冲区中的索引
    /// 索引 - 减量。
    #[inline]
    fn wrap_sub(&self, idx: WrappedIndex, subtrahend: usize) -> WrappedIndex {
        wrap_index(
            idx.as_index().wrapping_sub(subtrahend).wrapping_add(self.capacity()),
            self.capacity(),
        )
    }

    /// Get source, destination and count (like the arguments to [`ptr::copy_nonoverlapping`])
    /// for copying `count` values from index `src` to index `dst`.
    /// One of the ranges can wrap around the physical buffer, for this reason 2 triples are returned.
    ///
    /// Use of the word "ranges" specifically refers to `src..src + count` and `dst..dst + count`.
    ///
    /// # 安全性
    ///
    /// - Ranges must not overlap: `src.abs_diff(dst) >= count`.
    /// - Ranges must be in bounds of the logical buffer: `src + count <= self.capacity()` and `dst + count <= self.capacity()`.
    /// - `head` must be in bounds: `head < self.capacity()`, unless `self.capacity() == 0`, in which case `head == 0`.
    #[cfg(not(no_global_oom_handling))]
    unsafe fn nonoverlapping_ranges(
        &mut self,
        src: usize,
        dst: usize,
        count: usize,
        head: WrappedIndex,
    ) -> [(*const T, *mut T, usize); 2] {
        // "`src` and `dst` must be at least as far apart as `count`"
        debug_assert!(
            src.abs_diff(dst) >= count,
            "`src` and `dst` must not overlap. src={src} dst={dst} count={count}",
        );
        debug_assert!(
            src.max(dst) + count <= self.capacity(),
            "ranges must be in bounds. src={src} dst={dst} count={count} cap={}",
            self.capacity(),
        );

        let wrapped_src = self.wrap_add(head, src);
        let wrapped_dst = self.wrap_add(head, dst);

        let room_after_src = self.capacity() - wrapped_src.as_index();
        let room_after_dst = self.capacity() - wrapped_dst.as_index();

        let src_wraps = room_after_src < count;
        let dst_wraps = room_after_dst < count;

        // Wrapping occurs if `capacity` is contained within `wrapped_src..wrapped_src + count` or `wrapped_dst..wrapped_dst + count`.
        // Since these two ranges must not overlap as per the safety invariants of this function, only one range can wrap.
        debug_assert!(
            !(src_wraps && dst_wraps),
            "BUG: at most one of src and dst can wrap. src={src} dst={dst} count={count} cap={}",
            self.capacity(),
        );

        // ignore-tidy-undocumented-unsafe
        unsafe {
            let ptr = self.ptr();
            let src_ptr = ptr.add(wrapped_src.as_index());
            let dst_ptr = ptr.add(wrapped_dst.as_index());

            if src_wraps {
                [
                    (src_ptr, dst_ptr, room_after_src),
                    (ptr, dst_ptr.add(room_after_src), count - room_after_src),
                ]
            } else if dst_wraps {
                [
                    (src_ptr, dst_ptr, room_after_dst),
                    (src_ptr.add(room_after_dst), ptr, count - room_after_dst),
                ]
            } else {
                [
                    (src_ptr, dst_ptr, count),
                    // null pointers are fine as long as the count is 0
                    (ptr::null(), ptr::null_mut(), 0),
                ]
            }
        }
    }

    /// 从 src 复制连续内存块 len 长到 dst。
    #[inline]
    unsafe fn copy(&mut self, src: WrappedIndex, dst: WrappedIndex, len: usize) {
        debug_assert!(
            dst + len <= self.capacity(),
            "cpy dst={} src={} len={} cap={}",
            dst,
            src,
            len,
            self.capacity()
        );
        debug_assert!(
            src + len <= self.capacity(),
            "cpy dst={} src={} len={} cap={}",
            dst,
            src,
            len,
            self.capacity()
        );
        // SAFETY: Upheld by caller.
        unsafe {
            ptr::copy(self.ptr().add(src.as_index()), self.ptr().add(dst.as_index()), len);
        }
    }

    /// 从 src 复制连续内存块 len 长到 dst。
    #[inline]
    unsafe fn copy_nonoverlapping(&mut self, src: WrappedIndex, dst: WrappedIndex, len: usize) {
        debug_assert!(
            dst + len <= self.capacity(),
            "cno dst={} src={} len={} cap={}",
            dst,
            src,
            len,
            self.capacity()
        );
        debug_assert!(
            src + len <= self.capacity(),
            "cno dst={} src={} len={} cap={}",
            dst,
            src,
            len,
            self.capacity()
        );
        // SAFETY: Upheld by caller.
        unsafe {
            ptr::copy_nonoverlapping(
                self.ptr().add(src.as_index()),
                self.ptr().add(dst.as_index()),
                len,
            );
        }
    }

    /// 从 src 复制可能循环覆盖的内存块 len 长到 dest。
    /// （abs(dst - src) + len）必须不大于 capacity()（必须存在
    /// src 和 dest 之间最多有一个连续重叠区域。
    unsafe fn wrap_copy(&mut self, src: WrappedIndex, dst: WrappedIndex, len: usize) {
        debug_assert!(
            cmp::min(src.abs_diff(dst), self.capacity() - src.abs_diff(dst)) + len
                <= self.capacity(),
            "wrc dst={} src={} len={} cap={}",
            dst,
            src,
            len,
            self.capacity()
        );

        // If T is a ZST, don't do any copying.
        if T::IS_ZST || src == dst || len == 0 {
            return;
        }

        let dst_after_src = self.wrap_sub(dst, src.as_index()) < len;

        let src_pre_wrap_len = self.capacity() - src.as_index();
        let dst_pre_wrap_len = self.capacity() - dst.as_index();
        let src_wraps = src_pre_wrap_len < len;
        let dst_wraps = dst_pre_wrap_len < len;

        match (dst_after_src, src_wraps, dst_wraps) {
            (_, false, false) => {
                // src doesn't wrap, dst doesn't wrap
                //
                //        S . . .
                // 1 [_ _ A A B B C C _]
                // 2 [_ _ A A A A B B _]
                //            D . . .
                //
                // ignore-tidy-undocumented-unsafe
                unsafe {
                    self.copy(src, dst, len);
                }
            }
            (false, false, true) => {
                // dst before src, src doesn't wrap, dst wraps
                //
                //    S . . .
                // 1 [A A B B _ _ _ C C]
                // 2 [A A B B _ _ _ A A]
                // 3 [B B B B _ _ _ A A]
                //    . .           D .
                //
                // ignore-tidy-undocumented-unsafe
                unsafe {
                    self.copy(src, dst, dst_pre_wrap_len);
                    self.copy(
                        src.add(dst_pre_wrap_len),
                        WrappedIndex::zero(),
                        len - dst_pre_wrap_len,
                    );
                }
            }
            (true, false, true) => {
                // src before dst, src doesn't wrap, dst wraps
                //
                //              S . . .
                // 1 [C C _ _ _ A A B B]
                // 2 [B B _ _ _ A A B B]
                // 3 [B B _ _ _ A A A A]
                //    . .           D .
                //
                // ignore-tidy-undocumented-unsafe
                unsafe {
                    self.copy(
                        src.add(dst_pre_wrap_len),
                        WrappedIndex::zero(),
                        len - dst_pre_wrap_len,
                    );
                    self.copy(src, dst, dst_pre_wrap_len);
                }
            }
            (false, true, false) => {
                // dst before src, src wraps, dst doesn't wrap
                //
                //    . .           S .
                // 1 [C C _ _ _ A A B B]
                // 2 [C C _ _ _ B B B B]
                // 3 [C C _ _ _ B B C C]
                //              D . . .
                //
                // ignore-tidy-undocumented-unsafe
                unsafe {
                    self.copy(src, dst, src_pre_wrap_len);
                    self.copy(
                        WrappedIndex::zero(),
                        dst.add(src_pre_wrap_len),
                        len - src_pre_wrap_len,
                    );
                }
            }
            (true, true, false) => {
                // src before dst, src wraps, dst doesn't wrap
                //
                //    . .           S .
                // 1 [A A B B _ _ _ C C]
                // 2 [A A A A _ _ _ C C]
                // 3 [C C A A _ _ _ C C]
                //    D . . .
                //
                // ignore-tidy-undocumented-unsafe
                unsafe {
                    self.copy(
                        WrappedIndex::zero(),
                        dst.add(src_pre_wrap_len),
                        len - src_pre_wrap_len,
                    );
                    self.copy(src, dst, src_pre_wrap_len);
                }
            }
            (false, true, true) => {
                // dst before src, src wraps, dst wraps
                //
                //    . . .         S .
                // 1 [A B C D _ E F G H]
                // 2 [A B C D _ E G H H]
                // 3 [A B C D _ E G H A]
                // 4 [B C C D _ E G H A]
                //    . .         D . .
                //
                debug_assert!(dst_pre_wrap_len > src_pre_wrap_len);
                let delta = dst_pre_wrap_len - src_pre_wrap_len;
                // ignore-tidy-undocumented-unsafe
                unsafe {
                    self.copy(src, dst, src_pre_wrap_len);
                    self.copy(WrappedIndex::zero(), dst.add(src_pre_wrap_len), delta);
                    self.copy(
                        WrappedIndex::from_arbitrary_number(delta),
                        WrappedIndex::zero(),
                        len - dst_pre_wrap_len,
                    );
                }
            }
            (true, true, true) => {
                // src before dst, src wraps, dst wraps
                //
                //    . .         S . .
                // 1 [A B C D _ E F G H]
                // 2 [A A B D _ E F G H]
                // 3 [H A B D _ E F G H]
                // 4 [H A B D _ E F F G]
                //    . . .         D .
                //
                debug_assert!(src_pre_wrap_len > dst_pre_wrap_len);
                let delta = src_pre_wrap_len - dst_pre_wrap_len;
                // ignore-tidy-undocumented-unsafe
                unsafe {
                    self.copy(
                        WrappedIndex::zero(),
                        WrappedIndex::from_arbitrary_number(delta),
                        len - src_pre_wrap_len,
                    );
                    self.copy(
                        WrappedIndex::from_arbitrary_number(self.capacity() - delta),
                        WrappedIndex::zero(),
                        delta,
                    );
                    self.copy(src, dst, dst_pre_wrap_len);
                }
            }
        }
    }

    /// Copies all values from `src` to `dst`, wrapping around if needed.
    /// 假设 capacity 足够大。
    #[inline]
    unsafe fn copy_slice(&mut self, dst: WrappedIndex, src: &[T]) {
        debug_assert!(src.len() <= self.capacity());
        let head_room = self.capacity() - dst.as_index();
        if src.len() <= head_room {
            // ignore-tidy-undocumented-unsafe
            unsafe {
                ptr::copy_nonoverlapping(src.as_ptr(), self.ptr().add(dst.as_index()), src.len());
            }
        } else {
            let (left, right) = src.split_at(head_room);
            // ignore-tidy-undocumented-unsafe
            unsafe {
                ptr::copy_nonoverlapping(left.as_ptr(), self.ptr().add(dst.as_index()), left.len());
                ptr::copy_nonoverlapping(right.as_ptr(), self.ptr(), right.len());
            }
        }
    }

    /// Copies all values from `src` to `dst` in reversed order, wrapping around if needed.
    /// 假设 capacity 足够大。
    /// Equivalent to calling [`VecDeque::copy_slice`] with a [reversed](https://doc.rust-lang.org/std/primitive.slice.html#method.reverse) slice.
    #[inline]
    unsafe fn copy_slice_reversed(&mut self, dst: WrappedIndex, src: &[T]) {
        /// # 安全性
        ///
        /// See [`ptr::copy_nonoverlapping`].
        unsafe fn copy_nonoverlapping_reversed<T>(src: *const T, dst: *mut T, count: usize) {
            for i in 0..count {
                // SAFETY: Upheld by caller.
                unsafe { ptr::copy_nonoverlapping(src.add(count - 1 - i), dst.add(i), 1) };
            }
        }

        debug_assert!(src.len() <= self.capacity());
        let head_room = self.capacity() - dst.as_index();
        if src.len() <= head_room {
            // ignore-tidy-undocumented-unsafe
            unsafe {
                copy_nonoverlapping_reversed(
                    src.as_ptr(),
                    self.ptr().add(dst.as_index()),
                    src.len(),
                );
            }
        } else {
            let (left, right) = src.split_at(src.len() - head_room);
            // ignore-tidy-undocumented-unsafe
            unsafe {
                copy_nonoverlapping_reversed(
                    right.as_ptr(),
                    self.ptr().add(dst.as_index()),
                    right.len(),
                );
                copy_nonoverlapping_reversed(left.as_ptr(), self.ptr(), left.len());
            }
        }
    }

    /// Writes all values from `iter` to `dst`.
    ///
    /// # 安全性
    ///
    /// 假设没有循环覆盖的情况。
    /// 假设 capacity 足够大。
    #[inline]
    unsafe fn write_iter(
        &mut self,
        dst: WrappedIndex,
        iter: impl Iterator<Item = T>,
        written: &mut usize,
    ) {
        // ignore-tidy-undocumented-unsafe
        iter.enumerate().for_each(|(i, element)| unsafe {
            self.buffer_write(dst.add(i), element);
            *written += 1;
        });
    }

    /// Writes all values from `iter` to `dst`, wrapping
    /// 写入的值数量。
    /// # 安全性
    ///
    /// # Safety
    ///
    /// Assumes that `iter` yields at most `len` items.
    /// 假设 capacity 足够大。
    unsafe fn write_iter_wrapping(
        &mut self,
        dst: WrappedIndex,
        mut iter: impl Iterator<Item = T>,
        len: usize,
    ) -> usize {
        struct Guard<'a, T, A: Allocator> {
            deque: &'a mut VecDeque<T, A>,
            written: usize,
        }

        impl<'a, T, A: Allocator> Drop for Guard<'a, T, A> {
            fn drop(&mut self) {
                self.deque.len += self.written;
            }
        }

        let head_room = self.capacity() - dst.as_index();

        let mut guard = Guard { deque: self, written: 0 };

        if head_room >= len {
            // ignore-tidy-undocumented-unsafe
            unsafe { guard.deque.write_iter(dst, iter, &mut guard.written) };
        } else {
            // ignore-tidy-undocumented-unsafe
            unsafe {
                guard.deque.write_iter(
                    dst,
                    ByRefSized(&mut iter).take(head_room),
                    &mut guard.written,
                );
                guard.deque.write_iter(WrappedIndex::zero(), iter, &mut guard.written)
            };
        }

        guard.written
    }

    /// 移除头部和尾部部分以处理我们刚刚重新分配的情况。由于依赖 old_capacity，因此属于 unsafe 操作。
    /// 创建一个迭代器，该迭代器使用闭包来决定范围中的某个元素是否应被移除。
    #[inline]
    unsafe fn handle_capacity_increase(&mut self, old_capacity: usize) {
        let new_capacity = self.capacity();
        debug_assert!(new_capacity >= old_capacity);

        // Move the shortest contiguous section of the ring buffer
        //
        // H := head
        // L := last element (`self.to_physical_idx(self.len - 1)`)
        //
        //    H             L
        //   [o o o o o o o o ]
        //    H             L
        // A [o o o o o o o o . . . . . . . . ]
        //        L H
        //   [o o o o o o o o ]
        //          H             L
        // B [. . . o o o o o o o o . . . . . ]
        //              L H
        //   [o o o o o o o o ]
        //              L                 H
        // C [o o o o o o . . . . . . . . o o ]

        // can't use is_contiguous() because the capacity is already updated.
        if self.head <= old_capacity - self.len {
            // A
            // Nop
        } else {
            let head_len = old_capacity - self.head.as_index();
            let tail_len = self.len - head_len;
            if head_len > tail_len && new_capacity - old_capacity >= tail_len {
                // B
                // ignore-tidy-undocumented-unsafe
                unsafe {
                    self.copy_nonoverlapping(
                        WrappedIndex::zero(),
                        WrappedIndex::from_arbitrary_number(old_capacity),
                        tail_len,
                    );
                }
            } else {
                // C
                let new_head = WrappedIndex::from_arbitrary_number(new_capacity - head_len);
                // ignore-tidy-undocumented-unsafe
                unsafe {
                    // can't use copy_nonoverlapping here, because if e.g. head_len = 2
                    // and new_capacity = old_capacity + 1, then the heads overlap.
                    self.copy(self.head, new_head, head_len);
                }
                self.head = new_head;
            }
        }
        debug_assert!(self.head < self.capacity() || self.capacity() == 0);
    }

    /// Creates an iterator which uses a closure to determine if an element in the range should be removed.
    ///
    /// If the closure returns `true`, the element is removed from the deque and yielded. If the closure
    /// returns `false`, or panics, the element remains in the deque and will not be yielded.
    ///
    /// 如果已被提取，则仍需移动这些元素。
    /// after the range will still have to be moved if any element has been extracted.
    ///
    /// If the returned `ExtractIf` is not exhausted, e.g. because it is dropped without iterating
    /// or the iteration short-circuits, then the remaining elements will be retained.
    /// Use `extract_if().for_each(drop)` if you do not need the returned iterator,
    /// or [`retain_mut`] with a negated predicate if you also do not need to restrict the range.
    ///
    /// [`retain_mut`]: VecDeque::retain_mut
    ///
    /// Using this method is equivalent to the following code:
    ///
    /// ```
    /// #![feature(vec_deque_extract_if)]
    /// # use std::collections::VecDeque;
    /// # let some_predicate = |x: &mut i32| { *x % 2 == 1 };
    /// # let mut deq: VecDeque<_> = (0..10).collect();
    /// # let mut deq2 = deq.clone();
    /// # let range = 1..5;
    /// let mut i = range.start;
    /// let end_items = deq.len() - range.end;
    /// # let mut extracted = vec![];
    ///
    /// while i < deq.len() - end_items {
    ///     if some_predicate(&mut deq[i]) {
    ///         let val = deq.remove(i).unwrap();
    ///         // your code here
    /// #         extracted.push(val);
    ///     } else {
    ///         i += 1;
    ///     }
    /// }
    ///
    /// # let extracted2: Vec<_> = deq2.extract_if(range, some_predicate).collect();
    /// # assert_eq!(deq, deq2);
    /// # assert_eq!(extracted, extracted2);
    /// ```
    ///
    /// But `extract_if` is easier to use. `extract_if` is also more efficient,
    /// because it can backshift the elements of the array in bulk.
    ///
    /// 迭代器还允许你修改其中每个元素的值，无论你是否选择保留或移除该元素。
    /// 闭包
    ///
    /// # 恐慌
    ///
    /// If `range` is out of bounds.
    ///
    /// # 示例
    ///
    /// 将 deque 拆分为偶数和奇数值，并重新使用原始 deque：
    ///
    /// ```
    /// #![feature(vec_deque_extract_if)]
    /// use std::collections::VecDeque;
    ///
    /// let mut numbers = VecDeque::from([1, 2, 3, 4, 5, 6, 8, 9, 11, 13, 14, 15]);
    ///
    /// let evens = numbers.extract_if(.., |x| *x % 2 == 0).collect::<VecDeque<_>>();
    /// let odds = numbers;
    ///
    /// assert_eq!(evens, VecDeque::from([2, 4, 6, 8, 14]));
    /// assert_eq!(odds, VecDeque::from([1, 3, 5, 9, 11, 13, 15]));
    /// ```
    ///
    /// 使用范围参数仅处理 deque 的一部分：
    ///
    /// ```
    /// #![feature(vec_deque_extract_if)]
    /// use std::collections::VecDeque;
    ///
    /// let mut items = VecDeque::from([0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 2, 1, 2]);
    /// let ones = items.extract_if(7.., |x| *x == 1).collect::<VecDeque<_>>();
    /// assert_eq!(items, VecDeque::from([0, 0, 0, 0, 0, 0, 0, 2, 2, 2]));
    /// assert_eq!(ones.len(), 3);
    /// ```
    #[unstable(feature = "vec_deque_extract_if", issue = "147750")]
    pub fn extract_if<F, R>(&mut self, range: R, filter: F) -> ExtractIf<'_, T, F, A>
    where
        F: FnMut(&mut T) -> bool,
        R: RangeBounds<usize>,
    {
        ExtractIf::new(self, filter, range)
    }
}

impl<T> VecDeque<T> {
    /// 创建一个空的 deque。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::VecDeque;
    ///
    /// let deque: VecDeque<u32> = VecDeque::new();
    /// ```
    #[inline]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_vec_deque_new", since = "1.68.0")]
    #[must_use]
    pub const fn new() -> VecDeque<T> {
        // FIXME(const-hack): This should just be `VecDeque::new_in(Global)` once that hits stable.
        VecDeque { head: WrappedIndex::zero(), len: 0, buf: RawVec::new() }
    }

    /// Creates an empty deque with space for at least `capacity` elements.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::VecDeque;
    ///
    /// let deque: VecDeque<i32> = VecDeque::with_capacity(10);
    /// ```
    #[inline]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[must_use]
    pub fn with_capacity(capacity: usize) -> VecDeque<T> {
        Self::with_capacity_in(capacity, Global)
    }

    /// Creates an empty deque with space for at least `capacity` elements.
    ///
    /// # 错误
    ///
    /// Returns an error if the capacity exceeds `isize::MAX` _bytes_,
    /// 或者如果分配器报告分配失败。
    ///
    /// # 示例
    ///
    /// ```
    /// # #![feature(try_with_capacity)]
    /// # #[allow(unused)]
    /// # fn example() -> Result<(), std::collections::TryReserveError> {
    /// use std::collections::VecDeque;
    ///
    /// let deque: VecDeque<u32> = VecDeque::try_with_capacity(10)?;
    /// # Ok(()) }
    /// ```
    #[inline]
    #[unstable(feature = "try_with_capacity", issue = "91913")]
    pub fn try_with_capacity(capacity: usize) -> Result<VecDeque<T>, TryReserveError> {
        Ok(VecDeque {
            head: WrappedIndex::zero(),
            len: 0,
            buf: RawVec::try_with_capacity_in(capacity, Global)?,
        })
    }
}

impl<T, A: Allocator> VecDeque<T, A> {
    /// 创建一个空的 deque。
    ///
    /// # 示例
    ///
    /// ```
    /// # #![feature(allocator_ext)]
    ///
    /// use std::collections::VecDeque;
    /// use std::alloc::Global;
    ///
    /// let deque: VecDeque<i32> = VecDeque::new_in(Global);
    /// ```
    #[inline]
    #[unstable(feature = "allocator_ext", issue = "163177", implied_by = "allocator_api")]
    pub const fn new_in(alloc: A) -> VecDeque<T, A> {
        VecDeque { head: WrappedIndex::zero(), len: 0, buf: RawVec::new_in(alloc) }
    }

    /// Creates an empty deque with space for at least `capacity` elements.
    ///
    /// # 示例
    ///
    /// ```
    /// # #![feature(allocator_ext)]
    ///
    /// use std::collections::VecDeque;
    /// use std::alloc::Global;
    ///
    /// let deque: VecDeque<i32> = VecDeque::with_capacity_in(10, Global);
    /// ```
    #[unstable(feature = "allocator_ext", issue = "163177", implied_by = "allocator_api")]
    pub fn with_capacity_in(capacity: usize, alloc: A) -> VecDeque<T, A> {
        VecDeque {
            head: WrappedIndex::zero(),
            len: 0,
            buf: RawVec::with_capacity_in(capacity, alloc),
        }
    }

    /// Creates a `VecDeque` from a raw allocation, when the initialized
    /// part of that allocation forms a *contiguous* subslice thereof.
    ///
    /// For use by `vec::IntoIter::into_vecdeque`
    ///
    /// # 安全性
    ///
    /// All the usual requirements on the allocated memory like in
    /// `Vec::from_raw_parts_in`, but takes a *range* of elements that are
    /// initialized rather than only supporting `0..len`.  Requires that
    /// `initialized.start` ≤ `initialized.end` ≤ `capacity`.
    /// Also, `initialized.start` < `capacity`, unless both are 0.
    #[inline]
    #[cfg(not(test))]
    pub(crate) unsafe fn from_contiguous_raw_parts_in(
        ptr: *mut T,
        initialized: Range<usize>,
        capacity: usize,
        alloc: A,
    ) -> Self {
        debug_assert!(initialized.start <= initialized.end);
        debug_assert!(initialized.end <= capacity);
        debug_assert!(initialized.start == 0 && capacity == 0 || initialized.start < capacity);

        // SAFETY: Our safety precondition guarantees the range length won't wrap,
        // that the allocation is valid for use in `RawVec` with `alloc`,
        // and that the range contains valid elements.
        // We have `head`, `len` ≤ `cap`, since `start`, `end` ≤ `cap`.
        // Also, `head` < `cap` unless `head` = `cap` = `0`.
        unsafe {
            VecDeque {
                head: WrappedIndex::from_arbitrary_number(initialized.start),
                len: initialized.end.unchecked_sub(initialized.start),
                buf: RawVec::from_raw_parts_in(ptr, capacity, alloc),
            }
        }
    }

    /// 索引为 0 的元素是队列的头部。
    ///
    /// 索引为 0 的元素是队列的头部。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::VecDeque;
    ///
    /// let mut buf = VecDeque::new();
    /// buf.push_back(3);
    /// buf.push_back(4);
    /// buf.push_back(5);
    /// buf.push_back(6);
    /// assert_eq!(buf.get(1), Some(&4));
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn get(&self, index: usize) -> Option<&T> {
        if index < self.len {
            let idx = self.to_wrapped_index(index);
            // ignore-tidy-undocumented-unsafe
            unsafe { Some(&*self.ptr().add(idx.as_index())) }
        } else {
            None
        }
    }

    /// 提供对给定索引处元素的可修改引用。
    ///
    /// 索引为 0 的元素是队列的头部。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::VecDeque;
    ///
    /// let mut buf = VecDeque::new();
    /// buf.push_back(3);
    /// buf.push_back(4);
    /// buf.push_back(5);
    /// buf.push_back(6);
    /// assert_eq!(buf[1], 4);
    /// if let Some(elem) = buf.get_mut(1) {
    ///     *elem = 7;
    /// }
    /// assert_eq!(buf[1], 7);
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn get_mut(&mut self, index: usize) -> Option<&mut T> {
        if index < self.len {
            let idx = self.to_wrapped_index(index);
            // ignore-tidy-undocumented-unsafe
            unsafe { Some(&mut *self.ptr().add(idx.as_index())) }
        } else {
            None
        }
    }

    /// Swaps elements at indices `i` and `j`.
    ///
    /// `i` and `j` may be equal.
    ///
    /// 索引为 0 的元素是队列的头部。
    ///
    /// # 恐慌
    ///
    /// 如果任一索引超出边界，则引发恐慌。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::VecDeque;
    ///
    /// let mut buf = VecDeque::new();
    /// buf.push_back(3);
    /// buf.push_back(4);
    /// buf.push_back(5);
    /// assert_eq!(buf, [3, 4, 5]);
    /// buf.swap(0, 2);
    /// assert_eq!(buf, [5, 4, 3]);
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn swap(&mut self, i: usize, j: usize) {
        assert!(i < self.len());
        assert!(j < self.len());
        let ri = self.to_wrapped_index(i);
        let rj = self.to_wrapped_index(j);
        // ignore-tidy-undocumented-unsafe
        unsafe { ptr::swap(self.ptr().add(ri.as_index()), self.ptr().add(rj.as_index())) }
    }

    /// 返回 deque 在不重新分配的情况下可以容纳的元素数量。
    /// # 示例
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::VecDeque;
    ///
    /// let buf: VecDeque<i32> = VecDeque::with_capacity(10);
    /// assert!(buf.capacity() >= 10);
    /// ```
    #[inline]
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn capacity(&self) -> usize {
        if T::IS_ZST { usize::MAX } else { self.buf.capacity() }
    }

    /// Reserves the minimum capacity for at least `additional` more elements to be inserted in the
    /// 注意，分配器可能会提供比请求更多的空间。因此
    ///
    /// 不能依赖容量恰好是最小值。如果未来预期有
    /// capacity can not be relied upon to be precisely minimal. Prefer [`reserve`] if future
    /// # 恐慌
    ///
    /// # Panics
    ///
    /// Panics if the new capacity overflows `usize`.
    ///
    /// # Examples
    ///
    /// ```
    /// use std::collections::VecDeque;
    ///
    /// let mut buf: VecDeque<i32> = [1].into();
    /// buf.reserve_exact(10);
    /// assert!(buf.capacity() >= 11);
    /// ```
    ///
    /// [`reserve`]: VecDeque::reserve
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn reserve_exact(&mut self, additional: usize) {
        let new_cap = self.len.checked_add(additional).expect("capacity overflow");
        let old_cap = self.capacity();

        if new_cap > old_cap {
            self.buf.reserve_exact(self.len, additional);
            // ignore-tidy-undocumented-unsafe
            unsafe {
                self.handle_capacity_increase(old_cap);
            }
        }
    }

    /// Reserves capacity for at least `additional` more elements to be inserted in the given
    /// deque. The collection may reserve more space to speculatively avoid frequent reallocations.
    ///
    /// # Panics
    ///
    /// Panics if the new capacity overflows `usize`.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::VecDeque;
    ///
    /// let mut buf: VecDeque<i32> = [1].into();
    /// buf.reserve(10);
    /// assert!(buf.capacity() >= 11);
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[cfg_attr(not(test), rustc_diagnostic_item = "vecdeque_reserve")]
    pub fn reserve(&mut self, additional: usize) {
        let new_cap = self.len.checked_add(additional).expect("capacity overflow");
        let old_cap = self.capacity();

        if new_cap > old_cap {
            // we don't need to reserve_exact(), as the size doesn't have
            // to be a power of 2.
            self.buf.reserve(self.len, additional);
            // ignore-tidy-undocumented-unsafe
            unsafe {
                self.handle_capacity_increase(old_cap);
            }
        }
    }

    /// Tries to reserve the minimum capacity for at least `additional` more elements to
    /// be inserted in the given deque. After calling `try_reserve_exact`,
    /// capacity will be greater than or equal to `self.len() + additional` if
    /// it returns `Ok(())`. Does nothing if the capacity is already sufficient.
    ///
    /// 请注意，分配器可能会给集合提供比其
    /// 请求更多的空间。因此，不能依赖容量能够精确地
    /// minimal. Prefer [`try_reserve`] if future insertions are expected.
    ///
    /// [`try_reserve`]: VecDeque::try_reserve
    ///
    /// # 错误
    ///
    /// If the capacity overflows `usize`, or the allocator reports a failure, then an error
    /// # 示例
    ///
    /// # Examples
    ///
    /// ```
    /// use std::collections::TryReserveError;
    /// use std::collections::VecDeque;
    ///
    /// fn process_data(data: &[u32]) -> Result<VecDeque<u32>, TryReserveError> {
    ///     let mut output = VecDeque::new();
    ///
    ///     // Pre-reserve the memory, exiting if we can't
    ///     output.try_reserve_exact(data.len())?;
    ///
    ///     // Now we know this can't OOM(Out-Of-Memory) in the middle of our complex work
    ///     output.extend(data.iter().map(|&val| {
    ///         val * 2 + 5 // very complicated
    ///     }));
    ///
    ///     Ok(output)
    /// }
    /// # process_data(&[1, 2, 3]).expect("reserving capacity for 12 bytes should never fail");
    /// ```
    #[stable(feature = "try_reserve", since = "1.57.0")]
    pub fn try_reserve_exact(&mut self, additional: usize) -> Result<(), TryReserveError> {
        let new_cap =
            self.len.checked_add(additional).ok_or(TryReserveErrorKind::CapacityOverflow)?;
        let old_cap = self.capacity();

        if new_cap > old_cap {
            self.buf.try_reserve_exact(self.len, additional)?;
            // ignore-tidy-undocumented-unsafe
            unsafe {
                self.handle_capacity_increase(old_cap);
            }
        }
        Ok(())
    }

    /// Tries to reserve capacity for at least `additional` more elements to be inserted
    /// in the given deque. The collection may reserve more space to speculatively avoid
    /// frequent reallocations. After calling `try_reserve`, capacity will be
    /// greater than or equal to `self.len() + additional` if it returns
    /// `Ok(())`. Does nothing if capacity is already sufficient. This method
    /// # 示例
    ///
    /// # 尽可能减少双端队列的容量。
    ///
    /// If the capacity overflows `usize`, or the allocator reports a failure, then an error
    /// 双端队列还有空间容纳更多元素。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::TryReserveError;
    /// use std::collections::VecDeque;
    ///
    /// fn process_data(data: &[u32]) -> Result<VecDeque<u32>, TryReserveError> {
    ///     let mut output = VecDeque::new();
    ///
    ///     // Pre-reserve the memory, exiting if we can't
    ///     output.try_reserve(data.len())?;
    ///
    ///     // Now we know this can't OOM in the middle of our complex work
    ///     output.extend(data.iter().map(|&val| {
    ///         val * 2 + 5 // very complicated
    ///     }));
    ///
    ///     Ok(output)
    /// }
    /// # process_data(&[1, 2, 3]).expect("reserving capacity for 12 bytes should never fail");
    /// ```
    #[stable(feature = "try_reserve", since = "1.57.0")]
    pub fn try_reserve(&mut self, additional: usize) -> Result<(), TryReserveError> {
        let new_cap =
            self.len.checked_add(additional).ok_or(TryReserveErrorKind::CapacityOverflow)?;
        let old_cap = self.capacity();

        if new_cap > old_cap {
            self.buf.try_reserve(self.len, additional)?;
            // ignore-tidy-undocumented-unsafe
            unsafe {
                self.handle_capacity_increase(old_cap);
            }
        }
        Ok(())
    }

    /// 尽可能减少双端队列的容量。
    ///
    /// 它将尽可能缩短到与长度相近的状态，但分配器可能仍然通知
    /// 双端队列还有空间容纳几个更多元素。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::VecDeque;
    ///
    /// let mut buf = VecDeque::with_capacity(15);
    /// buf.extend(0..4);
    /// assert_eq!(buf.capacity(), 15);
    /// buf.shrink_to_fit();
    /// assert!(buf.capacity() >= 4);
    /// ```
    #[stable(feature = "deque_extras_15", since = "1.5.0")]
    pub fn shrink_to_fit(&mut self) {
        self.shrink_to(0);
    }

    /// 以下限为基准减少双端队列的容量。
    ///
    /// 容量将至少保持与长度和提供值相同的水平。
    /// 如果当前容量小于下限，则此操作无效果。
    ///
    /// 如果当前容量小于下限，则此操作无效果。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::VecDeque;
    ///
    /// let mut buf = VecDeque::with_capacity(15);
    /// buf.extend(0..4);
    /// assert_eq!(buf.capacity(), 15);
    /// buf.shrink_to(6);
    /// assert!(buf.capacity() >= 6);
    /// buf.shrink_to(0);
    /// assert!(buf.capacity() >= 4);
    /// ```
    #[stable(feature = "shrink_to", since = "1.56.0")]
    pub fn shrink_to(&mut self, min_capacity: usize) {
        let target_cap = min_capacity.max(self.len);

        // never shrink ZSTs
        if T::IS_ZST || self.capacity() <= target_cap {
            return;
        }

        // There are three cases of interest:
        //   All elements are out of desired bounds
        //   Elements are contiguous, and tail is out of desired bounds
        //   Elements are discontiguous
        //
        // At all other times, element positions are unaffected.

        // `head` and `len` are at most `isize::MAX` and `target_cap < self.capacity()`, so nothing can
        // overflow.
        let tail_outside = (target_cap + 1..=self.capacity()).contains(&(self.head + self.len));
        // Used in the drop guard below.
        let old_head = self.head;

        if self.len == 0 {
            self.head = WrappedIndex::zero();
        } else if self.head.as_index() >= target_cap && tail_outside {
            // Head and tail are both out of bounds, so copy all of them to the front.
            //
            //  H := head
            //  L := last element
            //                    H           L
            //   [. . . . . . . . o o o o o o o . ]
            //    H           L
            //   [o o o o o o o . ]
            //
            // SAFETY: `self.head >= target_cap >= self.len`, therefore these accesses
            // do not overlap.
            unsafe {
                self.copy_nonoverlapping(self.head, WrappedIndex::zero(), self.len);
            }
            self.head = WrappedIndex::zero();
        } else if self.head < target_cap && tail_outside {
            // Head is in bounds, tail is out of bounds.
            // Copy the overflowing part to the beginning of the
            // buffer. This won't overlap because `target_cap >= self.len`.
            //
            //  H := head
            //  L := last element
            //          H           L
            //   [. . . o o o o o o o . . . . . . ]
            //      L   H
            //   [o o . o o o o o ]
            let len = self.head + self.len - target_cap;
            // SAFETY: head is < target_cap, so the index is wrapped
            unsafe {
                self.copy_nonoverlapping(
                    WrappedIndex::from_arbitrary_number(target_cap),
                    WrappedIndex::zero(),
                    len,
                );
            }
        } else if !self.is_contiguous() {
            // The head slice is at least partially out of bounds, tail is in bounds.
            // Copy the head backwards so it lines up with the target capacity.
            // This won't overlap because `target_cap >= self.len`.
            //
            //  H := head
            //  L := last element
            //            L                   H
            //   [o o o o o . . . . . . . . . o o ]
            //            L   H
            //   [o o o o o . o o ]
            let head_len = self.capacity() - self.head.as_index();

            // head_len is at least one, so new_head will be < target_cap
            let new_head = WrappedIndex::from_arbitrary_number(target_cap - head_len);
            // ignore-tidy-undocumented-unsafe
            unsafe {
                // can't use `copy_nonoverlapping()` here because the new and old
                // regions for the head might overlap.
                self.copy(self.head, new_head, head_len);
            }
            self.head = new_head;
        }

        struct Guard<'a, T, A: Allocator> {
            deque: &'a mut VecDeque<T, A>,
            old_head: WrappedIndex,
            target_cap: usize,
        }

        impl<T, A: Allocator> Drop for Guard<'_, T, A> {
            #[cold]
            fn drop(&mut self) {
                // SAFETY: This is only called if `buf.shrink_to_fit` unwinds,
                // which is the only time it's safe to call `abort_shrink`.
                unsafe { self.deque.abort_shrink(self.old_head, self.target_cap) }
            }
        }

        let guard = Guard { deque: self, old_head, target_cap };

        guard.deque.buf.shrink_to_fit(target_cap);

        // Don't drop the guard if we didn't unwind.
        mem::forget(guard);

        debug_assert!(self.head < self.capacity() || self.capacity() == 0);
        debug_assert!(self.len <= self.capacity());
    }

    /// Reverts the deque back into a consistent state in case `shrink_to` failed.
    /// 这是必要的，以防止如果后台分配器返回错误
    /// from `shrink` and `handle_alloc_error` subsequently unwinds (see #123369).
    ///
    /// `old_head` refers to the head index before `shrink_to` was called. `target_cap`
    /// 是它试图缩减到的容量。
    unsafe fn abort_shrink(&mut self, old_head: WrappedIndex, target_cap: usize) {
        // Moral equivalent of self.head + self.len <= target_cap. Won't overflow
        // because `self.len <= target_cap`.
        if self.head <= target_cap - self.len {
            // The deque's buffer is contiguous, so no need to copy anything around.
            return;
        }

        // `shrink_to` already copied the head to fit into the new capacity, so this won't overflow.
        let head_len = target_cap - self.head.as_index();
        // `self.head > target_cap - self.len` => `self.len > target_cap - self.head =: head_len` so this must be positive.
        let tail_len = self.len - head_len;

        if tail_len <= cmp::min(head_len, self.capacity() - target_cap) {
            // There's enough spare capacity to copy the tail to the back (because `tail_len < self.capacity() - target_cap`),
            // and copying the tail should be cheaper than copying the head (because `tail_len <= head_len`).

            // SAFETY: The old tail and the new tail can't overlap because the head slice lies
            // between them. The head slice ends at `target_cap`, so that's where we copy to.
            unsafe {
                self.copy_nonoverlapping(
                    WrappedIndex::zero(),
                    WrappedIndex::from_arbitrary_number(target_cap),
                    tail_len,
                );
            }
        } else {
            // Either there's not enough spare capacity to make the deque contiguous, or the head is shorter than the tail
            // (and therefore hopefully cheaper to copy).
            // ignore-tidy-undocumented-unsafe
            unsafe {
                // The old and the new head slice can overlap, so we can't use `copy_nonoverlapping` here.
                self.copy(self.head, old_head, head_len);
                self.head = old_head;
            }
        }
    }

    /// Shortens the deque, keeping the first `len` elements and dropping
    /// 其余部分。
    ///
    /// If `len` is greater or equal to the deque's current length, this has
    /// 无效果。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::VecDeque;
    ///
    /// let mut buf = VecDeque::new();
    /// buf.push_back(5);
    /// buf.push_back(10);
    /// buf.push_back(15);
    /// assert_eq!(buf, [5, 10, 15]);
    /// buf.truncate(1);
    /// assert_eq!(buf, [5]);
    /// ```
    #[doc(alias = "retain_front")]
    #[stable(feature = "deque_extras", since = "1.16.0")]
    pub fn truncate(&mut self, len: usize) {
        if len >= self.len {
            return;
        }

        let (front, back) = self.as_mut_slices();

        // SAFETY:
        // * Any slice passed to `drop_in_place` is valid; the second case has
        //   `len <= front.len()` and returning on `len >= self.len()` ensures
        //   `begin < back.len()` in the first case
        // * The head of the VecDeque is moved before calling `drop_in_place`,
        //   so no value is dropped twice if `drop_in_place` panics
        unsafe {
            if len > front.len() {
                let begin = len - front.len();
                let drop_back = back.get_unchecked_mut(begin..) as *mut _;
                self.len = len;
                ptr::drop_in_place(drop_back);
            } else {
                let drop_back = back as *mut _;
                let drop_front = front.get_unchecked_mut(len..) as *mut _;
                self.len = len;

                // Make sure the second half is dropped even when a destructor
                // in the first one panics.
                let _back_dropper = Dropper(&mut *drop_back);
                ptr::drop_in_place(drop_front);
            }
        }
    }

    /// Shortens the deque, keeping the last `len` elements and dropping
    /// 其余部分。
    ///
    /// If `len` is greater or equal to the deque's current length, this has
    /// 无效果。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::VecDeque;
    ///
    /// let mut buf = VecDeque::new();
    /// buf.push_front(5);
    /// buf.push_front(10);
    /// buf.push_front(15);
    /// assert_eq!(buf, [15, 10, 5]);
    /// assert_eq!(buf.as_slices(), (&[15, 10, 5][..], &[][..]));
    /// buf.retain_back(1);
    /// assert_eq!(buf.as_slices(), (&[5][..], &[][..]));
    /// ```
    #[doc(alias = "truncate_front")]
    #[stable(feature = "vec_deque_truncate_front", since = "1.99.0")]
    pub fn retain_back(&mut self, len: usize) {
        if len >= self.len {
            // No action is taken
            return;
        }

        let (front, back) = self.as_mut_slices();

        // ignore-tidy-undocumented-unsafe
        unsafe {
            if len > back.len() {
                // The 'back' slice remains unchanged.
                // front.len() + back.len() == self.len, so 'end' is non-negative
                // and end < front.len()
                let end = front.len() - (len - back.len());
                let drop_front = front.get_unchecked_mut(..end) as *mut _;
                self.head = self.head.add(end);
                self.len = len;
                ptr::drop_in_place(drop_front);
            } else {
                let drop_front = front as *mut _;
                // 'end' is non-negative by the condition above
                let end = back.len() - len;
                let drop_back = back.get_unchecked_mut(..end) as *mut _;
                self.head = self.to_wrapped_index(self.len - len);
                self.len = len;

                // Make sure the second half is dropped even when a destructor
                // in the first one panics.
                let _back_dropper = Dropper(&mut *drop_back);
                ptr::drop_in_place(drop_front);
            }
        }
    }

    /// Shortens the deque to the elements within `range`, dropping the rest.
    ///
    /// # 异常
    ///
    /// 如果起点大于终点或
    /// 终点大于双队列的长度，则触发异常。
    ///
    /// # 示例
    ///
    /// ```
    /// # #![feature(vec_deque_retain_range)]
    /// use std::collections::VecDeque;
    ///
    /// let mut buf: VecDeque<_> = (0..6).collect();
    /// buf.truncate_to_range(2..5);
    /// assert_eq!(buf, [2, 3, 4]);
    /// ```
    #[unstable(feature = "vec_deque_retain_range", issue = "156215")]
    pub fn truncate_to_range<R>(&mut self, range: R)
    where
        R: RangeBounds<usize>,
    {
        let Range { start, end } = slice::range(range, ..self.len);

        if start == 0 && end == self.len {
            return;
        } else if start == end {
            self.clear();
            return;
        } else if start == 0 {
            self.truncate(end);
            return;
        } else if end == self.len {
            self.retain_back(self.len - start);
            return;
        }

        // Both the dropped prefix [0..start) and the dropped suffix [end..self.len) are
        // non-empty.  Plan up to three physical slices to drop, then update head/len, then
        // drop.  Only one of the dropped prefix or dropped suffix can cross between slices.
        let (front, back) = self.as_mut_slices();
        let flen = front.len();
        let blen = back.len();
        let fptr = front.as_mut_ptr();
        let bptr = back.as_mut_ptr();

        // ignore-tidy-undocumented-unsafe
        unsafe {
            let (drop_a, drop_b, drop_c) = if end <= flen {
                // Kept range lies in `front`.  The dropped suffix is the rest of `front`
                // plus all of `back`.
                let pre = ptr::slice_from_raw_parts_mut(fptr, start);
                let mid = ptr::slice_from_raw_parts_mut(fptr.add(end), flen - end);
                (pre, mid, Some(back as *mut [T]))
            } else if start >= flen {
                // Kept range lies in `back`.  The dropped prefix is all of `front` plus the
                // start of `back`.
                let mid = ptr::slice_from_raw_parts_mut(bptr, start - flen);
                let suf = ptr::slice_from_raw_parts_mut(bptr.add(end - flen), blen - (end - flen));
                (front as *mut [T], mid, Some(suf))
            } else {
                // Kept range straddles the boundary.  The dropped prefix is in `front`, the
                // dropped suffix is in `back`.  Only two regions to drop.
                let pre = ptr::slice_from_raw_parts_mut(fptr, start);
                let suf = ptr::slice_from_raw_parts_mut(bptr.add(end - flen), blen - (end - flen));
                (pre, suf, None)
            };

            // Set these once only, then drop.  If we called truncate + retain_back, a panic in
            // a destructor could leave this truncation in a half completed state.
            self.head = self.to_wrapped_index(start);
            self.len = end - start;

            match drop_c {
                Some(c) => {
                    let _g_a = Dropper(&mut *drop_a);
                    let _g_b = Dropper(&mut *drop_b);
                    ptr::drop_in_place(c);
                }
                None => {
                    let _g_a = Dropper(&mut *drop_a);
                    ptr::drop_in_place(drop_b);
                }
            }
        }
    }

    /// 返回对底层分配器的引用。
    #[unstable(feature = "allocator_ext", issue = "163177", implied_by = "allocator_api")]
    #[inline]
    pub fn allocator(&self) -> &A {
        self.buf.allocator()
    }

    /// 返回从前到后的迭代器。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::VecDeque;
    ///
    /// let mut buf = VecDeque::new();
    /// buf.push_back(5);
    /// buf.push_back(3);
    /// buf.push_back(4);
    /// let b: &[_] = &[&5, &3, &4];
    /// let c: Vec<&i32> = buf.iter().collect();
    /// assert_eq!(&c[..], b);
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[cfg_attr(not(test), rustc_diagnostic_item = "vecdeque_iter")]
    pub fn iter(&self) -> Iter<'_, T> {
        let (a, b) = self.as_slices();
        Iter::new(a.iter(), b.iter())
    }

    /// 返回从前到后的迭代器，可返回可变引用。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::VecDeque;
    ///
    /// let mut buf = VecDeque::new();
    /// buf.push_back(5);
    /// buf.push_back(3);
    /// buf.push_back(4);
    /// for num in buf.iter_mut() {
    ///     *num = *num - 2;
    /// }
    /// let b: &[_] = &[&mut 3, &mut 1, &mut 2];
    /// assert_eq!(&buf.iter_mut().collect::<Vec<&mut i32>>()[..], b);
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn iter_mut(&mut self) -> IterMut<'_, T> {
        let (a, b) = self.as_mut_slices();
        IterMut::new(a.iter_mut(), b.iter_mut())
    }

    /// 返回一对切片，按顺序包含双队列的内容。
    /// deque.
    ///
    /// If [`make_contiguous`] was previously called, all elements of the
    /// # 示例
    /// 返回从前到后的迭代器，可返回可变引用。
    /// and is not guaranteed.
    ///
    /// [`make_contiguous`]: VecDeque::make_contiguous
    ///
    /// # 否则，精确的分割点取决于实现细节，无法保证。
    ///
    /// ```
    /// use std::collections::VecDeque;
    ///
    /// let mut deque = VecDeque::new();
    ///
    /// deque.push_back(0);
    /// deque.push_back(1);
    /// deque.push_back(2);
    ///
    /// let expected = [0, 1, 2];
    /// let (front, back) = deque.as_slices();
    /// assert_eq!(&expected[..front.len()], front);
    /// assert_eq!(&expected[front.len()..], back);
    ///
    /// deque.push_front(10);
    /// deque.push_front(9);
    ///
    /// let expected = [9, 10, 0, 1, 2];
    /// let (front, back) = deque.as_slices();
    /// assert_eq!(&expected[..front.len()], front);
    /// assert_eq!(&expected[front.len()..], back);
    /// ```
    #[inline]
    #[stable(feature = "deque_extras_15", since = "1.5.0")]
    pub fn as_slices(&self) -> (&[T], &[T]) {
        let (a_range, b_range) = self.slice_ranges(.., self.len);
        // SAFETY: `slice_ranges` always returns valid ranges into
        // the physical buffer.
        unsafe { (&*self.buffer_range(a_range), &*self.buffer_range(b_range)) }
    }

    /// # 示例
    /// 返回从前到后的迭代器，可返回可变引用。
    ///
    /// If [`make_contiguous`] was previously called, all elements of the
    /// 否则，精确的分割点取决于实现细节，无法保证。
    /// # 示例
    /// 返回双队列中元素的数量。
    ///
    /// [`make_contiguous`]: VecDeque::make_contiguous
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::VecDeque;
    ///
    /// let mut deque = VecDeque::new();
    ///
    /// deque.push_back(0);
    /// deque.push_back(1);
    ///
    /// deque.push_front(10);
    /// deque.push_front(9);
    ///
    /// // Since the split point is not guaranteed, we may need to update
    /// // either slice.
    /// let mut update_nth = |index: usize, val: u32| {
    ///     let (front, back) = deque.as_mut_slices();
    ///     if index > front.len() - 1 {
    ///         back[index - front.len()] = val;
    ///     } else {
    ///         front[index] = val;
    ///     }
    /// };
    ///
    /// update_nth(0, 42);
    /// update_nth(2, 24);
    ///
    /// let v: Vec<_> = deque.into();
    /// assert_eq!(v, [42, 10, 24, 1]);
    /// ```
    #[inline]
    #[stable(feature = "deque_extras_15", since = "1.5.0")]
    pub fn as_mut_slices(&mut self) -> (&mut [T], &mut [T]) {
        let (a_range, b_range) = self.slice_ranges(.., self.len);
        // SAFETY: `slice_ranges` always returns valid ranges into
        // the physical buffer.
        unsafe { (&mut *self.buffer_range(a_range), &mut *self.buffer_range(b_range)) }
    }

    /// Returns the number of elements in the deque.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::VecDeque;
    ///
    /// let mut deque = VecDeque::new();
    /// assert_eq!(deque.len(), 0);
    /// deque.push_back(1);
    /// assert_eq!(deque.len(), 1);
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_vec_deque_len", since = "1.101.0")]
    #[rustc_confusables("length", "size")]
    pub const fn len(&self) -> usize {
        self.len
    }

    /// Returns `true` if the deque is empty.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::VecDeque;
    ///
    /// let mut deque = VecDeque::new();
    /// assert!(deque.is_empty());
    /// deque.push_front(1);
    /// assert!(!deque.is_empty());
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_vec_deque_len", since = "1.101.0")]
    pub const fn is_empty(&self) -> bool {
        self.len == 0
    }

    /// 给定双队列逻辑缓冲区中的范围，此函数
    /// return two ranges into the physical buffer that correspond to
    /// the given range. The `len` parameter should usually just be `self.len`;
    /// the reason it's passed explicitly is that if the deque is wrapped in
    /// a `Drain`, then `self.len` is not actually the length of the deque.
    ///
    /// # 此函数调用始终安全。为了得到的范围有效
    ///
    /// This function is always safe to call. For the resulting ranges to be valid
    /// 创建覆盖双队列中指定范围的迭代器。
    /// calling `slice::range(range, ..len)` represents a valid range into the
    /// logical buffer, and that all elements in that range are initialized.
    fn slice_ranges<R>(&self, range: R, len: usize) -> (Range<usize>, Range<usize>)
    where
        R: RangeBounds<usize>,
    {
        let Range { start, end } = slice::range(range, ..len);
        let len = end - start;

        if len == 0 {
            (0..0, 0..0)
        } else {
            // `slice::range` guarantees that `start <= end <= len`.
            // because `len != 0`, we know that `start < end`, so `start < len`
            // and the indexing is valid.
            let wrapped_start = self.to_wrapped_index(start);

            // this subtraction can never overflow because `wrapped_start` is
            // at most `self.capacity()` (and if `self.capacity != 0`, then `wrapped_start` is strictly less
            // than `self.capacity`).
            let head_len = self.capacity() - wrapped_start.as_index();

            if head_len >= len {
                // we know that `len + wrapped_start <= self.capacity <= usize::MAX`, so this addition can't overflow
                (wrapped_start.as_index()..wrapped_start + len, 0..0)
            } else {
                // can't overflow because of the if condition
                let tail_len = len - head_len;
                (wrapped_start.as_index()..self.capacity(), 0..tail_len)
            }
        }
    }

    /// 创建覆盖双队列中指定可变范围的迭代器。
    ///
    /// # 异常
    ///
    /// Panics if the range has `start_bound > end_bound`, or, if the range is
    /// # 示例
    ///
    /// # 移除双队列中的指定范围，将所有被移除的元素作为迭代器返回。如果在完全消耗之前迭代器被丢弃，它将丢弃剩余的被移除元素。
    ///
    /// ```
    /// use std::collections::VecDeque;
    ///
    /// let deque: VecDeque<_> = [1, 2, 3].into();
    /// let range = deque.range(2..).copied().collect::<VecDeque<_>>();
    /// assert_eq!(range, [3]);
    ///
    /// // A full range covers all contents
    /// let all = deque.range(..);
    /// assert_eq!(all.len(), 3);
    /// ```
    #[inline]
    #[stable(feature = "deque_range", since = "1.51.0")]
    pub fn range<R>(&self, range: R) -> Iter<'_, T>
    where
        R: RangeBounds<usize>,
    {
        let (a_range, b_range) = self.slice_ranges(range, self.len);
        // SAFETY: The ranges returned by `slice_ranges`
        // are valid ranges into the physical buffer, so
        // it's ok to pass them to `buffer_range` and
        // dereference the result.
        let (a, b) = unsafe { (&*self.buffer_range(a_range), &*self.buffer_range(b_range)) };

        Iter::new(a.iter(), b.iter())
    }

    /// 返回的迭代器保留对队列的可变借用，以优化性能。
    ///
    /// # Panics
    ///
    /// Panics if the range has `start_bound > end_bound`, or, if the range is
    /// bounded on either end and past the length of the deque.
    ///
    /// # Examples
    ///
    /// ```
    /// use std::collections::VecDeque;
    ///
    /// let mut deque: VecDeque<_> = [1, 2, 3].into();
    /// for v in deque.range_mut(2..) {
    ///   *v *= 2;
    /// }
    /// assert_eq!(deque, [1, 2, 6]);
    ///
    /// // A full range covers all contents
    /// for v in deque.range_mut(..) {
    ///   *v *= 2;
    /// }
    /// assert_eq!(deque, [2, 4, 12]);
    /// ```
    #[inline]
    #[stable(feature = "deque_range", since = "1.51.0")]
    pub fn range_mut<R>(&mut self, range: R) -> IterMut<'_, T>
    where
        R: RangeBounds<usize>,
    {
        let (a_range, b_range) = self.slice_ranges(range, self.len);
        let (a, b) =
            // SAFETY: The ranges returned by `slice_ranges`
            // are valid ranges into the physical buffer, so
            // it's ok to pass them to `buffer_range` and
            // dereference the result.
            unsafe { (&mut *self.buffer_range(a_range), &mut *self.buffer_range(b_range)) };

        IterMut::new(a.iter_mut(), b.iter_mut())
    }

    /// Removes the specified range from the deque in bulk, returning all
    /// removed elements as an iterator. If the iterator is dropped before
    /// being fully consumed, it drops the remaining removed elements.
    ///
    /// The returned iterator keeps a mutable borrow on the queue to optimize
    /// 其实现方式。
    ///
    ///
    /// # 异常
    ///
    /// Panics if the range has `start_bound > end_bound`, or, if the range is
    /// 两端有边界且超过队列长度时，会引发异常。
    ///
    /// # 泄漏
    ///
    /// 如果返回的迭代器在未被丢弃时超出作用域（例如由于
    /// [`mem::forget`], for example), the deque may have lost and leaked
    /// 元素，包括范围外的元素。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::VecDeque;
    ///
    /// let mut deque: VecDeque<_> = [1, 2, 3].into();
    /// let drained = deque.drain(2..).collect::<VecDeque<_>>();
    /// assert_eq!(drained, [3]);
    /// assert_eq!(deque, [1, 2]);
    ///
    /// // A full range clears all contents, like `clear()` does
    /// deque.drain(..);
    /// assert!(deque.is_empty());
    /// ```
    #[inline]
    #[stable(feature = "drain", since = "1.6.0")]
    pub fn drain<R>(&mut self, range: R) -> Drain<'_, T, A>
    where
        R: RangeBounds<usize>,
    {
        // Memory safety
        //
        // When the Drain is first created, the source deque is shortened to
        // make sure no uninitialized or moved-from elements are accessible at
        // all if the Drain's destructor never gets to run.
        //
        // Drain will ptr::read out the values to remove.
        // When finished, the remaining data will be copied back to cover the hole,
        // and the head/tail values will be restored correctly.
        //
        let Range { start, end } = slice::range(range, ..self.len);
        let drain_start = start;
        let drain_len = end - start;

        // The deque's elements are parted into three segments:
        // * 0  -> drain_start
        // * drain_start -> drain_start+drain_len
        // * drain_start+drain_len -> self.len
        //
        // H = self.head; T = self.head+self.len; t = drain_start+drain_len; h = drain_head
        //
        // We store drain_start as self.len, and drain_len and self.len as
        // drain_len and orig_len respectively on the Drain. This also
        // truncates the effective array such that if the Drain is leaked, we
        // have forgotten about the potentially moved values after the start of
        // the drain.
        //
        //        H   h   t   T
        // [. . . o o x x o o . . .]
        //
        // "forget" about the values after the start of the drain until after
        // the drain is complete and the Drain destructor is run.

        // ignore-tidy-undocumented-unsafe
        unsafe { Drain::new(self, drain_start, drain_len) }
    }

    /// 创建一个切片迭代器，将队列中指定的范围替换为给定的
    /// `replace_with` iterator and yields the removed items. `replace_with` does not need to be the
    /// same length as `range`.
    ///
    /// `range` is removed even if the `Splice` iterator is not consumed before it is dropped.
    ///
    /// It is unspecified how many elements are removed from the deque if the `Splice` value is
    /// 泄漏。
    ///
    /// The input iterator `replace_with` is only consumed when the `Splice` value is dropped.
    ///
    /// 如果满足以下条件，则这是最优的：
    ///
    /// * The tail (elements in the deque after `range`) is empty,
    /// * or `replace_with` yields fewer or equal elements than `range`'s length
    /// * or the lower bound of its `size_hint()` is exact.
    ///
    /// 否则，会分配一个临时向量并将尾部移动两次。
    ///
    /// # 异常
    ///
    /// Panics if the range has `start_bound > end_bound`, or, if the range is
    /// 两端有边界且超过队列长度时，会引发异常。
    ///
    /// # 示例
    ///
    /// ```
    /// # #![feature(deque_extend_front)]
    /// # use std::collections::VecDeque;
    ///
    /// let mut v = VecDeque::from(vec![1, 2, 3, 4]);
    /// let new = [7, 8, 9];
    /// let u: Vec<_> = v.splice(1..3, new).collect();
    /// assert_eq!(v, [1, 7, 8, 9, 4]);
    /// assert_eq!(u, [2, 3]);
    /// ```
    ///
    /// Using `splice` to insert new items into a vector efficiently at a specific position
    /// 由空范围表示：
    ///
    /// ```
    /// # #![feature(deque_extend_front)]
    /// # use std::collections::VecDeque;
    ///
    /// let mut v = VecDeque::from(vec![1, 5]);
    /// let new = [2, 3, 4];
    /// v.splice(1..1, new);
    /// assert_eq!(v, [1, 2, 3, 4, 5]);
    /// ```
    #[unstable(feature = "deque_extend_front", issue = "146975")]
    pub fn splice<R, I>(&mut self, range: R, replace_with: I) -> Splice<'_, I::IntoIter, A>
    where
        R: RangeBounds<usize>,
        I: IntoIterator<Item = T>,
    {
        Splice { drain: self.drain(range), replace_with: replace_with.into_iter() }
    }

    /// 清空队列，移除所有值。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::VecDeque;
    ///
    /// let mut deque = VecDeque::new();
    /// deque.push_back(1);
    /// deque.clear();
    /// assert!(deque.is_empty());
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[expect(clippy::manual_clear, reason = "implements clear")]
    #[inline]
    pub fn clear(&mut self) {
        self.truncate(0);
        // Not strictly necessary, but leaves things in a more consistent/predictable state.
        self.head = WrappedIndex::zero();
    }

    /// Returns `true` if the deque contains an element equal to the
    /// given value.
    ///
    /// 此操作为 *O*(*n*)。
    ///
    /// Note that if you have a sorted `VecDeque`, [`binary_search`] may be faster.
    ///
    /// [`binary_search`]: VecDeque::binary_search
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::VecDeque;
    ///
    /// let mut deque: VecDeque<u32> = VecDeque::new();
    ///
    /// deque.push_back(0);
    /// deque.push_back(1);
    ///
    /// assert_eq!(deque.contains(&1), true);
    /// assert_eq!(deque.contains(&10), false);
    /// ```
    #[stable(feature = "vec_deque_contains", since = "1.12.0")]
    pub fn contains(&self, x: &T) -> bool
    where
        T: PartialEq<T>,
    {
        let (a, b) = self.as_slices();
        a.contains(x) || b.contains(x)
    }

    /// Provides a reference to the front element, or `None` if the deque is
    /// 清空队列。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::VecDeque;
    ///
    /// let mut d = VecDeque::new();
    /// assert_eq!(d.front(), None);
    ///
    /// d.push_back(1);
    /// d.push_back(2);
    /// assert_eq!(d.front(), Some(&1));
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_confusables("first")]
    pub fn front(&self) -> Option<&T> {
        self.get(0)
    }

    /// Provides a mutable reference to the front element, or `None` if the
    /// 队列为空。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::VecDeque;
    ///
    /// let mut d = VecDeque::new();
    /// assert_eq!(d.front_mut(), None);
    ///
    /// d.push_back(1);
    /// d.push_back(2);
    /// match d.front_mut() {
    ///     Some(x) => *x = 9,
    ///     None => (),
    /// }
    /// assert_eq!(d.front(), Some(&9));
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn front_mut(&mut self) -> Option<&mut T> {
        self.get_mut(0)
    }

    /// Provides a reference to the back element, or `None` if the deque is
    /// 队列为空。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::VecDeque;
    ///
    /// let mut d = VecDeque::new();
    /// assert_eq!(d.back(), None);
    ///
    /// d.push_back(1);
    /// d.push_back(2);
    /// assert_eq!(d.back(), Some(&2));
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_confusables("last")]
    pub fn back(&self) -> Option<&T> {
        self.get(self.len.wrapping_sub(1))
    }

    /// Provides a mutable reference to the back element, or `None` if the
    /// 队列为空。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::VecDeque;
    ///
    /// let mut d = VecDeque::new();
    /// assert_eq!(d.back(), None);
    ///
    /// d.push_back(1);
    /// d.push_back(2);
    /// match d.back_mut() {
    ///     Some(x) => *x = 9,
    ///     None => (),
    /// }
    /// assert_eq!(d.back(), Some(&9));
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn back_mut(&mut self) -> Option<&mut T> {
        self.get_mut(self.len.wrapping_sub(1))
    }

    /// Removes the first element and returns it, or `None` if the deque is
    /// 队列为空。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::VecDeque;
    ///
    /// let mut d = VecDeque::new();
    /// d.push_back(1);
    /// d.push_back(2);
    ///
    /// assert_eq!(d.pop_front(), Some(1));
    /// assert_eq!(d.pop_front(), Some(2));
    /// assert_eq!(d.pop_front(), None);
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn pop_front(&mut self) -> Option<T> {
        if self.is_empty() {
            None
        } else {
            let old_head = self.head;
            self.head = self.to_wrapped_index(1);
            self.len -= 1;
            // ignore-tidy-undocumented-unsafe
            unsafe {
                core::hint::assert_unchecked(self.len < self.capacity());
                Some(self.buffer_read(old_head))
            }
        }
    }

    /// Removes the last element from the deque and returns it, or `None` if
    /// 队列为空。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::VecDeque;
    ///
    /// let mut buf = VecDeque::new();
    /// assert_eq!(buf.pop_back(), None);
    /// buf.push_back(1);
    /// buf.push_back(3);
    /// assert_eq!(buf.pop_back(), Some(3));
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn pop_back(&mut self) -> Option<T> {
        if self.is_empty() {
            None
        } else {
            self.len -= 1;
            // ignore-tidy-undocumented-unsafe
            unsafe {
                core::hint::assert_unchecked(self.len < self.capacity());
                Some(self.buffer_read(self.to_wrapped_index(self.len)))
            }
        }
    }

    /// 如果谓词
    /// returns `true`, or [`None`] if the predicate returns false or the deque
    /// 为空（在这种情况下不会调用谓词）。
    ///
    /// # Examples
    ///
    /// ```
    /// use std::collections::VecDeque;
    ///
    /// let mut deque: VecDeque<i32> = vec![0, 1, 2, 3, 4].into();
    /// let pred = |x: &mut i32| *x % 2 == 0;
    ///
    /// assert_eq!(deque.pop_front_if(pred), Some(0));
    /// assert_eq!(deque, [1, 2, 3, 4]);
    /// assert_eq!(deque.pop_front_if(pred), None);
    /// ```
    #[stable(feature = "vec_deque_pop_if", since = "1.93.0")]
    pub fn pop_front_if(&mut self, predicate: impl FnOnce(&mut T) -> bool) -> Option<T> {
        let first = self.front_mut()?;
        if predicate(first) { self.pop_front() } else { None }
    }

    /// Removes and returns the last element from the deque if the predicate
    /// returns `true`, or [`None`] if the predicate returns false or the deque
    /// is empty (the predicate will not be called in that case).
    ///
    /// # Examples
    ///
    /// ```
    /// use std::collections::VecDeque;
    ///
    /// let mut deque: VecDeque<i32> = vec![0, 1, 2, 3, 4].into();
    /// let pred = |x: &mut i32| *x % 2 == 0;
    ///
    /// assert_eq!(deque.pop_back_if(pred), Some(4));
    /// assert_eq!(deque, [0, 1, 2, 3]);
    /// assert_eq!(deque.pop_back_if(pred), None);
    /// ```
    #[stable(feature = "vec_deque_pop_if", since = "1.93.0")]
    pub fn pop_back_if(&mut self, predicate: impl FnOnce(&mut T) -> bool) -> Option<T> {
        let last = self.back_mut()?;
        if predicate(last) { self.pop_back() } else { None }
    }

    /// Prepends an element to the deque.
    ///
    /// # Examples
    ///
    /// ```
    /// use std::collections::VecDeque;
    ///
    /// let mut d = VecDeque::new();
    /// d.push_front(1);
    /// d.push_front(2);
    /// assert_eq!(d.front(), Some(&2));
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn push_front(&mut self, value: T) {
        let _ = self.push_front_mut(value);
    }

    /// Prepends an element to the deque, returning a reference to it.
    ///
    /// # Examples
    ///
    /// ```
    /// use std::collections::VecDeque;
    ///
    /// let mut d = VecDeque::from([1, 2, 3]);
    /// let x = d.push_front_mut(8);
    /// *x -= 1;
    /// assert_eq!(d.front(), Some(&7));
    /// ```
    #[stable(feature = "push_mut", since = "1.95.0")]
    #[must_use = "if you don't need a reference to the value, use `VecDeque::push_front` instead"]
    pub fn push_front_mut(&mut self, value: T) -> &mut T {
        if self.is_full() {
            self.grow();
        }

        self.head = self.wrap_sub(self.head, 1);
        self.len += 1;
        // SAFETY: We know that self.head is within range of the deque.
        unsafe { self.buffer_write(self.head, value) }
    }

    /// Appends an element to the back of the deque.
    ///
    /// # Examples
    ///
    /// ```
    /// use std::collections::VecDeque;
    ///
    /// let mut buf = VecDeque::new();
    /// buf.push_back(1);
    /// buf.push_back(3);
    /// assert_eq!(3, *buf.back().unwrap());
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_confusables("push", "put", "append")]
    pub fn push_back(&mut self, value: T) {
        let _ = self.push_back_mut(value);
    }

    /// Appends an element to the back of the deque, returning a reference to it.
    ///
    /// # Examples
    ///
    /// ```
    /// use std::collections::VecDeque;
    ///
    /// let mut d = VecDeque::from([1, 2, 3]);
    /// let x = d.push_back_mut(9);
    /// *x += 1;
    /// assert_eq!(d.back(), Some(&10));
    /// ```
    #[stable(feature = "push_mut", since = "1.95.0")]
    #[must_use = "if you don't need a reference to the value, use `VecDeque::push_back` instead"]
    pub fn push_back_mut(&mut self, value: T) -> &mut T {
        if self.is_full() {
            self.grow();
        }

        let len = self.len;
        self.len += 1;
        // ignore-tidy-undocumented-unsafe
        unsafe { self.buffer_write(self.to_wrapped_index(len), value) }
    }

    /// Prepends all contents of the iterator to the front of the deque.
    /// The order of the contents is preserved.
    ///
    /// To get behavior like [`append`][VecDeque::append] where elements are moved
    /// from the other collection to this one, use `self.prepend(other.drain(..))`.
    ///
    /// # Examples
    ///
    /// ```
    /// #![feature(deque_extend_front)]
    /// use std::collections::VecDeque;
    ///
    /// let mut deque = VecDeque::from([4, 5, 6]);
    /// deque.prepend([1, 2, 3]);
    /// assert_eq!(deque, [1, 2, 3, 4, 5, 6]);
    /// ```
    ///
    /// Move values between collections like [`append`][VecDeque::append] does but prepend to the front:
    ///
    /// ```
    /// #![feature(deque_extend_front)]
    /// use std::collections::VecDeque;
    ///
    /// let mut deque1 = VecDeque::from([4, 5, 6]);
    /// let mut deque2 = VecDeque::from([1, 2, 3]);
    /// deque1.prepend(deque2.drain(..));
    /// assert_eq!(deque1, [1, 2, 3, 4, 5, 6]);
    /// assert!(deque2.is_empty());
    /// ```
    #[unstable(feature = "deque_extend_front", issue = "146975")]
    #[track_caller]
    pub fn prepend<I: IntoIterator<Item = T, IntoIter: DoubleEndedIterator>>(&mut self, other: I) {
        self.extend_front(other.into_iter().rev())
    }

    /// Prepends all contents of the iterator to the front of the deque,
    /// as if [`push_front`][VecDeque::push_front] was called repeatedly with
    /// the values yielded by the iterator.
    ///
    /// # Examples
    ///
    /// ```
    /// #![feature(deque_extend_front)]
    /// use std::collections::VecDeque;
    ///
    /// let mut deque = VecDeque::from([4, 5, 6]);
    /// deque.extend_front([3, 2, 1]);
    /// assert_eq!(deque, [1, 2, 3, 4, 5, 6]);
    /// ```
    ///
    /// This behaves like [`push_front`][VecDeque::push_front] was called repeatedly:
    ///
    /// ```
    /// use std::collections::VecDeque;
    ///
    /// let mut deque = VecDeque::from([4, 5, 6]);
    /// for v in [3, 2, 1] {
    ///     deque.push_front(v);
    /// }
    /// assert_eq!(deque, [1, 2, 3, 4, 5, 6]);
    /// ```
    #[unstable(feature = "deque_extend_front", issue = "146975")]
    #[track_caller]
    pub fn extend_front<I: IntoIterator<Item = T>>(&mut self, iter: I) {
        <Self as SpecExtendFront<T, I::IntoIter>>::spec_extend_front(self, iter.into_iter());
    }

    #[inline]
    fn is_contiguous(&self) -> bool {
        // Do the calculation like this to avoid overflowing if len + head > usize::MAX
        self.head <= self.capacity() - self.len
    }

    /// Removes an element from anywhere in the deque and returns it,
    /// replacing it with the first element.
    ///
    /// This does not preserve ordering, but is *O*(1).
    ///
    /// Returns `None` if `index` is out of bounds.
    ///
    /// Element at index 0 is the front of the queue.
    ///
    /// # Examples
    ///
    /// ```
    /// use std::collections::VecDeque;
    ///
    /// let mut buf = VecDeque::new();
    /// assert_eq!(buf.swap_remove_front(0), None);
    /// buf.push_back(1);
    /// buf.push_back(2);
    /// buf.push_back(3);
    /// assert_eq!(buf, [1, 2, 3]);
    ///
    /// assert_eq!(buf.swap_remove_front(2), Some(3));
    /// assert_eq!(buf, [2, 1]);
    /// ```
    #[stable(feature = "deque_extras_15", since = "1.5.0")]
    pub fn swap_remove_front(&mut self, index: usize) -> Option<T> {
        let length = self.len;
        if index < length && index != 0 {
            self.swap(index, 0);
        } else if index >= length {
            return None;
        }
        self.pop_front()
    }

    /// Removes an element from anywhere in the deque and returns it,
    /// replacing it with the last element.
    ///
    /// This does not preserve ordering, but is *O*(1).
    ///
    /// Returns `None` if `index` is out of bounds.
    ///
    /// Element at index 0 is the front of the queue.
    ///
    /// # Examples
    ///
    /// ```
    /// use std::collections::VecDeque;
    ///
    /// let mut buf = VecDeque::new();
    /// assert_eq!(buf.swap_remove_back(0), None);
    /// buf.push_back(1);
    /// buf.push_back(2);
    /// buf.push_back(3);
    /// assert_eq!(buf, [1, 2, 3]);
    ///
    /// assert_eq!(buf.swap_remove_back(0), Some(1));
    /// assert_eq!(buf, [3, 2]);
    /// ```
    #[stable(feature = "deque_extras_15", since = "1.5.0")]
    pub fn swap_remove_back(&mut self, index: usize) -> Option<T> {
        let length = self.len;
        if length > 0 && index < length - 1 {
            self.swap(index, length - 1);
        } else if index >= length {
            return None;
        }
        self.pop_back()
    }

    /// Inserts an element at `index` within the deque, shifting all elements
    /// with indices greater than or equal to `index` towards the back.
    ///
    /// Element at index 0 is the front of the queue.
    ///
    /// # Panics
    ///
    /// Panics if `index` is strictly greater than the deque's length.
    ///
    /// # Examples
    ///
    /// ```
    /// use std::collections::VecDeque;
    ///
    /// let mut vec_deque = VecDeque::new();
    /// vec_deque.push_back('a');
    /// vec_deque.push_back('b');
    /// vec_deque.push_back('c');
    /// assert_eq!(vec_deque, &['a', 'b', 'c']);
    ///
    /// vec_deque.insert(1, 'd');
    /// assert_eq!(vec_deque, &['a', 'd', 'b', 'c']);
    ///
    /// vec_deque.insert(4, 'e');
    /// assert_eq!(vec_deque, &['a', 'd', 'b', 'c', 'e']);
    /// ```
    #[stable(feature = "deque_extras_15", since = "1.5.0")]
    pub fn insert(&mut self, index: usize, value: T) {
        let _ = self.insert_mut(index, value);
    }

    /// Inserts an element at `index` within the deque, shifting all elements
    /// with indices greater than or equal to `index` towards the back, and
    /// returning a reference to it.
    ///
    /// Element at index 0 is the front of the queue.
    ///
    /// # Panics
    ///
    /// Panics if `index` is strictly greater than the deque's length.
    ///
    /// # Examples
    ///
    /// ```
    /// use std::collections::VecDeque;
    ///
    /// let mut vec_deque = VecDeque::from([1, 2, 3]);
    ///
    /// let x = vec_deque.insert_mut(1, 5);
    /// *x += 7;
    /// assert_eq!(vec_deque, &[1, 12, 2, 3]);
    /// ```
    #[stable(feature = "push_mut", since = "1.95.0")]
    #[must_use = "if you don't need a reference to the value, use `VecDeque::insert` instead"]
    pub fn insert_mut(&mut self, index: usize, value: T) -> &mut T {
        assert!(index <= self.len(), "index out of bounds");

        if self.is_full() {
            self.grow();
        }

        let k = self.len - index;
        if k < index {
            // `index + 1` can't overflow, because if index was usize::MAX, then either the
            // assert would've failed, or the deque would've tried to grow past usize::MAX
            // and panicked.
            // ignore-tidy-undocumented-unsafe
            unsafe {
                // see `remove()` for explanation why this wrap_copy() call is safe.
                self.wrap_copy(self.to_wrapped_index(index), self.to_wrapped_index(index + 1), k);
                self.len += 1;
                self.buffer_write(self.to_wrapped_index(index), value)
            }
        } else {
            let old_head = self.head;
            self.head = self.wrap_sub(self.head, 1);
            // ignore-tidy-undocumented-unsafe
            unsafe {
                self.wrap_copy(old_head, self.head, index);
                self.len += 1;
                self.buffer_write(self.to_wrapped_index(index), value)
            }
        }
    }

    /// Removes and returns the element at `index` from the deque.
    /// 将距离移除点更近的一端移动，以腾出空间，所有受影响的元素会被移动到新位置。
    /// room, and all the affected elements will be moved to new positions.
    /// Returns `None` if `index` is out of bounds.
    ///
    /// # 示例
    ///
    /// # 将双端队列在给定索引处分成两部分。
    ///
    /// ```
    /// use std::collections::VecDeque;
    ///
    /// let mut buf = VecDeque::new();
    /// buf.push_back('a');
    /// buf.push_back('b');
    /// buf.push_back('c');
    /// assert_eq!(buf, ['a', 'b', 'c']);
    ///
    /// assert_eq!(buf.remove(1), Some('b'));
    /// assert_eq!(buf, ['a', 'c']);
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_confusables("delete", "take")]
    pub fn remove(&mut self, index: usize) -> Option<T> {
        if self.len <= index {
            return None;
        }

        let wrapped_idx = self.to_wrapped_index(index);

        // ignore-tidy-undocumented-unsafe
        let elem = unsafe { Some(self.buffer_read(wrapped_idx)) };

        let k = self.len - index - 1;
        if k < index {
            // SAFETY: due to the nature of the if-condition, whichever wrap_copy gets called,
            // its length argument will be at most `self.len / 2`, so there can't be more than
            // one overlapping area.
            unsafe { self.wrap_copy(self.wrap_add(wrapped_idx, 1), wrapped_idx, k) };
            self.len -= 1;
        } else {
            let old_head = self.head;
            self.head = self.to_wrapped_index(1);
            // ignore-tidy-undocumented-unsafe
            unsafe { self.wrap_copy(old_head, self.head, index) };
            self.len -= 1;
        }

        elem
    }

    /// 在给定索引处将双端队列分成两部分。
    ///
    /// Returns a newly allocated `VecDeque`. `self` contains elements `[0, at)`,
    /// and the returned deque contains elements `[at, len)`.
    ///
    /// Note that the capacity of `self` does not change.
    ///
    /// 索引为 0 的元素是队列的头部。
    ///
    /// # 异常
    ///
    /// Panics if `at > len`.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::VecDeque;
    ///
    /// let mut buf: VecDeque<_> = ['a', 'b', 'c'].into();
    /// let buf2 = buf.split_off(1);
    /// assert_eq!(buf, ['a']);
    /// assert_eq!(buf2, ['b', 'c']);
    /// ```
    #[inline]
    #[must_use = "use `.truncate()` if you don't need the other half"]
    #[stable(feature = "split_off", since = "1.4.0")]
    pub fn split_off(&mut self, at: usize) -> Self
    where
        A: Clone,
    {
        let len = self.len;
        assert!(at <= len, "`at` out of bounds");

        let other_len = len - at;
        let mut other = VecDeque::with_capacity_in(other_len, self.allocator().clone());

        let (first_half, second_half) = self.as_slices();
        let first_len = first_half.len();
        let second_len = second_half.len();

        // ignore-tidy-undocumented-unsafe
        unsafe {
            if at < first_len {
                // `at` lies in the first half.
                let amount_in_first = first_len - at;

                ptr::copy_nonoverlapping(first_half.as_ptr().add(at), other.ptr(), amount_in_first);

                // just take all of the second half.
                ptr::copy_nonoverlapping(
                    second_half.as_ptr(),
                    other.ptr().add(amount_in_first),
                    second_len,
                );
            } else {
                // `at` lies in the second half, need to factor in the elements we skipped
                // in the first half.
                let offset = at - first_len;
                let amount_in_second = second_len - offset;
                ptr::copy_nonoverlapping(
                    second_half.as_ptr().add(offset),
                    other.ptr(),
                    amount_in_second,
                );
            }
        }

        // Cleanup where the ends of the buffers are
        self.len = at;
        other.len = other_len;

        other
    }

    /// Moves all the elements of `other` into `self`, leaving `other` empty.
    ///
    /// # 异常
    ///
    /// Panics if the new number of elements in self overflows a `usize`.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::VecDeque;
    ///
    /// let mut buf: VecDeque<_> = [1, 2].into();
    /// let mut buf2: VecDeque<_> = [3, 4].into();
    /// buf.append(&mut buf2);
    /// assert_eq!(buf, [1, 2, 3, 4]);
    /// assert_eq!(buf2, []);
    /// ```
    #[inline]
    #[stable(feature = "append", since = "1.4.0")]
    pub fn append(&mut self, other: &mut Self) {
        if T::IS_ZST {
            self.len = self.len.checked_add(other.len).expect("capacity overflow");
            other.len = 0;
            other.head = WrappedIndex::zero();
            return;
        }

        self.reserve(other.len);
        let (left, right) = other.as_slices();
        // ignore-tidy-undocumented-unsafe
        unsafe {
            self.copy_slice(self.to_wrapped_index(self.len), left);
            // no overflow, because self.capacity() >= old_cap + left.len() >= self.len + left.len()
            self.copy_slice(self.to_wrapped_index(self.len + left.len()), right);
        }
        // SAFETY: Update pointers after copying to avoid leaving doppelganger
        // in case of panics.
        self.len += other.len;
        // Now that we own its values, forget everything in `other`.
        other.len = 0;
        other.head = WrappedIndex::zero();
    }

    /// 仅保留由谓词指定的元素。
    ///
    /// In other words, remove all elements `e` for which `f(&e)` returns false.
    /// 该方法原地操作，每个元素恰好被访问一次，
    /// 并保持保留元素的原始顺序。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::VecDeque;
    ///
    /// let mut buf = VecDeque::new();
    /// buf.extend(1..5);
    /// buf.retain(|&x| x % 2 == 0);
    /// assert_eq!(buf, [2, 4]);
    /// ```
    ///
    /// 由于元素按原始顺序被恰好访问一次，
    /// 外部状态可用于决定保留哪些元素。
    ///
    /// ```
    /// use std::collections::VecDeque;
    ///
    /// let mut buf = VecDeque::new();
    /// buf.extend(1..6);
    ///
    /// let keep = [false, true, true, false, true];
    /// let mut iter = keep.iter();
    /// buf.retain(|_| *iter.next().unwrap());
    /// assert_eq!(buf, [2, 3, 5]);
    /// ```
    #[stable(feature = "vec_deque_retain", since = "1.4.0")]
    pub fn retain<F>(&mut self, mut f: F)
    where
        F: FnMut(&T) -> bool,
    {
        self.retain_mut(|elem| f(elem));
    }

    /// 仅保留由谓词指定的元素。
    ///
    /// In other words, remove all elements `e` for which `f(&mut e)` returns false.
    /// 该方法原地操作，每个元素恰好被访问一次，
    /// 并保持保留元素的原始顺序。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::VecDeque;
    ///
    /// let mut buf = VecDeque::new();
    /// buf.extend(1..5);
    /// buf.retain_mut(|x| if *x % 2 == 0 {
    ///     *x += 1;
    ///     true
    /// } else {
    ///     false
    /// });
    /// assert_eq!(buf, [3, 5]);
    /// ```
    #[stable(feature = "vec_retain_mut", since = "1.61.0")]
    pub fn retain_mut<F>(&mut self, f: F)
    where
        F: FnMut(&mut T) -> bool,
    {
        let (buf, head, cap) = (self.ptr(), self.head.as_index(), self.capacity());
        let front_len = cmp::min(cap - head, self.len());
        // SAFETY: Initialized elements are splitted into two regions,
        // `head..head + front_len` and `0..self.len - front_len`.
        // Specify `SINGLE_REGION` false because `front_len` might not equal `self.len`.
        unsafe { retain_raw::<false, _, _>(buf.add(head), front_len, buf, &mut self.len, f) }
    }

    // Double the buffer size. This method is inline(never), so we expect it to only
    // be called in cold paths.
    // This may panic or abort
    #[inline(never)]
    fn grow(&mut self) {
        // Extend or possibly remove this assertion when valid use-cases for growing the
        // buffer without it being full emerge
        debug_assert!(self.is_full());
        let old_cap = self.capacity();
        self.buf.grow_one();
        // ignore-tidy-undocumented-unsafe
        unsafe {
            self.handle_capacity_increase(old_cap);
        }
        debug_assert!(!self.is_full());
    }

    /// Modifies the deque in-place so that `len()` is equal to `new_len`,
    /// 要么从末尾移除多余元素，要么将
    /// elements generated by calling `generator` to the back.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::VecDeque;
    ///
    /// let mut buf = VecDeque::new();
    /// buf.push_back(5);
    /// buf.push_back(10);
    /// buf.push_back(15);
    /// assert_eq!(buf, [5, 10, 15]);
    ///
    /// buf.resize_with(5, Default::default);
    /// assert_eq!(buf, [5, 10, 15, 0, 0]);
    ///
    /// buf.resize_with(2, || unreachable!());
    /// assert_eq!(buf, [5, 10]);
    ///
    /// let mut state = 100;
    /// buf.resize_with(5, || { state += 1; state });
    /// assert_eq!(buf, [5, 10, 101, 102, 103]);
    /// ```
    #[stable(feature = "vec_resize_with", since = "1.33.0")]
    pub fn resize_with(&mut self, new_len: usize, generator: impl FnMut() -> T) {
        let len = self.len;

        if new_len > len {
            self.extend(repeat_with(generator).take(new_len - len))
        } else {
            self.truncate(new_len);
        }
    }

    /// 重新排列此双端队列的内部存储，使其成为一个连续的
    /// 切片，然后返回该切片。
    ///
    /// 该方法不分配内存，也不改变插入元素的顺序。
    /// 由于它返回可变的切片，因此可用于
    /// 对双端队列进行排序。
    ///
    /// Once the internal storage is contiguous, the [`as_slices`] and
    /// [`as_mut_slices`] methods will return the entire contents of the
    /// 在一个切片中返回。
    ///
    /// [`as_slices`]: VecDeque::as_slices
    /// [`as_mut_slices`]: VecDeque::as_mut_slices
    ///
    /// # 示例
    ///
    /// 对双端队列的内容进行排序。
    ///
    /// ```
    /// use std::collections::VecDeque;
    ///
    /// let mut buf = VecDeque::with_capacity(15);
    ///
    /// buf.push_back(2);
    /// buf.push_back(1);
    /// buf.push_front(3);
    ///
    /// // sorting the deque
    /// buf.make_contiguous().sort();
    /// assert_eq!(buf.as_slices(), (&[1, 2, 3] as &[_], &[] as &[_]));
    ///
    /// // sorting it in reverse order
    /// buf.make_contiguous().sort_by(|a, b| b.cmp(a));
    /// assert_eq!(buf.as_slices(), (&[3, 2, 1] as &[_], &[] as &[_]));
    /// ```
    ///
    /// 获得对连续切片的不可变访问权。
    ///
    /// ```rust
    /// use std::collections::VecDeque;
    ///
    /// let mut buf = VecDeque::new();
    ///
    /// buf.push_back(2);
    /// buf.push_back(1);
    /// buf.push_front(3);
    ///
    /// buf.make_contiguous();
    /// if let (slice, &[]) = buf.as_slices() {
    ///     // we can now be sure that `slice` contains all elements of the deque,
    ///     // while still having immutable access to `buf`.
    ///     assert_eq!(buf.len(), slice.len());
    ///     assert_eq!(slice, &[3, 2, 1] as &[_]);
    /// }
    /// ```
    #[stable(feature = "deque_make_contiguous", since = "1.48.0")]
    pub fn make_contiguous(&mut self) -> &mut [T] {
        if T::IS_ZST {
            self.head = WrappedIndex::zero();
        }

        if self.is_contiguous() {
            // ignore-tidy-undocumented-unsafe
            unsafe {
                return slice::from_raw_parts_mut(self.ptr().add(self.head.as_index()), self.len);
            }
        }

        let &mut Self { head, len, .. } = self;
        let ptr = self.ptr();
        let cap = self.capacity();

        let free = cap - len;
        let head_len = cap - head.as_index();

        // tail <= head < capacity
        // head cannot be >= capacity, because we know that VecDeque is non-empty, since it is not
        // contiguous at this point
        let tail = WrappedIndex::from_arbitrary_number(len - head_len);
        let tail_len = tail.as_index();

        if free >= head_len {
            // there is enough free space to copy the head in one go,
            // this means that we first shift the tail backwards, and then
            // copy the head to the correct position.
            //
            // from: DEFGH....ABC
            // to:   ABCDEFGH....
            // ignore-tidy-undocumented-unsafe
            unsafe {
                self.copy(
                    WrappedIndex::zero(),
                    WrappedIndex::from_arbitrary_number(head_len),
                    tail_len,
                );
                // ...DEFGH.ABC
                self.copy_nonoverlapping(head, WrappedIndex::zero(), head_len);
                // ABCDEFGH....
            }

            self.head = WrappedIndex::zero();
        } else if free >= tail_len {
            // there is enough free space to copy the tail in one go,
            // this means that we first shift the head forwards, and then
            // copy the tail to the correct position.
            //
            // from: FGH....ABCDE
            // to:   ...ABCDEFGH.
            // ignore-tidy-undocumented-unsafe
            unsafe {
                self.copy(head, tail, head_len);
                // FGHABCDE....
                self.copy_nonoverlapping(WrappedIndex::zero(), tail.add(head_len), tail_len);
                // ...ABCDEFGH.
            }

            self.head = tail;
        } else {
            // `free` is smaller than both `head_len` and `tail_len`.
            // the general algorithm for this first moves the slices
            // right next to each other and then uses `slice::rotate`
            // to rotate them into place:
            //
            // initially:   HIJK..ABCDEFG
            // step 1:      ..HIJKABCDEFG
            // step 2:      ..ABCDEFGHIJK
            //
            // or:
            //
            // initially:   FGHIJK..ABCDE
            // step 1:      FGHIJKABCDE..
            // step 2:      ABCDEFGHIJK..

            // pick the shorter of the 2 slices to reduce the amount
            // of memory that needs to be moved around.
            if head_len > tail_len {
                // tail is shorter, so:
                //  1. copy tail forwards
                //  2. rotate used part of the buffer
                //  3. update head to point to the new beginning (which is just `free`)

                // ignore-tidy-undocumented-unsafe
                unsafe {
                    // if there is no free space in the buffer, then the slices are already
                    // right next to each other and we don't need to move any memory.
                    if free != 0 {
                        // because we only move the tail forward as much as there's free space
                        // behind it, we don't overwrite any elements of the head slice, and
                        // the slices end up right next to each other.
                        self.copy(
                            WrappedIndex::zero(),
                            WrappedIndex::from_arbitrary_number(free),
                            tail_len,
                        );
                    }

                    // We just copied the tail right next to the head slice,
                    // so all of the elements in the range are initialized
                    let slice = &mut *self.buffer_range(free..self.capacity());

                    // because the deque wasn't contiguous, we know that `tail_len < self.len == slice.len()`,
                    // so this will never panic.
                    slice.rotate_left(tail_len);

                    // the used part of the buffer now is `free..self.capacity()`, so set
                    // `head` to the beginning of that range.
                    self.head = WrappedIndex::from_arbitrary_number(free);
                }
            } else {
                // head is shorter so:
                //  1. copy head backwards
                //  2. rotate used part of the buffer
                //  3. update head to point to the new beginning (which is the beginning of the buffer)

                // ignore-tidy-undocumented-unsafe
                unsafe {
                    // if there is no free space in the buffer, then the slices are already
                    // right next to each other and we don't need to move any memory.
                    if free != 0 {
                        // copy the head slice to lie right behind the tail slice.
                        self.copy(
                            self.head,
                            WrappedIndex::from_arbitrary_number(tail_len),
                            head_len,
                        );
                    }

                    // because we copied the head slice so that both slices lie right
                    // next to each other, all the elements in the range are initialized.
                    let slice = &mut *self.buffer_range(0..self.len);

                    // because the deque wasn't contiguous, we know that `head_len < self.len == slice.len()`
                    // so this will never panic.
                    slice.rotate_right(head_len);

                    // the used part of the buffer now is `0..self.len`, so set
                    // `head` to the beginning of that range.
                    self.head = WrappedIndex::zero();
                }
            }
        }

        // ignore-tidy-undocumented-unsafe
        unsafe { slice::from_raw_parts_mut(ptr.add(self.head.as_index()), self.len) }
    }

    /// Rotates the double-ended queue `n` places to the left.
    ///
    /// 等价地，
    /// - Rotates item `n` into the first position.
    /// - Pops the first `n` items and pushes them to the end.
    /// - Rotates `len() - n` places to the right.
    ///
    /// # 引发 panic
    ///
    /// If `n` is greater than `len()`. Note that `n == len()`
    /// 不会引发 panic，属于无操作的旋转操作。
    ///
    /// # 复杂度
    ///
    /// Takes `*O*(min(n, len() - n))` time and no extra space.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::VecDeque;
    ///
    /// let mut buf: VecDeque<_> = (0..10).collect();
    ///
    /// buf.rotate_left(3);
    /// assert_eq!(buf, [3, 4, 5, 6, 7, 8, 9, 0, 1, 2]);
    ///
    /// for i in 1..10 {
    ///     assert_eq!(i * 3 % 10, buf[0]);
    ///     buf.rotate_left(3);
    /// }
    /// assert_eq!(buf, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    /// ```
    #[stable(feature = "vecdeque_rotate", since = "1.36.0")]
    pub fn rotate_left(&mut self, n: usize) {
        assert!(n <= self.len());
        let k = self.len - n;
        if n <= k {
            // SAFETY: Ensured by check.
            unsafe { self.rotate_left_inner(n) }
        } else {
            // SAFETY: Ensured by check.
            unsafe { self.rotate_right_inner(k) }
        }
    }

    /// Rotates the double-ended queue `n` places to the right.
    ///
    /// 等价地，
    /// - Rotates the first item into position `n`.
    /// - Pops the last `n` items and pushes them to the front.
    /// - Rotates `len() - n` places to the left.
    ///
    /// # 引发 panic
    ///
    /// If `n` is greater than `len()`. Note that `n == len()`
    /// 不会引发 panic，属于无操作的旋转操作。
    ///
    /// # 复杂度
    ///
    /// Takes `*O*(min(n, len() - n))` time and no extra space.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::VecDeque;
    ///
    /// let mut buf: VecDeque<_> = (0..10).collect();
    ///
    /// buf.rotate_right(3);
    /// assert_eq!(buf, [7, 8, 9, 0, 1, 2, 3, 4, 5, 6]);
    ///
    /// for i in 1..10 {
    ///     assert_eq!(0, buf[i * 3 % 10]);
    ///     buf.rotate_right(3);
    /// }
    /// assert_eq!(buf, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    /// ```
    #[stable(feature = "vecdeque_rotate", since = "1.36.0")]
    pub fn rotate_right(&mut self, n: usize) {
        assert!(n <= self.len());
        let k = self.len - n;
        if n <= k {
            // SAFETY: Ensured by check.
            unsafe { self.rotate_right_inner(n) }
        } else {
            // SAFETY: Ensured by check.
            unsafe { self.rotate_left_inner(k) }
        }
    }

    // SAFETY: the following two methods require that the rotation amount
    // be less than half the length of the deque.
    //
    // `wrap_copy` requires that `min(x, capacity() - x) + copy_len <= capacity()`,
    // but then `min` is never more than half the capacity, regardless of x,
    // so it's sound to call here because we're calling with something
    // less than half the length, which is never above half the capacity.

    unsafe fn rotate_left_inner(&mut self, mid: usize) {
        debug_assert!(mid * 2 <= self.len());
        // SAFETY: Upheld by caller.
        unsafe {
            self.wrap_copy(self.head, self.to_wrapped_index(self.len), mid);
        }
        self.head = self.to_wrapped_index(mid);
    }

    unsafe fn rotate_right_inner(&mut self, k: usize) {
        debug_assert!(k * 2 <= self.len());
        self.head = self.wrap_sub(self.head, k);
        // SAFETY: Upheld by caller.
        unsafe {
            self.wrap_copy(self.to_wrapped_index(self.len), self.head, k);
        }
    }

    /// Binary searches this `VecDeque` for a given element.
    /// If the `VecDeque` is not sorted, the returned result is unspecified and
    /// 无意义。
    ///
    /// If the value is found then [`Result::Ok`] is returned, containing the
    /// 索引。如果有多个匹配项，则可以返回任意一个。
    /// 匹配项之一。如果未找到该值，则返回
    /// [`Result::Err`] is returned, containing the index where a matching
    /// 位置。
    ///
    /// See also [`binary_search_by`], [`binary_search_by_key`], and [`partition_point`].
    ///
    /// [`binary_search_by`]: VecDeque::binary_search_by
    /// [`binary_search_by_key`]: VecDeque::binary_search_by_key
    /// [`partition_point`]: VecDeque::partition_point
    ///
    /// # 示例
    ///
    /// 查找四个元素中的一系列。第一个元素被找到，具有
    /// uniquely determined position; the second and third are not
    /// found; the fourth could match any position in `[1, 4]`.
    ///
    /// ```
    /// use std::collections::VecDeque;
    ///
    /// let deque: VecDeque<_> = [0, 1, 1, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55].into();
    ///
    /// assert_eq!(deque.binary_search(&13),  Ok(9));
    /// assert_eq!(deque.binary_search(&4),   Err(7));
    /// assert_eq!(deque.binary_search(&100), Err(13));
    /// let r = deque.binary_search(&1);
    /// assert!(matches!(r, Ok(1..=4)));
    /// ```
    ///
    /// If you want to insert an item to a sorted deque, while maintaining
    /// sort order, consider using [`partition_point`]:
    ///
    /// ```
    /// use std::collections::VecDeque;
    ///
    /// let mut deque: VecDeque<_> = [0, 1, 1, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55].into();
    /// let num = 42;
    /// let idx = deque.partition_point(|&x| x <= num);
    /// // If `num` is unique, `s.partition_point(|&x| x < num)` (with `<`) is equivalent to
    /// // `s.binary_search(&num).unwrap_or_else(|x| x)`, but using `<=` may allow `insert`
    /// // to shift less elements.
    /// deque.insert(idx, num);
    /// assert_eq!(deque, &[0, 1, 1, 1, 1, 2, 3, 5, 8, 13, 21, 34, 42, 55]);
    /// ```
    #[stable(feature = "vecdeque_binary_search", since = "1.54.0")]
    #[inline]
    pub fn binary_search(&self, x: &T) -> Result<usize, usize>
    where
        T: Ord,
    {
        self.binary_search_by(|e| e.cmp(x))
    }

    /// Binary searches this `VecDeque` with a comparator function.
    ///
    /// The comparator function should return an order code that indicates
    /// whether its argument is `Less`, `Equal` or `Greater` the desired
    /// 位置的顺序代码。
    /// If the `VecDeque` is not sorted or if the comparator function does not
    /// implement an order consistent with the sort order of the underlying
    /// `VecDeque`, the returned result is unspecified and meaningless.
    ///
    /// If the value is found then [`Result::Ok`] is returned, containing the
    /// 索引。如果有多个匹配项，则可以返回任意一个。
    /// 匹配项之一。如果未找到该值，则返回
    /// [`Result::Err`] is returned, containing the index where a matching
    /// 位置。
    ///
    /// See also [`binary_search`], [`binary_search_by_key`], and [`partition_point`].
    ///
    /// [`binary_search`]: VecDeque::binary_search
    /// [`binary_search_by_key`]: VecDeque::binary_search_by_key
    /// [`partition_point`]: VecDeque::partition_point
    ///
    /// # 示例
    ///
    /// 查找四个元素中的一系列。第一个元素被找到，具有
    /// 唯一确定的位置；第二和第三个位置无法确定。
    /// found; the fourth could match any position in `[1, 4]`.
    ///
    /// ```
    /// use std::collections::VecDeque;
    ///
    /// let deque: VecDeque<_> = [0, 1, 1, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55].into();
    ///
    /// assert_eq!(deque.binary_search_by(|x| x.cmp(&13)),  Ok(9));
    /// assert_eq!(deque.binary_search_by(|x| x.cmp(&4)),   Err(7));
    /// assert_eq!(deque.binary_search_by(|x| x.cmp(&100)), Err(13));
    /// let r = deque.binary_search_by(|x| x.cmp(&1));
    /// assert!(matches!(r, Ok(1..=4)));
    /// ```
    #[stable(feature = "vecdeque_binary_search", since = "1.54.0")]
    pub fn binary_search_by<'a, F>(&'a self, mut f: F) -> Result<usize, usize>
    where
        F: FnMut(&'a T) -> Ordering,
    {
        let (front, back) = self.as_slices();
        let cmp_back = back.first().map(&mut f);

        if let Some(Ordering::Equal) = cmp_back {
            Ok(front.len())
        } else if let Some(Ordering::Less) = cmp_back {
            back.binary_search_by(f).map(|idx| idx + front.len()).map_err(|idx| idx + front.len())
        } else {
            front.binary_search_by(f)
        }
    }

    /// Binary searches this `VecDeque` with a key extraction function.
    ///
    /// 假设 deque 按键排序，例如使用
    /// [`make_contiguous().sort_by_key()`] using the same key extraction function.
    /// 如果 deque 不是按键排序，则返回的结果为
    /// 未指定且无意义。
    ///
    /// If the value is found then [`Result::Ok`] is returned, containing the
    /// index of the matching element. If there are multiple matches, then any
    /// # 示例
    /// [`Result::Err`] is returned, containing the index where a matching
    /// 根据给定谓词返回分割点的索引，该谓词将元素分为两部分。
    ///
    /// See also [`binary_search`], [`binary_search_by`], and [`partition_point`].
    ///
    /// [`make_contiguous().sort_by_key()`]: VecDeque::make_contiguous
    /// [`binary_search`]: VecDeque::binary_search
    /// [`binary_search_by`]: VecDeque::binary_search_by
    /// [`partition_point`]: VecDeque::partition_point
    ///
    /// # 示例
    ///
    /// Looks up a series of four elements in a slice of pairs sorted by
    /// 根据给定谓词返回分割点的索引，该谓词将元素分为两部分。
    /// 假设 deque 按键排序。使用相同的键提取函数进行二分查找。
    /// fourth could match any position in `[1, 4]`.
    ///
    /// ```
    /// use std::collections::VecDeque;
    ///
    /// let deque: VecDeque<_> = [(0, 0), (2, 1), (4, 1), (5, 1),
    ///          (3, 1), (1, 2), (2, 3), (4, 5), (5, 8), (3, 13),
    ///          (1, 21), (2, 34), (4, 55)].into();
    ///
    /// assert_eq!(deque.binary_search_by_key(&13, |&(a, b)| b),  Ok(9));
    /// assert_eq!(deque.binary_search_by_key(&4, |&(a, b)| b),   Err(7));
    /// assert_eq!(deque.binary_search_by_key(&100, |&(a, b)| b), Err(13));
    /// let r = deque.binary_search_by_key(&1, |&(a, b)| b);
    /// assert!(matches!(r, Ok(1..=4)));
    /// ```
    #[stable(feature = "vecdeque_binary_search", since = "1.54.0")]
    #[inline]
    pub fn binary_search_by_key<'a, B, F>(&'a self, b: &B, mut f: F) -> Result<usize, usize>
    where
        F: FnMut(&'a T) -> B,
        B: Ord,
    {
        self.binary_search_by(|k| f(k).cmp(b))
    }

    /// Returns the index of the partition point according to the given predicate
    /// 在保持排序顺序的情况下，可以在此处插入匹配元素。
    ///
    /// The deque is assumed to be partitioned according to the given predicate.
    /// # 示例
    /// 如果要将项目插入到已排序的 deque 中，同时保持排序顺序：
    /// For example, `[7, 15, 3, 5, 4, 12, 6]` is partitioned under the predicate `x % 2 != 0`
    /// # 示例
    ///
    /// 如果 deque 未被分割，则返回结果为未指定且无意义，因为该方法执行的是一种二分查找。
    /// as this method performs a kind of binary search.
    ///
    /// See also [`binary_search`], [`binary_search_by`], and [`binary_search_by_key`].
    ///
    /// [`binary_search`]: VecDeque::binary_search
    /// [`binary_search_by`]: VecDeque::binary_search_by
    /// [`binary_search_by_key`]: VecDeque::binary_search_by_key
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::VecDeque;
    ///
    /// let deque: VecDeque<_> = [1, 2, 3, 3, 5, 6, 7].into();
    /// let i = deque.partition_point(|&x| x < 5);
    ///
    /// assert_eq!(i, 4);
    /// assert!(deque.iter().take(i).all(|&x| x < 5));
    /// assert!(deque.iter().skip(i).all(|&x| !(x < 5)));
    /// ```
    ///
    /// 如果您想将项目插入到已排序的 deque 中，同时保持排序顺序：
    /// sort order:
    ///
    /// ```
    /// use std::collections::VecDeque;
    ///
    /// let mut deque: VecDeque<_> = [0, 1, 1, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55].into();
    /// let num = 42;
    /// let idx = deque.partition_point(|&x| x < num);
    /// deque.insert(idx, num);
    /// assert_eq!(deque, &[0, 1, 1, 1, 1, 2, 3, 5, 8, 13, 21, 34, 42, 55]);
    /// ```
    #[stable(feature = "vecdeque_binary_search", since = "1.54.0")]
    pub fn partition_point<P>(&self, mut pred: P) -> usize
    where
        P: FnMut(&T) -> bool,
    {
        let (front, back) = self.as_slices();

        if let Some(true) = back.first().map(&mut pred) {
            back.partition_point(pred) + front.len()
        } else {
            front.partition_point(pred)
        }
    }
}

impl<T: Clone, A: Allocator> VecDeque<T, A> {
    /// Modifies the deque in-place so that `len()` is equal to new_len,
    /// either by removing excess elements from the back or by appending clones of `value`
    /// # 示例
    ///
    /// # Examples
    ///
    /// ```
    /// use std::collections::VecDeque;
    ///
    /// let mut buf = VecDeque::new();
    /// buf.push_back(5);
    /// buf.push_back(10);
    /// buf.push_back(15);
    /// assert_eq!(buf, [5, 10, 15]);
    ///
    /// buf.resize(2, 0);
    /// assert_eq!(buf, [5, 10]);
    ///
    /// buf.resize(5, 20);
    /// assert_eq!(buf, [5, 10, 20, 20, 20]);
    /// ```
    #[stable(feature = "deque_extras", since = "1.16.0")]
    pub fn resize(&mut self, new_len: usize, value: T) {
        if new_len > self.len() {
            let extra = new_len - self.len();
            self.extend(repeat_n(value, extra))
        } else {
            self.truncate(new_len);
        }
    }

    /// Clones the elements at the range `src` and appends them to the end.
    ///
    /// # Panic
    ///
    /// 如果起始索引大于结束索引，或者任一索引大于向量的长度，则触发 panic。
    /// # 示例
    ///
    /// # Examples
    ///
    /// ```
    /// #![feature(deque_extend_front)]
    /// use std::collections::VecDeque;
    ///
    /// let mut characters = VecDeque::from(['a', 'b', 'c', 'd', 'e']);
    /// characters.extend_from_within(2..);
    /// assert_eq!(characters, ['a', 'b', 'c', 'd', 'e', 'c', 'd', 'e']);
    ///
    /// let mut numbers = VecDeque::from([0, 1, 2, 3, 4]);
    /// numbers.extend_from_within(..2);
    /// assert_eq!(numbers, [0, 1, 2, 3, 4, 0, 1]);
    ///
    /// let mut strings = VecDeque::from([String::from("hello"), String::from("world"), String::from("!")]);
    /// strings.extend_from_within(1..=2);
    /// assert_eq!(strings, ["hello", "world", "!", "world", "!"]);
    /// ```
    #[cfg(not(no_global_oom_handling))]
    #[unstable(feature = "deque_extend_front", issue = "146975")]
    pub fn extend_from_within<R>(&mut self, src: R)
    where
        R: RangeBounds<usize>,
    {
        let range = slice::range(src, ..self.len());
        self.reserve(range.len());

        // SAFETY:
        // - `slice::range` guarantees that the given range is valid for indexing self
        // - at least `range.len()` additional space is available
        unsafe {
            self.spec_extend_from_within(range);
        }
    }

    /// Clones the elements at the range `src` and prepends them to the front.
    ///
    /// # Panics
    ///
    /// Panics if the starting index is greater than the end index
    /// 或者如果任一索引大于向量的长度。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(deque_extend_front)]
    /// use std::collections::VecDeque;
    ///
    /// let mut characters = VecDeque::from(['a', 'b', 'c', 'd', 'e']);
    /// characters.prepend_from_within(2..);
    /// assert_eq!(characters, ['c', 'd', 'e', 'a', 'b', 'c', 'd', 'e']);
    ///
    /// let mut numbers = VecDeque::from([0, 1, 2, 3, 4]);
    /// numbers.prepend_from_within(..2);
    /// assert_eq!(numbers, [0, 1, 0, 1, 2, 3, 4]);
    ///
    /// let mut strings = VecDeque::from([String::from("hello"), String::from("world"), String::from("!")]);
    /// strings.prepend_from_within(1..=2);
    /// assert_eq!(strings, ["world", "!", "hello", "world", "!"]);
    /// ```
    #[cfg(not(no_global_oom_handling))]
    #[unstable(feature = "deque_extend_front", issue = "146975")]
    pub fn prepend_from_within<R>(&mut self, src: R)
    where
        R: RangeBounds<usize>,
    {
        let range = slice::range(src, ..self.len());
        self.reserve(range.len());

        // SAFETY:
        // - `slice::range` guarantees that the given range is valid for indexing self
        // - at least `range.len()` additional space is available
        unsafe {
            self.spec_prepend_from_within(range);
        }
    }
}

/// 相关函数满足以下前提条件：
///
/// - `src` needs to be a valid range: `src.start <= src.end <= self.len()`.
/// - The buffer must have enough spare capacity: `self.capacity() - self.len() >= src.len()`.
#[cfg(not(no_global_oom_handling))]
trait SpecExtendFromWithin {
    unsafe fn spec_extend_from_within(&mut self, src: Range<usize>);

    unsafe fn spec_prepend_from_within(&mut self, src: Range<usize>);
}

#[cfg(not(no_global_oom_handling))]
impl<T: Clone, A: Allocator> SpecExtendFromWithin for VecDeque<T, A> {
    default unsafe fn spec_extend_from_within(&mut self, src: Range<usize>) {
        let dst = self.len();
        let count = src.end - src.start;
        let src = src.start;

        // SAFETY:
        // - Ranges do not overlap: src entirely spans initialized values, dst entirely spans uninitialized values.
        // - Ranges are in bounds: guaranteed by the caller.
        let ranges = unsafe { self.nonoverlapping_ranges(src, dst, count, self.head) };

        // `len` is updated after every clone to prevent leaking and
        // leave the deque in the right state when a clone implementation panics

        for (src, dst, count) in ranges {
            for offset in 0..count {
                // SAFETY: The allocations of `dst` and `src` go up to `count` elems,
                // and `nonoverlapping_ranges` ensures `dst` and `src` are valid
                // for writes and reads respectively.
                unsafe { dst.add(offset).write((*src.add(offset)).clone()) };
                self.len += 1;
            }
        }
    }

    default unsafe fn spec_prepend_from_within(&mut self, src: Range<usize>) {
        let dst = 0;
        let count = src.end - src.start;
        let src = src.start + count;

        let new_head = self.wrap_sub(self.head, count);
        let cap = self.capacity();

        // SAFETY:
        // - Ranges do not overlap: src entirely spans initialized values, dst entirely spans uninitialized values.
        // - Ranges are in bounds: guaranteed by the caller.
        let ranges = unsafe { self.nonoverlapping_ranges(src, dst, count, new_head) };

        // Cloning is done in reverse because we prepend to the front of the deque,
        // we can't get holes in the *logical* buffer.
        // `head` and `len` are updated after every clone to prevent leaking and
        // leave the deque in the right state when a clone implementation panics

        // Clone the first range
        let (src, dst, count) = ranges[1];
        for offset in (0..count).rev() {
            // ignore-tidy-undocumented-unsafe
            unsafe { dst.add(offset).write((*src.add(offset)).clone()) };
            // ignore-tidy-undocumented-unsafe
            self.head = unsafe { self.head.sub(1) };
            self.len += 1;
        }

        // Clone the second range
        let (src, dst, count) = ranges[0];
        let mut iter = (0..count).rev();
        if let Some(offset) = iter.next() {
            // ignore-tidy-undocumented-unsafe
            unsafe { dst.add(offset).write((*src.add(offset)).clone()) };
            // After the first clone of the second range, wrap `head` around
            if self.head.is_zero() {
                // SAFETY: the wrapped index may be temporarily equal to the capacity even if it
                // is not zero, because we subtract it one line below.
                // FIXME: should `from_arbitrary_number` be unsafe? its docs imply so...
                self.head = WrappedIndex::from_arbitrary_number(cap);
            }
            // ignore-tidy-undocumented-unsafe
            self.head = unsafe { self.head.sub(1) };
            self.len += 1;

            // Continue like normal
            for offset in iter {
                // ignore-tidy-undocumented-unsafe
                unsafe { dst.add(offset).write((*src.add(offset)).clone()) };
                // ignore-tidy-undocumented-unsafe
                self.head = unsafe { self.head.sub(1) };
                self.len += 1;
            }
        }
    }
}

#[cfg(not(no_global_oom_handling))]
impl<T: TrivialClone, A: Allocator> SpecExtendFromWithin for VecDeque<T, A> {
    unsafe fn spec_extend_from_within(&mut self, src: Range<usize>) {
        let dst = self.len();
        let count = src.end - src.start;
        let src = src.start;

        // SAFETY:
        // - Ranges do not overlap: src entirely spans initialized values, dst entirely spans uninitialized values.
        // - Ranges are in bounds: guaranteed by the caller.
        let ranges = unsafe { self.nonoverlapping_ranges(src, dst, count, self.head) };
        for (src, dst, count) in ranges {
            // SAFETY: Ditto.
            unsafe { ptr::copy_nonoverlapping(src, dst, count) };
        }

        // SAFETY:
        // - The elements were just initialized by `copy_nonoverlapping`
        self.len += count;
    }

    unsafe fn spec_prepend_from_within(&mut self, src: Range<usize>) {
        let dst = 0;
        let count = src.end - src.start;
        let src = src.start + count;

        let new_head = self.wrap_sub(self.head, count);

        // SAFETY:
        // - Ranges do not overlap: src entirely spans initialized values, dst entirely spans uninitialized values.
        // - Ranges are in bounds: guaranteed by the caller.
        let ranges = unsafe { self.nonoverlapping_ranges(src, dst, count, new_head) };
        for (src, dst, count) in ranges {
            // SAFETY: Ditto.
            unsafe { ptr::copy_nonoverlapping(src, dst, count) };
        }

        // SAFETY:
        // - The elements were just initialized by `copy_nonoverlapping`
        self.head = new_head;
        self.len += count;
    }
}

use index::{WrappedIndex, wrap_index};

// The code is separated into a module to make it harder to construct a BufferIndex without
// going through wrapping.
mod index {
    use core::cmp::Ordering;

    /// 返回给定逻辑元素索引在底层缓冲区中的索引。
    #[inline]
    pub(super) fn wrap_index(logical_index: usize, capacity: usize) -> WrappedIndex {
        debug_assert!(
            (logical_index == 0 && capacity == 0)
                || logical_index < capacity
                || (logical_index - capacity) < capacity
        );
        if logical_index >= capacity {
            WrappedIndex(logical_index - capacity)
        } else {
            WrappedIndex(logical_index)
        }
    }

    /// 表示一个可以安全用于对 VecDeque 缓冲区进行索引的索引。
    /// 作为独立类型存在，以避免意外地将逻辑（未解包）索引传递给各种
    /// VecDeque 函数。
    ///
    /// 该索引的不变量是它始终为 < VecDeque 容量，除非 VecDeque
    /// 为空（在这种情况下，当容量为 0 时，索引可以为 0）。
    #[derive(Copy, Clone, Debug, PartialOrd, Ord, PartialEq, Eq)]
    #[repr(transparent)]
    pub(super) struct WrappedIndex(usize);

    impl WrappedIndex {
        /// 新构造的索引必须位于 VecDeque 的边界内，用于该 VecDeque
        /// 使用该索引。
        #[inline(always)]
        pub(super) fn from_arbitrary_number(index: usize) -> Self {
            Self(index)
        }

        /// 安全不变量：新构造的索引必须仍然位于 VecDeque 的边界内。
        #[inline(always)]
        pub(super) unsafe fn add(self, offset: usize) -> Self {
            Self(self.0 + offset)
        }

        /// 安全不变量：新构造的索引必须仍然位于 VecDeque 的边界内。
        #[inline(always)]
        pub(super) unsafe fn sub(self, offset: usize) -> Self {
            debug_assert!(self.0 >= offset);
            Self(self.0 - offset)
        }

        #[inline(always)]
        pub(super) const fn zero() -> Self {
            Self(0)
        }

        #[inline(always)]
        pub(super) fn abs_diff(self, other: Self) -> usize {
            self.0.abs_diff(other.0)
        }

        #[inline(always)]
        pub(super) fn as_index(self) -> usize {
            self.0
        }

        #[inline(always)]
        pub(super) fn is_zero(self) -> bool {
            self.0 == 0
        }
    }

    impl core::ops::Add<usize> for WrappedIndex {
        // The output might not be wrapped anymore
        type Output = usize;

        #[inline(always)]
        fn add(self, rhs: usize) -> Self::Output {
            self.0 + rhs
        }
    }

    impl core::fmt::Display for WrappedIndex {
        fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
            self.0.fmt(f)
        }
    }

    impl core::cmp::PartialEq<usize> for WrappedIndex {
        #[inline(always)]
        fn eq(&self, other: &usize) -> bool {
            self.0.eq(other)
        }
    }

    impl core::cmp::PartialOrd<usize> for WrappedIndex {
        #[inline(always)]
        fn partial_cmp(&self, other: &usize) -> Option<Ordering> {
            self.0.partial_cmp(other)
        }
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T: PartialEq, A: Allocator> PartialEq for VecDeque<T, A> {
    fn eq(&self, other: &Self) -> bool {
        if self.len != other.len() {
            return false;
        }
        let (sa, sb) = self.as_slices();
        let (oa, ob) = other.as_slices();
        if sa.len() == oa.len() {
            sa == oa && sb == ob
        } else if sa.len() < oa.len() {
            // Always divisible in three sections, for example:
            // self:  [a b c|d e f]
            // other: [0 1 2 3|4 5]
            // front = 3, mid = 1,
            // [a b c] == [0 1 2] && [d] == [3] && [e f] == [4 5]
            let front = sa.len();
            let mid = oa.len() - front;

            let (oa_front, oa_mid) = oa.split_at(front);
            let (sb_mid, sb_back) = sb.split_at(mid);
            debug_assert_eq!(sa.len(), oa_front.len());
            debug_assert_eq!(sb_mid.len(), oa_mid.len());
            debug_assert_eq!(sb_back.len(), ob.len());
            sa == oa_front && sb_mid == oa_mid && sb_back == ob
        } else {
            let front = oa.len();
            let mid = sa.len() - front;

            let (sa_front, sa_mid) = sa.split_at(front);
            let (ob_mid, ob_back) = ob.split_at(mid);
            debug_assert_eq!(sa_front.len(), oa.len());
            debug_assert_eq!(sa_mid.len(), ob_mid.len());
            debug_assert_eq!(sb.len(), ob_back.len());
            sa_front == oa && sa_mid == ob_mid && sb == ob_back
        }
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T: Eq, A: Allocator> Eq for VecDeque<T, A> {}

__impl_slice_eq1! { [] VecDeque<T, A>, Vec<U, A>, }
__impl_slice_eq1! { [] VecDeque<T, A>, &[U], }
__impl_slice_eq1! { [] VecDeque<T, A>, &mut [U], }
__impl_slice_eq1! { [const N: usize] VecDeque<T, A>, [U; N], }
__impl_slice_eq1! { [const N: usize] VecDeque<T, A>, &[U; N], }
__impl_slice_eq1! { [const N: usize] VecDeque<T, A>, &mut [U; N], }

#[stable(feature = "rust1", since = "1.0.0")]
impl<T: PartialOrd, A: Allocator> PartialOrd for VecDeque<T, A> {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        self.iter().partial_cmp(other.iter())
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T: Ord, A: Allocator> Ord for VecDeque<T, A> {
    #[inline]
    fn cmp(&self, other: &Self) -> Ordering {
        self.iter().cmp(other.iter())
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T: Hash, A: Allocator> Hash for VecDeque<T, A> {
    fn hash<H: Hasher>(&self, state: &mut H) {
        state.write_length_prefix(self.len);
        // It's not possible to use Hash::hash_slice on slices
        // returned by as_slices method as their length can vary
        // in otherwise identical deques.
        //
        // Hasher only guarantees equivalence for the exact same
        // set of calls to its methods.
        self.iter().for_each(|elem| elem.hash(state));
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T, A: Allocator> Index<usize> for VecDeque<T, A> {
    type Output = T;

    #[inline]
    fn index(&self, index: usize) -> &T {
        self.get(index).expect("out of bounds access")
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T, A: Allocator> IndexMut<usize> for VecDeque<T, A> {
    #[inline]
    fn index_mut(&mut self, index: usize) -> &mut T {
        self.get_mut(index).expect("out of bounds access")
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T> FromIterator<T> for VecDeque<T> {
    fn from_iter<I: IntoIterator<Item = T>>(iter: I) -> VecDeque<T> {
        SpecFromIter::spec_from_iter(iter.into_iter())
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T, A: Allocator> IntoIterator for VecDeque<T, A> {
    type Item = T;
    type IntoIter = IntoIter<T, A>;

    /// 将 deque 转换为从前往后的迭代器，按
    /// 值输出元素。
    fn into_iter(self) -> IntoIter<T, A> {
        IntoIter::new(self)
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<'a, T, A: Allocator> IntoIterator for &'a VecDeque<T, A> {
    type Item = &'a T;
    type IntoIter = Iter<'a, T>;

    fn into_iter(self) -> Iter<'a, T> {
        self.iter()
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<'a, T, A: Allocator> IntoIterator for &'a mut VecDeque<T, A> {
    type Item = &'a mut T;
    type IntoIter = IterMut<'a, T>;

    fn into_iter(self) -> IterMut<'a, T> {
        self.iter_mut()
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T, A: Allocator> Extend<T> for VecDeque<T, A> {
    fn extend<I: IntoIterator<Item = T>>(&mut self, iter: I) {
        <Self as SpecExtend<T, I::IntoIter>>::spec_extend(self, iter.into_iter());
    }

    #[inline]
    fn extend_one(&mut self, elem: T) {
        self.push_back(elem);
    }

    #[inline]
    fn extend_reserve(&mut self, additional: usize) {
        self.reserve(additional);
    }

    #[inline]
    unsafe fn extend_one_unchecked(&mut self, item: T) {
        // SAFETY: Our preconditions ensure the space has been reserved, and `extend_reserve` is implemented correctly.
        unsafe {
            self.push_unchecked(item);
        }
    }
}

#[stable(feature = "extend_ref", since = "1.2.0")]
impl<'a, T: 'a + Copy, A: Allocator> Extend<&'a T> for VecDeque<T, A> {
    fn extend<I: IntoIterator<Item = &'a T>>(&mut self, iter: I) {
        self.spec_extend(iter.into_iter());
    }

    #[inline]
    fn extend_one(&mut self, &elem: &'a T) {
        self.push_back(elem);
    }

    #[inline]
    fn extend_reserve(&mut self, additional: usize) {
        self.reserve(additional);
    }

    #[inline]
    unsafe fn extend_one_unchecked(&mut self, &item: &'a T) {
        // SAFETY: Our preconditions ensure the space has been reserved, and `extend_reserve` is implemented correctly.
        unsafe {
            self.push_unchecked(item);
        }
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T: fmt::Debug, A: Allocator> fmt::Debug for VecDeque<T, A> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_list().entries(self.iter()).finish()
    }
}

#[stable(feature = "vecdeque_vec_conversions", since = "1.10.0")]
impl<T, A: AllocatorNightly> From<Vec<T, A>> for VecDeque<T, A> {
    /// Turn a [`Vec<T>`] into a [`VecDeque<T>`].
    ///
    /// [`Vec<T>`]: crate::vec::Vec
    /// [`VecDeque<T>`]: crate::collections::VecDeque
    ///
    /// This conversion is guaranteed to run in *O*(1) time
    /// and to not re-allocate the `Vec`'s buffer or allocate
    /// any additional memory.
    #[inline]
    fn from(other: Vec<T, A>) -> Self {
        let (ptr, len, cap, alloc) = other.into_raw_parts_with_allocator();
        Self {
            head: WrappedIndex::zero(),
            len,
            // ignore-tidy-undocumented-unsafe
            buf: unsafe { RawVec::from_raw_parts_in(ptr, cap, alloc) },
        }
    }
}

#[stable(feature = "vecdeque_vec_conversions", since = "1.10.0")]
impl<T, A: Allocator> From<VecDeque<T, A>> for Vec<T, A> {
    /// Turn a [`VecDeque<T>`] into a [`Vec<T>`].
    ///
    /// [`Vec<T>`]: crate::vec::Vec
    /// [`VecDeque<T>`]: crate::collections::VecDeque
    ///
    /// 此操作永远不需要重新分配，但如果
    /// 环形缓冲区恰好不在分配的开头位置，则需要进行 *O*(*n*) 的数据移动。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::VecDeque;
    ///
    /// // This one is *O*(1).
    /// let deque: VecDeque<_> = (1..5).collect();
    /// let ptr = deque.as_slices().0.as_ptr();
    /// let vec = Vec::from(deque);
    /// assert_eq!(vec, [1, 2, 3, 4]);
    /// assert_eq!(vec.as_ptr(), ptr);
    ///
    /// // This one needs data rearranging.
    /// let mut deque: VecDeque<_> = (1..5).collect();
    /// deque.push_front(9);
    /// deque.push_front(8);
    /// let ptr = deque.as_slices().1.as_ptr();
    /// let vec = Vec::from(deque);
    /// assert_eq!(vec, [8, 9, 1, 2, 3, 4]);
    /// assert_eq!(vec.as_ptr(), ptr);
    /// ```
    fn from(mut other: VecDeque<T, A>) -> Self {
        other.make_contiguous();

        // ignore-tidy-undocumented-unsafe
        unsafe {
            let other = ManuallyDrop::new(other);
            let buf = other.buf.ptr();
            let len = other.len();
            let cap = other.capacity();
            let alloc = ptr::read(other.allocator());

            if !other.head.is_zero() {
                ptr::copy(buf.add(other.head.as_index()), buf, len);
            }
            Vec::from_raw_parts_in(buf, len, cap, alloc)
        }
    }
}

#[stable(feature = "std_collections_from_array", since = "1.56.0")]
impl<T, const N: usize> From<[T; N]> for VecDeque<T> {
    /// Converts a `[T; N]` into a `VecDeque<T>`.
    ///
    /// ```
    /// use std::collections::VecDeque;
    ///
    /// let deq1 = VecDeque::from([1, 2, 3, 4]);
    /// let deq2: VecDeque<_> = [1, 2, 3, 4].into();
    /// assert_eq!(deq1, deq2);
    /// ```
    fn from(arr: [T; N]) -> Self {
        let mut deq = VecDeque::with_capacity(N);
        let arr = ManuallyDrop::new(arr);
        if !<T>::IS_ZST {
            // SAFETY: VecDeque::with_capacity ensures that there is enough capacity.
            unsafe {
                ptr::copy_nonoverlapping(arr.as_ptr(), deq.ptr(), N);
            }
        }
        deq.head = WrappedIndex::zero();
        deq.len = N;
        deq
    }
}
