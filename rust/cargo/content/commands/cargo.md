# cargo(1)

## 名称

cargo --- Rust 包管理器

## 概述

`cargo` [_options_] _command_ [_args_]\ `cargo` [_options_] `--version`\ `cargo` [_options_] `--list`\ `cargo` [_options_] `--help`\ `cargo` [_options_] `--explain` _code_

## 描述

该程序是 Rust 语言的包管理器和构建工具，可在 <https://rust-lang.org> 获取。

命令可能包括以下几种：
- 内置命令，详见下文
- [aliases]
- [外部工具]


## 命令

### 构建命令

[cargo-bench(1)](cargo-bench.html)\ &nbsp;&nbsp;&nbsp;&nbsp;对包执行基准测试。

[cargo-build(1)](cargo-build.html)\ &nbsp;&nbsp;&nbsp;&nbsp;编译包。

[cargo-check(1)](cargo-check.html)\ &nbsp;&nbsp;&nbsp;&nbsp;检查本地包及其所有依赖项是否存在错误。

[cargo-clean(1)](cargo-clean.html)\ &nbsp;&nbsp;&nbsp;&nbsp;删除 Cargo 过去生成的构建文件。

[cargo-doc(1)](cargo-doc.html)\ &nbsp;&nbsp;&nbsp;&nbsp;生成包的文档。

[cargo-fetch(1)](cargo-fetch.html)\ &nbsp;&nbsp;&nbsp;&nbsp;从网络获取包的依赖项。

[cargo-fix(1)](cargo-fix.html)\ &nbsp;&nbsp;&nbsp;&nbsp;自动修复 rustc 报告的lint 警告。

[cargo-run(1)](cargo-run.html)\ &nbsp;&nbsp;&nbsp;&nbsp;运行本地包的二进制文件或示例。

[cargo-rustc(1)](cargo-rustc.html)\ &nbsp;&nbsp;&nbsp;&nbsp;编译包，并向编译器传递额外选项。

[cargo-rustdoc(1)](cargo-rustdoc.html)\ &nbsp;&nbsp;&nbsp;&nbsp;使用指定的自定义标志生成包的文档。

[cargo-test(1)](cargo-test.html)\ &nbsp;&nbsp;&nbsp;&nbsp;执行包的单元和集成测试。

### 清单命令

[cargo-add(1)](cargo-add.html)\ &nbsp;&nbsp;&nbsp;&nbsp;将依赖项添加到 `Cargo.toml` 清单文件中。

[cargo-generate-锁文件(1)](cargo-generate-锁文件.html)\ &nbsp;&nbsp;&nbsp;&nbsp;为项目生成 `Cargo.lock` 文件。

[cargo-info(1)](cargo-info.html)\ &nbsp;&nbsp;&nbsp;&nbsp;显示注册表中包的信息。默认注册表为 crates.io。

[cargo-locate-project(1)](cargo-locate-project.html)\ &nbsp;&nbsp;&nbsp;&nbsp;打印 `Cargo.toml` 文件位置的 JSON 格式表示。

[cargo-metadata(1)](cargo-metadata.html)\ &nbsp;&nbsp;&nbsp;&nbsp;以机器可读取格式输出包的解析依赖关系。

[cargo-pkgid(1)](cargo-pkgid.html)\ &nbsp;&nbsp;&nbsp;&nbsp;打印完全限定的包规范。

[cargo-remove(1)](cargo-remove.html)\ &nbsp;&nbsp;&nbsp;&nbsp;从 `Cargo.toml` 清单文件中移除依赖项。

[cargo-tree(1)](cargo-tree.html)\ &nbsp;&nbsp;&nbsp;&nbsp;显示依赖图的树形可视化效果。

[cargo-update(1)](cargo-update.html)\ &nbsp;&nbsp;&nbsp;&nbsp;根据本地 lock 文件中的记录更新依赖项。

[cargo-vendor(1)](cargo-vendor.html)\ &nbsp;&nbsp;&nbsp;&nbsp;在本地提供所有依赖项。

