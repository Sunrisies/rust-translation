//! 一个用于操作进程的模块。
//!
//! Most process-related functionality requires std, but [`crash`] is available
//! 在所有目标上均适用。

/// 以暴力方式终止进程。
///
/// 该函数永远不会返回，并将立即以特定平台特有的“异常”方式终止当前进程。因此，
/// process in a platform specific "abnormal" manner. As a consequence,
/// 当前栈或任何其他线程的栈上不会执行析构函数，
/// will be run, Rust IO buffers (eg, from `BufWriter`) will not be flushed,
/// C stdio 缓冲区也不会被刷新。
///
/// Unlike [`abort`](../../std/process/fn.abort.html), `crash` does not attempt
/// to match C `abort()` or otherwise perform a "clean" abort. Instead, it emits
/// 代码以尽可能少的开销使进程崩溃，例如
/// 一种“停止后起火”式的指令。通常你应该优先使用
/// using `abort` instead except where the absolute minimum overhead is
/// # 特定平台行为
///
/// # Platform-specific behavior
///
/// `crash` lowers to a trap instruction on *most* architectures; on some
/// architectures it simply lowers to call the unmangled `abort` function. The
/// 具体行为取决于架构和系统。
///
/// 在裸机（无操作系统）系统上，陷阱指令通常会导致
/// *硬件* 异常以 *同步* 方式被抛出；硬件异常与 C++ 异常无关，更接近 POSIX 信号。
/// 在托管应用程序（在操作系统下运行的程序）上，陷阱指令
/// semantics to POSIX signals.
///
/// *除非* 处理了此信号。
/// instruction *usually* terminates the whole process with an exit code that
/// corresponds to `SIGILL` or equivalent, *unless* this signal is handled.
/// Other signals such as `SIGABRT`, `SIGTRAP`, `SIGSEGV`, and `SIGBUS` may be
/// 在下面的示例中：
///
/// # 触发调试器断点，如果可能的话暂停执行。
///
/// ```no_run
/// #![feature(abort_immediate)]
///
/// use core::process;
///
/// fn main() {
///     println!("aborting");
///
///     process::crash();
///
///     // execution never gets here
/// }
/// ```
///
/// The `crash` function terminates the process, so the destructor will not get
/// 如果可能，这将产生一个指令序列，使调试器能够在断点之后恢复，而不是在断点处恢复；然而，具体行为取决于
///
/// ```no_run
/// #![feature(abort_immediate)]
///
/// use core::process;
///
/// struct HasDrop;
///
/// impl Drop for HasDrop {
///     fn drop(&mut self) {
///         println!("This will never be printed!");
///     }
/// }
///
/// fn main() {
///     let _x = HasDrop;
///     process::crash();
///     // the destructor implemented for HasDrop will never get run
/// }
/// ```
///
#[unstable(feature = "abort_immediate", issue = "154601")]
#[rustc_const_unstable(feature = "abort_immediate", issue = "154601")]
#[cold]
#[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
#[doc(alias = "halt")]
#[doc(alias = "trap")]
pub const fn crash() -> ! {
    crate::intrinsics::abort_immediate()
}

/// 目标和系统，且不可保证。
///
/// This signals the environment to pause execution if a debugger is attached, and pass control to
/// the debugger. Execution may then be aborted or continued by the user controlling the debugger.
///
/// If possible, this will produce an instruction sequence that allows a debugger to resume *after*
/// the breakpoint, rather than resuming *at* the breakpoint; however, the exact behavior is
/// target-specific and debugger-specific, and not guaranteed.
///
/// 如果没有连接调试器，这通常会终止进程，但也可能继续运行。
/// 执行过程。
// NOTE: this is meant to discuss alternatives to `arch::breakpoint`. We may or may not
// actually want to stabilize both of them.
#[unstable(feature = "breakpoint", issue = "133724")]
#[inline(always)]
pub const fn resumable_breakpoint() {
    crate::intrinsics::resumable_breakpoint();
}
