# 处理宏与展开

在使用 Clippy 时，有时可能会遇到 Rust 宏展开的问题。虽然宏展开并不像宇宙的展开那样具有戏剧性或深刻性，但它们确实会给代码和逻辑的有序世界带来混乱。

一般的经验法则是，在使用 Clippy 时应该忽略包含宏展开的代码，因为这些代码以我们难以或无法预见的动态方式存在。

## 误报

“难以预见的动态方式”具体指的是什么？

宏在 `EarlyLintPass` 级别被[展开]，因此会生成抽象语法树（AST）来替代宏。这意味着我们在 Clippy 中处理的代码已经展开过了。

如果我们编写了一个新的 lint，就有可能在由宏生成的代码中触发该 lint。由于这种展开的宏代码并非由使用者编写，而是由宏作者编写，因此用户不应负责修复引发 lint 的问题。

此外，宏中的[范围]可以由宏作者更改。因此，任何与行或列相关的 lint 检查都应该避免，因为它们可能会随时改变，导致信息不可靠或不准确。

由于这些难以预测或不稳定的行为，宏展开通常不应被视为稳定 API 的一部分。这也是为什么大多数 lint 在向最终用户发出建议之前会检查代码是否位于宏内部，以避免误报。

## 如何处理宏

有几种函数可用于处理宏。

### `Span::from_expansion` 方法

我们可以利用`span`的[from_expansion]方法，该方法可以检测`span`是否来自宏展开/去解析。这是 lint 中常见的第一步：

```rust
if expr.span.from_expansion() {
    // We most likely want to ignore it.
    return;
}
```

### `Span::ctxt` 方法

`span`的上下文由[ctxt]方法提供，并返回[SyntaxContext]，它表示该范围是否来自宏展开，如果是，则指示哪个宏调用展开了该范围。

有时，检查两个范围上下文是否相同是有用的。例如，假设我们有以下代码行，该代码将展开为 `1 + 0`：

```rust
// The following code expands to `1 + 0` for both `EarlyLintPass` and `LateLintPass`
1 + mac!()
```

假设我们将 `1` 表达式作为变量 `left` 收集，将 `0`/`mac!()` 表达式作为变量 `right`，我们可以简单地比较它们的上下文。如果上下文不同，那么很可能我们正在处理宏展开，应该直接忽略它：

```rust
if left.span.ctxt() != right.span.ctxt() {
    // The code author most likely cannot modify this expression
    return;
}
```

> **注意**：不是来自展开的代码属于“根”上下文。> 因此，任何 `from_expansion` 返回 `false` 的范围可以假设具有相同的上下文。因此，使用 `span.from_expansion()` 通常就足够了。

更深入地看，在像 `a == b` 这样的简单表达式中，`a` 和 `b` 具有相同的上下文。然而，在 `macro_rules!` 中，当遇到 `a == $b` 时，`$b` 会被展开为一个包含与 `a` 不同上下文的表达式。

请看以下宏 `m`：

```rust
macro_rules! m {
    ($a:expr, $b:expr) => {
        if $a.is_some() {
            $b;
        }
    }
}

let x: Option<u32> = Some(42);
m!(x, x.unwrap());
```

如果 `m!(x, x.unwrap());` 行被展开，我们将得到两个展开的表达式：

- `x.is_some()`（来自 `m` 宏中的 `$a.is_some()` 行） - `x.unwrap()`（对应于 `m` 宏中的 `$b`）

假设 `x.is_some()` 表达式的范围与 `x_is_some_span` 变量关联，而 `x.unwrap()` 表达式的范围与 `x_unwrap_span` 变量关联，我们可以认为这两个范围没有相同的上下文：

```rust
// x.is_some() is from inside the macro
// x.unwrap() is from outside the macro
assert_ne!(x_is_some_span.ctxt(), x_unwrap_span.ctxt());
```

### `in_external_macro` 函数

`Span` 提供了一种方法（[`in_external_macro`]），可以检测给定范围是否来自外部 crate 中定义的宏。

因此，如果我们真的想要一个新的 lint 来处理由宏生成的代码，这是下一个防御措施，以避免使用不在当前 crate 中定义的宏，因为如果 Clippy 对用户无法修改的代码进行 lint，对用户来说是不公平的。

例如，假设我们有以下代码正在被 Clippy 检查：

```rust
#[macro_use]
extern crate a_foreign_crate_with_macros;

// `foo` macro is defined in `a_foreign_crate_with_macros`
foo!("bar");
```

另外假设我们获得了 `foo` 宏调用的对应变量 `foo_span`，如果我们确定 `in_external_macro` 结果为 `true`（注意 `cx` 可以是 `EarlyContext` 或 `LateContext`），我们可以决定不进行 lint。

