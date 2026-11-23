# cargo-metadata(1)

## 名称

cargo-metadata —— 关于当前包的可机读元数据

## 概述

`cargo metadata` [_选项_]

## 描述

将包含当前包的工作空间成员和解析后的依赖关系信息的 JSON 输出到标准输出中。

输出格式在 Cargo 的后续版本中可能会发生变化。建议使用 `--format-version` 标志来使代码具有前瞻性，确保输出符合预期格式。有关期望详情，请参阅 ["兼容性"](#compatibility)。

有关读取元数据的 Rust API，请参见 [cargo_metadata crate](https://crates.io/crates/cargo_metadata)。

## 输出格式

### 兼容性

在相同的输出格式版本内，兼容性得以保持，但某些情况除外。以下是非穷尽的变化列表，这些变化不被视为不兼容：

* **添加新字段** —— 在需要时添加新字段。保留此做法有助于 Cargo 发展而不频繁升级格式版本。
* **为类似枚举的字段添加新值** —— 与添加新字段相同。这样可使元数据持续更新，避免停滞。
* **改变不透明表示方式** —— 某些字段的内部表示方式是实现细节。例如，与“Source ID”相关的字段被视为不透明的标识符，以区分不同的包或来源。除非特别说明，消费者不应依赖这些表示方式。

### JSON 格式

JSON 输出具有以下格式：

```javascript
{
    /* Array of all packages in the workspace.
       It also includes all feature-enabled dependencies unless --no-deps is used.
    */
    "packages": [
        {
            /* The name of the package. */
            "name": "my-package",
            /* The version of the package. */
            "version": "0.1.0",
            /* The Package ID for referring to the
               package within the document and as the `--package` argument to many commands
            */
            "id": "file:///path/to/my-package#0.1.0",
            /* The license value from the manifest, or null. */
            "license": "MIT/Apache-2.0",
            /* The license-file value from the manifest, or null. */
            "license_file": "LICENSE",
            /* The description value from the manifest, or null. */
            "description": "Package description.",
            /* The source ID of the package, an "opaque" identifier representing
               where a package is retrieved from. See "Compatibility" above for
               the stability guarantee.

               This is null for path dependencies and workspace members.

               For other dependencies, it is a string with the format:
               - "registry+URL" for registry-based dependencies.
                 Example: "registry+https://github.com/rust-lang/crates.io-index"
               - "git+URL" for git-based dependencies.
                 Example: "git+https://github.com/rust-lang/cargo?rev=5e85ba14aaa20f8133863373404cb0af69eeef2c#5e85ba14aaa20f8133863373404cb0af69eeef2c"
               - "sparse+URL" for dependencies from a sparse registry
                 Example: "sparse+https://my-sparse-registry.org"

               The value after the `+` is not explicitly defined, and may change
               between versions of Cargo and may not directly correlate to other
               things, such as registry definitions in a config file. New source
               kinds may be added in the future which will have different `+`
               prefixed identifiers.
            */
            "source": null,
            /* Array of dependencies declared in the package's manifest. */
            "dependencies": [
                {
                    /* The name of the dependency. */
                    "name": "bitflags",
                    /* The source ID of the dependency. May be null, see
                       description for the package source.
                    */
                    "source": "registry+https://github.com/rust-lang/crates.io-index",
                    /* The version requirement for the dependency.
                       Dependencies without a version requirement have a value of "*".
                    */
                    "req": "^1.0",
                    /* The dependency kind.
                       "dev", "build", or null for a normal dependency.
                    */
                    "kind": null,
                    /* If the dependency is renamed, this is the new name for
                       the dependency as a string.  null if it is not renamed.
                    */
                    "rename": null,
                    /* Boolean of whether or not this is an optional dependency. */
                    "optional": false,
                    /* Boolean of whether or not default features are enabled. */
                    "uses_default_features": true,
                    /* Array of features enabled. */
                    "features": [],
                    /* The target platform for the dependency.
                       null if not a target dependency.
                    */
                    "target": "cfg(windows)",
                    /* The file system path for a local path dependency.
                       not present if not a path dependency.
                    */
                    "path": "/path/to/dep",
                    /* A string of the URL of the registry this dependency is from.
                       If not specified or null, the dependency is from the default
                       registry (crates.io).
                    */
                    "registry": null,
                    /* (unstable) Boolean flag of whether or not this is a pulbic
                       dependency. This field is only present when
                       `-Zpublic-dependency` is enabled.
                    */
                    "public": false
                }
            ],
            /* Array of Cargo targets. */
            "targets": [
                {
                    /* Array of target kinds.
                       - lib targets list the `crate-type` values from the
                         manifest such as "lib", "rlib", "dylib",
                         "proc-macro", etc. (default ["lib"])
                       - binary is ["bin"]
                       - example is ["example"]
                       - integration test is ["test"]
                       - benchmark is ["bench"]
                       - build script is ["custom-build"]
                    */
                    "kind": [
                        "bin"
                    ],
                    /* Array of crate types.
                       - lib and example libraries list the `crate-type` values
                         from the manifest such as "lib", "rlib", "dylib",
                         "proc-macro", etc. (default ["lib"])
                       - all other target kinds are ["bin"]
                    */
                    "crate_types": [
                        "bin"
                    ],
                    /* The name of the target.
                       For lib targets, dashes will be replaced with underscores.
                    */
                    "name": "my-package",
                    /* Absolute path to the root source file of the target. */
                    "src_path": "/path/to/my-package/src/main.rs",
                    /* The Rust edition of the target.
                       Defaults to the package edition.
                    */
                    "edition": "2018",
                    /* Array of required features.
                       This property is not included if no required features are set.
                    */
                    "required-features": ["feat1"],
                    /* Whether the target should be documented by `cargo doc`. */
                    "doc": true,
                    /* Whether or not this target has doc tests enabled, and
                       the target is compatible with doc testing.
                    */
                    "doctest": false,
                    /* Whether or not this target should be built and run with `--test`
                    */
                    "test": true
                }
            ],
            /* Set of features defined for the package.
               Each feature maps to an array of features or dependencies it
               enables.
            */
            "features": {
                "default": [
                    "feat1"
                ],
                "feat1": [],
                "feat2": []
            },
            /* Absolute path to this package's manifest. */
            "manifest_path": "/path/to/my-package/Cargo.toml",
            /* Package metadata.
               This is null if no metadata is specified.
            */
            "metadata": {
                "docs": {
                    "rs": {
                        "all-features": true
                    }
                }
            },
            /* List of registries to which this package may be published.
               Publishing is unrestricted if null, and forbidden if an empty array. */
            "publish": [
                "crates-io"
            ],
            /* Array of authors from the manifest.
               Empty array if no authors specified.
            */
            "authors": [
                "Jane Doe <user@example.com>"
            ],
            /* Array of categories from the manifest. */
            "categories": [
                "command-line-utilities"
            ],
            /* Optional string that is the default binary picked by cargo run. */
            "default_run": null,
            /* Optional string that is the minimum supported rust version */
            "rust_version": "1.56",
            /* Array of keywords from the manifest. */
            "keywords": [
                "cli"
            ],
            /* The readme value from the manifest or null if not specified. */
            "readme": "README.md",
            /* The repository value from the manifest or null if not specified. */
            "repository": "https://github.com/rust-lang/cargo",
            /* The homepage value from the manifest or null if not specified. */
            "homepage": "https://rust-lang.org",
            /* The documentation value from the manifest or null if not specified. */
            "documentation": "https://doc.rust-lang.org/stable/std",
            /* The default edition of the package.
               Note that individual targets may have different editions.
            */
            "edition": "2018",
            /* Optional string that is the name of a native library the package
               is linking to.
            */
            "links": null,
        }
    ],
    /* Array of members of the workspace.
       Each entry is the Package ID for the package.
    */
    "workspace_members": [
        "file:///path/to/my-package#0.1.0",
    ],
    /* Array of default members of the workspace.
       Each entry is the Package ID for the package.
    */
    "workspace_default_members": [
        "file:///path/to/my-package#0.1.0",
    ],
    // The resolved dependency graph for the entire workspace. The enabled
    // features are based on the enabled features for the "current" package.
    // Inactivated optional dependencies are not listed.
    //
    // This is null if --no-deps is specified.
    //
    // By default, this includes all dependencies for all target platforms.
    // The `--filter-platform` flag may be used to narrow to a specific
    // target tuple.
    "resolve": {
        /* Array of nodes within the dependency graph.
           Each node is a package.
        */
        "nodes": [
            {
                /* The Package ID of this node. */
                "id": "file:///path/to/my-package#0.1.0",
                /* The dependencies of this package, an array of Package IDs. */
                "dependencies": [
                    "https://github.com/rust-lang/crates.io-index#bitflags@1.0.4"
                ],
                /* The dependencies of this package. This is an alternative to
                   "dependencies" which contains additional information. In
                   particular, this handles renamed dependencies.
                */
                "deps": [
                    {
                        /* The name of the dependency's library target.
                           If this is a renamed dependency, this is the new
                           name.
                        */
                        "name": "bitflags",
                        /* The Package ID of the dependency. */
                        "pkg": "https://github.com/rust-lang/crates.io-index#bitflags@1.0.4"
                        /* Array of dependency kinds. Added in Cargo 1.40. */
                        "dep_kinds": [
                            {
                                /* The dependency kind.
                                   "dev", "build", or null for a normal dependency.
                                */
                                "kind": null,
                                /* The target platform for the dependency.
                                   null if not a target dependency.
                                */
                                "target": "cfg(windows)"
                            }
                        ]
                    }
                ],
                /* Array of features enabled on this package. */
                "features": [
                    "default"
                ]
            }
        ],
        /* The package in the current working directory (if --manifest-path is not given).
           This is null if there is a virtual workspace. Otherwise it is
           the Package ID of the package.
        */
        "root": "file:///path/to/my-package#0.1.0",
    },
    /* The absolute path to the target directory where Cargo places its output. */
    "target_directory": "/path/to/my-package/target",
    /* The absolute path to the build directory where Cargo places intermediate build artifacts. (unstable) */
    "build_directory": "/path/to/my-package/build-dir",
    /* The version of the schema for this metadata structure.
       This will be changed if incompatible changes are ever made.
    */
    "version": 1,
    /* The absolute path to the root of the workspace. */
    "workspace_root": "/path/to/my-package"
    /* Workspace metadata.
       This is null if no metadata is specified. */
    "metadata": {
        "docs": {
            "rs": {
                "all-features": true
            }
        }
    }
}
````

Notes:
- 关于 `"id"` 字段语法，请参阅参考文档中的 [包 ID Specifications]。

## 选项

### 输出选项

<dl>

<dt class="option-term" id="option-cargo-metadata---no-deps"><a class="option-anchor" href="#option-cargo-metadata---no-deps"><code>--no-deps</code></a></dt>
<dd class="option-desc"><p>仅输出工作空间成员的信息，不获取依赖项。</p>
</dd>


<dt class="option-term" id="option-cargo-metadata---format-version"><a class="option-anchor" href="#option-cargo-metadata---format-version"><code>--format-version</code> <em>version</em></a></dt>
<dd class="option-desc"><p>指定要使用的输出格式版本。目前 <code>1</code> 是唯一可能的数值。</p>
</dd>


<dt class="option-term" id="option-cargo-metadata---filter-platform"><a class="option-anchor" href="#option-cargo-metadata---filter-platform"><code>--filter-platform</code> <em>tuple</em></a></dt>
<dd class="option-desc"><p>此选项过滤 <code>resolve</code> 的输出，仅包含给定<a href="../appendix/glossary.html#target">目标元组</a>的依赖项。可以使用字面量 <code>"host-tuple"</code>，其内部会被替换为宿主的目标。如果不使用此标志，则解析会包含所有目标。 请注意，“packages”数组中列出的依赖项仍包含所有依赖关系。每个包定义都旨在作为 <code>Cargo.toml</code> 内信息的未修改复制品。</p>
</dd>


</dl>

### 功能选择

功能标志允许你控制哪些功能被启用。当未指定任何功能选项时，每个选定的包都会激活 `default` 功能。

有关更多详情，请参阅 [功能文档](../reference/features.html#command-line-特性-options)。

<dl>

<dt class="option-term" id="option-cargo-metadata--F"><a class="option-anchor" href="#option-cargo-metadata--F"><code>-F</code> <em>features</em></a></dt>
<dt class="option-term" id="option-cargo-metadata---features"><a class="option-anchor" href="#option-cargo-metadata---features"><code>--features</code> <em>features</em></a></dt>
<dd class="option-desc"><p>激活功能的空格或逗号分隔列表。工作空间成员的功能可以通过 <code>package-name/feature-name</code> 语法启用。此标志可以多次指定，从而启用所有指定的功能。</p>
</dd>


<dt class="option-term" id="option-cargo-metadata---all-features"><a class="option-anchor" href="#option-cargo-metadata---all-features"><code>--all-features</code></a></dt>
<dd class="option-desc"><p>激活所有选定包可用的所有功能。</p>
</dd>


<dt class="option-term" id="option-cargo-metadata---no-default-features"><a class="option-anchor" href="#option-cargo-metadata---no-default-features"><code>--no-default-features</code></a></dt>
<dd class="option-desc"><p>不激活选定包的 <code>default</code> 功能。</p>
</dd>


</dl>

### 显示选项

<dl>
<dt class="option-term" id="option-cargo-metadata--v"><a class="option-anchor" href="#option-cargo-metadata--v"><code>-v</code></a></dt>
<dt class="option-term" id="option-cargo-metadata---verbose"><a class="option-anchor" href="#option-cargo-metadata---verbose"><code>--verbose</code></a></dt>
<dd class="option-desc"><p>使用详细输出。可以两次指定以得到“非常详细”的输出，其中包含额外的内容如依赖警告和构建脚本输出。也可以通过 <code>term.verbose</code> <a href="../reference/config.html">配置值</a>来指定。</p>
</dd>


<dt class="option-term" id="option-cargo-metadata--q"><a class="option-anchor" href="#option-cargo-metadata--q"><code>-q</code></a></dt>
<dt class="option-term" id="option-cargo-metadata---quiet"><a class="option-anchor" href="#option-cargo-metadata---quiet"><code>--quiet</code></a></dt>
<dd class="option-desc"><p>不打印 cargo 日志消息。 也可以通过 <code>term.quiet</code> <a href="../reference/config.html">配置值</a>来指定。</p>
</dd>


<dt class="option-term" id="option-cargo-metadata---color"><a class="option-anchor" href="#option-cargo-metadata---color"><code>--color</code> <em>when</em></a></dt>
<dd class="option-desc"><p>控制彩色输出的使用情况。有效值包括： <ul> <li><code>auto</code>（默认）：自动检测终端是否支持颜色显示。</li> <li><code>always</code>：始终显示颜色。</li> <li><code>never</code>：从不显示颜色。</li> </ul> <p>也可以通过 <code>term.color</code> <a href="../reference/config.html">配置值</a>来指定。</p></p></dd>

</dl>

### 清单选项

<dl>
<dt class="option-term" id="option-cargo-metadata---manifest-path"><a class="option-anchor" href="#option-cargo-metadata---manifest-path"><code>--manifest-path</code> <em>path</em></a></dt>
<dd class="option-desc"><p><code>Cargo.toml</code> 文件的路径。默认情况下，Cargo会在当前目录或任何父目录中查找 <code>Cargo.toml</code> 文件。</p>
</dd>


<dt class="option-term" id="option-cargo-metadata---locked"><a class="option-anchor" href="#option-cargo-metadata---locked"><code>--locked</code></a></dt>
<dd class="option-desc"><p>断言使用与原始生成 <code>Cargo.lock</code> 文件时相同的依赖项和版本。当出现以下任一情况时，Cargo 将以错误退出： <ul> <li>锁定文件缺失。</li> <li>由于不同的依赖解析导致 Cargo 尝试修改锁定文件。</li> </ul> 该选项可用于需要确定性构建的环境中，例如 CI 流水线。</p>
</dd>


<dt class="option-term" id="option-cargo-metadata---offline"><a class="option-anchor" href="#option-cargo-metadata---offline"><code>--offline</code></a></dt>
<dd class="option-desc"><p>防止 Cargo 出于任何原因访问网络。如果没有此标志，如果 Cargo 需要访问网络而网络不可用时，它将以错误退出。使用此标志后，Cargo 将尽可能在不连接网络的情况下继续运行。 请注意，这可能会导致与在线模式不同的依赖解析。即使本地索引副本中显示有更新版本，Cargo 也将限制自己仅使用本地下载的库。在离线操作前，请参考 <a href="cargo-fetch.html">cargo-fetch(1)</a> 命令来下载依赖项。 也可以通过 <code>net.offline</code> <a href="../reference/config.html">配置值</a>指定此选项。</p>
</dd>


<dt class="option-term" id="option-cargo-metadata---frozen"><a class="option-anchor" href="#option-cargo-metadata---frozen"><code>--frozen</code></a></dt>
<dd class="option-desc"><p>相当于同时指定 <code>--locked</code> 和 <code>--offline</code>。</p>
</dd>


</dl>

### 常见选项

<dl>

<dt class="option-term" id="option-cargo-metadata-+toolchain"><a class="option-anchor" href="#option-cargo-metadata-+toolchain"><code>+</code><em>toolchain</em></a></dt>
<dd class="option-desc"><p>如果 Cargo 是通过 rustup 安装的，且 <code>cargo</code> 的第一个参数以 <code>+</code> 开头，则会被解释为 rustup 工具链名称（如 <code>+stable</code> 或 <code>+nightly</code>）。 有关工具链覆盖机制更多信息，请参阅 <a href="https://rust-lang.github.io/rustup/overrides.html">rustup 文档</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-metadata---config"><a class="option-anchor" href="#option-cargo-metadata---config"><code>--config</code> <em>KEY=VALUE</em> or <em>PATH</em></a></dt>
<dd class="option-desc"><p>覆盖 Cargo 配置值。参数应为 TOML 语法 <code>KEY=VALUE</code>，或作为额外配置文件的路径提供。此标志可以多次指定。有关更多信息，请参阅 <a href="../reference/config.html#command-line-overrides">命令行覆盖部分</a>。</p>
</dd>


<dt class="option-term" id="option-cargo-metadata--C"><a class="option-anchor" href="#option-cargo-metadata--C"><code>-C</code> <em>PATH</em></a></dt>
<dd class="option-desc"><p>在执行任何指定操作之前，此选项会更改当前工作目录。这会影响诸如 cargo 默认查找项目清单 (<code>Cargo.toml</code>)的位置，以及用于发现 <code>.cargo/config.toml</code> 的搜索目录等设置。该选项必须位于命令名称之前，例如 <code>cargo -C path/to/my-project build</code>。</p> <p>此选项仅适用于 <a href="https://doc.rust-lang.org/book/appendix-07-nightly-rust.html">nightly 版本</a>，并且需要使用 <code>-Z unstable-options</code> 标志才能启用（参见 <a href="https://github.com/rust-lang/cargo/issues/10098">#10098</a>）。</p>
</dd>


<dt class="option-term" id="option-cargo-metadata--h"><a class="option-anchor" href="#option-cargo-metadata--h"><code>-h</code></a></dt>
<dt class="option-term" id="option-cargo-metadata---help"><a class="option-anchor" href="#option-cargo-metadata---help"><code>--help</code></a></dt>
<dd class="option-desc"><p>此选项会打印帮助信息。</p>
</dd>


<dt class="option-term" id="option-cargo-metadata--Z"><a class="option-anchor" href="#option-cargo-metadata--Z"><code>-Z</code> <em>flag</em></a></dt>
<dd class="option-desc"><p>这是 Cargo 的不稳定（仅 nightly 版本）标志。如需详细信息，请运行 <code>cargo -Z help</code>。</p>
</dd>


</dl>

## 环境

有关 Cargo 读取的环境变量详情，请参阅 [参考手册](../reference/environment-variables.html)。

## 退出状态

* `0`: Cargo 成功执行。
* `101`: Cargo 未能完成执行。

## 示例

1. 输出当前包的 JSON 数据：

       cargo metadata --format-version=1

## 另请参阅

[cargo(1)](cargo.html), [cargo-pkgid(1)](cargo-pkgid.html), [包 ID 规范], [JSON 消息]

[Package ID Specifications]: ../reference/pkgid-spec.html
[JSON messages]: ../reference/external-tools.html#json-messages
