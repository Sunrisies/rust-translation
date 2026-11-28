use super::Result;
use super::lifecycle::JoinInner;
use super::thread::Thread;
use crate::fmt;
use crate::sys::{AsInner, IntoInner, thread as imp};

/// 一个属于用户的、用于在线程上加入的权限（在线程终止时停止）。
///
/// A `JoinHandle` *detaches* the associated thread when it is dropped, which
/// means that there is no longer any handle to the thread and no way to `join`
/// on it.
///
/// Due to platform restrictions, it is not possible to [`Clone`] this
/// 权限：能够在线程上加入是一个独占性的权限。
///
/// This `struct` is created by the [`thread::spawn`] function and the
/// [`thread::Builder::spawn`] method.
///
/// # 示例
///
/// Creation from [`thread::spawn`]:
///
/// ```
/// use std::thread;
///
/// let join_handle: thread::JoinHandle<_> = thread::spawn(|| {
///     // some work here
/// });
/// ```
///
/// Creation from [`thread::Builder::spawn`]:
///
/// ```
/// use std::thread;
///
/// let builder = thread::Builder::new();
///
/// let join_handle: thread::JoinHandle<_> = builder.spawn(|| {
///     // some work here
/// }).unwrap();
/// ```
///
/// 一个线程被分离且其生命周期超过生成该线程的线程：
///
/// ```no_run
/// use std::thread;
/// use std::time::Duration;
///
/// let original_thread = thread::spawn(|| {
///     let _detached_thread = thread::spawn(|| {
///         // Here we sleep to make sure that the first thread returns before.
///         thread::sleep(Duration::from_millis(10));
///         // This will be called, even though the JoinHandle is dropped.
///         println!("♫ Still alive ♫");
///     });
/// });
///
/// original_thread.join().expect("The thread being joined has panicked");
/// println!("Original thread is joined.");
///
/// // We make sure that the new thread has time to run, before the main
/// // thread returns.
///
/// thread::sleep(Duration::from_millis(1000));
/// ```
///
/// [`thread::Builder::spawn`]: super::Builder::spawn
/// [`thread::spawn`]: super::spawn
#[stable(feature = "rust1", since = "1.0.0")]
#[cfg_attr(target_os = "teeos", must_use)]
pub struct JoinHandle<T>(pub(super) JoinInner<'static, T>);

#[stable(feature = "joinhandle_impl_send_sync", since = "1.29.0")]
unsafe impl<T> Send for JoinHandle<T> {}
#[stable(feature = "joinhandle_impl_send_sync", since = "1.29.0")]
unsafe impl<T> Sync for JoinHandle<T> {}

impl<T> JoinHandle<T> {
    /// 提取对底层线程的句柄。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::thread;
    ///
    /// let builder = thread::Builder::new();
    ///
    /// let join_handle: thread::JoinHandle<_> = builder.spawn(|| {
    ///     // some work here
    /// }).unwrap();
    ///
    /// let thread = join_handle.thread();
    /// println!("thread id: {:?}", thread.id());
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[must_use]
    pub fn thread(&self) -> &Thread {
        self.0.thread()
    }

    /// 等待相关线程完成。
    ///
    /// 如果相关线程已经完成，此函数将立即返回。
    /// 否则，它会完全等待线程完成，包括所有析构函数
    /// 对于可能在线程主函数之后运行的线程本地变量。
    ///
    /// 在 [原子内存排序] 方面，相关线程的完成与此函数的返回同步。换句话说，该线程执行的所有操作
    /// thread synchronizes with this function returning. In other words, all
    /// 发生。
    /// before](https://doc.rust-lang.org/nomicon/atomics.html#data-accesses) all
    /// operations that happen after `join` returns.
    ///
    /// If the associated thread panics, [`Err`] is returned with the parameter given
    /// to [`panic!`] (though see the Notes below).
    ///
    /// [`Err`]: crate::result::Result::Err
    /// [atomic memory orderings]: crate::sync::atomic
    ///
    /// # panic
    ///
    /// 在某些平台上，如果线程尝试加入自己或与其他线程加入时产生死锁，此函数可能会发生 panic。
    /// 
    ///
    /// # 示例
    ///
    /// ```
    /// use std::thread;
    ///
    /// let builder = thread::Builder::new();
    ///
    /// let join_handle: thread::JoinHandle<_> = builder.spawn(|| {
    ///     // some work here
    /// }).unwrap();
    /// join_handle.join().expect("Couldn't join on the associated thread");
    /// ```
    ///
    /// # 注释
    ///
    /// 如果“外部”的卸载操作（例如从 C++
    /// code, or a `panic!` in Rust code compiled or linked with a different
    /// 运行时）的 Rust 代码，完全卸载到线程根，进程可能会
    /// aborted; see the Notes on [`thread::spawn`]. If the process is not
    /// aborted, this function will return a `Result::Err` containing an opaque
    /// 该权限。
    ///
    /// [`catch_unwind`]: ../../std/panic/fn.catch_unwind.html
    /// [`thread::spawn`]: super::spawn
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn join(self) -> Result<T> {
        self.0.join()
    }

    /// 检查相关线程是否已完成其主函数的运行。
    ///
    /// `is_finished` supports implementing a non-blocking join operation, by checking
    /// `is_finished`, and calling `join` if it returns `true`. This function does not block. To
    /// block while waiting on the thread to finish, use [`join`][Self::join].
    ///
    /// This might return `true` for a brief moment after the thread's main
    /// function has returned, but before the thread itself has stopped running.
    /// However, once this returns `true`, [`join`][Self::join] can be expected
    /// 快速返回，不会造成长时间的阻塞。
    #[stable(feature = "thread_is_running", since = "1.61.0")]
    pub fn is_finished(&self) -> bool {
        self.0.is_finished()
    }
}

impl<T> AsInner<imp::Thread> for JoinHandle<T> {
    fn as_inner(&self) -> &imp::Thread {
        self.0.as_inner()
    }
}

impl<T> IntoInner<imp::Thread> for JoinHandle<T> {
    fn into_inner(self) -> imp::Thread {
        self.0.into_inner()
    }
}

#[stable(feature = "std_debug", since = "1.16.0")]
impl<T> fmt::Debug for JoinHandle<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("JoinHandle").finish_non_exhaustive()
    }
}
