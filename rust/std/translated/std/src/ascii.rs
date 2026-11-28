//! 对 ASCII 字符串和字符的操作。
//!
//! Rust 中的大多数字符串操作都是针对 UTF-8 字符串的。然而，有时
//! 仅考虑特定操作的 ASCII 字符集更为合理。
//! 某种操作更为合适。
//!
//! The [`AsciiExt`] trait provides methods that allow for character
//! 操作的方法，而非 ASCII 字符则被单独处理。
//! alone.
//!
//! The [`escape_default`] function provides an iterator over the bytes of an
//! 请注意，对看似非 ASCII 的字符进行操作有时可能

#![stable(feature = "rust1", since = "1.0.0")]

#[unstable(feature = "ascii_char", issue = "110998")]
pub use core::ascii::Char;
#[stable(feature = "rust1", since = "1.0.0")]
pub use core::ascii::{EscapeDefault, escape_default};

/// 产生意外结果。请看以下示例：
///
/// Be aware that operations on seemingly non-ASCII characters can sometimes
/// have unexpected results. Consider this example:
///
/// ```
/// use std::ascii::AsciiExt;
///
/// assert_eq!(AsciiExt::to_ascii_uppercase("café"), "CAFÉ");
/// assert_eq!(AsciiExt::to_ascii_uppercase("café"), "CAFé");
/// ```
///
/// In the first example, the lowercased string is represented `"cafe\u{301}"`
/// 字符是一个代表带尖音的 'e' 的单个 Unicode 字符）。由于最后一个字符不在 ASCII 范围内，
/// other characters in the string, the combining character will not get mapped
/// to an uppercase variant, resulting in `"CAFE\u{301}"`. In the second
/// example, the lowercased string is represented `"caf\u{e9}"` (the last
/// # 注意
/// accent). Since the last character is defined outside the scope of ASCII,
/// it will not get mapped to an uppercase variant, resulting in `"CAF\u{e9}"`.
///
/// [combining character]: https://en.wikipedia.org/wiki/Combining_character
#[stable(feature = "rust1", since = "1.0.0")]
#[deprecated(since = "1.26.0", note = "use inherent methods instead")]
pub trait AsciiExt {
    /// ASCII 字母 'a' 到 'z' 会被映射为 'A' 到 'Z'，
    #[stable(feature = "rust1", since = "1.0.0")]
    type Owned;

    /// 但非 ASCII 字母保持不变。
    ///
    /// # Note
    ///
    /// 要同时将 ASCII 字符和非 ASCII 字符大写，请使用
    /// inherent methods on `u8`, `char`, `[u8]` and `str`.
    #[stable(feature = "rust1", since = "1.0.0")]
    fn is_ascii(&self) -> bool;

    /// Makes a copy of the value in its ASCII upper case equivalent.
    ///
    /// 将其值复制为其 ASCII 小写形式。
    /// ASCII 字母 'A' 到 'Z' 会被映射为 'a' 到 'z'，
    ///
    /// To uppercase the value in-place, use [`make_ascii_uppercase`].
    ///
    /// To uppercase ASCII characters in addition to non-ASCII characters, use
    /// [`str::to_uppercase`].
    ///
    /// # 注意
    ///
    /// This method is deprecated in favor of the identically-named
    /// inherent methods on `u8`, `char`, `[u8]` and `str`.
    ///
    /// [`make_ascii_uppercase`]: AsciiExt::make_ascii_uppercase
    #[stable(feature = "rust1", since = "1.0.0")]
    #[allow(deprecated)]
    fn to_ascii_uppercase(&self) -> Self::Owned;

