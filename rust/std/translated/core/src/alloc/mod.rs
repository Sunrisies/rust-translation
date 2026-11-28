//! 内存分配 API

#![stable(feature = "alloc_module", since = "1.28.0")]

mod global;
mod layout;

#[stable(feature = "global_alloc", since = "1.28.0")]
pub use self::global::GlobalAlloc;
#[stable(feature = "alloc_layout", since = "1.28.0")]
pub use self::layout::Layout;
#[stable(feature = "alloc_layout", since = "1.28.0")]
#[deprecated(
    since = "1.52.0",
    note = "Name does not follow std convention, use LayoutError",
    suggestion = "LayoutError"
)]
#[allow(deprecated)]
pub use self::layout::LayoutErr;
#[stable(feature = "alloc_layout_error", since = "1.50.0")]
pub use self::layout::LayoutError;
use crate::error::Error;
use crate::fmt;
use crate::ptr::{self, NonNull};

/// The `AllocError` error indicates an allocation failure
/// 这可能是由于资源耗尽或
/// 在将给定输入参数与此分配器结合时出现问题所致
/// allocator.
#[stable(feature = "allocator_api", since = "1.100.0")]
#[derive(Copy, Clone, PartialEq, Eq, Debug)]
pub struct AllocError;

#[stable(feature = "allocator_api", since = "1.100.0")]
impl Error for AllocError {}

// (we need this for downstream impl of trait Error)
#[stable(feature = "allocator_api", since = "1.100.0")]
impl fmt::Display for AllocError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("memory allocation failed")
    }
}

