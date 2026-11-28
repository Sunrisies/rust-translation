use crate::fmt;
use crate::ops::DerefMut;
use crate::sync::WaitTimeoutResult;
use crate::sync::nonpoison::{MutexGuard, mutex};
use crate::sys::sync as sys;
use crate::time::{Duration, Instant};

/// 条件变量
///
/// 关于条件变量的更多信息，请查阅 poisoning 的文档。
/// variant of this type at [`poison::Condvar`].
///
/// # 示例
///
/// Note that this `Condvar` does **not** propagate information about threads that panic while
/// holding a lock. If you need this functionality, see [`poison::Mutex`] and [`poison::Condvar`].
///
/// ```
/// #![feature(nonpoison_mutex)]
/// #![feature(nonpoison_condvar)]
///
/// use std::sync::nonpoison::{Mutex, Condvar};
/// use std::sync::Arc;
/// use std::thread;
///
/// let pair = Arc::new((Mutex::new(false), Condvar::new()));
/// let pair2 = Arc::clone(&pair);
///
/// // Inside of our lock, spawn a new thread, and then wait for it to start.
/// thread::spawn(move || {
///     let (lock, cvar) = &*pair2;
///     let mut started = lock.lock();
///     *started = true;
///     // We notify the condvar that the value has changed.
///     cvar.notify_one();
/// });
///
/// // Wait for the thread to start up.
/// let (lock, cvar) = &*pair;
/// let mut started = lock.lock();
/// while !*started {
///     cvar.wait(&mut started);
/// }
/// ```
///
/// [`poison::Mutex`]: crate::sync::poison::Mutex
/// [`poison::Condvar`]: crate::sync::poison::Condvar
#[unstable(feature = "nonpoison_condvar", issue = "134645")]
pub struct Condvar {
    inner: sys::Condvar,
}

impl Condvar {
    /// 创建一个新的条件变量，该变量已准备好被等待并
    /// 通知。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::sync::Condvar;
    ///
    /// let condvar = Condvar::new();
    /// ```
    #[unstable(feature = "nonpoison_condvar", issue = "134645")]
    #[must_use]
    #[inline]
    pub const fn new() -> Condvar {
        Condvar { inner: sys::Condvar::new() }
    }

    /// 阻塞当前线程，直到此条件变量收到
    /// 通知。
    ///
    /// 此函数将原子地解锁指定的互斥锁（由
    /// `guard`) and block the current thread. This means that any calls
    /// to [`notify_one`] or [`notify_all`] which happen logically after the
    /// 互斥锁被解锁之后，都有可能唤醒此线程。当此
    /// 函数调用返回时，指定的锁将被重新获取。
    ///
    /// 请注意，此函数容易受到虚假唤醒的影响。条件
    /// 变量通常具有与之相关的布尔谓词，且
    /// 每次此函数返回时都必须检查谓词，
    /// 以防止虚假唤醒。
    ///
    /// # panic
    ///
    /// This function may [`panic!`] if it is used with more than one mutex
    /// # 示例
    ///
    /// [`notify_one`]: Self::notify_one
    /// [`notify_all`]: Self::notify_all
    ///
    /// # Examples
    ///
    /// ```
    /// #![feature(nonpoison_mutex)]
    /// #![feature(nonpoison_condvar)]
    ///
    /// use std::sync::nonpoison::{Mutex, Condvar};
    /// use std::sync::Arc;
    /// use std::thread;
    ///
    /// let pair = Arc::new((Mutex::new(false), Condvar::new()));
    /// let pair2 = Arc::clone(&pair);
    ///
    /// thread::spawn(move || {
    ///     let (lock, cvar) = &*pair2;
    ///     let mut started = lock.lock();
    ///     *started = true;
    ///     // We notify the condvar that the value has changed.
    ///     cvar.notify_one();
    /// });
    ///
    /// // Wait for the thread to start up.
    /// let (lock, cvar) = &*pair;
    /// let mut started = lock.lock();
    /// // As long as the value inside the `Mutex<bool>` is `false`, we wait.
    /// while !*started {
    ///     cvar.wait(&mut started);
    /// }
    /// ```
    #[unstable(feature = "nonpoison_condvar", issue = "134645")]
    pub fn wait<T>(&self, guard: &mut MutexGuard<'_, T>) {
        unsafe {
            let lock = mutex::guard_lock(guard);
            self.inner.wait(lock);
        }
    }

