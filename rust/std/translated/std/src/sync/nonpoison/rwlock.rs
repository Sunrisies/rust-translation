use crate::cell::UnsafeCell;
use crate::fmt;
use crate::marker::PhantomData;
use crate::mem::{self, ManuallyDrop, forget};
use crate::ops::{Deref, DerefMut};
use crate::ptr::NonNull;
use crate::sync::nonpoison::{TryLockResult, WouldBlock};
use crate::sys::sync as sys;

/// 一种不记录锁中毒情况的读写锁。
///
/// 关于读写锁的更多信息，请查阅关于中毒问题的文档。
/// variant of this lock (which can be found at [`poison::RwLock`]).
///
/// [`poison::RwLock`]: crate::sync::poison::RwLock
///
/// # 示例
///
/// ```
/// #![feature(nonpoison_rwlock)]
///
/// use std::sync::nonpoison::RwLock;
///
/// let lock = RwLock::new(5);
///
/// // many reader locks can be held at once
/// {
///     let r1 = lock.read();
///     let r2 = lock.read();
///     assert_eq!(*r1, 5);
///     assert_eq!(*r2, 5);
/// } // read locks are dropped at this point
///
/// // only one write lock may be held, however
/// {
///     let mut w = lock.write();
///     *w += 1;
///     assert_eq!(*w, 6);
/// } // write lock is dropped here
/// ```
#[unstable(feature = "nonpoison_rwlock", issue = "134645")]
#[cfg_attr(not(test), rustc_diagnostic_item = "NonPoisonRwLock")]
pub struct RwLock<#[rustc_assert_variance(invariant)] T: ?Sized> {
    /// The inner [`sys::RwLock`] that synchronizes thread access to the protected data.
    inner: sys::RwLock,
    /// 被锁保护的数据。
    data: UnsafeCell<T>,
}

#[unstable(feature = "nonpoison_rwlock", issue = "134645")]
unsafe impl<T: ?Sized + Send> Send for RwLock<T> {}

#[unstable(feature = "nonpoison_rwlock", issue = "134645")]
unsafe impl<T: ?Sized + Send + Sync> Sync for RwLock<T> {}

////////////////////////////////////////////////////////////////////////////////////////////////////
// Guards
////////////////////////////////////////////////////////////////////////////////////////////////////

/// RAII 结构，用于在
/// 被丢弃时释放锁的共享读访问权限。
///
/// This structure is created by the [`read`] and [`try_read`] methods on
/// [`RwLock`].
///
/// [`read`]: RwLock::read
/// [`try_read`]: RwLock::try_read
#[must_use = "if unused the RwLock will immediately unlock"]
#[must_not_suspend = "holding a RwLockReadGuard across suspend \
                      points can cause deadlocks, delays, \
                      and cause Futures to not implement `Send`"]
#[unstable(feature = "nonpoison_rwlock", issue = "134645")]
#[clippy::has_significant_drop]
#[cfg_attr(not(test), rustc_diagnostic_item = "NonPoisonRwLockReadGuard")]
pub struct RwLockReadGuard<
    #[rustc_assert_variance(covariant)] 'rwlock,
    #[rustc_assert_variance(covariant)] T: ?Sized + 'rwlock,
> {
    /// A pointer to the data protected by the `RwLock`. Note that we use a pointer here instead of
    /// `&'rwlock T` to avoid `noalias` violations, because a `RwLockReadGuard` instance only holds
    /// 其被丢弃之前保持不可变性，而非在整个作用域内保持。
    /// `NonNull` is preferable over `*const T` to allow for niche optimizations. `NonNull` is also
    /// covariant over `T`, just like we would have with `&T`.
    data: NonNull<T>,
    /// A reference to the internal [`sys::RwLock`] that we have read-locked.
    inner_lock: &'rwlock sys::RwLock,
}

#[unstable(feature = "nonpoison_rwlock", issue = "134645")]
impl<T: ?Sized> !Send for RwLockReadGuard<'_, T> {}

#[unstable(feature = "nonpoison_rwlock", issue = "134645")]
unsafe impl<T: ?Sized + Sync> Sync for RwLockReadGuard<'_, T> {}

/// RAII 结构，用于在
/// 被丢弃时释放锁的独占写访问权限。
///
/// This structure is created by the [`write`] and [`try_write`] methods
/// on [`RwLock`].
///
/// [`write`]: RwLock::write
/// [`try_write`]: RwLock::try_write
#[must_use = "if unused the RwLock will immediately unlock"]
#[must_not_suspend = "holding a RwLockWriteGuard across suspend \
                      points can cause deadlocks, delays, \
                      and cause Future's to not implement `Send`"]
#[unstable(feature = "nonpoison_rwlock", issue = "134645")]
#[clippy::has_significant_drop]
#[cfg_attr(not(test), rustc_diagnostic_item = "NonPoisonRwLockWriteGuard")]
pub struct RwLockWriteGuard<
    #[rustc_assert_variance(covariant)] 'rwlock,
    #[rustc_assert_variance(invariant)] T: ?Sized + 'rwlock,
> {
    /// A reference to the [`RwLock`] that we have write-locked.
    lock: &'rwlock RwLock<T>,
}

#[unstable(feature = "nonpoison_rwlock", issue = "134645")]
impl<T: ?Sized> !Send for RwLockWriteGuard<'_, T> {}

#[unstable(feature = "nonpoison_rwlock", issue = "134645")]
unsafe impl<T: ?Sized + Sync> Sync for RwLockWriteGuard<'_, T> {}

/// RAII 结构，用于在
/// 被丢弃时释放锁的共享读访问权限，它可以指向受保护数据的子字段。
///
/// This structure is created by the [`map`] and [`filter_map`] methods
/// on [`RwLockReadGuard`].
///
/// [`map`]: RwLockReadGuard::map
/// [`filter_map`]: RwLockReadGuard::filter_map
#[must_use = "if unused the RwLock will immediately unlock"]
#[must_not_suspend = "holding a MappedRwLockReadGuard across suspend \
                      points can cause deadlocks, delays, \
                      and cause Futures to not implement `Send`"]
