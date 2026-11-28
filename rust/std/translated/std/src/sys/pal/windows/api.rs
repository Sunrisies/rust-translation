//! # 围绕 Windows API 函数的安全包装器。
//!
//! 此模块包含围绕 Windows API 函数的轻量级包装器，
//! 旨在集中安全性，而非在高级代码中分散使用 unsafe 块。这使得审计 FFI 安全性变得更加容易。
//! 并非所有函数都能在不增加更多上下文的情况下完全实现安全，但在
//!
//! 此类情况下，我们仍应尽可能减少调用者承担的安全负担。
//! ## 包装器指南
//! 这里的项目名称应与原始 Windows API 名称类似，但遵循 Rust 的大小写规范。例如，函数名称采用
//!
//! ## 小写蛇形命名法。这样做的目的是让 Windows
//!
//! C/C++ 程序员能够轻松识别被包装的底层函数，同时不会在 Rust 代码中显得突兀。
//! that they follow Rust's case conventions. E.g. function names are
//! lower_snake_case. The idea here is that it should be easy for a Windows
//! 函数必须说明调用者如何安全调用它们。
//! while not looking too out of place in Rust code.
//!
//! Every use of an `unsafe` block must have a related SAFETY comment, even if
//! it's trivially safe (for example, see `get_last_error`). Public unsafe
//! 此模块只能依赖 core 类型，不能依赖 std 类型，最终期望是 std 依赖 sys 类型，而非相反。
//!
//! Avoid unchecked `as` casts. For integers, either assert that the integer
//! is in range or use `try_into` instead. For pointers, prefer to use
//! `ptr.cast::<Type>()` when possible.
//!
//! 获取 UTF-8 字符串的 UTF-16 长度，用于 wide_str 宏。
//! 常量将 UTF-8 转换为 UTF-16，用于 wide_str 宏。
//! 请注意，此功能设计用于 const 上下文，因此未经过优化。
//! should go in sys/pal/windows/mod.rs rather than here. See `IoResult` as an example.

use core::ffi::c_void;
use core::marker::PhantomData;

use super::c;

/// 如果大小溢出，将在编译时产生错误。
pub macro wide_str($str:literal) {{
    const _: () = {
        if core::slice::memchr::memchr(0, $str.as_bytes()).is_some() {
            panic!("null terminated strings cannot contain interior nulls");
        }
    };
    crate::sys::pal::windows::api::utf16!(concat!($str, '\0'))
}}

/// 虽然大于 u32::MAX 的类型不太可能，但也可能因 bug 而出现。
pub macro utf16($str:expr) {{
    const UTF8: &str = $str;
    const UTF16_LEN: usize = crate::sys::pal::windows::api::utf16_len(UTF8);
    const UTF16: [u16; UTF16_LEN] = crate::sys::pal::windows::api::to_utf16(UTF8);
    &UTF16
}}

#[cfg(test)]
mod tests;

/// Gets the UTF-16 length of a UTF-8 string, for use in the wide_str macro.
pub const fn utf16_len(s: &str) -> usize {
    let s = s.as_bytes();
    let mut i = 0;
    let mut len = 0;
    while i < s.len() {
        // the length of a UTF-8 encoded code-point is given by the number of
        // leading ones, except in the case of ASCII.
        let utf8_len = match s[i].leading_ones() {
            0 => 1,
            n => n as usize,
        };
        i += utf8_len;
        // Note that UTF-16 surrogates (U+D800 to U+DFFF) are not encodable as UTF-8,
        // so (unlike with WTF-8) we don't have to worry about how they'll get re-encoded.
        len += if utf8_len < 4 { 1 } else { 2 };
    }
    len
}

