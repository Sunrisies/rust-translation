//! [`CStr`] and its related types.

use crate::cmp::Ordering;
use crate::error::Error;
use crate::ffi::c_char;
use crate::intrinsics::const_eval_select;
use crate::iter::FusedIterator;
use crate::marker::PhantomData;
use crate::num::niche_types::UsizeNoHighBitMinusOne;
use crate::ptr::NonNull;
use crate::slice::memchr;
use crate::{fmt, ops, range, slice, str};

// FIXME: because this is doc(inline)d, we *have* to use intra-doc links because the actual link
//   depends on where the item is being documented. however, since this is libcore, we can't
//   actually reference libstd or liballoc in intra-doc links. so, the best we can do is remove the
//   links to `CString` and `String` for now until a solution is developed

/// 动态大小的 C 字符串视图。
///
/// The type `&CStr` represents a reference to a borrowed nul-terminated
/// array of bytes. It can be constructed safely from a <code>&[[u8]]</code>
/// slice, or unsafely from a raw `*const c_char`. It can be expressed as a
/// literal in the form `c"Hello world"`.
///
/// The `&CStr` can then be converted to a Rust <code>&[str]</code> by performing
/// UTF-8 validation, or into an owned `CString`.
///
/// `&CStr` is to `CString` as <code>&[str]</code> is to `String`: the former
/// 每对中的前一种都是借用引用；后一种则是拥有权。
/// 字符串。
///
/// Note that this structure does **not** have a guaranteed layout (the `repr(transparent)`
/// 尽管如此，不应将其放入 FFI 函数的签名中。
/// Instead, safe wrappers of FFI functions may leverage [`CStr::as_ptr`] and the unsafe
/// [`CStr::from_ptr`] constructor to provide a safe interface to other consumers.
///
/// # 示例
///
/// 检查外部 C 字符串：
///
/// ```
/// use std::ffi::CStr;
/// use std::os::raw::c_char;
///
/// # /* Extern functions are awkward in doc comments - fake it instead
/// extern "C" { fn my_string() -> *const c_char; }
/// # */ unsafe extern "C" fn my_string() -> *const c_char { c"hello".as_ptr() }
///
/// unsafe {
///     let slice = CStr::from_ptr(my_string());
///     println!("string buffer size without nul terminator: {}", slice.to_bytes().len());
/// }
/// ```
///
/// 传递源自 Rust 的 C 字符串：
///
/// ```
/// use std::ffi::CStr;
/// use std::os::raw::c_char;
///
/// fn work(data: &CStr) {
///     unsafe extern "C" fn work_with(s: *const c_char) {}
///     unsafe { work_with(data.as_ptr()) }
/// }
///
/// let s = c"Hello world!";
/// work(&s);
/// ```
///
/// Converting a foreign C string into a Rust `String`:
///
/// ```
/// use std::ffi::CStr;
/// use std::os::raw::c_char;
///
/// # /* Extern functions are awkward in doc comments - fake it instead
/// extern "C" { fn my_string() -> *const c_char; }
/// # */ unsafe extern "C" fn my_string() -> *const c_char { c"hello".as_ptr() }
///
/// fn my_string_safe() -> String {
///     let cstr = unsafe { CStr::from_ptr(my_string()) };
///     // Get a copy-on-write Cow<'_, str>, then extract the
///     // allocated String (or allocate a fresh one if needed).
///     cstr.to_string_lossy().into_owned()
/// }
///
/// println!("string: {}", my_string_safe());
/// ```
///
/// [str]: prim@str "str"
#[derive(Hash)]
#[derive_const(PartialEq, Eq)]
#[stable(feature = "core_c_str", since = "1.64.0")]
#[rustc_diagnostic_item = "cstr_type"]
#[rustc_has_incoherent_inherent_impls]
#[lang = "CStr"]
// `fn from` in `impl From<&CStr> for Box<CStr>` current implementation relies
// on `CStr` being layout-compatible with `[u8]`.
// However, `CStr` layout is considered an implementation detail and must not be relied upon. We
// want `repr(transparent)` but we don't want it to show up in rustdoc, so we hide it under
// `cfg(doc)`. This is an ad-hoc implementation of attribute privacy.
#[repr(transparent)]
pub struct CStr {
    // FIXME: this should not be represented with a DST slice but rather with
    //        just a raw `c_char` along with some form of marker to make
    //        this an unsized type. Essentially `sizeof(&CStr)` should be the
    //        same as `sizeof(&c_char)` but `CStr` should be an unsized type.
    inner: [c_char],
}