#[unstable(feature = "mapped_lock_guards", issue = "117108")]
// #[unstable(feature = "nonpoison_rwlock", issue = "134645")]
#[clippy::has_significant_drop]
pub struct MappedRwLockReadGuard<
    #[rustc_assert_variance(covariant)] 'rwlock,
    #[rustc_assert_variance(covariant)] T: ?Sized + 'rwlock,
> {
    /// A pointer to the data protected by the `RwLock`. Note that we use a pointer here instead of
    /// `&'rwlock T` to avoid `noalias` violations, because a `MappedRwLockReadGuard` instance only
    /// 其被丢弃之前保持不可变性，而非在整个作用域内保持。
    /// `NonNull` is preferable over `*const T` to allow for niche optimizations. `NonNull` is also
    /// covariant over `T`, just like we would have with `&T`.
    data: NonNull<T>,
    /// A reference to the internal [`sys::RwLock`] that we have read-locked.
    inner_lock: &'rwlock sys::RwLock,
}

#[unstable(feature = "mapped_lock_guards", issue = "117108")]
// #[unstable(feature = "nonpoison_rwlock", issue = "134645")]
impl<T: ?Sized> !Send for MappedRwLockReadGuard<'_, T> {}

#[unstable(feature = "mapped_lock_guards", issue = "117108")]
// #[unstable(feature = "nonpoison_rwlock", issue = "134645")]
unsafe impl<T: ?Sized + Sync> Sync for MappedRwLockReadGuard<'_, T> {}

/// RAII 结构，用于在
/// 被丢弃时释放锁的独占写访问权限，它可以指向受保护数据的子字段。
///
/// This structure is created by the [`map`] and [`filter_map`] methods
/// on [`RwLockWriteGuard`].
///
/// [`map`]: RwLockWriteGuard::map
/// [`filter_map`]: RwLockWriteGuard::filter_map
#[must_use = "if unused the RwLock will immediately unlock"]
#[must_not_suspend = "holding a MappedRwLockWriteGuard across suspend \
                      points can cause deadlocks, delays, \
                      and cause Future's to not implement `Send`"]
#[unstable(feature = "mapped_lock_guards", issue = "117108")]
// #[unstable(feature = "nonpoison_rwlock", issue = "134645")]
#[clippy::has_significant_drop]
pub struct MappedRwLockWriteGuard<
    #[rustc_assert_variance(covariant)] 'rwlock,
    #[rustc_assert_variance(invariant)] T: ?Sized + 'rwlock,
> {
    /// A pointer to the data protected by the `RwLock`. Note that we use a pointer here instead of
    /// `&'rwlock T` to avoid `noalias` violations, because a `MappedRwLockWriteGuard` instance only
    /// 其被丢弃之前保持唯一性，而非在整个作用域内保持。
    /// `NonNull` is preferable over `*const T` to allow for niche optimizations.
    data: NonNull<T>,
    /// `NonNull` is covariant over `T`, so we add a `PhantomData<&'rwlock mut T>` field here to
    /// enforce the correct invariance over `T`.
    _variance: PhantomData<&'rwlock mut T>,
    /// A reference to the internal [`sys::RwLock`] that we have write-locked.
    inner_lock: &'rwlock sys::RwLock,
}

#[unstable(feature = "mapped_lock_guards", issue = "117108")]
// #[unstable(feature = "nonpoison_rwlock", issue = "134645")]
impl<T: ?Sized> !Send for MappedRwLockWriteGuard<'_, T> {}

#[unstable(feature = "mapped_lock_guards", issue = "117108")]
// #[unstable(feature = "nonpoison_rwlock", issue = "134645")]
unsafe impl<T: ?Sized + Sync> Sync for MappedRwLockWriteGuard<'_, T> {}

////////////////////////////////////////////////////////////////////////////////////////////////////
// Implementations
////////////////////////////////////////////////////////////////////////////////////////////////////

impl<T> RwLock<T> {
    /// Creates a new instance of an `RwLock<T>` which is unlocked.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(nonpoison_rwlock)]
    ///
    /// use std::sync::nonpoison::RwLock;
    ///
    /// let lock = RwLock::new(5);
    /// ```
    #[unstable(feature = "nonpoison_rwlock", issue = "134645")]
    #[inline]
    pub const fn new(t: T) -> RwLock<T> {
        RwLock { inner: sys::RwLock::new(), data: UnsafeCell::new(t) }
    }

    /// 通过克隆返回其中的值。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(nonpoison_rwlock)]
    /// #![feature(lock_value_accessors)]
    ///
    /// use std::sync::nonpoison::RwLock;
    ///
    /// let mut lock = RwLock::new(7);
    ///
    /// assert_eq!(lock.get_cloned(), 7);
    /// ```
    #[unstable(feature = "lock_value_accessors", issue = "133407")]
    // #[unstable(feature = "nonpoison_rwlock", issue = "134645")]
    pub fn get_cloned(&self) -> T
    where
        T: Clone,
    {
        self.read().clone()
    }

    /// 设置其中的值。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(nonpoison_rwlock)]
    /// #![feature(lock_value_accessors)]
    ///
    /// use std::sync::nonpoison::RwLock;
    ///
    /// let mut lock = RwLock::new(7);
    ///
    /// assert_eq!(lock.get_cloned(), 7);
    /// lock.set(11);
    /// assert_eq!(lock.get_cloned(), 11);
    /// ```
    #[unstable(feature = "lock_value_accessors", issue = "133407")]
    // #[unstable(feature = "nonpoison_rwlock", issue = "134645")]
    pub fn set(&self, value: T) {
        if mem::needs_drop::<T>() {
            // If the contained value has a non-trivial destructor, we
            // call that destructor after the lock has been released.
            drop(self.replace(value))
        } else {
            *self.write() = value;
        }
    }

