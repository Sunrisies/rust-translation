#[cfg(all(
    test,
    not(any(
        target_os = "emscripten",
        all(target_os = "wasi", target_env = "p1"),
        target_env = "sgx",
        target_os = "xous",
        target_os = "trusty",
        target_os = "l4re",
    ))
))]
mod tests;

use crate::fmt;
use crate::io::{self, ErrorKind};
use crate::net::{Ipv4Addr, Ipv6Addr, SocketAddr, ToSocketAddrs};
use crate::sys::{AsInner, FromInner, IntoInner, net as net_imp};
use crate::time::Duration;

/// 一个 UDP 套接字。
///
/// After creating a `UdpSocket` by [`bind`]ing it to a socket address, data can be
/// 发送到任何其他套接字地址，并从任何其他套接字地址接收。
///
/// 尽管 UDP 是一种无连接协议，但此实现提供了接口
/// 用于设置数据应发送和接收的地址。设置远程
/// address with [`connect`], data can be sent to and received from that address with
/// [`send`] and [`recv`].
///
/// 如 [IETF RFC 768] 中用户数据报协议规范所述，UDP 是一种
/// an unordered, unreliable protocol; refer to [`TcpListener`] and [`TcpStream`] for TCP
/// primitives.
///
/// [`bind`]: UdpSocket::bind
/// [`connect`]: UdpSocket::connect
/// [IETF RFC 768]: https://tools.ietf.org/html/rfc768
/// [`recv`]: UdpSocket::recv
/// [received from]: UdpSocket::recv_from
/// [`send`]: UdpSocket::send
/// [sent to]: UdpSocket::send_to
/// [`TcpListener`]: crate::net::TcpListener
/// [`TcpStream`]: crate::net::TcpStream
///
/// # 示例
///
/// ```no_run
/// use std::net::UdpSocket;
///
/// fn main() -> std::io::Result<()> {
///     {
///         let socket = UdpSocket::bind("127.0.0.1:34254")?;
///
///         // Receives a single datagram message on the socket. If `buf` is too small to hold
///         // the message, it will be cut off.
///         let mut buf = [0; 10];
///         let (amt, src) = socket.recv_from(&mut buf)?;
///
///         // Redeclare `buf` as slice of the received data and send reverse data back to origin.
///         let buf = &mut buf[..amt];
///         buf.reverse();
///         socket.send_to(buf, &src)?;
///     } // the socket is closed here
///     Ok(())
/// }
/// ```
#[stable(feature = "rust1", since = "1.0.0")]
pub struct UdpSocket(net_imp::UdpSocket);

impl UdpSocket {
    /// 从给定地址创建 UDP 套接字。
    ///
    /// The address type can be any implementor of [`ToSocketAddrs`] trait. See
    /// 其文档。
    ///
    /// If `addr` yields multiple addresses, `bind` will be attempted with
    /// 每个地址，直到有一个成功并返回套接字。如果所有地址都未能创建套接字，
    /// 则返回最后一次尝试（最后一个地址）的错误。
    /// # 示例
    ///
    /// # Examples
    ///
    /// Creates a UDP socket bound to `127.0.0.1:3400`:
    ///
    /// ```no_run
    /// use std::net::UdpSocket;
    ///
    /// let socket = UdpSocket::bind("127.0.0.1:3400").expect("bind should succeed");
    /// ```
    ///
    /// Creates a UDP socket bound to `127.0.0.1:3400`. If the socket cannot be
    /// bound to that address, create a UDP socket bound to `127.0.0.1:3401`:
    ///
    /// ```no_run
    /// use std::net::{SocketAddr, UdpSocket};
    ///
    /// let addrs = [
    ///     SocketAddr::from(([127, 0, 0, 1], 3400)),
    ///     SocketAddr::from(([127, 0, 0, 1], 3401)),
    /// ];
    /// let socket = UdpSocket::bind(&addrs[..]).expect("bind should succeed");
    /// ```
    ///
    /// Creates a UDP socket bound to a port assigned by the operating system
    /// at `127.0.0.1`.
    ///
    /// ```no_run
    /// use std::net::UdpSocket;
    ///
    /// let socket = UdpSocket::bind("127.0.0.1:0").unwrap();
    /// ```
    ///
    /// Note that `bind` declares the scope of your network connection.
    /// 例如，绑定到环回地址如上面的示例所示，
    /// 将阻止您向本地网络中的其他设备发送数据报。
    /// For instance, binding to a loopback address as in the example
    /// 套接字上接收单个数据报消息。成功时，返回读取的字节数及来源。
    /// in your local network.
    ///
    /// In order to limit your view of the network the least, `bind` to
    /// [`Ipv4Addr::UNSPECIFIED`] or [`Ipv6Addr::UNSPECIFIED`].
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn bind<A: ToSocketAddrs>(addr: A) -> io::Result<UdpSocket> {
        net_imp::UdpSocket::bind(addr).map(UdpSocket)
    }

