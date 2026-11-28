#![doc = include_str!("../../stdarch/crates/core_arch/src/core_arch_docs.md")]

#[allow(
    // some targets don't have anything to reexport, which
    // makes the `pub use` unused and unreachable, allow
    // both lints as to not have `#[cfg]`s
    //
    // cf. https://github.com/rust-lang/rust/pull/116033#issuecomment-1760085575
    unused_imports,
    unreachable_pub
)]
#[stable(feature = "simd_arch", since = "1.27.0")]
pub use crate::core_arch::arch::*;

/// 内联汇编。
///
/// 请参阅 [Rust By Example] 获取使用指南，并参考 [参考文档] 以了解
/// 语法和可用选项的详细信息。
///
/// [Rust By Example]: https://doc.rust-lang.org/nightly/rust-by-example/unsafe/asm.html
/// [reference]: https://doc.rust-lang.org/nightly/reference/inline-assembly.html
#[stable(feature = "asm", since = "1.59.0")]
#[rustc_builtin_macro]
pub macro asm("assembly template", $(operands,)* $(options($(option),*))?) {
    /* compiler built-in */
}

/// Inline assembly used in combination with `#[naked]` functions.
///
/// 请参阅 [Rust By Example] 获取使用指南，并参考 [参考文档] 以了解
/// 语法和可用选项的详细信息。
///
/// [Rust By Example]: https://doc.rust-lang.org/nightly/rust-by-example/unsafe/asm.html
/// [reference]: https://doc.rust-lang.org/nightly/reference/inline-assembly.html
#[stable(feature = "naked_functions", since = "1.88.0")]
#[rustc_builtin_macro]
pub macro naked_asm("assembly template", $(operands,)* $(options($(option),*))?) {
    /* compiler built-in */
}

/// 模块级内联汇编。
///
/// 请参阅 [Rust By Example] 获取使用指南，并参考 [参考文档] 以了解
/// 语法和可用选项的详细信息。
///
/// [Rust By Example]: https://doc.rust-lang.org/nightly/rust-by-example/unsafe/asm.html
/// [reference]: https://doc.rust-lang.org/nightly/reference/inline-assembly.html
#[stable(feature = "global_asm", since = "1.59.0")]
#[rustc_builtin_macro]
pub macro global_asm("assembly template", $(operands,)* $(options($(option),*))?) {
    /* compiler built-in */
}

/// 如果可能，会编译成特定目标平台的软件断点指令，
/// 否则会回退到另一种陷阱或中止机制。
///
/// 这通常会中止程序运行。可能会导致核心转储，和/或系统日志中
/// 包含调试信息。根据特定目标平台，还可能具备其他功能。
/// 取决于调试器或其他工具；特别是调试器可能能够恢复执行。
///
/// 如果可能，这将生成一种指令序列，使调试器能够在断点*之后*
/// 恢复执行，而不是在断点*处*恢复；然而，具体行为取决于
/// 特定目标平台和调试器，无法保证。
///
/// 如果目标平台没有任何类型的调试断点指令，这可能会编译成
/// 陷阱指令（例如未定义指令）或其他形式的
/// 特定目标平台的中止机制，该机制可能支持也可能不支持便捷的恢复。
///
/// 具体行为无法保证，取决于架构和操作系统。
/// 并非所有架构都保证在没有调试器的情况下断点指令会中断执行，
/// 也不是所有操作系统和执行环境都保证此类中断会中止当前进程。在那些中断行为
/// interrupt aborts the current process. On operating systems where the behavior of the interrupt
/// 可以被应用程序覆盖的操作系统上（例如通过 SIGTRAP 信号处理器），应用程序
/// *应该*确保中止进程。然而，那些无法完全控制该应用程序状态的代码（例如信号处理器）
/// 不能总是依赖这种方式来确保程序的正确性。
/// 如果你确实依赖此机制，使得你的代码正确性要求应用程序不得从断点继续运行，
/// 请向用户说明这一点。
///
/// 以下目标平台仅保证具体的指令：
/// - On x86 targets, this produces an `int3` instruction.
/// - On aarch64 targets, this produces a `brk #0xf000` instruction.
// When adding more items above, also add cases to the test in `tests/assembly-llvm/intrinsics.rs`.
// When stabilizing this, update the comment on `core::intrinsics::breakpoint`.
// NOTE: there is an alternative in `process::resumable_breakpoint`. We may or may not
// actually want to stabilize both of them.
#[unstable(feature = "breakpoint", issue = "133724")]
#[inline(always)]
pub fn breakpoint() {
    core::intrinsics::breakpoint();
}

/// The `core::arch::return_address!()` macro returns a pointer with an address that corresponds to the caller of the function that invoked the `return_address!()` macro.
/// The pointer has no provenance, as if created by `core::ptr::without_provenance`. It cannot be used to read memory (other than ZSTs).
///
/// 宏返回的值很大程度上取决于架构和编译器（包括设置的选项）。
/// 特别是，它可能是错误的（尤其是涉及内联时），甚至可能包含无意义的值。
/// 这个宏的结果不应用于保证正确性或可靠性，仅用于调试目的。
///
/// 作为最佳尝试，如果无法确定有用的值（例如由于当前代码生成的限制），
/// 这个宏会尝试返回空指针而不是无意义的值（然而这不能保证正确性）。
///
/// 从形式上看，这个函数返回一个具有不确定地址且没有来源的指针。
///
/// This is equivalent to the gcc `__builtin_return_address(0)` intrinsic (other forms of the intrinsic are not supported).
/// 因为该操作总可以由编译器执行而不会出现崩溃或未定义行为，调用宏是一个安全操作。
///
/// ## 示例
/// ```
/// #![feature(return_address)]
///
/// # fn run_test() {
/// let addr = core::arch::return_address!();
/// println!("Caller is {addr:p}");
/// # }
/// # #[cfg(not(miri))] // FIXME: Figure out how to make miri work before stabilizing this macro
/// # run_test()
/// ```
#[unstable(feature = "return_address", issue = "154966")]
#[allow_internal_unstable(core_intrinsics)]
pub macro return_address() {{ core::intrinsics::return_address() }}