    /// 阻塞当前线程，直到提供的条件变为假。
    ///
    /// `condition` is checked immediately; if not met (returns `true`), this
    /// will [`wait`] for the next notification then check again. This repeats
    /// until `condition` returns `false`, in which case this function returns.
    ///
    /// 此函数将原子地解锁指定的互斥锁（由
    /// `guard`) and block the current thread. This means that any calls
    /// to [`notify_one`] or [`notify_all`] which happen logically after the
    /// 互斥锁被解锁之后，都有可能唤醒此线程。当此
    /// 函数调用返回时，指定的锁将被重新获取。
    ///
    /// [`wait`]: Self::wait
    /// [`notify_one`]: Self::notify_one
    /// [`notify_all`]: Self::notify_all
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(nonpoison_mutex)]
    /// #![feature(nonpoison_condvar)]
    ///
    /// use std::sync::nonpoison::{Mutex, Condvar};
    /// use std::sync::Arc;
    /// use std::thread;
    ///
    /// let pair = Arc::new((Mutex::new(true), Condvar::new()));
    /// let pair2 = Arc::clone(&pair);
    ///
    /// thread::spawn(move || {
    ///     let (lock, cvar) = &*pair2;
    ///     let mut pending = lock.lock();
    ///     *pending = false;
    ///     // We notify the condvar that the value has changed.
    ///     cvar.notify_one();
    /// });
    ///
    /// // Wait for the thread to start up.
    /// let (lock, cvar) = &*pair;
    /// // As long as the value inside the `Mutex<bool>` is `true`, we wait.
    /// let mut guard = lock.lock();
    /// cvar.wait_while(&mut guard, |pending| { *pending });
    /// ```
    #[unstable(feature = "nonpoison_condvar", issue = "134645")]
    pub fn wait_while<T, F>(&self, guard: &mut MutexGuard<'_, T>, mut condition: F)
    where
        F: FnMut(&mut T) -> bool,
    {
        while condition(guard.deref_mut()) {
            self.wait(guard);
        }
    }

    /// 等待此条件变量收到通知，并在指定时间后超时。
    /// specified duration.
    ///
    /// The semantics of this function are equivalent to [`wait`] except that
    /// the thread will be blocked for roughly no longer than `dur`. This
    /// method should not be used for precise timing due to anomalies such as
    /// 请注意，会尽力确保等待的时间准确。
    /// amount of time waited to be precisely `dur`.
    ///
    /// Note that the best effort is made to ensure that the time waited is
    /// 使用单调时钟测量，不受系统时间变化的影响。此函数容易受到虚假唤醒的影响。
    /// 条件变量通常关联一个布尔谓词，每次调用此函数返回时都必须检查该谓词，以防止虚假唤醒。此外，由于超时时间基于函数被调用的时刻确定，因此在循环调用此函数时需要调整超时时间。
    /// # 示例
    /// 在此条件变量上等待通知，在指定持续时间后超时。
    /// returns to protect against spurious wakeups.  Furthermore, since the timeout
    /// 请注意，会尽力确保等待时间使用单调时钟测量，不受系统时间变化的影响。
    /// when this function is called in a loop. The [`wait_timeout_while`] method
    /// lets you wait with a timeout while a predicate is true, taking care of all these concerns.
    ///
    /// The returned [`WaitTimeoutResult`] value indicates if the timeout is
    /// 在此条件变量上等待通知，在指定持续时间后超时。
    ///
    /// Like [`wait`], the lock specified will have been re-acquired when this function
    /// # 示例
    ///
    /// [`wait`]: Self::wait
    /// [`wait_timeout_while`]: Self::wait_timeout_while
    ///
    /// # 
    ///
    /// ```
    /// #![feature(nonpoison_mutex)]
    /// #![feature(nonpoison_condvar)]
    ///
    /// use std::sync::nonpoison::{Mutex, Condvar};
    /// use std::sync::Arc;
    /// use std::thread;
    /// use std::time::Duration;
    ///
    /// let pair = Arc::new((Mutex::new(false), Condvar::new()));
    /// let pair2 = Arc::clone(&pair);
    ///
    /// thread::spawn(move || {
    ///     let (lock, cvar) = &*pair2;
    ///     let mut started = lock.lock();
    ///     *started = true;
    ///     // We notify the condvar that the value has changed.
    ///     cvar.notify_one();
    /// });
    ///
    /// // wait for the thread to start up
    /// let (lock, cvar) = &*pair;
    /// let mut started = lock.lock();
    /// // as long as the value inside the `Mutex<bool>` is `false`, we wait
    /// loop {
    ///     let result = cvar.wait_timeout(&mut started, Duration::from_millis(10));
    ///     // 10 milliseconds have passed, or maybe the value changed!
    ///     if *started == true {
    ///         // We received the notification and the value has been updated, we can leave.
    ///         break
    ///     }
    /// }
    /// ```
    #[unstable(feature = "nonpoison_condvar", issue = "134645")]
    pub fn wait_timeout<T>(
        &self,
        guard: &mut MutexGuard<'_, T>,
        dur: Duration,
    ) -> WaitTimeoutResult {
        let success = unsafe {
            let lock = mutex::guard_lock(guard);
            self.inner.wait_timeout(lock, dur)
        };
        WaitTimeoutResult(!success)
    }

    /// 在此条件变量上等待通知，在指定持续时间后超时。
    /// specified duration.
    ///
    /// The semantics of this function are equivalent to [`wait_while`] except
    /// that the thread will be blocked for roughly no longer than `dur`. This
    /// 
    /// preemption or platform differences that might not cause the maximum
    /// amount of time waited to be precisely `dur`.
    ///
    /// 请注意，会尽力确保等待时间使用单调时钟测量，不受系统时间变化影响。
    /// 
    /// the system time.
    ///
    /// The returned [`WaitTimeoutResult`] value indicates if the timeout is
    /// 如果条件未满足，则表明超时已知已过去。
    ///
    /// Like [`wait_while`], the lock specified will have been re-acquired when this
    /// 
    ///
    /// [`wait_while`]: Self::wait_while
    /// [`wait_timeout`]: Self::wait_timeout
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(nonpoison_mutex)]
    /// #![feature(nonpoison_condvar)]
    ///
    /// use std::sync::nonpoison::{Mutex, Condvar};
    /// use std::sync::Arc;
    /// use std::thread;
    /// use std::time::Duration;
    ///
    /// let pair = Arc::new((Mutex::new(true), Condvar::new()));
    /// let pair2 = Arc::clone(&pair);
    ///
    /// thread::spawn(move || {
    ///     let (lock, cvar) = &*pair2;
    ///     let mut pending = lock.lock();
    ///     *pending = false;
    ///     // We notify the condvar that the value has changed.
    ///     cvar.notify_one();
    /// });
    ///
    /// // wait for the thread to start up
    /// let (lock, cvar) = &*pair;
    /// let mut guard = lock.lock();
    /// let result = cvar.wait_timeout_while(
    ///     &mut guard,
    ///     Duration::from_millis(100),
    ///     |&mut pending| pending,
    /// );
    /// if result.timed_out() {
    ///     // timed-out without the condition ever evaluating to false.
    /// }
    /// // access the locked mutex via guard
    /// ```
    #[unstable(feature = "nonpoison_condvar", issue = "134645")]
    pub fn wait_timeout_while<T, F>(
        &self,
        guard: &mut MutexGuard<'_, T>,
        dur: Duration,
        mut condition: F,
    ) -> WaitTimeoutResult
    where
        F: FnMut(&mut T) -> bool,
    {
        let start = Instant::now();

        while condition(guard.deref_mut()) {
            let timeout = match dur.checked_sub(start.elapsed()) {
                Some(timeout) => timeout,
                None => return WaitTimeoutResult(true),
            };

            self.wait_timeout(guard, timeout);
        }

        WaitTimeoutResult(false)
    }

    /// 唤醒此 condvar 上被阻塞的线程之一。
    ///
    /// 如果此条件变量上有被阻塞的线程，则会被唤醒。
    /// be woken up from its call to [`wait`] or [`wait_timeout`]. Calls to
    /// `notify_one` are not buffered in any way.
    ///
    /// To wake up all threads, see [`notify_all`].
    ///
    /// [`wait`]: Self::wait
    /// [`wait_timeout`]: Self::wait_timeout
    /// [`notify_all`]: Self::notify_all
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(nonpoison_mutex)]
    /// #![feature(nonpoison_condvar)]
    ///
    /// use std::sync::nonpoison::{Mutex, Condvar};
    /// use std::sync::Arc;
    /// use std::thread;
    ///
    /// let pair = Arc::new((Mutex::new(false), Condvar::new()));
    /// let pair2 = Arc::clone(&pair);
    ///
    /// thread::spawn(move || {
    ///     let (lock, cvar) = &*pair2;
    ///     let mut started = lock.lock();
    ///     *started = true;
    ///     // We notify the condvar that the value has changed.
    ///     cvar.notify_one();
    /// });
    ///
    /// // Wait for the thread to start up.
    /// let (lock, cvar) = &*pair;
    /// let mut started = lock.lock();
    /// // As long as the value inside the `Mutex<bool>` is `false`, we wait.
    /// while !*started {
    ///     cvar.wait(&mut started);
    /// }
    /// ```
    #[unstable(feature = "nonpoison_condvar", issue = "134645")]
    pub fn notify_one(&self) {
        self.inner.notify_one()
    }

    /// 唤醒此 condvar 上所有被阻塞的线程。
    ///
    /// This method will ensure that any current waiters on the condition
    /// variable are awoken. Calls to `notify_all()` are not buffered in any
    /// way.
    ///
    /// To wake up only one thread, see [`notify_one`].
    ///
    /// [`notify_one`]: Self::notify_one
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(nonpoison_mutex)]
    /// #![feature(nonpoison_condvar)]
    ///
    /// use std::sync::nonpoison::{Mutex, Condvar};
    /// use std::sync::Arc;
    /// use std::thread;
    ///
    /// let pair = Arc::new((Mutex::new(false), Condvar::new()));
    /// let pair2 = Arc::clone(&pair);
    ///
    /// thread::spawn(move || {
    ///     let (lock, cvar) = &*pair2;
    ///     let mut started = lock.lock();
    ///     *started = true;
    ///     // We notify the condvar that the value has changed.
    ///     cvar.notify_all();
    /// });
    ///
    /// // Wait for the thread to start up.
    /// let (lock, cvar) = &*pair;
    /// let mut started = lock.lock();
    /// // As long as the value inside the `Mutex<bool>` is `false`, we wait.
    /// while !*started {
    ///     cvar.wait(&mut started);
    /// }
    /// ```
    #[unstable(feature = "nonpoison_condvar", issue = "134645")]
    pub fn notify_all(&self) {
        self.inner.notify_all()
    }
}

#[unstable(feature = "nonpoison_condvar", issue = "134645")]
impl fmt::Debug for Condvar {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Condvar").finish_non_exhaustive()
    }
}

#[unstable(feature = "nonpoison_condvar", issue = "134645")]
impl Default for Condvar {
    /// Creates a `Condvar` which is ready to be waited on and notified.
    fn default() -> Condvar {
        Condvar::new()
    }
}
