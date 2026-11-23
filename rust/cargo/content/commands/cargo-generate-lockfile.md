# cargo-generate-锁文件(1)

## 名称

cargo-generate-锁文件 --- 为包生成 锁文件

## 概述

`cargo generate-lockfile` [_选项_]

## 描述

此命令将为当前包或工作空间创建 `Cargo.lock` 锁文件。如果 锁文件 已存在，则使用所有包的最新版本重新生成。

另请参阅 [cargo-update(1)](cargo-update.html)，它同样能够创建 `Cargo.lock` 锁文件，并且提供更多控制更新行为的选项。

## 选项

### 显示选项

<dl>
<dt class="option-term" id="option-cargo-generate-lockfile--v"><a class="option-anchor" href="#option-cargo-generate-lockfile--v"><code>-v</code></a></dt>
<dt class="option-term" id="option-cargo-generate-lockfile---verbose"><a class="option-anchor" href="#option-cargo-generate-lockfile---verbose"><code>--verbose</code></a></dt>
<dd class="option-desc"><p>使用详细输出。对于“非常详细”的输出，可以指定两次，包括额外的输出内容，如依赖警告和构建脚本输出。也可以通过 <code>term.verbose</code> 和 <a href="../reference/config.html">配置值</a>来指定。</p>
</dd>


<dt class="option-term" id="option-cargo-generate-lockfile--q"><a class="option-anchor" href="#option-cargo-generate-lockfile--q"><code>-q</code></a></dt>
<dt class="option-term" id="option-cargo-generate-lockfile---quiet"><a class="option-anchor" href="#option-cargo-generate-lockfile---quiet"><code>--quiet</code></a></dt>
<dd class="option-desc"><p>不要打印 cargo 日志消息。也可以通过 <code>term.quiet</code> 和 <a href="../reference/config.html">配置值</a>来指定。</p>
</dd>


<dt class="option-term" id="option-cargo-generate-lockfile---color"><a class="option-anchor" href="#option-cargo-generate-lockfile---color"><code>--color</code> <em>when</em></a></dt>
<dd class="option-desc"><p>控制是否使用彩色输出。有效值包括： <ul> <li><code>auto</code>（默认）：自动检测终端是否支持颜色显示。</li> <li><code>always</code>：始终显示颜色。</li> <li><code>never</code>：从不显示颜色。</li> </ul> 也可以通过 <code>term.color</code> 和 <a href="../reference/config.html">配置值</a>来指定。</p>
</dd>

</dl>

### 清单选项

<dl>
<dt class="option-term" id="option-cargo-generate-lockfile---manifest-path"><a class="option-anchor" href="#option-cargo-generate-lockfile---manifest-path"><code>--manifest-path</code> <em>path</em></a></dt>
<dd class="option-desc"><p><code>Cargo.toml</code> 文件的路径。默认情况下，Cargo会在当前目录或任何父目录中查找 <code>Cargo.toml</code> 文件。</p>
</dd>


<dt class="option-term" id="option-cargo-generate-lockfile---ignore-rust-version"><a class="option-anchor" href="#option-cargo-generate-lockfile---ignore-rust-version"><code>--ignore-rust-version</code></a></dt>
<dd class="option-desc"><p>忽略包中的 <code>rust-version</code> 规范。</p>
</dd>


<dt class="option-term" id="option-cargo-generate-lockfile---publish-time"><a class="option-anchor" href="#option-cargo-generate-lockfile---publish-time"><code>--publish-time</code> <em>yyyy-mm-ddThh:mm:ssZ</em></a></dt>
<dd class="option-desc"><p>注册表包允许的最晚发布时间（Unstable）。这是一个对允许包的最佳努力过滤器，包括： <ul> <li>来自不受支持注册表的包始终被接受。</li> <li>仅遵循当前的 yank 状态，而不是 <code>--publish-time</code> 时的状态。</li> <li>发布时间的精确度。</li> </ul> <dt class="option-term" id="option-cargo-generate-lockfile---locked"><a class="option-anchor" href="#option-cargo-generate-lockfile---locked"><code>--locked</code></a></dt> <dd class="option-desc"><p>确保使用的依赖项和版本与原始生成 <code>Cargo.lock</code> 文件时完全相同。如果出现以下情况，Cargo将退出并抛出错误： <ul> <li>锁文件缺失。</li> <li>由于不同的依赖解析导致 Cargo 尝试修改锁文件。</li> </ul> 该选项适用于需要确定性构建的环境，例如 CI 管道中。</p></p>
</dd>


