<a id="items"></a>
# 项目

<a id="items.syntax"></a> 
```grammar,items
Item ->
    OuterAttribute* ( VisItem | MacroItem )

VisItem ->
    Visibility?
    (
        Module
      | ExternCrate
      | UseDeclaration
      | Function
      | TypeAlias
      | Struct
      | Enumeration
      | Union
      | ConstantItem
      | StaticItem
      | Trait
      | Implementation
      | ExternBlock
    )

MacroItem ->
      MacroInvocationSemi
    | MacroRulesDefinition
```

<a id="items.intro"></a> _项目_是crate的一个组成部分。项目在crate中通过嵌套的[模块]结构进行组织。每个crate都有一个“最外层”的匿名模块；crate内的所有其他项目都位于该crate的模块树中的[路径]下。

<a id="items.static-def"></a> 项目完全在编译时确定，通常在执行过程中保持不变，并且可以存在于只读内存中。

<a id="items.kinds"></a> 项目有几种类型：

* [模块] * [`extern crate`声明] * [`use`声明] * [函数定义] * [类型别名定义] * [结构体定义] * [枚举定义] * [联合定义] * [常量项目] * [静态项目] * [特质定义] * [实现] * [`extern`块]

<a id="items.locations"></a> 项目可以在[crate的根目录]、一个[模块][modules]或[块表达式]中声明。

<a id="items.associated-locations"></a> 一部分项目，称为[关联项目]，可以在[特质]和[实现]中声明。

<a id="items.extern-locations"></a> 一部分项目，称为外部项目，可以在 [`extern`块]中声明。

<a id="items.decl-order"></a> 项目的定义顺序可以任意安排，但 [`macro_rules`]除外，因为它有自己独立的作用域规则。

<a id="items.name-resolution"></a> 项目名称的[命名解析]允许在模块或块中引用项目之前或之后定义该项目。

有关项目的作用域规则信息，请参阅[项目作用域]。

[`extern crate` declarations]: items/extern-crates.md
[`extern` blocks]: items/external-blocks.md
[`macro_rules`]: macros-by-example.md
[`use` declarations]: items/use-declarations.md
[associated items]: items/associated-items.md
[block expression]: expressions/block-expr.md
[constant items]: items/constant-items.md
[enumeration definitions]: items/enumerations.md
[function definitions]: items/functions.md
[implementations]: items/implementations.md
[item scopes]: names/scopes.md#item-scopes
[modules]: items/modules.md
[name resolution]: names/name-resolution.md
[paths]: paths.md
[root of the crate]: crates-and-source-files.md
[statement]: statements.md
[static items]: items/static-items.md
[struct definitions]: items/structs.md
[trait definitions]: items/traits.md
[traits]: items/traits.md
[type alias definitions]: items/type-aliases.md
[union definitions]: items/unions.md
