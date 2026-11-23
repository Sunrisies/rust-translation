# 安装

## 安装 Rust 和 Cargo

获取 Cargo 最简单的方法是通过 `rustup` 安装当前稳定的 [Rust] 版本。使用 `rustup` 安装 Rust 也会自动安装 `cargo`。

在 Linux 和 macOS 系统上，操作方式如下：

```console
curl https://sh.rustup.rs -sSf | sh
```

它会下载一个脚本并开始安装过程。如果一切顺利，你会看到以下提示：

```console
Rust is installed now. Great!
```

在 Windows 上，下载并运行 [rustup-init.exe]。它会在控制台中启动安装过程，成功时也会显示上述消息。

之后，你可以通过 `rustup` 命令安装 Rust 和 Cargo 的 `beta` 或 `nightly` 频道版本。

关于其他安装选项和信息，请访问 Rust 网站的 [install][install-rust] 页面。

## 从源代码构建并安装 Cargo

或者，你也可以 [从源代码构建 Cargo][compiling-from-source]。

[rust]: https://www.rust-lang.org/
[rustup]: https://rustup.rs/
[rustup-init.exe]: https://win.rustup.rs/
[install-rust]: https://www.rust-lang.org/tools/install
[compiling-from-source]: https://github.com/rust-lang/cargo#compiling-from-source
