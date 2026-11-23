<a id="expr.return"></a>
# `return` 表达式

<a id="expr.return.syntax"></a> 
```grammar,expressions
ReturnExpression -> `return` Expression?
```

<a id="expr.return.intro"></a> 返回表达式使用关键字 `return` 表示。

<a id="expr.return.behavior"></a> 评估 `return` 表达式会将其参数移动到当前函数调用的指定输出位置，破坏当前的函数激活帧，并将控制转移给调用者帧。

<a id="expr.return.diverging"></a> `return` 表达式是 [发散的]，其类型为 [`!`]。

`return` 表达式的一个示例：

```rust
fn max(a: i32, b: i32) -> i32 {
    if a > b {
        return a;
    }
    return b;
}
```

[`!`]: type.never
[diverging]: divergence


