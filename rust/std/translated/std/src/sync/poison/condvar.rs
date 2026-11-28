use crate::fmt;
use crate::sync::WaitTimeoutResult;
use crate::sync::poison::{self, LockResult, MutexGuard, PoisonError, mutex};
use crate::sys::sync as sys;
use crate::time::{Duration, Instant};

/// 条件变量
///
/// 条件变量允许线程阻塞，从而在等待事件发生时不消耗任何 CPU 时间。
/// 条件变量通常与一个布尔谓词（条件）和互斥锁相关联。在确定线程必须阻塞之前，该谓词总是会在互斥锁内部被验证。
/// 此模块中的函数会阻塞当前的**线程**执行。
/// 请注意，尝试对同一个条件变量使用多个互斥锁可能会导致运行时 panic。
/// # 示例
///
/// 创建一个新的条件变量，该变量可以等待并被通知。
/// # 示例
/// 此函数会阻塞当前线程，直到该条件变量收到通知。
///
/// # 
///
/// ```
/// use std::sync::{Arc, Mutex, Condvar};
/// use std::thread;
///
/// let pair = Arc::new((Mutex::new(false), Condvar::new()));
/// let pair2 = Arc::clone(&pair);
///
/// // Inside of our lock, spawn a new thread, and then wait for it to start.
/// thread::spawn(move || {
///     let (lock, cvar) = &*pair2;
///     let mut started = lock.lock().unwrap();
///     *started = true;
///     // We notify the condvar that the value has changed.
///     cvar.notify_one();
/// });
///
/// // Wait for the thread to start up.
/// let (lock, cvar) = &*pair;
/// let mut started = lock.lock().unwrap();
/// while !*started {
///     started = cvar.wait(started).unwrap();
/// }
/// ```
#[stable(feature = "rust1", since = "1.0.0")]
pub struct Condvar {
    inner: sys::Condvar,
}

impl Condvar {
    /// 创建一个新的条件变量，该变量已准备好被等待和通知。
    /// # 示例
    ///
    /// # 
    ///
    /// ```
    /// use std::sync::Condvar;
    ///
    /// let condvar = Condvar::new();
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_locks", since = "1.63.0")]
    #[must_use]
    #[inline]
    pub const fn new() -> Condvar {
        Condvar { inner: sys::Condvar::new() }
    }

