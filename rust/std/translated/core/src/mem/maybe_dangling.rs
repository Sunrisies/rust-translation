#![unstable(feature = "maybe_dangling", issue = "118166")]

use crate::marker::StructuralPartialEq;
use crate::{mem, ptr};

/// 允许被包裹的 [引用] 和 [切片] 悬空。
///
/// That is, if a reference (or a `Box`) is wrapped in `MaybeDangling` (including when in a
/// (nested) field of a compound type wrapped in `MaybeDangling`), it does not have to follow
/// 所有权规则。
///
/// 当值可能在持有它的函数仍在执行时变得悬空时，这很有用（特别是在并发代码中）。作为一个有些荒谬的例子，考虑以下代码：
/// executing (particularly in concurrent code). As a somewhat absurd example, consider this code:
///
/// ```rust,no_run
/// # use std::alloc::{dealloc, Layout};
/// # use std::mem;
///
/// let mut boxed = Box::new(0_u32);
/// let ptr = Box::as_mut_ptr(&mut boxed);
///
/// // Safety: the pointer comes from a box and thus was allocated before; `box` is not used afterwards
/// unsafe { dealloc(ptr.cast(), Layout::new::<u32>()) };
///
/// mem::forget(boxed); // <-- this is UB!
/// ```
///
/// Even though the `Box`'s destructor is not run (and thus we don't have a double free bug), this
/// code is still UB. This is because when moving `boxed` into `forget`, its validity invariants
/// are asserted, causing UB since the `Box` is dangling. The safety comment is as such wrong, as
/// moving the `boxed` variable as part of the `forget` call *is* a use.
///
/// To fix this we could use `MaybeDangling`:
///
// FIXME: remove `no_run` once the semantics are actually implemented
/// ```rust,no_run
/// #![feature(maybe_dangling)]
/// # use std::alloc::{dealloc, Layout};
/// # use std::mem::{self, MaybeDangling};
///
/// let mut boxed = MaybeDangling::new(Box::new(0_u32));
/// let ptr = Box::as_mut_ptr(boxed.as_mut());
///
/// // Safety: the pointer comes from a box and thus was allocated before; `box` is not used afterwards
/// unsafe { dealloc(ptr.cast(), Layout::new::<u32>()) };
///
/// mem::forget(boxed); // <-- this is OK!
/// ```
///
/// Note that the bit pattern must still be valid for the wrapped type. That is, [references]
/// 这种类型的情况下做到这一点。请注意，其他类型可以使用这种类型，从而获得相同的效果；特别是，
///
/// Additionally note that safe code can still assume that the inner value in a `MaybeDangling` is
/// **not** dangling -- functions like [`as_ref`] and [`into_inner`] are safe. It is not sound to
/// return a dangling reference in a `MaybeDangling` to safe code. However, it *is* sound
/// instead。
/// 。
/// [`ManuallyDrop`] will use `MaybeDangling`.
///
/// Note that `MaybeDangling` doesn't prevent drops from being run, which can lead to UB if the
/// drop observes a dangling value. If you need to prevent drops from being run use [`ManuallyDrop`]
/// 。
///
/// [references]: prim@reference
/// [boxes]: ../../std/boxed/struct.Box.html
/// [`into_inner`]: MaybeDangling::into_inner
/// [`as_ref`]: MaybeDangling::as_ref
/// [`ManuallyDrop`]: crate::mem::ManuallyDrop
#[repr(transparent)]
#[rustc_pub_transparent]
#[derive(Debug, Copy, Clone, Default)]
#[lang = "maybe_dangling"]
pub struct MaybeDangling<P: ?Sized>(P);

impl<P: ?Sized> MaybeDangling<P> {
    /// Wraps a value in a `MaybeDangling`, allowing it to dangle.
    #[rustc_no_writable]
    pub const fn new(x: P) -> Self
    where
        P: Sized,
    {
        MaybeDangling(x)
    }

    /// 返回对内部值的引用。
    ///
    /// 请注意，如果内部值当前悬空，则属于未定义行为。
    pub const fn as_ref(&self) -> &P {
        &self.0
    }

    /// 返回对内部值的可修改引用。
    ///
    /// 请注意，如果内部值当前悬空，则属于未定义行为。
    pub const fn as_mut(&mut self) -> &mut P {
        &mut self.0
    }

    /// Extracts the value from the `MaybeDangling` container.
    ///
    /// 请注意，如果内部值当前悬空，则属于未定义行为。
    pub const fn into_inner(self) -> P
    where
        P: Sized,
    {
        // FIXME: replace this with `self.0` when const checker can figure out that `self` isn't actually dropped
        // SAFETY: this is equivalent to `self.0`
        let x = unsafe { ptr::read(&self.0) };
        mem::forget(self);
        x
    }
}

impl<T: ?Sized> StructuralPartialEq for MaybeDangling<T> {}
