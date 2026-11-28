//! Linux and Android-specific tcp extensions to primitives in the [`std::net`] module.
//!
//! [`std::net`]: crate::net

use crate::macros::rustdoc_skip_body;
use crate::sys::AsInner;
#[cfg(target_os = "linux")]
use crate::time::Duration;
use crate::{io, net};

/// Os-specific extensions for [`TcpStream`]
///
/// [`TcpStream`]: net::TcpStream
#[stable(feature = "tcp_quickack", since = "1.89.0")]
pub impl(self) trait TcpStreamExt {
    /// Enable or disable `TCP_QUICKACK`.
    ///
    /// 此标志使 Linux 立即发送 ACK，而非延迟发送。
    /// 在对套接字进行进一步操作后，Linux 可能会重置此标志。
    ///
    /// See [`man 7 tcp`](https://man7.org/linux/man-pages/man7/tcp.7.html) and
    /// [TCP delayed acknowledgement](https://en.wikipedia.org/wiki/TCP_delayed_acknowledgment)
    /// 以获取更多信息。
    ///
    /// # 示例
    ///
    #[cfg_attr(
        any(target_os = "linux", target_os = "android", target_os = "cygwin"),
        doc = "```no_run"
    )]
    #[cfg_attr(
        not(any(target_os = "linux", target_os = "android", target_os = "cygwin")),
        doc = "```ignore (needs linux)"
    )]
    /// use std::net::TcpStream;
    /// #[cfg(target_os = "linux")]
    /// use std::os::linux::net::TcpStreamExt;
    /// #[cfg(target_os = "android")]
    /// use std::os::android::net::TcpStreamExt;
    ///
    /// let stream = TcpStream::connect("127.0.0.1:8080")
    /// .expect("无法连接到服务器...");
    /// stream.set_quickack(true).expect("set_quickack 调用失败");
    /// ```
    #[stable(feature = "tcp_quickack", since = "1.89.0")]
    fn set_quickack(&self, quickack: bool) -> io::Result<()>;

    /// Gets the value of the `TCP_QUICKACK` option on this socket.
    ///
    /// For more information about this option, see [`TcpStreamExt::set_quickack`].
    ///
    /// # Examples
    ///
    #[cfg_attr(
        any(target_os = "linux", target_os = "android", target_os = "cygwin"),
        doc = "```no_run"
    )]
    #[cfg_attr(
        not(any(target_os = "linux", target_os = "android", target_os = "cygwin")),
        doc = "```ignore (needs linux)"
    )]
    /// use std::net::TcpStream;
    /// #[cfg(target_os = "linux")]
    /// use std::os::linux::net::TcpStreamExt;
    /// #[cfg(target_os = "android")]
    /// use std::os::android::net::TcpStreamExt;
    ///
    /// let stream = TcpStream::connect("127.0.0.1:8080")
    ///         .expect("Couldn't connect to the server...");
    /// stream.set_quickack(true).expect("set_quickack call failed");
    /// assert_eq!(stream.quickack().unwrap_or(false), true);
    /// ```
    #[stable(feature = "tcp_quickack", since = "1.89.0")]
    fn quickack(&self) -> io::Result<bool>;

    /// 仅当数据到达时，套接字监听器才会被唤醒。
    ///
    /// The `accept` argument set the maximum delay until the
    /// 数据可供读取，从而减少了没有数据处理的
    /// 短暂连接的数量。
    /// Contrary to other platforms `SO_ACCEPTFILTER` feature equivalent, there is
    /// no necessity to set it after the `listen` call.
    /// 请注意，延迟是从用户视角表达的 Duration。
    /// the call rounds it down to the nearest second expressible as a `c_int`.
    ///
    /// See [`man 7 tcp`](https://man7.org/linux/man-pages/man7/tcp.7.html)
    ///
    /// # 示例
    ///
    /// ```no run
    /// #![feature(tcp_deferaccept)]
    /// use std::net::TcpStream;
    /// use std::os::linux::net::TcpStreamExt;
    /// use std::time::Duration;
    ///
    /// let stream = TcpStream::connect("127.0.0.1:8080")
    ///         .expect("Couldn't connect to the server...");
    /// stream.set_deferaccept(Duration::from_secs(1u64)).expect("set_deferaccept call failed");
    /// ```
    #[unstable(feature = "tcp_deferaccept", issue = "119639")]
    #[cfg(target_os = "linux")]
    fn set_deferaccept(&self, accept: Duration) -> io::Result<()>;

    /// Gets the accept delay value of the `TCP_DEFER_ACCEPT` option.
    ///
    /// For more information about this option, see [`TcpStreamExt::set_deferaccept`].
    ///
    /// # 示例
    ///
    #[cfg_attr(
        any(target_os = "linux", target_os = "android", target_os = "cygwin"),
        doc = "```no_run"
    )]
    #[cfg_attr(
        not(any(target_os = "linux", target_os = "android", target_os = "cygwin")),
        doc = "```ignore (needs linux)"
    )]
    /// #![feature(tcp_deferaccept)]
    /// use std::net::TcpStream;
    /// use std::os::linux::net::TcpStreamExt;
    /// use std::time::Duration;
    ///
    /// let stream = TcpStream::connect("127.0.0.1:8080")
    /// .expect("无法连接到服务器...");
    /// stream.set_deferaccept(Duration::from_secs(1u64)).expect("set_deferaccept 调用失败");
    /// assert_eq!(stream.deferaccept().unwrap(), Duration::from_secs(1u64));
    /// ```
    #[unstable(feature = "tcp_deferaccept", issue = "119639")]
    #[cfg(target_os = "linux")]
    fn deferaccept(&self) -> io::Result<Duration>;
}

#[stable(feature = "tcp_quickack", since = "1.89.0")]
impl TcpStreamExt for net::TcpStream {
    #[rustdoc_skip_body]
    fn set_quickack(&self, quickack: bool) -> io::Result<()> {
        self.as_inner().as_inner().set_quickack(quickack)
    }

    #[rustdoc_skip_body]
    fn quickack(&self) -> io::Result<bool> {
        self.as_inner().as_inner().quickack()
    }

    #[cfg(target_os = "linux")]
    fn set_deferaccept(&self, accept: Duration) -> io::Result<()> {
        self.as_inner().as_inner().set_deferaccept(accept)
    }

    #[cfg(target_os = "linux")]
    fn deferaccept(&self) -> io::Result<Duration> {
        self.as_inner().as_inner().deferaccept()
    }
}
