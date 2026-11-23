<a id="attributes.codegen"></a>
# 代码生成属性

<a id="attributes.codegen.intro"></a> 以下 [属性] 用于控制代码生成。

<!-- template:attributes -->
<a id="attributes.codegen.inline"></a>
### `inline` 属性

<a id="attributes.codegen.inline.intro"></a> *`inline` [属性]* 指示函数的代码副本应放在调用者处，而不是生成对该函数的调用。

> [!EXAMPLE]
> ```rust
> #[inline]
> pub fn example1() {}
>
> #[inline(always)]
> pub fn example2() {}
>
> #[inline(never)]
> pub fn example3() {}
> ```

> [!NOTE]
> `rustc` automatically inlines functions when doing so seems worthwhile. Use this attribute carefully as poor decisions about what to inline can slow down programs.

<a id="attributes.codegen.inline.syntax"></a> `inline` 属性的语法如下：

```grammar,attributes
@root InlineAttribute ->
      `inline` `(` `always` `)`
    | `inline` `(` `never` `)`
    | `inline`
```

<a id="attributes.codegen.inline.allowed-positions"></a> `inline` 属性只能应用于具有 [主体] --- [闭包], [异步块], [自由函数], [关联函数] 在 [固有实现] 或 [特质实现] 中的函数，以及具有 [默认定义] 的 [特质定义] 中的关联函数。

> [!NOTE]
> `rustc` ignores use in other positions but lints against it. This may become an error in the future.

> [!NOTE]
> Though the attribute can be applied to [closures] and [async blocks], the usefulness of this is limited as we do not yet support attributes on expressions.
>
> ```rust
> // We allow attributes on statements.
> #[inline] || (); // OK
> #[inline] async {}; // OK
> ```
>
> ```rust,compile_fail,E0658
> // We don't yet allow attributes on expressions.
> let f = #[inline] || (); // ERROR
> ```

<a id="attributes.codegen.inline.duplicates"></a> `inline` 属性的效果仅适用于函数的首次使用。

> [!NOTE]
> `rustc` lints against any use following the first. This may become an error in the future.

<a id="attributes.codegen.inline.modes"></a> `inline` 属性支持以下模式：

- `#[inline]` *建议*执行内联展开。 - `#[inline(always)]` *建议*始终执行内联展开。 - `#[inline(never)]` *建议*永远不执行内联展开。

> [!NOTE]
> In every form the attribute is a hint. The compiler may ignore it.

<a id="attributes.codegen.inline.trait"></a> 当 `inline` 应用于 [特质] 中的函数时，仅适用于 [默认定义] 的代码。

<a id="attributes.codegen.inline.异步"></a> 当 `inline` 应用于 [异步函数] 或 [异步闭包] 时，仅适用于生成的 `poll` 函数的代码。

