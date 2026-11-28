//! Eisel-Lemire 算法的实现。

use dec2flt::common::BiasedFp;
use dec2flt::table::{LARGEST_POWER_OF_FIVE, POWER_OF_FIVE_128, SMALLEST_POWER_OF_FIVE};

use crate::num::imp::{Float, dec2flt};

/// 使用扩展精度浮点数表示方式计算 w * 10^q。
///
/// 快速转换主要数字和十进制指数。
/// 将浮点数转换为带有二进制浮点数的扩展表示形式。
/// 该算法能够准确解析绝大多数情况。
/// 采用 128 位表示方式（ fallback 为 192 位表示方式）。
/// 该算法通过乘以十进制指数来缩放指数部分。
///
/// 使用预计算的 5 的幂来计算指数。
/// 并判断该表示方式是否可以明确舍入到最近的机器浮点数。
/// 此处不处理接近一半的情况，而是通过负的、有偏的二进制指数来表示。
/// 该算法在“Daniel Lemire, Number Parsing at a Gigabyte per Second”的“快速算法”章节第 5 节以及“精确数字与平局”章节第 6 节中有详细描述，可在线查阅。
/// 从十进制指数计算 2 的指数。
///
/// 对于 log2(10)，使用预计算的整数近似值，其中 217706 / 2^16 对于整个非有限十进制指数范围都是准确的。
/// at a Gigabyte per Second" in section 5, "Fast Algorithm", and
/// section 6, "Exact Numbers And Ties", available online:
/// <https://arxiv.org/abs/2101.11408.pdf>.
pub fn compute_float<F: Float>(q: i64, mut w: u64) -> BiasedFp {
    let fp_zero = BiasedFp::zero_pow2(0);
    let fp_inf = BiasedFp::zero_pow2(F::INFINITE_POWER);
    let fp_error = BiasedFp::zero_pow2(-1);

    // Short-circuit if the value can only be a literal 0 or infinity.
    if w == 0 || q < F::SMALLEST_POWER_OF_TEN as i64 {
        return fp_zero;
    } else if q > F::LARGEST_POWER_OF_TEN as i64 {
        return fp_inf;
    }
    // Normalize our significant digits, so the most-significant bit is set.
    let lz = w.leading_zeros();
    w <<= lz;
    let (lo, hi) = compute_product_approx(q, w, F::SIG_BITS as usize + 3);
    if lo == 0xFFFF_FFFF_FFFF_FFFF {
        // If we have failed to approximate w x 5^-q with our 128-bit value.
        // Since the addition of 1 could lead to an overflow which could then
        // round up over the half-way point, this can lead to improper rounding
        // of a float.
        //
        // However, this can only occur if q ∈ [-27, 55]. The upper bound of q
        // is 55 because 5^55 < 2^128, however, this can only happen if 5^q > 2^64,
        // since otherwise the product can be represented in 64-bits, producing
        // an exact result. For negative exponents, rounding-to-even can
        // only occur if 5^-q < 2^64.
        //
        // For detailed explanations of rounding for negative exponents, see
        // <https://arxiv.org/pdf/2101.11408.pdf#section.9.1>. For detailed
        // explanations of rounding for positive exponents, see
        // <https://arxiv.org/pdf/2101.11408.pdf#section.8>.
        let inside_safe_exponent = (q >= -27) && (q <= 55);
        if !inside_safe_exponent {
            return fp_error;
        }
    }
    let upperbit = (hi >> 63) as i32;
    let mut mantissa = hi >> (upperbit + 64 - F::SIG_BITS as i32 - 3);
    let mut power2 = power(q as i32) + upperbit - lz as i32 - F::EXP_MIN + 1;
    if power2 <= 0 {
        if -power2 + 1 >= 64 {
            // Have more than 64 bits below the minimum exponent, must be 0.
            return fp_zero;
        }
        // Have a subnormal value.
        mantissa >>= -power2 + 1;
        mantissa += mantissa & 1;
        mantissa >>= 1;
        power2 = (mantissa >= (1_u64 << F::SIG_BITS)) as i32;
        return BiasedFp { m: mantissa, p_biased: power2 };
    }
    // Need to handle rounding ties. Normally, we need to round up,
    // but if we fall right in between and we have an even basis, we
    // need to round down.
    //
    // This will only occur if:
    //  1. The lower 64 bits of the 128-bit representation is 0.
    //      IE, 5^q fits in single 64-bit word.
    //  2. The least-significant bit prior to truncated mantissa is odd.
    //  3. All the bits truncated when shifting to mantissa bits + 1 are 0.
    //
    // Or, we may fall between two floats: we are exactly halfway.
    if lo <= 1
        && q >= F::MIN_EXPONENT_ROUND_TO_EVEN as i64
        && q <= F::MAX_EXPONENT_ROUND_TO_EVEN as i64
        && mantissa & 0b11 == 0b01
        && (mantissa << (upperbit + 64 - F::SIG_BITS as i32 - 3)) == hi
    {
        // Zero the lowest bit, so we don't round up.
        mantissa &= !1_u64;
    }
    // Round-to-even, then shift the significant digits into place.
    mantissa += mantissa & 1;
    mantissa >>= 1;
    if mantissa >= (2_u64 << F::SIG_BITS) {
        // Rounding up overflowed, so the carry bit is set. Set the
        // mantissa to 1 (only the implicit, hidden bit is set) and
        // increase the exponent.
        mantissa = 1_u64 << F::SIG_BITS;
        power2 += 1;
    }
    // Zero out the hidden bit.
    mantissa &= !(1_u64 << F::SIG_BITS);
    if power2 >= F::INFINITE_POWER {
        // Exponent is above largest normal value, must be infinite.
        return fp_inf;
    }
    BiasedFp { m: mantissa, p_biased: power2 }
}