### 包命令

[cargo-init(1)](cargo-init.html)\ &nbsp;&nbsp;&nbsp;&nbsp;在现有目录中创建新的 Cargo 包。

[cargo-install(1)](cargo-install.html)\ &nbsp;&nbsp;&nbsp;&nbsp;构建并安装 Rust 二进制文件。

[cargo-new(1)](cargo-new.html)\ &nbsp;&nbsp;&nbsp;&nbsp;创建新的 Cargo 包。

[cargo-search(1)](cargo-search.html)\ &nbsp;&nbsp;&nbsp;&nbsp;在 crates.io 中搜索包。

[cargo-uninstall(1)](cargo-uninstall.html)\ &nbsp;&nbsp;&nbsp;&nbsp;移除 Rust 二进制文件。

### 发布命令

[cargo-login(1)](cargo-login.html)\ &nbsp;&nbsp;&nbsp;&nbsp;将注册表中的 API 令牌本地保存。

[cargo-logout(1)](cargo-logout.html)\ &nbsp;&nbsp;&nbsp;&nbsp;从注册表中移除 API 令牌。

[cargo-owner(1)](cargo-owner.html)\ &nbsp;&nbsp;&nbsp;&nbsp;管理注册表上 crate 的所有者。

[cargo-包(1)](cargo-包.html)\ &nbsp;&nbsp;&nbsp;&nbsp;将本地包打包成可发布的 tarball。

[cargo-publish(1)](cargo-publish.html)\ &nbsp;&nbsp;&nbsp;&nbsp;将包上传到注册表。

[cargo-yank(1)](cargo-yank.html)\ &nbsp;&nbsp;&nbsp;&nbsp;从索引中移除已推送的 crate。

### 报告命令

[cargo-report(1)](cargo-report.html)\ &nbsp;&nbsp;&nbsp;&nbsp;生成并显示各种类型的报告。

[cargo-report-future-incompatibilities(1)](cargo-report-future-incompatibilities.html)\ &nbsp;&nbsp;&nbsp;&nbsp;报告任何最终无法编译的 crate。

### 通用命令

[cargo-help(1)](cargo-help.html)\ &nbsp;&nbsp;&nbsp;&nbsp;显示关于 Cargo 的帮助信息。

[cargo-version(1)](cargo-version.html)\ &nbsp;&nbsp;&nbsp;&nbsp;显示版本信息。

## 选项

### 特殊选项

<dl>

<dt class="option-term" id="option-cargo--V"><a class="option-anchor" href="#option-cargo--V"><code>-V</code></a></dt>
<dt class="option-term" id="option-cargo---version"><a class="option-anchor" href="#option-cargo---version"><code>--version</code></a></dt>
<dd class="option-desc"><p>打印版本信息后退出。若使用 <code>--verbose</code>，将输出额外信息。</p>
</dd>


<dt class="option-term" id="option-cargo---list"><a class="option-anchor" href="#option-cargo---list"><code>--list</code></a></dt>
<dd class="option-desc"><p>列出所有已安装的 Cargo 子命令。若使用 <code>--verbose</code>，将输出额外信息。</p>
</dd>


<dt class="option-term" id="option-cargo---explain"><a class="option-anchor" href="#option-cargo---explain"><code>--explain</code> <em>code</em></a></dt>
<dd class="option-desc"><p>运行 <code>rustc --explain CODE</code>，这将详细解释错误信息（例如 <code>E0004</code>）。</p>
</dd>


</dl>

### 显示选项

<dl>

<dt class="option-term" id="option-cargo--v"><a class="option-anchor" href="#option-cargo--v"><code>-v</code></a></dt>
<dt class="option-term" id="option-cargo---verbose"><a class="option-anchor" href="#option-cargo---verbose"><code>--verbose</code></a></dt>
<dd class="option-desc"><p>启用详细输出。可以通过两次指定 <code>term.verbose</code> <a href="../reference/config.html">配置值</a>来设置“非常详细”的输出，包含依赖警告和构建脚本输出等额外内容。</p>
</dd>


