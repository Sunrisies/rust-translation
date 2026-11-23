# Glossary

<a id="glossary.ast"></a>
### 抽象语法树

“抽象语法树”或“AST”是编译器在编译程序时对其结构所采用的中间表示形式。

### Alignment

值的对齐方式指定了值应起始使用的地址。必须始终为2的幂次。对值的引用必须对齐。[更多][alignment]。

<a id="glossary.abi"></a>
### 应用程序二进制接口 (ABI)

*应用程序二进制接口* (ABI) 定义了编译后的代码如何与其他编译后的代码交互。通过 [`extern` 块]和 [`extern fn`]，*ABI 字符串*会影响：

- **调用约定**：函数参数如何传递、值如何返回（例如，在寄存器中或栈上），以及谁负责清理栈。 - **反汇编**：是否允许栈反汇编。例如，“C-unwind” ABI允许跨 FFI 边界进行反汇编，而“C” ABI则不允许。

### Arity

参数个数指的是函数或运算符所接受的参数数量。对于某些示例，`f(2, 3)`和`g(4, 6)`的参数为2，而`h(8, 2, 6)`的参数为3。`!`运算符的参数为1。

### Array

数组有时也称为固定大小数组或内联数组，是一种描述元素集合的值，每个元素都通过程序在运行时可计算的索引来选择。它占据连续的内存区域。

### 关联项

关联项是与另一个项相关联的项。关联项在[实现]中定义，并在[特征]中声明。只有函数、常量和类型别名可以成为关联项。与[自由项]不同。

### 通用实现

