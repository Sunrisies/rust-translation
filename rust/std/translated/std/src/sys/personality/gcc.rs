//! 由 libgcc/libunwind 支持的 panic 实现（以某种形式存在）。
//!
//! 关于异常处理和栈展开的背景信息，请参阅
//! “LLVM 中的异常处理” (llvm.org/docs/ExceptionHandling.html) 以及
//! 从中链接的文档。
//! 这些也是很好的阅读资料：
//!  * <https://itanium-cxx-abi.github.io/cxx-abi/abi-eh.html>
//!  * <https://nicolasbrailo.github.io/blog/projects_texts/13exceptionsunderthehood.html>
//!  * <https://www.airs.com/blog/index.php?s=exception+frames>
//!
//! ## 简要总结
//!
//! 异常处理分为两个阶段：搜索阶段和清理阶段。
//! 阶段。
//!
//! 在这两个阶段中，栈展开器从顶部到底部遍历栈帧，使用
//! 当前进程模块中的栈帧展开信息。
//! “模块”在这里指的是操作系统模块，即可执行文件或
//! 动态库。
//!
//! 对于每个栈帧，它调用相关的“个性例程”，其
//! 地址也存储在展开信息部分中。
//!
//! 在搜索阶段，个性例程的任务是检查
//! 被抛出的异常对象，并决定是否应在该栈帧处捕获。一旦识别出处理帧，清理阶段
//! 开始。
//! 在清理阶段，展开器再次调用每个个性例程。
//!
//! 这次它决定需要运行哪些（如果有的话）清理代码以
//! 处理当前栈帧。如果是这样，控制将转移到函数体中的特殊
//! 分支，即“着陆平台”，该平台调用析构函数、释放内存等。在着陆平台结束时，控制被转移回展开器，展开继续。
//! 当栈被展开到处理帧级别时，展开停止。
//! 最后，个性例程将控制转移到 catch 块。
//! 由 [ARM EHABI][armeabi-eh] 调用的个性函数。
//!
//! 32位 ARM 在 iOS/tvOS/watchOS 中不使用 ARM EHABI，而是使用
//! “setjmp-longjmp” 展开或 DWARF CFI 展开，由默认例程处理。
#![forbid(unsafe_op_in_unsafe_fn)]

use unwind as uw;

use super::dwarf::eh::{self, EHAction, EHContext};
use crate::ffi::c_int;

// Register ids were lifted from LLVM's TargetLowering::getExceptionPointerRegister()
// and TargetLowering::getExceptionSelectorRegister() for each architecture,
// then mapped to DWARF register numbers via register definition tables
// (typically <arch>RegisterInfo.td, search for "DwarfRegNum").
// See also https://llvm.org/docs/WritingAnLLVMBackend.html#defining-a-register.

#[cfg(target_arch = "x86")]
const UNWIND_DATA_REG: (i32, i32) = (0, 2); // EAX, EDX

#[cfg(target_arch = "x86_64")]
const UNWIND_DATA_REG: (i32, i32) = (0, 1); // RAX, RDX

#[cfg(any(target_arch = "arm", target_arch = "aarch64"))]
const UNWIND_DATA_REG: (i32, i32) = (0, 1); // R0, R1 / X0, X1

#[cfg(target_arch = "m68k")]
const UNWIND_DATA_REG: (i32, i32) = (0, 1); // D0, D1

#[cfg(any(
    target_arch = "mips",
    target_arch = "mips32r6",
    target_arch = "mips64",
    target_arch = "mips64r6"
))]
const UNWIND_DATA_REG: (i32, i32) = (4, 5); // A0, A1

#[cfg(target_arch = "csky")]
const UNWIND_DATA_REG: (i32, i32) = (0, 1); // R0, R1

#[cfg(any(target_arch = "powerpc", target_arch = "powerpc64"))]
const UNWIND_DATA_REG: (i32, i32) = (3, 4); // R3, R4 / X3, X4

#[cfg(target_arch = "s390x")]
const UNWIND_DATA_REG: (i32, i32) = (6, 7); // R6, R7

#[cfg(any(target_arch = "sparc", target_arch = "sparc64"))]
const UNWIND_DATA_REG: (i32, i32) = (24, 25); // I0, I1

#[cfg(target_arch = "hexagon")]
const UNWIND_DATA_REG: (i32, i32) = (0, 1); // R0, R1

