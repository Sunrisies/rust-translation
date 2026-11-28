//! Constants for the `f64` double-precision floating point type.
//!
//! *[See also the `f64` primitive type][f64].*
//!
//! Mathematically significant numbers are provided in the `consts` sub-module.
//!
//! 对于直接定义在该模块中的常量
//! (as distinct from those defined in the `consts` sub-module),
//! new code should instead use the associated constants
//! defined directly on the `f64` type.

#![stable(feature = "rust1", since = "1.0.0")]
#![expect(clippy::approx_constant, reason = "this module defines f64 constants")]

use crate::convert::{FloatToFloat, FloatToInt};
use crate::num::FpCategory;
use crate::num::float_macros::float_impl;
use crate::panic::const_assert;
use crate::{intrinsics, mem};

/// The radix or base of the internal representation of `f64`.
/// Use [`f64::RADIX`] instead.
///
/// # 示例
///
/// ```rust
/// // deprecated way
/// # #[allow(deprecated)]
/// let r = std::f64::RADIX;
///
/// // intended way
/// let r = f64::RADIX;
/// ```
#[stable(feature = "rust1", since = "1.0.0")]
#[deprecated(since = "1.99.0", note = "replaced by the `RADIX` associated constant on `f64`")]
#[rustc_diagnostic_item = "f64_legacy_const_radix"]
pub const RADIX: u32 = f64::RADIX;

/// 二进制中的有效数字位数。
/// Use [`f64::MANTISSA_DIGITS`] instead.
///
/// # 示例
///
/// ```rust
/// // deprecated way
/// # #[allow(deprecated)]
/// let d = std::f64::MANTISSA_DIGITS;
///
/// // intended way
/// let d = f64::MANTISSA_DIGITS;
/// ```
#[stable(feature = "rust1", since = "1.0.0")]
#[deprecated(
    since = "1.99.0",
    note = "replaced by the `MANTISSA_DIGITS` associated constant on `f64`"
)]
#[rustc_diagnostic_item = "f64_legacy_const_mantissa_dig"]
pub const MANTISSA_DIGITS: u32 = f64::MANTISSA_DIGITS;

/// 十进制中有效数字的近似数量。
/// Use [`f64::DIGITS`] instead.
///
/// # 示例
///
/// ```rust
/// // deprecated way
/// # #[allow(deprecated)]
/// let d = std::f64::DIGITS;
///
/// // intended way
/// let d = f64::DIGITS;
/// ```
#[stable(feature = "rust1", since = "1.0.0")]
#[deprecated(since = "1.99.0", note = "replaced by the `DIGITS` associated constant on `f64`")]
#[rustc_diagnostic_item = "f64_legacy_const_digits"]
pub const DIGITS: u32 = f64::DIGITS;

/// [Machine epsilon] value for `f64`.
/// Use [`f64::EPSILON`] instead.
///
/// This is the difference between `1.0` and the next larger representable number.
///
/// [Machine epsilon]: https://en.wikipedia.org/wiki/Machine_epsilon
///
/// # 示例
///
/// ```rust
/// // deprecated way
/// # #[allow(deprecated)]
/// let e = std::f64::EPSILON;
///
/// // intended way
/// let e = f64::EPSILON;
/// ```
#[stable(feature = "rust1", since = "1.0.0")]
#[deprecated(since = "1.99.0", note = "replaced by the `EPSILON` associated constant on `f64`")]
#[rustc_diagnostic_item = "f64_legacy_const_epsilon"]
pub const EPSILON: f64 = f64::EPSILON;

/// Smallest finite `f64` value.
/// Use [`f64::MIN`] instead.
///
/// # 示例
///
/// ```rust
/// // deprecated way
/// # #[allow(deprecated)]
/// let min = std::f64::MIN;
///
/// // intended way
/// let min = f64::MIN;
/// ```
#[stable(feature = "rust1", since = "1.0.0")]
#[deprecated(since = "1.99.0", note = "replaced by the `MIN` associated constant on `f64`")]
#[rustc_diagnostic_item = "f64_legacy_const_min"]
pub const MIN: f64 = f64::MIN;

/// Smallest positive normal `f64` value.
/// Use [`f64::MIN_POSITIVE`] instead.
///
/// # 示例
///
/// ```rust
/// // deprecated way
/// # #[allow(deprecated)]
/// let min = std::f64::MIN_POSITIVE;
///
/// // intended way
/// let min = f64::MIN_POSITIVE;
/// ```
#[stable(feature = "rust1", since = "1.0.0")]
#[deprecated(
    since = "1.99.0",
    note = "replaced by the `MIN_POSITIVE` associated constant on `f64`"
)]
#[rustc_diagnostic_item = "f64_legacy_const_min_positive"]
pub const MIN_POSITIVE: f64 = f64::MIN_POSITIVE;

/// Largest finite `f64` value.
/// Use [`f64::MAX`] instead.
///
/// # 示例
///
/// ```rust
/// // deprecated way
/// # #[allow(deprecated)]
/// let max = std::f64::MAX;
///
/// // intended way
/// let max = f64::MAX;
/// ```
#[stable(feature = "rust1", since = "1.0.0")]
#[deprecated(since = "1.99.0", note = "replaced by the `MAX` associated constant on `f64`")]
#[rustc_diagnostic_item = "f64_legacy_const_max"]
pub const MAX: f64 = f64::MAX;

/// 大于最小可能的正常2指数值的下一个值。
/// Use [`f64::MIN_EXP`] instead.
///
/// # 示例
///
/// ```rust
/// // deprecated way
/// # #[allow(deprecated)]
/// let min = std::f64::MIN_EXP;
///
/// // intended way
/// let min = f64::MIN_EXP;
/// ```
#[stable(feature = "rust1", since = "1.0.0")]
#[deprecated(since = "1.99.0", note = "replaced by the `MIN_EXP` associated constant on `f64`")]
#[rustc_diagnostic_item = "f64_legacy_const_min_exp"]
pub const MIN_EXP: i32 = f64::MIN_EXP;

/// 最大的可能2指数值。
/// Use [`f64::MAX_EXP`] instead.
///
/// # 示例
///
/// ```rust
/// // deprecated way
/// # #[allow(deprecated)]
/// let max = std::f64::MAX_EXP;
///
/// // intended way
/// let max = f64::MAX_EXP;
/// ```
#[stable(feature = "rust1", since = "1.0.0")]
#[deprecated(since = "1.99.0", note = "replaced by the `MAX_EXP` associated constant on `f64`")]
#[rustc_diagnostic_item = "f64_legacy_const_max_exp"]
pub const MAX_EXP: i32 = f64::MAX_EXP;

/// 最小可能的正常10指数值。
/// Use [`f64::MIN_10_EXP`] instead.
///
/// # 示例
///
/// ```rust
/// // deprecated way
/// # #[allow(deprecated)]
/// let min = std::f64::MIN_10_EXP;
///
/// // intended way
/// let min = f64::MIN_10_EXP;
/// ```
#[stable(feature = "rust1", since = "1.0.0")]
#[deprecated(since = "1.99.0", note = "replaced by the `MIN_10_EXP` associated constant on `f64`")]
#[rustc_diagnostic_item = "f64_legacy_const_min_10_exp"]
pub const MIN_10_EXP: i32 = f64::MIN_10_EXP;

/// 最大的可能10指数值。
/// Use [`f64::MAX_10_EXP`] instead.
///
/// # 示例
///
/// ```rust
/// // deprecated way
/// # #[allow(deprecated)]
/// let max = std::f64::MAX_10_EXP;
///
/// // intended way
/// let max = f64::MAX_10_EXP;
/// ```
#[stable(feature = "rust1", since = "1.0.0")]
#[deprecated(since = "1.99.0", note = "replaced by the `MAX_10_EXP` associated constant on `f64`")]
#[rustc_diagnostic_item = "f64_legacy_const_max_10_exp"]
pub const MAX_10_EXP: i32 = f64::MAX_10_EXP;

/// 非数字 (NaN)。
/// Use [`f64::NAN`] instead.
///
/// # 示例
///
/// ```rust
/// // deprecated way
/// # #[allow(deprecated)]
/// let nan = std::f64::NAN;
///
/// // intended way
/// let nan = f64::NAN;
/// ```
#[stable(feature = "rust1", since = "1.0.0")]
#[deprecated(since = "1.99.0", note = "replaced by the `NAN` associated constant on `f64`")]
#[rustc_diagnostic_item = "f64_legacy_const_nan"]
pub const NAN: f64 = f64::NAN;

/// 无穷大 (∞)。
/// Use [`f64::INFINITY`] instead.
///
/// # 示例
///
/// ```rust
/// // deprecated way
/// # #[allow(deprecated)]
/// let inf = std::f64::INFINITY;
///
/// // intended way
/// let inf = f64::INFINITY;
/// ```
#[stable(feature = "rust1", since = "1.0.0")]
#[deprecated(since = "1.99.0", note = "replaced by the `INFINITY` associated constant on `f64`")]
#[rustc_diagnostic_item = "f64_legacy_const_infinity"]
pub const INFINITY: f64 = f64::INFINITY;

/// 负无穷大 (−∞)。
/// Use [`f64::NEG_INFINITY`] instead.
///
/// # 示例
///
/// ```rust
/// // deprecated way
/// # #[allow(deprecated)]
/// let ninf = std::f64::NEG_INFINITY;
///
/// // intended way
/// let ninf = f64::NEG_INFINITY;
/// ```
#[stable(feature = "rust1", since = "1.0.0")]
#[deprecated(
    since = "1.99.0",
    note = "replaced by the `NEG_INFINITY` associated constant on `f64`"
)]
#[rustc_diagnostic_item = "f64_legacy_const_neg_infinity"]
pub const NEG_INFINITY: f64 = f64::NEG_INFINITY;

/// 基本的数学常量。
#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_diagnostic_item = "f64_consts_mod"]
pub mod consts {
    // FIXME: replace with mathematical constants from cmath.

    /// 阿基米德常数 (π)
    #[stable(feature = "rust1", since = "1.0.0")]
    pub const PI: f64 = 3.14159265358979323846264338327950288_f64;

    /// 完整圆常数 (τ)
    ///
    /// 等于2π。
    #[stable(feature = "tau_constant", since = "1.47.0")]
    pub const TAU: f64 = 6.28318530717958647692528676655900577_f64;

    /// 黄金比例 (φ)
    #[doc(alias = "phi")]
    #[stable(feature = "euler_gamma_golden_ratio", since = "1.94.0")]
    pub const GOLDEN_RATIO: f64 = 1.618033988749894848204586834365638118_f64;

    /// 欧拉-马歇罗尼常数 (γ)
    #[stable(feature = "euler_gamma_golden_ratio", since = "1.94.0")]
    pub const EULER_GAMMA: f64 = 0.577215664901532860606512090082402431_f64;

