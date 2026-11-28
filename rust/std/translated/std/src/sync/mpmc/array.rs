//! 基于预分配数组的有界通道。
//!
//! 此版本具有固定的正容量。
//!
//! 实现基于 Dmitry Vyukov 的有界 MPMC 队列。
//!
//! 来源：
//!   - <http://www.1024cores.net/home/lock-free-algorithms/queues/bounded-mpmc-queue>
//!   - <https://docs.google.com/document/d/1yIAYmbvL3JxOKOjuCyon7JhW4cSv1wy5hC0ApeGMV9s/pub>

use super::context::Context;
use super::error::*;
use super::select::{Operation, Selected, Token};
use super::utils::{Backoff, CachePadded};
use super::waker::SyncWaker;
use crate::cell::UnsafeCell;
use crate::mem::MaybeUninit;
use crate::ptr;
use crate::sync::atomic::{self, Atomic, AtomicUsize, Ordering};
use crate::time::Instant;

/// 通道中的一个槽位。
struct Slot<T> {
    /// 当前时间戳。
    stamp: Atomic<usize>,

    /// The message in this slot. Either read out in `read` or dropped through
    /// `discard_all_messages`.
    msg: UnsafeCell<MaybeUninit<T>>,
}

/// 数组版本的令牌类型。
#[derive(Debug)]
pub(crate) struct ArrayToken {
    /// 用于读取或写入的槽位。
    slot: *const u8,

    /// 读取或写入后存储到槽位中的时间戳。
    stamp: usize,
}

impl Default for ArrayToken {
    #[inline]
    fn default() -> Self {
        ArrayToken { slot: ptr::null(), stamp: 0 }
    }
}

/// 基于预分配数组的有界通道。
pub(crate) struct Channel<T> {
    /// 通道的头部。
    ///
    /// 该值是一个“时间戳”，包含对缓冲区的索引、标记位和轮数，但
    /// packed into a single `usize`. The lower bits represent the index, while the upper bits
    /// 消息从通道头部被弹出。
    ///
    /// 通道的尾部。
    head: CachePadded<Atomic<usize>>,

    /// 该值是一个“时间戳”，包含对缓冲区的索引、标记位和轮数，但
    ///
    /// This value is a "stamp" consisting of an index into the buffer, a mark bit, and a lap, but
    /// packed into a single `usize`. The lower bits represent the index, while the upper bits
    /// 消息被推入通道尾部。
    ///
    /// 持有槽位的缓冲区。
    tail: CachePadded<Atomic<usize>>,

    /// 通道的容量。
    buffer: Box<[Slot<T>]>,

    /// 通道的容量。
    cap: usize,

    /// A stamp with the value of `{ lap: 1, mark: 0, index: 0 }`.
    one_lap: usize,

    /// 如果尾部设置了该位，说明通道已断开。
    mark_bit: usize,

    /// 等待发送者在通道满时等待。
    senders: SyncWaker,

    /// 接收者在通道为空且未断开时等待。
    receivers: SyncWaker,
}

impl<T> Channel<T> {
    /// Creates a bounded channel of capacity `cap`.
    pub(crate) fn with_capacity(cap: usize) -> Self {
        assert!(cap > 0, "capacity must be positive");

        // Compute constants `mark_bit` and `one_lap`.
        let mark_bit = (cap + 1).next_power_of_two();
        let one_lap = mark_bit * 2;

        // Head is initialized to `{ lap: 0, mark: 0, index: 0 }`.
        let head = 0;
        // Tail is initialized to `{ lap: 0, mark: 0, index: 0 }`.
        let tail = 0;

        // Allocate a buffer of `cap` slots initialized
        // with stamps.
        let buffer: Box<[Slot<T>]> = (0..cap)
            .map(|i| {
                // Set the stamp to `{ lap: 0, mark: 0, index: i }`.
                Slot { stamp: AtomicUsize::new(i), msg: UnsafeCell::new(MaybeUninit::uninit()) }
            })
            .collect();

        Channel {
            buffer,
            cap,
            one_lap,
            mark_bit,
            head: CachePadded::new(AtomicUsize::new(head)),
            tail: CachePadded::new(AtomicUsize::new(tail)),
            senders: SyncWaker::new(),
            receivers: SyncWaker::new(),
        }
    }

