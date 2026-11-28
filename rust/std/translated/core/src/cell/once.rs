use crate::cell::UnsafeCell;
use crate::{fmt, mem};

/// 一个名义上只能写入一次的单元。
///
/// This allows obtaining a shared `&T` reference to its inner value without copying or replacing
/// it (unlike [`Cell`]), and without runtime borrow checks (unlike [`RefCell`]). However,
/// 除非有对该单元的可变引用，否则只能获取不可变的引用。
/// 同样，该单元只能通过这样的可变引用重新初始化。
///
/// A `OnceCell` can be thought of as a safe abstraction over uninitialized data that becomes
/// 一旦写入，就会被初始化。
///
/// For a thread-safe version of this struct, see [`std::sync::OnceLock`].
///
/// [`RefCell`]: crate::cell::RefCell
/// [`Cell`]: crate::cell::Cell
/// [`std::sync::OnceLock`]: ../../std/sync/struct.OnceLock.html
///
/// # 示例
///
/// ```
/// use std::cell::OnceCell;
///
/// let cell = OnceCell::new();
/// assert!(cell.get().is_none());
///
/// let value: &String = cell.get_or_init(|| {
///     "Hello, World!".to_string()
/// });
/// assert_eq!(value, "Hello, World!");
/// assert!(cell.get().is_some());
/// ```
#[stable(feature = "once_cell", since = "1.70.0")]
pub struct OnceCell<#[rustc_assert_variance(invariant)] T> {
    // Invariant: written to at most once.
    inner: UnsafeCell<Option<T>>,
}

impl<T> OnceCell<T> {
    /// 创建一个新的未初始化单元。
    #[inline]
    #[must_use]
    #[stable(feature = "once_cell", since = "1.70.0")]
    #[rustc_const_stable(feature = "once_cell", since = "1.70.0")]
    pub const fn new() -> OnceCell<T> {
        OnceCell { inner: UnsafeCell::new(None) }
    }

    /// 创建一个新的已初始化单元。
    ///
    /// This is equivalent to `OnceCell::from(value)`, but can be used in
    /// const contexts, unlike the `From` implementation.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(once_cell_new_init)]
    /// use std::cell::OnceCell;
    ///
    /// const CELL: OnceCell<i32> = OnceCell::new_init(1);
    /// assert_eq!(CELL.get(), Some(&1));
    ///
    /// let cell = OnceCell::new_init(String::from("kitty"));
    /// assert_eq!(cell.set(String::from("puppy")), Err(String::from("puppy")));
    /// assert_eq!(cell.get(), Some(&"kitty".to_string()));
    /// ```
    #[inline]
    #[must_use]
    #[unstable(feature = "once_cell_new_init", issue = "159859")]
    pub const fn new_init(init_value: T) -> OnceCell<T> {
        OnceCell { inner: UnsafeCell::new(Some(init_value)) }
    }

    /// 获取对底层值的引用。
    ///
    /// Returns `None` if the cell is uninitialized.
    #[inline]
    #[stable(feature = "once_cell", since = "1.70.0")]
    pub fn get(&self) -> Option<&T> {
        // SAFETY: Safe due to `inner`'s invariant
        unsafe { &*self.inner.get() }.as_ref()
    }

    /// 获取对底层值的可变引用。
    ///
    /// Returns `None` if the cell is uninitialized.
    #[inline]
    #[stable(feature = "once_cell", since = "1.70.0")]
    pub fn get_mut(&mut self) -> Option<&mut T> {
        self.inner.get_mut().as_mut()
    }

    /// Initializes the contents of the cell to `value`.
    ///
    /// # 错误
    ///
    /// This method returns `Ok(())` if the cell was uninitialized
    /// and `Err(value)` if it was already initialized.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::cell::OnceCell;
    ///
    /// let cell = OnceCell::new();
    /// assert!(cell.get().is_none());
    ///
    /// assert_eq!(cell.set(92), Ok(()));
    /// assert_eq!(cell.set(62), Err(62));
    ///
    /// assert!(cell.get().is_some());
    /// ```
    #[inline]
    #[stable(feature = "once_cell", since = "1.70.0")]
    #[lint::should_not_be_called_on_const_items]
    pub fn set(&self, value: T) -> Result<(), T> {
        match self.try_insert(value) {
            Ok(_) => Ok(()),
            Err((_, value)) => Err(value),
        }
    }

