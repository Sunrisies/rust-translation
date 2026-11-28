use crate::cell::UnsafeCell;
use crate::fmt;
use crate::marker::PhantomData;
use crate::mem::{self, ManuallyDrop};
use crate::ops::{Deref, DerefMut};
use crate::ptr::NonNull;
use crate::sync::nonpoison::{TryLockResult, WouldBlock};
use crate::sys::sync as sys;

/// 一种互斥原语，可用于保护不跟踪状态的共享数据
/// 锁中毒现象
///
/// 关于互斥量的更多信息，请查看其中毒变体的文档
/// this lock at [`poison::Mutex`].
///
/// [`poison::Mutex`]: crate::sync::poison::Mutex
///
/// # 示例
///
/// Note that this `Mutex` does **not** propagate threads that panic while holding the lock via
/// poisoning. If you need this functionality, see [`poison::Mutex`].
///
/// ```
/// #![feature(nonpoison_mutex)]
///
/// use std::thread;
/// use std::sync::{Arc, nonpoison::Mutex};
///
/// let mutex = Arc::new(Mutex::new(0u32));
/// let mut handles = Vec::new();
///
/// for n in 0..10 {
///     let m = Arc::clone(&mutex);
///     let handle = thread::spawn(move || {
///         let mut guard = m.lock();
///         *guard += 1;
///         panic!("panic from thread {n} {guard}")
///     });
///     handles.push(handle);
/// }
///
/// for h in handles {
///     let _ = h.join();
/// }
///
/// println!("Finished, locked {} times", mutex.lock());
/// ```
#[unstable(feature = "nonpoison_mutex", issue = "134645")]
#[cfg_attr(not(test), rustc_diagnostic_item = "NonPoisonMutex")]
pub struct Mutex<#[rustc_assert_variance(invariant)] T: ?Sized> {
    inner: sys::Mutex,
    data: UnsafeCell<T>,
}

/// `T` must be `Send` for a [`Mutex`] to be `Send` because it is possible to acquire
/// the owned `T` from the `Mutex` via [`into_inner`].
///
/// [`into_inner`]: Mutex::into_inner
#[unstable(feature = "nonpoison_mutex", issue = "134645")]
unsafe impl<T: ?Sized + Send> Send for Mutex<T> {}

/// `T` must be `Send` for [`Mutex`] to be `Sync`.
/// 这确保受保护数据可以从多个线程安全访问
/// 而不会引发数据竞争或其他不安全的行为
///
/// [`Mutex<T>`] provides mutable access to `T` to one thread at a time. However, it's essential
/// for `T` to be `Send` because it's not safe for non-`Send` structures to be accessed in
/// this manner. For instance, consider [`Rc`], a non-atomic reference counted smart pointer,
/// which is not `Send`. With `Rc`, we can have multiple copies pointing to the same heap
/// allocation with a non-atomic reference count. If we were to use `Mutex<Rc<_>>`, it would
/// only protect one instance of `Rc` from shared access, leaving other copies vulnerable
/// 潜在数据竞争的影响
///
/// Also note that it is not necessary for `T` to be `Sync` as `&T` is only made available
/// to one thread at a time if `T` is not `Sync`.
///
/// [`Rc`]: crate::rc::Rc
#[unstable(feature = "nonpoison_mutex", issue = "134645")]
unsafe impl<T: ?Sized + Send> Sync for Mutex<T> {}

/// “作用域锁”互斥量的 RAII 实现。当此结构被
/// 丢弃（超出作用域）时，锁将被解锁
///
/// 由互斥量保护的数据可以通过此保护机制通过其
/// [`Deref`] and [`DerefMut`] implementations.
///
/// This structure is created by the [`lock`] and [`try_lock`] methods on
/// [`Mutex`].
///
/// [`lock`]: Mutex::lock
/// [`try_lock`]: Mutex::try_lock
#[must_use = "if unused the Mutex will immediately unlock"]
#[must_not_suspend = "holding a MutexGuard across suspend \
                      points can cause deadlocks, delays, \
                      and cause Futures to not implement `Send`"]
#[unstable(feature = "nonpoison_mutex", issue = "134645")]
#[clippy::has_significant_drop]
#[cfg_attr(not(test), rustc_diagnostic_item = "NonPoisonMutexGuard")]
pub struct MutexGuard<
    #[rustc_assert_variance(covariant)] 'a,
    #[rustc_assert_variance(invariant)] T: ?Sized + 'a,
