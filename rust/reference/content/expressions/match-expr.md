<a id="expr.match"></a>
# `match` 表达式

<a id="expr.match.syntax"></a> 
```grammar,expressions
MatchExpression ->
    `match` Scrutinee `{`
        InnerAttribute*
        MatchArms?
    `}`

Scrutinee -> Expression _except [StructExpression]_

MatchArms ->
    ( MatchArm `=>` ( ExpressionWithoutBlock `,` | ExpressionWithBlock `,`? ) )*
    MatchArm `=>` Expression `,`?

MatchArm -> OuterAttribute* Pattern MatchArmGuard?

MatchArmGuard -> `if` MatchConditions

MatchConditions ->
     MatchGuardChain
   | Expression

MatchGuardChain -> MatchGuardCondition ( `&&` MatchGuardCondition )*

MatchGuardCondition ->
     Expression _except [ExcludedMatchConditions]_
   | OuterAttribute* `let` Pattern `=` MatchGuardScrutinee

MatchGuardScrutinee -> Expression _except [ExcludedMatchConditions]_

@root ExcludedMatchConditions ->
      LazyBooleanExpression
    | RangeExpr
    | RangeFromExpr
    | RangeInclusiveExpr
    | AssignmentExpression
    | CompoundAssignmentExpression
```
<!-- TODO: The exception above isn't accurate, see https://github.com/rust-lang/reference/issues/569 -->

<a id="expr.match.intro"></a> 一个 *`match` 表达式*根据模式进行分支。具体的匹配形式取决于[模式]。

<a id="expr.match.scrutinee"></a> 一个 `match` 表达式包含一个*[scrutinee] 表达式，该表达式用于与模式进行比较。

<a id="expr.match.scrutinee-constraint"></a> [scrutinee] 表达式和模式必须具有相同的类型。

<a id="expr.match.scrutinee-behavior"></a> `match`的行为取决于*[place expression或value expression][place expression]] whether或不是 [scrutinee] 表达式为[位置表达式或值表达式]。

<a id="expr.match.scrutinee-value"></a> 如果 [scrutinee] 表达式为[值表达式]，则首先将其评估为临时变量，然后依次将结果值与分支中的模式进行比较，直到找到匹配项。具有匹配模式的第一个分支被选为 `match` 的分支目标，由模式绑定的任何变量会被赋给该分支中的局部变量，随后控制进入该分支。

<a id="expr.match.scrutinee-place"></a> 当 [scrutinee] 表达式为[位置表达式]时，匹配不会分配临时变量；但是，按值绑定可能会复制或移动内存位置。在可能的情况下，最好对位置表达式进行匹配，因为这些匹配的生命周期与位置表达式的生命周期相同，而不是仅限于匹配内部。

一个 `match` 表达式的示例：

```rust
let x = 1;

match x {
    1 => println!("one"),
    2 => println!("two"),
    3 => println!("three"),
    4 => println!("four"),
    5 => println!("five"),
    _ => println!("something else"),
}
```

<a id="expr.match.pattern-vars"></a> 模式内绑定的变量仅属于匹配保护器和分支中的表达式的作用域。

<a id="expr.match.pattern-var-binding"></a> [绑定方式](移动、复制或引用)取决于模式。

<a id="expr.match.or-pattern"></a> 多个匹配模式可以通过 `|` 运算符连接。每个模式将按从左到右的顺序进行测试，直到找到成功的匹配项。

```rust
let x = 9;
let message = match x {
    0 | 1  => "not many",
    2 ..= 9 => "a few",
    _      => "lots"
};

assert_eq!(message, "a few");

// Demonstration of pattern match order.
struct S(i32, i32);

match S(1, 2) {
    S(z @ 1, _) | S(_, z @ 2) => assert_eq!(z, 1),
    _ => panic!(),
}
```

> [!NOTE]
> The `2..=9` is a [Range Pattern], not a [Range Expression]. Thus, only those types of ranges supported by range patterns can be used in match arms.

<a id="expr.match.or-patterns-restriction"></a> 每个 `|` 分隔的模式中的每一处绑定都必须在分支中的所有模式中出现。

<a id="expr.match.binding-restriction"></a> 所有相同名称的绑定必须具有相同的类型，并且具有相同的绑定模式。

<a id="expr.match.type"></a> 整体 `match` 表达式的类型是各个匹配分支的[最小上界]。

<a id="expr.match.empty"></a> 如果没有任何匹配分支，则 `match` 表达式为[发散状态]，其类型为 [`!`]。

> [!EXAMPLE]
> ```rust
> enum Empty {}
>
> fn diverging_match_no_arms(e: Empty) -> ! {
>     match e {}
> }
> ```


<a id="expr.match.diverging"></a> 如果检查表达式或所有匹配分支都发散，则整个 `match` 表达式也会发散。

<a id="expr.match.guard"></a>
## 匹配守卫

<a id="expr.match.guard.intro"></a> 匹配分支可以接受_匹配守卫_以进一步细化匹配某个情况的标准。

<a id="expr.match.guard.condition"></a> 模式守卫出现在 `if` 关键字后的模式中，由具有[布尔类型][type.bool]的[表达式]或条件性 `let` 匹配组成。

