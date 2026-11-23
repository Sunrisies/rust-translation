# 注册表认证 Cargo 通过凭证提供器对注册表进行认证。这些凭证提供器可以是外部可执行文件或内置提供器，Cargo 使用它们来存储和检索凭证。

使用具有认证的替代注册表时 *必须* 配置凭证提供器，以避免在磁盘上无意中存储未加密的凭证。由于历史原因，公共（未认证）注册表不需要配置凭证提供器，如果未配置任何提供器，则使用 `cargo:token` 提供器。

Cargo 还包含特定于平台的提供器，这些提供器利用操作系统来安全存储令牌。`cargo:token` 提供器也包含在内，它将凭证以未加密的纯文本形式存储在 [credentials](config.md#credentials) 文件中。

## 推荐配置建议在 `$CARGO_HOME/config.toml` 中配置全局凭证提供器列表，默认配置如下：* Windows: `%USERPROFILE%\.cargo\config.toml` * Unix: `~/.cargo/config.toml`

此推荐配置使用操作系统提供器，如果找不到则回退到 `cargo:token`，以查看 Cargo 的 [credentials](config.md#credentials) 文件或环境变量。
```toml
# ~/.cargo/config.toml
[registry]
global-credential-providers = ["cargo:token", "cargo:libsecret", "cargo:macos-keychain", "cargo:wincred"]
```
*注意，后续条目具有更高的优先级。更多细节请参见 [`registry.global-credential-providers`](config.md#registryglobal-credential-providers)。*

某些私有注册表可能还推荐使用特定于注册表的凭证提供器。请查阅您的注册表文档以确认是否如此。

## 内置提供器 Cargo 包含几种内置凭证提供器。可用的内置提供器可能在未来的 Cargo 版本中发生变化（但目前没有计划进行此类变更）。

### `cargo:token` 使用 Cargo 的 [credentials](config.md#credentials) 文件以未加密的纯文本形式存储令牌。在检索令牌时，会检查 `CARGO_REGISTRIES_<NAME>_TOKEN` 环境变量。如果此凭证提供器未被列出，则 `*_TOKEN` 环境变量将不起作用。

### `cargo:wincred` 使用 Windows 凭据管理器来存储令牌。

凭证以 `cargo-registry:<index-url>` 的形式存储在“Windows Credentials”下的凭证管理器中。

### `cargo:macos-keychain` 使用 macOS Keychain 来存储令牌。

可以使用 Keychain Access 应用来查看已存储的令牌。

### `cargo:libsecret` 使用 [libsecret](https://wiki.gnome.org/Projects/Libsecret) 来存储令牌。

任何支持 libsecret 的密码管理器都可以用来查看已存储的令牌。以下是几个示例（并非全部）：

- [GNOME Keyring](https://wiki.gnome.org/Projects/GnomeKeyring) - [KDE Wallet Manager](https://apps.kde.org/kwalletmanager5/)（自 KDE Frameworks 5.97.0 起） - [KeePassXC](https://keepassxc.org/)（自 2.5.0 起）

### `cargo:token-from-stdout <command> <args>` 启动一个子进程，该进程在 stdout 上返回令牌。换行符将被去除。* 该进程继承用户的 stdin 和 stderr。* 成功时应退出 0，出错时退出非零。* [`cargo login`] 和 [`cargo logout`] 不受支持，使用时会返回错误。

以下环境变量将提供给执行的命令：

* `CARGO` --- 执行该命令的 `cargo` 二进制文件的路径。
* `CARGO_REGISTRY_INDEX_URL` --- 注册表索引的 URL。
* `CARGO_REGISTRY_NAME_OPT` --- 注册表的可选名称。不应用作查找键。

参数将传递给子命令。


## 凭证插件对于遵循 Cargo [credential provider protocol](credential-provider-protocol.md) 的凭证提供器插件，配置值应为包含可执行文件路径（或位于 `PATH` 中的可执行文件名）的字符串。

例如，要从 crates.io 安装 [cargo-credential-1password](https://crates.io/crates/cargo-credential-1password)，请执行以下操作：

使用 `cargo install cargo-credential-1password` 安装提供器。

在配置文件中，将以下内容添加到（或创建）`registry.global-credential-providers`：
```toml
[registry]
global-credential-providers = ["cargo:token", "cargo-credential-1password --account my.1password.com"]
```

`global-credential-providers` 中的值按空格分为路径和命令行参数。若需定义包含空格的路径或参数的全局凭证提供器，请使用 [`[credential-alias]` 表](config.md#credential-alias)。

[`cargo login`]: ../commands/cargo-login.md
[`cargo logout`]: ../commands/cargo-logout.md
