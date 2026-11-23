<a id="items.实现"></a>
# 实现方式

<a id="items.实现.syntax"></a> 
```grammar,items
Implementation -> InherentImpl | TraitImpl

InherentImpl ->
    `impl` GenericParams? Type WhereClause? `{`
        InnerAttribute*
        AssociatedItem*
    `}`

TraitImpl ->
    `unsafe`? `impl` GenericParams? `!`? TypePath `for` Type
    WhereClause?
    `{`
        InnerAttribute*
        AssociatedItem*
    `}`
```

<a id="items.实现.intro"></a> 实现是一种将项目与_实现类型_关联起来的项。实现通过 `impl` 关键字定义，包含属于所实现的类型实例或静态类型的函数。

<a id="items.实现.kinds"></a> 有两种类型的实现：

- 固有实现 - [trait] 实现

<a id="items.实现.inherent"></a>
## 固有实现

<a id="items.实现.inherent.intro"></a> 固有实现定义为 `impl` 关键字、泛型类型声明、到名义类型的路径、where 子句以及一组括号内的关联项。

<a id="items.实现.inherent.implementing-type"></a> 名义类型称为_实现类型_，而关联项则是与_实现类型_相关的_关联项_。

<a id="items.实现.inherent.associated-items"></a> 固有实现将包含的项目与_实现类型_关联起来。

<a id="items.实现.inherent.allowed-items"></a> 固有实现可以包含[关联函数]（包括[方法]）和[关联常量]。

<a id="items.实现.inherent.type-alias"></a> 它们不能包含关联类型别名。

<a id="items.实现.inherent.associated-item-path"></a> 关联项的[路径]是到_实现类型的任何路径，后跟作为最终路径组件的关联项的标识符。

<a id="items.实现.inherent.coherence"></a> 一个类型也可以拥有多个固有实现。_实现类型_必须定义在与原始类型定义相同的crate中。

``` rust
pub mod color {
    pub struct Color(pub u8, pub u8, pub u8);

    impl Color {
        pub const WHITE: Color = Color(255, 255, 255);
    }
}

mod values {
    use super::color::Color;
    impl Color {
        pub fn red() -> Color {
            Color(255, 0, 0)
        }
    }
}

pub use self::color::Color;
fn main() {
    // Actual path to the implementing type and impl in the same module.
    color::Color::WHITE;

    // Impl blocks in different modules are still accessed through a path to the type.
    color::Color::red();

    // Re-exported paths to the implementing type also work.
    Color::red();

    // Does not work, because use in `values` is not pub.
    // values::Color::red();
}
```

<a id="items.实现.trait"></a>
## trait 实现

<a id="items.实现.trait.intro"></a> _trait 实现_的定义类似于固有实现，不同之处在于可选的泛型类型声明之后是[trait]，接着是`for`关键字，再后是到名义类型的路径。

