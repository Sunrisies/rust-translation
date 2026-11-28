//! 与 FFI 绑定相关的工具函数。
//!
//! 此模块提供用于处理非 Rust 接口下的数据的相关工具，
//! 例如其他编程语言和底层操作系统。它主要用于 FFI（外部函数
//! 绑定以及需要与其他语言交换类似 C 语言的字符串的代码。
//! 接口）绑定和代码。
//! 以进行交换。
//!
//! # 概述
//!
//! Rust represents owned strings with the [`String`] type, and
//! borrowed slices of strings with the [`str`] primitive. Both are
//! 始终采用 UTF-8 编码，且可能包含中间的 nul 字节，
//! 即，如果你查看构成字符串的字节，其中可能
//! be a `\0` among them. Both `String` and `str` store their length
//! 字符串末尾没有 C 语言中的 nul 终止符。
//! 与 C 语言不同。
//!
//! C 字符串与 Rust 字符串不同：
//!
//! * **编码** - Rust 字符串采用 UTF-8 编码，而 C 字符串可能使用
//! 其他编码。如果你使用来自 C 的字符串，你应该
//! 明确检查其编码，而不是假设它就是像 Rust 中那样为 UTF-8。
//! is UTF-8 like you can do in Rust.
//!
//! * **Character size** - C strings may use `char` or `wchar_t`-sized
//! characters; please **note** that C's `char` is different from Rust's.
//! 但为由不同字符类型组成的字符串定义了不同的 API。Rust 字符串始终采用 UTF-8 编码，因此不同的
//! Unicode 字符将被编码为不同数量的字节。
//! each character type. Rust strings are always UTF-8, so different
//! 这与 '[Unicode 代码点]' 类似，但并不相同。
//! each. The Rust type [`char`] represents a '[Unicode scalar
//! value]', which is similar to, but not the same as, a '[Unicode
//! 计算；要计算字符串的长度，C 代码必须
//!
//! * **Nul terminators and implicit string lengths** - Often, C
//! strings are nul-terminated, i.e., they have a `\0` character at the
//! end. The length of a string buffer is not stored, but has to be
//! Rust 字符串没有 nul 终止符；其长度始终被存储，无需计算。而在 Rust 中
//! manually call a function like `strlen()` for `char`-based strings,
//! or `wcslen()` for `wchar_t`-based ones. Those functions return
//! the number of characters in the string excluding the nul
//! terminator, so the buffer length is really `len+1` characters.
//! Rust strings don't have a nul terminator; their length is always
//! stored and does not need to be calculated. While in Rust
//! accessing a string's length is an *O*(1) operation (because the
//! length is stored); in C it is an *O*(*n*) operation because the
//! 需要通过扫描字符串中的 nul 字符来计算长度
//! 终止符
//!
//! * **内部 nul 字符** - 当 C 字符串包含 nul 时
//! 终止符字符，这通常意味着它们不能包含 nul 字符
//! 中间的字符 — nul 字符本质上会
//! 截断字符串。Rust 字符串*可以*在中间包含 nul 字符，因为 nul 并不必须表示字符串的结束
//! 在 Rust 中
//! 所有权
//!
//! # 非 Rust 字符串的表示方式
//!
//! [`CString`] and [`CStr`] are useful when you need to transfer
//! 具有 C ABI 的语言时很有用，比如 Python。
//!
//! * **From Rust to C:** [`CString`] represents an owned, C-friendly
//! 字符串：它是以 nul 结尾的，并且没有内部 nul 字符。
//! Rust code can create a [`CString`] out of a normal string (provided
//! that the string doesn't have nul characters in the middle), and
//! then use a variety of methods to obtain a raw <code>\*mut [u8]</code> that can
//! 的函数。
//! 字符串的函数。
//!
//! * **From C to Rust:** [`CStr`] represents a borrowed C string; it
//! is what you would use to wrap a raw <code>\*const [u8]</code> that you got from
//! a C function. A [`CStr`] is guaranteed to be a nul-terminated array
//! of bytes. Once you have a [`CStr`], you can convert it to a Rust
//! <code>&[str]</code> if it's valid UTF-8, or lossily convert it by adding
//! 替换字符来容错地转换。
//!
//! [`OsString`] and [`OsStr`] are useful when you need to transfer
//! 操作系统本身时很有用，或者当捕获
//! the output of external commands. Conversions between [`OsString`],
//! [`OsStr`] and Rust strings work similarly to those for [`CString`]
//! and [`CStr`].
//!
//! * [`OsString`] losslessly represents an owned platform string. However, this
//! 表示形式不一定是平台原生形式。
//! 在 Rust 标准库中，用于将字符串传输到/从操作
//! system use [`OsString`] instead of plain strings. For example,
//! [`env::var_os()`] is used to query environment variables; it
//! returns an <code>[Option]<[OsString]></code>. If the environment variable
//! exists you will get a <code>[Some]\(os_string)</code>, which you can
//! *then* try to convert to a Rust string. This yields a [`Result`], so that
//! 你的代码可以检测环境变量中的错误
//! 实际上并不包含有效的 Unicode 数据。
//!
//! * [`OsStr`] losslessly represents a borrowed reference to a platform string.
//! 然而，这种表示形式不一定是平台原生支持的形式。
//! 它可以以类似的方式转换为 UTF-8 Rust 字符串切片。
//! [`OsString`].
//!
//! # 转换方式
//!
//! ## 在 Unix 系统上
//!
//! On Unix, [`OsStr`] implements the
//! <code>std::os::unix::ffi::[OsStrExt][unix.OsStrExt]</code> trait, which
//! augments it with two methods, [`from_bytes`] and [`as_bytes`].
//! 这些方法用于进行低成本的数据从字节切片到字节切片以及从字节切片到字节切片的转换。
//!
//! Additionally, on Unix [`OsString`] implements the
//! <code>std::os::unix::ffi::[OsStringExt][unix.OsStringExt]</code> trait,
//! which provides [`from_vec`] and [`into_vec`] methods that consume
//! their arguments, and take or produce vectors of [`u8`].
//!
//! ## 在 Windows 系统上
//!
//! An [`OsStr`] can be losslessly converted to a native Windows string. And
//! a native Windows string can be losslessly converted to an [`OsString`].
//!
//! On Windows, [`OsStr`] implements the
//! <code>std::os::windows::ffi::[OsStrExt][windows.OsStrExt]</code> trait,
//! which provides an [`encode_wide`] method. This provides an
//! iterator that can be [`collect`]ed into a vector of [`u16`]. After a nul
//! 字符后，就相当于一个原生 Windows 字符串。
//!
//! Additionally, on Windows [`OsString`] implements the
//! <code>std::os::windows:ffi::[OsStringExt][windows.OsStringExt]</code>
//! trait, which provides a [`from_wide`] method to convert a native Windows
//! string (without the terminating nul character) to an [`OsString`].
//!
//! ## 其他平台
//!
//! 许多其他平台在其
//! `std::os::*::ffi` module.
//!
//! ## 所有平台上
//!
//! On all platforms, [`OsStr`] consists of a sequence of bytes that is encoded as a superset of
//! UTF-8; see [`OsString`] for more details on its encoding on different platforms.
//!
//! For limited, inexpensive conversions from and to bytes, see [`OsStr::as_encoded_bytes`] and
//! [`OsStr::from_encoded_bytes_unchecked`].
//!
//! For basic string processing, see [`OsStr::slice_encoded_bytes`].
//!
//! [Unicode scalar value]: https://www.unicode.org/glossary/#unicode_scalar_value
//! [Unicode code point]: https://www.unicode.org/glossary/#code_point
//! [`env::set_var()`]: crate::env::set_var "env::set_var"
//! [`env::var_os()`]: crate::env::var_os "env::var_os"
//! [unix.OsStringExt]: crate::os::unix::ffi::OsStringExt "os::unix::ffi::OsStringExt"
//! [`from_vec`]: crate::os::unix::ffi::OsStringExt::from_vec "os::unix::ffi::OsStringExt::from_vec"
//! [`into_vec`]: crate::os::unix::ffi::OsStringExt::into_vec "os::unix::ffi::OsStringExt::into_vec"
//! [unix.OsStrExt]: crate::os::unix::ffi::OsStrExt "os::unix::ffi::OsStrExt"
//! [`from_bytes`]: crate::os::unix::ffi::OsStrExt::from_bytes "os::unix::ffi::OsStrExt::from_bytes"
//! [`as_bytes`]: crate::os::unix::ffi::OsStrExt::as_bytes "os::unix::ffi::OsStrExt::as_bytes"
//! [`OsStrExt`]: crate::os::unix::ffi::OsStrExt "os::unix::ffi::OsStrExt"
//! [windows.OsStrExt]: crate::os::windows::ffi::OsStrExt "os::windows::ffi::OsStrExt"
//! [`encode_wide`]: crate::os::windows::ffi::OsStrExt::encode_wide "os::windows::ffi::OsStrExt::encode_wide"
//! [`collect`]: crate::iter::Iterator::collect "iter::Iterator::collect"
//! [windows.OsStringExt]: crate::os::windows::ffi::OsStringExt "os::windows::ffi::OsStringExt"
//! [`from_wide`]: crate::os::windows::ffi::OsStringExt::from_wide "os::windows::ffi::OsStringExt::from_wide"

