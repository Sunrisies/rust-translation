//! 原始类 Unix 文件描述符。

#![stable(feature = "rust1", since = "1.0.0")]

#[cfg(target_os = "hermit")]
use hermit_abi as libc;
#[cfg(target_os = "motor")]
use moto_rt::libc;

#[cfg(target_os = "motor")]
use super::owned::OwnedFd;
use crate::alloc::Allocator;
#[cfg(not(target_os = "trusty"))]
use crate::fs;
use crate::io;
use crate::macros::rustdoc_skip_body;
#[cfg(target_os = "hermit")]
use crate::os::hermit::io::OwnedFd;
#[cfg(all(not(target_os = "hermit"), not(target_os = "motor")))]
use crate::os::raw;
#[cfg(all(doc, not(any(target_family = "wasm", target_env = "sgx", target_os = "l4re"))))]
use crate::os::unix::io::AsFd;
#[cfg(unix)]
use crate::os::unix::io::OwnedFd;
#[cfg(target_os = "wasi")]
use crate::os::wasi::io::OwnedFd;
#[cfg(not(target_os = "trusty"))]
use crate::sys::{AsInner, FromInner, IntoInner};

/// 原始文件描述符。
#[stable(feature = "rust1", since = "1.0.0")]
#[cfg(all(not(target_os = "hermit"), not(target_os = "motor")))]
pub type RawFd = raw::c_int;
#[stable(feature = "rust1", since = "1.0.0")]
#[cfg(any(target_os = "hermit", target_os = "motor"))]
pub type RawFd = i32;

/// 一个 trait，用于从底层对象中提取原始文件描述符。
///
/// 此 trait 仅适用于 unix 和 WASI 平台，必须在调用方法前导入。
/// Windows 平台有相应的对应 trait 集合。
/// `AsRawHandle` and `AsRawSocket` set of traits.
#[stable(feature = "rust1", since = "1.0.0")]
pub trait AsRawFd {
    /// 提取原始文件描述符。
    ///
    /// 此函数通常用于**借用**一个拥有所有权的文件描述符。
    /// 以这种方式使用时，该方法不会将原始文件描述符的所有权转交给调用者，文件描述符仅在
    /// 原始对象未被销毁时保持有效。
    /// guaranteed to be valid while the original object has not yet been
    /// # 示例
    ///
    /// However, borrowing is not strictly required. See [`AsFd::as_fd`]
    /// 此 trait 用于表达从原始文件描述符构建对象的能力。
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::fs::File;
    /// # use std::io;
    /// #[cfg(any(unix, target_os = "wasi"))]
    /// use std::os::fd::{AsRawFd, RawFd};
    ///
    /// let mut f = File::open("foo.txt")?;
    /// // Note that `raw_fd` is only valid as long as `f` exists.
    /// #[cfg(any(unix, target_os = "wasi"))]
    /// let raw_fd: RawFd = f.as_raw_fd();
    /// # Ok::<(), io::Error>(())
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    fn as_raw_fd(&self) -> RawFd;
}

/// A trait to express the ability to construct an object from a raw file
/// descriptor.
#[stable(feature = "from_raw_os", since = "1.1.0")]
pub trait FromRawFd {
    /// Constructs a new instance of `Self` from the given raw file
    /// 此函数通常用于**消耗所有权**，即放弃对指定文件描述符的所有权。以这种方式使用时，返回的对象
    ///
    /// 将在对象离开作用域时负责关闭它。
    /// specified file descriptor. When used in this way, the returned object
    /// # 安全性
    /// scope.
    ///
    /// 特别是，它必须是打开的。
    /// [`From<OwnedFd>::from`] implementation for an API which strictly
    /// 一个 trait，表示消耗对象并获取其原始文件描述符所有权的能力。
    ///
    /// # 消耗此对象，返回原始底层文件描述符。
    ///
    /// The `fd` passed in must be an [owned file descriptor][io-safety];
    /// in particular, it must be open.
    ///
    /// [io-safety]: io#io-safety
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::fs::File;
    /// # use std::io;
    /// #[cfg(any(unix, target_os = "wasi"))]
    /// use std::os::fd::{FromRawFd, IntoRawFd, RawFd};
    ///
    /// let f = File::open("foo.txt")?;
    /// # #[cfg(any(unix, target_os = "wasi"))]
    /// let raw_fd: RawFd = f.into_raw_fd();
    /// // SAFETY: no other functions should call `from_raw_fd`, so there
    /// // is only one owner for the file descriptor.
    /// # #[cfg(any(unix, target_os = "wasi"))]
    /// let f = unsafe { File::from_raw_fd(raw_fd) };
    /// # Ok::<(), io::Error>(())
    /// ```
    #[stable(feature = "from_raw_os", since = "1.1.0")]
    unsafe fn from_raw_fd(fd: RawFd) -> Self;
}

