//! Cygwin 特有的网络功能。
//!
//! 在 Cygwin 上，Unix 域套接字存在一些限制：
//! * The syscalls `accept` and `connect` need
//! [handshake](https://inbox.sourceware.org/cygwin/Z_UERXFI1g-1v3p2@calimero.vinschen.de/T/#t).
//! * 无法绑定到抽象地址。
//! * 无边界的 Unix 套接字具有抽象的本地地址。
//! * 不支持带有控制数据的 `recvmsg` 操作。

#![stable(feature = "unix_socket_abstract", since = "1.70.0")]

#[stable(feature = "unix_socket_abstract", since = "1.70.0")]
pub use crate::os::net::linux_ext::addr::SocketAddrExt;
#[unstable(feature = "unix_socket_ancillary_data", issue = "76915")]
pub use crate::os::net::linux_ext::socket::UnixSocketExt;
#[stable(feature = "tcp_quickack", since = "1.89.0")]
pub use crate::os::net::linux_ext::tcp::TcpStreamExt;