/// 表示未在预期位置找到空字节的错误。
///
/// The slice used to create a [`CStr`] must have one and only one nul byte,
/// 位于末尾。
///
/// This error is created by the [`CStr::from_bytes_with_nul`] method.
/// 详情请参阅其文档。
///
/// # 示例
///
/// ```
/// use std::ffi::{CStr, FromBytesWithNulError};
///
/// let _: FromBytesWithNulError = CStr::from_bytes_with_nul(b"f\0oo").unwrap_err();
/// ```
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[stable(feature = "core_c_str", since = "1.64.0")]
pub enum FromBytesWithNulError {
    /// Data provided contains an interior nul byte at byte `position`.
    InteriorNul {
        /// 内部空字节的位置。
        position: usize,
    },
    /// 提供的数据不是空终止的。
    NotNulTerminated,
}

#[stable(feature = "frombyteswithnulerror_impls", since = "1.17.0")]
impl fmt::Display for FromBytesWithNulError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InteriorNul { position } => {
                write!(f, "data provided contains an interior nul byte at byte position {position}")
            }
            Self::NotNulTerminated => write!(f, "data provided is not nul terminated"),
        }
    }
}

#[stable(feature = "frombyteswithnulerror_impls", since = "1.17.0")]
impl Error for FromBytesWithNulError {}

/// 表示没有空字节存在的错误。
///
/// A slice used to create a [`CStr`] must contain a nul byte somewhere
/// within the slice.
///
/// This error is created by the [`CStr::from_bytes_until_nul`] method.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[stable(feature = "cstr_from_bytes_until_nul", since = "1.69.0")]
pub struct FromBytesUntilNulError(());

#[stable(feature = "cstr_from_bytes_until_nul", since = "1.69.0")]
impl fmt::Display for FromBytesUntilNulError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "data provided does not contain a nul")
    }
}

/// 以十六进制转义序列呈现。
/// 将原始 C 字符串包裹在一个安全的 C 字符串包装器中。
#[stable(feature = "cstr_debug", since = "1.3.0")]
impl fmt::Debug for CStr {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        fmt::Debug::fmt(crate::byte_str::ByteStr::from_bytes(self.to_bytes()), f)
    }
}

#[stable(feature = "cstr_default", since = "1.10.0")]
#[rustc_const_unstable(feature = "const_default", issue = "143894")]
const impl Default for &CStr {
    #[inline]
    fn default() -> Self {
        c""
    }
}

