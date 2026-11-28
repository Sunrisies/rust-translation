//! 针对通用 I/O 原语的 Windows 特定扩展。

#![stable(feature = "rust1", since = "1.0.0")]

use crate::macros::rustdoc_skip_body;
#[cfg(doc)]
use crate::os::windows::io::{AsHandle, AsSocket};
use crate::os::windows::io::{OwnedHandle, OwnedSocket};
use crate::os::windows::raw;
use crate::sys::{AsInner, FromInner, IntoInner};
use crate::{fs, io, net, ptr, sys};

/// 原始 HANDLE。
#[stable(feature = "rust1", since = "1.0.0")]
pub type RawHandle = raw::HANDLE;

/// 原始 SOCKET。
#[stable(feature = "rust1", since = "1.0.0")]
pub type RawSocket = raw::SOCKET;

/// 提取原始句柄。
#[stable(feature = "rust1", since = "1.0.0")]
pub trait AsRawHandle {
    /// 提取原始句柄。
    ///
    /// 此函数通常用于**借用**一个拥有所有权的句柄。
    /// 以这种方式使用时，该方法不会将原始句柄的**所有权**传递给调用者，且该句柄仅在原始对象未被销毁时仍然有效。
    /// 此句柄仅在原始对象未被销毁时仍然有效。
    /// to be valid while the original object has not yet been destroyed.
    ///
    /// This function may return null, such as when called on [`Stdin`],
    /// [`Stdout`], or [`Stderr`] when the console is detached.
    ///
    /// However, borrowing is not strictly required. See [`AsHandle::as_handle`]
    /// 。
    ///
    /// [`Stdin`]: io::Stdin
    /// [`Stdout`]: io::Stdout
    /// [`Stderr`]: io::Stderr
    #[stable(feature = "rust1", since = "1.0.0")]
    fn as_raw_handle(&self) -> RawHandle;
}

/// 从原始句柄构建 I/O 对象。
#[stable(feature = "from_raw_os", since = "1.1.0")]
pub trait FromRawHandle {
    /// 从指定的原始句柄构建新的 I/O 对象。
    ///
    /// 此函数通常用于**消耗**句柄的**所有权**，
    /// 将关闭句柄的责任交给返回的
    /// 对象。以这种方式使用时，返回的对象
    /// 将在对象超出
    /// 作用域时负责关闭它。
    ///
    /// 然而，消耗所有权并非严格要求。对于严格消耗所有权的 API，请使用
    /// `From<OwnedHandle>::from` implementation for an API which strictly
    /// 。
    ///
    /// # 安全性
    ///
    /// The `handle` passed in must:
    /// - 是一个 [拥有所有权的句柄][io-safety]；特别是，它必须是打开的。
    ///   - be a handle for a resource that may be freed via [`CloseHandle`]
    ///     (as opposed to `RegCloseKey` or other close functions).
    ///
    /// Note that the handle *may* have the value `INVALID_HANDLE_VALUE` (-1),
    /// 这有时是一个有效的句柄值。详情请参阅 [这里]。
    ///
    /// [`CloseHandle`]: https://docs.microsoft.com/en-us/windows/win32/api/handleapi/nf-handleapi-closehandle
    /// [here]: https://devblogs.microsoft.com/oldnewthing/20040302-00/?p=40443
    /// [io-safety]: io#io-safety
    #[stable(feature = "from_raw_os", since = "1.1.0")]
    unsafe fn from_raw_handle(handle: RawHandle) -> Self;
}

/// A trait to express the ability to consume an object and acquire ownership of
/// its raw `HANDLE`.
#[stable(feature = "into_raw_os", since = "1.4.0")]
pub trait IntoRawHandle {
    /// 此函数通常用于**转移**底层句柄的**所有权**给调用者。以这种方式使用时，调用者成为该句柄的唯一
    ///
    /// 所有者，并且必须在不再需要时关闭它。
    /// 然而，转移所有权并非严格要求。对于严格转移所有权的 API，请使用
    /// owners of the handle and must close it once it's no longer needed.
    ///
    /// 。
    /// `Into<OwnedHandle>::into` implementation for an API which strictly
    /// 转移所有权。
    #[must_use = "losing the raw handle may leak resources"]
    #[stable(feature = "into_raw_os", since = "1.4.0")]
    fn into_raw_handle(self) -> RawHandle;
}

