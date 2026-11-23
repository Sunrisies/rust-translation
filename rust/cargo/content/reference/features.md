# 特性

Cargo “特性”提供了一种机制来表达[条件编译]和[可选依赖](#optional-dependencies)。一个包在 `Cargo.toml`的 `[features]`表中定义一组名为特性的项，每个特性可以启用或禁用。正在构建的包的特性可以通过 `--features`等命令行标志在命令行上启用。依赖项的特性则可以在 `Cargo.toml`中的依赖声明中启用。

> [!NOTE]
> 现在在 crates.io 上发布的新包或版本最多只能包含 300 个特性。例外情况会逐案处理。详情请参阅此[博客文章]。通过 crates.io Zulip 频道鼓励参与解决方案讨论。


有关特性使用示例，请参阅[特性示例]章节。


## `[features]`部分

特性在 `Cargo.toml`的 `[features]`表中定义。每个特性指定了一组它启用的其他特性或可选依赖项。以下示例展示了如何在2D图像处理库中使用特性，其中可以可选包含对不同图像格式的支持：

```toml
[features]
# Defines a feature named `webp` that does not enable any other features.
webp = []
```

通过定义此特性后，可以使用 [`cfg`表达式]在编译时条件性地包含支持所请求特性的代码。例如，在包的 `lib.rs`中可以包含如下内容：

```rust
// This conditionally includes a module which implements WEBP support.
#[cfg(feature = "webp")]
pub mod webp;
```

Cargo使用 `rustc`的`[--cfg]`标志在包中设置特性，代码可以通过`[cfg]`属性或`[cfg]`宏来检测这些特性的存在。

特性可以列出要启用的其他特性。例如，ICO图像格式可以包含BMP和PNG图像，因此当它被启用时，应确保这些其他特性也被启用：

```toml
[features]
bmp = []
png = []
ico = ["bmp", "png"]
webp = []
```

特性名称可以包含来自[Unicode XID 标准]的字符（该标准包含大多数字母），并且允许以`_`或数字`0`到`9`开头，第一个字符之后还可以包含`-`、`+`或`.`。

> [!NOTE]
> [crates.io]对特性名称语法施加了额外限制，要求只能使用[ASCII字母数字]字符或`_`、`-`或`+`。


## `default`特性

默认情况下，所有特性都是禁用的，除非明确启用。可以通过指定`default`特性来更改此设置。

```toml
[features]
default = ["ico", "webp"]
bmp = []
png = []
ico = ["bmp", "png"]
webp = []
```

当包被构建时，`default`特性会被启用，进而启用列出的其他特性。可以通过以下方式改变此行为：

* `--no-default-features` [命令行标志](#command-line-特性-options)可以禁用包的默认特性。
* 可以在[依赖声明](#依赖-features)中指定`default-features = false`选项。

> [!IMPORTANT]
> 在选择默认特性集时需谨慎。默认特性是一种便利措施，使得使用包更加简单，无需用户仔细选择要启用的特性以进行日常使用，但存在一些缺点。除非指定`default-features = false`，否则依赖项会自动启用默认特性。这可能会难以确保不启用默认特性，尤其是对于那些在依赖图中出现多次的依赖项。每个包都必须确保指定`default-features = false`以避免启用这些特性。
>
> 另一个问题是，从默认集合中移除一个特性可能是一个[SemVer不兼容变更](#semver-compatibility)，因此您应该确信自己会保留那些特性。

## 可选依赖项

依赖项可以被标记为“可选”，这意味着它们默认不会被编译。例如，假设我们的 2D 图像处理库使用外部包来处理 GIF 图像。可以这样表示：

```toml
[dependencies]
gif = { version = "0.11.1", optional = true }
```

默认情况下，这个可选依赖项隐式地定义了如下特性：

```toml
[features]
gif = ["dep:gif"]
```

这意味着该依赖项仅在 `gif` 特性被启用时才会被包含。在代码中可以使用相同的 `cfg(feature = "gif")` 语法，并且可以像启用其他特性一样启用该依赖项，例如 `--features gif`（参见下面的 [命令行特性选项](#command-line-特性-options)）。

在某些情况下，你可能不想暴露与可选依赖项同名的特性。例如，也许可选依赖项是内部细节，或者你想将多个可选依赖项组合在一起，或者只是希望使用更好的名称。如果你在 `[features]` 表中用 `dep:` 前缀指定可选依赖项，就会禁用隐式特性。

> [!NOTE]
> `dep:` 语法从 Rust 1.60 开始可用。之前的版本只能使用隐式特性名称。

例如，假设为了支持 AVIF 图像格式，我们的库需要启用两个其他依赖项：

```toml
[dependencies]
ravif = { version = "0.6.3", optional = true }
rgb = { version = "0.8.25", optional = true }

[features]
avif = ["dep:ravif", "dep:rgb"]
```

在这个示例中，`avif` 特性将启用列出的两个依赖项。这也可以避免创建隐式的 `ravif` 和 `rgb` 特性，因为用户不需要单独启用这些内部细节。

> [!NOTE]
> 另一种可选包含依赖项的方式是使用 [平台特定的依赖项]。与使用特性不同，这些依赖项是基于目标平台的条件性设置。


## 依赖项特性

可以在依赖项声明中启用依赖项的特性。`features` 键指示要启用哪些特性：

```toml
[dependencies]
# Enables the `derive` feature of serde.
serde = { version = "1.0.118", features = ["derive"] }
```

可以使用 `default-features = false` 禁用 [`默认` 特性](#the-default-特性)：

```toml
[dependencies]
flate2 = { version = "1.0.3", default-features = false, features = ["zlib-rs"] }
```

> [!NOTE]
> 这可能无法确保默认功能被禁用。如果其他依赖项包含 `flate2` 而不指定 `default-features = false`，则默认功能将被启用。更多细节请参见下面的 [特性 unification](#特性-unification)。

依赖项的特性也可以在 `[features]` 表中启用。语法为 `"package-name/feature-name"。例如：

```toml
[dependencies]
jpeg-decoder = { version = "0.1.20", default-features = false }

[features]
# Enables parallel processing support by enabling the "rayon" feature of jpeg-decoder.
parallel = ["jpeg-decoder/rayon"]
```

如果 `"package-name/feature-name"` 语法用于作为可选依赖项，它也会启用 `package-name`。通常这不是您想要的行为。您可以添加 `?`，如 `"package-name?/feature-name"`，这样只有在其他依赖项启用了该可选依赖项时，才会启用指定的特性。

> [!NOTE]
> `?` 语法从 Rust 1.60 开始可用。

例如，假设我们在库中添加了一些序列化支持，并且需要在某些可选依赖项中启用相应的特性。可以这样做：

```toml
[dependencies]
serde = { version = "1.0.133", optional = true }
rgb = { version = "0.8.25", optional = true }

[features]
serde = ["dep:serde", "rgb?/serde"]
```

在这个示例中，启用 `serde` 特性将启用 `serde` 依赖项。它还将为 `rgb` 依赖项启用 `serde` 特性，但前提是其他依赖项已经启用了 `rgb` 依赖项。

## 命令行功能选项

可以使用以下命令行标志来控制哪些特性被启用：

* `--features` _FEATURES_: 启用列出的特性。多个特性可以用逗号或空格分隔。如果使用空格，从 shell 运行 Cargo 时务必用引号包裹所有特性（例如 `--features "foo bar"`）。如果在 [工作区] 中构建多个包，可以使用 `"package-name/feature-name"` 语法为特定 工作区 成员指定特性。
* `--all-features`: 激活命令行上选中的所有包的所有特性。
* `--no-default-features`: 不激活所选包的 [`default` 特性](#the-default-特性)。

> [!NOTE]
> 详情请参阅各个子命令的文档。并非所有标志都适用于所有子命令。


## 特性统一

特性是定义它们的包所独有的。在某个包上启用一个特性，并不会在其他包上启用相同名称的特性。

当一个依赖项被多个包使用时，Cargo会在构建该依赖项时采用该依赖项中所有启用的特性的并集。这有助于确保只使用一份依赖项副本。更多细节请参见解析器文档中的[features部分]。

例如，让我们看看 [`winapi`] 这个包，它使用了大量的特性。[winapi-features]：https://crates.io/crates/winapi-rs/blob/0.3.9/Cargo.toml#L25-L431

![winapi features example](../images/winapi-features.svg)


由此带来的结果是，特性应该是*可叠加的*。也就是说，启用一个特性不应禁用其他功能，通常启用任意组合的特性也是安全的。一个特性不应引入[SemVer不兼容变更](#semver-compatibility)。

例如，如果您希望可选支持 [`no_std`] 环境，**不要**使用 `no_std` 特性。而是使用 `std` 特性来*启用* `std`。例如：

```rust
#![no_std]

#[cfg(feature = "std")]
extern crate std;

#[cfg(feature = "std")]
pub fn function_that_requires_std() {
    // ...
}
```


### 互斥特性

偶尔会出现特性之间相互不兼容的情况。应尽可能避免这种情况，因为需要协调依赖图中所有对该包的使用，以防止同时启用这些特性。如果无法避免，可以考虑添加编译错误来检测这种场景。

```rust,ignore
#[cfg(all(feature = "foo", feature = "bar"))]
compile_error!("feature \"foo\" and feature \"bar\" cannot be enabled at the same time");
```

与其使用互斥特性，不如考虑其他方案：

* 将功能拆分为独立的包。
* 当存在冲突时，[选择其中一个特性而非另一个][特性-precedence]。`cfg-if` 包可以帮助编写更复杂的 `cfg` 表达式。
* 设计代码使得这些特性能够同时启用，并使用运行时选项来控制使用哪个特性。例如，可以使用配置文件、命令行参数或环境变量来选择要启用的行为。


### 检查已解析的特性

在复杂的依赖图中，有时很难理解不同特性是如何在各个包中启用的。`cargo tree` 命令提供了多种选项来帮助检查和可视化哪些特性被启用。可以尝试一些选项：

* `cargo tree -e features`: 这将显示依赖图中的特性。每个特性都会显示其启用的包。
* `cargo tree -f "{p} {f}"`: 这是一个更紧凑的视图，显示每个包中启用的特性的逗号分隔列表。
* `cargo tree -e features -i foo`: 这将反转树结构，显示特性如何流入给定的包“foo”。这很有用，因为查看整个图可能会非常庞大且令人困惑。当试图确定特定包上启用了哪些特性及其原因时，可以使用此选项。请参阅 [`cargo tree`] 页面底部的示例以了解如何阅读该信息。


## 特性解析器版本 2

可以通过在 `Cargo.toml` 中的 `resolver` 字段指定不同的特性解析器，如下所示：

```toml
[package]
name = "my-package"
version = "1.0.0"
resolver = "2"
```

有关指定解析器版本的更多细节，请参阅 [resolver versions] 部分。

版本 `"2"` 的解析器避免了在某些不希望统一特性的情况下进行统一。具体情况在 [resolver chapter][resolver-v2] 中有描述，但简而言之，它避免在这些情况下进行统一：

* 在[特定平台依赖项]上启用的功能，对于当前尚未构建的[目标架构][target]将被忽略。
* [构建依赖项]和过程宏与普通依赖项不共享功能。
* [开发依赖项]不会激活功能，除非正在构建需要这些功能的[Cargo目标][target]（如测试或示例）。

在某些情况下，避免统一处理是必要的。例如，如果一个构建依赖项启用了`std`功能，而同一个依赖项作为普通依赖项用于`no_std`环境时则不会启用`std`，这样启用`std`会破坏构建过程。

然而，其一个缺点是会增加构建时间，因为该依赖项会被多次构建（每次带有不同的功能）。当使用版本 `"2"` 解析器时，建议检查那些被多次构建的依赖项，以缩短整体构建时间。如果不需要单独构建具有不同功能的重复包，可以考虑在[依赖声明](#依赖-features)中的`features`列表中添加这些功能，这样重复的包就会拥有相同的功能（因此Cargo会只构建一次）。可以使用 [`cargo tree --duplicates`][`cargo tree`]命令]来检测这些重复依赖项。该命令会显示哪些包被多次构建；寻找版本相同的条目即可。有关获取解析后功能的更多信息，请参阅[检查解析后的功能](#inspecting-resolved-features)。对于构建依赖项，如果使用 `--target` 标志进行交叉编译，则无需此操作，因为在这种情况下构建构建依赖项总是与普通依赖项分开进行的。


### 解析器版本 2 的命令行参数

设置`resolver = "2"`还会改变 `--features`和 `--no-default-features` [命令行选项](#command-line-特性-options)的行为。

在版本 `"1"` 中，您只能在当前工作目录中启用包的功能。例如，在一个包含 `foo` 和 `bar` 包的workspace 中，如果您处于 `foo` 包的目录中，并运行命令 `cargo build -p bar --features bar-feat`，则会出现失败，因为 `--features` 标志仅允许在 `foo` 上启用功能。

当 `resolver = "2"` 时，功能标志允许通过 `-p` 和 `--workspace` 标志选择的所有包来启用功能。

```sh
# This command is allowed with resolver = "2", regardless of which directory
# you are in.
cargo build -p foo -p bar --features foo-feat,bar-feat

# This explicit equivalent works with any resolver version:
cargo build -p foo -p bar --features foo/foo-feat,bar/bar-feat
```

此外，当 `resolver = "1"` 时，`--no-default-features` 标志仅禁用当前目录中包的默认功能。而在版本 "2" 中，它将禁用所有 工作区 成员的默认功能。


## 构建脚本

[构建脚本] 可以通过检查 `CARGO_FEATURE_<name>` 环境变量来检测包上启用的功能，其中 `<name>` 是转换为大写的功能名称，而 `-` 则被替换为 `_`。


## 必需的功能

[`required-features` 字段] 可用于在功能未启用时禁用特定的 [Cargo 目标]。更多细节请参阅相关文档。


## SemVer 兼容性

启用功能不应引入 SemVer 不兼容的变更。例如，该功能不应以可能破坏现有使用的方式改变现有的 API。关于哪些变更是兼容的更多细节，请参见 [SemVer 兼容性章节](semver.md)。

在添加和移除功能定义及可选依赖时，应小心行事，因为这些操作有时会导致与旧版本不兼容的变化。更多细节可参见 SemVer 兼容性章节中的 [Cargo 部分](semver.md#cargo)。简而言之，请遵循以下规则：

* 在次要版本中通常可以安全执行以下操作：
* 添加 [新功能][cargo-特性-add] 或 [可选依赖][cargo-dep-add]。
* [更改依赖中的功能使用情况][cargo-change-dep-特性]。
* 在次要版本中通常**不应**执行以下操作：
* [移除功能][cargo-特性-remove] 或 [可选依赖][cargo-remove-opt-dep]。
* [将现有公共代码移出某个功能之后][item-remove]。
* [从功能列表中移除功能][cargo-特性-remove-another]。

请参考相关链接以了解注意事项和示例。


## 功能文档和发现

建议记录您的包中可用的功能。可以在 `lib.rs` 顶部添加 [文档注释]。例如，查看 [regex crate source]，其渲染后的内容可在 [docs.rs][regex-docs-rs] 查看。如果您有其他文档，如用户指南，也可以将其添加到该处（例如，参见 [serde.rs]）。如果您有一个二进制项目，建议在 README 或其他项目文档中记录功能（例如，参见 [sccache]）。

明确记录功能可以设定关于被视为“不稳定”或不应使用的功能的预期。例如，如果有可选依赖，但您不希望用户将该可选依赖显式列为一个功能，则将其从文档列表中排除。

在 [docs.rs] 上发布的文档可以通过 `Cargo.toml` 中的元数据来控制构建文档时启用的功能。更多细节请参见 [docs.rs metadata documentation]。

> [!NOTE]
> Rustdoc 提供了实验性支持，用于标记文档以指示使用某些 API 需要哪些功能。更多详情请参阅 `doc_cfg` 文档。一个示例是 [`syn` 文档]，其中彩色框会注明使用该文档所需的特定功能。


### 发现功能

当库 API 中记录了功能时，用户可以更容易地了解哪些功能可用以及它们的作用。如果某个包的 기능文档不易获取，可以查看 `Cargo.toml` 文件，但有时很难找到。[crates.io] 上的 crate 页面如果有源仓库链接则会有提示。可以使用 [`cargo vendor`] 或 [cargo-clone-crate] 等工具下载源代码并进行检查。


## 功能组合

由于功能是条件编译的一种形式，要完全覆盖所有情况需要大量的配置和测试案例。默认情况下，测试、文档和其他工具（如 [Clippy](https://github.com/rust-lang/rust-clippy））仅会在默认功能集下运行。

我们建议您考虑针对不同的功能组合来制定策略和工具方案——每个项目在时间、资源以及覆盖特定场景的成本效益方面都有不同的要求。常见的配置可能包含或不包含默认功能，也可能采用特定的功能组合，或者同时使用所有功能组合。

[blog post]: https://blog.rust-lang.org/2023/10/26/broken-badges-and-23k-keywords.html
[conditional compilation]: ../../reference/conditional-compilation.md
[Features Examples]: features-examples.md
[crates.io]: https://crates.io/
[Unicode XID standard]: https://unicode.org/reports/tr31/
[ASCII alphanumeric]: ../../std/primitive.char.html#method.is_ascii_alphanumeric
[`--cfg` flag]: ../../rustc/command-line-arguments.md#option-cfg
[`cfg` expressions]: ../../reference/conditional-compilation.md
[`cfg` attribute]: ../../reference/conditional-compilation.md#the-cfg-attribute
[`cfg` macro]: ../../std/macro.cfg.html
[platform-specific dependencies]: specifying-dependencies.md#platform-specific-dependencies
[workspace]: workspaces.md
[`winapi`]: https://crates.io/crates/winapi
[winapi-features]: https://github.com/retep998/winapi-rs/blob/0.3.9/Cargo.toml#L25-L431
[`no_std`]: ../../reference/names/preludes.html#the-no_std-attribute
[features section]: resolver.md#features
[`cfg-if`]: https://crates.io/crates/cfg-if
[feature-precedence]: features-examples.md#feature-precedence
[`cargo tree`]: ../commands/cargo-tree.md
[target]: ../appendix/glossary.md#target
[resolver versions]: resolver.md#resolver-versions
[build-dependencies]: specifying-dependencies.md#build-dependencies
[dev-dependencies]: specifying-dependencies.md#development-dependencies
[resolver-v2]: resolver.md#feature-resolver-version-2
[build scripts]: build-scripts.md
[`required-features` field]: cargo-targets.md#the-required-features-field
[Cargo targets]: cargo-targets.md
[cargo-change-dep-feature]: semver.md#cargo-change-dep-feature
[cargo-dep-add]: semver.md#cargo-dep-add
[cargo-feature-add]: semver.md#cargo-feature-add
[item-remove]: semver.md#item-remove
[cargo-feature-remove]: semver.md#cargo-feature-remove
[cargo-remove-opt-dep]: semver.md#cargo-remove-opt-dep
[cargo-feature-remove-another]: semver.md#cargo-feature-remove-another
[docs.rs metadata documentation]: https://docs.rs/about/metadata
[docs.rs]: https://docs.rs/
[serde.rs]: https://serde.rs/feature-flags.html
[doc comments]: ../../rustdoc/how-to-write-documentation.html
[regex crate source]: https://github.com/rust-lang/regex/blob/1.4.2/src/lib.rs#L488-L583
[regex-docs-rs]: https://docs.rs/regex/1.4.2/regex/#crate-features
[sccache]: https://github.com/mozilla/sccache/blob/0.2.13/README.md#build-requirements
[`syn` documentation]: https://docs.rs/syn/1.0.54/syn/#modules
[`cargo vendor`]: ../commands/cargo-vendor.md
[cargo-clone-crate]: https://crates.io/crates/cargo-clone-crate
