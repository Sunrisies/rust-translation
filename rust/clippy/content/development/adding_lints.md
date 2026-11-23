# 添加新lint

您来到这里可能是因为想要在 Clippy 中添加一个新的 lint。如果您是第一次为 Clippy 贡献代码，本文档将指导您从零开始创建示例 lint。

为了开始工作，我们将创建一个能够检测名为 `foo` 的函数的 lint，因为这是一个明显不具描述性的名称。

- [添加新lint](#adding-a-new-lint) - [设置](#setup) - [入门指南](#getting-started) - [定义我们的lint](#defining-our-lint) - [独立运行](#standalone) - [特定类型](#specific-type) - [测试位置](#tests-location) - [测试](#testing) - [Cargo lint](#cargo-lints) - [Rustfix 测试](#rustfix-tests) - [手动测试](#testing-manually) - [lint 声明](#lint-declaration) - [lint 注册](#lint-registration) - [lint 通过阶段](#lint-passes) - [生成lint](#emitting-a-lint) - [添加lint逻辑](#adding-the-lint-logic) - [指定lint支持的最低 Rust 版本（MSRV）](#specifying-the-lints-minimum-supported-rust-version-msrv) - [作者lint](#author-lint) - [打印 HIR lint](#print-hir-lint) - [文档](#documentation) - [运行 rustfmt](#running-rustfmt) - [调试](#debugging) - [冲突的lint](#conflicting-lints) - [PR 检查清单](#pr-checklist) - [向lint添加配置](#adding-configuration-to-a-lint) - [速查表](#cheat-sheet)

## Setup

请参阅 [基础](basics.md#get-the-code) 文档。

## 入门指南

在创建新lint时，需要一些样板代码进行设置。幸运的是，您可以使用 Clippy 开发工具来自动处理此过程。我们将新lint命名为 `foo_functions`（lint通常采用蛇形命名法），且不需要类型信息，因此它将具有早期通过阶段类型（稍后会详细说明）。如果您不确定所选名称是否适合该lint，请参考我们的 [lint命名指南][lint_naming]。

## 定义我们的lint 有两种方式可以开始。

### 独立命令：`cargo dev new_lint --name=foo_functions --pass=early --category=pedantic`（如果未指定，则默认类别为 nursery）

此命令将创建新文件：`clippy_lints/src/foo_functions.rs`，同时还会[注册该lint](#lint-registration)。

### 特定类型命令： `cargo dev new_lint --name=foo_functions --type=functions --category=pedantic`

此命令将创建新文件：`clippy_lints/src/{type}/foo_functions.rs`。

请注意，此命令使用了 `--type` 标志而非 `--pass`。与独立定义不同，这种lint不会以传统方式被注册。相反，您需要在 `clippy_lints/src/{type}/mod.rs` 中的类型 lint pass 中调用该lint。

“类型”只是 `clippy_lints/src` 中目录的名称，例如示例命令中的 `functions`。这些是具有共同行为的lint的分组，因此如果您的lint属于某个类型，最好将其添加到该类型中。

### 测试文件位置 两种命令都将创建文件：`tests/ui/foo_functions.rs`。对于 cargo lints，默认会在 `tests/ui-cargo` 下创建两个项目层次结构（失败/通过）。

接下来，我们将打开这些文件并添加我们的lint！

## Testing

让我们先编写一些测试，以便在迭代 lint时能够执行。

Clippy使用UI测试来进行测试。UI测试检查Clippy的输出是否符合预期。每个测试只是一个包含我们要检查的代码的普通Rust文件。Clippy的输出会与 `.stderr` 文件进行比较。请注意，您无需自己创建此文件，我们将在后面进一步介绍如何生成 `.stderr` 文件。

我们首先打开在 `tests/ui/foo_functions.rs` 中创建的测试文件。

用一些示例更新文件以开始使用：

```rust
#![allow(unused)]
#![warn(clippy::foo_functions)]

// Impl methods
struct A;
impl A {
    pub fn fo(&self) {}
    pub fn foo(&self) {}
    //~^ foo_functions
    pub fn food(&self) {}
}

// Default trait methods
trait B {
    fn fo(&self) {}
    fn foo(&self) {}
    //~^ foo_functions
    fn food(&self) {}
}

// Plain functions
fn fo() {}
fn foo() {}
//~^ foo_functions
fn food() {}

fn main() {
    // We also don't want to lint method calls
    foo();
    let a = A;
    a.foo();
}
```

请注意，我们在预期出现错误的行上添加带有lint名称的注释。除了非常特殊的情况（`//@check-pass`）外，测试文件中必须至少有一个错误标记才能被接受。

一旦实现了我们的lint，可以运行 `TESTNAME=foo_functions cargo uibless` 来生成 `.stderr` 文件。如果我们的lint使用结构化建议，此命令还将生成相应的 `.fixed` 文件。

在实施我们的lint功能时，我们可以继续运行UI测试。这样我们可以通过检查每次测试运行时更新的`.stderr`文件来确认输出是否符合预期。

一旦实现了lint功能，运行 `TESTNAME=foo_functions cargo uitest` 应该能够独立通过测试。当提交lint代码时，还需要提交生成的`.stderr`文件和适用的`.fixed`文件。通常，只应提交由 `cargo bless` 更改的文件，用于创建或编辑特定的lint。

> [!NOTE] > 可以通过指定逗号分隔的列表来运行多个测试文件：> `TESTNAME=foo_functions,test2,test3`。

### Cargo lints

对于Cargo lints，测试过程有所不同，因为我们关注`Cargo.toml`清单文件。我们还需要与该清单相关联的一个最小crate。

如果我们的新lint名为例如`foo_categories`，运行 `cargo dev new_lint --name=foo_categories --type=cargo --category=cargo`后，默认会生成两个新的crate，每个crate都包含其清单文件：

* `tests/ui-cargo/foo_categories/fail/Cargo.toml`: 此文件应导致新lint引发错误。 * `tests/ui-cargo/foo_categories/pass/Cargo.toml`: 此文件不应触发lint。

如果需要更多用例，可以复制其中一个crate（位于`foo_categories`下）并重新命名它。

生成`.stderr`文件的过程相同，在`cargo uitest`前加上`TESTNAME`变量也有效。

## Rustfix tests

如果正在开发的lint使用结构化建议，测试将通过运行[rustfix]为该测试创建`.fixed`文件。Rustfix会将lint的建议应用到测试文件的代码中，并与`.fixed`文件的内容进行比较。

在运行测试时，可以使用`cargo bless`自动生成`.fixed`文件。


## 手动测试

如果你添加了一些 `println!` 代码，导致测试套件的输出难以阅读，那么针对示例文件进行手动测试会很有帮助。要在本地修改后使用 Clippy 进行测试，请从 Clippy 目录中运行以下命令：

```bash
cargo dev lint input.rs
```

如果你想在现有项目而不是单个文件中运行 Clippy，可以使用

```bash
cargo dev lint /path/to/project
```

或者设置一个 rustup 工具链来指向本地的 Clippy 二进制文件

```bash
cargo dev setup toolchain

# Then in `/path/to/project` you can run
cargo +clippy clippy
```

## lint 声明

首先打开 `clippy_lints` crate 中创建的新文件 `clippy_lints/src/foo_functions.rs`。这是所有 lint 代码所在的 crate。此文件中已经导入了一些我们所需的初始内容：

```rust
use rustc_lint::{EarlyLintPass, EarlyContext};
use rustc_session::declare_lint_pass;
use rustc_ast::ast::*;
```

下一步是更新 lint 声明。使用 [`declare_clippy_lint!`][declare_clippy_lint] 宏来声明 lint，我们只需要更新自动生成的 lint 声明，使其具有实际的描述信息，例如：

```rust
declare_clippy_lint! {
    /// ### What it does
    ///
    /// ### Why is this bad?
    ///
    /// ### Example
    /// ```rust
    /// // example code
    /// ```
    #[clippy::version = "1.29.0"]
    pub FOO_FUNCTIONS,
    pedantic,
    "function named `foo`, which is not a descriptive name"
}
```

* 以 `///` 开头的行部分构成了 lint 文档部分。这是默认的文档格式，将在浏览器中显示[如此所示][example_lint_page]。要在本地通过浏览器查看和打开此文档，运行 `cargo dev serve`。 * `#[clippy::version]` 属性将作为 lint 文档的一部分显示。该值应设置为 lint 开发所使用的当前 Rust 版本，可以通过在 rust-Clippy 目录中运行 `rustc -vV` 来获取。该版本列在 *release* 部分。（使用没有 `-nightly` 后缀的版本）。 * `FOO_FUNCTIONS` 是我们的 lint 名称。在命名 lint 时，请务必遵循[lint 命名指南][lint_naming]。简而言之，名称应明确说明被检查的内容，并且当与 `allow`/`warn`/`deny` 一起使用时易于阅读。 * `pedantic` 将 lint 级别设置为 `Allow`。具体的映射关系可以在[此处][category_level_mapping]找到。 * 最后一部分应为解释代码中具体错误内容的文本。

此文件的其余部分包含我们 lint 通道的空实现，在这种情况下即为 `EarlyLintPass`，其样子应如下：

```rust
// clippy_lints/src/foo_functions.rs

// .. imports and lint declaration ..

declare_lint_pass!(FooFunctions => [FOO_FUNCTIONS]);

impl EarlyLintPass for FooFunctions {}
```


## lint 注册

当使用 `cargo dev new_lint` 时， lint 会自动被注册，无需额外操作。

当手动声明新 lint 并使用 `cargo dev update_lints` 时，可能需要手动在 `clippy_lints/src/lib.rs` 中的 `early_lint_methods!` 宏调用中添加条目以注册该 lint 流程：

```rust,ignore
FooFunctions: foo_functions::FooFunctions = foo_functions::FooFunctions,
```

正如预期，也有相应的 `late_lint_methods!` 宏可用。如果不在 `early_lint_methods!` 或 `late_lint_methods!` 中添加条目，所涉及的 lint 流程将不会运行。

`cargo dev update_lints` 不自动执行此步骤的原因之一是，多个 lint 可以共享同一个 lint 流程，因此注册 lint 流程可能已在添加新 lint 时完成。另一个原因是，流程的排列顺序决定了实际运行的顺序，进而影响输出 lint 的顺序。

## lint 流程

编写一个仅检查函数名称的 lint 意味着我们只需处理 AST，而无需涉及类型系统。这很好，因为使得编写此类 lint 更加简单。

我们必须对每个新的 Clippy lint 做出此决定。最终选择是使用 [`EarlyLintPass`][early_lint_pass] 还是 [`LateLintPass"][late_lint_pass]。

`EarlyLintPass` 在类型检查之前和 [HIR](https://rustc-dev-guide.rust-lang.org/hir.html) 优化阶段运行，而 `LateLintPass` 在这些阶段之后运行，可以访问类型信息。`cargo dev new_lint` 命令默认使用推荐的 `LateLintPass`，但如果您的 lint 仅需要 AST 级别分析，则可以指定 `--pass=early`。

由于我们不需要类型信息来验证函数名称，我们在运行新的lint自动化工具时使用了 `--pass=early` 参数，并且相应地添加了所有导入项。


## 生成 lint 报告

有了 UI 测试和 lint 声明后，我们可以开始实现 lint 逻辑的具体实现。

让我们先从 `FooFunctions` 的 `EarlyLintPass` 开始实现：

```rust,ignore
impl EarlyLintPass for FooFunctions {
    fn check_fn(&mut self, cx: &EarlyContext<'_>, fn_kind: FnKind<'_>, span: Span, _: NodeId) {
        // TODO: Emit lint here
    }
}
```

我们实现了 [`early_lint_pass`] trait 中的 [`check_fn`][check_fn] 方法。这使我们能够获取当前正在被检查函数的各种信息。更多内容将在下一节中介绍。我们先不纠结于细节，首先为所有函数定义生成 lint 报告。

根据我们希望 lint 消息的复杂程度，我们可以选择多种不同的 lint 报告函数。这些函数都位于 [`clippy_utils/src/diagnostics.rs`][diagnostics]中。

在这种情况下，`span_lint_and_help` 似乎最为合适。它允许我们提供额外的帮助信息，而且我们无法自动建议更好的名称。其实现如下：

```rust,ignore
impl EarlyLintPass for FooFunctions {
    fn check_fn(&mut self, cx: &EarlyContext<'_>, fn_kind: FnKind<'_>, span: Span, _: NodeId) {
        span_lint_and_help(
            cx,
            FOO_FUNCTIONS,
            span,
            "function named `foo`",
            None,
            "consider using a more meaningful name"
        );
    }
}
```

现在运行 UI 测试应该会生成包含 lint 消息的输出。

根据 [rustc-dev-guide]，文本应客观简洁，避免大写字母和句号，除非需要多句描述。当代码或标识符必须出现在消息或标签中时，应使用单重重音符号 \` 进行标记。


## 添加 lint 逻辑

你的 lint 逻辑编写方式很可能与我们示例不同，因此本部分内容较为简短。

使用 [`check_fn`][check_fn] 方法可以访问具有 [`FnKind`][fn_kind] 变体 [`FnKind::Fn`] 的函数/method。它通过一个 [`Ident]][ident] 提供对函数/方法的名称的访问。

这样我们就可以扩展我们的 `check_fn` 方法：

```rust
impl EarlyLintPass for FooFunctions {
    fn check_fn(&mut self, cx: &EarlyContext<'_>, fn_kind: FnKind<'_>, span: Span, _: NodeId) {
        if is_foo_fn(fn_kind) {
            span_lint_and_help(
                cx,
                FOO_FUNCTIONS,
                span,
                "function named `foo`",
                None,
                "consider using a more meaningful name"
            );
        }
    }
}
```

我们将 lint 条件与 lint 输出分开，因为这样做使代码更易于阅读。在某些情况下，这种分离还可以让我们为单独的函数编写一些单元测试（而不仅仅是 UI 测试）。

在我们的示例中，`is_foo_fn` 看起来像这样：

```rust
// use statements, impl EarlyLintPass, check_fn, ..

fn is_foo_fn(fn_kind: FnKind<'_>) -> bool {
    match fn_kind {
        FnKind::Fn(_, _, Fn { ident, .. }) => {
            // check if `fn` name is `foo`
            ident.name.as_str() == "foo"
        }
        // ignore closures
        FnKind::Closure(..) => false
    }
}
```

现在我们应该使用 `cargo test` 运行完整的测试套件。此时运行 `cargo test` 应该会产生预期的输出。记得运行 `cargo bless` 以更新 `.stderr` 文件。

`cargo test`（而不是 `cargo uitest`）还将确保我们的 lint 实现没有违反任何 Clippy lints。

这就是 lint 实现的全部内容。现在运行 `cargo test` 应该会通过。


## 指定 lint 支持的最低 Rust 版本 (MSRV)

有时，lint 会提出需要特定版本 Rust 的建议。例如，`manual_strip` lint 建议使用 `str::strip_prefix` 和 `str::strip_suffix`，这些功能仅在 Rust 1.45 之后可用。在这种情况下，你需要确保项目配置的 MSRV 大于等于所需 Rust 特性的 MSRV。如果某个建议中使用了多个特性，请选择能够支持所有特性的 MSRV。

首先，在 [`clippy_utils::msrvs`] 中添加所需特性的 MSRV 别名。之后可以像 `msrvs::STR_STRIP_PREFIX` 这样访问该别名。

```rust
msrv_aliases! {
    ..
    1,45,0 { STR_STRIP_PREFIX }
}
```

为了访问项目配置的 MSRV，你需要在 LintPass 结构中有一个 `msrv` 字段，以及用于初始化该字段的构造函数。`clippy_lints/lib.rs` 中的构造函数会传递 `msrv` 值给该构造函数。

```rust
pub struct ManualStrip {
    msrv: Msrv,
}

impl ManualStrip {
    pub fn new(conf: &'static Conf) -> Self {
        Self { msrv: conf.msrv.into() }
    }
}
```

然后可以使用 `Msrv::meets` 方法将项目的 MSRV 与 LintPass 中的功能 MSRV 进行匹配。

``` rust
if !self.msrv.meets(cx, msrvs::STR_STRIP_PREFIX) {
    return;
}
```

一个重要的考虑点是，如果 crate 具有 `clippy::msrv` 属性，调用 `Msrv::meets` 会相对消耗资源较多，因此通常应在 if let 链的其他短路检查之后，在匹配 MSRV 的最后一步执行。

早期的 lint 流程应使用结合 `extract_msrv_attr!()` 的 `MsrvStack`。

一旦 `msrv` 被添加到 lint 中，就应该在 lint 的测试文件 `tests/ui/manual_strip.rs` 中添加相关的测试用例。该文件应包含一个针对低于 MSRV 版本的用例，以及一个包含相同内容但针对 MSRV 版本本身的用例。

```rust,ignore
...

#[clippy::msrv = "1.44"]
fn msrv_1_44() {
    /* something that would trigger the lint */
}

#[clippy::msrv = "1.45"]
fn msrv_1_45() {
    /* something that would trigger the lint */
}
```

最后，应将 lint 信息添加到 lint 文档中。这在 `clippy_config/src/conf.rs` 中实现：

```rust
define_Conf! {
    #[lints(
        allow_attributes,
        allow_attributes_without_reason,
        ..
        <the newly added lint name>,
        ..
        unused_trait_names,
        use_self,
    )]
    msrv: Msrv = Msrv::default(),
    ...
}
```


随后按照 [为 lint 添加配置](#adding-configuration-to-a-lint) 中的说明更新书籍文档。

> [!TIP] > 请注意，标准库中的项目通常有两个稳定性日期。> 一个适用于普通上下文，另一个适用于 const 上下文。> 例如 `str::split_at` 在 Rust 1.4 中成为稳定版本，而在 1.86 中则变为 const 稳定版本。> > 为了解决这个问题，可以使用 `clippy_utils::is_in_const_context(cx)` 结合 MSRV 检查。> 如果 `std` 和 `core` 之间的 MSRV 建议不同，`clippy_utils::std_or_core(cx)` 也可能是必要的。> 为了测试这些建议，可以在 MSRV 之前和之后在 `const` 函数上添加 `#[clippy::msrv]` 注解。

## 作者 lint

如果您在实现 lint 时遇到困难，还有内部 `author` lint 可以生成检测错误模式的 Clippy 代码。虽然它不适用于所有 Rust 语法，但可以作为良好的起点。

使用它的最快方式是在 [Rust 游戏场: play.rust-lang.org][author_example] 中。将需要 lint 的代码放入编辑器中，并在项目上方添加 `#[clippy::author]` 属性。然后通过 `Tools -> Clippy` 运行 Clippy，您应该会在输出中看到生成的代码。

[Here][author_example] 是 playground 上的一个示例。

如果命令执行成功，你可以将代码复制到你正在实现 lint 的地方。


## 打印 HIR lint

要实现 lint，首先了解 rustc 使用的内部表示方式会很有帮助。Clippy 具有 `#[clippy::dump]` 属性，可以输出该属性所附加的项、语句或表达式的 [_高级中间表示 (HIR)_]。要为表达式添加此属性，通常需要启用 `#![feature(stmt_expr_attributes)]`。

[Here][print_hir_example] 你可以找到示例，只需选择 _Tools_ 并运行 _Clippy_。


## Documentation

在提交 PR 之前，最后需要为我们的 lint 声明添加一些文档。

请使用类似于以下的 doc 注释来描述你的 lint：

```rust
declare_clippy_lint! {
    /// ### What it does
    /// Checks for ... (describe what the lint matches).
    ///
    /// ### Why is this bad?
    /// Supply the reason for linting the code.
    ///
    /// ### Example
    ///
    /// ```rust,ignore
    /// // A short example of code that triggers the lint
    /// ```
    ///
    /// Use instead:
    /// ```rust,ignore
    /// // A short example of improved code that doesn't trigger the lint
    /// ```
    #[clippy::version = "1.29.0"]
    pub FOO_FUNCTIONS,
    pedantic,
    "function named `foo`, which is not a descriptive name"
}
```

如果 lint 属于 `restriction` 组，因为它检查的内容不一定“糟糕”，而更多是风格选择问题，那么请将“为什么这是不好的？”部分标题替换为“为什么要限制这个？”，以避免写出“为什么这是不好的？其实不是，但是...”这样的内容。

一旦你的 lint 被合并，此文档将出现在 [lint list][lint_list]中。


## 运行 rustfmt

[Rustfmt] 是一个根据风格指南格式化 Rust 代码的工具。在 PR 被合并之前，你的代码必须通过 `rustfmt` 进行格式化。Clippy 在 CI 中使用 nightly `rustfmt`。

可以通过 `rustup` 安装：

```bash
rustup component add rustfmt --toolchain=nightly
```

使用 `cargo dev fmt` 来格式化整个代码库。确保为 nightly 工具链安装了 `rustfmt`。


## Debugging

如果您想调试代码中的某些lint实现，可以在代码中任意使用 [`dbg!`] 宏。运行测试时，`stdout` 部分将包含调试输出。


## 冲突的 lints

有一些 lint 处理相同的模式，但建议不同的方法。换句话说，某些 lint 可能提出的修改方向与其他 lint 对相同代码所提议的修改方向相反，从而产生冲突的诊断信息。

当创建出现这种情况的 lint 时，应鼓励遵循以下提示以进行分类：

* 唯一应该属于同一类别的情况是该类别为 `restriction`。例如，`semicolon_inside_block` 和 `semicolon_outside_block`。* 对于其他所有情况，它们应属于不同的类别，并且允许程度也不同。例如，`implicit_return`（restriction, allow）和 `needless_return`（style, warn）。

对于属于不同类别的 lint，建议至少其中一个属于 `restriction` 类别。原因是 `restriction` 组是唯一一个我们不建议启用整个集合，而是只选择部分 lints 的组别。

## PR 检查清单

在提交 PR 之前，请确保遵守所有基本要求：

<!-- Sync this with `.github/PULL_REQUEST_TEMPLATE` -->

- \[ ] 遵循 [lint 命名规范][lint_naming] - \[ ] 添加了通过的用户界面测试（包括已提交的 `.stderr` 文件） - \[ ] `cargo test` 在本地通过 - \[ ] 执行了 `cargo dev update_lints` - \[ ] 添加了 lint 文档 - \[ ] 运行了 `cargo dev fmt`

## 向 lint 添加配置

Clippy 支持使用 `clippy.toml` 文件来配置 lint 值，该文件会在以下位置被搜索：

1. `CLIPPY_CONF_DIR` 环境变量指定的目录；或 2. [CARGO_MANIFEST_DIR](https://doc.rust-lang.org/cargo/reference/environment-variables.html) 环境变量指定的目录；或 3. 当前目录。

向 lint 添加配置对于设定阈值或限制某些行为非常有用，这些行为对某些用户来说可能被视为误报。添加配置的步骤如下：

1. 像这样在 [`clippy_config::conf`] 中添加新的配置项：

   ```rust,ignore
   /// Lint: LINT_NAME.
   ///
   /// <The configuration field doc comment>
   (configuration_ident: Type = DefaultValue),
   ```

   文档注释会自动添加到所列出 lints 的文档中。默认值将使用该类型的 `Debug` 实现进行格式化。2. 将配置值添加到 lint 实现 结构体：首先需要定义一个 lint 实现 结构体。通常通过 `declare_lint_pass!` 宏生成 lint 实现 structs。为了添加某种元数据，需要手动定义这个结构体：
       ```rust
       // Generated struct definition
       declare_lint_pass!(StructName => [
           LINT_NAME
       ]);

       // New manual definition struct
       pub struct StructName {}

       impl_lint_pass!(StructName => [
           LINT_NAME
       ]);
       ```

    2. 接下来添加配置值及相应的创建方法，如下所示：
       ```rust
       pub struct StructName {
           configuration_ident: Type,
       }

       // ...

       impl StructName {
           pub fn new(conf: &'static Conf) -> Self {
               Self {
                   configuration_ident: conf.configuration_ident,
               }
           }
       }
       ```
3. 将配置值传递给 lint 实现 结构体：首先找到 [`clippy_lints` lib 文件]中的结构体构造方式。现在将配置值克隆或复制到本地变量中，然后像这样传递给 实现 结构体：

   添加测试：1. 默认配置的价值观可以像普通 lint 一样在 [`tests/ui`] 中进行测试。2. 配置本身将在 [`tests/ui-toml`] 中单独进行测试。只需添加一个合适的子文件夹。该文件夹包含带有配置值的 `clippy.toml` 文件和一个应由 Clippy 进行 lint 的 Rust 文件。测试可以像通常那样编写。

   ```rust,ignore
   // Default generated registration:
   store.register_*_pass(|| box module::StructName);

   // New registration with configuration value
   store.register_*_pass(move || box module::StructName::new(conf));
   ```

   恭喜，工作几乎完成。现在可以通过 `self.configuration_ident` 在 linting 代码中获取配置值。

4. 添加测试：1. 默认配置的价值观可以在 [`tests/ui`] 中像普通 lint 一样进行测试。2. 配置本身将在 [`tests/ui-toml`] 中单独进行测试。只需添加一个合适的子文件夹。该文件夹包含带有配置值的 `clippy.toml` 文件和一个应由 Clippy 进行 lint 的 Rust 文件。测试可以像通常那样编写。

5. 更新 [lint Configuration](../lint_configuration.md)

   运行 `cargo bless --test config-metadata` 以生成书籍的文档变更。


## 快速参考指南

以下是您在运行每个lint时可能需要使用的工具列表：

* [Clippy 工具集][utils] - 各种辅助函数。您需要的函数可能已经包含在这里（[`implements_trait`], [`snippet`]等） * [Clippy 诊断信息][diagnostics] * [Let chains][let-chains] * [`from_expansion`][from_expansion]和 [`in_external_macro'][in_external_macro] * [`Span'][span] * [`Applicability'][applicability] * [编写lint的常用工具](common_tools_writing_lints.md)有助于处理常见操作 * [Rustc-dev指南][rustc-dev-guide]解释了大量编译器内部概念 * [夜间版 Rustc 文档][nightly_docs]，本指南中多次引用该文档

对于 `EarlyLintPass` lint：

* [`EarlyLintPass'][early_lint_pass] * [`rustc_ast::ast'][ast]

