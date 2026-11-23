<a id="lex.token"></a>
# 标记

<a id="lex.token.syntax"></a> 
```grammar,lexer
Token ->
      RESERVED_TOKEN
    | RAW_IDENTIFIER
    | CHAR_LITERAL
    | STRING_LITERAL
    | RAW_STRING_LITERAL
    | BYTE_LITERAL
    | BYTE_STRING_LITERAL
    | RAW_BYTE_STRING_LITERAL
    | C_STRING_LITERAL
    | RAW_C_STRING_LITERAL
    | FLOAT_LITERAL
    | INTEGER_LITERAL
    | LIFETIME_TOKEN
    | PUNCTUATION
    | IDENTIFIER_OR_KEYWORD
```

<a id="lex.token.intro"></a> 标记是常规（非递归）语言语法中定义的原始产生式。Rust 源代码输入可以被分解为以下类型的标记：

* [关键字] * [标识符][identifier] * [字面量](#literals) * [生命周期](#lifetimes-and-loop-labels) * [标点符号](#punctuation) * [分隔符](#delimiters)

在本文档的语法中，“简单”标记以 [字符串表产生式] 形式呈现，并以 `monospace` 字体显示。


<a id="lex.token.literal"></a>
## 字面量

<a id="lex.token.literal.intro"></a> 字面量是在 [字面量表达式] 中使用的标记。

### Examples

#### 字符和字符串

|                                              | Example         | `#`&nbsp;sets[^nsets] | Characters  | Escapes             |
|----------------------------------------------|-----------------|------------|-------------|---------------------|
| [Character](#character-literals)             | `'H'`           | 0          | All Unicode | [Quote](#quote-escapes) & [ASCII](#ascii-escapes) & [Unicode](#unicode-escapes) |
| [String](#string-literals)                   | `"hello"`       | 0          | All Unicode | [Quote](#quote-escapes) & [ASCII](#ascii-escapes) & [Unicode](#unicode-escapes) |
| [Raw string](#raw-string-literals)           | `r#"hello"#`    | <256       | All Unicode | `N/A`                                                      |
| [Byte](#byte-literals)                       | `b'H'`          | 0          | All ASCII   | [Quote](#quote-escapes) & [Byte](#byte-escapes)                               |
| [Byte string](#byte-string-literals)         | `b"hello"`      | 0          | All ASCII   | [Quote](#quote-escapes) & [Byte](#byte-escapes)                               |
| [Raw byte string](#raw-byte-string-literals) | `br#"hello"#`   | <256       | All ASCII   | `N/A`                                                      |
| [C string](#c-string-literals)               | `c"hello"`      | 0          | All Unicode | [Quote](#quote-escapes) & [Byte](#byte-escapes) & [Unicode](#unicode-escapes)   |
| [Raw C string](#raw-c-string-literals)       | `cr#"hello"#`   | <256       | All Unicode | `N/A`                                                                           |



#### ASCII 转义序列

|   | Name |
|---|------|
| `\x41` | 7-bit character code (exactly 2 hex digits, up to 0x7F) |
| `\n` | Newline |
| `\r` | Carriage return |
| `\t` | Tab |
| `\\` | Backslash |
| `\0` | Null |

#### 字节转义

|   | Name |
|---|------|
| `\x7F` | 8-bit character code (exactly 2 hex digits) |
| `\n` | Newline |
| `\r` | Carriage return |
| `\t` | Tab |
| `\\` | Backslash |
| `\0` | Null |

#### Unicode 转义

|   | Name |
|---|------|
| `\u{7FFF}` | 24-bit Unicode character code (up to 6 hex digits) |

#### 引号转义

|   | Name |
|---|------|
| `\'` | Single quote |
| `\"` | Double quote |

#### Numbers

| [Number literals](#number-literals)[^nl] | Example | Exponentiation |
|----------------------------------------|---------|----------------|
| Decimal integer | `98_222` | `N/A` |
| Hex integer | `0xff` | `N/A` |
| Octal integer | `0o77` | `N/A` |
| Binary integer | `0b1111_0000` | `N/A` |
| Floating-point | `123.0E+77` | `Optional` |


<a id="lex.token.literal.suffix"></a>
#### 后缀

<a id="lex.token.literal.literal.suffix.intro"></a> 后缀是跟随在具有相同形式的非原始标识符或关键字字面量之后的字符序列，中间没有空格。

<a id="lex.token.literal.suffix.syntax"></a> 
```grammar,lexer
SUFFIX ->
      `_` ^ XID_Continue+
    | XID_Start XID_Continue*
```

<a id="lex.token.literal.suffix.validity"></a> 任何带有后缀的字面量（字符串、整数等）都可以作为标记使用。

带有任何后缀的字面量标记可以传递给宏而不会产生错误。宏本身将决定如何解释该标记以及是否产生错误。特别是，by-example 宏的 `literal` 片段说明符与具有任意后缀的字面量标记匹配。

```rust
macro_rules! blackhole { ($tt:tt) => () }
macro_rules! blackhole_lit { ($l:literal) => () }

blackhole!("string"suffix); // OK
blackhole_lit!(1suffix); // OK
```

<a id="lex.token.literal.suffix.parse"></a> 然而，被解释为字面量表达式或模式的字面量标记的后缀是受限的。非数字字面量标记的任何后缀都会被拒绝，而数字字面量标记仅接受以下列表中的后缀。

| Integer | Floating-point |
|---------|----------------|
| `u8`, `i8`, `u16`, `i16`, `u32`, `i32`, `u64`, `i64`, `u128`, `i128`, `usize`, `isize` | `f32`, `f64` |

### 字符和字符串字面量

<a id="lex.token.literal.char"></a>
#### 字符字面量

<a id="lex.token.literal.char.syntax"></a> 
```grammar,lexer
CHAR_LITERAL ->
    `'`
        ( ~[`'` `\` LF CR TAB] | QUOTE_ESCAPE | ASCII_ESCAPE | UNICODE_ESCAPE )
    `'` SUFFIX?

QUOTE_ESCAPE -> `\'` | `\"`

ASCII_ESCAPE ->
      `\x` OCT_DIGIT HEX_DIGIT
    | `\n` | `\r` | `\t` | `\\` | `\0`

UNICODE_ESCAPE ->
    `\u{` ( HEX_DIGIT `_`* ){1..=6} _valid hex char value_ `}`[^valid-hex-char]
```


<a id="lex.token.literal.char.intro"></a> 字符字面量是指被两个 `U+0027` (单引号) 字符包围的单个 Unicode 字符，但 `U+0027` 本身除外，它必须被前面的 `U+005C` 字符 (`\`) 进行转义。

<a id="lex.token.literal.str"></a>
#### 字符串字面量

<a id="lex.token.literal.str.syntax"></a> 
```grammar,lexer
STRING_LITERAL ->
    `"` (
        ~[`"` `\` CR]
      | QUOTE_ESCAPE
      | ASCII_ESCAPE
      | UNICODE_ESCAPE
      | STRING_CONTINUE
    )* `"` SUFFIX?

STRING_CONTINUE -> `\` LF [TAB LF CR SP]*
```

<a id="lex.token.literal.str.intro"></a> 字符串字面量是指被两个 `U+0022` (双引号) 字符包围的任意 Unicode 字符序列，但 `U+0022` 本身除外，它必须被前面的 `U+005C` 字符 (`\`) 进行转义。

<a id="lex.token.literal.str.linefeed"></a> 字符串字面量中允许使用由字符 `U+000A` (LF) 表示的换行符。字符 `U+000D` (CR) 不得出现在字符串字面量中。当未转义的 `U+005C` 字符 (`\`) 直接出现在换行符之前时，该字符串中不会包含换行符。详情请参阅 [字符串延续转义]。

<a id="lex.token.literal.char-escape"></a>
#### 字符转义

<a id="lex.token.literal.char-escape.intro"></a> 在字符字面量或非原始字符串字面量中可以使用一些额外的转义方式。转义以 `U+005C` (`\`) 开始，并采用以下形式之一继续：

<a id="lex.token.literal.char-escape.ascii"></a> * 7位代码点转义以 `U+0078` (`x`) 开始，后面跟着恰好两个十六进制数字，其值不超过 `0x7F`。它表示具有所提供十六进制值值的 ASCII 字符。更高的值是不允许的，因为无法明确它们指的是 Unicode 代码点还是字节值。

<a id="lex.token.literal.char-escape.unicode"></a> * 24位代码点转义以 `U+0075` (`u`) 开始，后面跟着最多六个十六进制数字，这些数字被大括号 `U+007B` (`{`) 和 `U+007D` (`}`) 包围。它表示具有所提供十六进制值值的 Unicode 代码点。该值必须是有效的 Unicode 标量值。

<a id="lex.token.literal.char-escape.whitespace"></a> * 空白字符转义是指 `U+006E` (`n`)、`U+0072` (`r`) 或 `U+0074` (`t`) 这些字符，分别表示 Unicode 值 `U+000A` (LF)、`U+000D` (CR) 或 `U+0009` (HT)。

<a id="lex.token.literal.char-escape.null"></a> * 空字符转义是指 `U+0030` (`0`) 这个字符，表示 Unicode 值 `U+0000` (NUL)。

<a id="lex.token.literal.char-escape.slash"></a> * 反斜杠转义是指 `U+005C` (`\`) 这个字符，为了表示其自身必须进行转义处理。

<a id="lex.token.literal.str-raw"></a>
#### 原始字符串字面量

<a id="lex.token.literal.str-raw.syntax"></a> 
```grammar,lexer
RAW_STRING_LITERAL ->
      `r` `"` ^ RAW_STRING_CONTENT `"` SUFFIX?
    | `r` `#`{n:1..=255} ^ `"` RAW_STRING_CONTENT_HASHED `"` `#`{n} SUFFIX?

RAW_STRING_CONTENT -> (!`"` ~CR )*

RAW_STRING_CONTENT_HASHED -> (!(`"` `#`{n}) ~CR )*
```

<a id="lex.token.literal.str-raw.intro"></a> 原始字符串字面量不会处理任何转义字符。它们以 `U+0072` (`r`) 字符开始，随后是少于 256 个的 `U+0023` (`#`) 字符和一个 `U+0022` (双引号) 字符。

<a id="lex.token.literal.str-raw.body"></a> 原始字符串字面量的主体可以包含任何非 `U+000D` (CR) 的 Unicode 字符序列。它仅由另一个 `U+0022` (双引号) 字符终止，后面跟着与开闭双引号字符前相同的数量 `U+0023` (`#`) 字符。

<a id="lex.token.literal.str-raw.content"></a> 原始字符串主体中包含的所有 Unicode 字符均具有实际意义；除了那些后跟至少与开始原始字符串字面量时使用的相同数量的 `U+0023` (`#`) 字符或 `U+005C` (`\`) 字符外，`U+0022` (双引号) 字符没有特殊含义。

字符串字面量的示例：

```rust
"foo"; r"foo";                     // foo
"\"foo\""; r#""foo""#;             // "foo"

"foo #\"# bar";
r##"foo #"# bar"##;                // foo #"# bar

"\x52"; "R"; r"R";                 // R
"\\x52"; r"\x52";                  // \x52
```

### 字节和字节字符串字面量

<a id="lex.token.byte"></a>
#### 字节字面量

<a id="lex.token.byte.syntax"></a> 
```grammar,lexer
BYTE_LITERAL ->
    `b'` ^ ( ASCII_FOR_CHAR | BYTE_ESCAPE )  `'` SUFFIX?

ASCII_FOR_CHAR -> ![`'` `\` LF CR TAB] ASCII

BYTE_ESCAPE ->
      `\x` HEX_DIGIT HEX_DIGIT
    | `\n` | `\r` | `\t` | `\\` | `\0` | `\'` | `\"`
```

<a id="lex.token.byte.intro"></a> 字节字面量是一个单个 ASCII 字符（在 `U+0000` 到 `U+007F` 范围内），或者一个转义字符，前面有 `U+0062` (`b`) 和 `U+0027` (单引号) 字符，后面跟着 `U+0027` 字符。如果字面量中包含 `U+0027` 字符，则必须通过前面的 `U+005C` (`\`) 字符进行转义。它相当于一个 `u8` 无符号 8 位整数数字字面量。

<a id="lex.token.str-byte"></a>
#### 字节字符串字面量

<a id="lex.token.str-byte.syntax"></a> 
```grammar,lexer
BYTE_STRING_LITERAL ->
    `b"` ^ ( ASCII_FOR_STRING | BYTE_ESCAPE | STRING_CONTINUE )* `"` SUFFIX?

ASCII_FOR_STRING -> ![`"` `\` CR] ASCII
```

<a id="lex.token.str-byte.intro"></a> 非原始字节字符串字面量是由ASCII字符和转义序列组成的序列，其前面有`U+0062`（`b`）和`U+0022`（双引号）字符，后面有`U+0022`字符。如果字面量中包含`U+0022`字符，则必须通过前面的`U+005C`（`\`）字符进行转义。或者，字节字符串字面量也可以是一个原始字节字符串字面量，具体定义见下文。

<a id="lex.token.str-byte.linefeed"></a> 字节字符串字面量中允许使用由`U+000A`（LF）字符表示的换行符。`U+000D`（CR）字符不得出现在字节字符串字面量中。当未转义的`U+005C`（`\`）字符紧接在换行符之前时，该字符串中不会显示换行符。详情请参阅[字符串延续转义]。

<a id="lex.token.str-byte.escape"></a> 在字节或非原始字节字符串字面量中还可以使用一些额外的转义序列。转义开始以`U+005C`（`\`）开头，并继续采用以下形式之一：

<a id="lex.token.str-byte.escape-byte"></a> * 字节转义转义以`U+0078`（`x`）开头，后面跟着恰好两个十六进制数字。它表示与提供的十六进制值相等的字节。

<a id="lex.token.str-byte.escape-whitespace"></a> * 空白字符转义包括`U+006E`（`n`）、`U+0072`（`r`）或`U+0074`（`t`）这些字符，分别表示`0x0A`（ASCII LF）、`0x0D`（ASCII CR）或`0x09`（ASCII HT）的字节值。

<a id="lex.token.str-byte.escape-null"></a> * 空转义是`U+0030`（`0`）字符，表示字节值`0x00`（ASCII NUL）。

<a id="lex.token.str-byte.escape-slash"></a> * 反斜杠转义是`U+005C`（`\`）字符，为了表示其ASCII编码`0x5C`，必须对其进行转义。

<a id="lex.token.str-byte-raw"></a>
#### 原始字节字符串字面量

<a id="lex.token.str-byte-raw.syntax"></a> 
```grammar,lexer
RAW_BYTE_STRING_LITERAL ->
      `br` `"` ^ RAW_BYTE_STRING_CONTENT `"` SUFFIX?
    | `br` `#`{n:1..=255} ^ `"` RAW_BYTE_STRING_CONTENT_HASHED `"` `#`{n} SUFFIX?

RAW_BYTE_STRING_CONTENT -> (!`"` ASCII_FOR_RAW )*

RAW_BYTE_STRING_CONTENT_HASHED -> (!(`"` `#`{n}) ASCII_FOR_RAW )*

ASCII_FOR_RAW -> !CR ASCII
```

<a id="lex.token.str-byte-raw.intro"></a> 原始字节字符串字面量不会处理任何转义序列。它们以`U+0062`（`b`）字符开始，接着是`U+0072`（`r`），然后是少于256个的`U+0023`（`#`）字符，最后是一个`U+0022`（双引号）字符。

<a id="lex.token.str-byte-raw.body"></a> 原始字符串体可以包含任何非 `U+000D` (CR) 的 ASCII 字符序列。它仅由另一个 `U+0022` (双引号) 字符终止，后面跟着与起始 `U+0022` (双引号) 字符前相同数量的 `U+0023` (`#`) 字符。原始字节字符串字面量不能包含任何非 ASCII 字节。

<a id="lex.token.literal.str-byte-raw.content"></a> 原始字符串体中所有字符都代表其 ASCII 编码；除了那些后面跟着至少与起始原始字符串字面量相同数量的 `U+0023` (`#`) 字符的 `U+0022` (双引号) 或 `U+005C` (`\`) 外，这些字符没有特殊含义。

原始字节字符串字面的示例：

```rust
b"foo"; br"foo";                     // foo
b"\"foo\""; br#""foo""#;             // "foo"

b"foo #\"# bar";
br##"foo #"# bar"##;                 // foo #"# bar

b"\x52"; b"R"; br"R";                // R
b"\\x52"; br"\x52";                  // \x52
```

### C 字符串和原始 C 字符串字面量

<a id="lex.token.str-c"></a>
#### C 字符串字面量

<a id="lex.token.str-c.syntax"></a> 
```grammar,lexer
C_STRING_LITERAL ->
    `c"` ^ (
        ~[`"` `\` CR NUL]
      | !(`\0` | `\x00`) BYTE_ESCAPE
      | !(`\u{` (`0` `_`*){1..=6} `}`) UNICODE_ESCAPE
      | STRING_CONTINUE
    )* `"` SUFFIX?
```

<a id="lex.token.str-c.intro"></a> _C 字符串字面量_ 是由 Unicode 字符和转义序列组成，前面有 `U+0063` (`c`) 和 `U+0022` (双引号) 字符，后面有 `U+0022` 字符。如果字面量中存在 `U+0022` 字符，则必须通过前面的 `U+005C` (`\`) 字符进行转义。或者，C 字符串字面量也可以是一个下面定义的_原始 C 字符串字面量_。


<a id="lex.token.str-c.null"></a> C 字符串被隐含地由字节 `0x00` 终止，因此 C 字符串字面量 `c""` 等同于从字节字符串字面量 `b"\x00"` 手动构造 `&CStr`。除了这个隐含的终止符外，C 字符串中不允许使用字节 `0x00`。

<a id="lex.token.str-c.linefeed"></a> C 字符串字面量允许行分隔符，由字符 `U+000A` (LF) 表示。C 字符串字面量中不能出现 `U+000D` (CR) 字符。当未转义的 `U+005C` 字符 (`\`) 出现在行分隔符之前时，该字符串中不会显示行分隔符。详情请参阅[字符串延续转义]。

<a id="lex.token.str-c.escape"></a> 非原始 C 字符串字面量中还有一些额外的_转义_。转义开始以 `U+005C` (`\`) 开头，并继续采用以下形式之一：

<a id="lex.token.str-c.escape-byte"></a> * 字节转义 – 该转义符以 `U+0078` (`x`) 开头，后跟恰好两个十六进制数字。它表示与提供的十六进制值相等的字节。

<a id="lex.token.str-c.escape-unicode"></a> * 24位代码点转义 – 该转义符以 `U+0075` (`u`) 开头，后跟最多六个十六进制数字，这些数字被大括号 `U+007B` (`{`) 和 `U+007D` (`}`) 包围。它表示与提供的十六进制值相等的Unicode代码点，按UTF-8编码形式表示。

<a id="lex.token.str-c.escape-whitespace"></a> * 空白字符转义 – 该转义符是字符 `U+006E` (`n`), `U+0072` (`r`) 或 `U+0074` (`t`），分别表示字节值 `0x0A` (ASCII LF), `0x0D` (ASCII CR) 或 `0x09` (ASCII HT)。

<a id="lex.token.str-c.escape-slash"></a> * 反斜杠转义 – 该转义符是字符 `U+005C` (`\`），必须进行转义才能表示其ASCII编码 `0x5C`。

<a id="lex.token.str-c.char-unicode"></a> C字符串表示没有定义编码的字节，但C字符串字面量可以包含 `U+007F` 以上的Unicode字符。这些字符将被替换为该字符的UTF-8表示形式的字节。

以下C字符串字面量是等价的：

```rust
c"æ";        // LATIN SMALL LETTER AE (U+00E6)
c"\u{00E6}";
c"\xC3\xA6";
```

<a id="lex.token.str-c.edition2021"></a> 
> [!EDITION-2021]
> C string literals are accepted in the 2021 edition or later. In earlier editions the token `c""` is lexed as `c ""`.

<a id="lex.token.str-c-raw"></a>
#### 原始C字符串字面量

<a id="lex.token.str-c-raw.syntax"></a> 
```grammar,lexer
RAW_C_STRING_LITERAL ->
      `cr` `"` ^ RAW_C_STRING_CONTENT `"` SUFFIX?
    | `cr` `#`{n:1..=255} ^ `"` RAW_C_STRING_CONTENT_HASHED `"` `#`{n} SUFFIX?

RAW_C_STRING_CONTENT -> (!`"` ~[CR NUL] )*

RAW_C_STRING_CONTENT_HASHED -> (!(`"` `#`{n}) ~[CR NUL] )*
```

<a id="lex.token.str-c-raw.intro"></a> 原始C字符串字面量不会处理任何转义。它们以字符 `U+0063` (`c`) 开始，接着是 `U+0072` (`r`)，然后少于256个的字符 `U+0023` (`#`)，最后是一个 `U+0022` (双引号) 字符。

<a id="lex.token.str-c-raw.body"></a> _原始C字符串主体_ 可以包含任何非 `U+0000` (NUL) 和 `U+000D` (CR) 的Unicode字符序列。它仅由另一个 `U+0022` (双引号) 字符终止，后面跟着与开启 `U+0022` (双引号) 字符前相同的数量个 `U+0023` (`#`) 字符。

<a id="lex.token.str-c-raw.content"></a> 原始 C 字符串主体中包含的所有字符均以 UTF-8 编码显示。字符 `U+0022`（双引号）（除非其后跟随了与起始原始 C 字符串字面量相同数量的 `U+0023`（`#`）字符）或 `U+005C`（`\`）没有特殊含义。

<a id="lex.token.str-c-raw.edition2021"></a> 
> [!EDITION-2021]
> Raw C string literals are accepted in the 2021 edition or later. In earlier editions the token `cr""` is lexed as `cr ""`, and `cr#""#` is lexed as `cr #""#` (which is non-grammatical).

#### 原始 C 字符串和原始 C 字符串字面量的示例

```rust
c"foo"; cr"foo";                     // foo
c"\"foo\""; cr#""foo""#;             // "foo"

c"foo #\"# bar";
cr##"foo #"# bar"##;                 // foo #"# bar

c"\x52"; c"R"; cr"R";                // R
c"\\x52"; cr"\x52";                  // \x52
```

<a id="lex.token.literal.num"></a>
### 数字字面量

_数字字面量_ 要么是_整数字面量_，要么是_浮点字面量_。识别这两种类型字面的语法是混合的。

<a id="lex.token.literal.int"></a>
#### 整数字面量

<a id="lex.token.literal.int.syntax"></a> 
```grammar,lexer
INTEGER_LITERAL ->
    ( BIN_LITERAL | OCT_LITERAL | HEX_LITERAL | DEC_LITERAL )
    ^ !RESERVED_FLOAT SUFFIX?

DEC_LITERAL -> DEC_DIGIT (DEC_DIGIT|`_`)*

BIN_LITERAL -> `0b` ^ `_`* BIN_DIGIT (BIN_DIGIT|`_`)* ![`e` `E` `2`-`9`]

OCT_LITERAL -> `0o` ^ `_`* OCT_DIGIT (OCT_DIGIT|`_`)* ![`e` `E` `8`-`9`]

HEX_LITERAL -> `0x` ^ `_`* HEX_DIGIT (HEX_DIGIT|`_`)*

BIN_DIGIT -> [`0`-`1`]

OCT_DIGIT -> [`0`-`7`]

DEC_DIGIT -> [`0`-`9`]

HEX_DIGIT -> [`0`-`9` `a`-`f` `A`-`F`]

RESERVED_FLOAT -> `.` !(`.` | `_` | XID_Start)
```

<a id="lex.token.literal.int.kind"></a> _整数字面量_ 有四种形式之一：

<a id="lex.token.literal.int.kind-dec"></a> * _十进制字面量_ 以*十进制数字*开头，随后可以是*十进制数字*和下划线的任意组合。

<a id="lex.token.literal.int.kind-hex"></a> * _十六进制字面量_ 以字符序列 `U+0030` `U+0078`（`0x`）开头，随后可以是十六进制数字和下划线的任意组合（至少包含一个数字）。

<a id="lex.token.literal.int.kind-oct"></a> * _八进制字面量_ 以字符序列 `U+0030` `U+006F`（`0o`）开头，随后可以是八进制数字和下划线的任意组合（至少包含一个数字）。

<a id="lex.token.literal.int.kind-bin"></a> * _二进制字面量_ 以字符序列 `U+0030` `U+0062`（`0b`）开头，随后可以是二进制数字和下划线的任意组合（至少包含一个数字）。

<a id="lex.token.literal.int.suffix"></a> 与任何字面量一样，整数字面量后面可以立即跟随上述形式的后缀，且无需空格。该后缀不能以 `e` 或 `E` 开头，因为这将被解释为浮点字面的指数。有关这些后缀的效果，请参阅[整数字面量表达式]。

作为字面表达式接受的整数字面量的示例：

```rust
# #![allow(overflowing_literals)]
123;
123i32;
123u32;
123_u32;

0xff;
0xff_u8;
0x01_f32; // integer 7986, not floating-point 1.0
0x01_e3;  // integer 483, not floating-point 1000.0

0o70;
0o70_i16;

0b1111_1111_1001_0000;
0b1111_1111_1001_0000i64;
0b________1;

0usize;

// These are too big for their type, but are accepted as literal expressions.
128_i8;
256_u8;

// This is an integer literal, accepted as a floating-point literal expression.
5f32;
```

请注意，例如 `-1i8` 被解析为两个标记：- 后跟 `1i8`。

不作为字面表达式接受的整数字面量的示例：

```rust
# #[cfg(false)] {
0invalidSuffix;
123AFB43;
0b010a;
0xAB_CD_EF_GH;
0b1111_f32;
# }
```

<a id="lex.token.literal.int.invalid"></a>
##### 无效的整数字面量

<a id="lex.token.literal.int.invalid.intro"></a> 某些整数字面量形式无效。为了避免歧义，分词器会拒绝这些形式，而不是将其拆分为独立的标记。

```rust,compile_fail
0b0102;  // This is not `0b010` followed by `2`.
0o1279;  // This is not `0o127` followed by `9`.
0x80.0;  // This is not `0x80` followed by `.` and `0`.
0b101e;  // This is not a suffixed literal or `0b101` followed by `e`.
0b;      // This is not an integer literal or `0` followed by `b`.
0b_;     // This is not an integer literal or `0` followed by `b_`.
2em;     // This is not a suffixed literal or `2` followed by `em`.
2.0em;   // This is not a suffixed literal or `2.0` followed by `em`.
```

<a id="lex.token.literal.int.out-of-range"></a> 如果未加后缀的二进制或八进制字面量后面没有空格，紧接着出现超出其基数范围的十进制数字，则属于错误。

<a id="lex.token.literal.int.period"></a> 如果未加空格的二进制、八进制或十六进制字面量后面紧接着是小数点字符（遵循与浮点字面量相同的限制），则属于错误。

<a id="lex.token.literal.int.exp"></a> 如果未加后缀的二进制或八进制字面量后面没有空格，紧接着出现字符 `e` 或 `E`，则属于错误。

<a id="lex.token.literal.int.empty-with-radix"></a> 如果基数前缀后没有跟随至少一个有效的数字用于该基数，则属于错误。

<a id="lex.token.literal.int.tuple-field"></a>
#### 元组索引

<a id="lex.token.literal.int.tuple-field.syntax"></a> 
```grammar,lexer
TUPLE_INDEX -> DEC_LITERAL | BIN_LITERAL | OCT_LITERAL | HEX_LITERAL
```

<a id="lex.token.literal.int.tuple-field.intro"></a> 元组索引用于引用 [元组]、[元组结构体] 和 [元组枚举变体] 的字段。

<a id="lex.token.literal.int.tuple-field.eq"></a> 元组索引直接与字面标记比较。元组索引以 `0` 开始，每个连续的索引值增加 `1`。因此，只有十进制数值才能匹配，且数值不能包含额外的 `0` 前缀字符。

元组索引不得包含任何后缀（如 `usize`）。

```rust,compile_fail
let example = ("dog", "cat", "horse");
let dog = example.0;
let cat = example.1;
// The following examples are invalid.
let cat = example.01;  // ERROR no field named `01`
let horse = example.0b10;  // ERROR no field named `0b10`
let unicorn = example.0usize; // ERROR suffixes on a tuple index are invalid
let underscore = example.0_0; // ERROR no field `0_0` on type `(&str, &str, &str)`
```

<a id="lex.token.literal.float"></a>
#### 浮点字面量

<a id="lex.token.literal.float.syntax"></a> 
```grammar,lexer
FLOAT_LITERAL ->
      DEC_LITERAL (`.` DEC_LITERAL)? FLOAT_EXPONENT SUFFIX?
    | DEC_LITERAL `.` DEC_LITERAL SUFFIX?
    | DEC_LITERAL `.` !(`.` | `_` | XID_Start)

FLOAT_EXPONENT ->
    (`e`|`E`) ^ (`+`|`-`)? `_`* DEC_DIGIT (DEC_DIGIT|`_`)*
```

<a id="lex.token.literal.float.form"></a> 一个 _浮点字面量_ 有两种形式：

* 一个 _十进制字面量_ 后跟小数点字符 `U+002E` (`.`)。该形式可以再跟随另一个十进制字面量及可选的 _指数_。 * 一个单独的 _十进制字面量_ 后跟 _指数_。

<a id="lex.token.literal.float.suffix"></a> 与整数字面量类似，浮点字面量也可以后接后缀，只要前缀部分不以 `U+002E` (`.`) 结尾即可。如果字面量不包含指数，后缀不能以 `e` 或 `E` 开头。关于这些后缀的效果，请参阅 [浮点字面量表达式]。

作为字面表达式接受的浮点字面量示例：

```rust
123.0f64;
0.1f64;
0.1f32;
12E+99_f64;
let x: f64 = 2.;
```

最后一个示例有所不同，因为无法将后缀语法与以句点结尾的浮点字面量结合使用。`2.f64` 会尝试对 `2` 调用名为 `f64` 的方法。

请注意，例如 `-1.0` 被解析为两个标记：`-` 后跟 `1.0`。

作为字面表达式不被接受的浮点字面量示例：

```rust
# #[cfg(false)] {
2.0f80;
2e5f80;
2e5e6;
2.0e5e6;
1.3e10u64;
# }
```

<a id="lex.token.literal.float.invalid-exponent"></a> 如果浮点字面量包含没有数字的指数，则属于错误。

```rust,compile_fail
2e;   // This is not a floating-point literal or `2` followed by `e`.
2.0e; // This is not a floating-point literal or `2.0` followed by `e`.
```

<a id="lex.token.life"></a>
## 生命周期和循环标签

<a id="lex.token.life.syntax"></a> 
```grammar,lexer
LIFETIME_TOKEN ->
      RAW_LIFETIME
    | `'` IDENTIFIER_OR_KEYWORD !`'`

LIFETIME_OR_LABEL ->
      RAW_LIFETIME
    | `'` NON_KEYWORD_IDENTIFIER !`'`

RAW_LIFETIME ->
    `'r#` ^ IDENTIFIER_OR_KEYWORD !`'`

RESERVED_RAW_LIFETIME -> `'r#` (`_` | `crate` | `self` | `Self` | `super`) !(`'` | XID_Continue)
```

<a id="lex.token.life.intro"></a> 生命周期参数和 [循环标签] 使用 LIFETIME_OR_LABEL 标记。任何 LIFETIME_TOKEN 都会被词法分析器接受，例如可以在宏中使用。

<a id="lex.token.life.raw.intro"></a> 原始生命周期类似于普通生命周期，但其标识符前带有 `r#` 前缀。（注意，`r#` 前缀并不属于实际的生命周期的一部分。）

<a id="lex.token.life.raw.allowed"></a> 与普通生命周期不同，原始生命周期可以是任何严格或保留关键字，除了上述用于 `RAW_LIFETIME` 的术语。

<a id="lex.token.life.raw.reserved"></a> 使用 [RESERVED_RAW_LIFETIME] 标记是错误。

<a id="lex.token.life.raw.edition2021"></a> 
> [!EDITION-2021]
> Raw lifetimes are accepted in the 2021 edition or later. In earlier editions the token `'r#lt` is lexed as `'r # lt`.

<a id="lex.token.punct"></a>
## 标点符号

<a id="lex_token.punct.intro"></a> 标点符号标记被用作运算符、分隔符和语法的其他部分。

<a id="lex_token.punct.syntax"></a> 
```grammar,lexer
PUNCTUATION ->
      `...`
    | `..=`
    | `<<=`
    | `>>=`
    | `!=`
    | `%=`
    | `&&`
    | `&=`
    | `*=`
    | `+=`
    | `-=`
    | `->`
    | `..`
    | `/=`
    | `::`
    | `<-`
    | `<<`
    | `<=`
    | `==`
    | `=>`
    | `>=`
    | `>>`
    | `^=`
    | `|=`
    | `||`
    | `!`
    | `#`
    | `$`
    | `%`
    | `&`
    | `(`
    | `)`
    | `*`
    | `+`
    | `,`
    | `-`
    | `.`
    | `/`
    | `:`
    | `;`
    | `<`
    | `=`
    | `>`
    | `?`
    | `@`
    | `[`
    | `]`
    | `^`
    | `{`
    | `|`
    | `}`
    | `~`
```

> [!NOTE]
> See the [syntax index] for links to how punctuation characters are used.

<a id="lex_token.delim"></a>
## 定界符

括号符号在语法的不同部分被使用。开括号必须始终与闭括号配对。在[宏]中，括号及其内部的标记被称为“标记树”。三种类型的括号如下：

| Bracket | Type            |
|---------|-----------------|
| `{` `}` | Curly braces    |
| `[` `]` | Square brackets |
| `(` `)` | Parentheses     |

<a id="lex.token.reserved"></a>
## 保留标记

<a id="lex.token.reserved.intro"></a> 几种标记形式被保留用于未来使用或避免混淆。源输入与这些形式中的任何一种匹配是错误的。

<a id="lex.token.reserved.syntax"></a> 
```grammar,lexer
RESERVED_TOKEN ->
      RESERVED_GUARDED_STRING_LITERAL
    | RESERVED_POUNDS
    | RESERVED_RAW_IDENTIFIER
    | RESERVED_RAW_LIFETIME
    | RESERVED_TOKEN_DOUBLE_QUOTE
    | RESERVED_TOKEN_LIFETIME
    | RESERVED_TOKEN_POUND
    | RESERVED_TOKEN_SINGLE_QUOTE
```

<a id="lex.token.reserved-prefix"></a>
## 保留前缀

<a id="lex.token.reserved-prefix.syntax"></a> 
```grammar,lexer
RESERVED_TOKEN_DOUBLE_QUOTE ->
    IDENTIFIER_OR_KEYWORD _except `b` or `c` or `r` or `br` or `cr`_ `"`

RESERVED_TOKEN_SINGLE_QUOTE ->
    IDENTIFIER_OR_KEYWORD _except `b`_ `'`

RESERVED_TOKEN_POUND ->
    IDENTIFIER_OR_KEYWORD _except `r` or `br` or `cr`_ `#`

RESERVED_TOKEN_LIFETIME ->
    `'` IDENTIFIER_OR_KEYWORD _except `r`_ `#`
```

<a id="lex.token.reserved-prefix.intro"></a> 一些被称为_保留前缀_的词汇形式被保留用于未来使用。

<a id="lex.token.reserved-prefix.id"></a> 源输入中原本会被词法解析为非原始标识符（或关键字）且紧接着是 `#`、`'` 或 `"` 字符（没有中间空白）的情况，被识别为保留前缀。

<a id="lex.token.reserved-prefix.raw-token"></a> 请注意，原始标识符、原始字符串字面量和原始字节字符串字面量可能包含 `#` 字符，但不会被解释为包含保留前缀。

<a id="lex.token.reserved-prefix.strings"></a> 同样，`r`、`b`、`br`、`c` 和 `cr` 前缀在原始字符串字面量、字节字面量、字节字符串字面量、原始字节字符串字面量、C 字符串字面量和原始 C 字符串字面量中使用的，不会被解释为保留前缀。

<a id="lex.token.reserved-prefix.life"></a> 源输入中原本会被词法解析为非原始生命周期（或关键字）且紧接着是 `#` 字符（没有中间空白）的情况，被识别为保留生命周期前缀。

<a id="lex.token.reserved-prefix.edition2021"></a> 
> [!EDITION-2021]
> Starting with the 2021 edition, reserved prefixes are reported as an error by the lexer (in particular, they cannot be passed to macros).
>
> Before the 2021 edition, reserved prefixes are accepted by the lexer and interpreted as multiple tokens (for example, one token for the identifier or keyword, followed by a `#` token).
>
> Examples accepted in all editions:
> ```rust
> macro_rules! lexes {($($_:tt)*) => {}}
> lexes!{a #foo}
> lexes!{continue 'foo}
> lexes!{match "..." {}}
> lexes!{r#let#foo}         // three tokens: r#let # foo
> lexes!{'prefix #lt}
> ```
>
> Examples accepted before the 2021 edition but rejected later:
> ```rust,edition2018
> macro_rules! lexes {($($_:tt)*) => {}}
> lexes!{a#foo}
> lexes!{continue'foo}
> lexes!{match"..." {}}
> lexes!{'prefix#lt}
> ```

<a id="lex.token.reserved-guards"></a>
## 保留保护符

<a id="lex.token.reserved-guards.syntax"></a> 
```grammar,lexer
RESERVED_GUARDED_STRING_LITERAL -> `#`+ STRING_LITERAL

RESERVED_POUNDS -> `#`{2..}
```

<a id="lex.token.reserved-guards.intro"></a> 保留保护符是为未来使用而预留的语法结构，如果使用将会产生编译错误。

<a id="lex.token.reserved-guards.string-literal"></a> *保留的受保护字符串字面量* 是一个由一个或多个 `U+0023` (`#`) 字符紧接着 [STRING_LITERAL] 构成的标记。

<a id="lex.token.reserved-guards.pounds"></a> *保留的磅符号* 是一个由两个或更多个 `U+0023` (`#`) 字符构成的标记。

<a id="lex.token.reserved-guards.edition2024"></a> 
> [!EDITION-2024]
> Before the 2024 edition, reserved guards are accepted by the lexer and interpreted as multiple tokens. For example, the `#"foo"#` form is interpreted as three tokens. `##` is interpreted as two tokens.

[CStr]: core::ffi::CStr

[string table production]: notation.md#string-table-productions
[Floating-point literal expressions]: expressions/literal-expr.md#floating-point-literal-expressions
[identifier]: identifiers.md
[Integer literal expressions]: expressions/literal-expr.md#integer-literal-expressions
[keywords]: keywords.md
[literal expressions]: expressions/literal-expr.md
[loop labels]: expressions/loop-expr.md#loop-labels
[macros]: macros-by-example.md
[String continuation escapes]: expressions/literal-expr.md#string-continuation-escapes
[syntax index]: syntax-index.md#operators-and-punctuation
[tuple structs]: items/structs.md
[tuple enum variants]: items/enumerations.md
[tuples]: types/tuple.md
