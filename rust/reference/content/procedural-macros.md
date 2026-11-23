<a id="宏.proc"></a>
# 过程式宏

<a id="宏.proc.intro"></a> *过程式宏*允许在函数执行时创建语法扩展。过程式宏有三种类型：

* [类函数式宏] - `custom!(...)` * [派生宏] - `#[derive(CustomDerive)]` * [属性式宏] - `#[CustomAttribute]`

过程式宏允许你在编译时运行针对 Rust 语法的代码，既消耗也产生 Rust 语法。你可以将过程式宏视为从 AST 到另一个 AST 的函数。

<a id="宏.proc.def"></a> 过程式宏必须在 `proc-macro` 的 [crate type] 下定义的 crate 的根目录中。这些宏不能在其定义所在的 crate 中使用，只能在其他 crate 中导入后使用。

> [!NOTE]
> When using Cargo, Procedural macro crates are defined with the `proc-macro` key in your manifest:
>
> ```toml
> [lib]
> proc-macro = true
> ```

<a id="宏.proc.result"></a> 作为函数，它们必须返回语法、引发 panic 或无限循环。返回的语法根据过程式宏的类型，要么替换要么添加该语法。panic 会被编译器捕获并转化为编译错误。无限循环则不会被编译器捕获，导致编译器卡死。

过程式宏在编译过程中运行，因此拥有与编译器相同的资源。例如，标准输入、错误和输出都是编译器可以访问的。同样，文件访问权限也是一样的。由于此原因，过程式宏存在与 [Cargo 构建脚本] 相同的安全问题。

<a id="宏.proc.error"></a> 过程式宏有两种报告错误的方式。第一种是引发 panic。第二种是调用 [`compile_error`] 宏。

<a id="宏.proc.proc_macro-crate"></a>
## `proc_macro` crate

<a id="宏.proc.proc_macro-crate.intro"></a> 过程式宏 crate 几乎总是会链接到编译器提供的 [`proc_macro` crate]。`proc_macro` crate 提供了编写过程式宏所需的类型以及简化操作的工具。

<a id="宏.proc.proc_macro-crate.token-stream"></a> 该库主要包含 [`TokenStream`] 类型。过程式宏是在 *token streams* 上操作，而不是 AST 节点，这对于编译器和过程式宏来说都是更稳定的接口。*token stream* 大致相当于 `Vec<TokenTree>`，其中 `TokenTree` 可以视为词法标记。例如，`foo` 是一个 `Ident` 标记，`.` 是一个 `Punct` 标记，而 `1.2` 则是一个 `Literal` 标记。`TokenStream` 类型与 `Vec<TokenTree>` 不同，克隆它很高效。

<a id="宏.proc.proc_macro-crate.span"></a> 所有标记都关联一个 `Span`。`Span` 是一个不可修改的 opaque 值，但可以创建。`Span` 表示程序中的一段源代码范围，主要用于错误报告。虽然无法修改 `Span` 本身，但总是可以更改与任何标记关联的 `Span`，例如通过从其他标记获取 `Span`。

<a id="宏.proc.hygiene"></a>
## 过程式宏的卫生性

过程式宏是 *不卫生* 的。这意味着它们的行为就像输出 token stream 直接被写入了旁边的代码一样。这意味着它们受到外部项的影响，也影响外部导入。

宏作者需要小心处理，以确保他们的宏能在尽可能多的环境中工作，考虑到这一限制。这通常包括使用库中项目的绝对路径（例如，`::std::option::Option` 而不是 `Option`），或者确保生成的函数的名称不太可能与其他函数冲突（如 `__internal_foo` 而不是 `foo`）。

<!-- TODO: rule name needs improvement -->
<!-- template:attributes -->
<a id="宏.proc.proc_macro"></a>
## `proc_macro` 属性

<a id="宏.proc.proc_macro.intro"></a> *`proc_macro` [属性][attributes]* 定义了一种 [函数式][attributes] 过程式宏。

