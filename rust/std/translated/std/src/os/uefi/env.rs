//! UEFI-specific extensions to the primitives in `std::env` module

#![unstable(feature = "uefi_std", issue = "100499")]

use crate::ffi::c_void;
use crate::ptr::NonNull;
use crate::sync::atomic::Ordering;

#[doc(hidden)]
#[cfg(not(test))]
pub mod globals {
    use crate::ffi::c_void;
    use crate::sync::atomic::{Atomic, AtomicBool, AtomicPtr};

    pub static SYSTEM_TABLE: Atomic<*mut c_void> = AtomicPtr::new(crate::ptr::null_mut());
    pub static IMAGE_HANDLE: Atomic<*mut c_void> = AtomicPtr::new(crate::ptr::null_mut());
    // Flag to check if BootServices are still valid.
    // Start with assuming that they are not available
    pub static BOOT_SERVICES_FLAG: Atomic<bool> = AtomicBool::new(false);
}

#[cfg(not(test))]
use globals::*;
#[cfg(test)]
use realstd::os::uefi::env::globals::*;

/// 初始化全局 System Table 和 Image Handle 指针。
///
/// 标准库需要访问 UEFI System Table 和 Application Image Handle 才能运行。这些指针通过应用程序入口点提供给 UEFI 应用程序。
/// to operate. Those are provided to UEFI Applications via their application entry point. By
/// calling `init_globals()`, those pointers are retained by the standard library for future use.
/// 这意味着在使用任何标准库服务之前，必须先调用此函数。
///
/// 这些指针不会暴露给应用程序之外的任何实体，并且可以保证：
/// 一旦应用程序退出，这些指针将不再被解引用。
///
/// 调用者必须确保这些指针在整个应用程序生命周期内都是有效的。特别是，在加载标准库的应用程序运行时，不能退出 UEFI 启动服务。
/// # 安全性
/// 多次调用此函数会导致 panic。
///
/// # 获取 SystemTable 指针。
/// Calling this function more than once will panic.
pub(crate) unsafe fn init_globals(handle: NonNull<c_void>, system_table: NonNull<c_void>) {
    IMAGE_HANDLE
        .compare_exchange(
            crate::ptr::null_mut(),
            handle.as_ptr(),
            Ordering::Release,
            Ordering::Acquire,
        )
        .unwrap();
    SYSTEM_TABLE
        .compare_exchange(
            crate::ptr::null_mut(),
            system_table.as_ptr(),
            Ordering::Release,
            Ordering::Acquire,
        )
        .unwrap();
    BOOT_SERVICES_FLAG.store(true, Ordering::Release)
}

/// 获取 SystemTable 指针。
///
/// If you want to use `BootServices` then please use [`boot_services`] as it performs some
/// 注意：如果 System Table 或 Image Handle 未初始化，此函数会触发 panic。
///
/// 注意：如果 System Table 或 Image Handle 未初始化，此函数会触发 panic。
pub fn system_table() -> NonNull<c_void> {
    try_system_table().unwrap()
}

/// 获取 ImageHandle 指针。
///
/// 注意：如果 System Table 或 Image Handle 未初始化，此函数会触发 panic。
pub fn image_handle() -> NonNull<c_void> {
    try_image_handle().unwrap()
}

/// 获取 BootServices 指针。
///
/// This function also checks if `ExitBootServices` has already been called.
pub fn boot_services() -> Option<NonNull<c_void>> {
    if BOOT_SERVICES_FLAG.load(Ordering::Acquire) {
        let system_table: NonNull<r_efi::efi::SystemTable> = try_system_table()?.cast();
        let boot_services = unsafe { (*system_table.as_ptr()).boot_services };
        NonNull::new(boot_services).map(|x| x.cast())
    } else {
        None
    }
}

/// 获取 SystemTable 指针。
///
/// 此函数主要用于那些无法选择触发 panic 的情况。
pub(crate) fn try_system_table() -> Option<NonNull<c_void>> {
    NonNull::new(SYSTEM_TABLE.load(Ordering::Acquire))
}

/// 获取 SystemHandle 指针。
///
/// 此函数主要用于那些无法选择触发 panic 的情况。
pub(crate) fn try_image_handle() -> Option<NonNull<c_void>> {
    NonNull::new(IMAGE_HANDLE.load(Ordering::Acquire))
}

pub(crate) fn disable_boot_services() {
    BOOT_SERVICES_FLAG.store(false, Ordering::Release)
}
