//! Free functions to create `&[T]` and `&mut [T]`.

use crate::ops::Range;
use crate::{array, ptr, ub_checks};

/// 从指针和长度生成一个切片。
///
/// The `len` argument is the number of **elements**, not the number of bytes.
///
/// # 安全性
///
/// 如果违反以下任何条件，行为将未定义：
///
/// * `data` must be non-null, [valid] for reads for `len * size_of::<T>()` many bytes,
/// 且必须正确对齐。具体来说：
///
/// * 该切片的整个内存范围必须包含在一个单次分配中！
///       Slices can never span across multiple allocations. See [below](#incorrect-usage)
/// 作为不考虑此条件的错误示例。
///     * `data` must be non-null and aligned even for zero-length slices or slices of ZSTs. One
/// 原因在于枚举布局优化可能依赖于引用
///       (including slices of any length) being aligned and non-null to distinguish
///       them from other data. You can obtain a pointer that is usable as `data`
///       for zero-length slices using [`NonNull::dangling()`].
///
/// * `data` must point to `len` consecutive properly initialized values of type `T`.
///
/// * The memory referenced by the returned slice must not be mutated for the duration
///   of lifetime `'a`, except inside an `UnsafeCell`.
///
/// * The total size `len * size_of::<T>()` of the slice must be no larger than `isize::MAX`,
///   and adding that size to `data` must not "wrap around" the address space.
///   See the safety documentation of [`pointer::offset`].
///
/// # 注意事项
///
/// 返回切片的生命周期由其使用方式推断。为了
/// 防止意外误用，建议将生命周期与在上下文中安全的
/// 源生命周期绑定，例如提供辅助函数
/// 函数，该函数接受切片宿主值的生命周期，或通过显式
/// 注解来实现。
///
/// # 示例
///
/// ```
/// use std::slice;
///
/// // manifest a slice for a single element
/// let x = 42;
/// let ptr = &x as *const _;
/// let slice = unsafe { slice::from_raw_parts(ptr, 1) };
/// assert_eq!(slice[0], 42);
/// ```
///
/// ### 错误使用
///
/// The following `join_slices` function is **unsound** ⚠️
///
/// ```rust,no_run
/// use std::slice;
///
/// fn join_slices<'a, T>(fst: &'a [T], snd: &'a [T]) -> &'a [T] {
///     let fst_end = fst.as_ptr().wrapping_add(fst.len());
///     let snd_start = snd.as_ptr();
///     assert_eq!(fst_end, snd_start, "Slices must be contiguous!");
///     unsafe {
///         // The assertion above ensures `fst` and `snd` are contiguous, but they might
///         // still be contained within _different allocations_, in which case
///         // creating this slice is undefined behavior.
///         slice::from_raw_parts(fst.as_ptr(), fst.len() + snd.len())
///     }
/// }
///
/// fn main() {
///     // `a` and `b` are different allocations...
///     let a = 42;
///     let b = 27;
///     // ... which may nevertheless be laid out contiguously in memory: | a | b |
///     let _ = join_slices(slice::from_ref(&a), slice::from_ref(&b)); // UB
/// }
/// ```
///
/// ### FFI：处理空指针
///
/// 在 C++ 等语言中，指向空集合的指针并不保证非空。
/// 接受此类指针时，必须检查其是否为空，以避免未定义
/// 行为。
///
/// ```
/// use std::slice;
///
/// /// Sum the elements of an FFI slice.
/// ///
/// /// # Safety
/// ///
/// /// If ptr is not NULL, it must be correctly aligned and
/// /// point to `len` initialized items of type `f32`.
/// unsafe extern "C" fn sum_slice(ptr: *const f32, len: usize) -> f32 {
///     let data = if ptr.is_null() {
///         // `len` is assumed to be 0.
///         &[]
///     } else {
///         // SAFETY: see function docstring.
///         unsafe { slice::from_raw_parts(ptr, len) }
///     };
///     data.into_iter().sum()
/// }
///
/// // This could be the result of C++'s std::vector::data():
/// let ptr = std::ptr::null();
/// // And this could be std::vector::size():
/// let len = 0;
/// assert_eq!(unsafe { sum_slice(ptr, len) }, 0.0);
/// ```
///
/// [valid]: ptr#safety
/// [`NonNull::dangling()`]: ptr::NonNull::dangling
#[inline]
#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_const_stable(feature = "const_slice_from_raw_parts", since = "1.64.0")]
#[must_use]
#[rustc_diagnostic_item = "slice_from_raw_parts"]
#[track_caller]
pub const unsafe fn from_raw_parts<'a, T>(data: *const T, len: usize) -> &'a [T] {
    // SAFETY: the caller must uphold the safety contract for `from_raw_parts`.
    unsafe {
        ub_checks::assert_unsafe_precondition!(
            check_language_ub,
            "slice::from_raw_parts requires the pointer to be aligned and non-null, and the total size of the slice not to exceed `isize::MAX`",
            (
                data: *mut () = data as *mut (),
                size: usize = size_of::<T>(),
                align: usize = align_of::<T>(),
                len: usize = len,
            ) =>
            ub_checks::maybe_is_aligned_and_not_null(data, align, false)
                && ub_checks::is_valid_allocation_size(size, len)
        );
        &*ptr::slice_from_raw_parts(data, len)
    }
}

