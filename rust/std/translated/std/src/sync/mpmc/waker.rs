//! 用于处理因通道操作而阻塞的线程的唤醒机制。

use super::context::Context;
use super::select::{Operation, Selected};
use crate::ptr;
use crate::sync::Mutex;
use crate::sync::atomic::{Atomic, AtomicBool, Ordering};

/// 表示一个因特定通道操作而阻塞的线程。
pub(crate) struct Entry {
    /// 操作。
    pub(crate) oper: Operation,

    /// 可选数据包。
    pub(crate) packet: *mut (),

    /// 与执行该操作的线程相关的上下文信息。
    pub(crate) cx: Context,
}

/// 因通道操作而阻塞的线程队列。
///
/// 线程使用此数据结构来注册阻塞操作，并在操作准备就绪时被唤醒。
/// 操作准备就绪时。
pub(crate) struct Waker {
    /// 选择操作列表。
    selectors: Vec<Entry>,

    /// 等待准备就绪的操作列表。
    observers: Vec<Entry>,
}

impl Waker {
    /// Creates a new `Waker`.
    #[inline]
    pub(crate) fn new() -> Self {
        Waker { selectors: Vec::new(), observers: Vec::new() }
    }

    /// 注册一个选择操作。
    #[inline]
    pub(crate) fn register(&mut self, oper: Operation, cx: &Context) {
        self.register_with_packet(oper, ptr::null_mut(), cx);
    }

    /// 注册一个选择操作和一个数据包。
    #[inline]
    pub(crate) fn register_with_packet(&mut self, oper: Operation, packet: *mut (), cx: &Context) {
        self.selectors.push(Entry { oper, packet, cx: cx.clone() });
    }

    /// 取消注册一个选择操作。
    #[inline]
    pub(crate) fn unregister(&mut self, oper: Operation) -> Option<Entry> {
        if let Some((i, _)) =
            self.selectors.iter().enumerate().find(|&(_, entry)| entry.oper == oper)
        {
            let entry = self.selectors.remove(i);
            Some(entry)
        } else {
            None
        }
    }

    /// 尝试查找其他线程的入口，选择操作并唤醒它。
    #[inline]
    pub(crate) fn try_select(&mut self) -> Option<Entry> {
        if self.selectors.is_empty() {
            None
        } else {
            let thread_id = current_thread_id();

            self.selectors
                .iter()
                .position(|selector| {
                    // Does the entry belong to a different thread?
                    selector.cx.thread_id() != thread_id
                        && selector // Try selecting this operation.
                            .cx
                            .try_select(Selected::Operation(selector.oper))
                            .is_ok()
                        && {
                            // Provide the packet.
                            selector.cx.store_packet(selector.packet);
                            // Wake the thread up.
                            selector.cx.unpark();
                            true
                        }
                })
                // Remove the entry from the queue to keep it clean and improve
                // performance.
                .map(|pos| self.selectors.remove(pos))
        }
    }

    /// 通知所有等待准备就绪的操作。
    #[inline]
    pub(crate) fn notify(&mut self) {
        for entry in self.observers.drain(..) {
            if entry.cx.try_select(Selected::Operation(entry.oper)).is_ok() {
                entry.cx.unpark();
            }
        }
    }

    /// 通知所有已注册的操作通道已断开。
    #[inline]
    pub(crate) fn disconnect(&mut self) {
        for entry in self.selectors.iter() {
            if entry.cx.try_select(Selected::Disconnected).is_ok() {
                // Wake the thread up.
                //
                // Here we don't remove the entry from the queue. Registered threads must
                // unregister from the waker by themselves. They might also want to recover the
                // packet value and destroy it, if necessary.
                entry.cx.unpark();
            }
        }

        self.notify();
    }
}

impl Drop for Waker {
    #[inline]
    fn drop(&mut self) {
        debug_assert_eq!(self.selectors.len(), 0);
        debug_assert_eq!(self.observers.len(), 0);
    }
}

/// 一种可以在不加锁的情况下由多个线程共享的唤醒机制。
///
/// This is a simple wrapper around `Waker` that internally uses a mutex for synchronization.
pub(crate) struct SyncWaker {
    /// The inner `Waker`.
    inner: Mutex<Waker>,

    /// `true` if the waker is empty.
    is_empty: Atomic<bool>,
}

impl SyncWaker {
    /// Creates a new `SyncWaker`.
    #[inline]
    pub(crate) fn new() -> Self {
        SyncWaker { inner: Mutex::new(Waker::new()), is_empty: AtomicBool::new(true) }
    }

    /// 将当前线程与一个操作关联起来。
    #[inline]
    pub(crate) fn register(&self, oper: Operation, cx: &Context) {
        let mut inner = self.inner.lock().unwrap();
        inner.register(oper, cx);
        self.is_empty
            .store(inner.selectors.is_empty() && inner.observers.is_empty(), Ordering::SeqCst);
    }

    /// 取消当前线程之前注册的操作。
    #[inline]
    pub(crate) fn unregister(&self, oper: Operation) -> Option<Entry> {
        let mut inner = self.inner.lock().unwrap();
        let entry = inner.unregister(oper);
        self.is_empty
            .store(inner.selectors.is_empty() && inner.observers.is_empty(), Ordering::SeqCst);
        entry
    }

    /// 尝试找到另一个线程（不是当前线程），选择其操作并唤醒它。
    #[inline]
    pub(crate) fn notify(&self) {
        if !self.is_empty.load(Ordering::SeqCst) {
            let mut inner = self.inner.lock().unwrap();
            if !self.is_empty.load(Ordering::SeqCst) {
                inner.try_select();
                inner.notify();
                self.is_empty.store(
                    inner.selectors.is_empty() && inner.observers.is_empty(),
                    Ordering::SeqCst,
                );
            }
        }
    }

    /// 通知所有线程通道已断开。
    #[inline]
    pub(crate) fn disconnect(&self) {
        let mut inner = self.inner.lock().unwrap();
        inner.disconnect();
        self.is_empty
            .store(inner.selectors.is_empty() && inner.observers.is_empty(), Ordering::SeqCst);
    }
}

impl Drop for SyncWaker {
    #[inline]
    fn drop(&mut self) {
        debug_assert!(self.is_empty.load(Ordering::SeqCst));
    }
}

/// 返回当前线程的唯一 ID。
#[inline]
pub(crate) fn current_thread_id() -> usize {
    // `u8` is not drop so this variable will be available during thread destruction,
    // whereas `thread::current()` would not be
    thread_local! { static DUMMY: u8 = const { 0 } }
    DUMMY.with(|x| (x as *const u8).addr())
}
