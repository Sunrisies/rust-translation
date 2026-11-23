# 定义新lint

新lint的第一步是在 Clippy 代码库中定义并注册该lint。由于设置lint涉及一些样板代码，我们可以使用 Clippy 开发工具来完成这一步骤。

#### Lint类型

Lint类型是指你的lint关注的项和表达式的分类。

在撰写本文档更新时，除了位于 `clippy_lints/src/` 下的众多独立lint之外，还有11种 _类型_ 的lint：

- `cargo` - `casts` - `functions` - `loops` - `matches` - `methods` - `misc_early` - `operators` - `transmute` - `types` - `unit_types`

这些类型将具有某些共同行为的lint归为同一类。例如，`functions` 类包含了处理 Rust 中函数相关方面的lint，如定义、签名和属性。

如需更多信息，您可以对比任何类别下的lint文件与 [所有 Clippy lint][all_lints]，或咨询某位维护者。

## Lint名称

一个好的lint名称非常重要，请务必遵守 [lint命名指南][lint_naming]。如果lint名称不合适也没关系，Clippy 团队成员会在 PR 过程中提醒您。

---

我们将把检测名为“foo”的函数的示例lint命名为 `foo_functions`。请查看 [lint命名指南][lint_naming]，了解为什么这个名称合适。

## 添加并注册lint

一旦选定名称，我们就需要将 `foo_functions` 作为lint添加到代码库中。有两种方式可以注册lint。

### Standalone

如果您认为这个新lint是一个独立lint（不属于任何特定的 [类型](#lint-types) 如 `functions` 或 `loops`），可以在您的 Clippy 项目中使用以下命令：

```sh
$ cargo dev new_lint --name=lint_name --pass=late --category=pedantic
```

这里需要注意两点：

1. `--pass`: 我们在该命令中设置 `--pass=late`，表示执行晚期lint处理。另一种选择是 `early` lint处理。我们将在 [lint Passes] 章节讨论这种差异。2. `--category`: 如果未提供，这个新lint的 `category` 将默认为 `nursery`。

`cargo dev new_lint` 命令将创建一个新文件：`clippy_lints/src/foo_functions.rs`，同时还会进行 [lint 注册](#lint-registration)。

总体而言，您会注意到以下文件被修改或创建：

```sh
$ git status
On branch foo_functions
Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
	modified:   CHANGELOG.md
	modified:   clippy_lints/src/lib.register_lints.rs
	modified:   clippy_lints/src/lib.register_pedantic.rs
	modified:   clippy_lints/src/lib.rs

Untracked files:
  (use "git add <file>..." to include in what will be committed)
	clippy_lints/src/foo_functions.rs
	tests/ui/foo_functions.rs
```


### 特定类型

> **注意**：lint 类型在 ["lint types"](#lint-types) 部分列出。

如果您认为这个新 lint 属于某种特定的 lints 类型，可以使用 `--type` 选项运行 `cargo dev new_lint`。

由于我们的 `foo_functions` lint 与函数调用相关，有人可能会认为我们应该将其归入检测函数行为的 lints 组，因此我们可以将其放入 `functions` 组中。

请在您的 Clippy 项目中运行以下命令：

```sh
$ cargo dev new_lint --name=foo_functions --type=functions --category=pedantic
```

此命令将创建新文件：`clippy_lints/src/{type}/foo_functions.rs`。在我们的案例中，路径将为 `clippy_lints/src/functions/foo_functions.rs`。

请注意，此命令使用了 `--type` 标志而不是 `--pass`。与独立定义不同，这种 lint 不会以传统方式被注册。相反，您将在 `clippy_lints/src/{type}/mod.rs` 中的类型 lint pass 中调用该 lint。

_类型_ 只是 `clippy_lints/src` 中目录的名称，例如示例命令中的 `functions`。Clippy 将一些具有共同行为的 lints 归为同一组，因此如果您的 lint 属于某个组，最好将其添加到该组中。

总体而言，您会注意到以下文件被修改或创建：

```sh
$ git status
On branch foo_functions
Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
	modified:   CHANGELOG.md
	modified:   clippy_lints/src/declared_lints.rs
	modified:   clippy_lints/src/functions/mod.rs

Untracked files:
  (use "git add <file>..." to include in what will be committed)
	clippy_lints/src/functions/foo_functions.rs
	tests/ui/foo_functions.rs
```


## `declare_clippy_lint` 宏

在运行 `cargo dev new_lint` 后，您会看到一个名为 `declare_clippy_lint` 的宏。如果您定义了独立 lint，该宏将位于同一文件中；如果定义了特定类型的 lint，则位于 `mod.rs` 中。

该宏看起来如下：

```rust
declare_clippy_lint! {
    /// ### What it does
    ///
    /// // Describe here what does the lint do.
    ///
    /// Triggers when detects...
    ///
    /// ### Why is this bad?
    ///
    /// // Describe why this pattern would be bad
    ///
    /// It can lead to...
    ///
    /// ### Example
    /// ```rust
    /// // example code where Clippy issues a warning
    /// ```
    /// Use instead:
    /// ```rust
    /// // example code which does not raise Clippy warning
    /// ```
    #[clippy::version = "1.70.0"] // <- In which version was this implemented, keep it up to date!
    pub LINT_NAME, // <- The lint name IN_ALL_CAPS
    pedantic, // <- The lint group
    "default lint description" // <- A lint description, e.g. "A function has an unit return type."
}
```

## lint 注册

如果我们为新的 lint 运行 `cargo dev new_lint` 命令，lint 将会自动被注册，无需进一步操作。

然而，有时我们可能希望手动声明一个新的 lint。在这种情况下，之后可以使用 `cargo dev update_lints` 命令。

当手动声明某个检查时，我们可能需要通过在 `clippy_lints/src/lib.rs` 中的 `late_lint_methods!` 宏调用中添加条目来手动注册该检查流程，具体位置可在 `// add late passes here` 标记处设置：

```rust
FooFunctions: foo_functions::FooFunctions = foo_functions::FooFunctions,
```

正如你可能已经猜到的那样，凡是需要延迟执行的，也一定存在提前执行的情况：在 Clippy 中也有一个 `early_lint_methods!` 宏。关于提前与延迟检查方式的更多内容，请参阅 [检查流程] 章节。

如果不在 `early_lint_methods!` 或 `late_lint_methods!` 中添加条目，所涉及的检查流程将不会执行。

[all_lints]: https://rust-lang.github.io/rust-clippy/main/
[lint_naming]: https://rust-lang.github.io/rfcs/0344-conventions-galore.html#lints
[Lint Passes]: lint_passes.md
