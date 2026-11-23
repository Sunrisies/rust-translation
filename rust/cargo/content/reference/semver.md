# SemVer 兼容性

本章详细介绍了在软件包新版本中被视为兼容或破坏性的 SemVer 变更的标准。有关 SemVer 的详细信息以及 Cargo 如何利用它来确保库之间的兼容性，请参阅 [SemVer 兼容性] 部分。

这些仅为*指南*，并非所有项目都必须严格遵循的固定规则。[变更类别] 部分详细说明了本指南对变更级别和严重程度的分类方式。本指南主要关注那些会导致 `cargo` 和 `rustc` 无法构建之前正常工作的项目的变更。几乎每个变更都存在一定风险，可能会对运行时行为产生负面影响，对于此类情况，项目维护者通常需要根据判断来决定是否属于 SemVer 不兼容的变更。


## 变更类别

以下列出的所有策略都按变更级别进行分类：

* **重大变更**：需要 major SemVer 版本更新的变更。
* **小变更**：只需要 minor SemVer 版本更新的变更。
* **可能破坏性的变更**：某些项目可能视为重大变更，而另一些项目则视为小变更的变更。

“可能破坏性”类别涵盖那些在更新过程中具有*潜在*破坏性的变更，但不一定会导致实际破坏。应仔细考虑这些变更的影响。具体性质取决于变更本身以及项目维护者的原则。

某些项目可能会仅对小变更增加补丁号。建议遵循 SemVer 规范，仅在补丁版本中应用错误修复。然而，错误修复可能需要进行标记为“小变更”的 API 更改，且不应影响兼容性。本指南不对每个单独的“小变更”应如何处理持立场，因为小变更与补丁变更之间的区别取决于变更的性质。

某些更改被标记为“次要”，尽管它们可能带来破坏构建的风险。这种情况适用于潜在风险极低，且可能破坏构建的代码不太可能是用惯用的 Rust 方式编写，或者明确不推荐使用的情形。

本指南使用“主要”和“次要”这两个术语，假设这指的是“1.0.0”版本或更高版本。以“0.y.z”开头的初始开发版本可以将“y”中的更改视为主要版本更新，而“z”中的更改视为次要版本更新。“0.0.z”版本则始终属于重大变更。这是因为 Cargo 采用的一种约定是，只有最左侧的非零组件发生变更才被视为不兼容。

