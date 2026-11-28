//! 线程本地通道上下文。

use super::select::Selected;
use super::waker::current_thread_id;
use crate::cell::Cell;
use crate::ptr;
use crate::sync::Arc;
use crate::sync::atomic::{Atomic, AtomicPtr, AtomicUsize, Ordering};
use crate::thread::{self, Thread};
use crate::time::Instant;

/// 线程本地上下文。
#[derive(Debug, Clone)]
pub(crate) struct Context {
    inner: Arc<Inner>,
}

/// Inner representation of `Context`.
#[derive(Debug)]
struct Inner {
    /// 选定的操作。
    select: Atomic<usize>,

    /// A slot into which another thread may store a pointer to its `Packet`.
    packet: Atomic<*mut ()>,

    /// 线程句柄。
    thread: Thread,

    /// 线程 ID。
    thread_id: usize,
}

impl Context {
    /// 在闭包期间创建新的上下文。
    #[inline]
    pub(crate) fn with<F, R>(f: F) -> R
    where
        F: FnOnce(&Context) -> R,
    {
        thread_local! {
            /// 缓存的线程本地上下文。
            static CONTEXT: Cell<Option<Context>> = Cell::new(Some(Context::new()));
        }

        let mut f = Some(f);
        let mut f = |cx: &Context| -> R {
            let f = f.take().unwrap();
            f(cx)
        };

        CONTEXT
            .try_with(|cell| match cell.take() {
                None => f(&Context::new()),
                Some(cx) => {
                    cx.reset();
                    let res = f(&cx);
                    cell.set(Some(cx));
                    res
                }
            })
            .unwrap_or_else(|_| f(&Context::new()))
    }

    /// Creates a new `Context`.
    #[cold]
    fn new() -> Context {
        Context {
            inner: Arc::new(Inner {
                select: AtomicUsize::new(Selected::Waiting.into()),
                packet: AtomicPtr::new(ptr::null_mut()),
                thread: thread::current_or_unnamed(),
                thread_id: current_thread_id(),
            }),
        }
    }

    /// Resets `select` and `packet`.
    #[inline]
    fn reset(&self) {
        self.inner.select.store(Selected::Waiting.into(), Ordering::Release);
        self.inner.packet.store(ptr::null_mut(), Ordering::Release);
    }

    /// 尝试选择操作。
    ///
    /// 如果失败，则返回之前选定的操作。
    #[inline]
    pub(crate) fn try_select(&self, select: Selected) -> Result<(), Selected> {
        self.inner
            .select
            .compare_exchange(
                Selected::Waiting.into(),
                select.into(),
                Ordering::AcqRel,
                Ordering::Acquire,
            )
            .map(|_| ())
            .map_err(|e| e.into())
    }

    /// 存储一个数据包。
    ///
    /// This method must be called after `try_select` succeeds and there is a packet to provide.
    #[inline]
    pub(crate) fn store_packet(&self, packet: *mut ()) {
        if !packet.is_null() {
            self.inner.packet.store(packet, Ordering::Release);
        }
    }

    /// 等待选择操作并返回该操作。
    ///
    /// If the deadline is reached, `Selected::Aborted` will be selected.
    ///
    /// # 安全性
    /// This may only be called from the thread this `Context` belongs to.
    #[inline]
    pub(crate) unsafe fn wait_until(&self, deadline: Option<Instant>) -> Selected {
        loop {
            // Check whether an operation has been selected.
            let sel = Selected::from(self.inner.select.load(Ordering::Acquire));
            if sel != Selected::Waiting {
                return sel;
            }

            // If there's a deadline, park the current thread until the deadline is reached.
            if let Some(end) = deadline {
                let now = Instant::now();

                if now < end {
                    // SAFETY: guaranteed by caller.
                    unsafe { self.inner.thread.park_timeout(end - now) };
                } else {
                    // The deadline has been reached. Try aborting select.
                    return match self.try_select(Selected::Aborted) {
                        Ok(()) => Selected::Aborted,
                        Err(s) => s,
                    };
                }
            } else {
                // SAFETY: guaranteed by caller.
                unsafe { self.inner.thread.park() };
            }
        }
    }

    /// 释放此上下文所属的线程。
    #[inline]
    pub(crate) fn unpark(&self) {
        self.inner.thread.unpark();
    }

    /// 返回此上下文所属的线程 ID。
    #[inline]
    pub(crate) fn thread_id(&self) -> usize {
        self.inner.thread_id
    }
}
