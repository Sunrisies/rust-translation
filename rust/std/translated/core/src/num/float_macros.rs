#[rustc_macro_transparency = "semiopaque"]
pub(crate) macro float_impl(
    Self = $SelfT:ty,
    Bits = $BitsT:ty,
    SignedBits = $SignedBitsT:ty,
    // Constants
    BITS = $BITS:literal,
    MANTISSA_DIGITS = $MANTISSA_DIGITS:literal,
    DIGITS = $DIGITS:literal,
    EPSILON = $EPSILON:literal,
    MIN = $MIN:literal,
    MIN_POSITIVE = $MIN_POSITIVE:literal,
    MAX = $MAX:literal,
    MIN_EXP = $MIN_EXP:literal,
    MAX_EXP = $MAX_EXP:literal,
    MIN_10_EXP = $MIN_10_EXP:literal,
    MAX_10_EXP = $MAX_10_EXP:literal,
    SIGN_MASK = $SIGN_MASK:literal,
    EXPONENT_MASK = $EXPONENT_MASK:literal,
    MANTISSA_MASK = $MANTISSA_MASK:literal,
    // Values for docs
    exponent_bias = $exponent_bias:literal,
    // Feature gates
    assoc_int_consts = #[$assoc_int_consts:meta],
    float_bits_const = #[$float_bits_const:meta],
    // Things needed for `f16`/`f128` doctests
    $(feature = $feature:ident,)?
    $(has_reliable_cfg = $has_reliable_cfg:ident,)?
    $(has_reliable_math_cfg = $has_reliable_math_cfg:ident,)?
) {

    /// 内部表示的基数或底数
    #[doc = concat!("`", stringify!($SelfT), "`.")]
    #[$assoc_int_consts]
    pub const RADIX: u32 = 2;

    /// 此浮点类型在位上的大小。
    #[$float_bits_const]
    pub const BITS: u32 = $BITS;

    /// 二进制表示中有效数字的个数。
    ///
    /// 注意，在位运算表示中，尾数的大小比这小一个单位，因为前导 1 不会显式存储。
    /// 因为前导 1 没有存储。
    #[$assoc_int_consts]
    pub const MANTISSA_DIGITS: u32 = $MANTISSA_DIGITS;

    /// 十进制下有效数字的大约个数。
    ///
    /// This is the maximum <i>x</i> such that any decimal number with <i>x</i>
    /// 的有效数字都可以被转换回去而不丢失。
    #[doc = concat!("`", stringify!($SelfT), "`")]
    /// and back without loss.
    ///
    /// Equal to floor(log<sub>10</sub>&nbsp;2<sup>[`MANTISSA_DIGITS`]&nbsp;&minus;&nbsp;1</sup>).
    ///
    /// [`MANTISSA_DIGITS`]: Self::MANTISSA_DIGITS
    #[$assoc_int_consts]
    pub const DIGITS: u32 = $DIGITS;

    /// [机器epsilon] 值对于
    #[doc = concat!("`", stringify!($SelfT), "`.")]
    ///
    /// This is the difference between `1.0` and the next larger representable number.
    ///
    /// Equal to 2<sup>1&nbsp;&minus;&nbsp;[`MANTISSA_DIGITS`]</sup>.
    ///
    /// [Machine epsilon]: https://en.wikipedia.org/wiki/Machine_epsilon
    /// [`MANTISSA_DIGITS`]: Self::MANTISSA_DIGITS
    #[$assoc_int_consts]
    #[rustc_diagnostic_item = concat!(stringify!($SelfT), "_epsilon")]
    pub const EPSILON: Self = $EPSILON;

    /// 最小的有限
    #[doc = concat!("`", stringify!($SelfT), "`")]
    /// 值。
    ///
    /// Equal to &minus;[`MAX`].
    ///
    /// [`MAX`]: Self::MAX
    #[$assoc_int_consts]
    pub const MIN: Self = $MIN;
    /// 最小的正正常
    #[doc = concat!("`", stringify!($SelfT), "`")]
    /// 值。
    ///
    /// Equal to 2<sup>[`MIN_EXP`]&nbsp;&minus;&nbsp;1</sup>.
    ///
    /// [`MIN_EXP`]: Self::MIN_EXP
    #[$assoc_int_consts]
    pub const MIN_POSITIVE: Self = $MIN_POSITIVE;
    /// 最大的有限
    #[doc = concat!("`", stringify!($SelfT), "`")]
    /// 值。
    ///
    /// 等于
    /// (1&nbsp;&minus;&nbsp;2<sup>&minus;[`MANTISSA_DIGITS`]</sup>)&nbsp;2<sup>[`MAX_EXP`]</sup>.
    ///
    /// [`MANTISSA_DIGITS`]: Self::MANTISSA_DIGITS
    /// [`MAX_EXP`]: Self::MAX_EXP
    #[$assoc_int_consts]
    pub const MAX: Self = $MAX;

    /// 大于最小可能的 *正常* 2 的幂指数
    /// 对于范围在 1 ≤ x < 2 之间的有效数（即 IEEE 定义）。
    ///
    /// 这对应于最小可能的 *正常* 2 的幂指数
    /// 对于范围在 0.5 ≤ x < 1 之间的有效数（即 C 定义）。
    /// 换句话说，此类型可以表示的所有正常数都是
    /// greater than or equal to 0.5&nbsp;×&nbsp;2<sup><i>MIN_EXP</i></sup>.
    #[$assoc_int_consts]
    pub const MIN_EXP: i32 = $MIN_EXP;
    /// 大于最大可能的 2 的幂指数
    /// 对于范围在 1 ≤ x < 2 之间的有效数（即 IEEE 定义）。
    ///
    /// 这对应于最大可能的 2 的幂指数
    /// 对于范围在 0.5 ≤ x < 1 之间的有效数（即 C 定义）。
    /// 换句话说，此类型可以表示的所有数都是
    /// strictly less than 2<sup><i>MAX_EXP</i></sup>.
    #[$assoc_int_consts]
    pub const MAX_EXP: i32 = $MAX_EXP;

    /// Minimum <i>x</i> for which 10<sup><i>x</i></sup> is normal.
    ///
    /// Equal to ceil(log<sub>10</sub>&nbsp;[`MIN_POSITIVE`]).
    ///
    /// [`MIN_POSITIVE`]: Self::MIN_POSITIVE
    #[$assoc_int_consts]
    pub const MIN_10_EXP: i32 = $MIN_10_EXP;
    /// Maximum <i>x</i> for which 10<sup><i>x</i></sup> is normal.
    ///
    /// Equal to floor(log<sub>10</sub>&nbsp;[`MAX`]).
    ///
    /// [`MAX`]: Self::MAX
    #[$assoc_int_consts]
    pub const MAX_10_EXP: i32 = $MAX_10_EXP;

    /// 非数字 (NaN)。
    ///
    /// 注意，IEEE 754 并没有定义单一的 NaN 值；许多位模式都被视为 NaN。此外，标准还区分“信号”和
    /// considered to be NaN. Furthermore, the standard makes a difference between a "signaling" and
    /// 一个“静默”的 NaN 值，并允许检查其“有效载荷”（位模式中的未指定位）。
    /// and its sign. See the [specification of NaN bit patterns](f32#nan-bit-patterns) for more
    /// 信息。
    ///
    /// 该常量保证为静默 NaN（在遵循 Rust 假设的目标上）。
    /// 此外，这里选择的特定位模式没有其他保证：有效载荷和符号都是任意的。
    /// 具体的位模式可能会随着 Rust 版本和目标平台的变化而变化。
    /// 无穷大 (∞)。
    #[$assoc_int_consts]
    #[rustc_diagnostic_item = concat!(stringify!($SelfT), "_nan")]
    #[allow(clippy::eq_op, clippy::zero_divided_by_zero)]
    pub const NAN: Self = 0.0 / 0.0;
    /// 负无穷大 (−∞)。
    #[$assoc_int_consts]
    pub const INFINITY: Self = 1.0 / 0.0;
    /// 可以精确表示的最大整数。
    #[$assoc_int_consts]
    pub const NEG_INFINITY: Self = -1.0 / 0.0;

    /// 在没有任何其他整数转换为相同浮点值的情况下，能在某个值中精确表示的极大值整数。
    #[doc = concat!("[`", stringify!($SelfT), "`]")]
    /// value, with no other integer converting to the same floating point value.
    ///
    /// For an integer `x` which satisfies `MIN_EXACT_INTEGER <= x <= MAX_EXACT_INTEGER`,
    /// there is a "one-to-one" mapping between
    #[doc = concat!(" [`", stringify!($SignedBitsT), "`]")]
    /// 和
    #[doc = concat!("[`", stringify!($SelfT), "`]")]
    /// values. `MAX_EXACT_INTEGER + 1` also converts losslessly to
    #[doc = concat!("[`", stringify!($SelfT), "`]")]
    /// 和
    #[doc = concat!("[`", stringify!($SignedBitsT), "`],")]
    /// but `MAX_EXACT_INTEGER + 2` converts to the same
    #[doc = concat!("[`", stringify!($SelfT), "`]")]
    /// value (and back to `MAX_EXACT_INTEGER + 1` as an integer) so there is not a
    /// 在没有任何其他整数转换为相同浮点值的情况下，能在某个值中精确表示的最小整数。
    ///
    /// [`MAX_EXACT_INTEGER`]: Self::MAX_EXACT_INTEGER
    /// [`MIN_EXACT_INTEGER`]: Self::MIN_EXACT_INTEGER
    /// ```
    $(#[doc = concat!("#![feature(", stringify!($feature), ")]")])?
    /// #![feature(float_exact_integer_constants)]
    /// # // FIXME(#152635): Float rounding on `i586` does not adhere to IEEE 754
    /// # #[cfg(not(all(target_arch = "x86", not(target_feature = "sse"))))] {
    $(#[doc = concat!("# #[cfg(", stringify!($has_reliable_cfg), ")] {")])?
    #[doc = concat!("let max_exact_int = ", stringify!($SelfT), "::MAX_EXACT_INTEGER;")]
    #[doc = concat!("assert_eq!(max_exact_int, max_exact_int as ", stringify!($SelfT), " as ", stringify!($SignedBitsT), ");")]
    #[doc = concat!("assert_eq!(max_exact_int + 1, (max_exact_int + 1) as ", stringify!($SelfT), " as ", stringify!($SignedBitsT), ");")]
    #[doc = concat!("assert_ne!(max_exact_int + 2, (max_exact_int + 2) as ", stringify!($SelfT), " as ", stringify!($SignedBitsT), ");")]
    ///
    #[doc = concat!("// Beyond `", stringify!($SelfT), "::MAX_EXACT_INTEGER`, multiple integers can map to one float value")]
    #[doc = concat!("assert_eq!((max_exact_int + 1) as ", stringify!($SelfT), ", (max_exact_int + 2) as ", stringify!($SelfT), ");")]
    #[doc = concat!("# }" $(${ignore($has_reliable_cfg)}, "}")?)]
    /// ```
    #[unstable(feature = "float_exact_integer_constants", issue = "152466")]
    pub const MAX_EXACT_INTEGER: $SignedBitsT = (1 << Self::MANTISSA_DIGITS) - 1;

    /// 可以精确表示的最小整数。
    #[doc = concat!("[`", stringify!($SelfT), "`]")]
    /// 在没有任何其他整数转换为相同浮点值的情况下，能在某个值中精确表示的极小值。
    ///
    /// For an integer `x` which satisfies `MIN_EXACT_INTEGER <= x <= MAX_EXACT_INTEGER`,
    /// 和
    #[doc = concat!(" [`", stringify!($SignedBitsT), "`]")]
    /// 值之间存在“一一对应”的映射关系。
    #[doc = concat!("[`", stringify!($SelfT), "`]")]
    /// values. `MAX_EXACT_INTEGER + 1` also converts losslessly to
    #[doc = concat!("[`", stringify!($SelfT), "`]")]
    /// 和
    #[doc = concat!(" [`", stringify!($SignedBitsT), "`],")]
    /// but `MAX_EXACT_INTEGER + 2` converts to the same
    #[doc = concat!("[`", stringify!($SelfT), "`]")]
    /// value (and back to `MAX_EXACT_INTEGER + 1` as an integer) so there is not a
    /// “一一对应”的映射关系。
    ///
    /// This constant is equivalent to `-MAX_EXACT_INTEGER`.
    ///
    /// [`MAX_EXACT_INTEGER`]: Self::MAX_EXACT_INTEGER
    /// [`MIN_EXACT_INTEGER`]: Self::MIN_EXACT_INTEGER
    /// ```
    $(#[doc = concat!("#![feature(", stringify!($feature), ")]")])?
    /// #![feature(float_exact_integer_constants)]
    /// # // FIXME(#152635): Float rounding on `i586` does not adhere to IEEE 754
    /// # #[cfg(not(all(target_arch = "x86", not(target_feature = "sse"))))] {
    $(#[doc = concat!("# #[cfg(", stringify!($has_reliable_cfg), ")] {")])?
    #[doc = concat!("let min_exact_int = ", stringify!($SelfT), "::MIN_EXACT_INTEGER;")]
    #[doc = concat!("assert_eq!(min_exact_int, min_exact_int as ", stringify!($SelfT), " as ", stringify!($SignedBitsT), ");")]
    #[doc = concat!("assert_eq!(min_exact_int - 1, (min_exact_int - 1) as ", stringify!($SelfT), " as ", stringify!($SignedBitsT), ");")]
    #[doc = concat!("assert_ne!(min_exact_int - 2, (min_exact_int - 2) as ", stringify!($SelfT), " as ", stringify!($SignedBitsT), ");")]
    ///
    #[doc = concat!("// Below `", stringify!($SelfT), "::MIN_EXACT_INTEGER`, multiple integers can map to one float value")]
    #[doc = concat!("assert_eq!((min_exact_int - 1) as ", stringify!($SelfT), ", (min_exact_int - 2) as ", stringify!($SelfT), ");")]
    #[doc = concat!("# }" $(${ignore($has_reliable_cfg)}, "}")?)]
    /// ```
    #[unstable(feature = "float_exact_integer_constants", issue = "152466")]
    pub const MIN_EXACT_INTEGER: $SignedBitsT = -Self::MAX_EXACT_INTEGER;

    /// 用于编码符号位的掩码。
    #[doc = concat!("[`", stringify!($SelfT), "`].")]
    ///
    /// 当符号为负时设置该位，当符号为正时不设置该位。
    /// 正号。
    /// 如果只需要检查值是正还是负，
    /// [`is_sign_positive`] or [`is_sign_negative`] can be used.
    ///
    /// [`is_sign_positive`]: Self::is_sign_positive
    /// [`is_sign_negative`]: Self::is_sign_negative
    /// ```
    /// #![feature(float_masks)]
    $(#[doc = concat!("#![feature(", stringify!($feature), ")]")])?
    $(#[doc = concat!("# #[cfg(", stringify!($has_reliable_cfg), ")] {")])?
    #[doc = concat!("let sign_mask = ", stringify!($SelfT), "::SIGN_MASK;")]
    #[doc = concat!("let a = 1.6552", stringify!($SelfT), ";")]
    /// let a_bits = a.to_bits();
    ///
    /// assert_eq!(a_bits & sign_mask, 0x0);
    #[doc = concat!("assert_eq!(", stringify!($SelfT), "::from_bits(a_bits ^ sign_mask), -a);")]
    #[doc = concat!("assert_eq!(sign_mask, (-0.0", stringify!($SelfT), ").to_bits());")]
    $(${ignore($has_reliable_cfg)}
        /// # }
    )?
    /// ```
    #[unstable(feature = "float_masks", issue = "154064")]
    pub const SIGN_MASK: $BitsT = $SIGN_MASK;

    /// 用于编码指数的位掩码。
    #[doc = concat!("[`", stringify!($SelfT), "`].")]
    ///
    /// 注意，指数以有偏值存储，偏置为
    #[doc = stringify!($exponent_bias)]
    /// 对于
    #[doc = concat!("`", stringify!($SelfT), "`.")]
    ///
    /// ```
    /// #![feature(float_masks)]
    $(#[doc = concat!("#![feature(", stringify!($feature), ")]")])?
    $(#[doc = concat!("# #[cfg(", stringify!($has_reliable_cfg), ")] {")])?
    #[doc = concat!("fn get_exp(a: ", stringify!($SelfT), ") -> ", stringify!($SignedBitsT), " {")]
    #[doc = concat!("    let bias = ", $exponent_bias, ";")]
    #[doc = concat!("    let biased = a.to_bits() & ", stringify!($SelfT), "::EXPONENT_MASK;")]
    #[doc = concat!("    (biased >> (", stringify!($SelfT), "::MANTISSA_DIGITS - 1)).cast_signed() - bias")]
    /// }
    ///
    /// assert_eq!(get_exp(0.5), -1);
    /// assert_eq!(get_exp(1.0), 0);
    /// assert_eq!(get_exp(2.0), 1);
    /// assert_eq!(get_exp(4.0), 2);
    $(${ignore($has_reliable_cfg)}
        /// # }
    )?
    /// ```
    #[unstable(feature = "float_masks", issue = "154064")]
    pub const EXPONENT_MASK: $BitsT = $EXPONENT_MASK;

    /// 用于编码尾数位的位掩码。
    #[doc = concat!("[`", stringify!($SelfT), "`].")]
    ///
    /// ```rust
    /// #![feature(float_masks)]
    $(#[doc = concat!("#![feature(", stringify!($feature), ")]")])?
    $(#[doc = concat!("# #[cfg(", stringify!($has_reliable_cfg), ")] {")])?
    #[doc = concat!("let mantissa_mask = ", stringify!($SelfT), "::MANTISSA_MASK;")]
    ///
    #[doc = concat!("assert_eq!(0", stringify!($SelfT), ".to_bits() & mantissa_mask, 0x0);")]
    #[doc = concat!("assert_eq!(1", stringify!($SelfT), ".to_bits() & mantissa_mask, 0x0);")]
    ///
    /// // multiplying a finite value by a power of 2 doesn't change its mantissa
    /// // unless the result or initial value is not normal.
    #[doc = concat!("let a = 1.6552", stringify!($SelfT), ";")]
    /// let b = 4.0 * a;
    /// assert_eq!(a.to_bits() & mantissa_mask, b.to_bits() & mantissa_mask);
    ///
    /// // The maximum and minimum values have a saturated significand
    #[doc = concat!("assert_eq!(", stringify!($SelfT), "::MAX.to_bits() & ", stringify!($SelfT), "::MANTISSA_MASK, ", stringify!($SelfT), "::MANTISSA_MASK);")]
    #[doc = concat!("assert_eq!(", stringify!($SelfT), "::MIN.to_bits() & ", stringify!($SelfT), "::MANTISSA_MASK, ", stringify!($SelfT), "::MANTISSA_MASK);")]
    $(${ignore($has_reliable_cfg)}
        /// # }
    )?
    /// ```
    #[unstable(feature = "float_masks", issue = "154064")]
    pub const MANTISSA_MASK: $BitsT = $MANTISSA_MASK;

    /// 最小可表示的正数（最小次正规数）。
    const TINY_BITS: $BitsT = 0x1;

    /// 最小可表示的负数（最小负次正规数）。
    const NEG_TINY_BITS: $BitsT = Self::TINY_BITS | Self::SIGN_MASK;
}
