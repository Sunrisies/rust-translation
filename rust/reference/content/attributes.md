<a id="attributes"></a>
# 属性

<a id="attributes.syntax"></a> 
```grammar,attributes
InnerAttribute -> `#` `!` `[` Attr `]`

OuterAttribute -> `#` `[` Attr `]`

Attr ->
      SimplePath AttrInput?
    | `unsafe` `(` SimplePath AttrInput? `)`

AttrInput ->
      DelimTokenTree
    | `=` Expression
```

<a id="attributes.intro"></a> _属性_ 是一种通用的、自由形式的元数据，其解释依据名称、约定、语言和编译器版本而定。属性的设计基于 [ECMA-335] 中的 Attributes，其语法源自 [ECMA-334] (C#)。

<a id="attributes.inner"></a> _内部属性_ 适用于属性被声明所在的格式。

> [!EXAMPLE]
> ```rust
> // General metadata applied to the enclosing module or crate.
> #![crate_type = "lib"]
>
> // Inner attribute applies to the entire function.
> fn some_unused_variables() {
>   #![allow(unused_variables)]
>
>   let x = ();
>   let y = ();
>   let z = ();
> }
> ```

<a id="attributes.outer"></a> _外部属性_ 适用于属性之后的格式。

> [!EXAMPLE]
> ```rust
> // A function marked as a unit test
> #[test]
> fn test_foo() {
>     /* ... */
> }
>
> // A conditionally-compiled module
> #[cfg(target_os = "linux")]
> mod bar {
>     /* ... */
> }
>
> // A lint attribute used to suppress a warning/error
> #[allow(non_camel_case_types)]
> type int8_t = i8;
> ```

<a id="attributes.input"></a> 属性由指向属性的路径以及可选的带分隔符的标记树组成，其解释由该属性定义。除宏属性外，其他属性允许输入为等号 (`=`) 后跟一个表达式。更多细节请参见下面的 [meta-item-attribute-syntax]。

<a id="attributes.safety"></a> 某些属性可能不可安全使用。为了避免使用这些属性时产生未定义行为，必须满足一些编译器无法检查的约束条件。为了表明这些约束已满足，属性会被包裹在 `unsafe(..)` 中，例如 `#[unsafe(no_mangle)]`。

以下属性是不安全的：

* [`export_name`] * [`link_section`] * [`naked`] * [`no_mangle`]

<a id="attributes.kind"></a> 属性可以分类为以下几种：

