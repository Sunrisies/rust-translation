# 持续集成

建议在持续集成环境中使用 `Clippy` 并设置 `-Dwarnings` 参数，这样即可避免持续集成通过错误。若希望对所有 `cargo` 命令（而不仅仅是 `cargo clippy`）的警告也进行错误处理，可以设置环境变量 `RUSTFLAGS="-Dwarnings"`。

我们建议使用与编译你的 crate 时相同的工具链来运行 `Clippy`，以确保最大兼容性。例如，如果你的 crate 是用 `stable` 工具链编译的，你也应该使用 `stable` `Clippy`。

> [!NOTE] > 新的 `Clippy` 检查首先被添加到 `nightly` 工具链中。如果你愿意协助改进 `Clippy` 并拥有持续的持续集成资源，请考虑在持续集成环境中添加 `nightly` `Clippy` 检查，并将类似误报等问题反馈给我们。这样我们就能在问题进入稳定版本之前尽早修复漏洞。

本章将概述如何在不同的主流持续集成提供程序中使用 `Clippy`。
