//! 表示类型基本属性的原始 trait 和类型。
//!
//! 根据
//! 它们的内在属性，Rust 类型可以以多种有用的方式进行分类。这些分类被表示为
//! trait。

#![stable(feature = "rust1", since = "1.0.0")]

mod variance;

#[unstable(feature = "phantom_variance_markers", issue = "135806")]
pub use self::variance::{
    PhantomContravariant, PhantomContravariantLifetime, PhantomCovariant, PhantomCovariantLifetime,
    PhantomInvariant, PhantomInvariantLifetime, Variance, variance,
};
use crate::cell::UnsafeCell;
use crate::clone::TrivialClone;
use crate::cmp;
use crate::fmt::Debug;
use crate::hash::{Hash, Hasher};
use crate::pin::UnsafePinned;

// NOTE: for consistent error messages between `core` and `minicore`, all `diagnostic` attributes
// should be replicated exactly in `minicore` (if `minicore` defines the item).

/// 同时为多个类型实现给定的 marker trait。
///
/// 基本语法如下：
/// ```ignore private macro
/// marker_impls! { MarkerTrait for u8, i8 }
/// ```
/// You can also implement `unsafe` traits
/// ```ignore private macro
/// marker_impls! { unsafe MarkerTrait for u8, i8 }
/// ```
/// 在所有 impl 中添加属性：
/// ```ignore private macro
/// marker_impls! {
///     #[allow(lint)]
///     #[unstable(feature = "marker_trait", issue = "none")]
///     MarkerTrait for u8, i8
/// }
/// ```
/// 并使用泛型：
/// ```ignore private macro
/// marker_impls! {
///     MarkerTrait for
///         u8, i8,
///         {T: PointeeSized} *const T,
///         {T: PointeeSized} *mut T,
///         {T: MarkerTrait} PhantomData<T>,
///         u32,
/// }
/// ```
macro marker_impls {
    ( $(#[$($meta:tt)*])* $Trait:ident for $({$($bounds:tt)*})? $T:ty $(, $($rest:tt)*)? ) => {
        $(#[$($meta)*])* impl< $($($bounds)*)? > $Trait for $T {}
        marker_impls! { $(#[$($meta)*])* $Trait for $($($rest)*)? }
    },
    ( $(#[$($meta:tt)*])* $Trait:ident for ) => {},

    ( $(#[$($meta:tt)*])* unsafe $Trait:ident for $({$($bounds:tt)*})? $T:ty $(, $($rest:tt)*)? ) => {
        $(#[$($meta)*])* unsafe impl< $($($bounds)*)? > $Trait for $T {}
        marker_impls! { $(#[$($meta)*])* unsafe $Trait for $($($rest)*)? }
    },
    ( $(#[$($meta:tt)*])* unsafe $Trait:ident for ) => {},
}

/// 可以在线程边界之间传递的类型。
///
/// 当编译器确定合适时，此 trait 会自动实现。
/// appropriate.
///
/// An example of a non-`Send` type is the reference-counting pointer
/// [`rc::Rc`][`Rc`]. If two threads attempt to clone [`Rc`]s that point to the same
/// reference-counted value, they might try to update the reference count at the
/// same time, which is [undefined behavior][ub] because [`Rc`] doesn't use atomic
/// operations. Its cousin [`sync::Arc`][arc] does use atomic operations (incurring
/// some overhead) and thus is `Send`.
///
/// See [the Nomicon](../../nomicon/send-and-sync.html) and the [`Sync`] trait for more details.
///
/// [`Rc`]: ../../std/rc/struct.Rc.html
/// [arc]: ../../std/sync/struct.Arc.html
/// [ub]: ../../reference/behavior-considered-undefined.html
#[stable(feature = "rust1", since = "1.0.0")]
#[lang = "send"]
#[rustc_diagnostic_item = "Send"]
#[diagnostic::on_unimplemented(
    message = "`{Self}` cannot be sent between threads safely",
    label = "`{Self}` cannot be sent between threads safely"
)]
pub unsafe auto trait Send {
    // empty.
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T: PointeeSized> !Send for *const T {}
#[stable(feature = "rust1", since = "1.0.0")]
impl<T: PointeeSized> !Send for *mut T {}

// Most instances arise automatically, but this instance is needed to link up `T: Sync` with
// `&T: Send` (and it also removes the unsound default instance `T Send` -> `&T: Send` that would
// otherwise exist).
#[stable(feature = "rust1", since = "1.0.0")]
unsafe impl<T: Sync + PointeeSized> Send for &T {}

/// 在编译时已知固定大小的类型。
///
/// All type parameters have an implicit bound of `Sized`. The special syntax
/// `?Sized` can be used to remove this bound if it's not appropriate.
///
/// ```
/// # #![allow(dead_code)]
/// struct Foo<T>(T);
/// struct Bar<T: ?Sized>(T);
///
/// // struct FooUse(Foo<[i32]>); // error: Sized is not implemented for [i32]
/// struct BarUse(Bar<[i32]>); // OK
/// ```
///
/// The one exception is the implicit `Self` type of a trait. A trait does not
/// have an implicit `Sized` bound as this is incompatible with [trait object]s
/// 根据定义，trait 需要与所有可能的实现者一起工作，
/// 因此可以是任意大小。
///
/// Although Rust will let you bind `Sized` to a trait, you won't
/// 之后使用它来形成 trait object：
///
/// ```
/// # #![allow(unused_variables)]
/// trait Foo { }
/// trait Bar: Sized { }
///
/// struct Impl;
/// impl Foo for Impl { }
/// impl Bar for Impl { }
///
/// let x: &dyn Foo = &Impl;    // OK
/// // let y: &dyn Bar = &Impl; // error: the trait `Bar` cannot be made into an object
/// ```
///
/// [trait object]: ../../book/ch17-02-trait-objects.html
#[doc(alias = "?", alias = "?Sized")]
#[stable(feature = "rust1", since = "1.0.0")]
#[lang = "sized"]
#[diagnostic::on_unimplemented(
    message = "the size for values of type `{Self}` cannot be known at compilation time",
    label = "doesn't have a size known at compile-time"
)]
#[fundamental] // for Default, for example, which requires that `[T]: !Default` be evaluatable
#[rustc_specialization_trait]
#[rustc_deny_explicit_impl]
#[rustc_dyn_incompatible_trait]
// `Sized` being coinductive, despite having supertraits, is okay as there are no user-written impls,
// and we know that the supertraits are always implemented if the subtrait is just by looking at
// the builtin impls.
#[rustc_coinductive]
pub trait Sized: MetaSized {
    // Empty.
}

/// 可以从指针元数据确定大小的类型。
#[unstable(feature = "sized_hierarchy", issue = "144404")]
#[lang = "meta_sized"]
#[diagnostic::on_unimplemented(
    message = "the size for values of type `{Self}` cannot be known",
    label = "doesn't have a known size"
)]
#[fundamental]
#[rustc_specialization_trait]
#[rustc_deny_explicit_impl]
// `MetaSized` being coinductive, despite having supertraits, is okay for the same reasons as
// `Sized` above.
#[rustc_coinductive]
pub trait MetaSized: PointeeSized {
    // Empty
}

/// 可能有或没有大小的类型。
#[unstable(feature = "sized_hierarchy", issue = "144404")]
#[lang = "pointee_sized"]
#[diagnostic::on_unimplemented(
    message = "values of type `{Self}` may or may not have a size",
    label = "may or may not have a known size"
)]
#[fundamental]
#[rustc_specialization_trait]
#[rustc_deny_explicit_impl]
#[rustc_coinductive]
pub trait PointeeSized {
    // Empty
}

/// 可以“无大小”为动态大小类型的类型。
///
/// For example, the sized array type `[i8; 2]` implements `Unsize<[i8]>` and
/// `Unsize<dyn fmt::Debug>`.
///
/// All implementations of `Unsize` are provided automatically by the compiler.
/// 这些实现包括：
///
/// - Arrays `[T; N]` implement `Unsize<[T]>`.
/// - A type implements `Unsize<dyn Trait + 'a>` if all of these conditions are met:
///   - The type implements `Trait`.
///   - `Trait` is dyn-compatible[^1].
/// - 该类型有大小。
///   - The type outlives `'a`.
/// - Trait objects `dyn TraitA + AutoA... + 'a` implement `Unsize<dyn TraitB + AutoB... + 'b>`
/// 如果满足以下所有条件：
///   - `TraitB` is a supertrait of `TraitA`.
///   - `AutoB...` is a subset of `AutoA...`.
///   - `'a` outlives `'b`.
/// - Structs `Foo<..., T1, ..., Tn, ...>` implement `Unsize<Foo<..., U1, ..., Un, ...>>`
/// 只要满足以下所有条件，就可以更改任意数量的（类型和常量）参数：
/// 这些条件：
///   - Only the last field of `Foo` has a type involving the parameters `T1`, ..., `Tn`.
/// - Struct 的其他所有参数都是相同的。
///   - `Field<T1, ..., Tn>: Unsize<Field<U1, ..., Un>>`, where `Field<...>` stands for the actual
/// struct 最后一个字段的实际类型。
///
/// `Unsize` is used along with [`ops::CoerceUnsized`] to allow
/// "user-defined" containers such as [`Rc`] to contain dynamically-sized
/// 类型。更多细节请参见 [DST coercion RFC][RFC982] 和 [nomicon-coerce]
/// 条目。
///
/// [`ops::CoerceUnsized`]: crate::ops::CoerceUnsized
/// [`Rc`]: ../../std/rc/struct.Rc.html
/// [RFC982]: https://rust-lang.github.io/rfcs/0982-dst-coercion.html
/// [nomicon-coerce]: ../../nomicon/coercions.html
/// [^1]: Formerly known as *object safe*.
#[unstable(feature = "unsize", issue = "18598")]
#[lang = "unsize"]
#[rustc_deny_explicit_impl]
#[rustc_dyn_incompatible_trait]
pub trait Unsize<T: PointeeSized>: PointeeSized {
    // Empty.
}

/// 用于模式匹配中的常量所需的 trait。
///
/// 如果满足 (a) 其类型实现了
/// `PartialEq`, and (b) interpreting the value of the constant as a pattern
/// is equivalent to calling `PartialEq`. This ensures that constants used as
/// 模式的常量不会以意外的方式暴露实现细节或
/// 导致 semver 风险。
///
/// 此 trait 确保点 (b)。
/// Any type that derives `PartialEq` automatically implements this trait.
///
/// 实现此 trait（不稳定）是类型作者允许
/// 比较该类型的 const 值的一种方式；该操作会递归地比较所有字段
/// (including private fields), even if that behavior differs from `PartialEq`. This can make it
/// 破坏 semver 规范，因为向类型添加更多私有字段。
#[unstable(feature = "structural_match", issue = "31434")]
#[diagnostic::on_unimplemented(message = "the type `{Self}` does not `#[derive(PartialEq)]`")]
#[lang = "structural_peq"]
pub trait StructuralPartialEq {
    // Empty.
}

marker_impls! {
    #[unstable(feature = "structural_match", issue = "31434")]
    StructuralPartialEq for
        usize, u8, u16, u32, u64, u128,
        isize, i8, i16, i32, i64, i128,
        bool,
        char,
        str /* Technically requires `[u8]: StructuralPartialEq` */,
        (),
        {T, const N: usize} [T; N],
        {T} [T],
        {T: PointeeSized} &T,
}

/// 其值可以通过复制位来重复的类型。
///
/// 默认情况下，变量绑定具有“移动语义”。换句话说：
/// words:
///
/// ```
/// #[derive(Debug)]
/// struct Foo;
///
/// let x = Foo;
///
/// let y = x;
///
/// // `x` has moved into `y`, and so cannot be used
///
/// // println!("{x:?}"); // error: use of moved value
/// ```
///
/// However, if a type implements `Copy`, it instead has 'copy semantics':
///
/// ```
/// // We can derive a `Copy` implementation. `Clone` is also required, as it's
/// // a supertrait of `Copy`.
/// #[derive(Debug, Copy, Clone)]
/// struct Foo;
///
/// let x = Foo;
///
/// let y = x;
///
/// // `y` is a copy of `x`
///
/// println!("{x:?}"); // A-OK!
/// ```
///
/// 需要注意的是，在这两个示例中，唯一的区别在于你是否
/// are allowed to access `x` after the assignment. Under the hood, both a copy and a move
/// 都可能在内存中复制位，尽管有时会被优化掉。
///
/// ## How can I implement `Copy`?
///
/// There are two ways to implement `Copy` on your type. The simplest is to use `derive`:
///
/// ```
/// #[derive(Copy, Clone)]
/// struct MyStruct;
/// ```
///
/// You can also implement `Copy` and `Clone` manually:
///
/// ```
/// struct MyStruct;
///
/// impl Copy for MyStruct { }
///
/// impl Clone for MyStruct {
///     fn clone(&self) -> MyStruct {
///         *self
///     }
/// }
/// ```
///
/// There is a small difference between the two. The `derive` strategy will also place a `Copy`
/// 限制：
///
/// ```
/// #[derive(Clone)]
/// struct MyStruct<T>(T);
///
/// impl<T: Copy> Copy for MyStruct<T> { }
/// ```
///
/// This isn't always desired. For example, shared references (`&T`) can be copied regardless of
/// whether `T` is `Copy`. Likewise, a generic struct containing markers such as [`PhantomData`]
/// 潜在的复制方式包括位运算复制。
///
/// ## What's the difference between `Copy` and `Clone`?
///
/// Copies happen implicitly, for example as part of an assignment `y = x`. The behavior of
/// `Copy` is not overloadable; it is always a simple bit-wise copy.
///
/// Cloning is an explicit action, `x.clone()`. The implementation of [`Clone`] can
/// provide any type-specific behavior necessary to duplicate values safely. For example,
/// the implementation of [`Clone`] for [`String`] needs to copy the pointed-to string
/// buffer in the heap. A simple bitwise copy of [`String`] values would merely copy the
/// pointer, leading to a double free down the line. For this reason, [`String`] is [`Clone`]
/// but not `Copy`.
///
/// [`Clone`] is a supertrait of `Copy`, so everything which is `Copy` must also implement
/// [`Clone`]. If a type is `Copy` then its [`Clone`] implementation only needs to return `*self`
/// (see the example above).
///
/// ## When can my type be `Copy`?
///
/// A type can implement `Copy` if all of its components implement `Copy`. For example, this
/// struct can be `Copy`:
///
/// ```
/// # #[allow(dead_code)]
/// #[derive(Copy, Clone)]
/// struct Point {
///    x: i32,
///    y: i32,
/// }
/// ```
///
/// A struct can be `Copy`, and [`i32`] is `Copy`, therefore `Point` is eligible to be `Copy`.
/// 相反，考虑以下情况：
///
/// ```
/// # #![allow(dead_code)]
/// # struct Point;
/// struct PointList {
///     points: Vec<Point>,
/// }
/// ```
///
/// The struct `PointList` cannot implement `Copy`, because [`Vec<T>`] is not `Copy`. If we
/// attempt to derive a `Copy` implementation, we'll get an error:
///
/// ```text
/// the trait `Copy` cannot be implemented for this type; field `points` does not implement `Copy`
/// ```
///
/// Shared references (`&T`) are also `Copy`, so a type can be `Copy`, even when it holds
/// shared references of types `T` that are *not* `Copy`. Consider the following struct,
/// which can implement `Copy`, because it only holds a *shared reference* to our non-`Copy`
/// type `PointList` from above:
///
/// ```
/// # #![allow(dead_code)]
/// # struct PointList;
/// #[derive(Copy, Clone)]
/// struct PointListWrapper<'a> {
///     point_list_ref: &'a PointList,
/// }
/// ```
///
/// ## When *can't* my type be `Copy`?
///
/// Some types can't be copied safely. For example, copying `&mut T` would create an aliased
/// mutable reference. Copying [`String`] would duplicate responsibility for managing the
/// [`String`]'s buffer, leading to a double free.
///
/// Generalizing the latter case, any type implementing [`Drop`] can't be `Copy`, because it's
/// managing some resource besides its own [`size_of::<T>`] bytes.
///
/// If you try to implement `Copy` on a struct or enum containing non-`Copy` data, you will get
/// 错误 [E0204]。
///
/// [E0204]: ../../error_codes/E0204.html
///
/// ## When *should* my type be `Copy`?
///
/// Generally speaking, if your type _can_ implement `Copy`, it should. Keep in mind, though,
/// that implementing `Copy` is part of the public API of your type. If the type might become
/// non-`Copy` in the future, it could be prudent to omit the `Copy` implementation now, to
/// 避免破坏性的 API 变更。
///
/// ## 其他实现者
///
/// 除了[下面列出的实现者][impls]之外，
/// the following types also implement `Copy`:
///
/// * 函数项类型（即为每个函数定义的独立类型）
/// * Function pointer types (e.g., `fn() -> i32`)
/// * 闭包类型，如果它们不捕获来自环境的任何值
///   or if all such captured values implement `Copy` themselves.
///   Note that variables captured by shared reference always implement `Copy`
/// （即使引用对象不是），
///   while variables captured by mutable reference never implement `Copy`.
///
/// [`Vec<T>`]: ../../std/vec/struct.Vec.html
/// [`String`]: ../../std/string/struct.String.html
/// [`size_of::<T>`]: size_of
/// [impls]: #implementors
#[stable(feature = "rust1", since = "1.0.0")]
#[lang = "copy"]
#[rustc_diagnostic_item = "Copy"]
pub trait Copy: Clone {
    // Empty.
}

/// Derive macro generating an impl of the trait `Copy`.
#[rustc_builtin_macro]
#[stable(feature = "builtin_macro_prelude", since = "1.38.0")]
#[allow_internal_unstable(core_intrinsics, derive_clone_copy_internals)]
pub macro Copy($item:item) {
    /* compiler built-in */
}

// Implementations of `Copy` for primitive types.
//
// Implementations that cannot be described in Rust
// are implemented in `traits::SelectionContext::copy_clone_conditions()`
// in `rustc_trait_selection`.
marker_impls! {
    #[stable(feature = "rust1", since = "1.0.0")]
    Copy for
        usize, u8, u16, u32, u64, u128,
        isize, i8, i16, i32, i64, i128,
        f16, f32, f64, f128,
        bool, char,
        {T: PointeeSized} *const T,
        {T: PointeeSized} *mut T,

}

#[stable(feature = "never_type", since = "1.100.0")]
impl Copy for ! {}

/// 共享引用可以被复制，但可变引用*不能*！
#[stable(feature = "rust1", since = "1.0.0")]
impl<T: PointeeSized> Copy for &T {}

/// 用于允许在联合字段中使用的类型和 unsafe
/// 绑定器的标记 trait。
///
/// 适用于：
/// * `&T`, `&mut T` for all `T`,
/// * `ManuallyDrop<T>` for all `T`,
/// * tuples and arrays whose elements implement `BikeshedGuaranteedNoDrop`,
/// * or otherwise, all types that are `Copy`.
///
/// 值得注意的是，这不包括所有因 semver
/// 原因而可以轻易析构的类型。
///
/// 目前称为 Bikeshed 名称。此 trait 的作用仅仅是反映
/// 在字段有效性中允许的类型集合。
#[unstable(feature = "bikeshed_guaranteed_no_drop", issue = "none")]
#[lang = "bikeshed_guaranteed_no_drop"]
#[rustc_deny_explicit_impl]
#[rustc_dyn_incompatible_trait]
#[doc(hidden)]
pub trait BikeshedGuaranteedNoDrop {}

/// 在线程之间共享引用是安全的类型。
///
/// 当编译器确定
/// 合适时，此 trait 会自动实现。
///
/// The precise definition is: a type `T` is [`Sync`] if and only if `&T` is
/// [`Send`]. In other words, if there is no possibility of
/// [未定义行为][ub]（包括数据竞争）在线程之间传递
/// `&T` references between threads.
///
/// As one would expect, primitive types like [`u8`] and [`f64`]
/// are all [`Sync`], and so are simple aggregate types containing them,
/// like tuples, structs and enums. More examples of basic [`Sync`]
/// types include "immutable" types like `&T`, and those with simple
/// inherited mutability, such as [`Box<T>`][box], [`Vec<T>`][vec] and
/// most other collection types. (Generic parameters need to be [`Sync`]
/// for their container to be [`Sync`].)
///
/// A somewhat surprising consequence of the definition is that `&mut T`
/// is `Sync` (if `T` is `Sync`) even though it seems like that might
/// 提供非同步的修改。诀窍在于一个可变的
/// reference behind a shared reference (that is, `& &mut T`)
/// becomes read-only, as if it were a `& &T`. Hence there is no risk
/// of a data race.
///
/// A shorter overview of how [`Sync`] and [`Send`] relate to referencing:
/// * `&T` is [`Send`] if and only if `T` is [`Sync`]
/// * `&mut T` is [`Send`] if and only if `T` is [`Send`]
/// * `&T` and `&mut T` are [`Sync`] if and only if `T` is [`Sync`]
///
/// Types that are not `Sync` are those that have "interior
/// mutability" in a non-thread-safe form, such as [`Cell`][cell]
/// and [`RefCell`][refcell]. These types allow for mutation of
/// 它们的内容。对于
/// example the `set` method on [`Cell<T>`][cell] takes `&self`, so it requires
/// only a shared reference [`&Cell<T>`][cell]. The method performs no
/// synchronization, thus [`Cell`][cell] cannot be `Sync`.
///
/// Another example of a non-`Sync` type is the reference-counting
/// pointer [`Rc`][rc]. Given any reference [`&Rc<T>`][rc], you can clone
/// a new [`Rc<T>`][rc], modifying the reference counts in a non-atomic way.
///
/// 对于确实需要线程安全的内部可变性的情况，
/// Rust 提供了 [原子数据类型]，以及通过
/// [`sync::Mutex`][mutex] and [`sync::RwLock`][rwlock]. These types
/// 确保任何修改都不会导致数据竞争，因此这些类型
/// are `Sync`. Likewise, [`sync::Arc`][arc] provides a thread-safe
/// analogue of [`Rc`][rc].
///
/// 任何具有内部可性的类型还必须使用
/// [`cell::UnsafeCell`][unsafecell] wrapper around the value(s) which
/// 可以通过共享引用进行修改。不这样做是
/// [undefined behavior][ub]. For example, [`transmute`][transmute]-ing
/// from `&T` to `&mut T` is invalid.
///
/// See [the Nomicon][nomicon-send-and-sync] for more details about `Sync`.
///
/// [box]: ../../std/boxed/struct.Box.html
/// [vec]: ../../std/vec/struct.Vec.html
/// [cell]: crate::cell::Cell
/// [refcell]: crate::cell::RefCell
/// [rc]: ../../std/rc/struct.Rc.html
/// [arc]: ../../std/sync/struct.Arc.html
/// [atomic data types]: crate::sync::atomic
/// [mutex]: ../../std/sync/struct.Mutex.html
/// [rwlock]: ../../std/sync/struct.RwLock.html
/// [unsafecell]: crate::cell::UnsafeCell
/// [ub]: ../../reference/behavior-considered-undefined.html
/// [transmute]: crate::mem::transmute
/// [nomicon-send-and-sync]: ../../nomicon/send-and-sync.html
#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_diagnostic_item = "Sync"]
#[lang = "sync"]
#[rustc_on_unimplemented(
    on(
        Self = "core::cell::once::OnceCell<T>",
        note = "if you want to do aliasing and mutation between multiple threads, use `std::sync::OnceLock` instead"
    ),
    on(
        Self = "core::cell::Cell<u8>",
        note = "if you want to do aliasing and mutation between multiple threads, use `std::sync::RwLock` or `std::sync::atomic::AtomicU8` instead",
    ),
    on(
        Self = "core::cell::Cell<u16>",
        note = "if you want to do aliasing and mutation between multiple threads, use `std::sync::RwLock` or `std::sync::atomic::AtomicU16` instead",
    ),
    on(
        Self = "core::cell::Cell<u32>",
        note = "if you want to do aliasing and mutation between multiple threads, use `std::sync::RwLock` or `std::sync::atomic::AtomicU32` instead",
    ),
    on(
        Self = "core::cell::Cell<u64>",
        note = "if you want to do aliasing and mutation between multiple threads, use `std::sync::RwLock` or `std::sync::atomic::AtomicU64` instead",
    ),
    on(
        Self = "core::cell::Cell<usize>",
        note = "if you want to do aliasing and mutation between multiple threads, use `std::sync::RwLock` or `std::sync::atomic::AtomicUsize` instead",
    ),
    on(
        Self = "core::cell::Cell<i8>",
        note = "if you want to do aliasing and mutation between multiple threads, use `std::sync::RwLock` or `std::sync::atomic::AtomicI8` instead",
    ),
    on(
        Self = "core::cell::Cell<i16>",
        note = "if you want to do aliasing and mutation between multiple threads, use `std::sync::RwLock` or `std::sync::atomic::AtomicI16` instead",
    ),
    on(
        Self = "core::cell::Cell<i32>",
        note = "if you want to do aliasing and mutation between multiple threads, use `std::sync::RwLock` or `std::sync::atomic::AtomicI32` instead",
    ),
    on(
        Self = "core::cell::Cell<i64>",
        note = "if you want to do aliasing and mutation between multiple threads, use `std::sync::RwLock` or `std::sync::atomic::AtomicI64` instead",
    ),
    on(
        Self = "core::cell::Cell<isize>",
        note = "if you want to do aliasing and mutation between multiple threads, use `std::sync::RwLock` or `std::sync::atomic::AtomicIsize` instead",
    ),
    on(
        Self = "core::cell::Cell<bool>",
        note = "if you want to do aliasing and mutation between multiple threads, use `std::sync::RwLock` or `std::sync::atomic::AtomicBool` instead",
    ),
    on(
        all(
            Self = "core::cell::Cell<T>",
            not(Self = "core::cell::Cell<u8>"),
            not(Self = "core::cell::Cell<u16>"),
            not(Self = "core::cell::Cell<u32>"),
            not(Self = "core::cell::Cell<u64>"),
            not(Self = "core::cell::Cell<usize>"),
            not(Self = "core::cell::Cell<i8>"),
            not(Self = "core::cell::Cell<i16>"),
            not(Self = "core::cell::Cell<i32>"),
            not(Self = "core::cell::Cell<i64>"),
            not(Self = "core::cell::Cell<isize>"),
            not(Self = "core::cell::Cell<bool>")
        ),
        note = "if you want to do aliasing and mutation between multiple threads, use `std::sync::RwLock`",
    ),
    on(
        Self = "core::cell::RefCell<T>",
        note = "if you want to do aliasing and mutation between multiple threads, use `std::sync::RwLock` instead",
    ),
    message = "`{Self}` cannot be shared between threads safely",
    label = "`{Self}` cannot be shared between threads safely"
)]
pub unsafe auto trait Sync {
    // FIXME(estebank): once support to add notes in `rustc_on_unimplemented`
    // lands in beta, and it has been extended to check whether a closure is
    // anywhere in the requirement chain, extend it as such (#48534):
    // ```
    // on(
    //     closure,
    //     note="`{Self}` cannot be shared safely, consider marking the closure `move`"
    // ),
    // ```

    // Empty
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T: PointeeSized> !Sync for *const T {}
#[stable(feature = "rust1", since = "1.0.0")]
impl<T: PointeeSized> !Sync for *mut T {}

/// Zero-sized type used to mark things that "act like" they own a `T`.
///
/// Adding a `PhantomData<T>` field to your type tells the compiler that your
/// type acts as though it stores a value of type `T`, even though it doesn't
/// 实际上并非如此。此信息用于计算某些安全性属性时。
///
/// For a more in-depth explanation of how to use `PhantomData<T>`, please see
/// [the Nomicon](../../nomicon/phantom-data.html).
///
/// # 一个可怕的注释 👻👻👻
///
/// Though they both have scary names, `PhantomData` and 'phantom types' are
/// 相关的，但并不相同。幽灵类型参数仅仅是一个从未被使用的类型参数。在 Rust 中，这通常会导致编译器
/// parameter which is never used. In Rust, this often causes the compiler to
/// complain, and the solution is to add a "dummy" use by way of `PhantomData`.
///
/// # 未使用的生命周期参数
///
/// ## 未使用的生命周期参数
///
/// Perhaps the most common use case for `PhantomData` is a struct that has an
/// unused lifetime parameter, typically as part of some unsafe code. For
/// example, here is a struct `Slice` that has two pointers of type `*const T`,
/// presumably pointing into an array somewhere:
///
/// ```compile_fail,E0392
/// struct Slice<'a, T> {
///     start: *const T,
///     end: *const T,
/// }
/// ```
///
/// The intention is that the underlying data is only valid for the
/// lifetime `'a`, so `Slice` should not outlive `'a`. However, this
/// intent is not expressed in the code, since there are no uses of
/// the lifetime `'a` and hence it is not clear what data it applies
/// to. We can correct this by telling the compiler to act *as if* the
/// `Slice` struct contained a reference `&'a T`:
///
/// ```
/// use std::marker::PhantomData;
///
/// # #[allow(dead_code)]
/// struct Slice<'a, T> {
///     start: *const T,
///     end: *const T,
///     phantom: PhantomData<&'a T>,
/// }
/// ```
///
/// This also in turn infers the lifetime bound `T: 'a`, indicating
/// that any references in `T` are valid over the lifetime `'a`.
///
/// When initializing a `Slice` you simply provide the value
/// `PhantomData` for the field `phantom`:
///
/// ```
/// # #![allow(dead_code)]
/// # use std::marker::PhantomData;
/// # struct Slice<'a, T> {
/// #     start: *const T,
/// #     end: *const T,
/// #     phantom: PhantomData<&'a T>,
/// # }
/// fn borrow_vec<T>(vec: &Vec<T>) -> Slice<'_, T> {
///     let ptr = vec.as_ptr();
///     Slice {
///         start: ptr,
///         end: unsafe { ptr.add(vec.len()) },
///         phantom: PhantomData,
///     }
/// }
/// ```
///
/// ## Unused type parameters
///
/// It sometimes happens that you have unused type parameters which
/// indicate what type of data a struct is "tied" to, even though that
/// data is not actually found in the struct itself. Here is an
/// example where this arises with [FFI]. The foreign interface uses
/// handles of type `*mut ()` to refer to Rust values of different
/// types. We track the Rust type using a phantom type parameter on
/// the struct `ExternalResource` which wraps a handle.
///
/// [FFI]: ../../book/ch19-01-unsafe-rust.html#using-extern-functions-to-call-external-code
///
/// ```
/// # #![allow(dead_code)]
/// # trait ResType { }
/// # struct ParamType;
/// # mod foreign_lib {
/// #     pub fn new(_: usize) -> *mut () { 42 as *mut () }
/// #     pub fn do_stuff(_: *mut (), _: usize) {}
/// # }
/// # fn convert_params(_: ParamType) -> usize { 42 }
/// use std::marker::PhantomData;
///
/// struct ExternalResource<R> {
///    resource_handle: *mut (),
///    resource_type: PhantomData<R>,
/// }
///
/// impl<R: ResType> ExternalResource<R> {
///     fn new() -> Self {
///         let size_of_res = size_of::<R>();
///         Self {
///             resource_handle: foreign_lib::new(size_of_res),
///             resource_type: PhantomData,
///         }
///     }
///
///     fn do_stuff(&self, param: ParamType) {
///         let foreign_params = convert_params(param);
///         foreign_lib::do_stuff(self.resource_handle, foreign_params);
///     }
/// }
/// ```
///
/// ## Ownership and the drop check
///
/// The exact interaction of `PhantomData` with drop check **may change in the future**.
///
/// Currently, adding a field of type `PhantomData<T>` indicates that your type *owns* data of type
/// `T` in very rare circumstances. This in turn has effects on the Rust compiler's [drop check]
/// analysis. For the exact rules, see the [drop check] documentation.
///
/// ## 布局
///
/// For all `T`, the following are guaranteed:
/// * `size_of::<PhantomData<T>>() == 0`
/// * `align_of::<PhantomData<T>>() == 1`
///
/// [drop check]: Drop#drop-check
#[lang = "phantom_data"]
#[stable(feature = "rust1", since = "1.0.0")]
pub struct PhantomData<T: PointeeSized>;

#[stable(feature = "rust1", since = "1.0.0")]
impl<T: PointeeSized> Hash for PhantomData<T> {
    #[inline]
    fn hash<H: Hasher>(&self, _: &mut H) {}
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T: PointeeSized> cmp::PartialEq for PhantomData<T> {
    fn eq(&self, _other: &PhantomData<T>) -> bool {
        true
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T: PointeeSized> cmp::Eq for PhantomData<T> {}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T: PointeeSized> cmp::PartialOrd for PhantomData<T> {
    fn partial_cmp(&self, _other: &PhantomData<T>) -> Option<cmp::Ordering> {
        Option::Some(cmp::Ordering::Equal)
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T: PointeeSized> cmp::Ord for PhantomData<T> {
    fn cmp(&self, _other: &PhantomData<T>) -> cmp::Ordering {
        cmp::Ordering::Equal
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T: PointeeSized> Copy for PhantomData<T> {}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T: PointeeSized> Clone for PhantomData<T> {
    fn clone(&self) -> Self {
        *self
    }
}

#[doc(hidden)]
#[unstable(feature = "trivial_clone", issue = "none")]
unsafe impl<T: PointeeSized> TrivialClone for PhantomData<T> {}

#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_const_unstable(feature = "const_default", issue = "143894")]
const impl<T: PointeeSized> Default for PhantomData<T> {
    fn default() -> Self {
        Self
    }
}

#[unstable(feature = "structural_match", issue = "31434")]
impl<T: PointeeSized> StructuralPartialEq for PhantomData<T> {}

/// 用于指示枚举区分类型的编译器内部 trait。
///
/// 该 trait 对于每种类型都自动实现，不会增加任何
/// guarantees to [`mem::Discriminant`]. It is **undefined behavior** to transmute
/// between `DiscriminantKind::Discriminant` and `mem::Discriminant`.
///
/// [`mem::Discriminant`]: crate::mem::Discriminant
#[unstable(
    feature = "discriminant_kind",
    issue = "none",
    reason = "this trait is unlikely to ever be stabilized, use `mem::discriminant` instead"
)]
#[lang = "discriminant_kind"]
#[rustc_deny_explicit_impl]
#[rustc_dyn_incompatible_trait]
pub trait DiscriminantKind {
    /// The type of the discriminant, which must satisfy the trait
    /// bounds required by `mem::Discriminant`.
    #[lang = "discriminant_type"]
    type Discriminant: Copy + Debug + Eq + Hash + Ord + Send + Sync + Unpin;
}

/// Used to determine whether a type contains
/// any `UnsafeCell` internally, but not through an indirection.
/// This affects, for example, whether a `static` of that type is
/// # 安全性
/// 该 trait 是语言的核心部分，仅在 libcore 中以 trait 形式表达以方便使用。不要为其他类型实现它。
/// will not contain interior mutability, and subsequently allow
/// placing the constant behind references.
///
/// # 属于不需要任何固定保证的类型。
///
/// This trait is a core part of the language, it is just expressed as a trait in libcore for
/// convenience. Do *not* implement it for other types.
// FIXME: Eventually this trait should become `#[rustc_deny_explicit_impl]`.
// That requires porting the impls below to native internal impls.
#[lang = "freeze"]
#[unstable(feature = "freeze", issue = "121675")]
pub unsafe auto trait Freeze {}

#[unstable(feature = "freeze", issue = "121675")]
impl<T: PointeeSized> !Freeze for UnsafeCell<T> {}
marker_impls! {
    #[unstable(feature = "freeze", issue = "121675")]
    unsafe Freeze for
        {T: PointeeSized} PhantomData<T>,
        {T: PointeeSized} *const T,
        {T: PointeeSized} *mut T,
        {T: PointeeSized} &T,
        {T: PointeeSized} &mut T,
}

/// Used to determine whether a type contains any `UnsafePinned` (or `PhantomPinned`) internally,
/// but not through an indirection. This affects, for example, whether we emit `noalias` metadata
/// for `&mut T` or not.
///
/// This is part of [RFC 3467](https://rust-lang.github.io/rfcs/3467-unsafe-pinned.html), and is
/// tracked by [#125735](https://github.com/rust-lang/rust/issues/125735).
#[lang = "unsafe_unpin"]
#[unstable(feature = "unsafe_unpin", issue = "125735")]
pub unsafe auto trait UnsafeUnpin {}

#[unstable(feature = "unsafe_unpin", issue = "125735")]
impl<T: PointeeSized> !UnsafeUnpin for UnsafePinned<T> {}
marker_impls! {
#[unstable(feature = "unsafe_unpin", issue = "125735")]
    unsafe UnsafeUnpin for
        {T: PointeeSized} PhantomData<T>,
        {T: PointeeSized} *const T,
        {T: PointeeSized} *mut T,
        {T: PointeeSized} &T,
        {T: PointeeSized} &mut T,
        {T: PointeeSized} pattern_type!(*const T is !null),
        {T: PointeeSized} pattern_type!(*mut T is !null),
}

/// 不需要任何固定保证的类型。
///
/// For information on what "pinning" is, see the [`pin` module] documentation.
///
/// Implementing the `Unpin` trait for `T` expresses the fact that `T` is pinning-agnostic:
/// it shall not expose nor rely on any pinning guarantees. This, in turn, means that a
/// `Pin`-wrapped pointer to such a type can feature a *fully unrestricted* API.
/// In other words, if `T: Unpin`, a value of type `T` will *not* be bound by the invariants
/// which pinning otherwise offers, even when "pinned" by a [`Pin<Ptr>`] pointing at it.
/// When a value of type `T` is pointed at by a [`Pin<Ptr>`], [`Pin`] will not restrict access
/// to the pointee value like it normally would, thus allowing the user to do anything that they
/// normally could with a non-[`Pin`]-wrapped `Ptr` to that value.
///
/// The idea of this trait is to alleviate the reduced ergonomics of APIs that require the use
/// of [`Pin`] for soundness for some types, but which also want to be used by other types that
/// don't care about pinning. The prime example of such an API is [`Future::poll`]. There are many
/// [`Future`] types that don't care about pinning. These futures can implement `Unpin` and
/// 因此能够绕过 API 中的固定化相关限制，同时仍然允许
/// subset of [`Future`]s which *do* require pinning to be implemented soundly.
///
/// For more discussion on the consequences of [`Unpin`] within the wider scope of the pinning
/// system, see the [section about `Unpin`] in the [`pin` module].
///
/// `Unpin` has no consequence at all for non-pinned data. In particular, [`mem::replace`] happily
/// moves `!Unpin` data, which would be immovable when pinned ([`mem::replace`] works for any
/// `&mut T`, not just when `T: Unpin`).
///
/// *However*, you cannot use [`mem::replace`] on `!Unpin` data which is *pinned* by being wrapped
/// inside a [`Pin<Ptr>`] pointing at it. This is because you cannot (safely) use a
/// [`Pin<Ptr>`] to get a `&mut T` to its pointee value, which you would need to call
/// [`mem::replace`], and *that* is what makes this system work.
///
/// So this, for example, can only be done on types implementing `Unpin`:
///
/// ```rust
/// # #![allow(unused_must_use)]
/// use std::mem;
/// use std::pin::Pin;
///
/// let mut string = "this".to_string();
/// let mut pinned_string = Pin::new(&mut string);
///
/// // We need a mutable reference to call `mem::replace`.
/// // We can obtain such a reference by (implicitly) invoking `Pin::deref_mut`,
/// // but that is only possible because `String` implements `Unpin`.
/// mem::replace(&mut *pinned_string, "other".to_string());
/// ```
///
/// 对于该类型的实现来说，依赖固定化相关的保证以确保可靠性是不合理的，
/// to take the conservative stance of marking types as [`Unpin`] so long as all of the types that
/// compose its fields are also [`Unpin`]. This is because if a type implements [`Unpin`], then it
/// is unsound for that type's implementation to rely on pinning-related guarantees for soundness,
/// *even* when viewed through a "pinning" pointer! It is the responsibility of the implementor of
/// a type that relies upon pinning for soundness to ensure that type is *not* marked as [`Unpin`]
/// by adding [`PhantomPinned`] field. For more details, see the [`pin` module] docs.
///
/// [`mem::replace`]: crate::mem::replace "mem replace"
/// [`Future`]: crate::future::Future "Future"
/// [`Future::poll`]: crate::future::Future::poll "Future poll"
/// [`Pin`]: crate::pin::Pin "Pin"
/// [`Pin<Ptr>`]: crate::pin::Pin "Pin"
/// [`pin` module]: crate::pin "pin module"
/// [section about `Unpin`]: crate::pin#unpin "pin module docs about unpin"
/// [`unsafe`]: ../../std/keyword.unsafe.html "keyword unsafe"
#[stable(feature = "pin", since = "1.33.0")]
#[diagnostic::on_unimplemented(
    note = "consider using the `pin!` macro\nconsider using `Box::pin` if you need to access the pinned value outside of the current scope",
    message = "`{Self}` cannot be unpinned"
)]
#[lang = "unpin"]
pub auto trait Unpin {}

/// A marker type which does not implement `Unpin`.
///
/// If a type contains a `PhantomPinned`, it will not implement `Unpin` by default.
//
// FIXME(unsafe_pinned): This is *not* a stable guarantee we want to make, at least not yet.
// Note that for backwards compatibility with the new [`UnsafePinned`] wrapper type, placing this
// marker in your struct acts as if you wrapped the entire struct in an `UnsafePinned`. This type
// will likely eventually be deprecated, and all new code should be using `UnsafePinned` instead.
#[stable(feature = "pin", since = "1.33.0")]
#[derive(Debug, Default, Copy, Clone, Eq, PartialEq, Ord, PartialOrd, Hash)]
#[rustc_diagnostic_item = "PhantomPinned"]
pub struct PhantomPinned;

#[stable(feature = "pin", since = "1.33.0")]
impl !Unpin for PhantomPinned {}

// This is a small hack to allow existing code which uses PhantomPinned to opt-out of noalias to
// continue working. Ideally PhantomPinned could just wrap an `UnsafePinned<()>` to get the same
// effect, but we can't add a new field to an already stable unit struct -- that would be a breaking
// change.
#[unstable(feature = "unsafe_unpin", issue = "125735")]
impl !UnsafeUnpin for PhantomPinned {}

marker_impls! {
    #[stable(feature = "pin", since = "1.33.0")]
    Unpin for
        {T: PointeeSized} &T,
        {T: PointeeSized} &mut T,
}

marker_impls! {
    #[stable(feature = "pin_raw", since = "1.38.0")]
    Unpin for
        {T: PointeeSized} *const T,
        {T: PointeeSized} *mut T,
}

/// 该 trait 的实现是内置的，无法为任何用户类型实现。
///
/// This should be used for `[const]` bounds,
/// 因为非常量边界对每种类型都是存在的。
#[unstable(feature = "const_destruct", issue = "133214")]
#[rustc_const_unstable(feature = "const_destruct", issue = "133214")]
#[lang = "destruct"]
#[diagnostic::on_unimplemented(message = "can't drop `{Self}`")]
#[rustc_deny_explicit_impl]
#[rustc_dyn_incompatible_trait]
pub const trait Destruct: PointeeSized {}

/// 一个用于元组类型的标记。
///
/// 该 trait 的实现是内置的，无法为任何用户类型实现。
/// 创建直接以 const 参数形式表示的新型式。
#[unstable(feature = "tuple_trait", issue = "157987")]
#[lang = "tuple_trait"]
#[diagnostic::on_unimplemented(message = "`{Self}` is not a tuple")]
#[fundamental]
#[rustc_deny_explicit_impl]
#[rustc_dyn_incompatible_trait]
pub trait Tuple {}

// HACK(khyperia): if this is missing, the gca macro's `implied_by = "gca_adts"` emits an error
#[unstable(feature = "gca_adts", issue = "163420")]
#[expect(dead_code)]
struct HackGcaAdtsFeature;

/// Creates a new style directly represented const argument.
/// ```ignore (cannot test this from within core yet)
/// const BAR<const N: usize>: usize = gca!(N);
/// const FOO<const N: usize>: usize = gca!(BAR::<N>);
/// ```
#[allow_internal_unstable(internal_syntax)]
// HACK: abuse implied_by, this should be enabled if gca_min_const_items or gca_adts is enabled,
// neither one is more particularly special than the other
#[unstable(feature = "gca_min_const_items", issue = "132980", implied_by = "gca_adts")]
#[diagnostic::opaque]
pub macro gca($($arg:tt)*) {
    k#gca($($arg)*)
}

/// A marker for types which can be used as types of `const` generic parameters.
///
/// These types must have a proper equivalence relation (`Eq`) and it must be automatically
/// derived (`StructuralPartialEq`). There's a hard-coded check in the compiler ensuring
/// that all fields are also `ConstParamTy`, which implies that recursively, all fields
/// are `StructuralPartialEq`.
#[lang = "const_param_ty"]
#[unstable(feature = "const_param_ty_trait", issue = "95174", implied_by = "unsized_const_params")]
#[diagnostic::on_unimplemented(message = "`{Self}` can't be used as a const parameter type")]
#[allow(multiple_supertrait_upcastable)]
// We name this differently than the derive macro so that the `adt_const_params` can
// be used independently of `unsized_const_params` without requiring a full path
// to the derive macro every time it is used. This should be renamed on stabilization.
pub trait ConstParamTy_: StructuralPartialEq + Eq {}

/// Derive macro generating an impl of the trait `ConstParamTy`.
#[rustc_builtin_macro]
#[allow_internal_unstable(const_param_ty_trait)]
#[unstable(feature = "min_adt_const_params", issue = "154042", implied_by = "adt_const_params")]
pub macro ConstParamTy($item:item) {
    /* compiler built-in */
}

// For `adt_const_params` to be recognized as a feature
#[unstable(feature = "adt_const_params", issue = "95174")]
const _: () = ();

// FIXME(adt_const_params): handle `ty::FnDef`/`ty::Closure`
marker_impls! {
    #[unstable(feature = "min_adt_const_params", issue = "154042")]
    ConstParamTy_ for
        usize, u8, u16, u32, u64, u128,
        isize, i8, i16, i32, i64, i128,
        bool,
        char,
        (),
        {T: ConstParamTy_, const N: usize} [T; N],
}

marker_impls! {
    #[unstable(feature = "unsized_const_params", issue = "128028")]
    #[unstable_feature_bound(unsized_const_params)]
    ConstParamTy_ for
        str,
        {T: ConstParamTy_} [T],
        {T: ConstParamTy_ + ?Sized} &T,
}

/// 使智能指针能与 trait object 一起使用的 derive 宏。
///
/// # 此宏的作用
///
/// 该宏旨在与用户定义的指针类型一起使用，使得能够对用户定义的指针的 pointee 进行强制转换。这包含两个方面：
/// ## pointee 的未大小检查强制转换
///
/// ## pointee 的未大小大小检查强制转换
///
/// 使用该宏后，以下示例可以编译通过：
/// ```
/// #![feature(derive_coerce_pointee)]
/// use std::marker::CoercePointee;
/// use std::ops::Deref;
///
/// #[derive(CoercePointee)]
/// #[repr(transparent)]
/// struct MySmartPointer<T: ?Sized>(Box<T>);
///
/// impl<T: ?Sized> Deref for MySmartPointer<T> {
///     type Target = T;
///     fn deref(&self) -> &T {
///         &self.0
///     }
/// }
///
/// trait MyTrait {}
///
/// impl MyTrait for i32 {}
///
/// fn main() {
///     let ptr: MySmartPointer<i32> = MySmartPointer(Box::new(4));
///
///     // This coercion would be an error without the derive.
///     let ptr: MySmartPointer<dyn MyTrait> = ptr;
/// }
/// ```
/// Without the `#[derive(CoercePointee)]` macro, this example would fail with the following error:
/// ```text
/// error[E0308]: mismatched types
///   --> src/main.rs:11:44
///    |
/// 11 |     let ptr: MySmartPointer<dyn MyTrait> = ptr;
///    |              ---------------------------   ^^^ expected `MySmartPointer<dyn MyTrait>`, found `MySmartPointer<i32>`
///    |              |
///    |              expected due to this
///    |
///    = note: expected struct `MySmartPointer<dyn MyTrait>`
///               found struct `MySmartPointer<i32>`
///    = help: `i32` implements `MyTrait` so you could box the found value and coerce it to the trait object `Box<dyn MyTrait>`, you will have to change the expected type as well
/// ```
///
/// ## 动态兼容性
///
/// 该宏允许你针对用户定义的指针类型进行分发。也就是说，使用
/// 该类型的 trait 与接收者具有动态兼容性。例如，以下代码可以编译通过：
///
/// ```
/// #![feature(arbitrary_self_types, derive_coerce_pointee)]
/// use std::marker::CoercePointee;
/// use std::ops::Deref;
///
/// #[derive(CoercePointee)]
/// #[repr(transparent)]
/// struct MySmartPointer<T: ?Sized>(Box<T>);
///
/// impl<T: ?Sized> Deref for MySmartPointer<T> {
///     type Target = T;
///     fn deref(&self) -> &T {
///         &self.0
///     }
/// }
///
/// // You can always define this trait. (as long as you have #![feature(arbitrary_self_types)])
/// trait MyTrait {
///     fn func(self: MySmartPointer<Self>);
/// }
///
/// // But using `dyn MyTrait` requires #[derive(CoercePointee)].
/// fn call_func(value: MySmartPointer<dyn MyTrait>) {
///     value.func();
/// }
/// ```
/// If you remove the `#[derive(CoercePointee)]` annotation from the struct, then the above example
/// 因以下错误信息而失败：
/// ```text
/// error[E0038]: the trait `MyTrait` is not dyn compatible
///   --> src/lib.rs:21:36
///    |
/// 17 |     fn func(self: MySmartPointer<Self>);
///    |                   -------------------- help: consider changing method `func`'s `self` parameter to be `&self`: `&Self`
/// ...
/// 21 | fn call_func(value: MySmartPointer<dyn MyTrait>) {
///    |                                    ^^^^^^^^^^^ `MyTrait` is not dyn compatible
///    |
/// note: for a trait to be dyn compatible it needs to allow building a vtable
///       for more information, visit <https://doc.rust-lang.org/reference/items/traits.html#object-safety>
///   --> src/lib.rs:17:19
///    |
/// 16 | trait MyTrait {
///    |       ------- this trait is not dyn compatible...
/// 17 |     fn func(self: MySmartPointer<Self>);
///    |                   ^^^^^^^^^^^^^^^^^^^^ ...because method `func`'s `self` parameter cannot be dispatched on
/// ```
///
/// # 使用该宏的要求
///
/// 只有在满足以下条件时才能使用此宏：
/// * The type is a `#[repr(transparent)]` struct.
/// * 其非零大小字段的类型必须是标准库指针类型
///   (reference, raw pointer, `NonNull`, `Box`, `Rc`, `Arc`, etc.) or another user-defined type
///   also using the `#[derive(CoercePointee)]` macro.
/// * 零大小字段不得提及任何泛型参数，除非该零大小字段具有
///   type [`PhantomData`].
///
/// ## 多个类型参数
///
/// 如果类型具有多个类型参数，则必须明确指定哪个参数应
/// 用于动态分发。例如：
/// ```
/// # #![feature(derive_coerce_pointee)]
/// # use std::marker::{CoercePointee, PhantomData};
/// #[derive(CoercePointee)]
/// #[repr(transparent)]
/// struct MySmartPointer<#[pointee] T: ?Sized, U> {
///     ptr: Box<T>,
///     _phantom: PhantomData<U>,
/// }
/// ```
/// Specifying `#[pointee]` when the struct has only one type parameter is allowed, but not required.
///
/// # 示例
///
/// A custom implementation of the `Rc` type:
/// ```
/// #![feature(derive_coerce_pointee)]
/// use std::marker::CoercePointee;
/// use std::ops::Deref;
/// use std::ptr::NonNull;
///
/// #[derive(CoercePointee)]
/// #[repr(transparent)]
/// pub struct Rc<T: ?Sized> {
///     inner: NonNull<RcInner<T>>,
/// }
///
/// struct RcInner<T: ?Sized> {
///     refcount: usize,
///     value: T,
/// }
///
/// impl<T: ?Sized> Deref for Rc<T> {
///     type Target = T;
///     fn deref(&self) -> &T {
///         let ptr = self.inner.as_ptr();
///         unsafe { &(*ptr).value }
///     }
/// }
///
/// impl<T> Rc<T> {
///     pub fn new(value: T) -> Self {
///         let inner = Box::new(RcInner {
///             refcount: 1,
///             value,
///         });
///         Self {
///             inner: Box::into_non_null(inner),
///         }
///     }
/// }
///
/// impl<T: ?Sized> Clone for Rc<T> {
///     fn clone(&self) -> Self {
///         // A real implementation would handle overflow here.
///         unsafe { (*self.inner.as_ptr()).refcount += 1 };
///         Self { inner: self.inner }
///     }
/// }
///
/// impl<T: ?Sized> Drop for Rc<T> {
///     fn drop(&mut self) {
///         let ptr = self.inner.as_ptr();
///         unsafe { (*ptr).refcount -= 1 };
///         if unsafe { (*ptr).refcount } == 0 {
///             drop(unsafe { Box::from_raw(ptr) });
///         }
///     }
/// }
/// ```
#[rustc_builtin_macro(CoercePointee, attributes(pointee))]
#[allow_internal_unstable(dispatch_from_dyn, coerce_unsized, unsize, coerce_pointee_validated)]
#[rustc_diagnostic_item = "CoercePointee"]
#[unstable(feature = "derive_coerce_pointee", issue = "123430")]
pub macro CoercePointee($item:item) {
    /* compiler built-in */
}

/// A trait that is implemented for ADTs with `derive(CoercePointee)` so that
/// 编译器可以在扩展后确保 derive 实现是有效的，因为
/// derive 的要求比手动编写实现更为严格。
///
/// 此 trait 不打算由用户实现或用于其他用途
/// 除了验证之外，因此永远不应使其稳定化。
#[lang = "coerce_pointee_validated"]
#[unstable(feature = "coerce_pointee_validated", issue = "none")]
#[doc(hidden)]
pub trait CoercePointeeValidated {
    /* compiler built-in */
}

/// 允许值被重新借用为独占式，从而创建值的副本
/// 在副本的生命周期内禁用对源的读写。
#[lang = "reborrow"]
#[unstable(feature = "reborrow", issue = "145612")]
pub trait Reborrow {
    /* compiler built-in */
}

/// Derive macro generating an impl of the trait `Reborrow`.
#[rustc_builtin_macro(Reborrow)]
#[allow_internal_unstable(reborrow)]
#[unstable(feature = "reborrow", issue = "145612")]
pub macro Reborrow($item:item) {
    /* compiler built-in */
}

/// 允许可重新借用的值被重新借用为共享类型，从而创建一份副本。
/// 在副本的生命周期内禁用源的写入。
#[lang = "coerce_shared"]
#[unstable(feature = "reborrow", issue = "145612")]
pub trait CoerceShared<Target: Copy>: Reborrow {
    /* compiler built-in */
}

/// Derive macro generating an impl of the trait `CoerceShared`.
///
/// The shared target type must be specified with `#[coerce_shared(Target)]`.
#[rustc_builtin_macro(CoerceShared, attributes(coerce_shared))]
#[allow_internal_unstable(reborrow)]
#[unstable(feature = "reborrow", issue = "145612")]
pub macro CoerceShared($item:item) {
    /* compiler built-in */
}

/// 将类型标记为“可遗忘”，使其能够被传递给
/// [`mem::forget`](core::mem::forget), and other apis that may forget values.
/// 一个显著的遗忘值示例，尽管不如
/// `mem::forget`, is using a value inside an `Rc`. Values inside `Rc`s or `Arc`s
/// 由于引用循环的原因，可能会被遗忘。
///
/// By default, all types are assumed to be `Forget`. Similar to [`Sized`], the
/// syntax `T: ?Forget` can be used to relax this bound for some type `T`. However,
/// `Forget` bounds are implicitly added in *all* cases unless explicitly opted out
/// of - notably, in trait definitions and associated types. If the `forget_trait`
/// feature is enabled, these can similarly be opted out of:
/// ```ignore (illustrative, unsupported)
/// #![feature(forget_trait)]
/// use std::marker::Forget;
///
/// trait Foo: ?Forget {
///     type Bar: ?Forget;
/// }
/// ```
/// The explicit goal of [`mem::forget`](core::mem::forget) is not to run the destructor
/// of a value (i.e. its implementation of [`Drop`](core::ops::Drop)).
/// As a dual to this, since `?Forget` types cannot be forgotten, the destructors
/// of `?Forget` types are **guaranteed to be run**.
#[rustc_specialization_trait]
#[rustc_coinductive]
#[diagnostic::on_unimplemented(
    message = "values of type `{Self}` may not be forgotten",
    label = "value may be forgotten"
)]
#[lang = "forget"]
#[unstable(feature = "forget_trait", issue = "165370")]
pub unsafe auto trait Forget {
    // Empty.
}
/// 将类型标记为可以在内存中自由移动到另一个地址。
///
/// By default, all types are assumed to be `Move`. Similar to [`Sized`], the
/// syntax `T: ?Move` can be used to relax this bound for some type `T`. However,
/// `Move` bounds are implicitly added in *all* cases unless explicitly opted out
/// of - notably, in trait definitions and associated types. If the `move_trait`
/// 这些也可以被选择不启用：
/// ```
/// #![allow(incomplete_features)]
/// #![feature(move_trait)]
/// use std::marker::Move;
///
/// trait Foo: ?Move {
///     type Bar: ?Move;
/// }
/// ```
#[lang = "move_trait"]
#[rustc_specialization_trait]
#[rustc_coinductive]
#[diagnostic::on_unimplemented(
    message = "values of type `{Self}` may not be movable",
    label = "may not be movable"
)]
#[unstable(feature = "move_trait", issue = "149607")]
pub unsafe auto trait Move {
    // Empty.
}

marker_impls! {
    #[unstable(feature = "move_trait", issue = "149607")]
    unsafe Move for
        {T: PointeeSized + ?Move} *const T,
        {T: PointeeSized + ?Move} *mut T,
        {T: PointeeSized + ?Move} &T,
        {T: PointeeSized + ?Move} &mut T,
        {T: PointeeSized + ?Move} PhantomData<T>,
        {T: PointeeSized + ?Move} pattern_type!(*const T is !null),
        {T: PointeeSized + ?Move} pattern_type!(*mut T is !null),
}
