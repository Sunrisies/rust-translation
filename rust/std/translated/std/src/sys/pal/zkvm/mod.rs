//! risc0 zkvm 平台的系统绑定
//!
//! 此模块包含针对
//! zkvm 的操作系统级功能的外部接口（即特定平台实现）
//!
//! 这一切都极其实验性，实际上并不适用于
//! 广泛/生产环境使用，目前仍属于实验阶段。这
//! 可能会随着时间发生变化。
#![forbid(unsafe_op_in_unsafe_fn)]

pub const WORD_SIZE: usize = size_of::<u32>();

pub mod abi;

use crate::io as std_io;

// SAFETY: must be called only once during runtime initialization.
// NOTE: this is not guaranteed to run, for example when Rust code is called externally.
pub unsafe fn init(_argc: isize, _argv: *const *const u8, _sigpipe: u8) {}

// SAFETY: must be called only once during runtime cleanup.
// NOTE: this is not guaranteed to run, for example when the program aborts.
pub unsafe fn cleanup() {}

pub fn unsupported<T>() -> std_io::Result<T> {
    Err(unsupported_err())
}

pub fn unsupported_err() -> std_io::Error {
    std_io::Error::UNSUPPORTED_PLATFORM
}

pub fn abort_internal() -> ! {
    core::intrinsics::abort_immediate();
}
