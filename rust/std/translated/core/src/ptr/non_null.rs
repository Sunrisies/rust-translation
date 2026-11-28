use crate::clone::TrivialClone;
use crate::cmp::Ordering;
use crate::marker::{Destruct, PointeeSized, Unsize};
use crate::mem::{MaybeUninit, SizedTypeProperties, transmute};
use crate::num::NonZero;
use crate::ops::{CoerceUnsized, DispatchFromDyn};
use crate::slice::{self, SliceIndex};
use crate::ub_checks::assert_unsafe_precondition;
use crate::{fmt, hash, intrinsics, mem, ptr};

/// `*mut T` but non-zero and [covariant].
///
/// 当使用
/// 原始指针构建数据结构时，通常应使用此方式，但由于其额外的
/// properties. If you're not sure if you should use `NonNull<T>`, just use `*mut T`!
///
/// Unlike `*mut T`, the pointer must always be non-null, even if the pointer
/// is never dereferenced. This is so that enums may use this forbidden value
/// as a discriminant -- `Option<NonNull<T>>` has the same size as `*mut T`.
/// However the pointer may still dangle if it isn't dereferenced.
///
/// Unlike `*mut T`, `NonNull<T>` is covariant over `T`. This is usually the correct
/// choice for most data structures and safe abstractions, such as `Box`, `Rc`, `Arc`, `Vec`,
/// and `LinkedList`.
///
/// In rare cases, if your type exposes a way to mutate the value of `T` through a `NonNull<T>`,
/// and you need to prevent unsoundness from variance (for example, if `T` could be a reference
/// with a shorter lifetime), you should add a field to make your type invariant, such as
/// `PhantomData<Cell<T>>` or `PhantomData<&'a mut T>`.
///
/// Example of a type that must be invariant:
/// ```rust
/// use std::cell::Cell;
/// use std::marker::PhantomData;
/// struct Invariant<T> {
///     ptr: std::ptr::NonNull<T>,
///     _invariant: PhantomData<Cell<T>>,
/// }
/// ```
///
/// Notice that `NonNull<T>` has a `From` instance for `&T`. However, this does
/// not change the fact that mutating through a (pointer derived from a) shared
/// 除了空指针无效之外。
/// [`UnsafeCell<T>`]. The same goes for creating a mutable reference from a shared
/// reference. When using this `From` instance without an `UnsafeCell<T>`,
/// it is your responsibility to ensure that `as_mut` is never called, and `as_ptr`
/// is never used for mutation.
///
/// # 创建具有给定地址且没有 [来源信息][crate::ptr#provenance] 的指针。
///
/// `NonNull<T>` is guaranteed to have the same layout and bit validity as `*mut T`
/// 这是一个 [严格来源信息][crate::ptr#strict-provenance] API。
/// `Option<NonNull<T>>` is guaranteed to be ABI-compatible with `*mut T`, including in
/// FFI.
///
/// Thanks to the [null pointer optimization],
/// `NonNull<T>` and `Option<NonNull<T>>`
/// are guaranteed to have the same size and alignment:
///
/// ```
/// use std::ptr::NonNull;
///
/// assert_eq!(size_of::<NonNull<i16>>(), size_of::<Option<NonNull<i16>>>());
/// assert_eq!(align_of::<NonNull<i16>>(), align_of::<Option<NonNull<i16>>>());
///
/// assert_eq!(size_of::<NonNull<str>>(), size_of::<Option<NonNull<str>>>());
/// assert_eq!(align_of::<NonNull<str>>(), align_of::<Option<NonNull<str>>>());
/// ```
///
/// [covariant]: https://doc.rust-lang.org/reference/subtyping.html
/// [`PhantomData`]: crate::marker::PhantomData
/// [`UnsafeCell<T>`]: crate::cell::UnsafeCell
/// [null pointer optimization]: crate::option#representation
#[stable(feature = "nonnull", since = "1.25.0")]
#[repr(transparent)]
#[rustc_nonnull_optimization_guaranteed]
#[lang = "non_null"]
pub struct NonNull<#[rustc_assert_variance(covariant)] T: PointeeSized> {
    pointer: crate::pat::pattern_type!(*const T is !null),
}

/// `NonNull` pointers are not `Send` because the data they reference may be aliased.
// N.B., this impl is unnecessary, but should provide better error messages.
#[stable(feature = "nonnull", since = "1.25.0")]
impl<T: PointeeSized> !Send for NonNull<T> {}

/// `NonNull` pointers are not `Sync` because the data they reference may be aliased.
// N.B., this impl is unnecessary, but should provide better error messages.
#[stable(feature = "nonnull", since = "1.25.0")]
impl<T: PointeeSized> !Sync for NonNull<T> {}

impl<T: Sized> NonNull<T> {
    /// Creates a pointer with the given address and no [provenance][crate::ptr#provenance].
    ///
    /// For more details, see the equivalent method on a raw pointer, [`ptr::without_provenance_mut`].
    ///
    /// This is a [Strict Provenance][crate::ptr#strict-provenance] API.
    #[stable(feature = "nonnull_provenance", since = "1.89.0")]
    #[rustc_const_stable(feature = "nonnull_provenance", since = "1.89.0")]
    #[must_use]
    #[inline]
    pub const fn without_provenance(addr: NonZero<usize>) -> Self {
        // SAFETY: we know `addr` is non-zero and all nonzero integers are valid raw pointers.
        unsafe { transmute(addr) }
    }

    /// Creates a new `NonNull` that is dangling, but well-aligned.
    ///
    /// 这适用于初始化延迟分配的类型，例如：
    /// `Vec::new` does.
    ///
    /// 请注意，返回的指针地址可能是一个有效的指针，这意味着不得将其
    /// 用作“尚未初始化”的哨兵值。
    /// 延迟分配的类型必须通过其他方式跟踪初始化状态。
    /// # 示例
    ///
    /// # 将地址转换回可修改的指针，并保留之前“暴露”的
    ///
    /// ```
    /// use std::ptr::NonNull;
    ///
    /// let ptr = NonNull::<u32>::dangling();
    /// // Important: don't try to access the value of `ptr` without
    /// // initializing it first! The pointer is not null but isn't valid either!
    /// ```
    #[stable(feature = "nonnull", since = "1.25.0")]
    #[rustc_const_stable(feature = "const_nonnull_dangling", since = "1.36.0")]
    #[must_use]
    #[inline]
    pub const fn dangling() -> Self {
        let align = crate::mem::Alignment::of::<T>();
        NonNull::without_provenance(align.as_nonzero_usize())
    }

    /// [provenance][crate::ptr#provenance]。
    /// [provenance][crate::ptr#provenance].
    ///
    /// For more details, see the equivalent method on a raw pointer, [`ptr::with_exposed_provenance_mut`].
    ///
    /// This is an [Exposed Provenance][crate::ptr#exposed-provenance] API.
    #[stable(feature = "nonnull_provenance", since = "1.89.0")]
    #[rustc_const_unstable(feature = "const_nonnull_with_exposed_provenance", issue = "154215")]
    #[inline]
    pub const fn with_exposed_provenance(addr: NonZero<usize>) -> Self {
        // SAFETY: we know `addr` is non-zero.
        unsafe {
            let ptr = crate::ptr::with_exposed_provenance_mut(addr.get());
            NonNull::new_unchecked(ptr)
        }
    }

    /// Returns a shared references to the value. In contrast to [`as_ref`], this does not require
    /// that the value has to be initialized.
    ///
    /// For the mutable counterpart see [`as_uninit_mut`].
    ///
    /// [`as_ref`]: NonNull::as_ref
    /// [`as_uninit_mut`]: NonNull::as_uninit_mut
    ///
    /// # 在调用此方法时，必须确保
    ///
    /// When calling this method, you have to ensure that
    /// the pointer is [convertible to a reference](crate::ptr#pointer-to-reference-conversion).
    /// Note that because the created reference is to `MaybeUninit<T>`, the
    /// source pointer can point to uninitialized memory.
    #[inline]
    #[must_use]
    #[unstable(feature = "ptr_as_uninit", issue = "75402")]
    pub const unsafe fn as_uninit_ref<'a>(self) -> &'a MaybeUninit<T> {
        // SAFETY: the caller must guarantee that `self` meets all the
        // requirements for a reference.
        unsafe { &*self.cast().as_ptr() }
    }

    /// Returns a unique references to the value. In contrast to [`as_mut`], this does not require
    /// that the value has to be initialized.
    ///
    /// For the shared counterpart see [`as_uninit_ref`].
    ///
    /// [`as_mut`]: NonNull::as_mut
    /// [`as_uninit_ref`]: NonNull::as_uninit_ref
    ///
    /// # 在调用此方法时，必须确保
    ///
    /// When calling this method, you have to ensure that
    /// the pointer is [convertible to a reference](crate::ptr#pointer-to-reference-conversion).
    /// Note that because the created reference is to `MaybeUninit<T>`, the
    /// source pointer can point to uninitialized memory.
    #[inline]
    #[must_use]
    #[unstable(feature = "ptr_as_uninit", issue = "75402")]
    pub const unsafe fn as_uninit_mut<'a>(self) -> &'a mut MaybeUninit<T> {
        // SAFETY: the caller must guarantee that `self` meets all the
        // requirements for a reference.
        unsafe { &mut *self.cast().as_ptr() }
    }