    /// 尝试为发送消息预留一个槽位。
    fn start_send(&self, token: &mut Token) -> bool {
        let backoff = Backoff::new();
        let mut tail = self.tail.load(Ordering::Relaxed);

        loop {
            // Check if the channel is disconnected.
            if tail & self.mark_bit != 0 {
                token.array.slot = ptr::null();
                token.array.stamp = 0;
                return true;
            }

            // Deconstruct the tail.
            let index = tail & (self.mark_bit - 1);
            let lap = tail & !(self.one_lap - 1);

            // Inspect the corresponding slot.
            debug_assert!(index < self.buffer.len());
            let slot = unsafe { self.buffer.get_unchecked(index) };
            let stamp = slot.stamp.load(Ordering::Acquire);

            // If the tail and the stamp match, we may attempt to push.
            if tail == stamp {
                let new_tail = if index + 1 < self.cap {
                    // Same lap, incremented index.
                    // Set to `{ lap: lap, mark: 0, index: index + 1 }`.
                    tail + 1
                } else {
                    // One lap forward, index wraps around to zero.
                    // Set to `{ lap: lap.wrapping_add(1), mark: 0, index: 0 }`.
                    lap.wrapping_add(self.one_lap)
                };

                // Try moving the tail.
                match self.tail.compare_exchange_weak(
                    tail,
                    new_tail,
                    Ordering::SeqCst,
                    Ordering::Relaxed,
                ) {
                    Ok(_) => {
                        // Prepare the token for the follow-up call to `write`.
                        token.array.slot = slot as *const Slot<T> as *const u8;
                        token.array.stamp = tail + 1;
                        return true;
                    }
                    Err(_) => {
                        backoff.spin_light();
                        tail = self.tail.load(Ordering::Relaxed);
                    }
                }
            } else if stamp.wrapping_add(self.one_lap) == tail + 1 {
                atomic::fence(Ordering::SeqCst);
                let head = self.head.load(Ordering::Relaxed);

                // If the head lags one lap behind the tail as well...
                if head.wrapping_add(self.one_lap) == tail {
                    // ...then the channel is full.
                    return false;
                }

                backoff.spin_light();
                tail = self.tail.load(Ordering::Relaxed);
            } else {
                // Snooze because we need to wait for the stamp to get updated.
                backoff.spin_heavy();
                tail = self.tail.load(Ordering::Relaxed);
            }
        }
    }

    /// 将消息写入通道。
    pub(crate) unsafe fn write(&self, token: &mut Token, msg: T) -> Result<(), T> {
        // If there is no slot, the channel is disconnected.
        if token.array.slot.is_null() {
            return Err(msg);
        }

        // Write the message into the slot and update the stamp.
        unsafe {
            let slot: &Slot<T> = &*(token.array.slot as *const Slot<T>);
            slot.msg.get().write(MaybeUninit::new(msg));
            slot.stamp.store(token.array.stamp, Ordering::Release);
        }

        // Wake a sleeping receiver.
        self.receivers.notify();
        Ok(())
    }

    /// 尝试为接收消息预留一个槽位。
    fn start_recv(&self, token: &mut Token) -> bool {
        let backoff = Backoff::new();
        let mut head = self.head.load(Ordering::Relaxed);

        loop {
            // Deconstruct the head.
            let index = head & (self.mark_bit - 1);
            let lap = head & !(self.one_lap - 1);

            // Inspect the corresponding slot.
            debug_assert!(index < self.buffer.len());
            let slot = unsafe { self.buffer.get_unchecked(index) };
            let stamp = slot.stamp.load(Ordering::Acquire);

            // If the stamp is ahead of the head by 1, we may attempt to pop.
            if head + 1 == stamp {
                let new = if index + 1 < self.cap {
                    // Same lap, incremented index.
                    // Set to `{ lap: lap, mark: 0, index: index + 1 }`.
                    head + 1
                } else {
                    // One lap forward, index wraps around to zero.
                    // Set to `{ lap: lap.wrapping_add(1), mark: 0, index: 0 }`.
                    lap.wrapping_add(self.one_lap)
                };

                // Try moving the head.
                match self.head.compare_exchange_weak(
                    head,
                    new,
                    Ordering::SeqCst,
                    Ordering::Relaxed,
                ) {
                    Ok(_) => {
                        // Prepare the token for the follow-up call to `read`.
                        token.array.slot = slot as *const Slot<T> as *const u8;
                        token.array.stamp = head.wrapping_add(self.one_lap);
                        return true;
                    }
                    Err(_) => {
                        backoff.spin_light();
                        head = self.head.load(Ordering::Relaxed);
                    }
                }
            } else if stamp == head {
                atomic::fence(Ordering::SeqCst);
                let tail = self.tail.load(Ordering::Relaxed);

                // If the tail equals the head, that means the channel is empty.
                if (tail & !self.mark_bit) == head {
                    // If the channel is disconnected...
                    if tail & self.mark_bit != 0 {
                        // ...then receive an error.
                        token.array.slot = ptr::null();
                        token.array.stamp = 0;
                        return true;
                    } else {
                        // Otherwise, the receive operation is not ready.
                        return false;
                    }
                }

                backoff.spin_light();
                head = self.head.load(Ordering::Relaxed);
            } else {
                // Snooze because we need to wait for the stamp to get updated.
                backoff.spin_heavy();
                head = self.head.load(Ordering::Relaxed);
            }
        }
    }

