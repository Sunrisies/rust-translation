# cargo-rustc(1)
## 名称

cargo-rustc —— 编译当前包，并向编译器传递额外选项

## 概述

`cargo rustc` [_options_] [`--` _args_]

## 描述

所指定的目标（或通过 `-p` 指定的包）及其所有依赖项将被编译。所有的 _args_ 都会被传递给最终的编译器调用，而不是任何依赖项。请注意，编译器仍然会无条件接收如 `-L`、`--extern` 和 `--crate-type` 等参数，而指定的 _args_ 仅会被添加到编译器调用中。

有关 rustc 标志的文档，请参见 <https://doc.rust-lang.org/rustc/index.html>。

此命令要求当提供额外参数时只编译一个目标。如果当前包有多个目标可用，则必须使用 `--lib`、`--bin` 等过滤器来选择要编译的目标。

若需将标志传递给 Cargo 生成的所有编译器进程，请使用 `RUSTFLAGS` [环境变量](../reference/environment-variables.html)或 `build.rustflags` [配置值](../reference/config.html)。

## 选项

### 包选择

默认情况下，会选择当前工作目录中的包。可以使用 `-p` 标志在工作空间中选择不同的包。

<dl>

<dt class="option-term" id="option-cargo-rustc--p"><a class="option-anchor" href="#option-cargo-rustc--p"><code>-p</code> <em>spec</em></a></dt>
<dt class="option-term" id="option-cargo-rustc---package"><a class="option-anchor" href="#option-cargo-rustc---package"><code>--package</code> <em>spec</em></a></dt>
<dd class="option-desc"><p>要构建的包。有关 SPEC 格式，请参阅 <a href="cargo-pkgid.html">cargo-pkgid(1)</a>。</p>
</dd>


</dl>

### 目标选择

当未提供目标选择选项时，`cargo rustc` 将编译所选包的所有二进制和库目标。

