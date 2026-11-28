//! Constants for the `f128` quadruple-precision floating point type.
//!
//! *[See also the `f128` primitive type][f128].*
//!
//! Mathematically significant numbers are provided in the `consts` sub-module.
//!
//! 对于直接在此模块中定义的常量
//! (as distinct from those defined in the `consts` sub-module),
//! new code should instead use the associated constants
//! defined directly on the `f128` type.

#![unstable(feature = "f128", issue = "116909")]
#![expect(clippy::approx_constant, reason = "this module defines f128 constants")]

use crate::convert::{FloatToFloat, FloatToInt};
use crate::num::FpCategory;
use crate::num::float_macros::float_impl;
use crate::panic::const_assert;
use crate::{intrinsics, mem};

/// 基本数学常量。
#[unstable(feature = "f128", issue = "116909")]
#[rustc_diagnostic_item = "f128_consts_mod"]
pub mod consts {
    // FIXME: replace with mathematical constants from cmath.

    /// 阿基米德常数 (π)
    #[unstable(feature = "f128", issue = "116909")]
    pub const PI: f128 = 3.14159265358979323846264338327950288419716939937510582097494_f128;

    /// 完整圆常数 (τ)
    ///
    /// 等于 2π。
    #[unstable(feature = "f128", issue = "116909")]
    pub const TAU: f128 = 6.28318530717958647692528676655900576839433879875021164194989_f128;

    /// 黄金比例 (φ)
    #[doc(alias = "phi")]
    #[unstable(feature = "f128", issue = "116909")]
    pub const GOLDEN_RATIO: f128 =
        1.61803398874989484820458683436563811772030917980576286213545_f128;

    /// 欧拉-马歇罗尼常数 (γ)
    #[unstable(feature = "f128", issue = "116909")]
    pub const EULER_GAMMA: f128 =
        0.577215664901532860606512090082402431042159335939923598805767_f128;

    /// π/2
    #[unstable(feature = "f128", issue = "116909")]
    pub const FRAC_PI_2: f128 = 1.57079632679489661923132169163975144209858469968755291048747_f128;

    /// π/3
    #[unstable(feature = "f128", issue = "116909")]
    pub const FRAC_PI_3: f128 = 1.04719755119659774615421446109316762806572313312503527365831_f128;

    /// π/4
    #[unstable(feature = "f128", issue = "116909")]
    pub const FRAC_PI_4: f128 = 0.785398163397448309615660845819875721049292349843776455243736_f128;

    /// π/6
    #[unstable(feature = "f128", issue = "116909")]
    pub const FRAC_PI_6: f128 = 0.523598775598298873077107230546583814032861566562517636829157_f128;

    /// π/8
    #[unstable(feature = "f128", issue = "116909")]
    pub const FRAC_PI_8: f128 = 0.392699081698724154807830422909937860524646174921888227621868_f128;

    /// 1/π
    #[unstable(feature = "f128", issue = "116909")]
    pub const FRAC_1_PI: f128 = 0.318309886183790671537767526745028724068919291480912897495335_f128;

    /// 1/sqrt(π)
    #[unstable(feature = "f128", issue = "116909")]
    // Also, #[unstable(feature = "more_float_constants", issue = "146939")]
    pub const FRAC_1_SQRT_PI: f128 =
        0.564189583547756286948079451560772585844050629328998856844086_f128;

    /// 1/sqrt(2π)
    #[doc(alias = "FRAC_1_SQRT_TAU")]
    #[unstable(feature = "f128", issue = "116909")]
    // Also, #[unstable(feature = "more_float_constants", issue = "146939")]
    pub const FRAC_1_SQRT_2PI: f128 =
        0.398942280401432677939946059934381868475858631164934657665926_f128;

    /// 2/π
    #[unstable(feature = "f128", issue = "116909")]
    pub const FRAC_2_PI: f128 = 0.636619772367581343075535053490057448137838582961825794990669_f128;

    /// 2/sqrt(π)
    #[unstable(feature = "f128", issue = "116909")]
    pub const FRAC_2_SQRT_PI: f128 =
        1.12837916709551257389615890312154517168810125865799771368817_f128;

    /// sqrt(2)
    #[unstable(feature = "f128", issue = "116909")]
    pub const SQRT_2: f128 = 1.41421356237309504880168872420969807856967187537694807317668_f128;

    /// 1/sqrt(2)
    #[unstable(feature = "f128", issue = "116909")]
    pub const FRAC_1_SQRT_2: f128 =
        0.707106781186547524400844362104849039284835937688474036588340_f128;

    /// sqrt(3)
    #[unstable(feature = "f128", issue = "116909")]
    // Also, #[unstable(feature = "more_float_constants", issue = "146939")]
    pub const SQRT_3: f128 = 1.73205080756887729352744634150587236694280525381038062805581_f128;

    /// 1/sqrt(3)
    #[unstable(feature = "f128", issue = "116909")]
    // Also, #[unstable(feature = "more_float_constants", issue = "146939")]
    pub const FRAC_1_SQRT_3: f128 =
        0.577350269189625764509148780501957455647601751270126876018602_f128;

    /// sqrt(5)
    #[unstable(feature = "more_float_constants", issue = "146939")]
    // Also, #[unstable(feature = "f128", issue = "116909")]
    pub const SQRT_5: f128 = 2.23606797749978969640917366873127623544061835961152572427089_f128;

    /// 1/sqrt(5)
    #[unstable(feature = "more_float_constants", issue = "146939")]
    // Also, #[unstable(feature = "f128", issue = "116909")]
    pub const FRAC_1_SQRT_5: f128 =
        0.447213595499957939281834733746255247088123671922305144854179_f128;

    /// 欧拉数 (e)
    #[unstable(feature = "f128", issue = "116909")]
    pub const E: f128 = 2.71828182845904523536028747135266249775724709369995957496697_f128;

    /// log<sub>2</sub>(10)
    #[unstable(feature = "f128", issue = "116909")]
    pub const LOG2_10: f128 = 3.32192809488736234787031942948939017586483139302458061205476_f128;

    /// log<sub>2</sub>(e)
    #[unstable(feature = "f128", issue = "116909")]
    pub const LOG2_E: f128 = 1.44269504088896340735992468100189213742664595415298593413545_f128;

    /// log<sub>10</sub>(2)
    #[unstable(feature = "f128", issue = "116909")]
    pub const LOG10_2: f128 = 0.301029995663981195213738894724493026768189881462108541310427_f128;

    /// log<sub>10</sub>(e)
    #[unstable(feature = "f128", issue = "116909")]
    pub const LOG10_E: f128 = 0.434294481903251827651128918916605082294397005803666566114454_f128;

    /// ln(2)
    #[unstable(feature = "f128", issue = "116909")]
    pub const LN_2: f128 = 0.693147180559945309417232121458176568075500134360255254120680_f128;

    /// ln(10)
    #[unstable(feature = "f128", issue = "116909")]
    pub const LN_10: f128 = 2.30258509299404568401799145468436420760110148862877297603333_f128;
}

#[doc(test(attr(
    feature(cfg_target_has_reliable_f16_f128),
    allow(internal_features, unused_features)
)))]
impl f128 {
    float_impl! {
        Self = f128,
        Bits = u128,
        SignedBits = i128,
        BITS = 128,
        MANTISSA_DIGITS = 113,
        DIGITS = 33,
        EPSILON = 1.92592994438723585305597794258492732e-34_f128,
        MIN = -1.18973149535723176508575932662800702e+4932_f128,
        MIN_POSITIVE = 3.36210314311209350626267781732175260e-4932_f128,
        MAX = 1.18973149535723176508575932662800702e+4932_f128,
        MIN_EXP = -16_381,
        MAX_EXP = 16_384,
        MIN_10_EXP = -4_931,
        MAX_10_EXP = 4_932,
        SIGN_MASK = 0x8000_0000_0000_0000_0000_0000_0000_0000,
        EXPONENT_MASK = 0x7fff_0000_0000_0000_0000_0000_0000_0000,
        MANTISSA_MASK = 0x0000_ffff_ffff_ffff_ffff_ffff_ffff_ffff,
        exponent_bias = 16383,
        assoc_int_consts = #[unstable(feature = "f128", issue = "116909")],
        float_bits_const = #[unstable(feature = "f128", issue = "116909")],
        feature = f128,
        has_reliable_cfg = target_has_reliable_f128,
        has_reliable_math_cfg = target_has_reliable_f128_math,
    }

    /// Returns `true` if this value is NaN.
    ///
    /// ```
    /// #![feature(f128)]
    /// # #[cfg(target_has_reliable_f128)] {
    ///
    /// let nan = f128::NAN;
    /// let f = 7.0_f128;
    ///
    /// assert!(nan.is_nan());
    /// assert!(!f.is_nan());
    /// # }
    /// ```
    #[inline]
    #[must_use]
    #[unstable(feature = "f128", issue = "116909")]
    #[allow(clippy::eq_op)] // > if you intended to check if the operand is NaN, use `.is_nan()` instead :)
    pub const fn is_nan(self) -> bool {
        self != self
    }

