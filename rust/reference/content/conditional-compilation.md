<a id="cfg"></a>
# 条件编译

<a id="cfg.syntax"></a> 
```grammar,configuration
ConfigurationPredicate ->
      ConfigurationOption
    | ConfigurationAll
    | ConfigurationAny
    | ConfigurationNot
    | `true`
    | `false`

ConfigurationOption ->
    IDENTIFIER ( `=` ( STRING_LITERAL | RAW_STRING_LITERAL ) )?

ConfigurationAll ->
    `all` `(` ConfigurationPredicateList? `)`

ConfigurationAny ->
    `any` `(` ConfigurationPredicateList? `)`

ConfigurationNot ->
    `not` `(` ConfigurationPredicate `)`

ConfigurationPredicateList ->
    ConfigurationPredicate (`,` ConfigurationPredicate)* `,`?
```

<a id="cfg.intro"></a> *条件编译的源代码*是指仅在特定条件下才会被编译的源代码。

<a id="cfg.attributes-宏"></a> 可以使用 [`cfg`] 和 [`cfg_attr`] [属性]以及内置的 [`cfg!`] 和 [`cfg_select!`] [宏]，使源代码实现条件编译。

<a id="cfg.conditional"></a> 是否进行编译取决于被编译 crate 的目标架构、传递给编译器的任意值以及其他下文将描述的因素。

<a id="cfg.predicate"></a> 每种条件编译形式都包含一个评估结果为真或假的 _配置谓词_。该谓词包括以下几种：

<a id="cfg.predicate-option"></a> * 配置选项。如果选项被设置，则谓词为真；如果未设置，则谓词为假。

<a id="cfg.predicate-all"></a> * `all()` 表示用逗号分隔的多个配置谓词列表。如果所有给定的谓词都为真，或者列表为空，则该值为真。

<a id="cfg.predicate-any"></a> * `any()` 表示用逗号分隔的多个配置谓词列表。如果至少有一个给定的谓词为真，则值为真；如果没有谓词，则值为假。

<a id="cfg.predicate-not"></a> * `not()` 表示带有配置谓词的参数。如果其谓词为假，则该参数为真；如果其谓词为真，则该参数为假。

<a id="cfg.predicate-literal"></a> * `true` 或 `false` 字面量，分别始终为真或假。

<a id="cfg.option-spec"></a> _配置选项_ 可以是名称或键值对，并且可以被设置或取消设置。

<a id="cfg.option-name"></a> 名称以单个标识符的形式书写，例如 `unix`。

<a id="cfg.option-key-value"></a> 键值对以标识符、`=` 和字符串的形式书写，例如 `target_arch = "x86_64"`。

> [!NOTE]
> Whitespace around the `=` is ignored, so `foo="bar"` and `foo = "bar"` are equivalent.

<a id="cfg.option-key-uniqueness"></a> 键不需要是唯一的。例如，`feature = "std"` 和 `feature = "serde"` 可以同时被设置。

<a id="cfg.options.set"></a>
## 设置配置选项

<a id="cfg.options.intro"></a> 哪些配置选项被设置是在 crate 编译过程中静态确定的。

<a id="cfg.options.target"></a> 某些选项基于编译数据，由编译器设定。

<a id="cfg.options.other"></a> 其他选项根据传递给编译器的外部输入任意设置。

<a id="cfg.options.crate"></a> 无法在正在编译的 crate 的源代码中设置配置选项。

> [!NOTE]
> For `rustc`, arbitrary-set configuration options are set using the [`--cfg`] flag. Configuration values for a specified target can be displayed with `rustc --print cfg --target $TARGET`.

> [!NOTE]
> Configuration options with the key `feature` are a convention used by [Cargo][cargo-feature] for specifying compile-time options and optional dependencies.

<a id="cfg.target_arch"></a>
### `target_arch`

<a id="cfg.target_arch.def"></a> 该键值选项与目标 CPU 架构一起设定一次。其值与平台目标三元组中的第一个元素类似，但并不完全相同。

<a id="cfg.target_arch.values"></a> 示例值：

* `"x86"` * `"x86_64"` * `"mips"` * `"powerpc"` * `"powerpc64"` * `"arm"` * `"aarch64"`

<a id="cfg.target_feature"></a>
### `target_feature`

<a id="cfg.target_feature.def"></a> 该键值选项针对当前编译目标可用的每个平台特性进行设定。

<a id="cfg.target_feature.values"></a> 示例值：

* `"avx"` * `"avx2"` * `"crt-static"` * `"rdrand"` * `"sse"` * `"sse2"` * `"sse4.1"`

有关可用特性的更多详细信息，请参阅 [`target_feature` 属性]。

