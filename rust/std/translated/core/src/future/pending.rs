use crate::fmt::{self, Debug};
use crate::future::Future;
use crate::marker;
use crate::pin::Pin;
use crate::task::{Context, Poll};

/// 创建一个永远无法解析的未来值，表示一种永远
/// 不会完成的计算。
///
/// This `struct` is created by [`pending()`]. See its
/// 文档说明。
#[stable(feature = "future_readiness_fns", since = "1.48.0")]
#[must_use = "futures do nothing unless you `.await` or poll them"]
pub struct Pending<T> {
    _data: marker::PhantomData<fn() -> T>,
}

/// 创建一个永远无法解析的未来值，表示一种永远
/// 不会完成的计算。
///
/// # 示例
///
/// ```no_run
/// use std::future;
///
/// # async fn run() {
/// let future = future::pending();
/// let () = future.await;
/// unreachable!();
/// # }
/// ```
#[stable(feature = "future_readiness_fns", since = "1.48.0")]
pub fn pending<T>() -> Pending<T> {
    Pending { _data: marker::PhantomData }
}

#[stable(feature = "future_readiness_fns", since = "1.48.0")]
impl<T> Future for Pending<T> {
    type Output = T;

    fn poll(self: Pin<&mut Self>, _: &mut Context<'_>) -> Poll<T> {
        Poll::Pending
    }
}

#[stable(feature = "future_readiness_fns", since = "1.48.0")]
impl<T> Debug for Pending<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Pending").finish()
    }
}

#[stable(feature = "future_readiness_fns", since = "1.48.0")]
impl<T> Clone for Pending<T> {
    fn clone(&self) -> Self {
        pending()
    }
}
