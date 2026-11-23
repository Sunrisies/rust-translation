# 词汇表

## Artifact

*Artifact* 是指编译过程产生的文件或一组文件。这包括可链接的库、可执行二进制文件以及生成的文档。

## Cargo

*Cargo* 是 Rust [*包管理器*](#包-manager)，也是本书的主要主题。

## Cargo.lock

请参阅[*lock file*](#lock-file)。

## Cargo.toml

请参阅[*清单*](#清单)。

## crate

Rust *crate* 可以是库或可执行程序，分别称为*library crate*或*binary crate*。

为 Cargo [包] 定义的每个[目标](#目标)都是*crate*。

广义上，*crate*一词可以指目标的源代码，也可以指目标生成的编译后的 artifact。它还可以指从[registry](#registry)获取的压缩包。

给定的 crate 的源代码可以被细分为[*modules*](#module)。

## Edition

*Rust edition* 是 Rust 语言的一个开发阶段。[包的 edition][edition-field]在 `Cargo.toml` [清单](#清单)中指定，各个 目标 可以指定它们使用的 edition。更多详情请参阅[Edition Guide]。

## 特性

*特性* 的含义取决于上下文：

- [*特性*][feature]是一种命名标志，用于条件编译。一个 特性 可以指可选的依赖项，或者在 `Cargo.toml` [清单](#清单)中定义的任意名称，该名称可以在源代码中进行检查。

- Cargo 有[*unstable 特性 flags*][cargo-unstable]，可用于启用 Cargo 本身的实验性行为。

- Rust 编译器和 Rustdoc 也有自己的 unstable 特性 flags（请参阅[The Unstable Book][unstable-book]和[The Rustdoc Book][rustdoc-unstable]）。

- CPU 目标 有[*目标 features*][目标-特性]，用于指定 CPU 的功能。

## Index

*Index* 是 [*registry*](#registry)中可搜索的[*crates*](#crate)列表。

## Lock file

`Cargo.lock` *锁定文件* 是一个捕获在[*工作空间*](#工作区)或[*包*](#包)中使用的每个依赖项的确切版本的文件。它由 Cargo 自动生成。请参阅 [Cargo.toml 与 Cargo.lock 的区别]。

## 清单

[*清单*][manifest] 是名为 `Cargo.toml` 的文件中对[包](#包)或[*工作空间*](#工作区)的描述。

[*虚拟清单*][virtual] 是一个仅描述工作空间且不包含包的 `Cargo.toml` 文件。

## 成员

*成员*是属于[*工作空间*](#工作区)的[包](#包)。

## 模块

Rust 的模块系统用于将代码组织成称为*模块*的逻辑单元，这些模块为代码提供独立的命名空间。

给定[crate](#crate)的源代码可以细分为一个或多个独立模块。通常这样做是为了将代码按相关功能区域进行组织，或者控制源代码中符号的可见范围（公共/私有）。

`[Cargo.toml](#manifest)` 文件主要关注它所定义的[包](#包)、其crates以及这些crates所依赖的包。然而，在使用Rust时你会经常看到“模块”这个术语，因此你应该了解它与特定crate之间的关系。

## 包

*包*是源文件集合和描述该包的`Cargo.toml`[*清单*](#清单)文件。包具有名称和版本，用于指定包之间的依赖关系。

包包含多个[*目标*](#目标)，每个目标都是一个[crate](#crate)。`Cargo.toml`文件描述了包内crates的类型（二进制或库），以及关于每个crate的一些元数据——如何构建它们、它们的直接依赖项等，正如本书中所述。

*包根目录*是包的`Cargo.toml`清单所在的目录。（与[*工作空间根目录*](#工作区)对比。）

[*包 ID 规范*][pkgid-spec]，或称为 *SPEC*，是一个字符串，用于从特定来源唯一引用某个包的特定版本。

小型到中型的 Rust 项目只需要一个包，不过通常会有多个 crates。

较大的项目可能涉及多个包，在这种情况下，Cargo [*工作区*](#工作区) 可用于管理各包之间的通用依赖项和其他相关元数据。

## 包管理器

广义而言，*包管理器*是软件生态系统中一个程序（或一组相关程序），用于自动化获取、安装和升级代码库的过程。在编程语言生态系统中，包管理器是一种以开发者为中心的工具，其主要功能是从中央仓库下载库代码及其依赖项；这种能力通常结合执行软件构建的能力（通过调用语言特定的编译器）。

[*Cargo*](#cargo) 是 Rust 生态系统中的包管理器。Cargo 会下载你的 Rust [包](#包)的依赖项（称为 [*crates*](#crate）），编译你的包，生成可分发包，并（可选）将它们上传到 [crates.io][]，这是 Rust 社区的[*包注册表*](#registry)。

## 包注册表

参见 [*注册表*](#registry)。

## 项目

[包](#包)的另一个名称。

## 注册表

*注册表*是一种服务，包含可下载的[*crates*](#crate）集合，这些[*crates*](#crate）可以安装或作为[*包*](#包）的依赖项使用。Rust 生态系统中的默认注册表是 [crates.io](https://crates.io)。该注册表有一个[*索引*](#index)，其中包含所有 crates 的列表，并告诉 Cargo 如何下载所需的 crates。

## 来源

*来源*是一种提供者，包含可能作为[*包*](#包）依赖项使用的[*crates*](#crate）。有几种类型的来源：

- **注册表源** --- 参见 [registry](#registry)。
- **本地注册表源** --- 存储在文件系统中的压缩文件中的一组库。参见 [Local Registry Sources]。
- **目录源** --- 存储在文件系统中的未压缩文件中的一组库。参见 [Directory Sources]。
- **路径源** --- 位于文件系统上的单个包（如 [path 依赖]），或多个包的集合（如 [path overrides]）。
- **Git源** --- 位于 git 仓库中的包（如 [git 依赖] 或 [git source]）。

有关更多信息，请参见 [Source Replacement]。

## Spec

参见 [包 ID specification](#包)。

## 目标

“目标”一词的含义取决于上下文：

- **Cargo 目标** --- Cargo [*packages*](#包) 由与[*artifacts*](#artifact)相对应的*targets*组成，这些*artifacts*将被生成。包可以包含库、二进制文件、示例、测试和基准测试目标。[targets]列表在 `Cargo.toml` [*清单*](#清单)中配置，通常由源文件的[目录布局]自动推断出来。
- **目标 Directory** --- Cargo 将构建后的*artifacts*放入*目标*目录中。默认情况下，这是[*工作区*](#工作区)根目录下的名为 `target` 的目录，如果不使用工作空间则位于包根目录。可以通过 `--target-dir` 命令行选项、`CARGO_TARGET_DIR` [环境变量]或 `build.target-dir` [配置选项]来更改该目录。有关更多信息，请参见[构建缓存]文档。
- **目标 Architecture** --- 构建后的*artifacts*的操作系统和机器架构通常被称为*目标*。
- **目标 Tuple** --- 元组是指定目标架构的特定格式。这些元组可以称为*目标 tuple*，即生成的*artifact*的架构；也可以称为*host tuple*，即编译器运行的架构。可以通过 `--target` 命令行选项或 `build.target` [配置选项]来指定目标元组。元组的一般格式为 `<arch><sub>-<vendor>-<sys>-<abi>`，其中：

  - `arch` = 基础 CPU 架构，例如 `x86_64`、`i686`、`arm`、`thumb`、`mips` 等。
- `sub` = CPU 子架构，例如 `arm` 包含 `v7`、`v7s`、`v5te` 等。
- `vendor` = 供应商，例如 `unknown`、`apple`、`pc`、`nvidia` 等。
- `sys` = 系统名称，例如 `linux`、`windows`、`darwin` 等。`none` 通常用于无操作系统的裸机环境。
- `abi` = ABI，例如 `gnu`、`android`、`eabi` 等。

  某些参数可能被省略。运行 `rustc --print target-list` 可查看支持的目标列表。

## 测试目标

Cargo *test targets* 会生成用于验证代码正确性和功能的二进制文件。测试工件有两种类型：

* **单元测试** --- 单元测试是从库或二进制目标直接编译出的可执行二进制文件。它包含库的完整代码，并运行带有 `#[test]` 注释的函数，旨在验证代码的各个单元。
* **集成测试目标** --- [*集成测试目标*][integration-tests] 是从[*crate*](#crate)中编译出的可执行二进制文件，该[*crate*]的源代码位于 `tests` 目录或由 [`[[test]]` 表][targets]在 `Cargo.toml` [*清单*](#清单)中指定。它主要用于测试库的公共 API，或执行二进制文件以验证其功能。

## 工作区

[*工作区*][workspace] 是包含一个或多个[*包*](#包)的集合，这些[*包*]共享相同的依赖解析、输出目录以及各种设置，如配置文件。

[*虚拟工作区*][virtual] 是一种工作区，其中根 `Cargo.toml` [*清单*](#清单)没有定义任何包，仅列出工作区的[*成员*](#member)。

*工作区根目录*是工作区的 `Cargo.toml` [*清单*](#清单)所在的目录。（与[*包 root*](#包)对比。）

[Cargo.toml vs Cargo.lock]: ../guide/cargo-toml-vs-cargo-lock.md
[Directory Sources]: ../reference/source-replacement.md#directory-sources
[Local Registry Sources]: ../reference/source-replacement.md#local-registry-sources
[Source Replacement]: ../reference/source-replacement.md
[build cache]: ../reference/build-cache.html
[cargo-unstable]: ../reference/unstable.md
[config option]: ../reference/config.md
[crates.io]: https://crates.io/
[directory layout]: ../guide/project-layout.md
[edition guide]: ../../edition-guide/index.html
[edition-field]: ../reference/manifest.md#the-edition-field
[environment variable]: ../reference/environment-variables.md
[feature]: ../reference/features.md
[git dependency]: ../reference/specifying-dependencies.md#specifying-dependencies-from-git-repositories
[git source]: ../reference/source-replacement.md
[integration-tests]: ../reference/cargo-targets.md#integration-tests
[manifest]: ../reference/manifest.md
[path dependency]: ../reference/specifying-dependencies.md#specifying-path-dependencies
[path overrides]: ../reference/overriding-dependencies.md#paths-overrides
[pkgid-spec]: ../reference/pkgid-spec.md
[rustdoc-unstable]: https://doc.rust-lang.org/nightly/rustdoc/unstable-features.html
[target-feature]: ../../reference/attributes/codegen.html#the-target_feature-attribute
[targets]: ../reference/cargo-targets.md#configuring-a-target
[unstable-book]: https://doc.rust-lang.org/nightly/unstable-book/index.html
[virtual]: ../reference/workspaces.md
[workspace]: ../reference/workspaces.md