<a id="cfg.target_feature.crt_static"></a> `crt-static` 的一个额外特性可通过 `target_feature` 选项指示存在 [静态 C 运行时]。

<a id="cfg.target_os"></a>
### `target_os`

<a id="cfg.target_os.def"></a> 该键值选项与目标操作系统一起设定一次。其值与平台目标三元组的第二和第三个元素类似。

<a id="cfg.target_os.values"></a> 示例值：

* `"windows"` * `"macos"` * `"ios"` * `"linux"` * `"android"` * `"freebsd"` * `"dragonfly"` * `"openbsd"` * `"netbsd"` * `"none"`（适用于嵌入式目标）

<a id="cfg.target_family"></a>
### `target_family`

<a id="cfg.target_family.def"></a> 该键值选项提供了对目标的更通用描述，例如目标所属的操作系统族或架构类型。可以设置任意数量的 `target_family` 键值对。

<a id="cfg.target_family.values"></a> 示例值：

* `"unix"` * `"windows"` * `"wasm"` * 同时包含 `"unix"` 和 `"wasm"`

<a id="cfg.target_family.unix"></a>
### `unix` 和 `windows`

如果设置 `target_family = "unix"，则 `unix` 会被启用。

<a id="cfg.target_family.windows"></a> 如果设置 `target_family = "windows"，则 `windows` 会被启用。

<a id="cfg.target_env"></a>
### `target_env`

<a id="cfg.target_env.def"></a> 键-值选项用于提供关于目标平台、ABI 或使用的 `libc` 的进一步澄清信息。出于历史原因，该值仅在需要澄清时才定义为非空字符串。因此，例如在许多 GNU 平台上，该值将为空。此值与平台目标三元组的第四个元素类似。不同之处在于，嵌入式 ABI 如 `gnueabihf` 会简单地将 `target_env` 定义为 `"gnu"`。

<a id="cfg.target_env.values"></a> 示例值：

* `""` * `"gnu"` * `"msvc"` * `"musl"` * `"sgx"` * `"sim"` * `"macabi"`

<a id="cfg.target_abi"></a>
### `target_abi`

<a id="cfg.target_abi.def"></a> 键-值选项用于提供关于目标 ABI 的进一步澄清信息。

<a id="cfg.target_abi.disambiguation"></a> 出于历史原因，该值仅在需要澄清时才定义为非空字符串。因此，例如在许多 GNU 平台上，该值将为空。

<a id="cfg.target_abi.values"></a> 示例值：

* `""` * `"llvm"` * `"eabihf"` * `"abi64"`

<a id="cfg.target_endian"></a>
### `target_endian`

键-值选项根据目标 CPU 的端序设置为“little”或“big”。

<a id="cfg.target_pointer_width"></a>
### `target_pointer_width`

<a id="cfg.target_pointer_width.def"></a> 键-值选项根据目标的指针宽度以位为单位进行设置。

<a id="cfg.target_pointer_width.values"></a> 示例值：

* `"16"`
* `"32"`
* `"64"`

<a id="cfg.target_vendor"></a>
### `target_vendor`

<a id="cfg.target_vendor.def"></a> 键-值选项用于提供关于目标供应商的信息。

<a id="cfg.target_vendor.values"></a> 示例值：

* `"apple"` * `"fortanix"` * `"pc"` * `"unknown"`

<a id="cfg.target_has_atomic"></a>
### `target_has_atomic`

<a id="cfg.target_has_atomic.def"></a> 用于指定目标支持原子加载、存储和比较交换操作时的每个位宽对应的键值选项。

<a id="cfg.target_has_atomic.stdlib"></a> 当此配置存在时，所有稳定的 [`core::sync::atomic`] API 都适用于相关的原子位宽。

<a id="cfg.target_has_atomic.values"></a> 可能的值：

* `"8"`
* `"16"`
* `"32"`
* `"64"`
* `"128"`
* `"ptr"`

<a id="cfg.target_has_atomic_primitive_alignment"></a>
### `target_has_atomic_primitive_alignment`

<a id="cfg.target_has_atomic_primitive_alignment.def"></a> 用于指定[原子][core::sync::atomic]类型与相应整数类型具有相同对齐方式的每个位宽对应的键值选项。

> [!NOTE]
> The alignment is usually the same for a given bit width. However, on some targets such as 32-bit x86, 64-bit atomic types such as [`AtomicI64`][core::sync::atomic::AtomicI64] have an alignment of 8 bytes while `i64` is only aligned to 4 bytes. In this situation, `target_has_atomic_primitive_alignment = "64"` is not set.

<a id="cfg.target_has_atomic_primitive_alignment.values"></a> 可能的值：

