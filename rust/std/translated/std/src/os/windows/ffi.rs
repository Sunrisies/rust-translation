//! Windows-specific extensions to primitives in the [`std::ffi`] module.
//!
//! # 概述
//!
//! 出于历史原因，Windows API 使用一种可能
//! 不符合规范的 UTF-16 字符串编码方式。具体来说，Windows 字符串中的
//! 16 位代码单元可能包含 [孤立的代理代码点]
//! 这些点没有成对出现][不符合规范的 UTF-16]。Unicode 标准要求
//! 代理代码点（位于 U+D800 到 U+DFFF 范围内）必须 *成对出现*，因为在 UTF-16
//! 编码中，一个 *代理代码单元对* 用于编码一个字符。为了与不强制
//! 这些成对的代码兼容，Windows 也不强制这些配对。
//! 虽然并不总是能够无损地将这样的字符串转换为
//! 有效的 UTF-16 字符串（甚至 UTF-8），但通常希望能够
//!
//! 从 Windows API 到 Windows API 无损地往返这样的字符串。例如，某些 Rust 代码可能通过传递
//! a valid UTF-16 string (or even UTF-8), it is often desirable to be
//! Windows API，而实际上并不真正检查这些字符串。
//! 如果 Rust 代码确实需要检查这些字符串，它可以通过用
//! Windows APIs together, just passing `WCHAR` strings among those
//! 按照其他处理字符串编码的 Rust API 中的惯例，可能无损地转换它们为
//!
//! 有效的 UTF-8。
//! convert them to valid UTF-8, possibly lossily, by substituting
//! invalid sequences with [`U+FFFD REPLACEMENT CHARACTER`][U+FFFD], as is
//! conventionally done in other Rust APIs that deal with string
//! encodings.
//!
//! # `OsStringExt` and `OsStrExt`
//!
//! [`OsString`] is the Rust wrapper for owned strings in the
//! preferred representation of the operating system. On Windows,
//! this struct gets augmented with an implementation of the
//! [`OsStringExt`] trait, which has an [`OsStringExt::from_wide`] method. This
//! lets you create an [`OsString`] from a `&[u16]` slice; presumably
//! you get such a slice out of a `WCHAR` Windows API.
//!
//! Similarly, [`OsStr`] is the Rust wrapper for borrowed strings from
//! Windows 传回，即使字符串是
//! [`OsStrExt`] trait provides the [`OsStrExt::encode_wide`] method, which
//! outputs an [`EncodeWide`] iterator. You can [`collect`] this
//! iterator, for example, to obtain a `Vec<u16>`; you can later get a
//! pointer to this vector's contents and feed it to Windows APIs.
//!
//! These traits, along with [`OsString`] and [`OsStr`], work in
//! conjunction so that it is possible to **round-trip** strings from
//! Windows and back, with no loss of data, even if the strings are
//! ill-formed UTF-16.
//!
//! [ill-formed-utf-16]: https://simonsapin.github.io/wtf-8/#ill-formed-utf-16
//! [`collect`]: crate::iter::Iterator::collect
//! [U+FFFD]: char::REPLACEMENT_CHARACTER
//! [`std::ffi`]: crate::ffi

#![stable(feature = "rust1", since = "1.0.0")]

use alloc::wtf8::Wtf8Buf;

use crate::ffi::{OsStr, OsString};
use crate::fmt;
use crate::iter::FusedIterator;
use crate::macros::rustdoc_skip_body;
use crate::sys::os_str::Buf;
use crate::sys::{AsInner, FromInner};

/// Windows-specific extensions to [`OsString`].
#[stable(feature = "rust1", since = "1.0.0")]
pub impl(self) trait OsStringExt {
    /// Creates an `OsString` from a potentially ill-formed UTF-16 slice of
    /// 16 位代码单元。
    ///
    /// This is lossless: calling [`OsStrExt::encode_wide`] on the resulting string
    /// # 示例
    ///
    /// # 示例
    ///
    #[cfg_attr(windows, doc = "```no_run")]
    #[cfg_attr(not(windows), doc = "```ignore (needs windows)")]
    /// 使用 std::ffi::OsString;
    /// 使用 std::os::windows::prelude::*;
    ///
    /// // “Unicode”的 UTF-16 编码。
    /// let source = [0x0055, 0x006E, 0x0069, 0x0063, 0x006F, 0x0064, 0x0065];
    ///
    /// let string = OsString::from_wide(&source[..]);
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    fn from_wide(wide: &[u16]) -> Self;
}

#[stable(feature = "rust1", since = "1.0.0")]
impl OsStringExt for OsString {
    #[rustdoc_skip_body]
    fn from_wide(wide: &[u16]) -> OsString {
        FromInner::from_inner(Buf { inner: Wtf8Buf::from_wide(wide) })
    }
}

/// Windows-specific extensions to [`OsStr`].
#[stable(feature = "rust1", since = "1.0.0")]
pub impl(self) trait OsStrExt {
    /// Re-encodes an `OsStr` as a wide character sequence, i.e., potentially
    /// ill-formed UTF-16.
    ///
    /// This is lossless: calling [`OsStringExt::from_wide`] and then
    /// `encode_wide` on the result will yield the original code units.
    /// Note that the encoding does not add a final null terminator.
    ///
    /// # Examples
    ///
    #[cfg_attr(windows, doc = "```no_run")]
    #[cfg_attr(not(windows), doc = "```ignore (needs windows)")]
    /// use std::ffi::OsString;
    /// use std::os::windows::prelude::*;
    ///
    /// // UTF-16 encoding for "Unicode".
    /// let source = [0x0055, 0x006E, 0x0069, 0x0063, 0x006F, 0x0064, 0x0065];
    ///
    /// let string = OsString::from_wide(&source[..]);
    ///
    /// let result: Vec<u16> = string.encode_wide().collect();
    /// assert_eq!(&source[..], &result[..]);
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    fn encode_wide(&self) -> EncodeWide<'_>;
}

#[stable(feature = "rust1", since = "1.0.0")]
impl OsStrExt for OsStr {
    #[inline]
    #[rustdoc_skip_body]
    fn encode_wide(&self) -> EncodeWide<'_> {
        EncodeWide { inner: self.as_inner().inner.encode_wide() }
    }
}

/// Iterator returned by [`OsStrExt::encode_wide`].
#[stable(feature = "rust1", since = "1.0.0")]
#[derive(Clone)]
pub struct EncodeWide<'a> {
    inner: alloc::wtf8::EncodeWide<'a>,
}
#[stable(feature = "encode_wide_debug", since = "1.91.0")]
impl fmt::Debug for EncodeWide<'_> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        fmt::Debug::fmt(&self.inner, f)
    }
}
#[stable(feature = "rust1", since = "1.0.0")]
impl Iterator for EncodeWide<'_> {
    type Item = u16;

    #[inline]
    fn next(&mut self) -> Option<u16> {
        self.inner.next()
    }

    #[inline]
    fn size_hint(&self) -> (usize, Option<usize>) {
        self.inner.size_hint()
    }
}
#[stable(feature = "encode_wide_fused_iterator", since = "1.62.0")]
impl FusedIterator for EncodeWide<'_> {}
