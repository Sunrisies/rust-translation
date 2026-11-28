//! 内置数值类型的数值 trait 和函数。

#![stable(feature = "rust1", since = "1.0.0")]
#![expect(clippy::manual_is_ascii_check, reason = "this module implements various is_ascii checks")]

use crate::convert::{BoundedCastFromInt, CheckedCastFromInt};
use crate::panic::const_panic;
use crate::str::FromStr;
use crate::ub_checks::assert_unsafe_precondition;
use crate::{ascii, intrinsics, mem};

// FIXME(const-hack): Used because the `?` operator is not allowed in a const context.
macro_rules! try_opt {
    ($e:expr) => {
        match $e {
            Some(x) => x,
            None => return None,
        }
    };
}

// Use this when the generated code should differ between signed and unsigned types.
macro_rules! sign_dependent_expr {
    (signed ? if signed { $signed_case:expr } if unsigned { $unsigned_case:expr } ) => {
        $signed_case
    };
    (unsigned ? if signed { $signed_case:expr } if unsigned { $unsigned_case:expr } ) => {
        $unsigned_case
    };
}

// These modules are public only for testing.
#[doc(hidden)]
#[unstable(
    feature = "num_internals",
    reason = "internal routines only exposed for testing",
    issue = "none"
)]
pub mod imp;

#[macro_use]
mod int_macros; // import int_impl!
#[macro_use]
mod uint_macros; // import uint_impl!

mod bfloat;
mod complex;
mod error;
pub(crate) mod float_macros;
#[cfg(not(no_fp_fmt_parse))]
mod float_parse;
mod nonzero;
mod saturating;
mod traits;
mod wrapping;

/// 100% 永久不稳定
#[doc(hidden)]
pub mod niche_types;

#[unstable(feature = "f16b", issue = "160630")]
pub use bfloat::f16b;
#[unstable(feature = "complex_numbers", issue = "154023")]
pub use complex::Complex;
#[stable(feature = "int_error_matching", since = "1.55.0")]
pub use error::IntErrorKind;
#[stable(feature = "rust1", since = "1.0.0")]
pub use error::ParseIntError;
#[stable(feature = "try_from", since = "1.34.0")]
pub use error::TryFromIntError;
#[unstable(feature = "extended_float_error_kind", issue = "164793")]
#[cfg(not(no_fp_fmt_parse))]
pub use float_parse::FloatErrorKind;
#[stable(feature = "rust1", since = "1.0.0")]
#[cfg(not(no_fp_fmt_parse))]
pub use float_parse::ParseFloatError;
#[stable(feature = "generic_nonzero", since = "1.79.0")]
pub use nonzero::NonZero;
#[unstable(
    feature = "nonzero_internals",
    reason = "implementation detail which may disappear or be replaced at any time",
    issue = "none"
)]
pub use nonzero::ZeroablePrimitive;
#[stable(feature = "signed_nonzero", since = "1.34.0")]
pub use nonzero::{NonZeroI8, NonZeroI16, NonZeroI32, NonZeroI64, NonZeroI128, NonZeroIsize};
#[stable(feature = "nonzero", since = "1.28.0")]
pub use nonzero::{NonZeroU8, NonZeroU16, NonZeroU32, NonZeroU64, NonZeroU128, NonZeroUsize};
#[stable(feature = "saturating_int_impl", since = "1.74.0")]
pub use saturating::Saturating;
#[stable(feature = "rust1", since = "1.0.0")]
pub use wrapping::Wrapping;

macro_rules! u8_xe_bytes_doc {
    () => {
        "

**Note**: This function is meaningless on `u8`. Byte order does not exist as a
concept for byte-sized integers. This function is only provided in symmetry
with larger integer types.

"
    };
}

macro_rules! i8_xe_bytes_doc {
    () => {
        "

**Note**: This function is meaningless on `i8`. Byte order does not exist as a
concept for byte-sized integers. This function is only provided in symmetry
with larger integer types. You can cast from and to `u8` using
[`cast_signed`](u8::cast_signed) and [`cast_unsigned`](Self::cast_unsigned).

"
    };
}

macro_rules! usize_isize_to_xe_bytes_doc {
    () => {
        "

**Note**: This function returns an array of length 2, 4 or 8 bytes
depending on the target pointer size.

"
    };
}

macro_rules! usize_isize_from_xe_bytes_doc {
    () => {
        "

**Note**: This function takes an array of length 2, 4 or 8 bytes
depending on the target pointer size.

"
    };
}

macro_rules! midpoint_impl {
    ($SelfT:ty, unsigned) => {
        /// Calculates the midpoint (average) between `self` and `rhs`.
        ///
        /// `midpoint(a, b)` is `(a + b) / 2` as if it were performed in a
        /// 足够大的无符号整数类型中执行。这意味着结果总是
        /// 向零方向取整，且永远不会发生溢出。
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(0", stringify!($SelfT), ".midpoint(4), 2);")]
        #[doc = concat!("assert_eq!(1", stringify!($SelfT), ".midpoint(4), 2);")]
        /// ```
        #[stable(feature = "num_midpoint", since = "1.85.0")]
        #[rustc_const_stable(feature = "num_midpoint", since = "1.85.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[doc(alias = "average_floor")]
        #[doc(alias = "average")]
        #[inline]
        pub const fn midpoint(self, rhs: $SelfT) -> $SelfT {
            // Use the well known branchless algorithm from Hacker's Delight to compute
            // `(a + b) / 2` without overflowing: `((a ^ b) >> 1) + (a & b)`.
            ((self ^ rhs) >> 1) + (self & rhs)
        }
    };
    ($SelfT:ty, signed) => {
        /// Calculates the midpoint (average) between `self` and `rhs`.
        ///
        /// `midpoint(a, b)` is `(a + b) / 2` as if it were performed in a
        /// 足够大的有符号整数类型中执行。这意味着结果总是
        /// 向零方向取整，且永远不会发生溢出。
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(0", stringify!($SelfT), ".midpoint(4), 2);")]
        #[doc = concat!("assert_eq!((-1", stringify!($SelfT), ").midpoint(2), 0);")]
        #[doc = concat!("assert_eq!((-7", stringify!($SelfT), ").midpoint(0), -3);")]
        #[doc = concat!("assert_eq!(0", stringify!($SelfT), ".midpoint(-7), -3);")]
        #[doc = concat!("assert_eq!(0", stringify!($SelfT), ".midpoint(7), 3);")]
        /// ```
        #[stable(feature = "num_midpoint_signed", since = "1.87.0")]
        #[rustc_const_stable(feature = "num_midpoint_signed", since = "1.87.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[doc(alias = "average_floor")]
        #[doc(alias = "average_ceil")]
        #[doc(alias = "average")]
        #[inline]
        pub const fn midpoint(self, rhs: Self) -> Self {
            // Use the well known branchless algorithm from Hacker's Delight to compute
            // `(a + b) / 2` without overflowing: `((a ^ b) >> 1) + (a & b)`.
            let t = ((self ^ rhs) >> 1) + (self & rhs);
            // Except that it fails for integers whose sum is an odd negative number as
            // their floor is one less than their average. So we adjust the result.
            t + (if t < 0 { 1 } else { 0 } & (self ^ rhs))
        }
    };
    ($SelfT:ty, $WideT:ty, unsigned) => {
        /// Calculates the midpoint (average) between `self` and `rhs`.
        ///
        /// `midpoint(a, b)` is `(a + b) / 2` as if it were performed in a
        /// 足够大的无符号整数类型中执行。这意味着结果总是
        /// 向零方向取整，且永远不会发生溢出。
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(0", stringify!($SelfT), ".midpoint(4), 2);")]
        #[doc = concat!("assert_eq!(1", stringify!($SelfT), ".midpoint(4), 2);")]
        /// ```
        #[stable(feature = "num_midpoint", since = "1.85.0")]
        #[rustc_const_stable(feature = "num_midpoint", since = "1.85.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[doc(alias = "average_floor")]
        #[doc(alias = "average")]
        #[inline]
        pub const fn midpoint(self, rhs: $SelfT) -> $SelfT {
            ((self as $WideT + rhs as $WideT) / 2) as $SelfT
        }
    };
    ($SelfT:ty, $WideT:ty, signed) => {
        /// Calculates the midpoint (average) between `self` and `rhs`.
        ///
        /// `midpoint(a, b)` is `(a + b) / 2` as if it were performed in a
        /// 足够大的有符号整数类型中执行。这意味着结果总是
        /// 向零方向取整，且永远不会发生溢出。
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(0", stringify!($SelfT), ".midpoint(4), 2);")]
        #[doc = concat!("assert_eq!((-1", stringify!($SelfT), ").midpoint(2), 0);")]
        #[doc = concat!("assert_eq!((-7", stringify!($SelfT), ").midpoint(0), -3);")]
        #[doc = concat!("assert_eq!(0", stringify!($SelfT), ".midpoint(-7), -3);")]
        #[doc = concat!("assert_eq!(0", stringify!($SelfT), ".midpoint(7), 3);")]
        /// ```
        #[stable(feature = "num_midpoint_signed", since = "1.87.0")]
        #[rustc_const_stable(feature = "num_midpoint_signed", since = "1.87.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[doc(alias = "average_floor")]
        #[doc(alias = "average_ceil")]
        #[doc(alias = "average")]
        #[inline]
        pub const fn midpoint(self, rhs: $SelfT) -> $SelfT {
            ((self as $WideT + rhs as $WideT) / 2) as $SelfT
        }
    };
}

