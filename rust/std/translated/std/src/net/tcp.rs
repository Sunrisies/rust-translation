#![deny(unsafe_op_in_unsafe_fn)]

#[cfg(all(
    test,
    not(any(
        target_os = "emscripten",
        all(target_os = "wasi", target_env = "p1"),
        target_os = "xous",
        target_os = "trusty",
        target_os = "l4re",
    ))
))]
mod tests;

use crate::fmt;
use crate::io::prelude::*;
use crate::io::{self, BorrowedCursor, IoSlice, IoSliceMut};
use crate::iter::FusedIterator;
use crate::net::{Shutdown, SocketAddr, ToSocketAddrs};
use crate::sys::{AsInner, FromInner, IntoInner, net as net_imp};
use crate::time::Duration;

/// 本地与远程套接字之间的 TCP 流。
///
/// After creating a `TcpStream` by either [`connect`]ing to a remote host or
/// [`accept`]ing a connection on a [`TcpListener`], data can be transmitted
/// 通过对其 [读取] 和 [写入] 来实现。
///
/// 当变量被丢弃时，连接将被关闭。读取和写入
/// portions of the connection can also be shut down individually with the [`shutdown`]
/// 传输控制协议在 [IETF RFC 793] 中有规定。
///
/// # 示例
///
/// [`accept`]: TcpListener::accept
/// [`connect`]: TcpStream::connect
/// [IETF RFC 793]: https://tools.ietf.org/html/rfc793
/// [reading]: Read
/// [`shutdown`]: TcpStream::shutdown
/// [writing]: Write
///
/// # Examples
///
/// ```no_run
/// use std::io::prelude::*;
/// use std::net::TcpStream;
///
/// fn main() -> std::io::Result<()> {
///     let mut stream = TcpStream::connect("127.0.0.1:34254")?;
///
///     stream.write(&[1])?;
///     stream.read(&mut [0; 128])?;
///     Ok(())
/// } // the stream is closed here
/// ```
///
/// # 平台特定行为
///
/// On Unix, writes to the underlying socket in `SOCK_STREAM` mode are made with
/// `MSG_NOSIGNAL` flag. This suppresses the emission of the  `SIGPIPE` signal when writing
/// to disconnected socket. In some cases, getting a `SIGPIPE` would trigger process termination.
#[stable(feature = "rust1", since = "1.0.0")]
pub struct TcpStream(net_imp::TcpStream);

/// 一个监听连接的 TCP 套接字服务器。
///
/// After creating a `TcpListener` by [`bind`]ing it to a socket address, it listens
/// for incoming TCP connections. These can be accepted by calling [`accept`] or by
/// iterating over the [`Incoming`] iterator returned by [`incoming`][`TcpListener::incoming`].
///
/// 当变量被丢弃时，套接字将被关闭。
///
/// 传输控制协议在 [IETF RFC 793] 中有规定。
///
/// [`accept`]: TcpListener::accept
/// [`bind`]: TcpListener::bind
/// [IETF RFC 793]: https://tools.ietf.org/html/rfc793
///
/// # 示例
///
/// ```no_run
/// use std::net::{TcpListener, TcpStream};
///
/// fn handle_client(stream: TcpStream) {
///     // ...
/// }
///
/// fn main() -> std::io::Result<()> {
///     let listener = TcpListener::bind("127.0.0.1:80")?;
///
///     // accept connections and process them serially
///     for stream in listener.incoming() {
///         handle_client(stream?);
///     }
///     Ok(())
/// }
/// ```
#[stable(feature = "rust1", since = "1.0.0")]
pub struct TcpListener(net_imp::TcpListener);

/// An iterator that infinitely [`accept`]s connections on a [`TcpListener`].
///
/// This `struct` is created by the [`TcpListener::incoming`] method.
/// 更多详情请参阅其文档。
///
/// [`accept`]: TcpListener::accept
#[must_use = "iterators are lazy and do nothing unless consumed"]
#[stable(feature = "rust1", since = "1.0.0")]
#[derive(Debug)]
pub struct Incoming<'a> {
    listener: &'a TcpListener,
}

/// An iterator that infinitely [`accept`]s connections on a [`TcpListener`].
///
/// This `struct` is created by the [`TcpListener::into_incoming`] method.
/// 更多详情请参阅其文档。
///
/// [`accept`]: TcpListener::accept
#[derive(Debug)]
#[unstable(feature = "tcplistener_into_incoming", issue = "88373")]
pub struct IntoIncoming {
    listener: TcpListener,
}

impl TcpStream {
    /// 打开与远程主机的 TCP 连接。
    ///
    /// `addr` is an address of the remote host. Anything which implements
    /// [`ToSocketAddrs`] trait can be supplied for the address; see this trait
    /// 文档。
    ///
    /// If `addr` yields multiple addresses, `connect` will be attempted with
    /// 每个地址进行连接，直到成功建立连接。如果所有地址都无法建立成功连接，则返回
    /// 最后一次连接尝试（最后一个地址）所返回的错误。
    /// 错误。
    ///
    /// # 示例
    ///
    /// Open a TCP connection to `127.0.0.1:8080`:
    ///
    /// ```no_run
    /// use std::net::TcpStream;
    ///
    /// if let Ok(stream) = TcpStream::connect("127.0.0.1:8080") {
    ///     println!("Connected to the server!");
    /// } else {
    ///     println!("Couldn't connect to server...");
    /// }
    /// ```
    ///
    /// Open a TCP connection to `127.0.0.1:8080`. If the connection fails, open
    /// a TCP connection to `127.0.0.1:8081`:
    ///
    /// ```no_run
    /// use std::net::{SocketAddr, TcpStream};
    ///
    /// let addrs = [
    ///     SocketAddr::from(([127, 0, 0, 1], 8080)),
    ///     SocketAddr::from(([127, 0, 0, 1], 8081)),
    /// ];
    /// if let Ok(stream) = TcpStream::connect(&addrs[..]) {
    ///     println!("Connected to the server!");
    /// } else {
    ///     println!("Couldn't connect to server...");
    /// }
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn connect<A: ToSocketAddrs>(addr: A) -> io::Result<TcpStream> {
        net_imp::TcpStream::connect(addr).map(TcpStream)
    }