#[cfg(any(target_arch = "riscv64", target_arch = "riscv32"))]
const UNWIND_DATA_REG: (i32, i32) = (10, 11); // x10, x11

#[cfg(any(target_arch = "loongarch32", target_arch = "loongarch64"))]
const UNWIND_DATA_REG: (i32, i32) = (4, 5); // a0, a1

// The following code is based on GCC's C and C++ personality routines.  For reference, see:
// https://github.com/gcc-mirror/gcc/blob/master/libstdc++-v3/libsupc++/eh_personality.cc
// https://github.com/gcc-mirror/gcc/blob/trunk/libgcc/unwind-c.c

cfg_select! {
    all(target_arch = "arm", not(target_vendor = "apple"), not(target_os = "netbsd")) => {
        /// 直接在大多数目标上使用的默认个性例程。
        ///
        /// 间接通过 SEH 在 Windows x86_64 和 AArch64 上使用。
        /// 由 [Windows 结构化异常处理][windows-eh] 调用的个性函数。
        /// 在 x86_64 和 AArch64 MinGW 目标上，展开机制是 SEH，
        ///
        /// [armeabi-eh]: https://web.archive.org/web/20190728160938/https://infocenter.arm.com/help/topic/com.arm.doc.ihi0038b/IHI0038B_ehabi.pdf
        #[lang = "eh_personality"]
        unsafe extern "C" fn rust_eh_personality(
            state: uw::_Unwind_State,
            exception_object: *mut uw::_Unwind_Exception,
            context: *mut uw::_Unwind_Context,
        ) -> uw::_Unwind_Reason_Code {
            unsafe {
                let state = state as c_int;
                let action = state & uw::_US_ACTION_MASK as c_int;
                let search_phase = if action == uw::_US_VIRTUAL_UNWIND_FRAME as c_int {
                    // Backtraces on ARM will call the personality routine with
                    // state == _US_VIRTUAL_UNWIND_FRAME | _US_FORCE_UNWIND. In those cases
                    // we want to continue unwinding the stack, otherwise all our backtraces
                    // would end at __rust_try
                    if state & uw::_US_FORCE_UNWIND as c_int != 0 {
                        return continue_unwind(exception_object, context);
                    }
                    true
                } else if action == uw::_US_UNWIND_FRAME_STARTING as c_int {
                    false
                } else if action == uw::_US_UNWIND_FRAME_RESUME as c_int {
                    return continue_unwind(exception_object, context);
                } else {
                    return uw::_URC_FAILURE;
                };

                // The DWARF unwinder assumes that _Unwind_Context holds things like the function
                // and LSDA pointers, however ARM EHABI places them into the exception object.
                // To preserve signatures of functions like _Unwind_GetLanguageSpecificData(), which
                // take only the context pointer, GCC personality routines stash a pointer to
                // exception_object in the context, using location reserved for ARM's
                // "scratch register" (r12).
                uw::_Unwind_SetGR(
                    context,
                    uw::UNWIND_POINTER_REG,
                    exception_object as uw::_Unwind_Ptr,
                );
                // ...A more principled approach would be to provide the full definition of ARM's
                // _Unwind_Context in our libunwind bindings and fetch the required data from there
                // directly, bypassing DWARF compatibility functions.

                let eh_action = match find_eh_action(context) {
                    Ok(action) => action,
                    Err(_) => return uw::_URC_FAILURE,
                };
                if search_phase {
                    match eh_action {
                        EHAction::None | EHAction::Cleanup(_) => {
                            return continue_unwind(exception_object, context);
                        }
                        EHAction::Catch(_) | EHAction::Filter(_) => {
                            // EHABI requires the personality routine to update the
                            // SP value in the barrier cache of the exception object.
                            (*exception_object).private[5] =
                                uw::_Unwind_GetGR(context, uw::UNWIND_SP_REG);
                            return uw::_URC_HANDLER_FOUND;
                        }
                        EHAction::Terminate => return uw::_URC_FAILURE,
                    }
                } else {
                    match eh_action {
                        EHAction::None => return continue_unwind(exception_object, context),
                        EHAction::Filter(_) if state & uw::_US_FORCE_UNWIND as c_int != 0 => {
                            return continue_unwind(exception_object, context);
                        }
                        EHAction::Cleanup(lpad)
                        | EHAction::Catch(lpad)
                        | EHAction::Filter(lpad) => {
                            uw::_Unwind_SetGR(
                                context,
                                UNWIND_DATA_REG.0,
                                exception_object as uw::_Unwind_Ptr,
                            );
                            uw::_Unwind_SetGR(context, UNWIND_DATA_REG.1, core::ptr::null());
                            uw::_Unwind_SetIP(context, lpad);
                            return uw::_URC_INSTALL_CONTEXT;
                        }
                        EHAction::Terminate => return uw::_URC_FAILURE,
                    }
                }

                // On ARM EHABI the personality routine is responsible for actually
                // unwinding a single stack frame before returning (ARM EHABI Sec. 6.1).
                unsafe fn continue_unwind(
                    exception_object: *mut uw::_Unwind_Exception,
                    context: *mut uw::_Unwind_Context,
                ) -> uw::_Unwind_Reason_Code {
                    unsafe {
                        if __gnu_unwind_frame(exception_object, context) == uw::_URC_NO_REASON {
                            uw::_URC_CONTINUE_UNWIND
                        } else {
                            uw::_URC_FAILURE
                        }
                    }
                }
                // defined in libgcc
                unsafe extern "C" {
                    fn __gnu_unwind_frame(
                        exception_object: *mut uw::_Unwind_Exception,
                        context: *mut uw::_Unwind_Context,
                    ) -> uw::_Unwind_Reason_Code;
                }
            }
        }
    }
    _ => {
        #[rustc_force_inline]
        unsafe fn sign_lpad(context: *mut uw::_Unwind_Context, lpad: *const u8) -> *const u8 {
            cfg_select! {
                all(target_abi = "pauthtest", target_arch = "aarch64") => {
                    // DWARF register number for SP on AArch64.
                    const SP_REG: i32 = 31;

                    unsafe {
                        let sp = uw::_Unwind_GetGR(context, SP_REG).addr() as u64;
                        let mut addr = lpad.addr();

                        // `pacib` corresponds to `ptrauth_key_process_dependent_code` in <ptrauth.h>.
                        core::arch::asm!(
                            "pacib {addr}, {sp}",
                            addr = inout(reg) addr,
                            sp = in(reg) sp,
                            options(nostack, preserves_flags)
                        );

                        lpad.with_addr(addr)
                    }
                }
                _ => {
                    let _ = context;
                    lpad
                }
            }
        }

        /// 然而，展开处理程序数据（即 LSDA）使用与 GCC 兼容的编码。
        /// 由 [Itanium C++ ABI 异常处理][itanium-eh] 调用的个性函数。
        unsafe extern "C" fn rust_eh_personality_impl(
            version: c_int,
            actions: uw::_Unwind_Action,
            _exception_class: uw::_Unwind_Exception_Class,
            exception_object: *mut uw::_Unwind_Exception,
            context: *mut uw::_Unwind_Context,
        ) -> uw::_Unwind_Reason_Code {
            unsafe {
                if version != 1 {
                    return uw::_URC_FATAL_PHASE1_ERROR;
                }
                let eh_action = match find_eh_action(context) {
                    Ok(action) => action,
                    Err(_) => return uw::_URC_FATAL_PHASE1_ERROR,
                };
                if actions & uw::_UA_SEARCH_PHASE != 0 {
                    match eh_action {
                        EHAction::None | EHAction::Cleanup(_) => uw::_URC_CONTINUE_UNWIND,
                        EHAction::Catch(_) | EHAction::Filter(_) => uw::_URC_HANDLER_FOUND,
                        EHAction::Terminate => uw::_URC_FATAL_PHASE1_ERROR,
                    }
                } else {
                    match eh_action {
                        EHAction::None => uw::_URC_CONTINUE_UNWIND,
                        // Forced unwinding hits a terminate action.
                        EHAction::Filter(_) if actions & uw::_UA_FORCE_UNWIND != 0 => {
                            uw::_URC_CONTINUE_UNWIND
                        }
                        EHAction::Cleanup(lpad)
                        | EHAction::Catch(lpad)
                        | EHAction::Filter(lpad) => {
                            uw::_Unwind_SetGR(context, UNWIND_DATA_REG.0, exception_object.cast());
                            uw::_Unwind_SetGR(context, UNWIND_DATA_REG.1, core::ptr::null());
                            let maybe_signed_lpad = sign_lpad(context, lpad);
                            uw::_Unwind_SetIP(context, maybe_signed_lpad);
                            uw::_URC_INSTALL_CONTEXT
                        }
                        EHAction::Terminate => uw::_URC_FATAL_PHASE2_ERROR,
                    }
                }
            }
        }

        cfg_select! {
            any(
                all(
                    windows,
                    any(target_arch = "aarch64", target_arch = "x86_64"),
                    target_env = "gnu"
                ),
                target_os = "cygwin",
            ) => {
                /// 大多数非 Windows 目标的个性例程。这将由
                ///
                /// 展开库调用：
                /// - “在搜索阶段，框架反复调用个性例程。”
                ///
                /// [windows-eh]: https://learn.microsoft.com/en-us/cpp/cpp/structured-exception-handling-c-cpp?view=msvc-170
                #[lang = "eh_personality"]
                #[allow(nonstandard_style)]
                unsafe extern "C" fn rust_eh_personality(
                    exceptionRecord: *mut uw::EXCEPTION_RECORD,
                    establisherFrame: uw::LPVOID,
                    contextRecord: *mut uw::CONTEXT,
                    dispatcherContext: *mut uw::DISPATCHER_CONTEXT,
                ) -> uw::EXCEPTION_DISPOSITION {
                    // SAFETY: the cfg is still target_os = "windows" and target_env = "gnu",
                    // which means that this is the correct function to call, passing our impl fn
                    // as the callback which gets actually used
                    unsafe {
                        uw::_GCC_specific_handler(
                            exceptionRecord,
                            establisherFrame,
                            contextRecord,
                            dispatcherContext,
                            rust_eh_personality_impl,
                        )
                    }
                }
            }
            _ => {
                /// personality fn called by [Itanium C++ ABI Exception Handling][itanium-eh]
                ///
                /// The personality routine for most non-Windows targets. This will be called by
                /// the unwinding library:
                /// - "In the search phase, the framework repeatedly calls the personality routine,
                /// 使用如下所述的 `_UA_SEARCH_PHASE` 标志，首先针对当前 PC 进行操作
                /// 并注册状态，然后每一步都将帧卸载到新的 PC 上……
                /// - “如果搜索阶段报告成功，框架将在清理阶段重新启动
                /// 阶段中再次调用个性处理程序，同时
                /// 使用如下所述的 `_UA_CLEANUP_PHASE` 标志，首先针对当前 PC 进行操作
                /// 注册状态，然后每一步都将帧卸载到新的 PC 上……
                ///
                /// [itanium-eh]: https://itanium-cxx-abi.github.io/cxx-abi/abi-eh.html
                #[lang = "eh_personality"]
                unsafe extern "C" fn rust_eh_personality(
                    version: c_int,
                    actions: uw::_Unwind_Action,
                    exception_class: uw::_Unwind_Exception_Class,
                    exception_object: *mut uw::_Unwind_Exception,
                    context: *mut uw::_Unwind_Context,
                ) -> uw::_Unwind_Reason_Code {
                    // SAFETY: the platform support must modify the cfg for the inner fn
                    // if it needs something different than what is currently invoked.
                    unsafe {
                        rust_eh_personality_impl(
                            version,
                            actions,
                            exception_class,
                            exception_object,
                            context,
                        )
                    }
                }
            }
        }
    }
}

unsafe fn find_eh_action(context: *mut uw::_Unwind_Context) -> Result<EHAction, ()> {
    unsafe {
        let lsda = uw::_Unwind_GetLanguageSpecificData(context) as *const u8;
        let mut ip_before_instr: c_int = 0;
        let ip = uw::_Unwind_GetIPInfo(context, &mut ip_before_instr);
        let eh_context = EHContext {
            // The return address points 1 byte past the call instruction,
            // which could be in the next IP range in LSDA range table.
            //
            // `ip = -1` has special meaning, so use wrapping sub to allow for that
            ip: if ip_before_instr != 0 { ip } else { ip.wrapping_sub(1) },
            func_start: uw::_Unwind_GetRegionStart(context),
            get_text_start: &|| uw::_Unwind_GetTextRelBase(context),
            get_data_start: &|| uw::_Unwind_GetDataRelBase(context),
        };
        eh::find_eh_action(lsda, &eh_context)
    }
}
