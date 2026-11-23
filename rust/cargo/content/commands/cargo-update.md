# cargo-update(1)

## 名称

cargo-update --- 根据本地 lock 文件中的记录更新依赖项

## 功能说明

`cargo update` [_options_] _spec_

## 描述

此命令会将 `Cargo.lock` 文件中的依赖项更新为最新版本。如果 `Cargo.lock` 文件不存在，则会创建该文件并采用最新可用的版本。

## 选项

### 更新选项

<dl>

<dt class="option-term" id="option-cargo-update-spec…"><a class="option-anchor" href="#option-cargo-update-spec…"><em>spec</em>…</a></dt>
<dd class="option-desc"><p>仅更新指定的包。此标志可以多次指定。有关 SPEC 格式，请参阅 <a href="cargo-pkgid.html">cargo-pkgid(1)</a>。</p> <p>如果使用 <em>spec</em> 指定包，则会对锁定文件进行保守的更新。这意味着只有 SPEC 指定的依赖项会被更新，其传递依赖项只有在无法不更新依赖项就更新 SPEC 时才会被更新。所有其他依赖项将保持为当前记录的版本。</p> <p>如果未指定 <em>spec</em>，则所有依赖项都会被更新。</p>
</dd>


<dt class="option-term" id="option-cargo-update---recursive"><a class="option-anchor" href="#option-cargo-update---recursive"><code>--recursive</code></a></dt>
<dd class="option-desc"><p>与 <em>spec</em> 一起使用时，<em>spec</em> 的依赖项也被强制更新。不能与 <code>--precise</code> 一起使用。</p>
</dd>


<dt class="option-term" id="option-cargo-update---precise"><a class="option-anchor" href="#option-cargo-update---precise"><code>--precise</code> <em>precise</em></a></dt>
<dd class="option-desc"><p>与 <em>spec</em> 一起使用时，可以指定特定版本号来设置包的状态。如果包来自 git 仓库，则可以是 git 修订版（如 SHA 哈希或标签）。</p> <p>虽然不推荐，但可以指定包的已下载版本。在可能的情况下，尝试其他非已下载的 SemVer 兼容版本或向包维护者寻求帮助。</p>
</dd>


<dt class="option-term" id="option-cargo-update--w"><a class="option-anchor" href="#option-cargo-update--w"><code>-w</code></a></dt>
<dt class="option-term" id="option-cargo-update---workspace"><a class="option-anchor" href="#option-cargo-update---workspace"><code>--workspace</code></a></dt>
<dd class="option-desc"><p>尝试仅更新工作区中定义的包。其他包只有在锁定文件中不存在时才会被更新。此选项适用于在修改 <code>Cargo.toml</code>中的版本号后更新 <code>Cargo.lock</code>。</p>
</dd>


<dt class="option-term" id="option-cargo-update---dry-run"><a class="option-anchor" href="#option-cargo-update---dry-run"><code>--dry-run</code></a></dt>
<dd class="option-desc"><p>显示将要更新的内容，但实际上不会写入锁定文件。</p>
</dd>


</dl>

### 显示选项

<dl>
<dt class="option-term" id="option-cargo-update--v"><a class="option-anchor" href="#option-cargo-update--v"><code>-v</code></a></dt>
<dt class="option-term" id="option-cargo-update---verbose"><a class="option-anchor" href="#option-cargo-update---verbose"><code>--verbose</code></a></dt>
<dd class="option-desc"><p>使用详细输出。可以指定两次以获得“非常详细”的输出，包括额外的输出如依赖项警告和构建脚本输出。也可以通过 <code>term.verbose</code> <a href="../reference/config.html">配置值</a>来指定。</p>
</dd>


<dt class="option-term" id="option-cargo-update--q"><a class="option-anchor" href="#option-cargo-update--q"><code>-q</code></a></dt>
<dt class="option-term" id="option-cargo-update---quiet"><a class="option-anchor" href="#option-cargo-update---quiet"><code>--quiet</code></a></dt>
<dd class="option-desc"><p>不打印 cargo 日志消息。也可以通过 <code>term.quiet</code> <a href="../reference/config.html">配置值</a>来指定。</p>
</dd>


<dt class="option-term" id="option-cargo-update---color"><a class="option-anchor" href="#option-cargo-update---color"><code>--color</code> <em>when</em></a></dt>
<dd class="option-desc"><p>控制使用彩色输出的行为。有效值：</p> <ul> <li><code>auto</code> (默认): 自动检测终端是否支持颜色。</li> <li><code>always</code>: 始终显示颜色。</li> <li><code>never</code>: 从不显示颜色。</li> </ul> <p>也可以通过 <code>term.color</code> <a href="../reference/config.html">配置值</a>来指定。</p>
</dd>

</dl>

### 清单选项

<dl>

<dt class="option-term" id="option-cargo-update---manifest-path"><a class="option-anchor" href="#option-cargo-update---manifest-path"><code>--manifest-path</code> <em>path</em></a></dt>
<dd class="option-desc"><p><code>Cargo.toml</code> 文件的路径。默认情况下，Cargo会在当前目录或任何父目录中查找 <code>Cargo.toml</code> 文件。</p>
</dd>


