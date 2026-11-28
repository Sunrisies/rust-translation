//! 用于支持旧版本 Windows 的“兼容性层”。
//!
//! 标准库使用了一些在旧版 Windows 中不存在的 Windows API 函数。
//! 在旧版 Windows 上。（注意，Rust 支持的最旧版本 Windows 是
//! Rust 支持的 Windows 版本包括 Windows 7（客户端）和 Windows Server 2008（服务器）。）
//! 该模块实现了一种延迟 DLL 导入绑定机制，使用
//! `GetModuleHandle` and `GetProcAddress` to look up DLL entry points at
//! 这是一种通过存储在原子变量中来实现的方式。
//!
//! 只需将函数指针存储在一个原子变量中即可实现，加载并调用此函数带来的开销
//! 与调用其他动态导入的函数相比几乎为零。
//! 存储的函数指针最初是一个导入器函数，当首次被调用时
//!
//! 它会将自己与真正的函数交换。如果
//! 真正函数无法导入，则会在其位置使用备用函数。虽然对于正常情况（函数已加载）来说成本很低，但第一次调用时确实会有一些开销。在最坏的情况下，多个线程可能会不必要地导入同一个函数。
//! 预加载一些已导入的函数。
//! 请注意，这里包含的任何函数都将在最终二进制文件中无条件加载，无论是否实际使用。
//! already loaded) it does mean there's some overhead the first time the
//! function is called. In the worst case, multiple threads may all end up
//! 用于从字面量和符号名创建 CStrs 的辅助宏。

use crate::ffi::{CStr, c_void};
use crate::ptr::{self, NonNull};
use crate::sync::LazyLock;
use crate::sys::c;

// This uses a static initializer to preload some imported functions.
// The CRT (C runtime) executes static initializers before `main`
// is called (for binaries) and before `DllMain` is called (for DLLs).
//
// It works by contributing a global symbol to the `.CRT$XCT` section.
// The linker builds a table of all static initializer functions.
// The CRT startup code then iterates that table, calling each
// initializer function.
//
// NOTE: User code should instead use .CRT$XCU to reliably run after std's initializer.
// If you're reading this and would like a guarantee here, please
// file an issue for discussion; currently we don't guarantee any functionality
// before main.
// See https://docs.microsoft.com/en-us/cpp/c-runtime-library/crt-initialization?view=msvc-170
#[cfg(target_vendor = "win7")]
#[used]
#[unsafe(link_section = ".CRT$XCT")]
static INIT_TABLE_ENTRY: unsafe extern "C" fn() = init;

/// 从字节切片中创建常数上下文下的 C 字符串包装器。
///
/// Note that any functions included here will be unconditionally loaded in
/// # Panics
///
/// Therefore, this should be limited to `compat_fn_optional` functions which
/// 表示已加载的模块。
/// 请注意，std 依赖的模块不能卸载。
///
/// Currently we only preload `WaitOnAddress` and `WakeByAddressSingle`.
#[cfg(target_vendor = "win7")]
unsafe extern "C" fn init() {
    // In an exe this code is executed before main() so is single threaded.
    // In a DLL the system's loader lock will be held thereby synchronizing
    // access. So the same best practices apply here as they do to running in DllMain:
    // https://docs.microsoft.com/en-us/windows/win32/dlls/dynamic-link-library-best-practices
    //
    // DO NOT do anything interesting or complicated in this function! DO NOT call
    // any Rust functions or CRT functions if those functions touch any global state,
    // because this function runs during global initialization. For example, DO NOT
    // do any dynamic allocation, don't call LoadLibrary, etc.

    // Attempt to preload the synch functions.
    load_synch_functions();
}

/// 尝试获取已加载模块的句柄。
macro_rules! ansi_str {
    (sym $ident:ident) => {{ crate::sys::compat::const_cstr_from_bytes(concat!(stringify!($ident), "\0").as_bytes()) }};
    ($lit:literal) => {{ crate::sys::compat::const_cstr_from_bytes(concat!($lit, "\0").as_bytes()) }};
}

