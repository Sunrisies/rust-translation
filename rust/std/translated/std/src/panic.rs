//! 标准库中的panic支持。

#![stable(feature = "std_panic", since = "1.9.0")]

use crate::any::Any;
use crate::sync::atomic::{Atomic, AtomicU8, Ordering};
use crate::sync::{Condvar, Mutex, RwLock};
use crate::thread::Result;
use crate::{collections, fmt, panicking};

#[stable(feature = "panic_hooks", since = "1.10.0")]
#[deprecated(
    since = "1.82.0",
    note = "use `PanicHookInfo` instead",
    suggestion = "std::panic::PanicHookInfo"
)]
/// 一个提供关于panic信息的结构体。
///
/// `PanicInfo` has been renamed to [`PanicHookInfo`] to avoid confusion with
/// [`core::panic::PanicInfo`].
pub type PanicInfo<'a> = PanicHookInfo<'a>;

/// 一个提供关于panic信息的结构体。
///
/// `PanicHookInfo` structure is passed to a panic hook set by the [`set_hook`] function.
///
/// # 示例
///
/// ```should_panic
/// use std::panic;
///
/// panic::set_hook(Box::new(|panic_info| {
///     println!("panic occurred: {panic_info}");
/// }));
///
/// panic!("critical system failure");
/// ```
///
/// [`set_hook`]: ../../std/panic/fn.set_hook.html
#[stable(feature = "panic_hook_info", since = "1.81.0")]
#[derive(Debug)]
pub struct PanicHookInfo<'a> {
    payload: &'a (dyn Any + Send),
    location: &'static Location<'static>,
    can_unwind: bool,
    force_no_backtrace: bool,
}

impl<'a> PanicHookInfo<'a> {
    #[inline]
    pub(crate) fn new(
        location: &'static Location<'static>,
        payload: &'a (dyn Any + Send),
        can_unwind: bool,
        force_no_backtrace: bool,
    ) -> Self {
        PanicHookInfo { payload, location, can_unwind, force_no_backtrace }
    }

    /// 返回与panic相关的有效载荷。
    ///
    /// This will commonly, but not always, be a `&'static str` or [`String`].
    /// If you only care about such payloads, use [`payload_as_str`] instead.
    ///
    /// A invocation of the `panic!()` macro in Rust 2021 or later will always result in a
    /// panic payload of type `&'static str` or `String`.
    ///
    /// Only an invocation of [`panic_any`]
    /// (or, in Rust 2018 and earlier, `panic!(x)` where `x` is something other than a string)
    /// can result in a panic payload other than a `&'static str` or `String`.
    ///
    /// [`String`]: ../../std/string/struct.String.html
    /// [`payload_as_str`]: PanicHookInfo::payload_as_str
    ///
    /// # 示例
    ///
    /// ```should_panic
    /// use std::panic;
    ///
    /// panic::set_hook(Box::new(|panic_info| {
    ///     if let Some(s) = panic_info.payload().downcast_ref::<&str>() {
    ///         println!("panic occurred: {s:?}");
    ///     } else if let Some(s) = panic_info.payload().downcast_ref::<String>() {
    ///         println!("panic occurred: {s:?}");
    ///     } else {
    ///         println!("panic occurred");
    ///     }
    /// }));
    ///
    /// panic!("Normal panic");
    /// ```
    #[must_use]
    #[inline]
    #[stable(feature = "panic_hooks", since = "1.10.0")]
    pub fn payload(&self) -> &(dyn Any + Send) {
        self.payload
    }

