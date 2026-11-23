# 构建缓存

Cargo将构建输出存储在“目标”和“build”目录中。默认情况下，这两个目录都指向[*工作空间*][def-工作区]根目录下的`target`目录。要更改target-dir的位置，可以设置`CARGO_TARGET_DIR`环境变量、 [`build.target-dir`]配置值或 `--target-dir`命令行标志。要更改build-dir的位置，可以设置`CARGO_BUILD_BUILD_DIR`环境变量或 [`build.build-dir`]配置值。

产物分为两类：* 最终构建产物 * 最终构建产物是供Cargo最终用户使用的输出，例如bin crate的二进制文件、`cargo doc`的输出以及Cargo `--timings`报告 * 存储在target-dir中 * 中间构建产物 * 中间构建产物是Cargo和Rust编译器内部使用的，通常最终用户无需与中间构建产物交互 * 存储在Cargo build-dir中

目录布局取决于您是否使用 `--target`标志为特定平台构建。如果未指定 `--target`，Cargo将以适用于主机架构的模式运行。输出将存储在目标目录的根目录下，每个[配置文件]则存储在一个独立的子目录中：

目录 | 描述
----------|------------
<code style="white-space: nowrap">target/debug/</code> | Contains output for the `dev` profile.
<code style="white-space: nowrap">target/release/</code> | Contains output for the `release` profile (with the `--release` option).
<code style="white-space: nowrap">target/foo/</code> | Contains build output for the `foo` profile (with the `--profile=foo` option).

出于历史原因，`dev`和`test`配置文件存储在`debug`目录中，而`release`和`bench`配置文件存储在`release`目录中。用户定义的配置文件则存储在与配置文件名称相同的目录中。

当使用 `--target`为其他目标构建时，输出将存放在与[目标]名称相同的目录中：

目录 | 示例
----------|--------
<code style="white-space: nowrap">target/&lt;tuple&gt;/debug/</code> | <code style="white-space: nowrap">target/thumbv7em-none-eabihf/debug/</code>
<code style="white-space: nowrap">target/&lt;tuple&gt;/release/</code> | <code style="white-space: nowrap">target/thumbv7em-none-eabihf/release/</code>

> [!NOTE]
> 当不使用 `--target`时，会导致Cargo将与构建脚本和proc宏共享您的依赖项。 [`RUSTFLAGS`]将会与每个`rustc`调用共享。使用 `--target`标志时，构建脚本和proc宏将独立构建（适用于主机架构），并且不会共享`RUSTFLAGS`。

在配置文件目录中（例如 `debug` 或 `release`），工件被放置到以下目录中：

目录 | 描述
----------|------------
<code style="white-space: nowrap">target/debug/</code> | Contains the output of the package being built (the [binary executables] and [library targets]).
<code style="white-space: nowrap">target/debug/examples/</code> | Contains [example targets].

某些命令将其输出放在 `target` 目录顶层的专用目录中：

目录 | 描述
----------|------------
<code style="white-space: nowrap">target/doc/</code> | Contains rustdoc documentation ([`cargo doc`]).
<code style="white-space: nowrap">target/package/</code> | Contains the output of the [`cargo package`].

Cargo 还在构建目录中创建几个其他目录和文件，这些文件对构建过程至关重要。构建目录的布局是 Cargo 内部使用的，可能会发生变化。其中一些目录包括：

目录 | 描述
----------|------------
<code style="white-space: nowrap">\<build-dir>/debug/incremental/</code> | `rustc` [incremental output], a cache used to speed up subsequent builds.
<code style="white-space: nowrap">\<build-dir>/debug/build/</code> | Build step results including compilation artifacts and [build script] output.

> [!NOTE]
> 构建目录的布局在 Cargo 1.100.0 版本中发生了变化，因此之前的版本使用不同的布局。（参见 [#15010](https://github.com/rust-lang/cargo/issues/15010)）

## Dep-info 文件

每个编译后的工件旁边都有一个名为“dep info”文件的文件，该文件以 `.d` 作为后缀。这个文件采用类似 Makefile 的语法，列出了重建该工件所需的所有文件依赖项。这些文件旨在与外部构建系统一起使用，以便检测是否需要重新执行 Cargo。文件中的路径默认是绝对路径。如需使用相对路径，请参阅 [`build.dep-info-basedir`] 配置选项。

```Makefile
# Example dep-info file found in target/debug/foo.d
/path/to/myproj/target/debug/foo: /path/to/myproj/src/lib.rs /path/to/myproj/src/main.rs
```

## 共享缓存

第三方工具 [sccache] 可用于在不同工作空间之间共享构建后的依赖项。

要设置 `sccache`，请使用 `cargo install --locked sccache` 安装它，并在调用 Cargo 之前将 `RUSTC_WRAPPER` 环境变量设置为 `sccache`。如果您使用 bash，建议在 `.bashrc` 中添加 `export RUSTC_WRAPPER=sccache`。或者，您可以在 [Cargo 配置][config] 中设置 [`build.rustc-wrapper]`。更多细节请参考 sccache 文档。

[`RUSTFLAGS`]: ../reference/config.md#buildrustflags
[`build.dep-info-basedir`]: ../reference/config.md#builddep-info-basedir
[`build.rustc-wrapper`]: ../reference/config.md#buildrustc-wrapper
[`build.target-dir`]: ../reference/config.md#buildtarget-dir
[`build.build-dir`]: ../reference/config.md#buildbuild-dir
[`cargo doc`]: ../commands/cargo-doc.md
[`cargo package`]: ../commands/cargo-package.md
[`cargo publish`]: ../commands/cargo-publish.md
[build script]: ../reference/build-scripts.md
[config]: ../reference/config.md
[def-workspace]:  ../appendix/glossary.md#workspace  '"workspace" (glossary entry)'
[target]: ../appendix/glossary.md#target '"target" (glossary entry)'
[environment variable]: ../reference/environment-variables.md
[incremental output]: ../reference/profiles.md#incremental
[sccache]: https://github.com/mozilla/sccache
[profile]: ../reference/profiles.md
[binary executables]: ../reference/cargo-targets.md#binaries
[library targets]: ../reference/cargo-targets.md#library
[example targets]: ../reference/cargo-targets.md#examples
