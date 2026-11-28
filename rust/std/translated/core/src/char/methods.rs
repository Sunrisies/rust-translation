//! impl char {}

#![expect(clippy::manual_is_ascii_check, reason = "this module implements various is_ascii checks")]

use super::*;
use crate::panic::const_panic;
use crate::slice;
use crate::str::from_utf8_unchecked_mut;
use crate::ub_checks::assert_unsafe_precondition;
use crate::unicode::{self, conversions};

impl char {
    /// The lowest valid code point a `char` can have, `'\0'`.
    ///
    /// Unlike integer types, `char` actually has a gap in the middle,
    /// meaning that the range of possible `char`s is smaller than you
    /// might expect. Ranges of `char` will automatically hop this gap
    /// 为你处理。
    ///
    /// ```
    /// let dist = u32::from(char::MAX) - u32::from(char::MIN);
    /// let size = (char::MIN..=char::MAX).count() as u32;
    /// assert!(size < dist);
    /// ```
    ///
    /// Despite this gap, the `MIN` and [`MAX`] values can be used as bounds for
    /// all `char` values.
    ///
    /// [`MAX`]: char::MAX
    ///
    /// # 示例
    ///
    /// ```
    /// # fn something_which_returns_char() -> char { 'a' }
    /// let c: char = something_which_returns_char();
    /// assert!(char::MIN <= c);
    ///
    /// let value_at_min = u32::from(char::MIN);
    /// assert_eq!(char::from_u32(value_at_min), Some('\0'));
    /// ```
    #[stable(feature = "char_min", since = "1.83.0")]
    pub const MIN: char = '\0';

    /// The highest valid code point a `char` can have, `'\u{10FFFF}'`.
    ///
    /// Unlike integer types, `char` actually has a gap in the middle,
    /// meaning that the range of possible `char`s is smaller than you
    /// might expect. Ranges of `char` will automatically hop this gap
    /// 为你处理。
    ///
    /// ```
    /// let dist = u32::from(char::MAX) - u32::from(char::MIN);
    /// let size = (char::MIN..=char::MAX).count() as u32;
    /// assert!(size < dist);
    /// ```
    ///
    /// Despite this gap, the [`MIN`] and `MAX` values can be used as bounds for
    /// all `char` values.
    ///
    /// [`MIN`]: char::MIN
    ///
    /// # 示例
    ///
    /// ```
    /// # fn something_which_returns_char() -> char { 'a' }
    /// let c: char = something_which_returns_char();
    /// assert!(c <= char::MAX);
    ///
    /// let value_at_max = u32::from(char::MAX);
    /// assert_eq!(char::from_u32(value_at_max), Some('\u{10FFFF}'));
    /// assert_eq!(char::from_u32(value_at_max + 1), None);
    /// ```
    #[stable(feature = "assoc_char_consts", since = "1.52.0")]
    pub const MAX: char = '\u{10FFFF}';

    /// The maximum number of bytes required to [encode](char::encode_utf8) a `char` to
    /// UTF-8 格式所需的最大字节数。
    #[stable(feature = "char_max_len_assoc", since = "1.93.0")]
    pub const MAX_LEN_UTF8: usize = 4;

    /// The maximum number of two-byte units required to [encode](char::encode_utf16) a `char`
    /// UTF-16 格式所需的最大两字节单位数。
    #[stable(feature = "char_max_len_assoc", since = "1.93.0")]
    pub const MAX_LEN_UTF16: usize = 2;

    /// `U+FFFD REPLACEMENT CHARACTER` (�) is used in Unicode to represent a
    /// 解码错误。
    ///
    /// 例如，当给出格式不正确的 UTF-8 字节时可能会发生这种情况。
    /// [`String::from_utf8_lossy`](../std/string/struct.String.html#method.from_utf8_lossy).
    #[stable(feature = "assoc_char_consts", since = "1.52.0")]
    pub const REPLACEMENT_CHARACTER: char = '\u{FFFD}';

    /// The version of [Unicode](https://www.unicode.org/) that the Unicode parts of
    /// `char` and `str` methods are based on.
    ///
    /// Unicode 会定期发布新版本，随后标准库中的所有依赖 Unicode 的方法也会更新。因此，
    /// in the standard library depending on Unicode are updated. Therefore, the
    /// behavior of some `char` and `str` methods, and the value of this constant,
    /// 这并不被视为破坏性变更。
    /// 这不被视为破坏性变更。
    ///
    /// [stability policies]: https://www.unicode.org/policies/stability_policy.html
    ///
    /// 版本编号方案在
    /// Unicode 标准中的 [第 3.1 节 (版本编号)] 中有说明。
    ///
    /// [Section 3.1 (Version Numbering)]: https://www.unicode.org/versions/latest/core-spec/chapter-3/#G49512
    #[stable(feature = "assoc_char_consts", since = "1.52.0")]
    pub const UNICODE_VERSION: (u8, u8, u8) = crate::unicode::UNICODE_VERSION;

    /// Creates an iterator over the native endian UTF-16 encoded code points in `iter`,
    /// returning unpaired surrogates as `Err`s.
    ///
    /// # 示例
    ///
    /// 基本用法：
    ///
    /// ```
    /// // 𝄞mus<invalid>ic<invalid>
    /// let v = [
    ///     0xD834, 0xDD1E, 0x006d, 0x0075, 0x0073, 0xDD1E, 0x0069, 0x0063, 0xD834,
    /// ];
    ///
    /// assert_eq!(
    ///     char::decode_utf16(v)
    ///         .map(|r| r.map_err(|e| e.unpaired_surrogate()))
    ///         .collect::<Vec<_>>(),
    ///     vec![
    ///         Ok('𝄞'),
    ///         Ok('m'), Ok('u'), Ok('s'),
    ///         Err(0xDD1E),
    ///         Ok('i'), Ok('c'),
    ///         Err(0xD834)
    ///     ]
    /// );
    /// ```
    ///
    /// A lossy decoder can be obtained by replacing `Err` results with the replacement character:
    ///
    /// ```
    /// // 𝄞mus<invalid>ic<invalid>
    /// let v = [
    ///     0xD834, 0xDD1E, 0x006d, 0x0075, 0x0073, 0xDD1E, 0x0069, 0x0063, 0xD834,
    /// ];
    ///
    /// assert_eq!(
    ///     char::decode_utf16(v)
    ///        .map(|r| r.unwrap_or(char::REPLACEMENT_CHARACTER))
    ///        .collect::<String>(),
    ///     "𝄞mus�ic�"
    /// );
    /// ```
    #[stable(feature = "assoc_char_funcs", since = "1.52.0")]
    #[inline]
    pub fn decode_utf16<I: IntoIterator<Item = u16>>(iter: I) -> DecodeUtf16<I::IntoIter> {
        super::decode::decode_utf16(iter)
    }

    /// Converts a `u32` to a `char`.
    ///
    /// Note that all `char`s are valid [`u32`]s, and can be cast to one with
    /// [`as`](../std/keyword.as.html):
    ///
    /// ```
    /// let c = '💯';
    /// let i = c as u32;
    ///
    /// assert_eq!(128175, i);
    /// ```
    ///
    /// However, the reverse is not true: not all valid [`u32`]s are valid
    /// `char`s. `from_u32()` will return `None` if the input is not a valid value
    /// for a `char`.
    ///
    /// # 示例
    /// [`from_u32_unchecked`].
    ///
    /// [`from_u32_unchecked`]: #method.from_u32_unchecked
    ///
    /// # 基本用法：
    ///
    /// Basic usage:
    ///
    /// ```
    /// let c = char::from_u32(0x2764);
    ///
    /// assert_eq!(Some('❤'), c);
    /// ```
    ///
    /// Returning `None` when the input is not a valid `char`:
    ///
    /// ```
    /// let c = char::from_u32(0x110000);
    ///
    /// assert_eq!(None, c);
    /// ```
    #[stable(feature = "assoc_char_funcs", since = "1.52.0")]
    #[rustc_const_stable(feature = "const_char_convert", since = "1.67.0")]
    #[must_use]
    #[inline]
    pub const fn from_u32(i: u32) -> Option<char> {
        super::convert::from_u32(i)
    }

    /// Converts a `u32` to a `char`, ignoring validity.
    ///
    /// Note that all `char`s are valid [`u32`]s, and can be cast to one with
    /// `as`:
    ///
    /// ```
    /// let c = '💯';
    /// let i = c as u32;
    ///
    /// assert_eq!(128175, i);
    /// ```
    ///
    /// However, the reverse is not true: not all valid [`u32`]s are valid
    /// `char`s. `from_u32_unchecked()` will ignore this, and blindly cast to
    /// `char`, possibly creating an invalid one.
    ///
    /// # 安全性
    ///
    /// This function is unsafe, as it may construct invalid `char` values.
    ///
    /// For a safe version of this function, see the [`from_u32`] function.
    ///
    /// [`from_u32`]: #method.from_u32
    ///
    /// # 示例
    ///
    /// 基本用法：
    ///
    /// ```
    /// let c = unsafe { char::from_u32_unchecked(0x2764) };
    ///
    /// assert_eq!('❤', c);
    /// ```
    #[stable(feature = "assoc_char_funcs", since = "1.52.0")]
    #[rustc_const_stable(feature = "const_char_from_u32_unchecked", since = "1.81.0")]
    #[must_use]
    #[inline]
    pub const unsafe fn from_u32_unchecked(i: u32) -> char {
        // SAFETY: the safety contract must be upheld by the caller.
        unsafe { super::convert::from_u32_unchecked(i) }
    }

    /// Converts a digit in the given radix to a `char`.
    ///
    /// 这里的“基数”有时也被称为“底数”。二进制基数
    /// 表示二进制数，十进制的基数为
    /// 十六进制，以给出一些常见的值。支持任意的
    /// 基数。
    ///
    /// `from_digit()` will return `None` if the input is not a digit in
    /// 在给定基数中。
    ///
    /// # 恐慌
    ///
    /// 如果给出大于 36 的基数，则引发恐慌。
    ///
    /// # 示例
    ///
    /// 基本用法：
    ///
    /// ```
    /// let c = char::from_digit(4, 10);
    ///
    /// assert_eq!(Some('4'), c);
    ///
    /// // Decimal 11 is a single digit in base 16
    /// let c = char::from_digit(11, 16);
    ///
    /// assert_eq!(Some('b'), c);
    /// ```
    ///
    /// Returning `None` when the input is not a digit:
    ///
    /// ```
    /// let c = char::from_digit(20, 10);
    ///
    /// assert_eq!(None, c);
    /// ```
    ///
    /// 传递大基数，导致恐慌：
    ///
    /// ```should_panic
    /// // this panics
    /// let _c = char::from_digit(1, 37);
    /// ```
    #[stable(feature = "assoc_char_funcs", since = "1.52.0")]
    #[rustc_const_stable(feature = "const_char_convert", since = "1.67.0")]
    #[must_use]
    #[inline]
    pub const fn from_digit(num: u32, radix: u32) -> Option<char> {
        super::convert::from_digit(num, radix)
    }

    /// Checks if a `char` is a digit in the given radix.
    ///
    /// 这里的“基数”有时也被称为“底数”。二进制基数
    /// 表示二进制数，十进制的基数为
    /// 十六进制，以给出一些常见的值。支持任意的
    /// 基数。
    ///
    /// Compared to [`is_numeric()`], this function only recognizes the characters
    /// `0-9`, `a-z` and `A-Z`.
    ///
    /// “数字”被定义为以下字符：
    ///
    /// * `0-9`
    /// * `a-z`
    /// * `A-Z`
    ///
    /// For a more comprehensive understanding of 'digit', see [`is_numeric()`].
    ///
    /// [`is_numeric()`]: #method.is_numeric
    ///
    /// # 恐慌
    ///
    /// 如果给出小于 2 或大于 36 的基数，则引发恐慌。
    ///
    /// # 示例
    ///
    /// 基本用法：
    ///
    /// ```
    /// assert!('1'.is_digit(10));
    /// assert!('f'.is_digit(16));
    /// assert!(!'f'.is_digit(10));
    /// ```
    ///
    /// 传递大基数，导致恐慌：
    ///
    /// ```should_panic
    /// // this panics
    /// '1'.is_digit(37);
    /// ```
    ///
    /// 传递小基数，导致恐慌：
    ///
    /// ```should_panic
    /// // this panics
    /// '1'.is_digit(1);
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_char_classify", since = "1.87.0")]
    #[expect(clippy::to_digit_is_some, reason = "implements is_digit")]
    #[inline]
    pub const fn is_digit(self, radix: u32) -> bool {
        self.to_digit(radix).is_some()
    }