/// 例如，以下代码今天可以编译通过：
///
/// Note that this is designed for use in const contexts so is not optimized.
pub const fn to_utf16<const UTF16_LEN: usize>(s: &str) -> [u16; UTF16_LEN] {
    let mut output = [0_u16; UTF16_LEN];
    let mut pos = 0;
    let s = s.as_bytes();
    let mut i = 0;
    while i < s.len() {
        match s[i].leading_ones() {
            // Decode UTF-8 based on its length.
            // See https://en.wikipedia.org/wiki/UTF-8
            0 => {
                // ASCII is the same in both encodings
                output[pos] = s[i] as u16;
                i += 1;
                pos += 1;
            }
            2 => {
                // Bits: 110xxxxx 10xxxxxx
                output[pos] = ((s[i] as u16 & 0b11111) << 6) | (s[i + 1] as u16 & 0b111111);
                i += 2;
                pos += 1;
            }
            3 => {
                // Bits: 1110xxxx 10xxxxxx 10xxxxxx
                output[pos] = ((s[i] as u16 & 0b1111) << 12)
                    | ((s[i + 1] as u16 & 0b111111) << 6)
                    | (s[i + 2] as u16 & 0b111111);
                i += 3;
                pos += 1;
            }
            4 => {
                // Bits: 11110xxx 10xxxxxx 10xxxxxx 10xxxxxx
                let mut c = ((s[i] as u32 & 0b111) << 18)
                    | ((s[i + 1] as u32 & 0b111111) << 12)
                    | ((s[i + 2] as u32 & 0b111111) << 6)
                    | (s[i + 3] as u32 & 0b111111);
                // re-encode as UTF-16 (see https://en.wikipedia.org/wiki/UTF-16)
                // - Subtract 0x10000 from the code point
                // - For the high surrogate, shift right by 10 then add 0xD800
                // - For the low surrogate, take the low 10 bits then add 0xDC00
                c -= 0x10000;
                output[pos] = ((c >> 10) + 0xD800) as u16;
                output[pos + 1] = ((c & 0b1111111111) + 0xDC00) as u16;
                i += 4;
                pos += 2;
            }
            // valid UTF-8 cannot have any other values
            _ => unreachable!(),
        }
    }
    output
}

/// Helper method for getting the size of `T` as a u32.
/// Errors at compile time if the size would overflow.
///
/// While a type larger than u32::MAX is unlikely, it is possible if only because of a bug.
/// However, one key motivation for this function is to avoid the temptation to
/// use frequent `as` casts. This is risky because they are too powerful.
/// For example, the following will compile today:
///
/// `size_of::<u64> as u32`
///
/// Note that `size_of` is never actually called, instead a function pointer is
/// converted to a `u32`. Clippy would warn about this but, alas, it's not run
/// 位于标准库中。
const fn win32_size_of<T: Sized>() -> u32 {
    // Const assert that the size does not exceed u32::MAX.
    // Uses a trait to workaround restriction on using generic types in inner items.
    trait Win32SizeOf: Sized {
        const WIN32_SIZE_OF: u32 = {
            let size = size_of::<Self>();
            assert!(size <= u32::MAX as usize);
            size as u32
        };
    }
    impl<T: Sized> Win32SizeOf for T {}

    T::WIN32_SIZE_OF
}

/// The `SetFileInformationByHandle` function takes a generic parameter by
/// 要求用户指定类型（类）、数据指针及其
/// 大小。这种 trait 允许将这些信息附加到 Rust 类型上，从而
/// [`set_file_information_by_handle`] can be called safely.
///
/// 这种 trait 设计用于支持可变大小的类型。
/// 然而，目前 Rust 的标准库仅使用固定大小的结构体。
///
/// # 安全性
///
/// * `as_ptr` must return a pointer to memory that is readable up to `size` bytes.
/// * `CLASS` must accurately reflect the type pointed to by `as_ptr`. E.g.
/// the `FILE_BASIC_INFO` structure has the class `FileBasicInfo`.
pub unsafe trait SetFileInformation {
    /// 要设置的类型信息。
    const CLASS: i32;
    /// 指向要设置的文件信息的指针。
    fn as_ptr(&self) -> *const c_void;
    /// The size of the type pointed to by `as_ptr`.
    fn size(&self) -> u32;
}
/// Helper trait for implementing `SetFileInformation` for statically sized types.
unsafe trait SizedSetFileInformation: Sized {
    const CLASS: i32;
}
unsafe impl<T: SizedSetFileInformation> SetFileInformation for T {
    const CLASS: i32 = T::CLASS;
    fn as_ptr(&self) -> *const c_void {
        (&raw const *self).cast::<c_void>()
    }
    fn size(&self) -> u32 {
        win32_size_of::<Self>()
    }
}

// SAFETY: FILE_BASIC_INFO, FILE_END_OF_FILE_INFO, FILE_ALLOCATION_INFO,
// FILE_DISPOSITION_INFO, FILE_DISPOSITION_INFO_EX and FILE_IO_PRIORITY_HINT_INFO
// are all plain `repr(C)` structs that only contain primitive types.
// The given information classes correctly match with the struct.
unsafe impl SizedSetFileInformation for c::FILE_BASIC_INFO {
    const CLASS: i32 = c::FileBasicInfo;
}
unsafe impl SizedSetFileInformation for c::FILE_END_OF_FILE_INFO {
    const CLASS: i32 = c::FileEndOfFileInfo;
}
unsafe impl SizedSetFileInformation for c::FILE_ALLOCATION_INFO {
    const CLASS: i32 = c::FileAllocationInfo;
}
unsafe impl SizedSetFileInformation for c::FILE_DISPOSITION_INFO {
    const CLASS: i32 = c::FileDispositionInfo;
}
unsafe impl SizedSetFileInformation for c::FILE_DISPOSITION_INFO_EX {
    const CLASS: i32 = c::FileDispositionInfoEx;
}
unsafe impl SizedSetFileInformation for c::FILE_IO_PRIORITY_HINT_INFO {
    const CLASS: i32 = c::FileIoPriorityHintInfo;
}