    /// Returns `true` if this value is positive infinity or negative infinity, and
    /// `false` otherwise.
    ///
    /// ```
    /// #![feature(f128)]
    /// # #[cfg(target_has_reliable_f128)] {
    ///
    /// let f = 7.0f128;
    /// let inf = f128::INFINITY;
    /// let neg_inf = f128::NEG_INFINITY;
    /// let nan = f128::NAN;
    ///
    /// assert!(!f.is_infinite());
    /// assert!(!nan.is_infinite());
    ///
    /// assert!(inf.is_infinite());
    /// assert!(neg_inf.is_infinite());
    /// # }
    /// ```
    #[inline]
    #[must_use]
    #[unstable(feature = "f128", issue = "116909")]
    pub const fn is_infinite(self) -> bool {
        (self == f128::INFINITY) | (self == f128::NEG_INFINITY)
    }

    /// Returns `true` if this number is neither infinite nor NaN.
    ///
    /// ```
    /// #![feature(f128)]
    /// # #[cfg(target_has_reliable_f128)] {
    ///
    /// let f = 7.0f128;
    /// let inf: f128 = f128::INFINITY;
    /// let neg_inf: f128 = f128::NEG_INFINITY;
    /// let nan: f128 = f128::NAN;
    ///
    /// assert!(f.is_finite());
    ///
    /// assert!(!nan.is_finite());
    /// assert!(!inf.is_finite());
    /// assert!(!neg_inf.is_finite());
    /// # }
    /// ```
    #[inline]
    #[must_use]
    #[unstable(feature = "f128", issue = "116909")]
    #[rustc_const_unstable(feature = "f128", issue = "116909")]
    pub const fn is_finite(self) -> bool {
        // There's no need to handle NaN separately: if self is NaN,
        // the comparison is not true, exactly as desired.
        self.abs() < Self::INFINITY
    }

    /// Returns `true` if the number is [subnormal].
    ///
    /// ```
    /// #![feature(f128)]
    /// # #[cfg(target_has_reliable_f128)] {
    ///
    /// let min = f128::MIN_POSITIVE; // 3.362103143e-4932f128
    /// let max = f128::MAX;
    /// let lower_than_min = 1.0e-4960_f128;
    /// let zero = 0.0_f128;
    ///
    /// assert!(!min.is_subnormal());
    /// assert!(!max.is_subnormal());
    ///
    /// assert!(!zero.is_subnormal());
    /// assert!(!f128::NAN.is_subnormal());
    /// assert!(!f128::INFINITY.is_subnormal());
    /// // Values between `0` and `min` are Subnormal.
    /// assert!(lower_than_min.is_subnormal());
    /// # }
    /// ```
    ///
    /// [subnormal]: https://en.wikipedia.org/wiki/Denormal_number
    #[inline]
    #[must_use]
    #[unstable(feature = "f128", issue = "116909")]
    pub const fn is_subnormal(self) -> bool {
        matches!(self.classify(), FpCategory::Subnormal)
    }

    /// Returns `true` if the number is neither zero, infinite, [subnormal], or NaN.
    ///
    /// ```
    /// #![feature(f128)]
    /// # #[cfg(target_has_reliable_f128)] {
    ///
    /// let min = f128::MIN_POSITIVE; // 3.362103143e-4932f128
    /// let max = f128::MAX;
    /// let lower_than_min = 1.0e-4960_f128;
    /// let zero = 0.0_f128;
    ///
    /// assert!(min.is_normal());
    /// assert!(max.is_normal());
    ///
    /// assert!(!zero.is_normal());
    /// assert!(!f128::NAN.is_normal());
    /// assert!(!f128::INFINITY.is_normal());
    /// // Values between `0` and `min` are Subnormal.
    /// assert!(!lower_than_min.is_normal());
    /// # }
    /// ```
    ///
    /// [subnormal]: https://en.wikipedia.org/wiki/Denormal_number
    #[inline]
    #[must_use]
    #[unstable(feature = "f128", issue = "116909")]
    pub const fn is_normal(self) -> bool {
        matches!(self.classify(), FpCategory::Normal)
    }

    /// 返回该数的浮点类别。如果仅有一个属性
    /// 将被测试，通常使用特定的
    /// 谓词会更快。
    ///
    /// ```
    /// #![feature(f128)]
    /// # #[cfg(target_has_reliable_f128)] {
    ///
    /// use std::num::FpCategory;
    ///
    /// let num = 12.4_f128;
    /// let inf = f128::INFINITY;
    ///
    /// assert_eq!(num.classify(), FpCategory::Normal);
    /// assert_eq!(inf.classify(), FpCategory::Infinite);
    /// # }
    /// ```
    #[inline]
    #[unstable(feature = "f128", issue = "116909")]
    #[must_use]
    pub const fn classify(self) -> FpCategory {
        let bits = self.to_bits();
        match (bits & Self::MANTISSA_MASK, bits & Self::EXPONENT_MASK) {
            (0, Self::EXPONENT_MASK) => FpCategory::Infinite,
            (_, Self::EXPONENT_MASK) => FpCategory::Nan,
            (0, 0) => FpCategory::Zero,
            (_, 0) => FpCategory::Subnormal,
            _ => FpCategory::Normal,
        }
    }

    /// Returns `true` if `self` has a positive sign, including `+0.0`, NaNs with
    /// positive sign bit and positive infinity.
    ///
    /// 注意，IEEE 754 在出现
    /// a NaN, and as Rust doesn't guarantee that the bit pattern of NaNs are
    /// conserved over arithmetic operations, the result of `is_sign_positive` on
    /// a NaN might produce an unexpected or non-portable result. See the [specification
    /// of NaN bit patterns](f32#nan-bit-patterns) for more info. Use `self.signum() == 1.0`
    /// if you need fully portable behavior (evaluates to `false` for all NaNs).
    ///
    /// ```
    /// #![feature(f128)]
    ///
    /// let f = 7.0_f128;
    /// let g = -7.0_f128;
    ///
    /// assert!(f.is_sign_positive());
    /// assert!(!g.is_sign_positive());
    /// ```
    #[inline]
    #[must_use]
    #[unstable(feature = "f128", issue = "116909")]
    pub const fn is_sign_positive(self) -> bool {
        !self.is_sign_negative()
    }

    /// Returns `true` if `self` has a negative sign, including `-0.0`, NaNs with
    /// negative sign bit and negative infinity.
    ///
    /// Note that IEEE 754 doesn't assign any meaning to the sign bit in case of
    /// a NaN, and as Rust doesn't guarantee that the bit pattern of NaNs are
    /// conserved over arithmetic operations, the result of `is_sign_negative` on
    /// a NaN might produce an unexpected or non-portable result. See the [specification
    /// of NaN bit patterns](f32#nan-bit-patterns) for more info. Use `self.signum() == -1.0`
    /// if you need fully portable behavior (evaluates to `false` for all NaNs).
    ///
    /// ```
    /// #![feature(f128)]
    ///
    /// let f = 7.0_f128;
    /// let g = -7.0_f128;
    ///
    /// assert!(!f.is_sign_negative());
    /// assert!(g.is_sign_negative());
    /// ```
    #[inline]
    #[must_use]
    #[unstable(feature = "f128", issue = "116909")]
    pub const fn is_sign_negative(self) -> bool {
        // IEEE754 says: isSignMinus(x) is true if and only if x has negative sign. isSignMinus
        // applies to zeros and NaNs as well.
        // SAFETY: This is just transmuting to get the sign bit, it's fine.
        (self.to_bits() & (1 << 127)) != 0
    }

    /// Returns the least number greater than `self`.
    ///
    /// Let `TINY` be the smallest representable positive `f128`. Then,
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
    /// #![feature(f128)]
    /// # #[cfg(target_has_reliable_f128)] {
    ///
    /// // f128::EPSILON is the difference between 1.0 and the next number up.
    /// assert_eq!(1.0f128.next_up(), 1.0 + f128::EPSILON);
    /// // But not for most numbers.
    /// assert!(0.1f128.next_up() < 0.1 + f128::EPSILON);
    /// assert_eq!(4611686018427387904f128.next_up(), 4611686018427387904.000000000000001);
    /// # }
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
    #[unstable(feature = "f128", issue = "116909")]
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
    /// Let `TINY` be the smallest representable positive `f128`. Then,
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
    /// #![feature(f128)]
    /// # #[cfg(target_has_reliable_f128)] {
    ///
    /// let x = 1.0f128;
    /// // Clamp value into range [0, 1).
    /// let clamped = x.clamp(0.0, 1.0f128.next_down());
    /// assert!(clamped < 1.0);
    /// assert_eq!(clamped.next_up(), 1.0);
    /// # }
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
    #[unstable(feature = "f128", issue = "116909")]
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
    /// #![feature(f128)]
    /// # #[cfg(target_has_reliable_f128)] {
    ///
    /// let x = 2.0_f128;
    /// let abs_difference = (x.recip() - (1.0 / x)).abs();
    ///
    /// assert!(abs_difference <= f128::EPSILON);
    /// # }
    /// ```
    #[inline]
    #[unstable(feature = "f128", issue = "116909")]
    #[must_use = "this returns the result of the operation, without modifying the original"]
    pub const fn recip(self) -> Self {
        1.0 / self
    }

