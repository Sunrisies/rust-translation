<!-- template:attributes -->
<a id="attributes.derive"></a>
# Derive

<a id="attributes.derive.intro"></a> *`derive` [属性]* 会调用一个或多个 [derive 宏]，从而自动为数据结构生成新的 [项]。你可以使用 [过程式宏] 来创建 `derive` 宏。

> [!EXAMPLE]
> The [`PartialEq`][macro@PartialEq] derive macro emits an [implementation] of [`PartialEq`] for `Foo<T> where T: PartialEq`. The [`Clone`][macro@Clone] derive macro does likewise for [`Clone`].
>
> ```rust
> #[derive(PartialEq, Clone)]
> struct Foo<T> {
>     a: i32,
>     b: T,
> }
> ```
>
> The generated `impl` items are equivalent to:
>
> ```rust
> # struct Foo<T> { a: i32, b: T }
> impl<T: PartialEq> PartialEq for Foo<T> {
>     fn eq(&self, other: &Foo<T>) -> bool {
>         self.a == other.a && self.b == other.b
>     }
> }
>
> impl<T: Clone> Clone for Foo<T> {
>     fn clone(&self) -> Self {
>         Foo { a: self.a.clone(), b: self.b.clone() }
>     }
> }
> ```

<a id="attributes.derive.syntax"></a> `derive` 属性使用 [MetaListPaths] 语法来指定要调用的 [derive 宏] 列表。

<a id="attributes.derive.allowed-positions"></a> `derive` 属性只能应用于 [structs][项.结构体}、[enums][项.枚举] 和 [unions][项.union]。

<a id="attributes.derive.duplicates"></a> `derive` 属性可以在一个项上使用任意多次，所有在属性中列出的 derive 宏都会被调用。

<a id="attributes.derive.stdlib"></a> `derive` 属性在标准库中被导出为：

- [`core::derive`] - [`std::derive`] - [`core::prelude::v1::derive`] - [`std::prelude::v1::derive`]

<a id="attributes.derive.built-in"></a> 内置 derive 定义在 [语言预集][names.preludes.lang] 中。内置 derive 的列表如下：

- [`Clone`] - [`Copy`] - [`Debug`] - [`Default`] - [`Eq`] - [`Hash`] - [`Ord`] - [`PartialEq`] - [`PartialOrd`]

<a id="attributes.derive.built-in-automatically_derived"></a> 内置 derive 在其生成的实现上包含 [`automatically_derived` 属性]。

<a id="attributes.derive.behavior"></a> 在宏展开过程中，对于 derive 列表中的每个元素，对应的 derive 宏会展开为零个或多个 [项]。

<!-- template:attributes -->
<a id="attributes.derive.automatically_derived"></a>
## `automatically_derived` 属性

<a id="attributes.derive.automatically_derived.intro"></a> *`automatically_derived` [属性]* 用于注释一个 [实现]，表示该实现是由 [derive 宏] 自动生成的。它没有直接效果，但可被工具和诊断工具用来检测这些自动生成的实现。

> [!EXAMPLE]
> Given [`#[derive(Clone)]`][macro@Clone] on `struct Example`, the [derive macro] may produce:
>
> ```rust
> # struct Example;
> #[automatically_derived]
> impl ::core::clone::Clone for Example {
>     #[inline]
>     fn clone(&self) -> Self {
>         Example
>     }
> }
> ```

<a id="attributes.derive.automatically_derived.syntax"></a> `automatically_derived` 属性使用 [MetaWord] 语法。

<a id="attributes.derive.automatically_derived.allowed-positions"></a> `automatically_derived` 属性只能应用于一个 [实现]。

> [!NOTE]
> `rustc` ignores use in other positions but lints against it. This may become an error in the future.

<a id="attributes.derive.automatically_derived.duplicates"></a> 在某个实现上多次使用 `automatically_derived` 与仅使用一次具有相同的效果。

> [!NOTE]
> `rustc` lints against any use following the first.

<a id="attributes.derive.automatically_derived.behavior"></a> `automatically_derived` 属性没有行为特性。

[derive macro]: macro.proc.derive
[derive macros]: macro.proc.derive
[procedural macros]: macro.proc.derive

[items]: ../items.md
[implementation]: ../items/implementations.md
[items]: ../items.md