如果选择了集成测试或基准测试进行构建，则自动生成二进制目标。这允许集成测试运行二进制文件以验证其行为。`CARGO_BIN_EXE_<name>` [环境变量](../reference/environment-variables.html#environment-variables-cargo-sets-for-crates)在集成测试构建和运行时被设置，以便使用 [`env` 宏](https://doc.rust-lang.org/std/宏.env.html)或 [`var` 函数](https://doc.rust-lang.org/std/env/fn.var.html)来定位可执行文件。

仅传递目标选择标志即可构建指定的目标。

请注意，`--bin`、`--example`、`--test` 和 `--bench` 标志也支持常见的 Unix glob 模式，如 `*`、`?` 和 `[]`。然而，为了避免 Shell 在 Cargo 处理之前意外展开这些 glob 模式，您必须在每个 glob 模式周围使用单引号或双引号。

<dl>

<dt class="option-term" id="option-cargo-rustc---lib"><a class="option-anchor" href="#option-cargo-rustc---lib"><code>--lib</code></a></dt>
<dd class="option-desc"><p>构建包的库文件。</p>
</dd>


<dt class="option-term" id="option-cargo-rustc---bin"><a class="option-anchor" href="#option-cargo-rustc---bin"><code>--bin</code> <em>name</em>…</a></dt>
<dd class="option-desc"><p>构建指定的二进制文件。此标志可以多次指定，并支持常见的 Unix glob 模式。</p>
</dd>


<dt class="option-term" id="option-cargo-rustc---bins"><a class="option-anchor" href="#option-cargo-rustc---bins"><code>--bins</code></a></dt>
<dd class="option-desc"><p>构建所有二进制目标。</p>
</dd>


<dt class="option-term" id="option-cargo-rustc---example"><a class="option-anchor" href="#option-cargo-rustc---example"><code>--example</code> <em>name</em>…</a></dt>
<dd class="option-desc"><p>构建指定的示例。此标志可以多次指定，并支持常见的 Unix glob 模式。</p>
</dd>


<dt class="option-term" id="option-cargo-rustc---examples"><a class="option-anchor" href="#option-cargo-rustc---examples"><code>--examples</code></a></dt>
<dd class="option-desc"><p>构建所有示例目标。</p>
</dd>


<dt class="option-term" id="option-cargo-rustc---test"><a class="option-anchor" href="#option-cargo-rustc---test"><code>--test</code> <em>name</em>…</a></dt>
<dd class="option-desc"><p>构建指定的集成测试。此标志可以多次指定，并支持常见的 Unix glob 模式。</p>
</dd>


<dt class="option-term" id="option-cargo-rustc---tests"><a class="option-anchor" href="#option-cargo-rustc---tests"><code>--tests</code></a></dt>
<dd class="option-desc"><p>构建所有设置了 <code>test = true</code> 清单标志的目标。默认情况下，这包括作为单元测试和集成测试构建的库文件及二进制文件。请注意，这也会构建任何必需的依赖项，因此 lib 目标可能会被构建两次（一次作为单元测试，一次作为二进制文件、集成测试等的依赖）。可以通过在目标的清单设置中设置 <code>test</code> 标志来启用或禁用目标。</p>
</dd>


<dt class="option-term" id="option-cargo-rustc---bench"><a class="option-anchor" href="#option-cargo-rustc---bench"><code>--bench</code> <em>name</em>…</a></dt>
<dd class="option-desc"><p>构建指定的基准测试。此标志可以多次指定，并支持常见的 Unix glob 模式。</p>
</dd>


<dt class="option-term" id="option-cargo-rustc---benches"><a class="option-anchor" href="#option-cargo-rustc---benches"><code>--benches</code></a></dt>
<dd class="option-desc"><p>构建所有设置了 <code>bench = true</code> 清单标志的目标。默认情况下，这包括作为基准测试和 bench 目标构建的库文件及二进制文件。请注意，这也会构建任何必需的依赖项，因此 lib 目标可能会被构建两次（一次作为基准测试，一次作为二进制文件、基准测试等的依赖）。可以通过在目标的清单设置中设置 <code>bench</code> 标志来启用或禁用目标。</p>
</dd>


<dt class="option-term" id="option-cargo-rustc---all-targets"><a class="option-anchor" href="#option-cargo-rustc---all-targets"><code>--all-targets</code></a></dt>
<dd class="option-desc"><p>构建所有目标。这相当于指定 <code>--lib --bins --tests --benches --examples</code>。</p>
</dd>


</dl>

### 功能选择

功能标志允许您控制哪些功能被启用。当没有指定功能选项时，所有选中的包都将激活 `default` 功能。

有关更多细节，请参阅 [功能文档](../reference/features.html#command-line-特性-options)。

<dl>

<dt class="option-term" id="option-cargo-rustc--F"><a class="option-anchor" href="#option-cargo-rustc--F"><code>-F</code> <em>features</em></a></dt>
<dt class="option-term" id="option-cargo-rustc---features"><a class="option-anchor" href="#option-cargo-rustc---features"><code>--features</code> <em>features</em></a></dt>
<dd class="option-desc"><p>以空格或逗号分隔的要激活的功能列表。工作区成员的功能可以通过 <code>package-name/feature-name</code> 语法来激活。此标志可以多次指定，从而激活所有指定的功能。</p>
</dd>


<dt class="option-term" id="option-cargo-rustc---all-features"><a class="option-anchor" href="#option-cargo-rustc---all-features"><code>--all-features</code></a></dt>
<dd class="option-desc"><p>激活所有选定包的所有可用功能。</p>
</dd>


<dt class="option-term" id="option-cargo-rustc---no-default-features"><a class="option-anchor" href="#option-cargo-rustc---no-default-features"><code>--no-default-features</code></a></dt>
<dd class="option-desc"><p>不激活选定包的 <code>default</code> 功能。</p>
</dd>


</dl>

### 编译选项

<dl>

<dt class="option-term" id="option-cargo-rustc---target"><a class="option-anchor" href="#option-cargo-rustc---target"><code>--target</code> <em>tuple</em></a></dt>
<dd class="option-desc"><p>针对指定的目标架构进行构建。可以多次指定此标志，默认值为主机架构。该元组的通用格式为 <code>&lt;arch&gt;&lt;sub&gt;-&lt;vendor&gt;-&lt;sys&gt;-&lt;abi&gt;</code>。</p> <p>可能的值：</p> <ul> <li>在 <code>rustc --print target-list</code> 中列出的任何支持的目标。</li> <li><code>"host-tuple"</code>，系统会内部替换为主机目标。如果你正在交叉编译某些库，且不想将主机机器作为目标指定（例如，在多个主机可使用的共享项目中使用的 <code>xtask</code>），则此选项非常有用。</li> <li>指向自定义目标规范的路径。有关更多信息，请参阅 <a href="../../rustc/targets/custom.html#custom-target-lookup-path">自定义目标查找路径</a>。</li> </ul> <p>也可以通过 <code>build.target</code> <a href="../reference/config.html">配置值</a>来指定此标志。</p> <p>请注意，指定此标志会使 Cargo 以不同的模式运行，此时目标产物会被存放在单独的目录中。有关更多细节，请参阅 <a href="../reference/build-cache.html">构建缓存</a>文档。</p>
</dd>


<dt class="option-term" id="option-cargo-rustc--r"><a class="option-anchor" href="#option-cargo-rustc--r"><code>-r</code></a></dt>
<dt class="option-term" id="option-cargo-rustc---release"><a class="option-anchor" href="#option-cargo-rustc---release"><code>--release</code></a></dt>
<dd class="option-desc"><p>使用 <code>release</code> 配置生成优化后的产物。 另请参阅 <code>--profile</code> 选项以按名称选择特定配置。</p>
</dd>


<dt class="option-term" id="option-cargo-rustc---profile"><a class="option-anchor" href="#option-cargo-rustc---profile"><code>--profile</code> <em>name</em></a></dt>
<dd class="option-desc"><p>使用给定的配置进行构建。</p> <p><code>rustc</code> 子命令对以下命名配置采用特殊行为：</p> <ul> <li><code>check</code> — 以与<a href="cargo-check.html">cargo-check(1)</a>命令使用<code>dev</code>配置的方式相同进行构建。</li> <li><code>test</code> — 以与<a href="cargo-test.html">cargo-test(1)</a>命令相同的方式进行构建，启用测试模式，从而运行测试并启用<code>test</code>配置选项。更多详情请参见<a href="https://doc.rust-lang.org/rustc/tests/index.html">rustc 测试</a>。</li> <li><code>bench</code> — 以与<a href="cargo-bench.html">cargo-bench(1)</a>命令相同的方式进行构建，类似于<code>test</code>配置。</li> </ul> <p>有关配置的更多详情，请参见<a href="../reference/profiles.html">参考文档</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-rustc---timings"><a class="option-anchor" href="#option-cargo-rustc---timings"><code>--timings</code></a></dt>
<dd class="option-desc"><p>输出信息显示每次编译所需的时间，并随时间跟踪并发情况。</p> <p>在构建结束时，文件<code>cargo-timing.html</code>将被写入<code>target/cargo-timings</code>目录。如果您想查看之前的运行结果，还会生成带有时间戳的文件名的额外报告。这些报告仅适合人类阅读，不提供机器可读取的计时数据。</p>
</dd>



<dt class="option-term" id="option-cargo-rustc---crate-type"><a class="option-anchor" href="#option-cargo-rustc---crate-type"><code>--crate-type</code> <em>crate-type</em></a></dt>
<dd class="option-desc"><p>为给定的 crate 类型进行构建。此标志接受一个由逗号分隔的1个或多个 crate 类型列表，允许的值与配置 Cargo 目标时的<code>crate-type</code>字段相同。可能的取值请参见<a href="../reference/cargo-targets.html#the-crate-type-field"><code>crate-type</code>字段</a>。</p> <p>如果清单中包含列表且提供了<code>--crate-type</code>，命令行参数值将覆盖清单中的内容。</p> <p>此标志仅在构建<code>lib</code>或<code>example</code>库目标时有效。</p>
</dd>


</dl>

### 输出选项

<dl>
<dt class="option-term" id="option-cargo-rustc---target-dir"><a class="option-anchor" href="#option-cargo-rustc---target-dir"><code>--target-dir</code> <em>directory</em></a></dt>
<dd class="option-desc"><p>用于存储所有生成产物和中间文件的目录。也可以通过 <code>CARGO_TARGET_DIR</code> 环境变量或 <code>build.target-dir</code> <a href="../reference/config.html">配置值</a>来指定该路径。默认值为工作空间根目录下的 <code>target</code>。</p>
</dd>

</dl>

### 显示选项

<dl>

<dt class="option-term" id="option-cargo-rustc--v"><a class="option-anchor" href="#option-cargo-rustc--v"><code>-v</code></a></dt>
<dt class="option-term" id="option-cargo-rustc---verbose"><a class="option-anchor" href="#option-cargo-rustc---verbose"><code>--verbose</code></a></dt>
<dd class="option-desc"><p>使用详细输出。可以通过设置两次来获得“非常详细”的输出，包含额外的内容如依赖警告和构建脚本输出。也可以通过 <code>term.verbose</code> <a href="../reference/config.html">配置值</a>来指定。</p>
</dd>


<dt class="option-term" id="option-cargo-rustc--q"><a class="option-anchor" href="#option-cargo-rustc--q"><code>-q</code></a></dt>
<dt class="option-term" id="option-cargo-rustc---quiet"><a class="option-anchor" href="#option-cargo-rustc---quiet"><code>--quiet</code></a></dt>
<dd class="option-desc"><p>不打印 cargo 日志消息。也可以通过 <code>term.quiet</code> <a href="../reference/config.html">配置值</a>来指定。</p>
</dd>


<dt class="option-term" id="option-cargo-rustc---color"><a class="option-anchor" href="#option-cargo-rustc---color"><code>--color</code> <em>when</em></a></dt>
<dd class="option-desc"><p>控制是否使用彩色输出。有效值包括： <ul> <li><code>auto</code>（默认）：自动检测终端是否支持颜色显示。</li> <li><code>always</code>：始终显示颜色。</li> <li><code>never</code>：从不显示颜色。</li> </ul> <p>也可以通过 <code>term.color</code> <a href="../reference/config.html">配置值</a>来指定。</p></p></dd>


<dt class="option-term" id="option-cargo-rustc---message-format"><a class="option-anchor" href="#option-cargo-rustc---message-format"><code>--message-format</code> <em>fmt</em></a></dt>
<dd class="option-desc"><p>诊断信息的输出格式。可以多次指定，由逗号分隔的值组成。有效值：</p> <ul> <li><code>human</code>（默认）：以人类可读的文本格式显示。与 <code>short</code> 和 <code>json</code> 冲突。</li> <li><code>short</code>：输出更简短、人类可读的消息。与 <code>human</code> 和 <code>json</code> 冲突。</li> <li><code>json</code>：将 JSON 消息输出到标准输出中。更多详情请参阅 <a href="../reference/external-tools.html#json-messages">参考文档</a>。与 <code>human</code> 和 <code>short</code> 冲突。</li> <li><code>json-diagnostic-short</code>：确保 JSON 消息的 <code>rendered</code> 字段包含 rustc 生成的“短”格式。不能与 <code>human</code> 或 <code>short</code> 一起使用。</li> <li><code>json-diagnostic-rendered-ansi</code>：确保 JSON 消息的 <code>rendered</code> 字段包含嵌入的 ANSI 颜色代码，以遵循 rustc 默认的配色方案。不能与 <code>human</code> 或 <code>short</code> 一起使用。</li> <li><code>json-render-diagnostics</code>：指示 Cargo 在打印的 JSON 消息中不包含 rustc 诊断信息，而是由 Cargo 自身渲染来自 rustc 的 JSON 诊断信息。Cargo 自身的 JSON 诊断信息及来自 rustc 的其他诊断信息仍会被输出。不能与 <code>human</code> 或 <code>short</code> 一起使用。</li> </ul> </dd> </dl> ### Manifest 选项 <dl> <dt class="option-term" id="option-cargo-rustc---manifest-path"><a class="option-anchor" href="#option-cargo-rustc---manifest-path"><code>--manifest-path</code> <em>路径</em></a></dt> <dd class="option-desc"><p><code>Cargo.toml</code> 文件的路径。默认情况下，Cargo 会在当前目录或任何父目录中查找 <code>Cargo.toml</code> 文件。</li></p>
</dd>


<dt class="option-term" id="option-cargo-rustc---ignore-rust-version"><a class="option-anchor" href="#option-cargo-rustc---ignore-rust-version"><code>--ignore-rust-version</code></a></dt>
<dd class="option-desc"><p>在包中忽略 <code>rust-version</code> 规范。</p>
</dd>


<dt class="option-term" id="option-cargo-rustc---locked"><a class="option-anchor" href="#option-cargo-rustc---locked"><code>--locked</code></a></dt>
<dd class="option-desc"><p>断言使用与原始生成 <code>Cargo.lock</code> 文件时相同的依赖项和版本。当出现以下任一情况时，Cargo 将以错误退出： <ul> <li>锁文件缺失。</li> <li>由于不同的依赖解析导致 Cargo 尝试修改锁文件。</li> </ul> 该选项可用于需要确定性构建的环境中，例如 CI 流水线。</p>
</dd>


<dt class="option-term" id="option-cargo-rustc---offline"><a class="option-anchor" href="#option-cargo-rustc---offline"><code>--offline</code></a></dt>
<dd class="option-desc"><p>防止 Cargo 出于任何原因访问网络。如果没有此标志，如果 Cargo 需要访问网络而网络不可用时，它将以错误退出。使用此标志后，Cargo 将尽可能在不连接网络的情况下继续运行。 请注意，这可能会导致与在线模式不同的依赖解析。即使本地索引副本中显示有更新版本，Cargo 也将限制自己仅使用本地下载的包。在离线操作前，请参考 <a href="cargo-fetch.html">cargo-fetch(1)</a> 命令来下载依赖项。 也可以通过 <code>net.offline</code> <a href="../reference/config.html">配置值</a>指定此选项。</p>
</dd>


<dt class="option-term" id="option-cargo-rustc---frozen"><a class="option-anchor" href="#option-cargo-rustc---frozen"><code>--frozen</code></a></dt>
<dd class="option-desc"><p>相当于同时指定 <code>--locked</code> 和 <code>--offline</code>。</p>
</dd>



</dl>

### 常见选项

<dl>

<dt class="option-term" id="option-cargo-rustc-+toolchain"><a class="option-anchor" href="#option-cargo-rustc-+toolchain"><code>+</code><em>toolchain</em></a></dt>
<dd class="option-desc"><p>如果 Cargo 是通过 rustup 安装的，且 <code>cargo</code> 的第一个参数以 <code>+</code> 开头，则会被解释为 rustup 工具链名称（如 <code>+stable</code> 或 <code>+nightly</code>）。 有关工具链覆盖机制的更多信息，请参阅 <a href="https://rust-lang.github.io/rustup/overrides.html">rustup 文档</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-rustc---config"><a class="option-anchor" href="#option-cargo-rustc---config"><code>--config</code> <em>KEY=VALUE</em> or <em>PATH</em></a></dt>
<dd class="option-desc"><p>覆盖 Cargo 配置值。参数应为 TOML 语法 <code>KEY=VALUE</code>，或作为额外配置文件的路径提供。此标志可以多次指定。有关更多信息，请参阅 <a href="../reference/config.html#command-line-overrides">命令行覆盖部分</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-rustc--C"><a class="option-anchor" href="#option-cargo-rustc--C"><code>-C</code> <em>PATH</em></a></dt>
<dd class="option-desc"><p>在执行任何指定操作之前，更改当前工作目录。这会影响诸如 cargo 默认查找项目清单 (<code>Cargo.toml</code>)的位置，以及用于发现 <code>.cargo/config.toml</code> 的搜索目录等设置。此选项必须出现在命令名称之前，例如 <code>cargo -C path/to/my-project build</code>。</p> <p>此选项仅适用于 <a href="https://doc.rust-lang.org/book/appendix-07-nightly-rust.html">nightly 版本</a>，并且需要使用 <code>-Z unstable-options</code> 标志才能启用（参见 <a href="https://github.com/rust-lang/cargo/issues/10098">#10098</a>）。</p>
</dd>


<dt class="option-term" id="option-cargo-rustc--h"><a class="option-anchor" href="#option-cargo-rustc--h"><code>-h</code></a></dt>
<dt class="option-term" id="option-cargo-rustc---help"><a class="option-anchor" href="#option-cargo-rustc---help"><code>--help</code></a></dt>
<dd class="option-desc"><p>打印帮助信息。</p>
</dd>


<dt class="option-term" id="option-cargo-rustc--Z"><a class="option-anchor" href="#option-cargo-rustc--Z"><code>-Z</code> <em>flag</em></a></dt>
<dd class="option-desc"><p>Cargo 的不稳定（仅 nightly 版本）标志。运行 <code>cargo -Z help</code> 获取详细信息。</p>
</dd>


</dl>

### 其他选项

<dl>
<dt class="option-term" id="option-cargo-rustc--j"><a class="option-anchor" href="#option-cargo-rustc--j"><code>-j</code> <em>N</em></a></dt>
<dt class="option-term" id="option-cargo-rustc---jobs"><a class="option-anchor" href="#option-cargo-rustc---jobs"><code>--jobs</code> <em>N</em></a></dt>
<dd class="option-desc"><p>要运行的并行任务数量。也可以通过 <code>build.jobs</code> <a href="../reference/config.html">配置值</a>指定。默认值为逻辑 CPU 数。如果为负数，则将最大并行任务数设置为逻辑 CPU 数加上提供的数值。如果提供字符串 <code>default</code>，则恢复为默认值。不应为 0。</p>
</dd>

<dt class="option-term" id="option-cargo-rustc---keep-going"><a class="option-anchor" href="#option-cargo-rustc---keep-going"><code>--keep-going</code></a></dt>
<dd class="option-desc"><p>尽可能多地构建依赖图中所有的包，而不是在第一个构建失败的包上终止构建。</p> <p>例如，如果当前包依赖于 <code>fails</code> 和 <code>works</code> 两个依赖项，其中一个构建失败，<code>cargo rustc -j1</code> 可能能够或无法构建成功的那个（取决于 Cargo 选择先运行哪个），而 <code>cargo rustc -j1 --keep-going</code> 则一定会同时运行两个构建，即使第一个运行的失败。</p>
</dd>

<dt class="option-term" id="option-cargo-rustc---future-incompat-report"><a class="option-anchor" href="#option-cargo-rustc---future-incompat-report"><code>--future-incompat-report</code></a></dt>
<dd class="option-desc"><p>对于此命令执行过程中产生的任何不兼容警告，显示未来不兼容性报告。</p> <p>请参阅 <a href="cargo-report.html">cargo-report(1)</a>。</p>
</dd>

</dl>

## 环境

有关 Cargo 读取的环境变量详情，请参阅 [参考手册](../reference/environment-variables.html)。

## 退出状态

* `0`: Cargo 成功执行。
* `101`: Cargo 未能完成。

## 示例

1. 检查您的包（不包括依赖项）是否使用不安全代码：

       cargo rustc --lib -- -D 不安全-code

2. 在夜间编译器上尝试实验性标志，例如此命令可以打印所有类型的尺寸：

       cargo rustc --lib -- -Z print-type-sizes

3. 通过命令行选项覆盖 Cargo.toml 中的 `crate-type` 字段：

       cargo rustc --lib --crate-type lib,cdylib

## 另请参阅 [cargo(1)](cargo.html)、[cargo-build(1)](cargo-build.html)、[rustc(1)](https://doc.rust-lang.org/rustc/index.html)
