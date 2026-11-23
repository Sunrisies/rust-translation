<a id="type.实现-trait"></a>
# 实现特质

<a id="type.实现-trait.syntax"></a> 
```grammar,types
ImplTraitType -> `impl` Bounds?

ImplTraitTypeOneBound -> `impl` TraitBound?
```

<a id="type.实现-trait.intro"></a> `impl Trait` 提供了一种方式来指定未命名但具体的实现了特定特质的类型。它可以在两种位置出现：参数位置（作为函数的匿名类型参数），以及返回位置（作为抽象的返回类型）。

```rust
trait Trait {}
# impl Trait for () {}

// argument position: anonymous type parameter
fn foo(arg: impl Trait) {
}

// return position: abstract return type
fn bar() -> impl Trait {
}
```

<a id="type.实现-trait.bounds"></a> 必须至少有一个特质边界，最多一个 `use<..>` 边界，并且最多一个放弃使用的边界（例如，`?Sized`）。

<a id="type.实现-trait.param"></a>
## 匿名类型参数

<a id="type.实现-trait.param.intro"></a> > [!NOTE] > 这通常被称为“在参数位置使用 实现 trait”。（此处使用“参数”更为准确，但“在参数位置使用 实现 trait”是此功能开发期间使用的表述方式，仍保留在部分实现中。）

函数可以使用 `impl` 后跟一组特质边界来声明一个参数为匿名类型。调用者必须提供一个满足该匿名类型参数所声明边界的类型，并且函数只能使用通过该匿名类型参数的特质边界提供的方法。

例如，这两种形式几乎等价：

```rust
trait Trait {}

// generic type parameter
fn with_generic_type<T: Trait>(arg: T) {
}

// impl Trait in argument position
fn with_impl_trait(arg: impl Trait) {
}
```

<a id="type.实现-trait.param.泛型"></a> 也就是说，在参数位置使用的 `impl Trait` 是泛型类型参数如 `<T: Trait>` 的语法糖，只不过该类型是匿名的且不会出现在 [GenericParams] 列表中。

> [!NOTE] > 对于函数参数而言，泛型类型参数和 `impl Trait` 并不完全等价。使用像 `<T: Trait>` 这样的泛型参数时，调用者可以在调用点通过 [GenericArgs] 显式指定 `T` 的泛型参数，例如 `foo::<usize>(1)`。将其中一个参数改为另一个可能会对函数调用者造成破坏性变更，因为这改变了泛型参数的数量。

<a id="type.实现-trait.return"></a>
## 抽象返回类型

<a id="type.实现-trait.return.intro"></a> > [!NOTE] > 这通常被称为“在返回位置使用 实现 trait”。

函数可以使用 `impl Trait` 来返回抽象返回类型。这些类型实际上代表另一种具体类型，调用者只能使用指定 `Trait` 中声明的方法。

<a id="type.实现-trait.return.constraint-body"></a> 函数的每个可能返回值必须映射到相同的具体类型。

在返回位置使用 `impl Trait` 允许函数返回未装箱的抽象类型。这对于 [闭包] 和迭代器非常有用。例如，闭包具有独特的不可写入的类型。以前，从函数返回闭包的唯一方法是使用 [trait object]。

```rust
fn returns_closure() -> Box<dyn Fn(i32) -> i32> {
    Box::new(|x| x + 1)
}
```

这可能会导致内存分配和动态分派的性能开销。当时无法完全指定闭包的类型，只能使用 `Fn` trait。这意味着需要 trait object。然而，通过 `impl Trait`，可以更简单地实现这一点。

```rust
fn returns_closure() -> impl Fn(i32) -> i32 {
    |x| x + 1
}
```

这也避免了使用已装箱的 trait object 带来的缺点。

同样，迭代器的具体类型可能会变得非常复杂，因为它会包含之前所有迭代器的类型。返回 `impl Iterator` 意味着函数仅将 `Iterator` trait 作为其返回类型的约束，而无需明确指定所有其他涉及的迭代器类型。

<a id="type.实现-trait.return-in-trait"></a>
## 返回位置 trait 中的 `impl Trait`

