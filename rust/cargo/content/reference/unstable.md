# 不稳定的功能

实验性 Cargo 功能仅在 [夜间频道] 上可用。建议您尝试这些功能，看看它们是否符合您的需求，是否存在问题或故障。请查看下面列出的跟踪问题以了解有关该功能的更多信息，如果您希望获得未来更新，请点击 GitHub 订阅按钮。

经过一段时间后，如果该功能没有重大问题，它可以被 [稳定化]，当当前夜间发布达到稳定频道时，它将出现在稳定版本中（大约需要6到12周的时间）。

根据功能的工作方式，有三种不同的方法可以启用不稳定功能：

* `Cargo.toml` 中的新语法需要在 `Cargo.toml` 的表之前添加 `cargo-features` 键。例如：

  ```toml
  # This specifies which new Cargo.toml features are enabled.
  cargo-features = ["test-dummy-unstable"]

  [package]
  name = "my-package"
  version = "0.1.0"
  im-a-teapot = true  # This is a new option enabled by test-dummy-unstable.
  ```

* 新的命令行标志、选项和子命令需要包含 `-Z unstable-options` CLI 选项。例如，新的 `--artifact-dir` 选项仅在夜间频道上可用：

  ```cargo +nightly build --artifact-dir=out -Z unstable-options```