> [!NOTE]
> For more details, see [Rust issue #129347](https://github.com/rust-lang/rust/issues/129347).

<a id="attributes.codegen.inline.externally-exported"></a> 如果函数通过 [`no_mangle`] 或 [`export_name`] 外部导出，`inline` 属性将被忽略。

<a id="attributes.codegen.inline.optimize"></a> `#[inline]` 和 `#[inline(always)]` 不能与同一函数的 `#[optimize(none)]` 一起使用。（参见 [attributes.codegen.optimize.inline]。）

```rust,compile_fail
#[optimize(none)]
#[inline] // ERROR: Not allowed.
fn f() {}
```

`#[inline]` 和 `#[inline(always)]` 仍可用于继承 `optimize(none)` 的闭包或异步块。（参见 [attributes.codegen.optimize.closures]。）

```rust
#[optimize(none)]
pub fn f() {
    #[inline] || (); // Inherits `optimize(none)`.
    #[inline(always)] async {}; // Inherits `optimize(none)`.
}
```

<!-- template:attributes -->
<a id="attributes.codegen.cold"></a>
### `cold` 属性

<a id="attributes.codegen.cold.intro"></a> *`cold` [属性]* 表明该函数不太可能被调用，这有助于编译器生成更优秀的代码。

> [!EXAMPLE]
> ```rust
> #[cold]
> pub fn example() {}
> ```

<a id="attributes.codegen.cold.syntax"></a> `cold` 属性使用 [MetaWord] 语法。

<a id="attributes.codegen.cold.allowed-positions"></a> `cold` 属性只能应用于具有 [主体] --- [闭包], [异步块], [自由函数], [关联函数] 在 [固有实现] 或 [特质实现] 中的函数，以及具有 [默认定义] 的 [特质定义] 中的关联函数。

> [!NOTE]
> `rustc` ignores use in other positions but lints against it. This may become an error in the future.

> [!NOTE]
> Though the attribute can be applied to [closures] and [async blocks], the usefulness of this is limited as we do not yet support attributes on expressions.

<!-- TODO: rustc currently seems to allow cold on a trait function without a body, but it appears to be ignored. I think that may be a bug, and it should at least warn if not reject (like inline does). -->

<a id="attributes.codegen.cold.extern-custom"></a> `cold` 属性不得应用于 [`extern "custom"` 函数]。

```rust,compile_fail
#[cold] // ERROR: Not allowed.
#[unsafe(naked)]
unsafe extern "custom" fn f() {
    core::arch::naked_asm!("ret")
}
```

<a id="attributes.codegen.cold.duplicates"></a> `cold` 对函数的首次使用才具有效果。

> [!NOTE]
> `rustc` lints against any use following the first. This may become an error in the future.

<a id="attributes.codegen.cold.trait"></a> 当 `cold` 应用于 [特质] 中的函数时，它仅适用于 [默认定义] 的代码。

<!-- template:attributes -->
<a id="attributes.codegen.naked"></a>
## `naked` 属性

<a id="attributes.codegen.naked.intro"></a> *`naked` [属性]* 防止编译器为该函数生成函数序言和结尾部分 --- 即 *裸函数*。

> [!EXAMPLE]
> ```rust
> # #[cfg(target_arch = "x86_64")] {
> /// Adds 3 to the given number.
> // SAFETY: The body respects the "sysv64" calling convention,
> // upholds the signature, and does not fall through.
> #[unsafe(naked)]
> pub extern "sysv64" fn add_n(number: u64) -> u64 {
>     core::arch::naked_asm!(
>         "add rdi, {}",
>         "mov rax, rdi",
>         "ret",
>         const 3,
>     )
> }
> # }
> ```

> [!NOTE]
> The assembly code of a naked function often does not follow the calling convention of any ABI known to the compiler. Such a function should be declared as an [`extern "custom"` function][items.fn.extern.custom].

<a id="attributes.codegen.naked.syntax"></a> `naked` 属性使用 [MetaWord] 语法。

<a id="attributes.codegen.naked.allowed-positions"></a> `naked` 属性只能应用于 [自由函数], [关联函数] 在 [固有实现] 或 [特质实现] 中，以及具有 [默认定义] 的 [特质定义] 中的关联函数。

<a id="attributes.codegen.naked.duplicates"></a> `naked` 对函数的首次使用才具有效果。

> [!NOTE]
> `rustc` lints against any use following the first.

<a id="attributes.codegen.naked.不安全"></a> `naked` 属性必须标记为 [`unsafe`][attributes.safety]，因为该主体必须遵循函数的调用约定、保持其签名，并且要么返回结果，要么 diverge（即不穿过汇编代码的末尾）。

<a id="attributes.codegen.naked.body"></a> [函数主体] 必须包含恰好一个 [`naked_asm!`] 宏调用。

<a id="attributes.codegen.naked.prologue-epilogue"></a> 对于裸函数，编译器不会生成序言或尾声：在 [`naked_asm!`] 调用中的汇编代码构成了其全部内容。

<a id="attributes.codegen.naked.call-stack"></a> 进入时，汇编代码可以假设调用栈和寄存器状态符合函数的签名和调用约定。

<a id="attributes.codegen.naked.no-duplication"></a> 编译器不得复制汇编代码，除非对多态函数进行单态化处理。

> [!NOTE]
> This guarantee matters for naked functions that define symbols.

<a id="attributes.codegen.naked.unused-variables"></a> 在裸函数中会抑制 [`unused_variables` lint]。

<a id="attributes.codegen.naked.inline"></a> 无法将 [`inline` 属性]应用于裸函数。

<a id="attributes.codegen.naked.track_caller"></a> 无法将 [`track_caller` 属性]应用于裸函数。

<a id="attributes.codegen.naked.testing"></a> [testing 属性]无法应用于裸函数。

<a id="attributes.codegen.naked.target_feature"></a> [`target_feature` 属性]无法应用于裸函数。

<a id="attributes.codegen.naked.optimize"></a> [`optimize` 属性]无法应用于裸函数。（参见 [attributes.codegen.optimize.naked]。）

```rust,compile_fail,E0736
# use core::arch::naked_asm;
#[optimize(size)] // ERROR: Not allowed on a naked function.
#[unsafe(naked)]
pub extern "C" fn f() {
    naked_asm!("ret")
}
```

<!-- TODO: Reflexive rules? -->

<a id="attributes.codegen.naked.abi"></a> 裸函数不能使用 ["Rust" ABI]。

<!-- template:attributes -->
<a id="attributes.codegen.no_builtins"></a>
## `no_builtins` 属性

<a id="attributes.codegen.no_builtins.intro"></a> *`no_builtins` [属性]*禁用与假设存在的库函数调用相关的某些代码模式的优化。

<!-- TODO: This needs expanding, see <https://github.com/rust-lang/reference/issues/542>. -->

> [!EXAMPLE]
> ```rust
> #![no_builtins]
> ```

<a id="attributes.codegen.no_builtins.syntax"></a> `no_builtins` 属性使用 [MetaWord] 语法。

<a id="attributes.codegen.no_builtins.allowed-positions"></a> `no_builtins` 属性只能应用于 crate 根目录。

<a id="attributes.codegen.no_builtins.duplicates"></a> `no_builtins` 属性仅对第一次使用有效。

> [!NOTE]
> `rustc` lints against any use following the first.

<!-- template:attributes -->
<a id="attributes.codegen.optimize"></a>
## `optimize` 属性

<a id="attributes.codegen.optimize.intro"></a> *`optimize` [属性]*为被属性的函数提出一个优化目标：大小、速度或无优化。

> [!EXAMPLE]
> ```rust
> #[optimize(size)]
> pub fn example1() {}
>
> #[optimize(speed)]
> pub fn example2() {}
>
> #[optimize(none)]
> pub fn example3() {}
> ```

> [!NOTE]
> For `rustc`, `-C opt-level=0` (the default) disables LLVM optimizations for the entire crate, and `optimize(size)` and `optimize(speed)` do not enable them for the attributed function. `rustc` still applies its own optimizations, other than inlining, to such a function.

<a id="attributes.codegen.optimize.syntax"></a> `optimize` 属性的语法如下：

```grammar,attributes
@root OptimizeAttribute ->
    `optimize` `(` ( `size` | `speed` | `none` ) `)`
```

<a id="attributes.codegen.optimize.allowed-positions"></a> `optimize` 属性只能应用于具有 [主体] --- [闭包], [异步块], [自由函数], [关联实现] 或 [特质实现] 的函数，以及当这些函数有 [默认定义] 时，在 [固有实现] 或 [特质实现] 中的关联函数。

```rust
// A free function.
#[optimize(size)]
pub fn f() {
    #[optimize(speed)] || (); // A closure.
    #[optimize(none)] async {}; // An async block.
}

pub struct S;
impl S {
    // An associated function in an inherent impl.
    #[optimize(size)]
    pub fn f(&self) {}
}

pub trait Tr {
    // An associated function in a trait with a default definition.
    #[optimize(speed)]
    fn f(&self) {}
}

impl Tr for S {
    // An associated function in a trait impl.
    #[optimize(none)]
    fn f(&self) {}
}
```

如果函数没有主体，则会被拒绝使用该属性。

```rust,compile_fail
trait Tr {
    #[optimize(size)] // ERROR: Not allowed without a body.
    fn f();
}

unsafe extern "C" {
    #[optimize(size)] // ERROR: Not allowed without a body.
    fn g();
}
```

<a id="attributes.codegen.optimize.duplicates"></a> `optimize` 属性在函数中只能使用一次。

```rust,compile_fail
#[optimize(size)]
#[optimize(speed)] // ERROR: Multiple `optimize` attributes.
fn f() {}
```

<a id="attributes.codegen.optimize.modes"></a> `optimize` 属性支持以下模式：

- `#[optimize(size)]` 建议优化以生成更小的代码，即使这会降低执行速度。 - `#[optimize(speed)]` 建议优化以加快执行速度，即使这会增加代码大小。 - `#[optimize(none)]` 建议按未请求优化的方式编译函数，忽略整个库所请求的优化。

> [!NOTE]
> In every form the attribute is a hint. The compiler may ignore it.

> [!WARNING]
> `#[optimize(none)]` does not make the function opaque to the optimizer. In addition to ignoring the attribute, the compiler may still optimize the function's callers using what it knows about the function and may still change the function itself in other ways, so the attribute cannot be relied on to keep a computation from being optimized away.

> [!NOTE]
> `rustc` currently optimizes a function with `#[optimize(none)]` much as it would at `-C opt-level=0`, regardless of the crate's optimization level, and does not inline it into its callers.
>
> Settings that base their defaults on the optimization level, such as debug assertions and overflow checks, ignore this attribute and use the crate's optimization level.

<a id="attributes.codegen.optimize.inline"></a> `#[optimize(none)]` 不能与同一函数的 `#[inline]` 或 `#[inline(always)]` 一起使用。它可以与 `#[inline(never)]` 一起使用。（参见 [attributes.codegen.inline.optimize]。）

```rust,compile_fail
#[optimize(none)]
#[inline] // ERROR: Not allowed.
fn f() {}
```

继承 `optimize(none)` 的闭包或异步块仍可以标记为 `#[inline]` 或 `#[inline(always)]`。（参见 [attributes.codegen.optimize.closures]。）

```rust
#[optimize(none)]
pub fn f() {
    #[inline] || (); // Inherits `optimize(none)`.
    #[inline(always)] async {}; // Inherits `optimize(none)`.
}
```

<a id="attributes.codegen.optimize.naked"></a> `optimize` 属性不能应用于 [裸函数]。（参见 [attributes.codegen.naked.optimize]。）

```rust,compile_fail,E0736
# use core::arch::naked_asm;
#[optimize(size)] // ERROR: Not allowed on a naked function.
#[unsafe(naked)]
pub extern "C" fn f() {
    naked_asm!("ret")
}
```

<a id="attributes.codegen.optimize.closures"></a> 没有 `optimize` 属性的闭包和 [异步 块] 会继承最内层封装函数、闭包或 异步 块所生效的该属性，而该属性可能是从上层继承的，而非直接编写的。[异步 函数] 的身体会继承函数的该属性，而 [异步 闭包] 的身体则继承闭包的该属性。函数内的 [const 块] 和闭包、异步 块不会继承函数的该属性。

```rust
#[optimize(none)]
pub fn f() {
    // This closure has no `optimize` attribute of its own, so its
    // body inherits `optimize(none)` from `f`.
    let c = || 1 + 2;
    c();
}

#[optimize(size)]
pub async fn g() {
    // This body inherits `optimize(size)` from `g`.
}
```

<a id="attributes.codegen.optimize.trait"></a> 当在 [trait] 中的函数应用 `optimize` 时，它仅适用于 [默认定义] 的代码。

```rust
pub trait Tr {
    // The default definition is optimized for size.
    #[optimize(size)]
    fn f(&self) {}
}

pub struct S;
impl Tr for S {
    // This implementation of `Tr::f` does not inherit the trait's
    // `optimize(size)`; it uses the crate's optimization level.
    fn f(&self) {}
}
```

<a id="attributes.codegen.target_feature"></a>
## `target_feature` 属性

<a id="attributes.codegen.target_feature.intro"></a> *`target_feature` [属性]* 可以应用于函数，以启用针对特定平台架构特性的代码生成。它使用 [MetaListNameValueStr] 语法，并包含一个名为 `enable` 的键，其值为逗号分隔的需启用的特性名称字符串。

```rust
# #[cfg(target_feature = "avx2")]
#[target_feature(enable = "avx2")]
fn foo_avx2() {}
```

<a id="attributes.codegen.target_feature.arch"></a> 每个 [目标架构] 都有一组可以启用的特性。如果为某个 crate 不编译的目标架构指定了特定特性，则属于错误。

<a id="attributes.codegen.target_feature.closures"></a> 在带有 `target_feature` 注释的函数中定义的闭包会继承外层函数的该属性。

<a id="attributes.codegen.target_feature.target-ub"></a> 调用一个针对当前运行平台不支持的特性的函数属于 [未定义行为]，*除非* 平台明确说明这是安全的。

<a id="attributes.codegen.target_feature.safety-restrictions"></a> 除非以下平台规则另有规定，否则适用以下限制：

- 安全的 `#[target_feature]` 函数（以及继承该属性的闭包）只能由能够启用被调用者所启用的所有 `target_feature` 的调用者来安全调用。在 `unsafe` 环境中不适用此限制。 - 安全的 `#[target_feature]` 函数（以及继承该属性的闭包）只能在能够启用被转换者所启用的所有 `target_feature` 的上下文中被转换为 *安全* 的函数指针。对于 `unsafe` 函数指针则不适用此限制。

隐含启用的特性包含在此规则中。例如，`sse2` 函数可以调用标记为 `sse` 的函数。

```rust
# #[cfg(target_feature = "sse2")] {
#[target_feature(enable = "sse")]
fn foo_sse() {}

fn bar() {
    // Calling `foo_sse` here is unsafe, as we must ensure that SSE is
    // available first, even if `sse` is enabled by default on the target
    // platform or manually enabled as compiler flags.
    unsafe {
        foo_sse();
    }
}

#[target_feature(enable = "sse")]
fn bar_sse() {
    // Calling `foo_sse` here is safe.
    foo_sse();
    || foo_sse();
}

#[target_feature(enable = "sse2")]
fn bar_sse2() {
    // Calling `foo_sse` here is safe because `sse2` implies `sse`.
    foo_sse();
}
# }
```

<a id="attributes.codegen.target_feature.fn-traits"></a> 具有 `#[target_feature]` 属性的函数 *永远* 不实现 `Fn` 家族的特质，尽管继承外部函数特性的闭包会实现这些特质。

<a id="attributes.codegen.target_feature.allowed-positions"></a> `#[target_feature]` 属性不允许出现在以下位置：

- [`main` 函数][crate.main] - [`panic_handler` 函数][panic.panic_handler] - 安全的特质方法 - 特质中的安全默认函数

<a id="attributes.codegen.target_feature.availability"></a>
### 可用的特性

以下是可用特性名称的列表。

<a id="attributes.codegen.target_feature.x86"></a>
#### `x86` 或 `x86_64`

在此平台上，使用不支持的特性执行代码属于未定义行为。因此，在此平台上使用 `#[target_feature]` 函数需遵守 [上述限制][attributes.codegen.target_feature.safety-restrictions]。

特性 | 隐含启用的情况 | 描述
------------|--------------------|-------------------
`adx` | | [ADX] --- 多精度加载指令扩展 `aes` | `sse2` | [AES] --- 高级加密标准 `avx` | `sse4.2` | [AVX] --- 高级向量扩展 `avx2` | `avx` | [AVX2] --- 高级向量扩展 2 `avx512bf16` | `avx512bw` | [AVX512-BF16] --- 高级向量扩展 512位 - Bfloat16 扩展 `avx512bitalg` | `avx512bw` | [AVX512-BITALG] --- 高级向量扩展 512位 - 位算法 `avx512bw` | `avx512f` | [AVX512-BW] --- 高级向量扩展 512位 - 字节和字指令 `avx512cd` | `avx512f` | [AVX512-CD] --- 高级向量扩展 512位 - 冲突检测指令 `avx512dq` | `avx512f` | [AVX512-DQ] --- 高级向量扩展 512位 - 双字和四字指令 `avx512f` | `avx2`, `fma`, `f16c`| [AVX512-F] --- 高级向量扩展 512位 - 基础架构 `avx512fp16` | `avx512bw` | [AVX512-FP16] --- 高级向量扩展 512位 - 浮点16位扩展 `avx512ifma` | `avx512f` | [AVX512-IFMA] --- 高级向量扩展 512位 - 整数融合乘法加法 `avx512vbmi` | `avx512bw` | [AVX512-VBMI] --- 高级向量扩展 512位 - 向量字节操作指令 `avx512vbmi2` | `avx512bw` | [AVX512-VBMI2] --- 高级向量扩展 512位 - 向量字节操作指令 2 `avx512vl` | `avx512f` | [AVX512-VL] --- 高级向量扩展 512位 - 向量长度扩展 `avx512vnni` | `avx512f` | [AVX512-VNNI] --- 高级向量扩展 512位 - 向量神经网络指令 `avx512vp2intersect`| `avx512f` | [AVX512-VP2INTERSECT] --- 高级向量扩展 512位 - 向量对与一对掩码寄存器的交集 `avx512vpopcntdq` | `avx512f` | [AVX512-VPOPCNTDQ] --- 高级向量扩展 512位 - 向量人口计数指令 `avxifma` | `avx2` | [AVX-IFMA] --- 高级向量扩展 - 整数融合乘法加法 `avxneconvert` | `avx2` | [AVX-NE-CONVERT] --- 高级向量扩展 - 无异常浮点转换指令 `avxvnni` | `avx2` | [AVX-VNNI] --- 高级向量扩展 - 向量神经网络指令 `avxvnniint16` | `avx2` | [AVX-VNNI-INT16] --- 高级向量扩展 - 带有16位整数的向量神经网络指令 `avxvnniint8` | `avx2` | [AVX-VNNI-INT8] --- 高级向量扩展 - 带有8位整数的向量神经网络指令 `bmi1` | | [BMI1] --- 位操作指令集 `bmi2` | | [BMI2] --- 位操作指令集 2 `cmpxchg16b`| | [`cmpxchg16b`] --- 原子地比较和交换16字节（128位）数据 `f16c` | `avx` | [F16C] --- 16位浮点转换指令 `fma` | `avx` | [FMA3] --- 三操作数融合乘法加法 `fxsr` | | [`fxsave`] and [`fxrstor`] --- 保存和恢复x87 FPU、MMX技术和SSE状态 `gfni` | `sse2` | [GFNI] --- 伽罗瓦域新指令 `kl` | `sse2` | [KEYLOCKER] --- Intel密钥锁指令 `lzcnt` | | [`lzcnt`] --- 前导零计数 `movbe` | | [`movbe`] --- 交换字节后移动数据 `pclmulqdq` | `sse2` | [`pclmulqdq`] --- 打包无加载的四字乘法 `popcnt` | | [`popcnt`] --- 设置为1的位计数 `rdrand` | | [`rdrand`] --- 读取随机数 `rdseed` | | [`rdseed`] --- 读取随机种子 `sha` | `sse2` | [SHA] --- 安全哈希算法 `sha512` | `avx2` | [SHA512] --- 带有512位摘要的安全哈希算法 `sm3` | `avx` | [SM3] --- 尚米3哈希算法 `sm4` | `avx2` | [SM4] --- 尚米4密码算法 `sse` | | [SSE] --- 流式 <abbr title="Single Instruction Multiple Data">SIMD</abbr> 扩展 `sse2` | `sse` | [SSE2] --- 流式SIMD扩展 2 `sse3` | `sse2` | [SSE3] --- 流式SIMD扩展 3 `sse4.1` | `ssse3` | [SSE4.1] --- 流式SIMD扩展 4.1 `sse4.2` | `sse4.1` | [SSE4.2] --- 流式SIMD扩展 4.2 `sse4a` | `sse3` | [SSE4a] --- 流式SIMD扩展 4a `ssse3` | `sse3` | [SSSE3] --- 补充流式SIMD扩展 3 `tbm` | | [TBM] --- 尾部位操作 `vaes` | `avx2`, `aes` | [VAES] --- 向量AES指令 `vpclmulqdq`| `avx`, `pclmulqdq`| [VPCLMULQDQ] --- 向量无加载的四字乘法 `widekl` | `kl` | [KEYLOCKER_WIDE] --- Intel宽键锁指令 `xsave` | | [`xsave`] --- 保存处理器扩展状态 `xsavec` | | [`xsavec`] --- 保存压缩后的处理器扩展状态 `xsaveopt` | | [`xsaveopt`] --- 优化后的处理器扩展状态保存 `xsaves` | | [`xsaves`] --- 保存 supervisor 级处理器扩展状态

<!-- Keep links near each table to make it easier to move and update. -->


<a id="attributes.codegen.target_feature.aarch64"></a>
#### `aarch64`

在此平台上使用 `#[target_feature]` 函数需遵守 [上述限制][attributes.codegen.target_feature.safety-restrictions]。

关于这些功能的更多文档可查阅 [ARM 架构参考手册]，或访问 [developer.arm.com]。


> [!NOTE]
> The following pairs of features should both be marked as enabled or disabled together if used:
> - `paca` and `pacg`, which LLVM currently implements as one feature.

功能 | 自动启用的功能 | 功能名称
-------        | ------------------ | ------------
`aes` | `neon` | FEAT_AES & FEAT_PMULL --- 高级 <abbr title="Single Instruction Multiple Data">SIMD</abbr> AES 与 PMULL 指令 `bf16` | | FEAT_BF16 --- BFloat16 指令 `bti` | | FEAT_BTI --- 分支目标识别 `crc` | | FEAT_CRC --- CRC32 校验和指令 `dit` | | FEAT_DIT --- 数据独立计时指令 `dotprod` | `neon` | FEAT_DotProd --- 高级 SIMD Int8 点积指令 `dpb` | | FEAT_DPB --- 数据缓存清理至持久性位置 `dpb2` | `dpb` | FEAT_DPB2 --- 数据缓存清理至深度持久性位置 `f32mm` | `sve` | FEAT_F32MM --- SVE 单精度浮点矩阵乘法指令 `f64mm` | `sve` | FEAT_F64MM --- SVE 双精度浮点矩阵乘法指令 `fcma` | `neon` | FEAT_FCMA --- 浮点复数支持 `fhm` | `fp16` | FEAT_FHM --- 半精度浮点 FMLAL 指令 `flagm` | | FEAT_FLAGM --- 条件标志操作 `fp16` | `neon` | FEAT_FP16 --- 半精度浮点数据处理 `frintts` | | FEAT_FRINTTS --- 浮点到整数辅助指令 `i8mm` | | FEAT_I8MM --- Int8 矩阵乘法 `jsconv` | `neon` | FEAT_JSCVT --- JavaScript 转换指令 `lor` | | FEAT_LOR --- 有限序区域扩展 `lse` | | FEAT_LSE --- 大系统扩展 `mte` | | FEAT_MTE & FEAT_MTE2 --- 内存标记扩展 `neon` | | FEAT_AdvSimd & FEAT_FP --- 浮点与高级 SIMD 扩展 `paca` | | FEAT_PAUTH --- 指针认证（地址认证） `pacg` | | FEAT_PAUTH --- 指针认证（通用认证） `pan` | | FEAT_PAN --- 特权访问禁止扩展 `pmuv3` | | FEAT_PMUv3 --- 性能监视器扩展（版本 3） `rand` | | FEAT_RNG --- 随机数生成器 `ras` | | FEAT_RAS & FEAT_RASv1p1 --- 可靠性、可用性和服务性扩展 `rcpc` | | FEAT_LRCPC --- 释放一致的处理器一致性 `rcpc2` | `rcpc` | FEAT_LRCPC2 --- RcPc 带立即偏移量 `rdm` | `neon` | FEAT_RDM --- 舍入双倍乘法累加 `sb` | | FEAT_SB --- 推测屏障 `sha2` | `neon` | FEAT_SHA1 & FEAT_SHA256 --- 高级 SIMD SHA 指令 `sha3` | `sha2` | FEAT_SHA512 & FEAT_SHA3 --- 高级 SIMD SHA 指令 `sm4` | `neon` | FEAT_SM3 & FEAT_SM4 --- 高级 SIMD SM3/4 指令 `spe` | | FEAT_SPE --- 统计分析扩展 `ssbs` | | FEAT_SSBS & FEAT_SSBS2 --- 推测存储绕过安全 `sve` | `neon` | FEAT_SVE --- 可扩展向量扩展 `sve2` | `sve` | FEAT_SVE2 --- 可扩展向量扩展 2 `sve2-aes` | `sve2`, `aes` | FEAT_SVE_AES & FEAT_SVE_PMULL128 --- SVE AES 指令 `sve2-bitperm` | `sve2` | FEAT_SVE2_BitPerm --- SVE 位置换 `sve2-sha3` | `sve2`, `sha3` | FEAT_SVE2_SHA3 --- SVE SHA3 指令 `sve2-sm4` | `sve2`, `sm4` | FEAT_SVE2_SM4 --- SVE SM4 指令 `tme` | | FEAT_TME --- 事务内存扩展 `vh` | | FEAT_VHE --- 虚拟化主机扩展

<a id="attributes.codegen.target_feature.loongarch"></a>
#### `loongarch`

在此平台上，使用 `#[target_feature]` 函数需遵守 [上述限制][attributes.codegen.target_feature.safety-restrictions]。

功能 | 隐式支持项 | 描述
------------|---------------------|-------------------
`f` | | [F][la-f] --- 单精度浮点指令 `d` | `f` | [D][la-d] --- 双精度浮点指令 `frecipe` | | [FRECIPE][la-frecipe] --- 互易近似指令 `lasx` | `lsx` | [LASX][la-lasx] --- 256位向量指令 `lbt` | | [LBT][la-lbt] --- 二进制转换指令 `lsx` | `d` | [LSX][la-lsx] --- 128位向量指令 `lvz` | | [LVZ][la-lvz] --- 虚拟化指令 `div32` | | [DIV32][la-div32] --- 接受非符号扩展的32位操作数的除法指令 `lam-bh` | | [LAM-BH][la-lam-bh] --- 用于字节和半字原子交换与加法指令 `lamcas` | | [LAMCAS][la-lamcas] --- 用于字节、半字、字和双字的原子比较与交换指令 `ld-seq-sa` | | [LD-SEQ-SA][la-ld-seq-sa] --- 将加载操作按顺序排序到同一地址 `scq` | | [SCQ][la-scq] --- 条件存储四字指令

<!-- Keep links near each table to make it easier to move and update. -->


<a id="attributes.codegen.target_feature.riscv"></a>
#### `riscv32` 或 `riscv64`

在此平台上使用 `#[target_feature]` 函数需遵守 [上述限制][attributes.codegen.target_feature.safety-restrictions]。

关于这些功能的更多文档可在其相应的规范中找到。许多规范在 [RISC-V ISA Manual]、[版本 20250508] 或 [RISC-V GitHub Account] 上托管的其他手册中有描述。


功能 | 隐式启用 | 描述
------------|---------------------|-------------------
`a` | `zaamo`, `zalrsc` | [A][rv-a] --- 原子指令 `b` | `zba`, `zbc`, `zbs` | [B][rv-b] --- 位操作指令 `c` | `zca` | [C][rv-c] --- 压缩指令 `d` | `f` | [D][rv-d] --- 双精度浮点运算 `f` | `zicsr` | [F][rv-f] --- 单精度浮点运算 `m` | | [M][rv-m] --- 整数乘除指令 `za64rs` | `za128rs` | [Za64rs][rv-za64rs] --- 平台行为：自然对齐的预留集，大小 ≤ 64 字节 `za128rs` | | [Za128rs][rv-za128rs] --- 平台行为：自然对齐的预留集，大小 ≤ 128 字节 `zaamo` | | [Zaamo][rv-zaamo] --- 原子内存操作指令 `zabha` | `zaamo` | [Zabha][rv-zabha] --- 字节和半字原子内存操作指令 `zacas` | `zaamo` | [Zacas][rv-zacas] --- 原子比较与交换 (CAS) 指令 `zalrsc` | | [Zalrsc][rv-zalrsc] --- 加载预留/存储条件指令 `zama16b` | | [Zama16b][rv-zama16b] --- 平台行为：未跨越自然对齐的 16 字节边界的错位加载、存储和 AMO 是原子操作 `zawrs` | | [Zawrs][rv-zawrs] --- 等待预留集指令 `zba` | | [Zba][rv-zba] --- 地址生成指令 `zbb` | | [Zbb][rv-zbb] --- 基本位操作 `zbc` | `zbkc` | [Zbc][rv-zbc] --- 无进位乘法 `zbkb` | | [Zbkb][rv-zbkb] --- 用于密码学的位操作指令 `zbkc` | | [Zbkc][rv-zbkc] --- 用于密码学的无进位乘法 `zbkx` | | [Zbkx][rv-zbkx] --- 交叉器排列 `zbs` | | [Zbs][rv-zbs] --- 单位指令 `zca` | | [Zca][rv-zca] --- 压缩指令：整数部分子集 `zcb` | `zca` | [Zcb][rv-zcb] --- 简单的代码大小节省型压缩指令 `zcmop` | `zca` | [Zcmop][rv-zcmop] --- 压缩可能操作指令 `zic64b` | | [Zic64b][rv-zic64b] --- 平台行为：自然对齐的 64 字节缓存块 `zicbom` | | [Zicbom][rv-zicbom] --- 缓存块管理指令 `zicbop` | | [Zicbop][rv-zicbop] --- 缓存块预取提示指令 `zicboz` | | [Zicboz][rv-zicboz] --- 缓存块零指令 `ziccamoa` | | [Ziccamoa][rv-zicamoa] --- 平台行为：可缓存且相干的主内存支持所有基本原子操作 `ziccif` | | [Ziccif][rv-ziccif] --- 平台行为：可缓存且相干的主内存支持指令获取以及自然对齐的 2 的幂大小直到 `min(ILEN,XLEN)` 是原子操作 `zicclsm` | | [Zicclsm][rv-zicclsm] --- 平台行为：可缓存且相干的主内存支持错位加载/存储访问 `ziccrse` | | [Ziccrse][rv-ziccrse] --- 平台行为：可缓存且相干的主内存保证 LR/SC 序列的最终成功 `zicntr` | `zicsr` | [Zicntr][rv-zicntr] --- 基础计数器和计时器 `zicond` | | [Zicond][rv-zicond] --- 整数条件操作指令 `zicsr` | | [Zicsr][rv-zicsr] --- 控制和状态寄存器 (CSR) 指令 `zifencei` | | [Zifencei][rv-zifencei] --- 指令获取围栏指令 `zihintntl` | | [Zihintntl][rv-zihintntl] --- 非时间局部性提示指令 `zihintpause` | | [Zihintpause][rv-zihintpause] --- 暂停提示指令 `zihpm` | `zicsr` | [Zihpm][rv-zihpm] --- 硬件性能计数器 `zimop` | | [Zimop][rv-zimop] --- 可能操作 `zk` | `zkn`, `zkr`, `zks`, `zkt`, `zbkb`, `zbkc`, `zkbx` | [Zk][rv-zk] --- 标量密码学 `zkn` | `zknd`, `zkne`, `zknh`, `zbkb`, `zbkc`, `zkbx` | [Zkn][rv-zkn] --- NIST 算法套件扩展 `zknd` | | [Zknd][rv-zknd] --- NIST 套件：AES 解密 `zkne` | | [Zkne][rv-zkne] --- NIST 套件：AES 加密 `zknh` | | [Zknh][rv-zknh] --- NIST 套件：哈希函数指令 `zkr` | | [Zkr][rv-zkr] --- 熵源扩展 `zks` | `zksed`, `zksh`, `zbkb`, `zbkc`, `zkbx` | [Zks][rv-zks] --- 尚米算法套件 `zksed` | | [Zksed][rv-zksed] --- 尚米套件：SM4 块密码指令 `zksh` | | [Zksh][rv-zksh] --- 尚米套件：SM3 哈希函数指令 `zkt` | | [Zkt][rv-zkt] --- 数据独立执行延迟子集 `ztso` | | [Ztso][rv-ztso] --- 总存储排序

<!-- Keep links near each table to make it easier to move and update. -->


<a id="attributes.codegen.target_feature.wasm"></a>
#### `wasm32` 或 `wasm64`

在 Wasm 平台上，安全的 `#[target_feature]` 函数始终可以在安全上下文中使用。通过 `#[target_feature]` 属性无法导致未定义行为，因为尝试使用 Wasm 引擎不支持的指令会在加载时失败，且不会以与编译器预期不同的方式被解释。

功能 | 隐式启用 | 描述
----------------------|---------------------|-------------------
`bulk-memory` | | [WebAssembly 批量内存操作提案][bulk-memory] `extended-const` | | [WebAssembly 扩展常量表达式提案][extended-const] `mutable-globals` | | [WebAssembly 可变全局提案][mutable-globals] `nontrapping-fptoint` | | [WebAssembly 非捕获浮点到整数转换提案][nontrapping-fptoint] `relaxed-simd` | `simd128` | [WebAssembly 宽松 SIMD 提案][relaxed-simd] `sign-ext` | | [WebAssembly 符号扩展运算符提案][sign-ext] `simd128` | | [WebAssembly SIMD 提案][simd128] `multivalue` | | [WebAssembly 多值提案][multivalue] `reference-types` | | [WebAssembly 引用类型提案][reference-types] `tail-call` | | [WebAssembly 尾调用提案][tail-call] `wide-arithmetic` | | [WebAssembly 宽算术提案][wide-arithmetic]


<a id="attributes.codegen.target_feature.s390x"></a>
#### `s390x`

在 `s390x` 目标上，使用带有 `#[target_feature]` 属性的函数需遵守 [上述限制][attributes.codegen.target_feature.safety-restrictions]。

关于这些特性的更多文档可查阅 *[z/Architecture Principles of Operation]* 第1章的“Additions to z/Architecture”部分。

功能 | 隐式启用的内容 | 描述
---------------------------------------|---------------------------------------|---------------------
`vector` | | 128位向量指令 `vector-enhancements-1` | `vector` | 向量增强 1 `vector-enhancements-2` | `vector-enhancements-1` | 向量增强 2 `vector-enhancements-3` | `vector-enhancements-2` | 向量增强 3 `vector-packed-decimal` | `vector` | 向量打包十进制 `vector-packed-decimal-enhancement` | `vector-packed-decimal` | 向量打包十进制增强 `vector-packed-decimal-enhancement-2` | `vector-packed-decimal-enhancement-2` | 向量打包十进制增强 2 `vector-packed-decimal-enhancement-3` | `vector-packed-decimal-enhancement-3` | 向量打包十进制增强 3 `nnp-assist` | `vector` | nnp 辅助 `miscellaneous-extensions-2` | | 杂项扩展 2 `miscellaneous-extensions-3` | | 杂项扩展 3 `miscellaneous-extensions-4` | | 杂项扩展 4


<a id="attributes.codegen.target_feature.info"></a>
### 附加信息

<a id="attributes.codegen.target_feature.remark-cfg"></a> 有关根据编译时设置选择性启用或禁用代码编译的选项，请参阅 [`target_feature`条件编译选项]。请注意，此选项不受 `target_feature` 属性影响，仅由整个 crate 中启用的功能驱动。

<a id="attributes.codegen.target_feature.remark-rt"></a> 是否启用某个功能可以通过标准库中的平台特定宏在运行时检查，例如 [`is_x86_feature_detected`] 或 [`is_aarch64_feature_detected`]。

> [!NOTE]
> `rustc` has a default set of features enabled for each target and CPU. The CPU may be chosen with the [`-C target-cpu`] flag. Individual features may be enabled or disabled for an entire crate with the [`-C target-feature`] flag.

<a id="attributes.codegen.track_caller"></a>
## `track_caller` 属性

<a id="attributes.codegen.track_caller.allowed-positions"></a> `track_caller` 属性可以应用于任何使用 [`"Rust"` ABI][rust-abi] 的函数，但入口点 `fn main` 除外。

<a id="attributes.codegen.track_caller.traits"></a> 当该属性应用于 trait 声明中的函数和方法时，它适用于所有实现。如果 trait 提供了带有该属性的默认实现，那么该属性也适用于覆盖实现。

<a id="attributes.codegen.track_caller.extern"></a> 当该属性应用于 `extern` 块中的函数时，也必须应用于任何链接实现，否则会导致未定义行为。当该属性应用于可供 `extern` 块使用的函数时，`extern` 块中的声明也必须有该属性，否则会导致未定义行为。

<a id="attributes.codegen.track_caller.behavior"></a>
### 行为

将该属性应用于函数 `f` 后，`f` 中的代码可以获得关于导致 `f` 调用的“最顶层”被跟踪调用 [`Location]` 的提示。在观察点处，实现的行为就像从 `f` 的帧沿着栈向上查找最近的 *未标记* 函数 `outer` 的帧一样，然后返回 `outer` 中被跟踪调用的 [`Location]`。

```rust
#[track_caller]
fn f() {
    println!("{}", std::panic::Location::caller());
}
```

> [!NOTE]
> `core` provides [`core::panic::Location::caller`] for observing caller locations. It wraps the [`core::intrinsics::caller_location`] intrinsic implemented by `rustc`.

> [!NOTE]
> Because the resulting `Location` is a hint, an implementation may halt its walk up the stack early. See [Limitations](#limitations) for important caveats.

#### Examples

当 `f` 直接由 `calls_f` 调用时，`f` 中的代码会观察其在 `calls_f` 中的调用点：

```rust
# #[track_caller]
# fn f() {
#     println!("{}", std::panic::Location::caller());
# }
fn calls_f() {
    f(); // <-- f() prints this location
}
```

当 `f` 由另一个带有该属性的函数 `g` 调用，而 `g` 又由 `calls_g` 调用时，`f` 和 `g` 中的代码都会观察 `g` 在 `calls_g` 中的调用点：

```rust
# #[track_caller]
# fn f() {
#     println!("{}", std::panic::Location::caller());
# }
#[track_caller]
fn g() {
    println!("{}", std::panic::Location::caller());
    f();
}

fn calls_g() {
    g(); // <-- g() prints this location twice, once itself and once from f()
}
```

当 `g` 由另一个带有该属性的函数 `h` 调用，而 `h` 又由 `calls_h` 调用时，`f`、`g` 和 `h` 中的所有代码都会观察 `h` 在 `calls_h` 中的调用点：

```rust
# #[track_caller]
# fn f() {
#     println!("{}", std::panic::Location::caller());
# }
# #[track_caller]
# fn g() {
#     println!("{}", std::panic::Location::caller());
#     f();
# }
#[track_caller]
fn h() {
    println!("{}", std::panic::Location::caller());
    g();
}

fn calls_h() {
    h(); // <-- prints this location three times, once itself, once from g(), once from f()
}
```

如此循环下去。

<a id="attributes.codegen.track_caller.limits"></a>
### 限制

<a id="attributes.codegen.track_caller.hint"></a> 此信息仅为提示，实现无需保留它。

<a id="attributes.codegen.track_caller.decay"></a> 特别是，将带有 `#[track_caller]` 的函数转换为函数指针时，会生成一个 shim 层，在观察者看来该层仿佛是在函数的定义位置被调用，但实际上跨虚拟调用的调用者信息会被丢失。这种转换的一个常见例子是创建具有属性标记的方法的 trait 对象。

> [!NOTE]
> The aforementioned shim for function pointers is necessary because `rustc` implements `track_caller` in a codegen context by appending an implicit parameter to the function ABI, but this would be unsound for an indirect call because the parameter is not a part of the function's type and a given function pointer type may or may not refer to a function with the attribute. The creation of a shim hides the implicit parameter from callers of the function pointer, preserving soundness.

<!-- template:attributes -->
<a id="attributes.codegen.instruction_set"></a>
## `instruction_set` 属性

<a id="attributes.codegen.instruction_set.intro"></a> *`instruction_set` [属性]* 指定了函数在代码生成过程中将使用的指令集。这允许在一个程序中混合使用多种指令集。

> [!EXAMPLE]
> <!-- ignore: arm-only -->
> ```rust,ignore
> #[instruction_set(arm::a32)]
> fn arm_code() {}
>
> #[instruction_set(arm::t32)]
> fn thumb_code() {}
> ```

<a id="attributes.codegen.instruction_set.syntax"></a> `instruction_set` 属性使用 [MetaListPaths] 语法来指定由架构家族名称和指令集名称组成的单一路径。

<a id="attributes.codegen.instruction_set.allowed-positions"></a> `instruction_set` 属性只能应用于具有 [bodies] --- [闭包], [异步块], [自由函数], [关联函数] 在 [固有实现] 或 [trait 实现] 中的函数，以及位于 [trait 定义] 中的关联函数，当这些函数具有 [默认定义] 时。

> [!NOTE]
> `rustc` ignores use in other positions but lints against it. This may become an error in the future.

> [!NOTE]
> Though the attribute can be applied to [closures] and [async blocks], the usefulness of this is limited as we do not yet support attributes on expressions.

<a id="attributes.codegen.instruction_set.duplicates"></a> `instruction_set` 属性在函数中只能使用一次。

<a id="attributes.codegen.instruction_set.target-limits"></a> `instruction_set` 属性只能用于支持给定值的目标上。

<a id="attributes.codegen.instruction_set.inline-asm"></a> 当使用 `instruction_set` 属性时，函数中的任何内联汇编必须使用指定的指令集，而不是目标的默认设置。

<a id="attributes.codegen.instruction_set.arm"></a>
### ARM 上的 `instruction_set`

在针对 `ARMv4T` 和 `ARMv5te` 架构时，`instruction_set` 的支持值如下：

- `arm::a32` --- 将函数生成为 A32 “ARM” 代码。 - `arm::t32` --- 将函数生成为 T32 “Thumb” 代码。

如果函数的地址被当作函数指针使用，地址的低位将取决于所选的指令集：

- 对于 `arm::a32`（“ARM”），该位为 0。 - 对于 `arm::t32`（“Thumb”），该位为 1。

[`export_name`]: abi.export_name
[`extern "custom"` function]: items.fn.extern.custom
[`inline` attribute]: attributes.codegen.inline
[`Location`]: core::panic::Location
[`naked_asm!`]: asm
[`no_mangle`]: abi.no_mangle
[`optimize` attribute]: attributes.codegen.optimize
[`target_feature` attribute]: attributes.codegen.target_feature
[`track_caller` attribute]: attributes.codegen.track_caller
[associated functions]: items.associated.fn
[async blocks]: expr.block.async
[async closure]: expr.closure.async
[async function]: items.fn.async
[bodies]: items.fn.body
[closures]: expr.closure
[const blocks]: expr.block.const
[default definition]: items.traits.associated-item-decls
[free functions]: items.fn
[function body]: items.fn.body
[inherent impl]: items.impl.inherent
[naked function]: attributes.codegen.naked
["Rust" ABI]: items.extern.abi.rust
[testing attributes]: attributes.testing
[trait]: items.traits
[trait definition]: items.traits
[trait impl]: items.impl.trait

[ADX]: https://en.wikipedia.org/wiki/Intel_ADX
[AES]: https://en.wikipedia.org/wiki/AES_instruction_set
[AVX]: https://en.wikipedia.org/wiki/Advanced_Vector_Extensions
[AVX2]: https://en.wikipedia.org/wiki/Advanced_Vector_Extensions#AVX2
[AVX512-BF16]: https://en.wikipedia.org/wiki/AVX-512#BF16
[AVX512-BITALG]: https://en.wikipedia.org/wiki/AVX-512#VPOPCNTDQ_and_BITALG
[AVX512-BW]: https://en.wikipedia.org/wiki/AVX-512#BW,_DQ_and_VBMI
[AVX512-CD]: https://en.wikipedia.org/wiki/AVX-512#Conflict_detection
[AVX512-DQ]: https://en.wikipedia.org/wiki/AVX-512#BW,_DQ_and_VBMI
[AVX512-F]: https://en.wikipedia.org/wiki/AVX-512
[AVX512-FP16]: https://en.wikipedia.org/wiki/AVX-512#FP16
[AVX512-IFMA]: https://en.wikipedia.org/wiki/AVX-512#IFMA
[AVX512-VBMI]: https://en.wikipedia.org/wiki/AVX-512#BW,_DQ_and_VBMI
[AVX512-VBMI2]: https://en.wikipedia.org/wiki/AVX-512#VBMI2
[AVX512-VL]: https://en.wikipedia.org/wiki/AVX-512
[AVX512-VNNI]: https://en.wikipedia.org/wiki/AVX-512#VNNI
[AVX512-VP2INTERSECT]: https://en.wikipedia.org/wiki/AVX-512#VP2INTERSECT
[AVX512-VPOPCNTDQ]:https://en.wikipedia.org/wiki/AVX-512#VPOPCNTDQ_and_BITALG
[AVX-IFMA]: https://en.wikipedia.org/wiki/Advanced_Vector_Extensions#AVX-VNNI,_AVX-IFMA
[AVX-NE-CONVERT]: https://en.wikipedia.org/wiki/Advanced_Vector_Extensions#AVX-VNNI,_AVX-IFMA
[AVX-VNNI]: https://en.wikipedia.org/wiki/Advanced_Vector_Extensions#AVX-VNNI,_AVX-IFMA
[AVX-VNNI-INT16]: https://en.wikipedia.org/wiki/Advanced_Vector_Extensions#AVX-VNNI,_AVX-IFMA
[AVX-VNNI-INT8]: https://en.wikipedia.org/wiki/Advanced_Vector_Extensions#AVX-VNNI,_AVX-IFMA
[BMI1]: https://en.wikipedia.org/wiki/Bit_Manipulation_Instruction_Sets
[BMI2]: https://en.wikipedia.org/wiki/Bit_Manipulation_Instruction_Sets#BMI2
[`cmpxchg16b`]: https://www.felixcloutier.com/x86/cmpxchg8b:cmpxchg16b
[F16C]: https://en.wikipedia.org/wiki/F16C
[FMA3]: https://en.wikipedia.org/wiki/FMA_instruction_set
[`fxsave`]: https://www.felixcloutier.com/x86/fxsave
[`fxrstor`]: https://www.felixcloutier.com/x86/fxrstor
[GFNI]: https://en.wikipedia.org/wiki/AVX-512#GFNI
[KEYLOCKER]: https://en.wikipedia.org/wiki/List_of_x86_cryptographic_instructions#Intel_Key_Locker_instructions
[KEYLOCKER_WIDE]: https://en.wikipedia.org/wiki/List_of_x86_cryptographic_instructions#Intel_Key_Locker_instructions
[`lzcnt`]: https://www.felixcloutier.com/x86/lzcnt
[`movbe`]: https://www.felixcloutier.com/x86/movbe
[`pclmulqdq`]: https://www.felixcloutier.com/x86/pclmulqdq
[`popcnt`]: https://www.felixcloutier.com/x86/popcnt
[`rdrand`]: https://en.wikipedia.org/wiki/RdRand
[`rdseed`]: https://en.wikipedia.org/wiki/RdRand
[SHA]: https://en.wikipedia.org/wiki/Intel_SHA_extensions
[SHA512]: https://en.wikipedia.org/wiki/Intel_SHA_extensions
[SM3]: https://en.wikipedia.org/wiki/List_of_x86_cryptographic_instructions#Intel_SHA_and_SM3_instructions
[SM4]: https://en.wikipedia.org/wiki/List_of_x86_cryptographic_instructions#Intel_SHA_and_SM3_instructions
[SSE]: https://en.wikipedia.org/wiki/Streaming_SIMD_Extensions
[SSE2]: https://en.wikipedia.org/wiki/SSE2
[SSE3]: https://en.wikipedia.org/wiki/SSE3
[SSE4.1]: https://en.wikipedia.org/wiki/SSE4#SSE4.1
[SSE4.2]: https://en.wikipedia.org/wiki/SSE4#SSE4.2
[SSE4a]: https://en.wikipedia.org/wiki/SSE4#SSE4a
[SSSE3]: https://en.wikipedia.org/wiki/SSSE3
[TBM]: https://en.wikipedia.org/wiki/X86_Bit_manipulation_instruction_set#TBM_(Trailing_Bit_Manipulation)
[VAES]: https://en.wikipedia.org/wiki/AVX-512#VAES
[VPCLMULQDQ]: https://en.wikipedia.org/wiki/AVX-512#VPCLMULQDQ
[`xsave`]: https://www.felixcloutier.com/x86/xsave
[`xsavec`]: https://www.felixcloutier.com/x86/xsavec
[`xsaveopt`]: https://www.felixcloutier.com/x86/xsaveopt
[`xsaves`]: https://www.felixcloutier.com/x86/xsaves
[ARM Architecture Reference Manual]: https://developer.arm.com/documentation/ddi0487/latest
[developer.arm.com]: https://developer.arm.com
[la-f]: https://loongson.github.io/LoongArch-Documentation/LoongArch-Vol1-EN.html#cpucfg-fp_sp
[la-d]: https://loongson.github.io/LoongArch-Documentation/LoongArch-Vol1-EN.html#cpucfg-fp_dp
[la-frecipe]: https://loongson.github.io/LoongArch-Documentation/LoongArch-Vol1-EN.html#cpucfg-frecipe
[la-lasx]: https://loongson.github.io/LoongArch-Documentation/LoongArch-Vol1-EN.html#cpucfg-lasx
[la-lbt]: https://loongson.github.io/LoongArch-Documentation/LoongArch-Vol1-EN.html#cpucfg-lbt_x86
[la-lsx]: https://loongson.github.io/LoongArch-Documentation/LoongArch-Vol1-EN.html#cpucfg-lsx
[la-lvz]: https://loongson.github.io/LoongArch-Documentation/LoongArch-Vol1-EN.html#cpucfg-lvz
[la-div32]: https://loongson.github.io/LoongArch-Documentation/LoongArch-Vol1-EN.html#cpucfg-div32
[la-lam-bh]: https://loongson.github.io/LoongArch-Documentation/LoongArch-Vol1-EN.html#cpucfg-lam_bh
[la-lamcas]: https://loongson.github.io/LoongArch-Documentation/LoongArch-Vol1-EN.html#cpucfg-lamcas
[la-ld-seq-sa]: https://loongson.github.io/LoongArch-Documentation/LoongArch-Vol1-EN.html#cpucfg-ld_seq_sa
[la-scq]: https://loongson.github.io/LoongArch-Documentation/LoongArch-Vol1-EN.html#cpucfg-scq
[RISC-V ISA Manual]: https://github.com/riscv/riscv-isa-manual
[version 20250508]: https://github.com/riscv/riscv-isa-manual/tree/20250508
[RISC-V GitHub Account]: https://github.com/riscv
[rv-a]: https://github.com/riscv/riscv-isa-manual/blob/20250508/src/a-st-ext.adoc
[rv-b]: https://github.com/riscv/riscv-isa-manual/blob/20250508/src/b-st-ext.adoc
[rv-c]: https://github.com/riscv/riscv-isa-manual/blob/20250508/src/c-st-ext.adoc
[rv-d]: https://github.com/riscv/riscv-isa-manual/blob/20250508/src/d-st-ext.adoc
[rv-f]: https://github.com/riscv/riscv-isa-manual/blob/20250508/src/f-st-ext.adoc
[rv-m]: https://github.com/riscv/riscv-isa-manual/blob/20250508/src/m-st-ext.adoc
[rv-za64rs]: https://github.com/riscv/riscv-profiles/blob/rva23-rvb23-ratified/src/rva23-profile.adoc
[rv-za128rs]: https://github.com/riscv/riscv-profiles/blob/v1.0/profiles.adoc
[rv-zaamo]: https://github.com/riscv/riscv-isa-manual/blob/20250508/src/a-st-ext.adoc
[rv-zabha]: https://github.com/riscv/riscv-isa-manual/blob/20250508/src/zabha.adoc
[rv-zacas]: https://github.com/riscv/riscv-isa-manual/blob/20250508/src/zacas.adoc
[rv-zalrsc]: https://github.com/riscv/riscv-isa-manual/blob/20250508/src/a-st-ext.adoc
[rv-zama16b]: https://github.com/riscv/riscv-profiles/blob/rva23-rvb23-ratified/src/rva23-profile.adoc
[rv-zawrs]: https://github.com/riscv/riscv-isa-manual/blob/20250508/src/zawrs.adoc
[rv-zba]: https://github.com/riscv/riscv-isa-manual/blob/20250508/src/b-st-ext.adoc
[rv-zbb]: https://github.com/riscv/riscv-isa-manual/blob/20250508/src/b-st-ext.adoc
[rv-zbc]: https://github.com/riscv/riscv-isa-manual/blob/20250508/src/b-st-ext.adoc
[rv-zbkb]: https://github.com/riscv/riscv-isa-manual/blob/20250508/src/b-st-ext.adoc
[rv-zbkc]: https://github.com/riscv/riscv-isa-manual/blob/20250508/src/b-st-ext.adoc
[rv-zbkx]: https://github.com/riscv/riscv-isa-manual/blob/20250508/src/b-st-ext.adoc
[rv-zbs]: https://github.com/riscv/riscv-isa-manual/blob/20250508/src/b-st-ext.adoc
[rv-zca]: https://github.com/riscv/riscv-isa-manual/blob/20250508/src/zc.adoc
[rv-zcb]: https://github.com/riscv/riscv-isa-manual/blob/20250508/src/zc.adoc
[rv-zcmop]: https://github.com/riscv/riscv-isa-manual/blob/20250508/src/zimop.adoc
[rv-zic64b]: https://github.com/riscv/riscv-profiles/blob/v1.0/profiles.adoc
[rv-zicbom]: https://github.com/riscv/riscv-isa-manual/blob/20250508/src/cmo.adoc
[rv-zicbop]: https://github.com/riscv/riscv-isa-manual/blob/20250508/src/cmo.adoc
[rv-zicboz]: https://github.com/riscv/riscv-isa-manual/blob/20250508/src/cmo.adoc
[rv-ziccamoa]: https://github.com/riscv/riscv-profiles/blob/v1.0/profiles.adoc
[rv-ziccif]: https://github.com/riscv/riscv-profiles/blob/v1.0/profiles.adoc
[rv-zicclsm]: https://github.com/riscv/riscv-profiles/blob/v1.0/profiles.adoc
[rv-ziccrse]: https://github.com/riscv/riscv-profiles/blob/v1.0/profiles.adoc
[rv-zicntr]: https://github.com/riscv/riscv-isa-manual/blob/20250508/src/counters.adoc
[rv-zicond]: https://github.com/riscv/riscv-isa-manual/blob/20250508/src/zicond.adoc
[rv-zicsr]: https://github.com/riscv/riscv-isa-manual/blob/20250508/src/zicsr.adoc
[rv-zifencei]: https://github.com/riscv/riscv-isa-manual/blob/20250508/src/zifencei.adoc
[rv-zihintntl]: https://github.com/riscv/riscv-isa-manual/blob/20250508/src/zihintntl.adoc
[rv-zihintpause]: https://github.com/riscv/riscv-isa-manual/blob/20250508/src/zihintpause.adoc
[rv-zihpm]: https://github.com/riscv/riscv-isa-manual/blob/20250508/src/counters.adoc
[rv-zimop]: https://github.com/riscv/riscv-isa-manual/blob/20250508/src/zimop.adoc
[rv-zk]: https://github.com/riscv/riscv-isa-manual/blob/20250508/src/scalar-crypto.adoc
[rv-zkn]: https://github.com/riscv/riscv-isa-manual/blob/20250508/src/scalar-crypto.adoc
[rv-zkne]: https://github.com/riscv/riscv-isa-manual/blob/20250508/src/scalar-crypto.adoc
[rv-zknd]: https://github.com/riscv/riscv-isa-manual/blob/20250508/src/scalar-crypto.adoc
[rv-zknh]: https://github.com/riscv/riscv-isa-manual/blob/20250508/src/scalar-crypto.adoc
[rv-zkr]: https://github.com/riscv/riscv-isa-manual/blob/20250508/src/scalar-crypto.adoc
[rv-zks]: https://github.com/riscv/riscv-isa-manual/blob/20250508/src/scalar-crypto.adoc
[rv-zksed]: https://github.com/riscv/riscv-isa-manual/blob/20250508/src/scalar-crypto.adoc
[rv-zksh]: https://github.com/riscv/riscv-isa-manual/blob/20250508/src/scalar-crypto.adoc
[rv-zkt]: https://github.com/riscv/riscv-isa-manual/blob/20250508/src/scalar-crypto.adoc
[rv-ztso]: https://github.com/riscv/riscv-isa-manual/blob/20250508/src/ztso-st-ext.adoc
[bulk-memory]: https://github.com/WebAssembly/bulk-memory-operations
[extended-const]: https://github.com/WebAssembly/extended-const
[mutable-globals]: https://github.com/WebAssembly/mutable-global
[nontrapping-fptoint]: https://github.com/WebAssembly/nontrapping-float-to-int-conversions
[relaxed-simd]: https://github.com/WebAssembly/relaxed-simd
[sign-ext]: https://github.com/WebAssembly/sign-extension-ops
[simd128]: https://github.com/webassembly/simd
[reference-types]: https://github.com/webassembly/reference-types
[tail-call]: https://github.com/webassembly/tail-call
[multivalue]: https://github.com/webassembly/multi-value
[wide-arithmetic]: https://github.com/webassembly/wide-arithmetic
[z/Architecture Principles of Operation]: https://publibfp.dhe.ibm.com/epubs/pdf/a227832d.pdf
[`-C target-cpu`]: ../../rustc/codegen-options/index.html#target-cpu
[`-C target-feature`]: ../../rustc/codegen-options/index.html#target-feature
[`is_aarch64_feature_detected`]: ../../std/arch/macro.is_aarch64_feature_detected.html
[`is_x86_feature_detected`]: ../../std/arch/macro.is_x86_feature_detected.html
[`target_feature` conditional compilation option]: ../conditional-compilation.md#target_feature
[`unused_variables` lint]: ../../rustc/lints/listing/warn-by-default.html#unused-variables
[attribute]: ../attributes.md
[attributes]: ../attributes.md
[functions]: ../items/functions.md
[rust-abi]: ../items/external-blocks.md#abi
[target architecture]: ../conditional-compilation.md#target_arch
[undefined behavior]: ../behavior-considered-undefined.md
[unsafe attribute]: ../attributes.md#r-attributes.safety