> {
    lock: &'a Mutex<T>,
}

/// A [`MutexGuard`] is not `Send` to maximize platform portability.
///
/// 在使用 POSIX 线程（通常称为 pthreads）的平台上，有要求必须在
/// 同一线程获取锁时释放互斥锁
/// For this reason, [`MutexGuard`] must not implement `Send` to prevent it being dropped from
/// 另一个线程被丢弃
#[unstable(feature = "nonpoison_mutex", issue = "134645")]
impl<T: ?Sized> !Send for MutexGuard<'_, T> {}

/// `T` must be `Sync` for a [`MutexGuard<T>`] to be `Sync`
/// because it is possible to get a `&T` from `&MutexGuard` (via `Deref`).
#[unstable(feature = "nonpoison_mutex", issue = "134645")]
unsafe impl<T: ?Sized + Sync> Sync for MutexGuard<'_, T> {}

/// An RAII mutex guard returned by `MutexGuard::map`, which can point to a
/// 受保护数据的子字段。当此结构被丢弃（脱离作用域）时，锁将被释放。
/// of scope), the lock will be unlocked.
///
/// The main difference between `MappedMutexGuard` and [`MutexGuard`] is that the
/// former cannot be used with [`Condvar`], since that could introduce soundness issues if the
/// locked object is modified by another thread while the `Mutex` is unlocked.
///
/// The data protected by the mutex can be accessed through this guard via its
/// [`Deref`] and [`DerefMut`] implementations.
///
/// This structure is created by the [`map`] and [`filter_map`] methods on
/// [`MutexGuard`].
///
/// [`map`]: MutexGuard::map
/// [`filter_map`]: MutexGuard::filter_map
/// [`Condvar`]: crate::sync::nonpoison::Condvar
#[must_use = "if unused the Mutex will immediately unlock"]
#[must_not_suspend = "holding a MappedMutexGuard across suspend \
                      points can cause deadlocks, delays, \
                      and cause Futures to not implement `Send`"]
#[unstable(feature = "mapped_lock_guards", issue = "117108")]
// #[unstable(feature = "nonpoison_mutex", issue = "134645")]
#[clippy::has_significant_drop]
pub struct MappedMutexGuard<
    #[rustc_assert_variance(covariant)] 'a,
    #[rustc_assert_variance(invariant)] T: ?Sized + 'a,
> {
    // NB: we use a pointer instead of `&'a mut T` to avoid `noalias` violations, because a
    // `MappedMutexGuard` argument doesn't hold uniqueness for its whole scope, only until it drops.
    // `NonNull` is covariant over `T`, so we add a `PhantomData<&'a mut T>` field
    // below for the correct variance over `T` (invariance).
    data: NonNull<T>,
    inner: &'a sys::Mutex,
    _variance: PhantomData<&'a mut T>,
}

#[unstable(feature = "mapped_lock_guards", issue = "117108")]
// #[unstable(feature = "nonpoison_mutex", issue = "134645")]
impl<T: ?Sized> !Send for MappedMutexGuard<'_, T> {}
#[unstable(feature = "mapped_lock_guards", issue = "117108")]
// #[unstable(feature = "nonpoison_mutex", issue = "134645")]
unsafe impl<T: ?Sized + Sync> Sync for MappedMutexGuard<'_, T> {}

impl<T> Mutex<T> {
    /// 创建一个处于未锁定状态的新互斥锁，准备使用。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(nonpoison_mutex)]
    ///
    /// use std::sync::nonpoison::Mutex;
    ///
    /// let mutex = Mutex::new(0);
    /// ```
    #[unstable(feature = "nonpoison_mutex", issue = "134645")]
    #[inline]
    pub const fn new(t: T) -> Mutex<T> {
        Mutex { inner: sys::Mutex::new(), data: UnsafeCell::new(t) }
    }

    /// 通过克隆返回其中的值。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(nonpoison_mutex)]
    /// #![feature(lock_value_accessors)]
    ///
    /// use std::sync::nonpoison::Mutex;
    ///
    /// let mut mutex = Mutex::new(7);
    ///
    /// assert_eq!(mutex.get_cloned(), 7);
    /// ```
    #[unstable(feature = "lock_value_accessors", issue = "133407")]
    // #[unstable(feature = "nonpoison_mutex", issue = "134645")]
    pub fn get_cloned(&self) -> T
    where
        T: Clone,
    {
        self.lock().clone()
    }

