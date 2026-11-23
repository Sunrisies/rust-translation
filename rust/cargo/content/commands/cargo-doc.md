# cargo-doc(1)
## 名称

cargo-doc --- 生成包文档

## 概述

`cargo doc` [_选项_]

## 描述

该命令用于构建本地包及其所有依赖项的文档。输出结果以 rustdoc 的常规格式存储在 `target/doc` 中。

**注意：** 文档生成是累积性的：在多次调用 `cargo doc` 时，目标目录中的现有文档文件会被保留下来。若要删除已生成的文档，请使用 `--doc` 参数对 [cargo-clean(1)](cargo-clean.html) 执行操作。

## 选项

### 文档选项

<dl>

<dt class="option-term" id="option-cargo-doc---open"><a class="option-anchor" href="#option-cargo-doc---open"><code>--open</code></a></dt>
<dd class="option-desc"><p>构建文档后，在浏览器中打开它们。这将使用你的默认浏览器，除非你在 <code>BROWSER</code> 环境变量中定义了其他浏览器，或者使用了 <a href="../reference/config.html#docbrowser"><code>doc.browser</code></a> 配置选项。</p>
</dd>


<dt class="option-term" id="option-cargo-doc---no-deps"><a class="option-anchor" href="#option-cargo-doc---no-deps"><code>--no-deps</code></a></dt>
<dd class="option-desc"><p>不要为依赖项构建文档。</p>
</dd>


<dt class="option-term" id="option-cargo-doc---document-private-items"><a class="option-anchor" href="#option-cargo-doc---document-private-items"><code>--document-private-items</code></a></dt>
<dd class="option-desc"><p>在文档中包含非公开项目。如果记录二进制目标，此功能将默认启用。</p>
</dd>


</dl>

### 包选择

默认情况下，如果没有提供包选择选项，则所选包将依赖选定的清单文件（如果未指定 `--manifest-path`，则基于当前工作目录）。如果清单是工作空间的根目录，则选择工作空间的默认成员；否则仅选择清单中定义的包。

工作空间的默认成员可以通过根清单中的 `workspace.default-members` 键显式设置。如果不进行设置，虚拟工作空间将包含所有工作空间成员（相当于传递 `--workspace` 参数），而非虚拟工作空间则仅包含根 crate 本身。

<dl>

<dt class="option-term" id="option-cargo-doc--p"><a class="option-anchor" href="#option-cargo-doc--p"><code>-p</code> <em>spec</em>…</a></dt>
<dt class="option-term" id="option-cargo-doc---package"><a class="option-anchor" href="#option-cargo-doc---package"><code>--package</code> <em>spec</em>…</a></dt>
<dd class="option-desc"><p>仅记录指定的包。关于 SPEC 格式，请参见 <a href="cargo-pkgid.html">cargo-pkgid(1)</a>。此标志可以多次指定，并支持常见的 Unix glob 模式，如 <code>*</code>、<code>?</code> 和 <code>[]</code>。但是，为了避免 shell 在 Cargo 处理之前意外展开 glob 模式，必须在每个模式下使用单引号或双引号。</p>
</dd>


<dt class="option-term" id="option-cargo-doc---workspace"><a class="option-anchor" href="#option-cargo-doc---workspace"><code>--workspace</code></a></dt>
<dd class="option-desc"><p>记录工作区中的所有成员。</p>
</dd>


<dt class="option-term" id="option-cargo-doc---all"><a class="option-anchor" href="#option-cargo-doc---all"><code>--all</code></a></dt>
<dd class="option-desc"><p><code>--workspace</code> 的已弃用别名。</p>
</dd>


<dt class="option-term" id="option-cargo-doc---exclude"><a class="option-anchor" href="#option-cargo-doc---exclude"><code>--exclude</code> <em>SPEC</em>…</a></dt>
<dd class="option-desc"><p>排除指定的包。必须与 <code>--workspace</code> 标志一起使用。此标志可以多次指定，并支持常见的 Unix glob 模式，如 <code>*</code>、<code>?</code> 和 <code>[]</code>。但是，为了避免 shell 在 Cargo 处理之前意外展开 glob 模式，必须在每个模式下使用单引号或双引号。</p>
</dd>


</dl>

### 目标选择

如果没有提供目标选择选项，`cargo doc` 将生成所选包的所有二进制和库目标文档。如果二进制名称与库目标相同，则该二进制将被跳过。如果二进制存在缺失的 `required-features`，同样会被跳过。

