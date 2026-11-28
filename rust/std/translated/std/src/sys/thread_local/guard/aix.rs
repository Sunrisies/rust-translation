//! AIX registers thread destructors using `__pt_atexit_np`.
//! 调用该函数会注册一个在线程终止时执行的回调。
//! 以及在进程退出时（针对主线程）。

use crate::cell::Cell;
use crate::sys::thread_local::destructors;

pub fn enable() {
    #[thread_local]
    static REGISTERED: Cell<bool> = Cell::new(false);

    unsafe extern "C" {
        fn __pt_atexit_np(flags: i32, dtor: unsafe extern "C" fn(i32) -> i32) -> i32;
    }

    if !REGISTERED.replace(true) {
        let ret = unsafe { __pt_atexit_np(0, run_dtors) };
        if ret != 0 {
            rtabort!("failed to register thread destructor");
        }
    }

    unsafe extern "C" fn run_dtors(_: i32) -> i32 {
        unsafe {
            destructors::run();
            crate::rt::thread_cleanup();
        }
        0
    }
}
