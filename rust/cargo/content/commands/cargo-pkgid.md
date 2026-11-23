# cargo-pkgid(1)

## 名称

cargo-pkgid --- 打印完全限定的包规范

## 概述

`cargo pkgid` [_options_] [_spec_]

## 描述

给定 _spec_ 参数，打印当前工作空间中的包或依赖项的完全限定包 ID 标识符。如果 _spec_ 在依赖图中指代哪个包存在歧义，则命令会生成错误。如果没有提供 _spec_，则打印本地包的标识符。

此命令要求存在锁文件且依赖项已下载。

包标识符由名称、版本和源 URL 组成。允许使用部分标识符来简洁地匹配特定包，只要它只匹配一个包即可。该标识符也被 Cargo 的其他部分使用，例如 [cargo-metadata(1)](cargo-metadata.html) 和 Cargo 发出的 [JSON 消息]。

_spec_ 的格式可以是以下之一：

规范结构 | 示例 SPEC
---------------------------|--------------
_name_ | `bitflags` _name_`@`_version_ | `bitflags@1.0.4` _url_ | `https://github.com/rust-lang/cargo` _url_`#`_version_ | `https://github.com/rust-lang/cargo#0.33.0` _url_`#`_name_ | `https://github.com/rust-lang/crates.io-index#bitflags` _url_`#`_name_`@`_version_ | `https://github.com/rust-lang/cargo#crates-io@0.21.0`

规范语法可在 [包 ID 规范] 章节中找到。

## 选项

### 包选择

<dl>

<dt class="option-term" id="option-cargo-pkgid--p"><a class="option-anchor" href="#option-cargo-pkgid--p"><code>-p</code> <em>spec</em></a></dt>
<dt class="option-term" id="option-cargo-pkgid---package"><a class="option-anchor" href="#option-cargo-pkgid---package"><code>--package</code> <em>spec</em></a></dt>
<dd class="option-desc"><p>获取指定包的包 ID，而非当前包的包 ID。</p>
</dd>


</dl>

### 显示选项

<dl>
<dt class="option-term" id="option-cargo-pkgid--v"><a class="option-anchor" href="#option-cargo-pkgid--v"><code>-v</code></a></dt>
<dt class="option-term" id="option-cargo-pkgid---verbose"><a class="option-anchor" href="#option-cargo-pkgid---verbose"><code>--verbose</code></a></dt>
<dd class="option-desc"><p>使用详细输出。可以两次指定以获得“非常详细”的输出，该输出包含额外的内容，如依赖警告和构建脚本输出。 也可以通过 <code>term.verbose</code> <a href="../reference/config.html">配置值</a> 来指定。</p>
</dd>


<dt class="option-term" id="option-cargo-pkgid--q"><a class="option-anchor" href="#option-cargo-pkgid--q"><code>-q</code></a></dt>
<dt class="option-term" id="option-cargo-pkgid---quiet"><a class="option-anchor" href="#option-cargo-pkgid---quiet"><code>--quiet</code></a></dt>
<dd class="option-desc"><p>不打印 cargo 日志消息。 也可以通过 <code>term.quiet</code> <a href="../reference/config.html">配置值</a> 来指定。</p>
</dd>


<dt class="option-term" id="option-cargo-pkgid---color"><a class="option-anchor" href="#option-cargo-pkgid---color"><code>--color</code> <em>when</em></a></dt>
<dd class="option-desc"><p>控制是否使用彩色输出。有效值包括： <ul> <li><code>auto</code>（默认）：自动检测终端是否支持颜色显示。</li> <li><code>always</code>：始终显示颜色。</li> <li><code>never</code>：从不显示颜色。</li> </ul> 也可以通过 <code>term.color</code> <a href="../reference/config.html">配置值</a> 来指定。</p>
</dd>

</dl>

### 清单选项

<dl>

<dt class="option-term" id="option-cargo-pkgid---manifest-path"><a class="option-anchor" href="#option-cargo-pkgid---manifest-path"><code>--manifest-path</code> <em>path</em></a></dt>
<dd class="option-desc"><p><code>Cargo.toml</code> 文件的路径。默认情况下，Cargo会在当前目录或任何父目录中查找 <code>Cargo.toml</code> 文件。</p>
</dd>


<dt class="option-term" id="option-cargo-pkgid---locked"><a class="option-anchor" href="#option-cargo-pkgid---locked"><code>--locked</code></a></dt>
<dd class="option-desc"><p>确保使用的依赖项和版本与原始生成 <code>Cargo.lock</code> 文件时完全相同。如果出现以下任一情况，Cargo将退出并抛出错误： <ul> <li>锁文件缺失。</li> <li>由于不同的依赖解析导致 Cargo 尝试修改锁文件。</li> </ul> 在需要确定性构建的环境中，例如 CI 流水线中，可以使用此选项。</p>
</dd>


