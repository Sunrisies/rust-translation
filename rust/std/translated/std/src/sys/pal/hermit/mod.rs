//! Hermit 的系统绑定
//!
//! 此模块包含针对
//! Hermit 操作系统级别功能的外部接口实现。
//!
//! 这一切都极其实验性，实际上并不适用于
//! 广泛/生产环境使用，目前仍属于实验阶段。这一情况
//! 可能会随时间变化。
//!
//! 目前这里的所有函数基本上都是立即返回错误的占位函数。希望通过可移植性检查工具，能够真正
//! 移除所有内容，如果在为 Wasm 编译时，只需省略标准库的部分内容即可。这样就能将原本必然是运行时错误的错误转化为编译时错误！
//! remove all this and just omit parts of the standard library if we're
//! compiling for wasm. That way it's a compile time error for something that's
//! guaranteed to be a runtime error!

#![deny(unsafe_op_in_unsafe_fn)]
#![allow(missing_docs, nonstandard_style)]

use crate::io;
use crate::os::hermit::hermit_abi;
use crate::os::raw::c_char;
use crate::sys::env;

#[path = "../unix/time.rs"]
pub mod time;

pub fn unsupported<T>() -> io::Result<T> {
    Err(unsupported_err())
}

pub fn unsupported_err() -> io::Error {
    io::const_error!(io::ErrorKind::Unsupported, "operation not supported on Hermit yet")
}

pub fn abort_internal() -> ! {
    unsafe { hermit_abi::abort() }
}

// SAFETY: must be called only once during runtime initialization.
// NOTE: this is not guaranteed to run, for example when Rust code is called externally.
pub unsafe fn init(argc: isize, argv: *const *const u8, _sigpipe: u8) {
    unsafe {
        crate::sys::args::init(argc, argv);
    }
}

// SAFETY: must be called only once during runtime cleanup.
// NOTE: this is not guaranteed to run, for example when the program aborts.
pub unsafe fn cleanup() {}

#[cfg(not(test))]
#[unsafe(no_mangle)]
pub unsafe extern "C" fn runtime_entry(
    argc: i32,
    argv: *const *const c_char,
    env: *const *const c_char,
) -> ! {
    unsafe extern "C" {
        fn main(argc: isize, argv: *const *const c_char) -> i32;
    }

    // initialize environment
    env::init(env);

    let result = unsafe { main(argc as isize, argv) };

    unsafe {
        crate::sys::thread_local::destructors::run();
    }
    crate::rt::thread_cleanup();

    unsafe {
        hermit_abi::exit(result);
    }
}

#[doc(hidden)]
pub trait IsNegative {
    fn is_negative(&self) -> bool;
    fn negate(&self) -> i32;
}

macro_rules! impl_is_negative {
    ($($t:ident)*) => ($(impl IsNegative for $t {
        fn is_negative(&self) -> bool {
            *self < 0
        }

        fn negate(&self) -> i32 {
            i32::try_from(-(*self)).unwrap()
        }
    })*)
}

impl IsNegative for i32 {
    fn is_negative(&self) -> bool {
        *self < 0
    }

    fn negate(&self) -> i32 {
        -(*self)
    }
}
impl_is_negative! { i8 i16 i64 isize }

pub fn cvt<T: IsNegative>(t: T) -> io::Result<T> {
    if t.is_negative() { Err(io::Error::from_raw_os_error(t.negate())) } else { Ok(t) }
}

pub fn cvt_r<T, F>(mut f: F) -> io::Result<T>
where
    T: IsNegative,
    F: FnMut() -> T,
{
    loop {
        match cvt(f()) {
            Err(ref e) if e.is_interrupted() => {}
            other => return other,
        }
    }
}
