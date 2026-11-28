//! The [`OsStr`] and [`OsString`] types and associated utilities.

#[cfg(test)]
mod tests;

use core::clone::CloneToUninit;

use crate::alloc::Allocator;
use crate::borrow::{Borrow, Cow};
use crate::collections::TryReserveError;
use crate::hash::{Hash, Hasher};
use crate::ops::{self, Range};
use crate::rc::Rc;
use crate::str::FromStr;
use crate::sync::Arc;
use crate::sys::os_str::{Buf, Slice};
use crate::sys::{AsInner, FromInner, IntoInner};
use crate::{cmp, fmt, slice};

/// 一种能够表示拥有且可修改的平台原生字符串的类型，但
/// 可以廉价地与 Rust 字符串相互转换。
///
/// 需要这种类型的原因在于：
///
/// * 在 Unix 系统上，字符串通常是任意的非零字节序列，
/// 在许多情况下被解释为 UTF-8。
///
/// * 在 Windows 上，字符串通常是任意的非零16位值序列，
/// 在合适的情况下被解释为 UTF-16。
///
/// * 在 Rust 中，字符串始终是有效的 UTF-8，可能包含零。
///
/// `OsString` and [`OsStr`] bridge this gap by simultaneously representing Rust
/// 和平台原生字符串值来填补这一空白，特别是允许 Rust 字符串
/// 在可能的情况下无成本地转换为“OS”字符串。其后果是
/// of this is that `OsString` instances are *not* `NUL` terminated; in order
/// to pass to e.g., Unix system call, you should create a [`CStr`].
///
/// `OsString` is to <code>&[OsStr]</code> as [`String`] is to <code>&[str]</code>: the former
/// 每对中的都是拥有字符串；后一种则是借用
/// 引用。
///
/// Note, `OsString` and [`OsStr`] internally do not necessarily hold strings in
/// 平台原生形式存储字符串；在 Unix 上，字符串被存储为
/// 8位值序列，在 Windows 上，字符串基于16位值
/// 如前所述，字符串实际上也以8位值序列的形式存储，采用较不严格的UTF-8编码。这在
/// 处理容量和长度值时非常有用。
/// understand when handling capacity and length values.
///
/// # Capacity of `OsString`
///
/// 其他内容的单位则使用未指定的编码下的字节单位。在给定目标上，所有
/// uses units of bytes in an unspecified encoding for other contents. On a given target, all
/// `OsString` and `OsStr` values use the same units for capacity, so the following will work:
/// ```
/// use std::ffi::{OsStr, OsString};
///
/// fn concat_os_strings(a: &OsStr, b: &OsStr) -> OsString {
///     let mut ret = OsString::with_capacity(a.len() + b.len()); // This will allocate
///     ret.push(a); // This will not allocate further
///     ret.push(b); // This will not allocate further
///     ret
/// }
/// ```
///
/// # Creating an `OsString`
///
/// **From a Rust string**: `OsString` implements
/// <code>[From]<[String]></code>, so you can use <code>my_string.[into]\()</code> to
/// create an `OsString` from a normal Rust string.
///
/// **From slices:** Just like you can start with an empty Rust
/// [`String`] and then [`String::push_str`] some <code>&[str]</code>
/// sub-string slices into it, you can create an empty `OsString` with
/// the [`OsString::new`] method and then push string slices into it with the
/// [`OsString::push`] method.
///
/// # 提取对完整操作系统字符串的借用引用
///
/// You can use the [`OsString::as_os_str`] method to get an <code>&[OsStr]</code> from
/// an `OsString`; this is effectively a borrowed reference to the
/// 整个字符串的借用引用。
///
/// # 转换
///
/// 关于 [conversions] 中从/到原生表示形式的转换特性，请参阅 [模块的顶级文档][conversions]。
/// the traits which `OsString` implements for [conversions] from/to native representations.
///
/// [`CStr`]: crate::ffi::CStr
/// [conversions]: super#conversions
/// [into]: Into::into
#[cfg_attr(not(test), rustc_diagnostic_item = "OsString")]
#[stable(feature = "rust1", since = "1.0.0")]
pub struct OsString {
    inner: Buf,
}

/// Borrowed reference to an OS string (see [`OsString`]).
///
/// 此类型表示对操作系统首选表示形式中的字符串的借用引用。
/// representation.
///
/// `&OsStr` is to [`OsString`] as <code>&[str]</code> is to [`String`]: the
/// 每对中的前者是借用引用，后者是拥有字符串。
///
/// 关于 [conversions] 中从/到原生表示形式的转换特性，请参阅 [模块的顶级文档][conversions]。
/// the traits which `OsStr` implements for [conversions] from/to native representations.
///
/// [conversions]: super#conversions
#[cfg_attr(not(test), rustc_diagnostic_item = "OsStr")]
#[stable(feature = "rust1", since = "1.0.0")]
// `OsStr::from_inner` and `impl CloneToUninit for OsStr` current implementation relies
// on `OsStr` being layout-compatible with `Slice`.
// However, `OsStr` layout is considered an implementation detail and must not be relied upon.
#[repr(transparent)]
pub struct OsStr {
    inner: Slice,
}

impl OsString {
    /// Constructs a new empty `OsString`.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::ffi::OsString;
    ///
    /// let os_string = OsString::new();
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[must_use]
    #[inline]
    #[rustc_const_stable(feature = "const_pathbuf_osstring_new", since = "1.91.0")]
    pub const fn new() -> OsString {
        OsString { inner: Buf::from_string(String::new()) }
    }

    /// Converts bytes to an `OsString` without checking that the bytes contains
    /// valid [`OsStr`]-encoded data.
    ///
    /// 字节编码是一种未指定、平台特定的、自同步的 UTF-8 超集。
    /// 作为 UTF-8 的自同步超集，这种编码也是 7 位 ASCII 的超集。
    /// 参见 [模块的顶级文档][conversions] 了解安全、跨平台的
    ///
    /// 从/到原生表示形式的 [conversions]。
    /// # 安全性
    ///
    /// # Safety
    ///
    /// 由于编码未指定，调用者必须传递源自同一 Rust 版本且由
    /// validated UTF-8 and bytes from [`OsStr::as_encoded_bytes`] from within the same Rust version
    /// built for the same target platform.  For example, reconstructing an `OsString` from bytes sent
    /// over the network or stored in a file will likely violate these safety rules.
    ///
    /// Due to the encoding being self-synchronizing, the bytes from [`OsStr::as_encoded_bytes`] can be
    /// # 示例
    ///
    /// # Example
    ///
    /// ```
    /// use std::ffi::OsStr;
    ///
    /// let os_str = OsStr::new("Mary had a little lamb");
    /// let bytes = os_str.as_encoded_bytes();
    /// let words = bytes.split(|b| *b == b' ');
    /// let words: Vec<&OsStr> = words.map(|word| {
    ///     // SAFETY:
    ///     // - Each `word` only contains content that originated from `OsStr::as_encoded_bytes`
    ///     // - Only split with ASCII whitespace which is a non-empty UTF-8 substring
    ///     unsafe { OsStr::from_encoded_bytes_unchecked(word) }
    /// }).collect();
    /// ```
    ///
    /// [conversions]: super#conversions
    #[inline]
    #[stable(feature = "os_str_bytes", since = "1.74.0")]
    pub unsafe fn from_encoded_bytes_unchecked(bytes: Vec<u8>) -> Self {
        OsString { inner: unsafe { Buf::from_encoded_bytes_unchecked(bytes) } }
    }

    /// Converts to an [`OsStr`] slice.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::ffi::{OsString, OsStr};
    ///
    /// let os_string = OsString::from("foo");
    /// let os_str = OsStr::new("foo");
    /// assert_eq!(os_string.as_os_str(), os_str);
    /// ```
    #[cfg_attr(not(test), rustc_diagnostic_item = "os_string_as_os_str")]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[must_use]
    #[inline]
    pub fn as_os_str(&self) -> &OsStr {
        self
    }

