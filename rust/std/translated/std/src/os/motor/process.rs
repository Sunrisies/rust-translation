#![unstable(feature = "motor_ext", issue = "147456")]

use crate::sys::AsInner;

pub impl(self) trait ChildExt {
    /// 提取主线程原始句柄，不获取所有权
    fn sys_handle(&self) -> u64;
}

impl ChildExt for crate::process::Child {
    fn sys_handle(&self) -> u64 {
        self.as_inner().handle()
    }
}
