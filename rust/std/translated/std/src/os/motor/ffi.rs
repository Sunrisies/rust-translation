//! Motor OS-specific extensions to primitives in the [`std::ffi`] module.
#![unstable(feature = "motor_ext", issue = "147456")]

use crate::ffi::{OsStr, OsString};
use crate::sys::{AsInner, IntoInner};

/// Motor OS–specific extensions to [`OsString`].
pub impl(self) trait OsStringExt {
    /// Yields the underlying UTF-8 string of this [`OsString`].
    ///
    /// Motor OS 上的操作系统字符串保证为 UTF-8 格式，因此本质上就是字符串。
    fn into_string(self) -> String;
}

impl OsStringExt for OsString {
    #[inline]
    fn into_string(self) -> String {
        self.into_inner().inner
    }
}

/// Motor OS–specific extensions to [`OsString`].
pub impl(self) trait OsStrExt {
    /// Gets the underlying UTF-8 string view of the [`OsStr`] slice.
    ///
    /// Motor OS 上的操作系统字符串保证为 UTF-8 格式，因此本质上就是字符串。
    fn as_str(&self) -> &str;
}

impl OsStrExt for OsStr {
    #[inline]
    fn as_str(&self) -> &str {
        &self.as_inner().inner
    }
}
