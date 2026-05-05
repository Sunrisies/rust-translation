# 语法高亮显示

mdBook 使用 [Highlight.js](https://highlightjs.org) 进行语法高亮显示，并采用了自定义的主题。

自动语言检测已关闭，因此您可能需要像这样指定您使用的编程语言：

~~~markdown
```rust
fn main() {
    // Some code
}
```
~~~

## 支持的语言

这些语言默认是受支持的，但您可以通过提供自己的 `highlight.js` 文件来添加更多语言。

- 阿帕奇  
- 阿姆ASM  
-  bash  
- C语言  
- CoffeeScript  
- C++  
- C#  
- CSS  
- D语言  
- 差异分析工具  
- Go语言  
- Handlebars模板  
- Haskell语言  
- HTTP协议  
- INI文件格式  
- Java语言  
- JavaScript  
- JSON格式  
- Julia语言  
- Kotlin语言  
- Less语言  
- Lua语言  
- Makefile文件  
- Markdown格式文档  
- Nginx服务器  
- Nim语言  
- Nix系统  
- Objective-C语言  
- Perl脚本语言  
- PHP语言  
- 纯文本格式  
- 属性文件  
- Python语言  
- R语言  
- Ruby语言  
- Rust语言  
- Scala语言  
- SCSS样式表语言  
- Shell脚本  
- SQL数据库  
- Swift语言  
- TypeScript语言  
- x86汇编语言  
- XML格式  
- YAML格式

## 自定义主题  
与主题的其他部分一样，用于语法高亮的文件也可以被替换为用户自己的自定义设置。

- ***highlight.js*** 通常不需要覆盖这个文件，除非您想要使用更近版本的软件。
- ***highlight.css*** 是 highlight.js 用于语法高亮的主题文件。

如果您想为 `highlight.js` 使用其他主题，可以从他们的网站下载，或者自己制作。请将其重命名为 `highlight.css`，然后将其放入您书籍的 `theme` 文件夹中。

现在，你的主题将被使用，而不是默认的默认主题。

## 改进默认主题

如果您认为默认的样式对于某种特定语言来说不太合适，或者希望对其进行改进，请随时[提交一个新的问题](https://github.com/rust-lang/mdBook/issues)，说明您的想法。我会仔细研究并考虑您的建议。

您还可以提交一个包含所提议的改进内容的拉取请求。

整体来说，主题应该保持简洁明快，不要使用过于鲜艳的颜色。