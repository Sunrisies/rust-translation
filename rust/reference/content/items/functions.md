<a id="items(fn) # 函数"></a> 

<a id="items(fn.syntax)"></a> 
```grammar,items
Function ->
    FunctionQualifiers `fn` IDENTIFIER GenericParams?
        `(` FunctionParameters? `)`
        FunctionReturnType? WhereClause?
        ( BlockExpression | `;` )

FunctionQualifiers -> `const`? `async`?[^async-edition] ItemSafety?[^extern-qualifiers] (`extern` Abi?)?

ItemSafety -> `safe`[^extern-safe] | `unsafe`

Abi -> STRING_LITERAL | RAW_STRING_LITERAL

FunctionParameters ->
      SelfParam `,`?
    | (SelfParam `,`)? FunctionParam (`,` FunctionParam)* `,`?

SelfParam -> OuterAttribute* ( ShorthandSelf | TypedSelf )

ShorthandSelf -> (`&` | `&` Lifetime)? `mut`? `self`

TypedSelf -> `mut`? `self` `:` Type

FunctionParam -> OuterAttribute* ( FunctionParamPattern | `...` | Type[^fn-param-2015] )

FunctionParamPattern -> PatternNoTopAlt `:` ( Type | `...` )

FunctionReturnType -> `->` Type
```





<a id="items(fn.intro)"></a> 一个_函数_由[块]（即函数的_主体_）、名称、一组参数以及输出类型组成。除了名称外，这些元素都是可选的。

<a id="items(fn.namespace)"></a> 使用关键字`fn`声明函数，该关键字在模块或块的[值命名空间]中定义给定的名称。

<a id="items(fn.signature)"></a> 函数可以声明一组*输入*[*变量]*作为参数，调用者通过这些参数向函数传递参数；同时可以声明*输出*[*类型]*，即函数在完成操作后返回给调用者的数值类型。

<a id="items(fn.implicit-return)"></a> 如果未明确指定输出类型，则默认为[单位类型]。

<a id="items(fn.fn-item-type)"></a> 当引用一个_函数_时，它会产生相应[零大小][variables]的第一类*值，调用该值时相当于直接调用该函数。

例如，这是一个简单的函数：

```rust
fn answer_to_life_the_universe_and_everything() -> i32 {
    return 42;
}
```

<a id="items(fn.safety-qualifiers)"></a> `safe`函数仅在使用[extern块]时具有语义意义。

<a id="items(fn.params)"></a>
## 函数参数

<a id="items(fn.params.intro)"></a> 函数参数是不可否定的[模式]，因此任何在无`else`的`let`绑定中有效的模式也可以作为参数使用。

```rust
fn first((value, _): (i32, i32)) -> i32 { value }
```

<a id="items(fn.params.self-pat)"></a> 如果第一个参数是[SelfParam]，则表示该函数是[方法]。

<a id="items(fn.params.self-restriction)"></a> 具有自参数的函数只能作为[trait]或[implementation]中的[关联函数]出现。

<a id="items.fn.params.varargs"></a> 带有 `...` 标记的参数表示 [C-variadic函数]，只能作为最后一个参数使用。在 [`extern` 块]中的函数声明中，C-variadic参数可以包含模式，例如 `ap: ...`；而在 trait 定义中的 [C-variadic函数] 定义或 C-variadic关联函数声明中，模式是必需的。

```rust
unsafe extern "C" {
    unsafe fn f1(...);
    unsafe fn f2(ap: ...);
}

unsafe extern "C" fn f3(ap: ...) {}

trait Tr {
    unsafe extern "C" fn f4(ap: ...);
}
```

```rust,compile_fail
unsafe extern "C" fn f(...) {} // ERROR: Missing pattern.
```

```rust,compile_fail
trait Tr {
    unsafe extern "C" fn f(...); // ERROR: Missing pattern.
}
```

