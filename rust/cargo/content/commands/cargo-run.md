# cargo-run(1)
## 名称

cargo-run --- 运行当前包

## 概述

`cargo run` [_选项_] [`--` _参数_]

## 描述

运行本地包的二进制文件或示例程序。

两个连字符 (`--`) 之后的所有参数都传递给要运行的二进制文件。如果您同时向 Cargo 和二进制文件传递参数， `--` 之后的参数将传递给二进制文件，之前的参数将传递给 Cargo。

与 [cargo-test(1)](cargo-test.html) 和 [cargo-bench(1)](cargo-bench.html) 不同，`cargo run` 将执行二进制文件的工作目录设置为当前工作目录，就像直接在 shell 中运行一样。

## 选项

### 包选择

默认情况下，会选择当前工作目录中的包。可以使用 `-p` 标志在工作空间中选择不同的包。

<dl>

<dt class="option-term" id="option-cargo-run--p"><a class="option-anchor" href="#option-cargo-run--p"><code>-p</code> <em>spec</em></a></dt>
<dt class="option-term" id="option-cargo-run---package"><a class="option-anchor" href="#option-cargo-run---package"><code>--package</code> <em>spec</em></a></dt>
<dd class="option-desc"><p>要运行的包。有关 SPEC 格式，请参阅 <a href="cargo-pkgid.html">cargo-pkgid(1)</a>。</p>
</dd>


</dl>

### 目标选择

如果没有指定目标选择选项，`cargo run` 将运行二进制目标。如果有多个二进制目标，您必须传递目标标志来选择其中一个。或者，可以在 `Cargo.toml` 的 `[package]` 部分指定 `default-run` 字段来默认运行哪个二进制文件。

<dl>

<dt class="option-term" id="option-cargo-run---bin"><a class="option-anchor" href="#option-cargo-run---bin"><code>--bin</code> <em>name</em></a></dt>
<dd class="option-desc"><p>运行指定的二进制文件。</p>
</dd>


<dt class="option-term" id="option-cargo-run---example"><a class="option-anchor" href="#option-cargo-run---example"><code>--example</code> <em>name</em></a></dt>
<dd class="option-desc"><p>运行指定的示例。</p>
</dd>


</dl>

### 特性选择

特性标志允许您控制哪些特性被启用。如果没有指定特性选项，每个选中的包都将激活 `default` 特性。