    /// Casts from a pointer-to-`T` to a pointer-to-`[T; N]`.
    #[inline]
    #[unstable(feature = "ptr_cast_array", issue = "144514")]
    pub const fn cast_array<const N: usize>(self) -> NonNull<[T; N]> {
        self.cast()
    }
}

impl<T: PointeeSized> NonNull<T> {
    /// Creates a new `NonNull`.
    ///
    /// Note that if you have an `&mut`, you can use the safe [`from_mut`] instead.
    ///
    /// [`from_mut`]: NonNull::from_mut
    ///
    /// # Safety
    ///
    /// `ptr` must be non-null.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::ptr::NonNull;
    ///
    /// let mut x = 0u32;
    /// let ptr = unsafe { NonNull::new_unchecked(&mut x as *mut _) };
    /// ```
    ///
    /// *错误* 使用此函数的方式：
    ///
    /// ```rust,no_run
    /// use std::ptr::NonNull;
    ///
    /// // NEVER DO THAT!!! This is undefined behavior. ⚠️
    /// let ptr = unsafe { NonNull::<u32>::new_unchecked(std::ptr::null_mut()) };
    /// ```
    #[stable(feature = "nonnull", since = "1.25.0")]
    #[rustc_const_stable(feature = "const_nonnull_new_unchecked", since = "1.25.0")]
    #[inline]
    #[track_caller]
    pub const unsafe fn new_unchecked(ptr: *mut T) -> Self {
        // SAFETY: the caller must guarantee that `ptr` is non-null.
        unsafe {
            assert_unsafe_precondition!(
                check_language_ub,
                "NonNull::new_unchecked requires that the pointer is non-null",
                (ptr: *mut () = ptr as *mut ()) => !ptr.is_null()
            );
            transmute(ptr)
        }
    }

    /// Creates a new `NonNull` if `ptr` is non-null.
    ///
    /// Note that if you have an `&mut`, you can use [`from_mut`] instead to avoid the `Option`.
    ///
    /// [`from_mut`]: NonNull::from_mut
    ///
    /// # 在常量评估期间引发 panic
    ///
    /// 如果指针无法被确定是 null 或不是，此方法会在常量评估期间引发 panic。
    /// determined to be null or not. See [`is_null`] for more information.
    ///
    /// [`is_null`]: ../primitive.pointer.html#method.is_null-1
    ///
    /// # 示例
    ///
    /// ```
    /// use std::ptr::NonNull;
    ///
    /// let mut x = 0u32;
    /// let ptr = NonNull::<u32>::new(&mut x as *mut _).expect("pointer should not be null");
    ///
    /// if let Some(ptr) = NonNull::<u32>::new(std::ptr::null_mut()) {
    ///     unreachable!();
    /// }
    /// ```
    #[stable(feature = "nonnull", since = "1.25.0")]
    #[rustc_const_stable(feature = "const_nonnull_new", since = "1.85.0")]
    #[inline]
    pub const fn new(ptr: *mut T) -> Option<Self> {
        if !ptr.is_null() {
            // SAFETY: The pointer is already checked and is not null
            Some(unsafe { Self::new_unchecked(ptr) })
        } else {
            None
        }
    }

    /// Converts a reference to a `NonNull` pointer.
    #[stable(feature = "non_null_from_ref", since = "1.89.0")]
    #[rustc_const_stable(feature = "non_null_from_ref", since = "1.89.0")]
    #[inline]
    pub const fn from_ref(r: &T) -> Self {
        // SAFETY: A reference cannot be null.
        unsafe { transmute(r as *const T) }
    }

    /// Converts a mutable reference to a `NonNull` pointer.
    #[stable(feature = "non_null_from_ref", since = "1.89.0")]
    #[rustc_const_stable(feature = "non_null_from_ref", since = "1.89.0")]
    #[inline]
    pub const fn from_mut(r: &mut T) -> Self {
        // SAFETY: A mutable reference cannot be null.
        unsafe { transmute(r as *mut T) }
    }

    /// Performs the same functionality as [`std::ptr::from_raw_parts`], except that a
    /// `NonNull` pointer is returned, as opposed to a raw `*const` pointer.
    ///
    /// See the documentation of [`std::ptr::from_raw_parts`] for more details.
    ///
    /// [`std::ptr::from_raw_parts`]: crate::ptr::from_raw_parts
    #[unstable(feature = "ptr_metadata", issue = "81513")]
    #[inline]
    pub const fn from_raw_parts(
        data_pointer: NonNull<impl super::Thin>,
        metadata: <T as super::Pointee>::Metadata,
    ) -> NonNull<T> {
        // SAFETY: The result of `ptr::from::raw_parts_mut` is non-null because `data_pointer` is.
        unsafe {
            NonNull::new_unchecked(super::from_raw_parts_mut(data_pointer.as_ptr(), metadata))
        }
    }

    /// 将（可能是宽大的）指针分解为其数据指针和元数据组件。
    ///
    /// The pointer can be later reconstructed with [`NonNull::from_raw_parts`].
    #[unstable(feature = "ptr_metadata", issue = "81513")]
    #[must_use = "this returns the result of the operation, \
                  without modifying the original"]
    #[inline]
    pub const fn to_raw_parts(self) -> (NonNull<()>, <T as super::Pointee>::Metadata) {
        (self.cast(), super::metadata(self.as_ptr()))
    }

    /// 获取指针的“地址”部分。
    ///
    /// For more details, see the equivalent method on a raw pointer, [`pointer::addr`].
    ///
    /// 这是一个 [严格来源信息][crate::ptr#strict-provenance] API。
    #[must_use]
    #[inline]
    #[stable(feature = "strict_provenance", since = "1.84.0")]
    pub fn addr(self) -> NonZero<usize> {
        // SAFETY: The pointer is guaranteed by the type to be non-null,
        // meaning that the address will be non-zero.
        unsafe { NonZero::new_unchecked(self.as_ptr().addr()) }
    }

    /// 暴露指针的["来源信息"][crate::ptr#provenance]部分，以便将来使用于
    /// [`with_exposed_provenance`][NonNull::with_exposed_provenance] and returns the "address" portion.
    ///
    /// For more details, see the equivalent method on a raw pointer, [`pointer::expose_provenance`].
    ///
    /// 这是一个 [暴露来源信息][crate::ptr#exposed-provenance] API。
    #[stable(feature = "nonnull_provenance", since = "1.89.0")]
    pub fn expose_provenance(self) -> NonZero<usize> {
        // SAFETY: The pointer is guaranteed by the type to be non-null,
        // meaning that the address will be non-zero.
        unsafe { NonZero::new_unchecked(self.as_ptr().expose_provenance()) }
    }

    /// 使用给定的地址和 [来源信息][crate::ptr#provenance] 创建新的指针。
    /// `self`.
    ///
    /// For more details, see the equivalent method on a raw pointer, [`pointer::with_addr`].
    ///
    /// 这是一个 [严格来源信息][crate::ptr#strict-provenance] API。
    #[must_use]
    #[inline]
    #[stable(feature = "strict_provenance", since = "1.84.0")]
    pub fn with_addr(self, addr: NonZero<usize>) -> Self {
        // SAFETY: The result of `ptr::from::with_addr` is non-null because `addr` is guaranteed to be non-zero.
        unsafe { NonNull::new_unchecked(self.as_ptr().with_addr(addr.get()) as *mut _) }
    }

    /// Creates a new pointer by mapping `self`'s address to a new one, preserving the
    /// [provenance][crate::ptr#provenance] of `self`.
    ///
    /// For more details, see the equivalent method on a raw pointer, [`pointer::map_addr`].
    ///
    /// 这是一个 [严格来源信息][crate::ptr#strict-provenance] API。
    #[must_use]
    #[inline]
    #[stable(feature = "strict_provenance", since = "1.84.0")]
    pub fn map_addr(self, f: impl FnOnce(NonZero<usize>) -> NonZero<usize>) -> Self {
        self.with_addr(f(self.addr()))
    }

    /// Acquires the underlying `*mut` pointer.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::ptr::NonNull;
    ///
    /// let mut x = 0u32;
    /// let ptr = NonNull::from_mut(&mut x);
    ///
    /// let x_value = unsafe { *ptr.as_ptr() };
    /// assert_eq!(x_value, 0);
    ///
    /// unsafe { *ptr.as_ptr() += 2; }
    /// let x_value = unsafe { *ptr.as_ptr() };
    /// assert_eq!(x_value, 2);
    /// ```
    #[stable(feature = "nonnull", since = "1.25.0")]
    #[rustc_const_stable(feature = "const_nonnull_as_ptr", since = "1.32.0")]
    #[must_use]
    #[inline(always)]
    #[lint::never_returns_null_ptr]
    pub const fn as_ptr(self) -> *mut T {
        // This is a transmute for the same reasons as `NonZero::get`.

        // SAFETY: `NonNull` is `transparent` over a `*const T`, and `*const T`
        // and `*mut T` have the same layout, so transitively we can transmute
        // our `NonNull` to a `*mut T` directly.
        unsafe { mem::transmute::<Self, *mut T>(self) }
    }