#[stable(feature = "rust1", since = "1.0.0")]
impl AsRawHandle for fs::File {
    #[inline]
    #[rustdoc_skip_body]
    fn as_raw_handle(&self) -> RawHandle {
        self.as_inner().as_raw_handle() as RawHandle
    }
}

#[stable(feature = "asraw_stdio", since = "1.21.0")]
impl AsRawHandle for io::Stdin {
    fn as_raw_handle(&self) -> RawHandle {
        stdio_handle(unsafe { sys::c::GetStdHandle(sys::c::STD_INPUT_HANDLE) as RawHandle })
    }
}

#[stable(feature = "asraw_stdio", since = "1.21.0")]
impl AsRawHandle for io::Stdout {
    fn as_raw_handle(&self) -> RawHandle {
        stdio_handle(unsafe { sys::c::GetStdHandle(sys::c::STD_OUTPUT_HANDLE) as RawHandle })
    }
}

#[stable(feature = "asraw_stdio", since = "1.21.0")]
impl AsRawHandle for io::Stderr {
    fn as_raw_handle(&self) -> RawHandle {
        stdio_handle(unsafe { sys::c::GetStdHandle(sys::c::STD_ERROR_HANDLE) as RawHandle })
    }
}

#[stable(feature = "asraw_stdio_locks", since = "1.35.0")]
impl<'a> AsRawHandle for io::StdinLock<'a> {
    fn as_raw_handle(&self) -> RawHandle {
        stdio_handle(unsafe { sys::c::GetStdHandle(sys::c::STD_INPUT_HANDLE) as RawHandle })
    }
}

#[stable(feature = "asraw_stdio_locks", since = "1.35.0")]
impl<'a> AsRawHandle for io::StdoutLock<'a> {
    fn as_raw_handle(&self) -> RawHandle {
        stdio_handle(unsafe { sys::c::GetStdHandle(sys::c::STD_OUTPUT_HANDLE) as RawHandle })
    }
}

#[stable(feature = "asraw_stdio_locks", since = "1.35.0")]
impl<'a> AsRawHandle for io::StderrLock<'a> {
    fn as_raw_handle(&self) -> RawHandle {
        stdio_handle(unsafe { sys::c::GetStdHandle(sys::c::STD_ERROR_HANDLE) as RawHandle })
    }
}

// Translate a handle returned from `GetStdHandle` into a handle to return to
// the user.
pub(super) fn stdio_handle(raw: RawHandle) -> RawHandle {
    // `GetStdHandle` isn't expected to actually fail, so when it returns
    // `INVALID_HANDLE_VALUE`, it means we were launched from a parent which
    // didn't provide us with stdio handles, such as a parent with a detached
    // console. In that case, return null to the user, which is consistent
    // with what they'd get in the parent, and which avoids the problem that
    // `INVALID_HANDLE_VALUE` aliases the current process handle.
    if raw == sys::c::INVALID_HANDLE_VALUE { ptr::null_mut() } else { raw }
}

#[stable(feature = "from_raw_os", since = "1.1.0")]
impl FromRawHandle for fs::File {
    #[inline]
    #[rustdoc_skip_body]
    unsafe fn from_raw_handle(handle: RawHandle) -> fs::File {
        unsafe {
            let handle = handle as sys::c::HANDLE;
            fs::File::from_inner(sys::fs::File::from_inner(FromInner::from_inner(
                OwnedHandle::from_raw_handle(handle),
            )))
        }
    }
}

#[stable(feature = "into_raw_os", since = "1.4.0")]
impl IntoRawHandle for fs::File {
    #[inline]
    #[rustdoc_skip_body]
    fn into_raw_handle(self) -> RawHandle {
        self.into_inner().into_raw_handle() as *mut _
    }
}

