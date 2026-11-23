<a id="paths"></a>
# 路径

<a id="paths.intro"></a> *路径*是指由 `::` 标记分隔的一个或多个路径段序列。路径用于引用 [项}、值、[类型}、[宏]和[属性]。

仅由标识符段组成的简单路径的两个示例：

<!-- ignore: syntax fragment -->
```rust,ignore
x;
x::y::z;
```

## 路径的类型

<a id="paths.simple"></a>
### 简单路径

<a id="paths.simple.syntax"></a> 
```grammar,paths
SimplePath ->
    `::`? SimplePathSegment (`::` SimplePathSegment)*

SimplePathSegment ->
    IDENTIFIER | `super` | `self` | `crate` | `$crate`
```

<a id="paths.simple.intro"></a> 简单路径用于 [可见性] 标记、[属性}、[宏][mbe] 和 [`use`] 项。例如：

```rust
use std::io::{self, Write};
mod m {
    #[clippy::cyclomatic_complexity = "0"]
    pub (in super) fn f1() {}
}
```

<a id="paths.expr"></a>
### 表达式中的路径

<a id="paths.expr.syntax"></a> 
```grammar,paths
PathInExpression ->
    `::`? PathExprSegment (`::` PathExprSegment)*

PathExprSegment ->
    PathIdentSegment (`::` GenericArgs)?

PathIdentSegment ->
    IDENTIFIER | `super` | `self` | `Self` | `crate` | `$crate`

GenericArgs ->
      `<` GenericArgList? `>`
    | `(` TypeList? `)` (`->` TypeNoBounds)?

GenericArgList ->
    ( GenericArg `,` )* GenericArg `,`?

TypeList ->
    ( Type `,` )* Type `,`?

GenericArg ->
    Lifetime | Type | GenericArgsConst | GenericArgsBinding | GenericArgsBounds

GenericArgsConst ->
      BlockExpression
    | LiteralExpression
    | `-` LiteralExpression
    | SimplePathSegment

GenericArgsBinding ->
    TypePathSegment `=` Type

GenericArgsBounds ->
    TypePathSegment `:` Bounds?
```

<a id="paths.expr.intro"></a> 表达式中的路径允许指定具有泛型参数的路径。它们被用于 [表达式] 和 [模式] 的各种位置。

<a id="paths.expr.turbofish"></a> 在泛型参数之前需要 `::` 标记，以开括号 `<`，以避免与小于运算符产生歧义。这种语法俗称为“turbofish”语法。

```rust
(0..10).collect::<Vec<_>>();
Vec::<u8>::with_capacity(1024);
```

<a id="paths.expr.argument-order"></a> 泛型参数的顺序仅限于生命周期参数、类型参数、常量参数和相等约束。

<a id="paths.expr.complex-const-params"></a> 除非是 [字面量}、[推断的常量] 或单个路径段，否则常量参数必须被大括号包围。[推断的常量] 不能被大括号包围。

```rust
mod m {
    pub const C: usize = 1;
}
const C: usize = m::C;
fn f<const N: usize>() -> [u8; N] { [0; N] }

let _ = f::<1>(); // Literal.
let _: [_; 1] = f::<_>(); // Inferred const.
let _: [_; 1] = f::<(((_)))>(); // Inferred const.
let _ = f::<C>(); // Single segment path.
let _ = f::<{ m::C }>(); // Multi-segment path must be braced.
```

```rust,compile_fail
fn f<const N: usize>() -> [u8; N] { [0; _] }
let _: [_; 1] = f::<{ _ }>();
//                    ^ ERROR `_` not allowed here
```

> [!NOTE] > 在泛型参数列表中，[推断的常量] 被解析为 [推断类型][InferredType]，但在语义上被视为一种独立的 [常量泛型参数]。

<a id="paths.expr.实现-trait-params"></a> 与 `impl Trait` 类型对应的合成类型参数是隐式的，无法显式指定。

<a id="paths.qualified"></a>
## 限定路径

<a id="paths.qualified.syntax"></a> 
```grammar,paths
QualifiedPathInExpression -> QualifiedPathType (`::` PathExprSegment)+

QualifiedPathType -> `<` Type (`as` TypePath)? `>`

QualifiedPathInType -> QualifiedPathType (`::` TypePathSegment)+
```