    /// 从通道读取消息。
    pub(crate) unsafe fn read(&self, token: &mut Token) -> Result<T, ()> {
        if token.array.slot.is_null() {
            // The channel is disconnected.
            return Err(());
        }

        // Read the message from the slot and update the stamp.
        let msg = unsafe {
            let slot: &Slot<T> = &*(token.array.slot as *const Slot<T>);

            let msg = slot.msg.get().read().assume_init();
            slot.stamp.store(token.array.stamp, Ordering::Release);
            msg
        };

        // Wake a sleeping sender.
        self.senders.notify();
        Ok(msg)
    }

    /// 尝试向通道发送消息。
    pub(crate) fn try_send(&self, msg: T) -> Result<(), TrySendError<T>> {
        let token = &mut Token::default();
        if self.start_send(token) {
            unsafe { self.write(token, msg).map_err(TrySendError::Disconnected) }
        } else {
            Err(TrySendError::Full(msg))
        }
    }

    /// 向通道发送消息。
    pub(crate) fn send(
        &self,
        msg: T,
        deadline: Option<Instant>,
    ) -> Result<(), SendTimeoutError<T>> {
        let token = &mut Token::default();
        loop {
            // Try sending a message.
            if self.start_send(token) {
                let res = unsafe { self.write(token, msg) };
                return res.map_err(SendTimeoutError::Disconnected);
            }

            if let Some(d) = deadline {
                if Instant::now() >= d {
                    return Err(SendTimeoutError::Timeout(msg));
                }
            }

            Context::with(|cx| {
                // Prepare for blocking until a receiver wakes us up.
                let oper = Operation::hook(token);
                self.senders.register(oper, cx);

                // Has the channel become ready just now?
                if !self.is_full() || self.is_disconnected() {
                    let _ = cx.try_select(Selected::Aborted);
                }

                // Block the current thread.
                // SAFETY: the context belongs to the current thread.
                let sel = unsafe { cx.wait_until(deadline) };

                match sel {
                    Selected::Waiting => unreachable!(),
                    Selected::Aborted | Selected::Disconnected => {
                        self.senders.unregister(oper).unwrap();
                    }
                    Selected::Operation(_) => {}
                }
            });
        }
    }

    /// 尝试非阻塞地接收消息。
    pub(crate) fn try_recv(&self) -> Result<T, TryRecvError> {
        let token = &mut Token::default();

        if self.start_recv(token) {
            unsafe { self.read(token).map_err(|_| TryRecvError::Disconnected) }
        } else {
            Err(TryRecvError::Empty)
        }
    }

    /// 从通道接收消息。
    pub(crate) fn recv(&self, deadline: Option<Instant>) -> Result<T, RecvTimeoutError> {
        let token = &mut Token::default();
        loop {
            // Try receiving a message.
            if self.start_recv(token) {
                let res = unsafe { self.read(token) };
                return res.map_err(|_| RecvTimeoutError::Disconnected);
            }

            if let Some(d) = deadline {
                if Instant::now() >= d {
                    return Err(RecvTimeoutError::Timeout);
                }
            }

            Context::with(|cx| {
                // Prepare for blocking until a sender wakes us up.
                let oper = Operation::hook(token);
                self.receivers.register(oper, cx);

                // Has the channel become ready just now?
                if !self.is_empty() || self.is_disconnected() {
                    let _ = cx.try_select(Selected::Aborted);
                }

                // Block the current thread.
                // SAFETY: the context belongs to the current thread.
                let sel = unsafe { cx.wait_until(deadline) };

                match sel {
                    Selected::Waiting => unreachable!(),
                    Selected::Aborted | Selected::Disconnected => {
                        self.receivers.unregister(oper).unwrap();
                        // If the channel was disconnected, we still have to check for remaining
                        // messages.
                    }
                    Selected::Operation(_) => {}
                }
            });
        }
    }

    /// 返回通道中当前消息的数量。
    pub(crate) fn len(&self) -> usize {
        loop {
            // Load the tail, then load the head.
            let tail = self.tail.load(Ordering::SeqCst);
            let head = self.head.load(Ordering::SeqCst);

            // If the tail didn't change, we've got consistent values to work with.
            if self.tail.load(Ordering::SeqCst) == tail {
                let hix = head & (self.mark_bit - 1);
                let tix = tail & (self.mark_bit - 1);

                return if hix < tix {
                    tix - hix
                } else if hix > tix {
                    self.cap - hix + tix
                } else if (tail & !self.mark_bit) == head {
                    0
                } else {
                    self.cap
                };
            }
        }
    }

