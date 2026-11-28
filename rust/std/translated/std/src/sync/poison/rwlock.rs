use crate::cell::UnsafeCell;
use crate::fmt;
use crate::marker::PhantomData;
use crate::mem::{self, ManuallyDrop, forget};
use crate::ops::{Deref, DerefMut};
use crate::ptr::NonNull;
use crate::sync::{LockResult, PoisonError, TryLockError, TryLockResult, poison};
use crate::sys::sync as sys;

/// 读写锁
///
/// 这种锁允许同时有多个读者，或最多一个写入者在任何时刻使用。
/// 该锁的写入部分通常允许修改底层数据（独占访问），而读取部分
/// 通常允许只读访问（共享访问）。
/// typically allows for read-only access (shared access).
///
/// In comparison, a [`Mutex`] does not distinguish between readers or writers
/// that acquire the lock, therefore blocking any threads waiting for the lock to
/// become available. An `RwLock` will allow multiple readers to acquire the
/// lock as long as a writer is not holding the lock.
///
/// The priority policy of the lock is dependent on the underlying operating
/// system's implementation, and this type does not guarantee that any
/// particular policy will be used. In particular, a writer which is waiting to
/// acquire the lock in `write` might or might not block concurrent calls to
/// `read`, e.g.:
///
/// <details><summary>Potential deadlock example</summary>
///
/// ```text
/// // Thread 1              |  // Thread 2
/// let _rg1 = lock.read();  |
///                          |  // will block
///                          |  let _wg = lock.write();
/// // may deadlock          |
/// let _rg2 = lock.read();  |
/// ```
///
/// </details>
///
/// The type parameter `T` represents the data that this lock protects. It is
/// required that `T` satisfies [`Send`] to be shared across threads and
/// [`Sync`] to allow concurrent access through readers. The RAII guards
/// returned from the locking methods implement [`Deref`] (and [`DerefMut`]
/// for the `write` methods) to allow access to the content of the lock.
///
/// # Poisoning
///
/// An `RwLock`, like [`Mutex`], will [usually] become poisoned on a panic. Note,
/// however, that an `RwLock` may only be poisoned if a panic occurs while it is
/// locked exclusively (write mode). If a panic occurs in any reader, then the
/// lock will not be poisoned.
///
/// [usually]: super::Mutex#poisoning
///
/// # Examples
///
/// ```
/// use std::sync::{Arc, RwLock};
/// use std::thread;
/// use std::time::Duration;
///
/// let data = Arc::new(RwLock::new(5));
///
/// // Multiple readers can access in parallel.
/// for i in 0..3 {
///     let lock_clone = Arc::clone(&data);
///
///     thread::spawn(move || {
///         let value = lock_clone.read().unwrap();
///
///         println!("Reader {}: Read value {}, now holding lock...", i, *value);
///
///         // Simulating a long read operation
///         thread::sleep(Duration::from_secs(1));
///
///         println!("Reader {}: Dropping lock.", i);
///         // Read lock unlocked when going out of scope.
///     });
/// }
///
/// thread::sleep(Duration::from_millis(100));  // Wait for readers to start
///
/// // While all readers can proceed, a call to .write() has to wait for
//  // current active reader locks.
/// let mut writable_data = data.write().unwrap();
/// println!("Writer proceeds...");
/// *writable_data += 1;
/// ```
///
/// [`Mutex`]: super::Mutex
#[stable(feature = "rust1", since = "1.0.0")]
#[cfg_attr(not(test), rustc_diagnostic_item = "RwLock")]
pub struct RwLock<#[rustc_assert_variance(invariant)] T: ?Sized> {
    /// The inner [`sys::RwLock`] that synchronizes thread access to the protected data.
    inner: sys::RwLock,
    /// A flag denoting if this `RwLock` has been poisoned.
    poison: poison::Flag,
    /// The lock-protected data.
    data: UnsafeCell<T>,
}

#[stable(feature = "rust1", since = "1.0.0")]
unsafe impl<T: ?Sized + Send> Send for RwLock<T> {}

#[stable(feature = "rust1", since = "1.0.0")]
unsafe impl<T: ?Sized + Send + Sync> Sync for RwLock<T> {}

////////////////////////////////////////////////////////////////////////////////////////////////////
// Guards
////////////////////////////////////////////////////////////////////////////////////////////////////

/// RAII structure used to release the shared read access of a lock when
/// dropped.
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
#[stable(feature = "rust1", since = "1.0.0")]
#[clippy::has_significant_drop]
#[cfg_attr(not(test), rustc_diagnostic_item = "RwLockReadGuard")]
pub struct RwLockReadGuard<
    #[rustc_assert_variance(covariant)] 'rwlock,
    #[rustc_assert_variance(covariant)] T: ?Sized + 'rwlock,
