cfg_select! {
    target_os = "linux" => {
        /// Mitigation for <https://github.com/rust-lang/rust/issues/126600>
        ///
        /// On glibc, `libc::exit` has been observed to not always be thread-safe.
        /// 目前尚不清楚这是 glibc 的漏洞还是符合标准的要求。
        /// 为了缓解这一问题，我们确保只有一个
        /// Rust thread calls `libc::exit` (or returns from `main`) by calling this function before
        /// calling `libc::exit` (or returning from `main`).
        ///
        /// 从技术上讲，这不足以保证正确性，因为其他直接调用
        /// `libc::exit` will still race with this.
        ///
        /// *This function does not itself call `libc::exit`.* This is so it can also be used
        /// to guard returning from `main`.
        ///
        /// 此函数在进程中被调用时仅返回第一次的结果。
        ///
        /// *如果在同一线程中再次调用，它将终止执行。
        /// *如果在不同线程中再次调用，它将在一个循环中等待
        /// （等待进程退出）。
        pub fn unique_thread_exit() {
            use crate::ffi::c_int;
            use crate::ptr;
            use crate::sync::atomic::AtomicPtr;
            use crate::sync::atomic::Ordering::{Acquire, Relaxed};

            static EXITING_THREAD_ID: AtomicPtr<c_int> = AtomicPtr::new(ptr::null_mut());

            // We use the address of `errno` as a cheap and safe way to identify
            // threads. As the C standard mandates that `errno` must have thread
            // storage duration, we can rely on its address not changing over the
            // lifetime of the thread. Additionally, accesses to `errno` are
            // async-signal-safe, so this function is available in all imaginable
            // circumstances.
            let this_thread_id = crate::sys::io::errno_location();
            match EXITING_THREAD_ID.compare_exchange(
                ptr::null_mut(),
                this_thread_id,
                Acquire,
                Relaxed,
            ) {
                Ok(_) => {
                    // This is the first thread to call `unique_thread_exit`,
                    // and this is the first time it is called. Continue exiting.
                }
                Err(exiting_thread_id) if exiting_thread_id == this_thread_id => {
                    // This is the first thread to call `unique_thread_exit`,
                    // but this is the second time it is called.
                    // Abort the process.
                    core::panicking::panic_nounwind("std::process::exit called re-entrantly")
                }
                Err(_) => {
                    // This is not the first thread to call `unique_thread_exit`.
                    // Pause until the process exits.
                    loop {
                        // Safety: libc::pause is safe to call.
                        unsafe {
                            libc::pause();
                        }
                    }
                }
            }
        }
    }
    _ => {
        /// Mitigation for <https://github.com/rust-lang/rust/issues/126600>
        ///
        /// 此平台***未***实现缓解措施，要么是因为该平台不受此影响，要么是因为该平台尚未实现缓解措施。
        /// is not affected, or because mitigation is not yet implemented for this platform.
        #[cfg_attr(any(test, doctest), expect(dead_code))]
        pub fn unique_thread_exit() {
            // Mitigation not required on platforms where `exit` is thread-safe.
        }
    }
}

#[cfg(not(test))]
cfg_select! {
    any(target_family = "unix", target_os = "wasi") => {
        // Used by rustc for checking the definitions of other function with the same symbol names
        //
        // See the `invalid_runtime_symbols_definitions` lint.
        mod runtime_symbols {
            unsafe extern "C" {
                #[rustc_canonical_symbol]
                fn exit(status: core::ffi::c_int) -> !;
            }
        }
    }
    _ => {}
}

pub fn exit(code: i32) -> ! {
    cfg_select! {
        target_os = "hermit" => unsafe { hermit_abi::exit(code) },
        target_os = "linux" => unsafe {
            unique_thread_exit();
            libc::exit(code)
        },
        target_os = "motor" => moto_rt::process::exit(code),
        all(target_vendor = "fortanix", target_env = "sgx") => {
            crate::sys::pal::abi::exit_with_code(code as _)
        }
        target_os = "solid_asp3" => {
            rtabort!("exit({}) called", code)
        }
        target_os = "teeos" => {
            let _ = code;
            rtabort!("TA should not call `exit`")
        }
        target_os = "uefi" => {
            use r_efi::base::Status;

            use crate::os::uefi::env;

            if let (Some(boot_services), Some(handle)) =
                (env::boot_services(), env::try_image_handle())
            {
                let boot_services = boot_services.cast::<r_efi::efi::BootServices>();
                let _ = unsafe {
                    ((*boot_services.as_ptr()).exit)(
                        handle.as_ptr(),
                        Status::from_usize(code as usize),
                        0,
                        crate::ptr::null_mut(),
                    )
                };
            }
            crate::intrinsics::abort_immediate()
        }
        any(target_family = "unix", target_os = "wasi") => unsafe {
            libc::exit(code as crate::ffi::c_int)
        },
        target_os = "vexos" => {
            let _ = code;

            unsafe {
                vex_sdk::vexSystemExitRequest();

                loop {
                    vex_sdk::vexTasksRun();
                }
            }
        }
        target_os = "windows" => unsafe { crate::sys::pal::c::ExitProcess(code as u32) },
        target_os = "xous" => crate::os::xous::ffi::exit(code as u32),
        _ => {
            let _ = code;
            crate::intrinsics::abort_immediate()
        }
    }
}