    /// 将弧度转换为度。
    ///
    /// # 未指定精度
    ///
    /// 此函数的精度是非确定性的。这意味着它因平台、
    /// Rust 版本以及同一执行中的不同调用而有所不同。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(f128)]
    /// # #[cfg(target_has_reliable_f128)] {
    ///
    /// let angle = std::f128::consts::PI;
    ///
    /// let abs_difference = (angle.to_degrees() - 180.0).abs();
    /// assert!(abs_difference <= f128::EPSILON);
    /// # }
    /// ```
    #[inline]
    #[unstable(feature = "f128", issue = "116909")]
    #[must_use = "this returns the result of the operation, without modifying the original"]
    pub const fn to_degrees(self) -> Self {
        // The division here is correctly rounded with respect to the true value of 180/π.
        // Although π is irrational and already rounded, the double rounding happens
        // to produce correct result for f128.
        const PIS_IN_180: f128 = 180.0 / consts::PI;
        self * PIS_IN_180
    }

    /// 将度转换为弧度。
    ///
    /// # 未指定精度
    ///
    /// 此函数的精度是非确定性的。这意味着它因平台、
    /// Rust 版本以及同一执行中的不同调用而有所不同。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(f128)]
    /// # #[cfg(target_has_reliable_f128)] {
    ///
    /// let angle = 180.0f128;
    ///
    /// let abs_difference = (angle.to_radians() - std::f128::consts::PI).abs();
    ///
    /// assert!(abs_difference <= 1e-30);
    /// # }
    /// ```
    #[inline]
    #[unstable(feature = "f128", issue = "116909")]
    #[must_use = "this returns the result of the operation, without modifying the original"]
    pub const fn to_radians(self) -> f128 {
        // Use a literal to avoid double rounding, consts::PI is already rounded,
        // and dividing would round again.
        const RADS_PER_DEG: f128 =
            0.0174532925199432957692369076848861271344287188854172545609719_f128;
        self * RADS_PER_DEG
    }

    /// 返回两个数中较大的值，忽略 NaN。
    ///
    /// 如果参数中恰好有一个是 NaN（静默或信号），则返回另一个参数。
    /// 如果两个参数都是 NaN，返回值也是 NaN，其位模式由
    /// using the usual [rules for arithmetic operations](f32#nan-bit-patterns). If the inputs
    /// compare equal (such as for the case of `+0.0` and `-0.0`), either input may be returned
    /// 返回。
    ///
    /// The handling of NaNs follows the IEEE 754-2019 semantics for `maximumNumber`, treating all
    /// NaN 的处理方式与确保运算可结合性相同。带符号零的处理方式如下
    /// follows the IEEE 754-2008 semantics for `maxNum`.
    ///
    /// ```
    /// #![feature(f128)]
    /// # #[cfg(any(miri, target_has_reliable_f128_math))] { // Miri uses softfloats, always works
    ///
    /// let x = 1.0f128;
    /// let y = 2.0f128;
    ///
    /// assert_eq!(x.max(y), y);
    /// assert_eq!(x.max(f128::NAN), x);
    /// # }
    /// ```
    #[inline]
    #[unstable(feature = "f128", issue = "116909")]
    #[rustc_const_unstable(feature = "f128", issue = "116909")]
    #[must_use = "this returns the result of the comparison, without modifying either input"]
    pub const fn max(self, other: f128) -> f128 {
        intrinsics::maximum_number_nsz(self, other)
    }

    /// 返回两个数字中的最小值，忽略 NaN
    ///
    /// 如果参数中恰好有一个是 NaN（静默或信号），则返回另一个参数
    /// 如果两个参数都是 NaN，返回值也是 NaN，其位模式由特定规则决定
    /// using the usual [rules for arithmetic operations](f32#nan-bit-patterns). If the inputs
    /// compare equal (such as for the case of `+0.0` and `-0.0`), either input may be returned
    /// 非确定性地
    ///
    /// The handling of NaNs follows the IEEE 754-2019 semantics for `minimumNumber`, treating all
    /// NaN 的处理方式与确保运算可结合性相同。带符号零的处理方式如下
    /// follows the IEEE 754-2008 semantics for `minNum`.
    ///
    /// ```
    /// #![feature(f128)]
    /// # #[cfg(any(miri, target_has_reliable_f128_math))] { // Miri uses softfloats, always works
    ///
    /// let x = 1.0f128;
    /// let y = 2.0f128;
    ///
    /// assert_eq!(x.min(y), x);
    /// assert_eq!(x.min(f128::NAN), x);
    /// # }
    /// ```
    #[inline]
    #[unstable(feature = "f128", issue = "116909")]
    #[rustc_const_unstable(feature = "f128", issue = "116909")]
    #[must_use = "this returns the result of the comparison, without modifying either input"]
    pub const fn min(self, other: f128) -> f128 {
        intrinsics::minimum_number_nsz(self, other)
    }

    /// 返回两个数字中的最大值，传播 NaN
    ///
    /// 如果参数中至少有一个是 NaN，返回值也是 NaN，其位模式由特定规则决定
    /// picked using the usual [rules for arithmetic operations](f32#nan-bit-patterns). Furthermore,
    /// `-0.0` is considered to be less than `+0.0`, making this function fully deterministic for
    /// non-NaN inputs.
    ///
    /// This is in contrast to [`f128::max`] which only returns NaN when *both* arguments are NaN,
    /// and which does not reliably order `-0.0` and `+0.0`.
    ///
    /// This follows the IEEE 754-2019 semantics for `maximum`.
    ///
    /// ```
    /// #![feature(f128)]
    /// #![feature(float_minimum_maximum)]
    /// # #[cfg(any(miri, target_has_reliable_f128_math))] { // Miri uses softfloats, always works
    ///
    /// let x = 1.0f128;
    /// let y = 2.0f128;
    ///
    /// assert_eq!(x.maximum(y), y);
    /// assert!(x.maximum(f128::NAN).is_nan());
    /// # }
    /// ```
    #[inline]
    #[unstable(feature = "f128", issue = "116909")]
    #[rustc_const_unstable(feature = "f128", issue = "116909")]
    // #[unstable(feature = "float_minimum_maximum", issue = "91079")]
    #[must_use = "this returns the result of the comparison, without modifying either input"]
    pub const fn maximum(self, other: f128) -> f128 {
        intrinsics::maximum(self, other)
    }

    /// 如果参数中至少有一个是 NaN，返回值也是 NaN，其位模式由特定规则决定
    ///
    /// 如果参数中至少有一个是 NaN，返回值也是 NaN，其位模式由特定规则决定
    /// picked using the usual [rules for arithmetic operations](f32#nan-bit-patterns). Furthermore,
    /// `-0.0` is considered to be less than `+0.0`, making this function fully deterministic for
    /// non-NaN inputs.
    ///
    /// This is in contrast to [`f128::min`] which only returns NaN when *both* arguments are NaN,
    /// and which does not reliably order `-0.0` and `+0.0`.
    ///
    /// This follows the IEEE 754-2019 semantics for `minimum`.
    ///
    /// ```
    /// #![feature(f128)]
    /// #![feature(float_minimum_maximum)]
    /// # #[cfg(any(miri, target_has_reliable_f128_math))] { // Miri uses softfloats, always works
    ///
    /// let x = 1.0f128;
    /// let y = 2.0f128;
    ///
    /// assert_eq!(x.minimum(y), x);
    /// assert!(x.minimum(f128::NAN).is_nan());
    /// # }
    /// ```
    #[inline]
    #[unstable(feature = "f128", issue = "116909")]
    #[rustc_const_unstable(feature = "f128", issue = "116909")]
    // #[unstable(feature = "float_minimum_maximum", issue = "91079")]
    #[must_use = "this returns the result of the comparison, without modifying either input"]
    pub const fn minimum(self, other: f128) -> f128 {
        intrinsics::minimum(self, other)
    }

