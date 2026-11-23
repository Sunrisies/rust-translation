# cargo-report(1)

## 名称

cargo-report --- 生成并显示各种类型的报告

## 概述

`cargo report` _类型_ [_选项_]

## 描述

显示给定_类型_的报告——目前仅支持 `future-incompat`。

## 选项

### 显示选项

<dl>
<dt class="option-term" id="option-cargo-report--v"><a class="option-anchor" href="#option-cargo-report--v"><code>-v</code></a></dt>
<dt class="option-term" id="option-cargo-report---verbose"><a class="option-anchor" href="#option-cargo-report---verbose"><code>--verbose</code></a></dt>
<dd class="option-desc"><p>使用详细输出。对于“非常详细”的输出，可以指定两次，该选项包含额外的输出，如依赖警告和构建脚本输出。也可以通过 <code>term.verbose</code> <a href="../reference/config.html">配置值</a>来指定此选项。</p>
</dd>


<dt class="option-term" id="option-cargo-report--q"><a class="option-anchor" href="#option-cargo-report--q"><code>-q</code></a></dt>
<dt class="option-term" id="option-cargo-report---quiet"><a class="option-anchor" href="#option-cargo-report---quiet"><code>--quiet</code></a></dt>
<dd class="option-desc"><p>不要打印 cargo 日志消息。也可以通过 <code>term.quiet</code> <a href="../reference/config.html">配置值</a>来禁用此功能。</p>
</dd>


<dt class="option-term" id="option-cargo-report---color"><a class="option-anchor" href="#option-cargo-report---color"><code>--color</code> <em>when</em></a></dt>
<dd class="option-desc"><p>控制是否使用彩色输出。有效值包括： <ul> <li><code>auto</code>（默认）：自动检测终端是否支持颜色显示。</li> <li><code>always</code>：始终显示颜色。</li> <li><code>never</code>：从不显示颜色。</li> </ul> 也可以通过 <code>term.color</code> <a href="../reference/config.html">配置值</a>来指定此选项。</p>
</dd>

</dl>

### 清单选项

<dl>
<dt class="option-term" id="option-cargo-report---locked"><a class="option-anchor" href="#option-cargo-report---locked"><code>--locked</code></a></dt>
<dd class="option-desc"><p>确保使用的依赖项和版本与原始生成 <code>Cargo.lock</code> 文件时相同。如果出现以下任一情况，Cargo 将退出并抛出错误： <ul> <li>锁文件缺失。</li> <li>由于不同的依赖解析导致 Cargo 尝试修改锁文件。</li> </ul> 该选项适用于需要确定性构建的环境，例如 CI 管道中。</p>
</dd>


<dt class="option-term" id="option-cargo-report---offline"><a class="option-anchor" href="#option-cargo-report---offline"><code>--offline</code></a></dt>
<dd class="option-desc"><p>防止 Cargo 出于任何原因访问网络。如果没有此标志，如果 Cargo 需要访问网络而网络不可用时，它将退出并抛出错误。使用此标志后，Cargo 将尝试在可能的情况下不依赖网络继续运行。</p> >请注意，这可能会导致与在线模式不同的依赖解析结果。即使本地索引中显示有更新版本，Cargo 也将限制自己仅使用本地下载的包。在离线操作前，请参阅 <a href="cargo-fetch.html">cargo-fetch(1)</a> 命令以下载依赖项。 >也可以通过 <code>net.offline</code> <a href="../reference/config.html">配置值</a>来指定此选项。
</dd>


<dt class="option-term" id="option-cargo-report---frozen"><a class="option-anchor" href="#option-cargo-report---frozen"><code>--frozen</code></a></dt>
<dd class="option-desc"><p>相当于同时指定 <code>--locked</code> 和 <code>--offline</code> 选项。</p>
</dd>

</dl>

### 常用选项

<dl>

<dt class="option-term" id="option-cargo-report-+toolchain"><a class="option-anchor" href="#option-cargo-report-+toolchain"><code>+</code><em>toolchain</em></a></dt>
<dd class="option-desc"><p>如果已通过 rustup 安装 Cargo，且 <code>cargo</code> 的第一个参数以 <code>+</code> 开头，则会被解释为 rustup 工具链名称（如 <code>+stable</code> 或 <code>+nightly</code>）。 有关工具链覆盖机制的信息，请参阅<a href="https://rust-lang.github.io/rustup/overrides.html">rustup 文档</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-report---config"><a class="option-anchor" href="#option-cargo-report---config"><code>--config</code> <em>KEY=VALUE</em> or <em>PATH</em></a></dt>
<dd class="option-desc"><p>用于覆盖 Cargo 配置值。参数应为 TOML 格式 <code>KEY=VALUE</code>，或作为额外配置文件的路径提供。此标志可以多次指定。 有关更多信息，请参阅<a href="../reference/config.html#command-line-overrides">命令行覆盖部分</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-report--C"><a class="option-anchor" href="#option-cargo-report--C"><code>-C</code> <em>PATH</em></a></dt>
<dd class="option-desc"><p>在执行任何指定操作之前更改当前工作目录。这会影响 cargo 默认查找项目清单 (<code>Cargo.toml</code>)的位置，以及搜索 <code>.cargo/config.toml</code> 等目录的方式。此选项必须位于命令名之前，例如 <code>cargo -C path/to/my-project build</code>。 该选项仅适用于 <a href="https://doc.rust-lang.org/book/appendix-07-nightly-rust.html">nightly 渠道</a>，并且需要使用 <code>-Z unstable-options</code> 标志来启用（参见 <a href="https://github.com/rust-lang/cargo/issues/10098">#10098</a>）。</p>
</dd>


<dt class="option-term" id="option-cargo-report--h"><a class="option-anchor" href="#option-cargo-report--h"><code>-h</code></a></dt>
<dt class="option-term" id="option-cargo-report---help"><a class="option-anchor" href="#option-cargo-report---help"><code>--help</code></a></dt>
<dd class="option-desc"><p>打印帮助信息。</p>
</dd>


<dt class="option-term" id="option-cargo-report--Z"><a class="option-anchor" href="#option-cargo-report--Z"><code>-Z</code> <em>flag</em></a></dt>
<dd class="option-desc"><p>Cargo 的不稳定（仅 nightly 版本）标志。运行 <code>cargo -Z help</code> 以获取详细信息。</p>
</dd>


</dl>

## 环境

有关 Cargo 读取的环境变量详情，请参阅 [参考手册](../reference/environment-variables.html)。

## 退出状态

* `0`: Cargo 成功执行。
* `101`: Cargo 未能完成。

## 示例

1. 显示可用的报告类型：

       cargo report --help

## 另请参阅

[cargo(1)](cargo.html), [cargo-report-future-incompatibilities(1)](cargo-report-future-incompatibilities.html)