<a id="items.fn.body"></a>
## 函数体

<a id="items.fn.body.intro"></a> 函数的体块在概念上被另一个块包裹，该块首先绑定参数模式，然后返回函数体的值。这意味着该块的尾部表达式如果被计算，最终会被返回给调用者。通常，如果函数在体内出现明确的返回表达式，则会跳过隐式的返回。

例如，上述函数的行为就像它是这样写的：

<!-- ignore: example expansion -->
```rust,ignore
// argument_0 is the actual first argument passed from the caller
let (value, _) = argument_0;
return {
    value
};
```

<a id="items.fn.body.bodyless"></a> 没有体块的函数以分号结束。这种形式只能出现在 [trait] 或 [external block]中。

<a id="items.fn.generics"></a>
## 泛型函数

<a id="items.fn.generics.intro"></a> _泛型函数_ 允许在其签名中出现一个或多个 _参数化类型_。每个类型参数必须按照函数名称后紧跟的方括号括起并用逗号分隔的列表形式进行显式声明。

```rust
// foo is generic over A and B

fn foo<A, B>(x: A, y: B) {
# }
```

<a id="items.fn.generics.param-names"></a> 在函数签名和体块中，类型参数的名称可以用作类型名。

<a id="items.fn.generics.param-bounds"></a> [trait] 边界可以针对类型参数指定，以便可以在该类型的数值上调用来自该 trait 的方法。这是使用 `where` 语法来指定的。

```rust
# use std::fmt::Debug;
fn foo<T>(x: T) where T: Debug {
# }
```

<a id="items.fn.generics.mono"></a> 当引用一个泛型函数时，其类型会根据引用的上下文进行实例化。例如，在这里调用 `foo` 函数：

```rust
use std::fmt::Debug;

fn foo<T>(x: &[T]) where T: Debug {
    // details elided
}

foo(&[1, 2]);
```

将会将类型参数 `T` 实例化为 `i32`。

<a id="items.fn.generics.explicit-arguments"></a> 类型参数也可以在函数名称后的 [路径] 组件中明确提供。如果缺乏足够的上下文来确定类型参数，则可能需要这样做。例如，`mem::size_of::<u32>() == 4`。

<a id="items.fn.extern"></a>
## 外部函数限定符

<a id="items.fn.extern.intro"></a> `extern` 函数限定符允许提供可以通过特定 ABI 调用的函数定义。

<!-- ignore: fake ABI -->
```rust,ignore
extern "ABI" fn foo() { /* ... */ }
```

<a id="items.fn.extern.def"></a> 这些通常与 [external block] 项结合使用，后者提供可以无需提供定义即可调用函数的函数声明。

<!-- ignore: fake ABI -->
```rust,ignore
unsafe extern "ABI" {
  unsafe fn foo(); /* no body */
  safe fn bar(); /* no body */
}
unsafe { foo() };
bar();
```

<a id="items.fn.extern.default-abi"></a> 当在函数项中省略 `FunctionQualifiers` 中的 `"extern" Abi?*` 时，将分配 ABI `"Rust"`。例如：

```rust
fn foo() {}
```

相当于：

```rust
extern "Rust" fn foo() {}
```

<a id="items.fn.extern.foreign-call"></a> 函数可以被外部代码调用，使用与 Rust 不同的 ABI 可以允许从其他编程语言（如 C）调用函数。

```rust
// Declares a function with the "C" ABI
extern "C" fn new_i32() -> i32 { 0 }

// Declares a function with the "stdcall" ABI
# #[cfg(any(windows, target_arch = "x86"))]
extern "stdcall" fn new_i32_stdcall() -> i32 { 0 }
```

<a id="items.fn.extern.default-extern"></a> 就像 [external block] 一样，当使用 `extern` 关键字且省略 `"ABI"` 时，使用的 ABI 默认为 `"C"`。即：

