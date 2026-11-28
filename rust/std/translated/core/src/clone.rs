//! The `Clone` trait for types that cannot be 'implicitly copied'.
//!
//! 在 Rust 中，某些简单类型是“隐式可复制”的，当你
//! 将它们赋值或作为参数传递时，接收者将获得一个副本，
//! 而原始值保持不变。这些类型不需要
//! 进行复制分配，也不具有终结器（即它们不
//! contain owned boxes or implement [`Drop`]), so the compiler considers
//! 它们成本较低且安全可复制。对于其他类型，复制必须
//! explicitly, by convention implementing the [`Clone`] trait and calling
//! the [`clone`] method.
//!
//! [`clone`]: Clone::clone
//!
//! 基本使用示例：
//!
//! ```
//! let s = String::new(); // String type implements Clone
//! let copy = s.clone(); // so we can clone it
//! ```
//!
//! 为了轻松实现 Clone trait，你也可以使用
//! `#[derive(Clone)]`. Example:
//!
//! ```
//! #[derive(Clone)] // we add the Clone trait to Morpheus struct
//! struct Morpheus {
//!    blue_pill: f32,
//!    red_pill: i64,
//! }
//!
//! fn main() {
//!    let f = Morpheus { blue_pill: 0.0, red_pill: 0 };
//!    let copy = f.clone(); // and now we can clone it!
//! }
//! ```

#![stable(feature = "rust1", since = "1.0.0")]

use crate::marker::{Destruct, PointeeSized};

mod uninit;

