# 配置文件

配置文件提供了一种调整编译器设置的方法，可以影响优化和调试符号等参数。

Cargo提供了4种内置配置文件：`dev`、`release`、`test`和`bench`。如果未在命令行中指定配置文件，系统会根据执行的命令自动选择相应的配置。除了内置配置文件外，还可以指定自定义的用户定义配置文件。

可以在 [`Cargo.toml`](清单.md)中的 `[profile]` 表格中更改配置文件设置。在每个命名配置文件中，可以通过键值对来修改各个设置。

```toml
[profile.dev]
opt-level = 1               # Use slightly better optimizations.
overflow-checks = false     # Disable integer overflow checks.
```

Cargo仅查看工作空间根目录下的 `Cargo.toml` 文件中的配置文件设置。依赖项中定义的配置文件设置将被忽略。

此外，配置文件也可以通过 [config] 定义进行覆盖。在配置文件或环境变量中指定配置文件将覆盖 `Cargo.toml` 中的设置。


## 配置文件设置

以下是可以在配置文件中控制的设置列表。

### opt-level

`opt-level` 设置控制 [`-C opt-level` 标志]，用于调整优化级别。较高的优化级别可能会使运行时代码更快，但会延长编译器运行时间。较高的级别还可能改变和重新安排编译后的代码结构，从而使其更难使用调试器。

有效的选项包括：

* `0`: 不进行优化 * `1`: 基本优化 * `2`: 部分优化 * `3`: 全部优化 * `"s"`: 优化以减小二进制大小 * `"z"`: 优化以减小二进制大小，同时关闭循环向量化。

建议尝试不同的优化级别，以找到适合项目的合适平衡。可能会出现意外结果，例如 `3` 级别的运行速度比 `2` 慢，或者 `"s"` 和 `"z"` 级别的大小不一定更小。随着 `rustc` 新版本的推出而改变优化行为，您也可能需要定期重新评估设置。

有关更高级的优化技术，请参阅 [Profile Guided Optimization]。


### debug

`debug` 设置控制 [`-C debuginfo` 标志]，该标志决定了编译后的二进制文件中包含的调试信息量。

有效的选项包括：