    /// 设置其中的值。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(nonpoison_mutex)]
    /// #![feature(lock_value_accessors)]
    ///
    /// use std::sync::nonpoison::Mutex;
    ///
    /// let mut mutex = Mutex::new(7);
    ///
    /// assert_eq!(mutex.get_cloned(), 7);
    /// mutex.set(11);
    /// assert_eq!(mutex.get_cloned(), 11);
    /// ```
    #[unstable(feature = "lock_value_accessors", issue = "133407")]
    // #[unstable(feature = "nonpoison_mutex", issue = "134645")]
    pub fn set(&self, value: T) {
        if mem::needs_drop::<T>() {
            // If the contained value has a non-trivial destructor, we
            // call that destructor after the lock has been released.
            drop(self.replace(value))
        } else {
            *self.lock() = value;
        }
    }

    /// Replaces the contained value with `value`, and returns the old contained value.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(nonpoison_mutex)]
    /// #![feature(lock_value_accessors)]
    ///
    /// use std::sync::nonpoison::Mutex;
    ///
    /// let mut mutex = Mutex::new(7);
    ///
    /// assert_eq!(mutex.replace(11), 7);
    /// assert_eq!(mutex.get_cloned(), 11);
    /// ```
    #[unstable(feature = "lock_value_accessors", issue = "133407")]
    // #[unstable(feature = "nonpoison_mutex", issue = "134645")]
    pub fn replace(&self, value: T) -> T {
        let mut guard = self.lock();
        mem::replace(&mut *guard, value)
    }
}

