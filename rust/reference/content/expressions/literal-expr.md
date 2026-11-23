<a id="expr.literal"></a>
# 字面量表达式

<a id="expr.literal.syntax"></a> 
```grammar,expressions
LiteralExpression ->
      CHAR_LITERAL
    | STRING_LITERAL
    | RAW_STRING_LITERAL
    | BYTE_LITERAL
    | BYTE_STRING_LITERAL
    | RAW_BYTE_STRING_LITERAL
    | C_STRING_LITERAL
    | RAW_C_STRING_LITERAL
    | INTEGER_LITERAL
    | FLOAT_LITERAL
    | `true`
    | `false`
```

<a id="expr.literal.intro"></a> 字面量表达式是由单个标记组成的表达式，而不是由多个标记组成的结构，它直接表示其评估值，而不通过名称或其他评估规则来引用该值。

<a id="expr.literal.const-expr"></a> 字面量是一种[常量表达式]，因此主要在编译时进行评估。

<a id="expr.literal.literal-token"></a> 前面描述的每个词法[字面量][literal标记]都可以构成字面量表达式，关键字`true`和`false`也可以。

```rust
"hello";   // string type
'5';       // character type
5;         // integer type
```

<a id="expr.literal.string-representation"></a> 在下面的描述中，一个标记的_字符串表示_是指输入中符合*Lexer*语法片段中该标记定义的字符序列。

> [!NOTE]
> This string representation never includes a character `U+000D` (CR) immediately followed by `U+000A` (LF): this pair would have been previously transformed into a single `U+000A` (LF).

<a id="expr.literal.escape"></a>
## 转义

<a id="expr.literal.escape.intro"></a> 下面关于文本字面量表达式的描述使用了几种形式的_转义_。

<a id="expr.literal.escape.sequence"></a> 每种转义形式的特点包括：* 一个_转义序列_：由`U+005C`（`\`）开始的字符序列 * 一个_转义值_：单个字符或空字符序列

在下面的转义定义中：* 八进制数字是指范围\[`0`-`7`\]中的任何字符。 * 十六进制数字是指范围\[`0`-`9`]，\[`a`-`f`]，或\[`A`-`F`\]中的任何字符。

<a id="expr.literal.escape.simple"></a>
### 简单转义

下表第一列中出现的每个字符序列都是一种转义序列。

在每种情况下，转义值就是第二栏对应条目中给出的字符。

| Escape sequence | Escaped value            |
|-----------------|--------------------------|
| `\0`            | U+0000 (NUL)             |
| `\t`            | U+0009 (HT)              |
| `\n`            | U+000A (LF)              |
| `\r`            | U+000D (CR)              |
| `\"`            | U+0022 (QUOTATION MARK)  |
| `\'`            | U+0027 (APOSTROPHE)      |
| `\\`            | U+005C (REVERSE SOLIDUS) |

<a id="expr.literal.escape.hex-octet"></a>
### 8位转义

转义序列由`\x`后跟两个十六进制数字组成。

转义值是指其[Unicode标量值]为将转义序列的最后两个字符解释为十六进制整数后的结果，就像使用 [`u8::from_str_radix`]并以16为基数一样。

> [!NOTE]
> The escaped value therefore has a [Unicode scalar value] in the range of [`u8`][numeric types].

<a id="expr.literal.escape.hex-ascii"></a>
### 7位转义

转义序列由 `\x` 后跟一个八进制数字，再后跟一个十六进制数字组成。

被转义的值是指代该字符的 [Unicode 标量值]，其值是将转义序列中的最后两个字符解释为十六进制整数，就像使用 [`u8::from_str_radix`] 并以十六进制基数为准一样。

<a id="expr.literal.escape.unicode"></a>
### Unicode 转义

转义序列由 `\u{` 后跟一系列十六进制数字或 `_`，最后以 `}` 结束组成。

被转义的值是指代该字符的 [Unicode 标量值]，其值是将转义序列中的十六进制数字解释为十六进制整数，就像使用 [`u32::from_str_radix`] 并以十六进制基数为准一样。

> [!NOTE]
> The permitted forms of a [CHAR_LITERAL] or [STRING_LITERAL] token ensure that there is such a character.

<a id="expr.literal.continuation"></a>
### 字符串延续转义

