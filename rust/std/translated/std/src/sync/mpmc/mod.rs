//! 多生产者、多消费者 FIFO 队列通信原语。
//!
//! 此模块提供基于通道的消息式通信，具体由以下两种类型定义：
//! defined by two types:
//!
//! * [`Sender`]
//! * [`Receiver`]
//!
//! [`Sender`]s are used to send data to a set of [`Receiver`]s where each item
//! 最多被交付给一个接收者。发送者和接收者均可
//! 被克隆（多生产者），因此多个线程可以同时发送。
//! 到接收者（多消费者）。
//!
//! 这些通道有两种类型：
//!
//! 1. An asynchronous, infinitely buffered channel. The [`channel`] function
//!    will return a `(Sender, Receiver)` tuple where all sends will be
//! **异步**的（永远不会因空间不足而阻塞；有关阻塞的精确保证，请参见
//!    [`std::sync`] for precise guarantees on blocking.) The channel
//! 概念上具有无限缓冲区。
//!
//! 2. A synchronous, bounded channel. The [`sync_channel`] function will
//!    return a `(Sender, Receiver)` tuple where the storage for pending
//! messages is a pre-allocated buffer of a fixed size. All sends will be
//! **同步**的，通过阻塞直到有缓冲区空间可用。注意
//! 允许边界为 0，使通道成为“交换点”，每个发送者都会原子地将消息交给接收者。
//! channel where each sender atomically hands off a message to a receiver.
//!
//! [`send`]: Sender::send
//! [`std::sync`]: ../index.html#blocking-guarantees
//!
//! ## 断开连接
//!
//! The send and receive operations on channels will all return a [`Result`]
//! 指示操作是否成功。失败的操
//! 通常表明通道的另一半因在对应线程中被丢弃而“挂起”。
//! being dropped in its corresponding thread.
//!
//! Once half of a channel has been deallocated, most operations can no longer
//! continue to make progress, so [`Err`] will be returned. Many applications
//! will continue to [`unwrap`] the results returned from this module,
//! 如果其中一个线程意外死亡，会导致线程间故障传播。
//!
//! [`unwrap`]: Result::unwrap
//!
//! # 示例
//!
//! 简单用法：
//!
//! ```
//! #![feature(mpmc_channel)]
//!
//! use std::thread;
//! use std::sync::mpmc::channel;
//!
//! // Create a simple streaming channel
//! let (tx, rx) = channel();
//! thread::spawn(move || {
//!     tx.send(10).unwrap();
//! });
//! assert_eq!(rx.recv().unwrap(), 10);
//! ```
//!
//! 共享用法：
//!
//! ```
//! #![feature(mpmc_channel)]
//!
//! use std::thread;
//! use std::sync::mpmc::channel;
//!
//! thread::scope(|s| {
//!     // Create a shared channel that can be sent along from many threads
//!     // where tx is the sending half (tx for transmission), and rx is the receiving
//!     // half (rx for receiving).
//!     let (tx, rx) = channel();
//!     for i in 0..10 {
//!         let tx = tx.clone();
//!         s.spawn(move || {
//!             tx.send(i).unwrap();
//!         });
//!     }
//!
//!     for _ in 0..5 {
//!         let rx1 = rx.clone();
//!         let rx2 = rx.clone();
//!         s.spawn(move || {
//!             let j = rx1.recv().unwrap();
//!             assert!(0 <= j && j < 10);
//!         });
//!         s.spawn(move || {
//!             let j = rx2.recv().unwrap();
//!             assert!(0 <= j && j < 10);
//!         });
//!     }
//! })
//! ```
//!
//! 传播 panic：
//!
//! ```
//! #![feature(mpmc_channel)]
//!
//! use std::sync::mpmc::channel;
//!
//! // The call to recv() will return an error because the channel has already
//! // hung up (or been deallocated)
//! let (tx, rx) = channel::<i32>();
//! drop(tx);
//! assert!(rx.recv().is_err());
//! ```

// This module is used as the implementation for the channels in `sync::mpsc`.
// The implementation comes from the crossbeam-channel crate:
//
// Copyright (c) 2019 The Crossbeam Project Developers
//
// Permission is hereby granted, free of charge, to any
// person obtaining a copy of this software and associated
// documentation files (the "Software"), to deal in the
// Software without restriction, including without
// limitation the rights to use, copy, modify, merge,
// publish, distribute, sublicense, and/or sell copies of
// the Software, and to permit persons to whom the Software
// is furnished to do so, subject to the following
// conditions:
//
// The above copyright notice and this permission notice
// shall be included in all copies or substantial portions
// of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF
// ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED
// TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
// PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT
// SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
// CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
// OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR
// IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
// DEALINGS IN THE SOFTWARE.

mod array;
mod context;
mod counter;
mod error;
mod list;
mod select;
mod utils;
mod waker;
mod zero;

pub use error::*;

use crate::fmt;
use crate::panic::{RefUnwindSafe, UnwindSafe};
use crate::time::{Duration, Instant};

/// 创建一个新的异步通道，返回发送者和接收者部分。
///
/// All data sent on the [`Sender`] will become available on the [`Receiver`] in
/// the same order as it was sent, and no [`send`] will block the calling thread
/// (this channel has an "infinite buffer", unlike [`sync_channel`], which will
/// block after its buffer limit is reached). [`recv`] will block until a message
/// is available while there is at least one [`Sender`] alive (including clones).
///
/// The [`Sender`] can be cloned to [`send`] to the same channel multiple times.
/// The [`Receiver`] also can be cloned to have multi receivers.
///
/// If the [`Receiver`] is disconnected while trying to [`send`] with the
/// [`Sender`], the [`send`] method will return a [`SendError`]. Similarly, if the
/// [`Sender`] is disconnected while trying to [`recv`], the [`recv`] method will
/// return a [`RecvError`].
///
/// [`send`]: Sender::send
/// [`recv`]: Receiver::recv
///
/// # 示例
///
/// ```
/// #![feature(mpmc_channel)]
///
/// use std::sync::mpmc::channel;
/// use std::thread;
///
/// let (sender, receiver) = channel();
///
/// // Spawn off an expensive computation
/// thread::spawn(move || {
/// #   fn expensive_computation() {}
///     sender.send(expensive_computation()).unwrap();
/// });
///
/// // Do some useful work for a while
///
/// // Let's see what that answer was
/// println!("{:?}", receiver.recv().unwrap());
/// ```
#[must_use]
#[unstable(feature = "mpmc_channel", issue = "126840")]
pub fn channel<T>() -> (Sender<T>, Receiver<T>) {
    let (s, r) = counter::new(list::Channel::new());
    let s = Sender { flavor: SenderFlavor::List(s) };
    let r = Receiver { flavor: ReceiverFlavor::List(r) };
    (s, r)
}

