# cargo-clean(1)
## 名称

cargo-clean --- 删除生成的产物

## 概述

`cargo clean` [_选项_]

## 描述

删除 Cargo 过去生成的目标目录中的产物。

未指定选项时，`cargo clean` 将删除整个目标目录。

## 选项

### 包选择

未选择任何包时，工作区中的所有包和所有依赖项都会被清理。

<dl>

<dt class="option-term" id="option-cargo-clean--p"><a class="option-anchor" href="#option-cargo-clean--p"><code>-p</code> <em>spec</em>…</a></dt>
<dt class="option-term" id="option-cargo-clean---package"><a class="option-anchor" href="#option-cargo-clean---package"><code>--package</code> <em>spec</em>…</a></dt>
<dd class="option-desc"><p>仅清理指定的包。此标志可以多次指定。有关 SPEC 格式，请参阅 <a href="cargo-pkgid.html">cargo-pkgid(1)</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-clean---workspace"><a class="option-anchor" href="#option-cargo-clean---workspace"><code>--workspace</code></a></dt>
<dd class="option-desc"><p>清理工作区成员的生成物。</p>
</dd>


</dl>

### 清理选项

<dl>

<dt class="option-term" id="option-cargo-clean---dry-run"><a class="option-anchor" href="#option-cargo-clean---dry-run"><code>--dry-run</code></a></dt>
<dd class="option-desc"><p>显示将被删除的内容摘要，但不实际删除任何内容。使用 <code>--verbose</code> 可以查看将被删除的实际文件。</p>
</dd>


<dt class="option-term" id="option-cargo-clean---doc"><a class="option-anchor" href="#option-cargo-clean---doc"><code>--doc</code></a></dt>
<dd class="option-desc"><p>此选项会使 <code>cargo clean</code> 仅移除目标目录中的 <code>doc</code> 目录。</p>
</dd>


<dt class="option-term" id="option-cargo-clean---release"><a class="option-anchor" href="#option-cargo-clean---release"><code>--release</code></a></dt>
<dd class="option-desc"><p>仅移除 <code>release</code> 目录中的生成物。</p>
</dd>


<dt class="option-term" id="option-cargo-clean---profile"><a class="option-anchor" href="#option-cargo-clean---profile"><code>--profile</code> <em>name</em></a></dt>
<dd class="option-desc"><p>仅移除具有给定配置文件名的目录中的生成物。</p>
</dd>


<dt class="option-term" id="option-cargo-clean---target-dir"><a class="option-anchor" href="#option-cargo-clean---target-dir"><code>--target-dir</code> <em>directory</em></a></dt>
<dd class="option-desc"><p>所有生成物和中间文件的目录。也可以通过 <code>CARGO_TARGET_DIR</code> 环境变量或 <code>build.target-dir</code> <a href="../reference/config.html">配置值</a>来指定。默认值为工作区根目录下的 <code>target</code>。</p>
</dd>


<dt class="option-term" id="option-cargo-clean---target"><a class="option-anchor" href="#option-cargo-clean---target"><code>--target</code> <em>tuple</em></a></dt>
<dd class="option-desc"><p>针对指定的目标架构进行清理。此标志可以多次指定。默认为目标机器架构。该元组的通用格式为 <code>&lt;arch&gt;&lt;sub&gt;-&lt;vendor&gt;-&lt;sys&gt;-&lt;abi&gt;</code>。</p> <p>可能的值：</p> <ul> <li>在 <code>rustc --print target-list</code> 中支持的任何目标。</li> <li><code>"host-tuple"</code>，内部会被替换为主机目标。如果你正在交叉编译某些库，且不想指定主机机器作为目标（例如，在多个主机可使用的共享项目中使用的 <code>xtask</code>），这非常有用。</li> <li>自定义目标规范的路径。有关更多信息，请参阅 <a href="../../rustc/targets/custom.html#custom-target-lookup-path">自定义目标查找路径</a>。</li> </ul> <p>也可以通过 <code>build.target</code> <a href="../reference/config.html">配置值</a>来指定此选项。</p> <p>请注意，指定此标志会使 Cargo 以不同的模式运行，其中目标生成物被放置于单独的目录中。有关更多细节，请参阅 <a href../reference/build-cache.html">构建缓存</a>文档。</p>
</dd>


</dl>

### 显示选项

<dl>
<dt class="option-term" id="option-cargo-clean--v"><a class="option-anchor" href="#option-cargo-clean--v"><code>-v</code></a></dt>
<dt class="option-term" id="option-cargo-clean---verbose"><a class="option-anchor" href="#option-cargo-clean---verbose"><code>--verbose</code></a></dt>
<dd class="option-desc"><p>使用详细输出。对于“非常详细”的输出，可以指定两次，该选项包含额外的输出，如依赖项警告和构建脚本输出。也可以通过 <code>term.verbose</code> <a href="../reference/config.html">配置值</a>来指定此选项。</p>
</dd>


<dt class="option-term" id="option-cargo-clean--q"><a class="option-anchor" href="#option-cargo-clean--q"><code>-q</code></a></dt>
<dt class="option-term" id="option-cargo-clean---quiet"><a class="option-anchor" href="#option-cargo-clean---quiet"><code>--quiet</code></a></dt>
<dd class="option-desc"><p>不要打印 cargo 日志消息。也可以通过 <code>term.quiet</code> <a href="../reference/config.html">配置值</a>来禁用此功能。</p>
</dd>


