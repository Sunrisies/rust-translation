<a id="comments"></a>
# 注释

<a id="comments.syntax"></a> 
```grammar,lexer
@root COMMENT ->
      LINE_COMMENT
    | INNER_LINE_DOC
    | OUTER_LINE_DOC
    | INNER_BLOCK_DOC
    | OUTER_BLOCK_DOC
    | BLOCK_COMMENT

LINE_COMMENT ->
      `//` (~[`/` `!` LF] | `//`) ~LF*
    | `//` EOF
    | `//` _immediately followed by LF_

BLOCK_COMMENT ->
    `/*` ^
      ( BLOCK_COMMENT | BLOCK_CHAR )*
    `*/`

INNER_LINE_DOC ->
    `//!` ^ LINE_DOC_COMMENT_CONTENT (LF | EOF)

LINE_DOC_COMMENT_CONTENT -> (!CR ~LF)*

INNER_BLOCK_DOC ->
    `/*!` ^ ( NESTED_BLOCK_DOC_COMMENT | DOC_BLOCK_CHAR )* `*/`

OUTER_LINE_DOC ->
    `///` ^ LINE_DOC_COMMENT_CONTENT (LF | EOF)

OUTER_BLOCK_DOC ->
    `/**` ![`*` `/`]
      ^
      ~[`*` CR]
      ( NESTED_BLOCK_DOC_COMMENT | DOC_BLOCK_CHAR )*
    `*/`

BLOCK_CHAR -> !`*/` CHAR

DOC_BLOCK_CHAR -> (!(`*/` | CR) CHAR)

NESTED_BLOCK_DOC_COMMENT ->
    `/*` ( NESTED_BLOCK_DOC_COMMENT | DOC_BLOCK_CHAR )* `*/`
```

<a id="comments.normal"></a>
## 非文档注释

<a id="comments.normal.intro"></a> 注释采用通用的 C++ 风格，包括行注释（`//`）和块注释（`/* ... */`）。支持嵌套块注释。

<a id="comments.normal.tokenization"></a> 非文档注释被解释为空白字符。

<a id="comments.doc"></a>
## 文档注释

<a id="comments.doc.syntax"></a> 以恰好三个斜杠（`///`）开头的行文档注释，以及外部文档注释（`/** ... */`），都被解释为 [`doc`属性]的特殊语法。

<a id="comments.doc.attributes"></a> 即相当于在注释主体周围写入 `#[doc="..."]`，例如 `/// Foo` 会变成 `#[doc="Foo"]`，`/** Bar */` 会变成 `#[doc="Bar "]`。因此，它们必须出现在接受外部属性的内容之前。

<a id="comments.doc.inner-syntax"></a> 以 `//!` 开头的行注释和 `/*! ... */` 形式的块注释是适用于注释父级而非后续项的文档注释。

<a id="comments.doc.inner-attributes"></a> 即相当于在注释主体周围写入 `#![doc="..."]`。`//!` 注释通常用于描述占用源文件的模块。

<a id="comments.doc.bare-crs"></a> 字符 `U+000D`（CR）不允许出现在文档注释中。

> [!NOTE] > 传统上，文档注释包含 Markdown，以符合 `rustdoc` 的要求。然而，注释语法不尊重任何内部的 Markdown 格式。`/** `glob = "*/*.rs";` */` 会在第一个 `*/` 处终止注释，剩余的代码会导致语法错误。这略微限制了块文档注释的内容相比行文档注释。

> [!NOTE] > 之前会将 `U+000D`（CR）紧接着 `U+000A`（LF）的序列转换为单个 `U+000A`（LF）。

## Examples

```rust
//! A doc comment that applies to the implicit anonymous module of this crate

pub mod outer_module {

    //!  - Inner line doc
    //!! - Still an inner line doc (but with a bang at the beginning)

    /*!  - Inner block doc */
    /*!! - Still an inner block doc (but with a bang at the beginning) */

    //   - Only a comment
    ///  - Outer line doc (exactly 3 slashes)
    //// - Only a comment

    /*   - Only a comment */
    /**  - Outer block doc (exactly) 2 asterisks */
    /*** - Only a comment */

    pub mod inner_module {}

    pub mod nested_comments {
        /* In Rust /* we can /* nest comments */ */ */

        // All three types of block comments can contain or be nested inside
        // any other type:

        /*   /* */  /** */  /*! */  */
        /*!  /* */  /** */  /*! */  */
        /**  /* */  /** */  /*! */  */
        pub mod dummy_item {}
    }

    pub mod degenerate_cases {
        // empty inner line doc
        //!

        // empty inner block doc
        /*!*/

        // empty line comment
        //

        // empty outer line doc
        ///

        // empty block comment
        /**/

        pub mod dummy_item {}

        // empty 2-asterisk block isn't a doc block, it is a block comment
        /***/

    }

    /* The next one isn't allowed because outer doc comments
       require an item that will receive the doc */

    /// Where is my item?
#   mod boo {}
}
```

[`doc` attributes]: ../rustdoc/the-doc-attribute.html
