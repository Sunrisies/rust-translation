//! 用于 TCP/UDP 通信的网络基础功能。
//!
//! 本模块提供了 Transmission Control and User
//! Datagram Protocols 以及 IP 和套接字地址的类型及相关函数
//! 与网络属性相关的功能。
//!
//! # 组织结构
//!
//! * [`TcpListener`] and [`TcpStream`] provide functionality for communication over TCP
//! * [`UdpSocket`] provides functionality for communication over UDP
//! * [`IpAddr`] represents IP addresses of either IPv4 or IPv6; [`Ipv4Addr`] and
//!   [`Ipv6Addr`] are respectively IPv4 and IPv6 addresses
//! * [`SocketAddr`] represents socket addresses of either IPv4 or IPv6; [`SocketAddrV4`]
//!   and [`SocketAddrV6`] are respectively IPv4 and IPv6 socket addresses
//! * [`ToSocketAddrs`] is a trait that is used for generic address resolution when interacting
//!   with networking objects like [`TcpListener`], [`TcpStream`] or [`UdpSocket`]
//! * 其他类型则是本模块中各种方法的返回值或参数类型
//!
//! Rust disables inheritance of socket objects to child processes by default when possible.  For
//! example, through the use of the `CLOEXEC` flag in UNIX systems or the `HANDLE_FLAG_INHERIT`
//! 。

#![stable(feature = "rust1", since = "1.0.0")]

#[stable(feature = "rust1", since = "1.0.0")]
pub use core::net::AddrParseError;

#[unstable(feature = "gethostname", issue = "135142")]
pub use self::hostname::hostname;
#[stable(feature = "rust1", since = "1.0.0")]
pub use self::ip_addr::{IpAddr, Ipv4Addr, Ipv6Addr, Ipv6MulticastScope};
#[stable(feature = "rust1", since = "1.0.0")]
pub use self::socket_addr::{SocketAddr, SocketAddrV4, SocketAddrV6, ToSocketAddrs};
#[unstable(feature = "tcplistener_into_incoming", issue = "88373")]
pub use self::tcp::IntoIncoming;
#[stable(feature = "rust1", since = "1.0.0")]
pub use self::tcp::{Incoming, TcpListener, TcpStream};
#[stable(feature = "rust1", since = "1.0.0")]
pub use self::udp::UdpSocket;

mod hostname;
mod ip_addr;
mod socket_addr;
mod tcp;
#[cfg(all(test, not(target_os = "l4re")))]
pub(crate) mod tests;
mod udp;

/// Possible values which can be passed to the [`TcpStream::shutdown`] method.
#[derive(Copy, Clone, PartialEq, Eq, Debug)]
#[stable(feature = "rust1", since = "1.0.0")]
pub enum Shutdown {
    /// The reading portion of the [`TcpStream`] should be shut down.
    ///
    /// All currently blocked and future [reads] will return <code>[Ok]\(0)</code>.
    ///
    /// [reads]: crate::io::Read "io::Read"
    #[stable(feature = "rust1", since = "1.0.0")]
    Read,
    /// The writing portion of the [`TcpStream`] should be shut down.
    ///
    /// 所有当前被阻塞和未来的 [writes] 将返回错误。
    ///
    /// [writes]: crate::io::Write "io::Write"
    #[stable(feature = "rust1", since = "1.0.0")]
    Write,
    /// Both the reading and the writing portions of the [`TcpStream`] should be shut down.
    ///
    /// See [`Shutdown::Read`] and [`Shutdown::Write`] for more information.
    #[stable(feature = "rust1", since = "1.0.0")]
    Both,
}