* `"8"`
* `"16"`
* `"32"`
* `"64"`
* `"128"`
* `"ptr"`

<a id="cfg.test"></a>
### `test`

在编译测试框架时启用。使用 [`--test`] 标志通过 `rustc` 实现。有关测试支持的更多信息，请参见[Testing]。

<a id="cfg.debug_assertions"></a>
### `debug_assertions`

默认情况下，在不进行优化的情况下编译时会启用此选项。可以在开发阶段使用它来启用额外的调试代码，但在生产环境中则不会。例如，它控制标准库中的 [`debug_assert!`] 宏的行为。

<a id="cfg.proc_macro"></a>
### `proc_macro`

在编译的 crate 使用 `proc_macro` [crate type]时设置此选项。

<a id="cfg.panic"></a>
### `panic`

<a id="cfg.panic.def"></a> 根据[panic策略]设置键值选项。注意，未来可能会添加更多值。

<a id="cfg.panic.values"></a> 示例值：

* `"abort"` * `"unwind"`


## 条件编译的形式

<!-- template:attributes -->
<a id="cfg.attr"></a>
### `cfg` 属性

<a id="cfg.attr.intro"></a> *`cfg` [属性]*根据配置谓词有条件地包含其附加形式。

> [!EXAMPLE]
> ```rust
> // The function is only included in the build when compiling for macOS
> #[cfg(target_os = "macos")]
> fn macos_only() {
>   // ...
> }
>
> // This function is only included when either foo or bar is defined
> #[cfg(any(foo, bar))]
> fn needs_foo_or_bar() {
>   // ...
> }
>
> // This function is only included when compiling for a unixish OS with a 32-bit
> // architecture
> #[cfg(all(unix, target_pointer_width = "32"))]
> fn on_32bit_unix() {
>   // ...
> }
>
> // This function is only included when foo is not defined
> #[cfg(not(foo))]
> fn needs_not_foo() {
>   // ...
> }
>
> // This function is only included when the panic strategy is set to unwind
> #[cfg(panic = "unwind")]
> fn when_unwinding() {
>   // ...
> }
> ```

<a id="cfg.attr.syntax"></a> `cfg` 属性的语法为：

```grammar,configuration
@root CfgAttribute -> `cfg` `(` ConfigurationPredicate `)`
```

<a id="cfg.attr.allowed-positions"></a> `cfg` 属性可以在允许使用属性的任何位置使用。

<a id="cfg.attr.duplicates"></a> `cfg` 属性可以在表单上被使用任意多次。如果任何 `cfg` 谓词为假，则不会将该属性附加到表单上，除非符合 [cfg.attr.crate-level-attrs] 中的描述。

<a id="cfg.attr.effect"></a> 如果谓词为真，则重新编写表单以去除其中的 `cfg` 属性。如果任何谓词为假，则从源代码中移除该表单。

<a id="cfg.attr.crate-level-attrs"></a> 当 crate 级别的 `cfg` 具有假谓词时，该 crate 仍然存在。在 `cfg` 之前的所有 crate 属性都会被保留，而在 `cfg` 之后的所有 crate 属性以及所有的后续内容也会被移除。

> [!EXAMPLE]
> The behavior of not removing the preceding attributes allows you to do things such as include `#![no_std]` to avoid linking `std` even if a `#![cfg(...)]` has otherwise removed the contents of the crate. For example:
>
> <!-- ignore: test infrastructure can't handle no_std -->
> ```rust,ignore
> // This `no_std` attribute is kept even though the crate-level `cfg`
> // attribute is false.
> #![no_std]
> #![cfg(false)]
>
> // This function is not included.
> pub fn example() {}
> ```

<!-- template:attributes -->
<a id="cfg.cfg_attr"></a>
### `cfg_attr` 属性

<a id="cfg.cfg_attr.intro"></a> *`cfg_attr` [属性]* 根据配置谓词有条件地包含属性。

> [!EXAMPLE]
> The following module will either be found at `linux.rs` or `windows.rs` based on the target.
>
> <!-- ignore: `mod` needs multiple files -->
> ```rust,ignore
> #[cfg_attr(target_os = "linux", path = "linux.rs")]
> #[cfg_attr(windows, path = "windows.rs")]
> mod os;
> ```

<a id="cfg.cfg_attr.syntax"></a> `cfg_attr` 属性的语法如下：

```grammar,configuration
@root CfgAttrAttribute -> `cfg_attr` `(` ConfigurationPredicate `,` CfgAttrs? `)`

CfgAttrs -> Attr (`,` Attr)* `,`?
```

