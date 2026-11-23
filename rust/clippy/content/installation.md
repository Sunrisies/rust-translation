# Installation

如果您使用 `rustup` 来安装和管理您的 Rust 工具链，则通常**已经安装了**Clippy。在这种情况下，您可以跳过本章并前往[用法]章节。

> [!NOTE] > 如果您在安装 Rust 工具链时使用了 `minimal` 配置，> Clippy 不会自动安装。

## 使用 Rustup

如果某个工具链没有安装 Clippy，可以通过以下方式进行安装：

```
$ rustup component add clippy [--toolchain=<name>]
```

## 从源代码构建

请查看 Clippy开发者指南中的[基础]章节，以获取从源代码构建和安装 Clippy的详细步骤说明。

[Basics]: development/basics.md#install-from-source
[Usage]: usage.md
