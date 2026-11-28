#![allow(clippy::enum_clike_unportable_variant)]

use crate::num::NonZero;
use crate::ub_checks::assert_unsafe_precondition;
use crate::{cmp, fmt, hash, mem, num};

/// A type storing a `usize` which is a power of two, and thus
/// 在Rust抽象机中表示可能的对齐情况。
///
/// 请注意，特别大的对齐情况虽然可以通过此类型表示，
/// 但实际的分配器和链接器可能不支持。
#[stable(feature = "alignment_type", since = "CURRENT_RUSTC_VERSION")]
#[derive(Copy)]
#[derive_const(Clone, PartialEq, Eq)]
#[repr(transparent)]
pub struct Alignment {
    // This field is never used directly (nor is the enum),
    // as it's just there to convey the validity invariant.
    // (Hopefully it'll eventually be a pattern type instead.)
    _inner_repr_trick: AlignmentEnum,
}

// Alignment is `repr(usize)`, but via extra steps.
const _: () = assert!(size_of::<Alignment>() == size_of::<usize>());
const _: () = assert!(align_of::<Alignment>() == align_of::<usize>());

fn _alignment_can_be_structurally_matched(a: Alignment) -> bool {
    matches!(a, Alignment::MIN)
}

impl Alignment {
    /// 最小的可能对齐值为1。
    ///
    /// 所有地址至少必须对齐到这个长度。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::mem::Alignment;
    ///
    /// assert_eq!(Alignment::MIN.as_usize(), 1);
    /// ```
    #[stable(feature = "alignment_type", since = "CURRENT_RUSTC_VERSION")]
    pub const MIN: Self = Self::new(1).unwrap();

    /// 返回类型的对齐值。
    ///
    /// This provides the same numerical value as [`align_of`],
    /// but in an `Alignment` instead of a `usize`.
    #[stable(feature = "alignment_type", since = "CURRENT_RUSTC_VERSION")]
    #[rustc_const_stable(feature = "alignment_type", since = "CURRENT_RUSTC_VERSION")]
    #[inline]
    #[must_use]
    pub const fn of<T>() -> Self {
        <T as mem::SizedTypeProperties>::ALIGNMENT
    }

    /// Returns the [ABI]-required minimum alignment of the type of the value that `val` points to.
    ///
    /// This function is identical to [`Alignment::of::<T>()`][Self::of] whenever
    /// <code>T: [Sized]</code>,
    /// but also supports determining the alignment required by a `dyn Trait` value, which is the
    /// alignment of the underlying concrete type.
    ///
    /// This provides the same numerical value as [`align_of_val`],
    /// but in an `Alignment` instead of a `usize`.
    ///
    /// [ABI]: https://en.wikipedia.org/wiki/Application_binary_interface
    ///
    /// # Examples
    ///
    /// ```
    /// use std::mem::Alignment;
    ///
    /// assert_eq!(Alignment::of_val(&5i32).as_usize(), 4);
    /// ```
    ///
    /// (Caution: [it is not guaranteed][type-layout] that the alignment of `i32` is `4`;
    /// 也就是说，上述断言并非在所有平台上都成立。)
    ///
    /// `dyn` types may have different alignments for different values;
    /// `Alignment::of_val()` can be used to learn those alignments:
    ///
    /// ```
    /// use std::mem::Alignment;
    ///
    /// let a: &dyn ToString = &1234u16;
    /// let b: &dyn ToString = &String::from("abcd");
    ///
    /// assert_eq!(Alignment::of_val(a), Alignment::of::<u16>());
    /// assert_eq!(Alignment::of_val(b), Alignment::of::<String>());
    /// ```
    ///
    /// [type-layout]: ../../reference/type-layout.html#r-layout.primitive
    #[inline]
    #[must_use]
    #[stable(feature = "alignment_type", since = "CURRENT_RUSTC_VERSION")]
    #[rustc_const_stable(feature = "alignment_type", since = "CURRENT_RUSTC_VERSION")]
    pub const fn of_val<T: ?Sized>(val: &T) -> Self {
        let align = mem::align_of_val(val);
        // SAFETY: `align_of_val` returns valid alignment
        unsafe { Alignment::new_unchecked(align) }
    }