    /// Calculates the midpoint (average) between `self` and `rhs`.
    ///
    /// 当 *任意一个* 参数为 NaN 或提供 +inf 和 -inf 的组合时，返回 NaN
    /// # 示例
    ///
    /// # 向零取整并转换为任何基本整数类型，
    ///
    /// ```
    /// #![feature(f128)]
    /// # #[cfg(target_has_reliable_f128)] {
    ///
    /// assert_eq!(1f128.midpoint(4.0), 2.5);
    /// assert_eq!((-5.5f128).midpoint(8.0), 1.25);
    /// # }
    /// ```
    #[inline]
    #[doc(alias = "average")]
    #[unstable(feature = "f128", issue = "116909")]
    #[rustc_const_unstable(feature = "f128", issue = "116909")]
    #[must_use = "this returns the result of the operation, \
                  without modifying the original"]
    pub const fn midpoint(self, other: f128) -> f128 {
        const HI: f128 = f128::MAX * 0.5;

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

    /// 假设该值有限且适合该类型
    /// # 安全性
    ///
    /// ```
    /// #![feature(f128)]
    /// # #[cfg(target_has_reliable_f128)] {
    ///
    /// let value = 4.6_f128;
    /// let rounded = unsafe { value.to_int_unchecked::<u16>() };
    /// assert_eq!(rounded, 4);
    ///
    /// let value = -128.9_f128;
    /// let rounded = unsafe { value.to_int_unchecked::<i8>() };
    /// assert_eq!(rounded, i8::MIN);
    /// # }
    /// ```
    ///
    /// # 值必须：
    ///
    /// The value must:
    ///
    /// * Not be `NaN`
    /// * Not be infinite
    /// * Be representable in the return type `Int`, after truncating off its fractional part
    #[inline]
    #[unstable(feature = "f128", issue = "116909")]
    #[must_use = "this returns the result of the operation, without modifying the original"]
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
    /// #![feature(float_conversions, f128)]
    /// # #[cfg(target_has_reliable_f128)] {
    ///
    /// let x = 1.5_f128;
    /// assert_eq!(x.cast::<f64>(), 1.5_f64);
    /// # }
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

    /// 向零方向四舍五入，并转换为任何基本整数类型，在类型边界处饱和
    /// at the type's boundaries and mapping `NaN` to zero.
    ///
    /// This is equivalent to `self as Int`.
    ///
    /// ```
    /// #![feature(float_conversions, f128)]
    /// # #[cfg(target_has_reliable_f128)] {
    ///
    /// assert_eq!(4.6_f128.to_int_saturating::<u8>(), 4);
    /// assert_eq!(f128::NAN.to_int_saturating::<u8>(), 0);
    /// # }
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

    /// 向零方向四舍五入，并转换为任何基本整数类型，返回
    /// `None` if the value is `NaN`, infinite, or does not fit in the target type.
    ///
    /// ```
    /// #![feature(float_conversions, f128)]
    /// # #[cfg(target_has_reliable_f128)] {
    ///
    /// assert_eq!(4.6_f128.to_int_checked::<u8>(), Some(4));
    /// assert_eq!(f128::NAN.to_int_checked::<u8>(), None);
    /// # }
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

    /// 向零方向四舍五入，并转换为任何基本整数类型。
    ///
    /// This is equivalent to `self.to_int_checked().unwrap()`.
    ///
    /// # 引发 panic
    ///
    /// Panics if the value is `NaN`, infinite, or does not fit in the target type.
    ///
    /// ```
    /// #![feature(float_conversions, f128)]
    /// # #[cfg(target_has_reliable_f128)] {
    ///
    /// assert_eq!(4.6_f128.to_int_strict::<u8>(), 4);
    /// # }
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

    /// Raw transmutation to `u128`.
    ///
    /// This is currently identical to `transmute::<f128, u128>(self)` on all platforms.
    ///
    /// See [`from_bits`](#method.from_bits) for some discussion of the
    /// portability of this operation (there are almost no issues).
    ///
    /// Note that this function is distinct from `as` casting, which attempts to
    /// 保留 *数值* 值，而不是位值。
    ///
    /// ```
    /// #![feature(f128)]
    /// # #[cfg(target_has_reliable_f128)] {
    ///
    /// assert_ne!((1f128).to_bits(), 1f128 as u128); // to_bits() is not casting!
    /// assert_eq!((12.5f128).to_bits(), 0x40029000000000000000000000000000);
    /// # }
    /// ```
    #[inline]
    #[unstable(feature = "f128", issue = "116909")]
    #[must_use = "this returns the result of the operation, without modifying the original"]
    #[allow(unnecessary_transmutes)]
    pub const fn to_bits(self) -> u128 {
        // SAFETY: `u128` is a plain old datatype so we can always transmute to it.
        unsafe { mem::transmute(self) }
    }

    /// Raw transmutation from `u128`.
    ///
    /// This is currently identical to `transmute::<u128, f128>(v)` on all platforms.
    /// 事实证明，这具有极高的可移植性，原因有两个：
    ///
    /// * 所有支持的平台上浮点数和整数具有相同的字节序。
    /// * IEEE 754 非常精确地规定了浮点数的位布局。
    ///
    /// 然而有一个注意事项：在 2008 年版本的 IEEE 754 之前，
    /// 如何解释 NaN 信号位实际上并未规定。大多数平台
    /// （尤其是 x86 和 ARM）选择了最终被标准化的解释方式，但有些平台没有（尤其是 MIPS）。因此，
    /// MIPS 上的所有信号 NaN 在 x86 上都是静默 NaN，反之亦然。
    /// 与其尝试跨平台保留信号特性，此实现更倾向于保留原始位。这意味着
    ///
    /// 即使通过网络从 x86 机器发送到 MIPS 机器的此方法的结果被处理，
    /// 在同样架构下操作的结果，则不存在可移植性问题。
    /// 如果输入不是 NaN，则不存在可移植性问题。
    /// 如果你不关心信号特性（非常可能），则不存在可移植性问题。
    ///
    /// If the results of this method are only manipulated by the same
    /// architecture that produced them, then there is no portability concern.
    ///
    /// If the input isn't NaN, then there is no portability concern.
    ///
    /// If you don't care about signalingness (very likely), then there is no
    /// portability concern.
    ///
    /// Note that this function is distinct from `as` casting, which attempts to
    /// 保留*数值*，而非位值。
    ///
    /// ```
    /// #![feature(f128)]
    /// # #[cfg(target_has_reliable_f128)] {
    ///
    /// let v = f128::from_bits(0x40029000000000000000000000000000);
    /// assert_eq!(v, 12.5);
    /// # }
    /// ```
    #[inline]
    #[must_use]
    #[unstable(feature = "f128", issue = "116909")]
    #[allow(unnecessary_transmutes)]
    pub const fn from_bits(v: u128) -> Self {
        // It turns out the safety issues with sNaN were overblown! Hooray!
        // SAFETY: `u128` is a plain old datatype so we can always transmute from it.
        unsafe { mem::transmute(v) }
    }

    /// 以字节数组的形式返回此浮点数的内存表示形式。
    /// 大端序（网络）字节顺序。
    ///
    /// See [`from_bits`](Self::from_bits) for some discussion of the
    /// # 示例
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(f128)]
    ///
    /// let bytes = 12.5f128.to_be_bytes();
    /// assert_eq!(
    ///     bytes,
    ///     [0x40, 0x02, 0x90, 0x00, 0x00, 0x00, 0x00, 0x00,
    ///      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]
    /// );
    /// ```
    #[inline]
    #[unstable(feature = "f128", issue = "116909")]
    #[must_use = "this returns the result of the operation, without modifying the original"]
    pub const fn to_be_bytes(self) -> [u8; 16] {
        self.to_bits().to_be_bytes()
    }

