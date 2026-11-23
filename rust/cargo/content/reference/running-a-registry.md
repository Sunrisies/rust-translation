# 运行注册表

一个基础化的注册表可以通过创建一个包含索引的 git 仓库，以及包含一个由 [`cargo package`]生成的压缩 `.crate` 文件的服务器来实现。用户无法使用 Cargo 将其发布到该注册表，但这对于封闭环境来说可能已足够。索引格式在 [注册表索引] 中有描述。

一个支持发布的全功能注册表还需要有一个符合 Cargo 使用的 API 的 Web API 服务。Web API 在 [注册表 Web API] 中有描述。

商业项目和社区项目都可以用于构建和运行注册表。请访问 <https://github.com/rust-lang/cargo/wiki/Third-party-registries> 查看可用的选项列表。

[Registry Web API]: registry-web-api.md
[Registry Index]: registry-index.md
[`cargo publish`]: ../commands/cargo-publish.md
[`cargo package`]: ../commands/cargo-package.md