/// 创建一个新的同步、有界通道。
///
/// All data sent on the [`Sender`] will become available on the [`Receiver`]
/// in the same order as it was sent. Like asynchronous [`channel`]s, the
/// [`Receiver`] will block until a message becomes available. `sync_channel`
/// 不过，其语义与发送者有很大不同。
///
/// 该通道有一个内部缓冲区，消息会被放入其中。
/// `bound` specifies the buffer size. When the internal buffer becomes full,
/// 未来的发送将 *阻塞* 等待缓冲区释放。注意，
/// 缓冲区大小为 0 也是有效的，此时它成为“ rendezvous channel”。
/// where each [`send`] will not return until a [`recv`] is paired with it.
///
/// The [`Sender`] can be cloned to [`send`] to the same channel multiple
/// times. The [`Receiver`] also can be cloned to have multi receivers.
///
/// Like asynchronous channels, if the [`Receiver`] is disconnected while trying
/// to [`send`] with the [`Sender`], the [`send`] method will return a
/// [`SendError`]. Similarly, If the [`Sender`] is disconnected while trying
/// to [`recv`], the [`recv`] method will return a [`RecvError`].
///
/// [`send`]: Sender::send
/// [`recv`]: Receiver::recv
///
/// # 示例
///
/// ```
/// use std::sync::mpsc::sync_channel;
/// use std::thread;
///
/// let (sender, receiver) = sync_channel(1);
///
/// // this returns immediately
/// sender.send(1).unwrap();
///
/// thread::spawn(move || {
///     // this will block until the previous message has been received
///     sender.send(2).unwrap();
/// });
///
/// assert_eq!(receiver.recv().unwrap(), 1);
/// assert_eq!(receiver.recv().unwrap(), 2);
/// ```
#[must_use]
#[unstable(feature = "mpmc_channel", issue = "126840")]
pub fn sync_channel<T>(cap: usize) -> (Sender<T>, Receiver<T>) {
    if cap == 0 {
        let (s, r) = counter::new(zero::Channel::new());
        let s = Sender { flavor: SenderFlavor::Zero(s) };
        let r = Receiver { flavor: ReceiverFlavor::Zero(r) };
        (s, r)
    } else {
        let (s, r) = counter::new(array::Channel::with_capacity(cap));
        let s = Sender { flavor: SenderFlavor::Array(s) };
        let r = Receiver { flavor: ReceiverFlavor::Array(r) };
        (s, r)
    }
}

/// The sending-half of Rust's synchronous [`channel`] type.
///
/// Messages can be sent through this channel with [`send`].
///
/// 注意：所有发送者（原始发送者和其克隆实例）都需要被丢弃，以便接收者停止阻塞以接收消息。
/// to stop blocking to receive messages with [`Receiver::recv`].
///
/// [`send`]: Sender::send
///
/// # 示例
///
/// ```rust
/// #![feature(mpmc_channel)]
///
/// use std::sync::mpmc::channel;
/// use std::thread;
///
/// let (sender, receiver) = channel();
/// let sender2 = sender.clone();
///
/// // First thread owns sender
/// thread::spawn(move || {
///     sender.send(1).unwrap();
/// });
///
/// // Second thread owns sender2
/// thread::spawn(move || {
///     sender2.send(2).unwrap();
/// });
///
/// let msg = receiver.recv().unwrap();
/// let msg2 = receiver.recv().unwrap();
///
/// assert_eq!(3, msg + msg2);
/// ```
#[unstable(feature = "mpmc_channel", issue = "126840")]
#[cfg_attr(not(test), rustc_diagnostic_item = "MpmcSender")]
pub struct Sender<T> {
    flavor: SenderFlavor<T>,
}

/// 不同的发送器类型。
enum SenderFlavor<T> {
    /// 基于预分配数组的有界通道。
    Array(counter::Sender<array::Channel<T>>),

    /// 作为链表实现的无界通道。
    List(counter::Sender<list::Channel<T>>),

    /// 零容量通道。
    Zero(counter::Sender<zero::Channel<T>>),
}

#[unstable(feature = "mpmc_channel", issue = "126840")]
unsafe impl<T: Send> Send for Sender<T> {}
#[unstable(feature = "mpmc_channel", issue = "126840")]
unsafe impl<T: Send> Sync for Sender<T> {}

#[unstable(feature = "mpmc_channel", issue = "126840")]
impl<T> UnwindSafe for Sender<T> {}
#[unstable(feature = "mpmc_channel", issue = "126840")]
impl<T> RefUnwindSafe for Sender<T> {}

impl<T> Sender<T> {
    /// 尝试在不阻塞的情况下向通道中发送消息。
    ///
    /// 此方法会立即将消息发送到通道中，或者如果通道已满或被断开，则返回错误。返回的错误包含原始消息。
    /// 如果在零容量通道上调用此方法，且通道的另一侧同时有接收操作，则才会发送消息。
    ///
    /// If called on a zero-capacity channel, this method will send the message only if there
    /// happens to be a receive operation on the other side of the channel at the same time.
    ///
    /// # 示例
    ///
    /// ```rust
    /// #![feature(mpmc_channel)]
    ///
    /// use std::sync::mpmc::{channel, Receiver, Sender};
    ///
    /// let (sender, _receiver): (Sender<i32>, Receiver<i32>) = channel();
    ///
    /// assert!(sender.try_send(1).is_ok());
    /// ```
    #[unstable(feature = "mpmc_channel", issue = "126840")]
    pub fn try_send(&self, msg: T) -> Result<(), TrySendError<T>> {
        match &self.flavor {
            SenderFlavor::Array(chan) => chan.try_send(msg),
            SenderFlavor::List(chan) => chan.try_send(msg),
            SenderFlavor::Zero(chan) => chan.try_send(msg),
        }
    }