转义序列由 `\` 后直接跟随 `U+000A` (LF)，以及所有在下一个非空白字符之前的空格字符组成。就此而言，这些空格字符包括 `U+0009` (HT)、`U+000A` (LF)、`U+000D` (CR) 和 `U+0020` (SPACE)。

被转义的值是一个空的字符序列。

> [!NOTE]
> The effect of this form of escape is that a string continuation skips following whitespace, including additional newlines. Thus `a`, `b` and `c` are equal:
>
> ```rust
> let a = "foobar";
> let b = "foo\
>          bar";
> let c = "foo\
>
>      bar";
>
> assert_eq!(a, b);
> assert_eq!(b, c);
> ```
>
> Skipping additional newlines (as in example c) is potentially confusing and unexpected. This behavior may be adjusted in the future. Until a decision is made, it is recommended to avoid relying on skipping multiple newlines with line continuations. See [this issue](https://github.com/rust-lang/reference/pull/1042) for more information.

<a id="expr.literal.char"></a>
## 字符字面量表达式

<a id="expr.literal.char.intro"></a> 字符字面量表达式由单个 [CHAR_LITERAL] 标记组成。

<a id="expr.literal.char.type"></a> 该表达式的类型是原始类型 [`char`]。

<a id="expr.literal.char.no-suffix"></a> 该标记不得有后缀。

<a id="expr.literal.char.literal-content"></a> 该标记的 _字面内容_ 是指示符的字符串表示形式中，第一个 `U+0027` (`'`) 之后和最后一个 `U+0027` (`'`) 之前的字符序列。

<a id="expr.literal.char.represented"></a> 字面表达式的 _代表字符_ 是根据字面内容按以下方式确定的：

<a id="expr.literal.char.escape"></a> * 如果字面内容是以下转义序列形式之一，则代表字符即为该转义序列的被转义值： * [简单转义] * [7位转义] * [Unicode 转义]

<a id="expr.literal.char.single"></a> * 否则，所表示的字符就是构成字面内容的单个字符。

<a id="expr.literal.char.result"></a> 表达式的值是与所表示字符的 [Unicode 标量值] 对应的 [`char`]。

> [!NOTE]
> The permitted forms of a [CHAR_LITERAL] token ensure that these rules always produce a single character.

字符字面量表达式示例：

```rust
'R';                               // R
'\'';                              // '
'\x52';                            // R
'\u{00E6}';                        // LATIN SMALL LETTER AE (U+00E6)
```

<a id="expr.literal.string"></a>
## 字符串字面量表达式

<a id="expr.literal.string.intro"></a> 字符串字面量表达式由单个 [STRING_LITERAL] 或 [RAW_STRING_LITERAL] 标记组成。

<a id="expr.literal.string.type"></a> 表达式的类型是对原始 [`str`] 类型的共享引用（具有 `static` 生命周期），即类型为 `&'static str`。

<a id="expr.literal.string.no-suffix"></a> 该标记不得有后缀。

<a id="expr.literal.string.literal-content"></a> 该标记的 _字面内容_ 是令牌的字符串表示中紧随第一个 `U+0022`（`"`）且位于最后一个 `U+0022`（`"`）之前的字符序列。

<a id="expr.literal.string.represented"></a> 字面量表达式的 _所表示的字符串_ 是从字面内容派生出的字符序列，具体规则如下：

<a id="expr.literal.string.escape"></a> * 如果该令牌是 [STRING_LITERAL]，则字面内容中出现的任何格式的转义序列都会被其转义值替换。* [简单转义] * [7位转义] * [Unicode转义] * [字符串延续转义]

  这些替换按从左到右的顺序进行。例如，令牌 `"\\x41"` 会被转换为字符 `\` `x` `4` `1`。

<a id="expr.literal.string.raw"></a> * 如果该令牌是 [RAW_STRING_LITERAL]，则所表示的字符串与字面内容相同。

<a id="expr.literal.string.result"></a> 表达式的值是一个指向静态分配的 [`str`]的引用，其中包含所表示字符串的 UTF-8 编码。

字符串字面量表达式示例：

```rust
"foo"; r"foo";                     // foo
"\"foo\""; r#""foo""#;             // "foo"

"foo #\"# bar";
r##"foo #"# bar"##;                // foo #"# bar

