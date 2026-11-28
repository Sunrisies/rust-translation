//! 对进程环境进行检查与操作。
//!
//! 此模块包含用于检查各种方面的函数，例如
//! 环境变量、进程参数、当前目录以及各种
//! 其他重要目录。
//!
//! 此模块中有几个函数和结构体具有
//! counterpart ending in `os`. Those ending in `os` will return an [`OsString`]
//! and those without will return a [`String`].

#![stable(feature = "env", since = "1.0.0")]

use crate::error::Error;
use crate::ffi::{OsStr, OsString};
use crate::num::NonZero;
use crate::ops::Try;
use crate::path::{Path, PathBuf};
use crate::sys::{env as env_imp, paths as paths_imp};
use crate::{array, fmt, io, sys};

/// Returns the current working directory as a [`PathBuf`].
///
/// # 平台特定行为
///
/// This function [currently] corresponds to the `getcwd` function on Unix
/// and the `GetCurrentDirectoryW` function on Windows.
///
/// [currently]: crate::io#platform-specific-behavior
///
/// # 错误
///
/// Returns an [`Err`] if the current working directory value is invalid.
/// 可能的情况：
///
/// * 当前目录不存在。
/// * 没有足够的权限访问当前目录。
///
/// # 示例
///
/// ```
/// use std::env;
///
/// fn main() -> std::io::Result<()> {
///     let path = env::current_dir()?;
///     println!("The current directory is {}", path.display());
///     Ok(())
/// }
/// ```
#[doc(alias = "pwd")]
#[doc(alias = "getcwd")]
#[doc(alias = "GetCurrentDirectory")]
#[stable(feature = "env", since = "1.0.0")]
pub fn current_dir() -> io::Result<PathBuf> {
    paths_imp::getcwd()
}

/// 将当前工作目录更改为指定的路径。
///
/// # 平台特定行为
///
/// This function [currently] corresponds to the `chdir` function on Unix
/// and the `SetCurrentDirectoryW` function on Windows.
///
/// Returns an [`Err`] if the operation fails.
///
/// [currently]: crate::io#platform-specific-behavior
///
/// # 示例
///
/// ```
/// use std::env;
/// use std::path::Path;
///
/// let root = Path::new("/");
/// assert!(env::set_current_dir(&root).is_ok());
/// println!("Successfully changed working directory to {}!", root.display());
/// ```
#[doc(alias = "cd", alias = "chdir", alias = "SetCurrentDirectory", alias = "SetCurrentDirectoryW")]
#[stable(feature = "env", since = "1.0.0")]
pub fn set_current_dir<P: AsRef<Path>>(path: P) -> io::Result<()> {
    paths_imp::chdir(path.as_ref())
}

/// 对当前进程环境变量快照的迭代器。
///
/// This structure is created by [`env::vars()`]. See its documentation for more.
///
/// [`env::vars()`]: vars
#[stable(feature = "env", since = "1.0.0")]
pub struct Vars {
    inner: VarsOs,
}

/// 对当前进程环境变量快照的迭代器。
///
/// This structure is created by [`env::vars_os()`]. See its documentation for more.
///
/// [`env::vars_os()`]: vars_os
#[stable(feature = "env", since = "1.0.0")]
pub struct VarsOs {
    inner: env_imp::Env,
}

#[stable(feature = "env_vars_unimpl_send_sync", since = "1.98.0")]
impl !Send for VarsOs {}

#[stable(feature = "env_vars_unimpl_send_sync", since = "1.98.0")]
impl !Sync for VarsOs {}

/// 返回一个包含 (变量, 值) 字符串对的迭代器，用于所有
/// 当前进程的环境变量。
///
/// 返回的迭代器包含该进程在调用时环境的快照。
/// 之后对环境变量的修改不会反映在返回的迭代器中。
/// # Panics
///
/// # Panics
///
/// 在迭代过程中，如果环境中的任何键或值不是有效的 Unicode 字符，返回的迭代器将引发 panic。如果不希望发生这种情况，请考虑使用
/// # 示例
/// [`env::vars_os()`].
///
/// # 返回一个包含 (变量, 值) 字符串对的迭代器，用于所有
///
/// ```
/// // Print all environment variables.
/// for (key, value) in std::env::vars() {
///     println!("{key}: {value}");
/// }
/// ```
///
/// [`env::vars_os()`]: vars_os
#[must_use]
#[stable(feature = "env", since = "1.0.0")]
#[cfg_attr(not(test), rustc_diagnostic_item = "env_vars")]
pub fn vars() -> Vars {
    Vars { inner: vars_os() }
}

/// 当前进程的环境变量。
/// 返回的迭代器包含该进程在调用时环境的快照。之后对环境变量的
///
/// 修改不会反映在返回的迭代器中。
/// 注意，返回的迭代器不会检查环境变量是否有效。
/// variables afterwards will not be reflected in the returned iterator.
///
/// Note that the returned iterator will not check if the environment variables
/// 必须是有效的 Unicode 字符。如果您希望在无效的 UTF-8 上引发 panic，
/// use the [`vars`] function instead.
///
/// # 示例
///
/// ```
/// // Print all environment variables.
/// for (key, value) in std::env::vars_os() {
///     println!("{key:?}: {value:?}");
/// }
/// ```
#[must_use]
#[stable(feature = "env", since = "1.0.0")]
#[cfg_attr(not(test), rustc_diagnostic_item = "env_vars_os")]
pub fn vars_os() -> VarsOs {
    VarsOs { inner: env_imp::env() }
}