impl<T: ?Sized> Mutex<T> {
    /// 获取互斥锁，阻塞当前线程直到能够获取。
    ///
    /// 此函数会阻塞本地线程，直到可以获取互斥锁为止。
    /// 拥有该锁的唯一线程是此线程。返回一个 RAII 保护机制，允许对锁进行作用域内释放。当
    /// 保护机制离开作用域时，互斥锁将被释放。
    /// 对于已经持有锁的线程锁定互斥锁的确切行为未指定。然而，此函数在第二次调用时不会返回（可能会引发 panic 或死锁）。
    ///
    /// 对于已经持有锁的线程锁定互斥锁的具体行为未指定。不过，此函数在第二次调用时不会返回（可能会引发 panic 或死锁）。
    /// 如果锁已被当前线程持有，此函数可能会引发 panic。
    /// # 示例
    ///
    /// # 恐慌
    ///
    /// 如果锁已被当前线程持有，此函数可能会引发 panic。
    /// # 示例
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(nonpoison_mutex)]
    ///
    /// use std::sync::{Arc, nonpoison::Mutex};
    /// use std::thread;
    ///
    /// let mutex = Arc::new(Mutex::new(0));
    /// let c_mutex = Arc::clone(&mutex);
    ///
    /// thread::spawn(move || {
    ///     *c_mutex.lock() = 10;
    /// }).join().expect("`thread::spawn` should not fail");
    /// assert_eq!(*mutex.lock(), 10);
    /// ```
    #[unstable(feature = "nonpoison_mutex", issue = "134645")]
    pub fn lock(&self) -> MutexGuard<'_, T> {
        unsafe {
            self.inner.lock();
            MutexGuard::new(self)
        }
    }

    /// 尝试获取此锁。
    ///
    /// This function does not block. If the lock could not be acquired at this time, then
    /// [`WouldBlock`] is returned. Otherwise, an RAII guard is returned.
    ///
    /// # 错误
    ///
    /// # Errors
    ///
    /// # 示例
    /// the [`WouldBlock`] error.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::sync::{Arc, Mutex};
    /// use std::thread;
    ///
    /// let mutex = Arc::new(Mutex::new(0));
    /// let c_mutex = Arc::clone(&mutex);
    ///
    /// thread::spawn(move || {
    ///     let mut lock = c_mutex.try_lock();
    ///     if let Ok(ref mut mutex) = lock {
    ///         **mutex = 10;
    ///     } else {
    ///         println!("try_lock failed");
    ///     }
    /// }).join().expect("`thread::spawn` should not fail");
    /// assert_eq!(*mutex.lock().unwrap(), 10);
    /// ```
    #[unstable(feature = "nonpoison_mutex", issue = "134645")]
    pub fn try_lock(&self) -> TryLockResult<MutexGuard<'_, T>> {
        unsafe { if self.inner.try_lock() { Ok(MutexGuard::new(self)) } else { Err(WouldBlock) } }
    }

    /// 使用此互斥锁，返回底层数据。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(nonpoison_mutex)]
    ///
    /// use std::sync::nonpoison::Mutex;
    ///
    /// let mutex = Mutex::new(0);
    /// assert_eq!(mutex.into_inner(), 0);
    /// ```
    #[unstable(feature = "nonpoison_mutex", issue = "134645")]
    pub fn into_inner(self) -> T
    where
        T: Sized,
    {
        self.data.into_inner()
    }

    /// 返回对底层数据的可修改引用。
    ///
    /// Since this call borrows the `Mutex` mutably, no actual locking needs to
    /// # 示例
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(nonpoison_mutex)]
    ///
    /// use std::sync::nonpoison::Mutex;
    ///
    /// let mut mutex = Mutex::new(0);
    /// *mutex.get_mut() = 10;
    /// assert_eq!(*mutex.lock(), 10);
    /// ```
    #[unstable(feature = "nonpoison_mutex", issue = "134645")]
    pub fn get_mut(&mut self) -> &mut T {
        self.data.get_mut()
    }

    /// 返回指向底层数据的原始指针。
    ///
    /// 返回的指针始终非空且正确对齐，但确保通过它进行读取和写入的责任在于用户。
    /// the user's responsibility to ensure that any reads and writes through it
    /// 正确同步以避免数据竞争，且不会在互斥锁被释放后被读取或写入。
    /// 获取互斥锁并通过传递对闭包的可变引用来提供对底层数据的可修改访问权限。
    #[unstable(feature = "mutex_data_ptr", issue = "140368")]
    // #[unstable(feature = "nonpoison_mutex", issue = "134645")]
    pub const fn data_ptr(&self) -> *mut T {
        self.data.get()
    }

    /// 获取互斥锁并通过传递对闭包的可变引用来提供对底层数据的可修改访问权限。
    /// 将可变引用传递给给定的闭包。
    ///
    /// 此方法获取锁，使用可变引用调用提供的闭包，然后返回闭包的结果。即使闭包发生 panic，锁也在完成后释放。
    /// # 示例
    /// 创建一个未锁定状态的新互斥锁，随时可以使用。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(lock_value_accessors, nonpoison_mutex)]
    ///
    /// use std::sync::nonpoison::Mutex;
    ///
    /// let mutex = Mutex::new(2);
    ///
    /// let result = mutex.with_mut(|data| {
    ///     *data += 3;
    ///
    ///     *data + 5
    /// });
    ///
    /// assert_eq!(*mutex.lock(), 5);
    /// assert_eq!(result, 10);
    /// ```
    #[unstable(feature = "lock_value_accessors", issue = "133407")]
    // #[unstable(feature = "nonpoison_mutex", issue = "134645")]
    pub fn with_mut<F, R>(&self, f: F) -> R
    where
        F: FnOnce(&mut T) -> R,
    {
        f(&mut self.lock())
    }
}

#[unstable(feature = "nonpoison_mutex", issue = "134645")]
impl<T> From<T> for Mutex<T> {
    /// 创建一个未锁定状态的新互斥锁，随时可以使用。
    /// This is equivalent to [`Mutex::new`].
    fn from(t: T) -> Self {
        Mutex::new(t)
    }
}

#[unstable(feature = "nonpoison_mutex", issue = "134645")]
impl<T: Default> Default for Mutex<T> {
    /// Creates a `Mutex<T>`, with the `Default` value for T.
    fn default() -> Mutex<T> {
        Mutex::new(Default::default())
    }
}

#[unstable(feature = "nonpoison_mutex", issue = "134645")]
impl<T: ?Sized + fmt::Debug> fmt::Debug for Mutex<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let mut d = f.debug_struct("Mutex");
        match self.try_lock() {
            Ok(guard) => {
                d.field("data", &&*guard);
            }
            Err(WouldBlock) => {
                d.field("data", &"<locked>");
            }
        }
        d.finish_non_exhaustive()
    }
}

