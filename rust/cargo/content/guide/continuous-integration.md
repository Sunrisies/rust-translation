# 持续集成

## 入门指南

基本的 CI 会构建和测试你的项目：

### GitHub Actions

要在 GitHub Actions 中测试你的包，以下是一个示例 `.github/workflows/ci.yml` 文件：

```yaml
name: Cargo Build & Test

on:
  push:
  pull_request:

env:
  CARGO_TERM_COLOR: always

jobs:
  build_and_test:
    name: Rust project - latest
    runs-on: ubuntu-latest
    strategy:
      matrix:
        toolchain:
          - stable
          - beta
          - nightly
    steps:
      - uses: actions/checkout@v6
      - run: rustup update ${{ matrix.toolchain }} && rustup default ${{ matrix.toolchain }}
      - run: cargo build --verbose
      - run: cargo test --verbose

```

这将测试所有三个发布通道（注意：任何工具链版本出现失败都会导致整个作业失败）。你也可以在 GitHub 界面中点击 `"Actions" > "new workflow"` 并选择 Rust，以将 [默认配置](https://github.com/actions/starter-workflows/blob/main/ci/rust.yml) 添加到你的仓库。更多详情请参考 [GitHub Actions 文档](https://docs.github.com/en/actions)。

### GitLab CI

要在 GitLab CI 中测试你的包，以下是一个示例 `.gitlab-ci.yml` 文件：

```yaml
stages:
  - build

rust-latest:
  stage: build
  image: rust:latest
  script:
    - cargo build --verbose
    - cargo test --verbose

rust-nightly:
  stage: build
  image: rustlang/rust:nightly
  script:
    - cargo build --verbose
    - cargo test --verbose
  allow_failure: true
```

这将在稳定通道和夜间通道进行测试，但夜间通道中的任何问题不会导致整体构建失败。更多详情请参考 [GitLab CI 文档](https://docs.gitlab.com/ce/ci/yaml/index.html)。

### builds.sr.ht

要在 sr.ht 中测试你的包，以下是一个示例 `.build.yml` 文件。请确保将 `<your repo>` 和 `<your project>` 分别替换为克隆的仓库及其克隆目录。

```yaml
image: archlinux
packages:
  - rustup
sources:
  - <your repo>
tasks:
  - setup: |
      rustup toolchain install nightly stable
      cd <your project>/
      rustup run stable cargo fetch
  - stable: |
      rustup default stable
      cd <your project>/
      cargo build --verbose
      cargo test --verbose
  - nightly: |
      rustup default nightly
      cd <your project>/
      cargo build --verbose ||:
      cargo test --verbose  ||:
  - docs: |
      cd <your project>/
      rustup run stable cargo doc --no-deps
      rustup run nightly cargo doc --no-deps ||:
```

这将在稳定通道和夜间通道中测试和构建文档，但夜间通道中的任何问题不会导致整体构建失败。更多详情请参考 [builds.sr.ht 文档](https://man.sr.ht/builds.sr.ht/)。


### CircleCI

要在 CircleCI 中测试你的包，以下是一个示例 `.circleci/config.yml` 文件：

```yaml
version: 2.1
jobs:
  build:
    docker:
      # check https://circleci.com/developer/images/image/cimg/rust#image-tags for latest
      - image: cimg/rust:1.77.2
    steps:
      - checkout
      - run: cargo test
```

要运行更复杂的管道，包括模糊测试检测、缓存和产物管理功能，请参考 [CircleCI 配置参考](https://circleci.com/docs/configuration-reference/)。

## 验证最新依赖项

在 `Cargo.toml` 中[指定依赖项](../reference/specifying-dependencies.md)时，它们通常属于版本范围。全面测试所有版本组合会非常繁琐。验证最新版本至少可以测试那些使用 [`cargo add`] 或 [`cargo install`]的用户。

在测试最新版本时，需要注意以下因素：- 减少影响本地开发或 CI 的外部因素 - 新依赖发布的频率 - 项目愿意承担的风险水平 - CI 成本，包括间接成本，例如如果 CI 服务有并行运行的最大数量限制，会导致在达到上限时新的任务被序列化。

一些潜在的解决方案包括：- [不在 `Cargo.lock` 中检查][why-have-cargolock-in-version-control] - 根据 PR 的更新速度，许多版本可能未被测试 - 这会带来确定性性的代价 - 让 CI 任务验证最新依赖，但标记为“在失败时继续” - 根据 CI 服务的不同，故障可能并不明显 - 根据 PR 的更新速度，可能会使用过多的资源 - 安排一个定时 CI 任务来验证最新依赖 - 托管式 CI 服务可能会禁用长时间未修改仓库的定时任务，影响被动维护的包 - 根据 CI 服务的不同，通知可能不会发送给能够处理故障的人 - 如果与依赖发布频率不匹配，可能无法测试足够的版本或进行冗余测试 - 通过 PR 定期更新依赖，如使用 [Dependabot] 或 [RenovateBot] - 可以将依赖隔离到单独的 PR 中，或者合并到一个单一 PR 中 - 仅使用必要的资源 - 可以配置频率以平衡 CI 资源和依赖版本的覆盖率。

一个使用 GitHub Actions 验证最新依赖的示例 CI 任务：
```yaml
jobs:
  latest_deps:
    name: Latest Dependencies
    runs-on: ubuntu-latest
    continue-on-error: true
    env:
      CARGO_RESOLVER_INCOMPATIBLE_RUST_VERSIONS: allow
    steps:
      - uses: actions/checkout@v6
      - run: rustup update stable && rustup default stable
      - run: cargo update --verbose
      - run: cargo build --verbose
      - run: cargo test --verbose
```
注意：- [`CARGO_RESOLVER_INCOMPATIBLE_RUST_VERSIONS`](../reference/config.md#resolverincompatible-rust-versions) 被设置为确保 [解析器](../reference/resolver.md) 不会因项目的 [Rust 版本](../reference/rust-version.md) 而限制选定的依赖。

对于存在更高平台或 Rust 版本失败风险的项目，可能需要测试更多的组合。

## 验证 `rust-version`

在发布指定 [`rust-version`](../reference/清单.md#the-rust-version-field) 的包时，验证该字段的正确性非常重要。

一些可以帮助此任务的第三方工具包括： - [`cargo-msrv`](https://crates.io/crates/cargo-msrv) - [`cargo-hack`](https://crates.io/crates/cargo-hack)

使用 GitHub Actions 实现这一方法的示例：
```yaml
jobs:
  msrv:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v6
    - uses: taiki-e/install-action@cargo-hack
    - run: cargo hack check --rust-version --workspace --all-targets --ignore-private
```
这种做法试图在全面性与完成时间之间取得平衡： - 由于大多数项目不依赖特定平台，因此使用一个通用平台，并信任平台特定的依赖项来验证其行为。 - 对于贡献者通常会遇到的API可用性问题而非行为问题，则使用`cargo check`。 - 未发布的包被跳过，因为假设只有通过注册表使用的验证项目的消费者才会关心`rust-version`。

## 检查警告

通常，项目在官方分支上希望“无警告”，而在本地开发时则较为宽松。[`build.warnings = "deny"`]可以在出现警告时导致CI作业失败。

使用GitHub Actions检查警告的示例CI作业：
```yaml
jobs:
  warnings:
    runs-on: ubuntu-latest
    env:
      CARGO_BUILD_WARNINGS: deny
    steps:
      - uses: actions/checkout@v6
      - run: rustup update stable && rustup default stable
      - run: rustup component add clippy
      - run: cargo clippy --all-targets --all-features --keep-going
```

注意事项： - CI可能会因新的工具链版本而失败，因为对警告的兼容性保证有限。考虑通过自动化作业固定工具链版本，并在新发布时创建PR来升级工具链。 - 在选择平台、功能及包/构建目标组合时，需要在全面性与完成时间之间找到平衡 - 某些CI系统可以直接集成用于报告lint错误，例如使用 [`clippy-sarif`]与GitHub结合使用

## 确保lockfile更新

持有过期的lockfile会抵消[在版本控制中提交lockfile的好处][为什么要在版本控制中使用cargolock]。

使用GitHub Actions检查过期lockfile的示例CI作业：
```yaml
jobs:
  lockfile:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - run: rustup update stable && rustup default stable
      - run: cargo update --workspace --locked
```

[`build.warnings = "deny"`]: ../reference/config.md#buildwarnings
[`cargo add`]: ../commands/cargo-add.md
[`cargo install`]: ../commands/cargo-install.md
[`clippy-sarif`]: https://crates.io/crates/clippy-sarif
[Dependabot]: https://docs.github.com/en/code-security/dependabot/working-with-dependabot
[RenovateBot]: https://renovatebot.com/
[why-have-cargolock-in-version-control]: ../faq.md#why-have-cargolock-in-version-control