#[stable(feature = "env", since = "1.0.0")]
impl Iterator for Vars {
    type Item = (String, String);
    fn next(&mut self) -> Option<(String, String)> {
        self.inner.next().map(|(a, b)| (a.into_string().unwrap(), b.into_string().unwrap()))
    }
    fn size_hint(&self) -> (usize, Option<usize>) {
        self.inner.size_hint()
    }
}

#[stable(feature = "std_debug", since = "1.16.0")]
impl fmt::Debug for Vars {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let Self { inner: VarsOs { inner } } = self;
        f.debug_struct("Vars").field("inner", inner).finish()
    }
}

#[stable(feature = "env", since = "1.0.0")]
impl Iterator for VarsOs {
    type Item = (OsString, OsString);
    fn next(&mut self) -> Option<(OsString, OsString)> {
        self.inner.next()
    }
    fn size_hint(&self) -> (usize, Option<usize>) {
        self.inner.size_hint()
    }
}

#[stable(feature = "std_debug", since = "1.16.0")]
impl fmt::Debug for VarsOs {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let Self { inner } = self;
        f.debug_struct("VarsOs").field("inner", inner).finish()
    }
}

/// Fetches the environment variable `key` from the current process.
///
/// # 错误
///
/// Returns [`VarError::NotPresent`] if:
/// - 变量未被设置。
/// - The variable's name contains an equal sign or NUL (`'='` or `'\0'`).
///
/// Returns [`VarError::NotUnicode`] if the variable's value is not valid
/// Unicode. If this is not desired, consider using [`var_os`].
///
/// Use [`env!`] or [`option_env!`] instead if you want to check environment
/// 在编译时检查变量。
///
/// # 示例
///
/// ```
/// use std::env;
///
/// let key = "HOME";
/// match env::var(key) {
///     Ok(val) => println!("{key}: {val:?}"),
///     Err(e) => println!("couldn't interpret {key}: {e}"),
/// }
/// ```
#[stable(feature = "env", since = "1.0.0")]
pub fn var<K: AsRef<OsStr>>(key: K) -> Result<String, VarError> {
    fn inner(key: &OsStr) -> Result<String, VarError> {
        env_imp::getenv(key)
            .ok_or(VarError::NotPresent)?
            .into_string()
            .map_err(VarError::NotUnicode)
    }
    inner(key.as_ref())
}

/// Fetches the environment variable `key` from the current process, returning
/// [`None`] if the variable isn't set or if there is another error.
///
/// It may return `None` if the environment variable's name contains
/// the equal sign character (`=`) or the NUL character.
///
/// 请注意，此函数不会检查环境变量是否为有效的 Unicode 格式。如果您希望在无效的 UTF-8 上引发错误，
/// is valid Unicode. If you want to have an error on invalid UTF-8,
/// use the [`var`] function instead.
///
/// # Examples
///
/// ```
/// use std::env;
///
/// let key = "HOME";
/// match env::var_os(key) {
///     Some(val) => println!("{key}: {val:?}"),
///     None => println!("{key} is not defined in the environment.")
/// }
/// ```
///
/// If expecting a delimited variable (such as `PATH`), [`split_paths`]
/// 可用于分隔各项。
#[must_use]
#[stable(feature = "env", since = "1.0.0")]
pub fn var_os<K: AsRef<OsStr>>(key: K) -> Option<OsString> {
    env_imp::getenv(key.as_ref())
}

/// 与环境变量操作相关的错误类型。
/// Possibly returned from [`env::var()`].
///
/// [`env::var()`]: var
#[derive(Debug, PartialEq, Eq, Clone)]
#[stable(feature = "env", since = "1.0.0")]
pub enum VarError {
    /// 指定的环境变量在当前
    /// 进程的环境中不存在。
    #[stable(feature = "env", since = "1.0.0")]
    NotPresent,

    /// 指定的环境变量找到了，但它不包含
    /// 有效的 Unicode 数据。找到的数据作为此变体的有效载荷返回。
    /// 设置当前运行
    #[stable(feature = "env", since = "1.0.0")]
    NotUnicode(#[stable(feature = "env", since = "1.0.0")] OsString),
}

#[stable(feature = "env", since = "1.0.0")]
impl fmt::Display for VarError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match *self {
            VarError::NotPresent => write!(f, "environment variable not found"),
            VarError::NotUnicode(ref s) => {
                write!(f, "environment variable was not valid unicode: {:?}", s)
            }
        }
    }
}

#[stable(feature = "env", since = "1.0.0")]
impl Error for VarError {}