<dt class="option-term" id="option-cargo-pkgid---offline"><a class="option-anchor" href="#option-cargo-pkgid---offline"><code>--offline</code></a></dt>
<dd class="option-desc"><p>防止 Cargo 因任何原因访问网络。如果没有此标志，当 Cargo 需要访问网络而网络不可用时，它将出现错误并停止。使用此标志后，Cargo 将尽可能在不连接网络的情况下继续运行。</p> <p>请注意，这可能会导致与在线模式不同的依赖解析结果。即使本地索引副本中显示有更新版本，Cargo 也会限制自己仅使用本地下载的库。在离线操作前，请查看 <a href="cargo-fetch.html">cargo-fetch(1)</a> 命令以下载依赖项。</p> <p>也可以通过 <code>net.offline</code> <a href="../reference/config.html">配置值</a>来指定此标志。</p>
</dd>


<dt class="option-term" id="option-cargo-pkgid---frozen"><a class="option-anchor" href="#option-cargo-pkgid---frozen"><code>--frozen</code></a></dt>
<dd class="option-desc"><p>相当于同时指定 <code>--locked</code> 和 <code>--offline</code>。</p>
</dd>



</dl>

### 常见选项

<dl>

<dt class="option-term" id="option-cargo-pkgid-+toolchain"><a class="option-anchor" href="#option-cargo-pkgid-+toolchain"><code>+</code><em>toolchain</em></a></dt>
<dd class="option-desc"><p>如果 Cargo 是通过 rustup 安装的，且 <code>cargo</code> 的第一个参数以 <code>+</code> 开头，则会被解释为 rustup 工具链名称（如 <code>+stable</code> 或 <code>+nightly</code>）。 有关工具链覆盖机制更多信息，请参阅 <a href="https://rust-lang.github.io/rustup/overrides.html">rustup 文档</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-pkgid---config"><a class="option-anchor" href="#option-cargo-pkgid---config"><code>--config</code> <em>KEY=VALUE</em> or <em>PATH</em></a></dt>
<dd class="option-desc"><p>覆盖 Cargo 配置值。参数应为 TOML 格式 <code>KEY=VALUE</code>，或作为额外配置文件的路径提供。此标志可以多次指定。 有关更多信息，请参阅 <a href="../reference/config.html#command-line-overrides">命令行覆盖部分</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-pkgid--C"><a class="option-anchor" href="#option-cargo-pkgid--C"><code>-C</code> <em>PATH</em></a></dt>
<dd class="option-desc"><p>此选项仅在 <a href="https://doc.rust-lang.org/book/appendix-07-nightly-rust.html">nightly 通道</a>上可用，并且需要 <code>-Z unstable-options</code> 标志才能启用（参见 <a href="https://github.com/rust-lang/cargo/issues/10098">#10098</a>）。</p>
</dd>


<dt class="option-term" id="option-cargo-pkgid--h"><a class="option-anchor" href="#option-cargo-pkgid--h"><code>-h</code></a></dt>
<dt class="option-term" id="option-cargo-pkgid---help"><a class="option-anchor" href="#option-cargo-pkgid---help"><code>--help</code></a></dt>
<dd class="option-desc"><p>打印帮助信息。</p>
</dd>


<dt class="option-term" id="option-cargo-pkgid--Z"><a class="option-anchor" href="#option-cargo-pkgid--Z"><code>-Z</code> <em>flag</em></a></dt>
<dd class="option-desc"><p>针对 Cargo 的不稳定（仅夜间生效）标志。运行 <code>cargo -Z help</code> 以查看详情。</p>
</dd>


</dl>

## 环境

有关 Cargo 读取的环境变量详情，请参阅 [参考手册](../reference/environment-variables.html)。

## 退出状态

* `0`: Cargo 成功执行。
* `101`: Cargo 未能完成。

## 示例

1. 获取 `foo` 包的包规范：

       cargo pkgid foo

2. 获取 `foo` 版本 1.0.0 的包规范：

       cargo pkgid foo@1.0.0

3. 从 crates.io 获取 `foo` 包的包规范：

       cargo pkgid https://github.com/rust-lang/crates.io-index#foo

4. 从本地包中获取 `foo` 的包规范：

       cargo pkgid file:///path/to/local/包#foo

## 另请参阅

[cargo(1)](cargo.html), [cargo-generate-锁文件(1)](cargo-generate-锁文件.html), [cargo-metadata(1)](cargo-metadata.html), [包 ID 规范], [JSON 消息]

[Package ID Specifications]: ../reference/pkgid-spec.html
[JSON messages]: ../reference/external-tools.html#json-messages
