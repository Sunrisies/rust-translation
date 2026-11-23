# cargo-build(1)
## 名称

cargo-build —— 编译当前包

## 概述

`cargo build` [_选项_]

## 描述

编译本地包及其所有依赖项。

## 选项

### 包选择

默认情况下，当未提供任何包选择选项时，所选的包依赖于选定的清单文件（如果未指定 `--manifest-path`，则基于当前工作目录）。如果清单是工作空间的根目录，则选择工作空间的默认成员；否则仅选择由清单定义的包。

工作空间的默认成员可以通过根清单中的 `workspace.default-members` 键显式设置。如果未设置此值，虚拟工作空间将包含所有工作空间成员（相当于传递 `--workspace` 选项），而非虚拟工作空间则仅包含根 crate 本身。

<dl>

<dt class="option-term" id="option-cargo-build--p"><a class="option-anchor" href="#option-cargo-build--p"><code>-p</code> <em>spec</em>…</a></dt>
<dt class="option-term" id="option-cargo-build---package"><a class="option-anchor" href="#option-cargo-build---package"><code>--package</code> <em>spec</em>…</a></dt>
<dd class="option-desc"><p>仅构建指定的包。有关 SPEC 格式，请参阅 <a href="cargo-pkgid.html">cargo-pkgid(1)</a>。此标志可以多次指定，并支持常见的 Unix glob 模式，如 <code>*</code>、<code>?</code> 和 <code>[]</code>。然而，为了避免 Shell 在 Cargo 处理之前意外展开 glob 模式，您必须在每个模式下使用单引号或双引号。</p>
</dd>


<dt class="option-term" id="option-cargo-build---workspace"><a class="option-anchor" href="#option-cargo-build---workspace"><code>--workspace</code></a></dt>
<dd class="option-desc"><p>构建工作空间中的所有成员。</p>
</dd>


<dt class="option-term" id="option-cargo-build---all"><a class="option-anchor" href="#option-cargo-build---all"><code>--all</code></a></dt>
<dd class="option-desc"><p><code>--workspace</code> 的已弃用别名。</p>
</dd>


<dt class="option-term" id="option-cargo-build---exclude"><a class="option-anchor" href="#option-cargo-build---exclude"><code>--exclude</code> <em>SPEC</em>…</a></dt>
<dd class="option-desc"><p>排除指定的包。必须与 <code>--workspace</code> 标志一起使用。此标志可以多次指定，并支持常见的 Unix glob 模式，如 <code>*</code>、<code>?</code> 和 <code>[]</code>。然而，为了避免 Shell 在 Cargo 处理之前意外展开 glob 模式，您必须在每个模式下使用单引号或双引号。</p>
</dd>


</dl>

### 目标选择

当未提供任何目标选择选项时，`cargo build` 将编译所选包的所有二进制和库目标。如果二进制具有缺失的 `required-features`，则会被跳过。