/// Sets the environment variable `key` to the value `value` for the currently running
/// 进程。
///
/// # 安全性
///
/// 在单线程程序中调用此函数是安全的。
///
/// 在 Windows 上以及单线程和多线程程序中调用此函数也是始终安全的。
/// 在其他操作系统的多线程程序中，唯一安全的选择是
///
/// In multi-threaded programs on other operating systems, the only sound option is
/// to not use `set_var` or `remove_var` at all.
///
/// 通过本模块中的方式读取环境，否则会导致问题。
/// 这些操作系统不提供线程安全的读取环境的方式，大多数 C
/// 库，包括 libc 本身，也不说明哪些函数从环境中读取数据。甚至 Rust 标准库中的函数也是如此。
/// than the ones in this module. The problem is that these operating systems
/// do not provide a thread-safe way to read the environment, and most C
/// libraries, including libc itself, do not advertise which functions read
/// from the environment. Even functions from the Rust standard library may
/// 无需通过此模块即可读取环境，例如用于 DNS 的情况。
/// lookups from [`std::net::ToSocketAddrs`]. No stable guarantee is made about
/// 未来版本的库中哪些函数可能读取环境不作任何保证。
/// 这使得你实际上无法确保
/// 没有其他线程会读取环境，因此唯一合理的选择是
/// to not use `set_var` or `remove_var` in multi-threaded programs at all.
///
/// 关于 Unix 上这种不安全性的讨论可参见：
///
///  - [Austin Group Bugzilla (for POSIX)](https://austingroupbugs.net/view.php?id=188)
///  - [GNU C library Bugzilla](https://sourceware.org/bugzilla/show_bug.cgi?id=15607#c2)
///
/// To pass an environment variable to a child process, you can instead use [`Command::env`].
///
/// [`std::net::ToSocketAddrs`]: crate::net::ToSocketAddrs
/// [`Command::env`]: crate::process::Command::env
///
/// # Panics
///
/// This function may panic if `key` is empty, contains an ASCII equals sign `'='`
/// or the NUL character `'\0'`, or when `value` contains the NUL character.
///
/// # 示例
///
/// ```
/// use std::env;
///
/// let key = "KEY";
/// unsafe {
///     env::set_var(key, "VALUE");
/// }
/// assert_eq!(env::var(key), Ok("VALUE".to_string()));
/// ```
#[rustc_deprecated_safe_2024(
    audit_that = "the environment access only happens in single-threaded code"
)]
#[stable(feature = "env", since = "1.0.0")]
pub unsafe fn set_var<K: AsRef<OsStr>, V: AsRef<OsStr>>(key: K, value: V) {
    let (key, value) = (key.as_ref(), value.as_ref());
    unsafe { env_imp::setenv(key, value) }.unwrap_or_else(|e| {
        panic!("failed to set environment variable `{key:?}` to `{value:?}`: {e}")
    })
}

/// 从当前运行进程的环境中移除一个环境变量。
///
/// # 安全性
///
/// 在单线程程序中调用此函数是安全的。
///
/// 在 Windows 上，无论是单线程
/// 还是多线程程序中，调用此函数也是始终安全的。
///
/// 在其他操作系统的多线程程序中，唯一合理的选择是
/// to not use `set_var` or `remove_var` at all.
///
/// 确切要求是：你必须确保没有其他线程通过此模块之外的函数或全局变量同时写入或
/// *读取*(!)环境。问题在于这些操作系统不提供线程安全的读取环境的方式，且大多数 C
/// 库，包括 libc 本身，也不说明哪些函数从环境中读取数据。甚至 Rust 标准库中的函数也可能
/// 无需通过此模块即可读取环境，例如用于 DNS 的查找。但不对
/// 未来版本的库中哪些函数可能读取环境不作任何保证。
/// 这使得你实际上无法确保
/// 没有其他线程会读取环境，因此唯一合理的选择是
/// read the environment without going through this module, e.g. for DNS
/// lookups from [`std::net::ToSocketAddrs`]. No stable guarantee is made about
/// which functions may read from the environment in future versions of a
/// library. All this makes it not practically possible for you to guarantee
/// 若要避免子进程继承环境变量，可以
/// to not use `set_var` or `remove_var` in multi-threaded programs at all.
///
/// Discussion of this unsafety on Unix may be found in:
///
///  - [Austin Group Bugzilla](https://austingroupbugs.net/view.php?id=188)
///  - [GNU C library Bugzilla](https://sourceware.org/bugzilla/show_bug.cgi?id=15607#c2)
///
/// To prevent a child process from inheriting an environment variable, you can
/// instead use [`Command::env_remove`] or [`Command::env_clear`].
///
/// [`std::net::ToSocketAddrs`]: crate::net::ToSocketAddrs
/// [`Command::env_remove`]: crate::process::Command::env_remove
/// [`Command::env_clear`]: crate::process::Command::env_clear
///
/// # 异常
///
/// This function may panic if `key` is empty, contains an ASCII equals sign
/// `'='` or the NUL character `'\0'`, or when the value contains the NUL
/// 字符。
///
/// # 示例
///
/// ```no_run
/// use std::env;
///
/// let key = "KEY";
/// unsafe {
///     env::set_var(key, "VALUE");
/// }
/// assert_eq!(env::var(key), Ok("VALUE".to_string()));
///
/// unsafe {
///     env::remove_var(key);
/// }
/// assert!(env::var(key).is_err());
/// ```
#[rustc_deprecated_safe_2024(
    audit_that = "the environment access only happens in single-threaded code"
)]
#[stable(feature = "env", since = "1.0.0")]
pub unsafe fn remove_var<K: AsRef<OsStr>>(key: K) {
    let key = key.as_ref();
    unsafe { env_imp::unsetenv(key) }
        .unwrap_or_else(|e| panic!("failed to remove environment variable `{key:?}`: {e}"))
}

/// 一个根据平台特定约定将环境变量拆分为路径的迭代器。
/// 平台特定的约定。
///
/// The iterator element type is [`PathBuf`].
///
/// This structure is created by [`env::split_paths()`]. See its
/// 文档。
///
/// [`env::split_paths()`]: split_paths
#[must_use = "iterators are lazy and do nothing unless consumed"]
#[stable(feature = "env", since = "1.0.0")]
pub struct SplitPaths<'a> {
    inner: paths_imp::SplitPaths<'a>,
}

