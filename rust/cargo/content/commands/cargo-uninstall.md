# cargo-uninstall(1)

## 名称

cargo-uninstall --- 卸载 Rust 二进制文件

## 使用说明

`cargo uninstall` [_options_] [_spec_...]

## 描述

此命令用于卸载通过 [cargo-install(1)](cargo-install.html) 安装的包。_spec_ 参数表示要卸载的包 ID 规范（参见 [cargo-pkgid(1)](cargo-pkgid.html)）。

默认情况下，会卸载该 crate 中的所有二进制文件，但可以使用 `--bin` 和 `--example` 选项仅卸载特定二进制文件。

安装根目录的确定顺序如下：

- `--root` 选项
- `CARGO_INSTALL_ROOT` 环境变量
- `install.root` Cargo [配置值](../reference/config.html)
- `CARGO_HOME` 环境变量
- `$HOME/.cargo`

## 选项

### 卸载选项

<dl>

<dt class="option-term" id="option-cargo-uninstall--p"><a class="option-anchor" href="#option-cargo-uninstall--p"><code>-p</code></a></dt>
<dt class="option-term" id="option-cargo-uninstall---package"><a class="option-anchor" href="#option-cargo-uninstall---package"><code>--package</code> <em>spec</em>…</a></dt>
<dd class="option-desc"><p>要卸载的包。</p>
</dd>


<dt class="option-term" id="option-cargo-uninstall---bin"><a class="option-anchor" href="#option-cargo-uninstall---bin"><code>--bin</code> <em>name</em>…</a></dt>
<dd class="option-desc"><p>仅卸载二进制文件 <em>名称</em>。</p>
</dd>


<dt class="option-term" id="option-cargo-uninstall---root"><a class="option-anchor" href="#option-cargo-uninstall---root"><code>--root</code> <em>dir</em></a></dt>
<dd class="option-desc"><p>卸载包所来自的目录。</p>
</dd>


</dl>

### 显示选项

<dl>

<dt class="option-term" id="option-cargo-uninstall--v"><a class="option-anchor" href="#option-cargo-uninstall--v"><code>-v</code></a></dt>
<dt class="option-term" id="option-cargo-uninstall---verbose"><a class="option-anchor" href="#option-cargo-uninstall---verbose"><code>--verbose</code></a></dt>
<dd class="option-desc"><p>使用详细输出。可以指定两次以获得“非常详细”的输出，其中包含额外的输出，如依赖警告和构建脚本输出。也可以通过 <code>term.verbose</code> <a href="../reference/config.html">配置值</a>来指定。</p>
</dd>


<dt class="option-term" id="option-cargo-uninstall--q"><a class="option-anchor" href="#option-cargo-uninstall--q"><code>-q</code></a></dt>
<dt class="option-term" id="option-cargo-uninstall---quiet"><a class="option-anchor" href="#option-cargo-uninstall---quiet"><code>--quiet</code></a></dt>
<dd class="option-desc"><p>不打印 Cargo 日志消息。也可以通过 <code>term.quiet</code> <a href="../reference/config.html">配置值</a>来指定。</p>
</dd>


<dt class="option-term" id="option-cargo-uninstall---color"><a class="option-anchor" href="#option-cargo-uninstall---color"><code>--color</code> <em>when</em></a></dt>
<dd class="option-desc"><p>控制彩色输出的使用方式。有效值包括： <ul> <li><code>auto</code>（默认）：自动检测终端是否支持颜色显示。</li> <li><code>always</code>：始终显示颜色。</li> <li><code>never</code>：从不显示颜色。</li> </ul> <p>也可以通过 <code>term.color</code> <a href="../reference/config.html">配置值</a>来指定。</p></p></dd>


</dl>

### 常用选项

<dl>

<dt class="option-term" id="option-cargo-uninstall-+toolchain"><a class="option-anchor" href="#option-cargo-uninstall-+toolchain"><code>+</code><em>toolchain</em></a></dt>
<dd class="option-desc"><p>如果 Cargo 通过 rustup 安装，且 <code>cargo</code> 的第一个参数以 <code>+</code> 开头，则会被解释为 rustup 工具链名称（如 <code>+stable</code> 或 <code>+nightly</code>）。 有关工具链覆盖机制的更多信息，请参阅 <a href="https://rust-lang.github.io/rustup/overrides.html">rustup 文档</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-uninstall---config"><a class="option-anchor" href="#option-cargo-uninstall---config"><code>--config</code> <em>KEY=VALUE</em> or <em>PATH</em></a></dt>
<dd class="option-desc"><p>用于覆盖 Cargo 配置值。参数应为 TOML 格式 <code>KEY=VALUE</code>，或作为额外配置文件的路径提供。此标志可以多次指定。 有关更多信息，请参阅 <a href="../reference/config.html#command-line-overrides">命令行覆盖部分</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-uninstall--C"><a class="option-anchor" href="#option-cargo-uninstall--C"><code>-C</code> <em>PATH</em></a></dt>
<dd class="option-desc"><p>在执行任何指定操作之前，更改当前工作目录。这会影响诸如 cargo 默认查找项目清单 (<code>Cargo.toml</code>)的位置，以及用于发现 <code>.cargo/config.toml</code> 的搜索目录等设置。此选项必须出现在命令名称之前，例如 <code>cargo -C path/to/my-project build</code>。</p> <p>此选项仅适用于 <a href="https://doc.rust-lang.org/book/appendix-07-nightly-rust.html">nightly 渠道</a>，并且需要使用 <code>-Z unstable-options</code> 标志才能启用（参见 <a href="https://github.com/rust-lang/cargo/issues/10098">#10098</a>）。</p>
</dd>


<dt class="option-term" id="option-cargo-uninstall--h"><a class="option-anchor" href="#option-cargo-uninstall--h"><code>-h</code></a></dt>
<dt class="option-term" id="option-cargo-uninstall---help"><a class="option-anchor" href="#option-cargo-uninstall---help"><code>--help</code></a></dt>
<dd class="option-desc"><p>打印帮助信息。</p>
</dd>


<dt class="option-term" id="option-cargo-uninstall--Z"><a class="option-anchor" href="#option-cargo-uninstall--Z"><code>-Z</code> <em>flag</em></a></dt>
<dd class="option-desc"><p>Cargo 的不稳定（仅 nightly 版本）标志。运行 <code>cargo -Z help</code> 以获取详细信息。</p>
</dd>


</dl>

## 环境

有关 Cargo 读取的环境变量详情，请参阅 [参考手册](../reference/environment-variables.html)。

## 退出状态

* `0`: Cargo 执行成功。
* `101`: Cargo 执行失败。

## 示例

1. 卸载之前安装的包。

       cargo uninstall ripgrep

## 另请参阅 [cargo(1)](cargo.html)、[cargo-install(1)](cargo-install.html)
