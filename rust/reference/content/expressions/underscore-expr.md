<a id="expr.placeholder"></a>
# `_` 表达式

<a id="expr.placeholder.syntax"></a> 
```grammar,expressions
UnderscoreExpression -> `_`
```

<a id="expr.placeholder.intro"></a> 使用符号 `_` 表示的下划线表达式，用于表示解构赋值中的占位符。

<a id="expr.placeholder.lhs-assignment-only"></a> 这些表达式只能出现在赋值的左侧。

<a id="expr.placeholder.pattern"></a> 请注意，这与 [通配符模式](../patterns.md#wildcard-pattern) 不同。

`_` 表达式的示例：

```rust
let p = (1, 2);
let mut a = 0;
(_, a) = p;

struct Position {
    x: u32,
    y: u32,
}

Position { x: a, y: _ } = Position{ x: 2, y: 3 };

// unused result, assignment to `_` used to declare intent and remove a warning
_ = 2 + 2;
// triggers unused_must_use warning
// 2 + 2;

// equivalent technique using a wildcard pattern in a let-binding
let _ = 2 + 2;
```