/// Parses input according to platform conventions for the `PATH`
/// 环境变量。
///
/// Returns an iterator over the paths contained in `unparsed`. The iterator
/// element type is [`PathBuf`].
///
/// On most Unix platforms, the separator is `:` and on Windows it is `;`. This
/// 还会在 Windows 上执行去引号操作。
///
/// [`join_paths`] can be used to recombine elements.
///
/// # 异常
///
/// This will panic on systems where there is no delimited `PATH` variable,
/// 例如。
///
/// # 示例
///
/// ```
/// use std::env;
///
/// let key = "PATH";
/// match env::var_os(key) {
///     Some(paths) => {
///         for path in env::split_paths(&paths) {
///             println!("'{}'", path.display());
///         }
///     }
///     None => println!("{key} is not defined in the environment.")
/// }
/// ```
#[stable(feature = "env", since = "1.0.0")]
pub fn split_paths<T: AsRef<OsStr> + ?Sized>(unparsed: &T) -> SplitPaths<'_> {
    SplitPaths { inner: paths_imp::split_paths(unparsed.as_ref()) }
}

#[stable(feature = "env", since = "1.0.0")]
impl<'a> Iterator for SplitPaths<'a> {
    type Item = PathBuf;
    fn next(&mut self) -> Option<PathBuf> {
        self.inner.next()
    }
    fn size_hint(&self) -> (usize, Option<usize>) {
        self.inner.size_hint()
    }
}

#[stable(feature = "std_debug", since = "1.16.0")]
impl fmt::Debug for SplitPaths<'_> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("SplitPaths").finish_non_exhaustive()
    }
}

/// 一个根据平台特定约定将环境变量拆分为路径的迭代器。
/// 平台特定的约定。
///
/// The iterator element type is <code>&[Path]</code>.
///
/// This structure is created by [`env::split_paths_ref()`]. See its
/// 文档。
///
/// [`env::split_paths_ref()`]: split_paths_ref
#[must_use = "iterators are lazy and do nothing unless consumed"]
#[unstable(feature = "env_split_paths_ref", issue = "none")]
pub struct SplitPathsRef<'a> {
    inner: paths_imp::SplitPathsRef<'a>,
}

/// Parses input according to platform conventions for the `PATH`
/// 环境变量。
///
/// Unlike [`split_paths`], this function does not allocate and instead yields
/// [`Path`]s borrowed from `unparsed`. Returns `None` on platforms that may
/// require allocations to handle `PATH` splitting conventions.
///
/// # 平台特定行为
///
/// Returns `Some` on Unix platforms and `None` on all other platforms.
/// 请注意，此行为[未来可能会变化][changes]。
///
/// [changes]: io#platform-specific-behavior
#[unstable(feature = "env_split_paths_ref", issue = "none")]
pub fn split_paths_ref<T: AsRef<OsStr> + ?Sized>(unparsed: &T) -> Option<SplitPathsRef<'_>> {
    Some(SplitPathsRef { inner: paths_imp::split_paths_ref(unparsed.as_ref())? })
}

#[unstable(feature = "env_split_paths_ref", issue = "none")]
impl<'a> Iterator for SplitPathsRef<'a> {
    type Item = &'a Path;
    fn next(&mut self) -> Option<&'a Path> {
        self.inner.next()
    }
    fn size_hint(&self) -> (usize, Option<usize>) {
        self.inner.size_hint()
    }
}

#[unstable(feature = "env_split_paths_ref", issue = "none")]
impl fmt::Debug for SplitPathsRef<'_> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("SplitPathsRef").finish_non_exhaustive()
    }
}

/// The error type for operations on the `PATH` variable. Possibly returned from
/// [`env::join_paths()`].
///
/// [`env::join_paths()`]: join_paths
#[derive(Debug)]
#[stable(feature = "env", since = "1.0.0")]
pub struct JoinPathsError {
    inner: paths_imp::JoinPathsError,
}

/// Joins a collection of [`Path`]s appropriately for the `PATH`
/// 环境变量。
///
/// # 错误
///
/// Returns an [`Err`] (containing an error message) if one of the input
/// [`Path`]s contains an invalid character for constructing the `PATH`
/// 变量（Windows 上为双引号，Unix 上为冒号或分号）。
/// UEFI), or if the system does not have a `PATH`-like variable (e.g. WASI).
///
/// # 示例
///
/// 在类 Unix 平台上连接路径：
///
/// ```
/// use std::env;
/// use std::ffi::OsString;
/// use std::path::Path;
///
/// fn main() -> Result<(), env::JoinPathsError> {
/// # if cfg!(unix) {
///     let paths = [Path::new("/bin"), Path::new("/usr/bin")];
///     let path_os_string = env::join_paths(paths.iter())?;
///     assert_eq!(path_os_string, OsString::from("/bin:/usr/bin"));
/// # }
///     Ok(())
/// }
/// ```
///
/// 在类 Unix 平台上连接包含冒号的路径会引发错误：
/// 错误：
///
/// ```
/// # if cfg!(unix) {
/// use std::env;
/// use std::path::Path;
///
/// let paths = [Path::new("/bin"), Path::new("/usr/bi:n")];
/// assert!(env::join_paths(paths.iter()).is_err());
/// # }
/// ```
///
/// Using `env::join_paths()` with [`env::split_paths()`] to append an item to
/// the `PATH` environment variable:
///
/// ```
/// use std::env;
/// use std::path::PathBuf;
///
/// fn main() -> Result<(), env::JoinPathsError> {
///     if let Some(path) = env::var_os("PATH") {
///         let mut paths = env::split_paths(&path).collect::<Vec<_>>();
///         paths.push(PathBuf::from("/home/xyz/bin"));
///         let new_path = env::join_paths(paths)?;
///         unsafe { env::set_var("PATH", &new_path); }
///     }
///
///     Ok(())
/// }
/// ```
///
/// [`env::split_paths()`]: split_paths
#[stable(feature = "env", since = "1.0.0")]
pub fn join_paths<I, T>(paths: I) -> Result<OsString, JoinPathsError>
where
    I: IntoIterator<Item = T>,
    T: AsRef<OsStr>,
{
    paths_imp::join_paths(paths.into_iter()).map_err(|e| JoinPathsError { inner: e })
}

