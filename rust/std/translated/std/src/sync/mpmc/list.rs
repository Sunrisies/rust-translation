//! 作为链表实现的无界通道。

use super::context::Context;
use super::error::*;
use super::select::{Operation, Selected, Token};
use super::utils::{Backoff, CachePadded};
use super::waker::SyncWaker;
use crate::cell::UnsafeCell;
use crate::marker::PhantomData;
use crate::mem::MaybeUninit;
use crate::ptr;
use crate::sync::atomic::{self, Atomic, AtomicPtr, AtomicUsize, Ordering};
use crate::time::Instant;

// Bits indicating the state of a slot:
// * If a message has been written into the slot, `WRITE` is set.
// * If a message has been read from the slot, `READ` is set.
// * If the block is being destroyed, `DESTROY` is set.
const WRITE: usize = 1;
const READ: usize = 2;
const DESTROY: usize = 4;

// Each block covers one "lap" of indices.
const LAP: usize = 32;
// The maximum number of messages a block can hold.
const BLOCK_CAP: usize = LAP - 1;
// How many lower bits are reserved for metadata.
const SHIFT: usize = 1;
// Has two different purposes:
// * If set in head, indicates that the block is not the last one.
// * If set in tail, indicates that the channel is disconnected.
const MARK_BIT: usize = 1;

/// 块中的一个槽位。
struct Slot<T> {
    /// 消息。
    msg: UnsafeCell<MaybeUninit<T>>,

    /// 槽位的状态。
    state: Atomic<usize>,
}

impl<T> Slot<T> {
    /// 等待直到有消息被写入槽位。
    fn wait_write(&self) {
        let backoff = Backoff::new();
        while self.state.load(Ordering::Acquire) & WRITE == 0 {
            backoff.spin_heavy();
        }
    }
}

/// 链表中的一块。
///
/// Each block in the list can hold up to `BLOCK_CAP` messages.
struct Block<T> {
    /// 链表中的下一个块。
    next: Atomic<*mut Block<T>>,

    /// 用于消息的槽位。
    slots: [Slot<T>; BLOCK_CAP],
}

impl<T> Block<T> {
    /// 创建一个空的块。
    fn new() -> Box<Block<T>> {
        // SAFETY: This is safe because:
        //  [1] `Block::next` (Atomic<*mut _>) may be safely zero initialized.
        //  [2] `Block::slots` (Array) may be safely zero initialized because of [3, 4].
        //  [3] `Slot::msg` (UnsafeCell) may be safely zero initialized because it
        //       holds a MaybeUninit.
        //  [4] `Slot::state` (Atomic<usize>) may be safely zero initialized.
        unsafe { Box::new_zeroed().assume_init() }
    }

    /// 等待直到下一个指针被设置。
    fn wait_next(&self) -> *mut Block<T> {
        let backoff = Backoff::new();
        loop {
            let next = self.next.load(Ordering::Acquire);
            if !next.is_null() {
                return next;
            }
            backoff.spin_heavy();
        }
    }

    /// Sets the `DESTROY` bit in slots starting from `start` and destroys the block.
    unsafe fn destroy(this: *mut Block<T>, start: usize) {
        // It is not necessary to set the `DESTROY` bit in the last slot because that slot has
        // begun destruction of the block.
        for i in start..BLOCK_CAP - 1 {
            let slot = unsafe { (*this).slots.get_unchecked(i) };

            // Mark the `DESTROY` bit if a thread is still using the slot.
            if slot.state.load(Ordering::Acquire) & READ == 0
                && slot.state.fetch_or(DESTROY, Ordering::AcqRel) & READ == 0
            {
                // If a thread is still using the slot, it will continue destruction of the block.
                return;
            }
        }

        // No thread is using the block, now it is safe to destroy it.
        drop(unsafe { Box::from_raw(this) });
    }
}

/// 通道中的一个位置。
#[derive(Debug)]
struct Position<T> {
    /// 通道中的索引。
    index: Atomic<usize>,

    /// 链表中的块。
    block: Atomic<*mut Block<T>>,
}

/// 列表风格的令牌类型。
#[derive(Debug)]
pub(crate) struct ListToken {
    /// 槽位的块。
    block: *const u8,

