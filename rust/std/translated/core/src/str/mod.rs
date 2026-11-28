//! 字符串操作。
//!
//! For more details, see the [`std::str`] module.
//!
//! [`std::str`]: ../../std/str/index.html

#![stable(feature = "rust1", since = "1.0.0")]

mod converts;
mod count;
mod error;
mod iter;
mod traits;
mod validations;

use self::pattern::{DoubleEndedSearcher, Pattern, ReverseSearcher, Searcher};
use crate::char::{self, EscapeDebugExtArgs};
use crate::hint::assert_unchecked;
use crate::range::Range;
use crate::slice::{self, SliceIndex};
use crate::ub_checks::assert_unsafe_precondition;
use crate::{ascii, mem};

pub mod pattern;

mod lossy;
#[unstable(feature = "str_from_raw_parts", issue = "119206")]
pub use converts::{from_raw_parts, from_raw_parts_mut};
#[stable(feature = "rust1", since = "1.0.0")]
pub use converts::{from_utf8, from_utf8_unchecked};
#[stable(feature = "str_mut_extras", since = "1.20.0")]
pub use converts::{from_utf8_mut, from_utf8_unchecked_mut};
#[stable(feature = "rust1", since = "1.0.0")]
pub use error::{ParseBoolError, Utf8Error};
#[stable(feature = "encode_utf16", since = "1.8.0")]
pub use iter::EncodeUtf16;
#[stable(feature = "rust1", since = "1.0.0")]
#[allow(deprecated)]
pub use iter::LinesAny;
#[stable(feature = "split_ascii_whitespace", since = "1.34.0")]
pub use iter::SplitAsciiWhitespace;
#[stable(feature = "split_inclusive", since = "1.51.0")]
pub use iter::SplitInclusive;
#[stable(feature = "rust1", since = "1.0.0")]
pub use iter::{Bytes, CharIndices, Chars, Lines, SplitWhitespace};
#[stable(feature = "str_escape", since = "1.34.0")]
pub use iter::{EscapeDebug, EscapeDefault, EscapeUnicode};
#[stable(feature = "str_match_indices", since = "1.5.0")]
pub use iter::{MatchIndices, RMatchIndices};
use iter::{MatchIndicesInternal, MatchesInternal, SplitInternal, SplitNInternal};
#[stable(feature = "str_matches", since = "1.2.0")]
pub use iter::{Matches, RMatches};
#[stable(feature = "rust1", since = "1.0.0")]
pub use iter::{RSplit, RSplitTerminator, Split, SplitTerminator};
#[stable(feature = "rust1", since = "1.0.0")]
pub use iter::{RSplitN, SplitN};
#[stable(feature = "utf8_chunks", since = "1.79.0")]
pub use lossy::{Utf8Chunk, Utf8Chunks};
#[stable(feature = "rust1", since = "1.0.0")]
pub use traits::FromStr;
#[unstable(feature = "str_internals", issue = "none")]
pub use validations::{next_code_point, utf8_char_width};

#[inline(never)]
#[cold]
#[track_caller]
#[rustc_allow_const_fn_unstable(const_eval_select)]
#[cfg(not(panic = "immediate-abort"))]
const fn slice_error_fail(s: &str, begin: usize, end: usize) -> ! {
    crate::intrinsics::const_eval_select((s, begin, end), slice_error_fail_ct, slice_error_fail_rt)
}

#[cfg(panic = "immediate-abort")]
const fn slice_error_fail(s: &str, begin: usize, end: usize) -> ! {
    slice_error_fail_ct(s, begin, end)
}

#[track_caller]
const fn slice_error_fail_ct(_: &str, _: usize, _: usize) -> ! {
    panic!("failed to slice string");
}

#[track_caller]
fn slice_error_fail_rt(s: &str, begin: usize, end: usize) -> ! {
    let len = s.len();

    // 1. begin is OOB.
    if begin > len {
        panic!("start byte index {begin} is out of bounds for string of length {len}");
    }

    // 2. end is OOB.
    if end > len {
        panic!("end byte index {end} is out of bounds for string of length {len}");
    }

    // 3. range is backwards.
    if begin > end {
        panic!("byte range starts at {begin} but ends at {end}");
    }

    // 4. begin is inside a character.
    if !s.is_char_boundary(begin) {
        let floor = s.floor_char_boundary(begin);
        let ceil = s.ceil_char_boundary(begin);
        let range = floor..ceil;
        let ch = s[floor..ceil].chars().next().unwrap();
        panic!(
            "start byte index {begin} is not a char boundary; it is inside {ch:?} (bytes {range:?} of string)"
        )
    }

    // 5. end is inside a character.
    if !s.is_char_boundary(end) {
        let floor = s.floor_char_boundary(end);
        let ceil = s.ceil_char_boundary(end);
        let range = floor..ceil;
        let ch = s[floor..ceil].chars().next().unwrap();
        panic!(
            "end byte index {end} is not a char boundary; it is inside {ch:?} (bytes {range:?} of string)"
        )
    }

    // 6. end is OOB and range is inclusive (end == len).
    // This test cannot be combined with 2. above because for cases like
    // `"abcαβγ"[4..9]` the error is that 4 is inside 'α', not that 9 is OOB.
    debug_assert_eq!(end, len);
    panic!("end byte index {end} is out of bounds for string of length {len}");
}

impl str {
    /// Returns the length of `self`.
    ///
    /// This length is in bytes, not [`char`]s or graphemes. In other words,
    /// 它可能并非人类所认为的字符串长度。
    ///
    /// [`char`]: prim@char
    ///
    /// # 示例
    ///
    /// ```
    /// let len = "foo".len();
    /// assert_eq!(3, len);
    ///
    /// assert_eq!("ƒoo".len(), 4); // fancy f!
    /// assert_eq!("ƒoo".chars().count(), 3);
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_str_len", since = "1.39.0")]
    #[rustc_diagnostic_item = "str_len"]
    #[lint::no_implicit_autorefs]
    #[must_use]
    #[inline]
    #[allow(clippy::needless_as_bytes)]
    pub const fn len(&self) -> usize {
        self.as_bytes().len()
    }

    /// Returns `true` if `self` has a length of zero bytes.
    ///
    /// # 示例
    ///
    /// ```
    /// let s = "";
    /// assert!(s.is_empty());
    ///
    /// let s = "not empty";
    /// assert!(!s.is_empty());
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_str_is_empty", since = "1.39.0")]
    #[lint::no_implicit_autorefs]
    #[must_use]
    #[inline]
    pub const fn is_empty(&self) -> bool {
        self.len() == 0
    }

    /// 将字节切片转换为字符串切片。
    ///
    /// A string slice ([`&str`]) is made of bytes ([`u8`]), and a byte slice
    /// ([`&[u8]`][byteslice]) is made of bytes, so this function converts between
    /// the two. Not all byte slices are valid string slices, however: [`&str`] requires
    /// that it is valid UTF-8. `from_utf8()` checks to ensure that the bytes are valid
    /// 为 UTF-8，然后才进行转换。
    ///
    /// [`&str`]: str
    /// [byteslice]: prim@slice
    ///
    /// 如果您确定字节切片是有效的 UTF-8，且不想
    /// 承担有效性检查的开销，则存在此函数的 unsafe 版本
    /// this function, [`from_utf8_unchecked`], which has the same
    /// 行为，但跳过检查。
    ///
    /// If you need a `String` instead of a `&str`, consider
    /// [`String::from_utf8`][string].
    ///
    /// [string]: ../std/string/struct.String.html#method.from_utf8
    ///
    /// Because you can stack-allocate a `[u8; N]`, and you can take a
    /// [`&[u8]`][byteslice] of it, this function is one way to have a
    /// # 错误
    /// examples section below.
    ///
    /// [byteslice]: slice
    ///
    /// # 示例
    ///
    /// Returns `Err` if the slice is not UTF-8 with a description as to why the
    /// # 示例
    ///
    /// # 基本用法：
    ///
    /// 错误字节：
    ///
    /// ```
    /// // some bytes, in a vector
    /// let sparkle_heart = vec![240, 159, 146, 150];
    ///
    /// // We can use the ? (try) operator to check if the bytes are valid
    /// let sparkle_heart = str::from_utf8(&sparkle_heart)?;
    ///
    /// assert_eq!("💖", sparkle_heart);
    /// # Ok::<_, std::str::Utf8Error>(())
    /// ```
    ///
    /// Incorrect bytes:
    ///
    /// ```
    /// // some invalid bytes, in a vector
    /// let sparkle_heart = vec![0, 159, 146, 150];
    ///
    /// assert!(str::from_utf8(&sparkle_heart).is_err());
    /// ```
    ///
    /// See the docs for [`Utf8Error`] for more details on the kinds of
    /// 将可变的字节切片转换为可变的字符串切片。
    ///
    /// # 示例
    ///
    /// ```
    /// // some bytes, in a stack-allocated array
    /// let sparkle_heart = [240, 159, 146, 150];
    ///
    /// // We know these bytes are valid, so just use `unwrap()`.
    /// let sparkle_heart: &str = str::from_utf8(&sparkle_heart).unwrap();
    ///
    /// assert_eq!("💖", sparkle_heart);
    /// ```
    #[stable(feature = "inherent_str_constructors", since = "1.87.0")]
    #[rustc_const_stable(feature = "inherent_str_constructors", since = "1.87.0")]
    #[rustc_diagnostic_item = "str_inherent_from_utf8"]
    pub const fn from_utf8(v: &[u8]) -> Result<&str, Utf8Error> {
        converts::from_utf8(v)
    }

    /// 基本用法：
    ///
    /// # 错误字节：
    ///
    /// 基本用法：
    ///
    /// ```
    /// // "Hello, Rust!" as a mutable vector
    /// let mut hellorust = vec![72, 101, 108, 108, 111, 44, 32, 82, 117, 115, 116, 33];
    ///
    /// // As we know these bytes are valid, we can use `unwrap()`
    /// let outstr = str::from_utf8_mut(&mut hellorust).unwrap();
    ///
    /// assert_eq!("Hello, Rust!", outstr);
    /// ```
    ///
    /// 错误字节：
    ///
    /// ```
    /// // Some invalid bytes in a mutable vector
    /// let mut invalid = vec![128, 223];
    ///
    /// assert!(str::from_utf8_mut(&mut invalid).is_err());
    /// ```
    /// See the docs for [`Utf8Error`] for more details on the kinds of
    /// # 示例
    #[stable(feature = "inherent_str_constructors", since = "1.87.0")]
    #[rustc_const_stable(feature = "const_str_from_utf8", since = "1.87.0")]
    #[rustc_diagnostic_item = "str_inherent_from_utf8_mut"]
    pub const fn from_utf8_mut(v: &mut [u8]) -> Result<&mut str, Utf8Error> {
        converts::from_utf8_mut(v)
    }

    /// 将字节切片转换为字符串切片，而不检查
    /// 该字符串是否包含有效的 UTF-8。
    ///
    /// See the safe version, [`from_utf8`], for more information.
    ///
    /// # 安全性
    ///
    /// 传入的字节必须是有效的 UTF-8。
    ///
    /// # 示例
    ///
    /// 基本用法：
    ///
    /// ```
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
    #[stable(feature = "inherent_str_constructors", since = "1.87.0")]
    #[rustc_const_stable(feature = "inherent_str_constructors", since = "1.87.0")]
    #[rustc_diagnostic_item = "str_inherent_from_utf8_unchecked"]
    pub const unsafe fn from_utf8_unchecked(v: &[u8]) -> &str {
        // SAFETY: converts::from_utf8_unchecked has the same safety requirements as this function.
        unsafe { converts::from_utf8_unchecked(v) }
    }

    /// 将字节切片转换为字符串切片，而不检查
    /// 该字符串是否包含有效的 UTF-8；可变版本。
    ///
    /// # 安全性
    ///
    /// See the immutable version, [`from_utf8_unchecked()`] for documentation and safety requirements.
    ///
    /// # 示例
    ///
    /// 基本用法：
    ///
    /// ```
    /// let mut heart = vec![240, 159, 146, 150];
    /// let heart = unsafe { str::from_utf8_unchecked_mut(&mut heart) };
    ///
    /// assert_eq!("💖", heart);
    /// ```
    #[inline]
    #[must_use]
    #[stable(feature = "inherent_str_constructors", since = "1.87.0")]
    #[rustc_const_stable(feature = "inherent_str_constructors", since = "1.87.0")]
    #[rustc_diagnostic_item = "str_inherent_from_utf8_unchecked_mut"]
    pub const unsafe fn from_utf8_unchecked_mut(v: &mut [u8]) -> &mut str {
        // SAFETY: converts::from_utf8_unchecked_mut has the same safety requirements as this function.
        unsafe { converts::from_utf8_unchecked_mut(v) }
    }

    /// Checks that `index`-th byte is the first byte in a UTF-8 code point
    /// sequence or the end of the string.
    ///
    /// The start and end of the string (when `index == self.len()`) are
    /// 被视为边界。
    ///
    /// Returns `false` if `index` is greater than `self.len()`.
    ///
    /// # 示例
    ///
    /// ```
    /// let s = "Löwe 老虎 Léopard";
    /// assert!(s.is_char_boundary(0));
    /// // start of `老`
    /// assert!(s.is_char_boundary(6));
    /// assert!(s.is_char_boundary(s.len()));
    ///
    /// // second byte of `ö`
    /// assert!(!s.is_char_boundary(2));
    ///
    /// // third byte of `老`
    /// assert!(!s.is_char_boundary(8));
    /// ```
    #[must_use]
    #[stable(feature = "is_char_boundary", since = "1.9.0")]
    #[rustc_const_stable(feature = "const_is_char_boundary", since = "1.86.0")]
    #[inline]
    pub const fn is_char_boundary(&self, index: usize) -> bool {
        // 0 is always ok.
        // Test for 0 explicitly so that it can optimize out the check
        // easily and skip reading string data for that case.
        // Note that optimizing `self.get(..index)` relies on this.
        if index == 0 {
            return true;
        }

        if index >= self.len() {
            // For `true` we have two options:
            //
            // - index == self.len()
            //   Empty strings are valid, so return true
            // - index > self.len()
            //   In this case return false
            //
            // The check is placed exactly here, because it improves generated
            // code on higher opt-levels. See PR #84751 for more details.
            index == self.len()
        } else {
            self.as_bytes()[index].is_utf8_char_boundary()
        }
    }

    /// Finds the closest `x` not exceeding `index` where [`is_char_boundary(x)`] is `true`.
    ///
    /// 此方法可以帮助你截断字符串，使其仍为有效的 UTF-8 格式，但不会
    /// 超过给定的字节数。请注意，这完全是在字符级别进行的操作。
    /// 即使底层字符没有被拆分，它仍然可以视觉上分割字符。例如，表情符号 🧑‍🔬（科学家）可以被拆分，使得字符串中只包含 🧑（人）。
    /// # 示例
    /// includes 🧑 (person) instead.
    ///
    /// [`is_char_boundary(x)`]: Self::is_char_boundary
    ///
    /// # 示例
    ///
    /// ```
    /// let s = "❤️🧡💛💚💙💜";
    /// assert_eq!(s.len(), 26);
    /// assert!(!s.is_char_boundary(13));
    ///
    /// let closest = s.floor_char_boundary(13);
    /// assert_eq!(closest, 10);
    /// assert_eq!(&s[..closest], "❤️🧡");
    /// ```
    #[stable(feature = "round_char_boundary", since = "1.91.0")]
    #[rustc_const_stable(feature = "round_char_boundary", since = "1.91.0")]
    #[inline]
    pub const fn floor_char_boundary(&self, index: usize) -> usize {
        if index >= self.len() {
            return self.len();
        }
        if self.as_bytes()[index].is_utf8_char_boundary() {
            return index;
        }
        // Unlike `ceil_char_boundary`, the loop is unrolled manually to prevent the compiler from
        // generating excessive unrolled loop bodies when `index` is statically known.

        // The first byte of `&str` must always be a char boundary, so we can assume `i > 0` below
        // for any `i` where `self.as_bytes()[i]` is not a char boundary.
        debug_assert!(self.as_bytes()[0].is_utf8_char_boundary());

        // SAFETY: `self.as_bytes()[0]` is always a char boundary with valid `&str`
        unsafe { assert_unchecked(index >= 1) };
        if self.as_bytes()[index - 1].is_utf8_char_boundary() {
            return index - 1;
        }

        // SAFETY: `self.as_bytes()[0]` is always a char boundary with valid `&str`
        unsafe { assert_unchecked(index >= 2) };
        if self.as_bytes()[index - 2].is_utf8_char_boundary() {
            return index - 2;
        }

        // `self.as_bytes()[0]` is always a char boundary with valid `&str`
        debug_assert!(index >= 3);
        // The character boundary will be within four bytes of the index
        debug_assert!(self.as_bytes()[index - 3].is_utf8_char_boundary());
        index - 3
    }

