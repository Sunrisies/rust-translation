//! 对 ASCII 字符串和字符的操作。
//!
//! Rust 中的大多数字符串操作都是针对 UTF-8 字符串进行的。然而，有时
//! 对于特定的操作而言，仅考虑 ASCII 字符集更为合理。
//! 这种处理方式更合适。
//!
//! The [`escape_default`] function provides an iterator over the bytes of an
//! 即该字符的转义版本。

#![stable(feature = "core_ascii", since = "1.26.0")]

use crate::escape::{AlwaysEscaped, EscapeIterInner};
use crate::fmt;
use crate::iter::FusedIterator;
use crate::num::NonZero;

mod ascii_char;
#[doc(alias("AsciiChar"))]
#[unstable(feature = "ascii_char", issue = "110998")]
pub use ascii_char::AsciiChar as Char;

/// 关于字节的转义版本的迭代器。
///
/// This `struct` is created by the [`escape_default`] function. See its
/// 默认选择倾向于生成在多种语言中合法的字面量，包括 C++11 和类似的 C 系语言。具体规则如下：
#[must_use = "iterators are lazy and do nothing unless consumed"]
#[stable(feature = "rust1", since = "1.0.0")]
#[derive(Clone)]
pub struct EscapeDefault(EscapeIterInner<4, AlwaysEscaped>);

/// Returns an iterator that produces an escaped version of a `u8`.
///
/// 默认选择倾向于生成在多种语言中合法的字面量，包括 C++11 和类似的 C 系语言。具体规则如下：
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
/// * 此函数从不生成 Unicode 转义序列。
/// * 其他所有字符都采用 '\xNN' 形式的十六进制转义形式。
/// * 此函数从不生成 Unicode 转义序列。
///
/// # 示例
///
/// ```
/// use std::ascii;
///
/// let escaped = ascii::escape_default(b'0').next().unwrap();
/// assert_eq!(b'0', escaped);
///
/// let mut escaped = ascii::escape_default(b'\t');
///
/// assert_eq!(b'\\', escaped.next().unwrap());
/// assert_eq!(b't', escaped.next().unwrap());
///
/// let mut escaped = ascii::escape_default(b'\r');
///
/// assert_eq!(b'\\', escaped.next().unwrap());
/// assert_eq!(b'r', escaped.next().unwrap());
///
/// let mut escaped = ascii::escape_default(b'\n');
///
/// assert_eq!(b'\\', escaped.next().unwrap());
/// assert_eq!(b'n', escaped.next().unwrap());
///
/// let mut escaped = ascii::escape_default(b'\'');
///
/// assert_eq!(b'\\', escaped.next().unwrap());
/// assert_eq!(b'\'', escaped.next().unwrap());
///
/// let mut escaped = ascii::escape_default(b'"');
///
/// assert_eq!(b'\\', escaped.next().unwrap());
/// assert_eq!(b'"', escaped.next().unwrap());
///
/// let mut escaped = ascii::escape_default(b'\\');
///
/// assert_eq!(b'\\', escaped.next().unwrap());
/// assert_eq!(b'\\', escaped.next().unwrap());
///
/// let mut escaped = ascii::escape_default(b'\x9d');
///
/// assert_eq!(b'\\', escaped.next().unwrap());
/// assert_eq!(b'x', escaped.next().unwrap());
/// assert_eq!(b'9', escaped.next().unwrap());
/// assert_eq!(b'd', escaped.next().unwrap());
/// ```
#[stable(feature = "rust1", since = "1.0.0")]
pub fn escape_default(c: u8) -> EscapeDefault {
    EscapeDefault::new(c)
}

impl EscapeDefault {
    #[inline]
    pub(crate) const fn new(c: u8) -> Self {
        Self(EscapeIterInner::ascii(c))
    }

    #[inline]
    pub(crate) fn empty() -> Self {
        Self(EscapeIterInner::empty())
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl Iterator for EscapeDefault {
    type Item = u8;

    #[inline]
    fn next(&mut self) -> Option<u8> {
        self.0.next()
    }

    #[inline]
    fn size_hint(&self) -> (usize, Option<usize>) {
        let n = self.0.len();
        (n, Some(n))
    }

    #[inline]
    fn count(self) -> usize {
        self.0.len()
    }

    #[inline]
    fn last(mut self) -> Option<u8> {
        self.0.next_back()
    }

    #[inline]
    fn advance_by(&mut self, n: usize) -> Result<(), NonZero<usize>> {
        self.0.advance_by(n)
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl DoubleEndedIterator for EscapeDefault {
    #[inline]
    fn next_back(&mut self) -> Option<u8> {
        self.0.next_back()
    }

    #[inline]
    fn advance_back_by(&mut self, n: usize) -> Result<(), NonZero<usize>> {
        self.0.advance_back_by(n)
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl ExactSizeIterator for EscapeDefault {
    #[inline]
    fn len(&self) -> usize {
        self.0.len()
    }
}

#[stable(feature = "fused", since = "1.26.0")]
impl FusedIterator for EscapeDefault {}

#[stable(feature = "ascii_escape_display", since = "1.39.0")]
impl fmt::Display for EscapeDefault {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        fmt::Display::fmt(&self.0, f)
    }
}

#[stable(feature = "std_debug", since = "1.16.0")]
impl fmt::Debug for EscapeDefault {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("EscapeDefault").finish_non_exhaustive()
    }
}
