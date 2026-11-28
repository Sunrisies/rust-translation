//! 可共享的可变容器。
//!
//! Rust memory safety is based on this rule: Given an object `T`, it is only possible to
//! 以下中的一种情况：
//!
//! - Several immutable references (`&T`) to the object (also known as **aliasing**).
//! - One mutable reference (`&mut T`) to the object (also known as **mutability**).
//!
//! Rust 编译器会强制执行此规则。然而，在某些情况下此规则并不
//! 足够灵活。有时需要多个引用指向同一个对象，同时还能
//! 对其进行修改。
//!
//! 可共享的可变容器旨在以可控的方式实现可变性，即使在
//! 存在别名的情况下也是如此。本模块中的单元类型允许从单个
//! thread (as enforced by not implementing [`Sync`]).
//! 如果您需要在多线程间共享时修改数据，每种单元类型都有对应的
//! corresponding [`std::sync`] type that you can use. See also [`atomic`] types
//! 它们为基本类型提供了跨线程的共享可变性。
//!
//! Values of the cell types types may be mutated through shared references (i.e. the common `&T`
//! type), whereas most Rust types can only be mutated through unique (`&mut T`) references.
//! We say these cell types provide 'interior mutability' (mutable via `&T`), in contrast with
//! typical Rust types that exhibit 'inherited mutability' (mutable only via `&mut T`).
//!
//! Cell types come in four flavors: `Cell<T>`, `RefCell<T>`, `OnceCell<T>`, and
//! `LazyCell<T>`. Each provides a different way of providing safe interior mutability.
//!
//! [`std::sync`]: ../sync/index.html
//!
//! ## `Cell<T>`
//!
//! [`Cell<T>`] implements interior mutability by moving values in and out of the cell. That is, a
//! `&T` to the inner value can never be obtained, and the value itself cannot be directly
//! obtained without replacing it with something else. This type provides the following
//! 方法：
//!
//!  - For types that implement [`Copy`], the [`get`](Cell::get) method retrieves the current
//! 内部值。
//!  - For types that implement [`Default`], the [`take`](Cell::take) method replaces the current
//!    interior value with [`Default::default()`] and returns the replaced value.
//! - 所有类型都有：
//!    - [`replace`](Cell::replace): replaces the current interior value and returns the replaced
//! 值。
//!    - [`into_inner`](Cell::into_inner): this method consumes the `Cell<T>` and returns the
//! 值。
//!    - [`set`](Cell::set): this method replaces the interior value, dropping the replaced value.
//!
//! `Cell<T>` is typically used for more simple types where copying or moving values isn't too
//! 这类资源密集型类型（例如数字类型），在可能的情况下通常应优先使用其他单元格类型。
//! possible. For larger and non-copy types, `RefCell` provides some advantages.
//!
//! ## `RefCell<T>`
//!
//! [`RefCell<T>`] uses Rust's lifetimes to implement "dynamic borrowing", a process whereby one can
//! claim temporary, exclusive, mutable access to the inner value. Borrows for `RefCell<T>`s are
//! 可以通过
//! statically, at compile time.
//!
//! An immutable reference to a `RefCell`'s inner value (`&T`) can be obtained with
//! [`borrow`](`RefCell::borrow`), and a mutable borrow (`&mut T`) can be obtained with
//! [`borrow_mut`](`RefCell::borrow_mut`). When these functions are called, they first verify that
//! Rust's borrow rules will be satisfied: any number of immutable borrows are allowed or a
//! single mutable borrow is allowed, but never both. If a borrow is attempted that would violate
//! these rules, the thread will panic.
//!
//! The corresponding [`Sync`] version of `RefCell<T>` is [`RwLock<T>`].
//!
//! ## `OnceCell<T>`
//!
//! [`OnceCell<T>`] is somewhat of a hybrid of `Cell` and `RefCell` that works for values that
//! typically only need to be set once. This means that a reference `&T` can be obtained without
//! moving or copying the inner value (unlike `Cell`) but also without runtime checks (unlike
//! `RefCell`). However, once set, its value cannot be updated unless you have a mutable
//! reference to the `OnceCell`.
//!
//! `OnceCell` provides the following methods:
//!
//! - [`get`](OnceCell::get): obtain a reference to the inner value
//! - [`set`](OnceCell::set): set the inner value if it is unset (returns a `Result`)
//! - [`get_or_init`](OnceCell::get_or_init): return the inner value, initializing it if needed
//! - [`get_mut`](OnceCell::get_mut): provide a mutable reference to the inner value, only available
//!   if you have a mutable reference to the cell itself.
//!
//! The corresponding [`Sync`] version of `OnceCell<T>` is [`OnceLock<T>`].
//!
//! ## `LazyCell<T, F>`
//!
//! A common pattern with OnceCell is, for a given OnceCell, to use the same function on every
//! call to [`OnceCell::get_or_init`] with that cell. This is what is offered by [`LazyCell`],
//! which pairs cells of `T` with functions of `F`, and always calls `F` before it yields `&T`.
//! This happens implicitly by simply attempting to dereference the LazyCell to get its contents,
//! 因此，当常量初始化了某个对象时，其使用方式更加透明。
//!
//! More complicated patterns that don't fit this description can be built on `OnceCell<T>` instead.
//!
//! `LazyCell` works by providing an implementation of `impl Deref` that calls the function,
//! so you can just use it by dereference (e.g. `*lazy_cell` or `lazy_cell.deref()`).
//!
//! The corresponding [`Sync`] version of `LazyCell<T, F>` is [`LazyLock<T, F>`].
//!
//! # 何时选择内部可变性
//!
//! 更常见的继承式可变性要求对值进行修改时必须有唯一的访问方式，这是
//! 语言的关键元素之一，使 Rust 能够强有力地处理指针别名问题。
//! 从而静态地防止崩溃错误。因此，继承式可变性更受青睐，而
//! 内部可变性则属于最后手段。由于 cell 类型允许在不允许修改的地方进行修改，
//! 有时内部可变性可能是合适的，甚至必须使用，例如：
//! * 在不可变对象中引入可变性
//!
//! * 逻辑不可变方法的实现细节
//! * Implementation details of logically-immutable methods.
//! * Mutating implementations of [`Clone`].
//!
//! # 在不可变对象中引入可变性
//!
//! Many shared smart pointer types, including [`Rc<T>`] and [`Arc<T>`], provide containers that can
//! 被克隆并在多个方之间共享的容器。由于包含的值可能是
//! multiply-aliased, they can only be borrowed with `&`, not `&mut`. Without cells it would be
//! 根本无法在这些智能指针内部修改数据。
//!
//! It's very common then to put a `RefCell<T>` inside shared pointer types to reintroduce
//! 可变性：
//!
//! ```
//! use std::cell::{RefCell, RefMut};
//! use std::collections::HashMap;
//! use std::rc::Rc;
//!
//! fn main() {
//!     let shared_map: Rc<RefCell<_>> = Rc::new(RefCell::new(HashMap::new()));
//!     // Create a new block to limit the scope of the dynamic borrow
//!     {
//!         let mut map: RefMut<'_, _> = shared_map.borrow_mut();
//!         map.insert("africa", 92388);
//!         map.insert("kyoto", 11837);
//!         map.insert("piccadilly", 11826);
//!         map.insert("marbles", 38);
//!     }
//!
//!     // Note that if we had not let the previous borrow of the cache fall out
//!     // of scope then the subsequent borrow would cause a dynamic thread panic.
//!     // This is the major hazard of using `RefCell`.
//!     let total: i32 = shared_map.borrow().values().sum();
//!     println!("{total}");
//! }
//! ```
//!
//! Note that this example uses `Rc<T>` and not `Arc<T>`. `RefCell<T>`s are for single-threaded
//! scenarios. Consider using [`RwLock<T>`] or [`Mutex<T>`] if you need shared mutability in a
//! # 逻辑不可变方法的实现细节
//!
//! # 逻辑不可变方法的实现细节
//!
//! 有时可能希望不在 API 中暴露“在底层发生修改”的事实。这可能是因为逻辑上该操作是不可变的，但例如，缓存
//! 强制实现进行修改；或者因为必须使用修改来实现
//! forces the implementation to perform mutation; or because you must employ mutation to implement
//! a trait method that was originally defined to take `&self`.
//!
//! ```
//! # #![allow(dead_code)]
//! use std::cell::OnceCell;
//!
//! struct Graph {
//!     edges: Vec<(i32, i32)>,
//!     span_tree_cache: OnceCell<Vec<(i32, i32)>>
//! }
//!
//! impl Graph {
//!     fn minimum_spanning_tree(&self) -> Vec<(i32, i32)> {
//!         self.span_tree_cache
//!             .get_or_init(|| self.calc_span_tree())
//!             .clone()
//!     }
//!
//!     fn calc_span_tree(&self) -> Vec<(i32, i32)> {
//!         // Expensive computation goes here
//!         vec![]
//!     }
//! }
//! ```
//!
//! ## Mutating implementations of `Clone`
//!
//! 这仅仅是一种常见的情况：为看似不可变的操作隐藏其可变性。
//! that appear to be immutable. The [`clone`](Clone::clone) method is expected to not change the
//! source value, and is declared to take `&self`, not `&mut self`. Therefore, any mutation that
//! happens in the `clone` method must use cell types. For example, [`Rc<T>`] maintains its
//! reference counts within a `Cell<T>`.
//!
//! ```
//! use std::cell::Cell;
//! use std::ptr::NonNull;
//! use std::process::abort;
//! use std::marker::PhantomData;
//!
//! struct Rc<T: ?Sized> {
//!     ptr: NonNull<RcInner<T>>,
//!     phantom: PhantomData<RcInner<T>>,
//! }
//!
//! struct RcInner<T: ?Sized> {
//!     strong: Cell<usize>,
//!     refcount: Cell<usize>,
//!     value: T,
//! }
//!
//! impl<T: ?Sized> Clone for Rc<T> {
//!     fn clone(&self) -> Rc<T> {
//!         self.inc_strong();
//!         Rc {
//!             ptr: self.ptr,
//!             phantom: PhantomData,
//!         }
//!     }
//! }
//!
//! trait RcInnerPtr<T: ?Sized> {
//!
//!     fn inner(&self) -> &RcInner<T>;
//!
//!     fn strong(&self) -> usize {
//!         self.inner().strong.get()
//!     }
//!
//!     fn inc_strong(&self) {
//!         self.inner()
//!             .strong
//!             .set(self.strong()
//!                      .checked_add(1)
//!                      .unwrap_or_else(|| abort() ));
//!     }
//! }
//!
//! impl<T: ?Sized> RcInnerPtr<T> for Rc<T> {
//!    fn inner(&self) -> &RcInner<T> {
//!        unsafe {
//!            self.ptr.as_ref()
//!        }
//!    }
//! }
//! ```
//!
//! [`Arc<T>`]: ../../std/sync/struct.Arc.html
//! [`Rc<T>`]: ../../std/rc/struct.Rc.html
//! [`RwLock<T>`]: ../../std/sync/struct.RwLock.html
//! [`Mutex<T>`]: ../../std/sync/struct.Mutex.html
//! [`OnceLock<T>`]: ../../std/sync/struct.OnceLock.html
//! [`LazyLock<T, F>`]: ../../std/sync/struct.LazyLock.html
//! [`Sync`]: ../../std/marker/trait.Sync.html
//! [`atomic`]: crate::sync::atomic

#![stable(feature = "rust1", since = "1.0.0")]

use crate::cmp::Ordering;
use crate::fmt::{self, Debug, Display};
use crate::marker::{Destruct, PhantomData, Unsize};
use crate::mem::{self, ManuallyDrop};
use crate::ops::{self, CoerceUnsized, Deref, DerefMut, DerefPure, DispatchFromDyn};
use crate::panic::const_panic;
use crate::pin::PinSafePointer;
use crate::ptr::{self, NonNull};
use crate::range;

mod covariant_unsafe_cell;
mod lazy;
mod once;

#[unstable(feature = "covariant_unsafe_cell", issue = "159735")]
pub use covariant_unsafe_cell::CovariantUnsafeCell;
#[stable(feature = "lazy_cell", since = "1.80.0")]
pub use lazy::LazyCell;
#[stable(feature = "once_cell", since = "1.70.0")]
pub use once::OnceCell;

