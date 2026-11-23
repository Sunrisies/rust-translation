# 外部工具

Cargo 的一个目标就是与第三方工具（如 IDE 和其他构建系统）简单集成。为了便于集成，Cargo 提供了多种功能：

* 一个 [`cargo metadata`] 命令，该命令以 JSON 格式输出包结构和依赖信息，

* `--message-format` 标志，用于输出关于特定构建的信息，以及

* 对自定义子命令的支持。


## 关于包结构的信息

您可以使用 [`cargo metadata`] 命令获取包结构和依赖信息。有关输出格式的详细信息，请参阅 [`cargo metadata`] 文档。

该格式是稳定的且有版本号。调用 `cargo metadata` 时，应明确传递 `--format-version` 标志，以避免向前不兼容问题。

如果您使用 Rust，可以使用 [cargo_metadata] crate 来解析输出结果。


## JSON 消息

当传递 `--message-format=json` 时，Cargo 在构建过程中将输出以下信息：

* 编译器错误和警告，

* 生成的工件，

* 构建脚本的结果（例如，原生依赖）。

输出以 JSON 对象的形式逐行显示在标准输出中。`reason` 字段用于区分不同类型的消息。`package_id` 字段是引用包的唯一标识符，也可作为许多命令的 `--package` 参数使用。语法规则可在 [包 ID Specifications] 章节中找到。

> [!NOTE]
> `--message-format=json` 仅控制 Cargo 和 Rustc 的输出。这无法控制其他工具的输出，例如 `cargo run --message-format=json`，或过程式宏的任意输出。在这种情况下，一种可能的解决方案是只将以 `{` 开头的行解释为 JSON。

`--message-format` 选项还可以接受额外的格式值，这些值会改变 JSON 消息的计算和渲染方式。有关更多细节，请参阅 [构建命令文档] 中 `--message-format` 选项的说明。

如果您使用 Rust，可以使用 [cargo_metadata] crate 来解析这些消息。

> **MSRV:** `package_id` 必须符合 包 ID Specification 标准，因此要求为 1.77。在此之前，该值是不透明的。


### 编译器消息

“compiler-message” 消息包含编译器的输出，如警告和错误。有关 `rustc` 消息格式的详细信息，请参阅 [rustc JSON 章节](../../rustc/json.md)，该格式嵌入在以下结构中。

```javascript
{
    /* The "reason" indicates the kind of message. */
    "reason": "compiler-message",
    /* The Package ID, a unique identifier for referring to the package. */
    "package_id": "file:///path/to/my-package#0.1.0",
    /* Absolute path to the package manifest. */
    "manifest_path": "/path/to/my-package/Cargo.toml",
    /* The Cargo target (lib, bin, example, etc.) that generated the message. */
    "target": {
        /* Array of target kinds.
           - lib targets list the `crate-type` values from the
             manifest such as "lib", "rlib", "dylib",
             "proc-macro", etc. (default ["lib"])
           - binary is ["bin"]
           - example is ["example"]
           - integration test is ["test"]
           - benchmark is ["bench"]
           - build script is ["custom-build"]
        */
        "kind": [
            "lib"
        ],
        /* Array of crate types.
           - lib and example libraries list the `crate-type` values
             from the manifest such as "lib", "rlib", "dylib",
             "proc-macro", etc. (default ["lib"])
           - all other target kinds are ["bin"]
        */
        "crate_types": [
            "lib"
        ],
        /* The name of the target.
           For lib targets, dashes will be replaced with underscores.
        */
        "name": "my_package",
        /* Absolute path to the root source file of the target. */
        "src_path": "/path/to/my-package/src/lib.rs",
        /* The Rust edition of the target.
           Defaults to the package edition.
        */
        "edition": "2018",
        /* Array of required features.
           This property is not included if no required features are set.
        */
        "required-features": ["feat1"],
        /* Whether the target should be documented by `cargo doc`. */
        "doc": true,
        /* Whether or not this target has doc tests enabled, and
           the target is compatible with doc testing.
        */
        "doctest": true
        /* Whether or not this target should be built and run with `--test`
        */
        "test": true
    },
    /* The message emitted by the compiler.

    See https://doc.rust-lang.org/rustc/json.html for details.
    */
    "message": {
        /* ... */
    }
}
```

### 工件消息

每个编译步骤都会生成具有以下结构的“compiler-artifact”消息：

```javascript
{
    /* The "reason" indicates the kind of message. */
    "reason": "compiler-artifact",
    /* The Package ID, a unique identifier for referring to the package. */
    "package_id": "file:///path/to/my-package#0.1.0",
    /* Absolute path to the package manifest. */
    "manifest_path": "/path/to/my-package/Cargo.toml",
    /* The Cargo target (lib, bin, example, etc.) that generated the artifacts.
       See the definition above for `compiler-message` for details.
    */
    "target": {
        "kind": [
            "lib"
        ],
        "crate_types": [
            "lib"
        ],
        "name": "my_package",
        "src_path": "/path/to/my-package/src/lib.rs",
        "edition": "2018",
        "doc": true,
        "doctest": true,
        "test": true
    },
    /* The profile indicates which compiler settings were used. */
    "profile": {
        /* The optimization level. */
        "opt_level": "0",
        /* The debug level, an integer of 0, 1, or 2, or a string
           "line-directives-only" or "line-tables-only". If `null`, it implies
           rustc's default of 0.
        */
        "debuginfo": 2,
        /* Whether or not debug assertions are enabled. */
        "debug_assertions": true,
        /* Whether or not overflow checks are enabled. */
        "overflow_checks": true,
        /* Whether or not the `--test` flag is used. */
        "test": false
    },
    /* Array of features enabled. */
    "features": ["feat1", "feat2"],
    /* Array of files generated by this step. */
    "filenames": [
        "/path/to/my-package/target/debug/libmy_package.rlib",
        "/path/to/my-package/target/debug/deps/libmy_package-be9f3faac0a26ef0.rmeta"
    ],
    /* A string of the path to the executable that was created, or null if
       this step did not generate an executable.
    */
    "executable": null,
    /* Whether or not this step was actually executed.
       When `true`, this means that the pre-existing artifacts were
       up-to-date, and `rustc` was not executed. When `false`, this means that
       `rustc` was run to generate the artifacts.
    */
    "fresh": true
}

```