<!-- To understand this, you have to back-reference to the previous section. :( -->

<a id="items.实现.trait.implemented-trait"></a> Trait被称为_实现的 trait_。_实现类型_实现了该实现的 trait。

<a id="items.实现.trait.def-requirement"></a> 一个特质实现必须定义被实现的特质所声明的所有非默认关联项，可以重新定义被实现的特质所定义的默认关联项，但不得定义其他任何项。

<a id="items.实现.trait.associated-item-path"></a> 关联项的路径为 `<` 后跟实现类型的路径，再后跟 `as` 后跟特质的路径，最后以 `>` 作为路径组件，接着是关联项的路径组件。

<a id="items.实现.trait.safety"></a> [不安全的特质] 要求特质实现必须以 `unsafe` 关键字开头。

```rust
# #[derive(Copy, Clone)]
# struct Point {x: f64, y: f64};
# type Surface = i32;
# struct BoundingBox {x: f64, y: f64, width: f64, height: f64};
# trait Shape { fn draw(&self, s: Surface); fn bounding_box(&self) -> BoundingBox; }
# fn do_draw_circle(s: Surface, c: Circle) { }
struct Circle {
    radius: f64,
    center: Point,
}

impl Copy for Circle {}

impl Clone for Circle {
    fn clone(&self) -> Circle { *self }
}

impl Shape for Circle {
    fn draw(&self, s: Surface) { do_draw_circle(s, *self); }
    fn bounding_box(&self) -> BoundingBox {
        let r = self.radius;
        BoundingBox {
            x: self.center.x - r,
            y: self.center.y - r,
            width: 2.0 * r,
            height: 2.0 * r,
        }
    }
}
```

<a id="items.实现.trait.coherence"></a>
### 特质实现的一致性

<a id="items.实现.trait.coherence.intro"></a> 如果孤儿规则检查失败或存在重叠的实现实例，则认为特质实现不一致。

<a id="items.实现.trait.coherence.overlapping"></a> 当两个特质实现所针对的特质之间存在非空交集时，这两个实现可以使用相同的类型进行实例化。<!-- 这可能有误？来源：对于输入类型参数，两个实现不能使用相同的类型集进行实例化。 -->

<a id="items.实现.trait.orphan-rule"></a>
#### 孤儿规则

<a id="items.实现.trait.orphan-rule.intro"></a> *孤儿规则*规定，只有当该特质或实现中的至少一个类型在当前 crate 中定义时，才允许存在特质实现。这可以防止不同 crate 之间存在冲突的特质实现，是确保一致性的关键。

孤儿实现是指针对外部类型实现外部特质的情况。如果这种情况被自由允许，则两个 crate 可能会以不兼容的方式实现同一类型的相同特质，导致添加或更新依赖项时由于冲突的实现而引发编译错误。

孤儿规则使得库作者能够在他们的 trait 中添加新的实现，而无需担心会破坏下游代码。如果没有这些限制，库无法添加类似 `impl<T: Display> MyTrait for T` 的实现，因为这可能会与下游实现产生冲突。

<a id="items.实现.trait.orphan-rule.def"></a> 对于 `impl<P1..=Pn> Trait<T1..=Tn> for T0`，只有当满足以下至少一个条件时，`impl` 才是有效的：

- `Trait` 是 [局部 trait] - 所有 `T0..=Tn` 类型中至少有一个必须是 [局部类型]。设 `Ti` 为第一个这样的类型。 - `P1..=Pn` 中的任何 [未覆盖类型] 参数都不应在 `T0..Ti`（不包括 `Ti`）中出现。

<a id="items.实现.trait.uncovered-param"></a> 只有 *未覆盖* 的类型参数受到限制。

<a id="items.实现.trait.fundamental"></a> 注意，为了连贯性，`[基本类型]` 是特殊的。`Box<T>` 中的 `T` 不被视为被覆盖的，而 `Box<LocalType>` 则被视为局部类型。

<a id="items.实现.generics"></a>
## 泛型实现

<a id="items.实现.generics.intro"></a> 实现可以接受 [泛型参数]，这些参数可以在其余实现中使用。实现参数直接写在 `impl` 关键字之后。

```rust
# trait Seq<T> { fn dummy(&self, _: T) { } }
impl<T> Seq<T> for Vec<T> {
    /* ... */
}
impl Seq<bool> for u32 {
    /* Treat the integer as a sequence of bits */
}
```

<a id="items.实现.generics.use"></a> 如果泛型参数在以下情况中至少出现一次，则 *约束* 了实现：

* 被实现的 trait（如果它有一个） * 实现的类型 * 作为包含另一个约束实现的参数的类型的 [边界] 中的 [关联类型]

<a id="items.实现.generics.constrain"></a> 类型和 const 参数必须始终约束实现。如果关联类型使用了生命周期，则生命周期也必须约束实现。

约束情况的示例：

```rust
# trait Trait{}
# trait GenericTrait<T> {}
# trait HasAssocType { type Ty; }
# struct Struct;
# struct GenericStruct<T>(T);
# struct ConstGenericStruct<const N: usize>([(); N]);
// T constrains by being an argument to GenericTrait.
impl<T> GenericTrait<T> for i32 { /* ... */ }

// T constrains by being an argument to GenericStruct
impl<T> Trait for GenericStruct<T> { /* ... */ }

// Likewise, N constrains by being an argument to ConstGenericStruct
impl<const N: usize> Trait for ConstGenericStruct<N> { /* ... */ }

// T constrains by being in an associated type in a bound for type `U` which is
// itself a generic parameter constraining the trait.
impl<T, U> GenericTrait<U> for u32 where U: HasAssocType<Ty = T> { /* ... */ }

// Like previous, except the type is `(U, isize)`. `U` appears inside the type
// that includes `T`, and is not the type itself.
impl<T, U> GenericStruct<U> where (U, isize): HasAssocType<Ty = T> { /* ... */ }
```

非约束情况的示例：

```rust,compile_fail
// The rest of these are errors, since they have type or const parameters that
// do not constrain.

// T does not constrain since it does not appear at all.
impl<T> Struct { /* ... */ }

// N does not constrain for the same reason.
impl<const N: usize> Struct { /* ... */ }

// Usage of T inside the implementation does not constrain the impl.
impl<T> Struct {
    fn uses_t(t: &T) { /* ... */ }
}

// T is used as an associated type in the bounds for U, but U does not constrain.
impl<T, U> Struct where U: HasAssocType<Ty = T> { /* ... */ }

// T is used in the bounds, but not as an associated type, so it does not constrain.
impl<T, U> GenericTrait<U> for u32 where U: GenericTrait<T> {}
```

允许的非约束生命周期参数的示例：

```rust
# struct Struct;
impl<'a> Struct {}
```

不允许的非约束生命周期参数的示例：

```rust,compile_fail
# struct Struct;
# trait HasAssocType { type Ty; }
impl<'a> HasAssocType for Struct {
    type Ty = &'a Struct;
}
```

<a id="items.实现.attributes"></a>
## 实现上的属性

实现中可能在 `impl` 关键字之前包含外部[属性]，在包含相关项的括号内部包含内部[属性]。内部属性必须位于任何相关项之前。此处具有意义的属性包括 [`cfg`]、 [`deprecated`]、 [`doc`]以及[lint检查属性]。

[trait]: traits.md
[associated constants]: associated-items.md#associated-constants
[associated functions]: associated-items.md#associated-functions-and-methods
[associated type]: associated-items.md#associated-types
[attributes]: ../attributes.md
[bounds]: ../trait-bounds.md
[`cfg`]: ../conditional-compilation.md
[`deprecated`]: ../attributes/diagnostics.md#the-deprecated-attribute
[`doc`]: ../../rustdoc/the-doc-attribute.html
[generic parameters]: generics.md
[methods]: associated-items.md#methods
[path]: ../paths.md
[the lint check attributes]: ../attributes/diagnostics.md#lint-check-attributes
[Unsafe traits]: traits.md#unsafe-traits
[local trait]: ../glossary.md#local-trait
[local type]: ../glossary.md#local-type
[fundamental types]: ../glossary.md#fundamental-type-constructors
[uncovered type]: ../glossary.md#uncovered-type
