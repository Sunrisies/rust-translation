# cargo-rustdoc(1)
## 名称

cargo-rustdoc —— 使用指定的自定义标志构建包的文档

## 概述

`cargo rustdoc` [_options_] [`--` _args_]

## 描述

当前包的目标（或如果提供了 `-p`，则选择由 `-p` 指定的包）将使用传递给最终 rustdoc 调用的 `_args_` 进行文档生成。依赖项不会作为此命令的一部分被文档化。请注意，rustdoc 仍然会无条件接收诸如 `-L`、`--extern` 和 `--crate-type` 等参数，而指定的 `_args_` 仅会被添加到 rustdoc 调用中。

有关 rustdoc 标志的文档，请参见 <https://doc.rust-lang.org/rustdoc/index.html>。

此命令要求当提供额外参数时只编译一个目标。如果当前包有多个目标可用，则必须使用 `--lib`、`--bin` 等过滤器来选择要编译的目标。

若要将标志传递给 Cargo 生成的所有 rustdoc 进程，请使用 `RUSTDOCFLAGS` [环境变量](../reference/environment-variables.html) 或 `build.rustdocflags` [配置值](../reference/config.html)。

## 选项

### 文档选项

<dl>

<dt class="option-term" id="option-cargo-rustdoc---open"><a class="option-anchor" href="#option-cargo-rustdoc---open"><code>--open</code></a></dt>
<dd class="option-desc"><p>构建文档后，在浏览器中打开它们。这将使用你的默认浏览器，除非你在 <code>BROWSER</code> 环境变量中定义了其他浏览器，或使用了 <a href="../reference/config.html#docbrowser"><code>doc.browser</code></a> 配置选项。</p>
</dd>


</dl>

### 包选择

默认情况下，将选择当前工作目录中的包。可以使用 `-p` 标志在工作空间中选择不同的包。

<dl>

<dt class="option-term" id="option-cargo-rustdoc--p"><a class="option-anchor" href="#option-cargo-rustdoc--p"><code>-p</code> <em>spec</em></a></dt>
<dt class="option-term" id="option-cargo-rustdoc---package"><a class="option-anchor" href="#option-cargo-rustdoc---package"><code>--package</code> <em>spec</em></a></dt>
<dd class="option-desc"><p>要记录的包。有关 SPEC 格式，请参阅 <a href="cargo-pkgid.html">cargo-pkgid(1)</a>。</p>
</dd>


</dl>

### 目标选择

当未提供目标选择选项时，`cargo rustdoc` 将文档化所选包的所有二进制和库目标。如果二进制名称与库目标相同，则该二进制将被跳过。如果二进制存在缺失的 `required-features`，则也会被跳过。

传递目标选择标志将仅文档化指定的目标。

请注意，`--bin`、`--example`、`--test` 和 `--bench` 标志也支持常见的 Unix glob 模式，如 `*`、`?` 和 `[]`。然而，为了避免 Shell 在 Cargo 处理之前意外展开 glob 模式，您必须在每个 glob 模式周围使用单引号或双引号。

<dl>

<dt class="option-term" id="option-cargo-rustdoc---lib"><a class="option-anchor" href="#option-cargo-rustdoc---lib"><code>--lib</code></a></dt>
<dd class="option-desc"><p>记录包的库文件。</p>
</dd>


<dt class="option-term" id="option-cargo-rustdoc---bin"><a class="option-anchor" href="#option-cargo-rustdoc---bin"><code>--bin</code> <em>name</em>…</a></dt>
<dd class="option-desc"><p>记录指定的二进制文件。此标志可以多次指定，并支持常见的 Unix glob 模式。</p>
</dd>


<dt class="option-term" id="option-cargo-rustdoc---bins"><a class="option-anchor" href="#option-cargo-rustdoc---bins"><code>--bins</code></a></dt>
<dd class="option-desc"><p>记录所有二进制目标。</p>
</dd>


