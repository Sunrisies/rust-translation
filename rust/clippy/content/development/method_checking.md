# 方法检查

在某些场景下，我们在开发 lint 工具时可能希望检查方法是否存在。我们有两种类型的问题值得我们关注：

-   调用情况：表达式是否调用了特定方法？ - 定义情况：`impl` 是否定义了方法？

## 检查 `expr` 是否调用了特定方法

假设我们有一个 `expr`，我们可以通过对从 `expr.kind` 获取的 [`ExprKind`] 进行模式匹配，来检查它是否调用了特定方法，例如 `our_fancy_method`：

```rust
use rustc_hir as hir;
use rustc_lint::{LateContext, LateLintPass};
use clippy_utils::res::{MaybeDef, MaybeTypeckRes};
use clippy_utils::sym;

impl<'tcx> LateLintPass<'tcx> for OurFancyMethodLint {
    fn check_expr(&mut self, cx: &LateContext<'tcx>, expr: &'tcx hir::Expr<'_>) {
        // Check our expr is calling a method with pattern matching
        if let hir::ExprKind::MethodCall(path, _, _, _) = &expr.kind
            // Check if the name of this method is `our_fancy_method`
            && path.ident.name == sym::our_fancy_method
            // Check if the method belongs to the `sym::OurFancyTrait` trait.
            // (for example, a `map` method could belong to user-defined trait instead of to `Iterator`)
            // See the next section for more information.
            && cx.ty_based_def(expr).opt_parent(cx).is_diag_item(cx, sym::OurFancyTrait)
        {
            println!("`expr` is a method call for `our_fancy_method`");
        }
    }
}
```

详细了解 [`ExprKind`] 枚举中的 [`MethodCall`] 变体，以进一步理解模式匹配机制。如 [定义 lint](defining_lints.md#lint-types) 中所述，如果读者希望深入探索，`methods` lint 类型就包含大量的 `MethodCall` 模式匹配。

新的符号如 `our_fancy_method` 需要添加到 `clippy_utils::sym` 模块中。该模块扩展了 `rustc_span::sym` 中编译器库提供的符号列表。

如果一个 trait 只定义了一个方法（例如只有 `deref()` 方法的 `std::ops::Deref` trait），人们可能会倾向于省略方法名称检查。这确实可行，但并不总是推荐这样做，因为： - 如果向该 trait 添加新方法（可能带有默认实现），就有可能匹配到错误的方法。 - 比较符号的操作非常高效，可能会避免更昂贵的查找操作。

## 检查 `impl` 块是否实现了方法

有时我们想检查方法是否被调用，而有时则想知道我们的 `Ty` 是否定义了方法。

为了检查我们的 `impl` 块是否定义了方法 `our_fancy_method`，我们将使用位于我们喜爱的 [`LateLintPass`] 中的 [`check_impl_item`] 方法（有关更多信息，请参阅 Clippy 书籍中的 ["lint Passes"](lint_passes.md) 章节）。该方法为我们提供了代表 `impl` 块中任何内容的 [`ImplItem`] 结构体。

让我们看看如何检查类型上是否实现了 `our_fancy_method`：

```rust
use clippy_utils::{return_ty, sym};
use clippy_utils::res::MaybeDef;
use rustc_hir::{ImplItem, ImplItemKind};
use rustc_lint::{LateContext, LateLintPass};

impl<'tcx> LateLintPass<'tcx> for MyTypeImpl {
    fn check_impl_item(&mut self, cx: &LateContext<'tcx>, impl_item: &'tcx ImplItem<'_>) {
        // Check if item is a method/function
        if let ImplItemKind::Fn(ref signature, _) = impl_item.kind
            // Check the method is named `our_fancy_method`
            && impl_item.ident.name.as_str() == "our_fancy_method"
            // We can also check it has a parameter `self`
            && signature.decl.implicit_self.has_implicit_self()
            // We can go even further and even check if its return type is `String`
            && return_ty(cx, impl_item.hir_id).is_diag_item(cx, sym::String)
        {
            println!("`our_fancy_method` is implemented!");
        }
    }
}
```

[`check_impl_item`]: https://doc.rust-lang.org/stable/nightly-rustc/rustc_lint/trait.LateLintPass.html#method.check_impl_item
[`ExprKind`]: https://doc.rust-lang.org/beta/nightly-rustc/rustc_hir/hir/enum.ExprKind.html
[`ImplItem`]: https://doc.rust-lang.org/stable/nightly-rustc/rustc_hir/hir/struct.ImplItem.html
[`LateLintPass`]: https://doc.rust-lang.org/stable/nightly-rustc/rustc_lint/trait.LateLintPass.html
[`MethodCall`]: https://doc.rust-lang.org/beta/nightly-rustc/rustc_hir/hir/enum.ExprKind.html#variant.MethodCall
