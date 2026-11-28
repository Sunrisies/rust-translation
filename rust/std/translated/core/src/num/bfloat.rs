//! 16 位 brain 浮点类型。

#![unstable(feature = "f16b", issue = "160630")]

use crate::{fmt, mem};

/// 一个 16 位 brain 浮点值。
///
/// 该类型使用 bfloat16 编码存储数值。它故意
/// 仅暴露原始位构建、比较、格式化及无损扩展功能。
/// widening to [`f32`].
///
/// 16 位 brain 浮点类型旨在在仅使用一半存储空间的情况下，保留
/// a 32-bit floating-point value while using half the storage. It does
/// this by using 8 bits for the exponent, the same as `f32`, but only
/// using 7 bits for the mantissa. See [Wikipedia on bfloat16][wikipedia] for
/// more information.
///
/// [wikipedia]: https://en.wikipedia.org/wiki/Bfloat16_floating-point_format
#[lang = "f16b"]
#[doc(alias = "bf16")] // what hardware often names it
#[doc(alias = "bfloat")] // LLVM's name
#[doc(alias = "bfloat16")] // Wikipedia's name
#[doc(alias = "bfloat16_t")] // The C++ `stdfloat` name
#[allow(non_camel_case_types)]
#[repr(transparent)]
#[unstable(feature = "f16b", issue = "160630")]
pub struct f16b(u16);

#[doc(test(attr(
    feature(cfg_target_has_reliable_f16b),
    allow(internal_features, unused_features)
)))]
impl f16b {
    /// Raw transmutation from `u16`.
    ///
    /// This is currently identical to `transmute::<u16, f16b>(v)` on all platforms.
    /// 事实证明，这具有极高的可移植性，原因有两个：
    ///
    /// * 浮点数和整数在所有支持的平台上都具有相同的字节序。
    /// * IEEE 754 对浮点数的位布局有非常精确的规定。
    ///
    /// 然而有一个限制：在 2008 年版本的 IEEE 754 之前，如何
    /// 解释 NaN 信号位并未被明确规定。大多数平台
    /// （尤其是 x86 和 ARM）选择了最终被标准化的解释方式，但有些平台没有（尤其是 MIPS）。因此，
    /// 在 MIPS 上作为信号表示的 NaN 在 x86 上就是普通的 NaN，反之亦然。
    /// 与其尝试跨平台保持信号特性，这种实现方式更重视保留原始位。这意味着
    ///
    /// 即使通过 x86 机器向 MIPS 机器传输此方法的计算结果，以 NaN 编码的任何有效载荷都将得到保留。
    /// 如果此方法的结果仅由产生它们的相同架构处理，则不存在可移植性问题。
    /// 如果输入不是 NaN，则不存在可移植性问题。
    /// 如果你不关心信号特性（非常可能），则不存在可移植性问题。
    ///
    /// If the results of this method are only manipulated by the same
    /// 保留 *数值* 值，而非位级值。
    ///
    /// If the input isn't NaN, then there is no portability concern.
    ///
    /// If you don't care about signalingness (very likely), then there is no
    /// portability concern.
    ///
    /// Note that this function is distinct from `as` casting, which attempts to
    /// 保留 *数值* 值，而非位级值。
    ///
    /// ```no_run
    /// #![feature(f16b)]
    /// # #[cfg(target_has_reliable_f16b)] {
    /// use core::num::f16b;
    ///
    /// let v = f16b::from_bits(0x4148);
    /// assert_eq!(f32::from(v), 12.5);
    /// # }
    /// ```
    #[inline]
    #[must_use]
    #[unstable(feature = "f16b", issue = "160630")]
    pub const fn from_bits(bits: u16) -> Self {
        // SAFETY: `f16b` and `u16` have the same size, and every bit pattern is valid.
        unsafe { mem::transmute(bits) }
    }

    /// Raw transmutation to `u16`.
    ///
    /// This is currently identical to `transmute::<f16b, u16>(self)` on all platforms.
    ///
    /// See [`from_bits`](#method.from_bits) for some discussion of the
    /// portability of this operation (there are almost no issues).
    ///
    /// Note that this function is distinct from `as` casting, which attempts to
    /// preserve the *numeric* value, and not the bitwise value.
    ///
    /// ```no_run
    /// #![feature(f16b)]
    /// # #[cfg(target_has_reliable_f16b)] {
    /// use core::num::f16b;
    ///
    /// assert_eq!(f16b::from_bits(0x4148).to_bits(), 0x4148);
    /// # }
    /// ```
    #[inline]
    #[unstable(feature = "f16b", issue = "160630")]
    #[must_use = "this returns the result of the operation, without modifying the original"]
    pub const fn to_bits(self) -> u16 {
        // SAFETY: `f16b` and `u16` have the same size, and every bit pattern is valid.
        unsafe { mem::transmute(self) }
    }
}

// FIXME(f16b) - This should be a `#[rustc_intrinsic]` using LLVM's `fpext`
// with this implementation constituting the fallback.
#[inline]
const fn widen(value: f16b) -> f32 {
    f32::from_bits((value.to_bits() as u32) << 16)
}

#[unstable(feature = "f16b", issue = "160630")]
impl Copy for f16b {}

#[unstable(feature = "f16b", issue = "160630")]
impl Clone for f16b {
    #[inline]
    fn clone(&self) -> Self {
        *self
    }
}

#[unstable(feature = "f16b", issue = "160630")]
impl Default for f16b {
    #[inline]
    fn default() -> Self {
        Self::from_bits(0)
    }
}

#[unstable(feature = "f16b", issue = "160630")]
#[rustc_const_unstable(feature = "const_cmp", issue = "143800")]
const impl PartialEq for f16b {
    #[inline]
    fn eq(&self, other: &Self) -> bool {
        widen(*self).eq(&widen(*other))
    }
}

#[unstable(feature = "f16b", issue = "160630")]
impl PartialOrd for f16b {
    #[inline]
    fn partial_cmp(&self, other: &Self) -> Option<crate::cmp::Ordering> {
        widen(*self).partial_cmp(&widen(*other))
    }
}

#[unstable(feature = "f16b", issue = "160630")]
impl From<f16b> for f32 {
    #[inline]
    fn from(value: f16b) -> Self {
        widen(value)
    }
}

#[unstable(feature = "f16b", issue = "160630")]
impl fmt::Debug for f16b {
    #[inline]
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        fmt::Debug::fmt(&widen(*self), formatter)
    }
}

#[cfg(not(no_fp_fmt_parse))]
#[unstable(feature = "f16b", issue = "160630")]
impl fmt::LowerExp for f16b {
    #[inline]
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        fmt::LowerExp::fmt(&widen(*self), formatter)
    }
}

#[cfg(not(no_fp_fmt_parse))]
#[unstable(feature = "f16b", issue = "160630")]
impl fmt::UpperExp for f16b {
    #[inline]
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        fmt::UpperExp::fmt(&widen(*self), formatter)
    }
}