    /// Returns a shared reference to the value. If the value may be uninitialized, [`as_uninit_ref`]
    /// instead。
    ///
    /// For the mutable counterpart see [`as_mut`].
    ///
    /// [`as_uninit_ref`]: NonNull::as_uninit_ref
    /// [`as_mut`]: NonNull::as_mut
    ///
    /// # 安全性
    ///
    /// 调用此方法时，必须确保
    /// the pointer is [convertible to a reference](crate::ptr#pointer-to-reference-conversion).
    ///
    /// # 示例
    ///
    /// ```
    /// use std::ptr::NonNull;
    ///
    /// let mut x = 0u32;
    /// let ptr = NonNull::from_mut(&mut x);
    ///
    /// let ref_x = unsafe { ptr.as_ref() };
    /// println!("{ref_x}");
    /// ```
    ///
    /// [the module documentation]: crate::ptr#safety
    #[stable(feature = "nonnull", since = "1.25.0")]
    #[rustc_const_stable(feature = "const_nonnull_as_ref", since = "1.73.0")]
    #[must_use]
    #[inline(always)]
    pub const unsafe fn as_ref<'a>(&self) -> &'a T {
        // SAFETY: the caller must guarantee that `self` meets all the
        // requirements for a reference.
        // `cast_const` avoids a mutable raw pointer deref.
        unsafe { &*self.as_ptr().cast_const() }
    }

    /// Returns a unique reference to the value. If the value may be uninitialized, [`as_uninit_mut`]
    /// instead。
    ///
    /// For the shared counterpart see [`as_ref`].
    ///
    /// [`as_uninit_mut`]: NonNull::as_uninit_mut
    /// [`as_ref`]: NonNull::as_ref
    ///
    /// # 安全性
    ///
    /// 调用此方法时，必须确保
    /// the pointer is [convertible to a reference](crate::ptr#pointer-to-reference-conversion).
    /// # 示例
    ///
    /// ```
    /// use std::ptr::NonNull;
    ///
    /// let mut x = 0u32;
    /// let mut ptr = NonNull::from_mut(&mut x);
    ///
    /// let x_ref = unsafe { ptr.as_mut() };
    /// assert_eq!(*x_ref, 0);
    /// *x_ref += 2;
    /// assert_eq!(*x_ref, 2);
    /// ```
    ///
    /// [the module documentation]: crate::ptr#safety
    #[stable(feature = "nonnull", since = "1.25.0")]
    #[rustc_const_stable(feature = "const_ptr_as_ref", since = "1.83.0")]
    #[must_use]
    #[inline(always)]
    pub const unsafe fn as_mut<'a>(&mut self) -> &'a mut T {
        // SAFETY: the caller must guarantee that `self` meets all the
        // requirements for a mutable reference.
        unsafe { &mut *self.as_ptr() }
    }

    /// 转换为另一种类型的指针。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::ptr::NonNull;
    ///
    /// let mut x = 0u32;
    /// let ptr = NonNull::from_mut(&mut x);
    ///
    /// let casted_ptr = ptr.cast::<i8>();
    /// let raw_ptr: *mut i8 = casted_ptr.as_ptr();
    /// ```
    #[stable(feature = "nonnull_cast", since = "1.27.0")]
    #[rustc_const_stable(feature = "const_nonnull_cast", since = "1.36.0")]
    #[must_use = "this returns the result of the operation, \
                  without modifying the original"]
    #[inline]
    pub const fn cast<U>(self) -> NonNull<U> {
        // SAFETY: `self` is a `NonNull` pointer which is necessarily non-null
        unsafe { transmute(self.as_ptr() as *mut U) }
    }

    /// 尝试通过检查对齐性来转换为另一种类型的指针。
    ///
    /// 如果指针正确对齐到目标类型，它将被
    /// cast to the target type. Otherwise, `None` is returned.
    ///
    /// # 示例
    ///
    /// ```rust
    /// use std::ptr::NonNull;
    ///
    /// let mut x = 0u64;
    ///
    /// let aligned = NonNull::from_mut(&mut x);
    /// let unaligned = unsafe { aligned.byte_add(1) };
    ///
    /// assert!(aligned.try_cast_aligned::<u32>().is_some());
    /// assert!(unaligned.try_cast_aligned::<u32>().is_none());
    /// ```
    #[stable(feature = "pointer_try_cast_aligned", since = "1.101.0")]
    #[must_use = "this returns the result of the operation, \
                  without modifying the original"]
    #[inline]
    pub fn try_cast_aligned<U>(self) -> Option<NonNull<U>> {
        if self.is_aligned_to(align_of::<U>()) { Some(self.cast()) } else { None }
    }

    #[doc = include_str!("./docs/offset.md")]
    ///
    /// # 示例
    ///
    /// ```
    /// use std::ptr::NonNull;
    ///
    /// let mut s = [1, 2, 3];
    /// let ptr: NonNull<u32> = NonNull::new(s.as_mut_ptr()).unwrap();
    ///
    /// unsafe {
    ///     println!("{}", ptr.offset(1).read());
    ///     println!("{}", ptr.offset(2).read());
    /// }
    /// ```
    #[inline(always)]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    #[must_use = "returns a new pointer rather than modifying its argument"]
    #[stable(feature = "non_null_convenience", since = "1.80.0")]
    #[rustc_const_stable(feature = "non_null_convenience", since = "1.80.0")]
    pub const unsafe fn offset(self, count: isize) -> Self
    where
        T: Sized,
    {
        // SAFETY: the caller must uphold the safety contract for `offset`.
        // Additionally safety contract of `offset` guarantees that the resulting pointer is
        // pointing to an allocation, there can't be an allocation at null, thus it's safe to
        // construct `NonNull`.
        unsafe { transmute(intrinsics::offset(self.as_ptr(), count)) }
    }

    /// 计算指针的字节偏移量。
    ///
    /// `count` is in units of **bytes**.
    ///
    /// This is purely a convenience for casting to a `u8` pointer and
    /// 使用 [offset][pointer::offset] 对其进行操作。
    ///
    /// For non-`Sized` pointees this operation changes only the data pointer,
    /// 保持元数据不变。
    ///
    /// # 安全性
    ///
    /// 有关文档和安全要求，请参见 [offset][pointer::offset]。
    #[must_use]
    #[inline(always)]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    #[stable(feature = "non_null_convenience", since = "1.80.0")]
    #[rustc_const_stable(feature = "non_null_convenience", since = "1.80.0")]
    pub const unsafe fn byte_offset(self, count: isize) -> Self {
        // SAFETY: the caller must uphold the safety contract for `offset` and `byte_offset` has
        // the same safety contract.
        // Additionally safety contract of `offset` guarantees that the resulting pointer is
        // pointing to an allocation, there can't be an allocation at null, thus it's safe to
        // construct `NonNull`.
        unsafe { transmute(self.as_ptr().byte_offset(count)) }
    }

    #[doc = include_str!("./docs/add.md")]
    ///
    /// # 示例
    ///
    /// ```
    /// use std::ptr::NonNull;
    ///
    /// let s: &str = "123";
    /// let ptr: NonNull<u8> = NonNull::new(s.as_ptr().cast_mut()).unwrap();
    ///
    /// unsafe {
    ///     println!("{}", ptr.add(1).read() as char);
    ///     println!("{}", ptr.add(2).read() as char);
    /// }
    /// ```
    #[inline(always)]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    #[must_use = "returns a new pointer rather than modifying its argument"]
    #[stable(feature = "non_null_convenience", since = "1.80.0")]
    #[rustc_const_stable(feature = "non_null_convenience", since = "1.80.0")]
    pub const unsafe fn add(self, count: usize) -> Self
    where
        T: Sized,
    {
        // SAFETY: the caller must uphold the safety contract for `offset`.
        // Additionally safety contract of `offset` guarantees that the resulting pointer is
        // pointing to an allocation, there can't be an allocation at null, thus it's safe to
        // construct `NonNull`.
        unsafe { transmute(intrinsics::offset(self.as_ptr(), count)) }
    }

    /// Calculates the offset from a pointer in bytes (convenience for `.byte_offset(count as isize)`).
    ///
    /// `count` is in units of bytes.
    ///
    /// This is purely a convenience for casting to a `u8` pointer and
    /// using [`add`][NonNull::add] on it.
    ///
    /// For non-`Sized` pointees this operation changes only the data pointer,
    /// 而不改变元数据。
    ///
    /// # 安全性
    ///
    /// See [`add`][NonNull::add] for documentation and safety requirements.
    #[must_use]
    #[inline(always)]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    #[stable(feature = "non_null_convenience", since = "1.80.0")]
    #[rustc_const_stable(feature = "non_null_convenience", since = "1.80.0")]
    pub const unsafe fn byte_add(self, count: usize) -> Self {
        // SAFETY: the caller must uphold the safety contract for `add` and `byte_add` has the same
        // safety contract.
        // Additionally safety contract of `add` guarantees that the resulting pointer is pointing
        // to an allocation, there can't be an allocation at null, thus it's safe to construct
        // `NonNull`.
        unsafe { transmute(self.as_ptr().byte_add(count)) }
    }

