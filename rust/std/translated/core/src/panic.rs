//! 核心中的 panic 支持。

#![stable(feature = "core_panic_info", since = "1.41.0")]

mod location;
mod panic_info;
mod unwind_safe;

#[stable(feature = "panic_hooks", since = "1.10.0")]
pub use self::location::Location;
#[stable(feature = "panic_hooks", since = "1.10.0")]
pub use self::panic_info::PanicInfo;
#[stable(feature = "panic_info_message", since = "1.81.0")]
pub use self::panic_info::PanicMessage;
#[stable(feature = "catch_unwind", since = "1.9.0")]
pub use self::unwind_safe::{AssertUnwindSafe, RefUnwindSafe, UnwindSafe};

#[doc(hidden)]
#[unstable(feature = "edition_panic", issue = "none", reason = "use panic!() instead")]
#[allow_internal_unstable(panic_internals, const_format_args)]
#[rustc_diagnostic_item = "core_panic_2015_macro"]
#[rustc_macro_transparency = "semiopaque"]
pub macro panic_2015 {
    () => (
        $crate::panicking::panic_default_msg()
    ),
    ($msg:literal $(,)?) => (
        $crate::panicking::panic($msg)
    ),
    // Use `panic_str_2015` instead of `panic_display::<&str>` for non_fmt_panic lint.
    ($msg:expr $(,)?) => ({
        $crate::panicking::panic_str_2015($msg);
    }),
    // Special-case the single-argument case for const_panic.
    ("{}", $arg:expr $(,)?) => ({
        $crate::panicking::panic_display(&$arg);
    }),
    ($fmt:expr, $($arg:tt)+) => ({
        // Semicolon to prevent temporaries inside the formatting machinery from
        // being considered alive in the caller after the panic_fmt call.
        $crate::panicking::panic_fmt($crate::const_format_args!($fmt, $($arg)+));
    }),
}

#[doc(hidden)]
#[unstable(feature = "edition_panic", issue = "none", reason = "use panic!() instead")]
#[allow_internal_unstable(panic_internals, const_format_args)]
#[rustc_diagnostic_item = "core_panic_2021_macro"]
#[rustc_macro_transparency = "semiopaque"]
pub macro panic_2021 {
    () => (
        $crate::panicking::panic_default_msg()
    ),
    // Special-case the single-argument case for const_panic.
    ("{}", $arg:expr $(,)?) => ({
        $crate::panicking::panic_display(&$arg);
    }),
    ($($t:tt)+) => ({
        // Semicolon to prevent temporaries inside the formatting machinery from
        // being considered alive in the caller after the panic_fmt call.
        $crate::panicking::panic_fmt($crate::const_format_args!($($t)+));
    }),
}

#[doc(hidden)]
#[unstable(feature = "edition_panic", issue = "none", reason = "use unreachable!() instead")]
#[allow_internal_unstable(panic_internals)]
#[rustc_diagnostic_item = "unreachable_2015_macro"]
#[rustc_macro_transparency = "semiopaque"]
pub macro unreachable_2015 {
    () => (
        $crate::panicking::unreachable_default_msg()
    ),
    // Use of `unreachable_display` for non_fmt_panic lint.
    // NOTE: the message ("internal error ...") is embedded directly in unreachable_display
    ($msg:expr $(,)?) => ({
        $crate::panicking::unreachable_display(&$msg);
    }),
    ($fmt:expr, $($arg:tt)*) => (
        $crate::panic!($crate::concat!("internal error: entered unreachable code: ", $fmt), $($arg)*)
    ),
}

#[doc(hidden)]
#[unstable(feature = "edition_panic", issue = "none", reason = "use unreachable!() instead")]
#[allow_internal_unstable(panic_internals)]
#[rustc_macro_transparency = "semiopaque"]
pub macro unreachable_2021 {
    () => (
        $crate::panicking::unreachable_default_msg()
    ),
    ($($t:tt)+) => (
        $crate::panic!("internal error: entered unreachable code: {}", $crate::format_args!($($t)+))
    ),
}

/// 调用一个闭包，若闭包被展开则终止执行。
///
/// 当使用终止 panic 方式编译时，此函数实际上没有实际作用。
/// 在展开 panic 的情况下，导致闭包结果丢失的展开会触发对
/// panic 处理程序 / panic 钩子，随后进程终止。（闭包中的局部变量会被
/// 正常丢弃。）被包含在闭包内的展开仍然按正常方式行为。
///
/// # 备注
///
/// 不应使用此函数，而应通过代码尝试支持展开机制。
/// Implementing [`Drop`] allows you to restore invariants uniformly in both
/// 返回和展开路径中统一恢复不变性。
///
/// 如果展开可能导致逻辑问题但不会导致正确性问题，你
/// should allow the unwind. Opting out of [`UnwindSafe`] indicates to your
/// 使用者表明他们需要在展开情况下考虑正确性。
///
/// If an unwind would be unsound, then this function should be used in order
/// to prevent unwinds. However, note that `extern "C" fn` will automatically
/// convert unwinds to aborts, so using this function isn't necessary for FFI.
#[unstable(feature = "abort_unwind", issue = "130338")]
#[rustc_nounwind] // this attribute does all the actual work here
pub fn abort_on_unwind<F: FnOnce() -> R, R>(f: F) -> R {
    f()
}

/// Helper macro for panicking in a `const fn`.
/// 其中第一条消息将在常量评估时打印，
/// ```rust,ignore (just an example)
/// core::macros::const_panic!("boring message", "flavored message {a} {b:?}", a: u32 = foo.len(), b: Something = bar);
/// ```
/// 第二条消息将在运行时打印。
/// and the second message will be printed at runtime.
// All uses of this macro are FIXME(const-hack).
#[unstable(feature = "panic_internals", issue = "none")]
#[doc(hidden)]
pub macro const_panic {
    ($const_msg:literal, $runtime_msg:literal, $($arg:ident : $ty:ty = $val:expr),* $(,)?) => {{
        // Wrap call to `const_eval_select` in a function so that we can
        // add the `rustc_allow_const_fn_unstable`. This is okay to do
        // because both variants will panic, just with different messages.
        #[rustc_allow_const_fn_unstable(const_eval_select)]
        #[inline(always)] // inline the wrapper
        #[track_caller]
        const fn do_panic($($arg: $ty),*) -> ! {
            $crate::intrinsics::const_eval_select!(
                @capture { $($arg: $ty = $arg),* } -> !:
                if const #[track_caller] {
                    $crate::panic!($const_msg)
                } else #[track_caller] {
                    $crate::panic!($runtime_msg)
                }
            )
        }

        do_panic($($val),*)
    }},
    // We support leaving away the `val` expressions for *all* arguments
    // (but not for *some* arguments, that's too tricky).
    ($const_msg:literal, $runtime_msg:literal, $($arg:ident : $ty:ty),* $(,)?) => {
        $crate::panic::const_panic!(
            $const_msg,
            $runtime_msg,
            $($arg: $ty = $arg),*
        )
    },
}

/// A version of `assert` that prints a non-formatting message in const contexts.
///
/// See [`const_panic!`].
#[unstable(feature = "panic_internals", issue = "none")]
#[doc(hidden)]
pub macro const_assert {
    ($condition: expr, $const_msg:literal, $runtime_msg:literal, $($arg:tt)*) => {{
        if !($condition) {
            $crate::panic::const_panic!($const_msg, $runtime_msg, $($arg)*)
        }
    }}
}
