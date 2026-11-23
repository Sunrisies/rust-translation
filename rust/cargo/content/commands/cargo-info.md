# cargo-info(1)

## 名称

cargo-info --- 显示包的相关信息。

## 使用说明

`cargo info` [_options_] _spec_

## 描述

此命令用于显示包的相关信息。它从包的 Cargo.toml 文件中获取数据，并以人类可读的格式呈现。

## 选项

### Info 选项

<dl>

<dt class="option-term" id="option-cargo-info-spec"><a class="option-anchor" href="#option-cargo-info-spec"><em>spec</em></a></dt>
<dd class="option-desc"><p>获取指定包的信息。<em>spec</em> 可以是包 ID，有关 SPEC 格式，请参阅 <a href="cargo-pkgid.html">cargo-pkgid(1)</a>。 如果指定的包属于当前工作空间，则会显示来自本地 Cargo.toml 文件的信息。 如果 <code>Cargo.lock</code> 文件不存在，将创建该文件。如果没有指定版本，将根据最低支持的 Rust 版本 (MSRV) 选择适当的版本。</p>
</dd>

<dt class="option-term" id="option-cargo-info---index"><a class="option-anchor" href="#option-cargo-info---index"><code>--index</code> <em>index</em></a></dt>
<dd class="option-desc"><p>要使用的注册表索引的 URL。</p>
</dd>

<dt class="option-term" id="option-cargo-info---registry"><a class="option-anchor" href="#option-cargo-info---registry"><code>--registry</code> <em>registry</em></a></dt>
<dd class="option-desc"><p>要使用的注册表名称。注册表名称定义在 <a href="../reference/config.html">Cargo 配置文件</a>中。如果未指定，则使用默认注册表， 由 <code>registry.default</code> 配置键定义，默认为 <code>crates-io</code>。</p>
</dd>

</dl>

### 显示选项

<dl>
<dt class="option-term" id="option-cargo-info--v"><a class="option-anchor" href="#option-cargo-info--v"><code>-v</code></a></dt>
<dt class="option-term" id="option-cargo-info---verbose"><a class="option-anchor" href="#option-cargo-info---verbose"><code>--verbose</code></a></dt>
<dd class="option-desc"><p>启用详细输出。可以两次指定以获得“非常详细”的输出，包括依赖警告和构建脚本输出等额外内容。 也可以通过 <code>term.verbose</code> <a href="../reference/config.html">配置值</a>来指定。</p>
</dd>


<dt class="option-term" id="option-cargo-info--q"><a class="option-anchor" href="#option-cargo-info--q"><code>-q</code></a></dt>
<dt class="option-term" id="option-cargo-info---quiet"><a class="option-anchor" href="#option-cargo-info---quiet"><code>--quiet</code></a></dt>
<dd class="option-desc"><p>不打印 cargo 日志消息。 也可以通过 <code>term.quiet</code> <a href="../reference/config.html">配置值</a>来指定。</p>
</dd>


<dt class="option-term" id="option-cargo-info---color"><a class="option-anchor" href="#option-cargo-info---color"><code>--color</code> <em>when</em></a></dt>
<dd class="option-desc"><p>控制颜色输出的使用方式。有效值包括： <ul> <li><code>auto</code>（默认）：自动检测终端是否支持颜色。</li> <li><code>always</code>：始终显示颜色。</li> <li><code>never</code>：从不显示颜色。</li> </ul> 也可以通过 <code>term.color</code> <a href="../reference/config.html">配置值</a>来指定。</p>
</dd>

</dl>

### 清单 选项

<dl>
<dt class="option-term" id="option-cargo-info---locked"><a class="option-anchor" href="#option-cargo-info---locked"><code>--locked</code></a></dt>
<dd class="option-desc"><p>确保使用的依赖项和版本与原始生成 <code>Cargo.lock</code> 文件时完全相同。如果出现以下任一情况，Cargo 将退出并抛出错误： <ul> <li>锁文件缺失。</li> <li>由于不同的依赖解析导致 Cargo 尝试修改锁文件。</li> </ul> 该选项适用于需要确定性构建的环境，例如 CI 流水线中。</p>
</dd>


