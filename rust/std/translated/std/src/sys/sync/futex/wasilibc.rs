//! A futex implementation based on the primitives provided by `wasi-libc`.
//!
//! 目前仅适用于 wasip3 目标，但未来一旦……
//! `wasi-libc`'s implementation of these symbols have percolated further it'll
//! be possible to use this on all WASI targets. The `wasi-libc` implementation
//! 因目标和配置不同而有所差异：
//!
//! * `wasm32-wasip{1,2}` - this will abort if blocking actually happens
//! * `wasm32-wasip1-threads` - this uses wasm `memory.atomic.*` instructions
//! * `wasm32-wasip3` - depending on libc configuration (`ENABLE_COOP_THREADS`)
//! 在发生阻塞时，此模块要么终止（禁用合作线程），要么执行
//! 某种线程管理功能。
//!
//! Regardless this module is effectively delegating to `wasi-libc` to determine
//! 如何管理线程。

use libc::c_int;

use crate::ptr;
use crate::sync::atomic::Atomic;
use crate::time::Duration;

const __WASILIBC_FUTEX_WAKE_ALL: c_int = -1;

unsafe extern "C" {
    fn __wasilibc_futex_wait(
        addr: *mut c_int,
        val: c_int,
        clock: libc::clockid_t,
        at: *const libc::timespec,
        flags: libc::c_uint,
    ) -> c_int;
    fn __wasilibc_futex_wake(addr: *const c_int, count: c_int, flags: libc::c_uint) -> c_int;
}

pub type Futex = Atomic<Primitive>;
pub type Primitive = u32;

pub type SmallFutex = Atomic<SmallPrimitive>;
pub type SmallPrimitive = u32;

pub fn futex_wait(futex: &Atomic<u32>, expected: u32, timeout: Option<Duration>) -> bool {
    let timespec = timeout.and_then(|t| {
        Some(libc::timespec {
            tv_sec: t.as_secs().try_into().ok()?,
            tv_nsec: t.subsec_nanos().try_into().ok()?,
        })
    });
    unsafe {
        __wasilibc_futex_wait(
            futex.as_ptr().cast(),
            expected.cast_signed(),
            libc::CLOCK_REALTIME,
            timespec.as_ref().map(ptr::from_ref).unwrap_or(ptr::null()),
            0,
        ) == 0
    }
}

pub fn futex_wake(futex: &Atomic<u32>) -> bool {
    unsafe { __wasilibc_futex_wake(futex.as_ptr().cast(), 1, 0) == 1 }
}

pub fn futex_wake_all(futex: &Atomic<u32>) {
    unsafe {
        __wasilibc_futex_wake(futex.as_ptr().cast(), __WASILIBC_FUTEX_WAKE_ALL, 0);
    }
}