<a id="paths.qualified.intro"></a> 完全限定的路径可以消除 [trait 实现] 中的歧义，并用于指定 [规范路径](#canonical-paths)。在类型说明中使用时，它支持使用下面指定的类型语法。

```rust
struct S;
impl S {
    fn f() { println!("S"); }
}
trait T1 {
    fn f() { println!("T1 f"); }
}
impl T1 for S {}
trait T2 {
    fn f() { println!("T2 f"); }
}
impl T2 for S {}
S::f();  // Calls the inherent impl.
<S as T1>::f();  // Calls the T1 trait function.
<S as T2>::f();  // Calls the T2 trait function.
```

<a id="paths.type"></a>
### 类型中的路径

<a id="paths.type.syntax"></a> 
```grammar,paths
TypePath -> `::`? TypePathSegment (`::` TypePathSegment)*

TypePathSegment -> PathIdentSegment (`::`? GenericArgs)?
```

<a id="paths.type.intro"></a> 类型路径用于类型定义、trait 边界和限定路径中。

<a id="paths.type.turbofish"></a> 尽管在泛型参数前允许使用 `::` 标记，但它是可选的，因为不存在像 [PathInExpression] 中那样的歧义。

```rust
# mod ops {
#     pub struct Range<T> {f1: T}
#     pub trait Index<T> {}
#     pub struct Example<'a> {f1: &'a i32}
# }
# struct S;
impl ops::Index<ops::Range<usize>> for S { /*...*/ }
fn i<'a>() -> impl Iterator<Item = ops::Example<'a>> {
    // ...
#    const EXAMPLE: Vec<ops::Example<'static>> = Vec::new();
#    EXAMPLE.into_iter()
}
type G = std::boxed::Box<dyn std::ops::FnOnce(isize) -> isize>;
```

<a id="paths.qualifiers"></a>
## 路径限定符

<a id="paths.qualifiers.intro"></a> 可以通过不同的前置限定符来表示路径，从而改变其解析方式的含义。

> [!NOTE] > [`use` 声明] 对 `self`、`super`、`crate` 和 `$crate` 有额外的行为和限制。

<a id="paths.qualifiers.global-root"></a>
### `::`

<a id="paths.qualifiers.global-root.intro"></a> 以 `::` 开头的路径被视为 *全局路径*，其路径段从不同的版本中不同的位置进行解析。路径中的每个标识符必须解析为一个项。

<a id="paths.qualifiers.global-root.edition2018"></a> > [!EDITION-2018] > 在 2015 版中，标识符从 “crate root” (`crate::` 在 2018 版中) 进行解析，该位置包含多种不同的项，包括外部 crates、如 `std` 或 `core` 这样的默认 crates，以及 crate 的顶层项（包括 `use` 导入）。> > 从 2018 版开始，以 `::` 开头的路径从 [extern prelude] 中的 crates 进行解析。也就是说，它们后面必须跟着一个 crate 的名称。

```rust
pub fn foo() {
    // In the 2018 edition, this accesses `std` via the extern prelude.
    // In the 2015 edition, this accesses `std` via the crate root.
    let now = ::std::time::Instant::now();
    println!("{:?}", now);
}
```

```rust,edition2015
// 2015 Edition
mod a {
    pub fn foo() {}
}
mod b {
    pub fn foo() {
        ::a::foo(); // call `a`'s foo function
        // In Rust 2018, `::a` would be interpreted as the crate `a`.
    }
}
# fn main() {}
```

<a id="paths.qualifiers.mod-self"></a>
### `self`

<a id="paths.qualifiers.mod-self.intro"></a> `self` 根据当前模块来解析路径。

<a id="paths.qualifiers.mod-self.restriction"></a> `self` 只能作为路径的第一个段（没有前面的 `::`）或最后一个段（前面有 `::`）。

<a id="paths.qualifiers.mod-self.trailing"></a> 当 `self` 作为路径的最后一个段时，它指的是前一段所命名的实体。前序路径必须解析为一个 [module]、[enumeration] 或 [trait]。

```rust
mod m {
    pub enum E { V1 }
    pub trait Tr {}
    pub(in crate::m::self) fn g() {} // OK: Modules can be parents of `self`.
}
type Ty = m::E::self; // OK: Enumerations can be parents of `self`.
fn f<T: m::Tr::self>() {} // OK: Traits can be parents of `self`.
# fn main() { let _: Ty = m::E::V1; }
```

```rust,compile_fail,E0223
struct S;
type Ty = S::self; // ERROR: Structs cannot be parents of `self`.
# fn main() {}
```

> [!NOTE] > 有关 `use` 声明中 `self` 的额外规则，请参阅 [items.use.self]。

<a id="paths.qualifiers.self-pat"></a> 在方法体中，由单个 `self` 段组成的路径解析为方法的 self 参数。

```rust
fn foo() {}
fn bar() {
    self::foo();
}
struct S(bool);
impl S {
  fn baz(self) {
        self.0;
    }
}
# fn main() {}
```

<a id="paths.qualifiers.type-self"></a>
### `Self`

<a id="paths.qualifiers.type-self.intro"></a> 大写的“S”表示的 `Self` 用于指代当前正在实现或定义的类型。它可以在以下情况下使用：

<a id="paths.qualifiers.type-self.trait"></a> * 在 [trait] 定义中，它指的是实现该 trait 的类型。

<a id="paths.qualifiers.type-self.实现"></a> * 在 [实现] 中，它指的是正在被实现的类型。当实现元组或单元 [结构体] 时，它也指 [value namespace] 中的构造函数。

<a id="paths.qualifiers.type-self.type"></a> * 在 [结构体]、[enumeration] 或 [union] 的定义中，它指的是被定义的类型。定义不允许无限递归（必须存在间接引用）。

<a id="paths.qualifiers.type-self.scope"></a> `Self` 的作用域类似于泛型参数；更多细节请参见 [`Self` 作用域] 部分。

<a id="paths.qualifiers.type-self.allowed-positions"></a> `Self` 只能作为第一个段使用，且不能前面有 `::`。

<a id="paths.qualifiers.type-self.no-generics"></a> `Self` 路径不能包含泛型参数（如 `Self::<i32>`）。

```rust
trait T {
    type Item;
    const C: i32;
    // `Self` will be whatever type that implements `T`.
    fn new() -> Self;
    // `Self::Item` will be the type alias in the implementation.
    fn f(&self) -> Self::Item;
}
struct S;
impl T for S {
    type Item = i32;
    const C: i32 = 9;
    fn new() -> Self {           // `Self` is the type `S`.
        S
    }
    fn f(&self) -> Self::Item {  // `Self::Item` is the type `i32`.
        Self::C                  // `Self::C` is the constant value `9`.
    }
}

// `Self` is in scope within the generics of a trait definition,
// to refer to the type being defined.
trait Add<Rhs = Self> {
    type Output;
    // `Self` can also reference associated items of the
    // type being implemented.
    fn add(self, rhs: Rhs) -> Self::Output;
}

struct NonEmptyList<T> {
    head: T,
    // A struct can reference itself (as long as it is not
    // infinitely recursive).
    tail: Option<Box<Self>>,
}
```

<a id="paths.qualifiers.super"></a>
### `super`

<a id="paths.qualifiers.super.intro"></a> 路径中的 `super` 会解析为父模块。

<a id="paths.qualifiers.super.allowed-positions"></a> 它只能用于路径的首段，可能位于初始的 `self` 段之后。

```rust
mod a {
    pub fn foo() {}
}
mod b {
    pub fn foo() {
        super::a::foo(); // call a's foo function
    }
}
# fn main() {}
```

<a id="paths.qualifiers.super.repetition"></a> 在第一个 `super` 或 `self` 之后，`super` 可以重复出现多次以指代祖先模块。

```rust
mod a {
    fn foo() {}

    mod b {
        mod c {
            fn foo() {
                super::super::foo(); // call a's foo function
                self::super::super::foo(); // call a's foo function
            }
        }
    }
}
# fn main() {}
```

<a id="paths.qualifiers.crate"></a>
### `crate`

<a id="paths.qualifiers.crate.intro"></a> `crate` 会解析路径相对于当前 crate 的位置。

<a id="paths.qualifiers.crate.allowed-positions"></a> `crate` 只能作为第一个段使用，且不能前面有 `::`。

```rust
fn foo() {}
mod a {
    fn bar() {
        crate::foo();
    }
}
# fn main() {}
```

<a id="paths.qualifiers.宏-crate"></a>
### `$crate`

<a id="paths.qualifiers.宏-crate.allowed-positions"></a> [`$crate`] 仅用于 [宏 transcriber]，只能作为第一个段使用，且不能前面有 `::`。

<a id="paths.qualifiers.宏-crate.hygiene"></a> [`$crate`] 会展开为一条路径，用于访问宏定义所在包顶层的项目，而无论该宏是在哪个包中被调用。

```rust
pub fn increment(x: u32) -> u32 {
    x + 1
}

#[macro_export]
macro_rules! inc {
    ($x:expr) => ( $crate::increment($x) )
}
# fn main() { }
```

<a id="paths.canonical"></a>
## 规范路径

<a id="paths.canonical.intro"></a> 在模块或实现中定义的每个项目都有一个*规范路径*，该路径对应于其在包内的定义位置。

<a id="paths.canonical.alias"></a> 这些项目的所有其他路径均为别名。

<a id="paths.canonical.def"></a> 规范路径被定义为一个*路径前缀*，随后加上该项目本身定义的路径段。

<a id="paths.canonical.non-canonical"></a> [实现]和[使用声明]没有规范路径，尽管实现中定义的项目有规范路径。在块表达式中定义的项目没有规范路径。在没有规范路径的模块中定义的项目也没有规范路径。在实现中定义且引用没有规范路径的项目时，例如作为实现类型、被实现的特质、类型参数或类型参数的边界，这些项目没有规范路径。

<a id="paths.canonical.module-prefix"></a> 模块的路径前缀就是该模块的规范路径。

<a id="paths.canonical.bare-实现-prefix"></a> 对于裸实现，它是被实现项目的规范路径，并被<span class="parenthetical">角度（`<>`）</span>括号包围。

<a id="paths.canonical.trait-实现-prefix"></a> 对于[特质实现]，它是被实现项目的规范路径后跟`as`，再后跟特质的规范路径，所有部分都被<span class="parenthetical">角度（`<>`）</span>括号包围。

<a id="paths.canonical.local-canonical-path"></a> 规范路径仅在特定包内有意义。不同包之间没有全局命名空间；项目的规范路径仅用于识别其在包内的位置。

```rust
// Comments show the canonical path of the item.

mod a { // crate::a
    pub struct Struct; // crate::a::Struct

    pub trait Trait { // crate::a::Trait
        fn f(&self); // crate::a::Trait::f
    }

    impl Trait for Struct {
        fn f(&self) {} // <crate::a::Struct as crate::a::Trait>::f
    }

    impl Struct {
        fn g(&self) {} // <crate::a::Struct>::g
    }
}

mod without { // crate::without
    fn canonicals() { // crate::without::canonicals
        struct OtherStruct; // None

        trait OtherTrait { // None
            fn g(&self); // None
        }

        impl OtherTrait for OtherStruct {
            fn g(&self) {} // None
        }

        impl OtherTrait for crate::a::Struct {
            fn g(&self) {} // None
        }

        impl crate::a::Trait for OtherStruct {
            fn f(&self) {} // None
        }
    }
}

# fn main() {}
```

[`$crate`]: macro.decl.hygiene.crate
[const generic argument]: items.generics.const.argument
[inferred const]: items.generics.const.inferred

[implementations]: items/implementations.md
[items]: items.md
[literal]: expressions/literal-expr.md
[use declarations]: items/use-declarations.md
[`Self` scope]: names/scopes.md#self-scope
[`use`]: items/use-declarations.md
[attributes]: attributes.md
[enumeration]: items/enumerations.md
[expressions]: expressions.md
[extern prelude]: names/preludes.md#extern-prelude
[implementation]: items/implementations.md
[macro transcribers]: macros-by-example.md
[macros]: macros.md
[mbe]: macros-by-example.md
[module]: items/modules.md
[patterns]: patterns.md
[struct]: items/structs.md
[trait implementations]: items/implementations.md#trait-implementations
[trait]: items/traits.md
[traits]: items/traits.md
[types]: types.md
[union]: items/unions.md
[`use` declarations]: items/use-declarations.md
[value namespace]: names/namespaces.md
[visibility]: visibility-and-privacy.md