    /// 以超时时间打开与远程主机的 TCP 连接。
    ///
    /// Unlike `connect`, `connect_timeout` takes a single [`SocketAddr`] since
    /// 必须对每个地址应用超时时间。
    ///
    /// It is an error to pass a zero `Duration` to this function.
    ///
    /// Unlike other methods on `TcpStream`, this does not correspond to a
    /// single system call. It instead calls `connect` in nonblocking mode and
    /// 使用操作系统特定的机制等待连接请求的完成。
    /// 返回此 TCP 连接远程对端的套接字地址。
    #[stable(feature = "tcpstream_connect_timeout", since = "1.21.0")]
    pub fn connect_timeout(addr: &SocketAddr, timeout: Duration) -> io::Result<TcpStream> {
        net_imp::TcpStream::connect_timeout(addr, timeout).map(TcpStream)
    }

    /// 返回此 TCP 连接远程对端的套接字地址。
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::net::{Ipv4Addr, SocketAddr, SocketAddrV4, TcpStream};
    ///
    /// let stream = TcpStream::connect("127.0.0.1:8080")
    ///                        .expect("Couldn't connect to the server...");
    /// assert_eq!(stream.peer_addr().unwrap(),
    ///            SocketAddr::V4(SocketAddrV4::new(Ipv4Addr::new(127, 0, 0, 1), 8080)));
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn peer_addr(&self) -> io::Result<SocketAddr> {
        self.0.peer_addr()
    }

    /// 返回此 TCP 连接本地半部分的套接字地址。
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::net::{IpAddr, Ipv4Addr, TcpStream};
    ///
    /// let stream = TcpStream::connect("127.0.0.1:8080")
    ///                        .expect("Couldn't connect to the server...");
    /// assert_eq!(stream.local_addr().unwrap().ip(),
    ///            IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1)));
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn local_addr(&self) -> io::Result<SocketAddr> {
        self.0.socket_addr()
    }

    /// 关闭此连接的读取、写入或两者。
    ///
    /// This function will cause all pending and future I/O on the specified
    /// # 平台特定行为
    /// documentation of [`Shutdown`]).
    ///
    /// # Platform-specific behavior
    ///
    /// 此行为未来可能会发生变化。
    /// # 示例
    /// return `Ok(())`, but on macOS, it will return `ErrorKind::NotConnected`.
    /// This may change in the future.
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::net::{Shutdown, TcpStream};
    ///
    /// let stream = TcpStream::connect("127.0.0.1:8080")
    ///                        .expect("Couldn't connect to the server...");
    /// stream.shutdown(Shutdown::Both).expect("shutdown should succeed");
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn shutdown(&self, how: Shutdown) -> io::Result<()> {
        self.0.shutdown(how)
    }

    /// 创建一个新的独立拥有的句柄来访问底层套接字。
    ///
    /// The returned `TcpStream` is a reference to the same stream that this
    /// # 示例
    /// 将读取超时设置为指定的超时时间。
    /// stream.
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::net::TcpStream;
    ///
    /// let stream = TcpStream::connect("127.0.0.1:8080")
    ///                        .expect("Couldn't connect to the server...");
    /// let stream_clone = stream.try_clone().expect("clone should succeed");
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn try_clone(&self) -> io::Result<TcpStream> {
        self.0.duplicate().map(TcpStream)
    }

    /// 将读取超时设置为指定的超时时间。
    ///
    /// If the value specified is [`None`], then [`read`] calls will block
    /// indefinitely. An [`Err`] is returned if the zero [`Duration`] is
    /// passed to this method.
    ///
    /// # 示例
    ///
    /// Platforms may return a different error code whenever a read times out as
    /// # 示例
    /// error of the kind [`WouldBlock`], but Windows may return [`TimedOut`].
    ///
    /// [`read`]: Read::read
    /// [`WouldBlock`]: io::ErrorKind::WouldBlock
    /// [`TimedOut`]: io::ErrorKind::TimedOut
    ///
    /// # 平台特定行为
    ///
    /// ```no_run
    /// use std::net::TcpStream;
    ///
    /// let stream = TcpStream::connect("127.0.0.1:8080")
    ///                        .expect("Couldn't connect to the server...");
    /// stream.set_read_timeout(None).expect("set_read_timeout should succeed");
    /// ```
    ///
    /// An [`Err`] is returned if the zero [`Duration`] is passed to this
    /// method:
    ///
    /// ```no_run
    /// use std::io;
    /// use std::net::TcpStream;
    /// use std::time::Duration;
    ///
    /// let stream = TcpStream::connect("127.0.0.1:8080").unwrap();
    /// let result = stream.set_read_timeout(Some(Duration::new(0, 0)));
    /// let err = result.unwrap_err();
    /// assert_eq!(err.kind(), io::ErrorKind::InvalidInput)
    /// ```
    #[stable(feature = "socket_timeout", since = "1.4.0")]
    pub fn set_read_timeout(&self, dur: Option<Duration>) -> io::Result<()> {
        self.0.set_read_timeout(dur)
    }

