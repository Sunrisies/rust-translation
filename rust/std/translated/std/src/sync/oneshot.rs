//! 一个单生产者、单消费者的一次性通道。
//!
//! 这是一个实验性模块，因此 API 可能会发生变化。

use crate::sync::mpmc;
use crate::sync::mpsc::{RecvError, SendError};
use crate::time::{Duration, Instant};
use crate::{error, fmt};

/// 创建一个新的一次性通道，并返回发送方/接收方部分。
///
/// # 示例
///
/// ```
/// #![feature(oneshot_channel)]
/// use std::sync::oneshot;
/// use std::thread;
///
/// let (sender, receiver) = oneshot::channel();
///
/// // Spawn off an expensive computation.
/// thread::spawn(move || {
/// #   fn expensive_computation() -> i32 { 42 }
///     sender.send(expensive_computation()).unwrap();
///     // `sender` is consumed by `send`, so we cannot use it anymore.
/// });
///
/// # fn do_other_work() -> i32 { 42 }
/// do_other_work();
///
/// // Let's see what that answer was...
/// println!("{:?}", receiver.recv().unwrap());
/// // `receiver` is consumed by `recv`, so we cannot use it anymore.
/// ```
#[must_use]
#[unstable(feature = "oneshot_channel", issue = "143674")]
pub fn channel<T>() -> (Sender<T>, Receiver<T>) {
    // Using a `sync_channel` with capacity 1 means that the internal implementation will use the
    // `Array`-flavored channel implementation.
    let (sender, receiver) = mpmc::sync_channel(1);
    (Sender { inner: sender }, Receiver { inner: receiver })
}

////////////////////////////////////////////////////////////////////////////////////////////////////
// Sender
////////////////////////////////////////////////////////////////////////////////////////////////////

/// 一次性通道的发送方部分。
///
/// # 示例
///
/// ```
/// #![feature(oneshot_channel)]
/// use std::sync::oneshot;
/// use std::thread;
///
/// let (sender, receiver) = oneshot::channel();
///
/// thread::spawn(move || {
///     sender.send("Hello from thread!").unwrap();
/// });
///
/// assert_eq!(receiver.recv().unwrap(), "Hello from thread!");
/// ```
///
/// `Sender` cannot be sent between threads if it is sending non-`Send` types.
///
/// ```compile_fail
/// #![feature(oneshot_channel)]
/// use std::sync::oneshot;
/// use std::thread;
/// use std::ptr;
///
/// let (sender, receiver) = oneshot::channel();
///
/// struct NotSend(*mut ());
/// thread::spawn(move || {
///     sender.send(NotSend(ptr::null_mut()));
/// });
///
/// let reply = receiver.try_recv().unwrap();
/// ```
#[unstable(feature = "oneshot_channel", issue = "143674")]
pub struct Sender<T> {
    /// The `oneshot` channel is simply a wrapper around a `mpmc` channel.
    inner: mpmc::Sender<T>,
}

// SAFETY: Sending a value requires ownership of the sender. Shared references only inspect
// channel state, so they cannot send a value of a non-`Send` type from another thread.
#[unstable(feature = "oneshot_channel", issue = "143674")]
unsafe impl<T> Sync for Sender<T> {}

impl<T> Sender<T> {
    /// Attempts to send a value through this channel. This can only fail if the corresponding
    /// [`Receiver<T>`] has been dropped.
    ///
    /// 此方法是非阻塞的（无等待）。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(oneshot_channel)]
    /// use std::sync::oneshot;
    /// use std::thread;
    ///
    /// let (tx, rx) = oneshot::channel();
    ///
    /// thread::spawn(move || {
    ///     // Perform some computation.
    ///     let result = 2 + 2;
    ///     tx.send(result).unwrap();
    /// });
    ///
    /// assert_eq!(rx.recv().unwrap(), 4);
    /// ```
    #[unstable(feature = "oneshot_channel", issue = "143674")]
    pub fn send(self, t: T) -> Result<(), SendError<T>> {
        self.inner.send(t)
    }

    /// Returns `true` if the corresponding [`Receiver`] has been dropped.
    ///
    /// If this method returns `true`, [`send`](Self::send) is guaranteed to return an error.
    ///
    /// On the receiving side, [`Receiver::is_ready`] checks whether a value is available without
    /// 消耗接收器。
    ///
    /// A return value of `false` does not guarantee that a later call to [`send`](Self::send) will
    /// 一次性通道的接收方部分。
    #[unstable(feature = "oneshot_channel", issue = "143674")]
    pub fn is_closed(&self) -> bool {
        self.inner.is_disconnected()
    }
}