    /// 进入块的偏移量。
    offset: usize,
}

impl Default for ListToken {
    #[inline]
    fn default() -> Self {
        ListToken { block: ptr::null(), offset: 0 }
    }
}

/// 作为链表实现的无界通道。
///
/// Each message sent into the channel is assigned a sequence number, i.e. an index. Indices are
/// represented as numbers of type `usize` and wrap on overflow.
///
/// 连续消息被分组到块中，以减少分配器的压力并提升缓存效率。
/// 通道的头部。
pub(crate) struct Channel<T> {
    /// 通道的尾部。
    head: CachePadded<Position<T>>,

    /// 在通道为空且未断开时等待的接收器。
    tail: CachePadded<Position<T>>,

    /// Receivers waiting while the channel is empty and not disconnected.
    receivers: SyncWaker,

    /// Indicates that dropping a `Channel<T>` may drop messages of type `T`.
    _marker: PhantomData<T>,
}

impl<T> Channel<T> {
    /// 创建新的无界通道。
    pub(crate) fn new() -> Self {
        Channel {
            head: CachePadded::new(Position {
                block: AtomicPtr::new(ptr::null_mut()),
                index: AtomicUsize::new(0),
            }),
            tail: CachePadded::new(Position {
                block: AtomicPtr::new(ptr::null_mut()),
                index: AtomicUsize::new(0),
            }),
            receivers: SyncWaker::new(),
            _marker: PhantomData,
        }
    }

    /// 尝试为发送消息预留一个槽位。
    fn start_send(&self, token: &mut Token) -> bool {
        let backoff = Backoff::new();
        let mut tail = self.tail.index.load(Ordering::Acquire);
        let mut block = self.tail.block.load(Ordering::Acquire);
        let mut next_block = None;

        loop {
            // Check if the channel is disconnected.
            if tail & MARK_BIT != 0 {
                token.list.block = ptr::null();
                return true;
            }

            // Calculate the offset of the index into the block.
            let offset = (tail >> SHIFT) % LAP;

            // If we reached the end of the block, wait until the next one is installed.
            if offset == BLOCK_CAP {
                backoff.spin_heavy();
                tail = self.tail.index.load(Ordering::Acquire);
                block = self.tail.block.load(Ordering::Acquire);
                continue;
            }

            // If we're going to have to install the next block, allocate it in advance in order to
            // make the wait for other threads as short as possible.
            if offset + 1 == BLOCK_CAP && next_block.is_none() {
                next_block = Some(Block::<T>::new());
            }

            // If this is the first message to be sent into the channel, we need to allocate the
            // first block and install it.
            if block.is_null() {
                let new = Box::into_raw(Block::<T>::new());

                if self
                    .tail
                    .block
                    .compare_exchange(block, new, Ordering::Release, Ordering::Relaxed)
                    .is_ok()
                {
                    // This yield point leaves the channel in a half-initialized state where the
                    // tail.block pointer is set but the head.block is not. This is used to
                    // facilitate the test in src/tools/miri/tests/pass/issues/issue-139553.rs
                    #[cfg(miri)]
                    crate::thread::yield_now();
                    self.head.block.store(new, Ordering::Release);
                    block = new;
                } else {
                    next_block = unsafe { Some(Box::from_raw(new)) };
                    tail = self.tail.index.load(Ordering::Acquire);
                    block = self.tail.block.load(Ordering::Acquire);
                    continue;
                }
            }

            let new_tail = tail + (1 << SHIFT);

            // Try advancing the tail forward.
            match self.tail.index.compare_exchange_weak(
                tail,
                new_tail,
                Ordering::SeqCst,
                Ordering::Acquire,
            ) {
                Ok(_) => unsafe {
                    // If we've reached the end of the block, install the next one.
                    if offset + 1 == BLOCK_CAP {
                        let next_block = Box::into_raw(next_block.unwrap());
                        self.tail.block.store(next_block, Ordering::Release);
                        self.tail.index.fetch_add(1 << SHIFT, Ordering::Release);
                        (*block).next.store(next_block, Ordering::Release);
                    }

                    token.list.block = block as *const u8;
                    token.list.offset = offset;
                    return true;
                },
                Err(_) => {
                    backoff.spin_light();
                    tail = self.tail.index.load(Ordering::Acquire);
                    block = self.tail.block.load(Ordering::Acquire);
                }
            }
        }
    }

