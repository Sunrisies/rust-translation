use crate::async_iter::AsyncIterator;
use crate::cell::UnsafeCell;
use crate::fmt;
use crate::future::Future;
use crate::marker::PointeeSized;
use crate::ops::{Deref, DerefMut};
use crate::pin::Pin;
use crate::ptr::NonNull;
use crate::task::{Context, Poll};

/// 一个表示“panic 安全”类型的 trait 标记。
///
/// This trait is implemented by default for many types and behaves similarly in
/// terms of inference of implementation to the [`Send`] and [`Sync`] traits. The
/// purpose of this trait is to encode what types are safe to cross a [`catch_unwind`]
/// 边界。
///
/// [`catch_unwind`]: ../../std/panic/fn.catch_unwind.html
///
/// ## 什么是回溯安全？
///
/// 在 Rust 中，如果函数发生 panic 或调用一个
/// 会传递 panic 的函数，则该函数可以提前“返回”。这种控制流并不总是
/// 预期的，并且可能通过两个关键组件的结合导致细微错误：
/// 1. 当线程发生 panic 时，数据结构处于临时无效状态。
///
/// 2. 随后发现这个被破坏的不变性。
/// 通常，在 Rust 中很难执行步骤（2），因为捕获 panic 要么涉及创建线程（这反过来又使得
/// 2. This broken invariant is then later observed.
///
/// 是问题，因为在 Rust 中没有未初始化的值（如 C 或 C++ 中那样）。
/// 然而，在 Rust 中**逻辑**不变性也可能被破坏，这可能导致行为错误。回溯安全的另一个关键方面是
/// to later witness broken invariants) or using the `catch_unwind` function in this
/// 内存不安全。
/// 这是关于回溯安全的简要概述，但有关回溯安全的更多信息及其在 Rust 中的应用，请参阅 [相关 RFC][rfc]。
///
/// It is possible, however, for **logical** invariants to be broken in Rust,
/// which can end up causing behavioral bugs. Another key aspect of unwind safety
/// in Rust is that, in the absence of `unsafe` code, a panic cannot lead to
/// memory unsafety.
///
/// 不过请注意，这不是一个 unsafe trait，因此没有简洁的总结。
/// about unwind safety and how it applies to Rust, see an [associated RFC][rfc].
///
/// [rfc]: https://rust-lang.github.io/rfcs/1236-stabilize-catch-panic.html
///
/// ## What is `UnwindSafe`?
///
/// Now that we've got an idea of what unwind safety is in Rust, it's also
/// important to understand what this trait represents. As mentioned above, one
/// way to witness broken invariants is through the `catch_unwind` function in this
/// module as it allows catching a panic and then re-using the environment of
/// the closure.
///
/// Simply put, a type `T` implements `UnwindSafe` if it cannot easily allow
/// witnessing a broken invariant through the use of `catch_unwind` (catching a
/// panic). This trait is an auto trait, so it is automatically implemented for
/// many types, and it is also structurally composed (e.g., a struct is unwind
/// safe if all of its components are unwind safe).
///
/// Note, however, that this is not an unsafe trait, so there is not a succinct
/// 提供此 trait 的合约。实际上，它更像是
/// "speed bump" to alert users of `catch_unwind` that broken invariants may be
/// 需要被考虑处理。
///
/// ## Who implements `UnwindSafe`?
///
/// Types such as `&mut T` and `&RefCell<T>` are examples which are **not**
/// 不可恢复安全的示例。基本思想是，任何可以共享的可变状态
/// across `catch_unwind` is not unwind safe by default. This is because it is very
/// easy to witness a broken invariant outside of `catch_unwind` as the data is
/// 像平常一样被访问。
///
/// Types like `&Mutex<T>`, however, are unwind safe because they implement
/// 默认情况下会“污染”状态。它们仍然允许发现损坏的不变量，
/// 但它们自身提供了“缓冲措施”来做到这一点。
///
/// ## When should `UnwindSafe` be used?
///
/// 大多数类型或函数不需要担心此 trait。
/// It is only used as a bound on the `catch_unwind` function and as mentioned
/// above, the lack of `unsafe` means it is mostly an advisory. The
/// [`AssertUnwindSafe`] wrapper struct can be used to force this trait to be
/// implemented for any closed over variables passed to `catch_unwind`.
#[stable(feature = "catch_unwind", since = "1.9.0")]
#[rustc_diagnostic_item = "unwind_safe_trait"]
#[diagnostic::on_unimplemented(
    message = "the type `{Self}` may not be safely transferred across an unwind boundary",
    label = "`{Self}` may not be safely transferred across an unwind boundary"
)]
pub auto trait UnwindSafe {}

/// 一个表示共享引用被认为是
/// 不可恢复安全的类型的标记 trait。
///
/// This trait is namely not implemented by [`UnsafeCell`], the root of all
/// 内部可变性之源。
///
/// 这是一个“辅助标记 trait”，用于为
/// [`UnwindSafe`] trait, for more information see that documentation.
#[stable(feature = "catch_unwind", since = "1.9.0")]
#[rustc_diagnostic_item = "ref_unwind_safe_trait"]
#[diagnostic::on_unimplemented(
    message = "the type `{Self}` may contain interior mutability and a reference may not be safely \
               transferable across a catch_unwind boundary",
    label = "`{Self}` may contain interior mutability and a reference may not be safely \
             transferable across a catch_unwind boundary"
)]
pub auto trait RefUnwindSafe {}

