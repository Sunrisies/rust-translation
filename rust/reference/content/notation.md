<a id="notation"></a>
# 符号表示法

<a id="notation.grammar"></a>
## 语法规则

<a id="notation.grammar.syntax"></a> 

以下符号被 *Lexer* 和 *Syntax* 语法片段使用：

| Notation          | Examples                      | Meaning                                   |
|-------------------|-------------------------------|-------------------------------------------|
| CAPITAL           | KW_IF, INTEGER_LITERAL        | A token produced by the lexer             |
| _ItalicCamelCase_ | _LetStatement_, _Item_        | A syntactical production                  |
| `string`          | `x`, `while`, `*`             | The exact character(s)                    |
| x<sup>?</sup>     | `pub`<sup>?</sup>             | An optional item                          |
| x<sup>\*</sup>    | _OuterAttribute_<sup>\*</sup> | 0 or more of x                            |
| x<sup>+</sup>     |  _MacroMatch_<sup>+</sup>     | 1 or more of x                            |
| x<sup>a..b</sup>  | HEX_DIGIT<sup>1..6</sup>      | a to b repetitions of x, exclusive of b   |
| x<sup>a..=b</sup> | HEX_DIGIT<sup>1..=5</sup>     | a to b repetitions of x, inclusive of b   |
| x<sup>n:a..=b</sup> | `#`<sup>n:1..=255</sup>      | a to b repetitions of x (inclusive of b), with the count bound to the name n |
| x<sup>n</sup>     | `#`<sup>n</sup>               | x repeated the number of times bound to n by a previous labeled repetition |
| Rule1 Rule2       | `fn` _Name_ _Parameters_      | Sequence of rules in order                |
| \|                | `u8` \| `u16`, Block \| Item  | Either one or another                     |
| !                 | !COMMENT                      | Matches if the expression does not follow, without consuming any input |
| \[ ]               | \[`b` `B`]                     | Any of the characters listed              |
| \[ - ]             | \[`a`-`z`]                     | Any of the characters in the range        |
| ~\[ ]              | ~\[`b` `B`]                    | Any characters, except those listed       |
| ~`string`         | ~`\n`, ~`*/`                  | Any characters, except this sequence      |
| ( )               | (`,` _Parameter_)<sup>?</sup> | Groups items                              |
| ^                 | `b'` ^ ASCII_FOR_CHAR         | The rest of the sequence must match or parsing fails unconditionally ([hard cut operator]) |
| U+xxxx..xxxxxx    | U+0060                        | A single Unicode character                |
| \<text\>          | \<any ASCII char except CR\>  | An English description of what should be matched |
| Rule <sub>suffix</sub> | IDENTIFIER_OR_KEYWORD <sub>_except `crate`_</sub> | A modification to the previous rule |
| // Comment. | // Single line comment. | A comment extending to the end of the line. |

序列的优先级高于 `|` 选择。

<a id="notation.grammar.cut"></a>
### 硬切运算符

该语法采用有序选择方式：解析器从左到右尝试各种选项，并选择第一个匹配的选项。如果某个选项在序列中部分失败，解析器通常会回退并尝试下一个选项。而切运算符（`^`）则阻止这种回退行为。一旦序列中 `^` 左侧的所有表达式都匹配成功，剩余部分必须也匹配，否则解析将无条件失败。

Mizushima等人引入了 [cut operators][cut operator paper] 用于解析表达式语法。在 PEG 文献中，*软切*仅阻止在直接包含的顺序选择内的回退——外部选择仍然可以恢复。*硬切*则完全禁止超过切点的回退；失败是确定的。本语法中的 `^` 即为硬切。

使用硬切运算符是必要的，因为 Rust 中的一些标记以有效的标记作为前缀开始。例如，`c"` 用于启动 C 字符串字面量，但单独的 `c` 是一个有效的标识符。如果没有切运算符，如果 `c"\0"` 无法被解析为 C 字符串字面量（因为 C 字符串不允许空字符），解析器可能会回退并将其解析为两个标记：标识符 `c` 和字符串字面量 `"\0"`。[在 `c` 之后的切] 防止了这种情况——一旦开头分隔符被识别，解析器就无法回退。同样的逻辑适用于 [字节字面量]、[字节字符串字面量]、[原始字符串字面量]以及其他以有效标记作为前缀的字面量。

<a id="notation.grammar.string-tables"></a>
### 字符串表产生规则

语法中的某些规则——尤其是[一元运算符]、[二元运算符]和[关键字]——以简化形式呈现：作为可打印字符串的列表。这些情况构成了与[标记][token]规则相关的规则子集，假设它们是词汇分析阶段通过DFA对所有此类字符串表条目进行或运算后传递给解析器的结果。

当`monospace`字体下的字符串出现在语法中时，它隐含地指向该字符串表产生式中的单个成员。有关更多信息，请参阅[标记]。

<a id="notation.grammar.visualizations"></a>
### 语法可视化

每个语法块下方都有一个按钮用于切换[语法图]的显示状态。正方形元素表示非终结规则，圆形矩形表示终结符。

[binary operators]: expressions/operator-expr.md#arithmetic-and-logical-binary-operators
[byte literals]: tokens.md#r-lex.token.byte.syntax
[byte string literals]: tokens.md#r-lex.token.str-byte.syntax
[cut after `c"`]: tokens.md#r-lex.token.str-c.syntax
[cut operator paper]: https://kmizu.github.io/papers/paste513-mizushima.pdf
[hard cut operator]: notation.md#the-hard-cut-operator
[keywords]: keywords.md
[raw string literals]: tokens.md#r-lex.token.literal.str-raw.syntax
[syntax diagram]: https://en.wikipedia.org/wiki/Syntax_diagram
[tokens]: tokens.md
[unary operators]: expressions/operator-expr.md#borrow-operators
