# cargo-yank(1)

## 名称

cargo-yank --- 从索引中移除已发布的 crate

## 概述

`cargo yank` [_options_] _crate_@_version_\ `cargo yank` [_options_] `--version` _version_ [_crate_]

## 描述

yank 命令会将之前发布的 crate 版本从服务器索引中移除。此操作不会删除任何数据，该 crate 仍可通过注册表的下载链接进行下载。

如果没有现有的 锁文件，Cargo 在新建项目或检出时不会使用被移除的版本，如果不存在兼容的版本，则会产生错误。

执行此命令需要通过 `--token` 选项或使用 [cargo-login(1)](cargo-login.html) 进行认证。

如果未指定 crate 名称，将使用当前目录中的包名。

### yank 的工作原理

例如，crate `foo` 发布了版本 `1.5.0`，而另一个 crate `bar` 声明依赖 `foo = "1.5"`。现在 `foo` 发布了一个新的、但不兼容 semver 的版本 `2.0.0`，并且发现 `1.5.0` 存在严重问题。如果 `1.5.0` 被移除，没有现有 锁文件 的新项目或检出无法使用 crate `bar`，因为它依赖于 `1.5`。

在这种情况下，`foo` 的维护者应在移除 `1.5.0` 之前发布一个兼容 semver 的版本，如 `1.5.1`，以便 `bar` 及其所有依赖 `bar` 的项目能够继续运行。

另一个例子是，crate `bar` 有发布的版本 `1.5.0`、`1.5.1`、`1.5.2`、`2.0.0` 和 `3.0.0`。下表列出了在缺乏 锁文件 的情况下，根据特定发布被移除的情况，Cargo 可用于的不同 semver 要求版本：

| Yanked Version / SemVer requirement | `bar = "1.5.0"`                         | `bar = "=1.5.0"` | `bar = "2.0.0"`  |
|-------------------------------------|-----------------------------------------|------------------|------------------|
| `1.5.0`                             | Use either `1.5.1` or `1.5.2`           | **Return Error** | Use `2.0.0`      |
| `1.5.1`                             | Use either `1.5.0` or `1.5.2`           | Use `1.5.0`      | Use `2.0.0`      |
| `2.0.0`                             | Use either `1.5.0`, `1.5.1` or `1.5.2`  | Use `1.5.0`      | **Return Error** |

### 何时移除

只有在特殊情况下才应提取 crate，例如意外发布、无意的 SemVer 版本变更或严重损坏且无法使用的 crate。对于安全漏洞而言，[RustSec] 通常是一种对用户影响较小的机制，可以通知用户并鼓励他们升级，同时避免造成严重的下游影响，无论该漏洞的易感性如何。

常见的工作流程是提取已经发布了兼容 SemVer 版本的 crate，以减少依赖 crate 无法编译的可能性。

当涉及已发布的 crate 的版权、许可或个人数据问题时，单纯提取它可能不够。在这种情况下，应联系您使用的注册表的维护者。对于 crates.io，请参考他们的[政策]，并通过 <help@crates.io>联系他们。

如果凭证被泄露，建议立即撤销这些凭证。一旦 crate 发布后，就无法确定泄露的凭证是否被复制了。仅进行提取只能防止 Cargo 在解析依赖时默认选择该版本。现有的 lock 文件或直接下载内容不受影响，因此提取无法阻止泄露凭证的进一步传播。


## 选项

### 提取选项

<dl>

<dt class="option-term" id="option-cargo-yank---vers"><a class="option-anchor" href="#option-cargo-yank---vers"><code>--vers</code> <em>version</em></a></dt>
<dt class="option-term" id="option-cargo-yank---version"><a class="option-anchor" href="#option-cargo-yank---version"><code>--version</code> <em>version</em></a></dt>
<dd class="option-desc"><p>要提取或取消提取的版本。</p>
</dd>


<dt class="option-term" id="option-cargo-yank---undo"><a class="option-anchor" href="#option-cargo-yank---undo"><code>--undo</code></a></dt>
<dd class="option-desc"><p>撤销提取操作，将版本重新放回索引中。</p>
</dd>


<dt class="option-term" id="option-cargo-yank---token"><a class="option-anchor" href="#option-cargo-yank---token"><code>--token</code> <em>token</em></a></dt>
<dd class="option-desc"><p>用于身份验证的 API 令牌。此令牌会覆盖存储在凭据文件中的令牌（该文件由 <a href="cargo-login.html">cargo-login(1)</a> 生成）。</p> <p><a href="../reference/config.html">Cargo config</a> 环境变量可用于覆盖存储在凭据文件中的令牌。crates.io 的令牌可以通过 <code>CARGO_REGISTRY_TOKEN</code> 环境变量指定。其他注册表的令牌则可通过形式为 <code>CARGO_REGISTRIES_NAME_TOKEN</code> 的环境变量指定，其中 <code>NAME</code> 为大写字母表示的注册表名称。</p>
</dd>


<dt class="option-term" id="option-cargo-yank---index"><a class="option-anchor" href="#option-cargo-yank---index"><code>--index</code> <em>index</em></a></dt>
<dd class="option-desc"><p>要使用的注册表索引 URL。</p>
</dd>