/// 一个可变的内存位置。
///
/// # 内存布局
///
/// `Cell<T>` has the same [memory layout and caveats as
/// `UnsafeCell<T>`](UnsafeCell#memory-layout). In particular, this means that
/// `Cell<T>` has the same in-memory representation as its inner type `T`.
///
/// # 示例
///
/// In this example, you can see that `Cell<T>` enables mutation inside an
/// 不可变结构内进行变异。换句话说，它实现了“内部可变性”。
///
/// ```
/// use std::cell::Cell;
///
/// struct SomeStruct {
///     regular_field: u8,
///     special_field: Cell<u8>,
/// }
///
/// let my_struct = SomeStruct {
///     regular_field: 0,
///     special_field: Cell::new(1),
/// };
///
/// let new_value = 100;
///
/// // ERROR: `my_struct` is immutable
/// // my_struct.regular_field = new_value;
///
/// // WORKS: although `my_struct` is immutable, `special_field` is a `Cell`,
/// // which can always be mutated
/// my_struct.special_field.set(new_value);
/// assert_eq!(my_struct.special_field.get(), new_value);
/// ```
///
/// See the [module-level documentation](self) for more.
#[rustc_diagnostic_item = "Cell"]
#[stable(feature = "rust1", since = "1.0.0")]
#[repr(transparent)]
#[rustc_pub_transparent]
pub struct Cell<#[rustc_assert_variance(invariant)] T: ?Sized> {
    value: UnsafeCell<T>,
}

#[stable(feature = "rust1", since = "1.0.0")]
unsafe impl<T: ?Sized> Send for Cell<T> where T: Send {}

// Note that this negative impl isn't strictly necessary for correctness,
// as `Cell` wraps `UnsafeCell`, which is itself `!Sync`.
// However, given how important `Cell`'s `!Sync`-ness is,
// having an explicit negative impl is nice for documentation purposes
// and results in nicer error messages.
#[stable(feature = "rust1", since = "1.0.0")]
impl<T: ?Sized> !Sync for Cell<T> {}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T: Copy> Clone for Cell<T> {
    #[inline]
    fn clone(&self) -> Cell<T> {
        Cell::new(self.get())
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_const_unstable(feature = "const_default", issue = "143894")]
const impl<T: [const] Default> Default for Cell<T> {
    /// Creates a `Cell<T>`, with the `Default` value for T.
    #[inline]
    fn default() -> Cell<T> {
        Cell::new(Default::default())
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T: PartialEq + Copy> PartialEq for Cell<T> {
    #[inline]
    fn eq(&self, other: &Cell<T>) -> bool {
        self.get() == other.get()
    }
}

#[stable(feature = "cell_eq", since = "1.2.0")]
impl<T: Eq + Copy> Eq for Cell<T> {}

#[stable(feature = "cell_ord", since = "1.10.0")]
impl<T: PartialOrd + Copy> PartialOrd for Cell<T> {
    #[inline]
    fn partial_cmp(&self, other: &Cell<T>) -> Option<Ordering> {
        self.get().partial_cmp(&other.get())
    }

    #[inline]
    fn lt(&self, other: &Cell<T>) -> bool {
        self.get() < other.get()
    }

    #[inline]
    fn le(&self, other: &Cell<T>) -> bool {
        self.get() <= other.get()
    }

    #[inline]
    fn gt(&self, other: &Cell<T>) -> bool {
        self.get() > other.get()
    }

    #[inline]
    fn ge(&self, other: &Cell<T>) -> bool {
        self.get() >= other.get()
    }
}

#[stable(feature = "cell_ord", since = "1.10.0")]
impl<T: Ord + Copy> Ord for Cell<T> {
    #[inline]
    fn cmp(&self, other: &Cell<T>) -> Ordering {
        self.get().cmp(&other.get())
    }
}

#[stable(feature = "cell_from", since = "1.12.0")]
#[rustc_const_unstable(feature = "const_convert", issue = "143773")]
const impl<T> From<T> for Cell<T> {
    /// Creates a new `Cell<T>` containing the given value.
    fn from(t: T) -> Cell<T> {
        Cell::new(t)
    }
}

impl<T> Cell<T> {
    /// Creates a new `Cell` containing the given value.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::cell::Cell;
    ///
    /// let c = Cell::new(5);
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_cell_new", since = "1.24.0")]
    #[inline]
    pub const fn new(value: T) -> Cell<T> {
        Cell { value: UnsafeCell::new(value) }
    }

    /// 设置所包含的值。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::cell::Cell;
    ///
    /// let c = Cell::new(5);
    ///
    /// c.set(10);
    /// ```
    #[inline]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_unstable(feature = "const_cell_traits", issue = "147787")]
    #[lint::should_not_be_called_on_const_items]
    pub const fn set(&self, val: T)
    where
        T: [const] Destruct,
    {
        self.replace(val);
    }

    /// Swaps the values of two `Cell`s.
    ///
    /// The difference with `std::mem::swap` is that this function doesn't
    /// require a `&mut` reference.
    ///
    /// # Panic
    ///
    /// This function will panic if `self` and `other` are different `Cell`s that partially overlap.
    /// (Using just standard library methods, it is impossible to create such partially overlapping `Cell`s.
    /// However, unsafe code is allowed to e.g. create two `&Cell<[i32; 2]>` that partially overlap.)
    ///
    /// # 示例
    ///
    /// ```
    /// use std::cell::Cell;
    ///
    /// let c1 = Cell::new(5i32);
    /// let c2 = Cell::new(10i32);
    /// c1.swap(&c2);
    /// assert_eq!(10, c1.get());
    /// assert_eq!(5, c2.get());
    /// ```
    #[inline]
    #[stable(feature = "move_cell", since = "1.17.0")]
    #[lint::should_not_be_called_on_const_items]
    pub fn swap(&self, other: &Self) {
        // This function documents that it *will* panic, and intrinsics::is_nonoverlapping doesn't
        // do the check in const, so trying to use it here would be inviting unnecessary fragility.
        fn is_nonoverlapping<T>(src: *const T, dst: *const T) -> bool {
            let src_usize = src.addr();
            let dst_usize = dst.addr();
            let diff = src_usize.abs_diff(dst_usize);
            diff >= size_of::<T>()
        }

        if ptr::eq(self, other) {
            // Swapping wouldn't change anything.
            return;
        }
        if !is_nonoverlapping(self, other) {
            // See <https://github.com/rust-lang/rust/issues/80778> for why we need to stop here.
            panic!("`Cell::swap` on overlapping non-identical `Cell`s");
        }
        // SAFETY: This can be risky if called from separate threads, but `Cell`
        // is `!Sync` so this won't happen. This also won't invalidate any
        // pointers since `Cell` makes sure nothing else will be pointing into
        // either of these `Cell`s. We also excluded shenanigans like partially overlapping `Cell`s,
        // so `swap` will just properly copy two full values of type `T` back and forth.
        unsafe {
            mem::swap(&mut *self.value.get(), &mut *other.value.get());
        }
    }

    /// Replaces the contained value with `val`, and returns the old contained value.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::cell::Cell;
    ///
    /// let cell = Cell::new(5);
    /// assert_eq!(cell.get(), 5);
    /// assert_eq!(cell.replace(10), 5);
    /// assert_eq!(cell.get(), 10);
    /// ```
    #[inline]
    #[stable(feature = "move_cell", since = "1.17.0")]
    #[rustc_const_stable(feature = "const_cell", since = "1.88.0")]
    #[rustc_confusables("swap")]
    #[lint::should_not_be_called_on_const_items]
    pub const fn replace(&self, val: T) -> T {
        // SAFETY: This can cause data races if called from a separate thread,
        // but `Cell` is `!Sync` so this won't happen.
        mem::replace(unsafe { &mut *self.value.get() }, val)
    }

    /// 解包值，消耗细胞资源。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::cell::Cell;
    ///
    /// let c = Cell::new(5);
    /// let five = c.into_inner();
    ///
    /// assert_eq!(five, 5);
    /// ```
    #[stable(feature = "move_cell", since = "1.17.0")]
    #[rustc_const_stable(feature = "const_cell_into_inner", since = "1.83.0")]
    #[rustc_allow_const_fn_unstable(const_precise_live_drops)]
    pub const fn into_inner(self) -> T {
        self.value.into_inner()
    }
}

impl<T: Copy> Cell<T> {
    /// 返回所包含值的副本。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::cell::Cell;
    ///
    /// let c = Cell::new(5);
    ///
    /// let five = c.get();
    /// ```
    #[inline]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_cell", since = "1.88.0")]
    #[lint::should_not_be_called_on_const_items]
    pub const fn get(&self) -> T {
        // SAFETY: This can cause data races if called from a separate thread,
        // but `Cell` is `!Sync` so this won't happen.
        unsafe { *self.value.get() }
    }

    /// 使用函数更新所包含的值。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::cell::Cell;
    ///
    /// let c = Cell::new(5);
    /// c.update(|x| x + 1);
    /// assert_eq!(c.get(), 6);
    /// ```
    #[inline]
    #[stable(feature = "cell_update", since = "1.88.0")]
    #[rustc_const_unstable(feature = "const_cell_traits", issue = "147787")]
    #[lint::should_not_be_called_on_const_items]
    pub const fn update(&self, f: impl [const] FnOnce(T) -> T)
    where
        // FIXME(const-hack): `Copy` should imply `const Destruct`
        T: [const] Destruct,
    {
        let old = self.get();
        self.set(f(old));
    }
}

impl<T: ?Sized> Cell<T> {
    /// 返回指向该细胞中底层数据的原始指针。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::cell::Cell;
    ///
    /// let c = Cell::new(5);
    ///
    /// let ptr = c.as_ptr();
    /// ```
    #[inline]
    #[stable(feature = "cell_as_ptr", since = "1.12.0")]
    #[rustc_const_stable(feature = "const_cell_as_ptr", since = "1.32.0")]
    #[lint::as_ptr]
    #[lint::never_returns_null_ptr]
    pub const fn as_ptr(&self) -> *mut T {
        self.value.get()
    }

    /// 返回对底层数据的可变引用。
    ///
    /// This call borrows `Cell` mutably (at compile-time) which guarantees
    /// 我们拥有唯一的引用。
    ///
    /// However be cautious: this method expects `self` to be mutable, which is
    /// generally not the case when using a `Cell`. If you require interior
    /// mutability by reference, consider using `RefCell` which provides
    /// run-time checked mutable borrows through its [`borrow_mut`] method.
    ///
    /// [`borrow_mut`]: RefCell::borrow_mut()
    ///
    /// # 示例
    ///
    /// ```
    /// use std::cell::Cell;
    ///
    /// let mut c = Cell::new(5);
    /// *c.get_mut() += 1;
    ///
    /// assert_eq!(c.get(), 6);
    /// ```
    #[inline]
    #[stable(feature = "cell_get_mut", since = "1.11.0")]
    #[rustc_const_stable(feature = "const_cell", since = "1.88.0")]
    pub const fn get_mut(&mut self) -> &mut T {
        self.value.get_mut()
    }

    /// Returns a `&Cell<T>` from a `&mut T`
    ///
    /// # 示例
    ///
    /// ```
    /// use std::cell::Cell;
    ///
    /// let slice: &mut [i32] = &mut [1, 2, 3];
    /// let cell_slice: &Cell<[i32]> = Cell::from_mut(slice);
    /// let slice_cell: &[Cell<i32>] = cell_slice.as_slice_of_cells();
    ///
    /// assert_eq!(slice_cell.len(), 3);
    /// ```
    #[inline]
    #[stable(feature = "as_cell", since = "1.37.0")]
    #[rustc_const_stable(feature = "const_cell", since = "1.88.0")]
    pub const fn from_mut(t: &mut T) -> &Cell<T> {
        // SAFETY: `&mut` ensures unique access.
        unsafe { &*(t as *mut T as *const Cell<T>) }
    }
}

impl<T: Default> Cell<T> {
    /// Takes the value of the cell, leaving `Default::default()` in its place.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::cell::Cell;
    ///
    /// let c = Cell::new(5);
    /// let five = c.take();
    ///
    /// assert_eq!(five, 5);
    /// assert_eq!(c.into_inner(), 0);
    /// ```
    #[stable(feature = "move_cell", since = "1.17.0")]
    #[rustc_const_unstable(feature = "const_cell_traits", issue = "147787")]
    pub const fn take(&self) -> T
    where
        T: [const] Default,
    {
        self.replace(Default::default())
    }
}

#[unstable(feature = "coerce_unsized", issue = "18598")]
impl<T: CoerceUnsized<U>, U> CoerceUnsized<Cell<U>> for Cell<T> {}

// Allow types that wrap `Cell` to also implement `DispatchFromDyn`
// and become dyn-compatible method receivers.
// Note that currently `Cell` itself cannot be a method receiver
// because it does not implement Deref.
// In other words:
// `self: Cell<&Self>` won't work
// `self: CellWrapper<Self>` becomes possible
#[unstable(feature = "dispatch_from_dyn", issue = "none")]
impl<T: DispatchFromDyn<U>, U> DispatchFromDyn<Cell<U>> for Cell<T> {}

#[stable(feature = "more_conversion_trait_impls", since = "1.95.0")]
impl<T, const N: usize> AsRef<[Cell<T>; N]> for Cell<[T; N]> {
    #[inline]
    fn as_ref(&self) -> &[Cell<T>; N] {
        self.as_array_of_cells()
    }
}

#[stable(feature = "more_conversion_trait_impls", since = "1.95.0")]
impl<T, const N: usize> AsRef<[Cell<T>]> for Cell<[T; N]> {
    #[inline]
    fn as_ref(&self) -> &[Cell<T>] {
        self.as_array_of_cells()
    }
}

#[stable(feature = "more_conversion_trait_impls", since = "1.95.0")]
impl<T> AsRef<[Cell<T>]> for Cell<[T]> {
    #[inline]
    fn as_ref(&self) -> &[Cell<T>] {
        self.as_slice_of_cells()
    }
}

impl<T> Cell<[T]> {
    /// Returns a `&[Cell<T>]` from a `&Cell<[T]>`
    ///
    /// # 示例
    ///
    /// ```
    /// use std::cell::Cell;
    ///
    /// let slice: &mut [i32] = &mut [1, 2, 3];
    /// let cell_slice: &Cell<[i32]> = Cell::from_mut(slice);
    /// let slice_cell: &[Cell<i32>] = cell_slice.as_slice_of_cells();
    ///
    /// assert_eq!(slice_cell.len(), 3);
    /// ```
    #[stable(feature = "as_cell", since = "1.37.0")]
    #[rustc_const_stable(feature = "const_cell", since = "1.88.0")]
    pub const fn as_slice_of_cells(&self) -> &[Cell<T>] {
        // SAFETY: `Cell<T>` has the same memory layout as `T`.
        unsafe { &*(self as *const Cell<[T]> as *const [Cell<T>]) }
    }
}

impl<T, const N: usize> Cell<[T; N]> {
    /// Returns a `&[Cell<T>; N]` from a `&Cell<[T; N]>`
    ///
    /// # 示例
    ///
    /// ```
    /// use std::cell::Cell;
    ///
    /// let mut array: [i32; 3] = [1, 2, 3];
    /// let cell_array: &Cell<[i32; 3]> = Cell::from_mut(&mut array);
    /// let array_cell: &[Cell<i32>; 3] = cell_array.as_array_of_cells();
    /// ```
    #[stable(feature = "as_array_of_cells", since = "1.91.0")]
    #[rustc_const_stable(feature = "as_array_of_cells", since = "1.91.0")]
    pub const fn as_array_of_cells(&self) -> &[Cell<T>; N] {
        // SAFETY: `Cell<T>` has the same memory layout as `T`.
        unsafe { &*(self as *const Cell<[T; N]> as *const [Cell<T>; N]) }
    }
}

/// Types for which cloning `Cell<Self>` is sound.
///
/// # 安全性
///
/// 如果对于 T =
/// 类型，以下代码也是安全的，那么为该类型实现此 trait 也是安全的。
///
/// ```
/// #![feature(cell_get_cloned)]
/// # use std::cell::{CloneFromCell, Cell};
/// fn clone_from_cell<T: CloneFromCell>(cell: &Cell<T>) -> T {
///     unsafe { T::clone(&*cell.as_ptr()) }
/// }
/// ```
///
/// Importantly, you can't just implement `CloneFromCell` for any arbitrary `Copy` type, e.g. the
/// 以下是不安全的做法：
///
/// ```rust
/// # use std::cell::Cell;
///
/// #[derive(Copy, Debug)]
/// pub struct Bad<'a>(Option<&'a Cell<Bad<'a>>>, u8);
///
/// impl Clone for Bad<'_> {
///     fn clone(&self) -> Self {
///         let a: &u8 = &self.1;
///         // when self.0 points to self, we write to self.1 while we have a live `&u8` pointing to
///         // it -- this is UB
///         self.0.unwrap().set(Self(None, 1));
///         dbg!((a, self));
///         Self(None, 0)
///     }
/// }
///
/// // this is not sound
/// // unsafe impl CloneFromCell for Bad<'_> {}
/// ```
#[unstable(feature = "cell_get_cloned", issue = "145329")]
// Allow potential overlapping implementations in user code
#[marker]
pub unsafe trait CloneFromCell: Clone {}

// `CloneFromCell` can be implemented for types that don't have indirection and which don't access
// `Cell`s in their `Clone` implementation. A commonly-used subset is covered here.
#[unstable(feature = "cell_get_cloned", issue = "145329")]
unsafe impl<T: CloneFromCell, const N: usize> CloneFromCell for [T; N] {}
#[unstable(feature = "cell_get_cloned", issue = "145329")]
unsafe impl<T: CloneFromCell> CloneFromCell for Option<T> {}
#[unstable(feature = "cell_get_cloned", issue = "145329")]
unsafe impl<T: CloneFromCell, E: CloneFromCell> CloneFromCell for Result<T, E> {}
#[unstable(feature = "cell_get_cloned", issue = "145329")]
unsafe impl<T: ?Sized> CloneFromCell for PhantomData<T> {}
#[unstable(feature = "cell_get_cloned", issue = "145329")]
unsafe impl<T: CloneFromCell> CloneFromCell for ManuallyDrop<T> {}
#[unstable(feature = "cell_get_cloned", issue = "145329")]
unsafe impl<T: CloneFromCell> CloneFromCell for ops::Range<T> {}
#[unstable(feature = "cell_get_cloned", issue = "145329")]
unsafe impl<T: CloneFromCell> CloneFromCell for range::Range<T> {}

#[unstable(feature = "cell_get_cloned", issue = "145329")]
impl<T: CloneFromCell> Cell<T> {
    /// Get a clone of the `Cell` that contains a copy of the original value.
    ///
    /// This allows a cheaply `Clone`-able type like an `Rc` to be stored in a `Cell`, exposing the
    /// cheaper `clone()` method.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(cell_get_cloned)]
    ///
    /// use core::cell::Cell;
    /// use std::rc::Rc;
    ///
    /// let rc = Rc::new(1usize);
    /// let c1 = Cell::new(rc);
    /// let c2 = c1.get_cloned();
    /// assert_eq!(*c2.into_inner(), 1);
    /// ```
    pub fn get_cloned(&self) -> Self {
        // SAFETY: T is CloneFromCell, which guarantees that this is sound.
        Cell::new(T::clone(unsafe { &*self.as_ptr() }))
    }
}

/// 具有动态检查借用规则的可变内存位置
///
/// See the [module-level documentation](self) for more.
#[rustc_diagnostic_item = "RefCell"]
#[stable(feature = "rust1", since = "1.0.0")]
pub struct RefCell<#[rustc_assert_variance(invariant)] T: ?Sized> {
    borrow: Cell<BorrowCounter>,
    // Stores the location of the earliest currently active borrow.
    // This gets updated whenever we go from having zero borrows
    // to having a single borrow. When a borrow occurs, this gets included
    // in the generated `BorrowError`/`BorrowMutError`
    #[cfg(feature = "debug_refcell")]
    borrowed_at: Cell<Option<&'static crate::panic::Location<'static>>>,
    value: UnsafeCell<T>,
}

/// An error returned by [`RefCell::try_borrow`].
#[stable(feature = "try_borrow", since = "1.13.0")]
#[non_exhaustive]
#[derive(Debug)]
pub struct BorrowError {
    #[cfg(feature = "debug_refcell")]
    location: &'static crate::panic::Location<'static>,
}

#[stable(feature = "try_borrow", since = "1.13.0")]
impl Display for BorrowError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        #[cfg(feature = "debug_refcell")]
        let res = write!(
            f,
            "RefCell already mutably borrowed; a previous borrow was at {}",
            self.location
        );

        #[cfg(not(feature = "debug_refcell"))]
        let res = Display::fmt("RefCell already mutably borrowed", f);

        res
    }
}