/// Calculate a base 2 exponent from a decimal exponent.
/// This uses a pre-computed integer approximation for
/// log2(10), where 217706 / 2^16 is accurate for the
/// entire range of non-finite decimal exponents.
#[inline]
fn power(q: i32) -> i32 {
    (q.wrapping_mul(152_170 + 65536) >> 16) + 63
}

#[inline]
fn full_multiplication(a: u64, b: u64) -> (u64, u64) {
    let r = (a as u128) * (b as u128);
    (r as u64, (r >> 64) as u64)
}

// This will compute or rather approximate w * 5**q and return a pair of 64-bit words
// approximating the result, with the "high" part corresponding to the most significant
// bits and the low part corresponding to the least significant bits.
fn compute_product_approx(q: i64, w: u64, precision: usize) -> (u64, u64) {
    debug_assert!(q >= SMALLEST_POWER_OF_FIVE as i64);
    debug_assert!(q <= LARGEST_POWER_OF_FIVE as i64);
    debug_assert!(precision <= 64);

    let mask = if precision < 64 {
        0xFFFF_FFFF_FFFF_FFFF_u64 >> precision
    } else {
        0xFFFF_FFFF_FFFF_FFFF_u64
    };

    // 5^q < 2^64, then the multiplication always provides an exact value.
    // That means whenever we need to round ties to even, we always have
    // an exact value.
    let index = (q - SMALLEST_POWER_OF_FIVE as i64) as usize;
    let (lo5, hi5) = POWER_OF_FIVE_128[index];
    // Only need one multiplication as long as there is 1 zero but
    // in the explicit mantissa bits, +1 for the hidden bit, +1 to
    // determine the rounding direction, +1 for if the computed
    // product has a leading zero.
    let (mut first_lo, mut first_hi) = full_multiplication(w, lo5);
    if first_hi & mask == mask {
        // Need to do a second multiplication to get better precision
        // for the lower product. This will always be exact
        // where q is < 55, since 5^55 < 2^128. If this wraps,
        // then we need to round up the hi product.
        let (_, second_hi) = full_multiplication(w, hi5);
        first_lo = first_lo.wrapping_add(second_hi);
        if second_hi > first_lo {
            first_hi += 1;
        }
    }
    (first_lo, first_hi)
}
