# cargo-login(1)

## 名称

cargo-login --- 登录到注册表

## 概述

`cargo login` [_options_] [`--` _args_]

## 描述

此命令将运行凭证提供器以保存令牌，从而自动进行认证，例如 [cargo-publish(1)](cargo-publish.html) 这样的需要认证的命令。

所有以两个连字符 (`--`) 开头的参数都传递给凭证提供器。

对于默认的 `cargo:token` 凭证提供器，令牌保存在 `$CARGO_HOME/credentials.toml` 中。`CARGO_HOME` 默认为您的主目录中的 `.cargo`。

如果注册表指定了凭证提供器，则使用该提供器；否则将尝试配置值 `registry.global-credential-providers` 中的提供器，从列表末尾开始查找。

_令牌_ 将从标准输入读取。

crates.io 的 API 令牌可以从 <https://crates.io/me> 获取。

请注意保持令牌机密性，不应与任何人共享。

## 选项

### 登录选项

<dl>
<dt class="option-term" id="option-cargo-login---registry"><a class="option-anchor" href="#option-cargo-login---registry"><code>--registry</code> <em>registry</em></a></dt>
<dd class="option-desc"><p>要使用的注册表名称。注册表名称定义在<a href=”../reference/config.html”>Cargo 配置文件</a>中。如果未指定，则使用默认注册表，该注册表由 <code>registry.default</code> 配置键定义，默认为 <code>crates-io</code>。</p>
</dd>

</dl>

### 显示选项

<dl>
<dt class="option-term" id="option-cargo-login--v"><a class="option-anchor" href="#option-cargo-login--v"><code>-v</code></a></dt>
<dt class="option-term" id="option-cargo-login---verbose"><a class="option-anchor" href="#option-cargo-login---verbose"><code>--verbose</code></a></dt>
<dd class="option-desc"><p>启用详细输出。可以两次指定以获得“非常详细”的输出，包括依赖警告和构建脚本输出等额外内容。也可以通过 <code>term.verbose</code> <a href=”../reference/config.html”>配置值</a>来指定。</p>
</dd>


<dt class="option-term" id="option-cargo-login--q"><a class="option-anchor" href="#option-cargo-login--q"><code>-q</code></a></dt>
<dt class="option-term" id="option-cargo-login---quiet"><a class="option-anchor" href="#option-cargo-login---quiet"><code>--quiet</code></a></dt>
<dd class="option-desc"><p>不打印 Cargo 日志消息。也可以通过 <code>term.quiet</code> <a href=”../reference/config.html”>配置值</a>来指定。</p>
</dd>


<dt class="option-term" id="option-cargo-login---color"><a class="option-anchor" href="#option-cargo-login---color"><code>--color</code> <em>when</em></a></dt>
<dd class="option-desc"><p>控制彩色输出的使用方式。有效值包括： <ul> <li><code>auto</code>（默认）：自动检测终端是否支持颜色显示。</li> <li><code>always</code>：始终显示颜色。</li> <li><code>never</code>：从不显示颜色。</li> </ul> 也可以通过 <code>term.color</code> <a href=”../reference/config.html”>配置值</a>来指定。</p>
</dd>

</dl>

### 常见选项

<dl>

<dt class="option-term" id="option-cargo-login-+toolchain"><a class="option-anchor" href="#option-cargo-login-+toolchain"><code>+</code><em>toolchain</em></a></dt>
<dd class="option-desc"><p>如果 Cargo 通过 rustup 安装，且 <code>cargo</code> 的第一个参数以 <code>+</code> 开头，则会被解释为 rustup 工具链名称（如 <code>+stable</code> 或 <code>+nightly</code>）。有关工具链覆盖机制更多信息，请参阅 <a href="https://rust-lang.github.io/rustup/overrides.html">rustup 文档</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-login---config"><a class="option-anchor" href="#option-cargo-login---config"><code>--config</code> <em>KEY=VALUE</em> or <em>PATH</em></a></dt>
<dd class="option-desc"><p>用于覆盖 Cargo 配置值。参数应为 TOML 语法 <code>KEY=VALUE</code>，或作为额外配置文件的路径提供。此标志可以多次指定。有关更多信息，请参阅 <a href=”../reference/config.html#command-line-overrides”>命令行覆盖部分</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-login--C"><a class="option-anchor" href="#option-cargo-login--C"><code>-C</code> <em>PATH</em></a></dt>
<dd class="option-desc"><p>在执行任何指定操作之前，会更改当前工作目录。这会影响诸如 cargo 默认查找项目清单 (<code>Cargo.toml</code>)的位置，以及用于发现 <code>.cargo/config.toml</code> 的搜索目录等设置。此选项必须出现在命令名称之前，例如 <code>cargo -C path/to/my-project build</code>。</p> <p>此选项仅适用于 <a href="https://doc.rust-lang.org/book/appendix-07-nightly-rust.html">nightly 渠道</a>，并且需要使用 <code>-Z unstable-options</code> 标志才能启用（参见 <a href="https://github.com/rust-lang/cargo/issues/10098">#10098</a>）。</p>
</dd>


<dt class="option-term" id="option-cargo-login--h"><a class="option-anchor" href="#option-cargo-login--h"><code>-h</code></a></dt>
<dt class="option-term" id="option-cargo-login---help"><a class="option-anchor" href="#option-cargo-login---help"><code>--help</code></a></dt>
<dd class="option-desc"><p>打印帮助信息。</p>
</dd>


<dt class="option-term" id="option-cargo-login--Z"><a class="option-anchor" href="#option-cargo-login--Z"><code>-Z</code> <em>flag</em></a></dt>
<dd class="option-desc"><p>Cargo 的不稳定（仅 nightly 版本）标志。运行 <code>cargo -Z help</code> 以获取详细信息。</p>
</dd>


</dl>

## 环境

有关 Cargo 读取的环境变量详情，请参阅 [参考手册](../reference/environment-variables.html)。

## 退出状态

* `0`: Cargo 成功执行。
* `101`: Cargo 未能完成。

## 示例

1. 为默认注册表保存令牌：

       cargo login

2. 为特定注册表保存令牌：

       cargo login --registry my-registry

## 参见 [cargo(1)](cargo.html)、[cargo-logout(1)](cargo-logout.html)、[cargo-publish(1)](cargo-publish.html)