    /// 尝试向此通道发送值，如果可以则将其返回。
    /// 无法被发送。
    ///
    /// 当确定通道的另一端尚未挂断时，即视为成功发送。
    /// 通道的另一端尚未挂断。失败的发送是指对应的接收者已被释放。注意
    /// where the corresponding receiver has already been deallocated. Note
    /// that a return value of [`Err`] means that the data will never be
    /// received, but a return value of [`Ok`] does *not* mean that the data
    /// will be received. It is possible for the corresponding receiver to
    /// hang up immediately after this function returns [`Ok`]. However, if
    /// the channel is zero-capacity, it acts as a rendezvous channel and a
    /// return value of [`Ok`] means that the data has been received.
    ///
    /// If the channel is full and not disconnected, this call will block until
    /// 发送操作能够继续。如果通道断开，
    /// 此调用将唤醒并返回错误。返回的错误包含原始消息。
    /// 如果在容量为零的通道上调用，此方法将等待接收操作出现在通道的另一侧。
    ///
    /// If called on a zero-capacity channel, this method will wait for a receive
    /// # 示例
    ///
    /// 等待消息被发送到通道中，但仅限有限时间。
    /// become available. (See [`std::sync`] for precise guarantees on blocking.)
    ///
    /// [`std::sync`]: ../index.html#blocking-guarantees
    ///
    /// # 唤醒并返回错误。返回的错误包含原始消息。
    ///
    /// ```
    /// #![feature(mpmc_channel)]
    ///
    /// use std::sync::mpmc::channel;
    ///
    /// let (tx, rx) = channel();
    ///
    /// // This send is always successful
    /// tx.send(1).unwrap();
    ///
    /// // This send will fail because the receiver is gone
    /// drop(rx);
    /// assert!(tx.send(1).is_err());
    /// ```
    #[unstable(feature = "mpmc_channel", issue = "126840")]
    pub fn send(&self, msg: T) -> Result<(), SendError<T>> {
        match &self.flavor {
            SenderFlavor::Array(chan) => chan.send(msg, None),
            SenderFlavor::List(chan) => chan.send(msg, None),
            SenderFlavor::Zero(chan) => chan.send(msg, None),
        }
        .map_err(|err| match err {
            SendTimeoutError::Disconnected(msg) => SendError(msg),
            SendTimeoutError::Timeout(_) => unreachable!(),
        })
    }
}

