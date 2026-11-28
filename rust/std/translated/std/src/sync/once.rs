//! 一种“一次性初始化”基础类型
//!
//! 该基础类型用于执行一次性初始化操作。
//! 一个示例应用场景是初始化 FFI 库。

use crate::fmt;
use crate::panic::{RefUnwindSafe, UnwindSafe};
use crate::sys::sync as sys;

/// 用于一次性全局执行的低级同步基础类型。
///
/// Previously this was the only "execute once" synchronization in `std`.
/// Other libraries implemented novel synchronizing types with `Once`, like
/// [`OnceLock<T>`] or [`LazyLock<T, F>`], before those were added to `std`.
/// `OnceLock<T>` in particular supersedes `Once` in functionality and should
/// be preferred for the common case where the `Once` is associated with data.
///
/// This type can only be constructed with [`Once::new()`].
///
/// # 示例
///
/// ```
/// use std::sync::Once;
///
/// static START: Once = Once::new();
///
/// START.call_once(|| {
///     // run initialization here
/// });
/// ```
///
/// [`OnceLock<T>`]: crate::sync::OnceLock
/// [`LazyLock<T, F>`]: crate::sync::LazyLock
#[stable(feature = "rust1", since = "1.0.0")]
pub struct Once {
    inner: sys::Once,
}

#[stable(feature = "sync_once_unwind_safe", since = "1.59.0")]
impl UnwindSafe for Once {}

#[stable(feature = "sync_once_unwind_safe", since = "1.59.0")]
impl RefUnwindSafe for Once {}

/// State yielded to [`Once::call_once_force()`]’s closure parameter. The state
/// can be used to query the poison status of the [`Once`].
#[stable(feature = "once_poison", since = "1.51.0")]
pub struct OnceState {
    pub(crate) inner: sys::OnceState,
}

/// Used for the internal implementation of `sys::sync::once` on different platforms and the
/// [`LazyLock`](crate::sync::LazyLock) implementation.
pub(crate) enum OnceExclusiveState {
    Incomplete,
    Poisoned,
    Complete,
}

/// Initialization value for static [`Once`] values.
///
/// # 示例
///
/// ```
/// use std::sync::{Once, ONCE_INIT};
///
/// static START: Once = ONCE_INIT;
/// ```
#[stable(feature = "rust1", since = "1.0.0")]
#[deprecated(
    since = "1.38.0",
    note = "the `Once::new()` function is now preferred",
    suggestion = "Once::new()"
)]
#[expect(clippy::declare_interior_mutable_const, reason = "legacy Once initializer")]
pub const ONCE_INIT: Once = Once::new();

impl Once {
    /// Creates a new `Once` value.
    #[inline]
    #[stable(feature = "once_new", since = "1.2.0")]
    #[rustc_const_stable(feature = "const_once_new", since = "1.32.0")]
    #[must_use]
    pub const fn new() -> Once {
        Once { inner: sys::Once::new() }
    }

    /// Creates a new `Once` value that starts already completed.
    #[inline]
    #[must_use]
    pub(crate) const fn new_complete() -> Once {
        Once { inner: sys::Once::new_complete() }
    }

    /// Performs an initialization routine once and only once. The given closure
    /// will be executed if this is the first time `call_once` has been called,
    /// 如果此时正在运行其他初始化过程，该方法会阻塞调用线程。
    ///
    /// 如果另一个初始化过程正在运行，此方法会阻塞调用线程。
    /// 当该函数返回时，可以保证某些初始化过程已执行并完成（可能不是指定的闭包）。同时
    ///
    /// 可以保证由执行过的闭包进行的任何内存写入在此时都能被其他线程可靠地观察到（存在
    /// 闭包与返回后执行的代码之间的“前序”关系）。
    /// guaranteed that any memory writes performed by the executed closure can
    /// 具体行为未指定：允许的结果包括
    /// panic 或死锁。
    /// # 示例
    ///
    /// If the given closure recursively invokes `call_once` on the same [`Once`]
    /// instance, the exact behavior is not specified: allowed outcomes are
    /// a panic or a deadlock.
    ///
    /// # 这与 [使用互斥锁中毒][poisoning with mutexes] 类似，但此机制
    ///
    /// ```
    /// use std::sync::Once;
    ///
    /// static mut VAL: usize = 0;
    /// static INIT: Once = Once::new();
    ///
    /// // Accessing a `static mut` is unsafe much of the time, but if we do so
    /// // in a synchronized fashion (e.g., write once or read all) then we're
    /// // good to go!
    /// //
    /// // This function will only call `expensive_computation` once, and will
    /// // otherwise always return the value returned from the first invocation.
    /// fn get_cached_val() -> usize {
    ///     unsafe {
    ///         INIT.call_once(|| {
    ///             VAL = expensive_computation();
    ///         });
    ///         VAL
    ///     }
    /// }
    ///
    /// fn expensive_computation() -> usize {
    ///     // ...
    /// # 2
    /// }
    /// ```
    ///
    /// # Panics
    ///
    /// The closure `f` will only be executed once even if this is called
    /// concurrently amongst many threads. If that closure panics, however, then
    /// it will *poison* this [`Once`] instance, causing all future invocations of
    /// `call_once` to also panic.
    ///
    /// This is similar to [poisoning with mutexes][poison], but this mechanism
    /// is guaranteed to never skip panics within `f`.
    ///
    /// [poison]: struct.Mutex.html#poisoning
    #[inline]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[track_caller]
    #[lint::should_not_be_called_on_const_items]
    pub fn call_once<F>(&self, f: F)
    where
        F: FnOnce(),
    {
        // Fast path check
        if self.inner.is_completed() {
            return;
        }

        let mut f = Some(f);
        self.inner.call(false, &mut |_| f.take().unwrap()());
    }

