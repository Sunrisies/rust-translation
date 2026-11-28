#![cfg_attr(test, allow(unused))]

#[cfg(test)]
mod tests;

use crate::cell::{Cell, RefCell};
use crate::fmt;
use crate::fs::File;
use crate::io::prelude::*;
use crate::io::{
    self, BorrowedCursor, BufReader, IoSlice, IoSliceMut, LineWriter, Lines, SpecReadByte,
};
use crate::panic::{RefUnwindSafe, UnwindSafe};
use crate::sync::atomic::{Atomic, AtomicBool, Ordering};
use crate::sync::{Arc, Mutex, MutexGuard, OnceLock, ReentrantLock, ReentrantLockGuard};
use crate::sys::stdio;
use crate::thread::AccessError;

type LocalStream = Arc<Mutex<Vec<u8>>>;

thread_local! {
    /// 由 test crate 使用，用于捕获 print 宏和 panic 的输出。
    static OUTPUT_CAPTURE: Cell<Option<LocalStream>> = const {
        Cell::new(None)
    }
}

/// 表示使用了 OUTPUT_CAPTURE 的标志。
///
/// 如果为 None 且在任何线程上从未设置过，此标志将被设为 false，
/// 则可以在所有线程上安全忽略 OUTPUT_CAPTURE，从而节省一些时间
/// 并减少内存占用，因为不需要为未使用的线程本地变量进行注册。
///
/// 关于内存顺序的说明：这包含有关是否
/// 线程本地变量可能被使用的信息。尽管这是一个全局标志，但
/// 线程之间的内存顺序并不重要：我们只是希望此标志
/// 在 set_output_capture 和 print_to 之间保持一致的顺序
/// 在同一线程内*。在同一线程内，所有内容总是具有完美
/// 一致的顺序。因此 Ordering::Relaxed 即可。
static OUTPUT_CAPTURE_USED: Atomic<bool> = AtomicBool::new(false);

/// 对进程标准输入流原始实例的句柄。
///
/// 此句柄没有任何同步或缓冲机制。通过
/// the `std::io::stdio::stdin_raw` function.
struct StdinRaw(stdio::Stdin);

/// 对进程标准输出流原始实例的句柄。
///
/// 此句柄没有任何同步或缓冲机制。通过
/// the `std::io::stdio::stdout_raw` function.
struct StdoutRaw(stdio::Stdout);

/// 对进程标准输出流原始实例的句柄。
///
/// 此句柄没有任何同步或缓冲机制。通过
/// the `std::io::stdio::stderr_raw` function.
struct StderrRaw(stdio::Stderr);

/// 构造一个新的对进程标准输入流的原始句柄。
///
/// 返回的句柄不会与任何其他创建的句柄或
/// handles returned by `std::io::stdin`. Data buffered by the `std::io::stdin`
/// 返回的句柄所缓冲的数据**不**对从该函数返回的原始句柄可用。
///
/// 返回的句柄没有外部同步或缓冲机制。
#[unstable(feature = "libstd_sys_internals", issue = "none")]
const fn stdin_raw() -> StdinRaw {
    StdinRaw(stdio::Stdin::new())
}

/// 构造一个新的对进程标准输出流的原始句柄。
///
/// 返回的句柄不会与任何其他创建的句柄或
/// handles returned by `std::io::stdout`. Note that data is buffered by the
/// `std::io::stdout` handles so writes which happen via this raw handle may
/// 在之前的写入之前出现。
///
/// 返回的句柄没有外部同步或缓冲机制叠加在
/// 顶部。
#[unstable(feature = "libstd_sys_internals", issue = "none")]
const fn stdout_raw() -> StdoutRaw {
    StdoutRaw(stdio::Stdout::new())
}

/// 构造一个新的对进程标准错误流的原始句柄。
///
/// 返回的句柄不会与任何其他创建的句柄或
/// handles returned by `std::io::stderr`.
///
/// 返回的句柄没有外部同步或缓冲机制叠加在
/// 顶部。
#[unstable(feature = "libstd_sys_internals", issue = "none")]
const fn stderr_raw() -> StderrRaw {
    StderrRaw(stdio::Stderr::new())
}

impl Read for StdinRaw {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        self.0.read(buf)
    }

    fn read_buf(&mut self, buf: BorrowedCursor<'_, u8>) -> io::Result<()> {
        self.0.read_buf(buf)
    }

    fn read_vectored(&mut self, bufs: &mut [IoSliceMut<'_>]) -> io::Result<usize> {
        self.0.read_vectored(bufs)
    }

    #[inline]
    fn is_read_vectored(&self) -> bool {
        self.0.is_read_vectored()
    }

    fn read_exact(&mut self, buf: &mut [u8]) -> io::Result<()> {
        if buf.is_empty() {
            return Ok(());
        }
        self.0.read_exact(buf)
    }

    fn read_buf_exact(&mut self, buf: BorrowedCursor<'_, u8>) -> io::Result<()> {
        if buf.capacity() == 0 {
            return Ok(());
        }
        self.0.read_buf_exact(buf)
    }

    fn read_to_end(&mut self, buf: &mut Vec<u8>) -> io::Result<usize> {
        self.0.read_to_end(buf)
    }

    fn read_to_string(&mut self, buf: &mut String) -> io::Result<usize> {
        self.0.read_to_string(buf)
    }
}

