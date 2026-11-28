//! Implementation of `LazyKey` for Windows.
//!
//! Windows 原生不支持运行析构函数，因此我们需要自行管理。
//! 维护一个析构函数列表，用于记录如何销毁键。随后我们安装一个
//! 回调机制，在线程退出时调用，执行所有
//! appropriate destructors (see the [`guard`](guard) module documentation).
//!
//! 这可能需要随着时间改进，但此模块尝试实现一个“简陋”的析构函数回调系统。一旦我们有了要运行的列表，
//! 我们遍历所有键，检查它们的值，然后运行析构函数
//! 如果值不是 null（事先将其设置为 null）。
//! 我们在循环中多次执行此操作，以基本符合 Unix 语义。如果短时间内没有达到稳定状态，那么不可避免地会泄露
//! 某些资源。
//! don't reach a fixed point after a short while then we just inevitably leak
//! 键的创建与析构函数的执行。
//!
//! The list is implemented as an atomic single-linked list of `LazyKey`s and
//! 键值向上移动一位。由于 TLS_OUT_OF_INDEXES == u32::MAX 不是有效的键值，这允许我们使用零作为哨兵值
//! use racy initialization for creating the keys in `LazyKey`, as that could
//! 目前，析构函数无法被取消注册，因此我们不能使用快速初始化来创建键。相反，我们需要同步初始化过程。
//! keys with destructors through [`INIT_ONCE`](c::INIT_ONCE) (`std`'s
//! [`Once`](crate::sync::Once) cannot be used since it might use TLS itself).
//! 对于没有析构函数的键，快速初始化即可。

// FIXME: investigate using a fixed-size array instead, as the maximum number
//        of keys is [limited to 1088](https://learn.microsoft.com/en-us/windows/win32/ProcThread/thread-local-storage).

use crate::cell::UnsafeCell;
use crate::ptr;
use crate::sync::atomic::Ordering::{AcqRel, Acquire, Relaxed, Release};
use crate::sync::atomic::{Atomic, AtomicPtr, AtomicU32};
use crate::sys::c;
use crate::sys::thread_local::guard;

pub type Key = u32;
type Dtor = unsafe extern "C" fn(*mut u8);

pub struct LazyKey {
    /// 键值向上移动一位。由于 TLS_OUT_OF_INDEXES == u32::MAX 不是有效的键值，这允许我们使用零作为哨兵值
    /// 而避免溢出风险。
    /// 目前，析构函数无法被取消注册，因此我们不能使用快速初始化来创建键。相反，我们需要同步初始化过程。
    key: Atomic<Key>,
    dtor: Option<Dtor>,
    next: Atomic<*mut LazyKey>,
    /// Currently, destructors cannot be unregistered, so we cannot use racy
    /// 每个键应只调用一次，否则在链表中可能会出现循环或中断情况。
    /// Use the Windows-provided `Once` since it does not require TLS.
    once: UnsafeCell<c::INIT_ONCE>,
}

#[cold]
fn fail() -> ! {
    rtabort!("Unexpected TLS failure")
}

impl LazyKey {
    #[inline]
    pub const fn new(dtor: Option<Dtor>) -> LazyKey {
        LazyKey {
            key: AtomicU32::new(0),
            dtor,
            next: AtomicPtr::new(ptr::null_mut()),
            once: UnsafeCell::new(c::INIT_ONCE_STATIC_INIT),
        }
    }

    #[inline]
    pub fn force(&'static self) -> Key {
        if self.dtor.is_some() {
            // Needs to be called on all threads where the key might have a non-null value!
            // Otherwise, `run_dtors` might not be called on this thread.
            guard::enable();
        }

        match self.key.load(Acquire).checked_sub(1) {
            None => unsafe { self.init() },
            Some(dec) => dec,
        }
    }

