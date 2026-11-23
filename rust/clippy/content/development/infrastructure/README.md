# Infrastructure

为了在 `rustup` 上部署 Clippy，需要一些基础设施。本章将介绍实现此功能所需维护的 Clippy 基础设施的各个部分。

最重要的部分是 `rust-lang/rust` 仓库与 Clippy 仓库之间每两周进行的同步操作。该过程在 [Syncing changes between Clippy and `rust-lang/rust`](sync.md) 章节中有描述。

新的 Clippy 版本与每次 Rust 版本发布同时推出，周期为每六周一次。发布流程在 [Release a new Clippy Version](release.md) 章节中有描述。在发布周期中，必须编写关于下一个版本的变更日志条目。该格式的制定及实现方法在 [Changelog Update](changelog_update.md) 章节中有文档说明。

> [!NOTE] > Clippy CI 也应在本章中描述，但目前被保留为 TODO 任务。