macro_rules! widening_mul_impl {
    ($SelfT:ty, $WideT:ty) => {
        /// Widening multiplication. Computes `self * rhs`, widening to a larger integer.
        ///
        /// 返回的值始终精确，且永远不会发生溢出。
        ///
        /// Note that this method is semantically equivalent to [`carrying_mul`] with a
        /// 零的进位，后者则返回一个元组表示结果的低位和
        /// 高位部分。如果您需要与其他大整数辅助函数互操作，或者此方法不适用于特定类型，请考虑使用它。
        /// # 示例
        /// 执行扩展无进位乘法。
        ///
        /// [`carrying_mul`]: Self::carrying_mul
        ///
        /// # 示例
        ///
        /// ```
        /// #![feature(widening_mul)]
        ///
        #[doc = concat!("assert_eq!(", stringify!($SelfT), "::MAX.widening_mul(0_", stringify!($SelfT), "), 0);")]
        #[doc = concat!("assert_eq!(", stringify!($SelfT), "::MAX.widening_mul(", stringify!($SelfT), "::MAX), ", stringify!($SelfT), "::MAX as ", stringify!($WideT), " * ", stringify!($SelfT), "::MAX as ", stringify!($WideT), ");")]
        /// ```
        #[unstable(feature = "widening_mul", issue = "152016")]
        #[rustc_const_unstable(feature = "widening_mul", issue = "152016")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        pub const fn widening_mul(self, rhs: Self) -> $WideT {
            self as $WideT * rhs as $WideT
        }
    }
}

macro_rules! widening_carryless_mul_impl {
    ($SelfT:ty, $WideT:ty) => {
        /// 执行扩展无进位乘法。
        ///
        /// # 示例
        ///
        /// ```
        /// #![feature(uint_carryless_mul)]
        ///
        #[doc = concat!("assert_eq!(", stringify!($SelfT), "::MAX.widening_carryless_mul(",
                                stringify!($SelfT), "::MAX), ", stringify!($WideT), "::MAX / 3);")]
        /// ```
        #[rustc_const_unstable(feature = "uint_carryless_mul", issue = "152080")]
        #[doc(alias = "clmul")]
        #[unstable(feature = "uint_carryless_mul", issue = "152080")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        pub const fn widening_carryless_mul(self, rhs: $SelfT) -> $WideT {
            (self as $WideT).carryless_mul(rhs as $WideT)
        }
    }
}

macro_rules! carrying_carryless_mul_impl {
    (u128, u256) => {
        carrying_carryless_mul_impl! { @internal u128 =>
            pub const fn carrying_carryless_mul(self, rhs: Self, carry: Self) -> (Self, Self) {
                let x0 = self as u64;
                let x1 = (self >> 64) as u64;
                let y0 = rhs as u64;
                let y1 = (rhs >> 64) as u64;

                let z0 = u64::widening_carryless_mul(x0, y0);
                let z2 = u64::widening_carryless_mul(x1, y1);

                // The grade school algorithm would compute:
                // z1 = x0y1 ^ x1y0

                // Instead, Karatsuba first computes:
                let z3 = u64::widening_carryless_mul(x0 ^ x1, y0 ^ y1);
                // Since it distributes over XOR,
                // z3 == x0y0 ^ x0y1 ^ x1y0 ^ x1y1
                //       |--|   |---------|   |--|
                //    ==  z0  ^     z1      ^  z2
                // so we can compute z1 as
                let z1 = z3 ^ z0 ^ z2;

                let lo = z0 ^ (z1 << 64);
                let hi = z2 ^ (z1 >> 64);

                (lo ^ carry, hi)
            }
        }
    };
    ($SelfT:ty, $WideT:ty) => {
        carrying_carryless_mul_impl! { @internal $SelfT =>
            pub const fn carrying_carryless_mul(self, rhs: Self, carry: Self) -> (Self, Self) {
                // Can't use widening_carryless_mul because it's not implemented for usize.
                let p = (self as $WideT).carryless_mul(rhs as $WideT);

                let lo = (p as $SelfT);
                let hi = (p  >> Self::BITS) as $SelfT;

                (lo ^ carry, hi)
            }
        }
    };
    (@internal $SelfT:ty => $($fn:tt)*) => {
        /// 计算“无溢出情况下的全进位无乘法”。
        ///
        /// 此函数返回结果的低位（循环）位和高位（溢出）位
        /// 作为两个独立的值，按此顺序。
        ///
        /// # 示例
        ///
        /// Please note that this example is shared among integer types, which is why `u8` is used.
        ///
        /// ```
        /// #![feature(uint_carryless_mul)]
        ///
        /// assert_eq!(0b1000_0000u8.carrying_carryless_mul(0b1000_0000, 0b0000), (0, 0b0100_0000));
        /// assert_eq!(0b1000_0000u8.carrying_carryless_mul(0b1000_0000, 0b1111), (0b1111, 0b0100_0000));
        #[doc = concat!("assert_eq!(",
            stringify!($SelfT), "::MAX.carrying_carryless_mul(", stringify!($SelfT), "::MAX, ", stringify!($SelfT), "::MAX), ",
            "(!(", stringify!($SelfT), "::MAX / 3), ", stringify!($SelfT), "::MAX / 3));"
        )]
        /// ```
        #[rustc_const_unstable(feature = "uint_carryless_mul", issue = "152080")]
        #[doc(alias = "clmul")]
        #[unstable(feature = "uint_carryless_mul", issue = "152080")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        $($fn)*
    }
}

impl i8 {
    int_impl! {
        Self = i8,
        ActualT = i8,
        UnsignedT = u8,
        BITS = 8,
        BITS_MINUS_ONE = 7,
        Min = -128,
        Max = 127,
        rot = 2,
        rot_op     = "-0x7e",
        rot_result = "0x0a",
        swap_op    = "0x12",
        swapped    = "0x12",
        reversed   = "0x48",
        le_bytes = "[0x12]",
        be_bytes = "[0x12]",
        to_xe_bytes_doc = i8_xe_bytes_doc!(),
        from_xe_bytes_doc = i8_xe_bytes_doc!(),
        bound_condition = "",
    }
    midpoint_impl! { i8, i16, signed }
    widening_mul_impl! { i8, i16 }
}

impl i16 {
    int_impl! {
        Self = i16,
        ActualT = i16,
        UnsignedT = u16,
        BITS = 16,
        BITS_MINUS_ONE = 15,
        Min = -32768,
        Max = 32767,
        rot = 4,
        rot_op     = "-0x5ffd",
        rot_result = "0x003a",
        swap_op    = "0x1234",
        swapped    = "0x3412",
        reversed   = "0x2c48",
        le_bytes = "[0x34, 0x12]",
        be_bytes = "[0x12, 0x34]",
        to_xe_bytes_doc = "",
        from_xe_bytes_doc = "",
        bound_condition = "",
    }
    midpoint_impl! { i16, i32, signed }
    widening_mul_impl! { i16, i32 }
}

impl i32 {
    int_impl! {
        Self = i32,
        ActualT = i32,
        UnsignedT = u32,
        BITS = 32,
        BITS_MINUS_ONE = 31,
        Min = -2147483648,
        Max = 2147483647,
        rot = 8,
        rot_op     = "0x010000b3",
        rot_result = "0x0000b301",
        swap_op    = "0x12345678",
        swapped    = "0x78563412",
        reversed   = "0x1e6a2c48",
        le_bytes = "[0x78, 0x56, 0x34, 0x12]",
        be_bytes = "[0x12, 0x34, 0x56, 0x78]",
        to_xe_bytes_doc = "",
        from_xe_bytes_doc = "",
        bound_condition = "",
    }
    midpoint_impl! { i32, i64, signed }
    widening_mul_impl! { i32, i64 }
}

impl i64 {
    int_impl! {
        Self = i64,
        ActualT = i64,
        UnsignedT = u64,
        BITS = 64,
        BITS_MINUS_ONE = 63,
        Min = -9223372036854775808,
        Max = 9223372036854775807,
        rot = 12,
        rot_op     = "0x0aa00000000006e1",
        rot_result = "0x00000000006e10aa",
        swap_op    = "0x1234567890123456",
        swapped    = "0x5634129078563412",
        reversed   = "0x6a2c48091e6a2c48",
        le_bytes = "[0x56, 0x34, 0x12, 0x90, 0x78, 0x56, 0x34, 0x12]",
        be_bytes = "[0x12, 0x34, 0x56, 0x78, 0x90, 0x12, 0x34, 0x56]",
        to_xe_bytes_doc = "",
        from_xe_bytes_doc = "",
        bound_condition = "",
    }
    midpoint_impl! { i64, signed }
    widening_mul_impl! { i64, i128 }
}

