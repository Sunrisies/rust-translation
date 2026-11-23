# cargo-logout(1)

## 名称

cargo-logout --- 从本地注册表移除 API 令牌

## 概述

`cargo logout` [_选项_]

## 描述

此命令将运行凭证提供器以移除保存的令牌。

对于默认的 `cargo:token` 凭证提供器，凭证存储在 `$CARGO_HOME/credentials.toml` 中，其中 `$CARGO_HOME` 默认为您的主目录中的 `.cargo`。

如果注册表指定了凭证提供器，则使用该提供器。否则，将尝试配置值 `registry.global-credential-providers` 中的提供器，从列表末尾开始查找。

如果未指定 `--registry` 参数，则将移除默认注册表的凭证（由 [`registry.default`](../reference/config.html#registrydefault) 配置，默认为 <https://crates.io/>）。

此操作不会在服务器上撤销令牌。如果您需要撤销令牌，请访问注册表网站并遵循其说明。
<https://crates.io/me> to revoke the token for <https://crates.io/>).

## 选项

### 注销选项

<dl>
<dt class="option-term" id="option-cargo-logout---registry"><a class="option-anchor" href="#option-cargo-logout---registry"><code>--registry</code> <em>registry</em></a></dt>
<dd class="option-desc"><p>要使用的注册表名称。注册表名称定义在<a href=”../reference/config.html”>Cargo 配置文件</a>中。如果未指定，则使用默认注册表，该注册表由 <code>registry.default</code> 配置键定义，默认为 <code>crates-io</code>。</p>
</dd>

</dl>

### 显示选项

<dl>
<dt class="option-term" id="option-cargo-logout--v"><a class="option-anchor" href="#option-cargo-logout--v"><code>-v</code></a></dt>
<dt class="option-term" id="option-cargo-logout---verbose"><a class="option-anchor" href="#option-cargo-logout---verbose"><code>--verbose</code></a></dt>
<dd class="option-desc"><p>启用详细输出。可以两次指定以获得“非常详细”的输出，包括依赖警告和构建脚本输出等额外内容。也可以通过 <code>term.verbose</code> <a href=”../reference/config.html”>配置值</a>来指定。</p>
</dd>


<dt class="option-term" id="option-cargo-logout--q"><a class="option-anchor" href="#option-cargo-logout--q"><code>-q</code></a></dt>
<dt class="option-term" id="option-cargo-logout---quiet"><a class="option-anchor" href="#option-cargo-logout---quiet"><code>--quiet</code></a></dt>
<dd class="option-desc"><p>不打印 Cargo 日志消息。也可以通过 <code>term.quiet</code> <a href=”../reference/config.html”>配置值</a>来指定。</p>
</dd>


<dt class="option-term" id="option-cargo-logout---color"><a class="option-anchor" href="#option-cargo-logout---color"><code>--color</code> <em>when</em></a></dt>
<dd class="option-desc"><p>控制彩色输出的使用情况。有效值包括： <ul> <li><code>auto</code>（默认）：自动检测终端是否支持颜色显示。</li> <li><code>always</code>：始终显示颜色。</li> <li><code>never</code>：从不显示颜色。</li> </ul> 也可以通过 <code>term.color</code> <a href=”../reference/config.html”>配置值</a>来指定。</p>
</dd>

</dl>

### 常见选项

<dl>

<dt class="option-term" id="option-cargo-logout-+toolchain"><a class="option-anchor" href="#option-cargo-logout-+toolchain"><code>+</code><em>toolchain</em></a></dt>
<dd class="option-desc"><p>如果 Cargo 通过 rustup 安装，且 <code>cargo</code> 的第一个参数以 <code>+</code> 开头，则会被解释为 rustup 工具链名称（如 <code>+stable</code> 或 <code>+nightly</code>）。有关工具链覆盖机制更多信息，请参阅 <a href="https://rust-lang.github.io/rustup/overrides.html">rustup 文档</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-logout---config"><a class="option-anchor" href="#option-cargo-logout---config"><code>--config</code> <em>KEY=VALUE</em> or <em>PATH</em></a></dt>
<dd class="option-desc"><p>用于覆盖 Cargo 配置值。参数应为 TOML 格式 <code>KEY=VALUE</code>，或作为额外配置文件的路径提供。此标志可以多次指定。有关更多信息，请参阅 <a href=”../reference/config.html#command-line-overrides”>命令行覆盖部分</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-logout--C"><a class="option-anchor" href="#option-cargo-logout--C"><code>-C</code> <em>PATH</em></a></dt>
<dd class="option-desc"><p>在执行任何指定操作之前，此选项会更改当前工作目录。这会影响诸如 cargo 默认查找项目清单 (<code>Cargo.toml</code>)的位置，以及用于发现 <code>.cargo/config.toml</code> 的搜索目录等设置。该选项必须出现在命令名称之前，例如 <code>cargo -C path/to/my-project build</code>。</p> <p>此选项仅适用于 <a href="https://doc.rust-lang.org/book/appendix-07-nightly-rust.html">nightly 版本</a>，并且需要使用 <code>-Z unstable-options</code> 标志才能启用（参见 <a href="https://github.com/rust-lang/cargo/issues/10098">#10098</a>）。</p>
</dd>


<dt class="option-term" id="option-cargo-logout--h"><a class="option-anchor" href="#option-cargo-logout--h"><code>-h</code></a></dt>
<dt class="option-term" id="option-cargo-logout---help"><a class="option-anchor" href="#option-cargo-logout---help"><code>--help</code></a></dt>
<dd class="option-desc"><p>此选项会打印帮助信息。</p>
</dd>


<dt class="option-term" id="option-cargo-logout--Z"><a class="option-anchor" href="#option-cargo-logout--Z"><code>-Z</code> <em>flag</em></a></dt>
<dd class="option-desc"><p>这是 Cargo 的不稳定（仅 nightly 版本）标志。如需详细信息，请运行 <code>cargo -Z help</code>。</p>
</dd>


</dl>

## 环境

有关 Cargo 读取的环境变量详情，请参阅 [参考手册](../reference/environment-variables.html)。

## 退出状态

* `0`: Cargo 成功执行。
* `101`: Cargo 执行失败。

## 示例

1. 移除默认注册表令牌：

       cargo logout

2. 移除特定注册表的令牌：

       cargo logout --registry my-registry

## 另请参阅 [cargo(1)](cargo.html)、[cargo-login(1)](cargo-login.html)