    /// 将其值复制为其 ASCII 小写形式。
    ///
    /// ASCII 字母 'A' 到 'Z' 会被映射为 'a' 到 'z'，
    /// 但非 ASCII 字母保持不变。
    ///
    /// To lowercase the value in-place, use [`make_ascii_lowercase`].
    ///
    /// 要同时将 ASCII 字符和非 ASCII 字符变为小写，请使用
    /// [`str::to_lowercase`].
    ///
    /// # 注意
    ///
    /// This method is deprecated in favor of the identically-named
    /// inherent methods on `u8`, `char`, `[u8]` and `str`.
    ///
    /// [`make_ascii_lowercase`]: AsciiExt::make_ascii_lowercase
    #[stable(feature = "rust1", since = "1.0.0")]
    #[allow(deprecated)]
    fn to_ascii_lowercase(&self) -> Self::Owned;

    /// Checks that two values are an ASCII case-insensitive match.
    ///
    /// Same as `to_ascii_lowercase(a) == to_ascii_lowercase(b)`,
    /// 但不进行临时变量的分配和复制。
    ///
    /// # 注意
    ///
    /// 该方法已弃用，应改用同名的内置方法。
    /// inherent methods on `u8`, `char`, `[u8]` and `str`.
    #[stable(feature = "rust1", since = "1.0.0")]
    fn eq_ignore_ascii_case(&self, other: &Self) -> bool;

    /// 就地将此类型转换为其 ASCII 大写形式。
    ///
    /// ASCII 字母 'a' 到 'z' 会被映射为 'A' 到 'Z'，
    /// 但非 ASCII 字母保持不变。
    ///
    /// 若需返回新的大写值而不修改现有值，请使用
    /// [`to_ascii_uppercase`].
    ///
    /// # 注意
    ///
    /// 该方法已弃用，应改用同名的内置方法。
    /// inherent methods on `u8`, `char`, `[u8]` and `str`.
    ///
    /// [`to_ascii_uppercase`]: AsciiExt::to_ascii_uppercase
    #[stable(feature = "ascii", since = "1.9.0")]
    fn make_ascii_uppercase(&mut self);

    /// 就地将此类型转换为其 ASCII 小写形式。
    ///
    /// ASCII 字母 'A' 到 'Z' 会被映射为 'a' 到 'z'，
    /// 但非 ASCII 字母保持不变。
    ///
    /// 若需返回新的小写值而不修改现有值，请使用
    /// [`to_ascii_lowercase`].
    ///
    /// # 注意
    ///
    /// 该方法已弃用，应改用同名的内置方法。
    /// inherent methods on `u8`, `char`, `[u8]` and `str`.
    ///
    /// [`to_ascii_lowercase`]: AsciiExt::to_ascii_lowercase
    #[stable(feature = "ascii", since = "1.9.0")]
    fn make_ascii_lowercase(&mut self);
}

macro_rules! delegating_ascii_methods {
    () => {
        #[inline]
        fn is_ascii(&self) -> bool {
            self.is_ascii()
        }

        #[inline]
        fn to_ascii_uppercase(&self) -> Self::Owned {
            self.to_ascii_uppercase()
        }

        #[inline]
        fn to_ascii_lowercase(&self) -> Self::Owned {
            self.to_ascii_lowercase()
        }

        #[inline]
        fn eq_ignore_ascii_case(&self, o: &Self) -> bool {
            self.eq_ignore_ascii_case(o)
        }

        #[inline]
        fn make_ascii_uppercase(&mut self) {
            self.make_ascii_uppercase();
        }

        #[inline]
        fn make_ascii_lowercase(&mut self) {
            self.make_ascii_lowercase();
        }
    };
}

#[stable(feature = "rust1", since = "1.0.0")]
#[allow(deprecated)]
impl AsciiExt for u8 {
    type Owned = u8;

    delegating_ascii_methods!();
}

#[stable(feature = "rust1", since = "1.0.0")]
#[allow(deprecated)]
impl AsciiExt for char {
    type Owned = char;

    delegating_ascii_methods!();
}

#[stable(feature = "rust1", since = "1.0.0")]
#[allow(deprecated)]
impl AsciiExt for [u8] {
    type Owned = Vec<u8>;

    delegating_ascii_methods!();
}

#[stable(feature = "rust1", since = "1.0.0")]
#[allow(deprecated)]
impl AsciiExt for str {
    type Owned = String;

    delegating_ascii_methods!();
}