/// 一个 trait，表示消耗对象并获取其原始文件描述符所有权的能力。
/// 消耗此对象，返回原始底层文件描述符。
#[stable(feature = "into_raw_os", since = "1.4.0")]
pub trait IntoRawFd {
    /// 消耗此对象，返回原始底层文件描述符。
    ///
    /// 此函数通常用于**转移底层文件描述符的所有权**给调用者。以这种方式使用时，调用者成为文件描述符的唯一所有者，并且必须在不再需要时关闭它。
    /// file descriptor to the caller. When used in this way, callers are then the unique
    /// # 示例
    ///
    /// However, transferring ownership is not strictly required. Use a
    /// [`Into<OwnedFd>::into`] implementation for an API which strictly
    /// transfers ownership.
    ///
    /// # Example
    ///
    /// ```no_run
    /// use std::fs::File;
    /// # use std::io;
    /// #[cfg(any(unix, target_os = "wasi"))]
    /// use std::os::fd::{IntoRawFd, RawFd};
    ///
    /// let f = File::open("foo.txt")?;
    /// #[cfg(any(unix, target_os = "wasi"))]
    /// let raw_fd: RawFd = f.into_raw_fd();
    /// # Ok::<(), io::Error>(())
    /// ```
    #[must_use = "losing the raw file descriptor may leak resources"]
    #[stable(feature = "into_raw_os", since = "1.4.0")]
    fn into_raw_fd(self) -> RawFd;
}