    /// 将消息写入通道。
    pub(crate) unsafe fn write(&self, token: &mut Token, msg: T) -> Result<(), T> {
        // If there is no slot, the channel is disconnected.
        if token.list.block.is_null() {
            return Err(msg);
        }

        // Write the message into the slot.
        let block = token.list.block as *mut Block<T>;
        let offset = token.list.offset;
        unsafe {
            let slot = (*block).slots.get_unchecked(offset);
            slot.msg.get().write(MaybeUninit::new(msg));
            slot.state.fetch_or(WRITE, Ordering::Release);
        }

        // Wake a sleeping receiver.
        self.receivers.notify();
        Ok(())
    }

    /// 尝试为接收消息预留一个槽位。
    fn start_recv(&self, token: &mut Token) -> bool {
        let backoff = Backoff::new();
        let mut head = self.head.index.load(Ordering::Acquire);
        let mut block = self.head.block.load(Ordering::Acquire);

        loop {
            // Calculate the offset of the index into the block.
            let offset = (head >> SHIFT) % LAP;

            // If we reached the end of the block, wait until the next one is installed.
            if offset == BLOCK_CAP {
                backoff.spin_heavy();
                head = self.head.index.load(Ordering::Acquire);
                block = self.head.block.load(Ordering::Acquire);
                continue;
            }

            let mut new_head = head + (1 << SHIFT);

            if new_head & MARK_BIT == 0 {
                atomic::fence(Ordering::SeqCst);
                let tail = self.tail.index.load(Ordering::Relaxed);

                // If the tail equals the head, that means the channel is empty.
                if head >> SHIFT == tail >> SHIFT {
                    // If the channel is disconnected...
                    if tail & MARK_BIT != 0 {
                        // ...then receive an error.
                        token.list.block = ptr::null();
                        return true;
                    } else {
                        // Otherwise, the receive operation is not ready.
                        return false;
                    }
                }

                // If head and tail are not in the same block, set `MARK_BIT` in head.
                if (head >> SHIFT) / LAP != (tail >> SHIFT) / LAP {
                    new_head |= MARK_BIT;
                }
            }

            // The block can be null here only if the first message is being sent into the channel.
            // In that case, just wait until it gets initialized.
            if block.is_null() {
                backoff.spin_heavy();
                head = self.head.index.load(Ordering::Acquire);
                block = self.head.block.load(Ordering::Acquire);
                continue;
            }

            // Try moving the head index forward.
            match self.head.index.compare_exchange_weak(
                head,
                new_head,
                Ordering::SeqCst,
                Ordering::Acquire,
            ) {
                Ok(_) => unsafe {
                    // If we've reached the end of the block, move to the next one.
                    if offset + 1 == BLOCK_CAP {
                        let next = (*block).wait_next();
                        let mut next_index = (new_head & !MARK_BIT).wrapping_add(1 << SHIFT);
                        if !(*next).next.load(Ordering::Relaxed).is_null() {
                            next_index |= MARK_BIT;
                        }

                        self.head.block.store(next, Ordering::Release);
                        self.head.index.store(next_index, Ordering::Release);
                    }

                    token.list.block = block as *const u8;
                    token.list.offset = offset;
                    return true;
                },
                Err(_) => {
                    backoff.spin_light();
                    head = self.head.index.load(Ordering::Acquire);
                    block = self.head.block.load(Ordering::Acquire);
                }
            }
        }
    }

    /// 从通道读取消息。
    pub(crate) unsafe fn read(&self, token: &mut Token) -> Result<T, ()> {
        if token.list.block.is_null() {
            // The channel is disconnected.
            return Err(());
        }

        // Read the message.
        let block = token.list.block as *mut Block<T>;
        let offset = token.list.offset;
        unsafe {
            let slot = (*block).slots.get_unchecked(offset);
            slot.wait_write();
            let msg = slot.msg.get().read().assume_init();

            // Destroy the block if we've reached the end, or if another thread wanted to destroy but
            // couldn't because we were busy reading from the slot.
            if offset + 1 == BLOCK_CAP {
                Block::destroy(block, 0);
            } else if slot.state.fetch_or(READ, Ordering::AcqRel) & DESTROY != 0 {
                Block::destroy(block, offset + 1);
            }

            Ok(msg)
        }
    }

