## 附录 D：有用的开发工具

在本附录中，我们将介绍 Rust 项目提供的一些有用开发工具。我们将探讨自动格式化、快速修复警告的方法、lint 工具以及与 IDE 的集成。

### 使用 `rustfmt` 进行自动格式化

`rustfmt` 工具根据社区代码风格重新格式化您的代码。许多协作项目使用 `rustfmt` 来避免关于使用哪种风格的争论：所有人都使用该工具来格式化他们的代码。

Rust 安装默认包含 `rustfmt`，因此您系统中应该已经存在 `rustfmt` 和 `cargo-fmt` 程序。这两个命令与 `rustc` 和 `cargo` 类似，`rustfmt` 允许更细粒度的控制，而 `cargo-fmt` 则理解使用 Cargo 的项目的规范。要格式化任何 Cargo 项目，请运行以下命令：

```console
$ cargo fmt
```

运行此命令会重新格式化当前 crate 中的所有 Rust 代码。这只会改变代码风格，不会改变代码语义。有关 `rustfmt` 的更多信息，请参阅 [其文档][rustfmt]。

### 使用 `rustfix` 修复代码

`rustfix` 工具包含在 Rust 安装中，可以自动修复具有明确修正方法的编译器警告，这很可能正是您想要的结果。您可能之前见过编译器警告。例如，考虑以下代码：

<span class="filename">Filename: src/main.rs</span>

```rust
fn main() {
    let mut x = 42;
    println!("{x}");
}
```

在这里，我们将变量 `x` 定义为可变的，但实际上从未对其进行修改。Rust 会对此发出警告：

```console
$ cargo build
   Compiling myprogram v0.1.0 (file:///projects/myprogram)
warning: variable does not need to be mutable
 --> src/main.rs:2:9
  |
2 |     let mut x = 0;
  |         ----^
  |         |
  |         help: remove this `mut`
  |
  = note: `#[warn(unused_mut)]` on by default
```

该警告建议我们移除 `mut` 关键字。我们可以通过运行 `cargo fix` 命令使用 `rustfix` 工具自动应用此建议：

```console
$ cargo fix
    Checking myprogram v0.1.0 (file:///projects/myprogram)
      Fixing src/main.rs (1 fix)
    Finished dev [unoptimized + debuginfo] target(s) in 0.59s
```

当再次查看 _src/main.rs_ 时，我们会发现 `cargo fix` 已经修改了代码：

<span class="filename">Filename: src/main.rs</span>

```rust
fn main() {
    let x = 42;
    println!("{x}");
}
```

变量 `x` 现在变为不可变的，警告也消失了。

您也可以使用 `cargo fix` 命令在不同版本的 Rust 之间转换代码。版本信息请参阅 [附录 E][editions]<!-- ignore -->。

### 使用 Clippy 实现更多 lint 功能

Clippy 工具是一组代码检查工具，用于分析您的代码，以便您能够发现常见错误并改进您的 Rust 代码。标准 Rust 安装中已包含 Clippy。

要在任何 Cargo 项目上运行 Clippy 的检查功能，请输入以下命令：

```console
$ cargo clippy
```

例如，假设您编写了一个使用数学常数（如 π）近似值的程序，就像这个程序一样：

<Listing file-name="src/main.rs">

```rust
fn main() {
    let x = 3.1415;
    let r = 8.0;
    println!("the area of the circle is {}", x * r * r);
}
```

</Listing>

在该项目上运行 `cargo clippy` 会产生如下错误：

```text
error: approximate value of `f{32, 64}::consts::PI` found
 --> src/main.rs:2:13
  |
2 |     let x = 3.1415;
  |             ^^^^^^
  |
  = note: `#[deny(clippy::approx_constant)]` on by default
  = help: consider using the constant directly
  = help: for further information visit https://rust-lang.github.io/rust-clippy/master/index.html#approx_constant
```

此错误表明 Rust 已经定义了更精确的 `PI` 常量，如果您使用该常量，程序将更加正确。此时您需要将代码改为使用 `PI` 常量。

以下代码不会引发 Clippy 的任何错误或警告：

<Listing file-name="src/main.rs">

```rust
fn main() {
    let x = std::f64::consts::PI;
    let r = 8.0;
    println!("the area of the circle is {}", x * r * r);
}
```

</Listing>

有关 Clippy 的更多信息，请参阅 [其文档][clippy]。

### 使用 `rust-analyzer` 进行 IDE 集成

为了帮助实现 IDE 集成，Rust 社区建议使用 [`rust-analyzer`][rust-analyzer]<!-- ignore -->。该工具是一组以编译器为中心的实用程序，支持 [语言服务器协议][lsp]<!-- ignore -->，这是用于让 IDE 和编程语言相互通信的规范。不同客户端可以使用 `rust-analyzer`，例如 [Visual Studio Code 中的 Rust 分析插件][vscode]。

请访问 `rust-analyzer` 项目的 [主页][rust-analyzer]<!-- ignore -->以获取安装说明，然后在您的特定 IDE 中安装语言服务器支持。您的 IDE 将获得自动补全、定义跳转和内联错误等功能。

[rustfmt]: https://github.com/rust-lang/rustfmt
[editions]: appendix-05-editions.md
[clippy]: https://github.com/rust-lang/rust-clippy
[rust-analyzer]: https://rust-analyzer.github.io
[lsp]: http://langserver.org/
[vscode]: https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer
