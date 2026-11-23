# 构建脚本

某些包需要编译第三方非 Rust 代码，例如 C 库。其他包则需要链接到位于系统上的或需要从源代码构建的 C 库。还有一些包在构建前还需要功能支持，如代码生成（例如解析器生成器）。

Cargo 并不旨在取代那些针对这些任务优化良好的其他工具，而是通过自定义构建脚本与它们集成。如果在包的根目录中放置名为 `build.rs` 的文件，Cargo 将会编译该脚本，并在构建包之前执行它。

```rust,ignore
// Example custom build script.
fn main() {
    // Tell Cargo that if the given file changes, to rerun this build script.
    println!("cargo::rerun-if-changed=src/hello.c");
    // Use the `cc` crate to build a C file and statically link it.
    cc::Build::new()
        .file("src/hello.c")
        .compile("hello");
}
```

构建脚本的一些示例用途包括：

* 构建捆绑的 C 库。
* 在主机系统上查找 C 库。
* 根据规范生成 Rust 模块。
* 执行 crate 所需的任何平台特定配置。

以下章节描述了构建脚本的工作原理，[示例章节](build-script-examples.md)展示了多种编写脚本的方法。

> [!NOTE]
> `package.build` 清单键（[清单.md#the-build-field]）可用于更改构建脚本的名称，或完全禁用它。

## 构建脚本的生命周期

在包构建之前，Cargo 会将构建脚本编译成可执行文件（如果尚未构建）。然后运行该脚本，它可能执行多种任务。脚本可以通过向标准输出打印以 `cargo::` 开头的特殊格式命令与 Cargo 通信。

如果构建脚本的任何源文件或依赖项发生变化，则会对构建脚本进行重新编译。

默认情况下，如果包中的任何文件发生变化，Cargo 将重新运行构建脚本。通常最好使用 `[change-detection](#change-detection)` 部分中描述的 `rerun-if` 命令来限定触发构建脚本再次运行的条件。

一旦构建脚本成功执行完毕，包的其余部分将会被编译。如果发生错误，脚本应以非零退出码结束以停止构建，此时构建脚本的输出将显示在终端上。

## 构建脚本的输入参数

当运行构建脚本时，有若干输入参数通过[环境变量][build-env]的形式传递给脚本。

除了环境变量之外，构建脚本的当前目录也是该脚本包的根目录。


> [!WARNING]
> 在构建脚本中检查`target_os`或`target_arch`等[配置选项]时，不要使用`cfg!`宏或 `#[cfg]`属性，因为这些检查的是**主机**机器（即构建脚本运行的位置），而非你正在编译的**目标**平台。这种区别在交叉编译时非常重要。
>
> 相反，应读取相应的 [`CARGO_CFG_*`][build-env]环境变量，这些变量能准确反映目标的配置情况。对于有类型化的 API，可以考虑使用 [`build-rs`] crate。更多细节请参见[构建脚本示例]。


## 构建脚本的输出结果

构建脚本可以在[$OUT_DIR环境变量][build-env]指定的目录中保存任何输出文件或中间产物。脚本不应修改该目录之外的任何文件。

> [!IMPORTANT]
> Cargo不会在构建之间清理或重置`OUT_DIR`。即使重新运行构建脚本，该目录中的内容仍可能保留下来。这种行为是为了支持增量构建，例如原生代码编译。
>
>构建脚本不应依赖`OUT_DIR`为空，因为其内容可能在多次重建后仍然存在。如果脚本需要一个干净的目录，则必须自行管理或清理其创建的任何文件或子目录。关于这方面的未来改进正在讨论中（参见 [#16427](https://github.com/rust-lang/cargo/issues/16427)和 [#9661](https://github.com/rust-lang/cargo/issues/9661)）。

构建脚本通过向标准输出（stdout）打印信息来与 Cargo 通信。Cargo 会将以 `cargo::` 开头的每一行视为指令，这些指令将影响包的编译过程。其他所有行均被忽略。

> 构建脚本中打印的 `cargo::` 指令的顺序*可能*会影响 `cargo` 传递给 `rustc` 的参数顺序，进而可能影响 `rustc` 传递给链接器的参数顺序。因此，您需要注意构建脚本指令的顺序。例如，如果对象 `foo` 需要链接库 `bar`，您应确保库 `bar` 的 [`cargo::rustc-link-lib`](#rustc-link-lib) 指令出现在链接对象 `foo` 的指令之后。

在正常编译过程中，脚本的输出会被隐藏在终端中。如果您希望直接在终端中查看输出，请使用 `-vv` 标志以“非常详细”模式运行 Cargo。这仅在运行构建脚本时生效。如果 Cargo 确定没有变化，它不会重新运行脚本，有关更多信息请参阅下面的[变化检测](#change-detection)。

构建脚本向标准输出打印的所有行都会被写入文件 `target/debug/build/<pkg>/output`（具体位置取决于您的配置）。错误输出也会保存在同一目录中。

以下是 Cargo 识别的指令摘要，每个指令都在下方有详细说明。

* [`cargo::rerun-if-changed=PATH`](#rerun-if-changed) --- 指示 Cargo 何时重新运行脚本。
* [`cargo::rerun-if-env-changed=VAR`](#rerun-if-env-changed) --- 指示 Cargo 何时重新运行脚本。
* [`cargo::rustc-link-arg=FLAG`](#rustc-link-arg) --- 向链接器传递自定义标志，用于基准测试、二进制文件、`cdylib` 库、示例和测试。
* [`cargo::rustc-link-arg-cdylib=FLAG`](#rustc-cdylib-link-arg) --- 向链接器传递自定义标志，用于 cdylib 库。
* [`cargo::rustc-link-arg-bin=BIN=FLAG`](#rustc-link-arg-bin) --- 向链接器传递自定义标志，用于二进制文件 `BIN`。
* [`cargo::rustc-link-arg-bins=FLAG`](#rustc-link-arg-bins) --- 向链接器传递自定义标志，用于二进制文件。
* [`cargo::rustc-link-arg-tests=FLAG`](#rustc-link-arg-tests) --- 向链接器传递自定义标志，用于测试。
* [`cargo::rustc-link-arg-examples=FLAG`](#rustc-link-arg-examples) --- 向链接器传递自定义标志，用于示例。
* [`cargo::rustc-link-arg-benches=FLAG`](#rustc-link-arg-benches) --- 向链接器传递自定义标志，用于基准测试。
* [`cargo::rustc-link-lib=LIB`](#rustc-link-lib) --- 添加要链接的库。
* [`cargo::rustc-link-search=[KIND=]PATH`](#rustc-link-search) --- 添加到库搜索路径中。
* [`cargo::rustc-flags=FLAGS`](#rustc-flags) --- 向编译器传递特定标志。
* [`cargo::rustc-cfg=KEY[="VALUE"]`](#rustc-cfg) --- 启用编译时 `cfg` 设置。
* [`cargo::rustc-check-cfg=CHECK_CFG`](#rustc-check-cfg) -- 将自定义 `cfg` 注册为编译时配置检查用。
* [`cargo::rustc-env=VAR=VALUE`](#rustc-env) --- 设置环境变量。
- [`cargo::error=MESSAGE`](#cargo-error) --- 在终端中显示错误。
* [`cargo::warning=MESSAGE`](#cargo-warning) --- 在终端中显示警告。
* [`cargo::metadata=KEY=VALUE`](#the-links-清单-key) --- 元数据，由 `links` 脚本使用。

> **MSRV:** 对于 `cargo::KEY=VALUE` 语法，需要 1.77 版本。为了支持旧版本，请使用 `cargo:KEY=VALUE` 语法。

### `cargo::rustc-link-arg=FLAG` {#rustc-link-arg}

`rustc-link-arg` 指令告诉 Cargo 将 [`-C link-arg=FLAG` 选项][link-arg] 传递给编译器，但仅在构建支持的目标时（如基准测试、二进制文件、`cdylib` 库、示例和测试）生效。其使用方式具有高度的平台依赖性。它适用于设置共享库版本或链接器脚本。


### `cargo::rustc-link-arg-cdylib=FLAG` {#rustc-cdylib-link-arg}

`rustc-link-arg-cdylib` 指令告诉 Cargo 将 [`-C link-arg=FLAG` 选项][link-arg] 传递给编译器，但仅在构建 `cdylib` 库目标时生效。其使用方式具有高度的平台依赖性。它适用于设置共享库版本或运行时路径。

由于历史原因，`cargo::rustc-cdylib-link-arg` 形式实际上是 `cargo::rustc-link-arg-cdylib` 的别名，且含义相同。

### `cargo::rustc-link-arg-bin=BIN=FLAG` {#rustc-link-arg-bin}

`rustc-link-arg-bin` 指令告诉 Cargo 将 [`-C link-arg=FLAG` 选项][link-arg] 传递给编译器，但仅在构建名为 `BIN` 的二进制目标时生效。其使用方式具有高度的平台依赖性。它适用于设置链接器脚本或其他链接器选项。

### `cargo::rustc-link-arg-bins=FLAG` {#rustc-link-arg-bins}

`rustc-link-arg-bins` 指令告诉 Cargo 将 [`-C link-arg=FLAG` 选项][link-arg] 传递给编译器，但仅在构建二进制目标时生效。其使用方式具有高度的平台依赖性。它适用于设置链接器脚本或其他链接器选项。

### `cargo::rustc-link-arg-tests=FLAG` {#rustc-link-arg-tests}

`rustc-link-arg-tests` 指令告诉 Cargo 将 [`-C link-arg=FLAG` 选项][link-arg] 传递给编译器，但仅在构建测试目标时生效。

### `cargo::rustc-link-arg-examples=FLAG` {#rustc-link-arg-examples}

`rustc-link-arg-examples` 指令告诉 Cargo 将 [`-C link-arg=FLAG` 选项][link-arg] 传递给编译器，但仅在构建示例目标时生效。

### `cargo::rustc-link-arg-benches=FLAG` {#rustc-link-arg-benches}

`rustc-link-arg-benches`指令告诉 Cargo 在构建基准测试目标时传递 [`-C link-arg=FLAG` 选项][link-arg]，但仅在此情况下生效。

### `cargo::rustc-link-lib=LIB` {#rustc-link-lib}

`rustc-link-lib`指令告诉 Cargo 使用编译器的 [`-l` 标志][option-link]来链接给定的库。这通常用于通过 [FFI] 链接原生库。

`LIB` 字符串直接传递给 rustc，因此支持与 `-l` 相同的语法。目前 `LIB` 完全支持的语法为 `[KIND[:MODIFIERS]=]NAME[:RENAME]`。

`-l` 标志仅传递给包的库目标，除非没有库目标，此时则传递给所有目标。这样做是因为其他所有目标都隐含依赖于该库目标，而要链接的库应只被包含一次。这意味着如果一个包同时有库目标和二进制目标，*库*可以访问给定库的符号，而二进制应通过库目标的公共 API 访问这些符号。

可选的 `KIND` 可以是 `dylib`、`static` 或 `framework`。更多细节请参阅 [rustc 手册][option-link]。


### `cargo::rustc-link-search=[KIND=]PATH` {#rustc-link-search}

`rustc-link-search`指令告诉 Cargo 传递 [`-L 标志][option-search]` 给编译器，以将目录添加到库搜索路径中。

可选的 `KIND` 可以是 `dependency`、`crate`、`native`、`framework` 或 `all`。更多细节请参阅 [rustc 手册][option-search]。

如果这些路径位于 `OUT_DIR` 内，它们也会被添加到 [动态库搜索路径环境变量](environment-variables.md#dynamic-library-paths)中。由于这种行为使得生成的二进制文件使用起来困难，因此不推荐这样做。通常最好避免在构建脚本中创建动态库（使用现有的系统库即可）。


### `cargo::rustc-flags=FLAGS` {#rustc-flags}

`rustc-flags` 指令告诉 Cargo 将给定的空格分隔的标志传递给编译器。这仅允许使用 `-l` 和 `-L` 标志，相当于使用 [`rustc-link-lib`](#rustc-link-lib) 和 [`rustc-link-search`](#rustc-link-search)。

### `cargo::rustc-cfg=KEY[="VALUE"]` {#rustc-cfg}

`rustc-cfg` 指令告诉 Cargo 将给定值传递给编译器的 [`--cfg` flag][option-cfg]。这可用于在编译时检测特性以启用 [条件编译]。自定义 cfgs 必须通过使用 [`cargo::rustc-check-cfg`](#rustc-check-cfg) 指令来预期，否则需要允许 [`unexpected_cfgs`][unexpected-cfgs] lint 以避免意外的 cfgs 警告。

请注意，这*不会*影响 Cargo 的依赖项解析。不能用来启用可选依赖项或启用其他 Cargo 特性。

需要注意的是，[Cargo 特性]使用 `feature="foo"` 的形式。通过此标志传递的 `cfg` 值不限于该形式，可以提供一个单一标识符，也可以是任意键值对。例如，发出 `cargo::rustc-cfg=abc` 后，代码就可以使用 `#[cfg(abc)]`（注意没有 `feature=`）。或者可以使用 `=` 符号的任意键值对，如 `cargo::rustc-cfg=my_component="foo"`。键应该是 Rust 标识符，值应该是字符串。


### `cargo::rustc-check-cfg=CHECK_CFG` {#rustc-check-cfg}

将其添加到预期配置名称及值的列表中，用于使用 [`unexpected_cfgs`][unexpected-cfgs] lint 检查 _reachable_ cfg 表达式。

`CHECK_CFG` 的语法与 `rustc` 的 [`--check-cfg` flag][option-check-cfg] 相同，更多细节请参见 [检查条件配置][checking-conditional-configurations]。

该指令可以如下使用：

```rust,no_run
// build.rs
println!("cargo::rustc-check-cfg=cfg(foo, values(\"bar\"))");
if foo_bar_condition {
    println!("cargo::rustc-cfg=foo=\"bar\"");
}
```

请注意，无论当前启用了哪些配置选项，所有可能的配置选项都应被定义。这包括给定配置选项的所有可能值。

建议将 `cargo::rustc-check-cfg` 和 [`cargo::rustc-cfg`][option-cfg] 指令尽可能紧密地组合在一起，以避免拼写错误、缺少检查或过时的配置选项等问题...

另请参阅 [条件编译][conditional-compilation-example] 示例。

> **MSRV:** 在 1.80 版本中受尊重


### `cargo::rustc-env=VAR=VALUE` {#rustc-env}

`rustc-env` 指令告诉 Cargo 在编译包时设置给定的环境变量。该值随后可以通过编译后的 crate 中的 [`env!` 宏][env-宏] 获取。这适用于在 crate 代码中包含额外元数据，例如 git HEAD 的哈希值或持续集成服务器的唯一标识符。

另请参阅 [由 Cargo 自动包含的环境变量][env-cargo]。

> [!NOTE]
> 当使用 `cargo run` 或 `cargo test` 运行可执行文件时，这些环境变量也会被设置。然而，这种用法并不推荐，因为它将可执行文件与 Cargo 的执行环境绑定在一起。通常，这些环境变量应在编译时使用 `env!` 宏仅在编译时检查。


### `cargo::error=MESSAGE` {#cargo-error}

`error` 指令告诉 Cargo 在构建脚本运行完成后显示错误，然后导致构建失败。

 > [!NOTE]
 > 构建脚本库应仔细考虑是否使用 `cargo::error` 或返回 `Result`。返回 `Result` 可能更好，并允许调用者决定错误是否为致命错误。然后调用者可以使用 `cargo::error` 来决定是否显示 `Err` 变体。

> **MSRV:** 在 1.84 版本中受尊重

### `cargo::warning=MESSAGE` {#cargo-warning}

`warning` 指令指示 Cargo 在构建脚本运行完成后显示警告。仅对于 `path` 依赖项（即你在本地工作的那些）会显示警告，因此例如 [crates.io] crates 中打印的警告不会默认被发出，除非构建失败。可以使用 `-vv"非常详细"` 标志让 Cargo 为所有 crates 显示警告。

## 构建依赖项

构建脚本也可以依赖于其他基于 Cargo 的 crates。通过清单中的 `build-dependencies` 部分可以声明这些依赖项。

```toml
[build-dependencies]
cc = "1.0.46"
```

构建脚本**无法**访问 `dependencies` 或 `dev-dependencies` 部分中列出的依赖项（因为它们尚未被构建！）。此外，除非在 `[dependencies]` 表中明确添加，否则构建依赖项对包本身也是不可用的。

建议仔细考虑每个添加的依赖项，权衡其对编译时间、许可、维护等方面的影响。如果某个依赖项同时用于构建依赖项和普通依赖项，Cargo 会尝试复用该依赖项。然而，在跨平台编译等情况下这并不总是可能，因此需考虑对编译时间的影响。

## 变更检测

当重建一个包时，Cargo 不一定知道是否需要再次运行构建脚本。默认情况下，如果包中的任何文件发生变化（或 [`exclude` 和 `include` 字段控制的文件列表）发生变化，则采取保守的做法始终重新运行构建脚本。对于大多数情况，这不是一个好的选择，因此建议每个构建脚本至少包含一个 `rerun-if` 指令。如果这些指令被发出，那么 Cargo 仅在给定值发生变化时才会重新运行脚本。如果 Cargo 正在重新运行您自己的 crate 或依赖项的构建脚本，而您不知道原因，请参阅 ["为什么 Cargo 在重建我的代码？" FAQ](../faq.md#why-is-cargo-rebuilding-my-code)。


### `cargo::rerun-if-changed=PATH` {#rerun-if-changed}

`rerun-if-changed` 指令指示 Cargo 在指定路径下的文件发生变化时重新运行构建脚本。目前，Cargo 仅使用文件系统的 last-modified "mtime" 时间戳来判断文件是否发生变化，该时间戳与构建脚本上次运行时的内部缓存时间进行比较。

如果路径指向一个目录，它将扫描整个目录以查找任何修改。

如果构建脚本在任何情况下都不需要重新运行，那么设置 `cargo::rerun-if-changed=build.rs` 是防止其被重新运行的简单方法（否则，如果没有设置 `rerun-if` 指令，默认行为就是扫描整个包目录以查找变化）。Cargo 会自动处理脚本本身是否需要重新编译，当然在重新编译后脚本也会再次运行。否则，指定 `build.rs` 是多余且不必要的。

### `cargo::rerun-if-env-changed=NAME` {#rerun-if-env-changed}

`rerun-if-env-changed` 指令指示 Cargo 在给定名称的环境变量值发生变化时重新运行构建脚本。

请注意，这里的环境变量适用于全局环境变量，如 `CC` 等，无法用于 [Cargo 为构建脚本设置的] `TARGET` 这类环境变量。使用的环境变量是 `cargo` 调用时接收的，而不是构建脚本可执行文件接收的。

从 1.46 版本开始，在源代码中使用 [`env!`][env-宏] 和 [`option_env!")[option-env-macro] 将自动检测变化并触发重新编译。`rerun-if-env-changed` 对于已被这些宏引用的变量不再需要。


## `links` 清单键

在 `Cargo.toml` 清单中可以设置 `package.links` 键，以声明该包与给定的原生库关联。此清单键的目的是让 Cargo 了解某个包所拥有的原生依赖项集合，同时提供一种规范化的机制来在包构建脚本之间传递元数据。

```toml
[package]
# ...
links = "foo"
```

该清单表明该包链接到 `libfoo` 原生库。当使用 `links` 键时，该包必须拥有构建脚本，且构建脚本应使用 [`rustc-link-lib` 指令](#rustc-link-lib)来链接该库。

主要要求是每个 `links` 值最多只能有一个包。换句话说，禁止有两个包链接到同一个原生库。这有助于避免不同 crate 之间出现重复的符号。不过请注意，有[相关约定](#-sys-packages)可以解决这一问题。

构建脚本可以生成以键值对形式存在的任意一组元数据。这些元数据通过 `cargo::metadata=KEY=VALUE` 指令设置。

元数据会被传递给**依赖**包的构建脚本。例如，如果包 `foo` 依赖于 `bar`，而 `bar` 又链接了 `baz`，那么如果 `bar` 在其构建脚本元数据中生成了 `key=value`，则 `foo` 的构建脚本将拥有环境变量 `DEP_BAZ_KEY=value`（注意 `key` 的大小写变化由 `links` 键的值决定）。参见["使用其他 `sys` crate"][using-another-sys]了解其用法示例。

请注意，元数据仅传递给直接依赖项，而非间接依赖项。

> **MSRV:** 需要满足 `cargo::metadata=KEY=VALUE` 的 1.77 版本要求。为了支持旧版本，应使用 `cargo:KEY=VALUE`（不支持的指令被视为元数据键）。


## `*-sys` 包

一些链接到系统库的 Cargo 包采用 `-sys` 后缀命名规范。任何名为 `foo-sys` 的包应提供两个主要功能模块：

* 库 crate 应链接到原生库 `libfoo`。通常会在从源代码构建之前，先探测当前系统是否存在 `libfoo` 才进行构建。
* 库 crate 应为 `libfoo` 中的类型和函数提供 **声明**，但**不**提供高级抽象。

`*-sys` 包集合为链接到原生库提供了共同的依赖项。采用这种原生库相关包的惯例可以带来许多好处：

* 对 `foo-sys` 的常见依赖减少了每个 `links` 值对应一个包的规则。
* 其他 `-sys` 包可以利用 `DEP_LINKS_KEY=value` 环境变量更好地与其他包集成。参见 ["使用另一个 `sys` crate"][using-another-sys] 示例。
* 常见的依赖使得发现 `libfoo` 本身（或从源代码构建它）的逻辑可以集中处理。
* 这些依赖很容易进行 [覆盖](#overriding-build-scripts)。

通常会有不带 `-sys` 后缀的配套包，它在 sys 包之上提供安全的高级抽象。例如，[`git2` crate] 为 [`libgit2-sys` crate] 提供了高级接口。


## 覆盖构建脚本

如果清单中包含 `links` 键，则 Cargo 支持通过自定义库覆盖指定的构建脚本。此功能的目的是防止完全运行该构建脚本，而是提前提供元数据。

要覆盖构建脚本，请将以下配置放入任何可用的 [`config.toml`](config.md) 文件中。

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

使用此配置，如果包声明其链接到 `foo`，则**不会**编译或运行构建脚本，而是使用指定的元数据。

不应使用 `warning`、`rerun-if-changed` 和 `rerun-if-env-changed` 键，它们将被忽略。

## Jobserver

Cargo 和 `rustc` 使用为 GNU make 开发的 [jobserver 协议] 来协调进程间的并发性。它本质上是一个信号量，用于控制同时运行的任务数量。通过 `--jobs` 标志可以设置并发数，默认值为逻辑 CPU 的数量。

每个构建脚本从 Cargo 继承一个任务槽位，在运行时应尽量只使用一个 CPU。如果脚本希望并行使用更多 CPU，则应使用 [`jobserver` crate] 与 Cargo 进行协调。

例如，`[cc` crate] 可能启用可选的 `parallel` 特性，该特性将使用 jobserver 协议尝试同时构建多个 C 文件。

[build-env]: environment-variables.md#environment-variables-cargo-sets-for-build-scripts
[configuration options]: ../../reference/conditional-compilation.html
[`build-rs`]: https://crates.io/crates/build-rs
[build script examples]: build-script-examples.md#conditional-compilation
[link-arg]: ../../rustc/codegen-options/index.md#link-arg
[option-link]: ../../rustc/command-line-arguments.md#option-l-link-lib
[FFI]: ../../nomicon/ffi.md
[option-search]: ../../rustc/command-line-arguments.md#option-l-search-path
[cargo features]: features.md
[conditional compilation]: ../../reference/conditional-compilation.md
[option-cfg]: ../../rustc/command-line-arguments.md#option-cfg
[unexpected-cfgs]: ../../rustc/lints/listing/warn-by-default.md#unexpected-cfgs
[checking-conditional-configurations]: ../../rustc/check-cfg.html
[option-check-cfg]: ../../rustc/command-line-arguments.md#option-check-cfg
[conditional-compilation-example]: build-script-examples.md#conditional-compilation
[env-macro]: ../../std/macro.env.html
[env-cargo]: environment-variables.md#environment-variables-cargo-sets-for-crates
[`exclude` and `include` fields]: manifest.md#the-exclude-and-include-fields
[option-env-macro]: ../../std/macro.option_env.html
[using-another-sys]: build-script-examples.md#using-another-sys-crate
[`git2` crate]: https://crates.io/crates/git2
[`libgit2-sys` crate]: https://crates.io/crates/libgit2-sys
[`cc` crate]: https://crates.io/crates/cc
[`jobserver` crate]: https://crates.io/crates/jobserver
[jobserver protocol]: http://make.mad-scientist.net/papers/jobserver-implementation/
[crates.io]: https://crates.io/