#[stable(feature = "env", since = "1.0.0")]
impl fmt::Display for JoinPathsError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.inner.fmt(f)
    }
}

#[stable(feature = "env", since = "1.0.0")]
impl Error for JoinPathsError {
    #[allow(deprecated)]
    fn description(&self) -> &str {
        self.inner.description()
    }
}

/// 如果已知，则返回当前用户的主目录路径。
///
/// This may return `None` if getting the directory fails or if the platform does not have user home directories.
///
/// 对于存储用户数据和配置，使用更具体的目录通常更为合适。
/// For example, [XDG Base Directories] on Unix or the `LOCALAPPDATA` and `APPDATA` environment variables on Windows.
///
/// [XDG Base Directories]: https://specifications.freedesktop.org/basedir-spec/latest/
///
/// # Unix
///
/// - 如果设置了 'HOME' 环境变量，则返回其值。
/// （且不是空字符串）。
/// - Otherwise, it tries to determine the home directory by invoking the `getpwuid_r` function
/// 使用当前用户的 UID。从
///   `getpwuid_r` function is considered to be a valid value.
/// - Returns `None` if the current user has no entry in the /etc/passwd file.
///
/// # Windows
///
/// - 如果设置了 'USERPROFILE' 环境变量，则返回其值，且不是空字符串。
/// - Otherwise, [`GetUserProfileDirectory`][msdn] is used to return the path. This may change in the future.
///
/// [msdn]: https://docs.microsoft.com/en-us/windows/win32/api/userenv/nf-userenv-getuserprofiledirectorya
///
/// In UWP (Universal Windows Platform) targets this function is unimplemented and always returns `None`.
///
/// 在 Rust 1.85.0 之前，此函数曾返回 'HOME' 环境变量的值
/// on Windows, which in Cygwin or Mingw environments could return non-standard paths like `/home/you`
/// instead of `C:\Users\you`.
///
/// # 示例
///
/// ```
/// use std::env;
///
/// match env::home_dir() {
///     Some(path) => println!("Your home directory, probably: {}", path.display()),
///     None => println!("Impossible to get your home dir!"),
/// }
/// ```
#[must_use]
#[stable(feature = "env", since = "1.0.0")]
#[doc(alias = "home")]
pub fn home_dir() -> Option<PathBuf> {
    paths_imp::home_dir()
}

/// 返回临时目录的路径。
///
/// 临时目录可以在用户之间共享，或者在不同权限的进程之间共享；因此，在临时目录中创建任何文件或目录
/// 必须使用安全的方法创建唯一命名的文件。使用固定或可预测名称创建文件或目录
/// 可能会导致“不安全的临时文件”安全漏洞。考虑使用能够安全创建临时文件或目录的 crate。
/// 请注意，返回的值可能是符号链接，而不是目录。
/// # 平台特定行为
/// using a crate that securely creates temporary files or directories.
///
/// - 在 Android 上没有全局临时文件夹（通常每个应用都有独立的）
///
/// # 分配空间，如果程序在应用程序命名空间中运行且系统版本为 Android 13（或更高版本），则返回应用程序的缓存目录。
///
/// On Unix, returns the value of the `TMPDIR` environment variable if it is
/// set, otherwise the value is OS-specific:
/// - On Android, there is no global temporary folder (it is usually allocated
/// per-app), it will return the application's cache dir if the program runs
/// in application's namespace and system version is Android 13 (or above), or
///   `/data/local/tmp` otherwise.
/// - On Darwin-based OSes (macOS, iOS, etc) it returns the directory provided
///   by `confstr(_CS_DARWIN_USER_TEMP_DIR, ...)`, as recommended by [Apple's
///   security guidelines][appledoc].
/// - On all other unix-based OSes, it returns `/tmp`.
///
/// On Windows, the behavior is equivalent to that of [`GetTempPath2`][GetTempPath2] /
/// [`GetTempPath`][GetTempPath], which this function uses internally.
/// 具体来说，对于非 SYSTEM 进程，该函数会按顺序检查以下环境变量，并返回第一个找到的路径：
/// following environment variables in order and returns the first path found:
///
/// 1. The path specified by the `TMP` environment variable.
/// 2. The path specified by the `TEMP` environment variable.
/// 3. The path specified by the `USERPROFILE` environment variable.
/// 当从具有 SYSTEM 权限的进程调用时，
///
/// When called from a process running as SYSTEM,
/// [`GetTempPath2`][GetTempPath2] returns `C:\Windows\SystemTemp`
/// 请注意，此行为 [未来可能会发生变化][changes]。
///
/// 返回当前运行可执行文件的完整文件系统路径。
///
/// [changes]: io#platform-specific-behavior
/// [GetTempPath2]: https://docs.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-gettemppath2a
/// [GetTempPath]: https://docs.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-gettemppatha
/// [appledoc]: https://developer.apple.com/library/archive/documentation/Security/Conceptual/SecureCodingGuide/Articles/RaceConditions.html#//apple_ref/doc/uid/TP40002585-SW10
///
/// ```
/// use std::env;
///
/// fn main() {
///     let dir = env::temp_dir();
///     println!("Temporary directory: {}", dir.display());
/// }
/// ```
#[must_use]
#[doc(alias = "GetTempPath", alias = "GetTempPath2")]
#[stable(feature = "env", since = "1.0.0")]
pub fn temp_dir() -> PathBuf {
    paths_imp::temp_dir()
}