可以通过在清单设置中针对目标指定 `doc = false` 来更改默认行为。使用目标选择选项时，将忽略 `doc` 标志，并始终生成给定目标文档。

<dl>
<dt class="option-term" id="option-cargo-doc---lib"><a class="option-anchor" href="#option-cargo-doc---lib"><code>--lib</code></a></dt>
<dd class="option-desc"><p>记录包的库功能。</p>
</dd>


<dt class="option-term" id="option-cargo-doc---bin"><a class="option-anchor" href="#option-cargo-doc---bin"><code>--bin</code> <em>name</em>…</a></dt>
<dd class="option-desc"><p>记录指定的二进制文件。此标志可以多次指定，并支持常见的 Unix glob 模式。</p>
</dd>


<dt class="option-term" id="option-cargo-doc---bins"><a class="option-anchor" href="#option-cargo-doc---bins"><code>--bins</code></a></dt>
<dd class="option-desc"><p>记录所有二进制目标。</p>
</dd>


<dt class="option-term" id="option-cargo-doc---example"><a class="option-anchor" href="#option-cargo-doc---example"><code>--example</code> <em>name</em>…</a></dt>
<dd class="option-desc"><p>记录指定的示例。此标志可以多次指定，并支持常见的 Unix glob 模式。</p>
</dd>


<dt class="option-term" id="option-cargo-doc---examples"><a class="option-anchor" href="#option-cargo-doc---examples"><code>--examples</code></a></dt>
<dd class="option-desc"><p>记录所有示例目标。</p>
</dd>


</dl>

### 特性选择

特性标志允许你控制哪些特性被启用。如果没有提供特性选项，则每个所选包都会激活 `default` 特性。

