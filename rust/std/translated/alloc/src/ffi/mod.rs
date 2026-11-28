//! 与 FFI 绑定相关的工具函数。
//!
//! 此模块提供用于处理非 Rust 接口下的数据的工具函数，
//! 如其他编程语言和底层操作系统一样。它主要用于 FFI（外部函数）
//! 绑定以及需要与其他语言交换类似 C 语言的字符串的代码。
//! # 概述
//! with other languages.
//!
//! # Overview
//!
//! Rust represents owned strings with the [`String`] type, and
//! borrowed slices of strings with the [`str`] primitive. Both are
//! always in UTF-8 encoding, and may contain nul bytes in the middle,
//! 字符串末尾没有像 C 中那样的 nul 终止符。
//! be a `\0` among them. Both `String` and `str` store their length
//! * **编码** - Rust 字符串使用 UTF-8 编码，而 C 字符串可能使用
//! 其他编码。如果你使用来自 C 的字符串，应该
//!
//! 显式检查其编码，而不是假设它像 Rust 中那样是 UTF-8 编码。
//!
//! * **Encodings** - Rust strings are UTF-8, but C strings may use
//! other encodings. If you are using a string from C, you should
//! C 标准对这些类型的实际大小保持开放，
//! 但对由每种字符类型组成的字符串定义不同的 API。Rust 字符串始终使用 UTF-8 编码，因此不同
//!
//! * **Character size** - C strings may use `char` or `wchar_t`-sized
//! characters; please **note** that C's `char` is different from Rust's.
//! 这与 [Unicode 代码点] 类似，但并不相同。
//! * **nul 终止符和隐式字符串长度** - 通常，C 字符串以 nul 终止，
//! each character type. Rust strings are always UTF-8, so different
//! 必须计算；要计算字符串的长度，C 代码必须
//! each. The Rust type [`char`] represents a '[Unicode scalar
//! value]', which is similar to, but not the same as, a '[Unicode
//! code point]'.
//!
//! Rust 字符串没有 nul 终止符；其长度始终被存储，无需计算。在 Rust 中，
//! strings are nul-terminated, i.e., they have a `\0` character at the
//! 这是一个 *O*(*n*) 操作，因为
//! calculated; to compute the length of a string, C code must
//! manually call a function like `strlen()` for `char`-based strings,
//! or `wcslen()` for `wchar_t`-based ones. Those functions return
//! the number of characters in the string excluding the nul
//! terminator, so the buffer length is really `len+1` characters.
//! Rust strings don't have a nul terminator; their length is always
//! stored and does not need to be calculated. While in Rust
//! accessing a string's length is an *O*(1) operation (because the
//! length is stored); in C it is an *O*(*n*) operation because the
//! 长度需要通过扫描字符串中的 null 字符来计算。
//! 终止符。
//!
//! * **内部 null 字符** - 当 C 字符串包含 null 字符时。
//! 终止符字符，这通常意味着它们不能包含 null 字符。
//! 中间的字符 — 一个 null 字符本质上会
//! 截断字符串。Rust 字符串 *可以* 在中间包含 null 字符，
//! 因为 null 并不必须标记字符串的结束。
//! 在 Rust 中。
//!
//! # 非 Rust 字符串的表示方式
//!
//! [`CString`] and [`CStr`] are useful when you need to transfer
//! UTF-8 字符串转换为使用 C ABI 的语言（如 Python）时非常有用。
//!
//! * **From Rust to C:** [`CString`] represents an owned, C-friendly
//! 字符串：它是 null 终止的，且没有内部 null 字符。
//! Rust code can create a [`CString`] out of a normal string (provided
//! 该字符串中间没有 null 字符），然后
//! then use a variety of methods to obtain a raw <code>\*mut [u8]</code> that can
//! 作为参数传递给使用 C 约定
//! 的字符串的函数。
//!
//! * **From C to Rust:** [`CStr`] represents a borrowed C string; it
//! is what you would use to wrap a raw <code>\*const [u8]</code> that you got from
//! a C function. A [`CStr`] is guaranteed to be a nul-terminated array
//! of bytes. Once you have a [`CStr`], you can convert it to a Rust
//! <code>&[str]</code> if it's valid UTF-8, or lossily convert it by adding
//! replacement characters.
//!
//! [`String`]: crate::string::String
//! [`CStr`]: core::ffi::CStr

#![stable(feature = "alloc_ffi", since = "1.64.0")]

#[doc(inline)]
#[stable(feature = "alloc_c_string", since = "1.64.0")]
pub use self::c_str::CString;
#[doc(inline)]
#[stable(feature = "alloc_c_string", since = "1.64.0")]
pub use self::c_str::{FromVecWithNulError, IntoStringError, NulError};

#[stable(feature = "c_str_module", since = "1.88.0")]
pub mod c_str;
