macro_rules! uint_impl {
    (
        Self = $SelfT:ty,
        ActualT = $ActualT:ident,
        SignedT = $SignedT:ident,

        // These are all for use *only* in doc comments.
        // As such, they're all passed as literals -- passing them as a string
        // literal is fine if they need to be multiple code tokens.
        // In non-comments, use the associated constants rather than these.
        BITS = $BITS:literal,
        BITS_MINUS_ONE = $BITS_MINUS_ONE:literal,
        MAX = $MaxV:literal,
        rot = $rot:literal,
        rot_op = $rot_op:literal,
        rot_result = $rot_result:literal,
        fsh_op = $fsh_op:literal,
        fshl_result = $fshl_result:literal,
        fshr_result = $fshr_result:literal,
        clmul_lhs = $clmul_lhs:literal,
        clmul_rhs = $clmul_rhs:literal,
        clmul_result = $clmul_result:literal,
        swap_op = $swap_op:literal,
        swapped = $swapped:literal,
        reversed = $reversed:literal,
        le_bytes = $le_bytes:literal,
        be_bytes = $be_bytes:literal,
        to_xe_bytes_doc = $to_xe_bytes_doc:expr,
        from_xe_bytes_doc = $from_xe_bytes_doc:expr,
        bound_condition = $bound_condition:literal,
    ) => {
        /// 该整数类型能够表示的最小值。
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(", stringify!($SelfT), "::MIN, 0);")]
        /// ```
        #[stable(feature = "assoc_int_consts", since = "1.43.0")]
        pub const MIN: Self = 0;

        /// 该整数类型能够表示的最大值
        #[doc = concat!("(2<sup>", $BITS, "</sup> &minus; 1", $bound_condition, ").")]
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(", stringify!($SelfT), "::MAX, ", stringify!($MaxV), ");")]
        /// ```
        #[stable(feature = "assoc_int_consts", since = "1.43.0")]
        pub const MAX: Self = !0;

        /// 该整数类型在比特数上的大小。
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(", stringify!($SelfT), "::BITS, ", stringify!($BITS), ");")]
        /// ```
        #[stable(feature = "int_bits_const", since = "1.53.0")]
        pub const BITS: u32 = Self::MAX.count_ones();

        /// 测试特定比特的值。
        ///
        /// # 恐慌
        ///
        /// If overflow checks are enabled, this method will panic if the provided index is
        /// greater than or equal to [`BITS`].
        ///
        /// [`BITS`]: Self::BITS
        ///
        /// # 设置特定比特的值。
        ///
        /// ```
        /// #![feature(get_set_bit)]
        ///
        #[doc = concat!("let n = 0b0111_1001", stringify!($SelfT), ";")]
        ///
        /// assert!(n.bit(0));
        /// assert!(!n.bit(1));
        /// assert!(!n.bit(2));
        /// assert!(n.bit(3));
        /// assert!(n.bit(4));
        /// assert!(n.bit(5));
        /// assert!(n.bit(6));
        /// assert!(!n.bit(7));
        /// ```
        #[unstable(feature = "get_set_bit", issue = "147702")]
        #[rustc_const_unstable(feature = "get_set_bit", issue = "147702")]
        #[rustc_inherit_overflow_checks]
        #[inline]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[track_caller]
        pub const fn bit(self, index: u32) -> bool {
            (self & (1 << index)) != 0
        }

        /// 设置特定比特的值。
        ///
        /// # 恐慌
        ///
        /// If overflow checks are enabled, this method will panic if the provided index is
        /// greater than or equal [`BITS`].
        ///
        /// [`BITS`]: Self::BITS
        ///
        /// # 示例
        ///
        /// ```
        /// #![feature(get_set_bit)]
        ///
        #[doc = concat!("let mut n = 0b0101_0101", stringify!($SelfT), ";")]
        ///
        /// n = n.set_bit(0, false);
        /// n = n.set_bit(1, true);
        /// n = n.set_bit(2, false);
        /// n = n.set_bit(3, true);
        /// n = n.set_bit(4, false);
        /// n = n.set_bit(5, true);
        /// n = n.set_bit(6, false);
        /// n = n.set_bit(7, true);
        ///
        /// assert_eq!(n, 0b1010_1010);
        /// ```
        #[unstable(feature = "get_set_bit", issue = "147702")]
        #[rustc_const_unstable(feature = "get_set_bit", issue = "147702")]
        #[rustc_inherit_overflow_checks]
        #[inline]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[track_caller]
        pub const fn set_bit(mut self, index: u32, value: bool) -> Self {
            self &= !(1 << index);
            self |= (value as $SelfT) << index;

            self
        }

        /// Returns the number of ones in the binary representation of `self`.
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("let n = 0b01001100", stringify!($SelfT), ";")]
        /// assert_eq!(n.count_ones(), 3);
        ///
        #[doc = concat!("let max = ", stringify!($SelfT),"::MAX;")]
        #[doc = concat!("assert_eq!(max.count_ones(), ", stringify!($BITS), ");")]
        ///
        #[doc = concat!("let zero = 0", stringify!($SelfT), ";")]
        /// assert_eq!(zero.count_ones(), 0);
        /// ```
        #[stable(feature = "rust1", since = "1.0.0")]
        #[rustc_const_stable(feature = "const_math", since = "1.32.0")]
        #[doc(alias = "popcount")]
        #[doc(alias = "popcnt")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline(always)]
        pub const fn count_ones(self) -> u32 {
            return intrinsics::ctpop(self);
        }

        /// Returns the number of zeros in the binary representation of `self`.
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("let zero = 0", stringify!($SelfT), ";")]
        #[doc = concat!("assert_eq!(zero.count_zeros(), ", stringify!($BITS), ");")]
        ///
        #[doc = concat!("let max = ", stringify!($SelfT),"::MAX;")]
        /// assert_eq!(max.count_zeros(), 0);
        /// ```
        ///
        /// 这严重依赖于类型的宽度，因此根据类型推断可能会产生意外结果：
        /// might give surprising results depending on type inference:
        /// ```
        /// # fn foo(_: u8) {}
        /// # fn bar(_: u16) {}
        /// let lucky = 7;
        /// foo(lucky);
        /// assert_eq!(lucky.count_zeros(), 5);
        /// assert_eq!(lucky.count_ones(), 3);
        ///
        /// let lucky = 7;
        /// bar(lucky);
        /// assert_eq!(lucky.count_zeros(), 13);
        /// assert_eq!(lucky.count_ones(), 3);
        /// ```
        /// You might want to use [`Self::count_ones`] instead, or emphasize
        /// the type you're using in the call rather than method syntax:
        /// ```
        /// let small = 1;
        #[doc = concat!("assert_eq!(", stringify!($SelfT), "::count_zeros(small), ", stringify!($BITS_MINUS_ONE) ,");")]
        /// ```
        #[stable(feature = "rust1", since = "1.0.0")]
        #[rustc_const_stable(feature = "const_math", since = "1.32.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline(always)]
        pub const fn count_zeros(self) -> u32 {
            (!self).count_ones()
        }

        /// Returns the number of leading zeros in the binary representation of `self`.
        ///
        /// 根据您对值的使用方式，您可能还对
        /// [`ilog2`] function which returns a consistent number, even if the type widens.
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("let n = ", stringify!($SelfT), "::MAX >> 2;")]
        /// assert_eq!(n.leading_zeros(), 2);
        ///
        #[doc = concat!("let zero = 0", stringify!($SelfT), ";")]
        #[doc = concat!("assert_eq!(zero.leading_zeros(), ", stringify!($BITS), ");")]
        ///
        #[doc = concat!("let max = ", stringify!($SelfT),"::MAX;")]
        /// assert_eq!(max.leading_zeros(), 0);
        /// ```
        #[doc = concat!("[`ilog2`]: ", stringify!($SelfT), "::ilog2")]
        #[stable(feature = "rust1", since = "1.0.0")]
        #[rustc_const_stable(feature = "const_math", since = "1.32.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline(always)]
        pub const fn leading_zeros(self) -> u32 {
            return intrinsics::ctlz(self as $ActualT);
        }

        /// 返回二进制表示中尾随零的数量。
        /// of `self`.
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("let n = 0b0101000", stringify!($SelfT), ";")]
        /// assert_eq!(n.trailing_zeros(), 3);
        ///
        #[doc = concat!("let zero = 0", stringify!($SelfT), ";")]
        #[doc = concat!("assert_eq!(zero.trailing_zeros(), ", stringify!($BITS), ");")]
        ///
        #[doc = concat!("let max = ", stringify!($SelfT),"::MAX;")]
        #[doc = concat!("assert_eq!(max.trailing_zeros(), 0);")]
        /// ```
        #[stable(feature = "rust1", since = "1.0.0")]
        #[rustc_const_stable(feature = "const_math", since = "1.32.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline(always)]
        pub const fn trailing_zeros(self) -> u32 {
            return intrinsics::cttz(self);
        }

        /// Returns the number of leading ones in the binary representation of `self`.
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("let n = !(", stringify!($SelfT), "::MAX >> 2);")]
        /// assert_eq!(n.leading_ones(), 2);
        ///
        #[doc = concat!("let zero = 0", stringify!($SelfT), ";")]
        /// assert_eq!(zero.leading_ones(), 0);
        ///
        #[doc = concat!("let max = ", stringify!($SelfT),"::MAX;")]
        #[doc = concat!("assert_eq!(max.leading_ones(), ", stringify!($BITS), ");")]
        /// ```
        #[stable(feature = "leading_trailing_ones", since = "1.46.0")]
        #[rustc_const_stable(feature = "leading_trailing_ones", since = "1.46.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline(always)]
        pub const fn leading_ones(self) -> u32 {
            (!self).leading_zeros()
        }

        /// 返回二进制表示中尾随1的数量。
        /// of `self`.
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("let n = 0b1010111", stringify!($SelfT), ";")]
        /// assert_eq!(n.trailing_ones(), 3);
        ///
        #[doc = concat!("let zero = 0", stringify!($SelfT), ";")]
        /// assert_eq!(zero.trailing_ones(), 0);
        ///
        #[doc = concat!("let max = ", stringify!($SelfT),"::MAX;")]
        #[doc = concat!("assert_eq!(max.trailing_ones(), ", stringify!($BITS), ");")]
        /// ```
        #[stable(feature = "leading_trailing_ones", since = "1.46.0")]
        #[rustc_const_stable(feature = "leading_trailing_ones", since = "1.46.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline(always)]
        pub const fn trailing_ones(self) -> u32 {
            (!self).trailing_zeros()
        }

        /// Returns the minimum number of bits required to represent `self`.
        ///
        /// This method returns zero if `self` is zero.
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(0_", stringify!($SelfT), ".bit_width(), 0);")]
        #[doc = concat!("assert_eq!(0b111_", stringify!($SelfT), ".bit_width(), 3);")]
        #[doc = concat!("assert_eq!(0b1110_", stringify!($SelfT), ".bit_width(), 4);")]
        #[doc = concat!("assert_eq!(", stringify!($SelfT), "::MAX.bit_width(), ", stringify!($BITS), ");")]
        /// ```
        #[stable(feature = "uint_bit_width", since = "1.97.0")]
        #[rustc_const_stable(feature = "uint_bit_width", since = "1.97.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline(always)]
        pub const fn bit_width(self) -> u32 {
            Self::BITS - self.leading_zeros()
        }

        /// Returns `self` with only the most significant bit set, or `0` if
        /// the input is `0`.
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("let n: ", stringify!($SelfT), " = 0b_01100100;")]
        ///
        /// assert_eq!(n.isolate_highest_one(), 0b_01000000);
        #[doc = concat!("assert_eq!(0_", stringify!($SelfT), ".isolate_highest_one(), 0);")]
        /// ```
        #[stable(feature = "isolate_most_least_significant_one", since = "1.97.0")]
        #[rustc_const_stable(feature = "isolate_most_least_significant_one", since = "1.97.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline(always)]
        pub const fn isolate_highest_one(self) -> Self {
            self & (((1 as $SelfT) << (<$SelfT>::BITS - 1)).wrapping_shr(self.leading_zeros()))
        }

        /// Returns `self` with only the least significant bit set, or `0` if
        /// the input is `0`.
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("let n: ", stringify!($SelfT), " = 0b_01100100;")]
        ///
        /// assert_eq!(n.isolate_lowest_one(), 0b_00000100);
        #[doc = concat!("assert_eq!(0_", stringify!($SelfT), ".isolate_lowest_one(), 0);")]
        /// ```
        #[stable(feature = "isolate_most_least_significant_one", since = "1.97.0")]
        #[rustc_const_stable(feature = "isolate_most_least_significant_one", since = "1.97.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline(always)]
        pub const fn isolate_lowest_one(self) -> Self {
            self & self.wrapping_neg()
        }

        /// Returns the index of the highest bit set to one in `self`, or `None`
        /// if `self` is `0`.
        ///
        /// Note that this is equivalent to [`checked_ilog2`](Self::checked_ilog2).
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(0b0_", stringify!($SelfT), ".highest_one(), None);")]
        #[doc = concat!("assert_eq!(0b1_", stringify!($SelfT), ".highest_one(), Some(0));")]
        #[doc = concat!("assert_eq!(0b1_0000_", stringify!($SelfT), ".highest_one(), Some(4));")]
        #[doc = concat!("assert_eq!(0b1_1111_", stringify!($SelfT), ".highest_one(), Some(4));")]
        /// ```
        #[stable(feature = "int_lowest_highest_one", since = "1.97.0")]
        #[rustc_const_stable(feature = "int_lowest_highest_one", since = "1.97.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline(always)]
        pub const fn highest_one(self) -> Option<u32> {
            match NonZero::new(self) {
                Some(v) => Some(v.highest_one()),
                None => None,
            }
        }

        /// Returns the index of the lowest bit set to one in `self`, or `None`
        /// if `self` is `0`.
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(0b0_", stringify!($SelfT), ".lowest_one(), None);")]
        #[doc = concat!("assert_eq!(0b1_", stringify!($SelfT), ".lowest_one(), Some(0));")]
        #[doc = concat!("assert_eq!(0b1_0000_", stringify!($SelfT), ".lowest_one(), Some(4));")]
        #[doc = concat!("assert_eq!(0b1_1111_", stringify!($SelfT), ".lowest_one(), Some(0));")]
        /// ```
        #[stable(feature = "int_lowest_highest_one", since = "1.97.0")]
        #[rustc_const_stable(feature = "int_lowest_highest_one", since = "1.97.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline(always)]
        pub const fn lowest_one(self) -> Option<u32> {
            match NonZero::new(self) {
                Some(v) => Some(v.lowest_one()),
                None => None,
            }
        }

        /// Returns the bit pattern of `self` reinterpreted as a signed integer of the same size.
        ///
        /// This produces the same result as an `as` cast, but ensures that the bit-width remains
        /// # 示例
        ///
        /// # Examples
        ///
        /// ```
        #[doc = concat!("let n = ", stringify!($SelfT), "::MAX;")]
        ///
        #[doc = concat!("assert_eq!(n.cast_signed(), -1", stringify!($SignedT), ");")]
        /// ```
        #[stable(feature = "integer_sign_cast", since = "1.87.0")]
        #[rustc_const_stable(feature = "integer_sign_cast", since = "1.87.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline(always)]
        pub const fn cast_signed(self) -> $SignedT {
            self as $SignedT
        }

        /// Saturating conversion of `self` to a signed integer of the same size.
        ///
        /// The signed integer's maximum value is returned if `self` is larger
        /// 关于其他类型的有符号整数转换，请参见
        ///
        /// # 示例
        /// [`cast_signed`](Self::cast_signed),
        /// [`checked_cast_signed`](Self::checked_cast_signed),
        /// or [`strict_cast_signed`](Self::strict_cast_signed).
        ///
        /// # 示例
        ///
        /// ```
        /// #![feature(integer_cast_extras)]
        #[doc = concat!("let n = ", stringify!($SelfT), "::MAX;")]
        ///
        #[doc = concat!("assert_eq!(n.saturating_cast_signed(), ", stringify!($SignedT), "::MAX);")]
        #[doc = concat!("assert_eq!(64", stringify!($SelfT), ".saturating_cast_signed(), 64", stringify!($SignedT), ");")]
        /// ```
        #[rustc_const_unstable(feature = "integer_cast_extras", issue = "154650")]
        #[unstable(feature = "integer_cast_extras", issue = "154650")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline(always)]
        pub const fn saturating_cast_signed(self) -> $SignedT {
            // Clamp to the signed integer max size, which is ActualT::MAX >> 1.
            if self <= <$SignedT>::MAX.cast_unsigned() {
                self.cast_signed()
            } else {
                <$SignedT>::MAX
            }
        }

        /// Checked conversion of `self` to a signed integer of the same size,
        /// returning `None` if `self` is larger than the signed integer's
        /// 关于其他类型的有符号整数转换，请参见
        ///
        /// # 示例
        /// [`cast_signed`](Self::cast_signed),
        /// [`saturating_cast_signed`](Self::saturating_cast_signed),
        /// or [`strict_cast_signed`](Self::strict_cast_signed).
        ///
        /// # 示例
        ///
        /// ```
        /// #![feature(integer_cast_extras)]
        #[doc = concat!("let n = ", stringify!($SelfT), "::MAX;")]
        ///
        #[doc = concat!("assert_eq!(n.checked_cast_signed(), None);")]
        #[doc = concat!("assert_eq!(64", stringify!($SelfT), ".checked_cast_signed(), Some(64", stringify!($SignedT), "));")]
        /// ```
        #[rustc_const_unstable(feature = "integer_cast_extras", issue = "154650")]
        #[unstable(feature = "integer_cast_extras", issue = "154650")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline(always)]
        pub const fn checked_cast_signed(self) -> Option<$SignedT> {
            if self <= <$SignedT>::MAX.cast_unsigned() {
                Some(self.cast_signed())
            } else {
                None
            }
        }

        /// Strict conversion of `self` to a signed integer of the same size,
        /// which panics if `self` is larger than the signed integer's maximum
        /// 关于其他类型的有符号整数转换，请参见
        ///
        /// # 示例
        /// [`cast_signed`](Self::cast_signed),
        /// [`checked_cast_signed`](Self::checked_cast_signed),
        /// or [`saturating_cast_signed`](Self::saturating_cast_signed).
        ///
        /// # 示例
        ///
        /// ```should_panic
        /// #![feature(integer_cast_extras)]
        #[doc = concat!("let _ = ", stringify!($SelfT), "::MAX.strict_cast_signed();")]
        /// ```
        #[rustc_const_unstable(feature = "integer_cast_extras", issue = "154650")]
        #[unstable(feature = "integer_cast_extras", issue = "154650")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        #[track_caller]
        pub const fn strict_cast_signed(self) -> $SignedT {
            match self.checked_cast_signed() {
                Some(n) => n,
                None => imp::overflow_panic::cast_integer(),
            }
        }

        /// Shifts the bits to the left by a specified amount, `n`,
        /// 并将被截断的位环绕到结果整数的末尾。
        ///
        /// `rotate_left(n)` is equivalent to applying `rotate_left(1)` a total of `n` times. In
        /// particular, a rotation by the number of bits in `self` returns the input value
        /// unchanged.
        ///
        /// Please note this isn't the same operation as the `<<` shifting operator!
        ///
        /// # Examples
        ///
        /// ```
        #[doc = concat!("let n = ", $rot_op, stringify!($SelfT), ";")]
        #[doc = concat!("let m = ", $rot_result, ";")]
        ///
        #[doc = concat!("assert_eq!(n.rotate_left(", $rot, "), m);")]
        #[doc = concat!("assert_eq!(n.rotate_left(1024), n);")]
        /// ```
        #[stable(feature = "rust1", since = "1.0.0")]
        #[rustc_const_stable(feature = "const_math", since = "1.32.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline(always)]
        #[rustc_allow_const_fn_unstable(const_trait_impl)] // for the intrinsic fallback
        pub const fn rotate_left(self, n: u32) -> Self {
            return intrinsics::rotate_left(self, n);
        }

        /// Shifts the bits to the right by a specified amount, `n`,
        /// 关于其他类型的有符号整数转换，请参见
        /// # 示例
        ///
        /// `rotate_right(n)` is equivalent to applying `rotate_right(1)` a total of `n` times. In
        /// particular, a rotation by the number of bits in `self` returns the input value
        /// unchanged.
        ///
        /// Please note this isn't the same operation as the `>>` shifting operator!
        ///
        /// # 执行左漏斗移位操作。
        ///
        /// ```
        #[doc = concat!("let n = ", $rot_result, stringify!($SelfT), ";")]
        #[doc = concat!("let m = ", $rot_op, ";")]
        ///
        #[doc = concat!("assert_eq!(n.rotate_right(", $rot, "), m);")]
        #[doc = concat!("assert_eq!(n.rotate_right(1024), n);")]
        /// ```
        #[stable(feature = "rust1", since = "1.0.0")]
        #[rustc_const_stable(feature = "const_math", since = "1.32.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline(always)]
        #[rustc_allow_const_fn_unstable(const_trait_impl)] // for the intrinsic fallback
        pub const fn rotate_right(self, n: u32) -> Self {
            return intrinsics::rotate_right(self, n);
        }

        /// Performs a left funnel shift.
        ///
        /// This operation can be thought of as concatenating `self` and `right` into an
        /// integer twice the size of
        #[doc = concat!("`", stringify!($SelfT) , "`,")]
        /// performing a left shift by `n`, and returning the **left half** of the result.
        ///
        /// 该名称来源于将更宽的整数“漏斗化”到更窄的整数中。
        ///
        /// # panic
        ///
        /// ## 溢出行为
        ///
        /// If overflow checks are enabled (default in debug mode), this function will panic if `n`
        /// is greater than or equal to the number of bits in `self`. If overflow checks are
        /// # 示例
        /// by `n % Self::BITS`.
        // FIXME(wrapping_funnel_shifts): link to `wrapping_funnel_shl` when stable.
        ///
        /// # Examples
        ///
        /// ```
        #[doc = concat!("let a = ", $rot_op, "_", stringify!($SelfT), ";")]
        #[doc = concat!("let b = ", $fsh_op, "_", stringify!($SelfT), ";")]
        ///
        #[doc = concat!("assert_eq!(a.funnel_shl(b, ", $rot, "), ", $fshl_result, ");")]
        ///
        /// // Using zeros as the right operand acts as a normal shift left
        #[doc = concat!("assert_eq!(a.funnel_shl(0, ", $rot, "), a << ", $rot, ");")]
        ///
        /// // Shifting by 0 returns `self` unchanged
        #[doc = concat!("assert_eq!(a.funnel_shl(b, 0), a);")]
        ///
        /// // Using the same value as the right operand acts as a rotate
        #[doc = concat!("assert_eq!(a.funnel_shl(a, ", $rot, "), a.rotate_left(", $rot, "));")]
        /// ```
        ///
        /// Note that while `funnel_shl` can act as a rotate, it does not allow for
        /// rotating by an unbounded amount like [`rotate_left`](Self::rotate_left) does:
        ///
        /// ```should_panic
        /// # #![feature(cfg_overflow_checks)]
        /// # #[cfg(overflow_checks)] {
        #[doc = concat!("let a = ", stringify!($SelfT), "::MAX;")]
        /// // Okay
        #[doc = concat!("let _ = a.rotate_left(", stringify!($SelfT), "::BITS);")]
        /// // Panics (only when overflow checks are enabled)
        #[doc = concat!("let _ = a.funnel_shl(a, ", stringify!($SelfT), "::BITS);")]
        /// # }
        /// # #[cfg(not(overflow_checks))] panic!("fulfill should_panic");
        /// ```
        #[rustc_const_stable(feature = "funnel_shifts", since = "1.101.0")]
        #[stable(feature = "funnel_shifts", since = "1.101.0")]
        #[must_use = "this returns the result of the operation, without modifying the original"]
        #[inline(always)]
        #[rustc_inherit_overflow_checks]
        pub const fn funnel_shl(self, right: Self, n: u32) -> Self {
            if intrinsics::overflow_checks() {
                assert!(n < Self::BITS, "attempt to funnel shift left with overflow");
            }
            // SAFETY: `n` is wrapped to within range
            unsafe {
                let n = n & (Self::BITS - 1);
                self.unchecked_funnel_shl(right, n)
            }
        }

        /// 执行右漏斗移位操作。
        ///
        /// This operation can be thought of as concatenating `self` and `right` into an
        /// 大小为原数的两倍的整数。
        #[doc = concat!("`", stringify!($SelfT) , "`,")]
        /// performing a right shift by `n`, and returning the **right half** of the result.
        ///
        /// 该名称来源于将更宽的整数“漏斗化”为更窄的整数。
        ///
        /// # 恐慌
        ///
        /// ## 溢出行为
        ///
        /// If overflow checks are enabled (default in debug mode), this function will panic if `n`
        /// is greater than or equal to the number of bits in `self`. If overflow checks are
        /// # 示例
        /// by `n % Self::BITS`.
        // FIXME(wrapping_funnel_shifts): link to `wrapping_funnel_shr` when stable.
        ///
        /// # Examples
        ///
        /// ```
        #[doc = concat!("let a = ", $rot_op, "_", stringify!($SelfT), ";")]
        #[doc = concat!("let b = ", $fsh_op, "_", stringify!($SelfT), ";")]
        ///
        #[doc = concat!("assert_eq!(a.funnel_shr(b, ", $rot, "), ", $fshr_result, ");")]
        ///
        /// // Using zeros as the left operand acts as a normal shift right
        #[doc = concat!("assert_eq!(0_", stringify!($SelfT), ".funnel_shr(a, ", $rot, "), a >> ", $rot, ");")]
        ///
        /// // Shifting by 0 returns `right` unchanged
        #[doc = concat!("assert_eq!(b.funnel_shr(a, 0), a);")]
        ///
        /// // Using the same value as the right operand acts as a rotate
        #[doc = concat!("assert_eq!(a.funnel_shr(a, ", $rot, "), a.rotate_right(", $rot, "));")]
        /// ```
        ///
        /// Note that while `funnel_shr` can act as a rotate, it does not allow for
        /// rotating by an unbounded amount like [`rotate_right`](Self::rotate_right) does:
        ///
        /// ```should_panic
        /// # #![feature(cfg_overflow_checks)]
        /// # #[cfg(overflow_checks)] {
        #[doc = concat!("let a = ", stringify!($SelfT), "::MAX;")]
        /// // Okay
        #[doc = concat!("let _ = a.rotate_right(", stringify!($SelfT), "::BITS);")]
        /// // Panics (only when overflow checks are enabled)
        #[doc = concat!("let _ = a.funnel_shr(a, ", stringify!($SelfT), "::BITS);")]
        /// # }
        /// # #[cfg(not(overflow_checks))] panic!("fulfill should_panic");
        /// ```
        #[rustc_const_stable(feature = "funnel_shifts", since = "1.101.0")]
        #[stable(feature = "funnel_shifts", since = "1.101.0")]
        #[must_use = "this returns the result of the operation, without modifying the original"]
        #[inline(always)]
        #[rustc_inherit_overflow_checks]
        pub const fn funnel_shr(self, right: Self, n: u32) -> Self {
            if intrinsics::overflow_checks() {
                assert!(n < Self::BITS, "attempt to funnel shift right with overflow");
            }
            // SAFETY: `n` is wrapped to within range
            unsafe {
                let n = n & (Self::BITS - 1);
                self.unchecked_funnel_shr(right, n)
            }
        }

        /// 未检查的漏斗式位移左移。
        ///
        /// # 安全性
        ///
        /// This results in undefined behavior if `n` is greater than or equal to
        #[doc = concat!("`", stringify!($SelfT) , "::BITS`,")]
        /// i.e. when [`funnel_shl`](Self::funnel_shl) would panic.
        ///
        #[rustc_const_stable(feature = "funnel_shifts", since = "1.101.0")]
        #[stable(feature = "funnel_shifts", since = "1.101.0")]
        #[rustc_allow_const_fn_unstable(const_trait_impl)]
        #[must_use = "this returns the result of the operation, without modifying the original"]
        #[inline(always)]
        #[track_caller]
        pub const unsafe fn unchecked_funnel_shl(self, right: Self, n: u32) -> Self {
            assert_unsafe_precondition!(
                check_language_ub,
                concat!(stringify!($SelfT), "::unchecked_funnel_shl cannot overflow"),
                (n: u32 = n) => n < <$ActualT>::BITS,
            );

            // SAFETY: this is guaranteed to be safe by the caller.
            unsafe {
                intrinsics::unchecked_funnel_shl(self, right, n)
            }
        }

        /// 未检查的漏斗式位移右移。
        ///
        /// # 安全性
        ///
        /// This results in undefined behavior if `n` is greater than or equal to
        #[doc = concat!("`", stringify!($SelfT) , "::BITS`,")]
        /// i.e. when [`funnel_shr`](Self::funnel_shr) would panic.
        ///
        #[rustc_const_stable(feature = "funnel_shifts", since = "1.101.0")]
        #[stable(feature = "funnel_shifts", since = "1.101.0")]
        #[rustc_allow_const_fn_unstable(const_trait_impl)]
        #[must_use = "this returns the result of the operation, without modifying the original"]
        #[inline(always)]
        #[track_caller]
        pub const unsafe fn unchecked_funnel_shr(self, right: Self, n: u32) -> Self {
            assert_unsafe_precondition!(
                check_language_ub,
                concat!(stringify!($SelfT), "::unchecked_funnel_shr cannot overflow"),
                (n: u32 = n) => n < <$ActualT>::BITS,
            );

            // SAFETY: this is guaranteed to be safe by the caller.
            unsafe {
                intrinsics::unchecked_funnel_shr(self, right, n)
            }
        }

        /// 执行无进位乘法，返回低位部分。
        ///
        /// 此操作类似于二进制长乘法，不同之处在于使用异或而不是加法。其实现等价于：
        /// 实际实现更高效，在某些平台上可直接转换为专用指令。
        ///
        /// ```no_run
        #[doc = concat!("pub fn carryless_mul(lhs: ", stringify!($SelfT), ", rhs: ", stringify!($SelfT), ") -> ", stringify!($SelfT), "{")]
        ///     let mut retval = 0;
        #[doc = concat!("    for i in 0..",  stringify!($SelfT), "::BITS {")]
        ///         if (rhs >> i) & 1 != 0 {
        ///             // long multiplication would use +=
        ///             retval ^= lhs << i;
        ///         }
        ///     }
        ///     retval
        /// }
        /// ```
        ///
        /// # 使用场景
        /// 无进位乘法可用于将引号字符的位掩码转换为被引号包围的字符位掩码。
        ///
        /// # 
        ///
        /// 无进位乘法可用于将引号字符的位掩码转换为被引号包围的字符位掩码。
        /// bit mask of characters surrounded by quotes:
        ///
        /// ```no_run
        /// r#"abc xxx "foobar" zzz "a"!"#; // input string
        ///  0b0000000010000001000001010; // quote_mask
        ///  0b0000000001111110000000100; // quote_mask.carryless_mul(!0) & !quote_mask
        /// ```
        ///
        /// 
        /// implementations of polynomial multiplication in `GF(2)[X]`, the polynomial ring
        /// over `GF(2)`.
        ///
        /// # 示例
        ///
        /// ```
        /// #![feature(uint_carryless_mul)]
        ///
        #[doc = concat!("let a = ", $clmul_lhs, stringify!($SelfT), ";")]
        #[doc = concat!("let b = ", $clmul_rhs, stringify!($SelfT), ";")]
        ///
        #[doc = concat!("assert_eq!(a.carryless_mul(b), ", $clmul_result, ");")]
        /// ```
        #[rustc_const_unstable(feature = "uint_carryless_mul", issue = "152080")]
        #[doc(alias = "clmul")]
        #[unstable(feature = "uint_carryless_mul", issue = "152080")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline(always)]
        pub const fn carryless_mul(self, rhs: Self) -> Self {
            intrinsics::carryless_mul(self, rhs)
        }

        /// 反转整数的字节顺序。
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("let n = ", $swap_op, stringify!($SelfT), ";")]
        /// let m = n.swap_bytes();
        ///
        #[doc = concat!("assert_eq!(m, ", $swapped, ");")]
        /// ```
        #[stable(feature = "rust1", since = "1.0.0")]
        #[rustc_const_stable(feature = "const_math", since = "1.32.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline(always)]
        pub const fn swap_bytes(self) -> Self {
            intrinsics::bswap(self as $ActualT) as Self
        }

        /// Returns an integer with the bit locations specified by `mask` packed
        /// 
        /// ```
        /// #![feature(uint_gather_scatter_bits)]
        #[doc = concat!("let n: ", stringify!($SelfT), " = 0b1011_1100;")]
        ///
        /// assert_eq!(n.extract_bits(0b0010_0100), 0b0000_0011);
        /// assert_eq!(n.extract_bits(0xF0), 0b0000_1011);
        /// ```
        #[doc(alias = "pext")]
        #[unstable(feature = "uint_gather_scatter_bits", issue = "149069")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        pub const fn extract_bits(self, mask: Self) -> Self {
            imp::int_bits::$ActualT::extract_impl(self as $ActualT, mask as $ActualT) as $SelfT
        }

        /// Returns an integer with the least significant bits of `self`
        /// distributed to the bit locations specified by `mask`.
        /// ```
        /// #![feature(uint_gather_scatter_bits)]
        #[doc = concat!("let n: ", stringify!($SelfT), " = 0b1010_1101;")]
        ///
        /// assert_eq!(n.deposit_bits(0b0101_0101), 0b0101_0001);
        /// assert_eq!(n.deposit_bits(0xF0), 0b1101_0000);
        /// ```
        #[doc(alias = "pdep")]
        #[unstable(feature = "uint_gather_scatter_bits", issue = "149069")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        pub const fn deposit_bits(self, mask: Self) -> Self {
            imp::int_bits::$ActualT::deposit_impl(self as $ActualT, mask as $ActualT) as $SelfT
        }

        /// 反转整数的位顺序。最低有效位变为最高有效位，第二低有效位变为第二高有效位，依此类推。
        /// 
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("let n = ", $swap_op, stringify!($SelfT), ";")]
        /// let m = n.reverse_bits();
        ///
        #[doc = concat!("assert_eq!(m, ", $reversed, ");")]
        #[doc = concat!("assert_eq!(0, 0", stringify!($SelfT), ".reverse_bits());")]
        /// ```
        #[stable(feature = "reverse_bits", since = "1.37.0")]
        #[rustc_const_stable(feature = "reverse_bits", since = "1.37.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline(always)]
        pub const fn reverse_bits(self) -> Self {
            intrinsics::bitreverse(self as $ActualT) as Self
        }

        /// 将大端序整数转换为目标端的端序。
        ///
        /// 在大端序模式下此操作为无操作。在小端序模式下字节会被交换。
        /// 
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("let n = 0x1A", stringify!($SelfT), ";")]
        ///
        /// if cfg!(target_endian = "big") {
        #[doc = concat!("    assert_eq!(", stringify!($SelfT), "::from_be(n), n)")]
        /// } else {
        #[doc = concat!("    assert_eq!(", stringify!($SelfT), "::from_be(n), n.swap_bytes())")]
        /// }
        /// ```
        #[stable(feature = "rust1", since = "1.0.0")]
        #[rustc_const_stable(feature = "const_math", since = "1.32.0")]
        #[must_use]
        #[inline(always)]
        pub const fn from_be(x: Self) -> Self {
            cfg_select! {
                target_endian = "big" => x,
                _ => x.swap_bytes(),
            }
        }

        /// 将小端序整数转换为目标端的端序。
        ///
        /// 在小端序模式下此操作为无操作。在大端序模式下字节会被交换。
        /// 
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("let n = 0x1A", stringify!($SelfT), ";")]
        ///
        /// if cfg!(target_endian = "little") {
        #[doc = concat!("    assert_eq!(", stringify!($SelfT), "::from_le(n), n)")]
        /// } else {
        #[doc = concat!("    assert_eq!(", stringify!($SelfT), "::from_le(n), n.swap_bytes())")]
        /// }
        /// ```
        #[stable(feature = "rust1", since = "1.0.0")]
        #[rustc_const_stable(feature = "const_math", since = "1.32.0")]
        #[must_use]
        #[inline(always)]
        pub const fn from_le(x: Self) -> Self {
            cfg_select! {
                target_endian = "little" => x,
                _ => x.swap_bytes(),
            }
        }

        /// Converts `self` to big endian from the target's endianness.
        ///
        /// 在大端模式下这是无操作的。在小端模式下，字节会被
        /// 交换。
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("let n = 0x1A", stringify!($SelfT), ";")]
        ///
        /// if cfg!(target_endian = "big") {
        ///     assert_eq!(n.to_be(), n)
        /// } else {
        ///     assert_eq!(n.to_be(), n.swap_bytes())
        /// }
        /// ```
        #[stable(feature = "rust1", since = "1.0.0")]
        #[rustc_const_stable(feature = "const_math", since = "1.32.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline(always)]
        pub const fn to_be(self) -> Self { // or not to be?
            cfg_select! {
                target_endian = "big" => self,
                _ => self.swap_bytes(),
            }
        }

        /// Converts `self` to little endian from the target's endianness.
        ///
        /// 在小端模式下这是无操作的。在大端模式下，字节会被
        /// 交换。
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("let n = 0x1A", stringify!($SelfT), ";")]
        ///
        /// if cfg!(target_endian = "little") {
        ///     assert_eq!(n.to_le(), n)
        /// } else {
        ///     assert_eq!(n.to_le(), n.swap_bytes())
        /// }
        /// ```
        #[stable(feature = "rust1", since = "1.0.0")]
        #[rustc_const_stable(feature = "const_math", since = "1.32.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline(always)]
        pub const fn to_le(self) -> Self {
            cfg_select! {
                target_endian = "little" => self,
                _ => self.swap_bytes(),
            }
        }

        /// Checked integer addition. Computes `self + rhs`, returning `None`
        /// 如果发生溢出。
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!(
            "assert_eq!((", stringify!($SelfT), "::MAX - 2).checked_add(1), ",
            "Some(", stringify!($SelfT), "::MAX - 1));"
        )]
        #[doc = concat!("assert_eq!((", stringify!($SelfT), "::MAX - 2).checked_add(3), None);")]
        /// ```
        #[stable(feature = "rust1", since = "1.0.0")]
        #[rustc_const_stable(feature = "const_checked_int_methods", since = "1.47.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        pub const fn checked_add(self, rhs: Self) -> Option<Self> {
            // This used to use `overflowing_add`, but that means it ends up being
            // a `wrapping_add`, losing some optimization opportunities. Notably,
            // phrasing it this way helps `.checked_add(1)` optimize to a check
            // against `MAX` and a `add nuw`.
            // Per <https://github.com/rust-lang/rust/pull/124114#issuecomment-2066173305>,
            // LLVM is happy to re-form the intrinsic later if useful.

            if intrinsics::unlikely(intrinsics::add_with_overflow(self, rhs).1) {
                None
            } else {
                // SAFETY: Just checked it doesn't overflow
                Some(unsafe { intrinsics::unchecked_add(self, rhs) })
            }
        }

        /// Strict integer addition. Computes `self + rhs`, panicking
        /// 如果发生溢出。
        ///
        /// # 触发 panic
        ///
        /// ## 溢出行为
        ///
        /// 无论是否启用溢出检查，此函数在溢出时总会触发 panic。
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!((", stringify!($SelfT), "::MAX - 2).strict_add(1), ", stringify!($SelfT), "::MAX - 1);")]
        /// ```
        ///
        /// 以下因溢出而触发 panic：
        ///
        /// ```should_panic
        #[doc = concat!("let _ = (", stringify!($SelfT), "::MAX - 2).strict_add(3);")]
        /// ```
        #[stable(feature = "strict_overflow_ops", since = "1.91.0")]
        #[rustc_const_stable(feature = "strict_overflow_ops", since = "1.91.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        #[track_caller]
        pub const fn strict_add(self, rhs: Self) -> Self {
            let (a, b) = self.overflowing_add(rhs);
            if b { imp::overflow_panic::add() } else { a }
        }

        /// Unchecked integer addition. Computes `self + rhs`, assuming overflow
        /// 
        ///
        /// Calling `x.unchecked_add(y)` is semantically equivalent to calling
        /// `x.`[`checked_add`]`(y).`[`unwrap_unchecked`]`()`.
        ///
        /// 如果你只是想在调试模式下避免 panic，那么**不要**
        /// use this.  Instead, you're looking for [`wrapping_add`].
        ///
        /// # 安全性
        ///
        /// 当发生溢出时，这会导致未定义行为，即当
        /// [`checked_add`] would return `None`.
        ///
        /// [`unwrap_unchecked`]: option/enum.Option.html#method.unwrap_unchecked
        #[doc = concat!("[`checked_add`]: ", stringify!($SelfT), "::checked_add")]
        #[doc = concat!("[`wrapping_add`]: ", stringify!($SelfT), "::wrapping_add")]
        #[stable(feature = "unchecked_math", since = "1.79.0")]
        #[rustc_const_stable(feature = "unchecked_math", since = "1.79.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline(always)]
        #[track_caller]
        pub const unsafe fn unchecked_add(self, rhs: Self) -> Self {
            assert_unsafe_precondition!(
                check_language_ub,
                concat!(stringify!($SelfT), "::unchecked_add cannot overflow"),
                (
                    lhs: $SelfT = self,
                    rhs: $SelfT = rhs,
                ) => !lhs.overflowing_add(rhs).1,
            );

            // SAFETY: this is guaranteed to be safe by the caller.
            unsafe {
                intrinsics::unchecked_add(self, rhs)
            }
        }

        /// Checked addition with a signed integer. Computes `self + rhs`,
        /// returning `None` if overflow occurred.
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(1", stringify!($SelfT), ".checked_add_signed(2), Some(3));")]
        #[doc = concat!("assert_eq!(1", stringify!($SelfT), ".checked_add_signed(-2), None);")]
        #[doc = concat!("assert_eq!((", stringify!($SelfT), "::MAX - 2).checked_add_signed(3), None);")]
        /// ```
        #[stable(feature = "mixed_integer_ops", since = "1.66.0")]
        #[rustc_const_stable(feature = "mixed_integer_ops", since = "1.66.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        pub const fn checked_add_signed(self, rhs: $SignedT) -> Option<Self> {
            let (a, b) = self.overflowing_add_signed(rhs);
            if intrinsics::unlikely(b) { None } else { Some(a) }
        }

        /// Strict addition with a signed integer. Computes `self + rhs`,
        /// 如果发生溢出则触发 panic。
        ///
        /// # 触发 panic
        ///
        /// ## 溢出行为
        ///
        /// 无论是否启用溢出检查，此函数在溢出时总会触发 panic。
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(1", stringify!($SelfT), ".strict_add_signed(2), 3);")]
        /// ```
        ///
        /// 以下因溢出而触发 panic：
        ///
        /// ```should_panic
        #[doc = concat!("let _ = 1", stringify!($SelfT), ".strict_add_signed(-2);")]
        /// ```
        ///
        /// ```should_panic
        #[doc = concat!("let _ = (", stringify!($SelfT), "::MAX - 2).strict_add_signed(3);")]
        /// ```
        #[stable(feature = "strict_overflow_ops", since = "1.91.0")]
        #[rustc_const_stable(feature = "strict_overflow_ops", since = "1.91.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        #[track_caller]
        pub const fn strict_add_signed(self, rhs: $SignedT) -> Self {
            let (a, b) = self.overflowing_add_signed(rhs);
            if b { imp::overflow_panic::add() } else { a }
        }

        /// Checked integer subtraction. Computes `self - rhs`, returning
        /// `None` if overflow occurred.
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(1", stringify!($SelfT), ".checked_sub(1), Some(0));")]
        #[doc = concat!("assert_eq!(0", stringify!($SelfT), ".checked_sub(1), None);")]
        /// ```
        #[stable(feature = "rust1", since = "1.0.0")]
        #[rustc_const_stable(feature = "const_checked_int_methods", since = "1.47.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        pub const fn checked_sub(self, rhs: Self) -> Option<Self> {
            // Per PR#103299, there's no advantage to the `overflowing` intrinsic
            // for *unsigned* subtraction and we just emit the manual check anyway.
            // Thus, rather than using `overflowing_sub` that produces a wrapping
            // subtraction, check it ourself so we can use an unchecked one.

            if self < rhs {
                None
            } else {
                // SAFETY: just checked this can't overflow
                Some(unsafe { intrinsics::unchecked_sub(self, rhs) })
            }
        }

        /// Strict integer subtraction. Computes `self - rhs`, panicking if
        /// 发生溢出则触发 panic。
        ///
        /// # 触发 panic
        ///
        /// ## 溢出行为
        ///
        /// 无论是否启用溢出检查，此函数在溢出时总会触发 panic。
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(1", stringify!($SelfT), ".strict_sub(1), 0);")]
        /// ```
        ///
        /// 以下因溢出而触发 panic：
        ///
        /// ```should_panic
        #[doc = concat!("let _ = 0", stringify!($SelfT), ".strict_sub(1);")]
        /// ```
        #[stable(feature = "strict_overflow_ops", since = "1.91.0")]
        #[rustc_const_stable(feature = "strict_overflow_ops", since = "1.91.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        #[track_caller]
        pub const fn strict_sub(self, rhs: Self) -> Self {
            let (a, b) = self.overflowing_sub(rhs);
            if b { imp::overflow_panic::sub() } else { a }
        }

        /// Unchecked integer subtraction. Computes `self - rhs`, assuming overflow
        /// 
        ///
        /// Calling `x.unchecked_sub(y)` is semantically equivalent to calling
        /// `x.`[`checked_sub`]`(y).`[`unwrap_unchecked`]`()`.
        ///
        /// 如果你只是想在调试模式下避免 panic，那么**不要**
        /// use this.  Instead, you're looking for [`wrapping_sub`].
        ///
        /// 如果你发现自己编写了这样的代码：
        ///
        /// ```
        /// # let foo = 30_u32;
        /// # let bar = 20;
        /// if foo >= bar {
        ///     // SAFETY: just checked it will not overflow
        ///     let diff = unsafe { foo.unchecked_sub(bar) };
        ///     // ... use diff ...
        /// }
        /// ```
        ///
        /// 考虑将其改为
        ///
        /// ```
        /// # let foo = 30_u32;
        /// # let bar = 20;
        /// if let Some(diff) = foo.checked_sub(bar) {
        ///     // ... use diff ...
        /// }
        /// ```
        ///
        /// 因为这样做与原来的效果完全相同——包括告诉优化器
        /// that the subtraction cannot overflow -- but avoids needing `unsafe`.
        ///
        /// # 安全性
        ///
        /// 当发生溢出时，这会导致未定义行为，即当
        /// [`checked_sub`] would return `None`.
        ///
        /// [`unwrap_unchecked`]: option/enum.Option.html#method.unwrap_unchecked
        #[doc = concat!("[`checked_sub`]: ", stringify!($SelfT), "::checked_sub")]
        #[doc = concat!("[`wrapping_sub`]: ", stringify!($SelfT), "::wrapping_sub")]
        #[stable(feature = "unchecked_math", since = "1.79.0")]
        #[rustc_const_stable(feature = "unchecked_math", since = "1.79.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline(always)]
        #[track_caller]
        pub const unsafe fn unchecked_sub(self, rhs: Self) -> Self {
            assert_unsafe_precondition!(
                check_language_ub,
                concat!(stringify!($SelfT), "::unchecked_sub cannot overflow"),
                (
                    lhs: $SelfT = self,
                    rhs: $SelfT = rhs,
                ) => !lhs.overflowing_sub(rhs).1,
            );

            // SAFETY: this is guaranteed to be safe by the caller.
            unsafe {
                intrinsics::unchecked_sub(self, rhs)
            }
        }

        /// Checked subtraction with a signed integer. Computes `self - rhs`,
        /// returning `None` if overflow occurred.
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(1", stringify!($SelfT), ".checked_sub_signed(2), None);")]
        #[doc = concat!("assert_eq!(1", stringify!($SelfT), ".checked_sub_signed(-2), Some(3));")]
        #[doc = concat!("assert_eq!((", stringify!($SelfT), "::MAX - 2).checked_sub_signed(-4), None);")]
        /// ```
        #[stable(feature = "mixed_integer_ops_unsigned_sub", since = "1.90.0")]
        #[rustc_const_stable(feature = "mixed_integer_ops_unsigned_sub", since = "1.90.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        pub const fn checked_sub_signed(self, rhs: $SignedT) -> Option<Self> {
            let (res, overflow) = self.overflowing_sub_signed(rhs);

            if !overflow {
                Some(res)
            } else {
                None
            }
        }

        /// Strict subtraction with a signed integer. Computes `self - rhs`,
        /// 在发生溢出时触发 panic
        ///
        /// # panic
        ///
        /// ## 溢出行为
        ///
        /// 无论是否启用溢出检查，此函数在发生溢出时总是会触发 panic
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(3", stringify!($SelfT), ".strict_sub_signed(2), 1);")]
        /// ```
        ///
        /// 以下因溢出而触发 panic：
        ///
        /// ```should_panic
        #[doc = concat!("let _ = 1", stringify!($SelfT), ".strict_sub_signed(2);")]
        /// ```
        ///
        /// ```should_panic
        #[doc = concat!("let _ = (", stringify!($SelfT), "::MAX).strict_sub_signed(-1);")]
        /// ```
        #[stable(feature = "strict_overflow_ops", since = "1.91.0")]
        #[rustc_const_stable(feature = "strict_overflow_ops", since = "1.91.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        #[track_caller]
        pub const fn strict_sub_signed(self, rhs: $SignedT) -> Self {
            let (a, b) = self.overflowing_sub_signed(rhs);
            if b { imp::overflow_panic::sub() } else { a }
        }

        #[doc = concat!(
            "Checked integer subtraction. Computes `self - rhs` and checks if the result fits into an [`",
            stringify!($SignedT), "`], returning `None` if overflow occurred."
        )]
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(10", stringify!($SelfT), ".checked_signed_diff(2), Some(8));")]
        #[doc = concat!("assert_eq!(2", stringify!($SelfT), ".checked_signed_diff(10), Some(-8));")]
        #[doc = concat!(
            "assert_eq!(",
            stringify!($SelfT),
            "::MAX.checked_signed_diff(",
            stringify!($SignedT),
            "::MAX as ",
            stringify!($SelfT),
            "), None);"
        )]
        #[doc = concat!(
            "assert_eq!((",
            stringify!($SignedT),
            "::MAX as ",
            stringify!($SelfT),
            ").checked_signed_diff(",
            stringify!($SelfT),
            "::MAX), Some(",
            stringify!($SignedT),
            "::MIN));"
        )]
        #[doc = concat!(
            "assert_eq!((",
            stringify!($SignedT),
            "::MAX as ",
            stringify!($SelfT),
            " + 1).checked_signed_diff(0), None);"
        )]
        #[doc = concat!(
            "assert_eq!(",
            stringify!($SelfT),
            "::MAX.checked_signed_diff(",
            stringify!($SelfT),
            "::MAX), Some(0));"
        )]
        /// ```
        #[stable(feature = "unsigned_signed_diff", since = "1.91.0")]
        #[rustc_const_stable(feature = "unsigned_signed_diff", since = "1.91.0")]
        #[inline]
        pub const fn checked_signed_diff(self, rhs: Self) -> Option<$SignedT> {
            let res = self.wrapping_sub(rhs) as $SignedT;
            let overflow = (self >= rhs) == (res < 0);

            if !overflow {
                Some(res)
            } else {
                None
            }
        }

        /// Checked integer multiplication. Computes `self * rhs`, returning
        /// `None` if overflow occurred.
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(5", stringify!($SelfT), ".checked_mul(1), Some(5));")]
        #[doc = concat!("assert_eq!(", stringify!($SelfT), "::MAX.checked_mul(2), None);")]
        /// ```
        #[stable(feature = "rust1", since = "1.0.0")]
        #[rustc_const_stable(feature = "const_checked_int_methods", since = "1.47.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        pub const fn checked_mul(self, rhs: Self) -> Option<Self> {
            let (a, b) = self.overflowing_mul(rhs);
            if intrinsics::unlikely(b) { None } else { Some(a) }
        }

        /// Strict integer multiplication. Computes `self * rhs`, panicking if
        /// 溢出时触发 panic
        ///
        /// # panic
        ///
        /// ## 溢出行为
        ///
        /// 无论是否启用溢出检查，此函数在发生溢出时总是会触发 panic
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(5", stringify!($SelfT), ".strict_mul(1), 5);")]
        /// ```
        ///
        /// 以下因溢出而触发 panic：
        ///
        /// ``` should_panic
        #[doc = concat!("let _ = ", stringify!($SelfT), "::MAX.strict_mul(2);")]
        /// ```
        #[stable(feature = "strict_overflow_ops", since = "1.91.0")]
        #[rustc_const_stable(feature = "strict_overflow_ops", since = "1.91.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        #[track_caller]
        pub const fn strict_mul(self, rhs: Self) -> Self {
            let (a, b) = self.overflowing_mul(rhs);
            if b { imp::overflow_panic::mul() } else { a }
        }

        /// Unchecked integer multiplication. Computes `self * rhs`, assuming overflow
        /// 溢出。
        ///
        /// Calling `x.unchecked_mul(y)` is semantically equivalent to calling
        /// `x.`[`checked_mul`]`(y).`[`unwrap_unchecked`]`()`.
        ///
        /// 如果您只是想在调试模式下避免 panic，那么**不要**
        /// use this.  Instead, you're looking for [`wrapping_mul`].
        ///
        /// # 安全性
        ///
        /// 当发生溢出时会导致未定义行为，即当
        /// [`checked_mul`] would return `None`.
        ///
        /// [`unwrap_unchecked`]: option/enum.Option.html#method.unwrap_unchecked
        #[doc = concat!("[`checked_mul`]: ", stringify!($SelfT), "::checked_mul")]
        #[doc = concat!("[`wrapping_mul`]: ", stringify!($SelfT), "::wrapping_mul")]
        #[stable(feature = "unchecked_math", since = "1.79.0")]
        #[rustc_const_stable(feature = "unchecked_math", since = "1.79.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline(always)]
        #[track_caller]
        pub const unsafe fn unchecked_mul(self, rhs: Self) -> Self {
            assert_unsafe_precondition!(
                check_language_ub,
                concat!(stringify!($SelfT), "::unchecked_mul cannot overflow"),
                (
                    lhs: $SelfT = self,
                    rhs: $SelfT = rhs,
                ) => !lhs.overflowing_mul(rhs).1,
            );

            // SAFETY: this is guaranteed to be safe by the caller.
            unsafe {
                intrinsics::unchecked_mul(self, rhs)
            }
        }

        /// Checked integer division. Computes `self / rhs`, returning `None`
        /// if `rhs == 0`.
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(128", stringify!($SelfT), ".checked_div(2), Some(64));")]
        #[doc = concat!("assert_eq!(1", stringify!($SelfT), ".checked_div(0), None);")]
        /// ```
        #[stable(feature = "rust1", since = "1.0.0")]
        #[rustc_const_stable(feature = "const_checked_int_div", since = "1.52.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        pub const fn checked_div(self, rhs: Self) -> Option<Self> {
            if intrinsics::unlikely(rhs == 0) {
                None
            } else {
                // SAFETY: div by zero has been checked above and unsigned types have no other
                // failure modes for division
                Some(unsafe { intrinsics::unchecked_div(self, rhs) })
            }
        }

        /// Strict integer division. Computes `self / rhs`.
        ///
        /// 对无符号类型进行严格除法就是普通除法。没有
        /// 任何可能发生溢出的情况。此函数的存在是为了让所有
        /// 操作都包含在严格操作中
        ///
        /// # panic
        ///
        /// This function will panic if `rhs` is zero.
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(100", stringify!($SelfT), ".strict_div(10), 10);")]
        /// ```
        ///
        /// 以下因除以零而触发 panic：
        ///
        /// ```should_panic
        #[doc = concat!("let _ = (1", stringify!($SelfT), ").strict_div(0);")]
        /// ```
        #[stable(feature = "strict_overflow_ops", since = "1.91.0")]
        #[rustc_const_stable(feature = "strict_overflow_ops", since = "1.91.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline(always)]
        #[track_caller]
        pub const fn strict_div(self, rhs: Self) -> Self {
            self / rhs
        }

        /// Checked Euclidean division. Computes `self.div_euclid(rhs)`, returning `None`
        /// if `rhs == 0`.
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(128", stringify!($SelfT), ".checked_div_euclid(2), Some(64));")]
        #[doc = concat!("assert_eq!(1", stringify!($SelfT), ".checked_div_euclid(0), None);")]
        /// ```
        #[stable(feature = "euclidean_division", since = "1.38.0")]
        #[rustc_const_stable(feature = "const_euclidean_int_methods", since = "1.52.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        pub const fn checked_div_euclid(self, rhs: Self) -> Option<Self> {
            if intrinsics::unlikely(rhs == 0) {
                None
            } else {
                Some(self.div_euclid(rhs))
            }
        }

        /// Strict Euclidean division. Computes `self.div_euclid(rhs)`.
        ///
        /// 对无符号类型进行严格除法就是普通除法。没有
        /// 任何可能发生溢出的情况。此函数的存在是为了让所有
        /// 操作都包含在严格操作中。由于对于
        /// 正整数，所有常见的除法定义都是相同的，因此
        /// is exactly equal to `self.strict_div(rhs)`.
        ///
        /// # panic
        ///
        /// This function will panic if `rhs` is zero.
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(100", stringify!($SelfT), ".strict_div_euclid(10), 10);")]
        /// ```
        /// 以下因除以零而触发 panic：
        ///
        /// ```should_panic
        #[doc = concat!("let _ = (1", stringify!($SelfT), ").strict_div_euclid(0);")]
        /// ```
        #[stable(feature = "strict_overflow_ops", since = "1.91.0")]
        #[rustc_const_stable(feature = "strict_overflow_ops", since = "1.91.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline(always)]
        #[track_caller]
        pub const fn strict_div_euclid(self, rhs: Self) -> Self {
            self / rhs
        }

        /// Checked integer division without remainder. Computes `self / rhs`,
        /// returning `None` if `rhs == 0` or if `self % rhs != 0`.
        ///
        /// # 示例
        ///
        /// ```
        /// #![feature(exact_div)]
        #[doc = concat!("assert_eq!(64", stringify!($SelfT), ".checked_div_exact(2), Some(32));")]
        #[doc = concat!("assert_eq!(64", stringify!($SelfT), ".checked_div_exact(32), Some(2));")]
        #[doc = concat!("assert_eq!(64", stringify!($SelfT), ".checked_div_exact(0), None);")]
        #[doc = concat!("assert_eq!(65", stringify!($SelfT), ".checked_div_exact(2), None);")]
        /// ```
        #[unstable(
            feature = "exact_div",
            issue = "139911",
        )]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        pub const fn checked_div_exact(self, rhs: Self) -> Option<Self> {
            if intrinsics::unlikely(rhs == 0) {
                None
            } else {
                // SAFETY: division by zero is checked above
                unsafe {
                    if intrinsics::unlikely(intrinsics::unchecked_rem(self, rhs) != 0) {
                        None
                    } else {
                        Some(intrinsics::exact_div(self, rhs))
                    }
                }
            }
        }

        /// Integer division without remainder. Computes `self / rhs`, returning `None` if `self % rhs != 0`.
        ///
        /// # 异常
        ///
        /// This function will panic  if `rhs == 0`.
        ///
        /// # 示例
        ///
        /// ```
        /// #![feature(exact_div)]
        #[doc = concat!("assert_eq!(64", stringify!($SelfT), ".div_exact(2), Some(32));")]
        #[doc = concat!("assert_eq!(64", stringify!($SelfT), ".div_exact(32), Some(2));")]
        #[doc = concat!("assert_eq!(65", stringify!($SelfT), ".div_exact(2), None);")]
        /// ```
        #[unstable(
            feature = "exact_div",
            issue = "139911",
        )]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        #[rustc_inherit_overflow_checks]
        pub const fn div_exact(self, rhs: Self) -> Option<Self> {
            if self % rhs != 0 {
                None
            } else {
                Some(self / rhs)
            }
        }

        /// Unchecked integer division without remainder. Computes `self / rhs`.
        ///
        /// # 安全性
        ///
        /// This results in undefined behavior when `rhs == 0` or `self % rhs != 0`,
        /// i.e. when [`checked_div_exact`](Self::checked_div_exact) would return `None`.
        #[unstable(
            feature = "exact_div",
            issue = "139911",
        )]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        pub const unsafe fn unchecked_div_exact(self, rhs: Self) -> Self {
            assert_unsafe_precondition!(
                check_language_ub,
                concat!(stringify!($SelfT), "::unchecked_div_exact divide by zero or leave a remainder"),
                (
                    lhs: $SelfT = self,
                    rhs: $SelfT = rhs,
                ) => rhs > 0 && lhs % rhs == 0,
            );
            // SAFETY: Same precondition
            unsafe { intrinsics::exact_div(self, rhs) }
        }

        /// Checked integer remainder. Computes `self % rhs`, returning `None`
        /// if `rhs == 0`.
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(5", stringify!($SelfT), ".checked_rem(2), Some(1));")]
        #[doc = concat!("assert_eq!(5", stringify!($SelfT), ".checked_rem(0), None);")]
        /// ```
        #[stable(feature = "wrapping", since = "1.7.0")]
        #[rustc_const_stable(feature = "const_checked_int_div", since = "1.52.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        pub const fn checked_rem(self, rhs: Self) -> Option<Self> {
            if intrinsics::unlikely(rhs == 0) {
                None
            } else {
                // SAFETY: div by zero has been checked above and unsigned types have no other
                // failure modes for division
                Some(unsafe { intrinsics::unchecked_rem(self, rhs) })
            }
        }

        /// Strict integer remainder. Computes `self % rhs`.
        ///
        /// 无符号类型上的严格除法计算只是常规的
        /// 除法计算。不可能发生溢出情况。
        /// 此函数的存在是为了让所有操作都包含在
        /// 严格操作之中。
        ///
        /// # 异常
        ///
        /// This function will panic if `rhs` is zero.
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(100", stringify!($SelfT), ".strict_rem(10), 0);")]
        /// ```
        ///
        /// 以下代码因除以零而引发异常：
        ///
        /// ```should_panic
        #[doc = concat!("let _ = 5", stringify!($SelfT), ".strict_rem(0);")]
        /// ```
        #[stable(feature = "strict_overflow_ops", since = "1.91.0")]
        #[rustc_const_stable(feature = "strict_overflow_ops", since = "1.91.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline(always)]
        #[track_caller]
        pub const fn strict_rem(self, rhs: Self) -> Self {
            self % rhs
        }

        /// Checked Euclidean modulo. Computes `self.rem_euclid(rhs)`, returning `None`
        /// if `rhs == 0`.
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(5", stringify!($SelfT), ".checked_rem_euclid(2), Some(1));")]
        #[doc = concat!("assert_eq!(5", stringify!($SelfT), ".checked_rem_euclid(0), None);")]
        /// ```
        #[stable(feature = "euclidean_division", since = "1.38.0")]
        #[rustc_const_stable(feature = "const_euclidean_int_methods", since = "1.52.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        pub const fn checked_rem_euclid(self, rhs: Self) -> Option<Self> {
            if intrinsics::unlikely(rhs == 0) {
                None
            } else {
                Some(self.rem_euclid(rhs))
            }
        }

        /// Strict Euclidean modulo. Computes `self.rem_euclid(rhs)`.
        ///
        /// 无符号类型上的严格取模计算只是常规的
        /// 除法计算。不可能发生溢出情况。
        /// 此函数的存在是为了让所有操作都包含在
        /// 严格操作之中。对于正整数，所有常见的
        /// 除法定义都是相同的，因此这完全等同于
        /// `self.strict_rem(rhs)`.
        ///
        /// # 异常
        ///
        /// This function will panic if `rhs` is zero.
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(100", stringify!($SelfT), ".strict_rem_euclid(10), 0);")]
        /// ```
        ///
        /// 以下代码因除以零而引发异常：
        ///
        /// ```should_panic
        #[doc = concat!("let _ = 5", stringify!($SelfT), ".strict_rem_euclid(0);")]
        /// ```
        #[stable(feature = "strict_overflow_ops", since = "1.91.0")]
        #[rustc_const_stable(feature = "strict_overflow_ops", since = "1.91.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline(always)]
        #[track_caller]
        pub const fn strict_rem_euclid(self, rhs: Self) -> Self {
            self % rhs
        }

        /// Disjoint, bitwise or. Computes `self | rhs`, assuming no overlapping one bits.
        ///
        /// Practically, this requires that `self | rhs`, `self ^ rhs`, and `self + rhs` all
        /// 产生相同的结果，允许在代码生成中任意选择其中一种 --
        /// 取决于哪种方式最便宜。
        ///
        /// # 示例
        ///
        /// ```
        /// #![feature(disjoint_bitor)]
        ///
        /// assert_eq!(
        ///     // SAFETY: `1` and `4` have no ones in common.
        #[doc = concat!("    unsafe { 1_", stringify!($SelfT), ".unchecked_disjoint_bitor(4) },")]
        ///     5,
        /// );
        /// ```
        ///
        /// # 安全性
        ///
        /// This results in undefined behaviour if `self` and `rhs` have any overlapping one
        /// bits, i.e. `lhs & rhs` must be zero.
        #[unstable(feature = "disjoint_bitor", issue = "135758")]
        #[rustc_const_unstable(feature = "disjoint_bitor", issue = "135758")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        pub const unsafe fn unchecked_disjoint_bitor(self, rhs: Self) -> Self {
            assert_unsafe_precondition!(
                check_language_ub,
                concat!(stringify!($SelfT), "::unchecked_disjoint_bitor cannot bitor overlapping ones"),
                (
                    lhs: $SelfT = self,
                    rhs: $SelfT = rhs,
                ) => (lhs & rhs) == 0,
            );

            // SAFETY: Same precondition.
            unsafe { intrinsics::disjoint_bitor(self, rhs) }
        }

        /// 返回以任意底数表示的数字的对数，
        /// 向下取整。
        ///
        /// 由于实现细节，此方法可能未被优化；
        /// [`ilog2`](Self::ilog2) can produce results more efficiently for base 2,
        /// and [`ilog10`](Self::ilog10) can produce results more efficiently for base 10.
        ///
        /// # 异常
        ///
        /// This function will panic if `self` is zero, or if `base` is less than 2.
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(5", stringify!($SelfT), ".ilog(5), 1);")]
        /// ```
        #[stable(feature = "int_log", since = "1.67.0")]
        #[rustc_const_stable(feature = "int_log", since = "1.67.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        #[track_caller]
        pub const fn ilog(self, base: Self) -> u32 {
            assert!(base >= 2, "base of integer logarithm must be at least 2");
            if let Some(log) = self.checked_ilog(base) {
                log
            } else {
                imp::int_log10::panic_for_nonpositive_argument()
            }
        }

        /// 返回以基数 2 表示的数字的对数，向下取整。
        ///
        /// # 异常
        ///
        /// This function will panic if `self` is zero.
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(2", stringify!($SelfT), ".ilog2(), 1);")]
        /// ```
        #[stable(feature = "int_log", since = "1.67.0")]
        #[rustc_const_stable(feature = "int_log", since = "1.67.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        #[track_caller]
        pub const fn ilog2(self) -> u32 {
            if let Some(log) = self.checked_ilog2() {
                log
            } else {
                imp::int_log10::panic_for_nonpositive_argument()
            }
        }

        /// 返回以基数 10 表示的数字的对数，向下取整。
        ///
        /// # 异常
        ///
        /// This function will panic if `self` is zero.
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(10", stringify!($SelfT), ".ilog10(), 1);")]
        /// ```
        #[stable(feature = "int_log", since = "1.67.0")]
        #[rustc_const_stable(feature = "int_log", since = "1.67.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        #[track_caller]
        pub const fn ilog10(self) -> u32 {
            if let Some(log) = self.checked_ilog10() {
                log
            } else {
                imp::int_log10::panic_for_nonpositive_argument()
            }
        }

        /// 返回该数以任意为底的对数，向下取整。
        /// 向下取整。
        ///
        /// Returns `None` if the number is zero, or if the base is not at least 2.
        ///
        /// 由于实现细节原因，该方法可能未被优化；
        /// `checked_ilog2` can produce results more efficiently for base 2, and
        /// `checked_ilog10` can produce results more efficiently for base 10.
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(5", stringify!($SelfT), ".checked_ilog(5), Some(1));")]
        #[doc = concat!("assert_eq!(4", stringify!($SelfT), ".checked_ilog(5), Some(0));")]
        #[doc = concat!("assert_eq!(5", stringify!($SelfT), ".checked_ilog(0), None);")]
        #[doc = concat!("assert_eq!(5", stringify!($SelfT), ".checked_ilog(1), None);")]
        #[doc = concat!("assert_eq!(0", stringify!($SelfT), ".checked_ilog(1), None);")]
        /// ```
        #[stable(feature = "int_log", since = "1.67.0")]
        #[rustc_const_stable(feature = "int_log", since = "1.67.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        pub const fn checked_ilog(self, base: Self) -> Option<u32> {
            // Inform compiler of optimizations when the base is known at
            // compile time and there's a cheaper method available.
            //
            // Note: Like all optimizations, this is not guaranteed to be
            // applied by the compiler. If you want those specific bases,
            // use `.checked_ilog2()` or `.checked_ilog10()` directly.
            if core::intrinsics::is_val_statically_known(base) {
                // change of base:
                // if base == 2 ** k, then
                // log(base, n) == log(2, n) / k
                if base.is_power_of_two() && base > 1 {
                    let k = base.ilog2();
                    return Some(try_opt!(self.checked_ilog2()) / k);
                }
                if base == 10 {
                    return self.checked_ilog10();
                }
            }

            if self <= 0 || base <= 1 {
                None
            } else if self < base {
                Some(0)
            } else {
                // Since base >= self, n >= 1
                let mut n = 1;
                let mut r = base;

                // Optimization for 128 bit wide integers.
                if Self::BITS == 128 {
                    // The following is a correct lower bound for ⌊log(base,self)⌋ because
                    //
                    // log(base,self) = log(2,self) / log(2,base)
                    //                ≥ ⌊log(2,self)⌋ / (⌊log(2,base)⌋ + 1)
                    //
                    // hence
                    //
                    // ⌊log(base,self)⌋ ≥ ⌊ ⌊log(2,self)⌋ / (⌊log(2,base)⌋ + 1) ⌋ .
                    n = self.ilog2() / (base.ilog2() + 1);
                    r = base.pow(n);
                }

                while r <= self / base {
                    n += 1;
                    r *= base;
                }
                Some(n)
            }
        }

        /// 返回该数的以 2 为底的对数，向下取整。
        ///
        /// Returns `None` if the number is zero.
        ///
        /// Note that this is equivalent to [`highest_one`](Self::highest_one).
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(2", stringify!($SelfT), ".checked_ilog2(), Some(1));")]
        /// ```
        #[stable(feature = "int_log", since = "1.67.0")]
        #[rustc_const_stable(feature = "int_log", since = "1.67.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        pub const fn checked_ilog2(self) -> Option<u32> {
            match NonZero::new(self) {
                Some(x) => Some(x.ilog2()),
                None => None,
            }
        }

        /// 返回该数的以 10 为底的对数，向下取整。
        ///
        /// Returns `None` if the number is zero.
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(10", stringify!($SelfT), ".checked_ilog10(), Some(1));")]
        /// ```
        #[stable(feature = "int_log", since = "1.67.0")]
        #[rustc_const_stable(feature = "int_log", since = "1.67.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        pub const fn checked_ilog10(self) -> Option<u32> {
            match NonZero::new(self) {
                Some(x) => Some(x.ilog10()),
                None => None,
            }
        }

        /// Checked negation. Computes `-self`, returning `None` unless `self ==
        /// 0`.
        ///
        /// 注意，对任何正整数进行否定会导致溢出。
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(0", stringify!($SelfT), ".checked_neg(), Some(0));")]
        #[doc = concat!("assert_eq!(1", stringify!($SelfT), ".checked_neg(), None);")]
        /// ```
        #[stable(feature = "wrapping", since = "1.7.0")]
        #[rustc_const_stable(feature = "const_checked_int_methods", since = "1.47.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        pub const fn checked_neg(self) -> Option<Self> {
            let (a, b) = self.overflowing_neg();
            if intrinsics::unlikely(b) { None } else { Some(a) }
        }

        /// Strict negation. Computes `-self`, panicking unless `self ==
        /// 0`.
        ///
        /// 注意，对任何正整数进行否定会导致溢出。
        ///
        /// # 恐慌
        ///
        /// ## 溢出行为
        ///
        /// 无论是否启用溢出检查，此函数在溢出时总会引发恐慌。
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(0", stringify!($SelfT), ".strict_neg(), 0);")]
        /// ```
        ///
        /// 以下因溢出而引发恐慌：
        ///
        /// ```should_panic
        #[doc = concat!("let _ = 1", stringify!($SelfT), ".strict_neg();")]
        /// ```
        #[stable(feature = "strict_overflow_ops", since = "1.91.0")]
        #[rustc_const_stable(feature = "strict_overflow_ops", since = "1.91.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        #[track_caller]
        pub const fn strict_neg(self) -> Self {
            let (a, b) = self.overflowing_neg();
            if b { imp::overflow_panic::neg() } else { a }
        }

        /// Checked shift left. Computes `self << rhs`, returning `None`
        /// if `rhs` is larger than or equal to the number of bits in `self`.
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(0x1", stringify!($SelfT), ".checked_shl(4), Some(0x10));")]
        #[doc = concat!("assert_eq!(0x10", stringify!($SelfT), ".checked_shl(129), None);")]
        #[doc = concat!("assert_eq!(0x10", stringify!($SelfT), ".checked_shl(", stringify!($BITS_MINUS_ONE), "), Some(0));")]
        /// ```
        #[stable(feature = "wrapping", since = "1.7.0")]
        #[rustc_const_stable(feature = "const_checked_int_methods", since = "1.47.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        pub const fn checked_shl(self, rhs: u32) -> Option<Self> {
            // Not using overflowing_shl as that's a wrapping shift
            if rhs < Self::BITS {
                // SAFETY: just checked the RHS is in-range
                Some(unsafe { self.unchecked_shl(rhs) })
            } else {
                None
            }
        }

        /// Strict shift left. Computes `self << rhs`, panicking if `rhs` is larger
        /// than or equal to the number of bits in `self`.
        ///
        /// # 恐慌
        ///
        /// ## 溢出行为
        ///
        /// 无论是否启用溢出检查，此函数在溢出时总会引发恐慌。
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(0x1", stringify!($SelfT), ".strict_shl(4), 0x10);")]
        /// ```
        ///
        /// 以下因溢出而引发恐慌：
        ///
        /// ```should_panic
        #[doc = concat!("let _ = 0x10", stringify!($SelfT), ".strict_shl(129);")]
        /// ```
        #[stable(feature = "strict_overflow_ops", since = "1.91.0")]
        #[rustc_const_stable(feature = "strict_overflow_ops", since = "1.91.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        #[track_caller]
        pub const fn strict_shl(self, rhs: u32) -> Self {
            let (a, b) = self.overflowing_shl(rhs);
            if b { imp::overflow_panic::shl() } else { a }
        }

        /// Unchecked shift left. Computes `self << rhs`, assuming that
        /// `rhs` is less than the number of bits in `self`.
        ///
        /// # 安全性
        ///
        /// This results in undefined behavior if `rhs` is larger than
        /// or equal to the number of bits in `self`,
        /// i.e. when [`checked_shl`] would return `None`.
        ///
        #[doc = concat!("[`checked_shl`]: ", stringify!($SelfT), "::checked_shl")]
        #[stable(feature = "unchecked_shifts", since = "1.93.0")]
        #[rustc_const_stable(feature = "unchecked_shifts", since = "1.93.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline(always)]
        #[track_caller]
        pub const unsafe fn unchecked_shl(self, rhs: u32) -> Self {
            assert_unsafe_precondition!(
                check_language_ub,
                concat!(stringify!($SelfT), "::unchecked_shl cannot overflow"),
                (
                    rhs: u32 = rhs,
                ) => rhs < <$ActualT>::BITS,
            );

            // SAFETY: this is guaranteed to be safe by the caller.
            unsafe {
                intrinsics::unchecked_shl(self, rhs)
            }
        }

        /// Unbounded shift left. Computes `self << rhs`, without bounding the value of `rhs`.
        ///
        /// If `rhs` is larger or equal to the number of bits in `self`,
        /// the entire value is shifted out, and `0` is returned.
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(0x1_", stringify!($SelfT), ".unbounded_shl(4), 0x10);")]
        #[doc = concat!("assert_eq!(0x1_", stringify!($SelfT), ".unbounded_shl(129), 0);")]
        #[doc = concat!("assert_eq!(0b101_", stringify!($SelfT), ".unbounded_shl(0), 0b101);")]
        #[doc = concat!("assert_eq!(0b101_", stringify!($SelfT), ".unbounded_shl(1), 0b1010);")]
        #[doc = concat!("assert_eq!(0b101_", stringify!($SelfT), ".unbounded_shl(2), 0b10100);")]
        #[doc = concat!("assert_eq!(42_", stringify!($SelfT), ".unbounded_shl(", stringify!($BITS), "), 0);")]
        #[doc = concat!("assert_eq!(42_", stringify!($SelfT), ".unbounded_shl(1).unbounded_shl(", stringify!($BITS_MINUS_ONE), "), 0);")]
        ///
        #[doc = concat!("let start : ", stringify!($SelfT), " = 13;")]
        /// let mut running = start;
        /// for i in 0..160 {
        ///     // The unbounded shift left by i is the same as `<< 1` i times
        ///     assert_eq!(running, start.unbounded_shl(i));
        ///     // Which is not always the case for a wrapping shift
        #[doc = concat!("    assert_eq!(running == start.wrapping_shl(i), i < ", stringify!($BITS), ");")]
        ///
        ///     running <<= 1;
        /// }
        /// ```
        #[stable(feature = "unbounded_shifts", since = "1.87.0")]
        #[rustc_const_stable(feature = "unbounded_shifts", since = "1.87.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        pub const fn unbounded_shl(self, rhs: u32) -> $SelfT{
            if rhs < Self::BITS {
                // SAFETY:
                // rhs is just checked to be in-range above
                unsafe { self.unchecked_shl(rhs) }
            } else {
                0
            }
        }

        /// Exact shift left. Computes `self << rhs` as long as it can be reversed losslessly.
        ///
        /// Returns `None` if any non-zero bits would be shifted out or if `rhs` >=
        #[doc = concat!("`", stringify!($SelfT), "::BITS`.")]
        /// Otherwise, returns `Some(self << rhs)`.
        ///
        /// # 示例
        ///
        /// ```
        /// #![feature(exact_bitshifts)]
        ///
        #[doc = concat!("assert_eq!(0x1", stringify!($SelfT), ".shl_exact(4), Some(0x10));")]
        #[doc = concat!("assert_eq!(0x1", stringify!($SelfT), ".shl_exact(129), None);")]
        /// ```
        #[unstable(feature = "exact_bitshifts", issue = "144336")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        pub const fn shl_exact(self, rhs: u32) -> Option<$SelfT> {
            if rhs <= self.leading_zeros() && rhs < <$SelfT>::BITS {
                // SAFETY: rhs is checked above
                Some(unsafe { self.unchecked_shl(rhs) })
            } else {
                None
            }
        }

        /// Unchecked exact shift left. Computes `self << rhs`, assuming the operation can be
        /// losslessly reversed `rhs` cannot be larger than
        #[doc = concat!("`", stringify!($SelfT), "::BITS`.")]
        ///
        /// # 安全性
        ///
        /// 当 `rhs > self.leading_zeros() || rhs >=
        #[doc = concat!(stringify!($SelfT), "::BITS`")]
        /// 即，当
        #[doc = concat!("[`", stringify!($SelfT), "::shl_exact`]")]
        /// would return `None`.
        #[unstable(feature = "exact_bitshifts", issue = "144336")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        pub const unsafe fn unchecked_shl_exact(self, rhs: u32) -> $SelfT {
            assert_unsafe_precondition!(
                check_library_ub,
                concat!(stringify!($SelfT), "::unchecked_shl_exact cannot shift out non-zero bits"),
                (
                    zeros: u32 = self.leading_zeros(),
                    bits: u32 =  <$SelfT>::BITS,
                    rhs: u32 = rhs,
                ) => rhs <= zeros && rhs < bits,
            );

            // SAFETY: this is guaranteed to be safe by the caller
            unsafe { self.unchecked_shl(rhs) }
        }

        /// Checked shift right. Computes `self >> rhs`, returning `None`
        /// if `rhs` is larger than or equal to the number of bits in `self`.
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(0x10", stringify!($SelfT), ".checked_shr(4), Some(0x1));")]
        #[doc = concat!("assert_eq!(0x10", stringify!($SelfT), ".checked_shr(129), None);")]
        /// ```
        #[stable(feature = "wrapping", since = "1.7.0")]
        #[rustc_const_stable(feature = "const_checked_int_methods", since = "1.47.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        pub const fn checked_shr(self, rhs: u32) -> Option<Self> {
            // Not using overflowing_shr as that's a wrapping shift
            if rhs < Self::BITS {
                // SAFETY: just checked the RHS is in-range
                Some(unsafe { self.unchecked_shr(rhs) })
            } else {
                None
            }
        }

        /// Strict shift right. Computes `self >> rhs`, panicking if `rhs` is
        /// larger than or equal to the number of bits in `self`.
        ///
        /// # panic
        ///
        /// ## 溢出行为
        ///
        /// 无论是否启用溢出检查，此函数在溢出时总会触发 panic。
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(0x10", stringify!($SelfT), ".strict_shr(4), 0x1);")]
        /// ```
        ///
        /// 以下情况因溢出而触发 panic：
        ///
        /// ```should_panic
        #[doc = concat!("let _ = 0x10", stringify!($SelfT), ".strict_shr(129);")]
        /// ```
        #[stable(feature = "strict_overflow_ops", since = "1.91.0")]
        #[rustc_const_stable(feature = "strict_overflow_ops", since = "1.91.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        #[track_caller]
        pub const fn strict_shr(self, rhs: u32) -> Self {
            let (a, b) = self.overflowing_shr(rhs);
            if b { imp::overflow_panic::shr() } else { a }
        }

        /// Unchecked shift right. Computes `self >> rhs`, assuming that
        /// `rhs` is less than the number of bits in `self`.
        ///
        /// # 安全性
        ///
        /// This results in undefined behavior if `rhs` is larger than
        /// or equal to the number of bits in `self`,
        /// i.e. when [`checked_shr`] would return `None`.
        ///
        #[doc = concat!("[`checked_shr`]: ", stringify!($SelfT), "::checked_shr")]
        #[stable(feature = "unchecked_shifts", since = "1.93.0")]
        #[rustc_const_stable(feature = "unchecked_shifts", since = "1.93.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline(always)]
        #[track_caller]
        pub const unsafe fn unchecked_shr(self, rhs: u32) -> Self {
            assert_unsafe_precondition!(
                check_language_ub,
                concat!(stringify!($SelfT), "::unchecked_shr cannot overflow"),
                (
                    rhs: u32 = rhs,
                ) => rhs < <$ActualT>::BITS,
            );

            // SAFETY: this is guaranteed to be safe by the caller.
            unsafe {
                intrinsics::unchecked_shr(self, rhs)
            }
        }

        /// Unbounded shift right. Computes `self >> rhs`, without bounding the value of `rhs`.
        ///
        /// If `rhs` is larger or equal to the number of bits in `self`,
        /// the entire value is shifted out, and `0` is returned.
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(0x10_", stringify!($SelfT), ".unbounded_shr(4), 0x1);")]
        #[doc = concat!("assert_eq!(0x10_", stringify!($SelfT), ".unbounded_shr(129), 0);")]
        #[doc = concat!("assert_eq!(0b1010_", stringify!($SelfT), ".unbounded_shr(0), 0b1010);")]
        #[doc = concat!("assert_eq!(0b1010_", stringify!($SelfT), ".unbounded_shr(1), 0b101);")]
        #[doc = concat!("assert_eq!(0b1010_", stringify!($SelfT), ".unbounded_shr(2), 0b10);")]
        #[doc = concat!("assert_eq!(42_", stringify!($SelfT), ".unbounded_shr(", stringify!($BITS), "), 0);")]
        #[doc = concat!("assert_eq!(42_", stringify!($SelfT), ".unbounded_shr(1).unbounded_shr(", stringify!($BITS_MINUS_ONE), "), 0);")]
        ///
        #[doc = concat!("let start = ", stringify!($SelfT), "::rotate_right(13, 4);")]
        /// let mut running = start;
        /// for i in 0..160 {
        ///     // The unbounded shift right by i is the same as `>> 1` i times
        ///     assert_eq!(running, start.unbounded_shr(i));
        ///     // Which is not always the case for a wrapping shift
        #[doc = concat!("    assert_eq!(running == start.wrapping_shr(i), i < ", stringify!($BITS), ");")]
        ///
        ///     running >>= 1;
        /// }
        /// ```
        #[stable(feature = "unbounded_shifts", since = "1.87.0")]
        #[rustc_const_stable(feature = "unbounded_shifts", since = "1.87.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        pub const fn unbounded_shr(self, rhs: u32) -> $SelfT{
            if rhs < Self::BITS {
                // SAFETY:
                // rhs is just checked to be in-range above
                unsafe { self.unchecked_shr(rhs) }
            } else {
                0
            }
        }

        /// Exact shift right. Computes `self >> rhs` as long as it can be reversed losslessly.
        ///
        /// Returns `None` if any non-zero bits would be shifted out or if `rhs` >=
        #[doc = concat!("`", stringify!($SelfT), "::BITS`.")]
        /// Otherwise, returns `Some(self >> rhs)`.
        ///
        /// # 示例
        ///
        /// ```
        /// #![feature(exact_bitshifts)]
        ///
        #[doc = concat!("assert_eq!(0x10", stringify!($SelfT), ".shr_exact(4), Some(0x1));")]
        #[doc = concat!("assert_eq!(0x10", stringify!($SelfT), ".shr_exact(5), None);")]
        /// ```
        #[unstable(feature = "exact_bitshifts", issue = "144336")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        pub const fn shr_exact(self, rhs: u32) -> Option<$SelfT> {
            if rhs <= self.trailing_zeros() && rhs < <$SelfT>::BITS {
                // SAFETY: rhs is checked above
                Some(unsafe { self.unchecked_shr(rhs) })
            } else {
                None
            }
        }

        /// Unchecked exact shift right. Computes `self >> rhs`, assuming the operation can be
        /// losslessly reversed and `rhs` cannot be larger than
        #[doc = concat!("`", stringify!($SelfT), "::BITS`.")]
        ///
        /// # 安全性
        ///
        /// 当 `rhs > self.trailing_zeros() || rhs >=
        #[doc = concat!(stringify!($SelfT), "::BITS`")]
        /// 即，当
        #[doc = concat!("[`", stringify!($SelfT), "::shr_exact`]")]
        /// would return `None`.
        #[unstable(feature = "exact_bitshifts", issue = "144336")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        pub const unsafe fn unchecked_shr_exact(self, rhs: u32) -> $SelfT {
            assert_unsafe_precondition!(
                check_library_ub,
                concat!(stringify!($SelfT), "::unchecked_shr_exact cannot shift out non-zero bits"),
                (
                    zeros: u32 = self.trailing_zeros(),
                    bits: u32 =  <$SelfT>::BITS,
                    rhs: u32 = rhs,
                ) => rhs <= zeros && rhs < bits,
            );

            // SAFETY: this is guaranteed to be safe by the caller
            unsafe { self.unchecked_shr(rhs) }
        }

        /// Checked exponentiation. Computes `self.pow(exp)`, returning `None` if
        /// overflow occurred.
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(2", stringify!($SelfT), ".checked_pow(5), Some(32));")]
        #[doc = concat!("assert_eq!(0_", stringify!($SelfT), ".checked_pow(0), Some(1));")]
        #[doc = concat!("assert_eq!(", stringify!($SelfT), "::MAX.checked_pow(2), None);")]
        /// ```
        #[stable(feature = "no_panic_pow", since = "1.34.0")]
        #[rustc_const_stable(feature = "const_int_pow", since = "1.50.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        pub const fn checked_pow(self, mut exp: u32) -> Option<Self> {
            let mut base = self;
            let mut acc: Self = 1;

            if intrinsics::is_val_statically_known(base) && base.is_power_of_two() {
                // change of base:
                // if base == 2 ** k, then
                //    (2 ** k) ** n
                // == 2 ** (k * n)
                // == 1 << (k * n)
                let k = base.ilog2();
                let shift = try_opt!(k.checked_mul(exp));
                return (1 as Self).checked_shl(shift);
            }

            if exp == 0 {
                return Some(1);
            }

            if intrinsics::is_val_statically_known(exp) {
                while exp > 1 {
                    if (exp & 1) == 1 {
                        acc = try_opt!(acc.checked_mul(base));
                    }
                    exp /= 2;
                    base = try_opt!(base.checked_mul(base));
                }

                // since exp!=0, finally the exp must be 1.
                // Deal with the final bit of the exponent separately, since
                // squaring the base afterwards is not necessary and may cause a
                // needless overflow.
                return acc.checked_mul(base);
            }

            loop {
                if (exp & 1) == 1 {
                    acc = try_opt!(acc.checked_mul(base));
                    // since exp!=0, finally the exp must be 1.
                    if exp == 1 {
                        return Some(acc);
                    }
                }
                exp /= 2;
                base = try_opt!(base.checked_mul(base));
            }
        }

        /// Strict exponentiation. Computes `self.pow(exp)`, panicking if
        /// 发生溢出则触发 panic。
        ///
        /// # panic
        ///
        /// ## 溢出行为
        ///
        /// 无论是否启用溢出检查，此函数在溢出时总会触发 panic。
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(2", stringify!($SelfT), ".strict_pow(5), 32);")]
        #[doc = concat!("assert_eq!(0_", stringify!($SelfT), ".strict_pow(0), 1);")]
        /// ```
        ///
        /// 以下情况因溢出而触发 panic：
        ///
        /// ```should_panic
        #[doc = concat!("let _ = ", stringify!($SelfT), "::MAX.strict_pow(2);")]
        /// ```
        #[stable(feature = "strict_overflow_ops", since = "1.91.0")]
        #[rustc_const_stable(feature = "strict_overflow_ops", since = "1.91.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        #[track_caller]
        pub const fn strict_pow(self, exp: u32) -> Self {
            match self.checked_pow(exp) {
                None => imp::overflow_panic::pow(),
                Some(a) => a,
            }
        }

        /// Saturating integer addition. Computes `self + rhs`, saturating at
        /// 数值边界处饱和，而不是发生溢出。
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(100", stringify!($SelfT), ".saturating_add(1), 101);")]
        #[doc = concat!("assert_eq!(", stringify!($SelfT), "::MAX.saturating_add(127), ", stringify!($SelfT), "::MAX);")]
        /// ```
        #[stable(feature = "rust1", since = "1.0.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[rustc_const_stable(feature = "const_saturating_int_methods", since = "1.47.0")]
        #[inline(always)]
        pub const fn saturating_add(self, rhs: Self) -> Self {
            intrinsics::saturating_add(self, rhs)
        }

        /// Saturating addition with a signed integer. Computes `self + rhs`,
        /// 在数值边界处饱和，而不是发生溢出。
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(1", stringify!($SelfT), ".saturating_add_signed(2), 3);")]
        #[doc = concat!("assert_eq!(1", stringify!($SelfT), ".saturating_add_signed(-2), 0);")]
        #[doc = concat!("assert_eq!((", stringify!($SelfT), "::MAX - 2).saturating_add_signed(4), ", stringify!($SelfT), "::MAX);")]
        /// ```
        #[stable(feature = "mixed_integer_ops", since = "1.66.0")]
        #[rustc_const_stable(feature = "mixed_integer_ops", since = "1.66.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        pub const fn saturating_add_signed(self, rhs: $SignedT) -> Self {
            let (res, overflow) = self.overflowing_add(rhs as Self);
            if overflow == (rhs < 0) {
                res
            } else if overflow {
                Self::MAX
            } else {
                0
            }
        }

        /// Saturating integer subtraction. Computes `self - rhs`, saturating
        /// 数值边界处饱和，而不是发生溢出。
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(100", stringify!($SelfT), ".saturating_sub(27), 73);")]
        #[doc = concat!("assert_eq!(13", stringify!($SelfT), ".saturating_sub(127), 0);")]
        /// ```
        #[stable(feature = "rust1", since = "1.0.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[rustc_const_stable(feature = "const_saturating_int_methods", since = "1.47.0")]
        #[inline(always)]
        pub const fn saturating_sub(self, rhs: Self) -> Self {
            intrinsics::saturating_sub(self, rhs)
        }

        /// Saturating integer subtraction. Computes `self` - `rhs`, saturating at
        /// 在数值边界处饱和，而不是溢出。
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(1", stringify!($SelfT), ".saturating_sub_signed(2), 0);")]
        #[doc = concat!("assert_eq!(1", stringify!($SelfT), ".saturating_sub_signed(-2), 3);")]
        #[doc = concat!("assert_eq!((", stringify!($SelfT), "::MAX - 2).saturating_sub_signed(-4), ", stringify!($SelfT), "::MAX);")]
        /// ```
        #[stable(feature = "mixed_integer_ops_unsigned_sub", since = "1.90.0")]
        #[rustc_const_stable(feature = "mixed_integer_ops_unsigned_sub", since = "1.90.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        pub const fn saturating_sub_signed(self, rhs: $SignedT) -> Self {
            let (res, overflow) = self.overflowing_sub_signed(rhs);

            if !overflow {
                res
            } else if rhs < 0 {
                Self::MAX
            } else {
                0
            }
        }

        /// Saturating integer multiplication. Computes `self * rhs`,
        /// 在数值边界处饱和，而不是溢出。
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(2", stringify!($SelfT), ".saturating_mul(10), 20);")]
        #[doc = concat!("assert_eq!((", stringify!($SelfT), "::MAX).saturating_mul(10), ", stringify!($SelfT),"::MAX);")]
        /// ```
        #[stable(feature = "wrapping", since = "1.7.0")]
        #[rustc_const_stable(feature = "const_saturating_int_methods", since = "1.47.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        pub const fn saturating_mul(self, rhs: Self) -> Self {
            match self.checked_mul(rhs) {
                Some(x) => x,
                None => Self::MAX,
            }
        }

        /// Saturating integer division. Computes `self / rhs`, saturating at the
        /// 在数值边界处饱和，而不是溢出。
        ///
        /// # 恐慌
        ///
        /// This function will panic if `rhs` is zero.
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(5", stringify!($SelfT), ".saturating_div(2), 2);")]
        ///
        /// ```
        #[stable(feature = "saturating_div", since = "1.58.0")]
        #[rustc_const_stable(feature = "saturating_div", since = "1.58.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        #[track_caller]
        pub const fn saturating_div(self, rhs: Self) -> Self {
            // on unsigned types, there is no overflow in integer division
            self.wrapping_div(rhs)
        }

        /// Saturating integer exponentiation. Computes `self.pow(exp)`,
        /// 在数值边界处饱和，而不是溢出。
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(4", stringify!($SelfT), ".saturating_pow(3), 64);")]
        #[doc = concat!("assert_eq!(0_", stringify!($SelfT), ".saturating_pow(0), 1);")]
        #[doc = concat!("assert_eq!(", stringify!($SelfT), "::MAX.saturating_pow(2), ", stringify!($SelfT), "::MAX);")]
        /// ```
        #[stable(feature = "no_panic_pow", since = "1.34.0")]
        #[rustc_const_stable(feature = "const_int_pow", since = "1.50.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        pub const fn saturating_pow(self, exp: u32) -> Self {
            match self.checked_pow(exp) {
                Some(x) => x,
                None => Self::MAX,
            }
        }

        /// Wrapping (modular) addition. Computes `self + rhs`,
        /// 在类型边界处循环。
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(200", stringify!($SelfT), ".wrapping_add(55), 255);")]
        #[doc = concat!("assert_eq!(200", stringify!($SelfT), ".wrapping_add(", stringify!($SelfT), "::MAX), 199);")]
        /// ```
        #[stable(feature = "rust1", since = "1.0.0")]
        #[rustc_const_stable(feature = "const_wrapping_math", since = "1.32.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline(always)]
        pub const fn wrapping_add(self, rhs: Self) -> Self {
            intrinsics::wrapping_add(self, rhs)
        }

        /// 带符号整数的循环（模）加法。计算
        /// `self + rhs`, wrapping around at the boundary of the type.
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(1", stringify!($SelfT), ".wrapping_add_signed(2), 3);")]
        #[doc = concat!("assert_eq!(1", stringify!($SelfT), ".wrapping_add_signed(-2), ", stringify!($SelfT), "::MAX);")]
        #[doc = concat!("assert_eq!((", stringify!($SelfT), "::MAX - 2).wrapping_add_signed(4), 1);")]
        /// ```
        #[stable(feature = "mixed_integer_ops", since = "1.66.0")]
        #[rustc_const_stable(feature = "mixed_integer_ops", since = "1.66.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        pub const fn wrapping_add_signed(self, rhs: $SignedT) -> Self {
            self.wrapping_add(rhs as Self)
        }

        /// Wrapping (modular) subtraction. Computes `self - rhs`,
        /// 在类型边界处循环。
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(100", stringify!($SelfT), ".wrapping_sub(100), 0);")]
        #[doc = concat!("assert_eq!(100", stringify!($SelfT), ".wrapping_sub(", stringify!($SelfT), "::MAX), 101);")]
        /// ```
        #[stable(feature = "rust1", since = "1.0.0")]
        #[rustc_const_stable(feature = "const_wrapping_math", since = "1.32.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline(always)]
        pub const fn wrapping_sub(self, rhs: Self) -> Self {
            intrinsics::wrapping_sub(self, rhs)
        }

        /// 带符号整数的循环（模）减法。计算
        /// `self - rhs`, wrapping around at the boundary of the type.
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(1", stringify!($SelfT), ".wrapping_sub_signed(2), ", stringify!($SelfT), "::MAX);")]
        #[doc = concat!("assert_eq!(1", stringify!($SelfT), ".wrapping_sub_signed(-2), 3);")]
        #[doc = concat!("assert_eq!((", stringify!($SelfT), "::MAX - 2).wrapping_sub_signed(-4), 1);")]
        /// ```
        #[stable(feature = "mixed_integer_ops_unsigned_sub", since = "1.90.0")]
        #[rustc_const_stable(feature = "mixed_integer_ops_unsigned_sub", since = "1.90.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        pub const fn wrapping_sub_signed(self, rhs: $SignedT) -> Self {
            self.wrapping_sub(rhs as Self)
        }

        /// 循环（模）乘法。计算 `self *`
        /// rhs`，在类型边界处循环。
        ///
        /// # 示例
        ///
        /// Please note that this example is shared among integer types, which is why `u8` is used.
        ///
        /// ```
        /// assert_eq!(10u8.wrapping_mul(12), 120);
        /// assert_eq!(25u8.wrapping_mul(12), 44);
        /// ```
        #[stable(feature = "rust1", since = "1.0.0")]
        #[rustc_const_stable(feature = "const_wrapping_math", since = "1.32.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline(always)]
        pub const fn wrapping_mul(self, rhs: Self) -> Self {
            intrinsics::wrapping_mul(self, rhs)
        }

        /// Wrapping (modular) division. Computes `self / rhs`.
        ///
        /// 无符号类型的循环除法就是普通除法。不存在
        /// 循环的可能性。此函数的存在是为了让所有操作都包含在循环操作中。
        /// # 恐慌
        ///
        /// # Panics
        ///
        /// This function will panic if `rhs` is zero.
        ///
        /// # Examples
        ///
        /// ```
        #[doc = concat!("assert_eq!(100", stringify!($SelfT), ".wrapping_div(10), 10);")]
        /// ```
        #[stable(feature = "num_wrapping", since = "1.2.0")]
        #[rustc_const_stable(feature = "const_wrapping_int_methods", since = "1.52.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline(always)]
        #[track_caller]
        pub const fn wrapping_div(self, rhs: Self) -> Self {
            self / rhs
        }

        /// Wrapping Euclidean division. Computes `self.div_euclid(rhs)`.
        ///
        /// 循环的可能性。此函数的存在是为了让所有操作都包含在循环操作中。由于
        /// 正整数的所有常见除法定义都是相同的，
        /// operations are accounted for in the wrapping operations. Since, for
        /// # 恐慌
        /// this is exactly equal to `self.wrapping_div(rhs)`.
        ///
        /// # 示例
        ///
        /// This function will panic if `rhs` is zero.
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(100", stringify!($SelfT), ".wrapping_div_euclid(10), 10);")]
        /// ```
        #[stable(feature = "euclidean_division", since = "1.38.0")]
        #[rustc_const_stable(feature = "const_euclidean_int_methods", since = "1.52.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline(always)]
        #[track_caller]
        pub const fn wrapping_div_euclid(self, rhs: Self) -> Self {
            self / rhs
        }

        /// Wrapping (modular) remainder. Computes `self % rhs`.
        ///
        /// 无符号类型的循环余数计算就是普通的
        /// 余数计算。不存在循环的可能性。
        /// 此函数的存在是为了让所有操作都包含在循环操作中。
        /// 循环操作中。
        ///
        /// # 恐慌
        ///
        /// This function will panic if `rhs` is zero.
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(100", stringify!($SelfT), ".wrapping_rem(10), 0);")]
        /// ```
        #[stable(feature = "num_wrapping", since = "1.2.0")]
        #[rustc_const_stable(feature = "const_wrapping_int_methods", since = "1.52.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline(always)]
        #[track_caller]
        pub const fn wrapping_rem(self, rhs: Self) -> Self {
            self % rhs
        }

        /// Wrapping Euclidean modulo. Computes `self.rem_euclid(rhs)`.
        ///
        /// 对无符号类型进行的包装取模计算就是普通的
        /// 余数计算。不可能发生包装现象。
        /// 此函数的存在是为了将所有操作都纳入
        /// 包装操作中。由于对于正整数，所有常见的
        /// 除法定义都是相同的，因此这完全等同于
        /// `self.wrapping_rem(rhs)`.
        ///
        /// # 恐慌
        ///
        /// This function will panic if `rhs` is zero.
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(100", stringify!($SelfT), ".wrapping_rem_euclid(10), 0);")]
        /// ```
        #[stable(feature = "euclidean_division", since = "1.38.0")]
        #[rustc_const_stable(feature = "const_euclidean_int_methods", since = "1.52.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline(always)]
        #[track_caller]
        pub const fn wrapping_rem_euclid(self, rhs: Self) -> Self {
            self % rhs
        }

        /// Wrapping (modular) negation. Computes `-self`,
        /// 在类型边界处的包装。
        ///
        /// 由于无符号类型没有负数对应值
        /// all applications of this function will wrap (except for `-0`).
        /// 对于小于相应有符号类型最大值的值
        /// 结果等同于将相应有符号值强制转换。
        /// Any larger values are equivalent to `MAX + 1 - (val - MAX - 1)` where
        /// `MAX` is the corresponding signed type's maximum.
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(0_", stringify!($SelfT), ".wrapping_neg(), 0);")]
        #[doc = concat!("assert_eq!(", stringify!($SelfT), "::MAX.wrapping_neg(), 1);")]
        #[doc = concat!("assert_eq!(13_", stringify!($SelfT), ".wrapping_neg(), (!13) + 1);")]
        #[doc = concat!("assert_eq!(42_", stringify!($SelfT), ".wrapping_neg(), !(42 - 1));")]
        /// ```
        #[stable(feature = "num_wrapping", since = "1.2.0")]
        #[rustc_const_stable(feature = "const_wrapping_math", since = "1.32.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline(always)]
        pub const fn wrapping_neg(self) -> Self {
            (0 as $SelfT).wrapping_sub(self)
        }

        /// Panic-free bitwise shift-left; yields `self << mask(rhs)`,
        /// where `mask` removes any high-order bits of `rhs` that
        /// 会导致移位超出类型的位宽。
        ///
        /// Beware that, unlike most other `wrapping_*` methods on integers, this
        /// does *not* give the same result as doing the shift in infinite precision
        /// then truncating as needed. Instead, the behaviour of this method matches what shift instructions
        /// do on many processors, and is what the `<<` operator does when overflow
        /// 检查被禁用，但从数值上看有些奇怪。可以考虑使用
        /// using [`Self::unbounded_shl`] which has nicer behaviour.
        ///
        /// 注意，这并不等同于左移旋转；包装左移的
        /// 右端结果的范围被限制在
        /// 类型的范围内，而不是从左端移出的比特被返回到另一端。基本整数
        /// being returned to the other end. The primitive integer
        /// types all implement a [`rotate_left`](Self::rotate_left) function,
        /// # 示例
        ///
        /// # Examples
        ///
        /// ```
        #[doc = concat!("assert_eq!(1_", stringify!($SelfT), ".wrapping_shl(7), 128);")]
        #[doc = concat!("assert_eq!(0b101_", stringify!($SelfT), ".wrapping_shl(0), 0b101);")]
        #[doc = concat!("assert_eq!(0b101_", stringify!($SelfT), ".wrapping_shl(1), 0b1010);")]
        #[doc = concat!("assert_eq!(0b101_", stringify!($SelfT), ".wrapping_shl(2), 0b10100);")]
        #[doc = concat!("assert_eq!(", stringify!($SelfT), "::MAX.wrapping_shl(2), ", stringify!($SelfT), "::MAX - 3);")]
        #[doc = concat!("assert_eq!(42_", stringify!($SelfT), ".wrapping_shl(", stringify!($BITS), "), 42);")]
        #[doc = concat!("assert_eq!(42_", stringify!($SelfT), ".wrapping_shl(1).wrapping_shl(", stringify!($BITS_MINUS_ONE), "), 0);")]
        #[doc = concat!("assert_eq!(1_", stringify!($SelfT), ".wrapping_shl(128), 1);")]
        #[doc = concat!("assert_eq!(5_", stringify!($SelfT), ".wrapping_shl(1025), 10);")]
        /// ```
        #[stable(feature = "num_wrapping", since = "1.2.0")]
        #[rustc_const_stable(feature = "const_wrapping_math", since = "1.32.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline(always)]
        pub const fn wrapping_shl(self, rhs: u32) -> Self {
            // SAFETY: the masking by the bitsize of the type ensures that we do not shift
            // out of bounds
            unsafe {
                self.unchecked_shl(rhs & (Self::BITS - 1))
            }
        }

        /// Panic-free bitwise shift-right; yields `self >> mask(rhs)`,
        /// where `mask` removes any high-order bits of `rhs` that
        /// would cause the shift to exceed the bitwidth of the type.
        ///
        /// Beware that, unlike most other `wrapping_*` methods on integers, this
        /// does *not* give the same result as doing the shift in infinite precision
        /// then truncating as needed. Instead, the behaviour of this method matches what shift instructions
        /// do on many processors, and is what the `>>` operator does when overflow
        /// 检查被禁用，但从数值上看有些异常。可以考虑使用如下方式：
        /// using [`Self::unbounded_shr`] which has nicer behaviour.
        ///
        /// 请注意，这并不等同于右旋转；
        /// 右旋转后的右侧值被限制在类型的范围内，而不是从左侧移出的位。
        /// 被返回到另一端。基本整数类型
        /// being returned to the other end. The primitive integer
        /// types all implement a [`rotate_right`](Self::rotate_right) function,
        /// # 示例
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(128_", stringify!($SelfT), ".wrapping_shr(7), 1);")]
        #[doc = concat!("assert_eq!(0b1010_", stringify!($SelfT), ".wrapping_shr(0), 0b1010);")]
        #[doc = concat!("assert_eq!(0b1010_", stringify!($SelfT), ".wrapping_shr(1), 0b101);")]
        #[doc = concat!("assert_eq!(0b1010_", stringify!($SelfT), ".wrapping_shr(2), 0b10);")]
        #[doc = concat!("assert_eq!(", stringify!($SelfT), "::MAX.wrapping_shr(1), ", stringify!($SignedT), "::MAX.cast_unsigned());")]
        #[doc = concat!("assert_eq!(42_", stringify!($SelfT), ".wrapping_shr(", stringify!($BITS), "), 42);")]
        #[doc = concat!("assert_eq!(42_", stringify!($SelfT), ".wrapping_shr(1).wrapping_shr(", stringify!($BITS_MINUS_ONE), "), 0);")]
        #[doc = concat!("assert_eq!(128_", stringify!($SelfT), ".wrapping_shr(128), 128);")]
        #[doc = concat!("assert_eq!(10_", stringify!($SelfT), ".wrapping_shr(1025), 5);")]
        /// ```
        #[stable(feature = "num_wrapping", since = "1.2.0")]
        #[rustc_const_stable(feature = "const_wrapping_math", since = "1.32.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline(always)]
        pub const fn wrapping_shr(self, rhs: u32) -> Self {
            // SAFETY: the masking by the bitsize of the type ensures that we do not shift
            // out of bounds
            unsafe {
                self.unchecked_shr(rhs & (Self::BITS - 1))
            }
        }

        /// Wrapping (modular) exponentiation. Computes `self.pow(exp)`,
        /// 在类型边界处进行模幂运算。
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(3", stringify!($SelfT), ".wrapping_pow(5), 243);")]
        /// assert_eq!(3u8.wrapping_pow(6), 217);
        #[doc = concat!("assert_eq!(0_", stringify!($SelfT), ".wrapping_pow(0), 1);")]
        /// ```
        #[stable(feature = "no_panic_pow", since = "1.34.0")]
        #[rustc_const_stable(feature = "const_int_pow", since = "1.50.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        pub const fn wrapping_pow(self, exp: u32) -> Self {
            let (a, _) = self.overflowing_pow(exp);
            a
        }

        /// Calculates `self` + `rhs`.
        ///
        /// 返回一个包含加法的元组以及一个布尔值，指示
        /// 是否会发生算术溢出。如果会发生溢出，
        /// 则返回包装后的值。
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(5", stringify!($SelfT), ".overflowing_add(2), (7, false));")]
        #[doc = concat!("assert_eq!(", stringify!($SelfT), "::MAX.overflowing_add(1), (0, true));")]
        /// ```
        #[stable(feature = "wrapping", since = "1.7.0")]
        #[rustc_const_stable(feature = "const_wrapping_math", since = "1.32.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline(always)]
        pub const fn overflowing_add(self, rhs: Self) -> (Self, bool) {
            let (a, b) = intrinsics::add_with_overflow(self as $ActualT, rhs as $ActualT);
            (a as Self, b)
        }

        /// Calculates `self` + `rhs` + `carry` and returns a tuple containing
        /// 和的以及输出进位（按此顺序）的元组。
        ///
        /// 对两个整数操作数和一个进位位进行“三元加法”，并返回一个输出整数和一个进位出位。这允许
        /// 将多个加法链接起来以创建更宽的加法，并且
        /// 对于大数加法很有用。
        /// 如果输入进位为 false，此方法与
        ///
        #[doc = concat!("This can be thought of as a ", stringify!($BITS), "-bit \"full adder\", in the electronics sense.")]
        ///
        /// If the input carry is false, this method is equivalent to
        /// [`overflowing_add`](Self::overflowing_add), and the output carry is
        /// # 示例
        /// flags are similar for unsigned integers, they are different for
        /// 返回一个包含加法的元组以及一个布尔值，指示
        ///
        /// # 是否会发生算术溢出。如果会发生溢出，
        ///
        /// ```
        #[doc = concat!("//    3  MAX    (a = 3 × 2^", stringify!($BITS), " + 2^", stringify!($BITS), " - 1)")]
        #[doc = concat!("// +  5    7    (b = 5 × 2^", stringify!($BITS), " + 7)")]
        /// // ---------
        #[doc = concat!("//    9    6    (sum = 9 × 2^", stringify!($BITS), " + 6)")]
        ///
        #[doc = concat!("let (a1, a0): (", stringify!($SelfT), ", ", stringify!($SelfT), ") = (3, ", stringify!($SelfT), "::MAX);")]
        #[doc = concat!("let (b1, b0): (", stringify!($SelfT), ", ", stringify!($SelfT), ") = (5, 7);")]
        /// let carry0 = false;
        ///
        /// let (sum0, carry1) = a0.carrying_add(b0, carry0);
        /// assert_eq!(carry1, true);
        /// let (sum1, carry2) = a1.carrying_add(b1, carry1);
        /// assert_eq!(carry2, false);
        ///
        /// assert_eq!((sum1, sum0), (9, 6));
        /// ```
        #[stable(feature = "unsigned_bigint_helpers", since = "1.91.0")]
        #[rustc_const_unstable(feature = "const_unsigned_bigint_helpers", issue = "152015")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        pub const fn carrying_add(self, rhs: Self, carry: bool) -> (Self, bool) {
            // note: longer-term this should be done via an intrinsic, but this has been shown
            //   to generate optimal code for now, and LLVM doesn't have an equivalent intrinsic
            let (a, c1) = self.overflowing_add(rhs);
            let (b, c2) = a.overflowing_add(carry as $SelfT);
            // Ideally LLVM would know this is disjoint without us telling them,
            // but it doesn't <https://github.com/llvm/llvm-project/issues/118162>
            // SAFETY: Only one of `c1` and `c2` can be set.
            // For c1 to be set we need to have overflowed, but if we did then
            // `a` is at most `MAX-1`, which means that `c2` cannot possibly
            // overflow because it's adding at most `1` (since it came from `bool`)
            (b, unsafe { intrinsics::disjoint_bitor(c1, c2) })
        }

        /// Calculates `self` + `rhs` with a signed `rhs`.
        ///
        /// # 示例
        /// whether an arithmetic overflow would occur. If an overflow would
        /// 返回一个包含减法的元组以及一个布尔值，指示
        ///
        /// # 是否会发生算术溢出。如果会发生溢出，
        ///
        /// ```
        #[doc = concat!("assert_eq!(1", stringify!($SelfT), ".overflowing_add_signed(2), (3, false));")]
        #[doc = concat!("assert_eq!(1", stringify!($SelfT), ".overflowing_add_signed(-2), (", stringify!($SelfT), "::MAX, true));")]
        #[doc = concat!("assert_eq!((", stringify!($SelfT), "::MAX - 2).overflowing_add_signed(4), (1, true));")]
        /// ```
        #[stable(feature = "mixed_integer_ops", since = "1.66.0")]
        #[rustc_const_stable(feature = "mixed_integer_ops", since = "1.66.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        pub const fn overflowing_add_signed(self, rhs: $SignedT) -> (Self, bool) {
            let (res, overflowed) = self.overflowing_add(rhs as Self);
            (res, overflowed ^ (rhs < 0))
        }

        /// Calculates `self` - `rhs`.
        ///
        /// 返回一个包含减法的元组以及一个布尔值，指示
        /// 是否会发生算术溢出。如果会发生溢出，
        /// 则返回包装后的值。
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(5", stringify!($SelfT), ".overflowing_sub(2), (3, false));")]
        #[doc = concat!("assert_eq!(0", stringify!($SelfT), ".overflowing_sub(1), (", stringify!($SelfT), "::MAX, true));")]
        /// ```
        #[stable(feature = "wrapping", since = "1.7.0")]
        #[rustc_const_stable(feature = "const_wrapping_math", since = "1.32.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline(always)]
        pub const fn overflowing_sub(self, rhs: Self) -> (Self, bool) {
            let (a, b) = intrinsics::sub_with_overflow(self as $ActualT, rhs as $ActualT);
            (a as Self, b)
        }

        /// Calculates `self` &minus; `rhs` &minus; `borrow` and returns a tuple
        /// 差值和输出借位的元组。
        ///
        /// Performs "ternary subtraction" by subtracting both an integer
        /// operand and a borrow-in bit from `self`, and returns an output
        /// 大数减法很有用。
        /// subtractions to create a wider subtraction, and can be useful for
        /// bignum subtraction.
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("//    9    6    (a = 9 × 2^", stringify!($BITS), " + 6)")]
        #[doc = concat!("// -  5    7    (b = 5 × 2^", stringify!($BITS), " + 7)")]
        /// // ---------
        #[doc = concat!("//    3  MAX    (diff = 3 × 2^", stringify!($BITS), " + 2^", stringify!($BITS), " - 1)")]
        ///
        #[doc = concat!("let (a1, a0): (", stringify!($SelfT), ", ", stringify!($SelfT), ") = (9, 6);")]
        #[doc = concat!("let (b1, b0): (", stringify!($SelfT), ", ", stringify!($SelfT), ") = (5, 7);")]
        /// let borrow0 = false;
        ///
        /// let (diff0, borrow1) = a0.borrowing_sub(b0, borrow0);
        /// assert_eq!(borrow1, true);
        /// let (diff1, borrow2) = a1.borrowing_sub(b1, borrow1);
        /// assert_eq!(borrow2, false);
        ///
        #[doc = concat!("assert_eq!((diff1, diff0), (3, ", stringify!($SelfT), "::MAX));")]
        /// ```
        #[stable(feature = "unsigned_bigint_helpers", since = "1.91.0")]
        #[rustc_const_unstable(feature = "const_unsigned_bigint_helpers", issue = "152015")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        pub const fn borrowing_sub(self, rhs: Self, borrow: bool) -> (Self, bool) {
            // note: longer-term this should be done via an intrinsic, but this has been shown
            //   to generate optimal code for now, and LLVM doesn't have an equivalent intrinsic
            let (a, c1) = self.overflowing_sub(rhs);
            let (b, c2) = a.overflowing_sub(borrow as $SelfT);
            // SAFETY: Only one of `c1` and `c2` can be set.
            // For c1 to be set we need to have underflowed, but if we did then
            // `a` is nonzero, which means that `c2` cannot possibly
            // underflow because it's subtracting at most `1` (since it came from `bool`)
            (b, unsafe { intrinsics::disjoint_bitor(c1, c2) })
        }

        /// Calculates `self` - `rhs` with a signed `rhs`
        ///
        /// 返回一个包含减法结果和布尔值的元组，该布尔值表示
        /// 是否会发生算术溢出。如果会发生
        /// 溢出，则返回包装的值。
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(1", stringify!($SelfT), ".overflowing_sub_signed(2), (", stringify!($SelfT), "::MAX, true));")]
        #[doc = concat!("assert_eq!(1", stringify!($SelfT), ".overflowing_sub_signed(-2), (3, false));")]
        #[doc = concat!("assert_eq!((", stringify!($SelfT), "::MAX - 2).overflowing_sub_signed(-4), (1, true));")]
        /// ```
        #[stable(feature = "mixed_integer_ops_unsigned_sub", since = "1.90.0")]
        #[rustc_const_stable(feature = "mixed_integer_ops_unsigned_sub", since = "1.90.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        pub const fn overflowing_sub_signed(self, rhs: $SignedT) -> (Self, bool) {
            let (res, overflow) = self.overflowing_sub(rhs as Self);

            (res, overflow ^ (rhs < 0))
        }

        /// Computes the absolute difference between `self` and `other`.
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(100", stringify!($SelfT), ".abs_diff(80), 20", stringify!($SelfT), ");")]
        #[doc = concat!("assert_eq!(100", stringify!($SelfT), ".abs_diff(110), 10", stringify!($SelfT), ");")]
        /// ```
        #[stable(feature = "int_abs_diff", since = "1.60.0")]
        #[rustc_const_stable(feature = "int_abs_diff", since = "1.60.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        pub const fn abs_diff(self, other: Self) -> Self {
            if size_of::<Self>() == 1 {
                // Trick LLVM into generating the psadbw instruction when SSE2
                // is available and this function is autovectorized for u8's.
                (self as i32).wrapping_sub(other as i32).unsigned_abs() as Self
            } else {
                if self < other {
                    other - self
                } else {
                    self - other
                }
            }
        }

        /// Calculates the multiplication of `self` and `rhs`.
        ///
        /// 返回一个包含乘积结果和布尔值的元组，该布尔值表示
        /// 是否会发生算术溢出。如果会发生
        /// 溢出，则返回包装的值。
        ///
        /// 如果您需要溢出的*具体数值*，而不仅仅是*是否*
        /// an overflow occurred, see [`Self::carrying_mul`].
        ///
        /// # 示例
        ///
        /// Please note that this example is shared among integer types, which is why `u32` is used.
        ///
        /// ```
        /// assert_eq!(5u32.overflowing_mul(2), (10, false));
        /// assert_eq!(1_000_000_000u32.overflowing_mul(10), (1410065408, true));
        /// ```
        #[stable(feature = "wrapping", since = "1.7.0")]
        #[rustc_const_stable(feature = "const_wrapping_math", since = "1.32.0")]
        #[must_use = "this returns the result of the operation, \
                          without modifying the original"]
        #[inline(always)]
        pub const fn overflowing_mul(self, rhs: Self) -> (Self, bool) {
            let (a, b) = intrinsics::mul_with_overflow(self as $ActualT, rhs as $ActualT);
            (a as Self, b)
        }

        /// Calculates the "full multiplication" `self * rhs + carry`
        /// 而不会出现溢出的情况。
        ///
        /// 它返回结果的低阶（包装）位和高阶（溢出）位
        /// 作为两个独立的值，按此顺序给出。
        ///
        /// 执行“长乘法”，该方法需要额外添加的数值，并可能返回额外的溢出量。这允许将多个
        /// 乘法链接在一起，形成表示更大值的“大整数”。
        /// multiplications to create "big integers" which represent larger values.
        ///
        /// If you also need to add a value, then use [`Self::carrying_mul_add`].
        ///
        /// # Examples
        ///
        /// Please note that this example is shared among integer types, which is why `u32` is used.
        ///
        /// ```
        /// assert_eq!(5u32.carrying_mul(2, 0), (10, 0));
        /// assert_eq!(5u32.carrying_mul(2, 10), (20, 0));
        /// assert_eq!(1_000_000_000u32.carrying_mul(10, 0), (1410065408, 2));
        /// assert_eq!(1_000_000_000u32.carrying_mul(10, 10), (1410065418, 2));
        #[doc = concat!("assert_eq!(",
            stringify!($SelfT), "::MAX.carrying_mul(", stringify!($SelfT), "::MAX, ", stringify!($SelfT), "::MAX), ",
            "(0, ", stringify!($SelfT), "::MAX));"
        )]
        /// ```
        ///
        /// 当为更宽类型实现时，这是标量乘法所需的核心操作。
        /// implementing it for wider-than-native types.
        ///
        /// ```
        /// fn scalar_mul_eq(little_endian_digits: &mut Vec<u16>, multiplicand: u16) {
        ///     let mut carry = 0;
        ///     for d in little_endian_digits.iter_mut() {
        ///         (*d, carry) = d.carrying_mul(multiplicand, carry);
        ///     }
        ///     if carry != 0 {
        ///         little_endian_digits.push(carry);
        ///     }
        /// }
        ///
        /// let mut v = vec![10, 20];
        /// scalar_mul_eq(&mut v, 3);
        /// assert_eq!(v, [30, 60]);
        ///
        /// assert_eq!(0x87654321_u64 * 0xFEED, 0x86D3D159E38D);
        /// let mut v = vec![0x4321, 0x8765];
        /// scalar_mul_eq(&mut v, 0xFEED);
        /// assert_eq!(v, [0xE38D, 0xD159, 0x86D3]);
        /// ```
        ///
        /// If `carry` is zero, this is similar to [`overflowing_mul`](Self::overflowing_mul),
        /// except that it gives the value of the overflow instead of just whether one happened:
        ///
        /// ```
        /// # #![allow(unused_features)]
        /// #![feature(const_unsigned_bigint_helpers)]
        /// let r = u8::carrying_mul(7, 13, 0);
        /// assert_eq!((r.0, r.1 != 0), u8::overflowing_mul(7, 13));
        /// let r = u8::carrying_mul(13, 42, 0);
        /// assert_eq!((r.0, r.1 != 0), u8::overflowing_mul(13, 42));
        /// ```
        ///
        /// The value of the first field in the returned tuple matches what you'd get
        /// by combining the [`wrapping_mul`](Self::wrapping_mul) and
        /// [`wrapping_add`](Self::wrapping_add) methods:
        ///
        /// ```
        /// # #![allow(unused_features)]
        /// #![feature(const_unsigned_bigint_helpers)]
        /// assert_eq!(
        ///     789_u16.carrying_mul(456, 123).0,
        ///     789_u16.wrapping_mul(456).wrapping_add(123),
        /// );
        /// ```
        #[stable(feature = "unsigned_bigint_helpers", since = "1.91.0")]
        #[rustc_const_unstable(feature = "const_unsigned_bigint_helpers", issue = "152015")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        pub const fn carrying_mul(self, rhs: Self, carry: Self) -> (Self, Self) {
            Self::carrying_mul_add(self, rhs, carry, 0)
        }

        /// Calculates the "full multiplication" `self * rhs + carry + add`.
        ///
        /// 它返回结果的低阶（包装）位和高阶（溢出）位
        /// 作为两个独立的值，按此顺序给出。
        ///
        /// 由于双宽度结果有足够的空间
        /// 容纳最大可能的结果，因此不会发生溢出。这相当于在
        /// 十进制中，9 × 9 + 9 + 9 = 81 + 18 = 99 = 9×10⁰ + 9×10¹ = 10² - 1。
        ///
        /// 执行“长乘法”，该方法需要额外添加的数值，并可能返回额外的溢出量。
        /// 额外的溢出量。这允许将多个操作链接在一起。
        /// 进行乘法以生成表示更大值的“大整数”。
        ///
        /// If you don't need the `add` part, then you can use [`Self::carrying_mul`] instead.
        ///
        /// # 示例
        ///
        /// 请注意，此示例是在整数类型之间共享的，
        /// which explains why `u32` is used here.
        ///
        /// ```
        /// assert_eq!(5u32.carrying_mul_add(2, 0, 0), (10, 0));
        /// assert_eq!(5u32.carrying_mul_add(2, 10, 10), (30, 0));
        /// assert_eq!(1_000_000_000u32.carrying_mul_add(10, 0, 0), (1410065408, 2));
        /// assert_eq!(1_000_000_000u32.carrying_mul_add(10, 10, 10), (1410065428, 2));
        #[doc = concat!("assert_eq!(",
            stringify!($SelfT), "::MAX.carrying_mul_add(", stringify!($SelfT), "::MAX, ", stringify!($SelfT), "::MAX, ", stringify!($SelfT), "::MAX), ",
            "(", stringify!($SelfT), "::MAX, ", stringify!($SelfT), "::MAX));"
        )]
        /// ```
        ///
        /// 这是“小学水平” O(n²) 乘法的核心逐位操作。
        ///
        /// 请注意，此示例是在整数类型之间共享的，
        /// using `u8` for simplicity of the demonstration.
        ///
        /// ```
        /// fn quadratic_mul<const N: usize>(a: [u8; N], b: [u8; N]) -> [u8; N] {
        ///     let mut out = [0; N];
        ///     for j in 0..N {
        ///         let mut carry = 0;
        ///         for i in 0..(N - j) {
        ///             (out[j + i], carry) = u8::carrying_mul_add(a[i], b[j], out[j + i], carry);
        ///         }
        ///     }
        ///     out
        /// }
        ///
        /// // -1 * -1 == 1
        /// assert_eq!(quadratic_mul([0xFF; 3], [0xFF; 3]), [1, 0, 0]);
        ///
        /// assert_eq!(u32::wrapping_mul(0x9e3779b9, 0x7f4a7c15), 0xcffc982d);
        /// assert_eq!(
        ///     quadratic_mul(u32::to_le_bytes(0x9e3779b9), u32::to_le_bytes(0x7f4a7c15)),
        ///     u32::to_le_bytes(0xcffc982d)
        /// );
        /// ```
        #[stable(feature = "unsigned_bigint_helpers", since = "1.91.0")]
        #[rustc_const_unstable(feature = "const_unsigned_bigint_helpers", issue = "152015")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        pub const fn carrying_mul_add(self, rhs: Self, carry: Self, add: Self) -> (Self, Self) {
            intrinsics::carrying_mul_add(self, rhs, carry, add)
        }

        /// Calculates the divisor when `self` is divided by `rhs`.
        ///
        /// 返回一个包含除数的元组以及一个布尔值，指示
        /// 是否会发生算术溢出。注意，对于无符号整数，
        /// 溢出永远不会发生，因此第二个值总是
        /// `false`.
        ///
        /// # 恐慌
        ///
        /// This function will panic if `rhs` is zero.
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(5", stringify!($SelfT), ".overflowing_div(2), (2, false));")]
        /// ```
        #[inline(always)]
        #[stable(feature = "wrapping", since = "1.7.0")]
        #[rustc_const_stable(feature = "const_overflowing_int_methods", since = "1.52.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[track_caller]
        pub const fn overflowing_div(self, rhs: Self) -> (Self, bool) {
            (self / rhs, false)
        }

        /// Calculates the quotient of Euclidean division `self.div_euclid(rhs)`.
        ///
        /// 返回一个包含除数的元组以及一个布尔值，指示
        /// 是否会发生算术溢出。注意，对于无符号整数，
        /// 溢出永远不会发生，因此第二个值总是
        /// `false`.
        /// 由于对于正整数，所有常见的
        /// 除法定义都是相同的，此操作
        /// is exactly equal to `self.overflowing_div(rhs)`.
        ///
        /// # 恐慌
        ///
        /// This function will panic if `rhs` is zero.
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(5", stringify!($SelfT), ".overflowing_div_euclid(2), (2, false));")]
        /// ```
        #[inline(always)]
        #[stable(feature = "euclidean_division", since = "1.38.0")]
        #[rustc_const_stable(feature = "const_euclidean_int_methods", since = "1.52.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[track_caller]
        pub const fn overflowing_div_euclid(self, rhs: Self) -> (Self, bool) {
            (self / rhs, false)
        }

        /// Calculates the remainder when `self` is divided by `rhs`.
        ///
        /// 返回一个包含除法后的余数的元组以及一个布尔值，
        /// 指示是否会发生算术溢出。注意，对于无符号整数，
        /// 溢出永远不会发生，因此第二个值总是
        /// always `false`.
        ///
        /// # 恐慌
        ///
        /// This function will panic if `rhs` is zero.
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(5", stringify!($SelfT), ".overflowing_rem(2), (1, false));")]
        /// ```
        #[inline(always)]
        #[stable(feature = "wrapping", since = "1.7.0")]
        #[rustc_const_stable(feature = "const_overflowing_int_methods", since = "1.52.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[track_caller]
        pub const fn overflowing_rem(self, rhs: Self) -> (Self, bool) {
            (self % rhs, false)
        }

        /// Calculates the remainder `self.rem_euclid(rhs)` as if by Euclidean division.
        ///
        /// 返回一个包含取模后的余数的元组以及一个布尔值，
        /// 指示是否会发生算术溢出。注意，对于无符号整数，
        /// 溢出永远不会发生，因此第二个值总是
        /// always `false`.
        /// 由于对于正整数，所有常见的
        /// 除法定义都是相同的，此操作
        /// is exactly equal to `self.overflowing_rem(rhs)`.
        ///
        /// # 恐慌
        ///
        /// This function will panic if `rhs` is zero.
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(5", stringify!($SelfT), ".overflowing_rem_euclid(2), (1, false));")]
        /// ```
        #[inline(always)]
        #[stable(feature = "euclidean_division", since = "1.38.0")]
        #[rustc_const_stable(feature = "const_euclidean_int_methods", since = "1.52.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[track_caller]
        pub const fn overflowing_rem_euclid(self, rhs: Self) -> (Self, bool) {
            (self % rhs, false)
        }

        /// 以溢出方式否定自身。
        ///
        /// Returns `!self + 1` using wrapping operations to return the value
        /// 表示此无符号值的否定。注意，对于
        /// 正值无符号数值总是会发生溢出，但将 0 取反则不会。
        /// 不会发生溢出。
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(0", stringify!($SelfT), ".overflowing_neg(), (0, false));")]
        #[doc = concat!("assert_eq!(2", stringify!($SelfT), ".overflowing_neg(), (-2i32 as ", stringify!($SelfT), ", true));")]
        /// ```
        #[inline(always)]
        #[stable(feature = "wrapping", since = "1.7.0")]
        #[rustc_const_stable(feature = "const_wrapping_math", since = "1.32.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        pub const fn overflowing_neg(self) -> (Self, bool) {
            ((!self).wrapping_add(1), self != 0)
        }

        /// Shifts self left by `rhs` bits.
        ///
        /// 返回一个元组，包含移动后的 self 值以及一个布尔值
        /// 指示移动值是否大于或等于
        /// 位数。如果移动值过大，则该值将被
        /// 掩码为 (N-1)，其中 N 是位数，然后该值被用于执行移动操作。
        /// # 示例
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(0x1", stringify!($SelfT), ".overflowing_shl(4), (0x10, false));")]
        #[doc = concat!("assert_eq!(0x1", stringify!($SelfT), ".overflowing_shl(132), (0x10, true));")]
        #[doc = concat!("assert_eq!(0x10", stringify!($SelfT), ".overflowing_shl(", stringify!($BITS_MINUS_ONE), "), (0, false));")]
        /// ```
        #[stable(feature = "wrapping", since = "1.7.0")]
        #[rustc_const_stable(feature = "const_wrapping_math", since = "1.32.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline(always)]
        pub const fn overflowing_shl(self, rhs: u32) -> (Self, bool) {
            (self.wrapping_shl(rhs), rhs >= Self::BITS)
        }

        /// Shifts self right by `rhs` bits.
        ///
        /// 返回一个元组，包含移动后的 self 值以及一个布尔值
        /// 指示移动值是否大于或等于
        /// 位数。如果移动值过大，则该值将被
        /// 掩码为 (N-1)，其中 N 是位数，然后该值被用于执行移动操作。
        /// # 示例
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(0x10", stringify!($SelfT), ".overflowing_shr(4), (0x1, false));")]
        #[doc = concat!("assert_eq!(0x10", stringify!($SelfT), ".overflowing_shr(132), (0x1, true));")]
        /// ```
        #[stable(feature = "wrapping", since = "1.7.0")]
        #[rustc_const_stable(feature = "const_wrapping_math", since = "1.32.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline(always)]
        pub const fn overflowing_shr(self, rhs: u32) -> (Self, bool) {
            (self.wrapping_shr(rhs), rhs >= Self::BITS)
        }

        /// Raises self to the power of `exp`, using exponentiation by squaring.
        ///
        /// 返回一个元组，包含幂运算结果以及一个布尔值指示
        /// 是否发生了溢出。
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(3", stringify!($SelfT), ".overflowing_pow(5), (243, false));")]
        #[doc = concat!("assert_eq!(0_", stringify!($SelfT), ".overflowing_pow(0), (1, false));")]
        /// assert_eq!(3u8.overflowing_pow(6), (217, true));
        /// ```
        #[stable(feature = "no_panic_pow", since = "1.34.0")]
        #[rustc_const_stable(feature = "const_int_pow", since = "1.50.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        pub const fn overflowing_pow(self, mut exp: u32) -> (Self, bool) {
            let mut base = self;
            let mut acc: Self = 1;
            let mut overflow = false;
            let mut tmp_overflow;

            if intrinsics::is_val_statically_known(base) && base.is_power_of_two() {
                // change of base:
                // if base == 2 ** k, then
                //    (2 ** k) ** n
                // == 2 ** (k * n)
                // == 1 << (k * n)
                let k = base.ilog2();
                let Some(shift) = k.checked_mul(exp) else {
                    return (0, true)
                };
                return ((1 as Self).unbounded_shl(shift), shift >= Self::BITS)
            }

            if exp == 0 {
                return (1, false);
            }

            if intrinsics::is_val_statically_known(exp) {
                while exp > 1 {
                    if (exp & 1) == 1 {
                        (acc, tmp_overflow) = acc.overflowing_mul(base);
                        overflow |= tmp_overflow;
                    }
                    exp /= 2;
                    (base, tmp_overflow) = base.overflowing_mul(base);
                    overflow |= tmp_overflow;
                }

                // since exp!=0, finally the exp must be 1.
                // Deal with the final bit of the exponent separately, since
                // squaring the base afterwards is not necessary and may cause a
                // needless overflow.
                (acc, tmp_overflow) = acc.overflowing_mul(base);
                overflow |= tmp_overflow;
                return (acc, overflow);
            }

            loop {
                if (exp & 1) == 1 {
                    (acc, tmp_overflow) = acc.overflowing_mul(base);
                    overflow |= tmp_overflow;
                    // since exp!=0, finally the exp must be 1.
                    if exp == 1 {
                        return (acc, overflow);
                    }
                }
                exp /= 2;
                (base, tmp_overflow) = base.overflowing_mul(base);
                overflow |= tmp_overflow;
            }
        }

        /// Raises self to the power of `exp`, using exponentiation by squaring.
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(2", stringify!($SelfT), ".pow(5), 32);")]
        #[doc = concat!("assert_eq!(0_", stringify!($SelfT), ".pow(0), 1);")]
        /// ```
        #[stable(feature = "rust1", since = "1.0.0")]
        #[rustc_const_stable(feature = "const_int_pow", since = "1.50.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        #[rustc_inherit_overflow_checks]
        pub const fn pow(self, exp: u32) -> Self {
            if intrinsics::overflow_checks() {
                self.strict_pow(exp)
            } else {
                self.wrapping_pow(exp)
            }
        }

        /// 返回该数的平方根，向下取整。
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(10", stringify!($SelfT), ".isqrt(), 3);")]
        /// ```
        #[stable(feature = "isqrt", since = "1.84.0")]
        #[rustc_const_stable(feature = "isqrt", since = "1.84.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        pub const fn isqrt(self) -> Self {
            let result = imp::int_sqrt::$ActualT(self as $ActualT) as Self;

            // Inform the optimizer what the range of outputs is. If testing
            // `core` crashes with no panic message and a `num::int_sqrt::u*`
            // test failed, it's because your edits caused these assertions or
            // the assertions in `fn isqrt` of `nonzero.rs` to become false.
            //
            // SAFETY: Integer square root is a monotonically nondecreasing
            // function, which means that increasing the input will never
            // cause the output to decrease. Thus, since the input for unsigned
            // integers is bounded by `[0, <$ActualT>::MAX]`, sqrt(n) will be
            // bounded by `[sqrt(0), sqrt(<$ActualT>::MAX)]` and bounding the
            // input by `[1, <$ActualT>::MAX]` bounds sqrt(n) by
            // `[sqrt(1), sqrt(<$ActualT>::MAX)]`.
            unsafe {
                const MAX_RESULT: $SelfT = imp::int_sqrt::$ActualT(<$ActualT>::MAX) as $SelfT;
                crate::hint::assert_unchecked(result <= MAX_RESULT)
            }

            if self >= 1 {
                // SAFETY: The above statements about monotonicity also apply here.
                // Since the input in this branch is bounded by `[1, <$ActualT>::MAX]`,
                // sqrt(n) is bounded by `[sqrt(1), sqrt(<$ActualT>::MAX)]`, and
                // `sqrt(1) == 1`.
                unsafe { crate::hint::assert_unchecked(result >= 1) }
            }

            // SAFETY: the isqrt implementation returns the square root and rounds down,
            // meaning `result * result <= self`. This implies `result <= self`.
            // The compiler needs both to optimize for both.
            // `result * result <= self` implies the multiplication will not overflow.
            unsafe {
                crate::hint::assert_unchecked(result.unchecked_mul(result) <= self);
                crate::hint::assert_unchecked(result <= self);
            }

            result
        }

        /// 执行欧几里得除法。
        ///
        /// 由于正整数的所有常见
        /// 除法定义都是相同的，因此
        /// is exactly equal to `self / rhs`.
        ///
        /// # 恐慌
        ///
        /// This function will panic if `rhs` is zero.
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(7", stringify!($SelfT), ".div_euclid(4), 1); // or any other integer type")]
        /// ```
        #[stable(feature = "euclidean_division", since = "1.38.0")]
        #[rustc_const_stable(feature = "const_euclidean_int_methods", since = "1.52.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline(always)]
        #[track_caller]
        pub const fn div_euclid(self, rhs: Self) -> Self {
            self / rhs
        }

        /// Calculates the least remainder of `self` when divided by
        /// `rhs`.
        ///
        /// 由于正整数的所有常见
        /// 除法定义都是相同的，因此
        /// is exactly equal to `self % rhs`.
        ///
        /// # 恐慌
        ///
        /// This function will panic if `rhs` is zero.
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(7", stringify!($SelfT), ".rem_euclid(4), 3); // or any other integer type")]
        /// ```
        #[doc(alias = "modulo", alias = "mod")]
        #[stable(feature = "euclidean_division", since = "1.38.0")]
        #[rustc_const_stable(feature = "const_euclidean_int_methods", since = "1.52.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline(always)]
        #[track_caller]
        pub const fn rem_euclid(self, rhs: Self) -> Self {
            self % rhs
        }

        /// Calculates the quotient of `self` and `rhs`, rounding the result towards negative infinity.
        ///
        /// This is the same as performing `self / rhs` for all unsigned integers.
        ///
        /// # 恐慌
        ///
        /// This function will panic if `rhs` is zero.
        ///
        /// # 示例
        ///
        /// ```
        /// #![feature(int_roundings)]
        #[doc = concat!("assert_eq!(7_", stringify!($SelfT), ".div_floor(4), 1);")]
        /// ```
        #[unstable(feature = "int_roundings", issue = "88581")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline(always)]
        #[track_caller]
        pub const fn div_floor(self, rhs: Self) -> Self {
            self / rhs
        }

        /// Calculates the quotient of `self` and `rhs`, rounding the result towards positive infinity.
        ///
        /// # 恐慌
        ///
        /// This function will panic if `rhs` is zero.
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(7_", stringify!($SelfT), ".div_ceil(4), 2);")]
        /// ```
        #[stable(feature = "int_roundings1", since = "1.73.0")]
        #[rustc_const_stable(feature = "int_roundings1", since = "1.73.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        #[track_caller]
        pub const fn div_ceil(self, rhs: Self) -> Self {
            let d = self / rhs;
            let r = self % rhs;
            if r > 0 {
                d + 1
            } else {
                d
            }
        }

        /// Calculates the smallest value greater than or equal to `self` that
        /// is a multiple of `rhs`.
        ///
        /// # Panics
        ///
        /// This function will panic if `rhs` is zero.
        ///
        /// ## 溢出行为
        ///
        /// 在启用溢出检查时（调试模式下默认），此函数会在溢出时触发恐慌；在禁用溢出检查时（发布模式下默认），则进行环绕处理。
        /// mode) and wrap if overflow checks are disabled (default in release mode).
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(16_", stringify!($SelfT), ".next_multiple_of(8), 16);")]
        #[doc = concat!("assert_eq!(23_", stringify!($SelfT), ".next_multiple_of(8), 24);")]
        /// ```
        #[stable(feature = "int_roundings1", since = "1.73.0")]
        #[rustc_const_stable(feature = "int_roundings1", since = "1.73.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        #[rustc_inherit_overflow_checks]
        pub const fn next_multiple_of(self, rhs: Self) -> Self {
            match self % rhs {
                0 => self,
                r => self + (rhs - r)
            }
        }

        /// Calculates the smallest value greater than or equal to `self` that
        /// is a multiple of `rhs`. Returns `None` if `rhs` is zero or the
        /// operation would result in overflow.
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(16_", stringify!($SelfT), ".checked_next_multiple_of(8), Some(16));")]
        #[doc = concat!("assert_eq!(23_", stringify!($SelfT), ".checked_next_multiple_of(8), Some(24));")]
        #[doc = concat!("assert_eq!(1_", stringify!($SelfT), ".checked_next_multiple_of(0), None);")]
        #[doc = concat!("assert_eq!(", stringify!($SelfT), "::MAX.checked_next_multiple_of(2), None);")]
        /// ```
        #[stable(feature = "int_roundings1", since = "1.73.0")]
        #[rustc_const_stable(feature = "int_roundings1", since = "1.73.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        pub const fn checked_next_multiple_of(self, rhs: Self) -> Option<Self> {
            match try_opt!(self.checked_rem(rhs)) {
                0 => Some(self),
                // rhs - r cannot overflow because r is smaller than rhs
                r => self.checked_add(rhs - r)
            }
        }

        /// Returns `true` if `self` is an integer multiple of `rhs`, and false otherwise.
        ///
        /// This function is equivalent to `self % rhs == 0`, except that it will not panic
        /// for `rhs == 0`. Instead, `0.is_multiple_of(0) == true`, and for any non-zero `n`,
        /// `n.is_multiple_of(0) == false`.
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert!(6_", stringify!($SelfT), ".is_multiple_of(2));")]
        #[doc = concat!("assert!(!5_", stringify!($SelfT), ".is_multiple_of(2));")]
        ///
        #[doc = concat!("assert!(0_", stringify!($SelfT), ".is_multiple_of(0));")]
        #[doc = concat!("assert!(!6_", stringify!($SelfT), ".is_multiple_of(0));")]
        /// ```
        #[stable(feature = "unsigned_is_multiple_of", since = "1.87.0")]
        #[rustc_const_stable(feature = "unsigned_is_multiple_of", since = "1.87.0")]
        #[must_use]
        #[inline]
        pub const fn is_multiple_of(self, rhs: Self) -> bool {
            match rhs {
                0 => self == 0,
                _ => self % rhs == 0,
            }
        }

        /// Returns `true` if and only if `self == 2^k` for some unsigned integer `k`.
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert!(16", stringify!($SelfT), ".is_power_of_two());")]
        #[doc = concat!("assert!(!10", stringify!($SelfT), ".is_power_of_two());")]
        /// ```
        #[must_use]
        #[stable(feature = "rust1", since = "1.0.0")]
        #[rustc_const_stable(feature = "const_is_power_of_two", since = "1.32.0")]
        #[inline(always)]
        pub const fn is_power_of_two(self) -> bool {
            self.count_ones() == 1
        }

        /// Returns the smallest power of two greater than or equal to `self`.
        ///
        /// When return value overflows (i.e., `self > (1 << (N-1))` for type
        /// `uN`), it panics in debug mode and the return value is wrapped to 0 in
        /// （这是该方法可以返回0的唯一情况）。
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(2", stringify!($SelfT), ".next_power_of_two(), 2);")]
        #[doc = concat!("assert_eq!(3", stringify!($SelfT), ".next_power_of_two(), 4);")]
        #[doc = concat!("assert_eq!(0", stringify!($SelfT), ".next_power_of_two(), 1);")]
        /// ```
        #[stable(feature = "rust1", since = "1.0.0")]
        #[rustc_const_stable(feature = "const_int_pow", since = "1.50.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        #[rustc_inherit_overflow_checks]
        pub const fn next_power_of_two(self) -> Self {
            if let Some(npot) = self.checked_next_power_of_two() {
                npot
            } else {
                #[expect(arithmetic_overflow)]
                {
                    // Zero but in a way that panics in debug
                    Self::MAX + 1
                }
            }
        }

        /// Returns the smallest power of two greater than or equal to `self`. If
        /// 下一个2的幂大于类型的最大值，
        /// `None` is returned, otherwise the power of two is wrapped in `Some`.
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("assert_eq!(2", stringify!($SelfT), ".checked_next_power_of_two(), Some(2));")]
        #[doc = concat!("assert_eq!(3", stringify!($SelfT), ".checked_next_power_of_two(), Some(4));")]
        #[doc = concat!("assert_eq!(", stringify!($SelfT), "::MAX.checked_next_power_of_two(), None);")]
        /// ```
        #[inline]
        #[stable(feature = "rust1", since = "1.0.0")]
        #[rustc_const_stable(feature = "const_int_pow", since = "1.50.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        pub const fn checked_next_power_of_two(self) -> Option<Self> {
            let m1 = self.saturating_sub(1);
            if m1.cast_signed() >= 0 {
                let exp = m1.bit_width();
                Some(1 << exp)
            } else {
                None
            }
        }

        /// Returns the smallest power of two greater than or equal to `n`. If
        /// 下一个2的幂大于类型的最大值，
        /// the return value is wrapped to `0`.
        ///
        /// # 示例
        ///
        /// ```
        /// #![feature(wrapping_next_power_of_two)]
        ///
        #[doc = concat!("assert_eq!(2", stringify!($SelfT), ".wrapping_next_power_of_two(), 2);")]
        #[doc = concat!("assert_eq!(3", stringify!($SelfT), ".wrapping_next_power_of_two(), 4);")]
        #[doc = concat!("assert_eq!(", stringify!($SelfT), "::MAX.wrapping_next_power_of_two(), 0);")]
        /// ```
        #[inline]
        #[unstable(feature = "wrapping_next_power_of_two", issue = "32463",
                   reason = "needs decision on wrapping behavior")]
        #[rustc_const_unstable(feature = "wrapping_next_power_of_two", issue = "32463")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        pub const fn wrapping_next_power_of_two(self) -> Self {
            self.checked_next_power_of_two().unwrap_or(0)
        }

        /// 以字节数组形式返回此整数的内存表示，采用
        /// 大端（网络）字节序。
        ///
        #[doc = $to_xe_bytes_doc]
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("let bytes = ", $swap_op, stringify!($SelfT), ".to_be_bytes();")]
        #[doc = concat!("assert_eq!(bytes, ", $be_bytes, ");")]
        /// ```
        #[stable(feature = "int_to_from_bytes", since = "1.32.0")]
        #[rustc_const_stable(feature = "const_int_conversion", since = "1.44.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        pub const fn to_be_bytes(self) -> [u8; size_of::<Self>()] {
            self.to_be().to_ne_bytes()
        }

        /// 以字节数组形式返回此整数的内存表示，采用
        /// 小端字节序。
        ///
        #[doc = $to_xe_bytes_doc]
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("let bytes = ", $swap_op, stringify!($SelfT), ".to_le_bytes();")]
        #[doc = concat!("assert_eq!(bytes, ", $le_bytes, ");")]
        /// ```
        #[stable(feature = "int_to_from_bytes", since = "1.32.0")]
        #[rustc_const_stable(feature = "const_int_conversion", since = "1.44.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[inline]
        pub const fn to_le_bytes(self) -> [u8; size_of::<Self>()] {
            self.to_le().to_ne_bytes()
        }

        /// 以字节数组形式返回此整数的内存表示，采用
        /// 本地字节序。
        ///
        /// 由于使用目标平台的本地字节序，可移植代码
        /// should use [`to_be_bytes`] or [`to_le_bytes`], as appropriate,
        /// 而不是其他方法。
        ///
        #[doc = $to_xe_bytes_doc]
        ///
        /// [`to_be_bytes`]: Self::to_be_bytes
        /// [`to_le_bytes`]: Self::to_le_bytes
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("let bytes = ", $swap_op, stringify!($SelfT), ".to_ne_bytes();")]
        /// assert_eq!(
        ///     bytes,
        ///     if cfg!(target_endian = "big") {
        #[doc = concat!("        ", $be_bytes)]
        ///     } else {
        #[doc = concat!("        ", $le_bytes)]
        ///     }
        /// );
        /// ```
        #[stable(feature = "int_to_from_bytes", since = "1.32.0")]
        #[rustc_const_stable(feature = "const_int_conversion", since = "1.44.0")]
        #[must_use = "this returns the result of the operation, \
                      without modifying the original"]
        #[allow(unnecessary_transmutes)]
        // SAFETY: const sound because integers are plain old datatypes so we can always
        // transmute them to arrays of bytes
        #[inline]
        pub const fn to_ne_bytes(self) -> [u8; size_of::<Self>()] {
            // SAFETY: integers are plain old datatypes so we can always transmute them to
            // arrays of bytes
            unsafe { mem::transmute(self) }
        }

        /// 从其表示中创建本地字节序的整数值，以大端字节序的字节数组形式。
        /// 呈现。
        ///
        #[doc = $from_xe_bytes_doc]
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("let value = ", stringify!($SelfT), "::from_be_bytes(", $be_bytes, ");")]
        #[doc = concat!("assert_eq!(value, ", $swap_op, ");")]
        /// ```
        ///
        /// 当从切片而非数组开始时，可以使用有缺陷的转换API：
        ///
        /// ```
        #[doc = concat!("fn read_be_", stringify!($SelfT), "(input: &mut &[u8]) -> ", stringify!($SelfT), " {")]
        #[doc = concat!("    let (int_bytes, rest) = input.split_at(size_of::<", stringify!($SelfT), ">());")]
        ///     *input = rest;
        #[doc = concat!("    ", stringify!($SelfT), "::from_be_bytes(int_bytes.try_into().unwrap())")]
        /// }
        /// ```
        #[stable(feature = "int_to_from_bytes", since = "1.32.0")]
        #[rustc_const_stable(feature = "const_int_conversion", since = "1.44.0")]
        #[must_use]
        #[inline]
        pub const fn from_be_bytes(bytes: [u8; size_of::<Self>()]) -> Self {
            Self::from_be(Self::from_ne_bytes(bytes))
        }

        /// 从其表示中创建本地字节序的整数值，以小端字节序的字节数组形式。
        /// 呈现。
        ///
        #[doc = $from_xe_bytes_doc]
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("let value = ", stringify!($SelfT), "::from_le_bytes(", $le_bytes, ");")]
        #[doc = concat!("assert_eq!(value, ", $swap_op, ");")]
        /// ```
        ///
        /// 当从切片而非数组开始时，可以使用有缺陷的转换API：
        ///
        /// ```
        #[doc = concat!("fn read_le_", stringify!($SelfT), "(input: &mut &[u8]) -> ", stringify!($SelfT), " {")]
        #[doc = concat!("    let (int_bytes, rest) = input.split_at(size_of::<", stringify!($SelfT), ">());")]
        ///     *input = rest;
        #[doc = concat!("    ", stringify!($SelfT), "::from_le_bytes(int_bytes.try_into().unwrap())")]
        /// }
        /// ```
        #[stable(feature = "int_to_from_bytes", since = "1.32.0")]
        #[rustc_const_stable(feature = "const_int_conversion", since = "1.44.0")]
        #[must_use]
        #[inline]
        pub const fn from_le_bytes(bytes: [u8; size_of::<Self>()]) -> Self {
            Self::from_le(Self::from_ne_bytes(bytes))
        }

        /// 从其内存表示中创建本地字节序的整数值，以本地字节序的字节数组形式。
        /// 呈现。
        ///
        /// 由于使用目标平台的本地字节序，可移植代码
        /// likely wants to use [`from_be_bytes`] or [`from_le_bytes`], as
        /// 改用适当的选项。
        ///
        /// [`from_be_bytes`]: Self::from_be_bytes
        /// [`from_le_bytes`]: Self::from_le_bytes
        ///
        #[doc = $from_xe_bytes_doc]
        ///
        /// # 示例
        ///
        /// ```
        #[doc = concat!("let value = ", stringify!($SelfT), "::from_ne_bytes(if cfg!(target_endian = \"big\") {")]
        #[doc = concat!("    ", $be_bytes, "")]
        /// } else {
        #[doc = concat!("    ", $le_bytes, "")]
        /// });
        #[doc = concat!("assert_eq!(value, ", $swap_op, ");")]
        /// ```
        ///
        /// 当从切片而非数组开始时，可以使用有错误的转换 API：
        ///
        /// ```
        #[doc = concat!("fn read_ne_", stringify!($SelfT), "(input: &mut &[u8]) -> ", stringify!($SelfT), " {")]
        #[doc = concat!("    let (int_bytes, rest) = input.split_at(size_of::<", stringify!($SelfT), ">());")]
        ///     *input = rest;
        #[doc = concat!("    ", stringify!($SelfT), "::from_ne_bytes(int_bytes.try_into().unwrap())")]
        /// }
        /// ```
        #[stable(feature = "int_to_from_bytes", since = "1.32.0")]
        #[rustc_const_stable(feature = "const_int_conversion", since = "1.44.0")]
        #[allow(unnecessary_transmutes)]
        #[must_use]
        // SAFETY: const sound because integers are plain old datatypes so we can always
        // transmute to them
        #[inline]
        pub const fn from_ne_bytes(bytes: [u8; size_of::<Self>()]) -> Self {
            // SAFETY: integers are plain old datatypes so we can always transmute to them
            unsafe { mem::transmute(bytes) }
        }

        /// 新代码应优先使用
        #[doc = concat!("[`", stringify!($SelfT), "::MIN", "`] instead.")]
        ///
        /// 返回该整数类型能表示的最小值。
        #[stable(feature = "rust1", since = "1.0.0")]
        #[rustc_promotable]
        #[inline(always)]
        #[rustc_const_stable(feature = "const_max_value", since = "1.32.0")]
        #[deprecated(since = "1.99.0", note = "replaced by the `MIN` associated constant on this type")]
        #[rustc_diagnostic_item = concat!(stringify!($SelfT), "_legacy_fn_min_value")]
        pub const fn min_value() -> Self { Self::MIN }

        /// 新代码应优先使用
        #[doc = concat!("[`", stringify!($SelfT), "::MAX", "`] instead.")]
        ///
        /// 返回该整数类型能表示的最大值。
        #[stable(feature = "rust1", since = "1.0.0")]
        #[rustc_promotable]
        #[inline(always)]
        #[rustc_const_stable(feature = "const_max_value", since = "1.32.0")]
        #[deprecated(since = "1.99.0", note = "replaced by the `MAX` associated constant on this type")]
        #[rustc_diagnostic_item = concat!(stringify!($SelfT), "_legacy_fn_max_value")]
        pub const fn max_value() -> Self { Self::MAX }

        /// 将整数截断为相同大小或更小的大小，保留最
        /// 重要的位。
        ///
        /// # 示例
        ///
        /// ```
        /// #![feature(integer_widen_truncate)]
        #[doc = concat!("assert_eq!(120u8, 120", stringify!($SelfT), ".truncate());")]
        /// assert_eq!(120u8, 376u32.truncate());
        /// ```
        #[must_use = "this returns the truncated value and does not modify the original"]
        #[unstable(feature = "integer_widen_truncate", issue = "154330")]
        #[rustc_const_unstable(feature = "integer_widen_truncate", issue = "154330")]
        #[inline]
        pub const fn truncate<Target>(self) -> Target
            where Self: [const] traits::TruncateTarget<Target>
        {
            traits::TruncateTarget::internal_truncate(self)
        }

        /// 将整数截断为相同大小或更小的大小，在数值边界处饱和。
        /// 而不是直接截断。
        ///
        /// # 示例
        ///
        /// ```
        /// #![feature(integer_widen_truncate)]
        #[doc = concat!("assert_eq!(120u8, 120", stringify!($SelfT), ".saturating_truncate());")]
        /// assert_eq!(255u8, 376u32.saturating_truncate());
        /// ```
        #[must_use = "this returns the truncated value and does not modify the original"]
        #[unstable(feature = "integer_widen_truncate", issue = "154330")]
        #[rustc_const_unstable(feature = "integer_widen_truncate", issue = "154330")]
        #[inline]
        pub const fn saturating_truncate<Target>(self) -> Target
            where Self: [const] traits::TruncateTarget<Target>
        {
            traits::TruncateTarget::internal_saturating_truncate(self)
        }

        /// Truncate an integer to an integer of the same size or smaller, returning `None` if the value
        /// is outside the bounds of the smaller type.
        ///
        /// # 示例
        ///
        /// ```
        /// #![feature(integer_widen_truncate)]
        #[doc = concat!("assert_eq!(Some(120u8), 120", stringify!($SelfT), ".checked_truncate());")]
        /// assert_eq!(None, 376u32.checked_truncate::<u8>());
        /// ```
        #[must_use = "this returns the truncated value and does not modify the original"]
        #[unstable(feature = "integer_widen_truncate", issue = "154330")]
        #[rustc_const_unstable(feature = "integer_widen_truncate", issue = "154330")]
        #[inline]
        pub const fn checked_truncate<Target>(self) -> Option<Target>
            where Self: [const] traits::TruncateTarget<Target>
        {
            traits::TruncateTarget::internal_checked_truncate(self)
        }

        /// 扩大为相同大小或更大的整数，保留其值。
        ///
        /// # 示例
        ///
        /// ```
        /// #![feature(integer_widen_truncate)]
        #[doc = concat!("assert_eq!(120u128, 120u8.widen());")]
        /// ```
        #[must_use = "this returns the widened value and does not modify the original"]
        #[unstable(feature = "integer_widen_truncate", issue = "154330")]
        #[rustc_const_unstable(feature = "integer_widen_truncate", issue = "154330")]
        #[inline]
        pub const fn widen<Target>(self) -> Target
            where Self: [const] traits::WidenTarget<Target>
        {
            traits::WidenTarget::internal_widen(self)
        }

        /// Converts `self` to the target integer type, saturating at the numeric
        /// 而不是溢出。
        ///
        /// # 示例
        ///
        /// ```
        /// #![feature(integer_casts)]
        #[doc = concat!("assert_eq!(255u8, ", stringify!($SelfT), "::MAX.saturating_cast());")]
        #[doc = concat!("assert_eq!(127i8, ", stringify!($SelfT), "::MAX.saturating_cast());")]
        #[doc = concat!("assert_eq!(42i8, 42", stringify!($SelfT), ".saturating_cast());")]
        /// ```
        #[must_use = "this returns the cast result and does not modify the original"]
        #[unstable(feature = "integer_casts", issue = "157388")]
        #[rustc_const_unstable(feature = "integer_casts", issue = "157388")]
        #[inline(always)]
        pub const fn saturating_cast<T: [const] BoundedCastFromInt<Self>>(self) -> T {
            T::saturating_cast_from(self)
        }

        /// Converts `self` to the target integer type, wrapping around at the
        /// 环绕。
        ///
        /// # 示例
        ///
        /// ```
        /// #![feature(integer_casts)]
        #[doc = concat!("assert_eq!(255u8, ", stringify!($SelfT), "::MAX.wrapping_cast());")]
        #[doc = concat!("assert_eq!(42i8, 42", stringify!($SelfT), ".wrapping_cast());")]
        #[doc = concat!("assert_eq!(", stringify!($SelfT), "::MAX as i8, ", stringify!($SelfT), "::MAX.wrapping_cast());")]
        /// ```
        #[must_use = "this returns the cast result and does not modify the original"]
        #[unstable(feature = "integer_casts", issue = "157388")]
        #[rustc_const_unstable(feature = "integer_casts", issue = "157388")]
        #[inline(always)]
        pub const fn wrapping_cast<T: [const] BoundedCastFromInt<Self>>(self) -> T {
            T::wrapping_cast_from(self)
        }

        /// Converts `self` to the target integer type, returning `None` if the value
        /// is not representable by the target type.
        ///
        /// # 示例
        ///
        /// ```
        /// #![feature(integer_casts)]
        #[doc = concat!("assert_eq!(Some(42u8), 42", stringify!($SelfT), ".checked_cast());")]
        #[doc = concat!("assert_eq!(128", stringify!($SelfT), ".checked_cast::<i8>(), None);")]
        /// ```
        #[must_use = "this returns the cast result and does not modify the original"]
        #[unstable(feature = "integer_casts", issue = "157388")]
        #[rustc_const_unstable(feature = "integer_casts", issue = "157388")]
        #[inline(always)]
        pub const fn checked_cast<T: [const] CheckedCastFromInt<Self>>(self) -> Option<T> {
            T::checked_cast_from(self)
        }

        /// Converts `self` to the target integer type, panicking if the value
        /// 无法由目标类型表示，则引发 panic。
        ///
        /// # 引发 panic
        ///
        /// 如果值无法由目标类型表示，此函数会引发 panic。
        ///
        /// # 示例
        ///
        /// ```
        /// #![feature(integer_casts)]
        #[doc = concat!("assert_eq!(42u8, 42", stringify!($SelfT), ".strict_cast());")]
        /// ```
        ///
        /// 以下情况会引发 panic：
        ///
        /// ```should_panic
        /// #![feature(integer_casts)]
        #[doc = concat!("let _ = 128", stringify!($SelfT), ".strict_cast::<i8>();")]
        /// ```
        #[must_use = "this returns the cast result and does not modify the original"]
        #[unstable(feature = "integer_casts", issue = "157388")]
        #[rustc_const_unstable(feature = "integer_casts", issue = "157388")]
        #[inline(always)]
        #[track_caller]
        pub const fn strict_cast<T: [const] CheckedCastFromInt<Self>>(self) -> T {
            T::strict_cast_from(self)
        }

        /// Converts `self` to the target integer type, assuming the value is
        /// 可以被目标类型表示。
        ///
        /// # 安全性
        ///
        /// This results in undefined behavior if the integer value of `self` is bigger than `T::MAX`,
        /// or smaller than `T::MIN`, where `T` is the target type.
        #[must_use = "this returns the cast result and does not modify the original"]
        #[unstable(feature = "integer_casts", issue = "157388")]
        #[rustc_const_unstable(feature = "integer_casts", issue = "157388")]
        #[inline(always)]
        pub const unsafe fn unchecked_cast<T: [const] CheckedCastFromInt<Self>>(self) -> T {
            assert_unsafe_precondition!(
                check_language_ub,
                concat!(stringify!($SelfT), "::unchecked_cast must fit in the target type"),
                (
                    // Check has to be performed up-front because it depends on generic T.
                    in_bounds: bool = {
                        let cast_val = self.checked_cast::<T>();
                        let ret = cast_val.is_some();
                        core::mem::forget(cast_val); // We don't have const Drop, but we know it's an int.
                        ret
                    },
                ) => in_bounds,
            );

            // SAFETY: this is guaranteed to be safe by the caller.
            unsafe { T::unchecked_cast_from(self) }
        }
    }
}
