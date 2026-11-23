<a id="宏.decl"></a>
# 示例式宏

<a id="宏.decl.syntax"></a> 
```grammar,macros
MacroRulesDefinition ->
    `macro_rules` `!` IDENTIFIER MacroRulesDef

MacroRulesDef ->
      `(` MacroRules `)` `;`
    | `[` MacroRules `]` `;`
    | `{` MacroRules `}`

MacroRules ->
    MacroRule ( `;` MacroRule )* `;`?

MacroRule ->
    MacroMatcher `=>` MacroTranscriber

MacroMatcher ->
      `(` MacroMatch* `)`
    | `[` MacroMatch* `]`
    | `{` MacroMatch* `}`

MacroMatch ->
      Token _except `$` and [delimiters][lex.token.delim]_
    | MacroMatcher
    | `$` ( IDENTIFIER_OR_KEYWORD _except `crate`_ | RAW_IDENTIFIER ) `:` MacroFragSpec
    | `$` `(` MacroMatch+ `)` MacroRepSep? MacroRepOp

MacroFragSpec ->
      `block` | `expr` | `expr_2021` | `ident` | `item` | `lifetime` | `literal`
    | `meta` | `pat` | `pat_param` | `path` | `stmt` | `tt` | `ty` | `vis`

MacroRepSep -> Token _except [delimiters][lex.token.delim] and [MacroRepOp]_

MacroRepOp -> `*` | `+` | `?`

MacroTranscriber -> DelimTokenTree
```

<a id="宏.decl.intro"></a> `macro_rules` 允许用户以声明式的方式定义语法扩展。我们将此类扩展称为“示例式宏”或简称“宏”。

每个示例式宏都有一个名称，以及一个或多个 _规则_。每个规则包含两部分：一个 _匹配器_，描述其匹配的语法结构；以及一个 _转换器_，描述成功匹配后的替换语法结构。匹配器和转换器都必须被分隔符包围。宏可以展开为表达式、语句、项（包括特质、实现项和外部项）、类型或模式。

<a id="宏.decl.transcription"></a>
## 转录

<a id="宏.decl.transcription.intro"></a> 当调用宏时，宏展开器会按名称查找宏调用，并依次尝试每个宏规则。它首先进行第一个成功的匹配；如果导致错误，则后续匹配不会被尝试。

<a id="宏.decl.transcription.lookahead"></a> 在匹配过程中不执行前瞻检查；如果编译器无法明确确定如何逐词解析宏调用，则视为错误。在以下示例中，编译器不会查看标识符之后的符号是否为 `)`，尽管这样可以明确解析该调用：

```rust,compile_fail
macro_rules! ambiguity {
    ($($i:ident)* $j:ident) => { };
}

ambiguity!(error); // Error: local ambiguity
```

<a id="宏.decl.transcription.syntax"></a> 在匹配器和转换器中，`$` 符号用于触发宏引擎的特殊行为（详见 [元变量] 和 [重复项]）。不属于此类调用的符号会被按字面形式匹配并转录，但有一个例外。例外是匹配器的外部分隔符可以匹配任何一对分隔符。因此，例如匹配器 `(())` 会匹配 `{()}，但不会匹配 `{{}}`。字符 `$` 不能按字面形式被匹配或转录。

<a id="宏.decl.transcription.fragment"></a>
### 转发匹配的片段

当将匹配的片段转发给另一个示例宏时，第二个宏中的匹配器会看到该片段类型的不透明 AST。第二个宏无法使用字面令牌来匹配片段中的元素，只能使用相同类型的片段指定符。`ident`、`lifetime` 和 `tt` 片段类型是个例外，可以使用字面令牌进行匹配。以下示例说明了这一限制：

```rust,compile_fail
macro_rules! foo {
    ($l:expr) => { bar!($l); }
// ERROR:               ^^ no rules expected this token in macro call
}

macro_rules! bar {
    (3) => {}
}

foo!(3);
```

以下示例说明在匹配了 `tt` 片段后如何直接匹配令牌：

```rust
// compiles OK
macro_rules! foo {
    ($l:tt) => { bar!($l); }
}

macro_rules! bar {
    (3) => {}
}

