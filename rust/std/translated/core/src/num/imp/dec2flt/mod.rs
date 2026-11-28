//! 将十进制字符串转换为 IEEE 754 二进制浮点数。
//!
//! # 问题陈述
//!
//! We are given a decimal string such as `12.34e56`. This string consists of integral (`12`),
//! fractional (`34`), and exponent (`56`) parts. All parts are optional and interpreted as a
//! 默认值（1 或 0）。
//!
//! 我们寻找最接近该十进制字符串精确值的 IEEE 754 浮点数。
//! 众所周知，许多十进制字符串在二进制基数下没有终止表示形式，因此我们将数值四舍五入到
//! 最后一位为 0.5 单位（即尽可能精确）。
//! 当两个连续浮点数恰好相差 0.5 时，采用
//! “半到偶数”策略来解决，也称为银行家舍入法。
//!
//! 不用说，这非常困难，不仅体现在实现复杂度上，也体现在
//! CPU 周期消耗上。
//!
//! # 实现
//!
//! 首先，我们忽略符号。或者更准确地说，我们在转换过程的开始就移除它，
//! 并在最后重新应用它。这在所有边界情况下都是正确的，因为 IEEE
//! 浮点数在零附近是对称的，否定一个值就相当于翻转第一个比特。
//!
//! Then we remove the decimal point by adjusting the exponent: Conceptually, `12.34e56` turns
//! into `1234e54`, which we describe with a positive integer `f = 1234` and an integer `e = 54`.
//! The `(f, e)` representation is used by almost all code past the parsing stage.
//!
//! 然后我们尝试一系列逐渐更通用且更复杂的特殊情况，使用
//! machine-sized integers and small, fixed-sized floating point numbers (first `f32`/`f64`, then
//! 具有 64 位 significand 的类型。扩展精度算法
//! 使用 Eisel-Lemire 算法，该算法使用 128 位（或 192 位）
//! 表示形式，能够准确且快速计算绝大多数
//! 浮点数。当所有方法都失败时，我们不得不采用
//! 大小数表示法，将数字移入指定范围，计算
//! 高有效位并精确四舍五入到最近的表示形式。
//!
//! Another aspect that needs attention is the ``RawFloat`` trait by which almost all functions
//! are parametrized. One might think that it's enough to parse to `f64` and cast the result to
//! `f32`. Unfortunately this is not the world we live in, and this has nothing to do with using
//! 基数为二或半到整的四舍五入方式。
//!
//! Consider for example two types `d2` and `d4` representing a decimal type with two decimal
//! 每种类型有两位小数和四位小数，并以“0.01499”作为输入。我们采用半进法四舍五入。
//! Going directly to two decimal digits gives `0.01`, but if we round to four digits first,
//! we get `0.0150`, which is then rounded up to `0.02`. The same principle applies to other
//! 如果你需要 0.5 ULP 的精度，就需要以完整精度处理所有操作，并在最后一次进行精确四舍五入。
//! 即一次性考虑所有截断位，只进行一次四舍五入。
//!
//! 主要地，此模块及其子模块实现了以下文献中描述的算法：
//! 《每秒千兆字节数级的数字解析》，可在线阅读：
//! <https://arxiv.org/abs/2101.11408>.
//!
//! # 其他
//!
//! 转换过程不应引发 panic。代码中包含断言和明确的 panic 语句，
//! 但它们不应被触发，仅作为内部合理性检查。任何 panic 都应被视为错误。
//! 有单元测试，但不足以确保正确性，它们只覆盖
//!
//! There are unit tests but they are woefully inadequate at ensuring correctness, they only cover
//! a small percentage of possible errors. Far more extensive tests are located in the directory
//! `src/tools/test-float-parse` as a Rust program.
//!
//! 解析子模块只提供足够小的指数，其中“足够小”意味着
//! exponent `e`. Primarily, we shift the decimal point around: Before the first decimal digit,
//! 接受更大的指数，但我们不对其进行算术运算，它们会立即被转换为 {正数、负数} {零、无穷大}。
//! # 符号表示法
//! 此模块使用与 Lemire 论文相同的符号表示法：
//! Larger exponents are accepted, but we don't do arithmetic with them, they are immediately
//! turned into {positive,negative} {zero,infinity}.
//!
//! # Notation
//!
//! This module uses the same notation as the Lemire paper:
//!
//! - `m`: binary mantissa; always nonnegative
//! - `p`: binary exponent; a signed integer
//! - `w`: decimal significand; always nonnegative
//! - `q`: decimal exponent; a signed integer
//!
//! This gives `m * 2^p` for the binary floating-point number, with `w * 10^q` as the decimal
//! equivalent.

#![doc(hidden)]
#![unstable(
    feature = "dec2flt",
    reason = "internal routines only exposed for testing",
    issue = "none"
)]

use common::BiasedFp;
use lemire::compute_float;
use parse::{parse_inf_nan, parse_number};
use slow::parse_long_mantissa;

use crate::f64;
use crate::num::imp::FloatExt;
use crate::num::{FloatErrorKind, ParseFloatError};

mod common;
pub mod decimal;
pub mod decimal_seq;
mod fpu;
pub mod lemire;
pub mod parse;
mod slow;
mod table;

/// Extension to `Float` that are necessary for parsing using the Lemire method.
///
/// See the parent module's doc comment for why this is necessary.
///
/// Not intended for use outside of the `dec2flt` module.
#[doc(hidden)]
pub trait Lemire: FloatExt {
    /// Maximum exponent for a fast path case, or `⌊(SIG_BITS+1)/log2(5)⌋`
    // assuming FLT_EVAL_METHOD = 0
    const MAX_EXPONENT_FAST_PATH: i64 = {
        let log2_5 = f64::consts::LOG2_10 - 1.0;
        (Self::SIG_TOTAL_BITS as f64 / log2_5) as i64
    };

