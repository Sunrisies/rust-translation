//! [`CString`] and its related types.

use core::borrow::Borrow;
use core::ffi::{CStr, c_char};
use core::num::NonZero;
use core::slice::memchr;
use core::str::{self, FromStr, Utf8Error};
use core::{fmt, mem, ops, ptr, slice};

use crate::alloc::Allocator;
use crate::borrow::{Cow, ToOwned};
use crate::boxed::Box;
use crate::rc::Rc;
use crate::string::String;
#[cfg(target_has_atomic = "ptr")]
use crate::sync::Arc;
use crate::vec::Vec;

/// 一种表示拥有权、与 C 兼容、以空字符结尾且中间没有空字节的字符串类型的类型。
/// 中间部分。
///
/// 这种类型的作用是能够安全地从 Rust 字节切片或向量生成
/// 与 C 兼容的字符串。该类型的实例提供了底层字节中不含内部空字节
/// 以及最后一个字节为 0（“空终止符”）的静态保证。
/// 的保证（“空字符”）。
///
/// `CString` is to <code>&[CStr]</code> as [`String`] is to <code>&[str]</code>: the former
/// 引用。
/// 的引用。
///
/// # Creating a `CString`
///
/// A `CString` is created from either a byte slice or a byte vector,
/// or anything that implements <code>[Into]<[Vec]<[u8]>></code> (for
/// example, you can build a `CString` straight out of a [`String`] or
/// a <code>&[str]</code>, since both implement that trait).
/// You can create a `CString` from a literal with `CString::from(c"Text")`.
///
/// The [`CString::new`] method will actually check that the provided <code>&[[u8]]</code>
/// 中间是否没有 0 字节，如果找到则返回错误。
/// 。
///
/// # 提取整个 C 字符串的原始指针
///
/// `CString` implements an [`as_ptr`][`CStr::as_ptr`] method through the [`Deref`]
/// trait. This method will give you a `*const c_char` which you can
/// 直接传递给期望以空字符结尾的
/// string, like C's `strdup()`. Notice that [`as_ptr`][`CStr::as_ptr`] returns a
/// 只读指针；如果 C 代码写入该指针，会导致
/// 未定义行为。
///
/// # 提取整个 C 字符串的切片
///
/// Alternatively, you can obtain a <code>&[[u8]]</code> slice from a
/// `CString` with the [`CString::as_bytes`] method. Slices produced in this
/// 不包含尾随的空终止符。这在调用需要 `*const
/// u8` 参数的外部函数时非常有用，该参数不一定以空字符结尾，再加上另一个
/// u8` argument which is not necessarily nul-terminated, plus another
/// argument with the length of the string — like C's `strndup()`.
/// You can of course get the slice's length with its
/// [`len`][slice::len] method.
///
/// If you need a <code>&[[u8]]</code> slice *with* the nul terminator, you
/// can use [`CString::as_bytes_with_nul`] instead.
///
/// Once you have the kind of slice you need (with or without a nul
/// terminator), you can call the slice's own
/// [`as_ptr`][slice::as_ptr] method to get a read-only raw pointer to pass to
/// 外部函数。请参阅该函数的文档以了解
/// 关于确保原始指针生命周期的讨论。
///
/// [str]: prim@str "str"
/// [`Deref`]: ops::Deref
///
/// # 示例
///
/// ```ignore (extern-declaration)
/// # fn main() {
/// use std::ffi::CString;
/// use std::os::raw::c_char;
///
/// extern "C" {
///     fn my_printer(s: *const c_char);
/// }
///
/// // We are certain that our string doesn't have 0 bytes in the middle,
/// // so we can .expect()
/// let c_to_print = CString::new("Hello, world!").expect("we provided a string without NUL bytes, so CString::new should not fail");
/// unsafe {
///     my_printer(c_to_print.as_ptr());
/// }
/// # }
/// ```
///
/// # 安全性
///
/// `CString` is intended for working with traditional C-style strings
/// （由单个空字符终止的非零字节序列）；这些
/// 这类字符串的主要用途是与类似 C 的
/// 代码进行互操作。通常你需要将所有权转移给/从外部
/// 代码。强烈建议在使用前彻底阅读
/// documentation of `CString` before use, as improper ownership management
/// of `CString` instances can lead to invalid memory accesses, memory leaks,
/// 以及其他内存错误。
#[derive(PartialEq, PartialOrd, Eq, Ord, Hash, Clone)]
#[rustc_diagnostic_item = "cstring_type"]
#[rustc_insignificant_dtor]
#[stable(feature = "alloc_c_string", since = "1.64.0")]
pub struct CString {
    // Invariant 1: the slice ends with a zero byte and has a length of at least one.
    // Invariant 2: the slice contains only one zero byte.
    // Improper usage of unsafe function can break Invariant 2, but not Invariant 1.
    inner: Box<[u8]>,
}

/// 表示发现内部空字符的错误。
///
/// 虽然 Rust 字符串可能包含中间的空字节，但 C 字符串
/// 不能，因为该字节会有效地截断字符串。
///
/// This error is created by the [`new`][`CString::new`] method on
/// [`CString`]. See its documentation for more.
///
/// # 示例
///
/// ```
/// use std::ffi::{CString, NulError};
///
/// let _: NulError = CString::new(b"f\0oo".to_vec()).unwrap_err();
/// ```
#[derive(Clone, PartialEq, Eq, Debug)]
#[stable(feature = "alloc_c_string", since = "1.64.0")]
pub struct NulError(usize, Vec<u8>);

#[derive(Clone, PartialEq, Eq, Debug)]
enum FromBytesWithNulErrorKind {
    InteriorNul(usize),
    NotNulTerminated,
}