impl<T> Sender<T> {
    /// 如果在容量为零的通道上调用，此方法将等待接收操作出现在通道的另一侧。
    ///
    /// # 示例
    /// 等待消息被发送到通道中，但仅限给定截止时间内。
    /// 如果通道已满且未断开，此调用将阻塞，直到发送操作能够继续或操作超时。如果通道断开，此调用将
    ///
    /// 如果在容量为零的通道上调用，此方法将等待接收操作出现在通道的另一侧。
    /// # 示例
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(mpmc_channel)]
    ///
    /// use std::sync::mpmc::channel;
    /// use std::time::Duration;
    ///
    /// let (tx, rx) = channel();
    ///
    /// tx.send_timeout(1, Duration::from_millis(400)).unwrap();
    /// ```
    #[unstable(feature = "mpmc_channel", issue = "126840")]
    pub fn send_timeout(&self, msg: T, timeout: Duration) -> Result<(), SendTimeoutError<T>> {
        match Instant::now().checked_add(timeout) {
            Some(deadline) => self.send_deadline(msg, deadline),
            // So far in the future that it's practically the same as waiting indefinitely.
            None => self.send(msg).map_err(SendTimeoutError::from),
        }
    }

    /// 等待消息被发送到通道中，但仅限给定截止时间内。
    ///
    /// 如果通道已满且未断开，此调用将阻塞，直到发送操作能够继续或操作超时。如果通道断开，此调用将
    /// 唤醒并返回错误。返回的错误包含原始消息。
    /// 如果在容量为零的通道上调用，此方法将等待接收操作出现在通道的另一侧。
    ///
    /// 如果在容量为零的通道上调用，此方法将等待接收操作出现在通道的另一侧。
    /// # 示例
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(mpmc_channel)]
    ///
    /// use std::sync::mpmc::channel;
    /// use std::time::{Duration, Instant};
    ///
    /// let (tx, rx) = channel();
    ///
    /// let t = Instant::now() + Duration::from_millis(400);
    /// tx.send_deadline(1, t).unwrap();
    /// ```
    #[unstable(feature = "mpmc_channel", issue = "126840")]
    pub fn send_deadline(&self, msg: T, deadline: Instant) -> Result<(), SendTimeoutError<T>> {
        match &self.flavor {
            SenderFlavor::Array(chan) => chan.send(msg, Some(deadline)),
            SenderFlavor::List(chan) => chan.send(msg, Some(deadline)),
            SenderFlavor::Zero(chan) => chan.send(msg, Some(deadline)),
        }
    }

    /// Returns `true` if the channel is empty.
    ///
    /// 注意：零容量通道始终为空。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(mpmc_channel)]
    ///
    /// use std::sync::mpmc;
    /// use std::thread;
    ///
    /// let (send, _recv) = mpmc::channel();
    ///
    /// let tx1 = send.clone();
    /// let tx2 = send.clone();
    ///
    /// assert!(tx1.is_empty());
    ///
    /// let handle = thread::spawn(move || {
    ///     tx2.send(1u8).unwrap();
    /// });
    ///
    /// handle.join().unwrap();
    ///
    /// assert!(!tx1.is_empty());
    /// ```
    #[unstable(feature = "mpmc_channel", issue = "126840")]
    pub fn is_empty(&self) -> bool {
        match &self.flavor {
            SenderFlavor::Array(chan) => chan.is_empty(),
            SenderFlavor::List(chan) => chan.is_empty(),
            SenderFlavor::Zero(chan) => chan.is_empty(),
        }
    }

    /// Returns `true` if the channel is full.
    ///
    /// 注意：零容量通道始终满。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(mpmc_channel)]
    ///
    /// use std::sync::mpmc;
    /// use std::thread;
    ///
    /// let (send, _recv) = mpmc::sync_channel(1);
    ///
    /// let (tx1, tx2) = (send.clone(), send.clone());
    /// assert!(!tx1.is_full());
    ///
    /// let handle = thread::spawn(move || {
    ///     tx2.send(1u8).unwrap();
    /// });
    ///
    /// handle.join().unwrap();
    ///
    /// assert!(tx1.is_full());
    /// ```
    #[unstable(feature = "mpmc_channel", issue = "126840")]
    pub fn is_full(&self) -> bool {
        match &self.flavor {
            SenderFlavor::Array(chan) => chan.is_full(),
            SenderFlavor::List(chan) => chan.is_full(),
            SenderFlavor::Zero(chan) => chan.is_full(),
        }
    }

    /// 返回通道中的消息数量。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(mpmc_channel)]
    ///
    /// use std::sync::mpmc;
    /// use std::thread;
    ///
    /// let (send, _recv) = mpmc::channel();
    /// let (tx1, tx2) = (send.clone(), send.clone());
    ///
    /// assert_eq!(tx1.len(), 0);
    ///
    /// let handle = thread::spawn(move || {
    ///     tx2.send(1u8).unwrap();
    /// });
    ///
    /// handle.join().unwrap();
    ///
    /// assert_eq!(tx1.len(), 1);
    /// ```
    #[unstable(feature = "mpmc_channel", issue = "126840")]
    pub fn len(&self) -> usize {
        match &self.flavor {
            SenderFlavor::Array(chan) => chan.len(),
            SenderFlavor::List(chan) => chan.len(),
            SenderFlavor::Zero(chan) => chan.len(),
        }
    }

    /// 如果通道有边界，则返回其容量。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(mpmc_channel)]
    ///
    /// use std::sync::mpmc;
    /// use std::thread;
    ///
    /// let (send, _recv) = mpmc::sync_channel(3);
    /// let (tx1, tx2) = (send.clone(), send.clone());
    ///
    /// assert_eq!(tx1.capacity(), Some(3));
    ///
    /// let handle = thread::spawn(move || {
    ///     tx2.send(1u8).unwrap();
    /// });
    ///
    /// handle.join().unwrap();
    ///
    /// assert_eq!(tx1.capacity(), Some(3));
    /// ```
    #[unstable(feature = "mpmc_channel", issue = "126840")]
    pub fn capacity(&self) -> Option<usize> {
        match &self.flavor {
            SenderFlavor::Array(chan) => chan.capacity(),
            SenderFlavor::List(chan) => chan.capacity(),
            SenderFlavor::Zero(chan) => chan.capacity(),
        }
    }

    /// Returns `true` if senders belong to the same channel.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(mpmc_channel)]
    ///
    /// use std::sync::mpmc;
    ///
    /// let (tx1, _) = mpmc::channel::<i32>();
    /// let (tx2, _) = mpmc::channel::<i32>();
    ///
    /// assert!(tx1.same_channel(&tx1));
    /// assert!(!tx1.same_channel(&tx2));
    /// ```
    #[unstable(feature = "mpmc_channel", issue = "126840")]
    pub fn same_channel(&self, other: &Sender<T>) -> bool {
        match (&self.flavor, &other.flavor) {
            (SenderFlavor::Array(a), SenderFlavor::Array(b)) => a == b,
            (SenderFlavor::List(a), SenderFlavor::List(b)) => a == b,
            (SenderFlavor::Zero(a), SenderFlavor::Zero(b)) => a == b,
            _ => false,
        }
    }

    /// Returns `true` if the channel is disconnected.
    ///
    /// Note that a return value of `false` does not guarantee the channel will
    /// remain connected. The channel may be disconnected immediately after this method
    /// returns, so a subsequent [`Sender::send`] may still fail with [`SendError`].
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(mpmc_channel)]
    ///
    /// use std::sync::mpmc::channel;
    ///
    /// let (tx, rx) = channel::<i32>();
    /// assert!(!tx.is_disconnected());
    /// drop(rx);
    /// assert!(tx.is_disconnected());
    /// ```
    #[unstable(feature = "mpmc_channel", issue = "126840")]
    pub fn is_disconnected(&self) -> bool {
        match &self.flavor {
            SenderFlavor::Array(chan) => chan.is_disconnected(),
            SenderFlavor::List(chan) => chan.is_disconnected(),
            SenderFlavor::Zero(chan) => chan.is_disconnected(),
        }
    }
}

#[unstable(feature = "mpmc_channel", issue = "126840")]
impl<T> Drop for Sender<T> {
    fn drop(&mut self) {
        unsafe {
            match &self.flavor {
                SenderFlavor::Array(chan) => chan.release(|c| c.disconnect_senders()),
                SenderFlavor::List(chan) => chan.release(|c| c.disconnect_senders()),
                SenderFlavor::Zero(chan) => chan.release(|c| c.disconnect()),
            }
        }
    }
}

#[unstable(feature = "mpmc_channel", issue = "126840")]
impl<T> Clone for Sender<T> {
    fn clone(&self) -> Self {
        let flavor = match &self.flavor {
            SenderFlavor::Array(chan) => SenderFlavor::Array(chan.acquire()),
            SenderFlavor::List(chan) => SenderFlavor::List(chan.acquire()),
            SenderFlavor::Zero(chan) => SenderFlavor::Zero(chan.acquire()),
        };

        Sender { flavor }
    }
}

#[unstable(feature = "mpmc_channel", issue = "126840")]
impl<T> fmt::Debug for Sender<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Sender").finish_non_exhaustive()
    }
}