/// 一个允许显式创建重复值的常见 trait。
///
/// Calling [`clone`] always produces a new value.
/// 然而，对于指向其他数据的引用类型（如智能指针或引用），
/// 新值可能仍然指向相同的底层数据，而不是复制它。
/// See [`Clone::clone`] for more details.
///
/// This distinction is especially important when using `#[derive(Clone)]` on structs containing
/// smart pointers like `Arc<Mutex<T>>` - the cloned struct will share mutable state with the
/// 原始结构体共享可变状态。
///
/// Differs from [`Copy`] in that [`Copy`] is implicit and an inexpensive bit-wise copy, while
/// `Clone` is always explicit and may or may not be expensive. [`Copy`] has no methods, so you
/// cannot change its behavior, but when implementing `Clone`, the `clone` method you provide
/// 可能会执行任意代码。
///
/// Since `Clone` is a supertrait of [`Copy`], any type that implements `Copy` must also implement
/// `Clone`.
///
/// ## 可推导的
///
/// This trait can be used with `#[derive]` if all fields are `Clone`. The `derive`d
/// implementation of [`Clone`] calls [`clone`] on each field.
///
/// [`clone`]: Clone::clone
///
/// For a generic struct, `#[derive]` implements `Clone` conditionally by adding bound `Clone` on
/// generic parameters.
///
/// ```
/// // `derive` implements Clone for Reading<T> when T is Clone.
/// #[derive(Clone)]
/// struct Reading<T> {
///     frequency: T,
/// }
/// ```
///
/// ## How can I implement `Clone`?
///
/// Types that are [`Copy`] should have a trivial implementation of `Clone`. More formally:
/// if `T: Copy`, `x: T`, and `y: &T`, then `let x = y.clone();` is equivalent to `let x = *y;`.
/// 手动实现应小心维护这一不变性；然而，不安全的代码
/// 不能依赖它来确保内存安全。
///
/// 一个例子是持有函数指针的泛型结构体。在这种情况下，
/// implementation of `Clone` cannot be `derive`d, but can be implemented as:
///
/// ```
/// struct Generate<T>(fn() -> T);
///
/// impl<T> Copy for Generate<T> {}
///
/// impl<T> Clone for Generate<T> {
///     fn clone(&self) -> Self {
///         *self
///     }
/// }
/// ```
///
/// If we `derive`:
///
/// ```
/// #[derive(Copy, Clone)]
/// struct Generate<T>(fn() -> T);
/// ```
///
/// the auto-derived implementations will have unnecessary `T: Copy` and `T: Clone` bounds:
///
/// ```
/// # struct Generate<T>(fn() -> T);
///
/// // Automatically derived
/// impl<T: Copy> Copy for Generate<T> { }
///
/// // Automatically derived
/// impl<T: Clone> Clone for Generate<T> {
///     fn clone(&self) -> Generate<T> {
///         Generate(Clone::clone(&self.0))
///     }
/// }
/// ```
///
/// 这些边界是不必要的，因为显然函数本身应该
/// 具有可复制和可克隆的特性，即使其返回类型不是：
///
/// ```compile_fail,E0599
/// #[derive(Copy, Clone)]
/// struct Generate<T>(fn() -> T);
///
/// struct NotCloneable;
///
/// fn generate_not_cloneable() -> NotCloneable {
///     NotCloneable
/// }
///
/// Generate(generate_not_cloneable).clone(); // error: trait bounds were not satisfied
/// // Note: With the manual implementations the above line will compile.
/// ```
///
/// ## `Clone` and `PartialEq`/`Eq`
/// `Clone` is intended for the duplication of objects. Consequently, when implementing
/// both `Clone` and [`PartialEq`], the following property is expected to hold:
/// ```text
/// x == x -> x.clone() == x
/// ```
/// 换句话说，如果一个对象与自身相等，
/// 其克隆也必须与原始对象相等。
///
/// For types that also implement [`Eq`] – for which `x == x` always holds –
/// this implies that `x.clone() == x` must always be true.
/// 如标准库集合
/// [`HashMap`], [`HashSet`], [`BTreeMap`], [`BTreeSet`] and [`BinaryHeap`]
/// 依赖其键满足此属性以确保正确行为。
/// 此外，这些集合要求克隆键时保持
/// [`Hash`] and [`Ord`] methods. Thankfully, this follows automatically from `x.clone() == x`
/// if `Hash` and `Ord` are correctly implemented according to their own requirements.
///
/// When deriving both `Clone` and [`PartialEq`] using `#[derive(Clone, PartialEq)]`
/// or when additionally deriving [`Eq`] using `#[derive(Clone, PartialEq, Eq)]`,
/// 那么此属性会自动得到维护——前提是底层类型满足它。
/// 违反此属性属于逻辑错误。由逻辑错误导致的行为没有指定，但 trait 的使用者必须确保此类逻辑错误不会导致
///
/// Violating this property is a logic error. The behavior resulting from a logic error is not
/// [impls] 列出的实现者之外，
/// undefined behavior. This means that `unsafe` code **must not** rely on this property
/// * 函数项类型（即为每个函数定义的独立类型）
///
/// ## Additional implementors
///
/// * 闭包类型，如果它们不捕获环境中的值
/// the following types also implement `Clone`:
///
/// * Function item types (i.e., the distinct types defined for each function)
/// * Function pointer types (e.g., `fn() -> i32`)
/// * Closure types, if they capture no value from the environment
///   or if all such captured values implement `Clone` themselves.
///   Note that variables captured by shared reference always implement `Clone`
/// (even if the referent doesn't),
///   while variables captured by mutable reference never implement `Clone`.
///
/// [`HashMap`]: ../../std/collections/struct.HashMap.html
/// [`HashSet`]: ../../std/collections/struct.HashSet.html
/// [`BTreeMap`]: ../../std/collections/struct.BTreeMap.html
/// [`BTreeSet`]: ../../std/collections/struct.BTreeSet.html
/// [`BinaryHeap`]: ../../std/collections/struct.BinaryHeap.html
/// [impls]: #implementors
#[stable(feature = "rust1", since = "1.0.0")]
#[lang = "clone"]
#[rustc_diagnostic_item = "Clone"]
#[rustc_const_unstable(feature = "const_clone", issue = "142757")]
pub const trait Clone: Sized {
    /// Returns a duplicate of the value.
    ///
    /// Note that what "duplicate" means varies by type:
    /// - 对于大多数类型，这会创建一个深度且独立的副本。
    /// - For reference types like `&T`, this creates another reference to the same value
    /// - For smart pointers like [`Arc`] or [`Rc`], this increments the reference count
    /// 但仍然指向相同的底层数据。
    ///
    /// [`Arc`]: ../../std/sync/struct.Arc.html
    /// [`Rc`]: ../../std/rc/struct.Rc.html
    ///
    /// # 示例
    ///
    /// ```
    /// # #![allow(noop_method_call)]
    /// let hello = "Hello"; // &str implements Clone
    ///
    /// assert_eq!("Hello", hello.clone());
    /// ```
    ///
    /// 使用引用计数类型的示例：
    ///
    /// ```
    /// use std::sync::{Arc, Mutex};
    ///
    /// let data = Arc::new(Mutex::new(vec![1, 2, 3]));
    /// let data_clone = data.clone(); // Creates another Arc pointing to the same Mutex
    ///
    /// {
    ///     let mut lock = data.lock().unwrap();
    ///     lock.push(4);
    /// }
    ///
    /// // Changes are visible through the clone because they share the same underlying data
    /// assert_eq!(*data_clone.lock().unwrap(), vec![1, 2, 3, 4]);
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[must_use = "cloning is often expensive and is not expected to have side effects"]
    // Clone::clone is special because the compiler generates MIR to implement it for some types.
    // See InstanceKind::CloneShim.
    #[lang = "clone_fn"]
    fn clone(&self) -> Self;

    /// Performs copy-assignment from `source`.
    ///
    /// `a.clone_from(&b)` is equivalent to `a = b.clone()` in functionality,
    /// but can be overridden to reuse the resources of `a` to avoid unnecessary
    /// 分配。
    #[inline]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[lang = "clone_from_fn"]
    fn clone_from(&mut self, source: &Self)
    where
        Self: [const] Destruct,
    {
        *self = source.clone()
    }
}

