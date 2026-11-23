# cargo-包(1)
## 名称

cargo-包 --- 将本地包打包成可发布的 tarball 文件

## 概述

`cargo package` [_选项_]

## 描述

此命令将在当前目录中生成一个可发布的压缩 `.crate` 文件，其中包含该包的源代码。生成的文件将存储在 `target/package` 目录中。执行过程包括以下步骤：

1. 加载并检查当前工作空间，进行一些基本检查。
    - 除非具有版本键，否则不允许路径依赖。对于已发布的包中的依赖项，Cargo 会忽略路径键。`dev-dependencies` 没有此限制。
2. 创建压缩的 `.crate` 文件。
    - 原始的 `Cargo.toml` 文件会被重写并规范化。
    - `[patch]`、 `[replace]` 和 `[workspace]` 部分将从清单中移除。
    - `Cargo.lock` 始终被包含。如果缺失，除非使用 `--exclude-lockfile` 标志，否则将生成新的锁定文件。[cargo-install(1)](cargo-install.html) 在使用 `--locked` 标志时将会使用打包后的锁定文件。
    - 会包含一个 `.cargo_vcs_info.json` 文件，其中包含当前 VCS 检查哈希信息（如有），以及工作树是否脏的标记。
    - 符号链接会被展开为其目标文件。
    - 文件和目录会根据 `[include]` 和 `[exclude]` 字段中提到的规则被包含或排除。

3. 提取 `.crate` 文件并构建它以验证其可构建。
    - 这将从头开始重建您的包，以确保其处于原始状态即可构建。可以使用 `--no-verify` 标志跳过此步骤。
4. 检查构建脚本是否修改了任何源文件。

包含的文件列表可以通过清单中的 `include` 和 `exclude` 字段来控制。

有关打包和发布方面的更多细节，请参阅 [参考手册](../reference/publishing.html)。

### .cargo_vcs_info.json 格式

将按以下格式生成 `.cargo_vcs_info.json` 文件

```javascript
{
 "git": {
   "sha1": "aac20b6e7e543e6dd4118b246c77225e3a3a1302",
   "dirty": true
 },
 "path_in_vcs": ""
}
```

`dirty` 表示在构建包时 Git worktree 处于脏状态。

对于版本控制仓库中的子目录中的包，`path_in_vcs` 将被设置为相对于仓库的路径。

此文件的兼容性遵循与 [cargo-metadata(1)](cargo-metadata.html) 的 JSON 输出相同的策略。

请注意，此文件提供了 VCS 信息的最佳努力快照。然而，包的来源并未得到验证。无法保证 tarball 中的源代码与 VCS 信息一致。

## 选项

### 包选项

<dl>

<dt class="option-term" id="option-cargo-package--l"><a class="option-anchor" href="#option-cargo-package--l"><code>-l</code></a></dt>
<dt class="option-term" id="option-cargo-package---list"><a class="option-anchor" href="#option-cargo-package---list"><code>--list</code></a></dt>
<dd class="option-desc"><p>在无需生成文件的情况下将包中的文件打印出来。</p>
</dd>


<dt class="option-term" id="option-cargo-package---no-verify"><a class="option-anchor" href="#option-cargo-package---no-verify"><code>--no-verify</code></a></dt>
<dd class="option-desc"><p>不要通过构建这些文件来验证其内容。</p>
</dd>


<dt class="option-term" id="option-cargo-package---no-metadata"><a class="option-anchor" href="#option-cargo-package---no-metadata"><code>--no-metadata</code></a></dt>
<dd class="option-desc"><p>忽略关于缺乏人类可使用的元数据（如描述或许可证）的警告。</p>
</dd>


<dt class="option-term" id="option-cargo-package---allow-dirty"><a class="option-anchor" href="#option-cargo-package---allow-dirty"><code>--allow-dirty</code></a></dt>
<dd class="option-desc"><p>允许包含未提交 VCS 更改的工作目录被打包。</p>
</dd>