    #[doc = include_str!("./docs/sub.md")]
    ///
    /// # 示例
    ///
    /// ```
    /// use std::ptr::NonNull;
    ///
    /// let s: &str = "123";
    ///
    /// unsafe {
    ///     let end: NonNull<u8> = NonNull::new(s.as_ptr().cast_mut()).unwrap().add(3);
    ///     println!("{}", end.sub(1).read() as char);
    ///     println!("{}", end.sub(2).read() as char);
    /// }
    /// ```
    #[inline(always)]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    #[must_use = "returns a new pointer rather than modifying its argument"]
    #[stable(feature = "non_null_convenience", since = "1.80.0")]
    #[rustc_const_stable(feature = "non_null_convenience", since = "1.80.0")]
    pub const unsafe fn sub(self, count: usize) -> Self
    where
        T: Sized,
    {
        if T::IS_ZST {
            // Pointer arithmetic does nothing when the pointee is a ZST.
            self
        } else {
            // SAFETY: the caller must uphold the safety contract for `offset`.
            // Because the pointee is *not* a ZST, that means that `count` is
            // at most `isize::MAX`, and thus the negation cannot overflow.
            unsafe { self.offset((count as isize).unchecked_neg()) }
        }
    }

    /// 计算指针对应的字节偏移量（为
    /// `.byte_offset((count as isize).wrapping_neg())`).
    ///
    /// `count` is in units of bytes.
    ///
    /// This is purely a convenience for casting to a `u8` pointer and
    /// using [`sub`][NonNull::sub] on it.
    ///
    /// For non-`Sized` pointees this operation changes only the data pointer,
    /// 而不改变元数据。
    ///
    /// # 安全性
    ///
    /// See [`sub`][NonNull::sub] for documentation and safety requirements.
    #[must_use]
    #[inline(always)]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    #[stable(feature = "non_null_convenience", since = "1.80.0")]
    #[rustc_const_stable(feature = "non_null_convenience", since = "1.80.0")]
    pub const unsafe fn byte_sub(self, count: usize) -> Self {
        // SAFETY: the caller must uphold the safety contract for `sub` and `byte_sub` has the same
        // safety contract.
        // Additionally safety contract of `sub` guarantees that the resulting pointer is pointing
        // to an allocation, there can't be an allocation at null, thus it's safe to construct
        // `NonNull`.
        unsafe { transmute(self.as_ptr().byte_sub(count)) }
    }

    /// 计算同一分配区域内两个指针之间的距离。返回值以
    /// units of T: the distance in bytes divided by `size_of::<T>()`.
    ///
    /// This is equivalent to `(self as isize - origin as isize) / (size_of::<T>() as isize)`,
    /// 只是它存在更多的未定义行为（UB）机会，以换取编译器对您操作的更好理解。
    /// better understanding what you are doing.
    ///
    /// The primary motivation of this method is for computing the `len` of an array/slice
    /// of `T` that you are currently representing as a "start" and "end" pointer
    /// 对于此用例，所有以下安全要求都很容易满足。
    /// In that case, `end.offset_from(start)` gets you the length of the array.
    ///
    /// 如果违反以下任何条件，结果将产生未定义行为：
    ///
    /// [`offset`]: #method.offset
    ///
    /// # 安全性
    ///
    /// If any of the following conditions are violated, the result is Undefined Behavior:
    ///
    /// * `self` and `origin` must either
    ///
    /// * 都源自指向同一 [分配] 的指针，且两个指针之间的内存范围必须在该对象的有效范围内。（请参见下面的示例。）
    ///   * both be *derived from* a pointer to the same [allocation], and the memory range between
    /// * 该对象的大小。
    ///
    /// 
    ///   of the size of `T`.
    ///
    /// As a consequence, the absolute distance between the pointers, in bytes, computed on
    /// mathematical integers (without "wrapping around"), cannot overflow an `isize`. This is
    /// implied by the in-bounds requirement, and the fact that no allocation can be larger
    /// than `isize::MAX` bytes.
    ///
    /// 对指针来自同一分配的要求主要是为了
    /// needed for `const`-compatibility: the distance between pointers into *different* allocated
    /// 然而，这一要求在运行时也存在，并可能被优化利用。如果您希望计算
    /// 不保证来自同一分配的指针之间的差异，请使用
    /// # Panics
    /// `(self.addr() as isize - origin.addr() as isize) / size_of::<T>()`.
    ///
    /// [`add`]: #method.add
    /// [allocation]: crate::ptr#allocation
    ///
    /// # Panics
    ///
    /// This function panics if `T` is a Zero-Sized Type ("ZST").
    ///
    /// # 基本用法：
    ///
    /// *错误* 用法：
    ///
    /// ```
    /// use std::ptr::NonNull;
    ///
    /// let a = [0; 5];
    /// let ptr1: NonNull<u32> = NonNull::from(&a[1]);
    /// let ptr2: NonNull<u32> = NonNull::from(&a[3]);
    /// unsafe {
    ///     assert_eq!(ptr2.offset_from(ptr1), 2);
    ///     assert_eq!(ptr1.offset_from(ptr2), -2);
    ///     assert_eq!(ptr1.offset(2), ptr2);
    ///     assert_eq!(ptr2.offset(-2), ptr1);
    /// }
    /// ```
    ///
    /// 计算同一分配中两个指针之间的距离。返回值以 **bytes** 为单位。
    ///
    /// ```rust,no_run
    /// use std::ptr::NonNull;
    ///
    /// let ptr1 = NonNull::new(Box::into_raw(Box::new(0u8))).unwrap();
    /// let ptr2 = NonNull::new(Box::into_raw(Box::new(1u8))).unwrap();
    /// let diff = (ptr2.addr().get() as isize).wrapping_sub(ptr1.addr().get() as isize);
    /// // Make ptr2_other an "alias" of ptr2.add(1), but derived from ptr1.
    /// let diff_plus_1 = diff.wrapping_add(1);
    /// let ptr2_other = NonNull::new(ptr1.as_ptr().wrapping_byte_offset(diff_plus_1)).unwrap();
    /// assert_eq!(ptr2.addr(), ptr2_other.addr());
    /// // Since ptr2_other and ptr2 are derived from pointers to different objects,
    /// // computing their offset is undefined behavior, even though
    /// // they point to addresses that are in-bounds of the same object!
    ///
    /// let one = unsafe { ptr2_other.offset_from(ptr2) }; // Undefined Behavior! ⚠️
    /// ```
    #[inline]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    #[stable(feature = "non_null_convenience", since = "1.80.0")]
    #[rustc_const_stable(feature = "non_null_convenience", since = "1.80.0")]
    pub const unsafe fn offset_from(self, origin: NonNull<T>) -> isize
    where
        T: Sized,
    {
        // SAFETY: the caller must uphold the safety contract for `offset_from`.
        unsafe { self.as_ptr().offset_from(origin.as_ptr()) }
    }

    /// Calculates the distance between two pointers within the same allocation. The returned value is in
    /// units of **bytes**.
    ///
    /// This is purely a convenience for casting to a `u8` pointer and
    /// using [`offset_from`][NonNull::offset_from] on it.
    ///
    /// For non-`Sized` pointees this operation considers only the data pointers,
    /// ignoring the metadata.
    ///
    /// # Safety
    ///
    /// See [`offset_from`][NonNull::offset_from] for documentation and safety requirements.
    #[inline(always)]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    #[stable(feature = "non_null_convenience", since = "1.80.0")]
    #[rustc_const_stable(feature = "non_null_convenience", since = "1.80.0")]
    pub const unsafe fn byte_offset_from<U: ?Sized>(self, origin: NonNull<U>) -> isize {
        // SAFETY: the caller must uphold the safety contract for `byte_offset_from`.
        unsafe { self.as_ptr().byte_offset_from(origin.as_ptr()) }
    }

    // N.B. `wrapping_offset``, `wrapping_add`, etc are not implemented because they can wrap to null