/// 表示空字节不在预期位置的错误。
///
/// The vector used to create a [`CString`] must have one and only one nul byte,
/// 位于末尾。
///
/// This error is created by the [`CString::from_vec_with_nul`] method.
/// 请参阅其文档以了解更多信息。
///
/// # 示例
///
/// ```
/// use std::ffi::{CString, FromVecWithNulError};
///
/// let _: FromVecWithNulError = CString::from_vec_with_nul(b"f\0oo".to_vec()).unwrap_err();
/// ```
#[derive(Clone, PartialEq, Eq, Debug)]
#[stable(feature = "alloc_c_string", since = "1.64.0")]
pub struct FromVecWithNulError {
    error_kind: FromBytesWithNulErrorKind,
    bytes: Vec<u8>,
}

#[stable(feature = "cstring_from_vec_with_nul", since = "1.58.0")]
impl FromVecWithNulError {
    /// Returns a slice of [`u8`]s bytes that were attempted to convert to a [`CString`].
    ///
    /// # 示例
    ///
    /// 基本用法：
    ///
    /// ```
    /// use std::ffi::CString;
    ///
    /// // Some invalid bytes in a vector
    /// let bytes = b"f\0oo".to_vec();
    ///
    /// let value = CString::from_vec_with_nul(bytes.clone());
    ///
    /// assert_eq!(&bytes[..], value.unwrap_err().as_bytes());
    /// ```
    #[must_use]
    #[stable(feature = "cstring_from_vec_with_nul", since = "1.58.0")]
    pub fn as_bytes(&self) -> &[u8] {
        &self.bytes[..]
    }

    /// Returns the bytes that were attempted to convert to a [`CString`].
    ///
    /// 此方法经过精心设计以避免分配。它将
    /// 处理错误，移出字节，因此不需要创建字节副本。
    /// # 示例
    ///
    /// # 示例
    ///
    /// 基本用法：
    ///
    /// ```
    /// use std::ffi::CString;
    ///
    /// // Some invalid bytes in a vector
    /// let bytes = b"f\0oo".to_vec();
    ///
    /// let value = CString::from_vec_with_nul(bytes.clone());
    ///
    /// assert_eq!(bytes, value.unwrap_err().into_bytes());
    /// ```
    #[must_use = "`self` will be dropped if the result is not used"]
    #[stable(feature = "cstring_from_vec_with_nul", since = "1.58.0")]
    pub fn into_bytes(self) -> Vec<u8> {
        self.bytes
    }
}

/// An error indicating invalid UTF-8 when converting a [`CString`] into a [`String`].
///
/// `CString` is just a wrapper over a buffer of bytes with a nul terminator;
/// [`CString::into_string`] performs UTF-8 validation on those bytes and may
/// 返回此错误。
///
/// This `struct` is created by [`CString::into_string()`]. See
/// 其文档以了解更多信息。
#[derive(Clone, PartialEq, Eq, Debug)]
#[stable(feature = "alloc_c_string", since = "1.64.0")]
pub struct IntoStringError {
    inner: CString,
    error: Utf8Error,
}

impl CString {
    /// 从字节容器创建一个新的 C 兼容字符串。
    ///
    /// 此函数将消耗提供的数据，并使用
    /// 底层字节来构建新字符串，确保
    /// 有一个末尾的 0 字节。这个末尾的 0 字节将由此函数添加；提供的数据不应
    /// 包含任何 0 字节。
    /// # 示例
    ///
    /// # 错误
    ///
    /// ```ignore (extern-declaration)
    /// use std::ffi::CString;
    /// use std::os::raw::c_char;
    ///
    /// extern "C" { fn puts(s: *const c_char); }
    ///
    /// let to_print = CString::new("Hello!").expect("we provided a string without NUL bytes, so CString::new should not fail");
    /// unsafe {
    ///     puts(to_print.as_ptr());
    /// }
    /// ```
    ///
    /// # 错误
    ///
    /// 如果提供的字节包含无效内容，此函数将返回错误。
    /// internal 0 byte. The [`NulError`] returned will contain the bytes as well as
    /// 空字节的位置。
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn new<T: Into<Vec<u8>>>(t: T) -> Result<CString, NulError> {
        trait SpecNewImpl {
            fn spec_new_impl(self) -> Result<CString, NulError>;
        }

        impl<T: Into<Vec<u8>>> SpecNewImpl for T {
            default fn spec_new_impl(self) -> Result<CString, NulError> {
                let bytes: Vec<u8> = self.into();
                match memchr::memchr(0, &bytes) {
                    Some(i) => Err(NulError(i, bytes)),
                    // SAFETY: We ensured there's no null bytes.
                    None => Ok(unsafe { CString::_from_vec_unchecked(bytes) }),
                }
            }
        }

        // Specialization for avoiding reallocation
        #[inline(always)] // Without that it is not inlined into specializations
        fn spec_new_impl_bytes(bytes: &[u8]) -> Result<CString, NulError> {
            // We cannot have such large slice that we would overflow here
            // but using `checked_add` allows LLVM to assume that capacity never overflows
            // and generate twice shorter code.
            // `saturating_add` doesn't help for some reason.
            let capacity = bytes.len().checked_add(1).unwrap();

            // Allocate before validation to avoid duplication of allocation code.
            // We still need to allocate and copy memory even if we get an error.
            let mut buffer = Vec::with_capacity(capacity);
            buffer.extend(bytes);

            // Check memory of self instead of new buffer.
            // This allows better optimizations if lto enabled.
            match memchr::memchr(0, bytes) {
                Some(i) => Err(NulError(i, buffer)),
                // SAFETY: We ensured there's no null bytes.
                None => Ok(unsafe { CString::_from_vec_unchecked(buffer) }),
            }
        }

        impl SpecNewImpl for &'_ [u8] {
            fn spec_new_impl(self) -> Result<CString, NulError> {
                spec_new_impl_bytes(self)
            }
        }