    /// π/2
    #[stable(feature = "rust1", since = "1.0.0")]
    pub const FRAC_PI_2: f64 = 1.57079632679489661923132169163975144_f64;

    /// π/3
    #[stable(feature = "rust1", since = "1.0.0")]
    pub const FRAC_PI_3: f64 = 1.04719755119659774615421446109316763_f64;

    /// π/4
    #[stable(feature = "rust1", since = "1.0.0")]
    pub const FRAC_PI_4: f64 = 0.785398163397448309615660845819875721_f64;

    /// π/6
    #[stable(feature = "rust1", since = "1.0.0")]
    pub const FRAC_PI_6: f64 = 0.52359877559829887307710723054658381_f64;

    /// π/8
    #[stable(feature = "rust1", since = "1.0.0")]
    pub const FRAC_PI_8: f64 = 0.39269908169872415480783042290993786_f64;

    /// 1/π
    #[stable(feature = "rust1", since = "1.0.0")]
    pub const FRAC_1_PI: f64 = 0.318309886183790671537767526745028724_f64;

    /// 1/sqrt(π)
    #[unstable(feature = "more_float_constants", issue = "146939")]
    pub const FRAC_1_SQRT_PI: f64 = 0.564189583547756286948079451560772586_f64;

    /// 1/sqrt(2π)
    #[doc(alias = "FRAC_1_SQRT_TAU")]
    #[unstable(feature = "more_float_constants", issue = "146939")]
    pub const FRAC_1_SQRT_2PI: f64 = 0.398942280401432677939946059934381868_f64;

    /// 2/π
    #[stable(feature = "rust1", since = "1.0.0")]
    pub const FRAC_2_PI: f64 = 0.636619772367581343075535053490057448_f64;

    /// 2/sqrt(π)
    #[stable(feature = "rust1", since = "1.0.0")]
    pub const FRAC_2_SQRT_PI: f64 = 1.12837916709551257389615890312154517_f64;

    /// sqrt(2)
    #[stable(feature = "rust1", since = "1.0.0")]
    pub const SQRT_2: f64 = 1.41421356237309504880168872420969808_f64;

    /// 1/sqrt(2)
    #[stable(feature = "rust1", since = "1.0.0")]
    pub const FRAC_1_SQRT_2: f64 = 0.707106781186547524400844362104849039_f64;

    /// sqrt(3)
    #[unstable(feature = "more_float_constants", issue = "146939")]
    pub const SQRT_3: f64 = 1.732050807568877293527446341505872367_f64;

    /// 1/sqrt(3)
    #[unstable(feature = "more_float_constants", issue = "146939")]
    pub const FRAC_1_SQRT_3: f64 = 0.577350269189625764509148780501957456_f64;

    /// sqrt(5)
    #[unstable(feature = "more_float_constants", issue = "146939")]
    pub const SQRT_5: f64 = 2.23606797749978969640917366873127623_f64;

    /// 1/sqrt(5)
    #[unstable(feature = "more_float_constants", issue = "146939")]
    pub const FRAC_1_SQRT_5: f64 = 0.44721359549995793928183473374625524_f64;

    /// 欧拉数 (e)
    #[stable(feature = "rust1", since = "1.0.0")]
    pub const E: f64 = 2.71828182845904523536028747135266250_f64;

    /// log<sub>2</sub>(10)
    #[stable(feature = "extra_log_consts", since = "1.43.0")]
    pub const LOG2_10: f64 = 3.32192809488736234787031942948939018_f64;

    /// log<sub>2</sub>(e)
    #[stable(feature = "rust1", since = "1.0.0")]
    pub const LOG2_E: f64 = 1.44269504088896340735992468100189214_f64;

    /// log<sub>10</sub>(2)
    #[stable(feature = "extra_log_consts", since = "1.43.0")]
    pub const LOG10_2: f64 = 0.301029995663981195213738894724493027_f64;

    /// log<sub>10</sub>(e)
    #[stable(feature = "rust1", since = "1.0.0")]
    pub const LOG10_E: f64 = 0.434294481903251827651128918916605082_f64;

    /// ln(2)
    #[stable(feature = "rust1", since = "1.0.0")]
    pub const LN_2: f64 = 0.693147180559945309417232121458176568_f64;

    /// ln(10)
    #[stable(feature = "rust1", since = "1.0.0")]
    pub const LN_10: f64 = 2.30258509299404568401799145468436421_f64;
}

#[doc(test(attr(allow(unused_features))))]
impl f64 {
    float_impl! {
        Self = f64,
        Bits = u64,
        SignedBits = i64,
        BITS = 64,
        MANTISSA_DIGITS = 53,
        DIGITS = 15,
        EPSILON = 2.220446049250313e-16_f64,
        MIN = -1.7976931348623157e+308_f64,
        MIN_POSITIVE = 2.2250738585072014e-308_f64,
        MAX = 1.7976931348623157e+308_f64,
        MIN_EXP = -1021,
        MAX_EXP = 1024,
        MIN_10_EXP = -307,
        MAX_10_EXP = 308,
        SIGN_MASK = 0x8000_0000_0000_0000,
        EXPONENT_MASK = 0x7ff0_0000_0000_0000,
        MANTISSA_MASK = 0x000f_ffff_ffff_ffff,
        exponent_bias = 1023,
        assoc_int_consts = #[stable(feature = "assoc_int_consts", since = "1.43.0")],
        float_bits_const = #[stable(feature = "float_bits_const", since = "CURRENT_RUSTC_VERSION")],
    }

    /// Returns `true` if this value is NaN.
    ///
    /// ```
    /// let nan = f64::NAN;
    /// let f = 7.0_f64;
    ///
    /// assert!(nan.is_nan());
    /// assert!(!f.is_nan());
    /// ```
    #[must_use]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_float_classify", since = "1.83.0")]
    #[inline]
    #[allow(clippy::eq_op)] // > if you intended to check if the operand is NaN, use `.is_nan()` instead :)
    pub const fn is_nan(self) -> bool {
        self != self
    }

    /// Returns `true` if this value is positive infinity or negative infinity, and
    /// `false` otherwise.
    ///
    /// ```
    /// let f = 7.0f64;
    /// let inf = f64::INFINITY;
    /// let neg_inf = f64::NEG_INFINITY;
    /// let nan = f64::NAN;
    ///
    /// assert!(!f.is_infinite());
    /// assert!(!nan.is_infinite());
    ///
    /// assert!(inf.is_infinite());
    /// assert!(neg_inf.is_infinite());
    /// ```
    #[must_use]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_float_classify", since = "1.83.0")]
    #[inline]
    pub const fn is_infinite(self) -> bool {
        // Getting clever with transmutation can result in incorrect answers on some FPUs
        // FIXME: alter the Rust <-> Rust calling convention to prevent this problem.
        // See https://github.com/rust-lang/rust/issues/72327
        (self == f64::INFINITY) | (self == f64::NEG_INFINITY)
    }

    /// Returns `true` if this number is neither infinite nor NaN.
    ///
    /// ```
    /// let f = 7.0f64;
    /// let inf: f64 = f64::INFINITY;
    /// let neg_inf: f64 = f64::NEG_INFINITY;
    /// let nan: f64 = f64::NAN;
    ///
    /// assert!(f.is_finite());
    ///
    /// assert!(!nan.is_finite());
    /// assert!(!inf.is_finite());
    /// assert!(!neg_inf.is_finite());
    /// ```
    #[must_use]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_float_classify", since = "1.83.0")]
    #[inline]
    pub const fn is_finite(self) -> bool {
        // There's no need to handle NaN separately: if self is NaN,
        // the comparison is not true, exactly as desired.
        self.abs() < Self::INFINITY
    }

    /// Returns `true` if the number is [subnormal].
    ///
    /// ```
    /// let min = f64::MIN_POSITIVE; // 2.2250738585072014e-308_f64
    /// let max = f64::MAX;
    /// let lower_than_min = 1.0e-308_f64;
    /// let zero = 0.0_f64;
    ///
    /// assert!(!min.is_subnormal());
    /// assert!(!max.is_subnormal());
    ///
    /// assert!(!zero.is_subnormal());
    /// assert!(!f64::NAN.is_subnormal());
    /// assert!(!f64::INFINITY.is_subnormal());
    /// // Values between `0` and `min` are Subnormal.
    /// assert!(lower_than_min.is_subnormal());
    /// ```
    /// [subnormal]: https://en.wikipedia.org/wiki/Denormal_number
    #[must_use]
    #[stable(feature = "is_subnormal", since = "1.53.0")]
    #[rustc_const_stable(feature = "const_float_classify", since = "1.83.0")]
    #[inline]
    pub const fn is_subnormal(self) -> bool {
        matches!(self.classify(), FpCategory::Subnormal)
    }

    /// Returns `true` if the number is neither zero, infinite,
    /// [subnormal], or NaN.
    ///
    /// ```
    /// let min = f64::MIN_POSITIVE; // 2.2250738585072014e-308f64
    /// let max = f64::MAX;
    /// let lower_than_min = 1.0e-308_f64;
    /// let zero = 0.0f64;
    ///
    /// assert!(min.is_normal());
    /// assert!(max.is_normal());
    ///
    /// assert!(!zero.is_normal());
    /// assert!(!f64::NAN.is_normal());
    /// assert!(!f64::INFINITY.is_normal());
    /// // Values between `0` and `min` are Subnormal.
    /// assert!(!lower_than_min.is_normal());
    /// ```
    /// [subnormal]: https://en.wikipedia.org/wiki/Denormal_number
    #[must_use]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_float_classify", since = "1.83.0")]
    #[inline]
    pub const fn is_normal(self) -> bool {
        matches!(self.classify(), FpCategory::Normal)
    }

    /// 返回该数的浮点类别。如果只有一项属性
    /// 将被测试，通常使用特定值会更快。
    /// 改为 predicate 使用。
    ///
    /// ```
    /// use std::num::FpCategory;
    ///
    /// let num = 12.4_f64;
    /// let inf = f64::INFINITY;
    ///
    /// assert_eq!(num.classify(), FpCategory::Normal);
    /// assert_eq!(inf.classify(), FpCategory::Infinite);
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_float_classify", since = "1.83.0")]
    #[must_use]
    pub const fn classify(self) -> FpCategory {
        // We used to have complicated logic here that avoids the simple bit-based tests to work
        // around buggy codegen for x87 targets (see
        // https://github.com/rust-lang/rust/issues/114479). However, some LLVM versions later, none
        // of our tests is able to find any difference between the complicated and the naive
        // version, so now we are back to the naive version.
        let b = self.to_bits();
        match (b & Self::MANTISSA_MASK, b & Self::EXPONENT_MASK) {
            (0, Self::EXPONENT_MASK) => FpCategory::Infinite,
            (_, Self::EXPONENT_MASK) => FpCategory::Nan,
            (0, 0) => FpCategory::Zero,
            (_, 0) => FpCategory::Subnormal,
            _ => FpCategory::Normal,
        }
    }

