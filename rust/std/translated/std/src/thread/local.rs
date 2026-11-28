//! 线程本地存储

#![unstable(feature = "thread_local_internals", issue = "none")]

use crate::cell::{Cell, RefCell};
use crate::error::Error;
use crate::fmt;

/// 这是一个拥有其内容的线程本地存储（TLS）键。
///
/// 此键使用目标平台上最快的实现方式。
/// It is instantiated with the [`thread_local!`] macro and the
/// primary method is the [`with`] method, though there are helpers to make
/// working with [`Cell`] types easier.
///
/// The [`with`] method yields a reference to the contained value which cannot
/// # 初始化与销毁
///
/// [`thread_local!`]: crate::thread_local
///
/// # 初始化在首次调用设置器时动态进行（例如：
///
/// Initialization is dynamically performed on the first call to a setter (e.g.
/// [`with`]) within a thread, and values that implement [`Drop`] get
/// 请注意，如果析构函数引发 panic，整个进程将被 [中止]。
/// are explained below.
/// 利用线程本地存储。
/// On platforms where initialization requires memory allocation, this is
/// performed directly through [`System`], allowing the [global allocator]
/// to make use of thread local storage.
///
/// A `LocalKey`'s initializer cannot recursively depend on itself. Using a
/// `LocalKey` in this way may cause panics, aborts, or infinite recursion on
/// the first call to `with`.
///
/// [`System`]: crate::alloc::System
/// [global allocator]: crate::alloc
/// [aborted]: crate::process::abort
///
/// # 单线程同步
///
/// Though there is no potential race with other threads, it is still possible to
/// obtain multiple references to the thread-local data in different places on
/// the call stack. For this reason, only shared (`&T`) references may be obtained.
///
/// To allow obtaining an exclusive mutable reference (`&mut T`), typically a
/// [`Cell`] or [`RefCell`] is used (see the [`std::cell`] for more information
/// # 平台特定行为
/// implementations for [`LocalKey<Cell<T>>`] and [`LocalKey<RefCell<T>>`].
///
/// [`std::cell`]: `crate::cell`
/// [`LocalKey<Cell<T>>`]: struct.LocalKey.html#impl-LocalKey<Cell<T>>
/// [`LocalKey<RefCell<T>>`]: struct.LocalKey.html#impl-LocalKey<RefCell<T>>
///
///
/// # 所有线程本地存储中的类型析构函数都被调用。例如，存在许多已知的限制情况，其中析构函数不会被调用：
///
/// ```
/// use std::cell::Cell;
/// use std::thread;
///
/// // explicit `const {}` block enables more efficient initialization
/// thread_local!(static FOO: Cell<u32> = const { Cell::new(1) });
///
/// assert_eq!(FOO.get(), 1);
/// FOO.set(2);
///
/// // each thread starts out with the initial value of 1
/// let t = thread::spawn(move || {
///     assert_eq!(FOO.get(), 1);
///     FOO.set(3);
/// });
///
/// // wait for the thread to complete and bail out on panic
/// t.join().unwrap();
///
/// // we retain our original value of 2 despite the child thread
/// assert_eq!(FOO.get(), 2);
/// ```
///
/// # 1. 在 Unix 系统上，当使用基于 pthread 的 TLS 时，主线程退出时，TLS 值对应的析构函数不会被调用。请注意，
///
/// 应用程序也会在主线程退出后立即退出。
/// stored in thread local storage are run, but not all platforms can guarantee
/// that destructors will be run for all types in thread local storage. For
/// example, there are a number of known caveats where destructors are not run:
///
/// 1. On Unix systems when pthread-based TLS is being used, destructors will
/// not be run for TLS values on the main thread when it exits. Note that the
/// application will exit immediately after the main thread exits as well.
/// 2. 在所有平台上，TLS 都可能重新初始化其他 TLS 槽位。
/// 在销毁过程中。某些平台确保这种情况不会发生。
/// 通过防止已销毁的槽位被重新初始化，从而无限期地保持这一状态。
/// 但并非所有平台都具备此保护机制。具备该保护的平台通常有一个合成限制，超过此限制后不会再执行析构函数。
/// 不提供保护的平台通常有一个合成限制，超过此限制后不会再执行析构函数。
/// 此时会执行析构函数。
/// 3. 在 Windows 系统上，当进程退出时，TLS 析构函数可能仅在
/// 导致进程退出的线程上执行。这是因为其他线程可能会被强制终止。
/// 如果某个线程在转换为纤程时退出，或者在纤程中运行时需要 Rust TLS 析构函数支持，则 TLS 析构函数可能会泄露。
///
///    TLS destructors may be leaked if a thread exits while [converted into a fiber],
///    or if Rust TLS destructor support is first needed while running in a fiber.
///
///    If a process loads a Rust `cdylib`, it must not cause the Rust TLS destructor support
/// # 语法
///
///    When dynamically unloading a Rust `cdylib`, pending TLS destructors may run
/// 允许为每个静态变量设置公开性和属性。例如：
///
/// [converted into a fiber]: https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-convertthreadtofiber
/// [loader lock]: https://docs.microsoft.com/en-us/windows/win32/dlls/dynamic-link-library-best-practices
/// [`with`]: LocalKey::with
#[cfg_attr(not(test), rustc_diagnostic_item = "LocalKey")]
#[stable(feature = "rust1", since = "1.0.0")]
pub struct LocalKey<T: 'static> {
    // This outer `LocalKey<T>` type is what's going to be stored in statics,
    // but actual data inside will sometimes be tagged with #[thread_local].
    // It's not valid for a true static to reference a #[thread_local] static,
    // so we get around that by exposing an accessor through a layer of function
    // indirection (this thunk).
    //
    // Note that the thunk is itself unsafe because the returned lifetime of the
    // slot where data lives, `'static`, is not actually valid. The lifetime
    // here is actually slightly shorter than the currently running thread!
    //
    // Although this is an extra layer of indirection, it should in theory be
    // trivially devirtualizable by LLVM because the value of `inner` never
    // changes and the constant should be readonly within a crate. This mainly
    // only runs into problems when TLS statics are exported across crates.
    //
    // The argument of the function, `init`, can be used to initialize the key for the current
    // thread: if it is not yet initialized, and if the argument is `Some(&mut Some(val))`, the
    // inner `val` should be `take`en out and used as the initial value instead of the default.
    // Also, in that case `inner` *must not* panic. However, it is okay (but potentially
    // inefficient) for `inner` to ignore `init` and use a default value as long as that is
    // guaranteed not to panic.
    inner: fn(/* init */ Option<&mut Option<T>>) -> *const T,
}

