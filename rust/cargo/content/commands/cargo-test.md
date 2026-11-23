# cargo-test(1)
## 名称

cargo-test --- 执行包的单元测试和集成测试

## 概述

`cargo test` [_options_] [_testname_] [`--` _test-options_]

## 描述

编译并运行单元测试、集成测试和文档测试。

测试过滤参数 `TESTNAME` 以及两个连字符 (`--`) 之后的所有参数都会传递给测试二进制文件，从而传递给 _libtest_（Rustc内置的单元测试和微基准测试框架）。如果您向 Cargo 和二进制文件传递参数， `--` 之后的参数将传递给二进制文件，之前的参数将传递给 Cargo。有关 libtest 参数的详细信息，请参阅 `cargo test -- --help` 的输出，并查阅 Rustc 书籍中关于测试如何工作的章节 <https://doc.rust-lang.org/rustc/tests/index.html>。

例如，此命令会筛选名称中包含 `foo` 的测试，并在3个线程上并行运行这些测试：

    cargo test foo -- --test-threads 3

测试通过 `rustc` 的 `--test` 选项构建，该选项会将您的代码与 libtest 链接起来，生成一个特殊的可执行文件。此可执行文件会自动在多个线程中运行带有 `#[test]` 属性的所有函数。带有 `#[bench]` 属性的函数也会进行一次迭代以验证其功能正常。

如果包包含多个测试目标，每个目标都会像上述那样编译为特殊的可执行文件，然后串行运行。

通过在目标清单设置中设置 `harness = false`，可以禁用 libtest 框架，此时您需要自己提供 `main` 函数来处理测试的运行。

默认情况下，`cargo test` 使用 [`test` 配置文件]，该配置启用某些优化并禁用调试信息以获得快速反馈。如果您需要调试某个测试，可以使用 `--profile=debug` 命令行选项切换到调试配置文件。然后可以在调试器中运行启用了调试的测试。


### 文档测试

默认情况下也会运行文档测试，这由 `rustdoc` 处理。它从库目标的文档注释中提取代码示例，然后执行这些示例。

与常规测试目标不同，每个代码块通过 `rustc` 即时编译为 doctest 可执行文件。这些可执行文件在独立的进程中并行运行。实际上，代码块的编译是 libtest 控制的一部分，因此某些选项如 `--jobs` 可能不起作用。请注意，这种 doctests 的执行模式并不具有保证性，未来可能会发生变化；请小心依赖它。

