# 配置 Clippy

> **注意：** 配置文件不稳定，未来可能被废弃。

某些 lint 可以通过名为 `clippy.toml` 或 `.clippy.toml` 的 TOML 文件进行配置，该文件会在第一个定义目录中按以下优先级顺序被查找：

1. 由 `CLIPPY_CONF_DIR` 环境变量指定的目录；或 2. 由 [CARGO_MANIFEST_DIR](https://doc.rust-lang.org/cargo/reference/environment-variables.html) 环境变量指定的目录；或 3. 当前目录。

如果所选目录中不包含配置文件，Clippy 将遍历目录树，逐层向上查找，直到找到配置文件或到达文件系统根目录。

该文件包含基本的 `variable = value` 映射关系，例如：

```toml
avoid-breaking-exported-api = false
disallowed-names = ["toto", "tata", "titi"]
```

[配置表](./lint_configuration.md)中列出了所有配置值、其默认值以及它们影响的 lint。每个 [可配置的 lint](https://rust-lang.github.io/rust-Clippy/main/index.html#Configuration)，也包含有关这些值的信息。

对于以列表形式呈现且带有默认值的配置，如 [禁止的单词](https://rust-lang.github.io/rust-Clippy/main/index.html#disallowed_names)，可以使用唯一值 `".."` 来扩展默认值，而不是替换它们。

```toml
# default of disallowed-names is ["foo", "baz", "quux"]
disallowed-names = ["bar", ".."] # -> ["bar", "foo", "baz", "quux"]
```

要禁用“如需更多信息请访问 *lint-link*”消息，可以定义 `CLIPPY_DISABLE_DOCS_LINKS` 环境变量。

### 允许/禁止 lint

#### 代码中的属性

您可以在代码中添加属性以 `allow`/`warn`/`deny` Clippy lint：

* 所有默认使用 `warn` 的 lint，通过 `clippy` lint group 指定（`#![allow(clippy::all)`）

* 同时使用 `clippy` 和 `clippy::pedantic` lint group 的所有 lint（`#![warn(clippy::all, clippy::pedantic)`）。注意，`clippy::pedantic` 包含一些非常激进的 lint，容易产生误报。

* 仅某些 lint（`#![deny(clippy::single_match, clippy::box_vec)]`等）

* `allow`/`warn`/`deny` 可以通过 `#[allow(...)]` 等语法限制在单个函数或模块上。

注意：`allow` 表示抑制代码的lint检查。使用 `warn` 时，lint仅发出警告；而使用 `deny` 时，当代码触发时会发出错误。错误会导致 Clippy以错误码退出，因此它在 CI/CD 中使用的脚本中非常有用。

#### 命令行标志

如果您不希望在代码中包含lint级别，可以在运行期间向 Clippy传递额外标志来全局启用/禁用lint：

要允许 `lint_name`，请运行：

```terminal
cargo clippy -- -A clippy::lint_name
```

要在 `lint_name` 上发出警告，请运行：

```terminal
cargo clippy -- -W clippy::lint_name
```

这同样适用于lint组。例如，您可以运行带有所有严谨lint的警告的Clippy：

```terminal
cargo clippy -- -W clippy::pedantic
```

如果您只关心某些lint，可以允许其他所有lint，然后明确对您感兴趣的lint发出警告：

```terminal
cargo clippy -- -A clippy::all -W clippy::useless_format -W clippy::...
```

#### `Cargo.toml` 中的lint部分

最后，可以使用 [`Cargo.toml` 中的 lint部分](https://doc.rust-lang.org/nightly/cargo/reference/manifest.html#the-lints-section)来允许/禁止lint：

要在 `Cargo.toml` 中禁用 `clippy::enum_glob_use`，请添加以下内容：

```toml
[lints.clippy]
enum_glob_use = "deny"
```

有关更多细节和选项，请参阅 Cargo 文档。

### 指定最低支持的 Rust 版本

打算支持旧版 Rust 的项目可以通过在 Clippy配置文件中指定最低支持的 Rust 版本 (MSRV) 来禁用与新功能相关的lint。

```toml
msrv = "1.30.0"
```

MSRV也可以作为属性指定，如下所示。

```rust,ignore
#![feature(custom_inner_attributes)]
#![clippy::msrv = "1.30.0"]

fn main() {
    ...
}
```

在指定 MSRV 时，您也可以省略补丁版本，因此 `msrv = 1.30` 等同于 `msrv = 1.30.0`。

> **注意：** 某些lint的行为会根据配置的 MSRV 而变化。> 在某些情况下，Clippy可能会完全抑制lint以避免建议在配置 MSRV 时不可用的API或> 语法。> 在其他情况下，Clippy可能会发出lint但选择更旧的兼容建议。

> **注意：** `custom_inner_attributes` 是一个不稳定的特性，因此必须> 显式启用。

能够识别此配置选项的lint可以在 [这里](https://rust-lang.github.io/rust-Clippy/main/index.html#msrv)找到。

### 禁用某些代码的评估

> **注意：** 只有在其他解决方案（如 `#[allow(clippy::all)]`）不足的情况下才应使用此选项。

极少数情况下，您可能希望完全阻止 Clippy评估代码的某些部分。可以通过 [条件编译](https://doc.rust-lang.org/reference/conditional-compilation.html) 来实现，只需确保未设置 `clippy` 配置。您可能需要提供一个占位符代码，以便代码能够编译通过：

```rust
#[cfg(not(clippy))]
include!(concat!(env!("OUT_DIR"), "/my_big_function-generated.rs"));

#[cfg(clippy)]
fn my_big_function(_input: &str) -> Option<MyStruct> {
    None
}
```