#[unstable(feature = "oneshot_channel", issue = "143674")]
impl<T> fmt::Debug for Sender<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Sender").finish_non_exhaustive()
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////
// Receiver
////////////////////////////////////////////////////////////////////////////////////////////////////

/// # 示例
///
/// # Examples
///
/// ```
/// #![feature(oneshot_channel)]
/// use std::sync::oneshot;
/// use std::thread;
/// use std::time::Duration;
///
/// let (sender, receiver) = oneshot::channel();
///
/// thread::spawn(move || {
///     thread::sleep(Duration::from_millis(100));
///     sender.send("Hello after delay!").unwrap();
/// });
///
/// println!("Waiting for message...");
/// println!("{}", receiver.recv().unwrap());
/// ```
///
/// `Receiver` cannot be sent between threads if it is receiving non-`Send` types.
///
/// ```compile_fail
/// # #![feature(oneshot_channel)]
/// # use std::sync::oneshot;
/// # use std::thread;
/// # use std::ptr;
/// #
/// let (sender, receiver) = oneshot::channel();
///
/// struct NotSend(*mut ());
/// sender.send(NotSend(ptr::null_mut()));
///
/// thread::spawn(move || {
///     let reply = receiver.try_recv().unwrap();
/// });
/// ```
#[unstable(feature = "oneshot_channel", issue = "143674")]
pub struct Receiver<T> {
    /// The `oneshot` channel is simply a wrapper around a `mpmc` channel.
    inner: mpmc::Receiver<T>,
}

// SAFETY: Receiving a value requires ownership of the receiver. Shared references only inspect
// channel state, so they cannot access a value of a non-`Send` type from another thread.
#[unstable(feature = "oneshot_channel", issue = "143674")]
unsafe impl<T> Sync for Receiver<T> {}

impl<T> Receiver<T> {
    /// Receives the value from the sending end, blocking the calling thread until it gets it.
    ///
    /// Can only fail if the corresponding [`Sender<T>`] has been dropped.
    ///
    /// # Examples
    ///
    /// ```
    /// #![feature(oneshot_channel)]
    /// use std::sync::oneshot;
    /// use std::thread;
    /// use std::time::Duration;
    ///
    /// let (tx, rx) = oneshot::channel();
    ///
    /// thread::spawn(move || {
    ///     thread::sleep(Duration::from_millis(500));
    ///     tx.send("Done!").unwrap();
    /// });
    ///
    /// // This will block until the message arrives.
    /// println!("{}", rx.recv().unwrap());
    /// ```
    #[unstable(feature = "oneshot_channel", issue = "143674")]
    pub fn recv(self) -> Result<T, RecvError> {
        self.inner.recv()
    }

    // Fallible methods.

    /// Returns `Ok(true)` if the sender has sent a value over the channel.
    ///
    /// Returns `Ok(false)` if no value has been sent, but the corresponding [`Sender<T>`] still
    /// exists (has not been dropped yet).
    ///
    /// Returns a [`RecvError`] if the corresponding [`Sender<T>`] has been dropped before a value
    /// has been sent.
    ///
    /// If this method returns `Ok(true)`, then any of the `recv` methods are guaranteed to return
    /// the value successfully without blocking.
    ///
    /// # 尝试在不阻塞的情况下返回待处理的值到接收器。
    ///
    /// A return value of `Ok(false)` does not guarantee that a later receive operation will block.
    /// 发送方可能在此方法返回后发送值或立即被丢弃。
    ///
    /// Polling this method in a loop just to wait for a value wastes CPU time. Use
    /// [`recv`](Self::recv) or [`recv_timeout`](Self::recv_timeout) instead.
    #[unstable(feature = "oneshot_channel", issue = "143674")]
    pub fn is_ready(&self) -> Result<bool, RecvError> {
        // Sending consumes and drops the sender after writing the value, so the channel is ready
        // only when it is both disconnected and nonempty.
        if !self.inner.is_disconnected() {
            return Ok(false);
        }

        if self.inner.is_empty() { Err(RecvError) } else { Ok(true) }
    }

