use super::*;
use crate::cmp::Ordering::{Equal, Greater, Less};
use crate::intrinsics::const_eval_select;
use crate::mem::{self, SizedTypeProperties};
use crate::slice::{self, SliceIndex};

impl<T: PointeeSized> *const T {
    #[doc = include_str!("docs/is_null.md")]
    ///
    /// # 示例
    ///
    /// ```
    /// let s: &str = "Follow the rabbit";
    /// let ptr: *const u8 = s.as_ptr();
    /// assert!(!ptr.is_null());
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_ptr_is_null", since = "1.84.0")]
    #[rustc_diagnostic_item = "ptr_const_is_null"]
    #[inline]
    #[rustc_allow_const_fn_unstable(const_eval_select)]
    pub const fn is_null(self) -> bool {
        // Compare via a cast to a thin pointer, so fat pointers are only
        // considering their "data" part for null-ness.
        let ptr = self as *const u8;
        const_eval_select!(
            @capture { ptr: *const u8 } -> bool:
            // This use of `const_raw_ptr_comparison` has been explicitly blessed by t-lang.
            if const #[rustc_allow_const_fn_unstable(const_raw_ptr_comparison)] {
                match (ptr).guaranteed_eq(null_mut()) {
                    Some(res) => res,
                    // To remain maximally conservative, we stop execution when we don't
                    // know whether the pointer is null or not.
                    // We can *not* return `false` here, that would be unsound in `NonNull::new`!
                    None => panic!("null-ness of this pointer cannot be determined in const context"),
                }
            } else {
                ptr.addr() == 0
            }
        )
    }

    /// 转换为另一种类型的指针。
    #[stable(feature = "ptr_cast", since = "1.38.0")]
    #[rustc_const_stable(feature = "const_ptr_cast", since = "1.38.0")]
    #[rustc_diagnostic_item = "const_ptr_cast"]
    #[inline(always)]
    pub const fn cast<U>(self) -> *const U {
        self as _
    }

    /// 通过检查对齐情况，尝试将对象转换为另一种类型的指针。
    ///
    /// 如果指针正确对齐到目标类型，它将被
    /// cast to the target type. Otherwise, `None` is returned.
    ///
    /// # 示例
    ///
    /// ```rust
    /// let x = 0u64;
    ///
    /// let aligned: *const u64 = &x;
    /// let unaligned = unsafe { aligned.byte_add(1) };
    ///
    /// assert!(aligned.try_cast_aligned::<u32>().is_some());
    /// assert!(unaligned.try_cast_aligned::<u32>().is_none());
    /// ```
    #[stable(feature = "pointer_try_cast_aligned", since = "1.101.0")]
    #[must_use = "this returns the result of the operation, \
                  without modifying the original"]
    #[inline]
    pub fn try_cast_aligned<U>(self) -> Option<*const U> {
        if self.is_aligned_to(align_of::<U>()) { Some(self.cast()) } else { None }
    }

    /// 使用地址值创建新的另一种类型指针。
    ///
    /// This operation will ignore the address part of its `meta` operand and discard existing
    /// metadata of `self`. For pointers to a sized types (thin pointers), this has the same effect
    /// as a simple cast. For pointers to an unsized type (fat pointers) this recombines the address
    /// with new metadata such as slice lengths or `dyn`-vtable.
    ///
    /// The resulting pointer will have provenance of `self`. This operation is semantically the
    /// same as creating a new pointer with the data pointer value of `self` but the metadata of
    /// `meta`, being fat or thin depending on the `meta` operand.
    ///
    /// # 示例
    ///
    /// 该函数主要用于在可能的厚指针上启用指针运算。指针被转换为有大小限制的指针以利用偏移操作，然后
    /// 与其原始元数据重新组合。
    /// 与其原始元数据重新组合。
    ///
    /// ```
    /// #![feature(set_ptr_value)]
    /// # use core::fmt::Debug;
    /// let arr: [i32; 3] = [1, 2, 3];
    /// let mut ptr = arr.as_ptr() as *const dyn Debug;
    /// let thin = ptr as *const u8;
    /// unsafe {
    ///     ptr = thin.add(8).with_metadata_of(ptr);
    ///     # assert_eq!(*(ptr as *const i32), 3);
    ///     println!("{:?}", &*ptr); // will print "3"
    /// }
    /// ```
    ///
    /// # *错误* 用法
    ///
    /// The provenance from pointers is *not* combined. The result must only be used to refer to the
    /// address allowed by `self`.
    ///
    /// ```rust,no_run
    /// #![feature(set_ptr_value)]
    /// let x = 0u32;
    /// let y = 1u32;
    ///
    /// let x = (&x) as *const u32;
    /// let y = (&y) as *const u32;
    ///
    /// let offset = (x as usize - y as usize) / 4;
    /// let bad = x.wrapping_add(offset).with_metadata_of(y);
    ///
    /// // This dereference is UB. The pointer only has provenance for `x` but points to `y`.
    /// println!("{:?}", unsafe { &*bad });
    /// ```
    #[unstable(feature = "set_ptr_value", issue = "75091")]
    #[must_use = "returns a new pointer rather than modifying its argument"]
    #[inline]
    pub const fn with_metadata_of<U>(self, meta: *const U) -> *const U
    where
        U: PointeeSized,
    {
        from_raw_parts::<U>(self as *const (), metadata(meta))
    }

    /// 在不改变类型的情况下改变不可变性。
    ///
    /// This is a bit safer than `as` because it wouldn't silently change the type if the code is
    /// 暴露指针的 ["归属信息"][crate::ptr#provenance] 部分，以便将来在
    #[stable(feature = "ptr_const_cast", since = "1.65.0")]
    #[rustc_const_stable(feature = "ptr_const_cast", since = "1.65.0")]
    #[rustc_diagnostic_item = "ptr_cast_mut"]
    #[inline(always)]
    pub const fn cast_mut(self) -> *mut T {
        self as _
    }

    #[doc = include_str!("./docs/addr.md")]
    #[must_use]
    #[inline(always)]
    #[expect(clippy::transmutes_expressible_as_ptr_casts, reason = "implements pointer cast")]
    #[stable(feature = "strict_provenance", since = "1.84.0")]
    pub fn addr(self) -> usize {
        // A pointer-to-integer transmute currently has exactly the right semantics: it returns the
        // address without exposing the provenance. Note that this is *not* a stable guarantee about
        // transmute semantics, it relies on sysroot crates having special status.
        // SAFETY: Pointer-to-integer transmutes are valid (if you are okay with losing the
        // provenance).
        unsafe { mem::transmute(self.cast::<()>()) }
    }

    /// Exposes the ["provenance"][crate::ptr#provenance] part of the pointer for future use in
    /// [`with_exposed_provenance`] and returns the "address" portion.
    ///
    /// This is equivalent to `self as usize`, which semantically discards provenance information.
    /// Furthermore, this (like the `as` cast) has the implicit side-effect of marking the
    /// provenance as 'exposed', so on platforms that support it you can later call
    /// [`with_exposed_provenance`] to reconstitute the original pointer including its provenance.
    ///
    /// Due to its inherent ambiguity, [`with_exposed_provenance`] may not be supported by tools
    /// 在大多数平台上，这将产生与原始指针相同字节值的结果。
    /// [Strict Provenance][crate::ptr#strict-provenance] APIs such as [`with_addr`][pointer::with_addr]
    /// wherever possible, in which case [`addr`][pointer::addr] should be used instead of `expose_provenance`.
    ///
    /// On most platforms this will produce a value with the same bytes as the original pointer,
    /// 因为所有字节都用于描述地址。某些平台在指针中存储
    /// 额外信息时可能不支持此操作，因为“暴露”机制会限制此行为。
    /// side-effect which is required for [`with_exposed_provenance`] to work is typically not
    /// 可用。
    ///
    /// 这是一个 [Exposed Provenance][crate::ptr#exposed-provenance] API。
    ///
    /// [`with_exposed_provenance`]: with_exposed_provenance
    #[inline(always)]
    #[stable(feature = "exposed_provenance", since = "1.84.0")]
    #[expect(implicit_provenance_casts, reason = "this *is* the replacement")]
    pub fn expose_provenance(self) -> usize {
        self.cast::<()>() as usize
    }

    /// 使用给定的地址和 [provenance][crate::ptr#provenance] 创建一个新指针。
    /// `self`.
    ///
    /// This is similar to a `addr as *const T` cast, but copies
    /// the *provenance* of `self` to the new pointer.
    /// 这避免了一元强制类型转换的固有歧义。
    ///
    /// This is equivalent to using [`wrapping_offset`][pointer::wrapping_offset] to offset
    /// `self` to the given address, and therefore has all the same capabilities and restrictions.
    ///
    /// This is a [Strict Provenance][crate::ptr#strict-provenance] API.
    #[must_use]
    #[inline]
    #[stable(feature = "strict_provenance", since = "1.84.0")]
    pub fn with_addr(self, addr: usize) -> Self {
        // This should probably be an intrinsic to avoid doing any sort of arithmetic, but
        // meanwhile, we can implement it with `wrapping_offset`, which preserves the pointer's
        // provenance.
        let self_addr = self.addr() as isize;
        let dest_addr = addr as isize;
        let offset = dest_addr.wrapping_sub(self_addr);
        self.wrapping_byte_offset(offset)
    }

    /// Creates a new pointer by mapping `self`'s address to a new one, preserving the
    /// [provenance][crate::ptr#provenance] of `self`.
    ///
    /// This is a convenience for [`with_addr`][pointer::with_addr], see that method for details.
    ///
    /// 这是一个 [Strict Provenance][crate::ptr#strict-provenance] API。
    #[must_use]
    #[inline]
    #[stable(feature = "strict_provenance", since = "1.84.0")]
    pub fn map_addr(self, f: impl FnOnce(usize) -> usize) -> Self {
        self.with_addr(f(self.addr()))
    }

    /// 将（可能很长的）指针分解为数据指针和元数据组件。
    ///
    /// The pointer can be later reconstructed with [`from_raw_parts`].
    #[unstable(feature = "ptr_metadata", issue = "81513")]
    #[inline]
    pub const fn to_raw_parts(self) -> (*const (), <T as super::Pointee>::Metadata) {
        (self.cast(), metadata(self))
    }

    #[doc = include_str!("./docs/as_ref.md")]
    ///
    /// ```
    /// let ptr: *const u8 = &10u8 as *const u8;
    ///
    /// unsafe {
    ///     let val_back = ptr.as_ref_unchecked();
    ///     assert_eq!(val_back, &10);
    /// }
    /// ```
    ///
    /// # 示例
    ///
    /// ```
    /// let ptr: *const u8 = &10u8 as *const u8;
    ///
    /// unsafe {
    ///     if let Some(val_back) = ptr.as_ref() {
    ///         assert_eq!(val_back, &10);
    ///     }
    /// }
    /// ```
    ///
    ///
    /// [`is_null`]: #method.is_null
    /// [`as_uninit_ref`]: #method.as_uninit_ref
    /// [`as_ref_unchecked`]: #method.as_ref_unchecked
    #[stable(feature = "ptr_as_ref", since = "1.9.0")]
    #[rustc_const_stable(feature = "const_ptr_is_null", since = "1.84.0")]
    #[inline]
    pub const unsafe fn as_ref<'a>(self) -> Option<&'a T> {
        // SAFETY: the caller must guarantee that `self` is valid
        // for a reference if it isn't null.
        if self.is_null() { None } else { unsafe { Some(&*self) } }
    }

    /// 返回指向指针后值的共享引用。
    /// If the pointer may be null or the value may be uninitialized, [`as_uninit_ref`] must be used instead.
    /// If the pointer may be null, but the value is known to have been initialized, [`as_ref`] must be used instead.
    ///
    /// [`as_ref`]: #method.as_ref
    /// [`as_uninit_ref`]: #method.as_uninit_ref
    ///
    /// # 安全性
    ///
    /// 调用此方法时，必须确保
    /// the pointer is [convertible to a reference](crate::ptr#pointer-to-reference-conversion).
    ///
    /// # 示例
    ///
    /// ```
    /// let ptr: *const u8 = &10u8 as *const u8;
    ///
    /// unsafe {
    ///     assert_eq!(ptr.as_ref_unchecked(), &10);
    /// }
    /// ```
    #[stable(feature = "ptr_as_ref_unchecked", since = "1.95.0")]
    #[rustc_const_stable(feature = "ptr_as_ref_unchecked", since = "1.95.0")]
    #[inline]
    #[must_use]
    pub const unsafe fn as_ref_unchecked<'a>(self) -> &'a T {
        // SAFETY: the caller must guarantee that `self` is valid for a reference
        unsafe { &*self }
    }

    #[doc = include_str!("./docs/as_uninit_ref.md")]
    ///
    /// [`is_null`]: #method.is_null
    /// [`as_ref`]: #method.as_ref
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(ptr_as_uninit)]
    ///
    /// let ptr: *const u8 = &10u8 as *const u8;
    ///
    /// unsafe {
    ///     if let Some(val_back) = ptr.as_uninit_ref() {
    ///         assert_eq!(val_back.assume_init(), 10);
    ///     }
    /// }
    /// ```
    #[inline]
    #[unstable(feature = "ptr_as_uninit", issue = "75402")]
    pub const unsafe fn as_uninit_ref<'a>(self) -> Option<&'a MaybeUninit<T>>
    where
        T: Sized,
    {
        // SAFETY: the caller must guarantee that `self` meets all the
        // requirements for a reference.
        if self.is_null() { None } else { Some(unsafe { &*(self as *const MaybeUninit<T>) }) }
    }

    #[doc = include_str!("./docs/offset.md")]
    ///
    /// Consider using [`wrapping_offset`](#method.wrapping_offset) instead if these constraints are
    /// 能够实现更积极的编译器优化。
    /// # 示例
    ///
    /// # 向指针添加有符号的字节偏移量。
    ///
    /// ```
    /// let s: &str = "123";
    /// let ptr: *const u8 = s.as_ptr();
    ///
    /// unsafe {
    ///     assert_eq!(*ptr.offset(1) as char, '2');
    ///     assert_eq!(*ptr.offset(2) as char, '3');
    /// }
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[must_use = "returns a new pointer rather than modifying its argument"]
    #[rustc_const_stable(feature = "const_ptr_offset", since = "1.61.0")]
    #[inline(always)]
    #[track_caller]
    pub const unsafe fn offset(self, count: isize) -> *const T
    where
        T: Sized,
    {
        #[inline]
        #[rustc_allow_const_fn_unstable(const_eval_select)]
        const fn runtime_offset_nowrap(this: *const (), count: isize, size: usize) -> bool {
            // We can use const_eval_select here because this is only for UB checks.
            const_eval_select!(
                @capture { this: *const (), count: isize, size: usize } -> bool:
                if const {
                    true
                } else {
                    // `size` is the size of a Rust type, so we know that
                    // `size <= isize::MAX` and thus `as` cast here is not lossy.
                    let Some(byte_offset) = count.checked_mul(size as isize) else {
                        return false;
                    };
                    let (_, overflow) = this.addr().overflowing_add_signed(byte_offset);
                    !overflow
                }
            )
        }

        ub_checks::assert_unsafe_precondition!(
            check_language_ub,
            "ptr::offset requires the address calculation to not overflow",
            (
                this: *const () = self as *const (),
                count: isize = count,
                size: usize = size_of::<T>(),
            ) => runtime_offset_nowrap(this, count, size)
        );

        // SAFETY: the caller must uphold the safety contract for `offset`.
        unsafe { intrinsics::offset(self, count) }
    }

    /// Adds a signed offset in bytes to a pointer.
    ///
    /// `count` is in units of **bytes**.
    ///
    /// This is purely a convenience for casting to a `u8` pointer and
    /// using [offset][pointer::offset] on it.
    ///
    /// For non-`Sized` pointees this operation changes only the data pointer,
    /// # 安全性
    ///
    /// # 有关文档和安全要求，请参阅 [offset][pointer::offset]。
    ///
    /// 使用包装算术向指针添加有符号的字节偏移量。
    #[must_use]
    #[inline(always)]
    #[stable(feature = "pointer_byte_offsets", since = "1.75.0")]
    #[rustc_const_stable(feature = "const_pointer_byte_offsets", since = "1.75.0")]
    #[track_caller]
    pub const unsafe fn byte_offset(self, count: isize) -> Self {
        // SAFETY: the caller must uphold the safety contract for `offset`.
        unsafe { self.cast::<u8>().offset(count).with_metadata_of(self) }
    }

    /// Adds a signed offset to a pointer using wrapping arithmetic.
    ///
    /// `count` is in units of T; e.g., a `count` of 3 represents a pointer
    /// offset of `3 * size_of::<T>()` bytes.
    ///
    /// # 安全性
    ///
    /// 此操作本身总是安全的，但使用得到的指针则不是
    ///
    /// The resulting pointer "remembers" the [allocation] that `self` points to
    /// (this is called "[Provenance](ptr/index.html#provenance)").
    /// 不得用该指针读取或写入其他分配
    ///
    /// In other words, `let z = x.wrapping_offset((y as isize) - (x as isize))` does *not* make `z`
    /// the same as `y` even if we assume `T` has size `1` and there is no overflow: `z` is still
    /// attached to the object `x` is attached to, and dereferencing it is Undefined Behavior unless
    /// `x` and `y` point into the same allocation.
    ///
    /// Compared to [`offset`], this method basically delays the requirement of staying within the
    /// same allocation: [`offset`] is immediate Undefined Behavior when crossing object
    /// boundaries; `wrapping_offset` produces a pointer but still leads to Undefined Behavior if a
    /// pointer is dereferenced when it is out-of-bounds of the object it is attached to. [`offset`]
    /// 离开分配并在稍后重新进入是允许的。
    ///
    /// # 示例
    /// 使用包装算术向指针添加有符号的字节偏移量
    /// `x.wrapping_offset(o).wrapping_offset(o.wrapping_neg())` is always the same as `x`. In other
    /// words, leaving the allocation and then re-entering it later is permitted.
    ///
    /// [`offset`]: #method.offset
    /// [allocation]: crate::ptr#allocation
    ///
    /// # 的文档。
    ///
    /// ```
    /// # use std::fmt::Write;
    /// // Iterate using a raw pointer in increments of two elements
    /// let data = [1u8, 2, 3, 4, 5];
    /// let mut ptr: *const u8 = data.as_ptr();
    /// let step = 2;
    /// let end_rounded_up = ptr.wrapping_offset(6);
    ///
    /// let mut out = String::new();
    /// while ptr != end_rounded_up {
    ///     unsafe {
    ///         write!(&mut out, "{}, ", *ptr)?;
    ///     }
    ///     ptr = ptr.wrapping_offset(step);
    /// }
    /// assert_eq!(out.as_str(), "1, 3, 5, ");
    /// # std::fmt::Result::Ok(())
    /// ```
    #[stable(feature = "ptr_wrapping_offset", since = "1.16.0")]
    #[must_use = "returns a new pointer rather than modifying its argument"]
    #[rustc_const_stable(feature = "const_ptr_offset", since = "1.61.0")]
    #[inline(always)]
    pub const fn wrapping_offset(self, count: isize) -> *const T
    where
        T: Sized,
    {
        // SAFETY: the `arith_offset` intrinsic has no prerequisites to be called.
        unsafe { intrinsics::arith_offset(self, count) }
    }

    /// Adds a signed offset in bytes to a pointer using wrapping arithmetic.
    ///
    /// `count` is in units of **bytes**.
    ///
    /// This is purely a convenience for casting to a `u8` pointer and
    /// using [wrapping_offset][pointer::wrapping_offset] on it. See that method
    /// for documentation.
    ///
    /// For non-`Sized` pointees this operation changes only the data pointer,
    /// leaving the metadata untouched.
    #[must_use]
    #[inline(always)]
    #[stable(feature = "pointer_byte_offsets", since = "1.75.0")]
    #[rustc_const_stable(feature = "const_pointer_byte_offsets", since = "1.75.0")]
    pub const fn wrapping_byte_offset(self, count: isize) -> Self {
        self.cast::<u8>().wrapping_offset(count).with_metadata_of(self)
    }

    /// ## 示例
    ///
    /// This is convenience for `ptr.map_addr(|a| a & mask)`.
    ///
    /// For non-`Sized` pointees this operation changes only the data pointer,
    /// 但具有更多导致未定义行为的机会，以换取编译器支持
    ///
    /// ## Examples
    ///
    /// ```
    /// #![feature(ptr_mask)]
    /// let v = 17_u32;
    /// let ptr: *const u32 = &v;
    ///
    /// // `u32` is 4 bytes aligned,
    /// // which means that lower 2 bits are always 0.
    /// let tag_mask = 0b11;
    /// let ptr_mask = !tag_mask;
    ///
    /// // We can store something in these lower bits
    /// let tagged_ptr = ptr.map_addr(|a| a | 0b10);
    ///
    /// // Get the "tag" back
    /// let tag = tagged_ptr.addr() & tag_mask;
    /// assert_eq!(tag, 0b10);
    ///
    /// // Note that `tagged_ptr` is unaligned, it's UB to read from it.
    /// // To get original pointer `mask` can be used:
    /// let masked_ptr = tagged_ptr.mask(ptr_mask);
    /// assert_eq!(unsafe { *masked_ptr }, 17);
    /// ```
    #[unstable(feature = "ptr_mask", issue = "98290")]
    #[must_use = "returns a new pointer rather than modifying its argument"]
    #[inline(always)]
    pub fn mask(self, mask: usize) -> *const T {
        intrinsics::ptr_mask(self.cast::<()>(), mask).with_metadata_of(self)
    }

    /// Calculates the distance between two pointers within the same allocation. The returned value is in
    /// units of T: the distance in bytes divided by `size_of::<T>()`.
    ///
    /// This is equivalent to `(self as isize - origin as isize) / (size_of::<T>() as isize)`,
    /// except that it has a lot more opportunities for UB, in exchange for the compiler
    /// 更好地理解您正在执行的操作。
    ///
    /// The primary motivation of this method is for computing the `len` of an array/slice
    /// of `T` that you are currently representing as a "start" and "end" pointer
    /// （其中“结束”指的是数组的最后一个位置）。
    /// In that case, `end.offset_from(start)` gets you the length of the array.
    ///
    /// 对于此用例，所有以下安全要求都很容易满足。
    ///
    /// [`offset`]: #method.offset
    ///
    /// # 安全性
    ///
    /// 如果违反以下任何条件，结果将产生未定义行为：
    ///
    /// * `self` and `origin` must either
    ///
    /// * 指向同一个地址，或
    /// * 都源自 [derived from][crate::ptr#provenance] 指向同一个 [allocation]，且两个指针之间的内存范围必须在该对象的边界内。（参见下面的示例。）
    ///     the two pointers must be in bounds of that object. (See below for an example.)
    ///
    /// 作为结果，在
    ///   of the size of `T`.
    ///
    /// As a consequence, the absolute distance between the pointers, in bytes, computed on
    /// mathematical integers (without "wrapping around"), cannot overflow an `isize`. This is
    /// implied by the in-bounds requirement, and the fact that no allocation can be larger
    /// than `isize::MAX` bytes.
    ///
    /// 指针之间的差异，请使用
    /// needed for `const`-compatibility: the distance between pointers into *different* allocated
    /// objects is not known at compile-time. However, the requirement also exists at
    /// # 示例
    /// 基本用法：
    /// `(self.addr() as isize - origin.addr() as isize) / size_of::<T>()`.
    ///
    /// [`add`]: #method.add
    /// [allocation]: crate::ptr#allocation
    ///
    /// # *错误* 用法：
    ///
    /// This function panics if `T` is a Zero-Sized Type ("ZST").
    ///
    /// # Examples
    ///
    /// Basic usage:
    ///
    /// ```
    /// let a = [0; 5];
    /// let ptr1: *const i32 = &a[1];
    /// let ptr2: *const i32 = &a[3];
    /// unsafe {
    ///     assert_eq!(ptr2.offset_from(ptr1), 2);
    ///     assert_eq!(ptr1.offset_from(ptr2), -2);
    ///     assert_eq!(ptr1.offset(2), ptr2);
    ///     assert_eq!(ptr2.offset(-2), ptr1);
    /// }
    /// ```
    ///
    /// *Incorrect* usage:
    ///
    /// ```rust,no_run
    /// let ptr1 = Box::into_raw(Box::new(0u8)) as *const u8;
    /// let ptr2 = Box::into_raw(Box::new(1u8)) as *const u8;
    /// let diff = (ptr2 as isize).wrapping_sub(ptr1 as isize);
    /// // Make ptr2_other an "alias" of ptr2.add(1), but derived from ptr1.
    /// let ptr2_other = (ptr1 as *const u8).wrapping_offset(diff).wrapping_offset(1);
    /// assert_eq!(ptr2 as usize, ptr2_other as usize);
    /// // Since ptr2_other and ptr2 are derived from pointers to different objects,
    /// // computing their offset is undefined behavior, even though
    /// // they point to addresses that are in-bounds of the same object!
    /// unsafe {
    ///     let one = ptr2_other.offset_from(ptr2); // Undefined Behavior! ⚠️
    /// }
    /// ```
    #[stable(feature = "ptr_offset_from", since = "1.47.0")]
    #[rustc_const_stable(feature = "const_ptr_offset_from", since = "1.65.0")]
    #[inline(always)]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    pub const unsafe fn offset_from(self, origin: *const T) -> isize
    where
        T: Sized,
    {
        let pointee_size = size_of::<T>();
        assert!(0 < pointee_size && pointee_size <= isize::MAX as usize);
        // SAFETY: the caller must uphold the safety contract for `ptr_offset_from`.
        unsafe { intrinsics::ptr_offset_from(self, origin) }
    }

    /// 忽略元数据。
    /// # 安全性
    ///
    /// This is purely a convenience for casting to a `u8` pointer and
    /// using [`offset_from`][pointer::offset_from] on it.
    ///
    /// For non-`Sized` pointees this operation considers only the data pointers,
    /// ignoring the metadata.
    ///
    /// # Safety
    ///
    /// See [`offset_from`][pointer::offset_from] for documentation and safety requirements.
    #[inline(always)]
    #[stable(feature = "pointer_byte_offsets", since = "1.75.0")]
    #[rustc_const_stable(feature = "const_pointer_byte_offsets", since = "1.75.0")]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    pub const unsafe fn byte_offset_from<U: ?Sized>(self, origin: *const U) -> isize {
        // SAFETY: the caller must uphold the safety contract for `offset_from`.
        unsafe { self.cast::<u8>().offset_from(origin.cast::<u8>()) }
    }

    /// Calculates the distance between two pointers within the same allocation, *where it's known that
    /// `self` is equal to or greater than `origin`*. The returned value is in
    /// units of T: the distance in bytes is divided by `size_of::<T>()`.
    ///
    /// This computes the same value that [`offset_from`](#method.offset_from)
    /// 会进行计算，但附加前提是偏移量
    /// 保证为非负值。此方法等同于
    /// `usize::try_from(self.offset_from(origin)).unwrap_unchecked()`,
    /// 但它向优化器提供了更多信息，优化器可以
    /// 有时允许某些后端进行稍好的优化。
    ///
    /// This method can be thought of as recovering the `count` that was passed
    /// to [`add`](#method.add) (or, with the parameters in the other order,
    /// to [`sub`](#method.sub)).  The following are all equivalent, assuming
    /// 其安全前提条件得到满足：
    /// ```rust
    /// # unsafe fn blah(ptr: *const i32, origin: *const i32, count: usize) -> bool { unsafe {
    /// ptr.offset_from_unsigned(origin) == count
    /// # &&
    /// origin.add(count) == ptr
    /// # &&
    /// ptr.sub(count) == origin
    /// # } }
    /// ```
    ///
    /// # 安全性
    ///
    /// - The distance between the pointers must be non-negative (`self >= origin`)
    ///
    /// - *All* the safety conditions of [`offset_from`](#method.offset_from)
    /// 同样适用于此方法；详见完整说明。
    ///
    /// 重要的是，尽管此方法的返回类型可以表示
    /// 更大的偏移量，仍然不允许传递相差
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
    /// let a = [0; 5];
    /// let ptr1: *const i32 = &a[1];
    /// let ptr2: *const i32 = &a[3];
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
    #[stable(feature = "ptr_sub_ptr", since = "1.87.0")]
    #[rustc_const_stable(feature = "const_ptr_sub_ptr", since = "1.87.0")]
    #[inline]
    #[track_caller]
    pub const unsafe fn offset_from_unsigned(self, origin: *const T) -> usize
    where
        T: Sized,
    {
        #[rustc_allow_const_fn_unstable(const_eval_select)]
        const fn runtime_ptr_ge(this: *const (), origin: *const ()) -> bool {
            const_eval_select!(
                @capture { this: *const (), origin: *const () } -> bool:
                if const {
                    true
                } else {
                    this >= origin
                }
            )
        }

        ub_checks::assert_unsafe_precondition!(
            check_language_ub,
            "ptr::offset_from_unsigned requires `self >= origin`",
            (
                this: *const () = self as *const (),
                origin: *const () = origin as *const (),
            ) => runtime_ptr_ge(this, origin)
        );

        let pointee_size = size_of::<T>();
        assert!(0 < pointee_size && pointee_size <= isize::MAX as usize);
        // SAFETY: the caller must uphold the safety contract for `ptr_offset_from_unsigned`.
        unsafe { intrinsics::ptr_offset_from_unsigned(self, origin) }
    }

    /// Calculates the distance between two pointers within the same allocation, *where it's known that
    /// `self` is equal to or greater than `origin`*. The returned value is in
    /// **字节**为单位。
    ///
    /// This is purely a convenience for casting to a `u8` pointer and
    /// using [`offset_from_unsigned`][pointer::offset_from_unsigned] on it.
    ///
    /// For non-`Sized` pointees this operation considers only the data pointers,
    /// 忽略元数据。
    ///
    /// # 安全性
    ///
    /// See [`offset_from_unsigned`][pointer::offset_from_unsigned] for documentation and safety requirements.
    #[stable(feature = "ptr_sub_ptr", since = "1.87.0")]
    #[rustc_const_stable(feature = "const_ptr_sub_ptr", since = "1.87.0")]
    #[inline]
    #[track_caller]
    pub const unsafe fn byte_offset_from_unsigned<U: ?Sized>(self, origin: *const U) -> usize {
        // SAFETY: the caller must uphold the safety contract for `offset_from_unsigned`.
        unsafe { self.cast::<u8>().offset_from_unsigned(origin.cast::<u8>()) }
    }

    /// 返回两个指针是否保证相等。
    ///
    /// At runtime this function behaves like `Some(self == other)`.
    /// 然而，在某些上下文（例如编译时评估）中，
    /// 无法总是确定两个指针是否相等，因此此函数可能会
    /// spuriously return `None` for pointers that later actually turn out to have its equality known.
    /// But when it returns `Some`, the pointers' equality is guaranteed to be known.
    ///
    /// The return value may change from `Some` to `None` and vice versa depending on the compiler
    /// 版本和 unsafe 代码不得
    /// 依赖此函数的结果以确保正确性。建议仅使用此函数
    /// for performance optimizations where spurious `None` return values by this function do not
    /// 不会影响结果，只涉及性能方面的影响。
    /// 使用此方法使运行时和编译时代码行为不同所带来的后果尚未被研究。不应使用此方法来引入此类差异，且在我们更好地理解此问题之前也不应使其稳定化。
    /// 使用此方法不应引入此类差异，在获得更好理解之前也不应使其稳定化。
    /// 使用此方法不应引入差异，在我们更好地理解此问题之前也不应使其稳定化。
    /// 返回两个指针是否必然不相等。
    #[unstable(feature = "const_raw_ptr_comparison", issue = "53020")]
    #[rustc_const_unstable(feature = "const_raw_ptr_comparison", issue = "53020")]
    #[inline]
    pub const fn guaranteed_eq(self, other: *const T) -> Option<bool>
    where
        T: Sized,
    {
        match intrinsics::ptr_guaranteed_cmp(self, other) {
            2 => None,
            other => Some(other == 1),
        }
    }

    /// Returns whether two pointers are guaranteed to be inequal.
    ///
    /// At runtime this function behaves like `Some(self != other)`.
    /// However, in some contexts (e.g., compile-time evaluation),
    /// it is not always possible to determine inequality of two pointers, so this function may
    /// spuriously return `None` for pointers that later actually turn out to have its inequality known.
    /// But when it returns `Some`, the pointers' inequality is guaranteed to be known.
    ///
    /// The return value may change from `Some` to `None` and vice versa depending on the compiler
    /// unsafe 代码不得依赖此函数的结果来确保正确性。建议仅用于性能优化，而不依赖此函数的结果。
    /// rely on the result of this function for soundness. It is suggested to only use this function
    /// for performance optimizations where spurious `None` return values by this function do not
    /// 不会影响结果，仅涉及性能方面的影响。
    /// 使用此方法使运行时和编译时代码行为不同所带来的后果尚未被研究。不应使用此方法来引入此类差异。
    /// 使用此方法使运行时和编译时代码行为不同所带来的后果尚未被研究。不应使用此方法来引入此类差异。
    /// 不应使用此方法来引入此类差异，在我们更好地理解此问题之前也不应使其稳定化。
    /// of this issue.
    #[unstable(feature = "const_raw_ptr_comparison", issue = "53020")]
    #[rustc_const_unstable(feature = "const_raw_ptr_comparison", issue = "53020")]
    #[inline]
    pub const fn guaranteed_ne(self, other: *const T) -> Option<bool>
    where
        T: Sized,
    {
        match self.guaranteed_eq(other) {
            None => None,
            Some(eq) => Some(!eq),
        }
    }

    #[doc = include_str!("./docs/add.md")]
    ///
    /// Consider using [`wrapping_add`](#method.wrapping_add) instead if these constraints are
    /// 能够启用更激进的编译器优化。
    /// 能够启用更激进的编译器优化。
    ///
    /// # 示例
    ///
    /// ```
    /// let s: &str = "123";
    /// let ptr: *const u8 = s.as_ptr();
    ///
    /// unsafe {
    ///     assert_eq!(*ptr.add(1), b'2');
    ///     assert_eq!(*ptr.add(2), b'3');
    /// }
    /// ```
    #[stable(feature = "pointer_methods", since = "1.26.0")]
    #[must_use = "returns a new pointer rather than modifying its argument"]
    #[rustc_const_stable(feature = "const_ptr_offset", since = "1.61.0")]
    #[inline(always)]
    #[track_caller]
    pub const unsafe fn add(self, count: usize) -> Self
    where
        T: Sized,
    {
        #[cfg(debug_assertions)]
        #[inline]
        #[rustc_allow_const_fn_unstable(const_eval_select)]
        const fn runtime_add_nowrap(this: *const (), count: usize, size: usize) -> bool {
            const_eval_select!(
                @capture { this: *const (), count: usize, size: usize } -> bool:
                if const {
                    true
                } else {
                    let Some(byte_offset) = count.checked_mul(size) else {
                        return false;
                    };
                    let (_, overflow) = this.addr().overflowing_add(byte_offset);
                    byte_offset <= (isize::MAX as usize) && !overflow
                }
            )
        }

        #[cfg(debug_assertions)] // Expensive, and doesn't catch much in the wild.
        ub_checks::assert_unsafe_precondition!(
            check_language_ub,
            "ptr::add requires that the address calculation does not overflow",
            (
                this: *const () = self as *const (),
                count: usize = count,
                size: usize = size_of::<T>(),
            ) => runtime_add_nowrap(this, count, size)
        );

        // SAFETY: the caller must uphold the safety contract for `offset`.
        unsafe { intrinsics::offset(self, count) }
    }

    /// 向指针添加无符号字节偏移量。
    ///
    /// `count` is in units of bytes.
    ///
    /// This is purely a convenience for casting to a `u8` pointer and
    /// 使用 [add][pointer::add] 操作它。
    ///
    /// For non-`Sized` pointees this operation changes only the data pointer,
    /// 元数据保持不变。
    ///
    /// # 安全性
    ///
    /// 有关文档和安全要求，请参阅 [add][pointer::add]。
    #[must_use]
    #[inline(always)]
    #[stable(feature = "pointer_byte_offsets", since = "1.75.0")]
    #[rustc_const_stable(feature = "const_pointer_byte_offsets", since = "1.75.0")]
    #[track_caller]
    pub const unsafe fn byte_add(self, count: usize) -> Self {
        // SAFETY: the caller must uphold the safety contract for `add`.
        unsafe { self.cast::<u8>().add(count).with_metadata_of(self) }
    }

    #[doc = include_str!("./docs/sub.md")]
    ///
    /// Consider using [`wrapping_sub`](#method.wrapping_sub) instead if these constraints are
    /// 能够启用更激进的编译器优化。
    /// 能够启用更激进的编译器优化。
    ///
    /// # 示例
    ///
    /// ```
    /// let s: &str = "123";
    ///
    /// unsafe {
    ///     let end: *const u8 = s.as_ptr().add(3);
    ///     assert_eq!(*end.sub(1), b'3');
    ///     assert_eq!(*end.sub(2), b'2');
    /// }
    /// ```
    #[stable(feature = "pointer_methods", since = "1.26.0")]
    #[must_use = "returns a new pointer rather than modifying its argument"]
    #[rustc_const_stable(feature = "const_ptr_offset", since = "1.61.0")]
    #[inline(always)]
    #[track_caller]
    pub const unsafe fn sub(self, count: usize) -> Self
    where
        T: Sized,
    {
        #[cfg(debug_assertions)]
        #[inline]
        #[rustc_allow_const_fn_unstable(const_eval_select)]
        const fn runtime_sub_nowrap(this: *const (), count: usize, size: usize) -> bool {
            const_eval_select!(
                @capture { this: *const (), count: usize, size: usize } -> bool:
                if const {
                    true
                } else {
                    let Some(byte_offset) = count.checked_mul(size) else {
                        return false;
                    };
                    byte_offset <= (isize::MAX as usize) && this.addr() >= byte_offset
                }
            )
        }

        #[cfg(debug_assertions)] // Expensive, and doesn't catch much in the wild.
        ub_checks::assert_unsafe_precondition!(
            check_language_ub,
            "ptr::sub requires that the address calculation does not overflow",
            (
                this: *const () = self as *const (),
                count: usize = count,
                size: usize = size_of::<T>(),
            ) => runtime_sub_nowrap(this, count, size)
        );

        if T::IS_ZST {
            // Pointer arithmetic does nothing when the pointee is a ZST.
            self
        } else {
            // SAFETY: the caller must uphold the safety contract for `offset`.
            // Because the pointee is *not* a ZST, that means that `count` is
            // at most `isize::MAX`, and thus the negation cannot overflow.
            unsafe { intrinsics::offset(self, intrinsics::unchecked_sub(0, count as isize)) }
        }
    }

    /// 从指针减去无符号字节偏移量。
    ///
    /// `count` is in units of bytes.
    ///
    /// This is purely a convenience for casting to a `u8` pointer and
    /// 可以使用 [sub][pointer::sub] 对它进行操作。
    ///
    /// For non-`Sized` pointees this operation changes only the data pointer,
    /// 元数据保持不变。
    ///
    /// # 安全性
    ///
    /// 有关文档和安全要求，请参阅 [sub][pointer::sub]。
    #[must_use]
    #[inline(always)]
    #[stable(feature = "pointer_byte_offsets", since = "1.75.0")]
    #[rustc_const_stable(feature = "const_pointer_byte_offsets", since = "1.75.0")]
    #[track_caller]
    pub const unsafe fn byte_sub(self, count: usize) -> Self {
        // SAFETY: the caller must uphold the safety contract for `sub`.
        unsafe { self.cast::<u8>().sub(count).with_metadata_of(self) }
    }

    /// 使用循环算术为指针添加无符号偏移量。
    ///
    /// `count` is in units of T; e.g., a `count` of 3 represents a pointer
    /// offset of `3 * size_of::<T>()` bytes.
    ///
    /// # 安全性
    ///
    /// 此操作本身总是安全的，但使用得到的指针则不是。
    ///
    /// The resulting pointer "remembers" the [allocation] that `self` points to; it must not
    /// 用于读取或写入其他分配体。
    ///
    /// In other words, `let z = x.wrapping_add((y as usize) - (x as usize))` does *not* make `z`
    /// the same as `y` even if we assume `T` has size `1` and there is no overflow: `z` is still
    /// attached to the object `x` is attached to, and dereferencing it is Undefined Behavior unless
    /// `x` and `y` point into the same allocation.
    ///
    /// Compared to [`add`], this method basically delays the requirement of staying within the
    /// same allocation: [`add`] is immediate Undefined Behavior when crossing object
    /// boundaries; `wrapping_add` produces a pointer but still leads to Undefined Behavior if a
    /// pointer is dereferenced when it is out-of-bounds of the object it is attached to. [`add`]
    /// can be optimized better and is thus preferable in performance-sensitive code.
    ///
    /// # 示例
    /// 使用循环算术为指针添加无符号字节偏移量。
    /// `x.wrapping_add(o).wrapping_sub(o)` is always the same as `x`. In other words, leaving the
    /// allocation and then re-entering it later is permitted.
    ///
    /// [`add`]: #method.add
    /// [allocation]: crate::ptr#allocation
    ///
    /// # 使用 [wrapping_add][pointer::wrapping_add] 对它进行操作。有关文档，请参阅该方法。
    ///
    /// ```
    /// # use std::fmt::Write;
    /// // Iterate using a raw pointer in increments of two elements
    /// let data = [1u8, 2, 3, 4, 5];
    /// let mut ptr: *const u8 = data.as_ptr();
    /// let step = 2;
    /// let end_rounded_up = ptr.wrapping_add(6);
    ///
    /// let mut out = String::new();
    /// while ptr != end_rounded_up {
    ///     unsafe {
    ///         write!(&mut out, "{}, ", *ptr)?;
    ///     }
    ///     ptr = ptr.wrapping_add(step);
    /// }
    /// assert_eq!(out, "1, 3, 5, ");
    /// # std::fmt::Result::Ok(())
    /// ```
    #[stable(feature = "pointer_methods", since = "1.26.0")]
    #[must_use = "returns a new pointer rather than modifying its argument"]
    #[rustc_const_stable(feature = "const_ptr_offset", since = "1.61.0")]
    #[allow(clippy::ptr_offset_with_cast)]
    #[inline(always)]
    pub const fn wrapping_add(self, count: usize) -> Self
    where
        T: Sized,
    {
        self.wrapping_offset(count as isize)
    }

    /// Adds an unsigned offset in bytes to a pointer using wrapping arithmetic.
    ///
    /// `count` is in units of bytes.
    ///
    /// This is purely a convenience for casting to a `u8` pointer and
    /// using [wrapping_add][pointer::wrapping_add] on it. See that method for documentation.
    ///
    /// For non-`Sized` pointees this operation changes only the data pointer,
    /// 元数据保持不变。
    #[must_use]
    #[inline(always)]
    #[stable(feature = "pointer_byte_offsets", since = "1.75.0")]
    #[rustc_const_stable(feature = "const_pointer_byte_offsets", since = "1.75.0")]
    pub const fn wrapping_byte_add(self, count: usize) -> Self {
        self.cast::<u8>().wrapping_add(count).with_metadata_of(self)
    }

    /// 使用循环算术从指针中减去无符号偏移量。
    ///
    /// `count` is in units of T; e.g., a `count` of 3 represents a pointer
    /// offset of `3 * size_of::<T>()` bytes.
    ///
    /// # 安全性
    ///
    /// 此操作本身总是安全的，但使用得到的指针则不是。
    ///
    /// The resulting pointer "remembers" the [allocation] that `self` points to; it must not
    /// 用其读取或写入其他分配的内容。
    ///
    /// In other words, `let z = x.wrapping_sub((x as usize) - (y as usize))` does *not* make `z`
    /// the same as `y` even if we assume `T` has size `1` and there is no overflow: `z` is still
    /// attached to the object `x` is attached to, and dereferencing it is Undefined Behavior unless
    /// `x` and `y` point into the same allocation.
    ///
    /// Compared to [`sub`], this method basically delays the requirement of staying within the
    /// same allocation: [`sub`] is immediate Undefined Behavior when crossing object
    /// boundaries; `wrapping_sub` produces a pointer but still leads to Undefined Behavior if a
    /// pointer is dereferenced when it is out-of-bounds of the object it is attached to. [`sub`]
    /// 中间值。例如，
    ///
    /// The delayed check only considers the value of the pointer that was dereferenced, not the
    /// # 示例
    /// `x.wrapping_add(o).wrapping_sub(o)` is always the same as `x`. In other words, leaving the
    /// allocation and then re-entering it later is permitted.
    ///
    /// [`sub`]: #method.sub
    /// [allocation]: crate::ptr#allocation
    ///
    /// # Examples
    ///
    /// ```
    /// # use std::fmt::Write;
    /// // Iterate using a raw pointer in increments of two elements (backwards)
    /// let data = [1u8, 2, 3, 4, 5];
    /// let mut ptr: *const u8 = data.as_ptr();
    /// let start_rounded_down = ptr.wrapping_sub(2);
    /// ptr = ptr.wrapping_add(4);
    /// let step = 2;
    /// let mut out = String::new();
    /// while ptr != start_rounded_down {
    ///     unsafe {
    ///         write!(&mut out, "{}, ", *ptr)?;
    ///     }
    ///     ptr = ptr.wrapping_sub(step);
    /// }
    /// assert_eq!(out, "5, 3, 1, ");
    /// # std::fmt::Result::Ok(())
    /// ```
    #[stable(feature = "pointer_methods", since = "1.26.0")]
    #[must_use = "returns a new pointer rather than modifying its argument"]
    #[rustc_const_stable(feature = "const_ptr_offset", since = "1.61.0")]
    #[inline(always)]
    pub const fn wrapping_sub(self, count: usize) -> Self
    where
        T: Sized,
    {
        self.wrapping_offset((count as isize).wrapping_neg())
    }

    /// 对其使用 [wrapping_sub][pointer::wrapping_sub] 方法。请参阅该方法的文档。
    ///
    /// `count` is in units of bytes.
    ///
    /// This is purely a convenience for casting to a `u8` pointer and
    /// using [wrapping_sub][pointer::wrapping_sub] on it. See that method for documentation.
    ///
    /// For non-`Sized` pointees this operation changes only the data pointer,
    /// leaving the metadata untouched.
    #[must_use]
    #[inline(always)]
    #[stable(feature = "pointer_byte_offsets", since = "1.75.0")]
    #[rustc_const_stable(feature = "const_pointer_byte_offsets", since = "1.75.0")]
    pub const fn wrapping_byte_sub(self, count: usize) -> Self {
        self.cast::<u8>().wrapping_sub(count).with_metadata_of(self)
    }

    /// Reads the value from `self` without moving it. This leaves the
    /// memory in `self` unchanged.
    ///
    /// # 安全性
    ///
    /// See [`ptr::read`] for safety concerns and examples.
    ///
    /// [`ptr::read`]: crate::ptr::read()
    #[stable(feature = "pointer_methods", since = "1.26.0")]
    #[rustc_const_stable(feature = "const_ptr_read", since = "1.71.0")]
    #[inline(always)]
    #[track_caller]
    pub const unsafe fn read(self) -> T
    where
        T: Sized,
    {
        // SAFETY: the caller must uphold the safety contract for `read`.
        unsafe { read(self) }
    }

    /// Performs a volatile read of the value from `self` without moving it. This
    /// leaves the memory in `self` unchanged.
    ///
    /// 易失性操作旨在作用于 I/O 内存，并且保证
    /// 不会被编译器省略或重新排序于其他易失性操作中。
    /// # 安全性
    ///
    /// # Safety
    ///
    /// See [`ptr::read_volatile`] for safety concerns and examples.
    ///
    /// [`ptr::read_volatile`]: crate::ptr::read_volatile()
    #[stable(feature = "pointer_methods", since = "1.26.0")]
    #[rustc_const_unstable(feature = "const_volatile", issue = "159094")]
    #[inline(always)]
    #[track_caller]
    pub const unsafe fn read_volatile(self) -> T
    where
        T: Sized,
    {
        // SAFETY: the caller must uphold the safety contract for `read_volatile`.
        unsafe { read_volatile(self) }
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
    #[stable(feature = "pointer_methods", since = "1.26.0")]
    #[rustc_const_stable(feature = "const_ptr_read", since = "1.71.0")]
    #[inline(always)]
    #[track_caller]
    pub const unsafe fn read_unaligned(self) -> T
    where
        T: Sized,
    {
        // SAFETY: the caller must uphold the safety contract for `read_unaligned`.
        unsafe { read_unaligned(self) }
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
    #[rustc_const_stable(feature = "const_intrinsic_copy", since = "1.83.0")]
    #[stable(feature = "pointer_methods", since = "1.26.0")]
    #[inline(always)]
    #[track_caller]
    pub const unsafe fn copy_to(self, dest: *mut T, count: usize)
    where
        T: Sized,
    {
        // SAFETY: the caller must uphold the safety contract for `copy`.
        unsafe { copy(self, dest, count) }
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
    #[rustc_const_stable(feature = "const_intrinsic_copy", since = "1.83.0")]
    #[stable(feature = "pointer_methods", since = "1.26.0")]
    #[inline(always)]
    #[track_caller]
    pub const unsafe fn copy_to_nonoverlapping(self, dest: *mut T, count: usize)
    where
        T: Sized,
    {
        // SAFETY: the caller must uphold the safety contract for `copy_nonoverlapping`.
        unsafe { copy_nonoverlapping(self, dest, count) }
    }

    /// 计算需要应用于指针以使其对齐的偏移量。
    /// `align`.
    ///
    /// 如果无法使指针对齐，实现会返回
    /// `usize::MAX`.
    ///
    /// The offset is expressed in number of `T` elements, and not bytes. The value returned can be
    /// used with the `wrapping_add` method.
    ///
    /// 没有任何保证确保调整指针不会溢出或超出指针所指的分配空间。由调用者确保
    /// 返回的偏移量在除对齐之外的所有方面都是正确的。
    /// # Panics
    ///
    /// # Panics
    ///
    /// The function panics if `align` is not a power-of-two.
    ///
    /// # Examples
    ///
    /// Accessing adjacent `u8` as `u16`
    ///
    /// ```
    /// # unsafe {
    /// let x = [5_u8, 6, 7, 8, 9];
    /// let ptr = x.as_ptr();
    /// let offset = ptr.align_offset(align_of::<u16>());
    ///
    /// if offset < x.len() - 1 {
    ///     let u16_ptr = ptr.add(offset).cast::<u16>();
    ///     assert!(*u16_ptr == u16::from_ne_bytes([5, 6]) || *u16_ptr == u16::from_ne_bytes([6, 7]));
    /// } else {
    ///     // while the pointer can be aligned via `offset`, it would point
    ///     // outside the allocation
    /// }
    /// # }
    /// ```
    #[must_use]
    #[inline]
    #[stable(feature = "align_offset", since = "1.36.0")]
    pub fn align_offset(self, align: usize) -> usize
    where
        T: Sized,
    {
        if !align.is_power_of_two() {
            panic!("align_offset: align is not a power-of-two");
        }

        // SAFETY: `align` has been checked to be a power of 2 above
        let ret = unsafe { align_offset(self, align) };

        // Inform Miri that we want to consider the resulting pointer to be suitably aligned.
        #[cfg(miri)]
        if ret != usize::MAX {
            intrinsics::miri_promise_symbolic_alignment(self.wrapping_add(ret).cast(), align);
        }

        ret
    }

    /// Returns whether the pointer is properly aligned for `T`.
    ///
    /// # Examples
    ///
    /// ```
    /// // On some platforms, the alignment of i32 is less than 4.
    /// #[repr(align(4))]
    /// struct AlignedI32(i32);
    ///
    /// let data = AlignedI32(42);
    /// let ptr = &data as *const AlignedI32;
    ///
    /// assert!(ptr.is_aligned());
    /// assert!(!ptr.wrapping_byte_add(1).is_aligned());
    /// ```
    #[must_use]
    #[inline]
    #[stable(feature = "pointer_is_aligned", since = "1.79.0")]
    pub fn is_aligned(self) -> bool
    where
        T: Sized,
    {
        self.is_aligned_to(align_of::<T>())
    }

    /// Returns whether the pointer is aligned to `align`.
    ///
    /// For non-`Sized` pointees this operation considers only the data pointer,
    /// # Panics
    ///
    /// # Panics
    ///
    /// The function panics if `align` is not a power-of-two (this includes 0).
    ///
    /// # 从类型转换为其可能未初始化的版本。
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
    #[must_use]
    #[inline]
    #[unstable(feature = "pointer_is_aligned_to", issue = "96284")]
    pub fn is_aligned_to(self, align: usize) -> bool {
        if !align.is_power_of_two() {
            panic!("is_aligned_to: align is not a power-of-two");
        }

        self.addr() & (align - 1) == 0
    }
}

impl<T> *const T {
    /// 从指针和长度形成原始切片。
    #[must_use]
    #[inline(always)]
    #[unstable(feature = "cast_maybe_uninit", issue = "145036")]
    pub const fn cast_uninit(self) -> *const MaybeUninit<T> {
        self as _
    }

    /// Forms a raw slice from a pointer and a length.
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
    /// // create a slice pointer when starting out with a pointer to the first element
    /// let x = [5, 6, 7];
    /// let raw_slice = x.as_ptr().cast_slice(3);
    /// assert_eq!(unsafe { &*raw_slice }[2], 7);
    /// ```
    ///
    /// 在解引用
    /// 原始切片之前，必须确保指针有效且不为空。即使切片为空，切片引用也绝不能包含空指针。
    ///
    /// ```rust,should_panic
    /// use std::ptr;
    /// let danger: *const [u8] = ptr::null::<u8>().cast_slice(0);
    /// unsafe {
    ///     danger.as_ref().expect("references must not be null");
    /// }
    /// ```
    #[inline]
    #[stable(feature = "ptr_cast_slice", since = "1.101.0")]
    #[rustc_const_stable(feature = "ptr_cast_slice", since = "1.101.0")]
    pub const fn cast_slice(self, len: usize) -> *const [T] {
        slice_from_raw_parts(self, len)
    }
}
impl<T> *const MaybeUninit<T> {
    /// 从可能未初始化的类型转换为其已初始化的版本。
    ///
    /// 此操作总是安全的，因为UB 只会在指针被读取后但在初始化前发生。
    /// 返回原始切片的长度。
    #[must_use]
    #[inline(always)]
    #[unstable(feature = "cast_maybe_uninit", issue = "145036")]
    pub const fn cast_init(self) -> *const T {
        self as _
    }
}

impl<T> *const [T] {
    /// 返回值为 **元素数**，而非字节数。
    ///
    /// 即使原始切片无法转换为切片引用，此函数也是安全的，因为指针为空或未对齐。
    ///
    /// # 示例
    /// reference because the pointer is null or unaligned.
    ///
    /// # Examples
    ///
    /// ```rust
    /// use std::ptr;
    ///
    /// let slice: *const [i8] = ptr::slice_from_raw_parts(ptr::null(), 3);
    /// assert_eq!(slice.len(), 3);
    /// ```
    #[inline(always)]
    #[stable(feature = "slice_ptr_len", since = "1.79.0")]
    #[rustc_const_stable(feature = "const_slice_ptr_len", since = "1.79.0")]
    pub const fn len(self) -> usize {
        metadata(self)
    }

    /// Returns `true` if the raw slice has a length of 0.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::ptr;
    ///
    /// let slice: *const [i8] = ptr::slice_from_raw_parts(ptr::null(), 3);
    /// assert!(!slice.is_empty());
    /// ```
    #[inline(always)]
    #[stable(feature = "slice_ptr_len", since = "1.79.0")]
    #[rustc_const_stable(feature = "const_slice_ptr_len", since = "1.79.0")]
    pub const fn is_empty(self) -> bool {
        self.len() == 0
    }

    /// 返回指向切片缓冲区的原始指针。
    ///
    /// This is equivalent to casting `self` to `*const T`, but more type-safe.
    ///
    /// # 示例
    ///
    /// ```rust
    /// #![feature(slice_ptr_get)]
    /// use std::ptr;
    ///
    /// let slice: *const [i8] = ptr::slice_from_raw_parts(ptr::null(), 3);
    /// assert_eq!(slice.as_ptr(), ptr::null());
    /// ```
    #[inline(always)]
    #[unstable(feature = "slice_ptr_get", issue = "74265")]
    pub const fn as_ptr(self) -> *const T {
        self as *const T
    }

    /// 获取指向底层数组的原始指针。
    ///
    /// If `N` is not exactly equal to the length of `self`, then this method returns `None`.
    #[stable(feature = "core_slice_as_array", since = "1.93.0")]
    #[rustc_const_stable(feature = "core_slice_as_array", since = "1.93.0")]
    #[inline]
    #[must_use]
    pub const fn as_array<const N: usize>(self) -> Option<*const [T; N]> {
        if self.len() == N {
            let me = self.as_ptr() as *const [T; N];
            Some(me)
        } else {
            None
        }
    }

    /// 返回指向元素或子切片的原始指针，无需检查边界。
    /// # 安全性
    ///
    /// # Safety
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
    ///
    /// let x = &[1, 2, 4] as *const [i32];
    ///
    /// unsafe {
    ///     assert_eq!(x.get_unchecked(1), x.as_ptr().add(1));
    /// }
    /// ```
    #[unstable(feature = "slice_ptr_get", issue = "74265")]
    #[rustc_const_unstable(feature = "const_index", issue = "143775")]
    #[inline(always)]
    pub const unsafe fn get_unchecked<I>(self, index: I) -> *const I::Output
    where
        I: [const] SliceIndex<[T]>,
    {
        // SAFETY: the caller ensures that `self` is dereferenceable and `index` in-bounds.
        unsafe { index.get_unchecked(self) }
    }

    #[doc = include_str!("docs/as_uninit_slice.md")]
    #[inline]
    #[unstable(feature = "ptr_as_uninit", issue = "75402")]
    pub const unsafe fn as_uninit_slice<'a>(self) -> Option<&'a [MaybeUninit<T>]> {
        if self.is_null() {
            None
        } else {
            // SAFETY: the caller must uphold the safety contract for `as_uninit_slice`.
            Some(unsafe { slice::from_raw_parts(self as *const MaybeUninit<T>, self.len()) })
        }
    }
}

impl<T> *const T {
    /// Casts from a pointer-to-`T` to a pointer-to-`[T; N]`.
    #[inline]
    #[unstable(feature = "ptr_cast_array", issue = "144514")]
    pub const fn cast_array<const N: usize>(self) -> *const [T; N] {
        self.cast()
    }
}

impl<T, const N: usize> *const [T; N] {
    /// 返回指向数组缓冲区的原始指针。
    ///
    /// This is equivalent to casting `self` to `*const T`, but more type-safe.
    ///
    /// # 示例
    ///
    /// ```rust
    /// #![feature(array_ptr_get)]
    /// use std::ptr;
    ///
    /// let arr: *const [i8; 3] = ptr::null();
    /// assert_eq!(arr.as_ptr(), ptr::null());
    /// ```
    #[inline(always)]
    #[unstable(feature = "array_ptr_get", issue = "119834")]
    pub const fn as_ptr(self) -> *const T {
        self as *const T
    }

    /// 返回指向包含整个数组的切片的原始指针。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(array_ptr_get)]
    ///
    /// let arr: *const [i32; 3] = &[1, 2, 4] as *const [i32; 3];
    /// let slice: *const [i32] = arr.as_slice();
    /// assert_eq!(slice.len(), 3);
    /// ```
    #[inline]
    #[unstable(feature = "array_ptr_get", issue = "119834")]
    pub const fn as_slice(self) -> *const [T] {
        self
    }
}

/// For thin pointers, equality is by address, as produced by the [`<*const T>::addr`](pointer::addr) method.
#[stable(feature = "rust1", since = "1.0.0")]
#[diagnostic::on_const(
    message = "pointers cannot be reliably compared during const eval",
    note = "see issue #53020 <https://github.com/rust-lang/rust/issues/53020> for more information"
)]
impl<T: PointeeSized> PartialEq for *const T {
    #[inline(always)]
    #[allow(ambiguous_wide_pointer_comparisons)]
    fn eq(&self, other: &*const T) -> bool {
        *self == *other
    }
}

