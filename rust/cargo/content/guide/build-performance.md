# 优化构建性能

Cargo 配置选项和源代码组织模式可以帮助提升构建性能，通过优先处理这些方面来替代其他可能不那么重要的因素。

与优化运行时性能一样，务必针对您真正关心的流程进行测试。虽然我们提供了通用指南，但您的实际情况可能有所不同，某些方法实际上可能会恶化您的构建性能。

需要考虑的示例流程包括： - 开发过程中的编译器反馈（`cargo check` 在代码更改后） - 开发过程中的测试反馈（`cargo test` 在代码更改后） - CI 构建

## Cargo 和编译器配置

Cargo 使用默认配置，试图平衡多个方面，包括可调试性、运行时性能、构建性能、二进制大小等。本节介绍了几种改变这些默认值的方法，这些方法应旨在最大化构建性能。

常见的覆盖默认值的位置包括： - [`Cargo.toml` 配置文件](../reference/profiles.md) - 所有参与项目的开发者都可以使用 - 支持的配置有限（请参阅 [#12738](https://github.com/rust-lang/cargo/issues/12738)以扩展此功能） - [`$WORKSPACE_ROOT/.cargo/config.toml` 配置文件](../reference/config.md) - 所有参与项目的开发者都可以使用 - 与 `Cargo.toml` 不同，此文件对调用 `cargo` 的目录敏感（请参阅 [#2930](https://github.com/rust-lang/cargo/issues/2930)） - [`$CARGO_HOME/.cargo/config.toml` 配置文件](../reference/config.md) - 开发者可以自行控制其开发的默认设置

### 减少生成的调试信息量

建议：在您的 `Cargo.toml` 或 `.cargo/config.toml` 中添加以下配置：

```toml
[profile.dev.package."*"]
debug = false
```

这将： - 将 [`dev` 配置](](../reference/profiles.md#dev)（开发命令的默认设置）更改为： - 避免为依赖项生成任何 [调试信息](../reference/profiles.md#debug) - 在通过 [`--profile debug`](../reference/profiles.md#debug-profile)进行调试时提供可选选项

> **注意：** `dev` 配置默认设置为实现有效 panic 回溯追踪所需的设置

权衡点： - ✅ 代码生成更快（`cargo build`） - ✅ 链接时间更短 - ✅ `target` 目录的磁盘占用更小

### 使用替代的代码生成后端

Recommendation:

- 安装 Cranelift 代码生成后端 rustup 组件
    ```console
    $ rustup component add rustc-codegen-cranelift-preview --toolchain nightly
    ```
- 添加到你的 `Cargo.toml` 或 `.cargo/config.toml` 中：
    ```toml
    [profile.dev]
    codegen-backend = "cranelift"
    ```
- 使用 `-Z codegen-backend` 运行 Cargo，或在 `.cargo/config.toml` 中启用 [`codegen-backend`](../reference/unstable.md#codegen-backend) 功能。
- 这是必需的，因为目前这是一个不稳定的特性。

这将将 [`dev` 配置](](../reference/profiles.md#dev)更改为使用 [Cranelift 代码生成后端](https://github.com/rust-lang/rustc_codegen_cranelift) 来生成机器码，而不是默认的 LLVM 后端。Cranelift 后端应比 LLVM 更快地生成代码，从而提升构建性能。

权衡点： - ✅ 代码生成更快（`cargo build`） - ❌ **需要使用夜间版 Rust 和 [不稳定的 Cargo 特性][codegen-backend-特性]** - ❌ 生成的代码的运行时性能较差 - 加快了 `cargo test` 中的构建部分，但可能会增加测试执行时间 - ❌ 仅适用于 [某些目标](https://github.com/rust-lang/rustc_codegen_cranelift?tab=readme-ov-file#platform-support) - ❌ 可能不支持所有 Rust 特性（例如 unwinding）


### 启用实验性并行前端

建议：在 `.cargo/config.toml` 中添加：

```toml
[build]
rustflags = "-Zthreads=8"
```

此 [`rustflags`][build.rustflags] 将启用 Rust 编译器的 [parallel frontend][parallel-frontend-blog]，并指示其使用 `n` 个线程。`n` 的值应根据系统可用的核心数选择，尽管收益会逐渐减少。我们建议最多使用 `8` 个线程。

权衡点：- ✅ 构建时间更快（无论是 `cargo check` 还是 `cargo build`）- ❌ **需要使用最新版 Rust 和 [不稳定的 Rust 特性][parallel-frontend-issue]**


### 使用替代链接器

建议：安装并配置替代链接器，如 [LLD](https://lld.llvm.org/)、[mold](https://github.com/rui314/mold) 或 [wild](https://github.com/davidlattimore/wild)。例如，在 Linux 上配置 mold，可以在你的 `.cargo/config.toml` 中添加：

```toml
[target.'cfg(target_os = "linux")']
# mold, if you have GCC 12+
rustflags = ["-C", "link-arg=-fuse-ld=mold"]

# mold, otherwise
linker = "clang"
rustflags = ["-C", "link-arg=-fuse-ld=/path/to/mold"]
```

虽然依赖项可以并行构建，但所有依赖项的链接在构建结束时一次性完成，这可能会使链接过程占据大部分构建时间，尤其是在增量重建时。通常 Rust 使用的链接器已经相当快速，切换链接器的收益可能不值得，但并非总是如此。例如，`x86_64-unknown-linux-gnu` 之外的 Linux 目标仍然使用较慢的 Linux 系统链接器（更多细节请参见 [rust#39915](https://github.com/rust-lang/rust/issues/39915)）。

权衡点：- ✅ 链接时间更快 - ❌ 可能不支持所有用例，特别是如果你依赖 C 或 C++ 依赖项时

### 为整个工作空间启用特性

建议：在项目的 `.cargo/config.toml` 中添加相关配置

```toml
[resolver]
feature-unification = "workspace"
```

当调用 `cargo` 时，根据您选择的工作空间成员，[特性会被激活][resolver-features]。然而，在贡献到应用程序时，您可能需要构建和测试应用程序中的各种包，这可能会导致不必要的重新构建，因为不同的依赖项可能会同时被激活。通过 [`特性统一`][特性-unification]，您可以确保同一组依赖特性被激活，而无需考虑当前正在构建和测试的哪个包。

权衡点：- ✅ 在工作空间中构建不同包时减少重新构建次数 - ❌ **需要使用最新版本的 Rust 和 [不稳定的 Cargo 特性][特性-unification]** - ❌ 某个包激活的特性可能会掩盖其他应被激活但未被激活的包的漏洞 - ❌ 如果 `--workspace` 下的特性统一不起作用，则此方法也不会有效


## 减少生成的代码

### 移除未使用的依赖项

[`cargo::unused_dependencies`](../reference/lints.md#unused_dependencies) 能够识别大多数未使用的依赖项，误报率较低。

对于其他情况，定期审查隐藏的 [`cargo::unused_dependencies`]结果：
```console
$ CARGO_LOG=cargo::diagnostics::rules::unused_dependencies=debug cargo check --workspace --all-targets
```
这将显示潜在的未使用依赖项，包括 - 注册表和 git 依赖项 - 当您的 [`package.rust-version`]太旧无法使用时 `[lints.cargo]` - 当您的依赖项 *可能* 用于限制传递依赖的版本时（应改用 `[target."cfg(false)".dependencies]`） - 当您的依赖项 *可能* 用于激活传递依赖的特性时 - 您的 `[dev-dependencies]`，因为目前没有方法确保所有消费者都被构建

在修改代码时，很容易忽视某个依赖项不再被使用，从而可以将其移除。

权衡点：- ✅ 完整的构建和链接时间更快 - ❌ 从误报中识别未使用的依赖项需要额外努力


### 从依赖中移除未使用的特性

建议：定期使用 [cargo-features-manager](https://crates.io/crates/cargo-features-manager) 和 [cargo-unused-features](https://crates.io/crates/cargo-unused-features) 等第三方工具审查依赖中未使用的特性，以将其移除。

修改代码时，很容易忽视某个依赖的特性不再被使用并可以移除。这可以减少构建的传递依赖数量或减少构建的 crate 中的代码量。在移除特性时需要格外小心，因为这些特性可能用于期望的行为或性能改进，而这些点在编译或测试中并不总能明显看出。

权衡点：- ✅ 更快速的完整构建和链接时间 - ❌ 可能会错误地将特性标记为未使用

[codegen-backend-feature]: ../reference/unstable.md#codegen-backend
[parallel-frontend-blog]: https://blog.rust-lang.org/2023/11/09/parallel-rustc/
[parallel-frontend-issue]: https://github.com/rust-lang/rust/issues/113349
[build.rustflags]: ../reference/config.md#buildrustflags
[resolver-features]: ../reference/resolver.md#features
[feature-unification]: ../reference/unstable.md#feature-unification
[`cargo::unused_dependencies`]: ../reference/lints.md#unused_dependencies
[`package.rust-version`]: ../reference/rust-version.md