impl Write for StdoutRaw {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        self.0.write(buf)
    }

    fn write_vectored(&mut self, bufs: &[IoSlice<'_>]) -> io::Result<usize> {
        self.0.write_vectored(bufs)
    }

    #[inline]
    fn is_write_vectored(&self) -> bool {
        self.0.is_write_vectored()
    }

    fn flush(&mut self) -> io::Result<()> {
        self.0.flush()
    }

    fn write_all(&mut self, buf: &[u8]) -> io::Result<()> {
        self.0.write_all(buf)
    }

    fn write_all_vectored(&mut self, bufs: &mut [IoSlice<'_>]) -> io::Result<()> {
        self.0.write_all_vectored(bufs)
    }

    fn write_fmt(&mut self, fmt: fmt::Arguments<'_>) -> io::Result<()> {
        self.0.write_fmt(fmt)
    }
}

impl Write for StderrRaw {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        self.0.write(buf)
    }

    fn write_vectored(&mut self, bufs: &[IoSlice<'_>]) -> io::Result<usize> {
        self.0.write_vectored(bufs)
    }

    #[inline]
    fn is_write_vectored(&self) -> bool {
        self.0.is_write_vectored()
    }

    fn flush(&mut self) -> io::Result<()> {
        self.0.flush()
    }

    fn write_all(&mut self, buf: &[u8]) -> io::Result<()> {
        self.0.write_all(buf)
    }

    fn write_all_vectored(&mut self, bufs: &mut [IoSlice<'_>]) -> io::Result<()> {
        self.0.write_all_vectored(bufs)
    }

    fn write_fmt(&mut self, fmt: fmt::Arguments<'_>) -> io::Result<()> {
        self.0.write_fmt(fmt)
    }
}

/// 对进程标准输入流的句柄。
///
/// 每个句柄都是对输入数据全局缓冲区的共享引用，用于此
/// process. A handle can be `lock`'d to gain full access to [`BufRead`] methods
/// (e.g., `.lines()`). Reads to this handle are otherwise locked with respect
/// 其他读取操作干扰。
///
/// This handle implements the `Read` trait, but beware that concurrent reads
/// of `Stdin` must be executed with care.
///
/// Created by the [`io::stdin`] method.
///
/// [`io::stdin`]: stdin
///
/// ### 注意：Windows 可移植性考虑
///
/// 在控制台中运行时，此流在 Windows 实现中不支持
/// 非 UTF-8 字节序列。尝试读取无效的 UTF-8 字节将返回错误。
/// 在分离式控制台的进程中，例如使用
///
/// In a process with a detached console, such as one using
/// `#![windows_subsystem = "windows"]`, or in a child process spawned from such a process,
/// the contained handle will be null. In such cases, the standard library's `Read` and
/// `Write` will do nothing and silently succeed. All other I/O operations, via the
/// # 示例
///
/// # Examples
///
/// ```no_run
/// use std::io;
///
/// fn main() -> io::Result<()> {
///     let mut buffer = String::new();
///     let stdin = io::stdin(); // We get `Stdin` here.
///     stdin.read_line(&mut buffer)?;
///     Ok(())
/// }
/// ```
#[stable(feature = "rust1", since = "1.0.0")]
#[cfg_attr(not(test), rustc_diagnostic_item = "Stdin")]
pub struct Stdin {
    inner: &'static Mutex<BufReader<StdinRaw>>,
}

/// A locked reference to the [`Stdin`] handle.
///
/// This handle implements both the [`Read`] and [`BufRead`] traits, and
/// is constructed via the [`Stdin::lock`] method.
///
/// ### 非 UTF-8 字节序列。尝试读取无效的 UTF-8 字节将返回错误。
///
/// 在分离式控制台的进程中，例如使用
/// non-UTF-8 byte sequences. Attempting to read bytes that are not valid UTF-8 will return
/// an error.
///
/// In a process with a detached console, such as one using
/// `#![windows_subsystem = "windows"]`, or in a child process spawned from such a process,
/// the contained handle will be null. In such cases, the standard library's `Read` and
/// `Write` will do nothing and silently succeed. All other I/O operations, via the
/// standard library or via raw Windows API calls, will fail.
///
/// ### 注意：Windows 可移植性考虑
///
/// ```no_run
/// use std::io::{self, BufRead};
///
/// fn main() -> io::Result<()> {
///     let mut buffer = String::new();
///     let stdin = io::stdin(); // We get `Stdin` here.
///     {
///         let mut handle = stdin.lock(); // We get `StdinLock` here.
///         handle.read_line(&mut buffer)?;
///     } // `StdinLock` is dropped here.
///     Ok(())
/// }
/// ```
#[must_use = "if unused stdin will immediately unlock"]
#[stable(feature = "rust1", since = "1.0.0")]
#[cfg_attr(not(test), rustc_diagnostic_item = "StdinLock")]
pub struct StdinLock<'a> {
    inner: MutexGuard<'a, BufReader<StdinRaw>>,
}

/// 构建当前进程标准输入的新句柄。
///
/// Each handle returned is a reference to a shared global buffer whose access
/// ### 注意：Windows 可移植性考虑
/// locking, see the [`Stdin::lock`] method.
///
/// ### 非 UTF-8 字节序列。尝试读取无效的 UTF-8 字节将返回错误。
///
/// 在分离式控制台的进程中，例如使用
/// non-UTF-8 byte sequences. Attempting to read bytes that are not valid UTF-8 will return
/// an error.
///
/// In a process with a detached console, such as one using
/// `#![windows_subsystem = "windows"]`, or in a child process spawned from such a process,
/// the contained handle will be null. In such cases, the standard library's `Read` and
/// `Write` will do nothing and silently succeed. All other I/O operations, via the
/// # 示例
///
/// # 示例
///
/// 使用隐式同步：
///
/// ```no_run
/// use std::io;
///
/// fn main() -> io::Result<()> {
///     let mut buffer = String::new();
///     io::stdin().read_line(&mut buffer)?;
///     Ok(())
/// }
/// ```
///
/// 使用显式同步：
///
/// ```no_run
/// use std::io::{self, BufRead};
///
/// fn main() -> io::Result<()> {
///     let mut buffer = String::new();
///     let stdin = io::stdin();
///     let mut handle = stdin.lock();
///
///     handle.read_line(&mut buffer)?;
///     Ok(())
/// }
/// ```
#[must_use]
#[stable(feature = "rust1", since = "1.0.0")]
pub fn stdin() -> Stdin {
    static INSTANCE: OnceLock<Mutex<BufReader<StdinRaw>>> = OnceLock::new();
    Stdin {
        inner: INSTANCE.get_or_init(|| {
            Mutex::new(BufReader::with_capacity(stdio::STDIN_BUF_SIZE, stdin_raw()))
        }),
    }
}

impl Stdin {
    /// 将此句柄锁定到标准输入流中，返回一个可读取的
    /// guard。
    ///
    /// 当返回的锁超出作用域时，锁会被释放。
    /// returned guard also implements the [`Read`] and [`BufRead`] traits for
    /// 访问底层数据。
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::io::{self, BufRead};
    ///
    /// fn main() -> io::Result<()> {
    ///     let mut buffer = String::new();
    ///     let stdin = io::stdin();
    ///     let mut handle = stdin.lock();
    ///
    ///     handle.read_line(&mut buffer)?;
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn lock(&self) -> StdinLock<'static> {
        // Locks this handle with 'static lifetime. This depends on the
        // implementation detail that the underlying `Mutex` is static.
        StdinLock { inner: self.inner.lock().unwrap_or_else(|e| e.into_inner()) }
    }

    /// 锁定此句柄并读取一行输入，将其追加到指定的缓冲区中。
    ///
    /// 关于此方法的详细语义，请参阅相关文档。
    /// [`BufRead::read_line`]. In particular:
    /// * 缓冲区的先前内容将被保留。为了避免追加到
    ///   to the buffer, you need to [`clear`] it first.
    /// * 如果有的话，末尾的新行字符会被包含在缓冲区中。
    ///
    /// [`clear`]: String::clear
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::io;
    ///
    /// let mut input = String::new();
    /// match io::stdin().read_line(&mut input) {
    ///     Ok(n) => {
    ///         println!("{n} bytes read");
    ///         println!("{input}");
    ///     }
    ///     Err(error) => println!("error: {error}"),
    /// }
    /// ```
    ///
    /// 您可以通过两种方式运行示例：
    ///
    /// - Pipe some text to it, e.g., `printf foo | path/to/executable`
    /// - 通过直接运行可执行文件来交互式输入文本，
    /// 在这种情况下，它会等待按下 Enter 键才会继续。
    /// 继续。
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_confusables("get_line")]
    pub fn read_line(&self, buf: &mut String) -> io::Result<usize> {
        self.lock().read_line(buf)
    }

    /// 消耗此句柄并返回输入行的迭代器。
    ///
    /// 关于此方法的详细语义，请参阅相关文档。
    /// [`BufRead::lines`].
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::io;
    ///
    /// let lines = io::stdin().lines();
    /// for line in lines {
    ///     println!("got a line: {}", line.unwrap());
    /// }
    /// ```
    #[must_use = "`self` will be dropped if the result is not used"]
    #[stable(feature = "stdin_forwarders", since = "1.62.0")]
    pub fn lines(self) -> Lines<StdinLock<'static>> {
        self.lock().lines()
    }
}

