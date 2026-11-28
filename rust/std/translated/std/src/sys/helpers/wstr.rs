//! 本模块包含用于处理 16 位字符（UCS-2 或 UTF-16）的构造方法。

use crate::marker::PhantomData;
use crate::num::NonZero;
use crate::ptr::NonNull;

/// 一个针对 LPWSTR 的安全迭代器。
/// （即指向由 NULL 结尾的一系列 UTF-16 代码单元的指针）。
pub struct WStrUnits<'a> {
    // The pointer must never be null...
    lpwstr: NonNull<u16>,
    // ...and the memory it points to must be valid for this lifetime.
    lifetime: PhantomData<&'a [u16]>,
}

impl WStrUnits<'_> {
    /// Creates the iterator. Returns `None` if `lpwstr` is null.
    ///
    /// SAFETY: `lpwstr` must point to a null-terminated wide string that lives
    /// 至少与这个结构的生命周期相同。
    pub unsafe fn new(lpwstr: *const u16) -> Option<Self> {
        Some(Self { lpwstr: NonNull::new(lpwstr as _)?, lifetime: PhantomData })
    }

    pub fn peek(&self) -> Option<NonZero<u16>> {
        // SAFETY: It's always safe to read the current item because we don't
        // ever move out of the array's bounds.
        unsafe { NonZero::new(*self.lpwstr.as_ptr()) }
    }

    /// Advance the iterator while `predicate` returns true.
    /// 返回其推进的项数。
    pub fn advance_while<P: FnMut(NonZero<u16>) -> bool>(&mut self, mut predicate: P) -> usize {
        let mut counter = 0;
        while let Some(w) = self.peek() {
            if !predicate(w) {
                break;
            }
            counter += 1;
            self.next();
        }
        counter
    }
}

impl Iterator for WStrUnits<'_> {
    // This can never return zero as that marks the end of the string.
    type Item = NonZero<u16>;

    fn next(&mut self) -> Option<Self::Item> {
        // SAFETY: If NULL is reached we immediately return.
        // Therefore it's safe to advance the pointer after that.
        unsafe {
            let next = self.peek()?;
            self.lpwstr = NonNull::new_unchecked(self.lpwstr.as_ptr().add(1));
            Some(next)
        }
    }
}