```rust
if foo_span.in_external_macro(cx.sess().source_map()) {
    // We should ignore macro from a foreign crate.
    return;
}
```

### `is_from_proc_macro` 函数 一个常见的困惑点是 [`is_from_proc_macro`] 的存在及其与其他 [`in_external_macro`]/[`from_expansion`] 函数的区别。

虽然 [`in_external_macro`] 和 [`from_expansion`] 都能很好地检测来自声明式宏（即 `macro_rules!` 和宏 2.0）的扩展代码，但检测由过程宏生成的代码则更为复杂，因为过程宏可以并且经常自由地修改返回的标记范围。

实际上，这通常是通过使用 [`quote::quote_spanned!`] 结合输入标记的范围来实现的。

在这些情况下，编译器和像 Clippy 这样的工具没有一种可靠的方法来区分来自过程宏的代码和用户直接编写的代码，而 [`in_external_macro`] 会返回 `false`。

对于编译器来说，这通常不是问题，实际上这有助于过程宏作者生成更好的错误信息，因为它允许将扩展的部分与宏输入的部分关联起来，并让编译器在编译错误时指向相关的代码。

然而，对 Clippy 来说这很不方便，因为大多数时候我们并不希望对过程宏生成的代码进行 lint 检查，这就使得无法区分什么是过程宏代码、什么不是。

> [!NOTE] > 这特别出现在过程宏明确将范围设置为输入范围时。 > > 例如，其他常见的创建 `TokenStream` 的方法，如 `"fn foo() {...}".parse::<TokenStream>()`， > 会将每个标记的范围设置为 `Span::call_site()`，这已经表明该范围来自过程宏，而常规的范围方法能够轻松检测到这是宏范围。

因此，Clippy 拥有自己的 `is_from_proc_macro` 函数，该函数试图通过检查给定范围的源文本是否与给定的 AST 节点匹配来*近似判断*一个范围是否来自过程宏。

该函数通常与其他提到的宏范围函数结合使用，但在条件链中一般是在后面调用的，因为它比大多数其他条件更重，因此其他较轻的条件可以更快失败。例如，`borrow_deref_ref` 检查：
```rs
impl<'tcx> LateLintPass<'tcx> for BorrowDerefRef {
    fn check_expr(&mut self, cx: &LateContext<'tcx>, e: &rustc_hir::Expr<'tcx>) {
        if let ... = ...
            && ...
            && !e.span.from_expansion()
            && ...
            && ...
            && !is_from_proc_macro(cx, e)
            && ...
        {
            ...
        }
    }
}
```

### 通过宏展开测试检查器 为了验证所有情况在检查器中都被正确处理，我们有一个辅助辅助库，该库提供了各种宏，这些宏被测试使用，如下所示：
```rust
//@aux-build:proc_macros.rs

extern crate proc_macros;

fn main() {
    proc_macros::external!{ code_that_should_trigger_your_lint }
    proc_macros::with_span!{ span code_that_should_trigger_your_lint }
}
```
这涉及两种情况：- `proc_macros::external!` 是一个简单的过程宏，它会回传输入标记，但带有宏范围：这代表了常见的情形，即外部宏展开为会被检查器触发的代码，并且由 `in_external_macro` 和 `Span::from_expansion` 正确处理。

- `proc_macros::with_span!` 从第二个标记开始回传输入标记，并带有第一个标记的范围：这是其他函数会失败的地方，需要 `is_from_proc_macro` 来识别。

[`ctxt`]: https://doc.rust-lang.org/stable/nightly-rustc/rustc_span/struct.Span.html#method.ctxt
[expansion]: https://rustc-dev-guide.rust-lang.org/macro-expansion.html#expansion-and-ast-integration
[`from_expansion`]: https://doc.rust-lang.org/stable/nightly-rustc/rustc_span/struct.Span.html#method.from_expansion
[`in_external_macro`]: https://doc.rust-lang.org/stable/nightly-rustc/rustc_span/struct.Span.html#method.in_external_macro
[Span]: https://doc.rust-lang.org/stable/nightly-rustc/rustc_span/struct.Span.html
[SyntaxContext]: https://doc.rust-lang.org/stable/nightly-rustc/rustc_span/hygiene/struct.SyntaxContext.html
[`is_from_proc_macro`]: https://doc.rust-lang.org/nightly/nightly-rustc/clippy_utils/fn.is_from_proc_macro.html
[`quote::quote_spanned!`]: https://docs.rs/quote/latest/quote/macro.quote_spanned.html