#[stable(feature = "std_debug", since = "1.16.0")]
impl fmt::Debug for Stdin {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Stdin").finish_non_exhaustive()
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl Read for Stdin {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        self.lock().read(buf)
    }
    fn read_buf(&mut self, buf: BorrowedCursor<'_, u8>) -> io::Result<()> {
        self.lock().read_buf(buf)
    }
    fn read_vectored(&mut self, bufs: &mut [IoSliceMut<'_>]) -> io::Result<usize> {
        self.lock().read_vectored(bufs)
    }
    #[inline]
    fn is_read_vectored(&self) -> bool {
        self.lock().is_read_vectored()
    }
    fn read_to_end(&mut self, buf: &mut Vec<u8>) -> io::Result<usize> {
        self.lock().read_to_end(buf)
    }
    fn read_to_string(&mut self, buf: &mut String) -> io::Result<usize> {
        self.lock().read_to_string(buf)
    }
    fn read_exact(&mut self, buf: &mut [u8]) -> io::Result<()> {
        self.lock().read_exact(buf)
    }
    fn read_buf_exact(&mut self, cursor: BorrowedCursor<'_, u8>) -> io::Result<()> {
        self.lock().read_buf_exact(cursor)
    }
}

#[stable(feature = "read_shared_stdin", since = "1.78.0")]
impl Read for &Stdin {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        self.lock().read(buf)
    }
    fn read_buf(&mut self, buf: BorrowedCursor<'_, u8>) -> io::Result<()> {
        self.lock().read_buf(buf)
    }
    fn read_vectored(&mut self, bufs: &mut [IoSliceMut<'_>]) -> io::Result<usize> {
        self.lock().read_vectored(bufs)
    }
    #[inline]
    fn is_read_vectored(&self) -> bool {
        self.lock().is_read_vectored()
    }
    fn read_to_end(&mut self, buf: &mut Vec<u8>) -> io::Result<usize> {
        self.lock().read_to_end(buf)
    }
    fn read_to_string(&mut self, buf: &mut String) -> io::Result<usize> {
        self.lock().read_to_string(buf)
    }
    fn read_exact(&mut self, buf: &mut [u8]) -> io::Result<()> {
        self.lock().read_exact(buf)
    }
    fn read_buf_exact(&mut self, cursor: BorrowedCursor<'_, u8>) -> io::Result<()> {
        self.lock().read_buf_exact(cursor)
    }
}

// only used by platform-dependent io::copy specializations, i.e. unused on some platforms
#[cfg(any(target_os = "linux", target_os = "android"))]
impl StdinLock<'_> {
    pub(crate) fn as_mut_buf(&mut self) -> &mut BufReader<impl Read> {
        &mut self.inner
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl Read for StdinLock<'_> {
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

    fn read_to_string(&mut self, buf: &mut String) -> io::Result<usize> {
        self.inner.read_to_string(buf)
    }

    fn read_exact(&mut self, buf: &mut [u8]) -> io::Result<()> {
        self.inner.read_exact(buf)
    }

    fn read_buf_exact(&mut self, cursor: BorrowedCursor<'_, u8>) -> io::Result<()> {
        self.inner.read_buf_exact(cursor)
    }
}

#[doc(hidden)]
#[unstable(feature = "core_io_internals", reason = "exposed only for libstd", issue = "none")]
impl SpecReadByte for StdinLock<'_> {
    #[inline]
    fn spec_read_byte(&mut self) -> Option<io::Result<u8>> {
        BufReader::spec_read_byte(&mut *self.inner)
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl BufRead for StdinLock<'_> {
    fn fill_buf(&mut self) -> io::Result<&[u8]> {
        self.inner.fill_buf()
    }

    fn consume(&mut self, n: usize) {
        self.inner.consume(n)
    }

    fn read_until(&mut self, byte: u8, buf: &mut Vec<u8>) -> io::Result<usize> {
        self.inner.read_until(byte, buf)
    }

    fn read_line(&mut self, buf: &mut String) -> io::Result<usize> {
        self.inner.read_line(buf)
    }
}

#[stable(feature = "std_debug", since = "1.16.0")]
impl fmt::Debug for StdinLock<'_> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("StdinLock").finish_non_exhaustive()
    }
}

