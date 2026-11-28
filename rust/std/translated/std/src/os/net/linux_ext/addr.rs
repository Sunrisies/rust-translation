//! 与 Linux 和 Android 相关的套接字地址扩展。

use crate::os::unix::net::SocketAddr;

/// Platform-specific extensions to [`SocketAddr`].
#[stable(feature = "unix_socket_abstract", since = "1.70.0")]
pub impl(in crate::os) trait SocketAddrExt {
    /// 在抽象命名空间中创建 Unix 套接字地址。
    ///
    /// 抽象命名空间是 Linux 特有的扩展，允许在不在文件系统中创建条目的情况下绑定 Unix 套接字。
    /// 抽象套接字不受文件系统布局或权限的影响。
    /// 当套接字关闭时，无需进行清理操作。
    /// 抽象套接字地址名称可以包含任何字节，包括零。
    ///
    /// # 错误
    ///
    /// # Errors
    ///
    /// Returns an error if the name is longer than `SUN_LEN - 1`.
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
    /// use std::os::unix::net::{UnixListener, SocketAddr};
    /// #[cfg(target_os = "linux")]
    /// use std::os::linux::net::SocketAddrExt;
    /// #[cfg(target_os = "android")]
    /// use std::os::android::net::SocketAddrExt;
    ///
    /// fn main() -> std::io::Result<()> {
    /// let addr = SocketAddr::from_abstract_name(b"hidden")?;
    /// let listener = match UnixListener::bind_addr(&addr) {
    /// Ok(sock) => sock,
    /// Err(err) => {
    /// println!("无法绑定: {err:?}");
    /// return Err(err);
    ///         }
    ///     };
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "unix_socket_abstract", since = "1.70.0")]
    fn from_abstract_name<N>(name: N) -> crate::io::Result<SocketAddr>
    where
        N: AsRef<[u8]>;

    /// Returns the contents of this address if it is in the abstract namespace.
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
    /// use std::os::unix::net::{UnixListener, SocketAddr};
    /// #[cfg(target_os = "linux")]
    /// use std::os::linux::net::SocketAddrExt;
    /// #[cfg(target_os = "android")]
    /// use std::os::android::net::SocketAddrExt;
    ///
    /// fn main() -> std::io::Result<()> {
    ///     let name = b"hidden";
    ///     let name_addr = SocketAddr::from_abstract_name(name)?;
    ///     let socket = UnixListener::bind_addr(&name_addr)?;
    ///     let local_addr = socket.local_addr().expect("Couldn't get local address");
    ///     assert_eq!(local_addr.as_abstract_name(), Some(&name[..]));
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "unix_socket_abstract", since = "1.70.0")]
    fn as_abstract_name(&self) -> Option<&[u8]>;
}
