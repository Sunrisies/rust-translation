- 功能名称：syntax-tree-patterns - 开始日期：2019-03-12 - RFC PR： [#3875](https://github.com/rust-lang/rust-Clippy/pull/3875)

# Summary

引入一种领域特定语言（类似于正则表达式），以便使用*语法树模式*来描述代码检查项。


# Motivation

在编写代码检查项时，找到具有特定属性的语法树部分（如“一个以块作为条件的 if 语句”）是一个重要任务。对于非简单的代码检查项，通常需要对 AST / HIR 节点进行嵌套的模式匹配。例如，测试某个表达式是否为布尔字面量需要以下检查：

```rust,ignore
if let ast::ExprKind::Lit(lit) = &expr.node {
    if let ast::LitKind::Bool(_) = &lit.node {
        ...
    }
}
```

快速编写这种模式匹配代码变得非常复杂，生成的代码也往往难以理解。下面的代码展示了 `collapsible_if` 代码检查项所需的简化版模式匹配：

```rust,ignore
// simplified version of the collapsible_if lint
if let ast::ExprKind::If(check, then, None) = &expr.node {
    if then.stmts.len() == 1 {
        if let ast::StmtKind::Expr(inner) | ast::StmtKind::Semi(inner) = &then.stmts[0].node {
            if let ast::ExprKind::If(check_inner, content, None) = &inner.node {
                ...
            }
        }
    }
}
```

`if_chain` 宏可以通过展平嵌套的 if 语句来提高可读性，但生成的代码仍然相当难读：

```rust
// simplified version of the collapsible_if lint
if_chain! {
    if let ast::ExprKind::If(check, then, None) = &expr.node;
    if then.stmts.len() == 1;
    if let ast::StmtKind::Expr(inner) | ast::StmtKind::Semi(inner) = &then.stmts[0].node;
    if let ast::ExprKind::If(check_inner, content, None) = &inner.node;
    then {
        ...
    }
}
```

上面的代码可以匹配仅包含另一个 if 表达式的 if 表达式（即两个 if 都没有 else 分支）。虽然很容易解释该代码检查项的作用，但从上面的代码示例中却难以看出。

基于上述动机，此 RFC 的第一个目标是**简化代码检查的编写和阅读**。

第二个动机是 Clippy 依赖于不稳定的编译器内部数据结构。当前的 Clippy 代码检查项是针对编译器的 AST / HIR 编写的，这意味着这些数据结构的任何微小变化都可能破坏许多代码检查项。此 RFC 的第二个目标就是**使代码检查项独立于编译器的 AST / HIR 数据结构**。

# Approach

目前编写lint工具时遇到的许多复杂性似乎源于必须手动实现匹配逻辑（参见上面的代码示例）。这种命令式风格描述了如何匹配语法树节点，而不是声明性地指定应该与什么进行匹配。在其他领域，通常使用声明性模式来描述所需信息，并让实现部分负责实际的匹配工作。一种著名的此类方法例子是[正则表达式](https://en.wikipedia.org/wiki/Regular_expression)。人们可以使用特定领域的语言描述搜索模式，然后利用该模式来查找匹配项，而无需编写检测特定字符序列的代码。使用声明性领域语言的优势在于其有限的领域范围（例如，在正则表达式中就是字符序列的匹配），使得在该领域内表达实体能够以非常自然且富有表现力的方式实现。

虽然正则表达式在搜索扁平字符序列中的模式时非常有用，但它们难以直接应用于语法树这样的层次化数据结构。因此，此RFC提出了一个受正则表达式启发的模式匹配系统，专为层次化语法树设计。

# 指导级别的说明

本提案增加了一个`pattern!`宏，可用于指定要搜索的语法树模式。下面是一个简单的模式示例：

```rust
pattern!{
    my_pattern: Expr =
        Lit(Bool(false))
}
```

这个宏调用定义了一个名为`my_pattern`的模式，该模式可以与`Expr`语法树节点进行匹配。实际的模式（`Lit(Bool(false)`）在此情况下定义了哪些语法树应该与该模式匹配。此模式匹配值为`false`的布尔字面量表达式。

然后可以通过以下方式使用该模式来实现lint工具：

```rust,ignore
...

impl EarlyLintPass for MyAwesomeLint {
    fn check_expr(&mut self, cx: &EarlyContext, expr: &syntax::ast::Expr) {

        if my_pattern(expr).is_some() {
            cx.span_lint(
                MY_AWESOME_LINT,
                expr.span,
                "This is a match for a simple pattern. Well done!",
            );
        }

    }
}
```

`pattern!`宏调用会展开为一个名为`my_pattern`的函数，该函数接受语法树表达式作为参数，并返回一个`Option`，指示模式是否匹配。

> [!NOTE] > 结果类型的详细说明可在 [后续章节](#the-result-type) 中找到。目前只需知道，如果模式匹配成功，结果为 `Some`，否则为 `None`。

## 模式语法

以下示例展示了模式语法：


#### Any (`_`)

最简单的模式是任意模式。它可以匹配任何内容，因此类似于正则表达式的 `*`。

```rust
pattern!{
    // matches any expression
    my_pattern: Expr =
        _
}
```

#### Node（`<node-name>(<args>)`）

节点用于匹配 AST 节点的特定变体。节点有一个名称，以及取决于节点类型的参数数量。例如，`Lit` 节点有一个参数，描述字面量的类型。另一个例子是 `If` 节点有三个参数，分别描述条件块、then 块和 else 块。

```rust
pattern!{
    // matches any expression that is a literal
    my_pattern: Expr =
        Lit(_)
}

pattern!{
    // matches any expression that is a boolean literal
    my_pattern: Expr =
        Lit(Bool(_))
}

pattern!{
    // matches if expressions that have a boolean literal in their condition
    // Note: The `_?` syntax here means that the else branch is optional and can be anything.
    //       This is discussed in more detail in the section `Repetition`.
    my_pattern: Expr =
        If( Lit(Bool(_)) , _, _?)
}
```


#### Literal（`<lit>`）

模式也可以包含 Rust 字面量。这些字面量可以自我匹配。

```rust
pattern!{
    // matches the boolean literal false
    my_pattern: Expr =
        Lit(Bool(false))
}

pattern!{
    // matches the character literal 'x'
    my_pattern: Expr =
        Lit(Char('x'))
}
```

#### Alternations (`a | b`)

```rust
pattern!{
    // matches if the literal is a boolean or integer literal
    my_pattern: Lit =
        Bool(_) | Int(_)
}

pattern!{
    // matches if the expression is a char literal with value 'x' or 'y'
    my_pattern: Expr =
        Lit( Char('x' | 'y') )
}
```

#### Empty (`()`)

空模式表示空序列或可选参数的 `None` 变体。

```rust
pattern!{
    // matches if the expression is an empty array
    my_pattern: Expr =
        Array( () )
}

pattern!{
    // matches if expressions that don't have an else clause
    my_pattern: Expr =
        If(_, _, ())
}
```

#### Sequence (`<a> <b>`)

```rust
pattern!{
    // matches the array [true, false]
    my_pattern: Expr =
        Array( Lit(Bool(true)) Lit(Bool(false)) )
}
```

#### Repetition (`<a>*`, `<a>+`, `<a>?`, `<a>{n}`, `<a>{n,m}`, `<a>{n,}`)

元素可以重复出现。指定重复的语法与 [正则表达式的语法](https://docs.rs/regex/1.1.2/regex/#repetitions) 相同。

```rust
pattern!{
    // matches arrays that contain 2 'x's as their last or second-last elements
    // Examples:
    //     ['x', 'x']                         match
    //     ['x', 'x', 'y']                    match
    //     ['a', 'b', 'c', 'x', 'x', 'y']     match
    //     ['x', 'x', 'y', 'z']               no match
    my_pattern: Expr =
        Array( _* Lit(Char('x')){2} _? )
}

pattern!{
    // matches if expressions that **may or may not** have an else block
    // Attn: `If(_, _, _)` matches only ifs that **have** an else block
    //
    //              | if with else block | if without else block
    // If(_, _, _)  |       match        |       no match
    // If(_, _, _?) |       match        |        match
    // If(_, _, ()) |      no match      |        match
    my_pattern: Expr =
        If(_, _, _?)
}
```

#### 命名子匹配（`<a>#<name>`）

```rust
pattern!{
    // matches character literals and gives the literal the name foo
    my_pattern: Expr =
        Lit(Char(_)#foo)
}

pattern!{
    // matches character literals and gives the char the name bar
    my_pattern: Expr =
        Lit(Char(_#bar))
}

pattern!{
    // matches character literals and gives the expression the name baz
    my_pattern: Expr =
        Lit(Char(_))#baz
}
```

使用命名子匹配的原因在 [结果类型](#the-result-type) 章节中有说明。

### Summary

以下表格总结了模式语法：

| Syntax                  | Concept          | Examples                                   |
|-------------------------|------------------|--------------------------------------------|
|`_`                      | Any              | `_`                                        |
|`<node-name>(<args>)`    | Node             | `Lit(Bool(true))`, `If(_, _, _)`           |
|`<lit>`                  | Literal          | `'x'`, `false`, `101`                      |
|`<a> \| <b>`             | Alternation      | `Char(_) \| Bool(_)`                       |
|`()`                     | Empty            | `Array( () )`                              |
|`<a> <b>`                | Sequence         | `Tuple( Lit(Bool(_)) Lit(Int(_)) Lit(_) )` |
|`<a>*` <br> `<a>+` <br> `<a>?` <br> `<a>{n}` <br> `<a>{n,m}` <br> `<a>{n,}` | Repetition <br> <br> <br> <br> <br><br> | `Array( _* )`, <br> `Block( Semi(_)+ )`, <br> `If(_, _, Block(_)?)`, <br> `Array( Lit(_){10} )`, <br> `Lit(_){5,10}`, <br> `Lit(Bool(_)){10,}` |
|`<a>#<name>`             | Named submatch   | `Lit(Int(_))#foo` `Lit(Int(_#bar))`        |


## 结果类型

许多lint工具需要检查超出上述模式语法所能表达范围的内容。例如，lint 可能希望检查节点是否作为宏展开的一部分创建，或者节点上方是否有注释。另一个例子是 lint 想要匹配两个具有相同值的节点（如 `almost_swapped` 等 lint 所需）。与允许用户直接在模式中编写这些检查（这可能会使模式难以阅读）不同，所提出的解决方案允许用户为模式表达式的部分内容指定名称。当将模式与语法树节点进行匹配时，返回值将包含所有被这些命名子模式匹配的节点的引用。这类似于正则表达式中的捕获组。

例如，给定以下模式

```rust
pattern!{
    // matches character literals
    my_pattern: Expr =
        Lit(Char(_#val_inner)#val)#val_outer
}
```

可以以如下方式获取与子模式匹配的节点引用：

```rust,ignore
...
fn check_expr(expr: &syntax::ast::Expr) {
    if let Some(result) = my_pattern(expr) {
        result.val_inner  // type: &char
        result.val        // type: &syntax::ast::Lit
        result.val_outer  // type: &syntax::ast::Expr
    }
}
```

`result` 结构体中的类型取决于模式。例如，以下模式

```rust
pattern!{
    // matches arrays of character literals
    my_pattern_seq: Expr =
        Array( Lit(_)*#foo )
}
```

匹配由任意数量的字面表达式组成的数组。由于这些表达式被命名为 `foo`，因此结果结构体包含一个 `foo` 属性，该属性是一个表达式向量：

```rust,ignore
...
if let Some(result) = my_pattern_seq(expr) {
    result.foo        // type: Vec<&syntax::ast::Expr>
}
```

当名称仅在交替中的一个分支中定义时，会出现另一种结果类型：

```rust
pattern!{
    // matches if expression is a boolean or integer literal
    my_pattern_alt: Expr =
        Lit( Bool(_#bar) | Int(_) )
}
```

在上述模式中，只有当模式匹配布尔字面量时，`bar` 名称才会被设置。如果匹配整数字面量，则不会设置该名称。为此，结果结构体的 `bar` 属性是一个选项类型：

```rust,ignore
...
if let Some(result) = my_pattern_alt(expr) {
    result.bar        // type: Option<&bool>
}
```

如果多个交替分支具有兼容的类型，也可以在同一名称下使用该名称：

```rust,ignore
pattern!{
    // matches if expression is a boolean or integer literal
    my_pattern_mult: Expr =
        Lit(_#baz) | Array( Lit(_#baz) )
}
...
if let Some(result) = my_pattern_mult(expr) {
    result.baz        // type: &syntax::ast::Lit
}
```

命名子模式是一个**扁平**的命名空间，这是预期之中的。在上面的示例中，两个不同的子结构被分配给一个扁平名称。我认为对于大多数lint工具来说，扁平命名空间比层次结构更易于使用且更方便处理。

#### 两个阶段

使用命名子模式，用户可以在两个阶段编写lint代码。首先，模式语法会生成可能的匹配的大致选择。在第二阶段，可以使用命名子模式引用进行额外测试，例如验证某个节点是否未被作为宏展开的一部分创建。

## 使用模式实现 Clippy lint

作为一个“真实世界”示例，我使用模式重新实现了 `collapsible_if` lint。代码可以在 [这里](https://github.com/fkohlgrueber/rust-Clippy-pattern/blob/039b07ecccaf96d6aa7504f5126720d2c9cceddd/clippy_lints/src/collapsible_if.rs#L88-L163)找到。基于模式的版本通过了为 `collapsible_if` 编写的所有测试案例。


# 参考级解释

## Overview

以下图表展示了所提出解决方案的主要部分之间的依赖关系：

```
                          Pattern syntax
                                |
                                |  parsing / lowering
                                v
                           PatternTree
                                ^
                                |
                                |
                          IsMatch trait
                                |
                                |
             +---------------+-----------+---------+
             |               |           |         |
             v               v           v         v
        syntax::ast     rustc::hir      syn       ...
```

前一部分中描述的模式语法会被解析/转换为所谓的 *PatternTree* 数据结构，该数据结构表示有效的语法树模式。将 *PatternTree* 与实际语法树（例如 rust AST / HIR 或 syn AST 等）进行匹配是通过 *IsMatch* trait 实现的。

*PatternTree* 和 *IsMatch* trait 将在后续章节中详细介绍。

## PatternTree

此 RFC 的核心数据结构是 **PatternTree**。

它是一种与 rust 的 AST / HIR 类似的数据结构，但具有以下差异：

- *PatternTree* 不包含如 `Span` 这样的解析信息 - *PatternTree* 可以表示替代项、序列和可选项。

下面的代码展示了当前 *PatternTree* 的简化版本：

> [!NOTE] > 当前实现可在此处找到 > [这里](https://github.com/fkohlgrueber/pattern-matching/blob/dfb3bc9fbab69cec7c91e72564a63ebaa2ede638/pattern-match/src/pattern_tree.rs#L50-L96)。


```rust
pub enum Expr {
    Lit(Alt<Lit>),
    Array(Seq<Expr>),
    Block_(Alt<BlockType>),
    If(Alt<Expr>, Alt<BlockType>, Opt<Expr>),
    IfLet(
        Alt<BlockType>,
        Opt<Expr>,
    ),
}

pub enum Lit {
    Char(Alt<char>),
    Bool(Alt<bool>),
    Int(Alt<u128>),
}

pub enum Stmt {
    Expr(Alt<Expr>),
    Semi(Alt<Expr>),
}

pub enum BlockType {
    Block(Seq<Stmt>),
}
```

`Alt`、`Seq` 和 `Opt` 结构体如下所示：

> [!NOTE] > 当前实现可在此处找到 > [这里](https://github.com/fkohlgrueber/pattern-matching/blob/dfb3bc9fbab69cec7c91e72564a63ebaa2ede638/pattern-match/src/matchers.rs#L35-L60)。

```rust,ignore
pub enum Alt<T> {
    Any,
    Elmt(Box<T>),
    Alt(Box<Self>, Box<Self>),
    Named(Box<Self>, ...)
}

pub enum Opt<T> {
    Any,  // anything, but not None
    Elmt(Box<T>),
    None,
    Alt(Box<Self>, Box<Self>),
    Named(Box<Self>, ...)
}

pub enum Seq<T> {
    Any,
    Empty,
    Elmt(Box<T>),
    Repeat(Box<Self>, RepeatRange),
    Seq(Box<Self>, Box<Self>),
    Alt(Box<Self>, Box<Self>),
    Named(Box<Self>, ...)
}

pub struct RepeatRange {
    pub start: usize,
    pub end: Option<usize>  // exclusive
}
```

## 解析 / 转换

`pattern!` 宏调用的输入首先被解析为 `ParseTree`，然后转换为 `PatternTree`。

有效的模式依赖于 *PatternTree* 的定义。例如，模式 `Lit(Bool(_)*)` 无效，因为 `Expr` 枚举中的 `Lit` 变体的参数类型为 `Any<Lit)`，因此不支持重复（`*`）。另一个例子是 `Array( Lit(_)* )`，这是一个有效的模式，因为 `Array` 的参数类型为 `Seq<Expr>`，允许序列和重复。

> [!NOTE] > 模式语法中的名称对应于 *PatternTree* 枚举的 > **变体**。例如，上述模式中的 `Lit` 指的是 `Expr` 枚举的 `Lit` > 变体（`Expr::Lit`），而不是 `Lit` 枚举。

## *IsMatch* trait

模式语法和 *PatternTree* 与特定的语法树实现（如 rust ast / hir、syn 等）无关。通过查看前几节中的不同模式示例可以发现，这些模式不包含任何特定于某种语法树实现的信息。相比之下，Clippy lint 目前基于 ast / hir 语法树节点进行匹配，因此直接依赖于这些实现。

*PatternTree* 与特定语法树实现之间的连接是通过 `IsMatch` trait 实现的。该特质定义了如何将 *PatternTree* 节点与特定的语法树节点进行匹配。下面展示了 `IsMatch` trait 的简化实现：

```rust,ignore
pub trait IsMatch<O> {
    fn is_match(&self, other: &'o O) -> bool;
}
```

此特质需要在 *PatternTree* 的每个枚举类型上实现（针对相应的语法树类型）。例如，用于匹配 `ast::LitKind` 与 *PatternTree* 的 `Lit` 枚举 的 `IsMatch` 实现可能如下所示：

```rust
impl IsMatch<ast::LitKind> for Lit {
    fn is_match(&self, other: &ast::LitKind) -> bool {
        match (self, other) {
            (Lit::Char(i), ast::LitKind::Char(j)) => i.is_match(j),
            (Lit::Bool(i), ast::LitKind::Bool(j)) => i.is_match(j),
            (Lit::Int(i), ast::LitKind::Int(j, _)) => i.is_match(j),
            _ => false,
        }
    }
}
```

所有用于将当前 *PatternTree* 与 `syntax::ast` 进行匹配的 `IsMatch` 实现均可在 [此处](https://github.com/fkohlgrueber/pattern-matching/blob/dfb3bc9fbab69cec7c91e72564a63ebaa2ede638/pattern-match/src/ast_match.rs)找到。


# Drawbacks

#### Performance

当前的模式匹配代码尚未针对性能进行优化，因此可能比手工编写的匹配代码更慢。此外，两阶段方法（先根据粗略模式进行匹配，再检查额外属性）可能比当前一次性检查结构和额外属性的做法更慢。例如，以下 lint：

```rust,ignore
pattern!{
    pat_if_without_else: Expr =
        If(
            _,
            Block(
                Expr( If(_, _, ())#inner )
                | Semi( If(_, _, ())#inner )
            )#then,
            ()
        )
}
...
fn check_expr(&mut self, cx: &EarlyContext<'_>, expr: &ast::Expr) {
    if let Some(result) = pat_if_without_else(expr) {
        if !block_starts_with_comment(cx, result.then) {
            ...
        }
}
```

首先根据模式进行匹配，然后检查 `then` 块是否以注释开头。使用 Clippy 当前的实现方式，可以在更早的阶段检查这些条件。

```rust,ignore
fn check_expr(&mut self, cx: &EarlyContext<'_>, expr: &ast::Expr) {
    if_chain! {
        if let ast::ExprKind::If(ref check, ref then, None) = expr.node;
        if !block_starts_with_comment(cx, then);
        if let Some(inner) = expr_block(then);
        if let ast::ExprKind::If(ref check_inner, ref content, None) = inner.node;
        then {
            ...
        }
    }
}
```

这是否会导致性能下降取决于具体的模式。如果发现问题，可以扩展模式匹配算法以允许“早期过滤”（参见 [未来可能性](#early-filtering) 中的 [早期过滤] 部分）。

尽管如此，我认为在模式匹配性能方面没有概念上的限制。

#### Applicability

尽管我预计许多lint可以基于所提出的模式语法实现，但不太可能所有lint都能通过模式来表达。我认为仍会有一些lint需要通过编写自定义的模式匹配代码来实现。这将导致Clippy代码库中出现混乱，有些lint使用模式实现，而另一些则没有。这种不一致性可能被视为一个缺点。


# 理由与替代方案

与手动编写匹配代码的当前方法相比，使用语法树模式指定lint具有几个优势。首先，语法树模式允许用户以简单且富有表现力的方式描述模式。这使得新手和专家都能更容易地编写新的lint，同时也使得阅读或修改现有lint更加容易。

另一个优势是lint不依赖于特定的语法树实现（例如AST / HIR等）。当这些语法树实现发生变化时，只需调整`IsMatch` trait的实现即可，现有的lint可以保持不变。这也意味着如果`IsMatch` trait实现被集成到编译器中，则必须更新`IsMatch`实现才能使编译器成功编译。这可以减少因编译器变化而导致Clippy崩溃的次数。模式独立性的另一个优势是，将`EarlyLintPass` lint转换为`LatePassLint`不需要重写整个模式匹配代码。实际上，即使不进行任何调整，该模式也能正常运作。


## Alternatives

### 类似Rust的模式语法

所提出的模式语法要求用户了解`PatternTree`的结构（与AST或HIR结构非常相似）以及模式语法。另一种替代方案是引入一种类似于实际Rust语法的模式语法（可能像`quote!`宏那样）。例如，一个匹配包含`false`条件的`if`表达式的模式可以如下所示：

```rust,ignore
if false {
    #[*]
}
```

#### Problems

在 Rust 语法本身已经相当复杂的基础上，再添加用于指定模式（替代项、序列、重复、命名子匹配等）所需的额外语法，可能会变得难以阅读且难以正确解析。

例如，一个匹配两侧均为 `0` 的二元运算的模式可能如下所示：

```
0 #[*:BinOpKind] 0
```

现在来看这个稍复杂一些的例子：

```
1 + 0 #[*:BinOpKind] 0
```

解析器需要知道 `#[*:BinOpKind]` 的优先级，因为该优先级会影响生成的 AST 结构。`1 + 0 + 0` 被解析为 `(1 + 0) + 0，而 `1 + 0 * 0` 则被解析为 `1 + (0 * 0)`。由于模式可以是任何 `BinOpKind`，因此无法提前知道其优先级。

另一个问题的例子是命名子匹配。请看这个模式：

```rust,ignore
fn test() {
    1 #foo
}
```

`#foo` 指的是哪个节点？`int`、`ast::Lit`、`ast::Expr` 还是 `ast::Stmt`？在类似 Rust 的语法中，为子模式命名非常困难，因为许多 AST 节点没有可以用来放置名称标签的句法元素。在这种情况下，唯一合理的选择是将名称标签分配给最外层的节点（如上面的 `ast::Stmt`），因为所有子节点的信息都可以通过最外层节点获取。然而，问题在于访问内部节点（如 `ast::Lit`）将需要手动进行模式匹配。

一般来说，Rust 语法中包含了大量隐式的代码结构。这些结构在解析过程中被重建（例如，二元运算是通过运算符优先级和从左到右的顺序来重建的），这也是解析任务复杂的原因之一。这种方法的优势在于使用户编写代码更加简单。

在编写*语法树模式*时，层次结构的每个元素可能都有替代项、重复等。尽管允许使用包含隐式结构的易于人类理解的语法，但遵守这些规则似乎非常复杂，甚至可能是不可能的。

开发这样的语法还需要维护一个至少与 Rust 解析器本身一样复杂的自定义解析器。此外，未来 Rust 语法的变化可能会与这种语法不兼容。

总之，我认为开发这样的语法会引入大量复杂性，以解决相对较小的问题。

用户不知道 *PatternTree* 结构的问题可以通过一个工具来解决，该工具给定一个 Rust 程序，生成仅匹配该程序的模式（类似于 Clippy 作者提供的 lint）。

对于某些简单情况（如上面的第一个示例），可能可以成功混合使用 Rust 和模式语法。这一领域可以在未来的扩展中进一步探索。

# 现有技术

模式语法大量受到正则表达式的启发（重复、替代、序列等）。

据我目前所见，其他 linter 也实现了直接作用于语法树数据结构的 lint，就像当前 Clippy 所做的那样。因此，我认为模式语法是*新的*，但如果我有错误请纠正我。

# 未解决的问题

#### 如何处理多个匹配？

在将语法树节点与模式进行匹配时，可能有多种方式可以匹配该模式。一个简单的例子如下：

```rust
pattern!{
    my_pattern: Expr =
        Array( _* Lit(_)+#literals)
}
```

这个模式匹配以至少一个字面量结尾的数组。现在给定数组 `[x, 1, 2]`，`1` 应该作为 `_*` 的一部分还是模式的 `Lit(_)+` 部分被匹配？这种区别很重要，因为名为子匹配 `#literals` 的内容会根据模式的匹配方式包含 1 个或 2 个元素。在正则表达式中，这个问题通过默认使用“贪婪”匹配和可选使用“非贪婪”匹配来解决。

我还没有深入研究这一点，因为我不知道它对大多数 linter 有多重要。当前实现只是返回它找到的第一个匹配项。

# 未来可能性

#### 实现 Rust 语法的其余部分

当前项目仅实现了 Rust 语法的小部分内容。未来应逐步扩展更多语法，以便实现更多的 lint 规则。实现更多 Rust 语法需要扩展 `PatternTree` 和 `IsMatch` 的实现，但过程相对简单。

#### 早期过滤

如 *Drawbacks/Performance* 部分所述，在模式匹配过程中进行额外检查可能具有优势。

以下模式展示了其可能的样子：

```rust
pattern!{
    pat_if_without_else: Expr =
        If(
            _,
            Block(
                Expr( If(_, _, ())#inner )
                | Semi( If(_, _, ())#inner )
            )#then,
            ()
        )
    where
        !in_macro(#then.span);
}
```

与目前提出的两阶段过滤方式相比，使用早期过滤时，条件（`!in_macro(#then.span)`）会在 `Block(_)#then` 被匹配时立即评估。

该领域的另一个想法是引入回溯引用语法。它们可用于要求模式的多个部分必须匹配同一个值。例如，`assign_op_pattern` lint 用于查找 `a = a op b` 并建议将其改为 `a op= b`，这就要求两个 `a` 都是相同的。使用 `=#...` 作为回溯引用语法，该 lint 可以如下实现：

```rust,ignore
pattern!{
    assign_op_pattern: Expr =
        Assign(_#target, Binary(_, =#target, _)
}
```

#### 匹配后代

目前许多 lint 实现了自定义访问器，用于检查当前节点的任何子树（可能不是直接后代）是否符合某些属性。这种功能无法用所提出的模式语法表达。扩展模式语法以支持类似“包含至少两个返回语句的函数”这样的模式，可能是一个实用的补充。

#### 替代项的否定运算符

对于“非布尔字面量”之类的模式，目前需要列出所有替代项，除了布尔情况。引入一个否定运算符，使得可以写 `Lit(!Bool(_))`，可能会是个好主意。这种模式相当于 `Lit( Char(_) | Int(_) )`（鉴于目前仅实现了三种字面量类型）。

#### 函数组合

当前模式没有组合的概念，这导致模式内部出现重复。例如，其中一个可折叠条件模式目前必须这样编写：

```rust
pattern!{
    pat_if_else: Expr =
        If(
            _,
            _,
            Block_(
                Block(
                    Expr((If(_, _, _?) | IfLet(_, _?))#else_) |
                    Semi((If(_, _, _?) | IfLet(_, _?))#else_)
                )#block_inner
            )#block
        ) |
        IfLet(
            _,
            Block_(
                Block(
                    Expr((If(_, _, _?) | IfLet(_, _?))#else_) |
                    Semi((If(_, _, _?) | IfLet(_, _?))#else_)
                )#block_inner
            )#block
        )
}
```

如果模式能够定义子模式的函数，代码就可以简化如下：

```rust
pattern!{
    fn expr_or_semi(expr: Expr) -> Stmt {
        Expr(expr) | Semi(expr)
    }
    fn if_or_if_let(then: Block, else: Opt<Expr>) -> Expr {
        If(_, then, else) | IfLet(then, else)
    }
    pat_if_else: Expr =
        if_or_if_let(
            _,
            Block_(
                Block(
                    expr_or_semi( if_or_if_let(_, _?)#else_ )
                )#block_inner
            )#block
        )
}
```

此外，像 `expr_or_semi` 这样的常见模式可以在不同的lint工具之间共享。

#### Clippy 模式作者

另一个改进方式可以是创建一个工具，给定有效的 Rust 语法后，生成完全匹配该语法的模式。这样就能更容易开始编写模式。用户可以查看为几个 Rust 代码示例生成的模式，利用这些信息来编写一个能匹配所有模式的模式。

这类似于 Clippy 的作者 lint 功能。

#### 支持其他语法

所提出的系统大部分是语言无关的。例如，模式语法也可以用来描述其他编程语言的模式。

为了支持其他语言的语法，需要实现另一个能够充分描述该语言 AST 的 `PatternTree`，并为这个 `PatternTree` 和该语言的 AST 实现 `IsMatch` 功能。

其中一个好处是，甚至可以编写基于模式语法本身的 lint 工具。例如，在编写以下模式时：


```rust
pattern!{
    my_pattern: Expr =
        Array( Lit(Bool(false)) Lit(Bool(false)) )
}
```

一个针对模式语法 AST 的 lint 工具可能会建议使用这种模式代替：

```rust
pattern!{
    my_pattern: Expr =
        Array( Lit(Bool(false)){2} )
}
```

将来，Clippy 可以使用这个系统为宏中的自定义语法提供 lint 功能。