    /// Returns `true` if `self` has a positive sign, including `+0.0`, NaNs with
    /// 具有正符号位和正无穷大。
    ///
    /// 注意，IEEE 754 在出现 NaN 时不会给符号位赋予任何含义，且 Rust 也不保证 NaN 的位模式在算术运算中保持不变。
    /// a NaN, and as Rust doesn't guarantee that the bit pattern of NaNs are
    /// conserved over arithmetic operations, the result of `is_sign_positive` on
    /// 具有负符号位和负无穷大。
    /// of NaN bit patterns](f32#nan-bit-patterns) for more info. Use `self.signum() == 1.0`
    /// if you need fully portable behavior (evaluates to `false` for all NaNs).
    ///
    /// ```
    /// let f = 7.0_f64;
    /// let g = -7.0_f64;
    ///
    /// assert!(f.is_sign_positive());
    /// assert!(!g.is_sign_positive());
    /// ```
    #[must_use]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_float_classify", since = "1.83.0")]
    #[inline]
    pub const fn is_sign_positive(self) -> bool {
        !self.is_sign_negative()
    }

    /// Returns `true` if `self` has a negative sign, including `-0.0`, NaNs with
    /// 具有负符号位和负无穷大。
    ///
    /// 注意，IEEE 754 在出现 NaN 时不会给符号位赋予任何含义，且 Rust 也不保证 NaN 的位模式在算术运算中保持不变。
    /// a NaN, and as Rust doesn't guarantee that the bit pattern of NaNs are
    /// conserved over arithmetic operations, the result of `is_sign_negative` on
    /// a NaN might produce an unexpected or non-portable result. See the [specification
    /// of NaN bit patterns](f32#nan-bit-patterns) for more info. Use `self.signum() == -1.0`
    /// if you need fully portable behavior (evaluates to `false` for all NaNs).
    ///
    /// ```
    /// let f = 7.0_f64;
    /// let g = -7.0_f64;
    ///
    /// assert!(!f.is_sign_negative());
    /// assert!(g.is_sign_negative());
    /// ```
    #[must_use]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_float_classify", since = "1.83.0")]
    #[inline]
    pub const fn is_sign_negative(self) -> bool {
        // IEEE754 says: isSignMinus(x) is true if and only if x has negative sign. isSignMinus
        // applies to zeros and NaNs as well.
        self.to_bits() & Self::SIGN_MASK != 0
    }

    /// Returns the least number greater than `self`.
    ///
    /// Let `TINY` be the smallest representable positive `f64`. Then,
    ///  - if `self.is_nan()`, this returns `self`;
    ///  - if `self` is [`NEG_INFINITY`], this returns [`MIN`];
    ///  - if `self` is `-TINY`, this returns -0.0;
    ///  - if `self` is -0.0 or +0.0, this returns `TINY`;
    ///  - if `self` is [`MAX`] or [`INFINITY`], this returns [`INFINITY`];
    ///  - otherwise the unique least value greater than `self` is returned.
    ///
    /// The identity `x.next_up() == -(-x).next_down()` holds for all non-NaN `x`. When `x`
    /// is finite `x == x.next_up().next_down()` also holds.
    ///
    /// ```rust
    /// // f64::EPSILON is the difference between 1.0 and the next number up.
    /// assert_eq!(1.0f64.next_up(), 1.0 + f64::EPSILON);
    /// // But not for most numbers.
    /// assert!(0.1f64.next_up() < 0.1 + f64::EPSILON);
    /// assert_eq!(9007199254740992f64.next_up(), 9007199254740994.0);
    /// ```
    ///
    /// This operation corresponds to IEEE-754 `nextUp`.
    ///
    /// [`NEG_INFINITY`]: Self::NEG_INFINITY
    /// [`INFINITY`]: Self::INFINITY
    /// [`MIN`]: Self::MIN
    /// [`MAX`]: Self::MAX
    #[inline]
    #[doc(alias = "nextUp")]
    #[stable(feature = "float_next_up_down", since = "1.86.0")]
    #[rustc_const_stable(feature = "float_next_up_down", since = "1.86.0")]
    #[must_use = "method returns a new number and does not mutate the original value"]
    pub const fn next_up(self) -> Self {
        // Some targets violate Rust's assumption of IEEE semantics, e.g. by flushing
        // denormals to zero. This is in general unsound and unsupported, but here
        // we do our best to still produce the correct result on such targets.
        let bits = self.to_bits();
        if self.is_nan() || bits == Self::INFINITY.to_bits() {
            return self;
        }

        let abs = bits & !Self::SIGN_MASK;
        let next_bits = if abs == 0 {
            Self::TINY_BITS
        } else if bits == abs {
            bits + 1
        } else {
            bits - 1
        };
        Self::from_bits(next_bits)
    }

    /// Returns the greatest number less than `self`.
    ///
    /// Let `TINY` be the smallest representable positive `f64`. Then,
    ///  - if `self.is_nan()`, this returns `self`;
    ///  - if `self` is [`INFINITY`], this returns [`MAX`];
    ///  - if `self` is `TINY`, this returns 0.0;
    ///  - if `self` is -0.0 or +0.0, this returns `-TINY`;
    ///  - if `self` is [`MIN`] or [`NEG_INFINITY`], this returns [`NEG_INFINITY`];
    ///  - otherwise the unique greatest value less than `self` is returned.
    ///
    /// The identity `x.next_down() == -(-x).next_up()` holds for all non-NaN `x`. When `x`
    /// is finite `x == x.next_down().next_up()` also holds.
    ///
    /// ```rust
    /// let x = 1.0f64;
    /// // Clamp value into range [0, 1).
    /// let clamped = x.clamp(0.0, 1.0f64.next_down());
    /// assert!(clamped < 1.0);
    /// assert_eq!(clamped.next_up(), 1.0);
    /// ```
    ///
    /// This operation corresponds to IEEE-754 `nextDown`.
    ///
    /// [`NEG_INFINITY`]: Self::NEG_INFINITY
    /// [`INFINITY`]: Self::INFINITY
    /// [`MIN`]: Self::MIN
    /// [`MAX`]: Self::MAX
    #[inline]
    #[doc(alias = "nextDown")]
    #[stable(feature = "float_next_up_down", since = "1.86.0")]
    #[rustc_const_stable(feature = "float_next_up_down", since = "1.86.0")]
    #[must_use = "method returns a new number and does not mutate the original value"]
    pub const fn next_down(self) -> Self {
        // Some targets violate Rust's assumption of IEEE semantics, e.g. by flushing
        // denormals to zero. This is in general unsound and unsupported, but here
        // we do our best to still produce the correct result on such targets.
        let bits = self.to_bits();
        if self.is_nan() || bits == Self::NEG_INFINITY.to_bits() {
            return self;
        }

        let abs = bits & !Self::SIGN_MASK;
        let next_bits = if abs == 0 {
            Self::NEG_TINY_BITS
        } else if bits == abs {
            bits - 1
        } else {
            bits + 1
        };
        Self::from_bits(next_bits)
    }

    /// Takes the reciprocal (inverse) of a number, `1/x`.
    ///
    /// ```
    /// let x = 2.0_f64;
    /// let abs_difference = (x.recip() - (1.0 / x)).abs();
    ///
    /// assert!(abs_difference < 1e-10);
    /// ```
    #[must_use = "this returns the result of the operation, without modifying the original"]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_float_methods", since = "1.85.0")]
    #[inline]
    pub const fn recip(self) -> f64 {
        1.0 / self
    }

