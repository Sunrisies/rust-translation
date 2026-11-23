<a id="ident"></a>
# 标识符

<a id="ident.syntax"></a> 
```grammar,lexer
IDENTIFIER_OR_KEYWORD -> ( XID_Start | `_` ) XID_Continue*

XID_Start -> <`XID_Start` defined by Unicode>

XID_Continue -> <`XID_Continue` defined by Unicode>

RAW_IDENTIFIER -> `r#` IDENTIFIER_OR_KEYWORD

NON_KEYWORD_IDENTIFIER -> IDENTIFIER_OR_KEYWORD _except a [strict][lex.keywords.strict] or [reserved][lex.keywords.reserved] keyword_

IDENTIFIER -> NON_KEYWORD_IDENTIFIER | RAW_IDENTIFIER

RESERVED_RAW_IDENTIFIER ->
    `r#` (`_` | `crate` | `self` | `Self` | `super`) !XID_Continue
```

<!-- When updating the version, update the UAX links, too. -->
<a id="ident.unicode"></a> 根据 [Unicode 标准附录 #31][UAX31] 对 Unicode 版本 17.0 的规范，标识符增加了以下内容。一些标识符示例如下：

* `foo`
* `_identifier`
* `r#true`
* `Москва`
* `東京`

<a id="ident.profile"></a> UAX #31 中使用的格式为：

* Start := [`XID_Start`]，加上下划线字符 (U+005F) * Continue := [`XID_Continue`] * Medial := 空

> [!NOTE] > 以下划线开头的标识符通常用于表示故意未使用的标识符，并将在 `rustc` 中抑制未使用的警告。

<a id="ident.keyword"></a> 如果没有 `r#` 前缀，标识符不能成为 [严格] 或 [保留] 关键字，具体说明见 [原始标识符](#raw-identifiers)。

<a id="ident.zero-width-chars"></a> 零宽度非连接符 (ZWNJ U+200C) 和零宽度连接符 (ZWJ U+200D) 字符不允许出现在标识符中。

<a id="ident.ascii-limitations"></a> 在以下情况下，标识符仅限于 [`XID_Start`] 和 [`XID_Continue`] 的 ASCII 子集：

* [`extern crate`] 声明（[AsClause] 标识符除外） * 在 [path] 中引用的外部 crate 名称 * 从文件系统加载的 [Module] 名称，未使用 [`path` 属性] * [`no_mangle`] 属性项 * [external blocks] 中的项目名称

<a id="ident.normalization"></a>
## 标准化

标识符按照 [Unicode 标准附录 #15][UAX15] 中定义的 Normalization Form C (NFC) 进行标准化。如果两个标识符的 NFC 形式相同，则视为相等。

[过程式][proc-宏] 和 [声明式][mbe] 宏在输入时接收标准化的标识符。

<a id="ident.raw"></a>
## 原始标识符

<a id="ident.raw.intro"></a> 原始标识符类似于普通标识符，但前缀为 `r#`。（注意，`r#` 前缀不计入实际标识符中。）

<a id="ident.raw.allowed"></a> 与普通标识符不同，原始标识符可以是任何严格或保留关键字，除了上述 `RAW_IDENTIFIER` 所列出的那些。

<a id="ident.raw.reserved"></a> 使用 [RESERVED_RAW_IDENTIFIER] 标记是一个错误。

[`extern crate`]: items/extern-crates.md
[`no_mangle`]: abi.md#the-no_mangle-attribute
[`path` attribute]: items/modules.md#the-path-attribute
[`XID_Continue`]: http://unicode.org/cldr/utility/list-unicodeset.jsp?a=%5B%3AXID_Continue%3A%5D&abb=on&g=&i=
[`XID_Start`]:  http://unicode.org/cldr/utility/list-unicodeset.jsp?a=%5B%3AXID_Start%3A%5D&abb=on&g=&i=
[external blocks]: items/external-blocks.md
[mbe]: macros-by-example.md
[module]: items/modules.md
[path]: paths.md
[proc-macro]: procedural-macros.md
[reserved]: keywords.md#reserved-keywords
[strict]: keywords.md#strict-keywords
[UAX15]: https://www.unicode.org/reports/tr15/tr15-57.html
[UAX31]: https://www.unicode.org/reports/tr31/tr31-43.html
