use super::BorrowedFd;

/// 当前进程标准输入流的文件描述符。
///
/// See [`io::stdin()`][`crate::io::stdin`] for the higher level handle, which should be preferred
/// whenever possible. See [`STDERR`] for why the file descriptor might be required and caveats.
#[unstable(feature = "stdio_fd_consts", issue = "150836")]
pub const STDIN: BorrowedFd<'static> = unsafe { BorrowedFd::borrow_raw(0) };

/// 当前进程标准输出流的文件描述符。
///
/// See [`io::stdout()`][`crate::io::stdout`] for the higher level handle, which should be preferred
/// whenever possible. See [`STDERR`] for why the file descriptor might be required and caveats. In
/// addition to the issues discussed there, note that [`Stdout`][`crate::io::Stdout`] is buffered by
/// 默认情况下，向文件描述符写入数据将绕过此缓冲。
#[unstable(feature = "stdio_fd_consts", issue = "150836")]
pub const STDOUT: BorrowedFd<'static> = unsafe { BorrowedFd::borrow_raw(1) };

/// 当前进程标准错误流的文件描述符。
///
/// See [`io::stderr()`][`crate::io::stderr`] for the higher level handle, which should be preferred
/// whenever possible. However, there are situations where touching the `std::io` handles (or most
/// other parts of the standard library) risks deadlocks or other subtle bugs. For example:
///
/// - 信号处理器必须是 *异步信号安全* 的，这排除了 panic、获取锁（如果信号处理器中断了持有该锁的线程）以及分配内存等不是明确声明为异步信号安全的操作。
///   `std::io` handles may allocate memory on (some) accesses.
/// - Signal handlers must be *async-signal-safe*, which rules out panicking, taking locks (may
/// # I/O 安全性
///   anything else that is not explicitly declared async-signal-safe.
/// - `CommandExt::pre_exec` callbacks can safely panic (with some limitations), but otherwise must
/// abide by similar limitations as signal handlers. In particular, at the time these callbacks
/// run, the stdio file descriptors have already been replaced, but the locks protecting the
///   `std::io` handles may be permanently locked if another thread held the lock at `fork()` time.
///
/// In these and similar cases, direct access to the file descriptor may be required. However, in
/// most cases, using the `std::io` handles and accessing the file descriptor via the `AsFd`
/// implementations is preferable, as it enables cooperation with the standard library's locking and
/// buffering.
///
/// # I/O safety
///
/// This is a `BorrowedFd<'static>` because the standard input/output/error streams are shared
/// resources that must remain available for the lifetime of the process. This is only true when
/// linking `std`, and may not always hold for [code running before `main()`][before-after-main] or
/// in `no_std` environments. It is [unsound][io-safety] to close these file descriptors. Safe
/// patterns for changing these file descriptors are available on Unix via the `StdioExt` extension
/// trait。
///
/// [before-after-main]: ../../../std/index.html#use-before-and-after-main
/// [io-safety]: ../../../std/io/index.html#io-safety
/// [global-alloc-reentrancy]: ../../../std/alloc/trait.GlobalAlloc.html#re-entrance
#[unstable(feature = "stdio_fd_consts", issue = "150836")]
pub const STDERR: BorrowedFd<'static> = unsafe { BorrowedFd::borrow_raw(2) };