```rust
extern fn new_i32() -> i32 { 0 }
let fptr: extern fn() -> i32 = new_i32;
```

相当于：

```rust
extern "C" fn new_i32() -> i32 { 0 }
let fptr: extern "C" fn() -> i32 = new_i32;
```

<a id="items.fn.extern.unwind"></a>
### 解调用

<a id="items.fn.extern.unwind.intro"></a> 大多数 ABI 字符串有两种形式，一种带有 `-unwind` 后缀，另一种则没有。`Rust` ABI 始终允许解调用，因此不存在 `Rust-unwind` ABI。所选择的 ABI 以及运行时 [panic handler] 决定了从函数中解调用时的行为。

<a id="items.fn.extern.unwind.behavior"></a> 下表说明了到达每种 ABI 边界时（使用相应 ABI 字符串的函数声明或定义）解调用操作的行为。请注意，Rust 运行时不受完全在另一种语言运行时内发生的解调用影响，也就是说，那些在未到达 Rust ABI 边界的情况下被抛出和捕获的解调用不会影响 Rust 运行时。

`panic`-unwind 列指的是通过 `panic!` 宏和类似标准库机制发生的崩溃，以及任何导致 panic 的其他 Rust 操作，例如越界数组索引或整数溢出。

“unwinding” ABI 类别指的是 `"Rust"`（未标记为 `extern` 的 Rust 函数的隐式 ABI）、`"C-unwind"` 以及名称中包含 `-unwind` 的任何其他 ABI。“非 unwinding” ABI 类别则指所有其他 ABI 字符串，包括 `"C"` 和 `"stdcall"`。

原生 unwinding 是按目标分别定义的。对于支持抛出和捕获 C++ 异常的目标，它指的是实现此功能的机制。某些平台实现了一种称为 ["forced unwinding"][forced-unwinding] 的 unwinding 形式；Windows 中的 `longjmp` 和 `glibc` 中的 `pthread_exit` 就是这种实现方式。强制 unwinding 在表格中的“Native unwind”列中被明确排除。

| panic runtime  | ABI           | `panic`-unwind                        | Native unwind (unforced) |
| -------------- | ------------  | ------------------------------------- | -----------------------  |
| `panic=unwind` | unwinding     | unwind                                | unwind                   |
| `panic=unwind` | non-unwinding | abort (see notes below)               | [undefined behavior]     |
| `panic=abort`  | unwinding     | `panic` aborts without unwinding      | abort                    |
| `panic=abort`  | non-unwinding | `panic` aborts without unwinding      | [undefined behavior]     |

<a id="items.fn.extern.abort"></a> 当 `panic=unwind` 时，如果 `panic` 被非 unwinding ABI 边界转换为 abort，则要么不会执行任何析构函数（`Drop` 调用），要么会执行直到该 ABI 边界的所有析构函数。这两种行为中具体会发生哪种情况是不确定的。

关于 FFI 边界上 unwinding 的其他考虑和限制，请参阅 [Panic 文档中的相关部分][panic-ffi]。

<a id="items.fn.extern.custom"></a>
### Extern “custom”

<a id="items.fn.extern.custom.intro"></a> `extern "custom"` 函数具有未知的自定义 ABI。调用此类函数的唯一方式是通过 [内联汇编]。

> [!EXAMPLE]
> ```rust
> # #[cfg(target_arch = "x86_64")] {
> # use core::arch::{asm, naked_asm};
> #
> /// Adds 1 to `rax`.
> ///
> /// This function uses a custom calling convention: the argument is
> /// passed in `rax`, the result is returned in `rax`, the flags may
> /// be clobbered, and all other registers are preserved.
> #[unsafe(naked)]
> unsafe extern "custom" fn increment() {
>     naked_asm!(
>         "add rax, 1",
>         "ret",
>     )
> }
>
> let mut x: u64 = 41;
> // SAFETY: The inline assembly respects the calling convention of
> // `increment`: the argument is passed in `rax`, the result is read
> // from `rax`, and no other registers are affected.
> unsafe {
>     asm!(
>         "call {}",
>         sym increment,
>         inout("rax") x,
>     );
> }
> assert_eq!(x, 42);
> # }
> ```

