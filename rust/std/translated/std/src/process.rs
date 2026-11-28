//! 一个用于操作进程的模块。
//!
//! 该模块主要关注于启动与交互子进程，同时也提供终止当前进程的方法。
//! processes, but it also provides [`abort`] and [`exit`] for terminating the
//! # 启动进程
//!
//! # 启动进程
//!
//! The [`Command`] struct is used to configure and spawn processes:
//!
//! ```no_run
//! use std::process::Command;
//!
//! let output = Command::new("echo")
//!     .arg("Hello world")
//!     .output()
//!     .expect("echo command should execute successfully");
//!
//! assert_eq!(b"Hello world\n", output.stdout.as_slice());
//! ```
//!
//! Several methods on [`Command`], such as [`spawn`] or [`output`], can be used
//! to spawn a process. In particular, [`output`] spawns the child process and
//! waits until the process terminates, while [`spawn`] will return a [`Child`]
//! 此列表并不完整，根据平台不同还可能出现其他错误。
//!
//! 请注意，函数仅在尝试启动子进程时会出现错误。如果子进程成功启动，之后的任何错误都会通过
//! - The command does not exist, or is not in the platform-specific PATH search list.
//! # 处理 I/O
//! - The current process doesn't have enough permissions to spawn the command.
//! - A dynamic library required by the command could not be found.
//!
//! # Windows 参数分割
//!
//! 在 Unix 系统上，参数作为字符串数组传递给新进程，但在 Windows 上参数作为单个命令行字符串传递，由子进程解析为数组。因此，父进程和子进程必须就命令行字符串的编码方式达成一致。
//! successfully spawned, any error that happens afterwards will be reported through
//! its [`ExitStatus`].
//!
//! # Handling I/O
//!
//! The [`stdout`], [`stdin`], and [`stderr`] of a child process can be
//! configured by passing an [`Stdio`] to the corresponding method on
//! [`Command`]. Once spawned, they can be accessed from the [`Child`]. For
//! example, piping output from one command into another command can be done
//! like so:
//!
//! ```no_run
//! use std::process::{Command, Stdio};
//!
//! // stdout must be configured with `Stdio::piped` in order to use
//! // `echo_child.stdout`
//! let echo_child = Command::new("echo")
//!     .arg("Oh no, a tpyo!")
//!     .stdout(Stdio::piped())
//!     .spawn()
//!     .expect("echo command should start");
//!
//! // Note that `echo_child` is moved here, but we won't be needing
//! // `echo_child` anymore
//! let echo_out = echo_child.stdout.expect("child stdout should open");
//!
//! let mut sed_child = Command::new("sed")
//!     .arg("s/tpyo/typo/")
//!     .stdin(Stdio::from(echo_out))
//!     .stdout(Stdio::piped())
//!     .spawn()
//!     .expect("sed command should start");
//!
//! let output = sed_child.wait_with_output().expect("wait_with_output on sed should succeed");
//! assert_eq!(b"Oh no, a typo!\n", output.stdout.as_slice());
//! ```
//!
//! Note that [`ChildStderr`] and [`ChildStdout`] implement [`Read`] and
//! [`ChildStdin`] implements [`Write`]:
//!
//! ```no_run
//! use std::process::{Command, Stdio};
//! use std::io::Write;
//!
//! let mut child = Command::new("/bin/cat")
//!     .stdin(Stdio::piped())
//!     .stdout(Stdio::piped())
//!     .spawn()
//!     .expect("child should start");
//!
//! // If the child process fills its stdout buffer, it may end up
//! // waiting until the parent reads the stdout, and not be able to
//! // read stdin in the meantime, causing a deadlock.
//! // Writing from another thread ensures that stdout is being read
//! // at the same time, avoiding the problem.
//! let mut stdin = child.stdin.take().expect("stdin should be able to be retrieved");
//! std::thread::spawn(move || {
//!     stdin.write_all(b"test").expect("writing to stdin should succeed");
//! });
//!
//! let output = child
//!     .wait_with_output()
//!     .expect("wait_with_output on child should succeed");
//!
//! assert_eq!(b"test", output.stdout.as_slice());
//! ```
//!
//! # Windows argument splitting
//!
//! On Unix systems arguments are passed to a new process as an array of strings,
//! but on Windows arguments are passed as a single commandline string and it is
//! up to the child process to parse it into an array. Therefore the parent and
//! child processes must agree on how the commandline string is encoded.
//!
//! Most programs use the standard C run-time `argv`, which in practice results
//! in consistent argument handling. However, some programs have their own way of
//! parsing the commandline string. In these cases using [`arg`] or [`args`] may
//! result in the child process seeing a different array of arguments than the
//! parent process intended.
//!
//! 有两种方法可以缓解这一问题：
//!
//! * 验证不可信的输入，仅允许安全的子集。
//! * Use [`raw_arg`] to build a custom commandline. This bypasses the escaping
//!   rules used by [`arg`] so should be used with due caution.
//!
//! `cmd.exe` and `.bat` files use non-standard argument parsing and are especially
//! 容易受到恶意输入的影响，因为它们可能被用于运行任意 shell
//! 命令。不可信的参数应被尽可能限制。
//! For examples on handling this see [`raw_arg`].
//!
//! ### 批处理文件特殊处理
//!
//! On Windows, `Command` uses the Windows API function [`CreateProcessW`] to
//! spawn new processes. An undocumented feature of this function is that
//! when given a `.bat` file as the application to run, it will automatically
//! convert that into running `cmd.exe /c` with the batch file as the next argument.
//!
//! For historical reasons Rust currently preserves this behavior when using
//! [`Command::new`], and escapes the arguments according to `cmd.exe` rules.
//! Due to the complexity of `cmd.exe` argument handling, it might not be
//! 特殊字符可能在版本更新中发生变化。
//! 请注意，以这种方式运行批处理脚本可能在未来被移除，因此不应依赖它。
//! 正在运行或已退出子进程的表示形式。
//!
//! Also note that running batch scripts in this way may be removed in the
//! 启动进程，并且本身可以使用构建器风格的接口构造。
//!
//! [`spawn`]: Command::spawn
//! [`output`]: Command::output
//!
//! [`stdout`]: Command::stdout
//! [`stdin`]: Command::stdin
//! [`stderr`]: Command::stderr
//!
//! [`Write`]: io::Write
//! [`Read`]: io::Read
//!
//! [`arg`]: Command::arg
//! [`args`]: Command::args
//! [`raw_arg`]: crate::os::windows::process::CommandExt::raw_arg
//!
//! [`CreateProcessW`]: https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-createprocessw

#![stable(feature = "process", since = "1.0.0")]
#![deny(unsafe_op_in_unsafe_fn)]

#[cfg(all(
    test,
    not(any(
        target_os = "emscripten",
        target_os = "wasi",
        target_env = "sgx",
        target_os = "xous",
        target_os = "trusty",
        target_os = "hermit",
        target_os = "l4re",
    ))
))]
mod tests;

use core::intrinsics;

use crate::ffi::OsStr;
use crate::io::prelude::*;
use crate::io::{self, BorrowedCursor, IoSlice, IoSliceMut};
use crate::num::NonZero;
use crate::path::Path;
use crate::sys::{AsInner, AsInnerMut, FromInner, IntoInner, process as imp};
use crate::{fmt, format_args_nl, fs, str};

/// Representation of a running or exited child process.
///
/// This structure is used to represent and manage child processes. A child
/// process is created via the [`Command`] struct, which configures the
/// 
/// 在子进程生命周期之外。
///
/// There is no implementation of [`Drop`] for child processes,
/// so if you do not ensure the `Child` has exited then it will continue to
/// run, even after the `Child` handle to the child process has gone out of
/// 
///
/// Calling [`wait`] (or other functions that wrap around it) will make
/// 父进程等待子进程真正退出后再继续。
/// 
///
/// # 警告
///
/// On some systems, calling [`wait`] or similar is necessary for the OS to
/// 全局资源（例如进程 ID）。
/// still around as a "zombie". Leaving too many zombies around may exhaust
/// global resources (for example process IDs).
///
/// The standard library does *not* automatically wait on child processes (not
/// even if the `Child` is dropped), it is up to the application developer to do
/// so. As a consequence, dropping `Child` handles without waiting on them first
/// # 示例
///
/// # 写入子进程标准输入 (stdin) 的句柄，如果已捕获。
///
/// ```should_panic
/// use std::process::Command;
///
/// let mut child = Command::new("/bin/cat")
///     .arg("file.txt")
///     .spawn()
///     .expect("child should spawn");
///
/// let ecode = child.wait().expect("child should be running");
///
/// assert!(ecode.success());
/// ```
///
/// [`wait`]: Child::wait
#[stable(feature = "process", since = "1.0.0")]
#[cfg_attr(not(test), rustc_diagnostic_item = "Child")]
pub struct Child {
    pub(crate) handle: imp::Process,

    /// 读取子进程标准输出 (stdout) 的句柄，如果已捕获。你可能会发现这样做很有帮助。
    /// has been captured. You might find it helpful to do
    ///
    /// ```ignore (incomplete)
    /// let stdin = child.stdin.take().expect("handle should be present");
    /// ```
    ///
    /// to avoid partially moving the `child` and thus blocking yourself from calling
    /// functions on `child` while using `stdin`.
    #[stable(feature = "process", since = "1.0.0")]
    pub stdin: Option<ChildStdin>,

    /// 写入子进程标准输入 (stdin) 的句柄，如果已捕获。你可能会发现这样做很有帮助。
    /// 读取子进程标准输出 (stdout) 的句柄，如果已捕获。你可能会发现这样做很有帮助。
    ///
    /// ```ignore (incomplete)
    /// let stdout = child.stdout.take().expect("handle should be present");
    /// ```
    ///
    /// to avoid partially moving the `child` and thus blocking yourself from calling
    /// functions on `child` while using `stdout`.
    #[stable(feature = "process", since = "1.0.0")]
    pub stdout: Option<ChildStdout>,

    /// 读取子进程标准错误 (stderr) 的句柄，如果已捕获。你可能会发现这样做很有帮助。
    /// has been captured. You might find it helpful to do
    ///
    /// ```ignore (incomplete)
    /// let stderr = child.stderr.take().expect("handle should be present");
    /// ```
    ///
    /// to avoid partially moving the `child` and thus blocking yourself from calling
    /// functions on `child` while using `stderr`.
    #[stable(feature = "process", since = "1.0.0")]
    pub stderr: Option<ChildStderr>,
}

impl AsInner<imp::Process> for Child {
    #[inline]
    fn as_inner(&self) -> &imp::Process {
        &self.handle
    }
}

impl FromInner<(imp::Process, StdioPipes)> for Child {
    fn from_inner((handle, io): (imp::Process, StdioPipes)) -> Child {
        Child {
            handle,
            stdin: io.stdin.map(ChildStdin::from_inner),
            stdout: io.stdout.map(ChildStdout::from_inner),
            stderr: io.stderr.map(ChildStderr::from_inner),
        }
    }
}

impl IntoInner<imp::Process> for Child {
    fn into_inner(self) -> imp::Process {
        self.handle
    }
}

#[stable(feature = "std_debug", since = "1.16.0")]
impl fmt::Debug for Child {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Child")
            .field("stdin", &self.stdin)
            .field("stdout", &self.stdout)
            .field("stderr", &self.stderr)
            .finish_non_exhaustive()
    }
}

/// The pipes connected to a spawned process.
///
/// Used to pass pipe handles between this module and [`imp`].
pub(crate) struct StdioPipes {
    pub stdin: Option<imp::ChildPipe>,
    pub stdout: Option<imp::ChildPipe>,
    pub stderr: Option<imp::ChildPipe>,
}

/// A handle to a child process's standard input (stdin).
///
/// This struct is used in the [`stdin`] field on [`Child`].
///
/// When an instance of `ChildStdin` is [dropped], the `ChildStdin`'s underlying
/// 子进程标准输出 (stdout) 的句柄。
/// to being dropped, it will become unblocked after dropping.
///
/// [`stdin`]: Child::stdin
/// [dropped]: Drop
#[stable(feature = "process", since = "1.0.0")]
pub struct ChildStdin {
    inner: imp::ChildPipe,
}

