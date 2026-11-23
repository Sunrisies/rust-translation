# 配置

本文档介绍了 Cargo 的配置系统如何工作以及可用的配置项。关于通过清单文件对包进行配置的说明，请参见 [清单格式](清单.md)。

## 层次结构

Cargo 支持针对特定包的本地配置和全局配置。它会在当前目录及其所有父目录中查找配置文件。例如，如果 Cargo 在 `/projects/foo/bar/baz` 下运行，那么将按以下顺序搜索并合并以下配置文件：

* `/projects/foo/bar/baz/.cargo/config.toml` * `/projects/foo/bar/.cargo/config.toml` * `/projects/foo/.cargo/config.toml` * `/projects/.cargo/config.toml` * `/.cargo/config.toml` * `$CARGO_HOME/config.toml`，默认值为：
* Windows: `%USERPROFILE%\.cargo\config.toml` * Unix: `$HOME/.cargo.config.toml`

通过这种结构，你可以按包指定配置，甚至可以将配置提交到版本控制中。你也可以在个人目录中的配置文件里设置个人默认设置。

如果某个配置项在多个文件中被指定，这些值将会合并在一起。数字、字符串和布尔值将遵循“深层配置目录中的值优先于祖先目录”的原则，其中个人目录的优先级最低。数组会将具有更高优先级的元素放在合并后的数组末尾。

目前，当从工作区中调用 Cargo 时，它不会读取工作区内 crate 的配置文件。也就是说，如果一个工作区包含两个 crate，分别名为 `/projects/foo/bar/baz/mylib` 和 `/projects/foo/bar/baz/mybin`，并且存在位于 `/projects/foo/bar/baz/mylib/.cargo/config.toml` 和 `/projects/foo/bar/baz/mybin/.cargo/config.toml` 的 Cargo 配置文件，那么从工作区根目录 (`/projects/foo/bar/baz/`) 调用时，Cargo 不会读取这些配置文件。

> [!NOTE]
> Cargo 还可以读取没有 `.toml` 扩展名的配置文件，例如 `.cargo/config`。`.toml` 扩展名支持在版本 1.39 中引入，且是推荐的形式。如果同时存在这两个文件，Cargo 将使用没有扩展名的文件。

## 配置格式

配置文件采用 [TOML 格式][toml]（类似于清单文件），在部分内包含简单的键值对（表格）。以下是所有设置的简要概述，详细描述见下方。

```toml
paths = ["/path/to/override"] # path dependency overrides

[alias]     # command aliases
b = "build"
c = "check"
t = "test"
r = "run"
rr = "run --release"
recursive_example = "rr --example recursions"
space_example = ["run", "--release", "--", "\"command list\""]

[build]
warnings = "warn"             # adjust the effective lint level for warnings
jobs = 1                      # number of parallel jobs, defaults to # of CPUs
rustc = "rustc"               # the rust compiler tool
rustc-wrapper = "…"           # run this wrapper instead of `rustc`
rustc-workspace-wrapper = "…" # run this wrapper instead of `rustc` for workspace members
rustdoc = "rustdoc"           # the doc generator tool
target = "tuple"              # build for the target tuple (ignored by `cargo install`)
profile = "dev"               # build using the specified profile (ignored by `cargo install`)
target-dir = "target"         # path of where to place generated artifacts
build-dir = "target"          # path of where to place intermediate build artifacts
rustflags = ["…", "…"]        # custom flags to pass to all compiler invocations
rustdocflags = ["…", "…"]     # custom flags to pass to rustdoc
incremental = true            # whether or not to enable incremental compilation
dep-info-basedir = "…"        # path for the base directory for targets in depfiles

[credential-alias]
# Provides a way to define aliases for credential providers.
my-alias = ["/usr/bin/cargo-credential-example", "--argument", "value", "--flag"]

[doc]
browser = "chromium"          # browser to use with `cargo doc --open`,
                              # overrides the `BROWSER` environment variable

[env]
# Set ENV_VAR_NAME=value for any process run by Cargo
ENV_VAR_NAME = "value"
# Set even if already present in environment
ENV_VAR_NAME_2 = { value = "value", force = true }
# `value` is relative to the parent of `.cargo/config.toml`, env var will be the full absolute path
ENV_VAR_NAME_3 = { value = "relative/path", relative = true }

[future-incompat-report]
frequency = 'always' # when to display a notification about a future incompat report

[cache]
auto-clean-frequency = "1 day"   # How often to perform automatic cache cleaning

[cargo-new]
vcs = "none"              # VCS to use ('git', 'hg', 'pijul', 'fossil', 'none')

[http]
debug = false               # HTTP debugging
proxy = "host:port"         # HTTP proxy in libcurl format
ssl-version = "tlsv1.3"     # TLS version to use
ssl-version.max = "tlsv1.3" # maximum TLS version
ssl-version.min = "tlsv1.1" # minimum TLS version
timeout = 30                # timeout for each HTTP request, in seconds
low-speed-limit = 10        # network timeout threshold (bytes/sec)
cainfo = "cert.pem"         # path to Certificate Authority (CA) bundle
proxy-cainfo = "cert.pem"   # path to proxy Certificate Authority (CA) bundle
check-revoke = true         # check for SSL certificate revocation
multiplexing = true         # HTTP/2 multiplexing
user-agent = "…"            # the user-agent header

[install]
root = "/some/path"         # `cargo install` destination directory
profile = "release"         # build using the specified profile

[net]
retry = 3                   # network retries
git-fetch-with-cli = true   # use the `git` executable for git operations
offline = true              # do not access the network

[net.ssh]
known-hosts = ["..."]       # known SSH host keys

[patch.<registry>]
# Same keys as for [patch] in Cargo.toml

[profile.<name>]         # Modify profile settings via config.
inherits = "dev"         # Inherits settings from [profile.dev].
opt-level = 0            # Optimization level.
debug = true             # Include debug info.
split-debuginfo = '...'  # Debug info splitting behavior.
strip = "none"           # Removes symbols or debuginfo.
debug-assertions = true  # Enables debug assertions.
overflow-checks = true   # Enables runtime integer overflow checks.
lto = false              # Sets link-time optimization.
panic = 'unwind'         # The panic strategy.
incremental = true       # Incremental compilation.
codegen-units = 16       # Number of code generation units.
rpath = false            # Sets the rpath linking option.
trim-paths = "none"      # Sanitizes paths in build outputs.
[profile.<name>.build-override]  # Overrides build-script settings.
# Same keys for a normal profile.
[profile.<name>.package.<name>]  # Override profile for a package.
# Same keys for a normal profile (minus `panic`, `lto`, and `rpath`).

[resolver]
lockfile-path = "…"  # Overrides the path used for
incompatible-rust-versions = "allow"  # Specifies how resolver reacts to these
incompatible-publish-age = "deny"  # Specifies how resolver treats recently published versions

[registries.<name>]  # registries other than crates.io
index = "…"          # URL of the registry index
token = "…"          # authentication token for the registry
credential-provider = "cargo:token" # The credential provider for this registry.
min-publish-age = "7 days" # Override `registry.global-min-publish-age` for this registry

[registries.crates-io]
protocol = "sparse"  # The protocol to use to access crates.io.

[registry]
default = "…"        # name of the default registry
token = "…"          # authentication token for crates.io
credential-provider = "cargo:token"           # The credential provider for crates.io.
global-credential-providers = ["cargo:token"] # The credential providers to use by default.
global-min-publish-age = "7 days" # The time span allowed for registry packages to use by default.

[source.<name>]      # source definition and replacement
replace-with = "…"   # replace this source with the given named source
directory = "…"      # path to a directory source
registry = "…"       # URL to a registry source
local-registry = "…" # path to a local registry source
git = "…"            # URL of a git repository source
branch = "…"         # branch name for the git repository
tag = "…"            # tag name for the git repository
rev = "…"            # revision for the git repository

[target.<tuple>]
linker = "…"              # linker to use
runner = "…"              # wrapper to run executables
rustflags = ["…", "…"]    # custom flags for `rustc`
rustdocflags = ["…", "…"] # custom flags for `rustdoc`

[target.<cfg>]
linker = "…"            # linker to use
runner = "…"            # wrapper to run executables
rustflags = ["…", "…"]  # custom flags for `rustc`

[target.<tuple>.<links>] # `links` build script override
rustc-link-lib = ["foo"]
rustc-link-search = ["/path/to/foo"]
rustc-flags = "-L /some/path"
rustc-cfg = ['key="value"']
rustc-env = {key = "value"}
rustc-cdylib-link-arg = ["…"]
metadata_key1 = "value"
metadata_key2 = "value"

[term]
quiet = false                    # whether cargo output is quiet
verbose = false                  # whether cargo provides verbose output
color = 'auto'                   # whether cargo colorizes output
hyperlinks = true                # whether cargo inserts links into output
unicode = true                   # whether cargo can render output using non-ASCII unicode characters
progress.when = 'auto'           # whether cargo shows progress bar
progress.width = 80              # width of progress bar
progress.term-integration = true # whether cargo reports progress to terminal emulator
```