    /// Converts a `char` to a digit in the given radix.
    ///
    /// 这里的“基数”有时也被称为“底数”。二进制基数
    /// 表示二进制数，十进制的基数为
    /// 十六进制，以给出一些常见的值。支持任意的
    /// 基数。
    ///
    /// “数字”被定义为以下字符：
    ///
    /// * `0-9`
    /// * `a-z`
    /// * `A-Z`
    ///
    /// # 错误
    ///
    /// Returns `None` if the `char` does not refer to a digit in the given radix.
    ///
    /// # 恐慌
    ///
    /// 如果给出小于 2 或大于 36 的基数，则引发恐慌。
    ///
    /// # 示例
    ///
    /// 基本用法：
    ///
    /// ```
    /// assert_eq!('1'.to_digit(10), Some(1));
    /// assert_eq!('f'.to_digit(16), Some(15));
    /// ```
    ///
    /// 传递非数字会导致失败：
    ///
    /// ```
    /// assert_eq!('f'.to_digit(10), None);
    /// assert_eq!('z'.to_digit(16), None);
    /// ```
    ///
    /// 传递大基数，导致恐慌：
    ///
    /// ```should_panic
    /// // this panics
    /// let _ = '1'.to_digit(37);
    /// ```
    /// 传递小基数，导致恐慌：
    ///
    /// ```should_panic
    /// // this panics
    /// let _ = '1'.to_digit(1);
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_char_convert", since = "1.67.0")]
    #[rustc_diagnostic_item = "char_to_digit"]
    #[must_use = "this returns the result of the operation, \
                  without modifying the original"]
    #[inline]
    pub const fn to_digit(self, radix: u32) -> Option<u32> {
        assert!(
            radix >= 2 && radix <= 36,
            "to_digit: invalid radix -- radix must be in the range 2 to 36 inclusive"
        );
        // check radix to remove letter handling code when radix is a known constant
        let value = if self > '9' && radix > 10 {
            // mask to convert ASCII letters to uppercase
            const TO_UPPERCASE_MASK: u32 = !0b0010_0000;
            // Converts an ASCII letter to its corresponding integer value:
            // A-Z => 10-35, a-z => 10-35. Other characters produce values >= 36.
            //
            // Add Overflow Safety:
            // By applying the mask after the subtraction, the first addendum is
            // constrained such that it never exceeds u32::MAX - 0x20.
            ((self as u32).wrapping_sub('A' as u32) & TO_UPPERCASE_MASK) + 10
        } else {
            // convert digit to value, non-digits wrap to values > 36
            (self as u32).wrapping_sub('0' as u32)
        };
        // FIXME(const-hack): once then_some is const fn, use it here
        if value < radix { Some(value) } else { None }
    }