// In addition to the `impl`s here, `ChildStdin` also has `impl`s for
// `AsFd`/`From<OwnedFd>`/`Into<OwnedFd>` and
// `AsRawFd`/`IntoRawFd`/`FromRawFd`, on Unix and WASI, and
// `AsHandle`/`From<OwnedHandle>`/`Into<OwnedHandle>` and
// `AsRawHandle`/`IntoRawHandle`/`FromRawHandle` on Windows.

#[stable(feature = "process", since = "1.0.0")]
impl Write for ChildStdin {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        (&*self).write(buf)
    }

    fn write_vectored(&mut self, bufs: &[IoSlice<'_>]) -> io::Result<usize> {
        (&*self).write_vectored(bufs)
    }

    fn is_write_vectored(&self) -> bool {
        io::Write::is_write_vectored(&self)
    }

    #[inline]
    fn flush(&mut self) -> io::Result<()> {
        (&*self).flush()
    }
}

#[stable(feature = "write_mt", since = "1.48.0")]
impl Write for &ChildStdin {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        self.inner.write(buf)
    }

    fn write_vectored(&mut self, bufs: &[IoSlice<'_>]) -> io::Result<usize> {
        self.inner.write_vectored(bufs)
    }

    fn is_write_vectored(&self) -> bool {
        self.inner.is_write_vectored()
    }

    #[inline]
    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

impl AsInner<imp::ChildPipe> for ChildStdin {
    #[inline]
    fn as_inner(&self) -> &imp::ChildPipe {
        &self.inner
    }
}

impl IntoInner<imp::ChildPipe> for ChildStdin {
    fn into_inner(self) -> imp::ChildPipe {
        self.inner
    }
}

impl FromInner<imp::ChildPipe> for ChildStdin {
    fn from_inner(pipe: imp::ChildPipe) -> ChildStdin {
        ChildStdin { inner: pipe }
    }
}

#[stable(feature = "std_debug", since = "1.16.0")]
impl fmt::Debug for ChildStdin {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("ChildStdin").finish_non_exhaustive()
    }
}

/// A handle to a child process's standard output (stdout).
///
/// This struct is used in the [`stdout`] field on [`Child`].
///
/// When an instance of `ChildStdout` is [dropped], the `ChildStdout`'s
/// 子进程标准错误 (stderr) 的句柄。
///
/// [`stdout`]: Child::stdout
/// [dropped]: Drop
#[stable(feature = "process", since = "1.0.0")]
pub struct ChildStdout {
    inner: imp::ChildPipe,
}

// In addition to the `impl`s here, `ChildStdout` also has `impl`s for
// `AsFd`/`From<OwnedFd>`/`Into<OwnedFd>` and
// `AsRawFd`/`IntoRawFd`/`FromRawFd`, on Unix and WASI, and
// `AsHandle`/`From<OwnedHandle>`/`Into<OwnedHandle>` and
// `AsRawHandle`/`IntoRawHandle`/`FromRawHandle` on Windows.

#[stable(feature = "process", since = "1.0.0")]
impl Read for ChildStdout {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        self.inner.read(buf)
    }

    fn read_buf(&mut self, buf: BorrowedCursor<'_, u8>) -> io::Result<()> {
        self.inner.read_buf(buf)
    }

    fn read_vectored(&mut self, bufs: &mut [IoSliceMut<'_>]) -> io::Result<usize> {
        self.inner.read_vectored(bufs)
    }

    #[inline]
    fn is_read_vectored(&self) -> bool {
        self.inner.is_read_vectored()
    }

    fn read_to_end(&mut self, buf: &mut Vec<u8>) -> io::Result<usize> {
        self.inner.read_to_end(buf)
    }
}

impl AsInner<imp::ChildPipe> for ChildStdout {
    #[inline]
    fn as_inner(&self) -> &imp::ChildPipe {
        &self.inner
    }
}

impl IntoInner<imp::ChildPipe> for ChildStdout {
    fn into_inner(self) -> imp::ChildPipe {
        self.inner
    }
}

impl FromInner<imp::ChildPipe> for ChildStdout {
    fn from_inner(pipe: imp::ChildPipe) -> ChildStdout {
        ChildStdout { inner: pipe }
    }
}

#[stable(feature = "std_debug", since = "1.16.0")]
impl fmt::Debug for ChildStdout {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("ChildStdout").finish_non_exhaustive()
    }
}

/// A handle to a child process's stderr.
///
/// This struct is used in the [`stderr`] field on [`Child`].
///
/// When an instance of `ChildStderr` is [dropped], the `ChildStderr`'s
/// 子进程标准错误 (stderr) 的句柄。
///
/// [`stderr`]: Child::stderr
/// [dropped]: Drop
#[stable(feature = "process", since = "1.0.0")]
pub struct ChildStderr {
    inner: imp::ChildPipe,
}

// In addition to the `impl`s here, `ChildStderr` also has `impl`s for
// `AsFd`/`From<OwnedFd>`/`Into<OwnedFd>` and
// `AsRawFd`/`IntoRawFd`/`FromRawFd`, on Unix and WASI, and
// `AsHandle`/`From<OwnedHandle>`/`Into<OwnedHandle>` and
// `AsRawHandle`/`IntoRawHandle`/`FromRawHandle` on Windows.

#[stable(feature = "process", since = "1.0.0")]
impl Read for ChildStderr {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        self.inner.read(buf)
    }

    fn read_buf(&mut self, buf: BorrowedCursor<'_, u8>) -> io::Result<()> {
        self.inner.read_buf(buf)
    }

    fn read_vectored(&mut self, bufs: &mut [IoSliceMut<'_>]) -> io::Result<usize> {
        self.inner.read_vectored(bufs)
    }

    #[inline]
    fn is_read_vectored(&self) -> bool {
        self.inner.is_read_vectored()
    }

    fn read_to_end(&mut self, buf: &mut Vec<u8>) -> io::Result<usize> {
        self.inner.read_to_end(buf)
    }
}

impl AsInner<imp::ChildPipe> for ChildStderr {
    #[inline]
    fn as_inner(&self) -> &imp::ChildPipe {
        &self.inner
    }
}

impl IntoInner<imp::ChildPipe> for ChildStderr {
    fn into_inner(self) -> imp::ChildPipe {
        self.inner
    }
}

impl FromInner<imp::ChildPipe> for ChildStderr {
    fn from_inner(pipe: imp::ChildPipe) -> ChildStderr {
        ChildStderr { inner: pipe }
    }
}

#[stable(feature = "std_debug", since = "1.16.0")]
impl fmt::Debug for ChildStderr {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("ChildStderr").finish_non_exhaustive()
    }
}

/// 进程构建器，提供对如何生成新进程的精细控制。
/// 用于控制新进程的生成方式。
///
/// A default configuration can be
/// generated using `Command::new(program)`, where `program` gives a path to the
/// program to be executed. Additional builder methods allow the configuration
/// to be changed (for example, by adding arguments) prior to spawning:
///
/// ```
/// # if cfg!(all(not(all(target_vendor = "apple", not(target_os = "macos"))), not(skip_unsupported_miri_tests))) {
/// use std::process::Command;
///
/// let output = if cfg!(target_os = "windows") {
///     Command::new("cmd")
///         .args(["/C", "echo hello"])
///         .output()
///         .expect("process should execute successfully")
/// } else {
///     Command::new("sh")
///         .arg("-c")
///         .arg("echo hello")
///         .output()
///         .expect("process should execute successfully")
/// };
///
/// let hello = output.stdout;
/// # }
/// ```
///
/// `Command` can be reused to spawn multiple processes. The builder methods
/// 无需立即启动进程即可更改命令。
///
/// ```no_run
/// use std::process::Command;
///
/// let mut echo_hello = Command::new("sh");
/// echo_hello.arg("-c").arg("echo hello");
/// let hello_1 = echo_hello.output().expect("process should execute successfully");
/// let hello_2 = echo_hello.output().expect("process should execute successfully");
/// ```
///
/// 同样，可以在启动进程后调用构建器方法，然后
/// 使用修改后的设置启动新的进程。
///
/// ```no_run
/// use std::process::Command;
///
/// let mut list_dir = Command::new("ls");
///
/// // Execute `ls` in the current directory of the program.
/// list_dir.status().expect("process should execute successfully");
///
/// println!();
///
/// // Change `ls` to execute in the root directory.
/// list_dir.current_dir("/");
///
/// // And then execute `ls` again but in the root directory.
/// list_dir.status().expect("process should execute successfully");
/// ```
#[stable(feature = "process", since = "1.0.0")]
#[cfg_attr(not(test), rustc_diagnostic_item = "Command")]
pub struct Command {
    inner: imp::Command,
}

impl Command {
    /// Constructs a new `Command` for launching the program at
    /// path `program`, with the following default configuration:
    ///
    /// * 不向程序提供任何参数
    /// * 继承当前进程的环境
    /// * 继承当前进程的工作目录
    /// * Inherit stdin/stdout/stderr for [`spawn`] or [`status`], but create pipes for [`output`]
    ///
    /// [`spawn`]: Self::spawn
    /// [`status`]: Self::status
    /// [`output`]: Self::output
    ///
    /// 提供构建器方法以更改这些默认设置，并
    /// 否则配置进程。
    ///
    /// If `program` is not an absolute path, the `PATH` environment variable
    /// will be searched in an OS-defined way.
    ///
    /// # 特定于平台的行为
    ///
    /// 以下细节描述了当前行为，但这些细节
    /// 在未来的 Rust 版本中可能会发生变化。
    ///
    /// On Unix, the `PATH` searched comes from the child's environment:
    ///
    /// - 如果环境未修改，子进程继承父进程
    ///   `PATH` and that is what is searched.
    /// - If `PATH` is explicitly set via [`env`], that new value is searched.
    /// - If [`env_clear`] or [`env_remove`] removes `PATH` without a
    ///   replacement, `execvp` falls back to an OS-defined default (typically
    ///   `/bin:/usr/bin`), **not** the parent's `PATH`. This may fail to find
    ///   programs that rely on the parent's `PATH`.
    ///
    /// To avoid surprises, use an absolute path or explicitly set `PATH` on
    /// the `Command` when modifying the child's environment.
    ///
    /// On Windows, Rust resolves the executable path before spawning, rather
    /// than passing the name to `CreateProcessW` for resolution. When
    /// `program` is not an absolute path, the following locations are searched
    /// 2. 当前可执行文件的目录。
    ///
    /// 1. The child's `PATH`, if explicitly set via [`env`].
    /// 2. The directory of the current executable.
    /// 3. The system directory (`GetSystemDirectoryW`).
    /// 4. The Windows directory (`GetWindowsDirectoryW`).
    /// 5. The parent process's `PATH`.
    ///
    /// Note: when `PATH` is cleared via [`env_clear`] or [`env_remove`] on
    /// Windows, step 1 is skipped but the parent process's `PATH` is still
    /// searched at step 5, unlike on Unix.
    ///
    /// For executable files, the `.exe` extension may be omitted. Files with
    /// other extensions must include the extension, otherwise they will not be
    /// found. Note that this behavior has some known limitations
    /// （参见问题 #37519）。
    ///
    /// [`env`]: Self::env
    /// [`env_remove`]: Self::env_remove
    /// [`env_clear`]: Self::env_clear
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::process::Command;
    ///
    /// Command::new("sh")
    ///     .spawn()
    ///     .expect("sh command should start");
    /// ```
    ///
    /// # 注意事项
    ///
    /// [`Command::new`] is only intended to accept the path of the program. If you pass a program
    /// path along with arguments like `Command::new("ls -l").spawn()`, it will try to search for
    /// `ls -l` literally. The arguments need to be passed separately, such as via [`arg`] or
    /// [`args`].
    ///
    /// ```no_run
    /// use std::process::Command;
    ///
    /// Command::new("ls")
    ///     .arg("-l") // arg passed separately
    ///     .spawn()
    ///     .expect("ls command should start");
    /// ```
    ///
    /// [`arg`]: Self::arg
    /// [`args`]: Self::args
    #[stable(feature = "process", since = "1.0.0")]
    pub fn new<S: AsRef<OsStr>>(program: S) -> Command {
        Command { inner: imp::Command::new(program.as_ref()) }
    }