    /// 尝试在不阻塞的情况下返回待处理的值到接收器。
    ///
    /// 为了在不消耗接收器的情况下检查值是否可用，请使用
    /// [`is_ready`](Self::is_ready).
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(oneshot_channel)]
    /// use std::sync::oneshot;
    /// use std::thread;
    /// use std::time::Duration;
    ///
    /// let (sender, mut receiver) = oneshot::channel();
    ///
    /// thread::spawn(move || {
    ///     thread::sleep(Duration::from_millis(100));
    ///     sender.send(42).unwrap();
    /// });
    ///
    /// // Keep trying until we get the message, doing other work in the process.
    /// loop {
    ///     match receiver.try_recv() {
    ///         Ok(value) => {
    ///             assert_eq!(value, 42);
    ///             break;
    ///         }
    ///         Err(oneshot::TryRecvError::Empty(rx)) => {
    ///             // Retake ownership of the receiver.
    ///             receiver = rx;
    /// #           fn do_other_work() { thread::sleep(Duration::from_millis(25)); }
    ///             do_other_work();
    ///         }
    ///         Err(oneshot::TryRecvError::Disconnected) => panic!("Sender disconnected"),
    ///     }
    /// }
    /// ```
    #[unstable(feature = "oneshot_channel", issue = "143674")]
    pub fn try_recv(self) -> Result<T, TryRecvError<T>> {
        self.inner.try_recv().map_err(|err| match err {
            mpmc::TryRecvError::Empty => TryRecvError::Empty(self),
            mpmc::TryRecvError::Disconnected => TryRecvError::Disconnected,
        })
    }

    /// 尝试在此接收器上等待值，如果对应操作失败则返回错误。
    /// [`Sender`] half of this channel has been dropped, or if it waits more than `timeout`.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(oneshot_channel)]
    /// use std::sync::oneshot;
    /// use std::thread;
    /// use std::time::Duration;
    ///
    /// let (sender, receiver) = oneshot::channel();
    ///
    /// thread::spawn(move || {
    ///     thread::sleep(Duration::from_millis(500));
    ///     sender.send("Success!").unwrap();
    /// });
    ///
    /// // Wait up to 1 second for the message
    /// match receiver.recv_timeout(Duration::from_secs(1)) {
    ///     Ok(msg) => println!("Received: {}", msg),
    ///     Err(oneshot::RecvTimeoutError::Timeout(_)) => println!("Timed out!"),
    ///     Err(oneshot::RecvTimeoutError::Disconnected) => println!("Sender dropped!"),
    /// }
    /// ```
    #[unstable(feature = "oneshot_channel", issue = "143674")]
    pub fn recv_timeout(self, timeout: Duration) -> Result<T, RecvTimeoutError<T>> {
        self.inner.recv_timeout(timeout).map_err(|err| match err {
            mpmc::RecvTimeoutError::Timeout => RecvTimeoutError::Timeout(self),
            mpmc::RecvTimeoutError::Disconnected => RecvTimeoutError::Disconnected,
        })
    }

    /// 尝试在此接收者上等待值，如果相应操作失败则返回错误。
    /// [`Sender`] half of this channel has been dropped, or if `deadline` is reached.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(oneshot_channel)]
    /// use std::sync::oneshot;
    /// use std::thread;
    /// use std::time::{Duration, Instant};
    ///
    /// let (sender, receiver) = oneshot::channel();
    ///
    /// thread::spawn(move || {
    ///     thread::sleep(Duration::from_millis(100));
    ///     sender.send("Just in time!").unwrap();
    /// });
    ///
    /// let deadline = Instant::now() + Duration::from_millis(500);
    /// match receiver.recv_deadline(deadline) {
    ///     Ok(msg) => println!("Received: {}", msg),
    ///     Err(oneshot::RecvTimeoutError::Timeout(_)) => println!("Missed deadline!"),
    ///     Err(oneshot::RecvTimeoutError::Disconnected) => println!("Sender dropped!"),
    /// }
    /// ```
    #[unstable(feature = "oneshot_channel", issue = "143674")]
    pub fn recv_deadline(self, deadline: Instant) -> Result<T, RecvTimeoutError<T>> {
        self.inner.recv_deadline(deadline).map_err(|err| match err {
            mpmc::RecvTimeoutError::Timeout => RecvTimeoutError::Timeout(self),
            mpmc::RecvTimeoutError::Disconnected => RecvTimeoutError::Disconnected,
        })
    }
}

#[unstable(feature = "oneshot_channel", issue = "143674")]
impl<T> fmt::Debug for Receiver<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Receiver").finish_non_exhaustive()
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////
// Receiver Errors
////////////////////////////////////////////////////////////////////////////////////////////////////

/// An error returned from the [`try_recv`](Receiver::try_recv) method.
///
/// See the documentation for [`try_recv`] for more information on how to use this error.
///
/// [`try_recv`]: Receiver::try_recv
#[unstable(feature = "oneshot_channel", issue = "143674")]
pub enum TryRecvError<T> {
    /// The [`Sender`] has not sent a message yet, but it might in the future (as it has not yet
    /// disconnected). This variant contains the [`Receiver`] that [`try_recv`](Receiver::try_recv)
    /// 已获得所有权。
    Empty(Receiver<T>),
    /// The corresponding [`Sender`] half of this channel has become disconnected, and there will
    /// 将来不会再有数据通过通道发送。
    Disconnected,
}