### 构建脚本输出

“build-script-executed” 消息包含构建脚本的解析输出。请注意，即使未运行构建脚本也会发出此消息，它会显示之前缓存的值。有关构建脚本输出的更多细节，请参阅 [构建脚本章节](build-scripts.md)。

```javascript
{
    /* The "reason" indicates the kind of message. */
    "reason": "build-script-executed",
    /* The Package ID, a unique identifier for referring to the package. */
    "package_id": "file:///path/to/my-package#0.1.0",
    /* Array of libraries to link, as indicated by the `cargo::rustc-link-lib`
       instruction. Note that this may include a "KIND=" prefix in the string
       where KIND is the library kind.
    */
    "linked_libs": ["foo", "static=bar"],
    /* Array of paths to include in the library search path, as indicated by
       the `cargo::rustc-link-search` instruction. Note that this may include a
       "KIND=" prefix in the string where KIND is the library kind.
    */
    "linked_paths": ["/some/path", "native=/another/path"],
    /* Array of cfg values to enable, as indicated by the `cargo::rustc-cfg`
       instruction.
    */
    "cfgs": ["cfg1", "cfg2=\"string\""],
    /* Array of [KEY, VALUE] arrays of environment variables to set, as
       indicated by the `cargo::rustc-env` instruction.
    */
    "env": [
        ["SOME_KEY", "some value"],
        ["ANOTHER_KEY", "another value"]
    ],
    /* An absolute path which is used as a value of `OUT_DIR` environmental
       variable when compiling current package.
    */
    "out_dir": "/some/path/in/target/dir"
}
```

### 构建完成

“build-finished” 消息在构建结束时发出。

```javascript
{
    /* The "reason" indicates the kind of message. */
    "reason": "build-finished",
    /* Whether or not the build finished successfully. */
    "success": true,
}
````

此消息有助于工具知道何时停止读取 JSON 消息。诸如 `cargo test` 或 `cargo run` 之类的命令在构建完成后会产生额外输出。此消息告诉工具 Cargo 不会产生额外的 JSON 消息，但之后可能会生成其他输出（例如由 `cargo run` 执行的程序产生的输出）。

> [!NOTE]
> 目前有实验性版本仅支持测试的 JSON 输出，因此如果启用了该功能，在“build-finished”消息之后可能会开始出现针对测试的额外 JSON 消息。

## 自定义子命令

Cargo 设计允许通过添加新子命令来扩展其功能，而无需修改 Cargo 本身。这是通过将形式为 cargo `(?<command>[^ ]+)` 的调用转换为外部工具 `cargo-${command}` 的调用来实现的。该外部工具必须存在于用户的 `$PATH` 目录中。

> [!NOTE]
> Cargo 默认将 `$CARGO_HOME/bin` 中的外部工具优先于 `$PATH`。用户可以通过将 `$CARGO_HOME/bin` 添加到 `$PATH` 来覆盖此优先级。

当 Cargo 调用自定义子命令时，子命令的第一个参数将是自定义子命令的文件名，与通常情况相同。第二个参数则是子命令名称本身。例如，在调用 `cargo-${command}` 时，第二个参数将为 `${command}`。命令行上的任何额外参数将保持不变地传递。

使用 `cargo help ${command}` 也可以显示自定义子命令的帮助输出。Cargo 假设如果子命令的第三个参数为 `--help`，则会打印帮助信息。因此，`cargo help ${command}` 将会调用 `cargo-${command} ${command} --help`。

自定义子命令可以使用 `CARGO` 环境变量来调用 Cargo。或者，也可以将 `cargo` crate 作为库链接使用，但这种方法存在缺点：

* 作为库的 Cargo 不稳定：API 可能会在不废弃的情况下发生变化 * 链接的 Cargo 库版本可能与 Cargo 二进制文件不同

因此，建议使用 CLI 接口来驱动 Cargo。可以使用 [`cargo metadata`] 命令获取当前项目的信息（[`cargo_metadata`] crate 提供了该命令的 Rust 接口）。

[cargo_metadata]: https://crates.io/crates/cargo_metadata
[`cargo metadata`]: ../commands/cargo-metadata.md
[build command documentation]: ../commands/cargo-build.md
[cargo_metadata]: https://crates.io/crates/cargo_metadata
[Package ID Specifications]: ./pkgid-spec.md
[`cargo metadata`]: ../commands/cargo-metadata.md
[`cargo_metadata`]: https://crates.io/crates/cargo_metadata