* `-Z` command-line flags are used to enable new functionality that may not
  have an interface, or the interface has not yet been designed, or for more
  complex features that affect multiple parts of Cargo. For example, the
  [mtime-on-use](#mtime-on-use) feature can be enabled with:

  ```cargo +nightly build -Z mtime-on-use```

  运行 `cargo -Z help` 可以查看可用的标志列表。

  任何可以通过 `-Z` 标志配置的内容也可以在 cargo [配置文件](`.cargo/config.toml)` 的 `unstable` 表中设置。例如：

  ```toml
  [unstable]
  mtime-on-use = true
  build-std = ["core", "alloc"]
  ```

下面描述的每个新功能都应说明如何使用它们。

*对于最新的夜间版本，请参阅此页面的 [夜间版本] 部分。*


## 不稳定功能列表

* 不稳定的特定功能 * [-Z allow-features](#allow-features) --- 提供了一种限制使用哪些不稳定功能的方法。
* 构建脚本和链接 * [Metabuild](#metabuild) --- 提供声明式构建脚本。
* [Multiple Build Scripts](#multiple-build-scripts) --- 允许使用多个构建脚本。
* [Any Build Script Metadata](#any-build-script-metadata) --- 允许任何构建脚本通过 `cargo::metadata=key=value` 指定环境变量。
* 解析器和功能 * [no-index-update](#no-index-update) --- 防止 cargo 更新索引缓存。
* [avoid-dev-deps](#avoid-dev-deps) --- 在解析过程中防止包含开发依赖项。
* [minimal-versions](#minimal-versions) --- 强制解析器使用最低兼容版本而非最高版本。
* [direct-minimal-versions](#direct-minimal-versions) — 强制解析器使用最低兼容版本而非最高版本。
* [public-依赖](#public-依赖) --- 允许将依赖项分类为公共或私有。
* [msrv-policy](#msrv-policy) --- 具备 MSRV 意识的解析器和版本选择工具。
* [prerelease](#prerelease) --- 允许使用 `update --precise` 选择预发布版本。
* [sbom](#sbom) --- 为编译后的工件生成 SBOM 前导文件。
* [特性-unification](#特性-unification) --- 在工作区中启用新的功能统一模式。
* [锁文件-publish-time](#锁文件-publish-time) --- 限制解析器仅处理指定时间之前的包。
* 输出行为 * [artifact-dir](#artifact-dir) --- 添加用于复制工件的目录。
* [Different binary name](#different-binary-name) --- 为构建的二进制文件分配一个与 crate 名称不同的名称。
* [root-dir](#root-dir) --- 控制路径输出的相对于根目录的位置。
* 编译行为 * [mtime-on-use](#mtime-on-use) --- 每次使用依赖项时更新其最后修改时间戳，从而提供删除未使用工件的机制。
* [build-std](#build-std) --- 构建标准库而非使用预构建二进制文件。
* [build-std-features](#build-std-features) --- 设置与标准库一起使用的功能。
* [binary-dep-depinfo](#binary-dep-depinfo) --- 使依赖信息文件跟踪二进制依赖项。
* [checksum-freshness](#checksum-freshness) --- 当传递此选项时，决定是否重建 crate 是通过文件校验和而非文件 mtime 来决定的。
* [panic-abort-tests](#panic-abort-tests) --- 允许使用“abort”恐慌策略运行测试。
* [host-config](#host-config) --- 允许为主机构建目标设置类似 `[target]` 的配置设置。
* [embed-metadata](#embed-metadata) --- 设置为 `no` 时，cargo 会将 `-Zembed-metadata=no` 传递给编译器，从而避免将元数据嵌入 rlib 和 dylib 工件中，以节省磁盘空间。
* [目标-applies-to-host](#目标-applies-to-host) --- 改变某些标志是否传递至主机构建目标。
* [gc](#gc) --- 全局缓存垃圾收集。
* [open-namespaces](#open-namespaces) --- 允许多个包参与同一 API 命名空间。
* [panic-immediate-abort](#panic-immediate-abort) --- 将 `-Cpanic=immediate-abort` 传递给编译器。
* [compile-time-deps](#compile-time-deps) --- rust-analyzer 的永久不稳定功能。
* [fine-grain-locking](#fine-grain-locking) --- 使用细粒度锁定而非锁定整个构建缓存。
* [json-目标-spec](#json-目标-spec) --- 允许使用 `.json` 自定义目标规范。
* [hint-msrv](#hint-msrv) --- 允许 Cargo 设置 `-Zhint-msrv`。
* [mem-stats](#mem-stats) --- 在 `--timings` 中报告每个构建单元的峰值内存使用情况。
* rustdoc * [rustdoc-map](#rustdoc-map) --- 提供将文档链接到外部站点（如 [docs.rs](https://docs.rs/)）的映射。
* [scrape-examples](#scrape-examples) --- 在文档中显示示例。
* [output-format](#output-format-for-rustdoc) --- 允许文档也以实验性的 [JSON 格式](https://doc.rust-lang.org/nightly/nightly-rustc/rustdoc_json_types/) 输出。
* [rustdoc-depinfo](#rustdoc-depinfo) --- 在 rustdoc 重建检测中使用依赖信息文件。
* [rustdoc-mergeable-info](#rustdoc-mergeable-info) --- 使用 rustdoc 可合并的跨 crate 信息文件。
* `Cargo.toml` 扩展 * [Profile `rustflags` option](#profile-rustflags-option) --- 直接传递给 rustc。
* [Profile `hint-mostly-unused` option](#profile-hint-mostly-unused-option) --- 提示依赖项大部分未使用，以优化编译时间。
* [包 `min-opt-level` hint](#包-min-opt-level-hint) --- 请求一个包的数值优化下限。
* [codegen-backend](#codegen-backend) --- 选择 rustc 使用的代码生成后端。
* [per-包-目标](#per-包-目标) --- 设置每个单独包使用的 `--target`。
* [artifact dependencies](#artifact-dependencies) --- 允许将构建工件包含到其他构建工件中，并为不同目标构建它们。
* [path bases](#path-bases) --- 为路径依赖项指定的基础目录名称。
* [特性-metadata](#特性-metadata) --- 功能定义的表格语法。
* [`unstable-editions`](#unstable-editions) --- 允许使用尚未稳定的版本。
* [builtin-dependencies](#builtin-dependencies) --- 允许指定对标准库 crate 的依赖项。
* 信息和元数据 * [unit-graph](#unit-graph) --- 输出 Cargo 内部图结构的 JSON 数据。
* [`cargo rustc --print`](#rustc---print) --- 使用 `--print` 调用 rustc 以显示来自 rustc 的信息。
* [Build analysis](#build-analysis) --- 记录并保存每次运行中的详细构建指标，并提供新命令用于查询过去的构建。
* [`rustc-unicode`](#rustc-unicode) --- 在 Cargo 的错误消息中启用 `rustc` 的 unicode 错误格式。
* [`term-graphics`](#term-graphics) --- 控制其终端输出中的图形显示。
* 配置 * [`cargo config`](#cargo-config) --- 添加一个新的子命令用于查看配置文件。
* 注册表 * [publish-timeout](#publish-timeout) --- 控制上传 crate 与在索引中可用之间的超时时间。
* 其他 * [gitoxide](#gitoxide) --- 使用 `gitoxide` 而非 `git2` 执行一组操作。
* [script](#script) --- 支持单文件 `.rs` 包。
* [native-completions](#native-completions) --- 将 cargo shell 补全功能迁移为原生补全功能。
* [包 message format](#包-message-format) --- `cargo package` 的消息格式。
* [`fix-edition`](#fix-edition) --- 一个永久不稳定的版本迁移辅助工具。
* [Plumbing subcommands](https://github.com/crate-ci/cargo-plumbing) --- 作为 Cargo API 的低级命令，如 `cargo metadata`。

## allow-features

此永久不稳定的标志使得只能使用列出的不稳定特性。具体来说，如果您传递 `-Zallow-features=foo,bar`，您仍然可以向 `cargo` 传递 `-Zfoo` 和 `-Zbar`，但无法传递 `-Zbaz`。您可以传递空字符串 (`-Zallow-features=`) 来禁止所有不稳定的特性。

`-Zallow-features` 还限制了哪些不稳定特性可以被传递给 `Cargo.toml` 中的 `cargo-features` 条目。例如，如果您希望允许

```toml
cargo-features = ["test-dummy-unstable"]
```

其中 `test-dummy-unstable` 是不稳定的，那么这些特性也将被 `-Zallow-features=` 禁止，而通过 `-Zallow-features=test-dummy-unstable` 则允许使用。

传递给 cargo 的 `-Zallow-features` 的特性列表也会被 cargo 调用的所有 Rust 工具（如 `rustc` 或 `rustdoc`）接收。因此，如果您运行 `cargo -Zallow-features=`，则无法使用任何不稳定的 Cargo 或 Rust 特性。

## no-index-update * 原始问题： [#3479](https://github.com/rust-lang/cargo/issues/3479) * 跟踪问题： [#7404](https://github.com/rust-lang/cargo/issues/7404)

`-Z no-index-update` 标志确保 Cargo 不尝试更新注册表索引。这是为像 Crater 这样的工具设计的，这些工具会发出许多 Cargo 命令，您希望避免每次更新索引时的网络延迟。

## mtime-on-use * 原始问题： [#6477](https://github.com/rust-lang/cargo/pull/6477) * 缓存使用元数据跟踪问题： [#7150](https://github.com/rust-lang/cargo/issues/7150)

`-Z mtime-on-use` 标志是一个实验性功能，旨在让 Cargo 更新已使用文件的 mtime，以便像 cargo-sweep 这样的工具能够更容易地识别哪些文件已经过时。对于许多工作流来说，这需要在所有 cargo 调用中设置此选项。为了使其更实用，可以在 `.cargo/config.toml` 中设置 `unstable.mtime_on_use` 标志或相应的 ENV 变量，这样就会将 `-Z mtime-on-use` 应用于所有夜间版 cargo 的调用。（稳定版本会忽略此配置标志）

## avoid-dev-deps * 原始问题： [#4988](https://github.com/rust-lang/cargo/issues/4988) * 跟踪问题： [#5133](https://github.com/rust-lang/cargo/issues/5133)

当运行 `cargo install` 或 `cargo build` 等命令时，即使未使用开发依赖，Cargo 目前仍要求下载这些依赖。`-Z avoid-dev-deps` 标志允许 Cargo 在不需要时避免下载开发依赖。`Cargo.lock` 文件在跳过开发依赖时会不会被生成。

## minimal-versions * 原始问题： [#4100](https://github.com/rust-lang/cargo/issues/4100) * 跟踪问题： [#5657](https://github.com/rust-lang/cargo/issues/5657)

> [!WARNING]
> 不建议使用此功能。由于它强制所有传递依赖项遵循最小版本要求，但其实用性有限，因为并非所有外部依赖都声明了适当的较低版本界限。预计将来会修改此功能，仅对直接依赖项强制执行最小版本要求。

当生成 `Cargo.lock` 文件时，`-Z minimal-versions` 标志会将依赖项解析为满足需求的最低 SemVer 版本（而非最高版本）。

该标志的预期用途是在持续集成过程中检查 `Cargo.toml` 中指定的版本是否准确反映了您实际使用的所有最小版本。也就是说，如果 `Cargo.toml` 声明 `foo = "1.0.0"，则不会意外地依赖仅在 `foo 1.5.0` 中添加的功能。

## direct-minimal-versions * 原始问题： [#4100](https://github.com/rust-lang/cargo/issues/4100) * 跟踪问题： [#5657](https://github.com/rust-lang/cargo/issues/5657)

当生成 `Cargo.lock` 文件时，`-Z direct-minimal-versions` 标志会将依赖项解析为仅对直接依赖项满足需求的最低 SemVer 版本（而非最高版本）。

此标志的预期使用场景是在持续集成过程中，检查 Cargo.toml 中指定的版本是否真实反映了您实际使用的下限版本。也就是说，如果 Cargo.toml 中写有 `foo = "1.0.0"，则不会意外地依赖仅在 `foo 1.5.0` 中添加的功能。

间接依赖会像正常情况一样被解析，以避免因最小版本验证而受阻。

## artifact-dir * 原始问题： [#4875](https://github.com/rust-lang/cargo/issues/4875) * 跟踪问题： [#6790](https://github.com/rust-lang/cargo/issues/6790)

此功能允许您指定构建后的工件将被复制到的目录。通常，工件仅被写入 `target/release` 或 `target/debug` 目录中。然而，确定准确的文件名可能很棘手，因为需要解析 JSON 输出。`--artifact-dir` 标志使得访问工件更加可预测。请注意，工件会被复制，因此原始文件仍保存在 `target` 目录中。示例：

```sh
cargo +nightly build --artifact-dir=out -Z unstable-options
```

这也可以在 `.cargo/config.toml` 文件中指定。

```toml
[build]
artifact-dir = "out"
```

## root-dir * 原始问题： [#9887](https://github.com/rust-lang/cargo/issues/9887) * 跟踪问题： None（目前未计划稳定化）

`-Zroot-dir` 标志设置了路径打印所基于的根目录。这影响诊断信息以及 `file!()` 宏发出的路径。

## Metabuild * 跟踪问题： [rust-lang/rust#49803](https://github.com/rust-lang/rust/issues/49803) * RFC： [#2196](https://github.com/rust-lang/rfcs/blob/master/text/2196-metabuild.md)

Metabuild 是一种用于声明式构建脚本的功能。您无需编写 `build.rs` 脚本，而是在 Cargo.toml 中的 `metabuild` 键中指定一系列构建依赖项。系统会自动生成一个构建脚本，该脚本按顺序运行每个构建依赖项。Metabuild 包随后可以从 Cargo.toml 读取元数据以指定其行为。

在 `Cargo.toml` 的顶部包含 `cargo-features`，在 `package` 中设置 `metabuild` 键，在 `build-dependencies` 中列出依赖项，并在 `package.metadata` 中添加 metabuild 包所需的任何元数据。示例：

```toml
cargo-features = ["metabuild"]

[package]
name = "mypackage"
version = "0.0.1"
metabuild = ["foo", "bar"]

[build-dependencies]
foo = "1.0"
bar = "1.0"

[package.metadata.foo]
extra-info = "qwerty"
```

Metabuild 包应包含一个名为 `metabuild` 的公共函数，该函数执行与常规 `build.rs` 脚本相同的操作。

## 多个构建脚本 * 跟踪问题: [#14903](https://github.com/rust-lang/cargo/issues/14903) * 原始拉取请求: [#15630](https://github.com/rust-lang/cargo/pull/15630)

“多个构建脚本”功能允许你在包中拥有多个构建脚本。

在 `Cargo.toml` 的顶部包含 `cargo-features`，并添加 `multiple-build-scripts` 以启用该功能。将构建脚本的路径作为数组添加到 `package.build` 中。例如：

```toml
cargo-features = ["multiple-build-scripts"]

[package]
name = "mypackage"
version = "0.0.1"
build = ["foo.rs", "bar.rs"]
```

**访问输出目录**：每个构建脚本的输出目录可以通过使用 `<script-name>_OUT_DIR` 来访问，其中 `<script-name>` 是构建脚本的文件名，保持原样。例如，对于位于 `foo/bar.rs` 的脚本，其路径为 `bar_OUT_DIR`。（仅在编译期间设置，可通过 `env!` 宏访问）

## 任何构建脚本元数据 * 跟踪问题: [#14903](https://github.com/rust-lang/cargo/issues/3544)

允许任何构建脚本通过 `cargo::metadata=key=value` 指定环境变量。

依赖构建脚本可以在运行时读取 `CARGO_DEP_<dep>_<key>` 环境变量来访问这些键/值对。对于具有 `links` 的包的构建脚本，将同时设置 `DEP_<links>_<key>` 和 `CARGO_DEP_<dep>_<key>`。

请注意，`CARGO_DEP_<dep>_<key>` 中的 `dep` 和 `key` 会被大写，而连字符 (`-`) 会被替换为下划线 (`_`)。

## public-依赖 * 跟踪问题: [#44663](https://github.com/rust-lang/rust/issues/44663)

“public-依赖”功能允许将依赖项标记为“公共”或“私有”。当此功能被启用时，额外的信息会被传递给 rustc，以便 [exported_private_dependencies](../../rustc/lints/listing/warn-by-default.html#exported-private-dependencies) 检查能够正常运作。

要启用此功能，您可以使用 `-Zpublic-dependency`

```sh
cargo +nightly run -Zpublic-dependency
```

或 `[不稳定]` 表格，例如，

```toml
# .cargo/config.toml
[unstable]
public-dependency = true
```

`public-dependency` 也可以在 `cargo-features` 中启用，**尽管这一选项已过时且即将被移除**。

```toml
cargo-features = ["public-dependency"]

[dependencies]
my_dep = { version = "1.2.3", public = true }
private_dep = "2.0.0" # Will be 'private' by default
```

文档更新： - 对于工作区的“`dependencies` 表格”部分，将 `public` 作为 `workspace.dependencies` 的一个不支持字段包含进来 - 使用 `public` 所需的 MSRV 版本为 1.83（参见 [#14507](https://github.com/rust-lang/cargo/pull/14507)）

## msrv-policy - [RFC: MSRV-aware Resolver](https://rust-lang.github.io/rfcs/3537-msrv-resolver.html) - [#9930](https://github.com/rust-lang/cargo/issues/9930) (MSRV-aware resolver)

这是针对 [RFC 2495](https://github.com/rust-lang/rfcs/pull/2495) 中 MSRV-aware cargo 功能的通用不稳定特性。

### MSRV-aware cargo add

该功能在 1.79 版本中已稳定，详见 [#13608](https://github.com/rust-lang/cargo/pull/13608)。

### MSRV-aware resolver

该功能在 1.84 版本中已稳定，详见 [#14639](https://github.com/rust-lang/cargo/pull/14639)。

### 将 `incompatible_toolchain` 错误转换为 lint

Unimplemented

### `--update-rust-version` 标志用于 `cargo add` 和 `cargo update`

Unimplemented

### `package.rust-version = "toolchain"`

Unimplemented

### 更新 `cargo new` 模板以设置 `package.rust-version = "toolchain"`

Unimplemented

## prerelease

* 跟踪问题： [#13290](https://github.com/rust-lang/cargo/issues/13290) * RFC： [#3493](https://github.com/rust-lang/rfcs/pull/3493)

`-Zprerelease` 标志允许使用 `update --precise` 选择预发布版本，即使项目的 `Cargo.toml` 中没有指定预发布版本。

以这个 `Cargo.toml` 为例。

```toml
[dependencies]
my-dependency = "0.1.1"
```

可以通过 `update -Zprerelease my-dependency --precise 0.1.2-pre.0` 将 `my-dependency` 更新到预发布版本。因为 `0.1.2-pre.0` 被认为与 `0.1.1` 兼容。无法以相同方式从 `0.1.1` 升级到 `0.2.0-pre.0`。后续的 `cargo` 命令也必须传递 `-Zprerelease` 以保持预发布版本锁定状态。如果没有该标志，Cargo 会再次认为 `0.1.2-pre.0` 与 `0.1.1` 不兼容，可能会将 `my-dependency` 降级回 `0.1.1`，或者出现解析错误。

当匹配 `[patch]` 条目与依赖项要求时，也适用相同的预发布版本匹配规则。

## sbom * 跟踪问题： [#13709](https://github.com/rust-lang/cargo/pull/13709) * RFC： [#3553](https://github.com/rust-lang/rfcs/pull/3553)

`sbom` 构建配置允许生成所谓的 SBOM 前导文件，与每个编译后的产物一起。软件物料清单 (SBOM) 工具可以整合这些生成的文件，以收集从 cargo 构建过程中难以或无法通过其他方式获得的关键信息。

要启用此功能，可以在 `.cargo/config.toml` 中设置 `sbom` 字段，或者将 `CARGO_BUILD_SBOM` 环境变量设置为 `true`。该功能可通过 `-Z sbom` 标志使用。

```toml
[unstable]
sbom = true

[build]
sbom = true
```

生成的输出文件采用 JSON 格式，遵循 `<artifact>.cargo-sbom.json` 的命名规范。JSON 文件包含关于依赖项、目标、特性以及使用的 `rustc` 编译器的信息。

生成的输出文件为 JSON 格式，遵循 `<artifact>.cargo-sbom.json` 的命名规则。JSON 文件包含有关依赖项、目标、特性和所使用的 `rustc` 编译器的信息。

所有可执行和可链接的输出产物如果被上传到目标或产物目录中，都会生成 SBOM 前导文件。

### Cargo 为 crates 设置的环境变量

* `CARGO_SBOM_PATH` -- 由平台 PATH 分隔符分隔的生成的 SBOM 前导文件列表。可以使用 `std::env::split_paths` 拆分该列表。

### SBOM 前导文件格式

```json5
{
  // Schema version.
  "version": 1,
  // Index into the crates array for the root crate.
  "root": 0,
  // Array of all crates. There may be duplicates of the same crate if that
  // crate is compiled differently (different opt-level, features, etc).
  "crates": [
    {
      // Fully qualified package ID specification
      "id": "path+file:///sample-package#0.1.0",
      // List of target kinds: bin, lib, rlib, dylib, cdylib, staticlib, proc-macro, example, test, bench, custom-build
      "kind": ["bin"],
      // Enabled feature flags.
      "features": [],
      // Dependencies for this crate.
      "dependencies": [
        {
          // Index in to the crates array.
          "index": 1,
          // Dependency kind:
          // Normal: A dependency linked to the artifact produced by this crate.
          // Build: A compile-time dependency used to build this crate (build-script or proc-macro).
          "kind": "normal"
        },
        {
          // A crate can depend on another crate with both normal and build edges.
          "index": 1,
          "kind": "build"
        }
      ]
    },
    {
      "id": "registry+https://github.com/rust-lang/crates.io-index#zerocopy@0.8.16",
      "kind": ["bin"],
      "features": [],
      "dependencies": []
    }
  ],
  // Information about rustc used to perform the compilation.
  "rustc": {
    // Compiler version
    "version": "1.86.0-nightly",
    // Compiler wrapper
    "wrapper": null,
    // Compiler workspace wrapper
    "workspace_wrapper": null,
    // Commit hash for rustc
    "commit_hash": "bef3c3b01f690de16738b1c9f36470fbfc6ac623",
    // Host target tuple
    "host": "x86_64-pc-windows-msvc",
    // Verbose version string: `rustc -vV`
    "verbose_version": "rustc 1.86.0-nightly (bef3c3b01 2025-02-04)\nbinary: rustc\ncommit-hash: bef3c3b01f690de16738b1c9f36470fbfc6ac623\ncommit-date: 2025-02-04\nhost: x86_64-pc-windows-msvc\nrelease: 1.86.0-nightly\nLLVM version: 19.1.7\n"
  }
}
```

## build-std * 跟踪仓库： <https://github.com/rust-lang/wg-cargo-std-aware>

`build-std` 功能使 Cargo 能够将标准库本身编译为 crate 图的一部分进行编译。这一功能历史上也被称为“std-aware Cargo”。该功能仍处于非常早期的开发阶段，也可能是 Cargo 的一个重大新增功能。即使是以目前最基础的形式来看，这也是一个需要详细文档化的庞大功能，因此如果您希望保持最新信息，请关注 [跟踪仓库](https://github.com/rust-lang/wg-cargo-std-aware) 及其相关问题列表。

当前实现的该功能通过名为 `-Z build-std` 的标志来实现。该标志表示 Cargo 应使用与主构建相同的配置从源代码编译标准库。请注意，要实现此功能，您需要拥有标准库的源代码，目前唯一支持的方式是添加 `rust-src` rust rustup 组件。

```console
$ rustup component add rust-src --toolchain nightly
```

使用方式如下：

```console
$ cargo new foo
$ cd foo
$ cargo +nightly run -Z build-std --target x86_64-unknown-linux-gnu
   Compiling core v0.0.0 (...)
   ...
   Compiling foo v0.1.0 (...)
    Finished dev [unoptimized + debuginfo] target(s) in 21.00s
     Running `target/x86_64-unknown-linux-gnu/debug/foo`
Hello, world!
```

在这里，我们以调试模式重新编译了标准库，并启用了调试断言（如同 `src/main.rs` 的编译方式），最后将所有内容链接在一起。

使用 `-Z build-std` 会隐式地编译稳定的 crates `core`、`std`、`alloc` 和 `proc_macro`。如果您使用 `cargo test`，它还会编译 `test` crate。如果您使用的环境不支持某些这些 crate，也可以向 `-Zbuild-std` 传递参数：

```console
$ cargo +nightly build -Z build-std=core,alloc
```

此处的值是一个用逗号分隔的标准库 crate 列表，用于构建。

### 要求 总结来说，使用 `-Z build-std` 的当前要求包括：

总结来说，今天使用 `-Z build-std` 的需求列表如下：

* 必须通过 `rustup component add rust-src` 安装 libstd 的源代码 * 必须使用夜线 Cargo 和夜线 rustc * 必须将所有 `cargo` 调用都传递 `-Z build-std` 标志。

### 报告错误和提供帮助 `-Z build-std` 功能仍处于非常早期的开发阶段！这一功能在 Cargo 中有很长的历史，且范围非常广泛，这仅仅是开始而已。如果您想报告错误，请向以下渠道提交：

`-Z build-std` 功能目前正处于开发的非常早期阶段！该功能在 Cargo 中有着极长的历史，涉及范围也非常广泛，而这仅仅只是开始。如果您想报告错误，请向以下渠道提交：

* Cargo --- <https://github.com/rust-lang/cargo/issues/new> --- 用于解决实现错误 * 跟踪仓库 ---
  <https://github.com/rust-lang/wg-cargo-std-aware/issues/new> --- for larger design
  questions.

如果您希望查看尚未实现的特性，或发现某些功能未按预期工作，欢迎访问跟踪仓库的 [问题追踪器](https://github.com/rust-lang/wg-cargo-std-aware/issues)，如果找不到相关 issue，请提交新的 issue！

### `build-std=always`

Build-std 目前正在迁移其实现。UI 将包含 cargo 配置键，这些键将取代 `-Zbuild-std`：

```
[build]
build-std = { when = "always", crates = "std" }
```

更多细节请参阅 [`build-std=always` RFC](https://rust-lang.github.io/rfcs/3874-build-std-always.html#standard-library-crate-stability)。

## build-std-features * 跟踪仓库：<https://github.com/rust-lang/wg-cargo-std-aware>

此标志与 `-Zbuild-std` 特性标志是并列的。它会在构建标准库时配置标准库本身启用的特性。目前默认启用的特性为 `backtrace` 和 `panic-unwind`。该标志期望一个逗号分隔的列表，如果提供，将覆盖默认的启用特性列表。

## binary-dep-depinfo * 跟踪 rustc issue： [#63012](https://github.com/rust-lang/rust/issues/63012)

`-Z binary-dep-depinfo` 标志会使 Cargo 将该标志转发给 `rustc`，从而让 `rustc` 在 "dep info" 文件（扩展名为 `.d`）中包含所有二进制依赖路径。然后 Cargo 使用这些信息进行变更检测（如果任何二进制依赖发生变化，则将重建该 crate）。主要用途是构建编译器本身，因为编译器对标准库有隐式的依赖关系，否则这些依赖关系不会用于变更检测。

## checksum-freshness * 跟踪 issue： [#14136](https://github.com/rust-lang/cargo/issues/14136)

`-Z checksum-freshness` 标志将用文件校验和值替代 cargo 指纹中使用的 mtime 值。这在 mtime 实现不佳的系统中或 CI/CD 环境中最为有用。不同 cargo 版本之间，校验和算法可能会发生变化。cargo 使用这些指纹来确定何时需要重新构建 crate。

目前，即使启用了 `checksum-freshness`，构建脚本所摄入的文件仍将继续使用 mtime。这并非长期解决方案。

```toml
# .cargo/config.toml
[unstable]
checksum-freshness = true

[build]
fingerprint = "content"
```

### `build.fingerprint`

* 类型：字符串 * 默认：`"mtime"` * 环境：`CARGO_BUILD_FINGERPRINT`

选择基于源输入变化来检测构建时机的方法。

* `mtime`：输入的最后修改时间 * `content`：输入的校验和

> [!NOTE]
> 这不会影响 `cargo::rerun-if-changed` 指令在构建脚本中的使用。

## panic-abort-tests * 跟踪问题： [#67650](https://github.com/rust-lang/rust/issues/67650) * 原始拉取请求： [#7460](https://github.com/rust-lang/cargo/pull/7460)

`-Z panic-abort-tests` 标志将启用夜间支持，使得使用 `-Cpanic=abort` 编译测试框架 crate。如果没有此标志，cargo 将通过 `-Cpanic=unwind` 编译测试及其依赖项，因为这是 `test`-the-crate 能够运行的唯一方式。不过，根据 [rust-lang/rust#64158]，`test` crate 现在支持 `-C panic=abort`，并且可以按进程独立运行，有助于避免多次编译 crate 图。

目前尚不清楚此功能如何在 Cargo 中稳定化，但我们希望以某种方式实现稳定化！


## 目标-applies-to-host * 原始拉取请求： [#9322](https://github.com/rust-lang/cargo/pull/9322) * 跟踪问题： [#9453](https://github.com/rust-lang/cargo/issues/9453)

历史上，Cargo在是否遵循来自环境变量的`linker`和`rustflags`配置选项以及[目标](config.md#目标)对于始终为主机平台构建的构建脚本、插件和其他工件的行为上存在不一致的情况。当未传递 `--target`时，Cargo对构建脚本的`linker`和`rustflags`遵循与所有其他编译工件相同的规则。然而，当传递 `--target`时，Cargo会遵循来自[目标.<host tuple>](config.md#targettuplelinker)的`linker`，而不采纳任何`rustflags`配置。这种双重行为令人困惑，同时也使得在主机元组与[目标 tuple]恰好相同的情况下正确配置构建变得困难，因为旨在在构建主机上运行的工件仍需以不同的方式进行配置。

`-Ztarget-applies-to-host`启用Cargo配置文件中的顶级`target-applies-to-host`设置，使用户可以选择不同且更一致的行为模式。当在配置文件中未设置`target-applies-to-host`，或设置为`true`时，会保留现有的Cargo行为（不过请参考`-Zhost-config`，后者会改变默认行为）。当设置为`false`时，无论是否传递 `--target`给Cargo，都不会遵循来自[RUSTFLAGS]或[build]的任何选项，用于主机工件。若要自定义旨在在主机上运行的工件，请使用[host](#host-config)。

未来，`target-applies-to-host`可能会默认设置为`false`，以提供更合理且一致的默认行为。

```toml
# config.toml
target-applies-to-host = false
```

```console
cargo +nightly -Ztarget-applies-to-host build --target x86_64-unknown-linux-gnu
```

## host-config * 原始拉取请求： [#9322](https://github.com/rust-lang/cargo/pull/9322) * 跟踪问题： [#9452](https://github.com/rust-lang/cargo/issues/9452)

配置文件中的`host`键可用于在交叉编译时向必须在主机系统而非目标系统上运行的构建脚本等主机构建目标传递标志。它支持通用和特定于主机架构的表。与通用主机表相比，匹配的特定于主机架构表具有优先级。

需要设置 `-Zhost-config` 和 `-Ztarget-applies-to-host` 命令行选项，并且 Cargo 配置文件中应设置为 `target-applies-to-host = false`。

```toml
# config.toml
[host]
linker = "/path/to/host/linker"
runner = "host-runner"
[host.x86_64-unknown-linux-gnu]
linker = "/path/to/host/arch/linker"
runner = "host-arch-runner"
rustflags = ["-Clink-arg=--verbose"]
[target.x86_64-unknown-linux-gnu]
linker = "/path/to/target/linker"
```

`host.runner` 设置用于包装主机构建目标的执行，如构建脚本，类似于 `target.<tuple>.runner` 用于包装 `cargo run`/`test`/`bench`。

在 `x86_64-unknown-linux-gnu` 主机上构建时，上述通用的 `host` 表将被完全忽略，因为 `host.x86_64-unknown-linux-gnu` 表具有优先权。

设置 `-Zhost-config` 会将 `target-applies-to-host` 的默认值从 `true` 更改为 `false`。

```console
cargo +nightly -Ztarget-applies-to-host -Zhost-config build --target x86_64-unknown-linux-gnu
```

## unit-graph * 跟踪问题：[#8002](https://github.com/rust-lang/cargo/issues/8002)

`--unit-graph` 标志可以传递给任何构建命令（`build`、`check`、`run`、`test`、`bench`、`doc` 等)，以将表示 Cargo 内部单元图의 JSON 对象输出到标准输出。实际上并没有构建任何内容，命令在打印后立即返回。每个“单元”对应一次编译器的执行。这些对象还包含每个单元所依赖的单元。

```
cargo +nightly build --unit-graph -Z unstable-options
```

这种结构提供了更完整的依赖关系视图，即 Cargo 所见的关系。特别是，“features”字段支持新的特性解析器，使得一个依赖项可以带有不同的特性被多次构建。`cargo metadata` 根本无法表示不同依赖类型之间的特性关系，而特性现在取决于运行的命令以及选择的包和目标。此外，它还可以提供关于包内依赖关系的详细信息，如构建脚本或测试。

以下是 JSON 结构的描述：

```javascript
{
  /* Version of the JSON output structure. If any backwards incompatible
     changes are made, this value will be increased.
  */
  "version": 1,
  /* Array of all build units. */
  "units": [
    {
      /* An opaque string which indicates the package.
         Information about the package can be obtained from `cargo metadata`.
      */
      "pkg_id": "my-package 0.1.0 (path+file:///path/to/my-package)",
      /* The Cargo target. See the `cargo metadata` documentation for more
         information about these fields.
         https://doc.rust-lang.org/cargo/commands/cargo-metadata.html
      */
      "target": {
        "kind": ["lib"],
        "crate_types": ["lib"],
        "name": "my_package",
        "src_path": "/path/to/my-package/src/lib.rs",
        "edition": "2018",
        "test": true,
        "doctest": true
      },
      /* The profile settings for this unit.
         These values may not match the profile defined in the manifest.
         Units can use modified profile settings. For example, the "panic"
         setting can be overridden for tests to force it to "unwind".
      */
      "profile": {
        /* The profile name these settings are derived from. */
        "name": "dev",
        /* The optimization level as a string. */
        "opt_level": "0",
        /* The LTO setting as a string. */
        "lto": "false",
        /* The codegen units as an integer.
           `null` if it should use the compiler's default.
        */
        "codegen_units": null,
        /* The debug information level as an integer.
           `null` if it should use the compiler's default (0).
        */
        "debuginfo": 2,
        /* Whether or not debug-assertions are enabled. */
        "debug_assertions": true,
        /* Whether or not overflow-checks are enabled. */
        "overflow_checks": true,
        /* Whether or not rpath is enabled. */
        "rpath": false,
        /* Whether or not incremental is enabled. */
        "incremental": true,
        /* The panic strategy, "unwind" or "abort". */
        "panic": "unwind"
      },
      /* Which platform this target is being built for.
         A value of `null` indicates it is for the host.
         Otherwise it is a string of the target tuple (such as
         "x86_64-unknown-linux-gnu").
      */
      "platform": null,
      /* The "mode" for this unit. Valid values:

         * "test" --- Build using `rustc` as a test.
         * "build" --- Build using `rustc`.
         * "check" --- Build using `rustc` in "check" mode.
         * "doc" --- Build using `rustdoc`.
         * "doctest" --- Test using `rustdoc`.
         * "run-custom-build" --- Represents the execution of a build script.
      */
      "mode": "build",
      /* Array of features enabled on this unit as strings. */
      "features": ["somefeat"],
      /* Whether or not this is a standard-library unit,
         part of the unstable build-std feature.
         If not set, treat as `false`.
      */
      "is_std": false,
      /* Array of dependencies of this unit. */
      "dependencies": [
        {
          /* Index in the "units" array for the dependency. */
          "index": 1,
          /* The name that this dependency will be referred as. */
          "extern_crate_name": "unicode_xid",
          /* Whether or not this dependency is "public",
             part of the unstable public-dependency feature.
             If not set, the public-dependency feature is not enabled.
          */
          "public": false,
          /* Whether or not this dependency is injected into the prelude,
             currently used by the build-std feature.
             If not set, treat as `false`.
          */
          "noprelude": false
        }
      ]
    },
    // ...
  ],
  /* Array of indices in the "units" array that are the "roots" of the
     dependency graph.
  */
  "roots": [0],
}
```

## Profile `rustflags` 选项 * 原始问题：[rust-lang/cargo#7878](https://github.com/rust-lang/cargo/issues/7878) * 跟踪问题：[rust-lang/cargo#10271](https://github.com/rust-lang/cargo/issues/10271)

此功能在 `[profile]` 部分提供了一个新选项，用于指定直接传递给 rustc 的标志。可以像这样启用它：

```toml
cargo-features = ["profile-rustflags"]

[package]
# ...

[profile.release]
rustflags = [ "-C", "..." ]
```

要在 Cargo 配置中在个人资料中设置此选项，您需要使用 `-Z profile-rustflags` 或 `[unstable]` 表格来启用它。例如，

```toml
# .cargo/config.toml
[unstable]
profile-rustflags = true

[profile.release]
rustflags = [ "-C", "..." ]
```

## 配置文件 `hint-mostly-unused` 选项 * 跟踪问题： [#15644](https://github.com/rust-lang/cargo/issues/15644)

此功能在 `[profile]` 部分提供了一个新选项，用于启用 rustc `hint-mostly-unused` 选项。这主要适用于为特定依赖项启用该选项：

```toml
[profile.dev.package.huge-mostly-unused-dependency]
hint-mostly-unused = true
```

要启用此功能，请传递 `-Zprofile-hint-mostly-unused`。然而，由于此选项仅作为提示，如果不使用 `-Zprofile-hint-mostly-unused`，则只会发出警告并忽略配置文件选项。在引入此功能之前的 Cargo 版本会显示“未使用的清单键”警告，但其他方面不会出错。这允许在 crate 的 `Cargo.toml` 文件中使用此提示，而无需强制使用较新版本的 Cargo 来构建项目。

一个 crate 也可以自动为依赖它的其他 crate 提供此提示，使用 `[hints]` 表格（同样会被旧版 Cargo 忽略）：

```toml
[hints]
mostly-unused = true
```

除非通过优先级更高的 `profile` 进行覆盖，而 `profile` 只能在顶层 crate 中指定，否则这将使该 crate 默认采用 hint-mostly-unused 模式。

### 文档更新

#### hint-mostly-unused

*作为新的["配置文件设置"条目](./profiles.html#profile-settings)*

`hint-mostly-unused` 设置控制 [`-Zhint-mostly-unused` 标志]，表示该 crate 的大部分 API 接口将被依赖它的程序忽略。此提示可以通过尝试最小化未使用的项目的编译时间来加速构建过程。如果应用于不符合此条件的 crate，反而会减慢构建速度而非加快。

有效的选项包括：

* `true`: 启用 * `false`: 禁用

默认值为该 crate 的 [`mostly-unused` 提示](#mostly-unused)，如果 crate 未设置此提示则默认为 `false`。

这主要适用于为特定依赖项启用：

```toml
[profile.dev.package.huge-mostly-unused-dependency]
hint-mostly-unused = true
```

当此设置应用于所有依赖项时， [`blanket_hint_mostly_unused`] 检查器会发出警告。


#### `mostly-unused`

*作为["[提示]部分"](./清单.html#the-hints-section)的新子节，每出现一个提示就会增加一个子节*

`mostly-unused` 提示表示该 crate 的大部分 API 接口将被依赖它的代码忽略。对于依赖于该 crate 的 crate，该 crate 可以自动提供此提示：

```toml
# In example-dependency's Cargo.toml
[hints]
mostly-unused = true
```

这将使该 crate 默认设置为 [`hint-mostly-unused`](#hint-mostly-unused)。[配置](profiles.md)中的 `hint-mostly-unused` 设置优先于该提示。只有工作空间根目录的 `Cargo.toml` 和 [Cargo 配置](config.md#profile)才能设置配置：

```toml
# This package uses most of `example-dependency`, so the hint does not apply.
[profile.dev.package.example-dependency]
hint-mostly-unused = false
```

有效值为 `true` 和 `false`。Cargo 会忽略其他所有值。

该提示仅适用于设置它的包，而不适用于其依赖项。

仅在预期大多数依赖项会使用该 crate 的少量部分时使用此提示。否则，该提示可能会减慢它们的构建速度。

## 包 `min-opt-level` 提示 * 跟踪问题： [#17334](https://github.com/rust-lang/cargo/issues/17334) * RFC： [#3924](https://github.com/rust-lang/rfcs/pull/3924)

此功能将 `min-opt-level` 键添加到 `[hints]` 表中。它允许包设置 Cargo 构建该包时使用的最低优化级别：

```toml
[hints]
min-opt-level = 2
```

要启用此功能，请传递 `-Zhint-min-opt-level`。没有该标志时，Cargo 会忽略并警告该提示。在引入此功能之前的 Cargo 版本会显示“未使用清单键”的警告，但其他方面则不会出错。这意味着使用该提示不会改变包的 MSRV。

### 文档更新

#### `min-opt-level`

*作为["[提示]部分"](./清单.html#the-hints-section)的新子节，每出现一个提示就会增加一个子节*

`min-opt-level` 提示设置 Cargo 构建此包时使用的最低 [`opt-level`](profiles.md#opt-level) 值。某些包在未经优化的情况下运行非常缓慢，或者构建时间也更长。这样的包可能会要求最小优化级别：

```toml
# In example-dependency's Cargo.toml
[hints]
min-opt-level = 2
```

有效的数值为 `0`、`1`、`2` 和 `3`。Cargo 会忽略其他任何值并发出警告。`"s"` 和 `"z"` 级别无效，因为无法与数字级别进行比较，且顶层包更有能力选择这些级别。

当所选 [配置](profiles.md) 的 `opt-level` 低于提示值时，Cargo 将按提示值进行构建。如果配置中的 `opt-level` 更高，Cargo 则保持较高的级别。无论该配置的 `opt-level` 是默认设置还是由用户指定，均适用此规则。这也适用于 [构建依赖项](profiles.md#build-dependencies) 的 `opt-level = 0` 默认值。

顶层包可以通过配置 [覆盖](profiles.md#overrides) 来覆盖提示值。在 `package` 表中设置的任何 `opt-level`、在 `"*"` 包中设置的或 `build-override` 表中设置的优先于提示值。在配置中设置 `opt-level = "s"` 或 `"z"` 也具有优先级，因为为了优化大小而优化的包通常希望其依赖项也进行同样的优化。

```toml
# Does not lower the `opt-level` below a dependency's hint.
[profile.dev]
opt-level = 0

# Overrides the hint for the `example-dependency` package.
[profile.dev.package.example-dependency]
opt-level = 0

# Overrides the hint for all dependencies.
[profile.dev.package."*"]
opt-level = 1
```

提示值仅适用于设置它的包，而不适用于其依赖项。如果慢速代码位于依赖项中，该依赖项需要自行设置其提示值。

仅在优化包使得完整构建速度加快，或者未经优化时包的运行速度大幅降低时才使用此提示。

## rustdoc-map * 跟踪问题： [#8296](https://github.com/rust-lang/cargo/issues/8296)

此功能添加了传递给 `rustdoc` 的配置设置，以便在依赖项未提供文档时，能够生成指向其他位置存储文档的链接。首先将其添加到 `.cargo/config` 中：

```toml
[doc.extern-map.registries]
crates-io = "https://docs.rs/"
```

然后，在构建文档时，使用以下标志使依赖项的链接指向 [docs.rs](https://docs.rs/)：

```
cargo +nightly doc --no-deps -Zrustdoc-map
```

`registries` 表包含注册表名称与链接 URL 的映射关系。该 URL 可能包含 `{pkg_name}` 和 `{version}` 标记，这些标记将被替换为对应的值。如果未指定这些标记，则 Cargo 默认会在 URL 末尾添加 `{pkg_name}/{version}/`。

还有另一个配置设置可用于重定向标准库链接。默认情况下，rustdoc 会生成指向 <https://doc.rust-lang.org/nightly/> 的链接。要更改此行为，请使用 `doc.extern-map.std` 设置。

```toml
[doc.extern-map]
std = "local"
```

值为 `"local"` 表示链接到 `rustc` sysroot 中的文档。如果您使用 rustup，可以通过 `rustup component add rust-docs` 安装该文档。

默认值为 `"remote"`。

该值也可以指定一个 URL 作为自定义位置。

## per-包-目标 * 跟踪问题： [#9406](https://github.com/rust-lang/cargo/pull/9406) * 原始拉取请求： [#9030](https://github.com/rust-lang/cargo/pull/9030) * 原始问题： [#7004](https://github.com/rust-lang/cargo/pull/7004)

`per-package-target` 特性在清单中添加了两个键：`package.default-target` 和 `package.forced-target`。第一个键使包在没有传递 `--target` 参数时默认针对某些目标进行编译；第二个键则使包始终针对该目标进行编译。

Example:

```toml
[package]
forced-target = "wasm32-unknown-unknown"
```

在这个例子中，该 crate 总是为 `wasm32-unknown-unknown` 构建，因为它将作为主程序的插件在主机上运行（或通过命令行提供）的目标而使用。

## artifact-dependencies

* 跟踪问题： [#9096](https://github.com/rust-lang/cargo/pull/9096) * 原始拉取请求： [#9992](https://github.com/rust-lang/cargo/pull/9992)

Artifact dependencies 允许 Cargo 包依赖 `bin`、`cdylib` 和 `staticlib` crates，并在编译时使用这些 crate 构建的工件。

运行 `cargo` 并添加 `-Z bindeps` 选项可启用此功能。

### artifact-dependencies：依赖声明

Artifact-dependencies 在 `Cargo.toml` 中的依赖声明中添加了以下键：

- `artifact` --- 这指定了要构建的[Cargo 目标](cargo-targets.md)。通常没有此字段时，Cargo只会从依赖项中构建`[lib]`目标。此字段允许指定将构建哪个目标，并在构建时作为二进制文件提供：

  * `"bin"` --- 编译后的可执行文件，对应于依赖项清单中的所有`[[bin]]`部分。
* `"bin:<bin-name>"` --- 编译后的可执行文件，对应于由给定`<bin-name>`指定的特定二进制目标。
* `"cdylib"` --- 与依赖项清单中`crate-type = ["cdylib"]`的 `[lib]`部分对应的C兼容动态库。
* `"staticlib"` --- 与依赖项清单中`crate-type = ["staticlib"]`的 `[lib]`部分对应的C兼容静态库。

  `artifact`值可以是字符串，也可以是一个字符串数组以指定多个目标。

  Example:

  ```toml
  [dependencies]
  bar = { version = "1.0", artifact = "staticlib" }
  zoo = { version = "1.0", artifact = ["bin:cat", "bin:dog"]}
  ```

- `lib` --- 这是一个布尔值，表示是否还将依赖项的库作为普通的Rust `lib`依赖项构建。此字段只有在指定了`artifact`时才能设置。

  当指定`artifact`时，该字段的默认值为`false`。如果设置为`true`，则依赖项的 `[lib]`目标也将为声明包所构建的平台目标构建。这允许该包像普通依赖项一样从Rust代码中使用该依赖项，而不仅仅是作为 artifact 依赖项。

  Example:

  ```toml
  [dependencies]
  bar = { version = "1.0", artifact = "bin", lib = true }
  ```

- `target` --- 要构建依赖项的平台目标。此字段只有在指定了`artifact`时才能设置。

  如果未指定此值，其默认值取决于依赖项类型。对于构建依赖项，它将为主机目标构建；对于所有其他依赖项，它将为声明包所构建的相同目标构建。

  对于构建依赖项，它也可以接受特殊值`"target"`，表示为该包所构建的相同目标构建依赖项。

  ```toml
  [build-dependencies]
  bar = { version = "1.0", artifact = "cdylib", target = "wasm32-unknown-unknown"}
  same-target = { version = "1.0", artifact = "bin", target = "target" }
  ```

### artifact-dependencies: 环境变量

在构建依赖项后，Cargo 会提供以下环境变量，您可以使用这些变量来访问该依赖项：

- `CARGO_<ARTIFACT-TYPE>_DIR_<DEP>` --- 这是包含来自该依赖项的所有依赖项的目录。

  `<ARTIFACT-TYPE>` 是针对该依赖项指定的 `artifact`（如 `CDYLIB`、`STATICLIB` 或 `BIN）并大写，而 `<DEP>` 则是依赖项的名称。与其他 Cargo 环境变量一样，依赖项名称会被转换为大写，横杠会被替换为下划线。

  如果您在清单中重命名了依赖项，`<DEP>` 对应的是您指定的名称，而不是原始包名。

- `CARGO_<ARTIFACT-TYPE>_FILE_<DEP>_<NAME>` --- 这是依赖项的完整路径。

  `<ARTIFACT-TYPE>` 是针对该依赖项指定的 `artifact`（如上所述为大写），`<DEP>` 是依赖项的名称（如上所述转换后的值），而 `<NAME>` 则是来自该依赖项的 artifact 的名称。

  请注意，`<NAME>` 不会以任何方式改变，它仍然来自提供该依赖项的 crate 中指定的 `name`，或者如果没有指定则来自 crate 名称；例如，它可能为小写，或包含横杠。

  为了方便起见，如果 artifact 名称与原始包名相同，cargo 还会提供一个带有 `_<NAME>` 后缀的副本变量。例如，如果 `cmake` crate 提供了一个名为 `cmake` 的二进制文件，cargo 则提供 `CARGO_BIN_FILE_CMAKE` 和 `CARGO_BIN_FILE_CMAKE_cmake` 两个变量。

对于每种类型的依赖项，这些变量都会被提供给构建过程中的同一部分，该部分可以访问这种类型的依赖项。

- 对于 build-dependencies，这些变量被提供给 `build.rs` 脚本，可以通过 [`std::env::var_os`](https://doc.rust-lang.org/std/env/fn.var_os.html) 访问。（与任何 OS 文件路径一样，这些路径可能是或不是有效的 UTF-8 格式。） - 对于普通依赖项，这些变量在 crate 编译过程中被提供，可以通过 [`env!`] 宏访问。
- 对于开发依赖项，这些变量在示例、测试和基准测试编译过程中被提供，同样可以通过 [`env!`] 宏访问。


### artifact-dependencies: 示例

#### 示例：在构建脚本中使用二进制可执行文件

在 `Cargo.toml` 文件中，你可以指定一个依赖的二进制文件，以便其在构建脚本中可用：

```toml
[build-dependencies]
some-build-tool = { version = "1.0", artifact = "bin" }
```

然后在构建脚本中，该二进制文件可以在构建时执行：

```rust
fn main() {
    let build_tool = std::env::var_os("CARGO_BIN_FILE_SOME_BUILD_TOOL").unwrap();
    let status = std::process::Command::new(build_tool)
        .arg("do-stuff")
        .status()
        .unwrap();
    if !status.success() {
        eprintln!("failed!");
        std::process::exit(1);
    }
}
```

#### 示例：在构建脚本中使用 _cdylib_ 工件

在消费包的 `Cargo.toml` 中，将 `bar` 库作为 `cdylib` 形式为特定构建目标构建……

```toml
[build-dependencies]
bar = { artifact = "cdylib", version = "1.0", target = "wasm32-unknown-unknown" }
```

……以及位于 `build.rs` 中的构建脚本。

```rust
fn main() {
    wasm::run_file(std::env::var("CARGO_CDYLIB_FILE_BAR").unwrap());
}
```

#### 示例：在二进制文件中使用 _binary_ 工件及其库

在消费包的 `Cargo.toml` 中，将 `bar` 二进制文件作为工件构建，同时将其也作为库提供……

```toml
[dependencies]
bar = { artifact = "bin", version = "1.0", lib = true }
```

……以及使用 `main.rs` 的可执行文件。

```rust
fn main() {
    bar::init();
    command::run(env!("CARGO_BIN_FILE_BAR"));
}
```

## publish-timeout * 跟踪问题：[11222](https://github.com/rust-lang/cargo/issues/11222)

配置文件中的 `publish.timeout` 键可用于控制 `cargo publish` 在将包发布到注册表后到其在本地索引中可用之间的等待时间。

`0` 的超时值会阻止任何检查操作。当前默认值为 `60` 秒。

需要设置 `-Zpublish-timeout` 命令行选项。

```toml
# config.toml
[publish]
timeout = 300  # in seconds
```

## `cargo config`

* 原始问题： [#2362](https://github.com/rust-lang/cargo/issues/2362) * 跟踪问题： [#9301](https://github.com/rust-lang/cargo/issues/9301)

`cargo config` 子命令提供了一种方式来显示 cargo 加载的配置文件。该命令目前包含 `get` 子命令，可以传入可选的配置值以进行显示。

```console
cargo +nightly -Zunstable-options config get build.rustflags
```

如果未提供配置值，则将显示所有配置值。更多选项请参见 `--help` 输出。

## rustc `--print`

* 跟踪问题： [#9357](https://github.com/rust-lang/cargo/issues/9357)

`cargo rustc --print=VAL` 将 `--print` 标志传递给 `rustc`，以从 `rustc` 中提取信息。这会使 `rustc` 使用相应的 [`--print`](https://doc.rust-lang.org/rustc/command-line-arguments.html#--print-print-compiler-information) 标志运行，然后立即退出而不进行编译。将此功能作为 cargo 标志提供，使得 cargo 能够根据当前配置注入正确的目标及 RUSTFLAGS。

主要使用场景是运行 `cargo rustc --print=cfg` 以获取适用于相应目标的配置值，并受其他 RUSTFLAGS 的影响。


## 不同的二进制名称

* 跟踪问题： [#9778](https://github.com/rust-lang/cargo/issues/9778) * PR： [#9627](https://github.com/rust-lang/cargo/pull/9627)

`different-binary-name` 功能允许设置二进制文件名称，而无需遵守对 crate 名称的限制。例如，crate 名称只能使用 `alphanumeric` 字符、`-` 或 `_`，且不能为空。

`filename` 参数**不应**包含二进制扩展名，`cargo` 会自行确定合适的扩展名并用于生成二进制文件。

`filename` 参数仅存在于清单的 `[[bin]]` 部分中。

```toml
cargo-features = ["different-binary-name"]

[package]
name =  "foo"
version = "0.0.1"

[[bin]]
name = "foo"
filename = "007bar"
path = "src/main.rs"
```

## scrape-examples

* RFC： [#3123](https://github.com/rust-lang/rfcs/pull/3123) * 跟踪问题： [#9910](https://github.com/rust-lang/cargo/issues/9910)

`-Z rustdoc-scrape-examples` 标志告诉 Rustdoc 在当前工作空间中的 crates 中搜索函数调用，这些调用点随后会被作为文档包含。您可以使用该标志如下：

```
cargo doc -Z unstable-options -Z rustdoc-scrape-examples
```

默认情况下，Cargo会从被文档化的包的示例目标中抓取示例。你可以通过 `doc-scrape-examples` 标志单独启用或禁用目标的抓取功能，例如：

```toml
# Enable scraping examples from a library
[lib]
doc-scrape-examples = true

# Disable scraping examples from an example target
[[example]]
name = "my-example"
doc-scrape-examples = false
```

**关于测试的说明：**在测试目标上启用 `doc-scrape-examples` 目前没有任何效果。从测试中抓取示例目前仍在开发中。

**关于开发依赖项说明：**通常文档化一个库不需要该 crate 的开发依赖项。但是，示例目标需要开发依赖项。为了向后兼容，`-Z rustdoc-scrape-examples` 不会为 `cargo doc` 引入开发依赖项的要求。因此，在以下条件下，示例目标将**不会**被抓取：

1. 没有被文档化的目标需要开发依赖项；且 2. 至少有一个包含被文档化目标的 crate 具有开发依赖项；且 3. 所有 `[[example]]` 目标中的 `doc-scrape-examples` 参数未设置或值为 false。

如果你希望从示例目标中抓取示例，则必须不满足上述任一条件。例如，你可以将 `doc-scrape-examples` 设置为 true 用于一个示例目标，这样就会向 Cargo 表明你同意为 `cargo doc` 构建开发依赖项。

## rustdoc 的输出格式

* 跟踪问题： [#13283](https://github.com/rust-lang/cargo/issues/13283)

此标志决定了 `cargo rustdoc` 和 `cargo doc` 的输出格式，支持 `html` 或 `json` 格式，为工具提供了依赖 [rustdoc 实验性 JSON 格式](https://doc.rust-lang.org/nightly/nightly-rustc/rustdoc_json_types/) 的方式。

你可以像这样使用该标志：

```
cargo rustdoc -Z unstable-options --output-format json
cargo doc -Z unstable-options --output-format json
```

## codegen-backend

`codegen-backend` 特性允许通过配置文件选择 rustc 使用的代码生成后端。

Example:

```toml
[package]
name = "foo"

[dependencies]
serde = "1.0.117"

[profile.dev.package.foo]
codegen-backend = "cranelift"
```

要在 Cargo 配置中的配置文件里设置此选项，你需要使用 `-Z codegen-backend` 或 `[unstable]` 表格来启用它。例如：

```toml
# .cargo/config.toml
[unstable]
codegen-backend = true

[profile.dev.package.foo]
codegen-backend = "cranelift"
```

## gitoxide

* 跟踪问题： [#11813](https://github.com/rust-lang/cargo/issues/11813)

由于‘gitoxide’不稳定特性，所有或指定的 git 操作将由 `gitoxide` crate 执行，而非 `git2`。

虽然 `-Zgitoxide` 支持所有当前实现的特性，但可以通过 `-Zgitoxide=operation[,operationN]` 语法单独选择要使用 `gitoxide` 执行的 git 操作。

有效的操作包括以下几种：

* `fetch` - 所有 fetch 操作均通过 `gitoxide` 执行，该工具包含 git 依赖项以及 crate 索引。
* `checkout` *(计划功能)* - 支持过滤器及子模块功能的工作树检出。

## git

* 跟踪问题： [#13285](https://github.com/rust-lang/cargo/issues/13285)

由于‘git’不稳定特性，`gitoxide` 和 `git2` 都将对 crate 索引和 git 依赖项进行浅层获取。

虽然 `-Zgit` 支持所有当前实现的特性，但可以通过 `-Zgit=operation[,operationN]` 语法单独选择何时执行浅层获取。

有效的操作包括以下几种：

* `shallow-index` - 对索引进行浅层克隆。
* `shallow-deps` - 对 git 依赖项进行浅层克隆。

**关于浅层克隆的详细信息**

* 要启用浅层克隆，对于获取 git 依赖项请添加 `-Zgit=shallow-deps`，对于获取注册表索引则添加 `-Zgit=shallow-index`。
* 浅层克隆和浅层检出的 git 仓库位于各自的 `-shallow` 后缀目录中，即 - `~/.cargo/registry/index/*-shallow` - `~/.cargo/git/db/*-shallow` - `~/.cargo/git/checkouts/*-shallow` * 当不稳定特性开启时，获取/克隆 git 仓库始终为浅层获取。这大致相当于 everywhere 中的 `git fetch --depth 1`。
* 即使存在 `Cargo.lock` 或指定提交 `{ rev = "…" }`，`gitoxide` 和 libgit2 仍足够智能地执行浅层获取，而不会取消现有仓库的浅层状态。

## script

* 跟踪问题： [#12207](https://github.com/rust-lang/cargo/issues/12207)

Cargo 可以直接运行 `.rs` 文件为：
```console
$ cargo +nightly -Zscript file.rs
```
其中 `file.rs` 可以非常简单，例如：
```rust
fn main() {}
```

用户可以在模块级注释中的 `cargo` 代码围栏中选择性地指定清单文件，例如：
````rust
#!/usr/bin/env -S cargo +nightly -Zscript
---cargo
[dependencies]
clap = { version = "4.2", features = ["derive"] }
---

use clap::Parser;

#[derive(Parser, Debug)]
#[clap(version)]
struct Args {
    #[clap(short, long, help = "Path to config")]
    config: Option<std::path::PathBuf>,
}

fn main() {
    let args = Args::parse();
    println!("{:?}", args);
}
````

### 单文件包

除了今天的多文件包（包含其他 `.rs` 文件的 `Cargo.toml` 文件）之外，我们还将引入单文件包的概念，这些包可以包含嵌入的清单文件。对于单文件 `.rs` 包与其他 `.rs` 文件之间没有必须区分的要求。

可以通过 `--manifest-path` 选择单文件包，例如 `cargo test --manifest-path foo.rs`。与 `Cargo.toml` 不同，这些文件无法被自动发现。

单文件包可以包含嵌入的清单文件。嵌入的清单文件使用 `TOML` 格式存储在 rust “frontmatter” 中，即一个带有 `cargo` 前缀的 markdown 代码围栏，位于文件的顶部信息行中。

推断/默认生成的清单字段： - `package.name = <slugified file stem>` - `package.edition = <current>` 以避免在升级 rust 时因添加嵌入清单而可能破坏脚本 - 当未指定 `edition` 时发出警告，以提高用户对此的认识

不允许的清单字段： - `[workspace]`、`[lib]`、`[[bin]]`、`[[example]]`、`[[test]]`、`[[bench]]` - `package.workspace`、`package.build`、`package.links`、`package.autolib`、`package.autobins`、`package.autoexamples`、`package.autotests`、`package.autobenches`

单文件包的默认 `CARGO_TARGET_DIR` 位于 `$CARGO_HOME/target/<hash>`： - 避免多个单文件包处于同一目录导致冲突 - 避免单文件包的父目录为只读的问题 - 避免占用用户的目录空间

单文件包的锁定文件将存储在 `CARGO_TARGET_DIR` 中。将来当支持工作区时，用户将能够拥有持久的锁定文件。

### 清单命令

你可以直接将清单文件作为子命令传递给 `cargo` 命令，例如 `foo/Cargo.toml` 或单文件包 `foo.rs`。这主要用于放在 `#!` 行中。

`cargo <subcommand>` 的解析优先级为：1. 内置的 xor 单文件包；2. 别名；3. 外部子命令。

如果参数具有以下任一特征，则被识别为 清单-command：- 路径分隔符 - `.rs` 扩展名 - 文件名为 `Cargo.toml`

`cargo run --manifest-path <path>` 与 `cargo <path>` 之间的区别 - `cargo <path>` 使用 `<path>` 的配置而非当前目录，更类似于 `cargo install --path <path>` - `cargo <path>` 的详细输出级别低于默认设置。传递 `-v` 可获取正常输出。

当使用包含内嵌 清单 的包时，`[arg0](https://doc.rust-lang.org/std/os/unix/process/trait.CommandExt.html#tymethod.arg0)` 将表示脚本路径。要获取可执行文件的路径，请参阅 [`current_exe`](https://doc.rust-lang.org/std/env/fn.current_exe.html)。

### 文档更新

## gc

* 跟踪问题： [#12633](https://github.com/rust-lang/cargo/issues/12633)

`-Zgc` 标志用于启用与 cargo 主目录中的全局缓存垃圾收集相关的某些功能。

#### 自动 gc 配置

`-Zgc` 标志将使 Cargo 读取与垃圾收集相关的额外配置选项。可用的设置包括：

```toml
# Example config.toml file.

# Sub-table for defining specific settings for cleaning the global cache.
[cache.global-clean]
# Anything older than this duration will be deleted in the source cache.
max-src-age = "1 month"
# Anything older than this duration will be deleted in the compressed crate cache.
max-crate-age = "3 months"
# Any index older than this duration will be deleted from the index cache.
max-index-age = "3 months"
# Any git checkout older than this duration will be deleted from the checkout cache.
max-git-co-age = "1 month"
# Any git clone older than this duration will be deleted from the git cache.
max-git-db-age = "3 months"
```

请注意， [`cache.auto-clean-frequency`] 选项已在 Rust 1.88 中稳定化。


### 使用 `cargo clean` 进行手动垃圾收集

可以通过 `cargo clean gc -Zgc` 命令进行手动删除。通过传递相应的缓存选项可以删除缓存内容：

- `--max-src-age=DURATION` --- 删除自指定时间后未使用的源缓存文件。
- `--max-crate-age=DURATION` --- 删除自指定时间后未使用的库缓存文件。
- `--max-index-age=DURATION` --- 删除自指定时间后未使用的注册表索引（包括其 `.crate` 和 `src` 文件）。
- `--max-git-co-age=DURATION` --- 删除自指定时间后未使用的 git 依赖检出文件。
- `--max-git-db-age=DURATION` --- 删除自指定时间后未使用的 git 依赖克隆文件。
- `--max-download-age=DURATION` --- 删除自指定时间后未使用的任何下载缓存数据。
- `--max-src-size=SIZE` --- 删除最旧的源缓存文件，直到缓存大小低于指定值。
- `--max-crate-size=SIZE` --- 删除最旧的库缓存文件，直到缓存大小低于指定值。
- `--max-git-size=SIZE` --- 删除最旧的 git 依赖缓存文件，直到缓存大小低于指定值。
- `--max-download-size=SIZE` --- 删除最旧的下载缓存数据，直到缓存大小低于指定值。

`DURATION` 以“N 秒/分钟/天/周/月”的形式指定，其中 N 为整数。

`SIZE` 以“N *suffix*”的形式指定，其中 *suffix* 为 B、kB、MB、GB、kiB、MiB 或 GiB，N 为整数或浮点数。如果未指定后缀，则数值表示字节数。

```sh
cargo clean gc -Zgc
cargo clean gc -Zgc --max-download-age=1week
cargo clean gc -Zgc --max-git-size=0 --max-download-size=100MB
```

## open-namespaces

* 跟踪问题： [#13576](https://github.com/rust-lang/cargo/issues/13576)

允许多个包参与同一个 API 命名空间

可以如下启用：
```toml
cargo-features = ["open-namespaces"]

[package]
# ...
```

## panic-immediate-abort

* 跟踪问题： [#16042](https://github.com/rust-lang/cargo/issues/16042) * 上游跟踪问题： [rust-lang/rust#147286](https://github.com/rust-lang/rust/issues/147286)

扩展 `panic` 配置选项，以支持 [`immediate-abort`](../../rustc/codegen-options/index.html#panic) 崩溃策略。可以如下启用：

```toml
# Cargo.toml
cargo-features = ["panic-immediate-abort"]

[package]
# ...

[profile.release]
panic = "immediate-abort"
```

要在 Cargo 配置中在个人资料中设置此选项，您需要使用 `-Z panic-immediate-abort` CLI 标志或 `[unstable]` 表来启用它。例如，

```toml
# .cargo/config.toml
[unstable]
panic-immediate-abort = true

[profile.release]
panic = "immediate-abort"
```

## 细粒度锁定

* 跟踪问题： [#4282](https://github.com/rust-lang/cargo/issues/4282)

使用细粒度锁定，而不是锁定整个构建缓存。

## 路径基础

* 跟踪问题： [#14355](https://github.com/rust-lang/cargo/issues/14355)

`path` 依赖项可以通过设置 `base` 键为 `[path-bases]` 表中的某个路径基础名称来指定基础路径，该表位于 [配置](config.md) 或内置路径基础中。该路径基础的值会前置到 `path` 值之前（必要时加上路径分隔符），从而确定 Cargo 查找依赖项的实际位置。

例如，如果 `Cargo.toml` 包含以下内容：

```toml
cargo-features = ["path-bases"]

[dependencies]
foo = { base = "dev", path = "foo" }
```

给定配置中的 `[path-bases]` 表包含以下内容：

```toml
[path-bases]
dev = "/home/user/dev/rust/libraries/"
```

这将生成位于 `/home/user/dev/rust/libraries/foo` 的 `path` 依赖项 `foo`。

路径基础可以是绝对或相对路径。相对路径基础相对于声明该路径基础的配置文件父目录而言。

路径基础的名称只能使用 [字母数字](https://doc.rust-lang.org/std/primitive.char.html#method.is_alphanumeric) 字符、`-` 或 `_`，必须以 [字母](https://doc.rust-lang.org/std/primitive.char.html#method.is_alphabetic) 字符开头，且不能为空。

如果依赖项中使用的路径基础名称既不在配置中也不属于内置路径基础，则 Cargo 将引发错误。

#### 内置路径基础

Cargo 提供了隐式路径基础，无需在 `[path-bases]` 表中指定即可使用。

* `workspace` - 如果项目是 [工作空间或工作空间成员](workspaces.md)，则此路径基础定义为工作空间根 `Cargo.toml` 的父目录。

如果配置中同时声明了内置路径基础名，则 Cargo 会优先使用配置中的值。这样即可让 Cargo 添加新的内置路径基础名而不会出现兼容问题（因为现有使用会覆盖内置名称）。

## native-completions * 原始问题： [#6645](https://github.com/rust-lang/cargo/issues/6645) * 跟踪问题： [#14520](https://github.com/rust-lang/cargo/issues/14520)

此功能将手工编写的完成脚本迁移到 Rust native 实现，使我们更容易添加、扩展和测试新的完成功能。该特性在夜间通道中已启用，无需额外的 `-Z` 选项。

需要反馈的重点领域包括： - 需要转义或引用但处理不当的参数 - 信息中的错误 - 命令行解析中的漏洞 - 未报告其完成的参数 - 已知问题导致的问题

反馈可以分为以下几类： - 报告的完成候选项 - 已知问题： [#14520](https://github.com/rust-lang/cargo/issues/14520)、 [`A-completions`](https://github.com/rust-lang/cargo/labels/A-completions) - [报告问题](https://github.com/rust-lang/cargo/issues/new) 或[讨论行为](https://github.com/rust-lang/cargo/issues/14520) - Shell 集成、命令行解析和完成过滤 - 已知问题： [clap#3166](https://github.com/clap-rs/clap/issues/3166)、 [clap 的 `A-completions`](https://github.com/clap-rs/clap/labels/A-completion) - [报告问题](https://github.com/clap-rs/clap/issues/new/choose) 或[讨论行为](https://github.com/clap-rs/clap/discussions/new/choose)

如有疑问，可以在 [#14520](https://github.com/rust-lang/cargo/issues/14520) 或 [zulip](https://rust-lang.zulipchat.com/#narrow/stream/246057-t-cargo) 中讨论。

### 使用 native-completions 功能的方法： - bash: 将 `source <(CARGO_COMPLETE=bash cargo +nightly)` 添加到 `~/.local/share/bash-completion/completions/cargo` 中。

- zsh: 将 `source <(CARGO_COMPLETE=zsh cargo +nightly)` 添加到你的 `.zshrc` 文件中。

- fish: 将 `source (CARGO_COMPLETE=fish cargo +nightly | psub)` 添加到 `$XDG_CONFIG_HOME/fish/completions/cargo.fish` 中

- elvish: 将 `eval (E:CARGO_COMPLETE=elvish cargo +nightly | slurp)` 添加到 `$XDG_CONFIG_HOME/elvish/rc.elv` 中

- powershell: 将 `CARGO_COMPLETE=powershell cargo +nightly | Invoke-Expression` 添加到 `$PROFILE` 中

## 特性统一

* RFC: [#3692](https://github.com/rust-lang/rfcs/blob/master/text/3692-特性-unification.md) * 跟踪问题: [#14774](https://github.com/rust-lang/cargo/issues/14774)

`-Z feature-unification` 使 `resolver.feature-unification` 配置选项能够控制特性在工作区中的统一方式。如果未启用不稳定的 `-Z feature-unification` 标志，则 `resolver.feature-unification` 配置将被忽略。

### `resolver.feature-unification`

* 类型: string * 默认值: `"selected"` * 环境变量: `CARGO_RESOLVER_FEATURE_UNIFICATION`

指定哪些包参与 [特性统一](../reference/features.html#特性-unification)。

* `selected`: 合并当前构建所指定的所有包的依赖特性。
* `workspace`: 合并所有工作区成员的依赖特性，无论当前构建指定了哪些包。
* `package`: 依赖特性按包进行考虑，当不同包激活不同的特性集时，会优先使用重复的依赖构建。

## 锁文件-publish-time

* 原始问题: [#5221](https://github.com/rust-lang/cargo/issues/5221) * 跟踪问题: [#16271](https://github.com/rust-lang/cargo/issues/16271)

使用 `cargo generate-lockfile -Zunstable-options --publish-time <time>` 时，包解析将不考虑比指定时间更新的任何包。

## 包消息格式

* 原始问题: [#11666](https://github.com/rust-lang/cargo/issues/11666) * 跟踪问题: [#15353](https://github.com/rust-lang/cargo/issues/15353)

`cargo package` 中的 `--message-format` 标志控制输出消息格式。目前，它仅与 `--list` 标志配合使用，并影响文件列表格式，需要 `-Zunstable-options`。更多详情请参阅 [`cargo package --message-format`](../commands/cargo-包.md#option-cargo-包---message-format)。

## rustdoc depinfo

* 原始问题： [#12266](https://github.com/rust-lang/cargo/issues/12266) * 跟踪问题： [#15370](https://github.com/rust-lang/cargo/issues/15370)

`-Z rustdoc-depinfo` 标志利用 rustdoc 的 dep-info 文件来确定是否需要重新生成文档。此选项可以与 `-Z checksum-freshness` 结合使用，以检测校验和的变化而非文件修改时间。

## embed-metadata * 原始拉取请求： [#15378](https://github.com/rust-lang/cargo/pull/15378) * 跟踪问题： [#15495](https://github.com/rust-lang/cargo/issues/15495)

Rust 的默认行为是将 crate 元数据嵌入到 `rlib` 和 `dylib` 文件中。由于 Cargo 也会将这些中间文件传递 `--emit=metadata` 参数以启用流水线编译，这意味着大量元数据会被重复存储在磁盘上，从而浪费目标目录中的磁盘空间。

如果您对 Cago 传递 `-Zembed-metadata=no` 参数，它将把 `-Zembed-metadata=no` 标志传递给编译器，指示编译器不在 rlib 和 dylib 文件中嵌入元数据。在这种情况下，元数据将仅存储在 `.rmeta` 文件中。

```console
cargo +nightly -Zembed-metadata=no build
```

> 请注意，该标志计划在将来被移除，因为“no”行为应成为默认设置。

## `unstable-editions`

`cargo-features` 列表中的 `unstable-editions` 值允许 `Cargo.toml` 清单指定一个尚未稳定的版本。

```toml
cargo-features = ["unstable-editions"]

[package]
name = "my-package"
edition = "future"
```

当引入新版本时，在版本稳定之前需要使用 `unstable-editions` 功能。

特殊的“未来”版本是一个用于开发中的新功能的家园，且始终不稳定。“未来”版本本身也没有新的行为。每次“未来”版本的变更都需要用户选择启用，例如使用 `#![feature(...)]` 属性。

## `fix-edition`

`-Zfix-edition` 是一个始终不稳定的标志，用于辅助测试版本迁移，尤其是与 crater 工具配合使用时。它仅适用于 `cargo fix` 子命令。该标志有两种不同的形式：

- `-Zfix-edition=start=$INITIAL` --- 这种形式会检查当前版本是否等于给定的数值。如果不是，则成功退出（因为我们希望忽略旧版本）。如果是，则运行相当于 `cargo check` 的操作。此选项旨在与 crater 的“start”工具链一起使用，为“之前”工具链设定基准。
- `-Zfix-edition=end=$INITIAL,$NEXT` --- 这种形式会检查当前版本是否等于给定的 `$INITIAL` 值。如果不是，则成功退出。如果是，则执行向 `$NEXT` 中指定的版本进行的版本迁移。之后，它会修改 `Cargo.toml` 文件以添加适当的 `cargo-features = ["unstable-edition"]`，更新 `edition` 字段，并运行相当于 `cargo check` 的操作以验证迁移在新版本上是否生效。

例如：

```console
cargo +nightly fix -Zfix-edition=end=2024,future
```

## section-timings * 原始拉取请求： [#15780](https://github.com/rust-lang/cargo/pull/15780) * 跟踪问题： [#15817](https://github.com/rust-lang/cargo/issues/15817)

此功能可用于扩展 `cargo build --timings` 的输出。它会指示 rustc 生成各个编译部分的计时信息，然后这些信息将显示在计时 HTML/JSON 输出中。

```console
cargo +nightly -Zsection-timings build --timings
```

## mem-stats

在 `cargo build --timings` 报告中添加了一个“每个单元的最大内存使用量”表格，显示每个构建单元进程（`rustc`、`rustdoc` 和构建脚本）的峰值驻留集大小。

```console
cargo +nightly -Zmem-stats build --timings
```

峰值内存是在 Unix 系统上通过 `wait4` 的 `ru_maxrss` 函数以及 Windows 系统上通过 `GetProcessMemoryInfo` 测量的；其他平台则省略此表格。

## 构建分析

* 原始问题：[rust-lang/rust-project-goals#332](https://github.com/rust-lang/rust-project-goals/pull/332) * 跟踪问题： [#15844](https://github.com/rust-lang/cargo/issues/15844)

`-Zbuild-analysis` 功能会在磁盘上记录并保存详细的构建指标，同时提供新的命令用于查询过去的构建结果。

当启用时，Cargo 会将构建日志以 JSONL 格式写入 `$CARGO_HOME/log/` 目录。每次调用 cargo 都会生成一个带有唯一会话 ID 的日志文件。这些日志包含计时信息、重建原因及其他构建元数据，可通过 `cargo report` 子命令进行分析。

要启用构建分析，请在 [Cargo 配置](config.md)中添加以下内容：

```toml
# Example config.toml file.

[unstable]
build-analysis = true

# Enable the build metric collection
[build.analysis]
enabled = true
```

仅在稳定工具链上设置此选项只会产生未知的配置警告，因此将其保留在 Cargo 配置中是安全的。

### `cargo report` 命令

在 `-Zbuild-analysis` 下提供以下命令：

- `cargo report sessions` --- 列出之前的构建会话。使用此命令可查找其他报告命令所需的会话 ID。
- `cargo report timings` --- 从之前的会话生成 HTML 计时报告，功能类似于 `cargo build --timings`，但不进行重新编译。
- `cargo report rebuilds` --- 报告为何重新编译 crate，有助于诊断意外的重新编译问题。

## 编译时依赖

此永久不稳定的标志仅用于构建过程宏和构建脚本（及其所需的依赖项），以及运行这些构建脚本。

该选项旨在供 rust-analyzer 等工具使用，永远不会被稳定化。

Example:

```console
cargo +nightly build --compile-time-deps -Z unstable-options
cargo +nightly check --compile-time-deps --all-targets -Z unstable-options
```

## `rustc-unicode` * 跟踪问题：[rust#148607](https://github.com/rust-lang/rust/issues/148607)

在 Cargo 的错误消息中启用 `rustc` 的 Unicode 错误格式。

## rustdoc 可合并信息

* 原始拉取请求： [#16309](https://github.com/rust-lang/cargo/pull/16309) * 跟踪问题： [#16306](https://github.com/rust-lang/cargo/issues/16306) * 跟踪 rustc 问题：[rust-lang/rust#130676](https://github.com/rust-lang/rust/issues/130676)

`-Z rustdoc-mergeable-info` 利用 rustdoc 的 mergeable crate info 功能，使得 `cargo doc` 能够合并来自不同输出目录的跨 crate 信息（如搜索索引、源文件索引等），并并行运行 `rustdoc`。

## json-目标-spec * 跟踪问题：[rust-lang/rust#151528](https://github.com/rust-lang/rust/issues/151528)

`-Z json-target-spec` CLI 标志使得使用 [自定义目标规范 JSON 文件](https://doc.rust-lang.org/nightly/rustc/targets/custom.html) 作为目标成为可能。

```console
cargo +nightly build --target my-target.json -Z json-target-spec
```

通常必须结合 [build-std](#build-std) 使用。

## hint-msrv * 跟踪问题：[rust-lang/rust#157574](https://github.com/rust-lang/rust/issues/157574)

`-Z hint-msrv` CLI 标志使 Cargo 能够将 `package.rust-version` 传递给 rustc，这会影响哪些lint 会被输出。

您可以通过全局 `~/.cargo/config.toml` 设置此选项，nightly Cargo 会自动使用它，而 stable Cargo 则会对不稳定选项保持静默忽略：

```toml
[unstable]
hint-msrv = true
```

## builtin-dependencies * 跟踪问题：[rust-lang/cargo#16960](https://github.com/rust-lang/cargo/issues/16960) - RFC：[rust-lang/rfcs#3875](https://rust-lang.github.io/rfcs/3875-build-std-explicit-dependencies.html)

允许指定标准库 crate 的依赖项，如下所示：

```toml
[dependencies]
std = { builtin = true, optional = true }
core = { builtin = true}
```

明确指定内置依赖与 `-Zbuild-std` 非常搭配，对于 `#[no_std]` crate 也很有用。更多细节请参见 RFC。

包 ID 规范可以使用 `builtin://.#<name>` 的形式来指代内置包。例如，`builtin://.#core` 标识了内置核心包，使其与其他来源中名为“core”的包区分开来。

## term-graphics * 跟踪问题：[rust-lang/rust#165164](https://github.com/rust-lang/rust/issues/165164)

`-Z term-graphics` 使 `term.graphics` 配置选项能够控制 Cargo 和 rustc 是否在诊断输出中使用图形装饰和源代码片段。如果未启用 `-Z term-graphics` 不稳定标志，则 `term.term-graphics` 配置将被忽略。


### 已添加到配置中

- 类型：布尔值 - 默认：自动检测 - 环境：`CARGO_TERM_GRAPHICS`

控制诊断输出中图形装饰和源代码片段的使用。当此参数为`false`时，输出主要旨在供依赖文本转语音和盲文显示器的用户使用。


# 稳定并移除的功能

## 编译进度

在1.30版本中，编译进度功能已稳定。现在默认启用进度条。有关控制此功能的更多信息，请参阅 [`term.progress`](config.md#termprogresswhen)。

## 版本号

在1.31版本中，`Cargo.toml`中的`edition`字段已稳定。有关指定该字段的更多信息，请参阅 [版本号字段](清单.md#the-edition-field)。

## rename-依赖

在1.31版本中，`Cargo.toml`中指定重命名依赖项的功能已稳定。有关重命名依赖项的更多信息，请参阅 [重命名依赖项](specifying-dependencies.md#renaming-dependencies-in-cargotoml)。

## 替代注册表

在1.34版本中，对替代注册表的支持已稳定。有关替代注册表的更多信息，请参阅 [注册表章节](registries.md)。

## 离线模式

在1.36版本中，离线功能已稳定。有关使用离线模式的更多信息，请参阅 [`--offline`标志](../commands/cargo.md#option-cargo---offline)。

## publish-锁文件

在1.37版本中，`publish-lockfile`功能已被移除。如果包包含二进制目标，在发布时总是包含`Cargo.lock`文件。`cargo install`命令需要 `--locked`标志才能使用`Cargo.lock`文件。有关更多信息，请参阅 [`cargo package`](../commands/cargo-包.md)和 [`cargo install`](../commands/cargo-install.md)。

## default-run

在1.37版本中，`default-run`功能已稳定。有关指定默认运行目标的信息，请参阅 [`default-run`字段](清单.md#the-default-run-field)。

## cache-messages

在 1.40 版本中，编译器消息缓存已稳定。现在默认会缓存编译器警告，并在重新运行 Cargo 时自动重播这些警告。

## install-upgrade

`install-upgrade` 功能已在 1.41 版本中稳定。`cargo install` 现在会在软件包看起来过时时自动升级它们。有关更多信息，请参阅 [`cargo install`] 文档。


## Profile Overrides

Profile overrides 已在 1.41 版本中稳定。有关使用覆盖功能的更多信息，请参阅 [Profile Overrides](profiles.md#overrides)。

## Config Profiles

在 1.43 版本中，在 Cargo 配置文件和环境变量中指定配置文件已稳定。有关在配置文件中指定 [profile] 的更多信息，请参阅 [config `[profile]` table](config.md#profile)。

## crate-versions

`-Z crate-versions` 标志已在 1.47 版本中稳定。现在 crate 版本会自动包含在 [`cargo doc`](../commands/cargo-doc.md) 文档侧边栏中。

## Features

`-Z features` 标志已在 1.51 版本中稳定。有关使用新功能解析器的更多信息，请参阅 [特性 resolver version 2](features.md#特性-resolver-version-2)。

## 包-features

`-Z package-features` 标志已在 1.51 版本中稳定。有关使用 features CLI 选项的信息，请参阅 [resolver version 2 command-line flags](features.md#resolver-version-2-command-line-flags)。

## Resolver

`Cargo.toml` 中的 `resolver` 功能已在 1.51 版本中稳定。有关指定解析器的更多信息，请参阅 [resolver versions](resolver.md#resolver-versions)。

## extra-link-arg

在 1.56 版本中，用于在构建脚本中指定额外链接参数的 `extra-link-arg` 功能已稳定。有关指定额外链接参数的更多信息，请参阅 [build script documentation](build-scripts.md#outputs-of-the-build-script)。

## configurable-env

在 1.56 版本中，`configurable-env` 功能用于在 Cargo 配置中指定环境变量，现已稳定。有关设置环境变量的更多信息，请参阅 [配置文档](config.html#env)。

## rust-version

在 `Cargo.toml` 中的 `rust-version` 字段在 1.56 版本中已稳定。有关使用 `rust-version` 字段和 `--ignore-rust-version` 选项的更多信息，请参阅 [rust-version 字段](清单.html#the-rust-version-field)。

## patch-in-config

`-Z patch-in-config` 标志以及 Cargo 配置文件中对 `[patch]` 部分的支持在 1.56 版本中已稳定。有关更多信息，请参阅 [patch 字段](config.html#patch)。

## edition 2021

2021 版已在 1.56 版本中稳定。有关设置版本的更多信息，请参阅 [`edition` 字段](清单.md#the-edition-field)。有关迁移现有项目的更多信息，请参阅 [cargo fix --edition](../commands/cargo-fix.md) 和 [版本指南](../../edition-guide/index.html)。


## 自定义命名配置文件

在 1.57 版本中，自定义命名配置文件已稳定。有关更多信息，请参阅 [配置文件章节](profiles.md#custom-profiles)。

## 配置文件 `strip` 选项

配置文件 `strip` 选项在 1.59 版本中已稳定。有关更多信息，请参阅 [配置文件章节](profiles.md#strip)。

## 未来不兼容报告

生成未来不兼容报告的支持在 1.59 版本中已稳定。有关更多信息，请参阅 [未来不兼容报告章节](future-incompat-report.md)。

## 命名空间特性

命名空间特性在 1.60 版本中已稳定。有关更多信息，请参阅 [特性章节](features.md#optional-dependencies)。

## 弱依赖特性

弱依赖特性在 1.60 版本中已稳定。有关更多信息，请参阅 [特性章节](features.md#依赖-features)。

## 执行时间

在 1.60 版本中，`-Ztimings` 选项已稳定为 `--timings`。在 1.94.0-nightly 版本中，时间输出格式选项（例如 `--timings=html` 和机器可读取的 `--timings=json` 输出）已被移除。

## config-cli

在 1.63 版本中，`--config` CLI 选项已稳定。有关更多信息，请参阅 [config 文档](config.html#command-line-overrides)。

## multitarget

在 1.64 版本中，`-Z multitarget` 选项已稳定。有关设置默认 [目标平台元组][目标 tuple] 的更多信息，请参阅 [`build.target`](config.md#buildtarget)。

## crate-type

在 1.64 版本中，`cargo rustc` 的 `--crate-type` 标志已稳定。有关更多信息，请参阅 [`cargo rustc` 文档](../commands/cargo-rustc.md)。


## 工作区 Inheritance

工作区 Inheritance 在 1.64 版本中已稳定。有关更多信息，请参阅 [工作区.包](workspaces.md#the-包-table)、[工作区.dependencies](workspaces.md#the-dependencies-table) 和 [从工作空间继承依赖项](specifying-dependencies.md#inheriting-a-依赖-from-a-工作区)。

## terminal-width

在 1.68 版本中，`-Z terminal-width` 选项已稳定。当从终端运行时，编译器总是会接收终端宽度信息，因为 Cargo 可以自动检测该宽度。

## sparse-registry

Sparse registry 支持在 1.68 版本中已稳定。有关更多信息，请参阅 [Registry Protocols](registries.md#registry-protocols)。

### `cargo logout`

[`cargo logout`] 命令在 1.70 版本中已稳定。


## `doctest-in-workspace`

在 1.72 版本中，`cargo test` 的 `-Z doctest-in-workspace` 选项已稳定并默认启用。有关编译和运行测试的工作目录的更多信息，请参阅 [`cargo test` 文档](../commands/cargo-test.md#working-directory-of-tests)。

## keep-going

`--keep-going` 选项已在 1.74 版本中稳定。更多详情可参考 `cargo build` 中的 [`--keep-going` 标志](../commands/cargo-build.html#option-cargo-build---keep-going)。

## `[lints]`

[`[lints]`](清单.html#the-lints-section)（通过 `-Zlints` 启用）已在 1.74 版本中稳定。

## credential-process

`-Z credential-process` 功能已在 1.74 版本中稳定。

详情请参阅 [Registry Authentication](registry-authentication.md) 文档。

## registry-auth

`-Z registry-auth` 功能已在 1.74 版本中稳定，并增加了配置凭证提供器的要求。

详情请参阅 [Registry Authentication](registry-authentication.md) 文档。

## check-cfg

`-Z check-cfg` 功能在 1.80 版本中已稳定为默认行为。

关于指定自定义 cfgs 的信息，请参阅 [build script 文档](build-scripts.md#rustc-check-cfg)。

## 2024 版

2024 版已在 1.85 版本中稳定。有关设置版本的更多信息，请查看 [`edition` 字段](清单.md#the-edition-field)。关于迁移现有项目的更多信息，请参阅 [The Edition Guide](../../edition-guide/index.html) 和 [`cargo fix --edition`](../commands/cargo-fix.md)。

## 自动垃圾收集

在 Rust 1.88 中，自动删除旧文件的功能已稳定。更多信息可参见 [config 章节](config.md#cache)。

## doctest-xcompile

从 Rust 1.89 开始，Doctest 跨平台编译已无条件启用。使用 `cargo test` 运行 Doctests 时，现在会遵守 `--target` 标志。

## 包-工作区

多包发布功能在 Rust 1.90.0 中已稳定。

## build-dir

`build.build-dir` 的支持已在 1.91 版本中稳定。有关更改 build-dir 的信息，请参见 [config 文档](config.md#buildbuild-dir)。

## Build-plan

在1.93.0-nightly版本中，`build`命令的 `--build-plan`参数已被移除。关于其移除的原因，请参见<https://github.com/rust-lang/cargo/issues/7614>。

## config-include

在1.93.0版本中，通过`include`配置键包含额外配置文件的支持已稳定。更多内容请参阅[`include`配置文档](config.md#include)。

## pubtime

Rust 1.94.0版本中，`pubtime`索引字段已稳定。

## 特性-metadata

* 跟踪问题： [#14157](https://github.com/rust-lang/cargo/issues/14157) * RFC： [#3416](https://github.com/rust-lang/rfcs/blob/master/text/3416-特性-metadata.md)

这允许使用元数据表来定义功能。

```toml
cargo-features = ["feature-metadata"]

[package]
# ...

[features]
# same as `foo = []`
foo = { enables = [] }
```

必需的`enables`字段等同于数组-of-strings语法。

当启用`feature-metadata`时，`cargo metadata --format-version 1`会包含一个`features_v2`字段，与现有的`features`字段并列。它将每个功能作为一个具有`enables`数组和其他元数据字段的对象来呈现：

```json
"features_v2": {
  "foo": { "enables": [] },
  "serde": {
    "enables": ["dep:serde"],
    "doc": "Enables support for serialization via serde."
  }
}
```

其他元数据字段的相关内容请参阅以下小节。

### 特性-documentation

* 跟踪问题： [#17445](https://github.com/rust-lang/cargo/issues/17445) * RFC： [#3485](https://github.com/rust-lang/rfcs/blob/master/text/3485-特性-documentation.md)

这向功能表中添加了一个`doc`字段，用于提供功能的文档。

```toml
cargo-features = ["feature-metadata"]

[package]
# ...

[features.serde]
enables = []
doc = "Enables support for serialization and deserialization via serde."
```

文档可以被工具消费和显示。它可以是多行TOML字符串、包含多个段落，并使用Markdown标记，类似于Rust文档注释。在某些上下文中，工具可能只显示第一段落，因此描述应相对简短且合理，无需其他内容。

## 锁文件-path

Rust 1.97.0版本中，`resolver.lockfile-path`配置字段的支持已稳定。

## warnings

Rust 1.97版本中，`build.warnings`配置字段已稳定。

## update-breaking

在 1.99-nightly 版本中，`cargo update -Zunstable-options --breaking` 标志已被移除。有关其移除的原因，请参见 <https://github.com/rust-lang/cargo/pull/17333>。

## build-dir-new-layout

新的 build-dir 文件系统布局已在 1.100.0 版本中稳定化。

## `[lints.cargo]`

Cargo 的 linting 系统及 `[lints.cargo]` 表格已在 Rust 1.100 中稳定化。有关配置 Cargo lints 的信息，请参见 [lints 章节](lints.md) 和 [lints 部分](清单.md#the-lints-section)。

## min-publish-age

依赖解析的最小发布年龄配置已在 Rust 1.100 中稳定化。有关更多信息，请查看 [最小发布年龄配置](config.md#registryglobal-min-publish-age) 和 [解析器行为](resolver.md#publish-age)。

## asymmetric-token

`-Z asymmetric-token` 标志及 `cargo:paseto` 凭证提供程序已在 1.100-nightly 版本中移除。有关其移除的原因，请参见 <https://github.com/rust-lang/cargo/pull/17333>。

## trim-paths

`trim-paths` 配置选项已在 Rust 1.101 中稳定化。有关更多信息，请查看 [`trim-paths` 配置文件设置](profiles.md#trim-paths)。

[config file]: config.md
[nightly channel]: ../../book/appendix-07-nightly-rust.html
[stabilized]: https://doc.crates.io/contrib/process/unstable.html#stabilization
[nightly version]: https://doc.rust-lang.org/nightly/cargo/reference/unstable.html
[rust-lang/rust#64158]: https://github.com/rust-lang/rust/pull/64158
[`-Zhint-mostly-unused` flag]: ../../unstable-book/compiler-flags/hint-mostly-unused.html
[`blanket_hint_mostly_unused`]: lints.md#blanket_hint_mostly_unused
[`env!`]: https://doc.rust-lang.org/std/macro.env.html
[`cache.auto-clean-frequency`]: config.md#cacheauto-clean-frequency
[`cargo install`]: ../commands/cargo-install.md
[target tuple]: ../appendix/glossary.md#target '"target" (glossary)'
[`cargo logout`]: ../commands/cargo-logout.md