<dt class="option-term" id="option-cargo--q"><a class="option-anchor" href="#option-cargo--q"><code>-q</code></a></dt>
<dt class="option-term" id="option-cargo---quiet"><a class="option-anchor" href="#option-cargo---quiet"><code>--quiet</code></a></dt>
<dd class="option-desc"><p>不打印 Cargo 日志消息。也可以通过 <code>term.quiet</code> <a href="../reference/config.html">配置值</a>来禁用。</p>
</dd>


<dt class="option-term" id="option-cargo---color"><a class="option-anchor" href="#option-cargo---color"><code>--color</code> <em>when</em></a></dt>
<dd class="option-desc"><p>控制颜色输出的使用情况。有效值包括： <ul> <li><code>auto</code>（默认）：自动检测终端是否支持颜色显示。</li> <li><code>always</code>：始终显示颜色。</li> <li><code>never</code>：从不显示颜色。</li> </ul> <p>也可以通过 <code>term.color</code> <a href="../reference/config.html">配置值</a>来设置。</p></p>
</dd>


</dl>

### 清单选项

<dl>
<dt class="option-term" id="option-cargo---locked"><a class="option-anchor" href="#option-cargo---locked"><code>--locked</code></a></dt>
<dd class="option-desc"><p>确保使用的依赖项和版本与原始生成 <code>Cargo.lock</code> 文件一致。出现以下情况时，Cargo 将以错误状态退出： <ul> <li>锁文件缺失。</li> <li>由于不同的依赖解析导致 Cargo 尝试修改锁文件。</li> </ul> <p>在需要确定性构建的环境中（如 CI 流水线），可以使用此选项。</p></p>
</dd>


<dt class="option-term" id="option-cargo---offline"><a class="option-anchor" href="#option-cargo---offline"><code>--offline</code></a></dt>
<dd class="option-desc"><p>防止 Cargo 因任何原因访问网络。如果没有此标志，当 Cargo 需要访问网络但网络不可用时，它将出现错误并停止。使用此标志后，Cargo 将尽可能在不连接网络的情况下继续运行。</p> <p>请注意，这可能会导致与在线模式不同的依赖解析结果。即使本地索引副本中显示有更新版本，Cargo 也会限制自己仅使用本地下载的包。在离线操作前，请查看 <a href="cargo-fetch.html">cargo-fetch(1)</a> 命令以下载依赖项。</p> <p>也可以通过 <code>net.offline</code> <a href="../reference/config.html">配置值</a>来指定此标志。</p>
</dd>


<dt class="option-term" id="option-cargo---frozen"><a class="option-anchor" href="#option-cargo---frozen"><code>--frozen</code></a></dt>
<dd class="option-desc"><p>相当于同时指定 <code>--locked</code> 和 <code>--offline</code>。</p>
</dd>

</dl>

### 常见选项

<dl>

<dt class="option-term" id="option-cargo-+toolchain"><a class="option-anchor" href="#option-cargo-+toolchain"><code>+</code><em>toolchain</em></a></dt>
<dd class="option-desc"><p>如果 Cargo 是通过 rustup 安装的，且 <code>cargo</code> 的第一个参数以 <code>+</code> 开头，则会被解释为 rustup 工具链名称（如 <code>+stable</code> 或 <code>+nightly</code>）。 有关工具链覆盖机制更多信息，请参阅 <a href="https://rust-lang.github.io/rustup/overrides.html">rustup 文档</a>。</p>
</dd>


<dt class="option-term" id="option-cargo---config"><a class="option-anchor" href="#option-cargo---config"><code>--config</code> <em>KEY=VALUE</em> or <em>PATH</em></a></dt>
<dd class="option-desc"><p>覆盖 Cargo 配置值。参数应为 TOML 语法 <code>KEY=VALUE</code>，或作为额外配置文件的路径提供。此标志可以多次指定。 有关更多信息，请参阅 <a href="../reference/config.html#command-line-overrides">命令行覆盖部分</a>。</p>
</dd>