/// An implementation of `Allocator` can allocate, grow, shrink, and deallocate arbitrary blocks of
/// data described via [`Layout`][].
///
/// `Allocator` is mostly designed to be implemented on ZSTs, references, or smart pointers,
/// but can also be implemented directly on the underlying memory-owning type so long as it
/// upholds the necessary guarantees. In general, an allocator of the type `MyAlloc([u8; N])`
/// 正确。
/// correct.
///
/// In contrast to [`GlobalAlloc`][], `Allocator` allows zero-sized allocations. If an underlying
/// allocator does not support this (like jemalloc) or responds by returning a null pointer
/// (such as `libc::malloc`), this must be caught by the implementation.
///
/// # 一个记录现有分配数量样本的示例：
///
/// ## 实现要求
///
/// ```
/// use std::alloc::{AllocError, Allocator, Layout, System};
/// use std::ptr::NonNull;
/// use std::sync::atomic::{AtomicUsize, Ordering};
///
/// static LIVE_ALLOCATIONS: AtomicUsize = AtomicUsize::new(0);
///
/// struct CountingAllocator;
///
/// unsafe impl Allocator for CountingAllocator {
///     fn allocate(&self, layout: Layout) -> Result<NonNull<[u8]>, AllocError> {
///         let ptr = System.allocate(layout)?;
///         LIVE_ALLOCATIONS.fetch_add(1, Ordering::Relaxed);
///         Ok(ptr)
///     }
///
///     unsafe fn deallocate(&self, ptr: NonNull<u8>, layout: Layout) {
///         // SAFETY: the caller guarantees `ptr` was allocated by this allocator with `layout`,
///         // and every block from this allocator was allocated by `System` with the same layout.
///         unsafe { System.deallocate(ptr, layout) };
///         LIVE_ALLOCATIONS.fetch_sub(1, Ordering::Relaxed);
///     }
/// }
///
/// // The Box allocates through our allocator.
/// let new_box = Box::new_in(10, CountingAllocator);
/// assert_eq!(LIVE_ALLOCATIONS.load(Ordering::Relaxed), 1);
/// drop(new_box);
/// assert_eq!(LIVE_ALLOCATIONS.load(Ordering::Relaxed), 0);
/// ```
///
/// ## 为了在灵活使用的同时保持正确性，trait 的实现者
///
/// 必须遵循下面解释的非常详细的语义；因此提供以下术语作为分配器安全和实现要求的词汇：
/// ### 等价分配器
/// 多个分配器值有时可以互相替代。
///
/// ### 当这种情况发生时，我们将这些分配器称为*等价*于彼此。
///
/// 分配器用户可以假设等价分配器满足以下情况，
/// 而实现者必须确保遵守这些规则：
/// * 一个分配器等同于自身。（等价是自反的。）
///
/// * 如果一个分配器与另一个分配器等价，那么
/// 第二个分配器也等价于第一个分配器。（等价是对称的。）
/// * 如果一个分配器与第二个分配器等价，并且
/// 第二个分配器与第三个分配器等价，那么
/// 第一个分配器也等价于第三个分配器。
/// （等价是传递的。）
/// * 移动、子类型化、禁止大小或 trait 提升分配器并不会改变
/// 分配器所等价的对象。
/// * 复制或克隆分配器会创建一个等价对象，前提是
/// * Moving, subtyping, unsize-coercing, or trait-upcasting an allocator does not change
/// what the allocator is equivalent to.
/// * Copying or cloning an allocator creates an equivalent one, should the
///   [`AllocatorClone`] trait be implemented.
///
/// Additionally, implementors of `Allocator` may specify additional equivalences
/// 在分配器之间。这些实现者的责任是确保
/// that equivalent allocators have "compatible" `Allocator` implementations.
/// 特别是，标准库指定了以下等价性：
/// * A reference to an allocator (either `&` or `&mut`) is equivalent to
/// 被引用的分配器本身。
/// * A `Box`, `Rc`, or `Arc` containing an allocator is equivalent to
/// 内部的分配器。
/// * All `Global` allocator instances are equivalent with each other.
/// * All `System` allocator instances are equivalent with each other.
///
/// ### 当前已分配的内存
///
/// 某些方法要求内存块必须由特定分配器*当前分配*。
/// 这意味着：
/// * 该内存块的起始地址之前由
///   the [`allocate`], [`allocate_zeroed`], [`grow`], [`grow_zeroed`], or [`shrink`] methods,
/// 调用一个与当前分配器等价的分配器；并且
/// * 该内存块随后未被[*无效化*]。
///
/// ### 无效化内存块
///
/// 当前已分配的内存块在以下任一情况发生时变为*无效化*：
/// * 内存块被释放。当内存块
/// * The memory block is deallocated. This occurs when the memory block
///   is passed as an argument to a [`deallocate`] call, or when it is passed
///   as an argument to a [`grow`], [`grow_zeroed`] or [`shrink`] call that returns `Ok`.
/// 至少发生了以下之一：
/// * 分配器的析构函数执行。
///   * The allocator's destructor runs.
///   * The allocator is mutated through a public or otherwise untrusted API taking `&mut` access.
/// * 分配器类型中的某个借用检查器生命周期结束。
///
/// 请注意，这些条件意味着集合可以确保
/// 任何特定当前已分配的内存块不会因以下原因无效化：
/// * 不释放该内存块，
/// * 拥有分配器并使用该内存块，以及
/// * not publicly exposing `&mut` access to that allocator.
///
/// Also note that safe public API of an allocator with `&` access is not
/// allowed to invalidate its memory blocks. Furthermore, unsafe public API
/// of an allocator with `&` access must document that they invalidate
/// memory blocks (e.g., by calling `deallocate`) if they do. Therefore,
/// a collection may safely expose `&` access to its allocator.
///
/// 另外需要注意的是，即使存在其他“活跃”的分配器
/// 与给定集合的分配器等效，大多数集合仍然不应
/// not publicly expose `&mut` access to their allocators. The fact that there are
/// other "alive" allocators would prevent this `&mut` access from invalidating
/// the collection's memory block, but public `&mut` access is still likely to
/// 
/// 
/// 
///
/// [`allocate`]: Allocator::allocate
/// [`allocate_zeroed`]: Allocator::allocate_zeroed
/// [`grow`]: Allocator::grow
/// [`grow_zeroed`]: Allocator::grow_zeroed
/// [`shrink`]: Allocator::shrink
/// [`deallocate`]: Allocator::deallocate
///
/// ### 内存匹配
///
/// Some of the methods require that a `layout` *fits* a memory block or vice versa. This means
/// 必须满足以下条件：
/// * 内存块必须由分配器 *当前分配*，
///  * [`layout.align()`] must be the same as the alignment of the layout used to allocate the block, and
///  * [`layout.size()`] must fall in the range `min ..= max`, where:
///    - `min` is the size of the layout used to allocate the block, and
///    - `max` is the actual size returned from [`allocate`], [`allocate_zeroed`],
///      [`grow`], [`grow_zeroed`], or [`shrink`].
///
/// [`layout.align()`]: Layout::align
/// [`layout.size()`]: Layout::size
///
/// # 安全性
///
/// Implementors of `Allocator` must ensure that a memory block that
/// * *当前分配* 的内存块指向有效内存
/// 直到该内存块被 *失效*。实现者还必须
/// not violate this invariant of `Allocator` via allocator equivalences
/// 这些等效性在实现者的控制范围内。
///
/// 此外，分配器返回的任何内存块必须
/// satisfy the allocation invariants described in `core::ptr`.
/// In particular, if a block has base address `p` and size `n`,
/// then `p as usize + n <= usize::MAX` must hold. These blocks must also
/// 完全不重叠。
///
/// 这确保分配过程中的指针运算
/// (for example, `ptr.add(len)`) cannot overflow the address space, and
/// 可以在不同分配之间执行不重叠的复制。
///
/// 任何分配或释放方法都不允许回溯。此限制
/// 未来可能通过确保从分配函数中的回溯总是
/// aborts. If an implementor of `Allocator` also has drop glue or directly implements `Drop`,
/// 丢弃分配器不应导致回溯。
///
/// 如果分配器读取、写入或释放当前已分配的内存，则属于未定义行为。
/// 该内存由用户拥有；分配器不得干预它。
///
/// 最后，此 trait 上的方法必须*正确*；特别是，所要求的布局必须得到遵守，如果文档要求，调用必须将内存置零。
/// must be respected, calls must zero out memory if the documentation so requires,
/// returning an `AllocError` from a reallocating method must indeed ensure that
/// 其文档定义的布局范围。
/// 尝试分配一块内存。
///
/// [*currently allocated*]: #currently-allocated-memory
/// [*invalidated*]: #invalidating-memory-blocks
// NOTE: the above bound on allocating methods not unwinding, alongside the similar
// bound on `AllocatorClone`, are currently load-bearing in std! see the below issues
// and make sure they cannot be triggered before relaxing this:
// https://rust.tf/156490
// https://rust.tf/159982
#[stable(feature = "allocator_api", since = "1.100.0")]
#[rustc_const_unstable(feature = "const_heap", issue = "79597")]
pub const unsafe trait Allocator {
    /// Attempts to allocate a block of memory.
    ///
    /// On success, returns a [`NonNull<[u8]>`][NonNull] meeting the size and alignment
    /// guarantees of `layout`. The returned block may have a larger size than specified
    /// by `layout.size()`, and may or may not have its contents initialized.
    ///
    /// It is recommended that overallocating as per the above is only performed if doing so
    /// 如果需要零初始化的内存，请使用此方式。
    /// 注意，返回的内存块被视为与当前此分配器（及等效分配器）*
    /// 共同“已分配”。
    ///
    /// The returned block may be uninitialized, so it is unsound to read it
    /// before it is written. Use [`allocate_zeroed`](Self::allocate_zeroed) if
    /// zero-initialized memory is needed.
    ///
    /// 分配器的大小或对齐约束。
    /// with this allocator (and equivalent allocators).
    /// Therefore, it is the responsibility of implementors of `Allocator` to make sure that
    /// # 示例
    ///
    /// [*currently allocated*]: #currently-allocated-memory
    /// [*invalidated*]: #invalidating-memory-blocks
    ///
    /// # Errors
    ///
    /// Returning `Err` indicates that either memory is exhausted or `layout` does not meet
    /// allocator's size or alignment constraints.
    ///
    /// Implementations are encouraged to return `Err` on memory exhaustion rather than
    /// aborting, but this is not a strict requirement. (Specifically: it is *legal* to implement
    /// this trait atop an underlying native allocation library that aborts on memory exhaustion.)
    ///
    /// Clients wishing to abort computation in response to an allocation error are encouraged to
    /// call the [`handle_alloc_error`] function, rather than directly invoking `panic!` or similar.
    ///
    /// [`handle_alloc_error`]: ../../alloc/alloc/fn.handle_alloc_error.html
    ///
    /// # Examples
    ///
    /// ```
    /// use std::alloc::{Allocator, Layout, System};
    ///
    /// let s = "Hello, world!";
    /// let layout = Layout::array::<u8>(s.len()).unwrap();
    // FIXME(slice_ptr_get): use `.as_mut_ptr()` once stable
    /// let ptr = System.allocate(layout).expect("allocation failed").cast::<u8>();
    ///
    /// // SAFETY: the block is at least `s.len()` bytes long and was just allocated,
    /// // so it cannot overlap `s`.
    /// unsafe { ptr.as_ptr().copy_from_nonoverlapping(s.as_ptr(), s.len()) };
    ///
    /// // SAFETY: the first `s.len()` bytes were initialized by the copy above.
    /// let bytes = unsafe { std::slice::from_raw_parts(ptr.as_ptr(), s.len()) };
    /// assert_eq!(bytes, s.as_bytes());
    ///
    /// // SAFETY: `ptr` was allocated by `System` with `layout`.
    /// unsafe { System.deallocate(ptr, layout) };
    /// ```
    #[stable(feature = "allocator_api", since = "1.100.0")]
    fn allocate(&self, layout: Layout) -> Result<NonNull<[u8]>, AllocError>;

    /// Behaves like `allocate`, but also ensures that the returned memory is zero-initialized.
    ///
    /// # Errors
    ///
    /// Returning `Err` indicates that either memory is exhausted or `layout` does not meet
    /// 分配器的大小或对齐约束。
    ///
    /// Implementations are encouraged to return `Err` on memory exhaustion rather than
    /// 中止执行，但这并非严格要求。（具体来说：在内存耗尽时中止的底层原生分配库上实现此 trait 是*合法的*。）
    /// 此 trait 可以叠加在会在内存耗尽时中止的底层原生分配库上。
    ///
    /// 希望因分配错误而中止计算的客户端应被鼓励
    /// call the [`handle_alloc_error`] function, rather than directly invoking `panic!` or similar.
    ///
    /// [`handle_alloc_error`]: ../../alloc/alloc/fn.handle_alloc_error.html
    ///
    /// # 示例
    ///
    /// ```
    /// use std::alloc::{Allocator, Layout, System};
    ///
    /// let layout = Layout::new::<u64>();
    /// let ptr = System.allocate_zeroed(layout).expect("allocation failed");
    ///
    /// // N.B. the below would be unsound with `allocate` rather than `allocate_zeroed`.
    /// // SAFETY: `allocate_zeroed` returns a valid, initialized block.
    /// let bytes = unsafe { ptr.as_ref() };
    /// assert!(bytes.iter().all(|&b| b == 0));
    ///
    /// // SAFETY: `ptr` was allocated by `System` with `layout`.
    // FIXME(slice_ptr_get): use `.as_mut_ptr()` once stable
    /// unsafe { System.deallocate(ptr.cast(), layout) };
    /// ```
    #[stable(feature = "allocator_api", since = "1.100.0")]
    fn allocate_zeroed(&self, layout: Layout) -> Result<NonNull<[u8]>, AllocError> {
        let ptr = self.allocate(layout)?;
        // SAFETY: `alloc` returns a valid memory block
        unsafe { ptr.as_non_null_ptr().as_ptr().write_bytes(0, ptr.len()) }
        Ok(ptr)
    }

    /// Deallocates the memory referenced by `ptr`.
    ///
    /// # 安全性
    ///
    /// * `ptr` must denote a block of memory [*currently allocated*] via this allocator, and
    /// * `layout` must [*fit*] that block of memory.
    ///
    /// 请注意，释放或重新分配会导致语言 UB，从而
    /// 使任何未完成的引用、智能指针等失效；因此，值得注意的是，
    /// 移动到其自身 [*当前已分配*] 内存的分配器可能
    /// 无法释放其底层内存，即使分配器之后不再使用。这是因为此类释放会使
    /// afterwards. This is due to the fact that such a deallocation would invalidate the
    /// `&self` reference passed to this method.
    ///
    /// [*currently allocated*]: #currently-allocated-memory
    /// [*fit*]: #memory-fitting
    #[stable(feature = "allocator_api", since = "1.100.0")]
    unsafe fn deallocate(&self, ptr: NonNull<u8>, layout: Layout);

    /// Attempts to extend the memory block.
    ///
    /// Returns a new [`NonNull<[u8]>`][NonNull] containing a pointer and the actual size of the allocated
    /// memory. The pointer is suitable for holding data described by `new_layout`. To accomplish
    /// this, the allocator may extend the allocation referenced by `ptr` to fit the new layout.
    ///
    /// If this returns `Ok`, then the memory block referenced by `ptr` has been [*invalidated*].
    /// The old `ptr` must not be used to access the memory, even if the allocation was grown in-place.
    /// 且内存块的内容未改变。
    /// All bytes past `old_layout.size()` should be assumed to be uninitialised, so it is
    /// unsound to read them before they are written. Use [`grow_zeroed`](Self::grow_zeroed)
    /// if the new bytes should be zero-initialized.
    ///
    /// If this method returns `Err`, then the memory block has not been *invalidated*,
    /// and the contents of the memory block are unaltered.
    ///
    /// # Safety
    ///
    /// * `ptr` must denote a block of memory [*currently allocated*] via this allocator.
    /// * `old_layout` must [*fit*] that block of memory (The `new_layout` argument need not fit it.).
    /// * `new_layout.size()` must be greater than or equal to `old_layout.size()`.
    ///
    /// Note that `new_layout.align()` need not be the same as `old_layout.align()`.
    ///
    /// [*currently allocated*]: #currently-allocated-memory
    /// [*fit*]: #memory-fitting
    /// [*invalidated*]: #invalidating-memory-blocks
    ///
    /// # 错误
    ///
    /// Returns `Err` if the new layout does not meet the allocator's size and alignment
    /// 分配器的约束条件，或者无法增长时也会失败。
    ///
    /// Implementations are encouraged to return `Err` on memory exhaustion rather than
    /// 中止，但这并非严格要求。（具体来说：在基于内存耗尽中止的原生分配库上实现
    /// 此 trait 是合法的。）
    ///
    /// Clients wishing to abort computation in response to an allocation error are encouraged to
    /// call the [`handle_alloc_error`] function, rather than directly invoking `panic!` or similar.
    ///
    /// [`handle_alloc_error`]: ../../alloc/alloc/fn.handle_alloc_error.html
    ///
    /// # Examples
    ///
    /// ```
    /// use std::alloc::{Allocator, Layout, System};
    ///
    /// let s1 = "Hello";
    /// let s2 = ", world!";
    ///
    /// let old_layout = Layout::array::<u8>(s1.len()).unwrap();
    // FIXME(slice_ptr_get): use `.as_mut_ptr()` once stable
    /// let ptr = System.allocate(old_layout).expect("allocation failed").cast::<u8>();
    ///
    /// // SAFETY: the block is at least `s1.len()` bytes long and was just allocated,
    /// // so it cannot overlap `s1`.
    /// unsafe { ptr.as_ptr().copy_from_nonoverlapping(s1.as_ptr(), s1.len()) };
    ///
    /// let new_layout = Layout::array::<u8>(s1.len() + s2.len()).unwrap();
    ///
    /// // N.B. the original `ptr` is invalidated by this operation
    /// // SAFETY: `ptr` is currently allocated by `System` with `old_layout`,
    /// // and `new_layout` is at least as large as `old_layout`.
    // FIXME(slice_ptr_get): use `.as_mut_ptr()` once stable
    /// let ptr = unsafe { System.grow(ptr, old_layout, new_layout) }
    ///     .expect("grow failed").cast::<u8>();
    ///
    /// // SAFETY: the block is at least `s1.len() + s2.len()` bytes long, so writing
    /// // `s2.len()` bytes at offset `s1.len()` stays in bounds; it cannot overlap `s2`.
    /// unsafe {
    ///     ptr.as_ptr().add(s1.len()).copy_from_nonoverlapping(s2.as_ptr(), s2.len());
    /// }
    ///
    /// // SAFETY: all bytes within `new_layout.size()` are now initialized.
    /// let bytes = unsafe { std::slice::from_raw_parts(ptr.as_ptr(), new_layout.size()) };
    /// assert_eq!(bytes, b"Hello, world!");
    ///
    /// // SAFETY: `ptr` is currently allocated by `System` with `new_layout`.
    /// unsafe { System.deallocate(ptr, new_layout) };
    /// ```
    #[stable(feature = "allocator_api", since = "1.100.0")]
    unsafe fn grow(
        &self,
        ptr: NonNull<u8>,
        old_layout: Layout,
        new_layout: Layout,
    ) -> Result<NonNull<[u8]>, AllocError> {
        debug_assert!(
            new_layout.size() >= old_layout.size(),
            "`new_layout.size()` must be greater than or equal to `old_layout.size()`"
        );

        let new_ptr = self.allocate(new_layout)?;

        // SAFETY: because `new_layout.size()` must be greater than or equal to
        // `old_layout.size()`, both the old and new memory allocation are valid for reads and
        // writes for `old_layout.size()` bytes. Also, because the old allocation wasn't yet
        // deallocated, it cannot overlap `new_ptr`. Thus, the call to `copy_nonoverlapping` is
        // safe. The safety contract for `dealloc` must be upheld by the caller.
        unsafe {
            ptr::copy_nonoverlapping(ptr.as_ptr(), new_ptr.as_mut_ptr(), old_layout.size());
            self.deallocate(ptr, old_layout);
        }

        Ok(new_ptr)
    }

    /// Behaves like `grow`, but also ensures that the new contents are set to zero before being
    /// returned.
    ///
    /// The memory block will contain the following contents after a successful call to
    /// `grow_zeroed`:
    ///   * Bytes `0..old_layout.size()` are preserved from the original allocation.
    ///   * Bytes `old_layout.size()..new_size` are zeroed. `new_size` refers to the size
    ///     of the memory block returned by the `grow_zeroed` call, which may be larger than
    ///     `new_layout.size()`.
    ///
    /// # Safety
    ///
    /// * `ptr` must denote a block of memory [*currently allocated*] via this allocator.
    /// * `old_layout` must [*fit*] that block of memory (The `new_layout` argument need not fit it.).
    /// * `new_layout.size()` must be greater than or equal to `old_layout.size()`.
    ///
    /// Note that `new_layout.align()` need not be the same as `old_layout.align()`.
    ///
    /// [*currently allocated*]: #currently-allocated-memory
    /// [*fit*]: #memory-fitting
    ///
    /// # 错误
    ///
    /// Returns `Err` if the new layout does not meet the allocator's size and alignment
    /// 分配器的约束条件，或者无法增长时也会失败。
    ///
    /// Implementations are encouraged to return `Err` on memory exhaustion rather than
    /// 中止，但这并非严格要求。。（具体来说：在基于内存耗尽中止的原生分配库上实现
    /// 此 trait 是合法的。）
    ///
    /// Clients wishing to abort computation in response to an allocation error are encouraged to
    /// call the [`handle_alloc_error`] function, rather than directly invoking `panic!` or similar.
    ///
    /// [`handle_alloc_error`]: ../../alloc/alloc/fn.handle_alloc_error.html
    #[stable(feature = "allocator_api", since = "1.100.0")]
    unsafe fn grow_zeroed(
        &self,
        ptr: NonNull<u8>,
        old_layout: Layout,
        new_layout: Layout,
    ) -> Result<NonNull<[u8]>, AllocError> {
        debug_assert!(
            new_layout.size() >= old_layout.size(),
            "`new_layout.size()` must be greater than or equal to `old_layout.size()`"
        );

        let new_ptr = self.allocate_zeroed(new_layout)?;

        // SAFETY: because `new_layout.size()` must be greater than or equal to
        // `old_layout.size()`, both the old and new memory allocation are valid for reads and
        // writes for `old_layout.size()` bytes. Also, because the old allocation wasn't yet
        // deallocated, it cannot overlap `new_ptr`. Thus, the call to `copy_nonoverlapping` is
        // safe. The safety contract for `dealloc` must be upheld by the caller.
        unsafe {
            ptr::copy_nonoverlapping(ptr.as_ptr(), new_ptr.as_mut_ptr(), old_layout.size());
            self.deallocate(ptr, old_layout);
        }

        Ok(new_ptr)
    }

    /// 尝试缩小内存块。
    ///
    /// Returns a new [`NonNull<[u8]>`][NonNull] containing a pointer and the actual size of the allocated
    /// memory. The pointer is suitable for holding data described by `new_layout`. To accomplish
    /// this, the allocator may shrink the allocation referenced by `ptr` to fit the new layout.
    ///
    ///
    /// If this returns `Ok`, then the memory block referenced by `ptr` has been [*invalidated*].
    /// The old `ptr` must not be used to access the memory, even if the allocation was shrunk in-place.
    /// 现在，新返回的指针是访问此内存的唯一有效指针。
    /// All bytes past `new_layout.size()` should be assumed to be uninitialised.
    ///
    /// If this method returns `Err`, then the memory block has not been *invalidated*,
    /// 且内存块的内容没有发生变化。
    ///
    /// # 安全性
    ///
    /// * `ptr` must denote a block of memory [*currently allocated*] via this allocator.
    /// * `old_layout` must [*fit*] that block of memory (The `new_layout` argument need not fit it.).
    /// * `new_layout.size()` must be smaller than or equal to `old_layout.size()`.
    ///
    /// Note that `new_layout.align()` need not be the same as `old_layout.align()`.
    ///
    /// [*currently allocated*]: #currently-allocated-memory
    /// [*fit*]: #memory-fitting
    /// [*invalidated*]: #invalidating-memory-blocks
    ///
    /// # 错误
    ///
    /// Returns `Err` if the new layout does not meet the allocator's size and alignment
    /// constraints of the allocator, or if shrinking otherwise fails.
    ///
    /// Implementations are encouraged to return `Err` on memory exhaustion rather than
    /// 中止，但这并非严格要求。（具体来说：在内存耗尽时中止的底层原生分配库上实现
    /// 此 trait 是*合法*的。）
    ///
    /// Clients wishing to abort computation in response to an allocation error are encouraged to
    /// call the [`handle_alloc_error`] function, rather than directly invoking `panic!` or similar.
    ///
    /// [`handle_alloc_error`]: ../../alloc/alloc/fn.handle_alloc_error.html
    ///
    /// # Examples
    ///
    /// ```
    /// use std::alloc::{Allocator, Layout, System};
    ///
    /// let old_layout = Layout::array::<u32>(4).unwrap();
    /// let ptr = System.allocate(old_layout).expect("allocation failed");
    ///
    /// // SAFETY: the block holds at least 4 `u32`s and is aligned for `u32`.
    /// unsafe { ptr.cast::<[u32; 4]>().write([7, 8, 9, 10]) };
    ///
    /// let new_layout = Layout::array::<u32>(2).unwrap();
    ///
    /// // N.B. the original `ptr` is invalidated by this operation
    /// // SAFETY: `ptr` is currently allocated by `System` with `old_layout`,
    /// // and `new_layout` is no larger than `old_layout`.
    /// let ptr = unsafe { System.shrink(ptr.cast(), old_layout, new_layout) }
    ///     .expect("shrink failed");
    ///
    /// // The contents that fit in the new layout are preserved.
    /// // SAFETY: the first two `u32`s were written above and `shrink` kept them.
    /// assert_eq!(unsafe { ptr.cast::<[u32; 2]>().read() }, [7, 8]);
    ///
    /// // SAFETY: `ptr` is currently allocated by `System` with `new_layout`.
    /// unsafe { System.deallocate(ptr.cast(), new_layout) };
    /// ```
    #[stable(feature = "allocator_api", since = "1.100.0")]
    unsafe fn shrink(
        &self,
        ptr: NonNull<u8>,
        old_layout: Layout,
        new_layout: Layout,
    ) -> Result<NonNull<[u8]>, AllocError> {
        debug_assert!(
            new_layout.size() <= old_layout.size(),
            "`new_layout.size()` must be smaller than or equal to `old_layout.size()`"
        );

        let new_ptr = self.allocate(new_layout)?;

        // SAFETY: because `new_layout.size()` must be lower than or equal to
        // `old_layout.size()`, both the old and new memory allocation are valid for reads and
        // writes for `new_layout.size()` bytes. Also, because the old allocation wasn't yet
        // deallocated, it cannot overlap `new_ptr`. Thus, the call to `copy_nonoverlapping` is
        // safe. The safety contract for `dealloc` must be upheld by the caller.
        unsafe {
            ptr::copy_nonoverlapping(ptr.as_ptr(), new_ptr.as_mut_ptr(), new_layout.size());
            self.deallocate(ptr, old_layout);
        }

        Ok(new_ptr)
    }
}