impl i128 {
    int_impl! {
        Self = i128,
        ActualT = i128,
        UnsignedT = u128,
        BITS = 128,
        BITS_MINUS_ONE = 127,
        Min = -170141183460469231731687303715884105728,
        Max = 170141183460469231731687303715884105727,
        rot = 16,
        rot_op     = "0x13f40000000000000000000000004f76",
        rot_result = "0x0000000000000000000000004f7613f4",
        swap_op    = "0x12345678901234567890123456789012",
        swapped    = "0x12907856341290785634129078563412",
        reversed   = "0x48091e6a2c48091e6a2c48091e6a2c48",
        le_bytes = "[0x12, 0x90, 0x78, 0x56, 0x34, 0x12, 0x90, 0x78, \
            0x56, 0x34, 0x12, 0x90, 0x78, 0x56, 0x34, 0x12]",
        be_bytes = "[0x12, 0x34, 0x56, 0x78, 0x90, 0x12, 0x34, 0x56, \
            0x78, 0x90, 0x12, 0x34, 0x56, 0x78, 0x90, 0x12]",
        to_xe_bytes_doc = "",
        from_xe_bytes_doc = "",
        bound_condition = "",
    }
    midpoint_impl! { i128, signed }
}

#[doc(auto_cfg = false)]
#[cfg(target_pointer_width = "16")]
impl isize {
    int_impl! {
        Self = isize,
        ActualT = i16,
        UnsignedT = usize,
        BITS = 16,
        BITS_MINUS_ONE = 15,
        Min = -32768,
        Max = 32767,
        rot = 4,
        rot_op     = "-0x5ffd",
        rot_result = "0x003a",
        swap_op    = "0x1234",
        swapped    = "0x3412",
        reversed   = "0x2c48",
        le_bytes = "[0x34, 0x12]",
        be_bytes = "[0x12, 0x34]",
        to_xe_bytes_doc = usize_isize_to_xe_bytes_doc!(),
        from_xe_bytes_doc = usize_isize_from_xe_bytes_doc!(),
        bound_condition = " on 16-bit targets",
    }
    midpoint_impl! { isize, i32, signed }
}

#[doc(auto_cfg = false)]
#[cfg(target_pointer_width = "32")]
impl isize {
    int_impl! {
        Self = isize,
        ActualT = i32,
        UnsignedT = usize,
        BITS = 32,
        BITS_MINUS_ONE = 31,
        Min = -2147483648,
        Max = 2147483647,
        rot = 8,
        rot_op     = "0x010000b3",
        rot_result = "0x0000b301",
        swap_op    = "0x12345678",
        swapped    = "0x78563412",
        reversed   = "0x1e6a2c48",
        le_bytes = "[0x78, 0x56, 0x34, 0x12]",
        be_bytes = "[0x12, 0x34, 0x56, 0x78]",
        to_xe_bytes_doc = usize_isize_to_xe_bytes_doc!(),
        from_xe_bytes_doc = usize_isize_from_xe_bytes_doc!(),
        bound_condition = " on 32-bit targets",
    }
    midpoint_impl! { isize, i64, signed }
}

#[doc(auto_cfg = false)]
#[cfg(target_pointer_width = "64")]
impl isize {
    int_impl! {
        Self = isize,
        ActualT = i64,
        UnsignedT = usize,
        BITS = 64,
        BITS_MINUS_ONE = 63,
        Min = -9223372036854775808,
        Max = 9223372036854775807,
        rot = 12,
        rot_op     = "0x0aa00000000006e1",
        rot_result = "0x00000000006e10aa",
        swap_op    = "0x1234567890123456",
        swapped    = "0x5634129078563412",
        reversed   = "0x6a2c48091e6a2c48",
        le_bytes = "[0x56, 0x34, 0x12, 0x90, 0x78, 0x56, 0x34, 0x12]",
        be_bytes = "[0x12, 0x34, 0x56, 0x78, 0x90, 0x12, 0x34, 0x56]",
        to_xe_bytes_doc = usize_isize_to_xe_bytes_doc!(),
        from_xe_bytes_doc = usize_isize_from_xe_bytes_doc!(),
        bound_condition = " on 64-bit targets",
    }
    midpoint_impl! { isize, signed }
}

/// 如果此掩码选择的位被设置，ascii 为小写。
const ASCII_CASE_MASK: u8 = 0b0010_0000;

impl u8 {
    uint_impl! {
        Self = u8,
        ActualT = u8,
        SignedT = i8,
        BITS = 8,
        BITS_MINUS_ONE = 7,
        MAX = 255,
        rot = 2,
        rot_op       = "0x82",
        rot_result   = "0x0a",
        fsh_op       = "0x36",
        fshl_result  = "0x08",
        fshr_result  = "0x8d",
        clmul_lhs    = "0x12",
        clmul_rhs    = "0x34",
        clmul_result = "0x28",
        swap_op      = "0x12",
        swapped      = "0x12",
        reversed     = "0x48",
        le_bytes = "[0x12]",
        be_bytes = "[0x12]",
        to_xe_bytes_doc = u8_xe_bytes_doc!(),
        from_xe_bytes_doc = u8_xe_bytes_doc!(),
        bound_condition = "",
    }
    midpoint_impl! { u8, u16, unsigned }
    widening_mul_impl! { u8, u16 }
    widening_carryless_mul_impl! { u8, u16 }
    carrying_carryless_mul_impl! { u8, u16 }

    /// 检查值是否在 ASCII 范围内。
    ///
    /// # 示例
    ///
    /// ```
    /// let ascii = 97u8;
    /// let non_ascii = 150u8;
    ///
    /// assert!(ascii.is_ascii());
    /// assert!(!non_ascii.is_ascii());
    /// ```
    #[must_use]
    #[stable(feature = "ascii_methods_on_intrinsics", since = "1.23.0")]
    #[rustc_const_stable(feature = "const_u8_is_ascii", since = "1.43.0")]
    #[inline]
    pub const fn is_ascii(&self) -> bool {
        *self <= 127
    }

    /// 如果此字节的值在 ASCII 范围内，则将其返回为
    /// [ASCII character](ascii::Char).  Otherwise, returns `None`.
    #[must_use]
    #[unstable(feature = "ascii_char", issue = "110998")]
    #[inline]
    pub const fn as_ascii(&self) -> Option<ascii::Char> {
        ascii::Char::from_u8(*self)
    }

    /// Converts this byte to an [ASCII character](ascii::Char), without
    /// 检查其是否有效。
    ///
    /// # 安全性
    ///
    /// 此字节必须是有效的 ASCII 字符，否则会导致未定义行为。
    #[must_use]
    #[unstable(feature = "ascii_char", issue = "110998")]
    #[inline]
    pub const unsafe fn as_ascii_unchecked(&self) -> ascii::Char {
        assert_unsafe_precondition!(
            check_library_ub,
            "as_ascii_unchecked requires that the byte is valid ASCII",
            (it: &u8 = self) => it.is_ascii()
        );

        // SAFETY: the caller promised that this byte is ASCII.
        unsafe { ascii::Char::from_u8_unchecked(*self) }
    }

    /// 将其值复制为其 ASCII 大写形式。
    ///
    /// ASCII 字母 'a' 到 'z' 会被映射为 'A' 到 'Z'，
    /// 但非 ASCII 字母保持不变。
    ///
    /// To uppercase the value in-place, use [`make_ascii_uppercase`].
    ///
    /// # 示例
    ///
    /// ```
    /// let lowercase_a = 97u8;
    ///
    /// assert_eq!(65, lowercase_a.to_ascii_uppercase());
    /// ```
    ///
    /// [`make_ascii_uppercase`]: Self::make_ascii_uppercase
    #[must_use = "to uppercase the value in-place, use `make_ascii_uppercase()`"]
    #[stable(feature = "ascii_methods_on_intrinsics", since = "1.23.0")]
    #[rustc_const_stable(feature = "const_ascii_methods_on_intrinsics", since = "1.52.0")]
    #[inline]
    pub const fn to_ascii_uppercase(&self) -> u8 {
        // Toggle the 6th bit if this is a lowercase letter
        *self ^ ((self.is_ascii_lowercase() as u8) * ASCII_CASE_MASK)
    }

    /// 将其值复制为其 ASCII 小写形式。
    ///
    /// ASCII 字母 'A' 到 'Z' 会被映射为 'a' 到 'z'，
    /// 但非 ASCII 字母保持不变。
    ///
    /// To lowercase the value in-place, use [`make_ascii_lowercase`].
    ///
    /// # 示例
    ///
    /// ```
    /// let uppercase_a = 65u8;
    ///
    /// assert_eq!(97, uppercase_a.to_ascii_lowercase());
    /// ```
    ///
    /// [`make_ascii_lowercase`]: Self::make_ascii_lowercase
    #[must_use = "to lowercase the value in-place, use `make_ascii_lowercase()`"]
    #[stable(feature = "ascii_methods_on_intrinsics", since = "1.23.0")]
    #[rustc_const_stable(feature = "const_ascii_methods_on_intrinsics", since = "1.52.0")]
    #[inline]
    pub const fn to_ascii_lowercase(&self) -> u8 {
        // Set the 6th bit if this is an uppercase letter
        *self | (self.is_ascii_uppercase() as u8 * ASCII_CASE_MASK)
    }

    /// 假设 self 是 ASCII 字符
    #[inline]
    pub(crate) const fn ascii_change_case_unchecked(&self) -> u8 {
        *self ^ ASCII_CASE_MASK
    }

