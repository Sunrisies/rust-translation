# 常见问题解答

## 计划将 GitHub 作为包仓库吗？

否。Cargo 的规划是使用 [crates.io]，就像 npm 或 Rubygems 使用 [npmjs.com][1] 和 [rubygems.org][3] 一样。

我们计划永远支持 git 仓库作为包的来源，因为即使人们将注册表作为主要的包来源，它们仍可用于早期开发和临时补丁。

## 为什么构建 crates.io 而不是使用 GitHub 作为注册表？

我们认为支持多种下载包的方式非常重要，包括从 GitHub 下载以及将包直接复制到你的包中。

话虽如此，我们认为 [crates.io] 提供了许多重要的优势，很可能成为 Cargo 中人们下载包的主要方式。

作为先例，Node.js 的 [npm][1] 和 Ruby 的 [bundler][2] 都支持中央注册表模式以及基于 Git 的模式，在这些生态系统中大多数包都是通过注册表下载的，只有少数包使用基于 git 的包。


使中央注册表在其他语言中受欢迎的一些优势包括：

* **可发现性**。中央注册表提供了一个容易查找现有包的地方。结合标签使用，还使得注册表能够提供整个生态系统的信息，例如最受欢迎或依赖最多的包列表。
* **速度**。中央注册表可以轻松快速地获取包的元数据，然后高效地下载已发布的包，而不需要处理仓库中存在的其他冗余内容。这显著提高了依赖解析和下载的速度。随着依赖图的扩大，下载所有 git 仓库会很快变得缓慢。此外，并非所有人都有高速、低延迟的互联网连接。

## Cargo 能否与 C 代码（或其他语言）一起使用？

Yes!

Cargo 可以处理 Rust 代码的编译，但我们知道许多 Rust 包依赖 C 代码。我们也知道，围绕 Rust 以外的语言编译工具已经发展了几十年。

我们的解决方案：Cargo 允许一个包[指定一个脚本](reference/build-scripts.md)（用 Rust 编写），在调用 `rustc` 之前运行该脚本。利用 Rust 实现了特定平台的配置，并移除了各包之间的通用构建功能。

## Cargo 能否用于 `make`（或 `ninja`，或其他工具）中？

确实可以。虽然我们打算让 Cargo 作为独立方式在顶层编译 Rust 包，但我们知道有些人希望从其他构建工具中调用 Cargo。

我们设计了 Cargo 以在这些环境中良好运行，注意了错误代码和机器可读取输出模式等问题。我们在这些方面还有一些工作要做，但在传统脚本中使用 Cargo 是我们从一开始就设计好的方式，并将继续优先考虑。

## Cargo 是否处理多平台包或交叉编译？

Rust 本身提供了根据平台配置代码部分的机制。Cargo 也支持[特定平台的依赖项][目标-deps]，我们计划将来在 `Cargo.toml` 中支持更多按平台进行的配置。


从长远来看，我们正在寻找使用 Cargo 便捷地进行交叉编译包的方法。

## Cargo 是否支持 `production` 或 `test` 等环境？

我们通过使用[配置文件]来支持环境：


* 特定环境的标志（例如开发时使用 `-g --opt-level=0`，生产环境时使用 `--opt-level=3`）。
* 特定环境的依赖项（例如测试断言时使用的 `hamcrest`）。
* 特定环境的 `#[cfg]` 配置。
* `cargo test` 命令。

## Cargo 在 Windows 上能工作吗？

Yes!

所有提交到 Cargo 的项目都必须通过 Windows 上的本地测试套件。如果在 Windows 上运行时遇到问题，我们将其视为漏洞，因此[请提交问题报告][cargo-issues]。


## 为什么要在版本控制中保留 `Cargo.lock`？

虽然 [`cargo new`] 默认会在版本控制中跟踪 `Cargo.lock`，但是否这样做取决于你的包的需求。

`Cargo.lock` 锁定文件的作用是在成功构建时描述项目的状态。Cargo 使用该锁定文件确保在不同时间和不同系统上都能进行确定性的构建，从而确保使用的依赖项和版本与最初生成 `Cargo.lock` 文件时完全一致。

确定性构建有助于： - 使用 `git bisect` 查找问题的根本原因； - 确保 CI 仅因新提交而失败，而非外部因素； - 减少贡献者看到与其他贡献者或 CI 不同的行为时产生的困惑。

