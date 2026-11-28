use super::{ErrorKind, OsFunctions, RawOsError};
use crate::fmt;

/// # 安全性
///
/// 提供的引用必须指向完全常量数据；该数据必须在运行时
/// 不被创建。
#[inline]
pub(super) unsafe fn set_functions(_f: &'static OsFunctions) {
    // FIXME: externally implementable items may allow for weak linkage, allowing
    // these methods to be overridden even when atomic pointers are not supported.
}

#[inline]
pub(super) fn format_os_error(errno: RawOsError, fmt: &mut fmt::Formatter<'_>) -> fmt::Result {
    let f = OsFunctions::DEFAULT;
    (f.format_os_error)(errno, fmt)
}

#[inline]
pub(super) fn decode_error_kind(errno: RawOsError) -> ErrorKind {
    let f = OsFunctions::DEFAULT;
    (f.decode_error_kind)(errno)
}

#[inline]
pub(super) fn is_interrupted(errno: RawOsError) -> bool {
    let f = OsFunctions::DEFAULT;
    (f.is_interrupted)(errno)
}
