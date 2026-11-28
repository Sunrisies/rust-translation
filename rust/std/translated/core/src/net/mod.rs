//! 用于 IP 通信的网络基础结构。
//!
//! 此模块提供 IP 地址和套接字地址的相关类型。
//!
//! # 组织结构
//!
//! * [`IpAddr`] represents IP addresses of either IPv4 or IPv6; [`Ipv4Addr`] and
//!   [`Ipv6Addr`] are respectively IPv4 and IPv6 addresses
//! * [`SocketAddr`] represents socket addresses of either IPv4 or IPv6; [`SocketAddrV4`]
//!   and [`SocketAddrV6`] are respectively IPv4 and IPv6 socket addresses

#![stable(feature = "ip_in_core", since = "1.77.0")]

#[stable(feature = "rust1", since = "1.0.0")]
pub use self::ip_addr::{IpAddr, Ipv4Addr, Ipv6Addr, Ipv6MulticastScope};
#[stable(feature = "rust1", since = "1.0.0")]
pub use self::parser::AddrParseError;
#[stable(feature = "rust1", since = "1.0.0")]
pub use self::socket_addr::{SocketAddr, SocketAddrV4, SocketAddrV6};

mod display_buffer;
mod ip_addr;
mod parser;
mod socket_addr;
