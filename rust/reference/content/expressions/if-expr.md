<a id="expr.if"></a>
# `if` 表达式

<a id="expr.if.syntax"></a> 
```grammar,expressions
IfExpression ->
    `if` Conditions BlockExpressionNoInnerAttributes
    (`else` ( BlockExpressionNoInnerAttributes | IfExpression ) )?

Conditions ->
      Expression _except [StructExpression]_
    | LetChain

LetChain -> LetChainCondition ( `&&` LetChainCondition )*

LetChainCondition ->
      Expression _except [ExcludedConditions]_
    | OuterAttribute* `let` Pattern `=` Scrutinee _except [ExcludedConditions]_

@root ExcludedConditions ->
      StructExpression
    | LazyBooleanExpression
    | RangeExpr
    | RangeFromExpr
    | RangeInclusiveExpr
    | AssignmentExpression
    | CompoundAssignmentExpression
```
<!-- TODO: The struct exception above needs clarification, see https://github.com/rust-lang/reference/issues/1808
     链式语法可能需要进一步完善，请参见 https://github.com/rust-lang/reference/issues/1811 -->

<a id="expr.if.intro"></a> `if` 表达式的语法是一个由多个通过 `&&` 连接的条件操作数组成的序列，后面跟着一个结果块、任意数量的 `else if` 条件和块，以及可选的尾随 `else` 块。

<a id="expr.if.condition"></a> 条件操作数必须是具有 [布尔类型] 的 [表达式]，或者是一个条件性的 `let` 匹配。

<a id="expr.if.condition-true"></a> 如果所有条件操作数都评估为 `true`，并且所有 `let` 模式成功匹配它们的 [scrutinee]，则执行结果块，并跳过任何后续的 `else if` 或 `else` 块。

<a id="expr.if.else-if"></a> 如果任意条件操作数评估为 `false`，或者任意 `let` 模式没有匹配其 [scrutinee]，则跳过结果块，并评估下一个 `else if` 条件。

<a id="expr.if.else"></a> 如果所有 `if` 和 `else if` 条件都评估为 `false`，则执行任何 `else` 块。

<a id="expr.if.result"></a> `if` 表达式的结果与执行的块相同，或者如果没有执行任何块，则返回 `()`。

<a id="expr.if.type"></a> `if` 表达式在所有情况下必须具有相同的类型。

```rust
# let x = 3;
if x == 4 {
    println!("x is four");
} else if x == 3 {
    println!("x is three");
} else {
    println!("x is something else");
}

// `if` can be used as an expression.
let y = if 12 * 15 > 150 {
    "Bigger"
} else {
    "Smaller"
};
assert_eq!(y, "Bigger");
```

<a id="expr.if.diverging"></a> 如果条件表达式发散，或者所有分支都发散，则 `if` 表达式会 [发散]。

```rust,no_run
fn diverging_condition() -> ! {
    // Diverges because the condition expression diverges
    if loop {} {
        ()
    } else {
        ()
    };
    // The semicolon above is important: The type of the `if` expression is
    // `()`, despite being diverging. When the final body expression is
    // elided, the type of the body is inferred to ! because the function body
    // diverges. Without the semicolon, the `if` would be the tail expression
    // with type `()`, which would fail to match the return type `!`.
}

fn diverging_arms() -> ! {
    // Diverges because all arms diverge
    if true {
        loop {}
    } else {
        loop {}
    }
}
```

<a id="expr.if.let"></a>
## `if let` 模式

<a id="expr.if.let.intro"></a> `if` 条件中的 `let` 模式允许在模式成功匹配时将新变量绑定到作用域中。

以下示例展示了使用 `let` 模式的绑定情况：

```rust
let dish = ("Ham", "Eggs");

// This body will be skipped because the pattern is refuted.
if let ("Bacon", b) = dish {
    println!("Bacon is served with {}", b);
} else {
    // This block is evaluated instead.
    println!("No bacon will be served");
}

// This body will execute.
if let ("Ham", b) = dish {
    println!("Ham is served with {}", b);
}

if let _ = 5 {
    println!("Irrefutable patterns are always true");
}
```

<a id="expr.if.let.or-pattern"></a> 可以使用 `|` 运算符指定多个模式。其语义与 [`match` 表达式中的 `|` 相同。

```rust
enum E {
    X(u8),
    Y(u8),
    Z(u8),
}
let v = E::Y(12);
if let E::X(n) | E::Y(n) = v {
    assert_eq!(n, 12);
}
```

<a id="expr.if.chains"></a>
## 条件链

<a id="expr.if.chains.intro"></a> 多个条件操作数可以通过 `&&` 连接。

<a id="expr.if.chains.order"></a> 类似于 `&&` [LazyBooleanExpression]，每个操作数从左到右依次计算，直到某个操作数被评估为 `false` 或 `let` 匹配失败，此时后续操作数不再计算。

<a id="expr.if.chains.bindings"></a> 每个模式绑定会被放入作用域中，以便用于下一个条件操作数和 consequent 块。

以下是链式连接多个表达式的示例，包含 `let` 绑定和布尔表达式，以及能够引用前序表达式中的模式绑定的表达式：

```rust
fn single() {
    let outer_opt = Some(Some(1i32));

    if let Some(inner_opt) = outer_opt
        && let Some(number) = inner_opt
        && number == 1
    {
        println!("Peek a boo");
    }
}
```

上述内容等同于不使用条件链的情况：

```rust
fn nested() {
    let outer_opt = Some(Some(1i32));

    if let Some(inner_opt) = outer_opt {
        if let Some(number) = inner_opt {
            if number == 1 {
                println!("Peek a boo");
            }
        }
    }
}
```

<a id="expr.if.chains.or"></a> 如果任何条件操作数是 `let` 模式，那么没有任何一个条件操作数可以是 `||` [lazy boolean operator expression][expr.bool-logic]，因为这与 `let` 检查器存在歧义和优先级问题。

> [!EXAMPLE]
> If a `||` expression is needed, then parentheses can be used. For example:
>
> ```rust
> # let foo = Some(123);
> # let condition1 = true;
> # let condition2 = false;
> if let Some(x) = foo
>     // Parentheses are required here.
>     && (condition1 || condition2)
> {}
> ```

<a id="expr.if.edition2024"></a> 
> [!EDITION-2024]
> Before the 2024 edition, let chains are not supported. That is, the [LetChain] grammar is not allowed in an `if` expression.

[diverges]: divergence

[`match` expressions]: match-expr.md
[boolean type]: ../types/boolean.md
[scrutinee]: ../glossary.md#scrutinee