    /// 会计算出的相同值，但附加前提是偏移量
    /// `self` is equal to or greater than `origin`*. The returned value is in
    /// units of T: the distance in bytes is divided by `size_of::<T>()`.
    ///
    /// This computes the same value that [`offset_from`](#method.offset_from)
    /// would compute, but with the added precondition that the offset is
    /// guaranteed to be non-negative.  This method is equivalent to
    /// `usize::try_from(self.offset_from(origin)).unwrap_unchecked()`,
    /// 其安全前提条件得到满足：
    /// # 安全性
    ///
    /// This method can be though of as recovering the `count` that was passed
    /// to [`add`](#method.add) (or, with the parameters in the other order,
    /// to [`sub`](#method.sub)).  The following are all equivalent, assuming
    /// that their safety preconditions are met:
    /// ```rust
    /// # unsafe fn blah(ptr: std::ptr::NonNull<u32>, origin: std::ptr::NonNull<u32>, count: usize) -> bool { unsafe {
    /// ptr.offset_from_unsigned(origin) == count
    /// # &&
    /// origin.add(count) == ptr
    /// # &&
    /// ptr.sub(count) == origin
    /// # } }
    /// ```
    ///
    /// # Safety
    ///
    /// - The distance between the pointers must be non-negative (`self >= origin`)
    ///
    /// - *All* the safety conditions of [`offset_from`](#method.offset_from)
    /// apply to this method as well; see it for the full details.
    ///
    /// Importantly, despite the return type of this method being able to represent
    /// a larger offset, it's still *not permitted* to pass pointers which differ
    /// by more than `isize::MAX` *bytes*.  As such, the result of this method will
    /// always be less than or equal to `isize::MAX as usize`.
    ///
    /// # Panics
    ///
    /// This function panics if `T` is a Zero-Sized Type ("ZST").
    ///
    /// # 示例
    ///
    /// ```
    /// use std::ptr::NonNull;
    ///
    /// let a = [0; 5];
    /// let ptr1: NonNull<u32> = NonNull::from(&a[1]);
    /// let ptr2: NonNull<u32> = NonNull::from(&a[3]);
    /// unsafe {
    ///     assert_eq!(ptr2.offset_from_unsigned(ptr1), 2);
    ///     assert_eq!(ptr1.add(2), ptr2);
    ///     assert_eq!(ptr2.sub(2), ptr1);
    ///     assert_eq!(ptr2.offset_from_unsigned(ptr2), 0);
    /// }
    ///
    /// // This would be incorrect, as the pointers are not correctly ordered:
    /// // ptr1.offset_from_unsigned(ptr2)
    /// ```
    #[inline]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    #[stable(feature = "ptr_sub_ptr", since = "1.87.0")]
    #[rustc_const_stable(feature = "const_ptr_sub_ptr", since = "1.87.0")]
    pub const unsafe fn offset_from_unsigned(self, subtracted: NonNull<T>) -> usize
    where
        T: Sized,
    {
        // SAFETY: the caller must uphold the safety contract for `offset_from_unsigned`.
        unsafe { self.as_ptr().offset_from_unsigned(subtracted.as_ptr()) }
    }

    /// 计算同一分配区域内两个指针之间的距离，*已知*
    /// `self` is equal to or greater than `origin`*. The returned value is in
    /// 单位。
    ///
    /// This is purely a convenience for casting to a `u8` pointer and
    /// using [`offset_from_unsigned`][NonNull::offset_from_unsigned] on it.
    ///
    /// For non-`Sized` pointees this operation considers only the data pointers,
    /// 忽略元数据。
    ///
    /// # 安全性
    ///
    /// See [`offset_from_unsigned`][NonNull::offset_from_unsigned] for documentation and safety requirements.
    #[inline(always)]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    #[stable(feature = "ptr_sub_ptr", since = "1.87.0")]
    #[rustc_const_stable(feature = "const_ptr_sub_ptr", since = "1.87.0")]
    pub const unsafe fn byte_offset_from_unsigned<U: ?Sized>(self, origin: NonNull<U>) -> usize {
        // SAFETY: the caller must uphold the safety contract for `byte_offset_from_unsigned`.
        unsafe { self.as_ptr().byte_offset_from_unsigned(origin.as_ptr()) }
    }

    /// Reads the value from `self` without moving it. This leaves the
    /// memory in `self` unchanged.
    ///
    /// # 安全性
    ///
    /// See [`ptr::read`] for safety concerns and examples.
    ///
    /// [`ptr::read`]: crate::ptr::read()
    #[inline]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    #[stable(feature = "non_null_convenience", since = "1.80.0")]
    #[rustc_const_stable(feature = "non_null_convenience", since = "1.80.0")]
    pub const unsafe fn read(self) -> T
    where
        T: Sized,
    {
        // SAFETY: the caller must uphold the safety contract for `read`.
        unsafe { ptr::read(self.as_ptr()) }
    }

    /// Performs a volatile read of the value from `self` without moving it. This
    /// leaves the memory in `self` unchanged.
    ///
    /// 易失性操作旨在作用于 I/O 内存，并且保证
    /// 不会被编译器省略或重新排序于其他易失性操作中。
    /// # 安全性
    ///
    /// # 安全性
    ///
    /// See [`ptr::read_volatile`] for safety concerns and examples.
    ///
    /// [`ptr::read_volatile`]: crate::ptr::read_volatile()
    #[inline]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    #[stable(feature = "non_null_convenience", since = "1.80.0")]
    #[rustc_const_unstable(feature = "const_volatile", issue = "159094")]
    pub const unsafe fn read_volatile(self) -> T
    where
        T: Sized,
    {
        // SAFETY: the caller must uphold the safety contract for `read_volatile`.
        unsafe { ptr::read_volatile(self.as_ptr()) }
    }

    /// Reads the value from `self` without moving it. This leaves the
    /// memory in `self` unchanged.
    ///
    /// Unlike `read`, the pointer may be unaligned.
    ///
    /// # 安全性
    ///
    /// See [`ptr::read_unaligned`] for safety concerns and examples.
    ///
    /// [`ptr::read_unaligned`]: crate::ptr::read_unaligned()
    #[inline]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    #[stable(feature = "non_null_convenience", since = "1.80.0")]
    #[rustc_const_stable(feature = "non_null_convenience", since = "1.80.0")]
    pub const unsafe fn read_unaligned(self) -> T
    where
        T: Sized,
    {
        // SAFETY: the caller must uphold the safety contract for `read_unaligned`.
        unsafe { ptr::read_unaligned(self.as_ptr()) }
    }

    /// Copies `count * size_of::<T>()` bytes from `self` to `dest`. The source
    /// 和目标可能重叠。
    ///
    /// NOTE: this has the *same* argument order as [`ptr::copy`].
    ///
    /// # 安全性
    ///
    /// See [`ptr::copy`] for safety concerns and examples.
    ///
    /// [`ptr::copy`]: crate::ptr::copy()
    #[inline(always)]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    #[stable(feature = "non_null_convenience", since = "1.80.0")]
    #[rustc_const_stable(feature = "const_intrinsic_copy", since = "1.83.0")]
    pub const unsafe fn copy_to(self, dest: NonNull<T>, count: usize)
    where
        T: Sized,
    {
        // SAFETY: the caller must uphold the safety contract for `copy`.
        unsafe { ptr::copy(self.as_ptr(), dest.as_ptr(), count) }
    }

    /// Copies `count * size_of::<T>()` bytes from `self` to `dest`. The source
    /// 和目标*不能*重叠。
    ///
    /// NOTE: this has the *same* argument order as [`ptr::copy_nonoverlapping`].
    ///
    /// # 安全性
    ///
    /// See [`ptr::copy_nonoverlapping`] for safety concerns and examples.
    ///
    /// [`ptr::copy_nonoverlapping`]: crate::ptr::copy_nonoverlapping()
    #[inline(always)]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    #[stable(feature = "non_null_convenience", since = "1.80.0")]
    #[rustc_const_stable(feature = "const_intrinsic_copy", since = "1.83.0")]
    pub const unsafe fn copy_to_nonoverlapping(self, dest: NonNull<T>, count: usize)
    where
        T: Sized,
    {
        // SAFETY: the caller must uphold the safety contract for `copy_nonoverlapping`.
        unsafe { ptr::copy_nonoverlapping(self.as_ptr(), dest.as_ptr(), count) }
    }

    /// Copies `count * size_of::<T>()` bytes from `src` to `self`. The source
    /// 和目标可能重叠。
    ///
    /// NOTE: this has the *opposite* argument order of [`ptr::copy`].
    ///
    /// # 安全性
    ///
    /// See [`ptr::copy`] for safety concerns and examples.
    ///
    /// [`ptr::copy`]: crate::ptr::copy()
    #[inline(always)]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    #[stable(feature = "non_null_convenience", since = "1.80.0")]
    #[rustc_const_stable(feature = "const_intrinsic_copy", since = "1.83.0")]
    pub const unsafe fn copy_from(self, src: NonNull<T>, count: usize)
    where
        T: Sized,
    {
        // SAFETY: the caller must uphold the safety contract for `copy`.
        unsafe { ptr::copy(src.as_ptr(), self.as_ptr(), count) }
    }

    /// Copies `count * size_of::<T>()` bytes from `src` to `self`. The source
    /// 和目标*不能*重叠。
    ///
    /// NOTE: this has the *opposite* argument order of [`ptr::copy_nonoverlapping`].
    ///
    /// # 安全性
    ///
    /// See [`ptr::copy_nonoverlapping`] for safety concerns and examples.
    ///
    /// [`ptr::copy_nonoverlapping`]: crate::ptr::copy_nonoverlapping()
    #[inline(always)]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    #[stable(feature = "non_null_convenience", since = "1.80.0")]
    #[rustc_const_stable(feature = "const_intrinsic_copy", since = "1.83.0")]
    pub const unsafe fn copy_from_nonoverlapping(self, src: NonNull<T>, count: usize)
    where
        T: Sized,
    {
        // SAFETY: the caller must uphold the safety contract for `copy_nonoverlapping`.
        unsafe { ptr::copy_nonoverlapping(src.as_ptr(), self.as_ptr(), count) }
    }

