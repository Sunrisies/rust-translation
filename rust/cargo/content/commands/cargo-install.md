# cargo-install(1)
## 名称

cargo-install —— 构建并安装 Rust 二进制文件

## 使用说明

`cargo install` [_options_] _crate_[@_version_]...\ `cargo install` [_options_] `--path` _path_\ `cargo install` [_options_] `--git` _url_[_crate_...]\ `cargo install` [_options_] `--list`

## 描述

此命令用于管理 Cargo 本地已安装的二进制库。只有具有可执行 `[[bin]]` 或 `[[example]]` 目标的包才能被安装，所有可执行文件都会被安装到安装根目录的 `bin` 文件夹中。默认情况下仅安装二进制文件，不安装示例程序。

安装根目录的确定顺序如下：

- `--root` 选项
- `CARGO_INSTALL_ROOT` 环境变量
- `install.root` Cargo [配置值](../reference/config.html)
- `CARGO_HOME` 环境变量
- `$HOME/.cargo`

库可以通过多种来源进行安装。默认源位置是 crates.io，但 `--git`、`--path` 和 `--registry` 选项可以更改此源。如果源中包含多个包（例如 crates.io 或包含多个库的 git 仓库），则需要使用 `_crate_` 参数来指定要安装的库。

来自 crates.io 的库可以通过 `--version` 选项选择要安装的版本，来自 git 仓库的包也可以通过该选项选择要安装的分支、标签或修订版。如果某个库包含多个二进制文件，可以使用 `--bin` 参数选择性地安装其中一个，如果想安装示例程序，则可以使用 `--example` 参数。

如果包已经安装，且已安装的版本看起来不再是最新的，Cargo 会重新安装该包。当以下任何值发生变化时，Cargo 也会重新安装该包：

- 包的版本和源地址。
- 已安装的二进制文件名称集。
- 选择的特性。
- 配置文件（`--profile`）。
- 目标（`--target`）。

使用 `--path` 安装总是会构建并安装软件，除非存在来自其他包的冲突二进制文件。可以使用 `--force` 标志强制 Cargo 始终重新安装该包。

如果源代码来自 crates.io 或 `--git`，则默认情况下包会被构建在临时目标目录中。为了避免这种情况，可以通过设置 `CARGO_TARGET_DIR` 环境变量为路径来指定目标目录。这对于在持续集成系统上缓存构建产物非常有用。

### 处理 锁文件

默认情况下，如果可用，Cargo 会使用包中包含的 `Cargo.lock` 文件。这确保安装的可执行文件使用该包发布时选择的依赖版本。如果没有 锁文件（包括在 Cargo 版本低于 1.37 时发布的包中），Cargo 会正常解析依赖。

`--locked` 标志目前不会改变 `cargo install` 的依赖解析方式。如果没有 `Cargo.lock`，使用 `--locked` 会发出警告。

### 配置发现

此命令在系统或用户级别运行，而非项目级别。这意味着本地 [配置发现] 会被忽略。相反，配置发现从 `$CARGO_HOME/config.toml` 开始。如果包通过 `--path $PATH` 安装，则使用本地配置，并从 `$PATH/.cargo/config.toml` 开始发现。


## 选项

### 安装选项

<dl>

<dt class="option-term" id="option-cargo-install---vers"><a class="option-anchor" href="#option-cargo-install---vers"><code>--vers</code> <em>version</em></a></dt>
<dt class="option-term" id="option-cargo-install---version"><a class="option-anchor" href="#option-cargo-install---version"><code>--version</code> <em>version</em></a></dt>
<dd class="option-desc"><p>指定要安装的版本。这可以是<a href="../reference/specifying-dependencies.html">版本要求</a>，例如 <code>~1.2</code>，以便 Cargo 从给定的要求中选择最新版本。如果版本没有版本要求运算符（如 <code>^</code> 或 <code>~</code>），则必须以 <em>MAJOR.MINOR.PATCH</em> 的形式呈现，Cargo 将安装该特定版本；它<em>不</em>被视为像 Cargo 依赖项那样的 caret 要求。</p>
</dd>


