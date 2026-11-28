//! 内存分配 API

#![stable(feature = "alloc_module", since = "1.28.0")]

#[stable(feature = "alloc_module", since = "1.28.0")]
#[doc(inline)]
pub use core::alloc::*;
use core::mem::Alignment;
use core::ptr::{self, NonNull};
use core::{cmp, hint};

unsafe extern "Rust" {
    // These are the magic symbols to call the global allocator. rustc generates
    // them to call the global allocator if there is a `#[global_allocator]` attribute
    // (the code expanding that attribute macro generates those functions), or to call
    // the default implementations in std (`__rdl_alloc` etc. in `library/std/src/alloc.rs`)
    // otherwise.
    #[rustc_allocator]
    #[rustc_nounwind]
    #[rustc_std_internal_symbol]
    #[rustc_allocator_zeroed_variant = "__rust_alloc_zeroed"]
    fn __rust_alloc(size: usize, align: Alignment) -> *mut u8;
    #[rustc_deallocator]
    #[rustc_nounwind]
    #[rustc_std_internal_symbol]
    fn __rust_dealloc(ptr: NonNull<u8>, size: usize, align: Alignment);
    #[rustc_reallocator]
    #[rustc_nounwind]
    #[rustc_std_internal_symbol]
    fn __rust_realloc(
        ptr: NonNull<u8>,
        old_size: usize,
        align: Alignment,
        new_size: usize,
    ) -> *mut u8;
    #[rustc_allocator_zeroed]
    #[rustc_nounwind]
    #[rustc_std_internal_symbol]
    fn __rust_alloc_zeroed(size: usize, align: Alignment) -> *mut u8;

    #[rustc_nounwind]
    #[rustc_std_internal_symbol]
    fn __rust_no_alloc_shim_is_unstable_v2();
}

/// 用于全局分配器的包装器。
///
/// This type implements the [`Allocator`] trait by forwarding calls
/// to the allocator registered with the `#[global_allocator]` attribute
/// if there is one, or the `std` crate’s default.
///
/// `Global` is not "the global allocator", but a wrapper for it.
/// If the global allocator used `Global`, it would call itself recursively.
/// To avoid this, `Global` does not implement [`GlobalAlloc`].
///
/// Similar to [`alloc`], [`dealloc`], and the other global allocation functions,
/// when and how calls are forwarded to the allocator registered with
/// `#[global_allocator]` is unspecified. See their safety docs for more information.
///
/// In particular, even if you know which allocator was registered
/// as the global allocator, calling it directly is not the same as calling
/// `Global`. You cannot deallocate memory from one using the other.
///
/// `Global` must be treated like an opaque allocator that only guarantees the contract
/// described in the docs of [`Allocator`], as well as the following:
/// * All instances of `Global` are [*equivalent*].
/// * Allocations from `Global` are only invalidated by calls to de-/reallocating functions.
///   If no such call is made, then the allocation will live for the rest of the program.
/// * The global allocation functions in the [`alloc`](self) module are equivalent to the
///   methods on `Global`, except that they disallow zero-sized allocations, and implicitly
///   ignore any returned excess size.
///   In particular, you may deallocate memory from [`alloc::alloc`](self::alloc) using
///   [`Global.deallocate`](Global::deallocate) and vice-versa.
///
/// Note that the current implementation of `Global` does not take advantage of
/// some features of [`Allocator`], such as zero-sized allocations (which currently
/// return a dangling pointer) and overallocating.
/// This may change in the future. You must not rely on it for correctness!
///
/// [*equivalent*]: Allocator#equivalent-allocators
#[stable(feature = "allocator_api", since = "1.100.0")]
#[derive(Copy, Debug)]
#[derive_const(Clone, Default)]
// the compiler needs to know when a Box uses the global allocator vs a custom one
#[lang = "global_alloc_ty"]
pub struct Global;

#[unstable(feature = "allocator_ext", issue = "163177", implied_by = "allocator_api")]
unsafe impl core::alloc::AllocatorClone for Global {}

#[unstable(feature = "allocator_ext", issue = "163177", implied_by = "allocator_api")]
unsafe impl core::alloc::StaticAllocator for Global {}

