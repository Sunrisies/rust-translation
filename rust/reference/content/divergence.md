<a id="divergence"></a>
# 发散

<a id="divergence.intro"></a> *发散表达式* 是指永远不会完成正常执行的表达式。

```rust
fn diverges() -> ! {
    panic!("This function never returns!");
}

fn example() {
    let x: i32 = diverges(); // This line never completes.
    println!("This is never printed: {x}");
}
```

关于特定表达式的发散行为，请参阅以下规则：

- [expr.block.diverging] --- 块式表达式。 - [expr.if.diverging] --- `if` 表达式。 - [expr.loop.block-labels.type] --- 带有 `break` 的带标签块式表达式。 - [expr.loop.break-value.diverging] --- 带有 `break` 的 `loop` 表达式。 - [expr.loop.break.diverging] --- `break` 表达式。 - [expr.loop.continue.diverging] --- `continue` 表达式。 - [expr.loop.infinite.diverging] --- 无限 `loop` 表达式。 - [expr.match.diverging] --- `match` 表达式。 - [expr.match.empty] --- 空 `match` 表达式。 - [expr.return.diverging] --- `return` 表达式。

> [!NOTE]
> The [`panic!`] macro and related panic-generating macros like [`unreachable!`] also have the type [`!`] and are diverging.

<a id="divergence.never"></a> 任何类型为 [`!`]的表达式都是发散表达式。不过，发散表达式并不限于类型 [`!`];其他类型的表达式也可能发散（例如，`Some(loop {})` 的类型为 `Option<!>`）。

> [!NOTE]
> Though `!` is considered an uninhabited type, a type being uninhabited is not sufficient for it to diverge.
>
> ```rust,compile_fail,E0308
> enum Empty {}
> fn make_never() -> ! {loop{}}
> fn make_empty() -> Empty {loop{}}
>
> fn diverging() -> ! {
>     // This has a type of `!`.
>     // So, the entire function is considered diverging.
>     make_never();
>     // OK: The type of the body is `!` which matches the return type.
> }
> fn not_diverging() -> ! {
>     // This type is uninhabited.
>     // However, the entire function is not considered diverging.
>     make_empty();
>     // ERROR: The type of the body is `()` but expected type `!`.
> }
> ```

> [!NOTE]
> Divergence can propagate to the surrounding block. See [expr.block.diverging].

<a id="divergence.fallback"></a>
## 回退

如果某个要推断的类型仅与发散表达式一致，则该类型将被推断为 [`!`]。

> [!EXAMPLE]
> ```rust,compile_fail,E0277
> fn foo() -> i32 { 22 }
> match foo() {
>     // ERROR: The trait bound `!: Default` is not satisfied.
>     4 => Default::default(),
>     _ => return,
> };
> ```

> [!NOTE]
> Importantly, type unification may happen *structurally*, so the fallback `!` may be part of a larger type. The following compiles:
>
> ```rust
> fn foo() -> i32 { 22 }
> // This has the type `Option<!>`, not `!`
> match foo() {
>     4 => Default::default(),
>     _ => Some(return),
> };
> ```

<!-- TODO: This last point should likely should be moved to a more general "type inference" section discussing generalization + unification. -->

[`!`]: type.never