<dt class="option-term" id="option-cargo-package---exclude-lockfile"><a class="option-anchor" href="#option-cargo-package---exclude-lockfile"><code>--exclude-lockfile</code></a></dt>
<dd class="option-desc"><p>在打包时不要包含锁定文件。</p> <p>此标志不用于常规使用。 某些工具可能期望存在锁定文件（例如 <code>cargo install --locked</code>）。 在使用此选项之前，请考虑其他方案。</p>
</dd>


<dt class="option-term" id="option-cargo-package---index"><a class="option-anchor" href="#option-cargo-package---index"><code>--index</code> <em>index</em></a></dt>
<dd class="option-desc"><p>要使用的注册表索引的 URL。</p>
</dd>


<dt class="option-term" id="option-cargo-package---registry"><a class="option-anchor" href="#option-cargo-package---registry"><code>--registry</code> <em>registry</em></a></dt>
<dd class="option-desc"><p>要打包的注册表名称；有关注册表名称配置的更多细节，请参阅 <code>cargo publish --help</code>。这些包不会发布到该注册表，但如果我们打包多个相互依赖的库，则会在假设依赖项将发布到该注册表的前提下生成锁定文件。</p>
</dd>


<dt class="option-term" id="option-cargo-package---message-format"><a class="option-anchor" href="#option-cargo-package---message-format"><code>--message-format</code> <em>fmt</em></a></dt>
<dd class="option-desc"><p>指定输出消息格式。目前，它仅适用于 <code>--list</code> 选项，并影响文件列表格式。此方式不稳定，需要使用 <code>-Zunstable-options</code> 选项。有效的输出格式包括： <ul> <li><code>human</code>（默认）：以每行一个文件的格式显示。</li> <li><code>json</code>：生成关于每个包的机器可读取的 JSON 信息。每一条 JSON 行对应一个包（使用换行符分隔）。 <pre><code class="language-javascript"> { /* 包的 Package ID Spec。 */ "id": "path+file:///home/foo#0.0.0", /* 该包的文件 */ "files" { /* 归档文件中的相对路径。 */ "Cargo.toml.orig": { /* 文件的来源。 - “generate” 表示在打包过程中生成的文件 - “copy” 表示从其他位置复制过来的文件。 */ "kind": "copy", /* 对于 “copy” 类型， 它是实际文件内容的绝对路径。 对于 “generate” 类型， 它是生成文件所基于的原始文件。 */ "path": "/home/foo/Cargo.toml" }, "Cargo.toml": { "kind": "generate", "path": "/home/foo/Cargo.toml" }, "src/main.rs": { "kind": "copy", "path": "/home/foo/src/main.rs" } } } </code></pre> </li> </ul></p></dd> ### 包选择 默认情况下，当没有指定包选择选项时，选中的包取决于所选的清单文件（如果未指定 <code>--manifest-path</code>，则基于当前工作目录）。如果清单是工作空间的根目录，则选中工作空间的默认成员；否则仅选中清单中定义的包。 工作空间的默认成员可以通过根清单中的 <code>workspace.default-members</code> 键显式设置。如果未设置此值，虚拟工作空间将包含所有工作空间成员（相当于传递 <code>--workspace</code> 选项），而非虚拟工作空间则仅包含根 crate 本身。 <dl> <dt class="option-term" id="option-cargo-package--p"><a class="option-anchor" href="#option-cargo-package--p"><code>-p</code> <em>spec</em>…</a></dt> <dt class="option-term" id="option-cargo-package---package"><a class="option-anchor" href="#option-cargo-package---package"><code>--package</code> <em>spec</em>…</a></dt> <dd class="option-desc"><p>仅选择指定的包。有关 SPEC 格式，请参阅 <a href="cargo-pkgid.html">cargo-pkgid(1)</a>。此标志可以多次指定，并支持常见的 Unix glob 模式，如 <code>*</code>、<code>?</code> 和 <code>[]</code>。然而，为了避免 shell 在 Cargo 处理之前意外展开 glob 模式，您必须在每个模式下使用单引号或双引号。</p> </dd>
</dd>


<dt class="option-term" id="option-cargo-package---workspace"><a class="option-anchor" href="#option-cargo-package---workspace"><code>--workspace</code></a></dt>
<dd class="option-desc"><p>将工作空间中的所有成员打包在一起。</p>
</dd>