<a id="cfg.cfg_attr.allowed-positions"></a> `cfg_attr` 属性可以在允许使用属性的任何位置使用。

<a id="cfg.cfg_attr.duplicates"></a> `cfg_attr` 属性可以在表单上被使用任意多次。

<a id="cfg.cfg_attr.attr-restriction"></a> [`crate_type`] 和 [`crate_name`] 属性不能与 `cfg_attr` 一起使用。

<a id="cfg.cfg_attr.behavior"></a> 当配置谓词为真时，`cfg_attr` 会展开为谓词之后列出的属性。

<a id="cfg.cfg_attr.attribute-list"></a> 可以列出零个、一个或多个属性。多个属性将各自展开为独立的属性。

> [!EXAMPLE]
> <!-- ignore: fake attributes -->
> ```rust,ignore
> #[cfg_attr(feature = "magic", sparkles, crackles)]
> fn bewitched() {}
>
> // When the `magic` feature flag is enabled, the above will expand to:
> #[sparkles]
> #[crackles]
> fn bewitched() {}
> ```

> [!NOTE]
> The `cfg_attr` can expand to another `cfg_attr`. For example, `#[cfg_attr(target_os = "linux", cfg_attr(feature = "multithreaded", some_other_attribute))]` is valid. This example would be equivalent to `#[cfg_attr(all(target_os = "linux", feature = "multithreaded"), some_other_attribute)]`.

<a id="cfg.宏"></a>
### `cfg` 宏

内置的 `cfg` 宏接受一个配置谓词，当谓词为真时返回 `true` 字面量，当谓词为假时返回 `false` 字面量。

例如：

```rust
let machine_kind = if cfg!(unix) {
  "unix"
} else if cfg!(windows) {
  "windows"
} else {
  "unknown"
};

println!("I'm running on a {} machine!", machine_kind);
```

<a id="cfg.cfg_select"></a>
### `cfg_select` 宏

<a id="cfg.cfg_select.intro"></a> 内置的 [`cfg_select!`][std::cfg_select] 宏可用于在编译时根据多个配置谓词选择代码。

> [!EXAMPLE]
> ```rust
> cfg_select! {
>     unix => {
>         fn foo() { /* unix specific functionality */ }
>     }
>     target_pointer_width = "32" => {
>         fn foo() { /* non-unix, 32-bit functionality */ }
>     }
>     _ => {
>         fn foo() { /* fallback implementation */ }
>     }
> }
>
> let is_unix_str = cfg_select! {
>     unix => "unix",
>     _ => "not unix",
> };
> ```

<a id="cfg.cfg_select.syntax"></a> 
```grammar,configuration
@root CfgSelect -> CfgSelectArms?

CfgSelectArms ->
    CfgSelectConfigurationPredicate `=>`
    (
        `{` ^ TokenTree `}` `,`? CfgSelectArms?
      | ExpressionWithBlockNoAttrs `,`? CfgSelectArms?
      | ExpressionWithoutBlockNoAttrs ( `,` CfgSelectArms? )?
    )

CfgSelectConfigurationPredicate ->
    ConfigurationPredicate | `_`
```

<a id="cfg.cfg_select.first-arm"></a> `cfg_select` 展开为配置谓词为真的第一支臂的有效载荷。

<a id="cfg.cfg_select.braces"></a> 如果整个有效载荷被包裹在花括号中，在展开过程中会移除这些花括号。

<a id="cfg.cfg_select.wildcard"></a> 配置谓词 `_` 始终评估为真。

<a id="cfg.cfg_select.fallthrough"></a> 如果没有任何谓词评估为真，则会导致编译错误。

<a id="cfg.cfg_select.well-formed"></a> 每个右侧项必须是宏被调用位置的语法有效的展开结果。

[panic strategy]: panic.md#panic-strategy
[Testing]: attributes/testing.md
[`--cfg`]: ../rustc/command-line-arguments.html#--cfg-configure-the-compilation-environment
[`--test`]: ../rustc/command-line-arguments.html#--test-build-a-test-harness
[`cfg`]: #the-cfg-attribute
[`cfg!`]: #the-cfg-macro
[`cfg_attr`]: #the-cfg_attr-attribute
[`cfg_select!`]: #the-cfg_select-macro
[`crate_name`]: crates-and-source-files.md#the-crate_name-attribute
[`crate_type`]: linkage.md
[`target_feature` attribute]: attributes/codegen.md#the-target_feature-attribute
[attribute]: attributes.md
[attributes]: attributes.md
[cargo-feature]: ../cargo/reference/features.html
[crate type]: linkage.md
[macros]: macros.md
[static C runtime]: linkage.md#static-and-dynamic-c-runtimes