/// Indicates that the `Clone` implementation is identical to copying the value.
///
/// 这被标准库用于某些优化，该库针对此 trait 进行了专门处理，以便选择更快速的函数实现，例如
/// on this trait to select faster implementations of functions such as
/// [`clone_from_slice`](slice::clone_from_slice). It is automatically implemented
/// when using `#[derive(Clone, Copy)]`.
///
/// Note that this trait does not imply that the type is `Copy`, because e.g.
/// `core::ops::Range<i32>` could soundly implement this trait.
///
/// # 可能会导致未定义行为。
/// `Clone::clone` must be equivalent to copying the value, otherwise calling functions
/// such as `slice::clone_from_slice` can have undefined behaviour.
#[unstable(
    feature = "trivial_clone",
    reason = "this isn't part of any API guarantee",
    issue = "none"
)]
#[rustc_const_unstable(feature = "const_clone", issue = "142757")]
#[lang = "trivial_clone"]
// SAFETY:
// It is sound to specialize on this because the `clone` implementation cannot be
// lifetime-dependent. Therefore, if `TrivialClone` is implemented for any lifetime,
// its invariant holds whenever `Clone` is implemented, even if the actual
// `TrivialClone` bound would not be satisfied because of lifetime bounds.
#[unsafe(rustc_allow_lifetime_dependent_specialization)]
// If `#[derive(Clone, Clone, Copy)]` is written, there will be multiple
// implementations of `TrivialClone`. To keep it from appearing in error
// messages, make it a `#[marker]` trait.
#[marker]
pub const unsafe trait TrivialClone: [const] Clone {}

/// Derive macro generating an impl of the trait `Clone`.
#[rustc_builtin_macro]
#[stable(feature = "builtin_macro_prelude", since = "1.38.0")]
#[allow_internal_unstable(core_intrinsics, derive_clone_copy_internals, trivial_clone)]
pub macro Clone($item:item) {
    /* compiler built-in */
}