    /// 检查两个值是否为不区分大小写的 ASCII 匹配。
    ///
    /// This is equivalent to `to_ascii_lowercase(a) == to_ascii_lowercase(b)`.
    ///
    /// # 示例
    ///
    /// ```
    /// let lowercase_a = 97u8;
    /// let uppercase_a = 65u8;
    ///
    /// assert!(lowercase_a.eq_ignore_ascii_case(&uppercase_a));
    /// ```
    #[stable(feature = "ascii_methods_on_intrinsics", since = "1.23.0")]
    #[rustc_const_stable(feature = "const_ascii_methods_on_intrinsics", since = "1.52.0")]
    #[expect(clippy::manual_ignore_case_cmp, reason = "implements eq_ignore_ascii_case")]
    #[inline]
    pub const fn eq_ignore_ascii_case(&self, other: &u8) -> bool {
        self.to_ascii_lowercase() == other.to_ascii_lowercase()
    }

    /// 就地将此值转换为其 ASCII 大写形式。
    ///
    /// ASCII 字母 'a' 到 'z' 会被映射为 'A' 到 'Z'，
    /// 但非 ASCII 字母保持不变。
    ///
    /// 要返回一个新的大写值而不修改现有值，请使用
    /// [`to_ascii_uppercase`].
    ///
    /// # 示例
    ///
    /// ```
    /// let mut byte = b'a';
    ///
    /// byte.make_ascii_uppercase();
    ///
    /// assert_eq!(b'A', byte);
    /// ```
    ///
    /// [`to_ascii_uppercase`]: Self::to_ascii_uppercase
    #[stable(feature = "ascii_methods_on_intrinsics", since = "1.23.0")]
    #[rustc_const_stable(feature = "const_make_ascii", since = "1.84.0")]
    #[inline]
    pub const fn make_ascii_uppercase(&mut self) {
        *self = self.to_ascii_uppercase();
    }

    /// 就地将此值转换为其 ASCII 小写形式。
    ///
    /// ASCII 字母 'A' 到 'Z' 会被映射为 'a' 到 'z'，
    /// 但非 ASCII 字母保持不变。
    ///
    /// 要返回一个新的小写值而不修改现有值，请使用
    /// [`to_ascii_lowercase`].
    ///
    /// # 示例
    ///
    /// ```
    /// let mut byte = b'A';
    ///
    /// byte.make_ascii_lowercase();
    ///
    /// assert_eq!(b'a', byte);
    /// ```
    ///
    /// [`to_ascii_lowercase`]: Self::to_ascii_lowercase
    #[stable(feature = "ascii_methods_on_intrinsics", since = "1.23.0")]
    #[rustc_const_stable(feature = "const_make_ascii", since = "1.84.0")]
    #[inline]
    pub const fn make_ascii_lowercase(&mut self) {
        *self = self.to_ascii_lowercase();
    }

    /// 检查值是否为 ASCII 字母字符：
    ///
    /// - U+0041 'A' ..= U+005A 'Z', or
    /// - U+0061 'a' ..= U+007A 'z'.
    ///
    /// # 示例
    ///
    /// ```
    /// let uppercase_a = b'A';
    /// let uppercase_g = b'G';
    /// let a = b'a';
    /// let g = b'g';
    /// let zero = b'0';
    /// let percent = b'%';
    /// let space = b' ';
    /// let lf = b'\n';
    /// let esc = b'\x1b';
    ///
    /// assert!(uppercase_a.is_ascii_alphabetic());
    /// assert!(uppercase_g.is_ascii_alphabetic());
    /// assert!(a.is_ascii_alphabetic());
    /// assert!(g.is_ascii_alphabetic());
    /// assert!(!zero.is_ascii_alphabetic());
    /// assert!(!percent.is_ascii_alphabetic());
    /// assert!(!space.is_ascii_alphabetic());
    /// assert!(!lf.is_ascii_alphabetic());
    /// assert!(!esc.is_ascii_alphabetic());
    /// ```
    #[must_use]
    #[stable(feature = "ascii_ctype_on_intrinsics", since = "1.24.0")]
    #[rustc_const_stable(feature = "const_ascii_ctype_on_intrinsics", since = "1.47.0")]
    #[inline]
    pub const fn is_ascii_alphabetic(&self) -> bool {
        matches!(*self, b'A'..=b'Z' | b'a'..=b'z')
    }

    /// 检查值是否为 ASCII 大写字符：
    /// U+0041 'A' ..= U+005A 'Z'.
    ///
    /// # 示例
    ///
    /// ```
    /// let uppercase_a = b'A';
    /// let uppercase_g = b'G';
    /// let a = b'a';
    /// let g = b'g';
    /// let zero = b'0';
    /// let percent = b'%';
    /// let space = b' ';
    /// let lf = b'\n';
    /// let esc = b'\x1b';
    ///
    /// assert!(uppercase_a.is_ascii_uppercase());
    /// assert!(uppercase_g.is_ascii_uppercase());
    /// assert!(!a.is_ascii_uppercase());
    /// assert!(!g.is_ascii_uppercase());
    /// assert!(!zero.is_ascii_uppercase());
    /// assert!(!percent.is_ascii_uppercase());
    /// assert!(!space.is_ascii_uppercase());
    /// assert!(!lf.is_ascii_uppercase());
    /// assert!(!esc.is_ascii_uppercase());
    /// ```
    #[must_use]
    #[stable(feature = "ascii_ctype_on_intrinsics", since = "1.24.0")]
    #[rustc_const_stable(feature = "const_ascii_ctype_on_intrinsics", since = "1.47.0")]
    #[inline]
    pub const fn is_ascii_uppercase(&self) -> bool {
        matches!(*self, b'A'..=b'Z')
    }

    /// 检查值是否为 ASCII 小写字符：
    /// U+0061 'a' ..= U+007A 'z'.
    ///
    /// # 示例
    ///
    /// ```
    /// let uppercase_a = b'A';
    /// let uppercase_g = b'G';
    /// let a = b'a';
    /// let g = b'g';
    /// let zero = b'0';
    /// let percent = b'%';
    /// let space = b' ';
    /// let lf = b'\n';
    /// let esc = b'\x1b';
    ///
    /// assert!(!uppercase_a.is_ascii_lowercase());
    /// assert!(!uppercase_g.is_ascii_lowercase());
    /// assert!(a.is_ascii_lowercase());
    /// assert!(g.is_ascii_lowercase());
    /// assert!(!zero.is_ascii_lowercase());
    /// assert!(!percent.is_ascii_lowercase());
    /// assert!(!space.is_ascii_lowercase());
    /// assert!(!lf.is_ascii_lowercase());
    /// assert!(!esc.is_ascii_lowercase());
    /// ```
    #[must_use]
    #[stable(feature = "ascii_ctype_on_intrinsics", since = "1.24.0")]
    #[rustc_const_stable(feature = "const_ascii_ctype_on_intrinsics", since = "1.47.0")]
    #[inline]
    pub const fn is_ascii_lowercase(&self) -> bool {
        matches!(*self, b'a'..=b'z')
    }

    /// 检查值是否为 ASCII 字母数字字符：
    ///
    /// - U+0041 'A' ..= U+005A 'Z', or
    /// - U+0061 'a' ..= U+007A 'z', or
    /// - U+0030 '0' ..= U+0039 '9'.
    ///
    /// # 示例
    ///
    /// ```
    /// let uppercase_a = b'A';
    /// let uppercase_g = b'G';
    /// let a = b'a';
    /// let g = b'g';
    /// let zero = b'0';
    /// let percent = b'%';
    /// let space = b' ';
    /// let lf = b'\n';
    /// let esc = b'\x1b';
    ///
    /// assert!(uppercase_a.is_ascii_alphanumeric());
    /// assert!(uppercase_g.is_ascii_alphanumeric());
    /// assert!(a.is_ascii_alphanumeric());
    /// assert!(g.is_ascii_alphanumeric());
    /// assert!(zero.is_ascii_alphanumeric());
    /// assert!(!percent.is_ascii_alphanumeric());
    /// assert!(!space.is_ascii_alphanumeric());
    /// assert!(!lf.is_ascii_alphanumeric());
    /// assert!(!esc.is_ascii_alphanumeric());
    /// ```
    #[must_use]
    #[stable(feature = "ascii_ctype_on_intrinsics", since = "1.24.0")]
    #[rustc_const_stable(feature = "const_ascii_ctype_on_intrinsics", since = "1.47.0")]
    #[inline]
    pub const fn is_ascii_alphanumeric(&self) -> bool {
        matches!(*self, b'0'..=b'9') | matches!(*self, b'A'..=b'Z') | matches!(*self, b'a'..=b'z')
    }

    /// 检查值是否为 ASCII 十进制数字：
    /// U+0030 '0' ..= U+0039 '9'.
    ///
    /// # 示例
    ///
    /// ```
    /// let uppercase_a = b'A';
    /// let uppercase_g = b'G';
    /// let a = b'a';
    /// let g = b'g';
    /// let zero = b'0';
    /// let percent = b'%';
    /// let space = b' ';
    /// let lf = b'\n';
    /// let esc = b'\x1b';
    ///
    /// assert!(!uppercase_a.is_ascii_digit());
    /// assert!(!uppercase_g.is_ascii_digit());
    /// assert!(!a.is_ascii_digit());
    /// assert!(!g.is_ascii_digit());
    /// assert!(zero.is_ascii_digit());
    /// assert!(!percent.is_ascii_digit());
    /// assert!(!space.is_ascii_digit());
    /// assert!(!lf.is_ascii_digit());
    /// assert!(!esc.is_ascii_digit());
    /// ```
    #[must_use]
    #[stable(feature = "ascii_ctype_on_intrinsics", since = "1.24.0")]
    #[rustc_const_stable(feature = "const_ascii_ctype_on_intrinsics", since = "1.47.0")]
    #[inline]
    pub const fn is_ascii_digit(&self) -> bool {
        matches!(*self, b'0'..=b'9')
    }

