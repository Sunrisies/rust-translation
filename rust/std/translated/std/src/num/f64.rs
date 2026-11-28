//! Constants for the `f64` double-precision floating point type.
//!
//! *[See also the `f64` primitive type](primitive@f64).*
//!
//! Mathematically significant numbers are provided in the `consts` sub-module.
//!
//! 对于直接定义在此模块中的常量
//! (as distinct from those defined in the `consts` sub-module),
//! new code should instead use the associated constants
//! defined directly on the `f64` type.

#![stable(feature = "rust1", since = "1.0.0")]

#[stable(feature = "rust1", since = "1.0.0")]
#[allow(deprecated, clippy::legacy_numeric_constants)]
pub use core::f64::{
    DIGITS, EPSILON, INFINITY, MANTISSA_DIGITS, MAX, MAX_10_EXP, MAX_EXP, MIN, MIN_10_EXP, MIN_EXP,
    MIN_POSITIVE, NAN, NEG_INFINITY, RADIX, consts,
};

#[cfg(not(test))]
use crate::intrinsics;
#[cfg(not(test))]
use crate::sys::cmath;

#[cfg(not(test))]
impl f64 {
    /// Returns the largest integer that is less than or equal to `self`.
    ///
    /// 此函数始终返回精确结果。
    ///
    /// # 示例
    ///
    /// ```
    /// let f = 3.7_f64;
    /// let g = 3.0_f64;
    /// let h = -3.7_f64;
    ///
    /// assert_eq!(f.floor(), 3.0);
    /// assert_eq!(g.floor(), 3.0);
    /// assert_eq!(h.floor(), -4.0);
    /// ```
    #[rustc_allow_incoherent_impl]
    #[must_use = "method returns a new number and does not mutate the original value"]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_float_round_methods", since = "1.90.0")]
    #[inline]
    pub const fn floor(self) -> f64 {
        core::f64::math::floor(self)
    }

    /// Returns the smallest integer that is greater than or equal to `self`.
    ///
    /// 此函数始终返回精确结果。
    ///
    /// # 示例
    ///
    /// ```
    /// let f = 3.01_f64;
    /// let g = 4.0_f64;
    /// let h = -3.01_f64;
    ///
    /// assert_eq!(f.ceil(), 4.0);
    /// assert_eq!(g.ceil(), 4.0);
    /// assert_eq!(h.ceil(), -3.0);
    /// ```
    #[doc(alias = "ceiling")]
    #[rustc_allow_incoherent_impl]
    #[must_use = "method returns a new number and does not mutate the original value"]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_float_round_methods", since = "1.90.0")]
    #[inline]
    pub const fn ceil(self) -> f64 {
        core::f64::math::ceil(self)
    }

    /// Returns the nearest integer to `self`. If a value is half-way between two
    /// integers, round away from `0.0`.
    ///
    /// 此函数始终返回精确结果。
    ///
    /// On most hardware platforms, [`round_ties_even`](Self::round_ties_even) may execute faster
    /// than `round`. If both rounding methods fit the use case, consider using `round_ties_even`.
    /// 注意，这两种方法对恰好位于两个整数之间的值应用不同的舍入规则。
    /// # 示例
    ///
    /// # 返回最接近某个数的整数。位于中间位置的舍入情况则向该数取整。
    ///
    /// ```
    /// let f = 3.3_f64;
    /// let g = -3.3_f64;
    /// let h = -3.7_f64;
    /// let i = 3.5_f64;
    /// let j = 4.5_f64;
    ///
    /// assert_eq!(f.round(), 3.0);
    /// assert_eq!(g.round(), -3.0);
    /// assert_eq!(h.round(), -4.0);
    /// assert_eq!(i.round(), 4.0);
    /// assert_eq!(j.round(), 5.0);
    /// ```
    #[rustc_allow_incoherent_impl]
    #[must_use = "method returns a new number and does not mutate the original value"]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_float_round_methods", since = "1.90.0")]
    #[inline]
    pub const fn round(self) -> f64 {
        core::f64::math::round(self)
    }

    /// 具有偶数最低有效位的数字。
    /// 此函数始终返回精确结果。
    ///
    /// # 示例
    ///
    /// # Examples
    ///
    /// ```
    /// let f = 3.3_f64;
    /// let g = -3.3_f64;
    /// let h = 3.5_f64;
    /// let i = 4.5_f64;
    ///
    /// assert_eq!(f.round_ties_even(), 3.0);
    /// assert_eq!(g.round_ties_even(), -3.0);
    /// assert_eq!(h.round_ties_even(), 4.0);
    /// assert_eq!(i.round_ties_even(), 4.0);
    /// ```
    #[rustc_allow_incoherent_impl]
    #[must_use = "method returns a new number and does not mutate the original value"]
    #[stable(feature = "round_ties_even", since = "1.77.0")]
    #[rustc_const_stable(feature = "const_float_round_methods", since = "1.90.0")]
    #[inline]
    pub const fn round_ties_even(self) -> f64 {
        core::f64::math::round_ties_even(self)
    }

    /// Returns the integer part of `self`.
    /// 此函数始终返回精确结果。
    ///
    /// 此函数始终返回精确结果。
    ///
    /// # 示例
    ///
    /// ```
    /// let f = 3.7_f64;
    /// let g = 3.0_f64;
    /// let h = -3.7_f64;
    ///
    /// assert_eq!(f.trunc(), 3.0);
    /// assert_eq!(g.trunc(), 3.0);
    /// assert_eq!(h.trunc(), -3.0);
    /// ```
    #[doc(alias = "truncate")]
    #[rustc_allow_incoherent_impl]
    #[must_use = "method returns a new number and does not mutate the original value"]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_float_round_methods", since = "1.90.0")]
    #[inline]
    pub const fn trunc(self) -> f64 {
        core::f64::math::trunc(self)
    }