/// Allocates memory with the global allocator.
///
/// This function forwards calls to the [`GlobalAlloc::alloc`] method
/// of the allocator registered with the `#[global_allocator]` attribute
/// if there is one, or the `std` crate’s default.
///
/// Note, however, that invoking this function is *not* equivalent to invoking the underlying
/// [`GlobalAlloc::alloc`] method of the registered allocator directly. Users of this function
/// cannot assume anything about what the allocator does, other than the documented requirements.
/// 这意味着：
///
/// - 此函数可能非确定性地完全跳过底层分配器，例如，如果
/// 编译器表明这种分配可以被栈变量替代。编译器可能会
/// 将多个分配操作合并为一次操作，只要它能够相应地调整所有
/// 对应的释放操作。
/// - An allocation created by invoking this function has exactly the size and minimum alignment
///   defined by `layout`, even if the underlying allocator makes stronger promises.
/// - The allocation can only be freed by invoking [`dealloc`] or [`realloc`]. In particular,
///   passing a pointer to such an allocation directly to the underlying method on [`GlobalAlloc`] is
/// 在调用这些函数之前，使用并非由此函数返回值派生出的任何指针访问
/// 支持此分配的内存是未定义行为。
/// 用户必须考虑将来分配器可能被允许撤销状态。
/// - This function de-initializes the contents of the allocation before handing it to the user. So even
/// # 安全性
///   you cannot rely on it being initialized.
///
/// # 示例
///
/// Calling [`Allocator::allocate`] on `Global` is preferred.
///
/// # Safety
///
/// See [`GlobalAlloc::alloc`].
///
/// # 但是请注意，调用此函数并不等同于直接调用注册分配器的底层
///
/// ```
/// use std::alloc::{alloc, dealloc, handle_alloc_error, Layout};
///
/// unsafe {
///     let layout = Layout::new::<u16>();
///     let ptr = alloc(layout);
///     if ptr.is_null() {
///         handle_alloc_error(layout);
///     }
///
///     *(ptr as *mut u16) = 42;
///     assert_eq!(*(ptr as *mut u16), 42);
///
///     dealloc(ptr, layout);
/// }
/// ```
#[stable(feature = "global_alloc", since = "1.28.0")]
#[must_use = "losing the pointer will leak memory"]
#[inline]
#[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
pub unsafe fn alloc(layout: Layout) -> *mut u8 {
    // SAFETY: Upheld by caller.
    unsafe {
        // Make sure we don't accidentally allow omitting the allocator shim in
        // stable code until it is actually stabilized.
        __rust_no_alloc_shim_is_unstable_v2();

        __rust_alloc(layout.size(), layout.alignment())
    }
}

/// Deallocates memory with the global allocator.
///
/// This function forwards calls to the [`GlobalAlloc::dealloc`] method
/// of the allocator registered with the `#[global_allocator]` attribute
/// if there is one, or the `std` crate’s default.
///
/// 编译器表明这种分配可以被栈变量替代。编译器可能会
/// [`GlobalAlloc::dealloc`] method of the registered allocator directly. Users of this function
/// 对应的释放操作。
/// This means:
///
/// - This function may non-deterministically entirely skip the underlying allocator, e.g. if the
/// compiler can show that this allocation can be replaced by a stack variable. The compiler may
/// also merge multiple allocation operations into one, as long as it can also adjust all
/// corresponding deallocation operations accordingly.
/// - The pointer passed to this function must have been obtained by invoking [`alloc`],
///   [`alloc_zeroed`], or [`realloc`]. In particular, passing a pointer returned by the underlying
///   methods on [`GlobalAlloc`] is not permitted.
/// - 此函数会在将分配的内容交给分配器之前对其进行解初始化。
/// 因此，即使你知道程序之前已对内存进行了初始化，分配器也不能依赖其已被初始化。
/// 使用此函数的用户必须考虑，将来可能允许分配器进行逆序操作。
///
/// Users of this function have to consider that in the future, allocators may be allowed to unwind.
///
/// This function is expected to be deprecated in favor of the `deallocate` method
/// of the [`Global`] type when it and the [`Allocator`] trait become stable.
///
/// # 安全性
///
/// See [`GlobalAlloc::dealloc`].
#[stable(feature = "global_alloc", since = "1.28.0")]
#[inline]
#[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
pub unsafe fn dealloc(ptr: *mut u8, layout: Layout) {
    // SAFETY: Upheld by caller.
    unsafe { dealloc_nonnull(NonNull::new_unchecked(ptr), layout) }
}

