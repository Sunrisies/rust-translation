use crate::pin::Pin;

/// 析构函数中的自定义代码。
///
/// 当某个值不再需要时，Rust 会对该值执行“析构”操作。
/// 值不再需要最常见的情形是它离开
/// 作用域。析构函数在其他情况下也可能被调用，但在这里我们重点讨论
/// 作用域。要了解其他情况，请参考关于析构函数的[参考]部分。
/// 此析构函数包含两个部分：
///
/// [the reference]: https://doc.rust-lang.org/reference/destructors.html
///
/// This destructor consists of two components:
/// - A call to `Drop::drop` for that value, if this special `Drop` trait is implemented for its type.
/// 由于 Rust 会自动调用所有包含字段的析构函数，
///   of all the fields of this value.
///
/// 这种调用是有用的。该资源可能是内存、文件描述符或网络套接字。
/// you don't have to implement `Drop` in most cases. But there are some cases where
/// it is useful, for example for types which directly manage a resource.
/// ## 示例
/// 为了看到析构函数的实际效果，让我们看下面的程序：
/// resource by freeing the memory or closing the file or socket. This is
/// the job of a destructor, and therefore the job of `Drop::drop`.
///
/// ## Examples
///
/// 这将导致
///
/// ```rust
/// struct HasDrop;
///
/// impl Drop for HasDrop {
///     fn drop(&mut self) {
///         println!("Dropping HasDrop!");
///     }
/// }
///
/// struct HasTwoDrops {
///     one: HasDrop,
///     two: HasDrop,
/// }
///
/// impl Drop for HasTwoDrops {
///     fn drop(&mut self) {
///         println!("Dropping HasTwoDrops!");
///     }
/// }
///
/// fn main() {
///     let _x = HasTwoDrops { one: HasDrop, two: HasDrop };
///     println!("Running!");
/// }
/// ```
///
/// Rust will first call `Drop::drop` for `_x` and then for both `_x.one` and `_x.two`,
/// meaning that running this will print
///
/// ```text
/// Running!
/// Dropping HasTwoDrops!
/// Dropping HasDrop!
/// Dropping HasDrop!
/// ```
///
/// Even if we remove the implementation of `Drop` for `HasTwoDrop`, the destructors of its fields are still called.
/// This would result in
///
/// ```test
/// Running!
/// Dropping HasDrop!
/// Dropping HasDrop!
/// ```
///
/// ## You cannot call `Drop::drop` yourself
///
/// Because `Drop::drop` is used to clean up a value, it may be dangerous to use this value after
/// the method has been called. As `Drop::drop` does not take ownership of its input,
/// Rust prevents misuse by not allowing you to call `Drop::drop` directly.
///
/// In other words, if you tried to explicitly call `Drop::drop` in the above example, you'd get a compiler error.
///
/// If you'd like to explicitly call the destructor of a value, [`mem::drop`] can be used instead.
///
/// [`mem::drop`]: drop
///
/// ## 清理顺序
///
/// Which of our two `HasDrop` drops first, though? For structs, it's the same
/// order that they're declared: first `one`, then `two`. If you'd like to try
/// this yourself, you can modify `HasDrop` above to contain some data, like an
/// integer, and then use it in the `println!` inside of `Drop`. This behavior is
/// 由语言本身保证。
///
/// 与结构体不同，局部变量的销毁顺序是相反的：
///
/// ```rust
/// struct Foo;
///
/// impl Drop for Foo {
///     fn drop(&mut self) {
///         println!("Dropping Foo!")
///     }
/// }
///
/// struct Bar;
///
/// impl Drop for Bar {
///     fn drop(&mut self) {
///         println!("Dropping Bar!")
///     }
/// }
///
/// fn main() {
///     let _foo = Foo;
///     let _bar = Bar;
/// }
/// ```
///
/// 这将输出
///
/// ```text
/// Dropping Bar!
/// Dropping Foo!
/// ```
///
/// 请参考[参考文档]以了解完整规则。
///
/// [the reference]: https://doc.rust-lang.org/reference/destructors.html
///
/// ## `Copy` and `Drop` are exclusive
///
/// You cannot implement both [`Copy`] and `Drop` on the same type. Types that
/// are `Copy` get implicitly duplicated by the compiler, making it very
/// 很难预测销毁器何时以及何频率执行。因此，
/// 这些类型不能拥有销毁器。
///
/// ## 销毁检查
///
/// Dropping interacts with the borrow checker in subtle ways: when a type `T` is being implicitly
/// 如果该类型的某个变量超出作用域，借用检查器需要确保
/// calling `T`'s destructor at this moment is safe. In particular, it also needs to be safe to
/// recursively drop all the fields of `T`. For example, it is crucial that code like the following
/// is being rejected:
///
/// ```compile_fail,E0597
/// use std::cell::Cell;
///
/// struct S<'a>(Cell<Option<&'a S<'a>>>, Box<i32>);
/// impl Drop for S<'_> {
///     fn drop(&mut self) {
///         if let Some(r) = self.0.get() {
///             // Print the contents of the `Box` in `r`.
///             println!("{}", r.1);
///         }
///     }
/// }
///
/// fn main() {
///     // Set up two `S` that point to each other.
///     let s1 = S(Cell::new(None), Box::new(42));
///     let s2 = S(Cell::new(Some(&s1)), Box::new(42));
///     s1.0.set(Some(&s2));
///     // Now they both get dropped. But whichever is the 2nd one
///     // to be dropped will access the `Box` in the first one,
///     // which is a use-after-free!
/// }
/// ```
///
/// The Nomicon discusses the need for [drop check in more detail][drop check].
///
/// To reject such code, the "drop check" analysis determines which types and lifetimes need to
/// still be live when `T` gets dropped. The exact details of this analysis are not yet
/// stably guaranteed and **subject to change**. Currently, the analysis works as follows:
/// - If `T` has no drop glue, then trivially nothing is required to be live. This is the case if
///   neither `T` nor any of its (recursive) fields have a destructor (`impl Drop`). [`PhantomData`],
///   arrays of length 0 and [`ManuallyDrop`] are considered to never have a destructor, no matter
///   their field type.
/// - If `T` has drop glue, then, for all types `U` that are *owned* by any field of `T`,
///   recursively add the types and lifetimes that need to be live when `U` gets dropped. The set of
///   owned types is determined by recursively traversing `T`:
///   - Recursively descend through `PhantomData`, `Box`, tuples, and arrays (excluding arrays of
/// length 0).
/// - Stop at reference and raw pointer types as well as function pointers and function items;
/// they do not own anything.
/// - Stop at non-composite types (type parameters that remain generic in the current context and
///     base types such as integers and `bool`); these types are owned.
///   - When hitting an ADT with `impl Drop`, stop there; this type is owned.
///   - When hitting an ADT without `impl Drop`, recursively descend to its fields. (For an `enum`,
/// 应考虑所有变体的所有字段。）
/// - Furthermore, if `T` implements `Drop`, then all generic (lifetime and type) parameters of `T`
/// 必须处于活跃状态。
///
/// In the above example, the last clause implies that `'a` must be live when `S<'a>` is dropped,
/// and hence the example is rejected. If we remove the `impl Drop`, the liveness requirement
/// 就会消失，示例被接受。
///
/// 存在一种不稳定的方式让类型跳过最后一条规则；这被称为“drop
/// check eyepatch" or `may_dangle`. For more details on this nightly-only feature, see the
/// [Nomicon 中的讨论][nomicon]。
///
/// [`ManuallyDrop`]: crate::mem::ManuallyDrop
/// [`PhantomData`]: crate::marker::PhantomData
/// [drop check]: ../../nomicon/dropck.html
/// [nomicon]: ../../nomicon/phantom-data.html#an-exception-the-special-case-of-the-standard-library-and-its-unstable-may_dangle
#[lang = "drop"]
#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_const_unstable(feature = "const_destruct", issue = "133214")]
pub const trait Drop {
    /// 执行该类型的析构函数。
    ///
    /// 当值超出作用域时，此方法会被隐式调用，
    /// 无法显式调用（这是编译器错误 [E0040]）。
    /// However, the [`mem::drop`] function in the prelude can be
    /// used to call the argument's `Drop` implementation.
    ///
    /// When this method has been called, `self` has not yet been deallocated.
    /// 这仅在方法执行完毕后发生。
    /// If this wasn't the case, `self` would be a dangling reference.
    ///
    /// # Panics
    ///
    /// Implementations should generally avoid [`panic!`]ing, because `drop()` may itself be called
    /// during unwinding due to a panic, and if the `drop()` panics in that situation (a “double
    /// panic”), this will likely abort the program. It is possible to check [`panicking()`] first,
    /// which may be desirable for a `Drop` implementation that is reporting a bug of the kind
    /// “你在它被释放前没有使用完”；但大多数类型应该简单地清理
    /// their owned allocations or other resources and return normally from `drop()`, regardless of
    /// 注意，即使发生 panic，该值也被认为已被释放；
    ///
    /// Note that even if this panics, the value is considered to be dropped;
    /// you must not cause `drop` to be called again. This is normally automatically
    /// handled by the compiler, but when using unsafe code, can sometimes occur
    /// unintentionally, particularly when using [`ptr::drop_in_place`].
    ///
    /// [E0040]: ../../error_codes/E0040.html
    /// [`panic!`]: crate::panic!
    /// [`panicking()`]: ../../std/thread/fn.panicking.html
    /// [`mem::drop`]: drop
    /// [`ptr::drop_in_place`]: crate::ptr::drop_in_place
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_default_body_unstable(feature = "pin_ergonomics", issue = "130494")]
    fn drop(&mut self) {
        // SAFETY: `self` is pinned till after dropped.
        unsafe { Drop::pin_drop(Pin::new_unchecked(self)) }
    }

    /// Execute the destructor for this type, but different to [`Drop::drop`], it requires `self`
    /// to be pinned.
    ///
    /// By implementing this method instead of [`Drop::drop`], the receiver type [`Pin<&mut Self>`]
    /// makes sure that the value is pinned until it is deallocated (See [`std::pin` module docs] for
    /// more details), which enables us to support field projections of `Self` type safely.
    ///
    /// For types that support pin-projection (i.e., marked with `#[pin_v2]`), this method must be used.
    ///
    /// For any type, at least and at most one of [`Drop::drop`] and [`Drop::pin_drop`] should be
    /// 实现。
    ///
    /// See also [`Drop::drop`] for more details.
    ///
    /// [`Drop::drop`]: crate::ops::Drop::drop
    /// [`Drop::pin_drop`]: crate::ops::Drop::pin_drop
    /// [`Pin<&mut Self>`]: crate::pin::Pin
    /// [`std::pin` module docs]: crate::pin
    #[unstable(feature = "pin_ergonomics", issue = "130494")]
    fn pin_drop(self: Pin<&mut Self>) {}
}
