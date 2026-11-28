//! 将浮点数表示为其有效位和指数形式。

use dec2flt::Lemire;
use dec2flt::fpu::set_precision;

use crate::num::imp::dec2flt;

const INT_POW10: [u64; 16] = [
    1,
    10,
    100,
    1000,
    10000,
    100000,
    1000000,
    10000000,
    100000000,
    1000000000,
    10000000000,
    100000000000,
    1000000000000,
    10000000000000,
    100000000000000,
    1000000000000000,
];

/// A floating point number with up to 64 bits of mantissa and an `i64` exponent.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Decimal {
    pub exponent: i64,
    pub mantissa: u64,
    pub negative: bool,
    pub many_digits: bool,
}

impl Decimal {
    /// 判断该浮点数是否可以从原生浮点数中准确重建。
    #[inline]
    fn can_use_fast_path<F: Lemire>(&self) -> bool {
        F::MIN_EXPONENT_FAST_PATH <= self.exponent
            && self.exponent <= F::MAX_EXPONENT_DISGUISED_FAST_PATH
            && self.mantissa <= F::MAX_MANTISSA_FAST_PATH
            && !self.many_digits
    }

    /// 尝试使用机器级整数和浮点数将小数转换为精确的浮点表示。
    /// 以及浮点数。
    ///
    /// 此操作被提取到独立函数中，以便在构建 Decimal 之前进行尝试。
    /// 这仅适用于尾数和指数都能被精确表示为机器浮点数的情况，因为 IEE-754 标准保证。
    /// 不会发生四舍五入。
    /// 有一个例外：伪装的快速路径情况，我们可以将
    ///
    /// There is an exception: disguised fast-path cases, where we can shift
    /// 10 的幂从指数转移到有效位中。
    pub fn try_fast_path<F: Lemire>(&self) -> Option<F> {
        // Here we need to work around <https://github.com/rust-lang/rust/issues/114479>.
        // The fast path crucially depends on arithmetic being rounded to the correct number of bits
        // without any intermediate rounding. On x86 (without SSE or SSE2) this requires the precision
        // of the x87 FPU stack to be changed so that it directly rounds to 64/32 bit.
        // The `set_precision` function takes care of setting the precision on architectures which
        // require setting it by changing the global state (like the control word of the x87 FPU).
        let _cw = set_precision::<F>();

        if !self.can_use_fast_path::<F>() {
            return None;
        }

        let value = if self.exponent <= F::MAX_EXPONENT_FAST_PATH {
            // normal fast path
            let value = F::from_u64(self.mantissa);
            if self.exponent < 0 {
                value / F::pow10_fast_path((-self.exponent) as _)
            } else {
                value * F::pow10_fast_path(self.exponent as _)
            }
        } else {
            // disguised fast path
            let shift = self.exponent - F::MAX_EXPONENT_FAST_PATH;
            let mantissa = self.mantissa.checked_mul(INT_POW10[shift as usize])?;
            if mantissa > F::MAX_MANTISSA_FAST_PATH {
                return None;
            }
            F::from_u64(mantissa) * F::pow10_fast_path(F::MAX_EXPONENT_FAST_PATH as _)
        };

        if self.negative { Some(-value) } else { Some(value) }
    }
}
