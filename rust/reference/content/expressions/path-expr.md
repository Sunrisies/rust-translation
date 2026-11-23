<a id="expr.path"></a>
# 路径表达式

<a id="expr.path.syntax"></a> 
```grammar,expressions
PathExpression ->
      PathInExpression
    | QualifiedPathInExpression
```

<a id="expr.path.intro"></a> 作为表达式上下文的 [path] 表示局部变量或项。

<a id="expr.path.place"></a> 解析为局部或静态变量的路径表达式称为 [place expressions]；其他路径则称为 [value expressions]。

<a id="expr.path.safety"></a> 使用 [`static mut`] 变量需要包含 [`unsafe` 块]。

```rust
# mod globals {
#     pub static STATIC_VAR: i32 = 5;
#     pub static mut STATIC_MUT_VAR: i32 = 7;
# }
# let local_var = 3;
local_var;
globals::STATIC_VAR;
unsafe { globals::STATIC_MUT_VAR };
let some_constructor = Some::<i32>;
let push_integer = Vec::<i32>::push;
let slice_reverse = <[i32]>::reverse;
```

<a id="expr.path.const"></a> 关联常量的求值方式与 [`const` 块相同。

[place expressions]: ../expressions.md#place-expressions-and-value-expressions
[value expressions]: ../expressions.md#place-expressions-and-value-expressions
[path]: ../paths.md
[`static mut`]: ../items/static-items.md#mutable-statics
[`unsafe` block]: block-expr.md#unsafe-blocks
[`const` blocks]: block-expr.md#const-blocks
