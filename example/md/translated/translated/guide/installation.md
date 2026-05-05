# 安装

安装mdBook CLI工具有多种方法。请选择最适合您需求的方法。如果您是为了自动部署而安装mdBook，请查看[持续集成]章节，了解更多关于如何安装的示例。

[持续集成]: ../continuous-integration.md

## 预编译的二进制文件

可以在 [GitHub Releases page][releases] 下载可执行二进制文件。请下载适合您操作系统的二进制文件（Windows、macOS 或 Linux），然后解压压缩包。压缩包中包含一个 `mdbook` 可执行文件，您可以使用它来构建您的书籍。

为了便于运行，请将二进制文件的路径放入你的 `PATH` 中。

[发布版本]: https://github.com/rust-lang/mdBook/releases

## 使用 Rust 从源代码构建

要从源代码构建 `mdbook` 可执行文件，首先需要安装 Rust 和 Cargo。请按照[Rust安装页面》上的说明进行安装。目前，mdBook 至少需要使用 Rust 1.88 版本。

安装完Rust之后，可以使用以下命令来构建并安装mdBook：

```sh
cargo install mdbook
```

这将自动从[crates.io]下载mdBook，进行构建，并将其安装到Cargo的全局二进制目录中（默认情况下为`~/.cargo/bin/`）。

您可以随时运行 `cargo install mdbook` 来更新到新版本。该命令会检查是否存在更新版本，如果找到更新版本，则会重新安装 mdBook。

要卸载，请运行命令 `cargo uninstall mdbook`。

[Rust安装页面]: https://www.rust-lang.org/tools/install  
[crates.io]: https://crates.io/

### 安装最新版本的主程序

在 crates.io 上发布的版本与在 GitHub 上托管的版本会有轻微的差异。如果您需要最新版本，可以自行构建 mdBook 的 Git 版本。Cargo 让这个过程变得***非常简单***！

```sh
cargo install --git https://github.com/rust-lang/mdBook.git mdbook
```

再次提醒，请确保将Cargo bin目录添加到你的 `PATH` 中。

## 修改与贡献

如果您有兴趣对 mdBook 本身进行修改，请查阅[贡献指南]以获取更多信息。

[贡献指南]: https://github.com/rust-lang/mdBook/blob/master/CONTRIBUTING.md