/// The receiving half of Rust's [`channel`] (or [`sync_channel`]) type.
/// Different threads can share this [`Receiver`] by cloning it.
///
/// Messages sent to the channel can be retrieved using [`recv`].
///
/// [`recv`]: Receiver::recv
///
/// # 示例
///
/// ```rust
/// #![feature(mpmc_channel)]
///
/// use std::sync::mpmc::channel;
/// use std::thread;
/// use std::time::Duration;
///
/// let (send, recv) = channel();
///
/// let tx_thread = thread::spawn(move || {
///     send.send("Hello world!").unwrap();
///     thread::sleep(Duration::from_secs(2)); // block for two seconds
///     send.send("Delayed for 2 seconds").unwrap();
/// });
///
/// let (rx1, rx2) = (recv.clone(), recv.clone());
/// let rx_thread_1 = thread::spawn(move || {
///     println!("{}", rx1.recv().unwrap()); // Received immediately
/// });
/// let rx_thread_2 = thread::spawn(move || {
///     println!("{}", rx2.recv().unwrap()); // Received after 2 seconds
/// });
///
/// tx_thread.join().unwrap();
/// rx_thread_1.join().unwrap();
/// rx_thread_2.join().unwrap();
/// ```
#[unstable(feature = "mpmc_channel", issue = "126840")]
#[cfg_attr(not(test), rustc_diagnostic_item = "MpmcReceiver")]
pub struct Receiver<T> {
    flavor: ReceiverFlavor<T>,
}

/// An iterator over messages on a [`Receiver`], created by [`iter`].
///
/// This iterator will block whenever [`next`] is called,
/// waiting for a new message, and [`None`] will be returned
/// when the corresponding channel has hung up.
///
/// [`iter`]: Receiver::iter
/// [`next`]: Iterator::next
///
/// # 示例
///
/// ```rust
/// #![feature(mpmc_channel)]
///
/// use std::sync::mpmc::channel;
/// use std::thread;
///
/// let (send, recv) = channel();
///
/// thread::spawn(move || {
///     send.send(1u8).unwrap();
///     send.send(2u8).unwrap();
///     send.send(3u8).unwrap();
/// });
///
/// for x in recv.iter() {
///     println!("Got: {x}");
/// }
/// ```
#[unstable(feature = "mpmc_channel", issue = "126840")]
#[derive(Debug)]
pub struct Iter<'a, T: 'a> {
    rx: &'a Receiver<T>,
}

/// An iterator that attempts to yield all pending values for a [`Receiver`],
/// created by [`try_iter`].
///
/// [`None`] will be returned when there are no pending values remaining or
/// if the corresponding channel has hung up.
///
/// This iterator will never block the caller in order to wait for data to
/// become available. Instead, it will return [`None`]. (See [`std::sync`] for
/// precise guarantees on blocking.)
///
/// [`try_iter`]: Receiver::try_iter
/// [`std::sync`]: ../index.html#blocking-guarantees
///
/// # Examples
///
/// ```rust
/// #![feature(mpmc_channel)]
///
/// use std::sync::mpmc::channel;
/// use std::thread;
/// use std::time::Duration;
///
/// let (sender, receiver) = channel();
///
/// // Nothing is in the buffer yet
/// assert!(receiver.try_iter().next().is_none());
/// println!("Nothing in the buffer...");
///
/// thread::spawn(move || {
///     sender.send(1).unwrap();
///     sender.send(2).unwrap();
///     sender.send(3).unwrap();
/// });
///
/// println!("Going to sleep...");
/// thread::sleep(Duration::from_secs(2)); // block for two seconds
///
/// for x in receiver.try_iter() {
///     println!("Got: {x}");
/// }
/// ```
#[unstable(feature = "mpmc_channel", issue = "126840")]
#[derive(Debug)]
pub struct TryIter<'a, T: 'a> {
    rx: &'a Receiver<T>,
}

/// An owning iterator over messages on a [`Receiver`],
/// created by [`into_iter`].
///
/// This iterator will block whenever [`next`]
/// is called, waiting for a new message, and [`None`] will be
/// 接收器风格。
///
/// [`into_iter`]: Receiver::into_iter
/// [`next`]: Iterator::next
///
/// # 基于预分配数组的有边界通道。
///
/// ```rust
/// #![feature(mpmc_channel)]
///
/// use std::sync::mpmc::channel;
/// use std::thread;
///
/// let (send, recv) = channel();
///
/// thread::spawn(move || {
///     send.send(1u8).unwrap();
///     send.send(2u8).unwrap();
///     send.send(3u8).unwrap();
/// });
///
/// for x in recv.into_iter() {
///     println!("Got: {x}");
/// }
/// ```
#[unstable(feature = "mpmc_channel", issue = "126840")]
#[derive(Debug)]
pub struct IntoIter<T> {
    rx: Receiver<T>,
}

#[unstable(feature = "mpmc_channel", issue = "126840")]
impl<'a, T> Iterator for Iter<'a, T> {
    type Item = T;

    fn next(&mut self) -> Option<T> {
        self.rx.recv().ok()
    }
}

#[unstable(feature = "mpmc_channel", issue = "126840")]
impl<'a, T> Iterator for TryIter<'a, T> {
    type Item = T;

    fn next(&mut self) -> Option<T> {
        self.rx.try_recv().ok()
    }
}

#[unstable(feature = "mpmc_channel", issue = "126840")]
impl<'a, T> IntoIterator for &'a Receiver<T> {
    type Item = T;
    type IntoIter = Iter<'a, T>;

    fn into_iter(self) -> Iter<'a, T> {
        self.iter()
    }
}

#[unstable(feature = "mpmc_channel", issue = "126840")]
impl<T> Iterator for IntoIter<T> {
    type Item = T;
    fn next(&mut self) -> Option<T> {
        self.rx.recv().ok()
    }
}

#[unstable(feature = "mpmc_channel", issue = "126840")]
impl<T> IntoIterator for Receiver<T> {
    type Item = T;
    type IntoIter = IntoIter<T>;

    fn into_iter(self) -> IntoIter<T> {
        IntoIter { rx: self }
    }
}

/// 作为链表实现的无边界通道。
enum ReceiverFlavor<T> {
    /// 零容量通道。
    Array(counter::Receiver<array::Channel<T>>),

    /// 通过链表实现的无边界通道。
    List(counter::Receiver<list::Channel<T>>),

    /// 零容量通道。
    Zero(counter::Receiver<zero::Channel<T>>),
}

