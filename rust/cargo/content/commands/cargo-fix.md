# cargo-fix(1)
## 名称

cargo-fix --- 自动修复 rustc 报告的 lint 警告

## 使用说明

`cargo fix` [_选项_]

## 描述

此 Cargo 子命令会自动采纳 rustc 从诊断信息中获得的建议，并将其应用于您的源代码。其目的是帮助自动化 rustc 本身已知需要修复的任务！

执行 `cargo fix` 实际上会执行 [cargo-check(1)](cargo-check.html)。适用于您 crate 的所有警告将自动被修复（如果可能），所有剩余的警告将在检查过程结束后显示。例如，如果您希望应用当前包中的所有修复，可以运行：

    cargo fix

其行为与 `cargo check --all-targets` 相同。

`cargo fix` 仅能修复通过 `cargo check` 正常编译的代码。如果代码通过可选特性条件启用，您需要启用这些特性才能使代码被分析：

    cargo fix --features foo

类似地，其他 `cfg` 表达式（如特定平台的代码）需要传递 `--target` 参数来修复给定目标下的代码。

    cargo fix --目标 x86_64-pc-windows-gnu

如果您在使用 `cargo fix` 时遇到任何问题，或有任何疑问或功能请求，请随时在
<https://github.com/rust-lang/cargo>.

### 版本迁移

`cargo fix` 子命令也可用于将包从一个 [版本] 迁移到下一个版本。一般步骤如下：

1. 运行 `cargo fix --edition`。如果项目包含多个特性，也可以考虑使用 `--all-features` 标志。如果项目包含由 `cfg` 属性控制的特定平台代码，您可能还需要多次使用带有不同 `--target` 参数的 `cargo fix --edition`。
2. 修改 `Cargo.toml` 以将 [版本字段] 设置为新版本。
3. 运行项目测试以验证一切正常。如果出现新的警告，您可以考虑再次运行 `cargo fix`（不使用 `--edition` 标志），以便应用编译器提出的建议。

希望如此！请记住上述注意事项：`cargo fix` 无法更新不活跃功能的代码或 `cfg` 表达式。此外，在极少数情况下，编译器无法自动将所有代码迁移到新版本中，此时可能需要手动修改以适配新版本构建后的结果。


## 选项

### 修复选项

<dl>

<dt class="option-term" id="option-cargo-fix---broken-code"><a class="option-anchor" href="#option-cargo-fix---broken-code"><code>--broken-code</code></a></dt>
<dd class="option-desc"><p>即使代码已存在编译器错误，也仍可修复代码。如果 <code>cargo fix</code> 无法应用更改，此功能非常有用。它将应用更改，并将损坏的代码留在工作目录中，供您检查并手动修复。</p>
</dd>


<dt class="option-term" id="option-cargo-fix---edition"><a class="option-anchor" href="#option-cargo-fix---edition"><code>--edition</code></a></dt>
<dd class="option-desc"><p>应用将代码更新到下一个版本的更改。这不会更新 <code>Cargo.toml</code> 清单中的版本号，该文件必须在 <code>cargo fix --edition</code> 完成后手动更新。</p>
</dd>


<dt class="option-term" id="option-cargo-fix---edition-idioms"><a class="option-anchor" href="#option-cargo-fix---edition-idioms"><code>--edition-idioms</code></a></dt>
<dd class="option-desc"><p>应用将代码更新为当前版本的首选风格的建议。</p>
</dd>


<dt class="option-term" id="option-cargo-fix---allow-no-vcs"><a class="option-anchor" href="#option-cargo-fix---allow-no-vcs"><code>--allow-no-vcs</code></a></dt>
<dd class="option-desc"><p>即使未检测到 VCS，也仍可修复代码。</p>
</dd>


<dt class="option-term" id="option-cargo-fix---allow-dirty"><a class="option-anchor" href="#option-cargo-fix---allow-dirty"><code>--allow-dirty</code></a></dt>
<dd class="option-desc"><p>即使工作目录中有更改（包括暂存更改），也仍可修复代码。</p>
</dd>


<dt class="option-term" id="option-cargo-fix---allow-staged"><a class="option-anchor" href="#option-cargo-fix---allow-staged"><code>--allow-staged</code></a></dt>
<dd class="option-desc"><p>即使工作目录中有暂存更改，也仍可修复代码。</p>
</dd>


</dl>

### 包选择

