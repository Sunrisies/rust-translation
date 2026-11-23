# Clippy 开发

你好，Rustacean 们！如果你能来到这里，那说明你对改进 Clippy 感兴趣，并愿意为之贡献代码。欢迎加入这个项目！

> [!NOTE] > 如果你只是想使用 Clippy，从这一点开始没有内容可以查看，你应该回到之前的章节中继续学习。

## 入门指南

如果你是第一次为 Clippy 贡献代码，首先应该阅读 [基础文档](basics.md)。其中会解释如何获取源代码以及如何编译和测试代码的基本方法。

## 初学者额外阅读材料

如果读者从未学习过编译器和解释器课程，可能会困惑为什么 AST 级别只处理语言的语法。有些读者甚至可能不明白 lexing、解析和 AST 的含义。

本文档绝不是关于编译器或语言设计的速成课。对于与 Rust 相关的具体细节，[Rustc 开发指南][rustc_dev_guide]是更好的选择。

[语法和 AST][ast]章节以及 [高级 IR][hir]章节是对本章所述概念的很好介绍。

有些读者在回到 Rustc 指南之前，可能会从罗伯特·尼斯特罗姆的 _Crafting Interpreters_ 的 [入门章节][map_of_territory]中了解到编译型与解释型语言的相关内容。

## 编写代码

如果你已经完成了基本设置，现在就可以开始动手修改了。

[添加 lint](adding_lints.md)章节详细介绍了如何为 Clippy 添加新 lint。如果你只是想修复某个 lint，这一章节也很有帮助，因为它还涵盖了如何测试 lint 以及整体架构的概述。

如果你想添加新 lint或更改现有 lint（而非仅修复错误），建议快速阅读 [稳定性保证][rfc_stability]和 [lint 类别][rfc_lint_cats]部分在 [Clippy 1.0 RFC][clippy_rfc]中介绍的内容。这些 lint 类别也在本书的 [前面部分](../lints.md)中有描述。

> [!NOTE] > 关于为 Clippy 贡献代码的一些高级内容仍包含在 [`CONTRIBUTING.md`] 文档中。部分内容将随着时间被移入书籍中，例如：> - 寻找需要修复的问题 > - IDE 设置 > - Clippy 工作原理的宏观概述 > - 问题分类流程

[ast]: https://rustc-dev-guide.rust-lang.org/syntax-intro.html
[hir]: https://rustc-dev-guide.rust-lang.org/hir.html
[rustc_dev_guide]: https://rustc-dev-guide.rust-lang.org/
[map_of_territory]: https://craftinginterpreters.com/a-map-of-the-territory.html
[clippy_rfc]: https://github.com/rust-lang/rfcs/blob/main/text/2476-clippy-uno.md
[rfc_stability]: https://github.com/rust-lang/rfcs/blob/main/text/2476-clippy-uno.md#stability-guarantees
[rfc_lint_cats]: https://github.com/rust-lang/rfcs/blob/main/text/2476-clippy-uno.md#lint-audit-and-categories
[`CONTRIBUTING.md`]: https://github.com/rust-lang/rust-clippy/blob/HEAD/CONTRIBUTING.md
