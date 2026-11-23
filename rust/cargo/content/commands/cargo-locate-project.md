# cargo-locate-project(1)

## 名称

cargo-locate-project --- 打印 Cargo.toml 文件位置的 JSON 表示形式

## 概述

`cargo locate-project` [_选项_]

## 描述

此命令会将 清单 的完整路径输出到标准输出中。该 清单 从当前工作目录开始，向上搜索名为 `Cargo.toml` 的文件找到。

如果项目是工作空间的一部分，则输出项目的 清单，而不是工作空间根目录的 清单。可以通过 `--workspace` 标志来覆盖此行为。通过继续向上遍历或使用工作空间成员的 清单 后的字段 `package.workspace`，可以找到工作空间根目录。

## 选项

<dl>

<dt class="option-term" id="option-cargo-locate-project---workspace"><a class="option-anchor" href="#option-cargo-locate-project---workspace"><code>--workspace</code></a></dt>
<dd class="option-desc"><p>在工作空间的根目录中找到 <code>Cargo.toml</code>，而不是当前工作空间成员中的文件。</p>
</dd>


</dl>

### 显示选项

<dl>

<dt class="option-term" id="option-cargo-locate-project---message-format"><a class="option-anchor" href="#option-cargo-locate-project---message-format"><code>--message-format</code> <em>fmt</em></a></dt>
<dd class="option-desc"><p>用于显示项目位置的格式。有效值：</p> <ul> <li><code>json</code>（默认）：以 JSON 对象形式呈现，路径位于“root”键下。</li> <li><code>plain</code>：仅显示路径。</li> </ul> </dd> <dt class="option-term" id="option-cargo-locate-project--v"><a class="option-anchor" href="#option-cargo-locate-project--v"><code>-v</code></a></dt> <dt class="option-term" id="option-cargo-locate-project---verbose"><a class="option-anchor" href="#option-cargo-locate-project---verbose"><code>--verbose</code></a></dt> <dd class="option-desc"><p>使用详细输出。可以指定两次以获得“非常详细”的输出，包含依赖警告和构建脚本输出等额外内容。 也可以通过 <code>term.verbose</code> <a href="../reference/config.html">配置值</a>来指定。</p>
</dd>


<dt class="option-term" id="option-cargo-locate-project--q"><a class="option-anchor" href="#option-cargo-locate-project--q"><code>-q</code></a></dt>
<dt class="option-term" id="option-cargo-locate-project---quiet"><a class="option-anchor" href="#option-cargo-locate-project---quiet"><code>--quiet</code></a></dt>
<dd class="option-desc"><p>不打印 cargo 日志消息。 也可以通过 <code>term.quiet</code> <a href="../reference/config.html">配置值</a>来指定。</p>
</dd>


<dt class="option-term" id="option-cargo-locate-project---color"><a class="option-anchor" href="#option-cargo-locate-project---color"><code>--color</code> <em>when</em></a></dt>
<dd class="option-desc"><p>控制是否使用彩色输出。有效值：</p> <ul> <li><code>auto</code>（默认）：自动检测终端是否支持颜色显示。</li> <li><code>always</code>：始终显示颜色。</li> <li><code>never</code>：从不显示颜色。</li> </ul> <p>也可以通过 <code>term.color</code> <a href="../reference/config.html">配置值</a>来指定。</p>
</dd>

</dl>

### 清单 选项

<dl>
<dt class="option-term" id="option-cargo-locate-project---manifest-path"><a class="option-anchor" href="#option-cargo-locate-project---manifest-path"><code>--manifest-path</code> <em>path</em></a></dt>
<dd class="option-desc"><p><code>Cargo.toml</code> 文件的路径。默认情况下，Cargo 会在当前目录或任何父目录中查找 <code>Cargo.toml</code> 文件。</p>
</dd>

</dl>

### 常见选项

<dl>

<dt class="option-term" id="option-cargo-locate-project-+toolchain"><a class="option-anchor" href="#option-cargo-locate-project-+toolchain"><code>+</code><em>toolchain</em></a></dt>
<dd class="option-desc"><p>如果 Cargo 通过 rustup 安装，且 <code>cargo</code> 的第一个参数以 <code>+</code> 开头，则会被解释为 rustup 工具链名称（如 <code>+stable</code> 或 <code>+nightly</code>）。 有关工具链覆盖机制更多信息，请参阅 <a href="https://rust-lang.github.io/rustup/overrides.html">rustup 文档</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-locate-project---config"><a class="option-anchor" href="#option-cargo-locate-project---config"><code>--config</code> <em>KEY=VALUE</em> or <em>PATH</em></a></dt>
<dd class="option-desc"><p>覆盖 Cargo 配置值。参数应为 TOML 格式 <code>KEY=VALUE</code>，或作为额外配置文件的路径提供。此标志可以多次指定。 更多详情请参阅<a href="../reference/config.html#command-line-overrides">命令行覆盖部分</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-locate-project--C"><a class="option-anchor" href="#option-cargo-locate-project--C"><code>-C</code> <em>PATH</em></a></dt>
<dd class="option-desc"><p>在执行任何指定操作之前，更改当前工作目录。这会影响 cargo 默认查找项目清单 (<code>Cargo.toml</code>)的位置，以及搜索 <code>.cargo/config.toml</code> 的目录。此选项必须位于命令名称之前，例如 <code>cargo -C path/to/my-project build</code>。</p> <p>此选项仅适用于 <a href="https://doc.rust-lang.org/book/appendix-07-nightly-rust.html">nightly 版本</a>，并且需要使用 <code>-Z unstable-options</code> 标志来启用（参见 <a href="https://github.com/rust-lang/cargo/issues/10098">#10098</a>）。</p>
</dd>


<dt class="option-term" id="option-cargo-locate-project--h"><a class="option-anchor" href="#option-cargo-locate-project--h"><code>-h</code></a></dt>
<dt class="option-term" id="option-cargo-locate-project---help"><a class="option-anchor" href="#option-cargo-locate-project---help"><code>--help</code></a></dt>
<dd class="option-desc"><p>打印帮助信息。</p>
</dd>


<dt class="option-term" id="option-cargo-locate-project--Z"><a class="option-anchor" href="#option-cargo-locate-project--Z"><code>-Z</code> <em>flag</em></a></dt>
<dd class="option-desc"><p>Cargo 的不稳定（仅 nightly 版本）标志。运行 <code>cargo -Z help</code> 获取详细信息。</p>
</dd>


</dl>

## 环境

有关 Cargo 读取的环境变量详情，请参阅 [参考手册](../reference/environment-variables.html)。

## 退出状态

* `0`: Cargo 成功执行。
* `101`: Cargo 未能完成。

## 示例

1. 根据当前目录显示 清单 的路径：

       cargo locate-project

## 参见 [cargo(1)](cargo.html)、[cargo-metadata(1)](cargo-metadata.html)
