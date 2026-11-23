## 使用发布配置文件自定义构建

在 Rust 中，_发布配置文件_是预定义的、可自定义的配置文件，具有不同的配置选项，使程序员能够更灵活地控制代码编译的各种选项。每个配置文件都是独立配置的。

Cargo 有两个主要配置文件：`dev` 配置文件用于运行 `cargo build` 时，而 `release` 配置文件用于运行 `cargo build --release` 时。`dev` 配置文件具有适合开发的默认设置，而 `release` 配置文件则具有适合发布构建的默认设置。

这些配置文件名称可能您在构建输出中见过：

<!-- manual-regeneration
在任意位置运行：`cargo build cargo build --release`，并确保以下输出准确 -->

```console
$ cargo build
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.00s
$ cargo build --release
    Finished `release` profile [optimized] target(s) in 0.32s
```

`dev` 和 `release` 就是编译器使用的这两种不同配置文件。

对于每个配置文件，Cargo 都有默认设置，当您未在项目的 `_Cargo.toml` 文件中明确添加 `[profile.*]` 部分时，这些默认设置就会生效。如果您要为任何想要自定义的配置文件添加 `[profile.*]` 部分，则会覆盖部分默认设置。例如，`dev` 和 `release` 配置文件的 `opt-level` 设置默认值如下：

<span class="filename">Filename: Cargo.toml</span>

```toml
[profile.dev]
opt-level = 0

[profile.release]
opt-level = 3
```

`opt-level` 设置控制 Rust 对代码进行的优化程度，范围从 0 到 3。更多的优化会延长编译时间，因此如果您处于开发阶段且经常编译代码，希望减少优化以加快编译速度，即使最终代码的运行速度变慢。因此，`dev` 配置的默认 `opt-level` 为 `0`。当您准备发布代码时，最好花更多时间进行编译。您在发布模式下只编译一次，但会多次运行编译后的程序，所以发布模式通过延长编译时间来换取更快的代码运行速度。这就是为什么 `release` 配置文件的默认 `opt-level` 为 `3` 的原因。

您可以在 `_Cargo.toml` 文件中添加不同的值来覆盖默认设置。例如，如果我们希望在开发配置文件中使用优化级别 1，可以在项目的 `_Cargo.toml` 文件中添加以下两行：

<span class="filename">Filename: Cargo.toml</span>

```toml
[profile.dev]
opt-level = 1
```

此代码将`0`的默认设置覆盖。现在当我们运行`cargo build`时，Cargo会使用`dev`配置文件的默认设置以及我们对`opt-level`的自定义设置。由于我们将`opt-level`设置为`1`，Cargo将应用比默认情况更多的优化，但数量不及发布构建时的优化。

关于每个配置文件的完整配置选项和默认设置列表，请参阅[Cargo文档](https://doc.rust-lang.org/cargo/reference/profiles.html)。