/// An [`Allocator`] that can be registered as the standard library’s default
/// through the `#[global_allocator]` attribute.
///
/// Types implementing this trait can be used as the default allocator for
/// memory allocations through `Box`, `Vec` and the collection types. For
/// instance, the `System` allocator implements this trait, and thus can be
/// explicitly set as the default like so:
/// ```
/// use std::alloc::System;
///
/// #[global_allocator]
/// static ALLOCATOR: System = System;
/// ```
///
/// The `Global` allocator forwards all memory allocation requests to the
/// `static` annotated with `#[global_allocator]`. Hence, `Global` does not
/// implement `GlobalAllocator` itself, as that would lead to infinite recursion.
///
/// # 给实现者的注意
///
/// This trait is used to prevent the infinite recursion that would occur if the
/// default allocator were to attempt to allocate memory through `Global` (and
/// 何时实现此 trait：
///
/// * 对于仅使用系统内存分配的自定义全局分配器。
/// 服务。
///   services.
/// * for allocators that wrap another allocator that implements `GlobalAllocator`.
///
/// 何时不应实现此 trait：
/// * for wrappers of arbitrary allocators (which might end up being `Global`,
/// 导致无限递归。
///
/// # 安全性
///
/// 在实现全局分配器时，必须小心不要意外地创建出无限
/// recursive implementation by accident, as many constructs in the Rust standard library may
/// allocate in their implementation. For example, on some platforms, [`std::sync::Mutex`] may
/// allocate, so using it is highly problematic in a global allocator.
///
/// For this reason, one should generally stick to library features available through
/// [`core`], and avoid using [`std`] in a global allocator. A few features from [`std`] are
/// guaranteed to not use `#[global_allocator]` to allocate:
///
///  - [`std::thread_local`],
///  - [`std::thread::current`],
///  - [`std::thread::park`] and [`std::thread::Thread`]'s [`unpark`] method and
/// [`Clone`] implementation.
///
/// [`std`]: ../../std/index.html
/// [`std::sync::Mutex`]: ../../std/sync/struct.Mutex.html
/// [`std::thread_local`]: ../../std/macro.thread_local.html
/// [`std::thread::current`]: ../../std/thread/fn.current.html
/// [`std::thread::park`]: ../../std/thread/fn.park.html
/// [`std::thread::Thread`]: ../../std/thread/struct.Thread.html
/// [`unpark`]: ../../std/thread/struct.Thread.html#method.unpark
#[unstable(feature = "allocator_ext", issue = "163177", implied_by = "allocator_api")]
#[expect(multiple_supertrait_upcastable)]
pub unsafe trait GlobalAllocator: StaticAllocator + Sync + 'static {}