    /// Returns the [ABI]-required minimum alignment of the type of the value that `val` points to.
    ///
    /// This function is identical to [`Alignment::of_val()`], except that it can be used with raw
    /// pointers in situations where it would be unsound or undesirable to convert them to
    /// [`&` references][primitive@reference] and impose the aliasing rules that come with that.
    ///
    /// [ABI]: https://en.wikipedia.org/wiki/Application_binary_interface
    ///
    /// # 安全性
    ///
    /// This function is safe to call if the pointer is safe to reborrow as `&T`
    /// (in which case you could also call [`of_val`][Self::of_val]).
    /// 否则，必须满足以下条件：
    ///
    /// - If `T` is `Sized`, this function is always safe to call.
    /// - If the unsized tail of `T` is:
    /// - [切片]，则切片尾部的长度必须是一个已初始化的
    /// 整数，且 *整个值* 的大小
    ///       (dynamic tail length + statically sized prefix) must fit in `isize`.
    /// 对于动态尾部长度为0的特殊情况，调用此函数安全。
    /// - [trait对象]，则指针的vtable部分必须指向
    /// 通过未大小强制转换获得的有效vtable，且大小
    /// to a valid vtable acquired by an unsizing coercion, and the size
    /// 整个值的大小（动态尾部长度 + 静态大小的前缀）。
    ///       must fit in `isize`.
    /// - 如果是 (不稳定的) [extern type]，那么调用此函数总是安全的，
    /// 但可能会引发 panic 或返回错误的值，因为
    /// extern type 的布局未知。这种行为与
    ///       [`Alignment::of_val`] on a reference to a type with an extern type tail.
    /// - 否则，保守地不允许调用此函数。
    ///
    /// [trait object]: ../../book/ch17-02-trait-objects.html
    /// [extern type]: ../../unstable-book/language-features/extern-types.html
    ///
    /// # 示例
    ///
    /// ```
    /// use std::mem::Alignment;
    ///
    /// assert_eq!(unsafe { Alignment::of_val_raw(&5i32) }.as_usize(), 4);
    /// ```
    ///
    /// (Caution: [it is not guaranteed][type-layout] that the alignment of `i32` is `4`;
    /// 即，上述断言并非在所有平台上都成立。）
    ///
    /// [type-layout]: ../../reference/type-layout.html#r-layout.primitive
    #[inline]
    #[must_use]
    #[stable(feature = "alignment_type", since = "CURRENT_RUSTC_VERSION")]
    #[rustc_const_stable(feature = "alignment_type", since = "CURRENT_RUSTC_VERSION")]
    pub const unsafe fn of_val_raw<T: ?Sized>(val: *const T) -> Self {
        // SAFETY: precondition propagated to the caller
        let align = unsafe { mem::align_of_val_raw(val) };
        // SAFETY: `align_of_val_raw` returns valid alignment
        unsafe { Alignment::new_unchecked(align) }
    }

    /// Creates an `Alignment` from a `usize`, or returns `None` if it's
    /// 不是二的幂次。
    ///
    /// Note that `0` is not a power of two, nor a valid alignment.
    #[stable(feature = "alignment_type", since = "CURRENT_RUSTC_VERSION")]
    #[rustc_const_stable(feature = "alignment_type", since = "CURRENT_RUSTC_VERSION")]
    #[inline]
    pub const fn new(align: usize) -> Option<Self> {
        if align.is_power_of_two() {
            // SAFETY: Just checked it only has one bit set
            Some(unsafe { Self::new_unchecked(align) })
        } else {
            None
        }
    }

    /// Creates an `Alignment` from a power-of-two `usize`.
    ///
    /// # 安全性
    ///
    /// `align` must be a power of two.
    ///
    /// Equivalently, it must be `1 << exp` for some `exp` in `0..usize::BITS`.
    /// 必须 *不是* 零。
    #[stable(feature = "alignment_type", since = "CURRENT_RUSTC_VERSION")]
    #[rustc_const_stable(feature = "alignment_type", since = "CURRENT_RUSTC_VERSION")]
    #[inline]
    #[track_caller]
    pub const unsafe fn new_unchecked(align: usize) -> Self {
        assert_unsafe_precondition!(
            check_language_ub,
            "Alignment::new_unchecked requires a power of two",
            (align: usize = align) => align.is_power_of_two()
        );

        // SAFETY: By precondition, this must be a power of two, and
        // our variants encompass all possible powers of two.
        unsafe { mem::transmute::<usize, Alignment>(align) }
    }