    /// 尝试将消息发送到通道。
    pub(crate) fn try_send(&self, msg: T) -> Result<(), TrySendError<T>> {
        self.send(msg, None).map_err(|err| match err {
            SendTimeoutError::Disconnected(msg) => TrySendError::Disconnected(msg),
            SendTimeoutError::Timeout(_) => unreachable!(),
        })
    }

    /// 将消息发送到通道。
    pub(crate) fn send(
        &self,
        msg: T,
        _deadline: Option<Instant>,
    ) -> Result<(), SendTimeoutError<T>> {
        let token = &mut Token::default();
        assert!(self.start_send(token));
        unsafe { self.write(token, msg).map_err(SendTimeoutError::Disconnected) }
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
            if self.start_recv(token) {
                unsafe {
                    return self.read(token).map_err(|_| RecvTimeoutError::Disconnected);
                }
            }

            if let Some(d) = deadline {
                if Instant::now() >= d {
                    return Err(RecvTimeoutError::Timeout);
                }
            }

            // Prepare for blocking until a sender wakes us up.
            Context::with(|cx| {
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
            // Load the tail index, then load the head index.
            let mut tail = self.tail.index.load(Ordering::SeqCst);
            let mut head = self.head.index.load(Ordering::SeqCst);

            // If the tail index didn't change, we've got consistent indices to work with.
            if self.tail.index.load(Ordering::SeqCst) == tail {
                // Erase the lower bits.
                tail &= !((1 << SHIFT) - 1);
                head &= !((1 << SHIFT) - 1);

                // Fix up indices if they fall onto block ends.
                if (tail >> SHIFT) & (LAP - 1) == LAP - 1 {
                    tail = tail.wrapping_add(1 << SHIFT);
                }
                if (head >> SHIFT) & (LAP - 1) == LAP - 1 {
                    head = head.wrapping_add(1 << SHIFT);
                }

                // Rotate indices so that head falls into the first block.
                let lap = (head >> SHIFT) / LAP;
                tail = tail.wrapping_sub((lap * LAP) << SHIFT);
                head = head.wrapping_sub((lap * LAP) << SHIFT);

                // Remove the lower bits.
                tail >>= SHIFT;
                head >>= SHIFT;

                // Return the difference minus the number of blocks between tail and head.
                return tail - head - tail / LAP;
            }
        }
    }

    /// 返回通道的容量。
    pub(crate) fn capacity(&self) -> Option<usize> {
        None
    }

    /// 断开发送器的连接并唤醒所有被阻塞的接收器。
    ///
    /// Returns `true` if this call disconnected the channel.
    pub(crate) fn disconnect_senders(&self) -> bool {
        let tail = self.tail.index.fetch_or(MARK_BIT, Ordering::SeqCst);

        if tail & MARK_BIT == 0 {
            self.receivers.disconnect();
            true
        } else {
            false
        }
    }

    /// 断开接收器的连接。
    ///
    /// Returns `true` if this call disconnected the channel.
    pub(crate) fn disconnect_receivers(&self) -> bool {
        let tail = self.tail.index.fetch_or(MARK_BIT, Ordering::SeqCst);

        if tail & MARK_BIT == 0 {
            // If receivers are dropped first, discard all messages to free
            // memory eagerly.
            self.discard_all_messages();
            true
        } else {
            false
        }
    }

    /// 丢弃所有消息。
    ///
    /// 只有在所有接收器都被丢弃时才应调用此方法。
    fn discard_all_messages(&self) {
        let backoff = Backoff::new();
        let mut tail = self.tail.index.load(Ordering::Acquire);
        loop {
            let offset = (tail >> SHIFT) % LAP;
            if offset != BLOCK_CAP {
                break;
            }

            // New updates to tail will be rejected by MARK_BIT and aborted unless it's
            // at boundary. We need to wait for the updates take affect otherwise there
            // can be memory leaks.
            backoff.spin_heavy();
            tail = self.tail.index.load(Ordering::Acquire);
        }

        let mut head = self.head.index.load(Ordering::Acquire);
        // The channel may be uninitialized, so we have to swap to avoid overwriting any sender's attempts
        // to initialize the first block before noticing that the receivers disconnected. Late allocations
        // will be deallocated by the sender in Drop.
        let mut block = self.head.block.swap(ptr::null_mut(), Ordering::AcqRel);

        // If we're going to be dropping messages we need to synchronize with initialization
        if head >> SHIFT != tail >> SHIFT {
            // The block can be null here only if a sender is in the process of initializing the
            // channel while another sender managed to send a message by inserting it into the
            // semi-initialized channel and advanced the tail.
            // In that case, just wait until it gets initialized.
            while block.is_null() {
                backoff.spin_heavy();
                block = self.head.block.swap(ptr::null_mut(), Ordering::AcqRel);
            }
        }
        // After this point `head.block` is not modified again and it will be deallocated if it's
        // non-null. The `Drop` code of the channel, which runs after this function, also attempts
        // to deallocate `head.block` if it's non-null. Therefore this function must maintain the
        // invariant that if a deallocation of head.block is attempted then it must also be set to
        // NULL. Failing to do so will lead to the Drop code attempting a double free. For this
        // reason both reads above do an atomic swap instead of a simple atomic load.

        unsafe {
            // Drop all messages between head and tail and deallocate the heap-allocated blocks.
            while head >> SHIFT != tail >> SHIFT {
                let offset = (head >> SHIFT) % LAP;

                if offset < BLOCK_CAP {
                    // Drop the message in the slot.
                    let slot = (*block).slots.get_unchecked(offset);
                    slot.wait_write();
                    let p = &mut *slot.msg.get();
                    p.as_mut_ptr().drop_in_place();
                } else {
                    (*block).wait_next();
                    // Deallocate the block and move to the next one.
                    let next = (*block).next.load(Ordering::Acquire);
                    drop(Box::from_raw(block));
                    block = next;
                }

                head = head.wrapping_add(1 << SHIFT);
            }

            // Deallocate the last remaining block.
            if !block.is_null() {
                drop(Box::from_raw(block));
            }
        }

        head &= !MARK_BIT;
        self.head.index.store(head, Ordering::Release);
    }

    /// Returns `true` if the channel is disconnected.
    pub(crate) fn is_disconnected(&self) -> bool {
        self.tail.index.load(Ordering::SeqCst) & MARK_BIT != 0
    }

    /// Returns `true` if the channel is empty.
    pub(crate) fn is_empty(&self) -> bool {
        let head = self.head.index.load(Ordering::SeqCst);
        let tail = self.tail.index.load(Ordering::SeqCst);
        head >> SHIFT == tail >> SHIFT
    }

    /// Returns `true` if the channel is full.
    pub(crate) fn is_full(&self) -> bool {
        false
    }
}

impl<T> Drop for Channel<T> {
    fn drop(&mut self) {
        let mut head = self.head.index.load(Ordering::Relaxed);
        let mut tail = self.tail.index.load(Ordering::Relaxed);
        let mut block = self.head.block.load(Ordering::Relaxed);

        // Erase the lower bits.
        head &= !((1 << SHIFT) - 1);
        tail &= !((1 << SHIFT) - 1);

        unsafe {
            // Drop all messages between head and tail and deallocate the heap-allocated blocks.
            while head != tail {
                let offset = (head >> SHIFT) % LAP;

                if offset < BLOCK_CAP {
                    // Drop the message in the slot.
                    let slot = (*block).slots.get_unchecked(offset);
                    let p = &mut *slot.msg.get();
                    p.as_mut_ptr().drop_in_place();
                } else {
                    // Deallocate the block and move to the next one.
                    let next = (*block).next.load(Ordering::Relaxed);
                    drop(Box::from_raw(block));
                    block = next;
                }

                head = head.wrapping_add(1 << SHIFT);
            }

            // Deallocate the last remaining block.
            if !block.is_null() {
                drop(Box::from_raw(block));
            }
        }
    }
}
