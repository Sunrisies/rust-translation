# 未来不兼容报告

Cargo 会检查所有依赖项中的未来不兼容警告。这些警告指的是将来可能变成严重错误的变更，导致在未来的 rustc 版本中该依赖项停止构建。如果检测到任何警告，将显示一个小提示，说明已发现这些警告，并提供如何生成完整报告的说明。

例如，在构建过程的末尾可能会看到类似这样的信息：

```text
warning: the following packages contain code that will be rejected by a future
         version of Rust: rental v0.5.5
note: to see what the problems were, use the option `--future-incompat-report`,
      or run `cargo report future-incompatibilities --id 1`
```

可以通过 `cargo report future-incompatibilities --id ID` 命令或再次使用 `--future-incompat-report` 标志进行构建来显示完整的报告。开发人员应将其依赖项更新到已修复该问题的版本，或者与依赖项的开发者合作解决此问题。

## 配置

可以通过 `.cargo/config.toml` 中的 [`[future-incompat-report]`][config] 部分来配置此功能。目前支持的选项有：

```toml
[future-incompat-report]
frequency = "always"
```

支持的频率值包括 `"always"` 和 `"never"`，用于控制是否在 `cargo build` / `cargo check` 的末尾显示消息。

[config]: config.md#future-incompat-report