impl CStr {
    /// 将原始 C 字符串包裹在一个安全的 C 字符串包装器中。
    ///
    /// This function will wrap the provided `ptr` with a `CStr` wrapper, which
    /// 允许对非拥有权 C 字符串进行检查和交互操作。终止缓冲区的总
    /// size of the terminated buffer must be smaller than [`isize::MAX`] **bytes**
    /// in memory (a restriction from [`slice::from_raw_parts`]).
    ///
    /// # 安全性
    ///
    /// * The memory pointed to by `ptr` must contain a valid nul terminator at the
    /// 在字符串的末尾。
    ///
    /// * `ptr` must be [valid] for reads of bytes up to and including the nul terminator.
    /// 特别是意味着：
    ///
    ///     * The entire memory range of this `CStr` must be contained within a single allocation!
    ///     * `ptr` must be non-null even for a zero-length cstr.
    ///
    /// * The memory referenced by the returned `CStr` must not be mutated for
    ///   the duration of lifetime `'a`.
    ///
    /// * The nul terminator must be within `isize::MAX` from `ptr`
    ///
    /// > **注意**：此操作旨在实现零成本转换，但目前
    /// > 是通过预先计算字符串的长度来实现的。这并不保证总是如此。
    /// > 这种情况。
    ///
    /// # 注意事项
    ///
    /// 返回切片的生命周期是从其使用情况推断出来的。为了避免意外误用，
    /// 建议将生命周期与上下文中的安全源生命周期绑定，例如通过提供接受切片宿主值生命周期的辅助函数，
    /// 或通过显式注释来实现。
    /// or by explicit annotation.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::ffi::{c_char, CStr};
    ///
    /// fn my_string() -> *const c_char {
    ///     c"hello".as_ptr()
    /// }
    ///
    /// unsafe {
    ///     let slice = CStr::from_ptr(my_string());
    ///     assert_eq!(slice.to_str().unwrap(), "hello");
    /// }
    /// ```
    ///
    /// ```
    /// use std::ffi::{c_char, CStr};
    ///
    /// const HELLO_PTR: *const c_char = {
    ///     const BYTES: &[u8] = b"Hello, world!\0";
    ///     BYTES.as_ptr().cast()
    /// };
    /// const HELLO: &CStr = unsafe { CStr::from_ptr(HELLO_PTR) };
    ///
    /// assert_eq!(c"Hello, world!", HELLO);
    /// ```
    ///
    /// [valid]: core::ptr#safety
    #[inline] // inline is necessary for codegen to see strlen.
    #[must_use]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_cstr_from_ptr", since = "1.81.0")]
    pub const unsafe fn from_ptr<'a>(ptr: *const c_char) -> &'a CStr {
        // SAFETY: The caller has provided a pointer that points to a valid C
        // string with a NUL terminator less than `isize::MAX` from `ptr`.
        let len = unsafe { strlen(ptr) };

        // SAFETY: The caller has provided a valid pointer with length less than
        // `isize::MAX`, so `from_raw_parts` is safe. The content remains valid
        // and doesn't change for the lifetime of the returned `CStr`. This
        // means the call to `from_bytes_with_nul_unchecked` is correct.
        //
        // The cast from c_char to u8 is ok because a c_char is always one byte.
        unsafe {
            Self::from_bytes_with_nul_unchecked(slice::from_raw_parts(
                ptr.cast(),
                len.as_inner() + 1,
            ))
        }
    }

    /// 从包含任意数量空字节的字节切片创建 C 字符串包装器。
    ///
    /// This method will create a `CStr` from any byte slice that contains at
    /// least one nul byte. Unlike with [`CStr::from_bytes_with_nul`], the caller
    /// 调用者无需知道空字节的位置。
    ///
    /// 如果第一个字节是空字符，此方法将返回
    /// empty `CStr`. If multiple nul characters are present, the `CStr` will
    /// 在第一个空字符处结束。
    ///
    /// 如果切片仅在末尾有一个空字节，此方法与
    /// equivalent to [`CStr::from_bytes_with_nul`].
    ///
    /// # 示例
    /// ```
    /// use std::ffi::CStr;
    ///
    /// let mut buffer = [0u8; 16];
    /// unsafe {
    ///     // Here we might call an unsafe C function that writes a string
    ///     // into the buffer.
    ///     let buf_ptr = buffer.as_mut_ptr();
    ///     buf_ptr.write_bytes(b'A', 8);
    /// }
    /// // Attempt to extract a C nul-terminated string from the buffer.
    /// let c_str = CStr::from_bytes_until_nul(&buffer[..]).unwrap();
    /// assert_eq!(c_str.to_str().unwrap(), "AAAAAAAA");
    /// ```
    ///
    #[stable(feature = "cstr_from_bytes_until_nul", since = "1.69.0")]
    #[rustc_const_stable(feature = "cstr_from_bytes_until_nul", since = "1.69.0")]
    pub const fn from_bytes_until_nul(bytes: &[u8]) -> Result<&CStr, FromBytesUntilNulError> {
        let nul_pos = memchr::memchr(0, bytes);
        match nul_pos {
            Some(nul_pos) => {
                // FIXME(const-hack) replace with range index
                // SAFETY: nul_pos + 1 <= bytes.len()
                let subslice = unsafe { crate::slice::from_raw_parts(bytes.as_ptr(), nul_pos + 1) };
                // SAFETY: We know there is a nul byte at nul_pos, so this slice
                // (ending at the nul byte) is a well-formed C string.
                Ok(unsafe { CStr::from_bytes_with_nul_unchecked(subslice) })
            }
            None => Err(FromBytesUntilNulError(())),
        }
    }

