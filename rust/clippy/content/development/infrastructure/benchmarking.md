# 对 Clippy 的基准测试

对 Clippy 进行基准测试与使用我们的 Lintcheck 工具类似，实际上甚至使用了相同的工具！只需添加 `--perf` 标志，即可将 Lintcheck 转换为一个非常简单但强大的基准测试工具！

需要安装 [`perf` 工具][perf]，因为 `perf` 正是底层对 Clippy 进行性能分析的工具。

lintcheck `--perf` 工具会在 `target/lintcheck/sources/<package>-<version>` 目录中生成一系列 `perf.data` 文件。每个 `perf.data` 对应所包含的包。

Lintcheck 使用 `-g` 标志，这意味着你可以获取堆栈跟踪以进行更丰富的分析，包括使用 [flamegraph][flamegraph-perf]（或 [`flamegraph-rs`][flamegraph-rs]）等工具。

目前，我们仅测量指令数量，因为这是最可重复的指标，[rustc-perf][rustc-perf] 也将其视为主要关注点。

## 对 PR 进行基准测试

将基准测试工具直接集成到 lintcheck 中，使我们能够只需记录“之前”和“之后”的状态即可对任何给定的 PR 进行基准测试。

以下是进入任何 PR、对其进行基准测试，然后基准测试 `main` 的方法。

第一个 `perf.data` 文件不会附加任何数字，但后续的所有基准测试数据都会写入 `perf.data.number`，并且该数字会持续增加。所有基准测试数据都会被压缩，以便你可以...

```bash
git fetch upstream pull/<PR_NUMBER>/head:<BRANCH_NAME>
git switch BRANCHNAME

# Bench
cargo lintcheck --perf

# Get last common commit, checkout that
LAST_COMMIT=$(git log BRANCHNAME..main --oneline | tail -1 | cut -c 1-11)
git switch -c temporary $LAST_COMMIT

# We're now on main

# Bench
cargo lintcheck --perf
perf diff ./target/lintcheck/sources/CRATE/perf.data ./target/lintcheck/sources/CRATE/perf.data.0
```

[perf]: https://perfwiki.github.io/main/
[flamegraph-perf]: https://github.com/brendangregg/FlameGraph
[flamegraph-rs]: https://github.com/flamegraph-rs/flamegraph
[rustc-perf]: https://github.com/rust-lang/rustc-perf