    /// 将弧度转换为度。
    ///
    /// # 精度未指定
    ///
    /// 此函数的精度具有不确定性。这意味着其会因平台、
    /// Rust 版本以及同一次调用在不同执行中的差异而不同。
    ///
    /// # 示例
    ///
    /// ```
    /// let angle = std::f64::consts::PI;
    ///
    /// let abs_difference = (angle.to_degrees() - 180.0).abs();
    ///
    /// assert!(abs_difference < 1e-10);
    /// ```
    #[must_use = "this returns the result of the operation, \
                  without modifying the original"]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_float_methods", since = "1.85.0")]
    #[inline]
    pub const fn to_degrees(self) -> f64 {
        // The division here is correctly rounded with respect to the true value of 180/π.
        // Although π is irrational and already rounded, the double rounding happens
        // to produce correct result for f64.
        const PIS_IN_180: f64 = 180.0 / consts::PI;
        self * PIS_IN_180
    }

    /// 将度转换为弧度。
    ///
    /// # 精度未指定
    ///
    /// 此函数的精度具有不确定性。这意味着其会因平台、
    /// Rust 版本以及同一次调用在不同执行中的差异而不同。
    ///
    /// # 示例
    ///
    /// ```
    /// let angle = 180.0_f64;
    ///
    /// let abs_difference = (angle.to_radians() - std::f64::consts::PI).abs();
    ///
    /// assert!(abs_difference < 1e-10);
    /// ```
    #[must_use = "this returns the result of the operation, \
                  without modifying the original"]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_float_methods", since = "1.85.0")]
    #[inline]
    pub const fn to_radians(self) -> f64 {
        // The division here is correctly rounded with respect to the true value of π/180.
        // Although π is irrational and already rounded, the double rounding happens
        // to produce correct result for f64.
        const RADS_PER_DEG: f64 = consts::PI / 180.0;
        self * RADS_PER_DEG
    }

    /// 返回两个数字中的最大值，忽略 NaN。
    ///
    /// 如果参数中恰好有一个是 NaN（静默或信号），则返回另一个参数。
    /// 如果两个参数都是 NaN，返回值也是 NaN，其位模式由
    /// using the usual [rules for arithmetic operations](f32#nan-bit-patterns). If the inputs
    /// compare equal (such as for the case of `+0.0` and `-0.0`), either input may be returned
    /// 不确定地。
    ///
    /// The handling of NaNs follows the IEEE 754-2019 semantics for `maximumNumber`, treating all
    /// NaN 以相同方式处理，以确保操作具有结合性。带符号零的处理
    /// follows the IEEE 754-2008 semantics for `maxNum`.
    ///
    /// ```
    /// let x = 1.0_f64;
    /// let y = 2.0_f64;
    ///
    /// assert_eq!(x.max(y), y);
    /// assert_eq!(x.max(f64::NAN), x);
    /// ```
    #[must_use = "this returns the result of the comparison, without modifying either input"]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_float_methods", since = "1.85.0")]
    #[inline]
    pub const fn max(self, other: f64) -> f64 {
        intrinsics::maximum_number_nsz(self, other)
    }

    /// 返回两个数字中的最小值，忽略 NaN。
    ///
    /// 如果参数中恰好有一个是 NaN（静默或信号），则返回另一个参数。
    /// 如果两个参数都是 NaN，返回值也是 NaN，其位模式由
    /// using the usual [rules for arithmetic operations](f32#nan-bit-patterns). If the inputs
    /// compare equal (such as for the case of `+0.0` and `-0.0`), either input may be returned
    /// 不确定地。
    ///
    /// The handling of NaNs follows the IEEE 754-2019 semantics for `minimumNumber`, treating all
    /// NaN 以相同方式处理，以确保操作具有结合性。带符号零的处理
    /// follows the IEEE 754-2008 semantics for `minNum`.
    ///
    /// ```
    /// let x = 1.0_f64;
    /// let y = 2.0_f64;
    ///
    /// assert_eq!(x.min(y), x);
    /// assert_eq!(x.min(f64::NAN), x);
    /// ```
    #[must_use = "this returns the result of the comparison, without modifying either input"]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_float_methods", since = "1.85.0")]
    #[inline]
    pub const fn min(self, other: f64) -> f64 {
        intrinsics::minimum_number_nsz(self, other)
    }

    /// 返回两个数字中的最大值，并传播 NaN。
    ///
    /// 如果参数中至少有一个是 NaN，返回值也是 NaN，其位模式由
    /// picked using the usual [rules for arithmetic operations](f32#nan-bit-patterns). Furthermore,
    /// `-0.0` is considered to be less than `+0.0`, making this function fully deterministic for
    /// 非 NaN 输入完全确定。
    ///
    /// This is in contrast to [`f64::max`] which only returns NaN when *both* arguments are NaN,
    /// and which does not reliably order `-0.0` and `+0.0`.
    ///
    /// This follows the IEEE 754-2019 semantics for `maximum`.
    ///
    /// ```
    /// #![feature(float_minimum_maximum)]
    /// let x = 1.0_f64;
    /// let y = 2.0_f64;
    ///
    /// assert_eq!(x.maximum(y), y);
    /// assert!(x.maximum(f64::NAN).is_nan());
    /// ```
    #[must_use = "this returns the result of the comparison, without modifying either input"]
    #[unstable(feature = "float_minimum_maximum", issue = "91079")]
    #[rustc_const_unstable(feature = "float_minimum_maximum", issue = "91079")]
    #[inline]
    pub const fn maximum(self, other: f64) -> f64 {
        intrinsics::maximum(self, other)
    }

    /// 返回两个数字的最小值，并传播 NaN 值。
    ///
    /// 如果至少有一个参数为 NaN，则返回值为 NaN，其位模式遵循通常的 [算术运算规则]。
    /// picked using the usual [rules for arithmetic operations](f32#nan-bit-patterns). Furthermore,
    /// `-0.0` is considered to be less than `+0.0`, making this function fully deterministic for
    /// non-NaN inputs.
    ///
    /// This is in contrast to [`f64::min`] which only returns NaN when *both* arguments are NaN,
    /// and which does not reliably order `-0.0` and `+0.0`.
    ///
    /// This follows the IEEE 754-2019 semantics for `minimum`.
    ///
    /// ```
    /// #![feature(float_minimum_maximum)]
    /// let x = 1.0_f64;
    /// let y = 2.0_f64;
    ///
    /// assert_eq!(x.minimum(y), x);
    /// assert!(x.minimum(f64::NAN).is_nan());
    /// ```
    #[must_use = "this returns the result of the comparison, without modifying either input"]
    #[unstable(feature = "float_minimum_maximum", issue = "91079")]
    #[rustc_const_unstable(feature = "float_minimum_maximum", issue = "91079")]
    #[inline]
    pub const fn minimum(self, other: f64) -> f64 {
        intrinsics::minimum(self, other)
    }

    /// Calculates the midpoint (average) between `self` and `rhs`.
    ///
    /// # 示例
    /// 向零取整并转换为任意基本整数类型，前提是该值有限且适合该类型。
    ///
    /// # 示例
    ///
    /// ```
    /// assert_eq!(1f64.midpoint(4.0), 2.5);
    /// assert_eq!((-5.5f64).midpoint(8.0), 1.25);
    /// ```
    #[inline]
    #[doc(alias = "average")]
    #[stable(feature = "num_midpoint", since = "1.85.0")]
    #[rustc_const_stable(feature = "num_midpoint", since = "1.85.0")]
    #[must_use = "this returns the result of the operation, \
                  without modifying the original"]
    pub const fn midpoint(self, other: f64) -> f64 {
        const HI: f64 = f64::MAX * 0.5;

        let (a, b) = (self, other);
        let abs_a = a.abs();
        let abs_b = b.abs();

        if abs_a <= HI && abs_b <= HI {
            // Overflow is impossible
            (a + b) * 0.5
        } else {
            (a * 0.5) + (b * 0.5)
        }
    }

    /// 向零取整并转换为任何基本整数类型。
    /// 假设该值有限且适合该类型。
    ///
    /// ```
    /// let value = 4.6_f64;
    /// let rounded = unsafe { value.to_int_unchecked::<u16>() };
    /// assert_eq!(rounded, 4);
    ///
    /// let value = -128.9_f64;
    /// let rounded = unsafe { value.to_int_unchecked::<i8>() };
    /// assert_eq!(rounded, i8::MIN);
    /// ```
    ///
    /// # 安全性
    ///
    /// 该值必须：
    ///
    /// * Not be `NaN`
    /// * 不是无限值
    /// * Be representable in the return type `Int`, after truncating off its fractional part
    #[must_use = "this returns the result of the operation, \
                  without modifying the original"]
    #[stable(feature = "float_approx_unchecked_to", since = "1.44.0")]
    #[inline]
    pub unsafe fn to_int_unchecked<Int>(self) -> Int
    where
        Self: FloatToInt<Int>,
    {
        // SAFETY: the caller must uphold the safety contract for
        // `FloatToInt::to_int_unchecked`.
        unsafe { FloatToInt::<Int>::to_int_unchecked(self) }
    }

    /// 转换为目标浮点类型，按照 IEEE 754 定义进行四舍五入。
    ///
    /// This is equivalent to `self as Flt`. Narrowing to a smaller type can
    /// 产生无穷大。
    ///
    /// ```
    /// #![feature(float_conversions)]
    ///
    /// let x = 1.5_f64;
    /// assert_eq!(x.cast::<f32>(), 1.5_f32);
    /// ```
    #[unstable(feature = "float_conversions", issue = "159913")]
    #[must_use = "this returns the result of the operation, without modifying the original"]
    #[inline]
    pub fn cast<Flt>(self) -> Flt
    where
        Self: FloatToFloat<Flt>,
    {
        FloatToFloat::<Flt>::cast(self)
    }

    /// Rounds toward zero and converts to any primitive integer type, saturating
    /// at the type's boundaries and mapping `NaN` to zero.
    ///
    /// This is equivalent to `self as Int`.
    ///
    /// ```
    /// #![feature(float_conversions)]
    ///
    /// assert_eq!(255.5_f64.to_int_saturating::<u8>(), 255);
    /// assert_eq!(300.0_f64.to_int_saturating::<u8>(), 255);
    /// assert_eq!((-1.0_f64).to_int_saturating::<u8>(), 0);
    /// assert_eq!(f64::NAN.to_int_saturating::<u8>(), 0);
    /// ```
    #[unstable(feature = "float_conversions", issue = "159913")]
    #[must_use = "this returns the result of the operation, without modifying the original"]
    #[inline]
    pub fn to_int_saturating<Int>(self) -> Int
    where
        Self: FloatToInt<Int>,
    {
        FloatToInt::<Int>::to_int_saturating(self)
    }

    /// Rounds toward zero and converts to any primitive integer type, returning
    /// `None` if the value is `NaN`, infinite, or does not fit in the target type.
    ///
    /// ```
    /// #![feature(float_conversions)]
    ///
    /// assert_eq!(255.5_f64.to_int_checked::<u8>(), Some(255));
    /// assert_eq!(256.0_f64.to_int_checked::<u8>(), None);
    /// assert_eq!(f64::NAN.to_int_checked::<u8>(), None);
    /// ```
    #[unstable(feature = "float_conversions", issue = "159913")]
    #[must_use = "this returns the result of the operation, without modifying the original"]
    #[inline]
    pub fn to_int_checked<Int>(self) -> Option<Int>
    where
        Self: FloatToInt<Int>,
    {
        FloatToInt::<Int>::to_int_checked(self)
    }

    /// Rounds toward zero and converts to any primitive integer type.
    ///
    /// This is equivalent to `self.to_int_checked().unwrap()`.
    ///
    /// # 异常
    ///
    /// Panics if the value is `NaN`, infinite, or does not fit in the target type.
    ///
    /// ```
    /// #![feature(float_conversions)]
    ///
    /// assert_eq!(255.5_f64.to_int_strict::<u8>(), 255);
    /// ```
    #[unstable(feature = "float_conversions", issue = "159913")]
    #[must_use = "this returns the result of the operation, without modifying the original"]
    #[inline]
    #[track_caller]
    pub fn to_int_strict<Int>(self) -> Int
    where
        Self: FloatToInt<Int>,
    {
        self.to_int_checked::<Int>()
            .expect("the value cannot be represented in the target integer type")
    }

    /// Raw transmutation to `u64`.
    ///
    /// This is currently identical to `transmute::<f64, u64>(self)` on all platforms.
    ///
    /// See [`from_bits`](Self::from_bits) for some discussion of the
    /// portability of this operation (there are almost no issues).
    ///
    /// Note that this function is distinct from `as` casting, which attempts to
    /// 保留 *数值* 值，而不是位值。
    ///
    /// # 示例
    ///
    /// ```
    /// assert!((1f64).to_bits() != 1f64 as u64); // to_bits() is not casting!
    /// assert_eq!((12.5f64).to_bits(), 0x4029000000000000);
    /// ```
    #[must_use = "this returns the result of the operation, \
                  without modifying the original"]
    #[stable(feature = "float_bits_conv", since = "1.20.0")]
    #[rustc_const_stable(feature = "const_float_bits_conv", since = "1.83.0")]
    #[allow(unnecessary_transmutes)]
    #[inline]
    pub const fn to_bits(self) -> u64 {
        // SAFETY: `u64` is a plain old datatype so we can always transmute to it.
        unsafe { mem::transmute(self) }
    }

    /// Raw transmutation from `u64`.
    ///
    /// This is currently identical to `transmute::<u64, f64>(v)` on all platforms.
    /// 事实证明，此操作具有极高的可移植性，原因有二：
    ///
    /// * 浮点数和整数在所有支持的平台上都具有相同的端序。
    /// * IEEE 754 对浮点数的位布局有非常精确的规定。
    ///
    /// 不过有一个注意事项：在 2008 年版本的 IEEE 754 之前，
    /// 如何解释 NaN 信号位并没有被明确规定。大多数平台
    /// （尤其是 x86 和 ARM）选择了最终在 2008 年标准化的解释方式，但有些平台没有（尤其是 MIPS）。因此，
    /// MIPS 上的所有 NaN 信号都是静默的 NaN，而 x86 则相反。
    /// 与其尝试跨平台保持信号特性，这种实现更倾向于保留精确的位结构。这意味着
    ///
    /// 即使通过网络从 x86 机器传输到 MIPS 机器时采用这种方法，编码在 NaN 中的任何有效载荷都将得到保留。
    /// 如果这种方法的输出仅由产生它们的相同架构处理，则不存在可移植性问题。
    /// 如果输入不是 NaN，则不存在可移植性问题。
    /// 如果你不关心信号特性（非常可能），则不存在可移植性问题。
    ///
    /// If the results of this method are only manipulated by the same
    /// *数值*值，而不是位值。
    ///
    /// # 示例
    ///
    /// 以大端序（网络）字节顺序的字节数组返回此浮点数的内存表示。
    /// portability concern.
    ///
    /// Note that this function is distinct from `as` casting, which attempts to
    /// 以小端序字节数组的字节顺序返回此浮点数的内存表示。
    ///
    /// # Examples
    ///
    /// ```
    /// let v = f64::from_bits(0x4029000000000000);
    /// assert_eq!(v, 12.5);
    /// ```
    #[stable(feature = "float_bits_conv", since = "1.20.0")]
    #[rustc_const_stable(feature = "const_float_bits_conv", since = "1.83.0")]
    #[must_use]
    #[inline]
    #[allow(unnecessary_transmutes)]
    pub const fn from_bits(v: u64) -> Self {
        // It turns out the safety issues with sNaN were overblown! Hooray!
        // SAFETY: `u64` is a plain old datatype so we can always transmute from it.
        unsafe { mem::transmute(v) }
    }

    /// # 示例
    /// 以大端序字节数组的字节顺序返回此浮点数的内存表示。
    ///
    /// See [`from_bits`](Self::from_bits) for some discussion of the
    /// # 示例
    ///
    /// # 以小端序字节数组的字节顺序返回此浮点数的内存表示。
    ///
    /// ```
    /// let bytes = 12.5f64.to_be_bytes();
    /// assert_eq!(bytes, [0x40, 0x29, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    /// ```
    #[must_use = "this returns the result of the operation, \
                  without modifying the original"]
    #[stable(feature = "float_to_from_bytes", since = "1.40.0")]
    #[rustc_const_stable(feature = "const_float_bits_conv", since = "1.83.0")]
    #[inline]
    pub const fn to_be_bytes(self) -> [u8; 8] {
        self.to_bits().to_be_bytes()
    }

    /// Returns the memory representation of this floating point number as a byte array in
    /// # 示例
    ///
    /// See [`from_bits`](Self::from_bits) for some discussion of the
    /// portability of this operation (there are almost no issues).
    ///
    /// # 示例
    ///
    /// ```
    /// let bytes = 12.5f64.to_le_bytes();
    /// assert_eq!(bytes, [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x29, 0x40]);
    /// ```
    #[must_use = "this returns the result of the operation, \
                  without modifying the original"]
    #[stable(feature = "float_to_from_bytes", since = "1.40.0")]
    #[rustc_const_stable(feature = "const_float_bits_conv", since = "1.83.0")]
    #[inline]
    pub const fn to_le_bytes(self) -> [u8; 8] {
        self.to_bits().to_le_bytes()
    }

    /// 以本地字节序的字节数组的字节顺序返回此浮点数的内存表示。
    /// 由于使用目标平台的本地端序，可移植代码
    ///
    /// As the target platform's native endianness is used, portable code
    /// should use [`to_be_bytes`] or [`to_le_bytes`], as appropriate, instead.
    ///
    /// [`to_be_bytes`]: f64::to_be_bytes
    /// [`to_le_bytes`]: f64::to_le_bytes
    ///
    /// See [`from_bits`](Self::from_bits) for some discussion of the
    /// 从大端序的字节数组表示中创建浮点值。
    ///
    /// # 示例
    ///
    /// ```
    /// let bytes = 12.5f64.to_ne_bytes();
    /// assert_eq!(
    ///     bytes,
    ///     if cfg!(target_endian = "big") {
    ///         [0x40, 0x29, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]
    ///     } else {
    ///         [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x29, 0x40]
    ///     }
    /// );
    /// ```
    #[must_use = "this returns the result of the operation, \
                  without modifying the original"]
    #[stable(feature = "float_to_from_bytes", since = "1.40.0")]
    #[rustc_const_stable(feature = "const_float_bits_conv", since = "1.83.0")]
    #[inline]
    pub const fn to_ne_bytes(self) -> [u8; 8] {
        self.to_bits().to_ne_bytes()
    }

    /// 从大端序的字节数组表示中创建浮点值。
    ///
    /// See [`from_bits`](Self::from_bits) for some discussion of the
    /// 从小端序的字节数组表示中创建浮点值。
    ///
    /// # 示例
    ///
    /// ```
    /// let value = f64::from_be_bytes([0x40, 0x29, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    /// assert_eq!(value, 12.5);
    /// ```
    #[stable(feature = "float_to_from_bytes", since = "1.40.0")]
    #[rustc_const_stable(feature = "const_float_bits_conv", since = "1.83.0")]
    #[must_use]
    #[inline]
    pub const fn from_be_bytes(bytes: [u8; 8]) -> Self {
        Self::from_bits(u64::from_be_bytes(bytes))
    }

    /// 从小端序的字节数组表示中创建浮点值。
    ///
    /// See [`from_bits`](Self::from_bits) for some discussion of the
    /// 此操作几乎不存在可移植性问题。
    ///
    /// # 示例
    ///
    /// ```
    /// let value = f64::from_le_bytes([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x29, 0x40]);
    /// assert_eq!(value, 12.5);
    /// ```
    #[stable(feature = "float_to_from_bytes", since = "1.40.0")]
    #[rustc_const_stable(feature = "const_float_bits_conv", since = "1.83.0")]
    #[must_use]
    #[inline]
    pub const fn from_le_bytes(bytes: [u8; 8]) -> Self {
        Self::from_bits(u64::from_le_bytes(bytes))
    }

    /// 根据字节数组的表示方式，从原生字节序中生成浮点值。
    ///
    /// 由于使用了目标平台的原生字节序，可移植代码
    /// likely wants to use [`from_be_bytes`] or [`from_le_bytes`], as
    /// appropriate instead.
    ///
    /// [`from_be_bytes`]: f64::from_be_bytes
    /// [`from_le_bytes`]: f64::from_le_bytes
    ///
    /// See [`from_bits`](Self::from_bits) for some discussion of the
    /// 此操作几乎不存在可移植性问题。
    ///
    /// # 示例
    ///
    /// ```
    /// let value = f64::from_ne_bytes(if cfg!(target_endian = "big") {
    ///     [0x40, 0x29, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]
    /// } else {
    ///     [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x29, 0x40]
    /// });
    /// assert_eq!(value, 12.5);
    /// ```
    #[stable(feature = "float_to_from_bytes", since = "1.40.0")]
    #[rustc_const_stable(feature = "const_float_bits_conv", since = "1.83.0")]
    #[must_use]
    #[inline]
    pub const fn from_ne_bytes(bytes: [u8; 8]) -> Self {
        Self::from_bits(u64::from_ne_bytes(bytes))
    }

    /// Returns the ordering between `self` and `other`.
    ///
    /// 与标准浮点数部分比较不同，
    /// this comparison always produces an ordering in accordance to
    /// the `totalOrder` predicate as defined in the IEEE 754 (2008 revision)
    /// - 负的静默 NaN
    ///
    /// - 负的信号 NaN
    /// - 负无穷
    /// - 负数
    /// - 负的次正规数
    /// - 负的零
    /// - 正零
    /// - 正次正规数
    /// - 正数
    /// - 正无穷
    /// - 正无穷
    /// - 正的信号 NaN
    /// - 正的静默 NaN。
    ///
    /// 此函数建立的排序关系并不总是与
    /// [`PartialOrd`] and [`PartialEq`] implementations of `f64`. For example,
    /// they consider negative and positive zero equal, while `total_cmp`
    /// 则不是这样。
    ///
    /// 信号 NaN 位的解读遵循 IEEE 754 标准中的定义，这可能与某些
    /// 旧的非兼容（例如 MIPS）硬件实现的解读不同。
    /// # 示例
    ///
    /// # 除非值为 NaN，否则将值限制在某个区间内。
    ///
    /// ```
    /// struct GoodBoy {
    ///     name: String,
    ///     weight: f64,
    /// }
    ///
    /// let mut bois = vec![
    ///     GoodBoy { name: "Pucci".to_owned(), weight: 0.1 },
    ///     GoodBoy { name: "Woofer".to_owned(), weight: 99.0 },
    ///     GoodBoy { name: "Yapper".to_owned(), weight: 10.0 },
    ///     GoodBoy { name: "Chonk".to_owned(), weight: f64::INFINITY },
    ///     GoodBoy { name: "Abs. Unit".to_owned(), weight: f64::NAN },
    ///     GoodBoy { name: "Floaty".to_owned(), weight: -5.0 },
    /// ];
    ///
    /// bois.sort_by(|a, b| a.weight.total_cmp(&b.weight));
    ///
    /// // `f64::NAN` could be positive or negative, which will affect the sort order.
    /// if f64::NAN.is_sign_negative() {
    ///     assert!(bois.into_iter().map(|b| b.weight)
    ///         .zip([f64::NAN, -5.0, 0.1, 10.0, 99.0, f64::INFINITY].iter())
    ///         .all(|(a, b)| a.to_bits() == b.to_bits()))
    /// } else {
    ///     assert!(bois.into_iter().map(|b| b.weight)
    ///         .zip([-5.0, 0.1, 10.0, 99.0, f64::INFINITY, f64::NAN].iter())
    ///         .all(|(a, b)| a.to_bits() == b.to_bits()))
    /// }
    /// ```
    #[stable(feature = "total_cmp", since = "1.62.0")]
    #[rustc_const_unstable(feature = "const_cmp", issue = "143800")]
    #[must_use]
    #[inline]
    pub const fn total_cmp(&self, other: &Self) -> crate::cmp::Ordering {
        let mut left = self.to_bits() as i64;
        let mut right = other.to_bits() as i64;

        // In case of negatives, flip all the bits except the sign
        // to achieve a similar layout as two's complement integers
        //
        // Why does this work? IEEE 754 floats consist of three fields:
        // Sign bit, exponent and mantissa. The set of exponent and mantissa
        // fields as a whole have the property that their bitwise order is
        // equal to the numeric magnitude where the magnitude is defined.
        // The magnitude is not normally defined on NaN values, but
        // IEEE 754 totalOrder defines the NaN values also to follow the
        // bitwise order. This leads to order explained in the doc comment.
        // However, the representation of magnitude is the same for negative
        // and positive numbers – only the sign bit is different.
        // To easily compare the floats as signed integers, we need to
        // flip the exponent and mantissa bits in case of negative numbers.
        // We effectively convert the numbers to "two's complement" form.
        //
        // To do the flipping, we construct a mask and XOR against it.
        // We branchlessly calculate an "all-ones except for the sign bit"
        // mask from negative-signed values: right shifting sign-extends
        // the integer, so we "fill" the mask with sign bits, and then
        // convert to unsigned to push one more zero bit.
        // On positive values, the mask is all zeros, so it's a no-op.
        left ^= (((left >> 63) as u64) >> 1) as i64;
        right ^= (((right >> 63) as u64) >> 1) as i64;

        left.cmp(&right)
    }

    /// Restrict a value to a certain interval unless it is NaN.
    ///
    /// Returns `max` if `self` is greater than `max`, and `min` if `self` is
    /// less than `min`. Otherwise this returns `self`.
    ///
    /// # 恐慌
    /// well. If the result is zero and among the three inputs `self`, `min`, and `max` there are
    /// zeros with different sign, either `0.0` or `-0.0` is returned non-deterministically.
    ///
    /// # Panics
    ///
    /// Panics if `min > max`, `min` is NaN, or `max` is NaN.
    ///
    /// # Examples
    ///
    /// ```
    /// assert!((-3.0f64).clamp(-2.0, 1.0) == -2.0);
    /// assert!((0.0f64).clamp(-2.0, 1.0) == 0.0);
    /// assert!((2.0f64).clamp(-2.0, 1.0) == 1.0);
    /// assert!((f64::NAN).clamp(-2.0, 1.0).is_nan());
    ///
    /// // These always returns zero, but the sign (which is ignored by `==`) is non-deterministic.
    /// assert!((0.0f64).clamp(-0.0, -0.0) == 0.0);
    /// assert!((1.0f64).clamp(-0.0, 0.0) == 0.0);
    /// // This is definitely a negative zero.
    /// assert!((-1.0f64).clamp(-0.0, 1.0).is_sign_negative());
    /// ```
    #[must_use = "method returns a new number and does not mutate the original value"]
    #[stable(feature = "clamp", since = "1.50.0")]
    #[rustc_const_stable(feature = "const_float_methods", since = "1.85.0")]
    #[inline]
    #[expect(clippy::neg_cmp_op_on_partial_ord, reason = "NaN is also invalid")]
    pub const fn clamp(mut self, min: f64, max: f64) -> f64 {
        const_assert!(
            min <= max,
            "min > max, or either was NaN",
            "min > max, or either was NaN. min = {min:?}, max = {max:?}",
            min: f64,
            max: f64,
        );

        if self < min {
            self = min;
        }
        if self > max {
            self = max;
        }
        self
    }

    /// Clamps this number to a symmetric range centered around zero.
    ///
    /// The method clamps the number's magnitude (absolute value) to be at most `limit`.
    ///
    /// This is functionally equivalent to `self.clamp(-limit, limit)`, but is more
    /// explicit about the intent.
    ///
    /// # Panics
    ///
    /// Panics if `limit` is negative or NaN, as this indicates a logic error.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(clamp_magnitude)]
    /// assert_eq!(5.0f64.clamp_magnitude(3.0), 3.0);
    /// assert_eq!((-5.0f64).clamp_magnitude(3.0), -3.0);
    /// assert_eq!(2.0f64.clamp_magnitude(3.0), 2.0);
    /// assert_eq!((-2.0f64).clamp_magnitude(3.0), -2.0);
    /// ```
    #[inline]
    #[unstable(feature = "clamp_magnitude", issue = "148519")]
    #[must_use = "method returns a new number and does not mutate the original value"]
    #[expect(clippy::neg_cmp_op_on_partial_ord, reason = "NaN is also invalid")]
    pub const fn clamp_magnitude(self, limit: f64) -> f64 {
        assert!(limit >= 0.0, "limit must be non-negative and not NaN");
        let limit = limit.abs(); // Canonicalises -0.0 to 0.0
        self.clamp(-limit, limit)
    }

    /// 仅当值不是 NaN 时，才将其限制在某个范围内。
    ///
    /// This is largely equal to `max`, `min`, or `clamp`, depending on whether the range is
    /// `min..`, `..=max`, or `min..=max`, respectively. However, unlike `max` and `min`, it will
    /// 任何边界值为 NaN 时引发 panic。
    ///
    /// 请注意，如果初始值为 NaN，该函数也会返回 NaN。
    /// 嗯。
    ///
    /// 不允许使用排他性范围。
    ///
    /// # panic
    ///
    /// Panics on `min..=max` if `min > max`, or if any bound is NaN.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(clamp_to)]
    /// assert_eq!((-3.0f64).clamp_to(-2.0..=1.0), -2.0);
    /// assert_eq!(0.0f64.clamp_to(-2.0..=1.0), 0.0);
    /// assert_eq!(2.0f64.clamp_to(..=1.0), 1.0);
    /// assert_eq!(5.0f64.clamp_to(7.0..), 7.0);
    /// assert!(f64::NAN.clamp_to(1.0..=2.0).is_nan());
    /// ```
    #[must_use]
    #[inline]
    #[unstable(feature = "clamp_to", issue = "147781")]
    pub fn clamp_to<R>(self, range: R) -> Self
    where
        R: crate::cmp::ClampBounds<Self>,
    {
        range.clamp(self)
    }

    /// Computes the absolute value of `self`.
    ///
    /// 该函数始终返回精确的结果。
    ///
    /// # 示例
    ///
    /// ```
    /// let x = 3.5_f64;
    /// let y = -3.5_f64;
    ///
    /// assert_eq!(x.abs(), x);
    /// assert_eq!(y.abs(), -y);
    ///
    /// assert!(f64::NAN.abs().is_nan());
    /// ```
    #[must_use = "method returns a new number and does not mutate the original value"]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_float_methods", since = "1.85.0")]
    #[inline]
    pub const fn abs(self) -> f64 {
        intrinsics::fabs(self)
    }

    /// Returns a number that represents the sign of `self`.
    ///
    /// - `1.0` if the number is positive, `+0.0` or `INFINITY`
    /// - `-1.0` if the number is negative, `-0.0` or `NEG_INFINITY`
    /// - NaN 如果数字为 NaN
    ///
    /// # 示例
    ///
    /// ```
    /// let f = 3.5_f64;
    ///
    /// assert_eq!(f.signum(), 1.0);
    /// assert_eq!(f64::NEG_INFINITY.signum(), -1.0);
    ///
    /// assert!(f64::NAN.signum().is_nan());
    /// ```
    #[must_use = "method returns a new number and does not mutate the original value"]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_float_methods", since = "1.85.0")]
    #[inline]
    pub const fn signum(self) -> f64 {
        if self.is_nan() { Self::NAN } else { 1.0_f64.copysign(self) }
    }

    /// Returns a number composed of the magnitude of `self` and the sign of
    /// `sign`.
    ///
    /// Equal to `self` if the sign of `self` and `sign` are the same, otherwise equal to `-self`.
    /// If `self` is a NaN, then a NaN with the same payload as `self` and the sign bit of `sign` is
    /// 返回。
    ///
    /// If `sign` is a NaN, then this operation will still carry over its sign into the result. Note
    /// IEEE 754 在 NaN 情况下不赋予符号位任何意义，且由于 Rust
    /// doesn't guarantee that the bit pattern of NaNs are conserved over arithmetic operations, the
    /// result of `copysign` with `sign` being a NaN might produce an unexpected or non-portable
    /// result. See the [specification of NaN bit patterns](primitive@f32#nan-bit-patterns) for more
    /// info.
    ///
    /// # Examples
    ///
    /// ```
    /// let f = 3.5_f64;
    ///
    /// assert_eq!(f.copysign(0.42), 3.5_f64);
    /// assert_eq!(f.copysign(-0.42), -3.5_f64);
    /// assert_eq!((-f).copysign(0.42), 3.5_f64);
    /// assert_eq!((-f).copysign(-0.42), -3.5_f64);
    ///
    /// assert!(f64::NAN.copysign(1.0).is_nan());
    /// ```
    #[must_use = "method returns a new number and does not mutate the original value"]
    #[stable(feature = "copysign", since = "1.35.0")]
    #[rustc_const_stable(feature = "const_float_methods", since = "1.85.0")]
    #[inline]
    pub const fn copysign(self, sign: f64) -> f64 {
        intrinsics::copysign(self, sign)
    }

    /// Calculates `self * 2.powi(exponent)` efficiently and accurately.
    ///
    /// This operation is faster than [`powi`] and does not run into floating point precision
    /// issues, so it can be better to use than `2.0.powi(n)` or `x.exp2()` with integral values.
    ///
    /// This function has the following behavior in edge cases:
    ///
    /// * `(±0.0).scalbn(n)` returns the zero unchanged
    /// * `(±∞).scalbn(n)` returns the infinity unchanged
    /// * `NaN.scalbn(n)` returns a NaN
    /// * `x.scalbn(0)` returns x
    ///
    /// This function always returns the precise result.
    ///
    /// ```
    /// #![feature(float_exponent_methods)]
    ///
    /// assert_eq!(3.0_f64.scalbn(4), 48_f64); // = 3 * 2.powi(4) = 48
    /// assert_eq!(3.0_f64.scalbn(-1), 1.5_f64); // = 3 * 2.powi(-1) = 1.5
    ///
    /// assert_eq!(0.0_f64.scalbn(4), 0.0_f64);
    /// assert_eq!(4.0_f64.scalbn(0), 4.0_f64);
    ///
    /// assert_eq!(f64::INFINITY.scalbn(4), f64::INFINITY);
    /// assert_eq!(f64::NEG_INFINITY.scalbn(4), f64::NEG_INFINITY);
    ///
    /// assert!(f64::NAN.scalbn(4).is_nan());
    /// ```
    ///
    /// [`powi`]: ../std/primitive.f64.html#method.powi
    #[inline]
    #[doc(alias = "ldexp")]
    #[unstable(feature = "float_exponent_methods", issue = "163184")]
    #[rustc_const_unstable(feature = "float_exponent_methods", issue = "163184")]
    #[must_use = "method returns a new number and does not mutate the original value"]
    pub const fn scalbn(self, exponent: i32) -> f64 {
        intrinsics::scalbn(self, exponent)
    }

    /// Extract the unbiased exponent of the input value, ignoring the sign.
    ///
    /// Returns `None` when `self` is NaN, [`i32::MIN`] when `self` is zero,
    /// and [`i32::MAX`] when `self` is an infinity.
    ///
    /// For non-NaN values this will be close to `x.abs().log2() as i32` (typically within one),
    /// though due to imprecision of `log2` this may not always be the case.
    ///
    /// ```
    /// #![feature(float_exponent_methods)]
    ///
    /// assert_eq!(8.0_f64.ilogb(), Some(3));
    /// assert_eq!((-8.0_f64).ilogb(), Some(3));
    ///
    /// assert_eq!(15.0_f64.ilogb(), Some(3));
    /// assert_eq!(16.0_f64.ilogb(), Some(4));
    ///
    /// assert_eq!(0.5_f64.ilogb(), Some(-1));
    ///
    /// assert_eq!(f64::INFINITY.ilogb(), Some(i32::MAX));
    /// assert_eq!(0.0_f64.ilogb(), Some(i32::MIN));
    /// assert_eq!(f64::NAN.ilogb(), None);
    /// ```
    #[inline]
    #[unstable(feature = "float_exponent_methods", issue = "163184")]
    #[rustc_const_unstable(feature = "float_exponent_methods", issue = "163184")]
    #[must_use = "this returns the result of the operation, without modifying the original"]
    pub const fn ilogb(self) -> Option<i32> {
        if self.is_nan() {
            None
        } else if self == 0.0 {
            Some(i32::MIN)
        } else {
            // SAFETY: the input is not zero or NaN.
            Some(unsafe { intrinsics::ilogb(self) })
        }
    }

    /// 允许基于代数规则进行优化的浮点数加法。
    ///
    /// See [algebraic operators](primitive@f32#algebraic-operators) for more info.
    #[must_use = "method returns a new number and does not mutate the original value"]
    #[stable(feature = "float_algebraic", since = "1.98.0")]
    #[rustc_const_stable(feature = "float_algebraic", since = "1.98.0")]
    #[inline]
    pub const fn algebraic_add(self, rhs: f64) -> f64 {
        intrinsics::fadd_algebraic(self, rhs)
    }

    /// 允许基于代数规则进行优化的浮点数减法。
    ///
    /// See [algebraic operators](primitive@f32#algebraic-operators) for more info.
    #[must_use = "method returns a new number and does not mutate the original value"]
    #[stable(feature = "float_algebraic", since = "1.98.0")]
    #[rustc_const_stable(feature = "float_algebraic", since = "1.98.0")]
    #[inline]
    pub const fn algebraic_sub(self, rhs: f64) -> f64 {
        intrinsics::fsub_algebraic(self, rhs)
    }

    /// 允许基于代数规则进行优化的浮点数乘法。
    ///
    /// See [algebraic operators](primitive@f32#algebraic-operators) for more info.
    #[must_use = "method returns a new number and does not mutate the original value"]
    #[stable(feature = "float_algebraic", since = "1.98.0")]
    #[rustc_const_stable(feature = "float_algebraic", since = "1.98.0")]
    #[inline]
    pub const fn algebraic_mul(self, rhs: f64) -> f64 {
        intrinsics::fmul_algebraic(self, rhs)
    }

    /// 允许基于代数规则进行优化的浮点数除法。
    ///
    /// See [algebraic operators](primitive@f32#algebraic-operators) for more info.
    #[must_use = "method returns a new number and does not mutate the original value"]
    #[stable(feature = "float_algebraic", since = "1.98.0")]
    #[rustc_const_stable(feature = "float_algebraic", since = "1.98.0")]
    #[inline]
    pub const fn algebraic_div(self, rhs: f64) -> f64 {
        intrinsics::fdiv_algebraic(self, rhs)
    }

    /// 允许基于代数规则进行优化的浮点数余数。
    ///
    /// See [algebraic operators](primitive@f32#algebraic-operators) for more info.
    #[must_use = "method returns a new number and does not mutate the original value"]
    #[stable(feature = "float_algebraic", since = "1.98.0")]
    #[rustc_const_stable(feature = "float_algebraic", since = "1.98.0")]
    #[inline]
    pub const fn algebraic_rem(self, rhs: f64) -> f64 {
        intrinsics::frem_algebraic(self, rhs)
    }

    /// Computes `(self * a) + b` with nondeterministic rounding.
    ///
    /// This is similar to [`mul_add`], but the intermediate result may be
    /// 要么作为单个融合乘法加法指令执行，要么作为
    /// 单独的乘法和加法指令执行。
    /// 采用哪种方式取决于目标平台、优化级别和周围代码，因此不可预知且非确定：
    ///
    /// 结果可能因目标、优化级别和周围代码的不同而不同。
    /// 即使对相同输入调用两次该操作，也可能产生不同的结果。
    /// # 精度
    /// produce different results.
    ///
    /// # 示例
    ///
    /// The result of this operation is not guaranteed: it is either the result
    /// of [`mul_add`] (one rounding of the infinite-precision result) or of
    /// `self * a + b` (two roundings, with an intermediate rounding of the
    /// product).
    ///
    /// # _此模块中的独立函数仅用于测试。
    ///
    /// ```
    /// #![feature(float_mul_add_relaxed)]
    ///
    /// // When the fused and unfused operations round differently, either
    /// // result may be returned:
    /// // - 9.020562075079397e-19 is the fused result (one rounding)
    /// // - 1.734723475976807e-18 is the unfused result (two roundings)
    /// # // FIXME(#114479): on `i586`, x87 excess precision gives neither allowed result
    /// # #[cfg(not(all(target_arch = "x86", not(target_feature = "sse2"))))] {
    /// let r = 0.1_f64.mul_add_relaxed(0.1_f64, -0.01_f64);
    /// assert!(r == 9.020562075079397e-19 || r == 1.734723475976807e-18);
    /// # }
    /// ```
    ///
    /// [`mul_add`]: ../std/primitive.f64.html#method.mul_add
    #[must_use = "method returns a new number and does not mutate the original value"]
    #[doc(alias = "fmuladd")]
    #[unstable(feature = "float_mul_add_relaxed", issue = "151770")]
    #[inline]
    pub const fn mul_add_relaxed(self, a: f64, b: f64) -> f64 {
        intrinsics::fmuladd(self, a, b)
    }

    /// Returns `self` if the value is not NaN, otherwise returns `replacement`
    /// if `self` is NaN.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(float_nan_to)]
    ///
    /// let n = f64::NAN;
    /// let x = 2.0f64;
    /// let y = f64::INFINITY;
    ///
    /// assert_eq!(n.nan_to(0.0f64), 0.0f64);
    /// assert_eq!(x.nan_to(0.0f64), 2.0f64);
    /// assert_eq!(y.nan_to(0.0f64), f64::INFINITY);
    /// ```
    #[must_use = "method returns a new float and does not mutate the original value"]
    #[unstable(feature = "float_nan_to", issue = "161248")]
    #[rustc_const_unstable(feature = "float_nan_to", issue = "161248")]
    #[inline]
    pub const fn nan_to(self, replacement: f64) -> f64 {
        if self.is_nan() { replacement } else { self }
    }
}