拥有这种依赖项快照在项目需要针对一致的依赖版本进行验证时也非常有用，例如： - 验证低于依赖项最新版本的最小支持 Rust 版本（MSRV）； - 验证人类可读的输出，这些输出没有兼容性保证（例如快照测试错误信息，以确保其“可理解”，这是一个过于模糊无法自动化的指标）。

然而，这种确定性可能会带来虚假的安全感，因为 `Cargo.lock` 并不影响你的包的使用者，只有 `Cargo.toml` 才起作用。例如：`[cargo install]` 会选择最新依赖项，除非传入 `[--locked](commands/cargo.html#option-cargo---locked)` 选项。新依赖项，如通过 [`cargo add`]添加的依赖项，会被锁定到最新版本。

锁定文件也可能成为合并冲突的来源。

有关通过 CI 验证较新依赖版本的策略，请参阅[验证最新依赖项](guide/continuous-integration.md#verifying-latest-dependencies)。


## 库是否可以将 `*` 作为依赖项的版本号？

**自2016年1月22日起，[crates.io]拒绝所有带有通配符依赖约束的包（不仅仅是库）。**

虽然库_可以_这样做，但严格来说它们不应该这样做。`*` 版本的要求意味着“此代码适用于所有版本”，而这是永远不可能的。库应该始终明确说明其适用的版本范围，即使是很通用的如“所有1.x.y版本”这样的表述。

## 为什么使用 `Cargo.toml`？

作为与Cargo最频繁的互动之一，为何配置文件命名为`Cargo.toml`的问题时常被提出。首字母大写的`C`是为了让清单文件在目录列表中与其他类似配置文件归为同一类。排序时大写字母通常位于小写字母之前，因此`Makefile`和`Cargo.toml`会被放在一起。后缀`.toml`则强调了该文件采用[TOML配置文件格式](https://toml.io/)。

Cargo不允许使用其他名称如`cargo.toml`或`Cargofile`，因为这样无法体现Cargo仓库的易识别性。历史上，多种可能的名称选项会导致混淆，某些情况被处理而另一些则被意外遗忘。


## Cargo如何离线工作？

`--offline`或`--frozen`标志告诉Cargo不要访问网络。如果尝试访问网络，它会返回错误。你可以在一个项目中使用`[cargo fetch]`下载依赖项后再离线操作，然后在另一个项目中使用这些相同的依赖项。可以通过Cargo配置设置[配置值][offline config]。



托管技术也与此相关，更多详情请参阅关于[源替换][replace]的文档。


## 为什么 Cargo 会重新构建我的代码？

Cargo 负责逐步编译项目中的 crate。这意味着如果你输入 `cargo build` 两次，第二次不应该重新构建你的 crates.io 依赖项。然而，有时会出现错误，且 Cargo 可能会在你不期望的时候重新构建代码！

我们一直希望[提供更好的诊断信息](https://github.com/rust-lang/cargo/issues/2904)，但不幸的是，在相当长的一段时间内未能取得进展。不过，你可以通过设置 `CARGO_LOG` 环境变量来至少稍微调试一下重新构建过程：

```sh
$ CARGO_LOG=cargo::compiler::fingerprint=info cargo build
```

这将使 Cargo 输出大量关于诊断和重建的信息。这些信息通常能揭示你的项目为何被重新构建的原因，尽管目前这种输出并不容易阅读，往往需要你自己整理信息。请注意，`CARGO_LOG` 必须针对你认为不应该重新构建的命令进行设置。不幸的是，目前 Cargo 没有方法能够事后调试“为什么进行了重新构建？”

我们历史上遇到过一些可能导致 crate 被重新构建的问题：

* 一个构建脚本会打印 `cargo::rerun-if-changed=foo`，其中 `foo` 是一个不存在的文件，且没有任何内容生成它。在这种情况下，Cargo 会继续运行构建脚本，以为它会生成该文件，但实际上永远不会生成。解决方法就是避免在这种情况下打印 `rerun-if-changed`。

* 两次连续的 Cargo 构建对于某些依赖项所启用的功能集可能会有所不同。例如，如果第一次构建命令构建了整个工作空间，而第二次构建仅构建了一个 crate，那么 crates.io 上的某个依赖项就会拥有不同的功能集，导致该依赖项及其所有依赖项都被重新构建。遗憾的是，目前并没有很好的解决方案，不过如果可能的话，最好让 crate 中启用的功能集保持恒定，而不管你在工作空间中正在构建什么内容。

* 某些文件系统在时间戳方面表现出异常行为。Cargo 主要使用文件中的时间戳来决定是否需要重建，但如果你使用的是非标准的文件系统，可能会以某种方式影响时间戳（例如截断它们、导致它们漂移等）。在这种情况下，你可以自由打开问题报告，我们可以看看能否以某种方式适应该文件系统。

* 并发构建过程要么删除构建产物，要么修改文件。有时你可能会有一个后台进程试图构建或检查你的项目。这些后台进程可能会意外地删除一些构建产物或修改文件（或者只是偶然发生），这可能导致重建看起来很奇怪！最好的解决方法是管理好后台进程，避免与你的工作冲突。

然而，如果你在尝试调试问题后仍然遇到麻烦，请随时[打开问题报告](https://github.com/rust-lang/cargo/issues/new)！

## “版本冲突”是什么意思以及如何解决？

> 无法为 `x` 选择可以解决此冲突的版本

您是否见过上述错误消息？

这是 Cargo 用户最令人烦恼的错误消息之一。有几种情况可能导致版本冲突。下面我们将介绍可能的原因并提供诊断技术，以帮助你解决问题：

- 项目及其依赖项使用[链接]来反复链接本地库。Cargo禁止将两个包含相同原生库的包进行链接，因此即使存在多层依赖也不可行。在这种情况下，错误信息会提示：`依赖图中只有一个包可以指定相同的链接值`，您可能需要手动检查并删除重复的链接值。社区也有[既定规范]来解决这一问题。

- 当项目依赖不同的crate时，如果这些crate使用相同的依赖库，但使用的版本受到限制，无法确定正确版本，也会引发冲突。错误信息会提示：`所有可能的版本与之前选择的包发生冲突`。您可能需要修改版本要求以使其保持一致。

- 如果项目中存在多个依赖版本，使用[`direct-minimal-versions`]时，可能无法满足最低版本要求，从而引发冲突。您可能需要调整直接依赖的版本要求，以符合最低的SemVer版本。

- 如果依赖crate没有您选择的特性，也会引发冲突。此时，您需要检查依赖版本及其特性。

- 在合并分支或PR时可能会发生冲突，如果存在非简单的冲突，您可以重置所有“您的”更改，修复分支中的其他冲突，然后运行一些cargo命令（如`cargo tree`或`cargo check`），这应该会重新更新包含您本地更改的lockfile。如果您之前在分支中运行了某些`cargo update`命令，现在可以再次运行它们。社区一直在尝试使用[自定义合并工具]来解决与`Cargo.lock`和`Cargo.toml`相关的合并冲突。



## 为什么我的构建占用了大量空间？

Cargo 为了加快构建速度而牺牲了磁盘空间，包括： - 维护一个中间构建文件的[缓存]，以便在修改某个包时避免重新构建所有内容 - 为不同的工具链版本、包版本、功能等组合维护独立的[缓存]条目，以避免在切换配置时重新构建包 - 为本地包启用[增量编译]，以便仅对发生变化的包进行快速重建 - 在 [`dev` 配置文件]中启用[调试信息]，以防你使用调试器

[1]: https://www.npmjs.com
[2]: https://bundler.io
[3]: https://rubygems.org
[target-deps]: reference/specifying-dependencies.md#platform-specific-dependencies
[profiles]: reference/profiles.md
[cargo-issues]: https://github.com/rust-lang/cargo/issues
[`cargo new`]: commands/cargo-new.md
[`cargo add`]: commands/cargo-add.md
[`cargo install`]: commands/cargo-install.md
[crates.io]: https://crates.io/
[replace]: reference/source-replacement.md
[`cargo fetch`]: commands/cargo-fetch.md
[offline config]: reference/config.md#netoffline
[links]: reference/resolver.md#links
[conventions in place]: reference/build-scripts.md#-sys-packages
[`direct-minimal-versions`]: https://doc.rust-lang.org/nightly/cargo/reference/unstable.html#direct-minimal-versions
[custom merge tool]: https://github.com/rust-lang/cargo/issues/1818
[incremental compilation]: reference/profiles.md#incremental
[debuginfo]: reference/profiles.md#debug
[`dev` profile]: reference/profiles.md#dev
[cache]: reference/build-cache.md