/// Same as [`dealloc`] but when you already have a non-null pointer
#[inline]
#[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
unsafe fn dealloc_nonnull(ptr: NonNull<u8>, layout: Layout) {
    // SAFETY: Upheld by caller.
    unsafe { __rust_dealloc(ptr, layout.size(), layout.alignment()) }
}

/// 使用全局分配器重新分配内存。
///
/// This function forwards calls to the [`GlobalAlloc::realloc`] method
/// of the allocator registered with the `#[global_allocator]` attribute
/// if there is one, or the `std` crate’s default.
///
/// Note, however, that invoking this function is *not* equivalent to invoking the underlying
/// [`GlobalAlloc::realloc`] method of the registered allocator directly. Users of this function
/// 不能假设分配器会执行什么操作，只能依据文档中的要求。
/// 这意味着：
///
/// - 此函数可能非确定性地完全跳过底层分配器，例如如果
/// 编译器表明此分配可以被栈变量替代。编译器也可能
/// 将多个分配操作合并为一次，只要它也能相应调整所有对应的释放操作。
///   corresponding deallocation operations accordingly.
/// - The pointer passed to this function must have been obtained by invoking [`alloc`],
///   [`alloc_zeroed`], or [`realloc`]. In particular, passing a pointer returned by the underlying
///   methods on [`GlobalAlloc`] is not permitted.
/// - An allocation created by invoking this function has exactly the size and minimum alignment
///   defined by `layout`, even if the underlying allocator makes stronger promises.
/// - The allocation can only be freed by invoking [`dealloc`] or [`realloc`]. In particular,
///   passing a pointer to such an allocation directly to the underlying method on [`GlobalAlloc`] is
/// 在调用其中任一函数之前，使用非来自此返回值派生指针访问支持此分配的内存是未定义行为。
/// memory that backs this allocation with any pointer not derived from the return value of this
/// 该函数（例如使用内部指针时，分配器可能会保留这些指针）。
/// - 如果调用此函数导致分配空间增大，新分配的空间中已增长部分的内容将不会被初始化。
/// 该函数在返回前会取消初始化这部分内容。
/// - 如果调用此函数导致分配空间缩小，旧分配空间中被移除部分的内容将不会被初始化，然后才会调用底层分配器。
/// 该函数在调用底层分配器之前会取消初始化这部分内容。
///
/// 使用此函数的用户必须考虑，将来可能允许分配器进行逆操作。
///
/// This function is expected to be deprecated in favor of the `grow` and `shrink` methods
/// of the [`Global`] type when it and the [`Allocator`] trait become stable.
///
/// # 安全性
///
/// See [`GlobalAlloc::realloc`].
#[stable(feature = "global_alloc", since = "1.28.0")]
#[must_use = "losing the pointer will leak memory"]
#[inline]
#[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
pub unsafe fn realloc(ptr: *mut u8, layout: Layout, new_size: usize) -> *mut u8 {
    // SAFETY: Upheld by caller.
    unsafe { realloc_nonnull(NonNull::new_unchecked(ptr), layout, new_size) }
}

/// Same as [`realloc`] but when you already have a non-null pointer
#[inline]
#[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
unsafe fn realloc_nonnull(ptr: NonNull<u8>, layout: Layout, new_size: usize) -> *mut u8 {
    // SAFETY: Upheld by caller.
    unsafe { __rust_realloc(ptr, layout.size(), layout.alignment(), new_size) }
}

