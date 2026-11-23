# cargo-bench(1)
## 名称

cargo-bench --- 执行包的基准测试

## 使用说明

`cargo bench` [_选项_] [_benchmark名_] [`--` _测试选项_]

## 描述

编译并运行基准测试。

`benchname_` 参数以及位于两个减号 (`--`) 之后的所有参数都会被传递给基准测试二进制文件，从而传递给 `_libtest`（Rustc 内置的单元测试和微基准测试框架）。如果您向 Cargo 和二进制文件传递参数，其中 `--` 之后的参数将传递给二进制文件，而 `--` 之前的参数将传递给 Cargo。关于 `_libtest` 参数的详细信息，请查看 `cargo bench -- --help` 的输出，并查阅 Rustc 书籍中有关测试工作原理的章节。
<https://doc.rust-lang.org/rustc/tests/index.html>.

例如，此命令仅运行名为 `foo` 的基准测试（并跳过其他类似名称的测试，如 `foobar`）：

    cargo bench -- foo --exact

使用 `--test` 选项对 `rustc` 进行构建，该选项通过将您的代码与 `_libtest` 链接来生成特殊的可执行文件。此可执行文件会自动运行所有带有 `#[bench]` 属性的函数。Cargo 会传递 `--bench` 标志给测试框架，以指示其仅运行基准测试，无论该框架是 `_libtest` 还是自定义框架。

通过在目标清单设置中设置 `harness = false`，可以禁用 `_libtest` 框架，此时您的代码需要提供自己的 `main` 函数来处理基准测试的执行。