<dt class="option-term" id="option-cargo-install---git"><a class="option-anchor" href="#option-cargo-install---git"><code>--git</code> <em>url</em></a></dt>
<dd class="option-desc"><p>从何处安装指定 crate 的 Git URL。</p>
</dd>


<dt class="option-term" id="option-cargo-install---branch"><a class="option-anchor" href="#option-cargo-install---branch"><code>--branch</code> <em>branch</em></a></dt>
<dd class="option-desc"><p>从 git 安装时使用的分支。</p>
</dd>


<dt class="option-term" id="option-cargo-install---tag"><a class="option-anchor" href="#option-cargo-install---tag"><code>--tag</code> <em>tag</em></a></dt>
<dd class="option-desc"><p>从 git 安装时使用的标签。</p>
</dd>


<dt class="option-term" id="option-cargo-install---rev"><a class="option-anchor" href="#option-cargo-install---rev"><code>--rev</code> <em>sha</em></a></dt>
<dd class="option-desc"><p>从 git 安装时使用的特定提交。</p>
</dd>


<dt class="option-term" id="option-cargo-install---path"><a class="option-anchor" href="#option-cargo-install---path"><code>--path</code> <em>path</em></a></dt>
<dd class="option-desc"><p>要安装的本地 crate 的文件系统路径。</p>
</dd>


<dt class="option-term" id="option-cargo-install---list"><a class="option-anchor" href="#option-cargo-install---list"><code>--list</code></a></dt>
<dd class="option-desc"><p>列出所有已安装的包及其版本。</p>
</dd>


<dt class="option-term" id="option-cargo-install--n"><a class="option-anchor" href="#option-cargo-install--n"><code>-n</code></a></dt>
<dt class="option-term" id="option-cargo-install---dry-run"><a class="option-anchor" href="#option-cargo-install---dry-run"><code>--dry-run</code></a></dt>
<dd class="option-desc"><p>（不稳定）在不安装的情况下执行所有检查。</p>
</dd>


<dt class="option-term" id="option-cargo-install--f"><a class="option-anchor" href="#option-cargo-install--f"><code>-f</code></a></dt>
<dt class="option-term" id="option-cargo-install---force"><a class="option-anchor" href="#option-cargo-install---force"><code>--force</code></a></dt>
<dd class="option-desc"><p>强制覆盖现有的 crates 或二进制文件。如果某个包安装了与另一个包同名的二进制文件，可以使用此选项。如果系统中有变化且您希望重新构建，例如 <code>rustc</code> 的新版本，也适用此选项。</p>
</dd>


<dt class="option-term" id="option-cargo-install---no-track"><a class="option-anchor" href="#option-cargo-install---no-track"><code>--no-track</code></a></dt>
<dd class="option-desc"><p>默认情况下，Cargo 会在安装根目录中存储元数据文件来跟踪已安装的包。此标志告诉 Cargo 不使用或创建该文件。使用此标志时，除非使用 <code>--force</code> 标志，否则 Cargo 将拒绝覆盖任何现有文件。这还禁用 Cargo 防止同时多次调用 Cargo 安装的能力。</p>
</dd>


<dt class="option-term" id="option-cargo-install---bin"><a class="option-anchor" href="#option-cargo-install---bin"><code>--bin</code> <em>name</em>…</a></dt>
<dd class="option-desc"><p>仅安装指定的二进制文件。</p>
</dd>


<dt class="option-term" id="option-cargo-install---bins"><a class="option-anchor" href="#option-cargo-install---bins"><code>--bins</code></a></dt>
<dd class="option-desc"><p>安装所有二进制文件。这是默认行为。</p>
</dd>


<dt class="option-term" id="option-cargo-install---example"><a class="option-anchor" href="#option-cargo-install---example"><code>--example</code> <em>name</em>…</a></dt>
<dd class="option-desc"><p>仅安装指定的示例。</p>
</dd>


<dt class="option-term" id="option-cargo-install---examples"><a class="option-anchor" href="#option-cargo-install---examples"><code>--examples</code></a></dt>
<dd class="option-desc"><p>安装所有示例。</p>
</dd>