foo!(3);
```

<a id="宏.decl.meta"></a>
## 元变量

<a id="宏.decl.meta.intro"></a> 在匹配器中，`$` _name_ `:` _fragment-specifier_ 会匹配指定的 Rust 语法片段，并将其绑定到元变量 `$`_name_。

<a id="宏.decl.meta.specifier"></a> 有效的片段指定符包括：

  * `block`: [BlockExpressionNoInnerAttributes] * `expr`: [Expression] * `expr_2021`: [Expression]，但排除 [UnderscoreExpression] 和 [ConstBlockExpression]（参见 [宏.decl.meta.edition2024]） * `ident`: [IDENTIFIER_OR_KEYWORD]，但排除 `_`、`[RAW_IDENTIFIER]` 或 [`$crate`] * `item`: [Item] * `lifetime`: [LIFETIME_TOKEN] * `literal`: 匹配 `-`<sup>?</sup>[LiteralExpression] * `meta`: [Attr]，即属性的内容 * `pat`: [Pattern]（参见 [宏.decl.meta.edition2021]） * `pat_param`: [PatternNoTopAlt] * `path`: [TypePath] * `stmt`: [Statement][grammar-Statement]，且末尾没有分号（但需要分号的 item 语句除外） * `tt`: [TokenTree]&nbsp;（单个 [token] 或匹配限定符 `()`、`[]` 或 `{}` 中的多个令牌） * `ty`: [Type][grammar-Type] * `vis`: 可能为空の [Visibility] 限定符

<a id="宏.decl.meta.transcription"></a> 在转录器中，元变量仅通过 `$`_name_` 引用，因为片段类型由匹配器指定。元变量会被替换为匹配的语法元素。元变量可以被多次转录或完全不转录。

<a id="宏.decl.meta.dollar-crate"></a> 关键字元变量 [`$crate`] 可用于引用当前 crate。

<a id="宏.decl.meta.edition2021"></a> 
> [!EDITION-2021]
> Starting with the 2021 edition, `pat` fragment-specifiers match top-level or-patterns (that is, they accept [Pattern]).
>
> Before the 2021 edition, they match exactly the same fragments as `pat_param` (that is, they accept [PatternNoTopAlt]).
>
> The relevant edition is the one in effect for the `macro_rules!` definition.

<a id="宏.decl.meta.edition2024"></a> 
> [!EDITION-2024]
> Before the 2024 edition, `expr` fragment specifiers do not match [UnderscoreExpression] or [ConstBlockExpression] at the top level. They are allowed within subexpressions.
>
> The `expr_2021` fragment specifier exists to maintain backwards compatibility with editions before 2024.

<a id="宏.decl.repetition"></a>
## 重复项

<a id="宏.decl.repetition.intro"></a> 在匹配器和转录器中，重复项是通过将要重复的标记放入 `$(`…`)` 内，随后加上一个重复运算符来指示的，也可以在中间使用分隔符标记。

<a id="宏.decl.repetition.separator"></a> 分隔符标记可以是除分隔符或重复运算符之外的任何标记，但 `;` 和 `,` 最为常见。例如，`$( $i:ident ),*` 表示由逗号分隔的任意数量的标识符。嵌套重复项也是允许的。

<a id="宏.decl.repetition.operators"></a> 重复运算符包括：

- `*` --- 表示任意次数的重复。 - `+` --- 表示至少一次但任意多次。 - `?` --- 表示可选片段，出现零次或一次。

<a id="宏.decl.repetition.optional-restriction"></a> 由于 `?` 最多只能出现一次，因此不能与分隔符一起使用。

<a id="宏.decl.repetition.fragment"></a> 重复片段既会被匹配，也会被转录为指定数量的该片段，两者之间由分隔符标记隔开。元变量会与其对应片段的每次重复项相匹配。例如，上述 `$( $i:ident ),*` 示例会将 `$i` 与列表中的所有标识符匹配。

在转录过程中，对重复项有额外的限制，以便编译器能够正确展开它们：