> [!EXAMPLE]
> This macro definition ignores its input and emits a function `answer` into its scope.
>
> <!-- ignore: test doesn't support proc-macro -->
> ```rust,ignore
> # #![crate_type = "proc-macro"]
> extern crate proc_macro;
> use proc_macro::TokenStream;
>
> #[proc_macro]
> pub fn make_answer(_item: TokenStream) -> TokenStream {
>     "fn answer() -> u32 { 42 }".parse().unwrap()
> }
> ```
>
> We can use it in a binary crate to print "42" to standard output.
>
> <!-- ignore: requires external crates -->
> ```rust,ignore
> extern crate proc_macro_examples;
> use proc_macro_examples::make_answer;
>
> make_answer!();
>
> fn main() {
>     println!("{}", answer());
> }
> ```

<a id="宏.proc.proc_macro.syntax"></a> `proc_macro` 属性使用 [MetaWord] 语法。

<a id="宏.proc.proc_macro.allowed-positions"></a> `proc_macro` 属性只能应用于类型为 `fn(TokenStream) -> TokenStream` 的 `pub` 函数，其中 [`TokenStream`] 来自 [`proc_macro` crate]。该函数必须具有 ["Rust" ABI][items.fn.extern] 特性。不允许使用其他函数限定符。该函数必须位于 crate 的根目录中。

<a id="宏.proc.proc_macro.duplicates"></a> `proc_macro` 属性在函数中只能指定一次。

<a id="宏.proc.proc_macro.namespace"></a> `proc_macro` 属性会在 crate 根部的 [宏 namespace] 中公开定义该宏，其名称与函数相同。

<a id="宏.proc.proc_macro.behavior"></a> 对函数式过程式宏的类似函数调用会将宏调用中的分隔符内的内容作为输入 [`TokenStream`] 参数，并将整个宏调用替换为函数的输出 [`TokenStream__`]。

<a id="宏.proc.proc_macro.invocation"></a> 函数式过程式宏可以在任何宏调用位置被调用，包括：

- [语句] - [表达式] - [模式] - [类型表达式] - [项] 位置，包括 [`extern` 块中的项] - 固有类型和 trait [实现] - [trait 定义]

<!-- template:attributes -->
<a id="宏.proc.derive"></a>
## `proc_macro_derive` 属性

<a id="宏.proc.derive.intro"></a> 将 *`proc_macro_derive` [属性]* 应用于函数会定义一个 *derive 宏*，该宏可以通过 [`derive` 属性] 被调用。这些宏接收 [结构体]、[枚举] 或 [union] 定义的 token stream，并可以在其后生成新的 [项]。它们还可以声明和使用 [derive 宏 helper attributes]。

> [!EXAMPLE]
> This derive macro ignores its input and appends tokens that define a function.
>
> <!-- ignore: test doesn't support proc-macro -->
> ```rust,ignore
> # #![crate_type = "proc-macro"]
> extern crate proc_macro;
> use proc_macro::TokenStream;
>
> #[proc_macro_derive(AnswerFn)]
> pub fn derive_answer_fn(_item: TokenStream) -> TokenStream {
>     "fn answer() -> u32 { 42 }".parse().unwrap()
> }
> ```
>
> To use it, we might write:
>
> <!-- ignore: requires external crates -->
> ```rust,ignore
> extern crate proc_macro_examples;
> use proc_macro_examples::AnswerFn;
>
> #[derive(AnswerFn)]
> struct Struct;
>
> fn main() {
>     assert_eq!(42, answer());
> }
> ```

<a id="宏.proc.derive.syntax"></a> `proc_macro_derive` 属性的语法如下：

```grammar,attributes
@root ProcMacroDeriveAttribute ->
    `proc_macro_derive` `(` DeriveMacroName ( `,` DeriveMacroAttributes )? `,`? `)`

DeriveMacroName -> IDENTIFIER

DeriveMacroAttributes ->
    `attributes` `(` ( IDENTIFIER (`,` IDENTIFIER)* `,`?)? `)`
```

Derive 宏的名称由 [DeriveMacroName] 给出。可选的 `attributes` 参数在 [宏.proc.derive.attributes] 中有描述。

