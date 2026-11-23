# 发布新版本的 Clippy

> [!NOTE] > 如果您是 > Clippy 团队的一员，此文档可能仅与您相关。

Clippy 与稳定的 Rust 版本一起发布。这些发布的日期可以在 [Rust Forge] 查看。本文档介绍了创建 Clippy 版本所需的步骤。

1. [定义远程仓库](#defining-remotes) 1. [升级版本](#bump-version) 1. [查找 Clippy 提交](#find-the-Clippy-commit) 1. [更新 `beta` 分支](#update-the-beta-branch) 1. [更新 `stable` 分支](#update-the-stable-branch) 1. [标记稳定提交](#tag-the-stable-commit) 1. [更新 `CHANGELOG.md`](#update-changelogmd)


## 定义远程仓库

为了简化后续步骤，您可能希望定义 Clippy 项目的 `upstream` 远程仓库。不过，这是可选的，您也可以直接使用完整的 URL 替代 `upstream`。

```bash
git remote add upstream git@github.com:rust-lang/rust-clippy
```

## 升级版本

当需要发布时，如果 `Cargo.toml` 中的版本不正确，`cargo test` 将会失败。在同步过程中，需要升级这些版本。具体操作如下：

```bash
cargo dev release bump_version
```

这将增加每个相关的 `Cargo.toml` 文件的版本号。之后，只需使用以下命令提交更新后的文件：

```bash
git commit -m "Bump Clippy version -> 0.1.XY" **/*Cargo.toml
```

`XY` 应替换为相应的版本号。

## 查找 Clippy 提交

对于更新 `beta` 和 `stable` 分支，第一步是找到相应 Rust 分支中最后一次 Clippy 同步的提交。

运行以下命令可以获取指定分支的提交：

```bash
SHA=$(cargo dev release commit /path/to/rust <branch>)
```

其中 `/path/to/rust` 是 Rust 克隆的相对路径，`<branch>` 表示 `stable`、`beta` 或 `main` 之一。

## 更新 `beta` 分支

获得 `beta` 分支的提交后，可以更新 Clippy 仓库中的 `beta` 分支。

```bash
git checkout beta
git reset --hard $SHA
git push upstream beta
```

## 更新 `stable` 分支

获得 `stable` 分支的提交后，可以更新 Clippy 仓库中的 `stable` 分支。

```bash
git checkout stable
git reset --hard $SHA
git push upstream stable
```

## 标记 `stable` 提交

更新 `stable` 分支后，标记 HEAD 提交并推送到 Clippy 仓库。

<!-- TODO: Add a `cargo dev release push-tag` command to simplify this step. -->
> 注意：仅在 `beta` 分支的 Deploy GitHub action 完成后推送标签。否则该标签的部署可能会失败。

```bash
git tag rust-1.XY.0               # XY should be exchanged with the corresponding version
git push upstream rust-1.XY.0     # `upstream` is the `rust-lang/rust-clippy` remote
```

之后，发布版本将可在 Clippy [标签页面] 上查看。


## 发布 `clippy_utils`

`clippy_utils` crate 已发布到 `crates.io`，但不提供任何稳定性保证。为此，在完成 [sync] 和发布后，切换回 `upstream/main` 分支并发布 `clippy_utils`：

> [!NOTE] > 在执行此操作之前，**必须**合并提升夜间版本和 Clippy 版本的 Rustup PR。

```bash
git switch main && git pull upstream main
cargo publish --manifest-path clippy_utils/Cargo.toml
```


## 更新 `CHANGELOG.md`

有关如何更新 changelog 的说明，请参阅相关文档。

如果您没有时间立即完整更新 changelog，只需更新以下部分即可：

- 从新的稳定版本中移除 `(beta)`：

  ```markdown
  ## Rust 1.XX (beta) -> ## Rust 1.XX
  ```

- 更新新稳定版本的发布日期行：

  ```markdown
  Current beta, release 20YY-MM-DD -> Current stable, released 20YY-MM-DD
  ```

- 更新之前稳定版本的发布日期行：

  ```markdown
  Current stable, released 20YY-MM-DD -> Released 20YY-MM-DD
  ```

[Rust Forge]: https://forge.rust-lang.org/
[tags page]: https://github.com/rust-lang/rust-clippy/tags
[sync]: sync.md
[how to update the changelog]: changelog_update.md