    /// Replaces the contained value with `value`, and returns the old contained value.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(nonpoison_rwlock)]
    /// #![feature(lock_value_accessors)]
    ///
    /// use std::sync::nonpoison::RwLock;
    ///
    /// let mut lock = RwLock::new(7);
    ///
    /// assert_eq!(lock.replace(11), 7);
    /// assert_eq!(lock.get_cloned(), 11);
    /// ```
    #[unstable(feature = "lock_value_accessors", issue = "133407")]
    // #[unstable(feature = "nonpoison_rwlock", issue = "134645")]
    pub fn replace(&self, value: T) -> T {
        let mut guard = self.write();
        mem::replace(&mut *guard, value)
    }
}

impl<T: ?Sized> RwLock<T> {
    /// Locks this `RwLock` with shared read access, blocking the current thread
    /// 调用线程将被阻塞，直到没有更多的写入者 持有该锁。当
    ///
    /// 此方法返回时，调用线程将被阻塞，直到没有更多写入者 持有该锁。此时可能还有其他读者在锁内。
    /// 此方法不保证有争议的阅读者或写入者会 先获得锁。
    /// 返回时，不会保证有争议的阅读者或写入者会 先获得锁。
    /// 此方法不保证有争议的阅读者或写入者会 先获得锁的顺序。
    /// 不会阻塞。
    ///
    /// 返回一个 RAII 保护对象，在被丢弃时会释放该线程的共享访问权限。
    /// 一旦被丢弃。
    ///
    /// # 恐慌
    ///
    /// 如果当前线程已经持有该锁，调用此函数可能会引发恐慌。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(nonpoison_rwlock)]
    ///
    /// use std::sync::Arc;
    /// use std::sync::nonpoison::RwLock;
    /// use std::thread;
    ///
    /// let lock = Arc::new(RwLock::new(1));
    /// let c_lock = Arc::clone(&lock);
    ///
    /// let n = lock.read();
    /// assert_eq!(*n, 1);
    ///
    /// thread::spawn(move || {
    ///     let r = c_lock.read();
    /// }).join().unwrap();
    /// ```
    #[inline]
    #[unstable(feature = "nonpoison_rwlock", issue = "134645")]
    pub fn read(&self) -> RwLockReadGuard<'_, T> {
        unsafe {
            self.inner.read();
            RwLockReadGuard::new(self)
        }
    }

    /// Attempts to acquire this `RwLock` with shared read access.
    ///
    /// If the access could not be granted at this time, then `Err` is returned.
    /// 否则，返回一个 RAII 保护对象，在被丢弃时释放共享访问权限。
    /// 当被丢弃时。
    ///
    /// 此函数不会阻塞。
    ///
    /// 此函数不保证有争议的阅读者或写入者会 先获得锁的顺序。
    /// 此函数不会阻塞。
    ///
    /// # 错误
    ///
    /// This function will return the [`WouldBlock`] error if the `RwLock` could
    /// 
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(nonpoison_rwlock)]
    ///
    /// use std::sync::nonpoison::RwLock;
    ///
    /// let lock = RwLock::new(1);
    ///
    /// match lock.try_read() {
    ///     Ok(n) => assert_eq!(*n, 1),
    ///     Err(_) => unreachable!(),
    /// };
    /// ```
    #[inline]
    #[unstable(feature = "nonpoison_rwlock", issue = "134645")]
    pub fn try_read(&self) -> TryLockResult<RwLockReadGuard<'_, T>> {
        unsafe {
            if self.inner.try_read() { Ok(RwLockReadGuard::new(self)) } else { Err(WouldBlock) }
        }
    }

    /// Locks this `RwLock` with exclusive write access, blocking the current
    /// 线程，直到能够获取锁为止。
    ///
    /// 当其他写入者或其他读者
    /// 当前拥有该锁时，此函数不会返回。
    ///
    /// Returns an RAII guard which will drop the write access of this `RwLock`
    /// 当被丢弃时。
    ///
    /// # 恐慌
    ///
    /// 如果当前线程已经持有该锁，调用此函数可能会引发恐慌。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(nonpoison_rwlock)]
    ///
    /// use std::sync::nonpoison::RwLock;
    ///
    /// let lock = RwLock::new(1);
    ///
    /// let mut n = lock.write();
    /// *n = 2;
    ///
    /// assert!(lock.try_read().is_err());
    /// ```
    #[inline]
    #[unstable(feature = "nonpoison_rwlock", issue = "134645")]
    pub fn write(&self) -> RwLockWriteGuard<'_, T> {
        unsafe {
            self.inner.write();
            RwLockWriteGuard::new(self)
        }
    }

    /// Attempts to lock this `RwLock` with exclusive write access.
    ///
    /// If the lock could not be acquired at this time, then `Err` is returned.
    /// 否则，返回一个 RAII 保护对象，在被丢弃时释放锁。
    /// 当被丢弃时。
    ///
    /// 此函数不会阻塞。
    ///
    /// 此函数不保证有争议的阅读者或写入者会 先获得锁的顺序。
    /// 取决于是争议性更强的读者还是写入者先获得锁。
    ///
    /// # 错误
    ///
    /// This function will return the [`WouldBlock`] error if the `RwLock` could
    /// 因为已经存在锁定。
    ///
    /// [`WouldBlock`]: WouldBlock
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(nonpoison_rwlock)]
    ///
    /// use std::sync::nonpoison::RwLock;
    ///
    /// let lock = RwLock::new(1);
    ///
    /// let n = lock.read();
    /// assert_eq!(*n, 1);
    ///
    /// assert!(lock.try_write().is_err());
    /// ```
    #[inline]
    #[unstable(feature = "nonpoison_rwlock", issue = "134645")]
    pub fn try_write(&self) -> TryLockResult<RwLockWriteGuard<'_, T>> {
        unsafe {
            if self.inner.try_write() { Ok(RwLockWriteGuard::new(self)) } else { Err(WouldBlock) }
        }
    }

    /// Consumes this `RwLock`, returning the underlying data.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(nonpoison_rwlock)]
    ///
    /// use std::sync::nonpoison::RwLock;
    ///
    /// let lock = RwLock::new(String::new());
    /// {
    ///     let mut s = lock.write();
    ///     *s = "modified".to_owned();
    /// }
    /// assert_eq!(lock.into_inner(), "modified");
    /// ```
    #[unstable(feature = "nonpoison_rwlock", issue = "134645")]
    pub fn into_inner(self) -> T
    where
        T: Sized,
    {
        self.data.into_inner()
    }

    /// 返回对底层数据的可修改引用。
    ///
    /// Since this call borrows the `RwLock` mutably, no actual locking needs to
    /// take place -- the mutable borrow statically guarantees no new locks can be acquired
    /// 锁。请注意，此方法不会清除任何之前被放弃的锁。
    /// locks (e.g., via [`forget()`] on a [`RwLockReadGuard`] or [`RwLockWriteGuard`]).
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(nonpoison_rwlock)]
    ///
    /// use std::sync::nonpoison::RwLock;
    ///
    /// let mut lock = RwLock::new(0);
    /// *lock.get_mut() = 10;
    /// assert_eq!(*lock.read(), 10);
    /// ```
    #[unstable(feature = "nonpoison_rwlock", issue = "134645")]
    pub fn get_mut(&mut self) -> &mut T {
        self.data.get_mut()
    }

    /// 返回指向底层数据的原始指针。
    ///
    /// 返回的指针始终非空且正确对齐，但确保通过它进行的任何读取和写入
    /// 都正确同步以避免数据竞争，并且在锁释放后不会被读取或写入是用户的责任。
    /// 至关重要。
    /// 或写入。
    #[unstable(feature = "rwlock_data_ptr", issue = "140368")]
    // #[unstable(feature = "nonpoison_rwlock", issue = "134645")]
    pub const fn data_ptr(&self) -> *mut T {
        self.data.get()
    }

    /// Locks this `RwLock` with shared read access to the underlying data by passing
    /// 。
    ///
    /// 此方法获取锁，使用数据引用调用提供的闭包，然后返回闭包的结果。即使闭包发生 panic，锁也会在闭包完成后被释放。
    /// # 示例
    /// the closure completes, even if it panics.
    ///
    /// # 
    ///
    /// ```
    /// #![feature(lock_value_accessors, nonpoison_rwlock)]
    ///
    /// use std::sync::nonpoison::RwLock;
    ///
    /// let rwlock = RwLock::new(2);
    /// let result = rwlock.with(|data| *data + 3);
    ///
    /// assert_eq!(result, 5);
    /// ```
    #[unstable(feature = "lock_value_accessors", issue = "133407")]
    // #[unstable(feature = "nonpoison_rwlock", issue = "134645")]
    pub fn with<F, R>(&self, f: F) -> R
    where
        F: FnOnce(&T) -> R,
    {
        f(&self.read())
    }

    /// Locks this `RwLock` with exclusive write access to the underlying data by passing
    /// 。
    ///
    /// 此方法获取锁，使用可修改的引用调用提供的闭包，然后返回闭包的结果。即使闭包发生 panic，锁也会在闭包完成后被释放。
    /// 
    /// 。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(lock_value_accessors, nonpoison_rwlock)]
    ///
    /// use std::sync::nonpoison::RwLock;
    ///
    /// let rwlock = RwLock::new(2);
    ///
    /// let result = rwlock.with_mut(|data| {
    ///     *data += 3;
    ///
    ///     *data + 5
    /// });
    ///
    /// assert_eq!(*rwlock.read(), 5);
    /// assert_eq!(result, 10);
    /// ```
    #[unstable(feature = "lock_value_accessors", issue = "133407")]
    // #[unstable(feature = "nonpoison_rwlock", issue = "134645")]
    pub fn with_mut<F, R>(&self, f: F) -> R
    where
        F: FnOnce(&mut T) -> R,
    {
        f(&mut self.write())
    }
}

