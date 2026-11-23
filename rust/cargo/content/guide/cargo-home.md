# Cargo 主页

“Cargo 主页”充当下载和源代码缓存的功能。在构建 [crate][def-crate] 时，Cargo 会将下载的构建依赖项存储在 Cargo 主页中。你可以通过设置 `CARGO_HOME` [环境变量][env] 来更改 Cargo 主页的位置。[home](https://crates.io/crates/home) crate 提供了一个 API，如果你在 Rust crate 内部需要此信息，可以使用该 API 获取位置。默认情况下，Cargo 主页位于 `$HOME/.cargo/`。

请注意，Cargo 主页的内部结构尚未稳定，可能随时发生变化。

Cargo 主页由以下组件组成：

## 文件：

* `config.toml` Cargo 的全局配置文件，请参阅 [配置条目](https://crates.io/crates/config) 中的说明。

* `credentials.toml` 来自 [`cargo login`]的私有登录凭据，用于登录到 [registry][def-registry]。

* `.crates.toml`, `.crates2.json` 这些隐藏文件包含通过 [`cargo install`]安装的 crates 的 [包][def-包] 信息。请勿手动编辑这些文件！

## 目录：

* `bin` `bin` 目录包含通过 [`cargo install`]或 [`rustup`](https://rust-lang.github.io/rustup/)安装的 crates 的可执行文件。为了能够访问这些二进制文件，请将该目录路径添加到你的 `$PATH` 环境变量中。

 *  `git` Git 源代码存储在此处：

    * `git/db` 当 crate 依赖于 git 仓库时，Cargo 会将该仓库作为裸仓库克隆到此目录中，并在必要时进行更新。

    * `git/checkouts` 如果使用了 git 源，则所需版本的仓库将从 `git/db` 中的裸仓库复制到此目录中。这样编译器就能获取该依赖项所指定的版本中实际存在的文件。同一仓库的不同版本可以有多重克隆。

* `registry` crate registries 的包和元数据（如 [crates.io](https://crates.io/)）位于此处。

  * `registry/index` 索引是一个裸 git 仓库，包含注册表中所有可用 crates 的元数据（版本、依赖项等）。

  *  `registry/cache` 下载的依赖项会被存储在缓存中。这些库被压缩为 gzip 文件，并带有 `.crate` 扩展名。

  * `registry/src` 如果某个包需要下载的 `.crate` 归档文件，它会被解压到 `registry/src` 文件夹中，这样 rustc 就能找到对应的 `.rs` 文件。


## 在 CI 中缓存 Cargo home 目录

为了避免在持续集成过程中重新下载所有库依赖项，你可以将 `$CARGO_HOME` 目录进行缓存。然而，缓存整个目录通常效率不高，因为会导致源代码被下载两次。例如，如果依赖于 `serde 1.0.92` 这样的库并缓存整个 `$CARGO_HOME`，实际上会缓存两次：一是 `registry/cache` 中的 `serde-1.0.92.crate` 文件，二是 `registry/src` 中 serde 的提取后的 `.rs` 文件。这可能会不必要地减慢构建速度，因为从 CI 服务器下载、解压、重新压缩并上传缓存的过程需要一些时间。

如果你希望缓存通过 [`cargo install`]安装的二进制文件，则需要缓存 `bin/` 文件夹以及 `.crates.toml` 和 `.crates2.json` 文件。

在多次构建过程中，缓存以下文件和目录应该就足够了：

* `.crates.toml` * `.crates2.json` * `bin/` * `registry/index/` * `registry/cache/` * `git/db/`



## 为项目的所有依赖项进行虚拟化

请参阅 [`cargo vendor`] 子命令。



## 清除缓存

理论上，你可以随时移除缓存中的任何部分，如果某个库需要这些源文件，Cargo 会尽力通过重新解压归档、从原始仓库下载或直接从网络重新下载源文件来恢复它们。

或者，[cargo-cache](https://crates.io/crates/cargo-cache) 库提供了一个简单的 CLI 工具，用于仅清除选定的缓存部分或在命令行中查看其组件的大小。

[`cargo install`]: ../commands/cargo-install.md
[`cargo login`]: ../commands/cargo-login.md
[`cargo vendor`]: ../commands/cargo-vendor.md
[config]: ../reference/config.md
[def-crate]:     ../appendix/glossary.md#crate     '"crate" (glossary entry)'
[def-package]:   ../appendix/glossary.md#package   '"package" (glossary entry)'
[def-registry]:  ../appendix/glossary.md#registry  '"registry" (glossary entry)'
[env]: ../reference/environment-variables.md
