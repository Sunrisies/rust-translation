# 更新变更日志

如果您希望协助更新[变更日志]，那么您来对地方了。

## 何时更新

拼写错误及其他小修整/添加内容总是受到欢迎。

在更新新版 Rust 的变更日志时需要特别小心。为此，最好在即将到来的稳定版本前一周更新变更日志。您可以在[Rust Forge][forge]上查看发布日期。

大多数情况下，我们只需要更新 minor Rust 版本的变更日志。极少有 Clippy 更改被包含在补丁版本中。

## 更新变更日志的步骤

### 1. 查找相关的 Clippy 提交

每个 Rust 版本都带有自己的 Clippy 版本。Clippy 子树位于 Rust 仓库的`tools`目录中。

根据当前时间以及您要更新的内容，以下要点可能会有所帮助：

* 在编写**即将到来的稳定版本**的发布说明时，您需要查看当前 Rust `beta` 分支的 Clippy 提交。[链接][rust_beta_tools] * 在编写**即将到来的 beta 版本**的发布说明时，您需要查看当前 Rust `main` 分支的 Clippy 提交。[链接][rust_main_tools] * 在编写**过去稳定版本**的（已遗忘的）发布说明时，您需要查看稳定版本的 Rust 发布标签。[链接][rust_stable_tools]

通常您应该编写**即将到来的稳定版本**的变更日志。不过请确保 `beta` 分支已经在 Rust 仓库中分叉。

要在`rust-lang/rust`分支中找到提交哈希（大多数情况下在`upstream/beta`分支上），请执行以下命令：
```
git log --oneline -- src/tools/clippy/ | grep -o "Merge commit '[a-f0-9]*' into .*" | head -1 | sed -e "s/Merge commit '\([a-f0-9]*\)' into .*/\1/g"
```

### 2. 获取这些提交之间的 PRs

一旦获得正确的提交范围，运行以下命令：

```
util/fetch_prs_between.sh start_commit end_commit > changes.txt
```

其中`end_commit`是上一个命令中的提交哈希，`start_commit`是[当前 CHANGELOG 文件中的提交哈希][beta_section]。打开您选择的编辑器中的`changes.txt`文件。

### 3. 编写最终的变更日志

上述脚本应该已将所有相关的 PR 导出到您指定的文件中。它已经过滤掉了大部分不相关的 PR，但手动清理一遍并选择有价值的 PR 是一个好主意。如果您对某些 PR 不确定，可以保留它们以供审查并请求反馈。

在过滤掉不相关 PR 后，您可以开始将每个 PR 中的 `changelog: ` 内容移动到 `CHANGELOG.md` 中。根据情况调整措辞，但尽量保持逻辑连贯。

章节顺序应大致如下：

```
### New Lints
* Added [`LINT`] to `GROUP`

### Moves and Deprecations
* Moved [`LINT`] to `GROUP` (From `GROUP`, now LEVEL-by-default)
* Renamed `LINT` to [`LINT`]

### Enhancements
### False Positive Fixes
### ICE Fixes
### Documentation Improvements
### Others
```

请务必更新顶部的 `[Unreleased/Beta/In Rust Nightly]` 部分[beta_section]，包含相关的提交范围，并添加 `Rust <版本>` 部分，包含发布日期和 PR 范围。

### 4. 包含 `beta-accepted` PR

寻找 [`beta-accepted`] 标签，并确保将带有该标签的 PR 也包含在更新日志中。如果可能，在更新日志 PR 合并后**移除** `beta-accepted` 标签。

> [!NOTE] > 其中一些 PR 甚至可能被回退到之前的 `beta`。> 这些必须被包含在_之前_版本的更新日志中。

### 5. 更新 `clippy::version` 属性

接下来，确保检查新增的 lints 的 `#[clippy::version]` 属性包含正确的版本。为了查找需要更新版本的 lints，请查看“新 lints”部分中的 lints，并对每个 lint 名称运行以下命令：

```
grep -rB1 "pub $LINT_NAME" .
```

显示的版本应与更新日志所针对的发布版本一致。如果不一致，请将版本更新为更新日志中的版本。

[changelog]: https://github.com/rust-lang/rust-clippy/blob/HEAD/CHANGELOG.md
[forge]: https://forge.rust-lang.org/
[rust_main_tools]: https://github.com/rust-lang/rust/tree/HEAD/src/tools/clippy
[rust_beta_tools]: https://github.com/rust-lang/rust/tree/beta/src/tools/clippy
[rust_stable_tools]: https://github.com/rust-lang/rust/releases
[`beta-accepted`]: https://github.com/rust-lang/rust-clippy/issues?q=label%3Abeta-accepted+
[beta_section]: https://github.com/rust-lang/rust-clippy/blob/HEAD/CHANGELOG.md#unreleased--beta--in-rust-nightly