<dt class="option-term" id="option-cargo-rustdoc---example"><a class="option-anchor" href="#option-cargo-rustdoc---example"><code>--example</code> <em>name</em>…</a></dt>
<dd class="option-desc"><p>记录指定的示例。此标志可以多次指定，并支持常见的 Unix glob 模式。</p>
</dd>


<dt class="option-term" id="option-cargo-rustdoc---examples"><a class="option-anchor" href="#option-cargo-rustdoc---examples"><code>--examples</code></a></dt>
<dd class="option-desc"><p>记录所有示例目标。</p>
</dd>


<dt class="option-term" id="option-cargo-rustdoc---test"><a class="option-anchor" href="#option-cargo-rustdoc---test"><code>--test</code> <em>name</em>…</a></dt>
<dd class="option-desc"><p>记录指定的集成测试。此标志可以多次指定，并支持常见的 Unix glob 模式。</p>
</dd>


<dt class="option-term" id="option-cargo-rustdoc---tests"><a class="option-anchor" href="#option-cargo-rustdoc---tests"><code>--tests</code></a></dt>
<dd class="option-desc"><p>记录所有设置了 <code>test = true</code> 标记的目标。默认情况下，这包括作为单元测试和集成测试构建的库文件及二进制文件。请注意，这还会构建所有必要的依赖项，因此 lib 目标可能会被构建两次（一次作为单元测试，一次作为二进制文件、集成测试等的依赖）。可以通过在目标的清单设置中设置 <code>test</code> 标志来启用或禁用目标。</p>
</dd>


<dt class="option-term" id="option-cargo-rustdoc---bench"><a class="option-anchor" href="#option-cargo-rustdoc---bench"><code>--bench</code> <em>name</em>…</a></dt>
<dd class="option-desc"><p>记录指定的基准测试。此标志可以多次指定，并支持常见的 Unix glob 模式。</p>
</dd>


<dt class="option-term" id="option-cargo-rustdoc---benches"><a class="option-anchor" href="#option-cargo-rustdoc---benches"><code>--benches</code></a></dt>
<dd class="option-desc"><p>记录所有设置了 <code>bench = true</code> 标记的目标。默认情况下，这包括作为基准测试和 bench 目标构建的库文件及二进制文件。请注意，这还会构建所有必要的依赖项，因此 lib 目标可能会被构建两次（一次作为基准测试，一次作为二进制文件、基准测试等的依赖）。可以通过在目标的清单设置中设置 <code>bench</code> 标志来启用或禁用目标。</p>
</dd>


<dt class="option-term" id="option-cargo-rustdoc---all-targets"><a class="option-anchor" href="#option-cargo-rustdoc---all-targets"><code>--all-targets</code></a></dt>
<dd class="option-desc"><p>记录所有目标。这相当于指定 <code>--lib --bins --tests --benches --examples</code>。</p>
</dd>


</dl>

### 特性选择

功能标志允许你控制哪些功能被启用。当没有指定功能选项时，每个选中的包都会激活 `default` 功能。