<dt class="option-term" id="option-cargo-install---root"><a class="option-anchor" href="#option-cargo-install---root"><code>--root</code> <em>dir</em></a></dt>
<dd class="option-desc"><p>安装包的目录路径。</p>
</dd>


<dt class="option-term" id="option-cargo-install---registry"><a class="option-anchor" href="#option-cargo-install---registry"><code>--registry</code> <em>registry</em></a></dt>
<dd class="option-desc"><p>要使用的注册表名称。注册表名称定义在<a href="../reference/config.html">Cargo 配置文件</a>中。如果未指定，则使用默认注册表，由 <code>registry.default</code> 配置键定义，默认为 <code>crates-io</code>。</p>
</dd>


<dt class="option-term" id="option-cargo-install---index"><a class="option-anchor" href="#option-cargo-install---index"><code>--index</code> <em>index</em></a></dt>
<dd class="option-desc"><p>要使用的注册表索引的 URL。</p>
</dd>


</dl>

### 功能选择

功能标志允许你控制哪些功能被启用。当没有指定功能选项时，每个选定的包都会激活 `default` 功能。

有关更多细节，请参阅 [功能文档](../reference/features.html#command-line-特性-options)。

<dl>

<dt class="option-term" id="option-cargo-install--F"><a class="option-anchor" href="#option-cargo-install--F"><code>-F</code> <em>features</em></a></dt>
<dt class="option-term" id="option-cargo-install---features"><a class="option-anchor" href="#option-cargo-install---features"><code>--features</code> <em>features</em></a></dt>
<dd class="option-desc"><p>要激活的功能列表，使用空格或逗号分隔。工作区成员功能可以通过 <code>package-name/feature-name</code> 语法启用。此标志可以多次指定，从而激活所有指定的功能。</p>
</dd>


<dt class="option-term" id="option-cargo-install---all-features"><a class="option-anchor" href="#option-cargo-install---all-features"><code>--all-features</code></a></dt>
<dd class="option-desc"><p>激活所有选定包的所有可用功能。</p>
</dd>


<dt class="option-term" id="option-cargo-install---no-default-features"><a class="option-anchor" href="#option-cargo-install---no-default-features"><code>--no-default-features</code></a></dt>
<dd class="option-desc"><p>不要激活选定包的 <code>default</code> 功能。</p>
</dd>


</dl>

### 编译选项

<dl>

<dt class="option-term" id="option-cargo-install---target"><a class="option-anchor" href="#option-cargo-install---target"><code>--target</code> <em>tuple</em></a></dt>
<dd class="option-desc"><p>针对指定的目标架构进行安装。默认值为主机架构。该元组的通用格式为 <code>&lt;arch&gt;&lt;sub&gt;-&lt;vendor&gt;-&lt;sys&gt;-&lt;abi&gt;</code>。</p> <p>可能的值：</p> <ul> <li>在 <code>rustc --print target-list</code> 中看到的任何支持的目标。</li> <li><code>"host-tuple"</code>，内部会被替换为主机目标。如果你正在交叉编译某些库，且不想指定宿主机的机器作为目标（例如，在多个主机可使用的共享项目中使用的 <code>xtask</code>），这非常有用。</li> <li>指向自定义目标规范的路径。有关更多信息，请参阅 <a href="../../rustc/targets/custom.html#custom-target-lookup-path">自定义目标查找路径</a>。</li> </ul> <p>也可以通过 <code>build.target</code> <a href="../reference/config.html">配置值</a>来指定此参数。</p> <p>请注意，指定此标志会使 Cargo 以不同的模式运行，此时目标工件会被存放在单独的目录中。有关更多细节，请参阅 <a href="../reference/build-cache.html">构建缓存</a>文档。</p>
</dd>


<dt class="option-term" id="option-cargo-install---target-dir"><a class="option-anchor" href="#option-cargo-install---target-dir"><code>--target-dir</code> <em>directory</em></a></dt>
<dd class="option-desc"><p>所有生成的艺术品和中间文件的目录。也可以通过 <code>CARGO_TARGET_DIR</code> 环境变量或 <code>build.target-dir</code> <a href="../reference/config.html">配置值</a>来指定。默认情况下，会使用一个位于平台临时目录的新临时文件夹。</p> <p>当使用 <code>--path</code> 时，默认会使用本地 crate 的工作区中的 <code>target</code> 目录，除非指定了 <code>--target-dir</code>。</p>
</dd>


<dt class="option-term" id="option-cargo-install---debug"><a class="option-anchor" href="#option-cargo-install---debug"><code>--debug</code></a></dt>
<dd class="option-desc"><p>使用 <code>debug</code> 配置模式进行构建，而非 <code>release</code> 配置模式。 有关按名称选择特定配置模式的 <code>--profile</code> 选项，请参阅相关说明。</code></p>
</dd>


<dt class="option-term" id="option-cargo-install---profile"><a class="option-anchor" href="#option-cargo-install---profile"><code>--profile</code> <em>name</em></a></dt>
<dd class="option-desc"><p>使用给定的配置模式进行安装。 关于配置的更多详细信息，请参阅<a href="../reference/profiles.html">参考文档</a>。</code></p>
</dd>


<dt class="option-term" id="option-cargo-install---timings"><a class="option-anchor" href="#option-cargo-install---timings"><code>--timings</code></a></dt>
<dd class="option-desc"><p>输出每次编译所花费的时间，并随时间跟踪并发信息。</p> <p>在构建结束时，文件 <code>cargo-timing.html</code> 将被写入 <code>target/cargo-timings</code> 目录。如果您希望查看之前的运行结果，还会生成一个带有时间戳的文件名的额外报告。 这些报告仅适合人类阅读，不提供机器可读取的计时数据。</p>
</dd>



</dl>

### 清单选项

<dl>
<dt class="option-term" id="option-cargo-install---ignore-rust-version"><a class="option-anchor" href="#option-cargo-install---ignore-rust-version"><code>--ignore-rust-version</code></a></dt>
<dd class="option-desc"><p>忽略包中的 <code>rust-version</code> 规范。</p>
</dd>


<dt class="option-term" id="option-cargo-install---locked"><a class="option-anchor" href="#option-cargo-install---locked"><code>--locked</code></a></dt>
<dd class="option-desc"><p>确保使用的依赖项和版本与原始生成 <code>Cargo.lock</code> 文件时完全相同。如果出现以下任一情况，Cargo 将以错误退出： <ul> <li>锁文件缺失。</li> <li>由于不同的依赖解析导致 Cargo 尝试修改锁文件。</li> </ul> <p>该选项适用于需要确定性构建的环境，例如 CI 管道中。</p></p>
</dd>


<dt class="option-term" id="option-cargo-install---offline"><a class="option-anchor" href="#option-cargo-install---offline"><code>--offline</code></a></dt>
<dd class="option-desc"><p>防止 Cargo 出于任何原因访问网络。如果没有此标志，如果 Cargo 需要访问网络而网络不可用时，它将以错误退出。使用此标志后，Cargo 将尽可能在不联网的情况下继续运行。</p> <p>请注意，这可能导致与在线模式不同的依赖解析结果。即使本地索引中显示有更新版本，Cargo 也将限制自己仅使用本地下载的库。在离线前，请参阅 <a href="cargo-fetch.html">cargo-fetch(1)</a> 命令来下载依赖项。</p> <p>也可以通过 <code>net.offline</code> <a href="../reference/config.html">配置值</a>指定此选项。</p>
</dd>


<dt class="option-term" id="option-cargo-install---frozen"><a class="option-anchor" href="#option-cargo-install---frozen"><code>--frozen</code></a></dt>
<dd class="option-desc"><p>相当于同时指定 <code>--locked</code> 和 <code>--offline</code>。</p>
</dd>

</dl>

### 其他选项

<dl>
<dt class="option-term" id="option-cargo-install--j"><a class="option-anchor" href="#option-cargo-install--j"><code>-j</code> <em>N</em></a></dt>
<dt class="option-term" id="option-cargo-install---jobs"><a class="option-anchor" href="#option-cargo-install---jobs"><code>--jobs</code> <em>N</em></a></dt>
<dd class="option-desc"><p>要运行的并行任务数量。也可以通过 <code>build.jobs</code> <a href="../reference/config.html">配置值</a>来指定。默认值为逻辑CPU的数量。如果为负数，则将最大并行任务数设置为逻辑CPU数量加上提供的数值。如果提供字符串 <code>default</code>，则恢复为默认值。不应为0。</p>
</dd>

<dt class="option-term" id="option-cargo-install---keep-going"><a class="option-anchor" href="#option-cargo-install---keep-going"><code>--keep-going</code></a></dt>
<dd class="option-desc"><p>尽可能在依赖图中构建多个包，而不是在第一个构建失败的包上终止构建。</p> <p>例如，如果当前包依赖于 <code>fails</code> 和 <code>works</code> 两个依赖项，其中一个构建失败，则 <code>cargo install -j1</code> 可能无法构建成功的那个（取决于Cargo选择先运行哪个），而 <code>cargo install -j1 --keep-going</code> 则一定会运行两个构建过程，即使第一个运行的失败。</p>
</dd>

</dl>

### 显示选项

<dl>
<dt class="option-term" id="option-cargo-install--v"><a class="option-anchor" href="#option-cargo-install--v"><code>-v</code></a></dt>
<dt class="option-term" id="option-cargo-install---verbose"><a class="option-anchor" href="#option-cargo-install---verbose"><code>--verbose</code></a></dt>
<dd class="option-desc"><p>使用详细输出。可以通过 <code>term.verbose</code> <a href="../reference/config.html">配置值</a>指定两次以获得“非常详细”的输出，包含额外的输出如依赖警告和构建脚本输出。</p>
</dd>


<dt class="option-term" id="option-cargo-install--q"><a class="option-anchor" href="#option-cargo-install--q"><code>-q</code></a></dt>
<dt class="option-term" id="option-cargo-install---quiet"><a class="option-anchor" href="#option-cargo-install---quiet"><code>--quiet</code></a></dt>
<dd class="option-desc"><p>不要打印cargo日志消息。 也可以通过 <code>term.quiet</code> <a href="../reference/config.html">配置值</a>来指定。</p>
</dd>


<dt class="option-term" id="option-cargo-install---color"><a class="option-anchor" href="#option-cargo-install---color"><code>--color</code> <em>when</em></a></dt>
<dd class="option-desc"><p>控制彩色输出的使用情况。有效值包括：</p> <ul> <li><code>auto</code>（默认）：自动检测终端是否支持颜色。</li> <li><code>always</code>：始终显示颜色。</li> <li><code>never</code>：从不显示颜色。</li> </ul> <p>也可以通过 <code>term.color</code> <a href="../reference/config.html">配置值</a>来指定。</p>
</dd>


<dt class="option-term" id="option-cargo-install---message-format"><a class="option-anchor" href="#option-cargo-install---message-format"><code>--message-format</code> <em>fmt</em></a></dt>
<dd class="option-desc"><p>诊断信息的输出格式。可以多次指定，由逗号分隔的值组成。有效值：</p> <ul> <li><code>human</code>（默认）：以人类可读的文本格式显示。与 <code>short</code> 和 <code>json</code> 冲突。</li> <li><code>short</code>：输出更简短的人类可读文本信息。与 <code>human</code> 和 <code>json</code> 冲突。</li> <li><code>json</code>：将 JSON 信息输出到标准输出中。更多详情请参阅 <a href="../reference/external-tools.html#json-messages">参考文档</a> 。与 <code>human</code> 和 <code>short</code> 冲突。</li> <li><code>json-diagnostic-short</code>：确保 JSON 信息的 <code>rendered</code> 字段包含 rustc 的 “short” 渲染格式。不能与 <code>human</code> 或 <code>short</code> 一起使用。</li> <li><code>json-diagnostic-rendered-ansi</code>：确保 JSON 信息的 <code>rendered</code> 字段包含嵌入的 ANSI 颜色代码，以遵循 rustc 的默认颜色方案。不能与 <code>human</code> 或 <code>short</code> 一起使用。</li> <li><code>json-render-diagnostics</code>：指示 Cargo 在打印的 JSON 信息中不包含 rustc 诊断信息，而是由 Cargo 自身渲染来自 rustc 的 JSON 诊断信息。Cargo 自身的 JSON 诊断信息及其他来自 rustc 的信息仍会被输出。不能与 <code>human</code> 或 <code>short</code> 一起使用。</li> </ul> </dd> <dl> <dt class="option-term" id="option-cargo-install-+toolchain"><a class="option-anchor" href="#option-cargo-install-+toolchain"><code>+</code><em>工具链</em></a></dt> <dd class="option-desc"><p>如果 Cargo 通过 rustup 安装，且 <code>cargo</code> 的第一个参数以 <code>+</code> 开头，则会被解释为 rustup 工具链名称（如 <code>+stable</code> 或 <code>+nightly</code>）。 有关工具链覆盖机制的信息，请参阅 <a href="https://rust-lang.github.io/rustup/overrides.html">rustup 文档</a> 。</p> </dl>
</dd>


<dt class="option-term" id="option-cargo-install---config"><a class="option-anchor" href="#option-cargo-install---config"><code>--config</code> <em>KEY=VALUE</em> or <em>PATH</em></a></dt>
<dd class="option-desc"><p>覆盖 Cargo 配置值。参数应为 TOML 格式 <code>KEY=VALUE</code>，或作为额外配置文件的路径提供。此标志可以多次指定。 更多详情请参阅<a href="../reference/config.html#command-line-overrides">命令行覆盖部分</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-install--C"><a class="option-anchor" href="#option-cargo-install--C"><code>-C</code> <em>PATH</em></a></dt>
<dd class="option-desc"><p>在执行任何指定操作之前，更改当前工作目录。这会影响 cargo 默认查找项目清单 (<code>Cargo.toml</code>)的位置，以及搜索 <code>.cargo/config.toml</code> 的目录。此选项必须出现在命令名之前，例如 <code>cargo -C path/to/my-project build</code>。</p> <p>此选项仅适用于 <a href="https://doc.rust-lang.org/book/appendix-07-nightly-rust.html">夜间版本</a>，并且需要使用 <code>-Z unstable-options</code> 标志来启用（参见 <a href="https://github.com/rust-lang/cargo/issues/10098">#10098</a>）。</p>
</dd>


<dt class="option-term" id="option-cargo-install--h"><a class="option-anchor" href="#option-cargo-install--h"><code>-h</code></a></dt>
<dt class="option-term" id="option-cargo-install---help"><a class="option-anchor" href="#option-cargo-install---help"><code>--help</code></a></dt>
<dd class="option-desc"><p>打印帮助信息。</p>
</dd>


<dt class="option-term" id="option-cargo-install--Z"><a class="option-anchor" href="#option-cargo-install--Z"><code>-Z</code> <em>flag</em></a></dt>
<dd class="option-desc"><p>Cargo 的不稳定（仅夜间版本）标志。运行 <code>cargo -Z help</code> 获取详细信息。</p>
</dd>


</dl>

## 环境

有关 Cargo 读取的环境变量详情，请参阅 [参考手册](../reference/environment-variables.html)。

## 退出状态

* `0`: Cargo 执行成功。
* `101`: Cargo 未能完成执行。

## 示例

1. 从 crates.io 安装或升级一个包：

       cargo install ripgrep

2. 在当前目录中安装或重新安装该包：

       cargo install --path .

3. 查看已安装的包列表：

       cargo install --list

## 另请参阅 [cargo(1)](cargo.html), [cargo-uninstall(1)](cargo-uninstall.html), [cargo-search(1)](cargo-search.html), [cargo-publish(1)](cargo-publish.html)

[configuration discovery]: ../reference/config.html#hierarchical-structure