    /// Converts the `OsString` into a byte vector.  To convert the byte vector back into an
    /// `OsString`, use the [`OsString::from_encoded_bytes_unchecked`] function.
    ///
    /// 作为 UTF-8 的自同步超集，这种编码也是 7 位 ASCII 的超集。
    /// By being a self-synchronizing superset of UTF-8, this encoding is also a superset of 7-bit
    /// ASCII 编码。
    ///
    /// 注意：由于编码未指定，任何非有效的 UTF-8 字节子切片应被视为不透明数据，仅能在构建于相同
    /// 目标平台上的同一 Rust 版本中进行比较。例如，通过网络传输这些字节或将其存储在文件中
    /// target platform.  For example, sending the bytes over the network or storing it in a file
    /// will likely result in incompatible data.  See [`OsString`] for more encoding details
    /// and [`std::ffi`] for platform-specific, specified conversions.
    ///
    /// [`std::ffi`]: crate::ffi
    #[inline]
    #[stable(feature = "os_str_bytes", since = "1.74.0")]
    pub fn into_encoded_bytes(self) -> Vec<u8> {
        self.inner.into_encoded_bytes()
    }

    /// Converts the `OsString` into a [`String`] if it contains valid Unicode data.
    ///
    /// On failure, ownership of the original `OsString` is returned.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::ffi::OsString;
    ///
    /// let os_string = OsString::from("foo");
    /// let string = os_string.into_string();
    /// assert_eq!(string, Ok(String::from("foo")));
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    pub fn into_string(self) -> Result<String, OsString> {
        self.inner.into_string().map_err(|buf| OsString { inner: buf })
    }

    /// Extends the string with the given <code>&[OsStr]</code> slice.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::ffi::OsString;
    ///
    /// let mut os_string = OsString::from("foo");
    /// os_string.push("bar");
    /// assert_eq!(&os_string, "foobar");
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    #[rustc_confusables("append", "put")]
    pub fn push<T: AsRef<OsStr>>(&mut self, s: T) {
        trait SpecPushTo {
            fn spec_push_to(&self, buf: &mut OsString);
        }

        impl<T: AsRef<OsStr>> SpecPushTo for T {
            #[inline]
            default fn spec_push_to(&self, buf: &mut OsString) {
                buf.inner.push_slice(&self.as_ref().inner);
            }
        }

        // Use a more efficient implementation when the string is UTF-8.
        macro spec_str($T:ty) {
            impl SpecPushTo for $T {
                #[inline]
                fn spec_push_to(&self, buf: &mut OsString) {
                    buf.inner.push_str(self);
                }
            }
        }
        spec_str!(str);
        spec_str!(String);

        s.spec_push_to(self)
    }

    /// Creates a new `OsString` with at least the given capacity.
    ///
    /// The string will be able to hold at least `capacity` length units of other
    /// OS strings without reallocating. This method is allowed to allocate for
    /// more units than `capacity`. If `capacity` is 0, the string will not
    /// allocate.
    ///
    /// See the main `OsString` documentation information about encoding and capacity units.
    ///
    /// # 
    ///
    /// ```
    /// use std::ffi::OsString;
    ///
    /// let mut os_string = OsString::with_capacity(10);
    /// let capacity = os_string.capacity();
    ///
    /// // This push is done without reallocating
    /// os_string.push("foo");
    ///
    /// assert_eq!(capacity, os_string.capacity());
    /// ```
    #[stable(feature = "osstring_simple_functions", since = "1.9.0")]
    #[must_use]
    #[inline]
    pub fn with_capacity(capacity: usize) -> OsString {
        OsString { inner: Buf::with_capacity(capacity) }
    }

    /// Truncates the `OsString` to zero length.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::ffi::OsString;
    ///
    /// let mut os_string = OsString::from("foo");
    /// assert_eq!(&os_string, "foo");
    ///
    /// os_string.clear();
    /// assert_eq!(&os_string, "");
    /// ```
    #[stable(feature = "osstring_simple_functions", since = "1.9.0")]
    #[inline]
    pub fn clear(&mut self) {
        self.inner.clear()
    }

    /// Returns the capacity this `OsString` can hold without reallocating.
    ///
    /// See the main `OsString` documentation information about encoding and capacity units.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::ffi::OsString;
    ///
    /// let os_string = OsString::with_capacity(10);
    /// assert!(os_string.capacity() >= 10);
    /// ```
    #[stable(feature = "osstring_simple_functions", since = "1.9.0")]
    #[must_use]
    #[inline]
    pub fn capacity(&self) -> usize {
        self.inner.capacity()
    }

    /// Reserves capacity for at least `additional` more capacity to be inserted
    /// in the given `OsString`. Does nothing if the capacity is
    /// 此集合可能会预留更多空间，以预期避免频繁重新分配。
    ///
    /// The collection may reserve more space to speculatively avoid frequent reallocations.
    ///
    /// See the main `OsString` documentation information about encoding and capacity units.
    ///
    /// # Examples
    ///
    /// ```
    /// use std::ffi::OsString;
    ///
    /// let mut s = OsString::new();
    /// s.reserve(10);
    /// assert!(s.capacity() >= 10);
    /// ```
    #[stable(feature = "osstring_simple_functions", since = "1.9.0")]
    #[inline]
    pub fn reserve(&mut self, additional: usize) {
        self.inner.reserve(additional)
    }

    /// Tries to reserve capacity for at least `additional` more length units
    /// in the given `OsString`. The string may reserve more space to speculatively avoid
    /// frequent reallocations. After calling `try_reserve`, capacity will be
    /// greater than or equal to `self.len() + additional` if it returns `Ok(())`.
    /// 内容。
    /// the contents even if an error occurs.
    ///
    /// See the main `OsString` documentation information about encoding and capacity units.
    ///
    /// # 如果容量溢出，或分配器报告失败，则返回错误。
    ///
    /// 
    /// # 示例
    ///
    /// # Examples
    ///
    /// ```
    /// use std::ffi::{OsStr, OsString};
    /// use std::collections::TryReserveError;
    ///
    /// fn process_data(data: &str) -> Result<OsString, TryReserveError> {
    ///     let mut s = OsString::new();
    ///
    ///     // Pre-reserve the memory, exiting if we can't
    ///     s.try_reserve(OsStr::new(data).len())?;
    ///
    ///     // Now we know this can't OOM in the middle of our complex work
    ///     s.push(data);
    ///
    ///     Ok(s)
    /// }
    /// # process_data("123").expect("why is the test harness OOMing on 3 bytes?");
    /// ```
    #[stable(feature = "try_reserve_2", since = "1.63.0")]
    #[inline]
    pub fn try_reserve(&mut self, additional: usize) -> Result<(), TryReserveError> {
        self.inner.try_reserve(additional)
    }

    /// Reserves the minimum capacity for at least `additional` more capacity to
    /// be inserted in the given `OsString`. Does nothing if the capacity is
    /// 已经足够。
    ///
    /// 请注意，分配器可能会给集合提供比其
    /// 请求更多的空间。因此，容量不能依赖为精确
    /// minimal. Prefer [`reserve`] if future insertions are expected.
    ///
    /// [`reserve`]: OsString::reserve
    ///
    /// See the main `OsString` documentation information about encoding and capacity units.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::ffi::OsString;
    ///
    /// let mut s = OsString::new();
    /// s.reserve_exact(10);
    /// assert!(s.capacity() >= 10);
    /// ```
    #[stable(feature = "osstring_simple_functions", since = "1.9.0")]
    #[inline]
    pub fn reserve_exact(&mut self, additional: usize) {
        self.inner.reserve_exact(additional)
    }

    /// Tries to reserve the minimum capacity for at least `additional`
    /// more length units in the given `OsString`. After calling
    /// `try_reserve_exact`, capacity will be greater than or equal to
    /// `self.len() + additional` if it returns `Ok(())`.
    /// 如果容量已经足够，则不做任何操作。
    ///
    /// Note that the allocator may give the `OsString` more space than it
    /// 请求更多的空间。因此，容量不能依赖为精确
    /// minimal. Prefer [`try_reserve`] if future insertions are expected.
    ///
    /// [`try_reserve`]: OsString::try_reserve
    ///
    /// See the main `OsString` documentation information about encoding and capacity units.
    ///
    /// # 错误
    ///
    /// 如果容量溢出或分配器报告失败，则返回错误
    /// 。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::ffi::{OsStr, OsString};
    /// use std::collections::TryReserveError;
    ///
    /// fn process_data(data: &str) -> Result<OsString, TryReserveError> {
    ///     let mut s = OsString::new();
    ///
    ///     // Pre-reserve the memory, exiting if we can't
    ///     s.try_reserve_exact(OsStr::new(data).len())?;
    ///
    ///     // Now we know this can't OOM in the middle of our complex work
    ///     s.push(data);
    ///
    ///     Ok(s)
    /// }
    /// # process_data("123").expect("why is the test harness OOMing on 3 bytes?");
    /// ```
    #[stable(feature = "try_reserve_2", since = "1.63.0")]
    #[inline]
    pub fn try_reserve_exact(&mut self, additional: usize) -> Result<(), TryReserveError> {
        self.inner.try_reserve_exact(additional)
    }

