//! 仅在自身执行析构函数时运行的保护机制
//! [`crate::rt::thread_cleanup`], never free the values of keys without a
//! 析构函数在清理之前执行。因此，局部指针不需要析构函数。

pub const LOCAL_POINTER_NEEDS_DTOR: bool = false;

/// Only referenced by the `keep` destructor of `local_pointer!`, which is
/// never registered here (`LOCAL_POINTER_NEEDS_DTOR` is `false`).
pub fn cleanup_pending() -> bool {
    rtabort!("`cleanup_pending` called although `LOCAL_POINTER_NEEDS_DTOR` is false")
}