* [内置属性] * [Proc 宏 属性][attribute macros] * [Derive 宏 辅助属性] * [工具属性](#tool-attributes)

<a id="attributes.allowed-position"></a> 属性可以在语言中的多种形式中使用：

* 所有 [项声明] 接受外部属性，而 [外部块]、[函数]、[实现] 和 [模块] 则接受内部属性。 * 大多数 [语句] 接受外部属性（关于语句的限制请参见 [表达式属性]。） * [块表达式] 同时接受外部和内部属性，但仅当它们是 [表达式语句] 的外部表达式或另一个块表达式的最终表达式时。 * [枚举] 变体以及 [结构] 和 [联合] 字段接受外部属性。 * [匹配表达式分支][match expressions] 接受外部属性。 * [泛型生命周期或类型参数][generics] 接受外部属性。 * 在特定情况下，表达式也接受外部属性，详情请参见 [表达式属性]。 * [函数][functions]、[闭包] 和 [函数指针] 参数接受外部属性。这包括函数指针中用 `...` 表示的变长参数上的属性，以及 [外部块][variadic functions] 中的属性。 * [内联汇编] 模板字符串和操作数接受外部属性。只有某些属性在语义上被接受；详情请参见 [asm.attributes.supported-attributes]。

<a id="attributes.meta"></a>
## 元项属性语法

<a id="attributes.meta.intro"></a> “元项”是大多数 [内置属性] 用于 [Attr] 规则的语法。其语法规则如下：

<a id="attributes.meta.syntax"></a> 
```grammar,attributes
@root MetaItem ->
      SimplePath
    | SimplePath `=` Expression
    | SimplePath `(` MetaSeq? `)`

MetaSeq ->
    MetaItemInner ( `,` MetaItemInner )* `,`?

MetaItemInner ->
      MetaItem
    | Expression
```

<a id="attributes.meta.literal-expr"></a> 元项中的表达式必须宏展开为字面表达式，且不得包含整数或浮点类型后缀。非字面表达式的语句在语法上被接受（并可以传递给过程宏），但在解析后会被拒绝。

<a id="attributes.meta.order"></a> 请注意，如果属性出现在另一个宏中，它将在该外部宏之后展开。例如，以下代码将首先展开 `Serialize` 过程宏，而后者必须保留 `include_str!` 调用才能被展开：

```rust ignore
#[derive(Serialize)]
struct Foo {
    #[doc = include_str!("x.md")]
    x: u32
}
```

<a id="attributes.meta.order-宏"></a> 此外，属性中的宏只有在应用于该项的所有其他属性之后才会被展开：

```rust ignore
#[macro_attr1] // expanded first
#[doc = mac!()] // `mac!` is expanded fourth.
#[macro_attr2] // expanded second
#[derive(MacroDerive1, MacroDerive2)] // expanded third
fn foo() {}
```

<a id="attributes.meta.builtin"></a> 各种内置属性使用不同的元项语法子集来指定其输入。以下语法规则展示了一些常用的形式：

<a id="attributes.meta.builtin-syntax"></a> 
```grammar,attributes
@root MetaWord ->
    IDENTIFIER

MetaNameValueStr ->
    IDENTIFIER `=` (STRING_LITERAL | RAW_STRING_LITERAL)

@root MetaListPaths ->
    IDENTIFIER `(` ( SimplePath (`,` SimplePath)* `,`? )? `)`

@root MetaListIdents ->
    IDENTIFIER `(` ( IDENTIFIER (`,` IDENTIFIER)* `,`? )? `)`

@root MetaListNameValueStr ->
    IDENTIFIER `(` ( MetaNameValueStr (`,` MetaNameValueStr)* `,`? )? `)`
```

一些元项的示例如下：

风格 | 示例
------|--------
[MetaWord] | `no_std` [MetaNameValueStr] | `doc = "example"` [MetaListPaths] | `allow(unused, clippy::inline_always)` [MetaListIdents] | `macro_use(foo, bar)` [MetaListNameValueStr] | `link(name = "CoreFoundation", kind = "framework")`

<a id="attributes.activity"></a>
## 活跃与静态属性

<a id="attributes.activity.intro"></a> 一个属性要么是活跃的，要么是静态的。在属性处理过程中，*活跃属性*会从其所在的形式中移除，而*静态属性*则保持不变。

[`cfg`] 和 [`cfg_attr`] 属性是活跃的。[属性宏]也是活跃的。其他所有属性都是静态的。

<a id="attributes.tool"></a>
## 工具属性

<a id="attributes.tool.intro"></a> 编译器可能允许外部工具的属性，这些工具位于 [tool prelude] 中的各自模块中。属性路径的第一段是工具的名称，后面可以有一段或多段附加内容，其解释由该工具决定。

<a id="attributes.tool.ignored"></a> 当工具未使用时，该工具的属性会被接受而不会产生警告。当工具被使用时，工具负责处理并解释其属性。

<a id="attributes.tool.prelude"></a> 如果使用了 [`no_implicit_prelude`] 属性，则工具属性不可用。

```rust
// Tells the rustfmt tool to not format the following element.
#[rustfmt::skip]
struct S {
}

// Controls the "cyclomatic complexity" threshold for the clippy tool.
#[clippy::cyclomatic_complexity = "100"]
pub fn f() {}
```

> [!NOTE]
> `rustc` currently recognizes the tools "clippy", "rustfmt", "diagnostic", "miri", and "rust_analyzer".

<a id="attributes.builtin"></a>
## 内置属性索引

以下是所有内置属性的索引表。

- 条件编译 - [`cfg`] --- 控制条件编译。 - [`cfg_attr`] --- 有条件地包含属性。

- 测试 - [`test`] --- 将函数标记为测试。 - [`ignore`] --- 禁用测试函数。 - [`should_panic`] --- 指示测试应生成 panic。

- 派生 - [`derive`] --- 自动 trait 实现。 - [`automatically_derived`] --- 表示由 `derive` 创建的实现的标记。

- 宏 - [`macro_export`] --- 导出一个可用于跨 crate 的 `macro_rules` 宏。 - [`macro_use`] --- 扩大宏的可见性，或从其他 crate 导入宏。 - [`proc_macro`] --- 定义类似函数的宏。 - [`proc_macro_derive`] --- 定义派生宏。 - [`proc_macro_attribute`] --- 定义属性宏。

- 诊断选项 - [`allow`], [`expect`], [`warn`], [`deny`], [`forbid`] --- 修改默认的 lint 级别。 - [`deprecated`] --- 生成弃用提示。 - [`must_use`] --- 生成未使用值的 lint 警告。 - [`diagnostic::on_unimplemented`] --- 提示编译器在 trait 未被实现时输出特定错误消息。 - [`diagnostic::do_not_recommend`] --- 提示编译器在错误信息中不显示某个 trait 的实现。

- ABI、链接、符号和 FFI - [`link`] --- 通过 `extern` 块指定要链接的本地库。 - [`link_name`] --- 通过 `extern` 块指定函数或静态变量的符号名称。 - [`link_ordinal`] --- 通过 `extern` 块指定函数或静态变量的符号序号。 - [`no_link`] --- 禁止链接 extern crate。 - [`repr`] --- 控制类型布局。 - [`crate_type`] --- 指定 crate 的类型（库、可执行文件等）。 - [`no_main`] --- 禁用输出 `main` 符号。 - [`export_name`] --- 指定函数或静态变量的导出符号名称。 - [`link_section`] --- 指定用于函数或静态变量的对象文件部分。 - [`no_mangle`] --- 禁用符号名称编码。 - [`used`] --- 强制编译器在输出对象文件中保留静态项。 - [`crate_name`] --- 指定 crate 的名称。

- 代码生成 - [`inline`] --- 提示内联代码。 - [`cold`] --- 提示该函数不太可能被调用。 - [`naked`] --- 防止编译器输出函数序言和结尾部分。 - [`no_builtins`] --- 禁用某些内置函数的使用。 - [`optimize`] --- 建议函数的优化目标：大小、速度或无优化。 - [`target_feature`] --- 配置平台特定的代码生成。 - [`track_caller`] --- 将父调用位置传递给 `std::panic::Location::caller()`。 - [`instruction_set`] --- 指定用于生成函数代码的指令集。

- 文档 - `doc` --- 指定文档信息。有关更多信息，请参阅 [Rustdoc 手册]。[文档注释] 会被转换为 `doc` 属性。

- Preludes - [`no_std`] --- 从预演程中移除 std。 - [`no_implicit_prelude`] --- 禁用模块内的预演程查找。

- 模块 - [`path`] --- 指定模块的文件名。

- 限制 - [`recursion_limit`] --- 设置某些编译时操作的最大递归限制。 - [`type_length_limit`] --- 设置多态类型的最大大小。

- 运行时 - [`panic_handler`] --- 设置处理 panic 的函数。 - [`global_allocator`] --- 设置全局内存分配器。 - [`windows_subsystem`] --- 指定要链接的 Windows 子系统。

- 特性 - `feature` --- 用于启用不稳定的或实验性的编译器特性。有关在 `rustc` 中实现的特性，请参阅 [不稳定手册]。

- 类型系统 - [`non_exhaustive`] --- 表示某种类型将来会添加更多字段/变体。

- 调试器 - [`debugger_visualizer`] --- 嵌入指定类型调试输出的文件。 - [`collapse_debuginfo`] --- 控制宏调用在调试信息中的编码方式。

[`optimize`]: attributes.codegen.optimize
[`proc_macro_derive`]: macro.proc.derive

[Doc comments]: comments.md#doc-comments
[ECMA-334]: https://www.ecma-international.org/publications-and-standards/standards/ecma-334/
[ECMA-335]: https://www.ecma-international.org/publications-and-standards/standards/ecma-335/
[Expression Attributes]: expressions.md#expression-attributes
[The Rustdoc Book]: ../rustdoc/the-doc-attribute.html
[The Unstable Book]: ../unstable-book/index.html
[`allow`]: attributes/diagnostics.md#lint-check-attributes
[`automatically_derived`]: attributes/derive.md#the-automatically_derived-attribute
[`cfg_attr`]: conditional-compilation.md#the-cfg_attr-attribute
[`cfg`]: conditional-compilation.md#the-cfg-attribute
[`cold`]: attributes/codegen.md#the-cold-attribute
[`collapse_debuginfo`]: attributes/debugger.md#the-collapse_debuginfo-attribute
[`crate_name`]: crates-and-source-files.md#the-crate_name-attribute
[`crate_type`]: linkage.md
[`debugger_visualizer`]: attributes/debugger.md#the-debugger_visualizer-attribute
[`deny`]: attributes/diagnostics.md#lint-check-attributes
[`deprecated`]: attributes/diagnostics.md#the-deprecated-attribute
[`derive`]: attributes/derive.md
[`export_name`]: abi.md#the-export_name-attribute
[`expect`]: attributes/diagnostics.md#lint-check-attributes
[`forbid`]: attributes/diagnostics.md#lint-check-attributes
[`global_allocator`]: runtime.md#the-global_allocator-attribute
[`ignore`]: attributes/testing.md#the-ignore-attribute
[`inline`]: attributes/codegen.md#the-inline-attribute
[`instruction_set`]: attributes/codegen.md#the-instruction_set-attribute
[`link_name`]: items/external-blocks.md#the-link_name-attribute
[`link_ordinal`]: items/external-blocks.md#the-link_ordinal-attribute
[`link_section`]: abi.md#the-link_section-attribute
[`link`]: items/external-blocks.md#the-link-attribute
[`macro_export`]: macros-by-example.md#the-macro_export-attribute
[`macro_use`]: macros-by-example.md#the-macro_use-attribute
[`must_use`]: attributes/diagnostics.md#the-must_use-attribute
[`naked`]: attributes/codegen.md#the-naked-attribute
[`no_builtins`]: attributes/codegen.md#the-no_builtins-attribute
[`no_implicit_prelude`]: names/preludes.md#the-no_implicit_prelude-attribute
[`no_link`]: items/extern-crates.md#the-no_link-attribute
[`no_main`]: crates-and-source-files.md#the-no_main-attribute
[`no_mangle`]: abi.md#the-no_mangle-attribute
[`no_std`]: names/preludes.md#the-no_std-attribute
[`non_exhaustive`]: attributes/type_system.md#the-non_exhaustive-attribute
[`panic_handler`]: panic.md#the-panic_handler-attribute
[`path`]: items/modules.md#the-path-attribute
[`proc_macro_attribute`]: procedural-macros.md#the-proc_macro_attribute-attribute
[`proc_macro`]: procedural-macros.md#the-proc_macro-attribute
[`recursion_limit`]: attributes/limits.md#the-recursion_limit-attribute
[`repr`]: type-layout.md#representations
[`should_panic`]: attributes/testing.md#the-should_panic-attribute
[`target_feature`]: attributes/codegen.md#the-target_feature-attribute
[`test`]: attributes/testing.md#the-test-attribute
[`track_caller`]: attributes/codegen.md#the-track_caller-attribute
[`type_length_limit`]: attributes/limits.md#the-type_length_limit-attribute
[`used`]: abi.md#the-used-attribute
[`warn`]: attributes/diagnostics.md#lint-check-attributes
[`windows_subsystem`]: runtime.md#the-windows_subsystem-attribute
[attribute macros]: procedural-macros.md#the-proc_macro_attribute-attribute
[block expressions]: expressions/block-expr.md
[built-in attributes]: #built-in-attributes-index
[derive macro helper attributes]: procedural-macros.md#derive-macro-helper-attributes
[enum]: items/enumerations.md
[expression statement]: statements.md#expression-statements
[external blocks]: items/external-blocks.md
[functions]: items/functions.md
[generics]: items/generics.md
[implementations]: items/implementations.md
[item declarations]: items.md
[match expressions]: expressions/match-expr.md
[modules]: items/modules.md
[statements]: statements.md
[struct]: items/structs.md
[tool prelude]: names/preludes.md#tool-prelude
[union]: items/unions.md
[closure]: expressions/closure-expr.md
[function pointer]: types/function-pointer.md
[variadic functions]: items/external-blocks.html#variadic-functions
[`diagnostic::on_unimplemented`]: attributes/diagnostics.md#the-diagnosticon_unimplemented-attribute
[`diagnostic::do_not_recommend`]: attributes/diagnostics.md#the-diagnosticdo_not_recommend-attribute
[Inline assembly]: inline-assembly.md