<a id="type.实现-trait.return-in-trait.intro"></a> 在 trait 中的函数也可以使用 `impl Trait` 作为匿名关联类型的语法。

<a id="type.实现-trait.return-in-trait.desugaring"></a> trait 中关联函数的返回类型中的每个 `impl Trait` 都会被解析为匿名关联类型。实现函数签名中的返回类型用于确定关联类型的值。

<a id="type.实现-trait.泛型-captures"></a>
## 捕获

每个返回位置 `impl Trait` 抽象类型背后都隐藏着一个具体类型。为了让这个具体类型使用泛型参数，该泛型参数必须被抽象类型 *捕获*。

<a id="type.实现-trait.泛型-capture.auto"></a>
## 自动捕获

<a id="type.实现-trait.泛型-capture.auto.intro"></a> 返回位置 `impl Trait` 抽象类型会自动捕获所有作用域中的泛型参数，包括泛型类型、常量以及生命周期参数（包括更高阶的生命周期参数）。

<a id="type.实现-trait.泛型-capture.edition2024"></a> > [!EDITION-2024] > 在 2024 版之前，在自由函数以及固有 `impl` 的关联函数和方法中，未在抽象返回类型的边界中出现的泛型生命周期参数不会自动被捕获。

<a id="type.实现-trait.泛型-capture.precise"></a>
## 精确捕获

<a id="type.实现-trait.泛型-capture.precise.use"></a> 由返回位置 `impl Trait` 抽象类型捕获的泛型参数集合可以通过 [`use<..>` 边界]进行显式控制。如果存在该边界，则只有 `use<..>` 中列出的泛型参数会被捕获。例如：

```rust
fn capture<'a, 'b, T>(x: &'a (), y: T) -> impl Sized + use<'a, T> {
  //                                      ~~~~~~~~~~~~~~~~~~~~~~~
  //                                     Captures `'a` and `T` only.
  (x, y)
}
```

<a id="type.实现-trait.泛型-capture.precise.constraint-single"></a> 目前，边界列表中只能有一个 `use<..>` 边界，所有作用域中的类型和常量泛型参数必须包含在内，且抽象类型其他边界中出现的所有生命周期参数也必须包含在内。

<a id="type.实现-trait.泛型-capture.precise.constraint-生命周期"></a> 在 `use<..>` 边界中，存在的任何生命周期参数必须位于所有类型和常量泛型参数之前，如果生命周期参数 `_` 在其他情况下允许出现在 `impl Trait` 返回类型中，则也可以出现。

<a id="type.实现-trait.泛型-capture.precise.constraint-param-实现-trait"></a> 由于所有作用域中的类型参数必须按名称包含，因此在使用参数位置 `impl Trait` 的项签名中不能使用 `use<..>` 边界，因为这些项具有匿名类型参数。

<a id="type.实现-trait.泛型-capture.precise.constraint-in-trait"></a> 在 trait 定义中的关联函数中存在的任何 `use<..>` 边界必须包含该 trait 的所有泛型参数，包括该 trait 的隐式 `Self` 泛型类型参数。

## 泛型与 `impl Trait` 在返回值位置上的区别

在参数位置方面，`impl Trait` 的语义与泛型类型参数非常相似。然而，两者在返回值位置上存在显著差异。与泛型类型参数不同，`impl Trait` 中的函数决定返回类型，而调用者无法选择返回类型。

该函数：

```rust
# trait Trait {}
fn foo<T: Trait>() -> T {
    // ...
# panic!()
}
```

允许调用者确定返回类型 `T`，然后函数会返回该类型。

该函数：

```rust
# trait Trait {}
# impl Trait for () {}
fn foo() -> impl Trait {
    // ...
}
```

不允许调用者确定返回类型。相反，函数决定返回类型，但仅承诺实现 `Trait`。

<a id="type.实现-trait.constraint"></a>
## 限制

`impl Trait` 只能作为非 `extern` 函数的参数或返回值出现。它不能成为 `let` 绑定、字段类型的类型，也不能出现在类型别名中。

[`use<..>` bound]: ../trait-bounds.md#use-bounds
[closures]: closure.md
[trait object]: trait-object.md
