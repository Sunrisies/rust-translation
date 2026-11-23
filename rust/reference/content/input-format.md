<a id="input"></a>
# 输入格式

<a id="input.syntax"></a> 
```grammar,lexer
CHAR -> [U+0000-U+D7FF U+E000-U+10FFFF] // a Unicode scalar value

ASCII -> [U+0000-U+007F]

NUL -> U+0000

EOF -> !CHAR  // End of file or input
```

<a id="input.intro"></a> 本章描述了如何将源文件解释为一系列标记。

有关程序如何被组织到文件中的描述，请参阅 [Crates and source files]。

<a id="input.encoding"></a>
## 源编码

<a id="input.encoding.utf8"></a> 每个源文件都被解释为以 UTF-8 编码的 Unicode 字符序列。

<a id="input.encoding.invalid"></a> 如果文件不是有效的 UTF-8，则视为错误。

<a id="input.byte-order-mark"></a>
## 字节序标记移除

如果序列中的第一个字符是 `U+FEFF` ([字节序标记])，则会被移除。

<a id="input.crlf"></a>
## CRLF 标准化

每对字符 `U+000D` (CR) 紧接着 `U+000A` (LF) 会被替换为单个 `U+000A` (LF)。这种替换只发生一次，因此标准化后输入中仍可能存在 `U+000D` (CR) 紧接着 `U+000A` (LF) 的情况（例如，如果原始输入包含 "CR CR LF LF"）。

其他出现的 `U+000D` (CR) 字符则保留不变（被视为 [空白字符]）。

<a id="input.shebang"></a>
## Shebang 移除

<a id="input.shebang.removal"></a> 如果存在 [shebang]，则从输入序列中移除它（因此被忽略）。

<a id="input.tokenization"></a>
## 标记化

随后将得到的字符序列按照本章其余部分的描述转换为标记。

> [!NOTE] > 标准库 [`include!`] 宏会对所读取的文件应用以下转换： > > - 字节序标记移除。 > - CRLF 标准化。 > - 在项上下文中使用时移除 Shebang（与表达式或语句上下文不同）。 > > [`include_str!`] 和 [`include_bytes!`] 宏不会应用这些转换。

[BYTE ORDER MARK]: https://en.wikipedia.org/wiki/Byte_order_mark#UTF-8
[Crates and source files]: crates-and-source-files.md
[shebang]: shebang.md
[whitespace]: whitespace.md
