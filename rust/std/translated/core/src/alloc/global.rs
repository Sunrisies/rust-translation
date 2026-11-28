use super::{AllocError, GlobalAllocator};
use crate::alloc::Layout;
use crate::hint::assert_unchecked;
use crate::ptr::NonNull;
use crate::{cmp, ptr};

/// 一种可注册为标准库默认内存分配器的内存分配器
/// through the `#[global_allocator]` attribute.
///
/// 某些方法要求内存块当前
/// 已由分配器分配*。这意味着：
///
/// * 该内存块的起始地址之前
/// 由之前的分配方法调用返回
///   such as `alloc`, and
///
/// * 该内存块尚未被后续释放，其中
///   blocks are deallocated either by being passed to a deallocation
///   method such as `dealloc` or by being
/// # 示例
///
/// # Example
///
/// ```standalone_crate
/// use std::alloc::{GlobalAlloc, Layout};
/// use std::cell::UnsafeCell;
/// use std::ptr::null_mut;
/// use std::sync::atomic::{AtomicUsize, Ordering::Relaxed};
///
/// const ARENA_SIZE: usize = 128 * 1024;
/// const MAX_SUPPORTED_ALIGN: usize = 4096;
/// #[repr(C, align(4096))] // 4096 == MAX_SUPPORTED_ALIGN
/// struct SimpleAllocator {
///     arena: UnsafeCell<[u8; ARENA_SIZE]>,
///     remaining: AtomicUsize, // we allocate from the top, counting down
/// }
///
/// #[global_allocator]
/// static ALLOCATOR: SimpleAllocator = SimpleAllocator {
///     arena: UnsafeCell::new([0x55; ARENA_SIZE]),
///     remaining: AtomicUsize::new(ARENA_SIZE),
/// };
///
/// unsafe impl Sync for SimpleAllocator {}
///
/// unsafe impl GlobalAlloc for SimpleAllocator {
///     unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
///         let size = layout.size();
///         let align = layout.align();
///
///         // `Layout` contract forbids making a `Layout` with align=0, or align not power of 2.
///         // So we can safely use a mask to ensure alignment without worrying about UB.
///         let align_mask_to_round_down = !(align - 1);
///
///         if align > MAX_SUPPORTED_ALIGN {
///             return null_mut();
///         }
///
///         let mut allocated = 0;
///         if self
///             .remaining
///             .try_update(Relaxed, Relaxed, |mut remaining| {
///                 if size > remaining {
///                     return None;
///                 }
///                 remaining -= size;
///                 remaining &= align_mask_to_round_down;
///                 allocated = remaining;
///                 Some(remaining)
///             })
///             .is_err()
///         {
///             return null_mut();
///         };
///         unsafe { self.arena.get().cast::<u8>().add(allocated) }
///     }
///     unsafe fn dealloc(&self, _ptr: *mut u8, _layout: Layout) {}
/// }
///
/// fn main() {
///     let _s = format!("allocating a string!");
///     let currently = ALLOCATOR.remaining.load(Relaxed);
///     println!("allocated so far: {}", ARENA_SIZE - currently);
/// }
/// ```
///
/// # The `#[global_allocator]` attribute
///
/// As the example above demonstrates, the `#[global_allocator]` attribute can be used to register a
/// concrete `static` of a type that implements this trait to become *the* global allocator
/// for the current program. That global allocator can be invoked via the functions [`alloc`],
/// [`alloc_zeroed`], [`dealloc`], [`realloc`]). Note, however, that invoking those functions is
/// 双方只能假设对方在合同中的相应要求。
/// 这意味着：
/// - 分配函数可能非确定性地完全跳过底层分配器，例如如果
/// 编译器表明此分配可以被栈变量替代。编译器也可能
/// 将多个分配操作合并为一次，只要它也能相应地调整所有对应的释放操作。
///
/// - Allocation functions may non-deterministically entirely skip the underlying allocator, e.g. if the
///   compiler can show that this allocation can be replaced by a stack variable. The compiler may
/// also merge multiple allocation operations into one, as long as it can also adjust all
/// corresponding deallocation operations accordingly.
/// - An allocation created by invoking [`alloc`], [`alloc_zeroed`], or [`realloc`] has exactly the
///   size and minimum alignment defined by `layout`, even if the underlying allocator makes
/// stronger promises.
/// - An allocation created by invoking [`alloc`], [`alloc_zeroed`], or [`realloc`] can only be
///   freed by invoking [`dealloc`] or [`realloc`]. In particular, passing a pointer to such an
///   allocation directly to the underlying method on [`GlobalAlloc`] is not permitted. Until one of
/// 这些函数被调用时，访问其背后的内存属于未定义行为。
/// 使用并非由该函数返回值派生出的任何指针进行分配（例如，
/// 分配器可能保留的内部指针）。
/// - The pointer passed to [`dealloc`] or [`realloc`] must have been obtained by invoking [`alloc`],
///   [`alloc_zeroed`], or [`realloc`]. In particular, passing a pointer returned by the underlying
///   methods on [`GlobalAlloc`] is not permitted.
/// - [`alloc`] de-initializes the contents of the allocation before handing it to the user. So even
/// 你控制着底层分配器，并且知道它明确初始化了该内存，
///   you cannot rely on it being initialized. For a [`realloc`] that grows an allocation, this
/// 适用于新分配的部分。
/// - [`dealloc`] de-initializes the contents of the allocation before handing it to the allocator.
/// 因此，即使你知道程序之前已经初始化了该内存，分配器也不能
///   rely on it being initialized. For a [`realloc`] that shrinks an allocation, this applies to
/// 被移除的部分。
///
/// [`alloc`]: ../../std/alloc/fn.alloc.html
/// [`alloc_zeroed`]: ../../std/alloc/fn.alloc_zeroed.html
/// [`dealloc`]: ../../std/alloc/fn.dealloc.html
/// [`realloc`]: ../../std/alloc/fn.realloc.html
///
/// 第一点意味着你不能依赖全局分配确实发生，即使
/// 源代码中存在明确的全局分配。优化器可能会检测到未使用的全局
/// 分配，它可以选择完全消除或将其移到栈上，从而永远不调用
/// 全局分配器。优化器还可能假设分配是可靠的，因此那些
/// 原本因分配器失败而失败的代码现在可能突然工作起来，因为优化器已经解决了
/// 分配的需求。更具体地说，以下代码示例是不合理的，无论
/// 你的自定义分配器是否允许统计发生的分配次数。
///
/// ```rust,ignore (unsound and has placeholders)
/// drop(Box::new(42));
/// let number_of_heap_allocs = /* call private allocator API */;
/// unsafe { std::hint::assert_unchecked(number_of_heap_allocs > 0); }
/// ```
///
/// 请注意，上述优化并不是唯一的
/// 可以应用的优化。通常你不能依赖全局分配
/// 发生，如果它们可以在不改变程序行为的情况下被移除的话。
/// 分配是否发生并不属于程序行为的一部分，即使
/// 可以通过跟踪分配的分配器通过打印或其他方式
/// 产生副作用来检测。
///
/// # 安全性
///
/// The `GlobalAlloc` trait is an `unsafe` trait for a number of reasons, and
/// 实现者必须确保遵守这些契约：
///
/// * 如果分配器读取、写入或释放当前已分配的内存，则属于未定义行为。该内存由用户拥有，分配器不得干预。
/// * 如果全局分配器进行回溯操作，也属于未定义行为。这种限制可能
///
/// * 未来可能会取消这一限制，但目前任何此类函数引发的 panic 都可能导致内存不安全状态。
/// * 调用此 trait 的函数可以依赖每个方法定义的契约，
/// 实现者必须确保这些契约始终成立。
///
/// # 重新进入机制
/// 在实现全局分配器时，必须小心避免意外产生无限递归实现，因为 Rust 标准库中的许多构造可能在
///
/// # Re-entrance
///
/// 在全局分配器中这样做非常有问题。
/// implementation by accident, as many constructs in the Rust standard library may allocate in
/// their implementation. For example, on some platforms, [`std::sync::Mutex`] may allocate, so using
/// it is highly problematic in a global allocator.
///
/// For this reason, one should generally stick to library features available through
/// [`core`], and avoid using [`std`] in a global allocator. A few features from [`std`] are
/// guaranteed to not use `#[global_allocator]` to allocate:
///
///  - [`std::thread_local`],
///  - [`std::thread::current`],
///  - [`std::thread::park`] and [`std::thread::Thread`]'s [`unpark`] method and
///    [`Clone`] implementation.
///
/// [`std`]: ../../std/index.html
/// [`std::sync::Mutex`]: ../../std/sync/struct.Mutex.html
/// [`std::thread_local`]: ../../std/macro.thread_local.html
/// [`std::thread::current`]: ../../std/thread/fn.current.html
/// [`std::thread::park`]: ../../std/thread/fn.park.html
/// [`std::thread::Thread`]: ../../std/thread/struct.Thread.html
/// [`unpark`]: ../../std/thread/struct.Thread.html#method.unpark
#[stable(feature = "global_alloc", since = "1.28.0")]
pub unsafe trait GlobalAlloc {
    /// Allocates memory as described by the given `layout`.
    ///
    /// 未定义行为。
    /// （扩展特征可能提供更具体的行为边界，例如保证一个哨兵地址或 null 指针
    ///
    /// # 在零大小分配请求时响应）。
    ///
    /// `layout` must have non-zero size. Attempting to allocate for a zero-sized `layout` will
    /// # 错误
    ///
    /// 返回 null 指针表示内存已耗尽
    /// behavior, e.g., guarantee a sentinel address or a null pointer
    /// 建议实现函数在内存耗尽时返回 null 而不是中断，但这并非
    ///
    /// 严格要求。（具体来说：在底层原生分配器之上实现此 trait 并
    ///
    /// # 在分配错误时中止计算是允许的。）
    ///
    /// Returning a null pointer indicates that either memory is exhausted
    /// or `layout` does not meet this allocator's size or alignment constraints.
    ///
    /// Implementations are encouraged to return null on memory
    /// exhaustion rather than aborting, but this is not
    /// a strict requirement. (Specifically: it is *legal* to
    /// implement this trait atop an underlying native allocation
    /// library that aborts on memory exhaustion.)
    ///
    /// Clients wishing to abort computation in response to an
    /// allocation error are encouraged to call the [`handle_alloc_error`] function,
    /// rather than directly invoking `panic!` or similar (but note that both may unwind).
    ///
    /// [`handle_alloc_error`]: ../../alloc/alloc/fn.handle_alloc_error.html
    #[stable(feature = "global_alloc", since = "1.28.0")]
    unsafe fn alloc(&self, layout: Layout) -> *mut u8;