        impl SpecNewImpl for &'_ str {
            fn spec_new_impl(self) -> Result<CString, NulError> {
                spec_new_impl_bytes(self.as_bytes())
            }
        }

        impl SpecNewImpl for &'_ mut [u8] {
            fn spec_new_impl(self) -> Result<CString, NulError> {
                spec_new_impl_bytes(self)
            }
        }

        t.spec_new_impl()
    }

    /// 通过消耗字节向量来创建与 C 兼容的字符串，
    /// 无需检查内部是否有 0 字节。
    ///
    /// 此函数会追加一个尾随的 0 字节。
    ///
    /// This method is equivalent to [`CString::new`] except that no runtime
    /// assertion is made that `v` contains no 0 bytes, and it requires an
    /// 实际的字节向量，而不是可以通过 `Into` 转换得到的对象。
    ///
    /// # 安全性
    ///
    /// The caller must ensure `v` contains no nul bytes in its contents.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::ffi::CString;
    ///
    /// let raw = b"foo".to_vec();
    /// unsafe {
    ///     let c_string = CString::from_vec_unchecked(raw);
    /// }
    /// ```
    #[must_use]
    #[stable(feature = "rust1", since = "1.0.0")]
    pub unsafe fn from_vec_unchecked(v: Vec<u8>) -> Self {
        debug_assert!(memchr::memchr(0, &v).is_none());
        // SAFETY: Upheld by caller.
        unsafe { Self::_from_vec_unchecked(v) }
    }

    unsafe fn _from_vec_unchecked(mut v: Vec<u8>) -> Self {
        v.reserve_exact(1);
        v.push(0);
        Self { inner: v.into_boxed_slice() }
    }

    /// Retakes ownership of a `CString` that was transferred to C via
    /// [`CString::into_raw`].
    ///
    /// Additionally, the length of the string will be recalculated from the pointer.
    ///
    /// # 安全性
    ///
    /// This should only ever be called with a pointer that was earlier
    /// obtained by calling [`CString::into_raw`], and the memory it points to must not be accessed
    /// through any other pointer during the lifetime of reconstructed `CString`.
    /// 此函数不验证原始指针内存的所有权。
    /// 如果同一个原始指针被调用两次，可能会发生双释放。
    ///
    /// 此外，调用者必须确保指针不是悬空指针。
    /// 需要注意的是，长度不仅仅是“重新计算”，而且
    /// Additionally, the caller must ensure the pointer is not dangling.
    ///
    /// 方法在将字符串传递给可以修改字符串长度的 C 函数时不应使用。
    /// > **注意：** 如果您需要借用由
    /// [`CString::into_raw`] call. This means the [`CString::into_raw`]/`from_raw`
    /// > 由外部代码分配的字符串的所有权，您需要
    /// 自行处理适当的释放方式，很可能
    ///
    /// > 需要依赖外部代码的 API 来实现。
    /// > foreign code, use [`CStr`]. If you need to take ownership of
    /// > a string that was allocated by foreign code, you will need to
    /// > make your own provisions for freeing it appropriately, likely
    /// 由 libc 或 compiler_builtins 提供。
    ///
    /// # 示例
    ///
    /// Creates a `CString`, pass ownership to an `extern` function (via raw pointer), then retake
    /// ownership with `from_raw`:
    ///
    /// ```ignore (extern-declaration)
    /// use std::ffi::CString;
    /// use std::os::raw::c_char;
    ///
    /// extern "C" {
    ///     fn some_extern_function(s: *mut c_char);
    /// }
    ///
    /// let c_string = CString::from(c"Hello!");
    /// let raw = c_string.into_raw();
    /// unsafe {
    ///     some_extern_function(raw);
    ///     let c_string = CString::from_raw(raw);
    /// }
    /// ```
    #[must_use = "call `drop(from_raw(ptr))` if you intend to drop the `CString`"]
    #[stable(feature = "cstr_memory", since = "1.4.0")]
    pub unsafe fn from_raw(ptr: *mut c_char) -> CString {
        // SAFETY: This is called with a pointer that was obtained from a call
        // to `CString::into_raw` and the length has not been modified. As such,
        // we know there is a NUL byte (and only one) at the end and that the
        // information about the size of the allocation is correct on Rust's
        // side.
        unsafe {
            unsafe extern "C" {
                /// 由 libc 或 compiler_builtins 提供。
                fn strlen(s: *const c_char) -> usize;
            }
            let len = strlen(ptr) + 1; // Including the NUL byte
            let slice = slice::from_raw_parts_mut(ptr, len);
            CString { inner: Box::from_raw(slice as *mut [c_char] as *mut [u8]) }
        }
    }

    /// Consumes the `CString` and transfers ownership of the string to a C caller.
    ///
    /// The pointer which this function returns must be returned to Rust and reconstituted using
    /// [`CString::from_raw`] to be properly deallocated. Specifically, one
    /// should *not* use the standard C `free()` function to deallocate
    /// 这个字符串。
    ///
    /// Failure to call [`CString::from_raw`] will lead to a memory leak.
    ///
    /// C 端**不得**修改字符串的长度（例如通过在字符串中写入空字节或删除最后一个字节）。
    /// 在将其返回给 Rust 之前，它必须保持原始状态。
    /// it makes it back into Rust using [`CString::from_raw`]. See the safety section
    /// in [`CString::from_raw`].
    ///
    /// # 示例
    ///
    /// ```
    /// use std::ffi::CString;
    ///
    /// let c_string = CString::from(c"foo");
    ///
    /// let ptr = c_string.into_raw();
    ///
    /// unsafe {
    ///     assert_eq!(b'f', *ptr as u8);
    ///     assert_eq!(b'o', *ptr.add(1) as u8);
    ///     assert_eq!(b'o', *ptr.add(2) as u8);
    ///     assert_eq!(b'\0', *ptr.add(3) as u8);
    ///
    ///     // retake pointer to free memory
    ///     let _ = CString::from_raw(ptr);
    /// }
    /// ```
    #[inline]
    #[must_use = "`self` will be dropped if the result is not used"]
    #[stable(feature = "cstr_memory", since = "1.4.0")]
    pub fn into_raw(self) -> *mut c_char {
        Box::into_raw(self.into_inner()) as *mut c_char
    }

    /// Converts the `CString` into a [`String`] if it contains valid UTF-8 data.
    ///
    /// On failure, ownership of the original `CString` is returned.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::ffi::CString;
    ///
    /// let valid_utf8 = vec![b'f', b'o', b'o'];
    /// let cstring = CString::new(valid_utf8).expect("we provided bytes that do not have a NUL byte, so CString::new should not fail");
    /// assert_eq!(cstring.into_string().expect("we provided bytes that are valid UTF-8, so `into_string` should not fail"), "foo");
    ///
    /// let invalid_utf8 = vec![b'f', 0xff, b'o', b'o'];
    /// let cstring = CString::new(invalid_utf8).expect("we provided bytes that do not have a NUL byte, so CString::new should not fail");
    /// let err = cstring.into_string().expect_err("we provided bytes that are invalid UTF-8, so `into_string` should fail");
    /// assert_eq!(err.utf8_error().valid_up_to(), 1);
    /// ```
    #[stable(feature = "cstring_into", since = "1.7.0")]
    pub fn into_string(self) -> Result<String, IntoStringError> {
        String::from_utf8(self.into_bytes()).map_err(|e| IntoStringError {
            error: e.utf8_error(),
            // SAFETY: `CString`s never contain null bytes.
            inner: unsafe { Self::_from_vec_unchecked(e.into_bytes()) },
        })
    }

    /// Consumes the `CString` and returns the underlying byte buffer.
    ///
    /// 返回的缓冲区**不包含**末尾的空字节终止符，并且保证内部没有空字节。
    /// 字节。
    /// # 示例
    ///
    /// # 示例
    ///
    /// ```
    /// use std::ffi::CString;
    ///
    /// let c_string = CString::from(c"foo");
    /// let bytes = c_string.into_bytes();
    /// assert_eq!(bytes, vec![b'f', b'o', b'o']);
    /// ```
    #[must_use = "`self` will be dropped if the result is not used"]
    #[stable(feature = "cstring_into", since = "1.7.0")]
    pub fn into_bytes(self) -> Vec<u8> {
        let mut vec = self.into_inner().into_vec();
        let _nul = vec.pop();
        debug_assert_eq!(_nul, Some(0u8));
        vec
    }

    /// Equivalent to [`CString::into_bytes()`] except that the
    /// 返回的向量包含末尾的空字节终止符。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::ffi::CString;
    ///
    /// let c_string = CString::from(c"foo");
    /// let bytes = c_string.into_bytes_with_nul();
    /// assert_eq!(bytes, vec![b'f', b'o', b'o', b'\0']);
    /// ```
    #[must_use = "`self` will be dropped if the result is not used"]
    #[stable(feature = "cstring_into", since = "1.7.0")]
    pub fn into_bytes_with_nul(self) -> Vec<u8> {
        self.into_inner().into_vec()
    }

    /// Returns the contents of this `CString` as a slice of bytes.
    ///
    /// 返回的切片**不包含**末尾的空字节终止符，并且保证内部没有空字节。
    /// terminator, and it is guaranteed to not have any interior nul
    /// # 示例
    /// [`CString::as_bytes_with_nul`] instead.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::ffi::CString;
    ///
    /// let c_string = CString::from(c"foo");
    /// let bytes = c_string.as_bytes();
    /// assert_eq!(bytes, &[b'f', b'o', b'o']);
    /// ```
    #[inline]
    #[must_use]
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn as_bytes(&self) -> &[u8] {
        // SAFETY: CString has a length at least 1
        unsafe { self.inner.get_unchecked(..self.inner.len() - 1) }
    }

    /// Equivalent to [`CString::as_bytes()`] except that the
    /// 返回的切片包含末尾的空字节终止符。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::ffi::CString;
    ///
    /// let c_string = CString::from(c"foo");
    /// let bytes = c_string.as_bytes_with_nul();
    /// assert_eq!(bytes, &[b'f', b'o', b'o', b'\0']);
    /// ```
    #[inline]
    #[must_use]
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn as_bytes_with_nul(&self) -> &[u8] {
        &self.inner
    }

    /// Extracts a [`CStr`] slice containing the entire string.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::ffi::{CString, CStr};
    ///
    /// let c_string = CString::from(c"foo");
    /// let cstr = c_string.as_c_str();
    /// assert_eq!(cstr,
    ///            CStr::from_bytes_with_nul(b"foo\0").expect("we provided bytes that has one NUL byte exactly at the end, so CStr::from_bytes_with_nul should not fail"));
    /// ```
    #[inline]
    #[must_use]
    #[stable(feature = "as_c_str", since = "1.20.0")]
    #[rustc_diagnostic_item = "cstring_as_c_str"]
    pub fn as_c_str(&self) -> &CStr {
        // SAFETY: Ensured by `as_bytes_with_nul`.
        unsafe { CStr::from_bytes_with_nul_unchecked(self.as_bytes_with_nul()) }
    }

    /// Converts this `CString` into a boxed [`CStr`].
    ///
    /// # 示例
    ///
    /// ```
    /// let c_string = c"foo".to_owned();
    /// let boxed = c_string.into_boxed_c_str();
    /// assert_eq!(boxed.to_bytes_with_nul(), b"foo\0");
    /// ```
    #[must_use = "`self` will be dropped if the result is not used"]
    #[stable(feature = "into_boxed_c_str", since = "1.20.0")]
    pub fn into_boxed_c_str(self) -> Box<CStr> {
        // SAFETY: Typecast of [u8] to CStr is valid and we know contents have
        // no nulls except for the terminating byte.
        unsafe { Box::from_raw(Box::into_raw(self.into_inner()) as *mut CStr) }
    }

    /// Bypass "move out of struct which implements [`Drop`] trait" restriction.
    #[inline]
    fn into_inner(self) -> Box<[u8]> {
        let this = mem::ManuallyDrop::new(self);
        // SAFETY: `mem::forget(self)` invalidates the previous call to `ptr::read(&self.inner)`
        // so we use `ManuallyDrop` to ensure `self` is not dropped.
        // Then we can return the box directly without invalidating it.
        // See https://github.com/rust-lang/rust/issues/62553.
        unsafe { ptr::read(&this.inner) }
    }

    /// Converts a <code>[Vec]<[u8]></code> to a [`CString`] without checking the
    /// invariants on the given [`Vec`].
    ///
    /// # 安全性
    ///
    /// The given [`Vec`] **must** have one nul byte as its last element.
    /// 这意味着它不能为空，也不应在其他任何位置有空字节。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::ffi::CString;
    /// assert_eq!(
    ///     unsafe { CString::from_vec_with_nul_unchecked(b"abc\0".to_vec()) },
    ///     unsafe { CString::from_vec_unchecked(b"abc".to_vec()) }
    /// );
    /// ```
    #[must_use]
    #[stable(feature = "cstring_from_vec_with_nul", since = "1.58.0")]
    pub unsafe fn from_vec_with_nul_unchecked(v: Vec<u8>) -> Self {
        debug_assert!(memchr::memchr(0, &v).unwrap() + 1 == v.len());
        // SAFETY: Upheld by caller.
        unsafe { Self::_from_vec_with_nul_unchecked(v) }
    }

    unsafe fn _from_vec_with_nul_unchecked(v: Vec<u8>) -> Self {
        Self { inner: v.into_boxed_slice() }
    }

    /// Attempts to convert a <code>[Vec]<[u8]></code> to a [`CString`].
    ///
    /// Runtime checks are present to ensure there is only one nul byte in the
    /// [`Vec`], its last element.
    ///
    /// # 错误
    ///
    /// 如果存在一个空字节且不是最后一个元素，或者没有空字节，
    /// 则将返回错误。
    ///
    /// # 示例
    ///
    /// A successful conversion will produce the same result as [`CString::new`]
    /// 当不包含末尾的空字节时调用时。
    ///
    /// ```
    /// use std::ffi::CString;
    /// assert_eq!(
    ///     CString::from_vec_with_nul(b"abc\0".to_vec())
    ///         .expect("we provided bytes that has one NUL byte exactly at the end, so CString::from_vec_with_nul should not fail"),
    ///     c"abc".to_owned()
    /// );
    /// ```
    ///
    /// An incorrectly formatted [`Vec`] will produce an error.
    ///
    /// ```
    /// use std::ffi::{CString, FromVecWithNulError};
    /// // Interior nul byte
    /// let _: FromVecWithNulError = CString::from_vec_with_nul(b"a\0bc".to_vec()).unwrap_err();
    /// // No nul byte
    /// let _: FromVecWithNulError = CString::from_vec_with_nul(b"abc".to_vec()).unwrap_err();
    /// ```
    #[stable(feature = "cstring_from_vec_with_nul", since = "1.58.0")]
    pub fn from_vec_with_nul(v: Vec<u8>) -> Result<Self, FromVecWithNulError> {
        let nul_pos = memchr::memchr(0, &v);
        match nul_pos {
            Some(nul_pos) if nul_pos + 1 == v.len() => {
                // SAFETY: We know there is only one nul byte, at the end
                // of the vec.
                Ok(unsafe { Self::_from_vec_with_nul_unchecked(v) })
            }
            Some(nul_pos) => Err(FromVecWithNulError {
                error_kind: FromBytesWithNulErrorKind::InteriorNul(nul_pos),
                bytes: v,
            }),
            None => Err(FromVecWithNulError {
                error_kind: FromBytesWithNulErrorKind::NotNulTerminated,
                bytes: v,
            }),
        }
    }
}