    /// 向程序添加一个要传递的参数。
    ///
    /// 每次使用只能传递一个参数。因此，而不是：
    ///
    /// ```no_run
    /// # std::process::Command::new("sh")
    /// .arg("-C /path/to/repo")
    /// # ;
    /// ```
    ///
    /// 使用方式应为：
    ///
    /// ```no_run
    /// # std::process::Command::new("sh")
    /// .arg("-C")
    /// .arg("/path/to/repo")
    /// # ;
    /// ```
    ///
    /// To pass multiple arguments see [`args`].
    ///
    /// [`args`]: Command::args
    ///
    /// 请注意，参数不是通过shell传递的，而是直接传递给
    /// 程序的直译形式。这意味着像引号这样的shell语法，
    /// 转义字符、单词分割、glob 模式、变量替换等
    /// 均无效。
    ///
    /// <div class="warning">
    ///
    /// 在 Windows 上，对不可信输入要小心。大多数应用程序使用
    /// 解码传递给它们的参数的标准惯例。这些参数可以安全地用于
    /// use with `arg`. However, some applications such as `cmd.exe` and `.bat` files
    /// 使用非标准的参数解码方式。因此它们容易受到
    /// 恶意输入的影响。
    ///
    /// In the case of `cmd.exe` this is especially important because a malicious
    /// 参数可能执行任意的 shell 命令。
    ///
    /// 更多细节请参阅 [Windows argument splitting][windows-args]
    /// or [`raw_arg`] for manually implementing non-standard argument encoding.
    ///
    /// [`raw_arg`]: crate::os::windows::process::CommandExt::raw_arg
    /// [windows-args]: crate::process#windows-argument-splitting
    ///
    /// </div>
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::process::Command;
    ///
    /// Command::new("ls")
    ///     .arg("-l")
    ///     .arg("-a")
    ///     .spawn()
    ///     .expect("ls command should start");
    /// ```
    #[stable(feature = "process", since = "1.0.0")]
    pub fn arg<S: AsRef<OsStr>>(&mut self, arg: S) -> &mut Command {
        self.inner.arg(arg.as_ref());
        self
    }

    /// 向程序添加多个要传递的参数。
    ///
    /// To pass a single argument see [`arg`].
    ///
    /// [`arg`]: Command::arg
    ///
    /// 请注意，参数不是通过shell传递的，而是直接传递给
    /// 程序的直译形式。这意味着像引号这样的shell语法，
    /// 转义字符、单词分割、glob 模式、变量替换等
    /// 均无效。
    ///
    /// <div class="warning">
    ///
    /// 在 Windows 上，对不可信输入要小心。大多数应用程序使用
    /// 解码传递给它们的参数的标准惯例。这些参数可以安全地用于
    /// use with `arg`. However, some applications such as `cmd.exe` and `.bat` files
    /// 使用非标准的参数解码方式。因此它们容易受到
    /// 恶意输入的影响。
    ///
    /// In the case of `cmd.exe` this is especially important because a malicious
    /// 参数可能执行任意的 shell 命令。
    ///
    /// 更多细节请参阅 [Windows argument splitting][windows-args]
    /// or [`raw_arg`] for manually implementing non-standard argument encoding.
    ///
    /// [`raw_arg`]: crate::os::windows::process::CommandExt::raw_arg
    /// [windows-args]: crate::process#windows-argument-splitting
    ///
    /// </div>
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::process::Command;
    ///
    /// Command::new("ls")
    ///     .args(["-l", "-a"])
    ///     .spawn()
    ///     .expect("ls command should start");
    /// ```
    #[stable(feature = "process", since = "1.0.0")]
    pub fn args<I, S>(&mut self, args: I) -> &mut Command
    where
        I: IntoIterator<Item = S>,
        S: AsRef<OsStr>,
    {
        for arg in args {
            self.arg(arg.as_ref());
        }
        self
    }

    /// 插入或更新显式的环境变量映射。
    ///
    /// 此方法允许您向生成的进程添加环境变量映射，或
    /// overwrite a previously set value. You can use [`Command::envs`] to set multiple environment
    /// 。
    ///
    /// 子进程默认会从父进程继承环境变量。
    /// Environment variables explicitly set using [`Command::env`] take precedence over inherited
    /// 完全禁用环境变量的继承，使用
    /// [`Command::env_clear`] or for a single key using [`Command::env_remove`].
    ///
    /// 请注意，环境变量名称在 Windows 上是不区分大小写的（但在其他平台上是区分大小写的）。
    /// 的。
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::process::Command;
    ///
    /// Command::new("ls")
    ///     .env("PATH", "/bin")
    ///     .spawn()
    ///     .expect("ls command should start");
    /// ```
    #[stable(feature = "process", since = "1.0.0")]
    pub fn env<K, V>(&mut self, key: K, val: V) -> &mut Command
    where
        K: AsRef<OsStr>,
        V: AsRef<OsStr>,
    {
        self.inner.env_mut().set(key.as_ref(), val.as_ref());
        self
    }

    /// 插入或更新多个明确的环境变量映射。
    ///
    /// 此方法允许您向生成的进程添加多个环境变量映射，或
    /// or overwrite previously set values. You can use [`Command::env`] to set a single environment
    /// 。
    ///
    /// 子进程默认会从父进程继承环境变量。
    /// Environment variables explicitly set using [`Command::envs`] take precedence over inherited
    /// 完全禁用环境变量的继承，使用
    /// [`Command::env_clear`] or for a single key using [`Command::env_remove`].
    ///
    /// 请注意，环境变量名称在 Windows 上是不区分大小写的（但在其他平台上是区分大小写的）。
    /// 的。
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::process::{Command, Stdio};
    /// use std::env;
    /// use std::collections::HashMap;
    ///
    /// let filtered_env : HashMap<String, String> =
    ///     env::vars().filter(|&(ref k, _)|
    ///         k == "TERM" || k == "TZ" || k == "LANG" || k == "PATH"
    ///     ).collect();
    ///
    /// Command::new("printenv")
    ///     .stdin(Stdio::null())
    ///     .stdout(Stdio::inherit())
    ///     .env_clear()
    ///     .envs(&filtered_env)
    ///     .spawn()
    ///     .expect("printenv command should start");
    /// ```
    #[stable(feature = "command_envs", since = "1.19.0")]
    pub fn envs<I, K, V>(&mut self, vars: I) -> &mut Command
    where
        I: IntoIterator<Item = (K, V)>,
        K: AsRef<OsStr>,
        V: AsRef<OsStr>,
    {
        for (ref key, ref val) in vars {
            self.inner.env_mut().set(key.as_ref(), val.as_ref());
        }
        self
    }

    /// 移除明确设置的环境变量并阻止从父进程继承它。
    /// 。
    ///
    /// This method will remove the explicit value of an environment variable set via
    /// [`Command::env`] or [`Command::envs`]. In addition, it will prevent the spawned child
    /// process from inheriting that environment variable from its parent process.
    ///
    /// After calling [`Command::env_remove`], the value associated with its key from
    /// [`Command::get_envs`] will be [`None`].
    ///
    /// To clear all explicitly set environment variables and disable all environment variable
    /// inheritance, you can use [`Command::env_clear`].
    ///
    /// # 。
    ///
    /// Prevent any inherited `GIT_DIR` variable from changing the target of the `git` command,
    /// while allowing all other variables, like `GIT_AUTHOR_NAME`.
    ///
    /// ```no_run
    /// use std::process::Command;
    ///
    /// Command::new("git")
    ///     .arg("commit")
    ///     .env_remove("GIT_DIR")
    ///     .spawn()?;
    /// # std::io::Result::Ok(())
    /// ```
    #[stable(feature = "process", since = "1.0.0")]
    pub fn env_remove<K: AsRef<OsStr>>(&mut self, key: K) -> &mut Command {
        self.inner.env_mut().remove(key.as_ref());
        self
    }

    /// 清除所有明确设置的环境变量并阻止继承任何父进程的环境变量。
    /// 。
    ///
    /// This method will remove all explicitly added environment variables set via [`Command::env`]
    /// or [`Command::envs`]. In addition, it will prevent the spawned child process from inheriting
    /// 父进程的任何环境变量。
    ///
    /// After calling [`Command::env_clear`], the iterator from [`Command::get_envs`] will be
    /// 为空。
    ///
    /// You can use [`Command::env_remove`] to clear a single mapping.
    ///
    /// # 示例
    ///
    /// The behavior of `sort` is affected by `LANG` and `LC_*` environment variables.
    /// Clearing the environment makes `sort`'s behavior independent of the parent processes' language.
    ///
    /// ```no_run
    /// use std::process::Command;
    ///
    /// Command::new("sort")
    ///     .arg("file.txt")
    ///     .env_clear()
    ///     .spawn()?;
    /// # std::io::Result::Ok(())
    /// ```
    #[stable(feature = "process", since = "1.0.0")]
    pub fn env_clear(&mut self) -> &mut Command {
        self.inner.env_mut().clear();
        self
    }

    /// 设置子进程的工作目录。
    ///
    /// # 平台特定行为
    ///
    /// If the program path is relative (e.g., `"./script.sh"`), it's ambiguous
    /// whether it should be interpreted relative to the parent's working
    /// directory or relative to `current_dir`. The behavior in this case is
    /// # 示例
    /// [`canonicalize`] to get an absolute program path instead.
    ///
    /// # Examples
    ///
    /// ```no_run
    /// use std::process::Command;
    ///
    /// Command::new("ls")
    ///     .current_dir("/bin")
    ///     .spawn()
    ///     .expect("ls command should start");
    /// ```
    ///
    /// [`canonicalize`]: crate::fs::canonicalize
    #[stable(feature = "process", since = "1.0.0")]
    pub fn current_dir<P: AsRef<Path>>(&mut self, dir: P) -> &mut Command {
        self.inner.cwd(dir.as_ref().as_ref());
        self
    }

    /// Configuration for the child process's standard input (stdin) handle.
    ///
    /// Defaults to [`inherit`] when used with [`spawn`] or [`status`], and
    /// defaults to [`piped`] when used with [`output`].
    ///
    /// [`inherit`]: Stdio::inherit
    /// [`piped`]: Stdio::piped
    /// [`spawn`]: Self::spawn
    /// [`status`]: Self::status
    /// [`output`]: Self::output
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::process::{Command, Stdio};
    ///
    /// Command::new("ls")
    ///     .stdin(Stdio::null())
    ///     .spawn()
    ///     .expect("ls command should start");
    /// ```
    #[stable(feature = "process", since = "1.0.0")]
    pub fn stdin<T: Into<Stdio>>(&mut self, cfg: T) -> &mut Command {
        self.inner.stdin(cfg.into().0);
        self
    }

    /// 子进程标准输出 (stdout) 处理器的配置。
    ///
    /// Defaults to [`inherit`] when used with [`spawn`] or [`status`], and
    /// defaults to [`piped`] when used with [`output`].
    ///
    /// [`inherit`]: Stdio::inherit
    /// [`piped`]: Stdio::piped
    /// [`spawn`]: Self::spawn
    /// [`status`]: Self::status
    /// [`output`]: Self::output
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::process::{Command, Stdio};
    ///
    /// Command::new("ls")
    ///     .stdout(Stdio::null())
    ///     .spawn()
    ///     .expect("ls command should start");
    /// ```
    #[stable(feature = "process", since = "1.0.0")]
    pub fn stdout<T: Into<Stdio>>(&mut self, cfg: T) -> &mut Command {
        self.inner.stdout(cfg.into().0);
        self
    }

    /// 子进程标准错误 (stderr) 处理器的配置。
    ///
    /// Defaults to [`inherit`] when used with [`spawn`] or [`status`], and
    /// defaults to [`piped`] when used with [`output`].
    ///
    /// [`inherit`]: Stdio::inherit
    /// [`piped`]: Stdio::piped
    /// [`spawn`]: Self::spawn
    /// [`status`]: Self::status
    /// [`output`]: Self::output
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::process::{Command, Stdio};
    ///
    /// Command::new("ls")
    ///     .stderr(Stdio::null())
    ///     .spawn()
    ///     .expect("ls command should start");
    /// ```
    #[stable(feature = "process", since = "1.0.0")]
    pub fn stderr<T: Into<Stdio>>(&mut self, cfg: T) -> &mut Command {
        self.inner.stderr(cfg.into().0);
        self
    }

