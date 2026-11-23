<a id="items.associated"></a>
# 关联项

<a id="items.associated.syntax"></a> 
```grammar,items
AssociatedItem ->
    OuterAttribute* (
        MacroInvocationSemi
      | ( Visibility? ( TypeAlias | ConstantItem | Function ) )
    )
```

<a id="items.associated.intro"></a> *关联项*是在 [traits] 中声明或在 [implementations] 中定义的项。它们被称为关联项，是因为它们定义在关联类型上——即实现中的类型。

<a id="items.associated.kinds"></a> 它们是您在模块中可以声明的项类型的子集。具体来说，包括 [关联函数](包括方法)、[关联类型]和[关联常量]。


<a id="items.associated.related"></a> 当关联项在逻辑上与关联项相关时，关联项非常有用。例如，`Option` 中的 `is_some` 方法与 Options 有内在联系，因此应被视为关联项。

<a id="items.associated.decl-def"></a> 每种关联项类型有两种形式：包含实际实现的定义和声明签名的声明。

<a id="items.associated.trait-items"></a> 正是这些声明构成了 trait 的契约以及通用类型中可用的内容。

<a id="items.associated.fn"></a>
## 关联函数与方法

<a id="items.associated.fn.intro"></a> *关联函数*是与类型相关的 [函数]。

<a id="items.associated.fn.decl"></a> 一个 *关联函数声明*用于定义关联函数的签名。它以函数项的形式书写，但函数体被 `;` 替换。

<a id="items.associated.name"></a> 标识符是函数的名称。

<a id="items.associated.same-signature"></a> 关联函数的泛型、参数列表、返回类型和 where 子句必须与关联函数声明中的内容相同。

<a id="items.associated.fn.def"></a> 一个 *关联函数定义*用于定义与另一个类型相关的函数。它的书写方式与 [函数项] 相同。

> [!NOTE] > 常见的例子是名为 `new` 的关联函数，它返回与其关联的类型的数值。

```rust
struct Struct {
    field: i32
}

impl Struct {
    fn new() -> Struct {
        Struct {
            field: 0i32
        }
    }
}

fn main () {
    let _struct = Struct::new();
}
```

<a id="items.associated.fn.qualified-self"></a> 当关联函数在特质上声明时，可以通过一个[路径]来调用该函数，该路径是特质的名称加上通往该特质的路径。此时，会替代 `<_ as Trait>::function_name`。

```rust
trait Num {
    fn from_i32(n: i32) -> Self;
}

impl Num for f64 {
    fn from_i32(n: i32) -> f64 { n as f64 }
}

// These 4 are all equivalent in this case.
let _: f64 = Num::from_i32(42);
let _: f64 = <_ as Num>::from_i32(42);
let _: f64 = <f64 as Num>::from_i32(42);
let _: f64 = f64::from_i32(42);
```

<a id="items.associated.fn.method"></a>
### 方法

<a id="items.associated.fn.method.intro"></a> 第一个参数为`self`的关联函数被称为*方法*，可以使用[方法调用运算符]来调用它们，例如`x.foo()`，也可以使用常规的函数调用语法。

<a id="items.associated.fn.method.self-ty"></a> 如果指定了`self`参数的类型，则该类型必须属于以下生成规则所确定的类型（其中`'lt`表示某种任意的生命周期）：

```text
P = &'lt S | &'lt mut S | Box<S> | Rc<S> | Arc<S> | Pin<P>
S = Self | P
```

此生成规则中的`Self`表示法指的是实现该类型的类型。它也可以包括上下文类型别名`Self`，其他类型别名，或指向实现类型的关联类型投影。

```rust
# use std::rc::Rc;
# use std::sync::Arc;
# use std::pin::Pin;
// Examples of methods implemented on struct `Example`.
struct Example;
type Alias = Example;
trait Trait { type Output; }
impl Trait for Example { type Output = Example; }
impl Example {
    fn by_value(self: Self) {}
    fn by_ref(self: &Self) {}
    fn by_ref_mut(self: &mut Self) {}
    fn by_box(self: Box<Self>) {}
    fn by_rc(self: Rc<Self>) {}
    fn by_arc(self: Arc<Self>) {}
    fn by_pin(self: Pin<&Self>) {}
    fn explicit_type(self: Arc<Example>) {}
    fn with_lifetime<'a>(self: &'a Self) {}
    fn nested<'a>(self: &mut &'a Arc<Rc<Box<Alias>>>) {}
    fn via_projection(self: <Example as Trait>::Output) {}
}
```