    /// 执行被指向值的析构函数（如果有的话）。
    ///
    /// # 安全性
    ///
    /// See [`ptr::drop_in_place`] for safety concerns and examples.
    ///
    /// [`ptr::drop_in_place`]: crate::ptr::drop_in_place()
    #[inline(always)]
    #[stable(feature = "non_null_convenience", since = "1.80.0")]
    #[rustc_const_unstable(feature = "const_drop_in_place", issue = "109342")]
    pub const unsafe fn drop_in_place(mut self)
    where
        T: [const] Destruct,
    {
        // SAFETY: the caller must uphold the safety contract for `drop_in_place`.
        unsafe { ptr::drop_glue(self.as_mut()) }
    }

    /// 用给定值覆盖内存位置，而不读取或
    /// 丢弃旧值。
    ///
    /// # 安全性
    ///
    /// See [`ptr::write`] for safety concerns and examples.
    ///
    /// [`ptr::write`]: crate::ptr::write()
    #[inline(always)]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    #[stable(feature = "non_null_convenience", since = "1.80.0")]
    #[rustc_const_stable(feature = "const_ptr_write", since = "1.83.0")]
    pub const unsafe fn write(self, val: T)
    where
        T: Sized,
    {
        // SAFETY: the caller must uphold the safety contract for `write`.
        unsafe { ptr::write(self.as_ptr(), val) }
    }

    /// Invokes memset on the specified pointer, setting `count * size_of::<T>()`
    /// bytes of memory starting at `self` to `val`.
    ///
    /// # 安全性
    ///
    /// See [`ptr::write_bytes`] for safety concerns and examples.
    ///
    /// [`ptr::write_bytes`]: crate::ptr::write_bytes()
    #[inline(always)]
    #[doc(alias = "memset")]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    #[stable(feature = "non_null_convenience", since = "1.80.0")]
    #[rustc_const_stable(feature = "const_ptr_write", since = "1.83.0")]
    pub const unsafe fn write_bytes(self, val: u8, count: usize)
    where
        T: Sized,
    {
        // SAFETY: the caller must uphold the safety contract for `write_bytes`.
        unsafe { ptr::write_bytes(self.as_ptr(), val, count) }
    }

    /// 执行对内存位置的易失性写入操作，并传入给定值，而不
    /// 读取或丢弃旧值。
    ///
    /// 易失性操作旨在作用于 I/O 内存，并且保证
    /// 不会被编译器忽略或重新排序于其他易失性
    /// 操作。
    ///
    /// # 安全性
    ///
    /// See [`ptr::write_volatile`] for safety concerns and examples.
    ///
    /// [`ptr::write_volatile`]: crate::ptr::write_volatile()
    #[inline(always)]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    #[stable(feature = "non_null_convenience", since = "1.80.0")]
    #[rustc_const_unstable(feature = "const_volatile", issue = "159094")]
    pub const unsafe fn write_volatile(self, val: T)
    where
        T: Sized,
    {
        // SAFETY: the caller must uphold the safety contract for `write_volatile`.
        unsafe { ptr::write_volatile(self.as_ptr(), val) }
    }

    /// 用给定值覆盖内存位置，而不读取或
    /// 丢弃旧值。
    ///
    /// Unlike `write`, the pointer may be unaligned.
    ///
    /// # 安全性
    ///
    /// See [`ptr::write_unaligned`] for safety concerns and examples.
    ///
    /// [`ptr::write_unaligned`]: crate::ptr::write_unaligned()
    #[inline(always)]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    #[stable(feature = "non_null_convenience", since = "1.80.0")]
    #[rustc_const_stable(feature = "const_ptr_write", since = "1.83.0")]
    pub const unsafe fn write_unaligned(self, val: T)
    where
        T: Sized,
    {
        // SAFETY: the caller must uphold the safety contract for `write_unaligned`.
        unsafe { ptr::write_unaligned(self.as_ptr(), val) }
    }

    /// Replaces the value at `self` with `src`, returning the old
    /// ，同时不丢弃该值。
    ///
    /// # 安全性
    ///
    /// See [`ptr::replace`] for safety concerns and examples.
    ///
    /// [`ptr::replace`]: crate::ptr::replace()
    #[inline(always)]
    #[stable(feature = "non_null_convenience", since = "1.80.0")]
    #[rustc_const_stable(feature = "const_inherent_ptr_replace", since = "1.88.0")]
    pub const unsafe fn replace(self, src: T) -> T
    where
        T: Sized,
    {
        // SAFETY: the caller must uphold the safety contract for `replace`.
        unsafe { ptr::replace(self.as_ptr(), src) }
    }

    /// 交换同一类型的两个可修改位置的值，而不
    /// deinitializing either. They may overlap, unlike `mem::swap` which is
    /// 其他情况下等价。
    ///
    /// # 安全性
    ///
    /// See [`ptr::swap`] for safety concerns and examples.
    ///
    /// [`ptr::swap`]: crate::ptr::swap()
    #[inline(always)]
    #[stable(feature = "non_null_convenience", since = "1.80.0")]
    #[rustc_const_stable(feature = "const_swap", since = "1.85.0")]
    pub const unsafe fn swap(self, with: NonNull<T>)
    where
        T: Sized,
    {
        // SAFETY: the caller must uphold the safety contract for `swap`.
        unsafe { ptr::swap(self.as_ptr(), with.as_ptr()) }
    }

    /// 计算需要应用于指针以使其对齐的偏移量
    /// `align`.
    ///
    /// 如果无法使指针对齐，实现返回
    /// `usize::MAX`.
    ///
    /// The offset is expressed in number of `T` elements, and not bytes.
    ///
    /// 没有任何保证确保调整指针不会溢出或超出
    /// 指针所指的分配范围。由调用者确保返回的偏移量在所有非对齐方面均正确。
    /// 当在编译时评估期间调用此函数（该行为不稳定）时，实现
    ///
    /// When this is called during compile-time evaluation (which is unstable), the implementation
    /// may return `usize::MAX` in cases where that can never happen at runtime. This is because the
    /// 保证对齐的偏移量。例如，声明为 `[u8;
    /// N]` 的缓冲区可能分配在奇数或偶数地址上，但在编译时还不知道，因此执行结果必须适用于两种选择。因此不可能找到
    /// 保证为 2 对齐的偏移量。（此行为如不稳定 API 通常一样可能改变。）
    /// # Panics
    /// find an offset that is guaranteed to be 2-aligned. (This behavior is subject to change, as usual
    /// for unstable APIs.)
    ///
    /// # Panics
    ///
    /// The function panics if `align` is not a power-of-two.
    ///
    /// # 示例
    ///
    /// Accessing adjacent `u8` as `u16`
    ///
    /// ```
    /// use std::ptr::NonNull;
    ///
    /// # unsafe {
    /// let x = [5_u8, 6, 7, 8, 9];
    /// let ptr = NonNull::new(x.as_ptr() as *mut u8).unwrap();
    /// let offset = ptr.align_offset(align_of::<u16>());
    ///
    /// if offset < x.len() - 1 {
    ///     let u16_ptr = ptr.add(offset).cast::<u16>();
    ///     assert!(u16_ptr.read() == u16::from_ne_bytes([5, 6]) || u16_ptr.read() == u16::from_ne_bytes([6, 7]));
    /// } else {
    ///     // while the pointer can be aligned via `offset`, it would point
    ///     // outside the allocation
    /// }
    /// # }
    /// ```
    #[inline]
    #[must_use]
    #[stable(feature = "non_null_convenience", since = "1.80.0")]
    pub fn align_offset(self, align: usize) -> usize
    where
        T: Sized,
    {
        if !align.is_power_of_two() {
            panic!("align_offset: align is not a power-of-two");
        }

        {
            // SAFETY: `align` has been checked to be a power of 2 above.
            unsafe { ptr::align_offset(self.as_ptr(), align) }
        }
    }

    /// Returns whether the pointer is properly aligned for `T`.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::ptr::NonNull;
    ///
    /// // On some platforms, the alignment of i32 is less than 4.
    /// #[repr(align(4))]
    /// struct AlignedI32(i32);
    ///
    /// let data = AlignedI32(42);
    /// let ptr = NonNull::<AlignedI32>::from(&data);
    ///
    /// assert!(ptr.is_aligned());
    /// assert!(!NonNull::new(ptr.as_ptr().wrapping_byte_add(1)).unwrap().is_aligned());
    /// ```
    #[inline]
    #[must_use]
    #[stable(feature = "pointer_is_aligned", since = "1.79.0")]
    pub fn is_aligned(self) -> bool
    where
        T: Sized,
    {
        self.as_ptr().is_aligned()
    }

