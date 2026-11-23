# cargo-owner(1)

## 名称

cargo-owner --- 管理注册表上某个 crate 的所有者

## 概述

`cargo owner` [_options_] `--add` _login_ [_crate_]\ `cargo owner` [_options_] `--remove` _login_ [_crate_]\ `cargo owner` [_options_] `--list` [_crate_]

## 描述

此命令将修改注册表上某个 crate 的所有者。crate 的所有者可以上传新版本并删除旧版本。非团队所有者也可以修改所有者的列表，请小心操作！

执行此命令时，您必须使用 `--token` 选项或通过 [cargo-login(1)](cargo-login.html) 进行认证。

如果未指定 crate 名称，则使用当前目录中的包名。

有关所有者和发布方面的更多信息，请参阅 [参考手册](../reference/publishing.html#cargo-owner)。

## 选项

### 所有者选项

<dl>

<dt class="option-term" id="option-cargo-owner--a"><a class="option-anchor" href="#option-cargo-owner--a"><code>-a</code></a></dt>
<dt class="option-term" id="option-cargo-owner---add"><a class="option-anchor" href="#option-cargo-owner---add"><code>--add</code> <em>login</em>…</a></dt>
<dd class="option-desc"><p>将指定用户或团队设置为所有者。</p>
</dd>


<dt class="option-term" id="option-cargo-owner--r"><a class="option-anchor" href="#option-cargo-owner--r"><code>-r</code></a></dt>
<dt class="option-term" id="option-cargo-owner---remove"><a class="option-anchor" href="#option-cargo-owner---remove"><code>--remove</code> <em>login</em>…</a></dt>
<dd class="option-desc"><p>移除指定用户或团队作为所有者。</p>
</dd>


<dt class="option-term" id="option-cargo-owner--l"><a class="option-anchor" href="#option-cargo-owner--l"><code>-l</code></a></dt>
<dt class="option-term" id="option-cargo-owner---list"><a class="option-anchor" href="#option-cargo-owner---list"><code>--list</code></a></dt>
<dd class="option-desc"><p>列出一个 crate 的所有者。</p>
</dd>


<dt class="option-term" id="option-cargo-owner---token"><a class="option-anchor" href="#option-cargo-owner---token"><code>--token</code> <em>token</em></a></dt>
<dd class="option-desc"><p>用于身份验证的 API 令牌。此令牌会覆盖存储在凭据文件中的令牌（该文件由 <a href="cargo-login.html">cargo-login(1)</a> 生成）。</p> <p><a href="../reference/config.html">Cargo config</a> 环境变量可用于覆盖存储在凭据文件中的令牌。crates.io 的令牌可以通过 <code>CARGO_REGISTRY_TOKEN</code> 环境变量指定。其他注册表的令牌则可通过形式为 <code>CARGO_REGISTRIES_NAME_TOKEN</code> 的环境变量指定，其中 <code>NAME</code> 为大写字母表示的注册表名称。</p>
</dd>


<dt class="option-term" id="option-cargo-owner---index"><a class="option-anchor" href="#option-cargo-owner---index"><code>--index</code> <em>index</em></a></dt>
<dd class="option-desc"><p>要使用的注册表索引 URL。</p>
</dd>


<dt class="option-term" id="option-cargo-owner---registry"><a class="option-anchor" href="#option-cargo-owner---registry"><code>--registry</code> <em>registry</em></a></dt>
<dd class="option-desc"><p>要使用的注册表名称。注册表名称定义在 <a href="../reference/config.html">Cargo config 文件</a>中。如果未指定，则使用默认注册表，该注册表由 <code>registry.default</code> 配置键定义，默认为 <code>crates-io</code>。</p>
</dd>


</dl>

### 显示选项

<dl>
<dt class="option-term" id="option-cargo-owner--v"><a class="option-anchor" href="#option-cargo-owner--v"><code>-v</code></a></dt>
<dt class="option-term" id="option-cargo-owner---verbose"><a class="option-anchor" href="#option-cargo-owner---verbose"><code>--verbose</code></a></dt>
<dd class="option-desc"><p>启用详细输出。可以两次指定以获得“非常详细”的输出，包括依赖警告和构建脚本输出等额外信息。也可以通过 <code>term.verbose</code> <a href="../reference/config.html">配置值</a>来指定。</p>
</dd>


<dt class="option-term" id="option-cargo-owner--q"><a class="option-anchor" href="#option-cargo-owner--q"><code>-q</code></a></dt>
<dt class="option-term" id="option-cargo-owner---quiet"><a class="option-anchor" href="#option-cargo-owner---quiet"><code>--quiet</code></a></dt>
<dd class="option-desc"><p>不打印 cargo 日志消息。 也可以通过 <code>term.quiet</code> <a href="../reference/config.html">配置值</a>来指定。</p>
</dd>


<dt class="option-term" id="option-cargo-owner---color"><a class="option-anchor" href="#option-cargo-owner---color"><code>--color</code> <em>when</em></a></dt>
<dd class="option-desc"><p>控制彩色输出的使用方式。有效值包括：</p> <ul> <li><code>auto</code>（默认）：自动检测终端是否支持颜色显示。</li> <li><code>always</code>：始终显示颜色。</li> <li><code>never</code>：从不显示颜色。</li> </ul> <p>也可以通过 <code>term.color</code> <a href="../reference/config.html">配置值</a>来指定。</p>
</dd>

</dl>

### 常见选项

<dl>

<dt class="option-term" id="option-cargo-owner-+toolchain"><a class="option-anchor" href="#option-cargo-owner-+toolchain"><code>+</code><em>toolchain</em></a></dt>
<dd class="option-desc"><p>如果已通过 rustup 安装 Cargo，且 <code>cargo</code> 的第一个参数以 <code>+</code> 开头，则会被解释为 rustup 工具链名称（如 <code>+stable</code> 或 <code>+nightly</code>）。 有关工具链覆盖机制更多信息，请参阅 <a href="https://rust-lang.github.io/rustup/overrides.html">rustup 文档</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-owner---config"><a class="option-anchor" href="#option-cargo-owner---config"><code>--config</code> <em>KEY=VALUE</em> or <em>PATH</em></a></dt>
<dd class="option-desc"><p>用于覆盖 Cargo 配置值。参数应为 TOML 格式 <code>KEY=VALUE</code>，或作为额外配置文件的路径提供。此标志可以多次指定。 有关更多信息，请参阅 <a href="../reference/config.html#command-line-overrides">命令行覆盖部分</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-owner--C"><a class="option-anchor" href="#option-cargo-owner--C"><code>-C</code> <em>PATH</em></a></dt>
<dd class="option-desc"><p>在执行任何指定操作之前更改当前工作目录。这会影响 cargo 默认查找项目清单 (<code>Cargo.toml</code>)的位置，以及搜索 <code>.cargo/config.toml</code> 的目录。此选项必须出现在命令名称之前，例如 <code>cargo -C path/to/my-project build</code>。 此选项仅适用于 <a href="https://doc.rust-lang.org/book/appendix-07-nightly-rust.html">nightly 版本</a>，并且需要使用 <code>-Z unstable-options</code> 标志来启用（参见 <a href="https://github.com/rust-lang/cargo/issues/10098">#10098</a>）。</p>
</dd>


<dt class="option-term" id="option-cargo-owner--h"><a class="option-anchor" href="#option-cargo-owner--h"><code>-h</code></a></dt>
<dt class="option-term" id="option-cargo-owner---help"><a class="option-anchor" href="#option-cargo-owner---help"><code>--help</code></a></dt>
<dd class="option-desc"><p>打印帮助信息。</p>
</dd>


<dt class="option-term" id="option-cargo-owner--Z"><a class="option-anchor" href="#option-cargo-owner--Z"><code>-Z</code> <em>flag</em></a></dt>
<dd class="option-desc"><p>Cargo 的不稳定（仅 nightly 版本）标志。运行 <code>cargo -Z help</code> 以获取详细信息。</p>
</dd>


</dl>

## 环境

有关 Cargo 读取的环境变量详情，请参阅 [参考手册](../reference/environment-variables.html)。

## 退出状态

* `0`: Cargo 执行成功。
* `101`: Cargo 执行失败。

## 示例

1. 列出包的所有者：

       cargo owner --list foo

2. 邀请一个所有者管理包：

       cargo owner --add username foo

3. 移除包中的某个所有者：

       cargo owner --remove username foo

## 另请参阅 [cargo(1)](cargo.html), [cargo-login(1)](cargo-login.html), [cargo-publish(1)](cargo-publish.html)