    /// Finds the closest `x` not below `index` where [`is_char_boundary(x)`] is `true`.
    ///
    /// If `index` is greater than the length of the string, this returns the length of the string.
    ///
    /// This method is the natural complement to [`floor_char_boundary`]. See that method
    /// # 示例
    ///
    /// [`floor_char_boundary`]: str::floor_char_boundary
    /// [`is_char_boundary(x)`]: Self::is_char_boundary
    ///
    /// # 示例
    ///
    /// ```
    /// let s = "❤️🧡💛💚💙💜";
    /// assert_eq!(s.len(), 26);
    /// assert!(!s.is_char_boundary(13));
    ///
    /// let closest = s.ceil_char_boundary(13);
    /// assert_eq!(closest, 14);
    /// assert_eq!(&s[..closest], "❤️🧡💛");
    /// ```
    #[stable(feature = "round_char_boundary", since = "1.91.0")]
    #[rustc_const_stable(feature = "round_char_boundary", since = "1.91.0")]
    #[inline]
    pub const fn ceil_char_boundary(&self, index: usize) -> usize {
        if index >= self.len() {
            self.len()
        } else {
            let mut i = index;
            while !self.as_bytes()[i].is_utf8_char_boundary() {
                i += 1;
                if i >= self.len() {
                    break;
                }
            }

            // The character boundary will be within four bytes of the index
            debug_assert!(i <= index + 3);

            i
        }
    }