更多详情请参见 [功能文档](../reference/features.html#command-line-特性-options)。

<dl>

<dt class="option-term" id="option-cargo-rustdoc--F"><a class="option-anchor" href="#option-cargo-rustdoc--F"><code>-F</code> <em>features</em></a></dt>
<dt class="option-term" id="option-cargo-rustdoc---features"><a class="option-anchor" href="#option-cargo-rustdoc---features"><code>--features</code> <em>features</em></a></dt>
<dd class="option-desc"><p>要激活的功能列表，使用空格或逗号分隔。工作区成员功能可以通过 <code>package-name/feature-name</code> 语法启用。此标志可以多次指定，从而激活所有指定的功能。</p>
</dd>


<dt class="option-term" id="option-cargo-rustdoc---all-features"><a class="option-anchor" href="#option-cargo-rustdoc---all-features"><code>--all-features</code></a></dt>
<dd class="option-desc"><p>激活所有选定包的所有可用功能。</p>
</dd>


<dt class="option-term" id="option-cargo-rustdoc---no-default-features"><a class="option-anchor" href="#option-cargo-rustdoc---no-default-features"><code>--no-default-features</code></a></dt>
<dd class="option-desc"><p>不要激活选定包的 <code>default</code> 功能。</p>
</dd>


</dl>

### 编译选项

<dl>

<dt class="option-term" id="option-cargo-rustdoc---target"><a class="option-anchor" href="#option-cargo-rustdoc---target"><code>--target</code> <em>tuple</em></a></dt>
<dd class="option-desc"><p>针对指定的目标架构编写文档。此标志可以多次指定。默认值为主机架构。该元组的通用格式为 <code>&lt;arch&gt;&lt;sub&gt;-&lt;vendor&gt;-&lt;sys&gt;-&lt;abi&gt;</code>。 <p>可能的值：</p> <ul> <li>在 <code>rustc --print target-list</code> 中看到的任何支持的目标。</li> <li><code>"host-tuple"</code>，该值将内部由主机目标替代。如果你正在交叉编译某些库，且不想指定宿主机的机器作为目标（例如，在多个主机可使用的共享项目中使用的 <code>xtask</code>），则特别有用。</li> <li>指向自定义目标规范的路径。有关更多信息，请参阅 <a href="../../rustc/targets/custom.html#custom-target-lookup-path">自定义目标查找路径</a>。</li> </ul> <p>也可以通过 <code>build.target</code> <a href="../reference/config.html">配置值</a>来指定此选项。</p> <p>请注意，指定此标志会使 Cargo 以不同的模式运行，此时目标工件被放置在单独的目录中。有关更多细节，请参阅 <a href="../reference/build-cache.html">构建缓存</a>文档。</p></p></dd>


<dt class="option-term" id="option-cargo-rustdoc--r"><a class="option-anchor" href="#option-cargo-rustdoc--r"><code>-r</code></a></dt>
<dt class="option-term" id="option-cargo-rustdoc---release"><a class="option-anchor" href="#option-cargo-rustdoc---release"><code>--release</code></a></dt>
<dd class="option-desc"><p>使用 <code>release</code> 配置生成优化后的工件文档。 另请参阅 <code>--profile</code> 选项以按名称选择特定配置。</p>
</dd>


<dt class="option-term" id="option-cargo-rustdoc---profile"><a class="option-anchor" href="#option-cargo-rustdoc---profile"><code>--profile</code> <em>name</em></a></dt>
<dd class="option-desc"><p>使用给定的配置生成文档。 有关配置的更多详细信息，请参阅 <a href="../reference/profiles.html">参考手册</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-rustdoc---timings"><a class="option-anchor" href="#option-cargo-rustdoc---timings"><code>--timings</code></a></dt>
<dd class="option-desc"><p>输出每个编译所花费的时间，并随时间跟踪并发信息。</p> <p>在构建结束时，一个文件 <code>cargo-timing.html</code> 将被写入 <code>target/cargo-timings</code> 目录。如果您希望查看之前的运行结果，还会生成一个包含时间戳的文件名的额外报告。这些报告仅适合人类阅读，不提供机器可读取的计时数据。</p>
</dd>



</dl>

### 输出选项

<dl>
<dt class="option-term" id="option-cargo-rustdoc---target-dir"><a class="option-anchor" href="#option-cargo-rustdoc---target-dir"><code>--target-dir</code> <em>directory</em></a></dt>
<dd class="option-desc"><p>所有生成的艺术品和中间文件的目录。也可以通过 <code>CARGO_TARGET_DIR</code> 环境变量或 <code>build.target-dir</code> <a href="../reference/config.html">配置值</a>来指定。默认值为工作空间根目录下的 <code>target</code>。</p>
</dd>

</dl>

### 显示选项

<dl>
<dt class="option-term" id="option-cargo-rustdoc--v"><a class="option-anchor" href="#option-cargo-rustdoc--v"><code>-v</code></a></dt>
<dt class="option-term" id="option-cargo-rustdoc---verbose"><a class="option-anchor" href="#option-cargo-rustdoc---verbose"><code>--verbose</code></a></dt>
<dd class="option-desc"><p>使用详细输出。可以通过 <code>term.verbose</code> <a href="../reference/config.html">配置值</a>再次指定“非常详细”的输出，包含依赖警告和构建脚本输出等额外内容。</p>
</dd>


<dt class="option-term" id="option-cargo-rustdoc--q"><a class="option-anchor" href="#option-cargo-rustdoc--q"><code>-q</code></a></dt>
<dt class="option-term" id="option-cargo-rustdoc---quiet"><a class="option-anchor" href="#option-cargo-rustdoc---quiet"><code>--quiet</code></a></dt>
<dd class="option-desc"><p>不打印 cargo 日志消息。也可以通过 <code>term.quiet</code> <a href="../reference/config.html">配置值</a>来指定。</p>
</dd>


<dt class="option-term" id="option-cargo-rustdoc---color"><a class="option-anchor" href="#option-cargo-rustdoc---color"><code>--color</code> <em>when</em></a></dt>
<dd class="option-desc"><p>控制彩色输出的使用方式。有效值包括：</p> <ul> <li><code>auto</code>（默认）：自动检测终端是否支持颜色功能。</li> <li><code>always</code>：始终显示颜色。</li> <li><code>never</code>：从不显示颜色。</li> </ul> <p>也可以通过 <code>term.color</code> <a href="../reference/config.html">配置值</a>来指定。</p>
</dd>


<dt class="option-term" id="option-cargo-rustdoc---message-format"><a class="option-anchor" href="#option-cargo-rustdoc---message-format"><code>--message-format</code> <em>fmt</em></a></dt>
<dd class="option-desc"><p>诊断信息的输出格式。可以多次指定，由逗号分隔的值组成。有效值：</p> <ul> <li><code>human</code>（默认）：以人类可读的文本格式显示。与 <code>short</code> 和 <code>json</code> 冲突。</li> <li><code>short</code>：输出更简短的人类可读文本信息。与 <code>human</code> 和 <code>json</code> 冲突。</li> <li><code>json</code>：将 JSON 消息输出到标准输出中。更多详情请参阅 <a href="../reference/external-tools.html#json-messages">参考文档</a> 。与 <code>human</code> 和 <code>short</code> 冲突。</li> <li><code>json-diagnostic-short</code>：确保 JSON 消息的 <code>rendered</code> 字段包含 rustc 生成的“短”格式。不能与 <code>human</code> 或 <code>short</code> 一起使用。</li> <li><code>json-diagnostic-rendered-ansi</code>：确保 JSON 消息的 <code>rendered</code> 字段包含嵌入的 ANSI 颜色代码，以遵循 rustc 的默认颜色方案。不能与 <code>human</code> 或 <code>short</code> 一起使用。</li> <li><code>json-render-diagnostics</code>：指示 Cargo 在打印的 JSON 消息中不包含 rustc 诊断信息，而是由 Cargo 自身渲染来自 rustc 的 JSON 诊断信息。Cargo 自身的 JSON 诊断信息及来自 rustc 的其他诊断信息仍会输出。不能与 <code>human</code> 或 <code>short</code> 一起使用。</li> </ul> </dd> </dl> ### Manifest 选项 <dl> <dt class="option-term" id="option-cargo-rustdoc---manifest-path"><a class="option-anchor" href="#option-cargo-rustdoc---manifest-path"><code>--manifest-path</code> <em>路径</em></a></dt> <dd class="option-desc"><p><code>Cargo.toml</code> 文件的路径。默认情况下，Cargo 会在当前目录或任何父目录中查找 <code>Cargo.toml</code> 文件。</li></p>
</dd>


<dt class="option-term" id="option-cargo-rustdoc---ignore-rust-version"><a class="option-anchor" href="#option-cargo-rustdoc---ignore-rust-version"><code>--ignore-rust-version</code></a></dt>
<dd class="option-desc"><p>在包中忽略 <code>rust-version</code> 规范。</p>
</dd>


<dt class="option-term" id="option-cargo-rustdoc---locked"><a class="option-anchor" href="#option-cargo-rustdoc---locked"><code>--locked</code></a></dt>
<dd class="option-desc"><p>断言使用与原始生成 <code>Cargo.lock</code> 文件时相同的依赖项和版本。当出现以下任一情况时，Cargo 将以错误退出： <ul> <li>锁定文件缺失。</li> <li>由于不同的依赖解析导致 Cargo 尝试修改锁定文件。</li> </ul> 该选项可用于需要确定性构建的环境中，例如 CI 流水线。</p>
</dd>


<dt class="option-term" id="option-cargo-rustdoc---offline"><a class="option-anchor" href="#option-cargo-rustdoc---offline"><code>--offline</code></a></dt>
<dd class="option-desc"><p>防止 Cargo 出于任何原因访问网络。如果没有此标志，如果 Cargo 需要访问网络而网络不可用时，它将以错误退出。使用此标志后，Cargo 将尽可能在不联网的情况下继续运行。 请注意，这可能导致与在线模式不同的依赖解析。即使本地索引副本中显示有更新版本，Cargo 也将限制自己仅使用本地下载的包。在离线操作前，请参见 <a href="cargo-fetch.html">cargo-fetch(1)</a> 命令以下载依赖项。 也可以通过 <code>net.offline</code> <a href="../reference/config.html">配置值</a>来指定此选项。</p>
</dd>


<dt class="option-term" id="option-cargo-rustdoc---frozen"><a class="option-anchor" href="#option-cargo-rustdoc---frozen"><code>--frozen</code></a></dt>
<dd class="option-desc"><p>相当于同时指定 <code>--locked</code> 和 <code>--offline</code>。</p>
</dd>


</dl>

### 常见选项

<dl>

<dt class="option-term" id="option-cargo-rustdoc-+toolchain"><a class="option-anchor" href="#option-cargo-rustdoc-+toolchain"><code>+</code><em>toolchain</em></a></dt>
<dd class="option-desc"><p>如果 Cargo 通过 rustup 安装，且 <code>cargo</code> 的第一个参数以 <code>+</code> 开头，则会被解释为 rustup 工具链名称（如 <code>+stable</code> 或 <code>+nightly</code>）。 有关工具链覆盖机制的更多信息，请参阅 <a href="https://rust-lang.github.io/rustup/overrides.html">rustup 文档</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-rustdoc---config"><a class="option-anchor" href="#option-cargo-rustdoc---config"><code>--config</code> <em>KEY=VALUE</em> or <em>PATH</em></a></dt>
<dd class="option-desc"><p>覆盖 Cargo 配置值。参数应为 TOML 语法 <code>KEY=VALUE</code>，或作为额外配置文件的路径提供。此标志可以多次指定。 有关更多信息，请参阅 <a href="../reference/config.html#command-line-overrides">命令行覆盖部分</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-rustdoc--C"><a class="option-anchor" href="#option-cargo-rustdoc--C"><code>-C</code> <em>PATH</em></a></dt>
<dd class="option-desc"><p>在执行任何指定操作之前，更改当前工作目录。这会影响诸如 cargo 默认查找项目清单 (<code>Cargo.toml</code>)的位置，以及用于发现 <code>.cargo/config.toml</code> 的搜索目录等设置。此选项必须出现在命令名称之前，例如 <code>cargo -C path/to/my-project build</code>。</p> <p>此选项仅适用于 <a href="https://doc.rust-lang.org/book/appendix-07-nightly-rust.html">nightly 版本</a>，并且需要使用 <code>-Z unstable-options</code> 标志才能启用（参见 <a href="https://github.com/rust-lang/cargo/issues/10098">#10098</a>）。</p>
</dd>


<dt class="option-term" id="option-cargo-rustdoc--h"><a class="option-anchor" href="#option-cargo-rustdoc--h"><code>-h</code></a></dt>
<dt class="option-term" id="option-cargo-rustdoc---help"><a class="option-anchor" href="#option-cargo-rustdoc---help"><code>--help</code></a></dt>
<dd class="option-desc"><p>打印帮助信息。</p>
</dd>


<dt class="option-term" id="option-cargo-rustdoc--Z"><a class="option-anchor" href="#option-cargo-rustdoc--Z"><code>-Z</code> <em>flag</em></a></dt>
<dd class="option-desc"><p>Cargo 的不稳定（仅 nightly 版本）标志。运行 <code>cargo -Z help</code> 以获取详细信息。</p>
</dd>


</dl>

### 其他选项

<dl>
<dt class="option-term" id="option-cargo-rustdoc--j"><a class="option-anchor" href="#option-cargo-rustdoc--j"><code>-j</code> <em>N</em></a></dt>
<dt class="option-term" id="option-cargo-rustdoc---jobs"><a class="option-anchor" href="#option-cargo-rustdoc---jobs"><code>--jobs</code> <em>N</em></a></dt>
<dd class="option-desc"><p>要运行的并行任务数量。也可以通过 <code>build.jobs</code> <a href="../reference/config.html">配置值</a>指定。默认值为逻辑 CPU 数。如果为负数，则将最大并行任务数设置为逻辑 CPU 数加上提供的数值。如果提供字符串 <code>default</code>，则将其重置为默认值。不应为 0。</p>
</dd>

<dt class="option-term" id="option-cargo-rustdoc---keep-going"><a class="option-anchor" href="#option-cargo-rustdoc---keep-going"><code>--keep-going</code></a></dt>
<dd class="option-desc"><p>尽可能多地构建依赖图中所有的包，而不是在第一个构建失败的包上终止构建。</p> <p>例如，如果当前包依赖于 <code>fails</code> 和 <code>works</code> 两个依赖项，其中一个构建失败，<code>cargo rustdoc -j1</code> 可能能够或无法构建成功的那个（取决于 Cargo 首先选择运行哪个构建），而 <code>cargo rustdoc -j1 --keep-going</code> 则一定会同时运行两个构建，即使第一个运行的失败。</p>
</dd>

<dt class="option-term" id="option-cargo-rustdoc---output-format"><a class="option-anchor" href="#option-cargo-rustdoc---output-format"><code>--output-format</code></a></dt>
<dd class="option-desc"><p>文档输出的类型。有效值：</p> <ul> <li><code>html</code>（默认）：以 HTML 格式输出文档。</li> <li><code>json</code>：以 <a href="https://doc.rust-lang.org/nightly/nightly-rustc/rustdoc_json_types">实验性 JSON 格式</a>输出文档。</li> </ul> <p>此选项仅适用于 <a href="https://doc.rust-lang.org/book/appendix-07-nightly-rust.html">nightly 频道</p>，且需要添加 <code>-Z unstable-options</code> 标志才能启用。
</dd>

</dl>

## 环境

有关 Cargo 读取的环境变量详情，请参见 [参考手册](../reference/environment-variables.html)。

## 退出状态

* `0`: Cargo 成功执行。
* `101`: Cargo 未能完成执行。

## 示例

1. 使用来自指定文件的自定义 CSS 构建文档：

       cargo rustdoc --lib -- --extend-css extra.css

## 另请参阅 [cargo(1)](cargo.html)、[cargo-doc(1)](cargo_doc.html)、[rustdoc(1)](https://doc.rust-lang.org/rustdoc/index.html)