// Turns this `CString` into an empty string to prevent
// memory-unsafe code from working by accident. Inline
// to prevent LLVM from optimizing it away in debug builds.
#[stable(feature = "cstring_drop", since = "1.13.0")]
impl Drop for CString {
    #[inline]
    fn drop(&mut self) {
        // SAFETY: Length is always at least one.
        unsafe {
            *self.inner.get_unchecked_mut(0) = 0;
        }
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl ops::Deref for CString {
    type Target = CStr;

    #[inline]
    fn deref(&self) -> &CStr {
        self.as_c_str()
    }
}

/// Delegates to the [`CStr`] implementation of [`fmt::Debug`],
/// 以十六进制转义形式显示无效的 UTF-8 字符。
#[stable(feature = "rust1", since = "1.0.0")]
impl fmt::Debug for CString {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        fmt::Debug::fmt(self.as_c_str(), f)
    }
}

#[stable(feature = "cstring_into", since = "1.7.0")]
impl From<CString> for Vec<u8> {
    /// Converts a [`CString`] into a <code>[Vec]<[u8]></code>.
    ///
    /// The conversion consumes the [`CString`], and removes the terminating NUL byte.
    #[inline]
    fn from(s: CString) -> Vec<u8> {
        s.into_bytes()
    }
}

#[stable(feature = "cstr_default", since = "1.10.0")]
impl Default for CString {
    /// Creates an empty `CString`.
    fn default() -> CString {
        let a: &CStr = Default::default();
        a.to_owned()
    }
}

#[stable(feature = "cstr_borrow", since = "1.3.0")]
impl Borrow<CStr> for CString {
    #[inline]
    fn borrow(&self) -> &CStr {
        self
    }
}

#[stable(feature = "cstring_from_cow_cstr", since = "1.28.0")]
impl<'a> From<Cow<'a, CStr>> for CString {
    /// Converts a `Cow<'a, CStr>` into a `CString`, by copying the contents if they are
    /// borrowed.
    #[inline]
    fn from(s: Cow<'a, CStr>) -> Self {
        s.into_owned()
    }
}

#[stable(feature = "box_from_c_str", since = "1.17.0")]
impl From<&CStr> for Box<CStr> {
    /// Converts a `&CStr` into a `Box<CStr>`,
    /// by copying the contents into a newly allocated [`Box`].
    fn from(s: &CStr) -> Box<CStr> {
        Box::clone_from_ref(s)
    }
}

#[stable(feature = "box_from_mut_slice", since = "1.84.0")]
impl From<&mut CStr> for Box<CStr> {
    /// Converts a `&mut CStr` into a `Box<CStr>`,
    /// by copying the contents into a newly allocated [`Box`].
    fn from(s: &mut CStr) -> Box<CStr> {
        Self::from(&*s)
    }
}

#[stable(feature = "box_from_cow", since = "1.45.0")]
impl From<Cow<'_, CStr>> for Box<CStr> {
    /// Converts a `Cow<'a, CStr>` into a `Box<CStr>`,
    /// 如果内容被借用，则复制其内容。
    #[inline]
    fn from(cow: Cow<'_, CStr>) -> Box<CStr> {
        match cow {
            Cow::Borrowed(s) => Box::from(s),
            Cow::Owned(s) => Box::from(s),
        }
    }
}