/// A trait for types whose [`Clone`] operation creates another alias to the same
/// 它创建另一个句柄、引用或别名，指向相同的逻辑资源或
///
/// `Share` refines the meaning of [`Clone`] for types where cloning a value
/// creates another handle, reference, or alias to the same logical resource or
/// 便宜、常数时间、无分配或方便。
/// semantic, not operational: `Share` does not mean merely that cloning is
/// cheap, constant-time, allocation-free, or convenient.
///
/// `Share` is a third way to think about creating another usable value:
///
/// * [`Copy`] may duplicate a value implicitly.
/// * [`Clone`] explicitly creates another value.
/// * `Share` explicitly creates another value that aliases the same underlying
///   logical resource or shared state.
///
/// `Share` is not a replacement for either [`Copy`] or [`Clone`], and neither
/// trait implies it. For example, integers are [`Copy`] but not `Share`, because
/// copying an integer creates an independent value. Likewise, not every cheap
/// [`Clone`] implementation is `Share`.
///
/// Shared references, `Rc<T>`, `Arc<T>`, `Sender<T>`, and `SyncSender<T>` are
/// examples of types that can be shared this way. Types such as `Vec<T>`,
/// `String`, `Box<T>`, owned collections, and similar owned values are not
/// `Share`, even though they implement [`Clone`], because cloning them creates
/// independent owned storage or value ownership. Mutable references (`&mut T`)
/// are neither `Clone` nor `Share`, because you cannot have two active at once.
///
/// Calling [`share`](Share::share) is equivalent to calling [`clone`](Clone::clone)
/// 对于实现者来说，但表明结果值别名了相同的
/// underlying resource. The `share` method is final, so implementors should
/// define the operation through [`Clone::clone`] and implement `Share` only when
/// those cloning semantics are clone-as-alias semantics.
///
/// # 示例
///
/// ```
/// #![feature(share_trait)]
///
/// use std::cell::Cell;
/// use std::clone::Share;
/// use std::rc::Rc;
/// use std::sync::{
///     Arc,
///     atomic::{AtomicUsize, Ordering},
/// };
///
/// let value = 1;
/// let reference = &value;
/// assert!(std::ptr::eq(reference, reference.share()));
///
/// let rc = Rc::new(Cell::new(2));
/// let shared_rc = rc.share();
/// assert!(Rc::ptr_eq(&rc, &shared_rc));
/// shared_rc.set(3);
/// assert_eq!(rc.get(), 3);
///
/// let arc = Arc::new(AtomicUsize::new(4));
/// let shared_arc = arc.share();
/// assert!(Arc::ptr_eq(&arc, &shared_arc));
/// shared_arc.store(5, Ordering::Relaxed);
/// assert_eq!(arc.load(Ordering::Relaxed), 5);
/// ```
///
/// ```
/// #![feature(share_trait)]
///
/// use std::clone::Share;
/// use std::sync::mpsc::{channel, sync_channel};
///
/// let (sender, receiver) = channel();
/// let shared_sender = sender.share();
/// sender.send(1).unwrap();
/// shared_sender.send(2).unwrap();
///
/// let mut received = [receiver.recv().unwrap(), receiver.recv().unwrap()];
/// received.sort();
/// assert_eq!(received, [1, 2]);
///
/// let (sync_sender, sync_receiver) = sync_channel(2);
/// let shared_sync_sender = sync_sender.share();
/// sync_sender.send(3).unwrap();
/// shared_sync_sender.send(4).unwrap();
///
/// let mut received = [sync_receiver.recv().unwrap(), sync_receiver.recv().unwrap()];
/// received.sort();
/// assert_eq!(received, [3, 4]);
/// ```
#[unstable(feature = "share_trait", issue = "156756")]
pub trait Share: Clone {
    /// 创建对相同底层资源或共享状态的另一别名。
    ///
    /// This is equivalent to calling [`Clone::clone`]. Use `share` at call
    /// sites to make aliasing intent explicit; implementors define this
    /// operation through [`Clone::clone`], not by overriding this method.
    #[unstable(feature = "share_trait", issue = "156756")]
    final fn share(&self) -> Self {
        Clone::clone(self)
    }
}