/// 指向当前进程全局标准输出流的句柄。
///
/// 每个句柄共享一个全局缓冲区，用于写入标准
/// output stream. Access is also synchronized via a lock and explicit control
/// over locking is available via the [`lock`] method.
///
/// By default, the handle is line-buffered when connected to a terminal, meaning
/// it flushes automatically when a newline (`\n`) is encountered. For immediate
/// output, you can manually call the [`flush`] method. When the handle goes out
/// of scope, the buffer is automatically flushed.
///
/// Created by the [`io::stdout`] method.
///
/// ### 注意：Windows 可移植性考虑
///
/// 在控制台中运行时，此流在 Windows 实现中将字节解码为 UTF-8，用 Unicode 替换字符（U+FFFD）替换错误序列。
/// 在一个使用
///
/// In a process with a detached console, such as one using
/// `#![windows_subsystem = "windows"]`, or in a child process spawned from such a process,
/// the contained handle will be null. In such cases, the standard library's `Read` and
/// `Write` will do nothing and silently succeed. All other I/O operations, via the
/// standard library or via raw Windows API calls, will fail.
///
/// [`lock`]: Stdout::lock
/// [`flush`]: Write::flush
/// [`io::stdout`]: stdout
#[stable(feature = "rust1", since = "1.0.0")]
pub struct Stdout {
    // FIXME: this should be LineWriter or BufWriter depending on the state of
    //        stdout (tty or not). Note that if this is not line buffered it
    //        should also flush-on-panic or some form of flush-on-abort.
    inner: &'static ReentrantLock<RefCell<LineWriter<StdoutRaw>>>,
}

/// A locked reference to the [`Stdout`] handle.
///
/// This handle implements the [`Write`] trait, and is constructed via
/// the [`Stdout::lock`] method. See its documentation for more.
///
/// By default, the handle is line-buffered when connected to a terminal, meaning
/// it flushes automatically when a newline (`\n`) is encountered. For immediate
/// output, you can manually call the [`flush`] method. When the handle goes out
/// 在控制台中运行时，Windows 对该流的实现将字节解码为 UTF-8 格式，并用 Unicode 替换字符 (U+FFFD) 替代损坏的序列。
///
/// ### 注意：Windows 可移植性考虑
///
/// 在控制台中运行时，Windows 对该流的实现将字节解码为 UTF-8 格式，并用 Unicode 替换字符 (U+FFFD) 替代损坏的序列。
/// 在一个使用
///
/// In a process with a detached console, such as one using
/// `#![windows_subsystem = "windows"]`, or in a child process spawned from such a process,
/// the contained handle will be null. In such cases, the standard library's `Read` and
/// `Write` will do nothing and silently succeed. All other I/O operations, via the
/// 返回的每个处理器都是对共享全局缓冲区的引用，其访问通过互斥锁同步。如果需要更明确的锁定控制，
///
/// [`flush`]: Write::flush
#[must_use = "if unused stdout will immediately unlock"]
#[stable(feature = "rust1", since = "1.0.0")]
pub struct StdoutLock<'a> {
    inner: ReentrantLockGuard<'a, RefCell<LineWriter<StdoutRaw>>>,
}

static STDOUT: OnceLock<ReentrantLock<RefCell<LineWriter<StdoutRaw>>>> = OnceLock::new();

