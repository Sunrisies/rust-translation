<a id="items.extern-crate"></a>
# 外部 crate 声明

<a id="items.extern-crate.syntax"></a> 
```grammar,items
ExternCrate -> `extern` `crate` CrateRef AsClause? `;`

CrateRef -> IDENTIFIER | `self`

AsClause -> `as` ( IDENTIFIER | `_` )
```

<a id="items.extern-crate.intro"></a> _`extern crate` 声明用于指定对外部 crate 的依赖。

<a id="items.extern-crate.namespace"></a> 随后将外部 crate 绑定到声明范围中，作为 [类型命名空间] 中的给定 [标识符]。

<a id="items.extern-crate.extern-prelude"></a> 此外，如果 `extern crate` 出现在 crate 根部，则 crate 名称也会被添加到 [extern prelude] 中，使其在所有模块中自动处于作用域内。

<a id="items.extern-crate.as"></a> 可以使用 `as` 子句将导入的 crate 绑定到不同的名称。

<a id="items.extern-crate.lookup"></a> 在编译时，外部 crate 会被解析为特定的 `soname`，并且针对该 `soname` 的运行时链接要求会被传递给链接器以便在运行时加载。`soname` 在编译时通过扫描编译器的库路径并匹配在外部 crate 编译时声明的 [`crate_name` 属性] 中提供的可选 `crate_name` 来解析。如果未提供 `crate_name`，则假设有一个默认的 `name` 属性，等于 `extern crate` 声明中的 [标识符]。

<a id="items.extern-crate.self"></a> 可以导入 `self` crate，从而创建对当前 crate 的绑定。在这种情况下，必须使用 `as` 子句来指定要绑定的名称。

以下是三个 `extern crate` 声明的示例：

<!-- ignore: requires external crates -->
```rust,ignore
extern crate pcre;

extern crate std; // equivalent to: extern crate std as std;

extern crate std as ruststd; // linking to 'std' under another name
```

<a id="items.extern-crate.name-restrictions"></a> 在命名 Rust crate 时，连字符是不允许的。然而，Cargo 包可以使用它们。在这种情况下，当 `Cargo.toml` 未指定 crate 名称时，Cargo 会透明地将 `-` 替换为 `_`（更多细节请参考 [RFC 940]）。

这是一个示例：

<!-- ignore: requires external crates -->
```rust,ignore
// Importing the Cargo package hello-world
extern crate hello_world; // hyphen replaced with an underscore
```

<a id="items.extern-crate.underscore"></a>
## 下划线导入

<a id="items.extern-crate.underscore.intro"></a> 可以通过使用下划线的形式 `extern crate foo as _` 来声明外部 crate 依赖，而无需将其名称绑定到作用域中。这可能对那些仅需要链接但从未被引用的 crate 很有用，并且可以避免被报告为未使用的 crate。

<a id="items.extern-crate.underscore.macro_use"></a> 该 [`macro_use` 属性] 仍正常工作，并将宏名称引入到 [`macro_use` 前导模块]中。

<!-- template:attributes -->
<a id="items.extern-crate.no_link"></a>
## `no_link` 属性

<a id="items.extern-crate.no_link.intro"></a> *`no_link` [属性][attributes]* 可以应用于 `extern crate` 项，以阻止该套件被链接。

> [!NOTE]
> This is helpful, e.g., when only the macros of a crate are needed.

> [!EXAMPLE]
> <!-- ignore: requires external crates -->
> ```rust,ignore
> #[no_link]
> extern crate other_crate;
>
> other_crate::some_macro!();
> ```

<a id="items.extern-crate.no_link.syntax"></a> `no_link` 属性使用 [MetaWord] 语法。

<a id="items.extern-crate.no_link.allowed-positions"></a> `no_link` 属性只能应用于 `extern crate` 声明。

> [!NOTE]
> `rustc` ignores use in other positions but lints against it. This may become an error in the future.

<a id="items.extern-crate.no_link.duplicates"></a> `no_link` 在 `extern crate` 声明上的首次使用才具有效果。

> [!NOTE]
> `rustc` lints against any use following the first. This may become an error in the future.

[identifier]: ../identifiers.md
[RFC 940]: https://github.com/rust-lang/rfcs/blob/master/text/0940-hyphens-considered-harmful.md
[`macro_use` attribute]: ../macros-by-example.md#the-macro_use-attribute
[extern prelude]: ../names/preludes.md#extern-prelude
[`macro_use` prelude]: ../names/preludes.md#macro_use-prelude
[`crate_name` attributes]: ../crates-and-source-files.md#the-crate_name-attribute
[type namespace]: ../names/namespaces.md
