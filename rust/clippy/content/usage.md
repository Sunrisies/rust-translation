# Usage

本章介绍了如何充分利用 Clippy。可以将 Clippy作为 `cargo` 子命令使用，或者像使用 `rustc` 一样直接通过 `clippy-driver` 二进制文件使用。

> [!NOTE] > 本章假设您已经安装了 Clippy。如果您不确定，请参考 [安装] 章节。

## Cargo 子命令

运行 Clippy最简单且最常用的方法是通过 `cargo`。只需执行以下命令即可。

```bash
cargo clippy
```

### lint 配置

上述命令将运行默认的 lints，这些 lints 包含在 `clippy::all` lint 组中。您可能希望使用更多的 lints，或者您可能不认同所有的 Clippy lints，为此有办法配置 lint 级别。

> [!NOTE] > Clippy 应该通过在代码中大量使用 `#[allow(..)]` 来使用。因此，如果您不同意某个 lint，不要因为禁用该 lint 对于部分代码或整个项目而感到难过。

#### 命令行方式

您可以通过在命令中添加 `-A/W/D clippy::lint_name` 来配置 lint 级别。

```bash
cargo clippy -- -Aclippy::style -Wclippy::box_default -Dclippy::perf
```

#### 将警告升级为错误

对于 [CI]，所有警告都可以被升级为错误，这将导致构建失败，并使 Clippy 以非 `0` 的码退出。

自 Cargo 1.97 以来，推荐的方式是使用 [`build.warnings`] 配置选项。

可以通过环境变量在命令行中启用它：

```bash
CARGO_BUILD_WARNINGS=deny cargo clippy
```

.. 或者永久地在 `.cargo/config.toml` 中设置：

```toml
# .cargo/config.toml
[build]
warnings = "deny"
```

> [!NOTE] > 使用 `CARGO_BUILD_WARNINGS=deny` (或 `-D warnings`) 将在代码中发现**任何**警告时导致构建失败。这包括 rustc 发现的警告（例如 `dead_code` 等）。

如果您使用的是较旧版本的 Cargo，可以使用以下方法：

```bash
cargo clippy -- -Dwarnings
```

不过请注意，这将使构建缓存失效，因此不推荐这样做。


有关配置 lint 级别的更多信息，请参阅 [rustc 文档]。


#### 更多 lints

Clippy 拥有默认启用的 lint 组，这意味着您必须手动启用这些组中的 lint。

有关所有 lint 及其描述和示例的完整列表，请参考 [Clippy 的 lint 列表]。以下是两个最重要的默认启用 lint 组：


##### `clippy::pedantic`

第一个组是 `pedantic` 组。该组包含非常严格的 lint，为了避免误报，其中可能有一些故意的假阳性。因此，虽然这个组可以直接用于生产环境，但您可能会在代码中添加多个 `#[allow(..)]` 注解。如果您发现任何假阳性，欢迎向我们报告以进行改进。

> 供参考：Clippy 使用整个组来对自己的代码进行 lint 检查。

##### `clippy::restriction`

第二个组是 `restriction` 组。该组包含以某种方式“限制”语言的 lint。例如，来自此组的 `clippy::unwrap` lint 不允许您在代码中使用 `.unwrap()`。您可能需要查看该组中的 lint，并启用符合您需求的那些。

> [!NOTE] > 您不应启用整个 lint 组，而应从该组中挑选特定的 lint。该组中的一些 lint 甚至可能与其他 Clippy lint 冲突！

#### 过多的 lint

Clippy 中默认启用的警告最多的组是 `clippy::style` 组。有些人更喜欢完全禁用这个组，然后从其中挑选他们喜欢的某些 lint。当然，对于 Clippy 的其他 lint 组也可以这样做。

> [!NOTE] > 我们努力让默认启用的警告组没有假阳性 (FP)。如果您发现某个 lint 错误地触发了警告，请通过问题报告它（如果还没有针对该 FP 的问题）。

#### 源代码

您可以在源代码中以与配置 `rustc` lint 相同的方式配置 lint 级别。

```rust,ignore
#![allow(clippy::style)]

#[warn(clippy::box_default)]
fn main() {
    let _ = Box::<String>::new(Default::default());
    // ^ warning: `Box::new(_)` of default value
}
```

### 自动应用 Clippy 建议

Clippy 可以像编译器一样自动应用一些 lint 建议。请注意，`--fix` 意味着 `--all-targets`，因此它可以修复尽可能多的代码。

```terminal
cargo clippy --fix
```

### Workspaces

所有常见的工作区选项都应该能使用 Clippy。例如，以下命令将在您的工作区中的 `example` crate 上运行 Clippy：

```terminal
cargo clippy -p example
```

与 `cargo check` 类似，这包括了属于工作区的依赖项，如路径依赖项。如果您只想在指定的 crate 上运行 Clippy，请使用 `--no-deps` 选项。

```terminal
cargo clippy -p example -- --no-deps
```

## 不使用 `cargo` 时使用 Clippy：`clippy-driver`

即使项目不使用 cargo，也可以使用 Clippy。为此，请使用与 `rustc` 相同的参数运行 `clippy-driver`。例如：

```terminal
clippy-driver --edition 2018 -Cpanic=abort foo.rs
```

> [!NOTE] > `clippy-driver` 是专为运行 Clippy而设计的，不应作为 `rustc` 的通用替代方案使用。`clippy-driver` 可能会产生不符合预期优化的产物，例如。

[`build.warnings`]: https://doc.rust-lang.org/cargo/reference/config.html#buildwarnings
[rustc documentation]: https://doc.rust-lang.org/rustc/lints/levels.html#configuring-warning-levels
[Clippy's lint list]: https://rust-lang.github.io/rust-clippy/main/index.html
[Installation]: installation.md
[CI]: continuous_integration/index.md