默认情况下，如果没有提供包选择选项，所选的包将依赖于选定的清单文件（如果未指定 `--manifest-path`，则基于当前工作目录）。如果清单是工作空间的根目录，则将选择工作空间的默认成员；否则仅选择清单中定义的包。

工作空间的默认成员可以通过根清单中的 `workspace.default-members` 键显式设置。如果不进行设置，虚拟工作空间将包含所有工作空间成员（相当于传递 `--workspace` 参数），而非虚拟工作空间则仅包含根 crate 本身。

<dl>

<dt class="option-term" id="option-cargo-fix--p"><a class="option-anchor" href="#option-cargo-fix--p"><code>-p</code> <em>spec</em>…</a></dt>
<dt class="option-term" id="option-cargo-fix---package"><a class="option-anchor" href="#option-cargo-fix---package"><code>--package</code> <em>spec</em>…</a></dt>
<dd class="option-desc"><p>仅修复指定的包。有关 SPEC 格式，请参阅 <a href="cargo-pkgid.html">cargo-pkgid(1)</a>。此标志可以多次指定，并支持常见的 Unix glob 模式，如 <code>*</code>、<code>?</code> 和 <code>[]</code>。然而，为了避免您的 shell 在 Cargo 处理之前意外展开 glob 模式，您必须在每个模式周围使用单引号或双引号。</p>
</dd>


<dt class="option-term" id="option-cargo-fix---workspace"><a class="option-anchor" href="#option-cargo-fix---workspace"><code>--workspace</code></a></dt>
<dd class="option-desc"><p>修复工作空间中的所有成员。</p>
</dd>


<dt class="option-term" id="option-cargo-fix---all"><a class="option-anchor" href="#option-cargo-fix---all"><code>--all</code></a></dt>
<dd class="option-desc"><p><code>--workspace</code> 的已废弃别名。</p>
</dd>


<dt class="option-term" id="option-cargo-fix---exclude"><a class="option-anchor" href="#option-cargo-fix---exclude"><code>--exclude</code> <em>SPEC</em>…</a></dt>
<dd class="option-desc"><p>排除指定的包。必须与 <code>--workspace</code> 标志一起使用。此标志可以多次指定，并支持常见的 Unix glob 模式，如 <code>*</code>、<code>?</code> 和 <code>[]</code>。然而，为了避免您的 shell 在 Cargo 处理之前意外展开 glob 模式，您必须在每个模式周围使用单引号或双引号。</p>
</dd>


</dl>

### 目标选择

如果没有提供目标选择选项，`cargo fix` 将修复所有目标（`--all-targets` 为隐含选项）。如果二进制文件具有缺失的 `required-features`，则将被跳过。

传递目标选择标志仅能修复指定的目标。

请注意，`--bin`、`--example`、`--test` 和 `--bench` 标志也支持常见的 Unix glob 模式，如 `*`、`?` 和 `[]`。然而，为了避免 Shell 在 Cargo 处理之前意外展开这些 glob 模式，您必须在每个 glob 模式周围使用单引号或双引号。

<dl>

<dt class="option-term" id="option-cargo-fix---lib"><a class="option-anchor" href="#option-cargo-fix---lib"><code>--lib</code></a></dt>
<dd class="option-desc"><p>修复包的库文件。</p>
</dd>


<dt class="option-term" id="option-cargo-fix---bin"><a class="option-anchor" href="#option-cargo-fix---bin"><code>--bin</code> <em>name</em>…</a></dt>
<dd class="option-desc"><p>修复指定的二进制文件。此标志可以多次指定，并支持常见的 Unix glob 模式。</p>
</dd>


<dt class="option-term" id="option-cargo-fix---bins"><a class="option-anchor" href="#option-cargo-fix---bins"><code>--bins</code></a></dt>
<dd class="option-desc"><p>修复所有二进制目标。</p>
</dd>


<dt class="option-term" id="option-cargo-fix---example"><a class="option-anchor" href="#option-cargo-fix---example"><code>--example</code> <em>name</em>…</a></dt>
<dd class="option-desc"><p>修复指定的示例。此标志可以多次指定，并支持常见的 Unix glob 模式。</p>
</dd>


<dt class="option-term" id="option-cargo-fix---examples"><a class="option-anchor" href="#option-cargo-fix---examples"><code>--examples</code></a></dt>
<dd class="option-desc"><p>修复所有示例目标。</p>
</dd>


<dt class="option-term" id="option-cargo-fix---test"><a class="option-anchor" href="#option-cargo-fix---test"><code>--test</code> <em>name</em>…</a></dt>
<dd class="option-desc"><p>修复指定的集成测试。此标志可以多次指定，并支持常见的 Unix glob 模式。</p>
</dd>


