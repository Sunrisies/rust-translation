# Cargo存在的原因

## 初步了解

如您所知，在 Rust 中，库或可执行程序被称为 [*crate*][def-crate]。Crates 通过 Rust 编译器 `rustc` 进行编译。当开始使用 Rust 时，大多数人首先遇到的就是经典的“hello world”程序，他们直接调用 `rustc` 来编译该程序：

```console
$ rustc hello.rs
$ ./hello
Hello, world!
```

请注意，上述命令要求您明确指定文件名。如果您直接使用 `rustc` 编译其他程序，则需要使用不同的命令行参数。如果您需要指定特定的编译器选项或包含外部依赖项，那么所需命令就会更加具体且复杂。

此外，大多数非简单的程序都会依赖于外部库，因此也会间接依赖于其自身的依赖项。手动获取所有必要依赖项的正确版本并保持它们的最新状态是非常困难且容易出错的。

与其仅使用 crates 和 `rustc`，您可以通过引入更高层次的 ["*包*"][def-包] 抽象以及使用 [*包 manager*][def-包-manager] 来避免上述任务的困难。

## 引入 Cargo

*Cargo* 是 Rust 的包管理器。它是一个工具，允许 Rust [*packages*][def-包] 声明其各种依赖项，确保您始终能够重复构建项目。

为了实现这一目标，Cargo 做了四件事：

* 引入两个包含各种包信息的元数据文件。
* 获取并构建您的包的依赖项。
* 调用 `rustc` 或其他构建工具以正确的参数来构建您的包。
* 引入一些规范，使使用 Rust 包变得更加容易。

在很大程度上，Cargo会标准化构建特定程序或库所需的命令；这是上述约定中的一个方面。正如我们后面将展示的，同一个命令可以用来构建不同的[*工件*][def-artifact]，无论它们的名称如何。你不必直接调用 `rustc`，而是可以调用像 `cargo build` 这样的通用命令，让Cargo负责构造正确的 `rustc` 调用。此外，Cargo会自动从[*注册表*][def-registry]中获取你为工件定义的所有依赖项，并根据需要将它们添加到构建过程中。

说一旦你知道如何构建一个基于Cargo的项目，你就知道如何构建所有这些项目，这只是一个轻微的夸张说法。

[def-artifact]:         ../appendix/glossary.md#artifact         '"artifact" (glossary entry)'
[def-crate]:            ../appendix/glossary.md#crate            '"crate" (glossary entry)'
[def-package]:          ../appendix/glossary.md#package          '"package" (glossary entry)'
[def-package-manager]:  ../appendix/glossary.md#package-manager  '"package manager" (glossary entry)'
[def-registry]:         ../appendix/glossary.md#registry         '"registry" (glossary entry)'