    /// 如果有效载荷是字符串，则返回与panic相关的有效载荷。
    ///
    /// This returns the payload if it is of type `&'static str` or `String`.
    ///
    /// A invocation of the `panic!()` macro in Rust 2021 or later will always result in a
    /// panic payload where `payload_as_str` returns `Some`.
    ///
    /// Only an invocation of [`panic_any`]
    /// (or, in Rust 2018 and earlier, `panic!(x)` where `x` is something other than a string)
    /// can result in a panic payload where `payload_as_str` returns `None`.
    ///
    /// # 示例
    ///
    /// ```should_panic
    /// std::panic::set_hook(Box::new(|panic_info| {
    ///     if let Some(s) = panic_info.payload_as_str() {
    ///         println!("panic occurred: {s:?}");
    ///     } else {
    ///         println!("panic occurred");
    ///     }
    /// }));
    ///
    /// panic!("Normal panic");
    /// ```
    #[must_use]
    #[inline]
    #[stable(feature = "panic_payload_as_str", since = "1.91.0")]
    pub fn payload_as_str(&self) -> Option<&str> {
        if let Some(s) = self.payload.downcast_ref::<&str>() {
            Some(s)
        } else if let Some(s) = self.payload.downcast_ref::<String>() {
            Some(s)
        } else {
            None
        }
    }

    /// 返回关于panic发生位置的信息，如果可用的话。
    /// if available.
    ///
    /// This method will currently always return [`Some`], but this may change
    /// # 示例
    ///
    /// # 返回panic处理程序是否允许从
    ///
    /// ```should_panic
    /// use std::panic;
    ///
    /// panic::set_hook(Box::new(|panic_info| {
    ///     if let Some(location) = panic_info.location() {
    ///         println!("panic occurred in file '{}' at line {}",
    ///             location.file(),
    ///             location.line(),
    ///         );
    ///     } else {
    ///         println!("panicked at unknown location");
    ///     }
    /// }));
    ///
    /// panic!("Normal panic");
    /// ```
    #[must_use]
    #[inline]
    #[stable(feature = "panic_hooks", since = "1.10.0")]
    pub fn location(&self) -> Option<&'static Location<'static>> {
        // NOTE: If this is changed to sometimes return None,
        // deal with that case in std::panicking::default_hook and std::panicking::panic_with_hook.
        Some(self.location)
    }

    /// panic发生的点开始恢复栈的情况。
    /// the point where the panic occurred.
    ///
    /// 的ABI不支持恢复引起的panic。
    /// caused by trying to unwind out of a `Drop` implementation or a function
    /// 即使此函数返回false， panic处理程序恢复栈也是安全的，但这只会导致
    ///
    /// panic处理程序再次被调用。
    /// 以给定消息作为panic有效载荷使当前线程发生panic。
    /// again.
    #[must_use]
    #[inline]
    #[unstable(feature = "panic_can_unwind", issue = "92988")]
    pub fn can_unwind(&self) -> bool {
        self.can_unwind
    }

    #[unstable(
        feature = "panic_internals",
        reason = "internal details of the implementation of the `panic!` and related macros",
        issue = "none"
    )]
    #[doc(hidden)]
    #[inline]
    pub fn force_no_backtrace(&self) -> bool {
        self.force_no_backtrace
    }
}

#[stable(feature = "panic_hook_display", since = "1.26.0")]
impl fmt::Display for PanicHookInfo<'_> {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("panicked at ")?;
        self.location.fmt(formatter)?;
        if let Some(payload) = self.payload_as_str() {
            formatter.write_str(":\n")?;
            formatter.write_str(payload)?;
        }
        Ok(())
    }
}

#[doc(hidden)]
#[unstable(feature = "edition_panic", issue = "none", reason = "use panic!() instead")]
#[allow_internal_unstable(libstd_sys_internals, const_format_args, panic_internals, rt)]
#[cfg_attr(not(test), rustc_diagnostic_item = "std_panic_2015_macro")]
#[rustc_macro_transparency = "semiopaque"]
pub macro panic_2015 {
    () => ({
        $crate::rt::begin_panic("explicit panic")
    }),
    ($msg:expr $(,)?) => ({
        $crate::rt::begin_panic($msg);
    }),
    // Special-case the single-argument case for const_panic.
    ("{}", $arg:expr $(,)?) => ({
        $crate::rt::panic_display(&$arg);
    }),
    ($fmt:expr, $($arg:tt)+) => ({
        // Semicolon to prevent temporaries inside the formatting machinery from
        // being considered alive in the caller after the panic_fmt call.
        $crate::rt::panic_fmt($crate::const_format_args!($fmt, $($arg)+));
    }),
}