<dt class="option-term" id="option-cargo-fix---tests"><a class="option-anchor" href="#option-cargo-fix---tests"><code>--tests</code></a></dt>
<dd class="option-desc"><p>修复所有设置了 <code>test = true</code> 清单标志的目标。默认情况下，这包括作为单元测试和集成测试构建的库及二进制文件。请注意，这也会构建所有必要的依赖项，因此 lib 目标可能会被构建两次（一次作为单元测试，一次作为二进制文件、集成测试等的依赖）。可以通过在目标的清单设置中设置 <code>test</code> 标志来启用或禁用这些目标。</p>
</dd>


<dt class="option-term" id="option-cargo-fix---bench"><a class="option-anchor" href="#option-cargo-fix---bench"><code>--bench</code> <em>name</em>…</a></dt>
<dd class="option-desc"><p>修复指定的基准测试。此标志可以多次指定，并支持常见的 Unix glob 模式。</p>
</dd>


<dt class="option-term" id="option-cargo-fix---benches"><a class="option-anchor" href="#option-cargo-fix---benches"><code>--benches</code></a></dt>
<dd class="option-desc"><p>修复所有设置了 <code>bench = true</code> 清单标志的目标。默认情况下，这包括作为基准测试和 bench 目标构建的库及二进制文件。请注意，这也会构建所有必要的依赖项，因此 lib 目标可能会被构建两次（一次作为基准测试，一次作为二进制文件、基准测试等的依赖）。可以通过在目标的清单设置中设置 <code>bench</code> 标志来启用或禁用这些目标。</p>
</dd>


<dt class="option-term" id="option-cargo-fix---all-targets"><a class="option-anchor" href="#option-cargo-fix---all-targets"><code>--all-targets</code></a></dt>
<dd class="option-desc"><p>修复所有目标。这相当于指定 <code>--lib --bins --tests --benches --examples</code>。</p>
</dd>


</dl>

### 功能选择

功能标志允许您控制哪些功能被启用。如果没有提供功能选项，每个选定的包都将激活 `default` 功能。

