## 包与 crates

我们将要讨论的模块系统的第一个部分就是包和 crates。

_crate_ 是 Rust 编译器一次考虑的最小代码量。即使你使用 `rustc` 而不是 `cargo`，并传递一个源文件（就像我们在第 1 章的“Rust 程序基础”[basics]<!-- ignore -->中做的那样），编译器也会将该文件视为一个 crate。Crates 可以包含模块，而这些模块可能定义在与其他文件一起被编译的 crates 中，我们将在后续章节中看到这一点。

crate 有两种形式：二进制 crate 或库 crate。_二进制 crate_ 是你可以编译成可执行程序并运行的程序，例如命令行程序或服务器。每个 binary crate 都必须有一个名为 `main` 的函数，该函数定义了可执行程序运行时发生的情况。到目前为止我们创建的所有 crates 都是二进制 crate。

_Library crate_ 没有 `main` 函数，也不会被编译成可执行程序。相反，它们定义的是用于多个项目共享的功能。例如，我们在[第 2 章][rand]<!-- ignore -->中使用的 `rand` crate 提供了生成随机数的功能。大多数时候，当 Rustaceans 说“crate”时，他们指的是库 crate，并且他们用“crate”来替代“库”这一通用编程概念。

_crate root_ 是 Rust 编译器开始处理的源文件，它构成了你的 crate 的根模块（我们将在[“使用模块控制作用域和隐私”][modules]<!-- ignore -->中详细解释模块）。

_Package_ 是一个包含一个或多个 crates 的包，提供一组功能。一个 package 包含一个 _Cargo.toml_ 文件，该文件描述了如何构建这些 crates。实际上，Cargo 就是一个包，它包含了你用于构建代码的命令行工具的二进制 crate。Cargo 包还包含另一个库 crate，而二进制 crate 依赖于这个库 crate。其他项目可以依赖 Cargo 库 crate，以使用 Cargo 命令行工具使用的相同逻辑。

一个包可以包含任意多的二进制库，但最多只能包含一个库包。无论是一个库还是二进制库，一个包都必须至少包含一个包。

让我们来了解一下创建包时会发生什么。首先，我们运行 `cargo new my-project` 命令：

```console
$ cargo new my-project
     Created binary (application) `my-project` package
$ ls my-project
Cargo.toml
src
$ ls my-project/src
main.rs
```

运行 `cargo new my-project` 后，我们使用 `ls` 查看 Cargo 创建了什么内容。在 _my-project_ 目录中有一个 _Cargo.toml_ 文件，它定义了一个包。还有一个 _src_ 目录，其中包含 _main.rs_。打开 _Cargo.toml_ 并在文本编辑器中查看，你会发现没有提到 _src/main.rs_。Cargo 遵循一种约定，即 _src/main.rs_ 是与包同名的二进制包的包根。同样，如果包目录中包含 _src/lib.rs_，则表明该包包含一个与包同名的库包，而 _src/lib.rs_ 就是其包根。Cargo 会将包根文件传递给 `rustc` 以构建库或二进制程序。

这里我们有一个仅包含 _src/main.rs_ 的包，意味着它只包含一个名为 `my-project` 的二进制包。如果一个包同时包含 _src/main.rs_ 和 _src/lib.rs_，则它有两个包：一个二进制包和一个库包，两者都与包同名。通过将文件放在 _src/bin_ 目录中，一个包可以拥有多个二进制包：每个文件都会成为一个独立的二进制包。

[basics]: ch01-02-hello-world.html#rust-program-basics
[modules]: ch07-02-defining-modules-to-control-scope-and-privacy.html
[rand]: ch02-00-guessing-game-tutorial.html#generating-a-random-number