#[stable(feature = "std_debug", since = "1.16.0")]
impl<T: 'static> fmt::Debug for LocalKey<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("LocalKey").finish_non_exhaustive()
    }
}

#[doc(hidden)]
#[allow_internal_unstable(thread_local_internals)]
#[unstable(feature = "thread_local_internals", issue = "none")]
#[rustc_macro_transparency = "semiopaque"]
pub macro thread_local_process_attrs {

    // Parse `cfg_attr` to figure out whether it's a `rustc_align_static`.
    // Each `cfg_attr` can have zero or more attributes on the RHS, and can be nested.

    // finished parsing the `cfg_attr`, it had no `rustc_align_static`
    (
        [] [$(#[$($prev_other_attrs:tt)*])*];
        @processing_cfg_attr { pred: ($($predicate:tt)*), rhs: [] };
        [$($prev_align_attrs_ret:tt)*] [$($prev_other_attrs_ret:tt)*];
        $($rest:tt)*
    ) => (
        $crate::thread::local_impl::thread_local_process_attrs!(
            [$($prev_align_attrs_ret)*] [$($prev_other_attrs_ret)* #[cfg_attr($($predicate)*, $($($prev_other_attrs)*),*)]];
            $($rest)*
        );
    ),

    // finished parsing the `cfg_attr`, it had nothing but `rustc_align_static`
    (
        [$(#[$($prev_align_attrs:tt)*])+] [];
        @processing_cfg_attr { pred: ($($predicate:tt)*), rhs: [] };
        [$($prev_align_attrs_ret:tt)*] [$($prev_other_attrs_ret:tt)*];
        $($rest:tt)*
    ) => (
        $crate::thread::local_impl::thread_local_process_attrs!(
            [$($prev_align_attrs_ret)*  #[cfg_attr($($predicate)*, $($($prev_align_attrs)*),+)]] [$($prev_other_attrs_ret)*];
            $($rest)*
        );
    ),

    // finished parsing the `cfg_attr`, it had a mix of `rustc_align_static` and other attrs
    (
        [$(#[$($prev_align_attrs:tt)*])+] [$(#[$($prev_other_attrs:tt)*])+];
        @processing_cfg_attr { pred: ($($predicate:tt)*), rhs: [] };
        [$($prev_align_attrs_ret:tt)*] [$($prev_other_attrs_ret:tt)*];
        $($rest:tt)*
    ) => (
        $crate::thread::local_impl::thread_local_process_attrs!(
            [$($prev_align_attrs_ret)*  #[cfg_attr($($predicate)*, $($($prev_align_attrs)*),+)]] [$($prev_other_attrs_ret)* #[cfg_attr($($predicate)*, $($($prev_other_attrs)*),+)]];
            $($rest)*
        );
    ),

    // it's a `rustc_align_static`
    (
        [$($prev_align_attrs:tt)*] [$($prev_other_attrs:tt)*];
        @processing_cfg_attr { pred: ($($predicate:tt)*), rhs: [rustc_align_static($($align_static_args:tt)*) $(, $($attr_rhs:tt)*)?] };
        $($rest:tt)*
    ) => (
        $crate::thread::local_impl::thread_local_process_attrs!(
            [$($prev_align_attrs)* #[rustc_align_static($($align_static_args)*)]] [$($prev_other_attrs)*];
            @processing_cfg_attr { pred: ($($predicate)*), rhs: [$($($attr_rhs)*)?] };
            $($rest)*
        );
    ),

    // it's a nested `cfg_attr(..., ...)`; recurse into RHS
    (
        [$($prev_align_attrs:tt)*] [$($prev_other_attrs:tt)*];
        @processing_cfg_attr { pred: ($($predicate:tt)*), rhs: [cfg_attr($cfg_lhs:expr, $($cfg_rhs:tt)*) $(, $($attr_rhs:tt)*)?] };
        $($rest:tt)*
    ) => (
        $crate::thread::local_impl::thread_local_process_attrs!(
            [] [];
            @processing_cfg_attr { pred: ($cfg_lhs), rhs: [$($cfg_rhs)*] };
            [$($prev_align_attrs)*] [$($prev_other_attrs)*];
            @processing_cfg_attr { pred: ($($predicate)*), rhs: [$($($attr_rhs)*)?] };
            $($rest)*
        );
    ),

    // it's some other attribute
    (
        [$($prev_align_attrs:tt)*] [$($prev_other_attrs:tt)*];
        @processing_cfg_attr { pred: ($($predicate:tt)*), rhs: [$meta:meta $(, $($attr_rhs:tt)*)?] };
        $($rest:tt)*
    ) => (
        $crate::thread::local_impl::thread_local_process_attrs!(
            [$($prev_align_attrs)*] [$($prev_other_attrs)* #[$meta]];
            @processing_cfg_attr { pred: ($($predicate)*), rhs: [$($($attr_rhs)*)?] };
            $($rest)*
        );
    ),


    // Separate attributes into `rustc_align_static` and everything else:

    // `rustc_align_static` attribute
    ([$($prev_align_attrs:tt)*] [$($prev_other_attrs:tt)*]; #[rustc_align_static $($attr_rest:tt)*] $($rest:tt)*) => (
        $crate::thread::local_impl::thread_local_process_attrs!(
            [$($prev_align_attrs)* #[rustc_align_static $($attr_rest)*]] [$($prev_other_attrs)*];
            $($rest)*
        );
    ),

    // `cfg_attr(..., ...)` attribute; parse it
    ([$($prev_align_attrs:tt)*] [$($prev_other_attrs:tt)*]; #[cfg_attr($cfg_pred:expr, $($cfg_rhs:tt)*)] $($rest:tt)*) => (
        $crate::thread::local_impl::thread_local_process_attrs!(
            [] [];
            @processing_cfg_attr { pred: ($cfg_pred), rhs: [$($cfg_rhs)*] };
            [$($prev_align_attrs)*] [$($prev_other_attrs)*];
            $($rest)*
        );
    ),

    // doc comment not followed by any other attributes; process it all at once to avoid blowing recursion limit
    ([$($prev_align_attrs:tt)*] [$($prev_other_attrs:tt)*]; $(#[doc $($doc_rhs:tt)*])+ $vis:vis static $($rest:tt)*) => (
        $crate::thread::local_impl::thread_local_process_attrs!(
            [$($prev_align_attrs)*] [$($prev_other_attrs)* $(#[doc $($doc_rhs)*])+];
            $vis static $($rest)*
        );
    ),

    // 8 lines of doc comment; process them all at once to avoid blowing recursion limit
    ([$($prev_align_attrs:tt)*] [$($prev_other_attrs:tt)*];
     #[doc $($doc_rhs_1:tt)*] #[doc $($doc_rhs_2:tt)*] #[doc $($doc_rhs_3:tt)*] #[doc $($doc_rhs_4:tt)*]
     #[doc $($doc_rhs_5:tt)*] #[doc $($doc_rhs_6:tt)*] #[doc $($doc_rhs_7:tt)*] #[doc $($doc_rhs_8:tt)*]
     $($rest:tt)*) => (
        $crate::thread::local_impl::thread_local_process_attrs!(
            [$($prev_align_attrs)*] [$($prev_other_attrs)*
            #[doc $($doc_rhs_1)*] #[doc $($doc_rhs_2)*] #[doc $($doc_rhs_3)*] #[doc $($doc_rhs_4)*]
            #[doc $($doc_rhs_5)*] #[doc $($doc_rhs_6)*] #[doc $($doc_rhs_7)*] #[doc $($doc_rhs_8)*]];
            $($rest)*
        );
    ),

    // other attribute
    ([$($prev_align_attrs:tt)*] [$($prev_other_attrs:tt)*]; #[$($attr:tt)*] $($rest:tt)*) => (
        $crate::thread::local_impl::thread_local_process_attrs!(
            [$($prev_align_attrs)*] [$($prev_other_attrs)* #[$($attr)*]];
            $($rest)*
        );
    ),


    // Delegate to `thread_local_inner` once attributes are fully categorized:

    // process `const` declaration and recurse
    ([$($align_attrs:tt)*] [$($other_attrs:tt)*]; $vis:vis static $name:ident: $t:ty = const $init:block $(; $($($rest:tt)+)?)?) => (
        $($other_attrs)* $vis const $name: $crate::thread::LocalKey<$t> =
            $crate::thread::local_impl::thread_local_inner!(@key $t, $($align_attrs)*, const $init);

        $($($crate::thread::local_impl::thread_local_process_attrs!([] []; $($rest)+);)?)?
    ),

    // process non-`const` declaration and recurse
    ([$($align_attrs:tt)*] [$($other_attrs:tt)*]; $vis:vis static $name:ident: $t:ty = $init:expr $(; $($($rest:tt)+)?)?) => (
        $($other_attrs)* $vis const $name: $crate::thread::LocalKey<$t> =
            $crate::thread::local_impl::thread_local_inner!(@key $t, $($align_attrs)*, $init);

        $($($crate::thread::local_impl::thread_local_process_attrs!([] []; $($rest)+);)?)?
    ),
}

/// Declare a new thread local storage key of type [`std::thread::LocalKey`].
///
/// # Syntax
///
/// 这可以实现更高效的线程本地实现，
/// 并避免延迟初始化。对于不需要
///
/// ```
/// use std::cell::{Cell, RefCell};
///
/// thread_local! {
///     pub static FOO: Cell<u32> = const { Cell::new(1) };
///
///     static BAR: RefCell<Vec<f32>> = RefCell::new(vec![1.0, 2.0]);
/// }
///
/// assert_eq!(FOO.get(), 1);
/// BAR.with_borrow(|v| assert_eq!(v[1], 2.0));
/// ```
///
/// Note that only shared references (`&T`) to the inner data may be obtained, so a
/// type such as [`Cell`] or [`RefCell`] is typically used to allow mutating access.
///
/// This macro supports a special `const {}` syntax that can be used
/// when the initialization expression can be evaluated as a constant.
/// 获取该 TLS 键中值的引用。
/// 如果此线程尚未引用此键，则会延迟初始化该值。
/// # Panics
/// even more efficient implementation that does not need to
/// # 示例
///
/// ```
/// use std::cell::RefCell;
///
/// thread_local! {
///     pub static FOO: RefCell<Vec<u32>> = const { RefCell::new(Vec::new()) };
/// }
///
/// FOO.with_borrow(|v| assert_eq!(v.len(), 0));
/// ```
///
/// See [`LocalKey` documentation][`std::thread::LocalKey`] for more
/// information.
///
/// [`std::thread::LocalKey`]: crate::thread::LocalKey
#[macro_export]
#[stable(feature = "rust1", since = "1.0.0")]
#[cfg_attr(not(test), rustc_diagnostic_item = "thread_local_macro")]
#[allow_internal_unstable(thread_local_internals)]
#[rustc_diagnostic_opaque]
macro_rules! thread_local {
    () => {};

    ($($tt:tt)+) => {
        $crate::thread::local_impl::thread_local_process_attrs!([] []; $($tt)+);
    };
}

/// An error returned by [`LocalKey::try_with`](struct.LocalKey.html#method.try_with).
#[stable(feature = "thread_local_try_with", since = "1.26.0")]
#[non_exhaustive]
#[derive(Clone, Copy, Eq, PartialEq)]
pub struct AccessError;

#[stable(feature = "thread_local_try_with", since = "1.26.0")]
impl fmt::Debug for AccessError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("AccessError").finish()
    }
}

#[stable(feature = "thread_local_try_with", since = "1.26.0")]
impl fmt::Display for AccessError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        fmt::Display::fmt("already destroyed", f)
    }
}

#[stable(feature = "thread_local_try_with", since = "1.26.0")]
impl Error for AccessError {}

// This ensures the panicking code is outlined from `with` for `LocalKey`.
#[cfg_attr(not(panic = "immediate-abort"), inline(never))]
#[track_caller]
#[cold]
fn panic_access_error(err: AccessError) -> ! {
    panic!("cannot access a Thread Local Storage value during or after destruction: {err:?}")
}

impl<T: 'static> LocalKey<T> {
    #[doc(hidden)]
    #[unstable(
        feature = "thread_local_internals",
        reason = "recently added to create a key",
        issue = "none"
    )]
    pub const unsafe fn new(inner: fn(Option<&mut Option<T>>) -> *const T) -> LocalKey<T> {
        LocalKey { inner }
    }

    /// Acquires a reference to the value in this TLS key.
    ///
    /// This will lazily initialize the value if this thread has not referenced
    /// this key yet.
    ///
    /// # Panics
    ///
    /// This function will `panic!()` if the key currently has its
    /// destructor running, and it **may** panic if the destructor has
    /// previously been run for this thread.
    ///
    /// # Examples
    ///
    /// ```
    /// thread_local! {
    ///     pub static STATIC: String = String::from("I am");
    /// }
    ///
    /// assert_eq!(
    ///     STATIC.with(|original_value| format!("{original_value} initialized")),
    ///     "I am initialized",
    /// );
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn with<F, R>(&'static self, f: F) -> R
    where
        F: FnOnce(&T) -> R,
    {
        match self.try_with(f) {
            Ok(r) => r,
            Err(err) => panic_access_error(err),
        }
    }

    /// Acquires a reference to the value in this TLS key.
    ///
    /// 如果此线程尚未引用该键，则会延迟初始化该值。
    /// this key yet. If the key has been destroyed (which may happen if this is called
    /// in a destructor), this function may return an [`AccessError`].
    ///
    /// # 恐慌
    ///
    /// This function will still `panic!()` if the key is uninitialized and the
    /// 键的初始化器发生 panic。
    ///
    /// # 示例
    ///
    /// ```
    /// thread_local! {
    ///     pub static STATIC: String = String::from("I am");
    /// }
    ///
    /// assert_eq!(
    ///     STATIC.try_with(|original_value| format!("{original_value} initialized")),
    ///     Ok(String::from("I am initialized")),
    /// );
    /// ```
    #[stable(feature = "thread_local_try_with", since = "1.26.0")]
    #[inline]
    pub fn try_with<F, R>(&'static self, f: F) -> Result<R, AccessError>
    where
        F: FnOnce(&T) -> R,
    {
        let thread_local = unsafe { (self.inner)(None).as_ref().ok_or(AccessError)? };
        Ok(f(thread_local))
    }

    /// 获取对此 TLS 键中值的引用，并对其进行初始化。
    /// `init` if it wasn't already initialized on this thread.
    ///
    /// If `init` was used to initialize the thread local variable, `None` is
    /// passed as the first argument to `f`. If it was already initialized,
    /// `Some(init)` is passed to `f`.
    ///
    /// # 恐慌
    ///
    /// 如果键的析构函数正在运行，此函数会 panic；如果析构函数之前已为此线程运行过，它**也可能** panic。
    /// 设置或初始化所包含的值。
    /// 与其他方法不同，此方法不会执行线程局部变量的延迟初始化。相反，如果尚未初始化，则直接用给定值进行初始化。
    fn initialize_with<F, R>(&'static self, init: T, f: F) -> R
    where
        F: FnOnce(Option<T>, &T) -> R,
    {
        let mut init = Some(init);

        let reference = unsafe {
            match (self.inner)(Some(&mut init)).as_ref() {
                Some(r) => r,
                None => panic_access_error(AccessError),
            }
        };

        f(init, reference)
    }
}

impl<T: 'static> LocalKey<Cell<T>> {
    /// # 恐慌
    ///
    /// 如果键的析构函数正在运行，此函数会 panic；如果析构函数之前已为此线程运行过，它**也可能** panic。
    /// # 示例
    /// 返回所包含值的副本。
    ///
    /// # 恐慌
    ///
    /// 如果键的析构函数正在运行，此函数会 panic；如果析构函数之前已为此线程运行过，它**也可能** panic。
    /// # 示例
    ///
    /// # 示例
    ///
    /// ```
    /// use std::cell::Cell;
    ///
    /// thread_local! {
    ///     static X: Cell<i32> = panic!("!");
    /// }
    ///
    /// // Calling X.get() here would result in a panic.
    ///
    /// X.set(123); // But X.set() is fine, as it skips the initializer above.
    ///
    /// assert_eq!(X.get(), 123);
    /// ```
    #[stable(feature = "local_key_cell_methods", since = "1.73.0")]
    pub fn set(&'static self, value: T) {
        self.initialize_with(Cell::new(value), |value, cell| {
            if let Some(value) = value {
                // The cell was already initialized, so `value` wasn't used to
                // initialize it. So we overwrite the current value with the
                // new one instead.
                cell.set(value.into_inner());
            }
        });
    }

    /// 返回所包含值的副本。
    ///
    /// 如果此线程尚未引用该键，则会延迟初始化该值。
    /// # 恐慌
    ///
    /// # 恐慌
    ///
    /// 如果键的析构函数正在运行，此函数会 panic；如果析构函数之前已为此线程运行过，它**也可能** panic。
    /// # 示例
    ///
    /// # 示例
    ///
    /// ```
    /// use std::cell::Cell;
    ///
    /// thread_local! {
    ///     static X: Cell<i32> = const { Cell::new(1) };
    /// }
    ///
    /// assert_eq!(X.get(), 1);
    /// ```
    #[stable(feature = "local_key_cell_methods", since = "1.73.0")]
    pub fn get(&'static self) -> T
    where
        T: Copy,
    {
        self.with(Cell::get)
    }

    /// Takes the contained value, leaving `Default::default()` in its place.
    ///
    /// 如果此线程尚未引用该键，则会延迟初始化该值。
    /// # 恐慌
    ///
    /// # 恐慌
    ///
    /// 如果键的析构函数正在运行，此函数会 panic；如果析构函数之前已为此线程运行过，它**也可能** panic。
    /// # 示例
    ///
    /// # 示例
    ///
    /// ```
    /// use std::cell::Cell;
    ///
    /// thread_local! {
    ///     static X: Cell<Option<i32>> = const { Cell::new(Some(1)) };
    /// }
    ///
    /// assert_eq!(X.take(), Some(1));
    /// assert_eq!(X.take(), None);
    /// ```
    #[stable(feature = "local_key_cell_methods", since = "1.73.0")]
    pub fn take(&'static self) -> T
    where
        T: Default,
    {
        self.with(Cell::take)
    }

    /// 替换所包含的值，返回旧值。
    ///
    /// 如果此线程尚未引用该键，则会延迟初始化该值。
    /// # 恐慌
    ///
    /// # 恐慌
    ///
    /// 如果键的析构函数正在运行，此函数会 panic；如果析构函数之前已为此线程运行过，它**也可能** panic。
    /// # 示例
    ///
    /// # 示例
    ///
    /// ```
    /// use std::cell::Cell;
    ///
    /// thread_local! {
    ///     static X: Cell<i32> = const { Cell::new(1) };
    /// }
    ///
    /// assert_eq!(X.replace(2), 1);
    /// assert_eq!(X.replace(3), 2);
    /// ```
    #[stable(feature = "local_key_cell_methods", since = "1.73.0")]
    #[rustc_confusables("swap")]
    pub fn replace(&'static self, value: T) -> T {
        self.with(|cell| cell.replace(value))
    }

    /// 使用函数更新所包含的值。
    ///
    /// 如果此线程尚未引用该键，则会延迟初始化该值。
    /// # 恐慌
    ///
    /// # 恐慌
    ///
    /// 如果键的析构函数正在运行，此函数会 panic；如果析构函数之前已为此线程运行过，它**也可能** panic。
    /// # 示例
    ///
    /// # 示例
    ///
    /// ```
    /// use std::cell::Cell;
    ///
    /// thread_local! {
    ///     static X: Cell<i32> = const { Cell::new(5) };
    /// }
    ///
    /// X.update(|x| x + 1);
    /// assert_eq!(X.get(), 6);
    /// ```
    #[stable(feature = "local_key_cell_update", since = "1.99.0")]
    pub fn update(&'static self, f: impl FnOnce(T) -> T)
    where
        T: Copy,
    {
        self.with(|cell| cell.update(f))
    }
}

impl<T: 'static> LocalKey<RefCell<T>> {
    /// 获取对包含值的引用。
    ///
    /// 如果此线程尚未引用该值，则会延迟初始化该值。
    /// 此时尚未使用此键。
    ///
    /// # 恐慌
    ///
    /// 如果值当前可被修改地借用，则会发生恐慌。
    ///
    /// 如果键当前正在执行析构函数，则会发生恐慌。
    /// 如果此线程之前已经执行过析构函数，则**可能**发生恐慌。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::cell::RefCell;
    ///
    /// thread_local! {
    ///     static X: RefCell<Vec<i32>> = RefCell::new(Vec::new());
    /// }
    ///
    /// X.with_borrow(|v| assert!(v.is_empty()));
    /// ```
    #[stable(feature = "local_key_cell_methods", since = "1.73.0")]
    pub fn with_borrow<F, R>(&'static self, f: F) -> R
    where
        F: FnOnce(&T) -> R,
    {
        self.with(|cell| f(&cell.borrow()))
    }

    /// 获取对包含值的可修改引用。
    ///
    /// 如果此线程尚未引用该值，则会延迟初始化该值。
    /// 此时尚未使用此键。
    ///
    /// # 恐慌
    ///
    /// 如果值当前被借用，则会发生恐慌。
    ///
    /// 如果键当前正在执行析构函数，则会发生恐慌。
    /// 如果此线程之前已经执行过析构函数，则**可能**发生恐慌。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::cell::RefCell;
    ///
    /// thread_local! {
    ///     static X: RefCell<Vec<i32>> = RefCell::new(Vec::new());
    /// }
    ///
    /// X.with_borrow_mut(|v| v.push(1));
    ///
    /// X.with_borrow(|v| assert_eq!(*v, vec![1]));
    /// ```
    #[stable(feature = "local_key_cell_methods", since = "1.73.0")]
    pub fn with_borrow_mut<F, R>(&'static self, f: F) -> R
    where
        F: FnOnce(&mut T) -> R,
    {
        self.with(|cell| f(&mut cell.borrow_mut()))
    }

    /// 设置或初始化包含的值。
    ///
    /// 与其他方法不同，此操作不会运行线程局部区的延迟初始化过程。相反，如果尚未初始化，则直接用给定值进行初始化。
    /// 此时尚未使用此键。
    /// # 恐慌
    ///
    /// # 恐慌
    ///
    /// 如果值当前被借用，则会发生恐慌。
    ///
    /// 如果键当前正在执行析构函数，则会发生恐慌。
    /// 如果此线程之前已经执行过析构函数，则**可能**发生恐慌。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::cell::RefCell;
    ///
    /// thread_local! {
    ///     static X: RefCell<Vec<i32>> = panic!("!");
    /// }
    ///
    /// // Calling X.with() here would result in a panic.
    ///
    /// X.set(vec![1, 2, 3]); // But X.set() is fine, as it skips the initializer above.
    ///
    /// X.with_borrow(|v| assert_eq!(*v, vec![1, 2, 3]));
    /// ```
    #[stable(feature = "local_key_cell_methods", since = "1.73.0")]
    pub fn set(&'static self, value: T) {
        self.initialize_with(RefCell::new(value), |value, cell| {
            if let Some(value) = value {
                // The cell was already initialized, so `value` wasn't used to
                // initialize it. So we overwrite the current value with the
                // new one instead.
                *cell.borrow_mut() = value.into_inner();
            }
        });
    }

    /// Takes the contained value, leaving `Default::default()` in its place.
    ///
    /// 如果此线程尚未引用该值，则会延迟初始化该值。
    /// 此时尚未使用此键。
    ///
    /// # 恐慌
    ///
    /// 如果值当前被借用，则会发生恐慌。
    ///
    /// 如果键当前正在执行析构函数，则会发生恐慌。
    /// 如果此线程之前已经执行过析构函数，则**可能**发生恐慌。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::cell::RefCell;
    ///
    /// thread_local! {
    ///     static X: RefCell<Vec<i32>> = RefCell::new(Vec::new());
    /// }
    ///
    /// X.with_borrow_mut(|v| v.push(1));
    ///
    /// let a = X.take();
    ///
    /// assert_eq!(a, vec![1]);
    ///
    /// X.with_borrow(|v| assert!(v.is_empty()));
    /// ```
    #[stable(feature = "local_key_cell_methods", since = "1.73.0")]
    pub fn take(&'static self) -> T
    where
        T: Default,
    {
        self.with(RefCell::take)
    }

    /// 替换包含的值，并返回旧值。
    ///
    /// # 恐慌
    ///
    /// 如果值当前被借用，则会发生恐慌。
    ///
    /// 如果键当前正在执行析构函数，则会发生恐慌。
    /// 如果此线程之前已经执行过析构函数，则**可能**发生恐慌。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::cell::RefCell;
    ///
    /// thread_local! {
    ///     static X: RefCell<Vec<i32>> = RefCell::new(Vec::new());
    /// }
    ///
    /// let prev = X.replace(vec![1, 2, 3]);
    /// assert!(prev.is_empty());
    ///
    /// X.with_borrow(|v| assert_eq!(*v, vec![1, 2, 3]));
    /// ```
    #[stable(feature = "local_key_cell_methods", since = "1.73.0")]
    #[rustc_confusables("swap")]
    pub fn replace(&'static self, value: T) -> T {
        self.with(|cell| cell.replace(value))
    }
}