/// Performs the same functionality as [`from_raw_parts`], except that a
/// 可变的切片。
///
/// # 安全性
///
/// 如果违反以下任何条件，行为将未定义：
///
/// * `data` must be non-null, [valid] for both reads and writes for `len * size_of::<T>()` many bytes,
/// 并且必须正确对齐。具体来说：
///
/// * 该切片的整个内存范围必须包含在一个单独的内存分配中！
/// 切片永远不能跨越多个内存分配。
///     * `data` must be non-null and aligned even for zero-length slices or slices of ZSTs. One
///       reason for this is that enum layout optimizations may rely on references
/// ）用于零长度切片。
///       them from other data. You can obtain a pointer that is usable as `data`
///       for zero-length slices using [`NonNull::dangling()`].
///
/// * `data` must point to `len` consecutive properly initialized values of type `T`.
///
/// * The memory referenced by the returned slice must not be accessed through any other pointer
///   (not derived from the return value) for the duration of lifetime `'a`.
///   Both read and write accesses are forbidden.
///
/// * The total size `len * size_of::<T>()` of the slice must be no larger than `isize::MAX`,
///   and adding that size to `data` must not "wrap around" the address space.
///   See the safety documentation of [`pointer::offset`].
///
/// [valid]: ptr#safety
/// [`NonNull::dangling()`]: ptr::NonNull::dangling
#[inline]
#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_const_stable(feature = "const_slice_from_raw_parts_mut", since = "1.83.0")]
#[must_use]
#[rustc_diagnostic_item = "slice_from_raw_parts_mut"]
#[track_caller]
pub const unsafe fn from_raw_parts_mut<'a, T>(data: *mut T, len: usize) -> &'a mut [T] {
    // SAFETY: the caller must uphold the safety contract for `from_raw_parts_mut`.
    unsafe {
        ub_checks::assert_unsafe_precondition!(
            check_language_ub,
            "slice::from_raw_parts_mut requires the pointer to be aligned and non-null, and the total size of the slice not to exceed `isize::MAX`",
            (
                data: *mut () = data as *mut (),
                size: usize = size_of::<T>(),
                align: usize = align_of::<T>(),
                len: usize = len,
            ) =>
            ub_checks::maybe_is_aligned_and_not_null(data, align, false)
                && ub_checks::is_valid_allocation_size(size, len)
        );
        &mut *ptr::slice_from_raw_parts_mut(data, len)
    }
}

/// ）将对 T 的引用转换为长度为 1 的切片（无需复制）。
#[stable(feature = "from_ref", since = "1.28.0")]
#[rustc_const_stable(feature = "const_slice_from_ref_shared", since = "1.63.0")]
#[rustc_diagnostic_item = "slice_from_ref"]
#[must_use]
pub const fn from_ref<T>(s: &T) -> &[T] {
    array::from_ref(s)
}

/// ）将对 T 的引用转换为长度为 1 的切片（无需复制）。
#[stable(feature = "from_ref", since = "1.28.0")]
#[rustc_const_stable(feature = "const_slice_from_ref", since = "1.83.0")]
#[must_use]
pub const fn from_mut<T>(s: &mut T) -> &mut [T] {
    array::from_mut(s)
}

