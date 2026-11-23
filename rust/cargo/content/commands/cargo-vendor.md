# cargo-vendor(1)

## 名称

cargo-vendor --- 将所有依赖项本地化到“vendor”目录中

## 概述

`cargo vendor` [_选项_] [_路径_]

## 描述

此 cargo 子命令会将项目的所有 crates.io 和 git 依赖项部署到指定的 `<path>` 目录中。执行该命令后，由 `<path>` 指定的 vendor 目录将包含所有远程来源的依赖项。可以通过 `-s` 选项指定额外的清单文件。

在 `cargo vendor` 完成部署过程后，使用这些本地化源所需的配置信息将被输出到标准输出中。你需要将其添加到或重定向到你的 Cargo 配置文件（通常对于当前包而言是 `.cargo/config.toml`）。

Cargo 将本地化的源视为只读资源，就像对注册表和 git 源一样。如果你打算从远程源修改某个 crate，请使用 `[patch]` 或指向该 crate 本地副本的 `path` 依赖项。这样，在增量构建时 Cargo 会正确处理该 crate，因为它知道它不再是一个只读依赖项。

## 选项

### 本地化选项

<dl>

<dt class="option-term" id="option-cargo-vendor--s"><a class="option-anchor" href="#option-cargo-vendor--s"><code>-s</code> <em>manifest</em></a></dt>
<dt class="option-term" id="option-cargo-vendor---sync"><a class="option-anchor" href="#option-cargo-vendor---sync"><code>--sync</code> <em>manifest</em></a></dt>
<dd class="option-desc"><p>指定一个额外的 <code>Cargo.toml</code> 清单文件用于工作空间，该文件也需被打包并同步到输出中。可以多次指定。</p>
</dd>


<dt class="option-term" id="option-cargo-vendor---no-delete"><a class="option-anchor" href="#option-cargo-vendor---no-delete"><code>--no-delete</code></a></dt>
<dd class="option-desc"><p>在打包时不要删除“vendor”目录，而是保留该目录中的所有内容。</p>
</dd>


<dt class="option-term" id="option-cargo-vendor---respect-source-config"><a class="option-anchor" href="#option-cargo-vendor---respect-source-config"><code>--respect-source-config</code></a></dt>
<dd class="option-desc"><p>在 <code>.cargo/config.toml</code> 中默认不忽略 <code>[source]</code> 配置，而是读取它并在下载库包时使用。</p>
</dd>


<dt class="option-term" id="option-cargo-vendor---versioned-dirs"><a class="option-anchor" href="#option-cargo-vendor---versioned-dirs"><code>--versioned-dirs</code></a></dt>
<dd class="option-desc"><p>通常版本仅用于区分同一包的多个版本。此选项会使“vendor”目录中的所有目录都被版本化，从而更容易跟踪打包库的歷史變化，并且在只有部分庫包發生變更時，可以提升重新打包的性能。</p>
</dd>


</dl>

### 清单文件选项

<dl>

<dt class="option-term" id="option-cargo-vendor---manifest-path"><a class="option-anchor" href="#option-cargo-vendor---manifest-path"><code>--manifest-path</code> <em>path</em></a></dt>
<dd class="option-desc"><p><code>Cargo.toml</code> 文件的路徑。默认情況下，Cargo會在當前目錄或任何父目錄中搜索 <code>Cargo.toml</code> 文件。</p>
</dd>


<dt class="option-term" id="option-cargo-vendor---locked"><a class="option-anchor" href="#option-cargo-vendor---locked"><code>--locked</code></a></dt>
<dd class="option-desc"><p>強制要求使用與原始生成現有 <code>Cargo.lock</code> 文件相同的依賴項和版本。如果出現以下任一情況，Cargo將以錯誤退出： <ul> <li>鎖文件缺失。</li> <li>因不同的依賴解析而需要修改鎖文件。</li> </ul> 此選項可用於需要確定性的建置環境中，例如 CI 管道。</p>
</dd>


<dt class="option-term" id="option-cargo-vendor---offline"><a class="option-anchor" href="#option-cargo-vendor---offline"><code>--offline</code></a></dt>
<dd class="option-desc"><p>防止 Cargo 因任何原因訪問網絡。如果沒有此標誌，當 Cargo 需要訪問網絡且無法連接時將以錯誤退出。如果有此標誌，Cargo 將嘗試在可能情況下不經過網絡即可繼續操作。 注意，這可能導致與線上模式不同的依賴解析。Cargo 將限制自己只使用本地下載的庫包，即使本地索引中顯示有更新版本也是如此。在離線前，請參閱 <a href="cargo-fetch.html">cargo-fetch(1)</a> 命令下載依賴項。 也可以通過 <code>net.offline</code> <a href="../reference/config.html">配置值</a>指定此標誌。</p>
</dd>


<dt class="option-term" id="option-cargo-vendor---frozen"><a class="option-anchor" href="#option-cargo-vendor---frozen"><code>--frozen</code></a></dt>
<dd class="option-desc"><p>相当于同时指定 <code>--locked</code> 和 <code>--offline</code>。</p>
</dd>



</dl>

### 显示选项

<dl>

