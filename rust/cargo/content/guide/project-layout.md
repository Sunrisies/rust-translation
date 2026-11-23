# 包结构

Cargo 采用特定的文件放置规范，以便轻松操作新的 Cargo [包][def-包]：

```text
.
├── Cargo.lock
├── Cargo.toml
├── src/
│   ├── lib.rs
│   ├── main.rs
│   └── bin/
│       ├── named-executable.rs
│       ├── another-executable.rs
│       └── multi-file-executable/
│           ├── main.rs
│           └── some_module.rs
├── benches/
│   ├── large-input.rs
│   └── multi-file-bench/
│       ├── main.rs
│       └── bench_module.rs
├── examples/
│   ├── simple.rs
│   └── multi-file-example/
│       ├── main.rs
│       └── ex_module.rs
└── tests/
    ├── some-integration-tests.rs
    └── multi-file-test/
        ├── main.rs
        └── test_module.rs
```

* `Cargo.toml` 和 `Cargo.lock` 存储在你的包根目录中（*包根*）。
* 源代码放在 `src` 目录下。
* 默认库文件为 `src/lib.rs`。
* 默认可执行文件为 `src/main.rs`。
* 其他可执行文件可以放在 `src/bin/` 下。
* 基准测试放在 `benches` 目录中。
* 示例代码放在 `examples` 目录中。
* 集成测试放在 `tests` 目录中。

如果二进制文件、示例、基准测试或集成测试包含多个源文件，请将额外的 [*模块*][def-module] 与 `main.rs` 文件一起放置在 `src/bin`、`examples`、`benches` 或 `tests` 目录下的子目录中。可执行文件的名称将与该目录名相同。

> [!NOTE]
> 按照惯例，二进制文件、示例、基准测试和集成测试采用 `kebab-case` 命名风格，除非有兼容性问题需要其他风格（例如与现有二进制文件名兼容）。这些目标中的模块采用遵循 [Rust 标准](https://rust-lang.github.io/rfcs/0430-finalizing-naming-conventions.html) 的 `snake_case` 风格。

您可以在 [这本书][book-modules] 中了解有关 Rust 模块系统的更多信息。

有关手动配置目标的更多细节，请参阅 [配置目标]。有关控制 Cargo 如何自动推断目标名称的信息，请参阅 [目标自动发现]。

[book-modules]: ../../book/ch07-00-managing-growing-projects-with-packages-crates-and-modules.html
[Configuring a target]: ../reference/cargo-targets.md#configuring-a-target
[def-package]:           ../appendix/glossary.md#package          '"package" (glossary entry)'
[def-module]:            ../appendix/glossary.md#module           '"module" (glossary entry)'
[Target auto-discovery]: ../reference/cargo-targets.md#target-auto-discovery
