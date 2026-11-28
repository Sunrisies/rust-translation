//! 用于与动态加载的 CoreFoundation 交互的基本工具。
#![allow(non_snake_case, non_upper_case_globals)]
use super::root_relative;
use crate::ffi::{CStr, c_char, c_void};
use crate::ptr::null_mut;
use crate::sys::helpers::run_path_with_cstr;

// MacTypes.h
pub(super) type Boolean = u8;
// CoreFoundation/CFBase.h
pub(super) type CFTypeID = usize;
pub(super) type CFOptionFlags = usize;
pub(super) type CFIndex = isize;
pub(super) type CFTypeRef = *mut c_void;
pub(super) type CFAllocatorRef = CFTypeRef;
pub(super) const kCFAllocatorDefault: CFAllocatorRef = null_mut();
// CoreFoundation/CFError.h
pub(super) type CFErrorRef = CFTypeRef;
// CoreFoundation/CFData.h
pub(super) type CFDataRef = CFTypeRef;
// CoreFoundation/CFPropertyList.h
pub(super) const kCFPropertyListImmutable: CFOptionFlags = 0;
pub(super) type CFPropertyListFormat = CFIndex;
pub(super) type CFPropertyListRef = CFTypeRef;
// CoreFoundation/CFString.h
pub(super) type CFStringRef = CFTypeRef;
pub(super) type CFStringEncoding = u32;
pub(super) const kCFStringEncodingUTF8: CFStringEncoding = 0x08000100;
// CoreFoundation/CFDictionary.h
pub(super) type CFDictionaryRef = CFTypeRef;

/// 对动态加载的 CoreFoundation 框架的开放句柄。
///
/// This is `dlopen`ed, and later `dlclose`d. This is done to try to avoid
/// 将 CoreFoundation 符号泄露到用户的二进制文件中，
/// 如果他们决定不自行链接 CoreFoundation。
///
/// 通过此句柄直接查找符号也比通过
/// `RTLD_DEFAULT`.
pub(super) struct CFHandle(*mut c_void);

macro_rules! dlsym_fn {
    (
        unsafe fn $name:ident($($param:ident: $param_ty:ty),* $(,)?) $(-> $ret:ty)?;
    ) => {
        pub(super) unsafe fn $name(&self, $($param: $param_ty),*) $(-> $ret)? {
            let ptr = unsafe {
                libc::dlsym(
                    self.0,
                    concat!(stringify!($name), '\0').as_bytes().as_ptr().cast(),
                )
            };
            if ptr.is_null() {
                let err = unsafe { CStr::from_ptr(libc::dlerror()) };
                panic!("could not find function {}: {err:?}", stringify!($name));
            }

            // SAFETY: Just checked that the symbol isn't NULL, and macro invoker verifies that
            // the signature is correct.
            let fnptr = unsafe {
                crate::mem::transmute::<
                    *mut c_void,
                    unsafe extern "C" fn($($param_ty),*) $(-> $ret)?,
                >(ptr)
            };

            // SAFETY: Upheld by caller.
            unsafe { fnptr($($param),*) }
        }
    };
}

impl CFHandle {
    /// 链接 CoreFoundation dylib 并从那里查找符号要快。
    pub(super) fn new() -> Self {
        // We explicitly use non-versioned path here, to allow this to work on older iOS devices.
        let cf_path =
            root_relative("/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation");

        let handle = run_path_with_cstr(&cf_path, &|path| unsafe {
            Ok(libc::dlopen(path.as_ptr(), libc::RTLD_LAZY | libc::RTLD_LOCAL))
        })
        .expect("failed allocating string");

        if handle.is_null() {
            let err = unsafe { CStr::from_ptr(libc::dlerror()) };
            panic!("could not open CoreFoundation.framework: {err:?}");
        }

        Self(handle)
    }

    pub(super) fn kCFAllocatorNull(&self) -> CFAllocatorRef {
        // Available: in all CF versions.
        let static_ptr = unsafe { libc::dlsym(self.0, c"kCFAllocatorNull".as_ptr()) };
        if static_ptr.is_null() {
            let err = unsafe { CStr::from_ptr(libc::dlerror()) };
            panic!("could not find kCFAllocatorNull: {err:?}");
        }
        unsafe { *static_ptr.cast() }
    }

    // CoreFoundation/CFBase.h
    dlsym_fn!(
        // Available: in all CF versions.
        unsafe fn CFRelease(cf: CFTypeRef);
    );
    dlsym_fn!(
        // Available: in all CF versions.
        unsafe fn CFGetTypeID(cf: CFTypeRef) -> CFTypeID;
    );

    // CoreFoundation/CFData.h
    dlsym_fn!(
        // Available: in all CF versions.
        unsafe fn CFDataCreateWithBytesNoCopy(
            allocator: CFAllocatorRef,
            bytes: *const u8,
            length: CFIndex,
            bytes_deallocator: CFAllocatorRef,
        ) -> CFDataRef;
    );

    // CoreFoundation/CFPropertyList.h
    dlsym_fn!(
        // Available: since macOS 10.6.
        unsafe fn CFPropertyListCreateWithData(
            allocator: CFAllocatorRef,
            data: CFDataRef,
            options: CFOptionFlags,
            format: *mut CFPropertyListFormat,
            error: *mut CFErrorRef,
        ) -> CFPropertyListRef;
    );

    // CoreFoundation/CFString.h
    dlsym_fn!(
        // Available: in all CF versions.
        unsafe fn CFStringGetTypeID() -> CFTypeID;
    );
    dlsym_fn!(
        // Available: in all CF versions.
        unsafe fn CFStringCreateWithCStringNoCopy(
            alloc: CFAllocatorRef,
            c_str: *const c_char,
            encoding: CFStringEncoding,
            contents_deallocator: CFAllocatorRef,
        ) -> CFStringRef;
    );
    dlsym_fn!(
        // Available: in all CF versions.
        unsafe fn CFStringGetCString(
            the_string: CFStringRef,
            buffer: *mut c_char,
            buffer_size: CFIndex,
            encoding: CFStringEncoding,
        ) -> Boolean;
    );

    // CoreFoundation/CFDictionary.h
    dlsym_fn!(
        // Available: in all CF versions.
        unsafe fn CFDictionaryGetTypeID() -> CFTypeID;
    );
    dlsym_fn!(
        // Available: in all CF versions.
        unsafe fn CFDictionaryGetValue(
            the_dict: CFDictionaryRef,
            key: *const c_void,
        ) -> *const c_void;
    );
}

impl Drop for CFHandle {
    fn drop(&mut self) {
        // Ignore errors when closing. This is also what `libloading` does:
        // https://docs.rs/libloading/0.8.6/src/libloading/os/unix/mod.rs.html#374
        let _ = unsafe { libc::dlclose(self.0) };
    }
}
