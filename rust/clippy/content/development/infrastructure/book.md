# Clippy 书籍

本文档介绍了如何对您正在阅读的 Clippy 指南书籍进行添加和修改。该书籍采用 [Markdown](https://www.markdownguide.org) 格式，由 [mdBook](https://github.com/rust-lang/mdBook) 生成。

- [获取 mdBook](#get-mdbook) - [进行修改](#make-changes)

## 获取 mdBook

虽然严格来说并非必需，因为书籍源文件只是 Markdown 文本文件，但在本地安装 mdBook 可以让你在将更改提交到仓库之前，在本地构建、测试并展示书籍以查看变化。您很可能已经安装了 `cargo`，因此最简单的做法就是：

```shell
cargo install --locked mdbook
```

有关其他选项，请参阅 mdBook [安装说明](https://github.com/rust-lang/mdBook#installation)。

## 进行修改

书籍的 [src](https://github.com/rust-lang/rust-Clippy/tree/HEAD/book/src) 目录包含用于生成书籍的所有 Markdown 文件。如果您希望实时查看自己的更改，可以使用 mdBook `serve` 命令在本地运行一个 Web 服务器，该服务器会自动更新所做的更改。从 `rust-clippy` 目录的顶层开始：

```shell
mdbook serve book --open
```

然后导航到 `http://localhost:3000` 以查看生成的书籍。当服务器运行时，您所做的更改会自动更新。

有关更多信息，请参阅 mdBook [指南](https://rust-lang.github.io/mdBook/)。