    /// Initializes the contents of the cell to `value` if the cell was
    /// 如果单元未初始化，则返回一个引用。
    ///
    /// # 错误
    ///
    /// This method returns `Ok(&value)` if the cell was uninitialized
    /// and `Err((&current_value, value))` if it was already initialized.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(once_cell_try_insert)]
    ///
    /// use std::cell::OnceCell;
    ///
    /// let cell = OnceCell::new();
    /// assert!(cell.get().is_none());
    ///
    /// assert_eq!(cell.try_insert(92), Ok(&92));
    /// assert_eq!(cell.try_insert(62), Err((&92, 62)));
    ///
    /// assert!(cell.get().is_some());
    /// ```
    #[inline]
    #[unstable(feature = "once_cell_try_insert", issue = "116693")]
    #[lint::should_not_be_called_on_const_items]
    pub fn try_insert(&self, value: T) -> Result<&T, (&T, T)> {
        if let Some(old) = self.get() {
            return Err((old, value));
        }

        // SAFETY: This is the only place where we set the slot, no races
        // due to reentrancy/concurrency are possible, and we've
        // checked that slot is currently `None`, so this write
        // maintains the `inner`'s invariant.
        let slot = unsafe { &mut *self.inner.get() };
        Ok(slot.insert(value))
    }

    /// Gets the contents of the cell, initializing it to `f()`
    /// 如果单元未初始化，则进行初始化。
    ///
    /// # Panic
    ///
    /// If `f()` panics, the panic is propagated to the caller, and the cell
    /// 仍保持未初始化状态。
    ///
    /// It is an error to reentrantly initialize the cell from `f`. Doing
    /// 进而引发 panic。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::cell::OnceCell;
    ///
    /// let cell = OnceCell::new();
    /// let value = cell.get_or_init(|| 92);
    /// assert_eq!(value, &92);
    /// let value = cell.get_or_init(|| unreachable!());
    /// assert_eq!(value, &92);
    /// ```
    #[inline]
    #[stable(feature = "once_cell", since = "1.70.0")]
    #[lint::should_not_be_called_on_const_items]
    pub fn get_or_init<F>(&self, f: F) -> &T
    where
        F: FnOnce() -> T,
    {
        match self.get_or_try_init(|| Ok::<T, !>(f())) {
            Ok(val) => val,
        }
    }

    /// 获取单元内容的可变引用，
    /// initializing it to `f()` if the cell was uninitialized.
    ///
    /// # Panic
    ///
    /// If `f()` panics, the panic is propagated to the caller, and the cell
    /// 仍保持未初始化状态。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(once_cell_get_mut)]
    ///
    /// use std::cell::OnceCell;
    ///
    /// let mut cell = OnceCell::new();
    /// let value = cell.get_mut_or_init(|| 92);
    /// assert_eq!(*value, 92);
    ///
    /// *value += 2;
    /// assert_eq!(*value, 94);
    ///
    /// let value = cell.get_mut_or_init(|| unreachable!());
    /// assert_eq!(*value, 94);
    /// ```
    #[inline]
    #[unstable(feature = "once_cell_get_mut", issue = "121641")]
    pub fn get_mut_or_init<F>(&mut self, f: F) -> &mut T
    where
        F: FnOnce() -> T,
    {
        match self.get_mut_or_try_init(|| Ok::<T, !>(f())) {
            Ok(val) => val,
        }
    }

    /// Gets the contents of the cell, initializing it to `f()` if
    /// 如果单元未初始化，则返回一个错误。
    /// and `f()` failed, an error is returned.
    ///
    /// # Panic
    ///
    /// If `f()` panics, the panic is propagated to the caller, and the cell
    /// 仍保持未初始化状态。
    ///
    /// It is an error to reentrantly initialize the cell from `f`. Doing
    /// 进而引发 panic。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(once_cell_try)]
    ///
    /// use std::cell::OnceCell;
    ///
    /// let cell = OnceCell::new();
    /// assert_eq!(cell.get_or_try_init(|| Err(())), Err(()));
    /// assert!(cell.get().is_none());
    /// let value = cell.get_or_try_init(|| -> Result<i32, ()> {
    ///     Ok(92)
    /// });
    /// assert_eq!(value, Ok(&92));
    /// assert_eq!(cell.get(), Some(&92))
    /// ```
    #[unstable(feature = "once_cell_try", issue = "109737")]
    #[lint::should_not_be_called_on_const_items]
    pub fn get_or_try_init<F, E>(&self, f: F) -> Result<&T, E>
    where
        F: FnOnce() -> Result<T, E>,
    {
        if let Some(val) = self.get() {
            return Ok(val);
        }
        self.try_init(f)
    }

    /// 获取单元格内容的可修改引用，进行初始化。
    /// it to `f()` if the cell was uninitialized. If the cell was uninitialized
    /// and `f()` failed, an error is returned.
    ///
    /// # Panics
    ///
    /// If `f()` panics, the panic is propagated to the caller, and the cell
    /// 仍保持未初始化状态。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(once_cell_get_mut)]
    ///
    /// use std::cell::OnceCell;
    ///
    /// let mut cell: OnceCell<u32> = OnceCell::new();
    ///
    /// // Failed attempts to initialize the cell do not change its contents
    /// assert!(cell.get_mut_or_try_init(|| "not a number!".parse()).is_err());
    /// assert!(cell.get().is_none());
    ///
    /// let value = cell.get_mut_or_try_init(|| "1234".parse());
    /// assert_eq!(value, Ok(&mut 1234));
    ///
    /// let Ok(value) = value else { return; };
    /// *value += 2;
    /// assert_eq!(cell.get(), Some(&1236))
    /// ```
    #[unstable(feature = "once_cell_get_mut", issue = "121641")]
    pub fn get_mut_or_try_init<F, E>(&mut self, f: F) -> Result<&mut T, E>
    where
        F: FnOnce() -> Result<T, E>,
    {
        if self.get().is_none() {
            self.try_init(f)?;
        }
        Ok(self.get_mut().unwrap())
    }