<a id="宏.proc.derive.allowed-positions"></a> `proc_macro_derive` 属性只能应用于具有 [Rust ABI][items.fn.extern] 的 `pub` 函数，该函数的类型为 `fn(TokenStream) -> TokenStream`，其中 [`TokenStream`] 来自 [`proc_macro` crate]。该函数可以是 `const` 类型，并可以使用 `extern` 显式指定 Rust ABI，但不得使用其他 [qualifiers][FunctionQualifiers]（例如不能是 `async` 或 `unsafe`）。

<a id="宏.proc.derive.duplicates"></a> `proc_macro_derive` 属性在函数上只能使用一次。

<a id="宏.proc.derive.namespace"></a> `proc_macro_derive` 属性在 crate 的根目录的 [宏 namespace] 中公开定义派生宏。

<a id="宏.proc.derive.output"></a> 输入 [`TokenStream`] 是应用 `derive` 属性的项的标记流。输出 [`TokenStream`] 必须是一个（可能为空）项集。这些项会在同一 [module] 或 [block] 内跟随输入项添加。

<a id="宏.proc.derive.attributes"></a>
### 派生宏辅助属性

<a id="宏.proc.derive.attributes.intro"></a> 派生宏可以声明 *派生宏辅助属性*，以便在应用派生宏的 [item] 的作用域内使用。这些 [attributes] 是 [非活动] 的。虽然它们的目的是被声明它们的宏使用，但任何宏都可以看到它们。

<a id="宏.proc.derive.attributes.decl"></a> 通过将标识符添加到 `proc_macro_derive` 属性的 `attributes` 列表中，可以声明派生宏的辅助属性。

> [!EXAMPLE]
> This declares a helper attribute and then ignores it.
>
> <!-- ignore: test doesn't support proc-macro -->
> ```rust,ignore
> # #![crate_type="proc-macro"]
> # extern crate proc_macro;
> # use proc_macro::TokenStream;
> #
> #[proc_macro_derive(WithHelperAttr, attributes(helper))]
> pub fn derive_with_helper_attr(_item: TokenStream) -> TokenStream {
>     TokenStream::new()
> }
> ```
>
> To use it, we might write:
>
> <!-- ignore: requires external crates -->
> ```rust,ignore
> #[derive(WithHelperAttr)]
> struct Struct {
>     #[helper] field: (),
> }
> ```

<a id="宏.proc.derive.attributes.scope"></a> 当将派生宏调用应用于项时，该派生宏引入的辅助属性成为以下范围之一：1) 对于应用于该项且在派生宏调用后按词法顺序应用的属性；以及 2) 对于应用于该项内的字段和变体的属性。