<a id="items.fn.extern.custom.signature"></a> `extern "custom"` 函数必须：

- 为 `unsafe`。 - 没有参数。 - 返回 [单位类型]，返回类型要么被省略，要么明确写为 `()`。

> [!NOTE]
> The rule is syntactic. The return type may not be a type alias, even one defined to be the [unit type].
>
> ```rust,compile_fail
> type Unit = ();
>
> #[unsafe(naked)]
> unsafe extern "custom" fn f() -> Unit { // ERROR: Not explicit `()`.
>     core::arch::naked_asm!("ret")
> }
> ```

<a id="items.fn.extern.custom.naked"></a> `extern "custom"` 函数定义必须是 [裸函数]。


<a id="items.fn.const.const"></a>
## 常量函数

有关常量函数的定义，请参阅[const functions]。

<a id="items.fn.异步"></a>
## 异步函数

<a id="items.fn.异步.intro"></a> 函数可以被标记为异步，并且这可以与`unsafe`修饰符结合使用：

```rust
async fn regular_example() { }
async unsafe fn unsafe_example() { }
```

<a id="items.fn.异步.future"></a> 当调用异步函数时，它不会执行任何操作：相反，它将参数捕获到一个未来对象中。当被查询时，该未来对象将执行函数的主体。

<a id="items.fn.异步.desugar-brief"></a> 一个异步函数大致相当于返回一个`impl Future`的函数，并且其主体包含`async move`块[异步-blocks]：

```rust
// Source
async fn example(x: &str) -> usize {
    x.len()
}
```

大致相当于：

```rust
# use std::future::Future;
// Desugared
fn example<'a>(x: &'a str) -> impl Future<Output = usize> + 'a {
    async move { x.len() }
}
```

<a id="items.fn.异步.desugar"></a> 实际的去糖化过程更为复杂：

<a id="items.fn.异步.生命周期-capture"></a> - 在去糖化过程中，返回类型被假设为捕获了`async fn`声明中的所有生命周期参数。这可以在上面的去糖化示例中看到，该示例明确地存活于`'a`之后，因此捕获了`'a`。

<a id="items.fn.异步.param-capture"></a> - 主体中的`async move`块[异步-blocks]捕获了所有函数参数，包括未使用的或绑定到`_`模式的参数。这确保了函数参数的丢弃顺序与非异步函数时相同，只是当返回的未来完全被等待时才会进行丢弃。

有关异步效果更多信息，请参阅 [`async` blocks][异步-blocks]。


<a id="items.fn.异步.edition2018"></a> 
> [!EDITION-2018]
> Async functions are only available beginning with Rust 2018.

<a id="items.fn.异步.safety"></a>
### 结合使用`async`和`unsafe`

<a id="items.fn.异步.safety.intro"></a> 声明一个既是异步又不可靠的函数是合法的。 resulting函数在调用时不可靠，并且（如同任何异步函数一样）返回一个未来值。这个未来值只是一个普通的未来值，因此不需要使用“await”来等待它：

```rust
// Returns a future that, when awaited, dereferences `x`.
//
// Soundness condition: `x` must be safe to dereference until
// the resulting future is complete.
async unsafe fn unsafe_example(x: *const i32) -> i32 {
  *x
}

async fn safe_example() {
    // An `unsafe` block is required to invoke the function initially:
    let p = 22;
    let future = unsafe { unsafe_example(&p) };

    // But no `unsafe` block required here. This will
    // read the value of `p`:
    let q = future.await;
}
```

请注意，这种行为是由于将其反编译为返回`impl Future`的函数所导致的——在这种情况下，我们反编译得到的函数是一个不可靠函数，但返回值保持不变。

