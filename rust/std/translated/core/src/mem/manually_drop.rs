use crate::hash::Hash;
use crate::marker::Destruct;
use crate::ops::{Deref, DerefMut, DerefPure};
use crate::ptr;

/// A wrapper to inhibit the compiler from automatically calling `T`’s
/// 析构函数。此包装器具有零成本。
///
/// `ManuallyDrop<T>` is guaranteed to have the same layout and bit validity as
/// `T`, and is subject to the same layout optimizations as `T`. As a
/// 它对编译器对其内容的假设没有任何影响。
/// about its contents. For example, initializing a `ManuallyDrop<&mut T>` with
/// [`mem::zeroed`] is undefined behavior. If you need to handle uninitialized
/// data, use [`MaybeUninit<T>`] instead.
///
/// Note that accessing the value inside a `ManuallyDrop<T>` is safe. This means
/// that a `ManuallyDrop<T>` whose content has been dropped must not be exposed
/// through a public safe API. Correspondingly, `ManuallyDrop::drop` is unsafe.
///
/// # `ManuallyDrop` and drop order
///
/// Rust has a well-defined [drop order] of values. To make sure that fields or
/// 展开的情况下很难正确实现。
/// 例如，如果希望某个字段在其他字段之后被丢弃，将其设为结构体的最后一个字段：
///
/// It is possible to use `ManuallyDrop` to control the drop order, but this
/// 当满足以下所有条件时需要特别小心：
/// unwinding.
///
/// For example, if you want to make sure that a specific field is dropped after
/// * 结构体或枚举是公共 API 的一部分，或存储在属于公共 API 的结构体或
///
/// ```
/// struct Context;
///
/// struct Widget {
///     children: Vec<Widget>,
///     // `context` will be dropped after `children`.
///     // Rust guarantees that fields are dropped in the order of declaration.
///     context: Context,
/// }
/// ```
///
/// # Safety hazards when storing `ManuallyDrop` in a struct or an enum.
///
/// Special care is needed when all of the conditions below are met:
/// * A struct or enum contains a `ManuallyDrop`.
/// * The `ManuallyDrop` is not inside a `union`.
/// * The struct or enum is part of public API, or is stored in a struct or an
///   enum that is part of public API.
/// * There is a _safe_ function that drops the contents of the `ManuallyDrop`
///   field, and it can be called outside the struct or enum's `Drop` implementation.
///
/// In particular, deriving `Debug`, `Clone`, `PartialEq`, `PartialOrd`, `Ord`,
/// or `Hash` on the struct or enum could be unsound, since the derived
/// implementations of these traits would access the `ManuallyDrop` field.
///
/// For example, in the following code, `derive(Debug)` is unsound in combination
/// with the `ManuallyDrop::drop` call in `Foo::new`:
///
/// ```no_run
/// # use std::mem::ManuallyDrop;
/// #[derive(Debug)]
/// pub struct Foo {
///     /// Invariant: this value may have been dropped!
///     value: ManuallyDrop<String>,
/// }
/// impl Foo {
///     pub fn new() -> Self {
///         let mut temp = Self {
///             value: ManuallyDrop::new(String::from("Unsafe rust is hard."))
///         };
///         unsafe {
///             // SAFETY: `value` hasn't been dropped yet.
///             ManuallyDrop::drop(&mut temp.value);
///         }
///         temp
///     }
/// }
/// ```
///
/// As one could use the `Debug` implementation to access an already dropped
/// field:
///
/// ```rust,ignore (uses-type-from-separate-snippet)
/// let foo = Foo::new();
/// println!("{foo:?}"); // Undefined behavior!
/// ```
///
/// Note that similar unsoundness can arise without `derive`. The cause of the
/// unsoundness are public APIs which allow to access an already dropped value
/// inside `ManuallyDrop`.
///
/// # Pre-`1.96` Interaction with `Box`
///
/// Before Rust `1.96.0`, if you had a `ManuallyDrop<T>`, where the type `T`
/// was a `Box` or contained a `Box` inside, then dropping the `T` followed by
/// moving the `ManuallyDrop<T>` was [considered to be undefined
/// behavior](https://github.com/rust-lang/unsafe-code-guidelines/issues/245).
/// 也就是说，以下代码会导致未定义行为：
///
/// ```no_run
/// use std::mem::ManuallyDrop;
///
/// let mut x = ManuallyDrop::new(Box::new(42));
/// unsafe {
///     ManuallyDrop::drop(&mut x);
/// }
/// let y = x; // Undefined behavior! (pre 1.96.0)
/// ```
///
/// Note that this could also have happen with a generic type where the user of
/// the library providing it could substitute the generic for a `Box<_>` and
/// 并包裹该值以便手动移除。
///
/// ```no_run
/// use std::mem::ManuallyDrop;
///
/// pub struct BadOption<T> {
///     // Invariant: Has been dropped if `is_some` is false.
///     value: ManuallyDrop<T>,
///     is_some: bool,
/// }
/// impl<T> BadOption<T> {
///     pub fn new(value: T) -> Self {
///         Self { value: ManuallyDrop::new(value), is_some: true }
///     }
///     pub fn change_to_none(&mut self) {
///         if self.is_some {
///             self.is_some = false;
///             unsafe {
///                 // SAFETY: `value` hasn't been dropped yet, as per the invariant
///                 // (This is actually unsound pre rust 1.96.0!)
///                 ManuallyDrop::drop(&mut self.value);
///             }
///         }
///     }
/// }
///
/// // In another crate:
///
/// let mut option = BadOption::new(Box::new(42));
/// option.change_to_none();
/// let option2 = option; // Undefined behavior! (pre 1.96)
/// ```
///
/// [drop order]: https://doc.rust-lang.org/reference/destructors.html
/// [`mem::zeroed`]: crate::mem::zeroed
/// [`MaybeUninit<T>`]: crate::mem::MaybeUninit
/// [`MaybeUninit`]: crate::mem::MaybeUninit
#[stable(feature = "manually_drop", since = "1.20.0")]
#[lang = "manually_drop"]
#[derive(Copy, Clone, Debug, Default, PartialEq, Eq, PartialOrd, Ord, Hash)]
#[repr(transparent)]
#[rustc_pub_transparent]
pub struct ManuallyDrop<T: ?Sized> {
    value: T,
}