有关编写文档测试的更多信息，请参阅 [rustdoc 手册](https://doc.rust-lang.org/rustdoc/)。

### 测试的工作目录

运行每个单元和集成测试时的工作目录被设置为测试所属包的根目录。将测试的工作目录设置为包的根目录后，测试就可以使用相对路径可靠地访问包中的文件，而无需知道 `cargo test` 是从哪里执行的。

对于文档测试，调用 `rustdoc` 时的工作目录被设置为工作空间根目录，这也是 `rustdoc` 作为每个文档测试编译目录使用的目录。运行每个文档测试时的工作目录被设置为测试所属包的根目录，并通过 `rustdoc`'s `--test-run-directory` 选项进行控制。

## 选项

### 测试选项

<dl>

<dt class="option-term" id="option-cargo-test---no-run"><a class="option-anchor" href="#option-cargo-test---no-run"><code>--no-run</code></a></dt>
<dd class="option-desc"><p>进行编译，但不要运行测试。</p>
</dd>


<dt class="option-term" id="option-cargo-test---no-fail-fast"><a class="option-anchor" href="#option-cargo-test---no-fail-fast"><code>--no-fail-fast</code></a></dt>
<dd class="option-desc"><p>无论是否失败都运行所有测试。如果没有此标志，Cargo会在第一个可执行程序失败时退出。Rust测试框架会完全执行可执行程序中的所有测试，此标志仅适用于整个可执行程序。</p>
</dd>


</dl>

### 包选择

默认情况下，如果没有提供包选择选项，所选的包取决于选定的清单文件（如果未指定 `--manifest-path`，则基于当前工作目录）。如果清单是工作空间的根目录，则选择工作空间的默认成员；否则仅选择由清单定义的包。

工作区的默认成员可以通过根清单中的 `workspace.default-members` 键明确设置。如果未设置此值，虚拟工作区将包含所有工作区成员（相当于传递 `--workspace` 参数），而非虚拟工作区则仅包含根 crate 本身。

<dl>

<dt class="option-term" id="option-cargo-test--p"><a class="option-anchor" href="#option-cargo-test--p"><code>-p</code> <em>spec</em>…</a></dt>
<dt class="option-term" id="option-cargo-test---package"><a class="option-anchor" href="#option-cargo-test---package"><code>--package</code> <em>spec</em>…</a></dt>
<dd class="option-desc"><p>仅测试指定的包。有关SPEC格式，请参阅<a href="cargo-pkgid.html">cargo-pkgid(1)</a>。此标志可以多次指定，并支持常见的Unix glob模式，如<code>*</code>、<code>?</code>和<code>[]</code>。但是，为了避免shell在Cargo处理之前意外展开glob模式，您必须在每个模式下使用单引号或双引号。</p>
</dd>


<dt class="option-term" id="option-cargo-test---workspace"><a class="option-anchor" href="#option-cargo-test---workspace"><code>--workspace</code></a></dt>
<dd class="option-desc"><p>测试工作空间中的所有成员。</p>
</dd>


<dt class="option-term" id="option-cargo-test---all"><a class="option-anchor" href="#option-cargo-test---all"><code>--all</code></a></dt>
<dd class="option-desc"><p><code>--workspace</code>的已弃用别名。</p>
</dd>


<dt class="option-term" id="option-cargo-test---exclude"><a class="option-anchor" href="#option-cargo-test---exclude"><code>--exclude</code> <em>SPEC</em>…</a></dt>
<dd class="option-desc"><p>排除指定的包。必须与<code>--workspace</code>标志一起使用。此标志可以多次指定，并支持常见的Unix glob模式，如<code>*</code>、<code>?</code>和<code>[]</code>。但是，为了避免shell在Cargo处理之前意外展开glob模式，您必须在每个模式下使用单引号或双引号。</p>
</dd>


</dl>

### 目标选择

当没有指定目标选择选项时，`cargo test` 将构建所选包的以下目标：

- lib --- 用于与二进制文件、示例、集成测试和文档测试链接。
- bins（仅当集成测试已构建且所需功能可用时）。
- examples --- 以确保它们能够编译。
- lib 作为单元测试。
- bins 作为单元测试。
- 集成测试。
- lib 目标的文档测试。

可以通过在清单设置中为目标设置 `test` 标志来更改默认行为。将 examples 设置为 `test = true` 将构建并运行示例作为测试，用 libtest harness 替换示例的 `main` 函数。如果您不希望 `main` 函数被替换，也应包含 `harness = false`，此时示例将按原样构建并执行。

将目标设置为 `test = false` 将默认停止对其进行测试。以名称形式指定的目标选择选项（如 `--example foo`）会忽略 `test` 标志，并始终测试给定目标。

可以通过在清单中为库设置 `doctest = false` 来禁用库的文档测试。

有关针对每个目标的更多设置信息，请参阅 [配置目标](../reference/cargo-targets.html#configuring-a-目标)。

如果选择了集成测试或基准测试来运行，则会自动构建二进制目标。这样，集成测试可以执行该二进制文件以验证其行为。`CARGO_BIN_EXE_<name>` [环境变量](../reference/environment-variables.html#environment-variables-cargo-sets-for-crates) 在集成测试构建和运行时被设置，以便使用 [`env` 宏](https://doc.rust-lang.org/std/宏.env.html) 或 [`var` function](https://doc.rust-lang.org/std/env/fn.var.html) 来定位可执行文件。

通过传递目标选择标志，仅测试指定的目标。

请注意，`--bin`、`--example`、`--test` 和 `--bench` 标志也支持常见的 Unix glob 模式，如 `*`、`?` 和 `[]`。然而，为了避免 Shell 在 Cargo 处理之前意外展开 glob 模式，您必须在每个 glob 模式周围使用单引号或双引号。

<dl>

<dt class="option-term" id="option-cargo-test---lib"><a class="option-anchor" href="#option-cargo-test---lib"><code>--lib</code></a></dt>
<dd class="option-desc"><p>测试包的库文件。</p>
</dd>


<dt class="option-term" id="option-cargo-test---bin"><a class="option-anchor" href="#option-cargo-test---bin"><code>--bin</code> <em>name</em>…</a></dt>
<dd class="option-desc"><p>测试指定的二进制文件。此标志可以多次指定，并支持常见的Unix glob模式。</p>
</dd>


<dt class="option-term" id="option-cargo-test---bins"><a class="option-anchor" href="#option-cargo-test---bins"><code>--bins</code></a></dt>
<dd class="option-desc"><p>测试所有二进制目标。</p>
</dd>


<dt class="option-term" id="option-cargo-test---example"><a class="option-anchor" href="#option-cargo-test---example"><code>--example</code> <em>name</em>…</a></dt>
<dd class="option-desc"><p>测试指定的示例。此标志可以多次指定，并支持常见的Unix glob模式。</p>
</dd>


<dt class="option-term" id="option-cargo-test---examples"><a class="option-anchor" href="#option-cargo-test---examples"><code>--examples</code></a></dt>
<dd class="option-desc"><p>测试所有示例目标。</p>
</dd>


<dt class="option-term" id="option-cargo-test---test"><a class="option-anchor" href="#option-cargo-test---test"><code>--test</code> <em>name</em>…</a></dt>
<dd class="option-desc"><p>测试指定的集成测试。此标志可以多次指定，并支持常见的Unix glob模式。</p>
</dd>


<dt class="option-term" id="option-cargo-test---tests"><a class="option-anchor" href="#option-cargo-test---tests"><code>--tests</code></a></dt>
<dd class="option-desc"><p>测试所有设置了<code>test = true</code>清单标志的目标。默认情况下，这包括作为单元测试和集成测试构建的库文件和二进制文件。请注意，这也会构建任何所需的依赖项，因此lib目标可能会被构建两次（一次作为unittest，一次作为二进制文件、集成测试等的依赖）。可以通过在目标的清单设置中设置<code>test</code>标志来启用或禁用目标。</p>
</dd>


<dt class="option-term" id="option-cargo-test---bench"><a class="option-anchor" href="#option-cargo-test---bench"><code>--bench</code> <em>name</em>…</a></dt>
<dd class="option-desc"><p>测试指定的基准测试。此标志可以多次指定，并支持常见的 Unix glob 模式。</p>
</dd>


<dt class="option-term" id="option-cargo-test---benches"><a class="option-anchor" href="#option-cargo-test---benches"><code>--benches</code></a></dt>
<dd class="option-desc"><p>测试所有设置了 <code>bench = true</code> manifest 标志的目标。默认情况下，这包括作为基准测试构建的库和二进制文件以及基准测试目标。请注意，这也会构建所有必要的依赖项，因此 lib 目标可能会被构建两次（一次作为基准测试，一次作为二进制文件、基准测试等的依赖项）。可以通过在目标的 manifest 设置中设置 <code>bench</code> 标志来启用或禁用目标。</p>
</dd>


<dt class="option-term" id="option-cargo-test---all-targets"><a class="option-anchor" href="#option-cargo-test---all-targets"><code>--all-targets</code></a></dt>
<dd class="option-desc"><p>测试所有目标。这相当于指定 <code>--lib --bins --tests --benches --examples</code>。</p>
</dd>


</dl>

<dl>

<dt class="option-term" id="option-cargo-test---doc"><a class="option-anchor" href="#option-cargo-test---doc"><code>--doc</code></a></dt>
<dd class="option-desc"><p>仅测试库的文档。此选项不能与其他目标选项混合使用。</p>
</dd>


</dl>

### 特性选择

特性标志允许您控制哪些特性被启用。当没有指定特性选项时，每个选中的包都会激活 `default` 特性。

有关更多细节，请参阅 [特性文档](../reference/features.html#command-line-特性-options)。

<dl>

<dt class="option-term" id="option-cargo-test--F"><a class="option-anchor" href="#option-cargo-test--F"><code>-F</code> <em>features</em></a></dt>
<dt class="option-term" id="option-cargo-test---features"><a class="option-anchor" href="#option-cargo-test---features"><code>--features</code> <em>features</em></a></dt>
<dd class="option-desc"><p>用于激活的功能的空格或逗号分隔列表。工作区成员的功能可以通过 <code>package-name/feature-name</code> 语法来启用。此标志可以多次指定，从而启用所有指定的功能。</p>
</dd>


<dt class="option-term" id="option-cargo-test---all-features"><a class="option-anchor" href="#option-cargo-test---all-features"><code>--all-features</code></a></dt>
<dd class="option-desc"><p>激活所有选定包的所有可用功能。</p>
</dd>


<dt class="option-term" id="option-cargo-test---no-default-features"><a class="option-anchor" href="#option-cargo-test---no-default-features"><code>--no-default-features</code></a></dt>
<dd class="option-desc"><p>不要激活选定包的 <code>default</code> 功能。</p>
</dd>


</dl>

### 编译选项

<dl>

<dt class="option-term" id="option-cargo-test---target"><a class="option-anchor" href="#option-cargo-test---target"><code>--target</code> <em>tuple</em></a></dt>
<dd class="option-desc"><p>针对指定的目标架构进行测试。可以多次指定此标志，默认值为主机架构。该元组的通用格式为 <code>&lt;arch&gt;&lt;sub&gt;-&lt;vendor&gt;-&lt;sys&gt;-&lt;abi&gt;</code>。</p> <p>可能的值：</p> <ul> <li>在 <code>rustc --print target-list</code> 中可见的任何支持的目标。</li> <li><code>"host-tuple"</code>，该值将内部被替换为主机目标。如果你正在交叉编译某些库，且不想指定主机机器作为目标（例如，在多个主机可使用的共享项目中使用的 <code>xtask</code>），则特别有用。</li> <li>指向自定义目标规范的路径。有关更多信息，请参阅<a href="../../rustc/targets/custom.html#custom-target-lookup-path">自定义目标查找路径</a>。</li> </ul> <p>也可以通过 <code>build.target</code> <a href="../reference/config.html">配置值</a>来指定此标志。</p> <p>请注意，指定此标志会使 Cargo 以不同的模式运行，此时目标工件被放置在单独的目录中。有关更多细节，请参阅<a href="../reference/build-cache.html">构建缓存</a>文档。</p>
</dd>


<dt class="option-term" id="option-cargo-test--r"><a class="option-anchor" href="#option-cargo-test--r"><code>-r</code></a></dt>
<dt class="option-term" id="option-cargo-test---release"><a class="option-anchor" href="#option-cargo-test---release"><code>--release</code></a></dt>
<dd class="option-desc"><p>使用 <code>release</code> 配置对优化后的工件进行测试。 另请参阅 <code>--profile</code> 选项以按名称选择特定配置。</p>
</dd>


<dt class="option-term" id="option-cargo-test---profile"><a class="option-anchor" href="#option-cargo-test---profile"><code>--profile</code> <em>name</em></a></dt>
<dd class="option-desc"><p>使用给定的配置进行测试。 有关配置的更多详细信息，请参阅<a href="../reference/profiles.html">参考文档</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-test---timings"><a class="option-anchor" href="#option-cargo-test---timings"><code>--timings</code></a></dt>
<dd class="option-desc"><p>输出每次编译所花费的时间信息，并随时间跟踪并发信息。</p> <p>在构建结束时，文件 <code>cargo-timing.html</code> 将被写入 <code>target/cargo-timings</code> 目录。如果你希望查看之前的运行结果，还会生成一个带有时间戳的文件名的额外报告。 这些报告仅适合人类阅读，不提供机器可读取的计时数据。</p>
</dd>



</dl>

### 输出选项

<dl>
<dt class="option-term" id="option-cargo-test---target-dir"><a class="option-anchor" href="#option-cargo-test---target-dir"><code>--target-dir</code> <em>directory</em></a></dt>
<dd class="option-desc"><p>用于存储所有生成产物和中间文件的目录。也可以通过 <code>CARGO_TARGET_DIR</code> 环境变量或 <code>build.target-dir</code> <a href="../reference/config.html">配置值</a>来指定该路径。默认值为工作空间根目录下的 <code>target</code>。</p>
</dd>

</dl>

### 显示选项

默认情况下，Rust 测试框架会隐藏测试执行过程中的输出，以便结果易于阅读。可以通过向测试二进制文件传递 `--no-capture` 来恢复测试输出（例如用于调试）：

    cargo test -- --no-capture

<dl>

<dt class="option-term" id="option-cargo-test--v"><a class="option-anchor" href="#option-cargo-test--v"><code>-v</code></a></dt>
<dt class="option-term" id="option-cargo-test---verbose"><a class="option-anchor" href="#option-cargo-test---verbose"><code>--verbose</code></a></dt>
<dd class="option-desc"><p>使用详细输出。可以通过设置两次来获得“非常详细”的输出，包含额外的内容如依赖警告和构建脚本输出。也可以通过 <code>term.verbose</code> <a href="../reference/config.html">配置值</a>来指定。</p>
</dd>


<dt class="option-term" id="option-cargo-test--q"><a class="option-anchor" href="#option-cargo-test--q"><code>-q</code></a></dt>
<dt class="option-term" id="option-cargo-test---quiet"><a class="option-anchor" href="#option-cargo-test---quiet"><code>--quiet</code></a></dt>
<dd class="option-desc"><p>不打印 cargo 日志消息。也可以通过 <code>term.quiet</code> <a href="../reference/config.html">配置值</a>来指定。</p>
</dd>


<dt class="option-term" id="option-cargo-test---color"><a class="option-anchor" href="#option-cargo-test---color"><code>--color</code> <em>when</em></a></dt>
<dd class="option-desc"><p>控制是否使用彩色输出。有效值包括： <ul> <li><code>auto</code>（默认）：自动检测终端是否支持颜色显示。</li> <li><code>always</code>：始终显示颜色。</li> <li><code>never</code>：从不显示颜色。</li> </ul> <p>也可以通过 <code>term.color</code> <a href="../reference/config.html">配置值</a>来指定。</p></p></dd>


<dt class="option-term" id="option-cargo-test---message-format"><a class="option-anchor" href="#option-cargo-test---message-format"><code>--message-format</code> <em>fmt</em></a></dt>
<dd class="option-desc"><p>诊断信息的输出格式。可以多次指定，由逗号分隔的值组成。有效值：</p> <ul> <li><code>human</code>（默认）：以人类可读的文本格式显示。与 <code>short</code> 和 <code>json</code> 冲突。</li> <li><code>short</code>：输出更简短的人类可读文本信息。与 <code>human</code> 和 <code>json</code> 冲突。</li> <li><code>json</code>：将 JSON 信息输出到标准输出中。更多详情请参阅 <a href="../reference/external-tools.html#json-messages">参考文档</a>。与 <code>human</code> 和 <code>short</code> 冲突。</li> <li><code>json-diagnostic-short</code>：确保 JSON 信息的 <code>rendered</code> 字段包含 rustc 的 “short” 渲染格式。不能与 <code>human</code> 或 <code>short</code> 一起使用。</li> <li><code>json-diagnostic-rendered-ansi</code>：确保 JSON 信息的 <code>rendered</code> 字段包含嵌入的 ANSI 颜色代码，以遵循 rustc 的默认颜色方案。不能与 <code>human</code> 或 <code>short</code> 一起使用。</li> <li><code>json-render-diagnostics</code>：指示 Cargo 在打印的 JSON 信息中不包含 rustc 诊断信息，而是由 Cargo 自身渲染来自 rustc 的 JSON 诊断信息。Cargo 自身的 JSON 诊断信息及其他来自 rustc 的信息仍会被输出。不能与 <code>human</code> 或 <code>short</code> 一起使用。</li> </ul> </dd> </dl> ### Manifest 选项 <dl> <dt class="option-term" id="option-cargo-test---manifest-path"><a class="option-anchor" href="#option-cargo-test---manifest-path"><code>--manifest-path</code> <em>路径</em></a></dt> <dd class="option-desc"><p><code>Cargo.toml</code> 文件的路径。默认情况下，Cargo 会在当前目录或任何父目录中查找 <code>Cargo.toml</code> 文件。</li></p>
</dd>


<dt class="option-term" id="option-cargo-test---ignore-rust-version"><a class="option-anchor" href="#option-cargo-test---ignore-rust-version"><code>--ignore-rust-version</code></a></dt>
<dd class="option-desc"><p>在包中忽略 <code>rust-version</code> 规范。</p>
</dd>


<dt class="option-term" id="option-cargo-test---locked"><a class="option-anchor" href="#option-cargo-test---locked"><code>--locked</code></a></dt>
<dd class="option-desc"><p>断言使用与原始生成 <code>Cargo.lock</code> 文件时相同的依赖项和版本。当出现以下任一情况时，Cargo 将以错误退出： <ul> <li>锁文件缺失。</li> <li>由于不同的依赖解析导致 Cargo 尝试修改锁文件。</li> </ul> 该选项可用于需要确定性构建的环境中，例如 CI 流水线。</p>
</dd>


<dt class="option-term" id="option-cargo-test---offline"><a class="option-anchor" href="#option-cargo-test---offline"><code>--offline</code></a></dt>
<dd class="option-desc"><p>防止 Cargo 出于任何原因访问网络。如果没有此标志，如果 Cargo 需要访问网络而网络不可用时，它将以错误退出。使用此标志后，Cargo 将尽可能在不联网的情况下继续运行。 请注意，这可能会导致与在线模式不同的依赖解析。Cargo 将限制自己仅使用本地下载的包，即使索引副本中显示有更新版本也是如此。在离线操作前，请参见 <a href="cargo-fetch.html">cargo-fetch(1)</a> 命令以下载依赖项。 也可以通过 <code>net.offline</code> <a href="../reference/config.html">配置值</a>来指定此选项。</p>
</dd>


<dt class="option-term" id="option-cargo-test---frozen"><a class="option-anchor" href="#option-cargo-test---frozen"><code>--frozen</code></a></dt>
<dd class="option-desc"><p>相当于同时指定 <code>--locked</code> 和 <code>--offline</code>。</p>
</dd>



</dl>

### 常见选项

<dl>

<dt class="option-term" id="option-cargo-test-+toolchain"><a class="option-anchor" href="#option-cargo-test-+toolchain"><code>+</code><em>toolchain</em></a></dt>
<dd class="option-desc"><p>如果 Cargo 通过 rustup 安装，且 <code>cargo</code> 的第一个参数以 <code>+</code> 开头，则会被解释为 rustup 工具链名称（如 <code>+stable</code> 或 <code>+nightly</code>）。 有关工具链覆盖机制的更多信息，请参阅 <a href="https://rust-lang.github.io/rustup/overrides.html">rustup 文档</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-test---config"><a class="option-anchor" href="#option-cargo-test---config"><code>--config</code> <em>KEY=VALUE</em> or <em>PATH</em></a></dt>
<dd class="option-desc"><p>覆盖 Cargo 配置值。参数应为 TOML 语法中的 <code>KEY=VALUE</code>，或作为额外配置文件的路径提供。此标志可以多次指定。有关更多信息，请参阅 <a href="../reference/config.html#command-line-overrides">命令行覆盖部分</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-test--C"><a class="option-anchor" href="#option-cargo-test--C"><code>-C</code> <em>PATH</em></a></dt>
<dd class="option-desc"><p>在执行任何指定操作之前，更改当前工作目录。这会影响诸如 cargo 默认查找项目清单 (<code>Cargo.toml</code>)的位置，以及搜索以发现 <code>.cargo/config.toml</code> 的目录等设置。此选项必须出现在命令名称之前，例如 <code>cargo -C path/to/my-project build</code>。</p> <p>此选项仅适用于 <a href="https://doc.rust-lang.org/book/appendix-07-nightly-rust.html">nightly 版本</a>，并且需要使用 <code>-Z unstable-options</code> 标志才能启用（参见 <a href="https://github.com/rust-lang/cargo/issues/10098">#10098</a>）。</p>
</dd>


<dt class="option-term" id="option-cargo-test--h"><a class="option-anchor" href="#option-cargo-test--h"><code>-h</code></a></dt>
<dt class="option-term" id="option-cargo-test---help"><a class="option-anchor" href="#option-cargo-test---help"><code>--help</code></a></dt>
<dd class="option-desc"><p>打印帮助信息。</p>
</dd>


<dt class="option-term" id="option-cargo-test--Z"><a class="option-anchor" href="#option-cargo-test--Z"><code>-Z</code> <em>flag</em></a></dt>
<dd class="option-desc"><p>Cargo 的不稳定（仅 nightly 版本）选项。运行 <code>cargo -Z help</code> 以获取详细信息。</p>
</dd>


</dl>

### 其他选项

`--jobs` 参数影响测试可执行文件的构建，但不影响运行测试时使用的线程数。Rust 测试框架包含控制线程数的选项：

    cargo test -j 2 -- --test-threads=2

<dl>

<dt class="option-term" id="option-cargo-test--j"><a class="option-anchor" href="#option-cargo-test--j"><code>-j</code> <em>N</em></a></dt>
<dt class="option-term" id="option-cargo-test---jobs"><a class="option-anchor" href="#option-cargo-test---jobs"><code>--jobs</code> <em>N</em></a></dt>
<dd class="option-desc"><p>要运行的并行任务数量。也可以通过 <code>build.jobs</code> <a href="../reference/config.html">配置值</a>指定。默认值为逻辑 CPU 数。如果为负数，则将最大并行任务数设置为逻辑 CPU 数加上提供的数值。如果提供字符串 <code>default</code>，则将其重置为默认值。不应为 0。</p>
</dd>

<dt class="option-term" id="option-cargo-test---future-incompat-report"><a class="option-anchor" href="#option-cargo-test---future-incompat-report"><code>--future-incompat-report</code></a></dt>
<dd class="option-desc"><p>对于执行此命令时产生的不兼容警告，显示未来不兼容报告。</p> <p>请参阅 <a href="cargo-report.html">cargo-report(1)</a>。</p>
</dd>


</dl>

虽然 `cargo test` 涉及编译过程，但它不提供 `--keep-going` 标志。使用 `--no-fail-fast` 可以在首次失败之前运行尽可能多的测试。为了“编译”尽可能多的测试，可以使用 `--tests` 单独构建测试二进制文件。例如：

    cargo build --tests --keep-going cargo test --tests --no-fail-fast

## 环境配置

有关 Cargo 读取的环境变量详情，请参阅 [参考手册](../reference/environment-variables.html)。

## 退出状态

* `0`: Cargo 成功执行。
* `101`: Cargo 未能完成执行。

## 示例

1. 运行当前包的所有单元测试与集成测试：

       cargo test

2. 仅运行名称符合过滤字符串的测试：

       cargo test name_filter

3. 仅在特定的集成测试中运行特定测试：

       cargo test --test int_test_name -- modname::test_name

## 另请参阅 [cargo(1)](cargo.html)、[cargo-bench(1)](cargo-bench.html)、[测试类型](../reference/cargo-targets.html#tests)、[如何编写测试](https://doc.rust-lang.org/rustc/tests/index.html)

[`test` profile]: ../reference/profiles.html#test