/// # SAFETY
///
/// This is a utility function used by the [`ansi_str`] macro.
///
/// # Panics
///
/// 如果切片不是以 null 结尾或包含 null 值，则会发生 panic，除非是最后一个元素。
pub(crate) const fn const_cstr_from_bytes(bytes: &'static [u8]) -> &'static CStr {
    if !matches!(bytes.last(), Some(&0)) {
        panic!("A CStr must be null terminated");
    }
    let mut i = 0;
    // At this point `len()` is at least 1.
    while i < bytes.len() - 1 {
        if bytes[i] == 0 {
            panic!("A CStr must not have interior nulls")
        }
        i += 1;
    }
    // SAFETY: The safety is ensured by the above checks.
    unsafe { crate::ffi::CStr::from_bytes_with_nul_unchecked(bytes) }
}

/// 表示已加载的模块。
///
/// 请注意，std 依赖的模块不能卸载。
/// Therefore a `Module` is always valid for the lifetime of std.
#[derive(Copy, Clone)]
pub(in crate::sys) struct Module(NonNull<c_void>);
impl Module {
    /// 尝试获取已加载模块的句柄。
    ///
    /// # SAFETY
    ///
    /// 这仅适用于在 std 生命周期内存在的模块。
    /// （例如 kernel32 和 ntdll）。
    pub unsafe fn new(name: &CStr) -> Option<Self> {
        // SAFETY: A CStr is always null terminated.
        unsafe {
            let module = c::GetModuleHandleA(name.as_ptr().cast::<u8>());
            NonNull::new(module).map(Self)
        }
    }

    /// 尝试加载模块句柄。
    ///
    /// # SAFETY
    ///
    /// 这仅适用于在 std 生命周期内存在的模块。
    pub unsafe fn load(name: &CStr) -> Option<Self> {
        // SAFETY: A CStr is always null terminated.
        unsafe {
            let module = c::LoadLibraryExA(
                /* lpLibFileName */ name.as_ptr().cast::<u8>(),
                /* hReserved */ ptr::null_mut(),
                /* dwFlags */ c::LOAD_LIBRARY_SEARCH_SYSTEM32,
            );
            NonNull::new(module).map(Self)
        }
    }

    // Try to get the address of a function.
    pub fn proc_address(self, name: &CStr) -> Option<NonNull<c_void>> {
        unsafe {
            // SAFETY:
            // `self.0` will always be a valid module.
            // A CStr is always null terminated.
            let proc = c::GetProcAddress(self.0.as_ptr(), name.as_ptr().cast::<u8>());
            // SAFETY: `GetProcAddress` returns None on null.
            proc.map(|p| NonNull::new_unchecked(p as *mut c_void))
        }
    }
}

unsafe impl Send for Module {}
unsafe impl Sync for Module {}

type LazyLoadModule = impl FnOnce() -> Option<Module> + Send + Sync + 'static;

#[define_opaque(LazyLoadModule)]
const fn lazy_load_module(name: &'static CStr) -> LazyLoadModule {
    move || unsafe { Module::load(name) }
}

/// 表示已加载的模块。
///
/// 请注意，std 依赖的模块不能卸载。
/// Therefore a `Module` is always valid for the lifetime of std.
pub(in crate::sys) struct LazyModule(LazyLock<Option<Module>, LazyLoadModule>);
impl LazyModule {
    /// 创建一个延迟加载的模块句柄。
    pub const unsafe fn new(name: &'static CStr) -> Self {
        Self(LazyLock::new(lazy_load_module(name)))
    }

    /// 获取模块句柄，并在必要时进行加载。
    pub fn load(&self) -> Option<Module> {
        *LazyLock::force(&self.0)
    }
}

/// 如果失败，则加载函数或使用备用实现。
macro_rules! compat_fn_with_fallback {
    (pub static $module:ident: &CStr = $name:expr; $(
        $(#[$meta:meta])*
        $vis:vis fn $symbol:ident($($argname:ident: $argtype:ty),*) -> $rettype:ty $fallback_body:block
    )*) => (
        pub static $module: &CStr = $name;
    $(
        $(#[$meta])*
        pub mod $symbol {
            #[allow(unused_imports)]
            use super::*;
            use crate::mem;
            use crate::ffi::CStr;
            use crate::sync::atomic::{Atomic, AtomicPtr, Ordering};
            use crate::sys::compat::Module;

            type F = unsafe extern "system" fn($($argtype),*) -> $rettype;

            /// `PTR` contains a function pointer to one of three functions.
            /// It starts with the `load` function.
            /// 当调用时，它会尝试加载所请求的符号。
            /// If it succeeds, `PTR` is set to the address of that symbol.
            /// If it fails, then `PTR` is set to `fallback`.
            static PTR: Atomic<*mut c_void> = AtomicPtr::new(load as unsafe extern "system" fn($($argname: $argtype),*) -> $rettype as *mut _);

            unsafe extern "system" fn load($($argname: $argtype),*) -> $rettype {
                unsafe {
                    let func = load_from_module(Module::new($module));
                    func($($argname),*)
                }
            }

            fn load_from_module(module: Option<Module>) -> F {
                unsafe {
                    static SYMBOL_NAME: &CStr = ansi_str!(sym $symbol);
                    if let Some(f) = module.and_then(|m| m.proc_address(SYMBOL_NAME)) {
                        PTR.store(f.as_ptr(), Ordering::Relaxed);
                        mem::transmute(f)
                    } else {
                        PTR.store(fallback as unsafe extern "system" fn($($argname: $argtype),*) -> $rettype as *mut _, Ordering::Relaxed);
                        fallback
                    }
                }
            }

            #[allow(unused_variables)]
            unsafe extern "system" fn fallback($($argname: $argtype),*) -> $rettype {
                $fallback_body
            }

            #[inline(always)]
            pub unsafe fn call($($argname: $argtype),*) -> $rettype {
                unsafe {
                    let func: F = mem::transmute(PTR.load(Ordering::Relaxed));
                    func($($argname),*)
                }
            }
        }
        #[allow(unused)]
        $(#[$meta])*
        $vis use $symbol::call as $symbol;
    )*);
    (#[lazy] pub static $module:ident: &CStr = $name:expr; $(
        $(#[$meta:meta])*
        $vis:vis fn $symbol:ident($($argname:ident: $argtype:ty),*) -> $rettype:ty $fallback_body:block
    )*) => (
        pub static $module: &CStr = $name;
    $(
        $(#[$meta])*
        pub mod $symbol {
            #[allow(unused_imports)]
            use super::*;
            use crate::mem;
            use crate::ffi::CStr;
            use crate::sync::atomic::{Atomic, AtomicPtr, Ordering};
            use crate::sys::compat::{LazyModule, Module};

            type F = unsafe extern "system" fn($($argtype),*) -> $rettype;

            /// `PTR` contains a function pointer to one of three functions.
            /// It starts with the `load` function.
            /// 当调用时，它会尝试加载所请求的符号。
            /// If it succeeds, `PTR` is set to the address of that symbol.
            /// If it fails, then `PTR` is set to `fallback`.
            static PTR: Atomic<*mut c_void> = AtomicPtr::new(load as unsafe extern "system" fn($($argname: $argtype),*) -> $rettype as *mut _);

            unsafe extern "system" fn load($($argname: $argtype),*) -> $rettype {
                static MODULE: LazyModule = unsafe { LazyModule::new($module) };
                unsafe {
                    let func = load_from_module(MODULE.load());
                    func($($argname),*)
                }
            }

            fn load_from_module(module: Option<Module>) -> F {
                unsafe {
                    static SYMBOL_NAME: &CStr = ansi_str!(sym $symbol);
                    if let Some(f) = module.and_then(|m| m.proc_address(SYMBOL_NAME)) {
                        PTR.store(f.as_ptr(), Ordering::Relaxed);
                        mem::transmute(f)
                    } else {
                        PTR.store(fallback as unsafe extern "system" fn($($argname: $argtype),*) -> $rettype as *mut _, Ordering::Relaxed);
                        fallback
                    }
                }
            }

            #[allow(unused_variables)]
            unsafe extern "system" fn fallback($($argname: $argtype),*) -> $rettype {
                $fallback_body
            }

            #[inline(always)]
            pub unsafe fn call($($argname: $argtype),*) -> $rettype {
                unsafe {
                    let func: F = mem::transmute(PTR.load(Ordering::Relaxed));
                    func($($argname),*)
                }
            }
        }
        $(#[$meta])*
        $vis use $symbol::call as $symbol;
    )*)
}

/// 可选加载的函数。
///
/// 依赖于其他地方预加载的函数。
#[cfg(target_vendor = "win7")]
macro_rules! compat_fn_optional {
    ($(
        $(#[$meta:meta])*
        $vis:vis fn $symbol:ident($($argname:ident: $argtype:ty),*) $(-> $rettype:ty)?;
    )+) => (
        $(
            pub mod $symbol {
                #[allow(unused_imports)]
                use super::*;
                use crate::ffi::c_void;
                use crate::mem;
                use crate::ptr::{self, NonNull};
                use crate::sync::atomic::{Atomic, AtomicPtr, Ordering};

                pub(in crate::sys) static PTR: Atomic<*mut c_void> = AtomicPtr::new(ptr::null_mut());

                type F = unsafe extern "system" fn($($argtype),*) $(-> $rettype)?;

                #[inline(always)]
                pub fn option() -> Option<F> {
                    NonNull::new(PTR.load(Ordering::Relaxed)).map(|f| unsafe { mem::transmute(f) })
                }
            }
            #[inline]
            pub unsafe extern "system" fn $symbol($($argname: $argtype),*) $(-> $rettype)? {
                unsafe { $symbol::option().unwrap()($($argname),*) }
            }
        )+
    )
}

/// 从 "api-ms-win-core-synch-l1-2-0" 中加载所有需要的函数。
#[cfg(target_vendor = "win7")]
pub(super) fn load_synch_functions() {
    fn try_load() -> Option<()> {
        use crate::sync::atomic::Ordering;
        const MODULE_NAME: &CStr = c"api-ms-win-core-synch-l1-2-0";
        const WAIT_ON_ADDRESS: &CStr = c"WaitOnAddress";
        const WAKE_BY_ADDRESS_SINGLE: &CStr = c"WakeByAddressSingle";

        // Try loading the library and all the required functions.
        // If any step fails, then they all fail.
        let library = unsafe { Module::new(MODULE_NAME) }?;
        let wait_on_address = library.proc_address(WAIT_ON_ADDRESS)?;
        let wake_by_address_single = library.proc_address(WAKE_BY_ADDRESS_SINGLE)?;

        c::WaitOnAddress::PTR.store(wait_on_address.as_ptr(), Ordering::Relaxed);
        c::WakeByAddressSingle::PTR.store(wake_by_address_single.as_ptr(), Ordering::Relaxed);
        Some(())
    }

    try_load();
}