    /// Minimum exponent for a fast path case, or `-⌊(SIG_BITS+1)/log2(5)⌋`
    const MIN_EXPONENT_FAST_PATH: i64 = -Self::MAX_EXPONENT_FAST_PATH;

    /// 伪装快速路径情况下可表示的最大指数。
    /// This is `MAX_EXPONENT_FAST_PATH + ⌊(SIG_BITS+1)/log2(10)⌋`
    const MAX_EXPONENT_DISGUISED_FAST_PATH: i64 =
        Self::MAX_EXPONENT_FAST_PATH + (Self::SIG_TOTAL_BITS as f64 / f64::consts::LOG2_10) as i64;

    /// Maximum mantissa for the fast-path (`1 << 53` for f64).
    const MAX_MANTISSA_FAST_PATH: u64 = 1 << Self::SIG_TOTAL_BITS;

    /// 为快速路径乘法提供小的十的幂倍。
    fn pow10_fast_path(exponent: usize) -> Self;

    /// 通过 as 转换将整数转换为浮点数。
    /// 此操作仅在快速路径算法中调用，因此
    /// 不会丢失精度，因为数值始终具有
    /// 仅当数值 <= Self::MAX_MANTISSA_FAST_PATH 时。
    fn from_u64(v: u64) -> Self;
}

#[cfg(target_has_reliable_f16)]
impl Lemire for f16 {
    fn pow10_fast_path(exponent: usize) -> Self {
        #[allow(clippy::use_self)]
        const TABLE: [f16; 8] = [1e0, 1e1, 1e2, 1e3, 1e4, 0.0, 0.0, 0.];
        TABLE[exponent & 7]
    }

    #[inline]
    fn from_u64(v: u64) -> Self {
        debug_assert!(v <= Self::MAX_MANTISSA_FAST_PATH);
        v as _
    }
}

impl Lemire for f32 {
    fn pow10_fast_path(exponent: usize) -> Self {
        #[allow(clippy::use_self)]
        const TABLE: [f32; 16] =
            [1e0, 1e1, 1e2, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e10, 0., 0., 0., 0., 0.];
        TABLE[exponent & 15]
    }

    #[inline]
    fn from_u64(v: u64) -> Self {
        debug_assert!(v <= Self::MAX_MANTISSA_FAST_PATH);
        v as _
    }
}

impl Lemire for f64 {
    fn pow10_fast_path(exponent: usize) -> Self {
        const TABLE: [f64; 32] = [
            1e0, 1e1, 1e2, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e10, 1e11, 1e12, 1e13, 1e14, 1e15,
            1e16, 1e17, 1e18, 1e19, 1e20, 1e21, 1e22, 0., 0., 0., 0., 0., 0., 0., 0., 0.,
        ];
        TABLE[exponent & 31]
    }

    #[inline]
    fn from_u64(v: u64) -> Self {
        debug_assert!(v <= Self::MAX_MANTISSA_FAST_PATH);
        v as _
    }
}

#[inline]
pub(super) fn pfe_empty() -> ParseFloatError {
    ParseFloatError { kind: FloatErrorKind::Empty }
}

// Only used in unit tests, keep public.
#[inline]
pub fn pfe_invalid() -> ParseFloatError {
    ParseFloatError { kind: FloatErrorKind::Invalid }
}

/// Converts a `BiasedFp` to the closest machine float type.
fn biased_fp_to_float<F: FloatExt>(x: BiasedFp) -> F {
    let mut word = x.m;
    word |= (x.p_biased as u64) << F::SIG_BITS;
    F::from_u64_bits(word)
}

/// 将十进制字符串转换为浮点数。
#[inline(always)] // Will be inlined into a function with `#[inline(never)]`, see above
pub fn dec2flt<F: Lemire>(s: &str) -> Result<F, ParseFloatError> {
    let mut s = s.as_bytes();
    let Some(&c) = s.first() else { return Err(pfe_empty()) };
    let negative = c == b'-';
    if c == b'-' || c == b'+' {
        s = &s[1..];
    }
    if s.is_empty() {
        return Err(pfe_invalid());
    }

    let mut num = match parse_number(s) {
        Some(r) => r,
        None if let Some(value) = parse_inf_nan(s, negative) => return Ok(value),
        None => return Err(pfe_invalid()),
    };
    num.negative = negative;
    if !cfg!(feature = "optimize_for_size") {
        if let Some(value) = num.try_fast_path::<F>() {
            return Ok(value);
        }
    }

    // If significant digits were truncated, then we can have rounding error
    // only if `mantissa + 1` produces a different result. We also avoid
    // redundantly using the Eisel-Lemire algorithm if it was unable to
    // correctly round on the first pass.
    let mut fp = compute_float::<F>(num.exponent, num.mantissa);
    if num.many_digits
        && fp.p_biased >= 0
        && fp != compute_float::<F>(num.exponent, num.mantissa + 1)
    {
        fp.p_biased = -1;
    }
    // Unable to correctly round the float using the Eisel-Lemire algorithm.
    // Fallback to a slower, but always correct algorithm.
    if fp.p_biased < 0 {
        fp = parse_long_mantissa::<F>(s);
    }

    let mut float = biased_fp_to_float::<F>(fp);
    if num.negative {
        float = -float;
    }
    Ok(float)
}