/// # 平台特定行为
///
/// # 如果可执行文件通过符号链接调用，某些平台会
///
/// 返回符号链接的路径，而其他平台则返回
/// 符号链接目标路径。
/// 如果可执行文件在运行时被重命名，平台可能返回
///
/// 加载时的路径而非新路径。
/// 在 Linux 上，如果可执行文件在运行时被删除，该函数
///
/// On Linux, if the executable is deleted while it is running, this function
/// may return the path with the string `" (deleted)"` appended.
///
/// # 错误
///
/// # 获取当前可执行文件的路径是一个平台特定的操作，
///
/// 可能会因多种原因失败。一些错误包括，但不仅限于：
/// 文件系统操作失败或通用系统调用失败。
/// # 安全性
///
/// # 必须谨慎处理此函数的输出，以避免安全漏洞，尤其是在具有高于用户权限的
///
/// 进程中，如 setuid 或 setgid 程序。
/// vulnerabilities, particularly in processes that run with privileges higher
/// 环境和参数可以由调用程序的用户任意设置。
///
/// For example, on some Unix platforms, the result is calculated by
/// searching `$PATH` for an executable matching `argv[0]`, but both the
/// environment and arguments can be be set arbitrarily by the user who
/// invokes the program.
///
/// On Linux, if `fs.secure_hardlinks` is not set, an attacker who can
/// create hardlinks to the executable may be able to cause this function
/// 返回一个由攻击者控制的路径，他们随后会将其替换为
/// 另一个程序。
///
/// 此示例攻击列表并不全面。
///
/// # 示例
///
/// ```
/// use std::env;
///
/// match env::current_exe() {
///     Ok(exe_path) => println!("Path of this executable is: {}",
///                              exe_path.display()),
///     Err(e) => println!("failed to get current exe path: {e}"),
/// };
/// ```
///
/// [changes]: crate::io#platform-specific-behavior
#[stable(feature = "env", since = "1.0.0")]
pub fn current_exe() -> io::Result<PathBuf> {
    paths_imp::current_exe()
}

/// An iterator over the arguments of a process, yielding a [`String`] value for
/// 每个参数。
///
/// This struct is created by [`env::args()`]. See its documentation
/// 以了解更多信息。
///
/// 第一个元素传统上是可执行文件的路径，但它可以被设置为任意文本，甚至可能不存在。这意味着该属性
/// 不应用于安全目的。
/// should not be relied upon for security purposes.
///
/// [`env::args()`]: args
#[must_use = "iterators are lazy and do nothing unless consumed"]
#[stable(feature = "env", since = "1.0.0")]
pub struct Args {
    inner: ArgsOs,
}

/// An iterator over the arguments of a process, yielding an [`OsString`] value
/// for each argument.
///
/// This struct is created by [`env::args_os()`]. See its documentation
/// 以了解更多信息。
///
/// 第一个元素传统上是可执行文件的路径，但它可以被设置为任意文本，甚至可能不存在。这意味着该属性
/// 不应用于安全目的。
/// 不应用于安全目的。
///
/// [`env::args_os()`]: args_os
#[must_use = "iterators are lazy and do nothing unless consumed"]
#[stable(feature = "env", since = "1.0.0")]
pub struct ArgsOs {
    inner: sys::args::Args,
}

/// 返回该程序启动时使用的参数（通常通过命令行传递）。
/// 通过命令行传递。
///
/// 第一个元素传统上是可执行文件的路径，但它可以被设置为
/// 任意文本，甚至可能不存在。这意味着该属性不应
/// 用于安全目的。
///
/// 在 Unix 系统上，shell 通常使用通配符模式展开未加引号的参数
/// (such as `*` and `?`). On Windows this is not done, and such arguments are
/// 。
///
/// On glibc Linux systems, arguments are retrieved by placing a function in `.init_array`.
/// glibc passes `argc`, `argv`, and `envp` to functions in `.init_array`, as a non-standard
/// extension. This allows `std::env::args` to work even in a `cdylib` or `staticlib`, as it
/// 。
///
/// # Panic
///
/// 如果进程的任何参数不是有效的 Unicode 字符，返回的迭代器在迭代过程中会触发 panic。如果不希望这种情况发生，
/// process is not valid Unicode. If this is not desired,
/// use the [`args_os`] function instead.
///
/// # 示例
///
/// ```
/// use std::env;
///
/// // Prints each argument on a separate line
/// for argument in env::args() {
///     println!("{argument}");
/// }
/// ```
#[stable(feature = "env", since = "1.0.0")]
pub fn args() -> Args {
    Args { inner: args_os() }
}