    /// 检查值是否为 ASCII 八进制数字：
    /// U+0030 '0' ..= U+0037 '7'.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(is_ascii_octdigit)]
    ///
    /// let uppercase_a = b'A';
    /// let a = b'a';
    /// let zero = b'0';
    /// let seven = b'7';
    /// let nine = b'9';
    /// let percent = b'%';
    /// let lf = b'\n';
    ///
    /// assert!(!uppercase_a.is_ascii_octdigit());
    /// assert!(!a.is_ascii_octdigit());
    /// assert!(zero.is_ascii_octdigit());
    /// assert!(seven.is_ascii_octdigit());
    /// assert!(!nine.is_ascii_octdigit());
    /// assert!(!percent.is_ascii_octdigit());
    /// assert!(!lf.is_ascii_octdigit());
    /// ```
    #[must_use]
    #[unstable(feature = "is_ascii_octdigit", issue = "101288")]
    #[inline]
    pub const fn is_ascii_octdigit(&self) -> bool {
        matches!(*self, b'0'..=b'7')
    }

    /// 检查值是否为 ASCII 十六进制数字：
    ///
    /// - U+0030 '0' ..= U+0039 '9', or
    /// - U+0041 'A' ..= U+0046 'F', or
    /// - U+0061 'a' ..= U+0066 'f'.
    ///
    /// # 示例
    ///
    /// ```
    /// let uppercase_a = b'A';
    /// let uppercase_g = b'G';
    /// let a = b'a';
    /// let g = b'g';
    /// let zero = b'0';
    /// let percent = b'%';
    /// let space = b' ';
    /// let lf = b'\n';
    /// let esc = b'\x1b';
    ///
    /// assert!(uppercase_a.is_ascii_hexdigit());
    /// assert!(!uppercase_g.is_ascii_hexdigit());
    /// assert!(a.is_ascii_hexdigit());
    /// assert!(!g.is_ascii_hexdigit());
    /// assert!(zero.is_ascii_hexdigit());
    /// assert!(!percent.is_ascii_hexdigit());
    /// assert!(!space.is_ascii_hexdigit());
    /// assert!(!lf.is_ascii_hexdigit());
    /// assert!(!esc.is_ascii_hexdigit());
    /// ```
    #[must_use]
    #[stable(feature = "ascii_ctype_on_intrinsics", since = "1.24.0")]
    #[rustc_const_stable(feature = "const_ascii_ctype_on_intrinsics", since = "1.47.0")]
    #[inline]
    pub const fn is_ascii_hexdigit(&self) -> bool {
        matches!(*self, b'0'..=b'9') | matches!(*self, b'A'..=b'F') | matches!(*self, b'a'..=b'f')
    }

    /// 检查值是否为 ASCII 标点符号或符号字符
    /// （即非字母数字、空格或控制字符）：
    ///
    /// - U+0021 ..= U+002F `! " # $ % & ' ( ) * + , - . /`, or
    /// - U+003A ..= U+0040 `: ; < = > ? @`, or
    /// - U+005B ..= U+0060 `` [ \ ] ^ _ ` ``, or
    /// - U+007B ..= U+007E `{ | } ~`
    ///
    /// # 示例
    ///
    /// ```
    /// let uppercase_a = b'A';
    /// let uppercase_g = b'G';
    /// let a = b'a';
    /// let g = b'g';
    /// let zero = b'0';
    /// let percent = b'%';
    /// let space = b' ';
    /// let lf = b'\n';
    /// let esc = b'\x1b';
    ///
    /// assert!(!uppercase_a.is_ascii_punctuation());
    /// assert!(!uppercase_g.is_ascii_punctuation());
    /// assert!(!a.is_ascii_punctuation());
    /// assert!(!g.is_ascii_punctuation());
    /// assert!(!zero.is_ascii_punctuation());
    /// assert!(percent.is_ascii_punctuation());
    /// assert!(!space.is_ascii_punctuation());
    /// assert!(!lf.is_ascii_punctuation());
    /// assert!(!esc.is_ascii_punctuation());
    /// ```
    #[must_use]
    #[stable(feature = "ascii_ctype_on_intrinsics", since = "1.24.0")]
    #[rustc_const_stable(feature = "const_ascii_ctype_on_intrinsics", since = "1.47.0")]
    #[inline]
    pub const fn is_ascii_punctuation(&self) -> bool {
        matches!(*self, b'!'..=b'/')
            | matches!(*self, b':'..=b'@')
            | matches!(*self, b'['..=b'`')
            | matches!(*self, b'{'..=b'~')
    }

    /// 检查值是否为 ASCII 图形字符
    /// （即非空格或控制字符）：
    /// U+0021 '!' ..= U+007E '~'.
    ///
    /// # 示例
    ///
    /// ```
    /// let uppercase_a = b'A';
    /// let uppercase_g = b'G';
    /// let a = b'a';
    /// let g = b'g';
    /// let zero = b'0';
    /// let percent = b'%';
    /// let space = b' ';
    /// let lf = b'\n';
    /// let esc = b'\x1b';
    ///
    /// assert!(uppercase_a.is_ascii_graphic());
    /// assert!(uppercase_g.is_ascii_graphic());
    /// assert!(a.is_ascii_graphic());
    /// assert!(g.is_ascii_graphic());
    /// assert!(zero.is_ascii_graphic());
    /// assert!(percent.is_ascii_graphic());
    /// assert!(!space.is_ascii_graphic());
    /// assert!(!lf.is_ascii_graphic());
    /// assert!(!esc.is_ascii_graphic());
    /// ```
    #[must_use]
    #[stable(feature = "ascii_ctype_on_intrinsics", since = "1.24.0")]
    #[rustc_const_stable(feature = "const_ascii_ctype_on_intrinsics", since = "1.47.0")]
    #[inline]
    pub const fn is_ascii_graphic(&self) -> bool {
        matches!(*self, b'!'..=b'~')
    }

    /// 检查值是否为 ASCII 空格字符：
    /// U+0020 空格，U+0009 水平制表符，U+000A 换行符，
    /// U+000C 换行符，或 U+000D 回车符。
    ///
    /// **警告：** 由于上述列表排除了 U+000B 垂直制表符，
    /// `b.is_ascii_whitespace()` is **not** equivalent to `char::from(b).is_whitespace()`.
    ///
    /// Rust 使用 WhatWG Infra Standard 的 [ASCII 定义]
    /// 空格][infra-aw]。还有其他几种定义在
    /// 广泛使用中。例如，[POSIX 区域设置][pct] 包括
    /// U+000B 垂直制表符以及上述所有字符。
    /// 但是——根据同一份规范——[默认规则为
    /// Bourne shell 中的“字段分割”[bfs]仅将*仅*视为
    /// 空格、水平制表符和换行符视为空白字符。
    ///
    /// 如果您正在编写处理现有
    /// 文件格式的程序，请先查看该格式对空白字符的定义。
    /// 在使用此函数之前，请务必了解其定义。
    ///
    /// [infra-aw]: https://infra.spec.whatwg.org/#ascii-whitespace
    /// [pct]: https://pubs.opengroup.org/onlinepubs/9799919799/basedefs/V1_chap07.html#tag_07_03_01
    /// [bfs]: https://pubs.opengroup.org/onlinepubs/9799919799/utilities/V3_chap02.html#tag_19_06_05
    ///
    /// # 示例
    ///
    /// ```
    /// let uppercase_a = b'A';
    /// let uppercase_g = b'G';
    /// let a = b'a';
    /// let g = b'g';
    /// let zero = b'0';
    /// let percent = b'%';
    /// let space = b' ';
    /// let lf = b'\n';
    /// let esc = b'\x1b';
    ///
    /// assert!(!uppercase_a.is_ascii_whitespace());
    /// assert!(!uppercase_g.is_ascii_whitespace());
    /// assert!(!a.is_ascii_whitespace());
    /// assert!(!g.is_ascii_whitespace());
    /// assert!(!zero.is_ascii_whitespace());
    /// assert!(!percent.is_ascii_whitespace());
    /// assert!(space.is_ascii_whitespace());
    /// assert!(lf.is_ascii_whitespace());
    /// assert!(!esc.is_ascii_whitespace());
    /// ```
    #[must_use]
    #[stable(feature = "ascii_ctype_on_intrinsics", since = "1.24.0")]
    #[rustc_const_stable(feature = "const_ascii_ctype_on_intrinsics", since = "1.47.0")]
    #[inline]
    pub const fn is_ascii_whitespace(&self) -> bool {
        matches!(*self, b'\t' | b'\n' | b'\x0C' | b'\r' | b' ')
    }

