use crate::ffi::OsString;

/// 返回系统主机名。
///
/// 在特定平台的错误情况下，此功能可能会出错；
/// 例如，UEFI 和 WASM 平台，在这些平台上主机名并不被支持。
/// supported.
///
/// # 底层系统调用
///
/// | 平台     | 系统调用                                                                                             |
/// |--------------|---------------------------------------------------------------------------------------------------------|
/// | UNIX         | [`gethostname`](https://www.man7.org/linux/man-pages/man2/gethostname.2.html)                           |
/// | Windows (8+) | [`GetHostNameW`](https://learn.microsoft.com/en-us/windows/win32/api/winsock2/nf-winsock2-gethostnamew) |
///
/// 请注意，特定平台的行为[未来可能会发生变化][changes]。
///
/// [changes]: crate::io#platform-specific-behavior
#[unstable(feature = "gethostname", issue = "135142")]
pub fn hostname() -> crate::io::Result<OsString> {
    crate::sys::net::hostname()
}