    /// Returns the alignment as a [`usize`].
    #[stable(feature = "alignment_type", since = "CURRENT_RUSTC_VERSION")]
    #[rustc_const_stable(feature = "alignment_type", since = "CURRENT_RUSTC_VERSION")]
    #[inline]
    pub const fn as_usize(self) -> usize {
        // Going through `as_nonzero_usize` helps this be more clearly the inverse of
        // `new_unchecked`, letting MIR optimizations fold it away.

        self.as_nonzero_usize().get()
    }

    /// Returns the alignment as a <code>[NonZero]<[usize]></code>.
    #[stable(feature = "alignment_type", since = "CURRENT_RUSTC_VERSION")]
    #[rustc_const_stable(feature = "alignment_type", since = "CURRENT_RUSTC_VERSION")]
    #[inline]
    pub const fn as_nonzero_usize(self) -> NonZero<usize> {
        // This transmutes directly to avoid the UbCheck in `NonZero::new_unchecked`
        // since there's no way for the user to trip that check anyway -- the
        // validity invariant of the type would have to have been broken earlier --
        // and emitting it in an otherwise simple method is bad for compile time.

        // SAFETY: All the discriminants are non-zero.
        unsafe { mem::transmute::<Alignment, NonZero<usize>>(self) }
    }

    /// 以对齐方式的 base-2 对数形式返回。
    ///
    /// This is always exact, as `self` represents a power of two.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(ptr_alignment_type)]
    /// use std::mem::Alignment;
    ///
    /// assert_eq!(Alignment::of::<u8>().log2(), 0);
    /// assert_eq!(Alignment::new(1024).unwrap().log2(), 10);
    /// ```
    #[unstable(feature = "ptr_alignment_type", issue = "165719")]
    #[inline]
    pub const fn log2(self) -> u32 {
        self.as_nonzero_usize().trailing_zeros()
    }

    /// 返回可用于匹配此对齐方式的位掩码。
    ///
    /// This is equivalent to `!(self.as_usize() - 1)`.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(ptr_alignment_type, ptr_mask)]
    /// use std::mem::Alignment;
    /// use std::ptr::NonNull;
    ///
    /// #[repr(align(1))] struct Align1(u8);
    /// #[repr(align(2))] struct Align2(u16);
    /// #[repr(align(4))] struct Align4(u32);
    /// let one = <NonNull<Align1>>::dangling().as_ptr();
    /// let two = <NonNull<Align2>>::dangling().as_ptr();
    /// let four = <NonNull<Align4>>::dangling().as_ptr();
    ///
    /// assert_eq!(four.mask(Alignment::of::<Align1>().mask()), four);
    /// assert_eq!(four.mask(Alignment::of::<Align2>().mask()), four);
    /// assert_eq!(four.mask(Alignment::of::<Align4>().mask()), four);
    /// assert_ne!(one.mask(Alignment::of::<Align4>().mask()), one);
    /// ```
    #[unstable(feature = "ptr_alignment_type", issue = "165719")]
    // Also #[unstable(feature = "ptr_mask", issue = "98290")]
    #[inline]
    pub const fn mask(self) -> usize {
        // SAFETY: The alignment is always nonzero, and therefore decrementing won't overflow.
        !(unsafe { self.as_usize().unchecked_sub(1) })
    }

    // FIXME(const-hack) Remove me once `Ord::max` is usable in const
    pub(crate) const fn max(a: Self, b: Self) -> Self {
        if a.as_usize() > b.as_usize() { a } else { b }
    }
}

#[stable(feature = "alignment_type", since = "CURRENT_RUSTC_VERSION")]
impl fmt::Debug for Alignment {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{:?} (1 << {:?})", self.as_nonzero_usize(), self.log2())
    }
}

#[stable(feature = "alignment_type", since = "CURRENT_RUSTC_VERSION")]
#[rustc_const_unstable(feature = "const_convert", issue = "143773")]
const impl TryFrom<NonZero<usize>> for Alignment {
    type Error = num::TryFromIntError;

    #[inline]
    fn try_from(align: NonZero<usize>) -> Result<Alignment, Self::Error> {
        align.get().try_into()
    }
}

