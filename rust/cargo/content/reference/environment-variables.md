# 环境变量

Cargo 会设置和读取多种环境变量，您的代码可以检测或覆盖这些变量。以下按 Cargo 与它们交互的不同阶段，列出了 Cargo 设置的变量：

## Cargo 读取的环境变量

您可以覆盖这些环境变量来更改您系统上 Cargo 的行为：

* `CARGO_LOG` --- Cargo 使用 [`tracing`] crate 来显示调试日志消息。`CARGO_LOG` 环境变量可以设置为 `trace`、`debug` 或 `warn`，以启用调试日志记录。通常仅在调试期间使用此选项。更多详情请参阅 [Debug logging]。
* `CARGO_HOME` --- Cargo 维护着注册表索引和 crates 的 git 仓库本地缓存。默认情况下，这些缓存存储在 `$HOME/.cargo`（Windows 为 `%USERPROFILE%\.cargo`）下，但该变量可以覆盖此目录的位置。一旦一个 crate 被缓存，则无法通过 clean 命令删除。更多详情请参阅 [guide](../guide/cargo-home.md)。
* `CARGO_TARGET_DIR` --- 相对于当前工作目录，所有生成产物存放的位置。可通过配置设置 [`build.target-dir]`。
* `CARGO` --- 如果设置此值，Cargo 在构建 crates 以及执行构建脚本和外部子命令时，将使用该值而非自行检测的路径。此值不会由 Cargo 直接执行，应始终指向一个与 `cargo` 行为相同的命令，因为用户期望如此。
* `RUSTC` --- Cargo 将代替运行 `rustc`，转而执行指定的编译器。可通过配置设置 [`build.rustc]`。
* `RUSTC_WRAPPER` --- Cargo 将代替直接运行 `rustc`，转而执行指定的包装器，并将 `rustc` 调用作为命令行参数传递，第一个参数是实际 `rustc` 的路径。适用于设置构建缓存工具如 `sccache`。可通过配置设置 [`build.rustc-wrapper]`。将其设置为空字符串会覆盖配置，使 cargo 不再使用包装器。
* `RUSTC_WORKSPACE_WRAPPER` --- 对于工作空间成员，Cargo 将代替直接运行 `rustc`，转而执行指定的包装器，并将 `rustc` 调用作为命令行参数传递，第一个参数是实际 `rustc` 的路径。当构建无工作空间的单包项目时，该包被视为工作空间。它影响文件名哈希，使包装器生成的产物被单独缓存。可通过配置设置 [`build.rustc-workspace-wrapper]`。将其设置为空字符串会覆盖配置，使 cargo 不再对工作空间成员使用包装器。如果同时设置了 `RUSTC_WRAPPER` 和 `RUSTC_WORKSPACE_WRAPPER`，则它们会被嵌套：最终调用为 `$RUSTC_WRAPPER $RUSTC WORKSPACE WRAPPER $RUSTC`。
* `RUSTDOC` --- Cargo 将代替运行 `rustdoc`，转而执行指定的 `rustdoc` 实例。可通过配置设置 [`build.rustdoc]`。
* `RUSTDOCFLAGS` --- 由空格分隔的自定义标志列表，用于传递给 Cargo 执行的所有 `rustdoc` 调用。与 [`cargo rustdoc`]不同，此选项可用于向所有 `rustdoc` 实例传递标志。更多设置标志的方法请参阅 [build.rustdocflags]。该字符串按空白字符分割；对于多个参数的更健壮编码方式，请参阅 `CARGO_ENCODED_RUSTDOCFLAGS`。
* `CARGO_ENCODED_RUSTDOCFLAGS` --- 由 `0x1f`（ASCII Unit Separator）分隔的自定义标志列表，用于传递给 Cargo 执行的所有 `rustdoc` 调用。
* `RUSTFLAGS` --- 由空格分隔的自定义标志列表，用于传递给 Cargo 执行的所有编译器调用。与 [`cargo rustc`]不同，此选项可用于向所有编译器实例传递标志。更多设置标志的方法请参阅 [build.rustflags]。该字符串按空白字符分割；对于多个参数的更健壮编码方式，请参阅 `CARGO_ENCODED_RUSTFLAGS`。
* `CARGO_ENCODED_RUSTFLAGS` --- 由 `0x1f`（ASCII Unit Separator）分隔的自定义标志列表，用于传递给 Cargo 执行的所有编译器调用。
* `RUSTCOIN_INCREMENTAL` --- 如果设置为 1，则强制当前编译启用 [增量编译]，设置为 0 则禁用此功能。如果不存在该环境变量，则使用 cargo 的默认设置。另请参阅 [build.incremental] 配置值。
* `CARGO_CACHE_RUSTC_INFO` --- 如果设置为 0，则 Cargo 不会尝试缓存编译器版本信息。
* `HTTPS_PROXY` 或 `https_proxy` 或 `http_proxy` --- 使用的 HTTP 代理，更多详情请参阅 [http.proxy]。
* `HTTP_TIMEOUT` --- 以秒为单位的 HTTP 超时时间，更多详情请参阅 [http.timeout]。
* `TERM` --- 如果设置为 `dumb`，则禁用进度条。
* `BROWSER` --- 使用网页浏览器打开文档，通过 [`cargo doc`]的 `--open` 标志实现，更多详情请参阅 [doc.browser]。
* `RUSTFMT` --- 代替运行 `rustfmt`，[`cargo fmt`](https://github.com/rust-lang/rustfmt) 将代替执行指定的 `rustfmt` 实例。

### 配置环境变量

Cargo 会读取环境变量来获取某些配置值。更多详情请参见 [配置章节][config-env]。总之，支持的环境变量包括：

* `CARGO_ALIAS_<name>` --- 命令别名，参见 [`alias`]。
* `CARGO_BUILD_WARNINGS` --- 本地包的有效lint警告级别，参见 [`build.warnings`]。
* `CARGO_BUILD_JOBS` --- 并行作业数量，参见 [`build.jobs`]。
* `CARGO_BUILD_RUSTC` --- `rustc` 可执行文件，参见 [`build.rustc`]。
* `CARGO_BUILD_RUSTC_WRAPPER` --- `rustc` 包装器，参见 [`build.rustc-wrapper`]。
* `CARGO_BUILD_RUSTC_WORKSPACE_WRAPPER` --- 仅适用于工作空间成员的 `rustc` 包装器，参见 [`build.rustc-workspace-wrapper`]。
* `CARGO_BUILD_RUSTDOC` --- `rustdoc` 可执行文件，参见 [`build.rustdoc`]。
* `CARGO_BUILD_TARGET` --- 默认目标平台，参见 [`build.target`]。
* `CARGO_BUILD_TARGET_DIR` --- 默认输出目录，参见 [`build.target-dir`]。
* `CARGO_BUILD_BUILD_DIR` --- 默认构建目录，参见 [`build.build-dir`]。
* `CARGO_BUILD_PROFILE` --- 默认配置文件，参见 [`build.profile`]。
* `CARGO_BUILD_RUSTFLAGS` --- 额外的 `rustc` 标志，参见 [`build.rustflags`]。
* `CARGO_BUILD_RUSTDOCFLAGS` --- 额外的 `rustdoc` 标志，参见 [`build.rustdocflags`]。
* `CARGO_BUILD_INCREMENTAL` --- 增量编译，参见 [`build.incremental`]。
* `CARGO_BUILD_DEP_INFO_BASEDIR` --- Dep-info 相对目录，参见 [`build.dep-info-basedir`]。
* `CARGO_CACHE_AUTO_CLEAN_FREQUENCY` --- 配置自动缓存清理的频率，参见 [`cache.auto-clean-frequency`]。
* `CARGO_CARGO_NEW_VCS` --- 使用 [`cargo new`]的默认源代码控制系统，参见 [`cargo-new.vcs`]。
* `CARGO_CREDENTIAL_ALIAS_<name>` --- 凭证提供器别名，参见 [`credential-alias`]。
* `CARGO_FUTURE_INCOMPAT_REPORT_FREQUENCY` --- 生成未来不兼容报告通知的频率，参见 [`future-incompat-report.frequency`]。
* `CARGO_HTTP_DEBUG` --- 启用HTTP调试，参见 [`http.debug`]。
* `CARGO_HTTP_PROXY` --- 启用HTTP代理，参见 [`http.proxy`]。
* `CARGO_HTTP_TIMEOUT` --- HTTP超时时间，参见 [`http.timeout`]。
* `CARGO_HTTP_CAINFO` --- TLS证书颁发机构文件，参见 [`http.cainfo`]。
* `CARGO_HTTP_PROXY_CAINFO` --- 代理TLS证书颁发机构文件，参见 [`http.proxy-cainfo`]。
* `CARGO_HTTP_CHECK_REVOKE` --- 禁用TLS证书撤销检查，参见 [`http.check-revoke`]。
* `CARGO_HTTP_SSL_VERSION` --- 使用的TLS版本，参见 [`http.ssl-version`]。
* `CARGO_HTTP_LOW_SPEED_LIMIT` --- HTTP低速限制，参见 [`http.low-speed-limit`]。
* `CARGO_HTTP_MULTIPLEXING` --- 是否使用HTTP/2多路复用，参见 [`http.multiplexing`]。
* `CARGO_HTTP_USER_AGENT` --- HTTP用户代理头信息，参见 [`http.user-agent`]。
* `CARGO_INSTALL_ROOT` --- 使用 [`cargo install`]的默认目录，参见 [`install.root`]。
* `CARGO_INSTALL_PROFILE` --- 默认配置文件，参见 [`install.profile`]。
* `CARGO_NET_RETRY` --- 网络错误重试次数，参见 [`net.retry`]。
* `CARGO_NET_GIT_FETCH_WITH_CLI` --- 启用使用`git`可执行文件进行获取，参见 [`net.git-fetch-with-cli`]。
* `CARGO_NET_OFFLINE` --- 离线模式，参见 [`net.offline`]。
* `CARGO_PROFILE_<name>_BUILD_OVERRIDE_<key>` --- 覆盖构建脚本配置文件，参见 [`profile.<name>.build-override`]。
* `CARGO_PROFILE_<name>_CODEGEN_UNITS` --- 设置代码生成单位，参见 [`profile.<name>.codegen-units`]。
* `CARGO_PROFILE_<name>_DEBUG` --- 包含何种调试信息，参见 [`profile.<name>.debug`]。
* `CARGO_PROFILE_<name>_DEBUG_ASSERTIONS` --- 启用/禁用调试断言，参见 [`profile.<name>.debug-assertions`]。
* `CARGO_PROFILE_<name>_INCREMENTAL` --- 启用/禁用增量编译，参见 [`profile.<name>.incremental`]。
* `CARGO_PROFILE_<name>_LTO` --- 链接时优化，参见 [`profile.<name>.lto`]。
* `CARGO_PROFILE_<name>_OVERFLOW_CHECKS` --- 启用/禁用溢出检查，参见 [`profile.<name>.overflow-checks`]。
* `CARGO_PROFILE_<name>_OPT_LEVEL` --- 设置优化级别，参见 [`profile.<name>.opt-level`]。
* `CARGO_PROFILE_<name>_PANIC` --- 使用的恐慌策略，参见 [`profile.<name>.panic`]。
* `CARGO_PROFILE_<name>_RPATH` --- rpath链接选项，参见 [`profile.<name>.rpath`]。
* `CARGO_PROFILE_<name>_SPLIT_DEBUGINFO` --- 控制调试文件输出行为，参见 [`profile.<name>.split-debuginfo`]。
* `CARGO_PROFILE_<name>_STRIP` --- 控制符号和/或调试信息的剥离，参见 [`profile.<name>.strip`]。
* `CARGO_REGISTRIES_<name>_CREDENTIAL_PROVIDER` --- 注册表的凭证提供器，参见 [`registries.<name>.credential-provider`]。
* `CARGO_REGISTRIES_<name>_INDEX` --- 注册表索引的URL，参见 [`registries.<name>.index`]。
* `CARGO_REGISTRIES_<name>_MIN_PUBLISH_AGE` --- 来自注册表的包的最小发布年龄，参见 [`registries.<name>.min-publish-age`]。
* `CARGO_REGISTRIES_<name>_TOKEN` --- 注册表的认证令牌，参见 [`registries.<name>.token`]。
* `CARGO_REGISTRIES_CRATES_IO_PROTOCOL` --- 访问[crates.io]使用的协议，参见 [`registries.crates-io.protocol`]。
* `CARGO_REGISTRY_CREDENTIAL_PROVIDER` --- [crates.io]的凭证提供器，参见 [`registry.credential-provider`]。
* `CARGO_REGISTRY_DEFAULT` --- `--registry`标志的默认注册表，参见 [`registry.default`]。
* `CARGO_REGISTRY_GLOBAL_CREDENTIAL_PROVIDERS` --- 没有定义特定提供器的注册表的凭证提供器。参见 [`registry.global-credential-providers`]。
* `CARGO_REGISTRY_GLOBAL_MIN_PUBLISH_AGE` --- 来自注册表的包的默认最小发布年龄，参见 [`registry.global-min-publish-age`]。
* `CARGO_REGISTRY_TOKEN` --- [crates.io]的认证令牌，参见 [`registry.token`]。
* `CARGO_RESOLVER_INCOMPATIBLE_PUBLISH_AGE` --- 在依赖解析过程中如何处理最近发布的版本，参见 [`resolver.incompatible-publish-age`]。
* `CARGO_RESOLVER_INCOMPATIBLE_RUST_VERSIONS` --- 在依赖解析过程中如何处理不兼容的Rust版本，参见 [`resolver.incompatible-rust-versions`]。
* `CARGO_RESOLVER_LOCKFILE_PATH` --- 锁文件路径，参见 [`resolver.lockfile-path`]。
* `CARGO_TARGET_<tuple>_LINKER` --- 使用的链接器，参见 [`target.<tuple>.linker`]。元组必须被[转换为大写并添加下划线](config.md#environment-variables)。
* `CARGO


## Cargo为crates设置的环境变量

当Crate被编译时，Cargo会将这些环境变量暴露给你的crate。请注意，这同样适用于使用`cargo run`和`cargo test`运行二进制文件的情况。要在Rust程序中获取这些变量中的任意一个值，请执行以下操作：

```rust,ignore
let version = env!("CARGO_PKG_VERSION");
```

`version`现在将包含`CARGO_PKG_VERSION`的值。

注意，如果清单中未提供其中任何一个值，相应的环境变量将被设置为空字符串`""`。

* `CARGO` --- 执行构建的 `cargo` 二进制文件的路径。
* `CARGO_MANIFEST_DIR` --- 包含你的包清单的目录。
* `CARGO_MANIFEST_PATH` --- 你的包清单的路径。
* `CARGO_PKG_VERSION` --- 你的包的完整版本号。
* `CARGO_PKG_VERSION_MAJOR` --- 你的包的主版本号。
* `CARGO_PKG_VERSION_MINOR` --- 你的包的次版本号。
* `CARGO_PKG_VERSION_PATCH` --- 你的包的修订版本号。
* `CARGO_PKG_VERSION_PRE` --- 你的包的预发布版本号。
* `CARGO_PKG_AUTHORS` --- 来自包清单中作者们的冒号分隔列表。
* `CARGO_PKG_NAME` --- 你的包的名称。
* `CARGO_PKG_DESCRIPTION` --- 来自包清单中的描述信息。
* `CARGO_PKG_HOMEPAGE` --- 来自包清单中的主页链接。
* `CARGO_PKG_REPOSITORY` --- 来自包清单中的仓库地址。
* `CARGO_PKG_LICENSE` --- 来自包清单中的许可证信息。
* `CARGO_PKG_LICENSE_FILE` --- 来自包清单中的许可证文件。
* `CARGO_PKG_RUST_VERSION` --- 来自包清单中的 Rust 版本号。请注意，这是该包支持的最低 Rust 版本，而非当前使用的 Rust 版本。
* `CARGO_PKG_README` --- 你的包的 README 文件路径。
* `CARGO_CRATE_NAME` --- 当前正在编译的 crate 名称。它是带有 `-` 被转换为 `_` 的 [Cargo 目标] 的名称，例如库、二进制文件、示例、集成测试或基准测试的名称。
* `CARGO_BIN_NAME` --- 当前正在编译的二进制文件的名称。仅用于 [二进制文件] 或二进制 [示例]。该名称不包含任何文件扩展名，如 `.exe`。
* `OUT_DIR` --- 如果包包含构建脚本，则此处指定构建脚本应放置输出结果的文件夹路径。详情请参阅下文。Cargo 不保证此目录为空，且在不同构建之间不会清理该目录。
* `CARGO_BIN_EXE_<name>` --- 二进制目标可执行文件的绝对路径。仅在构建 [集成测试] 或基准测试时设置。可通过 [`env` 宏] 使用此路径来查找用于测试的可执行文件。`<name>` 是二进制目标的名称，保持原样。例如，对于名为 `my-program` 的二进制文件，`CARGO_BIN_EXE_my-program`。除非二进制文件包含未启用的必需功能，否则在测试构建时会自动生成二进制文件。
* `CARGO_PRIMARY_PACKAGE` --- 如果正在构建的包是主包，则设置此环境变量。主包是指用户在命令行中通过 `-p` 标志选择的包，或者基于当前目录和默认工作空间成员自动确定的包。在构建依赖项时不会设置此变量，除非该依赖项也是命令行中选择的workspace成员。此变量仅在编译包时设置（运行二进制文件或测试时不设置）。
* `CARGO_TARGET_TMPDIR` --- 仅在构建 [集成测试] 或基准测试代码时设置。这是目标目录内一个文件夹的路径，集成测试或基准测试可以在其中自由放置测试/基准测试所需的任何数据。Cargo 会初始创建此目录，但不对其内容进行管理，这由测试代码负责。


### 动态库路径

当使用 `cargo run` 和 `cargo test` 等命令编译和运行二进制文件时，Cargo 还会设置动态库路径。这有助于定位属于构建过程的共享库。变量名称取决于平台：

* Windows: `PATH` * macOS: `DYLD_FALLBACK_LIBRARY_PATH` * Unix: `LD_LIBRARY_PATH` * AIX: `LIBPATH`

该值会在 Cargo 启动时从现有值扩展而来。对于 macOS，如果 `DYLD_FALLBACK_LIBRARY_PATH` 尚未设置，则会自动添加默认路径 `$HOME/lib:/usr/local/lib:/usr/lib`。

Cargo 包含以下路径：

* 通过 [`rustc-link-search` 指令](build-scripts.md#rustc-link-search)从任何构建脚本中引入的搜索路径。`target` 目录之外的路径将被移除。如果系统中需要额外的库在搜索路径中，由运行 Cargo 的用户负责正确设置环境。
* 基础输出目录，如 `target/debug`，以及“deps”目录。这主要用于支持 proc-macros。
* rustc sysroot 库路径。对于大多数用户来说，这通常并不重要。

## Cargo 为构建脚本设置的环境变量

当运行构建脚本时，Cargo 会设置几个环境变量。由于这些变量在构建脚本编译时尚未设置，上述使用 `env!` 的示例将不起作用，您需要在实际运行构建脚本时获取这些值：

```rust,ignore
use std::env;
let out_dir = env::var("OUT_DIR").unwrap();
```

`out_dir` 现在将包含 `OUT_DIR` 的值。

* `CARGO` —— 执行构建的 `cargo` 二进制文件的路径。
* `CARGO_MANIFEST_DIR` —— 包含正在构建的包清单的目录（即包含构建脚本的包）。注意，这也是构建脚本启动时当前工作目录的值。
* `CARGO_MANIFEST_PATH` —— 您包的清单路径。
* `CARGO_MANIFEST_LINKS` —— 清单中的 `links` 值。
* `CARGO_MAKEFLAGS` —— 包含用于让 Cargo [jobserver] 实现并行化子进程所需的参数。从 build.rs 调用的 Rustc 或 cargo 已经可以读取 `CARGO_MAKEFLAGS`，但 GNU Make 需要直接作为参数指定这些标志，或通过 `MAKEFLAGS` 环境变量指定。目前 Cargo 不设置 `MAKEFLAGS` 变量，但调用 GNU Make 的构建脚本可以自由将其设置为 `CARGO_MAKEFLAGS` 的内容。
* `CARGO_FEATURE_<name>` —— 对于正在构建的包中启用的每个特性，此环境变量都会存在；其中 `<name>` 是特性的名称，大写并将 `-` 替换为 `_`。
* `CARGO_CFG_<cfg>` —— 对于正在构建的包中的每个 [配置选项]，此环境变量将包含该配置的值；其中 `<cfg>` 是配置的名称，大写并将 `-` 替换为 `_`。如果设置了布尔型配置，则会出现该值，否则不会出现。具有多个值的配置会用 `,` 分隔各个值，组合成一个变量。这包括编译器内置的值（可以通过 `rustc --print=cfg` 查看）以及由构建脚本设置的值和传递给 `rustc` 的额外标志（如在 `RUSTFLAGS` 中定义的那些）。这些变量的一些示例包括：
* `CARGO_CFG_FEATURE` —— 正在构建的包中启用的每个特性。
* `CARGO_CFG_UNIX` —— 在 [类 Unix 平台] 上设置的配置。
* `CARGO_CFG_WINDOWS` —— 在 [类 Windows 平台] 上设置的配置。
* `CARGO_CFG_TARGET_FAMILY=unix,wasm` —— [目标架构]。
* `CARGO_CFG_TARGET_OS=macos` —— [目标操作系统]。
* `CARGO_CFG_TARGET_ARCH=x86_64` —— CPU [目标架构]。
* `CARGO_CFG_TARGET_VENDOR=apple` —— [目标供应商]。
* `CARGO_CFG_TARGET_ENV=gnu` —— [目标环境] ABI。
* `CARGO_CFG_TARGET_ABI=eabihf` —— [目标 ABI]。
* `CARGO_CFG_TARGET_POINTER_WIDTH=64` —— CPU [指针宽度]。
* `CARGO_CFG_TARGET_ENDIAN=little` —— CPU [目标字节序]。
* `CARGO_CFG_TARGET_FEATURE=mmx,sse` —— 启用的 CPU [目标特性] 列表。
  > [!NOTE]
  > 不同的[目标元组][目标 Tuple]具有不同的`cfg`值集合，因此一个目标元组中存在的变量可能在另一个中不可用。
  >
  > 某些`cfg`值如`test`是不可用的。
  <!-- Keep alerts separate -->
  > [!TIP]
  > 若需通过类型化的 API 读取这些值，建议使用 [`build-rs`] 包而非手动解析环境变量。此外请注意，在构建脚本中应使用 `CARGO_CFG_*` 变量，而不是 `cfg!` 宏或 `#[cfg]` 属性，因为这些检查的是 *host* 平台，而非 *目标*。 * `OUT_DIR` —— 所有输出文件与中间产物应存放的文件夹。该文件夹位于正在构建的包的构建目录内，且对特定包而言是唯一的。Cargo 在每次构建之间不会清理或重置此目录，其内容可能在多次重建后仍然存在。构建脚本不应假设 `OUT_DIR` 为空，并且需负责管理或清理它们创建的任何文件。此值是在构建脚本执行和库编译过程中设置的，**但在运行时不可用**。 * `TARGET` —— 正在被编译的目标元组。原生代码应针对该元组进行编译。有关更多信息，请参阅 [目标 Tuple] 描述。 * `HOST` —— Rust 编译器的 *host* 元组。 * `NUM_JOBS` —— 作为顶层并行性指定的并行度。这可用于向 `make` 等系统传递 `-j` 参数。请注意在解释此环境变量时需谨慎。出于历史原因，该变量仍被提供，但最新版本的 Cargo 不需要运行 `make -j`，而是可以将 `MAKEFLAGS` 环境变量设置为 `CARGO_MAKEFLAGS` 的内容，以激活使用 Cargo 的 GNU Make 兼容 [jobserver] 进行子 make 调用。 * `DEBUG` —— 如果生成任何 [`debug`] 信息则设为 `true`，否则设为 `false`。 * `OPT_LEVEL` —— 当前正在构建的配置文件对应的 [`opt-level`] 变量值。 * `PROFILE` —— 发布构建时设为 `release`，其他构建时设为 `debug`。这是根据 [profile] 是否继承来自 [`dev`] 或 [`release`] 配置决定的。不建议使用此环境变量。使用其他环境变量如 `OPT_LEVEL` 能更准确地反映实际设置情况。 * `DEP_<links>_<key>` —— 有关这组环境变量的更多信息，请参阅构建脚本关于 [`links`][links] 的文档。 * `RUSTC`, `RUSTDOC` —— Cargo 已确定使用的编译器和文档生成器，这些参数会被传递给构建脚本，以便构建脚本也能使用它们。 * `RUSTC_WRAPPER` —— Cargo 使用的 `rustc` 包装器（如果有）。请参阅 [`build.rustc-wrapper`]。 * `RUSTC_WORKSPACE_WRAPPER` —— Cargo 用于工作空间成员时的 `rustc` 包装器（如果有）。请参阅 [`build.rustc-workspace-wrapper`]。 * `RUSTC_LINKER` —— 如果指定，则指 Cargo 为当前目标确定的链接器二进制文件路径。可通过编辑 `.cargo/config.toml` 来更改链接器，有关更多信息，请参阅关于 [cargo configuration][cargo-config] 的文档。 * `CARGO_ENCODED_RUSTFLAGS` —— Cargo 向 `rustc` 调用的额外标志，用 `0x1f` 字符（ASCII Unit Separator）分隔。请参阅 [`build.rustflags`]。请注意，自 Rust 1.55 版本起，`RUSTFLAGS` 已从环境中移除；脚本应改用 `CARGO_ENCODED_RUSTFLAGS`。 * `CARGO_PKG_<var>` —— 包信息变量，其名称和值与 [在 crate 构建期间提供的][为 crates 设置的变量] 相同。 * `CARGO_TRIM_PATHS_SCOPE` —— [`trim-paths`] 配置选项的值。如果构建脚本引入了构建产物的绝对路径（例如通过调用编译器），用户可能希望在不同类型的产物中对其进行清理。需要清理的常见路径包括 `OUT_DIR`、`CARGO_MANIFEST_DIR` 和 `CARGO_MANIFEST_PATH`，以及构建脚本引入的任何其他路径，如包含目录。
  > [!NOTE]
  > 为了向前兼容，构建脚本应接受逗号分隔的域列表。* `CARGO_TRIM_PATHS_REMAP` --- 由平台路径分隔符连接起来的 `<from>=<to>` 路径重映射对，这些映射被 Cargo 传递给编译器。当 `trim-paths` 为 `"none"` 时为空。构建脚本可以将这些映射转发给 C/C++ 编译器和其他工具，例如通过 `cc`'s `-ffile-prefix-map` 选项，以与构建的其他部分保持一致地清理路径。


## 用于 `cargo test` 的 Cargo 设置环境变量

在运行测试时，Cargo 会设置多个环境变量。你可以在测试运行时获取这些值：

```rust,ignore
use std::env;
let out_dir = env::var("CARGO_BIN_EXE_foo").unwrap();
```

* `CARGO_BIN_EXE_<name>` --- 二进制目标可执行文件的绝对路径。此变量仅在运行[集成测试]或基准测试时设置。`<name>`是二进制目标的名称，保持原样。例如，对于名为 `my-program` 的二进制文件，其值为 `CARGO_BIN_EXE_my-program`。除非二进制具有未启用的必需功能，否则在构建测试时会自动生成该二进制文件。

## Cargo 为第三方子命令设置的环境变量

Cargo 会将此环境变量暴露给位于 `$PATH` 中的第三方子命令（例如名为 `cargo-foobar` 的程序）：

* `CARGO` --- 执行构建的 `cargo` 二进制文件的路径。
* `CARGO_MAKEFLAGS` --- 包含用于 Cargo [jobserver] 实现以并行处理子进程所需的参数。此变量仅在 Cargo 检测到 jobserver 存在时设置。

如需获取关于您环境的更多详细信息，可以运行 `cargo metadata`。

[`cargo doc`]: ../commands/cargo-doc.md
[`cargo install`]: ../commands/cargo-install.md
[`cargo new`]: ../commands/cargo-new.md
[`cargo rustc`]: ../commands/cargo-rustc.md
[`cargo rustdoc`]: ../commands/cargo-rustdoc.md
[config-env]: config.md#environment-variables
[crates.io]: https://crates.io/
[incremental compilation]: profiles.md#incremental
[`alias`]: config.md#alias
[`build.warnings`]: config.md#buildwarnings
[`build.jobs`]: config.md#buildjobs
[`build.rustc`]: config.md#buildrustc
[`build.rustc-wrapper`]: config.md#buildrustc-wrapper
[`build.rustc-workspace-wrapper`]: config.md#buildrustc-workspace-wrapper
[`build.rustdoc`]: config.md#buildrustdoc
[`build.target`]: config.md#buildtarget
[`build.target-dir`]: config.md#buildtarget-dir
[`build.build-dir`]: config.md#buildbuild-dir
[`build.profile`]: config.md#buildprofile
[`build.rustflags`]: config.md#buildrustflags
[`build.rustdocflags`]: config.md#buildrustdocflags
[`build.incremental`]: config.md#buildincremental
[`build.dep-info-basedir`]: config.md#builddep-info-basedir
[`credential-alias`]: config.md#credential-alias
[`doc.browser`]: config.md#docbrowser
[`cache.auto-clean-frequency`]: config.md#cacheauto-clean-frequency
[`cargo-new.name`]: config.md#cargo-newname
[`cargo-new.email`]: config.md#cargo-newemail
[`cargo-new.vcs`]: config.md#cargo-newvcs
[`future-incompat-report.frequency`]: config.md#future-incompat-reportfrequency
[`http.debug`]: config.md#httpdebug
[`http.proxy`]: config.md#httpproxy
[`http.timeout`]: config.md#httptimeout
[`http.cainfo`]: config.md#httpcainfo
[`http.proxy-cainfo`]: config.md#httpproxy-cainfo
[`http.check-revoke`]: config.md#httpcheck-revoke
[`http.ssl-version`]: config.md#httpssl-version
[`http.low-speed-limit`]: config.md#httplow-speed-limit
[`http.multiplexing`]: config.md#httpmultiplexing
[`http.user-agent`]: config.md#httpuser-agent
[`install.root`]: config.md#installroot
[`install.profile`]: config.md#installprofile
[`net.retry`]: config.md#netretry
[`net.git-fetch-with-cli`]: config.md#netgit-fetch-with-cli
[`net.offline`]: config.md#netoffline
[`profile.<name>.build-override`]: config.md#profilenamebuild-override
[`profile.<name>.codegen-units`]: config.md#profilenamecodegen-units
[`profile.<name>.debug`]: config.md#profilenamedebug
[`profile.<name>.debug-assertions`]: config.md#profilenamedebug-assertions
[`profile.<name>.incremental`]: config.md#profilenameincremental
[`profile.<name>.lto`]: config.md#profilenamelto
[`profile.<name>.overflow-checks`]: config.md#profilenameoverflow-checks
[`profile.<name>.opt-level`]: config.md#profilenameopt-level
[`profile.<name>.panic`]: config.md#profilenamepanic
[`profile.<name>.rpath`]: config.md#profilenamerpath
[`profile.<name>.split-debuginfo`]: config.md#profilenamesplit-debuginfo
[`profile.<name>.strip`]: config.md#profilenamestrip
[`resolver.lockfile-path`]: config.md#resolverlockfile-path
[`resolver.incompatible-rust-versions`]: config.md#resolverincompatible-rust-versions
[`resolver.incompatible-publish-age`]: config.md#resolverincompatible-publish-age
[`registries.<name>.credential-provider`]: config.md#registriesnamecredential-provider
[`registries.<name>.index`]: config.md#registriesnameindex
[`registries.<name>.min-publish-age`]: config.md#registriesnamemin-publish-age
[`registries.<name>.token`]: config.md#registriesnametoken
[`registries.crates-io.protocol`]: config.md#registriescrates-ioprotocol
[`registry.credential-provider`]: config.md#registrycredential-provider
[`registry.default`]: config.md#registrydefault
[`registry.global-credential-providers`]: config.md#registryglobal-credential-providers
[`registry.global-min-publish-age`]: config.md#registryglobal-min-publish-age
[`registry.min-publish-age`]: config.md#registrymin-publish-age
[`registry.token`]: config.md#registrytoken
[`target.<tuple>.linker`]: config.md#targettuplelinker
[`target.<tuple>.runner`]: config.md#targettuplerunner
[`target.<tuple>.rustflags`]: config.md#targettuplerustflags
[`target.<tuple>.rustdocflags`]: config.md#targettuplerustdocflags
[`term.quiet`]: config.md#termquiet
[`term.verbose`]: config.md#termverbose
[`term.color`]: config.md#termcolor
[`term.hyperlinks`]: config.md#termhyperlinks
[`term.unicode`]: config.md#termunicode
[`term.progress.when`]: config.md#termprogresswhen
[`term.progress.width`]: config.md#termprogresswidth
[`term.progress.term-integration`]: config.md#termprogressterm-integration
[Cargo target]: cargo-targets.md
[binaries]: cargo-targets.md#binaries
[examples]: cargo-targets.md#examples
[integration test]: cargo-targets.md#integration-tests
[`env` macro]: ../../std/macro.env.html
[`tracing`]: https://docs.rs/tracing
[debug logging]: https://doc.crates.io/contrib/implementation/debugging.html#logging
[unix-like platforms]: ../../reference/conditional-compilation.html#unix-and-windows
[windows-like platforms]: ../../reference/conditional-compilation.html#unix-and-windows
[target family]: ../../reference/conditional-compilation.html#target_family
[target operating system]: ../../reference/conditional-compilation.html#target_os
[target architecture]: ../../reference/conditional-compilation.html#target_arch
[target vendor]: ../../reference/conditional-compilation.html#target_vendor
[target environment]: ../../reference/conditional-compilation.html#target_env
[target ABI]: ../../reference/conditional-compilation.html#target_abi
[pointer width]: ../../reference/conditional-compilation.html#target_pointer_width
[target endianness]: ../../reference/conditional-compilation.html#target_endian
[target features]: ../../reference/conditional-compilation.html#target_feature
[links]: build-scripts.md#the-links-manifest-key
[configuration]: ../../reference/conditional-compilation.html
[jobserver]: https://www.gnu.org/software/make/manual/html_node/Job-Slots.html
[cargo-config]: config.md
[Target Tuple]: ../appendix/glossary.md#target
[variables set for crates]: #environment-variables-cargo-sets-for-crates
[profile]: profiles.md
[`dev`]: profiles.md#dev
[`release`]: profiles.md#release
[`debug`]: profiles.md#debug
[`opt-level`]: profiles.md#opt-level
[`trim-paths`]: profiles.md#trim-paths
[`build-rs`]: https://crates.io/crates/build-rs