    /// 多余的字节可能会被丢弃。
    /// 请参阅该函数的平台特定文档；如果底层系统
    ///
    /// The function must be called with valid byte array `buf` of sufficient size to
    /// # 示例
    /// 套接字上接收单个数据报消息，而不将其从队列中移除。成功时，返回读取的字节数及来源。
    ///
    /// Refer to the platform-specific documentation on this function; it is considered
    /// correct for its behavior to differ from [`UdpSocket::recv`] if the underlying system
    /// call does so.
    ///
    /// # Examples
    ///
    /// ```no_run
    /// use std::net::UdpSocket;
    ///
    /// let socket = UdpSocket::bind("127.0.0.1:34254").expect("bind should succeed");
    /// let mut buf = [0; 10];
    /// let (number_of_bytes, src_addr) = socket.recv_from(&mut buf)
    ///                                         .expect("recv_from should succeed");
    /// let filled_buf = &mut buf[..number_of_bytes];
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn recv_from(&self, buf: &mut [u8]) -> io::Result<(usize, SocketAddr)> {
        self.0.recv_from(buf)
    }

    /// Receives a single datagram message on the socket, without removing it from the
    /// queue. On success, returns the number of bytes read and the origin.
    ///
    /// The function must be called with valid byte array `buf` of sufficient size to
    /// 以容纳消息字节。如果消息过长无法放入提供的缓冲区，
    /// only the bytes that fit are copied into `buf`; the excess bytes are not returned
    /// 数据报本身仍保留在队列中完整状态，因此后续调用
    /// to [`UdpSocket::recv_from`] with a large enough buffer still receives the whole
    /// 消息。
    ///
    /// 使用过小的缓冲区尝试读取是否会在长度不足时成功或失败，
    /// 这取决于平台。例如，Windows 在这种情况下会返回错误。
    /// (`WSAEMSGSIZE`) in this case.
    ///
    /// Successive calls return the same data. This is accomplished by passing
    /// `MSG_PEEK` as a flag to the underlying `recvfrom` system call.
    ///
    /// Do not use this function to implement busy waiting, instead use `libc::poll` to
    /// # 示例
    ///
    /// # 在套接字上将数据发送到给定地址。成功时，返回写入的字节数。
    ///
    /// ```no_run
    /// use std::net::UdpSocket;
    ///
    /// let socket = UdpSocket::bind("127.0.0.1:34254").expect("bind should succeed");
    /// let mut buf = [0; 10];
    /// let (number_of_bytes, src_addr) = socket.peek_from(&mut buf)
    ///                                         .expect("recv_from should succeed");
    /// let filled_buf = &mut buf[..number_of_bytes];
    /// ```
    #[stable(feature = "peek", since = "1.18.0")]
    pub fn peek_from(&self, buf: &mut [u8]) -> io::Result<(usize, SocketAddr)> {
        self.0.peek_from(buf)
    }

    /// Sends data on the socket to the given address. On success, returns the
    /// number of bytes written. Note that the operating system may refuse
    /// buffers larger than 65507. However, partial writes are not possible
    /// until buffer sizes above `i32::MAX`.
    ///
    /// Address type can be any implementor of [`ToSocketAddrs`] trait. See its
    /// 将返回错误。
    ///
    /// It is possible for `addr` to yield multiple addresses, but `send_to`
    /// will only send data to the first address yielded by `addr`.
    ///
    /// This will return an error when the IP version of the local socket
    /// does not match that returned from [`ToSocketAddrs`].
    ///
    /// 更多细节请参阅 [Issue #34202]。
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::net::UdpSocket;
    ///
    /// let socket = UdpSocket::bind("127.0.0.1:34254").expect("bind should succeed");
    /// socket.send_to(&[0; 10], "127.0.0.1:4242").expect("send_to should succeed");
    /// ```
    ///
    /// [Issue #34202]: https://github.com/rust-lang/rust/issues/34202
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn send_to<A: ToSocketAddrs>(&self, buf: &[u8], addr: A) -> io::Result<usize> {
        match addr.to_socket_addrs()?.next() {
            Some(addr) => self.0.send_to(buf, &addr),
            None => Err(io::const_error!(ErrorKind::InvalidInput, "no addresses to send data to")),
        }
    }