    /// 作为子进程执行命令，并返回其句柄。
    ///
    /// 默认情况下，stdin、stdout 和 stderr 从父进程继承。
    ///
    /// # 错误
    ///
    /// This method returns an [`io::Error`] if the child process could not be
    /// * 程序无法找到（例如，不存在，或者，
    ///
    /// * the program could not be found (for example, it does not exist, or,
    ///   when given a bare name, it is not present in the `PATH`);
    /// （例如，文件未被标记为可执行，或者执行被
    ///   (for example, the file is not marked executable, or execution is
    ///   denied by a security policy such as `seccomp`);
    /// 资源耗尽而无法创建新进程（例如，进程数量限制被达到）。
    /// 导致无法创建新进程。
    /// 错误仅在子进程生成时发生失败时返回。
    ///
    /// 一旦子进程成功启动，任何情况
    /// being spawned. Once the child has started successfully, anything that
    /// happens to it afterwards — including being terminated by a signal — is
    /// reported through its [`ExitStatus`] rather than as an error from the
    /// # 示例
    ///
    /// # 执行命令作为子进程运行，等待其完成并收集所有输出。
    ///
    /// ```no_run
    /// use std::process::Command;
    ///
    /// Command::new("ls")
    ///     .spawn()
    ///     .expect("ls command should start");
    /// ```
    #[stable(feature = "process", since = "1.0.0")]
    pub fn spawn(&mut self) -> io::Result<Child> {
        self.inner.spawn(imp::Stdio::Inherit, true).map(Child::from_inner)
    }

    /// 将命令作为子进程执行，等待其完成并收集其输出。
    /// 默认情况下，标准输出和标准错误会被捕获（并用于提供
    ///
    /// 结果输出）。标准输入不会从父进程继承，如果子进程尝试从标准输入流读取，
    /// 则流会立即关闭。
    /// # 错误
    /// in the stream immediately closing.
    ///
    /// # 注意，如果子进程运行后未能成功退出或被信号终止，此方法不会返回错误。在这种情况下，
    ///
    /// Like [`spawn`], this method returns an [`io::Error`] if the child
    /// process could not be spawned; see [`spawn`] for the common reasons. It
    /// 将命令作为子进程执行，等待其完成并收集其状态。
    /// 默认情况下，标准输入、标准输出和标准错误会从父进程继承。
    ///
    /// # 错误
    /// then exits unsuccessfully, or is terminated by a signal. In those cases
    /// it still returns [`Ok`], and the outcome is reflected in the
    /// [`ExitStatus`] stored in the returned [`Output`].
    ///
    /// [`spawn`]: Command::spawn
    ///
    /// # 示例
    ///
    /// ```should_panic
    /// use std::process::Command;
    /// use std::io::{self, Write};
    /// let output = Command::new("/bin/cat")
    ///     .arg("file.txt")
    ///     .output()?;
    ///
    /// println!("status: {}", output.status);
    /// io::stdout().write_all(&output.stdout)?;
    /// io::stderr().write_all(&output.stderr)?;
    ///
    /// assert!(output.status.success());
    /// # io::Result::Ok(())
    /// ```
    #[stable(feature = "process", since = "1.0.0")]
    pub fn output(&mut self) -> io::Result<Output> {
        let (status, stdout, stderr) = imp::output(&mut self.inner)?;
        Ok(Output { status: ExitStatus(status), stdout, stderr })
    }

    /// 将命令作为子进程执行，等待其完成并收集其状态。
    /// 返回将要传递给程序的参数迭代器。
    ///
    /// 默认情况下，标准输入、标准输出和标准错误会从父进程继承。
    ///
    /// # 错误
    ///
    /// Like [`spawn`], this method returns an [`io::Error`] if the child
    /// process could not be spawned; see [`spawn`] for the common reasons. It
    /// may also return an error if waiting on the child fails.
    ///
    /// 注意，如果子进程运行后未能成功退出或被信号终止，此方法不会返回错误。在这种情况下，
    /// then exits unsuccessfully, or is terminated by a signal. In those cases
    /// it still returns [`Ok`], and the outcome is reflected in the returned
    /// [`ExitStatus`].
    ///
    /// [`spawn`]: Command::spawn
    ///
    /// # Examples
    ///
    /// ```should_panic
    /// use std::process::Command;
    ///
    /// let status = Command::new("/bin/cat")
    ///     .arg("file.txt")
    ///     .status()
    ///     .expect("process should execute successfully");
    ///
    /// println!("process finished with: {status}");
    ///
    /// assert!(status.success());
    /// ```
    #[stable(feature = "process", since = "1.0.0")]
    pub fn status(&mut self) -> io::Result<ExitStatus> {
        imp::status(&mut self.inner).map(ExitStatus)
    }

    /// Returns the path to the program that was given to [`Command::new`].
    ///
    /// # 示例
    ///
    /// ```
    /// use std::process::Command;
    ///
    /// let cmd = Command::new("echo");
    /// assert_eq!(cmd.get_program(), "echo");
    /// ```
    #[must_use]
    #[stable(feature = "command_access", since = "1.57.0")]
    pub fn get_program(&self) -> &OsStr {
        self.inner.get_program()
    }

    /// 返回将传递给程序的参数迭代器。
    ///
    /// This does not include the path to the program as the first argument;
    /// it only includes the arguments specified with [`Command::arg`] and
    /// [`Command::args`].
    ///
    /// # 示例
    ///
    /// ```
    /// use std::ffi::OsStr;
    /// use std::process::Command;
    ///
    /// let mut cmd = Command::new("echo");
    /// cmd.arg("first").arg("second");
    /// let args: Vec<&OsStr> = cmd.get_args().collect();
    /// assert_eq!(args, &["first", "second"]);
    /// ```
    #[stable(feature = "command_access", since = "1.57.0")]
    pub fn get_args(&self) -> CommandArgs<'_> {
        CommandArgs { inner: self.inner.get_args() }
    }

    /// 返回为子进程明确设置的环境变量迭代器。
    ///
    /// Environment variables explicitly set using [`Command::env`], [`Command::envs`], and
    /// [`Command::env_remove`] can be retrieved with this method.
    ///
    /// 注意，此输出不包括从父进程继承的环境变量。要查看完整的环境变量列表，包括从父进程继承的变量，请参见
    /// process. To see the full list of environment variables, including those inherited from the
    /// parent process, use [`Command::get_resolved_envs`].
    ///
    /// Each element is a tuple key/value pair `(&OsStr, Option<&OsStr>)`. A [`None`] value
    /// indicates its key was explicitly removed via [`Command::env_remove`]. The associated key for
    /// the [`None`] value will no longer inherit from its parent process.
    ///
    /// 空迭代器可以表示没有添加明确的映射，或者
    /// [`Command::env_clear`] was called. After calling [`Command::env_clear`], the child process
    /// 不会从父进程继承任何环境变量。
    ///
    /// # 示例
    ///
    /// ```
    /// # if cfg!(all(windows, skip_unsupported_miri_tests)) { return; }
    /// use std::ffi::OsStr;
    /// use std::process::Command;
    ///
    /// let mut cmd = Command::new("ls");
    /// cmd.env("TERM", "dumb").env_remove("TZ");
    /// let envs: Vec<(&OsStr, Option<&OsStr>)> = cmd.get_envs().collect();
    /// assert_eq!(envs, &[
    ///     (OsStr::new("TERM"), Some(OsStr::new("dumb"))),
    ///     (OsStr::new("TZ"), None)
    /// ]);
    /// ```
    #[stable(feature = "command_access", since = "1.57.0")]
    pub fn get_envs(&self) -> CommandEnvs<'_> {
        CommandEnvs { iter: self.inner.get_envs() }
    }

    /// 返回一个迭代器，包含进程启动时将被设置的环境变量。
    ///
    /// 此函数返回在调用时执行命令时的环境状态。返回的环境中包含：
    /// this method. The returned environment includes:
    /// - All inherited environment variables from the parent process (unless [`Command::env_clear`] was called)
    /// - All environment variables explicitly set via [`Command::env`] or [`Command::envs`]
    /// - Excluding any environment variables removed via [`Command::env_remove`]
    ///
    /// 请注意，返回的環境是该方法调用时的快照，不会反映
    /// reflect any subsequent changes to the `Command` or the parent process's environment. Additionally,
    /// it will not reflect changes made in a `pre_exec` hook (on Unix platforms).
    ///
    /// Each element is a tuple `(OsString, OsString)` representing an environment variable key and value.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(command_resolved_envs)]
    /// # if cfg!(all(windows, skip_unsupported_miri_tests)) { return; }
    /// use std::process::Command;
    /// use std::ffi::{OsString, OsStr};
    /// use std::env;
    /// use std::collections::HashMap;
    ///
    /// let mut cmd = Command::new("ls");
    /// cmd.env("TZ", "UTC");
    /// unsafe { env::set_var("EDITOR", "vim"); }
    ///
    /// let resolved: HashMap<OsString, OsString> = cmd.get_resolved_envs().collect();
    /// assert_eq!(resolved.get(OsStr::new("TZ")), Some(&OsString::from("UTC")));
    /// assert_eq!(resolved.get(OsStr::new("EDITOR")), Some(&OsString::from("vim")));
    /// ```
    #[unstable(feature = "command_resolved_envs", issue = "149070")]
    pub fn get_resolved_envs(&self) -> CommandResolvedEnvs {
        self.inner.get_resolved_envs()
    }

    /// 返回子进程的工作目录。
    ///
    /// This returns [`None`] if the working directory will not be changed.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::path::Path;
    /// use std::process::Command;
    ///
    /// let mut cmd = Command::new("ls");
    /// assert_eq!(cmd.get_current_dir(), None);
    /// cmd.current_dir("/bin");
    /// assert_eq!(cmd.get_current_dir(), Some(Path::new("/bin")));
    /// ```
    #[must_use]
    #[stable(feature = "command_access", since = "1.57.0")]
    pub fn get_current_dir(&self) -> Option<&Path> {
        self.inner.get_current_dir()
    }

    /// 返回环境是否将为子进程清空。
    ///
    /// This returns `true` if [`Command::env_clear`] was called, and `false` otherwise.
    /// When `true`, the child process will not inherit any environment variables from
    /// 父进程的任何环境变量。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(command_resolved_envs)]
    /// use std::process::Command;
    ///
    /// let mut cmd = Command::new("ls");
    /// assert_eq!(cmd.get_env_clear(), false);
    ///
    /// cmd.env_clear();
    /// assert_eq!(cmd.get_env_clear(), true);
    /// ```
    #[must_use]
    #[unstable(feature = "command_resolved_envs", issue = "149070")]
    pub fn get_env_clear(&self) -> bool {
        self.inner.get_env_clear()
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl fmt::Debug for Command {
    /// 格式化 Command 程序和参数以便显示。任何
    /// 非 UTF-8 数据要么被转义，要么使用
    /// [UTF-8 替换字符] 进行损失性转换。
    ///
    /// 默认格式近似于程序及其参数的 shell 调用形式。它不包括大多数其他命令属性。输出不可保证有效
    /// （例如，由于缺乏 shell 转义或路径解析差异）。
    /// 在某些平台上，可以使用 [替代语法] 显示更多字段。
    /// 这是关于命令参数的迭代器。
    ///
    /// 请注意，调试实现是特定于平台的。
    ///
    /// [the alternate syntax]: fmt#sign0
    /// [utf8 replacement character]: char::REPLACEMENT_CHARACTER
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.inner.fmt(f)
    }
}

impl AsInner<imp::Command> for Command {
    #[inline]
    fn as_inner(&self) -> &imp::Command {
        &self.inner
    }
}

impl AsInnerMut<imp::Command> for Command {
    #[inline]
    fn as_inner_mut(&mut self) -> &mut imp::Command {
        &mut self.inner
    }
}

