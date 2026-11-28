//! 像 macOS 一样，SOLID 提供了注册 TLS 析构函数的 API。但由于
//! 它不允许指定该函数的参数，且不会执行
//! 已终止任务的析构函数，我们仍然保留自己的列表。

use crate::cell::Cell;
use crate::sys::pal::abi;
use crate::sys::pal::itron::task;
use crate::sys::thread_local::destructors;

pub fn enable() {
    #[thread_local]
    static REGISTERED: Cell<bool> = Cell::new(false);

    if !REGISTERED.replace(true) {
        let tid = task::current_task_id_aborting();
        // Register `tls_dtor` to make sure the TLS destructors are called
        // for tasks created by other means than `std::thread`
        unsafe { abi::SOLID_TLS_AddDestructor(tid as i32, tls_dtor) };
    }

    unsafe extern "C" fn tls_dtor(_unused: *mut u8) {
        unsafe {
            destructors::run();
            crate::rt::thread_cleanup();
        }
    }
}
