# cargo-publish(1)
## 名称

cargo-publish —— 将包上传到注册表

## 概述

`cargo publish` [_选项_]

## 描述

此命令将在当前目录中创建包含包源代码的可分发、压缩的 `.crate` 文件，并将其上传到注册表。默认注册表为 <https://crates.io>。该过程包括以下步骤：

1. 进行若干检查，包括：
   - 检查清单中的 `package.publish` 键，以确定允许向哪些注册表发布。
2. 按照 [cargo-包(1)](cargo-包.html) 中的步骤创建 `.crate` 文件。
3. 将 `.crate` 文件上传到注册表。服务器会对该包进行额外检查。
4. 客户端会轮询等待包出现在索引中，可能会超时。在这种情况下，您需要手动检查是否完成。此超时不影响上传过程。

此命令要求使用 [cargo-login(1)](cargo-login.html) 或 [`registry.token`](../reference/config.html#registrytoken) 和 [`registries.<name>.token`](../reference/config.html#registriesnametoken) 配置字段的环境变量进行认证。

有关打包和发布方面的更多细节，请参阅 [参考手册](../reference/publishing.html)。

## 选项

### 发布选项

<dl>

<dt class="option-term" id="option-cargo-publish---dry-run"><a class="option-anchor" href="#option-cargo-publish---dry-run"><code>--dry-run</code></a></dt>
<dd class="option-desc"><p>在不上传文件的情况下执行所有检查。</p>
</dd>


<dt class="option-term" id="option-cargo-publish---no-verify"><a class="option-anchor" href="#option-cargo-publish---no-verify"><code>--no-verify</code></a></dt>
<dd class="option-desc"><p>不要通过构建来验证内容。</p>
</dd>


<dt class="option-term" id="option-cargo-publish---allow-dirty"><a class="option-anchor" href="#option-cargo-publish---allow-dirty"><code>--allow-dirty</code></a></dt>
<dd class="option-desc"><p>允许包含未提交 VCS 更改的工作目录被打包。</p>
</dd>


<dt class="option-term" id="option-cargo-publish---index"><a class="option-anchor" href="#option-cargo-publish---index"><code>--index</code> <em>index</em></a></dt>
<dd class="option-desc"><p>要使用的注册表索引的 URL。</p>
</dd>


<dt class="option-term" id="option-cargo-publish---registry"><a class="option-anchor" href="#option-cargo-publish---registry"><code>--registry</code> <em>registry</em></a></dt>
<dd class="option-desc"><p>要发布的注册表名称。注册表名称定义在 <a href="../reference/config.html">Cargo config 文件</a>中。如果未指定，且 <code>Cargo.toml</code> 中有 <a href="../reference/manifest.html#the-publish-field"><code>package.publish</code></a> 字段指向单个注册表，则将其发布到该注册表；否则将使用由 <a href../reference/config.html#registrydefault"><code>registry.default</code></a> config 键定义的默认注册表，其默认值为 <code>crates-io</code>。</p>
</dd>


</dl>

### 包选择

默认情况下，如果没有提供包选择选项，所选包取决于选定的清单文件（如果未指定 `--manifest-path`，则基于当前工作目录）。如果清单是工作空间的根目录，则选择工作空间的默认成员；否则仅选择清单中定义的包。

工作空间的默认成员可以通过根清单中的 `workspace.default-members` 键显式设置。如果未设置此选项，虚拟工作空间将包含所有工作空间成员（相当于传递 `--workspace` 参数），非虚拟工作空间则仅包含根 crate。

<dl>

<dt class="option-term" id="option-cargo-publish--p"><a class="option-anchor" href="#option-cargo-publish--p"><code>-p</code> <em>spec</em>…</a></dt>
<dt class="option-term" id="option-cargo-publish---package"><a class="option-anchor" href="#option-cargo-publish---package"><code>--package</code> <em>spec</em>…</a></dt>
<dd class="option-desc"><p>仅发布指定的包。有关 SPEC 格式，请参阅 <a href="cargo-pkgid.html">cargo-pkgid(1)</a>。此标志可以多次指定，并支持常见的 Unix glob 模式，如 <code>*</code>、<code>?</code> 和 <code>[]</code>。但是，为了避免 shell 在 Cargo 处理之前意外展开 glob 模式，必须在每个模式下使用单引号或双引号。</p>
</dd>


<dt class="option-term" id="option-cargo-publish---workspace"><a class="option-anchor" href="#option-cargo-publish---workspace"><code>--workspace</code></a></dt>
<dd class="option-desc"><p>发布工作空间中的所有成员。</p>
</dd>


<dt class="option-term" id="option-cargo-publish---all"><a class="option-anchor" href="#option-cargo-publish---all"><code>--all</code></a></dt>
<dd class="option-desc"><p><code>--workspace</code> 的已弃用别名。</p>
</dd>


<dt class="option-term" id="option-cargo-publish---exclude"><a class="option-anchor" href="#option-cargo-publish---exclude"><code>--exclude</code> <em>SPEC</em>…</a></dt>
<dd class="option-desc"><p>排除指定的包。必须与 <code>--workspace</code> 标志一起使用。此标志可以多次指定，并支持常见的 Unix glob 模式，如 <code>*</code>、<code>?</code> 和 <code>[]</code>。但是，为了避免 shell 在 Cargo 处理之前意外展开 glob 模式，必须在每个模式下使用单引号或双引号。</p>
</dd>


</dl>

### 编译选项

<dl>

<dt class="option-term" id="option-cargo-publish---target"><a class="option-anchor" href="#option-cargo-publish---target"><code>--target</code> <em>tuple</em></a></dt>
<dd class="option-desc"><p>针对指定的目标架构进行发布。可以多次指定此标志，默认值为主机架构。该元组的通用格式为 <code>&lt;arch&gt;&lt;sub&gt;-&lt;vendor&gt;-&lt;sys&gt;-&lt;abi&gt;</code>。</p> <p>可能的值：</p> <ul> <li>在 <code>rustc --print target-list</code> 中支持的任何目标。</li> <li><code>"host-tuple"</code>，系统会内部替换为主机目标。如果你正在交叉编译某些库，且不想将主机机器作为目标指定（例如，在多个主机可使用的共享项目中使用的 <code>xtask</code>），则非常有用。</li> <li>指向自定义目标规范的路径。有关更多信息，请参阅<a href="../../rustc/targets/custom.html#custom-target-lookup-path">自定义目标查找路径</a>。</li> </ul> <p>也可以通过 <code>build.target</code> <a href="../reference/config.html">配置值</a>来指定此标志。</p> <p>请注意，指定此标志会使 Cargo 以不同的模式运行，此时目标工件被放置在单独的目录中。有关更多细节，请参阅<a href="../reference/build-cache.html">构建缓存</a>文档。</p>
</dd>


<dt class="option-term" id="option-cargo-publish---target-dir"><a class="option-anchor" href="#option-cargo-publish---target-dir"><code>--target-dir</code> <em>directory</em></a></dt>
<dd class="option-desc"><p>所有生成的艺术品和中间文件的目录。也可以通过 <code>CARGO_TARGET_DIR</code> 环境变量或 <code>build.target-dir</code> <a href="../reference/config.html">配置值</a>来指定。 默认值为工作空间根目录中的 <code>target</code>。</p>
</dd>


</dl>

### 功能选择

功能标志允许你控制哪些功能被启用。当没有指定功能选项时，每个选定的包都会激活 `default` 功能。

更多详情请参见 [功能文档](../reference/features.html#command-line-特性-options)。

<dl>

<dt class="option-term" id="option-cargo-publish--F"><a class="option-anchor" href="#option-cargo-publish--F"><code>-F</code> <em>features</em></a></dt>
<dt class="option-term" id="option-cargo-publish---features"><a class="option-anchor" href="#option-cargo-publish---features"><code>--features</code> <em>features</em></a></dt>
<dd class="option-desc"><p>要激活的功能的空格或逗号分隔列表。工作区成员的功能可以通过 <code>package-name/feature-name</code> 语法启用。此标志可以多次指定，从而激活所有指定的功能。</p>
</dd>


<dt class="option-term" id="option-cargo-publish---all-features"><a class="option-anchor" href="#option-cargo-publish---all-features"><code>--all-features</code></a></dt>
<dd class="option-desc"><p>激活所有选定包可用的功能。</p>
</dd>


<dt class="option-term" id="option-cargo-publish---no-default-features"><a class="option-anchor" href="#option-cargo-publish---no-default-features"><code>--no-default-features</code></a></dt>
<dd class="option-desc"><p>不激活选定包的 <code>default</code> 功能。</p>
</dd>


</dl>

### 清单选项

<dl>

<dt class="option-term" id="option-cargo-publish---manifest-path"><a class="option-anchor" href="#option-cargo-publish---manifest-path"><code>--manifest-path</code> <em>path</em></a></dt>
<dd class="option-desc"><p><code>Cargo.toml</code> 文件的路径。默认情况下，Cargo 会在当前目录或任何父目录中搜索 <code>Cargo.toml</code> 文件。</p>
</dd>


<dt class="option-term" id="option-cargo-publish---locked"><a class="option-anchor" href="#option-cargo-publish---locked"><code>--locked</code></a></dt>
<dd class="option-desc"><p>断言所使用的依赖项和版本与原始生成 <code>Cargo.lock</code> 文件时完全相同。当出现以下任一情况时，Cargo 将以错误退出： <ul> <li>锁定文件缺失。</li> <li>由于不同的依赖解析导致 Cargo 尝试修改锁定文件。</li> </ul> 该选项可用于需要确定性构建的环境，例如 CI 流水线中。</p>
</dd>


<dt class="option-term" id="option-cargo-publish---offline"><a class="option-anchor" href="#option-cargo-publish---offline"><code>--offline</code></a></dt>
<dd class="option-desc"><p>防止 Cargo 出于任何原因访问网络。如果没有此标志，如果 Cargo 需要访问网络而网络不可用时，它将以错误退出。使用此标志后，Cargo 将尽可能在不联网的情况下继续运行。 请注意，这可能导致与在线模式不同的依赖解析。Cargo 将限制自己仅使用本地下载的库，即使本地索引中显示有更新版本也是如此。在离线操作前，请参考 <a href="cargo-fetch.html">cargo-fetch(1)</a> 命令来下载依赖项。 也可以通过 <code>net.offline</code> <a href="../reference/config.html">配置值</a>指定此选项。</p>
</dd>


<dt class="option-term" id="option-cargo-publish---frozen"><a class="option-anchor" href="#option-cargo-publish---frozen"><code>--frozen</code></a></dt>
<dd class="option-desc"><p>相当于同时指定 <code>--locked</code> 和 <code>--offline</code> 选项。</p>
</dd>



</dl>

### 其他选项

<dl>
<dt class="option-term" id="option-cargo-publish--j"><a class="option-anchor" href="#option-cargo-publish--j"><code>-j</code> <em>N</em></a></dt>
<dt class="option-term" id="option-cargo-publish---jobs"><a class="option-anchor" href="#option-cargo-publish---jobs"><code>--jobs</code> <em>N</em></a></dt>
<dd class="option-desc"><p>要运行的并行作业数量。也可以通过 <code>build.jobs</code> <a href="../reference/config.html">配置值</a>指定。默认值为逻辑 CPU 数。如果为负数，则将最大并行作业数设置为逻辑 CPU 数加上提供的数值。如果提供字符串 <code>default</code>，则将其重置为默认值。 不应为 0。</p>
</dd>

<dt class="option-term" id="option-cargo-publish---keep-going"><a class="option-anchor" href="#option-cargo-publish---keep-going"><code>--keep-going</code></a></dt>
<dd class="option-desc"><p>尽可能在依赖图中构建多个包，而不是在第一个构建失败的包上终止构建。</p> <p>例如，如果当前包依赖于 <code>fails</code> 和 <code>works</code>，其中有一个构建失败，<code>cargo publish -j1</code> 可能能够或无法构建成功的那个（取决于 Cargo 选择先运行哪个），而 <code>cargo publish -j1 --keep-going</code> 则一定会运行两个构建过程，即使第一个运行的失败。</p>
</dd>

</dl>

### 显示选项

<dl>
<dt class="option-term" id="option-cargo-publish--v"><a class="option-anchor" href="#option-cargo-publish--v"><code>-v</code></a></dt>
<dt class="option-term" id="option-cargo-publish---verbose"><a class="option-anchor" href="#option-cargo-publish---verbose"><code>--verbose</code></a></dt>
<dd class="option-desc"><p>使用详细输出。可以指定两次以得到“非常详细”的输出，包含额外的内容如依赖警告和构建脚本输出。也可以通过 <code>term.verbose</code> <a href="../reference/config.html">配置值</a>来指定。</p>
</dd>


<dt class="option-term" id="option-cargo-publish--q"><a class="option-anchor" href="#option-cargo-publish--q"><code>-q</code></a></dt>
<dt class="option-term" id="option-cargo-publish---quiet"><a class="option-anchor" href="#option-cargo-publish---quiet"><code>--quiet</code></a></dt>
<dd class="option-desc"><p>不要打印 cargo 日志消息。也可以通过 <code>term.quiet</code> <a href="../reference/config.html">配置值</a>来禁用。</p>
</dd>


<dt class="option-term" id="option-cargo-publish---color"><a class="option-anchor" href="#option-cargo-publish---color"><code>--color</code> <em>when</em></a></dt>
<dd class="option-desc"><p>控制彩色输出的使用方式。有效值包括：</p> <ul> <li><code>auto</code>（默认）：自动检测终端是否支持颜色显示。</li> <li><code>always</code>：始终显示颜色。</li> <li><code>never</code>：从不显示颜色。</li> </ul> <p>也可以通过 <code>term.color</code> <a href="../reference/config.html">配置值</a>来指定。</p>
</dd>

</dl>

### 常见选项

<dl>

<dt class="option-term" id="option-cargo-publish-+toolchain"><a class="option-anchor" href="#option-cargo-publish-+toolchain"><code>+</code><em>toolchain</em></a></dt>
<dd class="option-desc"><p>如果 Cargo 通过 rustup 安装，且 <code>cargo</code> 的第一个参数以 <code>+</code> 开头，则会被解释为 rustup 工具链名称（如 <code>+stable</code> 或 <code>+nightly</code>）。 有关工具链覆盖机制的更多信息，请参阅 <a href="https://rust-lang.github.io/rustup/overrides.html">rustup 文档</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-publish---config"><a class="option-anchor" href="#option-cargo-publish---config"><code>--config</code> <em>KEY=VALUE</em> or <em>PATH</em></a></dt>
<dd class="option-desc"><p>用于覆盖 Cargo 配置值。参数应为 TOML 格式 <code>KEY=VALUE</code>，或作为额外配置文件的路径提供。此标志可以多次指定。 有关更多信息，请参阅 <a href="../reference/config.html#command-line-overrides">命令行覆盖部分</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-publish--C"><a class="option-anchor" href="#option-cargo-publish--C"><code>-C</code> <em>PATH</em></a></dt>
<dd class="option-desc"><p>在执行任何指定操作之前，更改当前工作目录。这会影响诸如 cargo 默认查找项目清单 (<code>Cargo.toml</code>)的位置，以及用于发现 <code>.cargo/config.toml</code> 的搜索目录等设置。此选项必须出现在命令名称之前，例如 <code>cargo -C path/to/my-project build</code>。</p> <p>此选项仅适用于 <a href="https://doc.rust-lang.org/book/appendix-07-nightly-rust.html">nightly 版本</a>，并且需要使用 <code>-Z unstable-options</code> 标志来启用（参见 <a href="https://github.com/rust-lang/cargo/issues/10098">#10098</a>）。</p>
</dd>


<dt class="option-term" id="option-cargo-publish--h"><a class="option-anchor" href="#option-cargo-publish--h"><code>-h</code></a></dt>
<dt class="option-term" id="option-cargo-publish---help"><a class="option-anchor" href="#option-cargo-publish---help"><code>--help</code></a></dt>
<dd class="option-desc"><p>打印帮助信息。</p>
</dd>


<dt class="option-term" id="option-cargo-publish--Z"><a class="option-anchor" href="#option-cargo-publish--Z"><code>-Z</code> <em>flag</em></a></dt>
<dd class="option-desc"><p>Cargo 的不稳定（仅 nightly 版本）标志。运行 <code>cargo -Z help</code> 以获取详细信息。</p>
</dd>


</dl>

## 环境

有关 Cargo 读取的环境变量详情，请参见 [参考手册](../reference/environment-variables.html)。

## 退出状态

* `0`: Cargo 成功执行。
* `101`: Cargo 未能完成。

## 示例

1. 发布当前包：

       cargo publish

## 另请参阅 [cargo(1)](cargo.html)、[cargo-包(1)](cargo-包.html)、[cargo-login(1)](cargo-login.html)
