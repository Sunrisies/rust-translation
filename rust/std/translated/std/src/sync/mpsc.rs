//! 多生产者、单消费者 FIFO 队列通信原语。
//!
//! 此模块提供基于消息的通道通信，具体表现为
//! 在三种类型之间定义：
//!
//! * [`Sender`]
//! * [`SyncSender`]
//! * [`Receiver`]
//!
//! A [`Sender`] or [`SyncSender`] is used to send data to a [`Receiver`]. Both
//! 发送器均可被克隆（多生产者），因此多个线程可以同时
//! 向一个接收者（单消费者）发送消息。
//!
//! 这些通道有两种类型：
//!
//! 1. An asynchronous, infinitely buffered channel. The [`channel`] function
//!    will return a `(Sender, Receiver)` tuple where all sends will be
//! **异步**的（永远不会因空间不足而阻塞；有关阻塞的精确保证，请参见
//!    [`std::sync`] for precise guarantees on blocking.) The channel
//! 在概念上具有无限缓冲区。
//!
//! 2. A synchronous, bounded channel. The [`sync_channel`] function will
//!    return a `(SyncSender, Receiver)` tuple where the storage for pending
//! **同步**的，通过阻塞直到有缓冲区空间可用。注意
//! 允许边界为 0，使通道成为“交换站”类型，
//! 每个发送者都会原子地将消息交给接收者。
//! # 断开连接
//!
//! [`send`]: Sender::send
//! [`std::sync`]: ../index.html#blocking-guarantees
//!
//! ## Disconnection
//!
//! The send and receive operations on channels will all return a [`Result`]
//! 以指示操作是否成功。失败的操
//! 通常表明通道的另一半因在对应线程中被丢弃而“挂起”。
//! 了。
//!
//! 一旦通道的一半被释放，大多数操作就无法继续进行，
//! continue to make progress, so [`Err`] will be returned. Many applications
//! will continue to [`unwrap`] the results returned from this module,
//! 如果某个线程意外死亡，会导致线程间故障传播。
//!
//! [`unwrap`]: Result::unwrap
//!
//! # 示例
//!
//! 简单用法：
//!
//! ```
//! use std::thread;
//! use std::sync::mpsc::channel;
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
//! use std::thread;
//! use std::sync::mpsc::channel;
//!
//! // Create a shared channel that can be sent along from many threads
//! // where tx is the sending half (tx for transmission), and rx is the receiving
//! // half (rx for receiving).
//! let (tx, rx) = channel();
//! for i in 0..10 {
//!     let tx = tx.clone();
//!     thread::spawn(move || {
//!         tx.send(i).unwrap();
//!     });
//! }
//!
//! for _ in 0..10 {
//!     let j = rx.recv().unwrap();
//!     assert!(0 <= j && j < 10);
//! }
//! ```
//!
//! 传播 panic：
//!
//! ```
//! use std::sync::mpsc::channel;
//!
//! // The call to recv() will return an error because the channel has already
//! // hung up (or been deallocated)
//! let (tx, rx) = channel::<i32>();
//! drop(tx);
//! assert!(rx.recv().is_err());
//! ```
//!
//! 同步通道：
//!
//! ```
//! use std::thread;
//! use std::sync::mpsc::sync_channel;
//!
//! let (tx, rx) = sync_channel::<i32>(0);
//! thread::spawn(move || {
//!     // This will wait for the parent thread to start receiving
//!     tx.send(53).unwrap();
//! });
//! rx.recv().unwrap();
//! ```
//!
//! 无边界接收循环：
//!
//! ```
//! use std::sync::mpsc::sync_channel;
//! use std::thread;
//!
//! let (tx, rx) = sync_channel(3);
//!
//! for _ in 0..3 {
//!     // It would be the same without thread and clone here
//!     // since there will still be one `tx` left.
//!     let tx = tx.clone();
//!     // cloned tx dropped within thread
//!     thread::spawn(move || tx.send("ok").unwrap());
//! }
//!
//! // Drop the last sender to stop `rx` waiting for message.
//! // The program will not complete if we comment this out.
//! // **All** `tx` needs to be dropped for `rx` to have `Err`.
//! drop(tx);
//!
//! // Unbounded receiver waiting for all senders to complete.
//! while let Ok(msg) = rx.recv() {
//!     println!("{msg}");
//! }
//!
//! println!("completed");
//! ```

#![stable(feature = "rust1", since = "1.0.0")]

// MPSC channels are built as a wrapper around MPMC channels, which
// were ported from the `crossbeam-channel` crate. MPMC channels are
// not exposed publicly, but if you are curious about the implementation,
// that's where everything is.

use core::clone::Share;

use crate::sync::mpmc;
use crate::time::{Duration, Instant};
use crate::{error, fmt};