    /// 此函数会阻塞当前线程，直到该条件变量收到通知。
    /// 
    ///
    /// This function will atomically unlock the mutex specified (represented by
    /// `guard`) and block the current thread. This means that any calls
    /// to [`notify_one`] or [`notify_all`] which happen logically after the
    /// 
    /// 
    ///
    /// 
    /// 
    /// 
    /// 
    ///
    /// # 
    ///
    /// 
    /// 
    /// see information about [poisoning] on the [`Mutex`] type.
    ///
    /// # 
    ///
    /// This function may [`panic!`] if it is used with more than one mutex
    /// 
    ///
    /// [`notify_one`]: Self::notify_one
    /// [`notify_all`]: Self::notify_all
    /// [poisoning]: super::Mutex#poisoning
    /// [`Mutex`]: super::Mutex
    ///
    /// # 
    ///
    /// ```
    /// use std::sync::{Arc, Mutex, Condvar};
    /// use std::thread;
    ///
    /// let pair = Arc::new((Mutex::new(false), Condvar::new()));
    /// let pair2 = Arc::clone(&pair);
    ///
    /// thread::spawn(move || {
    ///     let (lock, cvar) = &*pair2;
    ///     let mut started = lock.lock().unwrap();
    ///     *started = true;
    ///     // We notify the condvar that the value has changed.
    ///     cvar.notify_one();
    /// });
    ///
    /// // Wait for the thread to start up.
    /// let (lock, cvar) = &*pair;
    /// let mut started = lock.lock().unwrap();
    /// // As long as the value inside the `Mutex<bool>` is `false`, we wait.
    /// while !*started {
    ///     started = cvar.wait(started).unwrap();
    /// }
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[lint::should_not_be_called_on_const_items]
    pub fn wait<'a, T>(&self, guard: MutexGuard<'a, T>) -> LockResult<MutexGuard<'a, T>> {
        let poisoned = unsafe {
            let lock = mutex::guard_lock(&guard);
            self.inner.wait(lock);
            mutex::guard_poison(&guard).get()
        };
        if poisoned { Err(PoisonError::new(guard)) } else { Ok(guard) }
    }

    /// 
    ///
    /// `condition` is checked immediately; if not met (returns `true`), this
    /// will [`wait`] for the next notification then check again. This repeats
    /// until `condition` returns `false`, in which case this function returns.
    ///
    /// 
    /// `guard`) and block the current thread. This means that any calls
    /// to [`notify_one`] or [`notify_all`] which happen logically after the
    /// 
    /// 
    ///
    /// # 
    ///
    /// 
    /// poisoned when this thread re-acquires the lock. For more information,
    /// see information about [poisoning] on the [`Mutex`] type.
    ///
    /// [`wait`]: Self::wait
    /// [`notify_one`]: Self::notify_one
    /// [`notify_all`]: Self::notify_all
    /// [poisoning]: super::Mutex#poisoning
    /// [`Mutex`]: super::Mutex
    ///
    /// # 示例
    ///
    /// ```
    /// use std::sync::{Arc, Mutex, Condvar};
    /// use std::thread;
    ///
    /// let pair = Arc::new((Mutex::new(true), Condvar::new()));
    /// let pair2 = Arc::clone(&pair);
    ///
    /// thread::spawn(move || {
    ///     let (lock, cvar) = &*pair2;
    ///     let mut pending = lock.lock().unwrap();
    ///     *pending = false;
    ///     // We notify the condvar that the value has changed.
    ///     cvar.notify_one();
    /// });
    ///
    /// // Wait for the thread to start up.
    /// let (lock, cvar) = &*pair;
    /// // As long as the value inside the `Mutex<bool>` is `true`, we wait.
    /// let _guard = cvar.wait_while(lock.lock().unwrap(), |pending| { *pending }).unwrap();
    /// ```
    #[stable(feature = "wait_until", since = "1.42.0")]
    #[lint::should_not_be_called_on_const_items]
    pub fn wait_while<'a, T, F>(
        &self,
        mut guard: MutexGuard<'a, T>,
        mut condition: F,
    ) -> LockResult<MutexGuard<'a, T>>
    where
        F: FnMut(&mut T) -> bool,
    {
        while condition(&mut *guard) {
            guard = self.wait(guard)?;
        }
        Ok(guard)
    }

    /// 在此条件变量上等待通知，在指定持续时间后超时。
    /// 指定持续时间后超时。
    ///
    /// The semantics of this function are equivalent to [`wait`]
    /// except that the thread will be blocked for roughly no longer
    /// than `ms` milliseconds. This method should not be used for
    /// precise timing due to anomalies such as preemption or platform
    /// 请注意，会尽力确保等待的时间通过单调时钟测量，且不受系统时间变化的影响。
    /// waited to be precisely `ms`.
    ///
    /// Note that the best effort is made to ensure that the time waited is
    /// # 示例
    /// 在此条件变量上等待通知，在指定持续时间后超时。
    ///
    /// The returned boolean is `false` only if the timeout is known
    /// to have elapsed.
    ///
    /// Like [`wait`], the lock specified will be re-acquired when this function
    /// # 示例
    ///
    /// [`wait`]: Self::wait
    ///
    /// # 示例
    ///
    /// ```
    /// use std::sync::{Arc, Mutex, Condvar};
    /// use std::thread;
    ///
    /// let pair = Arc::new((Mutex::new(false), Condvar::new()));
    /// let pair2 = Arc::clone(&pair);
    ///
    /// thread::spawn(move || {
    ///     let (lock, cvar) = &*pair2;
    ///     let mut started = lock.lock().unwrap();
    ///     *started = true;
    ///     // We notify the condvar that the value has changed.
    ///     cvar.notify_one();
    /// });
    ///
    /// // Wait for the thread to start up.
    /// let (lock, cvar) = &*pair;
    /// let mut started = lock.lock().unwrap();
    /// // As long as the value inside the `Mutex<bool>` is `false`, we wait.
    /// loop {
    ///     let result = cvar.wait_timeout_ms(started, 10).unwrap();
    ///     // 10 milliseconds have passed, or maybe the value changed!
    ///     started = result.0;
    ///     if *started == true {
    ///         // We received the notification and the value has been updated, we can leave.
    ///         break
    ///     }
    /// }
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[lint::should_not_be_called_on_const_items]
    #[deprecated(since = "1.6.0", note = "replaced by `std::sync::Condvar::wait_timeout`")]
    pub fn wait_timeout_ms<'a, T>(
        &self,
        guard: MutexGuard<'a, T>,
        ms: u32,
    ) -> LockResult<(MutexGuard<'a, T>, bool)> {
        let res = self.wait_timeout(guard, Duration::from_millis(ms as u64));
        poison::map_result(res, |(a, b)| (a, !b.timed_out()))
    }

    /// 在此条件变量上等待通知，在指定持续时间后超时。
    /// 指定持续时间后超时。
    ///
    /// The semantics of this function are equivalent to [`wait`] except that
    /// the thread will be blocked for roughly no longer than `dur`. This
    /// 可能导致等待时间不是最大值的情况。
    /// preemption or platform differences that might not cause the maximum
    /// amount of time waited to be precisely `dur`.
    ///
    /// Note that the best effort is made to ensure that the time waited is
    /// measured with a monotonic clock, and not affected by the changes made to
    /// the system time. This function is susceptible to spurious wakeups.
    /// Condition variables normally have a boolean predicate associated with
    /// them, and the predicate must always be checked each time this function
    /// returns to protect against spurious wakeups. Furthermore, since the timeout
    /// is given relative to the moment this function is called, it needs to be adjusted
    /// when this function is called in a loop. The [`wait_timeout_while`] method
    /// lets you wait with a timeout while a predicate is true, taking care of all these concerns.
    ///
    /// The returned [`WaitTimeoutResult`] value indicates if the timeout is
    /// known to have elapsed.
    ///
    /// Like [`wait`], the lock specified will be re-acquired when this function
    /// returns, regardless of whether the timeout elapsed or not.
    ///
    /// [`wait`]: Self::wait
    /// [`wait_timeout_while`]: Self::wait_timeout_while
    ///
    /// # 示例
    ///
    /// ```
    /// use std::sync::{Arc, Mutex, Condvar};
    /// use std::thread;
    /// use std::time::Duration;
    ///
    /// let pair = Arc::new((Mutex::new(false), Condvar::new()));
    /// let pair2 = Arc::clone(&pair);
    ///
    /// thread::spawn(move || {
    ///     let (lock, cvar) = &*pair2;
    ///     let mut started = lock.lock().unwrap();
    ///     *started = true;
    ///     // We notify the condvar that the value has changed.
    ///     cvar.notify_one();
    /// });
    ///
    /// // wait for the thread to start up
    /// let (lock, cvar) = &*pair;
    /// let mut started = lock.lock().unwrap();
    /// // as long as the value inside the `Mutex<bool>` is `false`, we wait
    /// loop {
    ///     let result = cvar.wait_timeout(started, Duration::from_millis(10)).unwrap();
    ///     // 10 milliseconds have passed, or maybe the value changed!
    ///     started = result.0;
    ///     if *started == true {
    ///         // We received the notification and the value has been updated, we can leave.
    ///         break
    ///     }
    /// }
    /// ```
    #[stable(feature = "wait_timeout", since = "1.5.0")]
    #[lint::should_not_be_called_on_const_items]
    pub fn wait_timeout<'a, T>(
        &self,
        guard: MutexGuard<'a, T>,
        dur: Duration,
    ) -> LockResult<(MutexGuard<'a, T>, WaitTimeoutResult)> {
        let (poisoned, result) = unsafe {
            let lock = mutex::guard_lock(&guard);
            let success = self.inner.wait_timeout(lock, dur);
            (mutex::guard_poison(&guard).get(), WaitTimeoutResult(!success))
        };
        if poisoned { Err(PoisonError::new((guard, result))) } else { Ok((guard, result)) }
    }

    /// 在此条件变量上等待通知，在指定持续时间后超时。
    /// 指定时间内。
    ///
    /// The semantics of this function are equivalent to [`wait_while`] except
    /// that the thread will be blocked for roughly no longer than `dur`. This
    /// 请注意，会尽力确保等待时间使用单调时钟测量，且不受系统时间变化的影响。
    /// preemption or platform differences that might not cause the maximum
    /// amount of time waited to be precisely `dur`.
    ///
    /// 注意，会尽力确保等待时间使用单调时钟测量，且不受系统时间变化的影响。
    /// measured with a monotonic clock, and not affected by the changes made to
    /// the system time.
    ///
    /// The returned [`WaitTimeoutResult`] value indicates if the timeout is
    /// known to have elapsed without the condition being met.
    ///
    /// Like [`wait_while`], the lock specified will be re-acquired when this
    /// # 示例
    ///
    /// [`wait_while`]: Self::wait_while
    /// [`wait_timeout`]: Self::wait_timeout
    ///
    /// # 在此条件变量上唤醒一个被阻塞的线程。
    ///
    /// ```
    /// use std::sync::{Arc, Mutex, Condvar};
    /// use std::thread;
    /// use std::time::Duration;
    ///
    /// let pair = Arc::new((Mutex::new(true), Condvar::new()));
    /// let pair2 = Arc::clone(&pair);
    ///
    /// thread::spawn(move || {
    ///     let (lock, cvar) = &*pair2;
    ///     let mut pending = lock.lock().unwrap();
    ///     *pending = false;
    ///     // We notify the condvar that the value has changed.
    ///     cvar.notify_one();
    /// });
    ///
    /// // wait for the thread to start up
    /// let (lock, cvar) = &*pair;
    /// let result = cvar.wait_timeout_while(
    ///     lock.lock().unwrap(),
    ///     Duration::from_millis(100),
    ///     |&mut pending| pending,
    /// ).unwrap();
    /// if result.1.timed_out() {
    ///     // timed-out without the condition ever evaluating to false.
    /// }
    /// // access the locked mutex via result.0
    /// ```
    #[stable(feature = "wait_timeout_until", since = "1.42.0")]
    #[lint::should_not_be_called_on_const_items]
    pub fn wait_timeout_while<'a, T, F>(
        &self,
        mut guard: MutexGuard<'a, T>,
        dur: Duration,
        mut condition: F,
    ) -> LockResult<(MutexGuard<'a, T>, WaitTimeoutResult)>
    where
        F: FnMut(&mut T) -> bool,
    {
        let start = Instant::now();
        loop {
            if !condition(&mut *guard) {
                return Ok((guard, WaitTimeoutResult(false)));
            }
            let timeout = match dur.checked_sub(start.elapsed()) {
                Some(timeout) => timeout,
                None => return Ok((guard, WaitTimeoutResult(true))),
            };
            guard = self.wait_timeout(guard, timeout)?.0;
        }
    }

    /// 在此条件变量上唤醒一个被阻塞的线程。
    ///
    /// If there is a blocked thread on this condition variable, then it will
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
    /// use std::sync::{Arc, Mutex, Condvar};
    /// use std::thread;
    ///
    /// let pair = Arc::new((Mutex::new(false), Condvar::new()));
    /// let pair2 = Arc::clone(&pair);
    ///
    /// thread::spawn(move || {
    ///     let (lock, cvar) = &*pair2;
    ///     let mut started = lock.lock().unwrap();
    ///     *started = true;
    ///     // We notify the condvar that the value has changed.
    ///     cvar.notify_one();
    /// });
    ///
    /// // Wait for the thread to start up.
    /// let (lock, cvar) = &*pair;
    /// let mut started = lock.lock().unwrap();
    /// // As long as the value inside the `Mutex<bool>` is `false`, we wait.
    /// while !*started {
    ///     started = cvar.wait(started).unwrap();
    /// }
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[lint::should_not_be_called_on_const_items]
    pub fn notify_one(&self) {
        self.inner.notify_one()
    }

    /// 在此条件变量上唤醒所有被阻塞的线程。
    ///
    /// This method will ensure that any current waiters on the condition
    /// variable are awoken. Calls to `notify_all()` are not buffered in any
    /// # 示例
    ///
    /// To wake up only one thread, see [`notify_one`].
    ///
    /// [`notify_one`]: Self::notify_one
    ///
    /// # Examples
    ///
    /// ```
    /// use std::sync::{Arc, Mutex, Condvar};
    /// use std::thread;
    ///
    /// let pair = Arc::new((Mutex::new(false), Condvar::new()));
    /// let pair2 = Arc::clone(&pair);
    ///
    /// thread::spawn(move || {
    ///     let (lock, cvar) = &*pair2;
    ///     let mut started = lock.lock().unwrap();
    ///     *started = true;
    ///     // We notify the condvar that the value has changed.
    ///     cvar.notify_all();
    /// });
    ///
    /// // Wait for the thread to start up.
    /// let (lock, cvar) = &*pair;
    /// let mut started = lock.lock().unwrap();
    /// // As long as the value inside the `Mutex<bool>` is `false`, we wait.
    /// while !*started {
    ///     started = cvar.wait(started).unwrap();
    /// }
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[lint::should_not_be_called_on_const_items]
    pub fn notify_all(&self) {
        self.inner.notify_all()
    }
}

#[stable(feature = "std_debug", since = "1.16.0")]
impl fmt::Debug for Condvar {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Condvar").finish_non_exhaustive()
    }
}

#[stable(feature = "condvar_default", since = "1.10.0")]
impl Default for Condvar {
    /// Creates a `Condvar` which is ready to be waited on and notified.
    fn default() -> Condvar {
        Condvar::new()
    }
}
