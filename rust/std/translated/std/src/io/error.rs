#[cfg(test)]
mod tests;

#[cfg_attr(
    test,
    expect(unused, reason = "only used in implementation for non-test compilation")
)]
use crate::{
    io::{Error, OsFunctions, RawOsError},
    sys::io::{decode_error_kind, errno, format_error, is_interrupted},
};

// Because std is linked in during testing, these incoherent implementations would
// be duplicated if this was unconditionally included.
// See #2912 for details.
#[cfg(not(test))]
impl Error {
    /// 返回一个错误，表示最近发生的操作系统错误。
    ///
    /// This function reads the value of `errno` for the target platform (e.g.
    /// `GetLastError` on Windows) and will return a corresponding instance of
    /// [`Error`] for the error code.
    ///
    /// 应在调用平台函数后立即调用此函数。
    /// 否则，错误值的状态无法确定。特别是，
    /// 其他标准库函数可能会调用平台函数，而这些函数可能
    /// （或可能不会）在成功时重置错误值。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::io::Error;
    ///
    /// let os_error = Error::last_os_error();
    /// println!("last OS error: {os_error:?}");
    /// ```
    #[rustc_allow_incoherent_impl]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[doc(alias = "GetLastError")]
    #[doc(alias = "errno")]
    #[must_use]
    #[inline]
    pub fn last_os_error() -> Error {
        Error::from_raw_os_error(errno())
    }

    /// Creates a new instance of an [`Error`] from a particular OS error code.
    ///
    /// # 示例
    ///
    /// 在 Linux 上：
    ///
    /// ```
    /// # if cfg!(target_os = "linux") {
    /// use std::io;
    ///
    /// let error = io::Error::from_raw_os_error(22);
    /// assert_eq!(error.kind(), io::ErrorKind::InvalidInput);
    /// # }
    /// ```
    ///
    /// 在 Windows 上：
    ///
    /// ```
    /// # if cfg!(windows) {
    /// use std::io;
    ///
    /// let error = io::Error::from_raw_os_error(10022);
    /// assert_eq!(error.kind(), io::ErrorKind::InvalidInput);
    /// # }
    /// ```
    #[rustc_allow_incoherent_impl]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[must_use]
    #[inline]
    pub fn from_raw_os_error(code: RawOsError) -> Error {
        const FUNCTIONS: &'static OsFunctions =
            &OsFunctions { format_os_error: format_error, decode_error_kind, is_interrupted };

        // SAFETY: `FUNCTIONS` is a constant and not created at runtime.
        unsafe { Error::from_raw_os_error_with_functions(code, FUNCTIONS) }
    }
}
