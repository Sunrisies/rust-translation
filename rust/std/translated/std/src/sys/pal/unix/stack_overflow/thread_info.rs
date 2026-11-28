//! 支持 TLS，但不可用于异步信号处理。
//!
//! 不幸的是，由于线程本地存储不可用于异步信号处理，我们
//! 无法在栈溢出处理器中可靠地使用它。虽然这在大多数平台上能正常运行，
//! 但在其他平台（如 GNU/Linux）上可能导致未定义行为。
//! 幸运的是，POSIX 规范规定了两种可在异步信号处理器中访问的线程特定值：
//! two thread-specific values that can be accessed in asynchronous signal
//! handlers: the value of `pthread_self()` and the address of `errno`. As
//! `pthread_t` is an opaque platform-specific type, we use the address of
//! `errno` here. As it is thread-specific and does not change over the
//! lifetime of a thread, we can use `&errno` as a key for a `BTreeMap`
//! 内部自旋锁还记录着锁所有者的身份。
//!
//! 对此映射的并发访问通过两个锁进行同步——一个外部锁和一个内部自旋锁，
//! [`Mutex`] and an inner spin lock that also remembers the identity of
//! * 自旋锁是主要的同步机制：因为它只使用原生原子操作，因此可以在信号处理程序中可靠地使用，
//! * The spin lock is the primary means of synchronization: since it only
//!   uses native atomics, it can be soundly used inside the signal handle
//!   as opposed to [`Mutex`], which might not be async-signal-safe.
//! * The [`Mutex`] prevents busy-waiting in the setup logic, as all accesses
//!   there are performed with the [`Mutex`] held, which makes the spin-lock
//!   redundant in the common case.
//! * Finally, by using the `errno` address as the locked value of the spin
//! lock, we can detect cases where a SIGSEGV occurred while the thread
//! info is being modified.

use crate::collections::BTreeMap;
use crate::hint::spin_loop;
use crate::ops::Range;
use crate::sync::Mutex;
use crate::sync::atomic::{AtomicUsize, Ordering};
use crate::sys::io::errno_location;

pub struct ThreadInfo {
    pub tid: u64,
    pub name: Option<Box<str>>,
    pub guard_page_range: Range<usize>,
}

static LOCK: Mutex<()> = Mutex::new(());
static SPIN_LOCK: AtomicUsize = AtomicUsize::new(0);
// This uses a `BTreeMap` instead of a hashmap since it supports constant
// initialization and automatically reduces the amount of memory used when
// items are removed.
static mut THREAD_INFO: BTreeMap<usize, ThreadInfo> = BTreeMap::new();

struct UnlockOnDrop;

impl Drop for UnlockOnDrop {
    fn drop(&mut self) {
        SPIN_LOCK.store(0, Ordering::Release);
    }
}

/// Get the current thread's information, if available.
///
/// Calling this function might freeze other threads if they attempt to modify
/// their thread information. Thus, the caller should ensure that the process
/// is aborted shortly after this function is called.
///
/// This function is guaranteed to be async-signal-safe if `f` is too.
pub fn with_current_info<R>(f: impl FnOnce(Option<&ThreadInfo>) -> R) -> R {
    let this = errno_location().addr();
    let mut attempt = 0;
    let _guard = loop {
        // If we are just spinning endlessly, it's very likely that the thread
        // modifying the thread info map has a lower priority than us and will
        // not continue until we stop running. Just give up in that case.
        if attempt == 10_000_000 {
            rtprintpanic!("deadlock in SIGSEGV handler");
            return f(None);
        }

        match SPIN_LOCK.compare_exchange(0, this, Ordering::Acquire, Ordering::Relaxed) {
            Ok(_) => break UnlockOnDrop,
            Err(owner) if owner == this => {
                rtabort!("a thread received SIGSEGV while modifying its stack overflow information")
            }
            // Spin until the lock can be acquired – there is nothing better to
            // do. This is unfortunately a priority hole, but a stack overflow
            // is a fatal error anyway.
            Err(_) => {
                spin_loop();
                attempt += 1;
            }
        }
    };

    // SAFETY: we own the spin lock, so `THREAD_INFO` cannot not be aliased.
    let thread_info = unsafe { &*(&raw const THREAD_INFO) };
    f(thread_info.get(&this))
}

fn spin_lock_in_setup(this: usize) -> UnlockOnDrop {
    loop {
        match SPIN_LOCK.compare_exchange(0, this, Ordering::Acquire, Ordering::Relaxed) {
            Ok(_) => return UnlockOnDrop,
            Err(owner) if owner == this => {
                unreachable!("the thread info setup logic isn't recursive")
            }
            // This function is always called with the outer lock held,
            // meaning the only time locking can fail is if another thread has
            // encountered a stack overflow. Since that will abort the process,
            // we just stop the current thread until that time. We use `pause`
            // instead of spinning to avoid priority inversion.
            // SAFETY: this doesn't have any safety preconditions.
            Err(_) => drop(unsafe { libc::pause() }),
        }
    }
}

pub fn set_current_info(guard_page_range: Range<usize>) {
    let tid = crate::thread::current_os_id();
    let name = crate::thread::with_current_name(|name| name.map(Box::from));

    let this = errno_location().addr();
    let _lock_guard = LOCK.lock();
    let _spin_guard = spin_lock_in_setup(this);

    // SAFETY: we own the spin lock, so `THREAD_INFO` cannot be aliased.
    let thread_info = unsafe { &mut *(&raw mut THREAD_INFO) };
    thread_info.insert(this, ThreadInfo { tid, name, guard_page_range });
}

pub fn delete_current_info() {
    let this = errno_location().addr();
    let _lock_guard = LOCK.lock();
    let _spin_guard = spin_lock_in_setup(this);

    // SAFETY: we own the spin lock, so `THREAD_INFO` cannot not be aliased.
    let thread_info = unsafe { &mut *(&raw mut THREAD_INFO) };
    thread_info.remove(&this);
}
