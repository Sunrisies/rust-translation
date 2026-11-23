# cargo-init(1)

## 名称

cargo-init —— 在现有目录中创建新的 Cargo 包

## 概述

`cargo init` [_选项_] [_路径_]

## 描述

此命令将在当前目录中创建一个新的 Cargo 清单。将路径作为参数传入，即可在指定目录中创建。

如果目录中已经存在具有常规名称的 Rust 源文件，则这些文件将被使用。如果没有，则会创建一个示例 `src/main.rs` 文件，或者当传递 `--lib` 参数时则创建 `src/lib.rs`。

如果目录尚未存储在 VCS 仓库中，则将创建一个新仓库（参见下面的 `--vcs` 选项）。

有关可以创建新目录中的新包的类似命令，请参阅 [cargo-new(1)](cargo-new.html)。

## 选项

### Init 选项

<dl>

<dt class="option-term" id="option-cargo-init---bin"><a class="option-anchor" href="#option-cargo-init---bin"><code>--bin</code></a></dt>
<dd class="option-desc"><p>创建一个具有二进制目标的包 (<code>src/main.rs</code>)。 这是默认行为。</p>
</dd>


<dt class="option-term" id="option-cargo-init---lib"><a class="option-anchor" href="#option-cargo-init---lib"><code>--lib</code></a></dt>
<dd class="option-desc"><p>创建一个具有库目标的包 (<code>src/lib.rs</code>)。</p>
</dd>


<dt class="option-term" id="option-cargo-init---edition"><a class="option-anchor" href="#option-cargo-init---edition"><code>--edition</code> <em>edition</em></a></dt>
<dd class="option-desc"><p>指定要使用的 Rust 版本。默认为 2024。 可能的值：2015、2018、2021、2024</p>
</dd>


<dt class="option-term" id="option-cargo-init---name"><a class="option-anchor" href="#option-cargo-init---name"><code>--name</code> <em>name</em></a></dt>
<dd class="option-desc"><p>设置包名称。默认为目录名。</p>
</dd>


<dt class="option-term" id="option-cargo-init---vcs"><a class="option-anchor" href="#option-cargo-init---vcs"><code>--vcs</code> <em>vcs</em></a></dt>
<dd class="option-desc"><p>为给定的版本控制系统（git、hg、pijul 或 fossil）初始化一个新的 VCS 仓库，或者完全不初始化任何版本控制（none）。如果未指定，则默认为 <code>git</code> 或配置值 <code>cargo-new.vcs</>，若已处于 VCS 仓库中则为 <code>none</code>。</p>
</dd>


<dt class="option-term" id="option-cargo-init---registry"><a class="option-anchor" href="#option-cargo-init---registry"><code>--registry</code> <em>registry</em></a></dt>
<dd class="option-desc"><p>此选项将 <code>Cargo.toml</code> 中的 <code>publish</code> 字段设置为给定的注册表名称，从而仅限制发布到该注册表。 <p>注册表名称定义在 <a href="../reference/config.html">Cargo 配置文件中</a>。如果未指定，则使用 <code>registry.default</code> 配置键定义的默认注册表。如果未设置默认注册表且不使用 <code>--registry</code>，则不会设置 <code>publish</code> 字段，这意味着发布不会被限制。</p></p></dd>


</dl>

### 显示选项

<dl>
<dt class="option-term" id="option-cargo-init--v"><a class="option-anchor" href="#option-cargo-init--v"><code>-v</code></a></dt>
<dt class="option-term" id="option-cargo-init---verbose"><a class="option-anchor" href="#option-cargo-init---verbose"><code>--verbose</code></a></dt>
<dd class="option-desc"><p>使用详细输出。可以两次指定以获得“非常详细”的输出，包括依赖警告和构建脚本输出等额外内容。 也可以通过 <a href="../reference/config.html">配置值</a>中的 <code>term.verbose</code> 来指定。</p>
</dd>