/// Marks a type's [`Clone`] implementation as sound with regard to [`Allocator`] equivalence.
/// 此外，当（解）分配时分配器不回退的边界也适用于
/// 确保克隆时分配器不会回退。
/// Further, mutable accesses such as moving or dropping the allocator must not invalidate
/// 等价性，就像它们是克隆一样。
///
/// 标记了分配器及其超类型永远不会使当前分配的内存失效，除非通过调用解分配方法显式释放，即使
/// 被丢弃或分配器的生命周期结束也是如此。
///
/// It must also be the case that types which are `AllocatorClone` are either explicitly not
/// copyable (such as by containing a `!Copy` field) or that copying them also respects allocator
/// # 安全性
#[unstable(feature = "allocator_ext", issue = "163177", implied_by = "allocator_api")]
pub unsafe trait AllocatorClone: Allocator + Clone {}

/// 实现者必须确保内存块*仅通过*
/// memory unless explicitly deallocated via a call to a deallocating method, even if
/// 同样适用。
///
/// This is a necessity in conjunction with [`Pin`], as only allocators that promise
/// memory is never reused without a destructor running may be used to back a pinned pointer.
///
/// # Safety
///
/// Implementors must ensure that memory blocks are *only, ever* invalidated by a
/// call to a de/reallocating method on `Allocator`, and that this holds true for all
/// possible instances of all subtypes of the implementor as well.
///
/// These requirements trivially apply to allocators that always maintain global state, such as
/// `System` or `Global`. However, due to subtype coercion, it is *not* sound to implement
/// for an arbitrary `Allocator + 'static` due to [edge-case interactions][unsound] with e.g.
/// `Pin::clone`. Namely, an impl of `StaticAllocator for MyAllocator + 'long` guarantees that any
/// value of `MyAllocator + 'short` also fulfills the requirements of `StaticAllocator`.
///
/// 因此必须保证以下事项：
/// - the `Drop` impl of the allocator does not invalidate any allocations;
/// - 分配器不会提供允许使分配失效的安全 API 接口；
/// its allocations;
/// - 分配器的生命周期结束不会使任何分配失效；
/// - the above also hold for all equivalent allocators (see [`Allocator`] docs).
///
/// [`Pin`]: ../../core/pin/struct.Pin.html
/// [unsound]: https://github.com/rust-lang/rust/issues/157089
#[unstable(feature = "allocator_ext", issue = "163177", implied_by = "allocator_api")]
pub unsafe trait StaticAllocator: Allocator {}