/// 关于命令参数的迭代器。
///
/// This struct is created by [`Command::get_args`]. See its documentation for
/// ...
#[must_use = "iterators are lazy and do nothing unless consumed"]
#[stable(feature = "command_access", since = "1.57.0")]
#[derive(Debug)]
pub struct CommandArgs<'a> {
    inner: imp::CommandArgs<'a>,
}

#[stable(feature = "command_access", since = "1.57.0")]
impl<'a> Iterator for CommandArgs<'a> {
    type Item = &'a OsStr;
    fn next(&mut self) -> Option<&'a OsStr> {
        self.inner.next()
    }
    fn size_hint(&self) -> (usize, Option<usize>) {
        self.inner.size_hint()
    }
}

#[stable(feature = "command_access", since = "1.57.0")]
impl<'a> ExactSizeIterator for CommandArgs<'a> {
    fn len(&self) -> usize {
        self.inner.len()
    }
    fn is_empty(&self) -> bool {
        self.inner.is_empty()
    }
}

const fn assert_send<T: core::marker::Send>() {}
const fn assert_sync<T: core::marker::Sync>() {}

const _: () = assert_send::<CommandArgs<'static>>();
const _: () = assert_sync::<CommandArgs<'static>>();

/// 关于命令环境变量的迭代器。
///
/// 该结构体由 ... 创建。
/// [`Command::get_envs`][crate::process::Command::get_envs]. See its
/// ...
#[must_use = "iterators are lazy and do nothing unless consumed"]
#[stable(feature = "command_access", since = "1.57.0")]
pub struct CommandEnvs<'a> {
    iter: imp::CommandEnvs<'a>,
}

#[stable(feature = "command_access", since = "1.57.0")]
impl<'a> Iterator for CommandEnvs<'a> {
    type Item = (&'a OsStr, Option<&'a OsStr>);

    fn next(&mut self) -> Option<Self::Item> {
        self.iter.next()
    }

    fn size_hint(&self) -> (usize, Option<usize>) {
        self.iter.size_hint()
    }
}

#[stable(feature = "command_access", since = "1.57.0")]
impl<'a> ExactSizeIterator for CommandEnvs<'a> {
    fn len(&self) -> usize {
        self.iter.len()
    }

    fn is_empty(&self) -> bool {
        self.iter.is_empty()
    }
}

#[stable(feature = "command_access", since = "1.57.0")]
impl<'a> fmt::Debug for CommandEnvs<'a> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.iter.fmt(f)
    }
}

#[unstable(feature = "command_resolved_envs", issue = "149070")]
pub use imp::CommandResolvedEnvs;

/// 已完成进程的输出结果。
///
/// This is returned in a Result by either the [`output`] method of a
/// [`Command`], or the [`wait_with_output`] method of a [`Child`]
/// 进程。
///
/// [`output`]: Command::output
/// [`wait_with_output`]: Child::wait_with_output
#[derive(PartialEq, Eq, Clone)]
#[stable(feature = "process", since = "1.0.0")]
pub struct Output {
    /// 进程的状态（退出码）。
    #[stable(feature = "process", since = "1.0.0")]
    pub status: ExitStatus,
    /// 进程写入标准输出的数据。
    #[stable(feature = "process", since = "1.0.0")]
    pub stdout: Vec<u8>,
    /// 进程写入标准错误输出的数据。
    #[stable(feature = "process", since = "1.0.0")]
    pub stderr: Vec<u8>,
}

impl Output {
    /// 如果收到非零的退出状态，则返回错误。
    ///
    /// If the [`Command`] exited successfully,
    /// `self` is returned.
    ///
    /// This is equivalent to calling [`exit_ok`](ExitStatus::exit_ok)
    /// on [`Output.status`](Output::status).
    ///
    /// Note that this will throw away the [`Output::stderr`] field in the error case.
    /// 如果子进程向标准错误输出有用的信息，你可以：
    /// * Use `cmd.stderr(Stdio::inherit())` to forward the
    /// 子进程的标准错误输出转发到父进程的标准错误，
    /// 通常将其打印到控制台，以便用户查看。
    /// 对于命令行应用程序来说，这是正确的做法。
    /// * Capture `stderr` using a custom error type.
    /// 对于库来说，这也是正确的做法。
    ///
    /// # 示例
    ///
    /// ```
    /// # #![allow(unused_features)]
    /// #![feature(exit_status_error)]
    /// # #[cfg(all(unix, not(target_os = "android"), not(all(target_vendor = "apple", not(target_os = "macos"))), not(skip_unsupported_miri_tests)))] {
    /// use std::process::Command;
    /// assert!(Command::new("false").output().unwrap().exit_ok().is_err());
    /// # }
    /// ```
    #[unstable(feature = "exit_status_error", issue = "84908")]
    pub fn exit_ok(self) -> Result<Self, ExitStatusError> {
        self.status.exit_ok()?;
        Ok(self)
    }
}

// If either stderr or stdout are valid utf8 strings it prints the valid
// strings, otherwise it prints the byte sequence instead
#[stable(feature = "process_output_debug", since = "1.7.0")]
impl fmt::Debug for Output {
    fn fmt(&self, fmt: &mut fmt::Formatter<'_>) -> fmt::Result {
        let stdout_utf8 = str::from_utf8(&self.stdout);
        let stdout_debug: &dyn fmt::Debug = match stdout_utf8 {
            Ok(ref s) => s,
            Err(_) => &self.stdout,
        };

        let stderr_utf8 = str::from_utf8(&self.stderr);
        let stderr_debug: &dyn fmt::Debug = match stderr_utf8 {
            Ok(ref s) => s,
            Err(_) => &self.stderr,
        };

        fmt.debug_struct("Output")
            .field("status", &self.status)
            .field("stdout", stdout_debug)
            .field("stderr", stderr_debug)
            .finish()
    }
}

/// Describes what to do with a standard I/O stream for a child process when
/// passed to the [`stdin`], [`stdout`], and [`stderr`] methods of [`Command`].
///
/// [`stdin`]: Command::stdin
/// [`stdout`]: Command::stdout
/// [`stderr`]: Command::stderr
#[stable(feature = "process", since = "1.0.0")]
pub struct Stdio(imp::Stdio);

impl Stdio {
    /// # 示例
    ///
    /// # 与标准输出一起：
    ///
    /// 与标准输入一起：
    ///
    /// ```no_run
    /// use std::process::{Command, Stdio};
    ///
    /// let output = Command::new("echo")
    ///     .arg("Hello, world!")
    ///     .stdout(Stdio::piped())
    ///     .output()
    ///     .expect("process should execute successfully");
    ///
    /// assert_eq!(String::from_utf8_lossy(&output.stdout), "Hello, world!\n");
    /// // Nothing echoed to console
    /// ```
    ///
    /// 与标准输入一起：
    ///
    /// ```no_run
    /// use std::io::Write;
    /// use std::process::{Command, Stdio};
    ///
    /// let mut child = Command::new("rev")
    ///     .stdin(Stdio::piped())
    ///     .stdout(Stdio::piped())
    ///     .spawn()
    ///     .expect("rev command should start");
    ///
    /// let mut stdin = child.stdin.take().expect("child stdin should be retrievable");
    /// std::thread::spawn(move || {
    ///     stdin.write_all("Hello, world!".as_bytes()).expect("writing to child stdin should succeed");
    /// });
    ///
    /// let output = child.wait_with_output().expect("child stdout should be able to be read");
    /// assert_eq!(String::from_utf8_lossy(&output.stdout), "!dlrow ,olleH");
    /// ```
    ///
    /// 向标准输入写入超过管道缓冲区大小的数据而不同时读取
    /// 标准输出和标准错误可能导致死锁。
    /// 当运行任何不保证在写入超过管道缓冲区大小的输出之前读取完整个标准输入的程序时，就会出现这个问题。
    /// 管道缓冲区的大小因不同的目标而异。
    /// 子进程继承相应的父描述符。
    ///
    #[must_use]
    #[stable(feature = "process", since = "1.0.0")]
    pub fn piped() -> Stdio {
        Stdio(imp::Stdio::MakePipe)
    }

    /// # 示例
    ///
    /// # 与标准输出一起：
    ///
    /// 与标准输入一起：
    ///
    /// ```no_run
    /// use std::process::{Command, Stdio};
    ///
    /// let output = Command::new("echo")
    ///     .arg("Hello, world!")
    ///     .stdout(Stdio::inherit())
    ///     .output()
    ///     .expect("process should execute successfully");
    ///
    /// assert_eq!(String::from_utf8_lossy(&output.stdout), "");
    /// // "Hello, world!" echoed to console
    /// ```
    ///
    /// 与标准输入一起：
    ///
    /// ```no_run
    /// use std::process::{Command, Stdio};
    /// use std::io::{self, Write};
    ///
    /// let output = Command::new("rev")
    ///     .stdin(Stdio::inherit())
    ///     .stdout(Stdio::piped())
    ///     .output()?;
    ///
    /// print!("You piped in the reverse of: ");
    /// io::stdout().write_all(&output.stdout)?;
    /// # io::Result::Ok(())
    /// ```
    #[must_use]
    #[stable(feature = "process", since = "1.0.0")]
    pub fn inherit() -> Stdio {
        Stdio(imp::Stdio::Inherit)
    }

    /// 该流将被忽略。这相当于将
    /// stream to `/dev/null`.
    ///
    /// # 示例
    ///
    /// 与标准输出一起：
    ///
    /// ```no_run
    /// use std::process::{Command, Stdio};
    ///
    /// let output = Command::new("echo")
    ///     .arg("Hello, world!")
    ///     .stdout(Stdio::null())
    ///     .output()
    ///     .expect("process should execute successfully");
    ///
    /// assert_eq!(String::from_utf8_lossy(&output.stdout), "");
    /// // Nothing echoed to console
    /// ```
    ///
    /// 与标准输入一起：
    ///
    /// ```no_run
    /// use std::process::{Command, Stdio};
    ///
    /// let output = Command::new("rev")
    ///     .stdin(Stdio::null())
    ///     .stdout(Stdio::piped())
    ///     .output()
    ///     .expect("process should execute successfully");
    ///
    /// assert_eq!(String::from_utf8_lossy(&output.stdout), "");
    /// // Ignores any piped-in input
    /// ```
    #[must_use]
    #[stable(feature = "process", since = "1.0.0")]
    pub fn null() -> Stdio {
        Stdio(imp::Stdio::Null)
    }

    /// Returns `true` if this requires [`Command`] to create a new pipe.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(stdio_makes_pipe)]
    /// use std::process::Stdio;
    ///
    /// let io = Stdio::piped();
    /// assert_eq!(io.makes_pipe(), true);
    /// ```
    #[unstable(feature = "stdio_makes_pipe", issue = "98288")]
    pub fn makes_pipe(&self) -> bool {
        matches!(self.0, imp::Stdio::MakePipe)
    }
}

impl FromInner<imp::Stdio> for Stdio {
    fn from_inner(inner: imp::Stdio) -> Stdio {
        Stdio(inner)
    }
}

#[stable(feature = "std_debug", since = "1.16.0")]
impl fmt::Debug for Stdio {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Stdio").finish_non_exhaustive()
    }
}

#[stable(feature = "stdio_from", since = "1.20.0")]
impl From<ChildStdin> for Stdio {
    /// Converts a [`ChildStdin`] into a [`Stdio`].
    ///
    /// # 示例
    ///
    /// `ChildStdin` will be converted to `Stdio` using `Stdio::from` under the hood.
    ///
    /// ```rust,no_run
    /// use std::process::{Command, Stdio};
    ///
    /// let reverse = Command::new("rev")
    ///     .stdin(Stdio::piped())
    ///     .spawn()
    ///     .expect("rev command should start");
    ///
    /// let _echo = Command::new("echo")
    ///     .arg("Hello, world!")
    ///     .stdout(reverse.stdin.unwrap()) // Converted into a Stdio here
    ///     .output()
    ///     .expect("echo command should execute successfully");
    ///
    /// // "!dlrow ,olleH" echoed to console
    /// ```
    fn from(child: ChildStdin) -> Stdio {
        Stdio::from_inner(child.into_inner().into())
    }
}

