use super::Result;
use super::builder::Builder;
use super::current::current_or_unnamed;
use super::lifecycle::{JoinInner, spawn_unchecked};
use super::thread::Thread;
use crate::marker::PhantomData;
use crate::panic::{AssertUnwindSafe, catch_unwind, resume_unwind};
use crate::sync::Arc;
use crate::sync::atomic::{Atomic, AtomicBool, AtomicUsize, Ordering};
use crate::{fmt, io};

/// 用于创建受限制线程的上下文。
///
/// See [`scope`] for details.
#[stable(feature = "scoped_threads", since = "1.63.0")]
pub struct Scope<'scope, 'env: 'scope> {
    data: Arc<ScopeData>,
    /// 对“上下文”具有不变性，以确保“上下文”不会缩小，
    /// 这是确保正确性所必需的。
    ///
    /// 如果没有这种不变性，虽然代码可以编译通过，但是不安全的：
    ///
    /// ```compile_fail,E0373
    /// std::thread::scope(|s| {
    ///     s.spawn(|| {
    ///         let a = String::from("abcd");
    ///         s.spawn(|| println!("{a:?}")); // might run after `a` is dropped
    ///     });
    /// });
    /// ```
    scope: PhantomData<&'scope mut &'scope ()>,
    env: PhantomData<&'env mut &'env ()>,
}

/// 是一种拥有的权限，用于在受限制线程上加入（在其终止时阻塞）。
///
/// See [`Scope::spawn`] for details.
#[stable(feature = "scoped_threads", since = "1.63.0")]
pub struct ScopedJoinHandle<'scope, T>(JoinInner<'scope, T>);

pub(super) struct ScopeData {
    num_running_threads: Atomic<usize>,
    a_thread_panicked: Atomic<bool>,
    main_thread: Thread,
}

impl ScopeData {
    pub(super) fn increment_num_running_threads(&self) {
        // We check for 'overflow' with usize::MAX / 2, to make sure there's no
        // chance it overflows to 0, which would result in unsoundness.
        if self.num_running_threads.fetch_add(1, Ordering::Relaxed) > usize::MAX / 2 {
            // This can only reasonably happen by mem::forget()'ing a lot of ScopedJoinHandles.
            self.overflow();
        }
    }

    #[cold]
    fn overflow(&self) {
        self.decrement_num_running_threads(false);
        panic!("too many running threads in thread scope");
    }

    pub(super) fn decrement_num_running_threads(&self, panic: bool) {
        if panic {
            self.a_thread_panicked.store(true, Ordering::Relaxed);
        }
        if self.num_running_threads.fetch_sub(1, Ordering::Release) == 1 {
            self.main_thread.unpark();
        }
    }
}