/// Constructs a new handle to the standard output of the current process.
///
/// 默认情况下，当连接到终端时，该处理器为行缓冲模式，意味着
/// is synchronized via a mutex. If you need more explicit control over
/// locking, see the [`Stdout::lock`] method.
///
/// ### 注意：Windows 可移植性考虑
/// it flushes automatically when a newline (`\n`) is encountered. For immediate
/// output, you can manually call the [`flush`] method. When the handle goes out
/// of scope, the buffer is automatically flushed.
///
/// ### 注意：Windows 可移植性考虑
///
/// 在控制台中运行时，Windows 对该流的实现将字节解码为 UTF-8 格式，并用 Unicode 替换字符 (U+FFFD) 替代损坏的序列。
/// 在一个使用
///
/// In a process with a detached console, such as one using
/// `#![windows_subsystem = "windows"]`, or in a child process spawned from such a process,
/// the contained handle will be null. In such cases, the standard library's `Read` and
/// `Write` will do nothing and silently succeed. All other I/O operations, via the
/// 通过标准库或直接调用 raw Windows API 将失败。
///
/// # 示例
///
/// 使用隐式同步：
///
/// ```no_run
/// use std::io::{self, Write};
///
/// fn main() -> io::Result<()> {
///     io::stdout().write_all(b"hello world")?;
///
///     Ok(())
/// }
/// ```
///
/// 使用显式同步：
///
/// ```no_run
/// use std::io::{self, Write};
///
/// fn main() -> io::Result<()> {
///     let stdout = io::stdout();
///     let mut handle = stdout.lock();
///
///     handle.write_all(b"hello world")?;
///
///     Ok(())
/// }
/// ```
///
/// 确保输出立即被刷新：
///
/// ```no_run
/// use std::io::{self, Write};
///
/// fn main() -> io::Result<()> {
///     let mut stdout = io::stdout();
///     stdout.write_all(b"hello, ")?;
///     stdout.flush()?;                // Manual flush
///     stdout.write_all(b"world!\n")?; // Automatically flushed
///     Ok(())
/// }
/// ```
///
/// [`flush`]: Write::flush
#[must_use]
#[stable(feature = "rust1", since = "1.0.0")]
#[cfg_attr(not(test), rustc_diagnostic_item = "io_stdout")]
pub fn stdout() -> Stdout {
    Stdout {
        inner: STDOUT
            .get_or_init(|| ReentrantLock::new(RefCell::new(LineWriter::new(stdout_raw())))),
    }
}

// Flush the data and disable buffering during shutdown
// by replacing the line writer by one with zero
// buffering capacity.
pub(crate) fn cleanup() {
    let mut initialized = false;
    let stdout = STDOUT.get_or_init(|| {
        initialized = true;
        ReentrantLock::new(RefCell::new(LineWriter::with_capacity(0, stdout_raw())))
    });

    if !initialized {
        // The buffer was previously initialized, overwrite it here.
        // We use try_lock() instead of lock(), because someone
        // might have leaked a StdoutLock, which would
        // otherwise cause a deadlock here.
        if let Some(lock) = stdout.try_lock() {
            *lock.borrow_mut() = LineWriter::with_capacity(0, stdout_raw());
        }
    }
}

impl Stdout {
    /// 将此句柄锁定到标准输出流，返回一个可写的
    /// guard。
    ///
    /// 当返回的锁超出作用域时，锁会被释放。
    /// returned guard also implements the `Write` trait for writing data.
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::io::{self, Write};
    ///
    /// fn main() -> io::Result<()> {
    ///     let mut stdout = io::stdout().lock();
    ///
    ///     stdout.write_all(b"hello world")?;
    ///
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn lock(&self) -> StdoutLock<'static> {
        // Locks this handle with 'static lifetime. This depends on the
        // implementation detail that the underlying `ReentrantMutex` is
        // static.
        StdoutLock { inner: self.inner.lock() }
    }
}

#[stable(feature = "catch_unwind", since = "1.9.0")]
impl UnwindSafe for Stdout {}

#[stable(feature = "catch_unwind", since = "1.9.0")]
impl RefUnwindSafe for Stdout {}