在异步函数上使用“不可靠”一词的方式与其他函数相同：它表示该函数对调用者提出了一些额外的要求以确保其正确性。如同其他不可靠函数一样，这些要求可能超出初始调用本身——例如在上述代码片段中，`unsafe_example`函数接受一个指针`x`作为参数，然后在等待时解引用该指针。这意味着`x`必须在未来值执行完成之前是有效的，而确保这一点是调用者的责任。

<a id="items.fn.c-variadic"></a>
## C-variadic函数

<a id="items.fn.c-variadic.intro"></a> *C-variadic*函数将其最后一个参数接受可变参数列表`pat: ...`。

```rust
unsafe extern "C" fn f(mut ap: ...) -> f64 {
    unsafe { ap.next_arg::<f64>() }
}
```

```rust,compile_fail
unsafe extern "C" fn f(ap: ..., _: ()) {} // ERROR: `...` must be last.
```

这个参数代表调用者可能传递的任意数量的参数。

<a id="items.fn.c-variadic.parameter-type"></a> 函数体中`pat`的类型是 [`VaList<'_>`]。

```rust
# use core::ffi::VaList;
unsafe extern "C" fn f(ap: ...) {
    let _: VaList<'_> = ap;
}
```

<a id="items.fn.c-variadic.生命周期"></a> C-variadic函数定义在其可变参数生命周期上隐式具有通用性，就像该参数有类型`VaList<'x>`对于一个新的、不可命名的生命周期`'x'`一样。由于该函数必须在任何这样的生命周期下都有效，`VaList`无法被证明不会超过调用者提供的任何生命周期（因此无法从调用中逃脱），也无法证明任何调用者提供的生命周期会超过它。

```rust,compile_fail
# use core::ffi::VaList;
fn b_outlives_a<'a, 'b: 'a>(_: &mut VaList<'a>, _: &mut &'b mut u8) {}
unsafe extern "C" fn f(mut r: &mut u8, mut ap: ...) {
    b_outlives_a(&mut ap, &mut r); // ERROR: May not live long enough.
}
```

```rust,compile_fail
# use core::ffi::VaList;
fn a_outlives_b<'a: 'b, 'b>(_: &mut VaList<'a>, _: &mut &'b mut u8) {}
unsafe extern "C" fn f(mut r: &mut u8, mut ap: ...) {
    a_outlives_b(&mut ap, &mut r); // ERROR: May not live long enough.
}
```

> [!NOTE]
> This is different than if the data were a stack variable: any caller-provided lifetime can be proved to outlive a borrow of a callee stack variable.
>
> ```rust
> struct MockVaList<'data>(&'data u8);
> fn b_outlives_a<'a, 'b: 'a>(_: &mut MockVaList<'a>, _: &mut &'b mut u8) {}
> unsafe extern "C" fn f(mut r: &mut u8) {
>     let data = 0;
>     let mut ap = MockVaList(&data);
>     b_outlives_a(&mut ap, &mut r); // OK.
> }
> ```

<a id="items.fn.c-variadic.desugar-brief"></a> C-variadic函数定义大致相当于一个操作 [`VaList`]的函数。

```rust
unsafe extern "C" fn f(mut ap: ...) -> i32 {
    unsafe { ap.next_arg::<i32>() }
}
```

大致反编译为：

<!-- no_run: conceptual desugaring -->
```rust,no_run
# #![ feature(core_intrinsics) ]
# #![allow(internal_features)]
# use core::ffi::VaList;
# use core::mem::MaybeUninit;
use core::intrinsics::{va_arg, va_end};
// `va_start` is magic and has no intrinsic.
fn va_start(ap: *mut VaList<'_>) { /* magic */ }
unsafe extern "C" fn f() -> i32 {
    unsafe {
        let mut ap: MaybeUninit<VaList<'_>> = MaybeUninit::uninit();
        va_start(ap.as_mut_ptr());
        let mut ap = ap.assume_init();
        let x = va_arg::<i32>(&mut ap);
        va_end(&mut ap);
        x
    }
}
```