/// 创建用于生成受限制线程的上下文。
///
/// The function passed to `scope` will be provided a [`Scope`] object,
/// through which scoped threads can be [spawned][`Scope::spawn`].
///
/// Unlike non-scoped threads, scoped threads can borrow non-`'static` data,
/// 因为上下文保证所有线程在上下文结束时都会加入。
///
/// 在上下文中生成但未被手动加入的所有线程
/// 将在该函数返回前自动加入。
/// 但是请注意，加入操作只会等待这些线程的主函数完成；甚至
/// 当该函数返回时，这些线程中的线程本地变量的析构函数可能仍在进行中。
/// # Panics
///
/// # Panics
///
/// 如果任何自动加入的线程发生 panic，此函数也会发生 panic。
///
/// 如果您希望处理由生成线程引起的 panic，
/// [`join`][ScopedJoinHandle::join] them before the end of the scope.
///
/// # 示例
///
/// ```
/// use std::thread;
///
/// let mut a = vec![1, 2, 3];
/// let mut x = 0;
///
/// thread::scope(|s| {
///     s.spawn(|| {
///         println!("hello from the first scoped thread");
///         // We can borrow `a` here.
///         dbg!(&a);
///     });
///     s.spawn(|| {
///         println!("hello from the second scoped thread");
///         // We can even mutably borrow `x` here,
///         // because no other threads are using it.
///         x += a[0] + a[2];
///     });
///     println!("hello from the main thread");
/// });
///
/// // After the scope, we can modify and access our variables again:
/// a.push(4);
/// assert_eq!(x, a.len());
/// ```
///
/// # 生命周期
///
/// Scoped threads involve two lifetimes: `'scope` and `'env`.
///
/// The `'scope` lifetime represents the lifetime of the scope itself.
/// 即：新的受限制线程可以生成的时期，
/// 以及它们可能仍在运行的时期。
/// 一旦此生命周期结束，所有受限制线程都会被加入。
/// This lifetime starts within the `scope` function, before `f` (the argument to `scope`) starts.
/// It ends after `f` returns and all scoped threads have been joined, but before `scope` returns.
///
/// The `'env` lifetime represents the lifetime of whatever is borrowed by the scoped threads.
/// This lifetime must outlast the call to `scope`, and thus cannot be smaller than `'scope`.
/// It can be as small as the call to `scope`, meaning that anything that outlives this call,
/// 例如在上下文之前定义的局部变量，都可以被受限制线程借用。
///
/// The `'env: 'scope` bound is part of the definition of the `Scope` type.
#[track_caller]
#[stable(feature = "scoped_threads", since = "1.63.0")]
pub fn scope<'env, F, T>(f: F) -> T
where
    F: for<'scope> FnOnce(&'scope Scope<'scope, 'env>) -> T,
{
    // We put the `ScopeData` into an `Arc` so that other threads can finish their
    // `decrement_num_running_threads` even after this function returns.
    let scope = Scope {
        data: Arc::new(ScopeData {
            num_running_threads: AtomicUsize::new(0),
            main_thread: current_or_unnamed(),
            a_thread_panicked: AtomicBool::new(false),
        }),
        env: PhantomData,
        scope: PhantomData,
    };

    // Run `f`, but catch panics so we can make sure to wait for all the threads to join.
    let result = catch_unwind(AssertUnwindSafe(|| f(&scope)));

    // Wait until all the threads are finished.
    while scope.data.num_running_threads.load(Ordering::Acquire) != 0 {
        // SAFETY: this is the main thread, the handle belongs to us.
        unsafe { scope.data.main_thread.park() };
    }

    // Throw any panic from `f`, or the return value of `f` if no thread panicked.
    match result {
        Err(e) => resume_unwind(e),
        Ok(_) if scope.data.a_thread_panicked.load(Ordering::Relaxed) => {
            panic!("a scoped thread panicked")
        }
        Ok(result) => result,
    }
}

impl<'scope, 'env> Scope<'scope, 'env> {
    /// Spawns a new thread within a scope, returning a [`ScopedJoinHandle`] for it.
    ///
    /// 与非受限制线程不同，使用此函数生成的线程可能
    /// borrow non-`'static` data from outside the scope. See [`scope`] for
    /// 。
    ///
    /// The join handle provides a [`join`] method that can be used to join the spawned
    /// thread. If the spawned thread panics, [`join`] will return an [`Err`] containing
    /// the panic payload.
    ///
    /// 如果 drop 了 join 句柄，生成的线程将在
    /// end of the scope. In that case, if the spawned thread panics, [`scope`] will
    /// 在所有线程连接完成后发生 panic。
    ///
    /// This function creates a thread with the default parameters of [`Builder`].
    /// To specify the new thread's stack size or the name, use [`Builder::spawn_scoped`].
    ///
    /// # Panic
    ///
    /// Panics if the OS fails to create a thread; use [`Builder::spawn_scoped`]
    /// 来从此类错误中恢复。
    ///
    /// [`join`]: ScopedJoinHandle::join
    #[stable(feature = "scoped_threads", since = "1.63.0")]
    pub fn spawn<F, T>(&'scope self, f: F) -> ScopedJoinHandle<'scope, T>
    where
        F: FnOnce() -> T + Send + 'scope,
        T: Send + 'scope,
    {
        Builder::new().spawn_scoped(self, f).expect("failed to spawn thread")
    }
}

impl Builder {
    /// Spawns a new scoped thread using the settings set through this `Builder`.
    ///
    /// Unlike [`Scope::spawn`], this method yields an [`io::Result`] to
    /// 捕获在操作系统层面创建线程时的任何失败情况。
    ///
    /// # Panic
    ///
    /// 如果设置了线程名称且包含空字节，则发生 panic。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::thread;
    ///
    /// let mut a = vec![1, 2, 3];
    /// let mut x = 0;
    ///
    /// thread::scope(|s| {
    ///     thread::Builder::new()
    ///         .name("first".to_string())
    ///         .spawn_scoped(s, ||
    ///     {
    ///         println!("hello from the {:?} scoped thread", thread::current().name());
    ///         // We can borrow `a` here.
    ///         dbg!(&a);
    ///     })
    ///     .unwrap();
    ///     thread::Builder::new()
    ///         .name("second".to_string())
    ///         .spawn_scoped(s, ||
    ///     {
    ///         println!("hello from the {:?} scoped thread", thread::current().name());
    ///         // We can even mutably borrow `x` here,
    ///         // because no other threads are using it.
    ///         x += a[0] + a[2];
    ///     })
    ///     .unwrap();
    ///     println!("hello from the main thread");
    /// });
    ///
    /// // After the scope, we can modify and access our variables again:
    /// a.push(4);
    /// assert_eq!(x, a.len());
    /// ```
    #[stable(feature = "scoped_threads", since = "1.63.0")]
    pub fn spawn_scoped<'scope, 'env, F, T>(
        self,
        scope: &'scope Scope<'scope, 'env>,
        f: F,
    ) -> io::Result<ScopedJoinHandle<'scope, T>>
    where
        F: FnOnce() -> T + Send + 'scope,
        T: Send + 'scope,
    {
        let Builder { name, stack_size, no_hooks } = self;
        Ok(ScopedJoinHandle(unsafe {
            spawn_unchecked(name, stack_size, no_hooks, Some(scope.data.clone()), f)
        }?))
    }
}

impl<'scope, T> ScopedJoinHandle<'scope, T> {
    /// 提取对底层线程的句柄。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::thread;
    ///
    /// thread::scope(|s| {
    ///     let t = s.spawn(|| {
    ///         println!("hello");
    ///     });
    ///     println!("thread id: {:?}", t.thread().id());
    /// });
    /// ```
    #[must_use]
    #[stable(feature = "scoped_threads", since = "1.63.0")]
    pub fn thread(&self) -> &Thread {
        self.0.thread()
    }