对于 `LateLintPass` lint：

* [`LateLintPass'][late_lint_pass] * [`Ty::TyKind'][ty]

虽然 Clippy 的lint工具大部分都有文档，但 rustc 的内部机制目前缺乏相关文档。这确实令人遗憾，但在大多数情况下，您可以通过复制现有类似 lint 中的内容来解决问题。如果您遇到困难，可以在 [Zulip] 或问题/PR中提问。

[rustfix]: https://github.com/rust-lang/cargo/tree/master/crates/rustfix
[declare_clippy_lint]: https://github.com/rust-lang/rust-clippy/blob/557f6848bd5b7183f55c1e1522a326e9e1df6030/clippy_lints/src/lib.rs#L60
[example_lint_page]: https://rust-lang.github.io/rust-clippy/main/index.html#redundant_closure
[lint_naming]: https://rust-lang.github.io/rfcs/0344-conventions-galore.html#lints
[category_level_mapping]: ../index.html
[early_lint_pass]: https://doc.rust-lang.org/nightly/nightly-rustc/rustc_lint/trait.EarlyLintPass.html
[late_lint_pass]: https://doc.rust-lang.org/nightly/nightly-rustc/rustc_lint/trait.LateLintPass.html
[check_fn]: https://doc.rust-lang.org/nightly/nightly-rustc/rustc_lint/trait.EarlyLintPass.html#method.check_fn
[diagnostics]: https://github.com/rust-lang/rust-clippy/blob/HEAD/clippy_utils/src/diagnostics.rs
[the rustc-dev-guide]: https://rustc-dev-guide.rust-lang.org/diagnostics.html
[fn_kind]: https://doc.rust-lang.org/nightly/nightly-rustc/rustc_ast/visit/enum.FnKind.html
[`FnKind::Fn`]: https://doc.rust-lang.org/nightly/nightly-rustc/rustc_ast/visit/enum.FnKind.html#variant.Fn
[ident]: https://doc.rust-lang.org/nightly/nightly-rustc/rustc_span/symbol/struct.Ident.html
[`clippy_utils::msrvs`]: https://doc.rust-lang.org/nightly/nightly-rustc/clippy_utils/msrvs/index.html
[author_example]: https://play.rust-lang.org/?version=nightly&mode=debug&edition=2024&gist=9a12cb60e5c6ad4e3003ac6d5e63cf55
[_High-Level Intermediate Representation (HIR)_]: https://rustc-dev-guide.rust-lang.org/hir.html
[print_hir_example]: https://play.rust-lang.org/?version=nightly&mode=debug&edition=2024&gist=daf14db3a7f39ca467cd1b86c34b9afb
[lint_list]: https://rust-lang.github.io/rust-clippy/main/index.html
[Rustfmt]: https://github.com/rust-lang/rustfmt
[`dbg!`]: https://doc.rust-lang.org/std/macro.dbg.html
[`clippy_config::conf`]: https://github.com/rust-lang/rust-clippy/blob/HEAD/clippy_config/src/conf.rs
[`clippy_lints` lib file]: https://github.com/rust-lang/rust-clippy/blob/HEAD/clippy_lints/src/lib.rs
[`tests/ui`]: https://github.com/rust-lang/rust-clippy/blob/HEAD/tests/ui
[`tests/ui-toml`]: https://github.com/rust-lang/rust-clippy/blob/HEAD/tests/ui-toml
[utils]: https://doc.rust-lang.org/nightly/nightly-rustc/clippy_utils/index.html
[`implements_trait`]: https://doc.rust-lang.org/nightly/nightly-rustc/clippy_utils/ty/fn.implements_trait.html
[`snippet`]: https://doc.rust-lang.org/nightly/nightly-rustc/clippy_utils/source/fn.snippet.html
[let-chains]: https://github.com/rust-lang/rust/pull/94927
[from_expansion]: https://doc.rust-lang.org/nightly/nightly-rustc/rustc_span/struct.Span.html#method.from_expansion
[in_external_macro]: https://doc.rust-lang.org/nightly/nightly-rustc/rustc_span/struct.Span.html#method.in_external_macro
[span]: https://doc.rust-lang.org/nightly/nightly-rustc/rustc_span/struct.Span.html
[applicability]: https://doc.rust-lang.org/nightly/nightly-rustc/rustc_errors/enum.Applicability.html
[rustc-dev-guide]: https://rustc-dev-guide.rust-lang.org/
[nightly_docs]: https://doc.rust-lang.org/nightly/nightly-rustc/rustc_middle/
[ast]: https://doc.rust-lang.org/nightly/nightly-rustc/rustc_ast/ast/index.html
[ty]: https://doc.rust-lang.org/nightly/nightly-rustc/rustc_middle/ty/sty/index.html
[Zulip]: https://rust-lang.zulipchat.com/#narrow/stream/t-clippy
