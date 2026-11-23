<!--
此文件由 `cargo bless --test config-metadata` 生成。请使用该命令更新文件，不要手动编辑。 -->

# lint 配置选项

以下列表展示了每个配置选项、描述、默认值、示例以及受影响的 lint 规则。

---

## `absolute-paths-allowed-crates` 允许使用绝对路径的 crate 列表

**默认值：** `[]`

---
**受影响的 lint：** * [`absolute_paths`](https://Clippy.rust-lang.org/main/index.html#absolute_paths)


## `absolute-paths-max-segments` 路径在被 lint 之前允许的最大段数，超过此数量的所有路径都会被 lint。

**默认值：** `2`

---
**受影响的 lint：** * [`absolute_paths`](https://Clippy.rust-lang.org/main/index.html#absolute_paths)


## `accept-comment-above-attributes` 是否允许在 `unsafe` 块中的属性上方放置安全注释

**默认值：** `true`

---
**受影响的 lint：** * [`undocumented_unsafe_blocks`](https://Clippy.rust-lang.org/main/index.html#undocumented_unsafe_blocks)


## `accept-comment-above-statement` 是否允许在包含 `unsafe` 块的语句上方放置安全注释

**默认值：** `true`

---
**受影响的 lint：** * [`undocumented_unsafe_blocks`](https://Clippy.rust-lang.org/main/index.html#undocumented_unsafe_blocks)


## `allow-comparison-to-zero` 当模运算的结果等于零时不进行 lint。

**默认值：** `true`

---
**受影响的 lint：** * [`modulo_arithmetic`](https://Clippy.rust-lang.org/main/index.html#modulo_arithmetic)


## `allow-dbg-in-tests` 是否在测试函数或 `#[cfg(test)]` 中允许使用 `dbg!`

**默认值：** `false`

---
**受影响的 lint：** * [`dbg_macro`](https://Clippy.rust-lang.org/main/index.html#dbg_macro)


## `allow-exact-repetitions` 是否允许项目名称与其包含模块的名称相同

**默认值：** `true`

---
**受影响的 lint：** * [`module_name_repetitions`](https://Clippy.rust-lang.org/main/index.html#module_name_repetitions)


## `allow-expect-in-consts` 是否在代码中始终在编译时评估 `expect` 是否允许使用

**默认值：** `true`

---
**受影响的 lint：** * [`expect_used`](https://Clippy.rust-lang.org/main/index.html#expect_used)


## `allow-expect-in-tests` 是否在测试函数或 `#[cfg(test)]` 中允许使用 `expect`

**默认值：** `false`

---
**受影响的 lint：** * [`expect_used`](https://Clippy.rust-lang.org/main/index.html#expect_used)


## `allow-indexing-slicing-in-tests` 是否在测试函数或 `#[cfg(test)]` 中允许使用 `indexing_slicing`

**默认值：** `false`

---
**受影响的 lint：** * [`indexing_slicing`](https://Clippy.rust-lang.org/main/index.html#indexing_slicing)


## `allow-large-stack-frames-in-tests` 是否应在 `#[cfg(test)]` 模块或测试函数中检查函数

**默认值：** `true`

---
**受影响的 lint：** * [`large_unopt_stack_frames`](https://Clippy.rust-lang.org/main/index.html#large_unopt_stack_frames)


## `allow-mixed-uninlined-format-args` 是否允许混合未内联格式参数，例如 `format!("{} {}", a, foo.bar)`

**默认值：** `true`

---
**受影响的 lint：** * [`uninlined_format_args`](https://Clippy.rust-lang.org/main/index.html#uninlined_format_args)


## `allow-one-hash-in-raw-strings` 是否允许在可以使用 `r""` 时使用 `r#""#`

**默认值：** `false`

---
**受影响的 lint：** * [`needless_raw_string_hashes`](https://Clippy.rust-lang.org/main/index.html#needless_raw_string_hashes)


## `allow-panic-in-tests` 是否应在测试函数或 `#[cfg(test)]` 中允许使用 `panic`

**默认值：** `false`

---
**受影响的 lint：** * [`panic`](https://Clippy.rust-lang.org/main/index.html#panic)


## `allow-print-in-tests` 是否应在测试函数或 `#[cfg(test)]` 中允许使用打印宏（如 `println!`）

**默认值：** `false`

---
**受影响的 lint：** * [`print_stderr`](https://Clippy.rust-lang.org/main/index.html#print_stderr) * [`print_stdout`](https://Clippy.rust-lang.org/main/index.html#print_stdout)


## `allow-private-module-inception` 是否允许非公共模块的创建。

**默认值：** `false`

---
**受影响的 lint：** * [`module_inception`](https://Clippy.rust-lang.org/main/index.html#module_inception)


## `allow-renamed-params-for` 在检查重命名函数参数时忽略的 trait 路径列表。

#### Example

```toml
allow-renamed-params-for = [ "std::convert::From" ]
```

#### Noteworthy

- 默认情况下，以下 traits 将被忽略：`From`、`TryFrom`、`FromStr` - `".."` 也可以用于该列表中，表示配置的值应被添加到 Clippy 的默认配置中。默认情况下，任何配置都将替代默认值。

**默认值：** `["core::convert::From", "core::convert::TryFrom", "core::str::FromStr"]`

---
**受影响的 lint：** * [`renamed_function_params`](https://Clippy.rust-lang.org/main/index.html#renamed_function_params)


## `allow-unwrap-in-consts` 是否在代码中的 `unwrap` 应在编译时始终被允许。

**默认值：** `true`

---
**受影响的 lint：** * [`unwrap_used`](https://Clippy.rust-lang.org/main/index.html#unwrap_used)


## `allow-unwrap-in-tests` 是否在测试函数或 `#[cfg(test)]` 中允许 `unwrap`。

**默认值：** `false`

---
**受影响的 lint：** * [`unwrap_used`](https://Clippy.rust-lang.org/main/index.html#unwrap_used)


## `allow-unwrap-types` 允许使用 `unwrap()` 和 `expect()` 的类型列表。

#### Example

```toml
allow-unwrap-types = [ "std::sync::LockResult" ]
```

**默认值：** `[]`

---
**受影响的 lint：** * [`expect_used`](https://Clippy.rust-lang.org/main/index.html#expect_used) * [`unwrap_used`](https://Clippy.rust-lang.org/main/index.html#unwrap_used)


## `allow-useless-vec-in-tests` 是否在测试函数或 `#[cfg(test)]` 中忽略 `useless_vec`。

**默认值：** `false`

---
**受影响的 lint：** * [`useless_vec`](https://Clippy.rust-lang.org/main/index.html#useless_vec)


## `allowed-dotfiles` 允许使用的额外点文件（以 `.` 开头的文件或目录）。

**默认值：** `[]`

---
**受影响的 lint：** * [`path_ends_with_ext`](https://Clippy.rust-lang.org/main/index.html#path_ends_with_ext)


## `allowed-duplicate-crates` 允许重复使用的 crate 名称列表

**默认值：** `[]`

---
**受影响的 lint：** * [`multiple_crate_versions`](https://Clippy.rust-lang.org/main/index.html#multiple_crate_versions)


## `allowed-idents-below-min-chars` 允许使用少于最小字符数的名称。值 `".."` 可以作为列表的一部分，表示所配置的数值应被添加到 Clippy 的默认配置中。默认情况下，任何配置都将替代默认值。

**默认值：** `["i", "j", "x", "y", "z", "w", "n"]`

---
**受影响的 lint：** * [`min_ident_chars`](https://Clippy.rust-lang.org/main/index.html#min_ident_chars)


## `allowed-prefixes` 在确定项目名称是否以模块名结尾时允许使用的前缀列表。如果项目的其余部分是允许的前缀（例如项目 `ToFoo` 或模块 `foo` 中的 `to_foo`），则不会发出警告。

#### Example

```toml
allowed-prefixes = [ "to", "from" ]
```

#### Noteworthy

- 默认情况下，允许使用以下前缀：`to`、`as`、`into`、`from`、`try_into` 和 `try_from` - PascalCase 变体会自动包含每个 snake_case 变体（例如，如果包含 `try_into`，则也会包含 `TryInto`） - 将 `".."` 作为列表的一部分，表示所配置的数值应被添加到 Clippy 的默认配置中。默认情况下，任何配置都将替代默认值

**默认值：** `["to", "as", "into", "from", "try_into", "try_from"]`

---
**受影响的 lint：** * [`module_name_repetitions`](https://Clippy.rust-lang.org/main/index.html#module_name_repetitions)


## `allowed-scripts` 在作用域内允许使用的 Unicode 脚本列表

**默认值：** `["Latin"]`

---
**受影响的 lint：** * [`disallowed_script_idents`](https://Clippy.rust-lang.org/main/index.html#disallowed_script_idents)


## `allowed-wildcard-imports` 允许使用通配符导入的路径段列表

#### Example

```toml
allowed-wildcard-imports = [ "utils", "common" ]
```

#### Noteworthy

1. 如果设置 `warn_on_all_wildcard_imports = true`，此配置无效。2. 包含单词 'prelude' 的任何路径段默认已被允许。

**默认值：** `[]`

---
**受影响的 lint 规则：** * [`wildcard_imports`](https://Clippy.rust-lang.org/main/index.html#wildcard_imports)


## `arithmetic-side-effects-allowed` 在所有操作类型中忽略传递的类型名称检查。

如果需要特定操作，请考虑使用 `arithmetic_side_effects_allowed_binary` 或 `arithmetic_side_effects_allowed_unary`。

#### Example

```toml
arithmetic-side-effects-allowed = ["SomeType", "AnotherType"]
```

#### Noteworthy

在此配置中列出的类型 `SomeType`，在 `arithmetic_side_effectsallowed_binary` 中的行为与 `["SomeType" , "*"], ["*", "SomeType"]` 相同。

**默认值：** `[]`

---
**受影响的 lint 规则：** * [`arithmetic_side_effects`](https://Clippy.rust-lang.org/main/index.html#arithmetic_side_effects)


## `arithmetic-side-effects-allowed-binary` 在加法或乘法等二元操作中忽略传递的类型对名称检查。

支持 "*" 通配符，表示某种类型不会触发 lint，与涉及的对应类型无关。例如 `["SomeType", "*"]` 或 `["*", "AnotherType"]`。

这些对是不对称的，这意味着 `["SomeType", "AnotherType"]` 与 `["AnotherType", "SomeType"]` 不同。

#### Example

```toml
arithmetic-side-effects-allowed-binary = [["SomeType" , "f32"], ["AnotherType", "*"]]
```

**默认值：** `[]`

---
**受影响的 lint 规则：** * [`arithmetic_side_effects`](https://Clippy.rust-lang.org/main/index.html#arithmetic_side_effects)


## `arithmetic-side-effects-allowed-unary` 在“取反”（`-`）等一元操作中忽略传递的类型名称检查。

#### Example

```toml
arithmetic-side-effects-allowed-unary = ["SomeType", "AnotherType"]
```

**默认值：** `[]`

---
**受影响的 lint 规则：** * [`arithmetic_side_effects`](https://Clippy.rust-lang.org/main/index.html#arithmetic_side_effects)


## `array-size-threshold` 栈上数组允许的最大大小。

**默认值：** `16384`

---
**受影响的 lint 规则：** * [`large_const_arrays`](https://Clippy.rust-lang.org/main/index.html#large_const_arrays) * [`large_stack_arrays`](https://Clippy.rust-lang.org/main/index.html#large_stack_arrays)


## `avoid-breaking-exported-api` 当建议的更改会导致其他 crate 出现破坏时，忽略相关 lint 规则。

**默认值：** `true`

---
**受影响的 lint 规则：** * [`box_collection`](https://Clippy.rust-lang.org/main/index.html#box_collection) * [`enum_variant_names`](https://Clippy.rust-lang.org/main/index.html#enum_variant_names) * [`large_types_passed_by_value`](https://Clippy.rust-lang.org/main/index.html#large_types_passed_by_value) * [`linkedlist`](https://Clippy.rust-lang.org/main/index.html#linkedlist) * [`needless_pass_by_ref_mut`](https://Clippy.rust-lang.org/main/index.html#needless_pass_by_ref_mut) * [`option_option`](https://Clippy.rust-lang.org/main/index.html#option_option) * [`owned_cow`](https://Clippy.rust-lang.org/main/index.html#owned_cow) * [`rc_buffer`](https://Clippy.rust-lang.org/main/index.html#rc_buffer) * [`rc_mutex`](https://Clippy.rust-lang.org/main/index.html#rc_mutex) * [`redundant_allocation`](https://Clippy.rust-lang.org/main/index.html#redundant_allocation) * [`ref_option`](https://Clippy.rust-lang.org/main/index.html#ref_option) * [`single_call_fn`](https://Clippy.rust-lang.org/main/index.html#single_call_fn) * [`trivially_copy_pass_by_ref`](https://Clippy.rust-lang.org/main/index.html#trivially_copy_pass_by_ref) * [`unnecessary_box_returns`](https://Clippy.rust-lang.org/main/index.html#unnecessary_box_returns) * [`unnecessary_wraps`](https://Clippy.rust-lang.org/main/index.html#unnecessary_wraps) * [`unused_self`](https://Clippy.rust-lang.org/main/index.html#unused_self) * [`upper_case_acronyms`](https://Clippy.rust-lang.org/main/index.html#upper_case_acronyms) * [`vec_box`](https://Clippy.rust-lang.org/main/index.html#vec_box) * [`wrong_self_convention`](https://Clippy.rust-lang.org/main/index.html#wrong_self_convention)


## `await_holding_invalid_types` 在 await 点之后不能持有的类型列表。

**默认值：** `[]`

---
**受影响的 lint 规则：** * [`await_holding_invalid_type`](https://Clippy.rust-lang.org/main/index.html#await_holding_invalid_type)


## `cargo-ignore_publish` 仅用于内部测试，会忽略 Cargo 清单中的当前 `publish` 设置。

**默认值：** `false`

---
**受影响的lint：** * [`cargo_common_metadata`](https://Clippy.rust-lang.org/main/index.html#cargo_common_metadata)


## `check-grouped-late-init` 是否检查多个 `let` 语句中的分组晚期初始化问题。

#### Example
```rust
let a;
let b;
if true {
    a = 1;
    b = 2;
} else {
    a = 3;
    b = 4;
}
```
请使用：
```rust
let (a, b) = if true {
    (1, 2)
} else {
    (3, 4)
};
```

**默认值：** `true`

---
**受影响的lint：** * [`needless_late_init`](https://Clippy.rust-lang.org/main/index.html#needless_late_init)


## `check-incompatible-msrv-in-tests` 是否检查 `#[test]` 和 `#[cfg(test)]` 代码中的 MSRV 兼容性。

**默认值：** `false`

---
**受影响的lint：** * [`incompatible_msrv`](https://Clippy.rust-lang.org/main/index.html#incompatible_msrv)


## `check-inconsistent-struct-field-initializers` 是否建议重新排序构造函数字段当存在初始化器时。

此配置产生的警告不一定仅通过重新排列字段就能解决。即使建议的代码可以编译，如果初始化表达式具有副作用，则可能会改变语义。以下来自 rust-Clippy#11846 的例子展示了该建议如何导致借用检查错误：

```rust
struct MyStruct {
    vector: Vec<u32>,
    length: usize
}
fn main() {
    let vector = vec![1,2,3];
    MyStruct { length: vector.len(), vector};
}
```


**默认值：** `false`

---
**受影响的lint：** * [`inconsistent_struct_constructor`](https://Clippy.rust-lang.org/main/index.html#inconsistent_struct_constructor)


## `check-private-items` 是否对私有项也运行列出的lint。

**默认值：** `false`

---
**受影响的lint：** * [`missing_errors_doc`](https://Clippy.rust-lang.org/main/index.html#missing_errors_doc) * [`missing_panics_doc`](https://Clippy.rust-lang.org/main/index.html#missing_panics_doc) * [`missing_safety_doc`](https://Clippy.rust-lang.org/main/index.html#missing_safety_doc) * [`too_long_first_doc_paragraph`](https://Clippy.rust-lang.org/main/index.html#too_long_first_doc_paragraph) * [`unnecessary_safety_doc`](https://Clippy.rust-lang.org/main/index.html#unnecessary_safety_doc)


## `cognitive-complexity-threshold` 函数所能拥有的最大认知复杂度。

**默认值：** `25`

---
**受影响的 lint 规则：** * [`cognitive_complexity`](https://Clippy.rust-lang.org/main/index.html#cognitive_complexity)


## `const-literal-digits-threshold` 常量浮点字面量必须包含的最小数字数量，以抑制 `excessive_precision` lint

**默认值：** `30`

---
**受影响的 lint 规则：** * [`excessive_precision`](https://Clippy.rust-lang.org/main/index.html#excessive_precision)


## `disallowed-fields` 不允许的字段列表，以完全限定路径形式呈现。

**字段：** - `path` (必填)：应被禁止的字段的完全限定路径 - `reason` (可选)：该字段被禁止的原因说明 - `replacement` (可选)：建议的替代方法 - `allow-invalid` (可选，默认值为 `false`)：设置为 `true` 时，如果路径不存在则忽略此条目，而不是发出错误提示

**默认值：** `[]`

---
**受影响的 lint 规则：** * [`disallowed_fields`](https://Clippy.rust-lang.org/main/index.html#disallowed_fields)


## `disallowed-macros` 不允许的宏列表，以完全限定路径形式呈现。

**字段：** - `path` (必填)：应被禁止的宏的完全限定路径 - `reason` (可选)：该宏被禁止的原因说明 - `replacement` (可选)：建议的替代宏 - `allow-invalid` (可选，默认值为 `false`)：设置为 `true` 时，如果路径不存在则忽略此条目，而不是发出错误提示

**默认值：** `[]`

---
**受影响的 lint 规则：** * [`disallowed_macros`](https://Clippy.rust-lang.org/main/index.html#disallowed_macros)


## `disallowed-methods` 不允许的方法列表，以完全限定路径形式呈现。

**字段：** - `path` (必填)：应被禁止的方法的完全限定路径 - `reason` (可选)：该方法被禁止的原因说明 - `replacement` (可选)：建议的替代方法 - `allow-invalid` (可选，默认值为 `false`)：设置为 `true` 时，如果路径不存在则忽略此条目，而不是发出错误提示

**默认值：** `[]`

---
**受影响的 lint 规则：** * [`disallowed_methods`](https://Clippy.rust-lang.org/main/index.html#disallowed_methods)


## `disallowed-names` 需要被 lint 检查的禁止名称列表。注意：`bar` 在此列表中不存在，因为它有合法的使用场景。值 `".."` 可用于列表的一部分，表示配置的选项应添加到 Clippy 的默认配置中。默认情况下，任何配置都会替换默认值。

**默认值：** `["foo", "baz", "quux"]`

---
**受影响的 lint 规则：** * [`disallowed_names`](https://Clippy.rust-lang.org/main/index.html#disallowed_names)


## `disallowed-types` 禁止的类型列表，以完全限定路径的形式呈现。

**字段说明：** - `path`（必填）：需要被禁止的类型的完全限定路径 - `reason`（可选）：该类型被禁止的原因说明 - `replacement`（可选）：建议的替代类型 - `allow-invalid`（可选，默认值为 `false`）：设置为 `true` 时，如果路径不存在则忽略此条目，而不是发出错误提示

**默认值：** `[]`

---
**受影响的 lint 规则：** * [`disallowed_types`](https://Clippy.rust-lang.org/main/index.html#disallowed_types)


## `doc-valid-idents` 该 lint 不应视为需要标注的标识符的单词列表。值 `".."` 可用于列表的一部分，表示配置的选项应添加到 Clippy 的默认配置中。默认情况下，任何配置都会替换默认值。例如：* `doc-valid-idents = ["ClipPy"]` 会将默认列表替换为 `["ClipPy"]`。* `doc-valid-idents = ["ClipPy", ".."]` 则会在默认列表中添加 `ClipPy`。

**默认值：** `["KiB", "MiB", "GiB", "TiB", "PiB", "EiB", "MHz", "GHz", "THz", "AccessKit", "CoAP", "CoreFoundation", "CoreGraphics", "CoreText", "DevOps", "Direct2D", "Direct3D", "DirectWrite", "DirectX", "ECMAScript", "GPLv2", "GPLv3", "GitHub", "GitLab", "IPv4", "IPv6", "InfiniBand", "RoCE", "ClojureScript", "CoffeeScript", "JavaScript", "PostScript", "PureScript", "TypeScript", "PowerPC", "PowerShell", "WebAssembly", "NaN", "NaNs", "OAuth", "GraphQL", "SQLite", "MySQL", "PostgreSQL", "MariaDB", "MongoDB", "OCaml", "OpenAL", "OpenDNS", "OpenGL", "OpenMP", "OpenSSH", "OpenSSL", "OpenStreetMap", "OpenTelemetry", "OpenType", "WebAuthn", "WebGL", "WebGL2", "WebGPU", "WebRTC", "WebSocket", "WebTransport", "WebP", "OpenExr", "YCbCr", "sRGB", "TensorFlow", "TrueType", "iOS", "macOS", "FreeBSD", "NetBSD", "OpenBSD", "NixOS", "TeX", "LaTeX", "BibTeX", "BibLaTeX", "MinGW", "CamelCase", "x86_64", "CommonMark", "IntelliJ"]`

---
**受影响的lint：** * [`doc_markdown`](https://Clippy.rust-lang.org/main/index.html#doc_markdown)


## `enable-raw-pointer-heuristic-for-send` 是否应用原始指针启发式来判断某个类型是否为 `Send`。

**默认值：** `true`

---
**受影响的lint：** * [`non_send_fields_in_send_ty`](https://Clippy.rust-lang.org/main/index.html#non_send_fields_in_send_ty)


## `enforce-iter-loop-reborrow` 是否建议对重新引用的值使用隐式迭代方式。

#### Example
```no_run
let mut vec = vec![1, 2, 3];
let rmvec = &mut vec;
for _ in rmvec.iter() {}
for _ in rmvec.iter_mut() {}
```

请使用以下选项：
```no_run
let mut vec = vec![1, 2, 3];
let rmvec = &mut vec;
for _ in &*rmvec {}
for _ in &mut *rmvec {}
```

**默认值：** `false`

---
**受影响的lint：** * [`explicit_iter_loop`](https://Clippy.rust-lang.org/main/index.html#explicit_iter_loop)


## `enforced-import-renames` 始终需要重命名的导入列表，即完全限定路径后跟重命名名称。

**默认值：** `[]`

---
**受影响的lint：** * [`missing_enforced_import_renames`](https://Clippy.rust-lang.org/main/index.html#missing_enforced_import_renames)


## `enum-variant-name-threshold` 触发变体名称相关lint的最小枚举变体数量。

**默认值：** `3`

---
**受影响的lint：** * [`enum_variant_names`](https://Clippy.rust-lang.org/main/index.html#enum_variant_names)


## `enum-variant-size-threshold` 为避免框选建议而设定的枚举变体最大大小限制

**默认值：** `200`

---
**受影响的 lint：** * [`large_enum_variant`](https://Clippy.rust-lang.org/main/index.html#large_enum_variant)


## `excessive-nesting-threshold` 块允许的最大嵌套深度限制

**默认值：** `0`

---
**受影响的 lint：** * [`excessive_nesting`](https://Clippy.rust-lang.org/main/index.html#excessive_nesting)


## `future-size-threshold` `Future` 的最大字节大小限制，超过此大小会触发 `clippy::large_futures` lint

**默认值：** `16384`

---
**受影响的 lint：** * [`large_futures`](https://Clippy.rust-lang.org/main/index.html#large_futures)


## `ignore-interior-mutability` 应被视为不含内部可变性类型的类型路径列表

**默认值：** `["bytes::Bytes"]`

---
**受影响的 lint：** * [`borrow_interior_mutable_const`](https://Clippy.rust-lang.org/main/index.html#borrow_interior_mutable_const) * [`declare_interior_mutable_const`](https://Clippy.rust-lang.org/main/index.html#declare_interior_mutable_const) * [`ifs_same_cond`](https://Clippy.rust-lang.org/main/index.html#ifs_same_cond) * [`mutable_key_type`](https://Clippy.rust-lang.org/main/index.html#mutable_key_type)


## `inherent-impl-lint-scope` 用于对同一类型重复固有 `impl` 块进行 lint 的scope（"crate"、"file"或"module"）

**默认值：** `"crate"`

---
**受影响的 lint：** * [`multiple_inherent_impl`](https://Clippy.rust-lang.org/main/index.html#multiple_inherent_impl)


## `large-error-ignored` 在函数返回的 `Result` 中应被忽略的过大 `Err`-变体类型路径列表

**默认值：** `[]`

---
**受影响的 lint：** * [`result_large_err`](https://Clippy.rust-lang.org/main/index.html#result_large_err)


## `large-error-threshold` 函数返回的 `Result` 中 `Err`-变体的最大大小限制

**默认值：** `128`

---
**受影响的 lint 规则：** * [`result_large_err`](https://Clippy.rust-lang.org/main/index.html#result_large_err)


## `lint-commented-code` 是否对包含注释的可折叠 `if` 和 `else if` 链进行 lint 检查。

**默认值：** `false`

---
**受影响的 lint 规则：** * [`collapsible_else_if`](https://Clippy.rust-lang.org/main/index.html#collapsible_else_if) * [`collapsible_if`](https://Clippy.rust-lang.org/main/index.html#collapsible_if)


## `literal-representation-threshold` 对十进制字面量的 lint 检查下限

**默认值：** `16384`

---
**受影响的 lint 规则：** * [`decimal_literal_representation`](https://Clippy.rust-lang.org/main/index.html#decimal_literal_representation)


## `matches-for-let-else` 是否应由 lint 检查，以及是否应对常见类型进行过滤。

**默认值：** `"WellKnownTypes"`

---
**受影响的 lint 规则：** * [`manual_let_else`](https://Clippy.rust-lang.org/main/index.html#manual_let_else)


## `max-fn-params-bools` 函数可以拥有的最大布尔参数数量。将 `0` 用于对包含布尔参数的任何函数进行 lint 检查。

**默认值：** `3`

---
**受影响的 lint 规则：** * [`fn_params_excessive_bools`](https://Clippy.rust-lang.org/main/index.html#fn_params_excessive_bools)


## `max-include-file-size` 通过 `include_bytes!()` 或 `include_str!()` 包含的文件的最大大小，以字节为单位

**默认值：** `1000000`

---
**受影响的 lint 规则：** * [`large_include_file`](https://Clippy.rust-lang.org/main/index.html#large_include_file)


## `max-struct-bools` 结构体可以拥有的最大布尔字段数量。将 `0` 用于对包含布尔字段的任何结构体进行 lint 检查。

**默认值：** `3`

---
**受影响的 lint 规则：** * [`struct_excessive_bools`](https://Clippy.rust-lang.org/main/index.html#struct_excessive_bools)


## `max-suggested-slice-pattern-length` 当 Clippy 建议使用切片模式时，这是所建议的切片模式中允许的元素最大数量。如果需要更多元素，则该 lint 将被忽略。例如，`[_, _, _, e, ..]` 是一个包含 4 个元素的切片模式。

**默认值：** `3`

---
**受影响的 lints：** * [`index_refutable_slice`](https://Clippy.rust-lang.org/main/index.html#index_refutable_slice)


## `max-trait-bounds` 一个 trait 可被 lint 的边界数量上限

**默认值：** `3`

---
**受影响的 lints：** * [`type_repetition_in_bounds`](https://Clippy.rust-lang.org/main/index.html#type_repetition_in_bounds)


## `may-panic-functions` 可能引发 panic 的函数/方法路径列表，应在调用处添加 `// Panic:` 注释进行说明。

**默认值：** `[]`

---
**受影响的 lints：** * [`undocumented_may_panic_call`](https://Clippy.rust-lang.org/main/index.html#undocumented_may_panic_call)


## `min-ident-chars-lint-trait-impl` 是否对字符数量过少的 ident 进行 lint，即使遵循 trait 声明也是如此。

**默认值：** `false`

---
**受影响的 lints：** * [`min_ident_chars`](https://Clippy.rust-lang.org/main/index.html#min_ident_chars)


## `min-ident-chars-threshold` ident 的最小字符数，低于或等于此值的所有 ident 都将被 lint。

**默认值：** `1`

---
**受影响的 lints：** * [`min_ident_chars`](https://Clippy.rust-lang.org/main/index.html#min_ident_chars)


## `missing-docs-allow-unused` 是否允许以下划线开头的字段跳过文档要求。

**默认值：** `false`

---
**受影响的 lints：** * [`missing_docs_in_private_items`](https://Clippy.rust-lang.org/main/index.html#missing_docs_in_private_items)


## `missing-docs-in-crate-items` 是否**仅**检查当前 crate 中可见项中的缺失文档。例如，`pub(crate)` 项。

**默认值：** `false`

---
**受影响的 lint 规则：** * [`missing_docs_in_private_items`](https://Clippy.rust-lang.org/main/index.html#missing_docs_in_private_items)


## `module-item-order-groupings` 模块内不同源项类型的命名分组方式。

**默认值：** `[["modules", ["extern_crate", "mod", "foreign_mod"]], ["use", ["use"]], ["macros", ["macro"]], ["global_asm", ["global_asm"]], ["UPPER_SNAKE_CASE", ["static", "const"]], ["PascalCase", ["ty_alias", "enum", "struct", "union", "trait", "trait_alias", "impl", "test_binder_constraints"]], ["lower_snake_case", ["fn"]]]`

---
**受影响的 lint 规则：** * [`arbitrary_source_item_ordering`](https://Clippy.rust-lang.org/main/index.html#arbitrary_source_item_ordering)


## `module-items-ordered-within-groupings` 模块内分组中的项是否应按字母顺序排序。

此选项可以配置为“全部”、“无”或特定分组名称列表（例如仅检查“enums”）。

**默认值：** `"none"`

---
**受影响的 lint 规则：** * [`arbitrary_source_item_ordering`](https://Clippy.rust-lang.org/main/index.html#arbitrary_source_item_ordering)


## `msrv` 项目支持的最低 Rust 版本。默认值为 `Cargo.toml` 中的 `rust-version` 字段。

**默认值：** `current version`

---
**受影响的 lint 规则：** * [`allow_attributes`](https://Clippy.rust-lang.org/main/index.html#allow_attributes) * [`allow_attributes_without_reason`](https://Clippy.rust-lang.org/main/index.html#allow_attributes_without_reason) * [`almost_complete_range`](https://Clippy.rust-lang.org/main/index.html#almost_complete_range) * [`approx_constant`](https://Clippy.rust-lang.org/main/index.html#approx_constant) * [`assigning_clones`](https://Clippy.rust-lang.org/main/index.html#assigning_clones) * [`borrow_as_ptr`](https://Clippy.rust-lang.org/main/index.html#borrow_as_ptr) * [`cast_abs_to_unsigned`](https://Clippy.rust-lang.org/main/index.html#cast_abs_to_unsigned) * [`checked_conversions`](https://Clippy.rust-lang.org/main/index.html#checked_conversions) * [`cloned_instead_of_copied`](https://Clippy.rust-lang.org/main/index.html#cloned_instead_of_copied) * [`collapsible_match`](https://Clippy.rust-lang.org/main/index.html#collapsible_match) * [`collapsible_str_replace`](https://Clippy.rust-lang.org/main/index.html#collapsible_str_replace) * [`deprecated_cfg_attr`](https://Clippy.rust-lang.org/main/index.html#deprecated_cfg_attr) * [`derivable_impls`](https://Clippy.rust-lang.org/main/index.html#derivable_impls) * [`err_expect`](https://Clippy.rust-lang.org/main/index.html#err_expect) * [`filter_map_next`](https://Clippy.rust-lang.org/main/index.html#filter_map_next) * [`from_over_into`](https://Clippy.rust-lang.org/main/index.html#from_over_into) * [`if_then_some_else_none`](https://Clippy.rust-lang.org/main/index.html#if_then_some_else_none) * [`implicit_saturating_sub`](https://Clippy.rust-lang.org/main/index.html#implicit_saturating_sub) * [`index_refutable_slice`](https://Clippy.rust-lang.org/main/index.html#index_refutable_slice) * [`inefficient_to_string`](https://Clippy.rust-lang.org/main/index.html#inefficient_to_string) * [`io_other_error`](https://Clippy.rust-lang.org/main/index.html#io_other_error) * [`iter_kv_map`](https://Clippy.rust-lang.org/main/index.html#iter_kv_map) * [`legacy_numeric_constants`](https://Clippy.rust-lang.org/main/index.html#legacy_numeric_constants) * [`len_zero`](https://Clippy.rust-lang.org/main/index.html#len_zero) * [`lines_filter_map_ok`](https://Clippy.rust-lang.org/main/index.html#lines_filter_map_ok) * [`manual_abs_diff`](https://Clippy.rust-lang.org/main/index.html#manual_abs_diff) * [`manual_bits`](https://Clippy.rust-lang.org/main/index.html#manual_bits) * [`manual_c_str_literals`](https://Clippy.rust-lang.org/main/index.html#manual_c_str_literals) * [`manual_clamp`](https://Clippy.rust-lang.org/main/index.html#manual_clamp) * [`manual_div_ceil`](https://Clippy.rust-lang.org/main/index.html#manual_div_ceil) * [`manual_flatten`](https://Clippy.rust-lang.org/main/index.html#manual_flatten) * [`manual_hash_one`](https://Clippy.rust-lang.org/main/index.html#manual_hash_one) * [`manual_is_ascii_check`](https://Clippy.rust-lang.org/main index.html#manual_is_ascii_check) * [`manual_is_power_of_two`](https://Clippy.rust-lang.org/main/index.html#manual_is_power_of_two) * [`manual_is_variant_and`](https://Clippy.rust-lang.org/main/index.html#manual_is_variant_and) * [`manual_isolate_lowest_one`](https://Clippy.rust-lang.org/main/index.html#manual_isolate_lowest_one) * [`manual_let_else`](https://Clippy.rust-lang.org/main/index.html#manual_let_else) * [`manual_midpoint`](https://Clippy.rust-lang.org/main/index.html#manual_midpoint) * [`manual_non_exhaustive`](https://Clippy.rust-lang.org/main/index.html#manual_non_exhaustive) * [`manual_noop_waker`](https://Clippy.rust-lang.org/main/index.html#manual_noop_waker) * [`manual_option_as_slice`](https://Clippy.rust-lang.org/main/index.html#manual_option_as_slice) * [`manual_pattern_char_comparison`](https://Clippy.rust-lang.org/main/index.html#manual_pattern_char_comparison) * [`manual_range_contains`](https://Clippy.rust-lang.org/main/index.html#manual_range_contains) * [`manual_rem_euclid`](https://Clippy.rust-lang.org/main/index.html#manual_rem_euclid) * [`manual_repeat_n`](https://Clippy.rust-lang.org/main/index.html#manual_repeat_n) * [`manual_retain`](https://Clippy.rust-lang.org/main/index.html#manual_retain) * [`manual_slice_fill`](https://Clippy.rust-lang.org/main index.html#manual_slice_fill) * [`manual_slice_size_calculation`](https://Clippy.rust-lang.org/main index.html#manual_slice_size_calculation) * [`manual_split_once`](https://Clippy.rust-lang.org/main/index.html#manual_split_once) * [`manual_str_repeat`](https://Clippy.rust-lang.org/main/index.html#manual_str_repeat) * [`manual_strip`](https://Clippy.rust-lang.org/main index.html#manual_strip) * [`manual_take`](https://Clippy.rust-lang.org/main index.html#manual_take) * [`manual_try_fold`](https://Clippy.rust-lang.org/main index.html#manual_try_fold) * [`map_clone`](https://Clippy.rust-lang.org/main index.html#map_clone) * [`map_unwrap_or`](https://Clippy.rust-lang.org/main index.html#map_unwrap_or) * [`map_with_unused_argument_over_ranges`](https://cl


## `pass-by-value-size-limit` 用于判断类型是否通过引用而非值传递的最小大小（以字节为单位）。

**默认值：** `256`

---
**受影响的 lint：** * [`large_types_passed_by_value`](https://Clippy.rust-lang.org/main/index.html#large_types_passed_by_value)


## `pub-underscore-fields-behavior` 根据导出可见性或是否标记为“pub”，对结构体中以下划线开头的“public”字段进行 lint 检查。

**默认值：** `"PubliclyExported"`

---
**受影响的 lint：** * [`pub_underscore_fields`](https://Clippy.rust-lang.org/main/index.html#pub_underscore_fields)


## `recursive-self-in-type-definitions` 在遇到递归类型时，是否用 `Self` 替换结构体或枚举中的类型本身。

**默认值：** `true`

---
**受影响的 lint：** * [`use_self`](https://Clippy.rust-lang.org/main/index.html#use_self)


## `semicolon-inside-block-ignore-singleline` 是否仅在多行情况下进行 lint 检查。

**默认值：** `false`

---
**受影响的 lint：** * [`semicolon_inside_block`](https://Clippy.rust-lang.org/main/index.html#semicolon_inside_block)


## `semicolon-outside-block-ignore-multiline` 是否仅在单行情况下进行 lint 检查。

**默认值：** `false`

---
**受影响的 lint：** * [`semicolon_outside_block`](https://Clippy.rust-lang.org/main/index.html#semicolon_outside_block)


## `single-char-binding-names-threshold` 作用域中单字符绑定的最大数量限制。

**默认值：** `4`

---
**受影响的 lint：** * [`many_single_char_names`](https://Clippy.rust-lang.org/main/index.html#many_single_char_names)


## `source-item-ordering` 内部应排序的元素类型，可能的值包括 `enum`、`impl`、`module`、`struct`、`trait`。

**默认值：** `["enum", "impl", "module", "struct", "trait"]`

---
**受影响的 lint：** * [`arbitrary_source_item_ordering`](https://Clippy.rust-lang.org/main/index.html#arbitrary_source_item_ordering)


## `stack-size-threshold` 函数的允许最大栈大小以字节为单位。

**默认值：** `512000`

---
**受影响的lint：** * [`large_unopt_stack_frames`](https://Clippy.rust-lang.org/main/index.html#large_unopt_stack_frames)


## `standard-macro-braces` 强制命名宏始终使用指定的花括号。

可以添加一个 `MacroMatcher`，格式如下 `{ name = "macro_name", brace = "(" }`。如果宏可以通过完整路径使用，则需要添加两个 `MacroMatcher`，一个使用完整路径 `crate_name::macro_name`，另一个仅使用宏名称。

**默认值：** `[]`

---
**受影响的lint：** * [`nonstandard_macro_braces`](https://Clippy.rust-lang.org/main/index.html#nonstandard_macro_braces)


## `struct-field-name-threshold` 触发字段名称相关lint的最小结构体字段数量

**默认值：** `3`

---
**受影响的lint：** * [`struct_field_names`](https://Clippy.rust-lang.org/main/index.html#struct_field_names)


## `suppress-restriction-lint-in-const` 是否抑制常量代码中的限制lint。在某些情况下，重构操作可能并非不可避免，因为常量代码中没有可用的替代方案。此配置将导致即使无法提供建议，也触发限制lint。

**默认值：** `false`

---
**受影响的lint：** * [`indexing_slicing`](https://Clippy.rust-lang.org/main/index.html#indexing_slicing)


## `too-large-for-stack` 将被 lint 的对象最大大小（以字节为单位）。在堆上较大的对象是可以的。

**默认值：** `200`

---
**受影响的lint：** * [`boxed_local`](https://Clippy.rust-lang.org/main/index.html#boxed_local) * [`useless_vec`](https://Clippy.rust-lang.org/main/index.html#useless_vec)


## `too-many-arguments-threshold` 函数或方法可以拥有的最大参数数量

**默认值：** `7`

---
**受影响的lint：** * [`too_many_arguments`](https://Clippy.rust-lang.org/main/index.html#too_many_arguments)


## `too-many-lines-threshold` 函数或方法可以拥有的最大行数

**默认值：** `100`

---
**受影响的lint：** * [`too_many_lines`](https://Clippy.rust-lang.org/main/index.html#too_many_lines)


## `trait-assoc-item-kinds-order` 特质中关联项目的排序方式。

**默认值：** `["const", "type", "fn"]`

---
**受影响的lint：** * [`arbitrary_source_item_ordering`](https://Clippy.rust-lang.org/main/index.html#arbitrary_source_item_ordering)


## `trait-impl-item-order` trait 实现 中关联项目的必需排序方式：纯字母顺序、遵循特质定义顺序，或接受任一方式。

请注意，定义该特质的 crate 版本之间可能会改变特质的定义顺序，但这并不被视为破坏性变更。

示例：使用特质定义项目排序方式时：
```toml
trait-impl-item-order = "trait_item_ordering"
```
当同时使用特质定义项目排序方式和字母顺序作为后备方案时：
```toml
trait-impl-item-order = "alphabetical_or_trait_item_ordering"
```

**默认值：** `"alphabetical"`

---
**受影响的lint：** * [`arbitrary_source_item_ordering`](https://Clippy.rust-lang.org/main/index.html#arbitrary_source_item_ordering)


## `trivial-copy-size-limit` 通过值传递而非引用传递时，`Copy` 类型的最大字节大小限制。

**默认值：** `target_pointer_width`

---
**受影响的lint：** * [`trivially_copy_pass_by_ref`](https://Clippy.rust-lang.org/main/index.html#trivially_copy_pass_by_ref)


## `type-complexity-threshold` 类型可以拥有的最大复杂度。

**默认值：** `250`

---
**受影响的lint：** * [`type_complexity`](https://Clippy.rust-lang.org/main/index.html#type_complexity)


## `unnecessary-box-size` `Box<T>` 中 `T` 可以拥有的字节大小，低于此大小会触发 `clippy::unnecessary_box` lint。

**默认值：** `128`

---
**受影响的lint：** * [`unnecessary_box_returns`](https://Clippy.rust-lang.org/main/index.html#unnecessary_box_returns)


## `unreadable-literal-lint-fractions` 是否应将小数的分数部分进行 lint，以包含分隔符。

**默认值：** `true`

---
**受影响的lint：** * [`unreadable_literal`](https://Clippy.rust-lang.org/main/index.html#unreadable_literal)


## `upper-case-acronyms-aggressive` 启用详细模式。当相邻字符中有多个大写字母时触发

**默认值：** `false`

---
**受影响的 lint：** * [`upper_case_acronyms`](https://Clippy.rust-lang.org/main/index.html#upper_case_acronyms)


## `vec-box-size-threshold` 允许 `Vec` 进行装箱时，盒化类型的字节大小

**默认值：** `4096`

---
**受影响的 lint：** * [`vec_box`](https://Clippy.rust-lang.org/main/index.html#vec_box)


## `verbose-bit-mask-threshold` 在建议使用 'trailing_zeros' 之前允许位掩码的最大大小

**默认值：** `1`

---
**受影响的 lint：** * [`verbose_bit_mask`](https://Clippy.rust-lang.org/main/index.html#verbose_bit_mask)


## `warn-on-all-wildcard-imports` 是否在所有通配符导入时发出警告，包括来自 `prelude`、测试中的 `super` 或 `pub use` reexport 的导入

**默认值：** `false`

---
**受影响的 lint：** * [`wildcard_imports`](https://Clippy.rust-lang.org/main/index.html#wildcard_imports)


## `warn-unsafe-macro-metavars-in-private-macros` 是否对 **私有** 宏中的不安全块和元变量展开也发出警告

**默认值：** `false`

---
**受影响的 lint：** * [`macro_metavars_in_unsafe`](https://Clippy.rust-lang.org/main/index.html#macro_metavars_in_unsafe)

[from rust-clippy#11846]: https://github.com/rust-lang/rust-clippy/issues/11846#issuecomment-1820747924