/// Trait for objects whose [`Clone`] impl is lightweight (e.g. reference-counted)
///
/// - 是 O(1)（常数）时间，无论对象管理的数据量如何，
/// - 不需要内存分配，
/// - 不需要复制超过大约 64 字节（典型的缓存行大小），
/// - 不会阻塞当前线程，
/// - 没有任何语义级副作用（例如分配文件描述符），并且
/// - 开销不超过几个原子操作。
/// - not have overhead larger than a couple of atomic operations.
///
/// The `UseCloned` trait does not provide a method; instead, it indicates that
/// `Clone::clone` is lightweight, and allows the use of the `.use` syntax.
///
/// ## .use 后缀语法
///
/// Values can be `.use`d by adding `.use` postfix to the value you want to use.
///
/// ```ignore (this won't work until we land use)
/// fn foo(f: Foo) {
///     // if `Foo` implements `Copy` f would be copied into x.
///     // if `Foo` implements `UseCloned` f would be cloned into x.
///     // otherwise f would be moved into x.
///     let x = f.use;
///     // ...
/// }
/// ```
///
/// ## use 闭包
///
/// 使用闭包允许捕获的值自动被使用。
/// This is similar to have a closure that you would call `.use` over each captured value.
#[unstable(feature = "ergonomic_clones", issue = "132290")]
#[lang = "use_cloned"]
pub trait UseCloned: Clone {
    // Empty.
}

macro_rules! impl_use_cloned {
    ($($t:ty)*) => {
        $(
            #[unstable(feature = "ergonomic_clones", issue = "132290")]
            impl UseCloned for $t {}
        )*
    }
}

impl_use_cloned! {
    usize u8 u16 u32 u64 u128
    isize i8 i16 i32 i64 i128
             f16 f32 f64 f128
    bool char
}

// FIXME(aburka): these structs are used solely by #[derive] to
// assert that every component of a type implements Clone or Copy.
//
// These structs should never appear in user code.
#[doc(hidden)]
#[allow(missing_debug_implementations)]
#[unstable(
    feature = "derive_clone_copy_internals",
    reason = "deriving hack, should not be public",
    issue = "none"
)]
pub struct AssertParamIsClone<T: Clone + PointeeSized> {
    _field: crate::marker::PhantomData<T>,
}
#[doc(hidden)]
#[allow(missing_debug_implementations)]
#[unstable(
    feature = "derive_clone_copy_internals",
    reason = "deriving hack, should not be public",
    issue = "none"
)]
pub struct AssertParamIsCopy<T: Copy + PointeeSized> {
    _field: crate::marker::PhantomData<T>,
}