有关更多细节，请参阅 [功能文档](../reference/features.html#command-line-特性-options)。

<dl>

<dt class="option-term" id="option-cargo-fix--F"><a class="option-anchor" href="#option-cargo-fix--F"><code>-F</code> <em>features</em></a></dt>
<dt class="option-term" id="option-cargo-fix---features"><a class="option-anchor" href="#option-cargo-fix---features"><code>--features</code> <em>features</em></a></dt>
<dd class="option-desc"><p>激活要使用的功能的空格或逗号分隔列表。工作区成员的功能可以通过 <code>package-name/feature-name</code> 语法来启用。此标志可以多次指定，从而启用所有指定的功能。</p>
</dd>


<dt class="option-term" id="option-cargo-fix---all-features"><a class="option-anchor" href="#option-cargo-fix---all-features"><code>--all-features</code></a></dt>
<dd class="option-desc"><p>激活所有选定包的所有可用功能。</p>
</dd>


<dt class="option-term" id="option-cargo-fix---no-default-features"><a class="option-anchor" href="#option-cargo-fix---no-default-features"><code>--no-default-features</code></a></dt>
<dd class="option-desc"><p>不要激活选定包的 <code>default</code> 功能。</p>
</dd>


</dl>

### 编译选项

<dl>

<dt class="option-term" id="option-cargo-fix---target"><a class="option-anchor" href="#option-cargo-fix---target"><code>--target</code> <em>tuple</em></a></dt>
<dd class="option-desc"><p>针对指定目标架构的修复方案。该标志可以多次指定，默认值为主机架构。元组的一般格式为 <code>&lt;arch&gt;&lt;sub&gt;-&lt;vendor&gt;-&lt;sys&gt;-&lt;abi&gt;</code>。</p> <p>可能的值：</p> <ul> <li>在 <code>rustc --print target-list</code> 中可看到的任何支持的目标。</li> <li><code>"host-tuple"</code>，该值将内部被宿主目标替代。如果你正在交叉编译某些库，且不想将宿主机器作为目标（例如，在多个主机可能参与的共享项目中使用的 <code>xtask</code>），此选项非常有用。</li> <li>指向自定义目标规范的路径。有关更多信息，请参阅 <a href="../../rustc/targets/custom.html#custom-target-lookup-path">自定义目标查找路径</a>。</li> </ul> <p>也可以通过 <code>build.target</code> <a href="../reference/config.html">配置值</a>来指定此标志。</p> <p>请注意，指定该标志会使 Cargo 以不同的模式运行，此时目标产物会被存放在单独的目录中。有关更多细节，请参阅 <a href="../reference/build-cache.html">构建缓存</a>文档。</p>
</dd>


<dt class="option-term" id="option-cargo-fix--r"><a class="option-anchor" href="#option-cargo-fix--r"><code>-r</code></a></dt>
<dt class="option-term" id="option-cargo-fix---release"><a class="option-anchor" href="#option-cargo-fix---release"><code>--release</code></a></dt>
<dd class="option-desc"><p>使用 <code>release</code> 配置修复优化后的产物。 另请参阅 <code>--profile</code> 选项以按名称选择特定配置。</p>
</dd>


<dt class="option-term" id="option-cargo-fix---profile"><a class="option-anchor" href="#option-cargo-fix---profile"><code>--profile</code> <em>name</em></a></dt>
<dd class="option-desc"><p>使用给定配置进行修复。</p> <p>作为一个特殊情况，指定 <code>test</code> 配置还将启用测试模式检查，从而能够检查测试并启用 <code>test</code> 配置选项。有关更多详情，请参阅 <a href="https://doc.rust-lang.org/rustc/tests/index.html">rustc 测试</a>。</p> <p>有关配置的更多细节，请参阅 <a href="../reference/profiles.html">参考文档</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-fix---timings"><a class="option-anchor" href="#option-cargo-fix---timings"><code>--timings</code></a></dt>
<dd class="option-desc"><p>输出每个编译所花费的时间，并随时间跟踪并发信息。</p> <p>在构建结束时，一个文件 <code>cargo-timing.html</code> 将被写入 <code>target/cargo-timings</code> 目录。如果您想查看之前的运行结果，还会生成一个带有时间戳的文件名的额外报告。这些报告仅适合人类阅读，不提供机器可读取的计时数据。</p>
</dd>



</dl>

### 输出选项

<dl>
<dt class="option-term" id="option-cargo-fix---target-dir"><a class="option-anchor" href="#option-cargo-fix---target-dir"><code>--target-dir</code> <em>directory</em></a></dt>
<dd class="option-desc"><p>所有生成的艺术品和中间文件的目录。也可以通过 <code>CARGO_TARGET_DIR</code> 环境变量或 <code>build.target-dir</code> <a href="../reference/config.html">配置值</a>来指定。默认值为工作空间根目录下的 <code>target</code>。</p>
</dd>

</dl>

### 显示选项

<dl>
<dt class="option-term" id="option-cargo-fix--v"><a class="option-anchor" href="#option-cargo-fix--v"><code>-v</code></a></dt>
<dt class="option-term" id="option-cargo-fix---verbose"><a class="option-anchor" href="#option-cargo-fix---verbose"><code>--verbose</code></a></dt>
<dd class="option-desc"><p>使用详细输出。可以通过两次设置来获得“非常详细”的输出，包含额外的内容如依赖警告和构建脚本输出。也可以通过 <code>term.verbose</code> <a href="../reference/config.html">配置值</a>来指定。</p>
</dd>


<dt class="option-term" id="option-cargo-fix--q"><a class="option-anchor" href="#option-cargo-fix--q"><code>-q</code></a></dt>
<dt class="option-term" id="option-cargo-fix---quiet"><a class="option-anchor" href="#option-cargo-fix---quiet"><code>--quiet</code></a></dt>
<dd class="option-desc"><p>不要打印 cargo 日志消息。也可以通过 <code>term.quiet</code> <a href="../reference/config.html">配置值</a>来指定。</p>
</dd>


<dt class="option-term" id="option-cargo-fix---color"><a class="option-anchor" href="#option-cargo-fix---color"><code>--color</code> <em>when</em></a></dt>
<dd class="option-desc"><p>控制是否使用彩色输出。有效值包括：</p> <ul> <li><code>auto</code>（默认）：自动检测终端是否支持颜色显示。</li> <li><code>always</code>：始终显示颜色。</li> <li><code>never</code>：从不显示颜色。</li> </ul> <p>也可以通过 <code>term.color</code> <a href="../reference/config.html">配置值</a>来指定。</p>
</dd>


<dt class="option-term" id="option-cargo-fix---message-format"><a class="option-anchor" href="#option-cargo-fix---message-format"><code>--message-format</code> <em>fmt</em></a></dt>
<dd class="option-desc"><p>诊断信息的输出格式。可以多次指定，由逗号分隔的值组成。有效值：</p> <ul> <li><code>human</code>（默认）：以人类可读的文本格式显示。与 <code>short</code> 和 <code>json</code> 冲突。</li> <li><code>short</code>：输出更简短、人类可读的文本消息。与 <code>human</code> 和 <code>json</code> 冲突。</li> <li><code>json</code>：将 JSON 消息输出到标准输出中。更多详情请参阅 <a href="../reference/external-tools.html#json-messages">参考文档</a>。与 <code>human</code> 和 <code>short</code> 冲突。</li> <li><code>json-diagnostic-short</code>：确保 JSON 消息的 <code>rendered</code> 字段包含 rustc 生成的“短”格式。不能与 <code>human</code> 或 <code>short</code> 一起使用。</li> <li><code>json-diagnostic-rendered-ansi</code>：确保 JSON 消息的 <code>rendered</code> 字段包含嵌入的 ANSI 颜色代码，以遵循 rustc 的默认颜色方案。不能与 <code>human</code> 或 <code>short</code> 一起使用。</li> <li><code>json-render-diagnostics</code>：指示 Cargo 在打印的 JSON 消息中不包含 rustc 诊断信息，而是由 Cargo 自身渲染来自 rustc 的 JSON 诊断信息。Cargo 自身的 JSON 诊断信息及来自 rustc 的其他诊断信息仍会被输出。不能与 <code>human</code> 或 <code>short</code> 一起使用。</li> </ul> </dd> </dl> ### Manifest 选项 <dl> <dt class="option-term" id="option-cargo-fix---manifest-path"><a class="option-anchor" href="#option-cargo-fix---manifest-path"><code>--manifest-path</code> <em>路径</em></a></dt> <dd class="option-desc"><p><code>Cargo.toml</code> 文件的路径。默认情况下，Cargo 会在当前目录或任何父目录中查找 <code>Cargo.toml</code> 文件。</li></p>
</dd>


<dt class="option-term" id="option-cargo-fix---ignore-rust-version"><a class="option-anchor" href="#option-cargo-fix---ignore-rust-version"><code>--ignore-rust-version</code></a></dt>
<dd class="option-desc"><p>忽略包中的 <code>rust-version</code> 规范。</p>
</dd>


<dt class="option-term" id="option-cargo-fix---locked"><a class="option-anchor" href="#option-cargo-fix---locked"><code>--locked</code></a></dt>
<dd class="option-desc"><p>断言所使用的依赖项和版本与原始生成 <code>Cargo.lock</code> 文件时完全相同。当出现以下任一情况时，Cargo 将以错误退出： <ul> <li>锁定文件缺失。</li> <li>由于不同的依赖解析导致 Cargo 尝试修改锁定文件。</li> </ul> 该选项适用于需要确定性构建的环境，例如 CI 流水线中。</p>
</dd>


<dt class="option-term" id="option-cargo-fix---offline"><a class="option-anchor" href="#option-cargo-fix---offline"><code>--offline</code></a></dt>
<dd class="option-desc"><p>防止 Cargo 出于任何原因访问网络。如果没有此标志，如果 Cargo 需要访问网络而网络不可用时，它将以错误退出。使用此标志后，Cargo 将尽可能在不连接网络的情况下继续运行。 请注意，这可能导致与在线模式不同的依赖解析结果。即使本地索引中显示有更新版本，Cargo 也将限制自己仅使用本地下载的包。在离线操作前，请参考 <a href="cargo-fetch.html">cargo-fetch(1)</a> 命令来下载依赖项。 也可以通过 <code>net.offline</code> <a href="../reference/config.html">配置值</a>指定此选项。</p>
</dd>


<dt class="option-term" id="option-cargo-fix---frozen"><a class="option-anchor" href="#option-cargo-fix---frozen"><code>--frozen</code></a></dt>
<dd class="option-desc"><p>相当于同时指定 <code>--locked</code> 和 <code>--offline</code> 选项。</p>
</dd>


</dl>

### 常用选项

<dl>

<dt class="option-term" id="option-cargo-fix-+toolchain"><a class="option-anchor" href="#option-cargo-fix-+toolchain"><code>+</code><em>toolchain</em></a></dt>
<dd class="option-desc"><p>如果 Cargo 通过 rustup 安装，且 <code>cargo</code> 的第一个参数以 <code>+</code> 开头，则会被解释为 rustup 工具链名称（如 <code>+stable</code> 或 <code>+nightly</code>）。 有关工具链覆盖机制更多信息，请参阅 <a href="https://rust-lang.github.io/rustup/overrides.html">rustup 文档</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-fix---config"><a class="option-anchor" href="#option-cargo-fix---config"><code>--config</code> <em>KEY=VALUE</em> or <em>PATH</em></a></dt>
<dd class="option-desc"><p>用于覆盖 Cargo 配置值。参数应为 TOML 格式 <code>KEY=VALUE</code>，或作为额外配置文件的路径提供。此标志可以多次指定。有关更多信息，请参阅 <a href="../reference/config.html#command-line-overrides">命令行覆盖部分</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-fix--C"><a class="option-anchor" href="#option-cargo-fix--C"><code>-C</code> <em>PATH</em></a></dt>
<dd class="option-desc"><p>在执行任何指定操作之前，更改当前工作目录。这会影响诸如 cargo 默认查找项目清单 (<code>Cargo.toml</code>)的位置，以及搜索以发现 <code>.cargo/config.toml</code> 的目录等。此选项必须出现在命令名称之前，例如 <code>cargo -C path/to/my-project build</code>。</p> <p>此选项仅适用于 <a href="https://doc.rust-lang.org/book/appendix-07-nightly-rust.html">nightly 版本</a>，并且需要使用 <code>-Z unstable-options</code> 标志才能启用（参见 <a href="https://github.com/rust-lang/cargo/issues/10098">#10098</a>）。</p>
</dd>


<dt class="option-term" id="option-cargo-fix--h"><a class="option-anchor" href="#option-cargo-fix--h"><code>-h</code></a></dt>
<dt class="option-term" id="option-cargo-fix---help"><a class="option-anchor" href="#option-cargo-fix---help"><code>--help</code></a></dt>
<dd class="option-desc"><p>打印帮助信息。</p>
</dd>


<dt class="option-term" id="option-cargo-fix--Z"><a class="option-anchor" href="#option-cargo-fix--Z"><code>-Z</code> <em>flag</em></a></dt>
<dd class="option-desc"><p>Cargo 的不稳定（仅 nightly 版本）标志。运行 <code>cargo -Z help</code> 以获取详细信息。</p>
</dd>


</dl>

### 其他选项

<dl>
<dt class="option-term" id="option-cargo-fix--j"><a class="option-anchor" href="#option-cargo-fix--j"><code>-j</code> <em>N</em></a></dt>
<dt class="option-term" id="option-cargo-fix---jobs"><a class="option-anchor" href="#option-cargo-fix---jobs"><code>--jobs</code> <em>N</em></a></dt>
<dd class="option-desc"><p>要运行的并行任务数量。也可以通过 <code>build.jobs</code> <a href="../reference/config.html">配置值</a>指定。默认值为逻辑 CPU 数。如果为负数，则将最大并行任务数设置为逻辑 CPU 数加上提供的数值。如果提供字符串 <code>default</code>，则将其重置为默认值。不应为 0。</p>
</dd>

<dt class="option-term" id="option-cargo-fix---keep-going"><a class="option-anchor" href="#option-cargo-fix---keep-going"><code>--keep-going</code></a></dt>
<dd class="option-desc"><p>尽可能多地构建依赖图中所有的包，而不是在第一个构建失败的包上终止构建。</p> <p>例如，如果当前包依赖于 <code>fails</code> 和 <code>works</code> 两个依赖项，其中一个构建失败，<code>cargo fix -j1</code> 可能能够或无法构建成功的那个（取决于 Cargo 首先选择运行哪个构建），而 <code>cargo fix -j1 --keep-going</code> 则一定会运行两个构建，即使第一个运行的失败。</p>
</dd>

</dl>

## 环境

有关 Cargo 读取的环境变量详情，请参阅 [参考手册](../reference/environment-variables.html)。

## 退出状态

* `0`: Cargo 成功执行。
* `101`: Cargo 未能完成。

## 示例

1. 对本地包应用编译器建议：

       cargo fix

2. 更新包以准备下一个版本：

       cargo fix --edition

3. 应用当前版本的推荐惯用法：

       cargo fix --edition-idioms

## 另请参阅 [cargo(1)](cargo.html)、[cargo-check(1)](cargo-check.html)

[edition]: https://doc.rust-lang.org/edition-guide/editions/transitioning-an-existing-project-to-a-new-edition.html
[edition field]: ../reference/manifest.html#the-edition-field