    // Avoid inlining the initialization closure into the common path that fetches
    // the already initialized value
    #[cold]
    fn try_init<F, E>(&self, f: F) -> Result<&T, E>
    where
        F: FnOnce() -> Result<T, E>,
    {
        let val = f()?;
        // Note that *some* forms of reentrant initialization might lead to
        // UB (see `reentrant_init` test). I believe that just removing this
        // `panic`, while keeping `try_insert` would be sound, but it seems
        // better to panic, rather than to silently use an old value.
        if let Ok(val) = self.try_insert(val) { Ok(val) } else { panic!("reentrant init") }
    }

    /// 消耗单元格，返回包装的值。
    ///
    /// Returns `None` if the cell was uninitialized.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::cell::OnceCell;
    ///
    /// let cell: OnceCell<String> = OnceCell::new();
    /// assert_eq!(cell.into_inner(), None);
    ///
    /// let cell = OnceCell::new();
    /// let _ = cell.set("hello".to_owned());
    /// assert_eq!(cell.into_inner(), Some("hello".to_owned()));
    /// ```
    #[inline]
    #[stable(feature = "once_cell", since = "1.70.0")]
    #[rustc_const_stable(feature = "const_cell_into_inner", since = "1.83.0")]
    #[rustc_allow_const_fn_unstable(const_precise_live_drops)]
    pub const fn into_inner(self) -> Option<T> {
        // Because `into_inner` takes `self` by value, the compiler statically verifies
        // that it is not currently borrowed. So it is safe to move out `Option<T>`.
        self.inner.into_inner()
    }

    /// Takes the value out of this `OnceCell`, moving it back to an uninitialized state.
    ///
    /// Has no effect and returns `None` if the `OnceCell` is uninitialized.
    ///
    /// 通过要求可修改引用来确保安全性。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::cell::OnceCell;
    ///
    /// let mut cell: OnceCell<String> = OnceCell::new();
    /// assert_eq!(cell.take(), None);
    ///
    /// let mut cell = OnceCell::new();
    /// let _ = cell.set("hello".to_owned());
    /// assert_eq!(cell.take(), Some("hello".to_owned()));
    /// assert_eq!(cell.get(), None);
    /// ```
    #[inline]
    #[stable(feature = "once_cell", since = "1.70.0")]
    pub fn take(&mut self) -> Option<T> {
        mem::take(self).into_inner()
    }
}

#[stable(feature = "once_cell", since = "1.70.0")]
#[rustc_const_unstable(feature = "const_default", issue = "143894")]
const impl<T> Default for OnceCell<T> {
    #[inline]
    fn default() -> Self {
        Self::new()
    }
}

#[stable(feature = "once_cell", since = "1.70.0")]
impl<T: fmt::Debug> fmt::Debug for OnceCell<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let mut d = f.debug_tuple("OnceCell");
        match self.get() {
            Some(v) => d.field(v),
            None => d.field(&format_args!("<uninit>")),
        };
        d.finish()
    }
}

#[stable(feature = "once_cell", since = "1.70.0")]
impl<T: Clone> Clone for OnceCell<T> {
    #[inline]
    fn clone(&self) -> OnceCell<T> {
        match self.get() {
            Some(value) => OnceCell::from(value.clone()),
            None => OnceCell::new(),
        }
    }
}

#[stable(feature = "once_cell", since = "1.70.0")]
impl<T: PartialEq> PartialEq for OnceCell<T> {
    #[inline]
    fn eq(&self, other: &Self) -> bool {
        self.get() == other.get()
    }
}

#[stable(feature = "once_cell", since = "1.70.0")]
impl<T: Eq> Eq for OnceCell<T> {}

#[stable(feature = "once_cell", since = "1.70.0")]
#[rustc_const_unstable(feature = "const_convert", issue = "143773")]
const impl<T> From<T> for OnceCell<T> {
    /// Creates a new `OnceCell<T>` which already contains the given `value`.
    #[inline]
    fn from(value: T) -> Self {
        OnceCell { inner: UnsafeCell::new(Some(value)) }
    }
}

// Just like for `Cell<T>` this isn't needed, but results in nicer error messages.
#[stable(feature = "once_cell", since = "1.70.0")]
impl<T> !Sync for OnceCell<T> {}