#[stable(feature = "stdio_from", since = "1.20.0")]
impl From<ChildStdout> for Stdio {
    /// Converts a [`ChildStdout`] into a [`Stdio`].
    ///
    /// # 示例
    ///
    /// `ChildStdout` will be converted to `Stdio` using `Stdio::from` under the hood.
    ///
    /// ```rust,no_run
    /// use std::process::{Command, Stdio};
    ///
    /// let hello = Command::new("echo")
    ///     .arg("Hello, world!")
    ///     .stdout(Stdio::piped())
    ///     .spawn()
    ///     .expect("echo command should start");
    ///
    /// let reverse = Command::new("rev")
    ///     .stdin(hello.stdout.unwrap())  // Converted into a Stdio here
    ///     .output()
    ///     .expect("rev command should execute successfully");
    ///
    /// assert_eq!(reverse.stdout, b"!dlrow ,olleH\n");
    /// ```
    fn from(child: ChildStdout) -> Stdio {
        Stdio::from_inner(child.into_inner().into())
    }
}

#[stable(feature = "stdio_from", since = "1.20.0")]
impl From<ChildStderr> for Stdio {
    /// Converts a [`ChildStderr`] into a [`Stdio`].
    ///
    /// # 示例
    ///
    /// ```rust,no_run
    /// use std::process::{Command, Stdio};
    ///
    /// let reverse = Command::new("rev")
    ///     .arg("non_existing_file.txt")
    ///     .stderr(Stdio::piped())
    ///     .spawn()
    ///     .expect("rev command should start");
    ///
    /// let cat = Command::new("cat")
    ///     .arg("-")
    ///     .stdin(reverse.stderr.unwrap()) // Converted into a Stdio here
    ///     .output()
    ///     .expect("cat command should execute successfully");
    ///
    /// assert_eq!(
    ///     String::from_utf8_lossy(&cat.stdout),
    ///     "rev: cannot open non_existing_file.txt: No such file or directory\n"
    /// );
    /// ```
    fn from(child: ChildStderr) -> Stdio {
        Stdio::from_inner(child.into_inner().into())
    }
}

#[stable(feature = "stdio_from", since = "1.20.0")]
impl From<fs::File> for Stdio {
    /// Converts a [`File`](fs::File) into a [`Stdio`].
    ///
    /// # 示例
    ///
    /// `File` will be converted to `Stdio` using `Stdio::from` under the hood.
    ///
    /// ```rust,no_run
    /// use std::fs::File;
    /// use std::process::Command;
    ///
    /// // With the `foo.txt` file containing "Hello, world!"
    /// let file = File::open("foo.txt")?;
    ///
    /// let reverse = Command::new("rev")
    ///     .stdin(file)  // Implicit File conversion into a Stdio
    ///     .output()?;
    ///
    /// assert_eq!(reverse.stdout, b"!dlrow ,olleH");
    /// # std::io::Result::Ok(())
    /// ```
    fn from(file: fs::File) -> Stdio {
        Stdio::from_inner(file.into_inner().into())
    }
}

#[stable(feature = "stdio_from_stdio", since = "1.74.0")]
impl From<io::Stdout> for Stdio {
    /// 将命令的标准输出/标准错误重定向到我们的标准输出。
    ///
    /// # 示例
    ///
    /// ```rust
    /// #![feature(exit_status_error)]
    /// use std::io;
    /// use std::process::Command;
    ///
    /// # fn test() -> Result<(), Box<dyn std::error::Error>> {
    /// let output = Command::new("whoami")
    // "whoami" is a command which exists on both Unix and Windows,
    // and which succeeds, producing some stdout output but no stderr.
    ///     .stdout(io::stdout())
    ///     .output()?;
    /// output.status.exit_ok()?;
    /// assert!(output.stdout.is_empty());
    /// # Ok(())
    /// # }
    /// #
    /// # if cfg!(all(unix, not(target_os = "android"), not(all(target_vendor = "apple", not(target_os = "macos"))), not(skip_unsupported_miri_tests))) {
    /// #     test().unwrap();
    /// # }
    /// ```
    fn from(inherit: io::Stdout) -> Stdio {
        Stdio::from_inner(inherit.into())
    }
}

#[stable(feature = "stdio_from_stdio", since = "1.74.0")]
impl From<io::Stderr> for Stdio {
    /// 将命令的标准输出/标准错误重定向到我们的标准错误。
    ///
    /// # 示例
    ///
    /// ```rust
    /// #![feature(exit_status_error)]
    /// use std::io;
    /// use std::process::Command;
    ///
    /// # fn test() -> Result<(), Box<dyn std::error::Error>> {
    /// let output = Command::new("whoami")
    ///     .stdout(io::stderr())
    ///     .output()?;
    /// output.status.exit_ok()?;
    /// assert!(output.stdout.is_empty());
    /// # Ok(())
    /// # }
    /// #
    /// # if cfg!(all(unix, not(target_os = "android"), not(all(target_vendor = "apple", not(target_os = "macos"))), not(skip_unsupported_miri_tests))) {
    /// #     test().unwrap();
    /// # }
    /// ```
    fn from(inherit: io::Stderr) -> Stdio {
        Stdio::from_inner(inherit.into())
    }
}

#[stable(feature = "anonymous_pipe", since = "1.87.0")]
impl From<io::PipeWriter> for Stdio {
    fn from(pipe: io::PipeWriter) -> Self {
        Stdio::from_inner(pipe.into_inner().into())
    }
}

#[stable(feature = "anonymous_pipe", since = "1.87.0")]
impl From<io::PipeReader> for Stdio {
    fn from(pipe: io::PipeReader) -> Self {
        Stdio::from_inner(pipe.into_inner().into())
    }
}

/// 描述了进程终止后的结果。
///
/// This `struct` is used to represent the exit status or other termination of a child process.
/// Child processes are created via the [`Command`] struct and their exit
/// status is exposed through the [`status`] method, or the [`wait`] method
/// of a [`Child`] process.
///
/// An `ExitStatus` represents every possible disposition of a process.  On Unix this
/// is the **wait status**.  It is *not* simply an *exit status* (a value passed to `exit`).
///
/// For proper error reporting of failed processes, print the value of `ExitStatus` or
/// `ExitStatusError` using their implementations of [`Display`](crate::fmt::Display).
///
/// # Differences from `ExitCode`
///
/// [`ExitCode`] is intended for terminating the currently running process, via
/// the `Termination` trait, in contrast to `ExitStatus`, which represents the
/// termination of a child process. These APIs are separate due to platform
/// compatibility differences and their expected usage; it is not generally
/// possible to exactly reproduce an `ExitStatus` from a child for the current
/// process after the fact.
///
/// [`status`]: Command::status
/// [`wait`]: Child::wait
//
// We speak slightly loosely (here and in various other places in the stdlib docs) about `exit`
// vs `_exit`.  Naming of Unix system calls is not standardised across Unices, so terminology is a
// matter of convention and tradition.  For clarity we usually speak of `exit`, even when we might
// mean an underlying system call such as `_exit`.
#[derive(PartialEq, Eq, Clone, Copy, Debug)]
#[stable(feature = "process", since = "1.0.0")]
pub struct ExitStatus(imp::ExitStatus);

/// # 示例
#[stable(feature = "process_exitstatus_default", since = "1.73.0")]
impl Default for ExitStatus {
    fn default() -> Self {
        // Ideally this would be done by ExitCode::default().into() but that is complicated.
        ExitStatus::from_inner(imp::ExitStatus::default())
    }
}

impl ExitStatus {
    /// Was termination successful?  Returns a `Result`.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(exit_status_error)]
    /// # if cfg!(all(unix, not(all(target_vendor = "apple", not(target_os = "macos"))), not(skip_unsupported_miri_tests))) {
    /// use std::process::Command;
    ///
    /// let status = Command::new("ls")
    ///     .arg("/dev/nonexistent")
    ///     .status()
    ///     .expect("ls command should execute successfully");
    ///
    /// println!("ls: {status}");
    /// status.exit_ok().expect_err("/dev/nonexistent could be listed!");
    /// # } // cfg!(unix)
    /// ```
    #[unstable(feature = "exit_status_error", issue = "84908")]
    pub fn exit_ok(&self) -> Result<(), ExitStatusError> {
        self.0.exit_ok().map_err(ExitStatusError)
    }

    /// 终止是否成功？信号终止不被视为成功，而成功则定义为零退出状态。
    /// success, and success is defined as a zero exit status.
    ///
    /// # 示例
    ///
    /// ```rust,no_run
    /// use std::process::Command;
    ///
    /// let status = Command::new("mkdir")
    ///     .arg("projects")
    ///     .status()
    ///     .expect("mkdir command should execute successfully");
    ///
    /// if status.success() {
    ///     println!("'projects/' directory created");
    /// } else {
    ///     println!("failed to create 'projects/' directory: {status}");
    /// }
    /// ```
    #[must_use]
    #[stable(feature = "process", since = "1.0.0")]
    pub fn success(&self) -> bool {
        self.0.exit_ok().is_ok()
    }

    /// 返回进程的退出码（如果有的话）。
    ///
    /// In Unix terms the return value is the **exit status**: the value passed to `exit`, if the
    /// process finished by calling `exit`.  Note that on Unix the exit status is truncated to 8
    /// bits, and that values that didn't come from a program's call to `exit` may be invented by the
    /// runtime system (often, for example, 255, 254, 127 or 126).
    ///
    /// On Unix, this will return `None` if the process was terminated by a signal.
    /// [`ExitStatusExt`](crate::os::unix::process::ExitStatusExt) is an
    /// extension trait for extracting any such signal, and other details, from the `ExitStatus`.
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::process::Command;
    ///
    /// let status = Command::new("mkdir")
    ///     .arg("projects")
    ///     .status()
    ///     .expect("mkdir command should execute successfully");
    ///
    /// match status.code() {
    ///     Some(code) => println!("Exited with status code: {code}"),
    ///     None => println!("Process terminated by signal")
    /// }
    /// ```
    #[must_use]
    #[stable(feature = "process", since = "1.0.0")]
    pub fn code(&self) -> Option<i32> {
        self.0.code()
    }
}

impl AsInner<imp::ExitStatus> for ExitStatus {
    #[inline]
    fn as_inner(&self) -> &imp::ExitStatus {
        &self.0
    }
}

impl FromInner<imp::ExitStatus> for ExitStatus {
    fn from_inner(s: imp::ExitStatus) -> ExitStatus {
        ExitStatus(s)
    }
}

#[stable(feature = "process", since = "1.0.0")]
impl fmt::Display for ExitStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.0.fmt(f)
    }
}

/// 描述了进程失败后的结果。
///
/// Produced by the [`.exit_ok`](ExitStatus::exit_ok) method on [`ExitStatus`].
///
/// # 示例
///
/// ```
/// #![feature(exit_status_error)]
/// # if cfg!(all(unix, not(target_os = "android"), not(all(target_vendor = "apple", not(target_os = "macos"))), not(skip_unsupported_miri_tests))) {
/// use std::process::{Command, ExitStatusError};
///
/// fn run(cmd: &str) -> Result<(), ExitStatusError> {
///     Command::new(cmd).status().unwrap().exit_ok()?;
///     Ok(())
/// }
///
/// run("true").unwrap();
/// run("false").unwrap_err();
/// # } // cfg!(unix)
/// ```
#[derive(PartialEq, Eq, Clone, Copy, Debug)]
#[unstable(feature = "exit_status_error", issue = "84908")]
// The definition of imp::ExitStatusError should ideally be such that
// Result<(), imp::ExitStatusError> has an identical representation to imp::ExitStatus.
pub struct ExitStatusError(imp::ExitStatusError);

