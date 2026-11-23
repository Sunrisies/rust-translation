# 回迁变更

有时需要将变更回迁到 Clippy 的测试版发布中。Clippy 中的回迁情况较为罕见，必须得到 Clippy 团队的批准。例如，如果修复了关键的 ICE 问题或某个 lint 功能失效到无法使用的情况，在进入稳定版本之前需要进行回迁。

> [!NOTE] > 如果您认为某个 PR 需要回迁，可以将其标记为 > `beta-nominated`。这必须在发布前一周的星期四之前完成。

## 筛选用于回迁的 PR

首先，使用 [此过滤器][beta-accepted-prs] 查找所有被标记的 PR。

接下来，逐一审查每个 PR。有一些检查点需要关注，这些判断可能具有主观性，需要良好的判断力。

1. **修复是否值得进行回迁？**

   这非常主观。修复 ICE 问题通常值得回迁。将 lint 功能移动到更低的级别（从 warn- 改为允许默认使用）通常也值得回迁。而修复 FP 问题通常不需要单独进行回迁。如果无论如何都要进行回迁，那么 FP 修复也可能被包含在内。如果 PR 中有很多变更，则必须更加谨慎地考虑回迁。

2. **由 PR 修复的问题是否已经存在于 `beta` 中？**

   有可能由 PR 修复的问题尚未进入 Rust 仓库的 `beta` 分支。如果是这种情况，且修复已同步到 Rust 仓库，则不需要进行回迁，因为该修复将与引入问题的提交一起进入稳定版本。如果修复 PR 尚未同步，则该修复 PR 要么需要在下一个回迁周期中“回迁”到 Rust `main` 分支，要么回迁到 `beta`。

3. **确保修复已存在于 `main` 分支后再迁移到 `beta`**

   修复必须已经同步到 Rust `main` 分支。否则，下一个 `beta` 版本将再次缺少该修复。如果尚未进入 `main` 分支，通常不应进行回迁。如果回迁非常重要，应首先进行非周期性的同步。不过，非周期性同步应该规模较小，因为该同步中的变更会直接进入 `beta`，而无需先在 `nightly` 中测试。


## Preparation

> [!NOTE] > 本章中的所有命令都将在 Rust 克隆环境中运行。

遵循 [定义远程仓库] 中的说明，在 Rust 仓库中定义 `clippy-upstream` 远程仓库。

之后，使用以下命令获取该远程仓库：

```bash
git fetch clippy-upstream main
```

然后，切换到 `beta` 分支：

```bash
git switch beta
git fetch upstream
git reset --hard upstream/beta
```


## 回退更改

当 PR 被合并到 GitHub 合并队列中后，该 PR 将以以下消息关闭：

> \<PR 标题\> (#\<PR 编号\>)

此提交需要被回退。为此，找到该提交的 `<sha1>` 值，并在 **Rust 仓库**的克隆环境中运行以下命令：

```bash
git cherry-pick -m 1 `<sha1>`
```

对所有需要回退的 PR 执行此操作。

## 在 Rust 仓库中打开 PR

接下来，打开用于回退的 PR。确保该 PR 指向 `beta` 分支而非 `main` 分支。PR 描述应如下所示：

```
[beta] Clippy backports

r? @Mark-Simulacrum

Backports:
- <Link to the Clippy PR>
- ...

<Short summary of what is backported and why>
```

标记来自发布团队，他们最终必须在分支新的 `beta` 版本之前合并该 PR。给它们打标签以处理回退工作。接下来，列出所有回退项，并简要说明回退的内容及其为何值得进行回退。

## 重新标记已回退的 PR

当 PR 被回退到 Rust `beta` 分支后，将 PR 标记为 `beta-accepted`。这样在 [编写变更日志]时就会被考虑。

[beta-accepted-prs]: https://github.com/rust-lang/rust-clippy/issues?q=label%3Abeta-nominated
[defining remotes]: release.md#defining-remotes
[writing the changelog]: changelog_update.md#4-include-beta-accepted-prs