    /// 检查值是否为 ASCII 控制字符：
    /// U+0000 NUL 至 U+001F UNIT SEPARATOR，或 U+007F DELETE。
    /// 请注意，大多数 ASCII 空白字符都是控制字符，
    /// 但空格不是。
    ///
    /// # 示例
    ///
    /// ```
    /// let uppercase_a = b'A';
    /// let uppercase_g = b'G';
    /// let a = b'a';
    /// let g = b'g';
    /// let zero = b'0';
    /// let percent = b'%';
    /// let space = b' ';
    /// let lf = b'\n';
    /// let esc = b'\x1b';
    ///
    /// assert!(!uppercase_a.is_ascii_control());
    /// assert!(!uppercase_g.is_ascii_control());
    /// assert!(!a.is_ascii_control());
    /// assert!(!g.is_ascii_control());
    /// assert!(!zero.is_ascii_control());
    /// assert!(!percent.is_ascii_control());
    /// assert!(!space.is_ascii_control());
    /// assert!(lf.is_ascii_control());
    /// assert!(esc.is_ascii_control());
    /// ```
    #[must_use]
    #[stable(feature = "ascii_ctype_on_intrinsics", since = "1.24.0")]
    #[rustc_const_stable(feature = "const_ascii_ctype_on_intrinsics", since = "1.47.0")]
    #[inline]
    pub const fn is_ascii_control(&self) -> bool {
        matches!(*self, b'\0'..=b'\x1F' | b'\x7F')
    }

    /// Returns an iterator that produces an escaped version of a `u8`,
    /// 将其视为一个 ASCII 字符。
    ///
    /// The behavior is identical to [`ascii::escape_default`].
    ///
    /// # 示例
    ///
    /// ```
    /// assert_eq!("0", b'0'.escape_ascii().to_string());
    /// assert_eq!("\\t", b'\t'.escape_ascii().to_string());
    /// assert_eq!("\\r", b'\r'.escape_ascii().to_string());
    /// assert_eq!("\\n", b'\n'.escape_ascii().to_string());
    /// assert_eq!("\\'", b'\''.escape_ascii().to_string());
    /// assert_eq!("\\\"", b'"'.escape_ascii().to_string());
    /// assert_eq!("\\\\", b'\\'.escape_ascii().to_string());
    /// assert_eq!("\\x9d", b'\x9d'.escape_ascii().to_string());
    /// ```
    #[must_use = "this returns the escaped byte as an iterator, \
                  without modifying the original"]
    #[stable(feature = "inherent_ascii_escape", since = "1.60.0")]
    #[inline]
    pub fn escape_ascii(self) -> ascii::EscapeDefault {
        ascii::escape_default(self)
    }

    #[inline]
    pub(crate) const fn is_utf8_char_boundary(self) -> bool {
        // This is bit magic equivalent to: b < 128 || b >= 192
        (self as i8) >= -0x40
    }
}

impl u16 {
    uint_impl! {
        Self = u16,
        ActualT = u16,
        SignedT = i16,
        BITS = 16,
        BITS_MINUS_ONE = 15,
        MAX = 65535,
        rot = 4,
        rot_op       = "0xa003",
        rot_result   = "0x003a",
        fsh_op       = "0x02de",
        fshl_result  = "0x0030",
        fshr_result  = "0x302d",
        clmul_lhs    = "0x9012",
        clmul_rhs    = "0xcd34",
        clmul_result = "0x0928",
        swap_op      = "0x1234",
        swapped      = "0x3412",
        reversed     = "0x2c48",
        le_bytes = "[0x34, 0x12]",
        be_bytes = "[0x12, 0x34]",
        to_xe_bytes_doc = "",
        from_xe_bytes_doc = "",
        bound_condition = "",
    }
    midpoint_impl! { u16, u32, unsigned }
    widening_mul_impl! { u16, u32 }
    widening_carryless_mul_impl! { u16, u32 }
    carrying_carryless_mul_impl! { u16, u32 }

    /// Checks if the value is a Unicode surrogate code point, which are disallowed values for [`char`].
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(utf16_extra)]
    ///
    /// let low_non_surrogate = 0xA000u16;
    /// let low_surrogate = 0xD800u16;
    /// let high_surrogate = 0xDC00u16;
    /// let high_non_surrogate = 0xE000u16;
    ///
    /// assert!(!low_non_surrogate.is_utf16_surrogate());
    /// assert!(low_surrogate.is_utf16_surrogate());
    /// assert!(high_surrogate.is_utf16_surrogate());
    /// assert!(!high_non_surrogate.is_utf16_surrogate());
    /// ```
    #[must_use]
    #[unstable(feature = "utf16_extra", issue = "94919")]
    #[inline]
    pub const fn is_utf16_surrogate(self) -> bool {
        matches!(self, 0xD800..=0xDFFF)
    }
}

impl u32 {
    uint_impl! {
        Self = u32,
        ActualT = u32,
        SignedT = i32,
        BITS = 32,
        BITS_MINUS_ONE = 31,
        MAX = 4294967295,
        rot = 8,
        rot_op       = "0x010000b3",
        rot_result   = "0x0000b301",
        fsh_op       = "0x2fe78e45",
        fshl_result  = "0x0000b32f",
        fshr_result  = "0xb32fe78e",
        clmul_lhs    = "0x56789012",
        clmul_rhs    = "0xf52ecd34",
        clmul_result = "0x9b980928",
        swap_op      = "0x12345678",
        swapped      = "0x78563412",
        reversed     = "0x1e6a2c48",
        le_bytes = "[0x78, 0x56, 0x34, 0x12]",
        be_bytes = "[0x12, 0x34, 0x56, 0x78]",
        to_xe_bytes_doc = "",
        from_xe_bytes_doc = "",
        bound_condition = "",
    }
    midpoint_impl! { u32, u64, unsigned }
    widening_mul_impl! { u32, u64 }
    widening_carryless_mul_impl! { u32, u64 }
    carrying_carryless_mul_impl! { u32, u64 }
}

impl u64 {
    uint_impl! {
        Self = u64,
        ActualT = u64,
        SignedT = i64,
        BITS = 64,
        BITS_MINUS_ONE = 63,
        MAX = 18446744073709551615,
        rot = 12,
        rot_op       = "0x0aa00000000006e1",
        rot_result   = "0x00000000006e10aa",
        fsh_op       = "0x2fe78e45983acd98",
        fshl_result  = "0x00000000006e12fe",
        fshr_result  = "0x6e12fe78e45983ac",
        clmul_lhs    = "0x7890123456789012",
        clmul_rhs    = "0xdd358416f52ecd34",
        clmul_result = "0x0a6299579b980928",
        swap_op      = "0x1234567890123456",
        swapped      = "0x5634129078563412",
        reversed     = "0x6a2c48091e6a2c48",
        le_bytes = "[0x56, 0x34, 0x12, 0x90, 0x78, 0x56, 0x34, 0x12]",
        be_bytes = "[0x12, 0x34, 0x56, 0x78, 0x90, 0x12, 0x34, 0x56]",
        to_xe_bytes_doc = "",
        from_xe_bytes_doc = "",
        bound_condition = "",
    }
    midpoint_impl! { u64, u128, unsigned }
    widening_mul_impl! { u64, u128 }
    widening_carryless_mul_impl! { u64, u128 }
    carrying_carryless_mul_impl! { u64, u128 }
}

impl u128 {
    uint_impl! {
        Self = u128,
        ActualT = u128,
        SignedT = i128,
        BITS = 128,
        BITS_MINUS_ONE = 127,
        MAX = 340282366920938463463374607431768211455,
        rot = 16,
        rot_op       = "0x13f40000000000000000000000004f76",
        rot_result   = "0x0000000000000000000000004f7613f4",
        fsh_op       = "0x02fe78e45983acd98039000008736273",
        fshl_result  = "0x0000000000000000000000004f7602fe",
        fshr_result  = "0x4f7602fe78e45983acd9803900000873",
        clmul_lhs    = "0x12345678901234567890123456789012",
        clmul_rhs    = "0x4317e40ab4ddcf05dd358416f52ecd34",
        clmul_result = "0xb9cf660de35d0c170a6299579b980928",
        swap_op      = "0x12345678901234567890123456789012",
        swapped      = "0x12907856341290785634129078563412",
        reversed     = "0x48091e6a2c48091e6a2c48091e6a2c48",
        le_bytes = "[0x12, 0x90, 0x78, 0x56, 0x34, 0x12, 0x90, 0x78, \
            0x56, 0x34, 0x12, 0x90, 0x78, 0x56, 0x34, 0x12]",
        be_bytes = "[0x12, 0x34, 0x56, 0x78, 0x90, 0x12, 0x34, 0x56, \
            0x78, 0x90, 0x12, 0x34, 0x56, 0x78, 0x90, 0x12]",
        to_xe_bytes_doc = "",
        from_xe_bytes_doc = "",
        bound_condition = "",
    }
    midpoint_impl! { u128, unsigned }
    carrying_carryless_mul_impl! { u128, u256 }
}

