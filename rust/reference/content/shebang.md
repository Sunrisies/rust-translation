<a id="shebang"></a>
# Shebang

<a id="shebang.intro"></a> *[Shebang]* 是一种可选的行，通常用于类 Unix 系统中，用于指定执行文件的解释器。

> [!EXAMPLE]
> <!-- ignore: tests don't like shebang -->
> ```rust,ignore
> #!/usr/bin/env rustx
>
> fn main() {
>     println!("Hello!");
> }
> ```

<a id="shebang.syntax"></a> 
```grammar,lexer
@root SHEBANG ->
    `#!` !((WHITESPACE | LINE_COMMENT | SHEBANG_BLOCK_COMMENT)* `[`)
    ~LF* (LF | EOF)

SHEBANG_BLOCK_COMMENT ->
    `/*` !(`!` | `*` ![`*` `/`])
      ( SHEBANG_NESTED_BLOCK_COMMENT | (!(`*/` | `/*`) CHAR) )*
    `*/`

SHEBANG_NESTED_BLOCK_COMMENT ->
    `/*`
      ( SHEBANG_NESTED_BLOCK_COMMENT | (!(`*/` | `/*`) CHAR) )*
    `*/`
```

<a id="shebang.syntax-description"></a> Shebang 以 `#!` 字符开头，并延续到第一个 `U+000A`（LF）字符处，如果没有 LF 则延续到 EOF 处。如果 `#!` 字符后跟随 `[`（忽略中间的任何 [空白字符] 或非文档注释），则该行不被视为 shebang（以避免与 [inner attribute] 产生歧义）。

> [!NOTE]
> Doc comments are not ignored when determining whether `[` follows the `#!` characters. For example, `#! /*! */ [allow(unused)]` at the start of a file is a shebang, not an inner attribute, because `/*! */` is a doc comment. Likewise, text following `#!` that resembles an unterminated block comment, as in `#!/*`, does not cause an error; the line is a shebang.

<a id="shebang.position"></a> Shebang 可以直接出现在文件的开头，也可以出现在可选的 [字节序标记] 之后。

[non-doc comments]: comments.normal

[byte order mark]: https://en.wikipedia.org/wiki/Byte_order_mark#UTF-8
[inner attribute]: attributes.md
[shebang]: https://en.wikipedia.org/wiki/Shebang_(Unix)
[whitespace]: whitespace.md
