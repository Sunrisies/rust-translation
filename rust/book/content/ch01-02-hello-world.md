## Hello, World!

既然你已经安装了 Rust，现在就来编写你的第一个 Rust 程序吧。学习新语言时，通常都会编写一个简单的程序将文本 `Hello, world!` 输出到屏幕上，我们在这里也这样做！

> 注意：本书假设你对命令行有基本的了解。Rust 对编辑工具或代码存放位置没有特定要求，如果你更喜欢使用 IDE 而不是命令行，也可以使用你喜欢的 IDE。现在许多 IDE 都支持某种程度的 Rust 功能；请查阅 IDE 的文档以获取详细信息。Rust 团队通过 `rust-analyzer` 致力于提供优秀的 IDE 支持。更多细节请参阅 [附录 D][devtools]<!-- ignore -->。

<!-- Old headings. Do not remove or links may break. -->
<a id="creating-a-project-directory"></a>

### 项目目录设置

首先，你需要创建一个目录来存放你的 Rust 代码。对于 Rust 来说，代码的存放位置并不重要，但针对本书中的练习和项目，我们建议在你的主目录中创建一个 _projects_ 目录，并将所有项目都放在那里。

打开终端并输入以下命令，以创建 _projects_ 目录以及位于 _projects_ 目录内的“Hello, world!”项目目录。

对于 Linux、macOS 和 Windows PowerShell，请输入以下命令：

```console
$ mkdir ~/projects
$ cd ~/projects
$ mkdir hello_world
$ cd hello_world
```

对于 Windows CMD，请输入以下命令：

```cmd
> mkdir "%USERPROFILE%\projects"
> cd /d "%USERPROFILE%\projects"
> mkdir hello_world
> cd hello_world
```

<!-- Old headings. Do not remove or links may break. -->
<a id="writing-and-running-a-rust-program"></a>

### Rust 程序基础

接下来，创建一个新的源文件，并将其命名为 _main.rs_。Rust 文件通常以 _.rs_ 作为扩展名。如果你在文件名中使用多个单词，惯例是用下划线将它们分开。例如，使用 _hello_world.rs_ 而不是 _helloworld.rs_。

现在打开你刚刚创建的 _main.rs_ 文件，并输入列表 1-1 中的代码。

<Listing number="1-1" file-name="main.rs" caption="A program that prints `Hello, world!`">

```rust
fn main() {
    println!("Hello, world!");
}
```

</Listing>

保存文件后，回到位于 _~/projects/hello_world_ 目录的终端窗口。在 Linux 或 macOS 上，请输入以下命令以编译并运行该文件：

```console
$ rustc main.rs
$ ./main
Hello, world!
```

在 Windows 上，请使用 `.\main` 命令而不是 `./main`：

```powershell
> rustc main.rs
> .\main
Hello, world!
```

无论您使用什么操作系统，字符串 `Hello, world!` 都应在终端中显示。如果您看不到此输出，请参考安装部分的“故障排除”[troubleshooting]<!-- ignore -->部分以了解获取帮助的方法。

如果 `Hello, world!` 真的被打印出来，恭喜您！您正式编写了一个 Rust 程序。这使您成为一名 Rust 程序员——欢迎加入！

<!-- Old headings. Do not remove or links may break. -->

<a id="anatomy-of-a-rust-program"></a>

### Rust 程序的构成要素

让我们详细回顾这个“Hello, world!”程序。这是谜题的第一部分：

```rust
fn main() {

}
```

这些行定义了一个名为 `main` 的函数。`main` 函数很特殊：它是每个可执行的 Rust 程序中首先运行的代码。在这里，第一行声明了一个没有参数且不返回值的 `main` 函数。如果有参数，它们会放在括号（`()`）中。

函数体被包裹在 `{}` 中。Rust 要求所有函数体都使用花括号。将开花括号与函数声明放在同一行，并在之间加一个空格是一种良好的风格。