<dt class="option-term" id="option-cargo-init--q"><a class="option-anchor" href="#option-cargo-init--q"><code>-q</code></a></dt>
<dt class="option-term" id="option-cargo-init---quiet"><a class="option-anchor" href="#option-cargo-init---quiet"><code>--quiet</code></a></dt>
<dd class="option-desc"><p>不打印 cargo 日志消息。 也可以通过 <a href="../reference/config.html">配置值</a>中的 <code>term.quiet</code> 来指定。</p>
</dd>


<dt class="option-term" id="option-cargo-init---color"><a class="option-anchor" href="#option-cargo-init---color"><code>--color</code> <em>when</em></a></dt>
<dd class="option-desc"><p>控制彩色输出的使用情况。有效值： <ul> <li><code>auto</code>（默认）：自动检测终端是否支持颜色显示。</li> <li><code>always</code>：始终显示颜色。</li> <li><code>never</code>：从不显示颜色。</li> </ul> <p>也可以通过 <a href="../reference/config.html">配置值</a>中的 <code>term.color</code> 来指定。</p></p></dd>

</dl>

### 常用选项

<dl>

<dt class="option-term" id="option-cargo-init-+toolchain"><a class="option-anchor" href="#option-cargo-init-+toolchain"><code>+</code><em>toolchain</em></a></dt>
<dd class="option-desc"><p>如果已使用 rustup 安装 Cargo，且 <code>cargo</code> 的第一个参数以 <code>+</code> 开头，则会被解释为 rustup 工具链名称（如 <code>+stable</code> 或 <code>+nightly</code>）。 有关工具链覆盖机制更多信息，请参阅<a href="https://rust-lang.github.io/rustup/overrides.html">rustup 文档</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-init---config"><a class="option-anchor" href="#option-cargo-init---config"><code>--config</code> <em>KEY=VALUE</em> or <em>PATH</em></a></dt>
<dd class="option-desc"><p>用于覆盖 Cargo 配置值。参数应为 TOML 格式 <code>KEY=VALUE</code>，或作为额外配置文件的路径提供。此标志可以多次指定。 有关更多信息，请参阅<a href="../reference/config.html#command-line-overrides">命令行覆盖部分</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-init--C"><a class="option-anchor" href="#option-cargo-init--C"><code>-C</code> <em>PATH</em></a></dt>
<dd class="option-desc"><p>在执行任何指定操作之前更改当前工作目录。这会影响 cargo 默认查找项目清单 (<code>Cargo.toml</code>)的位置，以及搜索 <code>.cargo/config.toml</code> 的目录等。此选项必须出现在命令名称之前，例如 <code>cargo -C path/to/my-project build</code>。 此选项仅适用于 <a href="https://doc.rust-lang.org/book/appendix-07-nightly-rust.html">nightly 渠道</a>，并且需要使用 <code>-Z unstable-options</code> 标志启用（参见 <a href="https://github.com/rust-lang/cargo/issues/10098">#10098</a>）。</p>
</dd>


<dt class="option-term" id="option-cargo-init--h"><a class="option-anchor" href="#option-cargo-init--h"><code>-h</code></a></dt>
<dt class="option-term" id="option-cargo-init---help"><a class="option-anchor" href="#option-cargo-init---help"><code>--help</code></a></dt>
<dd class="option-desc"><p>打印帮助信息。</p>
</dd>


<dt class="option-term" id="option-cargo-init--Z"><a class="option-anchor" href="#option-cargo-init--Z"><code>-Z</code> <em>flag</em></a></dt>
<dd class="option-desc"><p>Cargo 的不稳定（仅 nightly 版本）标志。运行 <code>cargo -Z help</code> 以查看详情。</p>
</dd>


</dl>

## 环境

有关 Cargo 读取的环境变量详情，请参阅 [参考手册](../reference/environment-variables.html)。

## 退出状态

* `0`: Cargo 执行成功。
* `101`: Cargo 执行失败。

## 示例

1. 在当前目录中创建二进制 Cargo 包：

       cargo init

## 另请参阅 [cargo(1)](cargo.html)、[cargo-new(1)](cargo-new.html)
