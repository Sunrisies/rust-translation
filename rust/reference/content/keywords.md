<a id="lex.keywords"></a>
# 关键词

<a id="lex.keywords.intro"></a> Rust 将关键词分为三类：

* [strict](#strict-keywords) * [reserved](#reserved-keywords) * [weak](#weak-keywords)

<a id="lex.keywords.strict"></a>
## 严格关键词

<a id="lex.keywords.strict.intro"></a> 严格关键词只能在其正确的上下文中使用。它们不能用作以下内容的名称：

* [Items] * [Variables] 和函数参数 * Fields 和 [variants] * [Type parameters] * 生命周期 参数或 [loop labels] * [Macros] 或 [attributes] * [宏 placeholders] * [Crates]

<a id="lex.keywords.strict.syntax"></a> 
```grammar,lexer
@root STRICT_KEYWORDS ->
      `_`
    | `as`
    | `async`
    | `await`
    | `break`
    | `const`
    | `continue`
    | `crate`
    | `dyn`
    | `else`
    | `enum`
    | `extern`
    | `false`
    | `fn`
    | `for`
    | `if`
    | `impl`
    | `in`
    | `let`
    | `loop`
    | `match`
    | `mod`
    | `move`
    | `mut`
    | `pub`
    | `ref`
    | `return`
    | `self`
    | `Self`
    | `static`
    | `struct`
    | `super`
    | `trait`
    | `true`
    | `type`
    | `unsafe`
    | `use`
    | `where`
    | `while`
```

<a id="lex.keywords.strict.edition2018"></a> > [!EDITION-2018] > 在 2018 版中添加了以下关键词： > > - `async` > - `await` > - `dyn`

<a id="lex.keywords.reserved"></a>
## 保留关键词

<a id="lex.keywords.reserved.intro"></a> 保留关键词目前尚未使用，但被预留供将来使用。它们与严格关键词具有相同的限制。这样做的目的是通过禁止使用这些关键词，使当前程序能够与未来的 Rust 版本兼容。

<a id="lex.keywords.reserved.syntax"></a> 
```grammar,lexer
@root RESERVED_KEYWORDS ->
      `abstract`
    | `become`
    | `box`
    | `do`
    | `final`
    | `gen`
    | `macro`
    | `override`
    | `priv`
    | `try`
    | `typeof`
    | `unsized`
    | `virtual`
    | `yield`
```

<a id="lex.keywords.reserved.edition2018"></a> > [!EDITION-2018] > `try` 关键词在 2018 版中作为保留关键词添加。

<a id="lex.keywords.reserved.edition2024"></a> > [!EDITION-2024] > `gen` 关键词在 2024 版中作为保留关键词添加。

<a id="lex.keywords.weak"></a>
## 弱关键词

<a id="lex.keywords.weak.intro"></a> 弱关键词在特定上下文中具有特殊含义。例如，可以使用 `union` 名称声明变量或方法。

<a id="lex.keywords.weak.syntax"></a> 
```grammar,lexer
@root WEAK_KEYWORDS ->
      `'static`
    | `macro_rules`
    | `raw`
    | `safe`
    | `union`
```

<a id="lex.keywords.weak.macro_rules"></a> * `macro_rules` 用于创建自定义 [macros]。

<a id="lex.keywords.weak.union"></a> * `union` 用于声明 [union]，仅在 union 声明中作为关键词使用。

<a id="lex.keywords.weak.生命周期-static"></a> * `'static` 用于静态生命周期，不能用作 [泛型 生命周期 parameter] 或 [loop label]。

  ```compile_fail
  // error[E0262]: invalid lifetime parameter name: `'static`
  fn invalid_lifetime_parameter<'static>(s: &'static str) -> &'static str { s }
  ```

<a id="lex.keywords.weak.safe"></a> * `safe` 用于函数和静态函数，在 [external blocks] 中具有特定含义。

<a id="lex.keywords.weak.raw"></a> * `raw` 用于 [原始借用运算符]，在匹配原始借用运算符形式时（例如 `&raw const expr` 或 `&raw mut expr`）仅作为关键字。

<a id="lex.keywords.weak.dyn.edition2018"></a> > [!EDITION-2018] > 在 2015 版中，当 [`dyn`] 用于类型位置后跟一个不以 `::` 或 `<`、生命周期、问号、`for` 关键字或开括号开头的路径时，它是关键字。> > 从 2018 版开始，`dyn` 被提升为严格关键字。

[items]: items.md
[Variables]: variables.md
[Type parameters]: types/parameters.md
[loop labels]: expressions/loop-expr.md#loop-labels
[Macros]: macros.md
[attributes]: attributes.md
[Macro placeholders]: macros-by-example.md
[Crates]: crates-and-source-files.md
[union]: items/unions.md
[variants]: items/enumerations.md
[`dyn`]: types/trait-object.md
[loop label]: expressions/loop-expr.md#loop-labels
[generic lifetime parameter]: items/generics.md
[external blocks]: items/external-blocks.md
[raw borrow operators]: expressions/operator-expr.md#raw-borrow-operators