/// A generalization of [`Clone`] to [dynamically-sized types][DST] stored in arbitrary containers.
///
/// This trait is implemented for all types implementing [`Clone`], [slices](slice) of all
/// 此类类型以及标准库中的其他动态大小类型实现。
/// 您也可以实现此 trait 以启用自定义 DST 的克隆
/// （包含动态大小字段的结构），或将其作为 supertrait 来启用
/// 克隆 [trait object]。
///
/// 通常是通过支持 DST 的容器类型操作来使用此 trait，
/// so you should not typically need to call `.clone_to_uninit()` explicitly except when
/// implementing such a container or otherwise performing explicit management of an allocation,
/// or when implementing `CloneToUninit` itself.
///
/// # 安全性
///
/// Implementations must ensure that when `.clone_to_uninit(dest)` returns normally rather than
/// panicking, it always leaves `*dest` initialized as a valid value of type `Self`.
///
/// # 示例
///
// FIXME(#126799): when `Box::clone` allows use of `CloneToUninit`, rewrite these examples with it
// since `Rc` is a distraction.
///
/// If you are defining a trait, you can add `CloneToUninit` as a supertrait to enable cloning of
/// `dyn` values of your trait:
///
/// ```
/// #![feature(clone_to_uninit)]
/// use std::rc::Rc;
///
/// trait Foo: std::fmt::Debug + std::clone::CloneToUninit {
///     fn modify(&mut self);
///     fn value(&self) -> i32;
/// }
///
/// impl Foo for i32 {
///     fn modify(&mut self) {
///         *self *= 10;
///     }
///     fn value(&self) -> i32 {
///         *self
///     }
/// }
///
/// let first: Rc<dyn Foo> = Rc::new(1234);
///
/// let mut second = first.clone();
/// Rc::make_mut(&mut second).modify(); // make_mut() will call clone_to_uninit()
///
/// assert_eq!(first.value(), 1234);
/// assert_eq!(second.value(), 12340);
/// ```
///
/// The following is an example of implementing `CloneToUninit` for a custom DST.
/// (It is essentially a limited form of what `derive(CloneToUninit)` would do,
/// 如果存在这样的 derive macro 的话。）
///
/// ```
/// #![feature(clone_to_uninit)]
/// use std::clone::CloneToUninit;
/// use std::mem::offset_of;
/// use std::rc::Rc;
///
/// #[derive(PartialEq)]
/// struct MyDst<T: ?Sized> {
///     label: String,
///     contents: T,
/// }
///
/// unsafe impl<T: ?Sized + CloneToUninit> CloneToUninit for MyDst<T> {
///     unsafe fn clone_to_uninit(&self, dest: *mut u8) {
///         // The offset of `self.contents` is dynamic because it depends on the alignment of T
///         // which can be dynamic (if `T = dyn SomeTrait`). Therefore, we have to obtain it
///         // dynamically by examining `self`, rather than using `offset_of!`.
///         //
///         // SAFETY: `self` by definition points somewhere before `&self.contents` in the same
///         // allocation.
///         let offset_of_contents = unsafe {
///             (&raw const self.contents).byte_offset_from_unsigned(self)
///         };
///
///         // Clone the *sized* fields of `self` (just one, in this example).
///         // (By cloning this first and storing it temporarily in a local variable, we avoid
///         // leaking it in case of any panic, using the ordinary automatic cleanup of local
///         // variables. Such a leak would be sound, but undesirable.)
///         let label = self.label.clone();
///
///         // SAFETY: The caller must provide a `dest` such that these field offsets are valid
///         // to write to.
///         unsafe {
///             // Clone the unsized field directly from `self` to `dest`.
///             self.contents.clone_to_uninit(dest.add(offset_of_contents));
///
///             // Now write all the sized fields.
///             //
///             // Note that we only do this once all of the clone() and clone_to_uninit() calls
///             // have completed, and therefore we know that there are no more possible panics;
///             // this ensures no memory leaks in case of panic.
///             dest.add(offset_of!(Self, label)).cast::<String>().write(label);
///         }
///         // All fields of the struct have been initialized; therefore, the struct is initialized,
///         // and we have satisfied our `unsafe impl CloneToUninit` obligations.
///     }
/// }
///
/// fn main() {
///     // Construct MyDst<[u8; 4]>, then coerce to MyDst<[u8]>.
///     let first: Rc<MyDst<[u8]>> = Rc::new(MyDst {
///         label: String::from("hello"),
///         contents: [1, 2, 3, 4],
///     });
///
///     let mut second = first.clone();
///     // make_mut() will call clone_to_uninit().
///     for elem in Rc::make_mut(&mut second).contents.iter_mut() {
///         *elem *= 10;
///     }
///
///     assert_eq!(first.contents, [1, 2, 3, 4]);
///     assert_eq!(second.contents, [10, 20, 30, 40]);
///     assert_eq!(second.label, "hello");
/// }
/// ```
///
/// # 另见
///
/// * [`Clone::clone_from`] is a safe function which may be used instead when [`Self: Sized`](Sized)
/// 且目标已初始化时，可以替代使用；它可能能够重用由
///   the destination, whereas `clone_to_uninit` cannot, since its destination is assumed to be
/// 未初始化。
/// * [`ToOwned`], which allocates a new destination container.
///
/// [`ToOwned`]: ../../std/borrow/trait.ToOwned.html
/// [DST]: https://doc.rust-lang.org/reference/dynamically-sized-types.html
/// [trait object]: https://doc.rust-lang.org/reference/types/trait-object.html
#[unstable(feature = "clone_to_uninit", issue = "126799")]
pub unsafe trait CloneToUninit {
    /// Performs copy-assignment from `self` to `dest`.
    ///
    /// This is analogous to `std::ptr::write(dest.cast(), self.clone())`,
    /// except that `Self` may be a dynamically-sized type ([`!Sized`](Sized)).
    ///
    /// Before this function is called, `dest` may point to uninitialized memory.
    /// After this function is called, `dest` will point to initialized memory; it will be
    /// sound to create a `&Self` reference from the pointer with the [pointer metadata]
    /// from `self`.
    ///
    /// # 安全性
    ///
    /// 如果违反以下任何条件，行为未定义：
    ///
    /// * `dest` must be [valid] for writes for `size_of_val(self)` bytes.
    /// * `dest` must be properly aligned to `align_of_val(self)`.
    ///
    /// [valid]: crate::ptr#safety
    /// [pointer metadata]: crate::ptr::metadata()
    ///
    /// # panic
    ///
    /// This function may panic. (For example, it might panic if memory allocation for a clone
    /// of a value owned by `self` fails.)
    /// If the call panics, then `*dest` should be treated as uninitialized memory; it must not be
    /// 读取或释放，因为即使之前是有效的，也可能已被部分
    /// 覆盖。
    ///
    /// The caller may wish to take care to deallocate the allocation pointed to by `dest`,
    /// 如果适用，以避免内存泄漏（但这不是强制要求）。
    ///
    /// 实现者应避免通过在 unwind 时释放所有组件值来泄露值。
    /// that might have already been created. (For example, if a `[Foo]` of length 3 is being
    /// cloned, and the second of the three calls to `Foo::clone()` unwinds, then the first `Foo`
    /// 被克隆的对象应当被释放。）
    unsafe fn clone_to_uninit(&self, dest: *mut u8);
}

