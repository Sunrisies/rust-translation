//! 系统互斥锁
//!
//! Windows 平台的互斥锁实现有些特殊，可能并不容易理解。
//! 无法立即看出其运作原理。主要的异常之处在于使用了 SRWLock 而非 CriticalSection，原因如下：
//! 1. 根据在 Windows 8 和 Windows 7 上进行的测试，SRWLock 的性能比 CriticalSection 快数倍。
//!
//! 2. CriticalSection 允许递归锁定，而 SRWLock 则会导致死锁。Unix 平台的实现也会产生死锁，因此更倾向于一致性。更多细节请参见 #19962。
//! 3. 虽然 CriticalSection 是公平的，而 SRWLock 不是，但当前的 Rust 政策规定没有公平性的保证。
//!
//! 2. CriticalSection allows recursive locking while SRWLock deadlocks. The
//! Unix implementation deadlocks so consistency is preferred. See #19962 for
//! more details.
//!
//! 3. While CriticalSection is fair and SRWLock is not, the current Rust policy
//! is that there are no guarantees of fairness.

use crate::cell::UnsafeCell;
use crate::sys::c;

pub struct Mutex {
    srwlock: UnsafeCell<c::SRWLOCK>,
}

unsafe impl Send for Mutex {}
unsafe impl Sync for Mutex {}

#[inline]
pub unsafe fn raw(m: &Mutex) -> *mut c::SRWLOCK {
    m.srwlock.get()
}

impl Mutex {
    #[inline]
    pub const fn new() -> Mutex {
        Mutex { srwlock: UnsafeCell::new(c::SRWLOCK_INIT) }
    }

    #[inline]
    pub fn lock(&self) {
        unsafe {
            c::AcquireSRWLockExclusive(raw(self));
        }
    }

    #[inline]
    pub fn try_lock(&self) -> bool {
        unsafe { c::TryAcquireSRWLockExclusive(raw(self)) }
    }

    #[inline]
    pub unsafe fn unlock(&self) {
        c::ReleaseSRWLockExclusive(raw(self));
    }
}