<dt class="option-term" id="option-cargo--C"><a class="option-anchor" href="#option-cargo--C"><code>-C</code> <em>PATH</em></a></dt>
<dd class="option-desc"><p>此选项仅在 <a href="https://doc.rust-lang.org/book/appendix-07-nightly-rust.html">nightly 通道</a>上可用，并且需要 <code>-Z unstable-options</code> 标志才能启用（参见 <a href="https://github.com/rust-lang/cargo/issues/10098">#10098</a>）。</p>
</dd>


<dt class="option-term" id="option-cargo--h"><a class="option-anchor" href="#option-cargo--h"><code>-h</code></a></dt>
<dt class="option-term" id="option-cargo---help"><a class="option-anchor" href="#option-cargo---help"><code>--help</code></a></dt>
<dd class="option-desc"><p>打印帮助信息。</p>
</dd>


<dt class="option-term" id="option-cargo--Z"><a class="option-anchor" href="#option-cargo--Z"><code>-Z</code> <em>flag</em></a></dt>
<dd class="option-desc"><p>针对 Cargo 的不稳定（仅夜间生效）标志。运行 <code>cargo -Z help</code> 以查看详情。</p>
</dd>


</dl>

## 环境

有关 Cargo 读取的环境变量详情，请参阅 [参考手册](../reference/environment-variables.html)。

## 退出状态

* `0`: Cargo 成功执行。
* `101`: Cargo 未能完成执行。

## 文件

`~/.cargo/`\ &nbsp;&nbsp;&nbsp;&nbsp;Cargo “主页”目录的默认位置，用于存储各种文件。可以通过 `CARGO_HOME` 环境变量更改该位置。

`$CARGO_HOME/bin/`\ &nbsp;&nbsp;&nbsp;&nbsp;[cargo-install(1)](cargo-install.html) 安装的二进制文件将位于此处。如果使用 [rustup]，与 Rust 一起分发的可执行文件也位于此处。

`$CARGO_HOME/config.toml`\ &nbsp;&nbsp;&nbsp;&nbsp;全局配置文件。有关配置文件的更多信息，请参阅 [参考手册](../reference/config.html)。

`.cargo/config.toml`\ &nbsp;&nbsp;&nbsp;&nbsp;Cargo 会自动在当前目录及其所有父目录中搜索名为 `.cargo/config.toml` 的文件。这些配置文件将与全局配置文件合并。

`$CARGO_HOME/credentials.toml`\ &nbsp;&nbsp;&nbsp;&nbsp;用于登录注册表的私有认证信息。

`$CARGO_HOME/registry/`\ &nbsp;&nbsp;&nbsp;&nbsp;该目录包含缓存的注册表索引和任何下载的依赖项。

`$CARGO_HOME/git/`\ &nbsp;&nbsp;&nbsp;&nbsp;该目录包含 git 依赖项的缓存下载文件。

请注意 `$CARGO_HOME` 目录的内部结构目前并不稳定，可能会发生变化。


## 示例

1. 构建本地包及其所有依赖项：

       cargo build

2. 使用优化选项构建包：

       cargo build --release

3. 运行跨平台目标的测试：

       cargo test --目标 i686-unknown-linux-gnu

4. 创建可执行的新包：

       cargo new foobar

5. 在当前目录中创建包：

       mkdir foo && cd foo cargo init .

6. 了解命令的选项和用法：

       cargo help clean

## 缺陷

有关问题，请查看 <https://github.com/rust-lang/cargo/issues>。

## 参见

[rustc(1)](https://doc.rust-lang.org/rustc/index.html), [rustdoc(1)](https://doc.rust-lang.org/rustdoc/index.html)

[aliases]: ../reference/config.html#alias
[external tools]: ../reference/external-tools.html#custom-subcommands
[rustup]: https://rust-lang.github.io/rustup/