<dt class="option-term" id="option-cargo-package---exclude"><a class="option-anchor" href="#option-cargo-package---exclude"><code>--exclude</code> <em>SPEC</em>…</a></dt>
<dd class="option-desc"><p>排除指定的包。必须与 <code>--workspace</code> 标志一起使用。该标志可以多次指定，并支持常见的 Unix glob 模式，如 <code>*</code>、<code>?</code> 和 <code>[]</code>。然而，为了避免 shell 在 Cargo 处理之前意外展开 glob 模式，必须在每个模式下使用单引号或双引号。</p>
</dd>


</dl>

### 编译选项

<dl>

<dt class="option-term" id="option-cargo-package---target"><a class="option-anchor" href="#option-cargo-package---target"><code>--target</code> <em>tuple</em></a></dt>
<dd class="option-desc"><p>为指定的目标架构打包。该标志可以多次指定。默认值为主机架构。该元组的通用格式为 <code><arch><sub></sub>-<vendor>-<sys>-<abi></code>。 <p>可能的值：</p> <ul> <li>在 <code>rustc --print target-list</code> 中支持的任何目标。</li> <li><code>"host-tuple"</code>，它将在内部被主机目标替代。如果你正在交叉编译某些库，并且不想将主机机器指定为目标（例如，在多个主机可使用的共享项目中使用的 <code>xtask</code>），这非常有用。</li> <li>指向自定义目标规范的路径。有关更多信息，请参阅 <a href="../../rustc/targets/custom.html#custom-target-lookup-path">自定义目标查找路径</a>。</li> </ul> <p>也可以通过 <code>build.target</code> <a href="../reference/config.html">配置值</a>来指定此选项。 <p>请注意，指定此标志会使 Cargo 以不同的模式运行，其中目标工件被放置于单独的目录中。有关更多细节，请参阅 <a href../reference/build-cache.html">构建缓存</a>文档。</p></p></p></dd>


<dt class="option-term" id="option-cargo-package---target-dir"><a class="option-anchor" href="#option-cargo-package---target-dir"><code>--target-dir</code> <em>directory</em></a></dt>
<dd class="option-desc"><p>所有生成的艺术品和中间文件的目录。也可以通过 <code>CARGO_TARGET_DIR</code> 环境变量或 <code>build.target-dir</code> <a href="../reference/config.html">配置值</a>来指定。默认值为工作空间根目录中的 <code>target</code>。</p>
</dd>


</dl>

### 功能选择

功能标志允许您控制哪些功能被启用。当未指定功能选项时，每个选中的包都将激活 `default` 功能。