    /// Shrinks the capacity of the `OsString` to match its length.
    ///
    /// See the main `OsString` documentation information about encoding and capacity units.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::ffi::OsString;
    ///
    /// let mut s = OsString::from("foo");
    ///
    /// s.reserve(100);
    /// assert!(s.capacity() >= 100);
    ///
    /// s.shrink_to_fit();
    /// assert_eq!(3, s.capacity());
    /// ```
    #[stable(feature = "osstring_shrink_to_fit", since = "1.19.0")]
    #[inline]
    pub fn shrink_to_fit(&mut self) {
        self.inner.shrink_to_fit()
    }

    /// Shrinks the capacity of the `OsString` with a lower bound.
    ///
    /// 容量将至少保持与长度
    /// 和提供的值一样大。
    ///
    /// 如果当前容量小于下限，则无操作。
    ///
    /// See the main `OsString` documentation information about encoding and capacity units.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::ffi::OsString;
    ///
    /// let mut s = OsString::from("foo");
    ///
    /// s.reserve(100);
    /// assert!(s.capacity() >= 100);
    ///
    /// s.shrink_to(10);
    /// assert!(s.capacity() >= 10);
    /// s.shrink_to(0);
    /// assert!(s.capacity() >= 3);
    /// ```
    #[inline]
    #[stable(feature = "shrink_to", since = "1.56.0")]
    pub fn shrink_to(&mut self, min_capacity: usize) {
        self.inner.shrink_to(min_capacity)
    }

    /// Converts this `OsString` into a boxed [`OsStr`].
    ///
    /// # 示例
    ///
    /// ```
    /// use std::ffi::{OsString, OsStr};
    ///
    /// let s = OsString::from("hello");
    ///
    /// let b: Box<OsStr> = s.into_boxed_os_str();
    /// ```
    #[must_use = "`self` will be dropped if the result is not used"]
    #[stable(feature = "into_boxed_os_str", since = "1.20.0")]
    pub fn into_boxed_os_str(self) -> Box<OsStr> {
        let rw = Box::into_raw(self.inner.into_box()) as *mut OsStr;
        unsafe { Box::from_raw(rw) }
    }

    /// Consumes and leaks the `OsString`, returning a mutable reference to the contents,
    /// `&'a mut OsStr`.
    ///
    /// 调用者可以自由选择返回的生命周期，包括 'static。
    /// 实际上，此函数非常适合用于在程序剩余生命周期内存在的数据，因为丢弃返回的引用会导致内存泄漏。
    /// the program’s life, as dropping the returned reference will cause a memory leak.
    ///
    /// It does not reallocate or shrink the `OsString`, so the leaked allocation may include
    /// unused capacity that is not part of the returned slice. If you want to discard excess
    /// capacity, call [`into_boxed_os_str`], and then [`Box::leak`] instead.
    /// 但是，请记住，缩小容量可能导致重新分配和复制。
    ///
    /// [`into_boxed_os_str`]: Self::into_boxed_os_str
    #[stable(feature = "os_string_pathbuf_leak", since = "1.89.0")]
    #[inline]
    pub fn leak<'a>(self) -> &'a mut OsStr {
        OsStr::from_inner_mut(self.inner.leak())
    }

    /// Truncate the `OsString` to the specified length.
    ///
    /// If `new_len` is greater than or equal to the string's current length,
    /// 则没有效果。
    ///
    /// # Panic
    ///
    /// Panics if `len` does not lie on a valid `OsStr` boundary
    /// (as described in [`OsStr::slice_encoded_bytes`]).
    #[inline]
    #[unstable(feature = "os_string_truncate", issue = "133262")]
    pub fn truncate(&mut self, len: usize) {
        if len >= self.len() {
            return;
        }
        self.as_os_str().inner.check_public_boundary(len);
        // SAFETY: The length was just checked to be at a valid boundary.
        unsafe { self.inner.truncate_unchecked(len) };
    }

