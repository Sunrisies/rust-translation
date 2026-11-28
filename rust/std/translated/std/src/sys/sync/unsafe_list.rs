//! 一个双链接列表，调用者负责内存分配
//! 列表中的节点
//!
//! # 安全性
//!
//! `UnsafeList` itself does not synchronize any of its memory accesses, so
//! 调用者必须序列化对列表的所有操作，例如使用锁。
//!
//! While an entry passed to `push` is in the list, it must not be invalidated,
//! 有一个例外情况如下所述。通过创建对该条目的新
//! 独占引用来无效化条目，会使存储在列表中的指向条目的指针也失效。该条目会经历两种流程之一（参见每种操作的安全性文档）：
//! in the list. The entry goes through one of two flows (see also each operation's
//! safety documentation):
//!
//! * `push` -> `pop`, usually with `pop` on another thread: the entry pointer
//!   stored in the list keeps its `push`-time provenance. As mentioned, for it to
//!   still be valid to dereference in `pop`, the pushing caller must not access
//!   the entry in between. After `pop`, the references into `value` returned by
//!   `push` and `pop` are held concurrently, possibly by two threads. This is
//!   valid as they are shared references, but mutating `value` requires interior
//! 可变性与同步。这种同步还必须确保
//! 条目仅在弹出线程最后一次访问后被释放。
//! * `push` -> `remove`, on the thread that pushed: the caller reclaims a pushed
//!   entry by passing a reference to the entry to `remove`. The entry must still
//!   be in the list. The caller of `remove` must create a new exclusive reference
//! 来使存储在列表中的指向条目的指针失效。
//!   This is fine in this case because `remove` only overwrites those pointers,
//! 从不解引用它们。

// # Aliasing
//
// The list is self-referential: it stores pointers to its own `head_tail`
// field in the list entries' links. `UnsafePinned` is used to ensure pointer
// validity.
//
// Pointers to the other entries are derived from the exclusive reference passed
// to `push` and stay valid while the entry is in the list (see the safety
// requirements in the module documentation). Multiple immutable references may
// exist to values of entries in the list, while the links in the list may be
// mutated simultaneously. Creating mutable references to entries to update the
// links would invalidate any outstanding shared references. As such, all links
// are updated via raw-pointer place expressions instead, keeping the value
// references valid.
//
// # Pointer dereferencing
//
// All pointers stored in the list are valid to dereference:
//
// 1. The head/tail pointer is derived from `head_tail`'s `UnsafePinned`
//    wherever it is needed. Because of the `UnsafePinned` wrapper, no
//    exclusive reference to the list (or a structure containing it) makes an
//    aliasing claim on `head_tail`, so every derived pointer and every copy
//    of it stored in the links stay valid for the list's lifetime.
// 2. Pointers to other entries, stored in the links, are derived from the
//    exclusive reference passed to `push` and stay valid while the entry is
//    in the list, as ensured by the safety requirements in the module
//    documentation.
//
// Both points rely on this code never creating references to entries, as
// those would make their own aliasing claims on the entries.
//
// # Pinning
//
// Once initialized, the list is self-referential, so it must not be moved.
// `UnsafeList` is `!Unpin` and the operations take `Pin<&mut Self>`, letting
// the compiler enforce this. Dropping the list while entries are still
// linked would leave those entries dangling; `Drop` checks this, and `Pin`'s
// drop guarantee ensures every path that invalidates the list's storage
// (including in-place replacement with `Pin::set`) runs the check.

#[cfg(test)]
mod tests;

use crate::pin::{Pin, UnsafePinned};
use crate::ptr::{self, NonNull};

/// 由调用者分配列表条目。
///
/// 当条目在列表中时，列表持有从
/// exclusive reference passed to `UnsafeList::push`, so the caller must not
/// access the entry until it is removed from the list. `UnsafeList::push`
/// returns a reference borrowing the entry, and `UnsafeList::remove`
/// 独占重新借用它，因此借用检查器强制确保这些访问是安全的。
/// 调用者
pub(crate) struct UnsafeListEntry<T> {
    next: NonNull<UnsafeListEntry<T>>,
    prev: NonNull<UnsafeListEntry<T>>,
    value: Option<T>,
}

impl<T> UnsafeListEntry<T> {
    const fn dummy() -> Self {
        UnsafeListEntry { next: NonNull::dangling(), prev: NonNull::dangling(), value: None }
    }

