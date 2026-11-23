<a id="expr.paren"></a>
# 分组表达式

<a id="expr.paren.syntax"></a> 
```grammar,expressions
GroupedExpression -> `(` Expression `)`
```

<a id="expr.paren.intro"></a> 一个*括号化表达式*包裹一个单一表达式，并评估为该表达式。括号化表达式的语法为 `(`, 接着是一个表达式（称为*封闭操作数*），然后是一个 `)`。

<a id="expr.paren.evaluation"></a> 括号化表达式的评估结果等于封闭操作数的值。

<a id="expr.paren.place-or-value"></a> 如果封闭操作数为位置表达式，则括号化表达式为[位置表达式][place]；如果封闭操作数为值表达式，则成为值表达式。

<a id="expr.paren.override-precedence"></a> 可以使用括号来显式修改表达式中子表达式的优先级顺序。

括号化表达式的一个示例：

```rust
let x: i32 = 2 + 3 * 4; // not parenthesized
let y: i32 = (2 + 3) * 4; // parenthesized
assert_eq!(x, 14);
assert_eq!(y, 20);
```

使用括号的必要场景之一是调用作为结构体成员的函数指针：

```rust
# struct A {
#    f: fn() -> &'static str
# }
# impl A {
#    fn f(&self) -> &'static str {
#        "The method f"
#    }
# }
# let a = A{f: || "The field f"};
#
assert_eq!( a.f (), "The method f");
assert_eq!((a.f)(), "The field f");
```

[place]: ../expressions.md#place-expressions-and-value-expressions
