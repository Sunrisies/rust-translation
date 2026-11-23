<a id="宏.ambiguity"></a>
# 附录：宏跟随集歧义形式规范

<a id="宏.ambiguity.intro"></a> 本页记录了 [示例式宏] 的跟随规则形式规范。这些规则最初在 [RFC 550] 中定义，本文大部分内容均来自该文档，并在后续 RFC 中进行了扩展。

<a id="宏.ambiguity.convention"></a>
## 定义与惯例

<a id="宏.ambiguity.convention.defs"></a> - `macro`: 任何在源代码中可以作为 `foo!(...)` 调用的内容。 - `MBE`: 示例式宏，由 `macro_rules` 定义的一种宏。 - `matcher`: `macro_rules` 调用中规则的左侧部分，或其子部分。 - `macro parser`: Rust 解析器中的代码段，用于使用从所有 matcher 派生出的语法来解析输入。 - `fragment`: 给定 matcher 能够接受（或“匹配”）的 Rust 语法类别。 - `repetition`: 遵循常规重复模式的 fragment。 - `NT`: 非终端符号，即可以在 matcher 中出现的各种“元变量”或重复 matcher，以 `$` 字符开头的 MBE 语法形式表示。 - `simple NT`: “元变量”非终端符号（详见下文）。 - `complex NT`: 通过重复运算符（`*`、`+`、`?`）指定的重复匹配非终端符号。 - `token`: matcher 中的原子元素；即标识符、运算符、开闭分隔符以及 simple NT。 - `token tree`: 由令牌（叶子节点）、复杂 NT 和有限序列的 token tree 构成的树结构。 - `delimiter token`: 用于划分一个 fragment 结尾与下一个 fragment 开始之间的令牌。 - `separator token`: complex NT 中的可选分隔符令牌，用于分离匹配重复中的每对元素。 - `separated complex NT`: 具有自身分隔符令牌的 complex NT。 - `delimited sequence`: 在序列开头和结尾有适当的开闭分隔符的 token tree 序列。 - `empty fragment`: 用于分隔令牌的无可见 Rust 语法类别，即空白字符，或在某些词法环境中为空的令牌序列。 - `fragment specifier`: simple NT 中的标识符，用于指定该非终端符号所接受的 fragment。 - `language`: 上下文无关语言。

Example:

```rust,compile_fail
macro_rules! i_am_an_mbe {
    (start $foo:expr $($i:ident),* end) => ($foo)
}
```

<a id="宏.ambiguity.convention.matcher"></a> `(start $foo:expr $($i:ident),* end)` 是一个 matcher。整个 matcher 是一个带开闭分隔符 `(` 和 `)` 的 delimited sequence，而 `$foo` 和 `$i` 则是具有 `expr` 和 `ident` 作为片段标识符的 simple NT。

<a id="宏.ambiguity.convention.complex-nt"></a> `$(i:ident),*` 也是一个复杂类型；它是一种由逗号分隔的标识符重复构成的复杂类型。`,` 是这种复杂类型的分隔符标记，出现在匹配片段中每对元素之间（如果有的话）。

另一个复杂类型的例子是 `$(hi $e:expr ;)+`，它匹配任何形式为 `hi <expr>; hi <expr>; ...` 的片段，其中 `hi <expr>;` 至少出现一次。请注意，这种复杂类型没有专用的分隔符标记。

（注意，Rust 解析器确保带界序列始终具有正确的令牌树结构嵌套以及开闭界标的正确匹配。）

<a id="宏.ambiguity.convention.vars"></a> 我们通常将变量 “M” 用于表示匹配器，变量 “t” 和 “u” 用于表示任意单个令牌，而变量 “tt” 和 “uu” 用于表示任意令牌树。（使用 “tt” 可能会带来潜在的歧义，因为它还充当片段指定符；但从上下文可以明确看出所指的是哪种解释。）