    /// 返回一个迭代器，该迭代器输出字符的十六进制 Unicode 转义序列。
    /// character as `char`s.
    ///
    /// 这将以符合 Rust 语法的形式转义字符，形式为
    /// `\u{NNNNNN}` where `NNNNNN` is a hexadecimal representation.
    ///
    /// # 示例
    ///
    /// 作为迭代器：
    ///
    /// ```
    /// for c in '❤'.escape_unicode() {
    ///     print!("{c}");
    /// }
    /// println!();
    /// ```
    ///
    /// Using `println!` directly:
    ///
    /// ```
    /// println!("{}", '❤'.escape_unicode());
    /// ```
    ///
    /// 两者等效于：
    ///
    /// ```
    /// println!("\\u{{2764}}");
    /// ```
    ///
    /// Using [`to_string`](../std/string/trait.ToString.html#tymethod.to_string):
    ///
    /// ```
    /// assert_eq!('❤'.escape_unicode().to_string(), "\\u{2764}");
    /// ```
    #[must_use = "this returns the escaped char as an iterator, \
                  without modifying the original"]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    pub fn escape_unicode(self) -> EscapeUnicode {
        EscapeUnicode::new(self)
    }

    /// An extended version of `escape_debug` that optionally permits escaping
    /// 允许转义单引号和双引号。这允许在字符中转义单引号，在字符串中转义双引号。
    /// 返回一个迭代器，该迭代器输出字符的直译转义代码。
    #[inline]
    pub(crate) fn escape_debug_ext(self, args: EscapeDebugExtArgs) -> EscapeDebug {
        match self {
            // Special escapes
            '\"' if args.escape_double_quote => EscapeDebug::backslash(ascii::Char::QuotationMark),
            '\'' if args.escape_single_quote => EscapeDebug::backslash(ascii::Char::Apostrophe),
            '\\' => EscapeDebug::backslash(ascii::Char::ReverseSolidus),
            '\n' => EscapeDebug::backslash(ascii::Char::SmallN),
            '\t' => EscapeDebug::backslash(ascii::Char::SmallT),
            '\r' => EscapeDebug::backslash(ascii::Char::SmallR),
            '\0' => EscapeDebug::backslash(ascii::Char::Digit0),

            // ASCII fast path,
            // plus U+FF9E HALFWIDTH KATAKANA VOICED SOUND MARK
            // and U+FF9F HALFWIDTH KATAKANA SEMI-VOICED SOUND MARK
            // which should not be escaped despite being grapheme extenders.
            '\x20'..='\x7E' | '\u{FF9E}' | '\u{FF9F}' => EscapeDebug::printable(self),

            _ if self.is_control()
                || self.is_private_use()
                || self.is_whitespace()
                || self.is_grapheme_extender()
                || self.is_default_ignorable()
                || self.is_format_control()
                || !self.is_assigned() =>
            {
                EscapeDebug::unicode(self)
            }

            _ => EscapeDebug::printable(self),
        }
    }

    /// Returns an iterator that yields the literal escape code of a character
    /// as `char`s.
    ///
    /// This will escape the characters similar to the [`Debug`](core::fmt::Debug) implementations
    /// of `str` or `char`.
    ///
    /// # 示例
    ///
    /// 作为迭代器：
    ///
    /// ```
    /// for c in '\n'.escape_debug() {
    ///     print!("{c}");
    /// }
    /// println!();
    /// ```
    ///
    /// Using `println!` directly:
    ///
    /// ```
    /// println!("{}", '\n'.escape_debug());
    /// ```
    ///
    /// 两者等效于：
    ///
    /// ```
    /// println!("\\n");
    /// ```
    ///
    /// Using [`to_string`](../std/string/trait.ToString.html#tymethod.to_string):
    ///
    /// ```
    /// assert_eq!('\n'.escape_debug().to_string(), "\\n");
    /// ```
    #[must_use = "this returns the escaped char as an iterator, \
                  without modifying the original"]
    #[stable(feature = "char_escape_debug", since = "1.20.0")]
    #[inline]
    pub fn escape_debug(self) -> EscapeDebug {
        self.escape_debug_ext(EscapeDebugExtArgs::ESCAPE_ALL)
    }

    /// 返回一个迭代器，该迭代器输出字符的直译转义代码。
    /// as `char`s.
    ///
    /// 默认选择倾向于生成在多种语言中合法的直译字符串，包括 C++11 和类似的 C 族语言。具体规则如下：
    /// legal in a variety of languages, including C++11 and similar C-family
    /// languages. The exact rules are:
    ///
    /// * Tab is escaped as `\t`.
    /// * Carriage return is escaped as `\r`.
    /// * Line feed is escaped as `\n`.
    /// * Single quote is escaped as `\'`.
    /// * Double quote is escaped as `\"`.
    /// * Backslash is escaped as `\\`.
    /// * Any character in the 'printable ASCII' range `0x20` .. `0x7e`
    /// # 示例
    /// 作为迭代器：
    ///   [`escape_unicode`].
    ///
    /// [`escape_unicode`]: #method.escape_unicode
    ///
    /// # Examples
    ///
    /// 作为迭代器：
    ///
    /// ```
    /// for c in '"'.escape_default() {
    ///     print!("{c}");
    /// }
    /// println!();
    /// ```
    ///
    /// Using `println!` directly:
    ///
    /// ```
    /// println!("{}", '"'.escape_default());
    /// ```
    ///
    /// 两者等效于：
    ///
    /// ```
    /// println!("\\\"");
    /// ```
    ///
    /// Using [`to_string`](../std/string/trait.ToString.html#tymethod.to_string):
    ///
    /// ```
    /// assert_eq!('"'.escape_default().to_string(), "\\\"");
    /// ```
    #[must_use = "this returns the escaped char as an iterator, \
                  without modifying the original"]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    pub fn escape_default(self) -> EscapeDefault {
        match self {
            '\t' => EscapeDefault::backslash(ascii::Char::SmallT),
            '\r' => EscapeDefault::backslash(ascii::Char::SmallR),
            '\n' => EscapeDefault::backslash(ascii::Char::SmallN),
            '\\' | '\'' | '\"' => EscapeDefault::backslash(self.as_ascii().unwrap()),
            '\x20'..='\x7e' => EscapeDefault::printable(self.as_ascii().unwrap()),
            _ => EscapeDefault::unicode(self),
        }
    }

    /// Returns the number of bytes this `char` would need if encoded in UTF-8.
    ///
    /// 该字节数始终在 1 到 4 之间，包括边界值。
    ///
    /// # 示例
    ///
    /// 基本用法：
    ///
    /// ```
    /// let len = 'A'.len_utf8();
    /// assert_eq!(len, 1);
    ///
    /// let len = 'ß'.len_utf8();
    /// assert_eq!(len, 2);
    ///
    /// let len = 'ℝ'.len_utf8();
    /// assert_eq!(len, 3);
    ///
    /// let len = '💣'.len_utf8();
    /// assert_eq!(len, 4);
    /// ```
    ///
    /// The `&str` type guarantees that its contents are UTF-8, and so we can compare the length it
    /// would take if each code point was represented as a `char` vs in the `&str` itself:
    ///
    /// ```
    /// // as chars
    /// let eastern = '東';
    /// let capital = '京';
    ///
    /// // both can be represented as three bytes
    /// assert_eq!(3, eastern.len_utf8());
    /// assert_eq!(3, capital.len_utf8());
    ///
    /// // as a &str, these two are encoded in UTF-8
    /// let tokyo = "東京";
    ///
    /// let len = eastern.len_utf8() + capital.len_utf8();
    ///
    /// // we can see that they take six bytes total...
    /// assert_eq!(6, tokyo.len());
    ///
    /// // ... just like the &str
    /// assert_eq!(len, tokyo.len());
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_char_len_utf", since = "1.52.0")]
    #[inline]
    #[must_use]
    pub const fn len_utf8(self) -> usize {
        len_utf8(self as u32)
    }

    /// Returns the number of 16-bit code units this `char` would need if
    /// 该代码单元数始终为 1 或 2，适用于 [基本多语言平面] 或 [补充平面] 中的 Unicode 标量值。
    ///
    /// That number of code units is always either 1 or 2, for unicode scalar values in
    /// # 示例
    ///
    /// See the documentation for [`len_utf8()`] for more explanation of this
    /// 将此字符编码为 UTF-8 并放入提供的字节缓冲区中。
    ///
    /// [basic multilingual plane]: http://www.unicode.org/glossary/#basic_multilingual_plane
    /// [supplementary planes]: http://www.unicode.org/glossary/#supplementary_planes
    /// [`len_utf8()`]: #method.len_utf8
    ///
    /// # Examples
    ///
    /// Basic usage:
    ///
    /// ```
    /// let n = 'ß'.len_utf16();
    /// assert_eq!(n, 1);
    ///
    /// let len = '💣'.len_utf16();
    /// assert_eq!(len, 2);
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_char_len_utf", since = "1.52.0")]
    #[inline]
    #[must_use]
    pub const fn len_utf16(self) -> usize {
        len_utf16(self as u32)
    }

    /// Encodes this character as UTF-8 into the provided byte buffer,
    /// 然后返回缓冲区中包含编码字符的切片。
    ///
    /// # 异常
    ///
    /// 如果缓冲区不够大，则引发异常。
    /// A buffer of length four is large enough to encode any `char`.
    ///
    /// # 示例
    ///
    /// 在这两个示例中，'ß' 需要两个字节来编码。
    ///
    /// ```
    /// let mut b = [0; 2];
    ///
    /// let result = 'ß'.encode_utf8(&mut b);
    ///
    /// assert_eq!(result, "ß");
    ///
    /// assert_eq!(result.len(), 2);
    /// ```
    ///
    /// 过小的缓冲区：
    ///
    /// ```should_panic
    /// let mut b = [0; 1];
    ///
    /// // this panics
    /// 'ß'.encode_utf8(&mut b);
    /// ```
    #[stable(feature = "unicode_encode_char", since = "1.15.0")]
    #[rustc_const_stable(feature = "const_char_encode_utf8", since = "1.83.0")]
    #[inline]
    pub const fn encode_utf8(self, dst: &mut [u8]) -> &mut str {
        // SAFETY: `char` is not a surrogate, so this is valid UTF-8.
        unsafe { from_utf8_unchecked_mut(encode_utf8_raw(self as u32, dst)) }
    }

    /// Encodes this character as native endian UTF-16 into the provided `u16` buffer,
    /// 然后返回包含编码字符的缓冲区切片。
    ///
    /// # 异常
    ///
    /// 如果缓冲区不够大，则引发异常。
    /// A buffer of length 2 is large enough to encode any `char`.
    ///
    /// # 示例
    ///
    /// In both of these examples, '𝕊' takes two `u16`s to encode.
    ///
    /// ```
    /// let mut b = [0; 2];
    ///
    /// let result = '𝕊'.encode_utf16(&mut b);
    ///
    /// assert_eq!(result.len(), 2);
    /// ```
    ///
    /// 过小的缓冲区：
    ///
    /// ```should_panic
    /// let mut b = [0; 1];
    ///
    /// // this panics
    /// '𝕊'.encode_utf16(&mut b);
    /// ```
    #[stable(feature = "unicode_encode_char", since = "1.15.0")]
    #[rustc_const_stable(feature = "const_char_encode_utf16", since = "1.84.0")]
    #[inline]
    pub const fn encode_utf16(self, dst: &mut [u16]) -> &mut [u16] {
        encode_utf16_raw(self as u32, dst)
    }

    /// Returns `true` if this `char` has the `Alphabetic` property.
    ///
    /// `Alphabetic` is [described] in Chapter 4 (Character Properties) of the Unicode Standard, and
    /// [specified] in the Unicode Character Database [`DerivedCoreProperties.txt`].
    ///
    /// [described]: https://www.unicode.org/versions/latest/core-spec/chapter-4/#G32524
    /// [specified]: https://www.unicode.org/reports/tr44/#Alphabetic
    /// [`DerivedCoreProperties.txt`]: https://www.unicode.org/Public/UCD/latest/ucd/DerivedCoreProperties.txt
    ///
    /// # 示例
    ///
    /// 基本用法：
    ///
    /// ```
    /// assert!('a'.is_alphabetic());
    /// assert!('京'.is_alphabetic());
    ///
    /// let c = '💝';
    /// // love is many things, but it is not alphabetic
    /// assert!(!c.is_alphabetic());
    /// ```
    #[must_use]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    pub fn is_alphabetic(self) -> bool {
        match self {
            'a'..='z' | 'A'..='Z' => true,
            '\0'..='\u{A9}' => false,
            _ => unicode::Alphabetic(self),
        }
    }

    /// Returns `true` if this `char` has the `Cased` property.
    /// 字符的大小写取决于它是否为大写、小写或标题大小写。
    ///
    /// `Cased` is [described] in Chapter 3 (Character Properties) of the Unicode Standard and
    /// [specified] in the Unicode Character Database [`DerivedCoreProperties.txt`].
    ///
    /// [described]: https://www.unicode.org/versions/latest/core-spec/chapter-3/#G44595
    /// [specified]: https://www.unicode.org/reports/tr44/#Cased
    /// [`DerivedCoreProperties.txt`]: https://www.unicode.org/Public/UCD/latest/ucd/DerivedCoreProperties.txt
    ///
    /// # 示例
    ///
    /// 基本用法：
    ///
    /// ```
    /// assert!('A'.is_cased());
    /// assert!('a'.is_cased());
    /// assert!(!'京'.is_cased());
    /// ```
    #[must_use]
    #[stable(feature = "titlecase", since = "CURRENT_RUSTC_VERSION")]
    #[inline]
    pub fn is_cased(self) -> bool {
        match self {
            'a'..='z' | 'A'..='Z' => true,
            '\0'..='\u{A9}' => false,
            _ => unicode::Lowercase(self) || unicode::Uppercase(self) || unicode::Lt(self),
        }
    }

    /// 返回此字符的大小写：
    /// [`Some(CharCase::Upper)`][`CharCase::Upper`] if [`self.is_uppercase()`][`char::is_uppercase`],
    /// [`Some(CharCase::Lower)`][`CharCase::Lower`] if [`self.is_lowercase()`][`char::is_lowercase`],
    /// [`Some(CharCase::Title)`][`CharCase::Title`] if [`self.is_titlecase()`][`char::is_titlecase`], and
    /// `None` if [`!self.is_cased()`][`char::is_cased`].
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(char_case)]
    /// use core::char::CharCase;
    /// assert_eq!('a'.case(), Some(CharCase::Lower));
    /// assert_eq!('δ'.case(), Some(CharCase::Lower));
    /// assert_eq!('A'.case(), Some(CharCase::Upper));
    /// assert_eq!('Δ'.case(), Some(CharCase::Upper));
    /// assert_eq!('ǅ'.case(), Some(CharCase::Title));
    /// assert_eq!('中'.case(), None);
    /// ```
    #[must_use]
    #[unstable(feature = "char_case", issue = "166360")]
    #[inline]
    pub fn case(self) -> Option<CharCase> {
        match self {
            'a'..='z' => Some(CharCase::Lower),
            'A'..='Z' => Some(CharCase::Upper),
            '\0'..='\u{A9}' => None,
            _ if unicode::Lowercase(self) => Some(CharCase::Lower),
            _ if unicode::Uppercase(self) => Some(CharCase::Upper),
            _ if unicode::Lt(self) => Some(CharCase::Title),
            _ => None,
        }
    }

    /// Returns `true` if this `char` has the `Lowercase` property.
    ///
    /// `Lowercase` is [described] in Chapter 4 (Character Properties) of the Unicode Standard, and
    /// [specified] in the Unicode Character Database [`DerivedCoreProperties.txt`].
    ///
    /// [described]: https://www.unicode.org/versions/latest/core-spec/chapter-4/#G136255
    /// [specified]: https://www.unicode.org/reports/tr44/#Lowercase
    /// [`DerivedCoreProperties.txt`]: https://www.unicode.org/Public/UCD/latest/ucd/DerivedCoreProperties.txt
    ///
    /// # 示例
    ///
    /// 基本用法：
    ///
    /// ```
    /// assert!('a'.is_lowercase());
    /// assert!('δ'.is_lowercase());
    /// assert!(!'A'.is_lowercase());
    /// assert!(!'Δ'.is_lowercase());
    ///
    /// // The various Chinese scripts and punctuation do not have case, and so:
    /// assert!(!'中'.is_lowercase());
    /// assert!(!' '.is_lowercase());
    /// ```
    ///
    /// 在 const 上下文中：
    ///
    /// ```
    /// const CAPITAL_DELTA_IS_LOWERCASE: bool = 'Δ'.is_lowercase();
    /// assert!(!CAPITAL_DELTA_IS_LOWERCASE);
    /// ```
    #[must_use]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_unicode_case_lookup", since = "1.84.0")]
    #[inline]
    pub const fn is_lowercase(self) -> bool {
        match self {
            'a'..='z' => true,
            '\0'..='\u{A9}' => false,
            _ => unicode::Lowercase(self),
        }
    }

    /// Returns `true` if this `char` is in the general category for titlecase letters.
    /// 从概念上讲，这些字符由大写部分后跟小写部分组成。
    ///
    /// Titlecase letters (code points with the general category of `Lt`) are [described] in Chapter 4
    /// (Character Properties) of the Unicode Standard, and [specified] in the Unicode Character
    /// Database [`UnicodeData.txt`].
    ///
    /// [described]: https://www.unicode.org/versions/latest/core-spec/chapter-4/#G124722
    /// [specified]: https://www.unicode.org/reports/tr44/#GC_Values_Table
    /// [`UnicodeData.txt`]: https://www.unicode.org/Public/UCD/latest/ucd/UnicodeData.txt
    ///
    /// # 示例
    ///
    /// 基本用法：
    ///
    /// ```
    /// assert!('ǅ'.is_titlecase());
    /// assert!('ῼ'.is_titlecase());
    /// assert!(!'D'.is_titlecase());
    /// assert!(!'z'.is_titlecase());
    /// assert!(!'中'.is_titlecase());
    /// assert!(!' '.is_titlecase());
    /// ```
    #[must_use]
    #[stable(feature = "titlecase", since = "CURRENT_RUSTC_VERSION")]
    #[inline]
    pub fn is_titlecase(self) -> bool {
        match self {
            '\0'..='\u{01C4}' => false,
            _ => unicode::Lt(self),
        }
    }

    /// Returns `true` if this `char` has the `Uppercase` property.
    ///
    /// `Uppercase` is [described] in Chapter 4 (Character Properties) of the Unicode Standard, and
    /// [specified] in the Unicode Character Database [`DerivedCoreProperties.txt`].
    ///
    /// [described]: https://www.unicode.org/versions/latest/core-spec/chapter-4/#G136255
    /// [specified]: https://www.unicode.org/reports/tr44/#Uppercase
    /// [`DerivedCoreProperties.txt`]: https://www.unicode.org/Public/UCD/latest/ucd/DerivedCoreProperties.txt
    ///
    /// # 示例
    ///
    /// 基本用法：
    ///
    /// ```
    /// assert!(!'a'.is_uppercase());
    /// assert!(!'δ'.is_uppercase());
    /// assert!('A'.is_uppercase());
    /// assert!('Δ'.is_uppercase());
    ///
    /// // The various Chinese scripts and punctuation do not have case, and so:
    /// assert!(!'中'.is_uppercase());
    /// assert!(!' '.is_uppercase());
    /// ```
    ///
    /// 在 const 上下文中：
    ///
    /// ```
    /// const CAPITAL_DELTA_IS_UPPERCASE: bool = 'Δ'.is_uppercase();
    /// assert!(CAPITAL_DELTA_IS_UPPERCASE);
    /// ```
    #[must_use]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_unicode_case_lookup", since = "1.84.0")]
    #[inline]
    pub const fn is_uppercase(self) -> bool {
        match self {
            'A'..='Z' => true,
            '\0'..='\u{BF}' => false,
            _ => unicode::Uppercase(self),
        }
    }

    /// Returns `true` if this `char` has one of the general categories for numbers.
    ///
    /// The general categories for numbers (`Nd` for decimal digits, `Nl` for letter-like numeric
    /// characters, and `No` for other numeric characters) are [specified] in the Unicode Character
    /// Database [`UnicodeData.txt`].
    ///
    /// 该方法并不涵盖所有可被视为数字的情况，例如像“三”这样的汉字数字。
    /// 如果您需要包含具有重叠用途的字符，则可能需要使用
    /// 一个能够展示相应字符属性的 Unicode 或语言处理库，而不是直接查看 Unicode 分类。
    /// (e.g. [`Numeric_Type`]) instead of looking at the Unicode categories.
    ///
    /// 如果您需要解析 ASCII 十进制数字（0-9）或 ASCII base-N 数字，请使用
    /// `is_ascii_digit` or `is_digit` instead.
    ///
    /// [specified]: https://www.unicode.org/reports/tr44/#GC_Values_Table
    /// [`UnicodeData.txt`]: https://www.unicode.org/Public/UCD/latest/ucd/UnicodeData.txt
    /// [`Numeric_Type`]: https://www.unicode.org/reports/tr44/#Numeric_Type
    ///
    /// # 示例
    ///
    /// 基本用法：
    ///
    /// ```
    /// assert!('٣'.is_numeric());
    /// assert!('7'.is_numeric());
    /// assert!('৬'.is_numeric());
    /// assert!('¾'.is_numeric());
    /// assert!('①'.is_numeric());
    /// assert!(!'K'.is_numeric());
    /// assert!(!'و'.is_numeric());
    /// assert!(!'藏'.is_numeric());
    /// assert!(!'三'.is_numeric());
    /// ```
    #[must_use]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    pub fn is_numeric(self) -> bool {
        match self {
            '0'..='9' => true,
            '\0'..='\u{B1}' => false,
            _ => unicode::N(self),
        }
    }

    /// Returns `true` if this `char` satisfies either [`is_alphabetic()`] or [`is_numeric()`].
    ///
    /// [`is_alphabetic()`]: Self::is_alphabetic
    /// [`is_numeric()`]: Self::is_numeric
    ///
    /// # 示例
    ///
    /// 基本用法：
    ///
    /// ```
    /// assert!('٣'.is_alphanumeric());
    /// assert!('7'.is_alphanumeric());
    /// assert!('৬'.is_alphanumeric());
    /// assert!('¾'.is_alphanumeric());
    /// assert!('①'.is_alphanumeric());
    /// assert!('K'.is_alphanumeric());
    /// assert!('و'.is_alphanumeric());
    /// assert!('藏'.is_alphanumeric());
    /// ```
    #[must_use]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    pub fn is_alphanumeric(self) -> bool {
        match self {
            'a'..='z' | 'A'..='Z' | '0'..='9' => true,
            '\0'..='\u{A9}' => false,
            _ => unicode::Alphabetic(self) || unicode::N(self),
        }
    }

    /// Returns `true` if this `char` has the `White_Space` property.
    ///
    /// `White_Space` is [specified] in the Unicode Character Database [`PropList.txt`].
    ///
    /// [specified]: https://www.unicode.org/reports/tr44/#White_Space
    /// [`PropList.txt`]: https://www.unicode.org/Public/UCD/latest/ucd/PropList.txt
    ///
    /// # 示例
    ///
    /// 基本用法：
    ///
    /// ```
    /// assert!(' '.is_whitespace());
    ///
    /// // line break
    /// assert!('\n'.is_whitespace());
    ///
    /// // a non-breaking space
    /// assert!('\u{A0}'.is_whitespace());
    ///
    /// assert!(!'越'.is_whitespace());
    /// ```
    #[must_use]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_char_classify", since = "1.87.0")]
    #[inline]
    pub const fn is_whitespace(self) -> bool {
        match self {
            ' ' | '\x09'..='\x0d' => true,
            '\0'..='\u{84}' => false,
            _ => unicode::White_Space(self),
        }
    }

    /// Returns `true` if this `char` has the `XID_Continue` property.
    ///
    /// `XID_Continue` is [specified] in the Unicode Character Database [`DerivedCoreProperties.txt`].
    ///
    /// [specified]: https://www.unicode.org/reports/tr31
    /// [`DerivedCoreProperties.txt`]: https://www.unicode.org/Public/UCD/latest/ucd/DerivedCoreProperties.txt
    ///
    /// 新的 Unicode 版本可能会根据其 [稳定性政策] 向此集合中添加新字符。
    /// 这并不被视为 [破坏性变更]。
    ///
    /// [stability policy]: https://www.unicode.org/policies/stability_policy.html#Identifier
    /// [breaking change]: char::UNICODE_VERSION
    ///
    /// # 示例
    ///
    /// 基本用法：
    ///
    /// ```
    /// #![feature(char_is_xid)]
    ///
    /// assert!('A'.is_xid_continue());
    /// assert!('9'.is_xid_continue());
    /// assert!('_'.is_xid_continue());
    ///
    /// assert!(!' '.is_xid_continue());
    /// ```
    #[must_use]
    #[unstable(feature = "char_is_xid", issue = "164841")]
    #[inline]
    pub fn is_xid_continue(self) -> bool {
        match self {
            'a'..='z' | 'A'..='Z' | '0'..='9' | '_' => true,
            '\0'..='\u{A9}' => false,
            _ => unicode::XID_Continue(self),
        }
    }

    /// Returns `true` if this `char` has the `XID_Start` property.
    ///
    /// `XID_Start` is [specified] in the Unicode Character Database [`DerivedCoreProperties.txt`].
    ///
    /// [specified]: https://www.unicode.org/reports/tr31
    /// [`DerivedCoreProperties.txt`]: https://www.unicode.org/Public/UCD/latest/ucd/DerivedCoreProperties.txt
    ///
    /// 新的 Unicode 版本可能会根据其 [稳定性政策] 向此集合中添加新字符。
    /// 这并不被视为 [破坏性变更]。
    ///
    /// [stability policy]: https://www.unicode.org/policies/stability_policy.html#Identifier
    /// [breaking change]: char::UNICODE_VERSION
    ///
    /// # 示例
    ///
    /// 基本用法：
    ///
    /// ```
    /// #![feature(char_is_xid)]
    ///
    /// assert!('A'.is_xid_start());
    ///
    /// assert!(!' '.is_xid_start());
    /// assert!(!'9'.is_xid_start());
    /// assert!(!'_'.is_xid_start());
    /// ```
    #[must_use]
    #[unstable(feature = "char_is_xid", issue = "164841")]
    #[inline]
    pub fn is_xid_start(self) -> bool {
        match self {
            'a'..='z' | 'A'..='Z' => true,
            '\0'..='\u{A9}' => false,
            _ => unicode::XID_Start(self),
        }
    }

    /// Returns `true` if this `char` has the general category for control codes.
    ///
    /// Control codes (code points with the general category of `Cc`) are [described] in Chapter 23
    /// （特殊区域和格式字符）中有描述，并在 Unicode 字符集中有明确规定。
    /// Database [`UnicodeData.txt`]. The full set of Unicode control codes is
    /// `'\0'..='\x1f' | '\x7f'..='\u{9f}'`, and will never change.
    ///
    /// [described]: https://www.unicode.org/versions/latest/core-spec/chapter-23/#G20365
    /// [specified]: https://www.unicode.org/reports/tr44/#GC_Values_Table
    /// [`UnicodeData.txt`]: https://www.unicode.org/Public/UCD/latest/ucd/UnicodeData.txt
    ///
    /// # 示例
    ///
    /// 基本用法：
    ///
    /// ```
    /// assert!('\t'.is_control());
    /// assert!('\n'.is_control());
    /// assert!('\u{9C}'.is_control()); // STRING TERMINATOR
    /// assert!(!'q'.is_control());
    /// ```
    #[must_use]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_is_control", since = "1.97.0")]
    #[inline]
    pub const fn is_control(self) -> bool {
        // According to
        // https://www.unicode.org/policies/stability_policy.html#Property_Value,
        // the set of codepoints in `Cc` will never change.
        // So we can just hard-code the patterns to match against instead of using a table.
        matches!(self, '\0'..='\x1f' | '\x7f'..='\u{9f}')
    }

    /// Returns `true` if this `char` has the general category for [private-use characters].
    /// 这些字符没有由 Unicode 规定的解释；各个程序
    /// 和用户都可以自由赋予它们任意含义。
    ///
    /// [private-use characters]: https://www.unicode.org/faq/private_use#private_use
    ///
    /// Private-use characters (code points with the general category of `Co`) are [described] in Chapter 23
    /// 《Unicode 标准中的特殊区域和格式字符》，并在
    /// Unicode Character Database [`UnicodeData.txt`]. The full set of private-use characters is
    /// `'\u{E000}'..='\u{F8FF}' | '\u{F0000}'..='\u{FFFFD}' | '\u{100000}'..='\u{10FFFD}'`,
    /// 且永远不会改变。
    ///
    /// [described]: https://www.unicode.org/versions/latest/core-spec/chapter-23/#G19184
    /// [specified]: https://www.unicode.org/reports/tr44/#GC_Values_Table
    /// [`UnicodeData.txt`]: https://www.unicode.org/Public/UCD/latest/ucd/UnicodeData.txt
    ///
    #[must_use]
    #[unstable(feature = "char_unassigned_private_use", issue = "158322")]
    #[inline]
    pub const fn is_private_use(self) -> bool {
        // According to
        // https://www.unicode.org/policies/stability_policy.html#Property_Value,
        // the set of codepoints in `Co` will never change.
        // So we can just hard-code the patterns to match against instead of using a table.
        matches!(self, '\u{E000}'..='\u{F8FF}' | '\u{F0000}'..='\u{FFFFD}' | '\u{100000}'..='\u{10FFFD}')
    }

    /// Returns `true` if this `char` has the general category for format control characters.
    ///
    /// Format controls (code points with the general category of `Cf`) are [described] in Chapter 4
    /// (Character Properties) of the Unicode Standard, and [specified] in the Unicode Character
    /// Database [`UnicodeData.txt`].
    ///
    /// [described]: https://www.unicode.org/versions/latest/core-spec/chapter-4/#G134153
    /// [specified]: https://www.unicode.org/reports/tr44/#GC_Values_Table
    /// [`UnicodeData.txt`]: https://www.unicode.org/Public/UCD/latest/ucd/UnicodeData.txt
    ///
    /// # 示例
    ///
    /// 基本用法：
    ///
    /// ```ignore(private)
    /// assert!('\u{AD}'.is_format_control()); // SOFT HYPHEN
    /// assert!('\u{200B}'.is_format_control()); // ZERO WIDTH SPACE
    /// assert!('\u{E0041}'.is_format_control()); // TAG LATIN CAPITAL LETTER A
    /// assert!('۝'.is_format_control()); // ARABIC END OF AYAH
    /// assert!('𓐲'.is_format_control()); // EGYPTIAN HIEROGLYPH INSERT AT TOP START
    /// assert!(!'q'.is_format_control());
    /// ```
    #[must_use]
    #[inline]
    fn is_format_control(self) -> bool {
        self > '\u{AC}' && unicode::Cf(self)
    }

    /// Returns `true` if this `char` has been assigned a meaning by Unicode, as of
    /// [`UNICODE_VERSION`].
    ///
    /// [`UNICODE_VERSION`]: Self::UNICODE_VERSION
    ///
    /// 许多 Unicode 的[稳定性策略]仅适用于已分配的字符。
    ///
    /// [stability policies]: https://www.unicode.org/policies/stability_policy.html
    ///
    /// Currently unassigned characters (characters for which this method returns `false`)
    /// 除了那 66 个[非字符]，它们永远不会被赋予含义。
    /// except for the 66 [noncharacters] which will never be assigned a meaning.
    ///
    /// [noncharacters]: https://www.unicode.org/faq/private_use.html#noncharacters
    ///
    /// A character is considered assigned if it is present in [`UnicodeData.txt`].
    /// Unassigned characters have general category `Cn`, as [described] in Chapter 4
    /// （《字符属性》）《Unicode 标准》中有所规定。
    ///
    /// [`UnicodeData.txt`]: https://www.unicode.org/Public/UCD/latest/ucd/UnicodeData.txt
    /// [described]: https://www.unicode.org/versions/latest/core-spec/chapter-4/#G134153
    ///
    /// # 示例
    ///
    /// 基本用法：
    ///
    /// ```
    /// #![feature(char_unassigned_private_use)]
    /// assert!('γ'.is_assigned()); // once a character is assigned, it stays assigned forever
    /// assert!(!'\u{FFFE}'.is_assigned()); // noncharacter, will never be assigned
    ///
    /// // Not currently assigned, but may be in the future,
    /// // so we shouldn't rely on the current status
    /// /* assert!(!'\u{7AAAA}'.is_assigned()); */
    /// ```
    #[must_use]
    #[unstable(feature = "char_unassigned_private_use", issue = "158322")]
    #[inline]
    pub fn is_assigned(self) -> bool {
        match self {
            '\0'..='\u{377}' => true,
            '\u{378}'..='\u{3FFFD}' => !unicode::Cn_planes_0_3(self),
            // Assigned character ranges in planes 4 and above.
            // `src/tools/unicode-table-generator/src/main.rs` asserts that this is correct
            '\u{E0001}'
            | '\u{E0020}'..='\u{E007F}'
            | '\u{E0100}'..='\u{E01EF}'
            | '\u{F0000}'..='\u{FFFFD}'
            | '\u{100000}'..='\u{10FFFD}' => true,
            _ => false,
        }
    }

    /// Returns `true` if this `char` has the `Default_Ignorable_Code_Point` property.
    /// These characters [should be displayed as invisible in fallback rendering](https://www.unicode.org/faq/unsup_char#3).
    ///
    /// `Default_Ignorable_Code_Point` is [described] in Chapter 5 (Implementation Guidelines) of the Unicode Standard,
    /// and [specified] in the Unicode Character Database [`DerivedCoreProperties.txt`].
    ///
    /// [described]: https://www.unicode.org/versions/latest/core-spec/chapter-5/#G40120
    /// [specified]: https://www.unicode.org/reports/tr44/#Default_Ignorable_Code_Point
    /// [`DerivedCoreProperties.txt`]: https://www.unicode.org/Public/UCD/latest/ucd/DerivedCoreProperties.txt
    ///
    /// # 示例
    ///
    /// 基本用法：
    ///
    /// ```
    /// #![feature(default_ignorable)]
    /// assert!('\u{AD}'.is_default_ignorable()); // SOFT HYPHEN
    /// assert!('\u{115F}'.is_default_ignorable()); // HANGUL CHOSEONG FILLER
    /// assert!('\u{200B}'.is_default_ignorable()); // ZERO WIDTH SPACE
    /// assert!('\u{E0041}'.is_default_ignorable()); // TAG LATIN CAPITAL LETTER A
    /// assert!(!'۝'.is_default_ignorable()); // ARABIC END OF AYAH
    /// assert!(!'𓐲'.is_default_ignorable()); // EGYPTIAN HIEROGLYPH INSERT AT TOP START
    /// assert!(!' '.is_default_ignorable());
    /// assert!(!'\n'.is_default_ignorable());
    /// assert!(!'\0'.is_default_ignorable());
    /// assert!(!'q'.is_default_ignorable());
    /// ```
    #[must_use]
    #[unstable(feature = "default_ignorable", issue = "160583")]
    #[inline]
    pub fn is_default_ignorable(self) -> bool {
        self > '\u{AC}' && unicode::Default_Ignorable_Code_Point(self)
    }

    /// Returns `true` if this `char` has the `Grapheme_Extend` property.
    ///
    /// `Grapheme_Extend` is [described] in Chapter 3 (Conformance) of the Unicode Standard,
    /// and [specified] in the Unicode Character Database [`DerivedCoreProperties.txt`].
    ///
    /// [described]: https://www.unicode.org/versions/latest/core-spec/chapter-3/#G41165
    /// [specified]: https://www.unicode.org/reports/tr44/#Grapheme_Extend
    /// [`DerivedCoreProperties.txt`]: https://www.unicode.org/Public/UCD/latest/ucd/DerivedCoreProperties.txt
    #[must_use]
    #[inline]
    fn is_grapheme_extender(self) -> bool {
        self > '\u{02FF}' && unicode::Grapheme_Extend(self)
    }

    /// Returns `true` if this `char` has the `Case_Ignorable` property. This narrow-use property
    /// 用于实现希腊字母 sigma（大写 'Σ'）的上下文依赖大小写规则，
    /// 它有两种小写形式。
    ///
    /// `Case_Ignorable` is [described] in Chapter 3 (Conformance) of the Unicode Core Specification,
    /// and [specified] in the Unicode Character Database [`DerivedCoreProperties.txt`].
    /// See those resources, as well as [`to_lowercase()`]'s documentation, for more information.
    ///
    /// [described]: https://www.unicode.org/versions/latest/core-spec/chapter-3/#G63116
    /// [specified]: https://www.unicode.org/reports/tr44/#Case_Ignorable
    /// [`DerivedCoreProperties.txt`]: https://www.unicode.org/Public/UCD/latest/ucd/DerivedCoreProperties.txt
    /// [`to_lowercase()`]: Self::to_lowercase()
    ///
    /// # 示例
    ///
    /// 基本用法：
    ///
    /// ```
    /// assert!('.'.is_case_ignorable());
    /// assert!('\u{AD}'.is_case_ignorable()); // SOFT HYPHEN
    /// assert!('ʰ'.is_case_ignorable()); // MODIFIER LETTER SMALL H
    /// assert!('\u{0300}'.is_case_ignorable()); // COMBINING GRAVE ACCENT
    /// assert!('\u{0345}'.is_case_ignorable()); // COMBINING GREEK YPOGEGRAMMENI
    /// assert!(!'a'.is_case_ignorable());
    /// assert!(!' '.is_case_ignorable());
    /// assert!(!';'.is_case_ignorable());
    /// ```
    #[must_use]
    #[inline]
    #[stable(feature = "case_ignorable", since = "CURRENT_RUSTC_VERSION")]
    pub fn is_case_ignorable(self) -> bool {
        if self.is_ascii() {
            matches!(self, '\'' | '.' | ':' | '^' | '`')
        } else {
            unicode::Case_Ignorable(self)
        }
    }

    /// Returns an iterator that yields the lowercase mapping of this `char` as one or more
    /// `char`s.
    ///
    /// If this `char` does not have a lowercase mapping, the iterator yields the same `char`.
    ///
    /// If this `char` has a one-to-one lowercase mapping given by the [Unicode Character
    /// Database][ucd] [`UnicodeData.txt`], the iterator yields that `char`.
    ///
    /// [ucd]: https://www.unicode.org/reports/tr44/
    /// [`UnicodeData.txt`]: https://www.unicode.org/Public/UCD/latest/ucd/UnicodeData.txt
    ///
    /// If this `char` expands to multiple `char`s, the iterator yields the `char`s given by
    /// [`SpecialCasing.txt`]. The maximum number of `char`s in a case mapping is 3.
    ///
    /// 此操作执行无条件的映射，无需特定调整。即转换过程
    /// is independent of context and language. See [below](#notes-on-context-and-locale)
    /// 以获取更多信息。
    ///
    /// 在 [Unicode Standard] 第 4 章（字符属性）中讨论了大小写映射，
    /// 而第 3 章（一致性）中讨论了默认的大小写转换算法。
    ///
    /// [Unicode Standard]: https://www.unicode.org/versions/latest/
    ///
    /// # 示例
    ///
    /// 作为迭代器：
    ///
    /// ```
    /// for c in 'İ'.to_lowercase() {
    ///     print!("{c}");
    /// }
    /// println!();
    /// ```
    ///
    /// Using `println!` directly:
    ///
    /// ```
    /// println!("{}", 'İ'.to_lowercase());
    /// ```
    ///
    /// 两者等效于：
    ///
    /// ```
    /// println!("i\u{307}");
    /// ```
    ///
    /// Using [`to_string`](../std/string/trait.ToString.html#tymethod.to_string):
    ///
    /// ```
    /// assert_eq!('C'.to_lowercase().to_string(), "c");
    ///
    /// // Sometimes the result is more than one character:
    /// assert_eq!('İ'.to_lowercase().to_string(), "i\u{307}");
    ///
    /// // Characters that do not have both uppercase and lowercase
    /// // convert into themselves.
    /// assert_eq!('山'.to_lowercase().to_string(), "山");
    /// ```
    /// # 关于上下文和本地化注意事项
    ///
    /// 如前所述，该方法不考虑语言或上下文。
    /// 以下是不完全的情况列表，这些情况下可能适用此规则。
    /// 如果您需要在代码中处理与本地化相关的大小写，考虑使用
    /// an external crate, like [`icu_casemap`](https://crates.io/crates/icu_casemap)
    /// which is developed by Unicode.
    ///
    /// ## 希腊字母 sigma
    ///
    /// 在希腊语中，字母 sigma（大写 'Σ'）有两种小写形式：
    /// 'σ' which is used in most situations, and 'ς' which appears only
    /// at the end of a word. [`char::to_lowercase()`] always uses the first form:
    ///
    /// ```
    /// assert_eq!('Σ'.to_lowercase().to_string(), "σ");
    /// ```
    ///
    /// `str::to_lowercase()` (only available with the `alloc` crate)
    /// 因此如果可能，建议使用该方法。或者，您也可以自己实现
    /// so prefer using that method if you can. Alternatively, you can use
    /// [`is_cased()`] and [`is_case_ignorable()`] to implement it yourself.
    /// See `Final_Sigma` in [Table 3.17] of the Unicode Standard,
    /// along with [`SpecialCasing.txt`], for more details.
    ///
    /// [`is_cased()`]: Self::is_cased()
    /// [`is_case_ignorable()`]: Self::is_case_ignorable()
    /// [Table 3.17]: https://www.unicode.org/versions/latest/core-spec/chapter-3/#G54277
    ///
    /// ## 在土耳其语和阿塞拜疆语中，拉丁字母 'i' 有五种形式而非两种：
    ///
    /// * '无点形式'：I / ı，有时写作 ï
    ///
    /// * '带点形式'：İ / i
    /// 注意，大写无点的 'I' 与拉丁字母具有相同的代码点。因此：
    ///
    /// Note that the uppercase undotted 'I' is the same codepoint as the Latin. Therefore:
    ///
    /// ```
    /// let lower_i = 'I'.to_lowercase().to_string();
    /// ```
    ///
    /// `'I'`'s correct lowercase relies on the language of the text: if we're
    /// in `en-US`, it should be `"i"`, but if we're in `tr-TR` or `az-AZ`, it should
    /// be `"ı"`. `to_lowercase()` does not take this into account, and so:
    ///
    /// ```
    /// let lower_i = 'I'.to_lowercase().to_string();
    ///
    /// assert_eq!(lower_i, "i");
    /// ```
    ///
    /// holds across languages.
    ///
    /// [`SpecialCasing.txt`]: https://www.unicode.org/Public/UCD/latest/ucd/SpecialCasing.txt
    #[must_use = "this returns the lowercased character as a new iterator, \
                  without modifying the original"]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    pub fn to_lowercase(self) -> ToLowercase {
        ToLowercase(CaseMappingIter::new(conversions::to_lower(self)))
    }

    /// Returns an iterator that yields the titlecase mapping of this `char` as one or more
    /// `char`s.
    ///
    /// This is usually, but not always, equivalent to the uppercase mapping
    /// returned by [`to_uppercase()`]. Prefer this method when seeking to capitalize
    /// Only The First Letter of a word, but use [`to_uppercase()`] for ALL CAPS.
    /// See [below](#difference-from-uppercase) for a thorough explanation
    /// 关于这两种方法之间的区别。
    ///
    /// If this `char` does not have a titlecase mapping, the iterator yields the same `char`.
    ///
    /// If this `char` has a one-to-one titlecase mapping given by the [Unicode Character
    /// Database][ucd] [`UnicodeData.txt`], the iterator yields that `char`.
    ///
    /// [ucd]: https://www.unicode.org/reports/tr44/
    /// [`UnicodeData.txt`]: https://www.unicode.org/Public/UCD/latest/ucd/UnicodeData.txt
    ///
    /// If this `char` expands to multiple `char`s, the iterator yields the `char`s given by
    /// [`SpecialCasing.txt`]. The maximum number of `char`s in a case mapping is 3.
    ///
    /// [`SpecialCasing.txt`]: https://www.unicode.org/Public/UCD/latest/ucd/SpecialCasing.txt
    ///
    /// 此操作执行无条件映射，无需特定调整。即转换过程
    /// is independent of context and language. See [below](#note-on-locale)
    /// 。
    ///
    /// 在 [Unicode Standard] 第 4 章（字符属性）中讨论了标题大小写映射，
    /// 而在第 3 章（一致性）中讨论了默认的大小写转换算法。
    ///
    /// [Unicode Standard]: https://www.unicode.org/versions/latest/
    ///
    /// # 示例
    ///
    /// 作为迭代器：
    ///
    /// ```
    /// for c in 'ß'.to_titlecase() {
    ///     print!("{c}");
    /// }
    /// println!();
    /// ```
    ///
    /// Using `println!` directly:
    ///
    /// ```
    /// println!("{}", 'ß'.to_titlecase());
    /// ```
    ///
    /// 两者均等同于：
    ///
    /// ```
    /// println!("Ss");
    /// ```
    ///
    /// Using [`to_string`](../std/string/trait.ToString.html#tymethod.to_string):
    ///
    /// ```
    /// assert_eq!('c'.to_titlecase().to_string(), "C");
    /// assert_eq!('ა'.to_titlecase().to_string(), "ა");
    /// assert_eq!('ǆ'.to_titlecase().to_string(), "ǅ");
    /// assert_eq!('ᾨ'.to_titlecase().to_string(), "ᾨ");
    ///
    /// // Sometimes the result is more than one character:
    /// assert_eq!('ß'.to_titlecase().to_string(), "Ss");
    ///
    /// // Characters that do not have separate cased forms
    /// // convert into themselves.
    /// assert_eq!('山'.to_titlecase().to_string(), "山");
    /// ```
    ///
    /// # 与大写的区别
    ///
    /// Currently, there are three classes of characters where [`to_uppercase()`]
    /// and `to_titlecase()` give different results:
    ///
    /// ## 格鲁吉亚文字
    ///
    /// 现代格鲁吉亚字母中的每个字母都可以以两种形式之一书写：
    /// 典型的类似小写的“mkhedruli”形式，以及一种类似大写的变体“mtavruli”
    /// 形式。然而，与大多数有大小写要求的文字体系中的大写不同，mtavruli 通常不用于
    /// 开始句子、表示专有名词或任何其他用途。
    /// 在连续文本中。它仅限于标题和 headings，这些内容完全以
    /// in mtavruli. For this reason, [`to_uppercase()`] applied to a Georgian letter
    /// will return the mtavruli form, but `to_titlecase()` will return the mkhedruli form.
    ///
    /// ```
    /// let ani = 'ა'; // First letter of the Georgian alphabet, in mkhedruli form
    ///
    /// // Titlecasing mkhedruli maps it to itself...
    /// assert_eq!(ani.to_titlecase().to_string(), ani.to_string());
    ///
    /// // but uppercasing it maps it to mtavruli
    /// assert_eq!(ani.to_uppercase().to_string(), "Ა");
    /// ```
    ///
    /// ## 拉丁字母塞尔维亚-克罗地亚语的兼容双字符
    ///
    /// 塞尔维亚-克罗地亚语的标准拉丁字母表
    /// （波斯尼亚语、克罗地亚语、黑山语和塞尔维亚语）包含
    /// 三个双字符：Dž, Lj 和 Nj。这些通常表示为
    /// 两个字符。然而，为了与旧字符集兼容，
    /// Unicode 包含了这些双字符的单字符版本。
    /// 每个双字符都有大写、标题大小和小写形式：
    ///
    /// - `'Ǆ'`, `'ǅ'`, `'ǆ'`
    /// - `'Ǉ'`, `'ǈ'`, `'ǉ'`
    /// - `'Ǌ'`, `'ǋ'`, `'ǌ'`
    ///
    /// Unicode 还为 Dz 双字符编码了大小写三元组。
    /// without the caron: `'Ǳ'`, `'ǲ'`, `'ǳ'`.
    ///
    /// ## 下标希腊元音
    ///
    /// 在古希腊语中，长元音 alpha (α)、eta (η) 和 omega (ω)
    /// 有时会跟随一个 iota (ι)，形成双元音。随着时间的推移，
    /// 双元音发音逐渐消失，iota 也变成了无声字母。
    /// 最终，ι 在拼写中也消失了。
    /// 然而，仍然需要以忠实的方式呈现古代文本。
    ///
    /// 现代古希腊语文本版本通常使用缩小的
    /// ι 符号来表示无声 iota，以将其与 ι 区分开。
    /// 后者继续影响发音。具体标准因出版物的不同而异。有些将无声 ι 放在其对应的
    /// 元音下方（下标），而另一些则将其放在元音右侧（上标）。
    /// 无声 ι 符号与大小写组合的方式也各不相同。
    /// 无声 ι 符号与大小写的组合方式也有所不同。
    ///
    /// Unicode 标准在默认大小写规则中，选择将带有下标 iota 的
    /// Greek vowels with iota subscipt (e.g. `'ᾠ'`) titlecase to the uppercase vowel
    /// with iota subscript (`'ᾨ'`) but uppercase to the uppercase vowel followed by
    /// full-size uppercase iota (`"ὨΙ"`). This is just one convention among many
    /// 因此，该方法也遵循这一规则。
    /// 所以该方法的行为也符合这一规则。
    ///
    /// # 关于区域设置说明
    ///
    /// 如上所述，该方法不依赖区域设置。
    /// 如果需要区域设置支持，可以考虑使用外部 crate，
    /// like [`icu_casemap`](https://crates.io/crates/icu_casemap)
    /// 由 Unicode 开发。其中一个常见的
    /// 依赖区域设置的大小写问题如下（还有其他问题）：
    ///
    /// 在土耳其语和阿塞拜疆语中，拉丁字母中的 'i' 有五种形式而非两种：
    ///
    /// * ‘无点形式’：I / ı，有时写作 ï
    /// * ‘带点形式’：İ / i
    ///
    /// 请注意，小写的带点 'i' 与拉丁字母的编码点相同。因此：
    ///
    /// ```
    /// let upper_i = 'i'.to_titlecase().to_string();
    /// ```
    ///
    /// `'i'`'s correct titlecase relies on the language of the text: if we're
    /// in `en-US`, it should be `"I"`, but if we're in `tr-TR` or `az-AZ`, it should
    /// be `"İ"`. `to_titlecase()` does not take this into account, and so:
    ///
    /// ```
    /// let upper_i = 'i'.to_titlecase().to_string();
    ///
    /// assert_eq!(upper_i, "I");
    /// ```
    ///
    /// 在不同语言间保持一致性。
    ///
    /// [`to_uppercase()`]: Self::to_uppercase()
    #[must_use = "this returns the titlecased character as a new iterator, \
                  without modifying the original"]
    #[stable(feature = "titlecase", since = "CURRENT_RUSTC_VERSION")]
    #[inline]
    pub fn to_titlecase(self) -> ToTitlecase {
        ToTitlecase(CaseMappingIter::new(conversions::to_title(self)))
    }

    /// Returns an iterator that yields the uppercase mapping of this `char` as one or more
    /// `char`s.
    ///
    /// Prefer this method when converting a word into ALL CAPS, but consider [`to_titlecase()`]
    /// 方法。请参考该方法的文档。
    /// 有关两者差异的更多信息，请参见……
    ///
    /// If this `char` does not have an uppercase mapping, the iterator yields the same `char`.
    ///
    /// If this `char` has a one-to-one uppercase mapping given by the [Unicode Character
    /// Database][ucd] [`UnicodeData.txt`], the iterator yields that `char`.
    ///
    /// [ucd]: https://www.unicode.org/reports/tr44/
    /// [`UnicodeData.txt`]: https://www.unicode.org/Public/UCD/latest/ucd/UnicodeData.txt
    ///
    /// If this `char` expands to multiple `char`s, the iterator yields the `char`s given by
    /// [`SpecialCasing.txt`]. The maximum number of `char`s in a case mapping is 3.
    ///
    /// [`SpecialCasing.txt`]: https://www.unicode.org/Public/UCD/latest/ucd/SpecialCasing.txt
    ///
    /// 此操作执行无条件映射，无需特定调整。也就是说，转换过程与上下文和语言无关。详见……
    /// is independent of context and language. See [below](#note-on-locale)
    /// for more information.
    ///
    /// 在 [Unicode Standard] 的第 4 章（字符属性）中讨论了通用案例映射，第 3 章（一致性）中讨论了默认案例转换算法。
    /// # 示例
    ///
    /// [Unicode Standard]: https://www.unicode.org/versions/latest/
    ///
    /// # Examples
    ///
    /// `'ﬅ'` (U+FB05) is a single Unicode code point (a ligature) that maps to "ST" in uppercase.
    ///
    /// As an iterator:
    ///
    /// ```
    /// for c in 'ﬅ'.to_uppercase() {
    ///     print!("{c}");
    /// }
    /// println!();
    /// ```
    ///
    /// Using `println!` directly:
    ///
    /// ```
    /// println!("{}", 'ﬅ'.to_uppercase());
    /// ```
    ///
    /// 两者等效于：
    ///
    /// ```
    /// println!("ST");
    /// ```
    ///
    /// Using [`to_string`](../std/string/trait.ToString.html#tymethod.to_string):
    ///
    /// ```
    /// assert_eq!('c'.to_uppercase().to_string(), "C");
    /// assert_eq!('ა'.to_uppercase().to_string(), "Ა");
    /// assert_eq!('ǆ'.to_uppercase().to_string(), "Ǆ");
    ///
    /// // Sometimes the result is more than one character:
    /// assert_eq!('ﬅ'.to_uppercase().to_string(), "ST");
    /// assert_eq!('ᾨ'.to_uppercase().to_string(), "ὨΙ");
    ///
    /// // Characters that do not have both uppercase and lowercase
    /// // convert into themselves.
    /// assert_eq!('山'.to_uppercase().to_string(), "山");
    /// ```
    ///
    /// # 关于区域设置注意事项
    ///
    /// 如上所述，该方法对区域设置不敏感。
    /// 如果需要区域设置支持，可以考虑使用外部 crate，
    /// like [`icu_casemap`](https://crates.io/crates/icu_casemap)
    /// 与区域设置相关的大小写问题如下（还有其他问题）：
    /// 在土耳其和阿塞拜疆语中，拉丁字母中的 'i' 有五种形式而非两种：
    ///
    /// * ‘无点形式’：I / ı，有时写作 ï
    ///
    /// * ‘带点形式’：İ / i
    /// 请注意，小写的带点 'i' 与拉丁字母具有相同的代码点。因此：
    ///
    /// Note that the lowercase dotted 'i' is the same codepoint as the Latin. Therefore:
    ///
    /// ```
    /// let upper_i = 'i'.to_uppercase().to_string();
    /// ```
    ///
    /// `'i'`'s correct uppercase relies on the language of the text: if we're
    /// in `en-US`, it should be `"I"`, but if we're in `tr-TR` or `az-AZ`, it should
    /// be `"İ"`. `to_uppercase()` does not take this into account, and so:
    ///
    /// ```
    /// let upper_i = 'i'.to_uppercase().to_string();
    ///
    /// assert_eq!(upper_i, "I");
    /// ```
    ///
    /// 通常不应直接向用户暴露已进行大小写折叠的字符串。对于大多数字符，
    ///
    /// [`to_titlecase()`]: Self::to_titlecase()
    #[must_use = "this returns the uppercased character as a new iterator, \
                  without modifying the original"]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    pub fn to_uppercase(self) -> ToUppercase {
        ToUppercase(CaseMappingIter::new(conversions::to_upper(self)))
    }

    /// Returns an iterator that yields the case folding of this `char` as one or more
    /// `char`s.
    ///
    /// 大小写折叠意在用于执行不区分大小写的字符串比较时。
    /// 已进行大小写折叠的字符串通常不应直接暴露给用户。对于大多数字符，
    /// 但并非所有字符，大小写折叠映射与小写映射相同。
    ///
    /// This iterator yields the `char`(s) in the common or full case folding for this `char`,
    /// as given by the [Unicode Character Database][ucd] [`CaseFolding.txt`].
    /// The maximum number of `char`s in a case folding is 3.
    ///
    /// [ucd]: https://www.unicode.org/reports/tr44/
    /// [`CaseFolding.txt`]: https://www.unicode.org/Public/UCD/latest/ucd/CaseFolding.txt
    ///
    ///
    /// 没有进行[标准化]（例如NFC），因此视觉和语义上相同的字符可能有不同的大小写转换结果。
    /// might still casefold differently. For example, `'ά'` (U+03AC GREEK SMALL LETTER ALPHA WITH TONOS)
    /// is considered distinct from `'ά'` (U+1F71 GREEK SMALL LETTER ALPHA WITH OXIA),
    /// 尽管Unicode认为它们是等价字符。
    ///
    /// 此外，这种方法与语言/区域设置无关。
    /// 因此，土耳其语和阿塞拜疆语中I/ı/İ/i的特殊行为未被处理。
    ///
    /// 在[Unicode标准]的第4章（字符属性）中讨论了通用大小写转换，第3章（一致性）中讨论了默认的大小写转换算法。
    /// # 示例
    ///
    /// [Unicode Standard]: https://www.unicode.org/versions/latest/
    ///
    /// # Examples
    ///
    /// The German sharp S `'ß'` (U+DF) is a single Unicode code point
    /// that casefolds to `"ss"`. Its uppercase variant '`ẞ`' (U+1E9E)
    /// 在土耳其语和阿塞拜疆语中，拉丁字母中的‘i’有五种形式而非两种：
    ///
    /// * ‘无点形式’：I / ı，有时写作ï
    ///
    /// ```
    /// #![feature(casefold)]
    /// assert!('ß'.to_casefold_unnormalized().eq(['s', 's']));
    /// assert!('ẞ'.to_casefold_unnormalized().eq(['s', 's']));
    /// ```
    ///
    /// Using [`to_string`](../std/string/trait.ToString.html#tymethod.to_string):
    ///
    /// ```
    /// #![feature(casefold)]
    /// assert_eq!('ß'.to_casefold_unnormalized().to_string(), "ss");
    /// assert_eq!('ẞ'.to_casefold_unnormalized().to_string(), "ss");
    /// ```
    ///
    /// 作为迭代器使用时：
    ///
    /// ```rust
    /// #![feature(casefold)]
    /// // These two characters are visually and semantically identical;
    /// // Unicode considers them to be canonically equivalent.
    /// let alpha_tonos = 'ά';
    /// let alpha_oxia = 'ά';
    ///
    /// // However, they are different codepoints:
    /// assert_eq!(alpha_tonos, '\u{03AC}');
    /// assert_eq!(alpha_oxia, '\u{1F71}');
    ///
    /// // Their case-foldings are likewise unequal:
    /// assert!(alpha_tonos.to_casefold_unnormalized().eq(['\u{03AC}']));
    /// assert!(alpha_oxia.to_casefold_unnormalized().eq(['\u{1F71}']));
    /// ```
    ///
    /// # 关于区域设置的说明
    ///
    /// 在土耳其语和阿塞拜疆语中，‘i’的等价形式有五种而非两种：
    ///
    /// * ‘无点形式’：I / ı，有时写作ï
    /// * ‘带点形式’：İ / i
    ///
    /// 请注意，大写无点形式的‘I’与拉丁字母具有相同的代码点。因此：
    ///
    /// ```
    /// #![feature(casefold)]
    /// let casefold_i = 'I'.to_casefold_unnormalized().to_string();
    /// ```
    ///
    /// `'I'`'s correct case folding relies on the language of the text: if we're
    /// in `en-US`, it should be `"i"`, but if we're in `tr-TR` or `az-AZ`, it should
    /// be `"ı"`. `to_casefold_unnormalized()` does not take this into account, and so:
    ///
    /// ```
    /// #![feature(casefold)]
    /// let casefold_i = 'I'.to_casefold_unnormalized().to_string();
    ///
    /// assert_eq!(casefold_i, "i");
    /// ```
    ///
    /// # 示例
    ///
    /// [normalization]: https://www.unicode.org/faq/normalization.html
    #[must_use = "this returns the case-folded character as a new iterator, \
                  without modifying the original"]
    #[unstable(feature = "casefold", issue = "157000")]
    #[inline]
    pub fn to_casefold_unnormalized(self) -> ToCasefold {
        ToCasefold(CaseMappingIter::new(conversions::to_casefold(self)))
    }

    /// Returns the code point value as a `u32`.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(char_to_u32)]
    ///
    /// let ascii = 'a';
    /// let heart = '❤';
    ///
    /// assert_eq!(ascii.to_u32(), 97_u32);
    /// assert_eq!(heart.to_u32(), 0x2764_u32);
    /// ```
    #[must_use = "this returns the result of the operation, \
                  without modifying the original"]
    #[unstable(feature = "char_to_u32", issue = "158938")]
    #[rustc_const_unstable(feature = "char_to_u32", issue = "158938")]
    #[inline(always)]
    pub const fn to_u32(self) -> u32 {
        self as u32
    }

    /// 检查该值是否在ASCII范围内。
    ///
    /// # 示例
    ///
    /// ```
    /// let ascii = 'a';
    /// let non_ascii = '❤';
    ///
    /// assert!(ascii.is_ascii());
    /// assert!(!non_ascii.is_ascii());
    /// ```
    #[must_use]
    #[stable(feature = "ascii_methods_on_intrinsics", since = "1.23.0")]
    #[rustc_const_stable(feature = "const_char_is_ascii", since = "1.32.0")]
    #[rustc_diagnostic_item = "char_is_ascii"]
    #[inline]
    pub const fn is_ascii(&self) -> bool {
        *self as u32 <= 0x7F
    }

    /// Returns `Some` if the value is within the ASCII range,
    /// or `None` if it's not.
    ///
    /// This is preferred to [`Self::is_ascii`] when you're passing the value
    /// along to something else that can take [`ascii::Char`] rather than
    /// needing to check again for itself whether the value is in ASCII.
    #[must_use]
    #[unstable(feature = "ascii_char", issue = "110998")]
    #[inline]
    pub const fn as_ascii(&self) -> Option<ascii::Char> {
        if self.is_ascii() {
            // SAFETY: Just checked that this is ASCII.
            Some(unsafe { ascii::Char::from_u8_unchecked(*self as u8) })
        } else {
            None
        }
    }

    /// Converts this char into an [ASCII character](`ascii::Char`), without
    /// 检查其有效性。
    ///
    /// # 安全性
    ///
    /// 该字符必须属于ASCII范围，否则会导致UB错误。
    #[must_use]
    #[unstable(feature = "ascii_char", issue = "110998")]
    #[inline]
    pub const unsafe fn as_ascii_unchecked(&self) -> ascii::Char {
        assert_unsafe_precondition!(
            check_library_ub,
            "as_ascii_unchecked requires that the char is valid ASCII",
            (it: &char = self) => it.is_ascii()
        );

        // SAFETY: the caller promised that this char is ASCII.
        unsafe { ascii::Char::from_u8_unchecked(*self as u8) }
    }

    /// 复制值及其ASCII大写等价形式。
    ///
    /// ASCII字母‘a’到‘z’被映射为‘A’到‘Z’，
    /// 但非ASCII字母保持不变。
    ///
    /// To uppercase the value in-place, use [`make_ascii_uppercase()`].
    ///
    /// 要同时将ASCII字符和非ASCII字符大写，请使用
    /// [`to_uppercase()`].
    ///
    /// # 示例
    ///
    /// ```
    /// let ascii = 'a';
    /// let non_ascii = '❤';
    ///
    /// assert_eq!('A', ascii.to_ascii_uppercase());
    /// assert_eq!('❤', non_ascii.to_ascii_uppercase());
    /// ```
    ///
    /// [`make_ascii_uppercase()`]: #method.make_ascii_uppercase
    /// [`to_uppercase()`]: #method.to_uppercase
    #[must_use = "to uppercase the value in-place, use `make_ascii_uppercase()`"]
    #[stable(feature = "ascii_methods_on_intrinsics", since = "1.23.0")]
    #[rustc_const_stable(feature = "const_ascii_methods_on_intrinsics", since = "1.52.0")]
    #[inline]
    pub const fn to_ascii_uppercase(&self) -> char {
        if self.is_ascii_lowercase() {
            (*self as u8).ascii_change_case_unchecked() as char
        } else {
            *self
        }
    }

    /// 复制值及其ASCII小写等价形式。
    ///
    /// ASCII 字母 'A' 到 'Z' 会被映射为 'a' 到 'z'，
    /// 但非 ASCII 字母保持不变。
    ///
    /// To lowercase the value in-place, use [`make_ascii_lowercase()`].
    ///
    /// 若需将 ASCII 字符和非 ASCII 字符都转换为小写，请使用
    /// [`to_lowercase()`].
    ///
    /// # 示例
    ///
    /// ```
    /// let ascii = 'A';
    /// let non_ascii = '❤';
    ///
    /// assert_eq!('a', ascii.to_ascii_lowercase());
    /// assert_eq!('❤', non_ascii.to_ascii_lowercase());
    /// ```
    ///
    /// [`make_ascii_lowercase()`]: #method.make_ascii_lowercase
    /// [`to_lowercase()`]: #method.to_lowercase
    #[must_use = "to lowercase the value in-place, use `make_ascii_lowercase()`"]
    #[stable(feature = "ascii_methods_on_intrinsics", since = "1.23.0")]
    #[rustc_const_stable(feature = "const_ascii_methods_on_intrinsics", since = "1.52.0")]
    #[inline]
    pub const fn to_ascii_lowercase(&self) -> char {
        if self.is_ascii_uppercase() {
            (*self as u8).ascii_change_case_unchecked() as char
        } else {
            *self
        }
    }

    /// 检查两个值是否为不区分大小写的 ASCII 匹配。
    ///
    /// Equivalent to <code>[to_ascii_lowercase]\(a) == [to_ascii_lowercase]\(b)</code>.
    ///
    /// # 示例
    ///
    /// ```
    /// let upper_a = 'A';
    /// let lower_a = 'a';
    /// let lower_z = 'z';
    ///
    /// assert!(upper_a.eq_ignore_ascii_case(&lower_a));
    /// assert!(upper_a.eq_ignore_ascii_case(&upper_a));
    /// assert!(!upper_a.eq_ignore_ascii_case(&lower_z));
    /// ```
    ///
    /// [to_ascii_lowercase]: #method.to_ascii_lowercase
    #[stable(feature = "ascii_methods_on_intrinsics", since = "1.23.0")]
    #[rustc_const_stable(feature = "const_ascii_methods_on_intrinsics", since = "1.52.0")]
    #[expect(clippy::manual_ignore_case_cmp, reason = "implements eq_ignore_ascii_case")]
    #[inline]
    pub const fn eq_ignore_ascii_case(&self, other: &char) -> bool {
        self.to_ascii_lowercase() == other.to_ascii_lowercase()
    }

    /// 就地将此类型转换为其 ASCII 大写等价形式。
    ///
    /// ASCII 字母 'a' 到 'z' 会被映射为 'A' 到 'Z'，
    /// 但非 ASCII 字母保持不变。
    ///
    /// 若需返回新的大写值而不修改现有值，请使用
    /// [`to_ascii_uppercase()`].
    ///
    /// # 示例
    ///
    /// ```
    /// let mut ascii = 'a';
    ///
    /// ascii.make_ascii_uppercase();
    ///
    /// assert_eq!('A', ascii);
    /// ```
    ///
    /// [`to_ascii_uppercase()`]: #method.to_ascii_uppercase
    #[stable(feature = "ascii_methods_on_intrinsics", since = "1.23.0")]
    #[rustc_const_stable(feature = "const_make_ascii", since = "1.84.0")]
    #[inline]
    pub const fn make_ascii_uppercase(&mut self) {
        *self = self.to_ascii_uppercase();
    }

    /// 就地将此类型转换为其 ASCII 小写等价形式。
    ///
    /// ASCII 字母 'A' 到 'Z' 会被映射为 'a' 到 'z'，
    /// 但非 ASCII 字母保持不变。
    ///
    /// 若需返回新的小写值而不修改现有值，请使用
    /// [`to_ascii_lowercase()`].
    ///
    /// # 示例
    ///
    /// ```
    /// let mut ascii = 'A';
    ///
    /// ascii.make_ascii_lowercase();
    ///
    /// assert_eq!('a', ascii);
    /// ```
    ///
    /// [`to_ascii_lowercase()`]: #method.to_ascii_lowercase
    #[stable(feature = "ascii_methods_on_intrinsics", since = "1.23.0")]
    #[rustc_const_stable(feature = "const_make_ascii", since = "1.84.0")]
    #[inline]
    pub const fn make_ascii_lowercase(&mut self) {
        *self = self.to_ascii_lowercase();
    }

    /// 检查值是否为 ASCII 字母字符：
    ///
    /// - U+0041 'A' ..= U+005A 'Z', or
    /// - U+0061 'a' ..= U+007A 'z'.
    ///
    /// # 示例
    ///
    /// ```
    /// let uppercase_a = 'A';
    /// let uppercase_g = 'G';
    /// let a = 'a';
    /// let g = 'g';
    /// let zero = '0';
    /// let percent = '%';
    /// let space = ' ';
    /// let lf = '\n';
    /// let esc = '\x1b';
    ///
    /// assert!(uppercase_a.is_ascii_alphabetic());
    /// assert!(uppercase_g.is_ascii_alphabetic());
    /// assert!(a.is_ascii_alphabetic());
    /// assert!(g.is_ascii_alphabetic());
    /// assert!(!zero.is_ascii_alphabetic());
    /// assert!(!percent.is_ascii_alphabetic());
    /// assert!(!space.is_ascii_alphabetic());
    /// assert!(!lf.is_ascii_alphabetic());
    /// assert!(!esc.is_ascii_alphabetic());
    /// ```
    #[must_use]
    #[stable(feature = "ascii_ctype_on_intrinsics", since = "1.24.0")]
    #[rustc_const_stable(feature = "const_ascii_ctype_on_intrinsics", since = "1.47.0")]
    #[inline]
    pub const fn is_ascii_alphabetic(&self) -> bool {
        matches!(*self, 'a'..='z' | 'A'..='Z')
    }

    /// 检查值是否为 ASCII 大写字符：
    /// U+0041 'A' ..= U+005A 'Z'.
    ///
    /// # 示例
    ///
    /// ```
    /// let uppercase_a = 'A';
    /// let uppercase_g = 'G';
    /// let a = 'a';
    /// let g = 'g';
    /// let zero = '0';
    /// let percent = '%';
    /// let space = ' ';
    /// let lf = '\n';
    /// let esc = '\x1b';
    ///
    /// assert!(uppercase_a.is_ascii_uppercase());
    /// assert!(uppercase_g.is_ascii_uppercase());
    /// assert!(!a.is_ascii_uppercase());
    /// assert!(!g.is_ascii_uppercase());
    /// assert!(!zero.is_ascii_uppercase());
    /// assert!(!percent.is_ascii_uppercase());
    /// assert!(!space.is_ascii_uppercase());
    /// assert!(!lf.is_ascii_uppercase());
    /// assert!(!esc.is_ascii_uppercase());
    /// ```
    #[must_use]
    #[stable(feature = "ascii_ctype_on_intrinsics", since = "1.24.0")]
    #[rustc_const_stable(feature = "const_ascii_ctype_on_intrinsics", since = "1.47.0")]
    #[inline]
    pub const fn is_ascii_uppercase(&self) -> bool {
        matches!(*self, 'A'..='Z')
    }

    /// 检查值是否为 ASCII 小写字符：
    /// U+0061 'a' ..= U+007A 'z'.
    ///
    /// # 示例
    ///
    /// ```
    /// let uppercase_a = 'A';
    /// let uppercase_g = 'G';
    /// let a = 'a';
    /// let g = 'g';
    /// let zero = '0';
    /// let percent = '%';
    /// let space = ' ';
    /// let lf = '\n';
    /// let esc = '\x1b';
    ///
    /// assert!(!uppercase_a.is_ascii_lowercase());
    /// assert!(!uppercase_g.is_ascii_lowercase());
    /// assert!(a.is_ascii_lowercase());
    /// assert!(g.is_ascii_lowercase());
    /// assert!(!zero.is_ascii_lowercase());
    /// assert!(!percent.is_ascii_lowercase());
    /// assert!(!space.is_ascii_lowercase());
    /// assert!(!lf.is_ascii_lowercase());
    /// assert!(!esc.is_ascii_lowercase());
    /// ```
    #[must_use]
    #[stable(feature = "ascii_ctype_on_intrinsics", since = "1.24.0")]
    #[rustc_const_stable(feature = "const_ascii_ctype_on_intrinsics", since = "1.47.0")]
    #[inline]
    pub const fn is_ascii_lowercase(&self) -> bool {
        matches!(*self, 'a'..='z')
    }

    /// 检查值是否为 ASCII 数字字符：
    ///
    /// - U+0041 'A' ..= U+005A 'Z', or
    /// - U+0061 'a' ..= U+007A 'z', or
    /// - U+0030 '0' ..= U+0039 '9'.
    ///
    /// # 示例
    ///
    /// ```
    /// let uppercase_a = 'A';
    /// let uppercase_g = 'G';
    /// let a = 'a';
    /// let g = 'g';
    /// let zero = '0';
    /// let percent = '%';
    /// let space = ' ';
    /// let lf = '\n';
    /// let esc = '\x1b';
    ///
    /// assert!(uppercase_a.is_ascii_alphanumeric());
    /// assert!(uppercase_g.is_ascii_alphanumeric());
    /// assert!(a.is_ascii_alphanumeric());
    /// assert!(g.is_ascii_alphanumeric());
    /// assert!(zero.is_ascii_alphanumeric());
    /// assert!(!percent.is_ascii_alphanumeric());
    /// assert!(!space.is_ascii_alphanumeric());
    /// assert!(!lf.is_ascii_alphanumeric());
    /// assert!(!esc.is_ascii_alphanumeric());
    /// ```
    #[must_use]
    #[stable(feature = "ascii_ctype_on_intrinsics", since = "1.24.0")]
    #[rustc_const_stable(feature = "const_ascii_ctype_on_intrinsics", since = "1.47.0")]
    #[inline]
    pub const fn is_ascii_alphanumeric(&self) -> bool {
        matches!(*self, '0'..='9') | matches!(*self, 'A'..='Z') | matches!(*self, 'a'..='z')
    }

    /// 检查值是否为 ASCII 十进制数字：
    /// U+0030 '0' ..= U+0039 '9'.
    ///
    /// # 示例
    ///
    /// ```
    /// let uppercase_a = 'A';
    /// let uppercase_g = 'G';
    /// let a = 'a';
    /// let g = 'g';
    /// let zero = '0';
    /// let percent = '%';
    /// let space = ' ';
    /// let lf = '\n';
    /// let esc = '\x1b';
    ///
    /// assert!(!uppercase_a.is_ascii_digit());
    /// assert!(!uppercase_g.is_ascii_digit());
    /// assert!(!a.is_ascii_digit());
    /// assert!(!g.is_ascii_digit());
    /// assert!(zero.is_ascii_digit());
    /// assert!(!percent.is_ascii_digit());
    /// assert!(!space.is_ascii_digit());
    /// assert!(!lf.is_ascii_digit());
    /// assert!(!esc.is_ascii_digit());
    /// ```
    #[must_use]
    #[stable(feature = "ascii_ctype_on_intrinsics", since = "1.24.0")]
    #[rustc_const_stable(feature = "const_ascii_ctype_on_intrinsics", since = "1.47.0")]
    #[inline]
    pub const fn is_ascii_digit(&self) -> bool {
        matches!(*self, '0'..='9')
    }

    /// 检查值是否为 ASCII 八进制数字：
    /// U+0030 '0' ..= U+0037 '7'.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(is_ascii_octdigit)]
    ///
    /// let uppercase_a = 'A';
    /// let a = 'a';
    /// let zero = '0';
    /// let seven = '7';
    /// let nine = '9';
    /// let percent = '%';
    /// let lf = '\n';
    ///
    /// assert!(!uppercase_a.is_ascii_octdigit());
    /// assert!(!a.is_ascii_octdigit());
    /// assert!(zero.is_ascii_octdigit());
    /// assert!(seven.is_ascii_octdigit());
    /// assert!(!nine.is_ascii_octdigit());
    /// assert!(!percent.is_ascii_octdigit());
    /// assert!(!lf.is_ascii_octdigit());
    /// ```
    #[must_use]
    #[unstable(feature = "is_ascii_octdigit", issue = "101288")]
    #[inline]
    pub const fn is_ascii_octdigit(&self) -> bool {
        matches!(*self, '0'..='7')
    }

    /// 检查值是否为 ASCII 十六进制数字：
    ///
    /// - U+0030 '0' ..= U+0039 '9', or
    /// - U+0041 'A' ..= U+0046 'F', or
    /// - U+0061 'a' ..= U+0066 'f'.
    ///
    /// # 示例
    ///
    /// ```
    /// let uppercase_a = 'A';
    /// let uppercase_g = 'G';
    /// let a = 'a';
    /// let g = 'g';
    /// let zero = '0';
    /// let percent = '%';
    /// let space = ' ';
    /// let lf = '\n';
    /// let esc = '\x1b';
    ///
    /// assert!(uppercase_a.is_ascii_hexdigit());
    /// assert!(!uppercase_g.is_ascii_hexdigit());
    /// assert!(a.is_ascii_hexdigit());
    /// assert!(!g.is_ascii_hexdigit());
    /// assert!(zero.is_ascii_hexdigit());
    /// assert!(!percent.is_ascii_hexdigit());
    /// assert!(!space.is_ascii_hexdigit());
    /// assert!(!lf.is_ascii_hexdigit());
    /// assert!(!esc.is_ascii_hexdigit());
    /// ```
    #[must_use]
    #[stable(feature = "ascii_ctype_on_intrinsics", since = "1.24.0")]
    #[rustc_const_stable(feature = "const_ascii_ctype_on_intrinsics", since = "1.47.0")]
    #[inline]
    pub const fn is_ascii_hexdigit(&self) -> bool {
        matches!(*self, '0'..='9') | matches!(*self, 'A'..='F') | matches!(*self, 'a'..='f')
    }

    /// 检查值是否为 ASCII 标点符号或符号字符
    /// （即非数字、非空白或控制字符）：
    ///
    /// - U+0021 ..= U+002F `! " # $ % & ' ( ) * + , - . /`, or
    /// - U+003A ..= U+0040 `: ; < = > ? @`, or
    /// - U+005B ..= U+0060 ``[ \ ] ^ _ ` ``, or
    /// - U+007B ..= U+007E `{ | } ~`
    ///
    /// # 示例
    ///
    /// ```
    /// let uppercase_a = 'A';
    /// let uppercase_g = 'G';
    /// let a = 'a';
    /// let g = 'g';
    /// let zero = '0';
    /// let percent = '%';
    /// let space = ' ';
    /// let lf = '\n';
    /// let esc = '\x1b';
    ///
    /// assert!(!uppercase_a.is_ascii_punctuation());
    /// assert!(!uppercase_g.is_ascii_punctuation());
    /// assert!(!a.is_ascii_punctuation());
    /// assert!(!g.is_ascii_punctuation());
    /// assert!(!zero.is_ascii_punctuation());
    /// assert!(percent.is_ascii_punctuation());
    /// assert!(!space.is_ascii_punctuation());
    /// assert!(!lf.is_ascii_punctuation());
    /// assert!(!esc.is_ascii_punctuation());
    /// ```
    #[must_use]
    #[stable(feature = "ascii_ctype_on_intrinsics", since = "1.24.0")]
    #[rustc_const_stable(feature = "const_ascii_ctype_on_intrinsics", since = "1.47.0")]
    #[inline]
    pub const fn is_ascii_punctuation(&self) -> bool {
        matches!(*self, '!'..='/')
            | matches!(*self, ':'..='@')
            | matches!(*self, '['..='`')
            | matches!(*self, '{'..='~')
    }

    /// 检查值是否为 ASCII 图形字符
    /// （即非空白或控制字符）：
    /// U+0021 '!' ..= U+007E '~'.
    ///
    /// # 示例
    ///
    /// ```
    /// let uppercase_a = 'A';
    /// let uppercase_g = 'G';
    /// let a = 'a';
    /// let g = 'g';
    /// let zero = '0';
    /// let percent = '%';
    /// let space = ' ';
    /// let lf = '\n';
    /// let esc = '\x1b';
    ///
    /// assert!(uppercase_a.is_ascii_graphic());
    /// assert!(uppercase_g.is_ascii_graphic());
    /// assert!(a.is_ascii_graphic());
    /// assert!(g.is_ascii_graphic());
    /// assert!(zero.is_ascii_graphic());
    /// assert!(percent.is_ascii_graphic());
    /// assert!(!space.is_ascii_graphic());
    /// assert!(!lf.is_ascii_graphic());
    /// assert!(!esc.is_ascii_graphic());
    /// ```
    #[must_use]
    #[stable(feature = "ascii_ctype_on_intrinsics", since = "1.24.0")]
    #[rustc_const_stable(feature = "const_ascii_ctype_on_intrinsics", since = "1.47.0")]
    #[inline]
    pub const fn is_ascii_graphic(&self) -> bool {
        matches!(*self, '!'..='~')
    }

    /// 检查值是否为 ASCII 空白字符：
    /// U+0020 空格，U+0009 水平制表符，U+000A 换行符，
    /// U+000C 形式回车，或 U+000D 回退字符。
    ///
    /// **警告：** 由于上述列表排除了 U+000B 垂直制表符，
    /// `c.is_ascii_whitespace()` is **not** equivalent to `c.is_ascii() && c.is_whitespace()`.
    ///
    /// Rust 使用 WhatWG Infra Standard 的 [ASCII 定义]
    /// 空白][infra-aw]。还有其他几种不同的定义在
    /// 广泛使用中。例如，[POSIX 本地化][pct] 包括
    /// U+000B 垂直制表符以及上述所有字符，
    /// 但——从同一规范中——[默认的“字段分割”规则]
    /// 在 Bourne shell 中的 [bfs] 将 *仅* 视为
    /// 空格、水平制表符和换行符作为空白字符。
    ///
    /// 如果您正在编写处理现有
    /// 文件格式的程序，请检查该格式对空白的定义。
    /// 使用此函数之前请阅读说明。
    ///
    /// [infra-aw]: https://infra.spec.whatwg.org/#ascii-whitespace
    /// [pct]: https://pubs.opengroup.org/onlinepubs/9799919799/basedefs/V1_chap07.html#tag_07_03_01
    /// [bfs]: https://pubs.opengroup.org/onlinepubs/9799919799/utilities/V3_chap02.html#tag_19_06_05
    ///
    /// # 示例
    ///
    /// ```
    /// let uppercase_a = 'A';
    /// let uppercase_g = 'G';
    /// let a = 'a';
    /// let g = 'g';
    /// let zero = '0';
    /// let percent = '%';
    /// let space = ' ';
    /// let lf = '\n';
    /// let esc = '\x1b';
    ///
    /// assert!(!uppercase_a.is_ascii_whitespace());
    /// assert!(!uppercase_g.is_ascii_whitespace());
    /// assert!(!a.is_ascii_whitespace());
    /// assert!(!g.is_ascii_whitespace());
    /// assert!(!zero.is_ascii_whitespace());
    /// assert!(!percent.is_ascii_whitespace());
    /// assert!(space.is_ascii_whitespace());
    /// assert!(lf.is_ascii_whitespace());
    /// assert!(!esc.is_ascii_whitespace());
    /// ```
    #[must_use]
    #[stable(feature = "ascii_ctype_on_intrinsics", since = "1.24.0")]
    #[rustc_const_stable(feature = "const_ascii_ctype_on_intrinsics", since = "1.47.0")]
    #[inline]
    pub const fn is_ascii_whitespace(&self) -> bool {
        matches!(*self, '\t' | '\n' | '\x0C' | '\r' | ' ')
    }

    /// 检查值是否为 ASCII 控制字符：
    /// U+0000 NUL 至 U+001F UNIT SEPARATOR，或 U+007F DELETE。
    /// 请注意，大多数 ASCII 空白字符都是控制字符，
    /// 但 SPACE 不是。
    ///
    /// # 示例
    ///
    /// ```
    /// let uppercase_a = 'A';
    /// let uppercase_g = 'G';
    /// let a = 'a';
    /// let g = 'g';
    /// let zero = '0';
    /// let percent = '%';
    /// let space = ' ';
    /// let lf = '\n';
    /// let esc = '\x1b';
    ///
    /// assert!(!uppercase_a.is_ascii_control());
    /// assert!(!uppercase_g.is_ascii_control());
    /// assert!(!a.is_ascii_control());
    /// assert!(!g.is_ascii_control());
    /// assert!(!zero.is_ascii_control());
    /// assert!(!percent.is_ascii_control());
    /// assert!(!space.is_ascii_control());
    /// assert!(lf.is_ascii_control());
    /// assert!(esc.is_ascii_control());
    /// ```
    #[must_use]
    #[stable(feature = "ascii_ctype_on_intrinsics", since = "1.24.0")]
    #[rustc_const_stable(feature = "const_ascii_ctype_on_intrinsics", since = "1.47.0")]
    #[inline]
    pub const fn is_ascii_control(&self) -> bool {
        matches!(*self, '\0'..='\x1F' | '\x7F')
    }
}