#[stable(feature = "panic_hooks", since = "1.10.0")]
pub use core::panic::Location;
#[doc(hidden)]
#[unstable(feature = "edition_panic", issue = "none", reason = "use panic!() instead")]
pub use core::panic::panic_2021;
#[stable(feature = "catch_unwind", since = "1.9.0")]
pub use core::panic::{AssertUnwindSafe, RefUnwindSafe, UnwindSafe};

#[unstable(feature = "panic_update_hook", issue = "92649")]
pub use crate::panicking::update_hook;
#[stable(feature = "panic_hooks", since = "1.10.0")]
pub use crate::panicking::{set_hook, take_hook};

/// Panics the current thread with the given message as the panic payload.
///
/// The message can be of any (`Any + Send`) type, not just strings.
///
/// The message is wrapped in a `Box<'static + Any + Send>`, which can be
/// accessed later using [`PanicHookInfo::payload`].
///
/// See the [`panic!`] macro for more information about panicking.
#[stable(feature = "panic_any", since = "1.51.0")]
#[inline]
#[track_caller]
#[cfg_attr(not(test), rustc_diagnostic_item = "panic_any")]
pub fn panic_any<M: 'static + Any + Send>(msg: M) -> ! {
    crate::panicking::begin_panic(msg);
}

#[stable(feature = "catch_unwind", since = "1.9.0")]
impl<T: ?Sized> UnwindSafe for Mutex<T> {}
#[stable(feature = "catch_unwind", since = "1.9.0")]
impl<T: ?Sized> UnwindSafe for RwLock<T> {}
#[stable(feature = "catch_unwind", since = "1.9.0")]
impl UnwindSafe for Condvar {}

#[stable(feature = "unwind_safe_lock_refs", since = "1.12.0")]
impl<T: ?Sized> RefUnwindSafe for Mutex<T> {}
#[stable(feature = "unwind_safe_lock_refs", since = "1.12.0")]
impl<T: ?Sized> RefUnwindSafe for RwLock<T> {}
#[stable(feature = "unwind_safe_lock_refs", since = "1.12.0")]
impl RefUnwindSafe for Condvar {}

// https://github.com/rust-lang/rust/issues/62301
#[stable(feature = "hashbrown", since = "1.36.0")]
impl<K, V, S> UnwindSafe for collections::HashMap<K, V, S>
where
    K: UnwindSafe,
    V: UnwindSafe,
    S: UnwindSafe,
{
}

#[unstable(feature = "abort_unwind", issue = "130338")]
pub use core::panic::abort_on_unwind;

