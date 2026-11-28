use crate::fmt;
use crate::panic::RefUnwindSafe;
use crate::sync::nonpoison::{Condvar, Mutex};

/// 屏障使得多个线程能够同步某些计算的开始阶段。
/// # 示例
///
/// # 示例
///
/// ```
/// use std::sync::Barrier;
/// use std::thread;
///
/// let n = 10;
/// let barrier = Barrier::new(n);
/// thread::scope(|s| {
///     for _ in 0..n {
///         // The same messages will be printed together.
///         // You will NOT see any interleaving.
///         s.spawn(|| {
///             println!("before wait");
///             barrier.wait();
///             println!("after wait");
///         });
///     }
/// });
/// ```
#[stable(feature = "rust1", since = "1.0.0")]
pub struct Barrier {
    lock: Mutex<BarrierState>,
    cvar: Condvar,
    num_threads: usize,
}

#[stable(feature = "unwind_safe_lock_refs", since = "1.12.0")]
impl RefUnwindSafe for Barrier {}

// The inner state of a double barrier
struct BarrierState {
    count: usize,
    generation_id: usize,
}

/// A `BarrierWaitResult` is returned by [`Barrier::wait()`] when all threads
/// in the [`Barrier`] have rendezvoused.
///
/// # 示例
///
/// ```
/// use std::sync::Barrier;
///
/// let barrier = Barrier::new(1);
/// let barrier_wait_result = barrier.wait();
/// ```
#[stable(feature = "rust1", since = "1.0.0")]
pub struct BarrierWaitResult(bool);

#[stable(feature = "std_debug", since = "1.16.0")]
impl fmt::Debug for Barrier {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Barrier").finish_non_exhaustive()
    }
}

impl Barrier {
    /// 创建一个可以阻止指定数量线程执行的屏障。
    ///
    /// A barrier will block all threads which call [`wait()`] until the `n`th thread calls [`wait()`],
    /// 然后一次性唤醒所有线程。
    ///
    /// [`wait()`]: Barrier::wait
    ///
    /// # 示例
    ///
    /// ```
    /// use std::sync::Barrier;
    ///
    /// let barrier = Barrier::new(10);
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_barrier", since = "1.78.0")]
    #[must_use]
    #[inline]
    pub const fn new(n: usize) -> Barrier {
        Barrier {
            lock: Mutex::new(BarrierState { count: 0, generation_id: 0 }),
            cvar: Condvar::new(),
            num_threads: n,
        }
    }

    /// 阻止当前线程，直到所有线程在此完成 rendezvousing。
    ///
    /// 所有线程完成一次 rendezvousing 后，屏障可以再次使用，并且可以
    /// 连续使用。
    ///
    /// A single (arbitrary) thread will receive a [`BarrierWaitResult`] that
    /// returns `true` from [`BarrierWaitResult::is_leader()`] when returning
    /// 所有其他线程将收到一个结果，
    /// will return `false` from [`BarrierWaitResult::is_leader()`].
    ///
    /// # 示例
    ///
    /// ```
    /// use std::sync::Barrier;
    /// use std::thread;
    ///
    /// let n = 10;
    /// let barrier = Barrier::new(n);
    /// thread::scope(|s| {
    ///     for _ in 0..n {
    ///         // The same messages will be printed together.
    ///         // You will NOT see any interleaving.
    ///         s.spawn(|| {
    ///             println!("before wait");
    ///             barrier.wait();
    ///             println!("after wait");
    ///         });
    ///     }
    /// });
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn wait(&self) -> BarrierWaitResult {
        let mut lock = self.lock.lock();
        let local_gen = lock.generation_id;
        lock.count += 1;
        if lock.count < self.num_threads {
            self.cvar.wait_while(&mut lock, |state| local_gen == state.generation_id);
            BarrierWaitResult(false)
        } else {
            lock.count = 0;
            lock.generation_id = lock.generation_id.wrapping_add(1);
            self.cvar.notify_all();
            BarrierWaitResult(true)
        }
    }
}

#[stable(feature = "std_debug", since = "1.16.0")]
impl fmt::Debug for BarrierWaitResult {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("BarrierWaitResult").field("is_leader", &self.is_leader()).finish()
    }
}

impl BarrierWaitResult {
    /// Returns `true` if this thread is the "leader thread" for the call to
    /// [`Barrier::wait()`].
    ///
    /// Only one thread will have `true` returned from their result, all other
    /// threads will have `false` returned.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::sync::Barrier;
    ///
    /// let barrier = Barrier::new(1);
    /// let barrier_wait_result = barrier.wait();
    /// println!("{:?}", barrier_wait_result.is_leader());
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[must_use]
    pub fn is_leader(&self) -> bool {
        self.0
    }
}