"\x52"; "R"; r"R";                 // R
"\\x52"; r"\x52";                  // \x52
```

<a id="expr.literal.byte-char"></a>
## 字节字面量表达式

<a id="expr.literal.byte-char.intro"></a> 字节字面量表达式由单个 [BYTE_LITERAL] 标记组成。

<a id="expr.literal.byte-char.literal"></a> 该表达式的类型为原始 [`u8`][numeric types]。

<a id="expr.literal.byte-char.no-suffix"></a> 该标记不得带有后缀。

<a id="expr.literal.byte-char.literal-content"></a> 该标记的 _字面内容_ 是令牌的字符串表示中第一个 `U+0027` (`'`) 之后和最后一个 `U+0027` (`'`) 之前的字符序列。

<a id="expr.literal.byte-char.represented"></a> 字面表达式的 _表示字符_ 是根据字面内容按以下方式推导出来的：

<a id="expr.literal.byte-char.escape"></a> * 如果字面内容是以下形式的转义序列之一，则表示字符为该转义序列的转义值： * [简单转义] * [8位转义]

<a id="expr.literal.byte-char.single"></a> * 否则，表示字符就是构成字面内容的单个字符。

<a id="expr.literal.byte-char.result"></a> 表达式的值即为表示字符的 [Unicode 标量值]。

> [!NOTE]
> The permitted forms of a [BYTE_LITERAL] token ensure that these rules always produce a single character, whose Unicode scalar value is in the range of [`u8`][numeric types].

字节字面表达式示例：

```rust
b'R';                              // 82
b'\'';                             // 39
b'\x52';                           // 82
b'\xA0';                           // 160
```

<a id="expr.literal.byte-string"></a>
## 字节字符串字面表达式

<a id="expr.literal.byte-string.intro"></a> 字节字符串字面表达式由单个 [BYTE_STRING_LITERAL] 或 [RAW_BYTE_STRING_LITERAL] 标记组成。

<a id="expr.literal-byte-string.type"></a> 该表达式的类型是一个共享引用（具有 `static` 生命周期）指向一个数组，其元素类型为 [`u8`][numeric types]。即类型为 `&'static [u8; N]`，其中 `N` 是下面描述的表示字符串中的字节数。

<a id="expr.literal-byte-string.no-suffix"></a> 该标记不得带有后缀。

<a id="expr.literal-byte-string.literal-content"></a> 该标记的 _字面内容_ 是令牌的字符串表示中第一个 `U+0022` (`"`) 之后和最后一个 `U+0022` (`"`) 之前的字符序列。

<a id="expr.literal-byte-string.represented"></a> 字面表达式的 _表示字符串_ 是根据字面内容按以下方式推导出的字符序列：

<a id="expr.literal.byte-string.escape"></a> * 如果标记是 [BYTE_STRING_LITERAL]，则字面内容中出现的任何形式的外露序列，都会被其外露值的替换。* [简单外露] * [8位外露] * [字符串延续外露]

  这些替换按从左到右的顺序进行。例如，标记 `b"\\x41"` 会被转换为字符 `\` `x` `4` `1`。

<a id="expr.literal.byte-string.raw"></a> * 如果标记是 [RAW_BYTE_STRING_LITERAL]，则所表示的字符串与字面内容完全相同。

<a id="expr.literal.byte-string.result"></a> 表达式的值是一个指向静态分配数组的引用，该数组包含所表示字符串中字符的 [Unicode 标量值]，顺序相同。

> [!NOTE]
> The permitted forms of [BYTE_STRING_LITERAL] and [RAW_BYTE_STRING_LITERAL] tokens ensure that these rules always produce array element values in the range of [`u8`][numeric types].

字节字符串字面表达式示例：

```rust
b"foo"; br"foo";                     // foo
b"\"foo\""; br#""foo""#;             // "foo"

b"foo #\"# bar";
br##"foo #"# bar"##;                 // foo #"# bar

b"\x52"; b"R"; br"R";                // R
b"\\x52"; br"\x52";                  // \x52
```

<a id="expr.literal.c-string"></a>
## C 字符串字面表达式

<a id="expr.literal.c-string.intro"></a> C 字符串字面表达式由单个 [C_STRING_LITERAL] 或 [RAW_C_STRING_LITERAL] 标记组成。

<a id="expr.literal.c-string.type"></a> 表达式的类型是一个共享引用（具有 `static` 生命周期）到标准库 [CStr] 类型。即，类型为 `&'static core::ffi::CStr`。

<a id="expr.literal.c-string.no-suffix"></a> 该标记不得有后缀。

<a id="expr.literal.c-string.literal-content"></a> 该标记的 _字面内容_ 是令牌的字符串表示形式中第一个 `"` 之后和最后一个 `"` 之前的字符序列。

<a id="expr.literal.c-string.represented"></a> 字面表达式的 _表示的字节_ 是从字面内容派生出的字节序列，具体方式如下：

