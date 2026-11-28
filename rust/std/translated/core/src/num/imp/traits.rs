//! 用于内部实现的数值 trait。

#![doc(hidden)]
#![unstable(
    feature = "num_internals",
    reason = "internal routines only exposed for testing",
    issue = "none"
)]

use crate::num::FpCategory;
use crate::{f64, fmt, ops};

/// Lossy `as` casting between two types.
pub trait CastInto<T: Copy>: Copy {
    fn cast(self) -> T;
}

/// 允许我们对整数大小进行泛型化的 trait 集合。
pub trait Int:
    Sized
    + Clone
    + Copy
    + fmt::Debug
    + ops::Shr<u32, Output = Self>
    + ops::Shl<u32, Output = Self>
    + ops::BitAnd<Output = Self>
    + ops::BitOr<Output = Self>
    + PartialEq
    + CastInto<i16>
{
    const ZERO: Self;
    const ONE: Self;
}

macro_rules! int {
    ($($ty:ty),+) => {
        $(
            impl CastInto<i16> for $ty {
                fn cast(self) -> i16 {
                    self as i16
                }
            }

            impl Int for $ty {
                const ZERO: Self = 0;
                const ONE: Self = 1;
            }
        )+
    }
}

int!(u16, u32, u64);

/// 一个辅助 trait，避免重复所有 IEEE 浮点数的转换代码。
#[doc(hidden)]
pub trait Float:
    Sized
    + ops::Div<Output = Self>
    + ops::Neg<Output = Self>
    + ops::Mul<Output = Self>
    + ops::Add<Output = Self>
    + fmt::Debug
    + PartialEq
    + PartialOrd
    + Default
    + Clone
    + Copy
{
    /// 与浮点数具有相同大小的无符号整数。
    type Int: Int + Into<u64>;

    /* general constants */

    const INFINITY: Self;
    const NEG_INFINITY: Self;
    const NAN: Self;
    const NEG_NAN: Self;

    /// 浮点数的位宽。
    const BITS: u32;

    /// 有效数位中的位数，*包括*隐藏位。
    const SIG_TOTAL_BITS: u32;

    const EXP_MASK: Self::Int;
    const SIG_MASK: Self::Int;

    /// 有效数位中的位数，*不包括*隐藏位。
    const SIG_BITS: u32 = Self::SIG_TOTAL_BITS - 1;

    /// 指数中的位数。
    const EXP_BITS: u32 = Self::BITS - Self::SIG_BITS - 1;

    /// 指数的饱和（最大位模式）值，即无限值。
    /// 表示形式。
    ///
    /// This shifted fully right, use `EXP_MASK` for the shifted value.
    const EXP_SAT: u32 = (1 << Self::EXP_BITS) - 1;

    /// Signed version of `EXP_SAT` since we convert a lot.
    const INFINITE_POWER: i32 = Self::EXP_SAT as i32;

    /// 指数偏置值。这也是指数的最大值。
    const EXP_BIAS: u32 = Self::EXP_SAT >> 1;

    /// 正常值的最小指数值。
    const EXP_MIN: i32 = -(Self::EXP_BIAS as i32 - 1);

    /// 偶数舍入仅适用于 q 为负值时的情况
    /// 在 64 位情况下当 q ≥ −4 时，在
    /// 32 位情况下当 q ≥ −17 时。
    ///
    /// 当 q ≥ 0 时，我们有 5^q ≤ 2m+1。在 64 位情况下，我们有
    /// 5^q ≤ 2m+1 ≤ 2^54 或 q ≤ 23。在 32 位情况下，我们有
    /// 5^q ≤ 2m+1 ≤ 2^25 or q ≤ 10.
    ///
    /// 当 q < 0 时，我们有 w ≥ (2m+1)×5^−q。我们必须有 w < 2^64
    /// so (2m+1)×5^−q < 2^64. We have that 2m+1 > 2^53 (64-bit case)
    /// 或 2m+1 > 2^24（32 位情况）。因此，我们必须有 2^53×5^−q < 2^64
    /// （64 位）和 2^24×5^−q < 2^64（32 位）。因此我们有 5^−q < 2^11
    /// 或 q ≥ −4（64 位情况）和 5^−q < 2^40 或 q ≥ −17（32 位情况）。
    ///
    /// 因此，我们只有在
    /// we have that q ∈ [−4,23](in the 64-bit case) or q∈[−17,10]
    /// （32 位情况）时，才需要将平局值舍入为偶数。在这两种情况下，五的幂（5^|q|）
    /// 可以放入 64 位字中。
    const MIN_EXPONENT_ROUND_TO_EVEN: i32;
    const MAX_EXPONENT_ROUND_TO_EVEN: i32;

    /// 非无限值的最小十进制指数。
    ///
    /// 这是二进制中的最大指数，转换为十进制后即为最大指数。允许快速
    /// pathing anything larger than `10^LARGEST_POWER_OF_TEN`, which will round to infinity.
    const LARGEST_POWER_OF_TEN: i32 = {
        let largest_pow2 = Self::EXP_BIAS + 1;
        pow2_to_pow10(largest_pow2 as i64) as i32
    };

    /// Smallest decimal exponent for a non-zero value. This allows for fast pathing anything
    /// smaller than `10^SMALLEST_POWER_OF_TEN`, which will round to zero.
    ///
    /// The smallest power of ten is represented by `⌊log10(2^-n / (2^64 - 1))⌋`, where `n` is
    /// the smallest power of two. The `2^64 - 1)` denominator comes from the number of values
    /// 这些值可以使用公式计算。不幸的是，我们无法直接计算它们。
    /// the storage format is relevant here.
    ///
    /// The values may be calculated using the formula. Unfortunately we cannot calculate them at
    /// compile time since intermediates exceed the range of an `f64`.
    const SMALLEST_POWER_OF_TEN: i32;

    /// 返回该数值所属的类别。
    fn classify(self) -> FpCategory;

    /// 转换为整数表示形式。
    fn to_bits(self) -> Self::Int;
}