/// 使用全局分配器分配零初始化的内存。
///
/// This function forwards calls to the [`GlobalAlloc::alloc_zeroed`] method
/// of the allocator registered with the `#[global_allocator]` attribute
/// if there is one, or the `std` crate’s default.
///
/// 然而，需要注意的是，调用此函数并不等同于直接调用底层方法。用户无法对分配器的行为做出任何假设，只能遵守文档中的要求。
/// [`GlobalAlloc::alloc_zeroed`] method of the registered allocator directly. Users of this
/// 该函数不能假设分配器会执行什么操作，只能遵循文档中的要求。这意味着：
/// - 此函数可能会非确定性地完全跳过底层分配器，例如如果编译器认为该分配可以被栈变量替代。编译器也可能将多个分配操作合并为一次，只要它能够相应地调整所有对应的释放操作。
///
/// - This function may non-deterministically entirely skip the underlying allocator, e.g. if the
///   compiler can show that this allocation can be replaced by a stack variable. The compiler may
/// 使用此函数的用户必须考虑，将来可能允许分配器进行逆操作。
/// corresponding deallocation operations accordingly.
/// - The allocation can only be freed by invoking [`dealloc`] or [`realloc`]. In particular,
///   passing a pointer to such an allocation directly to the underlying method on [`GlobalAlloc`] is
/// not permitted. Until one of those functions is called, it is undefined behavior to access the
/// memory that backs this allocation with any pointer not derived from the return value of this
/// function (e.g., with internal pointers the allocator might keep around).
/// - An allocation created by invoking this function has exactly the size and minimum alignment
///   defined by `layout`, even if the underlying allocator makes stronger promises.
///
/// Users of this function have to consider that in the future, allocators may be allowed to unwind.
///
/// This function is expected to be deprecated in favor of the `allocate_zeroed` method
/// of the [`Global`] type when it and the [`Allocator`] trait become stable.
///
/// # 安全性
///
/// See [`GlobalAlloc::alloc_zeroed`].
///
/// # 示例
///
/// ```
/// use std::alloc::{alloc_zeroed, dealloc, handle_alloc_error, Layout};
///
/// unsafe {
///     let layout = Layout::new::<u16>();
///     let ptr = alloc_zeroed(layout);
///     if ptr.is_null() {
///         handle_alloc_error(layout);
///     }
///
///     assert_eq!(*(ptr as *mut u16), 0);
///
///     dealloc(ptr, layout);
/// }
/// ```
#[stable(feature = "global_alloc", since = "1.28.0")]
#[must_use = "losing the pointer will leak memory"]
#[inline]
#[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
pub unsafe fn alloc_zeroed(layout: Layout) -> *mut u8 {
    // SAFETY: Upheld by caller.
    unsafe {
        // Make sure we don't accidentally allow omitting the allocator shim in
        // stable code until it is actually stabilized.
        __rust_no_alloc_shim_is_unstable_v2();

        __rust_alloc_zeroed(layout.size(), layout.alignment())
    }
}