#[unstable(feature = "core_float_math", issue = "137578")]
/// Experimental implementations of floating point functions in `core`.
///
/// _此模块中的独立函数仅用于测试。
/// 它们将作为固有方法稳定化。
pub mod math {
    use crate::intrinsics;
    use crate::num::imp::libm;

    /// Experimental version of `floor` in `core`. See [`f64::floor`] for details.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(core_float_math)]
    ///
    /// use core::f64;
    ///
    /// let f = 3.7_f64;
    /// let g = 3.0_f64;
    /// let h = -3.7_f64;
    ///
    /// assert_eq!(f64::math::floor(f), 3.0);
    /// assert_eq!(f64::math::floor(g), 3.0);
    /// assert_eq!(f64::math::floor(h), -4.0);
    /// ```
    ///
    /// _此独立函数仅用于测试。
    /// 它将作为固有方法稳定化。
    ///
    /// [`f64::floor`]: ../../../std/primitive.f64.html#method.floor
    #[inline]
    #[unstable(feature = "core_float_math", issue = "137578")]
    #[must_use = "method returns a new number and does not mutate the original value"]
    pub const fn floor(x: f64) -> f64 {
        intrinsics::floor(x)
    }

    /// Experimental version of `ceil` in `core`. See [`f64::ceil`] for details.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(core_float_math)]
    ///
    /// use core::f64;
    ///
    /// let f = 3.01_f64;
    /// let g = 4.0_f64;
    ///
    /// assert_eq!(f64::math::ceil(f), 4.0);
    /// assert_eq!(f64::math::ceil(g), 4.0);
    /// ```
    ///
    /// _此独立函数仅用于测试。
    /// 它将作为固有方法稳定化。
    ///
    /// [`f64::ceil`]: ../../../std/primitive.f64.html#method.ceil
    #[inline]
    #[doc(alias = "ceiling")]
    #[unstable(feature = "core_float_math", issue = "137578")]
    #[must_use = "method returns a new number and does not mutate the original value"]
    pub const fn ceil(x: f64) -> f64 {
        intrinsics::ceil(x)
    }