#[unstable(feature = "nonpoison_rwlock", issue = "134645")]
impl<T: ?Sized + fmt::Debug> fmt::Debug for RwLock<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let mut d = f.debug_struct("RwLock");
        match self.try_read() {
            Ok(guard) => {
                d.field("data", &&*guard);
            }
            Err(WouldBlock) => {
                d.field("data", &format_args!("<locked>"));
            }
        }
        d.finish_non_exhaustive()
    }
}

#[unstable(feature = "nonpoison_rwlock", issue = "134645")]
impl<T: Default> Default for RwLock<T> {
    /// Creates a new `RwLock<T>`, with the `Default` value for T.
    fn default() -> RwLock<T> {
        RwLock::new(Default::default())
    }
}

#[unstable(feature = "nonpoison_rwlock", issue = "134645")]
impl<T> From<T> for RwLock<T> {
    /// Creates a new instance of an `RwLock<T>` which is unlocked.
    /// This is equivalent to [`RwLock::new`].
    fn from(t: T) -> Self {
        RwLock::new(t)
    }
}

impl<'rwlock, T: ?Sized> RwLockReadGuard<'rwlock, T> {
    /// Creates a new instance of `RwLockReadGuard<T>` from a `RwLock<T>`.
    ///
    /// # 安全性
    ///
    /// 如果同一线程在实例化此对象之前成功且安全地调用了
    /// `lock.inner.read()`, `lock.inner.try_read()`, or `lock.inner.downgrade()` before
    /// ，则此函数安全。
    unsafe fn new(lock: &'rwlock RwLock<T>) -> RwLockReadGuard<'rwlock, T> {
        RwLockReadGuard {
            data: unsafe { NonNull::new_unchecked(lock.data.get()) },
            inner_lock: &lock.inner,
        }
    }

    /// Makes a [`MappedRwLockReadGuard`] for a component of the borrowed data, e.g.
    /// 枚举变体。
    ///
    /// The `RwLock` is already locked for reading, so this cannot fail.
    ///
    /// 这是一个关联函数，需要作为
    /// `RwLockReadGuard::map(...)`. A method would interfere with methods of
    /// the same name on the contents of the `RwLockReadGuard` used through
    /// `Deref`.
    ///
    /// # 恐慌
    ///
    /// 如果闭包引发恐慌，保护机制将被释放（解锁）。
    #[unstable(feature = "mapped_lock_guards", issue = "117108")]
    // #[unstable(feature = "nonpoison_rwlock", issue = "134645")]
    pub fn map<U, F>(orig: Self, f: F) -> MappedRwLockReadGuard<'rwlock, U>
    where
        F: FnOnce(&T) -> &U,
        U: ?Sized,
    {
        // SAFETY: the conditions of `RwLockReadGuard::new` were satisfied when the original guard
        // was created, and have been upheld throughout `map` and/or `filter_map`.
        // The signature of the closure guarantees that it will not "leak" the lifetime of the
        // reference passed to it. If the closure panics, the guard will be dropped.
        let data = NonNull::from(f(unsafe { orig.data.as_ref() }));
        let orig = ManuallyDrop::new(orig);
        MappedRwLockReadGuard { data, inner_lock: orig.inner_lock }
    }

    /// Makes a [`MappedRwLockReadGuard`] for a component of the borrowed data. The
    /// original guard is returned as an `Err(...)` if the closure returns
    /// `None`.
    ///
    /// The `RwLock` is already locked for reading, so this cannot fail.
    ///
    /// 这是一个关联函数，需要作为
    /// `RwLockReadGuard::filter_map(...)`. A method would interfere with methods
    /// of the same name on the contents of the `RwLockReadGuard` used through
    /// `Deref`.
    ///
    /// # 恐慌
    ///
    /// 如果闭包引发恐慌，保护机制将被释放（解锁）。
    #[unstable(feature = "mapped_lock_guards", issue = "117108")]
    // #[unstable(feature = "nonpoison_rwlock", issue = "134645")]
    pub fn filter_map<U, F>(orig: Self, f: F) -> Result<MappedRwLockReadGuard<'rwlock, U>, Self>
    where
        F: FnOnce(&T) -> Option<&U>,
        U: ?Sized,
    {
        // SAFETY: the conditions of `RwLockReadGuard::new` were satisfied when the original guard
        // was created, and have been upheld throughout `map` and/or `filter_map`.
        // The signature of the closure guarantees that it will not "leak" the lifetime of the
        // reference passed to it. If the closure panics, the guard will be dropped.
        match f(unsafe { orig.data.as_ref() }) {
            Some(data) => {
                let data = NonNull::from(data);
                let orig = ManuallyDrop::new(orig);
                Ok(MappedRwLockReadGuard { data, inner_lock: orig.inner_lock })
            }
            None => Err(orig),
        }
    }
}

impl<'rwlock, T: ?Sized> RwLockWriteGuard<'rwlock, T> {
    /// Creates a new instance of `RwLockWriteGuard<T>` from a `RwLock<T>`.
    ///
    /// # 安全性
    ///
    /// 此函数只有在同一线程在实例化此对象之前成功且安全地调用
    /// `lock.inner.write()`, `lock.inner.try_write()`, or `lock.inner.try_upgrade` before
    /// 才安全。
    unsafe fn new(lock: &'rwlock RwLock<T>) -> RwLockWriteGuard<'rwlock, T> {
        RwLockWriteGuard { lock }
    }

    /// Downgrades a write-locked `RwLockWriteGuard` into a read-locked [`RwLockReadGuard`].
    ///
    /// Since we have the `RwLockWriteGuard`, the [`RwLock`] must already be locked for writing, so
    /// 此方法不会失败。
    ///
    /// 降级后，其他读者将能够读取受保护的数据。
    ///
    /// # 示例
    ///
    /// `downgrade` takes ownership of the `RwLockWriteGuard` and returns a [`RwLockReadGuard`].
    ///
    /// ```
    /// #![feature(nonpoison_rwlock)]
    ///
    /// use std::sync::nonpoison::{RwLock, RwLockWriteGuard};
    ///
    /// let rw = RwLock::new(0);
    ///
    /// let mut write_guard = rw.write();
    /// *write_guard = 42;
    ///
    /// let read_guard = RwLockWriteGuard::downgrade(write_guard);
    /// assert_eq!(42, *read_guard);
    /// ```
    ///
    /// `downgrade` will _atomically_ change the state of the [`RwLock`] from exclusive mode into
    /// 共享模式。这意味着另一个写线程无法介入
    /// thread calling `downgrade` and any reads it performs after downgrading.
    ///
    /// ```
    /// #![feature(nonpoison_rwlock)]
    ///
    /// use std::sync::Arc;
    /// use std::sync::nonpoison::{RwLock, RwLockWriteGuard};
    ///
    /// let rw = Arc::new(RwLock::new(1));
    ///
    /// // Put the lock in write mode.
    /// let mut main_write_guard = rw.write();
    ///
    /// let rw_clone = rw.clone();
    /// let evil_handle = std::thread::spawn(move || {
    ///     // This will not return until the main thread drops the `main_read_guard`.
    ///     let mut evil_guard = rw_clone.write();
    ///
    ///     assert_eq!(*evil_guard, 2);
    ///     *evil_guard = 3;
    /// });
    ///
    /// *main_write_guard = 2;
    ///
    /// // Atomically downgrade the write guard into a read guard.
    /// let main_read_guard = RwLockWriteGuard::downgrade(main_write_guard);
    ///
    /// // Since `downgrade` is atomic, the writer thread cannot have changed the protected data.
    /// assert_eq!(*main_read_guard, 2, "`downgrade` was not atomic");
    /// #
    /// # drop(main_read_guard);
    /// # evil_handle.join().unwrap();
    /// #
    /// # let final_check = rw.read();
    /// # assert_eq!(*final_check, 3);
    /// ```
    #[unstable(feature = "nonpoison_rwlock", issue = "134645")]
    pub fn downgrade(s: Self) -> RwLockReadGuard<'rwlock, T> {
        let lock = s.lock;

        // We don't want to call the destructor since that calls `write_unlock`.
        forget(s);

        // SAFETY: We take ownership of a write guard, so we must already have the `RwLock` in write
        // mode, satisfying the `downgrade` contract.
        unsafe { lock.inner.downgrade() };

        // SAFETY: We have just successfully called `downgrade`, so we fulfill the safety contract.
        unsafe { RwLockReadGuard::new(lock) }
    }