    /// 从恰好包含一个空终止符的字节切片创建 C 字符串包装器。
    /// 终止符。
    ///
    /// This function will cast the provided `bytes` to a `CStr`
    /// wrapper after ensuring that the byte slice is nul-terminated
    /// # 示例
    ///
    /// If the nul byte may not be at the end,
    /// [`CStr::from_bytes_until_nul`] can be used instead.
    ///
    /// # Examples
    ///
    /// ```
    /// use std::ffi::CStr;
    ///
    /// let cstr = CStr::from_bytes_with_nul(b"hello\0");
    /// assert_eq!(cstr, Ok(c"hello"));
    /// ```
    ///
    /// Creating a `CStr` without a trailing nul terminator is an error:
    ///
    /// ```
    /// use std::ffi::{CStr, FromBytesWithNulError};
    ///
    /// let cstr = CStr::from_bytes_with_nul(b"hello");
    /// assert_eq!(cstr, Err(FromBytesWithNulError::NotNulTerminated));
    /// ```
    ///
    /// Creating a `CStr` with an interior nul byte is an error:
    ///
    /// ```
    /// use std::ffi::{CStr, FromBytesWithNulError};
    ///
    /// let cstr = CStr::from_bytes_with_nul(b"he\0llo\0");
    /// assert_eq!(cstr, Err(FromBytesWithNulError::InteriorNul { position: 2 }));
    /// ```
    #[stable(feature = "cstr_from_bytes", since = "1.10.0")]
    #[rustc_const_stable(feature = "const_cstr_methods", since = "1.72.0")]
    pub const fn from_bytes_with_nul(bytes: &[u8]) -> Result<&Self, FromBytesWithNulError> {
        let nul_pos = memchr::memchr(0, bytes);
        match nul_pos {
            Some(nul_pos) if nul_pos + 1 == bytes.len() => {
                // SAFETY: We know there is only one nul byte, at the end
                // of the byte slice.
                Ok(unsafe { Self::from_bytes_with_nul_unchecked(bytes) })
            }
            Some(position) => Err(FromBytesWithNulError::InteriorNul { position }),
            None => Err(FromBytesWithNulError::NotNulTerminated),
        }
    }

    /// Unsafely creates a C string wrapper from a byte slice.
    ///
    /// This function will cast the provided `bytes` to a `CStr` wrapper without
    /// 提供的切片 **必须** 为空终止且不包含任何内部
    ///
    /// # 空字节。
    /// # 示例
    /// 返回此 C 字符串的内部指针。
    ///
    /// # Examples
    ///
    /// ```
    /// use std::ffi::CStr;
    ///
    /// let bytes = b"Hello world!\0";
    ///
    /// let cstr = unsafe { CStr::from_bytes_with_nul_unchecked(bytes) };
    /// assert_eq!(cstr.to_bytes_with_nul(), bytes);
    /// ```
    #[inline]
    #[must_use]
    #[stable(feature = "cstr_from_bytes", since = "1.10.0")]
    #[rustc_const_stable(feature = "const_cstr_unchecked", since = "1.59.0")]
    #[rustc_allow_const_fn_unstable(const_eval_select)]
    pub const unsafe fn from_bytes_with_nul_unchecked(bytes: &[u8]) -> &CStr {
        const_eval_select!(
            @capture { bytes: &[u8] } -> &CStr:
            if const {
                // Saturating so that an empty slice panics in the assert with a good
                // message, not here due to underflow.
                let mut i = bytes.len().saturating_sub(1);
                assert!(!bytes.is_empty() && bytes[i] == 0, "input was not nul-terminated");

                // Ending nul byte exists, skip to the rest.
                while i != 0 {
                    i -= 1;
                    let byte = bytes[i];
                    assert!(byte != 0, "input contained interior nul");
                }

                // SAFETY: See runtime cast comment below.
                unsafe { &*(bytes as *const [u8] as *const CStr) }
            } else {
                // Chance at catching some UB at runtime with debug builds.
                debug_assert!(!bytes.is_empty() && bytes[bytes.len() - 1] == 0);

                // SAFETY: Casting to CStr is safe because its internal representation
                // is a [u8] too (safe only inside std).
                // Dereferencing the obtained pointer is safe because it comes from a
                // reference. Making a reference is then safe because its lifetime
                // is bound by the lifetime of the given `bytes`.
                unsafe { &*(bytes as *const [u8] as *const CStr) }
            }
        )
    }