<a id="expr.literal.c-string.escape"></a> * 如果标记是 [C_STRING_LITERAL]，则字面内容被视为一系列项，每一项要么是除 `\` 之外的单个 Unicode 字符，要么是 [转义符]。这些项的序列按以下方式转换为字节序列：* 每个单独的 Unicode 字符贡献其 UTF-8 表示形式。* 每个 [简单转义符] 贡献其转义后值的 [Unicode 标量值]。* 每个 [8位转义符] 贡献一个包含其转义后值 [Unicode 标量值] 的单个字节。* 每个 [Unicode 转义符] 贡献其转义后值的 UTF-8 表示形式。* 每个 [字符串续接转义符] 不贡献任何字节。

<a id="expr.literal.c-string.raw"></a> * 如果标记是 [RAW_C_STRING_LITERAL]，则所表示的字节就是字面内容的 UTF-8 编码。

> [!NOTE]
> The permitted forms of [C_STRING_LITERAL] and [RAW_C_STRING_LITERAL] tokens ensure that the represented bytes never include a null byte.

<a id="expr.literal.c-string.result"></a> 表达式的值是对静态分配的 [CStr] 的引用，其字节数组包含所表示的字节后跟一个空字符。

C 字符串字面量表达式示例：

```rust
c"foo"; cr"foo";                     // foo
c"\"foo\""; cr#""foo""#;             // "foo"

c"foo #\"# bar";
cr##"foo #"# bar"##;                 // foo #"# bar

c"\x52"; c"R"; cr"R";                // R
c"\\x52"; cr"\x52";                  // \x52

c"æ";                                // LATIN SMALL LETTER AE (U+00E6)
c"\u{00E6}";                         // LATIN SMALL LETTER AE (U+00E6)
c"\xC3\xA6";                         // LATIN SMALL LETTER AE (U+00E6)

c"\xE6".to_bytes();                  // [230]
c"\u{00E6}".to_bytes();              // [195, 166]
```

<a id="expr.literal.int"></a>
## 整数字面量表达式

<a id="expr.literal.int.intro"></a> 整数字面量表达式由单个 [INTEGER_LITERAL] 标记组成。

<a id="expr.literal.int.suffix"></a> 如果标记有 [后缀]，则该后缀必须是 [基本整数类型][numeric types] 之一：`u8`、`i8`、`u16`、`i16`、`u32`、`i32`、`u64`、`i64`、`u128`、`i128`、`usize` 或 `isize`，且表达式具有该类型。

<a id="expr.literal.int.infer"></a> 如果标记没有后缀，则表达式的类型由类型推断决定：

<a id="expr.literal.int.inference-unique-type"></a> * 如果可以从周围程序上下文唯一确定一个整数类型，则表达式具有该类型。

<a id="expr.literal.int.inference-default"></a> * 如果程序上下文对类型的限制不足，则默认类型为有符号 32 位整数 `i32`。

<a id="expr.literal.int.inference-error"></a> * 如果程序上下文对类型的限制过强，则视为静态类型错误。

整数字面量表达式示例：

```rust
123;                               // type i32
123i32;                            // type i32
123u32;                            // type u32
123_u32;                           // type u32
let a: u64 = 123;                  // type u64

0xff;                              // type i32
0xff_u8;                           // type u8

0o70;                              // type i32
0o70_i16;                          // type i16

0b1111_1111_1001_0000;             // type i32
0b1111_1111_1001_0000i64;          // type i64