> **注意**： [`#[bench]` 属性](https://doc.rust-lang.org/nightly/unstable-book/library-features/test.html) 目前不稳定，仅可在 [夜间频道](https://doc.rust-lang.org/book/appendix-07-nightly-rust.html) 中使用。在 [crates.io](https://crates.io/keywords/benchmark) 上有一些名为 `benchmark` 的包，可能有助于在稳定频道上运行基准测试，例如 [Criterion](https://crates.io/crates/criterion)。

默认情况下，`cargo bench` 使用 [`bench` 配置]，该配置会启用优化并禁用调试信息。如果您需要调试基准测试，可以使用 `--profile=debug` 命令行选项切换到调试配置。然后可以在调试器中运行启用了调试的基准测试。


### 基准测试的工作目录

每个基准测试的工作目录都设置为该基准测试所属包的根目录。将基准测试的工作目录设置为包的根目录后，无论 `cargo bench` 从何处执行，基准测试都能使用相对路径可靠地访问包中的文件。

## 选项

### 基准测试选项

<dl>

<dt class="option-term" id="option-cargo-bench---no-run"><a class="option-anchor" href="#option-cargo-bench---no-run"><code>--no-run</code></a></dt>
<dd class="option-desc"><p>进行编译，但不要运行基准测试。</p>
</dd>


<dt class="option-term" id="option-cargo-bench---no-fail-fast"><a class="option-anchor" href="#option-cargo-bench---no-fail-fast"><code>--no-fail-fast</code></a></dt>
<dd class="option-desc"><p>无论是否失败都运行所有基准测试。如果没有此标志，Cargo会在第一个可执行程序失败后退出。Rust测试框架会完全执行可执行程序中的所有基准测试，此标志仅适用于整个可执行程序。</p>
</dd>


</dl>

### 包选择

默认情况下，如果没有提供包选择选项，所选的包将依赖于选定的清单文件（如果未指定 `--manifest-path`，则基于当前工作目录）。如果清单是工作空间的根目录，则将选择工作空间的默认成员；否则仅选择由清单定义的包。

工作空间的默认成员可以通过根清单中的 `workspace.default-members` 键显式设置。如果未设置此值，虚拟工作空间将包含所有工作空间成员（相当于传递 `--workspace` 选项），而非虚拟工作空间则仅包含根 crate 本身。

<dl>

<dt class="option-term" id="option-cargo-bench--p"><a class="option-anchor" href="#option-cargo-bench--p"><code>-p</code> <em>spec</em>…</a></dt>
<dt class="option-term" id="option-cargo-bench---package"><a class="option-anchor" href="#option-cargo-bench---package"><code>--package</code> <em>spec</em>…</a></dt>
<dd class="option-desc"><p>只对指定的包进行基准测试。有关 SPEC 格式，请参阅 <a href="cargo-pkgid.html">cargo-pkgid(1)</a>。此标志可以多次指定，并支持常见的 Unix glob 模式，如 <code>*</code>、<code>?</code> 和 <code>[]</code>。但是，为了避免 Shell 在 Cargo 处理之前意外展开 glob 模式，您必须在每个模式下使用单引号或双引号。</p>
</dd>


<dt class="option-term" id="option-cargo-bench---workspace"><a class="option-anchor" href="#option-cargo-bench---workspace"><code>--workspace</code></a></dt>
<dd class="option-desc"><p>对工作空间中的所有成员进行基准测试。</p>
</dd>


<dt class="option-term" id="option-cargo-bench---all"><a class="option-anchor" href="#option-cargo-bench---all"><code>--all</code></a></dt>
<dd class="option-desc"><p><code>--workspace</code> 的已弃用别名。</p>
</dd>


<dt class="option-term" id="option-cargo-bench---exclude"><a class="option-anchor" href="#option-cargo-bench---exclude"><code>--exclude</code> <em>SPEC</em>…</a></dt>
<dd class="option-desc"><p>排除指定的包。必须与 <code>--workspace</code> 标志一起使用。此标志可以多次指定，并支持常见的 Unix glob 模式，如 <code>*</code>、<code>?</code> 和 <code>[]</code>。但是，为了避免 Shell 在 Cargo 处理之前意外展开 glob 模式，您必须在每个模式下使用单引号或双引号。</p>
</dd>


</dl>

### 目标选择

当没有指定目标选择选项时，`cargo bench` 将构建所选包的以下目标：

- lib --- 用于与二进制文件和基准测试链接
- bins（仅当基准测试目标已构建且所需功能可用时）
- 作为基准测试的 lib
- 作为基准测试的 bins
- 基准测试目标

可以通过在清单设置中针对目标设置 `bench` 标志来更改默认行为。将设置示例设置为 `bench = true` 将构建并运行该示例作为基准测试，用 libtest harness 替换示例的 `main` 函数。

将目标设置为 `bench = false` 会默认停止对其进行基准测试。以名称作为目标的目标选择选项（例如 `--example foo`）会忽略 `bench` 标志，并始终对给定目标进行基准测试。

有关针对每个目标的设置的更多信息，请参阅 [配置目标](../reference/cargo-targets.html#configuring-a-目标)。

如果选择了集成测试或用于基准测试的测试，二进制目标将自动构建。这样，集成测试可以执行该二进制文件以验证和测试其行为。`CARGO_BIN_EXE_<name>` [环境变量](../reference/environment-variables.html#environment-variables-cargo-sets-for-crates) 在集成测试构建和运行时设置，以便使用 [`env` 宏](https://doc.rust-lang.org/std/宏.env.html) 或 [`var` 函数](https://doc.rust-lang.org/std/env/fn.var.html)来定位可执行文件。

传递目标选择标志仅对指定的目标进行基准测试。

请注意，`--bin`、`--example`、`--test` 和 `--bench` 标志也支持常见的 Unix glob 模式，如 `*`、`?` 和 `[]`。然而，为了避免 Shell 在 Cargo 处理之前意外展开 glob 模式，您必须在每个 glob 模式周围使用单引号或双引号。

<dl>

<dt class="option-term" id="option-cargo-bench---lib"><a class="option-anchor" href="#option-cargo-bench---lib"><code>--lib</code></a></dt>
<dd class="option-desc"><p>对包的库进行基准测试。</p>
</dd>


<dt class="option-term" id="option-cargo-bench---bin"><a class="option-anchor" href="#option-cargo-bench---bin"><code>--bin</code> <em>name</em>…</a></dt>
<dd class="option-desc"><p>对指定的二进制文件进行基准测试。此标志可以多次指定，并支持常见的 Unix glob 模式。</p>
</dd>


<dt class="option-term" id="option-cargo-bench---bins"><a class="option-anchor" href="#option-cargo-bench---bins"><code>--bins</code></a></dt>
<dd class="option-desc"><p>对所有二进制目标进行基准测试。</p>
</dd>


<dt class="option-term" id="option-cargo-bench---example"><a class="option-anchor" href="#option-cargo-bench---example"><code>--example</code> <em>name</em>…</a></dt>
<dd class="option-desc"><p>对指定的示例进行基准测试。此标志可以多次指定，并支持常见的 Unix glob 模式。</p>
</dd>


<dt class="option-term" id="option-cargo-bench---examples"><a class="option-anchor" href="#option-cargo-bench---examples"><code>--examples</code></a></dt>
<dd class="option-desc"><p>对所有示例目标进行基准测试。</p>
</dd>


<dt class="option-term" id="option-cargo-bench---test"><a class="option-anchor" href="#option-cargo-bench---test"><code>--test</code> <em>name</em>…</a></dt>
<dd class="option-desc"><p>对指定的集成测试进行基准测试。此标志可以多次指定，并支持常见的 Unix glob 模式。</p>
</dd>


<dt class="option-term" id="option-cargo-bench---tests"><a class="option-anchor" href="#option-cargo-bench---tests"><code>--tests</code></a></dt>
<dd class="option-desc"><p>对设置了 <code>test = true</code> manifest 标志的所有目标进行基准测试。默认情况下，这包括作为单元测试和集成测试构建的库和二进制文件。请注意，这还会构建所有必要的依赖项，因此 lib 目标可能会被构建两次（一次作为 unittest，一次作为二进制文件、集成测试等的依赖）。可以通过在目标的清单设置中设置 <code>test</code> 标志来启用或禁用目标。</p>
</dd>


<dt class="option-term" id="option-cargo-bench---bench"><a class="option-anchor" href="#option-cargo-bench---bench"><code>--bench</code> <em>name</em>…</a></dt>
<dd class="option-desc"><p>对指定的基准进行测试。此标志可以多次指定，并支持常见的 Unix glob 模式。</p>
</dd>


<dt class="option-term" id="option-cargo-bench---benches"><a class="option-anchor" href="#option-cargo-bench---benches"><code>--benches</code></a></dt>
<dd class="option-desc"><p>对所有设置了 <code>bench = true</code> manifest 标志的目标进行测试。默认情况下，这包括作为基准测试的库和二进制文件以及 bench 目标。请注意，这也会构建所有必要的依赖项，因此 lib 目标可能会被构建两次（一次作为基准测试，一次作为二进制文件、基准测试等的依赖项）。 可以通过在目标的 manifest 设置中设置 <code>bench</code> 标志来启用或禁用目标。</p>
</dd>


<dt class="option-term" id="option-cargo-bench---all-targets"><a class="option-anchor" href="#option-cargo-bench---all-targets"><code>--all-targets</code></a></dt>
<dd class="option-desc"><p>对所有目标进行测试。这相当于指定 <code>--lib --bins --tests --benches --examples</code>。</p>
</dd>


</dl>

### 特性选择

特性标志允许您控制哪些特性被启用。当没有指定特性选项时，每个选定的包都会激活 `default` 特性。

有关更多详细信息，请参阅 [特性文档](../reference/features.html#command-line-特性-options)。

<dl>

<dt class="option-term" id="option-cargo-bench--F"><a class="option-anchor" href="#option-cargo-bench--F"><code>-F</code> <em>features</em></a></dt>
<dt class="option-term" id="option-cargo-bench---features"><a class="option-anchor" href="#option-cargo-bench---features"><code>--features</code> <em>features</em></a></dt>
<dd class="option-desc"><p>用于激活功能的空格或逗号分隔的列表。工作区成员的功能可以通过 <code>package-name/feature-name</code> 语法来启用。此标志可以多次指定，从而启用所有指定的功能。</p>
</dd>


<dt class="option-term" id="option-cargo-bench---all-features"><a class="option-anchor" href="#option-cargo-bench---all-features"><code>--all-features</code></a></dt>
<dd class="option-desc"><p>激活所有选定包的所有可用功能。</p>
</dd>


<dt class="option-term" id="option-cargo-bench---no-default-features"><a class="option-anchor" href="#option-cargo-bench---no-default-features"><code>--no-default-features</code></a></dt>
<dd class="option-desc"><p>不要激活选定包的 <code>default</code> 功能。</p>
</dd>


</dl>

### 编译选项

<dl>

<dt class="option-term" id="option-cargo-bench---target"><a class="option-anchor" href="#option-cargo-bench---target"><code>--target</code> <em>tuple</em></a></dt>
<dd class="option-desc"><p>针对指定目标架构的基准测试。可以多次指定此标志，默认值为主机架构。该元组的通用格式为 <code>&lt;arch&gt;&lt;sub&gt;-&lt;vendor&gt;-&lt;sys&gt;-&lt;abi&gt;</code>。</p> <p>可能的值：</p> <ul> <li>在 <code>rustc --print target-list</code> 中支持的任何目标。</li> <li><code>"host-tuple"</code>，系统会内部替换为主机目标。如果进行跨编译某些库，且不想将主机机器作为目标指定（例如，在多个主机可能共同使用的共享项目中使用 <code>xtask</code>），则非常有用。</li> <li>指向自定义目标规范的路径。有关更多信息，请参阅<a href="../../rustc/targets/custom.html#custom-target-lookup-path">自定义目标查找路径</a>。</li> </ul> <p>也可以通过 <code>build.target</code> <a href="../reference/config.html">配置值</a>来指定此标志。</p> <p>请注意，指定此标志会使 Cargo 以不同的模式运行，此时目标产物会存放在单独的目录中。有关更多细节，请参阅<a href="../reference/build-cache.html">构建缓存</a>文档。</p>
</dd>


<dt class="option-term" id="option-cargo-bench---profile"><a class="option-anchor" href="#option-cargo-bench---profile"><code>--profile</code> <em>name</em></a></dt>
<dd class="option-desc"><p>使用给定配置文件的基准测试。 有关配置文件的更多详细信息，请参阅 <a href="../reference/profiles.html">参考文档</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-bench---timings"><a class="option-anchor" href="#option-cargo-bench---timings"><code>--timings</code></a></dt>
<dd class="option-desc"><p>输出每个编译所花费的时间信息，并随时间跟踪并发情况。</p> <p>在构建结束时，一个文件 <code>cargo-timing.html</code> 将被写入 <code>target/cargo-timings</code> 目录。如果您想查看之前的运行结果，还会生成一个带有时间戳的文件名的报告。这些报告仅适合人类阅读，不提供机器可读取的时间数据。</p>
</dd>



</dl>

### 输出选项

<dl>
<dt class="option-term" id="option-cargo-bench---target-dir"><a class="option-anchor" href="#option-cargo-bench---target-dir"><code>--target-dir</code> <em>directory</em></a></dt>
<dd class="option-desc"><p>所有生成产物和中间文件的目录。也可以通过 <code>CARGO_TARGET_DIR</code> 环境变量或 <code>build.target-dir</code> <a href="../reference/config.html">配置值</a>来指定。默认值为工作空间根目录中的 <code>target</code>。</p>
</dd>

</dl>

### 显示选项

默认情况下，Rust 测试框架会隐藏基准测试执行时的输出，以便结果易于阅读。通过向基准测试二进制文件传递 `--no-capture` 可以恢复基准测试输出（例如用于调试）：

    cargo bench -- --no-capture

<dl>

<dt class="option-term" id="option-cargo-bench--v"><a class="option-anchor" href="#option-cargo-bench--v"><code>-v</code></a></dt>
<dt class="option-term" id="option-cargo-bench---verbose"><a class="option-anchor" href="#option-cargo-bench---verbose"><code>--verbose</code></a></dt>
<dd class="option-desc"><p>使用详细输出。对于“非常详细”的输出，可以指定两次，该选项包含额外的输出内容，如依赖项警告和构建脚本输出。 也可以通过 <code>term.verbose</code> <a href="../reference/config.html">配置值</a>来指定此选项。</p>
</dd>


<dt class="option-term" id="option-cargo-bench--q"><a class="option-anchor" href="#option-cargo-bench--q"><code>-q</code></a></dt>
<dt class="option-term" id="option-cargo-bench---quiet"><a class="option-anchor" href="#option-cargo-bench---quiet"><code>--quiet</code></a></dt>
<dd class="option-desc"><p>不要打印 cargo 日志消息。 也可以通过 <code>term.quiet</code> <a href="../reference/config.html">配置值</a>来指定此选项。</p>
</dd>


<dt class="option-term" id="option-cargo-bench---color"><a class="option-anchor" href="#option-cargo-bench---color"><code>--color</code> <em>when</em></a></dt>
<dd class="option-desc"><p>控制是否使用彩色输出。有效值包括： <ul> <li><code>auto</code>（默认）：自动检测终端是否支持颜色显示。</li> <li><code>always</code>：始终显示颜色。</li> <li><code>never</code>：从不显示颜色。</li> </ul> <p>也可以通过 <code>term.color</code> <a href="../reference/config.html">配置值</a>来指定此选项。</p></p></dd>


<dt class="option-term" id="option-cargo-bench---message-format"><a class="option-anchor" href="#option-cargo-bench---message-format"><code>--message-format</code> <em>fmt</em></a></dt>
<dd class="option-desc"><p>诊断信息的输出格式。可以多次指定，由逗号分隔的值组成。有效值：</p> <ul> <li><code>human</code>（默认）：以人类可读的文本格式显示。与 <code>short</code> 和 <code>json</code> 冲突。</li> <li><code>short</code>：输出更简短、人类可读的消息。与 <code>human</code> 和 <code>json</code> 冲突。</li> <li><code>json</code>：将 JSON 消息输出到标准输出中。更多详情请参阅 <a href="../reference/external-tools.html#json-messages">参考文档</a>。与 <code>human</code> 和 <code>short</code> 冲突。</li> <li><code>json-diagnostic-short</code>：确保 JSON 消息的 <code>rendered</code> 字段包含 rustc 生成的 “short” 格式。不能与 <code>human</code> 或 <code>short</code> 一起使用。</li> <li><code>json-diagnostic-rendered-ansi</code>：确保 JSON 消息的 <code>rendered</code> 字段包含嵌入的 ANSI 颜色代码，以遵循 rustc 的默认颜色方案。不能与 <code>human</code> 或 <code>short</code> 一起使用。</li> <li><code>json-render-diagnostics</code>：指示 Cargo 在打印的 JSON 消息中不包含 rustc 诊断信息，而是由 Cargo 自身渲染来自 rustc 的 JSON 诊断信息。Cargo 自身的 JSON 诊断信息及来自 rustc 的其他诊断信息仍会被输出。不能与 <code>human</code> 或 <code>short</code> 一起使用。</li> </ul> </dd> </dl> ### Manifest 选项 <dl> <dt class="option-term" id="option-cargo-bench---manifest-path"><a class="option-anchor" href="#option-cargo-bench---manifest-path"><code>--manifest-path</code> <em>路径</em></a></dt> <dd class="option-desc"><p><code>Cargo.toml</code> 文件的路径。默认情况下，Cargo 会在当前目录或任何父目录中查找 <code>Cargo.toml</code> 文件。</li></p>
</dd>


<dt class="option-term" id="option-cargo-bench---ignore-rust-version"><a class="option-anchor" href="#option-cargo-bench---ignore-rust-version"><code>--ignore-rust-version</code></a></dt>
<dd class="option-desc"><p>在包中忽略 <code>rust-version</code> 规范。</p>
</dd>


<dt class="option-term" id="option-cargo-bench---locked"><a class="option-anchor" href="#option-cargo-bench---locked"><code>--locked</code></a></dt>
<dd class="option-desc"><p>断言当前使用的依赖项和版本与原始生成 <code>Cargo.lock</code> 文件时相同。当出现以下任一情况时，Cargo 将以错误退出： <ul> <li>锁文件缺失。</li> <li>由于不同的依赖解析导致 Cargo 尝试修改锁文件。</li> </ul> 该选项可用于需要确定性构建的环境中，例如 CI 流水线。</p>
</dd>


<dt class="option-term" id="option-cargo-bench---offline"><a class="option-anchor" href="#option-cargo-bench---offline"><code>--offline</code></a></dt>
<dd class="option-desc"><p>防止 Cargo 出于任何原因访问网络。如果没有此标志，如果 Cargo 需要访问网络而网络不可用时，它将以错误退出。使用此标志后，Cargo 将尽可能在不联网的情况下继续运行。 请注意，这可能会导致与在线模式不同的依赖解析。即使本地索引副本中显示有更新版本，Cargo 也将限制自己仅使用本地下载的库。在离线操作前，请参考 <a href="cargo-fetch.html">cargo-fetch(1)</a> 命令来下载依赖项。 也可以通过 <code>net.offline</code> <a href="../reference/config.html">配置值</a>指定此选项。</p>
</dd>


<dt class="option-term" id="option-cargo-bench---frozen"><a class="option-anchor" href="#option-cargo-bench---frozen"><code>--frozen</code></a></dt>
<dd class="option-desc"><p>相当于同时指定 <code>--locked</code> 和 <code>--offline</code>。</p>
</dd>


</dl>

### 常见选项

<dl>

<dt class="option-term" id="option-cargo-bench-+toolchain"><a class="option-anchor" href="#option-cargo-bench-+toolchain"><code>+</code><em>toolchain</em></a></dt>
<dd class="option-desc"><p>如果 Cargo 是通过 rustup 安装的，且 <code>cargo</code> 的第一个参数以 <code>+</code> 开头，则会被解释为 rustup 工具链名称（如 <code>+stable</code> 或 <code>+nightly</code>）。 有关工具链覆盖机制更多信息，请参阅 <a href="https://rust-lang.github.io/rustup/overrides.html">rustup 文档</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-bench---config"><a class="option-anchor" href="#option-cargo-bench---config"><code>--config</code> <em>KEY=VALUE</em> or <em>PATH</em></a></dt>
<dd class="option-desc"><p>覆盖 Cargo 配置值。参数应为 TOML 语法 <code>KEY=VALUE</code>，或作为额外配置文件的路径提供。此标志可以多次指定。 有关更多信息，请参阅 <a href="../reference/config.html#command-line-overrides">命令行覆盖部分</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-bench--C"><a class="option-anchor" href="#option-cargo-bench--C"><code>-C</code> <em>PATH</em></a></dt>
<dd class="option-desc"><p>在执行任何指定操作之前，此选项会更改当前工作目录。这会影响诸如 cargo 默认查找项目清单 (<code>Cargo.toml</code>)的位置，以及用于发现 <code>.cargo/config.toml</code> 的搜索目录等设置。该选项必须出现在命令名称之前，例如 <code>cargo -C path/to/my-project build</code>。</p> <p>此选项仅适用于 <a href="https://doc.rust-lang.org/book/appendix-07-nightly-rust.html">nightly 版本</a>，并且需要使用 <code>-Z unstable-options</code> 标志才能启用（参见 <a href="https://github.com/rust-lang/cargo/issues/10098">#10098</a>）。</p>
</dd>


<dt class="option-term" id="option-cargo-bench--h"><a class="option-anchor" href="#option-cargo-bench--h"><code>-h</code></a></dt>
<dt class="option-term" id="option-cargo-bench---help"><a class="option-anchor" href="#option-cargo-bench---help"><code>--help</code></a></dt>
<dd class="option-desc"><p>打印帮助信息。</p>
</dd>


<dt class="option-term" id="option-cargo-bench--Z"><a class="option-anchor" href="#option-cargo-bench--Z"><code>-Z</code> <em>flag</em></a></dt>
<dd class="option-desc"><p>Cargo 的不稳定（仅 nightly 版本）标志。运行 <code>cargo -Z help</code> 以获取详细信息。</p>
</dd>


</dl>

### 其他选项

`--jobs` 参数影响基准测试可执行文件的构建，但不影响运行测试时使用的线程数。Rust 测试框架在单个线程中串行运行所有测试。

<dl>
<dt class="option-term" id="option-cargo-bench--j"><a class="option-anchor" href="#option-cargo-bench--j"><code>-j</code> <em>N</em></a></dt>
<dt class="option-term" id="option-cargo-bench---jobs"><a class="option-anchor" href="#option-cargo-bench---jobs"><code>--jobs</code> <em>N</em></a></dt>
<dd class="option-desc"><p>要运行的并行任务数量。也可以通过 <code>build.jobs</code> <a href="../reference/config.html">配置值</a>指定。默认值为逻辑 CPU 数。如果为负数，则将最大并行任务数设置为逻辑 CPU 数加上提供的数值。如果提供字符串 <code>default</code>，则将其重置为默认值。不应为 0。</p>
</dd>

</dl>

虽然 `cargo bench` 涉及编译过程，但它不提供 `--keep-going` 标志。使用 `--no-fail-fast` 可以在首次失败之前继续运行尽可能多的测试。为了尽可能多地“编译”测试，可以使用 `--benches` 分别构建基准测试二进制文件。例如：

    cargo build --benches --release --keep-going cargo bench --no-fail-fast

## 环境设置

有关 Cargo 读取的环境变量详情，请参阅 [参考手册](../reference/environment-variables.html)。

## 退出状态

* `0`: Cargo 成功完成。
* `101`: Cargo 未能完成。

## 示例

1. 构建并执行当前包中的所有基准测试：

       cargo bench

2. 仅运行特定基准测试目标中的特定基准测试：

       cargo bench --bench bench_name -- modname::some_benchmark

## 另请参阅 [cargo(1)](cargo.html)、[cargo-test(1)](cargo-test.html)

[`bench` profile]: ../reference/profiles.html#bench