> {
    /// A pointer to the data protected by the `RwLock`. Note that we use a pointer here instead of
    /// `&'rwlock T` to avoid `noalias` violations, because a `RwLockReadGuard` instance only holds
    /// immutability until it drops, not for its whole scope.
    /// `NonNull` is preferable over `*const T` to allow for niche optimizations. `NonNull` is also
    /// covariant over `T`, just like we would have with `&T`.
    data: NonNull<T>,
    /// A reference to the internal [`sys::RwLock`] that we have read-locked.
    inner_lock: &'rwlock sys::RwLock,
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T: ?Sized> !Send for RwLockReadGuard<'_, T> {}

#[stable(feature = "rwlock_guard_sync", since = "1.23.0")]
unsafe impl<T: ?Sized + Sync> Sync for RwLockReadGuard<'_, T> {}

/// 用于释放锁的独占写入访问权的 RAII 结构，在
/// 被丢弃时生效。
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
#[stable(feature = "rust1", since = "1.0.0")]
#[clippy::has_significant_drop]
#[cfg_attr(not(test), rustc_diagnostic_item = "RwLockWriteGuard")]
pub struct RwLockWriteGuard<
    #[rustc_assert_variance(covariant)] 'rwlock,
    #[rustc_assert_variance(invariant)] T: ?Sized + 'rwlock,
> {
    /// A reference to the [`RwLock`] that we have write-locked.
    lock: &'rwlock RwLock<T>,
    /// The poison guard. See the [`poison`] module for more information.
    poison: poison::Guard,
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T: ?Sized> !Send for RwLockWriteGuard<'_, T> {}

#[stable(feature = "rwlock_guard_sync", since = "1.23.0")]
unsafe impl<T: ?Sized + Sync> Sync for RwLockWriteGuard<'_, T> {}

/// 用于释放锁的共享读取访问权的 RAII 结构，在
/// 被丢弃时生效，可以指向受保护数据的子字段。
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
#[clippy::has_significant_drop]
pub struct MappedRwLockReadGuard<
    #[rustc_assert_variance(covariant)] 'rwlock,
    #[rustc_assert_variance(covariant)] T: ?Sized + 'rwlock,
> {
    /// A pointer to the data protected by the `RwLock`. Note that we use a pointer here instead of
    /// `&'rwlock T` to avoid `noalias` violations, because a `MappedRwLockReadGuard` instance only
    /// 在丢弃前保持不可变性，而非整个作用域内都保持。
    /// `NonNull` is preferable over `*const T` to allow for niche optimizations. `NonNull` is also
    /// covariant over `T`, just like we would have with `&T`.
    data: NonNull<T>,
    /// A reference to the internal [`sys::RwLock`] that we have read-locked.
    inner_lock: &'rwlock sys::RwLock,
}

#[unstable(feature = "mapped_lock_guards", issue = "117108")]
impl<T: ?Sized> !Send for MappedRwLockReadGuard<'_, T> {}

#[unstable(feature = "mapped_lock_guards", issue = "117108")]
unsafe impl<T: ?Sized + Sync> Sync for MappedRwLockReadGuard<'_, T> {}

/// 用于释放锁的独占写入访问权的 RAII 结构，在
/// 被丢弃时生效，可以指向受保护数据的子字段。
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
#[clippy::has_significant_drop]
pub struct MappedRwLockWriteGuard<
    #[rustc_assert_variance(covariant)] 'rwlock,
    #[rustc_assert_variance(invariant)] T: ?Sized + 'rwlock,
> {
    /// A pointer to the data protected by the `RwLock`. Note that we use a pointer here instead of
    /// `&'rwlock T` to avoid `noalias` violations, because a `MappedRwLockWriteGuard` instance only
    /// 在丢弃前保持唯一性，而非整个作用域内都保持。
    /// `NonNull` is preferable over `*const T` to allow for niche optimizations.
    data: NonNull<T>,
    /// `NonNull` is covariant over `T`, so we add a `PhantomData<&'rwlock mut T>` field here to
    /// enforce the correct invariance over `T`.
    _variance: PhantomData<&'rwlock mut T>,
    /// A reference to the internal [`sys::RwLock`] that we have write-locked.
    inner_lock: &'rwlock sys::RwLock,
    /// A reference to the original `RwLock`'s poison state.
    poison_flag: &'rwlock poison::Flag,
    /// The poison guard. See the [`poison`] module for more information.
    poison_guard: poison::Guard,
}

#[unstable(feature = "mapped_lock_guards", issue = "117108")]
impl<T: ?Sized> !Send for MappedRwLockWriteGuard<'_, T> {}

#[unstable(feature = "mapped_lock_guards", issue = "117108")]
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
    /// use std::sync::RwLock;
    ///
    /// let lock = RwLock::new(5);
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_locks", since = "1.63.0")]
    #[inline]
    pub const fn new(t: T) -> RwLock<T> {
        RwLock { inner: sys::RwLock::new(), poison: poison::Flag::new(), data: UnsafeCell::new(t) }
    }

    /// 通过克隆返回其中的值。
    ///
    /// # 错误
    ///
    /// This function will return an error if the `RwLock` is poisoned. An
    /// `RwLock` is poisoned whenever a writer panics while holding an exclusive
    /// 锁。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(lock_value_accessors)]
    ///
    /// use std::sync::RwLock;
    ///
    /// let mut lock = RwLock::new(7);
    ///
    /// assert_eq!(lock.get_cloned().unwrap(), 7);
    /// ```
    #[unstable(feature = "lock_value_accessors", issue = "133407")]
    pub fn get_cloned(&self) -> Result<T, PoisonError<()>>
    where
        T: Clone,
    {
        match self.read() {
            Ok(guard) => Ok((*guard).clone()),
            Err(_) => Err(PoisonError::new(())),
        }
    }

    /// 设置其中的值。
    ///
    /// # 错误
    ///
    /// This function will return an error containing the provided `value` if
    /// the `RwLock` is poisoned. An `RwLock` is poisoned whenever a writer
    /// 在持有独占锁时发生 panic。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(lock_value_accessors)]
    ///
    /// use std::sync::RwLock;
    ///
    /// let mut lock = RwLock::new(7);
    ///
    /// assert_eq!(lock.get_cloned().unwrap(), 7);
    /// lock.set(11).unwrap();
    /// assert_eq!(lock.get_cloned().unwrap(), 11);
    /// ```
    #[unstable(feature = "lock_value_accessors", issue = "133407")]
    #[lint::should_not_be_called_on_const_items]
    pub fn set(&self, value: T) -> Result<(), PoisonError<T>> {
        if mem::needs_drop::<T>() {
            // If the contained value has non-trivial destructor, we
            // call that destructor after the lock being released.
            self.replace(value).map(drop)
        } else {
            match self.write() {
                Ok(mut guard) => {
                    *guard = value;

                    Ok(())
                }
                Err(_) => Err(PoisonError::new(value)),
            }
        }
    }

    /// Replaces the contained value with `value`, and returns the old contained value.
    ///
    /// # 错误
    ///
    /// This function will return an error containing the provided `value` if
    /// the `RwLock` is poisoned. An `RwLock` is poisoned whenever a writer
    /// panics while holding an exclusive lock.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(lock_value_accessors)]
    ///
    /// use std::sync::RwLock;
    ///
    /// let mut lock = RwLock::new(7);
    ///
    /// assert_eq!(lock.replace(11).unwrap(), 7);
    /// assert_eq!(lock.get_cloned().unwrap(), 11);
    /// ```
    #[unstable(feature = "lock_value_accessors", issue = "133407")]
    #[lint::should_not_be_called_on_const_items]
    pub fn replace(&self, value: T) -> LockResult<T> {
        match self.write() {
            Ok(mut guard) => Ok(mem::replace(&mut *guard, value)),
            Err(_) => Err(PoisonError::new(value)),
        }
    }
}

impl<T: ?Sized> RwLock<T> {
    /// Locks this `RwLock` with shared read access, blocking the current thread
    /// 直到能够获取该锁为止。
    ///
    /// 调用线程将被阻塞，直到没有更多写入者持有该锁为止。在
    /// 该方法返回时，可能已有其他读者正在锁内。
    /// 该方法不提供任何保证，关于有争议的读者或写入者谁会
    /// 先获取锁。
    /// 返回一个 RAII 保护对象，该对象将在被丢弃时释放该线程的共享访问权。
    ///
    /// # 错误
    /// once it is dropped.
    ///
    /// # Errors
    ///
    /// This function will return an error if the `RwLock` is poisoned. An
    /// `RwLock` is poisoned whenever a writer panics while holding an exclusive
    /// 如果锁已被当前线程以读或写模式持有，则该函数可能在调用时引发 panic。
    /// 当其他写入者或其他读者当前拥有锁访问权时，
    /// 该函数不会阻塞。
    ///
    /// # 该函数不提供任何保证，关于有争议的读者或写入者谁会先获取锁。
    ///
    /// # 错误
    /// in read or write mode.
    ///
    /// # Examples
    ///
    /// ```
    /// use std::sync::{Arc, RwLock};
    /// use std::thread;
    ///
    /// let lock = Arc::new(RwLock::new(1));
    /// let c_lock = Arc::clone(&lock);
    ///
    /// let n = lock.read().unwrap();
    /// assert_eq!(*n, 1);
    ///
    /// thread::spawn(move || {
    ///     let r = c_lock.read();
    ///     assert!(r.is_ok());
    /// }).join().unwrap();
    /// ```
    #[inline]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[lint::should_not_be_called_on_const_items]
    pub fn read(&self) -> LockResult<RwLockReadGuard<'_, T>> {
        unsafe {
            self.inner.read();
            RwLockReadGuard::new(self)
        }
    }

    /// Attempts to acquire this `RwLock` with shared read access.
    ///
    /// If the access could not be granted at this time, then `Err` is returned.
    /// Otherwise, an RAII guard is returned which will release the shared access
    /// when it is dropped.
    ///
    /// 否则，返回一个 RAII 保护对象，该对象将在被丢弃时释放共享访问权。
    ///
    /// 该函数不阻塞。
    /// 该函数不提供任何保证，关于有争议的读者或写入者谁会先获取锁。
    ///
    /// # 错误
    ///
    /// This function will return the [`Poisoned`] error if the `RwLock` is
    /// poisoned. An `RwLock` is poisoned whenever a writer panics while holding
    /// an exclusive lock. `Poisoned` will only be returned if the lock would
    /// have otherwise been acquired. An acquired lock guard will be contained
    /// in the returned error.
    ///
    /// This function will return the [`WouldBlock`] error if the `RwLock` could
    /// # 示例
    ///
    /// [`Poisoned`]: TryLockError::Poisoned
    /// [`WouldBlock`]: TryLockError::WouldBlock
    ///
    /// # Examples
    ///
    /// ```
    /// use std::sync::RwLock;
    ///
    /// let lock = RwLock::new(1);
    ///
    /// match lock.try_read() {
    ///     Ok(n) => assert_eq!(*n, 1),
    ///     Err(_) => unreachable!(),
    /// };
    /// ```
    #[inline]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[lint::should_not_be_called_on_const_items]
    pub fn try_read(&self) -> TryLockResult<RwLockReadGuard<'_, T>> {
        unsafe {
            if self.inner.try_read() {
                Ok(RwLockReadGuard::new(self)?)
            } else {
                Err(TryLockError::WouldBlock)
            }
        }
    }

    /// Locks this `RwLock` with exclusive write access, blocking the current
    /// 该函数不会在其他写入者或其他读者当前拥有锁访问权时返回。
    ///
    /// This function will not return while other writers or other readers
    /// currently have access to the lock.
    ///
    /// Returns an RAII guard which will drop the write access of this `RwLock`
    /// 在被丢弃时。
    ///
    /// # 错误
    ///
    /// This function will return an error if the `RwLock` is poisoned. An
    /// `RwLock` is poisoned whenever a writer panics while holding an exclusive
    /// lock. An error will be returned when the lock is acquired. The acquired
    /// 锁保护对象将包含在返回的错误的中。
    ///
    /// # panic
    ///
    /// 如果锁已被当前线程在读取或写入模式下持有，调用此函数可能会引发 panic。
    /// 
    ///
    /// # 示例
    ///
    /// ```
    /// use std::sync::RwLock;
    ///
    /// let lock = RwLock::new(1);
    ///
    /// let mut n = lock.write().unwrap();
    /// *n = 2;
    ///
    /// assert!(lock.try_read().is_err());
    /// ```
    #[inline]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[lint::should_not_be_called_on_const_items]
    pub fn write(&self) -> LockResult<RwLockWriteGuard<'_, T>> {
        unsafe {
            self.inner.write();
            RwLockWriteGuard::new(self)
        }
    }

    /// Attempts to lock this `RwLock` with exclusive write access.
    ///
    /// If the lock could not be acquired at this time, then `Err` is returned.
    /// 否则，返回一个 RAII 保护对象，该对象在被丢弃时释放锁。
    /// 
    ///
    /// 此函数不会阻塞。
    ///
    /// 此函数不保证有争议의读者或写入者会优先获取锁。
    /// # 错误
    ///
    /// # Errors
    ///
    /// This function will return the [`Poisoned`] error if the `RwLock` is
    /// poisoned. An `RwLock` is poisoned whenever a writer panics while holding
    /// an exclusive lock. `Poisoned` will only be returned if the lock would
    /// 可能可以检查该值以确定其是否处于一致状态，如果是的话，则移除污染。
    /// # 示例
    ///
    /// This function will return the [`WouldBlock`] error if the `RwLock` could
    /// 
    ///
    /// [`Poisoned`]: TryLockError::Poisoned
    /// [`WouldBlock`]: TryLockError::WouldBlock
    ///
    ///
    /// # 示例
    ///
    /// ```
    /// use std::sync::RwLock;
    ///
    /// let lock = RwLock::new(1);
    ///
    /// let n = lock.read().unwrap();
    /// assert_eq!(*n, 1);
    ///
    /// assert!(lock.try_write().is_err());
    /// ```
    #[inline]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[lint::should_not_be_called_on_const_items]
    pub fn try_write(&self) -> TryLockResult<RwLockWriteGuard<'_, T>> {
        unsafe {
            if self.inner.try_write() {
                Ok(RwLockWriteGuard::new(self)?)
            } else {
                Err(TryLockError::WouldBlock)
            }
        }
    }

    /// 确定锁是否被污染。
    ///
    /// If another thread is active, the lock can still become poisoned at any
    /// time. You should not trust a `false` value for program correctness
    /// 
    ///
    /// # 示例
    ///
    /// ```
    /// use std::sync::{Arc, RwLock};
    /// use std::thread;
    ///
    /// let lock = Arc::new(RwLock::new(0));
    /// let c_lock = Arc::clone(&lock);
    ///
    /// let _ = thread::spawn(move || {
    ///     let _lock = c_lock.write().unwrap();
    ///     panic!(); // the lock gets poisoned
    /// }).join();
    /// assert_eq!(lock.is_poisoned(), true);
    /// ```
    #[inline]
    #[stable(feature = "sync_poison", since = "1.2.0")]
    pub fn is_poisoned(&self) -> bool {
        self.poison.get()
    }

    /// 清除锁的污染状态。
    ///
    /// 如果锁被污染，它将保持污染状态直到调用此函数。这允许从污染状态中恢复并标记已恢复。例如，如果
    /// 值被一个有效的新值覆盖，则可以将锁标记为未污染。或者，
    /// 可能可以检查该值以确定其是否处于一致状态，如果是的话，则移除污染。
    /// 
    /// 此函数不会阻塞。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::sync::{Arc, RwLock};
    /// use std::thread;
    ///
    /// let lock = Arc::new(RwLock::new(0));
    /// let c_lock = Arc::clone(&lock);
    ///
    /// let _ = thread::spawn(move || {
    ///     let _lock = c_lock.write().unwrap();
    ///     panic!(); // the lock gets poisoned
    /// }).join();
    ///
    /// assert_eq!(lock.is_poisoned(), true);
    /// let guard = lock.write().unwrap_or_else(|mut e| {
    ///     **e.get_mut() = 1;
    ///     lock.clear_poison();
    ///     e.into_inner()
    /// });
    /// assert_eq!(lock.is_poisoned(), false);
    /// assert_eq!(*guard, 1);
    /// ```
    #[inline]
    #[stable(feature = "mutex_unpoison", since = "1.77.0")]
    pub fn clear_poison(&self) {
        self.poison.clear();
    }

    /// Consumes this `RwLock`, returning the underlying data.
    ///
    /// # 错误
    ///
    /// This function will return an error containing the underlying data if
    /// the `RwLock` is poisoned. An `RwLock` is poisoned whenever a writer
    /// panics while holding an exclusive lock. An error will only be returned
    /// 如果锁本来会被获取的话。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::sync::RwLock;
    ///
    /// let lock = RwLock::new(String::new());
    /// {
    ///     let mut s = lock.write().unwrap();
    ///     *s = "modified".to_owned();
    /// }
    /// assert_eq!(lock.into_inner().unwrap(), "modified");
    /// ```
    #[stable(feature = "rwlock_into_inner", since = "1.6.0")]
    pub fn into_inner(self) -> LockResult<T>
    where
        T: Sized,
    {
        let data = self.data.into_inner();
        poison::map_result(self.poison.borrow(), |()| data)
    }

    /// 返回一个对底层数据的可修改引用。
    ///
    /// Since this call borrows the `RwLock` mutably, no actual locking needs to
    /// 实际的锁定操作——静态的可修改借用状态确保不会获取新的锁
    /// 只要此引用存在。注意，该方法不会清除任何之前被放弃的
    /// locks (e.g., via [`forget()`] on a [`RwLockReadGuard`] or [`RwLockWriteGuard`]).
    ///
    /// # 错误
    ///
    /// This function will return an error containing a mutable reference to
    /// the underlying data if the `RwLock` is poisoned. An `RwLock` is
    /// poisoned whenever a writer panics while holding an exclusive lock.
    /// 只有在该锁本来会被获取的情况下才会返回错误。
    /// # 示例
    ///
    /// # 返回一个对底层数据的原始指针。
    ///
    /// ```
    /// use std::sync::RwLock;
    ///
    /// let mut lock = RwLock::new(0);
    /// *lock.get_mut().unwrap() = 10;
    /// assert_eq!(*lock.read().unwrap(), 10);
    /// ```
    #[stable(feature = "rwlock_get_mut", since = "1.6.0")]
    pub fn get_mut(&mut self) -> LockResult<&mut T> {
        let data = self.data.get_mut();
        poison::map_result(self.poison.borrow(), |()| data)
    }

    /// 返回一个指向底层数据的原始指针。
    ///
    /// 返回的指针始终不为空且正确对齐，但确保通过它进行的任何读取和写入
    /// 都正确同步以避免数据竞争是用户的责任，并且确保在锁被释放后不会被读取或写入。
    /// are properly synchronized to avoid data races, and that it is not read
    /// or written through after the lock is dropped.
    #[unstable(feature = "rwlock_data_ptr", issue = "140368")]
    pub const fn data_ptr(&self) -> *mut T {
        self.data.get()
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T: ?Sized + fmt::Debug> fmt::Debug for RwLock<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let mut d = f.debug_struct("RwLock");
        match self.try_read() {
            Ok(guard) => {
                d.field("data", &&*guard);
            }
            Err(TryLockError::Poisoned(err)) => {
                d.field("data", &&**err.get_ref());
            }
            Err(TryLockError::WouldBlock) => {
                d.field("data", &format_args!("<locked>"));
            }
        }
        d.field("poisoned", &self.poison.get());
        d.finish_non_exhaustive()
    }
}