/// The receiving half of Rust's [`channel`] (or [`sync_channel`]) type.
/// 此部分只能由一个线程拥有。
///
/// Messages sent to the channel can be retrieved using [`recv`].
///
/// [`recv`]: Receiver::recv
///
/// # 示例
///
/// ```rust
/// use std::sync::mpsc::channel;
/// use std::thread;
/// use std::time::Duration;
///
/// let (send, recv) = channel();
///
/// thread::spawn(move || {
///     send.send("Hello world!").unwrap();
///     thread::sleep(Duration::from_secs(2)); // block for two seconds
///     send.send("Delayed for 2 seconds").unwrap();
/// });
///
/// println!("{}", recv.recv().unwrap()); // Received immediately
/// println!("Waiting...");
/// println!("{}", recv.recv().unwrap()); // Received after 2 seconds
/// ```
#[stable(feature = "rust1", since = "1.0.0")]
#[cfg_attr(not(test), rustc_diagnostic_item = "MpscReceiver")]
pub struct Receiver<T> {
    inner: mpmc::Receiver<T>,
}

// The receiver port can be sent from place to place, so long as it
// is not used to receive non-sendable things.
#[stable(feature = "rust1", since = "1.0.0")]
unsafe impl<T: Send> Send for Receiver<T> {}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T> !Sync for Receiver<T> {}

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
/// use std::sync::mpsc::channel;
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
#[stable(feature = "rust1", since = "1.0.0")]
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
/// use std::sync::mpsc::channel;
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
#[stable(feature = "receiver_try_iter", since = "1.15.0")]
#[derive(Debug)]
pub struct TryIter<'a, T: 'a> {
    rx: &'a Receiver<T>,
}

/// An owning iterator over messages on a [`Receiver`],
/// created by [`into_iter`].
///
/// This iterator will block whenever [`next`]
/// is called, waiting for a new message, and [`None`] will be
/// # 示例
///
/// [`into_iter`]: Receiver::into_iter
/// [`next`]: Iterator::next
///
/// # Examples
///
/// ```rust
/// use std::sync::mpsc::channel;
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
#[stable(feature = "receiver_into_iter", since = "1.1.0")]
#[derive(Debug)]
pub struct IntoIter<T> {
    rx: Receiver<T>,
}

/// The sending-half of Rust's asynchronous [`channel`] type.
///
/// Messages can be sent through this channel with [`send`].
///
/// 注意：所有发送者（原始对象及其克隆）都需要被丢弃，以便接收者停止阻塞以接收消息。
/// to stop blocking to receive messages with [`Receiver::recv`].
///
/// [`send`]: Sender::send
///
/// # Examples
///
/// ```rust
/// use std::sync::mpsc::channel;
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
#[stable(feature = "rust1", since = "1.0.0")]
#[cfg_attr(not(test), rustc_diagnostic_item = "MpscSender")]
pub struct Sender<T> {
    inner: mpmc::Sender<T>,
}

// The send port can be sent from place to place, so long as it
// is not used to send non-sendable things.
#[stable(feature = "rust1", since = "1.0.0")]
unsafe impl<T: Send> Send for Sender<T> {}

#[stable(feature = "mpsc_sender_sync", since = "1.72.0")]
unsafe impl<T: Send> Sync for Sender<T> {}

/// The sending-half of Rust's synchronous [`sync_channel`] type.
///
/// Messages can be sent through this channel with [`send`] or [`try_send`].
///
/// [`send`] will block if there is no space in the internal buffer.
///
/// [`send`]: SyncSender::send
/// [`try_send`]: SyncSender::try_send
///
/// # 示例
///
/// ```rust
/// use std::sync::mpsc::sync_channel;
/// use std::thread;
///
/// // Create a sync_channel with buffer size 2
/// let (sync_sender, receiver) = sync_channel(2);
/// let sync_sender2 = sync_sender.clone();
///
/// // First thread owns sync_sender
/// thread::spawn(move || {
///     sync_sender.send(1).unwrap();
///     sync_sender.send(2).unwrap();
/// });
///
/// // Second thread owns sync_sender2
/// thread::spawn(move || {
///     sync_sender2.send(3).unwrap();
///     // thread will now block since the buffer is full
///     println!("Thread unblocked!");
/// });
///
/// let mut msg;
///
/// msg = receiver.recv().unwrap();
/// println!("message {msg} received");
///
/// // "Thread unblocked!" will be printed now
///
/// msg = receiver.recv().unwrap();
/// println!("message {msg} received");
///
/// msg = receiver.recv().unwrap();
///
/// println!("message {msg} received");
/// ```
#[stable(feature = "rust1", since = "1.0.0")]
pub struct SyncSender<T> {
    inner: mpmc::Sender<T>,
}

#[stable(feature = "rust1", since = "1.0.0")]
unsafe impl<T: Send> Send for SyncSender<T> {}

