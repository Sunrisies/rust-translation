# GitHub Actions

使用最新稳定版 Rust 的 GitHub 托管运行器已预装了 Clippy。只需运行 `cargo clippy` 即可对代码库进行lint检查。

```yml
on: push
name: Clippy check

# Make sure CI fails on all warnings, including Clippy lints
env:
  RUSTFLAGS: "-Dwarnings"

jobs:
  clippy_check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - name: Run Clippy
        run: cargo clippy --all-targets --all-features
```