#[stable(feature = "c_string_from_box", since = "1.18.0")]
impl From<Box<CStr>> for CString {
    /// Converts a <code>[Box]<[CStr]></code> into a [`CString`] without copying or allocating.
    #[inline]
    fn from(s: Box<CStr>) -> CString {
        let raw = Box::into_raw(s) as *mut [u8];
        // SAFETY: Converting a *mut CStr -> *mut [u8] -> CString is valid.
        CString { inner: unsafe { Box::from_raw(raw) } }
    }
}

#[stable(feature = "cstring_from_vec_of_nonzerou8", since = "1.43.0")]
impl From<Vec<NonZero<u8>>> for CString {
    /// Converts a <code>[Vec]<[NonZero]<[u8]>></code> into a [`CString`] without
    /// 复制或检查内部 NUL 字节。
    #[inline]
    fn from(v: Vec<NonZero<u8>>) -> CString {
        // Transmute `Vec<NonZero<u8>>` to `Vec<u8>`.
        let v: Vec<u8> = {
            let (ptr, len, cap): (*mut NonZero<u8>, _, _) = Vec::into_raw_parts(v);
            // SAFETY:
            //   - transmuting between `NonZero<u8>` and `u8` is sound;
            //   - `alloc::Layout<NonZero<u8>> == alloc::Layout<u8>`.
            unsafe { Vec::from_raw_parts(ptr.cast::<u8>(), len, cap) }
        };
        // SAFETY: `v` cannot contain nul bytes, given the type-level
        // invariant of `NonZero<u8>`.
        unsafe { Self::_from_vec_unchecked(v) }
    }
}