    /// Makes a [`MappedRwLockWriteGuard`] for a component of the borrowed data, e.g.
    /// 枚举变体。
    ///
    /// The `RwLock` is already locked for writing, so this cannot fail.
    ///
    /// 这是一个关联函数，需要作为
    /// `RwLockWriteGuard::map(...)`. A method would interfere with methods of
    /// the same name on the contents of the `RwLockWriteGuard` used through
    /// `Deref`.
    ///
    /// # 恐慌
    ///
    /// 如果闭包引发恐慌，保护机制将被释放（解锁）。
    #[unstable(feature = "mapped_lock_guards", issue = "117108")]
    // #[unstable(feature = "nonpoison_rwlock", issue = "134645")]
    pub fn map<U, F>(orig: Self, f: F) -> MappedRwLockWriteGuard<'rwlock, U>
    where
        F: FnOnce(&mut T) -> &mut U,
        U: ?Sized,
    {
        // SAFETY: the conditions of `RwLockWriteGuard::new` were satisfied when the original guard
        // was created, and have been upheld throughout `map` and/or `filter_map`.
        // The signature of the closure guarantees that it will not "leak" the lifetime of the
        // reference passed to it. If the closure panics, the guard will be dropped.
        let data = NonNull::from(f(unsafe { &mut *orig.lock.data.get() }));
        let orig = ManuallyDrop::new(orig);
        MappedRwLockWriteGuard { data, inner_lock: &orig.lock.inner, _variance: PhantomData }
    }

