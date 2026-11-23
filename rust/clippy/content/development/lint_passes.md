# 代码检查阶段

在着手实现新的代码检查功能之前，每个 Clippy 开发者必须做出一个重要的决定：使用 [`EarlyLintPass`][early_lint_pass] 还是 [`LateLintPass'][late_lint_pass]。

简而言之，`LateLintPass` 可以访问类型与符号信息，而 `EarlyLintPass` 无法访问。如果您不需要访问类型信息，请使用 `EarlyLintPass`。

下面我们将更详细地解释这两种特性的区别。

## `EarlyLintPass`

如果您仔细查看 [`EarlyLintPass`][early_lint_pass] 的文档，会发现该特性中定义的每个方法都使用了 [`EarlyContext'][early_context]。在 `EarlyContext` 的文档中说明：

> 用于检查 AST 的上下文，在展开后、转换为 HIR 之前。

就是这样。`EarlyLintPass` 仅适用于抽象语法树 (AST) 级别。而 AST 是在代码编译的 [lexing and parsing][lexing_and_parsing] 阶段生成的。因此，它无法理解符号的含义或类型信息，如果代码检查仅涉及语法相关问题，那么这是我们为新代码检查特性选择的方式。

虽然对于 Clippy 来说代码检查速度不是关注点，`EarlyLintPass` 更快，如果您确定代码检查不需要类型信息，那么应该选择它。

提醒一下，运行以下命令可以生成使用 `EarlyLintPass` 的代码检查模板：

```sh
$ cargo dev new_lint --name=<your_new_lint> --pass=early --category=<your_category_choice>
```

### `EarlyLintPass` 示例

请查看以下代码：

```rust
let x = OurUndefinedType;
x.non_existing_method();
```

从 AST 的角度来看，这两行都是“语法上”正确的。赋值使用了 `let`，并以分号结束。方法的调用也看起来没问题。作为程序员，我们可能会提出一些疑问，但解析器能够接受这些代码。这就是我们说 `EarlyLintPass` 仅在 AST 级别处理语法含义的意思。

或者，想想我们在 [Define New Lints](defining_lints.md) 章节中提到的 `foo_functions` 代码检查。

我们希望 `foo_functions` 检查器能够检测名为 `foo` 的函数。编写一个仅检查函数名称的检查器意味着我们只能使用抽象语法树（AST），根本无法访问类型系统（类型系统是 `LateLintPass` 发挥作用的地方）。

## `LateLintPass`

与 `EarlyLintPass` 不同，`LateLintPass` 包含类型信息。

如果你仔细查阅 [`LateLintPass`][late_lint_pass] 的文档，你会发现该特质中定义的每个方法都使用了一个 [`LateContext`][late_context]。

在 `LateContext` 的文档中，我们会找到一些处理类型检查的方法，这些方法在 `EarlyContext` 中不存在，例如：

- [`maybe_typeck_results`](https://doc.rust-lang.org/nightly/nightly-rustc/rustc_lint/context/结构体.LateContext.html#method.maybe_typeck_results) - [`typeck_results`](https://doc.rust-lang.org/nightly/nightly-rustc/rustc_lint/context/结构体.LateContext.html#method.typeck_results)

### `LateLintPass` 的示例

让我们通过以下示例来看看：

```rust
let x = OurUndefinedType;
x.non_existing_method();
```

从 AST 的角度来看，这两行代码是语法正确的。我们有一个赋值操作，并且对类型为函数的变量调用了方法。从语法上来说，对于解析器而言一切都是正常的。

然而，深入查看类型信息后，编译器会发现 `OurUndefinedType` 和 `non_existing_method()` **都是未定义的**。

作为 Clippy 开发者，为了访问此类类型信息，我们必须在我们的检查器中实现 `LateLintPass`。当你浏览 Clippy 的检查器时，你会注意到几乎每个检查器都通过 `LateLintPass` 来实现，特别是因为我们需要检查不仅是语法问题，还有类型信息。

`EarlyLintPass` 的另一个限制是，节点仅通过其在大括号中的位置来识别。这意味着你不能简单地获取一个 `id` 并请求某个特定节点。对于大多数检查器来说这没问题，但有些检查器需要检查其他节点，这在 HIR 级别更容易实现。在这种情况下，`LateLintPass` 是更好的选择。

提醒一下，运行以下命令可以生成使用 `LateLintPass` 的 lint 模板代码：

```sh
$ cargo dev new_lint --name=<your_new_lint> --pass=late --category=<your_category_choice>
```

[early_context]: https://doc.rust-lang.org/nightly/nightly-rustc/rustc_lint/context/struct.EarlyContext.html
[early_lint_pass]: https://doc.rust-lang.org/nightly/nightly-rustc/rustc_lint/trait.EarlyLintPass.html
[late_context]: https://doc.rust-lang.org/nightly/nightly-rustc/rustc_lint/context/struct.LateContext.html
[late_lint_pass]: https://doc.rust-lang.org/nightly/nightly-rustc/rustc_lint/trait.LateLintPass.html
[lexing_and_parsing]: https://rustc-dev-guide.rust-lang.org/overview.html#lexing-and-parsing
