<a id="crate"></a>
# 库与源文件

<a id="crate.syntax"></a> 
```grammar,items
@root Crate ->
    InnerAttribute*
    Item*
```

> [!NOTE] > 尽管Rust像其他语言一样，既可以通过解释器实现，也可以通过编译器实现，但目前存在的唯一实现是编译器，且该语言一直被设计为需要编译。因此，本节假设使用编译器。

<a id="crate.compile-time"></a> Rust的语义遵循编译时与运行时之间的*阶段区分*。[^phase-distinction] 具有*静态解释*的语义规则决定编译的成功或失败，而具有*动态解释*的语义规则则决定程序在运行时的行为。

<a id="crate.unit"></a> 编译模型以称为_库_的工件为中心。每次编译都处理一个源形式的单个库，如果成功，则生成二进制形式的单个库：即可执行文件或某种库。[^cratesourcefile]

<a id="crate.module"></a> _库_是编译和链接、版本管理、分发以及运行时加载的单位。一个库包含嵌套的[模块]范围的树结构。该树的顶层是一个匿名模块（从模块内路径的角度来看），而库中的任何项目都有一个规范的[模块路径]，表示其在库模块树中的位置。

<a id="crate.input-source"></a> Rust编译器总是以单个源文件作为输入，并始终生成一个单独的输出库。对该源文件的处理可能导致其他源文件作为模块被加载。源文件的扩展名为`.rs`。

<a id="crate.module-def"></a> Rust源文件描述了一个模块，其名称和位置——在当前库的模块树中——是在源文件外部定义的：要么通过引用源文件中的显式[模块][grammar-Module]项，要么通过库本身的名称来定义。

<a id="crate.inline-module"></a> 每个源文件都是一个模块，但并非所有模块都需要自己的源文件：[模块定义]可以嵌套在一个文件中。

<a id="crate.items"></a> 每个源文件包含零个或更多个 [Item] 定义，并可以可选地以任意数量的适用于包含模块的 [attributes] 开始，其中大多数会影响编译器的行为。

<a id="crate.attributes"></a> 匿名 crate 模块可以具有适用于整个 crate 的额外属性。

> [!NOTE] > 文件内容前可能有一个 [shebang]。

```rust
// Specify the crate name.
#![crate_name = "projx"]

// Specify the type of output artifact.
#![crate_type = "lib"]

// Turn on a warning.
// This can be done in any module, not just the anonymous crate module.
#![warn(non_camel_case_types)]
```

<a id="crate.main"></a>
## 主函数

<a id="crate.main.executable"></a> 包含 `main` [function] 的 crate 可以编译成可执行程序。

<a id="crate.main.restriction"></a> 如果存在 `main` 函数，则必须不接受任何参数，不得声明任何 [trait 或 生命周期 bounds]，不得有任何 [where clauses]，且其返回类型必须实现 [`Termination`] trait。

```rust
fn main() {}
```
```rust
fn main() -> ! {
    std::process::exit(0);
}
```
```rust
fn main() -> impl std::process::Termination {
    std::process::ExitCode::SUCCESS
}
```

<a id="crate.main.import"></a> `main` 函数可以是一个导入项，例如来自外部 crate 或当前 crate。

```rust
mod foo {
    pub fn bar() {
        println!("Hello, world!");
    }
}
use foo::bar as main;
```

> [!NOTE] > 标准库中具有 [`Termination`]实现的类型包括： > > * `()` > * [`!`] > * [`Infallible`] > * [`ExitCode`] > * `Result<T, E> where T: Termination, E: Debug`

<!-- If the previous section needs updating (from "must take no arguments"
  之后，也请在 testing.md 文件中更新它 -->

<a id="crate.uncaught-foreign-unwinding"></a>
### 未捕获的 foreign unwinding

当“foreign” unwind（例如从 C++ 代码抛出的异常，或使用不同 panic 处理器的 Rust 代码中的 `panic!`）传播到 `main` 函数之外时，进程将安全终止。这可能以中止的形式出现，在这种情况下无法保证任何 `Drop` 调用会被执行，且错误输出可能不如“原生”Rust `panic` 导致运行时终止时那样具有信息性。

有关更多信息，请参阅 [panic documentation][panic-docs]。

<a id="crate.no_main"></a>
### `no_main` 属性

*`no_main` [attribute]* 可以在 crate 级别应用，以禁用可执行二进制文件输出 `main` 符号。当某些其他被链接的对象定义了 `main` 时，这非常有用。

<a id="crate.crate_name"></a>
## `crate_name` 属性

<a id="crate.crate_name.general"></a> *`crate_name` [属性]* 可以在 crate 级别应用，以使用 [MetaNameValueStr] 语法指定 crate 的名称。

```rust
#![crate_name = "mycrate"]
```

<a id="crate.crate_name.restriction"></a> crate 名称不得为空，且只能包含 [Unicode alphanumeric] 或 `_` (U+005F) 字符。

[Unicode alphanumeric]: char::is_alphanumeric
[`ExitCode`]: std::process::ExitCode
[`Infallible`]: std::convert::Infallible
[`Termination`]: std::process::Termination

[`!`]: types/never.md
[attribute]: attributes.md
[attributes]: attributes.md
[function]: items/functions.md
[module]: items/modules.md
[module path]: paths.md
[panic-docs]: panic.md#unwinding-across-ffi-boundaries
[shebang]: shebang.md
[trait or lifetime bounds]: trait-bounds.md
[where clauses]: items/generics.md#where-clauses
