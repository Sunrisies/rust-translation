# GitLab CI

您可以通过使用最新的稳定 [rust Docker 镜像](https://hub.docker.com/_/rust)来将 Clippy添加到 GitLab CI，如下方的 `.gitlab-ci.yml` CI 配置文件中所示。

```yml
# Make sure CI fails on all warnings, including Clippy lints
variables:
  RUSTFLAGS: "-Dwarnings"

clippy_check:
  image: rust:latest
  script:
    - rustup component add clippy
    - cargo clippy --all-targets --all-features
```