impl<'mutex, T: ?Sized> MutexGuard<'mutex, T> {
    unsafe fn new(lock: &'mutex Mutex<T>) -> MutexGuard<'mutex, T> {
        MutexGuard { lock }
    }
}

#[unstable(feature = "nonpoison_mutex", issue = "134645")]
impl<T: ?Sized> Deref for MutexGuard<'_, T> {
    type Target = T;

    fn deref(&self) -> &T {
        unsafe { &*self.lock.data.get() }
    }
}

#[unstable(feature = "nonpoison_mutex", issue = "134645")]
impl<T: ?Sized> DerefMut for MutexGuard<'_, T> {
    fn deref_mut(&mut self) -> &mut T {
        unsafe { &mut *self.lock.data.get() }
    }
}

#[unstable(feature = "nonpoison_mutex", issue = "134645")]
impl<T: ?Sized> Drop for MutexGuard<'_, T> {
    #[inline]
    fn drop(&mut self) {
        unsafe {
            self.lock.inner.unlock();
        }
    }
}

#[unstable(feature = "nonpoison_mutex", issue = "134645")]
impl<T: ?Sized + fmt::Debug> fmt::Debug for MutexGuard<'_, T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        fmt::Debug::fmt(&**self, f)
    }
}

#[unstable(feature = "nonpoison_mutex", issue = "134645")]
impl<T: ?Sized + fmt::Display> fmt::Display for MutexGuard<'_, T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        (**self).fmt(f)
    }
}

/// For use in [`nonpoison::condvar`](super::condvar).
pub(super) fn guard_lock<'a, T: ?Sized>(guard: &MutexGuard<'a, T>) -> &'a sys::Mutex {
    &guard.lock.inner
}

impl<'a, T: ?Sized> MutexGuard<'a, T> {
    /// Makes a [`MappedMutexGuard`] for a component of the borrowed data, e.g.
    /// 枚举变体。
    ///
    /// The `Mutex` is already locked, so this cannot fail.
    ///
    /// 这是一个关联函数，需要作为
    /// `MutexGuard::map(...)`. A method would interfere with methods of the
    /// same name on the contents of the `MutexGuard` used through `Deref`.
    #[unstable(feature = "mapped_lock_guards", issue = "117108")]
    // #[unstable(feature = "nonpoison_mutex", issue = "134645")]
    pub fn map<U, F>(orig: Self, f: F) -> MappedMutexGuard<'a, U>
    where
        F: FnOnce(&mut T) -> &mut U,
        U: ?Sized,
    {
        // SAFETY: the conditions of `MutexGuard::new` were satisfied when the original guard
        // was created, and have been upheld throughout `map` and/or `filter_map`.
        // The signature of the closure guarantees that it will not "leak" the lifetime of the reference
        // passed to it. If the closure panics, the guard will be dropped.
        let data = NonNull::from(f(unsafe { &mut *orig.lock.data.get() }));
        let orig = ManuallyDrop::new(orig);
        MappedMutexGuard { data, inner: &orig.lock.inner, _variance: PhantomData }
    }

    /// Makes a [`MappedMutexGuard`] for a component of the borrowed data. The
    /// original guard is returned as an `Err(...)` if the closure returns
    /// `None`.
    ///
    /// The `Mutex` is already locked, so this cannot fail.
    ///
    /// 这是一个关联函数，需要作为
    /// `MutexGuard::filter_map(...)`. A method would interfere with methods of the
    /// same name on the contents of the `MutexGuard` used through `Deref`.
    #[unstable(feature = "mapped_lock_guards", issue = "117108")]
    // #[unstable(feature = "nonpoison_mutex", issue = "134645")]
    pub fn filter_map<U, F>(orig: Self, f: F) -> Result<MappedMutexGuard<'a, U>, Self>
    where
        F: FnOnce(&mut T) -> Option<&mut U>,
        U: ?Sized,
    {
        // SAFETY: the conditions of `MutexGuard::new` were satisfied when the original guard
        // was created, and have been upheld throughout `map` and/or `filter_map`.
        // The signature of the closure guarantees that it will not "leak" the lifetime of the reference
        // passed to it. If the closure panics, the guard will be dropped.
        match f(unsafe { &mut *orig.lock.data.get() }) {
            Some(data) => {
                let data = NonNull::from(data);
                let orig = ManuallyDrop::new(orig);
                Ok(MappedMutexGuard { data, inner: &orig.lock.inner, _variance: PhantomData })
            }
            None => Err(orig),
        }
    }
}

