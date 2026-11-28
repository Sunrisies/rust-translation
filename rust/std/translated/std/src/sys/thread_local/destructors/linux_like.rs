//! 类似 Linux 系统的析构函数注册机制。
//!
//! 自 2.18 版本起，glibc 已提供
//! `__cxa_thread_atexit_impl` symbol which GCC and clang both use to invoke
//! C++ 线程局部全局变量的析构函数。此函数的功能正是
//! 我们所期望的：它安排一个回调，在线程退出时带着
//! 提供的参数执行。
//!
//! 遗憾的是，我们支持的最低 glibc 版本（写作时）
//! 是 2.17，因此我们只能弱链接该符号，需要采用
//! [`list`](super::list) destructor implementation as fallback.

use crate::mem::transmute;

pub unsafe fn register(t: *mut u8, dtor: unsafe extern "C" fn(*mut u8)) {
    /// 这是必要的，因为默认由 std 链接的 __cxa_thread_atexit_impl 实现
    /// 可能是使用 Clang 整数规范化选项未编译成的 C 或 C++ 实现。
    /// compiled using the Clang integer normalization option.
    #[cfg(sanitizer_cfi_normalize_integers)]
    use core::ffi::c_int;
    #[cfg(not(sanitizer_cfi_normalize_integers))]
    #[cfi_encoding = "i"]
    #[repr(transparent)]
    #[allow(non_camel_case_types)]
    pub struct c_int(#[allow(dead_code)] pub core::ffi::c_int);

    unsafe extern "C" {
        #[linkage = "extern_weak"]
        static __dso_handle: *mut u8;
        #[linkage = "extern_weak"]
        static __cxa_thread_atexit_impl: Option<
            extern "C" fn(
                unsafe extern "C" fn(*mut libc::c_void),
                *mut libc::c_void,
                *mut libc::c_void,
            ) -> c_int,
        >;
    }

    if let Some(f) = unsafe { __cxa_thread_atexit_impl }
        && let dso = unsafe { __dso_handle }
        && !dso.is_null()
    {
        unsafe {
            f(
                transmute::<unsafe extern "C" fn(*mut u8), unsafe extern "C" fn(*mut libc::c_void)>(
                    dtor,
                ),
                t.cast(),
                dso as *mut _,
            );
        }
    } else {
        unsafe {
            super::list::register(t, dtor);
        }
    }
}