有关更多细节，请参阅 [功能文档](../reference/features.html#command-line-特性-options)。

<dl>

<dt class="option-term" id="option-cargo-package--F"><a class="option-anchor" href="#option-cargo-package--F"><code>-F</code> <em>features</em></a></dt>
<dt class="option-term" id="option-cargo-package---features"><a class="option-anchor" href="#option-cargo-package---features"><code>--features</code> <em>features</em></a></dt>
<dd class="option-desc"><p>用于激活的功能的空格或逗号分隔列表。工作空间成员的功能可以通过 <code>package-name/feature-name</code> 语法启用。该标志可以多次指定，从而启用所有指定的功能。</p>
</dd>


<dt class="option-term" id="option-cargo-package---all-features"><a class="option-anchor" href="#option-cargo-package---all-features"><code>--all-features</code></a></dt>
<dd class="option-desc"><p>激活所有选定包的所有可用功能。</p>
</dd>


<dt class="option-term" id="option-cargo-package---no-default-features"><a class="option-anchor" href="#option-cargo-package---no-default-features"><code>--no-default-features</code></a></dt>
<dd class="option-desc"><p>不要激活选定包的 <code>默认</code> 功能。</p>
</dd>


</dl>

### 清单选项

<dl>

<dt class="option-term" id="option-cargo-package---manifest-path"><a class="option-anchor" href="#option-cargo-package---manifest-path"><code>--manifest-path</code> <em>path</em></a></dt>
<dd class="option-desc"><p><code>Cargo.toml</code> 文件的路径。默认情况下，Cargo会在当前目录或任何父目录中查找 <code>Cargo.toml</code> 文件。</p>
</dd>


<dt class="option-term" id="option-cargo-package---locked"><a class="option-anchor" href="#option-cargo-package---locked"><code>--locked</code></a></dt>
<dd class="option-desc"><p>确保使用的依赖项和版本与原始生成 <code>Cargo.lock</code> 文件时相同。当出现以下任一情况时，Cargo将退出并抛出错误： <ul> <li>锁文件缺失。</li> <li>由于不同的依赖解析导致 Cargo 尝试修改锁文件。</li> </ul> 该选项适用于需要确定性构建的环境，例如 CI 流水线。</p>
</dd>


<dt class="option-term" id="option-cargo-package---offline"><a class="option-anchor" href="#option-cargo-package---offline"><code>--offline</code></a></dt>
<dd class="option-desc"><p>禁止 Cargo 出于任何原因访问网络。如果没有此标志，如果 Cargo 需要访问网络而网络不可用时，它将以错误方式退出。使用此标志后，Cargo 将尽可能在不联网的情况下继续运行。 注意，这可能会导致与在线模式不同的依赖解析结果。即使本地索引中显示有更新版本，Cargo 也将限制自己仅使用本地下载的包。在离线前，请参考 <a href="cargo-fetch.html">cargo-fetch(1)</a> 命令来下载依赖项。 也可以通过 <code>net.offline</code> <a href="../reference/config.html">配置值</a>指定此选项。</p>
</dd>


<dt class="option-term" id="option-cargo-package---frozen"><a class="option-anchor" href="#option-cargo-package---frozen"><code>--frozen</code></a></dt>
<dd class="option-desc"><p>相当于同时指定 <code>--locked</code> 和 <code>--offline</code>。</p>
</dd>



</dl>

### 其他选项

<dl>
<dt class="option-term" id="option-cargo-package--j"><a class="option-anchor" href="#option-cargo-package--j"><code>-j</code> <em>N</em></a></dt>
<dt class="option-term" id="option-cargo-package---jobs"><a class="option-anchor" href="#option-cargo-package---jobs"><code>--jobs</code> <em>N</em></a></dt>
<dd class="option-desc"><p>要运行的并行作业数量。也可以通过 <code>build.jobs</code> <a href="../reference/config.html">配置值</a>指定。默认值为逻辑 CPU 数。如果为负数，则将最大并行作业数设置为逻辑 CPU 数加上提供的数值。如果提供字符串 <code>default</code>，则将其重置为默认值。 不应为 0。</p>
</dd>

<dt class="option-term" id="option-cargo-package---keep-going"><a class="option-anchor" href="#option-cargo-package---keep-going"><code>--keep-going</code></a></dt>
<dd class="option-desc"><p>尽可能在依赖图中构建多个包，而不是在第一个构建失败时中止整个构建过程。</p> <p>例如，如果当前包依赖于 <code>fails</code> 和 <code>works</code>，其中有一个构建失败，<code>cargo package -j1</code> 可能会或不会构建成功的那个（取决于 Cargo 选择先运行哪个），而 <code>cargo package -j1 --keep-going</code> 则一定会运行两个构建过程，即使第一个构建失败。</p>
</dd>

</dl>

### 显示选项

<dl>
<dt class="option-term" id="option-cargo-package--v"><a class="option-anchor" href="#option-cargo-package--v"><code>-v</code></a></dt>
<dt class="option-term" id="option-cargo-package---verbose"><a class="option-anchor" href="#option-cargo-package---verbose"><code>--verbose</code></a></dt>
<dd class="option-desc"><p>使用详细输出。可以指定两次以得到“非常详细”的输出，包括额外的输出如依赖警告和构建脚本输出。也可以通过 <code>term.verbose</code> <a href="../reference/config.html">配置值</a>来指定。</p>
</dd>


<dt class="option-term" id="option-cargo-package--q"><a class="option-anchor" href="#option-cargo-package--q"><code>-q</code></a></dt>
<dt class="option-term" id="option-cargo-package---quiet"><a class="option-anchor" href="#option-cargo-package---quiet"><code>--quiet</code></a></dt>
<dd class="option-desc"><p>不要打印 cargo 日志消息。也可以通过 <code>term.quiet</code> <a href="../reference/config.html">配置值</a>来禁用此功能。</p>
</dd>


<dt class="option-term" id="option-cargo-package---color"><a class="option-anchor" href="#option-cargo-package---color"><code>--color</code> <em>when</em></a></dt>
<dd class="option-desc"><p>控制彩色输出的使用情况。有效值包括：</p> <ul> <li><code>auto</code>（默认）：自动检测终端是否支持颜色显示。</li> <li><code>always</code>：始终显示颜色。</li> <li><code>never</code>：从不显示颜色。</li> </ul> <p>也可以通过 <code>term.color</code> <a href="../reference/config.html">配置值</a>来指定。</p>
</dd>

</dl>

### 常见选项

<dl>

<dt class="option-term" id="option-cargo-package-+toolchain"><a class="option-anchor" href="#option-cargo-package-+toolchain"><code>+</code><em>toolchain</em></a></dt>
<dd class="option-desc"><p>如果 Cargo 通过 rustup 安装，且 <code>cargo</code> 的第一个参数以 <code>+</code> 开头，则会被解释为 rustup 工具链名称（如 <code>+stable</code> 或 <code>+nightly</code>）。 有关工具链覆盖机制的更多信息，请参阅 <a href="https://rust-lang.github.io/rustup/overrides.html">rustup 文档</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-package---config"><a class="option-anchor" href="#option-cargo-package---config"><code>--config</code> <em>KEY=VALUE</em> or <em>PATH</em></a></dt>
<dd class="option-desc"><p>用于覆盖 Cargo 配置值。参数应为 TOML 格式 <code>KEY=VALUE</code>，或作为额外配置文件的路径提供。此标志可以多次指定。 有关更多信息，请参阅 <a href="../reference/config.html#command-line-overrides">命令行覆盖部分</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-package--C"><a class="option-anchor" href="#option-cargo-package--C"><code>-C</code> <em>PATH</em></a></dt>
<dd class="option-desc"><p>在执行任何指定操作之前，更改当前工作目录。这会影响诸如 cargo 默认查找项目清单 (<code>Cargo.toml</code>)的位置，以及用于发现 <code>.cargo/config.toml</code> 的搜索目录等设置。此选项必须出现在命令名称之前，例如 <code>cargo -C path/to/my-project build</code>。</p> <p>此选项仅适用于 <a href="https://doc.rust-lang.org/book/appendix-07-nightly-rust.html">nightly 渠道</a>，并且需要使用 <code>-Z unstable-options</code> 标志才能启用（参见 <a href="https://github.com/rust-lang/cargo/issues/10098">#10098</a>）。</p>
</dd>


<dt class="option-term" id="option-cargo-package--h"><a class="option-anchor" href="#option-cargo-package--h"><code>-h</code></a></dt>
<dt class="option-term" id="option-cargo-package---help"><a class="option-anchor" href="#option-cargo-package---help"><code>--help</code></a></dt>
<dd class="option-desc"><p>打印帮助信息。</p>
</dd>


<dt class="option-term" id="option-cargo-package--Z"><a class="option-anchor" href="#option-cargo-package--Z"><code>-Z</code> <em>flag</em></a></dt>
<dd class="option-desc"><p>Cargo 的不稳定（仅 nightly 版本）标志。运行 <code>cargo -Z help</code> 以获取详细信息。</p>
</dd>


</dl>

## 环境

有关 Cargo 读取的环境变量详情，请参阅 [参考手册](../reference/environment-variables.html)。

## 退出状态

* `0`: Cargo 成功执行。
* `101`: Cargo 未能完成。

## 示例

1. 创建当前包的压缩 `.crate` 文件：

       cargo 包

## 另请参阅 [cargo(1)](cargo.html)、[cargo-publish(1)](cargo-publish.html)
