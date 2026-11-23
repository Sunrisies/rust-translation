# cargo-search(1)

## 名称

cargo-search —— 在注册表内搜索包。默认注册表为 crates.io

## 功能说明

`cargo search` [_options_] [_query_...]

## 描述

此命令在 <https://crates.io> 上执行文本搜索以查找包。匹配的包及其 TOML 格式的描述将显示出来，适合复制到 `Cargo.toml` 清单中。

## 选项

### 搜索选项

<dl>

<dt class="option-term" id="option-cargo-search---limit"><a class="option-anchor" href="#option-cargo-search---limit"><code>--limit</code> <em>limit</em></a></dt>
<dd class="option-desc"><p>限制结果数量（默认：10，最大：100）。</p>
</dd>


<dt class="option-term" id="option-cargo-search---index"><a class="option-anchor" href="#option-cargo-search---index"><code>--index</code> <em>index</em></a></dt>
<dd class="option-desc"><p>要使用的注册表索引的 URL。</p>
</dd>


<dt class="option-term" id="option-cargo-search---registry"><a class="option-anchor" href="#option-cargo-search---registry"><code>--registry</code> <em>registry</em></a></dt>
<dd class="option-desc"><p>要使用的注册表名称。注册表名称定义在 <a href="../reference/config.html">Cargo 配置文件</a>中。如果未指定，则使用默认注册表，该注册表由 <code>registry.default</code> 配置键定义，默认为 <code>crates-io</code>。</p>
</dd>


</dl>

### 显示选项

<dl>
<dt class="option-term" id="option-cargo-search--v"><a class="option-anchor" href="#option-cargo-search--v"><code>-v</code></a></dt>
<dt class="option-term" id="option-cargo-search---verbose"><a class="option-anchor" href="#option-cargo-search---verbose"><code>--verbose</code></a></dt>
<dd class="option-desc"><p>启用详细输出。可以两次指定以获得“非常详细”的输出，包含依赖警告和构建脚本输出等额外信息。也可以通过 <code>term.verbose</code> <a href="../reference/config.html">配置值</a>来指定。</p>
</dd>


<dt class="option-term" id="option-cargo-search--q"><a class="option-anchor" href="#option-cargo-search--q"><code>-q</code></a></dt>
<dt class="option-term" id="option-cargo-search---quiet"><a class="option-anchor" href="#option-cargo-search---quiet"><code>--quiet</code></a></dt>
<dd class="option-desc"><p>不打印 Cargo 日志消息。也可以通过 <code>term.quiet</code> <a href="../reference/config.html">配置值</a>来指定。</p>
</dd>


<dt class="option-term" id="option-cargo-search---color"><a class="option-anchor" href="#option-cargo-search---color"><code>--color</code> <em>when</em></a></dt>
<dd class="option-desc"><p>控制彩色输出的使用情况。有效值包括： <ul> <li><code>auto</code>（默认）：自动检测终端是否支持颜色显示。</li> <li><code>always</code>：始终显示颜色。</li> <li><code>never</code>：从不显示颜色。</li> </ul> 也可以通过 <code>term.color</code> <a href="../reference/config.html">配置值</a>来指定。</p>
</dd>

</dl>

### 常用选项

<dl>

<dt class="option-term" id="option-cargo-search-+toolchain"><a class="option-anchor" href="#option-cargo-search-+toolchain"><code>+</code><em>toolchain</em></a></dt>
<dd class="option-desc"><p>如果 Cargo 通过 rustup 安装，且 <code>cargo</code> 的第一个参数以 <code>+</code> 开头，则会被解释为 rustup 工具链名称（如 <code>+stable</code> 或 <code>+nightly</code>）。有关工具链覆盖机制的更多信息，请参阅 <a href="https://rust-lang.github.io/rustup/overrides.html">rustup 文档</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-search---config"><a class="option-anchor" href="#option-cargo-search---config"><code>--config</code> <em>KEY=VALUE</em> or <em>PATH</em></a></dt>
<dd class="option-desc"><p>用于覆盖 Cargo 配置值。参数应为 TOML 格式 <code>KEY=VALUE</code>，或作为额外配置文件的路径提供。此标志可以多次指定。有关更多信息，请参阅 <a href="../reference/config.html#command-line-overrides">命令行覆盖部分</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-search--C"><a class="option-anchor" href="#option-cargo-search--C"><code>-C</code> <em>PATH</em></a></dt>
<dd class="option-desc"><p>在执行任何指定操作之前，更改当前工作目录。这会影响诸如 cargo 默认查找项目清单 (<code>Cargo.toml</code>)的位置，以及用于发现 <code>.cargo/config.toml</code> 的搜索目录等设置。此选项必须出现在命令名称之前，例如 <code>cargo -C path/to/my-project build</code>。</p> <p>此选项仅适用于 <a href="https://doc.rust-lang.org/book/appendix-07-nightly-rust.html">nightly 渠道</a>，并且需要使用 <code>-Z unstable-options</code> 标志才能启用（参见 <a href="https://github.com/rust-lang/cargo/issues/10098">#10098</a>）。</p>
</dd>


<dt class="option-term" id="option-cargo-search--h"><a class="option-anchor" href="#option-cargo-search--h"><code>-h</code></a></dt>
<dt class="option-term" id="option-cargo-search---help"><a class="option-anchor" href="#option-cargo-search---help"><code>--help</code></a></dt>
<dd class="option-desc"><p>打印帮助信息。</p>
</dd>


<dt class="option-term" id="option-cargo-search--Z"><a class="option-anchor" href="#option-cargo-search--Z"><code>-Z</code> <em>flag</em></a></dt>
<dd class="option-desc"><p>Cargo 的不稳定（仅 nightly 版本）标志。运行 <code>cargo -Z help</code> 以获取详细信息。</p>
</dd>


</dl>

## 环境

有关 Cargo 读取的环境变量详情，请参阅 [参考手册](../reference/environment-variables.html)。

## 退出状态

* `0`: Cargo 成功执行。
* `101`: Cargo 未能完成。

## 示例

1. 在 crates.io 中搜索某个包：

       cargo search serde

## 另请参阅

[cargo(1)](cargo.html), [cargo-install(1)](cargo-install.html), [cargo-publish(1)](cargo-publish.html)
