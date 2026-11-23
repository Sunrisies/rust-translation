<a id="expr.loop"></a>
# 循环及其他可中断表达式

<a id="expr.loop.syntax"></a> 
```grammar,expressions
LoopExpression ->
    LoopLabel? (
        InfiniteLoopExpression
      | PredicateLoopExpression
      | IteratorLoopExpression
      | LabelBlockExpression
    )
```

<a id="expr.loop.intro"></a> Rust 支持四种循环表达式：

*   一个 [`loop` 表达式](#infinite-loops)表示无限循环。 * 一个 [`while` 表达式](#predicate-loops)在谓词为假时停止循环。 * 一个 [`for` 表达式](#迭代器-loops)从迭代器中提取值，直到迭代器为空时停止循环。 * 一个[带标签的块表达式][expr.loop.block-labels]仅运行一次循环，但可以通过 `break` 提前退出循环。

<a id="expr.loop.break-label"></a> 所有四种类型的循环都支持 [`break` 表达式](#break-expressions)和[标签](#loop-labels)。

<a id="expr.loop.continue-label"></a> 除了带标签的块表达式外，所有类型都支持 [`continue` 表达式](#continue-expressions)。

<a id="expr.loop.explicit-result"></a> 只有 `loop` 和带标签的块表达式支持[评估为非平凡值](#break-and-loop-values)。

<a id="expr.loop.infinite"></a>
## 无限循环

<a id="expr.loop.infinite.syntax"></a> 
```grammar,expressions
InfiniteLoopExpression -> `loop` BlockExpression
```

<a id="expr.loop.infinite.intro"></a> `loop` 表达式会连续重复执行其主体：`loop { println!("I live."); }`。

<a id="expr.loop.infinite.diverging"></a> 没有关联 [`break` 表达式的`loop` 表达式是[发散的]，其类型为 [`!`]。

<a id="expr.loop.infinite.break"></a> 包含关联 [`break` 表达式的`loop` 表达式可以终止，且类型必须与 `break` 表达式的值兼容。

<a id="expr.loop.while"></a>
## 谓词循环

<a id="expr.loop.while.syntax"></a> 
```grammar,expressions
PredicateLoopExpression -> `while` Conditions BlockExpression
```

<a id="expr.loop.while.intro"></a> `while` 循环表达式允许在一组条件仍然为真时重复执行块。

<a id="expr.loop.while.condition"></a> 条件操作数必须是具有[布尔类型]的[表达式]，或是一个条件性的 `let` 匹配。如果所有条件操作数都评估为 `true`，并且所有 `let` 模式成功匹配它们的[监视器]，则循环主体块将被执行。

<a id="expr.loop.while.repeat"></a> 在循环主体成功执行后，会重新评估条件操作数以确定是否应再次执行主体。

<a id="expr.loop.while.exit"></a> 如果任何条件操作数评估为 `false`，或任何 `let` 模式不符合其 scrutinizer，则主体不会执行，执行会在 `while` 表达式之后继续。

<a id="expr.loop.while.eval"></a> `while` 表达式会评估为 `()`。

一个示例：

```rust
let mut i = 0;

while i < 10 {
    println!("hello");
    i = i + 1;
}
```

<a id="expr.loop.while.let"></a>
### `while let` 模式

<a id="expr.loop.while.let.intro"></a> `while` 条件中的 `let` 模式允许在模式匹配成功时将新变量绑定到作用域中。以下示例展示了使用 `let` 模式的绑定方式：

```rust
let mut x = vec![1, 2, 3];

while let Some(y) = x.pop() {
    println!("y = {}", y);
}

while let _ = 5 {
    println!("Irrefutable patterns are always true");
    break;
}
```

<a id="expr.loop.while.let.desugar"></a> `while let` 循环等同于包含 [`match` 表达式]的 `loop` 表达式，如下所示。

<!-- ignore: expansion example -->
```rust,ignore
'label: while let PATS = EXPR {
    /* loop body */
}
```

等价于

<!-- ignore: expansion example -->
```rust,ignore
'label: loop {
    match EXPR {
        PATS => { /* loop body */ },
        _ => break,
    }
}
```

<a id="expr.loop.while.let.or-pattern"></a> 可以使用 `|` 运算符指定多个模式。其语义与 `match` 表达式中的 `|` 相同。

```rust
let mut vals = vec![2, 3, 1, 2, 2];
while let Some(v @ 1) | Some(v @ 2) = vals.pop() {
    // Prints 2, 2, then 1
    println!("{}", v);
}
```

<a id="expr.loop.while.chains"></a>
### `while` 条件链

<a id="expr.loop.while.chains.intro"></a> 多个条件操作数可以用 `&&` 分隔。它们的语义和限制与 [`if` 条件链]相同。

以下是链式连接多个表达式的示例，混合了 `let` 绑定和布尔表达式，以及能够引用前序表达式中的模式绑定的表达式：

```rust
fn main() {
    let outer_opt = Some(Some(1i32));

    while let Some(inner_opt) = outer_opt
        && let Some(number) = inner_opt
        && number == 1
    {
        println!("Peek a boo");
        break;
    }
}
```

<a id="expr.loop.for"></a>
## 迭代器循环

<a id="expr.loop.for.syntax"></a> 
```grammar,expressions
IteratorLoopExpression ->
    `for` Pattern `in` Expression _except [StructExpression]_ BlockExpression
```
<!-- TODO: The exception above isn't accurate, see https://github.com/rust-lang/reference/issues/569 -->

<a id="expr.loop.for.intro"></a> `for` 表达式是一种语法结构，用于通过 `std::iter::IntoIterator` 实现的实现来遍历元素。

<a id="expr.loop.for.condition"></a> 如果迭代器产生一个值，该值将与不可更改的模式进行匹配，循环主体将被执行，然后控制返回到 `for` 循环的起始位置。如果迭代器为空，`for` 表达式则完成。

一个对数组内容使用 `for` 循环的示例：

```rust
let v = &["apples", "cake", "coffee"];

for text in v {
    println!("I like {}.", text);
}
```

一个对一系列整数使用 for 循环的示例：

```rust
let mut sum = 0;
for n in 1..11 {
    sum += n;
}
assert_eq!(sum, 55);
```

<a id="expr.loop.for.desugar"></a> `for` 循环等同于包含 [`match` 表达式]的 `loop` 表达式，如下所示：

<!-- ignore: expansion example -->
```rust,ignore
'label: for PATTERN in iter_expr {
    /* loop body */
}
```

等价于

<!-- ignore: expansion example -->
```rust,ignore
{
    let result = match IntoIterator::into_iter(iter_expr) {
        mut iter => 'label: loop {
            let mut next;
            match Iterator::next(&mut iter) {
                Option::Some(val) => next = val,
                Option::None => break,
            };
            let PATTERN = next;
            let () = { /* loop body */ };
        },
    };
    result
}
```

<a id="expr.loop.for.lang-items"></a> `IntoIterator`、`Iterator` 和 `Option` 在此始终为标准库项，并非当前作用域中这些名称所指向的内容。

变量名 `next`、`iter` 和 `val` 仅用于说明目的，实际上用户无法输入这些名称。

> [!NOTE]
> The outer `match` is used to ensure that any [temporary values] in `iter_expr` don't get dropped before the loop is finished. `next` is declared before being assigned because it results in types being inferred correctly more often.

<a id="expr.loop.label"></a>
## 循环标签

<a id="expr.loop.label.syntax"></a> 
```grammar,expressions
LoopLabel -> LIFETIME_OR_LABEL `:`
```

<a id="expr.loop.label.intro"></a> 循环表达式可以可选地包含 _标签_。该标签以生命周期形式出现在循环表达式之前，例如 `'foo: loop { break 'foo; }`、`'bar: while false {}` 和 `'humbug: for _ in 0..0 {}`。

<a id="expr.loop.label.control-flow"></a> 如果存在标签，则嵌套在该循环内的 `break` 和 `continue` 表达式可以跳出该循环或将控制返回到其起始位置。请参阅 [break expressions](#break-expressions) 和 [continue expressions](#continue-expressions)。

<a id="expr.loop.label.ref"></a> 标签遵循局部变量的整洁性和遮蔽规则。例如，以下代码将输出 "outer loop"：

```rust
'a: loop {
    'a: loop {
        break 'a;
    }
    print!("outer loop");
    break 'a;
}
```

`'_` 不是有效的循环标签。

<a id="expr.loop.break"></a>
## `break` 表达式

<a id="expr.loop.break.syntax"></a> 
```grammar,expressions
BreakExpression -> `break` LIFETIME_OR_LABEL? Expression?
```

<a id="expr.loop.break.intro"></a> 当遇到 `break` 时，相关循环体的执行会立即终止，例如：

```rust
let mut last = 0;
for x in 1..100 {
    if x > 12 {
        break;
    }
    last = x;
}
assert_eq!(last, 12);
```

<a id="expr.loop.break.diverging"></a> `break` 表达式属于 [diverging] 类型，其类型为 [`!`。

<a id="expr.loop.break.label"></a> `break` 表达式通常与包含该表达式的最内层 `loop`、`for` 或 `while` 循环相关，但可以使用 [label](#loop-labels) 来指定受影响的包围循环。例如：

```rust
'outer: loop {
    while true {
        break 'outer;
    }
}
```

<a id="expr.loop.break.value"></a> `break` 表达式仅允许出现在循环体内，其形式包括 `break`、`break 'label`、([参见下方](#break-and-loop-values)) `break EXPR` 或 `break 'label EXPR`。

<a id="expr.loop.break-value.implicit-value"></a> 在带有 `break` 表达式的 [`loop`][expr.loop.break-value] 或带标签的块表达式中，没有表达式的 `break` 等同于 `break ()`。

<a id="expr.loop.block-labels"></a>
## 带标签的块表达式

<a id="expr.loop.block-labels.syntax"></a> 
```grammar,expressions
LabelBlockExpression -> BlockExpression
```

<a id="expr.loop.block-labels.intro"></a> 带标签的块表达式与普通块表达式完全相同，不同之处在于它们允许在块内部使用 `break` 表达式。

<a id="expr.loop.block-labels.break"></a> 与循环不同，带标签的块表达式中的 `break` 表达式*必须*带有标签（即标签不是可选的）。

<a id="expr.loop.block-labels.label-required"></a> 同样，带标签的块表达式*必须*以标签开头。

```rust
# fn do_thing() {}
# fn condition_not_met() -> bool { true }
# fn do_next_thing() {}
# fn do_last_thing() {}
let result = 'block: {
    do_thing();
    if condition_not_met() {
        break 'block 1;
    }
    do_next_thing();
    if condition_not_met() {
        break 'block 2;
    }
    do_last_thing();
    3
};
```

<a id="expr.loop.block-labels.type"></a> 带标签的块表达式的类型是所有 `break` 操作数和最终操作数的[最小上界]。如果省略最终操作数，则最终操作数的类型默认为[单位类型]，除非该块[发散][expr.block.diverging]，此时其类型为[永不会出现的类型]。

> [!EXAMPLE]
> ```rust
> fn example(condition: bool) {
>     let s = String::from("owned");
>
>     let _: &str = 'block: {
>         if condition {
>             break 'block &s;  // &String coerced to &str via Deref
>         }
>         break 'block "literal";  // &'static str coerced to &str
>     };
> }
> ```

<a id="expr.loop.continue"></a>
## `continue` 表达式

<a id="expr.loop.continue.syntax"></a> 
```grammar,expressions
ContinueExpression -> `continue` LIFETIME_OR_LABEL?
```

<a id="expr.loop.continue.intro"></a> 当遇到 `continue` 时，相关循环体的当前迭代会立即终止，控制权返回到循环*头部*。

<a id="expr.loop.continue.diverging"></a> `continue` 表达式处于[发散]状态，其类型为 [`!`]。

<a id="expr.loop.continue.while"></a> 在 `while` 循环中，其头部是控制循环的条件操作数。

<a id="expr.loop.continue.for"></a> 在 `for` 循环中，其头部是控制循环的调用表达式。

<a id="expr.loop.continue.label"></a> 与 `break` 类似，`continue` 通常与最内层的循环相关联，但可以使用 `continue 'label'` 来指定受影响的循环。

<a id="expr.loop.continue.in-loop-only"></a> `continue` 表达式仅允许在循环的体内使用。

<a id="expr.loop.break-value"></a>
## `break` 和循环值

<a id="expr.loop.break-value.intro"></a> 当与 `loop` 关联时，可以使用 `break` 表达式通过 `break EXPR` 或 `break 'label EXPR` 的形式从该循环返回一个值，其中 `EXPR` 是来自 `loop` 的返回值。例如：

```rust
let (mut a, mut b) = (1, 1);
let result = loop {
    if b > 10 {
        break b;
    }
    let c = a + b;
    a = b;
    b = c;
};
// first number in Fibonacci sequence over 10:
assert_eq!(result, 13);
```

<a id="expr.loop.break-value.type"></a> 带有 `break` 表达式的 `loop` 的类型是所有 `break` 操作数的[最小上界]。

> [!EXAMPLE]
> ```rust
> fn example(condition: bool) {
>     let s = String::from("owned");
>
>     let _: &str = loop {
>         if condition {
>             break &s; // &String coerced to &str via Deref
>         }
>         break "literal"; // &'static str coerced to &str
>     };
> }
> ```

<a id="expr.loop.break-value.diverging"></a> 带有相关 `break` 表达式的 `loop` 不会[发散]，只要任意一个 `break` 操作数没有发散。如果所有 `break` 操作数都发散，则 `loop` 表达式也会发散。

> [!EXAMPLE]
> ```rust
> fn diverging_loop_with_break(condition: bool) -> ! {
>     // This loop is diverging because all `break` operands are diverging.
>     loop {
>         if condition {
>             break loop {};
>         } else {
>             break panic!();
>         }
>     }
> }
> ```
>
> ```rust,compile_fail,E0308
> fn loop_with_non_diverging_break(condition: bool) -> ! {
>     // The type of this loop is i32 even though one of the breaks is
>     // diverging.
>     loop {
>         if condition {
>             break loop {};
>         } else {
>             break 123i32;
>         }
>     } // ERROR: expected `!`, found `i32`
> }
> ```

[`!`]: type.never
[diverge]: divergence
[diverging]: divergence
[labeled block expression]: expr.loop.block-labels
[least upper bound]: coerce.least-upper-bound
[never type]: type.never
[unit type]: type.tuple.unit

[`if` condition chains]: if-expr.md#chains-of-conditions
[`if` expressions]: if-expr.md
[`match` expression]: match-expr.md
[boolean type]: ../types/boolean.md
[scrutinee]: ../glossary.md#scrutinee
[temporary values]: ../expressions.md#temporaries
