# Lints

> [!NOTE]
> 本章介绍由 `cargo` 自身发出的 lints。

## 配置 Cargo lints

可以在 `Cargo.toml` 清单的 `[lints.cargo]` 表中配置 Cargo lints。关键值是去掉 `cargo::` 前缀后的 lint 名称。例如：

```toml
[lints.cargo]
unused_dependencies = "deny"
```

有关 lint 级别和优先级的详细信息，请参见 [`[lints]` 部分](清单.md#the-lints-section)。

## Lint 组

Cargo 有“lint 组”的概念，通过同一个名称可以切换多个警告。


| Group                | Description                                                       | Default level |
|----------------------|-------------------------------------------------------------------|---------------|
| `cargo::default`     | all lints that are on by default (correctness, style, suspicious) | warn/deny     |
| `cargo::correctness` | code that is outright wrong or useless                            | deny          |
| `cargo::style`       | code that should be written in a more idiomatic way               | warn          |
| `cargo::suspicious`  | code that is most likely wrong or useless                         | warn          |
| `cargo::pedantic`    | lints which are rather strict or have occasional false positives  | allow         |
| `cargo::restriction` | lints which prevent the use of Cargo features                     | allow         |


## 默认允许

这些 lints 默认都设置为 ‘allow’ 级别。 - [`manual_readme`](#manual_readme) - [`non_kebab_case_bins`](#non_kebab_case_bins) - [`non_kebab_case_features`](#non_kebab_case_features) - [`non_kebab_case_packages`](#non_kebab_case_packages) - [`non_snake_case_features`](#non_snake_case_features) - [`non_snake_case_packages`](#non_snake_case_packages)

## 默认警告

这些 lints 默认都设置为 ‘warn’ 级别。 - [`blanket_hint_mostly_unused`](#blanket_hint_mostly_unused) - [`missing_lints_inheritance`](#missing_lints_inheritance) - [`redundant_homepage`](#redundant_homepage) - [`unknown_lints`](#unknown_lints) - [`unused_dependencies`](#unused_dependencies) - [`unused_workspace_dependencies`](#unused_workspace_dependencies) - [`unused_workspace_package_fields`](#unused_workspace_package_fields)

## 默认拒绝

这些 lints 默认都设置为 ‘deny’ 级别。 - [`text_direction_codepoint_in_comment`](#text_direction_codepoint_in_comment) - [`text_direction_codepoint_in_literal`](#text_direction_codepoint_in_literal)

## `blanket_hint_mostly_unused`

- 组：`suspicious` - 级别：`warn` - 最小 [`package.rust-version`]：`1.79.0`


### 功能说明 检查所有依赖项是否应用了 `hint-mostly-unused`。

### 为什么这是不好的？`hint-mostly-unused` 表示该 crate 的大部分 API 接口将不会被依赖该 crate 的软件使用；此提示可以通过尝试最小化完全未使用的项目的编译时间来加速构建过程。如果应用于不符合此条件的 crate，则会反而减慢构建速度而非加快。应选择性地应用于符合这些条件的依赖项。全局应用此提示总是错误的做法，并且很可能会降低构建效率。

### 示例
```toml
[profile.dev.package."*"]
hint-mostly-unused = true
```

应该改为：
```toml
[profile.dev.package.huge-mostly-unused-dependency]
hint-mostly-unused = true
```


## `manual_readme`

- 分组：`pedantic` - 级别：`allow` - 最小 [`package.rust-version`]：`1.79.0`


### 功能说明

检查可以推断出的 `package.readme` 字段。

另请参阅 [`package.readme` 参考文档](清单.md#the-readme-field)。

### 为什么这是不好的？

增加了样板代码。

### 缺点

如果文件名命名正确，可能并不明显。

### 示例

```toml
[package]
name = "foo"
readme = "README.md"
```

应该写成：

```toml
[package]
name = "foo"
```


## `missing_lints_inheritance`

- 分组：`suspicious` - 级别：`warn` - 最小 [`package.rust-version`]：`1.79.0`


### 功能说明

检查在 `workspace.lints` 存在的情况下没有 `lints` 表的包。

### 为什么这是不好的？

许多人错误地认为 `workspace.lints` 是隐式继承的，实际上并非如此。

### 缺点

### 示例

```toml
[workspace.lints.cargo]
```

应该写成：

```toml
[workspace.lints.cargo]

[lints]
workspace = true
```

或者通过添加空的 `[lints]` 表来明确表明不打算继承：

```toml
[workspace.lints.cargo]

[lints]
```


## `non_kebab_case_bins`

- 分组：`pedantic` - 级别：`allow` - 最小 [`package.rust-version`]：`1.79.0`


### 功能说明

检测显式和隐式的二进制名称，如果不符合 kebab-case 格式则会被检测。

### 为什么这是不好的？

kebab-case 二进制名称是命令行工具中的常见惯例。

### 缺点

更改二进制名称会对现有用户造成干扰。

二进制文件可能需要遵循外部控制的规范，这些规范可能包含不同的命名约定。

GUI 应用程序可能希望采用更以用户为中心的命名规范，例如“标题大小写”或“句子大小写”。

### 示例

```toml
[[bin]]
name = "foo_bar"
```

应写作如下：

```toml
[[bin]]
name = "foo-bar"
```


## `non_kebab_case_features`

- 类别：`restriction` - 级别：`allow`


### 功能说明

检测不符合 kebab-case 规范的模块名称。

### 为何限制此行为？

在工作区中使用多种命名风格可能会造成混淆。

### 缺点

用户期望与依赖项紧密相关的模块名称应与该依赖项的名称一致。

### 示例

```toml
[features]
foo_bar = []
```

应写作如下：

```toml
[features]
foo-bar = []
```


## `non_kebab_case_packages`

- 类别：`restriction` - 级别：`allow`


### 功能说明

检测不符合 kebab-case 规范的包名称。

### 为何限制此行为？

在工作区中使用多种命名风格可能会造成混淆。

### 缺点

用户必须在心中将包名称转换为 Rust 中的命名空间。

### 示例

```toml
[package]
name = "foo_bar"
```

应写作如下：

```toml
[package]
name = "foo-bar"
```


## `non_kebab_case_packages`

- 类别：`restriction` - 级别：`allow`


### 功能说明

检测不符合 snake-case 规范的模块名称。

### 为何限制此行为？

在工作区中使用多种命名风格可能会造成混淆。

### 缺点

用户期望与依赖项紧密相关的模块名称应与该依赖项的名称一致。

### 示例

```toml
[features]
foo-bar = []
```

应写作如下：

```toml
[features]
foo_bar = []
```


## `non_kebab_case_packages`

- 类别：`restriction` - 级别：`allow`


### 功能说明

检测不符合 snake-case 规范的包名称。

### 为何限制此行为？

在工作区中使用多种命名风格可能会造成混淆。

### 缺点

用户必须在心中将包名称转换为 Rust 中的命名空间。

### 示例

```toml
[package]
name = "foo_bar"
```

应写作如下：

```toml
[package]
name = "foo-bar"
```


## `redundant_homepage`

- 类别：`style` - 级别：`warn` - 最小 [`package.rust-version`]: `1.79.0`


### 功能说明

检查 `package.homepage` 的值是否已被其他字段覆盖。

另请参阅 [`package.homepage` 参考文档](清单.md#the-homepage-field)。

### 为什么这是不好的？

当包浏览器渲染每个链接时，多余的链接会增加视觉噪音。

### 缺点

### 示例

```toml
[package]
name = "foo"
homepage = "https://github.com/rust-lang/cargo/"
repository = "https://github.com/rust-lang/cargo/"
```

应写作：

```toml
[package]
name = "foo"
repository = "https://github.com/rust-lang/cargo/"
```


## `text_direction_codepoint_in_comment`

- 类别：`correctness` - 级别：`deny` - 最低 [`package.rust-version`]：`1.79.0`


### 功能说明 检测清单注释中的 Unicode代码点，这些代码点在屏幕上的视觉表现与内存中的表现不一致。

### 为什么这是不好的？Unicode允许改变屏幕上文本的视觉呈现方式，以支持从右到左书写的脚本，但精心设计的注释可能导致编译后的代码看起来像是注释的一部分，具体取决于读取代码的软件。为了避免潜在问题或混淆，如 CVE-2021-42574 中所述，默认情况下我们禁止使用此类注释。


## `text_direction_codepoint_in_literal`

- 类别：`correctness` - 级别：`deny` - 最低 [`package.rust-version`]：`1.79.0`


### 功能说明 检测清单中的字面量中的 Unicode代码点，这些代码点的视觉表现与内存中的表现不一致。

### 为什么这是不好的？Unicode允许改变屏幕上文本的视觉呈现方式，以支持从右到左书写的脚本，但精心设计的字面量可能导致编译后的代码看起来像是字面量的一部分，具体取决于读取代码的软件。为了避免潜在问题或混淆，如 CVE-2021-42574 中所述，默认情况下我们禁止使用此类字面量。


## `unknown_lints`

- 类别：`suspicious` - 级别：`warn` - 最低 [`package.rust-version`]：`1.79.0`


### 功能说明 检查 `[lints.cargo]` 表中是否存在未知的警告。

### 为什么这是不好的？- 警告名称可能被拼写错误，导致对为何不起作用产生困惑 - 如果 `cargo` 将来决定使用相同名称的警告，该未知警告可能会引发错误。

### 示例
```toml
[lints.cargo]
this-lint-does-not-exist = "warn"
```


## `unused_dependencies`

- 类别：`style` - 级别：`warn` - 最低版本 [`package.rust-version`]: `1.79.0`


### 功能说明

检查那些未被任何 cargo 目标使用的依赖项。

### 为何如此糟糕？

会延长编译时间。

### 缺点

此lint 仅在特定情况下才会被触发，因为不同的依赖项对应多个 cargo 目标，必须构建所有这些目标才能确定某个依赖项是否被使用。目前仅检查选定的包，不像大多数 lint 那样检查所有 `path` 依赖项。由 `target."cfg(false)".dependencies` 标志决定的依赖项表会被检查，而该标志与哪些包被选中无关。由于无法选择所有使用 `[dev-dependencies]` 的 cargo 目标，因此这些依赖项不会被检查。

示例： - `cargo check` 会检查 `[build-dependencies]` 和 `[dependencies]` - `cargo check --all-targets` 仍然只检查 `[build-dependencies]` 和 `[dependencies]`，而不检查 `[dev-dependencies]` - `cargo check --bin foo` 即使 `foo` 是唯一的二进制文件，也不会检查 `[dependencies]`，但会检查 `[build-dependencies]` - `cargo check -p foo` 不会检查 `path` 依赖项 `bar` 的任何依赖项表，即使 `bar` 只有 `[lib]` 类型。

在依赖传递依赖以启用功能时可能会出现误报。

对于在 `Cargo.toml` 中固定传递依赖版本导致的误报，请将该依赖项移至 `target."cfg(false)".dependencies` 表中。

### 示例

```toml
[package]
name = "foo"

[dependencies]
unused = "1"
```

应写作：

```toml
[package]
name = "foo"
```


## `unused_workspace_dependencies`

- 类别：`suspicious` - 级别：`warn` - 最低版本 [`package.rust-version`]: `1.79.0`


### 功能说明 检查 `[workspace.dependencies]` 中未被继承的任何条目。

### 为何如此糟糕？它们可能给人的印象是这些依赖项被使用了。

### 示例
```toml
[workspace.dependencies]
regex = "1"

[dependencies]
```


## `unused_workspace_package_fields`

- 类别：`suspicious` - 级别：`warn` - 最低版本 [`package.rust-version`]: `1.79.0`


### 功能说明 检查 `[workspace.package]` 中未被继承的任何字段。

### 为什么这是不好的？它们可能会给人造成这些字段被使用的错误印象

### 示例
```toml
[workspace.package]
edition = "2024"

[package]
name = "foo"
```

[`package.rust-version`]: rust-version.md
