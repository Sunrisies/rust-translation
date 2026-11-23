# Git 认证

默认情况下，当使用 git 依赖和注册表时，Cargo 会委托 git 进行认证。本附录提供了一些在禁用 [`net.git-fetch-with-cli`] 的情况下，以与 Cargo 兼容的方式设置 git 认证的信息。

> [!NOTE]
> 对于公共 git 依赖，Cargo 不需要认证，因此如果在此场景下出现认证失败，请确保 URL 正确。

## HTTPS 认证

HTTPS 认证需要使用 [`credential.helper`] 机制。有多种凭证助手可供选择，您可以在全局 git 配置文件中指定要使用的助手。

```ini
# ~/.gitconfig

[credential]
helper = store
```

Cargo 不会要求输入密码，因此对于大多数助手，您在运行 Cargo 之前需要向助手提供初始用户名/密码。一种方法是克隆私有 git 仓库并使用 `git clone`，然后输入用户名/密码。

> [!TIP]
> macOS 用户可以考虑使用 osxkeychain 助手。<br> Windows 用户可以考虑使用 [GCM] 助手。

> [!NOTE]
> Windows 用户需要确保 `sh` shell 可在 `PATH` 中访问。通常，Git for Windows 安装已提供此功能。

## SSH 认证

SSH 认证需要 `ssh-agent` 正在运行以获取 SSH 密钥。确保设置了适当的环境变量（大多数类 Unix 系统上的 `SSH_AUTH_SOCK`），并且使用 `ssh-add` 添加了正确的密钥。

Windows 可以使用 Pageant（[PuTTY] 的一部分）或 `ssh-agent`。要使用 `ssh-agent`，Cargo 需要使用 Windows 自带的 OpenSSH，因为 Cargo 不支持 MinGW 或 Cygwin 使用的模拟 Unix-domain 套接字。关于在 Windows 上安装的更多信息可参阅 [Microsoft 安装文档]，[key management] 页面中有关于如何启动 `ssh-agent` 和添加密钥的说明。

> [!NOTE]
> Cargo 不支持 git 的简写 SSH URL，如 `git@example.com:user/repo.git`。应使用完整的 SSH URL，例如 `ssh://git@example.com/user/repo.git`。

> [!NOTE]
> SSH 配置文件（如 OpenSSH 的 `~/.ssh/config`）未被 Cargo 内置的 SSH 库使用。对于更高级的需求，应使用 [`net.git-fetch-with-cli`]。

### SSH 已知主机

当连接到 SSH 主机时，Cargo 必须使用“已知主机”来验证主机的身份，所谓“已知主机”即是一份主机密钥列表。Cargo 可以在标准位置找到类似 OpenSSH 的 `known_hosts` 文件（例如您的主目录中的 `.ssh/known_hosts`，或类 Unix 系统下的 `/etc/ssh/ssh_known_hosts`，或 Windows 下的 `%PROGRAMDATA%\ssh\ssh_known_hosts）。关于这些文件的更多信息可以在 [sshd man 页面] 中找到。或者，也可以通过 [`net.ssh.known-hosts`] 在 Cargo 配置文件中配置密钥。

当在已知主机尚未配置之前连接到 SSH 主机时，Cargo 会显示一条错误信息，指导您如何添加主机密钥。其中还会包含“指纹”，即主机密钥的简化哈希值，便于视觉验证。服务器管理员可以通过运行 `ssh-keygen` 对公共密钥进行解析以获取指纹（例如 `ssh-keygen -l -f /etc/ssh/ssh_host_ecdsa_key.pub`）。知名网站可能会在网页上发布其指纹；例如 GitHub 会在其页面上发布。
<https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/githubs-ssh-key-fingerprints>.

Cargo 内置了 [github.com](https://github.com) 的主机密钥。如果这些密钥发生变化，您可以将新密钥添加到配置文件或 known_hosts 文件中。

> [!WARNING]
> Cargo 不支持 `known_hosts` 文件中的 `@cert-authority` 或 `@revoked` 标记。若要使用此功能，应使用 [`net.git-fetch-with-cli`]。如果 Cargo 的 SSH 客户端行为不符合预期，这也是一个有效的排查方法。

[`credential.helper`]: https://git-scm.com/book/en/v2/Git-Tools-Credential-Storage
[`net.git-fetch-with-cli`]: ../reference/config.md#netgit-fetch-with-cli
[`net.ssh.known-hosts`]: ../reference/config.md#netsshknown-hosts
[GCM]: https://github.com/microsoft/Git-Credential-Manager-Core/
[PuTTY]: https://www.chiark.greenend.org.uk/~sgtatham/putty/
[Microsoft installation documentation]: https://docs.microsoft.com/en-us/windows-server/administration/openssh/openssh_install_firstuse
[key management]: https://docs.microsoft.com/en-us/windows-server/administration/openssh/openssh_keymanagement
[sshd man page]: https://man.openbsd.org/sshd#SSH_KNOWN_HOSTS_FILE_FORMAT
