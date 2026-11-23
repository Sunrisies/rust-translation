# cargo-tree(1)
## 名称

cargo-tree --- 显示依赖图的树形可视化结构

## 概述

`cargo tree` [_选项_]

## 描述

此命令将在终端中显示依赖关系树。以下是一个依赖“rand”包的简单项目示例：

```
myproject v0.1.0 (/myproject)
└── rand v0.7.3
    ├── getrandom v0.1.14
    │   ├── cfg-if v0.1.10
    │   └── libc v0.2.68
    ├── libc v0.2.68 (*)
    ├── rand_chacha v0.2.2
    │   ├── ppv-lite86 v0.2.6
    │   └── rand_core v0.5.1
    │       └── getrandom v0.1.14 (*)
    └── rand_core v0.5.1 (*)
[build-dependencies]
└── cc v1.0.50
```

标有 `(*)` 的包已进行去重处理。该包的依赖项已在图的其他位置显示，因此不会重复出现。使用 `--no-dedupe` 选项可以重新显示重复的依赖项。

`-e` 标志可用于选择要显示的依赖类型。“features”类型会改变输出结果，以显示每个依赖项所启用的功能。例如，`cargo tree -e features`：

```
myproject v0.1.0 (/myproject)
└── log feature "serde"
    └── log v0.4.8
        ├── serde v1.0.106
        └── cfg-if feature "default"
            └── cfg-if v0.1.10
```

在此树形结构中，`myproject` 依赖于带有 `serde` 功能的 `log` 包。`log` 包又依赖于带有“default”功能的 `cfg-if` 包。当使用 `-e features` 时，使用 `-i` 标志来显示功能如何流入包中可能会更有帮助。请参见下面的示例以获取更多细节。

### 功能统一

此命令显示的图更接近 Cargo 构建时的功能统一图，而不是你在 `Cargo.toml` 中列出的内容。例如，如果你在 `[dependencies]` 和 `[dev-dependencies]` 中指定相同的依赖项，但启用了不同的功能，此命令可能会合并所有功能，并在某个依赖项上显示 `(*)` 以表示重复项。

因此，对于与 `cargo build` 大致相同的概览，`cargo tree -e normal,build` 非常接近；对于与 `cargo test` 大致相同的概览，`cargo tree` 也非常接近。然而，它并不保证与 Cargo 实际构建结果完全一致，因为编译过程复杂且受多种不同因素影响。