<a id="associated.fn.method.self-pat-shorthands"></a> 可以在不指定类型的情况下使用简写语法，具有以下等价形式：

简写方式 | 等价形式
----------------------|-----------
`self` | `self: Self` `&'lifetime self` | `self: &'lifetime Self` `&'lifetime mut self` | `self: &'lifetime mut Self`

> [!NOTE] > 使用这种简写方式时，生命期通常会被省略。

<a id="associated.fn.method.self-pat-mut"></a> 如果`self`参数前加上`mut`，则它成为一个可变变量，类似于使用`mut`标识符模式的常规参数。例如：

```rust
trait Changer: Sized {
    fn change(mut self) {}
    fn modify(mut self: Box<Self>) {}
}
```

作为特质上方法的示例，考虑以下情况：

```rust
# type Surface = i32;
# type BoundingBox = i32;
trait Shape {
    fn draw(&self, surface: Surface);
    fn bounding_box(&self) -> BoundingBox;
}
```

这定义了一个包含两个方法的特质。当该特质在作用域中时，所有具有该特质[实现]的值都可以调用其`draw`和`bounding_box`方法。

```rust
# type Surface = i32;
# type BoundingBox = i32;
# trait Shape {
#     fn draw(&self, surface: Surface);
#     fn bounding_box(&self) -> BoundingBox;
# }
#
struct Circle {
    // ...
}

impl Shape for Circle {
    // ...
#   fn draw(&self, _: Surface) {}
#   fn bounding_box(&self) -> BoundingBox { 0i32 }
}

# impl Circle {
#     fn new() -> Circle { Circle{} }
# }
#
let circle_shape = Circle::new();
let bounding_box = circle_shape.bounding_box();
```

<a id="items.associated.fn.params.edition2018"></a> > [!EDITION-2018] > 在2015版中，可以声明带有匿名参数的特质方法（例如`fn foo(u8)`）。这一做法已被弃用，并且在2018版中会导致错误。所有参数都必须有参数名。

<a id="items.associated.fn Param-attributes"></a>
#### 方法参数上的属性

方法参数上的属性遵循与[常规函数参数]相同的规则和限制。

<a id="items.associated.type"></a>
## 关联类型

<a id="items.associated.type.intro"></a> *关联类型*是与另一个类型相关的[类型别名]。

<a id="items.associated.type.restrictions"></a> 关联类型不能在[固有实现]中定义，也不能在特质中提供默认实现。

<a id="items.associated.type.decl"></a> *关联类型声明*用于声明关联类型的签名。其格式如下：其中 `Assoc` 是关联类型的名称，`Params` 是类型、生命周期或常量参数的逗号分隔列表，`Bounds` 是关联类型必须满足的特质边界的加号分隔列表，而 `WhereBounds` 则是参数必须满足的边界的逗号分隔列表：

<!-- ignore: illustrative example forms -->
```rust,ignore
type Assoc;
type Assoc: Bounds;
type Assoc<Params>;
type Assoc<Params>: Bounds;
type Assoc<Params> where WhereBounds;
type Assoc<Params>: Bounds where WhereBounds;
```

<a id="items.associated.type.name"></a> 标识符是所声明的类型别名的名称。

<a id="items.associated.type.实现-fulfillment"></a> 可选的特质边界必须由类型别名的实现者满足。