    /// 返回该套接字所连接的远程对端的套接字地址。
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::net::{Ipv4Addr, SocketAddr, SocketAddrV4, UdpSocket};
    ///
    /// let socket = UdpSocket::bind("127.0.0.1:34254").expect("bind should succeed");
    /// socket.connect("192.168.0.1:41203").expect("connect should succeed");
    /// assert_eq!(socket.peer_addr().unwrap(),
    ///            SocketAddr::V4(SocketAddrV4::new(Ipv4Addr::new(192, 168, 0, 1), 41203)));
    /// ```
    ///
    /// If the socket isn't connected, it will return a [`NotConnected`] error.
    ///
    /// [`NotConnected`]: io::ErrorKind::NotConnected
    ///
    /// ```no_run
    /// use std::net::UdpSocket;
    ///
    /// let socket = UdpSocket::bind("127.0.0.1:34254").expect("bind should succeed");
    /// assert_eq!(socket.peer_addr().unwrap_err().kind(),
    ///            std::io::ErrorKind::NotConnected);
    /// ```
    #[stable(feature = "udp_peer_addr", since = "1.40.0")]
    pub fn peer_addr(&self) -> io::Result<SocketAddr> {
        self.0.peer_addr()
    }

    /// 返回该套接字创建的套接字地址。
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::net::{Ipv4Addr, SocketAddr, SocketAddrV4, UdpSocket};
    ///
    /// let socket = UdpSocket::bind("127.0.0.1:34254").expect("bind should succeed");
    /// assert_eq!(socket.local_addr().unwrap(),
    ///            SocketAddr::V4(SocketAddrV4::new(Ipv4Addr::new(127, 0, 0, 1), 34254)));
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn local_addr(&self) -> io::Result<SocketAddr> {
        self.0.socket_addr()
    }

    /// 创建一个新的独立拥有的对底层套接字的句柄。
    ///
    /// The returned `UdpSocket` is a reference to the same socket that this
    /// 一个套接字上设置的选项也会传播到另一个套接字。
    /// # 示例
    ///
    /// # 设置读取超时为指定的时间。
    ///
    /// ```no_run
    /// use std::net::UdpSocket;
    ///
    /// let socket = UdpSocket::bind("127.0.0.1:34254").expect("bind should succeed");
    /// let socket_clone = socket.try_clone().expect("try_clone should succeed");
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn try_clone(&self) -> io::Result<UdpSocket> {
        self.0.duplicate().map(UdpSocket)
    }

    /// Sets the read timeout to the timeout specified.
    ///
    /// If the value specified is [`None`], then [`read`] calls will block
    /// indefinitely. An [`Err`] is returned if the zero [`Duration`] is
    /// 平台在读取超时时可能会返回不同的错误代码。
    ///
    /// # Platform-specific behavior
    ///
    /// Platforms may return a different error code whenever a read times out as
    /// 设置此选项的结果。例如，Unix 通常返回一种错误，
    /// error of the kind [`WouldBlock`], but Windows may return [`TimedOut`].
    ///
    /// [`read`]: io::Read::read
    /// [`WouldBlock`]: io::ErrorKind::WouldBlock
    /// [`TimedOut`]: io::ErrorKind::TimedOut
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::net::UdpSocket;
    ///
    /// let socket = UdpSocket::bind("127.0.0.1:34254").expect("bind should succeed");
    /// socket.set_read_timeout(None).expect("set_read_timeout should succeed");
    /// ```
    ///
    /// An [`Err`] is returned if the zero [`Duration`] is passed to this
    /// 方法：
    ///
    /// ```no_run
    /// use std::io;
    /// use std::net::UdpSocket;
    /// use std::time::Duration;
    ///
    /// let socket = UdpSocket::bind("127.0.0.1:34254").unwrap();
    /// let result = socket.set_read_timeout(Some(Duration::new(0, 0)));
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
    /// # Platform-specific behavior
    ///
    /// 每当设置此选项导致写入超时时，不同平台可能会返回不同的错误代码。例如，Unix 通常返回
    /// as a result of setting this option. For example Unix typically returns
    /// an error of the kind [`WouldBlock`], but Windows may return [`TimedOut`].
    ///
    /// [`write`]: io::Write::write
    /// [`WouldBlock`]: io::ErrorKind::WouldBlock
    /// [`TimedOut`]: io::ErrorKind::TimedOut
    ///
    /// # Examples
    ///
    /// ```no_run
    /// use std::net::UdpSocket;
    ///
    /// let socket = UdpSocket::bind("127.0.0.1:34254").expect("bind should succeed");
    /// socket.set_write_timeout(None).expect("set_write_timeout should succeed");
    /// ```
    ///
    /// An [`Err`] is returned if the zero [`Duration`] is passed to this
    /// 返回此套接字的读取超时时间。
    ///
    /// ```no_run
    /// use std::io;
    /// use std::net::UdpSocket;
    /// use std::time::Duration;
    ///
    /// let socket = UdpSocket::bind("127.0.0.1:34254").unwrap();
    /// let result = socket.set_write_timeout(Some(Duration::new(0, 0)));
    /// let err = result.unwrap_err();
    /// assert_eq!(err.kind(), io::ErrorKind::InvalidInput)
    /// ```
    #[stable(feature = "socket_timeout", since = "1.4.0")]
    pub fn set_write_timeout(&self, dur: Option<Duration>) -> io::Result<()> {
        self.0.set_write_timeout(dur)
    }