/// An error returned by [`RefCell::try_borrow_mut`].
#[stable(feature = "try_borrow", since = "1.13.0")]
#[non_exhaustive]
#[derive(Debug)]
pub struct BorrowMutError {
    #[cfg(feature = "debug_refcell")]
    location: &'static crate::panic::Location<'static>,
}

#[stable(feature = "try_borrow", since = "1.13.0")]
impl Display for BorrowMutError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        #[cfg(feature = "debug_refcell")]
        let res = write!(f, "RefCell already borrowed; a previous borrow was at {}", self.location);

        #[cfg(not(feature = "debug_refcell"))]
        let res = Display::fmt("RefCell already borrowed", f);

        res
    }
}

// This ensures the panicking code is outlined from `borrow_mut` for `RefCell`.
#[cfg_attr(not(panic = "immediate-abort"), inline(never))]
#[track_caller]
#[cold]
const fn panic_already_borrowed(err: BorrowMutError) -> ! {
    const_panic!(
        "RefCell already borrowed",
        "{err}",
        err: BorrowMutError = err,
    )
}

// This ensures the panicking code is outlined from `borrow` for `RefCell`.
#[cfg_attr(not(panic = "immediate-abort"), inline(never))]
#[track_caller]
#[cold]
const fn panic_already_mutably_borrowed(err: BorrowError) -> ! {
    const_panic!(
        "RefCell already mutably borrowed",
        "{err}",
        err: BorrowError = err,
    )
}

// Positive values represent the number of `Ref` active. Negative values
// represent the number of `RefMut` active. Multiple `RefMut`s can only be
// active at a time if they refer to distinct, nonoverlapping components of a
// `RefCell` (e.g., different ranges of a slice).
//
// `Ref` and `RefMut` are both two words in size, and so there will likely never
// be enough `Ref`s or `RefMut`s in existence to overflow half of the `usize`
// range. Thus, a `BorrowCounter` will probably never overflow or underflow.
// However, this is not a guarantee, as a pathological program could repeatedly
// create and then mem::forget `Ref`s or `RefMut`s. Thus, all code must
// explicitly check for overflow and underflow in order to avoid unsafety, or at
// least behave correctly in the event that overflow or underflow happens (e.g.,
// see BorrowRef::new).
type BorrowCounter = isize;
const UNUSED: BorrowCounter = 0;

#[inline(always)]
const fn is_writing(x: BorrowCounter) -> bool {
    x < UNUSED
}

#[inline(always)]
const fn is_reading(x: BorrowCounter) -> bool {
    x > UNUSED
}

impl<T> RefCell<T> {
    /// Creates a new `RefCell` containing `value`.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::cell::RefCell;
    ///
    /// let c = RefCell::new(5);
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_refcell_new", since = "1.24.0")]
    #[inline]
    pub const fn new(value: T) -> RefCell<T> {
        RefCell {
            value: UnsafeCell::new(value),
            borrow: Cell::new(UNUSED),
            #[cfg(feature = "debug_refcell")]
            borrowed_at: Cell::new(None),
        }
    }

    /// Consumes the `RefCell`, returning the wrapped value.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::cell::RefCell;
    ///
    /// let c = RefCell::new(5);
    ///
    /// let five = c.into_inner();
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_cell_into_inner", since = "1.83.0")]
    #[rustc_allow_const_fn_unstable(const_precise_live_drops)]
    #[inline]
    pub const fn into_inner(self) -> T {
        // Since this function takes `self` (the `RefCell`) by value, the
        // compiler statically verifies that it is not currently borrowed.
        self.value.into_inner()
    }

    /// 用新值替换包装的值，返回旧值，
    /// 无需解构两者。
    ///
    /// This function corresponds to [`std::mem::replace`](../mem/fn.replace.html).
    ///
    /// # Panic
    ///
    /// 如果值当前被借用，则触发 panic。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::cell::RefCell;
    /// let cell = RefCell::new(5);
    /// let old_value = cell.replace(6);
    /// assert_eq!(old_value, 5);
    /// assert_eq!(cell, RefCell::new(6));
    /// ```
    #[inline]
    #[stable(feature = "refcell_replace", since = "1.24.0")]
    #[track_caller]
    #[rustc_confusables("swap")]
    #[rustc_const_unstable(feature = "const_ref_cell", issue = "137844")]
    #[lint::should_not_be_called_on_const_items]
    pub const fn replace(&self, t: T) -> T {
        mem::replace(&mut self.borrow_mut(), t)
    }

    /// Replaces the wrapped value with a new one computed from `f`, returning
    /// 旧值，无需解构两者。
    ///
    /// # Panic
    ///
    /// 如果值当前被借用，则触发 panic。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::cell::RefCell;
    /// let cell = RefCell::new(5);
    /// let old_value = cell.replace_with(|&mut old| old + 1);
    /// assert_eq!(old_value, 5);
    /// assert_eq!(cell, RefCell::new(6));
    /// ```
    #[inline]
    #[stable(feature = "refcell_replace_swap", since = "1.35.0")]
    #[track_caller]
    #[lint::should_not_be_called_on_const_items]
    pub fn replace_with<F: FnOnce(&mut T) -> T>(&self, f: F) -> T {
        let mut_borrow = &mut *self.borrow_mut();
        let replacement = f(mut_borrow);
        mem::replace(mut_borrow, replacement)
    }