/// 提取原始 SOCKET。
#[stable(feature = "rust1", since = "1.0.0")]
pub trait AsRawSocket {
    /// 提取原始 SOCKET。
    ///
    /// 此函数通常用于**借用**一个拥有所有权的 SOCKET。
    /// 以这种方式使用时，该方法不会将原始 SOCKET 的**所有权**传递给调用者，且该 SOCKET 仅在原始对象未被销毁时仍然有效。
    /// raw socket to the caller, and the socket is only guaranteed
    /// to be valid while the original object has not yet been destroyed.
    ///
    /// However, borrowing is not strictly required. See [`AsSocket::as_socket`]
    /// 用于那些严格借用套接字的 API。
    #[stable(feature = "rust1", since = "1.0.0")]
    fn as_raw_socket(&self) -> RawSocket;
}

/// 从原始套接字创建 I/O 对象。
#[stable(feature = "from_raw_os", since = "1.1.0")]
pub trait FromRawSocket {
    /// 根据指定的原始套接字构建新的 I/O 对象。
    ///
    /// 此函数通常用于**消耗套接字的所有权**，
    /// 将关闭套接字的责任交给返回的对象。当以这种方式使用时，返回的对象
    /// 将在该对象离开作用域时负责关闭它。
    /// 然而，消耗所有权并非严格必需。对于那些严格消耗所有权的 API，请使用
    /// scope.
    ///
    /// # 安全性
    /// `From<OwnedSocket>::from` implementation for an API which strictly
    /// - 是 [拥有权的套接字][io-safety]；特别是，它必须是打开的。
    ///
    /// # Safety
    ///
    /// The `socket` passed in must:
    /// - 能够消耗此对象，并返回原始的底层套接字。
    ///   - be a socket that may be freed via [`closesocket`].
    ///
    /// [`closesocket`]: https://docs.microsoft.com/en-us/windows/win32/api/winsock2/nf-winsock2-closesocket
    /// [io-safety]: io#io-safety
    #[stable(feature = "from_raw_os", since = "1.1.0")]
    unsafe fn from_raw_socket(sock: RawSocket) -> Self;
}

/// 然而，转移所有权并非严格必需。对于那些严格转移所有权的 API，请使用
/// its raw `SOCKET`.
#[stable(feature = "into_raw_os", since = "1.4.0")]
pub trait IntoRawSocket {
    /// Consumes this object, returning the raw underlying socket.
    ///
    /// This function is typically used to **transfer ownership** of the underlying
    /// socket to the caller. When used in this way, callers are then the unique
    /// owners of the socket and must close it once it's no longer needed.
    ///
    /// However, transferring ownership is not strictly required. Use a
    /// `Into<OwnedSocket>::into` implementation for an API which strictly
    /// transfers ownership.
    #[must_use = "losing the raw socket may leak resources"]
    #[stable(feature = "into_raw_os", since = "1.4.0")]
    fn into_raw_socket(self) -> RawSocket;
}

#[stable(feature = "rust1", since = "1.0.0")]
impl AsRawSocket for net::TcpStream {
    #[inline]
    #[rustdoc_skip_body]
    fn as_raw_socket(&self) -> RawSocket {
        self.as_inner().socket().as_raw_socket()
    }
}
#[stable(feature = "rust1", since = "1.0.0")]
impl AsRawSocket for net::TcpListener {
    #[inline]
    #[rustdoc_skip_body]
    fn as_raw_socket(&self) -> RawSocket {
        self.as_inner().socket().as_raw_socket()
    }
}
#[stable(feature = "rust1", since = "1.0.0")]
impl AsRawSocket for net::UdpSocket {
    #[inline]
    #[rustdoc_skip_body]
    fn as_raw_socket(&self) -> RawSocket {
        self.as_inner().socket().as_raw_socket()
    }
}