> 注意：如果您希望在整个 Rust 项目中使用标准风格，可以使用名为 `rustfmt` 的自动格式化工具来按照特定风格格式化代码（关于 `rustfmt` 更多内容可在[附录 D][devtools]<!-- ignore -->中了解）。Rust 团队将此工具与标准 Rust 发行版一起提供，就像 `rustc` 一样，因此它应该已经安装在您的计算机上！

`main` 函数的体包含以下代码：

```rust
println!("Hello, world!");
```

这一行完成了这个小程序的全部工作：它在屏幕上显示文本。这里有三个重要的细节需要注意。

首先，`println!` 调用了一个 Rust 宏。如果它调用的是函数，则会被写成 `println`（不带 `!`）。Rust 宏是一种编写代码的方式，用于扩展 Rust 语法，我们将在[第 20 章][ch20-macros]<!-- ignore -->中详细讨论它们。目前，您只需知道使用 `!` 意味着您调用的是宏而不是普通函数，并且宏并不总是遵循与函数相同的规则。

其次，你会看到 `"Hello, world!"` 字符串。我们将这个字符串作为 `println!` 的参数，然后该字符串会被打印到屏幕上。

第三，我们在行尾加上分号（`;`），这表示此表达式结束，下一行即将开始。大多数 Rust 代码行都以分号结尾。

<!-- Old headings. Do not remove or links may break. -->
<a id="compiling-and-running-are-separate-steps"></a>

### 编译与执行

你刚刚运行了一个新创建的程序，让我们来逐一分析这个过程中的每一步。

在运行 Rust 程序之前，你必须使用 Rust 编译器进行编译，输入 `rustc` 命令并传递源文件的名称，例如：

```console
$ rustc main.rs
```

如果你有 C 或 C++ 的背景知识，你会注意到这与 `gcc` 或 `clang` 类似。成功编译后，Rust 会生成一个二进制可执行文件。

在 Linux、macOS 和 Windows 的 PowerShell 上，你可以在 shell 中输入 `ls` 命令来查看可执行文件：

```console
$ ls
main  main.rs
```

在 Linux 和 macOS 上，你会看到两个文件。在 Windows 的 PowerShell 中，你会看到与使用 CMD 时相同的三个文件。在 Windows 的 CMD 中，你需要输入以下命令：

```cmd
> dir /B %= the /B option says to only show the file names =%
main.exe
main.pdb
main.rs
```

这里显示了扩展名为 `.rs_` 的源代码文件、可执行文件（Windows 上为 `_main.exe_`，其他平台为 `_main_`），以及当使用 Windows 时包含调试信息的 `.pdb_` 文件。从这里，你可以运行 `_main_` 或 `_main.exe` 文件，例如：

```console
$ ./main # or .\main on Windows
```

如果你的 _main.rs_ 是你的 “Hello, world!” 程序，这一行会在终端中打印 `Hello, world!`。

如果你更熟悉 Ruby、Python 或 JavaScript 等动态语言，你可能不习惯将编译和运行程序视为独立的步骤。Rust 是一种 _提前编译_ 语言，这意味着你可以编译程序并将可执行文件交给他人，即使没有安装 Rust 他们也可以运行它。如果你给某人一个 `.rb_`、`.py_` 或 `.js_` 文件，他们需要安装相应的 Ruby、Python 或 JavaScript 实现。但在这些语言中，你只需要一条命令即可编译和运行程序。语言设计中的一切都是权衡的结果。

对于简单的程序，使用 `rustc` 进行编译即可，但随着项目的增长，你需要管理所有选项并方便分享代码。接下来，我们将介绍 Cargo 工具，它可以帮助你编写实际的 Rust 程序。

[troubleshooting]: ch01-01-installation.html#troubleshooting
[devtools]: appendix-04-useful-development-tools.html
[ch20-macros]: ch20-05-macros.html