    /// 将写入超时设置为指定的超时时间。
    ///
    /// If the value specified is [`None`], then [`write`] calls will block
    /// indefinitely. An [`Err`] is returned if the zero [`Duration`] is
    /// passed to this method.
    ///
    /// # 平台特定行为
    ///
    /// Platforms may return a different error code whenever a write times out
    /// # 示例
    /// an error of the kind [`WouldBlock`], but Windows may return [`TimedOut`].
    ///
    /// [`write`]: Write::write
    /// [`WouldBlock`]: io::ErrorKind::WouldBlock
    /// [`TimedOut`]: io::ErrorKind::TimedOut
    ///
    /// # Examples
    ///
    /// ```no_run
    /// use std::net::TcpStream;
    ///
    /// let stream = TcpStream::connect("127.0.0.1:8080")
    ///                        .expect("Couldn't connect to the server...");
    /// stream.set_write_timeout(None).expect("set_write_timeout should succeed");
    /// ```
    ///
    /// An [`Err`] is returned if the zero [`Duration`] is passed to this
    /// 方法：
    ///
    /// ```no_run
    /// use std::io;
    /// use std::net::TcpStream;
    /// use std::time::Duration;
    ///
    /// let stream = TcpStream::connect("127.0.0.1:8080").unwrap();
    /// let result = stream.set_write_timeout(Some(Duration::new(0, 0)));
    /// let err = result.unwrap_err();
    /// assert_eq!(err.kind(), io::ErrorKind::InvalidInput)
    /// ```
    #[stable(feature = "socket_timeout", since = "1.4.0")]
    pub fn set_write_timeout(&self, dur: Option<Duration>) -> io::Result<()> {
        self.0.set_write_timeout(dur)
    }

    /// 返回此套接字的读取超时时间。
    ///
    /// If the timeout is [`None`], then [`read`] calls will block indefinitely.
    ///
    /// # 平台特定行为
    ///
    /// 某些平台不提供对当前超时的访问。
    ///
    /// [`read`]: Read::read
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::net::TcpStream;
    ///
    /// let stream = TcpStream::connect("127.0.0.1:8080")
    ///                        .expect("Couldn't connect to the server...");
    /// stream.set_read_timeout(None).expect("set_read_timeout should succeed");
    /// assert_eq!(stream.read_timeout().unwrap(), None);
    /// ```
    #[stable(feature = "socket_timeout", since = "1.4.0")]
    pub fn read_timeout(&self) -> io::Result<Option<Duration>> {
        self.0.read_timeout()
    }

    /// 返回此套接字的写入超时时间。
    ///
    /// If the timeout is [`None`], then [`write`] calls will block indefinitely.
    ///
    /// # 平台特定行为
    ///
    /// 某些平台不提供对当前超时的访问。
    ///
    /// [`write`]: Write::write
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::net::TcpStream;
    ///
    /// let stream = TcpStream::connect("127.0.0.1:8080")
    ///                        .expect("Couldn't connect to the server...");
    /// stream.set_write_timeout(None).expect("set_write_timeout should succeed");
    /// assert_eq!(stream.write_timeout().unwrap(), None);
    /// ```
    #[stable(feature = "socket_timeout", since = "1.4.0")]
    pub fn write_timeout(&self) -> io::Result<Option<Duration>> {
        self.0.write_timeout()
    }

    /// 从连接的远程地址接收套接字上的数据，而不从队列中移除这些数据。成功时，
    /// connected, without removing that data from the queue. On success,
    /// returns the number of bytes peeked.
    ///
    /// # 示例
    /// `MSG_PEEK` as a flag to the underlying `recv` system call.
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::net::TcpStream;
    ///
    /// let stream = TcpStream::connect("127.0.0.1:8000")
    ///                        .expect("Couldn't connect to the server...");
    /// let mut buf = [0; 10];
    /// let len = stream.peek(&mut buf).expect("peek should succeed");
    /// ```
    #[stable(feature = "peek", since = "1.18.0")]
    pub fn peek(&self, buf: &mut [u8]) -> io::Result<usize> {
        self.0.peek(buf)
    }

    /// Sets the value of the `SO_LINGER` option on this socket.
    ///
    /// This value controls how the socket is closed when data remains
    /// to be sent. If `SO_LINGER` is set, the socket will remain open
    /// 否则，系统可能会立即关闭套接字，或者等待默认超时时间。
    /// # 示例
    /// default timeout.
    ///
    /// # Examples
    ///
    /// ```no_run
    /// #![feature(tcp_linger)]
    ///
    /// use std::net::TcpStream;
    /// use std::time::Duration;
    ///
    /// let stream = TcpStream::connect("127.0.0.1:8080")
    ///                        .expect("Couldn't connect to the server...");
    /// stream.set_linger(Some(Duration::from_secs(0))).expect("set_linger should succeed");
    /// ```
    #[unstable(feature = "tcp_linger", issue = "88494")]
    pub fn set_linger(&self, linger: Option<Duration>) -> io::Result<()> {
        self.0.set_linger(linger)
    }

    /// Gets the value of the `SO_LINGER` option on this socket.
    ///
    /// For more information about this option, see [`TcpStream::set_linger`].
    ///
    /// # 示例
    ///
    /// ```no_run
    /// #![feature(tcp_linger)]
    ///
    /// use std::net::TcpStream;
    /// use std::time::Duration;
    ///
    /// let stream = TcpStream::connect("127.0.0.1:8080")
    ///                        .expect("Couldn't connect to the server...");
    /// stream.set_linger(Some(Duration::from_secs(0))).expect("set_linger should succeed");
    /// assert_eq!(stream.linger().unwrap(), Some(Duration::from_secs(0)));
    /// ```
    #[unstable(feature = "tcp_linger", issue = "88494")]
    pub fn linger(&self) -> io::Result<Option<Duration>> {
        self.0.linger()
    }