    /// Experimental version of `round` in `core`. See [`f64::round`] for details.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(core_float_math)]
    ///
    /// use core::f64;
    ///
    /// let f = 3.3_f64;
    /// let g = -3.3_f64;
    /// let h = -3.7_f64;
    /// let i = 3.5_f64;
    /// let j = 4.5_f64;
    ///
    /// assert_eq!(f64::math::round(f), 3.0);
    /// assert_eq!(f64::math::round(g), -3.0);
    /// assert_eq!(f64::math::round(h), -4.0);
    /// assert_eq!(f64::math::round(i), 4.0);
    /// assert_eq!(f64::math::round(j), 5.0);
    /// ```
    ///
    /// _此独立函数仅用于测试。
    /// 它将作为固有方法稳定化。
    ///
    /// [`f64::round`]: ../../../std/primitive.f64.html#method.round
    #[inline]
    #[unstable(feature = "core_float_math", issue = "137578")]
    #[must_use = "method returns a new number and does not mutate the original value"]
    pub const fn round(x: f64) -> f64 {
        intrinsics::round(x)
    }

    /// Experimental version of `round_ties_even` in `core`. See [`f64::round_ties_even`] for
    /// details.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(core_float_math)]
    ///
    /// use core::f64;
    ///
    /// let f = 3.3_f64;
    /// let g = -3.3_f64;
    /// let h = 3.5_f64;
    /// let i = 4.5_f64;
    ///
    /// assert_eq!(f64::math::round_ties_even(f), 3.0);
    /// assert_eq!(f64::math::round_ties_even(g), -3.0);
    /// assert_eq!(f64::math::round_ties_even(h), 4.0);
    /// assert_eq!(f64::math::round_ties_even(i), 4.0);
    /// ```
    ///
    /// _此独立函数仅用于测试。
    /// 它将作为内置方法得到稳定化。_
    ///
    /// [`f64::round_ties_even`]: ../../../std/primitive.f64.html#method.round_ties_even
    #[inline]
    #[unstable(feature = "core_float_math", issue = "137578")]
    #[must_use = "method returns a new number and does not mutate the original value"]
    pub const fn round_ties_even(x: f64) -> f64 {
        intrinsics::round_ties_even(x)
    }