<a id="宏.ambiguity.convention.set"></a> “SEP” 用于指代分隔符标记，“OP” 用于指代重复运算符 `*`、`+` 和 `?”，“OPEN”/“CLOSE” 用于指代包围带界序列的匹配令牌对（例如 `[` 和 `]`）。

<a id="宏.ambiguity.convention.sequence-vars"></a> 希腊字母 “α”、“β”、“γ” 和 “δ” 代表可能为空の令牌树序列。（然而，希腊字母 “ε”（epsilon）在表示中有特殊作用，并不代表令牌树序列。）

  * 这种希腊字母约定通常仅用于强调我们正在处理令牌树序列这一技术细节；特别是当我们希望强调这一点时，我们会使用 “tt ...” 来表示序列，而不是使用希腊字母。

请注意，匹配器本质上只是一个令牌树。“简单类型”，如上所述，是一种元变量类型；因此它是非重复的。例如，`$foo:ty` 是一个简单类型，但 `$($foo:ty)+` 则是一个复杂类型。

同样需要注意的是，在这种形式主义的背景下，“token”一词通常*包含*了简单类型。

最后，读者应当记住，根据这种形式化的定义，没有简单的 NT 能与空片段匹配，同样也没有任何标记能匹配 Rust 语法的空片段。（因此，*唯一*能匹配空片段的 NT 是一个复杂的 NT。）但实际上并非如此，因为 `vis` 匹配器可以匹配空片段。因此，从形式化的角度来看，我们将 `$v:vis` 视为实际上是 `$($v:vis)?`，并且要求匹配器能够匹配空片段。

<a id="宏.ambiguity.invariant"></a>
### 匹配器的不变量

<a id="宏.ambiguity.invariant.list"></a> 为了有效，匹配器必须满足以下三个不变量。FIRST 和 FOLLOW 的定义将在后面描述。

1.  对于匹配器 `M` 中的任意两个连续的标记树序列（即 `M = ... tt uu ...`），当 `uu ...` 不为空时，必须有 FOLLOW(`... tt`) ∪ {ε} ⊇ FIRST(`uu ...)`。1. 对于匹配器中的任何分离复杂 NT，`M = ... $(tt ...) SEP OP ...`，必须有 `SEP` ∈ FOLLOW(`tt ...)`。1. 对于匹配器中的未分离复杂 NT，`M = ... $(tt ...) OP ...`，如果 OP = `*` 或 `+`，则必须有 FOLLOW(`tt ...`) ⊇ FIRST(`tt ...)`。

<a id="宏.ambiguity.invariant.follow-matcher"></a> 第一个不变量指出，匹配器之后的任何实际标记（如果有的话）必须位于预定的跟随集中。这确保了合法的宏定义将继续赋予与 `... tt` 的结束位置和 `uu ...` 的开始位置相同的确定值，即使语言中添加了新的句法形式。

<a id="宏.ambiguity.invariant.separated-complex-nt"></a> 第二个不变量指出，分离复杂 NT 必须使用属于该 NT 内部内容预定跟随集的分隔标记。这确保了合法的宏定义将继续将输入片段解析为相同的 `tt ...` 序列，即使语言中添加了新的句法形式。

<a id="宏.ambiguity.invariant.unseparated-complex-nt"></a> 第三个不变式指出，当我们有一个复杂的非类型约束（NT），它可以匹配两个或更多相同元素的副本且之间没有分隔时，根据第一个不变式，它们可以相邻放置。该不变式还要求这些元素非空，从而消除了可能的歧义。

**注意：由于历史疏忽以及对行为的依赖较大，第三个不变式目前未被强制执行。未来将如何处理这一点尚未确定。不遵守此行为的宏可能在Rust的后续版本中变得无效。请参阅[跟踪问题]。**

<a id="宏.ambiguity.sets"></a>
### 前序及后序，非正式表述

<a id="宏.ambiguity.sets.intro"></a> 给定的匹配器M对应三个集合：FIRST(M)、LAST(M)和FOLLOW(M)。

这三个集合均由标记组成。FIRST(M)和LAST(M)也可能包含一个特殊的非标记元素ε（“epsilon”），表示M可以匹配空片段。（但FOLLOW(M）始终只是标记的集合。）

Informally:

<a id="宏.ambiguity.sets.first"></a> * FIRST(M)：收集在匹配片段到M时可能首先使用的标记。

<a id="宏.ambiguity.sets.last"></a> * LAST(M)：收集在匹配片段到M时可能最后使用的标记。

<a id="宏.ambiguity.sets.follow"></a> * FOLLOW(M)：由M匹配的某个片段之后可以立即跟随的标记集合。

    换句话说：t ∈ FOLLOW(M) 当且仅当存在（可能为空的）标记序列α、β、γ、δ满足：

      * M matches β,

      * t匹配γ，并且

      * 连接后的α β γ δ是一个可解析的Rust程序。

<a id="宏.ambiguity.sets.universe"></a> 我们使用简写ANYTOKEN来表示所有标记的集合（包括简单的NT）。例如，如果某个标记在匹配器M之后是合法的，则FOLLOW(M) = ANYTOKEN。

（为了回顾对上述非正式描述的理解，读者此时可以跳到[ FIRST/LAST示例](#examples-of-first-and-last)以阅读正式定义。）

<a id="宏.ambiguity.sets.def"></a>
### 前序、后序

<a id="宏.ambiguity.sets.def.intro"></a> 以下是 FIRST 和 LAST 的正式归纳定义。

<a id="宏.ambiguity.sets.def.notation"></a> “A ∪ B” 表示集合并集，“A ∩ B” 表示集合交集，而 “A \ B” 表示集合差集（即 A 中不在 B 中的元素）。

<a id="宏.ambiguity.sets.def.first"></a>
#### FIRST

<a id="宏.ambiguity.sets.def.first.intro"></a> FIRST(M) 是通过对序列 M 及其第一个标记树结构进行情况分析来定义的：

<a id="宏.ambiguity.sets.def.first.epsilon"></a> * 如果 M 是空序列，则 FIRST(M) = { ε },

<a id="宏.ambiguity.sets.def.first.token"></a> * 如果 M 以标记 t 开头，则 FIRST(M) = { t },

    （注意：这涵盖了 M 以带界的标记树序列开始的情况，`M = OPEN tt ... CLOSE ...`，在这种情况下 `t = OPEN` 因此 FIRST(M) = { `OPEN` }。）

    （注意：这严格依赖于没有简单 NT 匹配空片段的性质。）

<a id="宏.ambiguity.sets.def.first.complex"></a> * 否则，M 是一个以复杂 NT 开始的标记树序列：`M = $( tt ... ) OP α`，或 `M = $( tt ... ) SEP OP α`（其中 `α` 是匹配器其余部分的（可能为空）标记树序列）。

      * 如果存在 SEP 且 ε ∈ FIRST(`tt ...`)，则令 SEP\_SET(M) = { SEP }；否则 SEP\_SET(M) = {}。

  * 如果 OP = `*` 或 `?`，则令 ALPHA\_SET(M) = FIRST(`α`)；如果 OP = `+`，则 ALPHA\_SET(M) = {}。 * FIRST(M) = (FIRST(`tt ...`) \\ {ε}) ∪ SEP\_SET(M) ∪ ALPHA\_SET(M)。

复杂 NT 的定义需要一些解释。SEP\_SET(M) 定义了分隔符可能是 M 的有效第一个标记的可能性，这种情况发生在存在定义的分隔符且重复片段可以为空时。ALPHA\_SET(M) 定义了复杂 NT 可能为空的可能性，意味着 M 有效的第一个标记是以下标记树序列 `α` 中的那些。当使用 `*` 或 `?` 时会发生这种情况，在这种情况下可能没有重复项。理论上，如果 `+` 与可能为空的重复片段一起使用，也可能发生这种情况，但这是受第三个不变量限制的。

因此，显然 FIRST(M) 可以包含 SEP\_SET(M) 或 ALPHA\_SET(M) 中的任何标记。如果复杂的 NT 匹配不为空，那么以 FIRST(`tt ...`) 开头的任何标记也可以适用。最后需要考虑的是 ε。SEP\_SET(M) 和 FIRST(`tt ...`) \ {ε} 不能包含 ε，但 ALPHA\_SET(M) 可以包含。因此，这个定义允许 M 接受 ε 当且仅当 ε ∈ ALPHA\_SET(M)。这是正确的，因为对于复杂的 NT 情况，M 接受 ε 意味着复杂的 NT 和 α 都接受它。如果 OP = `+`，即复杂的 NT 不能为空，那么根据定义 ε ∉ ALPHA\_SET(M)。否则，复杂的 NT 可以接受零次重复，此时 ALPHA\_SET(M) = FOLLOW(`α`)。因此，这个定义对于 \varepsilon 也是正确的。

<a id="宏.ambiguity.sets.def.last"></a>
#### LAST

<a id="宏.ambiguity.sets.def.last.intro"></a> LAST(M)，通过对 M 本身（一个标记树序列）进行案例分析来定义：

<a id="宏.ambiguity.sets.def.last.empty"></a> * 如果 M 是空序列，则 LAST(M) = { ε }

<a id="宏.ambiguity.sets.def.last.token"></a> * 如果 M 是一个单元素标记 t，则 LAST(M) = { t }

<a id="宏.ambiguity.sets.def.last.rep-star"></a> * 如果 M 是重复零次或多次的单元素复杂 NT，`M = $( tt ... ) *`，或 `M = $( tt ... ) SEP *`

      * 如果存在 SEP，则 sep_set = { SEP }；否则 sep_set = {}。

      * 如果 ε ∈ LAST(`tt ...`)，则 LAST(M) = LAST(`tt ...`) ∪ sep_set

      * 否则，序列 `tt ...` 必须非空；LAST(M) = LAST(`tt ...`) ∪ {ε}。

<a id="宏.ambiguity.sets.def.last.rep-plus"></a> * 如果 M 是重复一次或多次的单元素复杂 NT，`M = $( tt ... ) +`，或 `M = $( tt ... ) SEP +`

      * 如果存在 SEP，则 sep_set = { SEP }；否则 sep_set = {}。

      * 如果 ε ∈ LAST(`tt ...`)，则 LAST(M) = LAST(`tt ...`) ∪ sep_set

      * 否则，序列 `tt ...` 必须非空；LAST(M) = LAST(`tt ...`)

<a id="宏.ambiguity.sets.def.last.rep-question"></a> * 如果 M 是重复零次或一次的单元素复杂 NT，`M = $( tt ...) ?`，则 LAST(M) = LAST(`tt ...`) ∪ {ε}。

<a id="宏.ambiguity.sets.def.last.delim"></a> * 如果 M 是一个分隔符标记树序列 `OPEN tt ... CLOSE`，则 LAST(M) = { `CLOSE` }。

<a id="宏.ambiguity.sets.def.last.sequence"></a> * 如果 M 是一组非空的标记树序列 `tt uu ...`,

      * 如果 ε ∈ LAST(`uu ...`），则 LAST(M) = LAST(`tt`) ∪ (LAST(`uu ...`) \ { ε })。

      * 否则，序列 `uu ...` 必须非空；此时 LAST(M) = LAST(`uu ...`)。

### FIRST 和 LAST 的示例

以下是一些 FIRST 和 LAST 的示例。（特别注意如何根据输入各部分的相互作用引入和消除特殊的 ε 元素。）

我们的第一个示例以树结构呈现，以详细说明匹配器的分析是如何组合而成的。（一些较简单的子树已被省略。）

```text
INPUT:  $(  $d:ident   $e:expr   );*    $( $( h )* );*    $( f ; )+   g
            ~~~~~~~~   ~~~~~~~                ~
                |         |                   |
