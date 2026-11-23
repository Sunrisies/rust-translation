# Introduction

这本书是 Rust 编程语言的主要参考手册。

> [!NOTE]
> For known bugs and omissions in this book, see our [GitHub issues]. If you see a case where the compiler behavior and the text here do not agree, file an issue so we can think about which is correct.

## Rust 版本发布

Rust 每六周会推出一个新的语言版本。该语言的第一个稳定版为 Rust 1.0.0，随后是 Rust 1.1.0 等版本。工具（`rustc`、`cargo` 等）和文档（[标准库]、本书等）也会随语言版本一同发布。

与最新 Rust 版本相匹配的本书最新版本可随时在 <https://doc.rust-lang.org/reference/> 找到。之前的版本可以通过在“参考”目录前添加 Rust 版本号来查找，例如 Rust 1.49.0 的参考内容位于 <https://doc.rust-lang.org/1.49.0/reference/>。

## *The Reference* 并非什么

本书并不作为该语言的入门书籍。读者需具备一定的语言基础。有一本独立的[书籍]可以帮助您建立这种背景知识。

本书也不作为语言发行版中包含的[标准库]的参考手册。这些库通过从源代码中提取文档属性进行单独说明。许多人们认为属于语言特性的功能实际上是 Rust 中的库特性，因此您寻找的内容可能存在于其他地方而非本书中。

同样，本书通常也不对工具 `rustc` 或 Cargo 的具体细节进行说明。`rustc` 有专门的[书籍][rustc book]，Cargo 也有[书籍][cargo book]，其中包含[参考手册][cargo reference]。还有一些页面如[linkage]仍然描述了 `rustc` 的工作原理。

本书仅作为稳定版 Rust 中可用内容的参考手册。对于正在开发的不稳定特性，请参阅[不稳定版本书籍]。

包括 `rustc` 在内的 Rust 编译器会进行优化。参考手册并未说明允许或禁止哪些优化。可以将编译后的程序视为一个黑盒，你只能通过运行它、输入数据并观察输出结果来探究其内部机制。所有通过这种方式发生的事情都必须符合参考手册中的描述。

## 如何使用本书

本书不假设您按顺序阅读。每一章通常可以独立阅读，但会与其他章节在所涉及的语言方面相互关联，不过不会进行讨论。

有两种主要方式可以阅读此文档。

第一种方式是回答特定问题。如果您知道哪一章可以解答该问题，就可以直接跳到目录中的那一章。否则，您可以按 `s` 键或点击顶部栏上的放大镜来搜索与您的问题相关的关键词。例如，如果您想知道在 let 语句中创建的临时值何时被丢弃，如果您还不知道[临时变量的生命周期]是在[表达式章节]中定义的，那么您可以搜索“temporary let”，第一个搜索结果将带您到该部分。

第二种方式是整体提升对语言某方面的理解。在这种情况下，只需浏览目录直到看到您想了解更多内容的条目，然后开始阅读即可。如果某个链接看起来有趣，请点击它并阅读该部分的内容。

话虽如此，阅读这本书没有错误的方式。按照您觉得最有助于理解的方法来读即可。

### Conventions

像所有技术书籍一样，本书在展示信息的方式上也有一些惯例。这些惯例在此处有详细说明。

* 定义术语的陈述会将该术语用*斜体*显示。每当该术语在该章之外被使用时，通常是一个指向包含此定义的章节的链接。

  *示例术语*就是用来定义某个术语的一个例子。

* *正文主要介绍最新稳定版本。与之前版本的差异则以版本块的形式呈现：

  > [!EDITION-2018]
  > Before the 2018 edition, the behavior was this. As of the 2018 edition, the behavior is that.

* *包含有关书籍状态的有用信息或指出有用的、但大多超出范围的信息的注释则位于注释块中。

  > [!NOTE]
  > This is an example note.

* *示例块展示了一个演示某种规则或指出某个有趣方面的例子。某些示例可能包含隐藏行，通过悬停或点击示例时出现的眼睛图标可以查看这些隐藏行。

  > [!EXAMPLE]
  > This is a code example.
  > ```rust
  > println!("hello world");
  > ```

* 显示语言中存在不合理行为或语言特性交互可能令人困惑的警告，会显示在特殊的警告框中。

  > [!WARNING]
  > This is an example warning.

* 文本中的代码片段位于 `<code>` 标签内。

  较长的代码示例会在语法高亮框中展示，右上角有复制、执行和显示隐藏行数的控制选项。

  ```rust
  # // This is a hidden line.
  fn main() {
      println!("This is a code example");
  }
  ```

  所有示例均针对最新版本编写，除非另有说明。

* 语法和词汇规则在 [Notation] 章节中有描述。

<a id="example.rule.label"></a> * 规则标识符位于每个语言规则的方括号内部。这些标识符提供了一种引用和链接到特定规则的方式（例如 [example rule]）。规则标识符使用句号来分隔从最一般到最具体的部分（例如 `[destructors.scope.nesting-function-body]`）。在窄屏幕上，规则名称会折叠显示为 `[*]`。

  可以点击规则名称以链接到该规则。

  > [!WARNING]
  > The organization of the rules is currently in flux. For the time being, these identifier names are not stable between releases, and links to these rules may fail if they are changed. We intend to stabilize these once the organization has settled so that links to the rule names will not break between releases.

* 带有相关测试的规则下方会包含 `Tests` 链接（在窄屏幕上为 `[T]`）。点击链接会弹出测试列表，可点击查看具体测试。例如，参见 [input.encoding.utf8]。

  将规则与测试关联是一个持续进行的工作。有关概述，请参阅 [Test summary](test-summary.md) 章节。

## Contributing

我们欢迎各种形式的贡献。

您可以通过打开问题或向 [Rust Reference repository] 提交拉取请求来为本书做出贡献。如果这本书没有回答您的疑问，而您认为其答案属于该书的范畴，请不要犹豫 [提出问题]，或在 [Zulip] 的 `t-lang/doc` 频道中询问相关事宜。了解人们最常用此书的目的有助于我们将注意力集中在使其部分达到最佳状态上。当然，如果您发现任何错误或非规范行为但未被特别指出，也请 [提出问题]。

[standard library]: std
[example rule]: example.rule.label

[book]: ../book/index.html
[github issues]: https://github.com/rust-lang/reference/issues
[the Rust Reference repository]: https://github.com/rust-lang/reference/
[Unstable Book]: https://doc.rust-lang.org/nightly/unstable-book/
[cargo book]: ../cargo/index.html
[cargo reference]: ../cargo/reference/index.html
[expressions chapter]: expressions.html
[file an issue]: https://github.com/rust-lang/reference/issues
[lifetime of temporaries]: expressions.html#temporaries
[linkage]: linkage.html
[rustc book]: ../rustc/index.html
[Notation]: notation.md
[Zulip]: https://rust-lang.zulipchat.com/#narrow/stream/237824-t-lang.2Fdoc
