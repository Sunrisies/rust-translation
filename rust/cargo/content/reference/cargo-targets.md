# Cargo 目标

Cargo 包由 *目标* 组成，这些目标对应于可以编译成库的源文件。包可以包含 [库](#library)、[二进制](#binaries)、[示例](#examples)、[测试](#tests)和 [基准测试](#benchmarks)目标。目标的列表可以在 `Cargo.toml` 清单中配置，通常根据源文件的 [目录结构][包 layout] 自动 [推断出来](#目标-auto-discovery)。

有关配置的详细信息，请参阅下面的 [配置目标](#configuring-a-目标)。

## 库

库目标定义了一个“库”，其他库和可执行程序可以使用和链接它。默认文件名为 `src/lib.rs`，库的名称默认为包名，其中所有连字符都被替换为下划线。一个包只能有一个库。库的配置可以在 `Cargo.toml` 的 `[lib]` 表中进行 [自定义]。

```toml
# Example of customizing the library in Cargo.toml.
[lib]
crate-type = ["cdylib"]
bench = false
```

## 二进制

二进制目标是可执行的程序，在编译后可以运行。二叉元的源文件可以是 `src/main.rs`，也可以存储在 [`src/bin/` 目录][包 layout]中。对于 `src/main.rs`，默认的二进制名称就是包名。每个二叉元的配置可以在 `Cargo.toml` 的 `[[bin]]` 表中进行 [自定义]。

二进制可以使用包的库的公共 API。它们还链接到 `Cargo.toml` 中定义的 [`[dependencies]`][dependencies]。

你可以使用 [`cargo run`] 命令加上 `--bin
<bin-name>` option. [`cargo install`] can be used to copy the executable to a
常见的位置来运行单个二进制文件。

```toml
# Example of customizing binaries in Cargo.toml.
[[bin]]
name = "cool-tool"
test = false
bench = false

[[bin]]
name = "frobnicator"
required-features = ["frobnicate"]
```

## 示例

位于 [`examples` 目录][包 layout]下的文件是库提供的功能的示例用法。在编译后，它们会被放入 [`target/debug/examples` 目录][build cache]中。

示例可以使用包的库的公共 API。它们还链接到 `Cargo.toml` 中定义的 [`[dependencies]`][dependencies]和 [`[dev-dependencies]`][dev-dependencies]。

默认情况下，示例为可执行的二进制文件（包含 `main()` 函数）。您可以通过指定 [`crate-type` 字段](#the-crate-type-field)使示例被编译为库形式：

```toml
[[example]]
name = "foo"
crate-type = ["staticlib"]
```

您可以使用 [`cargo run`] 命令并添加 `--example <example-name>` 选项来运行单个可执行示例。库示例则可以通过 [`cargo build`] 命令并添加 `--example <example-name>` 选项进行构建。使用 [`cargo install`] 命令并添加 `--example <example-name>` 选项可以将可执行二进制文件复制到公共位置。默认情况下，示例通过 [`cargo test`] 进行编译，以防止其被数据损坏。如果您在示例中包含需要通过 [`cargo test`] 运行的 `#[test]` 函数，请将 [the `test` 字段](#the-test-field) 设置为 `true`。

## 测试

Cargo 项目中有两种测试风格：

* *单元测试*：这些是由 [`#[test]` 属性][test-attribute]标记的函数，位于您的库或二进制文件中（或任何具有 [the `test` 字段](#the-test-field) 启用的目标中）。这些测试可以访问其定义的目标内的私有 API。
* *集成测试*：这是一个单独的可执行二进制文件，也包含 `#[test]` 函数，它与项目的库链接并可以访问其 *公共* API。

测试通过 [`cargo test`] 命令运行。默认情况下，Cargo 和 `rustc` 使用 [libtest harness]，该工具负责收集带有 [`#[test]` 属性][test-attribute]的函数，并并行执行它们，同时报告每个测试的成功与失败情况。如果您希望使用不同的 harness 或测试策略，请参阅 [the `harness` 字段](#the-harness-field)。

> [!NOTE]
> Cargo 还有另一种特殊的测试风格：[文档测试][documentation examples]。这些由 `rustdoc` 处理，其执行模式略有不同。有关更多信息，请参见 [`cargo test`][cargo-test-documentation-tests]。


### 集成测试

位于 [`tests` 目录][包 layout]下的文件是集成测试。当你运行 [`cargo test`]时，Cargo 会将这些文件分别编译为独立的 crate 并执行它们。

集成测试可以使用该包库的公共 API。它们还会链接到 `Cargo.toml` 中定义的 [`[dependencies]`][dependencies]和 [`[dev-dependencies]`][dev-dependencies]。

如果你希望在多个集成测试中共享代码，可以将代码放在如 `tests/common/mod.rs` 这样的独立模块中，然后在每个测试中添加 `mod common;` 以导入该模块。

每个集成测试都会生成一个单独的可执行二进制文件，而 [`cargo test`]会按顺序运行它们。在某些情况下，这可能会效率低下，因为编译时间更长，且可能无法充分利用多核 CPU。如果你有大量的集成测试，可以考虑创建一个单一的集成测试，并将测试拆分为多个模块。libtest harness 会自动找到所有带有 `#[test]` 注释的函数并并行运行它们。你可以将模块名称传递给 [`cargo test`]以仅运行该模块内的测试。

如果存在集成测试，二进制目标就会自动构建。这允许集成测试执行二进制文件以验证和测试其行为。在集成测试构建和运行时，会设置 `CARGO_BIN_EXE_<name>` [环境变量]，以便使用 [`env` 宏]或 [`var` function]来定位可执行文件。


## 基准测试

基准测试提供了一种使用 [`cargo bench`]命令测试代码性能的方法。它们的结构与 [tests](#tests) 相同，每个基准测试函数都带有 `#[bench]` 属性注释。与 tests 类似：

* 基准测试位于 [`benches` 目录][包 layout]中。
* 在库和二进制文件中定义的基准函数可以访问其定义目标内的*私有* API。`benches` 目录中的基准测试可以使用*公共* API。
* [`bench` 字段](#the-bench-field)可用于默认指定哪些目标会被进行基准测试。[`harness` 字段](#the-harness-field)可用于禁用内置 harness。

> [!NOTE]
> `#[bench]` 属性目前不稳定，仅可在[夜间频道]使用。有些在 [crates.io](https://crates.io/keywords/benchmark)上的包可能有助于在稳定频道上运行基准测试，例如 [Criterion](https://crates.io/crates/criterion)。

## 配置目标

`Cargo.toml`中的所有 `[lib]`、`[[bin]]`、`[[example]]`、`[[test]]`和`[[bench]]`部分都支持类似的配置方式，用于指定目标如何构建。像`[[bin]]`这样的双括号部分是[TOML表格数组](https://toml.io/en/v1.0.0-rc.3#array-of-tables)，这意味着你可以编写多个`[[bin]]`部分来在你的 crate中生成多个可执行文件。你只能指定一个库，因此 `[lib]` 是一个普通的 TOML 表。

以下是每个目标的 TOML 设置概览，各字段将在下面详细描述。

```toml
[lib]
name = "foo"           # The name of the target.
path = "src/lib.rs"    # The source file of the target.
test = true            # Is tested by default.
doctest = true         # Documentation examples are tested by default.
bench = true           # Is benchmarked by default.
doc = true             # Is documented by default.
proc-macro = false     # Set to `true` for a proc-macro library.
harness = true         # Use libtest harness.
crate-type = ["lib"]   # The crate types to generate.
required-features = [] # Features required to build this target (N/A for lib).
```

### `name` 字段

`name` 字段指定目标名称，对应将生成的工件文件名。对于库而言，这是依赖项将用来引用的 crate 名称。

对于库目标，默认使用包名，其中所有连字符都被替换成下划线。对于默认二进制文件（`src/main.rs`），也默认使用包名，连字符不替换。对于[自动发现](#目标-auto-discovery)目标，默认使用目录或文件名。

除了 `[lib]` 之外，所有目标都需要此字段。

### `path` 字段

`path` 字段指定了 crate 源代码的位置，相对于 `Cargo.toml` 文件。

如果未指定，则使用基于目标名称的 [推断路径](#目标-auto-discovery)。

### `test` 字段

`test` 字段指示目标是否默认由 [`cargo test`] 进行测试。对于库、二进制文件和测试项目，默认值为 `true`。

> [!NOTE]
> 默认情况下，通过 [`cargo test`]构建示例以确保其能够继续编译，但默认不会进行 *测试*。将 `test = true` 设置为某个示例时，该示例将被构建为测试，并运行示例中定义的任何 `[#[test]`][test-attribute] 函数。

### `doctest` 字段

`doctest` 字段指示 [文档示例] 是否默认由 [`cargo test`] 进行测试。此选项仅适用于库，对其他部分没有影响。对于库，默认值为 `true`。

### `bench` 字段

`bench` 字段指示目标是否默认由 [`cargo bench`] 进行基准测试。对于库、二进制文件和基准测试项目，默认值为 `true`。

### `doc` 字段

`doc` 字段指示目标是否默认被 [`cargo doc`] 生成的文档包含。对于库和二进制文件，默认值为 `true`。

> [!NOTE]
> 如果二进制文件的名称与库目标相同，则将被跳过。

### `plugin` 字段

此选项已弃用且未使用。

### `proc-macro` 字段

`proc-macro` 字段表明该库是一个 [过程宏]([参考][proc-宏-reference])。此选项仅适用于 `[lib]` 目标。

### `harness` 字段

`harness` 字段表示 [`--test` 标志] 将被传递给 `rustc`，从而自动包含 libtest 库。libtest 库是收集和运行带有 `[#[test]` 属性][test-attribute] 标记的测试或带有 `#[bench]` 属性标记的基准测试的驱动程序。所有目标的默认值为 `true`。

如果设置为 `false`，则您需要自己定义 `main()` 函数来运行测试和基准测试。

测试在框架启用与否的情况下均启用 [`cfg(test)` 条件表达式][cfg-test]。

### `crate-type` 字段

`crate-type` 字段定义了目标将生成的 [crate types]。它是一个字符串数组，允许为单个目标指定多种 crate 类型。此选项仅适用于库和示例。二进制文件、测试和基准测试始终使用 "bin" crate 类型。默认值为：

目标 | crate Type
-------|-----------
普通库 | `"lib"` 过程宏库 | `"proc-macro"` 示例 | `"bin"`

可用的选项包括 `bin`、`lib`、`rlib`、`dylib`、`cdylib`、`staticlib` 和 `proc-macro`。您可以在 [Rust 参考手册][crate types]中了解不同 crate 类型的详细信息。

### `required-features` 字段

`required-features` 字段指定目标构建所需提供的 [features]。如果任何必需特性未启用，则跳过该目标。此选项仅适用于 `[[bin]]`、`[[bench]]`、`[[test]]` 和 `[[example]]]`部分，对 `[lib]` 没有影响。

```toml
[features]
# ...
postgres = []
sqlite = []
tools = []

[[bin]]
name = "my-pg-tool"
required-features = ["postgres", "tools"]
```

### `edition` 字段

`edition` 字段定义目标将使用的 [Rust edition]。如果未指定，则默认为 `[package]` 的 [`edition` 字段][包-edition]。

> [!IMPORTANT]
> 该字段已弃用，将在未来版本中移除。

## 目标自动发现

默认情况下，Cargo 根据文件系统的 [目录结构][包 layout] 自动确定要构建的目标。可以使用目标配置表，如 `[lib]`、`[[bin]]`、`[[test]]`、`[[bench]]` 或 `[[example]]`，来添加不符合标准目录结构的额外目标。

可以禁用自动目标发现，以便仅构建手动配置的目标。在 `[package]` 部分将键 `autolib`、`autobins`、`autoexamples`、`autotests` 或 `autobenches` 设置为 `false`，即可禁用对应目标类型的自动发现。

```toml
[package]
# ...
autolib = false
autobins = false
autoexamples = false
autotests = false
autobenches = false
```

仅在特定情况下才需要禁用自动发现。例如，如果你有一个包含名为 `bin` 的 *模块* 的库，这将导致问题，因为 Cargo 通常会尝试将 `bin` 目录中的任何内容编译为可执行文件。以下是该场景的示例布局：

```text
├── Cargo.toml
└── src
    ├── lib.rs
    └── bin
        └── mod.rs
```

为了阻止 Cargo 将 `src/bin/mod.rs` 识别为可执行文件，请在 `Cargo.toml` 中设置 `autobins = false` 以禁用自动发现：

```toml
[package]
# …
autobins = false
```

> [!NOTE]
> 对于 2015 版包，如果 `Cargo.toml` 中至少定义了一个目标，则自动发现的默认值为 `false`。从 2018 版开始，默认值始终为 `true`。

> **MSRV:** 自 1.27 版本起，对 `autobins`、`autoexamples`、`autotests` 和 `autobenches` 有支持

> **MSRV:** 自 1.83 版本起，对 `autolib` 有支持

[libtest harness]: ../../rustc/tests/index.html
[cargo-test-documentation-tests]: ../commands/cargo-test.md#documentation-tests
[environment variable]: environment-variables.md#environment-variables-cargo-sets-for-crates
[`env` macro]: ../../std/macro.env.html
[`var` function]: ../../std/env/fn.var.html
[Build cache]: build-cache.md
[Rust Edition]: ../../edition-guide/index.html
[`--test` flag]: ../../rustc/command-line-arguments.html#option-test
[`cargo bench`]: ../commands/cargo-bench.md
[`cargo build`]: ../commands/cargo-build.md
[`cargo doc`]: ../commands/cargo-doc.md
[`cargo install`]: ../commands/cargo-install.md
[`cargo run`]: ../commands/cargo-run.md
[`cargo test`]: ../commands/cargo-test.md
[cfg-test]: ../../reference/conditional-compilation.html#test
[crate types]: ../../reference/linkage.html
[crates.io]: https://crates.io/
[customized]: #configuring-a-target
[dependencies]: specifying-dependencies.md
[dev-dependencies]: specifying-dependencies.md#development-dependencies
[documentation examples]: ../../rustdoc/documentation-tests.html
[features]: features.md
[nightly channel]: ../../book/appendix-07-nightly-rust.html
[package layout]: ../guide/project-layout.md
[package-edition]: manifest.md#the-edition-field
[proc-macro-reference]: ../../reference/procedural-macros.html
[procedural macro]: ../../book/ch19-06-macros.html
[test-attribute]: ../../reference/attributes/testing.html#the-test-attribute