    /// Swaps the wrapped value of `self` with the wrapped value of `other`,
    /// 无需解构两者。
    ///
    /// This function corresponds to [`std::mem::swap`](../mem/fn.swap.html).
    ///
    /// # Panic
    ///
    /// Panics if the value in either `RefCell` is currently borrowed, or
    /// if `self` and `other` point to the same `RefCell`.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::cell::RefCell;
    /// let c = RefCell::new(5);
    /// let d = RefCell::new(6);
    /// c.swap(&d);
    /// assert_eq!(c, RefCell::new(6));
    /// assert_eq!(d, RefCell::new(5));
    /// ```
    #[inline]
    #[stable(feature = "refcell_swap", since = "1.24.0")]
    #[rustc_const_unstable(feature = "const_ref_cell", issue = "137844")]
    #[lint::should_not_be_called_on_const_items]
    pub const fn swap(&self, other: &Self) {
        mem::swap(&mut *self.borrow_mut(), &mut *other.borrow_mut())
    }
}

impl<T: ?Sized> RefCell<T> {
    /// 不可变地借用包装值。
    ///
    /// The borrow lasts until the returned `Ref` exits scope. Multiple
    /// 不可变借用。
    ///
    /// # Panic
    ///
    /// 如果值当前被可变借用，则触发 panic。对于非 panic 情况，请使用
    /// [`try_borrow`](#method.try_borrow).
    ///
    /// # 示例
    ///
    /// ```
    /// use std::cell::RefCell;
    ///
    /// let c = RefCell::new(5);
    ///
    /// let borrowed_five = c.borrow();
    /// let borrowed_five2 = c.borrow();
    /// ```
    ///
    /// panic 的一个示例：
    ///
    /// ```should_panic
    /// use std::cell::RefCell;
    ///
    /// let c = RefCell::new(5);
    ///
    /// let m = c.borrow_mut();
    /// let b = c.borrow(); // this causes a panic
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    #[track_caller]
    #[rustc_const_unstable(feature = "const_ref_cell", issue = "137844")]
    #[lint::should_not_be_called_on_const_items]
    pub const fn borrow(&self) -> Ref<'_, T> {
        match self.try_borrow() {
            Ok(b) => b,
            Err(err) => panic_already_mutably_borrowed(err),
        }
    }

    /// 不可变地借用包装值，如果值当前被可变借用，则返回错误。
    /// 借用。
    ///
    /// The borrow lasts until the returned `Ref` exits scope. Multiple immutable borrows can be
    /// 。
    ///
    /// This is the non-panicking variant of [`borrow`](#method.borrow).
    ///
    /// # 示例
    ///
    /// ```
    /// use std::cell::RefCell;
    ///
    /// let c = RefCell::new(5);
    ///
    /// {
    ///     let m = c.borrow_mut();
    ///     assert!(c.try_borrow().is_err());
    /// }
    ///
    /// {
    ///     let m = c.borrow();
    ///     assert!(c.try_borrow().is_ok());
    /// }
    /// ```
    #[stable(feature = "try_borrow", since = "1.13.0")]
    #[inline]
    #[cfg_attr(feature = "debug_refcell", track_caller)]
    #[rustc_const_unstable(feature = "const_ref_cell", issue = "137844")]
    #[lint::should_not_be_called_on_const_items]
    pub const fn try_borrow(&self) -> Result<Ref<'_, T>, BorrowError> {
        match BorrowRef::new(&self.borrow) {
            Some(b) => {
                #[cfg(feature = "debug_refcell")]
                {
                    // `borrowed_at` is always the *first* active borrow
                    if b.borrow.get() == 1 {
                        self.borrowed_at.replace(Some(crate::panic::Location::caller()));
                    }
                }

                // SAFETY: `BorrowRef` ensures that there is only immutable access
                // to the value while borrowed.
                let value = unsafe { NonNull::new_unchecked(self.value.get()) };
                Ok(Ref { value, borrow: b })
            }
            None => Err(BorrowError {
                // If a borrow occurred, then we must already have an outstanding borrow,
                // so `borrowed_at` will be `Some`
                #[cfg(feature = "debug_refcell")]
                location: self.borrowed_at.get().unwrap(),
            }),
        }
    }

    /// 可变地借用包装值。
    ///
    /// The borrow lasts until the returned `RefMut` or all `RefMut`s derived
    /// 从 `it` 退出作用域。在此借用期间无法借用该值。
    /// 活动状态。
    ///
    /// # 恐慌
    ///
    /// 如果值当前被借用，则触发恐慌。对于非恐慌版本，请使用
    /// [`try_borrow_mut`](#method.try_borrow_mut).
    ///
    /// # 示例
    ///
    /// ```
    /// use std::cell::RefCell;
    ///
    /// let c = RefCell::new("hello".to_owned());
    ///
    /// *c.borrow_mut() = "bonjour".to_owned();
    ///
    /// assert_eq!(&*c.borrow(), "bonjour");
    /// ```
    ///
    /// 一个恐慌示例：
    ///
    /// ```should_panic
    /// use std::cell::RefCell;
    ///
    /// let c = RefCell::new(5);
    /// let m = c.borrow();
    ///
    /// let b = c.borrow_mut(); // this causes a panic
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    #[track_caller]
    #[rustc_const_unstable(feature = "const_ref_cell", issue = "137844")]
    #[lint::should_not_be_called_on_const_items]
    pub const fn borrow_mut(&self) -> RefMut<'_, T> {
        match self.try_borrow_mut() {
            Ok(b) => b,
            Err(err) => panic_already_borrowed(err),
        }
    }

    /// 可修改地借用包装后的值，如果值当前被借用则返回错误。
    ///
    /// The borrow lasts until the returned `RefMut` or all `RefMut`s derived
    /// 从 `it` 退出作用域。在此借用期间无法借用该值。
    /// 活动状态。
    ///
    /// This is the non-panicking variant of [`borrow_mut`](#method.borrow_mut).
    ///
    /// # 示例
    ///
    /// ```
    /// use std::cell::RefCell;
    ///
    /// let c = RefCell::new(5);
    ///
    /// {
    ///     let m = c.borrow();
    ///     assert!(c.try_borrow_mut().is_err());
    /// }
    ///
    /// assert!(c.try_borrow_mut().is_ok());
    /// ```
    #[stable(feature = "try_borrow", since = "1.13.0")]
    #[inline]
    #[cfg_attr(feature = "debug_refcell", track_caller)]
    #[rustc_const_unstable(feature = "const_ref_cell", issue = "137844")]
    #[lint::should_not_be_called_on_const_items]
    pub const fn try_borrow_mut(&self) -> Result<RefMut<'_, T>, BorrowMutError> {
        match BorrowRefMut::new(&self.borrow) {
            Some(b) => {
                #[cfg(feature = "debug_refcell")]
                {
                    self.borrowed_at.replace(Some(crate::panic::Location::caller()));
                }

                // SAFETY: `BorrowRefMut` guarantees unique access.
                let value = unsafe { NonNull::new_unchecked(self.value.get()) };
                Ok(RefMut { value, borrow: b, marker: PhantomData })
            }
            None => Err(BorrowMutError {
                // If a borrow occurred, then we must already have an outstanding borrow,
                // so `borrowed_at` will be `Some`
                #[cfg(feature = "debug_refcell")]
                location: self.borrowed_at.get().unwrap(),
            }),
        }
    }

    /// 返回指向此单元中底层数据的原始指针。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::cell::RefCell;
    ///
    /// let c = RefCell::new(5);
    ///
    /// let ptr = c.as_ptr();
    /// ```
    #[inline]
    #[stable(feature = "cell_as_ptr", since = "1.12.0")]
    #[rustc_const_unstable(feature = "const_ref_cell", issue = "137844")]
    #[lint::as_ptr]
    #[lint::never_returns_null_ptr]
    pub const fn as_ptr(&self) -> *mut T {
        self.value.get()
    }

    /// 返回对底层数据的可修改引用。
    ///
    /// Since this method borrows `RefCell` mutably, it is statically guaranteed
    /// that no borrows to the underlying data exist. The dynamic checks inherent
    /// in [`borrow_mut`] and most other methods of `RefCell` are therefore
    /// unnecessary. Note that this method does not reset the borrowing state if borrows were previously leaked
    /// (e.g., via [`forget()`] on a [`Ref`] or [`RefMut`]). For that purpose,
    /// consider using the unstable [`undo_leak`] method.
    ///
    /// This method can only be called if `RefCell` can be mutably borrowed,
    /// which in general is only the case directly after the `RefCell` has
    /// been created. In these situations, skipping the aforementioned dynamic
    /// # 示例
    ///
    /// In most situations where `RefCell` is used, it can't be borrowed mutably.
    /// Use [`borrow_mut`] to get mutable access to the underlying data then.
    ///
    /// [`borrow_mut`]: RefCell::borrow_mut()
    /// [`forget()`]: mem::forget
    /// [`undo_leak`]: RefCell::undo_leak()
    ///
    /// # Examples
    ///
    /// ```
    /// use std::cell::RefCell;
    ///
    /// let mut c = RefCell::new(5);
    /// *c.get_mut() += 1;
    ///
    /// assert_eq!(c, RefCell::new(6));
    /// ```
    #[inline]
    #[stable(feature = "cell_get_mut", since = "1.11.0")]
    #[rustc_const_unstable(feature = "const_ref_cell", issue = "137844")]
    pub const fn get_mut(&mut self) -> &mut T {
        self.value.get_mut()
    }

    /// Undo the effect of leaked guards on the borrow state of the `RefCell`.
    ///
    /// This call is similar to [`get_mut`] but more specialized. It borrows `RefCell` mutably to
    /// # 安全性
    /// if some `Ref` or `RefMut` borrows have been leaked.
    ///
    /// [`get_mut`]: RefCell::get_mut()
    ///
    /// # Examples
    ///
    /// ```
    /// #![feature(cell_leak)]
    /// use std::cell::RefCell;
    ///
    /// let mut c = RefCell::new(0);
    /// std::mem::forget(c.borrow_mut());
    ///
    /// assert!(c.try_borrow().is_err());
    /// c.undo_leak();
    /// assert!(c.try_borrow().is_ok());
    /// ```
    #[unstable(feature = "cell_leak", issue = "69099")]
    #[rustc_const_unstable(feature = "const_ref_cell", issue = "137844")]
    pub const fn undo_leak(&mut self) -> &mut T {
        *self.borrow.get_mut() = UNUSED;
        self.get_mut()
    }

    /// Immutably borrows the wrapped value, returning an error if the value is
    /// # 示例
    ///
    /// # Safety
    ///
    /// Unlike `RefCell::borrow`, this method is unsafe because it does not
    /// return a `Ref`, thus leaving the borrow flag untouched. Mutably
    /// borrowing the `RefCell` while the reference returned by this method
    /// is alive is undefined behavior.
    ///
    /// # Examples
    ///
    /// ```
    /// use std::cell::RefCell;
    ///
    /// let c = RefCell::new(5);
    ///
    /// {
    ///     let m = c.borrow_mut();
    ///     assert!(unsafe { c.try_borrow_unguarded() }.is_err());
    /// }
    ///
    /// {
    ///     let m = c.borrow();
    ///     assert!(unsafe { c.try_borrow_unguarded() }.is_ok());
    /// }
    /// ```
    #[stable(feature = "borrow_state", since = "1.37.0")]
    #[inline]
    #[rustc_const_unstable(feature = "const_ref_cell", issue = "137844")]
    pub const unsafe fn try_borrow_unguarded(&self) -> Result<&T, BorrowError> {
        if !is_writing(self.borrow.get()) {
            // SAFETY: We check that nobody is actively writing now, but it is
            // the caller's responsibility to ensure that nobody writes until
            // the returned reference is no longer in use.
            // Also, `self.value.get()` refers to the value owned by `self`
            // and is thus guaranteed to be valid for the lifetime of `self`.
            Ok(unsafe { &*self.value.get() })
        } else {
            Err(BorrowError {
                // If a borrow occurred, then we must already have an outstanding borrow,
                // so `borrowed_at` will be `Some`
                #[cfg(feature = "debug_refcell")]
                location: self.borrowed_at.get().unwrap(),
            })
        }
    }
}