    /// Performs the same function as [`call_once()`] except ignores poisoning.
    ///
    /// Unlike [`call_once()`], if this [`Once`] has been poisoned (i.e., a previous
    /// call to [`call_once()`] or [`call_once_force()`] caused a panic), calling
    /// [`call_once_force()`] will still invoke the closure `f` and will _not_
    /// result in an immediate panic. If `f` panics, the [`Once`] will remain
    /// in a poison state. If `f` does _not_ panic, the [`Once`] will no
    /// longer be in a poison state and all future calls to [`call_once()`] or
    /// [`call_once_force()`] will be no-ops.
    ///
    /// The closure `f` is yielded a [`OnceState`] structure which can be used
    /// to query the poison status of the [`Once`].
    ///
    /// [`call_once()`]: Once::call_once
    /// [`call_once_force()`]: Once::call_once_force
    ///
    /// # Examples
    ///
    /// ```
    /// use std::sync::Once;
    /// use std::thread;
    ///
    /// static INIT: Once = Once::new();
    ///
    /// // poison the once
    /// let handle = thread::spawn(|| {
    ///     INIT.call_once(|| panic!());
    /// });
    /// assert!(handle.join().is_err());
    ///
    /// // poisoning propagates
    /// let handle = thread::spawn(|| {
    ///     INIT.call_once(|| {});
    /// });
    /// assert!(handle.join().is_err());
    ///
    /// // call_once_force will still run and reset the poisoned state
    /// INIT.call_once_force(|state| {
    ///     assert!(state.is_poisoned());
    /// });
    ///
    /// // once any success happens, we stop propagating the poison
    /// INIT.call_once(|| {});
    /// ```
    #[inline]
    #[stable(feature = "once_poison", since = "1.51.0")]
    #[lint::should_not_be_called_on_const_items]
    pub fn call_once_force<F>(&self, f: F)
    where
        F: FnOnce(&OnceState),
    {
        // Fast path check
        if self.inner.is_completed() {
            return;
        }

        let mut f = Some(f);
        self.inner.call(true, &mut |p| f.take().unwrap()(p));
    }

    /// Returns `true` if some [`call_once()`] call has completed
    /// successfully. Specifically, `is_completed` will return false in
    /// the following situations:
    ///   * [`call_once()`] was not called at all,
    ///   * [`call_once()`] was called, but has not yet completed,
    ///   * the [`Once`] instance is poisoned
    ///
    /// This function returning `false` does not mean that [`Once`] has not been
    /// executed. For example, it may have been executed in the time between
    /// when `is_completed` starts executing and when it returns, in which case
    /// the `false` return value would be stale (but still permissible).
    ///
    /// [`call_once()`]: Once::call_once
    ///
    /// # 示例
    ///
    /// ```
    /// use std::sync::Once;
    ///
    /// static INIT: Once = Once::new();
    ///
    /// assert_eq!(INIT.is_completed(), false);
    /// INIT.call_once(|| {
    ///     assert_eq!(INIT.is_completed(), false);
    /// });
    /// assert_eq!(INIT.is_completed(), true);
    /// ```
    ///
    /// ```
    /// use std::sync::Once;
    /// use std::thread;
    ///
    /// static INIT: Once = Once::new();
    ///
    /// assert_eq!(INIT.is_completed(), false);
    /// let handle = thread::spawn(|| {
    ///     INIT.call_once(|| panic!());
    /// });
    /// assert!(handle.join().is_err());
    /// assert_eq!(INIT.is_completed(), false);
    /// ```
    #[stable(feature = "once_is_completed", since = "1.43.0")]
    #[inline]
    pub fn is_completed(&self) -> bool {
        self.inner.is_completed()
    }