0usize;                            // type usize
```

<a id="expr.literal.int.representation"></a> 表达式的值根据令牌的字符串表示形式确定。

<a id="expr.literal.int.radix"></a> 整数进制是通过检查字符串的前两个字符来确定的，具体规则如下：

    * `0b` 表示二进制进制 * `0o` 表示八进制 * `0x` 表示十六进制 * 否则默认为十进制。

<a id="expr.literal.int.radix-prefix-stripped"></a> 如果进制不是十进制，则从字符串中移除前两个字符。

<a id="expr.literal.int.type-suffix-stripped"></a> 从字符串中移除任何后缀。

<a id="expr.literal.int.separators-stripped"></a> 从字符串中移除所有下划线。

<a id="expr.literal.int.u128-value"></a> 该字符串被转换为 `u128` 值，就像使用 [`u128::from_str_radix`] 并指定进制一样。如果值无法适应 `u128`，则会导致编译错误。

<a id="expr.literal.int.cast"></a> `u128` 值通过 [数值转换] 转换为表达式的类型。

> [!NOTE]
> The final cast will truncate the value of the literal if it does not fit in the expression's type. `rustc` includes a [lint check] named `overflowing_literals`, defaulting to `deny`, which rejects expressions where this occurs.

> [!NOTE]
> `-1i8`, for example, is an application of the [negation operator] to the literal expression `1i8`, not a single integer literal expression. See [Overflow] for notes on representing the most negative value for a signed type.

<a id="expr.literal.float"></a>
## 浮点字面量表达式

<a id="expr.literal.float.intro"></a> 浮点字面量表达式有两种形式：* 单个 [FLOAT_LITERAL] 令牌 * 带有后缀且没有进制指示器的单个 [INTEGER_LITERAL] 令牌。

<a id="expr.literal.float.suffix"></a> 如果令牌有后缀，该后缀必须是 [基本浮点类型][floating-point types] 之一：`f32` 或 `f64`，并且表达式具有该类型。

<a id="expr.literal.float.infer"></a> 如果令牌没有后缀，则表达式的类型由类型推断决定：

<a id="expr.literal.float.inference-unique-type"></a> * 如果可以从程序上下文唯一确定一个浮点类型，则表达式具有该类型。

<a id="expr.literal.float.inference-default"></a> * 如果程序上下文对类型的限制不足，则默认为 `f64`。

<a id="expr.literal.float.inference-error"></a> * 如果程序上下文对类型的限制过强，则视为静态类型错误。

浮点字面量表达式的示例：

```rust
123.0f64;        // type f64
0.1f64;          // type f64
0.1f32;          // type f32
12E+99_f64;      // type f64
5f32;            // type f32
let x: f64 = 2.; // type f64
```

<a id="expr.literal.float.result"></a> 表达式的值根据标记的字符串表示形式确定。

<a id="expr.literal.float.type-suffix-stripped"></a> * 字符串中的任何后缀都会被移除。

<a id="expr.literal.float.separators-stripped"></a> * 字符串中的任何下划线也会被移除。

<a id="expr.literal.float.value"></a> * 该字符串会被转换为表达式的类型，就像使用 [`f32::from_str`] 或 [`f64::from_str`] 一样。

> [!NOTE]
> `-1.0`, for example, is an application of the [negation operator] to the literal expression `1.0`, not a single floating-point literal expression.

> [!NOTE]
> `inf` and `NaN` are not literal tokens. The [`f32::INFINITY`], [`f64::INFINITY`], [`f32::NAN`], and [`f64::NAN`] constants can be used instead of literal expressions. In `rustc`, a literal large enough to be evaluated as infinite will trigger the `overflowing_literals` lint check.

<a id="expr.literal.bool"></a>
## 布尔字面量表达式

<a id="expr.literal.bool.intro"></a> 布尔字面量表达式由关键字 `true` 或 `false` 组成。

<a id="expr.literal.bool.result"></a> 该表达式的类型为基本 [布尔类型]，其值为：* 如果关键字为 `true`，则值为 true；* 如果关键字为 `false`，则值为 false。

[CStr]: core::ffi::CStr

[Escape]: #escapes
[Simple escape]: #simple-escapes
[Simple escapes]: #simple-escapes
[8-bit escape]: #8-bit-escapes
[8-bit escapes]: #8-bit-escapes
[7-bit escape]: #7-bit-escapes
[7-bit escapes]: #7-bit-escapes
[Unicode escape]: #unicode-escapes
[Unicode escapes]: #unicode-escapes
[String continuation escape]: #string-continuation-escapes
[String continuation escapes]: #string-continuation-escapes
[boolean type]: ../types/boolean.md
[constant expression]: ../const_eval.md#constant-expressions
[floating-point types]: ../types/numeric.md#floating-point-types
[lint check]: ../attributes/diagnostics.md#lint-check-attributes
[literal tokens]: ../tokens.md#literals
[numeric cast]: operator-expr.md#numeric-cast
[numeric types]: ../types/numeric.md
[suffix]: ../tokens.md#suffixes
[negation operator]: operator-expr.md#negation-operators
[overflow]: operator-expr.md#overflow
[Unicode scalar value]: http://www.unicode.org/glossary/#unicode_scalar_value
[Unicode scalar values]: http://www.unicode.org/glossary/#unicode_scalar_value
[`char`]: ../types/char.md
[`f32::from_str`]: ../../core/primitive.f32.md#method.from_str
[`f64::from_str`]: ../../core/primitive.f64.md#method.from_str
[`str`]: ../types/str.md