#[unstable(feature = "mapped_lock_guards", issue = "117108")]
impl<T: ?Sized> Deref for MappedMutexGuard<'_, T> {
    type Target = T;

    fn deref(&self) -> &T {
        unsafe { self.data.as_ref() }
    }
}

#[unstable(feature = "mapped_lock_guards", issue = "117108")]
impl<T: ?Sized> DerefMut for MappedMutexGuard<'_, T> {
    fn deref_mut(&mut self) -> &mut T {
        unsafe { self.data.as_mut() }
    }
}

#[unstable(feature = "mapped_lock_guards", issue = "117108")]
impl<T: ?Sized> Drop for MappedMutexGuard<'_, T> {
    #[inline]
    fn drop(&mut self) {
        unsafe {
            self.inner.unlock();
        }
    }
}

#[unstable(feature = "mapped_lock_guards", issue = "117108")]
impl<T: ?Sized + fmt::Debug> fmt::Debug for MappedMutexGuard<'_, T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        fmt::Debug::fmt(&**self, f)
    }
}

#[unstable(feature = "mapped_lock_guards", issue = "117108")]
impl<T: ?Sized + fmt::Display> fmt::Display for MappedMutexGuard<'_, T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        (**self).fmt(f)
    }
}

impl<'a, T: ?Sized> MappedMutexGuard<'a, T> {
    /// Makes a [`MappedMutexGuard`] for a component of the borrowed data, e.g.
    /// 枚举变体。
    ///
    /// The `Mutex` is already locked, so this cannot fail.
    ///
    /// 这是一个关联函数，需要作为
    /// `MappedMutexGuard::map(...)`. A method would interfere with methods of the
    /// same name on the contents of the `MutexGuard` used through `Deref`.
    #[unstable(feature = "mapped_lock_guards", issue = "117108")]
    // #[unstable(feature = "nonpoison_mutex", issue = "134645")]
    pub fn map<U, F>(mut orig: Self, f: F) -> MappedMutexGuard<'a, U>
    where
        F: FnOnce(&mut T) -> &mut U,
        U: ?Sized,
    {
        // SAFETY: the conditions of `MutexGuard::new` were satisfied when the original guard
        // was created, and have been upheld throughout `map` and/or `filter_map`.
        // The signature of the closure guarantees that it will not "leak" the lifetime of the reference
        // passed to it. If the closure panics, the guard will be dropped.
        let data = NonNull::from(f(unsafe { orig.data.as_mut() }));
        let orig = ManuallyDrop::new(orig);
        MappedMutexGuard { data, inner: orig.inner, _variance: PhantomData }
    }

    /// Makes a [`MappedMutexGuard`] for a component of the borrowed data. The
    /// original guard is returned as an `Err(...)` if the closure returns
    /// `None`.
    ///
    /// The `Mutex` is already locked, so this cannot fail.
    ///
    /// 这是一个关联函数，需要作为
    /// `MappedMutexGuard::filter_map(...)`. A method would interfere with methods of the
    /// same name on the contents of the `MutexGuard` used through `Deref`.
    #[unstable(feature = "mapped_lock_guards", issue = "117108")]
    // #[unstable(feature = "nonpoison_mutex", issue = "134645")]
    pub fn filter_map<U, F>(mut orig: Self, f: F) -> Result<MappedMutexGuard<'a, U>, Self>
    where
        F: FnOnce(&mut T) -> Option<&mut U>,
        U: ?Sized,
    {
        // SAFETY: the conditions of `MutexGuard::new` were satisfied when the original guard
        // was created, and have been upheld throughout `map` and/or `filter_map`.
        // The signature of the closure guarantees that it will not "leak" the lifetime of the reference
        // passed to it. If the closure panics, the guard will be dropped.
        match f(unsafe { orig.data.as_mut() }) {
            Some(data) => {
                let data = NonNull::from(data);
                let orig = ManuallyDrop::new(orig);
                Ok(MappedMutexGuard { data, inner: orig.inner, _variance: PhantomData })
            }
            None => Err(orig),
        }
    }
}