impl Global {
    #[inline]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    fn alloc_impl_runtime(layout: Layout, zeroed: bool) -> Result<NonNull<[u8]>, AllocError> {
        match layout.size() {
            0 => Ok(layout.dangling_ptr().cast_slice(0)),
            // SAFETY: `layout` is non-zero in size,
            size => unsafe {
                let raw_ptr = if zeroed { alloc_zeroed(layout) } else { alloc(layout) };
                let ptr = NonNull::new(raw_ptr).ok_or(AllocError)?;
                Ok(ptr.cast_slice(size))
            },
        }
    }

    #[inline]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    fn deallocate_impl_runtime(ptr: NonNull<u8>, layout: Layout) {
        if layout.size() != 0 {
            // SAFETY:
            // * We have checked that `layout` is non-zero in size.
            // * The caller is obligated to provide a layout that "fits", and in this case,
            //   "fit" always means a layout that is equal to the original, because our
            //   `allocate()`, `grow()`, and `shrink()` implementations never returns a larger
            //   allocation than requested.
            // * Other conditions must be upheld by the caller, as per `Allocator::deallocate()`'s
            //   safety documentation.
            unsafe { dealloc_nonnull(ptr, layout) }
        }
    }

    // SAFETY: Same as `Allocator::grow`
    #[inline]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    fn grow_impl_runtime(
        &self,
        ptr: NonNull<u8>,
        old_layout: Layout,
        new_layout: Layout,
        zeroed: bool,
    ) -> Result<NonNull<[u8]>, AllocError> {
        debug_assert!(
            new_layout.size() >= old_layout.size(),
            "`new_layout.size()` must be greater than or equal to `old_layout.size()`"
        );

        match old_layout.size() {
            0 => self.alloc_impl(new_layout, zeroed),

            // SAFETY: `new_size` is non-zero as `old_size` is greater than or equal to `new_size`
            // as required by safety conditions. Other conditions must be upheld by the caller
            old_size if old_layout.align() == new_layout.align() => unsafe {
                let new_size = new_layout.size();

                // `realloc` probably checks for `new_size >= old_layout.size()` or something similar.
                hint::assert_unchecked(new_size >= old_layout.size());

                let raw_ptr = realloc_nonnull(ptr, old_layout, new_size);
                let ptr = NonNull::new(raw_ptr).ok_or(AllocError)?;
                if zeroed {
                    raw_ptr.add(old_size).write_bytes(0, new_size - old_size);
                }
                Ok(ptr.cast_slice(new_size))
            },

            // SAFETY: because `new_layout.size()` must be greater than or equal to `old_size`,
            // both the old and new memory allocation are valid for reads and writes for `old_size`
            // bytes. Also, because the old allocation wasn't yet deallocated, it cannot overlap
            // `new_ptr`. Thus, the call to `copy_nonoverlapping` is safe. The safety contract
            // for `dealloc` must be upheld by the caller.
            old_size => unsafe {
                let new_ptr = self.alloc_impl(new_layout, zeroed)?;
                ptr::copy_nonoverlapping(ptr.as_ptr(), new_ptr.as_mut_ptr(), old_size);
                self.deallocate(ptr, old_layout);
                Ok(new_ptr)
            },
        }
    }

    // SAFETY: Same as `Allocator::grow`
    #[inline]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    fn shrink_impl_runtime(
        &self,
        ptr: NonNull<u8>,
        old_layout: Layout,
        new_layout: Layout,
        _zeroed: bool,
    ) -> Result<NonNull<[u8]>, AllocError> {
        debug_assert!(
            new_layout.size() <= old_layout.size(),
            "`new_layout.size()` must be smaller than or equal to `old_layout.size()`"
        );

        match new_layout.size() {
            // SAFETY: conditions must be upheld by the caller
            0 => unsafe {
                self.deallocate(ptr, old_layout);
                Ok(new_layout.dangling_ptr().cast_slice(0))
            },

            // SAFETY: `new_size` is non-zero. Other conditions must be upheld by the caller
            new_size if old_layout.align() == new_layout.align() => unsafe {
                // `realloc` probably checks for `new_size <= old_layout.size()` or something similar.
                hint::assert_unchecked(new_size <= old_layout.size());

                let raw_ptr = realloc_nonnull(ptr, old_layout, new_size);
                let ptr = NonNull::new(raw_ptr).ok_or(AllocError)?;
                Ok(ptr.cast_slice(new_size))
            },

            // SAFETY: because `new_size` must be smaller than or equal to `old_layout.size()`,
            // both the old and new memory allocation are valid for reads and writes for `new_size`
            // bytes. Also, because the old allocation wasn't yet deallocated, it cannot overlap
            // `new_ptr`. Thus, the call to `copy_nonoverlapping` is safe. The safety contract
            // for `dealloc` must be upheld by the caller.
            new_size => unsafe {
                let new_ptr = self.allocate(new_layout)?;
                ptr::copy_nonoverlapping(ptr.as_ptr(), new_ptr.as_mut_ptr(), new_size);
                self.deallocate(ptr, old_layout);
                Ok(new_ptr)
            },
        }
    }

    // SAFETY: Same as `Allocator::allocate`
    #[inline]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    #[rustc_const_unstable(feature = "const_heap", issue = "79597")]
    const fn alloc_impl(&self, layout: Layout, zeroed: bool) -> Result<NonNull<[u8]>, AllocError> {
        core::intrinsics::const_eval_select(
            (layout, zeroed),
            Global::alloc_impl_const,
            Global::alloc_impl_runtime,
        )
    }

    // SAFETY: Same as `Allocator::deallocate`
    #[inline]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    #[rustc_const_unstable(feature = "const_heap", issue = "79597")]
    const unsafe fn deallocate_impl(&self, ptr: NonNull<u8>, layout: Layout) {
        core::intrinsics::const_eval_select(
            (ptr, layout),
            Global::deallocate_impl_const,
            Global::deallocate_impl_runtime,
        )
    }

    // SAFETY: Same as `Allocator::grow`
    #[inline]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    #[rustc_const_unstable(feature = "const_heap", issue = "79597")]
    const unsafe fn grow_impl(
        &self,
        ptr: NonNull<u8>,
        old_layout: Layout,
        new_layout: Layout,
        zeroed: bool,
    ) -> Result<NonNull<[u8]>, AllocError> {
        core::intrinsics::const_eval_select(
            (self, ptr, old_layout, new_layout, zeroed),
            Global::grow_shrink_impl_const,
            Global::grow_impl_runtime,
        )
    }

    // SAFETY: Same as `Allocator::shrink`
    #[inline]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    #[rustc_const_unstable(feature = "const_heap", issue = "79597")]
    const unsafe fn shrink_impl(
        &self,
        ptr: NonNull<u8>,
        old_layout: Layout,
        new_layout: Layout,
    ) -> Result<NonNull<[u8]>, AllocError> {
        core::intrinsics::const_eval_select(
            (self, ptr, old_layout, new_layout, false),
            Global::grow_shrink_impl_const,
            Global::shrink_impl_runtime,
        )
    }

    #[inline]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    #[rustc_const_unstable(feature = "const_heap", issue = "79597")]
    const fn alloc_impl_const(layout: Layout, zeroed: bool) -> Result<NonNull<[u8]>, AllocError> {
        match layout.size() {
            0 => Ok(layout.dangling_ptr().cast_slice(0)),
            // SAFETY: `layout` is non-zero in size,
            size => unsafe {
                let raw_ptr = core::intrinsics::const_allocate(layout.size(), layout.align());
                let ptr = NonNull::new(raw_ptr).ok_or(AllocError)?;
                if zeroed {
                    // SAFETY: the pointer returned by `const_allocate` is valid to write to.
                    ptr.write_bytes(0, size);
                }
                Ok(ptr.cast_slice(size))
            },
        }
    }

    #[inline]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    #[rustc_const_unstable(feature = "const_heap", issue = "79597")]
    const fn deallocate_impl_const(ptr: NonNull<u8>, layout: Layout) {
        if layout.size() != 0 {
            // SAFETY: We checked for nonzero size; other preconditions must be upheld by caller.
            unsafe {
                core::intrinsics::const_deallocate(ptr.as_ptr(), layout.size(), layout.align());
            }
        }
    }

    #[inline]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    #[rustc_const_unstable(feature = "const_heap", issue = "79597")]
    const fn grow_shrink_impl_const(
        &self,
        ptr: NonNull<u8>,
        old_layout: Layout,
        new_layout: Layout,
        zeroed: bool,
    ) -> Result<NonNull<[u8]>, AllocError> {
        let new_ptr = self.alloc_impl(new_layout, zeroed)?;
        // SAFETY: both pointers are valid and this operations is in bounds.
        unsafe {
            ptr::copy_nonoverlapping(
                ptr.as_ptr(),
                new_ptr.as_mut_ptr(),
                cmp::min(old_layout.size(), new_layout.size()),
            );
        }
        // SAFETY: Caller ensures the ptr & layout are correct.
        unsafe {
            self.deallocate_impl(ptr, old_layout);
        }
        Ok(new_ptr)
    }
}