#[stable(feature = "rw_lock_default", since = "1.10.0")]
impl<T: Default> Default for RwLock<T> {
    /// Creates a new `RwLock<T>`, with the `Default` value for T.
    fn default() -> RwLock<T> {
        RwLock::new(Default::default())
    }
}

#[stable(feature = "rw_lock_from", since = "1.24.0")]
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
    /// 当且仅当同一线程在实例化此对象之前成功且安全地调用了
    /// `lock.inner.read()`, `lock.inner.try_read()`, or `lock.inner.downgrade()` before
    /// 此函数安全。
    unsafe fn new(lock: &'rwlock RwLock<T>) -> LockResult<RwLockReadGuard<'rwlock, T>> {
        poison::map_result(lock.poison.borrow(), |()| RwLockReadGuard {
            data: unsafe { NonNull::new_unchecked(lock.data.get()) },
            inner_lock: &lock.inner,
        })
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
    /// # Panic
    ///
    /// 如果闭包发生 panic，保护机制将被丢弃（解锁），RwLock 不会
    /// 被污染。
    #[unstable(feature = "mapped_lock_guards", issue = "117108")]
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
    /// # Panic
    ///
    /// 如果闭包发生 panic，保护机制将被丢弃（解锁），RwLock 不会
    /// 被污染了。
    #[unstable(feature = "mapped_lock_guards", issue = "117108")]
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
    /// 当且仅当同一线程在
    /// `lock.inner.write()`, `lock.inner.try_write()`, or `lock.inner.try_upgrade` before
    /// 实例化此对象之前。
    unsafe fn new(lock: &'rwlock RwLock<T>) -> LockResult<RwLockWriteGuard<'rwlock, T>> {
        poison::map_result(lock.poison.guard(), |guard| RwLockWriteGuard { lock, poison: guard })
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
    /// use std::sync::{RwLock, RwLockWriteGuard};
    ///
    /// let rw = RwLock::new(0);
    ///
    /// let mut write_guard = rw.write().unwrap();
    /// *write_guard = 42;
    ///
    /// let read_guard = RwLockWriteGuard::downgrade(write_guard);
    /// assert_eq!(42, *read_guard);
    /// ```
    ///
    /// `downgrade` will _atomically_ change the state of the [`RwLock`] from exclusive mode into
    /// 共享模式。这意味着另一个写线程无法介入其中。
    /// thread calling `downgrade` and any reads it performs after downgrading.
    ///
    /// ```
    /// use std::sync::{Arc, RwLock, RwLockWriteGuard};
    ///
    /// let rw = Arc::new(RwLock::new(1));
    ///
    /// // Put the lock in write mode.
    /// let mut main_write_guard = rw.write().unwrap();
    ///
    /// let rw_clone = rw.clone();
    /// let evil_handle = std::thread::spawn(move || {
    ///     // This will not return until the main thread drops the `main_read_guard`.
    ///     let mut evil_guard = rw_clone.write().unwrap();
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
    /// # let final_check = rw.read().unwrap();
    /// # assert_eq!(*final_check, 3);
    /// ```
    #[stable(feature = "rwlock_downgrade", since = "1.92.0")]
    pub fn downgrade(s: Self) -> RwLockReadGuard<'rwlock, T> {
        let lock = s.lock;

        // We don't want to call the destructor since that calls `write_unlock`.
        forget(s);

        // SAFETY: We take ownership of a write guard, so we must already have the `RwLock` in write
        // mode, satisfying the `downgrade` contract.
        unsafe { lock.inner.downgrade() };

        // SAFETY: We have just successfully called `downgrade`, so we fulfill the safety contract.
        unsafe { RwLockReadGuard::new(lock).unwrap_or_else(PoisonError::into_inner) }
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
    /// 如果闭包发生恐慌，保护机制将被丢弃（解锁），RwLock 也会被污染。
    #[unstable(feature = "mapped_lock_guards", issue = "117108")]
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
        MappedRwLockWriteGuard {
            data,
            inner_lock: &orig.lock.inner,
            poison_flag: &orig.lock.poison,
            poison_guard: orig.poison.clone(),
            _variance: PhantomData,
        }
    }

    /// Makes a [`MappedRwLockWriteGuard`] for a component of the borrowed data. The
    /// original guard is returned as an `Err(...)` if the closure returns
    /// `None`.
    ///
    /// The `RwLock` is already locked for writing, so this cannot fail.
    ///
    /// This is an associated function that needs to be used as
    /// `RwLockWriteGuard::filter_map(...)`. A method would interfere with methods
    /// of the same name on the contents of the `RwLockWriteGuard` used through
    /// `Deref`.
    ///
    /// # 恐慌
    ///
    /// 如果闭包发生恐慌，保护机制将被丢弃（解锁），RwLock 不会被污染。
    #[unstable(feature = "mapped_lock_guards", issue = "117108")]
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
                    poison_flag: &orig.lock.poison,
                    poison_guard: orig.poison.clone(),
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
    /// 如果闭包发生恐慌，保护机制将被丢弃（解锁），RwLock 不会被污染。
    /// 被污染了。
    #[unstable(feature = "mapped_lock_guards", issue = "117108")]
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
    /// 这是一个关联函数，需要作为
    /// `MappedRwLockReadGuard::filter_map(...)`. A method would interfere with
    /// methods of the same name on the contents of the `MappedRwLockReadGuard`
    /// used through `Deref`.
    ///
    /// # 恐慌
    ///
    /// 如果闭包发生恐慌，保护机制将被释放（解锁），RwLock 将不会
    /// 中毒。
    #[unstable(feature = "mapped_lock_guards", issue = "117108")]
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
    /// 例如枚举变体。
    ///
    /// The `RwLock` is already locked for writing, so this cannot fail.
    ///
    /// 这是一个关联函数，需要作为
    /// `MappedRwLockWriteGuard::map(...)`. A method would interfere with
    /// methods of the same name on the contents of the `MappedRwLockWriteGuard`
    /// used through `Deref`.
    ///
    /// # 恐慌
    ///
    /// 如果闭包发生恐慌，保护机制将被释放（解锁），RwLock 将中毒。
    #[unstable(feature = "mapped_lock_guards", issue = "117108")]
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
        MappedRwLockWriteGuard {
            data,
            inner_lock: orig.inner_lock,
            poison_flag: orig.poison_flag,
            poison_guard: orig.poison_guard.clone(),
            _variance: PhantomData,
        }
    }

    /// Makes a [`MappedRwLockWriteGuard`] for a component of the borrowed data.
    /// The original guard is returned as an `Err(...)` if the closure returns
    /// `None`.
    ///
    /// The `RwLock` is already locked for writing, so this cannot fail.
    ///
    /// 这是一个关联函数，需要作为
    /// `MappedRwLockWriteGuard::filter_map(...)`. A method would interfere with
    /// methods of the same name on the contents of the `MappedRwLockWriteGuard`
    /// used through `Deref`.
    ///
    /// # 恐慌
    ///
    /// 如果闭包发生恐慌，保护机制将被释放（解锁），RwLock 将中毒。
    #[unstable(feature = "mapped_lock_guards", issue = "117108")]
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
                    poison_flag: orig.poison_flag,
                    poison_guard: orig.poison_guard.clone(),
                    _variance: PhantomData,
                })
            }
            None => Err(orig),
        }
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T: ?Sized> Drop for RwLockReadGuard<'_, T> {
    fn drop(&mut self) {
        // SAFETY: the conditions of `RwLockReadGuard::new` were satisfied when created.
        unsafe {
            self.inner_lock.read_unlock();
        }
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T: ?Sized> Drop for RwLockWriteGuard<'_, T> {
    fn drop(&mut self) {
        self.lock.poison.done(&self.poison);
        // SAFETY: the conditions of `RwLockWriteGuard::new` were satisfied when created.
        unsafe {
            self.lock.inner.write_unlock();
        }
    }
}