<a id="expr.match.guard.behavior"></a> 当模式成功匹配时，模式守卫会被执行。如果所有守卫条件操作数都评估为 `true`，并且所有 `let` 模式成功匹配其[检查器]，则匹配分支成功匹配，并执行该分支的主体。

<a id="expr.match.guard.next"></a> 否则，测试下一个模式，包括同一分支中带有 `|` 运算符的其他匹配项。

```rust
# let maybe_digit = Some(0);
# fn process_digit(i: i32) { }
# fn process_other(i: i32) { }
let message = match maybe_digit {
    Some(x) if x < 10 => process_digit(x),
    Some(x) => process_other(x),
    None => panic!(),
};
```

> [!NOTE]
> Multiple matches using the `|` operator can cause the pattern guard and the side effects it has to execute multiple times. For example:
>
> ```rust
> # use std::cell::Cell;
> let i : Cell<i32> = Cell::new(0);
> match 1 {
>     1 | _ if { i.set(i.get() + 1); false } => {}
>     _ => {}
> }
> assert_eq!(i.get(), 2);
> ```

<a id="expr.match.guard.bound-variables"></a> 模式守卫可以引用其后面模式中绑定的变量。

<a id="expr.match.guard.shared-ref"></a> 在评估守卫之前，会获取对变量所匹配的检查器部分的共享引用。在评估守卫时，该共享引用用于访问变量。

<a id="expr.match.guard.value"></a> 只有当守卫成功评估时，值才会从检查器中移动或复制到变量中。这允许在守卫内部使用共享借用，而无需在守卫匹配失败的情况下将值移出检查器。

<a id="expr.match.guard.no-mutation"></a> 此外，通过在评估守卫时持有共享引用，也防止了守卫内部的变异。

<a id="expr.match.guard.let"></a> 保护机制可以使用 `let` 模式来条件性匹配检查项，并在模式匹配成功时将新变量绑定到作用域中。

> [!EXAMPLE]
> In this example, the guard condition `let Some(first_char) = name.chars().next()` is evaluated. If the `let` pattern successfully matches (i.e. the string has at least one character), the arm's body is executed. Otherwise, pattern matching continues to the next arm.
>
> The `let` pattern creates a new binding (`first_char`), which can be used alongside the original pattern bindings (`name`) in the arm's body.
> ```rust
> # enum Command {
> #     Run(String),
> #     Stop,
> # }
> let cmd = Command::Run("example".to_string());
>
> match cmd {
>     Command::Run(name) if let Some(first_char) = name.chars().next() => {
>         // Both `name` and `first_char` are available here
>         println!("Running: {name} (starts with '{first_char}')");
>     }
>     Command::Run(name) => {
>         println!("{name} is empty");
>     }
>     _ => {}
> }
> ```

<a id="expr.match.guard.chains"></a>
## 匹配保护链

<a id="expr.match.guard.chains.intro"></a> 多个保护条件操作数之间可以使用 `&&` 进行连接。

> [!EXAMPLE]
> ```rust
> # let foo = Some([123]);
> # let already_checked = false;
> match foo {
>     Some(xs) if let [single] = xs && !already_checked => { dbg!(single); }
>     _ => {}
> }
> ```

<a id="expr.match.guard.chains.order"></a> 类似于 `&&` [LazyBooleanExpression]，每个操作数从左到右依次评估，直到某个操作数为 `false` 或 `let` 匹配失败，此时后续操作数不再被评估。

<a id="expr.match.guard.chains.bindings"></a> 每个 `let` 模式的绑定会被放入作用域中，以便用于下一个条件操作数和匹配分支体。

<a id="expr.match.guard.chains.or"></a> 如果任何保护条件操作数为 `let` 模式，则由于与 `let` 检查项的歧义和优先级问题，其他条件操作数不能使用 `||` [lazy boolean operator expression][expr.bool-logic]。

> [!EXAMPLE]
> If a `||` expression is needed, then parentheses can be used. For example:
>
> ```rust
> # let foo = Some([123]);
> match foo {
>     Some(xs) if let [x] = xs
>         // Parentheses are required here.
>         && (x < -100 || x > 20) => {}
>     _ => {}
> }
> ```

<a id="expr.match.attributes"></a>
## 匹配分支的属性

<a id="expr.match.attributes.outer"></a> 允许在匹配分支上设置外部属性。在匹配分支上具有意义的属性只有 [`cfg`]和[lint检查属性]。

<a id="expr.match.attributes.inner"></a> [内部属性]可以在匹配表达式的开括号之后直接定义，其上下文与[块表达式的属性]相同。

[`!`]: type.never
[diverging]: divergence
[least upper bound]: coerce.least-upper-bound

[`cfg`]: ../conditional-compilation.md
[attributes on block expressions]: block-expr.md#attributes-on-block-expressions
[binding mode]: ../patterns.md#binding-modes
[Inner attributes]: ../attributes.md
[lint check attributes]: ../attributes/diagnostics.md#lint-check-attributes
[pattern]: ../patterns.md
[place expression]: ../expressions.md#place-expressions-and-value-expressions
[Range Expression]: range-expr.md
[Range Pattern]: ../patterns.md#range-patterns
[scrutinee]: ../glossary.md#scrutinee
[value expression]: ../expressions.md#place-expressions-and-value-expressions
