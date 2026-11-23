# cargo-fetch(1)
## 名称

cargo-fetch —— 从网络获取包的依赖项

## 概述

`cargo fetch` [_选项_]

## 描述

如果存在 `Cargo.lock` 文件，此命令将确保所有 git 依赖项和/或注册表依赖项被下载并本地可用。除非锁文件发生变化，否则后续 Cargo 命令可以在离线状态下运行。

如果锁文件不存在，则此命令将在获取依赖项之前生成锁文件。

如果不指定 `--target`，则会获取所有目标依赖项。

## 选项

### 获取选项

<dl>
<dt class="option-term" id="option-cargo-fetch---target"><a class="option-anchor" href="#option-cargo-fetch---target"><code>--target</code> <em>tuple</em></a></dt>
<dd class="option-desc"><p>用于指定目标架构的 Fetch。可以多次指定此标志，默认情况下为所有架构。元组的一般格式为 <code>&lt;arch&gt;&lt;sub&gt;-&lt;vendor&gt;-&lt;sys&gt;-&lt;abi&gt;</code>。</p> <p>可能的值：</p> <ul> <li>在 <code>rustc --print target-list</code> 中支持的任何目标。</li> <li><code>"host-tuple"</code>，该值将内部由主机目标替代。如果进行跨编译某些库且不想指定主机机器作为目标（例如，在多个主机可使用的共享项目中使用的 <code>xtask</code>），此选项非常有用。</li> <li>指向自定义目标规范的路径。有关更多信息，请参阅<a href="../../rustc/targets/custom.html#custom-target-lookup-path">自定义目标查找路径</a>。</li> </ul> <p>也可以通过 <code>build.target</code> <a href="../reference/config.html">配置值</a>来指定此选项。</p> <p>请注意，指定此标志会使 Cargo 以不同的模式运行，此时目标工件被放置在单独的目录中。有关更多细节，请参阅<a href="../reference/build-cache.html">构建缓存</a>文档。</p>
</dd>

</dl>

### 显示选项

<dl>
<dt class="option-term" id="option-cargo-fetch--v"><a class="option-anchor" href="#option-cargo-fetch--v"><code>-v</code></a></dt>
<dt class="option-term" id="option-cargo-fetch---verbose"><a class="option-anchor" href="#option-cargo-fetch---verbose"><code>--verbose</code></a></dt>
<dd class="option-desc"><p>使用详细输出。可以两次指定以获得“非常详细”的输出，包括额外的输出如依赖警告和构建脚本输出。也可以通过 <code>term.verbose</code> <a href="../reference/config.html">配置值</a>来指定。</p>
</dd>


<dt class="option-term" id="option-cargo-fetch--q"><a class="option-anchor" href="#option-cargo-fetch--q"><code>-q</code></a></dt>
<dt class="option-term" id="option-cargo-fetch---quiet"><a class="option-anchor" href="#option-cargo-fetch---quiet"><code>--quiet</code></a></dt>
<dd class="option-desc"><p>不打印 cargo 日志消息。 也可以通过 <code>term.quiet</code> <a href="../reference/config.html">配置值</a>来指定。</p>
</dd>


<dt class="option-term" id="option-cargo-fetch---color"><a class="option-anchor" href="#option-cargo-fetch---color"><code>--color</code> <em>when</em></a></dt>
<dd class="option-desc"><p>控制彩色输出的使用。有效值：</p> <ul> <li><code>auto</code>（默认）：自动检测终端是否支持颜色显示。</li> <li><code>always</code>：始终显示颜色。</li> <li><code>never</code>：从不显示颜色。</li> </ul> <p>也可以通过 <code>term.color</code> <a href="../reference/config.html">配置值</a>来指定。</p>
</dd>

</dl>

### 清单选项

<dl>
<dt class="option-term" id="option-cargo-fetch---manifest-path"><a class="option-anchor" href="#option-cargo-fetch---manifest-path"><code>--manifest-path</code> <em>path</em></a></dt>
<dd class="option-desc"><p><code>Cargo.toml</code> 文件的路径。默认情况下，Cargo 会在当前目录或任何父目录中搜索 <code>Cargo.toml</code> 文件。</p>
</dd>


<dt class="option-term" id="option-cargo-fetch---locked"><a class="option-anchor" href="#option-cargo-fetch---locked"><code>--locked</code></a></dt>
<dd class="option-desc"><p>断言使用与原始生成 <code>Cargo.lock</code> 文件时完全相同的依赖项和版本。当出现以下任一情况时，Cargo 将以错误退出： <ul> <li>锁定文件缺失。</li> <li>由于不同的依赖解析导致 Cargo 尝试修改锁定文件。</li> </ul> 该选项可用于需要确定性构建的环境中，例如 CI 流水线。</p>
</dd>


