# 源替换

本文档介绍将与 [注册表] 或 [基于 git 的依赖项] 仓库的通信重定向到另一个数据源，例如镜像原始注册表的服务器或精确的本地副本。

如果您希望单独修补依赖项，请参阅本文档中的 [覆盖依赖项] 部分。如果您想控制 Cargo 进行网络请求的方式，请查看 [`[http]`](config.md#http) 和 [`[net]`](config.md#net) 配置。

*源* 是一种提供器，包含可能作为包依赖项包含的库包。Cargo 支持**用另一个源替换一个源**，以表达以下策略：

* 托管 --- 可以定义自定义源，这些源代表本地文件系统中的库包。这些源是它们被替换的源的子集，如有必要可将其纳入包中。

* 镜像 --- 可以用等效版本替代源，该版本作为 crates.io 本身的缓存。

Cargo 关于源替换的核心假设是两个源的源代码完全相同。请注意，这也意味着替代源不能包含原源中不存在的库包。

因此，源替换不适用于修补依赖项或私有注册表等场景。Cargo 通过使用 [`[patch]` key][registries] 来支持修复依赖项，而私有注册表的支持则见于 [注册表章节][registries]。

当使用源替换时，需要直接联系注册表的命令运行时[^1]，必须传递 `--registry` 选项。这有助于避免关于应联系哪个注册表的歧义，并将使用指定注册表的认证令牌。



## 配置

替换源的配置通过 [`.cargo/config.toml`] 完成，所有可用的键如下：

```toml
# The `source` table is where all keys related to source-replacement
# are stored.
[source]

# Under the `source` table are a number of other tables whose keys are a
# name for the relevant source. For example this section defines a new
# source, called `my-vendor-source`, which comes from a directory
# located at `vendor` relative to the directory containing this `.cargo/config.toml`
# file
[source.my-vendor-source]
directory = "vendor"

# The crates.io default source for crates is available under the name
# "crates-io", and here we use the `replace-with` key to indicate that it's
# replaced with our source above.
#
# The `replace-with` key can also reference an alternative registry name
# defined in the `[registries]` table.
[source.crates-io]
replace-with = "my-vendor-source"

# Each source has its own table where the key is the name of the source
[source.the-source-name]

# Indicate that `the-source-name` will be replaced with `another-source`,
# defined elsewhere
replace-with = "another-source"

# Several kinds of sources can be specified (described in more detail below):
registry = "https://example.com/path/to/index"
local-registry = "path/to/registry"
directory = "path/to/vendor"

# Git sources can optionally specify a branch/tag/rev as well
git = "https://example.com/path/to/repo"
# branch = "master"
# tag = "v1.0.1"
# rev = "313f44e8"
```


## 注册表源

“注册表源”类似于 crates.io，它是一个符合规范索引，具体规范可参考 https://doc.rust-lang.org/cargo/reference/registry-index.html，并包含配置文件以指示从何处下载库。

注册表源可以使用 [git 或稀疏 HTTP 协议][protocols]：

```toml
# Git protocol
registry = "ssh://git@example.com/path/to/index.git"

# Sparse HTTP protocol
registry = "sparse+https://example.com/path/to/index"

# HTTPS git protocol
registry = "https://example.com/path/to/index"
```



## 本地注册表源

“本地注册表源”是另一个注册表源的子集，但存在于本地文件系统中（即 vendoring）。本地注册表会提前下载，通常与 `Cargo.lock` 同步，由一组 `*.crate` 文件和与常规注册表相同的索引组成。

管理和创建本地注册表源的主要方式是通过 [`cargo-local-registry`][cargo-local-registry] 子命令，该命令可在 crates.io 上找到，并可通过 `cargo install --locked cargo-local-registry` 安装。


本地注册表包含在一个目录中，其中包括从 crates.io 下载的多个 `*.crate` 文件以及一个与 crates.io-index 项目格式相同的 `index` 目录（仅包含存在的库的相关条目）。

## 目录源

“目录源”类似于本地注册表源，它包含许多可在本地文件系统中使用的库，适合用于 vendoring依赖项。目录源主要通过 `cargo vendor` 子命令进行管理。

目录源与本地注册表不同，因为它们包含 `*.crate` 文件的解包版本，因此在某些情况下更适合被提交到源代码控制中。目录源只是一个包含多个其他目录的目录，这些其他目录则包含套件源代码（即 `*.crate` 文件的解包版本）。目前对每个目录的名称没有限制。

目录源中的每个套件都有一个相关的元数据文件 `.cargo-checksum.json`，用于防止意外修改。这不是一种安全机制，也不能防止恶意更改。

## Git 源

Git 源指的是被 [基于 git 的依赖项] 使用的仓库。它们用于指定哪些基于 git 的依赖项应被替代为其他来源。

Git 源与 [git 注册表][cargo-local-registry] 无关，不能用来替代注册表源。

[Publishing Commands]: ../commands/publishing-commands.md
[overriding dependencies]: overriding-dependencies.md
[registries]: registries.md
[config]: config.md
[protocols]: registries.md#registry-protocols
[crates.io index]: registry-index.md
[cargo-local-registry]: https://crates.io/crates/cargo-local-registry
[git-based dependencies]: specifying-dependencies.md#specifying-dependencies-from-git-repositories