#[doc(auto_cfg = false)]
#[cfg(target_pointer_width = "16")]
impl usize {
    uint_impl! {
        Self = usize,
        ActualT = u16,
        SignedT = isize,
        BITS = 16,
        BITS_MINUS_ONE = 15,
        MAX = 65535,
        rot = 4,
        rot_op       = "0xa003",
        rot_result   = "0x003a",
        fsh_op       = "0x02de",
        fshl_result  = "0x0030",
        fshr_result  = "0x302d",
        clmul_lhs    = "0x9012",
        clmul_rhs    = "0xcd34",
        clmul_result = "0x0928",
        swap_op      = "0x1234",
        swapped      = "0x3412",
        reversed     = "0x2c48",
        le_bytes = "[0x34, 0x12]",
        be_bytes = "[0x12, 0x34]",
        to_xe_bytes_doc = usize_isize_to_xe_bytes_doc!(),
        from_xe_bytes_doc = usize_isize_from_xe_bytes_doc!(),
        bound_condition = " on 16-bit targets",
    }
    midpoint_impl! { usize, u32, unsigned }
    carrying_carryless_mul_impl! { usize, u32 }
}

#[doc(auto_cfg = false)]
#[cfg(target_pointer_width = "32")]
impl usize {
    uint_impl! {
        Self = usize,
        ActualT = u32,
        SignedT = isize,
        BITS = 32,
        BITS_MINUS_ONE = 31,
        MAX = 4294967295,
        rot = 8,
        rot_op       = "0x010000b3",
        rot_result   = "0x0000b301",
        fsh_op       = "0x2fe78e45",
        fshl_result  = "0x0000b32f",
        fshr_result  = "0xb32fe78e",
        clmul_lhs    = "0x56789012",
        clmul_rhs    = "0xf52ecd34",
        clmul_result = "0x9b980928",
        swap_op      = "0x12345678",
        swapped      = "0x78563412",
        reversed     = "0x1e6a2c48",
        le_bytes = "[0x78, 0x56, 0x34, 0x12]",
        be_bytes = "[0x12, 0x34, 0x56, 0x78]",
        to_xe_bytes_doc = usize_isize_to_xe_bytes_doc!(),
        from_xe_bytes_doc = usize_isize_from_xe_bytes_doc!(),
        bound_condition = " on 32-bit targets",
    }
    midpoint_impl! { usize, u64, unsigned }
    carrying_carryless_mul_impl! { usize, u64 }
}

#[doc(auto_cfg = false)]
#[cfg(target_pointer_width = "64")]
impl usize {
    uint_impl! {
        Self = usize,
        ActualT = u64,
        SignedT = isize,
        BITS = 64,
        BITS_MINUS_ONE = 63,
        MAX = 18446744073709551615,
        rot = 12,
        rot_op       = "0x0aa00000000006e1",
        rot_result   = "0x00000000006e10aa",
        fsh_op       = "0x2fe78e45983acd98",
        fshl_result  = "0x00000000006e12fe",
        fshr_result  = "0x6e12fe78e45983ac",
        clmul_lhs    = "0x7890123456789012",
        clmul_rhs    = "0xdd358416f52ecd34",
        clmul_result = "0xa6299579b980928",
        swap_op      = "0x1234567890123456",
        swapped      = "0x5634129078563412",
        reversed     = "0x6a2c48091e6a2c48",
        le_bytes = "[0x56, 0x34, 0x12, 0x90, 0x78, 0x56, 0x34, 0x12]",
        be_bytes = "[0x12, 0x34, 0x56, 0x78, 0x90, 0x12, 0x34, 0x56]",
        to_xe_bytes_doc = usize_isize_to_xe_bytes_doc!(),
        from_xe_bytes_doc = usize_isize_from_xe_bytes_doc!(),
        bound_condition = " on 64-bit targets",
    }
    midpoint_impl! { usize, u128, unsigned }
    carrying_carryless_mul_impl! { usize, u128 }
}

impl usize {
    /// Returns an `usize` where every byte is equal to `x`.
    #[inline]
    pub(crate) const fn repeat_u8(x: u8) -> usize {
        usize::from_ne_bytes([x; size_of::<usize>()])
    }

    /// Returns an `usize` where every byte pair is equal to `x`.
    #[inline]
    pub(crate) const fn repeat_u16(x: u16) -> usize {
        let mut r = 0usize;
        let mut i = 0;
        while i < size_of::<usize>() {
            // Use `wrapping_shl` to make it work on targets with 16-bit `usize`
            r = r.wrapping_shl(16) | (x as usize);
            i += 2;
        }
        r
    }
}

/// 浮点数的分类。
///
/// This `enum` is used as the return type for [`f32::classify`] and [`f64::classify`]. See
/// 它们的文档。
///
/// # 示例
///
/// ```
/// use std::num::FpCategory;
///
/// let num = 12.4_f32;
/// let inf = f32::INFINITY;
/// let zero = 0f32;
/// let sub: f32 = 1.1754942e-38;
/// let nan = f32::NAN;
///
/// assert_eq!(num.classify(), FpCategory::Normal);
/// assert_eq!(inf.classify(), FpCategory::Infinite);
/// assert_eq!(zero.classify(), FpCategory::Zero);
/// assert_eq!(sub.classify(), FpCategory::Subnormal);
/// assert_eq!(nan.classify(), FpCategory::Nan);
/// ```
#[derive(Copy, Clone, PartialEq, Eq, Debug)]
#[stable(feature = "rust1", since = "1.0.0")]
pub enum FpCategory {
    /// NaN (not a number): this value results from calculations like `(-1.0).sqrt()`.
    ///
    /// See [the documentation for `f32`](f32) for more information on the unusual properties
    /// 更多信息请参见。
    #[stable(feature = "rust1", since = "1.0.0")]
    Nan,

    /// 正或负无穷大，通常是由于非零数除以零产生的。
    /// 正或负零。
    #[stable(feature = "rust1", since = "1.0.0")]
    Infinite,

    /// Positive or negative zero.
    ///
    /// See [the documentation for `f32`](f32) for more information on the signedness of zeroes.
    #[stable(feature = "rust1", since = "1.0.0")]
    Zero,

    /// 其大小而言，精度较低）。
    /// their magnitude, than [`Normal`]).
    ///
    /// Subnormal numbers are larger in magnitude than [`Zero`] but smaller in magnitude than all
    /// [`Normal`] numbers.
    ///
    /// [`Normal`]: Self::Normal
    /// [`Zero`]: Self::Zero
    #[stable(feature = "rust1", since = "1.0.0")]
    Subnormal,

    /// 一个普通的浮点数，不属于任何特殊类别。
    ///
    /// The smallest positive normal numbers are [`f32::MIN_POSITIVE`] and [`f64::MIN_POSITIVE`],
    /// and the largest positive normal numbers are [`f32::MAX`] and [`f64::MAX`]. (Unlike signed
    /// 整数不同，浮点数的范围是对称的，因此这些常数的负值会生成其负对应值。）
    /// 确定长度为该基数的文本字符串是否可以确保被存储在给定类型 T 中。
    #[stable(feature = "rust1", since = "1.0.0")]
    Normal,
}

/// 请注意，如果编译器已知基数，只需检查 digits.len 即可。
/// stored in the given type T.
/// Note that if the radix is known to the compiler, it is just the check of digits.len that
/// 在运行时执行。
#[doc(hidden)]
#[inline(always)]
#[unstable(issue = "none", feature = "std_internals")]
pub const fn can_not_overflow<T>(radix: u32, is_signed_ty: bool, digits: &[u8]) -> bool {
    // Assume that `digits` represents a whole number N in base `radix`.
    // Then in infinite precision arithmetic (on whole numbers), we have:
    //
    // |N| <= pow(radix, digits.len()) - 1
    //     <= pow(16, 2 * size_of::<T>() - is_signed) - 1
    //     == pow(2, 8 * size_of::<T>() - 4 * is_signed) - 1
    //     <= pow(2, 8 * size_of::<T>() - is_signed) - 1
    //     == T::MAX
    //
    // Therefore this condition is sufficient for having no overflow.
    radix <= 16 && digits.len() <= size_of::<T>() * 2 - is_signed_ty as usize
}

#[cfg_attr(not(panic = "immediate-abort"), inline(never))]
#[cfg_attr(panic = "immediate-abort", inline)]
#[cold]
#[track_caller]
const fn from_ascii_bytes_radix_panic(radix: u32) -> ! {
    const_panic!(
        "from_ascii_bytes_radix: radix must lie in the range `[2, 36]`",
        "from_ascii_bytes_radix: radix must lie in the range `[2, 36]` - found {radix}",
        radix: u32 = radix,
    )
}