更多详情请参见 [特性文档](../reference/features.html#command-line-特性-options)。

<dl>

<dt class="option-term" id="option-cargo-doc--F"><a class="option-anchor" href="#option-cargo-doc--F"><code>-F</code> <em>features</em></a></dt>
<dt class="option-term" id="option-cargo-doc---features"><a class="option-anchor" href="#option-cargo-doc---features"><code>--features</code> <em>features</em></a></dt>
<dd class="option-desc"><p>用于激活的功能的空格或逗号分隔列表。工作区成员的功能可以通过 <code>package-name/feature-name</code> 语法启用。此标志可以多次指定，从而启用所有指定的功能。</p>
</dd>


<dt class="option-term" id="option-cargo-doc---all-features"><a class="option-anchor" href="#option-cargo-doc---all-features"><code>--all-features</code></a></dt>
<dd class="option-desc"><p>激活所有选定包的所有可用功能。</p>
</dd>


<dt class="option-term" id="option-cargo-doc---no-default-features"><a class="option-anchor" href="#option-cargo-doc---no-default-features"><code>--no-default-features</code></a></dt>
<dd class="option-desc"><p>不要激活选定包的 <code>default</code> 功能。</p>
</dd>


</dl>

### 编译选项

<dl>

<dt class="option-term" id="option-cargo-doc---target"><a class="option-anchor" href="#option-cargo-doc---target"><code>--target</code> <em>tuple</em></a></dt>
<dd class="option-desc"><p>该文档适用于指定的目标架构。可以多次指定此标志，默认值为主机架构。元组的一般格式为 <code>&lt;arch&gt;&lt;sub&gt;-&lt;vendor&gt;-&lt;sys&gt;-&lt;abi&gt;</code>。</p> <p>可能的值：</p> <ul> <li>在 <code>rustc --print target-list</code> 中支持的任何目标。</li> <li><code>"host-tuple"</code>，系统将内部替换为主机目标。如果你正在交叉编译某些库，且不想指定主机机器作为目标（例如，在多个主机可使用的共享项目中使用的 <code>xtask</code>），这非常有用。</li> <li>指向自定义目标规范的路径。有关更多信息，请参阅 <a href="../../rustc/targets/custom.html#custom-target-lookup-path">自定义目标查找路径</a>。</li> </ul> <p>也可以通过 <code>build.target</code> <a href="../reference/config.html">配置值</a>来指定此标志。</p> <p>请注意，指定此标志会使 Cargo 以不同的模式运行，此时目标产物会被放在单独的目录中。有关更多细节，请参阅 <a href="../reference/build-cache.html">构建缓存</a>文档。</p>
</dd>


<dt class="option-term" id="option-cargo-doc--r"><a class="option-anchor" href="#option-cargo-doc--r"><code>-r</code></a></dt>
<dt class="option-term" id="option-cargo-doc---release"><a class="option-anchor" href="#option-cargo-doc---release"><code>--release</code></a></dt>
<dd class="option-desc"><p>该文档描述了使用 <code>release</code> 配置优化后的产物。也可通过 <code>--profile</code> 选项按名称选择特定配置。</p>
</dd>


<dt class="option-term" id="option-cargo-doc---profile"><a class="option-anchor" href="#option-cargo-doc---profile"><code>--profile</code> <em>name</em></a></dt>
<dd class="option-desc"><p>该文档包含给定配置的信息。有关配置的更多详情，请参阅 <a href="../reference/profiles.html">参考文档</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-doc---timings"><a class="option-anchor" href="#option-cargo-doc---timings"><code>--timings</code></a></dt>
<dd class="option-desc"><p>输出每个编译所花费的时间信息，并随时间跟踪并发信息。</p> <p>在构建结束时，文件 <code>cargo-timing.html</code> 将被写入 <code>target/cargo-timings</code> 目录。如果你希望查看之前的运行结果，还会生成一个带有时间戳的文件名的额外报告。这些报告仅适合人类阅读，不提供机器可读取的计时数据。</p>
</dd>



</dl>

### 输出选项

<dl>
<dt class="option-term" id="option-cargo-doc---target-dir"><a class="option-anchor" href="#option-cargo-doc---target-dir"><code>--target-dir</code> <em>directory</em></a></dt>
<dd class="option-desc"><p>用于存储所有生成产物和中间文件的目录。也可以通过 <code>CARGO_TARGET_DIR</code> 环境变量或 <code>build.target-dir</code> <a href="../reference/config.html">配置值</a>来指定该路径。默认值为工作空间根目录下的 <code>target</code>。</p>
</dd>

</dl>

### 显示选项

<dl>
<dt class="option-term" id="option-cargo-doc--v"><a class="option-anchor" href="#option-cargo-doc--v"><code>-v</code></a></dt>
<dt class="option-term" id="option-cargo-doc---verbose"><a class="option-anchor" href="#option-cargo-doc---verbose"><code>--verbose</code></a></dt>
<dd class="option-desc"><p>使用详细输出。可以通过两次设置 <code>term.verbose</code> <a href="../reference/config.html">配置值</a>来启用“非常详细”的输出，包含依赖警告和构建脚本输出等额外信息。</p>
</dd>


<dt class="option-term" id="option-cargo-doc--q"><a class="option-anchor" href="#option-cargo-doc--q"><code>-q</code></a></dt>
<dt class="option-term" id="option-cargo-doc---quiet"><a class="option-anchor" href="#option-cargo-doc---quiet"><code>--quiet</code></a></dt>
<dd class="option-desc"><p>不打印 cargo 日志消息。也可以通过 <code>term.quiet</code> <a href="../reference/config.html">配置值</a>来禁用此功能。</p>
</dd>


<dt class="option-term" id="option-cargo-doc---color"><a class="option-anchor" href="#option-cargo-doc---color"><code>--color</code> <em>when</em></a></dt>
<dd class="option-desc"><p>控制是否使用彩色输出。有效值包括： <ul> <li><code>auto</code>（默认）：自动检测终端是否支持颜色显示。</li> <li><code>always</code>：始终显示颜色。</li> <li><code>never</code>：从不显示颜色。</li> </ul> <p>也可以通过 <code>term.color</code> <a href="../reference/config.html">配置值</a>来指定。</p></p>
</dd>


<dt class="option-term" id="option-cargo-doc---message-format"><a class="option-anchor" href="#option-cargo-doc---message-format"><code>--message-format</code> <em>fmt</em></a></dt>
<dd class="option-desc"><p>诊断信息的输出格式。可以多次指定，由逗号分隔的值组成。有效值：</p> <ul> <li><code>human</code>（默认）：以人类可读的文本格式显示。与 <code>short</code> 和 <code>json</code> 冲突。</li> <li><code>short</code>：输出更简短的人类可读文本信息。与 <code>human</code> 和 <code>json</code> 冲突。</li> <li><code>json</code>：将 JSON 消息输出到标准输出中。更多详情请参阅 <a href="../reference/external-tools.html#json-messages">参考文档</a>。与 <code>human</code> 和 <code>short</code> 冲突。</li> <li><code>json-diagnostic-short</code>：确保 JSON 消息的 <code>rendered</code> 字段包含 rustc 生成的“短”格式。不能与 <code>human</code> 或 <code>short</code> 一起使用。</li> <li><code>json-diagnostic-rendered-ansi</code>：确保 JSON 消息的 <code>rendered</code> 字段包含嵌入的 ANSI 颜色代码，以遵循 rustc 默认的配色方案。不能与 <code>human</code> 或 <code>short</code> 一起使用。</li> <li><code>json-render-diagnostics</code>：指示 Cargo 在打印的 JSON 消息中不包含 rustc 诊断信息，而是由 Cargo 自身渲染来自 rustc 的 JSON 诊断信息。Cargo 自身的 JSON 诊断信息及来自 rustc 的其他诊断信息仍会输出。不能与 <code>human</code> 或 <code>short</code> 一起使用。</li> </ul> </dd> </dl> ### Manifest 选项 <dl> <dt class="option-term" id="option-cargo-doc---manifest-path"><a class="option-anchor" href="#option-cargo-doc---manifest-path"><code>--manifest-path</code> <em>路径</em></a></dt> <dd class="option-desc"><p><code>Cargo.toml</code> 文件的路径。默认情况下，Cargo 会在当前目录或任何父目录中查找 <code>Cargo.toml</code> 文件。</li></p>
</dd>


<dt class="option-term" id="option-cargo-doc---ignore-rust-version"><a class="option-anchor" href="#option-cargo-doc---ignore-rust-version"><code>--ignore-rust-version</code></a></dt>
<dd class="option-desc"><p>在包中忽略 <code>rust-version</code> 规范。</p>
</dd>


<dt class="option-term" id="option-cargo-doc---locked"><a class="option-anchor" href="#option-cargo-doc---locked"><code>--locked</code></a></dt>
<dd class="option-desc"><p>断言当前使用的依赖项和版本与原始生成 <code>Cargo.lock</code> 文件时相同。当出现以下任一情况时，Cargo 将以错误退出： <ul> <li>锁文件缺失。</li> <li>由于不同的依赖解析导致 Cargo 尝试修改锁文件。</li> </ul> 该选项可用于需要确定性构建的环境中，例如 CI 流水线。</p>
</dd>


<dt class="option-term" id="option-cargo-doc---offline"><a class="option-anchor" href="#option-cargo-doc---offline"><code>--offline</code></a></dt>
<dd class="option-desc"><p>防止 Cargo 出于任何原因访问网络。如果没有此标志，如果 Cargo 需要访问网络而网络不可用时，它将以错误退出。使用此标志后，Cargo 将尽可能在不连接网络的情况下继续运行。 请注意，这可能会导致与在线模式不同的依赖解析结果。即使本地索引副本中显示有更新版本，Cargo 也将限制自己仅使用本地下载的库。在离线操作前，请参考 <a href="cargo-fetch.html">cargo-fetch(1)</a> 命令来下载依赖项。 也可以通过 <code>net.offline</code> <a href="../reference/config.html">配置值</a>指定此选项。</p>
</dd>


<dt class="option-term" id="option-cargo-doc---frozen"><a class="option-anchor" href="#option-cargo-doc---frozen"><code>--frozen</code></a></dt>
<dd class="option-desc"><p>相当于同时指定 <code>--locked</code> 和 <code>--offline</code>。</p>
</dd>


</dl>

### 常见选项

<dl>

<dt class="option-term" id="option-cargo-doc-+toolchain"><a class="option-anchor" href="#option-cargo-doc-+toolchain"><code>+</code><em>toolchain</em></a></dt>
<dd class="option-desc"><p>如果 Cargo 是通过 rustup 安装的，且 <code>cargo</code> 的第一个参数以 <code>+</code> 开头，则会被解释为 rustup 工具链名称（如 <code>+stable</code> 或 <code>+nightly</code>）。 有关工具链覆盖机制更多信息，请参阅 <a href="https://rust-lang.github.io/rustup/overrides.html">rustup 文档</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-doc---config"><a class="option-anchor" href="#option-cargo-doc---config"><code>--config</code> <em>KEY=VALUE</em> or <em>PATH</em></a></dt>
<dd class="option-desc"><p>用于覆盖 Cargo 配置值。参数应为 TOML 语法 <code>KEY=VALUE</code>，或作为额外配置文件的路径提供。此标志可以多次指定。有关更多信息，请参阅 <a href="../reference/config.html#command-line-overrides">命令行覆盖部分</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-doc--C"><a class="option-anchor" href="#option-cargo-doc--C"><code>-C</code> <em>PATH</em></a></dt>
<dd class="option-desc"><p>在执行任何指定操作之前，更改当前工作目录。这会影响诸如 cargo 默认查找项目清单 (<code>Cargo.toml</code>)的位置，以及搜索以发现 <code>.cargo/config.toml</code> 的目录等设置。此选项必须出现在命令名称之前，例如 <code>cargo -C path/to/my-project build</code>。</p> <p>此选项仅适用于 <a href="https://doc.rust-lang.org/book/appendix-07-nightly-rust.html">nightly 版本</a>，并且需要使用 <code>-Z unstable-options</code> 标志才能启用（参见 <a href="https://github.com/rust-lang/cargo/issues/10098">#10098</a>）。</p>
</dd>


<dt class="option-term" id="option-cargo-doc--h"><a class="option-anchor" href="#option-cargo-doc--h"><code>-h</code></a></dt>
<dt class="option-term" id="option-cargo-doc---help"><a class="option-anchor" href="#option-cargo-doc---help"><code>--help</code></a></dt>
<dd class="option-desc"><p>打印帮助信息。</p>
</dd>


<dt class="option-term" id="option-cargo-doc--Z"><a class="option-anchor" href="#option-cargo-doc--Z"><code>-Z</code> <em>flag</em></a></dt>
<dd class="option-desc"><p>Cargo 的不稳定（仅 nightly 版本）标志。运行 <code>cargo -Z help</code> 以获取详细信息。</p>
</dd>


</dl>

### 其他选项

<dl>
<dt class="option-term" id="option-cargo-doc--j"><a class="option-anchor" href="#option-cargo-doc--j"><code>-j</code> <em>N</em></a></dt>
<dt class="option-term" id="option-cargo-doc---jobs"><a class="option-anchor" href="#option-cargo-doc---jobs"><code>--jobs</code> <em>N</em></a></dt>
<dd class="option-desc"><p>要运行的并行任务数量。也可以通过 <code>build.jobs</code> <a href="../reference/config.html">配置值</a>指定。默认值为逻辑 CPU 数。如果为负数，则将最大并行任务数设置为逻辑 CPU 数加上提供的数值。如果提供字符串 <code>default</code>，则将其重置为默认值。不应为 0。</p>
</dd>

<dt class="option-term" id="option-cargo-doc---keep-going"><a class="option-anchor" href="#option-cargo-doc---keep-going"><code>--keep-going</code></a></dt>
<dd class="option-desc"><p>尽可能多地构建依赖图中所有的包，而不是在第一个构建失败的包上终止构建。</p> <p>例如，如果当前包依赖于 <code>fails</code> 和 <code>works</code> 两个依赖项，其中一个构建失败，<code>cargo doc -j1</code> 可能能够或无法构建成功的那个（取决于 Cargo 首先选择运行哪个构建），而 <code>cargo doc -j1 --keep-going</code> 则一定会同时运行两个构建，即使第一个运行的失败。</p>
</dd>

<dt class="option-term" id="option-cargo-doc---output-format"><a class="option-anchor" href="#option-cargo-doc---output-format"><code>--output-format</code></a></dt>
<dd class="option-desc"><p>文档输出的类型。有效值：</p> <ul> <li><code>html</code>（默认）：以 HTML 格式输出文档。</li> <li><code>json</code>：以 <a href="https://doc.rust-lang.org/nightly/nightly-rustc/rustdoc_json_types">实验性 JSON 格式</a>输出文档。</li> </ul> <p>此选项仅适用于 <a href="https://doc.rust-lang.org/book/appendix-07-nightly-rust.html">nightly 频道</p>，并且需要添加 <code>-Z unstable-options</code> 标志才能启用。
</dd>

</dl>

## 环境

有关 Cargo 读取的环境变量详情，请参阅 [参考手册](../reference/environment-variables.html)。

## 退出状态

* `0`: Cargo 成功执行。
* `101`: Cargo 未能完成执行。

## 示例

1. 构建本地包文档及其依赖项，并将输出保存到 `target/doc` 目录中。

       cargo doc

## 另请参阅 [cargo(1)](cargo.html)、[cargo-rustdoc(1)](cargo-rustdoc.html)、[rustdoc(1)](https://doc.rust-lang.org/rustdoc/index.html)
