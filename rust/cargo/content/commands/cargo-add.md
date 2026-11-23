# cargo-add(1)
## 名称

cargo-add --- 将依赖项添加到 Cargo.toml 清单文件中

## 概述

`cargo add` [_options_] _crate_...\ `cargo add` [_options_] `--path` _path_\ `cargo add` [_options_] `--git` _url_ [_crate_...]


## 描述

此命令可以添加或修改依赖项。

可以通过以下方式指定依赖项的来源：

* _crate_`@`_version_: 从具有 `_version_` 版本的注册表中提取
* `--path` _path_: 从指定的 _path_ 中提取
* `--git` _url_: 从 _url_ 的 git 仓库中拉取

如果未指定来源，则将尽力选择一种来源，包括：

* 其他表中的现有依赖项（如 `dev-dependencies`）
* 工作区成员
* 注册表中的最新版本

当添加已存在的包时，现有条目将根据指定的标志进行更新。

成功调用后，命令输出中将列出指定依赖项的启用（`+`）和禁用（`-`）[功能]。


## 选项

### 来源选项

<dl>

<dt class="option-term" id="option-cargo-add---git"><a class="option-anchor" href="#option-cargo-add---git"><code>--git</code> <em>url</em></a></dt>
<dd class="option-desc"><p><a href=”../reference/specifying-dependencies.html#specifying-dependencies-from-git-repositories”>用于添加指定 crate 的 Git URL</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-add---branch"><a class="option-anchor" href="#option-cargo-add---branch"><code>--branch</code> <em>branch</em></a></dt>
<dd class="option-desc"><p>从 git 添加时使用的分支。</p>
</dd>


<dt class="option-term" id="option-cargo-add---tag"><a class="option-anchor" href="#option-cargo-add---tag"><code>--tag</code> <em>tag</em></a></dt>
<dd class="option-desc"><p>从 git 添加时使用的标签。</p>
</dd>


<dt class="option-term" id="option-cargo-add---rev"><a class="option-anchor" href="#option-cargo-add---rev"><code>--rev</code> <em>sha</em></a></dt>
<dd class="option-desc"><p>从 git 添加时使用的特定提交。</p>
</dd>


<dt class="option-term" id="option-cargo-add---path"><a class="option-anchor" href="#option-cargo-add---path"><code>--path</code> <em>path</em></a></dt>
<dd class="option-desc"><p><a href=”../reference/specifying-dependencies.html#specifying-path-dependencies”>要添加的本地 crate 的文件系统路径</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-add---base"><a class="option-anchor" href="#option-cargo-add---base"><code>--base</code> <em>base</em></a></dt>
<dd class="option-desc"><p>添加本地 crate 时使用的 <a href=”../reference/unstable.html#path-bases”>路径基础</a>。 <p><a href=”../reference/unstable.html#path-bases”>不稳定（仅夜间版本）</a></p></p></dd>


<dt class="option-term" id="option-cargo-add---registry"><a class="option-anchor" href="#option-cargo-add---registry"><code>--registry</code> <em>registry</em></a></dt>
<dd class="option-desc"><p>要使用的注册表名称。注册表名称定义在 <a href=”../reference/config.html”>Cargo 配置文件中</a>。如果未指定，则使用默认注册表， 由 <code>registry.default</code> 配置键定义，默认为 <code>crates-io</code>。</p>
</dd>


</dl>

### 部分选项

<dl>

<dt class="option-term" id="option-cargo-add---dev"><a class="option-anchor" href="#option-cargo-add---dev"><code>--dev</code></a></dt>
<dd class="option-desc"><p>作为 <a href=”../reference/specifying-dependencies.html#development-dependencies”>开发依赖项</a>添加。</p>
</dd>


<dt class="option-term" id="option-cargo-add---build"><a class="option-anchor" href="#option-cargo-add---build"><code>--build</code></a></dt>
<dd class="option-desc"><p>作为 <a href=”../reference/specifying-dependencies.html#build-dependencies”>构建依赖项</a>添加。</p>
</dd>