    /// 以字节数组的形式返回此浮点数的内存表示形式。
    /// 小端序字节顺序。
    ///
    /// See [`from_bits`](Self::from_bits) for some discussion of the
    /// # 示例
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(f128)]
    ///
    /// let bytes = 12.5f128.to_le_bytes();
    /// assert_eq!(
    ///     bytes,
    ///     [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ///      0x00, 0x00, 0x00, 0x00, 0x00, 0x90, 0x02, 0x40]
    /// );
    /// ```
    #[inline]
    #[unstable(feature = "f128", issue = "116909")]
    #[must_use = "this returns the result of the operation, without modifying the original"]
    pub const fn to_le_bytes(self) -> [u8; 16] {
        self.to_bits().to_le_bytes()
    }

    /// 以字节数组的形式返回此浮点数的内存表示形式。
    /// 本地字节顺序。
    ///
    /// 由于使用目标平台的本地端序，可移植代码
    /// should use [`to_be_bytes`] or [`to_le_bytes`], as appropriate, instead.
    ///
    /// [`to_be_bytes`]: f128::to_be_bytes
    /// [`to_le_bytes`]: f128::to_le_bytes
    ///
    /// See [`from_bits`](Self::from_bits) for some discussion of the
    /// # 示例
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(f128)]
    ///
    /// let bytes = 12.5f128.to_ne_bytes();
    /// assert_eq!(
    ///     bytes,
    ///     if cfg!(target_endian = "big") {
    ///         [0x40, 0x02, 0x90, 0x00, 0x00, 0x00, 0x00, 0x00,
    ///          0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]
    ///     } else {
    ///         [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ///          0x00, 0x00, 0x00, 0x00, 0x00, 0x90, 0x02, 0x40]
    ///     }
    /// );
    /// ```
    #[inline]
    #[unstable(feature = "f128", issue = "116909")]
    #[must_use = "this returns the result of the operation, without modifying the original"]
    pub const fn to_ne_bytes(self) -> [u8; 16] {
        self.to_bits().to_ne_bytes()
    }

    /// 根据字节数组中的表示形式，以大端序创建浮点值。
    ///
    /// See [`from_bits`](Self::from_bits) for some discussion of the
    /// # 示例
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(f128)]
    /// # #[cfg(target_has_reliable_f128)] {
    ///
    /// let value = f128::from_be_bytes(
    ///     [0x40, 0x02, 0x90, 0x00, 0x00, 0x00, 0x00, 0x00,
    ///      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]
    /// );
    /// assert_eq!(value, 12.5);
    /// # }
    /// ```
    #[inline]
    #[must_use]
    #[unstable(feature = "f128", issue = "116909")]
    pub const fn from_be_bytes(bytes: [u8; 16]) -> Self {
        Self::from_bits(u128::from_be_bytes(bytes))
    }

    /// 根据字节数组中的表示形式，以小端序创建浮点值。
    ///
    /// See [`from_bits`](Self::from_bits) for some discussion of the
    /// # 示例
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(f128)]
    /// # #[cfg(target_has_reliable_f128)] {
    ///
    /// let value = f128::from_le_bytes(
    ///     [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ///      0x00, 0x00, 0x00, 0x00, 0x00, 0x90, 0x02, 0x40]
    /// );
    /// assert_eq!(value, 12.5);
    /// # }
    /// ```
    #[inline]
    #[must_use]
    #[unstable(feature = "f128", issue = "116909")]
    pub const fn from_le_bytes(bytes: [u8; 16]) -> Self {
        Self::from_bits(u128::from_le_bytes(bytes))
    }

    /// 根据字节数组中的表示形式，以本地端序创建浮点值。
    ///
    /// 由于使用目标平台的本地端序，可移植代码
    /// likely wants to use [`from_be_bytes`] or [`from_le_bytes`], as
    /// 适当选择。
    ///
    /// [`from_be_bytes`]: f128::from_be_bytes
    /// [`from_le_bytes`]: f128::from_le_bytes
    ///
    /// See [`from_bits`](Self::from_bits) for some discussion of the
    /// # 示例
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(f128)]
    /// # #[cfg(target_has_reliable_f128)] {
    ///
    /// let value = f128::from_ne_bytes(if cfg!(target_endian = "big") {
    ///     [0x40, 0x02, 0x90, 0x00, 0x00, 0x00, 0x00, 0x00,
    ///      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]
    /// } else {
    ///     [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ///      0x00, 0x00, 0x00, 0x00, 0x00, 0x90, 0x02, 0x40]
    /// });
    /// assert_eq!(value, 12.5);
    /// # }
    /// ```
    #[inline]
    #[must_use]
    #[unstable(feature = "f128", issue = "116909")]
    pub const fn from_ne_bytes(bytes: [u8; 16]) -> Self {
        Self::from_bits(u128::from_ne_bytes(bytes))
    }

    /// Returns the ordering between `self` and `other`.
    ///
    /// 与标准浮点数部分比较不同，
    /// 此比较总是产生符合
    /// the `totalOrder` predicate as defined in the IEEE 754 (2008 revision)
    /// 浮点标准。这些值按以下顺序排序：
    ///
    /// - 负静默 NaN
    /// - 负信号 NaN
    /// - 负无穷大
    /// - 负数
    /// - 负次正规数
    /// - 负零
    /// - 正零
    /// - 正次正规数
    /// - 正数
    /// - 正无穷大
    /// - 正信号 NaN
    /// - 正静默 NaN。
    ///
    /// 此函数建立的排序关系并不总是与实际情况一致。
    /// [`PartialOrd`] and [`PartialEq`] implementations of `f128`. For example,
    /// they consider negative and positive zero equal, while `total_cmp`
    /// 则不是这样。
    ///
    /// 信号 NaN 位的解读遵循
    /// IEEE 754 标准中的定义，这可能与某些
    /// 较旧、不兼容的（例如 MIPS）硬件实现中的解读不同。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(f128)]
    ///
    /// struct GoodBoy {
    ///     name: &'static str,
    ///     weight: f128,
    /// }
    ///
    /// let mut bois = vec![
    ///     GoodBoy { name: "Pucci", weight: 0.1 },
    ///     GoodBoy { name: "Woofer", weight: 99.0 },
    ///     GoodBoy { name: "Yapper", weight: 10.0 },
    ///     GoodBoy { name: "Chonk", weight: f128::INFINITY },
    ///     GoodBoy { name: "Abs. Unit", weight: f128::NAN },
    ///     GoodBoy { name: "Floaty", weight: -5.0 },
    /// ];
    ///
    /// bois.sort_by(|a, b| a.weight.total_cmp(&b.weight));
    ///
    /// // `f128::NAN` could be positive or negative, which will affect the sort order.
    /// if f128::NAN.is_sign_negative() {
    ///     bois.into_iter().map(|b| b.weight)
    ///         .zip([f128::NAN, -5.0, 0.1, 10.0, 99.0, f128::INFINITY].iter())
    ///         .for_each(|(a, b)| assert_eq!(a.to_bits(), b.to_bits()))
    /// } else {
    ///     bois.into_iter().map(|b| b.weight)
    ///         .zip([-5.0, 0.1, 10.0, 99.0, f128::INFINITY, f128::NAN].iter())
    ///         .for_each(|(a, b)| assert_eq!(a.to_bits(), b.to_bits()))
    /// }
    /// ```
    #[inline]
    #[must_use]
    #[unstable(feature = "f128", issue = "116909")]
    #[rustc_const_unstable(feature = "const_cmp", issue = "143800")]
    pub const fn total_cmp(&self, other: &Self) -> crate::cmp::Ordering {
        let mut left = self.to_bits() as i128;
        let mut right = other.to_bits() as i128;

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
        left ^= (((left >> 127) as u128) >> 1) as i128;
        right ^= (((right >> 127) as u128) >> 1) as i128;

        left.cmp(&right)
    }

    /// 除非值为 NaN，否则将值限制在某个区间内。
    ///
    /// Returns `max` if `self` is greater than `max`, and `min` if `self` is
    /// less than `min`. Otherwise this returns `self`.
    ///
    /// Note that this function returns NaN if the initial value was NaN as
    /// well. If the result is zero and among the three inputs `self`, `min`, and `max` there are
    /// zeros with different sign, either `0.0` or `-0.0` is returned non-deterministically.
    ///
    /// # Panics
    ///
    /// Panics if `min > max`, `min` is NaN, or `max` is NaN.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(f128)]
    /// # #[cfg(target_has_reliable_f128_math)] {
    ///
    /// assert!((-3.0f128).clamp(-2.0, 1.0) == -2.0);
    /// assert!((0.0f128).clamp(-2.0, 1.0) == 0.0);
    /// assert!((2.0f128).clamp(-2.0, 1.0) == 1.0);
    /// assert!((f128::NAN).clamp(-2.0, 1.0).is_nan());
    ///
    /// // These always returns zero, but the sign (which is ignored by `==`) is non-deterministic.
    /// assert!((0.0f128).clamp(-0.0, -0.0) == 0.0);
    /// assert!((1.0f128).clamp(-0.0, 0.0) == 0.0);
    /// // This is definitely a negative zero.
    /// assert!((-1.0f128).clamp(-0.0, 1.0).is_sign_negative());
    /// # }
    /// ```
    #[inline]
    #[unstable(feature = "f128", issue = "116909")]
    #[must_use = "method returns a new number and does not mutate the original value"]
    #[expect(clippy::neg_cmp_op_on_partial_ord, reason = "NaN is also invalid")]
    pub const fn clamp(mut self, min: f128, max: f128) -> f128 {
        const_assert!(
            min <= max,
            "min > max, or either was NaN",
            "min > max, or either was NaN. min = {min:?}, max = {max:?}",
            min: f128,
            max: f128,
        );

        if self < min {
            self = min;
        }
        if self > max {
            self = max;
        }
        self
    }

    /// 将此数字限制在以零为中心的对称范围内。
    ///
    /// The method clamps the number's magnitude (absolute value) to be at most `limit`.
    ///
    /// This is functionally equivalent to `self.clamp(-limit, limit)`, but is more
    /// # Panics
    ///
    /// # Panics
    ///
    /// Panics if `limit` is negative or NaN, as this indicates a logic error.
    ///
    /// # 将值限制在某个范围内，除非其为 NaN。
    ///
    /// ```
    /// #![feature(f128)]
    /// #![feature(clamp_magnitude)]
    /// # #[cfg(all(target_arch = "x86_64", target_os = "linux"))] {
    /// assert_eq!(5.0f128.clamp_magnitude(3.0), 3.0);
    /// assert_eq!((-5.0f128).clamp_magnitude(3.0), -3.0);
    /// assert_eq!(2.0f128.clamp_magnitude(3.0), 2.0);
    /// assert_eq!((-2.0f128).clamp_magnitude(3.0), -2.0);
    /// # }
    /// ```
    #[inline]
    #[unstable(feature = "clamp_magnitude", issue = "148519")]
    #[rustc_const_unstable(feature = "clamp_magnitude", issue = "148519")]
    #[must_use = "method returns a new number and does not mutate the original value"]
    #[expect(clippy::neg_cmp_op_on_partial_ord, reason = "NaN is also invalid")]
    pub const fn clamp_magnitude(self, limit: f128) -> f128 {
        assert!(limit >= 0.0, "limit must be non-negative and not NaN");
        let limit = limit.abs(); // Canonicalises -0.0 to 0.0
        self.clamp(-limit, limit)
    }

    /// Restrict a value to a certain range, unless it is NaN.
    ///
    /// This is largely equal to `max`, `min`, or `clamp`, depending on whether the range is
    /// `min..`, `..=max`, or `min..=max`, respectively. However, unlike `max` and `min`, it will
    /// 不允许使用互斥范围。
    ///
    /// # Panics
    /// well.
    ///
    /// # 示例
    ///
    /// # Panics
    ///
    /// Panics on `min..=max` if `min > max`, or if any bound is NaN.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(f128, clamp_to)]
    /// # #[cfg(target_has_reliable_f128_math)] {
    /// assert_eq!((-3.0f128).clamp_to(-2.0..=1.0), -2.0);
    /// assert_eq!(0.0f128.clamp_to(-2.0..=1.0), 0.0);
    /// assert_eq!(2.0f128.clamp_to(..=1.0), 1.0);
    /// assert_eq!(5.0f128.clamp_to(7.0..), 7.0);
    /// assert!(f128::NAN.clamp_to(1.0..=2.0).is_nan());
    /// # }
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
    /// This function always returns the precise result.
    ///
    /// # Examples
    ///
    /// ```
    /// #![feature(f128)]
    /// # #[cfg(target_has_reliable_f128)] {
    ///
    /// let x = 3.5_f128;
    /// let y = -3.5_f128;
    ///
    /// assert_eq!(x.abs(), x);
    /// assert_eq!(y.abs(), -y);
    ///
    /// assert!(f128::NAN.abs().is_nan());
    /// # }
    /// ```
    #[inline]
    #[unstable(feature = "f128", issue = "116909")]
    #[rustc_const_unstable(feature = "f128", issue = "116909")]
    #[must_use = "method returns a new number and does not mutate the original value"]
    pub const fn abs(self) -> Self {
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
    /// #![feature(f128)]
    /// # #[cfg(target_has_reliable_f128)] {
    ///
    /// let f = 3.5_f128;
    ///
    /// assert_eq!(f.signum(), 1.0);
    /// assert_eq!(f128::NEG_INFINITY.signum(), -1.0);
    ///
    /// assert!(f128::NAN.signum().is_nan());
    /// # }
    /// ```
    #[inline]
    #[unstable(feature = "f128", issue = "116909")]
    #[rustc_const_unstable(feature = "f128", issue = "116909")]
    #[must_use = "method returns a new number and does not mutate the original value"]
    pub const fn signum(self) -> f128 {
        if self.is_nan() { Self::NAN } else { 1.0_f128.copysign(self) }
    }

    /// Returns a number composed of the magnitude of `self` and the sign of
    /// `sign`.
    ///
    /// Equal to `self` if the sign of `self` and `sign` are the same, otherwise equal to `-self`.
    /// If `self` is a NaN, then a NaN with the same payload as `self` and the sign bit of `sign` is
    /// returned.
    ///
    /// If `sign` is a NaN, then this operation will still carry over its sign into the result. Note
    /// IEEE 754 在出现 NaN 时不会给符号位赋予任何意义，而 Rust
    /// doesn't guarantee that the bit pattern of NaNs are conserved over arithmetic operations, the
    /// result of `copysign` with `sign` being a NaN might produce an unexpected or non-portable
    /// result. See the [specification of NaN bit patterns](primitive@f32#nan-bit-patterns) for more
    /// # 示例
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(f128)]
    /// # #[cfg(target_has_reliable_f128)] {
    ///
    /// let f = 3.5_f128;
    ///
    /// assert_eq!(f.copysign(0.42), 3.5_f128);
    /// assert_eq!(f.copysign(-0.42), -3.5_f128);
    /// assert_eq!((-f).copysign(0.42), 3.5_f128);
    /// assert_eq!((-f).copysign(-0.42), -3.5_f128);
    ///
    /// assert!(f128::NAN.copysign(1.0).is_nan());
    /// # }
    /// ```
    #[inline]
    #[unstable(feature = "f128", issue = "116909")]
    #[rustc_const_unstable(feature = "f128", issue = "116909")]
    #[must_use = "method returns a new number and does not mutate the original value"]
    pub const fn copysign(self, sign: f128) -> f128 {
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
    /// 此函数始终返回精确结果。
    ///
    /// ```
    /// #![feature(f128)]
    /// #![feature(float_exponent_methods)]
    /// # #[cfg(target_has_reliable_f128_math)] {
    ///
    /// assert_eq!(3.0_f128.scalbn(4), 48_f128); // = 3 * 2.powi(4) = 48
    /// assert_eq!(3.0_f128.scalbn(-1), 1.5_f128); // = 3 * 2.powi(-1) = 1.5
    ///
    /// assert_eq!(0.0_f128.scalbn(4), 0.0_f128);
    /// assert_eq!(4.0_f128.scalbn(0), 4.0_f128);
    ///
    /// assert_eq!(f128::INFINITY.scalbn(4), f128::INFINITY);
    /// assert_eq!(f128::NEG_INFINITY.scalbn(4), f128::NEG_INFINITY);
    ///
    /// assert!(f128::NAN.scalbn(4).is_nan());
    /// # }
    /// ```
    ///
    /// [`powi`]: ../std/primitive.f128.html#method.powi
    #[inline]
    #[doc(alias = "ldexp")]
    #[unstable(feature = "float_exponent_methods", issue = "163184")]
    #[rustc_const_unstable(feature = "float_exponent_methods", issue = "163184")]
    #[must_use = "method returns a new number and does not mutate the original value"]
    pub const fn scalbn(self, exponent: i32) -> f128 {
        intrinsics::scalbn(self, exponent)
    }

    /// 提取输入值的无偏指数，忽略符号。
    ///
    /// Returns `None` when `self` is NaN, [`i32::MIN`] when `self` is zero,
    /// and [`i32::MAX`] when `self` is an infinity.
    ///
    /// For non-NaN values this will be close to `x.abs().log2() as i32` (typically within one),
    /// though due to imprecision of `log2` this may not always be the case.
    ///
    /// ```
    /// #![feature(f128)]
    /// #![feature(float_exponent_methods)]
    /// # #[cfg(target_has_reliable_f128_math)] {
    ///
    /// assert_eq!(8.0_f128.ilogb(), Some(3));
    /// assert_eq!((-8.0_f128).ilogb(), Some(3));
    ///
    /// assert_eq!(15.0_f128.ilogb(), Some(3));
    /// assert_eq!(16.0_f128.ilogb(), Some(4));
    ///
    /// assert_eq!(0.5_f128.ilogb(), Some(-1));
    ///
    /// assert_eq!(f128::INFINITY.ilogb(), Some(i32::MAX));
    /// assert_eq!(0.0_f128.ilogb(), Some(i32::MIN));
    /// assert_eq!(f128::NAN.ilogb(), None);
    /// # }
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

    /// 允许基于代数规则进行优化的浮点加法。
    ///
    /// See [algebraic operators](primitive@f32#algebraic-operators) for more info.
    #[must_use = "method returns a new number and does not mutate the original value"]
    #[unstable(feature = "f128", issue = "116909")]
    #[rustc_const_unstable(feature = "f128", issue = "116909")]
    #[inline]
    pub const fn algebraic_add(self, rhs: f128) -> f128 {
        intrinsics::fadd_algebraic(self, rhs)
    }

    /// 允许基于代数规则进行优化的浮点减法。
    ///
    /// See [algebraic operators](primitive@f32#algebraic-operators) for more info.
    #[must_use = "method returns a new number and does not mutate the original value"]
    #[unstable(feature = "f128", issue = "116909")]
    #[rustc_const_unstable(feature = "f128", issue = "116909")]
    #[inline]
    pub const fn algebraic_sub(self, rhs: f128) -> f128 {
        intrinsics::fsub_algebraic(self, rhs)
    }

    /// 允许基于代数规则进行优化的浮点乘法。
    ///
    /// See [algebraic operators](primitive@f32#algebraic-operators) for more info.
    #[must_use = "method returns a new number and does not mutate the original value"]
    #[unstable(feature = "f128", issue = "116909")]
    #[rustc_const_unstable(feature = "f128", issue = "116909")]
    #[inline]
    pub const fn algebraic_mul(self, rhs: f128) -> f128 {
        intrinsics::fmul_algebraic(self, rhs)
    }

    /// 允许基于代数规则进行优化的浮点除法。
    ///
    /// See [algebraic operators](primitive@f32#algebraic-operators) for more info.
    #[must_use = "method returns a new number and does not mutate the original value"]
    #[unstable(feature = "f128", issue = "116909")]
    #[rustc_const_unstable(feature = "f128", issue = "116909")]
    #[inline]
    pub const fn algebraic_div(self, rhs: f128) -> f128 {
        intrinsics::fdiv_algebraic(self, rhs)
    }

    /// 允许基于代数规则进行优化的浮点余数。
    ///
    /// See [algebraic operators](primitive@f32#algebraic-operators) for more info.
    #[must_use = "method returns a new number and does not mutate the original value"]
    #[unstable(feature = "f128", issue = "116909")]
    #[rustc_const_unstable(feature = "f128", issue = "116909")]
    #[inline]
    pub const fn algebraic_rem(self, rhs: f128) -> f128 {
        intrinsics::frem_algebraic(self, rhs)
    }

    /// Returns `self` if the value is not NaN, otherwise returns `replacement`
    /// if `self` is NaN.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(f128)]
    /// #![feature(float_nan_to)]
    /// # #[cfg(target_has_reliable_f128)] {
    ///
    /// let n = f128::NAN;
    /// let x = 2.0f128;
    /// let y = f128::INFINITY;
    ///
    /// assert_eq!(n.nan_to(0.0f128), 0.0f128);
    /// assert_eq!(x.nan_to(0.0f128), 2.0f128);
    /// assert_eq!(y.nan_to(0.0f128), f128::INFINITY);
    /// # }
    /// ```
    #[must_use = "method returns a new float and does not mutate the original value"]
    #[unstable(feature = "float_nan_to", issue = "161248")]
    #[rustc_const_unstable(feature = "float_nan_to", issue = "161248")]
    #[inline]
    pub const fn nan_to(self, replacement: f128) -> f128 {
        if self.is_nan() { replacement } else { self }
    }
}

