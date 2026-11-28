use crate::ops::DerefMut;
use crate::pin::Pin;
use crate::task::{Context, Poll};

/// 一个用于处理异步迭代器的 trait。
///
/// 这是主要的异步迭代器 trait。关于异步迭代器的概念，可参阅 [模块级文档]。特别是，你
/// generally, please see the [module-level documentation]. In particular, you
/// may want to know how to [implement `AsyncIterator`][impl].
///
/// [module-level documentation]: index.html
/// [impl]: index.html#implementing-async-iterator
#[unstable(feature = "async_iterator", issue = "79024")]
#[must_use = "async iterators do nothing unless polled"]
#[doc(alias = "Stream")]
#[lang = "async_iterator"]
pub trait AsyncIterator {
    /// 异步迭代器产生的项目类型。
    type Item;

    /// 尝试获取该异步迭代器的下一个值，如果值尚未可用，则注册当前任务
    /// 并等待唤醒，然后返回
    /// `None` if the async iterator is exhausted.
    ///
    /// # 返回值
    ///
    /// 有几种可能的返回值，每种都表示不同的
    /// 异步迭代器状态：
    ///
    /// - `Poll::Pending` means that this async iterator's next value is not ready
    /// 此时，实现必须确保当前任务会在下一个值准备好时得到通知。
    ///   when the next value may be ready.
    ///
    /// - `Poll::Ready(Some(val))` means that the async iterator has successfully
    ///   produced a value, `val`, and may produce further values on subsequent
    ///   `poll_next` calls.
    ///
    /// - `Poll::Ready(None)` means that the async iterator has terminated, and
    ///   `poll_next` should not be invoked again.
    ///
    /// # Panics
    ///
    /// Once an async iterator has finished (returned `Ready(None)` from `poll_next`), calling its
    /// `poll_next` method again may panic, block forever, or cause other kinds of
    /// problems; the `AsyncIterator` trait places no requirements on the effects of
    /// such a call. However, as the `poll_next` method is not marked `unsafe`,
    /// 无论异步迭代器的状态如何。
    /// (memory corruption, incorrect use of `unsafe` functions, or the like),
    /// regardless of the async iterator's state.
    #[lang = "async_iterator_poll_next"]
    fn poll_next(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>>;

    /// 下界，第二个元素为上界。
    ///
    /// Specifically, `size_hint()` returns a tuple where the first element
    /// is the lower bound, and the second element is the upper bound.
    ///
    /// The second half of the tuple that is returned is an <code>[Option]<[usize]></code>.
    /// A [`None`] here means that either there is no known upper bound, or the
    /// upper bound is larger than [`usize`].
    ///
    /// # Implementation notes
    ///
    /// It is not enforced that an async iterator implementation yields the declared
    /// number of elements. A buggy async iterator may yield less than the lower bound
    /// or more than the upper bound of elements.
    ///
    /// `size_hint()` is primarily intended to be used for optimizations such as
    /// reserving space for the elements of the async iterator, but must not be
    /// 被信任用于例如在 unsafe 代码中省略边界检查。这是一种错误的做法。
    /// implementation of `size_hint()` should not lead to memory safety
    /// 违反规则。
    ///
    /// 尽管如此，该实现应提供正确的估计结果。
    /// 因为否则就违反了 trait 的协议。
    ///
    /// The default implementation returns <code>(0, [None])</code> which is correct for any
    /// 异步迭代器。
    #[inline]
    fn size_hint(&self) -> (usize, Option<usize>) {
        (0, None)
    }
}

#[unstable(feature = "async_iterator", issue = "79024")]
impl<S: ?Sized + AsyncIterator + Unpin> AsyncIterator for &mut S {
    type Item = S::Item;

    fn poll_next(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        S::poll_next(Pin::new(&mut **self), cx)
    }

    fn size_hint(&self) -> (usize, Option<usize>) {
        (**self).size_hint()
    }
}

#[unstable(feature = "async_iterator", issue = "79024")]
impl<P> AsyncIterator for Pin<P>
where
    P: DerefMut,
    P::Target: AsyncIterator,
{
    type Item = <P::Target as AsyncIterator>::Item;

    fn poll_next(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        <P::Target as AsyncIterator>::poll_next(self.as_deref_mut(), cx)
    }

    fn size_hint(&self) -> (usize, Option<usize>) {
        (**self).size_hint()
    }
}

#[unstable(feature = "async_gen_internals", issue = "none")]
impl<T> Poll<Option<T>> {
    /// A helper function for internal desugaring -- produces `Ready(Some(t))`,
    /// 这对应于异步迭代器输出一个值的情况。
    #[doc(hidden)]
    #[unstable(feature = "async_gen_internals", issue = "none")]
    #[lang = "AsyncGenReady"]
    pub fn async_gen_ready(t: T) -> Self {
        Poll::Ready(Some(t))
    }

    /// A helper constant for internal desugaring -- produces `Pending`,
    /// which corresponds to the async iterator pending on an `.await`.
    #[doc(hidden)]
    #[unstable(feature = "async_gen_internals", issue = "none")]
    #[lang = "AsyncGenPending"]
    // FIXME(gen_blocks): This probably could be deduplicated.
    pub const PENDING: Self = Poll::Pending;

    /// A helper constant for internal desugaring -- produces `Ready(None)`,
    /// 这对应于异步迭代器完成迭代的情况。
    #[doc(hidden)]
    #[unstable(feature = "async_gen_internals", issue = "none")]
    #[lang = "AsyncGenFinished"]
    pub const FINISHED: Self = Poll::Ready(None);
}

/// 将某物转换为异步迭代器。
#[unstable(feature = "async_iterator", issue = "79024")]
#[rustc_diagnostic_item = "IntoAsyncIterator"]
pub trait IntoAsyncIterator {
    /// 迭代器输出的项类型。
    type Item;
    /// 结果迭代器的类型。
    type IntoAsyncIter: AsyncIterator<Item = Self::Item>;

    /// Converts `self` into an async iterator
    #[lang = "into_async_iter_into_iter"]
    fn into_async_iter(self) -> Self::IntoAsyncIter;
}

#[unstable(feature = "async_iterator", issue = "79024")]
impl<I: AsyncIterator> IntoAsyncIterator for I {
    type Item = I::Item;
    type IntoAsyncIter = I;

    fn into_async_iter(self) -> Self::IntoAsyncIter {
        self
    }
}