impl<T: Default> RefCell<T> {
    /// Takes the wrapped value, leaving `Default::default()` in its place.
    ///
    /// # Panics
    ///
    /// Panics if the value is currently borrowed.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::cell::RefCell;
    ///
    /// let c = RefCell::new(5);
    /// let five = c.take();
    ///
    /// assert_eq!(five, 5);
    /// assert_eq!(c.into_inner(), 0);
    /// ```
    #[stable(feature = "refcell_take", since = "1.50.0")]
    pub fn take(&self) -> T {
        self.replace(Default::default())
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
unsafe impl<T: ?Sized> Send for RefCell<T> where T: Send {}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T: ?Sized> !Sync for RefCell<T> {}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T: Clone> Clone for RefCell<T> {
    /// # 异常
    ///
    /// 如果值当前可被可变借用，则引发异常。
    #[inline]
    #[track_caller]
    fn clone(&self) -> RefCell<T> {
        RefCell::new(self.borrow().clone())
    }

    /// # 异常
    ///
    /// Panics if `source` is currently mutably borrowed.
    #[inline]
    #[track_caller]
    fn clone_from(&mut self, source: &Self) {
        self.get_mut().clone_from(&source.borrow())
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_const_unstable(feature = "const_default", issue = "143894")]
const impl<T: [const] Default> Default for RefCell<T> {
    /// Creates a `RefCell<T>`, with the `Default` value for T.
    #[inline]
    fn default() -> RefCell<T> {
        RefCell::new(Default::default())
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T: ?Sized + PartialEq> PartialEq for RefCell<T> {
    /// # 异常
    ///
    /// Panics if the value in either `RefCell` is currently mutably borrowed.
    #[inline]
    fn eq(&self, other: &RefCell<T>) -> bool {
        *self.borrow() == *other.borrow()
    }
}

#[stable(feature = "cell_eq", since = "1.2.0")]
impl<T: ?Sized + Eq> Eq for RefCell<T> {}

#[stable(feature = "cell_ord", since = "1.10.0")]
impl<T: ?Sized + PartialOrd> PartialOrd for RefCell<T> {
    /// # 异常
    ///
    /// Panics if the value in either `RefCell` is currently mutably borrowed.
    #[inline]
    fn partial_cmp(&self, other: &RefCell<T>) -> Option<Ordering> {
        self.borrow().partial_cmp(&*other.borrow())
    }

    /// # 异常
    ///
    /// Panics if the value in either `RefCell` is currently mutably borrowed.
    #[inline]
    fn lt(&self, other: &RefCell<T>) -> bool {
        *self.borrow() < *other.borrow()
    }

    /// # 异常
    ///
    /// Panics if the value in either `RefCell` is currently mutably borrowed.
    #[inline]
    fn le(&self, other: &RefCell<T>) -> bool {
        *self.borrow() <= *other.borrow()
    }

    /// # 异常
    ///
    /// Panics if the value in either `RefCell` is currently mutably borrowed.
    #[inline]
    fn gt(&self, other: &RefCell<T>) -> bool {
        *self.borrow() > *other.borrow()
    }

    /// # 异常
    ///
    /// Panics if the value in either `RefCell` is currently mutably borrowed.
    #[inline]
    fn ge(&self, other: &RefCell<T>) -> bool {
        *self.borrow() >= *other.borrow()
    }
}

#[stable(feature = "cell_ord", since = "1.10.0")]
impl<T: ?Sized + Ord> Ord for RefCell<T> {
    /// # 异常
    ///
    /// Panics if the value in either `RefCell` is currently mutably borrowed.
    #[inline]
    fn cmp(&self, other: &RefCell<T>) -> Ordering {
        self.borrow().cmp(&*other.borrow())
    }
}

#[stable(feature = "cell_from", since = "1.12.0")]
#[rustc_const_unstable(feature = "const_convert", issue = "143773")]
const impl<T> From<T> for RefCell<T> {
    /// Creates a new `RefCell<T>` containing the given value.
    fn from(t: T) -> RefCell<T> {
        RefCell::new(t)
    }
}

#[unstable(feature = "coerce_unsized", issue = "18598")]
impl<T: CoerceUnsized<U>, U> CoerceUnsized<RefCell<U>> for RefCell<T> {}

struct BorrowRef<'b> {
    borrow: &'b Cell<BorrowCounter>,
}

impl<'b> BorrowRef<'b> {
    #[inline]
    const fn new(borrow: &'b Cell<BorrowCounter>) -> Option<BorrowRef<'b>> {
        let b = borrow.get().wrapping_add(1);
        if !is_reading(b) {
            // Incrementing borrow can result in a non-reading value (<= 0) in these cases:
            // 1. It was < 0, i.e. there are writing borrows, so we can't allow a read borrow
            //    due to Rust's reference aliasing rules
            // 2. It was isize::MAX (the max amount of reading borrows) and it overflowed
            //    into isize::MIN (the max amount of writing borrows) so we can't allow
            //    an additional read borrow because isize can't represent so many read borrows
            //    (this can only happen if you mem::forget more than a small constant amount of
            //    `Ref`s, which is not good practice)
            None
        } else {
            // Incrementing borrow can result in a reading value (> 0) in these cases:
            // 1. It was = 0, i.e. it wasn't borrowed, and we are taking the first read borrow
            // 2. It was > 0 and < isize::MAX, i.e. there were read borrows, and isize
            //    is large enough to represent having one more read borrow
            borrow.replace(b);
            Some(BorrowRef { borrow })
        }
    }
}

#[rustc_const_unstable(feature = "const_ref_cell", issue = "137844")]
const impl Drop for BorrowRef<'_> {
    #[inline]
    fn drop(&mut self) {
        let borrow = self.borrow.get();
        debug_assert!(is_reading(borrow));
        self.borrow.replace(borrow - 1);
    }
}

#[rustc_const_unstable(feature = "const_ref_cell", issue = "137844")]
const impl Clone for BorrowRef<'_> {
    #[inline]
    fn clone(&self) -> Self {
        // Since this Ref exists, we know the borrow flag
        // is a reading borrow.
        let borrow = self.borrow.get();
        debug_assert!(is_reading(borrow));
        // Prevent the borrow counter from overflowing into
        // a writing borrow.
        assert!(borrow != BorrowCounter::MAX);
        self.borrow.replace(borrow + 1);
        BorrowRef { borrow: self.borrow }
    }
}

/// Wraps a borrowed reference to a value in a `RefCell` box.
/// A wrapper type for an immutably borrowed value from a `RefCell<T>`.
///
/// See the [module-level documentation](self) for more.
#[stable(feature = "rust1", since = "1.0.0")]
#[must_not_suspend = "holding a Ref across suspend points can cause BorrowErrors"]
#[rustc_diagnostic_item = "RefCellRef"]
pub struct Ref<'b, T: ?Sized + 'b> {
    // NB: we use a pointer instead of `&'b T` to avoid `noalias` violations, because a
    // `Ref` argument doesn't hold immutability for its whole scope, only until it drops.
    // `NonNull` is also covariant over `T`, just like we would have with `&T`.
    value: NonNull<T>,
    borrow: BorrowRef<'b>,
}

#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_const_unstable(feature = "const_convert", issue = "143773")]
const impl<T: ?Sized> Deref for Ref<'_, T> {
    type Target = T;

    #[inline]
    fn deref(&self) -> &T {
        // SAFETY: the value is accessible as long as we hold our borrow.
        unsafe { self.value.as_ref() }
    }
}

#[unstable(feature = "deref_pure_trait", issue = "87121")]
unsafe impl<T: ?Sized> DerefPure for Ref<'_, T> {}

impl<'b, T: ?Sized> Ref<'b, T> {
    /// Copies a `Ref`.
    ///
    /// The `RefCell` is already immutably borrowed, so this cannot fail.
    ///
    /// 这是一个关联函数，需要作为
    /// `Ref::clone(...)`. A `Clone` implementation or a method would interfere
    /// with the widespread use of `r.borrow().clone()` to clone the contents of
    /// a `RefCell`.
    #[stable(feature = "cell_extras", since = "1.15.0")]
    #[must_use]
    #[inline]
    #[rustc_const_unstable(feature = "const_ref_cell", issue = "137844")]
    pub const fn clone(orig: &Ref<'b, T>) -> Ref<'b, T> {
        Ref { value: orig.value, borrow: orig.borrow.clone() }
    }

    /// Makes a new `Ref` for a component of the borrowed data.
    ///
    /// The `RefCell` is already immutably borrowed, so this cannot fail.
    ///
    /// This is an associated function that needs to be used as `Ref::map(...)`.
    /// A method would interfere with methods of the same name on the contents
    /// of a `RefCell` used through `Deref`.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::cell::{RefCell, Ref};
    ///
    /// let c = RefCell::new((5, 'b'));
    /// let b1: Ref<'_, (u32, char)> = c.borrow();
    /// let b2: Ref<'_, u32> = Ref::map(b1, |t| &t.0);
    /// assert_eq!(*b2, 5)
    /// ```
    #[stable(feature = "cell_map", since = "1.8.0")]
    #[inline]
    pub fn map<U: ?Sized, F>(orig: Ref<'b, T>, f: F) -> Ref<'b, U>
    where
        F: FnOnce(&T) -> &U,
    {
        Ref { value: NonNull::from(f(&*orig)), borrow: orig.borrow }
    }

    /// Makes a new `Ref` for an optional component of the borrowed data. The
    /// original guard is returned as an `Err(..)` if the closure returns
    /// `None`.
    ///
    /// The `RefCell` is already immutably borrowed, so this cannot fail.
    ///
    /// 这是一个关联函数，需要作为
    /// `Ref::filter_map(...)`. A method would interfere with methods of the same
    /// name on the contents of a `RefCell` used through `Deref`.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::cell::{RefCell, Ref};
    ///
    /// let c = RefCell::new(vec![1, 2, 3]);
    /// let b1: Ref<'_, Vec<u32>> = c.borrow();
    /// let b2: Result<Ref<'_, u32>, _> = Ref::filter_map(b1, |v| v.get(1));
    /// assert_eq!(*b2.unwrap(), 2);
    /// ```
    #[stable(feature = "cell_filter_map", since = "1.63.0")]
    #[inline]
    pub fn filter_map<U: ?Sized, F>(orig: Ref<'b, T>, f: F) -> Result<Ref<'b, U>, Self>
    where
        F: FnOnce(&T) -> Option<&U>,
    {
        match f(&*orig) {
            Some(value) => Ok(Ref { value: NonNull::from(value), borrow: orig.borrow }),
            None => Err(orig),
        }
    }

    /// Tries to makes a new `Ref` for a component of the borrowed data.
    /// 如果失败，则同时返回原始保护机制和闭包返回的错误。
    /// returned by the closure.
    ///
    /// The `RefCell` is already immutably borrowed, so this cannot fail.
    ///
    /// 这是一个关联函数，需要作为
    /// `Ref::try_map(...)`. A method would interfere with methods of the same
    /// name on the contents of a `RefCell` used through `Deref`.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(refcell_try_map)]
    /// use std::cell::{RefCell, Ref};
    /// use std::str::{from_utf8, Utf8Error};
    ///
    /// let c = RefCell::new(vec![0xF0, 0x9F, 0xA6 ,0x80]);
    /// let b1: Ref<'_, Vec<u8>> = c.borrow();
    /// let b2: Result<Ref<'_, str>, _> = Ref::try_map(b1, |v| from_utf8(v));
    /// assert_eq!(&*b2.unwrap(), "🦀");
    ///
    /// let c = RefCell::new(vec![0xF0, 0x9F, 0xA6]);
    /// let b1: Ref<'_, Vec<u8>> = c.borrow();
    /// let b2: Result<_, (Ref<'_, Vec<u8>>, Utf8Error)> = Ref::try_map(b1, |v| from_utf8(v));
    /// let (b3, e) = b2.unwrap_err();
    /// assert_eq!(*b3, vec![0xF0, 0x9F, 0xA6]);
    /// assert_eq!(e.valid_up_to(), 0);
    /// ```
    #[unstable(feature = "refcell_try_map", issue = "143801")]
    #[inline]
    pub fn try_map<U: ?Sized, E>(
        orig: Ref<'b, T>,
        f: impl FnOnce(&T) -> Result<&U, E>,
    ) -> Result<Ref<'b, U>, (Self, E)> {
        match f(&*orig) {
            Ok(value) => Ok(Ref { value: NonNull::from(value), borrow: orig.borrow }),
            Err(e) => Err((orig, e)),
        }
    }

    /// Splits a `Ref` into multiple `Ref`s for different components of the
    /// 被借用的数据。
    ///
    /// The `RefCell` is already immutably borrowed, so this cannot fail.
    ///
    /// 这是一个关联函数，需要作为
    /// `Ref::map_split(...)`. A method would interfere with methods of the same
    /// name on the contents of a `RefCell` used through `Deref`.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::cell::{Ref, RefCell};
    ///
    /// let cell = RefCell::new([1, 2, 3, 4]);
    /// let borrow = cell.borrow();
    /// let (begin, end) = Ref::map_split(borrow, |slice| slice.split_at(2));
    /// assert_eq!(*begin, [1, 2]);
    /// assert_eq!(*end, [3, 4]);
    /// ```
    #[stable(feature = "refcell_map_split", since = "1.35.0")]
    #[inline]
    pub fn map_split<U: ?Sized, V: ?Sized, F>(orig: Ref<'b, T>, f: F) -> (Ref<'b, U>, Ref<'b, V>)
    where
        F: FnOnce(&T) -> (&U, &V),
    {
        let (a, b) = f(&*orig);
        let borrow = orig.borrow.clone();
        (
            Ref { value: NonNull::from(a), borrow },
            Ref { value: NonNull::from(b), borrow: orig.borrow },
        )
    }

    /// 转换为对底层数据的引用。
    ///
    /// The underlying `RefCell` can never be mutably borrowed from again and will always appear
    /// 不可变地被借用的状态。泄露超过固定数量的
    /// references. The `RefCell` can be immutably borrowed again if only a smaller number of leaks
    /// have occurred in total.
    ///
    /// 这是一个关联函数，需要作为
    /// `Ref::leak(...)`. A method would interfere with methods of the
    /// same name on the contents of a `RefCell` used through `Deref`.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(cell_leak)]
    /// use std::cell::{RefCell, Ref};
    /// let cell = RefCell::new(0);
    ///
    /// let value = Ref::leak(cell.borrow());
    /// assert_eq!(*value, 0);
    ///
    /// assert!(cell.try_borrow().is_ok());
    /// assert!(cell.try_borrow_mut().is_err());
    /// ```
    #[unstable(feature = "cell_leak", issue = "69099")]
    #[rustc_const_unstable(feature = "const_ref_cell", issue = "137844")]
    pub const fn leak(orig: Ref<'b, T>) -> &'b T {
        // By forgetting this Ref we ensure that the borrow counter in the RefCell can't go back to
        // UNUSED within the lifetime `'b`. Resetting the reference tracking state would require a
        // unique reference to the borrowed RefCell. No further mutable references can be created
        // from the original cell.
        mem::forget(orig.borrow);
        // SAFETY: after forgetting, we can form a reference for the rest of lifetime `'b`.
        unsafe { orig.value.as_ref() }
    }
}

#[unstable(feature = "coerce_unsized", issue = "18598")]
impl<'b, T: ?Sized + Unsize<U>, U: ?Sized> CoerceUnsized<Ref<'b, U>> for Ref<'b, T> {}

#[stable(feature = "std_guard_impls", since = "1.20.0")]
impl<T: ?Sized + fmt::Display> fmt::Display for Ref<'_, T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        (**self).fmt(f)
    }
}

impl<'b, T: ?Sized> RefMut<'b, T> {
    /// Makes a new `RefMut` for a component of the borrowed data, e.g., an enum
    /// variant.
    ///
    /// The `RefCell` is already mutably borrowed, so this cannot fail.
    ///
    /// This is an associated function that needs to be used as
    /// `RefMut::map(...)`. A method would interfere with methods of the same
    /// name on the contents of a `RefCell` used through `Deref`.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::cell::{RefCell, RefMut};
    ///
    /// let c = RefCell::new((5, 'b'));
    /// {
    ///     let b1: RefMut<'_, (u32, char)> = c.borrow_mut();
    ///     let mut b2: RefMut<'_, u32> = RefMut::map(b1, |t| &mut t.0);
    ///     assert_eq!(*b2, 5);
    ///     *b2 = 42;
    /// }
    /// assert_eq!(*c.borrow(), (42, 'b'));
    /// ```
    #[stable(feature = "cell_map", since = "1.8.0")]
    #[inline]
    pub fn map<U: ?Sized, F>(mut orig: RefMut<'b, T>, f: F) -> RefMut<'b, U>
    where
        F: FnOnce(&mut T) -> &mut U,
    {
        let value = NonNull::from(f(&mut *orig));
        RefMut { value, borrow: orig.borrow, marker: PhantomData }
    }

    /// Makes a new `RefMut` for an optional component of the borrowed data. The
    /// original guard is returned as an `Err(..)` if the closure returns
    /// `None`.
    ///
    /// The `RefCell` is already mutably borrowed, so this cannot fail.
    ///
    /// 这是一个关联函数，需要作为
    /// `RefMut::filter_map(...)`. A method would interfere with methods of the
    /// same name on the contents of a `RefCell` used through `Deref`.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::cell::{RefCell, RefMut};
    ///
    /// let c = RefCell::new(vec![1, 2, 3]);
    ///
    /// {
    ///     let b1: RefMut<'_, Vec<u32>> = c.borrow_mut();
    ///     let mut b2: Result<RefMut<'_, u32>, _> = RefMut::filter_map(b1, |v| v.get_mut(1));
    ///
    ///     if let Ok(mut b2) = b2 {
    ///         *b2 += 2;
    ///     }
    /// }
    ///
    /// assert_eq!(*c.borrow(), vec![1, 4, 3]);
    /// ```
    #[stable(feature = "cell_filter_map", since = "1.63.0")]
    #[inline]
    pub fn filter_map<U: ?Sized, F>(mut orig: RefMut<'b, T>, f: F) -> Result<RefMut<'b, U>, Self>
    where
        F: FnOnce(&mut T) -> Option<&mut U>,
    {
        // SAFETY: function holds onto an exclusive reference for the duration
        // of its call through `orig`, and the pointer is only de-referenced
        // inside of the function call never allowing the exclusive reference to
        // escape.
        match f(&mut *orig) {
            Some(value) => {
                Ok(RefMut { value: NonNull::from(value), borrow: orig.borrow, marker: PhantomData })
            }
            None => Err(orig),
        }
    }

    /// Tries to makes a new `RefMut` for a component of the borrowed data.
    /// 如果失败，则同时返回原始保护机制和错误。
    /// 由闭包返回的。
    ///
    /// The `RefCell` is already mutably borrowed, so this cannot fail.
    ///
    /// 这是一个关联函数，需要作为
    /// `RefMut::try_map(...)`. A method would interfere with methods of the same
    /// name on the contents of a `RefCell` used through `Deref`.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(refcell_try_map)]
    /// use std::cell::{RefCell, RefMut};
    /// use std::str::{from_utf8_mut, Utf8Error};
    ///
    /// let c = RefCell::new(vec![0x68, 0x65, 0x6C, 0x6C, 0x6F]);
    /// {
    ///     let b1: RefMut<'_, Vec<u8>> = c.borrow_mut();
    ///     let b2: Result<RefMut<'_, str>, _> = RefMut::try_map(b1, |v| from_utf8_mut(v));
    ///     let mut b2 = b2.unwrap();
    ///     assert_eq!(&*b2, "hello");
    ///     b2.make_ascii_uppercase();
    /// }
    /// assert_eq!(*c.borrow(), "HELLO".as_bytes());
    ///
    /// let c = RefCell::new(vec![0xFF]);
    /// let b1: RefMut<'_, Vec<u8>> = c.borrow_mut();
    /// let b2: Result<_, (RefMut<'_, Vec<u8>>, Utf8Error)> = RefMut::try_map(b1, |v| from_utf8_mut(v));
    /// let (b3, e) = b2.unwrap_err();
    /// assert_eq!(*b3, vec![0xFF]);
    /// assert_eq!(e.valid_up_to(), 0);
    /// ```
    #[unstable(feature = "refcell_try_map", issue = "143801")]
    #[inline]
    pub fn try_map<U: ?Sized, E>(
        mut orig: RefMut<'b, T>,
        f: impl FnOnce(&mut T) -> Result<&mut U, E>,
    ) -> Result<RefMut<'b, U>, (Self, E)> {
        // SAFETY: function holds onto an exclusive reference for the duration
        // of its call through `orig`, and the pointer is only de-referenced
        // inside of the function call never allowing the exclusive reference to
        // escape.
        match f(&mut *orig) {
            Ok(value) => {
                Ok(RefMut { value: NonNull::from(value), borrow: orig.borrow, marker: PhantomData })
            }
            Err(e) => Err((orig, e)),
        }
    }

    /// Splits a `RefMut` into multiple `RefMut`s for different components of the
    /// 被借用的数据。
    ///
    /// The underlying `RefCell` will remain mutably borrowed until both
    /// returned `RefMut`s go out of scope.
    ///
    /// The `RefCell` is already mutably borrowed, so this cannot fail.
    ///
    /// 这是一个关联函数，需要被用作
    /// `RefMut::map_split(...)`. A method would interfere with methods of the
    /// same name on the contents of a `RefCell` used through `Deref`.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::cell::{RefCell, RefMut};
    ///
    /// let cell = RefCell::new([1, 2, 3, 4]);
    /// let borrow = cell.borrow_mut();
    /// let (mut begin, mut end) = RefMut::map_split(borrow, |slice| slice.split_at_mut(2));
    /// assert_eq!(*begin, [1, 2]);
    /// assert_eq!(*end, [3, 4]);
    /// begin.copy_from_slice(&[4, 3]);
    /// end.copy_from_slice(&[2, 1]);
    /// ```
    #[stable(feature = "refcell_map_split", since = "1.35.0")]
    #[inline]
    pub fn map_split<U: ?Sized, V: ?Sized, F>(
        mut orig: RefMut<'b, T>,
        f: F,
    ) -> (RefMut<'b, U>, RefMut<'b, V>)
    where
        F: FnOnce(&mut T) -> (&mut U, &mut V),
    {
        let borrow = orig.borrow.clone();
        let (a, b) = f(&mut *orig);
        (
            RefMut { value: NonNull::from(a), borrow, marker: PhantomData },
            RefMut { value: NonNull::from(b), borrow: orig.borrow, marker: PhantomData },
        )
    }

    /// 转换为对底层数据的可修改引用。
    ///
    /// The underlying `RefCell` can not be borrowed from again and will always appear already
    /// 可修改地借用状态，使得返回的引用只能访问内部数据。
    ///
    /// 这是一个关联函数，需要被用作
    /// `RefMut::leak(...)`. A method would interfere with methods of the
    /// same name on the contents of a `RefCell` used through `Deref`.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(cell_leak)]
    /// use std::cell::{RefCell, RefMut};
    /// let cell = RefCell::new(0);
    ///
    /// let value = RefMut::leak(cell.borrow_mut());
    /// assert_eq!(*value, 0);
    /// *value = 1;
    ///
    /// assert!(cell.try_borrow_mut().is_err());
    /// ```
    #[unstable(feature = "cell_leak", issue = "69099")]
    #[rustc_const_unstable(feature = "const_ref_cell", issue = "137844")]
    pub const fn leak(mut orig: RefMut<'b, T>) -> &'b mut T {
        // By forgetting this BorrowRefMut we ensure that the borrow counter in the RefCell can't
        // go back to UNUSED within the lifetime `'b`. Resetting the reference tracking state would
        // require a unique reference to the borrowed RefCell. No further references can be created
        // from the original cell within that lifetime, making the current borrow the only
        // reference for the remaining lifetime.
        mem::forget(orig.borrow);
        // SAFETY: after forgetting, we can form a reference for the rest of lifetime `'b`.
        unsafe { orig.value.as_mut() }
    }
}

struct BorrowRefMut<'b> {
    borrow: &'b Cell<BorrowCounter>,
}

#[rustc_const_unstable(feature = "const_ref_cell", issue = "137844")]
const impl Drop for BorrowRefMut<'_> {
    #[inline]
    fn drop(&mut self) {
        let borrow = self.borrow.get();
        debug_assert!(is_writing(borrow));
        self.borrow.replace(borrow + 1);
    }
}

impl<'b> BorrowRefMut<'b> {
    #[inline]
    const fn new(borrow: &'b Cell<BorrowCounter>) -> Option<BorrowRefMut<'b>> {
        // NOTE: Unlike BorrowRefMut::clone, new is called to create the initial
        // mutable reference, and so there must currently be no existing
        // references. Thus, while clone increments the mutable refcount, here
        // we explicitly only allow going from UNUSED to UNUSED - 1.
        match borrow.get() {
            UNUSED => {
                borrow.replace(UNUSED - 1);
                Some(BorrowRefMut { borrow })
            }
            _ => None,
        }
    }

    // Clones a `BorrowRefMut`.
    //
    // This is only valid if each `BorrowRefMut` is used to track a mutable
    // reference to a distinct, nonoverlapping range of the original object.
    // This isn't in a Clone impl so that code doesn't call this implicitly.
    #[inline]
    fn clone(&self) -> BorrowRefMut<'b> {
        let borrow = self.borrow.get();
        debug_assert!(is_writing(borrow));
        // Prevent the borrow counter from underflowing.
        assert!(borrow != BorrowCounter::MIN);
        self.borrow.set(borrow - 1);
        BorrowRefMut { borrow: self.borrow }
    }
}

/// A wrapper type for a mutably borrowed value from a `RefCell<T>`.
///
/// See the [module-level documentation](self) for more.
#[stable(feature = "rust1", since = "1.0.0")]
#[must_not_suspend = "holding a RefMut across suspend points can cause BorrowErrors"]
#[rustc_diagnostic_item = "RefCellRefMut"]
pub struct RefMut<'b, T: ?Sized + 'b> {
    // NB: we use a pointer instead of `&'b mut T` to avoid `noalias` violations, because a
    // `RefMut` argument doesn't hold exclusivity for its whole scope, only until it drops.
    value: NonNull<T>,
    borrow: BorrowRefMut<'b>,
    // `NonNull` is covariant over `T`, so we need to reintroduce invariance.
    marker: PhantomData<&'b mut T>,
}

#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_const_unstable(feature = "const_convert", issue = "143773")]
const impl<T: ?Sized> Deref for RefMut<'_, T> {
    type Target = T;

    #[inline]
    fn deref(&self) -> &T {
        // SAFETY: the value is accessible as long as we hold our borrow.
        unsafe { self.value.as_ref() }
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_const_unstable(feature = "const_convert", issue = "143773")]
const impl<T: ?Sized> DerefMut for RefMut<'_, T> {
    #[inline]
    fn deref_mut(&mut self) -> &mut T {
        // SAFETY: the value is accessible as long as we hold our borrow.
        unsafe { self.value.as_mut() }
    }
}

#[unstable(feature = "deref_pure_trait", issue = "87121")]
unsafe impl<T: ?Sized> DerefPure for RefMut<'_, T> {}

#[unstable(feature = "coerce_unsized", issue = "18598")]
impl<'b, T: ?Sized + Unsize<U>, U: ?Sized> CoerceUnsized<RefMut<'b, U>> for RefMut<'b, T> {}

#[stable(feature = "std_guard_impls", since = "1.20.0")]
impl<T: ?Sized + fmt::Display> fmt::Display for RefMut<'_, T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        (**self).fmt(f)
    }
}

/// Rust 中内部可修改性的核心原语。
///
/// If you have a reference `&T`, then normally in Rust the compiler performs optimizations based on
/// the knowledge that `&T` points to immutable data. Mutating that data, for example through an
/// alias or by transmuting a `&T` into a `&mut T`, is considered undefined behavior.
/// `UnsafeCell<T>` opts-out of the immutability guarantee for `&T`: a shared reference
/// `&UnsafeCell<T>` may point to data that is being mutated. This is called "interior mutability".
///
/// All other types that allow internal mutability, such as [`Cell<T>`] and [`RefCell<T>`], internally
/// use `UnsafeCell` to wrap their data.
///
/// Note that only the immutability guarantee for shared references is affected by `UnsafeCell`. The
/// uniqueness guarantee for mutable references is unaffected. As explained below, for the duration
/// of the lifetime of an `&mut`, no other reference may exist and no pointer may be used to access
/// that memory; this applies even with `UnsafeCell<T>`.
///
/// `UnsafeCell` does nothing to avoid data races; they are still undefined behavior. If multiple
/// threads have access to the same `UnsafeCell`, they must follow the usual rules of the
/// [concurrent memory model]: conflicting non-synchronized accesses must be done via the APIs in
/// [`core::sync::atomic`].
///
/// The `UnsafeCell` API itself is technically very simple: [`.get()`] gives you a raw pointer
/// `*mut T` to its contents. It is up to _you_ as the abstraction designer to use that raw pointer
/// 正确。
///
/// [`.get()`]: `UnsafeCell::get`
/// [concurrent memory model]: ../sync/atomic/index.html#memory-model-for-atomic-accesses
///
/// # 别名规则
///
/// 精确的 Rust 别名规则有些变动，但主要要点没有争议：
///
/// - If you create a safe reference with lifetime `'a` (either a `&T` or `&mut T` reference), then
/// 你不得以任何与引用冲突的方式访问数据，直到……结束为止。
///   `'a`, and you must not create any contradicting references. For example, this means that if
///   you take the `*mut T` from an `UnsafeCell<T>` and cast it to a `&T`, then the data in `T` must
///   remain immutable (modulo any `UnsafeCell` data found within `T`, of course) until that
///   reference's lifetime expires, and no `&mut` reference to this data may be created. Similarly,
///   if you create a `&mut T` reference, then you must not access the data within the `UnsafeCell`
/// 直到该引用过期为止，不得使用任何指针/引用访问数据，且不得创建任何引用。
/// 不得创建任何引用。
///
/// - For both `&T` without `UnsafeCell<_>` and `&mut T`, you must also not deallocate the data
///   until the reference expires. As a special exception, given a `&T`, any part of it that is
///   inside an `UnsafeCell<_>` may be deallocated during the lifetime of the reference, after the
///   last time the reference is used (dereferenced or reborrowed). Since you cannot deallocate a part
///   of what a reference points to, this means the memory a `&T` points to can be deallocated only if
///   *every part of it* (including padding) is inside an `UnsafeCell`.
///
/// However, whenever a `&UnsafeCell<T>` is constructed or dereferenced, it must still point to
/// live memory and the compiler is allowed to insert spurious reads if it can prove that this
/// memory has not yet been deallocated.
///
/// To assist with proper design, the following scenarios are explicitly declared legal
/// for single-threaded code:
///
/// 1. A `&T` reference can be released to safe code and there it can co-exist with other `&T`
///    references, but not with a `&mut T`
///
/// 2. A `&mut T` reference may be released to safe code provided neither other `&mut T` nor `&T`
///    co-exist with it. A `&mut T` must always be unique.
///
/// Note that whilst mutating the contents of a `&UnsafeCell<T>` (even while other
/// `&UnsafeCell<T>` references alias the cell) is
/// ok (provided you enforce the above invariants some other way), it is still undefined behavior
/// to have aliasing `&mut UnsafeCell<T>` (or aliasing `&mut` of *any* type). That is, `UnsafeCell` is a wrapper
/// designed to have a special interaction with _shared_ accesses (_i.e._, through an
/// `&UnsafeCell<_>` reference); there is no magic whatsoever when dealing with _exclusive_
/// accesses (_e.g._, through a `&mut UnsafeCell<_>`): neither the cell nor the wrapped value
/// may be aliased for the duration of that `&mut` borrow.
/// This is showcased by the [`.get_mut()`] accessor, which is a _safe_ getter that yields
/// a `&mut T`.
///
/// [`.get_mut()`]: `UnsafeCell::get_mut`
///
/// # 内存布局
///
/// `UnsafeCell<T>` has the same in-memory representation as its inner type `T`. A consequence
/// of this guarantee is that it is possible to convert between `T` and `UnsafeCell<T>`.
/// Special care has to be taken when converting a nested `T` inside of an `Outer<T>` type
/// to an `Outer<UnsafeCell<T>>` type: this is not sound when the `Outer<T>` type enables [niche]
/// optimizations. For example, the type `Option<NonNull<u8>>` is typically 8 bytes large on
/// 64-bit platforms, but the type `Option<UnsafeCell<NonNull<u8>>>` takes up 16 bytes of space.
/// Therefore this is not a valid conversion, despite `NonNull<u8>` and `UnsafeCell<NonNull<u8>>>`
/// having the same memory layout. This is because `UnsafeCell` disables niche optimizations in
/// order to avoid its interior mutability property from spreading from `T` into the `Outer` type,
/// thus this can cause distortions in the type size in these cases.
///
/// The following examples make use of this guarantee:
///
/// ```rust
/// # use std::cell::UnsafeCell;
/// /// # Safety
/// /// The caller must not call `get_mut_unchecked` again (on any alias of `ptr`) for the duration
/// /// of the lifetime of the returned reference.
/// unsafe fn get_mut_unchecked<T>(ptr: &UnsafeCell<T>) -> &mut T {
///   let t = ptr as *const UnsafeCell<T> as *mut T;
///   unsafe { &mut *t }
/// }
/// ```
///
/// ```rust
/// # use std::cell::UnsafeCell;
/// fn get_shared<T>(ptr: &mut T) -> &UnsafeCell<T> {
///   let t = ptr as *mut T as *const UnsafeCell<T>;
///   // SAFETY: `T` and `UnsafeCell<T>` have the same memory layout
///   unsafe { &*t }
/// }
/// ```
///
/// [niche]: https://rust-lang.github.io/unsafe-code-guidelines/glossary.html#niche
///
/// # Examples
///
/// Here is an example showcasing how to soundly mutate the contents of an `UnsafeCell<_>` despite
/// # 示例
///
/// ```
/// use std::cell::UnsafeCell;
///
/// let x: UnsafeCell<i32> = 42.into();
/// // Get multiple / concurrent / shared references to the same `x`.
/// let (p1, p2): (&UnsafeCell<i32>, &UnsafeCell<i32>) = (&x, &x);
///
/// unsafe {
///     // SAFETY: within this scope there are no other references to `x`'s contents,
///     // so ours is effectively unique.
///     let p1_exclusive: &mut i32 = &mut *p1.get(); // -- borrow --+
///     *p1_exclusive += 27; //                                     |
/// } // <---------- cannot go beyond this point -------------------+
///
/// unsafe {
///     // SAFETY: within this scope nobody expects to have exclusive access to `x`'s contents,
///     // so we can have multiple shared accesses concurrently.
///     let p2_shared: &i32 = &*p2.get();
///     assert_eq!(*p2_shared, 42 + 27);
///     let p1_shared: &i32 = &*p1.get();
///     assert_eq!(*p1_shared, *p2_shared);
/// }
/// ```
///
/// The following example showcases the fact that exclusive access to an `UnsafeCell<T>`
/// implies exclusive access to its `T`:
///
/// ```rust
/// #![forbid(unsafe_code)]
/// // with exclusive accesses, `UnsafeCell` is a transparent no-op wrapper, so no need for
/// // `unsafe` here.
/// use std::cell::UnsafeCell;
///
/// let mut x: UnsafeCell<i32> = 42.into();
///
/// // Get a compile-time-checked unique reference to `x`.
/// let p_unique: &mut UnsafeCell<i32> = &mut x;
/// // With an exclusive reference, we can mutate the contents for free.
/// *p_unique.get_mut() = 0;
/// // Or, equivalently:
/// x = UnsafeCell::new(0);
///
/// // When we own the value, we can extract the contents for free.
/// let contents: i32 = x.into_inner();
/// assert_eq!(contents, 0);
/// ```
#[lang = "unsafe_cell"]
#[stable(feature = "rust1", since = "1.0.0")]
#[repr(transparent)]
#[rustc_pub_transparent]
pub struct UnsafeCell<#[rustc_assert_variance(invariant)] T: ?Sized> {
    value: T,
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T: ?Sized> !Sync for UnsafeCell<T> {}

impl<T> UnsafeCell<T> {
    /// Constructs a new instance of `UnsafeCell` which will wrap the specified
    /// value.
    ///
    /// All access to the inner value through `&UnsafeCell<T>` requires `unsafe` code.
    ///
    /// # 解包值，释放单元格
    ///
    /// ```
    /// use std::cell::UnsafeCell;
    ///
    /// let uc = UnsafeCell::new(5);
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_unsafe_cell_new", since = "1.32.0")]
    #[inline(always)]
    pub const fn new(value: T) -> UnsafeCell<T> {
        UnsafeCell { value }
    }

