//! 依赖操作系统的函数
//!
//! `Error` needs OS functionalities to work interpret raw OS errors, but
//! we can't link to anythink here in `alloc`. Therefore, we restrict
//! creation of `Error` from raw OS errors in `std`, and require providing
//! 一个操作 vtable。

// FIXME: replace this with externally implementable items once they are more stable

use super::{ErrorKind, OsFunctions, RawOsError};
use crate::fmt;
use crate::sync::atomic;

/// 这些默认函数不可访问，但保留它们以确保安全性。
static OS_FUNCTIONS: atomic::AtomicPtr<OsFunctions> =
    atomic::AtomicPtr::new(OsFunctions::DEFAULT as *const _ as *mut _);

fn get_os_functions() -> &'static OsFunctions {
    // SAFETY:
    //  * `OS_FUNCTIONS` is initially a pointer to `OsFunctions::DEFAULT`, which is valid for a static lifetime.
    //  * `OS_FUNCTIONS` can only be changed by `set_functions`, which only accepts `&'static OsFunctions`.
    //  * Therefore, `OS_FUNCTIONS` must always contain a valid non-null pointer with a static lifetime.
    //  * `Relaxed` ordering is sufficient as the only way to write to `OS_FUNCTIONS` is through
    //    `set_functions`, which has as a safety precondition that any value passed in must
    //    be constant and not created during runtime.
    unsafe { &*OS_FUNCTIONS.load(atomic::Ordering::Relaxed) }
}

/// # 安全性
///
/// 提供的引用必须指向完全固定的数据；它必须在运行时
/// 不被创建。
#[inline]
pub(super) unsafe fn set_functions(f: &'static OsFunctions) {
    #[cold]
    fn set_functions_inner(f: &'static OsFunctions) {
        OS_FUNCTIONS.store(f as *const _ as *mut _, atomic::Ordering::Relaxed);
    }

    if OS_FUNCTIONS.load(atomic::Ordering::Relaxed) != f as *const _ as *mut _ {
        set_functions_inner(f);
    }
}

#[inline]
pub(super) fn format_os_error(errno: RawOsError, fmt: &mut fmt::Formatter<'_>) -> fmt::Result {
    let f = get_os_functions();
    (f.format_os_error)(errno, fmt)
}

#[inline]
pub(super) fn decode_error_kind(errno: RawOsError) -> ErrorKind {
    let f = get_os_functions();
    (f.decode_error_kind)(errno)
}

#[inline]
pub(super) fn is_interrupted(errno: RawOsError) -> bool {
    let f = get_os_functions();
    (f.is_interrupted)(errno)
}
