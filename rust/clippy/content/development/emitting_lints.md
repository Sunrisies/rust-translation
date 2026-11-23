# 发出lint检查

一旦我们[定义了 lint](defining_lints.md)、编写了[UI测试](writing_tests.md)并选择了[lint通道](lint_passes.md)，我们就可以开始实现 lint逻辑，从而发出 lint检查，并逐渐使其表现如预期。

请注意，本章不会详细讨论 lint逻辑的具体实现。我们将在后续章节以及两个真实的 Clippy lint示例中进一步探讨。

要发出 lint检查，我们必须为所声明的 lint实现一个通道（参见[Lint通道](lint_passes.md)）。在本例中，我们将实现一个“晚期”lint，因此请查看[LateLintPass][late_lint_pass]文档，其中提供了大量我们可以用于实现 lint的方法。

```rust
pub trait LateLintPass<'tcx>: LintPass {
    // Trait methods
}
```

目前用于 Clippy lint检查的最常见方法是 [`check_expr` 方法][late_check_expr]，因为 Rust是一种表达式语言，通常我们需要检查的 lint必须分析表达式。

> [!NOTE] > 如果您不完全理解 Rust中的表达式是什么，请查阅关于[表达式][rust_expressions]的官方文档。

其他常见的方法包括 [`check_fn` 方法][late_check_fn]和 [`check_item` 方法][late_check_item]。

### 发出 lint检查

在我们实现的特质方法中，我们可以编写 lint逻辑并发出带有建议的 lint。

Clippy的[诊断功能]提供了许多诊断函数，我们可以用这些函数来发出 lint检查。请查看文档，选择最适合您 lint需求的选项。在 Clippy仓库中常见的诊断功能包括：

- [`span_lint`]: 发出lint而不提供其他信息 - [`span_lint_and_note`]: 发出lint并添加注释 - [`span_lint_and_help`]: 发出lint并提供有用的提示 - [`span_lint_and_sugg`]: 发出lint并提供修复代码的建议 - [`span_lint_and_then`]: 类似于 `span_lint`，但允许进行大量输出自定义。

```rust
impl<'tcx> LateLintPass<'tcx> for LintName {
    fn check_expr(&mut self, cx: &LateContext<'tcx>, expr: &'tcx Expr<'_>)  {
        // Imagine that `some_lint_expr_logic` checks for requirements for emitting the lint
        if some_lint_expr_logic(expr) {
            span_lint_and_help(
                cx, // < The context
                LINT_NAME, // < The name of the lint in ALL CAPS
                expr.span, // < The span to lint
                "message on why the lint is emitted",
                None, // < An optional help span (to highlight something in the lint)
                "message that provides a helpful suggestion",
            );
        }
    }
}
```

> [!NOTE] > 消息应客观中立，避免大写和标点符号。如果需要多句描述，消息应分为错误提示与帮助/说明/建议信息两部分。

## 建议：自动修复

某些lint工具知道如何修改以修复代码问题。例如，lint [`range_plus_one`][range_plus_one]会在用户使用 `x..y + 1` 而非使用包含边界的区间 `[inclusive_range]` (`x..=y`) 时发出警告。对此代码的修复方法是将 `x..y + 1` 表达式改为 `x..=y`。**这就是建议的作用**。

建议是lint提供的用于修复问题的修改方案。输出效果类似之前示例所示：

```text
error: an inclusive range would be more readable
  --> tests/ui/range_plus_minus_one.rs:37:14
   |
LL |     for _ in 1..1 + 1 {}
   |              ^^^^^^^^ help: use: `1..=1`
```

### Applicability

**并非所有建议都绝对正确**，有些需要人工审核，因此我们有[适用性][applicability]机制。

适用性表示对建议正确性的信心，部分建议始终正确（`Applicability::MachineApplicable`），而其他建议则属于可能不正确的情况。

### Example

相同的lint `LINT_NAME`但发出建议的样式类似如下：

```rust
impl<'tcx> LateLintPass<'tcx> for LintName {
    fn check_expr(&mut self, cx: &LateContext<'tcx>, expr: &'tcx Expr<'_>)  {
        // Imagine that `some_lint_expr_logic` checks for requirements for emitting the lint
        if some_lint_expr_logic(expr) {
            span_lint_and_then( // < Note this change
                cx,
                LINT_NAME,
                expr.span,
                "message on why the lint is emitted",
                |diag| {
                    // v Build and emit the suggestion
                    let mut app = Applicability::MachineApplicable;
                    let expr_snippet = snippet_with_applicability(cx, expr.span, "_", &mut app);
                    let sugg = format!("foo + {expr_snippet} * bar");
                    diag.span_suggestion(expr.span, "use", sugg, app);
                }
            );
        }
    }
}
```

