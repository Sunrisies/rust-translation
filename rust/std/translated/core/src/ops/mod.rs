//! 可重载运算符。
//!
//! 实现这些 trait 允许你重载某些运算符。
//!
//! 其中一些 trait 被 prelude 导入，因此它们在
//! 所有 Rust 程序中都可用。只有由 trait 支持的运算符才能被重载。例如，
//! example, the addition operator (`+`) can be overloaded through the [`Add`]
//! trait, but since the assignment operator (`=`) has no backing trait, there
//! 无法重载其语义。此外，此模块不提供任何创建新运算符的机制。如果需要Traitless重载或
//! 自定义运算符，你应该考虑使用宏来扩展
//! Rust 的语法。
//! 运算符 trait 的实现在其各自上下文中应该是显而易见的，
//!
//! 在记住其通常含义和
//! respective contexts, keeping in mind their usual meanings and
//! [operator precedence]. For example, when implementing [`Mul`], the operation
//! should have some resemblance to multiplication (and share expected
//! properties like associativity).
//!
//! Note that the `&&` and `||` operators are currently not supported for
//! 许多运算符以值形式接收操作数。在涉及内置类型的非泛型
//! design from traits for other operators like [`BitAnd`]. Designs for them are
//! 然而，在泛型代码中使用这些运算符时，如果值需要被重用而不是让运算符
//!
//! Many of the operators take their operands by value. In non-generic
//! 另一种选择是依赖相关类型提供额外的
//! However, using these operators in generic code, requires some
//! 这样泛型代码就可以编写而不需要不必要的
//! consume them. One option is to occasionally use [`clone`].
//! # 示例
//! operator implementations for references. For example, for a user-defined
//! type `T` which is supposed to support addition, it is probably a good
//! idea to have both `T` and `&T` implement the traits [`Add<T>`][`Add`] and
//! [`Add<&T>`][`Add`] so that generic code can be written without unnecessary
//! cloning.
//!
//! # Examples
//!
//! This example creates a `Point` struct that implements [`Add`] and [`Sub`],
//! and then demonstrates adding and subtracting two `Point`s.
//!
//! ```rust
//! use std::ops::{Add, Sub};
//!
//! #[derive(Debug, Copy, Clone, PartialEq)]
//! struct Point {
//!     x: i32,
//!     y: i32,
//! }
//!
//! impl Add for Point {
//!     type Output = Self;
//!
//!     fn add(self, other: Self) -> Self {
//!         Self {x: self.x + other.x, y: self.y + other.y}
//!     }
//! }
//!
//! impl Sub for Point {
//!     type Output = Self;
//!
//!     fn sub(self, other: Self) -> Self {
//!         Self {x: self.x - other.x, y: self.y - other.y}
//!     }
//! }
//!
//! assert_eq!(Point {x: 3, y: 3}, Point {x: 1, y: 0} + Point {x: 2, y: 3});
//! assert_eq!(Point {x: -1, y: -3}, Point {x: 1, y: 0} - Point {x: 2, y: 3});
//! ```
//!
//! See the documentation for each trait for an example implementation.
//!
//! The [`Fn`], [`FnMut`], and [`FnOnce`] traits are implemented by types that can be
//! invoked like functions. Note that [`Fn`] takes `&self`, [`FnMut`] takes `&mut
//! self` and [`FnOnce`] takes `self`. These correspond to the three kinds of
//! trait 最常见的用途是作为对接受函数或闭包作为参数的高级函数的限制条件。
//! call-by-mutable-reference, and call-by-value. The most common use of these
//! traits is to act as bounds to higher-level functions that take functions or
//! closures as arguments.
//!
//! Taking a [`Fn`] as a parameter:
//!
//! ```rust
//! fn call_with_one<F>(func: F) -> usize
//!     where F: Fn(usize) -> usize
//! {
//!     func(1)
//! }
//!
//! let double = |x| x * 2;
//! assert_eq!(call_with_one(double), 2);
//! ```
//!
//! Taking a [`FnMut`] as a parameter:
//!
//! ```rust
//! fn do_twice<F>(mut func: F)
//!     where F: FnMut()
//! {
//!     func();
//!     func();
//! }
//!
//! let mut x: usize = 1;
//! {
//!     let add_two_to_x = || x += 2;
//!     do_twice(add_two_to_x);
//! }
//!
//! assert_eq!(x, 5);
//! ```
//!
//! Taking a [`FnOnce`] as a parameter:
//!
//! ```rust
//! fn consume_with_relish<F>(func: F)
//!     where F: FnOnce() -> String
//! {
//!     // `func` consumes its captured variables, so it cannot be run more
//!     // than once
//!     println!("Consumed: {}", func());
//!
//!     println!("Delicious!");
//!
//!     // Attempting to invoke `func()` again will throw a `use of moved
//!     // value` error for `func`
//! }
//!
//! let x = String::from("x");
//! let consume_and_return_x = move || x;
//! consume_with_relish(consume_and_return_x);
//!
//! // `consume_and_return_x` can no longer be invoked at this point
//! ```
//!
//! [`clone`]: Clone::clone
//! [operator precedence]: ../../reference/expressions.html#expression-precedence

