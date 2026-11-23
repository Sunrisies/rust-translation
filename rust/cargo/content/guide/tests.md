# 测试

使用 `cargo test` 命令即可运行你的测试。Cargo会在两个地方查找要运行的测试：你的每个 `src` 文件中，以及 `tests/` 目录中的任何测试文件。你的 `src` 文件中的测试应为单元测试和[文档测试]。`tests/` 目录中的测试应为集成风格测试。因此，你需要将你的crates导入到 `tests/` 目录中的文件中。

以下是在我们的[包][def-包]中运行 `cargo test` 的示例，该包目前没有测试：

```console
$ cargo test
   Compiling regex v1.5.0 (https://github.com/rust-lang/regex.git#9f9f693)
   Compiling hello_world v0.1.0 (file:///path/to/package/hello_world)
     Running target/test/hello_world-9c2b65bbb79eabce

running 0 tests

test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```

如果你的包有测试，你会看到更多输出以及正确数量的测试结果。

你也可以通过传递过滤器来运行特定的测试：

```console
$ cargo test foo
```

这将运行名称中包含 `foo` 的任何测试。

`cargo test` 还会执行额外的检查。它会编译你包含的示例以确保它们仍然可以编译。它还会运行文档测试，确保来自文档注释的代码示例能够编译。请参考Rust文档中的[测试指南][testing]以了解编写和组织测试的一般方法。请参阅[Cargo Targets: Tests]以了解更多关于Cargo中不同测试风格的信息。

[documentation tests]: ../../rustdoc/write-documentation/documentation-tests.html
[def-package]:  ../appendix/glossary.md#package  '"package" (glossary entry)'
[testing]: ../../book/ch11-00-testing.html
[Cargo Targets: Tests]: ../reference/cargo-targets.html#tests