#![stable(feature = "rust1", since = "1.0.0")]

#[stable(feature = "c_str_module", since = "1.88.0")]
pub mod c_str;

#[unstable(feature = "c_variadic_va_arg_safe", issue = "162911", implied_by = "c_variadic")]
pub use core::ffi::VaArgSafe;
#[stable(feature = "c_variadic", since = "1.99.0")]
pub use core::ffi::VaList;
#[stable(feature = "core_c_void", since = "1.30.0")]
pub use core::ffi::c_void;
#[stable(feature = "core_ffi_c", since = "1.64.0")]
pub use core::ffi::{
    c_char, c_double, c_float, c_int, c_long, c_longlong, c_schar, c_short, c_uchar, c_uint,
    c_ulong, c_ulonglong, c_ushort,
};
#[unstable(feature = "c_size_t", issue = "88345")]
pub use core::ffi::{c_ptrdiff_t, c_size_t, c_ssize_t};

#[doc(inline)]
#[stable(feature = "cstr_from_bytes_until_nul", since = "1.69.0")]
pub use self::c_str::FromBytesUntilNulError;
#[doc(inline)]
#[stable(feature = "cstr_from_bytes", since = "1.10.0")]
pub use self::c_str::FromBytesWithNulError;
#[doc(inline)]
#[stable(feature = "cstring_from_vec_with_nul", since = "1.58.0")]
pub use self::c_str::FromVecWithNulError;
#[doc(inline)]
#[stable(feature = "cstring_into", since = "1.7.0")]
pub use self::c_str::IntoStringError;
#[doc(inline)]
#[stable(feature = "rust1", since = "1.0.0")]
pub use self::c_str::NulError;
#[doc(inline)]
#[stable(feature = "rust1", since = "1.0.0")]
pub use self::c_str::{CStr, CString};
#[stable(feature = "rust1", since = "1.0.0")]
#[doc(inline)]
pub use self::os_str::{OsStr, OsString};

#[stable(feature = "os_str_display", since = "1.87.0")]
pub mod os_str;
