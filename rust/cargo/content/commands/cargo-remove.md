# cargo-remove(1)
## 名称

cargo-remove —— 从 Cargo.toml 清单文件中移除依赖项

## 概述

`cargo remove` [_选项_] _依赖项_...

## 描述

从 `Cargo.toml` 清单中移除一个或多个依赖项。

## 选项

### 部分选项

<dl>

<dt class="option-term" id="option-cargo-remove---dev"><a class="option-anchor" href="#option-cargo-remove---dev"><code>--dev</code></a></dt>
<dd class="option-desc"><p>作为 <a href="../reference/specifying-dependencies.html#development-dependencies">开发依赖项</a>被移除。</p>
</dd>


<dt class="option-term" id="option-cargo-remove---build"><a class="option-anchor" href="#option-cargo-remove---build"><code>--build</code></a></dt>
<dd class="option-desc"><p>作为 <a href="../reference/specifying-dependencies.html#build-dependencies">构建依赖项</a>被移除。</p>
</dd>


<dt class="option-term" id="option-cargo-remove---target"><a class="option-anchor" href="#option-cargo-remove---target"><code>--target</code> <em>target</em></a></dt>
<dd class="option-desc"><p>作为对 <a href../reference/specifying-dependencies.html#platform-specific-dependencies">特定目标平台</a>的依赖项被移除。</p> <p>为了避免意外的 shell 展开问题，您可以在每个目标名称前加上引号，例如：<code>--target 'cfg(unix)'</code>。</p>
</dd>


</dl>

### 其他选项

<dl>

<dt class="option-term" id="option-cargo-remove---dry-run"><a class="option-anchor" href="#option-cargo-remove---dry-run"><code>--dry-run</code></a></dt>
<dd class="option-desc"><p>实际上不要将内容写入清单文件。</p>
</dd>


</dl>

### 显示选项

<dl>
<dt class="option-term" id="option-cargo-remove--v"><a class="option-anchor" href="#option-cargo-remove--v"><code>-v</code></a></dt>
<dt class="option-term" id="option-cargo-remove---verbose"><a class="option-anchor" href="#option-cargo-remove---verbose"><code>--verbose</code></a></dt>
<dd class="option-desc"><p>使用详细输出。对于“非常详细”的输出，可以指定两次，该输出包含额外的内容，如依赖项警告和构建脚本输出。也可以通过 <code>term.verbose</code> <a href../reference/config.html">配置值</a>来指定。</p>
</dd>


<dt class="option-term" id="option-cargo-remove--q"><a class="option-anchor" href="#option-cargo-remove--q"><code>-q</code></a></dt>
<dt class="option-term" id="option-cargo-remove---quiet"><a class="option-anchor" href="#option-cargo-remove---quiet"><code>--quiet</code></a></dt>
<dd class="option-desc"><p>不要打印 cargo 日志消息。也可以通过 <code>term.quiet</code> <a href../reference/config.html">配置值</a>来指定。</p>
</dd>


<dt class="option-term" id="option-cargo-remove---color"><a class="option-anchor" href="#option-cargo-remove---color"><code>--color</code> <em>when</em></a></dt>
<dd class="option-desc"><p>控制彩色输出的使用情况。有效值包括：</p> <ul> <li><code>auto</code>（默认）：自动检测终端是否支持颜色显示。</li> <li><code>always</code>：始终显示颜色。</li> <li><code>never</code>：从不显示颜色。</li> </ul> <p>也可以通过 <code>term.color</code> <a href../reference/config.html">配置值</a>来指定。</p>
</dd>

</dl>

### 清单选项

<dl>
<dt class="option-term" id="option-cargo-remove---manifest-path"><a class="option-anchor" href="#option-cargo-remove---manifest-path"><code>--manifest-path</code> <em>path</em></a></dt>
<dd class="option-desc"><p><code>Cargo.toml</code> 文件的路径。默认情况下，Cargo会在当前目录或任何父目录中查找 <code>Cargo.toml</code> 文件。</p>
</dd>


<dt class="option-term" id="option-cargo-remove---locked"><a class="option-anchor" href="#option-cargo-remove---locked"><code>--locked</code></a></dt>
<dd class="option-desc"><p>确保使用的依赖项和版本与原始生成 <code>Cargo.lock</code> 文件时完全相同。如果出现以下任一情况，Cargo将退出并抛出错误： <ul> <li>锁文件缺失。</li> <li>由于不同的依赖解析方式导致 Cargo 尝试修改锁文件。</li> </ul> <p>在需要确定性构建的环境中，例如 CI 管道中，可以使用此选项。</p></p>
</dd>