建议通常使用 [`format!`][format_macro]宏将旧值与新值结合。有关获取代码片段的信息，请参阅[代码片段](emitting_lints.md#snippets)。

## 如何区分注释、帮助消息和建议

注释与主要lint消息分开呈现，提供用户需要了解为何激活该lint的有用信息。当附加到特定范围时，注释最为有用。

Examples:

### Notes

```text
error: calls to `std::mem::forget` with a reference instead of an owned value. Forgetting a reference does nothing.
  --> tests/ui/drop_forget_ref.rs:10:5
   |
10 |     forget(&SomeStruct);
   |     ^^^^^^^^^^^^^^^^^^^
   |
   = note: `-D clippy::forget-ref` implied by `-D warnings`
note: argument has type &SomeStruct
  --> tests/ui/drop_forget_ref.rs:10:12
   |
10 |     forget(&SomeStruct);
   |            ^^^^^^^^^^^
```

### 帮助消息

帮助消息专门用于帮助用户。在无法提供具体适用建议的情况下使用这些消息。它们也可以附加到特定范围上。

Example:

```text
error: constant division of 0.0 with 0.0 will always result in NaN
  --> tests/ui/zero_div_zero.rs:6:25
   |
6  |     let other_f64_nan = 0.0f64 / 0.0;
   |                         ^^^^^^^^^^^^
   |
   = help: consider using `f64::NAN` if you would like a constant representing NaN
```

### Suggestions

建议最具有帮助性，它们是修改源代码以修复错误的方案。建议的妙处在于，`rustfix`等工具能够检测这些修改并自动修复代码。

Example:

```text
error: This `.fold` can be more succinctly expressed as `.any`
--> tests/ui/methods.rs:390:13
    |
390 |     let _ = (0..3).fold(false, |acc, x| acc || x > 2);
    |                   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ help: try: `.any(|x| x > 2)`
    |
```

## Snippets

代码片段是源代码的一部分（以字符串形式存在），通常是通过 [`clippy_utils::source`] 中的各种 `snippet_*` 函数提取出来的。

如果您使用这些片段并非为了生成建议，通常只需使用 [`snippet`][snippet_fn]——它接受项目的范围以及一个备用字符串（参见 [备用字符串](emitting_lints.md#fallback-string)）。

例如，如果您想了解某个项目的外观（并且知道该项目的范围），可以使用 `snippet(cx, span, "_")`。

如果您确实使用片段来生成建议，建议使用 [`snippet_with_applicability`] 而不是前者。这样，在 Clippy 无法“干净地”提取片段时，它可以减少建议的 [适用性](emitting_lints.md#applicability)——更多详情请参阅该函数的文档。

为了生成建议，通常需要创建多个片段，此时会采用以下模式：

```rust
// inside `span_lint_and_then`

// 1. Create initial applicability.
let mut app = Applicability::MachineApplicable;

// 2. Use it to create all the snippets
let foo_snippet = snippet_with_applicability(cx, foo.span, "_", &mut app);
let bar_snippet = snippet_with_applicability(cx, bar.span, "_", &mut app);
let sugg = format!("{foo_snippet} + {bar_snippet}"); // or whatever

// 3. Use it to emit the final suggestion
diag.span_suggestion(span, msg, sugg, app);
```

### 备用字符串 当指向范围的源代码不可用时，就会使用此字符串作为片段。这种情况主要发生在过程宏处理范围时出错时——参见 [过程宏部分][proc-宏-spans]。

大多数情况下，建议中的片段来自一个表达式，因此 `"_"` 是一个合适的备用字符串。如果您需要建议插入多个语句或代码块——基本上任何“复杂”的内容——则应考虑使用 `".."`。

## 最终：运行 UI 测试以生成 lint 输出

现在，如果我们运行 [UI 测试](writing_tests.md)，我们应该看到 Clippy 产生了包含我们设计的 lint 消息的输出。

下一步是正确实现逻辑，这是我们将在后续章节中讨论的细节。

[diagnostics]: https://doc.rust-lang.org/nightly/nightly-rustc/clippy_utils/diagnostics/index.html
[late_check_expr]: https://doc.rust-lang.org/nightly/nightly-rustc/rustc_lint/trait.LateLintPass.html#method.check_expr
[late_check_fn]: https://doc.rust-lang.org/nightly/nightly-rustc/rustc_lint/trait.LateLintPass.html#method.check_fn
[late_check_item]: https://doc.rust-lang.org/nightly/nightly-rustc/rustc_lint/trait.LateLintPass.html#method.check_item
[late_lint_pass]: https://doc.rust-lang.org/nightly/nightly-rustc/rustc_lint/trait.LateLintPass.html
[rust_expressions]: https://doc.rust-lang.org/reference/expressions.html
[`span_lint`]: https://doc.rust-lang.org/beta/nightly-rustc/clippy_utils/diagnostics/fn.span_lint.html
[`span_lint_and_note`]: https://doc.rust-lang.org/beta/nightly-rustc/clippy_utils/diagnostics/fn.span_lint_and_note.html
[`span_lint_and_help`]: https://doc.rust-lang.org/nightly/nightly-rustc/clippy_utils/diagnostics/fn.span_lint_and_help.html
[`span_lint_and_sugg`]: https://doc.rust-lang.org/nightly/nightly-rustc/clippy_utils/diagnostics/fn.span_lint_and_sugg.html
[`span_lint_and_then`]: https://doc.rust-lang.org/beta/nightly-rustc/clippy_utils/diagnostics/fn.span_lint_and_then.html
[`clippy_utils::source`]: https://doc.rust-lang.org/nightly/nightly-rustc/clippy_utils/source/index.html
[range_plus_one]: https://rust-lang.github.io/rust-clippy/main/index.html#range_plus_one
[inclusive_range]: https://doc.rust-lang.org/std/ops/struct.RangeInclusive.html
[applicability]: https://doc.rust-lang.org/beta/nightly-rustc/rustc_errors/enum.Applicability.html
[snippet_fn]: https://doc.rust-lang.org/beta/nightly-rustc/clippy_utils/source/fn.snippet.html
[`snippet_with_applicability`]: https://doc.rust-lang.org/beta/nightly-rustc/clippy_utils/source/fn.snippet_with_applicability.html
[proc-macro-spans]: macro_expansions.html#the-is_from_proc_macro-function
[format_macro]: https://doc.rust-lang.org/std/macro.format.html
