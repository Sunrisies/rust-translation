## 通过自定义命令扩展 Cargo

Cargo 的设计允许你无需修改其核心结构即可添加新的子命令。如果你在 `$PATH` 中的二进制文件名为 `cargo-something`，你可以运行 `cargo something` 来像使用 Cargo 的子命令一样调用它。当你运行 `cargo --list` 时，也会列出此类自定义命令。能够使用 `cargo install` 安装扩展工具，然后像使用内置 Cargo 工具一样运行它们，这是 Cargo 设计的一个非常便捷的优势！

## 总结

与 Cargo 和 [crates.io](https://crates.io/) 共享代码是 Rust 生态系统适用于多种任务的原因之一。Rust 的标准库规模较小且稳定，但 crates 可以在不同于语言本身的周期内轻松分享、使用和改进。在 [crates.io](https://crates.io/) 上分享对你有用的代码无需犹豫；它很可能也能对其他人有所帮助！
