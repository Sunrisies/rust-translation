//! 针对架构特性的 SGX 特定访问方式。
//!
//! 此模块的功能在 Intel
//! 软件开发者手册第3卷第40章中有更详细的说明。
#![unstable(feature = "sgx_platform", issue = "56975")]

use core::arch::asm;

use crate::mem::MaybeUninit;

/// 用于强制16字节对齐的包装结构体。
#[repr(align(16))]
#[unstable(feature = "sgx_platform", issue = "56975")]
pub struct Align16<T>(pub T);

/// 用于强制128字节对齐的包装结构体。
#[repr(align(128))]
#[unstable(feature = "sgx_platform", issue = "56975")]
pub struct Align128<T>(pub T);

/// 用于强制512字节对齐的包装结构体。
#[repr(align(512))]
#[unstable(feature = "sgx_platform", issue = "56975")]
pub struct Align512<T>(pub T);

const ENCLU_EREPORT: u32 = 0;
const ENCLU_EGETKEY: u32 = 1;

/// Call the `EGETKEY` instruction to obtain a 128-bit secret key.
#[unstable(feature = "sgx_platform", issue = "56975")]
pub fn egetkey(request: &Align512<[u8; 512]>) -> Result<Align16<[u8; 16]>, u32> {
    unsafe {
        let mut out = MaybeUninit::uninit();
        let error;

        asm!(
            // rbx is reserved by LLVM
            "xchg %rbx, {0}",
            "enclu",
            "mov {0}, %rbx",
            inout(reg) request => _,
            inlateout("eax") ENCLU_EGETKEY => error,
            in("rcx") out.as_mut_ptr(),
            options(att_syntax, nostack),
        );

        match error {
            0 => Ok(out.assume_init()),
            err => Err(err),
        }
    }
}

/// Call the `EREPORT` instruction.
///
/// 这将生成一份描述当前
/// 环境块内容的加密报告。该报告可由所述环境块验证。
/// `targetinfo`.
#[unstable(feature = "sgx_platform", issue = "56975")]
pub fn ereport(
    targetinfo: &Align512<[u8; 512]>,
    reportdata: &Align128<[u8; 64]>,
) -> Align512<[u8; 432]> {
    unsafe {
        let mut report = MaybeUninit::uninit();

        asm!(
            // rbx is reserved by LLVM
            "xchg %rbx, {0}",
            "enclu",
            "mov {0}, %rbx",
            inout(reg) targetinfo => _,
            in("eax") ENCLU_EREPORT,
            in("rcx") reportdata,
            in("rdx") report.as_mut_ptr(),
            options(att_syntax, preserves_flags, nostack),
        );

        report.assume_init()
    }
}