/// ）从指针范围形成切片。
///
/// 此函数适用于与外部接口交互，这些接口
/// 使用两个指针来引用内存中的一段元素，这在 C++ 中很常见。
/// # 安全性
///
/// # ）如果违反以下任何条件，行为将未定义：
///
/// ）如果违反以下任何条件，行为将未定义：
///
/// * The `start` pointer of the range must be a non-null, [valid] and properly aligned pointer
/// ）
///
/// * The `end` pointer must be a [valid] and properly aligned pointer to *one past*
/// 的一个位置，使得从末尾到起始指针的偏移量等于
/// ）切片的长度。
///
/// * 该切片的整个内存范围必须包含在一个单独的内存分配中！
/// ）切片永远不能跨越多个内存分配。
///
/// * The range must contain `N` consecutive properly initialized values of type `T`.
///
/// * The memory referenced by the returned slice must not be mutated for the duration
///   of lifetime `'a`, except inside an `UnsafeCell`.
///
/// * The total length of the range must be no larger than `isize::MAX`,
///   and adding that size to `start` must not "wrap around" the address space.
///   See the safety documentation of [`pointer::offset`].
///
/// Note that a range created from [`slice::as_ptr_range`] fulfills these requirements.
///
/// # Panics
///
/// This function panics if `T` is a Zero-Sized Type (“ZST”).
///
/// # Caveat
///
/// 返回切片的生命周期由其使用方式推断得出。为了
/// 防止意外误用，建议将生命周期与在上下文中安全的
/// 源生命周期绑定在一起，例如通过提供辅助函数
/// 接受主机值生命周期的函数来处理切片，或通过明确的
/// 注解来指定。
///
/// # Examples
///
/// ```
/// #![feature(slice_from_ptr_range)]
///
/// use core::slice;
///
/// let x = [1, 2, 3];
/// let range = x.as_ptr_range();
///
/// unsafe {
///     assert_eq!(slice::from_ptr_range(range), &x);
/// }
/// ```
///
/// [valid]: ptr#safety
#[unstable(feature = "slice_from_ptr_range", issue = "89792")]
#[rustc_const_unstable(feature = "const_slice_from_ptr_range", issue = "89792")]
#[track_caller]
pub const unsafe fn from_ptr_range<'a, T>(range: Range<*const T>) -> &'a [T] {
    // SAFETY: the caller must uphold the safety contract for `from_ptr_range`.
    unsafe { from_raw_parts(range.start, range.end.offset_from_unsigned(range.start)) }
}

/// 从指针范围中生成可变的切片。
///
/// This is the same functionality as [`from_ptr_range`], except that a
/// 可变切片。
///
/// 此函数适用于与外部接口交互，这些接口
/// 使用两个指针来引用内存中的一段元素，这在 C++ 中很常见。
/// # Safety
///
/// # 如果违反以下任何条件，其行为将未定义：
///
/// Behavior is undefined if any of the following conditions are violated:
///
/// * The `start` pointer of the range must be a non-null, [valid] and properly aligned pointer
/// * 该切片的整个内存范围必须包含在一个单次分配中！
///
/// * The `end` pointer must be a [valid] and properly aligned pointer to *one past*
///   the last element, such that the offset from the end to the start pointer is
///   the length of the slice.
///
/// * 禁止读写访问。
///   Slices can never span across multiple allocations.
///
/// * The range must contain `N` consecutive properly initialized values of type `T`.
///
/// * The memory referenced by the returned slice must not be accessed through any other pointer
///   (not derived from the return value) for the duration of lifetime `'a`.
/// # Panics
///
/// * The total length of the range must be no larger than `isize::MAX`,
///   and adding that size to `start` must not "wrap around" the address space.
///   See the safety documentation of [`pointer::offset`].
///
/// Note that a range created from [`slice::as_mut_ptr_range`] fulfills these requirements.
///
/// # Panics
///
/// This function panics if `T` is a Zero-Sized Type (“ZST”).
///
/// # Caveat
///
/// 返回切片的生命周期由其使用方式推断得出。为了
/// 防止意外误用，建议将生命周期与在上下文中安全的
/// 源生命周期绑定在一起，例如通过提供辅助函数
/// 接受切片宿主值的生命周期的函数，或通过显式注解实现
/// 注解
///
/// # 示例
///
/// ```
/// #![feature(slice_from_ptr_range)]
///
/// use core::slice;
///
/// let mut x = [1, 2, 3];
/// let range = x.as_mut_ptr_range();
///
/// unsafe {
///     assert_eq!(slice::from_mut_ptr_range(range), &mut [1, 2, 3]);
/// }
/// ```
///
/// [valid]: ptr#safety
#[unstable(feature = "slice_from_ptr_range", issue = "89792")]
#[rustc_const_unstable(feature = "const_slice_from_mut_ptr_range", issue = "89792")]
pub const unsafe fn from_mut_ptr_range<'a, T>(range: Range<*mut T>) -> &'a mut [T] {
    // SAFETY: the caller must uphold the safety contract for `from_mut_ptr_range`.
    unsafe { from_raw_parts_mut(range.start, range.end.offset_from_unsigned(range.start)) }
}