    /// 阻塞当前线程，直到初始化完成。
    ///
    /// # 示例
    ///
    /// ```rust
    /// use std::sync::Once;
    /// use std::thread;
    ///
    /// static READY: Once = Once::new();
    ///
    /// let thread = thread::spawn(|| {
    ///     READY.wait();
    ///     println!("everything is ready");
    /// });
    ///
    /// READY.call_once(|| println!("performing setup"));
    /// ```
    ///
    /// # panic
    ///
    /// If this [`Once`] has been poisoned because an initialization closure has
    /// panicked, this method will also panic. Use [`wait_force`](Self::wait_force)
    /// 阻塞当前线程，直到初始化完成，忽略中毒情况。
    #[inline]
    #[stable(feature = "once_wait", since = "1.86.0")]
    #[lint::should_not_be_called_on_const_items]
    pub fn wait(&self) {
        if !self.inner.is_completed() {
            self.inner.wait(false);
        }
    }

    /// Blocks the current thread until initialization has completed, ignoring
    /// poisoning.
    ///
    /// If this [`Once`] has been poisoned, this function blocks until it
    /// becomes completed, unlike [`Once::wait()`], which panics in this case.
    #[inline]
    #[stable(feature = "once_wait", since = "1.86.0")]
    #[lint::should_not_be_called_on_const_items]
    pub fn wait_force(&self) {
        if !self.inner.is_completed() {
            self.inner.wait(true);
        }
    }

    /// Returns the current state of the `Once` instance.
    ///
    /// 由于此方法需要可变引用，目前无法进行初始化，因此状态只能是“未完成”、“中毒”或“完成”。
    /// be running, so the state must be either "incomplete", "poisoned" or
    /// 由于此方法需要可变引用，目前无法进行初始化，因此状态只能是“未完成”、“中毒”或“完成”。
    #[inline]
    pub(crate) fn state(&mut self) -> OnceExclusiveState {
        self.inner.state()
    }

    /// Sets current state of the `Once` instance.
    ///
    /// 由于此方法需要可变引用，目前无法进行初始化，因此状态只能是“未完成”、“中毒”或“完成”。
    /// be running, so the state must be either "incomplete", "poisoned" or
    /// "complete".
    #[inline]
    pub(crate) fn set_state(&mut self, new_state: OnceExclusiveState) {
        self.inner.set_state(new_state);
    }
}

#[stable(feature = "std_debug", since = "1.16.0")]
impl fmt::Debug for Once {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Once").finish_non_exhaustive()
    }
}

#[stable(feature = "once_default", since = "1.100.0")]
#[rustc_const_unstable(feature = "const_default", issue = "143894")]
const impl Default for Once {
    /// Creates a new `Once` value, same as [`Once::new`].
    #[inline]
    fn default() -> Once {
        Once::new()
    }
}

impl OnceState {
    /// Returns `true` if the associated [`Once`] was poisoned prior to the
    /// invocation of the closure passed to [`Once::call_once_force()`].
    ///
    /// # Examples
    ///
    /// A poisoned [`Once`]:
    ///
    /// ```
    /// use std::sync::Once;
    /// use std::thread;
    ///
    /// static INIT: Once = Once::new();
    ///
    /// // poison the once
    /// let handle = thread::spawn(|| {
    ///     INIT.call_once(|| panic!());
    /// });
    /// assert!(handle.join().is_err());
    ///
    /// INIT.call_once_force(|state| {
    ///     assert!(state.is_poisoned());
    /// });
    /// ```
    ///
    /// An unpoisoned [`Once`]:
    ///
    /// ```
    /// use std::sync::Once;
    ///
    /// static INIT: Once = Once::new();
    ///
    /// INIT.call_once_force(|state| {
    ///     assert!(!state.is_poisoned());
    /// });
    #[stable(feature = "once_poison", since = "1.51.0")]
    #[inline]
    pub fn is_poisoned(&self) -> bool {
        self.inner.is_poisoned()
    }

    /// Poison the associated [`Once`] without explicitly panicking.
    // NOTE: This is currently only exposed for `OnceLock`.
    #[inline]
    pub(crate) fn poison(&self) {
        self.inner.poison();
    }
}

#[stable(feature = "std_debug", since = "1.16.0")]
impl fmt::Debug for OnceState {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("OnceState").field("poisoned", &self.is_poisoned()).finish()
    }
}