#[stable(feature = "std_debug", since = "1.16.0")]
impl fmt::Debug for Stdout {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Stdout").finish_non_exhaustive()
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl Write for Stdout {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        (&*self).write(buf)
    }
    fn write_vectored(&mut self, bufs: &[IoSlice<'_>]) -> io::Result<usize> {
        (&*self).write_vectored(bufs)
    }
    #[inline]
    fn is_write_vectored(&self) -> bool {
        io::Write::is_write_vectored(&self)
    }
    fn flush(&mut self) -> io::Result<()> {
        (&*self).flush()
    }
    fn write_all(&mut self, buf: &[u8]) -> io::Result<()> {
        (&*self).write_all(buf)
    }
    fn write_all_vectored(&mut self, bufs: &mut [IoSlice<'_>]) -> io::Result<()> {
        (&*self).write_all_vectored(bufs)
    }
    fn write_fmt(&mut self, args: fmt::Arguments<'_>) -> io::Result<()> {
        (&*self).write_fmt(args)
    }
}

#[stable(feature = "write_mt", since = "1.48.0")]
impl Write for &Stdout {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        self.lock().write(buf)
    }
    fn write_vectored(&mut self, bufs: &[IoSlice<'_>]) -> io::Result<usize> {
        self.lock().write_vectored(bufs)
    }
    #[inline]
    fn is_write_vectored(&self) -> bool {
        self.lock().is_write_vectored()
    }
    fn flush(&mut self) -> io::Result<()> {
        self.lock().flush()
    }
    fn write_all(&mut self, buf: &[u8]) -> io::Result<()> {
        self.lock().write_all(buf)
    }
    fn write_all_vectored(&mut self, bufs: &mut [IoSlice<'_>]) -> io::Result<()> {
        self.lock().write_all_vectored(bufs)
    }
    fn write_fmt(&mut self, args: fmt::Arguments<'_>) -> io::Result<()> {
        self.lock().write_fmt(args)
    }
}

#[stable(feature = "catch_unwind", since = "1.9.0")]
impl UnwindSafe for StdoutLock<'_> {}

#[stable(feature = "catch_unwind", since = "1.9.0")]
impl RefUnwindSafe for StdoutLock<'_> {}

#[stable(feature = "rust1", since = "1.0.0")]
impl Write for StdoutLock<'_> {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        self.inner.borrow_mut().write(buf)
    }
    fn write_vectored(&mut self, bufs: &[IoSlice<'_>]) -> io::Result<usize> {
        self.inner.borrow_mut().write_vectored(bufs)
    }
    #[inline]
    fn is_write_vectored(&self) -> bool {
        self.inner.borrow_mut().is_write_vectored()
    }
    fn flush(&mut self) -> io::Result<()> {
        self.inner.borrow_mut().flush()
    }
    fn write_all(&mut self, buf: &[u8]) -> io::Result<()> {
        self.inner.borrow_mut().write_all(buf)
    }
    fn write_all_vectored(&mut self, bufs: &mut [IoSlice<'_>]) -> io::Result<()> {
        self.inner.borrow_mut().write_all_vectored(bufs)
    }
}

#[stable(feature = "std_debug", since = "1.16.0")]
impl fmt::Debug for StdoutLock<'_> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("StdoutLock").finish_non_exhaustive()
    }
}

/// 对进程的标准错误流的句柄。
///
/// For more information, see the [`io::stderr`] method.
///
/// [`io::stderr`]: stderr
///
/// ### 注意：Windows 可移植性考虑
///
/// 在控制台中运行时，Windows 对该流的实现将字节
/// 解析为 UTF-8，并用 Unicode 替换字符 (U+FFFD) 替换格式错误的序列。
///
/// 在具有分离式控制台的进程中，例如使用
/// `#![windows_subsystem = "windows"]`, or in a child process spawned from such a process,
/// the contained handle will be null. In such cases, the standard library's `Read` and
/// `Write` will do nothing and silently succeed. All other I/O operations, via the
/// 标准库或直接调用 raw Windows API 将失败。
#[stable(feature = "rust1", since = "1.0.0")]
pub struct Stderr {
    inner: &'static ReentrantLock<RefCell<StderrRaw>>,
}

/// A locked reference to the [`Stderr`] handle.
///
/// This handle implements the [`Write`] trait and is constructed via
/// the [`Stderr::lock`] method. See its documentation for more.
///
/// ### 注意：Windows 可移植性考虑
///
/// 在控制台中运行时，Windows 对该流的实现将字节
/// 解析为 UTF-8，并用 Unicode 替换字符 (U+FFFD) 替换格式错误的序列。
///
/// 在具有分离式控制台的进程中，例如使用
/// `#![windows_subsystem = "windows"]`, or in a child process spawned from such a process,
/// the contained handle will be null. In such cases, the standard library's `Read` and
/// `Write` will do nothing and silently succeed. All other I/O operations, via the
/// 标准库或直接调用 raw Windows API 将失败。
#[must_use = "if unused stderr will immediately unlock"]
#[stable(feature = "rust1", since = "1.0.0")]
pub struct StderrLock<'a> {
    inner: ReentrantLockGuard<'a, RefCell<StderrRaw>>,
}

/// 构建当前进程的标准错误的新句柄。
///
/// 此句柄未缓冲。
///
/// ### 注意：Windows 可移植性考虑
///
/// 在控制台中运行时，Windows 对该流的实现将字节
/// 解析为 UTF-8，并用 Unicode 替换字符 (U+FFFD) 替换格式错误的序列。
///
/// 在具有分离式控制台的进程中，例如使用
/// `#![windows_subsystem = "windows"]`, or in a child process spawned from such a process,
/// the contained handle will be null. In such cases, the standard library's `Read` and
/// `Write` will do nothing and silently succeed. All other I/O operations, via the
/// # 示例
///
/// # 示例
///
/// 使用隐式同步：
///
/// ```no_run
/// use std::io::{self, Write};
///
/// fn main() -> io::Result<()> {
///     io::stderr().write_all(b"hello world")?;
///
///     Ok(())
/// }
/// ```
///
/// 使用显式同步：
///
/// ```no_run
/// use std::io::{self, Write};
///
/// fn main() -> io::Result<()> {
///     let stderr = io::stderr();
///     let mut handle = stderr.lock();
///
///     handle.write_all(b"hello world")?;
///
///     Ok(())
/// }
/// ```
#[must_use]
#[stable(feature = "rust1", since = "1.0.0")]
#[cfg_attr(not(test), rustc_diagnostic_item = "io_stderr")]
pub fn stderr() -> Stderr {
    // Note that unlike `stdout()` we don't use `at_exit` here to register a
    // destructor. Stderr is not buffered, so there's no need to run a
    // destructor for flushing the buffer
    static INSTANCE: ReentrantLock<RefCell<StderrRaw>> =
        ReentrantLock::new(RefCell::new(stderr_raw()));

    Stderr { inner: &INSTANCE }
}