impl<T> ManuallyDrop<T> {
    /// 将值包装起来以便手动移除。
    ///
    /// # 示例
    ///
    /// ```rust
    /// use std::mem::ManuallyDrop;
    /// let mut x = ManuallyDrop::new(String::from("Hello World!"));
    /// x.truncate(5); // You can still safely operate on the value
    /// assert_eq!(*x, "Hello");
    /// // But `Drop` will not be run here
    /// # // FIXME(https://github.com/rust-lang/miri/issues/3670):
    /// # // use -Zmiri-disable-leak-check instead of unleaking in tests meant to leak.
    /// # let _ = ManuallyDrop::into_inner(x);
    /// ```
    #[must_use = "if you don't need the wrapper, you can use `mem::forget` instead"]
    #[stable(feature = "manually_drop", since = "1.20.0")]
    #[rustc_const_stable(feature = "const_manually_drop", since = "1.32.0")]
    #[inline(always)]
    #[rustc_no_writable]
    pub const fn new(value: T) -> ManuallyDrop<T> {
        ManuallyDrop { value }
    }

    /// Extracts the value from the `ManuallyDrop` container.
    ///
    /// 这允许再次移除该值。
    ///
    /// # 示例
    ///
    /// ```rust
    /// use std::mem::ManuallyDrop;
    /// let x = ManuallyDrop::new(Box::new(()));
    /// let _: Box<()> = ManuallyDrop::into_inner(x); // This drops the `Box`.
    /// ```
    #[stable(feature = "manually_drop", since = "1.20.0")]
    #[rustc_const_stable(feature = "const_manually_drop", since = "1.32.0")]
    #[inline(always)]
    pub const fn into_inner(slot: ManuallyDrop<T>) -> T {
        slot.value
    }