    /// 等待关联线程完成运行。
    ///
    /// 如果关联线程已经完成，此函数将立即返回。
    /// 否则，它会完全等待线程完成，包括所有析构函数
    /// 对于可能在线程主函数之后运行的线程本地变量。
    ///
    /// 在 [原子内存排序] 方面，关联线程的完成与此函数的返回同步。
    /// 换句话说，该线程执行的所有操作
    /// In other words, all operations performed by that thread
    /// [happen before](https://doc.rust-lang.org/nomicon/atomics.html#data-accesses)
    /// all operations that happen after `join` returns.
    ///
    /// If the associated thread panics, [`Err`] is returned with the panic payload.
    ///
    /// [atomic memory orderings]: crate::sync::atomic
    ///
    /// # 示例
    ///
    /// ```
    /// use std::thread;
    ///
    /// thread::scope(|s| {
    ///     let t = s.spawn(|| {
    ///         panic!("oh no");
    ///     });
    ///     assert!(t.join().is_err());
    /// });
    /// ```
    #[stable(feature = "scoped_threads", since = "1.63.0")]
    pub fn join(self) -> Result<T> {
        self.0.join()
    }

    /// 检查关联线程是否已完成其主函数的运行。
    ///
    /// `is_finished` supports implementing a non-blocking join operation, by checking
    /// `is_finished`, and calling `join` if it returns `true`. This function does not block. To
    /// block while waiting on the thread to finish, use [`join`][Self::join].
    ///
    /// This might return `true` for a brief moment after the thread's main
    /// function has returned, but before the thread itself has stopped running.
    /// However, once this returns `true`, [`join`][Self::join] can be expected
    /// to return quickly, without blocking for any significant amount of time.
    #[stable(feature = "scoped_threads", since = "1.63.0")]
    pub fn is_finished(&self) -> bool {
        self.0.is_finished()
    }
}

#[stable(feature = "scoped_threads", since = "1.63.0")]
impl fmt::Debug for Scope<'_, '_> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Scope")
            .field("num_running_threads", &self.data.num_running_threads.load(Ordering::Relaxed))
            .field("a_thread_panicked", &self.data.a_thread_panicked.load(Ordering::Relaxed))
            .field("main_thread", &self.data.main_thread)
            .finish_non_exhaustive()
    }
}

#[stable(feature = "scoped_threads", since = "1.63.0")]
impl<'scope, T> fmt::Debug for ScopedJoinHandle<'scope, T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("ScopedJoinHandle").finish_non_exhaustive()
    }
}