任何出现[未覆盖类型](#uncovered-type)的类型的实现。`impl<T> Foo for T`、`impl<T> Bar<T> for T`、`impl<T> Bar<Vec<T>> for T`和`impl<T> Bar<T> for Vec<T>`都被视为通用实现。然而，`impl<T> Bar<Vec<T>> for Vec<T>`不是通用实现，因为此实现中出现的所有`T`实例都由`Vec`覆盖。

### Bound

边界是对类型或特征的约束。例如，如果函数接受的参数有边界限制，传递给该函数的类型必须遵守这一约束。

### Combinator

组合器是高阶函数，它们仅将函数和之前定义的组合器应用于参数以产生结果。可以用它来以模块化方式管理控制流。

### Crate

库是编译和链接的单位。存在不同类型的库，如库或可执行文件。库可以链接并引用其他库，这些外部库被称为外部库。一个库包含自包含的模块树，从名为库根的未命名根模块开始。[项]可以通过在库根中标记为公共来对其他库可见，包括通过公共模块的[路径]实现。

### Dispatch

调度机制用于确定在涉及多态性时实际运行的具体代码版本。两种主要的调度形式是静态调度和动态调度。Rust通过使用[trait对象][type.trait-object]来支持动态调度。

### Dyn兼容特质 [特质]可以在[trait对象类型](dyn trait)中使用。只有遵循特定[规则][dyn兼容性]的特质才是*dyn兼容*的。

这些以前被称为*对象安全*特质。

这些以前被称为 *对象安全* 特征。

### 动态大小类型 动态大小类型（DST）是一种没有静态已知大小或对齐方式的类型。

[*实体*]是语言构造，可以在源程序中以某种方式引用，通常通过[路径][paths]。实体包括[类型][modules][泛型参数][alignment][循环标签][turbofish test][字段][undefined-behavior]和[注释]。

### Entity

表达式是由值、常量、变量、运算符和函数组合而成的，能够评估为单一值，可能带有或没有副作用。

### Expression

表达式是由值、常量、变量、运算符和函数组合而成的结构，其计算结果为一个单一的值，可能伴随或不存在副作用。

例如，`2 + (3 * 4)`是一个返回值为14的表达式。

### 自由项 不是[实现]成员的[项]，如*自由函数*或*自由常量*。与[关联项]相对。

*自由项*是指不属于任何[实现]的[项]。

### 基本特质 基本特质是指为现有类型添加其impl会导致破坏性的变更。`Fn`特质和`Sized`是基本特质。

一个基本特性是指为其现有类型添加实现会导致破坏性的变更。`Fn` 特性和 `Sized` 是基本的特性。

### 基本类型构造器

基本类型构造器是指对其实施[包罗万象的实现](#blanket-implementation)会导致破坏性变更的类型。`&`、`&mut`、`Box`和`Pin`属于基本类型。

当类型 `T`被视为[局部类型](#local-type)时，`&T`、`&mut T`、`Box<T>`和`Pin<T>`也被视为局部类型。基本类型构造器无法[覆盖](#uncovered-type)其他类型。每当使用“被覆盖类型”这一术语时，`&T`、`&mut T`、`Box<T>`和`Pin<T>`中的 `T`不被视为被覆盖。

### Inhabited

如果一个类型有构造函数因此可以实例化，则该类型是存在的。存在的类型不是“空的”，因为该类型可以有值。与[非存在](#uninhabited)相反。

### 固有实现

适用于名义类型而非特质类型对的[实现]。[更多][固有实现]。

### 固有方法

在[固有实现]中定义的[方法]，而不是在特质实现中定义的。

### Initialized

如果一个变量被赋值并且未被移动，则它被初始化。所有其他内存位置假设为未初始化状态。只有不安全的 Rust才能创建未初始化的内存位置。

### 局部特质

在当前crate中定义的`trait`。特质定义是局部的，与应用的类型参数无关。给定`trait Foo<T, U)`，无论`T`和`U`被替换为何种类型，`Foo`始终是局部的。

### 局部类型

在当前crate中定义的`struct`、`enum`或`union`。这不受应用类型参数的影响。`struct Foo`被视为局部类型，但`Vec<Foo>`不是。`LocalType<ForeignType>`是局部类型。类型别名不影响局部性。

### Module

模块是零个或多个[项]的容器。模块以树形结构组织，从名为crate根或根模块的未命名模块开始。[路径]可用于引用其他模块中的项，这些项可能受[可见性规则]限制。[更多][模块]

<a id="glossary.n-zst"></a>
#### N-aligned零大小类型 (n-ZST)

*n-ZST* 指的是一种零大小的类型（[ZST]），其[对齐方式]为 *n*。例如，*1-ZST* 是一种零大小且对齐方式为 1 的类型。

1-ZST 的例子包括：

- [单位类型](see [layout.tuple.unit])。 - [never类型](see [type.never.layout])。 - 没有字段或所有字段均为 1-ZST 的 `repr(C)` [结构体](see [layout.repr.c.结构体.align] 和 [layout.repr.c.结构体.size-field-offset])。 - 没有字段或所有字段均为 1-ZST 的 `repr(transparent)` [结构体](see [layout.repr.transparent.layout-abi])。 - 1-ZST 的[数组](see [layout.array])。 - 对于任何类型 `T` 的 [`PhantomData<T>`](see [lang-types.phantom-data])。 - 本身为 1-ZST 的类型 `T` 的 [`MaybeUninit<T>`](see [lang-types.maybe-uninit.layout])。

```rust
# use core::marker::PhantomData;
# use core::mem::{MaybeUninit, align_of, size_of};
#[repr(C)]
struct C1 {}
#[repr(C)]
struct C2 {
    f1: (),
    f2: [(); 10],
    f3: C1,
}
#[repr(transparent)]
struct T1 {}
#[repr(transparent)]
struct T2 {
    f1: (),
    f2: [(); 10],
}

fn is_1_zst<T>() -> bool {
    size_of::<T>() == 0 && align_of::<T>() == 1
}

assert!(is_1_zst::<()>());
assert!(is_1_zst::<!>());
assert!(is_1_zst::<C1>());
assert!(is_1_zst::<C2>());
assert!(is_1_zst::<[(); 10]>());
assert!(is_1_zst::<T1>());
assert!(is_1_zst::<T2>());
assert!(is_1_zst::<PhantomData<()>>());
assert!(is_1_zst::<PhantomData<u16>>());
assert!(is_1_zst::<MaybeUninit<[(); 2]>>());
```

### Name

[*名称*] 是引用[实体](#entity)的[标识符]或[生命周期标签]或[循环标签]。*名称绑定*是指实体声明引入与该实体相关的标识符或标签。[路径}、标识符和标签用于引用实体。

### 名称解析

[*名称解析*]是将[路径}、[标识符]和[标签]与[实体](#entity)声明关联的编译时过程。

### Namespace

[*命名空间*]是基于所引用[实体](#entity)类型的一种逻辑分组。命名空间使得一个命名空间中的名称不会与另一个命名空间中的相同名称产生冲突。

在命名空间中，名称按层次结构组织，每个层级都有自己的一组命名实体。

### 名义类型

可以通过路径直接引用的类型。具体来说包括[枚举]、[结构体]、[联合]和[特质对象类型]。

### Path

[*路径*]是一系列一个或多个路径段，用于引用当前作用域或[命名空间](#namespace)层次结构中的其他级别的[实体](#entity)。

### Prelude

Prelude，即Rust Prelude，是一个包含多项内容的小集合——主要是特质——这些特质被导入到每个crate的每个模块中。Prelude中的特质具有普遍性。

### Scope

[*scope*] 是指源文本中可以引用该名称的 [实体](#entity) 的区域。

### Scrutinee

`scrutinee` 是在 `match` 表达式和类似的模式匹配构造中被匹配的表达式。例如，在 `match x { A => 1, B => 2 }` 中，表达式 `x` 就是 `scrutinee`。

### Size

值的大小有两种定义。

第一种是存储该值所需分配的内存量。

第二种是指具有该项类型的数组中相邻元素之间的字节偏移量。

它是对齐值的倍数，包括零。大小可能会根据编译器版本（随着新优化功能的出现）和目标平台（类似于 `usize` 在不同平台上的差异）发生变化。

[更多][alignment]。

### Slice

切片是连续序列的动态大小视图，表示为 `[T]`。

它通常出现在可借用形式中，包括可变或可共享的形式。共享的切片类型为 `&[T]`，而可变切片类型为 `&mut [T]`，其中 `T` 表示元素类型。

### Statement

语句是编程语言中最小的独立元素，用于指示计算机执行某种操作。

### 字符串字面量

字符串字面量是直接存储在最终二进制文件中的字符串，因此适用于 `'static` 持续时间。

其类型为 `'static` 持续时间的可借用字符串切片，`&'static str`。

### 字符串切片

字符串切片是 Rust 中最基本的字符串类型，表示为 `str`。它通常出现在可借用形式中，包括可变或可共享的形式。共享的字符串切片类型为 `&str`，而可变字符串切片类型为 `&mut str`。

字符串切片始终为有效的 UTF-8 格式。

### Trait

特质是一种语言元素，用于描述类型必须提供的功能。它允许类型对其行为做出特定承诺。

泛型函数和泛型结构体可以使用特质来限制或限定其接受的类型。

### Turbofish

在表达式中包含泛型参数的路径，必须在开括号前加上 `::` 前缀。与泛型相关的角括号结合使用后，看起来就像一条鱼 `::<>`。因此，这种语法被通俗地称为 turbofish 语法。

Examples:

```rust
let ok_num = Ok::<_, ()>(5);
let vec = [1, 2, 3].iter().map(|n| n * 2).collect::<Vec<_>>();
```

必须使用 `::` 前缀，以便区分在逗号分隔列表中包含多个比较的泛型路径。参见 [turbofish 的堡垒][turbofish test]，了解没有该前缀会导致歧义的示例。

### 未覆盖类型

未覆盖类型是指不作为另一个类型的参数出现的类型。例如，`T` 是未覆盖的，但 `Vec<T>` 中的 `T` 是被覆盖的。这仅与类型参数相关。

### 未定义行为

未明确规定的编译时或运行时行为。这可能导致但不限于：进程终止或损坏；不正确或不预期的计算结果；或特定平台的结果。[更多][未定义行为]。

<a id="glossary.uninhabited"></a>
### 未覆盖

如果一个类型没有构造函数，因此永远无法实例化，则称为未覆盖类型。未覆盖类型的“空”是指该类型没有值。未覆盖类型的典型例子是 [never type]（`!`），或没有变体的枚举（例如 `enum Never { }`）。与 [已覆盖](#inhabited) 相反。

> [!NOTE] > 未覆盖类型不一定是零大小类型。例如，`enum Never { }` 是未覆盖的且零大小，但 `(u8, Never)` 也是未覆盖的但不为零大小。

<a id="glossary.zst"></a>
### 零大小类型 (ZST)

如果某个类型的大小为 0，则称为零大小类型（ZST）。此类类型最多只有一个可能的值。示例包括：

- [单元类型]（参见 [layout.tuple.unit]）。 - [永远类型]（参见 [type.never.layout]）。 - [函数项]([type.fn-item.intro])。 - [类似元组的结构体]的构造函数（参见 [type.fn-item.intro]）。 - [类似元组的枚举变体的构造函数]([type.fn-item.intro])。 - 没有字段或所有字段均为零大小且使用 `repr(Rust)` 的[结构体]([layout.repr.rust.结构体-zst])。 - 没有字段或所有字段均为零大小且使用 `repr(C)` 的[结构体]([layout.repr.c.structure.size-field-offset]).。 - 没有字段或所有字段均为零大小且使用 `repr(transparent)` 的[结构体]([layout.repr.transparent.layout-abi]).。 - [枚举]（未指定[基本表示法]）且没有变体，使用 `repr(Rust)`（参见 [layout.repr.rust.枚举-empty-zst]）。 - [枚举]（未指定[基本表示法]）具有单个[字段类似结构体变体}、单个[单元类似结构体变体]或单个[元组类似结构体变体]，且该结构体没有字段或所有字段均为零大小，使用 `repr(Rust)`（参见 [layout.repr.rust.枚举-结构体-like-zst]）。 - 零大小类型的[数组]([layout.array]).。 - 长度为零的[数组]([layout.array]).。 - 零大小类型的[联合类型]([items.union.common-storage]).。 - [`PhantomData<T>`]用于任何类型 `T`（参见 [lang-types.phantom-data]）。 - [`MaybeUninit<T>`]用于本身为零大小类型的类型 `T`（参见 [lang-types.maybe-uninit.layout]).。

```rust
# use core::marker::PhantomData;
# use core::mem::{MaybeUninit, size_of, size_of_val};
fn f() {}
struct S(u8);
enum E { V(u8) }
struct UnitLike;
struct NoFields {}
struct OnlyZST {
    f1: (),
    f2: [(); 10],
    f3: [u8; 0],
}
#[repr(C)]
struct C1 {}
#[repr(C)]
struct C2 {
    f1: (),
    f2: [(); 10],
    f3: [u8; 0],
    f4: C1,
}
#[repr(transparent)]
struct T1 {}
#[repr(transparent)]
struct T2 {
    f1: (),
    f2: [(); 10],
    f3: [u8; 0],
}
union U {
    f1: (),
    f2: [(); 10],
    f3: [u8; 0],
}
# /// An enum with a single field-struct-like variant with all fields
# /// being ZSTs.
enum E2 {
    V1 { f1: (), f2: [(); 10] },
}
# /// An enum with a single field-struct-like variant with no fields.
enum E3 {
    V1 {},
}
# /// An enum with a single unit-struct-like variant.
enum E4 {
    V1,
}
# /// An enum with a single tuple-struct-like variant with all fields
# /// being ZSTs.
enum E5 {
    V1 ((), [(); 10]),
}
# /// An enum with a single tuple-struct-like variant with no fields.
enum E6 {
    V1 (),
}
# /// An enum with no variants.
enum E7 {}

assert_eq!(0, size_of::<()>());
assert_eq!(0, size_of::<!>());
assert_eq!(0, size_of_val(&f));
assert_eq!(0, size_of_val(&S));
assert_eq!(0, size_of_val(&E::V));
assert_eq!(0, size_of::<UnitLike>());
assert_eq!(0, size_of::<NoFields>());
assert_eq!(0, size_of::<OnlyZST>());
assert_eq!(0, size_of::<C1>());
assert_eq!(0, size_of::<C2>());
assert_eq!(0, size_of::<T1>());
assert_eq!(0, size_of::<T2>());
assert_eq!(0, size_of::<[(); 10]>());
assert_eq!(0, size_of::<[u8; 0]>());
assert_eq!(0, size_of::<U>());
assert_eq!(0, size_of::<E2>());
assert_eq!(0, size_of::<E3>());
assert_eq!(0, size_of::<E4>());
assert_eq!(0, size_of::<E5>());
assert_eq!(0, size_of::<E6>());
assert_eq!(0, size_of::<E7>());
# // `PhantomData` for a ZST.
assert_eq!(0, size_of::<PhantomData<()>>());
# // `PhantomData` for a type that is not a ZST.
assert_eq!(0, size_of::<PhantomData<u16>>());
assert_eq!(0, size_of::<MaybeUninit<[(); 2]>>());
```

[`extern` blocks]: items.extern
[`extern fn`]: items.fn.extern
[`MaybeUninit<T>`]: lang-types.maybe-uninit
[`PhantomData<T>`]: lang-types.phantom-data
[arrays]: type.array
[field-struct-like variant]: EnumVariantStruct
[function items]: type.fn-item
[primitive representation]: layout.repr.primitive
[tuple-like enum variants]: items.enum.constructor-namespace
[tuple-like structs]: items.struct.tuple
[tuple-struct-like variant]: EnumVariantTuple
[unit type]: type.tuple.unit
[unit-struct-like variant]: EnumVariant
[zero sized]: glossary.zst
[ZST]: glossary.zst

[alignment]: type-layout.md#size-and-alignment
[associated item]: #associated-item
[attributes]: attributes.md
[*entity*]: names.md
[crate]: crates-and-source-files.md
[dyn compatibility]: items/traits.md#dyn-compatibility
[enums]: items/enumerations.md
[fields]: expressions/field-expr.md
[free item]: #free-item
[generic parameters]: items/generics.md
[identifier]: identifiers.md
[identifiers]: identifiers.md
[implementation]: items/implementations.md
[implementations]: items/implementations.md
[inherent implementation]: items/implementations.md#inherent-implementations
[item]: items.md
[items]: items.md
[labels]: tokens.md#lifetimes-and-loop-labels
[lifetime or loop label]: tokens.md#lifetimes-and-loop-labels
[lifetimes]: tokens.md#lifetimes-and-loop-labels
[lints]: attributes/diagnostics.md#lint-check-attributes
[loop labels]: tokens.md#lifetimes-and-loop-labels
[method]: items/associated-items.md#methods
[modules]: items/modules.md
[*Name resolution*]: names/name-resolution.md
[*name*]: names.md
[*namespace*]: names/namespaces.md
[never type]: types/never.md
[*path*]: paths.md
[Paths]: paths.md
[*scope*]: names/scopes.md
[structs]: items/structs.md
[trait object types]: types/trait-object.md
[traits]: items/traits.md
[turbofish test]: https://github.com/rust-lang/rust/blob/1.58.0/src/test/ui/parser/bastion-of-the-turbofish.rs
[types of crates]: linkage.md
[types]: types.md
[undefined-behavior]: behavior-considered-undefined.md
[unions]: items/unions.md
[variable bindings]: patterns.md
[visibility rules]: visibility-and-privacy.md
