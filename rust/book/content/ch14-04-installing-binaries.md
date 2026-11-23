<!-- Old headings. Do not remove or links may break. -->

<a id="installing-binaries-from-cratesio-with-cargo-install"></a>

## 使用 `cargo install` 安装二进制文件

`cargo install` 命令允许你在本地安装并使用二进制 crate。此功能并非旨在替代系统包，而是为 Rust 开发者提供了一种便捷的方式，用于安装在 [crates.io](https://crates.io/) 上由他人分享的工具。请注意，你只能安装具有二进制目标的包。_二进制目标_是指如果 crate 包含 `_src/main.rs` 文件或指定为二进制文件的其他文件时生成的可运行程序；而库目标则无法独立运行，但适合包含在其他程序中。通常，crate 的 README 文件中会说明该 crate 是库还是具有二进制目标，或者两者兼有。

所有通过 `cargo install` 安装的二进制文件都存储在安装根目录的 `_bin` 文件夹中。如果你使用 _rustup.rs_ 安装 Rust 且没有自定义配置，该目录将为 *$HOME/.cargo/bin*。确保此目录位于你的 `$PATH` 中，以便能够运行通过 `cargo install` 安装的程序。

例如，在第 12 章中我们提到，有一个名为 `ripgrep` 的 Rust 实现用于文件搜索的 `grep` 工具。要安装 `ripgrep`，可以运行以下命令：

<!-- manual-regeneration
cargo install something you don't have, copy relevant output below -->

```console
$ cargo install ripgrep
    Updating crates.io index
  Downloaded ripgrep v14.1.1
  Downloaded 1 crate (213.6 KB) in 0.40s
  Installing ripgrep v14.1.1
--snip--
   Compiling grep v0.3.2
    Finished `release` profile [optimized + debuginfo] target(s) in 6.73s
  Installing ~/.cargo/bin/rg
   Installed package `ripgrep v14.1.1` (executable `rg`)
```

输出的倒数第二行显示了已安装二进制文件的位置和名称，对于 `ripgrep` 来说就是 `rg`。只要安装目录位于你的 `$PATH` 中（如前所述），你就可以运行 `rg --help`，并开始使用更快速、更符合 Rust 风格的文件搜索工具！
