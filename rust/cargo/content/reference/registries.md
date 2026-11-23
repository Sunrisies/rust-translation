# 注册表

Cargo 从“注册表”中安装 crate 并获取依赖项。默认注册表为 [crates.io]。注册表包含一个“索引”，其中包含可搜索的可用 crate 列表。注册表还可能提供 Web API，以支持直接从 Cargo 发布新 crate。

> [!NOTE]
> 如果您有兴趣镜像或 vendoring现有注册表，请查看 [Source Replacement]。

如果您正在实现注册表服务器，请参阅 [Running a Registry] 以了解 Cargo 与注册表之间的协议细节。

如果您使用的是需要身份验证的注册表，请参阅 [Registry Authentication]。如果您正在实现凭证提供器，请参阅 [Credential Provider Protocol] 以获取详细信息。

## 使用备用注册表

要使用除 [crates.io] 之外的注册表，必须将注册表的名称和索引 URL 添加到 [`.cargo/config.toml` 文件][config]中。`registries` 表中为每个注册表有一个键，例如：

```toml
[registries]
my-registry = { index = "https://my-intranet:8080/git/index" }
```

`index` 键应是一个指向包含该注册表索引的 git 仓库的 URL，或带有 `sparse+` 前缀的 Cargo sparse 注册表 URL。

然后，可以在 `Cargo.toml` 中该依赖项的条目中指定 `registry` 键和注册表名称的值，使一个 crate 能够依赖于另一个注册表中的 crate：

```toml
# Sample Cargo.toml
[package]
name = "my-project"
version = "0.1.0"
edition = "2024"

[dependencies]
other-crate = { version = "1.0", registry = "my-registry" }
```

与大多数配置值一样，索引可以通过环境变量而不是配置文件来指定。例如，设置以下环境变量即可实现与定义配置文件相同的效果：

```ignore
CARGO_REGISTRIES_MY_REGISTRY_INDEX=https://my-intranet:8080/git/index
```

> [!NOTE]
> [crates.io] 不接受依赖其他注册表中的 crate 的包。

## 向备用注册表发布

如果注册表支持 Web API 访问，则可以从 Cargo 直接将其包发布到该注册表。Cargo 的一些命令（如 [`cargo publish`）] 带有 `--registry` 命令行标志，用于指示使用哪个注册表。例如，要发布当前目录中的包：

1. `cargo login --registry=my-registry`

    这只需执行一次。您必须输入从注册表网站获取的秘密 API 令牌。或者，可以通过 `--token` 命令行标志直接将令牌传递给 `publish` 命令，或者通过名为 `CARGO_REGISTRIES_MY_REGISTRY_TOKEN` 的环境变量传入。

2. `cargo publish --registry=my-registry`

无需始终传递 `--registry` 命令行选项，可以在 [`.cargo/config.toml`] 文件中通过 `registry.default` 键设置默认注册表。例如：

```toml
[registry]
default = "my-registry"
```

在 `Cargo.toml` 清单中设置 `package.publish` 键可以限制软件包可发布到哪些注册表。这有助于防止意外将闭源软件包发布到 [crates.io]。该值可以是注册表名称的列表，例如：

```toml
[package]
# ...
publish = ["my-registry"]
```

`publish` 值也可以设为 `false`，以完全禁止发布，这与空列表相同。

由 [`cargo login`] 保存的认证信息存储在 Cargo 主目录中的 `credentials.toml` 文件中（默认位于 `$HOME/.cargo`）。每个注册表都有独立的表格，例如：

```toml
[registries.my-registry]
token = "854DvwSlUwEHtIo3kWy6x7UCPKHfzCmy"
```

## 注册表协议 Cargo 支持两种远程注册表协议：`git` 和 `sparse`。如果注册表索引 URL 以 `sparse+` 开头，Cargo 将使用稀疏协议。否则，Cargo 将使用 `git` 协议。

`git` 协议将索引元数据存储在 git 仓库中，并要求 Cargo 克隆整个仓库。

`sparse` 协议通过普通的 HTTP 请求获取单个元数据文件。由于 Cargo 仅下载相关 crates 的元数据，`sparse` 协议可以显著节省时间和带宽。

[crates.io] 注册表支持这两种协议。crates.io 的协议通过 [`registries.crates-io.protocol`] 配置键进行控制。

[Source Replacement]: source-replacement.md
[Running a Registry]: running-a-registry.md
[Credential Provider Protocol]: credential-provider-protocol.md
[Registry Authentication]: registry-authentication.md
[`cargo publish`]: ../commands/cargo-publish.md
[`cargo package`]: ../commands/cargo-package.md
[`cargo login`]: ../commands/cargo-login.md
[config]: config.md
[crates.io]: https://crates.io/
[`registries.crates-io.protocol`]: config.md#registriescrates-ioprotocol
