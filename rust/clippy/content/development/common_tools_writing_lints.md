# 编写 lints 的常见工具

您可能需要以下工具提示以掌握常见操作。

- [编写 lints 的常见工具](#common-tools-for-writing-lints) - [获取表达式的类型](#retrieving-the-type-of-expression) - [检查表达式是否调用特定方法](#checking-if-an-expr-is-calling-a-specific-method) - [检查特定类型](#checking-for-a-specific-type) - [检查类型是否实现特定 trait](#checking-if-a-type-implements-a-specific-trait) - [检查类型是否定义特定方法](#checking-if-a-type-defines-a-specific-method) - [处理宏](#dealing-with-macros-and-expansions)

有用的 Rustc 开发指南链接： - [编译阶段](https://rustc-dev-guide.rust-lang.org/compiler-src.html#the-main-stages-of-compilation) - [诊断项](https://rustc-dev-guide.rust-lang.org/diagnostics/diagnostic-items.html) - [类型检查](https://rustc-dev-guide.rust-lang.org/type-checking.html) - [Ty 模块](https://rustc-dev-guide.rust-lang.org/ty.html)

## 获取表达式的类型

有时您可能希望获取表达式 `Expr` 的类型 `Ty`，例如回答以下问题：

- 该表达式对应的类型是哪种（`[TyKind]`）？ - 它是有大小类型的吗？ - 它是基本类型吗？ - 它实现了某个 trait 吗？

此操作通过 [`TypeckResults`][TypeckResults] 结构中的 [`expr_ty()`][expr_ty] 方法实现，该方法可让您访问底层结构 [`Ty`][Ty]。

使用示例：
```rust
impl LateLintPass<'_> for MyStructLint {
    fn check_expr(&mut self, cx: &LateContext<'_>, expr: &Expr<'_>) {
        // Get type of `expr`
        let ty = cx.typeck_results().expr_ty(expr);
        // Match its kind to enter its type
        match ty.kind() {
            ty::Adt(adt_def, _) if adt_def.is_struct() => println!("Our `expr` is a struct!"),
            _ => ()
        }
    }
}
```

同样，在 [`TypeckResults`][TypeckResults] 方法中，您可以使用 [`pat_ty()`][pat_ty] 方法从模式中获取类型。

这里有两个值得注意的点：- `cx` 是lint上下文 [`LateContext`][LateContext]。在这个上下文中，两个最有用的数据结构是 `tcx` 以及 `LateContext::typeck_results` 返回的 `TypeckResults`，它们允许我们跳转到类型定义和其他编译阶段，如 HIR。- `typeck_results` 的返回值属于 [`TypeckResults`][TypeckResults]，由类型检查步骤生成，包含诸如表达式的类型、方法解析方式等有用信息。

## 检查一个表达式是否调用特定方法

从 `expr` 开始，可以检查它是否调用了特定方法 `some_method`：

```rust
impl<'tcx> LateLintPass<'tcx> for MyStructLint {
    fn check_expr(&mut self, cx: &LateContext<'tcx>, expr: &'tcx hir::Expr<'_>) {
        // Check our expr is calling a method
        if let hir::ExprKind::MethodCall(path, _, _self_arg, ..) = &expr.kind
            // Check the name of this method is `some_method`
            && path.ident.name == sym::some_method
            // Optionally, check the type of the self argument.
            // - See "Checking for a specific type"
        {
                // ...
        }
    }
}
```

## 检查特定类型

有三种方法可以检查表达式的类型是否为我们想要检查的特定类型。所有这些方法都只检查基础类型，泛型参数需要单独检查。

```rust
use clippy_utils::{paths, sym};
use clippy_utils::res::MaybeDef;
use rustc_attr_ir::lang_items::LangItem;

impl LateLintPass<'_> for MyStructLint {
    fn check_expr(&mut self, cx: &LateContext<'_>, expr: &Expr<'_>) {
        // Getting the expression type
        let ty = cx.typeck_results().expr_ty(expr);

        // 1. Using diagnostic items
        // The last argument is the diagnostic item to check for
        if ty.is_diag_item(cx, sym::Option) {
            // The type is an `Option`
        }

        // 2. Using lang items
        if ty.is_lang_item(cx, LangItem::RangeFull) {
            // The type is a full range like `.drain(..)`
        }

        // 3. Using the type path
        // This method should be avoided if possible
        if paths::RESULT.matches_ty(cx, ty) {
            // The type is a `core::result::Result`
        }
    }
}
```

尽可能使用诊断项和语言项。

## 检查一个类型是否实现了特定特质

根据目标特质是否有诊断项、语言项或两者都没有，有三种实现方式。

```rust
use clippy_utils::sym;
use clippy_utils::ty::implements_trait;

impl LateLintPass<'_> for MyStructLint {
    fn check_expr(&mut self, cx: &LateContext<'_>, expr: &Expr<'_>) {

        // 1. Get the `DefId` of the trait.
        // via lang items
        let trait_id = cx.tcx.lang_items().drop_trait();
        // via diagnostic items
        let trait_id = cx.tcx.get_diagnostic_item(sym::Eq);

        // 2. Check for the trait implementation via the `implements_trait` util.
        let ty = cx.typeck_results().expr_ty(expr);
        if trait_id.is_some_and(|id| implements_trait(cx, ty, id, &[])) {
            // `ty` implements the trait.
        }

        // 3. If the trait requires additional generic arguments
        let trait_id = cx.tcx.lang_items().partial_eq_trait();
        if trait_id.is_some_and(|id| implements_trait(cx, ty, id, &[ty])) {
            // `ty` implements `PartialEq<Self>`
        }
    }
}
```

> 如果目标特质有诊断项或语言项，则优先使用它们。

我们通过类型上下文 `tcx` 访问语言项。`tcx` 的类型为 [`TyCtxt`][TyCtxt]，定义在 `rustc_middle` crate 中。Clippy 中定义的路径列表可以在 [paths.rs][paths] 中找到。

## 检查一个类型是否定义了特定方法

要检查我们的类型是否定义了名为 `some_method` 的方法：

```rust
use clippy_utils::ty::is_type_lang_item;
use clippy_utils::{sym, return_ty};

impl<'tcx> LateLintPass<'tcx> for MyTypeImpl {
    fn check_impl_item(&mut self, cx: &LateContext<'tcx>, impl_item: &'tcx ImplItem<'_>) {
        // Check if item is a method/function
        if let ImplItemKind::Fn(ref signature, _) = impl_item.kind
            // Check the method is named `some_method`
            //
            // Add `some_method` to `clippy_utils::sym` if it's not already there
            && impl_item.ident.name == sym::some_method
            // We can also check it has a parameter `self`
            && signature.decl.implicit_self.has_implicit_self()
            // We can go further and even check if its return type is `String`
            && return_ty(cx, impl_item.hir_id).is_lang_item(cx, LangItem::String)
        {
            // ...
        }
    }
}
```

## 处理宏和展开

请记住，宏已经被展开，且在 Clippy 中处理的代码表示已经应用了去语法分析。这不幸导致了许多误报，因为宏展开是“不可见的”，除非你主动检查它们。一般来说，包含宏展开的代码应该被 Clippy 忽略，因为这些代码可能是动态的，难以或无法看到。使用以下函数来处理宏：

- `span.from_expansion()`: 用于检测一个 span 是来自宏展开还是去解析。在 lint 中，检查这一点是常见的第一步。

   ```rust,ignore
   if expr.span.from_expansion() {
       // just forget it
       return;
   }
   ```

- `span.ctxt()`: span 的上下文表示它是否来自展开，如果是，则代表它被哪个宏调用展开了。有时检查两个 span 的上下文是否相同也很有用。

  ```rust,ignore
  // expands to `1 + 0`, but don't lint
  1 + mac!()
  ```
  ```rust,ignore
  if left.span.ctxt() != right.span.ctxt() {
      // the coder most likely cannot modify this expression
      return;
  }
  ```

  > [!NOTE] > 不是来自展开的代码处于“根”上下文。因此，任何 `from_expansion` 返回 `true` 的 span 可以假设具有相同的上下文。所以仅使用 `span.from_expansion()` 通常就足够了。


- `span.in_external_macro(sm)`: 用于检测给定的 span 是否来自外部 crate 中定义的宏。如果您希望 lint 能够处理由宏生成的代码，这是防止使用当前 crate 未定义的宏的下一步防御措施。对于编码者无法修改的代码进行 lint 是没有意义的。

  例如，您可能希望使用它来避免对其他 crate 中的宏进行 lint 处理。

  ```rust
  use a_crate_with_macros::foo;

  // `foo` is defined in `a_crate_with_macros`
  foo!("bar");

  // if we lint the `match` of `foo` call and test its span
  assert_eq!(match_span.in_external_macro(cx.sess().source_map()), true);
  ```

- `span.ctxt()`: span 的上下文表示它是否来自展开，如果是，则代表它被哪个宏调用展开了。

  `SpanContext` 的一个有用功能是检查两个 span 是否属于同一上下文。例如，在 `a == b` 中，`a` 和 `b` 具有相同的上下文。在 `macro_rules!` 中的 `a == $b` 中，$b$ 被展开为某个表达式，其上下文与 `a` 不同。

   ```rust,ignore
   macro_rules! m {
       ($a:expr, $b:expr) => {
           if $a.is_some() {
               $b;
           }
       }
   }

   let x: Option<u32> = Some(42);
   m!(x, x.unwrap());

   // These spans are not from the same context
   // x.is_some() is from inside the macro
   // x.unwrap() is from outside the macro
   assert_eq!(x_is_some_span.ctxt(), x_unwrap_span.ctxt());
   ```

[Ty]: https://doc.rust-lang.org/nightly/nightly-rustc/rustc_middle/ty/struct.Ty.html
[TyKind]: https://doc.rust-lang.org/nightly/nightly-rustc/rustc_type_ir/ty_kind/enum.TyKind.html
[TypeckResults]: https://doc.rust-lang.org/nightly/nightly-rustc/rustc_middle/ty/struct.TypeckResults.html
[expr_ty]: https://doc.rust-lang.org/nightly/nightly-rustc/rustc_middle/ty/struct.TypeckResults.html#method.expr_ty
[LateContext]: https://doc.rust-lang.org/nightly/nightly-rustc/rustc_lint/struct.LateContext.html
[TyCtxt]: https://doc.rust-lang.org/nightly/nightly-rustc/rustc_middle/ty/context/struct.TyCtxt.html
[pat_ty]: https://doc.rust-lang.org/nightly/nightly-rustc/rustc_middle/ty/struct.TypeckResults.html#method.pat_ty
[paths]: https://doc.rust-lang.org/nightly/nightly-rustc/clippy_utils/paths/index.html