    /// Returns the fractional part of `self`.
    ///
    /// 此函数始终返回精确结果。
    ///
    /// # 示例
    ///
    /// ```
    /// let x = 3.6_f64;
    /// let y = -3.6_f64;
    /// let abs_difference_x = (x.fract() - 0.6).abs();
    /// let abs_difference_y = (y.fract() - (-0.6)).abs();
    ///
    /// assert!(abs_difference_x < 1e-10);
    /// assert!(abs_difference_y < 1e-10);
    /// ```
    #[rustc_allow_incoherent_impl]
    #[must_use = "method returns a new number and does not mutate the original value"]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_float_round_methods", since = "1.90.0")]
    #[inline]
    pub const fn fract(self) -> f64 {
        core::f64::math::fract(self)
    }

    /// Fused multiply-add. Computes `(self * a) + b` with only one rounding
    /// 错误，比未融合的乘加运算产生更精确的结果。
    ///
    /// Using `mul_add` *may* be more performant than an unfused multiply-add if
    /// the target architecture has a dedicated `fma` CPU instruction. However,
    /// # 精度
    /// 此操作的结果保证为舍入后的结果。
    ///
    /// # Precision
    ///
    /// The result of this operation is guaranteed to be the rounded
    /// infinite-precision result. It is specified by IEEE 754 as
    /// `fusedMultiplyAdd` and guaranteed not to change.
    ///
    /// # Examples
    ///
    /// ```
    /// let m = 10.0_f64;
    /// let x = 4.0_f64;
    /// let b = 60.0_f64;
    ///
    /// assert_eq!(m.mul_add(x, b), 100.0);
    /// assert_eq!(m * x + b, 100.0);
    ///
    /// let one_plus_eps = 1.0_f64 + f64::EPSILON;
    /// let one_minus_eps = 1.0_f64 - f64::EPSILON;
    /// let minus_one = -1.0_f64;
    ///
    /// // The exact result (1 + eps) * (1 - eps) = 1 - eps * eps.
    /// assert_eq!(one_plus_eps.mul_add(one_minus_eps, minus_one), -f64::EPSILON * f64::EPSILON);
    /// // Different rounding with the non-fused multiply and add.
    /// assert_eq!(one_plus_eps * one_minus_eps + minus_one, 0.0);
    /// ```
    #[rustc_allow_incoherent_impl]
    #[doc(alias = "fma", alias = "fusedMultiplyAdd")]
    #[must_use = "method returns a new number and does not mutate the original value"]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    #[rustc_const_stable(feature = "const_mul_add", since = "1.94.0")]
    pub const fn mul_add(self, a: f64, b: f64) -> f64 {
        core::f64::math::mul_add(self, a, b)
    }

    /// Calculates Euclidean division, the matching method for `rem_euclid`.
    ///
    /// This computes the integer `n` such that
    /// `self = n * rhs + self.rem_euclid(rhs)`.
    /// In other words, the result is `self / rhs` rounded to the integer `n`
    /// such that `self >= n * rhs`.
    ///
    /// # 精度
    ///
    /// 此操作的结果保证为四舍五入后的结果。
    /// 无限精度结果。
    ///
    /// # 示例
    ///
    /// ```
    /// let a: f64 = 7.0;
    /// let b = 4.0;
    /// assert_eq!(a.div_euclid(b), 1.0); // 7.0 > 4.0 * 1.0
    /// assert_eq!((-a).div_euclid(b), -2.0); // -7.0 >= 4.0 * -2.0
    /// assert_eq!(a.div_euclid(-b), -1.0); // 7.0 >= -4.0 * -1.0
    /// assert_eq!((-a).div_euclid(-b), 2.0); // -7.0 >= -4.0 * 2.0
    /// ```
    #[rustc_allow_incoherent_impl]
    #[must_use = "method returns a new number and does not mutate the original value"]
    #[inline]
    #[stable(feature = "euclidean_division", since = "1.38.0")]
    pub fn div_euclid(self, rhs: f64) -> f64 {
        core::f64::math::div_euclid(self, rhs)
    }

    /// Calculates the least nonnegative remainder of `self` when divided by
    /// `rhs`.
    ///
    /// In particular, the return value `r` satisfies `0.0 <= r < rhs.abs()` in
    /// most cases. However, due to a floating point round-off error it can
    /// result in `r == rhs.abs()`, violating the mathematical definition, if
    /// `self` is much smaller than `rhs.abs()` in magnitude and `self < 0.0`.
    /// This result is not an element of the function's codomain, but it is the
    /// 性质。
    /// property `self == self.div_euclid(rhs) * rhs + self.rem_euclid(rhs)`
    /// 近似地。
    ///
    /// # 精度
    ///
    /// 此操作的结果保证为四舍五入后的结果。
    /// 无限精度结果。
    ///
    /// # 示例
    ///
    /// ```
    /// let a: f64 = 7.0;
    /// let b = 4.0;
    /// assert_eq!(a.rem_euclid(b), 3.0);
    /// assert_eq!((-a).rem_euclid(b), 1.0);
    /// assert_eq!(a.rem_euclid(-b), 3.0);
    /// assert_eq!((-a).rem_euclid(-b), 1.0);
    /// // limitation due to round-off error
    /// assert!((-f64::EPSILON).rem_euclid(3.0) != 0.0);
    /// ```
    #[doc(alias = "modulo", alias = "mod")]
    #[rustc_allow_incoherent_impl]
    #[must_use = "method returns a new number and does not mutate the original value"]
    #[inline]
    #[stable(feature = "euclidean_division", since = "1.38.0")]
    pub fn rem_euclid(self, rhs: f64) -> f64 {
        core::f64::math::rem_euclid(self, rhs)
    }