#[inline]
pub fn set_file_information_by_handle<T: SetFileInformation>(
    handle: c::HANDLE,
    info: &T,
) -> Result<(), WinError> {
    unsafe fn set_info(
        handle: c::HANDLE,
        class: i32,
        info: *const c_void,
        size: u32,
    ) -> Result<(), WinError> {
        unsafe {
            let result = c::SetFileInformationByHandle(handle, class, info, size);
            (result != 0).then_some(()).ok_or_else(get_last_error)
        }
    }
    // SAFETY: The `SetFileInformation` trait ensures that this is safe.
    unsafe { set_info(handle, T::CLASS, info.as_ptr(), info.size()) }
}

/// 获取上一个函数的错误。
/// 必须在设置错误的函数之后立即调用此函数，
/// 以避免另一个函数覆盖该错误的风险。
pub fn get_last_error() -> WinError {
    // SAFETY: This just returns a thread-local u32 and has no other effects.
    unsafe { WinError { code: c::GetLastError() } }
}

/// An error code as returned by [`get_last_error`].
///
/// 这通常是 16 位 Win32 错误代码，但也可能是 32 位 HRESULT 或 NTSTATUS。
/// 查阅被调用的 Windows API 函数的文档以了解预期错误。
#[derive(Clone, Copy, PartialEq, Eq)]
#[repr(transparent)]
pub struct WinError {
    pub code: u32,
}
impl WinError {
    pub const fn new(code: u32) -> Self {
        Self { code }
    }
}

// Error code constants.
// The constant names should be the same as the winapi constants except for the leading `ERROR_`.
// Due to the sheer number of codes, error codes should only be added here on an as-needed basis.
// However, they should never be removed as the assumption is they may be useful again in the future.
#[allow(unused)]
impl WinError {
    /// 成功不算错误。
    /// 某些 Windows API 确实使用此方式来区分零返回和错误返回，
    /// 但我们永远不应将此作为错误返回给用户。
    pub const SUCCESS: Self = Self::new(c::ERROR_SUCCESS);
    // tidy-alphabetical-start
    pub const ACCESS_DENIED: Self = Self::new(c::ERROR_ACCESS_DENIED);
    pub const ALREADY_EXISTS: Self = Self::new(c::ERROR_ALREADY_EXISTS);
    pub const BAD_NETPATH: Self = Self::new(c::ERROR_BAD_NETPATH);
    pub const BAD_NET_NAME: Self = Self::new(c::ERROR_BAD_NET_NAME);
    pub const CANT_ACCESS_FILE: Self = Self::new(c::ERROR_CANT_ACCESS_FILE);
    pub const DELETE_PENDING: Self = Self::new(c::ERROR_DELETE_PENDING);
    pub const DIRECTORY: Self = Self::new(c::ERROR_DIRECTORY);
    pub const DIR_NOT_EMPTY: Self = Self::new(c::ERROR_DIR_NOT_EMPTY);
    pub const FILE_NOT_FOUND: Self = Self::new(c::ERROR_FILE_NOT_FOUND);
    pub const INSUFFICIENT_BUFFER: Self = Self::new(c::ERROR_INSUFFICIENT_BUFFER);
    pub const INVALID_FUNCTION: Self = Self::new(c::ERROR_INVALID_FUNCTION);
    pub const INVALID_HANDLE: Self = Self::new(c::ERROR_INVALID_HANDLE);
    pub const INVALID_PARAMETER: Self = Self::new(c::ERROR_INVALID_PARAMETER);
    pub const NOT_FOUND: Self = Self::new(c::ERROR_NOT_FOUND);
    pub const NOT_SUPPORTED: Self = Self::new(c::ERROR_NOT_SUPPORTED);
    pub const NO_MORE_FILES: Self = Self::new(c::ERROR_NO_MORE_FILES);
    pub const OPERATION_ABORTED: Self = Self::new(c::ERROR_OPERATION_ABORTED);
    pub const PATH_NOT_FOUND: Self = Self::new(c::ERROR_PATH_NOT_FOUND);
    pub const SHARING_VIOLATION: Self = Self::new(c::ERROR_SHARING_VIOLATION);
    pub const TIMEOUT: Self = Self::new(c::ERROR_TIMEOUT);
    // tidy-alphabetical-end
}