#[unstable(feature = "exit_status_error", issue = "84908")]
#[doc(test(attr(allow(unused_features))))]
impl ExitStatusError {
    /// Reports the exit code, if applicable, from an `ExitStatusError`.
    ///
    /// In Unix terms the return value is the **exit status**: the value passed to `exit`, if the
    /// process finished by calling `exit`.  Note that on Unix the exit status is truncated to 8
    /// bits, and that values that didn't come from a program's call to `exit` may be invented by the
    /// 特别处理这种情况，可以考虑使用以下方法
    ///
    /// On Unix, this will return `None` if the process was terminated by a signal.  If you want to
    /// 该退出状态。
    /// [`ExitStatusExt`](crate::os::unix::process::ExitStatusExt).
    ///
    /// If the process finished by calling `exit` with a nonzero value, this will return
    /// that exit status.
    ///
    /// If the error was something else, it will return `None`.
    ///
    /// If the process exited successfully (ie, by calling `exit(0)`), there is no
    /// `ExitStatusError`.  So the return value from `ExitStatusError::code()` is always nonzero.
    ///
    /// # Examples
    ///
    /// ```
    /// #![feature(exit_status_error)]
    /// # #[cfg(all(unix, not(target_os = "android"), not(all(target_vendor = "apple", not(target_os = "macos"))), not(skip_unsupported_miri_tests)))] {
    /// use std::process::Command;
    ///
    /// let bad = Command::new("false").status().unwrap().exit_ok().unwrap_err();
    /// assert_eq!(bad.code(), Some(1));
    /// # } // #[cfg(unix)]
    /// ```
    #[must_use]
    pub fn code(&self) -> Option<i32> {
        self.code_nonzero().map(Into::into)
    }

    /// Reports the exit code, if applicable, from an `ExitStatusError`, as a [`NonZero`].
    ///
    /// This is exactly like [`code()`](Self::code), except that it returns a <code>[NonZero]<[i32]></code>.
    ///
    /// Plain `code`, returning a plain integer, is provided because it is often more convenient.
    /// The returned value from `code()` is indeed also nonzero; use `code_nonzero()` when you want
    /// a type-level guarantee of nonzeroness.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(exit_status_error)]
    ///
    /// # if cfg!(all(unix, not(target_os = "android"), not(all(target_vendor = "apple", not(target_os = "macos"))), not(skip_unsupported_miri_tests))) {
    /// use std::num::NonZero;
    /// use std::process::Command;
    ///
    /// let bad = Command::new("false").status().unwrap().exit_ok().unwrap_err();
    /// assert_eq!(bad.code_nonzero().unwrap(), NonZero::new(1).unwrap());
    /// # } // cfg!(unix)
    /// ```
    #[must_use]
    pub fn code_nonzero(&self) -> Option<NonZero<i32>> {
        self.0.code()
    }

    /// Converts an `ExitStatusError` (back) to an `ExitStatus`.
    #[must_use]
    pub fn into_status(&self) -> ExitStatus {
        ExitStatus(self.0.into())
    }
}

#[unstable(feature = "exit_status_error", issue = "84908")]
impl From<ExitStatusError> for ExitStatus {
    fn from(error: ExitStatusError) -> Self {
        Self(error.0.into())
    }
}

#[unstable(feature = "exit_status_error", issue = "84908")]
impl fmt::Display for ExitStatusError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "process exited unsuccessfully: {}", self.into_status())
    }
}

#[unstable(feature = "exit_status_error", issue = "84908")]
impl crate::error::Error for ExitStatusError {}

/// 这种类型表示当前进程在正常终止时可以向其父进程返回的状态代码。
/// 
///
/// `ExitCode` is intended to be consumed only by the standard library (via
/// [`Termination::report()`]). For forwards compatibility with potentially
/// unusual targets, this type currently does not provide `Eq`, `Hash`, or
/// access to the raw value. This type does provide `PartialEq` for
/// 退出代码，以及用于构建其他
/// codes, some of which will _not_ compare equal to `ExitCode::FAILURE`.
/// The standard library provides the canonical `SUCCESS` and `FAILURE`
/// exit codes as well as `From<u8> for ExitCode` for constructing other
/// 退出代码。
///
/// # 可移植性
///
/// 此类型中使用的数值具有不可移植的含义，并且
/// 不同平台可能掩盖其中的不同量。
///
/// 关于平台的标准成功和失败代码，请参阅
/// the [`SUCCESS`] and [`FAILURE`] associated items.
///
/// [`SUCCESS`]: ExitCode::SUCCESS
/// [`FAILURE`]: ExitCode::FAILURE
///
/// # Differences from `ExitStatus`
///
/// `ExitCode` is intended for terminating the currently running process, via
/// the `Termination` trait, in contrast to [`ExitStatus`], which represents the
/// 子进程的终止。由于平台兼容性问题及其预期使用方式不同，这些 API 是独立的；通常
/// compatibility differences and their expected usage; it is not generally
/// possible to exactly reproduce an `ExitStatus` from a child for the current
/// # 示例
///
/// # 示例
///
/// `ExitCode` can be returned from the `main` function of a crate, as it implements
/// [`Termination`]:
///
/// ```
/// use std::process::ExitCode;
/// # fn check_foo() -> bool { true }
///
/// fn main() -> ExitCode {
///     if !check_foo() {
///         return ExitCode::from(42);
///     }
///
///     ExitCode::SUCCESS
/// }
/// ```
#[derive(Clone, Copy, Debug, PartialEq)]
#[stable(feature = "process_exitcode", since = "1.61.0")]
#[must_use]
pub struct ExitCode(imp::ExitCode);

#[stable(feature = "process_exitcode", since = "1.61.0")]
impl ExitCode {
    /// The canonical `ExitCode` for successful termination on this platform.
    ///
    /// Note that a `()`-returning `main` implicitly results in a successful
    /// termination, so there's no need to return this from `main` unless
    /// you're also returning other possible codes.
    #[stable(feature = "process_exitcode", since = "1.61.0")]
    pub const SUCCESS: ExitCode = ExitCode(imp::ExitCode::SUCCESS);

    /// The canonical `ExitCode` for unsuccessful termination on this platform.
    ///
    /// If you're only returning this and `SUCCESS` from `main`, consider
    /// instead returning `Err(_)` and `Ok(())` respectively, which will
    /// return the same codes (but will also `eprintln!` the error).
    #[stable(feature = "process_exitcode", since = "1.61.0")]
    pub const FAILURE: ExitCode = ExitCode(imp::ExitCode::FAILURE);

    /// Exit the current process with the given `ExitCode`.
    ///
    /// Note that this has the same caveats as [`process::exit()`][exit], namely that this function
    /// terminates the process immediately, so no destructors on the current stack or any other
    /// thread's stack will be run. Also see those docs for some important notes on interop with C
    /// code. If a clean shutdown is needed, it is recommended to simply return this ExitCode from
    /// the `main` function, as demonstrated in the [type documentation](#examples).
    ///
    /// # Differences from `process::exit()`
    ///
    /// `process::exit()` accepts any `i32` value as the exit code for the process; however, there
    /// are platforms that only use a subset of that value (see [`process::exit` platform-specific
    /// behavior][exit#platform-specific-behavior]). `ExitCode` exists because of this; only
    /// `ExitCode`s that are supported by a majority of our platforms can be created, so those
    /// problems don't exist (as much) with this method.
    ///
    /// # Examples
    ///
    /// ```
    /// #![feature(exitcode_exit_method)]
    /// # use std::process::ExitCode;
    /// # use std::fmt;
    /// # enum UhOhError { GenericProblem, Specific, WithCode { exit_code: ExitCode, _x: () } }
    /// # impl fmt::Display for UhOhError {
    /// #     fn fmt(&self, _: &mut fmt::Formatter<'_>) -> fmt::Result { unimplemented!() }
    /// # }
    /// // there's no way to gracefully recover from an UhOhError, so we just
    /// // print a message and exit
    /// fn handle_unrecoverable_error(err: UhOhError) -> ! {
    ///     eprintln!("UH OH! {err}");
    ///     let code = match err {
    ///         UhOhError::GenericProblem => ExitCode::FAILURE,
    ///         UhOhError::Specific => ExitCode::from(3),
    ///         UhOhError::WithCode { exit_code, .. } => exit_code,
    ///     };
    ///     code.exit_process()
    /// }
    /// ```
    #[unstable(feature = "exitcode_exit_method", issue = "97100")]
    pub fn exit_process(self) -> ! {
        exit(self.to_i32())
    }
}

impl ExitCode {
    // This is private/perma-unstable because ExitCode is opaque; we don't know that i32 will serve
    // all usecases, for example windows seems to use u32, unix uses the 8-15th bits of an i32, we
    // likely want to isolate users anything that could restrict the platform specific
    // representation of an ExitCode
    //
    // More info: https://internals.rust-lang.org/t/mini-pre-rfc-redesigning-process-exitstatus/5426
    /// Converts an `ExitCode` into an i32
    #[unstable(
        feature = "process_exitcode_internals",
        reason = "exposed only for libstd",
        issue = "none"
    )]
    #[inline]
    #[doc(hidden)]
    pub fn to_i32(self) -> i32 {
        self.0.as_i32()
    }
}

/// The default value is [`ExitCode::SUCCESS`]
#[stable(feature = "process_exitcode_default", since = "1.75.0")]
impl Default for ExitCode {
    fn default() -> Self {
        ExitCode::SUCCESS
    }
}

#[stable(feature = "process_exitcode", since = "1.61.0")]
impl From<u8> for ExitCode {
    /// Constructs an `ExitCode` from an arbitrary u8 value.
    fn from(code: u8) -> Self {
        ExitCode(imp::ExitCode::from(code))
    }
}

impl AsInner<imp::ExitCode> for ExitCode {
    #[inline]
    fn as_inner(&self) -> &imp::ExitCode {
        &self.0
    }
}

impl FromInner<imp::ExitCode> for ExitCode {
    fn from_inner(s: imp::ExitCode) -> ExitCode {
        ExitCode(s)
    }
}

impl Child {
    /// Forces the child process to exit. If the child has already exited, `Ok(())`
    /// is returned.
    ///
    /// The mapping to [`ErrorKind`]s is not part of the compatibility contract of the function.
    ///
    /// 这相当于在 Unix 平台上发送 SIGKILL。
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::process::Command;
    ///
    /// let mut command = Command::new("yes");
    /// if let Ok(mut child) = command.spawn() {
    ///     child.kill().expect("process should be killed");
    /// } else {
    ///     println!("yes command didn't start");
    /// }
    /// ```
    ///
    /// [`ErrorKind`]: io::ErrorKind
    /// [`InvalidInput`]: io::ErrorKind::InvalidInput
    #[stable(feature = "process", since = "1.0.0")]
    #[cfg_attr(not(test), rustc_diagnostic_item = "child_kill")]
    pub fn kill(&mut self) -> io::Result<()> {
        self.handle.kill()
    }

    /// 返回与此子进程相关的操作系统分配的进程标识符。
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::process::Command;
    ///
    /// let mut command = Command::new("ls");
    /// if let Ok(child) = command.spawn() {
    ///     println!("Child's ID is {}", child.id());
    /// } else {
    ///     println!("ls command didn't start");
    /// }
    /// ```
    #[must_use]
    #[stable(feature = "process_id", since = "1.3.0")]
    #[cfg_attr(not(test), rustc_diagnostic_item = "child_id")]
    pub fn id(&self) -> u32 {
        self.handle.id()
    }

    /// 等待子进程完全退出，并返回其状态
    /// 退出信息。此函数将继续保持相同的返回值
    /// 在至少被调用一次后
    ///
    /// 如果子进程有标准输入句柄，将在等待前关闭它
    /// 这有助于避免死锁：确保
    /// 子进程不会因等待父进程的输入而阻塞，同时
    /// 父进程等待子进程退出
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::process::Command;
    ///
    /// let mut command = Command::new("ls");
    /// if let Ok(mut child) = command.spawn() {
    ///     child.wait().expect("child should be running");
    ///     println!("Child has finished its execution!");
    /// } else {
    ///     println!("ls command didn't start");
    /// }
    /// ```
    #[stable(feature = "process", since = "1.0.0")]
    pub fn wait(&mut self) -> io::Result<ExitStatus> {
        drop(self.stdin.take());
        self.handle.wait().map(ExitStatus)
    }