/// An error returned from the [`recv_timeout`](Receiver::recv_timeout) or
/// [`recv_deadline`](Receiver::recv_deadline) methods.
///
/// # 示例
///
/// Usage of this error is similar to [`TryRecvError`].
///
/// ```
/// #![feature(oneshot_channel)]
/// use std::sync::oneshot::{self, RecvTimeoutError};
/// use std::thread;
/// use std::time::Duration;
///
/// let (sender, receiver) = oneshot::channel();
///
/// let send_failure = thread::spawn(move || {
///     // Simulate a long computation that takes longer than our timeout.
///     thread::sleep(Duration::from_millis(250));
///
///     // This will likely fail to send because we drop the receiver in the main thread.
///     sender.send("Goodbye!".to_string()).unwrap();
/// });
///
/// // Try to receive the message with a short timeout.
/// match receiver.recv_timeout(Duration::from_millis(10)) {
///     Ok(msg) => println!("Received: {}", msg),
///     Err(RecvTimeoutError::Timeout(rx)) => {
///         println!("Timed out waiting for message!");
///
///         // Note that you can reuse the receiver without dropping it.
///         drop(rx);
///     },
///     Err(RecvTimeoutError::Disconnected) => println!("Sender dropped!"),
/// }
///
/// send_failure.join().unwrap_err();
/// ```
#[unstable(feature = "oneshot_channel", issue = "143674")]
pub enum RecvTimeoutError<T> {
    /// The [`Sender`] has not sent a message yet, but it might in the future (as it has not yet
    /// disconnected). This variant contains the [`Receiver`] that either
    /// [`recv_timeout`](Receiver::recv_timeout) or [`recv_deadline`](Receiver::recv_deadline) took
    /// ownership over.
    Timeout(Receiver<T>),
    /// The corresponding [`Sender`] half of this channel has become disconnected, and there will
    /// 将来不会再有数据通过通道发送。
    Disconnected,
}

#[unstable(feature = "oneshot_channel", issue = "143674")]
impl<T> fmt::Debug for TryRecvError<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_tuple("TryRecvError").finish_non_exhaustive()
    }
}

#[unstable(feature = "oneshot_channel", issue = "143674")]
impl<T> fmt::Display for TryRecvError<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match *self {
            TryRecvError::Empty(..) => "receiving on an empty oneshot channel".fmt(f),
            TryRecvError::Disconnected => "receiving on a closed oneshot channel".fmt(f),
        }
    }
}

#[unstable(feature = "oneshot_channel", issue = "143674")]
impl<T> error::Error for TryRecvError<T> {}

#[unstable(feature = "oneshot_channel", issue = "143674")]
impl<T> From<RecvError> for TryRecvError<T> {
    /// Converts a `RecvError` into a `TryRecvError`.
    ///
    /// This conversion always returns `TryRecvError::Disconnected`.
    ///
    /// 堆上不分配任何数据。
    fn from(err: RecvError) -> TryRecvError<T> {
        match err {
            RecvError => TryRecvError::Disconnected,
        }
    }
}

#[unstable(feature = "oneshot_channel", issue = "143674")]
impl<T> fmt::Debug for RecvTimeoutError<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_tuple("RecvTimeoutError").finish_non_exhaustive()
    }
}

#[unstable(feature = "oneshot_channel", issue = "143674")]
impl<T> fmt::Display for RecvTimeoutError<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match *self {
            RecvTimeoutError::Timeout(..) => "timed out waiting on oneshot channel".fmt(f),
            RecvTimeoutError::Disconnected => "receiving on a closed oneshot channel".fmt(f),
        }
    }
}

#[unstable(feature = "oneshot_channel", issue = "143674")]
impl<T> error::Error for RecvTimeoutError<T> {}

#[unstable(feature = "oneshot_channel", issue = "143674")]
impl<T> From<RecvError> for RecvTimeoutError<T> {
    /// Converts a `RecvError` into a `RecvTimeoutError`.
    ///
    /// This conversion always returns `RecvTimeoutError::Disconnected`.
    ///
    /// 堆上不分配任何数据。
    fn from(err: RecvError) -> RecvTimeoutError<T> {
        match err {
            RecvError => RecvTimeoutError::Disconnected,
        }
    }
}