#[stable(feature = "allocator_api", since = "1.100.0")]
#[rustc_const_unstable(feature = "const_heap", issue = "79597")]
const unsafe impl Allocator for Global {
    #[inline]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    fn allocate(&self, layout: Layout) -> Result<NonNull<[u8]>, AllocError> {
        self.alloc_impl(layout, false)
    }

    #[inline]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    fn allocate_zeroed(&self, layout: Layout) -> Result<NonNull<[u8]>, AllocError> {
        self.alloc_impl(layout, true)
    }

    #[inline]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    unsafe fn deallocate(&self, ptr: NonNull<u8>, layout: Layout) {
        // SAFETY: all conditions must be upheld by the caller
        unsafe { self.deallocate_impl(ptr, layout) }
    }

    #[inline]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    unsafe fn grow(
        &self,
        ptr: NonNull<u8>,
        old_layout: Layout,
        new_layout: Layout,
    ) -> Result<NonNull<[u8]>, AllocError> {
        // SAFETY: all conditions must be upheld by the caller
        unsafe { self.grow_impl(ptr, old_layout, new_layout, false) }
    }

    #[inline]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    unsafe fn grow_zeroed(
        &self,
        ptr: NonNull<u8>,
        old_layout: Layout,
        new_layout: Layout,
    ) -> Result<NonNull<[u8]>, AllocError> {
        // SAFETY: all conditions must be upheld by the caller
        unsafe { self.grow_impl(ptr, old_layout, new_layout, true) }
    }

    #[inline]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    unsafe fn shrink(
        &self,
        ptr: NonNull<u8>,
        old_layout: Layout,
        new_layout: Layout,
    ) -> Result<NonNull<[u8]>, AllocError> {
        // SAFETY: all conditions must be upheld by the caller
        unsafe { self.shrink_impl(ptr, old_layout, new_layout) }
    }
}

