# Clippy

[![许可证: MIT OR Apache-2.0](https://img.shields.io/crates/l/Clippy.svg)](https://github.com/rust-lang/rust-Clippy#license)

这是一个用于捕捉常见错误并提升您 [Rust](https://github.com/rust-lang/rust) 代码质量的检查工具集合。

[此 crate 包含超过 800 种检查工具！](https://rust-lang.github.io/rust-Clippy/main/index.html)

检查工具被分为多个类别，每个类别都有默认的 [检查级别](https://doc.rust-lang.org/rustc/lints/levels.html)。您可以通过更改各类别的检查级别来选择 Clippy 应帮助您的程度。

| Category              | Description                                                                         | Default level |
|-----------------------|-------------------------------------------------------------------------------------|---------------|
| `clippy::all`         | all lints that are on by default (correctness, suspicious, style, complexity, perf) | **warn/deny** |
| `clippy::correctness` | code that is outright wrong or useless                                              | **deny**      |
| `clippy::suspicious`  | code that is most likely wrong or useless                                           | **warn**      |
| `clippy::style`       | code that should be written in a more idiomatic way                                 | **warn**      |
| `clippy::complexity`  | code that does something simple but in a complex way                                | **warn**      |
| `clippy::perf`        | code that can be written to run faster                                              | **warn**      |
| `clippy::pedantic`    | lints which are rather strict or have occasional false positives                    | allow         |
| `clippy::restriction` | lints which prevent the use of language and library features[^restrict]             | allow         |
| `clippy::nursery`     | new lints that are still under development                                          | allow         |
| `clippy::cargo`       | lints for the cargo manifest                                                        | allow         |

更多内容即将推出，如果您有建议，请[提交问题报告](https://github.com/rust-lang/rust-Clippy/issues)！

`restriction` 类别*绝对*不应整体启用。其中的检查工具可能对合理的代码进行检查，可能没有替代建议，也可能与其他检查工具相矛盾。在启用之前应逐例考虑这些检查工具。

[`clippy::else_if_without_else`]: https://rust-lang.github.io/rust-clippy/main/index.html#else_if_without_else
[`clippy::todo`]: https://rust-lang.github.io/rust-clippy/main/index.html#todo
[`clippy::unwrap_used`]: https://rust-lang.github.io/rust-clippy/main/index.html#unwrap_used