    /// Returns whether the pointer is aligned to `align`.
    ///
    /// For non-`Sized` pointees this operation considers only the data pointer,
    /// 忽略元数据。
    ///
    /// # 恐慌
    ///
    /// The function panics if `align` is not a power-of-two (this includes 0).
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(pointer_is_aligned_to)]
    ///
    /// // On some platforms, the alignment of i32 is less than 4.
    /// #[repr(align(4))]
    /// struct AlignedI32(i32);
    ///
    /// let data = AlignedI32(42);
    /// let ptr = &data as *const AlignedI32;
    ///
    /// assert!(ptr.is_aligned_to(1));
    /// assert!(ptr.is_aligned_to(2));
    /// assert!(ptr.is_aligned_to(4));
    ///
    /// assert!(ptr.wrapping_byte_add(2).is_aligned_to(2));
    /// assert!(!ptr.wrapping_byte_add(2).is_aligned_to(4));
    ///
    /// assert_ne!(ptr.is_aligned_to(8), ptr.wrapping_add(1).is_aligned_to(8));
    /// ```
    #[inline]
    #[must_use]
    #[unstable(feature = "pointer_is_aligned_to", issue = "96284")]
    pub fn is_aligned_to(self, align: usize) -> bool {
        self.as_ptr().is_aligned_to(align)
    }
}

impl<T> NonNull<T> {
    /// 从类型转换为其可能未初始化的版本。
    #[must_use]
    #[inline(always)]
    #[unstable(feature = "cast_maybe_uninit", issue = "145036")]
    pub const fn cast_uninit(self) -> NonNull<MaybeUninit<T>> {
        self.cast()
    }

    /// 从薄指针和长度创建一个非空原始切片。
    ///
    /// The `len` argument is the number of **elements**, not the number of bytes.
    ///
    /// See [`ptr::slice_from_raw_parts`] for more information.
    ///
    /// [`ptr::slice_from_raw_parts`]: crate::ptr::slice_from_raw_parts
    ///
    /// # 示例
    ///
    /// ```rust
    /// use std::ptr::NonNull;
    ///
    /// // create a slice pointer when starting out with a pointer to the first element
    /// let mut x = [5, 6, 7];
    /// let nonnull_pointer = NonNull::new(x.as_mut_ptr()).unwrap();
    /// let slice = nonnull_pointer.cast_slice(3);
    /// assert_eq!(unsafe { slice.as_ref()[2] }, 7);
    /// ```
    ///
    /// （注意，此示例人为演示了该方法的使用方式，）
    /// but `let slice = NonNull::from(&x[..]);` would be a better way to write code like this.)
    #[inline]
    #[must_use]
    #[stable(feature = "ptr_cast_slice", since = "1.101.0")]
    #[rustc_const_stable(feature = "ptr_cast_slice", since = "1.101.0")]
    pub const fn cast_slice(self, len: usize) -> NonNull<[T]> {
        NonNull::slice_from_raw_parts(self, len)
    }
}
impl<T> NonNull<MaybeUninit<T>> {
    /// 从可能未初始化的类型转换为其已初始化的版本。
    ///
    /// 这是安全的，因为UB 仅在指针被读取后
    /// 才可能发生。
    #[must_use]
    #[inline(always)]
    #[unstable(feature = "cast_maybe_uninit", issue = "145036")]
    pub const fn cast_init(self) -> NonNull<T> {
        self.cast()
    }
}

impl<T> NonNull<[T]> {
    /// 从薄指针和长度创建一个非空原始切片。
    ///
    /// The `len` argument is the number of **elements**, not the number of bytes.
    ///
    /// 此函数是安全的，但解引用返回值是不安全的。
    /// See the documentation of [`slice::from_raw_parts`] for slice safety requirements.
    ///
    /// # 示例
    ///
    /// ```rust
    /// use std::ptr::NonNull;
    ///
    /// // create a slice pointer when starting out with a pointer to the first element
    /// let mut x = [5, 6, 7];
    /// let nonnull_pointer = NonNull::new(x.as_mut_ptr()).unwrap();
    /// let slice = NonNull::slice_from_raw_parts(nonnull_pointer, 3);
    /// assert_eq!(unsafe { slice.as_ref()[2] }, 7);
    /// ```
    ///
    /// （注意，此示例人为演示了该方法的使用方式，）
    /// but `let slice = NonNull::from(&x[..]);` would be a better way to write code like this.)
    #[stable(feature = "nonnull_slice_from_raw_parts", since = "1.70.0")]
    #[rustc_const_stable(feature = "const_slice_from_raw_parts_mut", since = "1.83.0")]
    #[must_use]
    #[inline]
    pub const fn slice_from_raw_parts(data: NonNull<T>, len: usize) -> Self {
        // SAFETY: `data` is a `NonNull` pointer which is necessarily non-null
        unsafe { Self::new_unchecked(data.as_ptr().cast_slice(len)) }
    }

    /// 返回非空原始切片的长度。
    ///
    /// 返回值表示 **元素** 的数量，而非字节数。
    ///
    /// 即使非空原始切片无法解引用为切片，
    /// 因为指针没有有效的地址，此函数也是安全的。
    ///
    /// # 示例
    ///
    /// ```rust
    /// use std::ptr::NonNull;
    ///
    /// let slice: NonNull<[i8]> = NonNull::slice_from_raw_parts(NonNull::dangling(), 3);
    /// assert_eq!(slice.len(), 3);
    /// ```
    #[stable(feature = "slice_ptr_len_nonnull", since = "1.63.0")]
    #[rustc_const_stable(feature = "const_slice_ptr_len_nonnull", since = "1.63.0")]
    #[must_use]
    #[inline]
    pub const fn len(self) -> usize {
        self.as_ptr().len()
    }

    /// Returns `true` if the non-null raw slice has a length of 0.
    ///
    /// # 示例
    ///
    /// ```rust
    /// use std::ptr::NonNull;
    ///
    /// let slice: NonNull<[i8]> = NonNull::slice_from_raw_parts(NonNull::dangling(), 3);
    /// assert!(!slice.is_empty());
    /// ```
    #[stable(feature = "slice_ptr_is_empty_nonnull", since = "1.79.0")]
    #[rustc_const_stable(feature = "const_slice_ptr_is_empty_nonnull", since = "1.79.0")]
    #[must_use]
    #[inline]
    pub const fn is_empty(self) -> bool {
        self.len() == 0
    }

    /// 返回指向切片缓冲区的非空指针。
    ///
    /// # 示例
    ///
    /// ```rust
    /// #![feature(slice_ptr_get)]
    /// use std::ptr::NonNull;
    ///
    /// let slice: NonNull<[i8]> = NonNull::slice_from_raw_parts(NonNull::dangling(), 3);
    /// assert_eq!(slice.as_non_null_ptr(), NonNull::<i8>::dangling());
    /// ```
    #[inline]
    #[must_use]
    #[unstable(feature = "slice_ptr_get", issue = "74265")]
    pub const fn as_non_null_ptr(self) -> NonNull<T> {
        self.cast()
    }

    /// 返回指向切片缓冲区的原始指针。
    ///
    /// # 示例
    ///
    /// ```rust
    /// #![feature(slice_ptr_get)]
    /// use std::ptr::NonNull;
    ///
    /// let slice: NonNull<[i8]> = NonNull::slice_from_raw_parts(NonNull::dangling(), 3);
    /// assert_eq!(slice.as_mut_ptr(), NonNull::<i8>::dangling().as_ptr());
    /// ```
    #[inline]
    #[must_use]
    #[unstable(feature = "slice_ptr_get", issue = "74265")]
    #[lint::never_returns_null_ptr]
    pub const fn as_mut_ptr(self) -> *mut T {
        self.as_non_null_ptr().as_ptr()
    }

    /// 返回对可能未初始化值的切片的共享引用。与
    /// [`as_ref`], this does not require that the value has to be initialized.
    ///
    /// For the mutable counterpart see [`as_uninit_slice_mut`].
    ///
    /// [`as_ref`]: NonNull::as_ref
    /// [`as_uninit_slice_mut`]: NonNull::as_uninit_slice_mut
    ///
    /// # 安全性
    ///
    /// 调用此方法时，必须确保满足以下所有条件：
    ///
    /// * The pointer must be [valid] for reads for `ptr.len() * size_of::<T>()` many bytes,
    /// and it must be properly aligned. This means in particular:
    ///
    /// * 该切片的整个内存范围必须包含在一个分配中！
    /// 切片永远不能跨越多个分配。
    ///
    /// * 即使对于零长度切片，指针也必须对齐。
    /// 原因在于枚举布局优化可能依赖于引用使得
    /// 各种长度的切片都保持对齐且非空，以便区分。
    ///       them from other data. You can obtain a pointer that is usable as `data`
    ///       for zero-length slices using [`NonNull::dangling()`].
    ///
    /// * The total size `ptr.len() * size_of::<T>()` of the slice must be no larger than `isize::MAX`.
    ///   See the safety documentation of [`pointer::offset`].
    ///
    /// * You must enforce Rust's aliasing rules, since the returned lifetime `'a` is
    /// 任意选择的，不一定反映数据的实际生命周期。
    ///   In particular, while this reference exists, the memory the pointer points to must
    ///   not get mutated (except inside `UnsafeCell`).
    ///
    /// This applies even if the result of this method is unused!
    ///
    /// See also [`slice::from_raw_parts`].
    ///
    /// [valid]: crate::ptr#safety
    #[inline]
    #[must_use]
    #[unstable(feature = "ptr_as_uninit", issue = "75402")]
    pub const unsafe fn as_uninit_slice<'a>(self) -> &'a [MaybeUninit<T>] {
        // SAFETY: the caller must uphold the safety contract for `as_uninit_slice`.
        unsafe { slice::from_raw_parts(self.cast().as_ptr(), self.len()) }
    }