<dt class="option-term" id="option-cargo-yank---registry"><a class="option-anchor" href="#option-cargo-yank---registry"><code>--registry</code> <em>registry</em></a></dt>
<dd class="option-desc"><p>要使用的注册表名称。注册表名称定义在 <a href="../reference/config.html">Cargo config files</a>中。如果未指定，则使用默认注册表，该注册表由 <code>registry.default</code> 配置键定义，默认为 <code>crates-io</code>。</p>
</dd>


</dl>

### 显示选项

<dl>

<dt class="option-term" id="option-cargo-yank--v"><a class="option-anchor" href="#option-cargo-yank--v"><code>-v</code></a></dt>
<dt class="option-term" id="option-cargo-yank---verbose"><a class="option-anchor" href="#option-cargo-yank---verbose"><code>--verbose</code></a></dt>
<dd class="option-desc"><p>启用详细输出。可以两次指定以获得“非常详细”的输出，包括依赖警告和构建脚本输出等额外信息。也可以通过 <code>term.verbose</code> <a href="../reference/config.html">配置值</a>来指定。</p>
</dd>


<dt class="option-term" id="option-cargo-yank--q"><a class="option-anchor" href="#option-cargo-yank--q"><code>-q</code></a></dt>
<dt class="option-term" id="option-cargo-yank---quiet"><a class="option-anchor" href="#option-cargo-yank---quiet"><code>--quiet</code></a></dt>
<dd class="option-desc"><p>不打印 cargo 日志消息。 也可以通过 <code>term.quiet</code> <a href="../reference/config.html">配置值</a>来指定。</p>
</dd>


<dt class="option-term" id="option-cargo-yank---color"><a class="option-anchor" href="#option-cargo-yank---color"><code>--color</code> <em>when</em></a></dt>
<dd class="option-desc"><p>控制彩色输出的使用情况。有效值包括：</p> <ul> <li><code>auto</code>（默认）：自动检测终端是否支持颜色显示。</li> <li><code>always</code>：始终显示颜色。</li> <li><code>never</code>：从不显示颜色。</li> </ul> <p>也可以通过 <code>term.color</code> <a href="../reference/config.html">配置值</a>来指定。</p>
</dd>


</dl>

### 常见选项

<dl>

<dt class="option-term" id="option-cargo-yank-+toolchain"><a class="option-anchor" href="#option-cargo-yank-+toolchain"><code>+</code><em>toolchain</em></a></dt>
<dd class="option-desc"><p>如果已使用 rustup 安装 Cargo，且 <code>cargo</code> 的第一个参数以 <code>+</code> 开头，则会被解释为 rustup 工具链名称（如 <code>+stable</code> 或 <code>+nightly</code>）。 有关工具链覆盖机制更多信息，请参阅<a href="https://rust-lang.github.io/rustup/overrides.html">rustup 文档</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-yank---config"><a class="option-anchor" href="#option-cargo-yank---config"><code>--config</code> <em>KEY=VALUE</em> or <em>PATH</em></a></dt>
<dd class="option-desc"><p>用于覆盖 Cargo 配置值。参数应为 TOML 格式 <code>KEY=VALUE</code>，或作为额外配置文件的路径提供。此标志可以多次指定。 有关更多信息，请参阅<a href="../reference/config.html#command-line-overrides">命令行覆盖部分</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-yank--C"><a class="option-anchor" href="#option-cargo-yank--C"><code>-C</code> <em>PATH</em></a></dt>
<dd class="option-desc"><p>在执行任何指定操作之前更改当前工作目录。这会影响 cargo 默认查找项目清单（<code>Cargo.toml</code>）的位置，以及搜索 <code>.cargo/config.toml</code> 等目录的方式。此选项必须出现在命令名称之前，例如 <code>cargo -C path/to/my-project build</code>。 此选项仅适用于 <a href="https://doc.rust-lang.org/book/appendix-07-nightly-rust.html">nightly 渠道</a>，并且需要使用 <code>-Z unstable-options</code> 标志来启用（参见 <a href="https://github.com/rust-lang/cargo/issues/10098">#10098</a>）。</p>
</dd>


<dt class="option-term" id="option-cargo-yank--h"><a class="option-anchor" href="#option-cargo-yank--h"><code>-h</code></a></dt>
<dt class="option-term" id="option-cargo-yank---help"><a class="option-anchor" href="#option-cargo-yank---help"><code>--help</code></a></dt>
<dd class="option-desc"><p>打印帮助信息。</p>
</dd>


<dt class="option-term" id="option-cargo-yank--Z"><a class="option-anchor" href="#option-cargo-yank--Z"><code>-Z</code> <em>flag</em></a></dt>
<dd class="option-desc"><p>Cargo 的不稳定（仅 nightly 版本）标志。运行 <code>cargo -Z help</code> 以查看详细信息。</p>
</dd>


</dl>

## 环境

有关 Cargo 读取的环境变量详情，请参阅[参考手册](../reference/environment-variables.html)。

## 退出状态

* `0`: Cargo 成功完成。
* `101`: Cargo 未能完成。

## 示例

1. 从索引中提取 crate：

       cargo yank foo@1.0.7

## 另请参阅 [cargo(1)](cargo.html), [cargo-login(1)](cargo-login.html), [cargo-publish(1)](cargo-publish.html)

[RustSec]: https://rustsec.org/
[policies]: https://crates.io/policies
