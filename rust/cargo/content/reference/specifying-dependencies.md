# 指定依赖项

你的库可以依赖于来自 [crates.io] 或其他注册表、`git` 仓库或本地文件系统中的子目录中的其他库。你也可以临时覆盖依赖项的路径——例如，在本地测试正在使用的依赖项的错误修复时。你可以为不同平台设置不同的依赖项，以及仅在开发期间使用的依赖项。让我们来看看如何分别实现这些操作。

## 从 crates.io 指定依赖项

默认情况下，Cargo 会查找 [crates.io] 上的依赖项。在这种情况下，只需要依赖项的名称和版本字符串即可。在 [cargo 指南](../guide/index.md)中，我们指定了对 `time` 库的依赖：

```toml
[dependencies]
time = "0.1.12"
```

版本字符串 `"0.1.12"` 被称为 [版本要求](#version-requirement-syntax)。它指定了一个可选择的版本范围，在 [解析依赖项](resolver.md)时可以使用该范围。在这种情况下，`"0.1.12"` 表示版本范围 `>=0.1.12, <0.2.0`。如果更新符合此范围，则允许进行更新。例如，如果我们运行 `cargo update time`，如果当前是最新 `0.1.z` 版本，Cargo 应该将我们更新到版本 `0.1.13`，而不会更新到 `0.2.0`。

## 版本要求语法

### 默认要求

**默认要求**指定了最低版本，并允许更新为 [SemVer] 兼容的版本。如果版本的最左侧非零主版本/次版本/补丁组件相同，则视为兼容版本。这与 [SemVer] 不同，后者认为所有 1.0.0 之前的包都不兼容。

`1.2.3` 是默认要求的示例。

```notrust
1.2.3  :=  >=1.2.3, <2.0.0
1.2    :=  >=1.2.0, <2.0.0
1      :=  >=1.0.0, <2.0.0
0.2.3  :=  >=0.2.3, <0.3.0
0.2    :=  >=0.2.0, <0.3.0
0.0.3  :=  >=0.0.3, <0.0.4
0.0    :=  >=0.0.0, <0.1.0
0      :=  >=0.0.0, <1.0.0
```

### 尖括号要求

**尖括号要求**是默认的版本要求策略。这种版本策略允许 [SemVer] 兼容的更新。它们以带有前导尖括号 (`^`) 的版本要求形式指定。

`^1.2.3` 是尖括号要求的示例。

省略尖括号相当于使用尖括号要求的简化语法。虽然尖括号要求是默认策略，但建议尽可能使用简化语法。

`log = "^1.2.3"` 完全等同于 `log = "1.2.3"`。

### 波浪号要求

**波浪号要求**指定了一个最低版本，并允许进行某些更新。如果您指定了主要版本、次要版本和补丁版本，或者仅指定了主要版本和次要版本，则只允许进行补丁级别的更改。如果您只指定了主要版本，那么允许进行次要版本和补丁级别的更改。

`~1.2.3` 是波浪号要求的示例。

```notrust
~1.2.3  := >=1.2.3, <1.3.0
~1.2    := >=1.2.0, <1.3.0
~1      := >=1.0.0, <2.0.0
```

### 通配符要求

**通配符要求**允许使用任何位置带有通配符的版本。

`*`、`1.*` 和 `1.2.*` 是通配符要求的示例。

```notrust
*     := >=0.0.0
1.*   := >=1.0.0, <2.0.0
1.2.* := >=1.2.0, <1.3.0
```

> [!NOTE]
> [crates.io] 不允许裸的 `*` 版本。

### 比较要求

**比较要求**允许手动指定一个版本范围或要依赖的精确版本。

以下是一些比较要求的示例：

```notrust
>= 1.2.0
> 1
< 2
= 1.2.3
```

<span id="multiple-requirements"></span>
### 多个版本要求

如上述示例所示，多个版本要求可以用逗号分隔，例如 `>= 1.2, < 1.5`。所有要求必须同时满足，因此不重叠的要求，如 `<1.2, ^1.2.2`，将没有匹配的版本。

### 预发布版本

版本要求排除了[预发布版本](清单.md#the-version-field)，例如 `1.0.0-alpha`，除非特别请求。例如，如果包 `foo` 的 `1.0.0-alpha` 已发布，那么要求 `foo = "1.0"` 将不匹配，并将返回错误。必须指定预发布版本，例如 `foo = "1.0.0-alpha"。同样，`[cargo install]` 在明确请求安装时不会使用预发布版本。

Cargo 允许自动使用“更新”的预发布版本。例如，如果 `1.0.0-beta` 已发布，那么要求 `foo = "1.0.0-alpha"` 将允许更新到 `beta` 版本。请注意，这仅适用于同一发布版本，`foo = "1.0.0-alpha"` 不会允许更新到 `foo = "1.0.1-alpha"` 或 `foo = "1.0.1-beta"`。

Cargo 还会自动从预发布版本升级到与 semver 兼容的发布版本。要求 `foo = "1.0.0-alpha"` 将允许更新到 `foo = "1.0.0"` 以及 `foo = "1.2.0"`。

请注意，预发布版本可能不稳定，因此在使用时需格外小心。某些项目可能会选择在预发布版本之间发布破坏性变更。如果您的库本身不是预发布版本，建议不要在库中使用预发布依赖项。更新 `Cargo.lock` 时也需谨慎，并准备好应对预发布更新引发的问题。


### 版本元数据

[版本元数据](清单.md#the-version-field)中的内容，例如 `1.0.0+21AF26D3`，会被忽略，不应用于版本要求中。

> [!CAUTION]
> 如有疑问，请使用默认的版本要求运算符。
>
> 在极少数情况下，具有“公共依赖项”的包（在其公共 API 中重新导出该依赖项或与其交互）如果与多个不兼容的 semver 版本兼容，可能会允许用户选择使用哪个版本的“公共依赖项”。在这种情况下，`">=0.4, <2"` 这样的版本要求可能很有用。*然而*，使用该包的用户可能会遇到错误，如果它们还依赖该包，则需要通过 `cargo update` 手动选择“公共依赖项”的版本，因为 [解析依赖版本](resolver.md) 时 Cargo 可能会选择不同的“公共依赖项”版本（参见 [#10599]）。
>
> 避免将版本的上限限制为低于下一个不兼容 semver 版本的任何值（例如避免使用 `">=2.0, <2.4"`、`"2.0.*"` 或 `~2.0`），因为依赖树中的其他包可能需要更新版本，导致无法解决的错误（参见 [#9029]）。考虑是否更合适在 [`Cargo.lock`]中控制版本号。
>
> 在某些情况下，这并不重要，或者好处可能超过成本，包括： - 当没有其他人依赖你的包时；例如它只有 `[[bin]]` 类型。 - 当依赖一个预发布包并希望避免破坏性变更时，那么明确指定 `"=1.2.3-alpha.3"` 可能是合理的（参见 [#2222]）。 - 当库重新导出了一个过程宏，但该过程宏生成的代码调用了被重新导出的库时，为了确保过程宏不比被重新导出的库更新，并且生成的使用当前版本中不存在的 API 部分的代码，明确指定 `=1.2.3` 可能是合理的。


## 从其他注册表指定依赖项

要从 [crates.io] 以外的注册表指定依赖项，将 `registry` 键设置为要使用的注册表名称：

```toml
[dependencies]
some-crate = { version = "1.0", registry = "my-registry" }
```

其中 `my-registry` 是在 `.cargo/config.toml` 文件中配置的注册表名称。有关更多信息，请参阅[注册表文档]。

> [!NOTE]
> [crates.io]不允许发布包含外部 [crates.io] 发布的代码的依赖项的包。


## 从 `git` 仓库指定依赖项

要依赖位于 `git` 仓库中的库，你需要提供的最少信息是带有 `git` 键的仓库位置：

```toml
[dependencies]
regex = { git = "https://github.com/rust-lang/regex.git" }
```

Cargo 会获取该位置的 `git` 仓库，并遍历文件树以在 `git` 仓库内的任何地方找到所请求的包的 `Cargo.toml` 文件。例如，`regex-lite` 和 `regex-syntax` 是 `rust-lang/regex` 仓库的成员，无论它们位于文件树的哪个位置，都可以通过仓库根 URL（`https://github.com/rust-lang/regex.git`）来引用。

```toml
regex-lite   = { git = "https://github.com/rust-lang/regex.git" }
regex-syntax = { git = "https://github.com/rust-lang/regex.git" }
```

上述规则不适用于[`path`依赖项](#specifying-path-dependencies)。

### 提交选择

如果仅指定仓库 URL，Cargo 会假设我们打算使用默认分支上的最新提交来构建我们的包，如上面的示例所示。

你可以将 `git` 键与 `rev`、`tag` 或 `branch` 键结合使用，以更具体地指定要使用的提交。以下是一个在名为 `next` 的分支上使用最新提交的示例：

```toml
[dependencies]
regex = { git = "https://github.com/rust-lang/regex.git", branch = "next" }
```

任何不是分支或标签的内容都属于 `rev` 键的范畴。这可以是像 `rev = "4c59b707"` 这样的提交哈希，也可以是远程仓库暴露的命名引用，例如 `rev = "refs/pull/493/head"`。

`rev` 键可用的引用取决于仓库的托管位置。GitHub 会提供每个拉取请求的最新提交的引用，如上面的示例所示。其他 git 托管服务可能会以不同的命名方案提供类似的内容。

**更多 `git` 依赖示例：**

```toml
# .git suffix can be omitted if the host accepts such URLs - both examples work the same
regex = { git = "https://github.com/rust-lang/regex" }
regex = { git = "https://github.com/rust-lang/regex.git" }

# a commit with a particular tag
regex = { git = "https://github.com/rust-lang/regex.git", tag = "1.10.3" }

# a commit by its SHA1 hash
regex = { git = "https://github.com/rust-lang/regex.git", rev = "0c0990399270277832fbb5b91a1fa118e6f63dba" }

# HEAD commit of PR 493
regex = { git = "https://github.com/rust-lang/regex.git", rev = "refs/pull/493/head" }

# INVALID EXAMPLES

# specifying the commit after # ignores the commit ID and generates a warning
regex = { git = "https://github.com/rust-lang/regex.git#4c59b70" }

# git and path cannot be used at the same time
regex = { git = "https://github.com/rust-lang/regex.git#4c59b70", path = "../regex" }
```

在添加 `git` 依赖时，Cargo 会将这些提交锁定在 `Cargo.lock` 文件中，并且只有在运行 `cargo update` 命令时才进行更新检查。

### `version` 键的作用

无论是否存在 `git` 或 `path` 键，`version` 键始终意味着该包可在注册表中使用。

`version` 键并不影响 Cargo 在获取 `git` 依赖时使用的提交，但 Cargo 会检查依赖的 `Cargo.toml` 文件中的版本信息与 `version` 键是否一致，如果检查失败则会产生错误。

在这个示例中，Cargo 从 Git 中获取名为 `next` 分支的 HEAD 提交，并检查该包的版本是否与 `version = "1.10.3"` 兼容：

```toml
[dependencies]
regex = { version = "1.10.3", git = "https://github.com/rust-lang/regex.git", branch = "next" }
```

`version`、`git` 和 `path` 键被视为解决依赖问题的独立位置。有关详细解释，请参见下面的 [Multiple locations](#multiple-locations) 部分。

> [!NOTE]
> [crates.io] 不允许包在 [crates.io] 外部发布的代码上包含依赖项（[dev-dependencies] 被忽略）。关于 `git` 和 `path` 依赖的替代方案，请参阅 [Multiple locations](#multiple-locations) 部分。

### Git submodules

在克隆 `git` 依赖项时，Cargo 会自动递归获取其子模块，以便所有必要的代码都能用于构建。

若不想获取与构建无关的子模块，可以在依赖项的 `.gitmodules` 文件中设置 [`submodule.<name>.update = none`][submodule-update]，这需要对该仓库的写入权限，并将更普遍地禁用子模块的更新。


### 访问私有 Git 仓库

有关私有仓库的 Git 认证帮助，请参阅 [Git 认证](../appendix/git-authentication.md)。

## 指定路径依赖

随着时间的推移，来自 [指南](../guide/index.md) 的 `hello_world` 包大小显著增大了！现在我们可能需要将其拆分为独立的 crate 供他人使用。为此，Cargo 支持 **路径依赖**，通常是指位于同一仓库内的子 crate。首先，我们在 `hello_world` 包中创建一个新 crate：

```console
# inside of hello_world/
$ cargo new hello_utils
```

这将在内部创建新的文件夹 `hello_utils`，其中 `Cargo.toml` 和 `src` 文件夹已准备好进行配置。为了告知 Cargo 这一情况，打开 `hello_world/Cargo.toml` 并将 `hello_utils` 添加到依赖项中：

```toml
[dependencies]
hello_utils = { path = "hello_utils" }
```

这告诉 Cargo，我们依赖于名为 `hello_utils` 的 crate，该 crate 位于与 `Cargo.toml` 文件同级的 `hello_utils` 文件夹中。

下一次执行 `cargo build` 将自动构建 `hello_utils` 及其所有依赖项。

### 禁止本地路径遍历

本地路径必须指向包含依赖项 `Cargo.toml` 的精确文件夹。与 `git` 依赖项不同，Cargo 不会进行本地路径遍历。例如，如果 `regex-lite` 和 `regex-syntax` 是本地克隆的 `rust-lang/regex` 仓库中的成员，则必须通过完整路径来引用它们：

```toml
# git key accepts the repo root URL and Cargo traverses the tree to find the crate
[dependencies]
regex-lite   = { git = "https://github.com/rust-lang/regex.git" }
regex-syntax = { git = "https://github.com/rust-lang/regex.git" }

# path key requires the member name to be included in the local path
[dependencies]
regex-lite   = { path = "../regex/regex-lite" }
regex-syntax = { path = "../regex/regex-syntax" }
```

### 发布 crate 中的本地路径

在 [crates.io] 上，使用仅以路径指定的依赖项的 crate 是不被允许的。

如果我们想要发布我们的 `hello_world` crate，我们需要将 `hello_utils` 版本作为独立 crate 发布到 [crates.io] 上，并在 `hello_world` 的依赖项行中指定其版本：

```toml
[dependencies]
hello_utils = { path = "hello_utils", version = "0.1.0" }
```

`path` 和 `version` 键一起使用的说明可以在 [Multiple locations](#multiple-locations) 部分找到。

> [!NOTE]
> [crates.io] 不允许将包发布为在 [crates.io] 之外的代码依赖，除了 [dev-dependencies]。关于 `git` 和 `path` 依赖的替代方案，请参阅 [Multiple locations](#multiple-locations) 部分。

## Multiple locations

可以同时指定注册表版本和 `git` 或 `path` 位置。当在本地使用时，`git` 或 `path` 依赖将被使用（在这种情况下，`version` 会与本地副本进行比对），而在像 [crates.io] 这样的注册表上发布时，则使用注册表版本。其他组合是不允许的。示例：

```toml
[dependencies]
# Uses `my-bitflags` when used locally, and uses
# version 1.0 from crates.io when published.
bitflags = { path = "my-bitflags", version = "1.0" }

# Uses the given git repo when used locally, and uses
# version 1.0 from crates.io when published.
smallvec = { git = "https://github.com/servo/rust-smallvec.git", version = "1.0" }

# Note: if a version doesn't match, Cargo will fail to compile!
```

一个有用的例子是当您将库拆分为同一工作空间内的多个包时。然后可以使用 `path` 依赖指向工作空间中的本地包，在开发过程中使用本地版本，而在发布到 [crates.io] 后则使用该版本的配置。

## 平台特定依赖

平台特定的依赖采用相同的格式，但列在 `target` 部分下。通常会使用类似 Rust 的 [`#[cfg]` 语法](../../reference/conditional-compilation.html)来定义这些部分：

```toml
[target.'cfg(windows)'.dependencies]
winhttp = "0.4.0"

[target.'cfg(unix)'.dependencies]
openssl = "1.0.1"

[target.'cfg(target_arch = "x86")'.dependencies]
native-i686 = { path = "native/i686" }

[target.'cfg(target_arch = "x86_64")'.dependencies]
native-x86_64 = { path = "native/x86_64" }
```

与 Rust 一样，这里的语法支持 `not`、`any` 和 `all` 运算符，以组合不同的 cfg 名称/值对。

如果您想了解您的平台上可用的哪些 cfg 目标，可以在命令行运行 `rustc --print=cfg`。如果您想了解另一个平台（如 64 位 Windows）上可用的哪些 `cfg` 目标，可以运行 `rustc --print=cfg --target=x86_64-pc-windows-msvc`。

与您的 Rust 源代码不同，您无法使用 `[target.'cfg(feature = "fancy-feature")'.dependencies]` 来根据可选特性添加依赖项。应改用 [`[features]` 部分](features.md)：

```toml
[dependencies]
foo = { version = "1.0", optional = true }
bar = { version = "1.0", optional = true }

[features]
fancy-feature = ["foo", "bar"]
```

同样适用于 `cfg(debug_assertions)`、`cfg(test)` 和 `cfg(proc_macro)`。这些值将无法按预期工作，并且总是返回 `rustc --print=cfg` 的默认值。目前没有方法可以根据这些配置值添加依赖项。

除了 `#[cfg]` 语法外，Cargo 还支持列出依赖项适用的完整目标：

```toml
[target.x86_64-pc-windows-gnu.dependencies]
winhttp = "0.4.0"

[target.i686-unknown-linux-gnu.dependencies]
openssl = "1.0.1"
```

### 自定义目标规范

如果您使用自定义目标规范（例如 `--target foo/bar.json`），请使用不带 `.json` 扩展名的基文件名：

```toml
[target.bar.dependencies]
winhttp = "0.4.0"

[target.my-special-i686-platform.dependencies]
openssl = "1.0.1"
native = { path = "native/i686" }
```

> [!NOTE]
> 自定义目标规范在稳定通道上无法使用。

## 开发依赖项

您可以在 `Cargo.toml` 中添加 `[dev-dependencies]` 部分，其格式与 `[dependencies]` 相同：

```toml
[dev-dependencies]
tempfile = "3"
```

在编译构建包时不会使用开发依赖项，但在编译测试、示例和基准测试时会使用。

这些依赖项不会传播到依赖于该包的其它包中。

您也可以通过在目标部分标题中使用 `dev-dependencies` 而不是 `dependencies`，来设置特定目标的开发依赖项。例如：

```toml
[target.'cfg(unix)'.dev-dependencies]
mio = "0.0.1"
```

> [!NOTE]
> 当发布一个包时，只有指定了 `version` 的开发依赖项才会被包含在该发布的 crate 中。对于大多数使用场景，发布时不需要开发依赖项，不过有些用户（如操作系统打包工具）可能希望在 crate 内运行测试，因此如果可能的话提供 `version` 仍然是有益的。

## 构建依赖项

您可以在构建脚本中依赖其他基于 Cargo 的 crate。通过清单中的 `build-dependencies` 部分来声明这些依赖项：

```toml
[build-dependencies]
cc = "1.0.3"
```


您也可以通过在目标部分标题中使用 `build-dependencies` 而不是 `dependencies`，来设置特定目标的构建依赖项。例如：

```toml
[target.'cfg(unix)'.build-dependencies]
cc = "1.0.3"
```

在这种情况下，仅当主机平台与指定的目标匹配时才会构建依赖项。

构建脚本**无法**访问 `dependencies` 或 `dev-dependencies` 部分中列出的依赖项。除非也在 `dependencies` 部分列出，否则构建依赖项同样无法被包本身使用。包及其构建脚本是独立构建的，因此它们的依赖项不必一致。通过为不同目的使用独立的依赖项，使 Cargo 更加简单和清晰。

## 选择功能

如果您依赖的包提供条件性功能，您可以指定要使用的功能：

```toml
[dependencies.awesome]
version = "1.3.5"
default-features = false # do not include the default features, and optionally
                         # cherry-pick individual features
features = ["secure-password", "civet"]
```

有关功能的更多信息可以在 [features 章节](features.md#依赖-features)中找到。

## 在 `Cargo.toml` 中重命名依赖项

在 `Cargo.toml` 中编写 `[dependencies]` 部分时，为依赖项指定的键通常与代码中导入的 crate 名称一致。然而，对于某些项目，您可能希望在代码中使用不同的名称来引用该 crate，而不管它是否在 crates.io 上发布。例如，您可以：

* 避免在 Rust 源文件中使用 `use foo as bar`。
* 依赖多个版本的同一 crate。
* 依赖来自不同注册表的相同名称的 crate。

为了支持这一点，Cargo 在 `[dependencies]` 部分中引入了 `package` 键，用于指定应依赖哪个包：

```toml
[package]
name = "mypackage"
version = "0.0.1"

[dependencies]
foo = "0.1"
bar = { git = "https://github.com/example/project.git", package = "foo" }
baz = { version = "0.1", registry = "custom", package = "foo" }
```

在这个示例中，您的 Rust 代码中现在有三个 crate 可用：

```rust,ignore
extern crate foo; // crates.io
extern crate bar; // git repository
extern crate baz; // registry `custom`
```

这三个 crate 都在各自的 `Cargo.toml` 中具有 `foo` 的包名，因此我们明确使用 `package` 键来告知 Cargo 我们希望获取 `foo` 包，尽管在本地调用时使用了其他名称。如果未指定 `package` 键，则默认采用所请求的依赖项的名称。

请注意，如果您有一个可选依赖项，例如：

```toml
[dependencies]
bar = { version = "0.1", package = 'foo', optional = true }
```

您依赖于 crates.io 上的 `foo` crate，但您的包具有 `bar` 功能而非 `foo` 功能。也就是说，重命名时功能的名称位于依赖项名称之后，而不是包名之后。

启用传递性依赖的方式类似，例如我们可以在上述清单中添加以下内容：

```toml
[features]
log-debug = ['bar/log-debug'] # using 'foo/log-debug' would be an error!
```

## 从工作空间继承依赖项

可以通过在工作空间的 [`[workspace.dependencies]`][工作区.dependencies]表中指定该依赖项，从而从工作空间继承依赖项。之后，将它添加到 `[dependencies]` 表中并设置 `workspace = true`。

除了 `workspace` 键外，依赖项还可以包含以下键：- [`optional`][optional]: 请注意，`[workspace.dependencies]` 表中不允许指定 `optional`。- [`features`][features]: 这些与 `[workspace.dependencies]` 中声明的功能相加。- [`default-features`][default-features]（2024版包，需要 Rust 1.99+）：会覆盖 `[workspace.dependencies]` 中设置的值。如果包和工作空间都未指定 `default-features`，则默认为 `true`。在 Rust 1.99之前或早期版本中，除非工作空间依赖项也禁用默认功能，否则包级 `default-features = false` 可能会被忽略或被拒绝。

除了 `optional`、`features` 和 `default-features` 之外，继承的依赖项不能使用其他任何依赖键（如 `version`）。

`[dependencies]`、[dev-dependencies]、[build-dependencies] 和 [目标."...".dependencies] 部分中的依赖项支持引用 `[workspace.dependencies]` 中定义的依赖项。

```toml
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
rand = { workspace = true, optional = true }
```

[`cargo install`]: ../commands/cargo-install.md
[`Cargo.lock`]: ../guide/cargo-toml-vs-cargo-lock.md
[#2222]: https://github.com/rust-lang/cargo/issues/2222
[#9029]: https://github.com/rust-lang/cargo/issues/9029
[#10599]: https://github.com/rust-lang/cargo/issues/10599
[registries documentation]: registries.md
[submodule-update]: https://git-scm.com/docs/gitmodules#Documentation/gitmodules.txt-submodulenameupdate
[SemVer]: https://semver.org
[crates.io]: https://crates.io/
[dev-dependencies]: #development-dependencies
[workspace.dependencies]: workspaces.md#the-dependencies-table
[optional]: features.md#optional-dependencies
[features]: features.md
[default-features]: features.md#dependency-features