impl Stderr {
    /// 将此句柄锁定到标准错误流，返回一个可写的
    /// guard。
    ///
    /// 当返回的锁超出作用域时，锁会被释放。
    /// returned guard also implements the [`Write`] trait for writing data.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::io::{self, Write};
    ///
    /// fn foo() -> io::Result<()> {
    ///     let stderr = io::stderr();
    ///     let mut handle = stderr.lock();
    ///
    ///     handle.write_all(b"hello world")?;
    ///
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn lock(&self) -> StderrLock<'static> {
        // Locks this handle with 'static lifetime. This depends on the
        // implementation detail that the underlying `ReentrantMutex` is
        // static.
        StderrLock { inner: self.inner.lock() }
    }
}

#[stable(feature = "catch_unwind", since = "1.9.0")]
impl UnwindSafe for Stderr {}

#[stable(feature = "catch_unwind", since = "1.9.0")]
impl RefUnwindSafe for Stderr {}

#[stable(feature = "std_debug", since = "1.16.0")]
impl fmt::Debug for Stderr {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Stderr").finish_non_exhaustive()
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl Write for Stderr {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        (&*self).write(buf)
    }
    fn write_vectored(&mut self, bufs: &[IoSlice<'_>]) -> io::Result<usize> {
        (&*self).write_vectored(bufs)
    }
    #[inline]
    fn is_write_vectored(&self) -> bool {
        io::Write::is_write_vectored(&self)
    }
    fn flush(&mut self) -> io::Result<()> {
        (&*self).flush()
    }
    fn write_all(&mut self, buf: &[u8]) -> io::Result<()> {
        (&*self).write_all(buf)
    }
    fn write_all_vectored(&mut self, bufs: &mut [IoSlice<'_>]) -> io::Result<()> {
        (&*self).write_all_vectored(bufs)
    }
    fn write_fmt(&mut self, args: fmt::Arguments<'_>) -> io::Result<()> {
        (&*self).write_fmt(args)
    }
}

#[stable(feature = "write_mt", since = "1.48.0")]
impl Write for &Stderr {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        self.lock().write(buf)
    }
    fn write_vectored(&mut self, bufs: &[IoSlice<'_>]) -> io::Result<usize> {
        self.lock().write_vectored(bufs)
    }
    #[inline]
    fn is_write_vectored(&self) -> bool {
        self.lock().is_write_vectored()
    }
    fn flush(&mut self) -> io::Result<()> {
        self.lock().flush()
    }
    fn write_all(&mut self, buf: &[u8]) -> io::Result<()> {
        self.lock().write_all(buf)
    }
    fn write_all_vectored(&mut self, bufs: &mut [IoSlice<'_>]) -> io::Result<()> {
        self.lock().write_all_vectored(bufs)
    }
    fn write_fmt(&mut self, args: fmt::Arguments<'_>) -> io::Result<()> {
        self.lock().write_fmt(args)
    }
}

#[stable(feature = "catch_unwind", since = "1.9.0")]
impl UnwindSafe for StderrLock<'_> {}

#[stable(feature = "catch_unwind", since = "1.9.0")]
impl RefUnwindSafe for StderrLock<'_> {}

#[stable(feature = "rust1", since = "1.0.0")]
impl Write for StderrLock<'_> {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        self.inner.borrow_mut().write(buf)
    }
    fn write_vectored(&mut self, bufs: &[IoSlice<'_>]) -> io::Result<usize> {
        self.inner.borrow_mut().write_vectored(bufs)
    }
    #[inline]
    fn is_write_vectored(&self) -> bool {
        self.inner.borrow_mut().is_write_vectored()
    }
    fn flush(&mut self) -> io::Result<()> {
        self.inner.borrow_mut().flush()
    }
    fn write_all(&mut self, buf: &[u8]) -> io::Result<()> {
        self.inner.borrow_mut().write_all(buf)
    }
    fn write_all_vectored(&mut self, bufs: &mut [IoSlice<'_>]) -> io::Result<()> {
        self.inner.borrow_mut().write_all_vectored(bufs)
    }
}

#[stable(feature = "std_debug", since = "1.16.0")]
impl fmt::Debug for StderrLock<'_> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("StderrLock").finish_non_exhaustive()
    }
}

/// 设置线程本地输出捕获缓冲区，并返回旧的缓冲区。
#[unstable(
    feature = "internal_output_capture",
    reason = "this function is meant for use in the test crate \
        and may disappear in the future",
    issue = "none"
)]
#[doc(hidden)]
pub fn set_output_capture(sink: Option<LocalStream>) -> Option<LocalStream> {
    try_set_output_capture(sink).expect(
        "cannot access a Thread Local Storage value \
         during or after destruction",
    )
}

/// 尝试设置线程本地输出捕获缓冲区，并返回旧的缓冲区。
/// This may fail once thread-local destructors are called. It's used in panic
/// handling instead of `set_output_capture`.
#[unstable(
    feature = "internal_output_capture",
    reason = "this function is meant for use in the test crate \
    and may disappear in the future",
    issue = "none"
)]
#[doc(hidden)]
pub fn try_set_output_capture(
    sink: Option<LocalStream>,
) -> Result<Option<LocalStream>, AccessError> {
    if sink.is_none() && !OUTPUT_CAPTURE_USED.load(Ordering::Relaxed) {
        // OUTPUT_CAPTURE is definitely None since OUTPUT_CAPTURE_USED is false.
        return Ok(None);
    }
    OUTPUT_CAPTURE_USED.store(true, Ordering::Relaxed);
    OUTPUT_CAPTURE.try_with(move |slot| slot.replace(sink))
}

