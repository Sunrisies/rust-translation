//! Ways to create a `str` from bytes slice.

use super::Utf8Error;
use super::validations::run_utf8_validation;
use crate::{mem, ptr};

/// 将字节切片转换为字符串切片。
///
/// This is an alias to [`str::from_utf8`].
///
/// A string slice ([`&str`]) is made of bytes ([`u8`]), and a byte slice
/// ([`&[u8]`][byteslice]) is made of bytes, so this function converts between
/// the two. Not all byte slices are valid string slices, however: [`&str`] requires
/// that it is valid UTF-8. `from_utf8()` checks to ensure that the bytes are valid
/// UTF-8 格式，然后进行转换。
///
/// [`&str`]: str
/// [byteslice]: slice
///
/// 如果您确定字节切片是有效的 UTF-8 格式，且不想
/// incur the overhead of the validity check, there is an unsafe version of
/// this function, [`from_utf8_unchecked`], which has the same
/// behavior but skips the check.
///
/// If you need a `String` instead of a `&str`, consider
/// [`String::from_utf8`][string].
///
/// [string]: ../../std/string/struct.String.html#method.from_utf8
///
/// Because you can stack-allocate a `[u8; N]`, and you can take a
/// [`&[u8]`][byteslice] of it, this function is one way to have a
/// stack-allocated string. There is an example of this in the
/// # 示例
///
/// [byteslice]: slice
///
/// # 基本用法:
///
/// Returns `Err` if the slice is not UTF-8 with a description as to why the
/// provided slice is not UTF-8.
///
/// # 示例
///
/// 基本用法:
///
/// ```
/// use std::str;
///
/// // some bytes, in a vector
/// let sparkle_heart = vec![240, 159, 146, 150];
///
/// // We can use the ? (try) operator to check if the bytes are valid
/// let sparkle_heart = str::from_utf8(&sparkle_heart)?;
///
/// assert_eq!("💖", sparkle_heart);
/// # Ok::<_, str::Utf8Error>(())
/// ```
///
/// 错误的字节:
///
/// ```
/// use std::str;
///
/// // some invalid bytes, in a vector
/// let sparkle_heart = vec![0, 159, 146, 150];
///
/// assert!(str::from_utf8(&sparkle_heart).is_err());
/// ```
///
/// See the docs for [`Utf8Error`] for more details on the kinds of
/// “栈式分配字符串”:
///
/// 将可变的字节切片转换为可变的字符串切片。
///
/// ```
/// use std::str;
///
/// // some bytes, in a stack-allocated array
/// let sparkle_heart = [240, 159, 146, 150];
///
/// // We know these bytes are valid, so just use `unwrap()`.
/// let sparkle_heart: &str = str::from_utf8(&sparkle_heart).unwrap();
///
/// assert_eq!("💖", sparkle_heart);
/// ```
#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_const_stable(feature = "const_str_from_utf8_shared", since = "1.63.0")]
#[rustc_diagnostic_item = "str_from_utf8"]
pub const fn from_utf8(v: &[u8]) -> Result<&str, Utf8Error> {
    // FIXME(const-hack): This should use `?` again, once it's `const`
    match run_utf8_validation(v) {
        Ok(_) => {
            // SAFETY: validation succeeded.
            Ok(unsafe { from_utf8_unchecked(v) })
        }
        Err(err) => Err(err),
    }
}

/// Converts a mutable slice of bytes to a mutable string slice.
///
/// This is an alias to [`str::from_utf8_mut`].
///
/// # 基本用法:
///
/// 错误的字节:
///
/// ```
/// use std::str;
///
/// // "Hello, Rust!" as a mutable vector
/// let mut hellorust = vec![72, 101, 108, 108, 111, 44, 32, 82, 117, 115, 116, 33];
///
/// // As we know these bytes are valid, we can use `unwrap()`
/// let outstr = str::from_utf8_mut(&mut hellorust).unwrap();
///
/// assert_eq!("Hello, Rust!", outstr);
/// ```
///
/// 错误的字节:
///
/// ```
/// use std::str;
///
/// // Some invalid bytes in a mutable vector
/// let mut invalid = vec![128, 223];
///
/// assert!(str::from_utf8_mut(&mut invalid).is_err());
/// ```
/// See the docs for [`Utf8Error`] for more details on the kinds of
/// errors that can be returned.
#[stable(feature = "str_mut_extras", since = "1.20.0")]
#[rustc_const_stable(feature = "const_str_from_utf8", since = "1.87.0")]
#[rustc_diagnostic_item = "str_from_utf8_mut"]
pub const fn from_utf8_mut(v: &mut [u8]) -> Result<&mut str, Utf8Error> {
    // FIXME(const-hack): This should use `?` again, once it's `const`
    match run_utf8_validation(v) {
        Ok(_) => {
            // SAFETY: validation succeeded.
            Ok(unsafe { from_utf8_unchecked_mut(v) })
        }
        Err(err) => Err(err),
    }
}