<dt class="option-term" id="option-cargo-clean---color"><a class="option-anchor" href="#option-cargo-clean---color"><code>--color</code> <em>when</em></a></dt>
<dd class="option-desc"><p>控制是否使用彩色输出。有效值包括： <ul> <li><code>auto</code>（默认）：自动检测终端是否支持颜色显示。</li> <li><code>always</code>：始终显示颜色。</li> <li><code>never</code>：从不显示颜色。</li> </ul> 也可以通过 <code>term.color</code> <a href="../reference/config.html">配置值</a>来指定此选项。</p>
</dd>

</dl>

### 清单选项

<dl>
<dt class="option-term" id="option-cargo-clean---manifest-path"><a class="option-anchor" href="#option-cargo-clean---manifest-path"><code>--manifest-path</code> <em>path</em></a></dt>
<dd class="option-desc"><p><code>Cargo.toml</code> 文件的路径。默认情况下，Cargo会在当前目录或任何父目录中查找 <code>Cargo.toml</code> 文件。</p>
</dd>


<dt class="option-term" id="option-cargo-clean---locked"><a class="option-anchor" href="#option-cargo-clean---locked"><code>--locked</code></a></dt>
<dd class="option-desc"><p>确保使用的依赖项和版本与生成现有 <code>Cargo.lock</code> 文件时相同。如果出现以下任一情况，Cargo将退出并抛出错误： <ul> <li>锁文件缺失。</li> <li>由于不同的依赖解析导致 Cargo 尝试修改锁文件。</li> </ul> 该选项适用于需要确定性构建的环境，例如 CI 流水线。</p>
</dd>


<dt class="option-term" id="option-cargo-clean---offline"><a class="option-anchor" href="#option-cargo-clean---offline"><code>--offline</code></a></dt>
<dd class="option-desc"><p>防止 Cargo 出于任何原因访问网络。如果没有此标志，如果 Cargo 需要访问网络而网络不可用时，它将抛出错误并停止。使用此标志后，Cargo 将尝试在可能的情况下不使用网络继续运行。</p> >请注意，这可能会导致与在线模式不同的依赖解析结果。即使本地索引中显示有更新版本，Cargo 也将限制自己仅使用本地下载的包。在离线操作前，请参阅 <a href="cargo-fetch.html">cargo-fetch(1)</a> 命令以下载依赖项。 >也可以通过 <code>net.offline</code> <a href="../reference/config.html">配置值</a>来指定此选项。
</dd>


<dt class="option-term" id="option-cargo-clean---frozen"><a class="option-anchor" href="#option-cargo-clean---frozen"><code>--frozen</code></a></dt>
<dd class="option-desc"><p>相当于同时指定 <code>--locked</code> 和 <code>--offline</code>。</p>
</dd>


</dl>

### 常见选项

<dl>

<dt class="option-term" id="option-cargo-clean-+toolchain"><a class="option-anchor" href="#option-cargo-clean-+toolchain"><code>+</code><em>toolchain</em></a></dt>
<dd class="option-desc"><p>如果已通过 rustup 安装 Cargo，且 <code>cargo</code> 的第一个参数以 <code>+</code> 开头，则会被解释为 rustup 工具链名称（如 <code>+stable</code> 或 <code>+nightly</code>）。 有关工具链覆盖机制更多信息，请参阅<a href="https://rust-lang.github.io/rustup/overrides.html">rustup 文档</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-clean---config"><a class="option-anchor" href="#option-cargo-clean---config"><code>--config</code> <em>KEY=VALUE</em> or <em>PATH</em></a></dt>
<dd class="option-desc"><p>用于覆盖 Cargo 配置值。参数应为 TOML 语法中的 <code>KEY=VALUE</code>，或作为额外配置文件的路径提供。此标志可以多次指定。 有关更多信息，请参阅<a href="../reference/config.html#command-line-overrides">命令行覆盖部分</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-clean--C"><a class="option-anchor" href="#option-cargo-clean--C"><code>-C</code> <em>PATH</em></a></dt>
<dd class="option-desc"><p>在执行任何指定操作之前更改当前工作目录。这会影响 cargo 默认查找项目清单 (<code>Cargo.toml</code>)的位置，以及搜索 <code>.cargo/config.toml</code> 的目录。此选项必须位于命令名之前，例如 <code>cargo -C path/to/my-project build</code>。 <p>此选项仅适用于 <a href="https://doc.rust-lang.org/book/appendix-07-nightly-rust.html">nightly 渠道</a>，并且需要使用 <code>-Z unstable-options</code> 标志来启用（参见<a href="https://github.com/rust-lang/cargo/issues/10098">#10098</a>）。</p></p></dd>


<dt class="option-term" id="option-cargo-clean--h"><a class="option-anchor" href="#option-cargo-clean--h"><code>-h</code></a></dt>
<dt class="option-term" id="option-cargo-clean---help"><a class="option-anchor" href="#option-cargo-clean---help"><code>--help</code></a></dt>
<dd class="option-desc"><p>打印帮助信息。</p>
</dd>


<dt class="option-term" id="option-cargo-clean--Z"><a class="option-anchor" href="#option-cargo-clean--Z"><code>-Z</code> <em>flag</em></a></dt>
<dd class="option-desc"><p>Cargo 的不稳定（仅 nightly 版本）标志。运行 <code>cargo -Z help</code> 以获取详细信息。</p>
</dd>


</dl>

## 环境

有关 Cargo 读取的环境变量详情，请参阅 [参考手册](../reference/environment-variables.html)。

## 退出状态

* `0`: Cargo 成功执行。
* `101`: Cargo 未能完成。

## 示例

1. 删除整个目标目录：

       cargo clean

2. 仅删除发布产物：

       cargo clean --release

## 另请参阅 [cargo(1)](cargo.html)、[cargo-build(1)](cargo-build.html)