/// 返回该程序启动时使用的参数（通常通过命令行传递）。
/// 通过命令行传递。
///
/// 第一个元素传统上是可执行文件的路径，但它可以被设置为
/// 任意文本，甚至可能不存在。这意味着该属性不应
/// 用于安全目的。
///
/// 在 Unix 系统上，shell 通常使用通配符模式展开未加引号的参数
/// (such as `*` and `?`). On Windows this is not done, and such arguments are
/// 按原样通过。
///
/// On glibc Linux systems, arguments are retrieved by placing a function in `.init_array`.
/// glibc passes `argc`, `argv`, and `envp` to functions in `.init_array`, as a non-standard
/// extension. This allows `std::env::args_os` to work even in a `cdylib` or `staticlib`, as it
/// 即使是在这些系统上也是如此。
///
/// 请注意，返回的迭代器不会检查处理参数是否为有效的 Unicode 字符。如果您希望在无效的 UTF-8 字符时触发 panic，
/// process are valid Unicode. If you want to panic on invalid UTF-8,
/// use the [`args`] function instead.
///
/// # Examples
///
/// ```
/// use std::env;
///
/// // Prints each argument on a separate line
/// for argument in env::args_os() {
///     println!("{argument:?}");
/// }
/// ```
#[stable(feature = "env", since = "1.0.0")]
pub fn args_os() -> ArgsOs {
    ArgsOs { inner: sys::args::args() }
}

#[stable(feature = "env_unimpl_send_sync", since = "1.26.0")]
impl !Send for Args {}

#[stable(feature = "env_unimpl_send_sync", since = "1.26.0")]
impl !Sync for Args {}

#[stable(feature = "env", since = "1.0.0")]
impl Iterator for Args {
    type Item = String;

    fn next(&mut self) -> Option<String> {
        self.inner.next().map(|s| s.into_string().unwrap())
    }

    #[inline]
    fn size_hint(&self) -> (usize, Option<usize>) {
        self.inner.size_hint()
    }

    // Methods which skip args cannot simply delegate to the inner iterator,
    // because `env::args` states that we will "panic during iteration if any
    // argument to the process is not valid Unicode".
    //
    // This offers two possible interpretations:
    // - a skipped argument is never encountered "during iteration"
    // - even a skipped argument is encountered "during iteration"
    //
    // As a panic can be observed, we err towards validating even skipped
    // arguments for now, though this is not explicitly promised by the API.
}

#[stable(feature = "env", since = "1.0.0")]
impl ExactSizeIterator for Args {
    #[inline]
    fn len(&self) -> usize {
        self.inner.len()
    }

    #[inline]
    fn is_empty(&self) -> bool {
        self.inner.is_empty()
    }
}

#[stable(feature = "env_iterators", since = "1.12.0")]
impl DoubleEndedIterator for Args {
    fn next_back(&mut self) -> Option<String> {
        self.inner.next_back().map(|s| s.into_string().unwrap())
    }
}

#[stable(feature = "std_debug", since = "1.16.0")]
impl fmt::Debug for Args {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let Self { inner: ArgsOs { inner } } = self;
        f.debug_struct("Args").field("inner", inner).finish()
    }
}

#[stable(feature = "env_unimpl_send_sync", since = "1.26.0")]
impl !Send for ArgsOs {}

#[stable(feature = "env_unimpl_send_sync", since = "1.26.0")]
impl !Sync for ArgsOs {}

#[stable(feature = "env", since = "1.0.0")]
impl Iterator for ArgsOs {
    type Item = OsString;

    #[inline]
    fn next(&mut self) -> Option<OsString> {
        self.inner.next()
    }

    #[inline]
    fn next_chunk<const N: usize>(
        &mut self,
    ) -> Result<[OsString; N], array::IntoIter<OsString, N>> {
        self.inner.next_chunk()
    }

    #[inline]
    fn size_hint(&self) -> (usize, Option<usize>) {
        self.inner.size_hint()
    }

    #[inline]
    fn count(self) -> usize {
        self.inner.len()
    }

    #[inline]
    fn last(self) -> Option<OsString> {
        self.inner.last()
    }

    #[inline]
    fn advance_by(&mut self, n: usize) -> Result<(), NonZero<usize>> {
        self.inner.advance_by(n)
    }

    #[inline]
    fn try_fold<B, F, R>(&mut self, init: B, f: F) -> R
    where
        F: FnMut(B, Self::Item) -> R,
        R: Try<Output = B>,
    {
        self.inner.try_fold(init, f)
    }

    #[inline]
    fn fold<B, F>(self, init: B, f: F) -> B
    where
        F: FnMut(B, Self::Item) -> B,
    {
        self.inner.fold(init, f)
    }
}

#[stable(feature = "env", since = "1.0.0")]
impl ExactSizeIterator for ArgsOs {
    #[inline]
    fn len(&self) -> usize {
        self.inner.len()
    }

    #[inline]
    fn is_empty(&self) -> bool {
        self.inner.is_empty()
    }
}

#[stable(feature = "env_iterators", since = "1.12.0")]
impl DoubleEndedIterator for ArgsOs {
    #[inline]
    fn next_back(&mut self) -> Option<OsString> {
        self.inner.next_back()
    }

    #[inline]
    fn advance_back_by(&mut self, n: usize) -> Result<(), NonZero<usize>> {
        self.inner.advance_back_by(n)
    }
}

#[stable(feature = "std_debug", since = "1.16.0")]
impl fmt::Debug for ArgsOs {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let Self { inner } = self;
        f.debug_struct("ArgsOs").field("inner", inner).finish()
    }
}