    /// Deallocates the block of memory at the given `ptr` pointer with the given `layout`.
    ///
    /// # 安全性
    ///
    /// 调用者必须确保：
    ///
    /// * `ptr` is a block of memory currently allocated via this allocator and,
    ///
    /// * `layout` is the same layout that was used to allocate that block of
    /// 否则行为未定义。
    ///
    /// 否则行为未定义。
    #[stable(feature = "global_alloc", since = "1.28.0")]
    unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout);

    /// Behaves like `alloc`, but also ensures that the contents
    /// 在返回前内容被置零。
    ///
    /// # 安全性
    ///
    /// The caller has to ensure that `layout` has non-zero size. Like `alloc`
    /// zero sized `layout` will result in undefined behavior.
    /// 然而，分配的内存块保证被初始化。
    ///
    /// # 错误
    ///
    /// 返回空指针表示内存已耗尽，
    /// or `layout` does not meet allocator's size or alignment constraints,
    /// just as in `alloc`.
    ///
    /// 希望因
    /// allocation error are encouraged to call the [`handle_alloc_error`] function,
    /// rather than directly invoking `panic!` or similar.
    ///
    /// [`handle_alloc_error`]: ../../alloc/alloc/fn.handle_alloc_error.html
    #[stable(feature = "global_alloc", since = "1.28.0")]
    unsafe fn alloc_zeroed(&self, layout: Layout) -> *mut u8 {
        let size = layout.size();
        // SAFETY: the safety contract for `alloc` must be upheld by the caller.
        let ptr = unsafe { self.alloc(layout) };
        if !ptr.is_null() {
            // SAFETY: as allocation succeeded, the region from `ptr`
            // of size `size` is guaranteed to be valid for writes.
            unsafe { ptr::write_bytes(ptr, 0, size) };
        }
        ptr
    }

    /// Shrinks or grows a block of memory to the given `new_size` in bytes.
    /// The block is described by the given `ptr` pointer and `layout`.
    ///
    /// If this returns a non-null pointer, then ownership of the memory block
    /// referenced by `ptr` has been transferred to this allocator.
    /// Any access to the old `ptr` is Undefined Behavior, even if the
    /// 分配保持原位。新返回的指针是现在访问此内存的唯一有效指针。
    /// for accessing this memory now.
    ///
    /// The new memory block is allocated with `layout`,
    /// but with the `size` updated to `new_size` in bytes.
    /// This new layout must be used when deallocating the new memory block with `dealloc`.
    /// The range `0..min(layout.size(), new_size)` of the new memory block is
    /// 如果此方法返回 null，则内存块的所有权
    ///
    /// 未转移给此分配器，且
    /// 内存块的内容未改变。
    /// # 安全性
    ///
    /// # 调用者必须确保：
    ///
    /// The caller must ensure that:
    ///
    /// * `ptr` is allocated via this allocator,
    ///
    /// * `layout` is the same layout that was used
    /// 用于分配该内存块，
    ///
    /// * `new_size` is greater than zero.
    ///
    /// * `new_size`, when rounded up to the nearest multiple of `layout.align()`,
    ///   does not overflow `isize` (i.e., the rounded value must be less than or
    ///   equal to `isize::MAX`).
    ///
    /// 如果不遵循这些规定，行为将不可定义。
    ///
    /// （扩展特征可能提供更具体的约束条件
    /// 例如，确保有一个哨兵地址或空指针
    /// 以响应零大小分配请求。）
    ///
    /// # 错误
    ///
    /// 如果新布局不符合分配器的尺寸
    /// 和对齐约束，或者重新分配失败
    /// 则返回 null。
    ///
    /// 实现方被鼓励在内存耗尽时返回 null
    /// 而不是崩溃或中止，但这并非强制要求。
    /// （具体来说：在底层原生分配器之上实现此 trait 是*
    /// 合法的。）
    /// 在内存耗尽时中止的库中。）
    ///
    /// Clients wishing to abort computation in response to a
    /// reallocation error are encouraged to call the [`handle_alloc_error`] function,
    /// rather than directly invoking `panic!` or similar.
    ///
    /// [`handle_alloc_error`]: ../../alloc/alloc/fn.handle_alloc_error.html
    #[stable(feature = "global_alloc", since = "1.28.0")]
    unsafe fn realloc(&self, ptr: *mut u8, layout: Layout, new_size: usize) -> *mut u8 {
        let alignment = layout.alignment();
        // SAFETY: the caller must ensure that the `new_size` does not overflow
        // when rounded up to the next multiple of `alignment`.
        let new_layout = unsafe { Layout::from_size_alignment_unchecked(new_size, alignment) };
        // SAFETY: the caller must ensure that `new_layout` is greater than zero.
        let new_ptr = unsafe { self.alloc(new_layout) };
        if !new_ptr.is_null() {
            // SAFETY: the previously allocated block cannot overlap the newly allocated block.
            // The safety contract for `dealloc` must be upheld by the caller.
            unsafe {
                ptr::copy_nonoverlapping(ptr, new_ptr, cmp::min(layout.size(), new_size));
                self.dealloc(ptr, layout);
            }
        }
        new_ptr
    }
}

