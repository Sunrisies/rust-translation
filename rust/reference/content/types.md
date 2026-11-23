<a id="type"></a>
# 类型

<a id="type.intro"></a> Rust 程序中的每个变量、项目和值都具有一个类型。*值*的_类型_定义了存储该值的内存的含义以及可以对该值执行的操作。

<a id="type.builtin"></a> 内置类型与语言紧密集成，其方式在用户定义类型中无法模拟。

<a id="type.user-defined"></a> 用户定义类型的功能有限。

<a id="type.kinds"></a> 类型列表如下：

* 基本类型：* [Boolean] --- `bool` * [Numeric] --- 整数和浮点数 * [`char`] * [`str`] * [Never] --- `!` --- 没有值的类型 * 序列类型：* [Tuple] * [Array] * [Slice] * 用户定义类型：* [结构体] * [枚举] * [Union] * 函数类型：* [Functions] * [Closures] * 指针类型：* [References] * [Raw pointers] * [Function pointers] * 特质类型：* [trait objects] * [实现 trait]

<a id="type.name"></a>
## 类型表达式

<a id="type.name.syntax"></a> 
```grammar,types
Type ->
      TypeNoBounds
    | ImplTraitType
    | TraitObjectType

TypeNoBounds ->
      ParenthesizedType
    | ImplTraitTypeOneBound
    | TraitObjectTypeOneBound
    | TypePath
    | TupleType
    | NeverType
    | RawPointerType
    | ReferenceType
    | ArrayType
    | SliceType
    | InferredType
    | QualifiedPathInType
    | BareFunctionType
    | MacroInvocation
```

<a id="type.name.intro"></a> 如上述[Type]语法规则所定义的_类型表达式_是引用类型的语法。它可以引用：

<a id="type.name.sequence"></a> * 序列类型（[tuple], [array], [slice]）。

<a id="type.name.path"></a> * [类型路径]，可以引用：* 基本类型（[boolean], [numeric], [`char`], [`str`））。* 对[item]的路径（[结构体], [枚举], [union], [type alias], [trait]）。* [`Self`路径]，其中`Self`是实现的类型。* 通用[类型参数]。

<a id="type.name.pointer"></a> * 指针类型（[reference], [raw pointer], [function pointer]）。

<a id="type.name.inference"></a> * [推断类型]，要求编译器确定类型。

<a id="type.name.grouped"></a> * [括号]，用于消除歧义。

<a id="type.name.trait"></a> * 特质类型：[trait objects]和[实现 trait]。

<a id="type.name.never"></a> * [Never]类型。

<a id="type.name.宏-expansion"></a> * [宏]，它们展开为类型表达式。

<a id="type.name.parenthesized"></a>
### 括号包裹的类型

<a id="type.name.parenthesized.syntax"></a> 
```grammar,types
ParenthesizedType -> `(` Type `)`
```

<a id="type.name.parenthesized.intro"></a> 在某些情况下，类型的组合可能会产生歧义。在类型周围使用括号可以避免歧义。例如，[引用类型] 内的 [类型边界] 的 `+` 运算符并不清楚边界在哪里，因此需要使用括号。需要这种消除歧义的语法规则采用 [TypeNoBounds] 规则，而不是 [Type][grammar-Type]。

```rust
# use std::any::Any;
type T<'a> = &'a (dyn Any + Send);
```

<a id="type.recursive"></a>
## 递归类型

<a id="type.recursive.intro"></a> 名词类型——[结构体、枚举和联合]——可以是递归的。也就是说，每个 `enum` 变体或 `struct` 或 `union` 字段可以直接或间接引用其包中的 `enum` 或 `struct` 类型本身。

<a id="type.recursive.constraint"></a> 这种递归存在限制：

* 递归类型必须在递归中包含名词类型（不是单纯的 [类型别名]，也不是其他结构类型，如[数组]或[元组]）。因此，`type Rec = &'static [Rec]`是不允许的。 * 递归类型的规模必须是有限的；换句话说，该类型的递归字段必须是[指针类型]。

*递归*类型及其使用的示例：

```rust
enum List<T> {
    Nil,
    Cons(T, Box<List<T>>)
}

let a: List<i32> = List::Cons(7, Box::new(List::Cons(13, Box::new(List::Nil))));
```

[`char`]: types/char.md
[`str`]: types/str.md
[Array]: types/array.md
[Boolean]: types/boolean.md
[Closures]: types/closure.md
[Enum]: types/enum.md
[Function pointers]: types/function-pointer.md
[Functions]: types/function-item.md
[Impl trait]: types/impl-trait.md
[Macros]: macros.md
[Numeric]: types/numeric.md
[Parentheses]: #parenthesized-types
[Raw pointers]: types/pointer.md#raw-pointers-const-and-mut
[References]: types/pointer.md#shared-references-
[Slice]: types/slice.md
[Struct]: types/struct.md
[Trait objects]: types/trait-object.md
[Tuple]: types/tuple.md
[Type paths]: paths.md#paths-in-types
[Union]: types/union.md
[`Self` path]: paths.md#self-1
[arrays]: types/array.md
[enumerations]: types/enum.md
[function pointer]: types/function-pointer.md
[inferred type]: types/inferred.md
[item]: items.md
[never]: types/never.md
[pointer types]: types/pointer.md
[raw pointer]: types/pointer.md#raw-pointers-const-and-mut
[reference type]: types/pointer.md#shared-references-
[reference]: types/pointer.md#shared-references-
[structs]: types/struct.md
[trait]: types/trait-object.md
[tuples]: types/tuple.md
[type alias]: items/type-aliases.md
[type aliases]: items/type-aliases.md
[type boundaries]: trait-bounds.md
[type parameters]: types/parameters.md
[unions]: types/union.md
