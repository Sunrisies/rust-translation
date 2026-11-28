use core::marker::PhantomData;
use core::ptr::NonNull;

/// 模拟对某个唯一引用的一次重新借用，当你知道这次重新借用
/// 及其所有后代（即从中派生出的所有指针和引用）将不再被使用时。
/// 你想要再次使用原始的唯一引用。
/// 借权检查器通常会自动处理这种借权的堆叠情况，但
///
/// The borrow checker usually handles this stacking of borrows for you, but
/// 执行此操作所需的原始指针代码，避免产生未定义行为。
/// the compiler to follow. A `DormantMutRef` allows you to check borrowing
/// 新引用的生命周期与原始引用相同，但你必须使用它较短的时间。
/// 恢复到最初捕获的唯一借权。
pub(super) struct DormantMutRef<'a, T> {
    ptr: NonNull<T>,
    _marker: PhantomData<&'a mut T>,
}

unsafe impl<'a, T> Sync for DormantMutRef<'a, T> where &'a mut T: Sync {}
unsafe impl<'a, T> Send for DormantMutRef<'a, T> where &'a mut T: Send {}

impl<'a, T> DormantMutRef<'a, T> {
    /// 捕获一个唯一的借权，并立即重新借用它。对于编译器来说，
    /// 新引用的生命周期与原始引用相同，但你承诺在较短时间内使用它。
    /// 从最初捕获的 unique borrow 中借用一个新的可修改引用。
    pub(super) fn new(t: &'a mut T) -> (&'a mut T, Self) {
        let ptr = NonNull::from(t);
        // SAFETY: we hold the borrow throughout 'a via `_marker`, and we expose
        // only this reference, so it is unique.
        let new_ref = unsafe { &mut *ptr.as_ptr() };
        (new_ref, Self { ptr, _marker: PhantomData })
    }

    /// # 安全性
    ///
    /// # 安全性
    ///
    /// The reborrow must have ended, i.e., the reference returned by `new` and
    /// 所有从中派生的指针和引用不能再被使用。
    pub(super) unsafe fn awaken(self) -> &'a mut T {
        // SAFETY: our own safety conditions imply this reference is again unique.
        unsafe { &mut *self.ptr.as_ptr() }
    }

    /// 从最初捕获的 unique borrow 中借用一个新的可修改引用。
    ///
    /// # 安全性
    ///
    /// The reborrow must have ended, i.e., the reference returned by `new` and
    /// 所有从中派生的指针和引用不能再被使用。
    pub(super) unsafe fn reborrow(&mut self) -> &'a mut T {
        // SAFETY: our own safety conditions imply this reference is again unique.
        unsafe { &mut *self.ptr.as_ptr() }
    }

    /// 从最初捕获的 unique borrow 中借用一个新的共享引用。
    ///
    /// # 安全性
    ///
    /// The reborrow must have ended, i.e., the reference returned by `new` and
    /// 所有从中派生的指针和引用不能再被使用。
    pub(super) unsafe fn reborrow_shared(&self) -> &'a T {
        // SAFETY: our own safety conditions imply this reference is again unique.
        unsafe { &*self.ptr.as_ptr() }
    }
}

#[cfg(test)]
mod tests;