> [!NOTE]
> In an actual C-variadic function definition, the lifetime in `VaList<'_>` is different from what this code would suggest. See [items.fn.c-variadic.lifetime].

<a id="items.fn.c-variadic.next-arg-safety"></a> 调用 `VaList::next_arg` 来读取类型为 `T` 的参数仅在满足以下所有条件时才是安全的：

- 存在另一个 C-variadic 参数可供读取。 - 参数 `U` 的实际类型与 `T` 兼容（如下方定义）。 - 如果 `U` 和 `T` 都是整数类型，则调用者传递的值必须在两种类型中都能表示。

当满足以下任一条件时，类型 `T` 和 `U` 是兼容的：

- `T` 和 `U` 是相同类型（直到自由生命周期为止）。 - `T` 和 `U` 是相同大小的整数类型。 - `T` 和 `U` 都是指针，且它们的目标类型兼容。 - `T` 是指向 `c_void` 的指针，`U` 是指向 `i8` 或 `u8` 的指针，或者相反。

兼容类型的示例包括：

- `u32` 和 `i32` --- 但如果值不能在目标类型中表示，仍可能发生未定义行为（UB）。 - `u64` 和 `usize` --- 在 64 位平台上。 - `*const &'a u32` 和 `*mut &'static u32` --- 这些类型直到自由生命周期为止都是相同的。

不兼容类型的示例包括：

- `usize` 和 `*const _` --- 指针和整数不兼容。 - `*const fn(&'static ())` 和 `*const for<'a> fn(&'a ())` --- 这些类型直到自由生命周期为止都不相等。

<a id="items.fn.c-variadic.abi-compatibility"></a> [`VaList`] 与 C `va_list` 类型兼容。

```rust
# use core::ffi::{c_char, c_int, VaList};
unsafe extern "C" {
    // The C `vprintf` function is:
    //
    //     int vprintf(const char *format, va_list ap);
    //
    unsafe fn vprintf(fmt: *const c_char, ap: VaList<'_>) -> c_int;
}

unsafe extern "C" fn print(fmt: *const c_char, ap: ...) -> c_int {
    // The `VaList` is passed directly to the C function.
    unsafe { vprintf(fmt, ap) }
}
```

<a id="items.fn.c-variadic.abi"></a> 除了 [naked functions] 之外，只有 `extern "C"` 和 `extern "C-unwind"` 函数定义可以接受可变参数列表。

```rust,compile_fail
unsafe fn f(ap: ...) {} // ERROR: Not supported.
```

```rust,compile_fail
unsafe extern "sysv64" fn f(ap: ...) {} // ERROR: Not supported.
```

[naked functions] 只有在其 ABI 字符串符合 [items.extern.variadic.conventions] 时，才能接受可变参数列表。

