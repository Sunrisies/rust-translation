# cargo-report-future-incompatibilities(1)
## 名称

cargo-report-future-incompatibilities —— 报告所有将来可能无法编译的库

## 使用说明

`cargo report future-incompatibilities` [_选项_]

## 描述

显示之前构建过程中发出的未来不兼容警告的报告。这些警告涉及将来可能变成严重错误的变更，导致依赖项在未来的 rustc 版本中无法构建。

更多内容请参阅 [未来不兼容报告](../reference/future-incompat-report.html) 章节。

## 选项

<dl>

<dt class="option-term" id="option-cargo-report-future-incompatibilities---id"><a class="option-anchor" href="#option-cargo-report-future-incompatibilities---id"><code>--id</code> <em>id</em></a></dt>
<dd class="option-desc"><p>显示具有指定 Cargo 生成的 id 的报告。若未指定，则显示最新报告。</p>
</dd>


</dl>

### 包选择

默认情况下，会选择当前工作目录中的包。可以使用 `-p` 标志在工作空间中选择不同的包。

<dl>

<dt class="option-term" id="option-cargo-report-future-incompatibilities--p"><a class="option-anchor" href="#option-cargo-report-future-incompatibilities--p"><code>-p</code> <em>spec</em></a></dt>
<dt class="option-term" id="option-cargo-report-future-incompatibilities---package"><a class="option-anchor" href="#option-cargo-report-future-incompatibilities---package"><code>--package</code> <em>spec</em></a></dt>
<dd class="option-desc"><p>要显示报告的包。有关 SPEC 格式，请参阅 <a href="cargo-pkgid.html">cargo-pkgid(1)</a>。</p>
</dd>


</dl>

### 显示选项

<dl>
<dt class="option-term" id="option-cargo-report-future-incompatibilities--v"><a class="option-anchor" href="#option-cargo-report-future-incompatibilities--v"><code>-v</code></a></dt>
<dt class="option-term" id="option-cargo-report-future-incompatibilities---verbose"><a class="option-anchor" href="#option-cargo-report-future-incompatibilities---verbose"><code>--verbose</code></a></dt>
<dd class="option-desc"><p>使用详细输出。可以两次指定“非常详细”的输出，包括依赖警告和构建脚本输出等额外内容。也可以通过 <code>term.verbose</code> 的<a href="../reference/config.html">配置值</a>来指定。</p>
</dd>


<dt class="option-term" id="option-cargo-report-future-incompatibilities--q"><a class="option-anchor" href="#option-cargo-report-future-incompatibilities--q"><code>-q</code></a></dt>
<dt class="option-term" id="option-cargo-report-future-incompatibilities---quiet"><a class="option-anchor" href="#option-cargo-report-future-incompatibilities---quiet"><code>--quiet</code></a></dt>
<dd class="option-desc"><p>不打印 cargo 日志消息。也可以通过 <code>term.quiet</code> 的<a href "../reference/config.html">配置值</a>来指定。</p>
</dd>


<dt class="option-term" id="option-cargo-report-future-incompatibilities---color"><a class="option-anchor" href="#option-cargo-report-future-incompatibilities---color"><code>--color</code> <em>when</em></a></dt>
<dd class="option-desc"><p>控制彩色输出的使用情况。有效值包括： <ul> <li><code>auto</code>（默认）：自动检测终端是否支持颜色显示。</li> <li><code>always</code>：始终显示颜色。</li> <li><code>never</code>：从不显示颜色。</li> </ul> 也可以通过 <code>term.color</code> 的<a href "../reference/config.html">配置值</a>来指定。</p>
</dd>

</dl>

### 清单选项

<dl>
<dt class="option-term" id="option-cargo-report-future-incompatibilities---locked"><a class="option-anchor" href="#option-cargo-report-future-incompatibilities---locked"><code>--locked</code></a></dt>
<dd class="option-desc"><p>确保使用的依赖项和版本与原始生成 <code>Cargo.lock</code> 文件时完全相同。出现以下任一情况时，Cargo 将退出并抛出错误： <ul> <li>锁文件缺失。</li> <li>由于不同的依赖解析方式导致 Cargo 尝试修改锁文件。</li> </ul> 该选项适用于需要确定性构建的环境，例如 CI 流水线中。</p>
</dd>