macro_rules! from_str_int_impl {
    ($signedness:ident $($int_ty:ty)+) => {$(
        #[stable(feature = "rust1", since = "1.0.0")]
        #[rustc_const_unstable(feature = "const_convert", issue = "143773")]
        const impl FromStr for $int_ty {
            type Err = ParseIntError;

            /// 从包含小数位的字符串切片中解析整数。
            ///
            /// 字符应为可选的
            #[doc = sign_dependent_expr!{
                $signedness ?
                if signed {
                    " `+` or `-` "
                }
                if unsigned {
                    " `+` "
                }
            }]
            /// 符号后仅跟数字。开头和结尾的非数字字符（包括
            /// 空白字符表示错误。下划线（在 Rust 字面量中被接受）
            /// 同样表示错误。
            ///
            /// # 参见
            /// 对于其他进制下的数字解析，如二进制或十六进制，
            /// see [`from_str_radix`][Self::from_str_radix].
            ///
            /// # 示例
            ///
            /// ```
            /// use std::str::FromStr;
            ///
            #[doc = concat!("assert_eq!(", stringify!($int_ty), "::from_str(\"+10\"), Ok(10));")]
            /// ```
            /// 结尾空格返回错误：
            /// ```
            /// # use std::str::FromStr;
            /// #
            #[doc = concat!("assert!(", stringify!($int_ty), "::from_str(\"1 \").is_err());")]
            /// ```
            #[inline]
            fn from_str(src: &str) -> Result<$int_ty, ParseIntError> {
                <$int_ty>::from_str_radix(src, 10)
            }
        }

        impl $int_ty {
            /// 从包含特定进制小数的字符串切片中解析整数。
            ///
            /// 字符串应为可选的
            #[doc = sign_dependent_expr!{
                $signedness ?
                if signed {
                    " `+` or `-` "
                }
                if unsigned {
                    " `+` "
                }
            }]
            /// 符号后仅跟数字。开头和结尾的非数字字符（包括
            /// 空白字符表示错误。下划线（在 Rust 字面量中被接受）
            /// 同样表示错误。
            ///
            /// Digits are a subset of these characters, depending on `radix`:
            /// * `0-9`
            /// * `a-z`
            /// * `A-Z`
            ///
            /// # 恐慌
            ///
            /// This function panics if `radix` is not in the range from 2 to 36.
            ///
            /// # 参见
            /// 如果待解析的字符串是十进制，
            /// [`from_str`] or [`str::parse`] can also be used.
            ///
            // FIXME(#122566): These HTML links work around a rustdoc-json test failure.
            /// [`from_str`]: #method.from_str
            /// [`str::parse`]: primitive.str.html#method.parse
            ///
            /// # 示例
            ///
            /// ```
            #[doc = concat!("assert_eq!(", stringify!($int_ty), "::from_str_radix(\"A\", 16), Ok(10));")]
            /// ```
            /// 结尾空格返回错误：
            /// ```
            #[doc = concat!("assert!(", stringify!($int_ty), "::from_str_radix(\"1 \", 10).is_err());")]
            /// ```
            #[stable(feature = "rust1", since = "1.0.0")]
            #[rustc_const_stable(feature = "const_int_from_str", since = "1.82.0")]
            #[inline]
            pub const fn from_str_radix(src: &str, radix: u32) -> Result<$int_ty, ParseIntError> {
                <$int_ty>::from_ascii_bytes_radix_impl(src.as_bytes(), radix)
            }

            /// 从包含小数位的 ASCII 字节切片中解析整数。
            ///
            /// 字符应为可选的
            #[doc = sign_dependent_expr!{
                $signedness ?
                if signed {
                    " `+` or `-` "
                }
                if unsigned {
                    " `+` "
                }
            }]
            /// 符号后仅跟数字。开头和结尾的非数字字符（包括
            /// 空白字符表示错误。下划线（在 Rust 字面量中被接受）
            /// 同样表示错误。
            ///
            /// # 示例
            ///
            /// ```
            #[doc = concat!("assert_eq!(", stringify!($int_ty), "::from_ascii_bytes(b\"+10\"), Ok(10));")]
            /// ```
            /// 结尾空格返回错误：
            /// ```
            #[doc = concat!("assert!(", stringify!($int_ty), "::from_ascii_bytes(b\"1 \").is_err());")]
            /// ```
            #[stable(feature = "int_from_ascii", since = "CURRENT_RUSTC_VERSION")]
            #[rustc_const_unstable(feature = "const_convert", issue = "143773")]
            #[inline]
            pub const fn from_ascii_bytes<T>(src: T) -> Result<$int_ty, ParseIntError>
            where
                T: [const] AsRef<[u8]> + [const] crate::marker::Destruct
            {
                <$int_ty>::from_ascii_bytes_radix(src.as_ref(), 10)
            }

            /// 从包含特定进制小数的 ASCII 字节切片中解析整数。
            ///
            /// 字符应为可选的
            #[doc = sign_dependent_expr!{
                $signedness ?
                if signed {
                    " `+` or `-` "
                }
                if unsigned {
                    " `+` "
                }
            }]
            /// 符号后仅跟数字。开头和结尾的非数字字符（包括
            /// 空白字符表示错误。下划线（在 Rust 字面量中被接受）
            /// 同样表示错误。
            ///
            /// Digits are a subset of these characters, depending on `radix`:
            /// * `0-9`
            /// * `a-z`
            /// * `A-Z`
            ///
            /// # 恐慌
            ///
            /// This function panics if `radix` is not in the range from 2 to 36.
            ///
            /// # 示例
            ///
            /// ```
            #[doc = concat!("assert_eq!(", stringify!($int_ty), "::from_ascii_bytes_radix(b\"A\", 16), Ok(10));")]
            /// ```
            /// 结尾空格返回错误：
            /// ```
            #[doc = concat!("assert!(", stringify!($int_ty), "::from_ascii_bytes_radix(b\"1 \", 10).is_err());")]
            /// ```
            #[stable(feature = "int_from_ascii", since = "CURRENT_RUSTC_VERSION")]
            #[rustc_const_unstable(feature = "const_convert", issue = "143773")]
            #[inline]
            pub const fn from_ascii_bytes_radix<T>(src: T, radix: u32) -> Result<$int_ty, ParseIntError>
            where
                T: [const] AsRef<[u8]> + [const] crate::marker::Destruct
            {
                <$int_ty>::from_ascii_bytes_radix_impl(src.as_ref(), radix)
            }

            #[inline]
            pub(super) const fn from_ascii_bytes_radix_impl(src: &[u8], radix: u32) -> Result<$int_ty, ParseIntError> {
                use self::IntErrorKind::*;
                use self::ParseIntError as PIE;

                if 2 > radix || radix > 36 {
                    from_ascii_bytes_radix_panic(radix);
                }

                if src.is_empty() {
                    return Err(PIE { kind: Empty });
                }

                #[allow(unused_comparisons)]
                let is_signed_ty = 0 > <$int_ty>::MIN;

                let (is_positive, mut digits) = match src {
                    [b'+' | b'-'] => {
                        return Err(PIE { kind: InvalidDigit });
                    }
                    [b'+', rest @ ..] => (true, rest),
                    [b'-', rest @ ..] if is_signed_ty => (false, rest),
                    _ => (true, src),
                };

                let mut result = 0;

                macro_rules! unwrap_or_PIE {
                    ($option:expr, $kind:ident) => {
                        match $option {
                            Some(value) => value,
                            None => return Err(PIE { kind: $kind }),
                        }
                    };
                }

                if can_not_overflow::<$int_ty>(radix, is_signed_ty, digits) {
                    // If the len of the str is short compared to the range of the type
                    // we are parsing into, then we can be certain that an overflow will not occur.
                    // This bound is when `radix.pow(digits.len()) - 1 <= T::MAX` but the condition
                    // above is a faster (conservative) approximation of this.
                    //
                    // Consider radix 16 as it has the highest information density per digit and will thus overflow the earliest:
                    // `u8::MAX` is `ff` - any str of len 2 is guaranteed to not overflow.
                    // `i8::MAX` is `7f` - only a str of len 1 is guaranteed to not overflow.
                    //
                    // NOTE: We could use unchecked arithmetic here, but we don't, based on the observation
                    // that it produces the same assembly as wrapping ones. See #163099.
                    macro_rules! run_no_check_loop {
                        ($additive_op:ident) => {{
                            while let [c, rest @ ..] = digits {
                                result = <$int_ty>::wrapping_mul(result, radix as _);
                                let x = unwrap_or_PIE!((*c as char).to_digit(radix), InvalidDigit);
                                result = result.$additive_op(x as $int_ty);
                                digits = rest;
                            }
                        }};
                    }
                    if is_positive {
                        run_no_check_loop!(wrapping_add)
                    } else {
                        run_no_check_loop!(wrapping_sub)
                    };
                } else {
                    macro_rules! run_checked_loop {
                        ($checked_additive_op:ident, $overflow_err:ident) => {{
                            while let [c, rest @ ..] = digits {
                                // When `radix` is passed in as a literal, rather than doing a slow `imul`
                                // the compiler can use shifts if `radix` can be expressed as a
                                // sum of powers of 2 (x*10 can be written as x*8 + x*2).
                                // When the compiler can't use these optimisations,
                                // the latency of the multiplication can be hidden by issuing it
                                // before the result is needed to improve performance on
                                // modern out-of-order CPU as multiplication here is slower
                                // than the other instructions, we can get the end result faster
                                // doing multiplication first and let the CPU spends other cycles
                                // doing other computation and get multiplication result later.
                                let mul = result.checked_mul(radix as $int_ty);
                                let x = unwrap_or_PIE!((*c as char).to_digit(radix), InvalidDigit) as $int_ty;
                                result = unwrap_or_PIE!(mul, $overflow_err);
                                result = unwrap_or_PIE!(<$int_ty>::$checked_additive_op(result, x), $overflow_err);
                                digits = rest;
                            }
                        }};
                    }
                    if is_positive {
                        run_checked_loop!(checked_add, PosOverflow)
                    } else {
                        run_checked_loop!(checked_sub, NegOverflow)
                    };
                }
                Ok(result)
            }
        }
    )*}
}

from_str_int_impl! { signed isize i8 i16 i32 i64 i128 }
from_str_int_impl! { unsigned usize u8 u16 u32 u64 u128 }
