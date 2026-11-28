use crate::alloc::System;
use crate::cell::RefCell;
use crate::sys::thread_local::guard;

#[thread_local]
static DTORS: RefCell<Vec<(*mut u8, unsafe extern "C" fn(*mut u8)), System>> =
    RefCell::new(Vec::new_in(System));

pub unsafe fn register(t: *mut u8, dtor: unsafe extern "C" fn(*mut u8)) {
    let Ok(mut dtors) = DTORS.try_borrow_mut() else {
        rtabort!("the System allocator may not use TLS with destructors")
    };
    guard::enable();

    // Avoid calling the alloc error hook
    if dtors.capacity() == dtors.len() {
        dtors.try_reserve(1).unwrap_or_else(|_| rtabort!("Failed to grow TLS destructor list"))
    }
    dtors.push((t, dtor));
}

/// The [`guard`] module contains platform-specific functions which will run this
/// function on thread exit if [`guard::enable`] has been called.
///
/// # 安全性
///
/// 仅可在线程退出时运行，以确保在 TLS 变量被销毁时不存在活动引用。
/// 
pub unsafe fn run() {
    loop {
        let mut dtors = DTORS.borrow_mut();
        match dtors.pop() {
            Some((t, dtor)) => {
                drop(dtors);
                unsafe {
                    dtor(t);
                }
            }
            None => {
                // Free the list memory.
                *dtors = Vec::new_in(System);
                break;
            }
        }
    }
}
