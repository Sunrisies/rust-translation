<a id="items.traits"></a>
# 特质

<a id="items.traits.syntax"></a> 
```grammar,items
Trait ->
    `unsafe`? `trait` IDENTIFIER GenericParams? ( `:` Bounds? )? WhereClause?
    `{`
        InnerAttribute*
        AssociatedItem*
    `}`
```

<a id="items.traits.intro"></a> 一个 _trait_ 描述了类型可以实现的抽象接口。该接口由三种类型的 [关联项] 组成：

- [函数](associated-items.md#associated-functions-and-methods) - [类型](associated-items.md#associated-types) - [常量](associated-items.md#associated-constants)

<a id="items.traits.namespace"></a> 特质声明在所在模块或块的类型 [命名空间] 中定义该特质。

<a id="items.traits.associated-item-namespaces"></a> 关联项作为特质在其各自命名空间中的成员被定义。关联类型在类型命名空间中定义。关联常量和关联函数在值命名空间中定义。

<a id="items.traits.self-param"></a> 所有特质都定义了一个隐式类型参数 `Self`，表示“实现该接口的类型”。特质也可以包含其他类型参数。这些类型参数，包括 `Self`，可能受到其他特质的约束等 [如常规那样][generics]。

<a id="items.traits.impls"></a> 通过单独的 [实现] 为特定类型实现特质。

<a id="items.traits.associated-item-decls"></a> 特质函数可以通过用分号替代函数体来省略函数体。这表示实现必须定义该函数。如果特质函数定义了体，则该定义作为未覆盖实现的默认定义。同样，关联常量可以省略等号和表达式来表示实现必须定义常量值。关联类型绝不能定义类型本身，类型只能在实现中指定。

```rust
// Examples of associated trait items with and without definitions.
trait Example {
    const CONST_NO_DEFAULT: i32;
    const CONST_WITH_DEFAULT: i32 = 99;
    type TypeNoDefault;
    fn method_without_default(&self);
    fn method_with_default(&self) {}
}
```

<a id="items.traits.const-fn"></a> 不允许特质函数为 [`const`]。

<a id="items.traits.bounds"></a>
## 特质边界

泛型项可以在其类型参数上使用特质作为 [边界]。

<a id="items.traits.泛型"></a>
## 泛型特质

为了使特质成为泛型，可以在特质名称后指定类型参数，使用与 [泛型函数] 相同的语法。

```rust
trait Seq<T> {
    fn len(&self) -> u32;
    fn elt_at(&self, n: u32) -> T;
    fn iter<F>(&self, f: F) where F: Fn(T);
}
```

<a id="object-safety"></a>
<a id="items.traits.dyn-compatible"></a>
## 动态兼容性

<a id="items.traits.dyn-compatible.intro"></a> 一个具有动态兼容性的特质可以作为 [trait object] 的基础特质。如果一个特质具备以下特性，则称为 *动态兼容*：

<a id="items.traits.dyn-compatible.supertraits"></a> * 所有的 [supertraits] 也必须是动态兼容的。

<a id="items.traits.dyn-compatible.sized"></a> * `Sized` 不得作为 [supertrait][supertraits]。换句话说，它不能要求 `Self: Sized`。

<a id="items.traits.dyn-compatible.associated-consts"></a> * 它不得包含任何关联常量。

<a id="items.traits.dyn-compatible.associated-types"></a> * 它不得包含带有泛型的关联类型。

<a id="items.traits.dyn-compatible.associated-functions"></a> * 所有关联函数必须要么从 trait object 中可分发，要么明确不可分发：* 可分发函数必须：* 没有类型参数（尽管生命周期参数允许）。* 是 [方法]，除了接收者类型之外不使用 `Self`。* 具有以下类型的接收者：* `&Self` (即 `&self`) * `&mut Self` (即 `&mut self`) * [`Box<Self>`] * [`Rc<Self>`] * [`Arc<Self>`] * [`Pin<P>`] 其中 `P` 是上述类型之一 * 没有不透明的返回类型；也就是说，* 不是 `async fn`（它包含隐藏的 `Future` 类型）。* 没有返回位置 `impl Trait` 类型 (`fn example(&self) -> impl Trait`)。* 没有 `where Self: Sized` 约束（`Self` 的接收者类型（即 `self`）隐含此条件）。* 没有 C-variadic 参数（`_: ...`）。* 明确不可分发函数需要：* 具有 `where Self: Sized` 约束（`Self` 的接收者类型（即 `self`）隐含此条件）。

<a id="items.traits.dyn-compatible.异步-traits"></a> * [`AsyncFn`}、 [`AsyncFnMut`] 和 [`AsyncFnOnce`] 特质不是动态兼容的。

> [!NOTE]
> This concept was formerly known as *object safety*.

```rust
# use std::rc::Rc;
# use std::sync::Arc;
# use std::pin::Pin;
// Examples of dyn compatible methods.
trait TraitMethods {
    fn by_ref(self: &Self) {}
    fn by_ref_mut(self: &mut Self) {}
    fn by_box(self: Box<Self>) {}
    fn by_rc(self: Rc<Self>) {}
    fn by_arc(self: Arc<Self>) {}
    fn by_pin(self: Pin<&Self>) {}
    fn with_lifetime<'a>(self: &'a Self) {}
    fn nested_pin(self: Pin<Arc<Self>>) {}
}
# struct S;
# impl TraitMethods for S {}
# let t: Box<dyn TraitMethods> = Box::new(S);
```

```rust,compile_fail
// This trait is dyn compatible, but these methods cannot be dispatched on a trait object.
trait NonDispatchable {
    // Non-methods cannot be dispatched.
    fn foo() where Self: Sized {}
    // Self type isn't known until runtime.
    fn returns(&self) -> Self where Self: Sized;
    // `other` may be a different concrete type of the receiver.
    fn param(&self, other: Self) where Self: Sized {}
    // Generics are not compatible with vtables.
    fn typed<T>(&self, x: T) where Self: Sized {}
}

struct S;
impl NonDispatchable for S {
    fn returns(&self) -> Self where Self: Sized { S }
}
let obj: Box<dyn NonDispatchable> = Box::new(S);
obj.returns(); // ERROR: cannot call with Self return
obj.param(S);  // ERROR: cannot call with Self parameter
obj.typed(1);  // ERROR: cannot call with generic type
```

```rust,compile_fail
# use std::rc::Rc;
// Examples of dyn-incompatible traits.
trait DynIncompatible {
    const CONST: i32 = 1;  // ERROR: cannot have associated const

    fn foo() {}  // ERROR: associated function without Sized
    fn returns(&self) -> Self; // ERROR: Self in return type
    fn typed<T>(&self, x: T) {} // ERROR: has generic type parameters
    fn nested(self: Rc<Box<Self>>) {} // ERROR: nested receiver cannot be dispatched on
}

struct S;
impl DynIncompatible for S {
    fn returns(&self) -> Self { S }
}
let obj: Box<dyn DynIncompatible> = Box::new(S); // ERROR
```

```rust,compile_fail
// `Self: Sized` traits are dyn-incompatible.
trait TraitWithSize where Self: Sized {}

struct S;
impl TraitWithSize for S {}
let obj: Box<dyn TraitWithSize> = Box::new(S); // ERROR
```

```rust,compile_fail
// Dyn-incompatible if `Self` is a type argument.
trait Super<A> {}
trait WithSelf: Super<Self> where Self: Sized {}

struct S;
impl<A> Super<A> for S {}
impl WithSelf for S {}
let obj: Box<dyn WithSelf> = Box::new(S); // ERROR: cannot use `Self` type parameter
```

<a id="items.traits.supertraits"></a>
## Supertraits

<a id="items.traits.supertraits.intro"></a> **Supertraits** 是那些必须被类型实现以符合特定特质的特质。此外，在任何 [泛型][generics] 或 [trait object] 由特质约束的情况下，该类型可以访问其 supertraits 的关联项。

<a id="items.traits.supertraits.decl"></a> 超特质是由 trait 的 `Self` 类型上的约束所声明，并且会传递性地影响那些被该约束声明的 trait 的超特质。一个 trait 成为其自身的超特质是一个错误。

<a id="items.traits.supertraits.subtrait"></a> 具有超特质的 trait 被称为其超特质的**子特质**。

以下是将 `Shape` 声明为 `Circle` 的超特质的示例。

```rust
trait Shape { fn area(&self) -> f64; }
trait Circle: Shape { fn radius(&self) -> f64; }
```

以下是相同的示例，只是使用了 [where clauses]。

```rust
trait Shape { fn area(&self) -> f64; }
trait Circle where Self: Shape { fn radius(&self) -> f64; }
```

下一个示例使用 `Shape` 中的 `area` 函数为 `radius` 提供默认实现。

```rust
# trait Shape { fn area(&self) -> f64; }
trait Circle where Self: Shape {
    fn radius(&self) -> f64 {
        // A = pi * r^2
        // so algebraically,
        // r = sqrt(A / pi)
        (self.area() / std::f64::consts::PI).sqrt()
    }
}
```

下一个示例在泛型参数上调用超特质方法。

```rust
# trait Shape { fn area(&self) -> f64; }
# trait Circle: Shape { fn radius(&self) -> f64; }
fn print_area_and_radius<C: Circle>(c: C) {
    // Here we call the area method from the supertrait `Shape` of `Circle`.
    println!("Area: {}", c.area());
    println!("Radius: {}", c.radius());
}
```

同样，这里是一个在 trait 对象上调用超特质方法的示例。

```rust
# trait Shape { fn area(&self) -> f64; }
# trait Circle: Shape { fn radius(&self) -> f64; }
# struct UnitCircle;
# impl Shape for UnitCircle { fn area(&self) -> f64 { std::f64::consts::PI } }
# impl Circle for UnitCircle { fn radius(&self) -> f64 { 1.0 } }
# let circle = UnitCircle;
let circle = Box::new(circle) as Box<dyn Circle>;
let nonsense = circle.radius() * circle.area();
```

<a id="items.traits.safety"></a>
## 不安全的 trait

<a id="items.traits.safety.intro"></a> 以 `unsafe` 关键字开头的 trait 表明*实现*该 trait 可能是[不安全的]。正确实现的不安全 trait 是安全的。[trait implementation] 也必须以 `unsafe` 关键字开头。

[`Sync`] 和 [`Send`] 是不安全 trait 的例子。

<a id="items.traits.params"></a>
## 参数模式

<a id="items.traits.params.patterns-no-body"></a> 没有体的关联函数中的参数仅允许 [IDENTIFIER] 或 `_` [通配符][WildcardPattern] 模式，以及 [SelfParam] 所允许的格式。`mut` [IDENTIFIER] 目前是允许的，但已过时，将来将变成严重错误。
<!-- https://github.com/rust-lang/rust/issues/35203 -->

```rust
trait T {
    fn f1(&self);
    fn f2(x: Self, _: i32);
}
```

```rust,compile_fail,E0642
trait T {
    fn f2(&x: &i32); // ERROR: patterns aren't allowed in functions without bodies
}
```

<a id="items.traits.params.patterns-with-body"></a> 有体的关联函数中的参数仅允许不可反驳的模式。

```rust
trait T {
    fn f1((a, b): (i32, i32)) {} // OK: is irrefutable
}
```

```rust,compile_fail,E0005
trait T {
    fn f1(123: i32) {} // ERROR: pattern is refutable
    fn f2(Some(x): Option<i32>) {} // ERROR: pattern is refutable
}
```

<a id="items.traits.params.pattern-required.edition2018"></a> 
> [!EDITION-2018]
> Prior to the 2018 edition, the pattern for an associated function parameter is optional:
>
> ```rust,edition2015
> // 2015 Edition
> trait T {
>     fn f(i32); // OK: parameter identifiers are not required
> }
> ```
>
> Beginning in the 2018 edition, patterns are no longer optional.

<a id="items.traits.params.restriction-patterns.edition2018"></a> 
> [!EDITION-2018]
> Prior to the 2018 edition, parameters in associated functions with a body are limited to the following kinds of patterns:
>
> * [IDENTIFIER]
> * `mut` [IDENTIFIER]
> * [`_`][WildcardPattern]
> * `&` [IDENTIFIER]
> * `&&` [IDENTIFIER]
>
> ```rust,edition2015,compile_fail,E0642
> // 2015 Edition
> trait T {
>     fn f1((a, b): (i32, i32)) {} // ERROR: pattern not allowed
> }
> ```
>
> Beginning in 2018, all irrefutable patterns are allowed as described in [items.traits.params.patterns-with-body].

<a id="items.traits.associated-visibility"></a>
## 项目可见性

<a id="items.traits.associated-visibility.intro"></a> 特征项在语法上允许使用 [Visibility] 注释，但在验证特征时会被拒绝。这样使得不同使用场景下的特征项能够使用统一的语法进行解析。例如，空 `vis` 宏片段说明符可用于特征项，而该宏规则也可用于其他允许可见性的情况。

```rust
macro_rules! create_method {
    ($vis:vis $name:ident) => {
        $vis fn $name(&self) {}
    };
}

trait T1 {
    // Empty `vis` is allowed.
    create_method! { method_of_t1 }
}

struct S;

impl S {
    // Visibility is allowed here.
    create_method! { pub method_of_s }
}

impl T1 for S {}

fn main() {
    let s = S;
    s.method_of_t1();
    s.method_of_s();
}
```

[WildcardPattern]: ../patterns.md#wildcard-pattern
[bounds]: ../trait-bounds.md
[trait object]: ../types/trait-object.md
[associated items]: associated-items.md
[method]: associated-items.md#methods
[supertraits]: #supertraits
[implementations]: implementations.md
[generics]: generics.md
[where clauses]: generics.md#where-clauses
[generic functions]: functions.md#generic-functions
[unsafe]: ../unsafety.md
[trait implementation]: implementations.md#trait-implementations
[`Send`]: ../special-types-and-traits.md#send
[`Sync`]: ../special-types-and-traits.md#sync
[`Arc<Self>`]: ../special-types-and-traits.md#arct
[`Box<Self>`]: ../special-types-and-traits.md#boxt
[`Pin<P>`]: ../special-types-and-traits.md#pinp
[`Rc<Self>`]: ../special-types-and-traits.md#rct
[`async`]: functions.md#async-functions
[`const`]: functions.md#const-functions
[type namespace]: ../names/namespaces.md