#![stable(feature = "rust1", since = "1.0.0")]

mod arith;
mod async_function;
mod bit;
mod control_flow;
mod coroutine;
mod deref;
mod drop;
mod function;
mod index;
mod index_range;
mod range;
mod try_trait;
mod unsize;

#[stable(feature = "rust1", since = "1.0.0")]
pub use self::arith::{Add, Div, Mul, Neg, Rem, Sub};
#[stable(feature = "op_assign_traits", since = "1.8.0")]
pub use self::arith::{AddAssign, DivAssign, MulAssign, RemAssign, SubAssign};
#[stable(feature = "async_closure", since = "1.85.0")]
pub use self::async_function::{AsyncFn, AsyncFnMut, AsyncFnOnce};
#[stable(feature = "rust1", since = "1.0.0")]
pub use self::bit::{BitAnd, BitOr, BitXor, Not, Shl, Shr};
#[stable(feature = "op_assign_traits", since = "1.8.0")]
pub use self::bit::{BitAndAssign, BitOrAssign, BitXorAssign, ShlAssign, ShrAssign};
#[stable(feature = "control_flow_enum_type", since = "1.55.0")]
pub use self::control_flow::ControlFlow;
#[unstable(feature = "coroutine_trait", issue = "43122")]
pub use self::coroutine::{Coroutine, CoroutineState};
#[unstable(feature = "deref_pure_trait", issue = "87121")]
pub use self::deref::DerefPure;
#[unstable(feature = "legacy_receiver_trait", issue = "none")]
pub use self::deref::LegacyReceiver;
#[unstable(feature = "arbitrary_self_types", issue = "44874")]
pub use self::deref::Receiver;
#[stable(feature = "rust1", since = "1.0.0")]
pub use self::deref::{Deref, DerefMut};
#[stable(feature = "rust1", since = "1.0.0")]
pub use self::drop::Drop;
#[unstable(feature = "fn_static", issue = "148768")]
pub use self::function::{Code, FnAddr, FnPtr};
#[stable(feature = "rust1", since = "1.0.0")]
pub use self::function::{Fn, FnMut, FnOnce};
#[stable(feature = "rust1", since = "1.0.0")]
pub use self::index::{Index, IndexMut};
pub(crate) use self::index_range::IndexRange;
#[unstable(feature = "range_into_bounds", issue = "136903")]
pub use self::range::IntoBounds;
#[stable(feature = "inclusive_range", since = "1.26.0")]
pub use self::range::{Bound, RangeBounds, RangeInclusive, RangeToInclusive};
#[unstable(feature = "one_sided_range", issue = "69780")]
pub use self::range::{OneSidedRange, OneSidedRangeBound};
#[stable(feature = "rust1", since = "1.0.0")]
pub use self::range::{Range, RangeFrom, RangeFull, RangeTo};
#[unstable(feature = "try_trait_v2_residual", issue = "91285")]
pub use self::try_trait::Residual;
#[unstable(feature = "try_trait_v2_yeet", issue = "96374")]
pub use self::try_trait::Yeet;
pub(crate) use self::try_trait::{ChangeOutputType, NeverShortCircuit};
#[unstable(feature = "try_trait_v2", issue = "84277", old_name = "try_trait")]
pub use self::try_trait::{FromResidual, Try};
#[unstable(feature = "coerce_unsized", issue = "18598")]
pub use self::unsize::CoerceUnsized;
#[unstable(feature = "dispatch_from_dyn", issue = "none")]
pub use self::unsize::DispatchFromDyn;
