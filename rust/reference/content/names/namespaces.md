<a id="names.namespaces"></a>
# 命名空间

<a id="names.namespaces.intro"></a> *命名空间*是一种逻辑上的[名称]分组。根据名称所指代的实体类型，名称会被分配到不同的命名空间中。命名空间使得一个名称在一个命名空间中的出现不会与另一个命名空间中的相同名称产生冲突。

存在多种不同的命名空间，每种都包含不同种类的实体。根据上下文，使用某个名称时会在不同的命名空间中查找该名称的声明，这已在[名称解析]章节中有描述。

<a id="names.namespaces.kinds"></a> 以下是各种命名空间的列表及其对应的实体：

* 类型命名空间 * [模块声明] * [外部crate声明] * [外部crate prelude项] * [结构体], [联合体], [枚举], 枚举变体声明 * [Trait项声明] * [类型别名] * [关联类型声明] * 内置类型：[布尔值], [数值型], [`char`], 和 [`str`] * [泛型类型参数] * [`Self`类型] * [工具属性模块] * 值命名空间 * [函数声明] * [常量项声明] * [静态项声明] * [结构体构造函数] * [枚举变体构造函数] * [`Self`构造函数] * [泛型常数参数] * [关联常数声明] * [关联函数声明] * 局部绑定 --- [`let`], [`if let`], [`while let`], [`for`], [`match`]分支, [函数参数], [闭包参数] * 捕获的[闭包]变量 * 宏命名空间 * [`macro_rules`声明] * [内置属性] * [工具属性] * [类似函数的过程式宏] * [derive宏] * [derive宏辅助器] * [属性宏] * 生命周期命名空间 * [泛型生命周期参数] * 标签命名空间 * [循环标签] * [块标签]

以下是不同命名空间中重叠名称能够明确使用的示例：

```rust
// Foo introduces a type in the type namespace and a constructor in the value
// namespace.
struct Foo(u32);

// The `Foo` macro is declared in the macro namespace.
macro_rules! Foo {
    () => {};
}

// `Foo` in the `f` parameter type refers to `Foo` in the type namespace.
// `'Foo` introduces a new lifetime in the lifetime namespace.
fn example<'Foo>(f: Foo) {
    // `Foo` refers to the `Foo` constructor in the value namespace.
    let ctor = Foo;
    // `Foo` refers to the `Foo` macro in the macro namespace.
    Foo!{}
    // `'Foo` introduces a label in the label namespace.
    'Foo: loop {
        // `'Foo` refers to the `'Foo` lifetime parameter, and `Foo`
        // refers to the type namespace.
        let x: &'Foo Foo;
        // `'Foo` refers to the label.
        break 'Foo;
    }
}
```

<a id="names.namespaces.without"></a>
## 无命名空间的命名实体

<a id="names.namespaces.without.intro"></a> 以下实体具有明确的名称，但这些名称不属于任何特定的命名空间。

### Fields

<a id="names.namespaces.without.fields"></a> 尽管 结构体、枚举 和 union 的字段具有名称，但这些有名称的字段并不属于显式的命名空间。只能通过 [field expression] 访问它们，而该表达式仅检查被访问的特定类型的字段名称。

### 使用声明

<a id="names.namespaces.without.use"></a> [use 声明] 会导入一些有名称的别名到作用域中，但 `use` 项本身并不属于特定的命名空间。根据被导入的项类型不同，`use` 可以引入多个命名空间中的别名。

<a id="names.namespaces.sub-namespaces"></a>
## 子命名空间

<a id="names.namespaces.sub-namespaces.intro"></a> 宏命名空间被拆分为两个子命名空间：一个用于 [bang-style macros]，另一个用于 [attributes]。当解析属性时，当前作用域中的任何 bang-style 宏都会被忽略。反之，解析 bang-style 宏也会忽略当前作用域中的属性宏。这样可以防止一种风格覆盖另一种风格。

例如，`[cfg] attribute` 和 `[cfg] macro` 在宏命名空间中是同名的不同实体，但在各自的上下文中仍然可以被使用。

<!-- ignore: requires external crates -->
> [!NOTE]
> `use` imports still cannot create duplicate bindings of the same name in a module or block, regardless of sub-namespace.
>
> ```rust,ignore
> #[macro_export]
> macro_rules! mymac {
>     () => {};
> }
>
> use myattr::mymac; // error[E0252]: the name `mymac` is defined multiple times.
> ```

[Block labels]: expr.loop.block-labels
[Derive macros]: macro.proc.derive

[`cfg` attribute]: ../conditional-compilation.md#the-cfg-attribute
[`cfg` macro]: ../conditional-compilation.md#the-cfg-macro
[`char`]: ../types/char.md
[`for`]: ../expressions/loop-expr.md#iterator-loops
[`if let`]: ../expressions/if-expr.md#if-let-patterns
[`let`]: ../statements.md#let-statements
[`macro_rules` declarations]: ../macros-by-example.md
[`match`]: ../expressions/match-expr.md
[`Self` constructors]: ../paths.md#self-1
[`Self` type]: ../paths.md#self-1
[`str`]: ../types/str.md
[`use` import]: ../items/use-declarations.md
[`while let`]: ../expressions/loop-expr.md#while-let-patterns
[Associated const declarations]: ../items/associated-items.md#associated-constants
[Associated function declarations]: ../items/associated-items.md#associated-functions-and-methods
[Associated type declarations]: ../items/associated-items.md#associated-types
[Attribute macros]: ../procedural-macros.md#the-proc_macro_attribute-attribute
[attributes]: ../attributes.md
[bang-style macros]: ../macros.md
[boolean]: ../types/boolean.md
[Built-in attributes]: ../attributes.md#built-in-attributes-index
[closure parameters]: ../expressions/closure-expr.md
[closure]: ../expressions/closure-expr.md
[Constant item declarations]: ../items/constant-items.md
[Derive macro helpers]: ../procedural-macros.md#derive-macro-helper-attributes
[entity]: ../glossary.md#entity
[Enum variant constructors]: ../items/enumerations.md
[enum]: ../items/enumerations.md
[External crate declarations]: ../items/extern-crates.md
[External crate prelude]: preludes.md#extern-prelude
[field expression]: ../expressions/field-expr.md
[Function declarations]: ../items/functions.md
[function parameters]: ../items/functions.md#function-parameters
[Function-like procedural macros]: ../procedural-macros.md#the-proc_macro-attribute
[Generic const parameters]: ../items/generics.md#const-generics
[Generic lifetime parameters]: ../items/generics.md
[Generic type parameters]: ../items/generics.md
[Loop labels]: ../expressions/loop-expr.md#loop-labels
[Module declarations]: ../items/modules.md
[name resolution]: name-resolution.md
[names]: ../names.md
[numeric]: ../types/numeric.md
[Static item declarations]: ../items/static-items.md
[Struct constructors]: ../items/structs.md
[Struct]: ../items/structs.md
[Tool attribute modules]: ../attributes.md#tool-attributes
[Tool attributes]: ../attributes.md#tool-attributes
[Trait item declarations]: ../items/traits.md
[Type aliases]: ../items/type-aliases.md
[union]: ../items/unions.md
[use declaration]: ../items/use-declarations.md