/// An error returned from the [`Sender::send`] or [`SyncSender::send`]
/// 在 **channel** 上发生的函数错误。
///
/// **send** 操作只有在通道的接收端断开时才会失败。
/// 如果连接断开，意味着数据永远无法接收，错误中包含作为有效载荷的发送数据，因此可以恢复。
/// contains the data being sent as a payload so it can be recovered.
#[stable(feature = "rust1", since = "1.0.0")]
#[derive(PartialEq, Eq, Clone, Copy)]
pub struct SendError<T>(#[stable(feature = "rust1", since = "1.0.0")] pub T);

/// An error returned from the [`recv`] function on a [`Receiver`].
///
/// The [`recv`] operation can only fail if the sending half of a
/// [`channel`] (or [`sync_channel`]) is disconnected, implying that no further
/// messages will ever be received.
///
/// [`recv`]: Receiver::recv
#[derive(PartialEq, Eq, Clone, Copy, Debug)]
#[stable(feature = "rust1", since = "1.0.0")]
pub struct RecvError;

/// This enumeration is the list of the possible reasons that [`try_recv`] could
/// not return data when called. This can occur with both a [`channel`] and
/// a [`sync_channel`].
///
/// [`try_recv`]: Receiver::try_recv
#[derive(PartialEq, Eq, Clone, Copy, Debug)]
#[stable(feature = "rust1", since = "1.0.0")]
pub enum TryRecvError {
    /// 此 **channel** 目前为空，但 **Sender**(s) 尚未断开，因此数据可能即将可用。
    /// 此 **channel** 的发送端已断开，此后将不会收到任何数据。
    #[stable(feature = "rust1", since = "1.0.0")]
    Empty,

    /// The **channel**'s sending half has become disconnected, and there will
    /// never be any more data received on it.
    #[stable(feature = "rust1", since = "1.0.0")]
    Disconnected,
}

/// This enumeration is the list of possible errors that made [`recv_timeout`]
/// unable to return data when called. This can occur with both a [`channel`] and
/// a [`sync_channel`].
///
/// [`recv_timeout`]: Receiver::recv_timeout
#[derive(PartialEq, Eq, Clone, Copy, Debug)]
#[stable(feature = "mpsc_recv_timeout", since = "1.12.0")]
pub enum RecvTimeoutError {
    /// This **channel** is currently empty, but the **Sender**(s) have not yet
    /// disconnected, so data may yet become available.
    #[stable(feature = "mpsc_recv_timeout", since = "1.12.0")]
    Timeout,
    /// 此 **channel** 的发送端已断开，此后将不会收到任何数据。
    /// 不会再有数据被接收。
    #[stable(feature = "mpsc_recv_timeout", since = "1.12.0")]
    Disconnected,
}

/// 此枚举列出了可能产生的错误结果。
/// [`try_send`] method.
///
/// [`try_send`]: SyncSender::try_send
#[stable(feature = "rust1", since = "1.0.0")]
#[derive(PartialEq, Eq, Clone, Copy)]
pub enum TrySendError<T> {
    /// The data could not be sent on the [`sync_channel`] because it would require that
    /// 即需要调用方执行发送数据的操作。
    ///
    /// 如果这是一个缓冲通道，那么此时缓冲区已满。如果
    /// this is not a buffered channel, then there is no [`Receiver`] available to
    /// 获取数据。
    #[stable(feature = "rust1", since = "1.0.0")]
    Full(#[stable(feature = "rust1", since = "1.0.0")] T),

    /// This [`sync_channel`]'s receiving half has disconnected, so the data could not be
    /// 消耗错误值并返回内部值。
    #[stable(feature = "rust1", since = "1.0.0")]
    Disconnected(#[stable(feature = "rust1", since = "1.0.0")] T),
}

impl<T> TrySendError<T> {
    /// # 示例
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(try_send_error_into_inner)]
    ///
    /// use std::sync::mpsc::sync_channel;
    ///
    /// let (tx, rx) = sync_channel(0);
    /// if let Err(err) = tx.try_send("message") {
    ///     let msg: &'static str = err.into_inner();
    ///     assert_eq!(msg, "message");
    /// }
    /// ```
    #[unstable(feature = "try_send_error_into_inner", issue = "165102")]
    pub fn into_inner(self) -> T {
        match self {
            TrySendError::Full(inner) | TrySendError::Disconnected(inner) => inner,
        }
    }
}

/// 创建一个新的异步通道，返回发送方和接收方部分。
///
/// All data sent on the [`Sender`] will become available on the [`Receiver`] in
/// the same order as it was sent, and no [`send`] will block the calling thread
/// (this channel has an "infinite buffer", unlike [`sync_channel`], which will
/// block after its buffer limit is reached). [`recv`] will block until a message
/// is available while there is at least one [`Sender`] alive (including clones).
///
/// The [`Sender`] can be cloned to [`send`] to the same channel multiple times, but
/// only one [`Receiver`] is supported.
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
/// use std::sync::mpsc::channel;
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
#[stable(feature = "rust1", since = "1.0.0")]
pub fn channel<T>() -> (Sender<T>, Receiver<T>) {
    let (tx, rx) = mpmc::channel();
    (Sender { inner: tx }, Receiver { inner: rx })
}

/// 创建一个新的同步有界通道。
///
/// All data sent on the [`SyncSender`] will become available on the [`Receiver`]
/// in the same order as it was sent. Like asynchronous [`channel`]s, the
/// [`Receiver`] will block until a message becomes available. `sync_channel`
/// differs greatly in the semantics of the sender, however.
///
/// 未来的发送将*阻塞*等待缓冲区释放。请注意，缓冲区大小为 0 是有效的，此时它成为“ rendezvous channel”。
/// `bound` specifies the buffer size. When the internal buffer becomes full,
/// future sends will *block* waiting for the buffer to open up. Note that a
/// buffer size of 0 is valid, in which case this becomes "rendezvous channel"
/// where each [`send`] will not return until a [`recv`] is paired with it.
///
/// The [`SyncSender`] can be cloned to [`send`] to the same channel multiple
/// times, but only one [`Receiver`] is supported.
///
/// Like asynchronous channels, if the [`Receiver`] is disconnected while trying
/// to [`send`] with the [`SyncSender`], the [`send`] method will return a
/// [`SendError`]. Similarly, If the [`SyncSender`] is disconnected while trying
/// to [`recv`], the [`recv`] method will return a [`RecvError`].
///
/// [`send`]: SyncSender::send
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
#[stable(feature = "rust1", since = "1.0.0")]
pub fn sync_channel<T>(bound: usize) -> (SyncSender<T>, Receiver<T>) {
    let (tx, rx) = mpmc::sync_channel(bound);
    (SyncSender { inner: tx }, Receiver { inner: rx })
}

////////////////////////////////////////////////////////////////////////////////
// Sender
////////////////////////////////////////////////////////////////////////////////

impl<T> Sender<T> {
    /// 尝试向此通道发送值，如果可以则将其返回
    /// 否则无法发送。
    ///
    /// 当确定通道的另一端尚未挂断时，成功发送即发生。失败的发送则是
    /// 当对应的接收者已被释放时。注意
    /// where the corresponding receiver has already been deallocated. Note
    /// that a return value of [`Err`] means that the data will never be
    /// received, but a return value of [`Ok`] does *not* mean that the data
    /// will be received. It is possible for the corresponding receiver to
    /// hang up immediately after this function returns [`Ok`].
    ///
    /// This method will never block the caller in order to wait for space to
    /// become available. (See [`std::sync`] for precise guarantees on blocking.)
    ///
    /// [`std::sync`]: ../index.html#blocking-guarantees
    ///
    /// # 示例
    ///
    /// ```
    /// use std::sync::mpsc::channel;
    ///
    /// let (tx, rx) = channel();
    ///
    /// // This send is always successful
    /// tx.send(1).unwrap();
    ///
    /// // This send will fail because the receiver is gone
    /// drop(rx);
    /// assert_eq!(tx.send(1).unwrap_err().0, 1);
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn send(&self, t: T) -> Result<(), SendError<T>> {
        self.inner.send(t)
    }

    /// Returns `true` if the channel is disconnected.
    ///
    /// Note that a return value of `false` does not guarantee the channel will
    /// # 示例
    /// returns, so a subsequent [`Sender::send`] may still fail with [`SendError`].
    ///
    /// # 注意：零容量通道始终为空。
    ///
    /// ```
    /// #![feature(mpsc_is_disconnected)]
    ///
    /// use std::sync::mpsc::channel;
    ///
    /// let (tx, rx) = channel::<i32>();
    /// assert!(!tx.is_disconnected());
    /// drop(rx);
    /// assert!(tx.is_disconnected());
    /// ```
    #[unstable(feature = "mpsc_is_disconnected", issue = "153668")]
    pub fn is_disconnected(&self) -> bool {
        self.inner.is_disconnected()
    }

    /// Returns `true` if the channel is empty.
    ///
    /// 返回通道中的消息数量。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(mpsc_channel_len)]
    ///
    /// use std::sync::mpsc;
    /// use std::thread;
    ///
    /// let (send, _recv) = mpsc::channel();
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
    #[unstable(feature = "mpsc_channel_len", issue = "165247")]
    pub fn is_empty(&self) -> bool {
        self.inner.is_empty()
    }

    /// 返回通道中的消息数。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(mpsc_channel_len)]
    ///
    /// use std::sync::mpsc;
    /// use std::thread;
    ///
    /// let (send, _recv) = mpsc::channel();
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
    #[unstable(feature = "mpsc_channel_len", issue = "165247")]
    pub fn len(&self) -> usize {
        self.inner.len()
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T> Clone for Sender<T> {
    /// 克隆发送者以向其他线程发送数据。
    ///
    /// 注意，要关注发送者的生命周期，因为所有发送者
    /// (including the original) need to be dropped in order for
    /// [`Receiver::recv`] to stop blocking.
    fn clone(&self) -> Sender<T> {
        Sender { inner: self.inner.clone() }
    }
}

#[unstable(feature = "share_trait", issue = "156756")]
impl<T> Share for Sender<T> {}

#[stable(feature = "mpsc_debug", since = "1.8.0")]
impl<T> fmt::Debug for Sender<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Sender").finish_non_exhaustive()
    }
}

////////////////////////////////////////////////////////////////////////////////
// SyncSender
////////////////////////////////////////////////////////////////////////////////

impl<T> SyncSender<T> {
    /// 在此同步通道上发送值。
    ///
    /// 该函数将 *阻塞*，直到内部缓冲区中有空间可用或有一个接收者可以接收消息。
    /// 注意，成功发送并不保证接收者会
    ///
    /// 看到数据，如果此通道上有缓冲区的话。项目可能被
    /// 放入内部缓冲区中，供接收者在稍后时间接收。然而，如果缓冲区大小为 0，则通道成为
    /// rendezvous 通道，并保证接收者确实收到了数据。
    /// 如果该函数成功返回，则保证接收者确实收到了数据。
    /// channel and it guarantees that the receiver has indeed received
    /// the data if this function returns success.
    ///
    /// This function will never panic, but it may return [`Err`] if the
    /// [`Receiver`] has disconnected and is no longer able to receive
    /// 信息。
    ///
    /// # 示例
    ///
    /// ```rust
    /// use std::sync::mpsc::sync_channel;
    /// use std::thread;
    ///
    /// // Create a rendezvous sync_channel with buffer size 0
    /// let (sync_sender, receiver) = sync_channel(0);
    ///
    /// thread::spawn(move || {
    ///    println!("sending message...");
    ///    sync_sender.send(1).unwrap();
    ///    // Thread is now blocked until the message is received
    ///
    ///    println!("...message received!");
    /// });
    ///
    /// let msg = receiver.recv().unwrap();
    /// assert_eq!(1, msg);
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn send(&self, t: T) -> Result<(), SendError<T>> {
        self.inner.send(t)
    }

    /// 在不阻塞的情况下向此通道发送值的尝试。
    ///
    /// This method differs from [`send`] by returning immediately if the
    /// 通道缓冲区已满或没有接收者等待获取数据，该方法会立即返回。
    /// data. Compared with [`send`], this function has two failure cases
    /// 而不是一个（一个用于断开连接，一个用于缓冲区满）。
    ///
    /// See [`send`] for notes about guarantees of whether the
    /// 如果此函数成功执行，将返回接收者是否已收到数据。
    ///
    /// [`send`]: Self::send
    ///
    /// # 示例
    ///
    /// ```rust
    /// use std::sync::mpsc::sync_channel;
    /// use std::thread;
    ///
    /// // Create a sync_channel with buffer size 1
    /// let (sync_sender, receiver) = sync_channel(1);
    /// let sync_sender2 = sync_sender.clone();
    ///
    /// // First thread owns sync_sender
    /// let handle1 = thread::spawn(move || {
    ///     sync_sender.send(1).unwrap();
    ///     sync_sender.send(2).unwrap();
    ///     // Thread blocked
    /// });
    ///
    /// // Second thread owns sync_sender2
    /// let handle2 = thread::spawn(move || {
    ///     // This will return an error and send
    ///     // no message if the buffer is full
    ///     let _ = sync_sender2.try_send(3);
    /// });
    ///
    /// let mut msg;
    /// msg = receiver.recv().unwrap();
    /// println!("message {msg} received");
    ///
    /// msg = receiver.recv().unwrap();
    /// println!("message {msg} received");
    ///
    /// // Third message may have never been sent
    /// match receiver.try_recv() {
    ///     Ok(msg) => println!("message {msg} received"),
    ///     Err(_) => println!("the third message was never sent"),
    /// }
    ///
    /// // Wait for threads to complete
    /// handle1.join().unwrap();
    /// handle2.join().unwrap();
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn try_send(&self, t: T) -> Result<(), TrySendError<T>> {
        self.inner.try_send(t)
    }

    // Attempts to send for a value on this receiver, returning an error if the
    // corresponding channel has hung up, or if it waits more than `timeout`.
    //
    // This method is currently only used for tests.
    #[unstable(issue = "none", feature = "std_internals")]
    #[doc(hidden)]
    pub fn send_timeout(&self, t: T, timeout: Duration) -> Result<(), mpmc::SendTimeoutError<T>> {
        self.inner.send_timeout(t, timeout)
    }

    /// Returns `true` if the channel is empty.
    ///
    /// 注意：零容量通道始终为空。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(mpsc_channel_len)]
    ///
    /// use std::sync::mpsc;
    /// use std::thread;
    ///
    /// let (send, _recv) = mpsc::sync_channel(1);
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
    #[unstable(feature = "mpsc_channel_len", issue = "165247")]
    pub fn is_empty(&self) -> bool {
        self.inner.is_empty()
    }

    /// 返回通道中的消息数量。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(mpsc_channel_len)]
    ///
    /// use std::sync::mpsc;
    ///
    /// let (tx, rx) = mpsc::sync_channel(2);
    ///
    /// assert_eq!(tx.len(), 0);
    ///
    /// tx.send(1u8).unwrap();
    /// tx.send(2u8).unwrap();
    ///
    /// assert_eq!(tx.len(), 2);
    ///
    /// rx.recv().unwrap();
    ///
    /// assert_eq!(tx.len(), 1);
    /// ```
    #[unstable(feature = "mpsc_channel_len", issue = "165247")]
    pub fn len(&self) -> usize {
        self.inner.len()
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T> Clone for SyncSender<T> {
    fn clone(&self) -> SyncSender<T> {
        SyncSender { inner: self.inner.clone() }
    }
}

#[unstable(feature = "share_trait", issue = "156756")]
impl<T> Share for SyncSender<T> {}

#[stable(feature = "mpsc_debug", since = "1.8.0")]
impl<T> fmt::Debug for SyncSender<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("SyncSender").finish_non_exhaustive()
    }
}

////////////////////////////////////////////////////////////////////////////////
// Receiver
////////////////////////////////////////////////////////////////////////////////

impl<T> Receiver<T> {
    /// 在不阻塞的情况下向此接收者返回待处理值的尝试。
    ///
    /// This method will never block the caller in order to wait for data to
    /// 这在决定对接收者进行阻塞之前是一种“乐观检查”的方式。
    /// possible option of pending data on the channel. (See [`std::sync`] for
    /// （一个用于断开连接，一个用于缓冲区空）。
    ///
    /// 这在决定对接收者进行阻塞之前非常有用。
    /// block on a receiver.
    ///
    /// Compared with [`recv`], this function has two failure cases instead of one
    /// # 示例
    ///
    /// [`recv`]: Self::recv
    /// [`std::sync`]: ../index.html#blocking-guarantees
    ///
    /// # 向此接收者等待值的尝试，如果相应的通道已断开，则返回错误。
    ///
    /// ```rust
    /// use std::sync::mpsc::{Receiver, channel};
    ///
    /// let (_, receiver): (_, Receiver<i32>) = channel();
    ///
    /// assert!(receiver.try_recv().is_err());
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn try_recv(&self) -> Result<T, TryRecvError> {
        self.inner.try_recv()
    }

    /// 此接收者将唤醒并返回消息。
    /// corresponding channel has hung up.
    ///
    /// 然而，由于通道有缓冲区，在断开前发送的消息仍会被正确接收。
    /// # 示例
    /// still exists). Once a message is sent to the corresponding [`Sender`]
    /// (or [`SyncSender`]), this receiver will wake up and return that
    /// message.
    ///
    /// If the corresponding [`Sender`] has disconnected, or it disconnects while
    /// this call is blocking, this call will wake up and return [`Err`] to
    /// 不过，由于通道有缓冲区，在断开前发送的消息仍会被正确接收。
    /// 然而，由于通道有缓冲区，在断开前发送的消息仍会被正确接收。
    /// # 示例
    ///
    /// # 示例
    ///
    /// ```
    /// use std::sync::mpsc;
    /// use std::thread;
    ///
    /// let (send, recv) = mpsc::channel();
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
    /// use std::sync::mpsc;
    /// use std::thread;
    /// use std::sync::mpsc::RecvError;
    ///
    /// let (send, recv) = mpsc::channel();
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
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn recv(&self) -> Result<T, RecvError> {
        self.inner.recv()
    }

    /// Attempts to wait for a value on this receiver, returning an error if the
    /// corresponding channel has hung up, or if it waits more than `timeout`.
    ///
    /// 如果没有数据可用且可能发送更多数据（至少有一个发送者存在），则该函数将阻塞当前线程。
    /// 如果没有数据可用且可能发送更多数据（至少有一个发送者存在），则该函数将阻塞当前线程。
    /// still exists). Once a message is sent to the corresponding [`Sender`]
    /// (or [`SyncSender`]), this receiver will wake up and return that
    /// message.
    ///
    /// If the corresponding [`Sender`] has disconnected, or it disconnects while
    /// this call is blocking, this call will wake up and return [`Err`] to
    /// 然而，由于通道有缓冲，在断开前发送的消息仍会被正确接收。
    /// 但是，由于通道有缓冲，在断开前发送的消息仍会被正确接收。
    /// # 示例
    ///
    /// # 成功在超时前接收值：
    ///
    /// 在达到超时时成功接收错误：
    ///
    /// ```no_run
    /// use std::thread;
    /// use std::time::Duration;
    /// use std::sync::mpsc;
    ///
    /// let (send, recv) = mpsc::channel();
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
    /// 在达到超时时接收错误：
    ///
    /// ```no_run
    /// use std::thread;
    /// use std::time::Duration;
    /// use std::sync::mpsc;
    ///
    /// let (send, recv) = mpsc::channel();
    ///
    /// thread::spawn(move || {
    ///     thread::sleep(Duration::from_millis(800));
    ///     send.send('a').unwrap();
    /// });
    ///
    /// assert_eq!(
    ///     recv.recv_timeout(Duration::from_millis(400)),
    ///     Err(mpsc::RecvTimeoutError::Timeout)
    /// );
    /// ```
    #[stable(feature = "mpsc_recv_timeout", since = "1.12.0")]
    pub fn recv_timeout(&self, timeout: Duration) -> Result<T, RecvTimeoutError> {
        self.inner.recv_timeout(timeout)
    }

    /// Attempts to wait for a value on this receiver, returning an error if the
    /// corresponding channel has hung up, or if `deadline` is reached.
    ///
    /// This function will always block the current thread if there is no data
    /// available and it's possible for more data to be sent. Once a message is
    /// sent to the corresponding [`Sender`] (or [`SyncSender`]), then this
    /// 表示此通道将不再接收任何消息。
    ///
    /// If the corresponding [`Sender`] has disconnected, or it disconnects while
    /// this call is blocking, this call will wake up and return [`Err`] to
    /// 成功在截止日期前接收值：
    /// 在达到截止日期时接收错误：
    /// 返回一个迭代器，该迭代器会阻塞等待消息，但永远不会
    ///
    /// # Examples
    ///
    /// # 示例
    ///
    /// ```no_run
    /// #![feature(deadline_api)]
    /// use std::thread;
    /// use std::time::{Duration, Instant};
    /// use std::sync::mpsc;
    ///
    /// let (send, recv) = mpsc::channel();
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
    /// 返回一个迭代器，该迭代器会尝试输出所有待处理值。
    ///
    /// ```no_run
    /// #![feature(deadline_api)]
    /// use std::thread;
    /// use std::time::{Duration, Instant};
    /// use std::sync::mpsc;
    ///
    /// let (send, recv) = mpsc::channel();
    ///
    /// thread::spawn(move || {
    ///     thread::sleep(Duration::from_millis(800));
    ///     send.send('a').unwrap();
    /// });
    ///
    /// assert_eq!(
    ///     recv.recv_deadline(Instant::now() + Duration::from_millis(400)),
    ///     Err(mpsc::RecvTimeoutError::Timeout)
    /// );
    /// ```
    #[unstable(feature = "deadline_api", issue = "46316")]
    pub fn recv_deadline(&self, deadline: Instant) -> Result<T, RecvTimeoutError> {
        self.inner.recv_deadline(deadline)
    }

    /// Returns an iterator that will block waiting for messages, but never
    /// [`panic!`]. It will return [`None`] when the channel has hung up.
    ///
    /// # 示例
    ///
    /// ```rust
    /// use std::sync::mpsc::channel;
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
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn iter(&self) -> Iter<'_, T> {
        Iter { rx: self }
    }

    /// 返回一个迭代器，该迭代器会尝试输出所有待处理值。
    /// It will return `None` if there are no more pending values or if the
    /// channel has hung up. The iterator will never [`panic!`] or block the
    /// # 示例
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::sync::mpsc::channel;
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
    #[stable(feature = "receiver_try_iter", since = "1.15.0")]
    pub fn try_iter(&self) -> TryIter<'_, T> {
        TryIter { rx: self }
    }

    /// Returns `true` if the channel is disconnected.
    ///
    /// Note that a return value of `false` does not guarantee the channel will
    /// # 示例
    /// returns, so a subsequent [`Receiver::recv`] may still fail with [`RecvError`].
    ///
    /// # 注意：零容量通道始终为空。
    ///
    /// ```
    /// #![feature(mpsc_is_disconnected)]
    ///
    /// use std::sync::mpsc::channel;
    ///
    /// let (tx, rx) = channel::<i32>();
    /// assert!(!rx.is_disconnected());
    /// drop(tx);
    /// assert!(rx.is_disconnected());
    /// ```
    #[unstable(feature = "mpsc_is_disconnected", issue = "153668")]
    pub fn is_disconnected(&self) -> bool {
        self.inner.is_disconnected()
    }

    /// Returns `true` if the channel is empty.
    ///
    /// 注意：零容量通道始终为空。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(mpsc_channel_len)]
    ///
    /// use std::sync::mpsc;
    /// use std::thread;
    ///
    /// let (send, recv) = mpsc::channel();
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
    #[unstable(feature = "mpsc_channel_len", issue = "165247")]
    pub fn is_empty(&self) -> bool {
        self.inner.is_empty()
    }

    /// 返回通道中的消息数量。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(mpsc_channel_len)]
    ///
    /// use std::sync::mpsc;
    ///
    /// let (tx, rx) = mpsc::channel();
    ///
    /// assert_eq!(rx.len(), 0);
    ///
    /// tx.send(1u8).unwrap();
    /// tx.send(2u8).unwrap();
    /// assert_eq!(rx.len(), 2);
    ///
    /// rx.recv().unwrap();
    /// assert_eq!(rx.len(), 1);
    /// ```
    #[unstable(feature = "mpsc_channel_len", issue = "165247")]
    pub fn len(&self) -> usize {
        self.inner.len()
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<'a, T> Iterator for Iter<'a, T> {
    type Item = T;

    fn next(&mut self) -> Option<T> {
        self.rx.recv().ok()
    }
}

#[stable(feature = "receiver_try_iter", since = "1.15.0")]
impl<'a, T> Iterator for TryIter<'a, T> {
    type Item = T;

    fn next(&mut self) -> Option<T> {
        self.rx.try_recv().ok()
    }
}

#[stable(feature = "receiver_into_iter", since = "1.1.0")]
impl<'a, T> IntoIterator for &'a Receiver<T> {
    type Item = T;
    type IntoIter = Iter<'a, T>;

    fn into_iter(self) -> Iter<'a, T> {
        self.iter()
    }
}

#[stable(feature = "receiver_into_iter", since = "1.1.0")]
impl<T> Iterator for IntoIter<T> {
    type Item = T;
    fn next(&mut self) -> Option<T> {
        self.rx.recv().ok()
    }
}

#[stable(feature = "receiver_into_iter", since = "1.1.0")]
impl<T> IntoIterator for Receiver<T> {
    type Item = T;
    type IntoIter = IntoIter<T>;

    fn into_iter(self) -> IntoIter<T> {
        IntoIter { rx: self }
    }
}

#[stable(feature = "mpsc_debug", since = "1.8.0")]
impl<T> fmt::Debug for Receiver<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Receiver").finish_non_exhaustive()
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T> fmt::Debug for SendError<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("SendError").finish_non_exhaustive()
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T> fmt::Display for SendError<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        "sending on a closed channel".fmt(f)
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T> error::Error for SendError<T> {}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T> fmt::Debug for TrySendError<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match *self {
            TrySendError::Full(..) => f.debug_tuple("TrySendError::Full").finish_non_exhaustive(),
            TrySendError::Disconnected(..) => {
                f.debug_tuple("TrySendError::Disconnected").finish_non_exhaustive()
            }
        }
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T> fmt::Display for TrySendError<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match *self {
            TrySendError::Full(..) => "sending on a full channel".fmt(f),
            TrySendError::Disconnected(..) => "sending on a closed channel".fmt(f),
        }
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T> error::Error for TrySendError<T> {}

#[stable(feature = "mpsc_error_conversions", since = "1.24.0")]
impl<T> From<SendError<T>> for TrySendError<T> {
    /// Converts a `SendError<T>` into a `TrySendError<T>`.
    ///
    /// This conversion always returns a `TrySendError::Disconnected` containing the data in the `SendError<T>`.
    ///
    /// 不会在堆上分配数据。
    fn from(err: SendError<T>) -> TrySendError<T> {
        match err {
            SendError(t) => TrySendError::Disconnected(t),
        }
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl fmt::Display for RecvError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        "receiving on a closed channel".fmt(f)
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl error::Error for RecvError {}

#[stable(feature = "rust1", since = "1.0.0")]
impl fmt::Display for TryRecvError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match *self {
            TryRecvError::Empty => "receiving on an empty channel".fmt(f),
            TryRecvError::Disconnected => "receiving on a closed channel".fmt(f),
        }
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl error::Error for TryRecvError {}

#[stable(feature = "mpsc_error_conversions", since = "1.24.0")]
impl From<RecvError> for TryRecvError {
    /// Converts a `RecvError` into a `TryRecvError`.
    ///
    /// This conversion always returns `TryRecvError::Disconnected`.
    ///
    /// 不会在堆上分配数据。
    fn from(err: RecvError) -> TryRecvError {
        match err {
            RecvError => TryRecvError::Disconnected,
        }
    }
}

#[stable(feature = "mpsc_recv_timeout_error", since = "1.15.0")]
impl fmt::Display for RecvTimeoutError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match *self {
            RecvTimeoutError::Timeout => "timed out waiting on channel".fmt(f),
            RecvTimeoutError::Disconnected => "channel is empty and sending half is closed".fmt(f),
        }
    }
}

#[stable(feature = "mpsc_recv_timeout_error", since = "1.15.0")]
impl error::Error for RecvTimeoutError {}

#[stable(feature = "mpsc_error_conversions", since = "1.24.0")]
impl From<RecvError> for RecvTimeoutError {
    /// Converts a `RecvError` into a `RecvTimeoutError`.
    ///
    /// This conversion always returns `RecvTimeoutError::Disconnected`.
    ///
    /// 不会在堆上分配数据。
    fn from(err: RecvError) -> RecvTimeoutError {
        match err {
            RecvError => RecvTimeoutError::Disconnected,
        }
    }
}
