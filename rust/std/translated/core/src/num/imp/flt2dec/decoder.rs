//! 将浮点值解码为各个部分及错误范围。

use crate::num::FpCategory;
use crate::num::imp::FloatExt;

/// 解码无符号有限值，具体规则如下：
///
/// - The original value equals to `mant * 2^exp`.
///
/// - Any number from `(mant - minus) * 2^exp` to `(mant + plus) * 2^exp` will
/// ​round​ 到原始值。该范围仅当
///   `inclusive` is `true`.
#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub struct Decoded {
    /// 缩放 mantissa 时包含。
    pub mant: u64,
    /// 较低的错误范围。
    pub minus: u64,
    /// 较高的错误范围。
    pub plus: u64,
    /// 二进制中的共享指数。
    pub exp: i16,
    /// 当错误范围包含时为真。
    ///
    /// 在 IEEE 754 标准中，当原始 mantissa 为偶数时为真。
    pub inclusive: bool,
}

/// 解码后的无符号值。
#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub enum FullDecoded {
    /// 非数字。
    Nan,
    /// 无穷大，正或负均可。
    Infinite,
    /// 零，正或负均可。
    Zero,
    /// 具有进一步解码字段的有限数。
    Finite(Decoded),
}

/// A floating point type which can be `decode`d.
pub trait DecodableFloat: FloatExt + Copy {
    /// 最小的正归一化值。
    fn min_pos_norm_value() -> Self;
}

#[cfg(target_has_reliable_f16)]
impl DecodableFloat for f16 {
    fn min_pos_norm_value() -> Self {
        f16::MIN_POSITIVE
    }
}

impl DecodableFloat for f32 {
    fn min_pos_norm_value() -> Self {
        f32::MIN_POSITIVE
    }
}

impl DecodableFloat for f64 {
    fn min_pos_norm_value() -> Self {
        f64::MIN_POSITIVE
    }
}

/// Returns a sign (true when negative) and `FullDecoded` value
/// 来自给定的浮点数。
pub fn decode<T: DecodableFloat>(v: T) -> (/*negative?*/ bool, FullDecoded) {
    let (mant, exp, sign) = v.integer_decode();
    let even = (mant & 1) == 0;
    let decoded = match v.classify() {
        FpCategory::Nan => FullDecoded::Nan,
        FpCategory::Infinite => FullDecoded::Infinite,
        FpCategory::Zero => FullDecoded::Zero,
        FpCategory::Subnormal => {
            // neighbors: (mant - 2, exp) -- (mant, exp) -- (mant + 2, exp)
            // Float::integer_decode always preserves the exponent,
            // so the mantissa is scaled for subnormals.
            FullDecoded::Finite(Decoded { mant, minus: 1, plus: 1, exp, inclusive: even })
        }
        FpCategory::Normal => {
            let minnorm = <T as DecodableFloat>::min_pos_norm_value().integer_decode();
            if mant == minnorm.0 {
                // neighbors: (maxmant, exp - 1) -- (minnormmant, exp) -- (minnormmant + 1, exp)
                // where maxmant = minnormmant * 2 - 1
                FullDecoded::Finite(Decoded {
                    mant: mant << 2,
                    minus: 1,
                    plus: 2,
                    exp: exp - 2,
                    inclusive: even,
                })
            } else {
                // neighbors: (mant - 1, exp) -- (mant, exp) -- (mant + 1, exp)
                FullDecoded::Finite(Decoded {
                    mant: mant << 1,
                    minus: 1,
                    plus: 1,
                    exp: exp - 1,
                    inclusive: even,
                })
            }
        }
    };
    (sign < 0, decoded)
}
