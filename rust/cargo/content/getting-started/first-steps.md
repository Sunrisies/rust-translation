# Cargo 入门步骤

本部分简要介绍 `cargo` 命令行工具。我们将演示它生成新的 [***包***][def-包] 的能力，编译包内 [***crate***][def-crate] 的能力，以及运行生成的程序的能力。

要使用 Cargo 创建新包，请使用 `cargo new`：

```console
$ cargo new hello_world
```

Cargo 默认使用 `--bin` 来生成二进制程序。若要生成库文件，则应使用 `--lib`。

让我们看看 Cargo 为我们生成了什么：

```console
$ cd hello_world
$ tree .
.
├── Cargo.toml
└── src
    └── main.rs

1 directory, 2 files
```

这就是我们开始使用的全部内容。首先，让我们查看 `Cargo.toml`：

```toml
[package]
name = "hello_world"
version = "0.1.0"
edition = "2024"

[dependencies]
```

这被称为 [***清单***][def-清单]，它包含了 Cargo 编译您的包所需的所有元数据。

以下是 `src/main.rs` 中的内容：

```rust
fn main() {
    println!("Hello, world!");
}
```

Cargo 为我们生成了一个“hello world”程序，也称为 [***二进制 crate***][def-crate]。让我们对其进行编译：

```console
$ cargo build
   Compiling hello_world v0.1.0 (file:///path/to/package/hello_world)
```

然后运行它：

```console
$ ./target/debug/hello_world
Hello, world!
```

我们也可以使用 `cargo run` 来一步完成编译和运行：

```console
$ cargo run
     Fresh hello_world v0.1.0 (file:///path/to/package/hello_world)
   Running `target/hello_world`
Hello, world!
```

## 进一步学习

有关使用 Cargo 的更多细节，请查阅 [Cargo 指南](../guide/index.md)

[def-crate]:     ../appendix/glossary.md#crate     '"crate" (glossary entry)'
[def-manifest]:  ../appendix/glossary.md#manifest  '"manifest" (glossary entry)'
[def-package]:   ../appendix/glossary.md#package   '"package" (glossary entry)'