#[unstable(feature = "mapped_lock_guards", issue = "117108")]
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
impl<T: ?Sized> Drop for MappedRwLockWriteGuard<'_, T> {
    fn drop(&mut self) {
        self.poison_flag.done(&self.poison_guard);
        // SAFETY: the conditions of `RwLockWriteGuard::new` were satisfied when the original guard
        // was created, and have been upheld throughout `map` and/or `filter_map`.
        unsafe {
            self.inner_lock.write_unlock();
        }
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T: ?Sized> Deref for RwLockReadGuard<'_, T> {
    type Target = T;

    fn deref(&self) -> &T {
        // SAFETY: the conditions of `RwLockReadGuard::new` were satisfied when created.
        unsafe { self.data.as_ref() }
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T: ?Sized> Deref for RwLockWriteGuard<'_, T> {
    type Target = T;

    fn deref(&self) -> &T {
        // SAFETY: the conditions of `RwLockWriteGuard::new` were satisfied when created.
        unsafe { &*self.lock.data.get() }
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T: ?Sized> DerefMut for RwLockWriteGuard<'_, T> {
    fn deref_mut(&mut self) -> &mut T {
        // SAFETY: the conditions of `RwLockWriteGuard::new` were satisfied when created.
        unsafe { &mut *self.lock.data.get() }
    }
}

#[unstable(feature = "mapped_lock_guards", issue = "117108")]
impl<T: ?Sized> Deref for MappedRwLockReadGuard<'_, T> {
    type Target = T;

    fn deref(&self) -> &T {
        // SAFETY: the conditions of `RwLockReadGuard::new` were satisfied when the original guard
        // was created, and have been upheld throughout `map` and/or `filter_map`.
        unsafe { self.data.as_ref() }
    }
}

#[unstable(feature = "mapped_lock_guards", issue = "117108")]
impl<T: ?Sized> Deref for MappedRwLockWriteGuard<'_, T> {
    type Target = T;

    fn deref(&self) -> &T {
        // SAFETY: the conditions of `RwLockWriteGuard::new` were satisfied when the original guard
        // was created, and have been upheld throughout `map` and/or `filter_map`.
        unsafe { self.data.as_ref() }
    }
}

