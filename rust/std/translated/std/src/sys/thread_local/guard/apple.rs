//! macOS 允许通过 `_tlv_atexit` 注册析构函数。但由于在 TLS 析构函数运行时调用它属于未定义行为（UB），我们仍需保留自己的
//! 析构函数列表。
//! list of destructors.

use crate::cell::Cell;
use crate::ptr;
use crate::sys::thread_local::destructors;

pub fn enable() {
    #[thread_local]
    static REGISTERED: Cell<bool> = Cell::new(false);

    unsafe extern "C" {
        fn _tlv_atexit(dtor: unsafe extern "C" fn(*mut u8), arg: *mut u8);
    }

    if !REGISTERED.replace(true) {
        // SAFETY: Calling _tlv_atexit while TLS destructors are running is UB.
        // But as run_dtors is only called after being registered, this point
        // cannot be reached from it.
        unsafe {
            _tlv_atexit(run_dtors, ptr::null_mut());
        }
    }

    unsafe extern "C" fn run_dtors(_: *mut u8) {
        unsafe {
            destructors::run();
            crate::rt::thread_cleanup();
        }
    }
}