/// Allows all [`GlobalAllocator`]s to be used with the legacy [`GlobalAlloc`] interface.
#[stable(feature = "global_alloc", since = "1.28.0")]
unsafe impl<A> GlobalAlloc for A
where
    A: GlobalAllocator + ?Sized,
{
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        // SAFETY: guaranteed by the caller.
        // This might lead to the removal of zero-size checks inside the
        // `Allocator` implementation.
        unsafe { assert_unchecked(layout.size() != 0) };
        match self.allocate(layout) {
            Ok(ptr) => ptr.cast().as_ptr(),
            Err(AllocError) => ptr::null_mut(),
        }
    }

    unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) {
        // SAFETY: guaranteed by the caller.
        unsafe { assert_unchecked(layout.size() != 0) };
        // SAFETY: only non-null pointers can be currently allocated.
        let ptr = unsafe { NonNull::new_unchecked(ptr) };
        // SAFETY: guaranteed by caller.
        unsafe { self.deallocate(ptr, layout) };
    }

    unsafe fn alloc_zeroed(&self, layout: Layout) -> *mut u8 {
        // SAFETY: guaranteed by the caller.
        unsafe { assert_unchecked(layout.size() != 0) };
        match self.allocate_zeroed(layout) {
            Ok(ptr) => ptr.cast().as_ptr(),
            Err(AllocError) => ptr::null_mut(),
        }
    }

    unsafe fn realloc(&self, ptr: *mut u8, layout: Layout, new_size: usize) -> *mut u8 {
        // SAFETY: guaranteed by the caller.
        unsafe { assert_unchecked(layout.size() != 0) };
        // SAFETY: guaranteed by the caller.
        unsafe { assert_unchecked(new_size != 0) };

        // SAFETY: only non-null pointers can be currently allocated.
        let ptr = unsafe { NonNull::new_unchecked(ptr) };
        let alignment = layout.alignment();
        // SAFETY: the caller must ensure that the `new_size` does not overflow
        // when rounded up to the next multiple of `alignment`.
        let new_layout = unsafe { Layout::from_size_alignment_unchecked(new_size, alignment) };

        // SAFETY:
        // Two preconditions are guaranteed by the caller:
        // * `ptr` is currently allocated with this allocator.
        // * `layout` fits the block of memory.
        // The size precondition is upheld by selecting between `grow` and `shrink`
        // based on the size.
        let ptr = unsafe {
            if new_size >= layout.size() {
                self.grow(ptr, layout, new_layout)
            } else {
                self.shrink(ptr, layout, new_layout)
            }
        };

        match ptr {
            Ok(ptr) => ptr.cast().as_ptr(),
            Err(AllocError) => ptr::null_mut(),
        }
    }
}