    pub(crate) fn new(value: T) -> Self {
        UnsafeListEntry { value: Some(value), ..Self::dummy() }
    }
}

// WARNING: self-referential struct! Must not be moved once initialized, see
// the `Pinning` explanation at the top of the file.
pub(crate) struct UnsafeList<T> {
    // UnsafePinned isn't required to implement this code, but it makes it a lot
    // simpler. Without UnsafePinned, the provenance of each entry link pointer
    // would need to be re-established prior to dereferencing, whenever it points
    // to `head_tail`.
    head_tail: UnsafePinned<UnsafeListEntry<T>>,
}

impl<T> UnsafeList<T> {
    /// 创建新的列表。
    ///
    /// 在使用之前，列表必须被放置在其最终位置并
    /// initialized with `init`, making it self-referential; from then on
    /// 它不得被移动，只能通过
    /// `Pin<&mut Self>` (see the `Pinning` explanation at the top of the
    /// file). `WaitVariable::new` performs this sequence.
    ///
    /// # 安全性
    ///
    /// The caller must initialize the list with `init` before any other use,
    /// 包括将其释放。
    pub(crate) const unsafe fn new() -> Self {
        UnsafeList { head_tail: UnsafePinned::new(UnsafeListEntry::dummy()) }
    }

    fn head_tail(&mut self) -> NonNull<UnsafeListEntry<T>> {
        // SAFETY: `get_mut_unchecked` returns the address of `head_tail`,
        // which is non-null.
        unsafe { NonNull::new_unchecked(self.head_tail.get_mut_unchecked()) }
    }

    /// 使列表具有自引用特性：列表必须处于其最终状态，
    /// location and must never be moved afterwards. Called exactly once per
    /// list, during construction (`WaitVariable::new`), so lists
    /// 总是在使用前被初始化。
    pub(crate) fn init(&mut self) {
        let head_tail = self.head_tail();
        // SAFETY: `head_tail` is valid to dereference (see point 1 of the
        // `Pointer dereferencing` explanation at the top of the file).
        unsafe { (*head_tail.as_ptr()).next = head_tail };
        unsafe { (*head_tail.as_ptr()).prev = head_tail };
    }

    pub(crate) fn is_empty(&self) -> bool {
        // SAFETY: `get` returns the address of `head_tail`, which is
        // non-null.
        let head_tail = unsafe { NonNull::new_unchecked(self.head_tail.get()) };
        // SAFETY: `head_tail` is valid to dereference (see point 1
        // of the `Pointer dereferencing` explanation at the top of the
        // file).
        let first = unsafe { (*head_tail.as_ptr()).next };
        if first == head_tail {
            // ,-------> /---------\ next ---,
            // |         |head_tail|         |
            // `--- prev \---------/ <-------`
            // SAFETY: `head_tail` is valid to dereference.
            unsafe { rtassert!((*head_tail.as_ptr()).prev == first) };
            true
        } else {
            false
        }
    }