pub(crate) struct EscapeDebugExtArgs {
    /// 如何转义单引号？
    pub(crate) escape_single_quote: bool,

    /// 如何转义双引号？
    pub(crate) escape_double_quote: bool,
}

impl EscapeDebugExtArgs {
    pub(crate) const ESCAPE_ALL: Self =
        Self { escape_single_quote: true, escape_double_quote: true };
}

#[inline]
#[must_use]
const fn len_utf8(code: u32) -> usize {
    match code {
        ..MAX_ONE_B => 1,
        ..MAX_TWO_B => 2,
        ..MAX_THREE_B => 3,
        _ => 4,
    }
}

#[inline]
#[must_use]
const fn len_utf16(code: u32) -> usize {
    if (code & 0xFFFF) == code { 1 } else { 2 }
}

/// Encodes a raw `u32` value as UTF-8 into the provided byte buffer,
/// 然后返回包含已编码字符的缓冲区片段。
///
/// Unlike `char::encode_utf8`, this method also handles codepoints in the surrogate range.
/// (Creating a `char` in the surrogate range is UB.)
/// 结果属于有效的 [泛型 UTF-8]，但不是有效的 UTF-8。
///
/// [generalized UTF-8]: https://simonsapin.github.io/wtf-8/#generalized-utf8
///
/// # 异常
///
/// 如果缓冲区不够大，则会发生异常。
/// A buffer of length four is large enough to encode any `char`.
#[unstable(feature = "char_internals", reason = "exposed only for libstd", issue = "none")]
#[doc(hidden)]
#[inline]
pub const fn encode_utf8_raw(code: u32, dst: &mut [u8]) -> &mut [u8] {
    let len = len_utf8(code);
    if dst.len() < len {
        const_panic!(
            "encode_utf8: buffer does not have enough bytes to encode code point",
            "encode_utf8: need {len} bytes to encode U+{code:04X} but buffer has just {dst_len}",
            code: u32 = code,
            len: usize = len,
            dst_len: usize = dst.len(),
        );
    }

    // SAFETY: `dst` is checked to be at least the length needed to encode the codepoint.
    unsafe { encode_utf8_raw_unchecked(code, dst.as_mut_ptr()) };

    // SAFETY: `<&mut [u8]>::as_mut_ptr` is guaranteed to return a valid pointer and `len` has been tested to be within bounds.
    unsafe { slice::from_raw_parts_mut(dst.as_mut_ptr(), len) }
}

