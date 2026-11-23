<a id="type.fn-pointer"></a>
# 函数指针类型

<a id="type.fn-pointer.syntax"></a> 
```grammar,types
BareFunctionType ->
    ForLifetimes? FunctionTypeQualifiers `fn`
       `(` FunctionParametersMaybeNamedVariadic? `)` BareFunctionReturnType?

FunctionTypeQualifiers -> `unsafe`? (`extern` Abi?)?

BareFunctionReturnType -> `->` TypeNoBounds

FunctionParametersMaybeNamedVariadic ->
    MaybeNamedFunctionParameters | MaybeNamedFunctionParametersVariadic

MaybeNamedFunctionParameters ->
    MaybeNamedParam ( `,` MaybeNamedParam )* `,`?

MaybeNamedParam ->
    OuterAttribute* ( ( IDENTIFIER | `_` ) `:` )? Type

MaybeNamedFunctionParametersVariadic ->
    ( MaybeNamedParam `,` )* MaybeNamedParam `,` OuterAttribute* `...`
```

<a id="type.fn-pointer.intro"></a> 使用 `fn` 关键字定义的函数指针类型，指的是在编译时不一定能确定的函数的身份。

一个将 `Binop` 定义为函数指针类型的示例：

```rust
fn add(x: i32, y: i32) -> i32 {
    x + y
}

let mut x = add(5,7);

type Binop = fn(i32, i32) -> i32;
let bo: Binop = add;
x = bo(5,7);
```

<a id="type.fn-pointer.coercion"></a> 可以通过从 [函数项] 和非捕获、非异步 [闭包] 进行强制转换来创建函数指针。

<a id="type.fn-pointer.qualifiers"></a> `unsafe` 限定符表示该类型的值是一个 [不安全的函数]，而 `extern` 限定符表示它是一个 [外部函数]。

<a id="type.fn-pointer.constraint-variadic"></a> 如果函数是变长的，其 `extern` ABI 必须是 [items.extern.variadic.conventions] 中列出的一种。

<a id="type.fn-pointer.extern-custom"></a> `extern "custom"` 函数指针必须遵循 [items.fn.extern.custom.signature] 中的规则。

<a id="type.fn-pointer.attributes"></a>
## 函数指针参数的属性

函数指针参数的属性遵循与 [常规函数参数] 相同的规则和限制。

[`extern`]: ../items/external-blocks.md
[closures]: closure.md
[extern function]: ../items/functions.md#extern-function-qualifier
[function items]: function-item.md
[unsafe function]: ../unsafe-keyword.md
[regular function parameters]: ../items/functions.md#attributes-on-function-parameters