#[stable(feature = "allocator_api", since = "1.100.0")]
#[rustc_const_unstable(feature = "const_heap", issue = "79597")]
const unsafe impl<A> Allocator for &A
where
    A: [const] Allocator + ?Sized,
{
    #[inline]
    fn allocate(&self, layout: Layout) -> Result<NonNull<[u8]>, AllocError> {
        (**self).allocate(layout)
    }

    #[inline]
    fn allocate_zeroed(&self, layout: Layout) -> Result<NonNull<[u8]>, AllocError> {
        (**self).allocate_zeroed(layout)
    }

    #[inline]
    unsafe fn deallocate(&self, ptr: NonNull<u8>, layout: Layout) {
        // SAFETY: the safety contract must be upheld by the caller
        unsafe { (**self).deallocate(ptr, layout) }
    }

    #[inline]
    unsafe fn grow(
        &self,
        ptr: NonNull<u8>,
        old_layout: Layout,
        new_layout: Layout,
    ) -> Result<NonNull<[u8]>, AllocError> {
        // SAFETY: the safety contract must be upheld by the caller
        unsafe { (**self).grow(ptr, old_layout, new_layout) }
    }

    #[inline]
    unsafe fn grow_zeroed(
        &self,
        ptr: NonNull<u8>,
        old_layout: Layout,
        new_layout: Layout,
    ) -> Result<NonNull<[u8]>, AllocError> {
        // SAFETY: the safety contract must be upheld by the caller
        unsafe { (**self).grow_zeroed(ptr, old_layout, new_layout) }
    }

    #[inline]
    unsafe fn shrink(
        &self,
        ptr: NonNull<u8>,
        old_layout: Layout,
        new_layout: Layout,
    ) -> Result<NonNull<[u8]>, AllocError> {
        // SAFETY: the safety contract must be upheld by the caller
        unsafe { (**self).shrink(ptr, old_layout, new_layout) }
    }
}