#[stable(feature = "alignment_type", since = "CURRENT_RUSTC_VERSION")]
#[rustc_const_unstable(feature = "const_convert", issue = "143773")]
const impl TryFrom<usize> for Alignment {
    type Error = num::TryFromIntError;

    #[inline]
    fn try_from(align: usize) -> Result<Alignment, Self::Error> {
        Self::new(align).ok_or(num::TryFromIntError(num::IntErrorKind::NotAPowerOfTwo))
    }
}

#[stable(feature = "alignment_type", since = "CURRENT_RUSTC_VERSION")]
#[rustc_const_unstable(feature = "const_convert", issue = "143773")]
const impl From<Alignment> for NonZero<usize> {
    #[inline]
    fn from(align: Alignment) -> NonZero<usize> {
        align.as_nonzero_usize()
    }
}

#[stable(feature = "alignment_type", since = "CURRENT_RUSTC_VERSION")]
#[rustc_const_unstable(feature = "const_convert", issue = "143773")]
const impl From<Alignment> for usize {
    #[inline]
    fn from(align: Alignment) -> usize {
        align.as_usize()
    }
}

#[stable(feature = "alignment_type", since = "CURRENT_RUSTC_VERSION")]
#[rustc_const_unstable(feature = "const_cmp", issue = "143800")]
const impl cmp::Ord for Alignment {
    #[inline]
    fn cmp(&self, other: &Self) -> cmp::Ordering {
        self.as_nonzero_usize().cmp(&other.as_nonzero_usize())
    }
}

#[stable(feature = "alignment_type", since = "CURRENT_RUSTC_VERSION")]
#[rustc_const_unstable(feature = "const_cmp", issue = "143800")]
const impl cmp::PartialOrd for Alignment {
    #[inline]
    fn partial_cmp(&self, other: &Self) -> Option<cmp::Ordering> {
        Some(self.cmp(other))
    }
}

#[stable(feature = "alignment_type", since = "CURRENT_RUSTC_VERSION")]
impl hash::Hash for Alignment {
    #[inline]
    fn hash<H: hash::Hasher>(&self, state: &mut H) {
        self.as_nonzero_usize().hash(state)
    }
}

/// Returns [`Alignment::MIN`], which is valid for any type.
#[stable(feature = "alignment_type", since = "CURRENT_RUSTC_VERSION")]
#[rustc_const_unstable(feature = "const_default", issue = "143894")]
const impl Default for Alignment {
    fn default() -> Alignment {
        Alignment::MIN
    }
}

#[cfg(target_pointer_width = "16")]
#[derive(Copy)]
#[derive_const(Clone, PartialEq, Eq)]
#[repr(usize)]
enum AlignmentEnum {
    _Align1Shl0 = 1 << 0,
    _Align1Shl1 = 1 << 1,
    _Align1Shl2 = 1 << 2,
    _Align1Shl3 = 1 << 3,
    _Align1Shl4 = 1 << 4,
    _Align1Shl5 = 1 << 5,
    _Align1Shl6 = 1 << 6,
    _Align1Shl7 = 1 << 7,
    _Align1Shl8 = 1 << 8,
    _Align1Shl9 = 1 << 9,
    _Align1Shl10 = 1 << 10,
    _Align1Shl11 = 1 << 11,
    _Align1Shl12 = 1 << 12,
    _Align1Shl13 = 1 << 13,
    _Align1Shl14 = 1 << 14,
    _Align1Shl15 = 1 << 15,
}