<dt class="option-term" id="option-cargo-remove---offline"><a class="option-anchor" href="#option-cargo-remove---offline"><code>--offline</code></a></dt>
<dd class="option-desc"><p>防止 Cargo 因任何原因访问网络。如果没有此标志，当 Cargo 需要访问网络但网络不可用时，它将出现错误并停止。使用此标志后，Cargo 将尽可能在无网络的情况下继续运行。</p> <p>请注意，这可能会导致与在线模式不同的依赖解析结果。即使本地索引副本中显示有更新版本，Cargo 也会限制自己仅使用本地下载的包。在离线操作前，请查看 <a href="cargo-fetch.html">cargo-fetch(1)</a> 命令以下载依赖项。</p> <p>也可以通过 <code>net.offline</code> <a href="../reference/config.html">配置值</a>来指定此标志。</p>
</dd>


<dt class="option-term" id="option-cargo-remove---frozen"><a class="option-anchor" href="#option-cargo-remove---frozen"><code>--frozen</code></a></dt>
<dd class="option-desc"><p>相当于同时指定 <code>--locked</code> 和 <code>--offline</code>。</p>
</dd>


</dl>

### 包选择

<dl>

<dt class="option-term" id="option-cargo-remove--p"><a class="option-anchor" href="#option-cargo-remove--p"><code>-p</code> <em>spec</em>…</a></dt>
<dt class="option-term" id="option-cargo-remove---package"><a class="option-anchor" href="#option-cargo-remove---package"><code>--package</code> <em>spec</em>…</a></dt>
<dd class="option-desc"><p>要从其中移除的包。</p>
</dd>


</dl>

### 常见选项

<dl>

<dt class="option-term" id="option-cargo-remove-+toolchain"><a class="option-anchor" href="#option-cargo-remove-+toolchain"><code>+</code><em>toolchain</em></a></dt>
<dd class="option-desc"><p>如果 Cargo 是通过 rustup 安装的，且 <code>cargo</code> 的第一个参数以 <code>+</code> 开头，则会被解释为 rustup 工具链名称（如 <code>+stable</code> 或 <code>+nightly</code>）。 有关工具链覆盖机制的更多信息，请参阅 <a href="https://rust-lang.github.io/rustup/overrides.html">rustup 文档</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-remove---config"><a class="option-anchor" href="#option-cargo-remove---config"><code>--config</code> <em>KEY=VALUE</em> or <em>PATH</em></a></dt>
<dd class="option-desc"><p>用于覆盖 Cargo 配置值。参数应为 TOML 格式 <code>KEY=VALUE</code>，或作为额外配置文件的路径提供。此标志可以多次指定。有关更多信息，请参阅 <a href="../reference/config.html#command-line-overrides">命令行覆盖部分</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-remove--C"><a class="option-anchor" href="#option-cargo-remove--C"><code>-C</code> <em>PATH</em></a></dt>
<dd class="option-desc"><p>在执行任何指定操作之前，该选项会更改当前工作目录。这会影响诸如 cargo 默认查找项目清单 (<code>Cargo.toml</code>)的位置，以及用于发现 <code>.cargo/config.toml</code> 的搜索目录等设置。此选项必须出现在命令名称之前，例如 <code>cargo -C path/to/my-project build</code>。</p> <p>此选项仅适用于 <a href="https://doc.rust-lang.org/book/appendix-07-nightly-rust.html">nightly 版本</a>，并且需要使用 <code>-Z unstable-options</code> 标志才能启用（参见 <a href="https://github.com/rust-lang/cargo/issues/10098">#10098</a>）。</p>
</dd>


<dt class="option-term" id="option-cargo-remove--h"><a class="option-anchor" href="#option-cargo-remove--h"><code>-h</code></a></dt>
<dt class="option-term" id="option-cargo-remove---help"><a class="option-anchor" href="#option-cargo-remove---help"><code>--help</code></a></dt>
<dd class="option-desc"><p>该选项会打印帮助信息。</p>
</dd>


<dt class="option-term" id="option-cargo-remove--Z"><a class="option-anchor" href="#option-cargo-remove--Z"><code>-Z</code> <em>flag</em></a></dt>
<dd class="option-desc"><p>这是 Cargo 的不稳定（仅 nightly 版本）标志。如需详细信息，请运行 <code>cargo -Z help</code>。</p>
</dd>


</dl>

## 环境

有关 Cargo 读取的环境变量详情，请参阅 [参考手册](../reference/environment-variables.html)。

## 退出状态

* `0`: Cargo 执行成功。
* `101`: Cargo 执行失败。

## 示例

1. 移除 `regex` 作为依赖项

       cargo remove regex

2. 移除 `trybuild` 作为开发依赖项

       cargo remove --dev trybuild

3. 从 `wasm32-unknown-unknown` 依赖项表中移除 `nom`

       cargo remove --目标 wasm32-unknown-unknown nom

## 另请参阅 [cargo(1)](cargo.html)、[cargo-add(1)](cargo-add.html)