<dt class="option-term" id="option-cargo-vendor--v"><a class="option-anchor" href="#option-cargo-vendor--v"><code>-v</code></a></dt>
<dt class="option-term" id="option-cargo-vendor---verbose"><a class="option-anchor" href="#option-cargo-vendor---verbose"><code>--verbose</code></a></dt>
<dd class="option-desc"><p>使用详细输出。可以两次指定以得到“非常详细”的输出，包括依赖警告和构建脚本输出等额外内容。 也可以通过 <code>term.verbose</code> <a href="../reference/config.html">配置值</a>来指定。</p>
</dd>


<dt class="option-term" id="option-cargo-vendor--q"><a class="option-anchor" href="#option-cargo-vendor--q"><code>-q</code></a></dt>
<dt class="option-term" id="option-cargo-vendor---quiet"><a class="option-anchor" href="#option-cargo-vendor---quiet"><code>--quiet</code></a></dt>
<dd class="option-desc"><p>不要打印 cargo 日志消息。 也可以通过 <code>term.quiet</code> <a href="../reference/config.html">配置值</a>来指定。</p>
</dd>


<dt class="option-term" id="option-cargo-vendor---color"><a class="option-anchor" href="#option-cargo-vendor---color"><code>--color</code> <em>when</em></a></dt>
<dd class="option-desc"><p>控制是否使用彩色输出。有效值包括： <ul> <li><code>auto</code>（默认）：自动检测终端是否支持颜色显示。</li> <li><code>always</code>：始终显示颜色。</li> <li><code>never</code>：从不显示颜色。</li> </ul> 也可以通过 <code>term.color</code> <a href="../reference/config.html">配置值</a>来指定。</p>
</dd>


</dl>

### 常用选项

<dl>

<dt class="option-term" id="option-cargo-vendor-+toolchain"><a class="option-anchor" href="#option-cargo-vendor-+toolchain"><code>+</code><em>toolchain</em></a></dt>
<dd class="option-desc"><p>如果 Cargo 通过 rustup 安装，且 <code>cargo</code> 的第一个参数以 <code>+</code> 开头，则会被解释为 rustup 工具链名称（如 <code>+stable</code> 或 <code>+nightly</code>）。 有关工具链覆盖机制的更多信息，请参阅 <a href="https://rust-lang.github.io/rustup/overrides.html">rustup 文档</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-vendor---config"><a class="option-anchor" href="#option-cargo-vendor---config"><code>--config</code> <em>KEY=VALUE</em> or <em>PATH</em></a></dt>
<dd class="option-desc"><p>用于覆盖 Cargo 配置值。参数应为 TOML 格式 <code>KEY=VALUE</code>，或作为额外配置文件的路径提供。此标志可以多次指定。 有关更多信息，请参阅 <a href="../reference/config.html#command-line-overrides">命令行覆盖部分</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-vendor--C"><a class="option-anchor" href="#option-cargo-vendor--C"><code>-C</code> <em>PATH</em></a></dt>
<dd class="option-desc"><p>在执行任何指定操作之前，此选项会更改当前工作目录。这会影响诸如 cargo 默认查找项目清单 (<code>Cargo.toml</code>)的位置，以及用于发现 <code>.cargo/config.toml</code> 的搜索目录等设置。该选项必须位于命令名称之前，例如 <code>cargo -C path/to/my-project build</code>。</p> <p>此选项仅适用于 <a href="https://doc.rust-lang.org/book/appendix-07-nightly-rust.html">nightly 版本</a>，并且需要使用 <code>-Z unstable-options</code> 标志才能启用（参见 <a href="https://github.com/rust-lang/cargo/issues/10098">#10098</a>）。</p>
</dd>


<dt class="option-term" id="option-cargo-vendor--h"><a class="option-anchor" href="#option-cargo-vendor--h"><code>-h</code></a></dt>
<dt class="option-term" id="option-cargo-vendor---help"><a class="option-anchor" href="#option-cargo-vendor---help"><code>--help</code></a></dt>
<dd class="option-desc"><p>此选项会打印帮助信息。</p>
</dd>


<dt class="option-term" id="option-cargo-vendor--Z"><a class="option-anchor" href="#option-cargo-vendor--Z"><code>-Z</code> <em>flag</em></a></dt>
<dd class="option-desc"><p>这是 Cargo 的不稳定（仅 nightly 版本）标志。如需详细信息，请运行 <code>cargo -Z help</code>。</p>
</dd>


</dl>

## 环境

有关 Cargo 读取的环境变量详情，请参阅 [参考手册](../reference/environment-variables.html)。

## 退出状态

* `0`: Cargo 成功执行。
* `101`: Cargo 未能完成执行。

## 示例

1. 将所有依赖项本地化到本地“vendor”文件夹中

       cargo vendor

2. 将所有依赖项本地化到本地“third-party/vendor”文件夹中

       cargo vendor third-party/vendor

3. 将当前工作空间及其他工作空间的依赖项都本地化为“vendor”

       cargo vendor -s ../path/to/Cargo.toml

4. 进行本地化操作并将必要的配置文件重定向到配置文件。

       cargo vendor > path/to/my/cargo/config.toml

## 参见 [cargo(1)](cargo.html)