<a id="items.associated.type.sized"></a> 关联类型具有隐式的 [`Sized]` 边界，可以使用特殊的 `?Sized` 边界来放宽此边界。

<a id="items.associated.type.def"></a> *关联类型定义*用于为特质在某种类型上的实现指定类型别名。

<a id="items.associated.type.def-restriction"></a> 它们的写法类似于*关联类型声明*，但不包含 `Bounds`，而必须包含 `Type`：

<!-- ignore: illustrative example forms -->
```rust,ignore
type Assoc = Type;
type Assoc<Params> = Type; // the type `Type` here may reference `Params`
type Assoc<Params> = Type where WhereBounds;
type Assoc<Params> where WhereBounds = Type; // deprecated, prefer the form above
```

<a id="items.associated.type.alias"></a> 如果类型 `Item` 有一个来自特质 `Trait` 的关联类型 `Assoc`，那么 `<Item as Trait>::Assoc` 是一个与关联类型定义中指定的类型同义的别名。

<a id="items.associated.type.param"></a> 此外，如果 `Item` 是类型参数，则 `Item::Assoc` 可以在类型参数中使用。

<a id="items.associated.type.泛型"></a> 关联类型可能包括 [泛型参数] 和 [where 子句]；这些通常被称为 *泛型关联类型* 或 *GATs*。如果类型 `Thing` 具有来自 trait `Trait` 的关联类型 `Item`，并且包含泛型 `<'a>`，则该类型可以命名为 `<Thing as Trait>::Item<'x>`，其中 `'x` 是作用域中的某个生命周期。在这种情况下，`'x` 将在 实现 中关联类型定义中出现 `'a` 时被使用。

```rust
trait AssociatedType {
    // Associated type declaration
    type Assoc;
}

struct Struct;

struct OtherStruct;

impl AssociatedType for Struct {
    // Associated type definition
    type Assoc = OtherStruct;
}

impl OtherStruct {
    fn new() -> OtherStruct {
        OtherStruct
    }
}

fn main() {
    // Usage of the associated type to refer to OtherStruct as <Struct as AssociatedType>::Assoc
    let _other_struct: OtherStruct = <Struct as AssociatedType>::Assoc::new();
}
```

带有泛型和 where 子句的关联类型的示例：

```rust
struct ArrayLender<'a, T>(&'a mut [T; 16]);

trait Lend {
    // Generic associated type declaration
    type Lender<'a> where Self: 'a;
    fn lend<'a>(&'a mut self) -> Self::Lender<'a>;
}

impl<T> Lend for [T; 16] {
    // Generic associated type definition
    type Lender<'a> = ArrayLender<'a, T> where Self: 'a;

    fn lend<'a>(&'a mut self) -> Self::Lender<'a> {
        ArrayLender(self)
    }
}

fn borrow<'a, T: Lend>(array: &'a mut T) -> <T as Lend>::Lender<'a> {
    array.lend()
}

fn main() {
    let mut array = [0usize; 16];
    let lender = borrow(&mut array);
}
```

### 关联类型容器示例

考虑以下 `Container` trait 示例。请注意，该类型可以在方法签名中使用：

```rust
trait Container {
    type E;
    fn empty() -> Self;
    fn insert(&mut self, elem: Self::E);
}
```

为了实现此 trait，一个类型不仅必须为每个方法提供实现，还必须指定类型 `E`。以下是标准库类型 `Vec` 的 `Container` 实现：

```rust
# trait Container {
#     type E;
#     fn empty() -> Self;
#     fn insert(&mut self, elem: Self::E);
# }
impl<T> Container for Vec<T> {
    type E = T;
    fn empty() -> Vec<T> { Vec::new() }
    fn insert(&mut self, x: T) { self.push(x); }
}
```

### `Bounds` 与 `WhereBounds` 之间的关系

在此示例中：

```rust
# use std::fmt::Debug;
trait Example {
    type Output<T>: Ord where T: Debug;
}
```

给定类似 `<X as Example>::Output<Y>` 的关联类型引用，关联类型本身必须是 `Ord`，而类型 `Y` 必须是 `Debug`。

<a id="items.associated.type.泛型-where-clause"></a>
### 泛型关联类型所需的 where 子句

<a id="items.associated.type.泛型-where-clause.intro"></a> trait 上的泛型关联类型声明目前可能需要一系列 where 子句，这取决于 trait 中的函数以及 GAT 的使用方式。这些规则未来可能会放宽；相关更新可以在 [泛型关联类型倡议仓库](https://rust-lang.github.io/泛型-associated-types-initiative/explainer/required_bounds.html) 中找到。

<a id="items.associated.type.泛型-where-clause.valid-fn"></a> 简而言之，这些 where 子句是必需的，以便最大化 实现 中允许的关联类型定义。为此，任何可以在函数上证明成立的子句（使用函数的参数或 trait 的参数）在 GAT 作为输入或输出时，也必须写在 GAT 本身上。

```rust
trait LendingIterator {
    type Item<'x> where Self: 'x;
    fn next<'a>(&'a mut self) -> Self::Item<'a>;
}
```

在上述内容中，关于 `next` 函数，我们可以证明 `Self: 'a`，因为从 `&'a mut self` 可以推断出边界条件；因此，我们必须在 GAT 本身上写出相应的边界条件：`where Self: 'x`。

<a id="items.associated.type.泛型-where-clause.intersection"></a> 当一个 trait 中有多个使用 GAT 的函数时，会采用这些函数边界条件的*交集*，而不是并集。

```rust
trait Check<T> {
    type Checker<'x>;
    fn create_checker<'a>(item: &'a T) -> Self::Checker<'a>;
    fn do_check(checker: Self::Checker<'_>);
}
```

在这个示例中，`type Checker<'a>;` 不需要任何边界条件。虽然我们知道 `create_checker` 上有 `T: 'a`，但不知道 `do_check` 上是否有此约束。然而，如果 `do_check` 被注释掉，则 `Checker` 上必须存在 `where T: 'x` 的边界条件。

<a id="items.associated.type.泛型-where-clause.forward"></a> 关联类型的边界条件也会传递 required where 子句。

```rust
trait Iterable {
    type Item<'a> where Self: 'a;
    type Iterator<'a>: Iterator<Item = Self::Item<'a>> where Self: 'a;
    fn iter<'a>(&'a self) -> Self::Iterator<'a>;
}
```

在这里，`Item` 上需要 `where Self: 'a`，这是由于 `iter` 的原因。然而，`Item` 也用于 `Iterator` 的边界条件中，因此那里同样需要 `where Self: 'a` 子句。

<a id="items.associated.type.泛型-where-clause.static"></a> 最后，trait 中 GAT 上任何显式的 `'static` 使用都不计入所需的边界条件中。

```rust
trait StaticReturn {
    type Y<'a>;
    fn foo(&self) -> Self::Y<'static>;
}
```

<a id="items.associated.const"></a>
## 关联常量

<a id="items.associated.const.intro"></a> *关联常量*是与类型相关的[常量]。

<a id="items.associated.const.decl"></a> *关联常量声明*用于定义关联常量的签名。其格式为 `const`，然后是一个标识符，接着是 `:`，再是一个类型，最后以 `;` 结束。

<a id="items.associated.const.name"></a> 标识符是在路径中使用的常量名称。类型则是定义必须实现的类型。

<a id="items.associated.const.def"></a> *关联常量定义*用于定义与类型相关的常量。其格式与[常量项]相同。

<a id="items.associated.const.eval"></a> 关联常量定义仅在被引用时进行[常量评估]。此外，包含[泛型参数]的定义在单态化后进行评估。

```rust,compile_fail
struct Struct;
struct GenericStruct<const ID: i32>;

impl Struct {
    // Definition not immediately evaluated
    const PANIC: () = panic!("compile-time panic");
}

impl<const ID: i32> GenericStruct<ID> {
    // Definition not immediately evaluated
    const NON_ZERO: () = if ID == 0 {
        panic!("contradiction")
    };
}

fn main() {
    // Referencing Struct::PANIC causes compilation error
    let _ = Struct::PANIC;

    // Fine, ID is not 0
    let _ = GenericStruct::<1>::NON_ZERO;

    // Compilation error from evaluating NON_ZERO with ID=0
    let _ = GenericStruct::<0>::NON_ZERO;
}
```

### 关联常量示例

一个基本示例：

```rust
trait ConstantId {
    const ID: i32;
}

struct Struct;

impl ConstantId for Struct {
    const ID: i32 = 1;
}

fn main() {
    assert_eq!(1, Struct::ID);
}
```

使用默认值：

```rust
trait ConstantIdDefault {
    const ID: i32 = 1;
}

struct Struct;
struct OtherStruct;

impl ConstantIdDefault for Struct {}

impl ConstantIdDefault for OtherStruct {
    const ID: i32 = 5;
}

fn main() {
    assert_eq!(1, Struct::ID);
    assert_eq!(5, OtherStruct::ID);
}
```

[associated functions]: #associated-functions-and-methods
[associated types]: #associated-types
[associated constants]: #associated-constants
[`Arc<Self>`]: ../special-types-and-traits.md#arct
[`Box<Self>`]: ../special-types-and-traits.md#boxt
[`Pin<P>`]: ../special-types-and-traits.md#pinp
[`Rc<Self>`]: ../special-types-and-traits.md#rct
[`Sized`]: ../special-types-and-traits.md#sized
[traits]: traits.md
[type aliases]: type-aliases.md
[inherent implementations]: implementations.md#inherent-implementations
[identifier]: ../identifiers.md
[identifier pattern]: ../patterns.md#identifier-patterns
[implementations]: implementations.md
[type]: ../types.md#type-expressions
[constants]: constant-items.md
[constant item]: constant-items.md
[functions]: functions.md
[function item]: ../types/function-item.md
[method call operator]: ../expressions/method-call-expr.md
[path]: ../paths.md
[regular function parameters]: functions.md#attributes-on-function-parameters
[generic parameters]: generics.md
[where clauses]: generics.md#where-clauses
[constant evaluation]: ../const_eval.md