    /// Provides plumbing to `Vec::extend_from_slice` without giving full
    /// mutable access to the `Vec`.
    ///
    /// # 安全性
    ///
    /// The slice must be valid for the platform encoding (as described in
    /// [`OsStr::from_encoded_bytes_unchecked`]).
    ///
    /// 这绕过了依赖编码的代理连接，因此
    /// `self` must not end with a leading surrogate half, or `other` must not
    /// start with a trailing surrogate half.
    #[inline]
    pub(crate) unsafe fn extend_from_slice_unchecked(&mut self, other: &[u8]) {
        // SAFETY: Guaranteed by caller.
        unsafe { self.inner.extend_from_slice_unchecked(other) };
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl From<String> for OsString {
    /// Converts a [`String`] into an [`OsString`].
    ///
    /// 此转换不会分配或复制内存。
    #[inline]
    fn from(s: String) -> OsString {
        OsString { inner: Buf::from_string(s) }
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T: ?Sized + AsRef<OsStr>> From<&T> for OsString {
    /// Copies any value implementing <code>[AsRef]&lt;[OsStr]&gt;</code>
    /// into a newly allocated [`OsString`].
    fn from(s: &T) -> OsString {
        trait SpecToOsString {
            fn spec_to_os_string(&self) -> OsString;
        }

        impl<T: AsRef<OsStr>> SpecToOsString for T {
            #[inline]
            default fn spec_to_os_string(&self) -> OsString {
                self.as_ref().to_os_string()
            }
        }

        // Preserve the known-UTF-8 property for strings.
        macro spec_str($T:ty) {
            impl SpecToOsString for $T {
                #[inline]
                fn spec_to_os_string(&self) -> OsString {
                    OsString::from(String::from(self))
                }
            }
        }
        spec_str!(str);
        spec_str!(String);

        s.spec_to_os_string()
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl ops::Index<ops::RangeFull> for OsString {
    type Output = OsStr;

    #[inline]
    fn index(&self, _index: ops::RangeFull) -> &OsStr {
        OsStr::from_inner(self.inner.as_slice())
    }
}

#[stable(feature = "mut_osstr", since = "1.44.0")]
impl ops::IndexMut<ops::RangeFull> for OsString {
    #[inline]
    fn index_mut(&mut self, _index: ops::RangeFull) -> &mut OsStr {
        OsStr::from_inner_mut(self.inner.as_mut_slice())
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl ops::Deref for OsString {
    type Target = OsStr;

    #[inline]
    fn deref(&self) -> &OsStr {
        &self[..]
    }
}

#[stable(feature = "mut_osstr", since = "1.44.0")]
impl ops::DerefMut for OsString {
    #[inline]
    fn deref_mut(&mut self) -> &mut OsStr {
        &mut self[..]
    }
}

#[stable(feature = "osstring_default", since = "1.9.0")]
impl Default for OsString {
    /// Constructs an empty `OsString`.
    #[inline]
    fn default() -> OsString {
        OsString::new()
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl Clone for OsString {
    #[inline]
    fn clone(&self) -> Self {
        OsString { inner: self.inner.clone() }
    }

    /// Clones the contents of `source` into `self`.
    ///
    /// This method is preferred over simply assigning `source.clone()` to `self`,
    /// # 示例
    #[inline]
    fn clone_from(&mut self, source: &Self) {
        self.inner.clone_from(&source.inner)
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl fmt::Debug for OsString {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        fmt::Debug::fmt(&**self, formatter)
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl PartialEq for OsString {
    #[inline]
    fn eq(&self, other: &OsString) -> bool {
        **self == **other
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl PartialEq<str> for OsString {
    #[inline]
    fn eq(&self, other: &str) -> bool {
        &**self == other
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl PartialEq<OsString> for str {
    #[inline]
    fn eq(&self, other: &OsString) -> bool {
        &**other == self
    }
}

#[stable(feature = "os_str_str_ref_eq", since = "1.29.0")]
impl PartialEq<&str> for OsString {
    #[inline]
    fn eq(&self, other: &&str) -> bool {
        **self == **other
    }
}

#[stable(feature = "os_str_str_ref_eq", since = "1.29.0")]
impl<'a> PartialEq<OsString> for &'a str {
    #[inline]
    fn eq(&self, other: &OsString) -> bool {
        **other == **self
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl Eq for OsString {}

#[stable(feature = "rust1", since = "1.0.0")]
impl PartialOrd for OsString {
    #[inline]
    fn partial_cmp(&self, other: &OsString) -> Option<cmp::Ordering> {
        (**self).partial_cmp(&**other)
    }
    #[inline]
    fn lt(&self, other: &OsString) -> bool {
        **self < **other
    }
    #[inline]
    fn le(&self, other: &OsString) -> bool {
        **self <= **other
    }
    #[inline]
    fn gt(&self, other: &OsString) -> bool {
        **self > **other
    }
    #[inline]
    fn ge(&self, other: &OsString) -> bool {
        **self >= **other
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl PartialOrd<str> for OsString {
    #[inline]
    fn partial_cmp(&self, other: &str) -> Option<cmp::Ordering> {
        (**self).partial_cmp(other)
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl Ord for OsString {
    #[inline]
    fn cmp(&self, other: &OsString) -> cmp::Ordering {
        (**self).cmp(&**other)
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl Hash for OsString {
    #[inline]
    fn hash<H: Hasher>(&self, state: &mut H) {
        (**self).hash(state)
    }
}

#[stable(feature = "os_string_fmt_write", since = "1.64.0")]
impl fmt::Write for OsString {
    fn write_str(&mut self, s: &str) -> fmt::Result {
        self.push(s);
        Ok(())
    }
}

impl OsStr {
    /// Coerces into an `OsStr` slice.
    ///
    /// # Examples
    ///
    /// ```
    /// use std::ffi::OsStr;
    ///
    /// let os_str = OsStr::new("foo");
    /// ```
    #[inline]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_unstable(feature = "const_convert", issue = "143773")]
    pub const fn new<S: [const] AsRef<OsStr> + ?Sized>(s: &S) -> &OsStr {
        s.as_ref()
    }

    /// 字节编码是一个未指定的、平台特定的、自同步的 UTF-8 超集。
    /// valid `OsStr`-encoded data.
    ///
    /// ASCII 的超集。
    /// 有关安全的跨平台 [转换] 从/到原生表示形式的更多信息，请参阅 [模块的顶级文档关于转换][conversions]。
    /// # 安全性
    ///
    /// 由于编码未指定，调用者必须传递源自
    /// cross-platform [conversions] from/to native representations.
    ///
    /// # Safety
    ///
    /// As the encoding is unspecified, callers must pass in bytes that originated as a mixture of
    /// validated UTF-8 and bytes from [`OsStr::as_encoded_bytes`] from within the same Rust version
    /// built for the same target platform.  For example, reconstructing an `OsStr` from bytes sent
    /// 此转换可能需要进行 UTF-8 有效性检查。
    ///
    /// Due to the encoding being self-synchronizing, the bytes from [`OsStr::as_encoded_bytes`] can be
    /// split either immediately before or immediately after any valid non-empty UTF-8 substring.
    ///
    /// # 任何非 UTF-8 序列都会被替换为
    ///
    /// ```
    /// use std::ffi::OsStr;
    ///
    /// let os_str = OsStr::new("Mary had a little lamb");
    /// let bytes = os_str.as_encoded_bytes();
    /// let words = bytes.split(|b| *b == b' ');
    /// let words: Vec<&OsStr> = words.map(|word| {
    ///     // SAFETY:
    ///     // - Each `word` only contains content that originated from `OsStr::as_encoded_bytes`
    ///     // - Only split with ASCII whitespace which is a non-empty UTF-8 substring
    ///     unsafe { OsStr::from_encoded_bytes_unchecked(word) }
    /// }).collect();
    /// ```
    ///
    /// [conversions]: super#conversions
    #[inline]
    #[stable(feature = "os_str_bytes", since = "1.74.0")]
    pub unsafe fn from_encoded_bytes_unchecked(bytes: &[u8]) -> &Self {
        Self::from_inner(unsafe { Slice::from_encoded_bytes_unchecked(bytes) })
    }

    #[inline]
    #[rustc_const_unstable(feature = "const_convert", issue = "143773")]
    const fn from_inner(inner: &Slice) -> &OsStr {
        // SAFETY: OsStr is just a wrapper of Slice,
        // therefore converting &Slice to &OsStr is safe.
        unsafe { &*(inner as *const Slice as *const OsStr) }
    }

    #[inline]
    #[rustc_const_unstable(feature = "const_convert", issue = "143773")]
    const fn from_inner_mut(inner: &mut Slice) -> &mut OsStr {
        // SAFETY: OsStr is just a wrapper of Slice,
        // therefore converting &mut Slice to &mut OsStr is safe.
        // Any method that mutates OsStr must be careful not to
        // break platform-specific encoding, in particular Wtf8 on Windows.
        unsafe { &mut *(inner as *mut Slice as *mut OsStr) }
    }

    /// Yields a <code>&[str]</code> slice if the `OsStr` is valid Unicode.
    ///
    /// # 示例
    ///
    /// # Examples
    ///
    /// ```
    /// use std::ffi::OsStr;
    ///
    /// let os_str = OsStr::new("foo");
    /// assert_eq!(os_str.to_str(), Some("foo"));
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[must_use = "this returns the result of the operation, \
                  without modifying the original"]
    #[inline]
    pub fn to_str(&self) -> Option<&str> {
        self.inner.to_str().ok()
    }

    /// Converts an `OsStr` to a <code>[Cow]<[str]></code>.
    ///
    /// Any non-UTF-8 sequences are replaced with
    /// [`U+FFFD REPLACEMENT CHARACTER`][U+FFFD].
    ///
    /// [U+FFFD]: char::REPLACEMENT_CHARACTER
    ///
    /// # Examples
    ///
    /// Calling `to_string_lossy` on an `OsStr` with invalid unicode:
    ///
    /// ```
    /// // Note, due to differences in how Unix and Windows represent strings,
    /// // we are forced to complicate this example, setting up example `OsStr`s
    /// // with different source data and via different platform extensions.
    /// // Understand that in reality you could end up with such example invalid
    /// // sequences simply through collecting user command line arguments, for
    /// // example.
    ///
    /// #[cfg(unix)] {
    ///     use std::ffi::OsStr;
    ///     use std::os::unix::ffi::OsStrExt;
    ///
    ///     // Here, the values 0x66 and 0x6f correspond to 'f' and 'o'
    ///     // respectively. The value 0x80 is a lone continuation byte, invalid
    ///     // in a UTF-8 sequence.
    ///     let source = [0x66, 0x6f, 0x80, 0x6f];
    ///     let os_str = OsStr::from_bytes(&source[..]);
    ///
    ///     assert_eq!(os_str.to_string_lossy(), "fo�o");
    /// }
    /// #[cfg(windows)] {
    ///     use std::ffi::OsString;
    ///     use std::os::windows::prelude::*;
    ///
    ///     // Here the values 0x0066 and 0x006f correspond to 'f' and 'o'
    ///     // respectively. The value 0xD800 is a lone surrogate half, invalid
    ///     // in a UTF-16 sequence.
    ///     let source = [0x0066, 0x006f, 0xD800, 0x006f];
    ///     let os_string = OsString::from_wide(&source[..]);
    ///     let os_str = os_string.as_os_str();
    ///
    ///     assert_eq!(os_str.to_string_lossy(), "fo�o");
    /// }
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[must_use = "this returns the result of the operation, \
                  without modifying the original"]
    #[inline]
    pub fn to_string_lossy(&self) -> Cow<'_, str> {
        self.inner.to_string_lossy()
    }

    /// Copies the slice into an owned [`OsString`].
    ///
    /// # Examples
    ///
    /// ```
    /// use std::ffi::{OsStr, OsString};
    ///
    /// let os_str = OsStr::new("foo");
    /// let os_string = os_str.to_os_string();
    /// assert_eq!(os_string, OsString::from("foo"));
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[must_use = "this returns the result of the operation, \
                  without modifying the original"]
    #[inline]
    #[cfg_attr(not(test), rustc_diagnostic_item = "os_str_to_os_string")]
    pub fn to_os_string(&self) -> OsString {
        OsString { inner: self.inner.to_owned() }
    }

    /// Checks whether the `OsStr` is empty.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::ffi::OsStr;
    ///
    /// let os_str = OsStr::new("");
    /// assert!(os_str.is_empty());
    ///
    /// let os_str = OsStr::new("foo");
    /// assert!(!os_str.is_empty());
    /// ```
    #[stable(feature = "osstring_simple_functions", since = "1.9.0")]
    #[must_use]
    #[inline]
    pub fn is_empty(&self) -> bool {
        self.inner.inner.is_empty()
    }

    /// Returns the length of this `OsStr`.
    ///
    /// 请注意，此函数**不**返回字符串中的字节数。
    /// 以操作系统字符串形式存储。
    ///
    /// The length returned is that of the underlying storage used by `OsStr`.
    /// As discussed in the [`OsString`] introduction, [`OsString`] and `OsStr`
    /// 以最适合廉价相互转换的形式存储字符串，
    /// 以便原生平台和 Rust 字符串形式之间进行转换，这两种形式在存储大小和编码上可能有很大差异。
    /// 包括存储大小和编码方面。
    ///
    /// 这个数值仅用于传递给其他方法，例如
    /// [`OsString::with_capacity`] to avoid reallocations.
    ///
    /// See the main `OsString` documentation information about encoding and capacity units.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::ffi::OsStr;
    ///
    /// let os_str = OsStr::new("");
    /// assert_eq!(os_str.len(), 0);
    ///
    /// let os_str = OsStr::new("foo");
    /// assert_eq!(os_str.len(), 3);
    /// ```
    #[stable(feature = "osstring_simple_functions", since = "1.9.0")]
    #[must_use]
    #[inline]
    pub fn len(&self) -> usize {
        self.inner.inner.len()
    }

    /// Converts a <code>[Box]<[OsStr]></code> into an [`OsString`] without copying or allocating.
    #[stable(feature = "into_boxed_os_str", since = "1.20.0")]
    #[must_use = "`self` will be dropped if the result is not used"]
    pub fn into_os_string(self: Box<Self>) -> OsString {
        let boxed = unsafe { Box::from_raw(Box::into_raw(self) as *mut Slice) };
        OsString { inner: Buf::from_box(boxed) }
    }

    /// 在指定索引处将一个字符串切片分为两部分。
    ///
    /// The two slices returned go from the start of the string slice to `mid`, and from `mid` to the end of the string slice.
    ///
    /// The argument, `mid`, should be a byte offset from the start of the string.
    /// It must also be on a valid `OsStr` boundary.
    /// See [`split_at_checked`][Self::split_at_checked] for the definition of a valid boundary.
    ///
    /// 发生 panic
    ///
    /// Panics if `mid` is not on a valid boundary, or if it is past the end of the last code point of the string slice.
    /// For a non-panicking alternative see [`split_at_checked`][Self::split_at_checked].
    #[unstable(feature = "os_str_split_at", issue = "none")]
    pub fn split_at(&self, mid: usize) -> (&OsStr, &OsStr) {
        self.inner.check_public_boundary(mid);

        // SAFETY: we've checked it's in bounds and a valid boundary
        unsafe { self.split_at_unchecked(mid) }
    }

    /// 在指定索引处将一个字符串切片分为两部分。
    ///
    /// The two slices returned go from the start of the string slice to `mid`, and from `mid` to the end of the string slice.
    ///
    /// The argument, `mid`, should be a valid byte offset from the start of the string.
    /// It must also be on a valid `OsStr` boundary.
    /// The method returns `None` if that’s not the case.
    /// A valid `OsStr` boundary is one of:
    /// - 字符串的开始
    /// - 字符串的结束
    /// - 有效的非空 UTF-8 子串的开始
    /// - 紧接一个有效的非空 UTF-8 子串之后
    #[unstable(feature = "os_str_split_at", issue = "none")]
    pub fn split_at_checked(&self, mid: usize) -> Option<(&OsStr, &OsStr)> {
        self.inner.try_check_public_boundary(mid)?;

        // SAFETY: we've checked it's in bounds and a valid boundary
        unsafe { Some(self.split_at_unchecked(mid)) }
    }

    /// Splits an `OsStr` without checking if `mid` is a valid boundary.
    /// You should use `split_at` or `split_at_checked` instead.
    ///
    /// # 安全性
    ///
    /// Any caller must ensure `mid` is within bounds and lies on
    /// a valid `OsStr` boundary for the platform.
    #[unstable(feature = "str_split_at_unchecked", issue = "165545")]
    pub unsafe fn split_at_unchecked(&self, mid: usize) -> (&OsStr, &OsStr) {
        debug_assert!(
            self.inner.try_check_public_boundary(mid).is_some(),
            "OsStr::split_at_unchecked requires the index to be on a valid `OsStr` boundary",
        );

        // SAFETY: it's up to the caller to ensure this is safe.
        unsafe {
            let (first, second) = self.as_encoded_bytes().split_at_unchecked(mid);
            (Self::from_encoded_bytes_unchecked(first), Self::from_encoded_bytes_unchecked(second))
        }
    }

    /// 将操作系统字符串切片转换为字节切片。要将字节切片转换回操作系统
    /// string slice, use the [`OsStr::from_encoded_bytes_unchecked`] function.
    ///
    /// 字节编码是未指定的、平台特定的、自同步的 UTF-8 超集。
    /// 作为 UTF-8 的自同步超集，这种编码也是 7 位字符的超集。
    /// ASCII。
    ///
    /// 注意：由于编码未指定，任何不是有效 UTF-8 的字节切片应
    /// 被视为不透明，仅能在构建于相同
    /// 目标平台上的同一 Rust 版本中进行比较。例如，通过网络发送切片或将它存储在文件中
    /// will likely result in incompatible byte slices.  See [`OsString`] for more encoding details
    /// and [`std::ffi`] for platform-specific, specified conversions.
    ///
    /// [`std::ffi`]: crate::ffi
    #[inline]
    #[stable(feature = "os_str_bytes", since = "1.74.0")]
    pub fn as_encoded_bytes(&self) -> &[u8] {
        self.inner.as_encoded_bytes()
    }

    /// 根据范围取一个子字符串，该范围对应于
    /// [`OsStr::as_encoded_bytes`].
    ///
    /// The range's start and end must lie on valid `OsStr` boundaries.
    /// A valid `OsStr` boundary is one of:
    /// - 字符串的起始位置
    /// - 字符串的结束位置
    /// - 紧接一个有效的非空 UTF-8 子字符串之前
    /// - 紧接一个有效的非空 UTF-8 子字符串之后
    ///
    /// # Panics
    ///
    /// Panics if `range` does not lie on valid `OsStr` boundaries or if it
    /// # Example
    ///
    /// # Example
    ///
    /// ```
    /// #![feature(os_str_slice)]
    ///
    /// use std::ffi::OsStr;
    ///
    /// let os_str = OsStr::new("foo=bar");
    /// let bytes = os_str.as_encoded_bytes();
    /// if let Some(index) = bytes.iter().position(|b| *b == b'=') {
    ///     let key = os_str.slice_encoded_bytes(..index);
    ///     let value = os_str.slice_encoded_bytes(index + 1..);
    ///     assert_eq!(key, "foo");
    ///     assert_eq!(value, "bar");
    /// }
    /// ```
    #[unstable(feature = "os_str_slice", issue = "118485")]
    pub fn slice_encoded_bytes<R: ops::RangeBounds<usize>>(&self, range: R) -> &Self {
        let encoded_bytes = self.as_encoded_bytes();
        let Range { start, end } = slice::range(range, ..encoded_bytes.len());

        // `check_public_boundary` should panic if the index does not lie on an
        // `OsStr` boundary as described above. It's possible to do this in an
        // encoding-agnostic way, but details of the internal encoding might
        // permit a more efficient implementation.
        self.inner.check_public_boundary(start);
        self.inner.check_public_boundary(end);

        // SAFETY: `slice::range` ensures that `start` and `end` are valid
        let slice = unsafe { encoded_bytes.get_unchecked(start..end) };

        // SAFETY: `slice` comes from `self` and we validated the boundaries
        unsafe { Self::from_encoded_bytes_unchecked(slice) }
    }

    /// 将此字符串就地转换为其 ASCII 小写等价形式。
    ///
    /// ASCII 字母 'A' 到 'Z' 被映射为 'a' 到 'z',
    /// 但非 ASCII 字母保持不变。
    ///
    /// 若需返回新的小写值而不修改现有值，请使用
    /// [`OsStr::to_ascii_lowercase`].
    ///
    /// # Examples
    ///
    /// ```
    /// use std::ffi::OsString;
    ///
    /// let mut s = OsString::from("GRÜßE, JÜRGEN ❤");
    ///
    /// s.make_ascii_lowercase();
    ///
    /// assert_eq!("grÜße, jÜrgen ❤", s);
    /// ```
    #[stable(feature = "osstring_ascii", since = "1.53.0")]
    #[inline]
    pub fn make_ascii_lowercase(&mut self) {
        self.inner.make_ascii_lowercase()
    }

    /// 将此字符串就地转换为其 ASCII 大写等价形式。
    ///
    /// ASCII 字母 'a' 到 'z' 被映射为 'A' 到 'Z',
    /// 但非 ASCII 字母保持不变。
    ///
    /// 若需返回新的大写值而不修改现有值，请使用
    /// [`OsStr::to_ascii_uppercase`].
    ///
    /// # Examples
    ///
    /// ```
    /// use std::ffi::OsString;
    ///
    /// let mut s = OsString::from("Grüße, Jürgen ❤");
    ///
    /// s.make_ascii_uppercase();
    ///
    /// assert_eq!("GRüßE, JüRGEN ❤", s);
    /// ```
    #[stable(feature = "osstring_ascii", since = "1.53.0")]
    #[inline]
    pub fn make_ascii_uppercase(&mut self) {
        self.inner.make_ascii_uppercase()
    }

    /// 返回此字符串的副本，其中每个字符都被映射为其
    /// ASCII 小写等价形式。
    ///
    /// ASCII 字母 'A' 到 'Z' 被映射为 'a' 到 'z',
    /// 但非 ASCII 字母保持不变。
    ///
    /// To lowercase the value in-place, use [`OsStr::make_ascii_lowercase`].
    ///
    /// # Examples
    ///
    /// ```
    /// use std::ffi::OsString;
    /// let s = OsString::from("Grüße, Jürgen ❤");
    ///
    /// assert_eq!("grüße, jürgen ❤", s.to_ascii_lowercase());
    /// ```
    #[must_use = "to lowercase the value in-place, use `make_ascii_lowercase`"]
    #[stable(feature = "osstring_ascii", since = "1.53.0")]
    pub fn to_ascii_lowercase(&self) -> OsString {
        OsString::from_inner(self.inner.to_ascii_lowercase())
    }

    /// 返回此字符串的副本，其中每个字符都被映射为其
    /// ASCII 大写等价形式。
    ///
    /// ASCII 字母 'a' 到 'z' 被映射为 'A' 到 'Z',
    /// 但非 ASCII 字母保持不变。
    ///
    /// To uppercase the value in-place, use [`OsStr::make_ascii_uppercase`].
    ///
    /// # Examples
    ///
    /// ```
    /// use std::ffi::OsString;
    /// let s = OsString::from("Grüße, Jürgen ❤");
    ///
    /// assert_eq!("GRüßE, JüRGEN ❤", s.to_ascii_uppercase());
    /// ```
    #[must_use = "to uppercase the value in-place, use `make_ascii_uppercase`"]
    #[stable(feature = "osstring_ascii", since = "1.53.0")]
    pub fn to_ascii_uppercase(&self) -> OsString {
        OsString::from_inner(self.inner.to_ascii_uppercase())
    }

    /// 检查此字符串中的所有字符是否都在 ASCII 范围内。
    ///
    /// An empty string returns `true`.
    ///
    /// # Examples
    ///
    /// ```
    /// use std::ffi::OsString;
    ///
    /// let ascii = OsString::from("hello!\n");
    /// let non_ascii = OsString::from("Grüße, Jürgen ❤");
    ///
    /// assert!(ascii.is_ascii());
    /// assert!(!non_ascii.is_ascii());
    /// ```
    #[stable(feature = "osstring_ascii", since = "1.53.0")]
    #[must_use]
    #[inline]
    pub fn is_ascii(&self) -> bool {
        self.inner.is_ascii()
    }

    /// 检查两个字符串是否为 ASCII 不区分大小写的匹配。
    ///
    /// Same as `to_ascii_lowercase(a) == to_ascii_lowercase(b)`,
    /// 相同，但无需分配和复制临时变量。
    ///
    /// # Examples
    ///
    /// ```
    /// use std::ffi::OsString;
    ///
    /// assert!(OsString::from("Ferris").eq_ignore_ascii_case("FERRIS"));
    /// assert!(OsString::from("Ferrös").eq_ignore_ascii_case("FERRöS"));
    /// assert!(!OsString::from("Ferrös").eq_ignore_ascii_case("FERRÖS"));
    /// ```
    #[stable(feature = "osstring_ascii", since = "1.53.0")]
    pub fn eq_ignore_ascii_case<S: AsRef<OsStr>>(&self, other: S) -> bool {
        self.inner.eq_ignore_ascii_case(&other.as_ref().inner)
    }

    /// Returns an object that implements [`Display`] for safely printing an
    /// [`OsStr`] that may contain non-Unicode data. This may perform lossy
    /// conversion, depending on the platform.  If you would like an
    /// implementation which escapes the [`OsStr`] please use [`Debug`]
    /// 替代方案。
    ///
    /// [`Display`]: fmt::Display
    /// [`Debug`]: fmt::Debug
    ///
    /// # 示例
    ///
    /// ```
    /// use std::ffi::OsStr;
    ///
    /// let s = OsStr::new("Hello, world!");
    /// println!("{}", s.display());
    /// ```
    #[stable(feature = "os_str_display", since = "1.87.0")]
    #[must_use = "this does not display the `OsStr`; \
                  it returns an object that can be displayed"]
    #[inline]
    pub fn display(&self) -> Display<'_> {
        Display { os_str: self }
    }

    /// Returns the same string as a string slice `&OsStr`.
    ///
    /// This method is redundant when used directly on `&OsStr`, but
    /// 它有助于将其他类似字符串的类型转换为字符串切片，
    /// for example references to `Box<OsStr>` or `Arc<OsStr>`.
    #[inline]
    #[unstable(feature = "str_as_str", issue = "130366")]
    pub const fn as_os_str(&self) -> &OsStr {
        self
    }
}

#[stable(feature = "box_from_os_str", since = "1.17.0")]
impl From<&OsStr> for Box<OsStr> {
    /// Copies the string into a newly allocated <code>[Box]&lt;[OsStr]&gt;</code>.
    #[inline]
    fn from(s: &OsStr) -> Box<OsStr> {
        Box::clone_from_ref(s)
    }
}

#[stable(feature = "box_from_mut_slice", since = "1.84.0")]
impl From<&mut OsStr> for Box<OsStr> {
    /// Copies the string into a newly allocated <code>[Box]&lt;[OsStr]&gt;</code>.
    #[inline]
    fn from(s: &mut OsStr) -> Box<OsStr> {
        Self::from(&*s)
    }
}

#[stable(feature = "box_from_cow", since = "1.45.0")]
impl From<Cow<'_, OsStr>> for Box<OsStr> {
    /// Converts a `Cow<'a, OsStr>` into a <code>[Box]&lt;[OsStr]&gt;</code>,
    /// 通过复制内容来实现，前提是这些内容已被借用。
    #[inline]
    fn from(cow: Cow<'_, OsStr>) -> Box<OsStr> {
        match cow {
            Cow::Borrowed(s) => Box::from(s),
            Cow::Owned(s) => Box::from(s),
        }
    }
}

#[stable(feature = "os_string_from_box", since = "1.18.0")]
impl From<Box<OsStr>> for OsString {
    /// Converts a <code>[Box]<[OsStr]></code> into an [`OsString`] without copying or
    /// allocating.
    #[inline]
    fn from(boxed: Box<OsStr>) -> OsString {
        boxed.into_os_string()
    }
}

#[stable(feature = "box_from_os_string", since = "1.20.0")]
impl From<OsString> for Box<OsStr> {
    /// Converts an [`OsString`] into a <code>[Box]<[OsStr]></code> without copying or allocating.
    #[inline]
    fn from(s: OsString) -> Box<OsStr> {
        s.into_boxed_os_str()
    }
}

#[stable(feature = "more_box_slice_clone", since = "1.29.0")]
impl<A: Allocator + Clone> Clone for Box<OsStr, A> {
    #[inline]
    fn clone(&self) -> Self {
        Box::clone_from_ref_in(&**self, Self::allocator(self).clone())
    }
}

#[unstable(feature = "clone_to_uninit", issue = "126799")]
unsafe impl CloneToUninit for OsStr {
    #[inline]
    #[cfg_attr(debug_assertions, track_caller)]
    unsafe fn clone_to_uninit(&self, dst: *mut u8) {
        // SAFETY: we're just a transparent wrapper around a platform-specific Slice
        unsafe { self.inner.clone_to_uninit(dst) }
    }
}

#[stable(feature = "shared_from_slice2", since = "1.24.0")]
impl From<OsString> for Arc<OsStr> {
    /// Converts an [`OsString`] into an <code>[Arc]<[OsStr]></code> by moving the [`OsString`]
    /// data into a new [`Arc`] buffer.
    #[inline]
    fn from(s: OsString) -> Arc<OsStr> {
        let arc = s.inner.into_arc();
        unsafe { Arc::from_raw(Arc::into_raw(arc) as *const OsStr) }
    }
}

#[stable(feature = "shared_from_slice2", since = "1.24.0")]
impl From<&OsStr> for Arc<OsStr> {
    /// Copies the string into a newly allocated <code>[Arc]&lt;[OsStr]&gt;</code>.
    #[inline]
    fn from(s: &OsStr) -> Arc<OsStr> {
        let arc = s.inner.into_arc();
        unsafe { Arc::from_raw(Arc::into_raw(arc) as *const OsStr) }
    }
}

#[stable(feature = "shared_from_mut_slice", since = "1.84.0")]
impl From<&mut OsStr> for Arc<OsStr> {
    /// Copies the string into a newly allocated <code>[Arc]&lt;[OsStr]&gt;</code>.
    #[inline]
    fn from(s: &mut OsStr) -> Arc<OsStr> {
        Arc::from(&*s)
    }
}

#[stable(feature = "shared_from_slice2", since = "1.24.0")]
impl From<OsString> for Rc<OsStr> {
    /// Converts an [`OsString`] into an <code>[Rc]<[OsStr]></code> by moving the [`OsString`]
    /// data into a new [`Rc`] buffer.
    #[inline]
    fn from(s: OsString) -> Rc<OsStr> {
        let rc = s.inner.into_rc();
        unsafe { Rc::from_raw(Rc::into_raw(rc) as *const OsStr) }
    }
}

#[stable(feature = "shared_from_slice2", since = "1.24.0")]
impl From<&OsStr> for Rc<OsStr> {
    /// Copies the string into a newly allocated <code>[Rc]&lt;[OsStr]&gt;</code>.
    #[inline]
    fn from(s: &OsStr) -> Rc<OsStr> {
        let rc = s.inner.into_rc();
        unsafe { Rc::from_raw(Rc::into_raw(rc) as *const OsStr) }
    }
}

#[stable(feature = "shared_from_mut_slice", since = "1.84.0")]
impl From<&mut OsStr> for Rc<OsStr> {
    /// Copies the string into a newly allocated <code>[Rc]&lt;[OsStr]&gt;</code>.
    #[inline]
    fn from(s: &mut OsStr) -> Rc<OsStr> {
        Rc::from(&*s)
    }
}

#[stable(feature = "cow_from_osstr", since = "1.28.0")]
impl<'a> From<OsString> for Cow<'a, OsStr> {
    /// Moves the string into a [`Cow::Owned`].
    #[inline]
    fn from(s: OsString) -> Cow<'a, OsStr> {
        Cow::Owned(s)
    }
}

#[stable(feature = "cow_from_osstr", since = "1.28.0")]
impl<'a> From<&'a OsStr> for Cow<'a, OsStr> {
    /// Converts the string reference into a [`Cow::Borrowed`].
    #[inline]
    fn from(s: &'a OsStr) -> Cow<'a, OsStr> {
        Cow::Borrowed(s)
    }
}

#[stable(feature = "cow_from_osstr", since = "1.28.0")]
impl<'a> From<&'a OsString> for Cow<'a, OsStr> {
    /// Converts the string reference into a [`Cow::Borrowed`].
    #[inline]
    fn from(s: &'a OsString) -> Cow<'a, OsStr> {
        Cow::Borrowed(s.as_os_str())
    }
}

#[stable(feature = "osstring_from_cow_osstr", since = "1.28.0")]
impl<'a> From<Cow<'a, OsStr>> for OsString {
    /// Converts a `Cow<'a, OsStr>` into an [`OsString`],
    /// 通过复制内容来实现，前提是这些内容已被借用。
    #[inline]
    fn from(s: Cow<'a, OsStr>) -> Self {
        s.into_owned()
    }
}

#[stable(feature = "str_tryfrom_osstr_impl", since = "1.72.0")]
impl<'a> TryFrom<&'a OsStr> for &'a str {
    type Error = crate::str::Utf8Error;

    /// Tries to convert an `&OsStr` to a `&str`.
    ///
    /// ```
    /// use std::ffi::OsStr;
    ///
    /// let os_str = OsStr::new("foo");
    /// let as_str = <&str>::try_from(os_str).unwrap();
    /// assert_eq!(as_str, "foo");
    /// ```
    fn try_from(value: &'a OsStr) -> Result<Self, Self::Error> {
        value.inner.to_str()
    }
}

#[stable(feature = "box_default_extra", since = "1.17.0")]
impl Default for Box<OsStr> {
    #[inline]
    fn default() -> Box<OsStr> {
        let rw = Box::into_raw(Slice::empty_box()) as *mut OsStr;
        unsafe { Box::from_raw(rw) }
    }
}

#[stable(feature = "osstring_default", since = "1.9.0")]
impl Default for &OsStr {
    /// Creates an empty `OsStr`.
    #[inline]
    fn default() -> Self {
        OsStr::new("")
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl PartialEq for OsStr {
    #[inline]
    fn eq(&self, other: &OsStr) -> bool {
        self.as_encoded_bytes().eq(other.as_encoded_bytes())
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl PartialEq<str> for OsStr {
    #[inline]
    fn eq(&self, other: &str) -> bool {
        *self == *OsStr::new(other)
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl PartialEq<OsStr> for str {
    #[inline]
    fn eq(&self, other: &OsStr) -> bool {
        *other == *OsStr::new(self)
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl Eq for OsStr {}

#[stable(feature = "rust1", since = "1.0.0")]
impl PartialOrd for OsStr {
    #[inline]
    fn partial_cmp(&self, other: &OsStr) -> Option<cmp::Ordering> {
        self.as_encoded_bytes().partial_cmp(other.as_encoded_bytes())
    }
    #[inline]
    fn lt(&self, other: &OsStr) -> bool {
        self.as_encoded_bytes().lt(other.as_encoded_bytes())
    }
    #[inline]
    fn le(&self, other: &OsStr) -> bool {
        self.as_encoded_bytes().le(other.as_encoded_bytes())
    }
    #[inline]
    fn gt(&self, other: &OsStr) -> bool {
        self.as_encoded_bytes().gt(other.as_encoded_bytes())
    }
    #[inline]
    fn ge(&self, other: &OsStr) -> bool {
        self.as_encoded_bytes().ge(other.as_encoded_bytes())
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl PartialOrd<str> for OsStr {
    #[inline]
    fn partial_cmp(&self, other: &str) -> Option<cmp::Ordering> {
        self.partial_cmp(OsStr::new(other))
    }
}

// FIXME (#19470): cannot provide PartialOrd<OsStr> for str until we
// have more flexible coherence rules.

#[stable(feature = "rust1", since = "1.0.0")]
impl Ord for OsStr {
    #[inline]
    fn cmp(&self, other: &OsStr) -> cmp::Ordering {
        self.as_encoded_bytes().cmp(other.as_encoded_bytes())
    }
}

macro_rules! impl_cmp {
    ($lhs:ty, $rhs: ty) => {
        #[stable(feature = "cmp_os_str", since = "1.8.0")]
        impl PartialEq<$rhs> for $lhs {
            #[inline]
            fn eq(&self, other: &$rhs) -> bool {
                <OsStr as PartialEq>::eq(self, other)
            }
        }

        #[stable(feature = "cmp_os_str", since = "1.8.0")]
        impl PartialEq<$lhs> for $rhs {
            #[inline]
            fn eq(&self, other: &$lhs) -> bool {
                <OsStr as PartialEq>::eq(self, other)
            }
        }

        #[stable(feature = "cmp_os_str", since = "1.8.0")]
        impl PartialOrd<$rhs> for $lhs {
            #[inline]
            fn partial_cmp(&self, other: &$rhs) -> Option<cmp::Ordering> {
                <OsStr as PartialOrd>::partial_cmp(self, other)
            }
        }

        #[stable(feature = "cmp_os_str", since = "1.8.0")]
        impl PartialOrd<$lhs> for $rhs {
            #[inline]
            fn partial_cmp(&self, other: &$lhs) -> Option<cmp::Ordering> {
                <OsStr as PartialOrd>::partial_cmp(self, other)
            }
        }
    };
}

impl_cmp!(OsString, OsStr);
impl_cmp!(OsString, &OsStr);
impl_cmp!(Cow<'_, OsStr>, OsStr);
impl_cmp!(Cow<'_, OsStr>, &OsStr);
impl_cmp!(Cow<'_, OsStr>, OsString);

#[stable(feature = "rust1", since = "1.0.0")]
impl Hash for OsStr {
    #[inline]
    fn hash<H: Hasher>(&self, state: &mut H) {
        self.as_encoded_bytes().hash(state)
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl fmt::Debug for OsStr {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        fmt::Debug::fmt(&self.inner, formatter)
    }
}

/// Helper struct for safely printing an [`OsStr`] with [`format!`] and `{}`.
///
/// An [`OsStr`] might contain non-Unicode data. This `struct` implements the
/// [`Display`] trait in a way that mitigates that. It is created by the
/// [`display`](OsStr::display) method on [`OsStr`]. This may perform lossy
/// conversion, depending on the platform. If you would like an implementation
/// which escapes the [`OsStr`] please use [`Debug`] instead.
///
/// # 示例
///
/// ```
/// use std::ffi::OsStr;
///
/// let s = OsStr::new("Hello, world!");
/// println!("{}", s.display());
/// ```
///
/// [`Display`]: fmt::Display
/// [`format!`]: crate::format
#[stable(feature = "os_str_display", since = "1.87.0")]
pub struct Display<'a> {
    os_str: &'a OsStr,
}

#[stable(feature = "os_str_display", since = "1.87.0")]
impl fmt::Debug for Display<'_> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        fmt::Debug::fmt(&self.os_str, f)
    }
}

#[stable(feature = "os_str_display", since = "1.87.0")]
impl fmt::Display for Display<'_> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        fmt::Display::fmt(&self.os_str.inner, f)
    }
}

#[unstable(feature = "slice_concat_ext", issue = "none", reason = "implementation detail")]
impl<S: Borrow<OsStr>> alloc::slice::Join<&OsStr> for [S] {
    type Output = OsString;

    fn join(slice: &Self, sep: &OsStr) -> OsString {
        let Some((first, suffix)) = slice.split_first() else {
            return OsString::new();
        };
        let first_owned = first.borrow().to_owned();
        suffix.iter().fold(first_owned, |mut a, b| {
            a.push(sep);
            a.push(b.borrow());
            a
        })
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl Borrow<OsStr> for OsString {
    #[inline]
    fn borrow(&self) -> &OsStr {
        &self[..]
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl ToOwned for OsStr {
    type Owned = OsString;
    #[inline]
    fn to_owned(&self) -> OsString {
        self.to_os_string()
    }
    #[inline]
    fn clone_into(&self, target: &mut OsString) {
        self.inner.clone_into(&mut target.inner)
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_const_unstable(feature = "const_convert", issue = "143773")]
const impl AsRef<OsStr> for OsStr {
    #[inline]
    fn as_ref(&self) -> &OsStr {
        self
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl AsRef<OsStr> for OsString {
    #[inline]
    fn as_ref(&self) -> &OsStr {
        self
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl AsRef<OsStr> for str {
    #[inline]
    fn as_ref(&self) -> &OsStr {
        OsStr::from_inner(Slice::from_str(self))
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl AsRef<OsStr> for String {
    #[inline]
    fn as_ref(&self) -> &OsStr {
        (**self).as_ref()
    }
}

impl FromInner<Buf> for OsString {
    #[inline]
    fn from_inner(buf: Buf) -> OsString {
        OsString { inner: buf }
    }
}

impl IntoInner<Buf> for OsString {
    #[inline]
    fn into_inner(self) -> Buf {
        self.inner
    }
}

impl AsInner<Slice> for OsStr {
    #[inline]
    fn as_inner(&self) -> &Slice {
        &self.inner
    }
}

#[stable(feature = "osstring_from_str", since = "1.45.0")]
impl FromStr for OsString {
    type Err = !;

    #[inline]
    fn from_str(s: &str) -> Result<Self, !> {
        Ok(OsString::from(s))
    }
}

#[stable(feature = "osstring_extend", since = "1.52.0")]
impl Extend<OsString> for OsString {
    #[inline]
    fn extend<I: IntoIterator<Item = OsString>>(&mut self, iter: I) {
        for s in iter {
            self.push(&s);
        }
    }
}

#[stable(feature = "osstring_extend", since = "1.52.0")]
impl<'a> Extend<&'a OsStr> for OsString {
    #[inline]
    fn extend<I: IntoIterator<Item = &'a OsStr>>(&mut self, iter: I) {
        for s in iter {
            self.push(s);
        }
    }
}

#[stable(feature = "osstring_extend", since = "1.52.0")]
impl<'a> Extend<Cow<'a, OsStr>> for OsString {
    #[inline]
    fn extend<I: IntoIterator<Item = Cow<'a, OsStr>>>(&mut self, iter: I) {
        for s in iter {
            self.push(&s);
        }
    }
}

#[stable(feature = "osstring_extend", since = "1.52.0")]
impl FromIterator<OsString> for OsString {
    #[inline]
    fn from_iter<I: IntoIterator<Item = OsString>>(iter: I) -> Self {
        let mut iterator = iter.into_iter();

        // Because we're iterating over `OsString`s, we can avoid at least
        // one allocation by getting the first string from the iterator
        // and appending to it all the subsequent strings.
        match iterator.next() {
            None => OsString::new(),
            Some(mut buf) => {
                buf.extend(iterator);
                buf
            }
        }
    }
}

#[stable(feature = "osstring_extend", since = "1.52.0")]
impl<'a> FromIterator<&'a OsStr> for OsString {
    #[inline]
    fn from_iter<I: IntoIterator<Item = &'a OsStr>>(iter: I) -> Self {
        let mut buf = Self::new();
        for s in iter {
            buf.push(s);
        }
        buf
    }
}

#[stable(feature = "osstring_extend", since = "1.52.0")]
impl<'a> FromIterator<Cow<'a, OsStr>> for OsString {
    #[inline]
    fn from_iter<I: IntoIterator<Item = Cow<'a, OsStr>>>(iter: I) -> Self {
        let mut iterator = iter.into_iter();

        // Because we're iterating over `OsString`s, we can avoid at least
        // one allocation by getting the first owned string from the iterator
        // and appending to it all the subsequent strings.
        match iterator.next() {
            None => OsString::new(),
            Some(Cow::Owned(mut buf)) => {
                buf.extend(iterator);
                buf
            }
            Some(Cow::Borrowed(buf)) => {
                let mut buf = OsString::from(buf);
                buf.extend(iterator);
                buf
            }
        }
    }
}