* `0`、`false` 或 `"none"`: 完全不包含调试信息，这是 [`release`](#release) 的默认设置 * `"line-directives-only"`: 仅包含行指令信息。对于 nvptx* 目标，此选项可启用[性能分析]。对于其他使用场景，`line-tables-only` 是更优且更兼容的选择。
* `"line-tables-only"`: 仅生成行表信息。它生成的调试信息最少，可用于回溯，但不包含文件名或行号信息，也不包含变量或函数参数信息。这是 [`dev`](#dev) 的默认设置。
* `1` 或 `"limited"`: 不包含类型或变量级别的信息。相比 `line-tables-only`，它生成更详细的模块级信息。
* `2`、`true` 或 `"full"`: 完整的调试信息，这是 [`debug`](#debug-profile) 的默认设置

有关每个选项的具体作用，请参阅 [rustc] 关于 [debuginfo] 的文档。

根据您的需求，您可能还需要配置 [`split-debuginfo`](#split-debuginfo) 选项。

> **MSRV:** `none`、`limited`、`full`、`line-directives-only` 和 `line-tables-only` 需要 1.71 版本。


### split-debuginfo

`split-debuginfo` 设置控制 [`-C split-debuginfo` 标志]，该标志决定生成的调试信息是放在可执行文件本身中还是紧邻其位置。

此选项为字符串类型，可接受的值与[编译器接受的值][`-C split-debuginfo` 标志]相同。对于其他情况下已启用调试信息的配置，在 macOS 上该选项的默认值为 `unpacked`。否则，该选项的默认值由[rustc文档说明][`-C split-debuginfo` 标志]并具有平台依赖性。某些选项仅可在[夜间频道]中使用。一旦进行更多测试，Cargo 的默认设置可能会发生变化，而 DWARF 支持也已稳定。

请注意，Cargo 和 rustc 对此选项的默认值不同。该选项的存在旨在让 Cargo 尝试不同的标志组合，从而提供更好的调试和开发体验。


### strip

`strip` 选项控制[`-C strip` 标志]，该标志指示 rustc 从二进制文件中移除符号或调试信息。可以通过以下方式启用：

```toml
[package]
# ...

[profile.release]
strip = "debuginfo"
```

`strip` 可能的字符串值为 `"none"`、`"debuginfo"` 和 `"symbols"`。默认值为 `"none"`。

您也可以使用布尔值 `true` 或 `false` 来配置此选项。`strip = true` 等同于 `strip = "symbols"`。`strip = false` 等同于 `strip = "none"`，会完全禁用 `strip`。


### debug-assertions

`debug-assertions` 设置控制[`-C debug-assertions` 标志]，该标志可以开启或关闭 `cfg(debug_assertions)` [条件编译]。调试断言旨在包含仅在调试/开发构建中可用的运行时验证。这些可能是在发布构建中过于昂贵或不希望包含的内容。调试断言使标准库中的 [`debug_assert!` 宏]得以启用。

有效的选项包括：

* `true`：开启 * `false`：关闭


### overflow-checks

`overflow-checks` 设置控制 [`-C overflow-checks` flag]，该标志用于控制[运行时整数溢出]的行为。当启用 overflow-checks 时，发生溢出时会引发 panic。

有效的选项包括：

* `true`: 启用 * `false`: 禁用


### lto

`lto` 设置控制 `rustc` 的 [`-C lto`]、[`-C linker-plugin-lto`] 和 [`-C embed-bitcode`]选项，这些选项控制 LLVM 的[链接时间优化]。LTO 可以生成更优化的代码，采用全程序分析技术，但代价是链接时间更长。

有效的选项包括：

* `true` 或 `"fat"`: 执行“fat” LTO，试图对依赖图中的所有 crates 进行优化。
* `"thin"`: 执行["thin" LTO]。这与“fat”类似，但运行时间大大缩短，同时仍能获得与“fat”相似的性能提升。
* `false`: 执行“thin local LTO”，仅对其[代码生成单元](#codegen-units)进行“thin” LTO。如果代码生成单元数为 1 或[优化级别](#opt-level)为 0，则不执行任何 LTO。
* `"off"`: 禁用 LTO。

如果您对跨语言 LTO 感兴趣，请参阅[linker-plugin-lto 章节]。目前 Cargo 尚未原生支持此功能，但可以通过 `RUSTFLAGS` 实现。


### panic

`panic` 设置控制着 [`-C panic` 标志]，该标志决定使用哪种崩溃处理策略。

有效的选项包括：

* `"unwind"`: 在崩溃时展开栈。
* `"abort"`: 在崩溃时终止进程。

当设置为 `"unwind"` 时，实际值取决于目标平台的默认设置。例如，NVPTX 平台不支持展开操作，因此始终使用 `"abort"`。

测试、基准测试、构建脚本和过程宏忽略 `panic` 设置。`rustc` 测试框架目前要求使用 `"unwind"` 行为。请参阅 [`panic-abort-tests`] 不稳定标志，该标志启用 `"abort"` 行为。

此外，当使用 `"abort"` 策略并构建测试时，所有依赖项也将被迫使用 `"unwind"` 策略进行编译。


### incremental

`incremental` 设置控制着 [`-C incremental` 标志]，该标志决定是否启用增量编译。增量编译使 `rustc` 将额外信息保存到磁盘，在重新编译 crate 时复用这些信息，从而缩短重新编译时间。这些额外信息存储在 `target` 目录中。

有效的选项包括：

* `true`: 启用 * `false`: 禁用

增量编译仅用于工作空间成员和“路径”依赖项。

可以通过 `CARGO_INCREMENTAL` [环境变量]或 [`build.incremental`] 配置变量全局覆盖增量值。


### codegen-units

`codegen-units` 设置控制着 [`-C codegen-units` 标志]，该标志决定一个 crate 将被拆分为多少个“代码生成单元”。更多的代码生成单元允许更多 crate 并行处理，可能缩短编译时间，但可能导致代码执行速度变慢。

此选项接受一个大于 0 的整数。

默认情况下，[增量](#incremental) 构建的参数为 256，非增量构建的参数为 16。


### rpath

`rpath` 设置控制 [`-C rpath` 标志]，该标志决定是否启用 [`rpath`。


### trim-paths

`trim-paths` 选项控制构建输出中路径清理的范围。路径根据这些 [重映射规则] 进行清理。

有效的选项包括：

- `"none"` —— 禁用路径清理。
- `"object"` —— 清理编译后的可执行文件和库中嵌入的路径。适用于减少对本地开发影响的同时提高产物可复现性。
- `"all"` —— 清理所有支持的位置中的路径。适用于需要产物和诊断信息独立于构建环境的密封或远程构建。

> [!WARNING]
> `"all"` 选项会重映射编译器诊断信息，包括 [编译器 JSON 消息](external-tools.md#json-messages)。某些重映射后的路径可能在本地文件系统中无法找到对应的文件，这可能会影响编辑器和其他工具对诊断输出的使用。

关于每个范围的详细信息，请参阅 rustc 的 [`--remap-path-scope`] 文档。

默认情况下，`trim-paths` 为 `"none"`，所有配置下的路径清理功能均被禁用。您可以在 `Cargo.toml` 中指定此选项来启用它：

```toml
[profile.dev]
trim-paths = "all"

[profile.release]
trim-paths = "object"
```


#### 重映射规则

具体的重映射路径前缀未指定，可能随 Cargo 版本变化。将产物中嵌入的路径回译到本地源文件的工具应使用 [unremap 文件]，而非解释这些前缀。


如果 `trim-paths` 不是 `"none"`，则在特定范围内出现的以下路径将被清理：

1. 标准库和核心库的源文件路径（sysroot）将以 `/rustc/<rustc commit hash>` 开头，例如 `/home/username/.rustup/toolchains/nightly-x86_64-unknown-linux-gnu/lib/rustlib/src/rust/library/core/src/result.rs` -> `/rustc/fe72845f7bb6a77b9e671e6a4f32fe714962cec4/library/core/src/result.rs`。
2. 工作区内的本地包路径将以 `.` 开头，替代工作区根目录，例如 `/home/username/crate/src/lib.rs` -> `./src/lib.rs`。这同样适用于位于工作区目录中的路径依赖。
3. 注册表依赖项的路径将以 `/cargo/registry/<registry id>` 开头，替代注册表的提取目录，例如 `/home/username/.cargo/registry/src/index.crates.io-6f17d22d3f0a95d1/foo-0.1.0/src/lib.rs` -> `/cargo/registry/6f17d22d3f0a95d1/foo-0.1.0/src/lib.rs`。
4. Git 依赖项的路径将以 `/cargo/git/<git source id>/<revision>` 开头，替代检查目录。`<revision>` 是锁文件中记录的解析后提交 ID的前缀。
5. 工作区外的路径依赖项将被替换为 `/cargo/deps/<package name>-<package version>`。
6. 构建目录中的路径，例如生成的 `OUT_DIR`，将以 `/cargo/build-dir` 开头。

`<registry id>` 和 `<git source id>` 是依赖项源代码的不可见稳定哈希值。

注册表或 Git 依赖项的预装副本通过文件位置进行净化，其方式类似于工作区目录中的工作区路径，或者像路径依赖那样处理。

#### 未映射文件

当 `object` 作用域处于活动状态且调试信息被启用时，Cargo 会在每个最终产物旁边写入一个未映射文件。该文件的目的是帮助调试器将净化后的路径替换回本地路径，例如通过 GDB 的 `set substitute-path` 或 LLDB 的 `target.source-map`。

Rust 工具链提供了 `rust-gdb` 和 `rust-lldb` 包装器，可以自动加载 unremap 文件。这种集成目前不稳定，仅适用于夜间版工具链。要启用它，分别设置 `RUST_GDB_TRIM_PATHS=unstable` 或 `RUST_LLDB_TRIM_PATHS=unstable`。

unremap 文件的名称以 `.trim-paths.json` 结尾。例如，你的 `my-app` 可执行文件会附带一个名为 `my-app.trim-paths.json` 的 unremap 文件。

unremap 文件采用 JSON 格式：

* `v` 表示格式版本。
* `rust_version` 和 `workspace_root` 是文件级元数据，即工具链版本和工作空间根目录。
* `remaps` 是一个记录数组。每个记录将工件中的清理后路径前缀（`from`）映射回其替换后的本地路径（`to`），并按 `from` 前缀排序。请注意，这遵循调试器的替换顺序，与 `--remap-path-prefix` 相反。

unremap 文件的一个示例：

```json
{
  "v": 1,
  "rust_version": "1.96.0-nightly",
  "workspace_root": "/home/me/app",
  "remaps": [
    { "from": ".", "to": "/home/me/app" },
    { "from": "/cargo/build-dir", "to": "/home/me/app/target" },
    { "from": "/cargo/registry/6f17d22d3f0a95d1", "to": "/home/me/.cargo/registry/src/index.crates.io-6f17d22d3f0a95d1" },
    { "from": "/rustc/abc123", "to": "/home/me/.rustup/toolchains/nightly/lib/rustlib/src/rust" }
  ]
}
```

由于它是作为调试辅助工具设计的，因此包含系统的绝对路径，因此无法保证工件隐私安全。在分发工件时，你可能希望排除 `*.trim-paths.json` 文件。

#### 限制

`trim-paths` 以尽力程度支持源路径前缀的重新映射。链接器可能会添加 rustc 无法重新映射的路径。更多详情请参阅 [rustc 文档中的限制部分][remap-limitation]。

例如，在 macOS 上，当启用调试信息时，链接器会生成包含对象文件绝对路径的 OSO 条目。以下配置将这些路径排除在可执行文件中，同时将调试信息保存在单独的 dSYM 包中：

```toml
[profile.release]
debug = true
trim-paths = "object"
split-debuginfo = "packed"
strip = "debuginfo"
```

dSYM 包可用于调试，但它仍然包含绝对路径。


## 默认配置

### dev

`dev` 配置用于常规开发。它是如 [`cargo build`] 这样的构建命令的默认设置，也用于 `cargo install --profile dev`。

`dev` 配置的默认设置为：

```toml
[profile.dev]
opt-level = 0
debug = "line-tables-only"
split-debuginfo = '...'  # Platform-specific.
strip = "none"
debug-assertions = true
overflow-checks = true
lto = false
panic = 'unwind'
incremental = true
codegen-units = 256
rpath = false
trim-paths = "none"
```

### debug {#debug-profile}

`debug` 配置用于生成可运行在调试器中的二进制文件。该配置通过 `cargo build --profile debug` 和 `cargo install --debug` 使用。

`debug` 配置的默认设置如下：

```toml
[profile.debug]
inherits = "dev"
debug = true
```

### release

`release` 配置适用于用于发布和生产环境的优化后的产物。当使用 `--release` 标志时，将使用此配置，并且是 [`cargo install`] 的默认配置。

`release` 配置的默认设置如下：

```toml
[profile.release]
opt-level = 3
debug = false
split-debuginfo = '...'  # Platform-specific.
strip = "none"
debug-assertions = false
overflow-checks = false
lto = false
panic = 'unwind'
incremental = false
codegen-units = 16
rpath = false
trim-paths = "none"
```

### test

`test` 配置是 [`cargo test`] 使用的默认配置。

`test` 配置的默认设置如下：

```toml
[profile.test]
inherits = "dev"
```

### bench

`bench` 配置是 [`cargo bench`] 使用的默认配置。

`bench` 配置的默认设置如下：

```toml
[profile.bench]
inherits = "release"
```

### Build Dependencies

为了快速编译，所有配置默认都不优化构建依赖项（构建脚本、过程宏及其依赖项），并且当构建依赖项不作为运行时依赖项使用时，不会计算调试信息。构建覆盖的默认设置如下：

```toml
[profile.dev.build-override]
opt-level = 0
codegen-units = 256
debug = false # when possible

[profile.release.build-override]
opt-level = 0
codegen-units = 256
```

然而，如果运行构建依赖项时出现错误，开启完整的调试信息可以改善回溯和调试能力：

```toml
debug = true
```

否则，构建依赖项将继承当前使用的活动配置的设置，如 [Profile selection](#profile-selection) 所述。

## 自定义配置

除了内置配置外，还可以定义额外的自定义配置。这些配置对于设置多种工作流和构建模式非常有用。在定义自定义配置时，必须指定 `inherits` 键，以说明当未指定时该配置从哪个配置继承设置。

例如，如果您想比较普通发布构建与带有 [LTO](#lto) 优化发布的构建，可以在 `Cargo.toml` 中指定如下内容：

```toml
[profile.release-lto]
inherits = "release"
lto = true
```

然后可以使用 `--profile` 标志来选择此自定义配置：

```console
cargo build --profile release-lto
```

每个配置文件的输出结果将存放在与配置文件同名的目录中，位于 [`target` 目录]里。如上述示例所示，输出结果将存储于 `target/release-lto` 目录中。


## 配置文件选择

使用的配置文件取决于命令、命令行标志（如 `--release` 或 `--profile`）以及包（在 [覆盖](#overrides) 的情况下）。如果没有指定默认配置文件，则使用以下配置：

| Command | Default Profile |
|---------|-----------------|
| [`cargo run`], [`cargo build`],<br>[`cargo check`], [`cargo rustc`] | [`dev` profile](#dev) |
| [`cargo test`] | [`test` profile](#test)
| [`cargo bench`] | [`bench` profile](#bench)
| [`cargo install`] | [`release` profile](#release)

你可以使用 `--profile=NAME` 选项切换为不同的配置文件，该选项将采用指定的配置文件。 `--release` 标志等同于 `--profile=release`。

所选配置文件适用于所有 Cargo 目标，包括 [库](./cargo-targets.md#library)、[二进制文件](./cargo-targets.md#binaries)、[示例](./cargo-targets.md#examples)、[测试](./cargo-targets.md#tests)和 [基准测试](./cargo-targets.md#benchmarks)。

特定包的配置文件可以通过 [覆盖](#overrides) 来指定，具体说明如下。


## 覆盖

对于特定包和构建时 crate，可以覆盖配置文件设置。要覆盖特定包的设置，请使用 `package` 表格来更改该命名包的设置：

```toml
# The `foo` package will use the -Copt-level=3 flag.
[profile.dev.package.foo]
opt-level = 3
```

包名称实际上是一个 [包 ID Spec](pkgid-spec.md)，因此你可以使用类似 `[profile.dev.package."foo:2.1.0"]` 的语法来指定包的特定版本。

要覆盖所有依赖项的设置（但排除工作空间成员），请使用 `"*"` 包名：

```toml
# Set the default for dependencies.
[profile.dev.package."*"]
opt-level = 2
```

要覆盖构建脚本、过程宏及其依赖项的设置，请使用 `build-override` 表格：

```toml
# Set the settings for build scripts and proc-macros.
[profile.dev.build-override]
opt-level = 3
```

> [!NOTE]
> 当某个依赖项同时是普通依赖项和构建依赖项时，如果未指定 `--target` 参数，Cargo 会尝试只构建一次。使用 `build-override` 时，该依赖项可能需要被构建两次：一次作为普通依赖项，一次采用覆盖的构建设置。这可能会增加初始构建时间。

使用哪个值取决于以下优先级顺序（先匹配到第一个即为准）：

1. `[profile.dev.package.name]` --- 具有名称的包。
2. `[profile.dev.package."*"]` --- 适用于所有非工作空间成员。
3. `[profile.dev.build-override]` --- 仅适用于构建脚本、过程宏及其依赖项。
4. `[profile.dev]` --- `Cargo.toml` 中的设置。
5. Cargo 内置的默认值。

覆盖设置不能指定 `panic`、`lto` 或 `rpath` 设置。

### 覆盖和泛型

泛型代码被实例化的位置会影响该泛型代码使用的优化设置。当使用配置覆盖来更改特定 crate 的优化级别时，可能会出现微妙的交互问题。如果您尝试提高定义泛型函数的依赖项的优化级别，这些泛型函数在您的本地 crate 中使用时可能不会被优化。这是因为代码可能在实例化它的 crate 中被生成，因此会采用该 crate 的优化设置。

例如，`[nalgebra]` 是一个定义了向量和矩阵的库，大量使用泛型参数。如果您当地的代码定义了具体的 nalgebra 类型，如 `Vector4<f64>` 并使用了它们的方法，相应的 nalgebra 代码将在您的 crate 中被实例化和构建。因此，如果您尝试通过配置覆盖提高 `nalgebra` 的优化级别，可能并不会带来更快的性能提升。

进一步复杂化这个问题的是，`rustc` 有一些优化机制，它会尝试在 crate 之间共享单态化的泛型类型。如果优化级别为 2 或 3，那么一个 crate 不会使用来自其他 crate 的单态化泛型，也不会导出本地定义的单态化项以与其他 crate 共享。在尝试优化依赖项进行开发时，可以考虑使用优化级别为 1 的方式，这种方式会应用一些优化，同时仍允许单态化项被共享。

[config]: config.md
[`-C opt-level` flag]: ../../rustc/codegen-options/index.html#opt-level
[Profile Guided Optimization]: ../../rustc/profile-guided-optimization.html
[`-C debuginfo` flag]: ../../rustc/codegen-options/index.html#debuginfo
[debuginfo]: ../../rustc/codegen-options/index.html#debuginfo
[profiling]: https://reviews.llvm.org/D46061
[nightly channel]: ../../book/appendix-07-nightly-rust.html
[`-C split-debuginfo` flag]: ../../rustc/codegen-options/index.html#split-debuginfo
[`-C strip` flag]: ../../rustc/codegen-options/index.html#strip
[`-C debug-assertions` flag]: ../../rustc/codegen-options/index.html#debug-assertions
[conditional compilation]: ../../reference/conditional-compilation.md#debug_assertions
[`debug_assert!` macro]: ../../std/macro.debug_assert.html
[`-C overflow-checks` flag]: ../../rustc/codegen-options/index.html#overflow-checks
[runtime integer overflow]: ../../reference/expressions/operator-expr.md#overflow
[`-C lto`]: ../../rustc/codegen-options/index.html#lto
[link time optimizations]: https://llvm.org/docs/LinkTimeOptimization.html
[`-C linker-plugin-lto`]: ../../rustc/codegen-options/index.html#linker-plugin-lto
[`-C embed-bitcode`]: ../../rustc/codegen-options/index.html#embed-bitcode
[linker-plugin-lto chapter]: ../../rustc/linker-plugin-lto.html
["thin" LTO]: http://blog.llvm.org/2016/06/thinlto-scalable-and-incremental-lto.html
[`-C panic` flag]: ../../rustc/codegen-options/index.html#panic
[`panic-abort-tests`]: unstable.md#panic-abort-tests
[`-C incremental` flag]: ../../rustc/codegen-options/index.html#incremental
[environment variable]: environment-variables.md
[`build.incremental`]: config.md#buildincremental
[`-C codegen-units` flag]: ../../rustc/codegen-options/index.html#codegen-units
[`-C rpath` flag]: ../../rustc/codegen-options/index.html#rpath
[`rpath`]: https://en.wikipedia.org/wiki/Rpath
[`--remap-path-scope`]: ../../rustc/remap-source-paths.html#--remap-path-scope
[remapping rules]: #remapping-rules
[unremap files]: #unremap-files
[remap-limitation]: ../../rustc/remap-source-paths.html#caveats-and-limitations
[`target` directory]: build-cache.md
[`cargo bench`]: ../commands/cargo-bench.md
[`cargo build`]: ../commands/cargo-build.md
[`cargo check`]: ../commands/cargo-check.md
[`cargo install`]: ../commands/cargo-install.md
[`cargo run`]: ../commands/cargo-run.md
[`cargo rustc`]: ../commands/cargo-rustc.md
[`cargo test`]: ../commands/cargo-test.md
[nalgebra]: https://crates.io/crates/nalgebra