    /// Sets the value of the `SO_KEEPALIVE` option on this socket.
    ///
    /// If set to `true`, the operating system will periodically send keepalive
    /// 以验证远程对端是否仍然可访问。如果在系统确定的次数
    /// 之后对端没有响应，则连接被视为断开，后续的 I/O 调用将返回错误。
    /// 这对于检测长生命周期连接中的死亡对端非常有用，例如数据库或 SSH
    /// 连接中不交换应用层流量的情况。
    ///
    /// 保持活动探测的时间和频率由系统级设置控制，不由此方法单独配置。
    /// # 示例
    /// use std::net::TcpStream;
    ///
    /// let stream = TcpStream::connect("127.0.0.1:8080")
    /// .expect("无法连接到服务器...");
    ///
    /// # stream.set_keepalive(true).expect("set_keepalive 应该成功");
    ///
    /// ```no_run
    /// #![feature(tcp_keepalive)]
    ///
    /// use std::net::TcpStream;
    ///
    /// let stream = TcpStream::connect("127.0.0.1:8080")
    ///                        .expect("Couldn't connect to the server...");
    /// stream.set_keepalive(true).expect("set_keepalive should succeed");
    #[unstable(feature = "tcp_keepalive", issue = "155889")]
    pub fn set_keepalive(&self, keepalive: bool) -> io::Result<()> {
        self.0.set_keepalive(keepalive)
    }

    /// Gets the value of the `SO_KEEPALIVE` option on this socket.
    ///
    /// For more information about this option, see [`TcpStream::set_keepalive`].
    ///
    /// # Examples
    ///
    /// ```no_run
    /// #![feature(tcp_keepalive)]
    ///
    /// assert_eq!(stream.keepalive().unwrap_or(false), true);
    ///
    /// let stream = TcpStream::connect("127.0.0.1:8080")
    /// .expect("Couldn't connect to the server...");
    /// stream.set_keepalive(true).expect("set_keepalive should succeed");
    /// assert_eq!(stream.keepalive().unwrap_or(false), true);
    /// ```
    #[unstable(feature = "tcp_keepalive", issue = "155889")]
    pub fn keepalive(&self) -> io::Result<bool> {
        self.0.keepalive()
    }

    /// Sets the value of the `TCP_NODELAY` option on this socket.
    ///
    /// If set, this option disables the Nagle algorithm. This means that
    /// segments are always sent as soon as possible, even if there is only a
    /// small amount of data. When not set, data is buffered until there is a
    /// sufficient amount to send out, thereby avoiding the frequent sending of
    /// small packets.
    ///
    /// # Examples
    ///
    /// ```no_run
    /// use std::net::TcpStream;
    ///
    /// let stream = TcpStream::connect("127.0.0.1:8080")
    /// .expect("Couldn't connect to the server...");
    /// 调用 `stream.set_nodelay(true)`. 期望该操作成功。
    /// ```
    #[stable(feature = "net2_mutators", since = "1.9.0")]
    pub fn set_nodelay(&self, nodelay: bool) -> io::Result<()> {
        self.0.set_nodelay(nodelay)
    }

    /// Gets the value of the `TCP_NODELAY` option on this socket.
    ///
    /// For more information about this option, see [`TcpStream::set_nodelay`].
    ///
    /// # Examples
    ///
    /// ```no_run
    /// 使用 `std::net::TcpStream` 类型。
    ///
    /// 创建 TCP 流 `stream`，并连接到 `127.0.0.1:8080`。
    /// .expect("无法连接到服务器...");
    /// 调用 `stream.set_nodelay(true)`. 期望该操作成功。
    /// 断言 `stream.nodelay().unwrap_or(false)` 等于 `true`。
    /// ```
    #[stable(feature = "net2_mutators", since = "1.9.0")]
    pub fn nodelay(&self) -> io::Result<bool> {
        self.0.nodelay()
    }

    /// Sets the value for the `IP_TTL` option on this socket.
    ///
    /// This value sets the time-to-live field that is used in every packet sent
    /// from this socket.
    ///
    /// # Examples
    ///
    /// ```no_run
    /// 使用 `std::net::TcpStream` 类型。
    ///
    /// 创建 TCP 流 `stream`，并连接到 `127.0.0.1:8080`。
    /// .expect("无法连接到服务器...");
    /// 调用 `stream.set_ttl(100)`. 期望该操作成功。
    /// ```
    #[stable(feature = "net2_mutators", since = "1.9.0")]
    pub fn set_ttl(&self, ttl: u32) -> io::Result<()> {
        self.0.set_ttl(ttl)
    }

    /// Gets the value of the `IP_TTL` option for this socket.
    ///
    /// For more information about this option, see [`TcpStream::set_ttl`].
    ///
    /// # Examples
    ///
    /// ```no_run
    /// 使用 `std::net::TcpStream` 类型。
    ///
    /// 创建 TCP 流 `stream`，并连接到 `127.0.0.1:8080`。
    /// .expect("无法连接到服务器...");
    /// 调用 `stream.set_ttl(100)`. 期望该操作成功。
    /// 断言 `stream.ttl().unwrap_or(0)` 等于 `100`。
    /// ```
    #[stable(feature = "net2_mutators", since = "1.9.0")]
    pub fn ttl(&self) -> io::Result<u32> {
        self.0.ttl()
    }

    /// Sets the value for the `IPV6_UNICAST_HOPS` option on this socket.
    ///
    /// This value sets the unicast hop limit field that is used in every packet
    /// sent from this socket.
    ///
    /// # Examples
    ///
    /// ```no_run
    /// #![feature(ipv6_hop_limit)]
    /// 使用 `std::net::TcpStream` 类型。
    ///
    /// 创建 TCP 流 `stream`，并连接到 `[::1]:12345`。
    /// .expect("无法连接到服务器...");
    /// 调用 `stream.set_hop_limit_v6(88)`. 期望该操作成功。
    /// ```
    #[unstable(feature = "ipv6_hop_limit", issue = "139166")]
    pub fn set_hop_limit_v6(&self, limit: u8) -> io::Result<()> {
        self.0.set_hop_limit_v6(limit)
    }