    /// Returns the read timeout of this socket.
    ///
    /// If the timeout is [`None`], then [`read`] calls will block indefinitely.
    ///
    /// [`read`]: io::Read::read
    ///
    /// # 返回此套接字的写入超时时间。
    ///
    /// ```no_run
    /// use std::net::UdpSocket;
    ///
    /// let socket = UdpSocket::bind("127.0.0.1:34254").expect("bind should succeed");
    /// socket.set_read_timeout(None).expect("set_read_timeout should succeed");
    /// assert_eq!(socket.read_timeout().unwrap(), None);
    /// ```
    #[stable(feature = "socket_timeout", since = "1.4.0")]
    pub fn read_timeout(&self) -> io::Result<Option<Duration>> {
        self.0.read_timeout()
    }

    /// Returns the write timeout of this socket.
    ///
    /// If the timeout is [`None`], then [`write`] calls will block indefinitely.
    ///
    /// [`write`]: io::Write::write
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::net::UdpSocket;
    ///
    /// let socket = UdpSocket::bind("127.0.0.1:34254").expect("bind should succeed");
    /// socket.set_write_timeout(None).expect("set_write_timeout should succeed");
    /// assert_eq!(socket.write_timeout().unwrap(), None);
    /// ```
    #[stable(feature = "socket_timeout", since = "1.4.0")]
    pub fn write_timeout(&self) -> io::Result<Option<Duration>> {
        self.0.write_timeout()
    }

    /// Sets the value of the `SO_BROADCAST` option for this socket.
    ///
    /// 当启用时，此套接字允许向广播地址发送数据包。
    /// # 示例
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::net::UdpSocket;
    ///
    /// let socket = UdpSocket::bind("127.0.0.1:34254").expect("bind should succeed");
    /// socket.set_broadcast(false).expect("set_broadcast should succeed");
    /// ```
    #[stable(feature = "net2_mutators", since = "1.9.0")]
    pub fn set_broadcast(&self, broadcast: bool) -> io::Result<()> {
        self.0.set_broadcast(broadcast)
    }

    /// Gets the value of the `SO_BROADCAST` option for this socket.
    ///
    /// For more information about this option, see [`UdpSocket::set_broadcast`].
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::net::UdpSocket;
    ///
    /// let socket = UdpSocket::bind("127.0.0.1:34254").expect("bind should succeed");
    /// socket.set_broadcast(false).expect("set_broadcast should succeed");
    /// assert_eq!(socket.broadcast().unwrap(), false);
    /// ```
    #[stable(feature = "net2_mutators", since = "1.9.0")]
    pub fn broadcast(&self) -> io::Result<bool> {
        self.0.broadcast()
    }

    /// Sets the value of the `IP_MULTICAST_LOOP` option for this socket.
    ///
    /// 如果启用，多播数据包将循环回本地套接字。
    /// 请注意，这可能对 IPv6 套接字没有效果。
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::net::UdpSocket;
    ///
    /// let socket = UdpSocket::bind("127.0.0.1:34254").expect("bind should succeed");
    /// socket.set_multicast_loop_v4(false).expect("set_multicast_loop_v4 should succeed");
    /// ```
    #[stable(feature = "net2_mutators", since = "1.9.0")]
    pub fn set_multicast_loop_v4(&self, multicast_loop_v4: bool) -> io::Result<()> {
        self.0.set_multicast_loop_v4(multicast_loop_v4)
    }

    /// Gets the value of the `IP_MULTICAST_LOOP` option for this socket.
    ///
    /// For more information about this option, see [`UdpSocket::set_multicast_loop_v4`].
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::net::UdpSocket;
    ///
    /// let socket = UdpSocket::bind("127.0.0.1:34254").expect("bind should succeed");
    /// socket.set_multicast_loop_v4(false).expect("set_multicast_loop_v4 should succeed");
    /// assert_eq!(socket.multicast_loop_v4().unwrap(), false);
    /// ```
    #[stable(feature = "net2_mutators", since = "1.9.0")]
    pub fn multicast_loop_v4(&self) -> io::Result<bool> {
        self.0.multicast_loop_v4()
    }

    /// Sets the value of the `IP_MULTICAST_TTL` option for this socket.
    ///
    /// 表示此套接字发出的多播数据包的生存时间值。默认值為 1，意味着多播数据包
    /// 不会离开本地网络，除非明确请求。
    /// 请注意，这可能对 IPv6 套接字没有效果。
    ///
    /// 由于底层套接选项值是字节大小，
    ///
    /// 任何大于 255 的值都将导致错误。
    /// # 示例
    ///
    /// # Examples
    ///
    /// ```no_run
    /// use std::net::UdpSocket;
    ///
    /// let socket = UdpSocket::bind("127.0.0.1:34254").expect("bind should succeed");
    /// socket.set_multicast_ttl_v4(42).expect("set_multicast_ttl_v4 should succeed");
    /// ```
    #[stable(feature = "net2_mutators", since = "1.9.0")]
    pub fn set_multicast_ttl_v4(&self, multicast_ttl_v4: u32) -> io::Result<()> {
        self.0.set_multicast_ttl_v4(multicast_ttl_v4)
    }