有关更多细节，请参阅 [特性文档](../reference/features.html#command-line-特性-options)。

<dl>

<dt class="option-term" id="option-cargo-run--F"><a class="option-anchor" href="#option-cargo-run--F"><code>-F</code> <em>features</em></a></dt>
<dt class="option-term" id="option-cargo-run---features"><a class="option-anchor" href="#option-cargo-run---features"><code>--features</code> <em>features</em></a></dt>
<dd class="option-desc"><p>激活功能的空格或逗号分隔列表。工作区成员的功能可以通过 <code>package-name/feature-name</code> 语法启用。此标志可以多次指定，从而启用所有指定的功能。</p>
</dd>


<dt class="option-term" id="option-cargo-run---all-features"><a class="option-anchor" href="#option-cargo-run---all-features"><code>--all-features</code></a></dt>
<dd class="option-desc"><p>激活所有选定包可用的全部功能。</p>
</dd>


<dt class="option-term" id="option-cargo-run---no-default-features"><a class="option-anchor" href="#option-cargo-run---no-default-features"><code>--no-default-features</code></a></dt>
<dd class="option-desc"><p>不激活选定包的 <code>default</code> 功能。</p>
</dd>


</dl>

### 编译选项

<dl>

<dt class="option-term" id="option-cargo-run---target"><a class="option-anchor" href="#option-cargo-run---target"><code>--target</code> <em>tuple</em></a></dt>
<dd class="option-desc"><p>针对指定的目标架构运行。默认为目标机器架构。该元组的通用格式为 <code>&lt;arch&gt;&lt;sub&gt;-&lt;vendor&gt;-&lt;sys&gt;-&lt;abi&gt;</code>。</p> <p>可能的值：</p> <ul> <li>在 <code>rustc --print target-list</code> 中支持的任何目标。</li> <li><code>"host-tuple"</code>，内部会被替换为目标机器的目标。如果你正在交叉编译某些库，且不想指定目标机器作为目标（例如，在多个主机可使用的共享项目中使用的 <code>xtask</code>），这非常有用。</li> <li>指向自定义目标规范的路径。有关更多信息，请参阅 <a href="../../rustc/targets/custom.html#custom-target-lookup-path">Custom Target Lookup Path</a>。</li> </ul> <p>也可以通过 <code>build.target</code> <a href="../reference/config.html">config 值</a>指定此选项。</p> <p>请注意，指定此标志会使 Cargo 以不同的模式运行，此时目标工件被放在单独的目录中。有关更多细节，请参阅 <a href="../reference/build-cache.html">build cache</a> 文档。</p>
</dd>


<dt class="option-term" id="option-cargo-run--r"><a class="option-anchor" href="#option-cargo-run--r"><code>-r</code></a></dt>
<dt class="option-term" id="option-cargo-run---release"><a class="option-anchor" href="#option-cargo-run---release"><code>--release</code></a></dt>
<dd class="option-desc"><p>使用 <code>release</code> 配置运行优化后的工件。 另请参阅 <code>--profile</code> 选项以按名称选择特定配置。</p>
</dd>


<dt class="option-term" id="option-cargo-run---profile"><a class="option-anchor" href="#option-cargo-run---profile"><code>--profile</code> <em>name</em></a></dt>
<dd class="option-desc"><p>使用给定的配置运行。 有关配置的更多详细信息，请参阅 <a href="../reference/profiles.html">参考文档</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-run---timings"><a class="option-anchor" href="#option-cargo-run---timings"><code>--timings</code></a></dt>
<dd class="option-desc"><p>输出每个编译所花费的时间，并随时间跟踪并发信息。</p> <p>在构建结束时，一个文件 <code>cargo-timing.html</code> 会被写入 <code>target/cargo-timings</code> 目录中。如果您想查看之前的运行结果，还会生成一个带有时间戳的文件名的额外报告。这些报告仅适合人类阅读，不提供机器可读取的计时数据。</p>
</dd>



</dl>

### 输出选项

<dl>
<dt class="option-term" id="option-cargo-run---target-dir"><a class="option-anchor" href="#option-cargo-run---target-dir"><code>--target-dir</code> <em>directory</em></a></dt>
<dd class="option-desc"><p>所有生成的艺术品和中间文件的目录。也可以通过 <code>CARGO_TARGET_DIR</code> 环境变量或 <code>build.target-dir</code> <a href="../reference/config.html">配置值</a>来指定。默认值为工作空间根目录中的 <code>target</code>。</p>
</dd>

</dl>

### 显示选项

<dl>

<dt class="option-term" id="option-cargo-run--v"><a class="option-anchor" href="#option-cargo-run--v"><code>-v</code></a></dt>
<dt class="option-term" id="option-cargo-run---verbose"><a class="option-anchor" href="#option-cargo-run---verbose"><code>--verbose</code></a></dt>
<dd class="option-desc"><p>使用详细输出。可以通过 <code>term.verbose</code> <a href="../reference/config.html">配置值</a>设置为“非常详细”，包含依赖警告和构建脚本输出等额外信息。</p>
</dd>


<dt class="option-term" id="option-cargo-run--q"><a class="option-anchor" href="#option-cargo-run--q"><code>-q</code></a></dt>
<dt class="option-term" id="option-cargo-run---quiet"><a class="option-anchor" href="#option-cargo-run---quiet"><code>--quiet</code></a></dt>
<dd class="option-desc"><p>不打印 cargo 日志消息。也可以通过 <code>term.quiet</code> <a href="../reference/config.html">配置值</a>来指定。</p>
</dd>


<dt class="option-term" id="option-cargo-run---color"><a class="option-anchor" href="#option-cargo-run---color"><code>--color</code> <em>when</em></a></dt>
<dd class="option-desc"><p>控制是否使用彩色输出。有效值包括：</p> <ul> <li><code>auto</code>（默认）：自动检测终端是否支持颜色显示。</li> <li><code>always</code>：始终显示颜色。</li> <li><code>never</code>：从不显示颜色。</li> </ul> <p>也可以通过 <code>term.color</code> <a href="../reference/config.html">配置值</a>来指定。</p>
</dd>


<dt class="option-term" id="option-cargo-run---message-format"><a class="option-anchor" href="#option-cargo-run---message-format"><code>--message-format</code> <em>fmt</em></a></dt>
<dd class="option-desc"><p>诊断信息的输出格式。可以多次指定，由逗号分隔的值组成。有效值：</p> <ul> <li><code>human</code>（默认）：以人类可读的文本格式显示。与 <code>short</code> 和 <code>json</code> 冲突。</li> <li><code>short</code>：输出更简短、人类可读的消息。与 <code>human</code> 和 <code>json</code> 冲突。</li> <li><code>json</code>：将 JSON 消息输出到标准输出中。更多详情请参阅 <a href="../reference/external-tools.html#json-messages">参考文档</a>。与 <code>human</code> 和 <code>short</code> 冲突。</li> <li><code>json-diagnostic-short</code>：确保 JSON 消息的 <code>rendered</code> 字段包含 rustc 生成的 “short” 渲染格式。不能与 <code>human</code> 或 <code>short</code> 一起使用。</li> <li><code>json-diagnostic-rendered-ansi</code>：确保 JSON 消息的 <code>rendered</code> 字段包含嵌入的 ANSI 颜色代码，以遵循 rustc 默认的配色方案。不能与 <code>human</code> 或 <code>short</code> 一起使用。</li> <li><code>json-render-diagnostics</code>：指示 Cargo 在打印的 JSON 消息中不包含 rustc 诊断信息，而是由 Cargo 自身渲染来自 rustc 的 JSON 诊断信息。Cargo 自身的 JSON 诊断信息及其他来自 rustc 的信息仍会被输出。不能与 <code>human</code> 或 <code>short</code> 一起使用。</li> </ul> </dd>
</dd>


<dt class="option-term" id="option-cargo-run---ignore-rust-version"><a class="option-anchor" href="#option-cargo-run---ignore-rust-version"><code>--ignore-rust-version</code></a></dt>
<dd class="option-desc"><p>在包中忽略 <code>rust-version</code> 规范。</p>
</dd>


<dt class="option-term" id="option-cargo-run---locked"><a class="option-anchor" href="#option-cargo-run---locked"><code>--locked</code></a></dt>
<dd class="option-desc"><p>断言使用与原始生成 <code>Cargo.lock</code> 文件时相同的依赖项和版本。当出现以下任一情况时，Cargo 将以错误退出： <ul> <li>锁文件缺失。</li> <li>由于不同的依赖解析导致 Cargo 尝试修改锁文件。</li> </ul> 该选项可用于需要确定性构建的环境中，例如 CI 流水线。</p>
</dd>


<dt class="option-term" id="option-cargo-run---offline"><a class="option-anchor" href="#option-cargo-run---offline"><code>--offline</code></a></dt>
<dd class="option-desc"><p>防止 Cargo 出于任何原因访问网络。如果没有此标志，如果 Cargo 需要访问网络而网络不可用时，它将以错误退出。使用此标志后，Cargo 将尽可能在不连接网络的情况下继续运行。 请注意，这可能导致与在线模式不同的依赖解析结果。即使本地索引副本中显示有更新版本，Cargo 也将限制自己仅使用本地下载的包。在离线操作前，请参考 <a href="cargo-fetch.html">cargo-fetch(1)</a> 命令来下载依赖项。 也可以通过 <code>net.offline</code> <a href="../reference/config.html">配置值</a>指定此选项。</p>
</dd>


<dt class="option-term" id="option-cargo-run---frozen"><a class="option-anchor" href="#option-cargo-run---frozen"><code>--frozen</code></a></dt>
<dd class="option-desc"><p>相当于同时指定 <code>--locked</code> 和 <code>--offline</code>。</p>
</dd>



</dl>

### 常见选项

<dl>

<dt class="option-term" id="option-cargo-run-+toolchain"><a class="option-anchor" href="#option-cargo-run-+toolchain"><code>+</code><em>toolchain</em></a></dt>
<dd class="option-desc"><p>如果 Cargo 是通过 rustup 安装的，且 <code>cargo</code> 的第一个参数以 <code>+</code> 开头，则会被解释为 rustup 工具链名称（如 <code>+stable</code> 或 <code>+nightly</code>）。 有关工具链覆盖机制更多信息，请参阅 <a href="https://rust-lang.github.io/rustup/overrides.html">rustup 文档</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-run---config"><a class="option-anchor" href="#option-cargo-run---config"><code>--config</code> <em>KEY=VALUE</em> or <em>PATH</em></a></dt>
<dd class="option-desc"><p>覆盖 Cargo 配置值。参数应为 TOML 语法 <code>KEY=VALUE</code>，或作为额外配置文件的路径提供。此标志可以多次指定。有关更多信息，请参阅 <a href="../reference/config.html#command-line-overrides">命令行覆盖部分</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-run--C"><a class="option-anchor" href="#option-cargo-run--C"><code>-C</code> <em>PATH</em></a></dt>
<dd class="option-desc"><p>在执行任何指定操作之前，更改当前工作目录。这会影响诸如 cargo 默认查找项目清单 (<code>Cargo.toml</code>)的位置，以及搜索以发现 <code>.cargo/config.toml</code> 的目录等设置。此选项必须出现在命令名称之前，例如 <code>cargo -C path/to/my-project build</code>。</p> <p>此选项仅适用于 <a href="https://doc.rust-lang.org/book/appendix-07-nightly-rust.html">nightly 渠道</a>，并且需要使用 <code>-Z unstable-options</code> 标志才能启用（参见 <a href="https://github.com/rust-lang/cargo/issues/10098">#10098</a>）。</p>
</dd>


<dt class="option-term" id="option-cargo-run--h"><a class="option-anchor" href="#option-cargo-run--h"><code>-h</code></a></dt>
<dt class="option-term" id="option-cargo-run---help"><a class="option-anchor" href="#option-cargo-run---help"><code>--help</code></a></dt>
<dd class="option-desc"><p>打印帮助信息。</p>
</dd>


<dt class="option-term" id="option-cargo-run--Z"><a class="option-anchor" href="#option-cargo-run--Z"><code>-Z</code> <em>flag</em></a></dt>
<dd class="option-desc"><p>Cargo 的不稳定（仅 nightly 版本）标志。运行 <code>cargo -Z help</code> 获取详细信息。</p>
</dd>


</dl>

### 其他选项

<dl>
<dt class="option-term" id="option-cargo-run--j"><a class="option-anchor" href="#option-cargo-run--j"><code>-j</code> <em>N</em></a></dt>
<dt class="option-term" id="option-cargo-run---jobs"><a class="option-anchor" href="#option-cargo-run---jobs"><code>--jobs</code> <em>N</em></a></dt>
<dd class="option-desc"><p>要运行的并行任务数量。也可以通过 <code>build.jobs</code> <a href="../reference/config.html">配置值</a>指定。默认值为逻辑 CPU 数。如果为负数，则将最大并行任务数设置为逻辑 CPU 数加上提供的数值。如果提供字符串 <code>default</code>，则将其重置为默认值。不应为 0。</p>
</dd>

<dt class="option-term" id="option-cargo-run---keep-going"><a class="option-anchor" href="#option-cargo-run---keep-going"><code>--keep-going</code></a></dt>
<dd class="option-desc"><p>尽可能多地构建依赖图中所有的包，而不是在第一个构建失败的包上终止构建。</p> <p>例如，如果当前包依赖于 <code>fails</code> 和 <code>works</code> 两个依赖项，其中有一个构建失败，则 <code>cargo run -j1</code> 可能能够或无法构建成功的那个（取决于 Cargo 首先选择运行哪个），而 <code>cargo run -j1 --keep-going</code> 则一定会同时运行两个构建，即使第一个运行的失败。</p>
</dd>

</dl>

## 环境

有关 Cargo 读取的环境变量详情，请参阅 [参考手册](../reference/environment-variables.html)。

## 退出状态

* `0`: Cargo 成功执行。
* `101`: Cargo 未能完成。

## 示例

1. 构建本地包并运行其主目标（假设只有一个二进制文件）：

       cargo run

2. 使用额外参数运行示例程序：

       cargo run --example exname -- --exoption exarg1 exarg2

## 另请参阅 [cargo(1)](cargo.html)、[cargo-build(1)](cargo-build.html)
