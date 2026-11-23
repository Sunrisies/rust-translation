<a id="names"></a>
# 名称

<a id="names.intro"></a> 实体是语言构造，可以在源程序中以某种方式被引用，通常是通过[路径]。实体包括[类型][lifetimes-and-loop-labels][泛型参数][extern-prelude][循环标签][extern-prelude][字段][属性]和[lints]。

声明是一种语法构造，可以引入一个名称来指代实体。实体名称在[*作用域*]内是有效的——即该名称可以被引用的源文本区域。

一些实体在源代码中被[显式声明](#explicitly-declared-entities)，而有些则作为语言或编译器扩展的一部分[隐式声明](#implicitly-declared-entities)。

[*路径*]用于引用实体，可能位于另一个模块或类型中。

生命周期和循环标签使用带有前置引号的[专用语法][lifetimes-and-loop-labels]。

名称被划分为不同的[*命名空间*]，使得不同命名空间中的实体可以共享相同的名称而不会产生冲突。

[*名称解析*]是编译时将路径、标识符和标签与实体声明关联的过程。

某些名称的访问可能根据其[*可见性*]受到限制。

<a id="names.explicit"></a>
## 显式声明的实体

<a id="names.explicit.list"></a> 在源代码中显式引入名称的实体包括：

<a id="names.explicit.item-decl"></a> * [项]: * [模块声明] * [外部crate声明] * [使用声明] * [函数声明]和[函数参数] * [类型别名] * [结构体][联合体][枚举]、枚举变体声明及其命名字段 * [常量项声明] * [静态项声明] * [特质项声明]及其[关联项] * [外部块项] * [`macro_rules`声明]和[匹配器元变量] * [实现]关联项

<a id="names.explicit.expr"></a> * [表达式]: * [闭包]参数 * [`while let`]模式绑定 * [`for`]模式绑定 * [`if let`]模式绑定 * [`match`]模式绑定 * [循环标签]

<a id="names.explicit.generics"></a> * [泛型参数]

<a id="names.explicit.higher-ranked-bounds"></a> * [更高秩 trait 边界]

<a id="names.explicit.binding"></a> * [`let` 语句] 模式绑定

<a id="names.explicit.macro_use"></a> * [`macro_use` 属性] 可以引入来自其他 crate 的宏名称

<a id="names.explicit.macro_export"></a> * [`macro_export` 属性] 可以在 crate 根目录中引入宏的别名

<a id="names.explicit.宏-invocation"></a> 此外，[宏调用]和[属性]可以通过展开为上述项之一来引入名称。

<a id="names.implicit"></a>
## 隐式声明的实体

<a id="names.implicit.list"></a> 以下实体由语言隐式定义，或由编译器选项和扩展引入：

<a id="names.implicit.primitive-types"></a> * [语言前导集]: * [布尔类型] --- `bool` * 文本类型 --- [`char`] 和 [`str`] * [整数类型] --- `i8`, `i16`, `i32`, `i64`, `i128`, `u8`, `u16`, `u32`, `u64`, `u128` * [机器相关整数类型] --- `usize` 和 `isize` * [浮点类型] --- `f32` 和 `f64`

<a id="names.implicit.builtin-attributes"></a> * [内置属性]

<a id="names.implicit.prelude"></a> * [标准库前导集] 项、属性和宏

<a id="names.implicit.stdlib"></a> * [标准库][extern-prelude] 位于根模块中的 crate

<a id="names.implicit.extern-prelude"></a> * [外部 crate][extern-prelude] 由编译器链接

<a id="names.implicit.tool-attributes"></a> * [工具属性]

<a id="names.implicit.lints"></a> * [Lints] 和 [工具 lint 属性]

<a id="names.implicit.derive-helpers"></a> * [Derive 辅助属性] 在未显式导入的情况下，可以在项内使用

<a id="names.implicit.生命周期-static"></a> * [`'static`] 生命周期

<a id="names.implicit.root"></a> 此外，crate 根模块没有名称，但可以通过某些 [路径限定符] 或别名来引用。

[*Name resolution*]: names/name-resolution.md
[*namespaces*]: names/namespaces.md
[*paths*]: paths.md
[*scope*]: names/scopes.md
[*visibility*]: visibility-and-privacy.md
[`'static`]: keywords.md#weak-keywords
[`char`]: types/char.md
[`for`]: expressions/loop-expr.md#iterator-loops
[`if let`]: expressions/if-expr.md#if-let-patterns
[`let` statement]: statements.md#let-statements
[`macro_export` attribute]: macros-by-example.md#the-macro_export-attribute
[`macro_rules` declarations]: macros-by-example.md
[`macro_use` attribute]: macros-by-example.md#the-macro_use-attribute
[`match`]: expressions/match-expr.md
[`str`]: types/str.md
[`while let`]: expressions/loop-expr.md#while-let-patterns
[associated items]: items/associated-items.md
[attributes]: attributes.md
[Boolean type]: types/boolean.md
[Built-in attributes]: attributes.md#built-in-attributes-index
[Closure]: expressions/closure-expr.md
[Constant item declarations]: items/constant-items.md
[Derive helper attributes]: procedural-macros.md#derive-macro-helper-attributes
[enum]: items/enumerations.md
[Expressions]: expressions.md
[extern-prelude]: names/preludes.md#extern-prelude
[External block items]: items/external-blocks.md
[External crate declarations]: items/extern-crates.md
[fields]: expressions/field-expr.md
[floating-point types]: types/numeric.md#floating-point-types
[Function declarations]: items/functions.md
[function parameters]: items/functions.md#function-parameters
[Generic parameters]: items/generics.md
[Higher ranked trait bounds]: trait-bounds.md#higher-ranked-trait-bounds
[Implementation]: items/implementations.md
[Integer types]: types/numeric.md#integer-types
[Items]: items.md
[Language prelude]: names/preludes.md#language-prelude
[lifetimes-and-loop-labels]: tokens.md#lifetimes-and-loop-labels
[lifetimes]: tokens.md#lifetimes-and-loop-labels
[Lints]: attributes/diagnostics.md#lint-check-attributes
[Loop labels]: expressions/loop-expr.md#loop-labels
[Machine-dependent integer types]: types/numeric.md#machine-dependent-integer-types
[macro invocations]: macros.md#macro-invocation
[matcher metavariables]: macros-by-example.md#metavariables
[Module declarations]: items/modules.md
[path]: paths.md
[path qualifiers]: paths.md#path-qualifiers
[Standard library prelude]: names/preludes.md#standard-library-prelude
[Static item declarations]: items/static-items.md
[struct]: items/structs.md
[Tool attributes]: attributes.md#tool-attributes
[tool lint attributes]: attributes/diagnostics.md#tool-lint-attributes
[Trait item declarations]: items/traits.md
[Type aliases]: items/type-aliases.md
[types]: types.md
[union]: items/unions.md
[Use declarations]: items/use-declarations.md
[variable bindings]: patterns.md