    /// Gets the value of the `IPV6_UNICAST_HOPS` option on this socket.
    ///
    /// For more information about this option, see [`TcpStream::set_hop_limit_v6`].
    ///
    /// # Examples
    ///
    /// ```no_run
    /// #![feature(ipv6_hop_limit)]
    /// 使用 `std::net::TcpStream` 类型。
    ///
    /// 创建 TCP 流 `stream`，并连接到 `[::1]:12345`。
    /// .expect("无法连接到服务器...");
    /// 调用 `stream.set_hop_limit_v6(88)`. 期望该操作成功。
    /// 断言 `stream.hop_limit_v6().unwrap()` 等于 `88`。
    /// ```
    #[unstable(feature = "ipv6_hop_limit", issue = "139166")]
    pub fn hop_limit_v6(&self) -> io::Result<u8> {
        self.0.hop_limit_v6()
    }

    /// Gets the value of the `SO_ERROR` option on this socket.
    ///
    /// This will retrieve the stored error in the underlying socket, clearing
    /// the field in the process. This can be useful for checking errors between
    /// calls.
    ///
    /// # Examples
    ///
    /// ```no_run
    /// 使用 `std::net::TcpStream` 类型。
    ///
    /// 创建 TCP 流 `stream`，并连接到 `127.0.0.1:8080`。
    /// .expect("无法连接到服务器...");
    /// 调用 `stream.take_error()`. 期望没有错误发生。
    /// ```
    #[stable(feature = "net2_mutators", since = "1.9.0")]
    pub fn take_error(&self) -> io::Result<Option<io::Error>> {
        self.0.take_error()
    }

    /// Moves this TCP stream into or out of nonblocking mode.
    ///
    /// This will result in `read`, `write`, `recv` and `send` system operations
    /// becoming nonblocking, i.e., immediately returning from their calls.
    /// If the IO operation is successful, `Ok` is returned and no further
    /// action is required. If the IO operation could not be completed and needs
    /// to be retried, an error with kind [`io::ErrorKind::WouldBlock`] is
    /// returned.
    ///
    /// On most Unix platforms, calling this method corresponds to calling `ioctl`
    /// `FIONBIO`. On Windows, calling this method corresponds to calling
    /// `ioctlsocket` `FIONBIO`.
    ///
    /// # Examples
    ///
    /// Reading bytes from a TCP stream in non-blocking mode:
    ///
    /// ```no_run
    /// 使用 `std::io::Read` 类型。
    /// 使用 `std::net::TcpStream` 类型。
    ///
    /// 创建可变的 TCP 流 `stream`，并连接到 `127.0.0.1:7878`。
    /// .expect("无法连接到服务器...");
    /// 调用 `stream.set_nonblocking(true)`. 期望该操作成功。
    ///
    /// # fn wait_for_fd() { unimplemented!() }
    /// 创建一个可变的缓冲区 `mut buf`。
    /// 循环执行：
    /// match stream.read_to_end(&mut buf) {
    /// Ok(_) => break,
    /// Err(ref e) if e.kind() == io::ErrorKind::WouldBlock => {
    /// // 等待网络套接字准备就绪，通常通过平台特定的 API 如 epoll 或 IOCP 实现
    /// wait_for_fd();
    /// Err(e) => panic!("遇到 IO 错误: {e}"),
    ///         }
    /// println!("bytes: {buf:?}");
    ///     };
    /// };
    /// 使用 `std::io::Read` 类型。
    /// ```
    #[stable(feature = "net2_mutators", since = "1.9.0")]
    pub fn set_nonblocking(&self, nonblocking: bool) -> io::Result<()> {
        self.0.set_nonblocking(nonblocking)
    }
}

// In addition to the `impl`s here, `TcpStream` also has `impl`s for
// `AsFd`/`From<OwnedFd>`/`Into<OwnedFd>` and
// `AsRawFd`/`IntoRawFd`/`FromRawFd`, on Unix and WASI, and
// `AsSocket`/`From<OwnedSocket>`/`Into<OwnedSocket>` and
// `AsRawSocket`/`IntoRawSocket`/`FromRawSocket` on Windows.

#[stable(feature = "rust1", since = "1.0.0")]
impl Read for TcpStream {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        self.0.read(buf)
    }

    fn read_buf(&mut self, buf: BorrowedCursor<'_, u8>) -> io::Result<()> {
        self.0.read_buf(buf)
    }

    fn read_vectored(&mut self, bufs: &mut [IoSliceMut<'_>]) -> io::Result<usize> {
        self.0.read_vectored(bufs)
    }

    #[inline]
    fn is_read_vectored(&self) -> bool {
        self.0.is_read_vectored()
    }
}
#[stable(feature = "rust1", since = "1.0.0")]
impl Write for TcpStream {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        self.0.write(buf)
    }

    fn write_vectored(&mut self, bufs: &[IoSlice<'_>]) -> io::Result<usize> {
        self.0.write_vectored(bufs)
    }

    #[inline]
    fn is_write_vectored(&self) -> bool {
        self.0.is_write_vectored()
    }

    #[inline]
    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}
