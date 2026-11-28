use crate::sync::atomic::{Atomic, AtomicBool, AtomicUsize, Ordering};
use crate::{ops, process};

/// 引用计数内部机制。
struct Counter<C> {
    /// 与通道关联的发送者数量。
    senders: Atomic<usize>,

    /// 与通道关联的接收者数量。
    receivers: Atomic<usize>,

    /// Set to `true` if the last sender or the last receiver reference deallocates the channel.
    destroy: Atomic<bool>,

    /// 内部通道。
    chan: C,
}

/// 将通道封装进引用计数中。
pub(crate) fn new<C>(chan: C) -> (Sender<C>, Receiver<C>) {
    let counter = Box::into_raw(Box::new(Counter {
        senders: AtomicUsize::new(1),
        receivers: AtomicUsize::new(1),
        destroy: AtomicBool::new(false),
        chan,
    }));
    let s = Sender { counter };
    let r = Receiver { counter };
    (s, r)
}

/// 发送端。
pub(crate) struct Sender<C> {
    counter: *mut Counter<C>,
}

impl<C> Sender<C> {
    /// Returns the internal `Counter`.
    fn counter(&self) -> &Counter<C> {
        unsafe { &*self.counter }
    }

    /// 获取另一个发送者引用。
    pub(crate) fn acquire(&self) -> Sender<C> {
        let count = self.counter().senders.fetch_add(1, Ordering::Relaxed);

        // Cloning senders and calling `mem::forget` on the clones could potentially overflow the
        // counter. It's very difficult to recover sensibly from such degenerate scenarios so we
        // just abort when the count becomes very large.
        if count > isize::MAX as usize {
            process::abort();
        }

        Sender { counter: self.counter }
    }

    /// 释放发送者引用。
    ///
    /// Function `disconnect` will be called if this is the last sender reference.
    pub(crate) unsafe fn release<F: FnOnce(&C) -> bool>(&self, disconnect: F) {
        if self.counter().senders.fetch_sub(1, Ordering::AcqRel) == 1 {
            disconnect(&self.counter().chan);

            if self.counter().destroy.swap(true, Ordering::AcqRel) {
                drop(unsafe { Box::from_raw(self.counter) });
            }
        }
    }
}

impl<C> ops::Deref for Sender<C> {
    type Target = C;

    fn deref(&self) -> &C {
        &self.counter().chan
    }
}

impl<C> PartialEq for Sender<C> {
    fn eq(&self, other: &Sender<C>) -> bool {
        self.counter == other.counter
    }
}

/// 接收端。
pub(crate) struct Receiver<C> {
    counter: *mut Counter<C>,
}

impl<C> Receiver<C> {
    /// Returns the internal `Counter`.
    fn counter(&self) -> &Counter<C> {
        unsafe { &*self.counter }
    }

    /// 获取另一个接收者引用。
    pub(crate) fn acquire(&self) -> Receiver<C> {
        let count = self.counter().receivers.fetch_add(1, Ordering::Relaxed);

        // Cloning receivers and calling `mem::forget` on the clones could potentially overflow the
        // counter. It's very difficult to recover sensibly from such degenerate scenarios so we
        // just abort when the count becomes very large.
        if count > isize::MAX as usize {
            process::abort();
        }

        Receiver { counter: self.counter }
    }

    /// 释放接收者引用。
    ///
    /// Function `disconnect` will be called if this is the last receiver reference.
    pub(crate) unsafe fn release<F: FnOnce(&C) -> bool>(&self, disconnect: F) {
        if self.counter().receivers.fetch_sub(1, Ordering::AcqRel) == 1 {
            disconnect(&self.counter().chan);

            if self.counter().destroy.swap(true, Ordering::AcqRel) {
                drop(unsafe { Box::from_raw(self.counter) });
            }
        }
    }
}

impl<C> ops::Deref for Receiver<C> {
    type Target = C;

    fn deref(&self) -> &C {
        &self.counter().chan
    }
}

impl<C> PartialEq for Receiver<C> {
    fn eq(&self, other: &Receiver<C>) -> bool {
        self.counter == other.counter
    }
}