// Functions in this module fall into `core_float_math`
// #[unstable(feature = "core_float_math", issue = "137578")]
#[cfg(not(test))]
#[doc(test(attr(
    feature(cfg_target_has_reliable_f16_f128),
    expect(internal_features),
    allow(unused_features)
)))]
impl f128 {
    /// Returns the largest integer less than or equal to `self`.
    ///
    /// 此函数始终返回精确结果。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(f128)]
    /// # #[cfg(any(miri, target_has_reliable_f128_math))] { // Miri uses softfloats, always works
    ///
    /// let f = 3.7_f128;
    /// let g = 3.0_f128;
    /// let h = -3.7_f128;
    ///
    /// assert_eq!(f.floor(), 3.0);
    /// assert_eq!(g.floor(), 3.0);
    /// assert_eq!(h.floor(), -4.0);
    /// # }
    /// ```
    #[inline]
    #[rustc_allow_incoherent_impl]
    #[unstable(feature = "f128", issue = "116909")]
    #[rustc_const_unstable(feature = "f128", issue = "116909")]
    #[must_use = "method returns a new number and does not mutate the original value"]
    pub const fn floor(self) -> f128 {
        intrinsics::floor(self)
    }

    /// Returns the smallest integer greater than or equal to `self`.
    ///
    /// 此函数始终返回精确结果。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(f128)]
    /// # #[cfg(any(miri, target_has_reliable_f128_math))] { // Miri uses softfloats, always works
    ///
    /// let f = 3.01_f128;
    /// let g = 4.0_f128;
    ///
    /// assert_eq!(f.ceil(), 4.0);
    /// assert_eq!(g.ceil(), 4.0);
    /// # }
    /// ```
    #[inline]
    #[doc(alias = "ceiling")]
    #[rustc_allow_incoherent_impl]
    #[unstable(feature = "f128", issue = "116909")]
    #[rustc_const_unstable(feature = "f128", issue = "116909")]
    #[must_use = "method returns a new number and does not mutate the original value"]
    pub const fn ceil(self) -> f128 {
        intrinsics::ceil(self)
    }