FIRST: { $d:ident } { $e:expr } { h }


INPUT: $( $d:ident $e:expr );* $( $( h )* );* $( f ; )+
            ~~~~~~~~~~~~~~~~~~             ~~~~~~~           ~~~
                        |                      |               |
FIRST:          { $d:ident }               { h, ε }         { f }

INPUT:  $(  $d:ident   $e:expr   );*    $( $( h )* );*    $( f ; )+   g
        ~~~~~~~~~~~~~~~~~~~~~~~~~~~~    ~~~~~~~~~~~~~~    ~~~~~~~~~   ~
                        |                       |              |       |
FIRST: { $d:ident, ε } { h, ε, ; } { f } { g }


INPUT: $( $d:ident $e:expr );* $( $( h )* );* $( f ; )+ g
        ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                                        |
FIRST:                       { $d:ident, h, ;,  f }
```

Thus:

 * FIRST(`$($d:ident $e:expr );* $( $(h)* );* $( f ;)+ g`) = { `$d:ident`, `h`, `;`, `f` }

不过请注意：

 * FIRST(`$($d:ident $e:expr );* $( $(h)* );* $($( f ;)+ g)*`) = { `$d:ident`, `h`, `;`, `f`, ε }

以下是类似的示例，但针对 LAST。

 * LAST(`$d:ident $e:expr`) = { `$e:expr` } * LAST(`$( $d:ident $e:expr );*`) = { `$e:expr`, ε } * LAST(`$( $d:ident $e:expr );* $(h)*`) = { `$e:expr`, ε, `h` } * LAST(`$( $d:ident $e:expr );* $(h)* $( f ;)+`) = { `;` } * LAST(`$( $d:ident $e:expr );* $(h)* $( f ;)+ g`) = { `g` }

<a id="宏.ambiguity.sets.def.follow"></a>
### FOLLOW(M)

<a id="宏.ambiguity.sets.def.follow.intro"></a> 最后，FOLLOW(M) 的定义如下构建。pat、expr等表示带有给定片段说明符的简单非终结符。

<a id="宏.ambiguity.sets.def.follow.pat"></a> * FOLLOW(pat) = {`=>`, `,`, `=`, `|`, `if`, `in`}。

<a id="宏.ambiguity.sets.def.follow.expr-stmt"></a> * FOLLOW(expr) = FOLLOW(expr_2021) = FOLLOW(stmt) = {`=>`, `,`, `;`}。

<a id="宏.ambiguity.sets.def.follow.ty-path"></a> * FOLLOW(ty) = FOLLOW(path) = {`{`, `[`, `,`, `=>`, `:`, `=`, `>`, `>>`, `;`, `|`, `as`, `where`, 非终结符块}。

<a id="宏.ambiguity.sets.def.follow.vis"></a> * FOLLOW(vis) = {`,`l 任何关键字或标识符，除了非原始 `priv`；任何可以开始类型的标记；ident、ty 和 path 非终结符}。

<a id="宏.ambiguity.sets.def.follow.simple"></a> * FOLLOW(t) = ANYTOKEN 对于任何其他简单标记，包括 block、ident、tt、item、生命周期、literal 和 meta 简单非终结符，以及所有终端。

<a id="宏.ambiguity.sets.def.follow.other-matcher"></a> * FOLLOW(M), 对于任何其他 M，定义为 FOLLOW(t) 的交集，其中 t 遍历 (LAST(M) \ {ε})。

<a id="宏.ambiguity.sets.def.follow.type-first"></a> 目前可以开始类型的标记包括 {`(`, `[`, `!`, `*`, `&`, `&&`, `?`, lifetimes, `>`, `>>`, `::`, 任何非关键字标识符, `super`, `self`, `Self`, `extern`, `crate`, `$crate`, `_`, `for`, `impl`, `fn`, `unsafe`, `typeof`, `dyn`}，尽管这个列表可能并不完整，因为人们不会总是记得在新增内容时更新附录。

复杂 M 的 FOLLOW 示例：

 * FOLLOW(`$( $d:ident $e:expr )*`) = FOLLOW(`$e:expr`) * FOLLOW(`$( $d:ident $e:expr )* $(;)*`) = FOLLOW(`$e:expr`) ∩ ANYTOKEN = FOLLOW(`$e:expr`) * FOLLOW(`$( $d:ident $e:expr )* $(;)* $( f |)+`) = ANYTOKEN

### 有效与无效匹配器的示例

有了上述规范后，我们可以提出理由说明为什么某些匹配器是合法的而其他不是。

 * `($ty:ty < foo ,)` : 非法，因为 FIRST(`< foo ,`) = { `<` } ⊈ FOLLOW(`ty`)

 * `($ty:ty , foo <)` : 合法，因为 FIRST(`, foo <`) = { `,` } 是 ⊆ FOLLOW(`ty`)。

 * `($pa:pat $pb:pat $ty:ty ,)` : 非法，因为 FIRST(`$pb:pat $ty:ty ,`) = { `$pb:pat` } ⊈ FOLLOW(`pat`），同时 FIRST(`$ty:ty ,`) = { `$ty:ty` } ⊈ FOLLOW(`pat`)。

 * `( $($a:tt $b:tt)* ; )` : 合法，因为 FIRST(`$b:tt`) = { `$b:tt` } 是 ⊆ FOLLOW(`tt`) = ANYTOKEN，同时 FIRST(`;`) = { `;` }。

 * `( $($t:tt),* , $(t:tt),* )` : 合法，（尽管尝试实际使用此宏会在展开时引发局部歧义错误）。

 * `($ty:ty $(; not sep)* -)` : 非法，因为 FIRST(`$(; not sep)* -`) = { `;`, `-` } 不在 FOLLOW(`ty`) 中。

 * `($($ty:ty)-+)` : 非法，因为分隔符 `-` 不在 FOLLOW(`ty`) 中。

 * `($($e:expr)*)` : 非法，因为 expr NTs 不在 FOLLOW(expr NT) 中。

[Macros by Example]: macros-by-example.md
[RFC 550]: https://github.com/rust-lang/rfcs/blob/master/text/0550-macro-future-proofing.md
[tracking issue]: https://github.com/rust-lang/rust/issues/56575