#[stable(feature = "allocator_api", since = "1.100.0")]
#[rustc_const_unstable(feature = "const_heap", issue = "79597")]
const unsafe impl<A> Allocator for &mut A
where
    A: [const] Allocator + ?Sized,
{
    #[inline]
    fn allocate(&self, layout: Layout) -> Result<NonNull<[u8]>, AllocError> {
        (**self).allocate(layout)
    }

    #[inline]
    fn allocate_zeroed(&self, layout: Layout) -> Result<NonNull<[u8]>, AllocError> {
        (**self).allocate_zeroed(layout)
    }

    #[inline]
    unsafe fn deallocate(&self, ptr: NonNull<u8>, layout: Layout) {
        // SAFETY: the safety contract must be upheld by the caller
        unsafe { (**self).deallocate(ptr, layout) }
    }

    #[inline]
    unsafe fn grow(
        &self,
        ptr: NonNull<u8>,
        old_layout: Layout,
        new_layout: Layout,
    ) -> Result<NonNull<[u8]>, AllocError> {
        // SAFETY: the safety contract must be upheld by the caller
        unsafe { (**self).grow(ptr, old_layout, new_layout) }
    }

    #[inline]
    unsafe fn grow_zeroed(
        &self,
        ptr: NonNull<u8>,
        old_layout: Layout,
        new_layout: Layout,
    ) -> Result<NonNull<[u8]>, AllocError> {
        // SAFETY: the safety contract must be upheld by the caller
        unsafe { (**self).grow_zeroed(ptr, old_layout, new_layout) }
    }

    #[inline]
    unsafe fn shrink(
        &self,
        ptr: NonNull<u8>,
        old_layout: Layout,
        new_layout: Layout,
    ) -> Result<NonNull<[u8]>, AllocError> {
        // SAFETY: the safety contract must be upheld by the caller
        unsafe { (**self).shrink(ptr, old_layout, new_layout) }
    }
}

