# cargo-help(1)

## 名称

cargo-help --- 获取 Cargo 命令的帮助信息

## 概述

`cargo help` [_子命令_]

## 描述

输出给定命令的帮助消息。

对于包含子命令的命令，用空格分隔不同层级。例如，`cargo help report future-incompatibilities` 会显示 `cargo report future-incompatibilities` 命令的帮助信息。

仅当父命令与其子命令之间使用空格来分隔层级。而作为命令名称一部分的短横线，如 `generate-lockfile`，必须保持原样。

多个层级也可以写成一个由短横线连接的单词。例如，`cargo help report-future-incompatibilities` 等同于 `cargo help report future-incompatibilities`。

## 选项

### 显示选项

<dl>
<dt class="option-term" id="option-cargo-help--v"><a class="option-anchor" href="#option-cargo-help--v"><code>-v</code></a></dt>
<dt class="option-term" id="option-cargo-help---verbose"><a class="option-anchor" href="#option-cargo-help---verbose"><code>--verbose</code></a></dt>
<dd class="option-desc"><p>使用详细输出。对于“非常详细”的输出，可以指定两次，包括额外的输出内容，如依赖警告和构建脚本输出。也可以通过 <code>term.verbose</code> <a href="../reference/config.html">配置值</a>来指定。</p>
</dd>


<dt class="option-term" id="option-cargo-help--q"><a class="option-anchor" href="#option-cargo-help--q"><code>-q</code></a></dt>
<dt class="option-term" id="option-cargo-help---quiet"><a class="option-anchor" href="#option-cargo-help---quiet"><code>--quiet</code></a></dt>
<dd class="option-desc"><p>不要打印 cargo 日志消息。也可以通过 <code>term.quiet</code> <a href="../reference/config.html">配置值</a>来指定。</p>
</dd>


<dt class="option-term" id="option-cargo-help---color"><a class="option-anchor" href="#option-cargo-help---color"><code>--color</code> <em>when</em></a></dt>
<dd class="option-desc"><p>控制是否使用彩色输出。有效值包括： <ul> <li><code>auto</code>（默认）：自动检测终端是否支持颜色显示。</li> <li><code>always</code>：始终显示颜色。</li> <li><code>never</code>：从不显示颜色。</li> </ul> 也可以通过 <code>term.color</code> <a href="../reference/config.html">配置值</a>来指定。</p>
</dd>

</dl>

### 清单选项

<dl>
<dt class="option-term" id="option-cargo-help---locked"><a class="option-anchor" href="#option-cargo-help---locked"><code>--locked</code></a></dt>
<dd class="option-desc"><p>确保使用的依赖项和版本与原始生成 <code>Cargo.lock</code> 文件时相同。如果出现以下任一情况，Cargo 将退出并抛出错误： <ul> <li>锁文件缺失。</li> <li>由于不同的依赖解析导致 Cargo 尝试修改锁文件。</li> </ul> 该选项适用于需要确定性构建的环境，例如 CI 管道中。</p>
</dd>


<dt class="option-term" id="option-cargo-help---offline"><a class="option-anchor" href="#option-cargo-help---offline"><code>--offline</code></a></dt>
<dd class="option-desc"><p>防止 Cargo 出于任何原因访问网络。如果没有此标志，如果 Cargo 需要访问网络而网络不可用时，它将退出并抛出错误。使用此标志后，Cargo 将尝试在可能的情况下不依赖网络继续运行。 请注意，这可能会导致与在线模式不同的依赖解析。Cargo 将限制自己仅使用本地下载的包，即使本地索引中显示有更新版本也是如此。在离线前，请参阅 <a href="cargo-fetch.html">cargo-fetch(1)</a> 命令来下载依赖项。</p>
</dd>


<dt class="option-term" id="option-cargo-help---frozen"><a class="option-anchor" href="#option-cargo-help---frozen"><code>--frozen</code></a></dt>
<dd class="option-desc"><p>相当于同时指定 <code>--locked</code> 和 <code>--offline</code>。</p>
</dd>

</dl>

### 常见选项

<dl>

<dt class="option-term" id="option-cargo-help-+toolchain"><a class="option-anchor" href="#option-cargo-help-+toolchain"><code>+</code><em>toolchain</em></a></dt>
<dd class="option-desc"><p>如果已通过 rustup 安装 Cargo，且 <code>cargo</code> 的第一个参数以 <code>+</code> 开头，则会被解释为 rustup 工具链名称（如 <code>+stable</code> 或 <code>+nightly</code>）。 有关工具链覆盖机制更多信息，请参阅<a href="https://rust-lang.github.io/rustup/overrides.html">rustup 文档</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-help---config"><a class="option-anchor" href="#option-cargo-help---config"><code>--config</code> <em>KEY=VALUE</em> or <em>PATH</em></a></dt>
<dd class="option-desc"><p>用于覆盖 Cargo 配置值。参数应为 TOML 格式 <code>KEY=VALUE</code>，或作为额外配置文件的路径提供。此标志可以多次指定。 有关更多信息，请参阅<a href="../reference/config.html#command-line-overrides">命令行覆盖部分</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-help--C"><a class="option-anchor" href="#option-cargo-help--C"><code>-C</code> <em>PATH</em></a></dt>
<dd class="option-desc"><p>在执行任何指定操作之前更改当前工作目录。这会影响 cargo 默认查找项目清单 (<code>Cargo.toml</code>)的位置，以及搜索 <code>.cargo/config.toml</code> 的目录等。此选项必须出现在命令名称之前，例如 <code>cargo -C path/to/my-project build</code>。 此选项仅在 <a href="https://doc.rust-lang.org/book/appendix-07-nightly-rust.html">nightly 渠道</a>上可用，并且需要使用 <code>-Z unstable-options</code> 标志来启用（参见 <a href="https://github.com/rust-lang/cargo/issues/10098">#10098</a>）。</p>
</dd>


<dt class="option-term" id="option-cargo-help--h"><a class="option-anchor" href="#option-cargo-help--h"><code>-h</code></a></dt>
<dt class="option-term" id="option-cargo-help---help"><a class="option-anchor" href="#option-cargo-help---help"><code>--help</code></a></dt>
<dd class="option-desc"><p>打印帮助信息。</p>
</dd>


<dt class="option-term" id="option-cargo-help--Z"><a class="option-anchor" href="#option-cargo-help--Z"><code>-Z</code> <em>flag</em></a></dt>
<dd class="option-desc"><p>Cargo 的不稳定（仅 nightly 版本）标志。运行 <code>cargo -Z help</code> 以获取详细信息。</p>
</dd>


</dl>

## 环境

有关 Cargo 读取的环境变量详情，请参阅 [参考手册](../reference/environment-variables.html)。

## 退出状态

* `0`: Cargo 执行成功。
* `101`: Cargo 未能完成。

## 示例

1. 获取命令的帮助信息：

       cargo help build

2. 获取嵌套命令的帮助信息：

       cargo help report future-incompatibilities

3. 使用短横线连接的格式同样有效：

       cargo help report-future-incompatibilities

4. 使用 `--help` 标志也可以获得帮助信息：

       cargo build --help

## 另请参阅 [cargo(1)](cargo.html)
