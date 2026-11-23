# 在 crates.io 上发布

当你有一个想要分享给世界的库时，就该在 [crates.io] 上发布它了！发布 crate 是指将特定版本上传到 [crates.io] 进行托管。

发布 crate 时要小心，因为发布是[通常永久的](https://crates.io/policies#包-所有权)。该版本无法被覆盖，代码也无法被删除。不过，可以发布的版本数量没有限制。

## 在首次发布之前

首先，你需要在 [crates.io] 上注册账户以获取 API 令牌。为此，[访问主页][crates.io]，通过 GitHub 账号登录（目前需要）。你还需要在 [账户设置](https://crates.io/settings/profile) 页面提供并验证你的电子邮件地址。完成这些后[创建 API 令牌](https://crates.io/settings/tokens)，并务必复制它。一旦离开该页面，你就无法再看到它了。

然后运行 [`cargo login`] 命令。

```console
$ cargo login
```

然后在提示符下输入指定的令牌。
```console
please paste the API Token found on https://crates.io/me below
abcdefghijklmnopqrstuvwxyz012345
```

此命令会将你的 API 令牌告知 Cargo，并将其本地存储在 `~/.cargo/credentials.toml` 中。请注意，该令牌是**机密**的，不应与任何人共享。如果因任何原因泄露，应立即撤销它。

> [!NOTE]
> 可以使用 [`cargo logout`] 命令从 `credentials.toml` 中移除令牌。如果你不再需要在本地机器上存储它，这可能会很有用。

## 在发布新 crate 之前

请记住，[crates.io] 上的 crate 名称是按先到先得原则分配的。一旦一个 crate 名称被占用，就不能用于其他 crate。

查看 `Cargo.toml` 中的[可指定的元数据](清单.md)，以确保你的 crate 更容易被发现！在发布之前，请确保填写了以下字段：

- [`license` 或 `license-file`] - [`description`] - [`homepage`] - [`repository`] - [`readme`]

最好包含一些[关键词]和[类别]，尽管这些不是必需的。

如果您正在发布库，也可以参考 [Rust API 指南]。

### 打包 crate

下一步是将您的 crate 打包并上传到 [crates.io]。我们将使用 [`cargo publish`] 子命令来完成此操作。该命令执行以下步骤：

1. 对您的包进行一些验证检查。
2. 将源代码压缩成 `.crate` 文件。
3. 将 `.crate` 文件提取到临时目录中，并验证其可编译。
4. 将 `.crate` 文件上传到 [crates.io]。
5. 注册表会在添加该包之前对上传的包进行额外检查。

建议您在发布前先运行 `cargo publish --dry-run`（或等效的 [`cargo package`]）以确保没有警告或错误。这将执行上述前三个步骤。

```console
$ cargo publish --dry-run
```

您可以在 `target/package` 目录中查看生成的 `.crate` 文件。[crates.io] 目前对 `.crate` 文件的大小限制为 10MB。您可能需要检查 `.crate` 文件的大小，以确保没有意外打包了不必要的大型资源，如测试数据、网站文档或代码生成文件。可以使用以下命令查看包含哪些文件：

```console
$ cargo package --list
```

在打包时，Cargo 会自动忽略版本控制系统所排除的文件；但如果您希望指定额外的排除文件，可以在清单中使用 [`exclude` key](清单.md#the-exclude-and-include-fields)。

```toml
[package]
# ...
exclude = [
    "public/assets/*",
    "videos/*",
]
```

如果您更愿意明确列出要包含的文件，Cargo 还支持 [`include` key](清单.md#the-exclude-and-include-fields)，设置该键可以覆盖 `exclude` 键。

```toml
[package]
# ...
include = [
    "**/*.rs",
]
```

## 上传 crate

当准备发布时，使用 [`cargo publish`] 命令将包上传到 [crates.io]：

```console
$ cargo publish
```

就这样，您现在已经发布了您的第一个 crate！

## 发布现有 crate 的新版本

为了发布新版本，请更改 `Cargo.toml` 清单中指定的 `[`version` 值](manifest.md#the-version-field)。请注意 [SemVer 规则](semver.md)，这些规则提供了关于什么是兼容变化的指导方针。然后按照上述方法运行 [`cargo publish`] 以上传新版本。

> [!TIP]
> 考虑完整的发布流程，并尽可能实现自动化。
>
> 每个版本应包含：- 一个 changelog 条目，最好[手动整理](https://keepachangelog.com/en/1.0.0/)，但生成后的条目总比没有好 - 一个指向已发布提交的 [git tag](https://git-scm.com/book/en/v2/Git-Basics-Tagging)
>
> 代表不同工作流的第三方工具示例（按字母顺序）：- [cargo-release](https://crates.io/crates/cargo-release) - [cargo-smart-release](https://crates.io/crates/cargo-smart-release) - [release-plz](https://crates.io/crates/release-plz)
>
> 更多相关信息，请参见 [crates.io](https://crates.io/search?q=cargo%20release)。

## 管理基于 crates.io 的 crate

管理 crates 主要通过命令行工具 `cargo` 进行，而非 [crates.io] 网页界面。为此，有一些子命令可用于管理 crate。

### `cargo yank`

有时可能会发布一个版本，但由于某种原因（语法错误、忘记包含文件等）导致该版本实际上出现故障。对于这种情况，Cargo 支持“yank”功能来撤销某个版本的发布。

```console
$ cargo yank --version 1.0.1
$ cargo yank --version 1.0.1 --undo
```

“yank”**不会**删除任何代码。此功能不适用于意外上传的机密信息。如果发生这种情况，您必须立即重置这些机密信息。

“yank”版本的语义是，不能针对该版本创建新的依赖项，但所有现有的依赖项仍然可以正常工作。[crates.io]的主要目标之一就是作为不随时间变化的库包永久存档，而删除某个版本会违背这一目标。本质上，“yank”意味着所有包含`Cargo.lock`的包不会崩溃，同时未来生成的`Cargo.lock`文件也不会列出被“yank”的版本。

### `cargo owner`

一个库通常由多人开发，或者主要维护者可能会随时间变化！库的拥有者是唯一可以发布新版本的人，但拥有者也可以指定额外的拥有者。

```console
$ cargo owner --add github-handle
$ cargo owner --remove github-handle
$ cargo owner --add github:rust-lang:owners
$ cargo owner --remove github:rust-lang:owners
```

这些命令所指定的拥有者ID必须是 GitHub 用户名或 GitHub 团队。

如果给`--add`参数指定一个用户名，该用户将被邀请成为“命名”拥有者，并拥有该库的全部权限。除了能够发布或“yank”版本外，他们还可以添加或移除拥有者，*包括*创建他们的拥有者的那个人。当然，不应让你不完全信任的人成为命名拥有者。为了成为命名拥有者，用户必须之前登录过[crates.io]。

如果给`--add`参数指定一个团队名称，该团队将被邀请成为“团队”拥有者，并拥有有限的权限。虽然他们有权发布或“yank”版本，但他们*没有*添加或移除拥有者的能力。与管理多个拥有者相比，团队在防止拥有者变得恶意方面也更为安全。

目前，团队的语法为`github:org:team`（参见上述示例）。要邀请一个团队成为拥有者，该用户必须是该团队的成员。对于移除团队作为拥有者没有这样的限制。

## GitHub 权限

团队成员信息并非 GitHub 提供且可轻松公开访问的内容，在操作这些成员时，你可能会遇到以下消息：

> 看起来您没有权限从 GitHub 查询必要的属性以完成此请求。您可能需要在 [crates.io] 重新认证，以获得读取 GitHub 组织成员信息的权限。

这基本上就是“您尝试查询团队信息，但五级成员访问控制中的某一级拒绝了这一操作”的通用描述。这并不夸张。GitHub 对团队访问控制的支持属于企业级水平。

最可能的原因是您上次登录时该功能尚未添加。在认证用户时，我们最初要求 *不* 授予任何权限，因为实际上我们从未使用用户的令牌进行其他操作，仅用于登录。然而，为了代表您查询团队成员信息，我们现在需要 [`read:org` 范围][oauth-scopes]。

您可以拒绝授予此范围，之前在引入团队功能之前所有的工作方式仍然有效。但是您将永远无法作为所有者添加团队，或作为团队负责人发布 crate。如果您尝试这样做，将会出现上述错误。如果您试图发布一个并非属于您的 crate，但恰好有一个团队，也会看到此错误。

如果您改变主意，或者不确定 [crates.io] 是否有足够的权限，您可以随时访问 <https://crates.io/> 并重新认证，如果 [crates.io] 没有所有所需的范围，它将提示您授予权限。

查询 GitHub 的另一个障碍是组织可能正在主动拒绝第三方访问。要检查这一点，您可以前往：

```text
https://github.com/organizations/:org/settings/oauth_application_policy
```

其中 `:org` 是组织的名称（例如，`rust-lang`）。您可能会看到类似这样的内容：

![Organization Access Control](../images/org-level-acl.png)

您可以选择明确将 [crates.io] 从组织的黑名单中移除，或者直接点击“移除限制”按钮，允许所有第三方应用程序访问此数据。

或者，当 [crates.io] 请求 `read:org` 范围时，您可以点击其名称旁边的“授予访问权限”按钮，明确将 [crates.io] 列入查询该组织的白名单：

![Authentication Access Control](../images/auth-level-acl.png)

### 解决 GitHub 团队访问错误的方法

当尝试将 GitHub 团队作为 crate 所有者时，可能会看到如下错误：

```text
error: failed to invite owners to crate <crate_name>: api errors (status 200 OK): could not find the github team org/repo
```
在这种情况下，你应该前往 [GitHub 应用设置页面]，检查 `Authorized OAuth Apps` 选项卡中是否列出了 crates.io。如果未列出，你应该访问 <https://crates.io/> 并授权它。然后回到 GitHub 的应用设置页面，点击列表中的 crates.io 应用，确保你或你的组织在“Organization access”列表中带有绿色对勾标记。如果有名为 `Grant` 或 `Request` 的按钮，你应该授予访问权限或请求组织所有者进行授权。

[Rust API Guidelines]: https://rust-lang.github.io/api-guidelines/
[`cargo login`]: ../commands/cargo-login.md
[`cargo logout`]: ../commands/cargo-logout.md
[`cargo package`]: ../commands/cargo-package.md
[`cargo publish`]: ../commands/cargo-publish.md
[`categories`]: manifest.md#the-categories-field
[`description`]: manifest.md#the-description-field
[`documentation`]: manifest.md#the-documentation-field
[`homepage`]: manifest.md#the-homepage-field
[`keywords`]: manifest.md#the-keywords-field
[`license` or `license-file`]: manifest.md#the-license-and-license-file-fields
[`readme`]: manifest.md#the-readme-field
[`repository`]: manifest.md#the-repository-field
[crates.io]: https://crates.io/
[oauth-scopes]: https://developer.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps/
[the GitHub Application settings page]: https://github.com/settings/applications