<dt class="option-term" id="option-cargo-add---target"><a class="option-anchor" href="#option-cargo-add---target"><code>--target</code> <em>target</em></a></dt>
<dd class="option-desc"><p>作为 <a href=”../reference/specifying-dependencies.html#platform-specific-dependencies”>特定目标平台</a>的依赖项添加。 <p>为了避免意外的 shell 展开，您可以在每个目标周围加上引号，例如 <code>--target ‘cfg(unix)’</code>。</p></p></dd>


</dl>

### 依赖项选项

<dl>

<dt class="option-term" id="option-cargo-add---dry-run"><a class="option-anchor" href="#option-cargo-add---dry-run"><code>--dry-run</code></a></dt>
<dd class="option-desc"><p>实际上不要编写清单文件</p>
</dd>


<dt class="option-term" id="option-cargo-add---rename"><a class="option-anchor" href="#option-cargo-add---rename"><code>--rename</code> <em>name</em></a></dt>
<dd class="option-desc"><p><a href=”../reference/specifying-dependencies.html#renaming-dependencies-in-cargotoml”>重命名</a>依赖项。</p>
</dd>


<dt class="option-term" id="option-cargo-add---optional"><a class="option-anchor" href="#option-cargo-add---optional"><code>--optional</code></a></dt>
<dd class="option-desc"><p>将依赖项标记为 <a href=”../reference/features.html#optional-dependencies”>可选</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-add---no-optional"><a class="option-anchor" href="#option-cargo-add---no-optional"><code>--no-optional</code></a></dt>
<dd class="option-desc"><p>将依赖项标记为 <a href=”../reference/features.html#optional-dependencies”>必需</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-add---public"><a class="option-anchor" href="#option-cargo-add---public"><code>--public</code></a></dt>
<dd class="option-desc"><p>将依赖项标记为公开。 <p>该依赖项可以在您的库公共 API 中引用。 <p><a href=”../reference/unstable.html#public-dependency”>不稳定（仅夜间版本）</a></p></p></p></dd>


<dt class="option-term" id="option-cargo-add---no-public"><a class="option-anchor" href="#option-cargo-add---no-public"><code>--no-public</code></a></dt>
<dd class="option-desc"><p>将依赖项标记为私有。 <p>虽然您可以在实现中使用该 crate，但它不能在公共 API 中被引用。 <p><a href=”../reference/unstable.html#public-dependency”>不稳定（仅夜间版本）</a></p></p></p></dd>


<dt class="option-term" id="option-cargo-add---no-default-features"><a class="option-anchor" href="#option-cargo-add---no-default-features"><code>--no-default-features</code></a></dt>
<dd class="option-desc"><p>禁用 <a href="../reference/features.html#dependency-features">默认功能</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-add---default-features"><a class="option-anchor" href="#option-cargo-add---default-features"><code>--default-features</code></a></dt>
<dd class="option-desc"><p>重新启用 <a href="../reference/features.html#dependency-features">默认功能</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-add--F"><a class="option-anchor" href="#option-cargo-add--F"><code>-F</code> <em>features</em></a></dt>
<dt class="option-term" id="option-cargo-add---features"><a class="option-anchor" href="#option-cargo-add---features"><code>--features</code> <em>features</em></a></dt>
<dd class="option-desc"><p>用于激活的 <a href../reference/features.html#dependency-features">功能</a>的空格或逗号分隔列表。当添加多个库时，特定库的功能可以通过 <code>package-name/feature-name</code> 语法来启用。此标志可以多次指定，从而启用所有指定的功能。</p>
</dd>


</dl>


### 显示选项