> [!NOTE]
> rustc currently allows derive helpers to be used before the macro that introduces them. Such derive helpers used out of order may not shadow other attribute macros. This behavior is deprecated and slated for removal.
>
> <!-- ignore: requires external crates -->
> ```rust,ignore
> #[helper] // Deprecated, hard error in the future.
> #[derive(WithHelperAttr)]
> struct Struct {
>     field: (),
> }
> ```
>
> For more details, see [Rust issue #79202](https://github.com/rust-lang/rust/issues/79202).


<!-- template:attributes -->
<a id="宏.proc.attribute"></a>
## `proc_macro_attribute` 属性

<a id="宏.proc.attribute.intro"></a> *`proc_macro_attribute` [属性][attributes]* 定义了一个可作为 [外部属性][attributes] 使用的 *属性宏*。

> [!EXAMPLE]
> This attribute macro takes the input stream and emits it as-is, effectively being a no-op attribute.
>
> <!-- ignore: test doesn't support proc-macro -->
> ```rust,ignore
> # #![crate_type = "proc-macro"]
> # extern crate proc_macro;
> # use proc_macro::TokenStream;
>
> #[proc_macro_attribute]
> pub fn return_as_is(_attr: TokenStream, item: TokenStream) -> TokenStream {
>     item
> }
> ```

> [!EXAMPLE]
> This shows, in the output of the compiler, the stringified [`TokenStream`s] that attribute macros see.
>
> <!-- ignore: test doesn't support proc-macro -->
> ```rust,ignore
> // my-macro/src/lib.rs
> # extern crate proc_macro;
> # use proc_macro::TokenStream;
> #[proc_macro_attribute]
> pub fn show_streams(attr: TokenStream, item: TokenStream) -> TokenStream {
>     println!("attr: \"{attr}\"");
>     println!("item: \"{item}\"");
>     item
> }
> ```
>
> <!-- ignore: requires external crates -->
> ```rust,ignore
> // src/lib.rs
> extern crate my_macro;
>
> use my_macro::show_streams;
>
> // Example: Basic function.
> #[show_streams]
> fn invoke1() {}
> // out: attr: ""
> // out: item: "fn invoke1() {}"
>
> // Example: Attribute with input.
> #[show_streams(bar)]
> fn invoke2() {}
> // out: attr: "bar"
> // out: item: "fn invoke2() {}"
>
> // Example: Multiple tokens in the input.
> #[show_streams(multiple => tokens)]
> fn invoke3() {}
> // out: attr: "multiple => tokens"
> // out: item: "fn invoke3() {}"
>
> // Example: Delimiters in the input.
> #[show_streams { delimiters }]
> fn invoke4() {}
> // out: attr: "delimiters"
> // out: item: "fn invoke4() {}"
> ```

<a id="宏.proc.attribute.syntax"></a> `proc_macro_attribute` 属性使用 [MetaWord] 语法。

<a id="宏.proc.attribute.allowed-positions"></a> `proc_macro_attribute` 属性只能应用于类型为 `fn(TokenStream, TokenStream) -> TokenStream` 的 `pub` 函数，其中 [`TokenStream`] 来自 [`proc_macro` crate]。该函数必须具有 ["Rust" ABI][items.fn.extern]。不允许使用其他函数限定符。该函数必须位于 crate 的根目录中。

<a id="宏.proc.attribute.duplicates"></a> `proc_macro_attribute` 属性在函数中只能指定一次。

<a id="宏.proc.attribute.namespace"></a> `proc_macro_attribute` 属性在 crate 根目录的 [宏命名空间] 中定义，其名称与函数相同。

<a id="宏.proc.attribute.use-positions"></a> 属性宏只能应用于：

- [Items] - [`extern` 块中的项] - 固有类型和 trait [实现] - [trait 定义]

<a id="宏.proc.attribute.inner"></a> 属性宏不能用作 [内部属性]。

<a id="宏.proc.attribute.outline-mod"></a> 对于宏输入中存在的任何 [Outline modules]，仅传递模块声明的标记；模块的文件内容不会被加载或包含在输入中。

<a id="宏.proc.attribute.behavior"></a> 第一个 [`TokenStream`] 参数是跟随属性名称但不包含外部分隔符的限定标记树。如果所应用的属性仅包含属性名称或属性名称后跟空分隔符，则 [`TokenStream`] 为空。

第二个 [`TokenStream`] 是 [项] 的其余部分，包括 [项] 上的其他 [属性]。

应用该属性的 [项] 将被返回的 [`TokenStream`] 中的零个或多个 [项] 替换。

<a id="宏.proc.token"></a>
## 声明式宏标记和过程式宏标记

<a id="宏.proc.token.intro"></a> 声明式 `macro_rules` 宏与过程式宏在令牌的定义上相似，但有所不同（实际上是 [`TokenTree`s]`）。

<a id="宏.proc.token.macro_rules"></a> `macro_rules` 中的 Token Tree（对应于 `tt` 匹配器）被定义为： - 分隔组（`(...)`、`{...}` 等） - 语言支持的所有运算符，包括单字符和多字符运算符（`+`、`+=`） - 注意该集合不包括单个引号 `'`。 - 字面量（`"string"`、`1` 等） - 需要注意的是，否定符号（例如 `-1`）从来不是此类字面量令牌的一部分，而是作为一个独立的运算符令牌。 - 标识符，包括关键字（`ident`、`r#ident`、`fn`） - 生命周期（`'ident`） - `macro_rules` 中的元变量替换（例如在 `macro_rules! mac { ($my_expr: expr) => { $my_expr } }` 中，`mac` 展开后，`$my_expr` 将被视为一个单独的 Token Tree，无论传入的表达式如何）。

<a id="宏.proc.token.tree"></a> 过程式宏中的 Token Tree 被定义为： - 分隔组（`(...)`、`{...}` 等） - 语言支持的所有运算符使用的标点符号（包括 `+`，但不包括 `+=`），以及单个引号 `'` 字符（通常用于 生命周期，详见下面的 生命周期 分割和连接行为） - 字面量（`"string"`、`1` 等） - 否定符号（例如 `-1`）作为整数和浮点字面量的组成部分被支持。 - 标识符，包括关键字（`ident`、`r#ident`、`fn`）。

<a id="宏.proc.token.conversion.intro"></a> 当 Token Stream 被传递给过程式宏时，这两种定义之间的不匹配会被处理。请注意，以下转换可能是延迟发生的，因此如果令牌实际上未被检查，这些转换可能不会发生。

<a id="宏.proc.token.conversion.to-proc_macro"></a> 当传递给过程宏时 - 所有多字符运算符会被拆分为单字符。 - 生命周期 被拆分为一个 `'` 字符和一个标识符。 - 关键字 metavariable [`$crate`] 作为单个标识符传递。 - 其他所有的 metavariable 替换都表示为其对应的 token 流。 - 为了保留解析优先级，这些 token 流可以被包裹在带隐含分隔符 ([`Delimiter::None`]) 的 delimited 组中 ([`Group`])。 - `tt` 和 `ident` 的替换永远不会被包裹在这些组中，而是始终表示为其对应的 token 树。

<a id="宏.proc.token.conversion.from-proc_macro"></a> 当从过程宏发出时 - 在适用的情况下，标点符号会被合并为多字符运算符。 - 单引号 `'` 与标识符结合后会被合并为 生命周期。 - 负字面量会被转换为两个 token（`-` 和字面量），在需要保留解析优先级时，这些 token 可以被包裹在带隐含分隔符 ([`Delimiter::None`]) 的 delimited 组中([`Group`])。

<a id="宏.proc.token.doc-comment"></a> 请注意，无论是声明式宏还是过程式宏都不支持文档注释令牌（例如 `/// Doc`），因此当它们被传递给宏时，总是会被转换为表示其等效 `#[doc = r"str"]` 属性的 token 流。

[Derive macros]: macro.proc.derive
[`$crate`]: macro.decl.hygiene.crate
[`Delimiter::None`]: proc_macro::Delimiter::None
[`Group`]: proc_macro::Group
[`TokenStream`]: proc_macro::TokenStream
[`TokenStream`s]: proc_macro::TokenStream
[`TokenTree`s]: proc_macro::TokenTree
[`proc_macro` crate]: proc_macro
[inner attribute]: attributes.inner
[outline modules]: items.mod.outlined

[Attribute macros]: #the-proc_macro_attribute-attribute
[Cargo's build scripts]: ../cargo/reference/build-scripts.html
[Function-like macros]: #the-proc_macro-attribute
[`derive` attribute]: attributes/derive.md
[`extern` blocks]: items/external-blocks.md
[`macro_rules`]: macros-by-example.md
[attribute]: attributes.md
[attributes]: attributes.md
[block]: expressions/block-expr.md
[crate type]: linkage.md
[derive macro helper attributes]: #derive-macro-helper-attributes
[enum]: items/enumerations.md
[expressions]: expressions.md
[function]: items/functions.md
[implementations]: items/implementations.md
[inert]: attributes.md#active-and-inert-attributes
[item]: items.md
[items]: items.md
[macro namespace]: names/namespaces.md
[module]: items/modules.md
[patterns]: patterns.md
[public]: visibility-and-privacy.md
[statements]: statements.md
[struct]: items/structs.md
[trait definitions]: items/traits.md
[type expressions]: types.md#type-expressions
[type]: types.md
[union]: items/unions.md