    /// Unwraps the value, consuming the cell.
    ///
    /// # 安全性
    ///
    /// ```
    /// use std::cell::UnsafeCell;
    ///
    /// let uc = UnsafeCell::new(5);
    ///
    /// let five = uc.into_inner();
    /// ```
    #[inline(always)]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_cell_into_inner", since = "1.83.0")]
    #[rustc_allow_const_fn_unstable(const_precise_live_drops)]
    pub const fn into_inner(self) -> T {
        self.value
    }

    /// Replace the value in this `UnsafeCell` and return the old value.
    ///
    /// # - 允许与其他对包裹值的访问同时进行调用是未定义行为
    ///
    /// - 在有其他引用指向包裹值时调用此函数是未定义行为
    ///
    /// 
    /// # 示例
    /// - It is Undefined Behavior to call this while any other
    /// 获取对包裹值的可修改指针
    ///
    /// # 可以将此指针转换为任何类型的指针。在创建（共享或可修改）引用时，你必须遵守别名规则；有关更多讨论和注意事项，请参阅 [类型级别文档][UnsafeCell#aliasing-rules]
    ///
    /// ```
    /// use std::cell::UnsafeCell;
    ///
    /// let uc = UnsafeCell::new(5);
    ///
    /// let old = unsafe { uc.replace(10) };
    /// assert_eq!(old, 5);
    /// ```
    #[inline]
    #[stable(feature = "unsafe_cell_access", since = "1.100.0")]
    #[rustc_const_stable(feature = "unsafe_cell_access", since = "1.100.0")]
    #[lint::should_not_be_called_on_const_items]
    pub const unsafe fn replace(&self, value: T) -> T {
        // SAFETY: pointer comes from `&self` so naturally satisfies invariants.
        unsafe { ptr::replace(self.get(), value) }
    }
}

impl<T: ?Sized> UnsafeCell<T> {
    /// Converts from `&mut T` to `&mut UnsafeCell<T>`.
    ///
    /// # Examples
    ///
    /// ```
    /// use std::cell::UnsafeCell;
    ///
    /// let mut val = 42;
    /// let uc = UnsafeCell::from_mut(&mut val);
    ///
    /// *uc.get_mut() -= 1;
    /// assert_eq!(*uc.get_mut(), 41);
    /// ```
    #[inline(always)]
    #[stable(feature = "unsafe_cell_from_mut", since = "1.84.0")]
    #[rustc_const_stable(feature = "unsafe_cell_from_mut", since = "1.84.0")]
    pub const fn from_mut(value: &mut T) -> &mut UnsafeCell<T> {
        // SAFETY: `UnsafeCell<T>` has the same memory layout as `T` due to #[repr(transparent)].
        unsafe { &mut *(value as *mut T as *mut UnsafeCell<T>) }
    }