如果选择了集成测试或基准测试以进行构建，则二进制目标会自动构建。这允许集成测试执行二进制以验证和测试其行为。`CARGO_BIN_EXE_<name>` [环境变量](../reference/environment-variables.html#environment-variables-cargo-sets-for-crates) 在集成测试构建运行时被设置，以便使用 [`env` 宏](https://doc.rust-lang.org/std/宏.env.html) 或 [`var` 函数](https://doc.rust-lang.org/std/env/fn.var.html) 来定位可执行文件。

传递目标选择标志将仅构建指定的目标。

请注意，`--bin`、`--example`、`--test` 和 `--bench` 标志也支持常见的 Unix glob 模式，如 `*`、`?` 和 `[]`。然而，为了避免 shell 在 Cargo 处理之前意外展开 glob 模式，您必须在每个 glob 模式周围使用单引号或双引号。

<dl>

<dt class="option-term" id="option-cargo-build---lib"><a class="option-anchor" href="#option-cargo-build---lib"><code>--lib</code></a></dt>
<dd class="option-desc"><p>构建包的库文件。</p>
</dd>


<dt class="option-term" id="option-cargo-build---bin"><a class="option-anchor" href="#option-cargo-build---bin"><code>--bin</code> <em>name</em>…</a></dt>
<dd class="option-desc"><p>构建指定的二进制文件。此标志可以多次指定，并支持常见的 Unix glob 模式。</p>
</dd>


<dt class="option-term" id="option-cargo-build---bins"><a class="option-anchor" href="#option-cargo-build---bins"><code>--bins</code></a></dt>
<dd class="option-desc"><p>构建所有二进制目标。</p>
</dd>


<dt class="option-term" id="option-cargo-build---example"><a class="option-anchor" href="#option-cargo-build---example"><code>--example</code> <em>name</em>…</a></dt>
<dd class="option-desc"><p>构建指定的示例。此标志可以多次指定，并支持常见的 Unix glob 模式。</p>
</dd>


<dt class="option-term" id="option-cargo-build---examples"><a class="option-anchor" href="#option-cargo-build---examples"><code>--examples</code></a></dt>
<dd class="option-desc"><p>构建所有示例目标。</p>
</dd>


<dt class="option-term" id="option-cargo-build---test"><a class="option-anchor" href="#option-cargo-build---test"><code>--test</code> <em>name</em>…</a></dt>
<dd class="option-desc"><p>构建指定的集成测试。此标志可以多次指定，并支持常见的 Unix glob 模式。</p>
</dd>


<dt class="option-term" id="option-cargo-build---tests"><a class="option-anchor" href="#option-cargo-build---tests"><code>--tests</code></a></dt>
<dd class="option-desc"><p>构建所有设置了 <code>test = true</code> 清单标志的目标。默认情况下，这包括作为单元测试和集成测试构建的库文件和二进制文件。请注意，这也会构建任何所需的依赖项，因此 lib 目标可能会被构建两次（一次作为 unittest，一次作为二进制文件、集成测试等的依赖）。可以通过在目标的清单设置中设置 <code>test</code> 标志来启用或禁用目标。</p>
</dd>


<dt class="option-term" id="option-cargo-build---bench"><a class="option-anchor" href="#option-cargo-build---bench"><code>--bench</code> <em>name</em>…</a></dt>
<dd class="option-desc"><p>构建指定的基准测试。此标志可以多次指定，并支持常见的 Unix glob 模式。</p>
</dd>


<dt class="option-term" id="option-cargo-build---benches"><a class="option-anchor" href="#option-cargo-build---benches"><code>--benches</code></a></dt>
<dd class="option-desc"><p>构建所有设置了 <code>bench = true</code> 标志的目标。默认情况下，这包括作为基准测试构建的库和二进制文件以及基准测试目标。请注意，这也会构建所有必要的依赖项，因此 lib 目标可能会被构建两次（一次作为基准测试，一次作为二进制文件、基准测试等的依赖）。可以通过在目标的清单设置中设置 <code>bench</code> 标志来启用或禁用目标。</p>
</dd>


<dt class="option-term" id="option-cargo-build---all-targets"><a class="option-anchor" href="#option-cargo-build---all-targets"><code>--all-targets</code></a></dt>
<dd class="option-desc"><p>构建所有目标。这相当于指定 <code>--lib --bins --tests --benches --examples</code>。</p>
</dd>


</dl>

### 特性选择

功能标志允许你控制哪些功能被启用。当没有指定功能选项时，每个选中的包都会激活 `default` 功能。

更多详情请参见 [功能文档](../reference/features.html#command-line-特性-options)。

<dl>

<dt class="option-term" id="option-cargo-build--F"><a class="option-anchor" href="#option-cargo-build--F"><code>-F</code> <em>features</em></a></dt>
<dt class="option-term" id="option-cargo-build---features"><a class="option-anchor" href="#option-cargo-build---features"><code>--features</code> <em>features</em></a></dt>
<dd class="option-desc"><p>启用的功能列表，使用空格或逗号分隔。工作区成员的功能可以通过 <code>package-name/feature-name</code> 语法启用。此标志可以多次指定，从而启用所有指定的功能。</p>
</dd>


<dt class="option-term" id="option-cargo-build---all-features"><a class="option-anchor" href="#option-cargo-build---all-features"><code>--all-features</code></a></dt>
<dd class="option-desc"><p>激活所有选定包可用的功能。</p>
</dd>


<dt class="option-term" id="option-cargo-build---no-default-features"><a class="option-anchor" href="#option-cargo-build---no-default-features"><code>--no-default-features</code></a></dt>
<dd class="option-desc"><p>不要激活选定包的 <code>default</code> 功能。</p>
</dd>


</dl>

### 编译选项

<dl>

<dt class="option-term" id="option-cargo-build---target"><a class="option-anchor" href="#option-cargo-build---target"><code>--target</code> <em>tuple</em></a></dt>
<dd class="option-desc"><p>为指定的目标架构构建。该标志可以多次指定。默认是主机架构。元组的一般格式为 <code>&lt;arch&gt;&lt;sub&gt;-&lt;vendor&gt;-&lt;sys&gt;-&lt;abi&gt;</code>。</p> <p>可能的值：</p> <ul> <li>在 <code>rustc --print target-list</code> 中支持的任何目标。</li> <li><code>"host-tuple"</code>，内部会被替换为主机目标。如果你正在交叉编译某些库，并且不想将主机机器指定为目标（例如，在多个主机可使用的共享项目中使用的 <code>xtask</code>），这非常有用。</li> <li>自定义目标规范路径。有关更多信息，请参阅 <a href="../../rustc/targets/custom.html#custom-target-lookup-path">自定义目标查找路径</a>。</li> </ul> <p>也可以通过 <code>build.target</code> <a href="../reference/config.html">配置值</a>来指定此选项。</p> <p>请注意，指定此标志会使 Cargo 以不同的模式运行，其中目标产物被放在单独的目录中。有关更多细节，请参阅 <a href="../reference/build-cache.html">构建缓存</a>文档。</p>
</dd>


<dt class="option-term" id="option-cargo-build--r"><a class="option-anchor" href="#option-cargo-build--r"><code>-r</code></a></dt>
<dt class="option-term" id="option-cargo-build---release"><a class="option-anchor" href="#option-cargo-build---release"><code>--release</code></a></dt>
<dd class="option-desc"><p>使用 <code>release</code> 配置构建优化后的产物。 有关按名称选择特定配置的 <code>--profile</code> 选项，请参阅相关说明。</code></p>
</dd>


<dt class="option-term" id="option-cargo-build---profile"><a class="option-anchor" href="#option-cargo-build---profile"><code>--profile</code> <em>name</em></a></dt>
<dd class="option-desc"><p>使用给定的配置进行构建。 关于配置的更多详细信息，请参阅<a href="../reference/profiles.html">参考文档</a>。</code></p>
</dd>


<dt class="option-term" id="option-cargo-build---timings"><a class="option-anchor" href="#option-cargo-build---timings"><code>--timings</code></a></dt>
<dd class="option-desc"><p>输出每次编译所花费的时间信息，并随时间跟踪并发信息。</p> <p>在构建结束时，一个名为 <code>cargo-timing.html</code> 的文件将被写入 <code>target/cargo-timings</code> 目录。如果您希望查看之前的运行结果，还会生成一个包含时间戳的额外报告。 这些报告仅适合人类阅读，不提供机器可读取的时间数据。</p>
</dd>



</dl>

### 输出选项

<dl>
<dt class="option-term" id="option-cargo-build---target-dir"><a class="option-anchor" href="#option-cargo-build---target-dir"><code>--target-dir</code> <em>directory</em></a></dt>
<dd class="option-desc"><p>所有生成产物和中间文件的目录。也可以通过 <code>CARGO_TARGET_DIR</code> 环境变量或 <code>build.target-dir</code> <a href="../reference/config.html">配置值</a>来指定。 默认值为工作空间根目录中的 <code>target</code>。</p>
</dd>


<dt class="option-term" id="option-cargo-build---artifact-dir"><a class="option-anchor" href="#option-cargo-build---artifact-dir"><code>--artifact-dir</code> <em>directory</em></a></dt>
<dd class="option-desc"><p>将最终产物复制到此目录。</p> <p>此选项不稳定，仅在 <a href="https://doc.rust-lang.org/book/appendix-07-nightly-rust.html">nightly 频道</a>上可用，并且需要添加 <code>-Z unstable-options</code> 标志才能启用。 有关更多信息，请参阅 <a href="https://github.com/rust-lang/cargo/issues/6790">https://github.com/rust-lang/cargo/issues/6790</a>。</p>
</dd>


</dl>

### 显示选项

<dl>
<dt class="option-term" id="option-cargo-build--v"><a class="option-anchor" href="#option-cargo-build--v"><code>-v</code></a></dt>
<dt class="option-term" id="option-cargo-build---verbose"><a class="option-anchor" href="#option-cargo-build---verbose"><code>--verbose</code></a></dt>
<dd class="option-desc"><p>使用详细输出。可以两次指定以获得“非常详细”的输出，包括依赖警告和构建脚本输出等额外信息。 也可以通过 <code>term.verbose</code> <a href="../reference/config.html">配置值</a>来指定。</p>
</dd>


<dt class="option-term" id="option-cargo-build--q"><a class="option-anchor" href="#option-cargo-build--q"><code>-q</code></a></dt>
<dt class="option-term" id="option-cargo-build---quiet"><a class="option-anchor" href="#option-cargo-build---quiet"><code>--quiet</code></a></dt>
<dd class="option-desc"><p>不打印 cargo 日志消息。 也可以通过 <code>term.quiet</code> <a href="../reference/config.html">配置值</a>来指定。</p>
</dd>


<dt class="option-term" id="option-cargo-build---color"><a class="option-anchor" href="#option-cargo-build---color"><code>--color</code> <em>when</em></a></dt>
<dd class="option-desc"><p>控制使用彩色输出时的行为。有效值如下： <ul> <li><code>auto</code>（默认）：自动检测终端是否支持颜色功能。</li> <li><code>always</code>：始终显示颜色。</li> <li><code>never</code>：从不显示颜色。</li> </ul> 也可以通过 <code>term.color</code> **配置值** 来指定。</p>
</dd>


<dt class="option-term" id="option-cargo-build---message-format"><a class="option-anchor" href="#option-cargo-build---message-format"><code>--message-format</code> <em>fmt</em></a></dt>
<dd class="option-desc"><p>诊断信息的输出格式。可以多次指定，由逗号分隔的值组成。有效值：</p> <ul> <li><code>human</code>（默认）：以人类可读的文本格式显示。与 <code>short</code> 和 <code>json</code> 冲突。</li> <li><code>short</code>：输出更简短、人类可读的消息。与 <code>human</code> 和 <code>json</code> 冲突。</li> <li><code>json</code>：将 JSON 消息输出到标准输出中。更多详情请参阅 <a href="../reference/external-tools.html#json-messages">参考文档</a>。与 <code>human</code> 和 <code>short</code> 冲突。</li> <li><code>json-diagnostic-short</code>：确保 JSON 消息的 <code>rendered</code> 字段包含 rustc 生成的“短”格式。不能与 <code>human</code> 或 <code>short</code> 一起使用。</li> <li><code>json-diagnostic-rendered-ansi</code>：确保 JSON 消息的 <code>rendered</code> 字段包含嵌入的 ANSI 颜色代码，以遵循 rustc 默认的配色方案。不能与 <code>human</code> 或 <code>short</code> 一起使用。</li> <li><code>json-render-diagnostics</code>：指示 Cargo 在打印的 JSON 消息中不包含 rustc 诊断信息，而是由 Cargo 自身渲染来自 rustc 的 JSON 诊断信息。Cargo 自身的 JSON 诊断信息及来自 rustc 的其他诊断信息仍会输出。不能与 <code>human</code> 或 <code>short</code> 一起使用。</li> </ul> </dd> </dl> ### Manifest 选项 <dl> <dt class="option-term" id="option-cargo-build---manifest-path"><a class="option-anchor" href="#option-cargo-build---manifest-path"><code>--manifest-path</code> <em>路径</em></a></dt> <dd class="option-desc"><p><code>Cargo.toml</code> 文件的路径。默认情况下，Cargo 会在当前目录或任何父目录中查找 <code>Cargo.toml</code> 文件。</li></p>
</dd>


<dt class="option-term" id="option-cargo-build---ignore-rust-version"><a class="option-anchor" href="#option-cargo-build---ignore-rust-version"><code>--ignore-rust-version</code></a></dt>
<dd class="option-desc"><p>在包中忽略 <code>rust-version</code> 规范。</p>
</dd>


<dt class="option-term" id="option-cargo-build---locked"><a class="option-anchor" href="#option-cargo-build---locked"><code>--locked</code></a></dt>
<dd class="option-desc"><p>断言使用与生成现有 <code>Cargo.lock</code> 文件时相同的依赖项和版本。当出现以下任一情况时，Cargo 将以错误退出： <ul> <li>锁定文件缺失。</li> <li>由于不同的依赖解析导致 Cargo 尝试修改锁定文件。</li> </ul> 该选项可用于需要确定性构建的环境中，例如 CI 流水线。</p>
</dd>


<dt class="option-term" id="option-cargo-build---offline"><a class="option-anchor" href="#option-cargo-build---offline"><code>--offline</code></a></dt>
<dd class="option-desc"><p>防止 Cargo 出于任何原因访问网络。如果没有此标志，如果 Cargo 需要访问网络而网络不可用时，它将以错误退出。使用此标志后，Cargo 将尽可能在不联网的情况下继续运行。 请注意，这可能导致与在线模式不同的依赖解析。即使本地索引副本中显示有更新版本，Cargo 也将限制自己仅使用本地下载的包。在离线操作前，请参见 <a href="cargo-fetch.html">cargo-fetch(1)</a> 命令以下载依赖项。 也可以通过 <code>net.offline</code> <a href="../reference/config.html">配置值</a>来指定此选项。</p>
</dd>


<dt class="option-term" id="option-cargo-build---frozen"><a class="option-anchor" href="#option-cargo-build---frozen"><code>--frozen</code></a></dt>
<dd class="option-desc"><p>相当于同时指定 <code>--locked</code> 和 <code>--offline</code>。</p>
</dd>


</dl>

### 常见选项

<dl>

<dt class="option-term" id="option-cargo-build-+toolchain"><a class="option-anchor" href="#option-cargo-build-+toolchain"><code>+</code><em>toolchain</em></a></dt>
<dd class="option-desc"><p>如果 Cargo 是通过 rustup 安装的，且 <code>cargo</code> 的第一个参数以 <code>+</code> 开头，则会被解释为 rustup 工具链名称（如 <code>+stable</code> 或 <code>+nightly</code>）。 有关工具链覆盖机制的更多信息，请参见 <a href="https://rust-lang.github.io/rustup/overrides.html">rustup 文档</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-build---config"><a class="option-anchor" href="#option-cargo-build---config"><code>--config</code> <em>KEY=VALUE</em> or <em>PATH</em></a></dt>
<dd class="option-desc"><p>覆盖 Cargo 配置值。参数应为 TOML 语法 <code>KEY=VALUE</code>，或作为额外配置文件的路径提供。此标志可以多次指定。 有关更多信息，请参见 <a href="../reference/config.html#command-line-overrides">命令行覆盖部分</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-build--C"><a class="option-anchor" href="#option-cargo-build--C"><code>-C</code> <em>PATH</em></a></dt>
<dd class="option-desc"><p>在执行任何指定操作之前，更改当前工作目录。这会影响诸如 cargo 默认查找项目清单 (<code>Cargo.toml</code>)的位置，以及用于发现 <code>.cargo/config.toml</code> 的搜索目录等设置。此选项必须出现在命令名称之前，例如 <code>cargo -C path/to/my-project build</code>。</p> <p>此选项仅适用于 <a href="https://doc.rust-lang.org/book/appendix-07-nightly-rust.html">nightly 版本</a>，并且需要使用 <code>-Z unstable-options</code> 标志才能启用（参见 <a href="https://github.com/rust-lang/cargo/issues/10098">#10098</a>）。</p>
</dd>


<dt class="option-term" id="option-cargo-build--h"><a class="option-anchor" href="#option-cargo-build--h"><code>-h</code></a></dt>
<dt class="option-term" id="option-cargo-build---help"><a class="option-anchor" href="#option-cargo-build---help"><code>--help</code></a></dt>
<dd class="option-desc"><p>打印帮助信息。</p>
</dd>


<dt class="option-term" id="option-cargo-build--Z"><a class="option-anchor" href="#option-cargo-build--Z"><code>-Z</code> <em>flag</em></a></dt>
<dd class="option-desc"><p>Cargo 的不稳定（仅 nightly 版本）标志。运行 <code>cargo -Z help</code> 以获取详细信息。</p>
</dd>


</dl>

### 其他选项

<dl>
<dt class="option-term" id="option-cargo-build--j"><a class="option-anchor" href="#option-cargo-build--j"><code>-j</code> <em>N</em></a></dt>
<dt class="option-term" id="option-cargo-build---jobs"><a class="option-anchor" href="#option-cargo-build---jobs"><code>--jobs</code> <em>N</em></a></dt>
<dd class="option-desc"><p>要运行的并行任务数量。也可以通过 <code>build.jobs</code> <a href="../reference/config.html">配置值</a>指定。默认值为逻辑 CPU 数。如果为负数，则将最大并行任务数设置为逻辑 CPU 数加上提供的数值。如果提供字符串 <code>default</code>，则将其重置为默认值。不应为 0。</p>
</dd>

<dt class="option-term" id="option-cargo-build---keep-going"><a class="option-anchor" href="#option-cargo-build---keep-going"><code>--keep-going</code></a></dt>
<dd class="option-desc"><p>尽可能多地构建依赖图中所有的 crate，而不是在第一个构建失败的环节中断构建。</p> <p>例如，如果当前包依赖于 <code>fails</code> 和 <code>works</code> 两个依赖项，其中一个构建失败，<code>cargo build -j1</code> 可能只能构建成功的那个（取决于 Cargo 首先选择运行哪个），而 <code>cargo build -j1 --keep-going</code> 则一定会同时运行两个构建，即使第一个运行的失败。</p>
</dd>

<dt class="option-term" id="option-cargo-build---future-incompat-report"><a class="option-anchor" href="#option-cargo-build---future-incompat-report"><code>--future-incompat-report</code></a></dt>
<dd class="option-desc"><p>对于此命令执行过程中产生的任何不兼容警告，显示未来不兼容性报告。</p> <p>请参阅 <a href="cargo-report.html">cargo-report(1)</a>。</p>
</dd>

</dl>

## 环境

有关 Cargo 读取的环境变量详情，请参见 [参考手册](../reference/environment-variables.html)。

## 退出状态

* `0`: Cargo 成功执行。
* `101`: Cargo 未能完成执行。

## 示例

1. 构建本地包及其所有依赖项：

       cargo build

2. 使用优化选项进行构建：

       cargo build --release

## 另请参阅 [cargo(1)](cargo.html)、[cargo-rustc(1)](cargo-rustc.html)