#[unstable(feature = "mapped_lock_guards", issue = "117108")]
impl<T: ?Sized> DerefMut for MappedRwLockWriteGuard<'_, T> {
    fn deref_mut(&mut self) -> &mut T {
        // SAFETY: the conditions of `RwLockWriteGuard::new` were satisfied when the original guard
        // was created, and have been upheld throughout `map` and/or `filter_map`.
        unsafe { self.data.as_mut() }
    }
}

#[stable(feature = "std_debug", since = "1.16.0")]
impl<T: ?Sized + fmt::Debug> fmt::Debug for RwLockReadGuard<'_, T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        (**self).fmt(f)
    }
}

#[stable(feature = "std_guard_impls", since = "1.20.0")]
impl<T: ?Sized + fmt::Display> fmt::Display for RwLockReadGuard<'_, T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        (**self).fmt(f)
    }
}

#[stable(feature = "std_debug", since = "1.16.0")]
impl<T: ?Sized + fmt::Debug> fmt::Debug for RwLockWriteGuard<'_, T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        (**self).fmt(f)
    }
}

#[stable(feature = "std_guard_impls", since = "1.20.0")]
impl<T: ?Sized + fmt::Display> fmt::Display for RwLockWriteGuard<'_, T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        (**self).fmt(f)
    }
}

#[unstable(feature = "mapped_lock_guards", issue = "117108")]
impl<T: ?Sized + fmt::Debug> fmt::Debug for MappedRwLockReadGuard<'_, T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        (**self).fmt(f)
    }
}

#[unstable(feature = "mapped_lock_guards", issue = "117108")]
impl<T: ?Sized + fmt::Display> fmt::Display for MappedRwLockReadGuard<'_, T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        (**self).fmt(f)
    }
}

#[unstable(feature = "mapped_lock_guards", issue = "117108")]
impl<T: ?Sized + fmt::Debug> fmt::Debug for MappedRwLockWriteGuard<'_, T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        (**self).fmt(f)
    }
}

#[unstable(feature = "mapped_lock_guards", issue = "117108")]
impl<T: ?Sized + fmt::Display> fmt::Display for MappedRwLockWriteGuard<'_, T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        (**self).fmt(f)
    }
}