<dt class="option-term" id="option-cargo-generate-lockfile---offline"><a class="option-anchor" href="#option-cargo-generate-lockfile---offline"><code>--offline</code></a></dt>
<dd class="option-desc"><p>防止 Cargo 因任何原因访问网络。如果没有此标志，当 Cargo 需要访问网络而网络不可用时，它将出现错误并停止。使用此标志后，Cargo 将尽可能在不连接网络的情况下继续运行。</p> <p>请注意，这可能会导致与在线模式不同的依赖解析结果。即使本地索引副本中显示有更新版本，Cargo 也会限制自己仅使用本地下载的库。在离线操作前，请查看 <a href="cargo-fetch.html">cargo-fetch(1)</a> 命令以下载依赖项。</p> <p>也可以通过 <code>net.offline</code> <a href="../reference/config.html">配置值</a>来指定此标志。</p>
</dd>


<dt class="option-term" id="option-cargo-generate-lockfile---frozen"><a class="option-anchor" href="#option-cargo-generate-lockfile---frozen"><code>--frozen</code></a></dt>
<dd class="option-desc"><p>相当于同时指定 <code>--locked</code> 和 <code>--offline</code>。</p>
</dd>


</dl>

### 常见选项

<dl>

<dt class="option-term" id="option-cargo-generate-lockfile-+toolchain"><a class="option-anchor" href="#option-cargo-generate-lockfile-+toolchain"><code>+</code><em>toolchain</em></a></dt>
<dd class="option-desc"><p>如果 Cargo 是通过 rustup 安装的，且 <code>cargo</code> 的第一个参数以 <code>+</code> 开头，则会被解释为 rustup 工具链名称（如 <code>+stable</code> 或 <code>+nightly</code>）。 有关工具链覆盖机制更多信息，请参阅 <a href="https://rust-lang.github.io/rustup/overrides.html">rustup 文档</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-generate-lockfile---config"><a class="option-anchor" href="#option-cargo-generate-lockfile---config"><code>--config</code> <em>KEY=VALUE</em> or <em>PATH</em></a></dt>
<dd class="option-desc"><p>覆盖 Cargo 配置值。参数应为 TOML 语法 <code>KEY=VALUE</code>，或作为额外配置文件的路径提供。此标志可以多次指定。 有关更多信息，请参阅 <a href="../reference/config.html#command-line-overrides">命令行覆盖部分</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-generate-lockfile--C"><a class="option-anchor" href="#option-cargo-generate-lockfile--C"><code>-C</code> <em>PATH</em></a></dt>
<dd class="option-desc"><p>此选项仅在 <a href="https://doc.rust-lang.org/book/appendix-07-nightly-rust.html">nightly 通道</a>上可用，并且需要 <code>-Z unstable-options</code> 标志才能启用（参见 <a href="https://github.com/rust-lang/cargo/issues/10098">#10098</a>）。</p>
</dd>


<dt class="option-term" id="option-cargo-generate-lockfile--h"><a class="option-anchor" href="#option-cargo-generate-lockfile--h"><code>-h</code></a></dt>
<dt class="option-term" id="option-cargo-generate-lockfile---help"><a class="option-anchor" href="#option-cargo-generate-lockfile---help"><code>--help</code></a></dt>
<dd class="option-desc"><p>打印帮助信息。</p>
</dd>


<dt class="option-term" id="option-cargo-generate-lockfile--Z"><a class="option-anchor" href="#option-cargo-generate-lockfile--Z"><code>-Z</code> <em>flag</em></a></dt>
<dd class="option-desc"><p>针对 Cargo 的不稳定（仅夜间生效）标志。运行 <code>cargo -Z help</code> 以查看详情。</p>
</dd>


</dl>

## 环境

有关 Cargo 读取的环境变量详情，请参阅 [参考手册](../reference/environment-variables.html)。

## 退出状态

* `0`: Cargo 成功执行。
* `101`: Cargo 未能完成。

## 示例

1. 为当前包或工作空间创建或更新 锁文件：

       cargo generate-锁文件

## 另请参阅 [cargo(1)](cargo.html)、[cargo-update(1)](cargo-update.html)