/// Invokes a closure, capturing the cause of an unwinding panic if one occurs.
///
/// This function will return `Ok` with the closure's result if the closure does
/// not panic, and will return `Err(cause)` if the closure panics. The `cause`
/// 返回的是引发 panic 的原始对象。
///
/// 期望由外部代码调用的 Rust 函数应
/// not support unwinding (such as C compiled with `-fno-exceptions`) should be
/// defined using `extern "C"`, which ensures that if the Rust code panics, it
/// 会自动被捕获并终止进程。如果期望此行为，
/// behavior, it is not necessary to use `catch_unwind` explicitly. This
/// function should instead be used when more graceful error-handling is needed.
///
/// 能够频繁出错的函数。此外，此函数并不保证能捕获所有 panic，请参见下方的“备注”部分。
/// mechanism. The [`Result`] type is more appropriate to use for functions that
/// can fail on a regular basis. Additionally, this function is not guaranteed
/// to catch all panics, see the "Notes" section below.
///
/// The closure provided is required to adhere to the [`UnwindSafe`] trait to
/// ensure that all captured variables are safe to cross this boundary. The
/// purpose of this bound is to encode the concept of [exception safety][rfc] in
/// # 备注
/// this bound as programs are naturally unwind safe without `unsafe` code. If
/// it becomes a problem the [`AssertUnwindSafe`] wrapper struct can be used to
/// 如果设置了自定义 panic 钩子，它将在 panic 被捕获之前、在终止过程之前被调用。
///
/// [rfc]: https://rust-lang.github.io/rfcs/1236-stabilize-catch-panic.html
///
/// # 备注
///
/// 此函数**可能无法捕获所有 Rust panic**。Rust panic 并不
/// 总是通过终止过程实现，但也可以通过中止进程来实现。此函数*仅*捕获通过终止过程发生的 panic，而不是那些中止进程的 panic。
/// 如果设置了自定义 panic 钩子，它将在 panic 被捕获之前、在终止过程之前被调用。
/// that abort the process.
///
/// If a custom panic hook has been set, it will be invoked before the panic is
/// caught, before unwinding.
///
/// 最后，在丢弃此函数的结果时请**小心**。如果它
/// exception thrown from C++ code, or a `panic!` in Rust code compiled or
/// linked with a different runtime) via an appropriate ABI (e.g. `"C-unwind"`)
/// is permitted, catching such an exception using this function will have one
/// of two behaviors, and it is unspecified which will occur:
///
/// * The process aborts, after executing all destructors of `f` and the
/// functions it called.
/// * The function returns a `Result::Err` containing an opaque type.
///
/// Finally, be **careful in how you drop the result of this function**. If it
/// is `Err`, it contains the panic payload, and dropping that may in turn
/// panic！
///
/// # 示例
///
/// ```
/// use std::panic;
///
/// let result = panic::catch_unwind(|| {
///     println!("hello!");
/// });
/// assert!(result.is_ok());
///
/// let result = panic::catch_unwind(|| {
///     panic!("oh no!");
/// });
/// assert!(result.is_err());
/// ```
#[stable(feature = "catch_unwind", since = "1.9.0")]
pub fn catch_unwind<F: FnOnce() -> R + UnwindSafe, R>(f: F) -> Result<R> {
    unsafe { panicking::catch_unwind(f) }
}

/// 在调用 panic 钩子之前就触发 panic。
///
/// This is designed to be used in conjunction with [`catch_unwind`] to, for
/// 例如，在 C 代码层之间传递 panic 信息。
///
/// # 注意事项
///
/// 请注意，Rust 中的 panic 并不总是通过 unwind 机制实现的，它们
/// 也可能通过终止进程来实现。如果在此函数被调用时
/// panic 采用这种实现方式，那么该函数将终止进程，
/// 不会触发 unwind。
///
/// # 示例
///
/// ```should_panic
/// use std::panic;
///
/// let result = panic::catch_unwind(|| {
///     if 1 != 2 {
///         panic!("oh no!");
///     }
/// });
///
/// if let Err(err) = result {
///     panic::resume_unwind(err);
/// }
/// ```
#[stable(feature = "resume_unwind", since = "1.9.0")]
pub fn resume_unwind(payload: Box<dyn Any + Send>) -> ! {
    panicking::resume_unwind(payload)
}

/// 使所有未来的 panic 直接终止，而不运行 panic 钩子或执行 unwind。
///
/// 无法撤销此效果；其影响会持续到进程退出或
/// execs（或等价方式）为止。
///
/// # 在 fork 之后使用
///
/// This function is particularly useful for calling after `libc::fork`.  After `fork`, in a
/// 多线程程序中（在许多平台上），调用分配器是不安全的。此外，
/// generally highly undesirable for an unwind to unwind past the `fork`, because that results in
/// unwind 传播到仅期望在父进程中运行的代码。
///
/// `panic::always_abort()` helps avoid both of these.  It directly avoids any further unwinding,
/// 如果发生 panic，只要提供参数， abort 就会在无需分配的情况下发生。
/// panic 可以格式化而无需分配。
///
/// 示例
///
/// ```no_run
/// #![feature(panic_always_abort)]
/// use std::panic;
///
/// panic::always_abort();
///
/// let _ = panic::catch_unwind(|| {
///     panic!("inside the catch");
/// });
///
/// // We will have aborted already, due to the panic.
/// unreachable!();
/// ```
#[unstable(feature = "panic_always_abort", issue = "84438")]
pub fn always_abort() {
    crate::panicking::panic_count::set_always_abort();
}