    /// 以 0 字节结束的连续内存区域。
    ///
    /// The returned pointer will be valid for as long as `self` is, and points
    /// to a contiguous region of memory terminated with a 0 byte to represent
    /// 字符串的结尾。
    ///
    /// 返回指针的类型为
    /// [`*const c_char`][crate::ffi::c_char], and whether it's
    /// an alias for `*const i8` or `*const u8` is platform-specific.
    ///
    /// **警告**
    ///
    /// 返回的指针是只读的；对其写入（包括将其
    /// 传递给写入它的 C 代码）会导致未定义行为。
    ///
    /// 您有责任确保底层内存不会
    /// freed too early. For example, the following code will cause undefined
    /// behavior when `ptr` is used inside the `unsafe` block:
    ///
    /// ```no_run
    /// # #![expect(dangling_pointers_from_temporaries)]
    /// use std::ffi::{CStr, CString};
    ///
    /// // 💀 The meaning of this entire program is undefined,
    /// // 💀 and nothing about its behavior is guaranteed,
    /// // 💀 not even that its behavior resembles the code as written,
    /// // 💀 just because it contains a single instance of undefined behavior!
    ///
    /// // 🚨 creates a dangling pointer to a temporary `CString`
    /// // 🚨 that is deallocated at the end of the statement
    /// let ptr = CString::new("Hi!".to_uppercase()).unwrap().as_ptr();
    ///
    /// // without undefined behavior, you would expect that `ptr` equals:
    /// dbg!(CStr::from_bytes_with_nul(b"HI!\0").unwrap());
    ///
    /// // 🙏 Possibly the program behaved as expected so far,
    /// // 🙏 and this just shows `ptr` is now garbage..., but
    /// // 💀 this violates `CStr::from_ptr`'s safety contract
    /// // 💀 leading to a dereference of a dangling pointer,
    /// // 💀 which is immediate undefined behavior.
    /// // 💀 *BOOM*, you're dead, your entire program has no meaning.
    /// dbg!(unsafe { CStr::from_ptr(ptr) });
    /// ```
    ///
    /// This happens because, the pointer returned by `as_ptr` does not carry any
    /// lifetime information, and the `CString` is deallocated immediately after
    /// the expression that it is part of has been evaluated.
    /// To fix the problem, bind the `CString` to a local variable:
    ///
    /// ```
    /// use std::ffi::{CStr, CString};
    ///
    /// let c_str = CString::new("Hi!".to_uppercase()).unwrap();
    /// let ptr = c_str.as_ptr();
    ///
    /// assert_eq!(unsafe { CStr::from_ptr(ptr) }, c"HI!");
    /// ```
    #[inline]
    #[must_use]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_str_as_ptr", since = "1.32.0")]
    #[lint::as_ptr]
    #[lint::never_returns_null_ptr]
    pub const fn as_ptr(&self) -> *const c_char {
        self.inner.as_ptr()
    }

    /// We could eventually expose this publicly, if we wanted.
    #[inline]
    #[must_use]
    const fn as_non_null_ptr(&self) -> NonNull<c_char> {
        // FIXME(const_trait_impl) replace with `NonNull::from`
        // SAFETY: a reference is never null
        unsafe { NonNull::new_unchecked(&self.inner as *const [c_char] as *mut [c_char]) }
            .as_non_null_ptr()
    }

    /// Returns the length of `self`. Like C's `strlen`, this does not include the nul terminator.
    ///
    /// > 转换，但计划将来修改其定义以
    /// > 在调用时执行长度计算。
    /// > 转换。
    ///
    /// # 示例
    ///
    /// ```
    /// assert_eq!(c"foo".count_bytes(), 3);
    /// assert_eq!(c"".count_bytes(), 0);
    /// ```
    #[inline]
    #[must_use]
    #[doc(alias("len", "strlen"))]
    #[stable(feature = "cstr_count_bytes", since = "1.79.0")]
    #[rustc_const_stable(feature = "const_cstr_from_ptr", since = "1.81.0")]
    pub const fn count_bytes(&self) -> usize {
        // SAFETY: This length includes the nul-terminator, so it's at least one.
        unsafe { self.inner.len().unchecked_sub(1) }
    }

