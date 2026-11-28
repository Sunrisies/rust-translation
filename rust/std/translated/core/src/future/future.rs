#![stable(feature = "futures_api", since = "1.36.0")]

use crate::ops;
use crate::pin::Pin;
use crate::task::{Context, Poll};

/// 未来表示异步计算，通常是通过使用以下方式获得的
/// [`async`].
///
/// 未来是一个可能尚未完成计算的值。这种
/// “异步值”使得线程可以在等待值可用时继续进行有用的
/// 工作。
///
/// # The `poll` method
///
/// The core method of future, `poll`, *attempts* to resolve the future into a
/// 最终值。如果值尚未准备好，该方法不会阻塞。相反，
/// the current task is scheduled to be woken up when it's possible to make
/// further progress by `poll`ing again. The `context` passed to the `poll`
/// method can provide a [`Waker`], which is a handle for waking up the current
/// 任务的句柄。
///
/// When using a future, you generally won't call `poll` directly, but instead
/// `.await` the value.
///
/// [`async`]: ../../std/keyword.async.html
/// [`Waker`]: crate::task::Waker
#[doc(notable_trait(color = "transparent"))]
#[doc(search_unbox)]
#[must_use = "futures do nothing unless you `.await` or poll them"]
#[stable(feature = "futures_api", since = "1.36.0")]
#[lang = "future_trait"]
#[diagnostic::on_unimplemented(
    label = "`{Self}` is not a future",
    message = "`{Self}` is not a future"
)]
pub trait Future {
    /// 完成时产生的值的类型。
    #[stable(feature = "futures_api", since = "1.36.0")]
    #[lang = "future_output"]
    type Output;

    /// 尝试将未来解析为最终值，如果值尚未可用，则注册
    /// 当前任务等待唤醒。
    ///
    /// # 返回值
    ///
    /// 此函数返回：
    ///
    /// - [`Poll::Pending`] if the future is not ready yet
    /// - [`Poll::Ready(val)`] with the result `val` of this future if it
    /// 。
    ///
    /// Once a future has finished, clients should not `poll` it again.
    ///
    /// When a future is not ready yet, `poll` returns `Poll::Pending` and
    /// stores a clone of the [`Waker`] copied from the current [`Context`].
    /// This [`Waker`] is then woken once the future can make progress.
    /// 例如，等待套接字可读取的未来会在
    /// readable would call `.clone()` on the [`Waker`] and store it.
    /// 当其他地方收到信号表示套接字可读取时，
    /// [`Waker::wake`] is called and the socket future's task is awoken.
    /// Once a task has been woken up, it should attempt to `poll` the future
    /// ，这可能会或不会产生最终值。
    ///
    /// Note that on multiple calls to `poll`, only the [`Waker`] from the
    /// [`Context`] passed to the most recent call should be scheduled to
    /// 。
    ///
    /// # 运行时特性
    ///
    /// Futures alone are *inert*; they must be *actively* `poll`ed for the
    /// underlying computation to make progress, meaning that each time the
    /// current task is woken up, it should actively re-`poll` pending futures
    /// 。
    ///
    /// 尽管如此，某些未来可能代表一个正在被计算的数值。
    /// 在另一个任务中计算。在这种情况下，未来的底层机制
    /// 计算实际上只是作为值计算的通道
    /// 被那个其他任务处理，该任务将独立于 Future 运行。
    /// 这种类型的 Future 通常在向异步运行时启动新任务时获得。
    /// async runtime.
    ///
    /// The `poll` function should not be called repeatedly in a tight loop --
    /// instead, it should only be called when the future indicates that it is
    /// ready to make progress (by calling `wake()`). If you're familiar with the
    /// `poll(2)` or `select(2)` syscalls on Unix it's worth noting that futures
    /// typically do *not* suffer the same problems of "all wakeups must poll
    /// all events"; they are more like `epoll(4)`.
    ///
    /// An implementation of `poll` should strive to return quickly, and should
    /// not block. Returning quickly prevents unnecessarily clogging up
    /// 无论 Future 的状态如何。
    /// `poll` may end up taking a while, the work should be offloaded to a
    /// thread pool (or something similar) to ensure that `poll` can return
    /// quickly.
    ///
    /// # Panics
    ///
    /// Once a future has completed (returned `Ready` from `poll`), calling its
    /// `poll` method again may panic, block forever, or cause other kinds of
    /// problems; the `Future` trait places no requirements on the effects of
    /// such a call. However, as the `poll` method is not marked `unsafe`,
    /// Rust's usual rules apply: calls must never cause undefined behavior
    /// (memory corruption, incorrect use of `unsafe` functions, or the like),
    /// regardless of the future's state.
    ///
    /// [`Poll::Ready(val)`]: Poll::Ready
    /// [`Waker`]: crate::task::Waker
    /// [`Waker::wake`]: crate::task::Waker::wake
    #[lang = "poll"]
    #[stable(feature = "futures_api", since = "1.36.0")]
    fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output>;
}

#[stable(feature = "futures_api", since = "1.36.0")]
impl<F: ?Sized + Future + Unpin> Future for &mut F {
    type Output = F::Output;

    fn poll(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output> {
        F::poll(Pin::new(&mut **self), cx)
    }
}

#[stable(feature = "futures_api", since = "1.36.0")]
impl<P> Future for Pin<P>
where
    P: ops::DerefMut<Target: Future>,
{
    type Output = <<P as ops::Deref>::Target as Future>::Output;

    fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output> {
        <P::Target as Future>::poll(self.as_deref_mut(), cx)
    }
}