#[stable(feature = "c_string_from_str", since = "1.85.0")]
impl FromStr for CString {
    type Err = NulError;

    /// Converts a string `s` into a [`CString`].
    ///
    /// This method is equivalent to [`CString::new`].
    #[inline]
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Self::new(s)
    }
}

#[stable(feature = "c_string_from_str", since = "1.85.0")]
impl TryFrom<CString> for String {
    type Error = IntoStringError;

    /// Converts a [`CString`] into a [`String`] if it contains valid UTF-8 data.
    ///
    /// This method is equivalent to [`CString::into_string`].
    #[inline]
    fn try_from(value: CString) -> Result<Self, Self::Error> {
        value.into_string()
    }
}

#[stable(feature = "more_box_slice_clone", since = "1.29.0")]
impl<A: Allocator + Clone> Clone for Box<CStr, A> {
    #[inline]
    fn clone(&self) -> Self {
        Box::clone_from_ref_in(&**self, Self::allocator(self).clone())
    }
}

#[stable(feature = "box_from_c_string", since = "1.20.0")]
impl From<CString> for Box<CStr> {
    /// Converts a [`CString`] into a <code>[Box]<[CStr]></code> without copying or allocating.
    #[inline]
    fn from(s: CString) -> Box<CStr> {
        s.into_boxed_c_str()
    }
}

#[stable(feature = "cow_from_cstr", since = "1.28.0")]
impl<'a> From<CString> for Cow<'a, CStr> {
    /// Converts a [`CString`] into an owned [`Cow`] without copying or allocating.
    #[inline]
    fn from(s: CString) -> Cow<'a, CStr> {
        Cow::Owned(s)
    }
}

#[stable(feature = "cow_from_cstr", since = "1.28.0")]
impl<'a> From<&'a CStr> for Cow<'a, CStr> {
    /// Converts a [`CStr`] into a borrowed [`Cow`] without copying or allocating.
    #[inline]
    fn from(s: &'a CStr) -> Cow<'a, CStr> {
        Cow::Borrowed(s)
    }
}

#[stable(feature = "cow_from_cstr", since = "1.28.0")]
impl<'a> From<&'a CString> for Cow<'a, CStr> {
    /// Converts a `&`[`CString`] into a borrowed [`Cow`] without copying or allocating.
    #[inline]
    fn from(s: &'a CString) -> Cow<'a, CStr> {
        Cow::Borrowed(s.as_c_str())
    }
}

#[cfg(target_has_atomic = "ptr")]
#[stable(feature = "shared_from_slice2", since = "1.24.0")]
impl From<CString> for Arc<CStr> {
    /// Converts a [`CString`] into an <code>[Arc]<[CStr]></code> by moving the [`CString`]
    /// data into a new [`Arc`] buffer.
    #[inline]
    fn from(s: CString) -> Arc<CStr> {
        let arc: Arc<[u8]> = Arc::from(s.into_inner());
        // SAFETY: Type conversion is valid.
        unsafe { Arc::from_raw(Arc::into_raw(arc) as *const CStr) }
    }
}

#[cfg(target_has_atomic = "ptr")]
#[stable(feature = "shared_from_slice2", since = "1.24.0")]
impl From<&CStr> for Arc<CStr> {
    /// Converts a `&CStr` into a `Arc<CStr>`,
    /// by copying the contents into a newly allocated [`Arc`].
    #[inline]
    fn from(s: &CStr) -> Arc<CStr> {
        let arc: Arc<[u8]> = Arc::from(s.to_bytes_with_nul());
        // SAFETY: Type conversion is valid.
        unsafe { Arc::from_raw(Arc::into_raw(arc) as *const CStr) }
    }
}

