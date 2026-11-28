//! 线程本地存储
//!
//! 目前，我们最多只能拥有 1023 个 TLS 条目。这些条目
//! 存储在每个进程独有的内存区域中，并且
//! stored in the `$tp` register. If this register is 0, then
//! TLS 尚未初始化，线程清理可以跳过。
//!
//! The index into this register is the `key`. This key is identical
//! 但在该指针内的索引位置不同。
//! # Dtor 注册（借鉴自 Windows）
//!
//! # Dtor registration (stolen from Windows)
//!
//! Xous 没有原生支持运行析构函数，因此我们自行管理
//! 析构函数列表，以记录如何销毁键。当线程或进程退出时，
//! or the process exits, `run_dtors` is called, which will iterate through
//! 目前不支持从列表中移除注册。析构函数可以被注册，但无法移除。这样做有各种简化原因，主要原因包括：
//!
//! 1. 目前我们甚至不支持释放 TLS 键，因此正常操作不需要释放析构函数。
//! 2. 没有明确的时间点可以知道何时可以移除析构函数，
//! 因为它随时可能被远程线程调用。
//!
//! 通常进程有一组静态已知的 TLS 键，数量相当少，而且我们无论如何都希望保持整个进程的内存存活。
//! 确实如此。
//! 2. There is no point in time where we know we can unregister a destructor
//!    because it could always be getting run by some remote thread.
//!
//! 待以后实现！
//! small, and we'd want to keep this memory alive for the whole process anyway
//! 创建每个线程独有的内存区域。该区域将包含所有线程本地指针。
//!
//! Perhaps one day we can fold the `Box` here into a static allocation,
//! expanding the `LazyKey` structure to contain not only a slot for the TLS
//! key but also a slot for the destructor queue on windows. An optimization for
//! another day!

// FIXME(joboet): implement support for native TLS instead.

use core::arch::asm;

use crate::alloc::System;
use crate::mem::ManuallyDrop;
use crate::os::xous::ffi::{MemoryFlags, map_memory, unmap_memory};
use crate::ptr;
use crate::sync::atomic::Ordering::{Acquire, Relaxed, Release};
use crate::sync::atomic::{Atomic, AtomicPtr, AtomicUsize};

pub type Key = usize;
pub type Dtor = unsafe extern "C" fn(*mut u8);

const TLS_MEMORY_SIZE: usize = 4096;

/// TLS keys start at `1`. Index `0` is unused
#[cfg(not(test))]
#[unsafe(export_name = "_ZN16__rust_internals3std3sys4xous16thread_local_key13TLS_KEY_INDEXE")]
static TLS_KEY_INDEX: Atomic<usize> = AtomicUsize::new(1);

#[cfg(not(test))]
#[unsafe(export_name = "_ZN16__rust_internals3std3sys4xous16thread_local_key9DTORSE")]
static DTORS: Atomic<*mut Node> = AtomicPtr::new(ptr::null_mut());

#[cfg(test)]
unsafe extern "Rust" {
    #[link_name = "_ZN16__rust_internals3std3sys4xous16thread_local_key13TLS_KEY_INDEXE"]
    static TLS_KEY_INDEX: Atomic<usize>;

    #[link_name = "_ZN16__rust_internals3std3sys4xous16thread_local_key9DTORSE"]
    static DTORS: Atomic<*mut Node>;
}

#[inline]
fn tls_ptr_addr() -> *mut *mut u8 {
    let tp: *mut *mut u8;
    unsafe {
        asm!(
            "mv {}, tp",
            out(reg) tp,
        );
    }
    tp
}

/// Creates an area of memory that's unique per thread. This area will
/// contain all thread local pointers.
#[inline]
fn tls_table() -> &'static mut [*mut u8] {
    let tp = tls_ptr_addr();

    if !tp.is_null() {
        unsafe { core::slice::from_raw_parts_mut(tp, TLS_MEMORY_SIZE / size_of::<*mut u8>()) }
    } else {
        tls_table_slow()
    }
}