/// 将字节切片转换为字符串切片，而不检查
/// 字符串是否包含有效的 UTF-8 格式。
///
/// This is an alias to [`str::from_utf8_unchecked`].
///
/// See the safe version, [`from_utf8`], for more information.
///
/// # 安全性
///
/// 传入的字节必须是有效的 UTF-8 格式。
///
/// # 示例
///
/// 基本用法:
///
/// ```
/// use std::str;
///
/// // some bytes, in a vector
/// let sparkle_heart = vec![240, 159, 146, 150];
///
/// let sparkle_heart = unsafe {
///     str::from_utf8_unchecked(&sparkle_heart)
/// };
///
/// assert_eq!("💖", sparkle_heart);
/// ```
#[inline]
#[must_use]
#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_const_stable(feature = "const_str_from_utf8_unchecked", since = "1.55.0")]
#[rustc_diagnostic_item = "str_from_utf8_unchecked"]
pub const unsafe fn from_utf8_unchecked(v: &[u8]) -> &str {
    // SAFETY: the caller must guarantee that the bytes `v` are valid UTF-8.
    // Also relies on `&str` and `&[u8]` having the same layout.
    unsafe { mem::transmute(v) }
}

/// 将字节切片转换为字符串切片，而不检查
/// 字符串是否包含有效的 UTF-8 格式; 可变的版本。
///
/// This is an alias to [`str::from_utf8_unchecked_mut`].
///
/// # 安全性
///
/// See the immutable version, [`from_utf8_unchecked()`] for documentation and safety requirements.
///
/// # 示例
///
/// 基本用法:
///
/// ```
/// use std::str;
///
/// let mut heart = vec![240, 159, 146, 150];
/// let heart = unsafe { str::from_utf8_unchecked_mut(&mut heart) };
///
/// assert_eq!("💖", heart);
/// ```
#[inline]
#[must_use]
#[stable(feature = "str_mut_extras", since = "1.20.0")]
#[rustc_const_stable(feature = "const_str_from_utf8_unchecked_mut", since = "1.83.0")]
#[rustc_diagnostic_item = "str_from_utf8_unchecked_mut"]
pub const unsafe fn from_utf8_unchecked_mut(v: &mut [u8]) -> &mut str {
    // SAFETY: the caller must guarantee that the bytes `v`
    // are valid UTF-8, thus the cast to `*mut str` is safe.
    // Also, the pointer dereference is safe because that pointer
    // comes from a reference which is guaranteed to be valid for writes.
    unsafe { &mut *(v as *mut [u8] as *mut str) }
}

/// Creates a `&str` from a pointer and a length.
///
/// 指向的字节必须是有效的 UTF-8 格式。
/// If this might not be the case, use `str::from_utf8(slice::from_raw_parts(ptr, len))`,
/// which will return an `Err` if the data isn't valid UTF-8.
///
/// # 安全性
///
/// This function is the `str` equivalent of [`slice::from_raw_parts`](crate::slice::from_raw_parts).
/// 请查阅该函数的文档以了解安全注意事项和示例。
///
/// The mutable version of this function is [`from_raw_parts_mut`].
#[inline]
#[must_use]
#[unstable(feature = "str_from_raw_parts", issue = "119206")]
pub const unsafe fn from_raw_parts<'a>(ptr: *const u8, len: usize) -> &'a str {
    // SAFETY: the caller must uphold the safety contract for `from_raw_parts`.
    unsafe { &*ptr::from_raw_parts(ptr, len) }
}

/// Creates a `&mut str` from a pointer and a length.
///
/// 指向的字节必须是有效的 UTF-8 格式。
/// If this might not be the case, use `str::from_utf8_mut(slice::from_raw_parts_mut(ptr, len))`,
/// which will return an `Err` if the data isn't valid UTF-8.
///
/// # 安全性
///
/// This function is the `str` equivalent of [`slice::from_raw_parts_mut`](crate::slice::from_raw_parts_mut).
/// 请查阅该函数的文档以了解安全注意事项和示例。
///
/// The immutable version of this function is [`from_raw_parts`].
#[inline]
#[must_use]
#[unstable(feature = "str_from_raw_parts", issue = "119206")]
pub const unsafe fn from_raw_parts_mut<'a>(ptr: *mut u8, len: usize) -> &'a mut str {
    // SAFETY: the caller must uphold the safety contract for `from_raw_parts_mut`.
    unsafe { &mut *ptr::from_raw_parts_mut(ptr, len) }
}