    /// Gets the value of the `IP_MULTICAST_TTL` option for this socket.
    ///
    /// For more information about this option, see [`UdpSocket::set_multicast_ttl_v4`].
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::net::UdpSocket;
    ///
    /// let socket = UdpSocket::bind("127.0.0.1:34254").expect("bind should succeed");
    /// socket.set_multicast_ttl_v4(42).expect("set_multicast_ttl_v4 should succeed");
    /// assert_eq!(socket.multicast_ttl_v4().unwrap(), 42);
    /// ```
    #[stable(feature = "net2_mutators", since = "1.9.0")]
    pub fn multicast_ttl_v4(&self) -> io::Result<u32> {
        self.0.multicast_ttl_v4()
    }

    /// Sets the value of the `IPV6_MULTICAST_LOOP` option for this socket.
    ///
    /// 控制此套接字是否接收其自身发送的多播数据包。
    /// 请注意，这可能对 IPv4 套接字没有任何影响。
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::net::UdpSocket;
    ///
    /// let socket = UdpSocket::bind("[::1]:34254").expect("bind should succeed");
    /// socket.set_multicast_loop_v6(false).expect("set_multicast_loop_v6 should succeed");
    /// ```
    #[stable(feature = "net2_mutators", since = "1.9.0")]
    pub fn set_multicast_loop_v6(&self, multicast_loop_v6: bool) -> io::Result<()> {
        self.0.set_multicast_loop_v6(multicast_loop_v6)
    }

    /// Gets the value of the `IPV6_MULTICAST_LOOP` option for this socket.
    ///
    /// For more information about this option, see [`UdpSocket::set_multicast_loop_v6`].
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::net::UdpSocket;
    ///
    /// let socket = UdpSocket::bind("[::1]:34254").expect("bind should succeed");
    /// socket.set_multicast_loop_v6(false).expect("set_multicast_loop_v6 should succeed");
    /// assert_eq!(socket.multicast_loop_v6().unwrap(), false);
    /// ```
    #[stable(feature = "net2_mutators", since = "1.9.0")]
    pub fn multicast_loop_v6(&self) -> io::Result<bool> {
        self.0.multicast_loop_v6()
    }

    /// Sets the value for the `IP_TTL` option on this socket.
    ///
    /// 该值设定了在发送的每个数据包中使用的生存时间字段。
    /// 来自此套接字。
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::net::UdpSocket;
    ///
    /// let socket = UdpSocket::bind("127.0.0.1:34254").expect("bind should succeed");
    /// socket.set_ttl(42).expect("set_ttl should succeed");
    /// ```
    #[stable(feature = "net2_mutators", since = "1.9.0")]
    pub fn set_ttl(&self, ttl: u32) -> io::Result<()> {
        self.0.set_ttl(ttl)
    }

    /// Gets the value of the `IP_TTL` option for this socket.
    ///
    /// For more information about this option, see [`UdpSocket::set_ttl`].
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::net::UdpSocket;
    ///
    /// let socket = UdpSocket::bind("127.0.0.1:34254").expect("bind should succeed");
    /// socket.set_ttl(42).expect("set_ttl should succeed");
    /// assert_eq!(socket.ttl().unwrap(), 42);
    /// ```
    #[stable(feature = "net2_mutators", since = "1.9.0")]
    pub fn ttl(&self) -> io::Result<u32> {
        self.0.ttl()
    }

    /// Sets the value for the `IPV6_UNICAST_HOPS` option on this socket.
    ///
    /// 该值设定了在发送的每个数据包中使用的单播跳数限制字段。
    /// 来自此套接字。
    ///
    /// # 示例
    ///
    /// ```no_run
    /// #![feature(ipv6_hop_limit)]
    /// use std::net::UdpSocket;
    ///
    /// let socket = UdpSocket::bind("[::1]:12345").expect("couldn't bind to address");
    /// socket.set_hop_limit_v6(88).expect("set_hop_limit_v6 call failed");
    /// ```
    #[unstable(feature = "ipv6_hop_limit", issue = "139166")]
    pub fn set_hop_limit_v6(&self, limit: u8) -> io::Result<()> {
        self.0.set_hop_limit_v6(limit)
    }

