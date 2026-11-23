# 工作区

*工作区*是指一个或多个包的集合，这些包被称为*工作区成员*，它们被统一管理。

工作区的关键要点包括：

* 常见的命令可以在所有工作区成员上运行，例如 `cargo check --workspace`。
* 所有包共享一个位于*工作区根目录*的 [`Cargo.lock`]文件。
* 所有包共享一个[输出目录]，默认情况下为*工作区根目录*中的 `target` 目录。
* 共享包元数据，如通过 [`workspace.package`](#the-包-table)所示。
* `Cargo.toml` 中的 [`[patch]`][patch]、 [`[replace]`][replace]和 [`[profile.*]`][profiles]部分仅在*根manifest*中被识别，在成员 crate的 manifest中则被忽略。

工作区的根 `Cargo.toml` 支持以下部分：

* [`[workspace]`](#the-工作区-section) --- 定义工作区。
* [`resolver`](resolver.md#resolver-versions) --- 设置要使用的依赖解析器。
* [`members`](#the-members-and-exclude-fields) --- 要包含在工作区中的包。
* [`exclude`](#the-members-and-exclude-fields) --- 要从工作区中排除的包。
* [`default-members`](#the-default-members-field) --- 当未选择特定包时使用的包。
* [`package`](#the-包-table) --- 在包中继承的键。
* [`dependencies`](#the-dependencies-table) --- 在包依赖项中继承的键。
* [`lints`](#the-lints-table) --- 在包检查中继承的键。
* [`metadata`](#the-metadata-table) --- 外部工具的额外设置。
* [`[patch]`](overriding-dependencies.md#the-patch-section) --- 覆盖依赖项。
* [`[replace]`](overriding-dependencies.md#the-replace-section) --- 覆盖依赖项（已弃用）。
* [`[profile]`](profiles.md) --- 编译器设置和优化选项。

## `[workspace]`部分

要创建工作区，您需要在 `Cargo.toml` 中添加 `[workspace]`表：
```toml
[workspace]
# ...
```

至少，工作区必须有一个成员，可以是具有根包的包，也可以是一个虚拟 清单。

### 根包

如果已将 [`[workspace]` 部分](#the-工作区-section)添加到已经定义了 `[package]` 的 `Cargo.toml` 文件中，则该包就是工作区的 *根包*。*工作区根目录* 是工作区的 `Cargo.toml` 所在的位置。

```toml
[workspace]

[package]
name = "hello_world" # the name of the package
version = "0.1.0"    # the current version, obeying semver
```

### 虚拟工作区

或者，可以创建一个包含 `[workspace]` 部分但不包含 [`[package]` 部分][package]的 `Cargo.toml` 文件。这被称为 *虚拟清单*。当没有“主”包或希望将所有包分别组织在不同的目录中时，这种方式通常很有用。

```toml
# [PROJECT_DIR]/Cargo.toml
[workspace]
members = ["hello_world"]
resolver = "3"
```

```toml
# [PROJECT_DIR]/hello_world/Cargo.toml
[package]
name = "hello_world" # the name of the package
version = "0.1.0"    # the current version, obeying semver
edition = "2024"     # the edition, will have no effect on a resolver used in the workspace
```

通过拥有一个没有根包的 work 区，

- 在虚拟工作区中必须显式设置 [`resolver`](resolver.md#resolver-versions)，因为它们没有 `[package.edition]` 来从 [resolver version](resolver.md#resolver-versions) 中推断出来。
- 在工作区根目录中运行的命令默认会针对所有工作区成员运行，请参阅 [`default-members`](#the-default-members-field)。

## `members` 和 `exclude` 字段

`members` 和 `exclude` 字段定义了哪些包是工作区的成员：

```toml
[workspace]
members = ["member1", "path/to/member2", "crates/*"]
exclude = ["crates/foo", "path/to/other"]
```

所有位于工作区目录中的 [`path` 依赖项] 会自动成为成员。可以通过 `members` 键列出额外的成员，该键应是一个包含含有 `Cargo.toml` 文件的目录的字符串数组。

`members` 列表还支持 [globs] 来匹配多个路径，使用诸如 `*` 和 `?` 这样的典型文件名 glob 模式。

> [!TIP]
> 将所有成员包放在一个扁平的目录中（通常称为 `crates/`），并在 `members` 字段中使用 glob 模式，例如 `members = ["crates/*"]`。这可以最小化维护 `members` 列表时的变更。

`exclude` 键可用于防止某些路径被包含在工作区中。如果某些路径依赖根本不想出现在工作区中，或者使用 glob 模式时想要删除某个目录，则此功能非常有用。

当位于工作空间内的子目录中时，Cargo 会自动在父目录中查找包含 `[workspace]` 定义的 `Cargo.toml` 文件，以确定使用哪个工作空间。可以在成员 crate 中使用 [`package.workspace`] 清单键来指向工作空间的根目录，以覆盖此自动搜索机制。如果成员不在工作空间根的子目录中，手动设置会非常有用。

### 包选择

在工作空间中，像 [`cargo build`] 这样的与包相关的 Cargo 命令可以使用 `-p` / `--package` 或 `--workspace` 命令行标志来确定要操作的包。如果未指定这些标志，Cargo 将使用当前工作目录中的包。然而，如果当前目录是工作空间根目录，则会使用 [`default-members`](#the-default-members-field)。

## `default-members` 字段

`default-members` 字段指定了在工作空间根目录且未使用包选择标志时要操作的 [成员](#the-members-and-exclude-fields) 路径：

```toml
[workspace]
members = ["path/to/member1", "path/to/member2", "path/to/member3/*"]
default-members = ["path/to/member2", "path/to/member3/foo"]
```

> [!NOTE]
> 当存在 [根包](#root-包) 时，只能使用 `--package` 和 `--workspace` 标志来操作它。

如果未指定，则使用 [根包](#root-包)。在 [虚拟工作空间](#virtual-工作区] 的情况下，将使用所有成员（就像在命令行中指定了 `--workspace` 一样）。

## `package` 表

`workspace.package` 表是您定义可以被工作空间成员继承的键的地方。这些键可以通过在成员包中定义 `{key}.workspace = true` 来继承。

支持的键：

|                         |                 |
|-------------------------|-----------------|
| `authors` (deprecated)  | `categories`    |
| `description`           | `documentation` |
| `edition`               | `exclude`       |
| `homepage`              | `include`       |
| `keywords`              | `license`       |
| `license-file`          | `publish`       |
| `readme`                | `repository`    |
| `rust-version`          | `version`       |

- `license-file` 和 `readme` 相对于工作空间根目录 - `include` 和 `exclude` 相对于您的包根目录

Example:
```toml
# [PROJECT_DIR]/Cargo.toml
[workspace]
members = ["bar"]

[workspace.package]
version = "1.2.3"
description = "A short description of my package"
documentation = "https://example.com/bar"
```

```toml
# [PROJECT_DIR]/bar/Cargo.toml
[package]
name = "bar"
version.workspace = true
description.workspace = true
documentation.workspace = true
```

> **MSRV:** 需要 1.64+ 版本

## `dependencies` 表

`workspace.dependencies` 表是您定义要被工作空间成员继承的依赖项的地方。

指定工作空间依赖项与[包依赖项][specifying-dependencies]类似，但有以下不同： - 此表中的依赖项不能声明为`optional` - 此表中声明的[特性][features]会与[依赖项]中的`features`相加 - 在包依赖项中声明的`default-features`会覆盖2024版包中此处设置的值（需要Rust 1.99+）。在Rust 1.99之前或更早版本中，除非工作空间依赖项也禁用默认特性，否则包级别的`default-features = false`可能会被忽略或被拒绝。

然后你可以[将工作空间依赖项作为包依赖项继承][inheriting-a-依赖-from-a-工作区]

Example:
```toml
# [PROJECT_DIR]/Cargo.toml
[workspace]
members = ["bar"]

[workspace.dependencies]
cc = "1.0.73"
rand = "0.8.5"
regex = { version = "1.6.0", default-features = false, features = ["std"] }
serde = { version = "1.0.190", default-features = true }
```

```toml
# [PROJECT_DIR]/bar/Cargo.toml
[package]
name = "bar"
version = "0.2.0"
edition = "2024"

[dependencies]
regex = { workspace = true, features = ["unicode"] }
serde = { workspace = true, default-features = false }

[build-dependencies]
cc.workspace = true

[dev-dependencies]
rand.workspace = true
```

> **MSRV:** 需要1.64+版本

## `lints`表

`workspace.lints`表用于定义要被工作空间成员继承的lint配置。

指定工作空间lint配置与[包lint](清单.md#the-lints-section)类似。

Example:

```toml
# [PROJECT_DIR]/Cargo.toml
[workspace]
members = ["crates/*"]

[workspace.lints.rust]
unsafe_code = "forbid"
```

```toml
# [PROJECT_DIR]/crates/bar/Cargo.toml
[package]
name = "bar"
version = "0.1.0"

[lints]
workspace = true
```

> **MSRV:** 在1.74版本起受尊重

## `metadata`表

Cargo会忽略`workspace.metadata`表，不会对此发出警告。此部分可用于那些希望将工作空间配置存储在`Cargo.toml`中的工具。例如：

```toml
[workspace]
members = ["member1", "member2"]

[workspace.metadata.webcontents]
root = "path/to/webproject"
tool = ["npm", "run", "build"]
# ...
```

在包级别也有类似的表，位于[包元数据][包-metadata]中。虽然cargo没有指定这些表的内容格式，但建议外部工具可以以一致的方式使用它们，例如如果`package.metadata`中缺少数据，就可以参考`workspace.metadata`中的数据，如果对于该工具来说这样做有意义的话。

[package]: manifest.md#the-package-section
[`Cargo.lock`]: ../guide/cargo-toml-vs-cargo-lock.md
[package-metadata]: manifest.md#the-metadata-table
[package-edition]: manifest.md#the-edition-field
[output directory]: build-cache.md
[patch]: overriding-dependencies.md#the-patch-section
[replace]: overriding-dependencies.md#the-replace-section
[profiles]: profiles.md
[`path` dependencies]: specifying-dependencies.md#specifying-path-dependencies
[`package.workspace`]: manifest.md#the-workspace-field
[globs]: https://docs.rs/glob/0.3.0/glob/struct.Pattern.html
[`cargo build`]: ../commands/cargo-build.md
[specifying-dependencies]: specifying-dependencies.md
[features]: features.md
[inheriting-a-dependency-from-a-workspace]: specifying-dependencies.md#inheriting-a-dependency-from-a-workspace