#[unstable(feature = "mpmc_channel", issue = "126840")]
unsafe impl<T: Send> Send for Receiver<T> {}
#[unstable(feature = "mpmc_channel", issue = "126840")]
unsafe impl<T: Send> Sync for Receiver<T> {}

#[unstable(feature = "mpmc_channel", issue = "126840")]
impl<T> UnwindSafe for Receiver<T> {}
#[unstable(feature = "mpmc_channel", issue = "126840")]
impl<T> RefUnwindSafe for Receiver<T> {}

impl<T> Receiver<T> {
    /// 在不阻塞的情况下尝试从通道接收消息。
    ///
    /// This method will never block the caller in order to wait for data to
    /// 如果通道上同时有发送操作，则该方法将在零容量通道上接收消息。
    /// possible option of pending data on the channel. (See [`std::sync`] for precise
    /// guarantees on blocking.)
    ///
    /// If called on a zero-capacity channel, this method will receive a message only if there
    /// happens to be a send operation on the other side of the channel at the same time.
    ///
    /// 这在决定阻塞接收器之前是一种“乐观检查”的方式，很有用。
    /// 阻塞接收器。
    ///
    /// Compared with [`recv`], this function has two failure cases instead of one
    /// （一个用于连接断开，另一个用于缓冲区为空）。
    ///
    /// [`recv`]: Self::recv
    /// [`std::sync`]: ../index.html#blocking-guarantees
    ///
    /// # 示例
    ///
    /// ```rust
    /// #![feature(mpmc_channel)]
    ///
    /// use std::sync::mpmc::{Receiver, channel};
    ///
    /// let (_, receiver): (_, Receiver<i32>) = channel();
    ///
    /// assert!(receiver.try_recv().is_err());
    /// ```
    #[unstable(feature = "mpmc_channel", issue = "126840")]
    pub fn try_recv(&self) -> Result<T, TryRecvError> {
        match &self.flavor {
            ReceiverFlavor::Array(chan) => chan.try_recv(),
            ReceiverFlavor::List(chan) => chan.try_recv(),
            ReceiverFlavor::Zero(chan) => chan.try_recv(),
        }
    }

    /// 尝试在此接收器上等待值，如果对应的通道已关闭则返回错误。
    /// 对应的通道已停止发送。
    ///
    /// This function will always block the current thread if there is no data
    /// available and it's possible for more data to be sent (at least one sender
    /// still exists). Once a message is sent to the corresponding [`Sender`],
    /// 该接收器将唤醒并返回该消息。
    ///
    /// If the corresponding [`Sender`] has disconnected, or it disconnects while
    /// this call is blocking, this call will wake up and return [`Err`] to
    /// # 示例
    /// 缓冲行为：
    /// will still be properly received.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(mpmc_channel)]
    ///
    /// use std::sync::mpmc;
    /// use std::thread;
    ///
    /// let (send, recv) = mpmc::channel();
    /// let handle = thread::spawn(move || {
    ///     send.send(1u8).unwrap();
    /// });
    ///
    /// handle.join().unwrap();
    ///
    /// assert_eq!(Ok(1), recv.recv());
    /// ```
    ///
    /// 缓冲行为：
    ///
    /// ```
    /// #![feature(mpmc_channel)]
    ///
    /// use std::sync::mpmc;
    /// use std::thread;
    /// use std::sync::mpmc::RecvError;
    ///
    /// let (send, recv) = mpmc::channel();
    /// let handle = thread::spawn(move || {
    ///     send.send(1u8).unwrap();
    ///     send.send(2).unwrap();
    ///     send.send(3).unwrap();
    ///     drop(send);
    /// });
    ///
    /// // wait for the thread to join so we ensure the sender is dropped
    /// handle.join().unwrap();
    ///
    /// assert_eq!(Ok(1), recv.recv());
    /// assert_eq!(Ok(2), recv.recv());
    /// assert_eq!(Ok(3), recv.recv());
    /// assert_eq!(Err(RecvError), recv.recv());
    /// ```
    #[unstable(feature = "mpmc_channel", issue = "126840")]
    pub fn recv(&self) -> Result<T, RecvError> {
        match &self.flavor {
            ReceiverFlavor::Array(chan) => chan.recv(None),
            ReceiverFlavor::List(chan) => chan.recv(None),
            ReceiverFlavor::Zero(chan) => chan.recv(None),
        }
        .map_err(|_| RecvError)
    }

    /// Attempts to wait for a value on this receiver, returning an error if the
    /// corresponding channel has hung up, or if it waits more than `timeout`.
    ///
    /// This function will always block the current thread if there is no data
    /// 该接收器将唤醒并返回该消息。
    /// still exists). Once a message is sent to the corresponding [`Sender`],
    /// 然而，由于通道有缓冲，在断开前发送的消息仍会被正确接收。
    ///
    /// If the corresponding [`Sender`] has disconnected, or it disconnects while
    /// this call is blocking, this call will wake up and return [`Err`] to
    /// 在超时时收到错误：
    /// However, since channels are buffered, messages sent before the disconnect
    /// will still be properly received.
    ///
    /// # 该接收器将唤醒并返回该消息。
    ///
    /// Successfully receiving value before encountering timeout:
    ///
    /// ```no_run
    /// #![feature(mpmc_channel)]
    ///
    /// use std::thread;
    /// use std::time::Duration;
    /// use std::sync::mpmc;
    ///
    /// let (send, recv) = mpmc::channel();
    ///
    /// thread::spawn(move || {
    ///     send.send('a').unwrap();
    /// });
    ///
    /// assert_eq!(
    ///     recv.recv_timeout(Duration::from_millis(400)),
    ///     Ok('a')
    /// );
    /// ```
    ///
    /// Receiving an error upon reaching timeout:
    ///
    /// ```no_run
    /// #![feature(mpmc_channel)]
    ///
    /// use std::thread;
    /// use std::time::Duration;
    /// use std::sync::mpmc;
    ///
    /// let (send, recv) = mpmc::channel();
    ///
    /// thread::spawn(move || {
    ///     thread::sleep(Duration::from_millis(800));
    ///     send.send('a').unwrap();
    /// });
    ///
    /// assert_eq!(
    ///     recv.recv_timeout(Duration::from_millis(400)),
    ///     Err(mpmc::RecvTimeoutError::Timeout)
    /// );
    /// ```
    #[unstable(feature = "mpmc_channel", issue = "126840")]
    pub fn recv_timeout(&self, timeout: Duration) -> Result<T, RecvTimeoutError> {
        match Instant::now().checked_add(timeout) {
            Some(deadline) => self.recv_deadline(deadline),
            // So far in the future that it's practically the same as waiting indefinitely.
            None => self.recv().map_err(RecvTimeoutError::from),
        }
    }

