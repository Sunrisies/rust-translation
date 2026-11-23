<a id="type.never"></a>
# Never 类型

<a id="type.never.intro"></a> `!` 类型是一个没有值的类型，表示永远不会完成的计算，也称为 [发散][divergence] 计算。

> [!EXAMPLE]
> ```rust
> fn foo() -> ! {
>     loop {}
> }
> ```
>
> ```rust
> unsafe extern "C" {
>     pub safe fn no_return_extern_func() -> !;
> }
> ```
>
> ```rust,no_run
> let _: ! = loop {};
> ```
>
> ```rust
> fn always_ok() -> Result<u32, !> {
>     Ok(42)
> }
> ```
>
> ```rust
> # use std::str::FromStr;
> struct Anything(String);
>
> impl FromStr for Anything {
>     type Err = !;
>
>     fn from_str(s: &str) -> Result<Self, !> {
>         Ok(Anything(s.to_owned()))
>     }
> }
>
> // This does not need to check for the `Err` variant because
> // `FromStr::Err` is the never type.
> let Ok(s) = Anything::from_str("example");
> ```

<a id="type.never.syntax"></a> 
```grammar,types
NeverType -> `!`
```

<a id="type.never.coercion"></a> `!` 类型的表达式可以被强制转换为任何类型。

<a id="type.never.layout"></a> `!` 类型的大小为 0，对齐方式为 1。

> [!NOTE]
> The standard library type [`Infallible`] is a type alias for `!`.

[`Infallible`]: core::convert::Infallible


