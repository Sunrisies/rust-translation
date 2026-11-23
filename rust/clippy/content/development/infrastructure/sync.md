# 在 Clippy 和 [`rust-lang/rust`]之间同步变更

当前，Clippy 是用固定的夜间版本构建的。

在 rustc 所在的 `rust-lang/rust` 仓库中，有一个 Clippy 的副本，编译器开发者会不时对其进行修改，以适应编译器不稳定 API 的变化。

我们需要定期将这些变更同步回该仓库，同时对该仓库所做的变更也需同步到 `rust-lang/rust` 仓库。

为了避免充斥 `rust-lang/rust` PR 队列，如果没有紧急变更的话，这种双向同步过程将以每两周一次的频率进行。从 Rust 稳定版本发布的当天开始，之后每一周进行一次。这样就能确保该仓库与最新编译器 API 保持同步，并且 Clippy 中的每个功能在夜间版本中可用两周后才会进入测试阶段。作为参考，按照此节奏进行的第一次同步是在 2020-08-27 完成的。

此过程在以下章节中有详细描述。

## 安装 `rustc-josh-sync`

通过 [`rustc-josh-sync`]工具进行同步操作。使用以下命令安装该工具：

```sh
cargo install --locked --git https://github.com/rust-lang/josh-sync
```


## 从 [`rust-lang/rust`]到 Clippy 执行同步操作

首先，在最新的 `main` 分支上创建一个名为 `rustup` 的新分支：

```
git switch -c rustup upstream/main
```

要执行同步操作，请运行：

```
rustc-josh-sync pull
```

此命令将更新 `rust-toolchain` 文件中的夜间工具链，并拉取 Rust 仓库的变更。

如果出现合并冲突，`rustc-josh-sync` 会提示您解决冲突。解决冲突后，运行 `git merge --continue`。然后，向 `rustc-josh-sync` 发送 `y` 以继续同步过程。

最后，确保 `cargo test --features=internal` 通过，并可能提交必要的变更。

> [!NOTE] > 如果版本测试失败，请参考发布文档中的 [bump version]。

如果没有合并冲突，工具会询问您是否应通过 `gh` 创建 PR。可以选择这种方式，也可以手动创建 PR。

> [!NOTE] > 如果您是 Clippy 的维护者，可以在 PR 描述中添加 `r? @ghost`，并在进行 > 快速审核后自行合并该 PR。


## 从 Clippy 同步到 [`rust-lang/rust`]

另一个方向是通过运行以下命令完成：

```
rustc-josh-sync push clippy-subtree-update <GitHub-name>
```

其中 `<GitHub-name>` 是您的 GitHub 用户名。这是将同步结果推送到 GitHub 并打开 PR 所必需的。

> [!NOTE] > 默认情况下，rustc-josh-sync 会创建一个新的 `rustc-checkout` 目录，并将 `rust-lang/rust` 仓库克隆到其中。如果您想使用现有的检查点，可以在命令前加上 `RUSTC_GIT=/path/to/rust`。

如果一切顺利，将有一个 GitHub 链接，需要用来在 Rust 仓库中打开同步 PR。PR 描述应类似如下：

```
rust-clippy subtree update

Subtree update of `rust-clippy` to https://github.com/rust-lang/rust-clippy/commit/{head}.

Created using https://github.com/rust-lang/josh-sync.

r? @ghost
```

标题必须保持原样，以便 [通知 triagebot] 这是一次同步 PR。

正文的第一行必须保持原样，以便在发布时 [找到 Clippy 提交]。

将 `r? @ghost` 替换为 Clippy 维护者的 GitHub 用户名，这样他们就可以审核并批准该 PR。

[JOSH]: https://josh-project.github.io/josh/
[`rustc-josh-sync`]: https://github.com/rust-lang/josh-sync
[bump version]: release.md#bump-version
[find the Clippy commit]: release.md#find-the-clippy-commit
[tell triagebot]: https://github.com/rust-lang/rust/pull/114157
[`rust-lang/rust`]: https://github.com/rust-lang/rust