#[stable(feature = "from_raw_os", since = "1.1.0")]
impl FromRawSocket for net::TcpStream {
    #[inline]
    #[rustdoc_skip_body]
    unsafe fn from_raw_socket(sock: RawSocket) -> net::TcpStream {
        unsafe {
            let sock = sys::net::Socket::from_inner(OwnedSocket::from_raw_socket(sock));
            net::TcpStream::from_inner(sys::net::TcpStream::from_inner(sock))
        }
    }
}
#[stable(feature = "from_raw_os", since = "1.1.0")]
impl FromRawSocket for net::TcpListener {
    #[inline]
    #[rustdoc_skip_body]
    unsafe fn from_raw_socket(sock: RawSocket) -> net::TcpListener {
        unsafe {
            let sock = sys::net::Socket::from_inner(OwnedSocket::from_raw_socket(sock));
            net::TcpListener::from_inner(sys::net::TcpListener::from_inner(sock))
        }
    }
}
#[stable(feature = "from_raw_os", since = "1.1.0")]
impl FromRawSocket for net::UdpSocket {
    #[inline]
    #[rustdoc_skip_body]
    unsafe fn from_raw_socket(sock: RawSocket) -> net::UdpSocket {
        unsafe {
            let sock = sys::net::Socket::from_inner(OwnedSocket::from_raw_socket(sock));
            net::UdpSocket::from_inner(sys::net::UdpSocket::from_inner(sock))
        }
    }
}

#[stable(feature = "into_raw_os", since = "1.4.0")]
impl IntoRawSocket for net::TcpStream {
    #[inline]
    #[rustdoc_skip_body]
    fn into_raw_socket(self) -> RawSocket {
        self.into_inner().into_socket().into_inner().into_raw_socket()
    }
}

#[stable(feature = "into_raw_os", since = "1.4.0")]
impl IntoRawSocket for net::TcpListener {
    #[inline]
    #[rustdoc_skip_body]
    fn into_raw_socket(self) -> RawSocket {
        self.into_inner().into_socket().into_inner().into_raw_socket()
    }
}

#[stable(feature = "into_raw_os", since = "1.4.0")]
impl IntoRawSocket for net::UdpSocket {
    #[inline]
    #[rustdoc_skip_body]
    fn into_raw_socket(self) -> RawSocket {
        self.into_inner().into_socket().into_inner().into_raw_socket()
    }
}

#[stable(feature = "anonymous_pipe", since = "1.87.0")]
impl AsRawHandle for io::PipeReader {
    #[rustdoc_skip_body]
    fn as_raw_handle(&self) -> RawHandle {
        self.0.as_raw_handle()
    }
}

#[stable(feature = "anonymous_pipe", since = "1.87.0")]
impl FromRawHandle for io::PipeReader {
    #[rustdoc_skip_body]
    unsafe fn from_raw_handle(raw_handle: RawHandle) -> Self {
        unsafe { Self::from_inner(FromRawHandle::from_raw_handle(raw_handle)) }
    }
}

#[stable(feature = "anonymous_pipe", since = "1.87.0")]
impl IntoRawHandle for io::PipeReader {
    #[rustdoc_skip_body]
    fn into_raw_handle(self) -> RawHandle {
        self.0.into_raw_handle()
    }
}

#[stable(feature = "anonymous_pipe", since = "1.87.0")]
impl AsRawHandle for io::PipeWriter {
    #[rustdoc_skip_body]
    fn as_raw_handle(&self) -> RawHandle {
        self.0.as_raw_handle()
    }
}

#[stable(feature = "anonymous_pipe", since = "1.87.0")]
impl FromRawHandle for io::PipeWriter {
    #[rustdoc_skip_body]
    unsafe fn from_raw_handle(raw_handle: RawHandle) -> Self {
        unsafe { Self::from_inner(FromRawHandle::from_raw_handle(raw_handle)) }
    }
}

#[stable(feature = "anonymous_pipe", since = "1.87.0")]
impl IntoRawHandle for io::PipeWriter {
    #[rustdoc_skip_body]
    fn into_raw_handle(self) -> RawHandle {
        self.0.into_raw_handle()
    }
}