<dt class="option-term" id="option-cargo-info---offline"><a class="option-anchor" href="#option-cargo-info---offline"><code>--offline</code></a></dt>
<dd class="option-desc"><p>防止 Cargo 因任何原因访问网络。如果没有此标志，当 Cargo 需要访问网络且网络不可用时，它将出现错误并停止。使用此标志后，Cargo 将尽可能在无网络的情况下继续运行。</p> <p>请注意，这可能会导致与在线模式不同的依赖解析结果。即使本地索引副本中显示有更新版本，Cargo 也会限制自己仅使用本地下载的 Crates。在离线操作前，请查看 <a href="cargo-fetch.html">cargo-fetch(1)</a> 命令以下载依赖项。</p> <p>也可以通过 <code>net.offline</code> <a href="../reference/config.html">配置值</a>来指定此标志。</p>
</dd>


<dt class="option-term" id="option-cargo-info---frozen"><a class="option-anchor" href="#option-cargo-info---frozen"><code>--frozen</code></a></dt>
<dd class="option-desc"><p>相当于同时指定 <code>--locked</code> 和 <code>--offline</code>。</p>
</dd>

</dl>

### 常用选项

<dl>

<dt class="option-term" id="option-cargo-info-+toolchain"><a class="option-anchor" href="#option-cargo-info-+toolchain"><code>+</code><em>toolchain</em></a></dt>
<dd class="option-desc"><p>如果 Cargo 是通过 rustup 安装的，且 <code>cargo</code> 的第一个参数以 <code>+</code> 开头，则会被解释为 rustup 工具链名称（如 <code>+stable</code> 或 <code>+nightly</code>）。 有关工具链覆盖机制更多信息，请参阅 <a href="https://rust-lang.github.io/rustup/overrides.html">rustup 文档</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-info---config"><a class="option-anchor" href="#option-cargo-info---config"><code>--config</code> <em>KEY=VALUE</em> or <em>PATH</em></a></dt>
<dd class="option-desc"><p>覆盖 Cargo 配置值。参数应为 TOML 语法 <code>KEY=VALUE</code>，或作为额外配置文件的路径提供。此标志可以多次指定。 有关更多信息，请参阅 <a href="../reference/config.html#command-line-overrides">命令行覆盖部分</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-info--C"><a class="option-anchor" href="#option-cargo-info--C"><code>-C</code> <em>PATH</em></a></dt>
<dd class="option-desc"><p>此选项仅在 <a href="https://doc.rust-lang.org/book/appendix-07-nightly-rust.html">nightly 通道</a>上可用，并且需要使用 <code>-Z unstable-options</code> 标志来启用（参见 <a href="https://github.com/rust-lang/cargo/issues/10098">#10098</a>）。</p>
</dd>


<dt class="option-term" id="option-cargo-info--h"><a class="option-anchor" href="#option-cargo-info--h"><code>-h</code></a></dt>
<dt class="option-term" id="option-cargo-info---help"><a class="option-anchor" href="#option-cargo-info---help"><code>--help</code></a></dt>
<dd class="option-desc"><p>打印帮助信息。</p>
</dd>


<dt class="option-term" id="option-cargo-info--Z"><a class="option-anchor" href="#option-cargo-info--Z"><code>-Z</code> <em>flag</em></a></dt>
<dd class="option-desc"><p>针对 Cargo 的不稳定（仅夜间生效）标志。运行 <code>cargo -Z help</code> 以查看详情。</p>
</dd>


</dl>

## 环境

有关 Cargo 读取的环境变量详情，请参阅 [参考手册](../reference/environment-variables.html)。

## 退出状态

* `0`: Cargo 执行成功。
* `101`: Cargo 执行失败。

## 示例

1. 检查 crates.io 上的 `serde` 包：

        cargo info serde
2. 查看版本为 `1.0.0` 的 `serde` 包：

        cargo info serde@1.0.0
3. 从本地注册表检查 `serde` 包：

        cargo info serde --registry my-registry

## 相关链接

[cargo(1)](cargo.html), [cargo-search(1)](cargo-search.html)
