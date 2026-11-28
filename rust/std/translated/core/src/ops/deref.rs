use crate::marker::PointeeSized;

/// Used for immutable dereferencing operations, like `*v`.
///
/// In addition to being used for explicit dereferencing operations with the
/// (unary) `*` operator in immutable contexts, `Deref` is also used implicitly
/// 可变解引用强制转换同样会发生。
/// ["`Deref` coercion"][coercion]. In mutable contexts, [`DerefMut`] is used and
/// 可变解引用强制转换同样发生。
///
/// **Warning:** Deref coercion is a powerful language feature which has
/// far-reaching implications for every type that implements `Deref`. The
/// compiler will silently insert calls to `Deref::deref`. For this reason, one
/// should be careful about implementing `Deref` and only do so when deref
/// coercion is desirable. See [below][implementing] for advice on when this is
/// typically desirable or undesirable.
///
/// Types that implement `Deref` or `DerefMut` are often called "smart
/// pointers" and the mechanism of deref coercion has been specifically designed
/// to facilitate the pointer-like behavior that name suggests. Often, the
/// purpose of a "smart pointer" type is to change the ownership semantics
/// of a contained value (for example, [`Rc`][rc] or [`Cow`][cow]) or the
/// storage semantics of a contained value (for example, [`Box`][box]).
///
/// # 有关更多细节，请访问 [《Rust 编程语言》中的章节][book] 以及关于 [解引用运算符][ref-deref-op]、
///
/// If `T` implements `Deref<Target = U>`, and `v` is a value of type `T`, then:
///
/// * In immutable contexts, `*v` (where `T` is neither a reference nor a raw
///   pointer) is equivalent to `*Deref::deref(&v)`.
/// * Values of type `&T` are coerced to values of type `&U`
/// * `T` implicitly implements all the methods of the type `U` which take the
///   `&self` receiver.
///
/// 3. 使用该类型的用户不会对任何强制转换行为感到惊讶。
/// 一般来说，如果以下条件不满足，则 **不应该** 实现解引用 trait：
/// 1. 解引用实现可能会意外失败；或者
///
/// # When to implement `Deref` or `DerefMut`
///
/// The same advice applies to both deref traits. In general, deref traits
/// **should** be implemented if:
///
/// 1. a value of the type transparently behaves like a value of the target
/// type;
/// 1. the implementation of the deref function is cheap; and
/// 1. users of the type will not be surprised by any deref coercion behavior.
///
/// In general, deref traits **should not** be implemented if:
///
/// 1. the deref implementations could fail unexpectedly; or
/// 1. 该类型包含的方法可能会与目标类型上的方法产生冲突。
/// 或
/// 1. 将解引用强制转换作为公共 API 的一部分是不理想的。
///
/// 注意，实现解引用 trait 与泛型地覆盖多个目标类型，以及仅针对特定目标类型进行实现之间存在巨大差异。
/// 对于多种目标类型，以及仅针对特定目标类型进行泛型实现。
/// 是截然不同的情况。
///
/// Generic implementations, such as for [`Box<T>`][box] (which is generic over
/// every type and dereferences to `T`) should be careful to provide few or no
/// 虽然包含几个关联函数，但部分原因也是出于此考虑。
/// collide with one on the target type, causing confusion for users.
/// `impl<T> Box<T>` has no methods (though several associated functions),
/// partly for this reason.
///
/// Specific implementations, such as for [`String`][string] (whose `Deref`
/// implementation has `Target = str`) can have many methods, since avoiding
/// collision is much easier. `String` and `str` both have many methods, and
/// `String` additionally behaves as if it has every method of `str` because of
/// deref coercion. The implementing type may also be generic while the
/// implementation is still specific in this sense; for example, [`Vec<T>`][vec]
/// dereferences to `[T]`, so methods of `T` are not applicable.
///
/// 还要考虑，解引用强制转换意味着解引用 trait 是类型公共 API 中比任何其他 trait 都更大的部分，因为它被编译器隐式调用。
/// 因此，它作为编译器隐式调用的部分，是公共 API 中更重要的部分。
/// 因此，建议考虑这是否是你能够舒适支持的公共 API。
/// something you are comfortable supporting as a public API.
///
/// The [`AsRef`] and [`Borrow`][core::borrow::Borrow] traits have very similar
/// signatures to `Deref`. It may be desirable to implement either or both of
/// 该 trait 的方法不应意外失败。解引用强制转换意味着
/// documentation for details.
///
/// # 在大多数使用场景中，它应该是绝对可靠的，尽管如果类型因程序错误而被误用，允许 panic 可能是可以接受的。
///
/// 然而，不可靠性并未得到强制，因此无法保证。
/// the compiler will often insert calls to `Deref::deref` implicitly. Failure
/// during dereferencing can be extremely confusing when `Deref` is invoked
/// implicitly. In the majority of uses it should be infallible, though it may
/// be acceptable to panic if the type is misused through programmer error, for
/// example.
///
/// However, infallibility is not enforced and therefore not guaranteed.
/// As such, `unsafe` code should not rely on infallibility in general for
/// 正确性。
///
/// [book]: ../../book/ch15-02-deref.html
/// [coercion]: #deref-coercion
/// [implementing]: #when-to-implement-deref-or-derefmut
/// [ref-deref-op]: ../../reference/expressions/operator-expr.html#the-dereference-operator
/// [method resolution]: ../../reference/expressions/method-call-expr.html
/// [type coercions]: ../../reference/type-coercions.html
/// [box]: ../../alloc/boxed/struct.Box.html
/// [string]: ../../alloc/string/struct.String.html
/// [vec]: ../../alloc/vec/struct.Vec.html
/// [rc]: ../../alloc/rc/struct.Rc.html
/// [cow]: ../../alloc/borrow/enum.Cow.html
///
/// # 示例
///
/// 一个包含单个字段的结构体，该字段可以通过解引用访问。
/// 结构体。
///
/// ```
/// use std::ops::Deref;
///
/// struct DerefExample<T> {
///     value: T
/// }
///
/// impl<T> Deref for DerefExample<T> {
///     type Target = T;
///
///     fn deref(&self) -> &Self::Target {
///         &self.value
///     }
/// }
///
/// let x = DerefExample { value: 'a' };
/// assert_eq!('a', *x);
/// ```
#[lang = "deref"]
#[doc(alias = "*")]
#[doc(alias = "&*")]
#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_diagnostic_item = "Deref"]
#[rustc_const_unstable(feature = "const_convert", issue = "143773")]
pub const trait Deref: PointeeSized {
    /// 解引用后得到的类型。
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_diagnostic_item = "deref_target"]
    #[lang = "deref_target"]
    type Target: ?Sized;

    /// 解引用该值。
    #[must_use]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_diagnostic_item = "deref_method"]
    fn deref(&self) -> &Self::Target;
}