<dt class="option-term" id="option-cargo-report-future-incompatibilities---offline"><a class="option-anchor" href="#option-cargo-report-future-incompatibilities---offline"><code>--offline</code></a></dt>
<dd class="option-desc"><p>防止 Cargo 因任何原因访问网络。如果没有此标志，当 Cargo 需要访问网络而网络不可用时，它将出现错误并停止。使用此标志后，Cargo 将尽可能在不连接网络的情况下继续运行。</p> <p>请注意，这可能会导致与在线模式不同的依赖解析结果。即使本地索引副本中显示有更新版本，Cargo 也会限制自己仅使用本地下载的包。在离线操作前，请查看 <a href="cargo-fetch.html">cargo-fetch(1)</a> 命令以下载依赖项。</p> <p>也可以通过 <code>net.offline</code> <a href="../reference/config.html">配置值</a>来指定此标志。</p>
</dd>


<dt class="option-term" id="option-cargo-report-future-incompatibilities---frozen"><a class="option-anchor" href="#option-cargo-report-future-incompatibilities---frozen"><code>--frozen</code></a></dt>
<dd class="option-desc"><p>相当于同时指定 <code>--locked</code> 和 <code>--offline</code>。</p>
</dd>

</dl>

### 常见选项

<dl>

<dt class="option-term" id="option-cargo-report-future-incompatibilities-+toolchain"><a class="option-anchor" href="#option-cargo-report-future-incompatibilities-+toolchain"><code>+</code><em>toolchain</em></a></dt>
<dd class="option-desc"><p>如果 Cargo 是通过 rustup 安装的，且 <code>cargo</code> 的第一个参数以 <code>+</code> 开头，则会被解释为 rustup 工具链名称（如 <code>+stable</code> 或 <code>+nightly</code>）。 有关工具链覆盖机制更多信息，请参阅 <a href="https://rust-lang.github.io/rustup/overrides.html">rustup 文档</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-report-future-incompatibilities---config"><a class="option-anchor" href="#option-cargo-report-future-incompatibilities---config"><code>--config</code> <em>KEY=VALUE</em> or <em>PATH</em></a></dt>
<dd class="option-desc"><p>覆盖 Cargo 配置值。参数应为 TOML 语法 <code>KEY=VALUE</code>，或作为额外配置文件的路径提供。此标志可以多次指定。 有关更多信息，请参阅 <a href="../reference/config.html#command-line-overrides">命令行覆盖部分</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-report-future-incompatibilities--C"><a class="option-anchor" href="#option-cargo-report-future-incompatibilities--C"><code>-C</code> <em>PATH</em></a></dt>
<dd class="option-desc"><p>在执行任何指定操作之前更改当前工作目录。这会影响 Cargo 默认查找项目清单 (<code>Cargo.toml</code>)的位置，以及用于发现 <code>.cargo/config.toml</code> 的搜索目录。此选项必须位于命令名称之前，例如 <code>cargo -C path/to/my-project build</code>。 <p>此选项仅在 <a href="https://doc.rust-lang.org/book/appendix-07-nightly-rust.html">nightly 通道</a>上可用，并且需要 <code>-Z unstable-options</code> 标志才能启用（参见 <a href="https://github.com/rust-lang/cargo/issues/10098">#10098</a>）。</p></p></dd>


<dt class="option-term" id="option-cargo-report-future-incompatibilities--h"><a class="option-anchor" href="#option-cargo-report-future-incompatibilities--h"><code>-h</code></a></dt>
<dt class="option-term" id="option-cargo-report-future-incompatibilities---help"><a class="option-anchor" href="#option-cargo-report-future-incompatibilities---help"><code>--help</code></a></dt>
<dd class="option-desc"><p>打印帮助信息。</p>
</dd>


<dt class="option-term" id="option-cargo-report-future-incompatibilities--Z"><a class="option-anchor" href="#option-cargo-report-future-incompatibilities--Z"><code>-Z</code> <em>flag</em></a></dt>
<dd class="option-desc"><p>针对 Cargo 的不稳定（仅夜间生效）标志。运行 <code>cargo -Z help</code> 以查看详细信息。</p>
</dd>


</dl>

## 环境

有关 Cargo 读取的环境变量详情，请参阅 [参考手册](../reference/environment-variables.html)。

## 退出状态

* `0`: Cargo 成功执行。
* `101`: Cargo 执行失败。

## 示例

1. 显示最新的未来不兼容报告：

       cargo report future-incompat

2. 显示特定包的最新未来不兼容报告：

       cargo report future-incompat --包 my-dep@0.0.1

## 参见

[cargo(1)](cargo.html), [cargo-report(1)](cargo-report.html), [cargo-build(1)](cargo-build.html)
