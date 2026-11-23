# 清单格式

每个包的 `Cargo.toml` 文件被称为其 *清单*。它采用 [TOML] 格式编写，包含用于编译该包的元数据。关于 cargo 如何找到清单文件的更多细节，请查看 `cargo locate-project` 部分。

每个清单文件由以下部分组成：

* [`cargo-features`](unstable.md) --- 不稳定的、仅适用于夜间的功能。
* [`[package]`](#the-包-section) --- 定义一个包。
* [`name`](#the-name-field) --- 包的名称。
* [`version`](#the-version-field) --- 包的版本号。
* [`authors`](#the-authors-field) --- 包的作者（已弃用）。
* [`edition`](#the-edition-field) --- Rust 版本号。
* [`rust-version`](rust-version.md) --- 支持的最低 Rust 版本。
* [`description`](#the-description-field) --- 包的描述信息。
* [`documentation`](#the-documentation-field) --- 包文档的 URL。
* [`readme`](#the-readme-field) --- 包 README 文件的路径。
* [`homepage`](#the-homepage-field) --- 包主页的 URL。
* [`repository`](#the-repository-field) --- 包源代码仓库的 URL。
* [`license`](#the-license-and-license-file-fields) --- 包的许可证。
* [`license-file`](#the-license-and-license-file-fields) --- 许可证文本的路径。
* [`keywords`](#the-keywords-field) --- 包的关键词。
* [`categories`](#the-categories-field) --- 包的分类。
* [`workspace`](#the-工作区-field) --- 包的工作空间路径。
* [`build`](#the-build-field) --- 包构建脚本的路径。
* [`links`](#the-links-field) --- 包所链接的原生库名称。
* [`exclude`](#the-exclude-and-include-fields) --- 发布时要排除的文件。
* [`include`](#the-exclude-and-include-fields) --- 发布时要包含的文件。
* [`publish`](#the-publish-field) --- 用于阻止包发布的选项。
* [`metadata`](#the-metadata-table) --- 外部工具的额外设置。
* [`default-run`](#the-default-run-field) --- 由 [`cargo run`]执行的默认二进制文件。
* [`autolib`](cargo-targets.md#目标-auto-discovery) --- 禁用库自动发现功能。
* [`autobins`](cargo-targets.md#目标-auto-discovery) --- 禁用二进制文件自动发现功能。
* [`autoexamples`](cargo-targets.md#目标-auto-discovery) --- 禁用示例自动发现功能。
* [`autotests`](cargo-targets.md#目标-auto-discovery) --- 禁用测试自动发现功能。
* [`autobenches`](cargo-targets.md#目标-auto-discovery) --- 禁用基准测试自动发现功能。
* [`resolver`](resolver.md#resolver-versions) --- 设置要使用的依赖解析器。
* 目标表： (参见 [配置](cargo-targets.md#configuring-a-目标) 了解设置信息) * [`[lib]`](cargo-targets.md#library) --- 库目标设置。
* [`[[bin]]`](cargo-targets.md#binaries) --- 二进制目标设置。
* [`[[example]]`](cargo-targets.md#examples) --- 示例目标设置。
* [`[[test]]`](cargo-targets.md#tests) --- 测试目标设置。
* [`[[bench]]`](cargo-targets.md#benchmarks) --- 基准测试目标设置。
* 依赖表：
* [`[dependencies]`](specifying-dependencies.md) --- 包库依赖项。
* [`[dev-dependencies]`](specifying-dependencies.md#development-dependencies) --- 示例、测试和基准测试的依赖项。
* [`[build-dependencies]`](specifying-dependencies.md#build-dependencies) --- 构建脚本的依赖项。
* [`[target]`](specifying-dependencies.md#platform-specific-dependencies) --- 特定平台依赖项。
* [`[badges]`](#the-badges-section) --- 在注册表上显示的徽章。
* [`[features]`](features.md) --- 条件编译功能。
* [`[lints]`](#the-lints-section) --- 配置此包的 linter。
* [`[hints]`](#the-hints-section) --- 提供编译此包的提示信息。
* [`[patch]`](overriding-dependencies.md#the-patch-section) --- 覆盖依赖项。
* [`[replace]`](overriding-dependencies.md#the-replace-section) --- 覆盖依赖项（已弃用）。
* [`[profile]`](profiles.md) --- 编译器设置和优化选项。
* [`[workspace]`](workspaces.md) --- 工作空间定义。

## `[package]` 部分

`Cargo.toml` 中的第一个部分是 `[package]`。

```toml
[package]
name = "hello_world" # the name of the package
version = "0.1.0"    # the current version, obeying semver
```

Cargo 要求的唯一字段是 [`name`](#the-name-field)。如果发布到注册表，注册表可能要求额外的字段。请参阅下面的注释和 [发布章节][publishing] 以了解发布到 [crates.io] 的要求。

### `name` 字段

包名是一个用于指代该包的标识符。它在另一个包中作为依赖项列出时使用，也是推断出的 lib 和 bin 目标的默认名称。

名称只能使用 [字母数字] 字符、`-` 或 `_`，且不能为空。

请注意，`[cargo new]` 和 `[cargo init]` 对包名有一些额外的限制，例如要求它是有效的 Rust 标识符而非关键字。[crates.io] 则施加了更严格的限制，例如：

- 仅允许使用 ASCII 字符。
- 不要使用保留名称。
- 不要使用特殊的 Windows 名称，如“nul”。
- 长度最多为 64 个字符。


### `version` 字段

`version` 字段按照 [SemVer] 规范进行格式化：

版本必须包含三个数字部分：主版本、次版本和补丁版本。

可以在破折号后添加预发布部分，例如 `1.0.0-alpha`。预发布部分可以用点分隔，以区分不同的组件。数字组件将使用数值比较，而其他所有内容则按字典顺序比较。例如，`1.0.0-alpha.11` 高于 `1.0.0-alpha.4`。

可以在加号后添加元数据部分，例如 `1.0.0+21AF26D3`。这仅用于提供信息，通常被 Cargo 忽略。

Cargo 内置了 [语义版本控制](https://semver.org/) 的概念，因此如果最左边的非零主版本/次版本/补丁组件相同，则版本被视为[兼容](semver.md)。有关 Cargo 如何使用版本来解析依赖项的更多信息，请参阅 [Resolver] 章节。

此字段为可选，默认值为 `0.0.0`。在发布包时，该字段是必需的。

> **MSRV:** 在 1.75 之前，此字段是必填项。


### `authors` 字段

> [!IMPORTANT]
> 此字段已弃用。

可选的 `authors` 字段以数组形式列出被视为该包“作者”的人员或组织。每个作者的条目末尾可以包含位于尖括号中的可选电子邮件地址。

```toml
[package]
# ...
authors = ["Graydon Hoare", "Fnu Lnu <no-reply@rust-lang.org>"]
```

为了向后兼容，此字段在包元数据以及 `build.rs` 中的 `CARGO_PKG_AUTHORS` 环境变量中都有呈现。

### `edition` 字段

`edition` 键是一个可选键，它决定了您的包编译使用的 [Rust Edition] 版本。在 `[package]` 中设置 `edition` 键将影响该包中的所有目标/crates，包括测试套件、基准测试、二进制文件、示例等。

```toml
[package]
# ...
edition = "2024"
```

大多数清单中的 `edition` 字段由 [`cargo new`] 自动填充为最新稳定版。默认情况下，`cargo new` 创建的清单采用当前 2024 版。

如果 `Cargo.toml` 中不存在 `edition` 字段，则出于向后兼容考虑，假定使用 2015 版。请注意，所有由 [`cargo new`] 创建의清单不会使用这种历史回退方式，因为它们会明确指定为更新的 `edition` 值。

### `rust-version` 字段

`rust-version` 字段告诉 cargo 您的包支持哪种 Rust 工具链版本。更多细节请参见 [Rust 版本章节](rust-version.md)。

### `description` 字段

描述是关于该包的简短说明。[crates.io] 会在您的包上显示此内容。它应为纯文本（非 Markdown）。

```toml
[package]
# ...
description = "A short description of my package"
```

> [!NOTE]
> [crates.io] 要求设置 `description` 字段。

### `documentation` 字段

`documentation` 字段指定了托管该 crate 文档的网站 URL。如果清单文件中未指定 URL，当文档构建并可用后，[crates.io] 会自动将你的 crate 链接到相应的 [docs.rs] 页面（参见 [docs.rs queue]）。

```toml
[package]
# ...
documentation = "https://docs.rs/bitflags"
```


### `readme` 字段

`readme` 字段应是指向包根目录中文件路径的链接，该文件相对于此 `Cargo.toml` 包含关于该包的一般信息。当你发布时，此文件将被传输到注册表。[crates.io] 会将其解析为 Markdown 并在 crate 页面上显示。

```toml
[package]
# ...
readme = "README.md"
```

如果未指定此字段的值，且包根目录中存在名为 `README.md`、`README.txt` 或 `README` 的文件，则将使用该文件名。你可以通过将此字段设置为 `false` 来禁用此行为。如果设置该字段为 `true`，则默认值为 `README.md`。

### `homepage` 字段

`homepage` 字段应是指向该包主页网站的 URL。

```toml
[package]
# ...
homepage = "https://serde.rs"
```

只有在源仓库或 API 文档之外有专门的网站用于该 crate 时，才应设置 `homepage` 的值。不要让 `homepage` 与 `documentation` 或 `repository` 值重复。

### `repository` 字段

`repository` 字段应是指向该包源仓库的 URL。

```toml
[package]
# ...
repository = "https://github.com/rust-lang/cargo"
```

### `license` 和 `license-file` 字段

`license` 字段包含该包所依据的软件许可证名称。`license-file` 字段包含包含许可证文本的文件路径（相对于此 `Cargo.toml`）。

[crates.io] 将 `license` 字段解析为 [SPDX 2.3 许可证表达式][spdx-2.3-license-expressions]。该名称必须是 [SPDX 许可证列表 3.20][spdx-license-list-3.20]中的已知许可证。有关更多信息，请参见 [SPDX 网站]。

SPDX 许可证表达式支持 AND 和 OR 运算符，用于组合多个许可证。[^slash]

```toml
[package]
# ...
license = "MIT OR Apache-2.0"
```

使用 `OR` 表示用户可以选择任意一种许可证；使用 `AND` 表示用户必须同时遵守两种许可证；`WITH` 运算符则表示具有特殊例外情况的许可证。一些示例如下：

* `MIT OR Apache-2.0` * `LGPL-2.1-only AND MIT AND BSD-2-Clause` * `GPL-2.0-or-later WITH Bison-exception-2.2`

如果某个包使用非标准许可证，则可以在 `license-file` 字段中指定该文件，而不是在 `license` 字段中指定。

```toml
[package]
# ...
license-file = "LICENSE.txt"
```

> [!NOTE]
> [crates.io] 要求必须设置 `license` 或 `license-file` 字段之一。


### `keywords` 字段

`keywords` 字段是一个字符串数组，用于描述该包的特性。在注册表搜索该包时，这可能会有所帮助，您可以选择任何有助于他人找到此 crate 的词汇。

```toml
[package]
# ...
keywords = ["gamedev", "graphics"]
```

> [!NOTE]
> [crates.io] 允许最多设置 5 个关键词。每个关键词必须是 ASCII 文本，长度不超过 20 个字符，以字母或数字开头，且只能包含字母、数字、`_`、`-` 或 `+`。

### `categories` 字段

`categories` 字段是一个字符串数组，表示该包所属的类别。

```toml
categories = ["command-line-utilities", "development-tools::cargo-plugins"]
```

> [!NOTE]
> [crates.io] 最多允许设置 5 个类别。每个类别必须与 <https://crates.io/category_slugs> 上的字符串之一完全匹配。

### `workspace` 字段

`workspace` 字段用于配置该包所属的工作空间。如果未指定，则默认取文件系统中的第一个包含 `[workspace]` 的 Cargo.toml 文件。如果成员不是工作空间根目录下的子目录，设置此字段是有用的。

```toml
[package]
# ...
workspace = "path/to/workspace/root"
```

如果清单中已定义 `[workspace]` 表，则无法指定该字段。也就是说，一个 crate 不能同时是工作空间的根 crate（包含 `[workspace]`）和另一个工作空间的成员 crate（包含 `package.workspace`）。

有关更多信息，请参阅 [workspaces 章节](workspaces.md)。

### `build` 字段

`build` 字段指定了包根目录中的文件，该文件是用于构建原生代码的 [构建脚本]。更多相关信息可参阅 [构建脚本指南][build script]。


```toml
[package]
# ...
build = "build.rs"
```

默认值为 `"build.rs"`，它会从包根目录下的 `build.rs` 文件中加载该脚本。使用 `build = "custom_build_name.rs"` 可以指定不同的文件路径，或设置 `build = false` 以禁用自动检测构建脚本。

### `links` 字段

`links` 字段指定了要链接到的原生库名称。更多相关信息可参阅 [构建脚本指南][build script]的 [`links`][links]部分。


例如，一个链接了名为 "git2" 的原生库的 crate（例如在 Linux 上为 `libgit2.a`）可能会指定如下内容：

```toml
[package]
# ...
links = "git2"
```

### `exclude` 和 `include` 字段

`exclude` 和 `include` 字段可用于明确指定在打包用于 [发布][publishing] 的项目以及某些类型的变更跟踪时包含哪些文件。`exclude` 字段中指定的模式标识了不包含的文件集合，而 `include` 中的模式则指定了显式包含的文件。

```toml
[package]
# ...
exclude = ["/ci", "images/", ".*"]
```

```toml
[package]
# ...
include = ["/src", "COPYRIGHT", "/examples", "!/examples/big_example"]
```

> [!NOTE]
> 运行 [`cargo package --list`][`cargo package`] 可验证哪些文件将被包含在包中。

如果未指定任何字段，默认会包含包根目录中的所有文件，但排除下面列出的排除项。

如果未指定 `include`，则以下文件将被排除：

* 如果包不在 git 仓库中，以点开头的所有“隐藏”文件都会被跳过。
* 如果包在 git 仓库中，任何被仓库的 [gitignore] 规则和全局 git 配置忽略的文件也会被跳过。

如果指定了 `include`，则不会应用仓库的 gitignore 规则和全局 git 配置。

无论是否指定 `exclude` 或 `include`，以下文件始终会被排除：

* 所有子包将被跳过（包含 `Cargo.toml` 文件的任何子目录）。
* 包根目录中的 `target` 文件夹也将被跳过。

以下文件始终会被包含：

* 包本身的 `Cargo.toml` 文件始终会被包含，无需在 `include` 中列出。
* 自动包含最小化的 `Cargo.lock` 文件。更多详情请参见 [`cargo package`]。
* 如果指定了 [`license-file`](#the-license-and-license-file-fields)，则始终被包含。

选项是互斥的；设置 `include` 会覆盖 `exclude`。如果您需要对一组 `include` 文件进行排除，请使用下文中描述的 `!` 运算符。

模式应为 [gitignore] 风格的模式。简要说明如下：

- `foo` 匹配包中任何名为 `foo` 的文件或目录。这相当于模式 `**/foo`。
- `/foo` 匹配仅位于包根目录且名为 `foo` 的任何文件或目录。
- `foo/` 匹配包中任何名为 `foo` 的 *目录*。
- 支持常见的通配符模式，如 `*`、`?` 和 `[]`：
- `*` 匹配零个或多个字符，除了 `/`。例如，`*.html` 匹配包中任何带有 `.html` 扩展名的文件或目录。
- `?` 匹配除 `/` 外的任意字符。例如，`foo?` 匹配 `food`，但不匹配 `foo`。
- `[]` 允许匹配一系列字符。例如，`[ab]` 匹配 `a` 或 `b`。 `[a-z]` 匹配字母 a 到 z。
- `**/` 前缀在任何目录中匹配。例如，`**/foo/bar` 匹配位于目录 `foo` 下的任意 `bar` 文件或目录。
- `/**` 后缀匹配内部所有内容。例如，`foo/**` 匹配目录 `foo` 内的所有文件，包括 `foo` 下的所有子目录中的文件。
- `/**/` 匹配零个或多个目录。例如，`a/**/b` 匹配 `a/b`、`a/x/b`、`a/x/y/b` 等。
- `!` 前缀会否定模式。例如，模式 `src/*.rs` 和 `!foo.rs` 将匹配 `src` 目录中所有带有 `.rs` 扩展名的文件，但排除名为 `foo.rs` 的文件。

在某些情况下，包含/排除列表也用于变更跟踪。对于使用 `rustdoc` 构建的目标，它用于确定需要跟踪的文件列表，以判断目标是否应被重新构建。如果包有一个不输出任何 `rerun-if-*` 指令的 [构建脚本]，那么包含/排除列表将用于跟踪在这些文件发生变化时是否需要重新运行构建脚本。


### `publish` 字段

`publish` 字段可用于控制包可以发布到哪些注册表：
```toml
[package]
# ...
publish = ["some-registry-name"]
```

为了防止包误被发布到注册表（如 crates.io），例如将包在公司内设为私有，你可以省略 [`version`](#the-version-field) 字段。如果你希望更明确地指定，可以禁用发布功能：
```toml
[package]
# ...
publish = false
```

如果 publish 数组只包含一个注册表，当未指定 `--registry` 标志时，`cargo publish` 命令将使用该注册表。

### `metadata` 表

默认情况下，Cargo 会警告 `Cargo.toml` 中未使用的键，以帮助检测拼写错误等问题。然而，`package.metadata` 表完全被 Cargo 忽略，不会收到警告。此部分可用于那些希望将包配置存储在 `Cargo.toml` 中的工具。例如：

```toml
[package]
name = "..."
# ...

# Metadata used when generating an Android APK, for example.
[package.metadata.android]
package-name = "my-awesome-android-app"
assets = "path/to/static"
```

你需要查阅你工具的文档以了解如何使用该字段。对于使用 `package.metadata` 表的 Rust 项目，请参阅：- [docs.rs](https://docs.rs/about/metadata)

在工作区级别也有类似的表，位于 [`workspace.metadata`][工作区-metadata] 处。虽然 cargo 没有指定这两个表的格式，但建议外部工具以一致的方式使用它们，例如如果 `package.metadata` 中缺少数据，则参考 `workspace.metadata` 中的数据，如果这对相关工具有意义的话。


### `default-run` 字段

在清单的 `[package]` 部分中，`default-run` 字段可用于指定由 [`cargo run`] 选择的默认二进制文件。例如，当同时存在 `src/bin/a.rs` 和 `src/bin/b.rs` 时：

```toml
[package]
default-run = "a"
```

## `[lints]` 部分

可以通过在表格中分配新的级别来覆盖不同工具默认的检查等级，例如：
```toml
[lints.rust]
unsafe_code = "forbid"
```

这是以下简写形式之一：
```toml
[lints.rust]
unsafe_code = { level = "forbid", priority = 0 }
```

`level` 对应 `rustc` 中的 [检查等级](https://doc.rust-lang.org/rustc/lints/levels.html)： - `forbid` - `deny` - `warn` - `allow`

`priority` 是一个有符号整数，用于控制哪些检查或检查组会覆盖其他检查组： - 较小的（尤其是负数）数值具有较低的优先级，会被较大的数值覆盖，并在命令行中优先显示给如 `rustc` 这样的工具。

要知道特定检查属于 `[lints]` 下的哪个表格，只需查看检查名称前的 `::` 部分。如果没有 `::`，则表示该工具为 `rust`。例如，关于 `unsafe_code` 的警告将表示为 `lints.rust.unsafe_code`，而关于 `clippy::enum_glob_use` 的检查将表示为 `lints.clippy.enum_glob_use`。

例如：
```toml
[lints.rust]
unsafe_code = "forbid"

[lints.clippy]
enum_glob_use = "deny"

[lints.cargo]
unused_dependencies = "deny"
```

通常，这些设置仅影响当前包的本地开发。Cargo 只将这些设置应用于当前包，而不应用于依赖项。对于依赖项，通过具有 [`--cap-lints`](../../rustc/lints/levels.html#capping-lints) 功能的机制，Cargo 可以抑制非路径依赖项中的检查。

有关 Cargo 自身发出的可用检查，请参阅 [lints 章节](lints.md)。

> **MSRV:** 自 1.74 版本起受尊重。

## `[hints]` 部分

`[hints]` 部分允许指定编译此包时的提示信息。默认情况下，Cargo 在编译此包时会遵守这些提示，但顶层包的构建可以通过 `[profile]` 机制覆盖这些值。从设计上来看，提示信息总是可以被 Cargo 忽略；如果 Cargo 遇到它不理解的提示，或者理解了但值它无法理解，它将发出警告而不会报错。因此，在 crate 中指定提示信息不会影响该 crate 的 MSRV。

单个提示可能包含一个不稳定的特性开关，你需要传入该开关以应用其指定的配置，但如果你不指定该不稳定特性开关，你将只收到警告，而不是错误。

目前没有稳定的提示。请参阅关于不稳定的 [`mostly-unused`](unstable.md#profile-hint-mostly-unused-option) 和 [`min-opt-level`](unstable.md#包-min-opt-level-hint) 提示的文档。

> **MSRV:** 在 1.90 版本中受到尊重。

## `[badges]` 部分

`[badges]` 部分用于指定在包发布时可以在注册表网站上显示的状态徽章。

> [!NOTE]
> [crates.io] 之前在其网站上会在 crate 旁边显示徽章，但此功能已被移除。包应在其 README 文件中添加徽章，这些徽章将在 [crates.io] 上展示（参见 `[readme` 字段](#the-readme-field)）。

```toml
[badges]
# The `maintenance` table indicates the status of the maintenance of
# the crate. This may be used by a registry, but is currently not
# used by crates.io. See https://github.com/rust-lang/crates.io/issues/2437
# and https://github.com/rust-lang/crates.io/issues/2438 for more details.
#
# The `status` field is required. Available options are:
# - `actively-developed`: New features are being added and bugs are being fixed.
# - `passively-maintained`: There are no plans for new features, but the maintainer intends to
#   respond to issues that get filed.
# - `as-is`: The crate is feature complete, the maintainer does not intend to continue working on
#   it or providing support, but it works for the purposes it was designed for.
# - `experimental`: The author wants to share it with the community but is not intending to meet
#   anyone's particular use case.
# - `looking-for-maintainer`: The current maintainer would like to transfer the crate to someone
#   else.
# - `deprecated`: The maintainer does not recommend using this crate (the description of the crate
#   can describe why, there could be a better solution available or there could be problems with
#   the crate that the author does not want to fix).
# - `none`: Displays no badge on crates.io, since the maintainer has not chosen to specify
#   their intentions, potential crate users will need to investigate on their own.
maintenance = { status = "..." }
```

## 依赖项部分

有关 `[dependencies]`、[`dev-dependencies`]、[`build-dependencies`] 以及特定目标下的 `[target.*.dependencies]` 部分的详细信息，请参阅 [指定依赖项页面](specifying-dependencies.md)。

## `[profile.*]` 部分

`[profile]` 表格提供了一种自定义编译器设置（如优化和调试设置）的方法。更多细节请参见 [Profiles 章节](profiles.md)。

[alphanumeric]: ../../std/primitive.char.html#method.is_alphanumeric
[SemVer]: https://semver.org
[Resolver]: resolver.md
[SemVer compatibility]: semver.md
[docs.rs queue]: https://docs.rs/releases/queue
[build script]: build-scripts.md
[links]: build-scripts.md#the-links-manifest-key
[gitignore]: https://git-scm.com/docs/gitignore
[workspace-metadata]: workspaces.md#the-metadata-table
[`cargo init`]: ../commands/cargo-init.md
[`cargo new`]: ../commands/cargo-new.md
[`cargo package`]: ../commands/cargo-package.md
[`cargo run`]: ../commands/cargo-run.md
[crates.io]: https://crates.io/
[docs.rs]: https://docs.rs/
[publishing]: publishing.md
[Rust Edition]: ../../edition-guide/index.html
[spdx-2.3-license-expressions]: https://spdx.github.io/spdx-spec/v2.3/SPDX-license-expressions/
[spdx-license-list-3.20]: https://github.com/spdx/license-list-data/tree/v3.20
[SPDX site]: https://spdx.org
[TOML]: https://toml.io/
