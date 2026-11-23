# 使用现有的 Cargo 包进行开发

如果你下载了一个使用 Cargo 的现有 [包][def-包]，那么开始工作会非常容易。

首先，从某个地方获取该包。在示例中，我们将使用从 GitHub 仓库克隆出来的 `regex`：

```console
$ git clone https://github.com/rust-lang/regex.git
$ cd regex
```

要构建项目，请使用 `cargo build`：

```console
$ cargo build
   Compiling regex v1.5.0 (file:///path/to/package/regex)
```

这将下载所有依赖项，然后与包一起进行构建。

[def-package]:  ../appendix/glossary.md#package  '"package" (glossary entry)'