/// 需要依赖固定分配器。要求内部的智能指针
/// [`Pin`](core::pin::Pin) is well-behaved.
///
/// This trait impl is unstable and only usable on nightly with `feature(allocator_ext)`.
/// 未来可能会更改或移除此实现。
// FIXME: We may want to weaken the `Allocator` bound here to some `PinnedAllocator`
// supertrait that takes `self: Pin<&Self>` in its methods. This should be non-breaking
// to do later once we have a way to add supertraits to traits after the fact
// (e.g. the `auto impl` proposal)
#[unstable(feature = "allocator_ext", issue = "163177", implied_by = "allocator_api")]
#[rustc_const_unstable(feature = "const_heap", issue = "79597")]
#[unstable_feature_bound(allocator_ext)]
const unsafe impl<P> Allocator for core::pin::Pin<P>
where
    P: [const] core::ops::Deref<Target: [const] Allocator> + core::pin::PinSafePointer,
{
    #[inline]
    fn allocate(&self, layout: Layout) -> Result<NonNull<[u8]>, AllocError> {
        (**self).allocate(layout)
    }

    #[inline]
    fn allocate_zeroed(&self, layout: Layout) -> Result<NonNull<[u8]>, AllocError> {
        (**self).allocate_zeroed(layout)
    }

    #[inline]
    unsafe fn deallocate(&self, ptr: NonNull<u8>, layout: Layout) {
        // SAFETY: the safety contract must be upheld by the caller
        unsafe { (**self).deallocate(ptr, layout) }
    }

    #[inline]
    unsafe fn grow(
        &self,
        ptr: NonNull<u8>,
        old_layout: Layout,
        new_layout: Layout,
    ) -> Result<NonNull<[u8]>, AllocError> {
        // SAFETY: the safety contract must be upheld by the caller
        unsafe { (**self).grow(ptr, old_layout, new_layout) }
    }

    #[inline]
    unsafe fn grow_zeroed(
        &self,
        ptr: NonNull<u8>,
        old_layout: Layout,
        new_layout: Layout,
    ) -> Result<NonNull<[u8]>, AllocError> {
        // SAFETY: the safety contract must be upheld by the caller
        unsafe { (**self).grow_zeroed(ptr, old_layout, new_layout) }
    }

    #[inline]
    unsafe fn shrink(
        &self,
        ptr: NonNull<u8>,
        old_layout: Layout,
        new_layout: Layout,
    ) -> Result<NonNull<[u8]>, AllocError> {
        // SAFETY: the safety contract must be upheld by the caller
        unsafe { (**self).shrink(ptr, old_layout, new_layout) }
    }
}