/// Items that ideally would be on `Float`, but don't apply to all float types because they
/// rely on the mantissa fitting into a `u64` (which isn't true for `f128`).
#[doc(hidden)]
pub trait FloatExt: Float {
    /// 执行从整数到原始浮点的直接转换。
    fn from_u64_bits(v: u64) -> Self;

    /// 以整数形式返回尾数、指数和符号。
    ///
    /// This returns `(m, p, s)` such that `s * m * 2^p` represents the original float. For 0, the
    /// exponent will be `-(EXP_BIAS + SIG_BITS)`, which is the minimum subnormal power. For
    /// infinity or NaN, the exponent will be `EXP_SAT - EXP_BIAS - SIG_BITS`.
    ///
    /// 如果为次正规数，尾数向左移动一位。否则，直接返回
    /// 带有明确的位设置，但不进行左移。
    ///
    /// `s` is only ever +/-1.
    fn integer_decode(self) -> (u64, i16, i8) {
        let bits = self.to_bits();
        let sign: i8 = if bits >> (Self::BITS - 1) == Self::Int::ZERO { 1 } else { -1 };
        let mut exponent: i16 = ((bits & Self::EXP_MASK) >> Self::SIG_BITS).cast();
        let mantissa = if exponent == 0 {
            (bits & Self::SIG_MASK) << 1
        } else {
            (bits & Self::SIG_MASK) | (Self::Int::ONE << Self::SIG_BITS)
        };
        // Exponent bias + mantissa shift
        exponent -= (Self::EXP_BIAS + Self::SIG_BITS) as i16;
        (mantissa.into(), exponent, sign)
    }
}

/// Solve for `b` in `10^b = 2^a`
const fn pow2_to_pow10(a: i64) -> i64 {
    let res = (a as f64) / f64::consts::LOG2_10;
    res as i64
}

#[cfg(target_has_reliable_f16)]
impl Float for f16 {
    type Int = u16;

    const INFINITY: Self = Self::INFINITY;
    const NEG_INFINITY: Self = Self::NEG_INFINITY;
    const NAN: Self = Self::NAN;
    const NEG_NAN: Self = -Self::NAN;

    const BITS: u32 = 16;
    const SIG_TOTAL_BITS: u32 = Self::MANTISSA_DIGITS;
    const EXP_MASK: Self::Int = Self::EXPONENT_MASK;
    const SIG_MASK: Self::Int = Self::MANTISSA_MASK;

    const MIN_EXPONENT_ROUND_TO_EVEN: i32 = -22;
    const MAX_EXPONENT_ROUND_TO_EVEN: i32 = 5;
    const SMALLEST_POWER_OF_TEN: i32 = -27;

    fn to_bits(self) -> Self::Int {
        self.to_bits()
    }

    fn classify(self) -> FpCategory {
        self.classify()
    }
}

#[cfg(target_has_reliable_f16)]
impl FloatExt for f16 {
    #[inline]
    fn from_u64_bits(v: u64) -> Self {
        Self::from_bits((v & 0xFFFF) as u16)
    }
}

impl Float for f32 {
    type Int = u32;

    const INFINITY: Self = f32::INFINITY;
    const NEG_INFINITY: Self = f32::NEG_INFINITY;
    const NAN: Self = f32::NAN;
    const NEG_NAN: Self = -f32::NAN;

    const BITS: u32 = 32;
    const SIG_TOTAL_BITS: u32 = Self::MANTISSA_DIGITS;
    const EXP_MASK: Self::Int = Self::EXPONENT_MASK;
    const SIG_MASK: Self::Int = Self::MANTISSA_MASK;

    const MIN_EXPONENT_ROUND_TO_EVEN: i32 = -17;
    const MAX_EXPONENT_ROUND_TO_EVEN: i32 = 10;
    const SMALLEST_POWER_OF_TEN: i32 = -65;

    fn to_bits(self) -> Self::Int {
        self.to_bits()
    }

    fn classify(self) -> FpCategory {
        self.classify()
    }
}

impl FloatExt for f32 {
    #[inline]
    fn from_u64_bits(v: u64) -> Self {
        f32::from_bits((v & 0xFFFFFFFF) as u32)
    }
}

impl Float for f64 {
    type Int = u64;

    const INFINITY: Self = Self::INFINITY;
    const NEG_INFINITY: Self = Self::NEG_INFINITY;
    const NAN: Self = Self::NAN;
    const NEG_NAN: Self = -Self::NAN;

    const BITS: u32 = 64;
    const SIG_TOTAL_BITS: u32 = Self::MANTISSA_DIGITS;
    const EXP_MASK: Self::Int = Self::EXPONENT_MASK;
    const SIG_MASK: Self::Int = Self::MANTISSA_MASK;

    const MIN_EXPONENT_ROUND_TO_EVEN: i32 = -4;
    const MAX_EXPONENT_ROUND_TO_EVEN: i32 = 23;
    const SMALLEST_POWER_OF_TEN: i32 = -342;

    fn to_bits(self) -> Self::Int {
        self.to_bits()
    }

    fn classify(self) -> FpCategory {
        self.classify()
    }
}

impl FloatExt for f64 {
    #[inline]
    fn from_u64_bits(v: u64) -> Self {
        f64::from_bits(v)
    }
}