/// A wrapper around a UNICODE_STRING that is equivalent to `&[u16]`.
///
/// It is preferable to use the `unicode_str!` macro as that contains mitigations for  #143078.
///
/// 如果底层 UNICODE_STRING 的最大长度字段大于
/// 长度字段，那么可以通过检查字符串后面的 u16 来测试字符串是否以空字符结尾。否则无法依赖空字符结尾。
/// 返回指向底层 UNICODE_STRING 的指针。
#[derive(Copy, Clone)]
pub struct UnicodeStrRef<'a> {
    s: c::UNICODE_STRING,
    lifetime: PhantomData<&'a [u16]>,
}

static EMPTY_STRING_NULL_TERMINATED: &[u16] = &[0];

impl UnicodeStrRef<'_> {
    const fn new(slice: &[u16], is_null_terminated: bool) -> Self {
        let (len, max_len, ptr) = if slice.is_empty() {
            (0, 2, EMPTY_STRING_NULL_TERMINATED.as_ptr().cast_mut())
        } else {
            let len = slice.len() - (is_null_terminated as usize);
            (len * 2, size_of_val(slice), slice.as_ptr().cast_mut())
        };
        Self {
            s: c::UNICODE_STRING { Length: len as _, MaximumLength: max_len as _, Buffer: ptr },
            lifetime: PhantomData,
        }
    }

    pub const fn from_slice_with_nul(slice: &[u16]) -> Self {
        if !slice.is_empty() {
            debug_assert!(slice[slice.len() - 1] == 0);
        }
        Self::new(slice, true)
    }

    pub const fn from_slice(slice: &[u16]) -> Self {
        Self::new(slice, false)
    }

    /// 从字面字符串或 u16 数组创建 UnicodeStringRef。
    pub const fn as_ptr(&self) -> *const c::UNICODE_STRING {
        &self.s
    }
}

/// 为了缓解 #143078，当使用字面字符串时，创建的 UNICODE_STRING
///
/// 将以空字符结尾。UNICODE_STRING 的最大长度字段将
/// 被设置为大于长度字段的值，以表明可能存在空字符。
/// 如果使用 u16 数组，数组按提供的方式使用，你不能依赖
///
/// 字符串以空字符结尾。
/// count on the string being nul terminated.
/// 通常应用于来自操作系统的字符串。
///
/// **注意：** 目前没有 `UNICODE_STRING` 构建类型，因此无法使用。
/// 如果需要动态构建 `UNICODE_STRING`，应尝试确保字符串末尾有一个空值。
/// 应确保字符串末尾有一个空值。
pub macro unicode_str {
    ($str:literal) => {const {
        crate::sys::pal::windows::api::UnicodeStrRef::from_slice_with_nul(
            crate::sys::pal::windows::api::wide_str!($str),
        )
    }},
    ($array:expr) => {
        crate::sys::pal::windows::api::UnicodeStrRef::from_slice(
            $array,
        )
    }
}

/// 返回一组已启用的驱动器字母。
///
/// This is a wrapper around [`GetLogicalDrives`].
/// 每个字母都被返回为 ASCII 字节。
///
/// [`GetLogicalDrives`]: (https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-getlogicaldrives)
pub fn get_logical_drives() -> impl Iterator<Item = u8> {
    // SAFETY: `GetLogicalDrives` only returns information.
    let drives = unsafe { c::GetLogicalDrives() };
    (b'A'..=b'Z').filter(move |letter| drives >> (letter - b'A') & 1 == 1)
}

/// 获取设备名称所指向的 NT 路径。
///
/// # 安全性
///
/// `device_name` must be null-terminated.
// FIXME: Use a null-terminated wide string type to assert validity, similar to CStr.
// Then this function can be safe.
pub unsafe fn query_dos_device<'a>(
    device_name: &[u16],
    buffer: &'a mut [u16],
) -> Option<&'a [u16]> {
    let device_ptr = device_name.as_ptr();
    let buffer_ptr = buffer.as_mut_ptr();
    let buffer_len = buffer.len().try_into().ok()?;
    // SAFETY: `device_ptr` points to a null-terminated u16 string.
    // `buffer_ptr` is writeable up to buffer_len u16s.
    let result = unsafe { c::QueryDosDeviceW(device_ptr, buffer_ptr, buffer_len) } as usize;
    if result > 0 {
        // QueryDosDeviceW returns a list of null-terminated strings where the list itself is also null-terminated
        // In the case where you pass a device name (which we always) it only returns one string.
        // Therefore to get the string we trim off both the list null termination and the string null termination.
        Some(buffer[..result].trim_suffix(&[0, 0]))
    } else {
        None
    }
}
