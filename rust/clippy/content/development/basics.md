# Clippy 开发基础

本文介绍了 Clippy 开发的基础知识，包括如何构建和测试 Clippy。如需更详细的代码库说明，可参考 [添加 lint 规则] 或 [常用工具]。


- [Clippy 开发基础](#basics-for-hacking-on-Clippy) - [获取代码](#get-the-code) - [构建与测试](#building-and-testing) - [`cargo dev`](#cargo-dev) - [lintcheck](#lintcheck) - [Pull Request](#on-prs) - [常用缩写](#common-abbreviations) - [从源代码安装](#install-from-source)

## 获取代码

首先，确保你已经下载了 Clippy 的最新版本。如果你是第一次使用 Clippy，请创建仓库的 Fork，然后使用以下命令进行克隆：

```bash
git clone git@github.com:<your-username>/rust-clippy
```

如果你之前已经克隆了 Clippy，请将其更新为最新版本：

```bash
# If the upstream remote has not been added yet
git remote add upstream https://github.com/rust-lang/rust-clippy
# upstream has to be the remote of the rust-lang/rust-clippy repo
git fetch upstream
# make sure that you are on the main branch
git checkout main
# rebase your main branch on the upstream main
git rebase upstream/main
# push to the main branch of your fork
git push
```

## 构建与测试

你可以像构建其他 Rust 项目一样构建和测试 Clippy：

```bash
cargo build  # builds Clippy
cargo test   # tests Clippy
```

由于 Clippy 的测试套件非常庞大，有些命令仅运行 Clippy 的部分测试：

```bash
# only run UI tests
cargo uitest
# only run UI tests starting with `test_`
TESTNAME="test_" cargo uitest
# only run dogfood tests
cargo dev dogfood
```

如果 [UI 测试] 的输出与预期输出不同，你可以使用以下方式更新参考文件：

```bash
cargo bless
```

例如，如果你修正了 lint 消息中的拼写错误，或者修改了测试文件以添加测试用例，就需要进行此类操作。

> [!NOTE] > 此命令可能会更新比你预期的更多文件。在这种情况下，只需提交你想要更新的文件即可。


## `cargo dev`

Clippy 提供了一些开发工具，使开发更加便捷。这些工具可以通过 `cargo dev` 命令访问。可用的工具如下所列。要获取更多关于这些命令的信息，只需使用 `--help` 参数调用它们。

```bash
# formats the whole Clippy codebase and all tests
cargo dev fmt
# register or update lint names/groups/...
cargo dev update_lints
# create a new lint and register it
cargo dev new_lint
# deprecate a lint and attempt to remove code relating to it
cargo dev deprecate
# automatically formatting all code before each commit
cargo dev setup git-hook
# (experimental) Setup Clippy to work with RustRover
cargo dev setup intellij
# runs the `dogfood` tests
cargo dev dogfood
# lints all Markdown files with remark
cargo dev remark
```

更多关于 [IntelliJ] 命令用法和原因的信息。


## lintcheck

`cargo lintcheck` 将在固定的库集合上构建并运行 Clippy，同时生成结果日志。你可以对更新后的日志与其之前的版本进行 `git diff` 比较，以了解你的lint对少数库产生了什么影响。如果你添加了新的lint规则，请审核产生的警告，确保没有误报，并且建议是有效的。

更多细节请参阅工具 [README]。


## 关于 PR

我们遵循 rustc no merge-commit 政策。请参见...
<https://rustc-dev-guide.rust-lang.org/contributing.html#opening-a-pr>.

在打开你的拉取请求之前，请注意我们遵循 LLM 政策。请参阅 [LLM 政策](llm_usage.md)。

## 常见缩写

| Abbreviation | Meaning                                |
|--------------|----------------------------------------|
| UB           | Undefined Behavior                     |
| FP           | False Positive                         |
| FN           | False Negative                         |
| ICE          | Internal Compiler Error                |
| AST          | Abstract Syntax Tree                   |
| MIR          | Mid-Level Intermediate Representation  |
| HIR          | High-Level Intermediate Representation |
| TCX          | Type context                           |

这是 Clippy 开发过程中可能用到的缩略词简洁列表。完整的通用列表可以在 [rustc-dev-guide 词汇表][glossary] 中找到。如果某个缩写或含义对你来说不清楚，随时可以询问。

## 从源代码安装

如果你正在研究 Clippy 并希望从源代码安装它，请执行以下操作：

在 Clippy 项目根目录中，运行以下命令以构建 Clippy 二进制文件并将它们复制到工具链目录中。这将默认创建一个名为 `clippy` 的新工具链，有关其他选项，请参阅 `cargo dev setup toolchain --help`。

```terminal
cargo dev setup toolchain
```

现在你可以在使用新工具链的任何项目中运行 `cargo +clippy clippy`。

```terminal
cd my-project
cargo +clippy clippy
```

...或者 `clippy-driver`

```terminal
clippy-driver +clippy <filename>
```

如果你不再需要该工具链，可以使用 `rustup` 卸载它：

```terminal
rustup toolchain uninstall clippy
```

> **不要**使用 `cargo install --path . --force` 进行安装，因为这将 > 覆盖 rustup > [代理](https://rust-lang.github.io/rustup/concepts/proxies.html)。也就是说，> `~/.cargo/bin/cargo-clippy` 和 `~/.cargo/bin/clippy-driver` 应该是指向 `~/.cargo/bin/rustup` 的硬链接或软链接。你可以通过运行 `rustup > update` 来修复这些链接。

[Adding Lints]: adding_lints.md
[Common Tools]: common_tools_writing_lints.md
[UI test]: https://rustc-dev-guide.rust-lang.org/tests/adding.html#ui-test-walkthrough
[intellij]: https://github.com/rust-lang/rust-clippy/blob/HEAD/CONTRIBUTING.md#rustrover
[README]: https://github.com/rust-lang/rust-clippy/blob/HEAD/lintcheck/README.md
[glossary]: https://rustc-dev-guide.rust-lang.org/appendix/glossary.html
