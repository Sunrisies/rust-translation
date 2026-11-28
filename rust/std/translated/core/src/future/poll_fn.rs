use crate::fmt;
use crate::future::Future;
use crate::pin::Pin;
use crate::task::{Context, Poll};

/// Creates a future that wraps a function returning [`Poll`].
///
/// 轮询该未来会委托给被封装的函数。如果返回的未来是固定的，那么被封装函数的
/// 捕获的环境也会就地固定，因此只要闭包没有移出其捕获范围，就可以可靠地创建对其的固定引用。
/// # 示例
///
/// # Examples
///
/// ```
/// # async fn run() {
/// use core::future::poll_fn;
/// use std::task::{Context, Poll};
///
/// fn read_line(_cx: &mut Context<'_>) -> Poll<String> {
///     Poll::Ready("Hello, World!".into())
/// }
///
/// let read_future = poll_fn(read_line);
/// assert_eq!(read_future.await, "Hello, World!".to_owned());
/// # }
/// ```
///
/// ## 捕获固定状态
///
/// 一个封装了内部未来的闭包的示例：
///
/// ```
/// # async fn run() {
/// use core::future::{self, Future};
/// use core::task::Poll;
///
/// /// Resolves to the first future that completes. In the event of a tie, `a` wins.
/// fn naive_select<T>(
///     a: impl Future<Output = T>,
///     b: impl Future<Output = T>,
/// ) -> impl Future<Output = T>
/// {
///     let (mut a, mut b) = (Box::pin(a), Box::pin(b));
///     future::poll_fn(move |cx| {
///         if let Poll::Ready(r) = a.as_mut().poll(cx) {
///             Poll::Ready(r)
///         } else if let Poll::Ready(r) = b.as_mut().poll(cx) {
///             Poll::Ready(r)
///         } else {
///             Poll::Pending
///         }
///     })
/// }
///
/// let a = async { 42 };
/// let b = future::pending();
/// let v = naive_select(a, b).await;
/// assert_eq!(v, 42);
///
/// let a = future::pending();
/// let b = async { 27 };
/// let v = naive_select(a, b).await;
/// assert_eq!(v, 27);
///
/// let a = async { 42 };
/// let b = async { 27 };
/// let v = naive_select(a, b).await;
/// assert_eq!(v, 42); // biased towards `a` in case of tie!
/// # }
/// ```
///
/// This time without [`Box::pin`]ning:
///
/// [`Box::pin`]: ../../std/boxed/struct.Box.html#method.pin
///
/// ```
/// # async fn run() {
/// use core::future::{self, Future};
/// use core::pin::pin;
/// use core::task::Poll;
///
/// /// Resolves to the first future that completes. In the event of a tie, `a` wins.
/// fn naive_select<T>(
///     a: impl Future<Output = T>,
///     b: impl Future<Output = T>,
/// ) -> impl Future<Output = T>
/// {
///     async {
///         let (mut a, mut b) = (pin!(a), pin!(b));
///         future::poll_fn(move |cx| {
///             if let Poll::Ready(r) = a.as_mut().poll(cx) {
///                 Poll::Ready(r)
///             } else if let Poll::Ready(r) = b.as_mut().poll(cx) {
///                 Poll::Ready(r)
///             } else {
///                 Poll::Pending
///             }
///         }).await
///     }
/// }
///
/// let a = async { 42 };
/// let b = future::pending();
/// let v = naive_select(a, b).await;
/// assert_eq!(v, 42);
/// # }
/// ```
///
///   - Notice how, by virtue of being in an `async` context, we have been able to make the [`pin!`]
///     macro work, thereby avoiding any need for the `unsafe`
///     <code>[Pin::new_unchecked](&mut fut)</code> constructor.
///
/// [`pin!`]: crate::pin::pin!
#[stable(feature = "future_poll_fn", since = "1.64.0")]
pub fn poll_fn<T, F>(f: F) -> PollFn<F>
where
    F: FnMut(&mut Context<'_>) -> Poll<T>,
{
    PollFn { f }
}

/// A Future that wraps a function returning [`Poll`].
///
/// This `struct` is created by [`poll_fn()`]. See its
/// 文档。
#[must_use = "futures do nothing unless you `.await` or poll them"]
#[stable(feature = "future_poll_fn", since = "1.64.0")]
pub struct PollFn<F> {
    f: F,
}

#[stable(feature = "future_poll_fn", since = "1.64.0")]
impl<F: Unpin> Unpin for PollFn<F> {}

#[stable(feature = "future_poll_fn", since = "1.64.0")]
impl<F> fmt::Debug for PollFn<F> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("PollFn").finish()
    }
}

#[stable(feature = "future_poll_fn", since = "1.64.0")]
impl<T, F> Future for PollFn<F>
where
    F: FnMut(&mut Context<'_>) -> Poll<T>,
{
    type Output = T;

    fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<T> {
        // SAFETY: We are not moving out of the pinned field.
        (unsafe { &mut self.get_unchecked_mut().f })(cx)
    }
}