/// Encodes a raw `u32` value as UTF-8 into the byte buffer pointed to by `dst`.
///
/// Unlike `char::encode_utf8`, this method also handles codepoints in the surrogate range.
/// (Creating a `char` in the surrogate range is UB.)
/// 结果属于有效的 [泛型 UTF-8]，但不是有效的 UTF-8。
///
/// [generalized UTF-8]: https://simonsapin.github.io/wtf-8/#generalized-utf8
///
/// # 安全性
///
/// The behavior is undefined if the buffer pointed to by `dst` is not
/// large enough to hold the encoded codepoint. A buffer of length four
/// is large enough to encode any `char`.
///
/// For a safe version of this function, see the [`encode_utf8_raw`] function.
#[unstable(feature = "char_internals", reason = "exposed only for libstd", issue = "none")]
#[doc(hidden)]
#[inline]
pub const unsafe fn encode_utf8_raw_unchecked(code: u32, dst: *mut u8) {
    let len = len_utf8(code);
    // SAFETY: The caller must guarantee that the buffer pointed to by `dst`
    // is at least `len` bytes long.
    unsafe {
        if len == 1 {
            *dst = code as u8;
            return;
        }

        let last1 = (code >> 0 & 0x3F) as u8 | TAG_CONT;
        let last2 = (code >> 6 & 0x3F) as u8 | TAG_CONT;
        let last3 = (code >> 12 & 0x3F) as u8 | TAG_CONT;
        let last4 = (code >> 18 & 0x3F) as u8 | TAG_FOUR_B;

        if len == 2 {
            *dst = last2 | TAG_TWO_B;
            *dst.add(1) = last1;
            return;
        }

        if len == 3 {
            *dst = last3 | TAG_THREE_B;
            *dst.add(1) = last2;
            *dst.add(2) = last1;
            return;
        }

        *dst = last4;
        *dst.add(1) = last3;
        *dst.add(2) = last2;
        *dst.add(3) = last1;
    }
}

