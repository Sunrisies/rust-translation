<a id="names.preludes"></a>
# Preludes

<a id="names.preludes.intro"></a> *Prelude* 是指一组自动被引入到 crate 中每个模块作用域中的名称。

这些 prelude 名称并非模块本身的一部分：它们在 [name resolution] 过程中被隐式查询。例如，尽管像 [`Box`]这样的东西存在于每个模块的作用域中，但你不能将其引用为 `self::Box`，因为它不是当前模块的成员。

<a id="names.preludes.kinds"></a> 有几种不同的 preludes：

- [标准库 prelude] - [外部 prelude] - [语言 prelude] - [`macro_use` prelude] - [工具 prelude]

<a id="names.preludes.std"></a>
## 标准库 prelude

<a id="names.preludes.std.intro"></a> 每个 crate 都包含一个标准库 prelude，它由单个标准库模块中的名称组成。

<a id="names.preludes.std.module"></a> 使用的模块取决于 crate 的版本以及是否对该 crate 应用了 [`no_std` 属性：

版本 | `no_std` 未应用 | `no_std` 已应用
--------| --------------------------- | ----------------------------
2015 | [`std::prelude::rust_2015`] | [`core::prelude::rust_2015`] 2018 | [`std::prelude::rust_2018`] | [`core::prelude::rust_2018`] 2021 | [`std::prelude::rust_2021`] | [`core::prelude::rust_2021`] 2024 | [`std::prelude::rust_2024`] | [`core::prelude::rust_2024`]

> [!NOTE]
> [`std::prelude::rust_2015`] and [`std::prelude::rust_2018`] have the same contents as [`std::prelude::v1`].
>
> [`core::prelude::rust_2015`] and [`core::prelude::rust_2018`] have the same contents as [`core::prelude::v1`].

> [!NOTE]
> When one of [`core::panic!`] or [`std::panic!`] is brought into scope due to the [standard library prelude], and a user-written [glob import] brings the other into scope, `rustc` currently allows use of `panic!`, even though it is ambiguous. The user-written glob import takes precedence to resolve this ambiguity.
>
> For details, see [names.resolution.expansion.imports.ambiguity.panic-hack].

<a id="names.preludes.extern"></a>
## 外部 prelude

<a id="names.preludes.extern.intro"></a> 通过 [`extern crate`]在根模块中导入的外部 crate，或提供给编译器（如使用 `rustc` 的 `--extern` 标志）的 preludes，会被添加到 *external prelude* 中。如果通过别名导入，例如 `extern crate orig_name as new_name`，则符号 `new_name` 会被添加到 prelude 中。

<a id="names.preludes.extern.core"></a> [`core`] crate 总是被添加到 external prelude 中。

<a id="names.preludes.extern.std"></a> 只要在 crate 根中不指定 [`no_std` 属性]，则 [`std`] crate 会被添加为 external prelude。

<a id="names.preludes.extern.edition2018"></a> 
> [!EDITION-2018]
> In the 2015 edition, crates in the extern prelude cannot be referenced via [use declarations], so it is generally standard practice to include `extern crate` declarations to bring them into scope.
>
> Beginning in the 2018 edition, [use declarations] can reference crates in the extern prelude, so it is considered unidiomatic to use `extern crate`.

> [!NOTE]
> Additional crates that ship with `rustc`, such as [`alloc`], and [`test`](mod@test), are not automatically included with the `--extern` flag when using Cargo. They must be brought into scope with an `extern crate` declaration, even in the 2018 edition.
>
> ```rust
> extern crate alloc;
> use alloc::rc::Rc;
> ```
>
> Cargo does bring in `proc_macro` to the extern prelude for proc-macro crates only.

<!--
有关分配/测试限制的更多信息，请参见 https://github.com/rust-lang/rust/issues/57288。

<!-- template:attributes -->
<a id="names.preludes.extern.no_std"></a>
### `no_std` 属性

<a id="names.preludes.extern.no_std.intro"></a> *`no_std` [属性][attributes]* 导致 [`std`] 库不会自动链接，而 [标准库前导库] 将使用 `core` 前导库。

> [!EXAMPLE]
> <!-- ignore: test infrastructure can't handle no_std -->
> ```rust,ignore
> #![no_std]
> ```

> [!NOTE]
> Using `no_std` is useful when either the crate is targeting a platform that does not support the standard library or is purposefully not using the capabilities of the standard library. Those capabilities are mainly dynamic memory allocation (e.g. `Box` and `Vec`) and file and network capabilities (e.g. `std::fs` and `std::io`).

> [!WARNING]
> Using `no_std` does not prevent the standard library from being linked. It is still valid to write `extern crate std` in the crate or in one of its dependencies; this will cause the compiler to link the `std` crate into the program.

<a id="names.preludes.extern.no_std.syntax"></a> `no_std` 属性使用 [MetaWord] 语法。

<a id="names.preludes.extern.no_std.allowed-positions"></a> `no_std` 属性只能应用于 crate 根目录。

<a id="names.preludes.extern.no_std.duplicates"></a> `no_std` 属性可以在一个形式上使用任意多次。

> [!NOTE]
> `rustc` lints against any use following the first.

<a id="names.preludes.extern.no_std.module"></a> `no_std` 属性使 [标准库前导库] 使用 `core` 前导库而非 `std` 前导库。

<a id="names.preludes.extern.no_std.edition2018"></a> 
> [!EDITION-2018]
> Before the 2018 edition, `std` is injected into the crate root by default. If `no_std` is specified, `core` is injected instead. Starting with the 2018 edition, regardless of `no_std` being specified, neither is injected into the crate root.

<a id="names.preludes.lang"></a>
## 语言前导库

<a id="names.preludes.lang.intro"></a> 语言前导库包含该语言内置的类型和属性名称。语言前导库始终处于作用域中。

<a id="names.preludes.lang.entities"></a> 包括以下内容：

* [类型命名空间] * [布尔类型] --- `bool` * [`char`] * [`str`] * [整数类型] --- `i8`, `i16`, `i32`, `i64`, `i128`, `u8`, `u16`, `u32`, `u64`, `u128` * [机器相关整数类型] --- `usize` 和 `isize` * [浮点类型] --- `f32` 和 `f64` * [宏命名空间] * [内置属性] * [内置 derive 宏][attributes.derive.built-in]

<a id="names.preludes.macro_use"></a>
## `macro_use` 前导库

<a id="names.preludes.macro_use.intro"></a> `macro_use` 前导库包含由 [`extern crate`] 应用的 [`macro_use` 属性] 导入的外部 crates 中的宏。

<a id="names.preludes.tool"></a>
## 工具前导库

<a id="names.preludes.tool.intro"></a> 工具前导库包含 [类型命名空间] 中外部工具的名称。更多详情请参阅 [工具属性] 部分。

<!-- template:attributes -->
<a id="names.preludes.no_implicit_prelude"></a>
## `no_implicit_prelude` 属性

<a id="names.preludes.no_implicit_prelude.intro"></a> *`no_implicit_prelude` [属性]* 用于防止隐式前导库进入作用域。

> [!EXAMPLE]
> ```rust
> // The attribute can be applied to the crate root to affect
> // all modules.
> #![no_implicit_prelude]
>
> // Or it can be applied to a module to only affect that module
> // and its descendants.
> #[no_implicit_prelude]
> mod example {
>     // ...
> }
> ```

<a id="names.preludes.no_implicit_prelude.syntax"></a> `no_implicit_prelude` 属性使用 [MetaWord] 语法。

<a id="names.preludes.no_implicit_prelude.allowed-positions"></a> `no_implicit_prelude` 属性只能应用于 crate 或模块。

> [!NOTE]
> `rustc` ignores use in other positions but lints against it. This may become an error in the future.

<a id="names.preludes.no_implicit_prelude.duplicates"></a> `no_implicit_prelude` 属性可以在一个形式上使用任意多次。

> [!NOTE]
> `rustc` lints against any use following the first.

<a id="names.preludes.no_implicit_prelude.excluded-preludes"></a> `no_implicit_prelude` 属性禁止 [标准库 prelude]、[extern prelude]、 [`macro_use` prelude] 和 [工具 prelude] 进入模块及其子模块的作用域。

<a id="names.preludes.no_implicit_prelude.implicitly-imported-macros"></a> 
> [!NOTE]
> Despite `#![no_implicit_prelude]`, `rustc` currently brings certain macros implicitly into scope. Those macros are:
>
> - [`assert!`]
> - [`cfg!`]
> - [`cfg_select!`]
> - [`column!`]
> - [`compile_error!`]
> - [`concat!`]
> - [`concat_bytes!`]
> - [`env!`]
> - [`file!`]
> - [`format_args!`]
> - [`include!`]
> - [`include_bytes!`]
> - [`include_str!`]
> - [`line!`]
> - [`module_path!`]
> - [`option_env!`]
> - [`panic!`]
> - [`stringify!`]
> - [`unreachable!`]
>
> E.g., this works:
>
> ```rust
> #![no_implicit_prelude]
> fn main() { assert!(true); }
> ```
>
> Don't rely on this behavior; it may be removed in the future. Always bring the items you need into scope explicitly when using `#![no_implicit_prelude]`.
>
> For details, see [Rust PR #62086](https://github.com/rust-lang/rust/pull/62086) and [Rust PR #139493](https://github.com/rust-lang/rust/pull/139493).

<a id="names.preludes.no_implicit_prelude.lang"></a> `no_implicit_prelude` 属性不影响 [语言 prelude]。

<a id="names.preludes.no_implicit_prelude.edition2018"></a> 
> [!EDITION-2018]
> In the 2015 edition, the `no_implicit_prelude` attribute does not affect the [`macro_use` prelude], and all macros exported from the standard library are still included in the `macro_use` prelude. Starting in the 2018 edition, the attribute does remove the `macro_use` prelude.

[glob import]: items.use.glob
[standard library prelude]: names.preludes.std

[`char`]: ../types/char.md
[`extern crate`]: ../items/extern-crates.md
[`macro_use` attribute]: ../macros-by-example.md#the-macro_use-attribute
[`macro_use` prelude]: #macro_use-prelude
[`no_std` attribute]: #the-no_std-attribute
[`str`]: ../types/str.md
[attribute]: ../attributes.md
[Boolean type]: ../types/boolean.md
[Built-in attributes]: ../attributes.md#built-in-attributes-index
[extern prelude]: #extern-prelude
[floating-point types]: ../types/numeric.md#floating-point-types
[Integer types]: ../types/numeric.md#integer-types
[Language prelude]: #language-prelude
[Machine-dependent integer types]: ../types/numeric.md#machine-dependent-integer-types
[Macro namespace]: namespaces.md
[name resolution]: name-resolution.md
[tool attributes]: ../attributes.md#tool-attributes
[Tool prelude]: #tool-prelude
[Type namespace]: namespaces.md
[use declarations]: ../items/use-declarations.md
