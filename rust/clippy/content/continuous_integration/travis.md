# Travis CI

你可以像在本地使用一样将 Clippy 添加到 Travis CI 中：

```yml
language: rust
rust:
  - stable
  - beta
before_script:
  - rustup component add clippy
script:
  - cargo clippy
  # if you want the build job to fail when encountering warnings, use
  - cargo clippy -- -D warnings
  # in order to also check tests and non-default crate features, use
  - cargo clippy --all-targets --all-features -- -D warnings
  - cargo test
  # etc.
```