<dl>
<dt class="option-term" id="option-cargo-add--v"><a class="option-anchor" href="#option-cargo-add--v"><code>-v</code></a></dt>
<dt class="option-term" id="option-cargo-add---verbose"><a class="option-anchor" href="#option-cargo-add---verbose"><code>--verbose</code></a></dt>
<dd class="option-desc"><p>使用详细输出。可以两次指定以获得“非常详细”的输出，其中包含额外的内容，如依赖警告和构建脚本输出。也可以通过 <code>term.verbose</code> <a href../reference/config.html">配置值</a>来指定。</p>
</dd>


<dt class="option-term" id="option-cargo-add--q"><a class="option-anchor" href="#option-cargo-add--q"><code>-q</code></a></dt>
<dt class="option-term" id="option-cargo-add---quiet"><a class="option-anchor" href="#option-cargo-add---quiet"><code>--quiet</code></a></dt>
<dd class="option-desc"><p>不要打印 cargo 日志消息。也可以通过 <code>term.quiet</code> <a href../reference/config.html">配置值</a>来指定。</p>
</dd>


<dt class="option-term" id="option-cargo-add---color"><a class="option-anchor" href="#option-cargo-add---color"><code>--color</code> <em>when</em></a></dt>
<dd class="option-desc"><p>控制彩色输出的使用情况。有效值包括： <ul> <li><code>auto</code>（默认）：自动检测终端是否支持颜色显示。</li> <li><code>always</code>：始终显示颜色。</li> <li><code>never</code>：从不显示颜色。</li> </ul> <p>也可以通过 <code>term.color</code> <a href../reference/config.html">配置值</a>来指定。</p></p></dd>

</dl>

### 清单选项

<dl>
<dt class="option-term" id="option-cargo-add---manifest-path"><a class="option-anchor" href="#option-cargo-add---manifest-path"><code>--manifest-path</code> <em>path</em></a></dt>
<dd class="option-desc"><p><code>Cargo.toml</code> 文件的路径。默认情况下，Cargo会在当前目录或任何父目录中查找 <code>Cargo.toml</code> 文件。</p>
</dd>


<dt class="option-term" id="option-cargo-add--p"><a class="option-anchor" href="#option-cargo-add--p"><code>-p</code> <em>spec</em></a></dt>
<dt class="option-term" id="option-cargo-add---package"><a class="option-anchor" href="#option-cargo-add---package"><code>--package</code> <em>spec</em></a></dt>
<dd class="option-desc"><p>仅将依赖项添加到指定的包中。</p>
</dd>


<dt class="option-term" id="option-cargo-add---ignore-rust-version"><a class="option-anchor" href="#option-cargo-add---ignore-rust-version"><code>--ignore-rust-version</code></a></dt>
<dd class="option-desc"><p>忽略包中的 <code>rust-version</code> 规范。</p>
</dd>


<dt class="option-term" id="option-cargo-add---locked"><a class="option-anchor" href="#option-cargo-add---locked"><code>--locked</code></a></dt>
<dd class="option-desc"><p>确保使用的依赖项和版本与原始生成 <code>Cargo.lock</code> 文件时完全相同。当出现以下任一情况时，Cargo将以错误退出： <ul> <li>锁文件缺失。</li> <li>由于不同的依赖解析方式导致 Cargo 尝试修改锁文件。</li> </ul> <p>在需要确定性构建的环境中，例如 CI 管道中，可以使用此选项。</p></p>
</dd>


<dt class="option-term" id="option-cargo-add---offline"><a class="option-anchor" href="#option-cargo-add---offline"><code>--offline</code></a></dt>
<dd class="option-desc"><p>防止 Cargo 因任何原因访问网络。如果没有此标志，当 Cargo 需要访问网络而网络不可用时，它将出现错误并停止。使用此标志后，Cargo 将尽可能在不连接网络的情况下继续运行。</p> <p>请注意，这可能会导致与在线模式不同的依赖解析结果。即使本地索引副本中显示有更新版本，Cargo 也会限制自己仅使用本地下载的包。在离线操作前，请参考 <a href="cargo-fetch.html">cargo-fetch(1)</a> 命令来下载依赖项。</p> <p>也可以通过 <code>net.offline</code> <a href="../reference/config.html">配置值</a>来指定此标志。</p>
</dd>