/// 对类型的一个简单包装，以断言其不可恢复安全。
///
/// When using [`catch_unwind`] it may be the case that some of the closed over
/// variables are not unwind safe. For example if `&mut T` is captured the
/// compiler will generate a warning indicating that it is not unwind safe. It
/// 特别考虑了不可恢复安全性。此包装结构可用于快速且轻量级的
/// specific usage of [`catch_unwind`] if unwind safety is specifically taken into
/// # 示例
/// annotation that a variable is indeed unwind safe.
///
/// [`catch_unwind`]: ../../std/panic/fn.catch_unwind.html
///
/// # 不可恢复安全，从而绕过对所有变量的所有检查：
///
/// One way to use `AssertUnwindSafe` is to assert that the entire closure
/// 不可恢复安全。其缺点是，如果新增捕获变量
///
/// ```
/// use std::panic::{self, AssertUnwindSafe};
///
/// let mut variable = 4;
///
/// // This code will not compile because the closure captures `&mut variable`
/// // which is not considered unwind safe by default.
///
/// // panic::catch_unwind(|| {
/// //     variable += 3;
/// // });
///
/// // This, however, will compile due to the `AssertUnwindSafe` wrapper
/// let result = panic::catch_unwind(AssertUnwindSafe(|| {
///     variable += 3;
/// }));
/// // ...
/// ```
///
/// Wrapping the entire closure amounts to a blanket assertion that all captured
/// variables are unwind safe. This has the downside that if new captures are
/// 未来将添加这些功能，它们也将被视为安全可反绕的。因此，
/// 你可能更愿意直接包裹各个捕获项，如下所示。这
/// 需要更多的注释，但它能确保如果添加了新的捕获项且该捕获项不是
/// 安全可反绕的，那么在编译时就会出现错误，从而
/// 让你能够判断那个新捕获项实际上是否是一个问题或
/// 不是。
///
/// ```
/// use std::panic::{self, AssertUnwindSafe};
///
/// let mut variable = 4;
/// let other_capture = 3;
///
/// let result = {
///     let mut wrapper = AssertUnwindSafe(&mut variable);
///     panic::catch_unwind(move || {
///         **wrapper += other_capture;
///     })
/// };
/// // ...
/// ```
#[stable(feature = "catch_unwind", since = "1.9.0")]
pub struct AssertUnwindSafe<T>(#[stable(feature = "catch_unwind", since = "1.9.0")] pub T);

// Implementations of the `UnwindSafe` trait:
//
// * By default everything is unwind safe
// * pointers T contains mutability of some form are not unwind safe
// * Types like Mutex/RwLock which are explicitly poisoned are unwind safe
// * Our custom AssertUnwindSafe wrapper is indeed unwind safe

#[stable(feature = "catch_unwind", since = "1.9.0")]
impl<T: PointeeSized> !UnwindSafe for &mut T {}
#[stable(feature = "catch_unwind", since = "1.9.0")]
impl<T: RefUnwindSafe + PointeeSized> UnwindSafe for &T {}
#[stable(feature = "catch_unwind", since = "1.9.0")]
impl<T: RefUnwindSafe + PointeeSized> UnwindSafe for *const T {}
#[stable(feature = "catch_unwind", since = "1.9.0")]
impl<T: RefUnwindSafe + PointeeSized> UnwindSafe for *mut T {}
#[stable(feature = "nonnull", since = "1.25.0")]
impl<T: RefUnwindSafe + PointeeSized> UnwindSafe for NonNull<T> {}
#[stable(feature = "catch_unwind", since = "1.9.0")]
impl<T> UnwindSafe for AssertUnwindSafe<T> {}

// Pretty simple implementations for the `RefUnwindSafe` marker trait,
// basically just saying that `UnsafeCell` is the
// only thing which doesn't implement it (which then transitively applies to
// everything else).
#[stable(feature = "catch_unwind", since = "1.9.0")]
impl<T: ?Sized> !RefUnwindSafe for UnsafeCell<T> {}
#[stable(feature = "catch_unwind", since = "1.9.0")]
impl<T> RefUnwindSafe for AssertUnwindSafe<T> {}

#[cfg(target_has_atomic_load_store = "ptr")]
#[stable(feature = "unwind_safe_atomic_refs", since = "1.14.0")]
impl RefUnwindSafe for crate::sync::atomic::AtomicIsize {}
#[cfg(target_has_atomic_load_store = "8")]
#[stable(feature = "integer_atomics_stable", since = "1.34.0")]
impl RefUnwindSafe for crate::sync::atomic::AtomicI8 {}
#[cfg(target_has_atomic_load_store = "16")]
#[stable(feature = "integer_atomics_stable", since = "1.34.0")]
impl RefUnwindSafe for crate::sync::atomic::AtomicI16 {}
#[cfg(target_has_atomic_load_store = "32")]
#[stable(feature = "integer_atomics_stable", since = "1.34.0")]
impl RefUnwindSafe for crate::sync::atomic::AtomicI32 {}
#[cfg(target_has_atomic_load_store = "64")]
#[stable(feature = "integer_atomics_stable", since = "1.34.0")]
impl RefUnwindSafe for crate::sync::atomic::AtomicI64 {}
#[cfg(target_has_atomic_load_store = "128")]
#[unstable(feature = "integer_atomics", issue = "99069")]
impl RefUnwindSafe for crate::sync::atomic::AtomicI128 {}

#[cfg(target_has_atomic_load_store = "ptr")]
#[stable(feature = "unwind_safe_atomic_refs", since = "1.14.0")]
impl RefUnwindSafe for crate::sync::atomic::AtomicUsize {}
#[cfg(target_has_atomic_load_store = "8")]
#[stable(feature = "integer_atomics_stable", since = "1.34.0")]
impl RefUnwindSafe for crate::sync::atomic::AtomicU8 {}
#[cfg(target_has_atomic_load_store = "16")]
#[stable(feature = "integer_atomics_stable", since = "1.34.0")]
impl RefUnwindSafe for crate::sync::atomic::AtomicU16 {}
#[cfg(target_has_atomic_load_store = "32")]
#[stable(feature = "integer_atomics_stable", since = "1.34.0")]
impl RefUnwindSafe for crate::sync::atomic::AtomicU32 {}
#[cfg(target_has_atomic_load_store = "64")]
#[stable(feature = "integer_atomics_stable", since = "1.34.0")]
impl RefUnwindSafe for crate::sync::atomic::AtomicU64 {}
#[cfg(target_has_atomic_load_store = "128")]
#[unstable(feature = "integer_atomics", issue = "99069")]
impl RefUnwindSafe for crate::sync::atomic::AtomicU128 {}

#[cfg(target_has_atomic_load_store = "8")]
#[stable(feature = "unwind_safe_atomic_refs", since = "1.14.0")]
impl RefUnwindSafe for crate::sync::atomic::AtomicBool {}

#[cfg(target_has_atomic_load_store = "ptr")]
#[stable(feature = "unwind_safe_atomic_refs", since = "1.14.0")]
impl<T> RefUnwindSafe for crate::sync::atomic::AtomicPtr<T> {}

#[stable(feature = "catch_unwind", since = "1.9.0")]
#[rustc_const_unstable(feature = "const_convert", issue = "143773")]
const impl<T> Deref for AssertUnwindSafe<T> {
    type Target = T;

    fn deref(&self) -> &T {
        &self.0
    }
}

#[stable(feature = "catch_unwind", since = "1.9.0")]
#[rustc_const_unstable(feature = "const_convert", issue = "143773")]
const impl<T> DerefMut for AssertUnwindSafe<T> {
    fn deref_mut(&mut self) -> &mut T {
        &mut self.0
    }
}

#[stable(feature = "catch_unwind", since = "1.9.0")]
impl<R, F: FnOnce() -> R> FnOnce<()> for AssertUnwindSafe<F> {
    type Output = R;

    #[inline]
    extern "rust-call" fn call_once(self, _args: ()) -> R {
        (self.0)()
    }
}

#[stable(feature = "std_debug", since = "1.16.0")]
impl<T: fmt::Debug> fmt::Debug for AssertUnwindSafe<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_tuple("AssertUnwindSafe").field(&self.0).finish()
    }
}