    /// Gets a mutable pointer to the wrapped value.
    ///
    /// This can be cast to a pointer of any kind. When creating (shared or mutable) references, you
    /// must uphold the aliasing rules; see [the type-level docs][UnsafeCell#aliasing-rules] for
    /// more discussion and caveats.
    ///
    /// This is equivalent to casting `self` to a raw pointer and then casting that raw
    /// pointer to `*mut T`.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::cell::UnsafeCell;
    ///
    /// let uc = UnsafeCell::new(5);
    ///
    /// let five = uc.get();
    /// ```
    #[inline(always)]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_unsafecell_get", since = "1.32.0")]
    #[lint::as_ptr]
    #[lint::never_returns_null_ptr]
    #[lint::should_not_be_called_on_const_items]
    pub const fn get(&self) -> *mut T {
        // We can just cast the pointer from `UnsafeCell<T>` to `T` because of
        // #[repr(transparent)].
        self as *const UnsafeCell<T> as *const T as *mut T
    }

    /// 返回对底层数据的可修改引用。
    ///
    /// This call borrows the `UnsafeCell` mutably (at compile-time) which
    /// 确保我们拥有唯一的引用。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::cell::UnsafeCell;
    ///
    /// let mut c = UnsafeCell::new(5);
    /// *c.get_mut() += 1;
    ///
    /// assert_eq!(*c.get_mut(), 6);
    /// ```
    #[inline(always)]
    #[stable(feature = "unsafe_cell_get_mut", since = "1.50.0")]
    #[rustc_const_stable(feature = "const_unsafecell_get_mut", since = "1.83.0")]
    pub const fn get_mut(&mut self) -> &mut T {
        &mut self.value
    }