    /// Experimental version of `trunc` in `core`. See [`f64::trunc`] for details.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(core_float_math)]
    ///
    /// use core::f64;
    ///
    /// let f = 3.7_f64;
    /// let g = 3.0_f64;
    /// let h = -3.7_f64;
    ///
    /// assert_eq!(f64::math::trunc(f), 3.0);
    /// assert_eq!(f64::math::trunc(g), 3.0);
    /// assert_eq!(f64::math::trunc(h), -3.0);
    /// ```
    ///
    /// _此独立函数仅用于测试。
    /// 它将作为内置方法得到稳定化。_
    ///
    /// [`f64::trunc`]: ../../../std/primitive.f64.html#method.trunc
    #[inline]
    #[doc(alias = "truncate")]
    #[unstable(feature = "core_float_math", issue = "137578")]
    #[must_use = "method returns a new number and does not mutate the original value"]
    pub const fn trunc(x: f64) -> f64 {
        intrinsics::trunc(x)
    }

    /// Experimental version of `fract` in `core`. See [`f64::fract`] for details.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(core_float_math)]
    ///
    /// use core::f64;
    ///
    /// let x = 3.6_f64;
    /// let y = -3.6_f64;
    /// let abs_difference_x = (f64::math::fract(x) - 0.6).abs();
    /// let abs_difference_y = (f64::math::fract(y) - (-0.6)).abs();
    ///
    /// assert!(abs_difference_x < 1e-10);
    /// assert!(abs_difference_y < 1e-10);
    /// ```
    ///
    /// _此独立函数仅用于测试。
    /// 它将作为内置方法得到稳定化。_
    ///
    /// [`f64::fract`]: ../../../std/primitive.f64.html#method.fract
    #[inline]
    #[unstable(feature = "core_float_math", issue = "137578")]
    #[must_use = "method returns a new number and does not mutate the original value"]
    pub const fn fract(x: f64) -> f64 {
        x - trunc(x)
    }