    /// Makes a [`MappedRwLockWriteGuard`] for a component of the borrowed data. The
    /// original guard is returned as an `Err(...)` if the closure returns
    /// `None`.
    ///
    /// The `RwLock` is already locked for writing, so this cannot fail.
    ///
    /// 这是一个关联函数，需要作为
    /// `RwLockWriteGuard::filter_map(...)`. A method would interfere with methods
    /// of the same name on the contents of the `RwLockWriteGuard` used through
    /// `Deref`.
    ///
    /// # 恐慌
    ///
    /// 如果闭包引发恐慌，保护机制将被释放（解锁）。
    #[unstable(feature = "mapped_lock_guards", issue = "117108")]
    // #[unstable(feature = "nonpoison_rwlock", issue = "134645")]
    pub fn filter_map<U, F>(orig: Self, f: F) -> Result<MappedRwLockWriteGuard<'rwlock, U>, Self>
    where
        F: FnOnce(&mut T) -> Option<&mut U>,
        U: ?Sized,
    {
        // SAFETY: the conditions of `RwLockWriteGuard::new` were satisfied when the original guard
        // was created, and have been upheld throughout `map` and/or `filter_map`.
        // The signature of the closure guarantees that it will not "leak" the lifetime of the
        // reference passed to it. If the closure panics, the guard will be dropped.
        match f(unsafe { &mut *orig.lock.data.get() }) {
            Some(data) => {
                let data = NonNull::from(data);
                let orig = ManuallyDrop::new(orig);
                Ok(MappedRwLockWriteGuard {
                    data,
                    inner_lock: &orig.lock.inner,
                    _variance: PhantomData,
                })
            }
            None => Err(orig),
        }
    }
}

impl<'rwlock, T: ?Sized> MappedRwLockReadGuard<'rwlock, T> {
    /// Makes a [`MappedRwLockReadGuard`] for a component of the borrowed data,
    /// 例如枚举变体。
    ///
    /// The `RwLock` is already locked for reading, so this cannot fail.
    ///
    /// 这是一个关联函数，需要作为
    /// `MappedRwLockReadGuard::map(...)`. A method would interfere with
    /// methods of the same name on the contents of the `MappedRwLockReadGuard`
    /// used through `Deref`.
    ///
    /// # 恐慌
    ///
    /// 如果闭包发生恐慌，保护机制将被释放（解锁）。
    #[unstable(feature = "mapped_lock_guards", issue = "117108")]
    // #[unstable(feature = "nonpoison_rwlock", issue = "134645")]
    pub fn map<U, F>(orig: Self, f: F) -> MappedRwLockReadGuard<'rwlock, U>
    where
        F: FnOnce(&T) -> &U,
        U: ?Sized,
    {
        // SAFETY: the conditions of `RwLockReadGuard::new` were satisfied when the original guard
        // was created, and have been upheld throughout `map` and/or `filter_map`.
        // The signature of the closure guarantees that it will not "leak" the lifetime of the
        // reference passed to it. If the closure panics, the guard will be dropped.
        let data = NonNull::from(f(unsafe { orig.data.as_ref() }));
        let orig = ManuallyDrop::new(orig);
        MappedRwLockReadGuard { data, inner_lock: orig.inner_lock }
    }