* API 兼容性 * 项目 * [重大：重命名、移动或删除任何公共项目](#item-remove) * [次要：添加新公共项目](#item-new) * 类型 * [重大：更改已定义类型的对齐方式、布局或大小](#type-layout) * 结构体 * [重大：在所有当前字段为公共时添加私有结构体字段](#结构体-add-private-field-when-public) * [重大：当不存在私有字段时添加公共字段](#结构体-add-public-field-when-no-private) * [次要：至少存在一个私有字段时添加或删除私有字段](#结构体-private-fields-with-private) * [次要：从具有所有私有字段的元组结构体（至少有一个字段）转换为普通结构体，或相反](#结构体-tuple-normal-with-private) * 枚举 * [重大：添加新枚举变体（不使用 `non_exhaustive`）](#枚举-variant-new) * [重大：向枚举变体添加新字段](#枚举-fields-new) * 特质 * [重大：添加非默认特质的项目](#trait-new-item-no-default) * [重大：对特质项目签名的任何更改](#trait-item-signature) * [可能破坏：添加默认特质的项目](#trait-new-default-item) * [重大：添加使特质不再安全的对象类型的特质](#trait-object-safety) * [重大：添加无默认的类型参数](#trait-new-parameter-no-default) * [次要：添加默认类型的类型参数](#trait-new-parameter-default) * 实现 * [可能破坏的更改：添加任何固有项目](#实现-item-new) * 泛型 * [重大：收紧泛型约束](#泛型-bounds-tighten) * [次要：放宽泛型约束](#泛型-bounds-loosen) * [次要：添加默认类型参数](#泛型-new-default) * [次要：将类型泛化为使用泛型（具有相同类型）](#泛型-generalize-identical) * [重大：将类型泛化为使用泛型（可能具有不同类型）](#泛型-generalize-different) * [次要：将泛型类型更改为更通用的类型](#泛型-more-泛型) * [重大：在 RPIT 中捕获更通用的参数](#泛型-rpit-capture) * 函数 * [重大：添加/删除函数参数](#fn-change-arity) * [可能破坏：引入新的函数类型参数](#fn-泛型-new) * [次要：将函数泛化为使用泛型（支持原始类型）](#fn-generalize-compatible) * [重大：将函数泛化为使用具有类型不匹配的泛型](#fn-generalize-mismatch) * [次要：使 `unsafe` 函数安全](#fn-不安全-safe) * 属性 * [重大：从 `no_std` 支持切换为要求 `std`](#attr-no-std-to-std) * [重大：在不存在私有字段的现有枚举、变体或结构体中添加 `non_exhaustive`](#attr-adding-non-exhaustive) * 工具和环境兼容性 * [可能破坏：更改所需的 Rust 最低版本](#env-new-rust) * [可能破坏：更改平台和环境要求](#env-change-requirements) * [次要：引入新检查器](#new-lints) * Cargo * [次要：添加新 Cargo 特性](#cargo-特性-add) * [重大：移除 Cargo 特性](#cargo-特性-remove) * [重大：如果移除特性会改变功能或公共项目，则从特性列表中移除该特性](#cargo-特性-remove-another) * [可能破坏：移除可选依赖项](#cargo-remove-opt-dep) * [次要：更改依赖特性](#cargo-change-dep-特性) * [次要：添加依赖项](#cargo-dep-add) * [应用程序兼容性](#application-compatibility)

## API 兼容性

以下所有示例均包含三个部分：原始代码、修改后的代码，以及可能出现在其他项目中的使用示例。在轻微修改情况下，使用示例应能够同时编译前版本和修改后的版本。

### 重大变更：重命名/移动/删除任何公共项 {#item-remove}

如果未公开暴露的[项]不存在，则使用该项的任何代码将无法编译。

```rust,ignore
// MAJOR CHANGE

///////////////////////////////////////////////////////////
// Before
pub fn foo() {}

///////////////////////////////////////////////////////////
// After
// ... item has been removed

///////////////////////////////////////////////////////////
// Example usage that will break.
fn main() {
    updated_crate::foo(); // Error: cannot find function `foo`
}
```

这包括添加任何类型的 [`cfg` 属性]，这些属性可以根据[条件编译]改变哪些项或行为可用。

缓解策略：* 将要删除的项标记为[已弃用]，然后在 SemVer 版本升级时移除它们。* 将重命名的项标记为[已弃用]，并使用 [`pub use`] 项重新导出到旧名称。

### 轻微变更：添加新的公共项 {#item-new}

添加新的、公开的[项]属于轻微变更。

```rust,ignore
// MINOR CHANGE

///////////////////////////////////////////////////////////
// Before
// ... absence of item

///////////////////////////////////////////////////////////
// After
pub fn foo() {}

///////////////////////////////////////////////////////////
// Example use of the library that will safely work.
// `foo` is not used since it didn't previously exist.
```

请注意，在极少数情况下，由于全局导入（glob imports）的原因，这可能会成为**破坏性变更**。例如，如果您添加了新特质，而某个项目使用了将该特质引入作用域的全局导入，且新特质引入了与其所实现的类型冲突的相关项，则可能因歧义导致编译时错误。示例：

```rust,ignore
// Breaking change example

///////////////////////////////////////////////////////////
// Before
// ... absence of trait

///////////////////////////////////////////////////////////
// After
pub trait NewTrait {
    fn foo(&self) {}
}

impl NewTrait for i32 {}

///////////////////////////////////////////////////////////
// Example usage that will break.
use updated_crate::*;

pub trait LocalTrait {
    fn foo(&self) {}
}

impl LocalTrait for i32 {}

fn main() {
    123i32.foo(); // Error:  multiple applicable items in scope
}
```

这并不被视为重大变更，因为通常全局导入是已知的向前兼容性风险。应避免从外部 crates 中导入项。

### 重大变更：更改已定义类型的对齐方式、布局或大小 {#type-layout}

更改之前已定义的类型的对齐方式、布局或大小属于破坏性变更。

一般来说，使用[默认表示形式]的类型没有明确的对齐方式、布局或大小。编译器可以自由改变对齐方式、布局或大小，因此代码不应对此做出任何假设。

> [!NOTE]
> 如果外部库对类型的对齐、布局或大小做出假设，即使这些定义并不明确，也可能会导致其崩溃。由于不应做出此类假设，因此这不被视为 SemVer 的破坏性变更。

一些不构成破坏性的变更示例（假设本指南中的其他规则未被违反）：

* 对默认表示结构、联合或枚举添加、删除、重新排序或更改字段，且这些更改符合本指南的其他规则（例如使用 `non_exhaustive` 来允许此类更改，或对已经是私有的私有字段进行更改）。参见 [结构体-add-private-field-when-public](#结构体-add-private-field-when-public)、[结构体-add-public-field-when-no-private](#结构体-add-public-field-when-no-private)、[结构体-private-fields-with-private](#结构体-private-fields-with-private)、[枚举-fields-new](#枚举-fields-new)。
* 向默认表示枚举添加变体，如果该枚举使用 `non_exhaustive`。这可能会改变枚举的对齐或大小，但这些定义并不明确。参见 [枚举-variant-new](#枚举-variant-new)。
* 对 `repr(C)` 结构、联合或枚举的私有字段进行添加、删除、重新排序或更改，且符合本指南的其他规则（例如使用 `non_exhaustive`，或在其他私有字段已存在时添加私有字段）。参见 [repr-c-private-change](#repr-c-private-change)。
* 向 `repr(C)` 枚举添加变体，如果该枚举使用 `non_exhaustive`。参见 [repr-c-枚举-variant-new](#repr-c-枚举-variant-new)。
* 向默认表示结构、联合或枚举添加 `repr(C)`。参见 [repr-c-add](#repr-c-add)。
* 向枚举添加 `repr(<int>)` [基本表示]。参见 [repr-int-枚举-add](#repr-int-枚举-add)。
* 向默认表示结构或枚举添加 `repr(transparent)`。参见 [repr-transparent-add](#repr-transparent-add)。

使用 [`repr` 属性] 的类型可以被认为具有某种定义的对齐和布局，代码可能会基于这些定义做出一些假设，而更改该类型可能会导致破坏。

在某些情况下，具有 `repr` 属性的类型可能没有明确定义的对齐、布局或大小。在这种情况下，对类型进行修改可能是安全的，但需谨慎操作。例如，那些包含私有字段且未明确说明其对齐、布局或大小保证的类型，外部库无法依赖，因为公共 API 并未完全定义该类型的对齐、布局或大小。

一个常见的例子是带有 *私有* 字段的类型，该类型包含一个具有泛型类型的单个私有字段，并使用了 `repr(transparent)`。文档说明该对泛型类型是透明的。例如，请参考 [`UnsafeCell`]。

一些破坏性的变更示例包括：

* 在结构体或联合体中添加 `repr(packed)`。请参阅 [repr-packed-add](#repr-packed-add)。
* 在结构体、联合体或枚举中添加 `repr(align)`。请参阅 [repr-align-add](#repr-align-add)。
* 从结构体或联合体中移除 `repr(packed)`。请参阅 [repr-packed-remove](#repr-packed-remove)。
* 如果改变 `repr(packed(N))` 中的值 N，则会改变对齐或布局。请参阅 [repr-packed-n-change](#repr-packed-n-change)。
* 如果改变 `repr(align(N))` 中的值 N，则会改变对齐。请参阅 [repr-align-n-change](#repr-align-n-change)。
* 从结构体、联合体或枚举中移除 `repr(align)`。请参阅 [repr-align-remove](#repr-align-remove)。
* 更改 `repr(C)` 类型中公共字段的顺序。请参阅 [repr-c-shuffle](#repr-c-shuffle)。
* 从结构体、联合体或枚举中移除 `repr(C)`。请参阅 [repr-c-remove](#repr-c-remove)。
* 从枚举中移除 `repr(<int>)`。请参阅 [repr-int-枚举-remove](#repr-int-枚举-remove)。
* 更改 `repr(<int>)` 枚举的原始表示形式。请参阅 [repr-int-枚举-change](#repr-int-枚举-change)。
* 从结构体或枚举中移除 `repr(transparent)`。请参阅 [repr-transparent-remove](#repr-transparent-remove)。


#### 小问题: `repr(C)` 添加、移除或更改私有字段 {#repr-c-private-change}

通常，如果符合本指南中的其他准则，向 `repr(C)` 结构体、联合类型或枚举添加、移除或更改私有字段是安全的（参见 [结构体-add-private-field-when-public](#结构体-add-private-field-when-public)、[结构体-add-public-field-when-no-private](#结构体-add-public-field-when-no-private)、[结构体-private-fields-with-private](#结构体-private-fields-with-private)、[枚举-fields-new](#枚举-fields-new)）。

例如，只有存在其他私有字段时才能添加私有字段，或者该操作是 `non_exhaustive`。如果存在私有字段，公共字段也可以被添加，且同样属于 `non_exhaustive`，并且这种添加不会改变其他字段的布局。

然而，这可能会改变类型的大小和对齐方式。如果大小或对齐方式发生变化，应格外注意。除非有文档记录的大小或对齐方式，否则代码不应对具有私有字段或 `non_exhaustive` 的类型的尺寸或对齐方式进行假设。

```rust,ignore
// MINOR CHANGE

///////////////////////////////////////////////////////////
// Before
#[derive(Default)]
#[repr(C)]
pub struct Example {
    pub f1: i32,
    f2: i32, // a private field
}

///////////////////////////////////////////////////////////
// After
#[derive(Default)]
#[repr(C)]
pub struct Example {
    pub f1: i32,
    f2: i32,
    f3: i32, // a new field
}

///////////////////////////////////////////////////////////
// Example use of the library that will safely work.
fn main() {
    // NOTE: Users should not make assumptions about the size or alignment
    // since they are not documented.
    let f = updated_crate::Example::default();
}
```

#### 小问题: `repr(C)` 添加枚举变体 {#repr-c-枚举-variant-new}

通常，如果 `repr(C)` 枚举使用 `non_exhaustive`，向该枚举添加变体是安全的。有关更多讨论，请参见 [枚举-variant-new](#枚举-variant-new)。

请注意，这可能会带来破坏性变更，因为它会改变类型的大小和对齐方式。有关类似问题，请参阅 [repr-c-private-change](#repr-c-private-change)。

```rust,ignore
// MINOR CHANGE

///////////////////////////////////////////////////////////
// Before
#[repr(C)]
#[non_exhaustive]
pub enum Example {
    Variant1 { f1: i16 },
    Variant2 { f1: i32 },
}

///////////////////////////////////////////////////////////
// After
#[repr(C)]
#[non_exhaustive]
pub enum Example {
    Variant1 { f1: i16 },
    Variant2 { f1: i32 },
    Variant3 { f1: i64 }, // added
}

///////////////////////////////////////////////////////////
// Example use of the library that will safely work.
fn main() {
    // NOTE: Users should not make assumptions about the size or alignment
    // since they are not specified. For example, this raised the size from 8
    // to 16 bytes.
    let f = updated_crate::Example::Variant2 { f1: 123 };
}
```

#### 小问题: 向默认表示方式添加 `repr(C)` {#repr-c-add}

在具有[默认表示方式]的结构体、联合类型或枚举中添加 `repr(C)` 是安全的。这是安全的，因为用户不应对默认表示方式的类型的对齐、布局或大小做出假设。

```rust,ignore
// MINOR CHANGE

///////////////////////////////////////////////////////////
// Before
pub struct Example {
    pub f1: i32,
    pub f2: i16,
}

///////////////////////////////////////////////////////////
// After
#[repr(C)] // added
pub struct Example {
    pub f1: i32,
    pub f2: i16,
}

///////////////////////////////////////////////////////////
// Example use of the library that will safely work.
fn main() {
    let f = updated_crate::Example { f1: 123, f2: 456 };
}
```

#### 小问题：在枚举中添加 `repr(<int>)` {#repr-int-枚举-add}

将 `repr(<int>)` [基本表示] 添加到具有 [默认表示] 的枚举中是安全的。这是安全的，因为用户不应对枚举的对齐方式、布局或大小做出假设。

```rust,ignore
// MINOR CHANGE

///////////////////////////////////////////////////////////
// Before
pub enum E {
    Variant1,
    Variant2(i32),
    Variant3 { f1: f64 },
}

///////////////////////////////////////////////////////////
// After
#[repr(i32)] // added
pub enum E {
    Variant1,
    Variant2(i32),
    Variant3 { f1: f64 },
}

///////////////////////////////////////////////////////////
// Example use of the library that will safely work.
fn main() {
    let x = updated_crate::E::Variant3 { f1: 1.23 };
}
```

#### 小问题：在默认表示的结构或枚举中添加 `repr(transparent)` {#repr-transparent-add}

将 `repr(transparent)` 添加到具有 [默认表示] 的结构或枚举中是安全的。这是安全的，因为用户不应对结构或枚举的对齐方式、布局或大小做出假设。

```rust,ignore
// MINOR CHANGE

///////////////////////////////////////////////////////////
// Before
#[derive(Default)]
pub struct Example<T>(T);

///////////////////////////////////////////////////////////
// After
#[derive(Default)]
#[repr(transparent)] // added
pub struct Example<T>(T);

///////////////////////////////////////////////////////////
// Example use of the library that will safely work.
fn main() {
    let x = updated_crate::Example::<i32>::default();
}
```

#### 重大问题：在结构或联合中添加 `repr(packed)` {#repr-packed-add}

在结构或联合中添加 `repr(packed)` 是一个破坏性变更。将类型设为 `repr(packed)` 会导致破坏代码的更改，例如无法引用字段，或导致不连续的闭包捕获被截断。

<!-- TODO: If all fields are private, should this be safe to do? -->

```rust,ignore
// MAJOR CHANGE

///////////////////////////////////////////////////////////
// Before
pub struct Example {
    pub f1: u8,
    pub f2: u16,
}

///////////////////////////////////////////////////////////
// After
#[repr(packed)] // added
pub struct Example {
    pub f1: u8,
    pub f2: u16,
}

///////////////////////////////////////////////////////////
// Example usage that will break.
fn main() {
    let f = updated_crate::Example { f1: 1, f2: 2 };
    let x = &f.f2; // Error: error[E0793]: reference to field of packed struct is unaligned
}
```

```rust,ignore
// MAJOR CHANGE

///////////////////////////////////////////////////////////
// Before
pub struct Example(pub i32, pub i32);

///////////////////////////////////////////////////////////
// After
#[repr(packed)]
pub struct Example(pub i32, pub i32);

///////////////////////////////////////////////////////////
// Example usage that will break.
fn main() {
    let mut f = updated_crate::Example(123, 456);
    let c = || {
        // Without repr(packed), the closure precisely captures `&f.0`.
        // With repr(packed), the closure captures `&f` to avoid undefined behavior.
        let a = f.0;
    };
    f.1 = 789; // Error: cannot assign to `f.1` because it is borrowed
    c();
}
```

#### 重大问题：在结构、联合或枚举中添加 `repr(align)` {#repr-align-add}

在结构、联合或枚举中添加 `repr(align)` 是一个破坏性变更。将类型的对齐级别提高到 `N` 以上，而该类型包含 `repr(packed(N))`，会导致对该字段的引用不对齐，这是不允许的。

<!-- TODO: This seems like it should be extraordinarily rare. Should there be any exceptions carved out for this? -->

```rust,ignore
// MAJOR CHANGE

///////////////////////////////////////////////////////////
// Before
pub struct Aligned {
    pub a: i32,
}

///////////////////////////////////////////////////////////
// After
#[repr(align(8))] // added
pub struct Aligned {
    pub a: i32,
}

///////////////////////////////////////////////////////////
// Example usage that will break.
use updated_crate::Aligned;

#[repr(packed(4))]
pub struct Packed {
    f1: Aligned,
}

fn main() {
    let p = Packed {
        f1: Aligned { a: 123 },
    };
    let f1 = &p.f1; // Error: reference to field of packed struct is unaligned
}
```

#### 重大问题：从结构或联合中移除 `repr(packed)` {#repr-packed-remove}

从结构或联合中移除 `repr(packed)` 是一个破坏性变更。这可能会改变外部依赖库所依赖的对齐或布局。

如果任何字段是公开的，那么移除 `repr(packed)` 可能会改变不连续闭包捕获的工作方式。在某些情况下，这可能导致代码崩溃，类似于 [版本指南][edition-closures] 中描述的那样。


```rust,ignore
// MAJOR CHANGE

///////////////////////////////////////////////////////////
// Before
#[repr(C, packed)]
pub struct Packed {
    pub a: u8,
    pub b: u16,
}

///////////////////////////////////////////////////////////
// After
#[repr(C)] // removed packed
pub struct Packed {
    pub a: u8,
    pub b: u16,
}

///////////////////////////////////////////////////////////
// Example usage that will break.
use updated_crate::Packed;

fn main() {
    let p = Packed { a: 1, b: 2 };
    // Some assumption about the size of the type.
    // Without `packed`, this fails since the size is 4.
    const _: () = assert!(std::mem::size_of::<Packed>() == 3); // Error: assertion failed
}
```

```rust,ignore
// MAJOR CHANGE

///////////////////////////////////////////////////////////
// Before
#[repr(C, packed)]
pub struct Packed {
    pub a: *mut i32,
    pub b: i32,
}
unsafe impl Send for Packed {}

///////////////////////////////////////////////////////////
// After
#[repr(C)] // removed packed
pub struct Packed {
    pub a: *mut i32,
    pub b: i32,
}
unsafe impl Send for Packed {}

///////////////////////////////////////////////////////////
// Example usage that will break.
use updated_crate::Packed;

fn main() {
    let mut x = 123;

    let p = Packed {
        a: &mut x as *mut i32,
        b: 456,
    };

    // When the structure was packed, the closure captures `p` which is Send.
    // When `packed` is removed, this ends up capturing `p.a` which is not Send.
    std::thread::spawn(move || unsafe {
        *(p.a) += 1; // Error: cannot be sent between threads safely
    });
}
```

#### 重大问题：如果 `repr(packed(N))` 中的 N 值发生变化，则改变该值以影响对齐或布局 {#repr-pack-p-n-change}

如果 `repr(packed(N))` 中的 N 值发生变化，从而改变对齐或布局，这是一个破坏性变更。这可能会改变外部依赖库所依赖的对齐或布局。

如果值 `N` 低于公共字段的对齐值，那么会破坏任何尝试引用该字段的代码。

请注意，对 `N` 的一些修改可能不会改变对齐或布局，例如当当前值已经等于类型的自然对齐值时增加 `N`。

```rust,ignore
// MAJOR CHANGE

///////////////////////////////////////////////////////////
// Before
#[repr(packed(4))]
pub struct Packed {
    pub a: u8,
    pub b: u32,
}

///////////////////////////////////////////////////////////
// After
#[repr(packed(2))] // changed to 2
pub struct Packed {
    pub a: u8,
    pub b: u32,
}

///////////////////////////////////////////////////////////
// Example usage that will break.
use updated_crate::Packed;

fn main() {
    let p = Packed { a: 1, b: 2 };
    let x = &p.b; // Error: error[E0793]: reference to field of packed struct is unaligned
}
```

#### 重大变更：如果改变 `repr(align(N))` 中的值 N 会改变对齐，则进行更改 {#repr-align-n-change}

如果改变 `repr(align(N))` 中的值 `N` 会改变对齐，这是一个破坏性变更。这可能会改变外部库所依赖的对齐或布局。

如果类型在 [类型布局](#type-layout) 中讨论过且未得到良好定义（例如包含任何私有字段以及未记录的对齐或布局），则进行此更改应该是安全的。

请注意，对 `N` 的一些修改可能不会改变对齐或布局，例如当当前值已经等于或小于类型的自然对齐值时减少 `N`。

```rust,ignore
// MAJOR CHANGE

///////////////////////////////////////////////////////////
// Before
#[repr(align(8))]
pub struct Packed {
    pub a: u8,
    pub b: u32,
}

///////////////////////////////////////////////////////////
// After
#[repr(align(4))] // changed to 4
pub struct Packed {
    pub a: u8,
    pub b: u32,
}

///////////////////////////////////////////////////////////
// Example usage that will break.
use updated_crate::Packed;

fn main() {
    let p = Packed { a: 1, b: 2 };
    // Some assumption about the size of the type.
    // The alignment has changed from 8 to 4.
    const _: () = assert!(std::mem::align_of::<Packed>() == 8); // Error: assertion failed
}
```

#### 重大变更：从结构体、联合体或枚举中移除 `repr(align)` {#repr-align-remove}

如果结构体、联合体或枚举的布局是明确的，则从它们中移除 `repr(align)` 是一个破坏性变更。这可能会改变外部库所依赖的对齐或布局。

如果类型在 [类型布局](#type-layout) 中讨论过且未得到良好定义（例如包含任何私有字段以及未记录的对齐），则进行此更改应该是安全的。

```rust,ignore
// MAJOR CHANGE

///////////////////////////////////////////////////////////
// Before
#[repr(C, align(8))]
pub struct Packed {
    pub a: u8,
    pub b: u32,
}

///////////////////////////////////////////////////////////
// After
#[repr(C)] // removed align
pub struct Packed {
    pub a: u8,
    pub b: u32,
}

///////////////////////////////////////////////////////////
// Example usage that will break.
use updated_crate::Packed;

fn main() {
    let p = Packed { a: 1, b: 2 };
    // Some assumption about the size of the type.
    // The alignment has changed from 8 to 4.
    const _: () = assert!(std::mem::align_of::<Packed>() == 8); // Error: assertion failed
}
```

#### 重大变更：改变 `repr(C)` 类型的公共字段顺序 {#repr-c-shuffle}

如果改变 `repr(C)` 类型的公共字段顺序，这是一个破坏性变更。外部库可能依赖于这些字段的具体排序。

```rust,ignore,run-fail
// MAJOR CHANGE

///////////////////////////////////////////////////////////
// Before
#[repr(C)]
pub struct SpecificLayout {
    pub a: u8,
    pub b: u32,
}

///////////////////////////////////////////////////////////
// After
#[repr(C)]
pub struct SpecificLayout {
    pub b: u32, // changed order
    pub a: u8,
}

///////////////////////////////////////////////////////////
// Example usage that will break.
use updated_crate::SpecificLayout;

unsafe extern "C" {
    // This C function is assuming a specific layout defined in a C header.
    fn c_fn_get_b(x: &SpecificLayout) -> u32;
}

fn main() {
    let p = SpecificLayout { a: 1, b: 2 };
    unsafe { assert_eq!(c_fn_get_b(&p), 2) } // Error: value not equal to 2
}

# mod cdep {
#     // This simulates what would normally be something included from a build script.
#     // This definition would be in a C header.
#     #[repr(C)]
#     pub struct SpecificLayout {
#         pub a: u8,
#         pub b: u32,
#     }
#
#     #[no_mangle]
#     pub fn c_fn_get_b(x: &SpecificLayout) -> u32 {
#         x.b
#     }
# }
```

#### 重大变更：从结构体、联合体或枚举中移除 `repr(C)` {#repr-c-remove}

如果从结构体、联合体或枚举中移除 `repr(C)`，这是一个破坏性变更。外部库可能依赖该类型的特定布局。

```rust,ignore
// MAJOR CHANGE

///////////////////////////////////////////////////////////
// Before
#[repr(C)]
pub struct SpecificLayout {
    pub a: u8,
    pub b: u32,
}

///////////////////////////////////////////////////////////
// After
// removed repr(C)
pub struct SpecificLayout {
    pub a: u8,
    pub b: u32,
}

///////////////////////////////////////////////////////////
// Example usage that will break.
use updated_crate::SpecificLayout;

unsafe extern "C" {
    // This C function is assuming a specific layout defined in a C header.
    fn c_fn_get_b(x: &SpecificLayout) -> u32; // Error: is not FFI-safe
}

fn main() {
    let p = SpecificLayout { a: 1, b: 2 };
    unsafe { assert_eq!(c_fn_get_b(&p), 2) }
}

# mod cdep {
#     // This simulates what would normally be something included from a build script.
#     // This definition would be in a C header.
#     #[repr(C)]
#     pub struct SpecificLayout {
#         pub a: u8,
#         pub b: u32,
#     }
#
#     #[no_mangle]
#     pub fn c_fn_get_b(x: &SpecificLayout) -> u32 {
#         x.b
#     }
# }
```

#### 重大变更：从枚举中移除 `repr(<int>)` {#repr-int-枚举-remove}

从枚举中移除 `repr(<int>)` 是一个破坏性变更。外部库可能假设判别器具有特定的大小。例如，对枚举进行 [`std::mem::transmute`] 可能会失败。

```rust,ignore
// MAJOR CHANGE

///////////////////////////////////////////////////////////
// Before
#[repr(u16)]
pub enum Example {
    Variant1,
    Variant2,
    Variant3,
}

///////////////////////////////////////////////////////////
// After
// removed repr(u16)
pub enum Example {
    Variant1,
    Variant2,
    Variant3,
}

///////////////////////////////////////////////////////////
// Example usage that will break.

fn main() {
    let e = updated_crate::Example::Variant2;
    let i: u16 = unsafe { std::mem::transmute(e) }; // Error: cannot transmute between types of different sizes
}
```

#### 重大：更改 `repr(<int>)` 枚举的原始表示形式 {#repr-int-枚举-change}

从 `repr(<int>)` 枚举中改变其原始表示形式是一个破坏性变更。外部库可能假设判别器具有特定的大小。例如，对枚举进行 [`std::mem::transmute`] 可能会失败。

```rust,ignore
// MAJOR CHANGE

///////////////////////////////////////////////////////////
// Before
#[repr(u16)]
pub enum Example {
    Variant1,
    Variant2,
    Variant3,
}

///////////////////////////////////////////////////////////
// After
#[repr(u8)] // changed repr size
pub enum Example {
    Variant1,
    Variant2,
    Variant3,
}

///////////////////////////////////////////////////////////
// Example usage that will break.

fn main() {
    let e = updated_crate::Example::Variant2;
    let i: u16 = unsafe { std::mem::transmute(e) }; // Error: cannot transmute between types of different sizes
}
```

#### 重大：从结构或枚举中移除 `repr(transparent)` {#repr-transparent-remove}

从结构或枚举中移除 `repr(transparent)` 是一个破坏性变更。外部库可能依赖该类型具有透明字段的对齐、布局或大小。

```rust,ignore
// MAJOR CHANGE

///////////////////////////////////////////////////////////
// Before
#[repr(transparent)]
pub struct Transparent<T>(T);

///////////////////////////////////////////////////////////
// After
// removed repr
pub struct Transparent<T>(T);

///////////////////////////////////////////////////////////
// Example usage that will break.
#![deny(improper_ctypes)]
use updated_crate::Transparent;

unsafe extern "C" {
    fn c_fn() -> Transparent<f64>; // Error: is not FFI-safe
}

fn main() {}
```

### 重大：在所有当前字段为公共时添加私有结构字段 {#结构体-add-private-field-when-public}

当之前所有字段均为公共的结构中增加一个私有字段时，任何尝试使用 [结构字面量] 构造该结构的代码都将失效。

```rust,ignore
// MAJOR CHANGE

///////////////////////////////////////////////////////////
// Before
pub struct Foo {
    pub f1: i32,
}

///////////////////////////////////////////////////////////
// After
pub struct Foo {
    pub f1: i32,
    f2: i32,
}

///////////////////////////////////////////////////////////
// Example usage that will break.
fn main() {
    let x = updated_crate::Foo { f1: 123 }; // Error: cannot construct `Foo`
}
```

缓解策略：* 不要向所有公共字段的结构中添加新字段。 * 在首次引入结构时将其标记为 [`#[non_exhaustive]`][non_exhaustive]，以防止用户使用结构字面量语法，而是提供构造函数方法和/或 [默认] 实现。

### 重大：在没有私有字段时添加公共字段 {#结构体-add-public-field-when-no-private}

当具有所有公共字段的结构中增加一个公共字段时，任何尝试使用 [结构字面量] 构造该结构的代码都将失效。

```rust,ignore
// MAJOR CHANGE

///////////////////////////////////////////////////////////
// Before
pub struct Foo {
    pub f1: i32,
}

///////////////////////////////////////////////////////////
// After
pub struct Foo {
    pub f1: i32,
    pub f2: i32,
}

///////////////////////////////////////////////////////////
// Example usage that will break.
fn main() {
    let x = updated_crate::Foo { f1: 123 }; // Error: missing field `f2`
}
```

缓解策略：* 不要向所有公共字段的结构中添加新字段。 * 在首次引入结构时将其标记为 [`#[non_exhaustive]`][non_exhaustive]，以防止用户使用结构字面量语法，而是提供构造函数方法和/或 [默认] 实现。

### 小问题：当至少存在一个私有字段时添加或移除私有字段 {#结构体-private-fields-with-private}

当结构体已经包含至少一个私有字段时，添加或移除私有字段是安全的。

```rust,ignore
// MINOR CHANGE

///////////////////////////////////////////////////////////
// Before
#[derive(Default)]
pub struct Foo {
    f1: i32,
}

///////////////////////////////////////////////////////////
// After
#[derive(Default)]
pub struct Foo {
    f2: f64,
}

///////////////////////////////////////////////////////////
// Example use of the library that will safely work.
fn main() {
    // Cannot access private fields.
    let x = updated_crate::Foo::default();
}
```

这是安全的，因为现有代码无法使用[结构体字面量]来构造它，也无法完全匹配其内容。

请注意，对于包含公共字段的元组结构体来说，这是一个**重大变更**，而添加或移除私有字段会改变任何公共字段的索引位置。

```rust,ignore
// MAJOR CHANGE

///////////////////////////////////////////////////////////
// Before
#[derive(Default)]
pub struct Foo(pub i32, i32);

///////////////////////////////////////////////////////////
// After
#[derive(Default)]
pub struct Foo(f64, pub i32, i32);

///////////////////////////////////////////////////////////
// Example usage that will break.
fn main() {
    let x = updated_crate::Foo::default();
    let y = x.0; // Error: is private
}
```

### 小范围变更：从包含所有私有字段（至少包含一个字段）的元组结构体变为普通结构体，或相反{#结构体-tuple-normal-with-private}

如果所有字段都是私有的，将元组结构体改为普通结构体（或反之）是安全的。

```rust,ignore
// MINOR CHANGE

///////////////////////////////////////////////////////////
// Before
#[derive(Default)]
pub struct Foo(i32);

///////////////////////////////////////////////////////////
// After
#[derive(Default)]
pub struct Foo {
    f1: i32,
}

///////////////////////////////////////////////////////////
// Example use of the library that will safely work.
fn main() {
    // Cannot access private fields.
    let x = updated_crate::Foo::default();
}
```

这是安全的，因为现有代码无法使用[结构体字面量]来构造它，也无法匹配其内容。

### 重大变更：添加新的枚举变体（不使用 `non_exhaustive`）{#枚举-variant-new}

如果枚举没有使用 [`#[non_exhaustive]`][non_exhaustive]属性，则添加新的枚举变体是一个破坏性变更。

```rust,ignore
// MAJOR CHANGE

///////////////////////////////////////////////////////////
// Before
pub enum E {
    Variant1,
}

///////////////////////////////////////////////////////////
// After
pub enum E {
    Variant1,
    Variant2,
}

///////////////////////////////////////////////////////////
// Example usage that will break.
fn main() {
    use updated_crate::E;
    let x = E::Variant1;
    match x { // Error: `E::Variant2` not covered
        E::Variant1 => {}
    }
}
```

缓解策略：* 在引入枚举时，将其标记为 [`#[non_exhaustive]`][non_exhaustive]，迫使用户使用[通配符模式]来捕获新变体。

### 重大变更：向枚举变体添加新字段{#枚举-fields-new}

向枚举变体添加新字段是一个破坏性变更，因为所有字段都是公共的，构造函数和匹配操作将无法编译。

```rust,ignore
// MAJOR CHANGE

///////////////////////////////////////////////////////////
// Before
pub enum E {
    Variant1 { f1: i32 },
}

///////////////////////////////////////////////////////////
// After
pub enum E {
    Variant1 { f1: i32, f2: i32 },
}

///////////////////////////////////////////////////////////
// Example usage that will break.
fn main() {
    use updated_crate::E;
    let x = E::Variant1 { f1: 1 }; // Error: missing f2
    match x {
        E::Variant1 { f1 } => {} // Error: missing f2
    }
}
```

缓解策略：* 在引入枚举时，将变体标记为 [`non_exhaustive`][non_exhaustive]，使得没有通配符就无法构造或匹配该变体。
  ```rust,ignore,skip
  pub enum E {
      #[non_exhaustive]
      Variant1{f1: i32}
  }
  ```
* 在引入枚举时，使用显式的结构体作为值，这样可以控制字段的可见性。
  ```rust,ignore,skip
  pub struct Foo {
     f1: i32,
     f2: i32,
  }
  pub enum E {
      Variant1(Foo)
  }
  ```

### 重大变更：添加非默认特性的项{#trait-new-item-no-default}

向特质中添加非默认特性是一个破坏性变更。这将破坏所有该特质的实现者。

```rust,ignore
// MAJOR CHANGE

///////////////////////////////////////////////////////////
// Before
pub trait Trait {}

///////////////////////////////////////////////////////////
// After
pub trait Trait {
    fn foo(&self);
}

///////////////////////////////////////////////////////////
// Example usage that will break.
use updated_crate::Trait;
struct Foo;

impl Trait for Foo {}  // Error: not all trait items implemented
```

缓解策略：* 始终为新的关联特质项提供默认实现或值。* 在引入特质时，使用[密封特质]技术来防止 crate 外部的用户实现该特质。

### 重大：对特质项签名进行任何更改 {#trait-item-signature}

对特质项签名进行任何更改都属于破坏性变更。这可能会破坏该特质的外部实现者。

```rust,ignore
// MAJOR CHANGE

///////////////////////////////////////////////////////////
// Before
pub trait Trait {
    fn f(&self, x: i32) {}
}

///////////////////////////////////////////////////////////
// After
pub trait Trait {
    // For sealed traits or normal functions, this would be a minor change
    // because generalizing with generics strictly expands the possible uses.
    // But in this case, trait implementations must use the same signature.
    fn f<V>(&self, x: V) {}
}

///////////////////////////////////////////////////////////
// Example usage that will break.
use updated_crate::Trait;
struct Foo;

impl Trait for Foo {
    fn f(&self, x: i32) {}  // Error: trait declaration has 1 type parameter
}
```

缓解策略：* 引入带有默认实现的新项来覆盖新功能，而不是修改现有项。 * 在引入特质时，使用[密封特质]技术，以防止 crate 之外的用户实现该特质。

### 可能破坏性：添加带默认值的特质项 {#trait-new-default-item}

通常添加带默认值的特质项是安全的。然而，有时会导致编译错误。例如，如果另一个特质中存在同名方法，则可能会引入歧义。

```rust,ignore
// Breaking change example

///////////////////////////////////////////////////////////
// Before
pub trait Trait {}

///////////////////////////////////////////////////////////
// After
pub trait Trait {
    fn foo(&self) {}
}

///////////////////////////////////////////////////////////
// Example usage that will break.
use updated_crate::Trait;
struct Foo;

trait LocalTrait {
    fn foo(&self) {}
}

impl Trait for Foo {}
impl LocalTrait for Foo {}

fn main() {
    let x = Foo;
    x.foo(); // Error: multiple applicable items in scope
}
```

请注意，对于[固有实现]中的名称冲突，这种歧义并不存在，因为它们优先于特质项。

关于添加特质项的特殊情况，请参阅 [trait-object-safety](#trait-object-safety)。

缓解策略：* 一些项目可能认为这种可接受的破坏是可行的，特别是如果新项名称不太可能与现有代码冲突。仔细选择名称以帮助避免这些冲突。此外，要求下游用户在更新依赖时添加[歧义语法]以选择正确的函数也可能是可以接受的。

### 重大：添加使特质不再安全的特质项 {#trait-object-safety}

添加改变特质不再为[对象安全]的特质项属于破坏性变更。

```rust,ignore
// MAJOR CHANGE

///////////////////////////////////////////////////////////
// Before
pub trait Trait {}

///////////////////////////////////////////////////////////
// After
pub trait Trait {
    // An associated const makes the trait not object-safe.
    const CONST: i32 = 123;
}

///////////////////////////////////////////////////////////
// Example usage that will break.
use updated_crate::Trait;
struct Foo;

impl Trait for Foo {}

fn main() {
    let obj: Box<dyn Trait> = Box::new(Foo); // Error: the trait `updated_crate::Trait` is not dyn compatible
}
```

反向操作（将非对象安全的特质变为安全特质）是安全的。

### 重大：添加无默认值的类型参数 {#trait-new-parameter-no-default}

向特质添加无默认值的类型参数属于破坏性变更。

```rust,ignore
// MAJOR CHANGE

///////////////////////////////////////////////////////////
// Before
pub trait Trait {}

///////////////////////////////////////////////////////////
// After
pub trait Trait<T> {}

///////////////////////////////////////////////////////////
// Example usage that will break.
use updated_crate::Trait;
struct Foo;

impl Trait for Foo {}  // Error: missing generics
```

缓解策略：* 请参阅 [添加带默认值的特质类型参数](#trait-new-parameter-default)。

### 次要：添加带默认值的特质类型参数 {#trait-new-parameter-default}

只要类型参数有默认值，将其添加到 trait 中是安全的。外部实现者将使用默认值，无需指定该参数。

```rust,ignore
// MINOR CHANGE

///////////////////////////////////////////////////////////
// Before
pub trait Trait {}

///////////////////////////////////////////////////////////
// After
pub trait Trait<T = i32> {}

///////////////////////////////////////////////////////////
// Example use of the library that will safely work.
use updated_crate::Trait;
struct Foo;

impl Trait for Foo {}
```

### 可能破坏性的变更：添加任何固有项 {#实现-item-new}

通常向实现中添加固有项是安全的，因为固有项优先于 trait 项。然而，在某些情况下，如果名称与具有不同签名的已实现的 trait 项相同，则可能导致问题。

```rust,ignore
// Breaking change example

///////////////////////////////////////////////////////////
// Before
pub struct Foo;

///////////////////////////////////////////////////////////
// After
pub struct Foo;

impl Foo {
    pub fn foo(&self) {}
}

///////////////////////////////////////////////////////////
// Example usage that will break.
use updated_crate::Foo;

trait Trait {
    fn foo(&self, x: i32) {}
}

impl Trait for Foo {}

fn main() {
    let x = Foo;
    x.foo(1); // Error: this method takes 0 arguments but 1 argument was supplied
}
```

请注意，如果签名一致，则不会产生编译时错误，但运行时行为可能会发生变化（因为现在执行的是不同的函数）。

缓解策略：* 某些项目可能认为这种破坏是可接受的，特别是新项的名称不太可能与现有代码冲突时。应谨慎选择名称以避免此类冲突。此外，可以要求下游用户在更新依赖项时添加 [歧义消除语法] 以选择正确的函数。

### 重大：收紧泛型边界 {#泛型-bounds-tighten}

收紧类型的泛型边界是一个破坏性变更，因为这可能会破坏期望较宽松边界的用户。

```rust,ignore
// MAJOR CHANGE

///////////////////////////////////////////////////////////
// Before
pub struct Foo<A> {
    pub f1: A,
}

///////////////////////////////////////////////////////////
// After
pub struct Foo<A: Eq> {
    pub f1: A,
}

///////////////////////////////////////////////////////////
// Example usage that will break.
use updated_crate::Foo;

fn main() {
    let s = Foo { f1: 1.23 }; // Error: the trait bound `{float}: Eq` is not satisfied
}
```

### 轻微：放宽泛型边界 {#泛型-bounds-loosen}

放宽类型的泛型边界是安全的，因为它只扩展允许的内容。

```rust,ignore
// MINOR CHANGE

///////////////////////////////////////////////////////////
// Before
pub struct Foo<A: Clone> {
    pub f1: A,
}

///////////////////////////////////////////////////////////
// After
pub struct Foo<A> {
    pub f1: A,
}

///////////////////////////////////////////////////////////
// Example use of the library that will safely work.
use updated_crate::Foo;

fn main() {
    let s = Foo { f1: 123 };
}
```

### 轻微：添加有默认值的类型参数 {#泛型-new-default}

只要类型参数有默认值，将其添加到类型中是安全的。所有现有引用将使用默认值，无需指定该参数。

```rust,ignore
// MINOR CHANGE

///////////////////////////////////////////////////////////
// Before
#[derive(Default)]
pub struct Foo {}

///////////////////////////////////////////////////////////
// After
#[derive(Default)]
pub struct Foo<A = i32> {
    f1: A,
}

///////////////////////////////////////////////////////////
// Example use of the library that will safely work.
use updated_crate::Foo;

fn main() {
    let s: Foo = Default::default();
}
```

### 轻微：将类型泛化为使用泛型（具有相同类型） {#泛型-generalize-identical}

结构或枚举字段可以从具体类型变为泛型类型参数，前提是这种变更能使所有现有用例的类型保持一致。例如，以下变更是允许的：

```rust,ignore
// MINOR CHANGE

///////////////////////////////////////////////////////////
// Before
pub struct Foo(pub u8);

///////////////////////////////////////////////////////////
// After
pub struct Foo<T = u8>(pub T);

///////////////////////////////////////////////////////////
// Example use of the library that will safely work.
use updated_crate::Foo;

fn main() {
    let s: Foo = Foo(123);
}
```

因为现有的 `Foo` 用法是 `Foo<u8>` 的简写，后者产生相同的字段类型。

### 重要：将类型泛化为使用泛型（可能包含不同类型）{#泛型-generalize-different}

如果将结构体或枚举字段从具体类型改为泛型类型参数，如果类型发生变化则可能导致破坏。

```rust,ignore
// MAJOR CHANGE

///////////////////////////////////////////////////////////
// Before
pub struct Foo<T = u8>(pub T, pub u8);

///////////////////////////////////////////////////////////
// After
pub struct Foo<T = u8>(pub T, pub T);

///////////////////////////////////////////////////////////
// Example usage that will break.
use updated_crate::Foo;

fn main() {
    let s: Foo<f32> = Foo(3.14, 123); // Error: mismatched types
}
```

### 次要：将泛型类型改为更通用的类型 {#泛型-more-泛型}

将泛型类型改为更通用的类型是安全的。例如，以下示例添加了默认值为原始类型的泛型参数，这是安全的，因为所有现有用户都将使用相同的类型来处理这两个字段，无需指定默认参数。

```rust,ignore
// MINOR CHANGE

///////////////////////////////////////////////////////////
// Before
pub struct Foo<T>(pub T, pub T);

///////////////////////////////////////////////////////////
// After
pub struct Foo<T, U = T>(pub T, pub U);

///////////////////////////////////////////////////////////
// Example use of the library that will safely work.
use updated_crate::Foo;

fn main() {
    let s: Foo<f32> = Foo(1.0, 2.0);
}
```

### 重要：在 RPIT 中捕获更多通用参数 {#泛型-rpit-capture}

在 [RPIT] (return-position 实现 trait) 中捕获额外的泛型参数是一种破坏性变更。

```rust,ignore
// MAJOR CHANGE

///////////////////////////////////////////////////////////
// Before
pub fn f<'a, 'b>(x: &'a str, y: &'b str) -> impl Iterator<Item = char> + use<'a> {
    x.chars()
}

///////////////////////////////////////////////////////////
// After
pub fn f<'a, 'b>(x: &'a str, y: &'b str) -> impl Iterator<Item = char> + use<'a, 'b> {
    x.chars().chain(y.chars())
}

///////////////////////////////////////////////////////////
// Example usage that will break.
fn main() {
    let a = String::new();
    let b = String::new();
    let iter = updated_crate::f(&a, &b);
    drop(b); // Error: cannot move out of `b` because it is borrowed
}
```

向 RPIT 添加泛型参数会对结果类型的使用方式施加额外约束。

请注意，当未指定 `use<>` 语法时会有隐式捕获。在 Rust 2021 及更早版本中，生命周期参数仅在 RPIT 类型签名中的限制范围内出现时才会被捕获。从 Rust 2024 开始，所有生命周期参数都无条件被捕获。这意味着从 Rust 2024 开始，默认情况下是最大兼容性的，当您希望捕获较少的参数时必须明确说明，这是 SemVer 承诺的一部分。

有关 RPIT 捕获的更多信息，请参阅 [版本指南][rpit-capture-guide] 和 [参考文档][rpit-reference]。

在 RPIT 中捕获更少的泛型参数是一个次要变更。

> [!NOTE]
> 所有涉及范围内的类型 và const 泛型参数必须被隐式捕获（未指定 `+ use<…>`）或显式捕获（必须在 `+ use<…>` 中列出），因此目前不允许更改这些泛型参数的捕获方式。


### 重要：添加/移除函数参数 {#fn-change-arity}

更改函数的参数个数属于破坏性变更。

```rust,ignore
// MAJOR CHANGE

///////////////////////////////////////////////////////////
// Before
pub fn foo() {}

///////////////////////////////////////////////////////////
// After
pub fn foo(x: i32) {}

///////////////////////////////////////////////////////////
// Example usage that will break.
fn main() {
    updated_crate::foo(); // Error: this function takes 1 argument
}
```

缓解策略：* 引入具有新签名的全新函数，并可能[废弃][deprecated]旧函数。 * 引入接受结构体参数的函数，该结构体采用构建器模式构建。这样可以在未来向结构体中添加新字段。

### 可能破坏性：引入新的函数类型参数 {#fn-泛型-new}

通常，添加非默认类型的参数是安全的，但在某些情况下可能会造成破坏性变更。

```rust,ignore
// Breaking change example

///////////////////////////////////////////////////////////
// Before
pub fn foo<T>() {}

///////////////////////////////////////////////////////////
// After
pub fn foo<T, U>() {}

///////////////////////////////////////////////////////////
// Example usage that will break.
use updated_crate::foo;

fn main() {
    foo::<u8>(); // Error: function takes 2 generic arguments but 1 generic argument was supplied
}
```

然而，这种显式调用非常罕见（通常可以通过其他方式实现），因此这种破坏通常是可接受的。应考虑所涉及的函数是否很可能使用显式的类型参数被调用。

### 轻微：将函数泛化以使用泛型（支持原始类型） {#fn-generalize-compatible}

函数的参数类型或返回值类型可以*泛化*为使用泛型，包括引入新的类型参数，只要该参数可以被实例化为原始类型即可。例如，以下更改是允许的：

```rust,ignore
// MINOR CHANGE

///////////////////////////////////////////////////////////
// Before
pub fn foo(x: u8) -> u8 {
    x
}
pub fn bar<T: Iterator<Item = u8>>(t: T) {}

///////////////////////////////////////////////////////////
// After
use std::ops::Add;
pub fn foo<T: Add>(x: T) -> T {
    x
}
pub fn bar<T: IntoIterator<Item = u8>>(t: T) {}

///////////////////////////////////////////////////////////
// Example use of the library that will safely work.
use updated_crate::{bar, foo};

fn main() {
    foo(1);
    bar(vec![1, 2, 3].into_iter());
}
```

因为所有现有使用都是新签名的实例化。

或许有些令人惊讶的是，泛化也适用于特质对象，因为每个特质都实现了自身。

```rust,ignore
// MINOR CHANGE

///////////////////////////////////////////////////////////
// Before
pub trait Trait {}
pub fn foo(t: &dyn Trait) {}

///////////////////////////////////////////////////////////
// After
pub trait Trait {}
pub fn foo<T: Trait + ?Sized>(t: &T) {}

///////////////////////////////////////////////////////////
// Example use of the library that will safely work.
use updated_crate::{foo, Trait};

struct Foo;
impl Trait for Foo {}

fn main() {
    let obj = Foo;
    foo(&obj);
}
```

（使用`?Sized`至关重要；否则无法恢复原始签名。）

以这种方式引入泛型可能会导致类型推断失败。这种情况通常很少见，对于某些项目来说可能是可接受的破坏，因为可以通过额外的类型注解来修复。

```rust,ignore
// Breaking change example

///////////////////////////////////////////////////////////
// Before
pub fn foo() -> i32 {
    0
}

///////////////////////////////////////////////////////////
// After
pub fn foo<T: Default>() -> T {
    Default::default()
}

///////////////////////////////////////////////////////////
// Example usage that will break.
use updated_crate::foo;

fn main() {
    let x = foo(); // Error: type annotations needed
}
```

### 严重：将函数泛化为使用泛型但存在类型不匹配 {#fn-generalize-mismatch}

如果泛型类型限制或改变了之前允许的类型，则更改函数的参数或返回类型属于破坏性变更。例如，以下添加的泛型约束可能不被现有代码满足：

```rust,ignore
// MAJOR CHANGE

///////////////////////////////////////////////////////////
// Before
pub fn foo(x: Vec<u8>) {}

///////////////////////////////////////////////////////////
// After
pub fn foo<T: Copy + IntoIterator<Item = u8>>(x: T) {}

///////////////////////////////////////////////////////////
// Example usage that will break.
use updated_crate::foo;

fn main() {
    foo(vec![1, 2, 3]); // Error: `Copy` is not implemented for `Vec<u8>`
}
```

### 轻微：使`unsafe`函数安全 {#fn-不安全-safe}

一个之前为 `unsafe` 的函数可以在不破坏代码的情况下变得安全。

不过请注意，这可能会触发 [`unused_unsafe`][unused_unsafe] 检查，如下面的示例所示，这将导致指定了 `#![deny(warnings)]` 的本地库停止编译。根据 [引入新检查](#new-lints)，更新时允许引入新的警告。

相反的做法（将安全函数设为 `unsafe`）则会导致破坏性的变更。

```rust,ignore
// MINOR CHANGE

///////////////////////////////////////////////////////////
// Before
pub unsafe fn foo() {}

///////////////////////////////////////////////////////////
// After
pub fn foo() {}

///////////////////////////////////////////////////////////
// Example use of the library that will trigger a lint.
use updated_crate::foo;

unsafe fn bar(f: unsafe fn()) {
    f()
}

fn main() {
    unsafe { foo() }; // The `unused_unsafe` lint will trigger here
    unsafe { bar(foo) };
}
```

使结构体或枚举中之前为 `unsafe` 的关联函数或方法变得安全也是一种较小的变更，而特质上的关联函数则不是如此（请参阅 [对特质项签名的任何变更](#trait-item-signature)）。

### 重大：从支持 `no_std` 到要求使用 `std` {#attr-no-std-to-std}

如果您的库专门支持 [`no_std`] 环境，那么发布新版本并要求使用 `std` 将会导致破坏性的变更。

```rust,ignore,skip
// MAJOR CHANGE

///////////////////////////////////////////////////////////
// Before
#![no_std]
pub fn foo() {}

///////////////////////////////////////////////////////////
// After
pub fn foo() {
    std::time::SystemTime::now();
}

///////////////////////////////////////////////////////////
// Example usage that will break.
// This will fail to link for no_std targets because they don't have a `std` crate.
#![no_std]
use updated_crate::foo;

fn example() {
    foo();
}
```

缓解策略：* 避免此问题的常见做法是包含一个可选的 `std` [Cargo 特性]，当该功能关闭时，库可以在 `no_std` 环境中使用。

### 重大：在没有私有字段的现有枚举、变体或结构体中添加 `non_exhaustive {#attr-adding-non-exhaustive}`

使用 [`#[non_exhaustive]`][non_exhaustive] 标记会改变这些项在定义库之外的使用方式：

- 非穷尽的结构体和枚举变体无法使用 [结构体 literal] 语法进行构造，包括 [函数式更新语法]。
- 对非穷尽结构体的模式匹配需要使用 `..`，而对枚举的模式匹配并不计入穷尽性中。
- 不允许使用 `as` 将枚举变体转换为其判别式类型。

具有私有字段的结构体无论是否使用 [`#[non_exhaustive]`][non_exhaustive] 标记，都无法使用 [结构体 literal] 语法进行构造。向此类结构体添加 [`#[non_exhaustive]`][non_exhaustive] 标记不会造成破坏性的变更。

```rust,ignore
// MAJOR CHANGE

///////////////////////////////////////////////////////////
// Before
pub struct Foo {
    pub bar: usize,
}

pub enum Bar {
    X,
    Y(usize),
    Z { a: usize },
}

pub enum Quux {
    Var,
}

///////////////////////////////////////////////////////////
// After
#[non_exhaustive]
pub struct Foo {
    pub bar: usize,
}

pub enum Bar {
    #[non_exhaustive]
    X,

    #[non_exhaustive]
    Y(usize),

    #[non_exhaustive]
    Z { a: usize },
}

#[non_exhaustive]
pub enum Quux {
    Var,
}

///////////////////////////////////////////////////////////
// Example usage that will break.
use updated_crate::{Bar, Foo, Quux};

fn main() {
    let foo = Foo { bar: 0 }; // Error: cannot create non-exhaustive struct using struct expression

    let bar_x = Bar::X; // Error: unit variant `X` is private
    let bar_y = Bar::Y(0); // Error: tuple variant `Y` is private
    let bar_z = Bar::Z { a: 0 }; // Error: cannot create non-exhaustive variant using struct expression

    let q = Quux::Var;
    match q {
        Quux::Var => 0,
        // Error: non-exhaustive patterns: `_` not covered
    };
}
```

缓解策略：* 在首次引入结构体、枚举和枚举变体时，使用 [`#[non_exhaustive]`][non_exhaustive] 标记它们，而不是之后才添加 [`#[non_exhaustive]`][non_exhaustive]。

## 工具与环境兼容性

### 可能破坏功能：更改所需的 Rust 最低版本 {#env-new-rust} 在 Rust 的新版本中引入新特性可能会破坏使用旧版本 Rust 的项目。这还包括在 Cargo 的新版本中使用新特性，以及要求在之前稳定版可运行的 crate 中使用仅适用于夜间的特性。

在 Rust 新版本中引入新功能可能会破坏使用旧版本 Rust 的项目。这同样包括在 Cargo 新版本中使用新功能，以及要求在一个之前在稳定版本下可运行的 crate 中使用仅适用于夜间版本的特性。

通常建议将此视为小变化而非大变化，[出于多种原因][msrv-is-minor]。通常更新到更新的 Rust 版本相对容易。Rust 还有快速的6周发布周期，一些项目可以在一定发布窗口内保持兼容性（例如当前稳定版加上N个之前的版本）。只需注意，一些大型项目可能无法快速更新其 Rust 工具链。

缓解策略：* 通过设置 [`package.rust-version`]来记录包所需的最低支持 Rust 版本，使 Cargo 的依赖解析在需要时尝试[选择包的旧版本]。务必考虑[支持预期]。* 使用[Cargo特性]使新特性可选。* 为旧版本提供较长的支持周期。* 如果可能，复制新标准库项目的源代码，以便继续使用旧版本但利用新特性。* 为旧小版本的独立分支提供重要修复回退功能。* 留意 [`[cfg(version(..))]`][cfg-version]和 [`#[cfg(accessible(..))]`][cfg-accessible]特性，这些特性提供了新特性的可选机制。目前这些特性不稳定，仅可在夜间通道中使用。


### 可能破坏功能：更改平台和环境要求 {#env-change-requirements}

库对其运行的环境所做的假设非常广泛，例如主机平台、操作系统版本、可用服务、文件系统支持等。如果你发布新版本并限制之前支持的环境，例如要求使用更新版本的操作系统，则可能会造成破坏性变更。这些变更可能难以追踪，因为你不一定总是知道在未自动测试的环境中是否会发生故障。

某些项目可能认为这种可接受的破坏是合理的，特别是如果大多数用户不太可能出现问题，或者项目没有资源支持所有环境。另一个典型情况是当供应商停止对某些硬件或操作系统的支持时，项目也可能认为停止支持是合理的。

缓解策略：* 明确记录你专门支持的平台和环境。 * 在持续集成环境中对多种环境进行代码测试。

### 轻微问题：引入新lint规则 {#new-lints}

库的一些变更可能会在使用该库的用户中触发新的lint规则。通常应将其视为兼容的变更。

```rust,ignore,dont-deny
// MINOR CHANGE

///////////////////////////////////////////////////////////
// Before
pub fn foo() {}

///////////////////////////////////////////////////////////
// After
#[deprecated]
pub fn foo() {}

///////////////////////////////////////////////////////////
// Example use of the library that will safely work.

fn main() {
    updated_crate::foo(); // Warning: use of deprecated function
}
```

需要注意的是，如果项目明确拒绝了警告，并且更新后的crate是直接依赖项，那么从技术上讲可能会导致项目失败。拒绝警告时应谨慎操作，并理解随着时间的推移可能会引入新的lint规则。不过，库作者在引入新警告时应该谨慎行事，并考虑对用户可能产生的影响。

以下lint规则就是更新依赖项时可能引入的示例：

* [`deprecated`][deprecated-lint] --- 当依赖项在您使用的项目中添加 [`#[deprecated]` 属性][deprecated]时引入。
* [`unused_must_use`] --- 当依赖项在您不消耗其结果的项目中添加 [`#[must_use]` 属性][must-use-attr]时引入。
* [`unused_unsafe`] --- 当依赖项*移除*函数的 `unsafe` 限定符，且这是 不安全 块中唯一调用的不安全函数时引入。

此外，将 `rustc` 更新到新版本可能会引入新的检查器。

通常，引入新检查器的 transitive 依赖不应导致失败，因为 Cargo 使用 [`--cap-lints`](../../rustc/lints/levels.html#capping-lints) 来抑制所有依赖项中的检查器。

缓解策略： * 如果构建时拒绝警告，请了解您可能需要处理每次更新依赖项时出现的新警告。如果使用 RUSTFLAGS 传递 `-Dwarnings`，也添加 `-A` 标志以允许可能导致问题的检查器，例如 `-Adeprecated`。 * 通过 [特性][Cargo features] 引入弃用功能。例如 `#[cfg_attr(feature = "deprecated", deprecated="use bar instead")]`。然后，当您计划在未来的 SemVer breaking change 中移除某个项目时，您可以告知用户应在更新并移除使用已弃用的项目之前启用 `deprecated` 特性。这允许用户选择何时应对弃用功能，而无需立即响应。缺点是向用户传达需要手动采取这些步骤以准备重大更新可能会比较困难。


### Cargo

#### 次要：添加新的 Cargo 特性 {#cargo-特性-add}

通常添加新的 [Cargo 功能] 是安全的。如果该功能引入了新的变化导致破坏性变更，对于具有严格向后兼容性需求的项目来说可能会带来困难。在这种情况下，避免将该功能添加到“默认”列表中，并可能记录启用该功能的后果。

```toml
# MINOR CHANGE

###########################################################
# Before
[features]
# ..empty

###########################################################
# After
[features]
std = []
```

#### Major：移除 Cargo 功能 {#cargo-特性-remove}

通常移除 [Cargo 功能] 会导致破坏性变更。任何启用了该功能的项目都会出现错误。

```toml
# MAJOR CHANGE

###########################################################
# Before
[features]
logging = []

###########################################################
# After
[dependencies]
# ..logging removed
```

缓解策略：* 清晰记录你的功能。如果是内部或实验性功能，应明确标注，以便用户了解该功能的状态。* 在 `Cargo.toml` 中保留旧功能，但移除其功能实现。记录该功能已弃用，并在未来的主要 SemVer 版本中移除它。

#### Major：如果移除功能会改变功能或公开项，则从功能列表中移除该功能 {#cargo-特性-remove-another}

如果从其他功能中移除功能，如果现有用户期望通过该功能获得特定功能，则可能导致用户遇到问题。

```toml
# Breaking change example

###########################################################
# Before
[features]
default = ["std"]
std = []

###########################################################
# After
[features]
default = []  # This may cause packages to fail if they are expecting std to be enabled.
std = []
```

#### 可能破坏性：移除可选依赖项 {#cargo-remove-opt-dep}

移除 [可选依赖项][opt-dep] 可能会破坏使用你的库的项目，因为其他项目可能通过 [Cargo 功能] 启用该依赖项。

当存在可选依赖项时，cargo 会隐式定义同名功能，以提供启用该依赖项的机制及检查其是否被启用的方法。通过使用 `[features]` 表中的 `dep:` 语法可以避免这个问题，因为该语法会禁用这种隐式功能。使用 `dep:` 可以使可选依赖项以更语义相关的名称隐藏其存在，从而更安全地进行修改。

```toml
# Breaking change example

###########################################################
# Before
[dependencies]
curl = { version = "0.4.31", optional = true }

###########################################################
# After
[dependencies]
# ..curl removed
```

```toml
# MINOR CHANGE
#
# This example shows how to avoid breaking changes with optional dependencies.

###########################################################
# Before
[dependencies]
curl = { version = "0.4.31", optional = true }

[features]
networking = ["dep:curl"]

###########################################################
# After
[dependencies]
# Here, one optional dependency was replaced with another.
hyper = { version = "0.14.27", optional = true }

[features]
networking = ["dep:hyper"]
```

缓解策略：* 在 `[features]` 表中使用 `dep:` 语法，从而避免首先暴露可选依赖项。有关更多信息，请参阅 [optional dependencies][opt-dep]。* 清晰记录你的功能特性。如果可选依赖项未被记录在功能列表中，你可以决定认为修改未记录的条目是安全的。* 保留该可选依赖项，但在你的库中不要使用它。* 用一个不执行任何操作的 [Cargo 特性] 替换可选依赖项，并说明该特性已过时。* 使用能够启用可选依赖项的高级功能，并将这些功能作为实现扩展功能的首选方式进行记录。例如，如果你的库对“网络”等功能有可选支持，创建一个名为“networking”的通用功能名称，以启用实现“网络”所需的可选依赖项。然后记录“networking”功能。


#### 小问题：更改依赖项功能 {#cargo-change-dep-特性}

通常更改依赖项的功能是安全的，只要该功能不会引入破坏性变更。

```toml
# MINOR CHANGE

###########################################################
# Before
[dependencies]
rand = { version = "0.7.3", features = ["small_rng"] }


###########################################################
# After
[dependencies]
rand = "0.7.3"
```

#### 小问题：添加依赖项 {#cargo-dep-add}

通常添加新依赖项是安全的，只要新依赖项不引入导致破坏性变更的新要求。例如，在之前运行在稳定版本上的项目中添加需要 nightly 版本的新的依赖项属于重大变更。

```toml
# MINOR CHANGE

###########################################################
# Before
[dependencies]
# ..empty

###########################################################
# After
[dependencies]
log = "0.4.11"
```

## 应用兼容性

Cargo 项目也可能包含具有自身接口的可执行二进制文件（如 CLI 接口、操作系统级交互等）。由于这些属于 Cargo 包的一部分，它们通常使用并共享与包相同的版本。在对应用程序进行更改时，您需要决定是否以及以何种方式使用 SemVer 规范与用户对接。应用程序的潜在破坏性和兼容性变更太多无法一一列举，因此建议您遵循 [SemVer] 规范的精神来指导如何对应用程序应用版本管理，或者至少记录下您的承诺内容。

[Change categories]: #change-categories
[SemVer compatibility]: resolver.md#semver-compatibility
[the default representation]: ../../reference/type-layout.html#the-default-representation
[primitive representation]: ../../reference/type-layout.html#primitive-representations
[`repr` attribute]: ../../reference/type-layout.html#representations
[`std::mem::transmute`]: ../../std/mem/fn.transmute.html
[`UnsafeCell`]: ../../std/cell/struct.UnsafeCell.html#memory-layout
[edition-closures]: ../../edition-guide/rust-2021/disjoint-capture-in-closures.html
[RPIT]: ../../reference/types/impl-trait.md#abstract-return-types
[rpit-capture-guide]: ../../edition-guide/rust-2024/rpit-lifetime-capture.html
[rpit-reference]: ../../reference/types/impl-trait.md#capturing
[select older versions of your package]: resolver.md#rust-version
[support expectations]: rust-version.md#support-expectations
[`unused_must_use`]: ../../rustc/lints/listing/warn-by-default.html#unused-must-use
[deprecated-lint]: ../../rustc/lints/listing/warn-by-default.html#deprecated
[must-use-attr]: ../../reference/attributes/diagnostics.html#the-must_use-attribute
[`unused_unsafe`]: ../../rustc/lints/listing/warn-by-default.html#unused-unsafe
[opt-dep]: features.md#optional-dependencies
[`cfg` attribute]: ../../reference/conditional-compilation.md#the-cfg-attribute
[`no_std`]: ../../reference/names/preludes.html#the-no_std-attribute
[`package.rust-version`]: rust-version.md
[`pub use`]: ../../reference/items/use-declarations.html
[Cargo feature]: features.md
[Cargo features]: features.md
[cfg-accessible]: https://github.com/rust-lang/rust/issues/64797
[cfg-version]: https://github.com/rust-lang/rust/issues/64796
[conditional compilation]: ../../reference/conditional-compilation.md
[Default]: ../../std/default/trait.Default.html
[deprecated]: ../../reference/attributes/diagnostics.html#the-deprecated-attribute
[disambiguation syntax]: ../../reference/expressions/call-expr.html#disambiguating-function-calls
[functional update syntax]: ../../reference/expressions/struct-expr.html#functional-update-syntax
[inherent implementations]: ../../reference/items/implementations.html#inherent-implementations
[items]: ../../reference/items.html
[non_exhaustive]: ../../reference/attributes/type_system.html#the-non_exhaustive-attribute
[object safe]: ../../reference/items/traits.html#object-safety
[rust-feature]: https://doc.rust-lang.org/nightly/unstable-book/
[sealed trait]: https://rust-lang.github.io/api-guidelines/future-proofing.html#sealed-traits-protect-against-downstream-implementations-c-sealed
[SemVer]: https://semver.org/
[struct literal]: ../../reference/expressions/struct-expr.html
[wildcard patterns]: ../../reference/patterns.html#wildcard-pattern
[unused_unsafe]: ../../rustc/lints/listing/warn-by-default.html#unused-unsafe
[msrv-is-minor]: https://github.com/rust-lang/api-guidelines/discussions/231