1.  元变量在转写器中的重复次数、类型及嵌套顺序必须与在匹配器中相同。因此，对于匹配器 `$( $i:ident ),*`，转写器中的 `=> { $i }`、`=> { $( $( $i )* )* }` 和 `=> { $( $i )+ }` 都是非法的，而 `=> { $( $i );* }` 则是正确的，它将逗号分隔的标识符列表替换为分号分隔的列表。2. 转写器中的每次重复必须至少包含一个元变量，以决定展开的次数。如果同一重复中出现多个元变量，它们必须绑定到相同数量的片段。例如，`( $( $i:ident ),* ; $( $j:ident ),* ) => (( $( ($i,$j) ),* ))` 必须使 `$i` 和 `$j` 的片段数量相等。这意味着使用 `(a, b, c; d, e, f)` 调用宏是合法的，并展开为 `((a,d), (b,e), (c,f))`，但 `(a, b, c; d, e)` 是非法的，因为它没有相同的数量。这一要求适用于所有嵌套的重复层。

<a id="宏.decl.scope"></a>
## 作用域、导出和导入

<a id="宏.decl.scope.intro"></a> 由于历史原因，通过示例定义的宏作用域并不完全像项目那样工作。宏有两种作用域形式：文本作用域和基于路径的作用域。文本作用域基于事物在源文件中的出现顺序，甚至跨多个文件，这是默认的作用域方式。下面会进一步说明。基于路径的作用域的工作方式与项目作用域完全相同。宏的作用域、导出和导入主要由属性控制。

<a id="宏.decl.scope.unqualified"></a> 当宏由未限定标识符调用（不属于多部分路径的一部分）时，首先在文本作用域中查找。如果找不到结果，则会在基于路径的作用域中查找。如果宏名称带有路径限定符，则仅在基于路径的作用域中查找。

<!-- ignore: requires external crates -->
```rust,ignore
use lazy_static::lazy_static; // Path-based import.

macro_rules! lazy_static { // Textual definition.
    (lazy) => {};
}

lazy_static!{lazy} // Textual lookup finds our macro first.
self::lazy_static!{} // Path-based lookup ignores our macro, finds imported one.
```

<a id="宏.decl.scope.textual"></a>
### 文本作用域

<a id="宏.decl.scope.textual.intro"></a> 文本作用域主要基于代码在源文件中的出现顺序，其运作方式类似于使用 `let` 声明的局部变量作用域，但同样适用于模块级别。当使用 `macro_rules!` 定义宏时，该宏会在定义之后进入作用域（注意，它仍可以递归使用，因为名称是从调用点查找的），直到其周围的上下文作用域（通常是某个模块）被关闭为止。这种作用域可以跨越子模块甚至多个文件。

<!-- ignore: requires external modules -->
```rust,ignore
//// src/lib.rs
mod has_macro {
    // m!{} // Error: m is not in scope.

    macro_rules! m {
        () => {};
    }
    m!{} // OK: appears after declaration of m.

    mod uses_macro;
}

// m!{} // Error: m is not in scope.

//// src/has_macro/uses_macro.rs

m!{} // OK: appears after declaration of m in src/lib.rs
```

<a id="宏.decl.scope.textual.shadow"></a> 多次定义宏并不会导致错误；最新的声明会覆盖之前的声明，除非前序声明已经离开作用域。

```rust
macro_rules! m {
    (1) => {};
}

m!(1);

mod inner {
    m!(1);

    macro_rules! m {
        (2) => {};
    }
    // m!(1); // Error: no rule matches '1'
    m!(2);

    macro_rules! m {
        (3) => {};
    }
    m!(3);
}

m!(1);
```

<a id="宏.decl.scope.textual.function-local"></a> 宏也可以在函数内部被声明和使用，其运作方式类似。

```rust
fn foo() {
    // m!(); // Error: m is not in scope.
    macro_rules! m {
        () => {};
    }
    m!();
}

// m!(); // Error: m is not in scope.
```

<a id="宏.decl.scope.textual.shadow-path-based"></a> 宏的文本作用域名称绑定会覆盖路径基于作用域的绑定。

```rust
macro_rules! m2 {
    () => {
        println!("m2");
    };
}

// Resolves to path-based candidate from use declaration below.
m!(); // prints "m2\n"

// Introduce second candidate for `m` with textual scope.
//
// This shadows path-based candidate from below for the rest of this
// example.
macro_rules! m {
    () => {
        println!("m");
    };
}

// Introduce `m2` macro as path-based candidate.
//
// This item is in scope for this entire example, not just below the
// use declaration.
use m2 as m;

// Resolves to the textual macro candidate from above the use
// declaration.
m!(); // prints "m\n"
```

