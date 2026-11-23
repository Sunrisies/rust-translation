<a id="statement"></a>
# 语句

<a id="statement.syntax"></a> 
```grammar,statements
Statement ->
      `;`
    | Item
    | LetStatement
    | ExpressionStatement
    | OuterAttribute* MacroInvocationSemi
```

<a id="statement.intro"></a> 一个*语句*是[块]的一个组成部分，而[块]又是外部[表达式]或[函数]的组成部分。

<a id="statement.kind"></a> Rust 有两种类型的语句：[声明语句](#declaration-statements)和[表达式语句](#expression-statements)。

<a id="statement.decl"></a>
## 声明语句

一个*声明语句*是引入一个或多个*名称*到封闭语句块中的语句。被声明的名称可以表示新的变量或新的[项][item]。

这两种声明语句分别是项声明和`let`语句。

<a id="statement.item"></a>
### 项声明

<a id="statement.item.intro"></a> 一个*项声明语句*具有与[模块]中的[项声明][item]相同的语法形式。

<a id="statement.item.scope"></a> 在语句块中声明一项会将其[作用域]限制在该语句所在的块内。该项不会获得[规范路径]，也不会拥有其可能声明的子项。

<a id="statement.item.associated-scope"></a> 例外情况是，由[实现]定义的相关项只要该项和（如适用）特质可访问，仍然可以在外部作用域中访问。其含义与在模块内声明该项相同。

<a id="statement.item.outer-generics"></a> 不会隐式捕获包含函数的泛型参数、参数和局部变量。例如，`inner`无法访问`outer_var`。

```rust
fn outer() {
  let outer_var = true;

  fn inner() { /* outer_var is not in scope here */ }

  inner();
}
```

<a id="statement.let"></a>
### `let`语句

<a id="statement.let.syntax"></a> 
```grammar,statements
LetStatement ->
    OuterAttribute* `let` PatternNoTopAlt ( `:` Type )?
    (
          `=` Expression
        | `=` Expression _except [LazyBooleanExpression] or end with a `}`_
              `else` BlockExpressionNoInnerAttributes
    )? `;`
```

<a id="statement.let.intro"></a> 一个*`let`语句*引入一组新的[变量]，这些变量由[模式]指定。该模式可以 optionally后跟类型注释，然后结束，或者后跟初始化表达式加上可选的`else`块。

<a id="statement.let.inference"></a> 当没有给出类型注释时，编译器会推断类型；如果无法获得足够的类型信息以进行确定性推断，则会产生错误。

<a id="statement.let.scope"></a> 由变量声明引入的任何变量，在声明点至封闭块作用域结束期间都是可见的，除非被其他变量声明覆盖。

<a id="statement.let.constraint"></a> 如果不存在 `else` 块，模式必须是不可辩驳的；如果存在 `else` 块，模式可以是可辩驳的。

<a id="statement.let.behavior"></a> 如果模式不匹配（这要求它是可辩驳的），则执行 `else` 块。`else` 块必须始终产生不同的结果（评估为 [never type]）。

```rust
let (mut v, w) = (vec![1, 2, 3], 42); // The bindings may be mut or const
let Some(t) = v.pop() else { // Refutable patterns require an else block
    panic!(); // The else block must diverge
};
let [u, v] = [v[0], v[1]] else { // This pattern is irrefutable, so the compiler
                                 // will lint as the else block is redundant.
    panic!();
};
```

<a id="statement.expr"></a>
## 表达式语句

<a id="statement.expr.syntax"></a> 
```grammar,statements
ExpressionStatement ->
      ExpressionWithoutBlock `;`
    | ExpressionWithBlock `;`?
```

<a id="statement.expr.intro"></a> *表达式语句*是指评估一个[表达式]并忽略其结果的语句。通常，表达式语句的目的是触发其表达式的评估效果。

<a id="statement.expr.restriction-semicolon"></a> 如果表达式仅由[块表达式][block]或控制流表达式组成，并且在允许语句使用的上下文中使用，可以省略末尾的分号。这可能导致将其解析为独立语句与作为其他表达式的一部分产生歧义；在这种情况下，它被解析为语句。

<a id="statement.expr.constraint-block"></a> 当[ExpressionWithBlock]表达式用作语句时，其类型必须是单元类型。

```rust
# let mut v = vec![1, 2, 3];
v.pop();          // Ignore the element returned from pop
if v.is_empty() {
    v.push(5);
} else {
    v.remove(0);
}                 // Semicolon can be omitted.
[1];              // Separate expression statement, not an indexing expression.
```

当省略末尾分号时，结果必须类型为 `()`。

```rust
// bad: the block's type is i32, not ()
// Error: expected `()` because of default return type
// if true {
//   1
// }

// good: the block's type is i32
if true {
  1
} else {
  2
};
```

<a id="statement.attribute"></a>
## 语句的属性

语句接受[外部属性]。对语句有意义的属性包括 [`cfg`]和[lint检查属性]。

[block]: expressions/block-expr.md
[expression]: expressions.md
[function]: items/functions.md
[item]: items.md
[module]: items/modules.md
[never type]: types/never.md
[canonical path]: paths.md#canonical-paths
[implementations]: items/implementations.md
[variables]: variables.md
[outer attributes]: attributes.md
[`cfg`]: conditional-compilation.md
[the lint check attributes]: attributes/diagnostics.md#lint-check-attributes
[pattern]: patterns.md
[scope]: names/scopes.md