    /// Returns `true` if `self.to_bytes()` has a length of 0.
    ///
    /// # 示例
    ///
    /// ```
    /// assert!(!c"foo".is_empty());
    /// assert!(c"".is_empty());
    /// ```
    #[inline]
    #[stable(feature = "cstr_is_empty", since = "1.71.0")]
    #[rustc_const_stable(feature = "cstr_is_empty", since = "1.71.0")]
    pub const fn is_empty(&self) -> bool {
        // SAFETY: We know there is at least one byte; for empty strings it
        // is the NUL terminator.
        // FIXME(const-hack): use get_unchecked
        unsafe { *self.inner.as_ptr() == 0 }
    }

    /// 将此 C 字符串转换为字节切片。
    ///
    /// 返回的切片**不会**包含该 C 字符串的尾随空终止符。
    /// 字符串具有的。
    ///
    /// > **注意**：目前该方法实现为常数时间
    /// > 转换，但计划将来修改其定义以
    /// 在调用时执行长度计算。
    ///
    /// # 示例
    ///
    /// ```
    /// assert_eq!(c"foo".to_bytes(), b"foo");
    /// ```
    #[inline]
    #[must_use = "this returns the result of the operation, \
                  without modifying the original"]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_cstr_methods", since = "1.72.0")]
    pub const fn to_bytes(&self) -> &[u8] {
        let bytes = self.to_bytes_with_nul();
        // FIXME(const-hack) replace with range index
        // SAFETY: to_bytes_with_nul returns slice with length at least 1
        unsafe { slice::from_raw_parts(bytes.as_ptr(), bytes.len() - 1) }
    }

    /// 将此 C 字符串转换为包含尾随 0 字节的字节切片。
    ///
    /// This function is the equivalent of [`CStr::to_bytes`] except that it
    /// 会保留尾随空终止符，而不是将其删除。
    ///
    /// > **注意**：目前该方法实现为零成本转换，但
    /// 计划将来修改其定义以执行
    /// 在调用时执行长度计算。
    ///
    /// # 示例
    ///
    /// ```
    /// assert_eq!(c"foo".to_bytes_with_nul(), b"foo\0");
    /// ```
    #[inline]
    #[must_use = "this returns the result of the operation, \
                  without modifying the original"]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_cstr_methods", since = "1.72.0")]
    pub const fn to_bytes_with_nul(&self) -> &[u8] {
        // SAFETY: Transmuting a slice of `c_char`s to a slice of `u8`s
        // is safe on all supported targets.
        let bytes = unsafe { &*((&raw const self.inner) as *const [u8]) };

        // SAFETY: A valid `CStr` always contains at least its trailing nul byte.
        unsafe { crate::hint::assert_unchecked(!bytes.is_empty()) };

        bytes
    }

    /// 遍历此 C 字符串中的字节。
    ///
    /// 返回的迭代器**不会**包含该 C 字符串的尾随空终止符
    /// 该字符串具有的。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(cstr_bytes)]
    ///
    /// assert!(c"foo".bytes().eq(*b"foo"));
    /// ```
    #[inline]
    #[unstable(feature = "cstr_bytes", issue = "112115")]
    pub fn bytes(&self) -> Bytes<'_> {
        Bytes::new(self)
    }

    /// Yields a <code>&[str]</code> slice if the `CStr` contains valid UTF-8.
    ///
    /// If the contents of the `CStr` are valid UTF-8 data, this
    /// function will return the corresponding <code>&[str]</code> slice. Otherwise,
    /// 它将返回一个包含 UTF-8 验证失败位置的详细信息的错误。
    ///
    /// [str]: prim@str "str"
    ///
    /// # 示例
    ///
    /// ```
    /// assert_eq!(c"foo".to_str(), Ok("foo"));
    /// ```
    #[stable(feature = "cstr_to_str", since = "1.4.0")]
    #[rustc_const_stable(feature = "const_cstr_methods", since = "1.72.0")]
    pub const fn to_str(&self) -> Result<&str, str::Utf8Error> {
        // N.B., when `CStr` is changed to perform the length check in `.to_bytes()`
        // instead of in `from_ptr()`, it may be worth considering if this should
        // be rewritten to do the UTF-8 check inline with the length calculation
        // instead of doing it afterwards.
        str::from_utf8(self.to_bytes())
    }

    /// Returns an object that implements [`Display`] for safely printing a [`CStr`] that may
    /// contain non-Unicode data.
    ///
    /// Behaves as if `self` were first lossily converted to a `str`, with invalid UTF-8 presented
    /// 作为 Unicode 替换字符：�。
    ///
    /// [`Display`]: fmt::Display
    ///
    /// # 示例
    ///
    /// ```
    /// let cstr = c"Hello, world!";
    /// println!("{}", cstr.display());
    /// ```
    #[stable(feature = "cstr_display", since = "1.101.0")]
    #[must_use = "this does not display the `CStr`; \
                  it returns an object that can be displayed"]
    #[inline]
    pub fn display(&self) -> Display<'_> {
        Display { c_str: self }
    }

    /// Returns the same string as a string slice `&CStr`.
    ///
    /// This method is redundant when used directly on `&CStr`, but
    /// 它有助于将其他类似字符串的类型解引用为字符串切片。
    /// for example references to `Box<CStr>` or `Arc<CStr>`.
    #[inline]
    #[unstable(feature = "str_as_str", issue = "130366")]
    pub const fn as_c_str(&self) -> &CStr {
        self
    }
}

