<a id="abi"></a>
# 应用二进制接口 (ABI)

<a id="abi.intro"></a> 本部分记录了影响 crate 编译输出 ABI 的特性。

关于指定导出函数的 ABI，请参阅 *[extern functions]*。关于指定链接外部库的 ABI，请参阅 *[external blocks]*。

<!-- template:attributes -->
<a id="abi.used"></a>
## `used` 属性

<a id="abi.used.intro"></a> *`used` [属性]* 强制将 [静态] 数据保留在输出对象文件 (.o, .rlib等，不包括最终二进制文件）中，即使该数据从未被使用或由 crate 中的其他项引用。然而，链接器仍然可以将其删除。

> [!EXAMPLE]
> ```rust
> // lib.rs
>
> // This is kept because of `#[used]`.
> #[used]
> static S1: u8 = 0;
>
> // This is removable because it's unused.
> #[allow(dead_code)]
> static S2: u8 = 0;
>
> // This is kept because it's publicly reachable.
> pub static S3: u8 = 0;
>
> // This is kept because it's referenced by a publicly
> // reachable function.
> static S4: u8 = 0;
> #[unsafe(no_mangle)] pub fn f4() -> &'static u8 { &S4 }
>
> // This is removable because it's referenced only by a
> // private, unused (dead) function.
> static S5: u8 = 0;
> #[allow(dead_code)]
> fn f5() -> &'static u8 { &S5 }
> ```
>
> ```console
> $ rustc -O --emit=obj --crate-type=rlib lib.rs
> $ LC_ALL=C nm -C lib.o
> 0000000000000000 R lib::S1
> 0000000000000000 R lib::S3
> 0000000000000000 r lib::S4
> 0000000000000000 T f4
> ```

<a id="abi.used.syntax"></a> `used` 属性使用 [MetaWord] 语法。

<a id="abi.used.allowed-positions"></a> `used` 属性只能应用于 [`静态` 项]。

<a id="abi.used.duplicates"></a> `used` 在项上的首次使用才具有效果。

> [!NOTE]
> `rustc` lints against any use following the first.

<a id="abi.no_mangle"></a>
## `no_mangle` 属性

<a id="abi.no_mangle.intro"></a> *`no_mangle` [属性]* 禁用 [函数] 或 [静态] 数据的标准符号名混淆功能。该项的符号即为其标识符。

> [!EXAMPLE]
> ```rust
> #[unsafe(no_mangle)]
> extern "C" fn foo() {}
> ```

<a id="abi.no_mangle.syntax"></a> `no_mangle` 属性使用 [MetaWord] 语法。

<a id="abi.no_mangle.allowed-positions"></a> `no_mangle` 属性只能应用于：

- [静态项][items.static] - [自由函数][items.fn] - [固有关联函数][items.associated_fn] - [trait 实现 函数][items.实现.trait]

> [!NOTE]
> `rustc` lints against use in other positions. This may become an error in the future.

<!-- TODO: Currently it works on a trait function with a body, but generates a warning about being phased out. how do we document that?
https://github.com/rust-lang/rust/pull/86492#issuecomment-885682960 -->

<!-- TODO: should this clarify that external block items are already unmangled?, and thus the attribute does nothing? Currently it is "phased out" warning. -->

<a id="abi.no_mangle.closures"></a> `no_mangle` 属性不得与 [闭包] 一起使用。

<a id="abi.no_mangle.generics"></a> `no_mangle` 属性不得用于具有泛型参数的项。

<a id="abi.no_mangle.duplicates"></a> `no_mangle` 在项上的首次使用才具有效果。

> [!NOTE]
> `rustc` lints against any use following the first.

<a id="abi.no_mangle.export_name"></a> 当 `no_mangle` 和 [`export_name`][abi.export_name] 属性都应用于同一项时，使用 `export_name` 中的符号名，而 `no_mangle` 无效。

> [!NOTE]
> `rustc` lints against this combination.

<a id="abi.no_mangle.不安全"></a> 必须标记 [`unsafe`][attributes.safety] 属性，因为未解包的符号可能会与具有相同名称（或已知符号）的其他符号发生冲突，导致未定义行为。

<a id="abi.no_mangle.edition2024"></a> 
> [!EDITION-2024]
> Before the 2024 edition, it is allowed to use the `no_mangle` attribute without `unsafe`.

<a id="abi.no_mangle.publicly-exported"></a> 除了禁用名称解析外，`no_mangle` 属性还会使该符号从生成的库或对象文件中被公开导出，类似于 [`used`][abi.used] 属性。

<a id="abi.no_mangle.ascii-only"></a> `no_mangle` 属性仅可用于名称只包含 ASCII 字符的项。

<a id="abi.link_section"></a>
## `link_section` 属性

<a id="abi.link_section.intro"></a> *`link_section` 属性* 指定了 [函数] 或 [静态] 的内容将放入的对象文件的哪个部分。

<a id="abi.link_section.syntax"></a> `link_section` 属性使用 [MetaNameValueStr] 语法来指定部分名称。

<!-- no_run: don't link. The format of the section name is platform-specific. -->
```rust,no_run
# #[cfg(target_os = "linux")] {
#[unsafe(no_mangle)]
#[unsafe(link_section = ".example_section")]
pub static VAR1: u32 = 1;
# }
```

<a id="abi.link_section.不安全"></a> 该属性不安全，因为它允许用户将数据和代码放入不期望它们的内存区域中，例如将可变数据放入只读区域。

<a id="abi.link_section.duplicates"></a> `link_section` 在项上的首次使用才有效。

> [!NOTE]
> `rustc` lints against any use following the first with a future-compatibility warning. This may become an error in the future.

<a id="abi.link_section.edition2024"></a> 
> [!EDITION-2024]
> Before the 2024 edition it is allowed to use the `link_section` attribute without the `unsafe` qualification.

<a id="abi.export_name"></a>
## `export_name` 属性

<a id="abi.export_name.intro"></a> *`export_name` 属性* 指定了将在 [函数] 或 [静态] 上导出的符号名称。

<a id="abi.export_name.syntax"></a> `export_name` 属性使用 [MetaNameValueStr] 语法来指定符号名称。

```rust
#[unsafe(export_name = "exported_symbol_name")]
pub fn name_in_rust() { }
```

<a id="abi.export_name.不安全"></a> 该属性不安全，因为具有自定义名称的符号可能会与具有相同名称（或已知符号）的其他符号发生冲突，导致未定义行为。

<a id="abi.export_name.duplicates"></a> `export_name` 在项上的首次使用才有效。

> [!NOTE]
> `rustc` lints against any use following the first with a future-compatibility warning. This may become an error in the future.

<a id="abi.export_name.edition2024"></a> 
> [!EDITION-2024]
> Before the 2024 edition it is allowed to use the `export_name` attribute without the `unsafe` qualification.

[closure]: expr.closure
[`static` items]: items.static

[attribute]: attributes.md
[extern functions]: items/functions.md#extern-function-qualifier
[external blocks]: items/external-blocks.md
[function]: items/functions.md
[item]: items.md
[static]: items/static-items.md