> [!NOTE]
> For areas where shadowing is not allowed, see [name resolution ambiguities].

<a id="宏.decl.scope.path-based"></a>
### 路径基于作用域

<a id="宏.decl.scope.path-based.intro"></a> 默认情况下，宏没有路径基于作用域。宏可以通过两种方式获得路径基于作用域：

- [使用声明重新导出] - [`macro_export`]

<a id="宏.decl.scope.path.reexport"></a> 可以将宏重新导出，使其从 crate 根目录之外的模块中获得路径基于作用域的作用域。

```rust
mac::m!(); // OK: Path-based lookup finds `m` in the mac module.

mod mac {
    // Introduce macro `m` with textual scope.
    macro_rules! m {
        () => {};
    }

    // Reexport with path-based scope from within `m`'s textual scope.
    pub(crate) use m;
}
```

<a id="宏.decl.scope.path-based.visibility"></a> 宏的隐式可见性为 `pub(crate)`。使用 `#[macro_export]` 可以将其隐式可见性改为 `pub`。

```rust
// Implicit visibility is `pub(crate)`.
macro_rules! private_m {
    () => {};
}

// Implicit visibility is `pub`.
#[macro_export]
macro_rules! pub_m {
    () => {};
}

pub(crate) use private_m as private_macro; // OK.
pub use pub_m as pub_macro; // OK.
```

```rust,compile_fail,E0364
# // Implicit visibility is `pub(crate)`.
# macro_rules! private_m {
#     () => {};
# }
#
# // Implicit visibility is `pub`.
# #[macro_export]
# macro_rules! pub_m {
#     () => {};
# }
#
# pub(crate) use private_m as private_macro; // OK.
# pub use pub_m as pub_macro; // OK.
#
pub use private_m; // ERROR: `private_m` is only public within
                   // the crate and cannot be re-exported outside.
```

<!-- template:attributes -->
<a id="宏.decl.scope.macro_use"></a>
### `macro_use` 属性

<a id="宏.decl.scope.macro_use.intro"></a> *`macro_use` [属性][attributes]* 有两个用途：它可以在模块上使用，以扩展该模块中定义的宏的作用域；也可以在 [`extern crate`][items.extern-crate] 上使用，将来自其他 crate 的宏导入到 [`macro_use` prelude] 中。

> [!EXAMPLE]
> ```rust
> #[macro_use]
> mod inner {
>     macro_rules! m {
>         () => {};
>     }
> }
> m!();
> ```
>
> ```rust,ignore
> #[macro_use]
> extern crate log;
> ```

<a id="宏.decl.scope.macro_use.syntax"></a> 当在模块上使用时，`macro_use` 属性采用 [MetaWord] 语法。

当用于 `extern crate` 时，它使用 [MetaWord] 和 [MetaListIdents] 语法。关于这些语法的具体用法，请参阅 [宏.decl.scope.macro_use.prelude]。

<a id="宏.decl.scope.macro_use.allowed-positions"></a> `macro_use` 属性可以应用于模块或 `extern crate`。

> [!NOTE]
> `rustc` ignores use in other positions but lints against it. This may become an error in the future.

<a id="宏.decl.scope.macro_use.extern-crate-self"></a> 不得在 [`extern crate self`] 上使用 `macro_use` 属性。

<a id="宏.decl.scope.macro_use.duplicates"></a> `macro_use` 属性可以在一个形式中多次使用。

在 [MetaListIdents] 语法中可以指定多个 `macro_use` 实例。所有指定的宏的并集将被导入。

> [!NOTE]
> On modules, `rustc` lints against any [MetaWord] `macro_use` attributes following the first.
>
> On `extern crate`, `rustc` lints against any `macro_use` attributes that have no effect due to not importing any macros not already imported by another `macro_use` attribute. If two or more [MetaListIdents] `macro_use` attributes import the same macro, the first is linted against. If any [MetaWord] `macro_use` attributes are present, all [MetaListIdents] `macro_use` attributes are linted against. If two or more [MetaWord] `macro_use` attributes are present, the ones following the first are linted against.