#[stable(feature = "c_string_eq_c_str", since = "1.90.0")]
impl PartialEq<&Self> for CStr {
    #[inline]
    fn eq(&self, other: &&Self) -> bool {
        *self == **other
    }

    #[inline]
    fn ne(&self, other: &&Self) -> bool {
        *self != **other
    }
}

// `.to_bytes()` representations are compared instead of the inner `[c_char]`s,
// because `c_char` is `i8` (not `u8`) on some platforms.
// That is why this is implemented manually and not derived.
#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_const_unstable(feature = "const_cmp", issue = "143800")]
const impl PartialOrd for CStr {
    #[inline]
    fn partial_cmp(&self, other: &CStr) -> Option<Ordering> {
        self.to_bytes().partial_cmp(other.to_bytes())
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_const_unstable(feature = "const_cmp", issue = "143800")]
const impl Ord for CStr {
    #[inline]
    fn cmp(&self, other: &CStr) -> Ordering {
        self.to_bytes().cmp(other.to_bytes())
    }
}

#[stable(feature = "cstr_range_from", since = "1.47.0")]
impl ops::Index<ops::RangeFrom<usize>> for CStr {
    type Output = CStr;

    #[inline]
    fn index(&self, index: ops::RangeFrom<usize>) -> &CStr {
        let bytes = self.to_bytes_with_nul();
        // we need to manually check the starting index to account for the null
        // byte, since otherwise we could get an empty string that doesn't end
        // in a null.
        if index.start < bytes.len() {
            // SAFETY: Non-empty tail of a valid `CStr` is still a valid `CStr`.
            unsafe { CStr::from_bytes_with_nul_unchecked(&bytes[index.start..]) }
        } else {
            panic!(
                "index out of bounds: the len is {} but the index is {}",
                bytes.len(),
                index.start
            );
        }
    }
}

#[stable(feature = "new_range_from_api", since = "1.96.0")]
impl ops::Index<range::RangeFrom<usize>> for CStr {
    type Output = CStr;

    #[inline]
    fn index(&self, index: range::RangeFrom<usize>) -> &CStr {
        ops::Index::index(self, ops::RangeFrom::from(index))
    }
}

#[stable(feature = "cstring_asref", since = "1.7.0")]
#[rustc_const_unstable(feature = "const_convert", issue = "143773")]
const impl AsRef<CStr> for CStr {
    #[inline]
    fn as_ref(&self) -> &CStr {
        self
    }
}

/// Calculate the length of a nul-terminated string. Defers to C's `strlen` when possible.
///
/// # 安全性
///
/// 指针必须指向包含 NUL 终止符的有效缓冲区。NUL 必须位于
/// located within `isize::MAX` from `ptr`.
#[inline]
#[unstable(feature = "cstr_internals", issue = "none")]
#[rustc_allow_const_fn_unstable(const_eval_select)]
const unsafe fn strlen(ptr: *const c_char) -> UsizeNoHighBitMinusOne {
    const_eval_select!(
        @capture { s: *const c_char = ptr } -> UsizeNoHighBitMinusOne:
        if const {
            let mut len = 0;

            // SAFETY: Outer caller has provided a pointer to a valid C string.
            while unsafe { *s.add(len) } != 0 {
                len += 1;
            }

            UsizeNoHighBitMinusOne::new(len).unwrap()
        } else {
            unsafe extern "C" {
                /// 由 libc 或 compiler_builtins 提供。
                fn strlen(s: *const c_char) -> usize;
            }

            // SAFETY: Outer caller has provided a pointer to a valid C string,
            // and its length is within bounds.
            unsafe { UsizeNoHighBitMinusOne::new_unchecked(strlen(s)) }
        }
    )
}

/// An iterator over the bytes of a [`CStr`], without the nul terminator.
///
/// This struct is created by the [`bytes`] method on [`CStr`].
/// 更多详情请参阅其文档。
///
/// [`bytes`]: CStr::bytes
#[must_use = "iterators are lazy and do nothing unless consumed"]
#[unstable(feature = "cstr_bytes", issue = "112115")]
#[derive(Clone, Debug)]
pub struct Bytes<'a> {
    // since we know the string is nul-terminated, we only need one pointer
    ptr: NonNull<u8>,
    phantom: PhantomData<&'a [c_char]>,
}