/// 指针等价性是一种等价关系。
#[stable(feature = "rust1", since = "1.0.0")]
#[diagnostic::on_const(
    message = "pointers cannot be reliably compared during const eval",
    note = "see issue #53020 <https://github.com/rust-lang/rust/issues/53020> for more information"
)]
impl<T: PointeeSized> Eq for *const T {}

/// For thin pointers, comparison is by address, as produced by the [`<*const T>::addr`](pointer::addr) method.
#[stable(feature = "rust1", since = "1.0.0")]
#[diagnostic::on_const(
    message = "pointers cannot be reliably compared during const eval",
    note = "see issue #53020 <https://github.com/rust-lang/rust/issues/53020> for more information"
)]
impl<T: PointeeSized> Ord for *const T {
    #[inline]
    #[allow(ambiguous_wide_pointer_comparisons)]
    fn cmp(&self, other: &*const T) -> Ordering {
        if self < other {
            Less
        } else if self == other {
            Equal
        } else {
            Greater
        }
    }
}

/// For thin pointers, comparison is by address, as produced by the [`<*const T>::addr`](pointer::addr) method.
#[stable(feature = "rust1", since = "1.0.0")]
#[diagnostic::on_const(
    message = "pointers cannot be reliably compared during const eval",
    note = "see issue #53020 <https://github.com/rust-lang/rust/issues/53020> for more information"
)]
impl<T: PointeeSized> PartialOrd for *const T {
    #[inline(always)]
    #[allow(ambiguous_wide_pointer_comparisons)]
    fn partial_cmp(&self, other: &*const T) -> Option<Ordering> {
        Some(self.cmp(other))
    }

    #[inline(always)]
    #[allow(ambiguous_wide_pointer_comparisons)]
    fn lt(&self, other: &*const T) -> bool {
        *self < *other
    }

    #[inline(always)]
    #[allow(ambiguous_wide_pointer_comparisons)]
    fn le(&self, other: &*const T) -> bool {
        *self <= *other
    }

    #[inline(always)]
    #[allow(ambiguous_wide_pointer_comparisons)]
    fn gt(&self, other: &*const T) -> bool {
        *self > *other
    }

    #[inline(always)]
    #[allow(ambiguous_wide_pointer_comparisons)]
    fn ge(&self, other: &*const T) -> bool {
        *self >= *other
    }
}

#[stable(feature = "raw_ptr_default", since = "1.88.0")]
impl<T: ?Sized + Thin> Default for *const T {
    /// Returns the default value of [`null()`][crate::ptr::null].
    fn default() -> Self {
        crate::ptr::null()
    }
}