    /// 将一个数提升为整数幂。
    ///
    /// Using this function is generally faster than using `powf`.
    /// It might have a different sequence of rounding operations than `powf`,
    /// so the results are not guaranteed to agree.
    ///
    /// NaN，则结果非确定性地要么是 NaN，要么是相应的静默 NaN 产生的结果。
    /// example, `f64::powi(f64::NAN, 0)` returns `1.0`. However, if an input is a *signaling*
    /// 此函数的精度是非确定性的。这意味着它因平台、Rust 版本而异，
    /// 甚至在同一执行中，从一次调用到下一次调用也可能不同。
    ///
    /// # 示例
    ///
    /// 将一个数提升为浮点幂。
    /// can even differ within the same execution from one invocation to the next.
    ///
    /// # NaN，则结果非确定性地要么是 NaN，要么是相应的静默 NaN 产生的结果。
    ///
    /// ```
    /// let x = 2.0_f64;
    /// let abs_difference = (x.powi(2) - (x * x)).abs();
    /// assert!(abs_difference <= 1e-14);
    ///
    /// assert_eq!(f64::powi(f64::NAN, 0), 1.0);
    /// assert_eq!(f64::powi(0.0, 0), 1.0);
    /// ```
    #[rustc_allow_incoherent_impl]
    #[must_use = "method returns a new number and does not mutate the original value"]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    pub fn powi(self, n: i32) -> f64 {
        core::f64::math::powi(self, n)
    }

    /// # 未指定精度
    ///
    /// 此函数的精度是非确定性的。这意味着它因平台、Rust 版本而异，
    /// example, `f64::powf(f64::NAN, 0.0)` returns `1.0`. However, if an input is a *signaling*
    /// # 示例
    /// 将一个数提升为浮点幂。
    ///
    /// # 未指定精度
    ///
    /// 此函数的精度是非确定性的。这意味着它因平台、Rust 版本而异，
    /// 甚至在同一执行中，从一次调用到下一次调用也可能不同。
    ///
    /// # 示例
    ///
    /// ```
    /// let x = 2.0_f64;
    /// let abs_difference = (x.powf(2.0) - (x * x)).abs();
    /// assert!(abs_difference <= 1e-14);
    ///
    /// assert_eq!(f64::powf(1.0, f64::NAN), 1.0);
    /// assert_eq!(f64::powf(f64::NAN, 0.0), 1.0);
    /// assert_eq!(f64::powf(0.0, 0.0), 1.0);
    /// ```
    #[rustc_allow_incoherent_impl]
    #[must_use = "method returns a new number and does not mutate the original value"]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    pub fn powf(self, n: f64) -> f64 {
        intrinsics::powf(self, n)
    }

    /// 返回一个数的平方根。
    ///
    /// Returns NaN if `self` is a negative number other than `-0.0`.
    ///
    /// # 精度
    ///
    /// 此操作的结果保证为四舍五入后的结果。
    /// infinite-precision result. It is specified by IEEE 754 as `squareRoot`
    /// 并且保证不会发生变化。
    ///
    /// # 示例
    ///
    /// ```
    /// let positive = 4.0_f64;
    /// let negative = -4.0_f64;
    /// let negative_zero = -0.0_f64;
    ///
    /// assert_eq!(positive.sqrt(), 2.0);
    /// assert!(negative.sqrt().is_nan());
    /// assert!(negative_zero.sqrt() == negative_zero);
    /// ```
    #[doc(alias = "squareRoot")]
    #[rustc_allow_incoherent_impl]
    #[must_use = "method returns a new number and does not mutate the original value"]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    pub fn sqrt(self) -> f64 {
        core::f64::math::sqrt(self)
    }

    /// Returns `e^(self)`, (the exponential function).
    ///
    /// # 精度未指定
    ///
    /// 此函数的精度是非确定性的。这意味着它因平台、Rust 版本以及
    /// 甚至在同一执行中，从一次调用到下一次调用也可能有所不同。
    ///
    /// # 示例
    ///
    /// ```
    /// let one = 1.0_f64;
    /// // e^1
    /// let e = one.exp();
    ///
    /// // ln(e) - 1 == 0
    /// let abs_difference = (e.ln() - 1.0).abs();
    ///
    /// assert!(abs_difference < 1e-10);
    /// ```
    #[rustc_allow_incoherent_impl]
    #[must_use = "method returns a new number and does not mutate the original value"]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    pub fn exp(self) -> f64 {
        intrinsics::exp(self)
    }

    /// Returns `2^(self)`.
    ///
    /// # 精度未指定
    ///
    /// 此函数的精度是非确定性的。这意味着它因平台、Rust 版本以及
    /// 甚至在同一执行中，从一次调用到下一次调用也可能有所不同。
    ///
    /// # 示例
    ///
    /// ```
    /// let f = 2.0_f64;
    ///
    /// // 2^2 - 4 == 0
    /// let abs_difference = (f.exp2() - 4.0).abs();
    ///
    /// assert!(abs_difference < 1e-10);
    /// ```
    #[rustc_allow_incoherent_impl]
    #[must_use = "method returns a new number and does not mutate the original value"]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    pub fn exp2(self) -> f64 {
        intrinsics::exp2(self)
    }

    /// 返回该数的自然对数。
    ///
    /// 当数为负时，返回 NaN；当数为零时，返回负无穷大。
    ///
    /// # 精度未指定
    ///
    /// 此函数的精度是非确定性的。这意味着它因平台、Rust 版本以及
    /// 甚至在同一执行中，从一次调用到下一次调用也可能有所不同。
    ///
    /// # 示例
    ///
    /// ```
    /// let one = 1.0_f64;
    /// // e^1
    /// let e = one.exp();
    ///
    /// // ln(e) - 1 == 0
    /// let abs_difference = (e.ln() - 1.0).abs();
    ///
    /// assert!(abs_difference < 1e-10);
    /// ```
    ///
    /// 非正数值：
    /// ```
    /// assert_eq!(0_f64.ln(), f64::NEG_INFINITY);
    /// assert!((-42_f64).ln().is_nan());
    /// ```
    #[rustc_allow_incoherent_impl]
    #[must_use = "method returns a new number and does not mutate the original value"]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    pub fn ln(self) -> f64 {
        intrinsics::log(self)
    }

    /// 返回该数以任意为底的对数。
    ///
    /// 当数为负时，返回 NaN；当数为零时，返回负无穷大。
    ///
    /// 由于实现细节的原因，结果可能无法正确四舍五入；
    /// `self.log2()` can produce more accurate results for base 2, and
    /// `self.log10()` can produce more accurate results for base 10.
    ///
    /// # 精度未指定
    ///
    /// 此函数的精度是非确定性的。这意味着它因平台、Rust 版本以及
    /// 甚至在同一执行中，从一次调用到下一次调用也可能有所不同。
    ///
    /// # 示例
    ///
    /// ```
    /// let twenty_five = 25.0_f64;
    ///
    /// // log5(25) - 2 == 0
    /// let abs_difference = (twenty_five.log(5.0) - 2.0).abs();
    ///
    /// assert!(abs_difference < 1e-10);
    /// ```
    ///
    /// 非正数值：
    /// ```
    /// assert_eq!(0_f64.log(10.0), f64::NEG_INFINITY);
    /// assert!((-42_f64).log(10.0).is_nan());
    /// ```
    #[rustc_allow_incoherent_impl]
    #[must_use = "method returns a new number and does not mutate the original value"]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    pub fn log(self, base: f64) -> f64 {
        self.ln() / base.ln()
    }

    /// 返回该数以 2 为底的对数。
    ///
    /// 当数为负时，返回 NaN；当数为零时，返回负无穷大。
    ///
    /// # 精度未指定
    ///
    /// 此函数的精度是非确定性的。这意味着它因平台、Rust 版本以及
    /// 甚至在同一执行中，从一次调用到下一次调用也可能有所不同。
    ///
    /// # 示例
    ///
    /// ```
    /// let four = 4.0_f64;
    ///
    /// // log2(4) - 2 == 0
    /// let abs_difference = (four.log2() - 2.0).abs();
    ///
    /// assert!(abs_difference < 1e-10);
    /// ```
    ///
    /// 非正数值：
    /// ```
    /// assert_eq!(0_f64.log2(), f64::NEG_INFINITY);
    /// assert!((-42_f64).log2().is_nan());
    /// ```
    #[rustc_allow_incoherent_impl]
    #[must_use = "method returns a new number and does not mutate the original value"]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    pub fn log2(self) -> f64 {
        intrinsics::log2(self)
    }

    /// 返回该数以 10 为底的对数。
    ///
    /// 当数为负时，返回 NaN；当数为零时，返回负无穷大。
    ///
    /// # 精度未指定
    ///
    /// 此函数的精度是非确定性的。这意味着它因平台、Rust 版本以及
    /// 甚至在同一执行中，从一次调用到下一次调用也可能有所不同。
    ///
    /// # 示例
    ///
    /// ```
    /// let hundred = 100.0_f64;
    ///
    /// // log10(100) - 2 == 0
    /// let abs_difference = (hundred.log10() - 2.0).abs();
    ///
    /// assert!(abs_difference < 1e-10);
    /// ```
    ///
    /// 非正数值：
    /// ```
    /// assert_eq!(0_f64.log10(), f64::NEG_INFINITY);
    /// assert!((-42_f64).log10().is_nan());
    /// ```
    #[rustc_allow_incoherent_impl]
    #[must_use = "method returns a new number and does not mutate the original value"]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    pub fn log10(self) -> f64 {
        intrinsics::log10(self)
    }

    /// 两个数的正差值。
    ///
    /// * If `self <= other`: `0.0`
    /// * Else: `self - other`
    ///
    /// # 精度未指定
    ///
    /// 此函数的精度具有不确定性。这意味着其会因平台、Rust 版本以及
    /// 甚至在同一次执行中，从一次调用到下一次也会有所不同。
    /// This function currently corresponds to the `fdim` from libc on Unix and
    /// Windows 上的类似功能。请注意，未来可能会发生变化。
    ///
    /// # 示例
    ///
    /// ```
    /// let x = 3.0_f64;
    /// let y = -3.0_f64;
    ///
    /// let abs_difference_x = (x.abs_sub(1.0) - 2.0).abs();
    /// let abs_difference_y = (y.abs_sub(1.0) - 0.0).abs();
    ///
    /// assert!(abs_difference_x < 1e-10);
    /// assert!(abs_difference_y < 1e-10);
    /// ```
    #[rustc_allow_incoherent_impl]
    #[must_use = "method returns a new number and does not mutate the original value"]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    #[deprecated(
        since = "1.10.0",
        note = "you probably meant `(self - other).abs()`: \
                this operation is `(self - other).max(0.0)` \
                except that `abs_sub` also propagates NaNs (also \
                known as `fdim` in C). If you truly need the positive \
                difference, consider using that expression or the C function \
                `fdim`, depending on how you wish to handle NaN (please consider \
                filing an issue describing your use-case too)."
    )]
    pub fn abs_sub(self, other: f64) -> f64 {
        #[allow(deprecated)]
        core::f64::math::abs_sub(self, other)
    }

    /// 返回一个数的立方根。
    ///
    /// # 精度未指定
    ///
    /// 此函数的精度具有不确定性。这意味着其会因平台、Rust 版本以及
    /// 甚至在同一次执行中，从一次调用到下一次也会有所不同。
    /// This function currently corresponds to the `cbrt` from libc on Unix and
    /// Windows 上的类似功能。请注意，未来可能会发生变化。
    ///
    /// # 示例
    ///
    /// ```
    /// let x = 8.0_f64;
    ///
    /// // x^(1/3) - 2 == 0
    /// let abs_difference = (x.cbrt() - 2.0).abs();
    ///
    /// assert!(abs_difference < 1e-10);
    /// ```
    #[rustc_allow_incoherent_impl]
    #[must_use = "method returns a new number and does not mutate the original value"]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    pub fn cbrt(self) -> f64 {
        core::f64::math::cbrt(self)
    }

    /// Compute the distance between the origin and a point (`x`, `y`) on the
    /// Euclidean plane. Equivalently, compute the length of the hypotenuse of a
    /// right-angle triangle with other sides having length `x.abs()` and
    /// `y.abs()`.
    ///
    /// # 精度未指定
    ///
    /// 此函数的精度具有不确定性。这意味着其会因平台、Rust 版本以及
    /// 甚至在同一次执行中，从一次调用到下一次也会有所不同。
    /// This function currently corresponds to the `hypot` from libc on Unix
    /// Windows 上的类似功能。请注意，未来可能会发生变化。
    ///
    /// # 示例
    ///
    /// ```
    /// let x = 2.0_f64;
    /// let y = 3.0_f64;
    ///
    /// // sqrt(x^2 + y^2)
    /// let abs_difference = (x.hypot(y) - (x.powi(2) + y.powi(2)).sqrt()).abs();
    ///
    /// assert!(abs_difference < 1e-10);
    /// ```
    #[rustc_allow_incoherent_impl]
    #[must_use = "method returns a new number and does not mutate the original value"]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    pub fn hypot(self, other: f64) -> f64 {
        cmath::hypot(self, other)
    }

    /// 计算一个数的正弦值（以弧度为单位）。
    ///
    /// # 精度未指定
    ///
    /// 此函数的精度具有不确定性。这意味着其会因平台、Rust 版本以及
    /// 甚至在同一次执行中，从一次调用到下一次也会有所不同。
    ///
    /// # 示例
    ///
    /// ```
    /// let x = std::f64::consts::FRAC_PI_2;
    ///
    /// let abs_difference = (x.sin() - 1.0).abs();
    ///
    /// assert!(abs_difference < 1e-10);
    /// ```
    #[rustc_allow_incoherent_impl]
    #[must_use = "method returns a new number and does not mutate the original value"]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    pub fn sin(self) -> f64 {
        intrinsics::sin(self)
    }

    /// 计算一个数的余弦值（以弧度为单位）。
    ///
    /// # 精度未指定
    ///
    /// 此函数的精度具有不确定性。这意味着其会因平台、Rust 版本以及
    /// 甚至在同一次执行中，从一次调用到下一次也会有所不同。
    ///
    /// # 示例
    ///
    /// ```
    /// let x = 2.0 * std::f64::consts::PI;
    ///
    /// let abs_difference = (x.cos() - 1.0).abs();
    ///
    /// assert!(abs_difference < 1e-10);
    /// ```
    #[rustc_allow_incoherent_impl]
    #[must_use = "method returns a new number and does not mutate the original value"]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    pub fn cos(self) -> f64 {
        intrinsics::cos(self)
    }

    /// 计算一个数的正切值（以弧度为单位）。
    ///
    /// # 精度未指定
    ///
    /// 此函数的精度具有不确定性。这意味着其会因平台、Rust 版本以及
    /// 甚至在同一次执行中，从一次调用到下一次也会有所不同。
    /// This function currently corresponds to the `tan` from libc on Unix and
    /// Windows 上的类似功能。请注意，未来可能会发生变化。
    ///
    /// # 示例
    ///
    /// ```
    /// let x = std::f64::consts::FRAC_PI_4;
    /// let abs_difference = (x.tan() - 1.0).abs();
    ///
    /// assert!(abs_difference < 1e-14);
    /// ```
    #[rustc_allow_incoherent_impl]
    #[must_use = "method returns a new number and does not mutate the original value"]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    pub fn tan(self) -> f64 {
        cmath::tan(self)
    }

    /// 计算一个数的反正弦值。返回值以弧度为单位。
    /// 范围为 [-π/2, π/2]，如果数值超出范围则返回 NaN
    /// [-1, 1].
    ///
    /// # 精度未指定
    ///
    /// 此函数的精度具有不确定性。这意味着它会因平台、Rust 版本以及
    /// 甚至在同一次执行中，从一次调用到下一次也会有所不同。
    /// This function currently corresponds to the `asin` from libc on Unix and
    /// Windows 上的对应实现。请注意，未来可能会发生变化。
    ///
    /// # 示例
    ///
    /// ```
    /// let f = std::f64::consts::FRAC_PI_4;
    ///
    /// // asin(sin(pi/2))
    /// let abs_difference = (f.sin().asin() - f).abs();
    ///
    /// assert!(abs_difference < 1e-14);
    /// ```
    #[doc(alias = "arcsin")]
    #[rustc_allow_incoherent_impl]
    #[must_use = "method returns a new number and does not mutate the original value"]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    pub fn asin(self) -> f64 {
        cmath::asin(self)
    }

    /// 计算一个数的反余弦。返回值以弧度为单位，位于 [0, π] 范围内，如果数值超出范围则返回 NaN
    /// # 精度未指定
    /// [-1, 1].
    ///
    /// # 精度未指定
    ///
    /// 此函数的精度具有不确定性。这意味着它会因平台、Rust 版本以及
    /// 甚至在同一次执行中，从一次调用到下一次也会有所不同。
    /// This function currently corresponds to the `acos` from libc on Unix and
    /// Windows 上的对应实现。请注意，未来可能会发生变化。
    ///
    /// # 示例
    ///
    /// ```
    /// let f = std::f64::consts::FRAC_PI_4;
    ///
    /// // acos(cos(pi/4))
    /// let abs_difference = (f.cos().acos() - std::f64::consts::FRAC_PI_4).abs();
    ///
    /// assert!(abs_difference < 1e-10);
    /// ```
    #[doc(alias = "arccos")]
    #[rustc_allow_incoherent_impl]
    #[must_use = "method returns a new number and does not mutate the original value"]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    pub fn acos(self) -> f64 {
        cmath::acos(self)
    }

    /// 计算一个数的反正切值。返回值以弧度为单位，位于 [-π/2, π/2] 范围内
    /// # 精度未指定
    ///
    /// # 精度未指定
    ///
    /// 此函数的精度具有不确定性。这意味着它会因平台、Rust 版本以及
    /// 甚至在同一次执行中，从一次调用到下一次也会有所不同。
    /// This function currently corresponds to the `atan` from libc on Unix and
    /// Windows 上的对应实现。请注意，未来可能会发生变化。
    ///
    /// # 示例
    ///
    /// ```
    /// let f = 1.0_f64;
    ///
    /// // atan(tan(1))
    /// let abs_difference = (f.tan().atan() - 1.0).abs();
    ///
    /// assert!(abs_difference < 1e-10);
    /// ```
    #[doc(alias = "arctan")]
    #[rustc_allow_incoherent_impl]
    #[must_use = "method returns a new number and does not mutate the original value"]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    pub fn atan(self) -> f64 {
        cmath::atan(self)
    }

    /// Computes the four quadrant arctangent of `self` (`y`) and `other` (`x`) in radians.
    ///
    ///  | `x`     | `y`     | Piecewise Definition | Range         |
    ///  |---------|---------|----------------------|---------------|
    ///  | `>= +0` | `>= +0` | `arctan(y/x)`        | `[+0, +pi/2]` |
    ///  | `>= +0` | `<= -0` | `arctan(y/x)`        | `[-pi/2, -0]` |
    ///  | `<= -0` | `>= +0` | `arctan(y/x) + pi`   | `[+pi/2, +pi]`|
    ///  | `<= -0` | `<= -0` | `arctan(y/x) - pi`   | `[-pi, -pi/2]`|
    ///
    /// # 精度未指定
    ///
    /// 此函数的精度具有不确定性。这意味着它会因平台、Rust 版本以及
    /// 甚至在同一次执行中，从一次调用到下一次也会有所不同。
    /// This function currently corresponds to the `atan2` from libc on Unix
    /// Windows 上的对应实现。请注意，未来可能会发生变化。
    ///
    /// # 示例
    ///
    /// ```
    /// // Positive angles measured counter-clockwise
    /// // from positive x axis
    /// // -pi/4 radians (45 deg clockwise)
    /// let x1 = 3.0_f64;
    /// let y1 = -3.0_f64;
    ///
    /// // 3pi/4 radians (135 deg counter-clockwise)
    /// let x2 = -3.0_f64;
    /// let y2 = 3.0_f64;
    ///
    /// let abs_difference_1 = (y1.atan2(x1) - (-std::f64::consts::FRAC_PI_4)).abs();
    /// let abs_difference_2 = (y2.atan2(x2) - (3.0 * std::f64::consts::FRAC_PI_4)).abs();
    ///
    /// assert!(abs_difference_1 < 1e-10);
    /// assert!(abs_difference_2 < 1e-10);
    /// ```
    #[rustc_allow_incoherent_impl]
    #[must_use = "method returns a new number and does not mutate the original value"]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    pub fn atan2(self, other: f64) -> f64 {
        cmath::atan2(self, other)
    }

    /// Simultaneously computes the sine and cosine of the number, `x`. Returns
    /// `(sin(x), cos(x))`.
    ///
    /// # 精度未指定
    ///
    /// 此函数的精度具有不确定性。这意味着它会因平台、Rust 版本以及
    /// 甚至在同一次执行中，从一次调用到下一次也会有所不同。
    /// 目前，此函数对应于 `(f64::sin(x),
    /// f64::cos(x))`。请注意，未来可能会发生变化。
    ///
    /// # 示例
    ///
    /// ```
    /// let x = std::f64::consts::FRAC_PI_4;
    /// let f = x.sin_cos();
    ///
    /// let abs_difference_0 = (f.0 - x.sin()).abs();
    /// let abs_difference_1 = (f.1 - x.cos()).abs();
    ///
    /// assert!(abs_difference_0 < 1e-10);
    /// assert!(abs_difference_1 < 1e-10);
    /// ```
    #[doc(alias = "sincos")]
    #[rustc_allow_incoherent_impl]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    #[must_use = "this returns the result of the operation, without modifying the original"]
    pub fn sin_cos(self) -> (f64, f64) {
        (self.sin(), self.cos())
    }

    /// Returns `e^(self) - 1` in a way that is accurate even if the
    /// 数值接近零。
    ///
    /// # 精度未指定
    ///
    /// 此函数的精度具有不确定性。这意味着其会因平台、Rust 版本以及
    /// 甚至在同一次执行中，从一次调用到下一次也会有所不同。
    /// This function currently corresponds to the `expm1` from libc on Unix
    /// 以及 Windows 系统。请注意，未来可能会发生变化。
    ///
    /// # 示例
    ///
    /// ```
    /// let x = 1e-16_f64;
    ///
    /// // for very small x, e^x is approximately 1 + x + x^2 / 2
    /// let approx = x + x * x / 2.0;
    /// let abs_difference = (x.exp_m1() - approx).abs();
    ///
    /// assert!(abs_difference < 1e-20);
    /// ```
    #[rustc_allow_incoherent_impl]
    #[must_use = "method returns a new number and does not mutate the original value"]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    pub fn exp_m1(self) -> f64 {
        cmath::expm1(self)
    }

    /// Returns `ln(1+n)` (natural logarithm) more accurately than if
    /// 如果单独执行操作，则不会如此。
    ///
    /// This returns NaN when `n < -1.0`, and negative infinity when `n == -1.0`.
    ///
    /// # 精度未指定
    ///
    /// 此函数的精度具有不确定性。这意味着其会因平台、Rust 版本以及
    /// 甚至在同一次执行中，从一次调用到下一次也会有所不同。
    /// This function currently corresponds to the `log1p` from libc on Unix
    /// 以及 Windows 系统。请注意，未来可能会发生变化。
    ///
    /// # 示例
    ///
    /// ```
    /// let x = 1e-16_f64;
    ///
    /// // for very small x, ln(1 + x) is approximately x - x^2 / 2
    /// let approx = x - x * x / 2.0;
    /// let abs_difference = (x.ln_1p() - approx).abs();
    ///
    /// assert!(abs_difference < 1e-20);
    /// ```
    ///
    /// 超出范围的值：
    /// ```
    /// assert_eq!((-1.0_f64).ln_1p(), f64::NEG_INFINITY);
    /// assert!((-2.0_f64).ln_1p().is_nan());
    /// ```
    #[doc(alias = "log1p")]
    #[rustc_allow_incoherent_impl]
    #[must_use = "method returns a new number and does not mutate the original value"]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    pub fn ln_1p(self) -> f64 {
        cmath::log1p(self)
    }

    /// 双曲正弦函数。
    ///
    /// # 精度未指定
    ///
    /// 此函数的精度具有不确定性。这意味着其会因平台、Rust 版本以及
    /// 甚至在同一次执行中，从一次调用到下一次也会有所不同。
    /// This function currently corresponds to the `sinh` from libc on Unix
    /// 以及 Windows 系统。请注意，未来可能会发生变化。
    ///
    /// # 示例
    ///
    /// ```
    /// let e = std::f64::consts::E;
    /// let x = 1.0_f64;
    ///
    /// let f = x.sinh();
    /// // Solving sinh() at 1 gives `(e^2-1)/(2e)`
    /// let g = ((e * e) - 1.0) / (2.0 * e);
    /// let abs_difference = (f - g).abs();
    ///
    /// assert!(abs_difference < 1e-10);
    /// ```
    #[rustc_allow_incoherent_impl]
    #[must_use = "method returns a new number and does not mutate the original value"]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    pub fn sinh(self) -> f64 {
        cmath::sinh(self)
    }

    /// 双曲余弦函数。
    ///
    /// # 精度未指定
    ///
    /// 此函数的精度具有不确定性。这意味着其会因平台、Rust 版本以及
    /// 甚至在同一次执行中，从一次调用到下一次也会有所不同。
    /// This function currently corresponds to the `cosh` from libc on Unix
    /// 以及 Windows 系统。请注意，未来可能会发生变化。
    ///
    /// # 示例
    ///
    /// ```
    /// let e = std::f64::consts::E;
    /// let x = 1.0_f64;
    /// let f = x.cosh();
    /// // Solving cosh() at 1 gives this result
    /// let g = ((e * e) + 1.0) / (2.0 * e);
    /// let abs_difference = (f - g).abs();
    ///
    /// // Same result
    /// assert!(abs_difference < 1.0e-10);
    /// ```
    #[rustc_allow_incoherent_impl]
    #[must_use = "method returns a new number and does not mutate the original value"]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    pub fn cosh(self) -> f64 {
        cmath::cosh(self)
    }

    /// 双曲正切函数。
    ///
    /// # 精度未指定
    ///
    /// 此函数的精度具有不确定性。这意味着其会因平台、Rust 版本以及
    /// 甚至在同一次执行中，从一次调用到下一次也会有所不同。
    /// This function currently corresponds to the `tanh` from libc on Unix
    /// 以及 Windows 系统。请注意，未来可能会发生变化。
    ///
    /// # 示例
    ///
    /// ```
    /// let e = std::f64::consts::E;
    /// let x = 1.0_f64;
    ///
    /// let f = x.tanh();
    /// // Solving tanh() at 1 gives `(1 - e^(-2))/(1 + e^(-2))`
    /// let g = (1.0 - e.powi(-2)) / (1.0 + e.powi(-2));
    /// let abs_difference = (f - g).abs();
    ///
    /// assert!(abs_difference < 1.0e-10);
    /// ```
    #[rustc_allow_incoherent_impl]
    #[must_use = "method returns a new number and does not mutate the original value"]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    pub fn tanh(self) -> f64 {
        cmath::tanh(self)
    }

    /// 反双曲正弦函数。
    ///
    /// # 精度未指定
    ///
    /// 此函数的精度具有不确定性。这意味着其会因平台、Rust 版本以及
    /// 甚至在同一次执行中，从一次调用到下一次也会有所不同。
    ///
    /// # 示例
    ///
    /// ```
    /// let x = 1.0_f64;
    /// let f = x.sinh().asinh();
    ///
    /// let abs_difference = (f - x).abs();
    ///
    /// assert!(abs_difference < 1.0e-10);
    /// ```
    #[doc(alias = "arcsinh")]
    #[rustc_allow_incoherent_impl]
    #[must_use = "method returns a new number and does not mutate the original value"]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    pub fn asinh(self) -> f64 {
        cmath::asinh(self)
    }

    /// 反双曲余弦函数。
    ///
    /// # 未指定精度
    ///
    /// 该函数的精度具有不确定性。这意味着其会因平台、Rust 版本以及
    /// 甚至在同一次执行中，从一次调用到下一次调用也会有所不同。
    ///
    /// # 示例
    ///
    /// ```
    /// let x = 1.0_f64;
    /// let f = x.cosh().acosh();
    ///
    /// let abs_difference = (f - x).abs();
    ///
    /// assert!(abs_difference < 1.0e-10);
    /// ```
    #[doc(alias = "arccosh")]
    #[rustc_allow_incoherent_impl]
    #[must_use = "method returns a new number and does not mutate the original value"]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    pub fn acosh(self) -> f64 {
        cmath::acosh(self)
    }

    /// 反双曲正切函数。
    ///
    /// # 未指定精度
    ///
    /// 该函数的精度具有不确定性。这意味着其会因平台、Rust 版本以及
    /// 甚至在同一次执行中，从一次调用到下一次调用也会有所不同。
    ///
    /// # 示例
    ///
    /// ```
    /// let x = std::f64::consts::FRAC_PI_6;
    /// let f = x.tanh().atanh();
    ///
    /// let abs_difference = (f - x).abs();
    ///
    /// assert!(abs_difference < 1.0e-10);
    /// ```
    #[doc(alias = "arctanh")]
    #[rustc_allow_incoherent_impl]
    #[must_use = "method returns a new number and does not mutate the original value"]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    pub fn atanh(self) -> f64 {
        0.5 * ((2.0 * self) / (1.0 - self)).ln_1p()
    }

    /// 伽马函数。
    ///
    /// # 未指定精度
    ///
    /// 该函数的精度具有不确定性。这意味着其会因平台、Rust 版本以及
    /// 甚至在同一次执行中，从一次调用到下一次调用也会有所不同。
    /// This function currently corresponds to the `tgamma` from libc on Unix
    /// 以及 Windows 系统。请注意，未来可能会发生变化。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(float_gamma)]
    /// let x = 5.0f64;
    ///
    /// let abs_difference = (x.gamma() - 24.0).abs();
    ///
    /// assert!(abs_difference <= 1e-10);
    /// ```
    #[rustc_allow_incoherent_impl]
    #[must_use = "method returns a new number and does not mutate the original value"]
    #[unstable(feature = "float_gamma", issue = "99842")]
    #[inline]
    pub fn gamma(self) -> f64 {
        cmath::tgamma(self)
    }

    /// 伽马函数绝对值的自然对数。
    ///
    /// 元组中的整数部分表示伽马函数的符号。
    ///
    /// # 未指定精度
    ///
    /// 该函数的精度具有不确定性。这意味着其会因平台、Rust 版本以及
    /// 甚至在同一次执行中，从一次调用到下一次调用也会有所不同。
    /// This function currently corresponds to the `lgamma_r` from libc on Unix
    /// 以及 Windows 系统。请注意，未来可能会发生变化。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(float_gamma)]
    /// let x = 2.0f64;
    ///
    /// let abs_difference = (x.ln_gamma().0 - 0.0).abs();
    ///
    /// assert!(abs_difference <= f64::EPSILON);
    /// ```
    #[rustc_allow_incoherent_impl]
    #[must_use = "method returns a new number and does not mutate the original value"]
    #[unstable(feature = "float_gamma", issue = "99842")]
    #[inline]
    pub fn ln_gamma(self) -> (f64, i32) {
        let mut signgamp: i32 = 0;
        let x = cmath::lgamma_r(self, &mut signgamp);
        (x, signgamp)
    }

    /// 误差函数。
    ///
    /// # 未指定精度
    ///
    /// 该函数的精度具有不确定性。这意味着其会因平台、
    /// Rust 版本以及甚至在同一次调用到下一次调用也会有所不同。
    ///
    /// This function currently corresponds to the `erf` from libc on Unix
    /// 以及 Windows 系统。请注意，未来可能会发生变化。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(float_erf)]
    /// /// The error function relates what percent of a normal distribution lies
    /// /// within `x` standard deviations (scaled by `1/sqrt(2)`).
    /// fn within_standard_deviations(x: f64) -> f64 {
    ///     (x * std::f64::consts::FRAC_1_SQRT_2).erf() * 100.0
    /// }
    ///
    /// // 68% of a normal distribution is within one standard deviation
    /// assert!((within_standard_deviations(1.0) - 68.269).abs() < 0.01);
    /// // 95% of a normal distribution is within two standard deviations
    /// assert!((within_standard_deviations(2.0) - 95.450).abs() < 0.01);
    /// // 99.7% of a normal distribution is within three standard deviations
    /// assert!((within_standard_deviations(3.0) - 99.730).abs() < 0.01);
    /// ```
    #[rustc_allow_incoherent_impl]
    #[must_use = "method returns a new number and does not mutate the original value"]
    #[unstable(feature = "float_erf", issue = "136321")]
    #[inline]
    pub fn erf(self) -> f64 {
        cmath::erf(self)
    }

    /// 互补误差函数。
    ///
    /// # 未指定精度
    ///
    /// 该函数的精度具有不确定性。这意味着其会因平台、
    /// Rust 版本以及甚至在同一次调用到下一次调用也会有所不同。
    ///
    /// This function currently corresponds to the `erfc` from libc on Unix
    /// 以及 Windows 系统。请注意，未来可能会发生变化。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(float_erf)]
    /// let x: f64 = 0.123;
    ///
    /// let one = x.erf() + x.erfc();
    /// let abs_difference = (one - 1.0).abs();
    ///
    /// assert!(abs_difference <= 1e-10);
    /// ```
    #[rustc_allow_incoherent_impl]
    #[must_use = "method returns a new number and does not mutate the original value"]
    #[unstable(feature = "float_erf", issue = "136321")]
    #[inline]
    pub fn erfc(self) -> f64 {
        cmath::erfc(self)
    }
}
