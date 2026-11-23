<a id="lex.whitespace"></a>
# 空白字符

<a id="whitespace.syntax"></a> 
```grammar,lexer
WHITESPACE ->
      U+0009 // Horizontal tab, `'\t'`
    | U+000A // Line feed, `'\n'`
    | U+000B // Vertical tab
    | U+000C // Form feed
    | U+000D // Carriage return, `'\r'`
    | U+0020 // Space, `' '`
    | U+0085 // Next line
    | U+200E // Left-to-right mark
    | U+200F // Right-to-left mark
    | U+2028 // Line separator
    | U+2029 // Paragraph separator

TAB -> U+0009 // Horizontal tab, `'\t'`

LF -> U+000A  // Line feed, `'\n'`

CR -> U+000D  // Carriage return, `'\r'`

SP -> U+0020  // Space, `' '`
```

<a id="lex.whitespace.intro"></a> 空白字符是指任何仅由具有 [`Pattern_White_Space`] Unicode属性的字符组成的非空字符串。

<a id="lex.whitespace.token-sep"></a> Rust是一种“自由格式”语言，这意味着所有形式的空白字符仅用于分隔语法中的_标记_，而不具有语义意义。

<a id="lex.whitespace.replacement"></a> 如果将所有空白字符替换为任何其他合法的空白字符（例如单个空格字符），Rust程序的含义仍然相同。

[`Pattern_White_Space`]: https://www.unicode.org/reports/tr31/