    /// Gets the value of the `IPV6_UNICAST_HOPS` option on this socket.
    ///
    /// For more information about this option, see [`UdpSocket::set_hop_limit_v6`].
    ///
    /// # 示例
    ///
    /// ```no_run
    /// #![feature(ipv6_hop_limit)]
    /// use std::net::UdpSocket;
    ///
    /// let socket = UdpSocket::bind("[::1]:12345").expect("couldn't bind to address");
    /// socket.set_hop_limit_v6(88).expect("set_hop_limit_v6 call failed");
    /// assert_eq!(socket.hop_limit_v6().unwrap(), 88);
    /// ```
    #[unstable(feature = "ipv6_hop_limit", issue = "139166")]
    pub fn hop_limit_v6(&self) -> io::Result<u8> {
        self.0.hop_limit_v6()
    }

    /// Sets the value for the `IPV6_MULTICAST_HOPS` option on this socket.
    ///
    /// 该值设定了出站多播数据包的跳数限制字段。
    /// 来自此套接字。
    ///
    /// # 示例
    ///
    /// ```no_run
    /// #![feature(ipv6_hop_limit)]
    /// use std::net::UdpSocket;
    ///
    /// let socket = UdpSocket::bind("[::1]:12345").expect("couldn't bind to address");
    /// socket.set_multicast_hop_limit_v6(88).expect("set_multicast_hop_limit_v6 call failed");
    /// ```
    #[unstable(feature = "ipv6_hop_limit", issue = "139166")]
    pub fn set_multicast_hop_limit_v6(&self, limit: u8) -> io::Result<()> {
        self.0.set_multicast_hop_limit_v6(limit)
    }

    /// Gets the value of the `IPV6_MULTICAST_HOPS` option on this socket.
    ///
    /// For more information about this option, see [`UdpSocket::set_multicast_hop_limit_v6`].
    ///
    /// # 示例
    ///
    /// ```no_run
    /// #![feature(ipv6_hop_limit)]
    /// use std::net::UdpSocket;
    ///
    /// let socket = UdpSocket::bind("[::1]:12345").expect("couldn't bind to address");
    /// socket.set_multicast_hop_limit_v6(88).expect("set_multicast_hop_limit_v6 call failed");
    /// assert_eq!(socket.multicast_hop_limit_v6().unwrap(), 88);
    /// ```
    #[unstable(feature = "ipv6_hop_limit", issue = "139166")]
    pub fn multicast_hop_limit_v6(&self) -> io::Result<u8> {
        self.0.multicast_hop_limit_v6()
    }

    /// Executes an operation of the `IP_ADD_MEMBERSHIP` type.
    ///
    /// 此函数指定了此套接字要加入的新多播组。
    /// The address must be a valid multicast address, and `interface` is the
    /// address of the local interface with which the system should join the
    /// multicast group. If it's equal to [`UNSPECIFIED`](Ipv4Addr::UNSPECIFIED)
    /// 那么系统将选择适当的接口。
    #[stable(feature = "net2_mutators", since = "1.9.0")]
    pub fn join_multicast_v4(&self, multiaddr: &Ipv4Addr, interface: &Ipv4Addr) -> io::Result<()> {
        self.0.join_multicast_v4(multiaddr, interface)
    }

    /// Executes an operation of the `IPV6_ADD_MEMBERSHIP` type.
    ///
    /// 此函数指定了此套接字要加入的新多播组。
    /// The address must be a valid multicast address, and `interface` is the
    /// 要加入/离开的接口索引（或 0 表示任何接口）。
    #[stable(feature = "net2_mutators", since = "1.9.0")]
    pub fn join_multicast_v6(&self, multiaddr: &Ipv6Addr, interface: u32) -> io::Result<()> {
        self.0.join_multicast_v6(multiaddr, interface)
    }

    /// Executes an operation of the `IP_DROP_MEMBERSHIP` type.
    ///
    /// For more information about this option, see [`UdpSocket::join_multicast_v4`].
    #[stable(feature = "net2_mutators", since = "1.9.0")]
    pub fn leave_multicast_v4(&self, multiaddr: &Ipv4Addr, interface: &Ipv4Addr) -> io::Result<()> {
        self.0.leave_multicast_v4(multiaddr, interface)
    }

    /// Executes an operation of the `IPV6_DROP_MEMBERSHIP` type.
    ///
    /// For more information about this option, see [`UdpSocket::join_multicast_v6`].
    #[stable(feature = "net2_mutators", since = "1.9.0")]
    pub fn leave_multicast_v6(&self, multiaddr: &Ipv6Addr, interface: u32) -> io::Result<()> {
        self.0.leave_multicast_v6(multiaddr, interface)
    }

    /// Gets the value of the `SO_ERROR` option on this socket.
    ///
    /// 这将检索底层套接字中存储的错误，并清除
    /// 进程中的该字段。这可用于在多次调用之间检查错误。
    /// # 示例
    ///
    /// # Examples
    ///
    /// ```no_run
    /// use std::net::UdpSocket;
    ///
    /// let socket = UdpSocket::bind("127.0.0.1:34254").expect("bind should succeed");
    /// match socket.take_error() {
    ///     Ok(Some(error)) => println!("UdpSocket error: {error:?}"),
    ///     Ok(None) => println!("No error"),
    ///     Err(error) => println!("UdpSocket.take_error failed: {error:?}"),
    /// }
    /// ```
    #[stable(feature = "net2_mutators", since = "1.9.0")]
    pub fn take_error(&self) -> io::Result<Option<io::Error>> {
        self.0.take_error()
    }