    /// Takes the value from the `ManuallyDrop<T>` container out.
    ///
    /// 该方法主要用于在移除时取出值。
    /// Instead of using [`ManuallyDrop::drop`] to manually drop the value,
    /// 你可以使用此方法取出值并按需使用它。
    ///
    /// Whenever possible, it is preferable to use [`into_inner`][`ManuallyDrop::into_inner`]
    /// instead, which prevents duplicating the content of the `ManuallyDrop<T>`.
    ///
    /// # 安全性
    ///
    /// 此函数从语义上移出包含的值，而不阻止进一步使用，
    /// 使该容器的状态保持不变。
    /// It is your responsibility to ensure that this `ManuallyDrop` is not used again.
    ///
    #[must_use = "if you don't need the value, you can use `ManuallyDrop::drop` instead"]
    #[stable(feature = "manually_drop_take", since = "1.42.0")]
    #[rustc_const_unstable(feature = "const_manually_drop_take", issue = "148773")]
    #[inline]
    pub const unsafe fn take(slot: &mut ManuallyDrop<T>) -> T {
        // SAFETY: we are reading from a reference, which is guaranteed
        // to be valid for reads.
        unsafe { ptr::read(&slot.value) }
    }
}

impl<T: ?Sized> ManuallyDrop<T> {
    /// 手动移除包含的值。
    ///
    /// This is exactly equivalent to calling [`ptr::drop_in_place`] with a
    /// 指向包含值的指针。因此，除非包含值是一个
    /// 打包结构体，否则析构函数将直接调用而不移动值，
    /// 从而可以安全地移除 [固定] 数据。
    ///
    /// If you have ownership of the value, you can use [`ManuallyDrop::into_inner`] instead.
    ///
    /// # 安全性
    ///
    /// 此函数执行包含值的析构操作。除了析构函数本身所做的更改外，内存保持不变，因此就编译器而言，
    /// the destructor itself, the memory is left unchanged, and so as far as the compiler is
    /// concerned still holds a bit-pattern which is valid for the type `T`.
    ///
    /// 不应被调用超过一次。在移除后继续使用值或多次移除值
    /// should not be called more than once. To use a value after it's been dropped, or drop
    /// a value multiple times, can cause Undefined Behavior (depending on what `drop` does).
    /// This is normally prevented by the type system, but users of `ManuallyDrop` must
    /// uphold those guarantees without assistance from the compiler.
    ///
    /// [pinned]: crate::pin
    #[stable(feature = "manually_drop", since = "1.20.0")]
    #[inline]
    #[rustc_const_unstable(feature = "const_drop_in_place", issue = "109342")]
    pub const unsafe fn drop(slot: &mut ManuallyDrop<T>)
    where
        T: [const] Destruct,
    {
        // SAFETY: we are dropping the value pointed to by a mutable reference
        // which is guaranteed to be valid for writes.
        // It is up to the caller to make sure that `slot` isn't dropped again.
        unsafe { ptr::drop_in_place(&mut slot.value) }
    }
}

#[stable(feature = "manually_drop", since = "1.20.0")]
#[rustc_const_unstable(feature = "const_convert", issue = "143773")]
const impl<T: ?Sized> Deref for ManuallyDrop<T> {
    type Target = T;
    #[inline(always)]
    fn deref(&self) -> &T {
        &self.value
    }
}

#[stable(feature = "manually_drop", since = "1.20.0")]
#[rustc_const_unstable(feature = "const_convert", issue = "143773")]
const impl<T: ?Sized> DerefMut for ManuallyDrop<T> {
    #[inline(always)]
    fn deref_mut(&mut self) -> &mut T {
        &mut self.value
    }
}

#[unstable(feature = "deref_pure_trait", issue = "87121")]
unsafe impl<T: ?Sized> DerefPure for ManuallyDrop<T> {}
