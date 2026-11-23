<a id="attributes.limits"></a>
# 限制

<a id="attributes.limits.intro"></a> 以下 [属性] 会影响编译时限制。

<a id="attributes.limits.recursion_limit"></a>
## `recursion_limit` 属性

<a id="attributes.limits.recursion_limit.intro"></a> *`recursion_limit` 属性* 可以在 [crate] 级别应用，以设置类似宏展开或自动引用等可能无限递归的编译时操作的最大深度。

<a id="attributes.limits.recursion_limit.syntax"></a> 它使用 [MetaNameValueStr] 语法来指定递归深度。

> [!NOTE]
> The default in `rustc` is 128.

```rust,compile_fail
#![recursion_limit = "4"]

macro_rules! a {
    () => { a!(1); };
    (1) => { a!(2); };
    (2) => { a!(3); };
    (3) => { a!(4); };
    (4) => { };
}

// This fails to expand because it requires a recursion depth greater than 4.
a!{}
```

```rust,compile_fail
#![recursion_limit = "1"]

// This fails because it requires two recursive steps to auto-dereference.
(|_: &u8| {})(&&&1);
```

<!-- template:attributes -->
<a id="attributes.limits.type_length_limit"></a>
## `type_length_limit` 属性

<a id="attributes.limits.type_length_limit.intro"></a> *`type_length_limit` [属性][attributes]* 设置在单态化过程中构建具体类型时允许的最大类型替换次数。

> [!NOTE]
> `rustc` only enforces the limit when the nightly `-Zenforce-type-length-limit` flag is active.
>
> For more information, see [Rust PR #127670](https://github.com/rust-lang/rust/pull/127670).

> [!EXAMPLE]
> <!-- ignore: not enforced without nightly flag -->
> ```rust,ignore
> #![type_length_limit = "4"]
>
> fn f<T>(x: T) {}
>
> // This fails to compile because monomorphizing to
> // `f::<((((i32,), i32), i32), i32)>` requires more
> // than 4 type elements.
> f(((((1,), 2), 3), 4));
> ```

> [!NOTE]
> The default value in `rustc` is `1048576`.

<a id="attributes.limits.type_length_limit.syntax"></a> `type_length_limit` 属性使用 [MetaNameValueStr] 语法，字符串中的值必须是非负数字。

<a id="attributes.limits.type_length_limit.allowed-positions"></a> `type_length_limit` 属性只能应用于 crate 根目录。

> [!NOTE]
> `rustc` ignores use in other positions but lints against it. This may become an error in the future.

<a id="attributes.limits.type_length_limit.duplicates"></a> `type_length_limit` 在项目上的首次使用才具有效果。

> [!NOTE]
> `rustc` lints against any use following the first. This may become an error in the future.

[attributes]: ../attributes.md
[crate]: ../crates-and-source-files.md