#[unstable(feature = "clone_to_uninit", issue = "126799")]
unsafe impl<T: Clone> CloneToUninit for T {
    #[inline]
    unsafe fn clone_to_uninit(&self, dest: *mut u8) {
        // SAFETY: we're calling a specialization with the same contract
        unsafe { <T as self::uninit::CopySpec>::clone_one(self, dest.cast::<T>()) }
    }
}

#[unstable(feature = "clone_to_uninit", issue = "126799")]
unsafe impl<T: Clone> CloneToUninit for [T] {
    #[inline]
    #[cfg_attr(debug_assertions, track_caller)]
    unsafe fn clone_to_uninit(&self, dest: *mut u8) {
        let dest: *mut [T] = dest.with_metadata_of(self);
        // SAFETY: we're calling a specialization with the same contract
        unsafe { <T as self::uninit::CopySpec>::clone_slice(self, dest) }
    }
}

#[unstable(feature = "clone_to_uninit", issue = "126799")]
unsafe impl CloneToUninit for str {
    #[inline]
    #[cfg_attr(debug_assertions, track_caller)]
    unsafe fn clone_to_uninit(&self, dest: *mut u8) {
        // SAFETY: str is just a [u8] with UTF-8 invariant
        unsafe { self.as_bytes().clone_to_uninit(dest) }
    }
}

#[unstable(feature = "clone_to_uninit", issue = "126799")]
unsafe impl CloneToUninit for crate::ffi::CStr {
    #[cfg_attr(debug_assertions, track_caller)]
    unsafe fn clone_to_uninit(&self, dest: *mut u8) {
        // SAFETY: For now, CStr is just a #[repr(trasnsparent)] [c_char] with some invariants.
        // And we can cast [c_char] to [u8] on all supported platforms (see: to_bytes_with_nul).
        // The pointer metadata properly preserves the length (so NUL is also copied).
        // See: `cstr_metadata_is_length_with_nul` in tests.
        unsafe { self.to_bytes_with_nul().clone_to_uninit(dest) }
    }
}