    /// Makes a [`MappedRwLockReadGuard`] for a component of the borrowed data.
    /// The original guard is returned as an `Err(...)` if the closure returns
    /// `None`.
    ///
    /// The `RwLock` is already locked for reading, so this cannot fail.
    ///
    /// 这是一个关联函数，需要按如下方式使用：
    /// `MappedRwLockReadGuard::filter_map(...)`. A method would interfere with
    /// methods of the same name on the contents of the `MappedRwLockReadGuard`
    /// used through `Deref`.
    ///
    /// # 恐慌
    ///
    /// 如果闭包发生恐慌，保护机制将被释放（解锁）。
    #[unstable(feature = "mapped_lock_guards", issue = "117108")]
    // #[unstable(feature = "nonpoison_rwlock", issue = "134645")]
    pub fn filter_map<U, F>(orig: Self, f: F) -> Result<MappedRwLockReadGuard<'rwlock, U>, Self>
    where
        F: FnOnce(&T) -> Option<&U>,
        U: ?Sized,
    {
        // SAFETY: the conditions of `RwLockReadGuard::new` were satisfied when the original guard
        // was created, and have been upheld throughout `map` and/or `filter_map`.
        // The signature of the closure guarantees that it will not "leak" the lifetime of the
        // reference passed to it. If the closure panics, the guard will be dropped.
        match f(unsafe { orig.data.as_ref() }) {
            Some(data) => {
                let data = NonNull::from(data);
                let orig = ManuallyDrop::new(orig);
                Ok(MappedRwLockReadGuard { data, inner_lock: orig.inner_lock })
            }
            None => Err(orig),
        }
    }
}

impl<'rwlock, T: ?Sized> MappedRwLockWriteGuard<'rwlock, T> {
    /// Makes a [`MappedRwLockWriteGuard`] for a component of the borrowed data,
    /// e.g. an enum variant.
    ///
    /// The `RwLock` is already locked for writing, so this cannot fail.
    ///
    /// This is an associated function that needs to be used as
    /// `MappedRwLockWriteGuard::map(...)`. A method would interfere with
    /// methods of the same name on the contents of the `MappedRwLockWriteGuard`
    /// used through `Deref`.
    ///
    /// # 恐慌
    ///
    /// 如果闭包发生恐慌，保护机制将被释放（解锁）。
    #[unstable(feature = "mapped_lock_guards", issue = "117108")]
    // #[unstable(feature = "nonpoison_rwlock", issue = "134645")]
    pub fn map<U, F>(mut orig: Self, f: F) -> MappedRwLockWriteGuard<'rwlock, U>
    where
        F: FnOnce(&mut T) -> &mut U,
        U: ?Sized,
    {
        // SAFETY: the conditions of `RwLockWriteGuard::new` were satisfied when the original guard
        // was created, and have been upheld throughout `map` and/or `filter_map`.
        // The signature of the closure guarantees that it will not "leak" the lifetime of the
        // reference passed to it. If the closure panics, the guard will be dropped.
        let data = NonNull::from(f(unsafe { orig.data.as_mut() }));
        let orig = ManuallyDrop::new(orig);
        MappedRwLockWriteGuard { data, inner_lock: orig.inner_lock, _variance: PhantomData }
    }

    /// Makes a [`MappedRwLockWriteGuard`] for a component of the borrowed data.
    /// The original guard is returned as an `Err(...)` if the closure returns
    /// `None`.
    ///
    /// The `RwLock` is already locked for writing, so this cannot fail.
    ///
    /// 这是一个关联函数，需要按如下方式使用：
    /// `MappedRwLockWriteGuard::filter_map(...)`. A method would interfere with
    /// methods of the same name on the contents of the `MappedRwLockWriteGuard`
    /// used through `Deref`.
    ///
    /// # 恐慌
    ///
    /// 如果闭包发生恐慌，保护机制将被释放（解锁）。
    #[unstable(feature = "mapped_lock_guards", issue = "117108")]
    // #[unstable(feature = "nonpoison_rwlock", issue = "134645")]
    pub fn filter_map<U, F>(
        mut orig: Self,
        f: F,
    ) -> Result<MappedRwLockWriteGuard<'rwlock, U>, Self>
    where
        F: FnOnce(&mut T) -> Option<&mut U>,
        U: ?Sized,
    {
        // SAFETY: the conditions of `RwLockWriteGuard::new` were satisfied when the original guard
        // was created, and have been upheld throughout `map` and/or `filter_map`.
        // The signature of the closure guarantees that it will not "leak" the lifetime of the
        // reference passed to it. If the closure panics, the guard will be dropped.
        match f(unsafe { orig.data.as_mut() }) {
            Some(data) => {
                let data = NonNull::from(data);
                let orig = ManuallyDrop::new(orig);
                Ok(MappedRwLockWriteGuard {
                    data,
                    inner_lock: orig.inner_lock,
                    _variance: PhantomData,
                })
            }
            None => Err(orig),
        }
    }
}

#[unstable(feature = "nonpoison_rwlock", issue = "134645")]
impl<T: ?Sized> Drop for RwLockReadGuard<'_, T> {
    fn drop(&mut self) {
        // SAFETY: the conditions of `RwLockReadGuard::new` were satisfied when created.
        unsafe {
            self.inner_lock.read_unlock();
        }
    }
}

#[unstable(feature = "nonpoison_rwlock", issue = "134645")]
impl<T: ?Sized> Drop for RwLockWriteGuard<'_, T> {
    fn drop(&mut self) {
        // SAFETY: the conditions of `RwLockWriteGuard::new` were satisfied when created.
        unsafe {
            self.lock.inner.write_unlock();
        }
    }
}

