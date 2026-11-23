## 安装

第一步是安装 Rust。我们将通过 `rustup` 下载 Rust，这是一个用于管理 Rust 版本及相关工具的命令行工具。下载时需要网络连接。

> 注意：如果出于某种原因不想使用 `rustup`，请查看 [其他 Rust 安装方法页面][otherinstall] 以获取更多选项。

以下步骤将安装最新稳定的 Rust 编译器版本。Rust 的稳定性保证确保本书中的所有可编译示例在新的 Rust 版本中仍能正常编译。不同版本之间的输出可能会略有差异，因为 Rust 通常会改进错误信息和警告功能。换句话说，使用这些步骤安装的任何新稳定版本的 Rust 都应能正常运行本书内容。

> ### 命令行语法
>
> 在本章及全书中，我们将展示在终端中使用的某些命令。需要在终端输入的行都以 `$` 开头。无需输入 `$` 字符，它只是表示命令开始的命令行提示符。不以 `$` 开头的行通常显示前一条命令的输出。此外，PowerShell 相关的示例将使用 `>` 而不是 `$`。

### 在 Linux 或 macOS 上安装 `rustup`

如果您使用的是 Linux 或 macOS，打开终端并输入以下命令：

```console
$ curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh
```

该命令会下载脚本并开始安装 `rustup` 工具，从而安装最新稳定的 Rust。您可能会被要求输入密码。如果安装成功，将出现如下行：

```text
Rust is installed now. Great!
```

您还需要一个 _链接器_，即 Rust 用来将编译后的输出合并到同一个文件中的程序。很可能您已经拥有这样一个工具。如果出现链接器错误，应安装 C 编译器，通常 C 编译器也包含链接器功能。C 编译器也有用，因为一些常见的 Rust 包依赖 C 代码，需要 C 编译器才能运行。

在 macOS 上，可以通过运行以下命令获取 C 编译器：

```console
$ xcode-select --install
```

根据您的发行版文档，Linux 用户通常应安装 GCC 或 Clang。例如，如果您使用 Ubuntu，可以安装 `build-essential` 包。

### 在 Windows 上安装 `rustup`

在 Windows 上，请访问 [https://www.rust-lang.org/tools/install][install]<!-- ignore --> 并按照安装 Rust 的说明操作。在安装过程中，系统会提示您安装 Visual Studio，以便获得链接器和编译程序所需的原生库。如果您需要更多关于此步骤的帮助，请参阅 [https://rust-lang.github.io/rustup/installation/windows-msvc.html][msvc]<!-- ignore -->。

本书的其余部分使用的命令在 _cmd.exe 和 PowerShell 中均可使用。如果有特定差异，我们将说明应使用哪种方式。

### 故障排除

要检查 Rust 是否安装正确，打开终端并输入以下命令：

```console
$ rustc --version
```

您应该看到以下格式的最新稳定版本的版本号、提交哈希和提交日期：

```text
rustc x.y.z (abcabcabc yyyy-mm-dd)
```

如果您看到这些信息，说明 Rust 已成功安装！如果看不到这些信息，请确认 Rust 已添加到您的 `%PATH%` 系统变量中。

在 Windows CMD 中，使用：

```console
> echo %PATH%
```

在 PowerShell 中，使用：

```powershell
> echo $env:Path
```

在 Linux 和 macOS 中，使用：

```console
$ echo $PATH
```

如果以上设置均正确但 Rust 仍然无法正常工作，您可以在多个地方获得帮助。请通过 [社区页面][community] 了解如何与其他 Rustaceans（我们自称为的幽默称呼）联系。

### 更新与卸载

一旦通过 `rustup` 安装了 Rust，更新到新发布的版本非常容易。在终端中运行以下更新脚本：

```console
$ rustup update
```

要在终端中卸载 Rust 和 `rustup`，运行以下卸载脚本：

```console
$ rustup self uninstall
```

<!-- Old headings. Do not remove or links may break. -->
<a id="local-documentation"></a>

### 阅读本地文档

Rust 安装还包括一份本地文档副本，以便您离线阅读。运行 `rustup doc` 即可在浏览器中打开本地文档。

每当标准库提供了某种类型或函数而您不确定其功能或如何使用时，请使用应用程序编程接口（API）文档来查找相关信息！

<!-- Old headings. Do not remove or links may break. -->
<a id="text-editors-and-integrated-development-environments"></a>

### 使用文本编辑器和集成开发环境

本书不对您编写 Rust 代码所使用的工具做出任何假设。几乎任何文本编辑器都能完成任务！不过，许多文本编辑器和集成开发环境（IDE）都内置了对 Rust 的支持。您可以在 Rust 网站上的 [工具页面][tools] 上找到许多编辑器和 IDE 的较新列表。

### 使用本书离线工作

在几个示例中，我们将使用标准库之外的 Rust 包。要完成这些示例，您需要拥有互联网连接或提前下载这些依赖项。若要提前下载依赖项，可以运行以下命令。（我们稍后会详细解释 `cargo` 是什么以及这些命令的作用。）

<!-- When updating the version of `rand` used, also update the version of
这些文件中使用的 `rand` 相同，因此它们一致：

* ch02-00-guessing-game-tutorial.md * ch07-04-bringing-paths-into-scope-with-the-use-keyword.md * ch14-03-cargo-workspaces.md -->

```console
$ cargo new get-dependencies
$ cd get-dependencies
$ cargo add rand@0.10.1 trpl@0.2.0
```

这将缓存这些包的下载内容，因此您无需在之后重新下载。一旦运行了此命令，就不需要保留 `get-dependencies` 文件夹了。如果您已经运行了此命令，可以在本书的其余部分中使用 `--offline` 标志与所有 `cargo` 命令，从而使用这些缓存版本而不是尝试通过网络获取。

[otherinstall]: https://forge.rust-lang.org/infra/other-installation-methods.html
[install]: https://www.rust-lang.org/tools/install
[msvc]: https://rust-lang.github.io/rustup/installation/windows-msvc.html
[community]: https://www.rust-lang.org/community
[tools]: https://www.rust-lang.org/tools