#[stable(feature = "assertunwindsafe_default", since = "1.62.0")]
impl<T: Default> Default for AssertUnwindSafe<T> {
    fn default() -> Self {
        Self(Default::default())
    }
}

#[stable(feature = "futures_api", since = "1.36.0")]
impl<F: Future> Future for AssertUnwindSafe<F> {
    type Output = F::Output;

    fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output> {
        // SAFETY: pin projection. AssertUnwindSafe follows structural pinning.
        let pinned_field = unsafe { Pin::map_unchecked_mut(self, |x| &mut x.0) };
        F::poll(pinned_field, cx)
    }
}

#[unstable(feature = "async_iterator", issue = "79024")]
impl<S: AsyncIterator> AsyncIterator for AssertUnwindSafe<S> {
    type Item = S::Item;

    fn poll_next(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<S::Item>> {
        // SAFETY: pin projection. AssertUnwindSafe follows structural pinning.
        unsafe { self.map_unchecked_mut(|x| &mut x.0) }.poll_next(cx)
    }

    fn size_hint(&self) -> (usize, Option<usize>) {
        self.0.size_hint()
    }
}

/// If a value's type is already `UnwindSafe`,
/// wrapping it in `AssertUnwindSafe` is never incorrect.
#[stable(feature = "from_wrapper_impls", since = "1.96.0")]
impl<T> From<T> for AssertUnwindSafe<T>
where
    T: UnwindSafe,
{
    #[inline(always)]
    fn from(value: T) -> Self {
        Self(value)
    }
}