    /// 返回通道的容量。
    #[allow(clippy::unnecessary_wraps)] // This is intentional.
    pub(crate) fn capacity(&self) -> Option<usize> {
        Some(self.cap)
    }

    /// 断开发送者并唤醒所有被阻塞的接收者。
    ///
    /// Returns `true` if this call disconnected the channel.
    pub(crate) fn disconnect_senders(&self) -> bool {
        let tail = self.tail.fetch_or(self.mark_bit, Ordering::SeqCst);

        if tail & self.mark_bit == 0 {
            self.receivers.disconnect();
            true
        } else {
            false
        }
    }

    /// 断开接收者并唤醒所有被阻塞的发送者。
    ///
    /// Returns `true` if this call disconnected the channel.
    ///
    /// # 安全性
    /// 在丢弃最后一个接收者时只能调用一次。所有其他接收者的销毁必须通过 acquire
    /// 顺序操作或更严格的方式实现。
    /// 丢弃所有消息。
    pub(crate) unsafe fn disconnect_receivers(&self) -> bool {
        let tail = self.tail.fetch_or(self.mark_bit, Ordering::SeqCst);
        let disconnected = if tail & self.mark_bit == 0 {
            self.senders.disconnect();
            true
        } else {
            false
        };

        unsafe { self.discard_all_messages(tail) };
        disconnected
    }

    /// Discards all messages.
    ///
    /// `tail` should be the current (and therefore last) value of `tail`.
    ///
    /// # 发生 panic
    /// 如果析构函数发生 panic，剩余的消息会被泄露，这与
    /// 无界通道的行为一致。
    ///
    /// # 安全性
    /// 此方法仅在释放最后一个接收器时调用。所有其他接收器的销毁必须在 acquire
    /// 过程中被观察到。
    /// 某种排序规则或更严格的条件。
    unsafe fn discard_all_messages(&self, tail: usize) {
        debug_assert!(self.is_disconnected());

        // Only receivers modify `head`, so since we are the last one,
        // this value will not change and will not be observed (since
        // no new messages can be sent after disconnection).
        let mut head = self.head.load(Ordering::Relaxed);
        let tail = tail & !self.mark_bit;

        let backoff = Backoff::new();
        loop {
            // Deconstruct the head.
            let index = head & (self.mark_bit - 1);
            let lap = head & !(self.one_lap - 1);

            // Inspect the corresponding slot.
            debug_assert!(index < self.buffer.len());
            let slot = unsafe { self.buffer.get_unchecked(index) };
            let stamp = slot.stamp.load(Ordering::Acquire);

            // If the stamp is ahead of the head by 1, we may drop the message.
            if head + 1 == stamp {
                head = if index + 1 < self.cap {
                    // Same lap, incremented index.
                    // Set to `{ lap: lap, mark: 0, index: index + 1 }`.
                    head + 1
                } else {
                    // One lap forward, index wraps around to zero.
                    // Set to `{ lap: lap.wrapping_add(1), mark: 0, index: 0 }`.
                    lap.wrapping_add(self.one_lap)
                };

                unsafe {
                    (*slot.msg.get()).assume_init_drop();
                }
            // If the tail equals the head, that means the channel is empty.
            } else if tail == head {
                return;
            // Otherwise, a sender is about to write into the slot, so we need
            // to wait for it to update the stamp.
            } else {
                backoff.spin_heavy();
            }
        }
    }

    /// Returns `true` if the channel is disconnected.
    pub(crate) fn is_disconnected(&self) -> bool {
        self.tail.load(Ordering::SeqCst) & self.mark_bit != 0
    }

    /// Returns `true` if the channel is empty.
    pub(crate) fn is_empty(&self) -> bool {
        let head = self.head.load(Ordering::SeqCst);
        let tail = self.tail.load(Ordering::SeqCst);

        // Is the tail equal to the head?
        //
        // Note: If the head changes just before we load the tail, that means there was a moment
        // when the channel was not empty, so it is safe to just return `false`.
        (tail & !self.mark_bit) == head
    }

    /// Returns `true` if the channel is full.
    pub(crate) fn is_full(&self) -> bool {
        let tail = self.tail.load(Ordering::SeqCst);
        let head = self.head.load(Ordering::SeqCst);

        // Is the head lagging one lap behind tail?
        //
        // Note: If the tail changes just before we load the head, that means there was a moment
        // when the channel was not full, so it is safe to just return `false`.
        head.wrapping_add(self.one_lap) == tail & !self.mark_bit
    }
}