#[unstable(feature = "cstr_bytes", issue = "112115")]
unsafe impl Send for Bytes<'_> {}

#[unstable(feature = "cstr_bytes", issue = "112115")]
unsafe impl Sync for Bytes<'_> {}

impl<'a> Bytes<'a> {
    #[inline]
    fn new(s: &'a CStr) -> Self {
        Self { ptr: s.as_non_null_ptr().cast(), phantom: PhantomData }
    }

    #[inline]
    fn is_empty(&self) -> bool {
        // SAFETY: We uphold that the pointer is always valid to dereference
        // by starting with a valid C string and then never incrementing beyond
        // the nul terminator.
        unsafe { self.ptr.read() == 0 }
    }
}

#[unstable(feature = "cstr_bytes", issue = "112115")]
impl Iterator for Bytes<'_> {
    type Item = u8;

    #[inline]
    fn next(&mut self) -> Option<u8> {
        // SAFETY: We only choose a pointer from a valid C string, which must
        // be non-null and contain at least one value. Since we always stop at
        // the nul terminator, which is guaranteed to exist, we can assume that
        // the pointer is non-null and valid. This lets us safely dereference
        // it and assume that adding 1 will create a new, non-null, valid
        // pointer.
        unsafe {
            let ret = self.ptr.read();
            if ret == 0 {
                None
            } else {
                self.ptr = self.ptr.add(1);
                Some(ret)
            }
        }
    }

    #[inline]
    fn size_hint(&self) -> (usize, Option<usize>) {
        if self.is_empty() { (0, Some(0)) } else { (1, None) }
    }

    #[inline]
    fn count(self) -> usize {
        // SAFETY: We always hold a valid pointer to a C string
        unsafe { strlen(self.ptr.as_ptr().cast()) }.as_inner()
    }
}

#[unstable(feature = "cstr_bytes", issue = "112115")]
impl FusedIterator for Bytes<'_> {}

/// Helper struct for safely printing a [`CStr`] with [`format!`] and `{}`.
///
/// A [`CStr`] might contain non-Unicode data. This `struct` implements the
/// [`Display`] trait in a way that mitigates that. It is created by the
/// [`display`](CStr::display) method on [`CStr`]. This may perform lossy
/// conversion, depending on the platform. If you would like an implementation
/// which escapes the [`CStr`] please use [`Debug`] instead.
///
/// # Examples
///
/// ```
/// let s = c"Hello, world!";
/// println!("{}", s.display());
/// ```
///
/// [`Display`]: fmt::Display
/// [`format!`]: ../../../std/macro.format.html
#[stable(feature = "cstr_display", since = "1.101.0")]
pub struct Display<'a> {
    c_str: &'a CStr,
}

#[stable(feature = "cstr_display", since = "1.101.0")]
impl fmt::Debug for Display<'_> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        fmt::Debug::fmt(&self.c_str, f)
    }
}

#[stable(feature = "cstr_display", since = "1.101.0")]
impl fmt::Display for Display<'_> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        fmt::Display::fmt(crate::byte_str::ByteStr::from_bytes(self.c_str.to_bytes()), f)
    }
}
