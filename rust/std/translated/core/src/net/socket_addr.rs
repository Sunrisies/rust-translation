use super::display_buffer::DisplayBuffer;
use crate::fmt::{self, Write};
use crate::net::{IpAddr, Ipv4Addr, Ipv6Addr};

/// 一个互联网套接字地址，可以是 IPv4 或 IPv6。
///
/// 互联网套接字地址由 [IP 地址]、16 位端口号以及
/// as possibly some version-dependent additional information. See [`SocketAddrV4`]'s and
/// [`SocketAddrV6`]'s respective documentation for more details.
///
/// [IP address]: IpAddr
///
/// # 可移植性
///
/// `SocketAddr` is intended to be a portable representation of socket addresses and is likely not
/// 与目标操作系统 API 使用的内部套接字地址类型不同。像所有
/// `repr(Rust)` structs, however, its exact layout remains undefined and should not be relied upon
/// # 示例
///
/// # 示例
///
/// ```
/// use std::net::{IpAddr, Ipv4Addr, SocketAddr};
///
/// let socket = SocketAddr::new(IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1)), 8080);
///
/// assert_eq!("127.0.0.1:8080".parse(), Ok(socket));
/// assert_eq!(socket.port(), 8080);
/// assert_eq!(socket.is_ipv4(), true);
/// ```
#[derive(Copy, Clone, PartialEq, Eq, Hash, PartialOrd, Ord)]
#[stable(feature = "rust1", since = "1.0.0")]
pub enum SocketAddr {
    /// 一个 IPv4 套接字地址。
    #[stable(feature = "rust1", since = "1.0.0")]
    V4(#[stable(feature = "rust1", since = "1.0.0")] SocketAddrV4),
    /// 一个 IPv6 套接字地址。
    #[stable(feature = "rust1", since = "1.0.0")]
    V6(#[stable(feature = "rust1", since = "1.0.0")] SocketAddrV6),
}

/// 一个 IPv4 套接字地址。
///
/// IPv4 socket addresses consist of an [`IPv4` address] and a 16-bit port number, as
/// 在 [IETF RFC 793] 中所述。
///
/// See [`SocketAddr`] for a type encompassing both IPv4 and IPv6 socket addresses.
///
/// [IETF RFC 793]: https://tools.ietf.org/html/rfc793
/// [`IPv4` address]: Ipv4Addr
///
/// # 可移植性
///
/// `SocketAddrV4` is intended to be a portable representation of socket addresses and is likely not
/// 与目标操作系统 API 使用的内部套接字地址类型不同。像所有
/// `repr(Rust)` structs, however, its exact layout remains undefined and should not be relied upon
/// # 示例
///
/// # 文本表示形式
///
/// `SocketAddrV4` provides a [`FromStr`](crate::str::FromStr) implementation.
/// 它在 [文本表示形式] 中接受 IPv4 地址，随后是一个
/// single `:`, followed by the port encoded as a decimal integer.  Other
/// 格式不被接受。
///
/// [textual representation]: Ipv4Addr#textual-representation
///
/// # 示例
///
/// ```
/// use std::net::{Ipv4Addr, SocketAddrV4};
///
/// let socket = SocketAddrV4::new(Ipv4Addr::new(127, 0, 0, 1), 8080);
///
/// assert_eq!("127.0.0.1:8080".parse(), Ok(socket));
/// assert_eq!(socket.ip(), &Ipv4Addr::new(127, 0, 0, 1));
/// assert_eq!(socket.port(), 8080);
/// ```
#[derive(Copy, Clone, Eq, PartialEq, Ord, PartialOrd, Hash)]
#[stable(feature = "rust1", since = "1.0.0")]
pub struct SocketAddrV4 {
    ip: Ipv4Addr,
    port: u16,
}

/// 一个 IPv6 套接字地址。
///
/// IPv6 socket addresses consist of an [`IPv6` address], a 16-bit port number, as well
/// 包含流量类别、流标签和范围标识符的字段组成。
/// （更多详情请参阅 [IETF RFC 2553, Section 3.3]）。
///
/// See [`SocketAddr`] for a type encompassing both IPv4 and IPv6 socket addresses.
///
/// [IETF RFC 2553, Section 3.3]: https://tools.ietf.org/html/rfc2553#section-3.3
/// [`IPv6` address]: Ipv6Addr
///
/// # 可移植性
///
/// `SocketAddrV6` is intended to be a portable representation of socket addresses and is likely not
/// 与目标操作系统 API 使用的内部套接字地址类型不同。像所有
/// `repr(Rust)` structs, however, its exact layout remains undefined and should not be relied upon
/// # 示例
///
/// # 文本表示形式
///
/// `SocketAddrV6` provides a [`FromStr`](crate::str::FromStr) implementation,
/// 基于 [IETF RFC 5952] 推荐的括号格式，
/// 范围标识符基于 [IETF RFC 4007] 中指定的内容。
///
/// 它接受由以下元素按顺序组成的地址：
///   - A left square bracket (`[`)
/// - IPv6 地址的 [文本表示]
///   - _Optionally_, a percent sign (`%`) followed by the scope identifier
/// 编码为十进制整数
///   - A right square bracket (`]`)
///   - A colon (`:`)
/// - 端口，编码为十进制整数。
///
/// For example, the string `[2001:db8::413]:443` represents a `SocketAddrV6`
/// with the address `2001:db8::413` and port `443`.  The string
/// `[2001:db8::413%612]:443` represents the same address and port, with a
/// scope identifier of `612`.
///
/// 不接受其他格式。
///
/// [IETF RFC 5952]: https://tools.ietf.org/html/rfc5952#section-6
/// [IETF RFC 4007]: https://tools.ietf.org/html/rfc4007#section-11
/// [textual representation]: Ipv6Addr#textual-representation
///
/// # 示例
///
/// ```
/// use std::net::{Ipv6Addr, SocketAddrV6};
///
/// let socket = SocketAddrV6::new(Ipv6Addr::new(0x2001, 0xdb8, 0, 0, 0, 0, 0, 1), 8080, 0, 0);
///
/// assert_eq!("[2001:db8::1]:8080".parse(), Ok(socket));
/// assert_eq!(socket.ip(), &Ipv6Addr::new(0x2001, 0xdb8, 0, 0, 0, 0, 0, 1));
/// assert_eq!(socket.port(), 8080);
///
/// let mut with_scope = socket.clone();
/// with_scope.set_scope_id(3);
/// assert_eq!("[2001:db8::1%3]:8080".parse(), Ok(with_scope));
/// ```
#[derive(Copy, Clone, Eq, PartialEq, Ord, PartialOrd, Hash)]
#[stable(feature = "rust1", since = "1.0.0")]
pub struct SocketAddrV6 {
    ip: Ipv6Addr,
    port: u16,
    flowinfo: u32,
    scope_id: u32,
}

impl SocketAddr {
    /// 从 [IP 地址] 和端口号创建一个新的套接字地址。
    ///
    /// [IP address]: IpAddr
    ///
    /// # 示例
    ///
    /// ```
    /// use std::net::{IpAddr, Ipv4Addr, SocketAddr};
    ///
    /// let socket = SocketAddr::new(IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1)), 8080);
    /// assert_eq!(socket.ip(), IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1)));
    /// assert_eq!(socket.port(), 8080);
    /// ```
    #[stable(feature = "ip_addr", since = "1.7.0")]
    #[must_use]
    #[rustc_const_stable(feature = "const_socketaddr", since = "1.69.0")]
    #[inline]
    pub const fn new(ip: IpAddr, port: u16) -> SocketAddr {
        match ip {
            IpAddr::V4(a) => SocketAddr::V4(SocketAddrV4::new(a, port)),
            IpAddr::V6(a) => SocketAddr::V6(SocketAddrV6::new(a, port, 0, 0)),
        }
    }

    /// 返回与此套接字地址关联的 IP 地址。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::net::{IpAddr, Ipv4Addr, SocketAddr};
    ///
    /// let socket = SocketAddr::new(IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1)), 8080);
    /// assert_eq!(socket.ip(), IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1)));
    /// ```
    #[must_use]
    #[stable(feature = "ip_addr", since = "1.7.0")]
    #[rustc_const_stable(feature = "const_socketaddr", since = "1.69.0")]
    #[inline]
    pub const fn ip(&self) -> IpAddr {
        match *self {
            SocketAddr::V4(ref a) => IpAddr::V4(*a.ip()),
            SocketAddr::V6(ref a) => IpAddr::V6(*a.ip()),
        }
    }

    /// 更改与此套接字地址关联的 IP 地址。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::net::{IpAddr, Ipv4Addr, SocketAddr};
    ///
    /// let mut socket = SocketAddr::new(IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1)), 8080);
    /// socket.set_ip(IpAddr::V4(Ipv4Addr::new(10, 10, 0, 1)));
    /// assert_eq!(socket.ip(), IpAddr::V4(Ipv4Addr::new(10, 10, 0, 1)));
    /// ```
    #[inline]
    #[stable(feature = "sockaddr_setters", since = "1.9.0")]
    #[rustc_const_stable(feature = "const_sockaddr_setters", since = "1.87.0")]
    pub const fn set_ip(&mut self, new_ip: IpAddr) {
        // `match (*self, new_ip)` would have us mutate a copy of self only to throw it away.
        match (self, new_ip) {
            (&mut SocketAddr::V4(ref mut a), IpAddr::V4(new_ip)) => a.set_ip(new_ip),
            (&mut SocketAddr::V6(ref mut a), IpAddr::V6(new_ip)) => a.set_ip(new_ip),
            (self_, new_ip) => *self_ = Self::new(new_ip, self_.port()),
        }
    }

    /// 返回与此套接字地址关联的端口号。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::net::{IpAddr, Ipv4Addr, SocketAddr};
    ///
    /// let socket = SocketAddr::new(IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1)), 8080);
    /// assert_eq!(socket.port(), 8080);
    /// ```
    #[must_use]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_socketaddr", since = "1.69.0")]
    #[inline]
    pub const fn port(&self) -> u16 {
        match *self {
            SocketAddr::V4(ref a) => a.port(),
            SocketAddr::V6(ref a) => a.port(),
        }
    }

    /// 更改与此套接字地址关联的端口号。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::net::{IpAddr, Ipv4Addr, SocketAddr};
    ///
    /// let mut socket = SocketAddr::new(IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1)), 8080);
    /// socket.set_port(1025);
    /// assert_eq!(socket.port(), 1025);
    /// ```
    #[inline]
    #[stable(feature = "sockaddr_setters", since = "1.9.0")]
    #[rustc_const_stable(feature = "const_sockaddr_setters", since = "1.87.0")]
    pub const fn set_port(&mut self, new_port: u16) {
        match *self {
            SocketAddr::V4(ref mut a) => a.set_port(new_port),
            SocketAddr::V6(ref mut a) => a.set_port(new_port),
        }
    }

    /// Returns [`true`] if the [IP address] in this `SocketAddr` is an
    /// [`IPv4` address], and [`false`] otherwise.
    ///
    /// [IP address]: IpAddr
    /// [`IPv4` address]: IpAddr::V4
    ///
    /// # 示例
    ///
    /// ```
    /// use std::net::{IpAddr, Ipv4Addr, SocketAddr};
    ///
    /// let socket = SocketAddr::new(IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1)), 8080);
    /// assert_eq!(socket.is_ipv4(), true);
    /// assert_eq!(socket.is_ipv6(), false);
    /// ```
    #[must_use]
    #[stable(feature = "sockaddr_checker", since = "1.16.0")]
    #[rustc_const_stable(feature = "const_socketaddr", since = "1.69.0")]
    #[inline]
    pub const fn is_ipv4(&self) -> bool {
        matches!(*self, SocketAddr::V4(_))
    }

    /// Returns [`true`] if the [IP address] in this `SocketAddr` is an
    /// [`IPv6` address], and [`false`] otherwise.
    ///
    /// [IP address]: IpAddr
    /// [`IPv6` address]: IpAddr::V6
    ///
    /// # 示例
    ///
    /// ```
    /// use std::net::{IpAddr, Ipv6Addr, SocketAddr};
    ///
    /// let socket = SocketAddr::new(IpAddr::V6(Ipv6Addr::new(0, 0, 0, 0, 0, 65535, 0, 1)), 8080);
    /// assert_eq!(socket.is_ipv4(), false);
    /// assert_eq!(socket.is_ipv6(), true);
    /// ```
    #[must_use]
    #[stable(feature = "sockaddr_checker", since = "1.16.0")]
    #[rustc_const_stable(feature = "const_socketaddr", since = "1.69.0")]
    #[inline]
    pub const fn is_ipv6(&self) -> bool {
        matches!(*self, SocketAddr::V6(_))
    }

    /// 返回相同 IP 版本下的未指定套接字地址。
    ///
    /// Returns `0.0.0.0:0` for IPv4 and `[::]:0` for IPv6. For IPv6, this
    /// 方法保留流信息和范围 ID。
    ///
    /// 当必须将套接字绑定到未指定的本地
    /// 地址，且该本地地址与远程地址使用相同 IP 版本时，使用此方法。
    ///
    /// # 示例
    /// ```
    /// #![feature(addr_unspecified_from)]
    /// use std::net::{SocketAddr, SocketAddrV4, SocketAddrV6, Ipv4Addr, Ipv6Addr};
    ///
    /// let addr = SocketAddr::V4(SocketAddrV4::new(Ipv4Addr::new(127, 0, 0, 1), 3000));
    /// assert_eq!(
    ///     SocketAddr::unspecified_from(addr),
    ///     SocketAddr::V4(SocketAddrV4::new(Ipv4Addr::UNSPECIFIED, 0))
    /// );
    ///
    /// let addr = SocketAddr::V6(SocketAddrV6::new(
    ///     Ipv6Addr::new(0x2001, 0xdb8, 0, 0, 0, 0, 0, 1),
    ///     443,
    ///     0x1234,
    ///     5,
    /// ));
    ///
    /// let unspecified = SocketAddr::unspecified_from(addr);
    /// assert_eq!(unspecified.ip(), Ipv6Addr::UNSPECIFIED);
    /// if let SocketAddr::V6(v6) = unspecified {
    ///     assert_eq!(v6.flowinfo(), 0x1234);
    ///     assert_eq!(v6.scope_id(), 5);
    /// }
    /// ```
    #[inline]
    #[must_use]
    #[unstable(feature = "addr_unspecified_from", issue = "158975")]
    pub const fn unspecified_from(this: Self) -> Self {
        match this {
            Self::V4(_) => Self::V4(SocketAddrV4::new(Ipv4Addr::UNSPECIFIED, 0)),
            Self::V6(addr) => Self::V6(SocketAddrV6::new(
                Ipv6Addr::UNSPECIFIED,
                0,
                addr.flowinfo(),
                addr.scope_id(),
            )),
        }
    }
}

impl SocketAddrV4 {
    /// Creates a new socket address from an [`IPv4` address] and a port number.
    ///
    /// [`IPv4` address]: Ipv4Addr
    ///
    /// # 示例
    ///
    /// ```
    /// use std::net::{SocketAddrV4, Ipv4Addr};
    ///
    /// let socket = SocketAddrV4::new(Ipv4Addr::new(127, 0, 0, 1), 8080);
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[must_use]
    #[rustc_const_stable(feature = "const_socketaddr", since = "1.69.0")]
    #[inline]
    pub const fn new(ip: Ipv4Addr, port: u16) -> SocketAddrV4 {
        SocketAddrV4 { ip, port }
    }

    /// 返回与此套接字地址关联的 IP 地址。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::net::{SocketAddrV4, Ipv4Addr};
    ///
    /// let socket = SocketAddrV4::new(Ipv4Addr::new(127, 0, 0, 1), 8080);
    /// assert_eq!(socket.ip(), &Ipv4Addr::new(127, 0, 0, 1));
    /// ```
    #[must_use]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_socketaddr", since = "1.69.0")]
    #[inline]
    pub const fn ip(&self) -> &Ipv4Addr {
        &self.ip
    }

    /// 更改与此套接字地址关联的 IP 地址。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::net::{SocketAddrV4, Ipv4Addr};
    ///
    /// let mut socket = SocketAddrV4::new(Ipv4Addr::new(127, 0, 0, 1), 8080);
    /// socket.set_ip(Ipv4Addr::new(192, 168, 0, 1));
    /// assert_eq!(socket.ip(), &Ipv4Addr::new(192, 168, 0, 1));
    /// ```
    #[inline]
    #[stable(feature = "sockaddr_setters", since = "1.9.0")]
    #[rustc_const_stable(feature = "const_sockaddr_setters", since = "1.87.0")]
    pub const fn set_ip(&mut self, new_ip: Ipv4Addr) {
        self.ip = new_ip;
    }

    /// 返回与此套接字地址关联的端口号。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::net::{SocketAddrV4, Ipv4Addr};
    ///
    /// let socket = SocketAddrV4::new(Ipv4Addr::new(127, 0, 0, 1), 8080);
    /// assert_eq!(socket.port(), 8080);
    /// ```
    #[must_use]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_socketaddr", since = "1.69.0")]
    #[inline]
    pub const fn port(&self) -> u16 {
        self.port
    }

    /// 更改与此套接字地址关联的端口号。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::net::{SocketAddrV4, Ipv4Addr};
    ///
    /// let mut socket = SocketAddrV4::new(Ipv4Addr::new(127, 0, 0, 1), 8080);
    /// socket.set_port(4242);
    /// assert_eq!(socket.port(), 4242);
    /// ```
    #[inline]
    #[stable(feature = "sockaddr_setters", since = "1.9.0")]
    #[rustc_const_stable(feature = "const_sockaddr_setters", since = "1.87.0")]
    pub const fn set_port(&mut self, new_port: u16) {
        self.port = new_port;
    }
}

impl SocketAddrV6 {
    /// Creates a new socket address from an [`IPv6` address], a 16-bit port number,
    /// and the `flowinfo` and `scope_id` fields.
    ///
    /// For more information on the meaning and layout of the `flowinfo` and `scope_id`
    /// # 示例
    ///
    /// [IETF RFC 2553, Section 3.3]: https://tools.ietf.org/html/rfc2553#section-3.3
    /// [`IPv6` address]: Ipv6Addr
    ///
    /// # 返回与此套接字地址关联的 IP 地址。
    ///
    /// ```
    /// use std::net::{SocketAddrV6, Ipv6Addr};
    ///
    /// let socket = SocketAddrV6::new(Ipv6Addr::new(0, 0, 0, 0, 0, 0, 0, 1), 8080, 0, 0);
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[must_use]
    #[rustc_const_stable(feature = "const_socketaddr", since = "1.69.0")]
    #[inline]
    pub const fn new(ip: Ipv6Addr, port: u16, flowinfo: u32, scope_id: u32) -> SocketAddrV6 {
        SocketAddrV6 { ip, port, flowinfo, scope_id }
    }

    /// # 示例
    ///
    /// # 示例
    ///
    /// ```
    /// use std::net::{SocketAddrV6, Ipv6Addr};
    ///
    /// let socket = SocketAddrV6::new(Ipv6Addr::new(0, 0, 0, 0, 0, 0, 0, 1), 8080, 0, 0);
    /// assert_eq!(socket.ip(), &Ipv6Addr::new(0, 0, 0, 0, 0, 0, 0, 1));
    /// ```
    #[must_use]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_socketaddr", since = "1.69.0")]
    #[inline]
    pub const fn ip(&self) -> &Ipv6Addr {
        &self.ip
    }

    /// 更改与此套接字地址关联的 IP 地址。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::net::{SocketAddrV6, Ipv6Addr};
    ///
    /// let mut socket = SocketAddrV6::new(Ipv6Addr::new(0, 0, 0, 0, 0, 0, 0, 1), 8080, 0, 0);
    /// socket.set_ip(Ipv6Addr::new(76, 45, 0, 0, 0, 0, 0, 0));
    /// assert_eq!(socket.ip(), &Ipv6Addr::new(76, 45, 0, 0, 0, 0, 0, 0));
    /// ```
    #[inline]
    #[stable(feature = "sockaddr_setters", since = "1.9.0")]
    #[rustc_const_stable(feature = "const_sockaddr_setters", since = "1.87.0")]
    pub const fn set_ip(&mut self, new_ip: Ipv6Addr) {
        self.ip = new_ip;
    }

    /// 返回与此套接字地址相关的端口号。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::net::{SocketAddrV6, Ipv6Addr};
    ///
    /// let socket = SocketAddrV6::new(Ipv6Addr::new(0, 0, 0, 0, 0, 0, 0, 1), 8080, 0, 0);
    /// assert_eq!(socket.port(), 8080);
    /// ```
    #[must_use]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_socketaddr", since = "1.69.0")]
    #[inline]
    pub const fn port(&self) -> u16 {
        self.port
    }

    /// 更改与此套接字地址相关的端口号。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::net::{SocketAddrV6, Ipv6Addr};
    ///
    /// let mut socket = SocketAddrV6::new(Ipv6Addr::new(0, 0, 0, 0, 0, 0, 0, 1), 8080, 0, 0);
    /// socket.set_port(4242);
    /// assert_eq!(socket.port(), 4242);
    /// ```
    #[inline]
    #[stable(feature = "sockaddr_setters", since = "1.9.0")]
    #[rustc_const_stable(feature = "const_sockaddr_setters", since = "1.87.0")]
    pub const fn set_port(&mut self, new_port: u16) {
        self.port = new_port;
    }

    /// 返回与此地址相关的流信息。
    ///
    /// This information corresponds to the `sin6_flowinfo` field in C's `netinet/in.h`,
    /// 如 [IETF RFC 2553, 第 3.3 节] 中所述。
    /// 它结合了流标签和流量类别的信息，如 [IETF RFC 2460] 中的 [第 6 节] 和 [第 7 节] 所述。
    /// # 示例
    ///
    /// [IETF RFC 2553, Section 3.3]: https://tools.ietf.org/html/rfc2553#section-3.3
    /// [IETF RFC 2460]: https://tools.ietf.org/html/rfc2460
    /// [Section 6]: https://tools.ietf.org/html/rfc2460#section-6
    /// [Section 7]: https://tools.ietf.org/html/rfc2460#section-7
    ///
    /// # 示例
    ///
    /// ```
    /// use std::net::{SocketAddrV6, Ipv6Addr};
    ///
    /// let socket = SocketAddrV6::new(Ipv6Addr::new(0, 0, 0, 0, 0, 0, 0, 1), 8080, 10, 0);
    /// assert_eq!(socket.flowinfo(), 10);
    /// ```
    #[must_use]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_socketaddr", since = "1.69.0")]
    #[inline]
    pub const fn flowinfo(&self) -> u32 {
        self.flowinfo
    }

    /// 更改与此套接字地址相关的流信息。
    ///
    /// See [`SocketAddrV6::flowinfo`]'s documentation for more details.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::net::{SocketAddrV6, Ipv6Addr};
    ///
    /// let mut socket = SocketAddrV6::new(Ipv6Addr::new(0, 0, 0, 0, 0, 0, 0, 1), 8080, 10, 0);
    /// socket.set_flowinfo(56);
    /// assert_eq!(socket.flowinfo(), 56);
    /// ```
    #[inline]
    #[stable(feature = "sockaddr_setters", since = "1.9.0")]
    #[rustc_const_stable(feature = "const_sockaddr_setters", since = "1.87.0")]
    pub const fn set_flowinfo(&mut self, new_flowinfo: u32) {
        self.flowinfo = new_flowinfo;
    }

    /// 返回与此地址相关的范围 ID。
    ///
    /// This information corresponds to the `sin6_scope_id` field in C's `netinet/in.h`,
    /// 如 [IETF RFC 2553, 第 3.3 节] 中所述。
    ///
    /// [IETF RFC 2553, Section 3.3]: https://tools.ietf.org/html/rfc2553#section-3.3
    ///
    /// # 示例
    ///
    /// ```
    /// use std::net::{SocketAddrV6, Ipv6Addr};
    ///
    /// let socket = SocketAddrV6::new(Ipv6Addr::new(0, 0, 0, 0, 0, 0, 0, 1), 8080, 0, 78);
    /// assert_eq!(socket.scope_id(), 78);
    /// ```
    #[must_use]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_socketaddr", since = "1.69.0")]
    #[inline]
    pub const fn scope_id(&self) -> u32 {
        self.scope_id
    }

    /// 更改与此套接字地址相关的范围 ID。
    ///
    /// See [`SocketAddrV6::scope_id`]'s documentation for more details.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::net::{SocketAddrV6, Ipv6Addr};
    ///
    /// let mut socket = SocketAddrV6::new(Ipv6Addr::new(0, 0, 0, 0, 0, 0, 0, 1), 8080, 0, 78);
    /// socket.set_scope_id(42);
    /// assert_eq!(socket.scope_id(), 42);
    /// ```
    #[inline]
    #[stable(feature = "sockaddr_setters", since = "1.9.0")]
    #[rustc_const_stable(feature = "const_sockaddr_setters", since = "1.87.0")]
    pub const fn set_scope_id(&mut self, new_scope_id: u32) {
        self.scope_id = new_scope_id;
    }
}

#[stable(feature = "ip_from_ip", since = "1.16.0")]
#[rustc_const_unstable(feature = "const_convert", issue = "143773")]
const impl From<SocketAddrV4> for SocketAddr {
    /// Converts a [`SocketAddrV4`] into a [`SocketAddr::V4`].
    #[inline]
    fn from(sock4: SocketAddrV4) -> SocketAddr {
        SocketAddr::V4(sock4)
    }
}

#[stable(feature = "ip_from_ip", since = "1.16.0")]
#[rustc_const_unstable(feature = "const_convert", issue = "143773")]
const impl From<SocketAddrV6> for SocketAddr {
    /// Converts a [`SocketAddrV6`] into a [`SocketAddr::V6`].
    #[inline]
    fn from(sock6: SocketAddrV6) -> SocketAddr {
        SocketAddr::V6(sock6)
    }
}

#[stable(feature = "addr_from_into_ip", since = "1.17.0")]
#[rustc_const_unstable(feature = "const_convert", issue = "143773")]
const impl<I: [const] Into<IpAddr>> From<(I, u16)> for SocketAddr {
    /// Converts a tuple struct (Into<[`IpAddr`]>, `u16`) into a [`SocketAddr`].
    ///
    /// This conversion creates a [`SocketAddr::V4`] for an [`IpAddr::V4`]
    /// and creates a [`SocketAddr::V6`] for an [`IpAddr::V6`].
    ///
    /// `u16` is treated as port of the newly created [`SocketAddr`].
    fn from(pieces: (I, u16)) -> SocketAddr {
        SocketAddr::new(pieces.0.into(), pieces.1)
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl fmt::Display for SocketAddr {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match *self {
            SocketAddr::V4(ref a) => a.fmt(f),
            SocketAddr::V6(ref a) => a.fmt(f),
        }
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl fmt::Debug for SocketAddr {
    fn fmt(&self, fmt: &mut fmt::Formatter<'_>) -> fmt::Result {
        fmt::Display::fmt(self, fmt)
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl fmt::Display for SocketAddrV4 {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        // If there are no alignment requirements, write the socket address directly to `f`.
        // Otherwise, write it to a local buffer and then use `f.pad`.
        if f.precision().is_none() && f.width().is_none() {
            write!(f, "{}:{}", self.ip(), self.port())
        } else {
            const LONGEST_IPV4_SOCKET_ADDR: &str = "255.255.255.255:65535";

            let mut buf = DisplayBuffer::buffer::<{ LONGEST_IPV4_SOCKET_ADDR.len() }>();
            let mut buf = DisplayBuffer::new(&mut buf);
            // Buffer is long enough for the longest possible IPv4 socket address, so this should never fail.
            write!(buf, "{}:{}", self.ip(), self.port()).unwrap();

            f.pad(buf.as_str())
        }
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl fmt::Debug for SocketAddrV4 {
    fn fmt(&self, fmt: &mut fmt::Formatter<'_>) -> fmt::Result {
        fmt::Display::fmt(self, fmt)
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl fmt::Display for SocketAddrV6 {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        // If there are no alignment requirements, write the socket address directly to `f`.
        // Otherwise, write it to a local buffer and then use `f.pad`.
        if f.precision().is_none() && f.width().is_none() {
            match self.scope_id() {
                0 => write!(f, "[{}]:{}", self.ip(), self.port()),
                scope_id => write!(f, "[{}%{}]:{}", self.ip(), scope_id, self.port()),
            }
        } else {
            const LONGEST_IPV6_SOCKET_ADDR: &str =
                "[ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff%4294967295]:65535";

            let mut buf = DisplayBuffer::buffer::<{ LONGEST_IPV6_SOCKET_ADDR.len() }>();
            let mut buf = DisplayBuffer::new(&mut buf);
            match self.scope_id() {
                0 => write!(buf, "[{}]:{}", self.ip(), self.port()),
                scope_id => write!(buf, "[{}%{}]:{}", self.ip(), scope_id, self.port()),
            }
            // Buffer is long enough for the longest possible IPv6 socket address, so this should never fail.
            .unwrap();

            f.pad(buf.as_str())
        }
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl fmt::Debug for SocketAddrV6 {
    fn fmt(&self, fmt: &mut fmt::Formatter<'_>) -> fmt::Result {
        fmt::Display::fmt(self, fmt)
    }
}