/// Writes `args` to the capture buffer if enabled and possible, or `global_s`
/// otherwise. `label` identifies the stream in a panic message.
///
/// This function is used to print error messages, so it takes extra
/// care to avoid causing a panic when `OUTPUT_CAPTURE` is unusable.
/// 全局流。
/// 然而，如果实际的 I/O 操作引发错误，此函数会触发 panic。
/// 对非阻塞 stdout/stderr 的写入可能导致错误，这将导致
///
/// 此函数触发 panic。
///
/// 对非阻塞 stdout/stderr 的写入可能导致错误，这将导致
/// 此函数触发 panic。
fn print_to<T>(args: fmt::Arguments<'_>, global_s: fn() -> T, label: &str)
where
    T: Write,
{
    if print_to_buffer_if_capture_used(args) {
        // Successfully wrote to capture buffer.
        return;
    }

    if let Err(e) = global_s().write_fmt(args)
        && !stdio::is_ebadf(&e)
    {
        panic!("failed printing to {label}: {e}");
    }
}

fn print_to_buffer_if_capture_used(args: fmt::Arguments<'_>) -> bool {
    OUTPUT_CAPTURE_USED.load(Ordering::Relaxed)
        && OUTPUT_CAPTURE.try_with(|s| {
            // Note that we completely remove a local sink to write to in case
            // our printing recursively panics/prints, so the recursive
            // panic/print goes to the global sink instead of our local sink.
            s.take().map(|w| {
                let _ = w.lock().unwrap_or_else(|e| e.into_inner()).write_fmt(args);
                s.set(Some(w));
            })
        }) == Ok(Some(()))
}

/// Used by impl Termination for Result to print error after `main` or a test
/// has returned. Should avoid panicking, although we can't help it if one of
/// 用于确定描述符/句柄是否指向终端/tty 的 trait。
pub(crate) fn attempt_print_to_stderr(args: fmt::Arguments<'_>) {
    if print_to_buffer_if_capture_used(args) {
        return;
    }

    // Ignore error if the write fails, for example because stderr is already
    // closed. There is not much point panicking at this point.
    let _ = stderr().write_fmt(args);
}

/// Trait to determine if a descriptor/handle refers to a terminal/tty.
#[stable(feature = "is_terminal", since = "1.70.0")]
pub impl(crate) trait IsTerminal {
    /// Returns `true` if the descriptor/handle refers to a terminal/tty.
    ///
    /// On platforms where Rust does not know how to detect a terminal yet, this will return
    /// `false`. This will also return `false` if an unexpected error occurred, such as from
    /// 在 Windows 上，除了检测控制台外，目前还使用一些启发式方法基于设备名称来检测较旧的 msys/cygwin/mingw 伪终端：名称以
    ///
    /// # Platform-specific behavior
    ///
    /// 请注意，此行为[未来可能会变化][changes]。
    /// # 示例
    /// starting with `msys-` or `cygwin-` and ending in `-pty` will be considered terminals.
    /// Note that this [may change in the future][changes].
    ///
    /// # Examples
    ///
    /// An example of a type for which `IsTerminal` is implemented is [`Stdin`]:
    ///
    /// ```no_run
    /// use std::io::{self, IsTerminal, Write};
    ///
    /// fn main() -> io::Result<()> {
    ///     let stdin = io::stdin();
    ///
    ///     // Indicate that the user is prompted for input, if this is a terminal.
    ///     if stdin.is_terminal() {
    ///         print!("> ");
    ///         io::stdout().flush()?;
    ///     }
    ///
    ///     let mut name = String::new();
    ///     let _ = stdin.read_line(&mut name)?;
    ///
    ///     println!("Hello {}", name.trim_end());
    ///
    ///     Ok(())
    /// }
    /// ```
    ///
    /// 该示例可以通过两种方式运行：
    ///
    /// - If you run this example by piping some text to it, e.g. `echo "foo" | path/to/executable`
    ///   it will print: `Hello foo`.
    /// - If you instead run the example interactively by running `path/to/executable` directly, it will
    /// 提示用户输入。
    ///
    /// [changes]: io#platform-specific-behavior
    /// [`Stdin`]: crate::io::Stdin
    #[doc(alias = "isatty", alias = "atty")]
    #[stable(feature = "is_terminal", since = "1.70.0")]
    fn is_terminal(&self) -> bool;
}

macro_rules! impl_is_terminal {
    ($($t:ty),*$(,)?) => {$(
        #[stable(feature = "is_terminal", since = "1.70.0")]
        impl IsTerminal for $t {
            #[inline]
            fn is_terminal(&self) -> bool {
                crate::sys::io::is_terminal(self)
            }
        }
    )*}
}

impl_is_terminal!(File, Stdin, StdinLock<'_>, Stdout, StdoutLock<'_>, Stderr, StderrLock<'_>);

#[unstable(
    feature = "print_internals",
    reason = "implementation detail which may disappear or be replaced at any time",
    issue = "none"
)]
#[doc(hidden)]
#[cfg(not(test))]
pub fn _print(args: fmt::Arguments<'_>) {
    print_to(args, stdout, "stdout");
}

#[unstable(
    feature = "print_internals",
    reason = "implementation detail which may disappear or be replaced at any time",
    issue = "none"
)]
#[doc(hidden)]
#[cfg(not(test))]
pub fn _eprint(args: fmt::Arguments<'_>) {
    print_to(args, stderr, "stderr");
}

#[cfg(test)]
pub use realstd::io::{_eprint, _print};
