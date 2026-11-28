use crate::future::Future;
use crate::pin::Pin;
use crate::task::{Context, Poll};

/// 一个立即准备好值的未来。
///
/// This `struct` is created by [`ready()`]. See its
/// 文档以获取更多信息。
#[stable(feature = "future_readiness_fns", since = "1.48.0")]
#[derive(Debug, Clone)]
#[must_use = "futures do nothing unless you `.await` or poll them"]
pub struct Ready<T>(Option<T>);

#[stable(feature = "future_readiness_fns", since = "1.48.0")]
impl<T> Unpin for Ready<T> {}

#[stable(feature = "future_readiness_fns", since = "1.48.0")]
impl<T> Future for Ready<T> {
    type Output = T;

    #[inline]
    fn poll(mut self: Pin<&mut Self>, _cx: &mut Context<'_>) -> Poll<T> {
        Poll::Ready(self.0.take().expect("`Ready` should not be polled after completion"))
    }
}

impl<T> Ready<T> {
    /// Consumes the `Ready`, returning the wrapped value.
    ///
    /// # 会引发 panic
    ///
    /// Will panic if this [`Ready`] was already polled to completion.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::future;
    ///
    /// let a = future::ready(1);
    /// assert_eq!(a.into_inner(), 1);
    /// ```
    #[stable(feature = "ready_into_inner", since = "1.82.0")]
    #[must_use]
    #[inline]
    pub fn into_inner(self) -> T {
        self.0.expect("`into_inner()` should not be called on `Ready` after completion")
    }
}

/// 创建一个立即准备好值的未来。
///
/// Futures created through this function are functionally similar to those
/// created through `async {}`. The main difference is that futures created
/// through this function are named and implement `Unpin`.
///
/// # Examples
///
/// ```
/// use std::future;
///
/// # async fn run() {
/// let a = future::ready(1);
/// assert_eq!(a.await, 1);
/// # }
/// ```
#[stable(feature = "future_readiness_fns", since = "1.48.0")]
pub fn ready<T>(t: T) -> Ready<T> {
    Ready(Some(t))
}