    /// Connects this UDP socket to a remote address, allowing the `send` and
    /// `recv` syscalls to be used to send data and also applies filters to only
    /// receive data from the specified address.
    ///
    /// If `addr` yields multiple addresses, `connect` will be attempted with
    /// 直到底层操作系统函数返回之前，每个地址都会执行此操作。
    /// error. Note that usually, a successful `connect` call does not specify
    /// 是否有远程服务器正在该端口上监听，而是这样的
    /// 错误会在第一次发送后才会被检测到。如果操作系统对每个指定地址都返回
    /// 错误，则会返回最后一次连接尝试（最后一个地址）所返回的错误。
    /// # 示例
    ///
    /// # Examples
    ///
    /// Creates a UDP socket bound to `127.0.0.1:3400` and connect the socket to
    /// `127.0.0.1:8080`:
    ///
    /// ```no_run
    /// use std::net::UdpSocket;
    ///
    /// let socket = UdpSocket::bind("127.0.0.1:3400").expect("bind should succeed");
    /// socket.connect("127.0.0.1:8080").expect("connect should succeed");
    /// ```
    ///
    /// Unlike in the TCP case, passing an array of addresses to the `connect`
    /// 确定是否有东西在远程地址上监听，除非应用程序发送数据。
    /// unable to determine whether something is listening on the remote
    /// 调用可能会失败，这取决于平台。
    ///
    /// If your first `connect` is to a loopback address, subsequent
    /// `connect`s to non-loopback addresses might fail, depending
    /// on the platform.
    #[stable(feature = "net2_mutators", since = "1.9.0")]
    pub fn connect<A: ToSocketAddrs>(&self, addr: A) -> io::Result<()> {
        self.0.connect(addr)
    }

    /// 发送数据到连接的远程地址。
    /// On success, returns the number of bytes written. Note that the operating
    /// system may refuse buffers larger than 65507. However, partial writes are
    /// not possible until buffer sizes above `i32::MAX`.
    ///
    /// [`UdpSocket::connect`] will connect this socket to a remote address. This
    /// 从连接的远程地址接收单个数据报消息。成功时，返回读取的字节数。
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::net::UdpSocket;
    ///
    /// let socket = UdpSocket::bind("127.0.0.1:34254").expect("bind should succeed");
    /// socket.connect("127.0.0.1:8080").expect("connect should succeed");
    /// socket.send(&[0, 1, 2]).expect("send should succeed");
    /// ```
    #[stable(feature = "net2_mutators", since = "1.9.0")]
    pub fn send(&self, buf: &[u8]) -> io::Result<usize> {
        self.0.send(buf)
    }

    /// 从连接的远程地址接收单个数据报消息。成功时，返回读取的字节数。
    /// which it is connected. On success, returns the number of bytes read.
    ///
    /// The function must be called with valid byte array `buf` of sufficient size to
    /// hold the message bytes. If a message is too long to fit in the supplied buffer,
    /// 方法如果套接字未连接则失败。
    ///
    /// [`UdpSocket::connect`] will connect this socket to a remote address. This
    /// 方法如果套接字未连接则失败。
    ///
    /// 请参阅平台特定的相关文档；如果底层系统调用行为不同，则视为正确。
    /// correct for its behavior to differ from [`UdpSocket::recv_from`] if the underlying
    /// # 示例
    ///
    /// # 从连接的远程地址接收单个数据报消息，而不从输入队列中移除消息。成功时，返回查看的字节数。
    ///
    /// ```no_run
    /// use std::net::UdpSocket;
    ///
    /// let socket = UdpSocket::bind("127.0.0.1:34254").expect("bind should succeed");
    /// socket.connect("127.0.0.1:8080").expect("connect should succeed");
    /// let mut buf = [0; 10];
    /// match socket.recv(&mut buf) {
    ///     Ok(received) => println!("received {received} bytes {:?}", &buf[..received]),
    ///     Err(e) => println!("recv function failed: {e:?}"),
    /// }
    /// ```
    #[stable(feature = "net2_mutators", since = "1.9.0")]
    pub fn recv(&self, buf: &mut [u8]) -> io::Result<usize> {
        self.0.recv(buf)
    }