// # Allocation error handler

#[cfg(not(no_global_oom_handling))]
unsafe extern "Rust" {
    // This is the magic symbol to call the global alloc error handler. rustc generates
    // it to call `__rg_oom` if there is a `#[alloc_error_handler]`, or to call the
    // default implementations below (`__rdl_alloc_error_handler`) otherwise.
    #[rustc_std_internal_symbol]
    fn __rust_alloc_error_handler(size: usize, align: usize) -> !;
}

/// 表示内存分配错误。
///
/// 希望因分配错误而停止执行的内存分配 API 调用者被鼓励调用此函数，
/// in response to an allocation error are encouraged to call this function,
/// rather than directly invoking [`panic!`] or similar.
///
/// 全局配置的不同，它可能会 panic（导致程序终止或中止）或中止进程（不终止）。
/// 默认行为为：
/// configuration for all panics), or abort the process (with no unwinding).
///
/// 在标准错误中输出消息并终止进程。
///
///  * If the binary links against `std` (typically the case), then
/// 未来的 Rust 版本可能会默认 panic。
///   This behavior can be replaced with [`set_alloc_error_hook`] and [`take_alloc_error_hook`].
///   Future versions of Rust may panic by default instead.
///
/// * If the binary does not link against `std` (all of its crates are marked
///   [`#![no_std]`][no_std]), then call [`panic!`] with a message.
/// [The panic handler] applies as to any panic.
///
/// [`set_alloc_error_hook`]: ../../std/alloc/fn.set_alloc_error_hook.html
/// [`take_alloc_error_hook`]: ../../std/alloc/fn.take_alloc_error_hook.html
/// [The panic handler]: https://doc.rust-lang.org/reference/runtime.html#the-panic_handler-attribute
/// [no_std]: https://doc.rust-lang.org/reference/names/preludes.html#the-no_std-attribute
#[stable(feature = "global_alloc", since = "1.28.0")]
#[rustc_const_unstable(feature = "const_alloc_error", issue = "92523")]
#[cfg(not(no_global_oom_handling))]
#[cold]
#[optimize(size)]
pub const fn handle_alloc_error(layout: Layout) -> ! {
    const fn ct_error(_: Layout) -> ! {
        panic!("allocation failed");
    }

    #[inline]
    fn rt_error(layout: Layout) -> ! {
        // SAFETY: Safe to call; we control this function.
        unsafe {
            __rust_alloc_error_handler(layout.size(), layout.align());
        }
    }

    #[cfg(not(panic = "immediate-abort"))]
    {
        core::intrinsics::const_eval_select((layout,), ct_error, rt_error)
    }

    #[cfg(panic = "immediate-abort")]
    ct_error(layout)
}

#[cfg(not(no_global_oom_handling))]
#[doc(hidden)]
#[unstable(feature = "alloc_internals", issue = "none")]
pub mod __alloc_error_handler {
    // called via generated `__rust_alloc_error_handler` if there is no
    // `#[alloc_error_handler]`.
    #[rustc_std_internal_symbol]
    pub unsafe fn __rdl_alloc_error_handler(size: usize, _align: usize) -> ! {
        core::panicking::panic_nounwind_fmt(
            format_args!("memory allocation of {size} bytes failed"),
            /* force_no_backtrace */ false,
        )
    }
}

#[unstable(feature = "allocator_ext", issue = "163177", implied_by = "allocator_api")]
impl AllocatorNightly for Global {}