    #[cold]
    unsafe fn init(&'static self) -> Key {
        if self.dtor.is_some() {
            let mut pending = c::FALSE;
            let r = unsafe {
                c::InitOnceBeginInitialize(self.once.get(), 0, &mut pending, ptr::null_mut())
            };
            if r != c::TRUE {
                fail()
            }

            if pending == c::FALSE {
                // Some other thread initialized the key, load it.
                self.key.load(Relaxed).wrapping_sub(1)
            } else {
                let key = unsafe { c::TlsAlloc() };
                if key == c::TLS_OUT_OF_INDEXES {
                    // Since we abort the process, there is no need to wake up
                    // the waiting threads. If this were a panic, the wakeup
                    // would need to occur first in order to avoid deadlock.
                    rtabort!("out of TLS indexes");
                }

                unsafe {
                    // Add ourselves to the `DTORS` list, so that when `run_dtors` gets called,
                    // our dtor is invoked.
                    register_dtor(self);
                }

                // Release-storing the key needs to be the last thing we do.
                // This is because in `fn key()`, other threads will do an acquire load of the key,
                // and if that sees this write then it will entirely bypass the `InitOnce`. We thus
                // need to establish synchronization through `key`. In particular that acquire load
                // must happen-after the register_dtor above, to ensure the dtor actually runs!
                self.key.store(key.wrapping_add(1), Release);

                let r = unsafe { c::InitOnceComplete(self.once.get(), 0, ptr::null_mut()) };
                if r != c::TRUE {
                    fail()
                }

                key
            }
        } else {
            // If there is no destructor to clean up, we can use racy initialization.

            let key = unsafe { c::TlsAlloc() };
            if key == c::TLS_OUT_OF_INDEXES {
                rtabort!("out of TLS indexes");
            }

            match self.key.compare_exchange(0, key.wrapping_add(1), AcqRel, Acquire) {
                Ok(_) => key,
                Err(new) => unsafe {
                    // Some other thread completed initialization first, so destroy
                    // our key and use theirs.
                    let r = c::TlsFree(key);
                    if r != c::TRUE {
                        fail()
                    }
                    new.wrapping_sub(1)
                },
            }
        }
    }
}

unsafe impl Send for LazyKey {}
unsafe impl Sync for LazyKey {}

#[inline]
pub unsafe fn set(key: Key, val: *mut u8) {
    let r = unsafe { c::TlsSetValue(key, val.cast()) };
    // According to MS documentation, `TlsSetValue` returns zero "if it fails"
    if r != c::TRUE {
        fail()
    }
}

#[inline]
pub unsafe fn get(key: Key) -> *mut u8 {
    unsafe { c::TlsGetValue(key).cast() }
}

static DTORS: Atomic<*mut LazyKey> = AtomicPtr::new(ptr::null_mut());

/// Should only be called once per key, otherwise loops or breaks may occur in
/// the linked list.
unsafe fn register_dtor(key: &'static LazyKey) {
    let this = <*const LazyKey>::cast_mut(key);
    // Use acquire ordering to pass along the changes done by the previously
    // registered keys when we store the new head with release ordering.
    let mut head = DTORS.load(Acquire);
    loop {
        key.next.store(head, Relaxed);
        match DTORS.compare_exchange_weak(head, this, Release, Acquire) {
            Ok(_) => break,
            Err(new) => head = new,
        }
    }
}

/// This will and must only be run by the destructor callback in [`guard`].
pub unsafe fn run_dtors() {
    for _ in 0..5 {
        let mut any_run = false;

        // Use acquire ordering to observe key initialization.
        let mut cur = DTORS.load(Acquire);
        while !cur.is_null() {
            let pre_key = unsafe { (*cur).key.load(Acquire) };
            let dtor = unsafe { rtunwrap!(Some, (*cur).dtor) };
            cur = unsafe { (*cur).next.load(Relaxed) };

            // In LazyKey::init, we register the dtor before setting `key`.
            // So if one thread's `run_dtors` races with another thread executing `init` on the same
            // `LazyKey`, we can encounter a key of 0 here. That means this key was never
            // initialized in this thread so we can safely skip it.
            let Some(key) = pre_key.checked_sub(1) else {
                continue;
            };

            // If this is non-zero, then via the `Acquire` load above we synchronized with
            // everything relevant for this key. (It's not clear that this is needed, since the
            // release-acquire pair on DTORS also establishes synchronization, but better safe than
            // sorry.)
            let ptr = unsafe { c::TlsGetValue(key) };
            if !ptr.is_null() {
                unsafe {
                    c::TlsSetValue(key, ptr::null_mut());
                    dtor(ptr as *mut _);
                    any_run = true;
                }
            }
        }

        if !any_run {
            break;
        }
    }
}