## 环境变量

除了 TOML 配置文件外，Cargo 还可以通过环境变量进行配置。对于形式为 `foo.bar` 的每个配置键，可以使用环境变量 `CARGO_FOO_BAR` 来定义其值。键会被转换为大写字母，点号和破折号会被转换为下划线。例如，`target.x86_64-unknown-linux-gnu.runner` 键也可以通过环境变量 `CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_RUNNER` 来定义。

环境变量优先于 TOML 配置文件。目前仅支持通过环境变量定义的整数、布尔值、字符串和某些数组值。[下方](#configuration-keys)中的描述指出了哪些键支持使用环境变量，而由于[技术问题](https://github.com/rust-lang/cargo/issues/5416)，其他键则不支持使用环境变量。

除了上述系统外，Cargo 还识别一些特定的[环境变量][env]。

## 命令行覆盖

Cargo 还通过 `--config` 命令行选项接受任意配置覆盖。参数应为 `KEY=VALUE` 形式的 TOML 语法，或作为额外配置文件的路径提供。

```console
# With `KEY=VALUE` in TOML syntax
cargo --config net.git-fetch-with-cli=true fetch

# With a path to a configuration file
cargo --config ./path/to/my/extra-config.toml fetch
```

可以多次指定 `--config` 选项，此时值将按从左到右的顺序合并，使用与多个配置文件生效时相同的合并逻辑。以这种方式指定的配置值优先于环境变量，而环境变量又优先于配置文件。

当提供 `--config` 选项作为额外的配置文件时，以这种方式加载的配置文件遵循与直接指定 `--config` 的其他选项相同的优先级规则。

以下是使用 Bourne shell 语法的一些示例：

```console
# Most shells will require escaping.
cargo --config http.proxy=\"http://example.com\" …

# Spaces may be used.
cargo --config "net.git-fetch-with-cli = true" …

# TOML array example. Single quotes make it easier to read and write.
cargo --config 'build.rustdocflags = ["--html-in-header", "header.html"]' …

# Example of a complex TOML key.
cargo --config "target.'cfg(all(target_arch = \"arm\", target_os = \"none\"))'.runner = 'my-runner'" …

# Example of overriding a profile setting.
cargo --config profile.dev.package.image.opt-level=3 …
```

## 包含额外的配置文件

可以通过顶层 `include` 键来包含其他配置文件。这允许在多个项目之间共享配置，或将复杂的配置拆分为多个文件。

### `include`

* 类型：字符串数组或表格 * 默认值：无 * 环境：不支持

加载额外的配置文件。路径相对于包含这些文件的配置文件而言。仅接受以 `.toml` 结尾的路径。

支持以下格式：

```toml
# array of paths
include = [
    "frodo.toml",
    "samwise.toml",
]

# inline tables for more control
include = [
    { path = "required.toml" },
    { path = "optional.toml", optional = true },
]
```

> [!NOTE]
> 为了更好的可读性并避免混淆，建议： - 将 `include` 放在配置文件的顶部 - 每行一个 include，以便更清晰地进行版本控制差异比较 - 当需要可选包含时，使用内联表格语法

使用表格语法时，支持以下字段：

* `path`（字符串，必填）：要包含的配置文件路径。
* `optional`（布尔值，默认：false）：如果为 `true`，缺失的文件将被静默跳过，而不是引发错误。

`include` 的合并行为与其他配置值不同：

1. 首先从 `include` 路径加载配置值。
* 包含的文件按从左到右的顺序加载，后文件的数值优先于前文件。
* 如果包含的配置文件也包含 `include` 键，则递归执行此步骤。
2. 然后，配置文件自身的数值会叠加在已包含的配置上，具有最高优先级。

## 配置相对路径

配置文件中的路径可以是绝对路径、相对路径或没有路径分隔符的纯名称。没有路径分隔符的可执行文件路径将使用 `PATH` 环境变量来查找可执行文件。非可执行文件的路径则相对于配置值定义的位置而言。

具体规则如下：

* 对于环境变量，路径相对于当前工作目录。
* 对于直接从 [`--config KEY=VALUE`](#command-line-overrides) 选项加载的配置值，路径也相对于当前工作目录。
* 对于配置文件，路径相对于定义配置文件的父目录，无论这些文件来自[层次结构探测](#hierarchical-structure)还是 [`--config <path>`](#command-line-overrides) 选项。

> [!IMPORTANT]
> 为了与现有的 `.cargo/config.toml` 探测行为保持一致，通过 `--config <path>` 传递的配置文件中的路径按设计而言也相对于配置文件本身向上两层。
>
> 为了避免意外结果，一个经验法则是将额外的配置文件放在项目中的 `*.cargo/config.toml` 文件同一层级处。例如，对于一个项目 `/my/project`，建议将配置文件放在 `/my/project/.cargo` 或同一层级的新的目录中，如 `/my/project/.config`。

```toml
# Relative path examples.

[target.x86_64-unknown-linux-gnu]
runner = "foo"  # Searches `PATH` for `foo`.

[source.vendored-sources]
# Directory is relative to the parent where `.cargo/config.toml` is located.
# For example, `/my/project/.cargo/config.toml` would result in `/my/project/vendor`.
directory = "vendor"
```

## 带参数的可执行程序路径

某些 Cargo 命令会调用外部程序，这些程序可以作为路径和若干参数进行配置。

该值可以是字符串数组，例如 `['/path/to/program', 'somearg']`，也可以是空格分隔的字符串，例如 `'/path/to/program somearg'`。如果可执行程序的路径包含空格，则必须使用列表形式。

如果 Cargo 向程序传递其他参数，如打开或运行的路径，这些参数将在此格式的选项值中位于最后一个指定参数之后。如果指定的程序没有路径分隔符，Cargo 将在 `PATH` 中搜索其可执行文件。

## 凭证

包含敏感信息的配置值存储在 `$CARGO_HOME/credentials.toml` 文件中。当使用 [`cargo:token`] 凭证提供器时，该文件由 [`cargo login`] 和 [`cargo logout`] 自动创建和更新。

某些 Cargo 命令（如 [`cargo publish`））使用这些凭证与远程注册表进行身份验证。应注意保护凭证并保密它们。

其格式与 Cargo 配置文件相同。

```toml
[registry]
token = "…"   # Access token for crates.io

[registries.<name>]
token = "…"   # Access token for the named registry
```

与其他大多数配置值一样，令牌可以通过环境变量指定。[crates.io] 的令牌可通过 `CARGO_REGISTRY_TOKEN` 环境变量指定。其他注册表的令牌则可通过形式为 `CARGO_REGISTRIES_<name>_TOKEN` 的环境变量指定，其中 `<name>` 是注册表名称的大写形式。

> [!NOTE]
> Cargo 还可以读取和写入没有 `.toml` 扩展名的凭证文件，例如 `.cargo/credentials`。对 `.toml` 扩展名的支持是在版本 1.39 中添加的。在版本 1.68 中，默认情况下 Cargo 会将文件保存为该扩展名。然而，为了向后兼容，当两个文件都存在时，Cargo 会读取和写入没有扩展名的文件。

## 配置键

本节记录了所有配置键。具有变量部分的键的描述用方括号标注，如 `target.<tuple>`，其中 `<tuple>` 可以是任何 [目标元组]，例如 `target.x86_64-pc-windows-msvc`。

### `paths` * 类型：字符串数组（路径） * 默认值：无 * 环境：不支持

这是一个本地包的路径数组，用于覆盖依赖项。有关更多信息，请参阅 [覆盖依赖项指南](overriding-dependencies.md#paths-overrides)。

### `[alias]` * 类型：字符串或字符串数组 * 默认值：见下文 * 环境：`CARGO_ALIAS_<name>`

`[alias]` 表定义了 CLI 命令别名。例如，运行 `cargo b` 是运行 `cargo build` 的别名。表中的每个键都是子命令，其值为实际要运行的命令。该值可以是字符串数组，其中第一个元素是命令，后续是参数。它也可以是一个字符串，该字符串会在空格处被分割为子命令和参数。以下别名是 Cargo 内置的：

```toml
[alias]
b = "build"
c = "check"
d = "doc"
t = "test"
r = "run"
rm = "remove"
```

别名不得重新定义现有的内置命令。

别名是递归的：

```toml
[alias]
rr = "run --release"
recursive_example = "rr --example recursions"
```

### `[build]`

`[build]` 表控制构建时操作和编译器设置。

#### `build.warnings` * 类型：字符串 * 默认值：`"warn"` * 环境变量：`CARGO_BUILD_WARNINGS`

调整本地包的lint警告生效级别。允许的级别有：* `"warn"`：继续将lint信息作为警告显示（默认）。* `"allow"`：隐藏这些lint信息。* `"deny"`：对于包含lint警告的crate发出错误提示。使用 `--keep-going`可以查看所有依赖crate的lint警告。

只有属于lint信息的警告才会受到影响，即那些级别可调整的警告；未作为lint信息处理的警告或来自依赖项的警告则仍会通过 `--verbose --verbose`显示出来。

> **MSRV：** 在1.97版本中已遵守。

#### `build.jobs` * 类型：整数或字符串 * 默认值：逻辑CPU数量 * 环境变量：`CARGO_BUILD_JOBS`

设置并行运行的编译器进程的最大数量。如果为负数，则将其设置为逻辑CPU数量加上提供的数值。不应为0。如果提供字符串`default`，则恢复为默认值。

可以通过 `--jobs` CLI选项覆盖此值。

#### `build.rustc` * 类型：字符串（程序路径） * 默认值：`"rustc"` * 环境变量：`CARGO_BUILD_RUSTC`或`RUSTC`

设置用于`rustc`的可执行文件。

#### `build.rustc-wrapper` * 类型：字符串（程序路径） * 默认值为空 * 环境变量：`CARGO_BUILD_RUSTC_WRAPPER`或`RUSTC_WRAPPER`

设置一个替代`rustc`执行的包装器。传递给包装器的第一个参数是指向实际可执行文件的路径（即，如果设置了`build.rustc`，则使用该路径；否则使用`"rustc"`）。

#### `build.rustc-workspace-wrapper` * 类型：字符串（程序路径） * 默认值为空 * 环境变量：`CARGO_BUILD_RUSTC_WORKSPACE_WRAPPER`或`RUSTC WORKSPACE_WRAPPER`

为仅适用于工作空间成员设置一个包装器，以替代 `rustc` 执行。当构建非工作空间的单包项目时，该包被视为工作空间。传递给包装器的第一个参数是指向实际可执行文件的路径（即如果设置了 `build.rustc`，则为该路径，否则为 `"rustc"`）。它会影响文件哈希值，以便由包装器生成的产物可以单独缓存。

如果同时设置了 `rustc-wrapper` 和 `rustc-workspace-wrapper`，则它们会嵌套在一起：最终调用顺序为 `$RUSTC_WRAPPER $RUSTC_WORKSPACE_WRAPPER $RUSTC`。

#### `build.rustdoc` * 类型：字符串（程序路径） * 默认值：`"rustdoc"` * 环境变量：`CARGO_BUILD_RUSTDOC` 或 `RUSTDOC`

设置用于 `rustdoc` 的可执行文件。

#### `build.target` * 类型：字符串或字符串数组 * 默认：主机平台 * 环境变量：`CARGO_BUILD_TARGET`

编译时使用的默认 [目标平台元组][目标 tuple]。

可能的值：- `rustc --print target-list` 中支持的任何目标。- `"host-tuple"`，内部会被宿主平台的目标替代。如果正在交叉编译某些库且不想指定宿主机器作为目标（例如，在可能被多个主机共同使用的共享项目中使用 `xtask`），则此选项特别有用。- 指向自定义目标规范的路径。有关更多信息，请参阅 [自定义目标查找路径](../../rustc/targets/custom.html#custom-目标-lookup-path)。

可以通过 `--target` CLI 选项覆盖。

```toml
[build]
target = ["x86_64-unknown-linux-gnu", "i686-unknown-linux-gnu"]
```

#### `build.profile` * 类型：字符串 * 默认值：`"test"`（当执行 `cargo test` 时）否则为 `"dev"` * 环境变量：`CARGO_BUILD_PROFILE`

编译时使用的默认 [profile]。

可以通过 `--release` 或 `--profile` CLI 选项覆盖。

```toml
[build]
profile = "debug"
```

> **MSRV：** 在 1.100 版本中受到尊重。

#### `build.target-dir` * 类型：字符串（路径） * 默认值：`"target"` * 环境变量：`CARGO_BUILD_TARGET_DIR` 或 `CARGO_TARGET_DIR`

所有编译器输出存放的路径。如果未指定，则默认为位于工作空间根目录下的名为 `target` 的目录。

可以通过 `--target-dir` CLI 选项覆盖。

如需更多信息，请参阅 [构建缓存文档](../reference/build-cache.md)。

#### `build.build-dir`

* 类型：字符串（路径） * 默认值：默认为 `build.target-dir` 的值 * 环境变量：`CARGO_BUILD_BUILD_DIR`

中间构建工件将存储的目录。这些中间工件由 Rustc/Cargo 在构建过程中生成。

此选项支持路径模板化。

可用的模板变量： * `{workspace-root}` 解析为当前工作空间的根目录。 * `{cargo-cache-home}` 解析为 `CARGO_HOME` * `{workspace-path-hash}` 解析为清单路径的哈希值

如需更多信息，请参阅 [构建缓存文档](../reference/build-cache.md)。

#### `build.rustflags` * 类型：字符串或字符串数组 * 默认值：无 * 环境变量：`CARGO_BUILD_RUSTFLAGS` 或 `CARGO_ENCODED_RUSTFLAGS` 或 `RUSTFLAGS`

传递给 `rustc` 的额外命令行标志。该值可以是字符串数组或空格分隔的字符串。

有四种互斥的额外标志来源，按此顺序检查，首先使用第一个：

1. `CARGO_ENCODED_RUSTFLAGS` 环境变量。
2. `RUSTFLAGS` 环境变量。
3. 所有匹配的 `target.<tuple>.rustflags` 和 `target.<cfg>.rustflags` 配置项合并在一起。
4. `build.rustflags` 配置值。

额外的标志也可以通过 [`cargo rustc`] 命令传递。

如果使用了 `--target` 标志（或 [`build.target`](#buildtarget)），则这些标志仅传递给目标代码编译器。对于主机端构建的内容，如构建脚本或过程宏，将不会接收这些参数。没有 `--target` 时，由于依赖项共享，所有编译器调用都将传递这些标志。如果您有不想传递给构建脚本或过程宏的参数，并且是为主机端构建，请使用 `[host tuple][target tuple]` 并添加 `--target`。

不建议传递 Cargo 本身通常管理的标志。例如，由 [配置文件](profiles.md) 驱动的标志最好通过设置相应的配置文件来处理。

> [!CAUTION]
> 由于直接向编译器传递标志的底层特性，这可能会与未来的 Cargo 版本产生冲突，因为未来版本的 Cargo 可能会自行发出相同或类似的标志，从而干扰您指定的标志。这是 Cargo 可能不总是向后兼容的领域。

#### `build.rustdocflags` * 类型：字符串或字符串数组 * 默认值：无 * 环境变量：`CARGO_BUILD_RUSTDOCFLAGS` 或 `CARGO_ENCODED_RUSTDOCFLAGS` 或 `RUSTDOCFLAGS`

传递给 `rustdoc` 的额外命令行标志。该值可以是字符串数组或空格分隔的字符串。

有四种互斥的额外标志来源。按顺序检查，首先使用第一个：

1. `CARGO_ENCODED_RUSTDOCFLAGS` 环境变量。
2. `RUSTDOCFLAGS` 环境变量。
3. 所有匹配的 `target.<tuple>.rustdocflags` 和 `target.<cfg>.rustdocflags` 配置项合并在一起。
4. `build.rustdocflags` 配置值。

额外的标志也可以通过 [`cargo rustdoc`] 命令传递。

> [!CAUTION]
> 由于直接向编译器传递标志的底层特性，这可能会与未来的 Cargo 版本产生冲突，因为未来版本的 Cargo 可能会自行发出相同或类似的标志，从而干扰您指定的标志。这是 Cargo 可能不总是向后兼容的领域。

#### `build.incremental` * 类型：布尔值 * 默认值：从配置文件获取 * 环境变量：`CARGO_BUILD_INCREMENTAL` 或 `CARGO_INCREMENTAL`

是否执行 [增量编译]。

在设置了 `CI` 的环境中，如果未设置则默认值为 `CARGO_BUILD_INCREMENTAL=false`。否则，默认值是使用 [配置文件](profiles.md#incremental) 中的值。

`CARGO_INCREMENTAL` 环境变量可以设置为 `1` 以强制启用所有配置文件的增量编译，或设置为 `0` 以禁用它。此环境变量会覆盖配置设置。

#### `build.dep-info-basedir` * 类型：字符串（路径） * 默认：无 * 环境变量：`CARGO_BUILD_DEP_INFO_BASEDIR`

从 [依赖信息](../reference/build-cache.md#dep-info-files) 文件路径中移除给定的路径前缀。此配置选项旨在将绝对路径转换为相对路径，适用于需要相对路径的工具。

该设置本身即为配置相对路径。例如，`"."` 值会移除所有以 `.cargo` 目录父目录开头的路径。

#### `build.pipelining`

此选项已弃用且未使用。Cargo 始终启用管道功能。

### `[credential-alias]` * 类型：字符串或字符串数组 * 默认：空 * 环境变量：`CARGO_CREDENTIAL_ALIAS_<name>`

`[credential-alias]` 表定义了凭证提供器别名。这些别名可以作为 `registry.global-credential-providers` 数组的元素被引用，或者作为 `registries.<NAME>.credential-provider` 下特定注册表的凭证提供器被使用。

如果指定为字符串，则值会在空格处被分割为路径和参数。

例如，要定义名为 `my-alias` 的别名：

```toml
[credential-alias]
my-alias = ["/usr/bin/cargo-credential-example", "--argument", "value", "--flag"]
```
有关更多信息，请参阅 [注册表认证](registry-authentication.md)。

### `[doc]`

`[doc]` 表定义了 [`cargo doc`] 命令的选项。

#### `doc.browser`

* 类型：字符串或字符串数组（带参数的程序路径） * 默认：`BROWSER` 环境变量，如果缺失则以系统特定的方式打开链接

此选项设置由 [`cargo doc`] 使用的浏览器，当使用 `--open` 选项打开文档时，会覆盖 `BROWSER` 环境变量。

### `[cargo-new]`

`[cargo-new]` 表定义了 [`cargo new`] 命令的默认设置。

#### `cargo-new.name`

此选项已弃用且未使用。

#### `cargo-new.email`

此选项已弃用且未使用。

#### `cargo-new.vcs` * 类型：字符串 * 默认：`"git"` 或 `"none"` * 环境变量：`CARGO_CARGO_NEW_VCS`

指定用于初始化新仓库的源代码控制系统。有效值为 `git`、`hg`（针对 Mercurial）、`pijul`、`fossil` 或 `none` 以禁用此行为。默认值为 `git`，如果已处于版本控制仓库中则默认为 `none`。可以通过 `--vcs` CLI 选项覆盖该设置。

### `[env]`

`[env]` 部分允许您为构建脚本、rustc 调用、`cargo run` 和 `cargo build` 设置额外的环境变量。

```toml
[env]
OPENSSL_DIR = "/opt/openssl"
```

默认情况下，指定的变量不会覆盖环境中已存在的数值。可以通过设置 `force` 标志来更改此行为。

设置 `relative` 标志时，该值将作为相对于包含 `config.toml` 文件的 `.cargo` 目录父目录的配置文件相对路径进行解析。环境变量的实际值将是完整的绝对路径。

```toml
[env]
TMPDIR = { value = "/home/tmp", force = true }
OPENSSL_DIR = { value = "vendor/openssl", relative = true }
```

### `[future-incompat-report]`

`[future-incompat-report]` 表用于控制 [未来不兼容报告](future-incompat-report.md) 的设置。

#### `future-incompat-report.frequency` * 类型：字符串 * 默认：`"always"` * 环境变量：`CARGO_FUTURE_INCOMPAT_REPORT_FREQUENCY`

控制当存在未来不兼容报告时，在终端中显示通知的频率。可能的值包括：

* `always`（默认）：当命令（例如 `cargo build`）生成未来不兼容报告时始终显示通知 * `never`：从不显示通知

### `[cache]`

`[cache]` 表定义了 cargo 的缓存设置。

#### 全局缓存

运行 `cargo` 命令时，Cargo 会自动跟踪您在全局缓存中使用的文件。定期地，Cargo 会删除一段时间未使用的文件。如果某文件在 3 个月内未被使用，则将其从网络下载并存储。如果某个文件在 1 个月内未被使用，且无需网络访问即可生成该文件，则该文件将被删除。

文件自动删除仅在运行那些已经执行大量工作的命令时发生，例如所有构建命令（`cargo build`、`cargo test`、`cargo check`等）以及`cargo fetch`。

如果`cargo`处于离线状态，例如使用 `--offline`或 `--frozen`参数，则不会启用自动删除功能，以避免删除可能在长时间离线期间仍需要的工件。

> [!NOTE]
> 目前这种跟踪机制仅适用于Cargo主目录中的全局缓存。这包括从注册表下载的注册表索引和源文件以及git依赖项。对构建工件的跟踪功能尚未实现，相关讨论可在[cargo#13136](https://github.com/rust-lang/cargo/issues/13136)中查看。
>
> 此外，还有一个不稳定的特性可用于*手动*触发缓存清理，并进一步自定义配置选项。更多详情请参见[不稳定章节](unstable.md#gc)。

#### `cache.auto-clean-frequency` * 类型：字符串 * 默认值：`"1 day"` * 环境变量：`CARGO_CACHE_AUTO_CLEAN_FREQUENCY`

此选项定义了Cargo在多久后自动删除全局缓存中未使用的文件。它并不规定文件的保留时间，具体的保留期限可在[全局缓存部分](#global-caches)查看。

它支持以下设置：

* `"never"` --- 从不删除旧文件。
* `"always"` --- 每次运行Cargo时都检查并删除旧文件。
* 一个整数后跟“秒”、“分钟”、“小时”、“天”、“周”或“月” --- 在指定的时间范围内检查并删除旧文件。

### `[http]`

`[http]`表定义了HTTP行为的设置，包括获取crate依赖项以及访问远程git仓库。

#### `http.debug` * 类型：布尔值 * 默认值：false * 环境变量：`CARGO_HTTP_DEBUG`

如果设置为`true`，则启用HTTP请求的调试功能。通过设置`CARGO_LOG=network=debug`环境变量（或使用`network=trace`以获取更多信息），可以查看调试信息。

在将此输出中的日志发布到公共位置时，请小心。输出中可能包含带有认证令牌的标题，这些令牌不应被泄露！务必在发布前审查日志。

#### `http.proxy` * 类型：字符串 * 默认：无 * 环境变量：`CARGO_HTTP_PROXY` 或 `HTTPS_PROXY` 或 `https_proxy` 或 `http_proxy`

设置使用的 HTTP 和 HTTPS 代理。格式为 `[protocol://]host[:port]` 中的 [libcurl 格式]。如果未设置，Cargo 将检查全局 git 配置中的 `http.proxy` 设置。如果以上均未设置，则 `HTTPS_PROXY` 或 `https_proxy` 环境变量将为 HTTPS 请求设置代理，而 `http_proxy` 将为 HTTP 请求设置代理。

#### `http.timeout` * 类型：整数 * 默认：30 * 环境变量：`CARGO_HTTP_TIMEOUT` 或 `HTTP_TIMEOUT`

设置每个 HTTP 请求的超时时间，以秒为单位。

#### `http.cainfo` * 类型：字符串（路径） * 默认：无 * 环境变量：`CARGO_HTTP_CAINFO`

用于验证 TLS 证书的证书颁发机构（CA）包文件路径。如果未指定，Cargo 将尝试使用系统证书。

#### `http.proxy-cainfo` * 类型：字符串（路径） * 默认：未设置时回退到 `http.cainfo` * 环境变量：`CARGO_HTTP_PROXY_CAINFO`

用于验证代理 TLS 证书的证书颁发机构（CA）包文件路径。

#### `http.check-revoke` * 类型：布尔值 * 默认：true（Windows）false（其他所有平台） * 环境变量：`CARGO_HTTP_CHECK_REVOKE`

决定是否应执行 TLS 证书撤销检查。此功能仅在 Windows 上有效。

#### `http.ssl-version` * 类型：字符串或最小/最大表 * 默认：无 * 环境变量：`CARGO_HTTP_SSL_VERSION`

设置使用的 TLS 版本下限。输入一个字符串，可能的值包括 `"default"`、`"tlsv1"`、`"tlsv1.0"`、`"tlsv1.1"`、`"tlsv1.2"` 或 `"tlsv1.3"`。

也可以接受一个包含两个键 `min` 和 `max` 的表，每个键对应一个相同类型的字符串值，用于指定使用的 TLS 版本的最小和最大范围。

默认情况下，最小值为 `"tlsv1.0"`，最大值为您平台上支持的最新版本，通常是 `"tlsv1.3"`。

#### `http.low-speed-limit` * 类型：整数 * 默认值：10 * 环境：`CARGO_HTTP_LOW_SPEED_LIMIT`

此设置控制慢连接时的超时行为。如果每秒字节数平均值低于 [`http.timeout`](#httptimeout) 秒（默认 30 秒）给定的值，则认为连接过慢，Cargo 将中止并重试。

#### `http.multiplexing` * 类型：布尔值 * 默认值：true * 环境：`CARGO_HTTP_MULTIPLEXING`

当为 `true` 时，Cargo 会尝试使用带有多路复用功能的 HTTP2 协议。这允许多个请求使用同一连接，通常可以在获取多个文件时提高性能。如果为 `false`，Cargo 将不使用管道技术而使用 HTTP 1.1。

#### `http.user-agent` * 类型：字符串 * 默认值：Cargo 版本 * 环境：`CARGO_HTTP_USER_AGENT`

指定要使用的自定义用户代理头。如果未指定，则默认使用包含 Cargo 版本的字符串。

### `[install]`

`[install]` 表定义了 [`cargo install`] 命令的默认值。

#### `install.root` * 类型：字符串（路径） * 默认值：Cargo 主目录 * 环境：`CARGO_INSTALL_ROOT`

设置用于 [`cargo install`] 安装可执行文件的根目录路径。可执行文件将放在根目录下的 `bin` 目录中。

为了跟踪已安装可执行文件的信息，还会在此根目录下创建一些额外文件，如 `.crates.toml` 和 `.crates2.json`。

如果未指定，则默认为 Cargo 主目录（默认位于您的主目录中的 `.cargo`）。

可以通过 `--root` 命令行选项覆盖此设置。

#### `install.profile` * 类型：字符串 * 默认值：`"release"` * 环境：`CARGO_INSTALL_PROFILE`

`cargo install` 的默认 [profile]，用于编译。

可以通过 `--debug` 或 `--profile` CLI 选项覆盖此设置。

```toml
[install]
profile = "tool"

[profile.tool]
inherits = "release"
lto = true
```

> **MSRV：** 在 1.100 版本中受到尊重。

### `[net]`

`[net]` 表用于控制网络配置。

#### `net.retry` * 类型：整数 * 默认值：3 * 环境：`CARGO_NET_RETRY`

用于重试可能误报的网络错误的次数。

#### `net.git-fetch-with-cli` * 类型：布尔值 * 默认值：自动检测 * 环境：`CARGO_NET_GIT_FETCH_WITH_CLI`

如果设置为 `true`，Cargo 将使用 `git` 可执行程序来获取注册表索引和 git 依赖项。如果设置为 `false`，则使用内置的 `git` 库。

将此设置设为 `true` 有助于满足 Cargo 不支持的特殊认证需求。有关设置 git 认证的更多信息，请参阅 [Git Authentication](../appendix/git-authentication.md)。

#### `net.offline` * 类型：布尔值 * 默认值：false * 环境：`CARGO_NET_OFFLINE`

如果设置为 `true`，Cargo 将避免访问网络，并尝试使用本地缓存的数据。如果设置为 `false`，Cargo 将在需要时访问网络，并在遇到网络错误时生成错误。

可以通过 `--offline` 命令行选项覆盖此设置。

#### `net.ssh`

`[net.ssh]` 表包含用于 SSH 连接的设置。

#### `net.ssh.known-hosts` * 类型：字符串数组 * 默认值：参见描述 * 环境：不支持

`known-hosts` 数组包含一组 SSH 主机密钥，当连接到 SSH 服务器时（例如用于 SSH git 依赖项）应被视为有效。每个条目应为以逗号分隔的一个或多个主机名、空格、密钥类型名称、空格以及 Base64 编码的密钥格式的字符串。例如：

```toml
[net.ssh]
known-hosts = [
    "example.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFO4Q5T0UV0SQevair9PFwoxY9dl4pQl3u5phoqJH3cF"
]
```

Cargo 将尝试从 OpenSSH 支持的常见位置加载已知主机密钥，并将配置在 Cargo 配置文件中的任何条目与这些密钥合并。如果匹配的条目具有正确的密钥，则允许连接。

Cargo 自带 [github.com][github-keys] 内置的主机密钥。如果这些密钥发生变化，您可以将新密钥添加到配置或 known_hosts 文件中。

有关更多细节，请参阅 [Git 认证](../appendix/git-authentication.md#ssh-known-hosts)。


### `[patch]`

正如您可以在 [`[patch]` in `Cargo.toml`](overriding-dependencies.md#the-patch-section) 中覆盖依赖项一样，您也可以在 cargo 配置文件中覆盖它们，以便将这些补丁应用于任何受影响的构建。其格式与 `Cargo.toml` 中的格式相同。

由于 `.cargo/config.toml` 文件通常不会被提交到源代码控制中，因此应在可能的情况下使用 `Cargo.toml` 进行补丁处理，以确保其他开发人员能够在自己的环境中编译您的 crate。通过 cargo 配置文件进行补丁通常仅适用于由外部构建工具自动生成的 patch 部分。

如果某个依赖项在 cargo 配置文件和 `Cargo.toml` 文件中都被补丁了，则使用配置文件中的补丁。如果多个配置文件对同一个依赖项进行补丁，则采用标准的 cargo 配置合并方式，该方式优先选择离当前目录最近的定义值，`$HOME/.cargo/config.toml` 的优先级最低。

此类 `[patch]` 部分中的相对 `path` 依赖项根据它们出现的配置文件进行解析。

### `[profile]`

`[profile]` 表可用于全局更改配置设置，并覆盖 `Cargo.toml` 中指定的设置。其语法和选项与 `Cargo.toml` 中指定的配置相同。有关选项的详细信息，请参阅 [Profiles 章节]。


#### `[profile.<name>.build-override]` * 环境: `CARGO_PROFILE_<name>_BUILD_OVERRIDE_<key>`

`build-override` 表用于覆盖构建脚本、proc 宏 及其依赖项的设置。其键与常规配置相同。有关更多细节，请参阅 [overrides 章节](profiles.md#overrides)。

#### `[profile.<name>.package.<name>]` * 环境: 不支持

包表会覆盖特定包的设置。它具有与常规配置相同的键，但缺少 `panic`、`lto` 和 `rpath` 设置。更多详情请参见 [覆盖部分](profiles.md#overrides)。

#### `profile.<name>.codegen-units` * 类型：整数 * 默认值：请参阅配置文档。 * 环境变量：`CARGO_PROFILE_<name>_CODEGEN_UNITS`

请参阅 [codegen-units](profiles.md#codegen-units)。

#### `profile.<name>.debug` * 类型：整数或布尔值 * 默认值：请参阅配置文档。 * 环境变量：`CARGO_PROFILE_<name>_DEBUG`

请参阅 [debug](profiles.md#debug)。

#### `profile.<name>.split-debuginfo` * 类型：字符串 * 默认值：请参阅配置文档。 * 环境变量：`CARGO_PROFILE_<name>_SPLIT_DEBUGINFO`

请参阅 [split-debuginfo](profiles.md#split-debuginfo)。

#### `profile.<name>.debug-assertions` * 类型：布尔值 * 默认值：请参阅配置文档。 * 环境变量：`CARGO_PROFILE_<name>_DEBUG_ASSERTIONS`

请参阅 [debug-assertions](profiles.md#debug-assertions)。

#### `profile.<name>.incremental` * 类型：布尔值 * 默认值：请参阅配置文档。 * 环境变量：`CARGO_PROFILE_<name>_INCREMENTAL`

请参阅 [incremental](profiles.md#incremental)。

#### `profile.<name>.lto` * 类型：字符串或布尔值 * 默认值：请参阅配置文档。 * 环境变量：`CARGO_PROFILE_<name>_LTO`

请参阅 [lto](profiles.md#lto)。

#### `profile.<name>.overflow-checks` * 类型：布尔值 * 默认值：请参阅配置文档。 * 环境变量：`CARGO_PROFILE_<name>_OVERFLOW_CHECKS`

请参阅 [overflow-checks](profiles.md#overflow-checks)。

#### `profile.<name>.opt-level` * 类型：整数或字符串 * 默认值：请参阅配置文档。 * 环境变量：`CARGO_PROFILE_<name>_OPT_LEVEL`

请参阅 [opt-level](profiles.md#opt-level)。

#### `profile.<name>.panic` * 类型：字符串 * 默认值：请参阅配置文档。 * 环境变量：`CARGO_PROFILE_<name>_PANIC`

请参阅 [panic](profiles.md#panic)。

#### `profile.<name>.rpath` * 类型：布尔值 * 默认值：请参阅配置文档。 * 环境变量：`CARGO_PROFILE_<name>_RPATH`

请参阅 [rpath](profiles.md#rpath)。

#### `profile.<name>.strip` * 类型：字符串或布尔值 * 默认：参见 profile 文档。 * 环境变量：`CARGO_PROFILE_<name>_STRIP`

请参阅 [strip](profiles.md#strip)。

#### `profile.<name>.trim-paths` * 类型：字符串 * 默认：参见 profile 文档。 * 环境变量：`CARGO_PROFILE_<name>_TRIM_PATHS`

请参阅 [trim-paths](profiles.md#trim-paths)。

### `[resolver]`

`[resolver]` 表会覆盖本地开发中的 [依赖解析行为](resolver.md)（例如排除 `cargo install`）。

#### `resolver.lockfile-path` * 类型：字符串（路径） * 默认：`<workspace_root>/Cargo.lock` * 环境变量：`CARGO_RESOLVER_LOCKFILE_PATH`

指定在解析依赖时使用的锁文件路径。当处理只读源目录时，此选项非常有用。

路径必须以 `Cargo.lock` 结尾。

> **MSRV：** 需要 1.97+ 版本。

#### `resolver.incompatible-rust-versions` * 类型：字符串 * 默认：参见 [`resolver`](resolver.md#resolver-versions) 文档 * 环境变量：`CARGO_RESOLVER_INCOMPATIBLE_RUST_VERSIONS`

在选择要使用的依赖版本时，可指定如何处理具有不兼容 `package.rust-version` 的版本。选项包括： - `allow`：将 `rust-version` 不兼容版本视为其他版本 * - `fallback`：仅考虑 `rust-version` 不兼容版本，如果没有其他匹配版本。

可以通过 `- `--ignore-rust-version` CLI 选项进行覆盖 - 将依赖的版本要求设置为高于任何具有兼容 `rust-version` 的版本 - 使用 `--precise` 指定要 `cargo update` 的版本。

更多细节请参阅 [resolver](resolver.md#rust-version) 章节。

> **MSRV：** - `allow` 支持所有版本 - `fallback` 从 1.84 版本开始受支持。

#### `resolver.incompatible-publish-age` * 类型：字符串 * 默认：`"deny"` * 环境变量：`CARGO_RESOLVER_INCOMPATIBLE_PUBLISH_AGE`

在解析依赖版本时，可指定对于具有与配置好的 `min-publish-age` 不兼容的 `pubtime` 的版本的行为。选项包括：

- `allow`: 将 pubtime-incompatible 版本视为其他版本 - `deny`: 忽略 pubtime-incompatible 版本，除非它们已存在于 lock file 中

更多细节请参见 [resolver](resolver.md#publish-age) 章节。

> **MSRV:** 在 1.100 版本中受到尊重

### `[registries]`

`[registries]` 表用于指定额外的 [registries]。它包含每个命名注册表的子表。

#### `registries.<name>.index` * 类型：字符串 (url) * 默认：无 * 环境：`CARGO_REGISTRIES_<name>_INDEX`

指定注册表的索引 URL。

#### `registries.<name>.token` * 类型：字符串 * 默认：无 * 环境：`CARGO_REGISTRIES_<name>_TOKEN`

指定给定注册表的认证令牌。此值应仅出现在 [credentials](#credentials) 文件中。它用于需要认证的注册表命令，如 [`cargo publish`]。

可以通过 `--token` 命令行选项覆盖该值。

#### `registries.<name>.credential-provider` * 类型：字符串或路径与参数的数组 * 默认：无 * 环境：`CARGO_REGISTRIES_<name>_CREDENTIAL_PROVIDER`

指定给定注册表的凭证提供器。如果未设置，则使用 [`registry.global-credential-providers`](#registryglobal-credential-providers) 中的提供器。

如果指定为字符串，路径和参数将按空格分割。对于包含空格的路径或参数，请使用数组形式。

如果值存在于 [`[credential-alias]`](#credential-alias) 表中，则使用该别名。

更多信息请参见 [Registry Authentication](registry-authentication.md)。

#### `registries.<name>.min-publish-age` * 类型：字符串 * 默认：`registry.global-min-publish-age` * 环境：`CARGO_REGISTRIES_<name>_MIN_PUBLISH_AGE`

指定自版本 `pubtime` 以来的最小时间跨度，该时间跨度可用于 [`resolver.incompatible-publish-age`] 以判断来自此注册表的包是否不兼容。如果未设置，则使用 [`registry.global-min-publish-age`](#registryglobal-min-publish-age)。

如果注册表不支持此选项，则将被忽略。

它支持以下值：

- 一个整数后跟“seconds”、“minutes”、“hours”、“days”、“weeks”或“months” - 设置为“0”以允许所有包。

通常使用“0”、“N days”和“N weeks”。

> **MSRV:** 在1.100版本中受到尊重。

#### `registries.crates-io.protocol` * 类型：字符串 * 默认值：`"sparse"` * 环境：`CARGO_REGISTRIES_CRATES_IO_PROTOCOL`

指定用于访问 crates.io 的协议。允许的值为 `git` 或 `sparse`。

`git` 会让 Cargo 从 <https://github.com/rust-lang/crates.io-index/> 克隆所有已发布到 [crates.io] 的包的完整索引。由于索引的大小，这可能会对性能产生影响。`sparse` 是一种较新的协议，它使用 HTTPS 仅下载从 <https://index.crates.io/> 所需的内容。在大多数情况下，这可以显著改善新依赖项的解析性能。

有关注册表协议的更多信息可以在 [Registries 章节](registries.md)中找到。

### `[registry]`

`[registry]` 表格控制在未指定时使用的默认注册表。

#### `registry.index`

此值不再被接受，不应使用。

#### `registry.default` * 类型：字符串 * 默认值：`"crates-io"` * 环境：`CARGO_REGISTRY_DEFAULT`

默认用于 [`cargo publish`] 等注册表命令的注册表名称（来自 [`registries` 表格](#registries)）。

可以通过 `--registry` 命令行选项覆盖此值。

#### `registry.credential-provider` * 类型：字符串或路径和参数的数组 * 默认值：无 * 环境：`CARGO_REGISTRY_CREDENTIAL_PROVIDER`

指定 [crates.io] 的凭证提供器。如果未设置，则使用 [`registry.global-credential-providers`](#registryglobal-credential-providers) 中的提供器。

如果作为字符串指定，路径和参数将按空格分割。对于包含空格的路径或参数，请使用数组形式。

如果值存在于 `[credential-alias]` 表中，则使用该别名。

有关更多信息，请参阅 [Registry Authentication](registry-authentication.md)。

#### `registry.token` * 类型：字符串 * 默认：无 * 环境：`CARGO_REGISTRY_TOKEN`

指定 [crates.io] 的认证令牌。该值应仅出现在 [credentials](#credentials) 文件中。用于需要认证的注册表命令（如 [`cargo publish`）]。

可以通过 `--token` 命令行选项覆盖此值。

#### `registry.global-credential-providers` * 类型：数组 * 默认：`["cargo:token"]` * 环境：`CARGO_REGISTRY_GLOBAL_CREDENTIAL_PROVIDERS`

指定全局凭证提供器列表。如果未使用 `registries.<name>.credential-provider` 为特定注册表设置凭证提供器，Cargo 将使用此列表中的提供器。列表末尾的提供器具有优先性。

路径和参数按空格拆分。如果路径或参数包含空格，则应在 [`[credential-alias]`](#credential-alias) 表中定义凭证提供器，并在此处通过其别名引用。

有关更多信息，请参阅 [Registry Authentication](registry-authentication.md)。

#### `registry.global-min-publish-age` * 类型：字符串 * 默认：`"0"` * 环境：`CARGO_REGISTRY_GLOBAL_MIN_PUBLISH_AGE`

指定版本 `pubtime` 以来的全局最小时间跨度，该时间跨度可能被用于 [`resolver.incompatible-publish-age`] 以判断包是否不兼容。如果未使用 `registries.<name>.min-publish-age` 为特定注册表设置 `min-publish-age`，Cargo 将使用此最小发布年龄。

它支持以下值：

- 一个整数后跟 "seconds"、"minutes"、"hours"、"days"、"weeks" 或 "months" - `"0"` 以允许所有包

通常，将使用 `"0"`、"`N days"` 和 `"N weeks"`。

> **MSRV：** 在 1.100 版本中受尊重。

### `[source]`

`[source]` 表定义了可用的注册源。有关更多信息，请参阅 [Source Replacement]。该表包含每个命名源的子表。一个源应仅定义一种类型（目录、注册表、本地注册表或 git）。

#### `source.<name>.replace-with` * 类型：字符串 * 默认：无 * 环境：不支持

如果设置，则用给定的命名源或命名注册表替换此源。

#### `source.<name>.directory` * 类型：字符串（路径） * 默认：无 * 环境：不支持

设置用作目录源的目录路径。

#### `source.<name>.registry` * 类型：字符串（URL） * 默认：无 * 环境：不支持

设置用于注册表源的 URL。

#### `source.<name>.local-registry` * 类型：字符串（路径） * 默认：无 * 环境：不支持

设置用作本地注册表源的目录路径。

#### `source.<name>.git` * 类型：字符串（URL） * 默认：无 * 环境：不支持

设置用于 git 仓库源的 URL。

#### `source.<name>.branch` * 类型：字符串 * 默认：无 * 环境：不支持

设置用于 git 仓库的分支名称。

如果未设置 `branch`、`tag` 或 `rev`，则默认为 `master` 分支。

#### `source.<name>.tag` * 类型：字符串 * 默认：无 * 环境：不支持

设置用于 git 仓库的标签名称。

如果未设置 `branch`、`tag` 或 `rev`，则默认为 `master` 分支。

#### `source.<name>.rev` * 类型：字符串 * 默认：无 * 环境：不支持

设置用于 git 仓库的 [修订版本]。

如果未设置 `branch`、`tag` 或 `rev`，则默认为 `master` 分支。


### `[target]`

`[target]` 表用于指定特定平台目标的设置。该表包含子表，可以是 [平台元组][目标元组] 或 [`cfg()` 表达式]。如果目标平台与 `<tuple>` 值或 `<cfg>` 表达式匹配，则使用给定值。

```toml
[target.thumbv7m-none-eabi]
linker = "arm-none-eabi-gcc"
runner = "my-emulator"
rustflags = ["…", "…"]

[target.'cfg(all(target_arch = "arm", target_os = "none"))']
runner = "my-arm-wrapper"
rustflags = ["…", "…"]
```

`cfg` 值来自编译器内置的选项（运行 `rustc --print=cfg` 查看），以及传递给 `rustc` 的额外 `--cfg` 标志（如在 `RUSTFLAGS` 中定义的那些）。不要尝试在 `debug_assertions`、`test`、`Cargo` 特性如 `feature="foo"` 或由 [构建脚本] 设置的值上进行匹配。

如果使用目标规范 JSON 文件，[$<tuple>] 值就是文件名前缀。例如 `--target foo/bar.json` 将匹配 `[target.bar]`。

#### `target.<tuple>.ar`

此选项已弃用且未使用。

#### `target.<tuple>.linker` * 类型：字符串（程序路径） * 默认：无 * 环境：`CARGO_TARGET_<tuple>_LINKER`

指定在编译[$<tuple>]时传递给 `rustc` 的链接器（通过 [`-C linker`]）。默认情况下不会覆盖链接器。

#### `target.<cfg>.linker` 这与 [目标 linker](#targettuplelinker) 类似，但使用 [`cfg()` 表达式]。如果[$<tuple>] 和 `<cfg>` 链接器都匹配，则`<tuple>`将优先生效。如果多个`<cfg>` 链接器与当前目标匹配，则会产生错误。

#### `target.<tuple>.runner` * 类型：字符串或字符串数组（带参数的程序路径） * 默认：无 * 环境：`CARGO_TARGET_<tuple>_RUNNER`

如果提供了运行器，目标[$<tuple>]的可执行文件将通过调用指定的运行器并传递实际可执行文件作为参数来执行。这适用于 [`cargo run`]、[`cargo test`]和[`cargo bench`]命令。默认情况下，编译后的可执行文件将直接执行。

#### `target.<cfg>.runner`

这与 [目标 runner](#targettuplerunner) 类似，但使用 [`cfg()` 表达式]。如果[$<tuple>] 和 `<cfg>` 运行器都匹配，则`<tuple>`将优先生效。如果多个`<cfg>` 运行器与当前目标匹配，则会产生错误。

#### `target.<tuple>.rustflags` * 类型：字符串或字符串数组 * 默认：无 * 环境：`CARGO_TARGET_<tuple>_RUSTFLAGS`

为这个[$<tuple>]向编译器传递一组自定义标志。值可以是字符串数组或空格分隔的字符串。

有关指定额外标志的不同方法，请参阅 [`build.rustflags`](#buildrustflags)。

#### `target.<cfg>.rustflags`

这类似于 [目标 rustflags](#targettuplerustflags)，但使用了一个 [`cfg()` 表达式]。如果多个 `<cfg>` 和 [`<tuple>`] 条目与当前目标匹配，则这些标志会被合并在一起。

#### `target.<tuple>.rustdocflags` * 类型：字符串或字符串数组 * 默认：无 * 环境：`CARGO_TARGET_<tuple>_RUSTDOCFLAGS`

为这个 [`<tuple>`] 向编译器传递一组自定义标志。该值可以是字符串数组或空格分隔的字符串。

有关指定额外标志的不同方法，请参阅 [`build.rustdocflags`](#buildrustdocflags)。

#### `target.<cfg>.rustdocflags`

这类似于 [目标 rustdocflags](#targettuplerustdocflags)，但使用了一个 [`cfg()` 表达式]。如果多个 `<cfg>` 和 [`<tuple>`] 条目与当前目标匹配，则这些标志会被合并在一起。

#### `target.<tuple>.<links>`

Links 子表提供了一种 [覆盖构建脚本] 的方法。当指定时，给定的 `links` 库的构建脚本将不会运行，而是使用指定的值。

```toml
[target.x86_64-unknown-linux-gnu.foo]
rustc-link-lib = ["foo"]
rustc-link-search = ["/path/to/foo"]
rustc-flags = "-L /some/path"
rustc-cfg = ['key="value"']
rustc-env = {key = "value"}
rustc-cdylib-link-arg = ["…"]
metadata_key1 = "value"
metadata_key2 = "value"
```

### `[term]`

`[term]` 表控制终端输出和交互。

#### `term.quiet` * 类型：布尔值 * 默认：false * 环境：`CARGO_TERM_QUIET`

控制 Cargo 是否显示日志消息。

指定 `--quiet` 标志将覆盖并强制静默输出。指定 `--verbose` 标志将覆盖并禁用静默输出。

#### `term.verbose` * 类型：布尔值 * 默认：false * 环境：`CARGO_TERM_VERBOSE`

控制 Cargo 是否显示更详细的消息。

指定 `--quiet` 标志将覆盖并禁用详细输出。指定 `--verbose` 标志将覆盖并强制详细输出。

#### `term.color` * 类型：字符串 * 默认：`"auto"` * 环境：`CARGO_TERM_COLOR`

控制终端中是否使用彩色输出。可能的值：

* `auto` (默认): 自动检测终端是否支持颜色。
* `always`: 始终显示颜色。
* `never`: 从不显示颜色。

可以通过 `--color` 命令行选项进行覆盖设置。

#### `term.hyperlinks` * 类型: bool * 默认值: 自动检测 * 环境变量: `CARGO_TERM_HYPERLINKS`

控制是否在终端中显示超链接。

#### `term.unicode` * 类型: bool * 默认值: 自动检测 * 环境变量: `CARGO_TERM_UNICODE`

控制是否可以使用非 ASCII unicode 字符来渲染输出。

#### `term.progress.when` * 类型: string * 默认值: `"auto"` * 环境变量: `CARGO_TERM_PROGRESS_WHEN`

控制是否在终端中显示进度条。可能的值有：

* `auto` (默认): 智能猜测是否显示进度条。
* `always`: 始终显示进度条。
* `never`: 从不显示进度条。

#### `term.progress.width` * 类型: integer * 默认值: 无 * 环境变量: `CARGO_TERM_PROGRESS_WIDTH`

设置进度条的宽度。

#### `term.progress.term-integration` * 类型: bool * 默认值: 自动检测 * 环境变量: `CARGO_TERM_PROGRESS_TERM_INTEGRATION`

将进度报告给终端仿真器，以便在任务栏等位置显示。

[github-keys]: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/githubs-ssh-key-fingerprints
[Profiles chapter]: profiles.md
[`cargo bench`]: ../commands/cargo-bench.md
[`cargo login`]: ../commands/cargo-login.md
[`cargo logout`]: ../commands/cargo-logout.md
[`cargo doc`]: ../commands/cargo-doc.md
[`cargo new`]: ../commands/cargo-new.md
[`cargo publish`]: ../commands/cargo-publish.md
[`cargo run`]: ../commands/cargo-run.md
[`cargo rustc`]: ../commands/cargo-rustc.md
[`cargo test`]: ../commands/cargo-test.md
[`cargo rustdoc`]: ../commands/cargo-rustdoc.md
[`cargo install`]: ../commands/cargo-install.md
[env]: environment-variables.md
[`cfg()` expression]: ../../reference/conditional-compilation.html
[build scripts]: build-scripts.md
[`-C linker`]: ../../rustc/codegen-options/index.md#linker
[override a build script]: build-scripts.md#overriding-build-scripts
[toml]: https://toml.io/
[incremental compilation]: profiles.md#incremental
[program path with args]: #executable-paths-with-arguments
[libcurl format]: https://everything.curl.dev/transfers/conn/proxies#proxy-types
[source replacement]: source-replacement.md
[revision]: https://git-scm.com/docs/gitrevisions
[registries]: registries.md
[profile]: profiles.md
[`cargo:token`]: registry-authentication.md#cargotoken
[crates.io]: https://crates.io/
[target tuple]: ../appendix/glossary.md#target '"target" (glossary)'
[`<tuple>`]: ../appendix/glossary.md#target '"target" (glossary)'
[`resolver.incompatible-publish-age`]: config.md#resolverincompatible-publish-age