#[cfg(target_has_atomic = "ptr")]
#[stable(feature = "shared_from_mut_slice", since = "1.84.0")]
impl From<&mut CStr> for Arc<CStr> {
    /// Converts a `&mut CStr` into a `Arc<CStr>`,
    /// by copying the contents into a newly allocated [`Arc`].
    #[inline]
    fn from(s: &mut CStr) -> Arc<CStr> {
        Arc::from(&*s)
    }
}

#[stable(feature = "shared_from_slice2", since = "1.24.0")]
impl From<CString> for Rc<CStr> {
    /// Converts a [`CString`] into an <code>[Rc]<[CStr]></code> by moving the [`CString`]
    /// data into a new [`Rc`] buffer.
    #[inline]
    fn from(s: CString) -> Rc<CStr> {
        let rc: Rc<[u8]> = Rc::from(s.into_inner());
        // SAFETY: Type conversion is valid.
        unsafe { Rc::from_raw(Rc::into_raw(rc) as *const CStr) }
    }
}

#[stable(feature = "shared_from_slice2", since = "1.24.0")]
impl From<&CStr> for Rc<CStr> {
    /// Converts a `&CStr` into a `Rc<CStr>`,
    /// by copying the contents into a newly allocated [`Rc`].
    #[inline]
    fn from(s: &CStr) -> Rc<CStr> {
        let rc: Rc<[u8]> = Rc::from(s.to_bytes_with_nul());
        // SAFETY: Type conversion is valid.
        unsafe { Rc::from_raw(Rc::into_raw(rc) as *const CStr) }
    }
}

#[stable(feature = "shared_from_mut_slice", since = "1.84.0")]
impl From<&mut CStr> for Rc<CStr> {
    /// Converts a `&mut CStr` into a `Rc<CStr>`,
    /// by copying the contents into a newly allocated [`Rc`].
    #[inline]
    fn from(s: &mut CStr) -> Rc<CStr> {
        Rc::from(&*s)
    }
}

#[cfg(not(no_global_oom_handling))]
#[stable(feature = "more_rc_default_impls", since = "1.80.0")]
impl Default for Rc<CStr> {
    /// 在 Rc 内部创建一个空的 CStr。
    ///
    /// 该对象可能与同一线程中的其他 Rc 共享或不共享内存分配。
    #[inline]
    fn default() -> Self {
        Rc::from(c"")
    }
}

#[stable(feature = "default_box_extra", since = "1.17.0")]
impl Default for Box<CStr> {
    fn default() -> Box<CStr> {
        Box::from(c"")
    }
}

impl NulError {
    /// 返回导致
    /// [`CString::new`] to fail.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::ffi::CString;
    ///
    /// let nul_error = CString::new("foo\0bar").unwrap_err();
    /// assert_eq!(nul_error.nul_position(), 3);
    ///
    /// let nul_error = CString::new("foo bar\0").unwrap_err();
    /// assert_eq!(nul_error.nul_position(), 7);
    /// ```
    #[must_use]
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn nul_position(&self) -> usize {
        self.0
    }

    /// 消耗此错误，返回产生该错误的底层字节向量。
    /// 首先生成该错误的底层数据。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::ffi::CString;
    ///
    /// let nul_error = CString::new("foo\0bar").unwrap_err();
    /// assert_eq!(nul_error.into_vec(), b"foo\0bar");
    /// ```
    #[must_use = "`self` will be dropped if the result is not used"]
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn into_vec(self) -> Vec<u8> {
        self.1
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl fmt::Display for NulError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "nul byte found in provided data at position: {}", self.0)
    }
}

#[stable(feature = "cstring_from_vec_with_nul", since = "1.58.0")]
impl fmt::Display for FromVecWithNulError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self.error_kind {
            FromBytesWithNulErrorKind::InteriorNul(pos) => {
                write!(f, "data provided contains an interior nul byte at pos {pos}")
            }
            FromBytesWithNulErrorKind::NotNulTerminated => {
                write!(f, "data provided is not nul terminated")
            }
        }
    }
}

impl IntoStringError {
    /// Consumes this error, returning original [`CString`] which generated the
    /// error.
    #[must_use = "`self` will be dropped if the result is not used"]
    #[stable(feature = "cstring_into", since = "1.7.0")]
    pub fn into_cstring(self) -> CString {
        self.inner
    }

    /// 访问导致此错误的底层 UTF-8 错误。
    #[must_use]
    #[stable(feature = "cstring_into", since = "1.7.0")]
    pub fn utf8_error(&self) -> Utf8Error {
        self.error
    }
}

#[stable(feature = "cstring_into", since = "1.7.0")]
impl fmt::Display for IntoStringError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        "C string contained non-utf8 bytes".fmt(f)
    }
}

#[stable(feature = "cstr_borrow", since = "1.3.0")]
impl ToOwned for CStr {
    type Owned = CString;

    fn to_owned(&self) -> CString {
        CString { inner: self.to_bytes_with_nul().into() }
    }

    fn clone_into(&self, target: &mut CString) {
        let src = self.to_bytes_with_nul();
        // If the lengths match, we can reuse the existing allocation without any overhead.
        if target.inner.len() == src.len() {
            target.inner.copy_from_slice(src);
        } else {
            // Reuse the existing allocation's capacity by converting to a Vec.
            // We temporarily replace `target` with a valid dummy to remain panic-safe.
            let mut b = mem::replace(&mut target.inner, Box::new([0])).into_vec();
            self.to_bytes_with_nul().clone_into(&mut b);
            target.inner = b.into_boxed_slice();
        }
    }
}

#[stable(feature = "cstring_asref", since = "1.7.0")]
impl From<&CStr> for CString {
    /// Converts a <code>&[CStr]</code> into a [`CString`]
    /// 通过复制内容到新分配区来实现。
    fn from(s: &CStr) -> CString {
        s.to_owned()
    }
}

#[stable(feature = "c_string_eq_c_str", since = "1.90.0")]
impl PartialEq<CStr> for CString {
    #[inline]
    fn eq(&self, other: &CStr) -> bool {
        **self == *other
    }

    #[inline]
    fn ne(&self, other: &CStr) -> bool {
        **self != *other
    }
}