    /// Returns the nearest integer to `self`. If a value is half-way between two
    /// integers, round away from `0.0`.
    ///
    /// 此函数始终返回精确的结果。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(f128)]
    /// # #[cfg(any(miri, target_has_reliable_f128_math))] { // Miri uses softfloats, always works
    ///
    /// let f = 3.3_f128;
    /// let g = -3.3_f128;
    /// let h = -3.7_f128;
    /// let i = 3.5_f128;
    /// let j = 4.5_f128;
    ///
    /// assert_eq!(f.round(), 3.0);
    /// assert_eq!(g.round(), -3.0);
    /// assert_eq!(h.round(), -4.0);
    /// assert_eq!(i.round(), 4.0);
    /// assert_eq!(j.round(), 5.0);
    /// # }
    /// ```
    #[inline]
    #[rustc_allow_incoherent_impl]
    #[unstable(feature = "f128", issue = "116909")]
    #[rustc_const_unstable(feature = "f128", issue = "116909")]
    #[must_use = "method returns a new number and does not mutate the original value"]
    pub const fn round(self) -> f128 {
        intrinsics::round(self)
    }

    /// 返回与数字最接近的整数。当数字处于中间时，会四舍五入到该数字。
    /// 且最右侧的位数为偶数。
    ///
    /// 此函数始终返回精确的结果。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(f128)]
    /// # #[cfg(any(miri, target_has_reliable_f128_math))] { // Miri uses softfloats, always works
    ///
    /// let f = 3.3_f128;
    /// let g = -3.3_f128;
    /// let h = 3.5_f128;
    /// let i = 4.5_f128;
    ///
    /// assert_eq!(f.round_ties_even(), 3.0);
    /// assert_eq!(g.round_ties_even(), -3.0);
    /// assert_eq!(h.round_ties_even(), 4.0);
    /// assert_eq!(i.round_ties_even(), 4.0);
    /// # }
    /// ```
    #[inline]
    #[rustc_allow_incoherent_impl]
    #[unstable(feature = "f128", issue = "116909")]
    #[rustc_const_unstable(feature = "f128", issue = "116909")]
    #[must_use = "method returns a new number and does not mutate the original value"]
    pub const fn round_ties_even(self) -> f128 {
        intrinsics::round_ties_even(self)
    }

    /// Returns the integer part of `self`.
    /// 这意味着非整数总是向零方向截断。
    ///
    /// 此函数始终返回精确的结果。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(f128)]
    /// # #[cfg(any(miri, target_has_reliable_f128_math))] { // Miri uses softfloats, always works
    ///
    /// let f = 3.7_f128;
    /// let g = 3.0_f128;
    /// let h = -3.7_f128;
    ///
    /// assert_eq!(f.trunc(), 3.0);
    /// assert_eq!(g.trunc(), 3.0);
    /// assert_eq!(h.trunc(), -3.0);
    /// # }
    /// ```
    #[inline]
    #[doc(alias = "truncate")]
    #[rustc_allow_incoherent_impl]
    #[unstable(feature = "f128", issue = "116909")]
    #[rustc_const_unstable(feature = "f128", issue = "116909")]
    #[must_use = "method returns a new number and does not mutate the original value"]
    pub const fn trunc(self) -> f128 {
        intrinsics::trunc(self)
    }

    /// Returns the fractional part of `self`.
    ///
    /// 此函数始终返回精确的结果。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(f128)]
    /// # #[cfg(any(miri, target_has_reliable_f128_math))] { // Miri uses softfloats, always works
    ///
    /// let x = 3.6_f128;
    /// let y = -3.6_f128;
    /// let abs_difference_x = (x.fract() - 0.6).abs();
    /// let abs_difference_y = (y.fract() - (-0.6)).abs();
    ///
    /// assert!(abs_difference_x <= f128::EPSILON);
    /// assert!(abs_difference_y <= f128::EPSILON);
    /// # }
    /// ```
    #[inline]
    #[rustc_allow_incoherent_impl]
    #[unstable(feature = "f128", issue = "116909")]
    #[rustc_const_unstable(feature = "f128", issue = "116909")]
    #[must_use = "method returns a new number and does not mutate the original value"]
    pub const fn fract(self) -> f128 {
        self - self.trunc()
    }