<dt class="option-term" id="option-cargo-update---ignore-rust-version"><a class="option-anchor" href="#option-cargo-update---ignore-rust-version"><code>--ignore-rust-version</code></a></dt>
<dd class="option-desc"><p>忽略包中的 <code>rust-version</code> 规范。</p>
</dd>


<dt class="option-term" id="option-cargo-update---locked"><a class="option-anchor" href="#option-cargo-update---locked"><code>--locked</code></a></dt>
<dd class="option-desc"><p>确保使用的依赖项和版本与原始生成 <code>Cargo.lock</code> 文件时完全相同。如果出现以下任一情况，Cargo将以错误退出： <ul> <li>锁定文件缺失。</li> <li>由于不同的依赖解析导致 Cargo 尝试修改锁定文件。</li> </ul> <p>在需要确定性构建的环境中，例如 CI 流水线中，可以使用此选项。</p></p></dd>


<dt class="option-term" id="option-cargo-update---offline"><a class="option-anchor" href="#option-cargo-update---offline"><code>--offline</code></a></dt>
<dd class="option-desc"><p>防止 Cargo 出于任何原因访问网络。如果没有此标志，如果 Cargo 需要访问网络而网络不可用时，它将以错误退出。使用此标志后，Cargo 将尽可能在不联网的情况下继续运行。</p> <p>请注意，这可能会导致与在线模式不同的依赖解析。即使本地索引副本中显示有更新版本，Cargo 也将限制自己仅使用本地下载的库。在离线前，请参阅 <a href="cargo-fetch.html">cargo-fetch(1)</a> 命令来下载依赖项。</p>
</dd>


<dt class="option-term" id="option-cargo-update---frozen"><a class="option-anchor" href="#option-cargo-update---frozen"><code>--frozen</code></a></dt>
<dd class="option-desc"><p>相当于同时指定 <code>--locked</code> 和 <code>--offline</code>。</p>
</dd>



</dl>

### 常用选项

<dl>

<dt class="option-term" id="option-cargo-update-+toolchain"><a class="option-anchor" href="#option-cargo-update-+toolchain"><code>+</code><em>toolchain</em></a></dt>
<dd class="option-desc"><p>如果已通过 rustup 安装 Cargo，且 <code>cargo</code> 的第一个参数以 <code>+</code> 开头，则会被解释为 rustup 工具链名称（如 <code>+stable</code> 或 <code>+nightly</code>）。 有关工具链覆盖机制更多信息，请参阅 <a href="https://rust-lang.github.io/rustup/overrides.html">rustup 文档</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-update---config"><a class="option-anchor" href="#option-cargo-update---config"><code>--config</code> <em>KEY=VALUE</em> or <em>PATH</em></a></dt>
<dd class="option-desc"><p>用于覆盖 Cargo 配置值。参数应为 TOML 格式 <code>KEY=VALUE</code>，或作为额外配置文件的路径提供。此标志可以多次指定。 有关更多信息，请参阅 <a href="../reference/config.html#command-line-overrides">命令行覆盖部分</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-update--C"><a class="option-anchor" href="#option-cargo-update--C"><code>-C</code> <em>PATH</em></a></dt>
<dd class="option-desc"><p>在执行任何指定操作之前更改当前工作目录。这会影响 cargo 默认查找项目清单 (<code>Cargo.toml</code>)的位置，以及搜索 <code>.cargo/config.toml</code> 等目录的方式。此选项必须出现在命令名称之前，例如 <code>cargo -C path/to/my-project build</code>。 <p>此选项仅适用于 <a href="https://doc.rust-lang.org/book/appendix-07-nightly-rust.html">nightly 版本</a>，并且需要使用 <code>-Z unstable-options</code> 标志来启用（参见 <a href="https://github.com/rust-lang/cargo/issues/10098">#10098</a>）。</p></p></dd>


<dt class="option-term" id="option-cargo-update--h"><a class="option-anchor" href="#option-cargo-update--h"><code>-h</code></a></dt>
<dt class="option-term" id="option-cargo-update---help"><a class="option-anchor" href="#option-cargo-update---help"><code>--help</code></a></dt>
<dd class="option-desc"><p>打印帮助信息。</p>
</dd>


<dt class="option-term" id="option-cargo-update--Z"><a class="option-anchor" href="#option-cargo-update--Z"><code>-Z</code> <em>flag</em></a></dt>
<dd class="option-desc"><p>Cargo 的不稳定（仅 nightly 版本）标志。运行 <code>cargo -Z help</code> 以获取详细信息。</p>
</dd>


</dl>

## 环境

有关 Cargo 读取的环境变量详情，请参阅 [参考手册](../reference/environment-variables.html)。

## 退出状态

* `0`: Cargo 执行成功。
* `101`: Cargo 执行失败。

## 示例

1. 更新 lock 文件中的所有依赖项：

       cargo update

2. 仅更新特定依赖项：

       cargo update foo bar

3. 将特定依赖项设置为特定版本：

       cargo update foo --precise 1.2.3

## 另请参阅 [cargo(1)](cargo.html)、[cargo-generate-锁文件(1)](cargo-generate-锁文件.html)