#[stable(feature = "c_string_eq_c_str", since = "1.90.0")]
impl PartialEq<&CStr> for CString {
    #[inline]
    fn eq(&self, other: &&CStr) -> bool {
        **self == **other
    }

    #[inline]
    fn ne(&self, other: &&CStr) -> bool {
        **self != **other
    }
}

#[cfg(not(no_global_oom_handling))]
#[stable(feature = "c_string_eq_c_str", since = "1.90.0")]
impl PartialEq<Cow<'_, CStr>> for CString {
    #[inline]
    fn eq(&self, other: &Cow<'_, CStr>) -> bool {
        **self == **other
    }

    #[inline]
    fn ne(&self, other: &Cow<'_, CStr>) -> bool {
        **self != **other
    }
}

#[stable(feature = "cstring_asref", since = "1.7.0")]
impl ops::Index<ops::RangeFull> for CString {
    type Output = CStr;

    #[inline]
    fn index(&self, _index: ops::RangeFull) -> &CStr {
        self
    }
}

#[stable(feature = "cstring_asref", since = "1.7.0")]
impl AsRef<CStr> for CString {
    #[inline]
    fn as_ref(&self) -> &CStr {
        self
    }
}

impl CStr {
    /// Converts a `CStr` into a <code>[Cow]<[str]></code>.
    ///
    /// If the contents of the `CStr` are valid UTF-8 data, this
    /// function will return a <code>[Cow]::[Borrowed]\(&[str])</code>
    /// with the corresponding <code>&[str]</code> slice. Otherwise, it will
    /// replace any invalid UTF-8 sequences with
    /// [`U+FFFD REPLACEMENT CHARACTER`][U+FFFD] and return a
    /// <code>[Cow]::[Owned]\([String])</code> with the result.
    ///
    /// [str]: prim@str "str"
    /// [Borrowed]: Cow::Borrowed
    /// [Owned]: Cow::Owned
    /// [U+FFFD]: char::REPLACEMENT_CHARACTER
    ///
    /// # 
    ///
    /// Calling `to_string_lossy` on a `CStr` containing valid UTF-8. The leading
    /// `c` on the string literal denotes a `CStr`.
    ///
    /// ```
    /// use std::borrow::Cow;
    ///
    /// assert_eq!(c"Hello World".to_string_lossy(), Cow::Borrowed("Hello World"));
    /// ```
    ///
    /// Calling `to_string_lossy` on a `CStr` containing invalid UTF-8:
    ///
    /// ```
    /// use std::borrow::Cow;
    ///
    /// assert_eq!(
    ///     c"Hello \xF0\x90\x80World".to_string_lossy(),
    ///     Cow::Owned(String::from("Hello �World")) as Cow<'_, str>
    /// );
    /// ```
    #[rustc_allow_incoherent_impl]
    #[must_use = "this returns the result of the operation, \
                  without modifying the original"]
    #[stable(feature = "cstr_to_str", since = "1.4.0")]
    pub fn to_string_lossy(&self) -> Cow<'_, str> {
        String::from_utf8_lossy(self.to_bytes())
    }

    /// Converts a <code>[Box]<[CStr]></code> into a [`CString`] without copying or allocating.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::ffi::{CStr, CString};
    ///
    /// let boxed: Box<CStr> = Box::from(c"foo");
    /// let c_string: CString = c"foo".to_owned();
    ///
    /// assert_eq!(boxed.into_c_string(), c_string);
    /// ```
    #[rustc_allow_incoherent_impl]
    #[must_use = "`self` will be dropped if the result is not used"]
    #[stable(feature = "into_boxed_c_str", since = "1.20.0")]
    pub fn into_c_string(self: Box<Self>) -> CString {
        CString::from(self)
    }
}

#[stable(feature = "c_string_eq_c_str", since = "1.90.0")]
impl PartialEq<CString> for CStr {
    #[inline]
    fn eq(&self, other: &CString) -> bool {
        *self == **other
    }

    #[inline]
    fn ne(&self, other: &CString) -> bool {
        *self != **other
    }
}

#[cfg(not(no_global_oom_handling))]
#[stable(feature = "c_string_eq_c_str", since = "1.90.0")]
impl PartialEq<Cow<'_, Self>> for CStr {
    #[inline]
    fn eq(&self, other: &Cow<'_, Self>) -> bool {
        *self == **other
    }

    #[inline]
    fn ne(&self, other: &Cow<'_, Self>) -> bool {
        *self != **other
    }
}

#[cfg(not(no_global_oom_handling))]
#[stable(feature = "c_string_eq_c_str", since = "1.90.0")]
impl PartialEq<CStr> for Cow<'_, CStr> {
    #[inline]
    fn eq(&self, other: &CStr) -> bool {
        **self == *other
    }

    #[inline]
    fn ne(&self, other: &CStr) -> bool {
        **self != *other
    }
}

#[cfg(not(no_global_oom_handling))]
#[stable(feature = "c_string_eq_c_str", since = "1.90.0")]
impl PartialEq<&CStr> for Cow<'_, CStr> {
    #[inline]
    fn eq(&self, other: &&CStr) -> bool {
        **self == **other
    }

    #[inline]
    fn ne(&self, other: &&CStr) -> bool {
        **self != **other
    }
}

#[cfg(not(no_global_oom_handling))]
#[stable(feature = "c_string_eq_c_str", since = "1.90.0")]
impl PartialEq<CString> for Cow<'_, CStr> {
    #[inline]
    fn eq(&self, other: &CString) -> bool {
        **self == **other
    }

    #[inline]
    fn ne(&self, other: &CString) -> bool {
        **self != **other
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl core::error::Error for NulError {}

#[stable(feature = "cstring_from_vec_with_nul", since = "1.58.0")]
impl core::error::Error for FromVecWithNulError {}

#[stable(feature = "cstring_into", since = "1.7.0")]
impl core::error::Error for IntoStringError {
    fn source(&self) -> Option<&(dyn core::error::Error + 'static)> {
        Some(&self.error)
    }
}