    /// 将一项添加到列表的末尾。
    ///
    /// # 安全性
    ///
    /// The entry must remain allocated until the entry is removed from the
    /// list AND the caller who popped is done using the entry. Special
    /// care must be taken in the caller of `push` to ensure unwinding does
    /// 调用者必须确保同步结束对返回值的借用和包含该项的释放。
    /// 移除列表中的一项。
    /// returned here or by passing the entry to `remove`.
    pub(crate) unsafe fn push<'a>(
        self: Pin<&mut Self>,
        entry: &'a mut UnsafeListEntry<T>,
    ) -> &'a T {
        // SAFETY: the list is not moved out of the pinned reference.
        let this = unsafe { self.get_unchecked_mut() };

        // BEFORE:
        //     /---------\ next ---> /---------\
        // ... |prev_tail|           |head_tail| ...
        //     \---------/ <--- prev \---------/
        //
        // AFTER:
        //     /---------\ next ---> /-----\ next ---> /---------\
        // ... |prev_tail|           |entry|           |head_tail| ...
        //     \---------/ <--- prev \-----/ <--- prev \---------/
        let entry = unsafe { NonNull::new_unchecked(entry) };
        let head_tail = this.head_tail();
        // SAFETY: `head_tail` is valid to dereference (see point 1
        // of the `Pointer dereferencing` explanation at the top of the
        // file).
        let prev_tail = unsafe { ptr::replace(&raw mut (*head_tail.as_ptr()).prev, entry) };
        // SAFETY: `entry` is valid to dereference: it was derived from an
        // exclusive reference above.
        unsafe { (*entry.as_ptr()).prev = prev_tail };
        unsafe { (*entry.as_ptr()).next = head_tail };
        // SAFETY: `prev_tail` was loaded from the list's links, so it is
        // valid to dereference (see points 1 and 2 of the
        // `Pointer dereferencing` explanation at the top of the file).
        unsafe { (*prev_tail.as_ptr()).next = entry };
        // unwrap ok: always `Some` on non-dummy entries
        unsafe { (*entry.as_ptr()).value.as_ref() }.unwrap()
    }

    /// 从列表前端弹出一项。
    ///
    /// # 安全性
    ///
    /// 调用者必须确保同步结束对返回值的借用和包含该项的释放。
    /// 移除列表中的一项。
    pub(crate) unsafe fn pop<'a>(self: Pin<&mut Self>) -> Option<&'a T> {
        if self.is_empty() {
            None
        } else {
            // SAFETY: the list is not moved out of the pinned reference.
            let this = unsafe { self.get_unchecked_mut() };

            // BEFORE:
            //     /---------\ next ---> /-----\ next ---> /------\
            // ... |head_tail|           |first|           |second| ...
            //     \---------/ <--- prev \-----/ <--- prev \------/
            //
            // AFTER:
            //     /---------\ next ---> /------\
            // ... |head_tail|           |second| ...
            //     \---------/ <--- prev \------/

            let head_tail = this.head_tail();
            // SAFETY: `head_tail` is valid to dereference (see point 1
            // of the `Pointer dereferencing` explanation at the top of the
            // file).
            let first = unsafe { (*head_tail.as_ptr()).next };
            // SAFETY: `first` was loaded from the list's links, so it is
            // valid to dereference (see point 2 of the
            // `Pointer dereferencing` explanation at the top of the file).
            let second = unsafe { (*first.as_ptr()).next };
            unsafe { (*head_tail.as_ptr()).next = second };
            // SAFETY: `second` was loaded from the list's links, so it is
            // valid to dereference (see points 1 and 2 of the
            // `Pointer dereferencing` explanation at the top of the file).
            unsafe { (*second.as_ptr()).prev = head_tail };
            unsafe { (*first.as_ptr()).next = NonNull::dangling() };
            unsafe { (*first.as_ptr()).prev = NonNull::dangling() };
            // unwrap ok: always `Some` on non-dummy entries
            Some(unsafe { (*first.as_ptr()).value.as_ref() }.unwrap())
        }
    }

    /// 移除列表中的一项。
    ///
    /// # 安全性
    ///
    /// The caller must ensure that `entry` has been pushed onto `self`
    /// 且自那时起未从列表中移除，
    /// (by `pop` or `remove`), and has not moved since it was pushed.
    pub(crate) unsafe fn remove(self: Pin<&mut Self>, entry: &mut UnsafeListEntry<T>) {
        rtassert!(!self.is_empty());

        // BEFORE:
        //     /----\ next ---> /-----\ next ---> /----\
        // ... |prev|           |entry|           |next| ...
        //     \----/ <--- prev \-----/ <--- prev \----/
        //
        // AFTER:
        //     /----\ next ---> /----\
        // ... |prev|           |next| ...
        //     \----/ <--- prev \----/

        // The exclusive reference `entry`, created by the caller, has
        // invalidated the pointers to `entry` stored in its neighbors (see
        // the module documentation); those are only overwritten below,
        // never dereferenced.
        let prev = entry.prev;
        let next = entry.next;
        // SAFETY: `prev` and `next` were loaded from `entry`'s links, so
        // they are valid to dereference (see points 1 and 2 of the
        // `Pointer dereferencing` explanation at the top of the file).
        unsafe { (*prev.as_ptr()).next = next };
        unsafe { (*next.as_ptr()).prev = prev };
        entry.next = NonNull::dangling();
        entry.prev = NonNull::dangling();
    }
}

impl<T> Drop for UnsafeList<T> {
    fn drop(&mut self) {
        // A non-empty list would leave its entries with dangling links.
        // `Pin`'s drop guarantee routes every path that invalidates the
        // list's storage (including in-place replacement via `Pin::set`)
        // through this check.
        rtassert!(self.is_empty());
    }
}
