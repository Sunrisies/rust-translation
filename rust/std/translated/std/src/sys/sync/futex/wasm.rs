#[cfg(target_arch = "wasm32")]
use core::arch::wasm32 as wasm;
#[cfg(target_arch = "wasm64")]
use core::arch::wasm64 as wasm;

use crate::sync::atomic::Atomic;
use crate::time::Duration;

/// 用作 futex 的原子变量，至少为 32 位，但可能更大。
pub type Futex = Atomic<Primitive>;
/// 必须是 Futex 的基础类型。
pub type Primitive = u32;

/// 用作 futex 的原子变量，至少为 8 位，但可能更大。
pub type SmallFutex = Atomic<SmallPrimitive>;
/// 必须是 SmallFutex 的基础类型。
pub type SmallPrimitive = u32;

/// 等待 futex_wake 操作来唤醒我们。
///
/// 如果 futex 没有持有预期值，则直接返回。
///
/// 在超时情况下返回 false，在其他所有情况下返回 true。
pub fn futex_wait(futex: &Atomic<u32>, expected: u32, timeout: Option<Duration>) -> bool {
    let timeout = timeout.and_then(|t| t.as_nanos().try_into().ok()).unwrap_or(-1);
    unsafe {
        wasm::memory_atomic_wait32(
            futex as *const Atomic<u32> as *mut i32,
            expected as i32,
            timeout,
        ) < 2
    }
}

/// Wakes up one thread that's blocked on `futex_wait` on this futex.
///
/// 如果确实唤醒了这样的线程，则返回 true；
/// 如果没有线程在此 futex 上等待，则返回 false。
pub fn futex_wake(futex: &Atomic<u32>) -> bool {
    unsafe { wasm::memory_atomic_notify(futex as *const Atomic<u32> as *mut i32, 1) > 0 }
}

/// Wakes up all threads that are waiting on `futex_wait` on this futex.
pub fn futex_wake_all(futex: &Atomic<u32>) {
    unsafe {
        wasm::memory_atomic_notify(futex as *const Atomic<u32> as *mut i32, i32::MAX as u32);
    }
}
