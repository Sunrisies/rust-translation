<a id="宏"></a>
# 宏

<a id="宏.intro"></a> Rust 的功能和语法可以通过称为宏的自定义定义来扩展。这些宏被赋予名称，并通过一致的语法调用：`some_extension!(...)`。

有两种方式可以定义新的宏：

* [通过示例定义的宏] 以更高层次、声明式的方式定义新语法。* [过程性宏] 使用对输入标记进行操作的函数来定义类似函数的宏、自定义派生项和自定义属性。

<a id="宏.invocation"></a>
## 宏调用

<a id="宏.invocation.syntax"></a> 
```grammar,macros
MacroInvocation ->
    SimplePath `!` DelimTokenTree

DelimTokenTree ->
      `(` TokenTree* `)`
    | `[` TokenTree* `]`
    | `{` TokenTree* `}`

TokenTree ->
    Token _except [delimiters][lex.token.delim]_ | DelimTokenTree

MacroInvocationSemi ->
      SimplePath `!` `(` TokenTree* `)` `;`
    | SimplePath `!` `[` TokenTree* `]` `;`
    | SimplePath `!` `{` TokenTree* `}`
```

<a id="宏.invocation.intro"></a> 宏调用在编译时展开宏，并将调用替换为宏的结果。以下情况可以调用宏：

<a id="宏.invocation.expr"></a> * [表达式] 和 [语句]

<a id="宏.invocation.pattern"></a> * [模式]

<a id="宏.invocation.type"></a> * [类型]

<a id="宏.invocation.item"></a> * [项]，包括 [关联项]

<a id="宏.invocation.nested"></a> * [`macro_rules`] 转换器

<a id="宏.invocation.extern"></a> * [外部块]

<a id="宏.invocation.item-statement"></a> 当作为项或语句使用时，在不需要使用花括号时需要在末尾添加分号的情况下使用 [MacroInvocationSemi] 形式。[可见性限定符] 在宏调用或 [`macro_rules`] 定义之前是不允许的。

```rust
// Used as an expression.
let x = vec![1,2,3];

// Used as a statement.
println!("Hello!");

// Used in a pattern.
macro_rules! pat {
    ($i:ident) => (Some($i))
}

if let pat!(x) = Some(1) {
    assert_eq!(x, 1);
}

// Used in a type.
macro_rules! Tuple {
    { $A:ty, $B:ty } => { ($A, $B) };
}

type N2 = Tuple!(i32, i32);

// Used as an item.
# use std::cell::RefCell;
thread_local!(static FOO: RefCell<u32> = RefCell::new(1));

// Used as an associated item.
macro_rules! const_maker {
    ($t:ty, $v:tt) => { const CONST: $t = $v; };
}
trait T {
    const_maker!{i32, 7}
}

// Macro calls within macros.
macro_rules! example {
    () => { println!("Macro call in a macro!") };
}
// Outer macro `example` is expanded, then inner macro `println` is expanded.
example!();
```

<a id="宏.invocation.name-resolution"></a> 

宏调用可以通过两种范围进行解析：

- 文本范围 - [文本范围 `macro_rules`](macros-by-example.md#r-宏.decl.scope.textual) - 基于路径的范围 - [基于路径的范围 `macro_rules`](macros-by-example.md#r-宏.decl.scope.path-based) - [过程性宏]

[External blocks]: items/external-blocks.md
[Macros by Example]: macros-by-example.md
[Procedural Macros]: procedural-macros.md
[`macro_rules`]: macros-by-example.md
[associated items]: items/associated-items.md
[delimiters]: tokens.md#delimiters
[expressions]: expressions.md
[items]: items.md
[patterns]: patterns.md
[statements]: statements.md
[types]: types.md
[visibility qualifiers]: visibility-and-privacy.md