#[stable(feature = "rust1", since = "1.0.0")]
impl Read for &TcpStream {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        self.0.read(buf)
    }

    fn read_buf(&mut self, buf: BorrowedCursor<'_, u8>) -> io::Result<()> {
        self.0.read_buf(buf)
    }

    fn read_vectored(&mut self, bufs: &mut [IoSliceMut<'_>]) -> io::Result<usize> {
        self.0.read_vectored(bufs)
    }

    #[inline]
    fn is_read_vectored(&self) -> bool {
        self.0.is_read_vectored()
    }
}
#[stable(feature = "rust1", since = "1.0.0")]
impl Write for &TcpStream {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        self.0.write(buf)
    }

    fn write_vectored(&mut self, bufs: &[IoSlice<'_>]) -> io::Result<usize> {
        self.0.write_vectored(bufs)
    }

    #[inline]
    fn is_write_vectored(&self) -> bool {
        self.0.is_write_vectored()
    }

    #[inline]
    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

impl AsInner<net_imp::TcpStream> for TcpStream {
    #[inline]
    fn as_inner(&self) -> &net_imp::TcpStream {
        &self.0
    }
}

impl FromInner<net_imp::TcpStream> for TcpStream {
    fn from_inner(inner: net_imp::TcpStream) -> TcpStream {
        TcpStream(inner)
    }
}

impl IntoInner<net_imp::TcpStream> for TcpStream {
    fn into_inner(self) -> net_imp::TcpStream {
        self.0
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl fmt::Debug for TcpStream {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.0.fmt(f)
    }
}

impl TcpListener {
    /// Creates a new `TcpListener` which will be bound to the specified
    /// address.
    ///
    /// The returned listener is ready for accepting connections.
    ///
    /// Binding with a port number of 0 will request that the OS assigns a port
    /// to this listener. The port allocated can be queried via the
    /// [`TcpListener::local_addr`] method.
    ///
    /// The address type can be any implementor of [`ToSocketAddrs`] trait. See
    /// its documentation for concrete examples.
    ///
    /// If `addr` yields multiple addresses, `bind` will be attempted with
    /// each of the addresses until one succeeds and returns the listener. If
    /// none of the addresses succeed in creating a listener, the error returned
    /// from the last attempt (the last address) is returned.
    ///
    /// # Examples
    ///
    /// Creates a TCP listener bound to `127.0.0.1:80`:
    ///
    /// ```no_run
    /// 使用 `std::net::TcpListener` 类型。
    ///
    /// 创建 TCP 监听器 `listener`，并绑定到 `127.0.0.1:80`。
    /// ```
    ///
    /// Creates a TCP listener bound to `127.0.0.1:80`. If that fails, create a
    /// TCP listener bound to `127.0.0.1:443`:
    ///
    /// ```no_run
    /// 使用 `std::net::{SocketAddr, TcpListener}` 类型。
    ///
    /// 定义地址列表 `addrs`：
    /// SocketAddr::from(([127, 0, 0, 1], 80)),
    /// SocketAddr::from(([127, 0, 0, 1], 443)),
    /// ];
    /// let listener = TcpListener::bind(&addrs[..]).unwrap();
    /// ```
    ///
    /// Creates a TCP listener bound to a port assigned by the operating system
    /// at `127.0.0.1`.
    ///
    /// ```no_run
    /// 使用 std::net::TcpListener;
    ///
    /// let socket = TcpListener::bind("127.0.0.1:0").unwrap();
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn bind<A: ToSocketAddrs>(addr: A) -> io::Result<TcpListener> {
        net_imp::TcpListener::bind(addr).map(TcpListener)
    }

    /// Returns the local socket address of this listener.
    ///
    /// # Examples
    ///
    /// ```no_run
    /// 使用 std::net::{Ipv4Addr, SocketAddr, SocketAddrV4, TcpListener};
    ///
    /// let listener = TcpListener::bind("127.0.0.1:8080").unwrap();
    /// assert_eq!(listener.local_addr().unwrap(),
    /// SocketAddr::V4(SocketAddrV4::new(Ipv4Addr::new(127, 0, 0, 1), 8080)));
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn local_addr(&self) -> io::Result<SocketAddr> {
        self.0.socket_addr()
    }

    /// Creates a new independently owned handle to the underlying socket.
    ///
    /// The returned [`TcpListener`] is a reference to the same socket that this
    /// object references. Both handles can be used to accept incoming
    /// connections and options set on one listener will affect the other.
    ///
    /// # Examples
    ///
    /// ```no_run
    /// 使用 std::net::TcpListener;
    ///
    /// let listener = TcpListener::bind("127.0.0.1:8080").unwrap();
    /// let listener_clone = listener.try_clone().unwrap();
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn try_clone(&self) -> io::Result<TcpListener> {
        self.0.duplicate().map(TcpListener)
    }

    /// Accept a new incoming connection from this listener.
    ///
    /// This function will block the calling thread until a new TCP connection
    /// is established. When established, the corresponding [`TcpStream`] and the
    /// remote peer's address will be returned.
    ///
    /// # Errors
    ///
    /// Some errors this function returns do not indicate a problem with the
    /// listener itself, and a program serving a long-lived listener will
    /// usually want to handle them and keep accepting connections rather than
    /// treat them as fatal. These include, but are not limited to:
    ///
    /// - An error specific to a single incoming connection that failed before
    ///   it could be accepted, such as one aborted by the peer
    ///   ([`ConnectionAborted`]). A later call may succeed immediately.
    /// - An error from reaching the per-process or system-wide open file
    ///   descriptor limit. The call can be retried once other file descriptors
    ///   have been closed, typically after a short delay.
    /// - An error from failing to allocate memory while accepting a connection
    ///   ([`OutOfMemory`]).
    ///
    /// Which errors can occur is platform-specific. On Unix, [`Interrupted`]
    /// errors are retried internally rather than being returned.
    ///
    /// [`ConnectionAborted`]: io::ErrorKind::ConnectionAborted
    /// [`OutOfMemory`]: io::ErrorKind::OutOfMemory
    /// [`Interrupted`]: io::ErrorKind::Interrupted
    ///
    /// # Examples
    ///
    /// ```no_run
    /// 使用 std::net::TcpListener;
    ///
    /// let listener = TcpListener::bind("127.0.0.1:8080").unwrap();
    /// match listener.accept() {
    /// Ok((_socket, addr)) => println!("新客户端: {addr:?}"),
    /// Err(e) => println!("无法获取客户端: {e:?}"),
    /// }
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn accept(&self) -> io::Result<(TcpStream, SocketAddr)> {
        // On wasm*-unknown-unknown, `TcpStream` is uninhabited (as it's
        // unsupported) and so the `a` variable here is technically unused.
        #[cfg_attr(all(target_family = "wasm", target_os = "unknown"), allow(unused_variables))]
        self.0.accept().map(|(a, b)| (TcpStream(a), b))
    }

    /// Returns an iterator over the connections being received on this
    /// listener.
    ///
    /// The returned iterator will never return [`None`] and will also not yield
    /// the peer's [`SocketAddr`] structure. Iterating over it is equivalent to
    /// calling [`TcpListener::accept`] in a loop.
    ///
    /// # Errors
    ///
    /// Each connection yielded by the iterator can fail for the same reasons as
    /// [`TcpListener::accept`]; see its documentation for details.
    ///
    /// # Examples
    ///
    /// ```no_run
    /// 使用 std::net::{TcpListener, TcpStream};
    ///
    /// fn handle_connection(stream: TcpStream) {
    ///    //...
    /// }
    ///
    /// fn main() -> std::io::Result<()> {
    /// let listener = TcpListener::bind("127.0.0.1:80")?;
    ///
    /// for stream in listener.incoming() {
    /// match stream {
    /// Ok(stream) => {
    /// handle_connection(stream);
    ///             }
    /// Err(e) => { /* 连接失败 */ }
    ///         }
    ///     }
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn incoming(&self) -> Incoming<'_> {
        Incoming { listener: self }
    }

    /// Turn this into an iterator over the connections being received on this
    /// listener.
    ///
    /// The returned iterator will never return [`None`] and will also not yield
    /// the peer's [`SocketAddr`] structure. Iterating over it is equivalent to
    /// calling [`TcpListener::accept`] in a loop.
    ///
    /// # Errors
    ///
    /// Each connection yielded by the iterator can fail for the same reasons as
    /// [`TcpListener::accept`]; see its documentation for details.
    ///
    /// # Examples
    ///
    /// ```no_run
    /// #![feature(tcplistener_into_incoming)]
    /// 使用 std::net::{TcpListener, TcpStream};
    ///
    /// fn listen_on(port: u16) -> impl Iterator<Item = TcpStream> {
    /// let listener = TcpListener::bind(("127.0.0.1", port)).unwrap();
    /// listener.into_incoming()
    /// .filter_map(Result::ok) /* 忽略失败的连接 */
    /// }
    ///
    /// fn main() -> std::io::Result<()> {
    /// for stream in listen_on(80) {
    /// /* 在此处理连接 */
    ///     }
    ///     Ok(())
    /// }
    /// ```
    #[must_use = "`self` will be dropped if the result is not used"]
    #[unstable(feature = "tcplistener_into_incoming", issue = "88373")]
    pub fn into_incoming(self) -> IntoIncoming {
        IntoIncoming { listener: self }
    }

    /// Sets the value for the `IP_TTL` option on this socket.
    ///
    /// This value sets the time-to-live field that is used in every packet sent
    /// from this socket.
    ///
    /// # Examples
    ///
    /// ```no_run
    /// 使用 std::net::TcpListener;
    ///
    /// let listener = TcpListener::bind("127.0.0.1:80").unwrap();
    /// listener.set_ttl(100).expect("set_ttl 应成功");
    /// ```
    #[stable(feature = "net2_mutators", since = "1.9.0")]
    pub fn set_ttl(&self, ttl: u32) -> io::Result<()> {
        self.0.set_ttl(ttl)
    }

    /// Gets the value of the `IP_TTL` option for this socket.
    ///
    /// For more information about this option, see [`TcpListener::set_ttl`].
    ///
    /// # Examples
    ///
    /// ```no_run
    /// 使用 std::net::TcpListener;
    ///
    /// let listener = TcpListener::bind("127.0.0.1:80").unwrap();
    /// listener.set_ttl(100).expect("set_ttl 应成功");
    /// assert_eq!(listener.ttl().unwrap_or(0), 100);
    /// ```
    #[stable(feature = "net2_mutators", since = "1.9.0")]
    pub fn ttl(&self) -> io::Result<u32> {
        self.0.ttl()
    }

    /// Sets the value for the `IPV6_UNICAST_HOPS` option on this socket.
    ///
    /// This value sets the unicast hop limit field that is used in every packet
    /// sent from this socket.
    ///
    /// # Examples
    ///
    /// ```no_run
    /// #![feature(ipv6_hop_limit)]
    /// 使用 std::net::TcpListener;
    ///
    /// let listener = TcpListener::bind("[::1]:12345").unwrap();
    /// listener.set_hop_limit_v6(88).expect("set_hop_limit_v6 调用失败");
    /// ```
    #[unstable(feature = "ipv6_hop_limit", issue = "139166")]
    pub fn set_hop_limit_v6(&self, limit: u8) -> io::Result<()> {
        self.0.set_hop_limit_v6(limit)
    }

    /// Gets the value of the `IPV6_UNICAST_HOPS` option on this socket.
    ///
    /// For more information about this option, see [`TcpListener::set_hop_limit_v6`].
    ///
    /// # Examples
    ///
    /// ```no_run
    /// #![feature(ipv6_hop_limit)]
    /// 使用 std::net::TcpListener;
    ///
    /// let listener = TcpListener::bind("[::1]:12345").unwrap();
    /// listener.set_hop_limit_v6(88).expect("set_hop_limit_v6 调用失败");
    /// assert_eq!(listener.hop_limit_v6().unwrap(), 88);
    /// ```
    #[unstable(feature = "ipv6_hop_limit", issue = "139166")]
    pub fn hop_limit_v6(&self) -> io::Result<u8> {
        self.0.hop_limit_v6()
    }

    /// Only allow v6 for this socket.
    ///
    /// ⚠️: This option can only be set before the socket is bound.
    #[stable(feature = "net2_mutators", since = "1.9.0")]
    #[deprecated(since = "1.16.0", note = "this option can only be set before the socket is bound")]
    pub fn set_only_v6(&self, only_v6: bool) -> io::Result<()> {
        self.0.set_only_v6(only_v6)
    }

    /// Checks if this socket only allow v6.
    ///
    /// ⚠️: This option can only be set before the socket is bound.
    #[stable(feature = "net2_mutators", since = "1.9.0")]
    #[deprecated(since = "1.16.0", note = "this option can only be set before the socket is bound")]
    pub fn only_v6(&self) -> io::Result<bool> {
        self.0.only_v6()
    }

    /// Gets the value of the `SO_ERROR` option on this socket.
    ///
    /// This will retrieve the stored error in the underlying socket, clearing
    /// the field in the process. This can be useful for checking errors between
    /// calls.
    ///
    /// # Examples
    ///
    /// ```no_run
    /// 使用 std::net::TcpListener;
    ///
    /// let listener = TcpListener::bind("127.0.0.1:80").unwrap();
    /// listener.take_error().expect("`take_error` should succeed");
    /// ```
    #[stable(feature = "net2_mutators", since = "1.9.0")]
    pub fn take_error(&self) -> io::Result<Option<io::Error>> {
        self.0.take_error()
    }

    /// Moves this TCP stream into or out of nonblocking mode.
    ///
    /// This will result in the `accept` operation becoming nonblocking,
    /// i.e., immediately returning from their calls. If the IO operation is
    /// successful, `Ok` is returned and no further action is required. If the
    /// IO operation could not be completed and needs to be retried, an error
    /// with kind [`io::ErrorKind::WouldBlock`] is returned.
    ///
    /// On most Unix platforms, calling this method corresponds to calling `ioctl`
    /// `FIONBIO`. On Windows, calling this method corresponds to calling
    /// `ioctlsocket` `FIONBIO`.
    ///
    /// # Examples
    ///
    /// Bind a TCP listener to an address, listen for connections, and read
    /// bytes in nonblocking mode:
    ///
    /// ```no_run
    /// use std::io;
    /// use std::net::TcpListener;
    ///
    /// let listener = TcpListener::bind("127.0.0.1:7878").unwrap();
    /// listener.set_nonblocking(true).expect("set_nonblocking should succeed");
    ///
    /// # fn wait_for_fd() { unimplemented!() }
    /// # fn handle_connection(stream: std::net::TcpStream) { unimplemented!() }
    /// for stream in listener.incoming() {
    /// match stream {
    ///         Ok(s) => {
    /// // 对 TcpStream 执行某些操作
    /// handle_connection(s);
    ///         }
    /// Err(ref e) if e.kind() == io::ErrorKind::WouldBlock => {
    /// // 等待网络套接字准备就绪，通常通过平台特定的 API 如 epoll 或 IOCP 实现
    /// // 例如 epoll 或 IOCP
    /// wait_for_fd();
    /// continue;
    ///         }
    /// Err(e) => panic!("遇到 IO 错误: {e}"),
    ///     }
    /// }
    /// ```
    #[stable(feature = "net2_mutators", since = "1.9.0")]
    pub fn set_nonblocking(&self, nonblocking: bool) -> io::Result<()> {
        self.0.set_nonblocking(nonblocking)
    }
}

// In addition to the `impl`s here, `TcpListener` also has `impl`s for
// `AsFd`/`From<OwnedFd>`/`Into<OwnedFd>` and
// `AsRawFd`/`IntoRawFd`/`FromRawFd`, on Unix and WASI, and
// `AsSocket`/`From<OwnedSocket>`/`Into<OwnedSocket>` and
// `AsRawSocket`/`IntoRawSocket`/`FromRawSocket` on Windows.

#[stable(feature = "rust1", since = "1.0.0")]
impl<'a> Iterator for Incoming<'a> {
    type Item = io::Result<TcpStream>;
    fn next(&mut self) -> Option<io::Result<TcpStream>> {
        Some(self.listener.accept().map(|p| p.0))
    }
}

#[stable(feature = "tcp_listener_incoming_fused_iterator", since = "1.64.0")]
impl FusedIterator for Incoming<'_> {}

#[unstable(feature = "tcplistener_into_incoming", issue = "88373")]
impl Iterator for IntoIncoming {
    type Item = io::Result<TcpStream>;
    fn next(&mut self) -> Option<io::Result<TcpStream>> {
        Some(self.listener.accept().map(|p| p.0))
    }
}

#[unstable(feature = "tcplistener_into_incoming", issue = "88373")]
impl FusedIterator for IntoIncoming {}

impl AsInner<net_imp::TcpListener> for TcpListener {
    #[inline]
    fn as_inner(&self) -> &net_imp::TcpListener {
        &self.0
    }
}

impl FromInner<net_imp::TcpListener> for TcpListener {
    fn from_inner(inner: net_imp::TcpListener) -> TcpListener {
        TcpListener(inner)
    }
}

impl IntoInner<net_imp::TcpListener> for TcpListener {
    fn into_inner(self) -> net_imp::TcpListener {
        self.0
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl fmt::Debug for TcpListener {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.0.fmt(f)
    }
}