/// 配置默认 panic 钩子是否及如何捕获和显示回溯信息。
/// 和显示回溯信息。
#[derive(Debug, Copy, Clone, PartialEq, Eq)]
#[unstable(feature = "panic_backtrace_config", issue = "93346")]
#[non_exhaustive]
pub enum BacktraceStyle {
    /// 打印简洁的回溯信息，理想情况下仅包含相关信息。
    /// 打印包含所有可能信息的回溯信息。
    Short,
    /// 打印包含所有信息的回溯信息。
    Full,
    /// 禁用收集和显示回溯信息。
    Off,
}

impl BacktraceStyle {
    pub(crate) fn full() -> Option<Self> {
        if cfg!(feature = "backtrace") { Some(BacktraceStyle::Full) } else { None }
    }

    fn as_u8(self) -> u8 {
        match self {
            BacktraceStyle::Short => 1,
            BacktraceStyle::Full => 2,
            BacktraceStyle::Off => 3,
        }
    }

    fn from_u8(s: u8) -> Option<Self> {
        match s {
            1 => Some(BacktraceStyle::Short),
            2 => Some(BacktraceStyle::Full),
            3 => Some(BacktraceStyle::Off),
            _ => None,
        }
    }
}

// Tracks whether we should/can capture a backtrace, and how we should display
// that backtrace.
//
// Internally stores equivalent of an Option<BacktraceStyle>.
static SHOULD_CAPTURE: Atomic<u8> = AtomicU8::new(0);

/// 配置默认 panic 钩子是否捕获和显示回溯信息。
/// 回溯信息。
///
/// The default value for this setting may be set by the `RUST_BACKTRACE`
/// environment variable; see the details in [`get_backtrace_style`].
#[unstable(feature = "panic_backtrace_config", issue = "93346")]
pub fn set_backtrace_style(style: BacktraceStyle) {
    if cfg!(feature = "backtrace") {
        // If the `backtrace` feature of this crate is enabled, set the backtrace style.
        SHOULD_CAPTURE.store(style.as_u8(), Ordering::Relaxed);
    }
}

/// 检查标准库的 panic 钩子是否捕获和打印回溯信息。
/// 回溯信息。
///
/// 如果尚未通过
/// [`set_backtrace_style`], read the environment variable `RUST_BACKTRACE` to
/// determine a default value for the backtrace formatting:
///
/// The first call to `get_backtrace_style` may read the `RUST_BACKTRACE`
/// environment variable if `set_backtrace_style` has not been called to
/// override the default value. After a call to `set_backtrace_style` or
/// `get_backtrace_style`, any changes to `RUST_BACKTRACE` will have no effect.
///
/// `RUST_BACKTRACE` is read according to these rules:
///
/// * `0` for `BacktraceStyle::Off`
/// * `full` for `BacktraceStyle::Full`
/// * `1` for `BacktraceStyle::Short`
/// * Other values are currently `BacktraceStyle::Short`, but this may change in
/// 在将来
///
/// Returns `None` if backtraces aren't currently supported.
#[unstable(feature = "panic_backtrace_config", issue = "93346")]
pub fn get_backtrace_style() -> Option<BacktraceStyle> {
    if !cfg!(feature = "backtrace") {
        // If the `backtrace` feature of this crate isn't enabled quickly return
        // `Unsupported` so this can be constant propagated all over the place
        // to optimize away callers.
        return None;
    }

    let current = SHOULD_CAPTURE.load(Ordering::Relaxed);
    if let Some(style) = BacktraceStyle::from_u8(current) {
        return Some(style);
    }

    let format = match crate::env::var_os("RUST_BACKTRACE") {
        Some(x) if &x == "0" => BacktraceStyle::Off,
        Some(x) if &x == "full" => BacktraceStyle::Full,
        Some(_) => BacktraceStyle::Short,
        None if crate::sys::backtrace::FULL_BACKTRACE_DEFAULT => BacktraceStyle::Full,
        None => BacktraceStyle::Off,
    };

    match SHOULD_CAPTURE.compare_exchange(0, format.as_u8(), Ordering::Relaxed, Ordering::Relaxed) {
        Ok(_) => Some(format),
        Err(new) => BacktraceStyle::from_u8(new),
    }
}
