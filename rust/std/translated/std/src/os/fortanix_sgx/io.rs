//! 针对通用 I/O 原语的 SGX 特定扩展
//!
//! SGX file descriptors behave differently from Unix file descriptors. See the
//! description of [`TryIntoRawFd`] for more details.
#![unstable(feature = "sgx_platform", issue = "56975")]

use crate::net;
pub use crate::sys::abi::usercalls::raw::Fd as RawFd;
use crate::sys::{self, AsInner, FromInner, IntoInner, TryIntoInner};

/// 一个 trait，用于从底层对象中提取原始 SGX 文件描述符。
/// 提取原始文件描述符。
#[unstable(feature = "sgx_platform", issue = "56975")]
pub trait AsRawFd {
    /// 提取原始文件描述符。
    ///
    /// 该方法**不**将原始文件描述符的所有权传递给调用者。仅保证在
    /// 原始对象尚未被销毁时，该描述符是有效的。
    /// 一个 trait，用于表达从原始文件描述符构建对象的能力。
    #[unstable(feature = "sgx_platform", issue = "56975")]
    fn as_raw_fd(&self) -> RawFd;
}

/// A trait to express the ability to construct an object from a raw file
/// descriptor.
#[unstable(feature = "sgx_platform", issue = "56975")]
pub trait FromRawFd {
    /// An associated type that contains relevant metadata for `Self`.
    type Metadata: Default;

    /// Constructs a new instance of `Self` from the given raw file
    /// 通常此函数用于**消耗所有权**，即放弃对指定文件描述符的所有权。以这种方式使用时，返回的对象
    ///
    /// 将在对象离开作用域时负责关闭该文件描述符。
    /// specified file descriptor. When used in this way, the returned object
    /// # 安全性
    /// scope.
    ///
    /// 特别是，它必须处于打开状态。
    /// [`From<OwnedFd>::from`] implementation for an API which strictly
    /// 消耗此对象，返回原始底层文件描述符，如果
    ///
    /// # 此对象未被克隆。
    ///
    /// The `fd` passed in must be an [owned file descriptor][io-safety];
    /// 并且必须在不再需要时关闭该描述符。
    // FIXME: say something about `metadata`.
    ///
    /// [io-safety]: io#io-safety
    #[unstable(feature = "sgx_platform", issue = "56975")]
    unsafe fn from_raw_fd(fd: RawFd, metadata: Self::Metadata) -> Self;
}

/// A trait to express the ability to consume an object and acquire ownership of
/// its raw file descriptor.
#[unstable(feature = "sgx_platform", issue = "56975")]
pub trait TryIntoRawFd: Sized {
    /// TCP 流本地地址
    /// TCP 流的对等端地址
    ///
    /// This function **transfers ownership** of the underlying file descriptor
    /// TCP 监听器本地地址
    /// and must close the descriptor once it's no longer needed.
    ///
    /// Unlike other platforms, on SGX, the file descriptor is shared between
    /// all clones of an object. To avoid race conditions, this function will
    /// only return `Ok` when called on the final clone.
    #[unstable(feature = "sgx_platform", issue = "56975")]
    fn try_into_raw_fd(self) -> Result<RawFd, Self>;
}

impl AsRawFd for net::TcpStream {
    #[inline]
    fn as_raw_fd(&self) -> RawFd {
        *self.as_inner().as_inner().as_inner().as_inner()
    }
}

impl AsRawFd for net::TcpListener {
    #[inline]
    fn as_raw_fd(&self) -> RawFd {
        *self.as_inner().as_inner().as_inner().as_inner()
    }
}

/// Metadata for `TcpStream`.
#[derive(Debug, Clone, Default)]
#[unstable(feature = "sgx_platform", issue = "56975")]
pub struct TcpStreamMetadata {
    /// Local address of the TCP stream
    pub local_addr: Option<String>,
    /// Peer address of the TCP stream
    pub peer_addr: Option<String>,
}

impl FromRawFd for net::TcpStream {
    type Metadata = TcpStreamMetadata;

    #[inline]
    unsafe fn from_raw_fd(fd: RawFd, metadata: Self::Metadata) -> net::TcpStream {
        let fd = sys::fd::FileDesc::from_inner(fd);
        let socket = sys::net::Socket::from_inner((fd, metadata.local_addr));
        net::TcpStream::from_inner(sys::net::TcpStream::from_inner((socket, metadata.peer_addr)))
    }
}

/// Metadata for `TcpListener`.
#[derive(Debug, Clone, Default)]
#[unstable(feature = "sgx_platform", issue = "56975")]
pub struct TcpListenerMetadata {
    /// Local address of the TCP listener
    pub local_addr: Option<String>,
}

impl FromRawFd for net::TcpListener {
    type Metadata = TcpListenerMetadata;

    #[inline]
    unsafe fn from_raw_fd(fd: RawFd, metadata: Self::Metadata) -> net::TcpListener {
        let fd = sys::fd::FileDesc::from_inner(fd);
        let socket = sys::net::Socket::from_inner((fd, metadata.local_addr));
        net::TcpListener::from_inner(sys::net::TcpListener::from_inner(socket))
    }
}

impl TryIntoRawFd for net::TcpStream {
    #[inline]
    fn try_into_raw_fd(self) -> Result<RawFd, Self> {
        let (socket, peer_addr) = self.into_inner().into_inner();
        match socket.try_into_inner() {
            Ok(fd) => Ok(fd.into_inner()),
            Err(socket) => {
                let sys = sys::net::TcpStream::from_inner((socket, peer_addr));
                Err(net::TcpStream::from_inner(sys))
            }
        }
    }
}

impl TryIntoRawFd for net::TcpListener {
    #[inline]
    fn try_into_raw_fd(self) -> Result<RawFd, Self> {
        match self.into_inner().into_inner().try_into_inner() {
            Ok(fd) => Ok(fd.into_inner()),
            Err(socket) => {
                let sys = sys::net::TcpListener::from_inner(socket);
                Err(net::TcpListener::from_inner(sys))
            }
        }
    }
}