<dt class="option-term" id="option-cargo-fetch---offline"><a class="option-anchor" href="#option-cargo-fetch---offline"><code>--offline</code></a></dt>
<dd class="option-desc"><p>防止 Cargo 出于任何原因访问网络。如果没有此标志，如果 Cargo 需要访问网络而网络不可用时，它将以错误退出。使用此标志后，Cargo 将尽可能在不连接网络的情况下继续运行。 请注意，这可能导致与在线模式不同的依赖解析。Cargo 将限制自己仅使用本地下载的包，即使索引中的本地副本显示有更新版本也是如此。 也可以通过 <code>net.offline</code> <a href="../reference/config.html">配置值</a>来指定此选项。</p>
</dd>


<dt class="option-term" id="option-cargo-fetch---frozen"><a class="option-anchor" href="#option-cargo-fetch---frozen"><code>--frozen</code></a></dt>
<dd class="option-desc"><p>相当于同时指定 <code>--locked</code> 和 <code>--offline</code>。</p>
</dd>


</dl>

### 常见选项

<dl>

<dt class="option-term" id="option-cargo-fetch-+toolchain"><a class="option-anchor" href="#option-cargo-fetch-+toolchain"><code>+</code><em>toolchain</em></a></dt>
<dd class="option-desc"><p>如果 Cargo 通过 rustup 安装，且 <code>cargo</code> 的第一个参数以 <code>+</code> 开头，则会被解释为 rustup 工具链名称（如 <code>+stable</code> 或 <code>+nightly</code>）。 有关工具链覆盖机制的更多信息，请参阅 <a href="https://rust-lang.github.io/rustup/overrides.html">rustup 文档</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-fetch---config"><a class="option-anchor" href="#option-cargo-fetch---config"><code>--config</code> <em>KEY=VALUE</em> or <em>PATH</em></a></dt>
<dd class="option-desc"><p>用于覆盖 Cargo 配置值。参数应为 TOML 语法 <code>KEY=VALUE</code>，或作为额外配置文件的路径提供。此标志可以多次指定。 有关更多信息，请参阅 <a href="../reference/config.html#command-line-overrides">命令行覆盖部分</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-fetch--C"><a class="option-anchor" href="#option-cargo-fetch--C"><code>-C</code> <em>PATH</em></a></dt>
<dd class="option-desc"><p>在执行任何指定操作之前，此选项会更改当前工作目录。这会影响诸如 cargo 默认查找项目清单 (<code>Cargo.toml</code>)的位置，以及用于发现 <code>.cargo/config.toml</code> 的搜索目录等设置。该选项必须出现在命令名称之前，例如 <code>cargo -C path/to/my-project build</code>。</p> <p>此选项仅适用于 <a href="https://doc.rust-lang.org/book/appendix-07-nightly-rust.html">nightly 版本</a>，并且需要使用 <code>-Z unstable-options</code> 标志才能启用（参见 <a href="https://github.com/rust-lang/cargo/issues/10098">#10098</a>）。</p>
</dd>


<dt class="option-term" id="option-cargo-fetch--h"><a class="option-anchor" href="#option-cargo-fetch--h"><code>-h</code></a></dt>
<dt class="option-term" id="option-cargo-fetch---help"><a class="option-anchor" href="#option-cargo-fetch---help"><code>--help</code></a></dt>
<dd class="option-desc"><p>打印帮助信息。</p>
</dd>


<dt class="option-term" id="option-cargo-fetch--Z"><a class="option-anchor" href="#option-cargo-fetch--Z"><code>-Z</code> <em>flag</em></a></dt>
<dd class="option-desc"><p>Cargo 的不稳定（仅 nightly 版本）标志。运行 <code>cargo -Z help</code> 以获取详细信息。</p>
</dd>


</dl>

## 环境

有关 Cargo 读取的环境变量详情，请参阅 [参考手册](../reference/environment-variables.html)。

## 退出状态

* `0`: Cargo 成功执行。
* `101`: Cargo 执行失败。

## 示例

1. 获取所有依赖项：

       cargo fetch

## 另请参阅 [cargo(1)](cargo.html)、[cargo-update(1)](cargo-update.html)、[cargo-generate-锁文件(1)](cargo-generate-锁文件.html)