<a id="宏.decl.scope.macro_use.mod-decl"></a> 当 `macro_use` 应用于模块时，该模块的宏作用域会超出其词汇作用域。

> [!EXAMPLE]
> ```rust
> #[macro_use]
> mod inner {
>     macro_rules! m {
>         () => {};
>     }
> }
> m!(); // OK
> ```

<a id="宏.decl.scope.macro_use.prelude"></a> 在 crate 根部的 `extern crate` 声明上指定 `macro_use` 会导入该 crate 中导出的宏。

以这种方式导入的宏被导入到 [`macro_use` prelude] 中，而不是文本形式，这意味着它们可以被其他名称覆盖。通过 `macro_use` 导入的宏可以在导入语句之前使用。

> [!NOTE]
> `rustc` currently prefers the last macro imported in case of conflict. Don't rely on this. This behavior is unusual, as imports in Rust are generally order-independent. This behavior of `macro_use` may change in the future.
>
> For details, see [Rust issue #148025](https://github.com/rust-lang/rust/issues/148025).

使用 [MetaWord] 语法时，所有导出的宏都会被导入；使用 [MetaListIdents] 语法时，只有指定的宏会被导入。

> [!EXAMPLE]
> <!-- ignore: requires external crates -->
> ```rust,ignore
> #[macro_use(lazy_static)] // Or `#[macro_use]` to import all macros.
> extern crate lazy_static;
>
> lazy_static!{}
> // self::lazy_static!{} // ERROR: lazy_static is not defined in `self`.
> ```

<a id="宏.decl.scope.macro_use.export"></a> 需要通过 `macro_use` 导入的宏必须通过 [`macro_export`][宏.decl.scope.macro_export] 导出。

<!-- template:attributes -->
<a id="宏.decl.scope.macro_export"></a>
### `macro_export` 属性

<a id="宏.decl.scope.macro_export.intro"></a> *`macro_export` [attribute][attributes]* 将宏从 crate 中导出，并在 crate 的根部使其可用于基于路径的解析。

> [!EXAMPLE]
> ```rust
> self::m!();
> //  ^^^^ OK: Path-based lookup finds `m` in the current module.
> m!(); // As above.
>
> mod inner {
>     super::m!();
>     crate::m!();
> }
>
> mod mac {
>     #[macro_export]
>     macro_rules! m {
>         () => {};
>     }
> }
> ```

<a id="宏.decl.scope.macro_export.syntax"></a> `macro_export` 属性使用 [MetaWord] 和 [MetaListIdents] 语法。使用 [MetaListIdents] 语法时，它接受一个单一的 [`local_inner_macros`][宏.decl.scope.macro_export.local_inner_macros] 值。

<a id="宏.decl.scope.macro_export.allowed-positions"></a> `macro_export` 属性可以应用于 `macro_rules` 定义。

> [!NOTE]
> `rustc` ignores use in other positions but lints against it. This may become an error in the future.

<a id="宏.decl.scope.macro_export.duplicates"></a> 只有对 `macro_export` 的首次使用才有效。

> [!NOTE]
> `rustc` lints against any use following the first.

<a id="宏.decl.scope.macro_export.path-based"></a> 默认情况下，宏仅具有 [文本范围][宏.decl.scope.textual]，无法通过路径解析。当使用 `macro_export` 属性时，该宏将在 crate 根目录中可用，并可以通过其路径引用。

> [!EXAMPLE]
> Without `macro_export`, macros only have textual scope, so path-based resolution of the macro fails.
>
> ```rust,compile_fail,E0433
> macro_rules! m {
>     () => {};
> }
> self::m!(); // ERROR
> crate::m!(); // ERROR
> # fn main() {}
> ```
>
> With `macro_export`, path-based resolution works.
>
> ```rust
> #[macro_export]
> macro_rules! m {
>     () => {};
> }
> self::m!(); // OK
> crate::m!(); // OK
> # fn main() {}
> ```

<a id="宏.decl.scope.macro_export.export"></a> `macro_export` 属性使宏从 crate 根目录导出，从而可以通过路径在其他 crate 中引用。

> [!EXAMPLE]
> Given the following in a `log` crate:
>
> ```rust
> #[macro_export]
> macro_rules! warn {
>     ($message:expr) => { eprintln!("WARN: {}", $message) };
> }
> ```
>
> From another crate, you can refer to the macro by path:
>
> <!-- ignore: requires external crates -->
> ```rust,ignore
> fn main() {
>     log::warn!("example warning");
> }
> ```

<a id="宏.decl.scope.macro_export.macro_use"></a> `macro_export` 允许在 `extern crate` 中使用 [`macro_use`][宏.decl.scope.macro_use]，将宏导入到 [`macro_use` prelude]中。

> [!EXAMPLE]
> Given the following in a `log` crate:
>
> ```rust
> #[macro_export]
> macro_rules! warn {
>     ($message:expr) => { eprintln!("WARN: {}", $message) };
> }
> ```
>
> Using `macro_use` in a dependent crate allows you to use the macro from the prelude:
>
> <!-- ignore: requires external crates -->
> ```rust,ignore
> #[macro_use]
> extern crate log;
>
> pub mod util {
>     pub fn do_thing() {
>         // Resolved via macro prelude.
>         warn!("example warning");
>     }
> }
> ```

<a id="宏.decl.scope.macro_export.local_inner_macros"></a> 在 `macro_export` 属性中添加 `local_inner_macros` 会导致宏定义中的所有单段宏调用具有隐式的 `$crate::` 前缀。

> [!NOTE]
> This is intended primarily as a tool to migrate code written before [`$crate`] was added to the language to work with Rust 2018's path-based imports of macros. Its use is discouraged in new code.

> [!EXAMPLE]
> ```rust
> #[macro_export(local_inner_macros)]
> macro_rules! helped {
>     () => { helper!() } // Automatically converted to $crate::helper!().
> }
>
> #[macro_export]
> macro_rules! helper {
>     () => { () }
> }
> ```

<a id="宏.decl.hygiene"></a>
## 卫生性

<a id="宏.decl.hygiene.intro"></a> 示例宏具有 _混合范围的卫生性_。这意味着 [循环标签][block labels] 和局部变量在宏定义时被查找，而其他符号在宏调用时被查找。例如：

```rust
let x = 1;
fn func() {
    unreachable!("this is never called")
}

macro_rules! check {
    () => {
        assert_eq!(x, 1); // Uses `x` from the definition site.
        func();           // Uses `func` from the invocation site.
    };
}

{
    let x = 2;
    fn func() { /* does not panic */ }
    check!();
}
```

在宏展开中定义的标签和局部变量不会在调用之间共享，因此以下代码无法编译：

```rust,compile_fail,E0425
macro_rules! m {
    (define) => {
        let x = 1;
    };
    (refer) => {
        dbg!(x);
    };
}

m!(define);
m!(refer);
```

<a id="宏.decl.hygiene.crate"></a> 特殊情况是 `$crate` 元变量。它指向定义该宏的 crate，可以在路径开头使用它以查找在调用时不在范围内的项目或宏。

<!-- ignore: requires external crates -->
```rust,ignore
//// Definitions in the `helper_macro` crate.
#[macro_export]
macro_rules! helped {
    // () => { helper!() } // This might lead to an error due to 'helper' not being in scope.
    () => { $crate::helper!() }
}

#[macro_export]
macro_rules! helper {
    () => { () }
}

//// Usage in another crate.
// Note that `helper_macro::helper` is not imported!
use helper_macro::helped;

fn unit() {
    helped!();
}
```

请注意，由于 `$crate` 指的是当前 crate，因此在引用非宏项目时必须使用完全限定的模块路径：

```rust
pub mod inner {
    #[macro_export]
    macro_rules! call_foo {
        () => { $crate::inner::foo() };
    }

    pub fn foo() {}
}
```

<a id="宏.decl.hygiene.vis"></a> 此外，尽管 `$crate` 允许宏在其自身 crate 内引用项目，但其使用对可见性没有影响。被引用的项目或宏仍然必须从调用点可见。在以下示例中，从外部 crate 调用 `call_foo!()` 将失败，因为 `foo()` 不是公开的。

```rust
#[macro_export]
macro_rules! call_foo {
    () => { $crate::foo() };
}

fn foo() {}
```

> [!NOTE]
> Prior to Rust 1.30, `$crate` and [`local_inner_macros`][macro.decl.scope.macro_export.local_inner_macros] were unsupported. They were added alongside [path-based imports of macros][macro.decl.scope.macro_export], to ensure that helper macros did not need to be manually imported by users of a macro-exporting crate. Crates written for earlier versions of Rust that use helper macros need to be modified to use `$crate` or `local_inner_macros` to work well with path-based imports.

<a id="宏.decl.follow-set"></a>
## 跟随集歧义限制

<a id="宏.decl.follow-set.intro"></a> 宏系统使用的解析器相当强大，但为了避免当前或未来版本中的歧义，其存在局限性。

<a id="宏.decl.follow-set.token-restriction"></a> 特别是除了关于歧义展开的规则外，由元变量匹配的非终结符后必须跟随一个被确定可以安全使用的标记。

例如，像 `$i:expr [ , ]` 这样的宏匹配器在今天的 Rust 中理论上可以被接受，因为 `[,]` 不能成为合法表达式的一部分，因此解析总是明确的。然而，由于 `[` 可以开始后续的表达式，`[` 不是可以安全排除为后接表达式的字符。如果 `[,]` 在 Rust 的后期版本中被接受，这种匹配器就会变得歧义或解析错误，导致代码无法运行。像 `$i:expr,` 或 `$i:expr;` 这样的匹配器则是合法的，因为 `,` 和 `;` 是合法的表达式分隔符。具体规则如下：

<a id="宏.decl.follow-set.token-expr-stmt"></a> * `expr` 和 `stmt` 后面只能跟随：`=>`、`,` 或 `;`。

<a id="宏.decl.follow-set.token-pat_param"></a> * `pat_param` 后面只能跟随：`=>`、`,`、`=`、`|`、`if` 或 `in`。

<a id="宏.decl.follow-set.token-pat"></a> * `pat` 后面只能跟随：`=>`、`,`、`=`、`if` 或 `in`。

<a id="宏.decl.follow-set.token-path-ty"></a> * `path` 和 `ty` 后面只能跟随：`=>`、`,`、`=`、`|`、`;`、`:`、`>`、`>>`、`[`、`{`、`as`、`where` 或 `block` fragment specifier 的宏变量。

<a id="宏.decl.follow-set.token-vis"></a> * `vis` 后面只能跟随：`,`、非 raw `priv` 类型的标识符、可以开始类型的任何标记，或带有 `ident`、`ty` 或 `path` fragment specifier 的元变量。

<a id="宏.decl.follow-set.token-other"></a> * 所有其他片段说明符没有限制。

<a id="宏.decl.follow-set.edition2021"></a> 
> [!EDITION-2021]
> Before the 2021 edition, `pat` may also be followed by `|`.

<a id="宏.decl.follow-set.repetition"></a> 当涉及重复时，规则适用于所有可能的展开次数，并考虑分隔符。这意味着：

  * 如果重复包含分隔符，该分隔符必须能够跟随重复的内容。 * 如果重复可以多次出现（`*` 或 `+`），则内容本身必须能够自我跟随。 * 重复的内容必须能够跟随其前的所有内容，而其后内容也必须能够跟随重复的内容。 * 如果重复可以零次出现（`*` 或 `?`），则其后内容必须能够跟随其前的内容。

有关更多细节，请参阅[正式规范]。

[`$crate`]: macro.decl.hygiene.crate
[`extern crate self`]: items.extern-crate.self
[block labels]: expr.loop.block-labels

[Metavariables]: #metavariables
[Repetitions]: #repetitions
[`macro_export`]: #the-macro_export-attribute
[`macro_use` prelude]: names/preludes.md#macro_use-prelude
[delimiters]: tokens.md#delimiters
[formal specification]: macro-ambiguity.md
[loop labels]: expressions/loop-expr.md#loop-labels
[name resolution ambiguities]: names/name-resolution.md#r-names.resolution.expansion.imports.ambiguity
[token]: tokens.md
[use declaration re-export]: items/use-declarations.md#use-visibility