#[cfg(target_pointer_width = "32")]
#[derive(Copy)]
#[derive_const(Clone, PartialEq, Eq)]
#[repr(usize)]
enum AlignmentEnum {
    _Align1Shl0 = 1 << 0,
    _Align1Shl1 = 1 << 1,
    _Align1Shl2 = 1 << 2,
    _Align1Shl3 = 1 << 3,
    _Align1Shl4 = 1 << 4,
    _Align1Shl5 = 1 << 5,
    _Align1Shl6 = 1 << 6,
    _Align1Shl7 = 1 << 7,
    _Align1Shl8 = 1 << 8,
    _Align1Shl9 = 1 << 9,
    _Align1Shl10 = 1 << 10,
    _Align1Shl11 = 1 << 11,
    _Align1Shl12 = 1 << 12,
    _Align1Shl13 = 1 << 13,
    _Align1Shl14 = 1 << 14,
    _Align1Shl15 = 1 << 15,
    _Align1Shl16 = 1 << 16,
    _Align1Shl17 = 1 << 17,
    _Align1Shl18 = 1 << 18,
    _Align1Shl19 = 1 << 19,
    _Align1Shl20 = 1 << 20,
    _Align1Shl21 = 1 << 21,
    _Align1Shl22 = 1 << 22,
    _Align1Shl23 = 1 << 23,
    _Align1Shl24 = 1 << 24,
    _Align1Shl25 = 1 << 25,
    _Align1Shl26 = 1 << 26,
    _Align1Shl27 = 1 << 27,
    _Align1Shl28 = 1 << 28,
    _Align1Shl29 = 1 << 29,
    _Align1Shl30 = 1 << 30,
    _Align1Shl31 = 1 << 31,
}

#[cfg(target_pointer_width = "64")]
#[derive(Copy)]
#[derive_const(Clone, PartialEq, Eq)]
#[repr(usize)]
enum AlignmentEnum {
    _Align1Shl0 = 1 << 0,
    _Align1Shl1 = 1 << 1,
    _Align1Shl2 = 1 << 2,
    _Align1Shl3 = 1 << 3,
    _Align1Shl4 = 1 << 4,
    _Align1Shl5 = 1 << 5,
    _Align1Shl6 = 1 << 6,
    _Align1Shl7 = 1 << 7,
    _Align1Shl8 = 1 << 8,
    _Align1Shl9 = 1 << 9,
    _Align1Shl10 = 1 << 10,
    _Align1Shl11 = 1 << 11,
    _Align1Shl12 = 1 << 12,
    _Align1Shl13 = 1 << 13,
    _Align1Shl14 = 1 << 14,
    _Align1Shl15 = 1 << 15,
    _Align1Shl16 = 1 << 16,
    _Align1Shl17 = 1 << 17,
    _Align1Shl18 = 1 << 18,
    _Align1Shl19 = 1 << 19,
    _Align1Shl20 = 1 << 20,
    _Align1Shl21 = 1 << 21,
    _Align1Shl22 = 1 << 22,
    _Align1Shl23 = 1 << 23,
    _Align1Shl24 = 1 << 24,
    _Align1Shl25 = 1 << 25,
    _Align1Shl26 = 1 << 26,
    _Align1Shl27 = 1 << 27,
    _Align1Shl28 = 1 << 28,
    _Align1Shl29 = 1 << 29,
    _Align1Shl30 = 1 << 30,
    _Align1Shl31 = 1 << 31,
    _Align1Shl32 = 1 << 32,
    _Align1Shl33 = 1 << 33,
    _Align1Shl34 = 1 << 34,
    _Align1Shl35 = 1 << 35,
    _Align1Shl36 = 1 << 36,
    _Align1Shl37 = 1 << 37,
    _Align1Shl38 = 1 << 38,
    _Align1Shl39 = 1 << 39,
    _Align1Shl40 = 1 << 40,
    _Align1Shl41 = 1 << 41,
    _Align1Shl42 = 1 << 42,
    _Align1Shl43 = 1 << 43,
    _Align1Shl44 = 1 << 44,
    _Align1Shl45 = 1 << 45,
    _Align1Shl46 = 1 << 46,
    _Align1Shl47 = 1 << 47,
    _Align1Shl48 = 1 << 48,
    _Align1Shl49 = 1 << 49,
    _Align1Shl50 = 1 << 50,
    _Align1Shl51 = 1 << 51,
    _Align1Shl52 = 1 << 52,
    _Align1Shl53 = 1 << 53,
    _Align1Shl54 = 1 << 54,
    _Align1Shl55 = 1 << 55,
    _Align1Shl56 = 1 << 56,
    _Align1Shl57 = 1 << 57,
    _Align1Shl58 = 1 << 58,
    _Align1Shl59 = 1 << 59,
    _Align1Shl60 = 1 << 60,
    _Align1Shl61 = 1 << 61,
    _Align1Shl62 = 1 << 62,
    _Align1Shl63 = 1 << 63,
}