    /// 返回一个对可能未初始化值的切片的唯一引用。与
    /// [`as_mut`], this does not require that the value has to be initialized.
    ///
    /// For the shared counterpart see [`as_uninit_slice`].
    ///
    /// [`as_mut`]: NonNull::as_mut
    /// [`as_uninit_slice`]: NonNull::as_uninit_slice
    ///
    /// # 安全性
    ///
    /// 调用此方法时，必须确保以下所有条件成立：
    ///
    /// * The pointer must be [valid] for reads and writes for `ptr.len() * size_of::<T>()`
    /// 包含大量字节，并且必须正确对齐。具体来说：
    ///
    /// * 该切片的整个内存范围必须包含在一次分配中！
    /// 切片永远不能跨越多个分配。
    ///
    /// * 即使对于零长度切片，指针也必须对齐。
    /// 原因在于枚举布局优化可能依赖于引用使得
    /// 各种长度的切片都保持对齐且非空，以便区分。
    ///       them from other data. You can obtain a pointer that is usable as `data`
    ///       for zero-length slices using [`NonNull::dangling()`].
    ///
    /// * The total size `ptr.len() * size_of::<T>()` of the slice must be no larger than `isize::MAX`.
    ///   See the safety documentation of [`pointer::offset`].
    ///
    /// * You must enforce Rust's aliasing rules, since the returned lifetime `'a` is
    /// 任意选择的，不一定反映数据的实际生命周期。
    /// 特别是，只要这个引用存在，指针指向的内存就不能被访问（通过其他指针读取或写入）。
    /// not get accessed (read or written) through any other pointer.
    ///
    /// 即使该方法的返回值未被使用，此规则也适用！
    ///
    /// See also [`slice::from_raw_parts_mut`].
    ///
    /// [valid]: crate::ptr#safety
    ///
    /// # 示例
    ///
    /// ```rust
    /// #![feature(ptr_as_uninit)]
    ///
    /// use std::alloc::{Allocator, Layout, Global};
    /// use std::mem::MaybeUninit;
    /// use std::ptr::NonNull;
    ///
    /// let memory: NonNull<[u8]> = Global.allocate(Layout::new::<[u8; 32]>())?;
    /// // This is safe as `memory` is valid for reads and writes for `memory.len()` many bytes.
    /// // Note that calling `memory.as_mut()` is not allowed here as the content may be uninitialized.
    /// # #[allow(unused_variables)]
    /// let slice: &mut [MaybeUninit<u8>] = unsafe { memory.as_uninit_slice_mut() };
    /// # // Prevent leaks for Miri.
    /// # unsafe { Global.deallocate(memory.cast(), Layout::new::<[u8; 32]>()); }
    /// # Ok::<_, std::alloc::AllocError>(())
    /// ```
    #[inline]
    #[must_use]
    #[unstable(feature = "ptr_as_uninit", issue = "75402")]
    pub const unsafe fn as_uninit_slice_mut<'a>(self) -> &'a mut [MaybeUninit<T>] {
        // SAFETY: the caller must uphold the safety contract for `as_uninit_slice_mut`.
        unsafe { slice::from_raw_parts_mut(self.cast().as_ptr(), self.len()) }
    }

    /// 返回一个指向元素或子切片的原始指针，无需检查边界。
    /// 检查。
    ///
    /// # 安全性
    ///
    /// Calling this method with an [out-of-bounds index] or when `self` is not dereferenceable
    /// 属于 *[未定义行为]*，即使生成的指针未被使用也是如此。
    ///
    /// [out-of-bounds index]: #method.add
    /// [undefined behavior]: https://doc.rust-lang.org/reference/behavior-considered-undefined.html
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(slice_ptr_get)]
    /// use std::ptr::NonNull;
    ///
    /// let x = &mut [1, 2, 4];
    /// let x = NonNull::slice_from_raw_parts(NonNull::new(x.as_mut_ptr()).unwrap(), x.len());
    ///
    /// unsafe {
    ///     assert_eq!(x.get_unchecked_mut(1).as_ptr(), x.as_non_null_ptr().as_ptr().add(1));
    /// }
    /// ```
    #[unstable(feature = "slice_ptr_get", issue = "74265")]
    #[rustc_const_unstable(feature = "const_index", issue = "143775")]
    #[inline]
    pub const unsafe fn get_unchecked_mut<I>(self, index: I) -> NonNull<I::Output>
    where
        I: [const] SliceIndex<[T]>,
    {
        // SAFETY: the caller ensures that `self` is dereferenceable and `index` in-bounds.
        // As a consequence, the resulting pointer cannot be null.
        unsafe { NonNull::new_unchecked(self.as_ptr().get_unchecked_mut(index)) }
    }
}

#[stable(feature = "nonnull", since = "1.25.0")]
impl<T: PointeeSized> Clone for NonNull<T> {
    #[inline(always)]
    fn clone(&self) -> Self {
        *self
    }
}

#[stable(feature = "nonnull", since = "1.25.0")]
impl<T: PointeeSized> Copy for NonNull<T> {}

#[doc(hidden)]
#[unstable(feature = "trivial_clone", issue = "none")]
unsafe impl<T: PointeeSized> TrivialClone for NonNull<T> {}

#[unstable(feature = "coerce_unsized", issue = "18598")]
impl<T: PointeeSized, U: PointeeSized> CoerceUnsized<NonNull<U>> for NonNull<T> where T: Unsize<U> {}

#[unstable(feature = "dispatch_from_dyn", issue = "none")]
impl<T: PointeeSized, U: PointeeSized> DispatchFromDyn<NonNull<U>> for NonNull<T> where T: Unsize<U> {}

#[stable(feature = "nonnull", since = "1.25.0")]
impl<T: PointeeSized> fmt::Debug for NonNull<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        fmt::Pointer::fmt(&self.as_ptr(), f)
    }
}

#[stable(feature = "nonnull", since = "1.25.0")]
impl<T: PointeeSized> fmt::Pointer for NonNull<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        fmt::Pointer::fmt(&self.as_ptr(), f)
    }
}

#[stable(feature = "nonnull", since = "1.25.0")]
impl<T: PointeeSized> Eq for NonNull<T> {}

#[stable(feature = "nonnull", since = "1.25.0")]
impl<T: PointeeSized> PartialEq for NonNull<T> {
    #[inline]
    #[allow(ambiguous_wide_pointer_comparisons)]
    fn eq(&self, other: &Self) -> bool {
        self.as_ptr() == other.as_ptr()
    }
}

#[stable(feature = "nonnull", since = "1.25.0")]
impl<T: PointeeSized> Ord for NonNull<T> {
    #[inline]
    #[allow(ambiguous_wide_pointer_comparisons)]
    fn cmp(&self, other: &Self) -> Ordering {
        self.as_ptr().cmp(&other.as_ptr())
    }
}

#[stable(feature = "nonnull", since = "1.25.0")]
impl<T: PointeeSized> PartialOrd for NonNull<T> {
    #[inline]
    #[allow(ambiguous_wide_pointer_comparisons)]
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        self.as_ptr().partial_cmp(&other.as_ptr())
    }
}

#[stable(feature = "nonnull", since = "1.25.0")]
impl<T: PointeeSized> hash::Hash for NonNull<T> {
    #[inline]
    fn hash<H: hash::Hasher>(&self, state: &mut H) {
        self.as_ptr().hash(state)
    }
}

#[stable(feature = "nonnull", since = "1.25.0")]
#[rustc_const_unstable(feature = "const_convert", issue = "143773")]
const impl<T: PointeeSized> From<&mut T> for NonNull<T> {
    /// Converts a `&mut T` to a `NonNull<T>`.
    ///
    /// 此转换是安全的且无误的，因为引用不可能为 null。
    #[inline]
    fn from(r: &mut T) -> Self {
        NonNull::from_mut(r)
    }
}

#[stable(feature = "nonnull", since = "1.25.0")]
#[rustc_const_unstable(feature = "const_convert", issue = "143773")]
const impl<T: PointeeSized> From<&T> for NonNull<T> {
    /// Converts a `&T` to a `NonNull<T>`.
    ///
    /// 此转换是安全的且无误的，因为引用不可能为 null。
    #[inline]
    fn from(r: &T) -> Self {
        NonNull::from_ref(r)
    }
}