    /// 获取对包装值的可修改指针。
    /// The difference from [`get`] is that this function accepts a raw pointer,
    /// 这有助于避免创建临时引用。
    ///
    /// 此指针可以转换为任何类型的指针。在创建（共享或可修改）引用时，您
    /// 必须遵守别名规则；有关更多讨论和注意事项，请参阅 [类型级别文档][UnsafeCell#aliasing-rules]。
    /// more discussion and caveats.
    ///
    /// This is equivalent to casting `this` to `*mut T`.
    ///
    /// [`get`]: UnsafeCell::get()
    ///
    /// # 示例
    ///
    /// Gradual initialization of an `UnsafeCell` requires `raw_get`, as
    /// calling `get` would require creating a reference to uninitialized data:
    ///
    /// ```
    /// use std::cell::UnsafeCell;
    /// use std::mem::MaybeUninit;
    ///
    /// let m = MaybeUninit::<UnsafeCell<i32>>::uninit();
    /// unsafe { UnsafeCell::raw_get(m.as_ptr()).write(5); }
    /// // avoid below which references to uninitialized data
    /// // unsafe { UnsafeCell::get(&*m.as_ptr()).write(5); }
    /// let uc = unsafe { m.assume_init() };
    ///
    /// assert_eq!(uc.into_inner(), 5);
    /// ```
    #[inline(always)]
    #[stable(feature = "unsafe_cell_raw_get", since = "1.56.0")]
    #[rustc_const_stable(feature = "unsafe_cell_raw_get", since = "1.56.0")]
    #[rustc_diagnostic_item = "unsafe_cell_raw_get"]
    pub const fn raw_get(this: *const Self) -> *mut T {
        // We can just cast the pointer from `UnsafeCell<T>` to `T` because of
        // #[repr(transparent)].
        this as *const T as *mut T
    }

    /// Get a shared reference to the value within the `UnsafeCell`.
    ///
    /// # 安全性
    ///
    /// - 当任何可修改的
    /// 对包装值的引用处于活动状态时调用此函数属于未定义行为。
    /// - 在返回的
    /// 引用处于活动状态时修改包装值属于未定义行为。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::cell::UnsafeCell;
    ///
    /// let uc = UnsafeCell::new(5);
    ///
    /// let val = unsafe { uc.as_ref_unchecked() };
    /// assert_eq!(val, &5);
    /// ```
    #[inline]
    #[stable(feature = "unsafe_cell_access", since = "1.100.0")]
    #[rustc_const_stable(feature = "unsafe_cell_access", since = "1.100.0")]
    #[lint::should_not_be_called_on_const_items]
    pub const unsafe fn as_ref_unchecked(&self) -> &T {
        // SAFETY: pointer comes from `&self` so naturally satisfies ptr-to-ref invariants.
        unsafe { self.get().as_ref_unchecked() }
    }

    /// Get an exclusive reference to the value within the `UnsafeCell`.
    ///
    /// # 安全性
    ///
    /// - 当任何其他
    /// 对包装值的引用处于活动状态时调用此函数属于未定义行为。
    /// - 在返回的
    /// 引用处于活动状态时通过其他方式修改包装值属于未定义行为。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::cell::UnsafeCell;
    ///
    /// let uc = UnsafeCell::new(5);
    ///
    /// unsafe { *uc.as_mut_unchecked() += 1; }
    /// assert_eq!(uc.into_inner(), 6);
    /// ```
    #[inline]
    #[stable(feature = "unsafe_cell_access", since = "1.100.0")]
    #[rustc_const_stable(feature = "unsafe_cell_access", since = "1.100.0")]
    #[allow(clippy::mut_from_ref)]
    #[lint::should_not_be_called_on_const_items]
    pub const unsafe fn as_mut_unchecked(&self) -> &mut T {
        // SAFETY: pointer comes from `&self` so naturally satisfies ptr-to-ref invariants.
        unsafe { self.get().as_mut_unchecked() }
    }
}

#[stable(feature = "unsafe_cell_default", since = "1.10.0")]
#[rustc_const_unstable(feature = "const_default", issue = "143894")]
const impl<T: [const] Default> Default for UnsafeCell<T> {
    /// Creates an `UnsafeCell`, with the `Default` value for T.
    fn default() -> UnsafeCell<T> {
        UnsafeCell::new(Default::default())
    }
}

#[stable(feature = "cell_from", since = "1.12.0")]
#[rustc_const_unstable(feature = "const_convert", issue = "143773")]
const impl<T> From<T> for UnsafeCell<T> {
    /// Creates a new `UnsafeCell<T>` containing the given value.
    fn from(t: T) -> UnsafeCell<T> {
        UnsafeCell::new(t)
    }
}

#[unstable(feature = "coerce_unsized", issue = "18598")]
impl<T: CoerceUnsized<U>, U> CoerceUnsized<UnsafeCell<U>> for UnsafeCell<T> {}

// Allow types that wrap `UnsafeCell` to also implement `DispatchFromDyn`
// and become dyn-compatible method receivers.
// Note that currently `UnsafeCell` itself cannot be a method receiver
// because it does not implement Deref.
// In other words:
// `self: UnsafeCell<&Self>` won't work
// `self: UnsafeCellWrapper<Self>` becomes possible
#[unstable(feature = "dispatch_from_dyn", issue = "none")]
impl<T: DispatchFromDyn<U>, U> DispatchFromDyn<UnsafeCell<U>> for UnsafeCell<T> {}

/// [`UnsafeCell`], but [`Sync`].
///
/// This is just an `UnsafeCell`, except it implements `Sync`
/// if `T` implements `Sync`.
///
/// `UnsafeCell` doesn't implement `Sync`, to prevent accidental mis-use.
/// You can use `SyncUnsafeCell` instead of `UnsafeCell` to allow it to be
/// 线程间共享，如果这是预期的话。
/// 提供适当的同步仍然是用户的任务，
/// 使得这种类型同样不可安全使用。
///
/// See [`UnsafeCell`] for details.
#[unstable(feature = "sync_unsafe_cell", issue = "95439")]
#[repr(transparent)]
#[rustc_diagnostic_item = "SyncUnsafeCell"]
#[rustc_pub_transparent]
pub struct SyncUnsafeCell<#[rustc_assert_variance(invariant)] T: ?Sized> {
    value: UnsafeCell<T>,
}

#[unstable(feature = "sync_unsafe_cell", issue = "95439")]
unsafe impl<T: ?Sized + Sync> Sync for SyncUnsafeCell<T> {}

#[unstable(feature = "sync_unsafe_cell", issue = "95439")]
impl<T> SyncUnsafeCell<T> {
    /// Constructs a new instance of `SyncUnsafeCell` which will wrap the specified value.
    #[inline]
    pub const fn new(value: T) -> Self {
        Self { value: UnsafeCell { value } }
    }

    /// 解包值，消耗单元格。
    #[inline]
    #[rustc_const_unstable(feature = "sync_unsafe_cell", issue = "95439")]
    pub const fn into_inner(self) -> T {
        self.value.into_inner()
    }
}

#[unstable(feature = "sync_unsafe_cell", issue = "95439")]
impl<T: ?Sized> SyncUnsafeCell<T> {
    /// 获取对包装值的可修改指针。
    ///
    /// 此指针可以转换为任何类型的指针。
    /// 确保访问是唯一的（没有活动引用，无论是可修改还是非可修改）
    /// when casting to `&mut T`, and ensure that there are no mutations
    /// or mutable aliases going on when casting to `&T`
    #[inline]
    #[lint::as_ptr]
    #[lint::never_returns_null_ptr]
    #[lint::should_not_be_called_on_const_items]
    pub const fn get(&self) -> *mut T {
        self.value.get()
    }

    /// 返回对底层数据的可修改引用。
    ///
    /// This call borrows the `SyncUnsafeCell` mutably (at compile-time) which
    /// 确保我们拥有唯一的引用。
    #[inline]
    pub const fn get_mut(&mut self) -> &mut T {
        self.value.get_mut()
    }

    /// 获取对包装值的可修改指针。
    ///
    /// See [`UnsafeCell::get`] for details.
    #[inline]
    pub const fn raw_get(this: *const Self) -> *mut T {
        // We can just cast the pointer from `SyncUnsafeCell<T>` to `T` because
        // of #[repr(transparent)] on both SyncUnsafeCell and UnsafeCell.
        // See UnsafeCell::raw_get.
        this as *const T as *mut T
    }
}

#[unstable(feature = "sync_unsafe_cell", issue = "95439")]
#[rustc_const_unstable(feature = "const_default", issue = "143894")]
const impl<T: [const] Default> Default for SyncUnsafeCell<T> {
    /// Creates an `SyncUnsafeCell`, with the `Default` value for T.
    fn default() -> SyncUnsafeCell<T> {
        SyncUnsafeCell::new(Default::default())
    }
}

#[unstable(feature = "sync_unsafe_cell", issue = "95439")]
#[rustc_const_unstable(feature = "const_convert", issue = "143773")]
const impl<T> From<T> for SyncUnsafeCell<T> {
    /// Creates a new `SyncUnsafeCell<T>` containing the given value.
    fn from(t: T) -> SyncUnsafeCell<T> {
        SyncUnsafeCell::new(t)
    }
}

#[unstable(feature = "coerce_unsized", issue = "18598")]
//#[unstable(feature = "sync_unsafe_cell", issue = "95439")]
impl<T: CoerceUnsized<U>, U> CoerceUnsized<SyncUnsafeCell<U>> for SyncUnsafeCell<T> {}

// Allow types that wrap `SyncUnsafeCell` to also implement `DispatchFromDyn`
// and become dyn-compatible method receivers.
// Note that currently `SyncUnsafeCell` itself cannot be a method receiver
// because it does not implement Deref.
// In other words:
// `self: SyncUnsafeCell<&Self>` won't work
// `self: SyncUnsafeCellWrapper<Self>` becomes possible
#[unstable(feature = "dispatch_from_dyn", issue = "none")]
//#[unstable(feature = "sync_unsafe_cell", issue = "95439")]
impl<T: DispatchFromDyn<U>, U> DispatchFromDyn<SyncUnsafeCell<U>> for SyncUnsafeCell<T> {}

#[allow(unused)]
fn assert_coerce_unsized(
    a: UnsafeCell<&i32>,
    b: SyncUnsafeCell<&i32>,
    c: Cell<&i32>,
    d: RefCell<&i32>,
) {
    let _: UnsafeCell<&dyn Send> = a;
    let _: SyncUnsafeCell<&dyn Send> = b;
    let _: Cell<&dyn Send> = c;
    let _: RefCell<&dyn Send> = d;
}

// The implementations of Deref/DerefMut are not malicious, so we can allow the
// user to perform unsizing coercions with `Pin<Ref<'b, T>>` pointers if they
// can manage to create one.
#[unstable(feature = "pin_coerce_unsized_trait", issue = "150112")]
unsafe impl<'b, T: ?Sized> PinSafePointer for Ref<'b, T> {}

// The implementations of Deref/DerefMut are not malicious, so we can allow the
// user to perform unsizing coercions with `Pin<RefMut<'b, T>>` pointers if they
// can manage to create one.
#[unstable(feature = "pin_coerce_unsized_trait", issue = "150112")]
unsafe impl<'b, T: ?Sized> PinSafePointer for RefMut<'b, T> {}