要了解更多关于功能统一的信息，请查看此 [专门章节](../reference/features.html#特性-unification)。

## 选项

### 树形选项

<dl>

<dt class="option-term" id="option-cargo-tree--i"><a class="option-anchor" href="#option-cargo-tree--i"><code>-i</code> <em>spec</em></a></dt>
<dt class="option-term" id="option-cargo-tree---invert"><a class="option-anchor" href="#option-cargo-tree---invert"><code>--invert</code> <em>spec</em></a></dt>
<dd class="option-desc"><p>显示给定包的反向依赖关系。此标志会反转依赖树，并展示依赖于该给定包的包。</p> <p>注意，在工作区中，默认情况下仅显示当前目录内工作区成员所在树中的该包的反向依赖关系。可以使用 <code>--workspace</code> 标志来扩展功能，使其显示整个工作区的该包反向依赖关系。使用 <code>-p</code> 标志时，则仅显示指定子树中该包的反向依赖关系。</p>
</dd>


<dt class="option-term" id="option-cargo-tree---prune"><a class="option-anchor" href="#option-cargo-tree---prune"><code>--prune</code> <em>spec</em></a></dt>
<dd class="option-desc"><p>从依赖树显示中排除给定包。</p>
</dd>


<dt class="option-term" id="option-cargo-tree---depth"><a class="option-anchor" href="#option-cargo-tree---depth"><code>--depth</code> <em>depth</em></a></dt>
<dd class="option-desc"><p>依赖树的最大显示深度。例如，深度为 1 时仅显示直接依赖项。</p> <p>如果给定值为 <code>workspace</code>，则仅显示当前工作区中的依赖项。</p>
</dd>


<dt class="option-term" id="option-cargo-tree---no-dedupe"><a class="option-anchor" href="#option-cargo-tree---no-dedupe"><code>--no-dedupe</code></a></dt>
<dd class="option-desc"><p>不重复显示重复的依赖关系。通常，当某个包已显示其依赖关系后，后续出现的情况不会重新显示其依赖关系，并将添加 <code>(*)</code> 标记以表明已显示过。此标志会导致这些重复项被再次显示。</p>
</dd>


<dt class="option-term" id="option-cargo-tree--d"><a class="option-anchor" href="#option-cargo-tree--d"><code>-d</code></a></dt>
<dt class="option-term" id="option-cargo-tree---duplicates"><a class="option-anchor" href="#option-cargo-tree---duplicates"><code>--duplicates</code></a></dt>
<dd class="option-desc"><p>仅显示多个版本存在的依赖关系（等同于 <code>--invert</code>）。与 <code>-p</code> 标志一起使用时，仅显示指定子树中重复的依赖项。</p> <p>为了避免多次构建相同的包，这对构建时间和可执行文件大小有益。此标志有助于识别问题包。然后可以调查依赖于旧版本重复包的包是否可更新为新版本，从而只构建一个实例。</p>
</dd>


<dt class="option-term" id="option-cargo-tree--e"><a class="option-anchor" href="#option-cargo-tree--e"><code>-e</code> <em>kinds</em></a></dt>
<dt class="option-term" id="option-cargo-tree---edges"><a class="option-anchor" href="#option-cargo-tree---edges"><code>--edges</code> <em>kinds</em></a></dt>
<dd class="option-desc"><p>要显示的依赖类型。采用逗号分隔的值列表：</p> <ul> <li><code>all</code> — 显示所有边缘类型。</li> <li><code>normal</code> — 显示普通依赖。</li> <li><code>build</code> — 显示构建依赖。</li> <li><code>dev</code> — 显示开发依赖。</li> <li><code>features</code> — 显示每个依赖所启用的功能。如果只给出这种类型，则会自动包含其他依赖类型。</li> <li><code>no-normal</code> — 不包含普通依赖。</li> <li><code>no-build</code> — 不包含构建依赖。</li> <li><code>no-dev</code> — 不包含开发依赖。</li> <li><code>no-proc-macro</code> — 不包含过程式宏依赖。</li> </ul> <p><code>normal</code>、<code>build</code>、<code>dev</code> 和 <code>all</code> 依赖类型不能与 <code>no-normal</code>、<code>no-build</code> 或 <code>no-dev</code> 依赖类型混合。</p> <p>默认值为 <code>normal,build,dev</code>。</p>
</dd>


<dt class="option-term" id="option-cargo-tree---target"><a class="option-anchor" href="#option-cargo-tree---target"><code>--target</code> <em>tuple</em></a></dt>
<dd class="option-desc"><p>筛选符合给定<a href="../appendix/glossary.html#target">目标元组</a>的依赖项。默认值为宿主平台。使用值 <code>all</code> 可以包含<em>所有</em>目标。</p>
</dd>


</dl>

### 树形格式选项

<dl>

<dt class="option-term" id="option-cargo-tree---charset"><a class="option-anchor" href="#option-cargo-tree---charset"><code>--charset</code> <em>charset</em></a></dt>
<dd class="option-desc"><p>选择用于树结构的字符集。有效值为“utf8”或“ascii”。如果未指定，cargo将自动选择一个值。</p>
</dd>


<dt class="option-term" id="option-cargo-tree--f"><a class="option-anchor" href="#option-cargo-tree--f"><code>-f</code> <em>format</em></a></dt>
<dt class="option-term" id="option-cargo-tree---format"><a class="option-anchor" href="#option-cargo-tree---format"><code>--format</code> <em>format</em></a></dt>
<dd class="option-desc"><p>设置每个包的格式字符串。默认值为“{p}”。</p> <p>这是一个任意字符串，用于显示每个包。以下字符串将被替换为对应的值：</p> <ul> <li><code>{p}</code>, <code>{package}</code> — 包名称。</li> <li><code>{l}</code>, <code>{license}</code> — 包许可证。</li> <li><code>{r}</code>, <code>{repository}</code> — 包仓库 URL。</li> <li><code>{f}</code>, <code>{features}</code> — 启用的包功能的逗号分隔列表。</li> <li><code>{lib}</code> — 在 <code>use</code> 语句中使用的包库名称。</li> </ul> </dd> <dt class="option-term" id="option-cargo-tree---prefix"><a class="option-anchor" href="#option-cargo-tree---prefix"><code>--prefix</code> <em>prefix</em></a></dt> <dd class="option-desc"><p>设置每行的显示方式。<em>prefix</em> 值可以是以下之一：</p> <ul> <li><code>indent</code> (默认) — 以树形格式缩进显示每一行。</li> <li><code>depth</code> — 以列表形式显示，每个条目前会打印数字深度。</li> <li><code>none</code> — 以平铺列表形式显示。</li> </ul> </dd> </dl> ### 包选择 默认情况下，如果没有指定包选择选项，所选的包取决于选定的清单文件（如果未提供 `--manifest-path`，则基于当前工作目录）。如果清单是工作空间的根目录，则选择工作空间的默认成员；否则仅选择清单中定义的包。 工作空间的默认成员可以通过根清单中的 `workspace.default-members` 键显式设置。如果未设置此值，虚拟工作空间将包含所有工作空间成员（相当于传递 `--workspace`），而非虚拟工作空间将仅包含根 crate。 <dl> <dt class="option-term" id="option-cargo-tree--p"><a class="option-anchor" href="#option-cargo-tree--p"><code>-p</code> <em>spec</em>…</a></dt> <dt class="option-term" id="option-cargo-tree---package"><a class="option-anchor" href="#option-cargo-tree---package"><code>--package</code> <em>spec</em>…</a></dt> <dd class="option-desc"><p>仅显示指定的包。有关 SPEC 格式，请参阅 <a href="cargo-pkgid.html">cargo-pkgid(1)</a>。此标志可以多次指定，并支持常见的 Unix glob 模式，如 <code>*</code>、<code>?</code> 和 <code>[]</code>。然而，为了避免 shell 在 Cargo 处理之前意外展开 glob 模式，必须在每个模式周围使用单引号或双引号。</td></p>
</dd>


<dt class="option-term" id="option-cargo-tree---workspace"><a class="option-anchor" href="#option-cargo-tree---workspace"><code>--workspace</code></a></dt>
<dd class="option-desc"><p>显示工作区中的所有成员。</p>
</dd>



<dt class="option-term" id="option-cargo-tree---exclude"><a class="option-anchor" href="#option-cargo-tree---exclude"><code>--exclude</code> <em>SPEC</em>…</a></dt>
<dd class="option-desc"><p>排除指定的包。必须与 <code>--workspace</code> 标志一起使用。该标志可以多次指定，并支持常见的 Unix glob 模式，如 <code>*</code>、<code>?</code> 和 <code>[]</code>。然而，为了避免 shell 在 Cargo 处理之前意外展开 glob 模式，必须在每个模式下使用单引号或双引号。</p>
</dd>


</dl>

### 清单选项

<dl>

<dt class="option-term" id="option-cargo-tree---manifest-path"><a class="option-anchor" href="#option-cargo-tree---manifest-path"><code>--manifest-path</code> <em>path</em></a></dt>
<dd class="option-desc"><p><code>Cargo.toml</code> 文件的路径。默认情况下，Cargo 会在当前目录或其父目录中查找 <code>Cargo.toml</code> 文件。</p>
</dd>


<dt class="option-term" id="option-cargo-tree---locked"><a class="option-anchor" href="#option-cargo-tree---locked"><code>--locked</code></a></dt>
<dd class="option-desc"><p>确保使用的依赖项和版本与原始生成 <code>Cargo.lock</code> 文件时完全相同。当出现以下任一情况时，Cargo 将退出并抛出错误： <ul> <li>锁文件缺失。</li> <li>由于不同的依赖解析导致 Cargo 尝试修改锁文件。</li> </ul> 该选项适用于需要确定性构建的环境，例如 CI 流水线。</p>
</dd>


<dt class="option-term" id="option-cargo-tree---offline"><a class="option-anchor" href="#option-cargo-tree---offline"><code>--offline</code></a></dt>
<dd class="option-desc"><p>防止 Cargo 出于任何原因访问网络。如果没有此标志，如果 Cargo 需要访问网络而网络不可用时，它将以错误退出。使用此标志后，Cargo 将尽可能在不联网的情况下继续运行。 请注意，这可能导致与在线模式不同的依赖解析。Cargo 将限制自己仅使用本地下载的包，即使索引副本中显示有更新版本也是如此。在离线前，请参阅 <a href="cargo-fetch.html">cargo-fetch(1)</a> 命令来下载依赖项。 也可以通过 <code>net.offline</code> <a href="../reference/config.html">配置值</a>指定此标志。</p>
</dd>


<dt class="option-term" id="option-cargo-tree---frozen"><a class="option-anchor" href="#option-cargo-tree---frozen"><code>--frozen</code></a></dt>
<dd class="option-desc"><p>相当于同时指定 <code>--locked</code> 和 <code>--offline</code>。</p>
</dd>


</dl>

### 功能选择

功能标志允许你控制哪些功能被启用。当没有指定功能选项时，每个选中的包都会激活 `default` 功能。

有关更多细节，请参阅 [功能文档](../reference/features.html#command-line-特性-options)。

<dl>

<dt class="option-term" id="option-cargo-tree--F"><a class="option-anchor" href="#option-cargo-tree--F"><code>-F</code> <em>features</em></a></dt>
<dt class="option-term" id="option-cargo-tree---features"><a class="option-anchor" href="#option-cargo-tree---features"><code>--features</code> <em>features</em></a></dt>
<dd class="option-desc"><p>用于激活功能的空格或逗号分隔列表。工作区成员的功能可以通过 <code>package-name/feature-name</code> 语法启用。该标志可以多次指定，从而启用所有指定的功能。</p>
</dd>


<dt class="option-term" id="option-cargo-tree---all-features"><a class="option-anchor" href="#option-cargo-tree---all-features"><code>--all-features</code></a></dt>
<dd class="option-desc"><p>激活所有选定包的所有可用功能。</p>
</dd>


<dt class="option-term" id="option-cargo-tree---no-default-features"><a class="option-anchor" href="#option-cargo-tree---no-default-features"><code>--no-default-features</code></a></dt>
<dd class="option-desc"><p>不要激活所选包的 <code>default</code> 功能。</p>
</dd>


</dl>

### 显示选项

<dl>

<dt class="option-term" id="option-cargo-tree--v"><a class="option-anchor" href="#option-cargo-tree--v"><code>-v</code></a></dt>
<dt class="option-term" id="option-cargo-tree---verbose"><a class="option-anchor" href="#option-cargo-tree---verbose"><code>--verbose</code></a></dt>
<dd class="option-desc"><p>使用详细输出。可以指定两次以获得“非常详细”的输出，该输出包含额外的内容，如依赖警告和构建脚本输出。也可以通过 <code>term.verbose</code> <a href="../reference/config.html">配置值</a>来指定。</p>
</dd>


<dt class="option-term" id="option-cargo-tree--q"><a class="option-anchor" href="#option-cargo-tree--q"><code>-q</code></a></dt>
<dt class="option-term" id="option-cargo-tree---quiet"><a class="option-anchor" href="#option-cargo-tree---quiet"><code>--quiet</code></a></dt>
<dd class="option-desc"><p>不要打印 cargo 日志消息。也可以通过 <code>term.quiet</code> <a href="../reference/config.html">配置值</a>来指定。</p>
</dd>


<dt class="option-term" id="option-cargo-tree---color"><a class="option-anchor" href="#option-cargo-tree---color"><code>--color</code> <em>when</em></a></dt>
<dd class="option-desc"><p>控制彩色输出的使用方式。有效值包括： <ul> <li><code>auto</code>（默认）：自动检测终端是否支持颜色显示。</li> <li><code>always</code>：始终显示颜色。</li> <li><code>never</code>：从不显示颜色。</li> </ul> 也可以通过 <code>term.color</code> <a href="../reference/config.html">配置值</a>来指定。</p>
</dd>


</dl>

### 常见选项

<dl>

<dt class="option-term" id="option-cargo-tree-+toolchain"><a class="option-anchor" href="#option-cargo-tree-+toolchain"><code>+</code><em>toolchain</em></a></dt>
<dd class="option-desc"><p>如果 Cargo 已通过 rustup 安装，且 <code>cargo</code> 的第一个参数以 <code>+</code> 开头，则会被解释为 rustup 工具链名称（如 <code>+stable</code> 或 <code>+nightly</code>）。 有关工具链覆盖机制更多信息，请参阅 <a href="https://rust-lang.github.io/rustup/overrides.html">rustup 文档</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-tree---config"><a class="option-anchor" href="#option-cargo-tree---config"><code>--config</code> <em>KEY=VALUE</em> or <em>PATH</em></a></dt>
<dd class="option-desc"><p>用于覆盖 Cargo 配置值。参数应为 TOML 格式 <code>KEY=VALUE</code>，或作为额外配置文件的路径提供。此标志可以多次指定。 有关更多信息，请参阅 <a href="../reference/config.html#command-line-overrides">命令行覆盖部分</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-tree--C"><a class="option-anchor" href="#option-cargo-tree--C"><code>-C</code> <em>PATH</em></a></dt>
<dd class="option-desc"><p>在执行任何指定操作之前，此选项会更改当前工作目录。这会影响诸如 cargo 默认查找项目清单 (<code>Cargo.toml</code>)的位置，以及用于发现 <code>.cargo/config.toml</code> 的搜索目录等设置。该选项必须出现在命令名称之前，例如 <code>cargo -C path/to/my-project build</code>。</p> <p>此选项仅适用于 <a href="https://doc.rust-lang.org/book/appendix-07-nightly-rust.html">nightly 版本</a>，并且需要使用 <code>-Z unstable-options</code> 标志来启用（参见 <a href="https://github.com/rust-lang/cargo/issues/10098">#10098</a>）。</p>
</dd>


<dt class="option-term" id="option-cargo-tree--h"><a class="option-anchor" href="#option-cargo-tree--h"><code>-h</code></a></dt>
<dt class="option-term" id="option-cargo-tree---help"><a class="option-anchor" href="#option-cargo-tree---help"><code>--help</code></a></dt>
<dd class="option-desc"><p>此选项会打印帮助信息。</p>
</dd>


<dt class="option-term" id="option-cargo-tree--Z"><a class="option-anchor" href="#option-cargo-tree--Z"><code>-Z</code> <em>flag</em></a></dt>
<dd class="option-desc"><p>这是 Cargo 的不稳定（仅 nightly 版本）标志。如需详细信息，请运行 <code>cargo -Z help</code>。</p>
</dd>


</dl>

## 环境

关于 Cargo 读取的环境变量详情，请参阅 [参考手册](../reference/environment-variables.html)。

## 退出状态

* `0`: Cargo 成功执行。
* `101`: Cargo 未能完成执行。

## 示例

1. 显示当前目录中该包的树形结构：

       cargo tree

2. 显示所有依赖 `syn` 包的包：

       cargo tree -i syn

3. 显示每个包启用的功能：

       cargo tree --format "{p} {f}"

4. 显示所有被多次构建的包。当树中出现多个不兼容的 semver 版本时（如 1.0.0 和 2.0.0），可能会出现这种情况。

       cargo tree -d

5. 解释为什么为 `syn` 包启用某些功能：

       cargo tree -e features -i syn

   `-e features` 标志用于显示功能。`-i` 标志用于反转图结构，从而显示依赖 `syn` 的包。其显示效果示例如下：

   ```
   syn v1.0.17
   ├── syn feature "clone-impls"
   │   └── syn feature "default"
   │       └── rustversion v1.0.2
   │           └── rustversion feature "default"
   │               └── myproject v0.1.0 (/myproject)
   │                   └── myproject feature "default" (command-line)
   ├── syn feature "default" (*)
   ├── syn feature "derive"
   │   └── syn feature "default" (*)
   ├── syn feature "full"
   │   └── rustversion v1.0.2 (*)
   ├── syn feature "parsing"
   │   └── syn feature "default" (*)
   ├── syn feature "printing"
   │   └── syn feature "default" (*)
   ├── syn feature "proc-macro"
   │   └── syn feature "default" (*)
   └── syn feature "quote"
       ├── syn feature "printing" (*)
       └── syn feature "proc-macro" (*)
   ```

   要阅读此图，可以沿着每个功能的链从根节点开始查看，了解为何包含该功能。例如，“full”功能由 `rustversion` crate 添加，该 crate 来自 `myproject`（带有默认功能），而 `myproject` 是命令行中选择的包。所有其他 `syn` 功能则由“default”功能添加（“quote”功能由“printing”和“proc-宏”添加，两者均为默认功能）。

   如果你在交叉引用去重后的 `(*)` 条目时遇到困难，可以使用 `--no-dedupe` 标志以获得完整输出。

## 另请参阅 [cargo(1)](cargo.html)、[cargo-metadata(1)](cargo-metadata.html)