/// Encodes a raw `u32` value as native endian UTF-16 into the provided `u16` buffer,
/// 然后返回包含已编码字符的缓冲区片段。
///
/// Unlike `char::encode_utf16`, this method also handles codepoints in the surrogate range.
/// (Creating a `char` in the surrogate range is UB.)
///
/// # 异常
///
/// 如果缓冲区不够大，则会发生异常。
/// A buffer of length 2 is large enough to encode any `char`.
#[unstable(feature = "char_internals", reason = "exposed only for libstd", issue = "none")]
#[doc(hidden)]
#[inline]
pub const fn encode_utf16_raw(mut code: u32, dst: &mut [u16]) -> &mut [u16] {
    let len = len_utf16(code);
    match (len, &mut *dst) {
        (1, [a, ..]) => {
            *a = code as u16;
        }
        (2, [a, b, ..]) => {
            code -= 0x1_0000;
            *a = (code >> 10) as u16 | 0xD800;
            *b = (code & 0x3FF) as u16 | 0xDC00;
        }
        _ => {
            const_panic!(
                "encode_utf16: buffer does not have enough bytes to encode code point",
                "encode_utf16: need {len} bytes to encode U+{code:04X} but buffer has just {dst_len}",
                code: u32 = code,
                len: usize = len,
                dst_len: usize = dst.len(),
            )
        }
    };
    // SAFETY: `<&mut [u16]>::as_mut_ptr` is guaranteed to return a valid pointer and `len` has been tested to be within bounds.
    unsafe { slice::from_raw_parts_mut(dst.as_mut_ptr(), len) }
}