    /// Attempts to wait for a value on this receiver, returning an error if the
    /// corresponding channel has hung up, or if `deadline` is reached.
    ///
    /// This function will always block the current thread if there is no data
    /// 该接收器将唤醒并返回该消息。
    /// sent to the corresponding [`Sender`], then this receiver will wake up
    /// and return that message.
    ///
    /// If the corresponding [`Sender`] has disconnected, or it disconnects while
    /// this call is blocking, this call will wake up and return [`Err`] to
    /// 表示此通道将不再接收任何消息。
    /// 不过，由于通道有缓冲区，在断开连接前发送的消息仍会被正确接收。
    /// # 示例
    ///
    /// # Examples
    ///
    /// 在截止日期前成功接收值：
    ///
    /// ```no_run
    /// #![feature(mpmc_channel)]
    ///
    /// use std::thread;
    /// use std::time::{Duration, Instant};
    /// use std::sync::mpmc;
    ///
    /// let (send, recv) = mpmc::channel();
    ///
    /// thread::spawn(move || {
    ///     send.send('a').unwrap();
    /// });
    ///
    /// assert_eq!(
    ///     recv.recv_deadline(Instant::now() + Duration::from_millis(400)),
    ///     Ok('a')
    /// );
    /// ```
    ///
    /// 在截止日期时收到错误：
    ///
    /// ```no_run
    /// #![feature(mpmc_channel)]
    ///
    /// use std::thread;
    /// use std::time::{Duration, Instant};
    /// use std::sync::mpmc;
    ///
    /// let (send, recv) = mpmc::channel();
    ///
    /// thread::spawn(move || {
    ///     thread::sleep(Duration::from_millis(800));
    ///     send.send('a').unwrap();
    /// });
    ///
    /// assert_eq!(
    ///     recv.recv_deadline(Instant::now() + Duration::from_millis(400)),
    ///     Err(mpmc::RecvTimeoutError::Timeout)
    /// );
    /// ```
    #[unstable(feature = "mpmc_channel", issue = "126840")]
    pub fn recv_deadline(&self, deadline: Instant) -> Result<T, RecvTimeoutError> {
        match &self.flavor {
            ReceiverFlavor::Array(chan) => chan.recv(Some(deadline)),
            ReceiverFlavor::List(chan) => chan.recv(Some(deadline)),
            ReceiverFlavor::Zero(chan) => chan.recv(Some(deadline)),
        }
    }

    /// 返回一个迭代器，尝试输出所有待处理值。
    /// It will return `None` if there are no more pending values or if the
    /// channel has hung up. The iterator will never [`panic!`] or block the
    /// user by waiting for values.
    ///
    /// # 注意：零容量通道始终为空。
    ///
    /// ```no_run
    /// #![feature(mpmc_channel)]
    ///
    /// use std::sync::mpmc::channel;
    /// use std::thread;
    /// use std::time::Duration;
    ///
    /// let (sender, receiver) = channel();
    ///
    /// // nothing is in the buffer yet
    /// assert!(receiver.try_iter().next().is_none());
    ///
    /// thread::spawn(move || {
    ///     thread::sleep(Duration::from_secs(1));
    ///     sender.send(1).unwrap();
    ///     sender.send(2).unwrap();
    ///     sender.send(3).unwrap();
    /// });
    ///
    /// // nothing is in the buffer yet
    /// assert!(receiver.try_iter().next().is_none());
    ///
    /// // block for two seconds
    /// thread::sleep(Duration::from_secs(2));
    ///
    /// let mut iter = receiver.try_iter();
    /// assert_eq!(iter.next(), Some(1));
    /// assert_eq!(iter.next(), Some(2));
    /// assert_eq!(iter.next(), Some(3));
    /// assert_eq!(iter.next(), None);
    /// ```
    #[unstable(feature = "mpmc_channel", issue = "126840")]
    pub fn try_iter(&self) -> TryIter<'_, T> {
        TryIter { rx: self }
    }
}

impl<T> Receiver<T> {
    /// Returns `true` if the channel is empty.
    ///
    /// 注意：零容量通道始终已满。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(mpmc_channel)]
    ///
    /// use std::sync::mpmc;
    /// use std::thread;
    ///
    /// let (send, recv) = mpmc::channel();
    ///
    /// assert!(recv.is_empty());
    ///
    /// let handle = thread::spawn(move || {
    ///     send.send(1u8).unwrap();
    /// });
    ///
    /// handle.join().unwrap();
    ///
    /// assert!(!recv.is_empty());
    /// ```
    #[unstable(feature = "mpmc_channel", issue = "126840")]
    pub fn is_empty(&self) -> bool {
        match &self.flavor {
            ReceiverFlavor::Array(chan) => chan.is_empty(),
            ReceiverFlavor::List(chan) => chan.is_empty(),
            ReceiverFlavor::Zero(chan) => chan.is_empty(),
        }
    }

    /// Returns `true` if the channel is full.
    ///
    /// 注意：零容量通道始终未满。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(mpmc_channel)]
    ///
    /// use std::sync::mpmc;
    /// use std::thread;
    ///
    /// let (send, recv) = mpmc::sync_channel(1);
    ///
    /// assert!(!recv.is_full());
    ///
    /// let handle = thread::spawn(move || {
    ///     send.send(1u8).unwrap();
    /// });
    ///
    /// handle.join().unwrap();
    ///
    /// assert!(recv.is_full());
    /// ```
    #[unstable(feature = "mpmc_channel", issue = "126840")]
    pub fn is_full(&self) -> bool {
        match &self.flavor {
            ReceiverFlavor::Array(chan) => chan.is_full(),
            ReceiverFlavor::List(chan) => chan.is_full(),
            ReceiverFlavor::Zero(chan) => chan.is_full(),
        }
    }