#[unstable(feature = "byte_str", issue = "134915")]
unsafe impl CloneToUninit for crate::byte_str::ByteStr {
    #[inline]
    #[cfg_attr(debug_assertions, track_caller)]
    unsafe fn clone_to_uninit(&self, dst: *mut u8) {
        // SAFETY: ByteStr is a `#[repr(transparent)]` wrapper around `[u8]`
        unsafe { self.as_bytes().clone_to_uninit(dst) }
    }
}

/// Implementations of `Clone` for primitive types.
///
/// 无法用 Rust 描述的实现。）
/// are implemented in `traits::SelectionContext::copy_clone_conditions()`
/// in `rustc_trait_selection`.
mod impls {
    use super::{Share, TrivialClone};
    use crate::marker::PointeeSized;

    macro_rules! impl_clone {
        ($($t:ty)*) => {
            $(
                #[stable(feature = "rust1", since = "1.0.0")]
                #[rustc_const_unstable(feature = "const_clone", issue = "142757")]
                const impl Clone for $t {
                    #[inline(always)]
                    fn clone(&self) -> Self {
                        *self
                    }
                }

                #[doc(hidden)]
                #[unstable(feature = "trivial_clone", issue = "none")]
                #[rustc_const_unstable(feature = "const_clone", issue = "142757")]
                const unsafe impl TrivialClone for $t {}
            )*
        }
    }

    impl_clone! {
        usize u8 u16 u32 u64 u128
        isize i8 i16 i32 i64 i128
        f16 f32 f64 f128
        bool char
    }

    #[stable(feature = "never_type", since = "1.100.0")]
    #[rustc_const_unstable(feature = "const_clone", issue = "142757")]
    const impl Clone for ! {
        #[inline]
        fn clone(&self) -> Self {
            *self
        }
    }

    #[doc(hidden)]
    #[unstable(feature = "trivial_clone", issue = "none")]
    #[rustc_const_unstable(feature = "const_clone", issue = "142757")]
    const unsafe impl TrivialClone for ! {}

    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_unstable(feature = "const_clone", issue = "142757")]
    const impl<T: PointeeSized> Clone for *const T {
        #[inline(always)]
        fn clone(&self) -> Self {
            *self
        }
    }

    #[doc(hidden)]
    #[unstable(feature = "trivial_clone", issue = "none")]
    #[rustc_const_unstable(feature = "const_clone", issue = "142757")]
    const unsafe impl<T: PointeeSized> TrivialClone for *const T {}

    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_unstable(feature = "const_clone", issue = "142757")]
    const impl<T: PointeeSized> Clone for *mut T {
        #[inline(always)]
        fn clone(&self) -> Self {
            *self
        }
    }

    #[doc(hidden)]
    #[unstable(feature = "trivial_clone", issue = "none")]
    #[rustc_const_unstable(feature = "const_clone", issue = "142757")]
    const unsafe impl<T: PointeeSized> TrivialClone for *mut T {}

    /// 共享引用可以被克隆，但可变引用 *不能*！）
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_unstable(feature = "const_clone", issue = "142757")]
    const impl<T: PointeeSized> Clone for &T {
        #[inline(always)]
        #[rustc_diagnostic_item = "noop_method_clone"]
        fn clone(&self) -> Self {
            self
        }
    }

    #[doc(hidden)]
    #[unstable(feature = "trivial_clone", issue = "none")]
    #[rustc_const_unstable(feature = "const_clone", issue = "142757")]
    const unsafe impl<T: PointeeSized> TrivialClone for &T {}

    #[unstable(feature = "share_trait", issue = "156756")]
    impl<T: PointeeSized> Share for &T {}

    /// 共享引用可以被克隆，但可变引用 *不能*！）
    #[stable(feature = "rust1", since = "1.0.0")]
    impl<T: PointeeSized> !Clone for &mut T {}
}
