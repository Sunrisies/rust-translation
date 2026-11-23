# trait 检查

除了[类型检查](type_checking.md)，我们可能还希望在实现 lint 时检查特定类型 `Ty` 是否实现了某个 trait。根据我们要检查的目标 trait 是否有 [诊断项][diagnostic_items]、[语言项][lang_items]或没有，有三种实现方式。

## 使用诊断项

如[Rust 编译器开发指南][rustc_dev_guide]所述，诊断项是通过[符号][symbol]来识别类型的。

例如，如果我们想检查一个表达式是否实现了 `Iterator` trait，可以简单地编写以下代码，提供 `LateContext` (`cx)`、当前表达式以及所涉及的 trait 的符号：

```rust
use clippy_utils::sym;
use clippy_utils::ty::implements_trait;
use rustc_hir::Expr;
use rustc_lint::{LateContext, LateLintPass};

impl LateLintPass<'_> for CheckIteratorTraitLint {
    fn check_expr(&mut self, cx: &LateContext<'_>, expr: &Expr<'_>) {
        let implements_iterator = (cx.tcx.get_diagnostic_item(sym::Iterator))
            .is_some_and(|id| implements_trait(cx, cx.typeck_results().expr_ty(expr), id, &[]));
        if implements_iterator {
            // [...]
        }

    }
}
```

> **注意**：请参考[此索引][symbol_index]以了解所有定义的 `Symbol`。

## 使用语言项

除了诊断项之外，我们还可以使用 [`lang_items`][lang_items]。查看文档可知，`LanguageItems` 包含编译器中定义的所有语言项。

通过其 `*_trait` 方法之一，我们可以获得任何特定项的[DefId]，如 `Clone`、`Copy`、`Drop`、`Eq`，这些术语为许多 Rustacean 人士所熟悉。

例如，如果我们想检查表达式 `expr` 是否实现了 `Drop` trait，可以通过 `LateContext` 的 [TyCtxt] 访问 `LanguageItems`，该接口提供 `lang_items` 方法，返回 `Drop` trait 的 id。然后，通过调用 Clippy 工具函数 `implements_trait`，我们可以确认 `expr` 的 `Ty` 实现了该 trait：

```rust
use clippy_utils::ty::implements_trait;
use rustc_hir::Expr;
use rustc_lint::{LateContext, LateLintPass};

impl LateLintPass<'_> for CheckDropTraitLint {
    fn check_expr(&mut self, cx: &LateContext<'_>, expr: &Expr<'_>) {
        let ty = cx.typeck_results().expr_ty(expr);
        if cx.tcx.lang_items()
            .drop_trait()
            .map_or(false, |id| implements_trait(cx, ty, id, &[])) {
                println!("`expr` implements `Drop` trait!");
            }
    }
}
```

## 使用类型路径

如果既没有诊断项也没有语言项可用，我们可以使用 [`clippy_utils::paths`][paths]来确定 trait 的 `DefId`。

> **注意**：如果可能的话，应尽量避免使用这种方法，最好的做法是通过 PR 向 [`rust-lang/rust`][rust]添加诊断项。

下面，我们检查给定的 `expr` 是否实现了 [`core::iter::Step`](https://doc.rust-lang.org/std/iter/trait.Step.html)：

```rust
use clippy_utils::paths;
use clippy_utils::ty::implements_trait;
use rustc_hir::Expr;
use rustc_lint::{LateContext, LateLintPass};

impl LateLintPass<'_> for CheckIterStep {
    fn check_expr(&mut self, cx: &LateContext<'_>, expr: &Expr<'_>) {
        let ty = cx.typeck_results().expr_ty(expr);
        if let Some(trait_def_id) = paths::ITER_STEP.first(cx)
            && implements_trait(cx, ty, trait_def_id, &[])
        {
            println!("`expr` implements the `core::iter::Step` trait!");
        }
    }
}
```

## 以编程方式创建类型

特质通常对类型参数具有通用性，例如 `Borrow<T>` 是对 `T` 的通用化表示。Rust 允许我们为特定类型实现特质。例如，我们可以为假设的类型 `Foo` 实现 `Borrow<[u8]>`。假设我们希望判断我们的类型是否真正实现了 `Borrow<[u8]>`。

为此，我们可以使用上述的 `implements_trait` 函数，并提供一个表示 `[u8]` 的类型参数。由于 `[u8]` 是 `[T]` 的特化形式，我们可以利用 [`Ty::new_slice`][new_slice] 方法创建一个代表 `[T]` 的类型，并将 `u8` 作为类型参数。为了以编程方式创建 `ty::Ty`，我们依赖 `Ty::new_*` 方法。这些方法会创建一个 `TyKind`，然后将其封装在 `Ty` 结构中。这意味着我们可以访问所有基本类型，如 `Ty::new_char`、`Ty::new_bool`、`Ty::new_int` 等。我们还可以通过这些基础构建块创建更复杂的类型，例如切片、元组和引用。

对于特质检查，仅仅创建类型是不够的，还需要将它们转换为 [GenericArg]。在 rustc 中，泛型是编译器能够理解的实体，有三种类型：类型、常量和生命周期。通过调用构造的 [Ty] 的 `.into()` 方法，我们将该类型封装成泛型，然后查询系统可以使用它来决定特化特质是否被实现。

以下代码演示了如何做到这一点：

```rust

use rustc_middle::ty::Ty;
use clippy_utils::sym;
use clippy_utils::ty::implements_trait;

let ty = todo!("Get the `Foo` type to check for a trait implementation");
let borrow_id = cx.tcx.get_diagnostic_item(sym::Borrow).unwrap(); // avoid unwrap in real code
let slice_of_bytes_t = Ty::new_slice(cx.tcx, cx.tcx.types.u8);
let generic_param = slice_of_bytes_t.into();
if implements_trait(cx, ty, borrow_id, &[generic_param]) {
    todo!("Rest of lint implementation")
}
```

本质上，`[Ty]` 结构允许我们以可被编译器和查询引擎使用的表示形式编程创建类型。然后我们使用我们感兴趣的类型的 `rustc_middle::Ty`，并查询编译器以确认它确实实现了我们所关注的特质。

[DefId]: https://doc.rust-lang.org/nightly/nightly-rustc/rustc_hir/def_id/struct.DefId.html
[diagnostic_items]: https://rustc-dev-guide.rust-lang.org/diagnostics/diagnostic-items.html
[lang_items]: https://doc.rust-lang.org/nightly/nightly-rustc/rustc_hir/lang_items/struct.LanguageItems.html
[paths]: https://github.com/rust-lang/rust-clippy/blob/HEAD/clippy_utils/src/paths.rs
[rustc_dev_guide]: https://rustc-dev-guide.rust-lang.org/
[symbol]: https://doc.rust-lang.org/nightly/nightly-rustc/rustc_span/symbol/struct.Symbol.html
[symbol_index]: https://doc.rust-lang.org/beta/nightly-rustc/rustc_span/symbol/sym/index.html
[TyCtxt]: https://doc.rust-lang.org/nightly/nightly-rustc/rustc_middle/ty/context/struct.TyCtxt.html
[Ty]: https://doc.rust-lang.org/nightly/nightly-rustc/rustc_middle/ty/struct.Ty.html
[rust]: https://github.com/rust-lang/rust
[new_slice]: https://doc.rust-lang.org/nightly/nightly-rustc/rustc_middle/ty/struct.Ty.html#method.new_slice
[GenericArg]: https://doc.rust-lang.org/nightly/nightly-rustc/rustc_middle/ty/struct.GenericArg.html