    /// 尝试收集子进程的退出状态，如果它已经
    /// 退出了
    ///
    /// 此函数不会阻塞调用线程，仅会
    /// 检查子进程是否已退出。如果子进程已
    /// 退出，则在 Unix 系统下进程 ID 将被回收。此函数
    /// 保证只要子进程已经退出，就会反复返回成功的退出状态
    /// 
    ///
    /// If the child has exited, then `Ok(Some(status))` is returned. If the
    /// exit status is not available at this time then `Ok(None)` is returned.
    /// 如果发生错误，则返回该错误
    ///
    /// Note that unlike `wait`, this function will not attempt to drop stdin.
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::process::Command;
    ///
    /// let mut child = Command::new("ls").spawn()?;
    ///
    /// match child.try_wait() {
    ///     Ok(Some(status)) => println!("exited with: {status}"),
    ///     Ok(None) => {
    ///         println!("status not ready yet, let's really wait");
    ///         let res = child.wait();
    ///         println!("result: {res:?}");
    ///     }
    ///     Err(e) => println!("error attempting to wait: {e}"),
    /// }
    /// # std::io::Result::Ok(())
    /// ```
    #[stable(feature = "process_try_wait", since = "1.18.0")]
    pub fn try_wait(&mut self) -> io::Result<Option<ExitStatus>> {
        Ok(self.handle.try_wait()?.map(ExitStatus))
    }

    /// 同时等待子进程退出并收集所有剩余
    /// output on the stdout/stderr handles, returning an `Output`
    /// 实例。
    ///
    /// 如果子进程有标准输入句柄，将在等待前关闭它
    /// 这有助于避免死锁：确保
    /// 子进程不会因等待父进程的输入而阻塞，同时
    /// 父进程等待子进程退出。
    ///
    /// 默认情况下，标准输入、标准输出和错误输出从父进程继承。
    /// In order to capture the output into this `Result<Output>` it is
    /// necessary to create new pipes between parent and child. Use
    /// `stdout(Stdio::piped())` or `stderr(Stdio::piped())`, respectively.
    ///
    /// # 终止当前进程并指定退出码
    ///
    /// ```should_panic
    /// use std::process::{Command, Stdio};
    ///
    /// let child = Command::new("/bin/cat")
    ///     .arg("file.txt")
    ///     .stdout(Stdio::piped())
    ///     .spawn()
    ///     .expect("child should spawn");
    ///
    /// let output = child
    ///     .wait_with_output()
    ///     .expect("wait_with_output on child should succeed");
    ///
    /// assert!(output.status.success());
    /// ```
    ///
    #[stable(feature = "process", since = "1.0.0")]
    pub fn wait_with_output(mut self) -> io::Result<Output> {
        drop(self.stdin.take());

        let (mut stdout, mut stderr) = (Vec::new(), Vec::new());
        match (self.stdout.take(), self.stderr.take()) {
            (None, None) => {}
            (Some(mut out), None) => {
                let res = out.read_to_end(&mut stdout);
                res.unwrap();
            }
            (None, Some(mut err)) => {
                let res = err.read_to_end(&mut stderr);
                res.unwrap();
            }
            (Some(out), Some(err)) => {
                let res = imp::read_output(out.inner, &mut stdout, err.inner, &mut stderr);
                res.unwrap();
            }
        }

        let status = self.wait()?;
        Ok(Output { status, stdout, stderr })
    }
}

/// 此函数永远不会返回，并将立即终止当前
///
/// 进程。退出码会被传递给底层操作系统，可供其他进程使用
/// 注意，由于此函数从不返回，并且会终止
/// available for consumption by another process.
///
/// Note that because this function never returns, and that it terminates the
/// process, no destructors on the current stack or any other thread's stack
/// will be run. If a clean shutdown is needed it is recommended to only call
/// this function at a known point where there are no more destructors left
/// to run; or, preferably, simply return a type implementing [`Termination`]
/// (such as [`ExitCode`] or `Result`) from the `main` function and avoid this
/// 整个函数：
///
/// ```
/// # use std::io::Error as MyError;
/// fn main() -> Result<(), MyError> {
///     // ...
///     Ok(())
/// }
/// ```
///
/// In its current implementation, this function will execute exit handlers registered with `atexit`
/// as well as other platform-specific exit handlers (e.g. `fini` sections of ELF shared objects).
/// 这意味着 Rust 要求所有退出处理程序在任何时候都能安全执行。特别是，如果退出处理程序清理了可能被其他
/// 线程同时访问的状态，则要求退出处理程序与这些线程进行适当的同步。
/// threads, it is required that the exit handler performs suitable synchronization with those
/// 成为不安全操作是不可能的。)
/// considered undesirable. Note that returning from `main` also calls `exit`, so making `exit` an
/// unsafe operation is not an option.)
///
/// ## 对父进程检查退出代码可见。在大多数
///
/// **Unix**: On Unix-like platforms, it is unlikely that all 32 bits of `exit`
/// will be visible to a parent process inspecting the exit code. On most
/// ：
///
/// For example, the exit code for this example will be `0` on Linux, but `256`
/// on Windows:
///
/// ```no_run
/// use std::process;
///
/// process::exit(0x0100);
/// ```
///
/// ### Safe interop with C code
///
/// On Unix, this function is currently implemented using the `exit` C function [`exit`][C-exit]. As
/// of C23, the C standard does not permit multiple threads to call `exit` concurrently. Rust
/// mitigates this with a lock, but if C code calls `exit`, that can still cause undefined behavior.
/// Note that returning from `main` is equivalent to calling `exit`.
///
/// Therefore, it is undefined behavior to have two concurrent threads perform the following
/// 单个 C 实现可能比标准提供更多的保证并允许并发使用
/// - One thread calls Rust's `exit` function or returns from Rust's `main` function
/// - Another thread calls the C function `exit` or `quick_exit`, or returns from C's `main` function
///
/// Note that if a binary contains multiple copies of the Rust runtime (e.g., when combining
/// multiple `cdylib` or `staticlib`), they each have their own separate lock, so from the
/// perspective of code running in one of the Rust runtimes, the "outside" Rust code is basically C
/// code, and concurrent `exit` again causes undefined behavior.
///
/// Individual C implementations might provide more guarantees than the standard and permit concurrent
/// calls to `exit`; consult the documentation of your C implementation for details.
///
/// For some of the on-going discussion to make `exit` thread-safe in C, see:
/// - [Rust issue #126600](https://github.com/rust-lang/rust/issues/126600)
/// - [Austin Group Bugzilla (for POSIX)](https://austingroupbugs.net/view.php?id=1845)
/// - [GNU C library Bugzilla](https://sourceware.org/bugzilla/show_bug.cgi?id=31997)
///
/// [C-exit]: https://en.cppreference.com/w/c/program/exit
#[stable(feature = "rust1", since = "1.0.0")]
#[cfg_attr(not(test), rustc_diagnostic_item = "process_exit")]
pub fn exit(code: i32) -> ! {
    crate::rt::cleanup();
    crate::sys::exit::exit(code)
}

/// 以异常方式终止进程。
///
/// 该函数永远不会返回，并将立即以特定平台特有的“异常”方式终止当前进程。
/// 由于此原因，
/// 当前栈或任何其他线程的栈中不会运行析构函数。
/// will be run, Rust IO buffers (eg, from `BufWriter`) will not be flushed,
/// 而 C stdio 缓冲区在大多数平台上也不会被刷新。
///
/// This is in contrast to the default behavior of [`panic!`] which unwinds
/// the current thread's stack and calls all destructors.
/// When `panic="abort"` is set, either as an argument to `rustc` or in a
/// crate's Cargo.toml, [`panic!`] and `abort` are similar. However,
/// [`panic!`] will still call the [panic hook] while `abort` will not.
///
/// # 示例
/// this function at a known point where there are no more destructors left
/// 如下例所示：
///
/// The process's termination will be similar to that from the C `abort()`
/// function.  On Unix, the process will terminate with signal `SIGABRT`, which
/// typically means that the shell prints "Aborted".
///
/// # C-main 函数仅支持返回整数。
///
/// ```no_run
/// use std::process;
///
/// fn main() {
///     println!("aborting");
///
///     process::abort();
///
///     // execution never gets here
/// }
/// ```
///
/// The `abort` function terminates the process, so the destructor will not
/// get run on the example below:
///
/// ```no_run
/// use std::process;
///
/// struct HasDrop;
///
/// impl Drop for HasDrop {
///     fn drop(&mut self) {
///         println!("This will never be printed!");
///     }
/// }
///
/// fn main() {
///     let _x = HasDrop;
///     process::abort();
///     // the destructor implemented for HasDrop will never get run
/// }
/// ```
///
/// [panic hook]: crate::panic::set_hook
#[stable(feature = "process_abort", since = "1.17.0")]
#[rustc_const_unstable(feature = "const_abort", issue = "166193")]
#[cold]
#[cfg_attr(not(test), rustc_diagnostic_item = "process_abort")]
#[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
pub const fn abort() -> ! {
    // Some code uses `abort` as a non-unwinding alternative to `panic`. That
    // should work in const, but `sys` code invokes native host functions. So we
    // invoke `intrinsics::crash` instead to safely hard-abort execution.
    intrinsics::const_eval_select((), crash, crate::sys::abort_internal)
}

#[doc(inline)]
#[unstable(feature = "abort_immediate", issue = "154601")]
pub use core::process::crash;
#[doc(inline)]
#[unstable(feature = "breakpoint", issue = "133724")]
pub use core::process::resumable_breakpoint;

/// Returns the OS-assigned process identifier associated with this process.
///
/// # Examples
///
/// ```no_run
/// use std::process;
///
/// println!("My pid is {}", process::id());
/// ```
#[must_use]
#[stable(feature = "getpid", since = "1.26.0")]
pub fn id() -> u32 {
    imp::getpid()
}

/// A trait for implementing arbitrary return types in the `main` function.
///
/// The C-main function only supports returning integers.
/// So, every type implementing the `Termination` trait has to be converted
/// to an integer.
///
/// The default implementations are returning `libc::EXIT_SUCCESS` to indicate
/// a successful execution. In case of a failure, `libc::EXIT_FAILURE` is returned.
///
/// Because different runtimes have different specifications on the return value
/// of the `main` function, this trait is likely to be available only on
/// standard library's runtime for convenience. Other runtimes are not required
/// to provide similar functionality.
#[cfg_attr(not(any(test, doctest)), lang = "termination")]
#[stable(feature = "termination_trait_lib", since = "1.61.0")]
#[rustc_on_unimplemented(on(
    cause = "MainFunctionType",
    message = "`main` has invalid return type `{Self}`",
    label = "`main` can only return types that implement `{this}`"
))]
pub trait Termination {
    /// Converts `self` to an [`ExitCode`] which can be interpreted by the operating system. In the
    /// case of `Result`, this includes "reporting" any errors to the user, ie. writing the
    /// debug-formatted `Err` case to stderr.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::process::{ExitCode, Termination};
    ///
    /// let result: Result<(), &'static str> = Err("uh oh!");
    ///
    /// // Will also print 'Error: "uh oh!"' (including double quotes) to stderr
    /// assert_eq!(ExitCode::FAILURE, result.report());
    /// ```
    #[stable(feature = "termination_trait_lib", since = "1.61.0")]
    fn report(self) -> ExitCode;
}

#[stable(feature = "termination_trait_lib", since = "1.61.0")]
impl Termination for () {
    #[inline]
    fn report(self) -> ExitCode {
        ExitCode::SUCCESS
    }
}

#[stable(feature = "termination_trait_lib", since = "1.61.0")]
impl Termination for ! {
    fn report(self) -> ExitCode {
        self
    }
}

#[stable(feature = "termination_trait_lib", since = "1.61.0")]
impl Termination for ExitCode {
    #[inline]
    fn report(self) -> ExitCode {
        self
    }
}

#[stable(feature = "termination_trait_lib", since = "1.61.0")]
impl<T: Termination, E: fmt::Debug> Termination for Result<T, E> {
    fn report(self) -> ExitCode {
        match self {
            Ok(val) => val.report(),
            Err(err) => {
                io::attempt_print_to_stderr(format_args_nl!("Error: {err:?}"));
                ExitCode::FAILURE
            }
        }
    }
}