    /// Experimental version of `mul_add` in `core`. See [`f64::mul_add`] for details.
    ///
    /// # 示例
    ///
    /// ```
    /// # #![allow(unused_features)]
    /// #![feature(core_float_math)]
    ///
    /// # // FIXME(#140515): mingw has an incorrect fma
    /// # // https://sourceforge.net/p/mingw-w64/bugs/848/
    /// # #[cfg(all(target_os = "windows", target_env = "gnu", not(target_abi = "llvm")))] {
    /// use core::f64;
    ///
    /// let m = 10.0_f64;
    /// let x = 4.0_f64;
    /// let b = 60.0_f64;
    ///
    /// assert_eq!(f64::math::mul_add(m, x, b), 100.0);
    /// assert_eq!(m * x + b, 100.0);
    ///
    /// let one_plus_eps = 1.0_f64 + f64::EPSILON;
    /// let one_minus_eps = 1.0_f64 - f64::EPSILON;
    /// let minus_one = -1.0_f64;
    ///
    /// // The exact result (1 + eps) * (1 - eps) = 1 - eps * eps.
    /// assert_eq!(
    ///     f64::math::mul_add(one_plus_eps, one_minus_eps, minus_one),
    ///     -f64::EPSILON * f64::EPSILON
    /// );
    /// // Different rounding with the non-fused multiply and add.
    /// assert_eq!(one_plus_eps * one_minus_eps + minus_one, 0.0);
    /// # }
    /// ```
    ///
    /// _此独立函数仅用于测试。
    /// 它将作为内置方法得到稳定化。_
    ///
    /// [`f64::mul_add`]: ../../../std/primitive.f64.html#method.mul_add
    #[inline]
    #[doc(alias = "fma", alias = "fusedMultiplyAdd")]
    #[unstable(feature = "core_float_math", issue = "137578")]
    #[must_use = "method returns a new number and does not mutate the original value"]
    pub const fn mul_add(x: f64, a: f64, b: f64) -> f64 {
        intrinsics::fma(x, a, b)
    }

    /// Experimental version of `div_euclid` in `core`. See [`f64::div_euclid`] for details.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(core_float_math)]
    ///
    /// use core::f64;
    ///
    /// let a: f64 = 7.0;
    /// let b = 4.0;
    /// assert_eq!(f64::math::div_euclid(a, b), 1.0); // 7.0 > 4.0 * 1.0
    /// assert_eq!(f64::math::div_euclid(-a, b), -2.0); // -7.0 >= 4.0 * -2.0
    /// assert_eq!(f64::math::div_euclid(a, -b), -1.0); // 7.0 >= -4.0 * -1.0
    /// assert_eq!(f64::math::div_euclid(-a, -b), 2.0); // -7.0 >= -4.0 * 2.0
    /// ```
    ///
    /// _此独立函数仅用于测试。
    /// 它将作为内置方法得到稳定化。_
    ///
    /// [`f64::div_euclid`]: ../../../std/primitive.f64.html#method.div_euclid
    #[inline]
    #[unstable(feature = "core_float_math", issue = "137578")]
    #[must_use = "method returns a new number and does not mutate the original value"]
    pub fn div_euclid(x: f64, rhs: f64) -> f64 {
        let q = trunc(x / rhs);
        if x % rhs < 0.0 {
            return if rhs > 0.0 { q - 1.0 } else { q + 1.0 };
        }
        q
    }

    /// Experimental version of `rem_euclid` in `core`. See [`f64::rem_euclid`] for details.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(core_float_math)]
    ///
    /// use core::f64;
    ///
    /// let a: f64 = 7.0;
    /// let b = 4.0;
    /// assert_eq!(f64::math::rem_euclid(a, b), 3.0);
    /// assert_eq!(f64::math::rem_euclid(-a, b), 1.0);
    /// assert_eq!(f64::math::rem_euclid(a, -b), 3.0);
    /// assert_eq!(f64::math::rem_euclid(-a, -b), 1.0);
    /// // limitation due to round-off error
    /// assert!(f64::math::rem_euclid(-f64::EPSILON, 3.0) != 0.0);
    /// ```
    ///
    /// _此独立函数仅用于测试。
    /// 它将作为内置方法得到稳定化。_
    ///
    /// [`f64::rem_euclid`]: ../../../std/primitive.f64.html#method.rem_euclid
    #[inline]
    #[doc(alias = "modulo", alias = "mod")]
    #[unstable(feature = "core_float_math", issue = "137578")]
    #[must_use = "method returns a new number and does not mutate the original value"]
    pub fn rem_euclid(x: f64, rhs: f64) -> f64 {
        let r = x % rhs;
        if r < 0.0 { r + rhs.abs() } else { r }
    }

    /// Experimental version of `powi` in `core`. See [`f64::powi`] for details.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(core_float_math)]
    ///
    /// use core::f64;
    ///
    /// let x = 2.0_f64;
    /// let abs_difference = (f64::math::powi(x, 2) - (x * x)).abs();
    /// assert!(abs_difference <= 1e-6);
    ///
    /// assert_eq!(f64::math::powi(f64::NAN, 0), 1.0);
    /// ```
    ///
    /// _此独立函数仅用于测试。
    /// 它将作为内置方法得到稳定化。_
    ///
    /// [`f64::powi`]: ../../../std/primitive.f64.html#method.powi
    #[inline]
    #[unstable(feature = "core_float_math", issue = "137578")]
    #[must_use = "method returns a new number and does not mutate the original value"]
    pub fn powi(x: f64, n: i32) -> f64 {
        intrinsics::powi(x, n)
    }

    /// Experimental version of `sqrt` in `core`. See [`f64::sqrt`] for details.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(core_float_math)]
    ///
    /// use core::f64;
    ///
    /// let positive = 4.0_f64;
    /// let negative = -4.0_f64;
    /// let negative_zero = -0.0_f64;
    ///
    /// assert_eq!(f64::math::sqrt(positive), 2.0);
    /// assert!(f64::math::sqrt(negative).is_nan());
    /// assert_eq!(f64::math::sqrt(negative_zero), negative_zero);
    /// ```
    ///
    /// _此独立函数仅用于测试。
    /// 它将作为内置方法得到稳定化。_
    ///
    /// [`f64::sqrt`]: ../../../std/primitive.f64.html#method.sqrt
    #[inline]
    #[doc(alias = "squareRoot")]
    #[unstable(feature = "core_float_math", issue = "137578")]
    #[must_use = "method returns a new number and does not mutate the original value"]
    pub fn sqrt(x: f64) -> f64 {
        intrinsics::sqrt(x)
    }

    /// Experimental version of `abs_sub` in `core`. See [`f64::abs_sub`] for details.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(core_float_math)]
    ///
    /// use core::f64;
    ///
    /// let x = 3.0_f64;
    /// let y = -3.0_f64;
    ///
    /// let abs_difference_x = (f64::math::abs_sub(x, 1.0) - 2.0).abs();
    /// let abs_difference_y = (f64::math::abs_sub(y, 1.0) - 0.0).abs();
    ///
    /// assert!(abs_difference_x < 1e-10);
    /// assert!(abs_difference_y < 1e-10);
    /// ```
    ///
    /// _此独立函数仅用于测试。
    /// 它将作为内置方法得到稳定化。_
    ///
    /// [`f64::abs_sub`]: ../../../std/primitive.f64.html#method.abs_sub
    #[inline]
    #[unstable(feature = "core_float_math", issue = "137578")]
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
    #[must_use = "method returns a new number and does not mutate the original value"]
    pub fn abs_sub(x: f64, other: f64) -> f64 {
        libm::fdim(x, other)
    }

    /// Experimental version of `cbrt` in `core`. See [`f64::cbrt`] for details.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(core_float_math)]
    ///
    /// use core::f64;
    ///
    /// let x = 8.0_f64;
    ///
    /// // x^(1/3) - 2 == 0
    /// let abs_difference = (f64::math::cbrt(x) - 2.0).abs();
    ///
    /// assert!(abs_difference < 1e-10);
    /// ```
    ///
    /// _此独立函数仅用于测试。
    /// 它将作为内置方法得到稳定化。_
    ///
    /// [`f64::cbrt`]: ../../../std/primitive.f64.html#method.cbrt
    #[inline]
    #[unstable(feature = "core_float_math", issue = "137578")]
    #[must_use = "method returns a new number and does not mutate the original value"]
    pub fn cbrt(x: f64) -> f64 {
        libm::cbrt(x)
    }
}