/// 与当前目标相关的常量
#[stable(feature = "env", since = "1.0.0")]
pub mod consts {
    use crate::sys::env_consts::os;

    /// 描述当前正在使用的 CPU 架构的字符串。
    /// An example value may be: `"x86"`, `"arm"` or `"riscv64"`.
    ///
    /// <details><summary>Full list of possible values</summary>
    ///
    /// * `"x86"`
    /// * `"x86_64"`
    /// * `"arm"`
    /// * `"aarch64"`
    /// * `"m68k"`
    /// * `"mips"`
    /// * `"mips32r6"`
    /// * `"mips64"`
    /// * `"mips64r6"`
    /// * `"csky"`
    /// * `"powerpc"`
    /// * `"powerpc64"`
    /// * `"riscv32"`
    /// * `"riscv64"`
    /// * `"s390x"`
    /// * `"sparc"`
    /// * `"sparc64"`
    /// * `"hexagon"`
    /// * `"loongarch32"`
    /// * `"loongarch64"`
    ///
    /// </details>
    #[stable(feature = "env", since = "1.0.0")]
    pub const ARCH: &str = env!("STD_ENV_ARCH");

    /// 描述操作系统家族的字符串。
    /// An example value may be: `"unix"`, or `"windows"`.
    ///
    /// 如果不知道家族，此值可以是空字符串。
    ///
    /// <details><summary>Full list of possible values</summary>
    ///
    /// * `"unix"`
    /// * `"windows"`
    /// * `"itron"`
    /// * `"wasm"`
    /// * `""`
    ///
    /// </details>
    #[stable(feature = "env", since = "1.0.0")]
    pub const FAMILY: &str = os::FAMILY;

    /// 描述正在使用的特定操作系统的字符串。
    /// An example value may be: `"linux"`, or `"freebsd"`.
    ///
    /// <details><summary>Full list of possible values</summary>
    ///
    // tidy-alphabetical-start
    /// * `"aix"`
    /// * `"android"`
    /// * `"apple"`
    /// * `"dragonfly"`
    /// * `"emscripten"`
    /// * `"espidf"`
    /// * `"fortanix"`
    /// * `"freebsd"`
    /// * `"fuchsia"`
    /// * `"haiku"`
    /// * `"hermit"`
    /// * `"horizon"`
    /// * `"hurd"`
    /// * `"illumos"`
    /// * `"ios"`
    /// * `"l4re"`
    /// * `"linux"`
    /// * `"macos"`
    /// * `"netbsd"`
    /// * `"nto"`
    /// * `"openbsd"`
    /// * `"qnx"`
    /// * `"redox"`
    /// * `"solaris"`
    /// * `"solid_asp3"`
    /// * `"tvos"`
    /// * `"uefi"`
    /// * `"vexos"`
    /// * `"visionos"`
    /// * `"vita"`
    /// * `"vxworks"`
    /// * `"wasi"`
    /// * `"watchos"`
    /// * `"windows"`
    /// * `"xous"`
    // tidy-alphabetical-end
    ///
    /// </details>
    #[stable(feature = "env", since = "1.0.0")]
    pub const OS: &str = os::OS;

    /// 指定此平台共享库使用的文件名前缀（如果有的话）。
    /// This is either `"lib"` or an empty string. (`""`).
    #[stable(feature = "env", since = "1.0.0")]
    pub const DLL_PREFIX: &str = os::DLL_PREFIX;

    /// 指定此平台共享库使用的文件名后缀（如果有的话）。
    /// An example value may be: `".so"`, `".elf"`, or `".dll"`.
    ///
    /// The possible values are identical to those of [`DLL_EXTENSION`], but with the leading period included.
    #[stable(feature = "env", since = "1.0.0")]
    pub const DLL_SUFFIX: &str = os::DLL_SUFFIX;

    /// 指定此平台共享库使用的文件扩展名（如果有的话），位于点之后。
    /// An example value may be: `"so"`, `"elf"`, or `"dll"`.
    ///
    /// <details><summary>Full list of possible values</summary>
    ///
    /// * `"so"`
    /// * `"dylib"`
    /// * `"dll"`
    /// * `"sgxs"`
    /// * `"a"`
    /// * `"elf"`
    /// * `"wasm"`
    /// * `""` (an empty string)
    ///
    /// </details>
    #[stable(feature = "env", since = "1.0.0")]
    pub const DLL_EXTENSION: &str = os::DLL_EXTENSION;

    /// 指定此平台可执行二进制文件使用的文件名后缀（如果有的话）。
    /// An example value may be: `".exe"`, or `".efi"`.
    ///
    /// The possible values are identical to those of [`EXE_EXTENSION`], but with the leading period included.
    #[stable(feature = "env", since = "1.0.0")]
    pub const EXE_SUFFIX: &str = os::EXE_SUFFIX;

    /// 指定此平台可执行二进制文件使用的文件扩展名（如果有的话）。
    /// An example value may be: `"exe"`, or an empty string (`""`).
    ///
    /// <details><summary>Full list of possible values</summary>
    ///
    /// * `"bin"`
    /// * `"exe"`
    /// * `"efi"`
    /// * `"js"`
    /// * `"sgxs"`
    /// * `"elf"`
    /// * `"wasm"`
    /// * `""` (an empty string)
    ///
    /// </details>
    #[stable(feature = "env", since = "1.0.0")]
    pub const EXE_EXTENSION: &str = os::EXE_EXTENSION;
}