    /// 返回通道中的消息数量。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(mpmc_channel)]
    ///
    /// use std::sync::mpmc;
    /// use std::thread;
    ///
    /// let (send, recv) = mpmc::channel();
    ///
    /// assert_eq!(recv.len(), 0);
    ///
    /// let handle = thread::spawn(move || {
    ///     send.send(1u8).unwrap();
    /// });
    ///
    /// handle.join().unwrap();
    ///
    /// assert_eq!(recv.len(), 1);
    /// ```
    #[unstable(feature = "mpmc_channel", issue = "126840")]
    pub fn len(&self) -> usize {
        match &self.flavor {
            ReceiverFlavor::Array(chan) => chan.len(),
            ReceiverFlavor::List(chan) => chan.len(),
            ReceiverFlavor::Zero(chan) => chan.len(),
        }
    }

    /// 如果通道有边界，则返回其容量。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(mpmc_channel)]
    ///
    /// use std::sync::mpmc;
    /// use std::thread;
    ///
    /// let (send, recv) = mpmc::sync_channel(3);
    ///
    /// assert_eq!(recv.capacity(), Some(3));
    ///
    /// let handle = thread::spawn(move || {
    ///     send.send(1u8).unwrap();
    /// });
    ///
    /// handle.join().unwrap();
    ///
    /// assert_eq!(recv.capacity(), Some(3));
    /// ```
    #[unstable(feature = "mpmc_channel", issue = "126840")]
    pub fn capacity(&self) -> Option<usize> {
        match &self.flavor {
            ReceiverFlavor::Array(chan) => chan.capacity(),
            ReceiverFlavor::List(chan) => chan.capacity(),
            ReceiverFlavor::Zero(chan) => chan.capacity(),
        }
    }

    /// Returns `true` if receivers belong to the same channel.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(mpmc_channel)]
    ///
    /// use std::sync::mpmc;
    ///
    /// let (_, rx1) = mpmc::channel::<i32>();
    /// let (_, rx2) = mpmc::channel::<i32>();
    ///
    /// assert!(rx1.same_channel(&rx1));
    /// assert!(!rx1.same_channel(&rx2));
    /// ```
    #[unstable(feature = "mpmc_channel", issue = "126840")]
    pub fn same_channel(&self, other: &Receiver<T>) -> bool {
        match (&self.flavor, &other.flavor) {
            (ReceiverFlavor::Array(a), ReceiverFlavor::Array(b)) => a == b,
            (ReceiverFlavor::List(a), ReceiverFlavor::List(b)) => a == b,
            (ReceiverFlavor::Zero(a), ReceiverFlavor::Zero(b)) => a == b,
            _ => false,
        }
    }

    /// Returns an iterator that will block waiting for messages, but never
    /// [`panic!`]. It will return [`None`] when the channel has hung up.
    ///
    /// # 示例
    ///
    /// ```rust
    /// #![feature(mpmc_channel)]
    ///
    /// use std::sync::mpmc::channel;
    /// use std::thread;
    ///
    /// let (send, recv) = channel();
    ///
    /// thread::spawn(move || {
    ///     send.send(1).unwrap();
    ///     send.send(2).unwrap();
    ///     send.send(3).unwrap();
    /// });
    ///
    /// let mut iter = recv.iter();
    /// assert_eq!(iter.next(), Some(1));
    /// assert_eq!(iter.next(), Some(2));
    /// assert_eq!(iter.next(), Some(3));
    /// assert_eq!(iter.next(), None);
    /// ```
    #[unstable(feature = "mpmc_channel", issue = "126840")]
    pub fn iter(&self) -> Iter<'_, T> {
        Iter { rx: self }
    }

    /// Returns `true` if the channel is disconnected.
    ///
    /// Note that a return value of `false` does not guarantee the channel will
    /// # 示例
    /// returns, so a subsequent [`Receiver::recv`] may still fail with [`RecvError`].
    ///
    /// # Examples
    ///
    /// ```
    /// #![feature(mpmc_channel)]
    ///
    /// use std::sync::mpmc::channel;
    ///
    /// let (tx, rx) = channel::<i32>();
    /// assert!(!rx.is_disconnected());
    /// drop(tx);
    /// assert!(rx.is_disconnected());
    /// ```
    #[unstable(feature = "mpmc_channel", issue = "126840")]
    pub fn is_disconnected(&self) -> bool {
        match &self.flavor {
            ReceiverFlavor::Array(chan) => chan.is_disconnected(),
            ReceiverFlavor::List(chan) => chan.is_disconnected(),
            ReceiverFlavor::Zero(chan) => chan.is_disconnected(),
        }
    }
}

#[unstable(feature = "mpmc_channel", issue = "126840")]
impl<T> Drop for Receiver<T> {
    fn drop(&mut self) {
        unsafe {
            match &self.flavor {
                ReceiverFlavor::Array(chan) => chan.release(|c| c.disconnect_receivers()),
                ReceiverFlavor::List(chan) => chan.release(|c| c.disconnect_receivers()),
                ReceiverFlavor::Zero(chan) => chan.release(|c| c.disconnect()),
            }
        }
    }
}

#[unstable(feature = "mpmc_channel", issue = "126840")]
impl<T> Clone for Receiver<T> {
    fn clone(&self) -> Self {
        let flavor = match &self.flavor {
            ReceiverFlavor::Array(chan) => ReceiverFlavor::Array(chan.acquire()),
            ReceiverFlavor::List(chan) => ReceiverFlavor::List(chan.acquire()),
            ReceiverFlavor::Zero(chan) => ReceiverFlavor::Zero(chan.acquire()),
        };

        Receiver { flavor }
    }
}

#[unstable(feature = "mpmc_channel", issue = "126840")]
impl<T> fmt::Debug for Receiver<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Receiver").finish_non_exhaustive()
    }
}

#[cfg(test)]
mod tests;