```rust
# #[cfg(target_arch = "x86_64")] {
/// Computes the dot product of the `n`-dimensional vector `v`, passed
/// as `n` C-variadic `f64` arguments, with the vector `(c, ..., c)`.
/// That is, it computes `c * (v1 + ... + vn)`.
///
/// # Safety
///
/// The caller must pass `n` in the range `1..=7`, followed by exactly
/// `n` values of type `f64`.
// SAFETY: The body respects the "sysv64" calling convention, upholds
// the signature, and does not fall through.
#[unsafe(naked)]
unsafe extern "sysv64" fn dot(n: u64, c: f64, v: ...) -> f64 {
    core::arch::naked_asm!(
        // The "sysv64" calling convention passes `n` in `rdi`, `c` in
        // `xmm0`, and the coordinates in `xmm1` through `xmm7`,
        // in order. (The caller also passes the number of vector
        // registers used in `al`.)
        //
        // The sum takes the last `n - 1` additions of the chain
        // below. Each `addsd` encodes in exactly 4 bytes, so we enter
        // the chain `4 * (n - 1)` bytes before the `mulsd`.
        "neg rdi", // I.e., `rdi = -n`.
        "lea rax, [rip + 2f]", // I.e., `rax` = address of label 2.
        "lea rax, [rax + rdi*4 + 4]", // I.e., `rax -= 4 * (n - 1)`.
        "jmp rax",
        "addsd xmm6, xmm7", // Entered when `n` is 7.
        "addsd xmm5, xmm6", // ... when `n` is at least 6.
        "addsd xmm4, xmm5",
        "addsd xmm3, xmm4",
        "addsd xmm2, xmm3",
        "addsd xmm1, xmm2", // ... when `n` is at least 2.
        "2:",
        "mulsd xmm0, xmm1", // The result is returned in `xmm0`.
        "ret",
    )
}

// SAFETY: `dot` is passed `n` variadic `f64` arguments in each call.
let dot2 = unsafe { dot(2, 10.0, 3.0, 4.0) };
assert_eq!(dot2, 70.0);
let dot7 = unsafe { dot(7, 2.0, 1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0) };
assert_eq!(dot7, 56.0);
# }
```

<a id="items.fn.c-variadic.safety"></a> 当在签名中使用可变参数列表时：

- 函数定义必须标记为 `unsafe`。 - trait 定义中的函数声明必须标记为 `unsafe`。 - `extern` 块中的函数声明可以标记为 `safe`。

```rust,compile_fail
extern "C" fn f(ap: ...) {} // ERROR: Must be `unsafe`.
```

```rust,compile_fail
trait Tr {
    extern "C" fn f(ap: ...); // ERROR: Must be `unsafe`.
}
```

```rust
unsafe extern "C" {
    safe fn f(ap: ...); // OK.
}
```

> [!NOTE]
> For `safe` function declarations in an `extern` block, see the warning in [items.extern.variadic].

<a id="items.fn.c-variadic.异步"></a> C-variadic 函数不能标记为 `async`。

```rust,compile_fail
async unsafe extern "C" fn f(ap: ...) {} // ERROR: Cannot be `async`.
```

<a id="items.fn.c-variadic.const"></a> C-variadic 函数不能标记为 `const`。

```rust,compile_fail,E0658
const unsafe extern "C" fn f(ap: ...) {} // ERROR: Cannot be `const`.
```

<a id="items.fn.c-variadic.stable-targets"></a> 对 C-variadic 函数定义的支持在以下目标架构上具有稳定性：

- x86 和 x86-64 - ARM - AArch64 和 Arm64EC - RISC-V 32 位和 64 位（使用 ilp32e ABI 除外） - LoongArch 32 位和 64 位 - s390x - PowerPC 和 PowerPC64 - AMDGPU 和 NVPTX - Wasm32 和 Wasm64 - C-SKY - Xtensa - Hexagon - SPARC64 - MIPS

> [!NOTE]
> Some target architectures (e.g., BPF) do not support C-variadic function definitions. The compiler will emit an error if such a definition is used on an unsupported target.

<a id="items.fn.attributes"></a>
## 函数的属性

<a id="items.fn.attributes.intro"></a> 函数允许具有 [外部属性][attributes]。在函数的 [内部属性][attributes] 则可以直接放在其 [块] 中的 `{` 之后。

此示例展示了函数中的一个内部属性。该函数仅用“Example”一词进行文档说明。

```rust
fn documented() {
    #![doc = "Example"]
}
```

> [!NOTE]
> Except for lints, it is idiomatic to only use outer attributes on function items.

<a id="items.fn.attributes.builtin-attributes"></a> 对函数有意义的属性包括：