    /// 从连接的远程地址接收单个数据报消息，而不从输入队列中移除消息。成功时，返回查看的字节数。
    /// connected, without removing the message from input queue. On success, returns
    /// the number of bytes peeked.
    ///
    /// The function must be called with valid byte array `buf` of sufficient size to
    /// hold the message bytes. If a message is too long to fit in the supplied buffer,
    /// only the bytes that fit are copied into `buf`; the excess bytes are not returned
    /// 通过此调用。数据报本身会完整保留在队列中，因此后续调用仍然可以接收全部内容。
    /// to [`UdpSocket::recv`] with a large enough buffer still receives the whole
    /// 消息。
    ///
    /// 使用过小的缓冲区尝试 peek 时，可能会因长度不足而失败或成功。
    /// 是否失败取决于平台。例如，Windows 会返回错误。
    /// (`WSAEMSGSIZE`) in this case.
    ///
    /// Successive calls return the same data. This is accomplished by passing
    /// `MSG_PEEK` as a flag to the underlying `recv` system call.
    ///
    /// Do not use this function to implement busy waiting, instead use `libc::poll` to
    /// synchronize IO events on one or more sockets.
    ///
    /// [`UdpSocket::connect`] will connect this socket to a remote address. This
    /// # 错误
    ///
    /// # Errors
    ///
    /// This method will fail if the socket is not connected. The `connect` method
    /// 将此套接字连接到远程地址。
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::net::UdpSocket;
    ///
    /// let socket = UdpSocket::bind("127.0.0.1:34254").expect("bind should succeed");
    /// socket.connect("127.0.0.1:8080").expect("connect should succeed");
    /// let mut buf = [0; 10];
    /// match socket.peek(&mut buf) {
    ///     Ok(received) => println!("received {received} bytes"),
    ///     Err(e) => println!("peek function failed: {e:?}"),
    /// }
    /// ```
    #[stable(feature = "peek", since = "1.18.0")]
    pub fn peek(&self, buf: &mut [u8]) -> io::Result<usize> {
        self.0.peek(buf)
    }

    /// 将此 UDP 套接字切换到非阻塞模式或退出非阻塞模式。
    ///
    /// This will result in `recv`, `recv_from`, `send`, and `send_to` system
    /// operations becoming nonblocking, i.e., immediately returning from their
    /// calls. If the IO operation is successful, `Ok` is returned and no
    /// further action is required. If the IO operation could not be completed
    /// and needs to be retried, an error with kind
    /// [`io::ErrorKind::WouldBlock`] is returned.
    ///
    /// On most Unix platforms, calling this method corresponds to calling `ioctl`
    /// `FIONBIO`. On Windows, calling this method corresponds to calling
    /// `ioctlsocket` `FIONBIO`.
    ///
    /// # 示例
    ///
    /// Creates a UDP socket bound to `127.0.0.1:7878` and read bytes in
    /// 模式：
    ///
    /// ```no_run
    /// use std::io;
    /// use std::net::UdpSocket;
    ///
    /// let socket = UdpSocket::bind("127.0.0.1:7878").unwrap();
    /// socket.set_nonblocking(true).unwrap();
    ///
    /// # fn wait_for_fd() { unimplemented!() }
    /// let mut buf = [0; 10];
    /// let (num_bytes_read, _) = loop {
    ///     match socket.recv_from(&mut buf) {
    ///         Ok(n) => break n,
    ///         Err(ref e) if e.kind() == io::ErrorKind::WouldBlock => {
    ///             // wait until network socket is ready, typically implemented
    ///             // via platform-specific APIs such as epoll or IOCP
    ///             wait_for_fd();
    ///         }
    ///         Err(e) => panic!("encountered IO error: {e}"),
    ///     }
    /// };
    /// println!("bytes: {:?}", &buf[..num_bytes_read]);
    /// ```
    #[stable(feature = "net2_mutators", since = "1.9.0")]
    pub fn set_nonblocking(&self, nonblocking: bool) -> io::Result<()> {
        self.0.set_nonblocking(nonblocking)
    }
}

// In addition to the `impl`s here, `UdpSocket` also has `impl`s for
// `AsFd`/`From<OwnedFd>`/`Into<OwnedFd>` and
// `AsRawFd`/`IntoRawFd`/`FromRawFd`, on Unix and WASI, and
// `AsSocket`/`From<OwnedSocket>`/`Into<OwnedSocket>` and
// `AsRawSocket`/`IntoRawSocket`/`FromRawSocket` on Windows.

impl AsInner<net_imp::UdpSocket> for UdpSocket {
    #[inline]
    fn as_inner(&self) -> &net_imp::UdpSocket {
        &self.0
    }
}

impl FromInner<net_imp::UdpSocket> for UdpSocket {
    fn from_inner(inner: net_imp::UdpSocket) -> UdpSocket {
        UdpSocket(inner)
    }
}

impl IntoInner<net_imp::UdpSocket> for UdpSocket {
    fn into_inner(self) -> net_imp::UdpSocket {
        self.0
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl fmt::Debug for UdpSocket {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.0.fmt(f)
    }
}