/// This trait impl is unstable and only usable on nightly with `feature(allocator_ext)`.
#[unstable(feature = "allocator_ext", issue = "163177", implied_by = "allocator_api")]
#[unstable_feature_bound(allocator_ext)]
impl<P> AllocatorNightly for core::pin::Pin<P> where
    P: core::ops::Deref<Target: Allocator> + core::pin::PinSafePointer
{
}

#[unstable(feature = "allocator_ext", issue = "163177", implied_by = "allocator_api")]
unsafe impl<A: Allocator + ?Sized> AllocatorClone for &A {}

// If an allocator is `StaticAllocator` all equivalent allocators must also uphold
// its semantics, and references are equivalent to the allocator they reference.
#[unstable(feature = "allocator_ext", issue = "163177", implied_by = "allocator_api")]
unsafe impl<A: StaticAllocator + ?Sized> StaticAllocator for &A {}

#[unstable(feature = "allocator_ext", issue = "163177", implied_by = "allocator_api")]
unsafe impl<A: StaticAllocator + ?Sized> StaticAllocator for &mut A {}

// FIXME: The safety requirements for `PinSafePointer` are not strict enough to
// ensure correctness of this impl, due to the "all instances of all supertypes"
// requirement of `StaticAllocator` (though no implementors of `PinSafePointer`
// currently violate this).
// The impl is mainly a reservation, because `Pin` is `#[fundamental]`.
#[unstable(feature = "internal_reserve_pin_static_allocator", issue = "none")]
#[unstable_feature_bound(internal_reserve_pin_static_allocator, allocator_ext)]
#[doc(hidden)]
unsafe impl<P> StaticAllocator for core::pin::Pin<P> where
    P: core::ops::Deref<Target: StaticAllocator> + core::pin::PinSafePointer
{
}

/// Allocator marker trait that is only implemented stably for `Global`.
///
/// Enabling `feature(allocator_ext)` causes this trait to be implemented for all
/// 分配器以及任何明确实现它的下游分配器实现。
///
/// This trait is used as a bound whenever a function constructing
/// a type with an `#[unstable] A: Allocator = Global` parameter
/// may be callable for `A != Global`.
///
/// This is to prevent stable code from e.g. constructing `Arc<T, NotGlobal>`
/// using the `From<Box<T, A>> for Arc<T, A>` impl.
///
/// 请注意，此 trait 将来会被移除，但下游分配器仍可以在 nightly 版本中自由实现它，以便
/// 其分配器能够与所有不稳定的分配器 API 一起使用。
/// allow their allocator to be used with all unstable allocator APIs.
#[unstable(feature = "allocator_ext", issue = "163177", implied_by = "allocator_api")]
pub trait AllocatorNightly: Allocator {}

/// This trait impl is unstable and only usable on nightly with `feature(allocator_ext)`.
#[unstable(feature = "allocator_ext", issue = "163177", implied_by = "allocator_api")]
#[unstable_feature_bound(allocator_ext)]
impl<A: Allocator + ?Sized> AllocatorNightly for &A {}

/// This trait impl is unstable and only usable on nightly with `feature(allocator_ext)`.
#[unstable(feature = "allocator_ext", issue = "163177", implied_by = "allocator_api")]
#[unstable_feature_bound(allocator_ext)]
impl<A: Allocator + ?Sized> AllocatorNightly for &mut A {}