    /// Fused multiply-add. Computes `(self * a) + b` with only one rounding
    /// 错误，因此比未融合的乘加运算能得到更精确的结果。
    ///
    /// Using `mul_add` *may* be more performant than an unfused multiply-add if
    /// the target architecture has a dedicated `fma` CPU instruction. However,
    /// 针对特定目标硬件的算法。
    /// algorithms with specific target hardware in mind.
    ///
    /// # 精度
    ///
    /// 此操作的结果保证为四舍五入后的结果。
    /// infinite-precision result. It is specified by IEEE 754 as
    /// `fusedMultiplyAdd` and guaranteed not to change.
    ///
    /// # Examples
    ///
    /// ```
    /// #![feature(f128)]
    /// # #[cfg(any(miri, target_has_reliable_f128_math))] { // Miri uses softfloats, always works
    ///
    /// let m = 10.0_f128;
    /// let x = 4.0_f128;
    /// let b = 60.0_f128;
    ///
    /// assert_eq!(m.mul_add(x, b), 100.0);
    /// assert_eq!(m * x + b, 100.0);
    ///
    /// let one_plus_eps = 1.0_f128 + f128::EPSILON;
    /// let one_minus_eps = 1.0_f128 - f128::EPSILON;
    /// let minus_one = -1.0_f128;
    ///
    /// // The exact result (1 + eps) * (1 - eps) = 1 - eps * eps.
    /// assert_eq!(one_plus_eps.mul_add(one_minus_eps, minus_one), -f128::EPSILON * f128::EPSILON);
    /// // Different rounding with the non-fused multiply and add.
    /// assert_eq!(one_plus_eps * one_minus_eps + minus_one, 0.0);
    /// # }
    /// ```
    #[inline]
    #[rustc_allow_incoherent_impl]
    #[doc(alias = "fmaf128", alias = "fusedMultiplyAdd")]
    #[unstable(feature = "f128", issue = "116909")]
    #[must_use = "method returns a new number and does not mutate the original value"]
    pub const fn mul_add(self, a: f128, b: f128) -> f128 {
        intrinsics::fma(self, a, b)
    }

    /// Computes `(self * a) + b` with nondeterministic rounding.
    ///
    /// This is similar to [`mul_add`](Self::mul_add), but the intermediate
    /// 使用哪种方式取决于设计，且具有不确定性：
    /// 它可能因目标、优化级别和周围代码的不同而不同，
    /// 甚至相同输入下的两次调用也可能产生不同的结果。
    ///
    /// 哪种方式被使用是不确定的：
    /// 它可能因目标、优化级别和周围代码的不同而不同。
    /// 
    /// 因此，即使输入相同，两次调用也可能产生不同的结果。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(f128)]
    /// #![feature(float_mul_add_relaxed)]
    /// # #[cfg(any(miri, target_has_reliable_f128_math))] { // Miri uses softfloats, always works
    ///
    /// // When the fused and unfused operations round differently, either
    /// // result may be returned:
    /// // - 7.824090399073145653039910391751267e-37 is the fused result (one rounding)
    /// // - 1.5046327690525280101999827676444745e-36 is the unfused result (two roundings)
    /// let r = 0.1_f128.mul_add_relaxed(0.1_f128, -0.01_f128);
    /// assert!(
    ///     r == 7.824090399073145653039910391751267e-37
    ///         || r == 1.5046327690525280101999827676444745e-36
    /// );
    /// # }
    /// ```
    #[inline]
    #[rustc_allow_incoherent_impl]
    #[doc(alias = "fmuladd")]
    #[unstable(feature = "float_mul_add_relaxed", issue = "151770")]
    #[must_use = "method returns a new number and does not mutate the original value"]
    pub const fn mul_add_relaxed(self, a: f128, b: f128) -> f128 {
        intrinsics::fmuladd(self, a, b)
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
    /// #![feature(f128)]
    /// # #[cfg(any(miri, target_has_reliable_f128_math))] { // Miri uses softfloats, always works
    ///
    /// let a: f128 = 7.0;
    /// let b = 4.0;
    /// assert_eq!(a.div_euclid(b), 1.0); // 7.0 > 4.0 * 1.0
    /// assert_eq!((-a).div_euclid(b), -2.0); // -7.0 >= 4.0 * -2.0
    /// assert_eq!(a.div_euclid(-b), -1.0); // 7.0 >= -4.0 * -1.0
    /// assert_eq!((-a).div_euclid(-b), 2.0); // -7.0 >= -4.0 * 2.0
    /// # }
    /// ```
    #[inline]
    #[rustc_allow_incoherent_impl]
    #[unstable(feature = "f128", issue = "116909")]
    #[must_use = "method returns a new number and does not mutate the original value"]
    pub fn div_euclid(self, rhs: f128) -> f128 {
        let q = (self / rhs).trunc();
        if self % rhs < 0.0 {
            return if rhs > 0.0 { q - 1.0 } else { q + 1.0 };
        }
        q
    }

    /// Calculates the least nonnegative remainder of `self` when
    /// divided by `rhs`.
    ///
    /// In particular, the return value `r` satisfies `0.0 <= r < rhs.abs()` in
    /// most cases. However, due to a floating point round-off error it can
    /// result in `r == rhs.abs()`, violating the mathematical definition, if
    /// `self` is much smaller than `rhs.abs()` in magnitude and `self < 0.0`.
    /// 该结果并非函数的值域中的元素，但它却是
    /// 实数中最近的浮点数，因此满足
    /// property `self == self.div_euclid(rhs) * rhs + self.rem_euclid(rhs)`
    /// 大约。
    ///
    /// # 精度
    ///
    /// 此操作的结果保证为四舍五入后的
    /// 无限精度结果。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(f128)]
    /// # #[cfg(any(miri, target_has_reliable_f128_math))] { // Miri uses softfloats, always works
    ///
    /// let a: f128 = 7.0;
    /// let b = 4.0;
    /// assert_eq!(a.rem_euclid(b), 3.0);
    /// assert_eq!((-a).rem_euclid(b), 1.0);
    /// assert_eq!(a.rem_euclid(-b), 3.0);
    /// assert_eq!((-a).rem_euclid(-b), 1.0);
    /// // limitation due to round-off error
    /// assert!((-f128::EPSILON).rem_euclid(3.0) != 0.0);
    /// # }
    /// ```
    #[inline]
    #[rustc_allow_incoherent_impl]
    #[doc(alias = "modulo", alias = "mod")]
    #[unstable(feature = "f128", issue = "116909")]
    #[must_use = "method returns a new number and does not mutate the original value"]
    pub fn rem_euclid(self, rhs: f128) -> f128 {
        let r = self % rhs;
        if r < 0.0 { r + rhs.abs() } else { r }
    }

    /// 将一个数提升为整数幂。
    ///
    /// Using this function is generally faster than using `powf`.
    /// It might have a different sequence of rounding operations than `powf`,
    /// 因此结果不可保证一致。
    ///
    /// 注意，此函数具有特殊性质，对于 NaN 输入它可以返回非 NaN 结果。
    /// example, `f128::powi(f128::NAN, 0)` returns `1.0`. However, if an input is a *signaling*
    /// NaN，则结果非确定性地要么是 NaN，要么是相应的静默 NaN 产生的结果。
    /// # 未指定精度
    ///
    /// # 不确定精度
    ///
    /// 此函数的精度是非确定性的。这意味着它因平台、
    /// Rust 版本而异，甚至在同一执行中从一次调用到下一次也可能不同。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(f128)]
    /// # #[cfg(target_has_reliable_f128_math)] {
    ///
    /// let x = 2.0_f128;
    /// let abs_difference = (x.powi(2) - (x * x)).abs();
    /// assert!(abs_difference <= 1e-9);
    ///
    /// assert_eq!(f128::powi(f128::NAN, 0), 1.0);
    /// assert_eq!(f128::powi(0.0, 0), 1.0);
    /// # }
    /// ```
    #[inline]
    #[rustc_allow_incoherent_impl]
    #[unstable(feature = "f128", issue = "116909")]
    #[must_use = "method returns a new number and does not mutate the original value"]
    pub fn powi(self, n: i32) -> f128 {
        intrinsics::powi(self, n)
    }

    /// 返回一个数的平方根。
    ///
    /// Returns NaN if `self` is a negative number other than `-0.0`.
    ///
    /// # 精度
    ///
    /// 此操作的结果保证为四舍五入后的
    /// infinite-precision result. It is specified by IEEE 754 as `squareRoot`
    /// 并且保证不会变化。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(f128)]
    /// # #[cfg(any(miri, target_has_reliable_f128_math))] { // Miri uses softfloats, always works
    ///
    /// let positive = 4.0_f128;
    /// let negative = -4.0_f128;
    /// let negative_zero = -0.0_f128;
    ///
    /// assert_eq!(positive.sqrt(), 2.0);
    /// assert!(negative.sqrt().is_nan());
    /// assert!(negative_zero.sqrt() == negative_zero);
    /// # }
    /// ```
    #[inline]
    #[doc(alias = "squareRoot")]
    #[rustc_allow_incoherent_impl]
    #[unstable(feature = "f128", issue = "116909")]
    #[must_use = "method returns a new number and does not mutate the original value"]
    pub fn sqrt(self) -> f128 {
        intrinsics::sqrt(self)
    }
}