    /// 将字符串切片转换为字节切片。要将字节切片转换回
    /// into a string slice, use the [`from_utf8`] function.
    ///
    /// # 示例
    ///
    /// ```
    /// let bytes = "bors".as_bytes();
    /// assert_eq!(b"bors", bytes);
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "str_as_bytes", since = "1.39.0")]
    #[must_use]
    #[inline(always)]
    pub const fn as_bytes(&self) -> &[u8] {
        // SAFETY: const sound because we transmute two types with the same layout
        unsafe { mem::transmute(self) }
    }

    /// 将可变的字符串切片转换为可变的字节切片。
    ///
    /// # 安全性
    ///
    /// The caller must ensure that the content of the slice is valid UTF-8
    /// before the borrow ends and the underlying `str` is used.
    ///
    /// Use of a `str` whose contents are not valid UTF-8 is undefined behavior.
    ///
    /// # 示例
    ///
    /// 基本用法：
    ///
    /// ```
    /// let mut s = String::from("Hello");
    /// let bytes = unsafe { s.as_bytes_mut() };
    ///
    /// assert_eq!(b"Hello", bytes);
    /// ```
    ///
    /// 可变性：
    ///
    /// ```
    /// let mut s = String::from("🗻∈🌏");
    ///
    /// unsafe {
    ///     let bytes = s.as_bytes_mut();
    ///
    ///     bytes[0] = 0xF0;
    ///     bytes[1] = 0x9F;
    ///     bytes[2] = 0x8D;
    ///     bytes[3] = 0x94;
    /// }
    ///
    /// assert_eq!("🍔∈🌏", s);
    /// ```
    #[stable(feature = "str_mut_extras", since = "1.20.0")]
    #[rustc_const_stable(feature = "const_str_as_mut", since = "1.83.0")]
    #[must_use]
    #[inline(always)]
    pub const unsafe fn as_bytes_mut(&mut self) -> &mut [u8] {
        // SAFETY: the cast from `&str` to `&[u8]` is safe since `str`
        // has the same layout as `&[u8]` (only std can make this guarantee).
        // The pointer dereference is safe since it comes from a mutable reference which
        // is guaranteed to be valid for writes.
        unsafe { &mut *(self as *mut str as *mut [u8]) }
    }

    /// 将字符串切片转换为原始指针。
    ///
    /// 由于字符串切片是字节切片，原始指针指向一个
    /// [`u8`]. This pointer will be pointing to the first byte of the string
    /// 切片。
    ///
    /// 调用者必须确保返回的指针永远不会被写入。
    /// If you need to mutate the contents of the string slice, use [`as_mut_ptr`].
    ///
    /// [`as_mut_ptr`]: str::as_mut_ptr
    ///
    /// # 示例
    ///
    /// ```
    /// let s = "Hello";
    /// let ptr = s.as_ptr();
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "rustc_str_as_ptr", since = "1.32.0")]
    #[must_use]
    #[inline(always)]
    #[lint::as_ptr]
    #[lint::never_returns_null_ptr]
    pub const fn as_ptr(&self) -> *const u8 {
        self as *const str as *const u8
    }

    /// 将可变的字符串切片转换为原始指针。
    ///
    /// 由于字符串切片是字节切片，原始指针指向一个
    /// [`u8`]. This pointer will be pointing to the first byte of the string
    /// 切片。
    ///
    /// 你有责任确保字符串切片仅以保持有效 UTF-8 的方式被修改。
    /// 以保持有效 UTF-8 的方式被修改。
    #[stable(feature = "str_as_mut_ptr", since = "1.36.0")]
    #[rustc_const_stable(feature = "const_str_as_mut", since = "1.83.0")]
    #[must_use]
    #[inline(always)]
    #[rustc_no_writable]
    #[lint::as_ptr]
    #[lint::never_returns_null_ptr]
    pub const fn as_mut_ptr(&mut self) -> *mut u8 {
        self as *mut str as *mut u8
    }

    /// Returns a subslice of `str`.
    ///
    /// This is the non-panicking alternative to indexing the `str`. Returns
    /// [`None`] whenever equivalent indexing operation would panic.
    ///
    /// # 示例
    ///
    /// ```
    /// let v = String::from("🗻∈🌏");
    ///
    /// assert_eq!(Some("🗻"), v.get(0..4));
    ///
    /// // indices not on UTF-8 sequence boundaries
    /// assert!(v.get(1..).is_none());
    /// assert!(v.get(..8).is_none());
    ///
    /// // out of bounds
    /// assert!(v.get(..42).is_none());
    /// ```
    #[stable(feature = "str_checked_slicing", since = "1.20.0")]
    #[rustc_const_unstable(feature = "const_index", issue = "143775")]
    #[inline]
    pub const fn get<I: [const] SliceIndex<str>>(&self, i: I) -> Option<&I::Output> {
        i.get(self)
    }

    /// Returns a mutable subslice of `str`.
    ///
    /// This is the non-panicking alternative to indexing the `str`. Returns
    /// [`None`] whenever equivalent indexing operation would panic.
    ///
    /// # 示例
    ///
    /// ```
    /// let mut v = String::from("hello");
    /// // correct length
    /// assert!(v.get_mut(0..5).is_some());
    /// // out of bounds
    /// assert!(v.get_mut(..42).is_none());
    /// assert_eq!(Some("he"), v.get_mut(0..2).map(|v| &*v));
    ///
    /// assert_eq!("hello", v);
    /// {
    ///     let s = v.get_mut(0..2);
    ///     let s = s.map(|s| {
    ///         s.make_ascii_uppercase();
    ///         &*s
    ///     });
    ///     assert_eq!(Some("HE"), s);
    /// }
    /// assert_eq!("HEllo", v);
    /// ```
    #[stable(feature = "str_checked_slicing", since = "1.20.0")]
    #[rustc_const_unstable(feature = "const_index", issue = "143775")]
    #[inline]
    pub const fn get_mut<I: [const] SliceIndex<str>>(&mut self, i: I) -> Option<&mut I::Output> {
        i.get_mut(self)
    }

    /// Returns an unchecked subslice of `str`.
    ///
    /// This is the unchecked alternative to indexing the `str`.
    ///
    /// # 安全性
    ///
    /// 此函数的调用者需确保以下前提条件得到满足：
    /// * 起始索引不得超过结束索引；
    ///
    /// * 索引必须在原始切片的边界内；
    /// * 索引必须位于 UTF-8 序列的边界上。
    /// * Indexes must lie on UTF-8 sequence boundaries.
    ///
    /// 如果不满足上述条件，返回的字符串切片可能引用无效内存或
    /// violate the invariants communicated by the `str` type.
    ///
    /// # 示例
    ///
    /// ```
    /// let v = "🗻∈🌏";
    /// unsafe {
    ///     assert_eq!("🗻", v.get_unchecked(0..4));
    ///     assert_eq!("∈", v.get_unchecked(4..7));
    ///     assert_eq!("🌏", v.get_unchecked(7..11));
    /// }
    /// ```
    #[stable(feature = "str_checked_slicing", since = "1.20.0")]
    #[inline]
    pub unsafe fn get_unchecked<I: SliceIndex<str>>(&self, i: I) -> &I::Output {
        // SAFETY: the caller must uphold the safety contract for `get_unchecked`;
        // the slice is dereferenceable because `self` is a safe reference.
        // The returned pointer is safe because impls of `SliceIndex` have to guarantee that it is.
        unsafe { &*i.get_unchecked(self) }
    }

    /// Returns a mutable, unchecked subslice of `str`.
    ///
    /// This is the unchecked alternative to indexing the `str`.
    ///
    /// # 安全性
    ///
    /// 此函数的调用者需确保以下前提条件得到满足：
    /// * 起始索引不得超过结束索引；
    ///
    /// * 索引必须在原始切片的边界内；
    /// * 索引必须位于 UTF-8 序列的边界上。
    /// * 索引必须位于 UTF-8 序列的边界上。
    ///
    /// 如果不满足上述条件，返回的字符串切片可能引用无效内存或
    /// violate the invariants communicated by the `str` type.
    ///
    /// # 示例
    ///
    /// ```
    /// let mut v = String::from("🗻∈🌏");
    /// unsafe {
    ///     assert_eq!("🗻", v.get_unchecked_mut(0..4));
    ///     assert_eq!("∈", v.get_unchecked_mut(4..7));
    ///     assert_eq!("🌏", v.get_unchecked_mut(7..11));
    /// }
    /// ```
    #[stable(feature = "str_checked_slicing", since = "1.20.0")]
    #[inline]
    pub unsafe fn get_unchecked_mut<I: SliceIndex<str>>(&mut self, i: I) -> &mut I::Output {
        // SAFETY: the caller must uphold the safety contract for `get_unchecked_mut`;
        // the slice is dereferenceable because `self` is a safe reference.
        // The returned pointer is safe because impls of `SliceIndex` have to guarantee that it is.
        unsafe { &mut *i.get_unchecked_mut(self) }
    }

    /// 从另一个字符串切片创建字符串切片，绕过安全性检查。
    /// 检查。
    ///
    /// 通常不推荐此做法，请谨慎使用！如需安全的
    /// alternative see [`str`] and [`Index`].
    ///
    /// [`Index`]: crate::ops::Index
    ///
    /// This new slice goes from `begin` to `end`, including `begin` but
    /// excluding `end`.
    ///
    /// To get a mutable string slice instead, see the
    /// [`slice_mut_unchecked`] method.
    ///
    /// [`slice_mut_unchecked`]: str::slice_mut_unchecked
    ///
    /// # 安全性
    ///
    /// 此函数的调用者需确保以下三个前提条件得到满足：
    /// 满足：
    ///
    /// * `begin` must not exceed `end`.
    /// * `begin` and `end` must be byte positions within the string slice.
    /// * `begin` and `end` must lie on UTF-8 sequence boundaries.
    ///
    /// # 示例
    ///
    /// ```
    /// let s = "Löwe 老虎 Léopard";
    ///
    /// unsafe {
    ///     assert_eq!("Löwe 老虎 Léopard", s.slice_unchecked(0, 21));
    /// }
    ///
    /// let s = "Hello, world!";
    ///
    /// unsafe {
    ///     assert_eq!("world", s.slice_unchecked(7, 12));
    /// }
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[deprecated(since = "1.29.0", note = "use `get_unchecked(begin..end)` instead")]
    #[must_use]
    #[inline]
    pub unsafe fn slice_unchecked(&self, begin: usize, end: usize) -> &str {
        // SAFETY: the caller must uphold the safety contract for `get_unchecked`;
        // the slice is dereferenceable because `self` is a safe reference.
        // The returned pointer is safe because impls of `SliceIndex` have to guarantee that it is.
        unsafe { &*(begin..end).get_unchecked(self) }
    }

    /// 从另一个字符串切片创建字符串切片，绕过安全性检查。
    /// 检查。
    ///
    /// 通常不推荐此做法，请谨慎使用！如需安全的
    /// alternative see [`str`] and [`IndexMut`].
    ///
    /// [`IndexMut`]: crate::ops::IndexMut
    ///
    /// This new slice goes from `begin` to `end`, including `begin` but
    /// excluding `end`.
    ///
    /// 若要获取不可变的字符串切片，请参阅
    /// [`slice_unchecked`] method.
    ///
    /// [`slice_unchecked`]: str::slice_unchecked
    ///
    /// # 安全性
    ///
    /// 此函数的调用者需确保以下三个前提条件得到满足：
    /// 满足：
    ///
    /// * `begin` must not exceed `end`.
    /// * `begin` and `end` must be byte positions within the string slice.
    /// * `begin` and `end` must lie on UTF-8 sequence boundaries.
    #[stable(feature = "str_slice_mut", since = "1.5.0")]
    #[deprecated(since = "1.29.0", note = "use `get_unchecked_mut(begin..end)` instead")]
    #[inline]
    pub unsafe fn slice_mut_unchecked(&mut self, begin: usize, end: usize) -> &mut str {
        // SAFETY: the caller must uphold the safety contract for `get_unchecked_mut`;
        // the slice is dereferenceable because `self` is a safe reference.
        // The returned pointer is safe because impls of `SliceIndex` have to guarantee that it is.
        unsafe { &mut *(begin..end).get_unchecked_mut(self) }
    }

    /// 在字节偏移处将一个字符串切片分为两部分。
    ///
    /// The argument, `mid`, should be a byte offset from the start of the
    /// 该偏移量还必须位于一个 UTF-8 代码点边界上。
    ///
    /// The first returned slice contains exactly the first `mid` bytes, and the
    /// second contains all remaining bytes.
    ///
    /// To get mutable string slices instead, see the [`split_at_mut`]
    /// method.
    ///
    /// [`split_at_mut`]: str::split_at_mut
    ///
    /// # 字符串切片的最后一个代码点末尾，则会发生 panic。对于非 panic 情况，
    ///
    /// Panics if `mid` is not on a UTF-8 code point boundary, or if it is past
    /// # Examples
    /// alternative see [`split_at_checked`](str::split_at_checked).
    ///
    /// # Examples
    ///
    /// ```
    /// let s = "Per Martin-Löf";
    ///
    /// let (first, last) = s.split_at(3);
    ///
    /// assert_eq!("Per", first);
    /// assert_eq!(" Martin-Löf", last);
    /// ```
    #[inline]
    #[must_use]
    #[stable(feature = "str_split_at", since = "1.4.0")]
    #[rustc_const_stable(feature = "const_str_split_at", since = "1.86.0")]
    pub const fn split_at(&self, mid: usize) -> (&str, &str) {
        match self.split_at_checked(mid) {
            None => slice_error_fail(self, 0, mid),
            Some(pair) => pair,
        }
    }

    /// 在字节偏移量处将一个可变的字符串切片分为两部分。
    ///
    /// The argument, `mid`, should be a byte offset from the start of the
    /// string. It must also be on the boundary of a UTF-8 code point.
    ///
    /// The first returned slice contains exactly the first `mid` bytes, and the
    /// # Panics
    ///
    /// To get immutable string slices instead, see the [`split_at`] method.
    ///
    /// [`split_at`]: str::split_at
    ///
    /// # 字符串切片的最后一个代码点末尾，则会发生 panic。对于非 panic 情况，
    ///
    /// Panics if `mid` is not on a UTF-8 code point boundary, or if it is past
    /// # Examples
    /// alternative see [`split_at_mut_checked`](str::split_at_mut_checked).
    ///
    /// # Examples
    ///
    /// ```
    /// let mut s = "Per Martin-Löf".to_string();
    /// {
    ///     let (first, last) = s.split_at_mut(3);
    ///     first.make_ascii_uppercase();
    ///     assert_eq!("PER", first);
    ///     assert_eq!(" Martin-Löf", last);
    /// }
    /// assert_eq!("PER Martin-Löf", s);
    /// ```
    #[inline]
    #[must_use]
    #[stable(feature = "str_split_at", since = "1.4.0")]
    #[rustc_const_stable(feature = "const_str_split_at", since = "1.86.0")]
    pub const fn split_at_mut(&mut self, mid: usize) -> (&mut str, &mut str) {
        // is_char_boundary checks that the index is in [0, .len()]
        if self.is_char_boundary(mid) {
            // SAFETY: just checked that `mid` is on a char boundary.
            unsafe { self.split_at_mut_unchecked(mid) }
        } else {
            slice_error_fail(self, 0, mid)
        }
    }

    /// 在字节偏移量处将一个字符串切片分为两部分。
    ///
    /// The argument, `mid`, should be a valid byte offset from the start of the
    /// string. It must also be on the boundary of a UTF-8 code point. The
    /// method returns `None` if that’s not the case.
    ///
    /// The first returned slice contains exactly the first `mid` bytes, and the
    /// # Panics
    ///
    /// To get mutable string slices instead, see the [`split_at_mut_checked`]
    /// 字符串切片的最后一个代码点末尾，则会发生 panic。对于非 panic 情况，
    ///
    /// [`split_at_mut_checked`]: str::split_at_mut_checked
    ///
    /// # Examples
    ///
    /// ```
    /// let s = "Per Martin-Löf";
    ///
    /// let (first, last) = s.split_at_checked(3).unwrap();
    /// assert_eq!("Per", first);
    /// assert_eq!(" Martin-Löf", last);
    ///
    /// assert_eq!(None, s.split_at_checked(13));  // Inside “ö”
    /// assert_eq!(None, s.split_at_checked(16));  // Beyond the string length
    /// ```
    #[inline]
    #[must_use]
    #[stable(feature = "split_at_checked", since = "1.80.0")]
    #[rustc_const_stable(feature = "const_str_split_at", since = "1.86.0")]
    pub const fn split_at_checked(&self, mid: usize) -> Option<(&str, &str)> {
        // is_char_boundary checks that the index is in [0, .len()]
        if self.is_char_boundary(mid) {
            // SAFETY: just checked that `mid` is on a char boundary.
            Some(unsafe { self.split_at_unchecked(mid) })
        } else {
            None
        }
    }

    /// 在字节偏移量处将一个可变的字符串切片分为两部分。
    ///
    /// The argument, `mid`, should be a valid byte offset from the start of the
    /// string. It must also be on the boundary of a UTF-8 code point. The
    /// method returns `None` if that’s not the case.
    ///
    /// The first returned slice contains exactly the first `mid` bytes, and the
    /// # Examples
    ///
    /// To get immutable string slices instead, see the [`split_at_checked`] method.
    ///
    /// [`split_at_checked`]: str::split_at_checked
    ///
    /// # Examples
    ///
    /// ```
    /// let mut s = "Per Martin-Löf".to_string();
    /// if let Some((first, last)) = s.split_at_mut_checked(3) {
    ///     first.make_ascii_uppercase();
    ///     assert_eq!("PER", first);
    ///     assert_eq!(" Martin-Löf", last);
    /// }
    /// assert_eq!("PER Martin-Löf", s);
    ///
    /// assert_eq!(None, s.split_at_mut_checked(13));  // Inside “ö”
    /// assert_eq!(None, s.split_at_mut_checked(16));  // Beyond the string length
    /// ```
    #[inline]
    #[must_use]
    #[stable(feature = "split_at_checked", since = "1.80.0")]
    #[rustc_const_stable(feature = "const_str_split_at", since = "1.86.0")]
    pub const fn split_at_mut_checked(&mut self, mid: usize) -> Option<(&mut str, &mut str)> {
        // is_char_boundary checks that the index is in [0, .len()]
        if self.is_char_boundary(mid) {
            // SAFETY: just checked that `mid` is on a char boundary.
            Some(unsafe { self.split_at_mut_unchecked(mid) })
        } else {
            None
        }
    }

    /// 在字节偏移量处将一个字符串切片分为两部分。
    ///
    /// # Safety
    ///
    /// The caller must ensure that `mid` is a valid byte offset from the start
    /// 在字节偏移量处将一个可变的字符串切片分为两部分。
    #[inline]
    #[must_use]
    #[unstable(feature = "str_split_at_unchecked", issue = "165545")]
    pub const unsafe fn split_at_unchecked(&self, mid: usize) -> (&str, &str) {
        let len = self.len();
        let ptr = self.as_ptr();

        assert_unsafe_precondition!(
            check_library_ub,
            "str::split_at_unchecked requires the index to be on a UTF-8 boundary",
            (it: &str = self, mid: usize = mid) => it.is_char_boundary(mid),
        );

        // SAFETY: caller guarantees `mid` is on a char boundary.
        unsafe {
            (
                from_utf8_unchecked(slice::from_raw_parts(ptr, mid)),
                from_utf8_unchecked(slice::from_raw_parts(ptr.add(mid), len - mid)),
            )
        }
    }

    /// 在字节偏移量处将一个可变的字符串切片分为两部分。
    ///
    /// # Safety
    ///
    /// The caller must ensure that `mid` is a valid byte offset from the start
    /// 位于字符串的边界处，属于 UTF-8 代码点。
    #[inline]
    #[must_use]
    #[unstable(feature = "str_split_at_unchecked", issue = "165545")]
    pub const unsafe fn split_at_mut_unchecked(&mut self, mid: usize) -> (&mut str, &mut str) {
        let len = self.len();
        let ptr = self.as_mut_ptr();

        assert_unsafe_precondition!(
            check_library_ub,
            "str::split_at_mut_unchecked requires the index to be on a UTF-8 boundary",
            (it: &str = self, mid: usize = mid) => it.is_char_boundary(mid),
        );

        // SAFETY: caller guarantees `mid` is on a char boundary.
        unsafe {
            (
                from_utf8_unchecked_mut(slice::from_raw_parts_mut(ptr, mid)),
                from_utf8_unchecked_mut(slice::from_raw_parts_mut(ptr.add(mid), len - mid)),
            )
        }
    }

    /// Returns an iterator over the [`char`]s of a string slice.
    ///
    /// 由于字符串切片由有效的 UTF-8 字符组成，我们可以遍历它
    /// string slice by [`char`]. This method returns such an iterator.
    ///
    /// It's important to remember that [`char`] represents a Unicode Scalar
    /// 可能不符合你对“字符”的想象。实际上你可能想要遍历
    /// 字符群。此功能
    /// 不是 Rust 标准库提供的，请查看 crates.io。
    ///
    /// # 示例
    ///
    /// 基本用法：
    ///
    /// ```
    /// let word = "goodbye";
    ///
    /// let count = word.chars().count();
    /// assert_eq!(7, count);
    ///
    /// let mut chars = word.chars();
    ///
    /// assert_eq!(Some('g'), chars.next());
    /// assert_eq!(Some('o'), chars.next());
    /// assert_eq!(Some('o'), chars.next());
    /// assert_eq!(Some('d'), chars.next());
    /// assert_eq!(Some('b'), chars.next());
    /// assert_eq!(Some('y'), chars.next());
    /// assert_eq!(Some('e'), chars.next());
    ///
    /// assert_eq!(None, chars.next());
    /// ```
    ///
    /// Remember, [`char`]s might not match your intuition about characters:
    ///
    /// [`char`]: prim@char
    ///
    /// ```
    /// let y = "y̆";
    ///
    /// let mut chars = y.chars();
    ///
    /// assert_eq!(Some('y'), chars.next()); // not 'y̆'
    /// assert_eq!(Some('\u{0306}'), chars.next());
    ///
    /// assert_eq!(None, chars.next());
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    #[rustc_diagnostic_item = "str_chars"]
    pub fn chars(&self) -> Chars<'_> {
        Chars { iter: self.as_bytes().iter() }
    }

    /// Returns an iterator over the [`char`]s of a string slice, and their
    /// 由于字符串切片由有效的 UTF-8 字符组成，我们可以遍历它
    ///
    /// As a string slice consists of valid UTF-8, we can iterate through a
    /// string slice by [`char`]. This method returns an iterator of both
    /// these [`char`]s, as well as their byte positions.
    ///
    /// The iterator yields tuples. The position is first, the [`char`] is
    /// # 示例
    ///
    /// # 基本用法：
    ///
    /// Basic usage:
    ///
    /// ```
    /// let word = "goodbye";
    ///
    /// let count = word.char_indices().count();
    /// assert_eq!(7, count);
    ///
    /// let mut char_indices = word.char_indices();
    ///
    /// assert_eq!(Some((0, 'g')), char_indices.next());
    /// assert_eq!(Some((1, 'o')), char_indices.next());
    /// assert_eq!(Some((2, 'o')), char_indices.next());
    /// assert_eq!(Some((3, 'd')), char_indices.next());
    /// assert_eq!(Some((4, 'b')), char_indices.next());
    /// assert_eq!(Some((5, 'y')), char_indices.next());
    /// assert_eq!(Some((6, 'e')), char_indices.next());
    ///
    /// assert_eq!(None, char_indices.next());
    /// ```
    ///
    /// Remember, [`char`]s might not match your intuition about characters:
    ///
    /// [`char`]: prim@char
    ///
    /// ```
    /// let yes = "y̆es";
    ///
    /// let mut char_indices = yes.char_indices();
    ///
    /// assert_eq!(Some((0, 'y')), char_indices.next()); // not (0, 'y̆')
    /// assert_eq!(Some((1, '\u{0306}')), char_indices.next());
    ///
    /// // note the 3 here - the previous character took up two bytes
    /// assert_eq!(Some((3, 'e')), char_indices.next());
    /// assert_eq!(Some((4, 's')), char_indices.next());
    ///
    /// assert_eq!(None, char_indices.next());
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    pub fn char_indices(&self) -> CharIndices<'_> {
        CharIndices { front_offset: 0, iter: self.chars() }
    }

    /// 返回一个字符串切片中字节的迭代器。
    ///
    /// 由于字符串切片由一系列字节组成，我们可以遍历它
    /// 通过字节来遍历字符串切片。此方法返回这样的迭代器。
    ///
    /// # 示例
    ///
    /// ```
    /// let mut bytes = "bors".bytes();
    ///
    /// assert_eq!(Some(b'b'), bytes.next());
    /// assert_eq!(Some(b'o'), bytes.next());
    /// assert_eq!(Some(b'r'), bytes.next());
    /// assert_eq!(Some(b's'), bytes.next());
    ///
    /// assert_eq!(None, bytes.next());
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    pub fn bytes(&self) -> Bytes<'_> {
        Bytes(self.as_bytes().iter().copied())
    }

    /// 按空白字符分割字符串切片。
    ///
    /// 返回的迭代器将返回作为原始字符串切片子切片的字符串切片，
    /// 由任意数量的空白字符分隔。
    ///
    /// 'Whitespace' is defined according to the terms of the Unicode Derived
    /// Core Property `White_Space`. If you only want to split on ASCII whitespace
    /// instead, use [`split_ascii_whitespace`].
    ///
    /// [`split_ascii_whitespace`]: str::split_ascii_whitespace
    ///
    /// # 基本用法：
    ///
    /// 所有类型的空白字符都被考虑：
    ///
    /// ```
    /// let mut iter = "A few words".split_whitespace();
    ///
    /// assert_eq!(Some("A"), iter.next());
    /// assert_eq!(Some("few"), iter.next());
    /// assert_eq!(Some("words"), iter.next());
    ///
    /// assert_eq!(None, iter.next());
    /// ```
    ///
    /// 如果字符串为空或全为空白字符，迭代器将不返回任何字符串切片：
    ///
    /// ```
    /// let mut iter = " Mary   had\ta\u{2009}little  \n\t lamb".split_whitespace();
    /// assert_eq!(Some("Mary"), iter.next());
    /// assert_eq!(Some("had"), iter.next());
    /// assert_eq!(Some("a"), iter.next());
    /// assert_eq!(Some("little"), iter.next());
    /// assert_eq!(Some("lamb"), iter.next());
    ///
    /// assert_eq!(None, iter.next());
    /// ```
    ///
    /// 如果字符串为空或全为空白字符，迭代器将不返回任何字符串切片：
    /// ```
    /// assert_eq!("".split_whitespace().next(), None);
    /// assert_eq!("   ".split_whitespace().next(), None);
    /// ```
    #[must_use = "this returns the split string as an iterator, \
                  without modifying the original"]
    #[stable(feature = "split_whitespace", since = "1.1.0")]
    #[rustc_diagnostic_item = "str_split_whitespace"]
    #[inline]
    pub fn split_whitespace(&self) -> SplitWhitespace<'_> {
        SplitWhitespace { inner: self.split(IsWhitespace).filter(IsNotEmpty) }
    }

    /// 按 ASCII 空白字符分割字符串切片。
    ///
    /// 返回的迭代器将返回作为原始字符串切片子切片的字符串切片，
    /// 由任意数量的 ASCII 空白字符分隔。
    ///
    /// This uses the same definition as [`char::is_ascii_whitespace`].
    /// To split by Unicode `Whitespace` instead, use [`split_whitespace`].
    /// Note that because of this difference in definition, even if `s.is_ascii()`
    /// is `true`, `s.split_ascii_whitespace()` behavior will differ from `s.split_whitespace()`
    /// if `s` contains U+000B VERTICAL TAB.
    ///
    /// [`split_whitespace`]: str::split_whitespace
    ///
    /// # 示例
    ///
    /// 基本用法：
    ///
    /// ```
    /// let mut iter = "A few words".split_ascii_whitespace();
    ///
    /// assert_eq!(Some("A"), iter.next());
    /// assert_eq!(Some("few"), iter.next());
    /// assert_eq!(Some("words"), iter.next());
    ///
    /// assert_eq!(None, iter.next());
    /// ```
    ///
    /// 各种 ASCII 空白字符都被考虑。
    /// (see [`char::is_ascii_whitespace`]):
    ///
    /// ```
    /// let mut iter = " Mary   had\ta little  \n\t lamb".split_ascii_whitespace();
    /// assert_eq!(Some("Mary"), iter.next());
    /// assert_eq!(Some("had"), iter.next());
    /// assert_eq!(Some("a"), iter.next());
    /// assert_eq!(Some("little"), iter.next());
    /// assert_eq!(Some("lamb"), iter.next());
    ///
    /// assert_eq!(None, iter.next());
    /// ```
    ///
    /// 如果字符串为空或仅包含ASCII空白字符，迭代器将不输出任何切片：
    /// ```
    /// assert_eq!("".split_ascii_whitespace().next(), None);
    /// assert_eq!("   ".split_ascii_whitespace().next(), None);
    /// ```
    #[must_use = "this returns the split string as an iterator, \
                  without modifying the original"]
    #[stable(feature = "split_ascii_whitespace", since = "1.34.0")]
    #[inline]
    pub fn split_ascii_whitespace(&self) -> SplitAsciiWhitespace<'_> {
        let inner = self.as_bytes().split_ascii_whitespace().inner.map(UnsafeBytesToStr);
        SplitAsciiWhitespace { inner }
    }

    /// 返回一个关于字符串行的迭代器，以切片形式呈现。
    ///
    /// Lines are split at line endings that are either newlines (`\n`) or
    /// sequences of a carriage return followed by a line feed (`\r\n`).
    ///
    /// 行终止符不会被包含在迭代器返回的行中。
    ///
    /// Note that any carriage return (`\r`) not immediately followed by a
    /// line feed (`\n`) does not split a line. These carriage returns are
    /// 最后的行结束是可选的。以最后一行结尾的字符串
    ///
    /// 将返回与其他相同字符串相同的行，而不包含最后一行结束。
    /// 一个空字符串会返回一个空迭代器。
    /// # 示例
    ///
    /// 基本用法：
    ///
    /// # 最后的行不需要任何结束符：
    ///
    /// 基本使用：
    ///
    /// ```
    /// let text = "foo\r\nbar\n\nbaz\r";
    /// let mut lines = text.lines();
    ///
    /// assert_eq!(Some("foo"), lines.next());
    /// assert_eq!(Some("bar"), lines.next());
    /// assert_eq!(Some(""), lines.next());
    /// // Trailing carriage return is included in the last line
    /// assert_eq!(Some("baz\r"), lines.next());
    ///
    /// assert_eq!(None, lines.next());
    /// ```
    ///
    /// 最后的行不需要任何结束符：
    ///
    /// ```
    /// let text = "foo\nbar\n\r\nbaz";
    /// let mut lines = text.lines();
    ///
    /// assert_eq!(Some("foo"), lines.next());
    /// assert_eq!(Some("bar"), lines.next());
    /// assert_eq!(Some(""), lines.next());
    /// assert_eq!(Some("baz"), lines.next());
    ///
    /// assert_eq!(None, lines.next());
    /// ```
    ///
    /// 一个空字符串会返回一个空迭代器：
    ///
    /// ```
    /// let text = "";
    /// let mut lines = text.lines();
    ///
    /// assert_eq!(lines.next(), None);
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    pub fn lines(&self) -> Lines<'_> {
        Lines(self.split_inclusive('\n').map(LinesMap))
    }

    /// 返回一个关于字符串行的迭代器。
    #[stable(feature = "rust1", since = "1.0.0")]
    #[deprecated(since = "1.4.0", note = "use lines() instead now", suggestion = "lines")]
    #[inline]
    #[allow(deprecated)]
    pub fn lines_any(&self) -> LinesAny<'_> {
        LinesAny(self.lines())
    }

    /// Returns an iterator of `u16` over the string encoded
    /// # 示例
    ///
    /// # Examples
    ///
    /// ```
    /// let text = "Zażółć gęślą jaźń";
    ///
    /// let utf8_len = text.len();
    /// let utf16_len = text.encode_utf16().count();
    ///
    /// assert!(utf16_len <= utf8_len);
    /// ```
    #[must_use = "this returns the encoded string as an iterator, \
                  without modifying the original"]
    #[stable(feature = "encode_utf16", since = "1.8.0")]
    pub fn encode_utf16(&self) -> EncodeUtf16<'_> {
        EncodeUtf16 { chars: self.chars(), extra: 0 }
    }

    /// Returns `true` if the given pattern matches a sub-slice of
    /// this string slice.
    ///
    /// Returns `false` if it does not.
    ///
    /// The [pattern] can be a `&str`, [`char`], a slice of [`char`]s, or a
    /// 决定一个字符是否匹配的函数或闭包。
    ///
    /// [`char`]: prim@char
    /// [pattern]: self::pattern
    ///
    /// # 示例
    ///
    /// ```
    /// let bananas = "bananas";
    ///
    /// assert!(bananas.contains("nana"));
    /// assert!(!bananas.contains("apples"));
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    pub fn contains<P: Pattern>(&self, pat: P) -> bool {
        pat.is_contained_in(self)
    }

    /// Returns `true` if the given pattern matches a prefix of this
    /// string slice.
    ///
    /// Returns `false` if it does not.
    ///
    /// The [pattern] can be a `&str`, in which case this function will return true if
    /// the `&str` is a prefix of this string slice.
    ///
    /// The [pattern] can also be a [`char`], a slice of [`char`]s, or a
    /// 决定一个字符是否匹配的函数或闭包。
    /// 这些检查仅针对此字符串切片的第一个字符进行。
    /// Look at the second example below regarding behavior for slices of [`char`]s.
    ///
    /// [`char`]: prim@char
    /// [pattern]: self::pattern
    ///
    /// # 示例
    ///
    /// ```
    /// let bananas = "bananas";
    ///
    /// assert!(bananas.starts_with("bana"));
    /// assert!(!bananas.starts_with("nana"));
    /// ```
    ///
    /// ```
    /// let bananas = "bananas";
    ///
    /// // Note that both of these assert successfully.
    /// assert!(bananas.starts_with(&['b', 'a', 'n', 'a']));
    /// assert!(bananas.starts_with(&['a', 'b', 'c', 'd']));
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_diagnostic_item = "str_starts_with"]
    pub fn starts_with<P: Pattern>(&self, pat: P) -> bool {
        pat.is_prefix_of(self)
    }

    /// Returns `true` if the given pattern matches a suffix of this
    /// string slice.
    ///
    /// Returns `false` if it does not.
    ///
    /// The [pattern] can be a `&str`, [`char`], a slice of [`char`]s, or a
    /// # 示例
    ///
    /// [`char`]: prim@char
    /// [pattern]: self::pattern
    ///
    /// # 返回此字符串切片的第一个字符的字节索引，该字符符合模式。
    ///
    /// ```
    /// let bananas = "bananas";
    ///
    /// assert!(bananas.ends_with("anas"));
    /// assert!(!bananas.ends_with("nana"));
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_diagnostic_item = "str_ends_with"]
    pub fn ends_with<P: Pattern>(&self, pat: P) -> bool
    where
        for<'a> P::Searcher<'a>: ReverseSearcher<'a>,
    {
        pat.is_suffix_of(self)
    }

    /// Returns the byte index of the first character of this string slice that
    /// matches the pattern.
    ///
    /// Returns [`None`] if the pattern doesn't match.
    ///
    /// The [pattern] can be a `&str`, [`char`], a slice of [`char`]s, or a
    /// 用于判断字符是否匹配的函数或闭包。
    ///
    /// [`char`]: prim@char
    /// [pattern]: self::pattern
    ///
    /// # 示例
    ///
    /// 简单模式：
    ///
    /// ```
    /// let s = "Löwe 老虎 Léopard Gepardi";
    ///
    /// assert_eq!(s.find('L'), Some(0));
    /// assert_eq!(s.find('é'), Some(14));
    /// assert_eq!(s.find("pard"), Some(17));
    /// ```
    ///
    /// 使用无点风格和闭包的更复杂模式：
    ///
    /// ```
    /// let s = "Löwe 老虎 Léopard";
    ///
    /// assert_eq!(s.find(char::is_whitespace), Some(5));
    /// assert_eq!(s.find(char::is_lowercase), Some(1));
    /// assert_eq!(s.find(|c: char| c.is_whitespace() || c.is_lowercase()), Some(1));
    /// assert_eq!(s.find(|c: char| (c < 'o') && (c > 'a')), Some(4));
    /// ```
    ///
    /// 未找到模式：
    ///
    /// ```
    /// let s = "Löwe 老虎 Léopard";
    /// let x: &[_] = &['1', '2'];
    ///
    /// assert_eq!(s.find(x), None);
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    pub fn find<P: Pattern>(&self, pat: P) -> Option<usize> {
        pat.into_searcher(self).next_match().map(|(i, _)| i)
    }

    /// 返回字符串切片中模式最后一次匹配的第一个字节索引：
    /// 在该字符串切片中。
    ///
    /// Returns [`None`] if the pattern doesn't match.
    ///
    /// The [pattern] can be a `&str`, [`char`], a slice of [`char`]s, or a
    /// 用于判断字符是否匹配的函数或闭包。
    ///
    /// [`char`]: prim@char
    /// [pattern]: self::pattern
    ///
    /// # 示例
    ///
    /// 简单模式：
    ///
    /// ```
    /// let s = "Löwe 老虎 Léopard Gepardi";
    ///
    /// assert_eq!(s.rfind('L'), Some(13));
    /// assert_eq!(s.rfind('é'), Some(14));
    /// assert_eq!(s.rfind("pard"), Some(24));
    /// ```
    ///
    /// 使用闭包的更复杂模式：
    ///
    /// ```
    /// let s = "Löwe 老虎 Léopard";
    ///
    /// assert_eq!(s.rfind(char::is_whitespace), Some(12));
    /// assert_eq!(s.rfind(char::is_lowercase), Some(20));
    /// ```
    ///
    /// 未找到模式：
    ///
    /// ```
    /// let s = "Löwe 老虎 Léopard";
    /// let x: &[_] = &['1', '2'];
    ///
    /// assert_eq!(s.rfind(x), None);
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    pub fn rfind<P: Pattern>(&self, pat: P) -> Option<usize>
    where
        for<'a> P::Searcher<'a>: ReverseSearcher<'a>,
    {
        pat.into_searcher(self).next_match_back().map(|(i, _)| i)
    }

    /// 返回该字符串切片中由模式匹配的字符分隔的子字符串迭代器。
    /// 模式。
    ///
    /// The [pattern] can be a `&str`, [`char`], a slice of [`char`]s, or a
    /// 用于判断字符是否匹配的函数或闭包。
    ///
    /// 如果没有匹配项，则仅返回整个字符串切片作为迭代器中的唯一元素。
    /// # 迭代器行为
    ///
    /// [`char`]: prim@char
    /// [pattern]: self::pattern
    ///
    /// # 迭代器行为
    ///
    /// The returned iterator will be a [`DoubleEndedIterator`] if the pattern
    /// allows a reverse search and forward/reverse search yields the same
    /// elements. This is true for, e.g., [`char`], but not for `&str`.
    ///
    /// 如果模式允许反向搜索，但其结果可能与正向搜索不同，
    /// from a forward search, the [`rsplit`] method can be used.
    ///
    /// [`rsplit`]: str::rsplit
    ///
    /// # 示例
    ///
    /// 简单模式：
    ///
    /// ```
    /// let v: Vec<&str> = "Mary had a little lamb".split(' ').collect();
    /// assert_eq!(v, ["Mary", "had", "a", "little", "lamb"]);
    ///
    /// let v: Vec<&str> = "".split('X').collect();
    /// assert_eq!(v, [""]);
    ///
    /// let v: Vec<&str> = "lionXXtigerXleopard".split('X').collect();
    /// assert_eq!(v, ["lion", "", "tiger", "leopard"]);
    ///
    /// let v: Vec<&str> = "lion::tiger::leopard".split("::").collect();
    /// assert_eq!(v, ["lion", "tiger", "leopard"]);
    ///
    /// let v: Vec<&str> = "AABBCC".split("DD").collect();
    /// assert_eq!(v, ["AABBCC"]);
    ///
    /// let v: Vec<&str> = "abc1def2ghi".split(char::is_numeric).collect();
    /// assert_eq!(v, ["abc", "def", "ghi"]);
    ///
    /// let v: Vec<&str> = "lionXtigerXleopard".split(char::is_uppercase).collect();
    /// assert_eq!(v, ["lion", "tiger", "leopard"]);
    /// ```
    ///
    /// 如果模式是字符切片，则根据任意字符的出现次数进行分割：
    ///
    /// ```
    /// let v: Vec<&str> = "2020-11-03 23:59".split(&['-', ' ', ':', '@'][..]).collect();
    /// assert_eq!(v, ["2020", "11", "03", "23", "59"]);
    /// ```
    ///
    /// 使用闭包的更复杂模式：
    ///
    /// ```
    /// let v: Vec<&str> = "abc1defXghi".split(|c| c == '1' || c == 'X').collect();
    /// assert_eq!(v, ["abc", "def", "ghi"]);
    /// ```
    ///
    /// 如果字符串包含多个连续分隔符，输出中将会出现
    /// 空字符串。
    ///
    /// ```
    /// let x = "||||a||b|c".to_string();
    /// let d: Vec<_> = x.split('|').collect();
    ///
    /// assert_eq!(d, &["", "", "", "", "a", "", "b", "c"]);
    /// ```
    ///
    /// 连续分隔符之间由空字符串隔开。
    ///
    /// ```
    /// let x = "(///)".to_string();
    /// let d: Vec<_> = x.split('/').collect();
    ///
    /// assert_eq!(d, &["(", "", "", ")"]);
    /// ```
    ///
    /// 位于字符串开头或结尾的分隔符被
    /// 空字符串所包围。
    ///
    /// ```
    /// let d: Vec<_> = "010".split("0").collect();
    /// assert_eq!(d, &["", "1", ""]);
    /// ```
    ///
    /// 当使用空字符串作为分隔符时，它会将
    /// 字符串中的每个字符与字符串的起始和结束位置分开。
    /// 连续分隔符可能导致意外行为，
    ///
    /// ```
    /// let f: Vec<_> = "rust".split("").collect();
    /// assert_eq!(f, &["", "r", "u", "s", "t", ""]);
    /// ```
    ///
    /// 当使用空白字符作为分隔符时尤其如此。此代码是正确的：
    /// 它不会提供：
    ///
    /// ```
    /// let x = "    a  b c".to_string();
    /// let d: Vec<_> = x.split(' ').collect();
    ///
    /// assert_eq!(d, &["", "", "", "", "a", "", "b", "c"]);
    /// ```
    ///
    /// It does _not_ give you:
    ///
    /// ```,ignore
    /// assert_eq!(d, &["a", "b", "c"]);
    /// ```
    ///
    /// Use [`split_whitespace`] for this behavior.
    ///
    /// [`split_whitespace`]: str::split_whitespace
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    pub fn split<P: Pattern>(&self, pat: P) -> Split<'_, P> {
        Split(SplitInternal {
            start: 0,
            end: self.len(),
            matcher: pat.into_searcher(self),
            allow_trailing_empty: true,
            finished: false,
        })
    }

    /// Returns an iterator over substrings of this string slice, separated by
    /// 将匹配部分作为子字符串的终止符。
    ///
    /// Differs from the iterator produced by `split` in that `split_inclusive`
    /// 用于判断字符是否匹配的函数或闭包。
    ///
    /// The [pattern] can be a `&str`, [`char`], a slice of [`char`]s, or a
    /// function or closure that determines if a character matches.
    ///
    /// [`char`]: prim@char
    /// [pattern]: self::pattern
    ///
    /// # 示例
    ///
    /// ```
    /// let v: Vec<&str> = "Mary had a little lamb\nlittle lamb\nlittle lamb."
    ///     .split_inclusive('\n').collect();
    /// assert_eq!(v, ["Mary had a little lamb\n", "little lamb\n", "little lamb."]);
    /// ```
    ///
    /// 如果字符串的最后一个元素被匹配，
    /// 该元素将被视为前面子串的终止符。
    /// 该子串将是迭代器返回的最后一项。
    ///
    /// ```
    /// let v: Vec<&str> = "Mary had a little lamb\nlittle lamb\nlittle lamb.\n"
    ///     .split_inclusive('\n').collect();
    /// assert_eq!(v, ["Mary had a little lamb\n", "little lamb\n", "little lamb.\n"]);
    /// ```
    #[stable(feature = "split_inclusive", since = "1.51.0")]
    #[inline]
    pub fn split_inclusive<P: Pattern>(&self, pat: P) -> SplitInclusive<'_, P> {
        SplitInclusive(SplitInternal {
            start: 0,
            end: self.len(),
            matcher: pat.into_searcher(self),
            allow_trailing_empty: false,
            finished: false,
        })
    }

    /// 返回一个迭代器，用于遍历给定字符串切片的子串，这些子串由
    /// 模式匹配的字符分隔，并按相反顺序输出。
    ///
    /// The [pattern] can be a `&str`, [`char`], a slice of [`char`]s, or a
    /// 一个决定字符是否匹配的函数或闭包。
    ///
    /// [`char`]: prim@char
    /// [pattern]: self::pattern
    ///
    /// # 迭代器行为
    ///
    /// 返回的迭代器要求模式支持反向搜索，并且如果进行正向/反向搜索
    /// search, and it will be a [`DoubleEndedIterator`] if a forward/reverse
    /// search yields the same elements.
    ///
    /// For iterating from the front, the [`split`] method can be used.
    ///
    /// [`split`]: str::split
    ///
    /// # 简单模式：
    ///
    /// 简单的模式：
    ///
    /// ```
    /// let v: Vec<&str> = "Mary had a little lamb".rsplit(' ').collect();
    /// assert_eq!(v, ["lamb", "little", "a", "had", "Mary"]);
    ///
    /// let v: Vec<&str> = "".rsplit('X').collect();
    /// assert_eq!(v, [""]);
    ///
    /// let v: Vec<&str> = "lionXXtigerXleopard".rsplit('X').collect();
    /// assert_eq!(v, ["leopard", "tiger", "", "lion"]);
    ///
    /// let v: Vec<&str> = "lion::tiger::leopard".rsplit("::").collect();
    /// assert_eq!(v, ["leopard", "tiger", "lion"]);
    /// ```
    ///
    /// 更复杂的模式，使用闭包：
    ///
    /// ```
    /// let v: Vec<&str> = "abc1defXghi".rsplit(|c| c == '1' || c == 'X').collect();
    /// assert_eq!(v, ["ghi", "def", "abc"]);
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    pub fn rsplit<P: Pattern>(&self, pat: P) -> RSplit<'_, P>
    where
        for<'a> P::Searcher<'a>: ReverseSearcher<'a>,
    {
        RSplit(self.split(pat).0)
    }

    /// 返回一个迭代器，用于遍历给定字符串切片的子串，这些子串由
    /// 模式匹配的字符分隔。
    ///
    /// The [pattern] can be a `&str`, [`char`], a slice of [`char`]s, or a
    /// 决定字符是否匹配的函数或闭包。
    ///
    /// [`char`]: prim@char
    /// [pattern]: self::pattern
    ///
    /// Equivalent to [`split`], except that the trailing substring
    /// 如果为空则被跳过。
    ///
    /// [`split`]: str::split
    ///
    /// 此方法可用于 _终止_ 的字符串数据，
    /// 而不是由模式 _分隔_ 的字符串数据。
    ///
    /// # 迭代器行为
    ///
    /// The returned iterator will be a [`DoubleEndedIterator`] if the pattern
    /// allows a reverse search and forward/reverse search yields the same
    /// elements. This is true for, e.g., [`char`], but not for `&str`.
    ///
    /// 如果模式允许反向搜索，但其结果可能与正向搜索不同，
    /// from a forward search, the [`rsplit_terminator`] method can be used.
    ///
    /// [`rsplit_terminator`]: str::rsplit_terminator
    ///
    /// # 示例
    ///
    /// ```
    /// let v: Vec<&str> = "A.B.".split_terminator('.').collect();
    /// assert_eq!(v, ["A", "B"]);
    ///
    /// let v: Vec<&str> = "A..B..".split_terminator(".").collect();
    /// assert_eq!(v, ["A", "", "B", ""]);
    ///
    /// let v: Vec<&str> = "A.B:C.D".split_terminator(&['.', ':'][..]).collect();
    /// assert_eq!(v, ["A", "B", "C", "D"]);
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    pub fn split_terminator<P: Pattern>(&self, pat: P) -> SplitTerminator<'_, P> {
        SplitTerminator(SplitInternal { allow_trailing_empty: false, ..self.split(pat).0 })
    }

    /// Returns an iterator over substrings of `self`, separated by characters
    /// 模式匹配的字符分隔，并按相反顺序输出。
    ///
    /// The [pattern] can be a `&str`, [`char`], a slice of [`char`]s, or a
    /// 决定字符是否匹配的函数或闭包。
    ///
    /// [`char`]: prim@char
    /// [pattern]: self::pattern
    ///
    /// Equivalent to [`split`], except that the trailing substring is
    /// 此方法可用于 _终止_ 的字符串数据，
    ///
    /// [`split`]: str::split
    ///
    /// 而不是由模式 _分隔_ 的字符串数据。
    /// # 迭代器行为
    ///
    /// # 返回的迭代器要求模式支持反向搜索，并且如果进行正向/反向搜索
    ///
    /// 产生相同的元素。
    /// 如果进行正向/反向搜索产生相同的元素，则迭代器将是双端结束的。
    /// search yields the same elements.
    ///
    /// For iterating from the front, the [`split_terminator`] method can be
    /// 返回一个迭代器，用于遍历给定字符串切片的子串。
    ///
    /// [`split_terminator`]: str::split_terminator
    ///
    /// # Examples
    ///
    /// ```
    /// let v: Vec<&str> = "A.B.".rsplit_terminator('.').collect();
    /// assert_eq!(v, ["B", "A"]);
    ///
    /// let v: Vec<&str> = "A..B..".rsplit_terminator(".").collect();
    /// assert_eq!(v, ["", "B", "", "A"]);
    ///
    /// let v: Vec<&str> = "A.B:C.D".rsplit_terminator(&['.', ':'][..]).collect();
    /// assert_eq!(v, ["D", "C", "B", "A"]);
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    pub fn rsplit_terminator<P: Pattern>(&self, pat: P) -> RSplitTerminator<'_, P>
    where
        for<'a> P::Searcher<'a>: ReverseSearcher<'a>,
    {
        RSplitTerminator(self.split_terminator(pat).0)
    }

    /// Returns an iterator over substrings of the given string slice, separated
    /// by a pattern, restricted to returning at most `n` items.
    ///
    /// If `n` substrings are returned, the last substring (the `n`th substring)
    /// will contain the remainder of the string.
    ///
    /// The [pattern] can be a `&str`, [`char`], a slice of [`char`]s, or a
    /// # 迭代器行为
    ///
    /// [`char`]: prim@char
    /// [pattern]: self::pattern
    ///
    /// # 迭代器行为
    ///
    /// 返回的迭代器不会是双端迭代器，因为
    /// 支持双端迭代器效率不高。
    ///
    /// If the pattern allows a reverse search, the [`rsplitn`] method can be
    /// # 示例
    ///
    /// [`rsplitn`]: str::rsplitn
    ///
    /// # 示例
    ///
    /// 简单模式：
    ///
    /// ```
    /// let v: Vec<&str> = "Mary had a little lambda".splitn(3, ' ').collect();
    /// assert_eq!(v, ["Mary", "had", "a little lambda"]);
    ///
    /// let v: Vec<&str> = "lionXXtigerXleopard".splitn(3, "X").collect();
    /// assert_eq!(v, ["lion", "", "tigerXleopard"]);
    ///
    /// let v: Vec<&str> = "abcXdef".splitn(1, 'X').collect();
    /// assert_eq!(v, ["abcXdef"]);
    ///
    /// let v: Vec<&str> = "".splitn(1, 'X').collect();
    /// assert_eq!(v, [""]);
    /// ```
    ///
    /// 更复杂的模式，使用闭包：
    ///
    /// ```
    /// let v: Vec<&str> = "abc1defXghi".splitn(2, |c| c == '1' || c == 'X').collect();
    /// assert_eq!(v, ["abc", "defXghi"]);
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    pub fn splitn<P: Pattern>(&self, n: usize, pat: P) -> SplitN<'_, P> {
        SplitN(SplitNInternal { iter: self.split(pat).0, count: n })
    }

    /// 返回一个迭代器，该迭代器遍历此字符串切片的子字符串，这些子字符串由
    /// pattern, starting from the end of the string, restricted to returning at
    /// most `n` items.
    ///
    /// If `n` substrings are returned, the last substring (the `n`th substring)
    /// # 示例
    ///
    /// The [pattern] can be a `&str`, [`char`], a slice of [`char`]s, or a
    /// 决定字符是否匹配的函数或闭包。
    ///
    /// [`char`]: prim@char
    /// [pattern]: self::pattern
    ///
    /// # 迭代器行为
    ///
    /// 返回的迭代器不会是双端迭代器，因为
    /// 支持双端迭代器效率不高。
    ///
    /// For splitting from the front, the [`splitn`] method can be used.
    ///
    /// [`splitn`]: str::splitn
    ///
    /// # 示例
    ///
    /// 简单模式：
    ///
    /// ```
    /// let v: Vec<&str> = "Mary had a little lamb".rsplitn(3, ' ').collect();
    /// assert_eq!(v, ["lamb", "little", "Mary had a"]);
    ///
    /// let v: Vec<&str> = "lionXXtigerXleopard".rsplitn(3, 'X').collect();
    /// assert_eq!(v, ["leopard", "tiger", "lionX"]);
    ///
    /// let v: Vec<&str> = "lion::tiger::leopard".rsplitn(2, "::").collect();
    /// assert_eq!(v, ["leopard", "lion::tiger"]);
    /// ```
    ///
    /// 更复杂的模式，使用闭包：
    ///
    /// ```
    /// let v: Vec<&str> = "abc1defXghi".rsplitn(2, |c| c == '1' || c == 'X').collect();
    /// assert_eq!(v, ["ghi", "abc1def"]);
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    pub fn rsplitn<P: Pattern>(&self, n: usize, pat: P) -> RSplitN<'_, P>
    where
        for<'a> P::Searcher<'a>: ReverseSearcher<'a>,
    {
        RSplitN(self.splitn(n, pat).0)
    }

    /// 在指定分隔符首次出现时分割字符串，并
    /// 返回分隔符前的前缀和分隔符后的后缀。
    ///
    /// # 示例
    ///
    /// ```
    /// assert_eq!("cfg".split_once('='), None);
    /// assert_eq!("cfg=".split_once('='), Some(("cfg", "")));
    /// assert_eq!("cfg=foo".split_once('='), Some(("cfg", "foo")));
    /// assert_eq!("cfg=foo=bar".split_once('='), Some(("cfg", "foo=bar")));
    /// ```
    #[stable(feature = "str_split_once", since = "1.52.0")]
    #[inline]
    pub fn split_once<P: Pattern>(&self, delimiter: P) -> Option<(&'_ str, &'_ str)> {
        let (start, end) = delimiter.into_searcher(self).next_match()?;
        // SAFETY: `Searcher` is known to return valid indices.
        unsafe { Some((self.get_unchecked(..start), self.get_unchecked(end..))) }
    }

    /// 在指定分隔符最后一次出现时分割字符串，并
    /// 返回分隔符前的前缀和分隔符后的后缀。
    ///
    /// # 示例
    ///
    /// ```
    /// assert_eq!("cfg".rsplit_once('='), None);
    /// assert_eq!("cfg=".rsplit_once('='), Some(("cfg", "")));
    /// assert_eq!("cfg=foo".rsplit_once('='), Some(("cfg", "foo")));
    /// assert_eq!("cfg=foo=bar".rsplit_once('='), Some(("cfg=foo", "bar")));
    /// ```
    #[stable(feature = "str_split_once", since = "1.52.0")]
    #[inline]
    pub fn rsplit_once<P: Pattern>(&self, delimiter: P) -> Option<(&'_ str, &'_ str)>
    where
        for<'a> P::Searcher<'a>: ReverseSearcher<'a>,
    {
        let (start, end) = delimiter.into_searcher(self).next_match_back()?;
        // SAFETY: `Searcher` is known to return valid indices.
        unsafe { Some((self.get_unchecked(..start), self.get_unchecked(end..))) }
    }

    /// 返回一个迭代器，用于遍历给定字符串切片中模式的不重叠匹配项。
    /// given string slice.
    ///
    /// The [pattern] can be a `&str`, [`char`], a slice of [`char`]s, or a
    /// # 迭代器行为
    ///
    /// [`char`]: prim@char
    /// [pattern]: self::pattern
    ///
    /// # 迭代器行为
    ///
    /// The returned iterator will be a [`DoubleEndedIterator`] if the pattern
    /// allows a reverse search and forward/reverse search yields the same
    /// elements. This is true for, e.g., [`char`], but not for `&str`.
    ///
    /// If the pattern allows a reverse search but its results might differ
    /// from a forward search, the [`rmatches`] method can be used.
    ///
    /// [`rmatches`]: str::rmatches
    ///
    /// # 返回一个迭代器，用于遍历给定字符串切片中模式的不重叠匹配项，按相反顺序输出。
    ///
    /// ```
    /// let v: Vec<&str> = "abcXXXabcYYYabc".matches("abc").collect();
    /// assert_eq!(v, ["abc", "abc", "abc"]);
    ///
    /// let v: Vec<&str> = "1abc2abc3".matches(char::is_numeric).collect();
    /// assert_eq!(v, ["1", "2", "3"]);
    /// ```
    #[stable(feature = "str_matches", since = "1.2.0")]
    #[inline]
    pub fn matches<P: Pattern>(&self, pat: P) -> Matches<'_, P> {
        Matches(MatchesInternal(pat.into_searcher(self)))
    }

    /// Returns an iterator over the disjoint matches of a pattern within this
    /// string slice, yielded in reverse order.
    ///
    /// The [pattern] can be a `&str`, [`char`], a slice of [`char`]s, or a
    /// 用于判断字符是否匹配的函数或闭包。
    ///
    /// [`char`]: prim@char
    /// [pattern]: self::pattern
    ///
    /// # 迭代器行为
    ///
    /// 返回的迭代器要求模式支持反向搜索，并且如果进行正向/反向搜索
    /// search, and it will be a [`DoubleEndedIterator`] if a forward/reverse
    /// search yields the same elements.
    ///
    /// For iterating from the front, the [`matches`] method can be used.
    ///
    /// [`matches`]: str::matches
    ///
    /// # 示例
    ///
    /// ```
    /// let v: Vec<&str> = "abcXXXabcYYYabc".rmatches("abc").collect();
    /// assert_eq!(v, ["abc", "abc", "abc"]);
    ///
    /// let v: Vec<&str> = "1abc2abc3".rmatches(char::is_numeric).collect();
    /// assert_eq!(v, ["3", "2", "1"]);
    /// ```
    #[stable(feature = "str_matches", since = "1.2.0")]
    #[inline]
    pub fn rmatches<P: Pattern>(&self, pat: P) -> RMatches<'_, P>
    where
        for<'a> P::Searcher<'a>: ReverseSearcher<'a>,
    {
        RMatches(self.matches(pat).0)
    }

    /// 返回该字符串中模式不重叠匹配项的迭代器。
    /// 包括切片以及匹配开始的索引。
    ///
    /// For matches of `pat` within `self` that overlap, only the indices
    /// corresponding to the first match are returned.
    ///
    /// The [pattern] can be a `&str`, [`char`], a slice of [`char`]s, or a
    /// 如果模式支持反向搜索，并且正向/反向搜索得到相同的元素，
    ///
    /// [`char`]: prim@char
    /// [pattern]: self::pattern
    ///
    /// # Iterator behavior
    ///
    /// The returned iterator will be a [`DoubleEndedIterator`] if the pattern
    /// allows a reverse search and forward/reverse search yields the same
    /// elements. This is true for, e.g., [`char`], but not for `&str`.
    ///
    /// 如果模式允许反向搜索，但其结果可能与正向搜索不同，
    /// from a forward search, the [`rmatch_indices`] method can be used.
    ///
    /// [`rmatch_indices`]: str::rmatch_indices
    ///
    /// # 示例
    ///
    /// ```
    /// let v: Vec<_> = "abcXXXabcYYYabc".match_indices("abc").collect();
    /// assert_eq!(v, [(0, "abc"), (6, "abc"), (12, "abc")]);
    ///
    /// let v: Vec<_> = "1abcabc2".match_indices("abc").collect();
    /// assert_eq!(v, [(1, "abc"), (4, "abc")]);
    ///
    /// let v: Vec<_> = "ababa".match_indices("aba").collect();
    /// assert_eq!(v, [(0, "aba")]); // only the first `aba`
    /// ```
    #[stable(feature = "str_match_indices", since = "1.5.0")]
    #[inline]
    pub fn match_indices<P: Pattern>(&self, pat: P) -> MatchIndices<'_, P> {
        MatchIndices(MatchIndicesInternal(pat.into_searcher(self)))
    }

    /// Returns an iterator over the disjoint matches of a pattern within `self`,
    /// 以反向顺序输出，同时包含匹配索引。
    ///
    /// For matches of `pat` within `self` that overlap, only the indices
    /// corresponding to the last match are returned.
    ///
    /// The [pattern] can be a `&str`, [`char`], a slice of [`char`]s, or a
    /// 如果模式支持反向搜索，并且正向/反向搜索得到相同的元素，
    ///
    /// [`char`]: prim@char
    /// [pattern]: self::pattern
    ///
    /// # Iterator behavior
    ///
    /// 如果模式支持反向搜索，并且正向/反向搜索得到相同的元素，
    /// search, and it will be a [`DoubleEndedIterator`] if a forward/reverse
    /// 如果模式支持反向搜索，但其结果可能与正向搜索不同，
    ///
    /// For iterating from the front, the [`match_indices`] method can be used.
    ///
    /// [`match_indices`]: str::match_indices
    ///
    /// # 示例
    ///
    /// ```
    /// let v: Vec<_> = "abcXXXabcYYYabc".rmatch_indices("abc").collect();
    /// assert_eq!(v, [(12, "abc"), (6, "abc"), (0, "abc")]);
    ///
    /// let v: Vec<_> = "1abcabc2".rmatch_indices("abc").collect();
    /// assert_eq!(v, [(4, "abc"), (1, "abc")]);
    ///
    /// let v: Vec<_> = "ababa".rmatch_indices("aba").collect();
    /// assert_eq!(v, [(2, "aba")]); // only the last `aba`
    /// ```
    #[stable(feature = "str_match_indices", since = "1.5.0")]
    #[inline]
    pub fn rmatch_indices<P: Pattern>(&self, pat: P) -> RMatchIndices<'_, P>
    where
        for<'a> P::Searcher<'a>: ReverseSearcher<'a>,
    {
        RMatchIndices(self.match_indices(pat).0)
    }

    /// 返回去除了首尾空白的字符串切片。
    ///
    /// 'Whitespace' is defined according to the terms of the Unicode Derived
    /// Core Property `White_Space`, which includes newlines.
    ///
    /// # 示例
    ///
    /// ```
    /// let s = "\n Hello\tworld\t\n";
    ///
    /// assert_eq!("Hello\tworld", s.trim());
    /// ```
    #[inline]
    #[must_use = "this returns the trimmed string as a slice, \
                  without modifying the original"]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_diagnostic_item = "str_trim"]
    pub fn trim(&self) -> &str {
        self.trim_matches(char::is_whitespace)
    }

    /// 返回去除了首部空白的字符串切片。
    ///
    /// 'Whitespace' is defined according to the terms of the Unicode Derived
    /// Core Property `White_Space`, which includes newlines.
    ///
    /// # 文本方向性
    ///
    /// A string is a sequence of bytes. `start` in this context means the first
    /// 俄语，则位于左侧；对于从右到左的语言
    /// Russian, this will be left side, and for right-to-left languages like
    /// 如果是阿拉伯语或希伯来语，则此侧为右侧。
    ///
    /// # 示例
    ///
    /// 基本用法：
    ///
    /// ```
    /// let s = "\n Hello\tworld\t\n";
    /// assert_eq!("Hello\tworld\t\n", s.trim_start());
    /// ```
    ///
    /// 方向性：
    ///
    /// ```
    /// let s = "  English  ";
    /// assert!(Some('E') == s.trim_start().chars().next());
    ///
    /// let s = "  עברית  ";
    /// assert!(Some('ע') == s.trim_start().chars().next());
    /// ```
    #[inline]
    #[must_use = "this returns the trimmed string as a new slice, \
                  without modifying the original"]
    #[stable(feature = "trim_direction", since = "1.30.0")]
    #[rustc_diagnostic_item = "str_trim_start"]
    pub fn trim_start(&self) -> &str {
        self.trim_start_matches(char::is_whitespace)
    }

    /// 返回一个去除了末尾空白字符的字符串切片。
    ///
    /// “空白字符”根据 Unicode 定义术语进行定义。
    /// Core Property `White_Space`, which includes newlines.
    ///
    /// # 文本方向性
    ///
    /// A string is a sequence of bytes. `end` in this context means the last
    /// 如果是阿拉伯语或希伯来语这类从右到左的语言，此侧为左侧。
    /// # 示例
    /// 基本用法：
    ///
    /// # 方向性：
    ///
    /// 基本用法：
    ///
    /// ```
    /// let s = "\n Hello\tworld\t\n";
    /// assert_eq!("\n Hello\tworld", s.trim_end());
    /// ```
    ///
    /// 方向性：
    ///
    /// ```
    /// let s = "  English  ";
    /// assert!(Some('h') == s.trim_end().chars().rev().next());
    ///
    /// let s = "  עברית  ";
    /// assert!(Some('ת') == s.trim_end().chars().rev().next());
    /// ```
    #[inline]
    #[must_use = "this returns the trimmed string as a new slice, \
                  without modifying the original"]
    #[stable(feature = "trim_direction", since = "1.30.0")]
    #[rustc_diagnostic_item = "str_trim_end"]
    pub fn trim_end(&self) -> &str {
        self.trim_end_matches(char::is_whitespace)
    }

    /// 返回一个去除了开头空白字符的字符串切片。
    ///
    /// “空白字符”根据 Unicode 定义术语进行定义。
    /// Core Property `White_Space`.
    ///
    /// # 文本方向性
    ///
    /// 字符串是字节序列。在此上下文中 “Left” 表示该字节字符串的第一个位置；对于阿拉伯语或希伯来语这类从右到左的语言，此侧为右侧。
    /// 如果是阿拉伯语或希伯来语这类从右到左的语言，此侧为右侧，而非左侧。
    /// # 示例
    /// 基本用法：
    ///
    /// # 方向性：
    ///
    /// 基本用法：
    ///
    /// ```
    /// let s = " Hello\tworld\t";
    ///
    /// assert_eq!("Hello\tworld\t", s.trim_left());
    /// ```
    ///
    /// 方向性：
    ///
    /// ```
    /// let s = "  English";
    /// assert!(Some('E') == s.trim_left().chars().next());
    ///
    /// let s = "  עברית";
    /// assert!(Some('ע') == s.trim_left().chars().next());
    /// ```
    #[must_use = "this returns the trimmed string as a new slice, \
                  without modifying the original"]
    #[inline]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[deprecated(since = "1.33.0", note = "superseded by `trim_start`", suggestion = "trim_start")]
    pub fn trim_left(&self) -> &str {
        self.trim_start()
    }

    /// 返回一个去除了末尾空白字符的字符串切片。
    ///
    /// “空白字符”根据 Unicode 定义术语进行定义。
    /// Core Property `White_Space`.
    ///
    /// # 文本方向性
    ///
    /// 字符串是字节序列。在此上下文中 “Right” 表示该字节字符串的最后一个位置；对于阿拉伯语或希伯来语这类从右到左的语言，此侧为左侧。
    /// 如果是阿拉伯语或希伯来语这类从右到左的语言，此侧为左侧，而非右侧。
    /// # 示例
    /// 基本用法：
    ///
    /// # 方向性：
    ///
    /// 基本用法：
    ///
    /// ```
    /// let s = " Hello\tworld\t";
    ///
    /// assert_eq!(" Hello\tworld", s.trim_right());
    /// ```
    ///
    /// 方向性：
    ///
    /// ```
    /// let s = "English  ";
    /// assert!(Some('h') == s.trim_right().chars().rev().next());
    ///
    /// let s = "עברית  ";
    /// assert!(Some('ת') == s.trim_right().chars().rev().next());
    /// ```
    #[must_use = "this returns the trimmed string as a new slice, \
                  without modifying the original"]
    #[inline]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[deprecated(since = "1.33.0", note = "superseded by `trim_end`", suggestion = "trim_end")]
    pub fn trim_right(&self) -> &str {
        self.trim_end()
    }

    /// 返回一个去除了所有匹配特定模式的前缀和后缀的字符串切片。
    /// pattern repeatedly removed.
    ///
    /// The [pattern] can be a [`char`], a slice of [`char`]s, or a function
    /// # 文本方向性
    ///
    /// [`char`]: prim@char
    /// [pattern]: self::pattern
    ///
    /// # Examples
    ///
    /// Simple patterns:
    ///
    /// ```
    /// assert_eq!("11foo1bar11".trim_matches('1'), "foo1bar");
    /// assert_eq!("123foo1bar123".trim_matches(char::is_numeric), "foo1bar");
    ///
    /// let x: &[_] = &['1', '2'];
    /// assert_eq!("12foo1bar12".trim_matches(x), "foo1bar");
    /// ```
    ///
    /// A more complex pattern, using a closure:
    ///
    /// ```
    /// assert_eq!("1foo1barXX".trim_matches(|c| c == '1' || c == 'X'), "foo1bar");
    /// ```
    #[must_use = "this returns the trimmed string as a new slice, \
                  without modifying the original"]
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn trim_matches<P: Pattern>(&self, pat: P) -> &str
    where
        for<'a> P::Searcher<'a>: DoubleEndedSearcher<'a>,
    {
        let mut i = 0;
        let mut j = 0;
        let mut matcher = pat.into_searcher(self);
        if let Some((a, b)) = matcher.next_reject() {
            i = a;
            j = b; // Remember earliest known match, correct it below if
            // last match is different
        }
        if let Some((_, b)) = matcher.next_reject_back() {
            j = b;
        }
        // SAFETY: `Searcher` is known to return valid indices.
        unsafe { self.get_unchecked(i..j) }
    }

    /// Returns a string slice with all prefixes that match a pattern
    /// repeatedly removed.
    ///
    /// The [pattern] can be a `&str`, [`char`], a slice of [`char`]s, or a
    /// function or closure that determines if a character matches.
    ///
    /// [`char`]: prim@char
    /// [pattern]: self::pattern
    ///
    /// # Text directionality
    ///
    /// A string is a sequence of bytes. `start` in this context means the first
    /// position of that byte string; for a left-to-right language like English or
    /// Russian, this will be left side, and for right-to-left languages like
    /// Arabic or Hebrew, this will be the right side.
    ///
    /// # 示例
    ///
    /// ```
    /// assert_eq!("11foo1bar11".trim_start_matches('1'), "foo1bar11");
    /// assert_eq!("123foo1bar123".trim_start_matches(char::is_numeric), "foo1bar123");
    ///
    /// let x: &[_] = &['1', '2'];
    /// assert_eq!("12foo1bar12".trim_start_matches(x), "foo1bar12");
    /// ```
    #[must_use = "this returns the trimmed string as a new slice, \
                  without modifying the original"]
    #[stable(feature = "trim_direction", since = "1.30.0")]
    pub fn trim_start_matches<P: Pattern>(&self, pat: P) -> &str {
        let mut i = self.len();
        let mut matcher = pat.into_searcher(self);
        if let Some((a, _)) = matcher.next_reject() {
            i = a;
        }
        // SAFETY: `Searcher` is known to return valid indices.
        unsafe { self.get_unchecked(i..self.len()) }
    }

    /// 返回一个去除了前缀的切片字符串。
    ///
    /// If the string starts with the pattern `prefix`, returns the substring after the prefix,
    /// wrapped in `Some`. Unlike [`trim_start_matches`], this method removes the prefix exactly once.
    ///
    /// If the string does not start with `prefix`, returns `None`.
    ///
    /// The [pattern] can be a `&str`, [`char`], a slice of [`char`]s, or a
    /// 决定某个字符是否匹配的函数或闭包。
    ///
    /// [`char`]: prim@char
    /// [pattern]: self::pattern
    /// [`trim_start_matches`]: Self::trim_start_matches
    ///
    /// # 示例
    ///
    /// ```
    /// assert_eq!("foo:bar".strip_prefix("foo:"), Some("bar"));
    /// assert_eq!("foo:bar".strip_prefix("bar"), None);
    /// assert_eq!("foofoo".strip_prefix("foo"), Some("foo"));
    /// ```
    #[must_use = "this returns the remaining substring as a new slice, \
                  without modifying the original"]
    #[stable(feature = "str_strip", since = "1.45.0")]
    pub fn strip_prefix<P: Pattern>(&self, prefix: P) -> Option<&str> {
        prefix.strip_prefix_of(self)
    }

    /// 返回一个去除了后缀的切片字符串。
    ///
    /// If the string ends with the pattern `suffix`, returns the substring before the suffix,
    /// wrapped in `Some`.  Unlike [`trim_end_matches`], this method removes the suffix exactly once.
    ///
    /// If the string does not end with `suffix`, returns `None`.
    ///
    /// The [pattern] can be a `&str`, [`char`], a slice of [`char`]s, or a
    /// 决定某个字符是否匹配的函数或闭包。
    ///
    /// [`char`]: prim@char
    /// [pattern]: self::pattern
    /// [`trim_end_matches`]: Self::trim_end_matches
    ///
    /// # 示例
    ///
    /// ```
    /// assert_eq!("bar:foo".strip_suffix(":foo"), Some("bar"));
    /// assert_eq!("bar:foo".strip_suffix("bar"), None);
    /// assert_eq!("foofoo".strip_suffix("foo"), Some("foo"));
    /// ```
    #[must_use = "this returns the remaining substring as a new slice, \
                  without modifying the original"]
    #[stable(feature = "str_strip", since = "1.45.0")]
    pub fn strip_suffix<P: Pattern>(&self, suffix: P) -> Option<&str>
    where
        for<'a> P::Searcher<'a>: ReverseSearcher<'a>,
    {
        suffix.strip_suffix_of(self)
    }

    /// 返回一个去除了前缀和后缀的切片字符串。
    ///
    /// If the string starts with the pattern `prefix` and ends with
    /// the pattern `suffix`, and the prefix and suffix don't overlap, returns
    /// the substring after the prefix and before the suffix, wrapped in `Some`.
    /// Unlike [`trim_start_matches`] and [`trim_end_matches`], this method removes both the prefix
    /// 和后缀。
    ///
    /// If the string does not start with `prefix`, does not end with `suffix`,
    /// or the prefix and suffix overlap in the string, returns `None`.
    ///
    /// Each [pattern] can be a `&str`, [`char`], a slice of [`char`]s, or a
    /// 决定某个字符是否匹配的函数或闭包。
    ///
    /// [`char`]: prim@char
    /// [pattern]: self::pattern
    /// [`trim_start_matches`]: Self::trim_start_matches
    /// [`trim_end_matches`]: Self::trim_end_matches
    ///
    /// # 示例
    ///
    /// ```
    /// assert_eq!("bar:hello:foo".strip_circumfix("bar:", ":foo"), Some("hello"));
    /// assert_eq!("bar:foo".strip_circumfix("foo", "foo"), None);
    /// assert_eq!("foo:bar;".strip_circumfix("foo:", ';'), Some("bar"));
    /// assert_eq!("foo:bar:baz".strip_circumfix("foo:bar:", ":bar:baz"), None);
    /// ```
    #[must_use = "this returns the remaining substring as a new slice, \
                  without modifying the original"]
    #[stable(feature = "strip_circumfix", since = "1.98.0")]
    pub fn strip_circumfix<P: Pattern, S: Pattern>(&self, prefix: P, suffix: S) -> Option<&str>
    where
        for<'a> S::Searcher<'a>: ReverseSearcher<'a>,
    {
        self.strip_prefix(prefix)?.strip_suffix(suffix)
    }

    /// 返回一个去除了可选前缀的切片字符串。
    ///
    /// If the string starts with the pattern `prefix`, returns the substring after the prefix.
    /// Unlike [`strip_prefix`], this method always returns `&str` for easy method chaining,
    /// instead of returning [`Option<&str>`].
    ///
    /// If the string does not start with `prefix`, returns the original string unchanged.
    ///
    /// The [pattern] can be a `&str`, [`char`], a slice of [`char`]s, or a
    /// 决定某个字符是否匹配的函数或闭包。
    ///
    /// [`char`]: prim@char
    /// [pattern]: self::pattern
    /// [`strip_prefix`]: Self::strip_prefix
    ///
    /// # 示例
    ///
    /// ```
    /// // Prefix present - removes it
    /// assert_eq!("foo:bar".trim_prefix("foo:"), "bar");
    /// assert_eq!("foofoo".trim_prefix("foo"), "foo");
    ///
    /// // Prefix absent - returns original string
    /// assert_eq!("foo:bar".trim_prefix("bar"), "foo:bar");
    ///
    /// // Method chaining example
    /// assert_eq!("<https://example.com/>".trim_prefix('<').trim_suffix('>'), "https://example.com/");
    /// ```
    #[must_use = "this returns the remaining substring as a new slice, \
                  without modifying the original"]
    #[stable(feature = "trim_prefix_suffix", since = "1.100.0")]
    pub fn trim_prefix<P: Pattern>(&self, prefix: P) -> &str {
        prefix.strip_prefix_of(self).unwrap_or(self)
    }

    /// 返回一个去除了可选后缀的切片字符串。
    ///
    /// If the string ends with the pattern `suffix`, returns the substring before the suffix.
    /// Unlike [`strip_suffix`], this method always returns `&str` for easy method chaining,
    /// instead of returning [`Option<&str>`].
    ///
    /// If the string does not end with `suffix`, returns the original string unchanged.
    ///
    /// The [pattern] can be a `&str`, [`char`], a slice of [`char`]s, or a
    /// 一个用于判断字符是否匹配的函数或闭包。
    ///
    /// [`char`]: prim@char
    /// [pattern]: self::pattern
    /// [`strip_suffix`]: Self::strip_suffix
    ///
    /// # 示例
    ///
    /// ```
    /// // Suffix present - removes it
    /// assert_eq!("bar:foo".trim_suffix(":foo"), "bar");
    /// assert_eq!("foofoo".trim_suffix("foo"), "foo");
    ///
    /// // Suffix absent - returns original string
    /// assert_eq!("bar:foo".trim_suffix("bar"), "bar:foo");
    ///
    /// // Method chaining example
    /// assert_eq!("<https://example.com/>".trim_prefix('<').trim_suffix('>'), "https://example.com/");
    /// ```
    #[must_use = "this returns the remaining substring as a new slice, \
                  without modifying the original"]
    #[stable(feature = "trim_prefix_suffix", since = "1.100.0")]
    pub fn trim_suffix<P: Pattern>(&self, suffix: P) -> &str
    where
        for<'a> P::Searcher<'a>: ReverseSearcher<'a>,
    {
        suffix.strip_suffix_of(self).unwrap_or(self)
    }

    /// 返回包含所有符合模式的后缀的字符串切片
    /// 被反复移除。
    ///
    /// The [pattern] can be a `&str`, [`char`], a slice of [`char`]s, or a
    /// 一个用于判断字符是否匹配的函数或闭包。
    ///
    /// [`char`]: prim@char
    /// [pattern]: self::pattern
    ///
    /// # 文本方向性
    ///
    /// A string is a sequence of bytes. `end` in this context means the last
    /// 位置；对于英语或俄语等从右到左的语言，此位置为右侧；对于阿拉伯语或希伯来语等从左到右的语言，此位置为左侧。
    /// # 示例
    /// 简单的模式：
    ///
    /// # 使用闭包的更复杂模式：
    ///
    /// 将符合模式的全部前缀作为字符串切片返回
    ///
    /// ```
    /// assert_eq!("11foo1bar11".trim_end_matches('1'), "11foo1bar");
    /// assert_eq!("123foo1bar123".trim_end_matches(char::is_numeric), "123foo1bar");
    ///
    /// let x: &[_] = &['1', '2'];
    /// assert_eq!("12foo1bar12".trim_end_matches(x), "12foo1bar");
    /// ```
    ///
    /// 被反复移除。
    ///
    /// ```
    /// assert_eq!("1fooX".trim_end_matches(|c| c == '1' || c == 'X'), "1foo");
    /// ```
    #[must_use = "this returns the trimmed string as a new slice, \
                  without modifying the original"]
    #[stable(feature = "trim_direction", since = "1.30.0")]
    pub fn trim_end_matches<P: Pattern>(&self, pat: P) -> &str
    where
        for<'a> P::Searcher<'a>: ReverseSearcher<'a>,
    {
        let mut j = 0;
        let mut matcher = pat.into_searcher(self);
        if let Some((_, b)) = matcher.next_reject_back() {
            j = b;
        }
        // SAFETY: `Searcher` is known to return valid indices.
        unsafe { self.get_unchecked(0..j) }
    }

    /// 返回包含所有符合模式的前缀的字符串切片
    /// 被反复移除。
    ///
    /// The [pattern] can be a `&str`, [`char`], a slice of [`char`]s, or a
    /// 一个用于判断字符是否匹配的函数或闭包。
    ///
    /// [`char`]: prim@char
    /// [pattern]: self::pattern
    ///
    /// # 文本方向性
    ///
    /// 字符串是字节序列。在此上下文中 'Left' 表示该字节字符串的第一个
    /// 位置；对于阿拉伯语或希伯来语等从右到左的语言，此位置为右侧
    /// 而不是左侧。
    /// _右侧_，而非左侧。
    ///
    /// # 示例
    ///
    /// ```
    /// assert_eq!("11foo1bar11".trim_left_matches('1'), "foo1bar11");
    /// assert_eq!("123foo1bar123".trim_left_matches(char::is_numeric), "foo1bar123");
    ///
    /// let x: &[_] = &['1', '2'];
    /// assert_eq!("12foo1bar12".trim_left_matches(x), "foo1bar12");
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[deprecated(
        since = "1.33.0",
        note = "superseded by `trim_start_matches`",
        suggestion = "trim_start_matches"
    )]
    pub fn trim_left_matches<P: Pattern>(&self, pat: P) -> &str {
        self.trim_start_matches(pat)
    }

    /// 返回包含所有符合模式的后缀的字符串切片
    /// 被反复移除。
    ///
    /// The [pattern] can be a `&str`, [`char`], a slice of [`char`]s, or a
    /// 一个用于判断字符是否匹配的函数或闭包。
    ///
    /// [`char`]: prim@char
    /// [pattern]: self::pattern
    ///
    /// # 文本方向性
    ///
    /// 字符串是字节序列。在此上下文中 'Right' 表示该字节字符串的最后一个
    /// 位置；对于阿拉伯语或希伯来语等从右到左的语言，此位置为左侧
    /// 而不是右侧。
    /// _左侧_，而非右侧。
    ///
    /// # 示例
    ///
    /// 简单的模式：
    ///
    /// ```
    /// assert_eq!("11foo1bar11".trim_right_matches('1'), "11foo1bar");
    /// assert_eq!("123foo1bar123".trim_right_matches(char::is_numeric), "123foo1bar");
    ///
    /// let x: &[_] = &['1', '2'];
    /// assert_eq!("12foo1bar12".trim_right_matches(x), "12foo1bar");
    /// ```
    ///
    /// 使用闭包的更复杂模式：
    ///
    /// ```
    /// assert_eq!("1fooX".trim_right_matches(|c| c == '1' || c == 'X'), "1foo");
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[deprecated(
        since = "1.33.0",
        note = "superseded by `trim_end_matches`",
        suggestion = "trim_end_matches"
    )]
    pub fn trim_right_matches<P: Pattern>(&self, pat: P) -> &str
    where
        for<'a> P::Searcher<'a>: ReverseSearcher<'a>,
    {
        self.trim_end_matches(pat)
    }

    /// 将此字符串切片解析为其他类型。
    ///
    /// Because `parse` is so general, it can cause problems with type
    /// inference. As such, `parse` is one of the few times you'll see
    /// the syntax affectionately known as the 'turbofish': `::<>`. This
    /// helps the inference algorithm understand specifically which type
    /// # 错误
    ///
    /// `parse` can parse into any type that implements the [`FromStr`] trait.
    ///
    /// # Errors
    ///
    /// Will return [`Err`] if it's not possible to parse this string slice into
    /// 所需的类型。
    ///
    /// [`Err`]: FromStr::Err
    ///
    /// # 示例
    ///
    /// 基本用法：
    ///
    /// ```
    /// let four: u32 = "4".parse().unwrap();
    ///
    /// assert_eq!(4, four);
    /// ```
    ///
    /// Using the 'turbofish' instead of annotating `four`:
    ///
    /// ```
    /// let four = "4".parse::<u32>();
    ///
    /// assert_eq!(Ok(4), four);
    /// ```
    ///
    /// 解析失败：
    ///
    /// ```
    /// let nope = "j".parse::<u32>();
    ///
    /// assert!(nope.is_err());
    /// ```
    #[inline]
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn parse<F: FromStr>(&self) -> Result<F, F::Err> {
        FromStr::from_str(self)
    }

    /// 检查此字符串中的所有字符是否都在 ASCII 范围内。
    ///
    /// An empty string returns `true`.
    ///
    /// # 示例
    ///
    /// ```
    /// let ascii = "hello!\n";
    /// let non_ascii = "Grüße, Jürgen ❤";
    ///
    /// assert!(ascii.is_ascii());
    /// assert!(!non_ascii.is_ascii());
    /// ```
    #[stable(feature = "ascii_methods_on_intrinsics", since = "1.23.0")]
    #[rustc_const_stable(feature = "const_slice_is_ascii", since = "1.74.0")]
    #[must_use]
    #[inline]
    pub const fn is_ascii(&self) -> bool {
        // We can treat each byte as character here: all multibyte characters
        // start with a byte that is not in the ASCII range, so we will stop
        // there already.
        self.as_bytes().is_ascii()
    }

    /// If this string slice [`is_ascii`](Self::is_ascii), returns it as a slice
    /// of [ASCII characters](`ascii::Char`), otherwise returns `None`.
    #[unstable(feature = "ascii_char", issue = "110998")]
    #[must_use]
    #[inline]
    pub const fn as_ascii(&self) -> Option<&[ascii::Char]> {
        // Like in `is_ascii`, we can work on the bytes directly.
        self.as_bytes().as_ascii()
    }

    /// Converts this string slice into a slice of [ASCII characters](ascii::Char),
    /// # 安全性
    ///
    /// # 此字符串中的每个字符必须是 ASCII 字符，否则会出现 UB 错误。
    ///
    /// 检查两个字符串是否为不区分大小写的 ASCII 匹配。
    #[unstable(feature = "ascii_char", issue = "110998")]
    #[must_use]
    #[inline]
    pub const unsafe fn as_ascii_unchecked(&self) -> &[ascii::Char] {
        assert_unsafe_precondition!(
            check_library_ub,
            "as_ascii_unchecked requires that the string is valid ASCII",
            (it: &str = self) => it.is_ascii()
        );

        // SAFETY: the caller promised that every byte of this string slice
        // is ASCII.
        unsafe { self.as_bytes().as_ascii_unchecked() }
    }

    /// Checks that two strings are an ASCII case-insensitive match.
    ///
    /// Same as `to_ascii_lowercase(a) == to_ascii_lowercase(b)`,
    /// # 示例
    ///
    /// 检查两个字符串是否为无大小写的匹配，依据
    /// [`str::eq_ignore_case_unnormalized`].
    ///
    /// # [Unicode 标准第 3 章中的定义 144]。
    ///
    /// ```
    /// assert!("Ferris".eq_ignore_ascii_case("FERRIS"));
    /// assert!("Ferrös".eq_ignore_ascii_case("FERRöS"));
    /// assert!(!"Ferrös".eq_ignore_ascii_case("FERRÖS"));
    /// ```
    #[stable(feature = "ascii_methods_on_intrinsics", since = "1.23.0")]
    #[rustc_const_stable(feature = "const_eq_ignore_ascii_case", since = "1.89.0")]
    #[must_use]
    #[inline]
    pub const fn eq_ignore_ascii_case(&self, other: &str) -> bool {
        self.as_bytes().eq_ignore_ascii_case(other.as_bytes())
    }

    /// Checks that two strings are a caseless match, according to
    /// 没有进行 [NFC]（即 NFC）标准化，因此视觉和语义上相同的字符串
    ///
    /// [Definition 144]: https://www.unicode.org/versions/latest/core-spec/chapter-3/#G53513
    ///
    /// Same as `a.to_casefold_unnormalized() == b.to_casefold_unnormalized()`,
    /// but without allocating. See that method's documentation,
    /// as well as [`char::to_casefold_unnormalized()`],
    /// 此外，此方法与语言/区域无关，
    ///
    /// 因此土耳其语和阿塞拜疆语中的 I/ı/İ/i 的特殊行为不会被处理。
    /// might still compare unequal. For example, `"Å"` (U+00C5 LATIN CAPITAL LETTER A WITH RING ABOVE)
    /// is considered distinct from `"Å"` (A followed by U+030A COMBINING RING ABOVE),
    /// 将此字符串就地转换为其 ASCII 大写形式。
    ///
    /// ASCII 字母 'a' 到 'z' 被映射为 'A' 到 'Z'，
    /// 但其他所有字符保持不变。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(casefold)]
    /// assert!("Ferris".eq_ignore_case_unnormalized("FERRIS"));
    /// assert!("Ferrös".eq_ignore_case_unnormalized("FERRÖS"));
    /// assert!("ẞ".eq_ignore_case_unnormalized("ss"));
    /// ```
    ///
    /// 没有进行 NFC 标准化：
    ///
    /// ```rust
    /// #![feature(casefold)]
    /// // These two strings are visually and semantically identical...
    /// let comp = "Å";
    /// let decomp = "Å";
    ///
    /// // ... but not codepoint-for-codepoint equal.
    /// assert_eq!(comp, "\u{C5}");
    /// assert_eq!(decomp, "A\u{030A}");
    ///
    /// // Their case-foldings are likewise unequal:
    /// assert!(!comp.eq_ignore_case_unnormalized(decomp));
    /// ```
    ///
    /// [normalization]: https://www.unicode.org/faq/normalization.html
    #[unstable(feature = "casefold", issue = "157000")]
    #[must_use]
    #[inline]
    pub fn eq_ignore_case_unnormalized(&self, other: &str) -> bool {
        self.chars()
            .flat_map(char::to_casefold_unnormalized)
            .eq(other.chars().flat_map(char::to_casefold_unnormalized))
    }

    /// 将此字符串就地转换为其 ASCII 大写形式。
    ///
    /// ASCII 字母 'a' 到 'z' 被映射为 'A' 到 'Z'，
    /// 但其他所有字符保持不变。
    ///
    /// 要返回新的大写值而不修改现有值，请使用
    /// [`to_ascii_uppercase()`].
    ///
    /// [`to_ascii_uppercase()`]: #method.to_ascii_uppercase
    ///
    /// # 示例
    ///
    /// ```
    /// let mut s = String::from("Grüße, Jürgen ❤");
    ///
    /// s.make_ascii_uppercase();
    ///
    /// assert_eq!("GRüßE, JüRGEN ❤", s);
    /// ```
    #[stable(feature = "ascii_methods_on_intrinsics", since = "1.23.0")]
    #[rustc_const_stable(feature = "const_make_ascii", since = "1.84.0")]
    #[inline]
    pub const fn make_ascii_uppercase(&mut self) {
        // SAFETY: changing ASCII letters only does not invalidate UTF-8.
        let me = unsafe { self.as_bytes_mut() };
        me.make_ascii_uppercase()
    }

    /// 将此字符串就地转换为其 ASCII 小写形式。
    ///
    /// ASCII 字母 'A' 到 'Z' 被映射为 'a' 到 'z'，
    /// 但其他所有字符保持不变。
    ///
    /// 要返回新的小写值而不修改现有值，请使用
    /// [`to_ascii_lowercase()`].
    ///
    /// [`to_ascii_lowercase()`]: #method.to_ascii_lowercase
    ///
    /// # 示例
    ///
    /// ```
    /// let mut s = String::from("GRÜßE, JÜRGEN ❤");
    ///
    /// s.make_ascii_lowercase();
    ///
    /// assert_eq!("grÜße, jÜrgen ❤", s);
    /// ```
    #[stable(feature = "ascii_methods_on_intrinsics", since = "1.23.0")]
    #[rustc_const_stable(feature = "const_make_ascii", since = "1.84.0")]
    #[inline]
    pub const fn make_ascii_lowercase(&mut self) {
        // SAFETY: changing ASCII letters only does not invalidate UTF-8.
        let me = unsafe { self.as_bytes_mut() };
        me.make_ascii_lowercase()
    }

    /// Copies the string from `src` into `self`, using a memcpy.
    ///
    /// The length of `src` must be the same as `self`.
    ///
    /// # Panics
    ///
    /// 如果两个字符串长度不同，此函数会触发 panic。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(str_copy_from_str)]
    /// let src = "Saludos";
    /// let mut dst = String::from("Grüße, Jürgen");
    ///
    /// // Because the strings have to be the same length,
    /// // we slice the destination slice from sixteen bytes
    /// // to seven. It will panic if we don't do this.
    /// dst[..7].copy_from_str(src);
    ///
    /// assert_eq!(src, "Saludos");
    /// assert_eq!(dst, "Saludos, Jürgen");
    /// ```
    ///
    /// Rust 规定，对于特定数据部分，只能有一个可变引用，不能有
    /// 不可变引用。
    /// scope. Because of this, attempting to use `copy_from_str` on a
    /// single string will result in a compile failure:
    ///
    /// ```compile_fail
    /// #![feature(str_copy_from_str)]
    /// let mut string = String::from("Abcde");
    ///
    /// string[..2].copy_from_str(&string[3..]); // compile fail!
    /// ```
    ///
    /// To work around this, we can use [`split_at_mut`] to create two distinct
    /// 
    ///
    /// ```
    /// #![feature(str_copy_from_str)]
    /// let mut string = String::from("Abcde");
    ///
    /// {
    ///     let (left, right) = string.split_at_mut(2);
    ///     left.copy_from_str(&right[1..]);
    /// }
    ///
    /// assert_eq!(string, "decde");
    /// ```
    ///
    /// [`split_at_mut`]: str::split_at_mut
    #[doc(alias = "memcpy")]
    #[inline]
    #[unstable(feature = "str_copy_from_str", issue = "159841")]
    #[track_caller]
    pub fn copy_from_str(&mut self, src: &str) {
        // SAFETY: `copy_from_slice` panics unless the lengths are equal, and copying same-length
        // UTF-8 into a `str` keeps it valid UTF-8.
        let me = unsafe { self.as_bytes_mut() };
        me.copy_from_slice(src.as_bytes());
    }

    /// 返回一个去除了开头 ASCII 空白字符的字符串切片。
    ///
    /// 'Whitespace' refers to the definition used by
    /// [`u8::is_ascii_whitespace`]. Importantly, this definition excludes
    /// the U+000B code point even though it has the Unicode [`White_Space`] property
    /// and is removed by [`str::trim_start`].
    ///
    /// [`u8::is_ascii_whitespace`]: u8::is_ascii_whitespace
    /// [`White_Space`]: https://www.unicode.org/reports/tr44/#White_Space
    ///
    /// # 
    ///
    /// ```
    /// assert_eq!(" \t \u{3000}hello world\n".trim_ascii_start(), "\u{3000}hello world\n");
    /// assert_eq!("  ".trim_ascii_start(), "");
    /// assert_eq!("".trim_ascii_start(), "");
    /// ```
    #[must_use = "this returns the trimmed string as a new slice, \
                  without modifying the original"]
    #[stable(feature = "byte_slice_trim_ascii", since = "1.80.0")]
    #[rustc_const_stable(feature = "byte_slice_trim_ascii", since = "1.80.0")]
    #[inline]
    pub const fn trim_ascii_start(&self) -> &str {
        // SAFETY: Removing ASCII characters from a `&str` does not invalidate
        // UTF-8.
        unsafe { core::str::from_utf8_unchecked(self.as_bytes().trim_ascii_start()) }
    }

    /// 返回一个去除了结尾 ASCII 空白字符的字符串切片。
    ///
    /// 'Whitespace' refers to the definition used by
    /// [`u8::is_ascii_whitespace`]. Importantly, this definition excludes
    /// the U+000B code point even though it has the Unicode [`White_Space`] property
    /// and is removed by [`str::trim_end`].
    ///
    /// [`u8::is_ascii_whitespace`]: u8::is_ascii_whitespace
    /// [`White_Space`]: https://www.unicode.org/reports/tr44/#White_Space
    ///
    /// # 示例
    ///
    /// ```
    /// assert_eq!("\r hello world\u{3000}\n ".trim_ascii_end(), "\r hello world\u{3000}");
    /// assert_eq!("  ".trim_ascii_end(), "");
    /// assert_eq!("".trim_ascii_end(), "");
    /// ```
    #[must_use = "this returns the trimmed string as a new slice, \
                  without modifying the original"]
    #[stable(feature = "byte_slice_trim_ascii", since = "1.80.0")]
    #[rustc_const_stable(feature = "byte_slice_trim_ascii", since = "1.80.0")]
    #[inline]
    pub const fn trim_ascii_end(&self) -> &str {
        // SAFETY: Removing ASCII characters from a `&str` does not invalidate
        // UTF-8.
        unsafe { core::str::from_utf8_unchecked(self.as_bytes().trim_ascii_end()) }
    }

    /// 返回一个去除了开头和结尾 ASCII 空白字符的字符串切片。
    /// 
    ///
    /// 'Whitespace' refers to the definition used by
    /// [`u8::is_ascii_whitespace`]. Importantly, this definition excludes
    /// the U+000B code point even though it has the Unicode [`White_Space`] property
    /// and is removed by [`str::trim`].
    ///
    /// [`u8::is_ascii_whitespace`]: u8::is_ascii_whitespace
    /// [`White_Space`]: https://www.unicode.org/reports/tr44/#White_Space
    ///
    /// # 示例
    ///
    /// ```
    /// assert_eq!("\r hello world\n ".trim_ascii(), "hello world");
    /// assert_eq!("  ".trim_ascii(), "");
    /// assert_eq!("".trim_ascii(), "");
    /// ```
    #[must_use = "this returns the trimmed string as a new slice, \
                  without modifying the original"]
    #[stable(feature = "byte_slice_trim_ascii", since = "1.80.0")]
    #[rustc_const_stable(feature = "byte_slice_trim_ascii", since = "1.80.0")]
    #[inline]
    pub const fn trim_ascii(&self) -> &str {
        // SAFETY: Removing ASCII characters from a `&str` does not invalidate
        // UTF-8.
        unsafe { core::str::from_utf8_unchecked(self.as_bytes().trim_ascii()) }
    }

    /// Returns an iterator that escapes each char in `self` with [`char::escape_debug`].
    ///
    /// # 示例
    ///
    /// 作为迭代器：
    ///
    /// ```
    /// for c in "❤\n!".escape_debug() {
    ///     print!("{c}");
    /// }
    /// println!();
    /// ```
    ///
    /// Using `println!` directly:
    ///
    /// ```
    /// println!("{}", "❤\n!".escape_debug());
    /// ```
    ///
    ///
    /// 两者都等同于：
    ///
    /// ```
    /// println!("❤\\n!");
    /// ```
    ///
    /// Using `to_string`:
    ///
    /// ```
    /// assert_eq!("❤\n!".escape_debug().to_string(), "❤\\n!");
    /// ```
    #[must_use = "this returns the escaped string as an iterator, \
                  without modifying the original"]
    #[stable(feature = "str_escape", since = "1.34.0")]
    pub fn escape_debug(&self) -> EscapeDebug<'_> {
        EscapeDebug { inner: self.chars().flat_map(CharEscapeDebug) }
    }

    /// Returns an iterator that escapes each char in `self` with [`char::escape_default`].
    ///
    /// # 示例
    ///
    /// 作为迭代器：
    ///
    /// ```
    /// for c in "❤\n!".escape_default() {
    ///     print!("{c}");
    /// }
    /// println!();
    /// ```
    ///
    /// Using `println!` directly:
    ///
    /// ```
    /// println!("{}", "❤\n!".escape_default());
    /// ```
    ///
    ///
    /// 两者都等同于：
    ///
    /// ```
    /// println!("\\u{{2764}}\\n!");
    /// ```
    ///
    /// Using `to_string`:
    ///
    /// ```
    /// assert_eq!("❤\n!".escape_default().to_string(), "\\u{2764}\\n!");
    /// ```
    #[must_use = "this returns the escaped string as an iterator, \
                  without modifying the original"]
    #[stable(feature = "str_escape", since = "1.34.0")]
    pub fn escape_default(&self) -> EscapeDefault<'_> {
        EscapeDefault { inner: self.chars().flat_map(CharEscapeDefault) }
    }

    /// Returns an iterator that escapes each char in `self` with [`char::escape_unicode`].
    ///
    /// # 示例
    ///
    /// 作为迭代器：
    ///
    /// ```
    /// for c in "❤\n!".escape_unicode() {
    ///     print!("{c}");
    /// }
    /// println!();
    /// ```
    ///
    /// Using `println!` directly:
    ///
    /// ```
    /// println!("{}", "❤\n!".escape_unicode());
    /// ```
    ///
    ///
    /// 两者都等同于：
    ///
    /// ```
    /// println!("\\u{{2764}}\\u{{a}}\\u{{21}}");
    /// ```
    ///
    /// Using `to_string`:
    ///
    /// ```
    /// assert_eq!("❤\n!".escape_unicode().to_string(), "\\u{2764}\\u{a}\\u{21}");
    /// ```
    #[must_use = "this returns the escaped string as an iterator, \
                  without modifying the original"]
    #[stable(feature = "str_escape", since = "1.34.0")]
    pub fn escape_unicode(&self) -> EscapeUnicode<'_> {
        EscapeUnicode { inner: self.chars().flat_map(CharEscapeUnicode) }
    }

    /// 返回子字符串所指向的范围。
    ///
    /// Returns `None` if `substr` does not point within `self`.
    ///
    /// Unlike [`str::find`], **this does not search through the string**.
    /// 相反，它使用指针运算来查找在字符串中的位置。
    /// `substr` is derived from.
    ///
    /// This is useful for extending [`str::split`] and similar methods.
    ///
    /// Note that this method may return false positives (typically either
    /// `Some(0..0)` or `Some(self.len()..self.len())`) if `substr` is a
    /// zero-length `str` that points at the beginning or end of another,
    /// independent, `str`.
    ///
    /// # Examples
    /// ```
    /// use core::range::Range;
    ///
    /// let data = "a, b, b, a";
    /// let mut iter = data.split(", ").map(|s| data.substr_range(s).unwrap());
    ///
    /// assert_eq!(iter.next(), Some(Range { start: 0, end: 1 }));
    /// assert_eq!(iter.next(), Some(Range { start: 3, end: 4 }));
    /// assert_eq!(iter.next(), Some(Range { start: 6, end: 7 }));
    /// assert_eq!(iter.next(), Some(Range { start: 9, end: 10 }));
    /// ```
    #[must_use]
    #[stable(feature = "substr_range", since = "1.98.0")]
    pub fn substr_range(&self, substr: &str) -> Option<Range<usize>> {
        self.as_bytes().subslice_range(substr.as_bytes())
    }

    /// Returns the same string as a string slice `&str`.
    ///
    /// This method is redundant when used directly on `&str`, but
    /// it helps dereferencing other string-like types to string slices,
    /// for example references to `Box<str>` or `Arc<str>`.
    #[inline]
    #[unstable(feature = "str_as_str", issue = "130366")]
    pub const fn as_str(&self) -> &str {
        self
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_const_unstable(feature = "const_convert", issue = "143773")]
const impl AsRef<[u8]> for str {
    #[inline]
    fn as_ref(&self) -> &[u8] {
        self.as_bytes()
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_const_unstable(feature = "const_default", issue = "143894")]
const impl Default for &str {
    /// Creates an empty str
    #[inline]
    fn default() -> Self {
        ""
    }
}

#[stable(feature = "default_mut_str", since = "1.28.0")]
#[rustc_const_unstable(feature = "const_default", issue = "143894")]
const impl Default for &mut str {
    /// 创建一个空的可修改字符串
    #[inline]
    fn default() -> Self {
        // SAFETY: The empty string is valid UTF-8.
        unsafe { from_utf8_unchecked_mut(&mut []) }
    }
}

impl_fn_for_zst! {
    /// 一种可命名、可克隆的 fn 类型
    #[derive(Clone)]
    struct LinesMap impl<'a> Fn = |line: &'a str| -> &'a str {
        let Some(line) = line.strip_suffix('\n') else { return line };
        let Some(line) = line.strip_suffix('\r') else { return line };
        line
    };

    #[derive(Clone)]
    struct CharEscapeDebug impl Fn = |c: char| -> char::EscapeDebug {
        c.escape_debug_ext(EscapeDebugExtArgs::ESCAPE_ALL)
    };

    #[derive(Clone)]
    struct CharEscapeUnicode impl Fn = |c: char| -> char::EscapeUnicode {
        c.escape_unicode()
    };
    #[derive(Clone)]
    struct CharEscapeDefault impl Fn = |c: char| -> char::EscapeDefault {
        c.escape_default()
    };

    #[derive(Clone)]
    struct IsWhitespace impl Fn = |c: char| -> bool {
        c.is_whitespace()
    };

    #[derive(Clone)]
    pub(crate) struct IsAsciiWhitespace impl Fn = |byte: &u8| -> bool {
        byte.is_ascii_whitespace()
    };

    #[derive(Clone)]
    struct IsNotEmpty impl<'a, 'b> Fn = |s: &'a &'b str| -> bool {
        !s.is_empty()
    };

    #[derive(Clone)]
    pub(crate) struct BytesIsNotEmpty impl<'a, 'b> Fn = |s: &'a &'b [u8]| -> bool {
        !s.is_empty()
    };

    #[derive(Clone)]
    struct UnsafeBytesToStr impl<'a> Fn = |bytes: &'a [u8]| -> &'a str {
        // SAFETY: not safe
        unsafe { from_utf8_unchecked(bytes) }
    };
}

// This is required to make `impl From<&str> for Box<dyn Error>` and `impl<E> From<E> for Box<dyn Error>` not overlap.
#[stable(feature = "error_in_core_neg_impl", since = "1.65.0")]
impl !crate::error::Error for &str {}