<dt class="option-term" id="option-cargo-add---frozen"><a class="option-anchor" href="#option-cargo-add---frozen"><code>--frozen</code></a></dt>
<dd class="option-desc"><p>相当于同时指定 <code>--locked</code> 和 <code>--offline</code>。</p>
</dd>


</dl>

### 常见选项

<dl>

<dt class="option-term" id="option-cargo-add-+toolchain"><a class="option-anchor" href="#option-cargo-add-+toolchain"><code>+</code><em>toolchain</em></a></dt>
<dd class="option-desc"><p>如果 Cargo 是通过 rustup 安装的，且 <code>cargo</code> 的第一个参数以 <code>+</code> 开头，则会被解释为 rustup 工具链名称（如 <code>+stable</code> 或 <code>+nightly</code>）。 有关工具链覆盖机制更多信息，请参阅 <a href="https://rust-lang.github.io/rustup/overrides.html">rustup 文档</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-add---config"><a class="option-anchor" href="#option-cargo-add---config"><code>--config</code> <em>KEY=VALUE</em> or <em>PATH</em></a></dt>
<dd class="option-desc"><p>覆盖 Cargo 配置值。参数应为 TOML 语法中的 <code>KEY=VALUE</code>，或作为额外配置文件的路径提供。此标志可以多次指定。 有关更多信息，请参阅 <a href="../reference/config.html#command-line-overrides">命令行覆盖部分</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-add--C"><a class="option-anchor" href="#option-cargo-add--C"><code>-C</code> <em>PATH</em></a></dt>
<dd class="option-desc"><p>在执行任何指定操作之前更改当前工作目录。这会影响 Cargo 默认查找项目清单 (<code>Cargo.toml</code>)的位置，以及用于发现 <code>.cargo/config.toml</code> 的搜索目录。此选项必须出现在命令名称之前，例如 <code>cargo -C path/to/my-project build</code>。</p> <p>此选项仅在 <a href="https://doc.rust-lang.org/book/appendix-07-nightly-rust.html">nightly 通道</a>上可用，并且需要 <code>-Z unstable-options</code> 标志才能启用（参见 <a href="https://github.com/rust-lang/cargo/issues/10098">#10098</a>）。</p>
</dd>


<dt class="option-term" id="option-cargo-add--h"><a class="option-anchor" href="#option-cargo-add--h"><code>-h</code></a></dt>
<dt class="option-term" id="option-cargo-add---help"><a class="option-anchor" href="#option-cargo-add---help"><code>--help</code></a></dt>
<dd class="option-desc"><p>打印帮助信息。</p>
</dd>


<dt class="option-term" id="option-cargo-add--Z"><a class="option-anchor" href="#option-cargo-add--Z"><code>-Z</code> <em>flag</em></a></dt>
<dd class="option-desc"><p>Cargo中的不稳定（仅夜间生效）标志。运行 <code>cargo -Z help</code> 查看详细信息。</p>
</dd>


</dl>

## 环境

有关 Cargo 读取的环境变量详情，请参阅 [参考手册](../reference/environment-variables.html)。

## 退出状态

* `0`: Cargo 成功执行。
* `101`: Cargo 未能完成。

## 示例

1. 将 `regex` 作为依赖项添加

       cargo add regex

2. 将 `trybuild` 作为开发依赖项添加

       cargo add --dev trybuild

3. 将较旧版本的 `nom` 作为依赖项添加

       cargo add nom@5

4. 通过 `derive`s 添加对数据结构序列化为 json 的支持

       cargo add serde serde_json -F serde/derive

5. 在 `cfg(windows)` 下将 `windows` 作为特定平台依赖项添加

       cargo add windows --目标 'cfg(windows)'

## 另请参阅 [cargo(1)](cargo.html)、[cargo-remove(1)](cargo-remove.html)

[features]: ../reference/features.html