- [`cfg_attr`] - [`cfg`] - [`cold`] - [`deprecated`] - [`doc`] - [`export_name`] - [`inline`] - [`link_section`] - [`must_use`] - [`no_mangle`] - [`optimize`] - [Lint check attributes] - [Procedural 宏 attributes] - [Testing attributes]

<a id="items.fn.param-attributes"></a>
## 函数参数的属性

<a id="items.fn.param-attributes.intro"></a> 参数允许具有 [外部属性][attributes]，允许的 [内置属性] 仅限于 `cfg`、`cfg_attr`、`allow`、`warn`、`deny` 和 `forbid`。

```rust
fn len(
    #[cfg(windows)] slice: &[u16],
    #[cfg(not(windows))] slice: &[u8],
) -> usize {
    slice.len()
}
```

<a id="items.fn.param-attributes.parsed-attributes"></a> 用于 procedural 宏 attributes 的惰性辅助属性也被允许，但请注意不要在最终的 `TokenStream` 中包含这些惰性属性。

例如，以下代码定义了一个无正式定义的惰性 `some_inert_attribute` 属性，而 `some_proc_macro_attribute` procedural 宏 负责检测其存在并从输出 token stream 中移除它。

<!-- ignore: requires proc macro -->
```rust,ignore
#[some_proc_macro_attribute]
fn foo_oof(#[some_inert_attribute] arg: u8) {
}
```

[procedural macro attributes]: macro.proc.attribute
[`optimize`]: attributes.codegen.optimize
[C-variadic function]: items.fn.c-variadic.intro
[`VaList<'_>`]: lang-types.va-list
[`VaList`]: lang-types.va-list
[zero-sized]: glossary.zst
[naked functions]: attributes.codegen.naked

[forced-unwinding]: https://rust-lang.github.io/rfcs/2945-c-unwind-abi.html#forced-unwinding
[panic handler]: ../panic.md#the-panic_handler-attribute
[panic-ffi]: ../panic.md#unwinding-across-ffi-boundaries
[panicking]: ../panic.md
[undefined behavior]: ../behavior-considered-undefined.md
[async-blocks]: ../expressions/block-expr.md#async-blocks
[`impl Future`]: ../types/impl-trait.md
[const contexts]: ../const_eval.md#const-context
[const functions]: ../const_eval.md#const-functions
[external block]: external-blocks.md
[path]: ../paths.md
[block]: ../expressions/block-expr.md
[variables]: ../variables.md
[type]: ../types.md#type-expressions
[unit type]: ../types/tuple.md
[*function item type*]: ../types/function-item.md
[Trait]: traits.md
[attributes]: ../attributes.md
[`cfg`]: ../conditional-compilation.md#the-cfg-attribute
[`cfg_attr`]: ../conditional-compilation.md#the-cfg_attr-attribute
[lint check attributes]: ../attributes/diagnostics.md#lint-check-attributes
[testing attributes]: ../attributes/testing.md
[`cold`]: ../attributes/codegen.md#the-cold-attribute
[`inline`]: ../attributes/codegen.md#the-inline-attribute
[naked function]: ../attributes/codegen.md#the-naked-attribute
[`deprecated`]: ../attributes/diagnostics.md#the-deprecated-attribute
[`doc`]: ../../rustdoc/the-doc-attribute.html
[`must_use`]: ../attributes/diagnostics.md#the-must_use-attribute
[patterns]: ../patterns.md
[`export_name`]: ../abi.md#the-export_name-attribute
[`link_section`]: ../abi.md#the-link_section-attribute
[`no_mangle`]: ../abi.md#the-no_mangle-attribute
[built-in attributes]: ../attributes.md#built-in-attributes-index
[trait item]: traits.md
[method]: associated-items.md#methods
[associated function]: associated-items.md#associated-functions-and-methods
[implementation]: implementations.md
[value namespace]: ../names/namespaces.md
[`extern` block]: external-blocks.md
[inline assembly]: ../inline-assembly.md