#[unstable(feature = "mapped_lock_guards", issue = "117108")]
// #[unstable(feature = "nonpoison_rwlock", issue = "134645")]
impl<T: ?Sized> Drop for MappedRwLockReadGuard<'_, T> {
    fn drop(&mut self) {
        // SAFETY: the conditions of `RwLockReadGuard::new` were satisfied when the original guard
        // was created, and have been upheld throughout `map` and/or `filter_map`.
        unsafe {
            self.inner_lock.read_unlock();
        }
    }
}

#[unstable(feature = "mapped_lock_guards", issue = "117108")]
// #[unstable(feature = "nonpoison_rwlock", issue = "134645")]
impl<T: ?Sized> Drop for MappedRwLockWriteGuard<'_, T> {
    fn drop(&mut self) {
        // SAFETY: the conditions of `RwLockWriteGuard::new` were satisfied when the original guard
        // was created, and have been upheld throughout `map` and/or `filter_map`.
        unsafe {
            self.inner_lock.write_unlock();
        }
    }
}

#[unstable(feature = "nonpoison_rwlock", issue = "134645")]
impl<T: ?Sized> Deref for RwLockReadGuard<'_, T> {
    type Target = T;

    fn deref(&self) -> &T {
        // SAFETY: the conditions of `RwLockReadGuard::new` were satisfied when created.
        unsafe { self.data.as_ref() }
    }
}

#[unstable(feature = "nonpoison_rwlock", issue = "134645")]
impl<T: ?Sized> Deref for RwLockWriteGuard<'_, T> {
    type Target = T;

    fn deref(&self) -> &T {
        // SAFETY: the conditions of `RwLockWriteGuard::new` were satisfied when created.
        unsafe { &*self.lock.data.get() }
    }
}

#[unstable(feature = "nonpoison_rwlock", issue = "134645")]
impl<T: ?Sized> DerefMut for RwLockWriteGuard<'_, T> {
    fn deref_mut(&mut self) -> &mut T {
        // SAFETY: the conditions of `RwLockWriteGuard::new` were satisfied when created.
        unsafe { &mut *self.lock.data.get() }
    }
}

#[unstable(feature = "mapped_lock_guards", issue = "117108")]
// #[unstable(feature = "nonpoison_rwlock", issue = "134645")]
impl<T: ?Sized> Deref for MappedRwLockReadGuard<'_, T> {
    type Target = T;

    fn deref(&self) -> &T {
        // SAFETY: the conditions of `RwLockReadGuard::new` were satisfied when the original guard
        // was created, and have been upheld throughout `map` and/or `filter_map`.
        unsafe { self.data.as_ref() }
    }
}

#[unstable(feature = "mapped_lock_guards", issue = "117108")]
// #[unstable(feature = "nonpoison_rwlock", issue = "134645")]
impl<T: ?Sized> Deref for MappedRwLockWriteGuard<'_, T> {
    type Target = T;

    fn deref(&self) -> &T {
        // SAFETY: the conditions of `RwLockWriteGuard::new` were satisfied when the original guard
        // was created, and have been upheld throughout `map` and/or `filter_map`.
        unsafe { self.data.as_ref() }
    }
}

#[unstable(feature = "mapped_lock_guards", issue = "117108")]
// #[unstable(feature = "nonpoison_rwlock", issue = "134645")]
impl<T: ?Sized> DerefMut for MappedRwLockWriteGuard<'_, T> {
    fn deref_mut(&mut self) -> &mut T {
        // SAFETY: the conditions of `RwLockWriteGuard::new` were satisfied when the original guard
        // was created, and have been upheld throughout `map` and/or `filter_map`.
        unsafe { self.data.as_mut() }
    }
}

#[unstable(feature = "nonpoison_rwlock", issue = "134645")]
impl<T: ?Sized + fmt::Debug> fmt::Debug for RwLockReadGuard<'_, T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        (**self).fmt(f)
    }
}

#[unstable(feature = "nonpoison_rwlock", issue = "134645")]
impl<T: ?Sized + fmt::Display> fmt::Display for RwLockReadGuard<'_, T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        (**self).fmt(f)
    }
}

#[unstable(feature = "nonpoison_rwlock", issue = "134645")]
impl<T: ?Sized + fmt::Debug> fmt::Debug for RwLockWriteGuard<'_, T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        (**self).fmt(f)
    }
}

#[unstable(feature = "nonpoison_rwlock", issue = "134645")]
impl<T: ?Sized + fmt::Display> fmt::Display for RwLockWriteGuard<'_, T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        (**self).fmt(f)
    }
}

#[unstable(feature = "mapped_lock_guards", issue = "117108")]
// #[unstable(feature = "nonpoison_rwlock", issue = "134645")]
impl<T: ?Sized + fmt::Debug> fmt::Debug for MappedRwLockReadGuard<'_, T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        (**self).fmt(f)
    }
}

#[unstable(feature = "mapped_lock_guards", issue = "117108")]
// #[unstable(feature = "nonpoison_rwlock", issue = "134645")]
impl<T: ?Sized + fmt::Display> fmt::Display for MappedRwLockReadGuard<'_, T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        (**self).fmt(f)
    }
}

#[unstable(feature = "mapped_lock_guards", issue = "117108")]
// #[unstable(feature = "nonpoison_rwlock", issue = "134645")]
impl<T: ?Sized + fmt::Debug> fmt::Debug for MappedRwLockWriteGuard<'_, T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        (**self).fmt(f)
    }
}

#[unstable(feature = "mapped_lock_guards", issue = "117108")]
// #[unstable(feature = "nonpoison_rwlock", issue = "134645")]
impl<T: ?Sized + fmt::Display> fmt::Display for MappedRwLockWriteGuard<'_, T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        (**self).fmt(f)
    }
}