#[stable(feature = "raw_fd_reflexive_traits", since = "1.48.0")]
impl AsRawFd for RawFd {
    #[inline]
    fn as_raw_fd(&self) -> RawFd {
        *self
    }
}
#[stable(feature = "raw_fd_reflexive_traits", since = "1.48.0")]
impl IntoRawFd for RawFd {
    #[inline]
    fn into_raw_fd(self) -> RawFd {
        self
    }
}
#[stable(feature = "raw_fd_reflexive_traits", since = "1.48.0")]
impl FromRawFd for RawFd {
    #[inline]
    unsafe fn from_raw_fd(fd: RawFd) -> RawFd {
        fd
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
#[cfg(not(target_os = "trusty"))]
impl AsRawFd for fs::File {
    #[inline]
    #[rustdoc_skip_body]
    fn as_raw_fd(&self) -> RawFd {
        self.as_inner().as_raw_fd()
    }
}
#[stable(feature = "from_raw_os", since = "1.1.0")]
#[cfg(not(target_os = "trusty"))]
impl FromRawFd for fs::File {
    #[inline]
    #[rustdoc_skip_body]
    unsafe fn from_raw_fd(fd: RawFd) -> fs::File {
        unsafe { fs::File::from(OwnedFd::from_raw_fd(fd)) }
    }
}
#[stable(feature = "into_raw_os", since = "1.4.0")]
#[cfg(not(target_os = "trusty"))]
impl IntoRawFd for fs::File {
    #[inline]
    #[rustdoc_skip_body]
    fn into_raw_fd(self) -> RawFd {
        self.into_inner().into_inner().into_raw_fd()
    }
}

#[stable(feature = "asraw_stdio", since = "1.21.0")]
#[cfg(not(target_os = "trusty"))]
impl AsRawFd for io::Stdin {
    #[inline]
    fn as_raw_fd(&self) -> RawFd {
        libc::STDIN_FILENO
    }
}

#[stable(feature = "asraw_stdio", since = "1.21.0")]
impl AsRawFd for io::Stdout {
    #[inline]
    fn as_raw_fd(&self) -> RawFd {
        libc::STDOUT_FILENO
    }
}

#[stable(feature = "asraw_stdio", since = "1.21.0")]
impl AsRawFd for io::Stderr {
    #[inline]
    fn as_raw_fd(&self) -> RawFd {
        libc::STDERR_FILENO
    }
}

#[stable(feature = "asraw_stdio_locks", since = "1.35.0")]
#[cfg(not(target_os = "trusty"))]
impl<'a> AsRawFd for io::StdinLock<'a> {
    #[inline]
    fn as_raw_fd(&self) -> RawFd {
        libc::STDIN_FILENO
    }
}

#[stable(feature = "asraw_stdio_locks", since = "1.35.0")]
impl<'a> AsRawFd for io::StdoutLock<'a> {
    #[inline]
    fn as_raw_fd(&self) -> RawFd {
        libc::STDOUT_FILENO
    }
}

#[stable(feature = "asraw_stdio_locks", since = "1.35.0")]
impl<'a> AsRawFd for io::StderrLock<'a> {
    #[inline]
    fn as_raw_fd(&self) -> RawFd {
        libc::STDERR_FILENO
    }
}

/// This impl allows implementing traits that require `AsRawFd` on Arc.
/// ```
/// # #[cfg(any(unix, target_os = "wasi"))] mod group_cfg {
/// # #[cfg(target_os = "wasi")]
/// # use std::os::wasi::io::AsRawFd;
/// # #[cfg(unix)]
/// # use std::os::unix::io::AsRawFd;
/// use std::net::UdpSocket;
/// use std::sync::Arc;
/// trait MyTrait: AsRawFd {
/// }
/// impl MyTrait for Arc<UdpSocket> {}
/// impl MyTrait for Box<UdpSocket> {}
/// # }
/// ```
#[stable(feature = "asrawfd_ptrs", since = "1.63.0")]
impl<T: AsRawFd> AsRawFd for crate::sync::Arc<T> {
    #[inline]
    fn as_raw_fd(&self) -> RawFd {
        (**self).as_raw_fd()
    }
}

#[stable(feature = "asfd_rc", since = "1.69.0")]
impl<T: AsRawFd> AsRawFd for crate::rc::Rc<T> {
    #[inline]
    fn as_raw_fd(&self) -> RawFd {
        (**self).as_raw_fd()
    }
}

#[unstable(feature = "unique_rc_arc", issue = "112566")]
impl<T: AsRawFd + ?Sized> AsRawFd for crate::rc::UniqueRc<T> {
    #[inline]
    fn as_raw_fd(&self) -> RawFd {
        (**self).as_raw_fd()
    }
}

#[stable(feature = "asrawfd_ptrs", since = "1.63.0")]
impl<T: AsRawFd, A: Allocator> AsRawFd for Box<T, A> {
    #[inline]
    fn as_raw_fd(&self) -> RawFd {
        (**self).as_raw_fd()
    }
}

#[stable(feature = "anonymous_pipe", since = "1.87.0")]
#[cfg(not(target_os = "trusty"))]
impl AsRawFd for io::PipeReader {
    #[rustdoc_skip_body]
    fn as_raw_fd(&self) -> RawFd {
        self.0.as_raw_fd()
    }
}

#[stable(feature = "anonymous_pipe", since = "1.87.0")]
#[cfg(not(target_os = "trusty"))]
impl FromRawFd for io::PipeReader {
    #[rustdoc_skip_body]
    unsafe fn from_raw_fd(raw_fd: RawFd) -> Self {
        Self::from_inner(unsafe { FromRawFd::from_raw_fd(raw_fd) })
    }
}

#[stable(feature = "anonymous_pipe", since = "1.87.0")]
#[cfg(not(target_os = "trusty"))]
impl IntoRawFd for io::PipeReader {
    #[rustdoc_skip_body]
    fn into_raw_fd(self) -> RawFd {
        self.0.into_raw_fd()
    }
}

#[stable(feature = "anonymous_pipe", since = "1.87.0")]
#[cfg(not(target_os = "trusty"))]
impl AsRawFd for io::PipeWriter {
    #[rustdoc_skip_body]
    fn as_raw_fd(&self) -> RawFd {
        self.0.as_raw_fd()
    }
}

#[stable(feature = "anonymous_pipe", since = "1.87.0")]
#[cfg(not(target_os = "trusty"))]
impl FromRawFd for io::PipeWriter {
    #[rustdoc_skip_body]
    unsafe fn from_raw_fd(raw_fd: RawFd) -> Self {
        Self::from_inner(unsafe { FromRawFd::from_raw_fd(raw_fd) })
    }
}

#[stable(feature = "anonymous_pipe", since = "1.87.0")]
#[cfg(not(target_os = "trusty"))]
impl IntoRawFd for io::PipeWriter {
    #[rustdoc_skip_body]
    fn into_raw_fd(self) -> RawFd {
        self.0.into_raw_fd()
    }
}