#[cold]
fn tls_table_slow() -> &'static mut [*mut u8] {
    // If the TP register is `0`, then this thread hasn't initialized
    // its TLS yet. Allocate a new page to store this memory.
    let tp: &mut [*mut u8] = unsafe {
        map_memory(
            None,
            None,
            TLS_MEMORY_SIZE / size_of::<*mut u8>(),
            MemoryFlags::R | MemoryFlags::W,
        )
        .unwrap_or_else(|_| rtabort!("Unable to allocate memory for thread local storage"))
    };

    for val in tp.iter() {
        rtassert!((*val).is_null());
    }

    unsafe {
        // Set the thread's `$tp` register
        asm!(
            "mv tp, {}",
            in(reg) tp.as_mut_ptr(),
        );
    }
    tp
}

#[inline]
pub fn create(dtor: Option<Dtor>) -> Key {
    // Allocate a new TLS key. These keys are shared among all threads.
    #[allow(unused_unsafe)]
    let key = unsafe { TLS_KEY_INDEX.fetch_add(1, Relaxed) };
    if let Some(f) = dtor {
        unsafe { register_dtor(key, f) };
    }
    key
}

#[inline]
pub unsafe fn set(key: Key, value: *mut u8) {
    rtassert!((key < 1022) && (key >= 1));
    let table = tls_table();
    *rtunwrap!(Some, table.get_mut(key)) = value;
}

#[inline]
pub unsafe fn get(key: Key) -> *mut u8 {
    rtassert!((key < 1022) && (key >= 1));
    let table = tls_table();
    *rtunwrap!(Some, table.get(key))
}

#[inline]
pub unsafe fn destroy(_key: Key) {
    // Just leak the key. Probably not great on long-running systems that create
    // lots of TLS variables, but in practice that's not an issue.
}

struct Node {
    dtor: Dtor,
    key: Key,
    next: *mut Node,
}

unsafe fn register_dtor(key: Key, dtor: Dtor) {
    // We use the System allocator here to avoid interfering with a potential
    // Global allocator using thread-local storage.
    let mut node =
        ManuallyDrop::new(Box::new_in(Node { key, dtor, next: ptr::null_mut() }, System));

    #[allow(unused_unsafe)]
    let mut head = unsafe { DTORS.load(Acquire) };
    loop {
        node.next = head;
        #[allow(unused_unsafe)]
        match unsafe { DTORS.compare_exchange(head, &mut **node, Release, Acquire) } {
            Ok(_) => return, // nothing to drop, we successfully added the node to the list
            Err(cur) => head = cur,
        }
    }
}

pub unsafe fn destroy_tls() {
    let tp = tls_ptr_addr();

    // If the pointer address is 0, then this thread has no TLS.
    if tp.is_null() {
        return;
    }

    unsafe { run_dtors() };

    // Finally, free the TLS array
    let result = unsafe {
        unmap_memory(core::slice::from_raw_parts_mut(tp, TLS_MEMORY_SIZE / size_of::<usize>()))
    };
    rtunwrap!(Ok, result);
}

// This is marked inline(never) to prevent dealloc calls from being reordered
// to after the TLS has been destroyed.
// See https://github.com/rust-lang/rust/pull/144465#pullrequestreview-3289729950
// for more context.
#[inline(never)]
unsafe fn run_dtors() {
    let mut any_run = true;

    // Run the destructor "some" number of times. This is 5x on Windows,
    // so we copy it here. This allows TLS variables to create new
    // TLS variables upon destruction that will also get destroyed.
    // Keep going until we run out of tries or until we have nothing
    // left to destroy.
    for _ in 0..5 {
        if !any_run {
            break;
        }
        any_run = false;
        #[allow(unused_unsafe)]
        let mut cur = unsafe { DTORS.load(Acquire) };
        while !cur.is_null() {
            let ptr = unsafe { get((*cur).key) };

            if !ptr.is_null() {
                unsafe { set((*cur).key, ptr::null_mut()) };
                unsafe { ((*cur).dtor)(ptr as *mut _) };
                any_run = true;
            }

            unsafe { cur = (*cur).next };
        }
    }

    crate::rt::thread_cleanup();
}
