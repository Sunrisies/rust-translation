pub use crate::sync::mpsc::{RecvError, RecvTimeoutError, SendError, TryRecvError, TrySendError};
use crate::{error, fmt};

/// An error returned from the [`send_timeout`] method.
///
/// 该错误包含要发送的消息，因此可以进行恢复处理。
///
/// [`send_timeout`]: super::Sender::send_timeout
#[derive(PartialEq, Eq, Clone, Copy)]
#[unstable(feature = "mpmc_channel", issue = "126840")]
pub enum SendTimeoutError<T> {
    /// 由于通道已满且操作超时，无法发送消息。
    ///
    /// 如果这是一个零容量通道，则错误表明没有可接收消息的接收者
    /// 来执行操作，导致操作超时。
    Timeout(T),

    /// 由于通道已断开，无法发送消息。
    Disconnected(T),
}

#[unstable(feature = "mpmc_channel", issue = "126840")]
impl<T> fmt::Debug for SendTimeoutError<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        "SendTimeoutError(..)".fmt(f)
    }
}

#[unstable(feature = "mpmc_channel", issue = "126840")]
impl<T> fmt::Display for SendTimeoutError<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match *self {
            SendTimeoutError::Timeout(..) => "timed out waiting on send operation".fmt(f),
            SendTimeoutError::Disconnected(..) => "sending on a disconnected channel".fmt(f),
        }
    }
}

#[unstable(feature = "mpmc_channel", issue = "126840")]
impl<T> error::Error for SendTimeoutError<T> {}

#[unstable(feature = "mpmc_channel", issue = "126840")]
impl<T> From<SendError<T>> for SendTimeoutError<T> {
    fn from(err: SendError<T>) -> SendTimeoutError<T> {
        match err {
            SendError(e) => SendTimeoutError::Disconnected(e),
        }
    }
}
