# 类型检查

当我们在开发新的 lint 或改进现有的 lint 时，出于多种原因可能需要获取表达式 `Expr` 的类型 `Ty`。这可以通过利用 [`LateLintPass`][LateLintPass] 中提供的 [`LateContext`][LateContext] 来实现。

## `LateContext` 和 `TypeckResults`

lint 上下文 [`LateContext`][LateContext] 和 [`TypeckResults`][TypeckResults]（由 `LateContext::typeck_results` 返回）是 `LateLintPass` 中最重要的两个数据结构。它们使我们能够跳转到类型定义和其他编译阶段，如 HIR。

> [!NOTE] > `LateContext.typeck_results` 的返回值即为 [`TypeckResults`][TypeckResults]，它在类型检查步骤中生成，包含有关表达式类型、方法解析方式等有用信息。

`TypeckResults` 包含诸如 [`expr_ty'][expr_ty] 这样的有用方法，使我们能够访问给定表达式的底层结构 [`Ty"][Ty]。

```rust
pub fn expr_ty(&self, expr: &Expr<'_>) -> Ty<'tcx>
```

顺便提一下，除了 [`expr_ty`][expr_ty]， [`TypeckResults`][TypeckResults] 还包含一个 [`pat_ty()[pat_ty]` 方法，可用于从模式中获取类型。

## `Ty`

`Ty` 结构体包含表达式的类型信息。让我们看看 `rustc_middle` 的 [`Ty"][Ty] 结构体以了解该结构：

```rust
pub struct Ty<'tcx>(Interned<'tcx, WithStableHash<TyS<'tcx>>>);
```

乍看之下，这个结构体似乎很特殊。但仔细分析后，我们会发现它包含了许多用于类型检查的有用方法。

例如， [`is_char'][is_char] 方法用于检查给定的 `Ty` 结构体是否对应于基本字符类型。

### `is_*` 用法

在某些场景中，我们只需检查表达式的 `Ty` 是否为特定类型，如 `char` 类型，因此我们可以编写如下代码：

```rust
impl LateLintPass<'_> for MyStructLint {
    fn check_expr(&mut self, cx: &LateContext<'_>, expr: &Expr<'_>) {
        // Get type of `expr`
        let ty = cx.typeck_results().expr_ty(expr);

        // Check if the `Ty` of this expression is of character type
        if ty.is_char() {
            println!("Our expression is a char!");
        }
    }
}
```

此外，如果我们查看 `[is_char_source]` 中的 [源代码][is_char_source]，我们会发现一些非常有趣的内容：

```rust
#[inline]
pub fn is_char(self) -> bool {
    matches!(self.kind(), Char)
}
```

事实上，我们刚刚发现了 `Ty` 的 [`kind()[kind]`，它提供了 `Ty` 的 [`TyKind'][TyKind]。

## `TyKind`

`TyKind` 定义了 Rust 类型系统中的类型种类。通过查看 [`TyKind` 文档][TyKind]，我们会发现它是一个包含超过 25 个变体的枚举，包括 `Bool`、`Int`、`Ref` 等项。

### `kind` 用法

可以通过调用 [`Ty.kind()` 方法][kind] 返回 `Ty` 的 `TyKind`。我们经常使用此方法来在 Clippy 中进行模式匹配。

例如，如果我们想要检查一个 `struct`，可以查看 `ty.kind` 是否对应一个 [Adt][Adt]（代数数据类型），并且其 [`AdtDef`][AdtDef] 是一个结构体：

```rust
impl LateLintPass<'_> for MyStructLint {
    fn check_expr(&mut self, cx: &LateContext<'_>, expr: &Expr<'_>) {
        // Get type of `expr`
        let ty = cx.typeck_results().expr_ty(expr);
        // Match its kind to enter the type
        match ty.kind() {
            ty::Adt(adt_def, _) if adt_def.is_struct() => println!("Our `expr` is a struct!"),
            _ => ()
        }
    }
}
```

## `hir::Ty` 和 `ty::Ty`

我们一直讨论的是 [`ty::Ty"][middle_ty]，但没有提到 [`hir::Ty'][hir_ty]，但后者同样重要，需要理解。

`hir::Ty` 表示用户所写的 *内容`，而 `ty::Ty` 则是编译器看待类型的方式，并包含更多信息。例如：

```rust
fn foo(x: u32) -> u32 { x }
```

在这里，HIR 在无需“思考”的情况下识别类型，它知道函数接受 `u32` 参数并返回 `u32` 值。就 `hir::Ty` 而言，这些可能是不同的类型。但在 `ty::Ty` 级别，编译器理解它们是相同的类型，包括深度生命周期等。

要从 `hir::Ty` 转换为 `ty::Ty`，可以在外部使用 [`lower_ty"][lower_ty] 函数，或在内部使用 [`TypeckResults::node_type()[node_type]`] 方法。

> **警告**：不要在内部使用 `lower_ty`，因为这可能导致 ICEs。

## 以编程方式创建类型

以编程方式创建类型的常见用途是，当我们想要检查一个类型是否实现了某个 trait 时（参见 [trait Checking](trait_checking.md)）。

这是一个创建 `u8` 切片类型 `Ty` 的示例，即 `[u8]`。

```rust
use rustc_middle::ty::Ty;
// assume we have access to a LateContext
let ty = Ty::new_slice(cx.tcx, Ty::new_u8());
```

通常我们依赖 `Ty::new_*` 方法。这些方法定义了类型系统和 trait 系统用来定义和理解代码的基本构建块。

## 有用链接

以下有一些有用的链接，可以帮助您进一步探索本章中涵盖的概念：

- [编译阶段](https://rustc-dev-guide.rust-lang.org/compiler-src.html#the-main-stages-of-compilation) - [诊断项](https://rustc-dev-guide.rust-lang.org/diagnostics/diagnostic-items.html) - [类型检查](https://rustc-dev-guide.rust-lang.org/hir-typeck/summary.html) - [Ty 模块](https://rustc-dev-guide.rust-lang.org/ty.html)

[Adt]: https://doc.rust-lang.org/nightly/nightly-rustc/rustc_type_ir/ty_kind/enum.TyKind.html#variant.Adt
[AdtDef]: https://doc.rust-lang.org/nightly/nightly-rustc/rustc_middle/ty/adt/struct.AdtDef.html
[expr_ty]: https://doc.rust-lang.org/nightly/nightly-rustc/rustc_middle/ty/struct.TypeckResults.html#method.expr_ty
[node_type]: https://doc.rust-lang.org/nightly/nightly-rustc/rustc_middle/ty/struct.TypeckResults.html#method.node_type
[is_char]: https://doc.rust-lang.org/nightly/nightly-rustc/rustc_middle/ty/struct.Ty.html#method.is_char
[is_char_source]: https://github.com/rust-lang/rust/blob/d34f1f931489618efffc4007e6b6bdb9e10f6467/compiler/rustc_middle/src/ty/sty.rs#L1429-L1432
[kind]: https://doc.rust-lang.org/nightly/nightly-rustc/rustc_middle/ty/struct.Ty.html#method.kind
[LateContext]: https://doc.rust-lang.org/nightly/nightly-rustc/rustc_lint/struct.LateContext.html
[LateLintPass]: https://doc.rust-lang.org/nightly/nightly-rustc/rustc_lint/trait.LateLintPass.html
[pat_ty]: https://doc.rust-lang.org/nightly/nightly-rustc/rustc_middle/ty/typeck_results/struct.TypeckResults.html#method.pat_ty
[Ty]: https://doc.rust-lang.org/nightly/nightly-rustc/rustc_middle/ty/struct.Ty.html
[TyKind]: https://doc.rust-lang.org/nightly/nightly-rustc/rustc_type_ir/ty_kind/enum.TyKind.html
[TypeckResults]: https://doc.rust-lang.org/nightly/nightly-rustc/rustc_middle/ty/struct.TypeckResults.html
[middle_ty]: https://doc.rust-lang.org/nightly/nightly-rustc/rustc_middle/ty/struct.Ty.html
[hir_ty]: https://doc.rust-lang.org/nightly/nightly-rustc/rustc_hir/hir/struct.Ty.html
[lower_ty]: https://doc.rust-lang.org/nightly/nightly-rustc/rustc_hir_analysis/fn.lower_ty.html