#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_const_unstable(feature = "const_convert", issue = "143773")]
const impl<T: ?Sized> Deref for &T {
    type Target = T;

    #[rustc_diagnostic_item = "noop_method_deref"]
    fn deref(&self) -> &T {
        self
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T: ?Sized> !DerefMut for &T {}

#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_const_unstable(feature = "const_convert", issue = "143773")]
const impl<T: ?Sized> Deref for &mut T {
    type Target = T;

    fn deref(&self) -> &T {
        self
    }
}

/// Used for mutable dereferencing operations, like in `*v = 1;`.
///
/// 除了在可变上下文中用于显式解引用操作外，
/// (unary) `*` operator in mutable contexts, `DerefMut` is also used implicitly
/// 这种机制被称为
/// ["mutable deref coercion"][coercion]. In immutable contexts, [`Deref`] is used.
///
/// **警告：** 解引用强制转换是一个强大的语言特性，它
/// far-reaching implications for every type that implements `DerefMut`. The
/// compiler will silently insert calls to `DerefMut::deref_mut`. For this
/// reason, one should be careful about implementing `DerefMut` and only do so
/// when mutable deref coercion is desirable. See [the `Deref` docs][implementing]
/// 指针”，而解引用强制转换机制被专门设计用于实现类似指针的行为。通常，
///
/// Types that implement `DerefMut` or `Deref` are often called "smart
/// pointers" and the mechanism of deref coercion has been specifically designed
/// # 可变解引用强制转换
/// purpose of a "smart pointer" type is to change the ownership semantics
/// of a contained value (for example, [`Rc`][rc] or [`Cow`][cow]) or the
/// storage semantics of a contained value (for example, [`Box`][box]).
///
/// # Mutable deref coercion
///
/// If `T` implements `DerefMut<Target = U>`, and `v` is a value of type `T`,
/// then:
///
/// * In mutable contexts, `*v` (where `T` is neither a reference nor a raw pointer)
///   is equivalent to `*DerefMut::deref_mut(&mut v)`.
/// * Values of type `&mut T` are coerced to values of type `&mut U`
/// * `T` implicitly implements all the (mutable) methods of the type `U`.
///
/// For more details, visit [the chapter in *The Rust Programming Language*][book]
/// as well as the reference sections on [the dereference operator][ref-deref-op],
/// [method resolution] and [type coercions].
///
/// # Fallibility
///
/// **This trait's method should never unexpectedly fail**. Deref coercion means
/// the compiler will often insert calls to `DerefMut::deref_mut` implicitly.
/// Failure during dereferencing can be extremely confusing when `DerefMut` is
/// invoked implicitly. In the majority of uses it should be infallible, though
/// 如果类型被程序员误用，导致 panic 可能是可以接受的。
/// 例如，会出错。
///
/// 然而，不可靠性并未得到强制实现，因此无法保证。
/// As such, `unsafe` code should not rely on infallibility in general for
/// 正确性。
///
/// [book]: ../../book/ch15-02-deref.html
/// [coercion]: #mutable-deref-coercion
/// [implementing]: Deref#when-to-implement-deref-or-derefmut
/// [ref-deref-op]: ../../reference/expressions/operator-expr.html#the-dereference-operator
/// [method resolution]: ../../reference/expressions/method-call-expr.html
/// [type coercions]: ../../reference/type-coercions.html
/// [box]: ../../alloc/boxed/struct.Box.html
/// [string]: ../../alloc/string/struct.String.html
/// [rc]: ../../alloc/rc/struct.Rc.html
/// [cow]: ../../alloc/borrow/enum.Cow.html
///
/// # 示例
///
/// 一个具有单个字段的结构体，该字段可以通过解引用进行修改。
/// 结构体。
///
/// ```
/// use std::ops::{Deref, DerefMut};
///
/// struct DerefMutExample<T> {
///     value: T
/// }
///
/// impl<T> Deref for DerefMutExample<T> {
///     type Target = T;
///
///     fn deref(&self) -> &Self::Target {
///         &self.value
///     }
/// }
///
/// impl<T> DerefMut for DerefMutExample<T> {
///     fn deref_mut(&mut self) -> &mut Self::Target {
///         &mut self.value
///     }
/// }
///
/// let mut x = DerefMutExample { value: 'a' };
/// *x = 'b';
/// assert_eq!('b', x.value);
/// ```
#[lang = "deref_mut"]
#[doc(alias = "*")]
#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_const_unstable(feature = "const_convert", issue = "143773")]
pub const trait DerefMut: [const] Deref + PointeeSized {
    /// 可以修改地解引用该值。
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_diagnostic_item = "deref_mut_method"]
    fn deref_mut(&mut self) -> &mut Self::Target;
}

#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_const_unstable(feature = "const_convert", issue = "143773")]
const impl<T: ?Sized> DerefMut for &mut T {
    fn deref_mut(&mut self) -> &mut T {
        self
    }
}

/// Perma-unstable marker trait. Indicates that the type has a well-behaved [`Deref`]
/// (and, if applicable, [`DerefMut`]) implementation. This is relied on for soundness
/// 解引用模式的正确性而依赖的。
///
/// FIXME（解引用模式）：精确的语义尚未确定；大致思路是
/// successive calls to `deref`/`deref_mut` without intermediate mutation should be
/// idempotent, in the sense that they return the same value as far as pattern-matching
/// is concerned. Calls to `deref`/`deref_mut` must leave the pointer itself likewise
/// 表示结构体可以用作方法接收者。
#[unstable(feature = "deref_pure_trait", issue = "87121")]
#[lang = "deref_pure"]
#[rustc_dyn_incompatible_trait]
pub unsafe trait DerefPure: PointeeSized {}

#[unstable(feature = "deref_pure_trait", issue = "87121")]
unsafe impl<T: ?Sized> DerefPure for &T {}

#[unstable(feature = "deref_pure_trait", issue = "87121")]
unsafe impl<T: ?Sized> DerefPure for &mut T {}

/// Indicates that a struct can be used as a method receiver.
/// That is, a type can use this type as a type of `self`, like this:
/// ```compile_fail
/// # // This is currently compile_fail because the compiler-side parts
/// # // of arbitrary_self_types are not implemented
/// use std::ops::Receiver;
///
/// struct SmartPointer<T>(T);
///
/// impl<T> Receiver for SmartPointer<T> {
///    type Target = T;
/// }
///
/// struct MyContainedType;
///
/// impl MyContainedType {
///   fn method(self: SmartPointer<Self>) {
///     // ...
///   }
/// }
///
/// fn main() {
///   let ptr = SmartPointer(MyContainedType);
///   ptr.method();
/// }
/// ```
/// This trait is blanket implemented for any type which implements
/// [`Deref`], which includes stdlib pointer types like `Box<T>`,`Rc<T>`, `&T`,
/// and `Pin<P>`. For that reason, it's relatively rare to need to
/// 保证引用符合 Rust 的别名规则。
/// to implement a smart pointer type which can't implement [`Deref`]; perhaps
/// because you're interfacing with another programming language and can't
/// 可以调用该方法的目标类型。
///
/// When looking for method candidates, Rust will explore a chain of possible
/// `Receiver`s, so for example each of the following methods work:
/// ```
/// use std::boxed::Box;
/// use std::rc::Rc;
///
/// // Both `Box` and `Rc` (indirectly) implement Receiver
///
/// struct MyContainedType;
///
/// fn main() {
///   let t = Rc::new(Box::new(MyContainedType));
///   t.method_a();
///   t.method_b();
///   t.method_c();
/// }
///
/// impl MyContainedType {
///   fn method_a(&self) {
///
///   }
///   fn method_b(self: &Box<Self>) {
///
///   }
///   fn method_c(self: &Rc<Box<Self>>) {
///
///   }
/// }
/// ```
#[lang = "receiver"]
#[unstable(feature = "arbitrary_self_types", issue = "44874")]
#[rustc_dyn_incompatible_trait]
pub trait Receiver: PointeeSized {
    /// 这个 trait 即将被移除，并被基于当前“任意自类型”不稳定特性的更通用功能所取代。
    #[rustc_diagnostic_item = "receiver_target"]
    #[lang = "receiver_target"]
    #[unstable(feature = "arbitrary_self_types", issue = "44874")]
    type Target: ?Sized;
}

#[unstable(feature = "arbitrary_self_types", issue = "44874")]
impl<P: ?Sized, T: ?Sized> Receiver for P
where
    P: Deref<Target = T>,
{
    type Target = T;
}

/// Indicates that a struct can be used as a method receiver, without the
/// `arbitrary_self_types` feature. This is implemented by stdlib pointer types like `Box<T>`,
/// `Rc<T>`, `&T`, and `Pin<P>`.
///
/// This trait will shortly be removed and replaced with a more generic
/// facility based around the current "arbitrary self types" unstable feature.
/// That new facility will use the replacement trait above called `Receiver`
/// which is why this is now named `LegacyReceiver`.
#[lang = "legacy_receiver"]
#[unstable(feature = "legacy_receiver_trait", issue = "none")]
#[doc(hidden)]
pub trait LegacyReceiver: PointeeSized {
    // Empty.
}

#[unstable(feature = "legacy_receiver_trait", issue = "none")]
impl<T: PointeeSized> LegacyReceiver for &T {}

#[unstable(feature = "legacy_receiver_trait", issue = "none")]
impl<T: PointeeSized> LegacyReceiver for &mut T {}
