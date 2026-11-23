<a id="asm"></a>
# 内联汇编

<a id="asm.intro"></a> 通过 [`asm!`]、 [`naked_asm!`] 和 [`global_asm!`] 宏支持内联汇编。它可用于将手写汇编代码嵌入到编译器生成的汇编输出中。


<a id="asm.stable-targets"></a> 以下架构上内联汇编功能已稳定： - x86 和 x86-64 - ARM - AArch64 和 Arm64EC - RISC-V - LoongArch - s390x - PowerPC 和 PowerPC64

如果在不受支持的目标上使用汇编宏，编译器将发出错误提示。

<a id="asm.example"></a>
## 示例

```rust
# #[cfg(target_arch = "x86_64")] {
use std::arch::asm;

// Multiply x by 6 using shifts and adds
let mut x: u64 = 4;
unsafe {
    asm!(
        "mov {tmp}, {x}",
        "shl {tmp}, 1",
        "shl {x}, 2",
        "add {x}, {tmp}",
        x = inout(reg) x,
        tmp = out(reg) _,
    );
}
assert_eq!(x, 4 * 6);
# }
```

<a id="asm.syntax"></a>
## 语法

以下语法规则规定了可以传递给 `asm!`、 `global_asm!` 和 `naked_asm!` 宏的参数。

```grammar,assembly
@root AsmArgs -> AsmAttrFormatString (`,` AsmAttrFormatString)* (`,` AsmAttrOperand)* `,`?

FormatString -> STRING_LITERAL | RAW_STRING_LITERAL | MacroInvocation

AsmAttrFormatString -> (OuterAttribute)* FormatString

AsmOperand ->
      ClobberAbi
    | AsmOptions
    | RegOperand

AsmAttrOperand -> (OuterAttribute)* AsmOperand

ClobberAbi -> `clobber_abi` `(` Abi (`,` Abi)* `,`? `)`

AsmOptions ->
    `options` `(` ( AsmOption (`,` AsmOption)* `,`? )? `)`

AsmOption ->
      `pure`
    | `nomem`
    | `readonly`
    | `preserves_flags`
    | `noreturn`
    | `nostack`
    | `att_syntax`
    | `raw`

RegOperand -> (ParamName `=`)?
    (
          DirSpec `(` RegSpec `)` Expression
        | DualDirSpec `(` RegSpec `)` DualDirSpecExpression
        | `sym` PathExpression
        | `const` Expression
        | `label` `{` Statements? `}`
    )

ParamName -> IDENTIFIER_OR_KEYWORD | RAW_IDENTIFIER

DualDirSpecExpression ->
      Expression
    | Expression `=>` Expression

RegSpec -> RegisterClass | ExplicitRegister

RegisterClass -> IDENTIFIER_OR_KEYWORD

ExplicitRegister -> STRING_LITERAL

DirSpec ->
      `in`
    | `out`
    | `lateout`

DualDirSpec ->
      `inout`
    | `inlateout`
```

<a id="asm.scope"></a>
## 作用域

<a id="asm.scope.intro"></a> 内联汇编可以通过三种方式使用。

<a id="asm.scope.asm"></a> 使用 [`asm!`] 宏时，汇编代码在函数作用域内生成，并集成到函数的编译器生成的汇编代码中。此汇编代码必须遵循 [严格规则](#rules-for-inline-assembly) 以避免未定义行为。请注意，在某些情况下，编译器可能会选择将汇编代码作为独立函数生成并调用该函数。

```rust
# #[cfg(target_arch = "x86_64")] {
unsafe { core::arch::asm!("/* {} */", in(reg) 0); }
# }
```

<a id="asm.scope.naked_asm"></a> 使用 [`naked_asm!`] 宏时，汇编代码在函数作用域内生成，构成函数的完整汇编代码。`naked_asm!` 宏仅允许用于 [裸函数](attributes/codegen.md#the-naked-attribute)。

```rust
# #[cfg(target_arch = "x86_64")] {
# #[unsafe(naked)]
# extern "C" fn wrapper() {
core::arch::naked_asm!("/* {} */", const 0);
# }
# }
```

<a id="asm.scope.global_asm"></a> 使用 [`global_asm!`] 宏时，汇编代码在全局作用域中生成，位于函数之外。这可用于使用汇编代码编写整个函数，通常能更自由地使用任意寄存器和汇编指令。

```rust
# fn main() {}
# #[cfg(target_arch = "x86_64")]
core::arch::global_asm!("/* {} */", const 0);
```

<a id="asm.ts-args"></a>
## 模板字符串参数

<a id="asm.ts-args.syntax"></a> 汇编器模板使用与 [格式字符串][format-syntax] 相同的语法（即占位符由花括号指定）。

<a id="asm.ts-args.order"></a> 相应的参数按索引或名称顺序访问。

```rust
# #[cfg(target_arch = "x86_64")] {
let x: i64;
let y: i64;
let z: i64;
// This
unsafe { core::arch::asm!("mov {}, {}", out(reg) x, in(reg) 5); }
// ... this
unsafe { core::arch::asm!("mov {0}, {1}", out(reg) y, in(reg) 5); }
// ... and this
unsafe { core::arch::asm!("mov {out}, {in}", out = out(reg) z, in = in(reg) 5); }
// all have the same behavior
assert_eq!(x, y);
assert_eq!(y, z);
# }
```

<a id="asm.ts-args.no-implicit"></a> 然而，隐式命名参数（由 [RFC #2795][rfc-2795] 引入）不受支持。

```rust,compile_fail
# #[cfg(target_arch = "x86_64")] {
let x = 5;
// We can't refer to `x` from the scope directly, we need an operand like `in(reg) x`
unsafe { core::arch::asm!("/* {x} */"); } // ERROR: no argument named x
# }
# #[cfg(not(target_arch = "x86_64"))] core::compile_error!("Test not supported on this arch");
```

<a id="asm.ts-args.one-or-more"></a> `asm!` 调用可以包含一个或多个模板字符串参数；带有多个模板字符串参数的 `asm!` 会被视为所有字符串通过 `\n` 连接在一起。其预期用途是每个模板字符串参数对应一行汇编代码。

```rust
# #[cfg(target_arch = "x86_64")] {
let x: i64;
let y: i64;
// We can separate multiple strings as if they were written together
unsafe { core::arch::asm!("mov eax, 5", "mov ecx, eax", out("rax") x, out("rcx") y); }
assert_eq!(x, y);
# }
```

<a id="asm.ts-args.before-other-args"></a> 所有模板字符串参数必须出现在其他任何参数之前。

```rust,compile_fail
let x = 5;
# #[cfg(target_arch = "x86_64")] {
// The template strings need to appear first in the asm invocation
unsafe { core::arch::asm!("/* {x} */", x = const 5, "ud2"); } // ERROR: unexpected token
# }
# #[cfg(not(target_arch = "x86_64"))] core::compile_error!("Test not supported on this arch");
```

<a id="asm.ts-args.positional-first"></a> 与格式字符串类似，位置参数必须位于命名参数和显式 [寄存器操作数](#register-operands) 之前。

```rust,compile_fail
# #[cfg(target_arch = "x86_64")] {
// Named operands need to come after positional ones
unsafe { core::arch::asm!("/* {x} {} */", x = const 5, in(reg) 5); }
// ERROR: positional arguments cannot follow named arguments or explicit register arguments
# }
# #[cfg(not(target_arch = "x86_64"))] core::compile_error!("Test not supported on this arch");
```

```rust,compile_fail
# #[cfg(target_arch = "x86_64")] {
// We also can't put explicit registers before positional operands
unsafe { core::arch::asm!("/* {} */", in("eax") 0, in(reg) 5); }
// ERROR: positional arguments cannot follow named arguments or explicit register arguments
# }
# #[cfg(not(target_arch = "x86_64"))] core::compile_error!("Test not supported on this arch");
```

<a id="asm.ts-args.register-operands"></a> 显式的寄存器操作数不能被模板字符串中的占位符使用。

```rust,compile_fail
# #[cfg(target_arch = "x86_64")] {
// Explicit register operands don't get substituted, use `eax` explicitly in the string
unsafe { core::arch::asm!("/* {} */", in("eax") 5); }
// ERROR: invalid reference to argument at index 0
# }
# #[cfg(not(target_arch = "x86_64"))] core::compile_error!("Test not supported on this arch");
```

<a id="asm.ts-args.at-least-once"></a> 所有其他命名和位置参数必须在模板字符串中至少出现一次，否则将产生编译器错误。

```rust,compile_fail
# #[cfg(target_arch = "x86_64")] {
// We have to name all of the operands in the format string
unsafe { core::arch::asm!("", in(reg) 5, x = const 5); }
// ERROR: multiple unused asm arguments
# }
# #[cfg(not(target_arch = "x86_64"))] core::compile_error!("Test not supported on this arch");
```

<a id="asm.ts-args.opaque"></a> 具体的汇编代码语法因目标而异且对编译器来说是不可知的，除了操作数如何被代入模板字符串以形成传递给汇编器的代码这一方式。

<a id="asm.ts-args.llvm-syntax"></a> 目前，所有支持的目标都遵循 LLVM 内部汇编器使用的汇编代码语法，通常对应于 GNU 汇编器 (GAS) 的语法。在 x86 上，默认使用 GAS 的 `.intel_syntax noprefix` 模式。在 ARM 上，使用 `.syntax unified` 模式。这些目标对汇编代码施加了额外的限制：任何汇编状态（例如可以通过 `.section` 更改的当前段）必须在 `asm` 字符串末尾恢复为其原始值。不符合 GAS 语法的汇编代码将导致特定于汇编器的行为。内联汇编使用的指令的进一步约束由 [Directives Support](#directives-support) 指示。


<a id="asm.attributes"></a>
## 属性

<a id="asm.attributes.supported-attributes"></a> 在内联汇编模板字符串和操作数上，仅接受 [`cfg`] 和 [`cfg_attr`] 属性，这些属性在语义上是被认可的。其他属性会被解析，但在汇编宏展开时被拒绝。

```rust
# fn main() {}
# #[cfg(target_arch = "x86_64")]
core::arch::global_asm!(
    #[cfg(not(panic = "abort"))]
    ".cfi_startproc",
    // ...
    "ret",
    #[cfg(not(panic = "abort"))]
    ".cfi_endproc",
);
```

> [!NOTE]
> In `rustc`, the assembly macros implement handling of these attributes separately from the normal system that handles similar attributes in the language. This accounts for the limited kinds of attributes supported and may give rise to subtle differences in behavior.

<a id="asm.attributes.starts-with-template"></a> 从语法上讲，第一个操作数之前必须至少有一个模板字符串。

```rust,compile_fail
// This is rejected because `a = out(reg) x` does not parse as a
// template string.
core::arch::asm!(
    #[cfg(false)]
    a = out(reg) x, // ERROR.
    "",
);
```


<a id="asm.operand-type"></a>
## 操作数类型

<a id="asm.operand-type.supported-operands"></a> 支持几种类型的操作数：

<a id="asm.operand-type.supported-operands-in"></a> * `in(<reg>) <expr>` - `<reg>` 可以指注册类或显式寄存器。分配的寄存器名称会被代入到 asm 模板字符串中。 - 分配的寄存器将在汇编代码开始处包含 `<expr>` 的值。 - 分配的寄存器在汇编代码结束处必须包含相同的值（除非同一寄存器被分配了 `lateout`）。

```rust
# #[cfg(target_arch = "x86_64")] {
// ``in` can be used to pass values into inline assembly...
unsafe { core::arch::asm!("/* {} */", in(reg) 5); }
# }
```

> [!NOTE]
> If the value's type is smaller than the register, the value of the upper bits is platform-specific. Some targets zero out the upper bits, while others leave them untouched.

<a id="asm.operand-type.supported-operands-out"></a> * `out(<reg>) <expr>` - `<reg>` 可以指注册类或显式寄存器。分配的寄存器名称会被代入到 asm 模板字符串中。 - 分配的寄存器将在汇编代码开始处包含未定义的值。 - `<expr>` 必须是（可能未初始化的）位置表达式，分配寄存器的内容将在汇编代码结束处写入该表达式。 - 可以使用下划线 (`_`) 代替表达式，这样在汇编代码结束时就会丢弃寄存器的内容（实际上起到覆盖作用）。

```rust
# #[cfg(target_arch = "x86_64")] {
let x: i64;
// and `out` can be used to pass values back to rust.
unsafe { core::arch::asm!("/* {} */", out(reg) x); }
# }
```

<a id="asm.operand-type.supported-operands-lateout"></a> * `lateout(<reg>) <expr>` - 与 `out` 类似，不同之处在于寄存器分配器可以重新使用被分配给 `in` 的寄存器。 - 你应该在所有输入都被读取之后才写入该寄存器，否则可能会覆盖某个输入。

```rust
# #[cfg(target_arch = "x86_64")] {
let x: i64;
// `lateout` is the same as `out`
// but the compiler knows we don't care about the value of any inputs by the
// time we overwrite it.
unsafe { core::arch::asm!("mov {}, 5", lateout(reg) x); }
assert_eq!(x, 5)
# }
```

<a id="asm.operand-type.supported-operands-inout"></a> * `inout(<reg>) <expr>` - `<reg>` 可以指寄存器类或显式寄存器。分配的寄存器名称会被代入到 asm 模板字符串中。 - 分配的寄存器将在汇编代码开始处包含 `<expr>` 的值。 - `<expr>` 必须是一个可修改的初始化位置表达式，汇编代码结束时会将分配寄存器的内容写入该表达式中。

```rust
# #[cfg(target_arch = "x86_64")] {
let mut x: i64 = 4;
// `inout` can be used to modify values in-register
unsafe { core::arch::asm!("inc {}", inout(reg) x); }
assert_eq!(x, 5);
# }
```

<a id="asm.operand-type.supported-operands-inout-arrow"></a> * `inout(<reg>) <in expr> => <out expr>` - 与 `inout` 相同，不同之处在于寄存器的初始值来自 `<in expr>` 的值。 - `<out expr>` 必须是一个（可能未初始化的）位置表达式，汇编代码结束时会将分配寄存器的内容写入该表达式中。 - 可以用下划线 (`_`) 代替表达式作为 `<out expr>`，这样在汇编代码结束时会丢弃寄存器中的内容（实际上起到覆盖作用）。 - `<in expr>` 和 `<out expr>` 可以具有不同的类型。

```rust
# #[cfg(target_arch = "x86_64")] {
let x: i64;
// `inout` can also move values to different places
unsafe { core::arch::asm!("inc {}", inout(reg) 4u64=>x); }
assert_eq!(x, 5);
# }
```

<a id="asm.operand-type.supported-operands-inlateout"></a> * `inlateout(<reg>) <expr>` / `inlateout(<reg>) <in expr> => <out expr>` - 与 `inout` 相同，不同之处在于寄存器分配器可以重新使用被分配给 `in` 的寄存器（如果编译器知道 `in` 的初始值与 `inlateout` 相同，则可能发生这种情况）。 - 应在所有输入读取之后才写入该寄存器，否则可能会覆盖某个输入。

```rust
# #[cfg(target_arch = "x86_64")] {
let mut x: i64 = 4;
// `inlateout` is `inout` using `lateout`
unsafe { core::arch::asm!("inc {}", inlateout(reg) x); }
assert_eq!(x, 5);
# }
```

<a id="asm.operand-type.supported-operands-sym"></a> * `sym <path>` - `<path>` 必须指向一个 `fn` 或 `static`。 - 指代该项的混淆符号名称会被代入到 asm 模板字符串中。 - 替换后的字符串不包含任何修饰符（例如 GOT、PLT、重定位等）。 - `<path>` 可以指向一个 `#[thread_local]` static，在这种情况下，汇编代码可以将该符号与重定位结合使用（例如 `@plt`、`@TPOFF`），以从线程本地数据读取数据。

```rust
# #[cfg(target_arch = "x86_64")] {
extern "C" fn foo() {
    println!("Hello from inline assembly")
}
// `sym` can be used to refer to a function (even if it doesn't have an
// external name we can directly write)
unsafe { core::arch::asm!("call {}", sym foo, clobber_abi("C")); }
# }
```

<a id="asm.operand-type.supported-operands-const"></a> * `const <expr>` - `<expr>` 必须是一个整数常量表达式。该表达式遵循与内联 `const` 块相同的规则。 - 表达式的类型可以是任何整数类型，但默认为 `i32`，类似于整数字面量。 - 表达式的值以字符串形式呈现，并直接插入到 asm 模板字符串中。

```rust
# #[cfg(target_arch = "x86_64")] {
// swizzle [0, 1, 2, 3] => [3, 2, 0, 1]
const SHUFFLE: u8 = 0b01_00_10_11;
let x: core::arch::x86_64::__m128 = unsafe { core::mem::transmute([0u32, 1u32, 2u32, 3u32]) };
let y: core::arch::x86_64::__m128;
// Pass a constant value into an instruction that expects an immediate like `pshufd`
unsafe {
    core::arch::asm!("pshufd {xmm}, {xmm}, {shuffle}",
        xmm = inlateout(xmm_reg) x=>y,
        shuffle = const SHUFFLE
    );
}
let y: [u32; 4] = unsafe { core::mem::transmute(y) };
assert_eq!(y, [3, 2, 0, 1]);
# }
```

<a id="asm.operand-type.supported-operands-label"></a> * `label <block>` - 块的地址被插入到 asm 模板字符串中。汇编代码可以跳转到该地址。 - 对于区分直接跳转和间接跳转的目标（例如启用 `cf-protection` 的 x86-64 系统），汇编代码不得通过间接方式跳转到该地址。 - 在块执行完成后，会返回 `asm!` 表达式的结果。 - 块的类型必须是 `unit` 或 `!`（不能是其他值）。 - 该块开始一个新的安全上下文；位于 `label` 块内的不安全操作必须被包裹在一个内部的 `unsafe` 块中，即使整个 `asm!` 表达式本身已经被包裹在 `unsafe` 中。

```rust
# #[cfg(target_arch = "x86_64")]
unsafe {
    core::arch::asm!("jmp {}", label {
        println!("Hello from inline assembly label");
    });
}
```

<a id="asm.operand-type.left-to-right"></a> 操作数表达式按照从左到右的顺序计算，就像函数调用参数一样。在 `asm!` 执行完成后，输出结果也会按从左到右的顺序写入。如果有两个输出指向同一个位置，这一点非常重要：该位置将包含最右侧输出的值。

```rust
# #[cfg(target_arch = "x86_64")] {
let mut y: i64;
// y gets its value from the second output, rather than the first
unsafe { core::arch::asm!("mov {}, 0", "mov {}, 1", out(reg) y, out(reg) y); }
assert_eq!(y, 1);
# }
```

<a id="asm.operand-type.naked_asm-restriction"></a> 由于 `naked_asm!` 定义了整个函数体，编译器无法生成额外的代码来处理操作数，因此只能使用 `sym` 和 `const` 操作数。

<a id="asm.operand-type.global_asm-restriction"></a> 由于 `global_asm!` 存在于函数之外，它只能使用 `sym` 和 `const` 操作数。

```rust,compile_fail
# fn main() {}
// register operands aren't allowed, since we aren't in a function
# #[cfg(target_arch = "x86_64")]
core::arch::global_asm!("", in(reg) 5);
// ERROR: the `in` operand cannot be used with `global_asm!`
# #[cfg(not(target_arch = "x86_64"))] core::compile_error!("Test not supported on this arch");
```

```rust
# fn main() {}
fn foo() {}

# #[cfg(target_arch = "x86_64")]
// `const` and `sym` are both allowed, however
core::arch::global_asm!("/* {} {} */", const 0, sym foo);
```

<a id="asm.register-operands"></a>
## 寄存器操作数

<a id="asm.register-operands.register-or-class"></a> 输入和输出操作数可以指定为显式寄存器，也可以指定为寄存器类，由寄存器分配器从中选择一个寄存器。显式寄存器以字符串字面量形式指定（例如 `"eax"`），而寄存器类则以标识符形式指定（例如 `reg`）。

```rust
# #[cfg(target_arch = "x86_64")] {
let mut y: i64;
// We can name both `reg`, or an explicit register like `eax` to get an
// integer register
unsafe { core::arch::asm!("mov eax, {:e}", in(reg) 5, lateout("eax") y); }
assert_eq!(y, 5);
# }
```

<a id="asm.register-operands.equivalence-to-base-register"></a> 请注意，显式寄存器将寄存器别名（例如 ARM 中的 `r14` 与 `lr`）以及寄存器的较小视图（例如 `eax` 与 `rax`）视为与基本寄存器等价。

<a id="asm.register-operands.error-two-operands"></a> 使用相同的显式寄存器作为两个输入操作数或两个输出操作数是编译时错误。

```rust,compile_fail
# #[cfg(target_arch = "x86_64")] {
// We can't name eax twice
unsafe { core::arch::asm!("", in("eax") 5, in("eax") 4); }
// ERROR: register `eax` conflicts with register `eax`
# }
# #[cfg(not(target_arch = "x86_64"))] core::compile_error!("Test not supported on this arch");
```
```rust,compile_fail
# #[cfg(target_arch = "x86_64")] {
// ... even using different aliases
unsafe { core::arch::asm!("", in("ax") 5, in("rax") 4); }
// ERROR: register `rax` conflicts with register `ax`
# }
# #[cfg(not(target_arch = "x86_64"))] core::compile_error!("Test not supported on this arch");
```

<a id="asm.register-operands.error-overlapping"></a> 此外，在输入操作数或输出操作数中使用重叠寄存器（例如 ARM VFP）也是编译时错误。

```rust,compile_fail
# #[cfg(target_arch = "x86_64")] {
// al overlaps with ax, so we can't name both of them.
unsafe { core::arch::asm!("", in("ax") 5, in("al") 4i8); }
// ERROR: register `al` conflicts with register `ax`
# }
# #[cfg(not(target_arch = "x86_64"))] core::compile_error!("Test not supported on this arch");
```

<a id="asm.register-operands.allowed-types"></a> 仅以下类型允许作为内联汇编的操作数：- 整数（有符号和无符号）- 浮点数- 指针（仅薄指针）- 函数指针- SIMD 向量（使用 `#[repr(simd)]` 定义的结构体且实现 `Copy` 接口）。这包括 `std::arch` 中定义的特定架构向量类型，如 `__m128`（x86）或 `int8x16_t`（ARM）。

```rust
# #[cfg(target_arch = "x86_64")] {
extern "C" fn foo() {}

// Integers are allowed...
let y: i64 = 5;
unsafe { core::arch::asm!("/* {} */", in(reg) y); }

// and pointers...
let py = &raw const y;
unsafe { core::arch::asm!("/* {} */", in(reg) py); }

// floats as well...
let f = 1.0f32;
unsafe { core::arch::asm!("/* {} */", in(xmm_reg) f); }

// even function pointers and simd vectors.
let func: extern "C" fn() = foo;
unsafe { core::arch::asm!("/* {} */", in(reg) func); }

let z = unsafe { core::arch::x86_64::_mm_set_epi64x(1, 0) };
unsafe { core::arch::asm!("/* {} */", in(xmm_reg) z); }
# }
```

```rust,compile_fail
# #[cfg(target_arch = "x86_64")] {
struct Foo;
let x: Foo = Foo;
// Complex types like structs are not allowed
unsafe { core::arch::asm!("/* {} */", in(reg) x); }
// ERROR: cannot use value of type `Foo` for inline assembly
# }
# #[cfg(not(target_arch = "x86_64"))] core::compile_error!("Test not supported on this arch");
```

<a id="asm.register-operands.supported-register-classes"></a> 以下是当前支持的寄存器类列表：

| Architecture | Register class | Registers | LLVM constraint code |
| ------------ | -------------- | --------- | -------------------- |
| x86 | `reg` | `ax`, `bx`, `cx`, `dx`, `si`, `di`, `bp`, `r[8-15]` (x86-64 only) | `r` |
| x86 | `reg_abcd` | `ax`, `bx`, `cx`, `dx` | `Q` |
| x86-32 | `reg_byte` | `al`, `bl`, `cl`, `dl`, `ah`, `bh`, `ch`, `dh` | `q` |
| x86-64 | `reg_byte`\* | `al`, `bl`, `cl`, `dl`, `sil`, `dil`, `bpl`, `r[8-15]b` | `q` |
| x86 | `xmm_reg` | `xmm[0-7]` (x86) `xmm[0-15]` (x86-64) | `x` |
| x86 | `ymm_reg` | `ymm[0-7]` (x86) `ymm[0-15]` (x86-64) | `x` |
| x86 | `zmm_reg` | `zmm[0-7]` (x86) `zmm[0-31]` (x86-64) | `v` |
| x86 | `kreg` | `k[1-7]` | `Yk` |
| x86 | `kreg0` | `k0` | Only clobbers |
| x86 | `x87_reg` | `st([0-7])` | Only clobbers |
| x86 | `mmx_reg` | `mm[0-7]` | Only clobbers |
| x86-64 | `tmm_reg` | `tmm[0-7]` | Only clobbers |
| AArch64 | `reg` | `x[0-30]` | `r` |
| AArch64 | `vreg` | `v[0-31]` | `w` |
| AArch64 | `vreg_low16` | `v[0-15]` | `x` |
| AArch64 | `preg` | `p[0-15]`, `ffr` | Only clobbers |
| Arm64EC | `reg` | `x[0-12]`, `x[15-22]`, `x[25-27]`, `x30` | `r` |
| Arm64EC | `vreg` | `v[0-15]` | `w` |
| Arm64EC | `vreg_low16` | `v[0-15]` | `x` |
| ARM (ARM/Thumb2) | `reg` | `r[0-12]`, `r14` | `r` |
| ARM (Thumb1) | `reg` | `r[0-7]` | `r` |
| ARM | `sreg` | `s[0-31]` | `t` |
| ARM | `sreg_low16` | `s[0-15]` | `x` |
| ARM | `dreg` | `d[0-31]` | `w` |
| ARM | `dreg_low16` | `d[0-15]` | `t` |
| ARM | `dreg_low8` | `d[0-8]` | `x` |
| ARM | `qreg` | `q[0-15]` | `w` |
| ARM | `qreg_low8` | `q[0-7]` | `t` |
| ARM | `qreg_low4` | `q[0-3]` | `x` |
| RISC-V | `reg` | `x1`, `x[5-7]`, `x[9-15]`, `x[16-31]` (non-RV32E) | `r` |
| RISC-V | `freg` | `f[0-31]` | `f` |
| RISC-V | `vreg` | `v[0-31]` | Only clobbers |
| LoongArch | `reg` | `$r1`, `$r[4-20]`, `$r[23,30]` | `r` |
| LoongArch | `freg` | `$f[0-31]` | `f` |
| s390x | `reg` | `r[0-10]`, `r[12-14]` | `r` |
| s390x | `reg_addr` | `r[1-10]`, `r[12-14]` | `a` |
| s390x | `freg` | `f[0-15]` | `f` |
| s390x | `vreg` | `v[0-31]` | `v` |
| s390x | `areg` | `a[2-15]` | Only clobbers |
| PowerPC | `reg` | `r0`, `r[3-12]`, `r[14-28]` | `r` |
| PowerPC | `reg_nonzero` | `r[3-12]`, `r[14-28]` | `b` |
| PowerPC | `spe_acc` | `spe_acc` | Only clobbers |
| PowerPC64 | `reg` | `r0`, `r[3-12]`, `r[14-29]` | `r` |
| PowerPC64 | `reg_nonzero` | `r[3-12]`, `r[14-29]` | `b` |
| PowerPC/PowerPC64 | `freg` | `f[0-31]` | `f` |
| PowerPC/PowerPC64 | `vreg` | `v[0-31]` | `v` |
| PowerPC/PowerPC64 | `vsreg` | `vs[0-63]` | `wa` |
| PowerPC/PowerPC64 | `cr` | `cr[0-7]`, `cr` | Only clobbers |
| PowerPC/PowerPC64 | `ctr` | `ctr` | Only clobbers |
| PowerPC/PowerPC64 | `lr` | `lr` | Only clobbers |
| PowerPC/PowerPC64 | `xer` | `xer` | Only clobbers |

> [!NOTE]
> - On x86 we treat `reg_byte` differently from `reg` because the compiler can allocate `al` and `ah` separately whereas `reg` reserves the whole register.
> - On x86-64 the high byte registers (e.g. `ah`) are not available in the `reg_byte` register class.
> - Some register classes are marked as "Only clobbers" which means that registers in these classes cannot be used for inputs or outputs, only clobbers of the form `out(<explicit register>) _` or `lateout(<explicit register>) _`.
> - The `spe_acc` register is only available on PowerPC SPE targets.

<a id="asm.register-operands.value-type-constraints"></a> 每个寄存器类都有关于其可以使用的数值类型的约束。这是必要的，因为值加载到寄存器的方式取决于其类型。例如，在大端系统上，将 `i32x4` 和 `i8x16` 加载到 SIMD 寄存器中可能会产生不同的寄存器内容，即使两个值的字节级内存表示相同。特定寄存器类支持的类型的可用性可能取决于当前启用的目标特性。

| Architecture | Register class | Target feature | Allowed types |
| ------------ | -------------- | -------------- | ------------- |
| x86-32 | `reg` | None | `i16`, `i32`, `f32` |
| x86-64 | `reg` | None | `i16`, `i32`, `f32`, `i64`, `f64` |
| x86 | `reg_byte` | None | `i8` |
| x86 | `xmm_reg` | `sse` | `i32`, `f32`, `i64`, `f64`, `i128`, <br> `i8x16`, `i16x8`, `i32x4`, `i64x2`, `f32x4`, `f64x2` |
| x86 | `ymm_reg` | `avx` | `i32`, `f32`, `i64`, `f64`, `i128`, <br> `i8x16`, `i16x8`, `i32x4`, `i64x2`, `f32x4`, `f64x2` <br> `i8x32`, `i16x16`, `i32x8`, `i64x4`, `f32x8`, `f64x4` |
| x86 | `zmm_reg` | `avx512f` | `i32`, `f32`, `i64`, `f64`, `i128`, <br> `i8x16`, `i16x8`, `i32x4`, `i64x2`, `f32x4`, `f64x2` <br> `i8x32`, `i16x16`, `i32x8`, `i64x4`, `f32x8`, `f64x4` <br> `i8x64`, `i16x32`, `i32x16`, `i64x8`, `f32x16`, `f64x8` |
| x86 | `kreg` | `avx512f` | `i8`, `i16` |
| x86 | `kreg` | `avx512bw` | `i32`, `i64` |
| x86 | `mmx_reg` | N/A | Only clobbers |
| x86 | `x87_reg` | N/A | Only clobbers |
| x86 | `tmm_reg` | N/A | Only clobbers |
| AArch64 | `reg` | None | `i8`, `i16`, `i32`, `f32`, `i64`, `f64` |
| AArch64 | `vreg` | `neon` | `i8`, `i16`, `i32`, `f32`, `i64`, `f64`, <br> `i8x8`, `i16x4`, `i32x2`, `i64x1`, `f32x2`, `f64x1`, <br> `i8x16`, `i16x8`, `i32x4`, `i64x2`, `f32x4`, `f64x2` |
| AArch64 | `preg` | N/A | Only clobbers |
| Arm64EC | `reg` | None | `i8`, `i16`, `i32`, `f32`, `i64`, `f64` |
| Arm64EC | `vreg` | `neon` | `i8`, `i16`, `i32`, `f32`, `i64`, `f64`, <br> `i8x8`, `i16x4`, `i32x2`, `i64x1`, `f32x2`, `f64x1`, <br> `i8x16`, `i16x8`, `i32x4`, `i64x2`, `f32x4`, `f64x2` |
| ARM | `reg` | None | `i8`, `i16`, `i32`, `f32` |
| ARM | `sreg` | `vfp2` | `i32`, `f32` |
| ARM | `dreg` | `vfp2` | `i64`, `f64`, `i8x8`, `i16x4`, `i32x2`, `i64x1`, `f32x2` |
| ARM | `qreg` | `neon` | `i8x16`, `i16x8`, `i32x4`, `i64x2`, `f32x4` |
| RISC-V32 | `reg` | None | `i8`, `i16`, `i32`, `f32` |
| RISC-V64 | `reg` | None | `i8`, `i16`, `i32`, `f32`, `i64`, `f64` |
| RISC-V | `freg` | `f` | `f32` |
| RISC-V | `freg` | `d` | `f64` |
| RISC-V | `vreg` | N/A | Only clobbers |
| LoongArch32 | `reg` | None | `i8`, `i16`, `i32`, `f32` |
| LoongArch64 | `reg` | None | `i8`, `i16`, `i32`, `i64`, `f32`, `f64` |
| LoongArch | `freg` | `f` | `f32` |
| LoongArch | `freg` | `d` | `f64` |
| s390x | `reg`, `reg_addr` | None | `i8`, `i16`, `i32`, `i64` |
| s390x | `freg` | None | `f32`, `f64` |
| s390x | `vreg` | `vector` | `i32`, `f32`, `i64`, `f64`, `i128`, <br> `i8x16`, `i16x8`, `i32x4`, `i64x2`, `f32x4`, `f64x2` |
| s390x | `areg` | N/A | Only clobbers |
| PowerPC | `spe_acc` | None | Only clobbers |
| PowerPC/PowerPC64 | `reg` | None | `i8`, `i16`, `i32`, `i64` (PowerPC64 only) |
| PowerPC/PowerPC64 | `reg_nonzero` | None | `i8`, `i16`, `i32`, `i64` (PowerPC64 only) |
| PowerPC/PowerPC64 | `freg` | None | `f32`, `f64` |
| PowerPC/PowerPC64 | `vreg` | `altivec` | `i8x16`, `i16x8`, `i32x4`, `f32x4` |
| PowerPC/PowerPC64 | `vreg` | `vsx` | `f32`, `f64`, `i64x2`, `f64x2` |
| PowerPC/PowerPC64 | `vsreg` | `vsx` | The union of vsx and altivec vreg types |
| PowerPC/PowerPC64 | `cr` | None | Only clobbers |
| PowerPC/PowerPC64 | `ctr` | None | Only clobbers |
| PowerPC/PowerPC64 | `lr` | None | Only clobbers |
| PowerPC/PowerPC64 | `xer` | None | Only clobbers |

> [!NOTE]
> For the purposes of the above table pointers, function pointers and `isize`/`usize` are treated as the equivalent integer type (`i16`/`i32`/`i64` depending on the target).

```rust
# #[cfg(target_arch = "x86_64")] {
let x = 5i32;
let y = -1i8;
let z = unsafe { core::arch::x86_64::_mm_set_epi64x(1, 0) };

// reg is valid for `i32`, `reg_byte` is valid for `i8`, and xmm_reg is valid for `__m128i`
// We can't use `tmm0` as an input or output, but we can clobber it.
unsafe { core::arch::asm!("/* {} {} {} */", in(reg) x, in(reg_byte) y, in(xmm_reg) z, out("tmm0") _); }
# }
```

```rust,compile_fail
# #[cfg(target_arch = "x86_64")] {
let z = unsafe { core::arch::x86_64::_mm_set_epi64x(1, 0) };
// We can't pass an `__m128i` to a `reg` input
unsafe { core::arch::asm!("/* {} */", in(reg) z); }
// ERROR: type `__m128i` cannot be used with this register class
# }
# #[cfg(not(target_arch = "x86_64"))] core::compile_error!("Test not supported on this arch");
```

<a id="asm.register-operands.smaller-value"></a> 如果某个值的大小小于其分配的寄存器，则该寄存器的高位对于输入将被定义为未定义值，并且对于输出将被忽略。唯一的例外是 RISC-V 上的 `freg` 寄存器类，其中 `f32` 值根据 RISC-V 架构的要求被打包为 `f64`。

<!--no_run, this test has a non-deterministic runtime behavior-->
```rust,no_run
# #[cfg(target_arch = "x86_64")] {
let mut x: i64;
// Moving a 32-bit value into a 64-bit value, oops.
#[allow(asm_sub_register)] // rustc warns about this behavior
unsafe { core::arch::asm!("mov {}, {}", lateout(reg) x, in(reg) 4i32); }
// top 32-bits are indeterminate
assert_eq!(x, 4); // This assertion is not guaranteed to succeed
assert_eq!(x & 0xFFFFFFFF, 4); // However, this one will succeed
# }
```

<a id="asm.register-operands.separate-input-output"></a> 当为 `inout` 操作数指定独立输入和输出表达式时，这两个表达式必须具有相同的类型。唯一的例外是当两个操作数都是指针或整数时，它们只需具有相同的大小即可。这种限制的存在是因为 LLVM 和 GCC 中的注册器有时无法处理具有不同类型的关联操作数。

```rust
# #[cfg(target_arch = "x86_64")] {
// Pointers and integers can mix (as long as they are the same size)
let x: isize = 0;
let y: *mut ();
// Transmute an `isize` to a `*mut ()`, using inline assembly magic
unsafe { core::arch::asm!("/*{}*/", inout(reg) x=>y); }
assert!(y.is_null()); // Extremely roundabout way to make a null pointer
# }
```

```rust,compile_fail
# #[cfg(target_arch = "x86_64")] {
let x: i32 = 0;
let y: f32;
// But we can't reinterpret an `i32` to an `f32` like this
unsafe { core::arch::asm!("/* {} */", inout(reg) x=>y); }
// ERROR: incompatible types for asm inout argument
# }
# #[cfg(not(target_arch = "x86_64"))] core::compile_error!("Test not supported on this arch");
```

<a id="asm.register-names"></a>
## 寄存器名称

<a id="asm.register-names.supported-register-aliases"></a> 某些寄存器有多个名称。编译器将所有这些名称视为与基础寄存器名称相同。以下是所有支持的注册器别名列表：

| Architecture | Base register | Aliases |
| ------------ | ------------- | ------- |
| x86 | `ax` | `eax`, `rax` |
| x86 | `bx` | `ebx`, `rbx` |
| x86 | `cx` | `ecx`, `rcx` |
| x86 | `dx` | `edx`, `rdx` |
| x86 | `si` | `esi`, `rsi` |
| x86 | `di` | `edi`, `rdi` |
| x86 | `bp` | `bpl`, `ebp`, `rbp` |
| x86 | `sp` | `spl`, `esp`, `rsp` |
| x86 | `ip` | `eip`, `rip` |
| x86 | `st(0)` | `st` |
| x86 | `r[8-15]` | `r[8-15]b`, `r[8-15]w`, `r[8-15]d` |
| x86 | `xmm[0-31]` | `ymm[0-31]`, `zmm[0-31]` |
| AArch64 | `x[0-30]` | `w[0-30]` |
| AArch64 | `x29` | `fp` |
| AArch64 | `x30` | `lr` |
| AArch64 | `sp` | `wsp` |
| AArch64 | `xzr` | `wzr` |
| AArch64 | `v[0-31]` | `b[0-31]`, `h[0-31]`, `s[0-31]`, `d[0-31]`, `q[0-31]` |
| Arm64EC | `x[0-30]` | `w[0-30]` |
| Arm64EC | `x29` | `fp` |
| Arm64EC | `x30` | `lr` |
| Arm64EC | `sp` | `wsp` |
| Arm64EC | `xzr` | `wzr` |
| Arm64EC | `v[0-15]` | `b[0-15]`, `h[0-15]`, `s[0-15]`, `d[0-15]`, `q[0-15]` |
| ARM | `r[0-3]` | `a[1-4]` |
| ARM | `r[4-9]` | `v[1-6]` |
| ARM | `r9` | `rfp` |
| ARM | `r10` | `sl` |
| ARM | `r11` | `fp` |
| ARM | `r12` | `ip` |
| ARM | `r13` | `sp` |
| ARM | `r14` | `lr` |
| ARM | `r15` | `pc` |
| RISC-V | `x0` | `zero` |
| RISC-V | `x1` | `ra` |
| RISC-V | `x2` | `sp` |
| RISC-V | `x3` | `gp` |
| RISC-V | `x4` | `tp` |
| RISC-V | `x[5-7]` | `t[0-2]` |
| RISC-V | `x8` | `fp`, `s0` |
| RISC-V | `x9` | `s1` |
| RISC-V | `x[10-17]` | `a[0-7]` |
| RISC-V | `x[18-27]` | `s[2-11]` |
| RISC-V | `x[28-31]` | `t[3-6]` |
| RISC-V | `f[0-7]` | `ft[0-7]` |
| RISC-V | `f[8-9]` | `fs[0-1]` |
| RISC-V | `f[10-17]` | `fa[0-7]` |
| RISC-V | `f[18-27]` | `fs[2-11]` |
| RISC-V | `f[28-31]` | `ft[8-11]` |
| LoongArch | `$r0` | `$zero` |
| LoongArch | `$r1` | `$ra` |
| LoongArch | `$r2` | `$tp` |
| LoongArch | `$r3` | `$sp` |
| LoongArch | `$r[4-11]` | `$a[0-7]` |
| LoongArch | `$r[12-20]` | `$t[0-8]` |
| LoongArch | `$r21` | |
| LoongArch | `$r22` | `$fp`, `$s9` |
| LoongArch | `$r[23-31]` | `$s[0-8]` |
| LoongArch | `$f[0-7]` | `$fa[0-7]` |
| LoongArch | `$f[8-23]` | `$ft[0-15]` |
| LoongArch | `$f[24-31]` | `$fs[0-7]` |
| PowerPC/PowerPC64 | `r1` | `sp` |
| PowerPC/PowerPC64 | `r31` | `fp` |
| PowerPC/PowerPC64 | `r[0-31]` | `[0-31]` |
| PowerPC/PowerPC64 | `f[0-31]` | `fr[0-31]`|

```rust
# #[cfg(target_arch = "x86_64")] {
let z = 0i64;
// rax is an alias for eax and ax
unsafe { core::arch::asm!("", in("rax") z); }
# }
```

<a id="asm.register-names.not-for-io"></a> 某些寄存器不能用于输入或输出操作数：

| Architecture | Unsupported register | Reason |
| ------------ | -------------------- | ------ |
| All | `sp`, `r15` (s390x), `r1` (PowerPC and PowerPC64) | The stack pointer must be restored to its original value at the end of the assembly code or before jumping to a `label` block. |
| All | `bp` (x86), `x29` (AArch64 and Arm64EC), `x8` (RISC-V), `$fp` (LoongArch), `r11` (s390x), `fp` (PowerPC and PowerPC64) | The frame pointer cannot be used as an input or output. |
| ARM | `r7` or `r11` | On ARM the frame pointer can be either `r7` or `r11` depending on the target. The frame pointer cannot be used as an input or output. |
| All | `si` (x86-32), `bx` (x86-64), `r6` (ARM), `x19` (AArch64 and Arm64EC), `x9` (RISC-V), `$s8` (LoongArch), `r29` and `r30` (PowerPC), `r30` (PowerPC64) | This is used internally by LLVM as a "base pointer" for functions with complex stack frames. |
| x86 | `ip` | This is the program counter, not a real register. |
| AArch64 | `xzr` | This is a constant zero register which can't be modified. |
| AArch64 | `x18` | This is an OS-reserved register on some AArch64 targets. |
| Arm64EC | `xzr` | This is a constant zero register which can't be modified. |
| Arm64EC | `x18` | This is an OS-reserved register. |
| Arm64EC | `x13`, `x14`, `x23`, `x24`, `x28`, `v[16-31]`, `p[0-15]`, `ffr` | These are AArch64 registers that are not supported for Arm64EC. |
| ARM | `pc` | This is the program counter, not a real register. |
| ARM | `r9` | This is an OS-reserved register on some ARM targets. |
| RISC-V | `x0` | This is a constant zero register which can't be modified. |
| RISC-V | `gp`, `tp` | These registers are reserved and cannot be used as inputs or outputs. |
| LoongArch | `$r0` or `$zero` | This is a constant zero register which can't be modified. |
| LoongArch | `$r2` or `$tp` | This is reserved for TLS. |
| LoongArch | `$r21` | This is reserved by the ABI. |
| s390x | `c[0-15]` | Reserved by the kernel. |
| s390x | `a[0-1]` | Reserved for system use. |
| PowerPC/PowerPC64 | `r2`, `r13` | These are system reserved registers. |
| PowerPC/PowerPC64 | `vrsave` | The vrsave register cannot be used as an input or output. |

```rust,compile_fail
# #[cfg(target_arch = "x86_64")] {
// bp is reserved
unsafe { core::arch::asm!("", in("bp") 5i32); }
// ERROR: invalid register `bp`: the frame pointer cannot be used as an operand for inline asm
# }
# #[cfg(not(target_arch = "x86_64"))] core::compile_error!("Test not supported on this arch");
```

<a id="asm.register-names.fp-bp-reserved"></a> 帧指针和基指针寄存器被 LLVM 保留用于内部使用。虽然 `asm!` 语句无法明确指定对保留寄存器的使用，但在某些情况下 LLVM 会为 `reg` 操作数分配其中一个保留寄存器。使用保留寄存器的汇编代码应小心处理，因为 `reg` 操作数可能会使用相同的寄存器。

<a id="asm.template-modifiers"></a>
## 模板修饰符

<a id="asm.template-modifiers.intro"></a> 占位符可以通过花括号中的 `:` 之后指定的修饰符进行扩展。这些修饰符不影响注册器分配，但会改变操作数在模板字符串中插入时的格式。

<a id="asm.template-modifiers.only-one"></a> 每个模板占位符只允许使用一个修饰符。

```rust,compile_fail
# #[cfg(target_arch = "x86_64")] {
// We can't specify both `r` and `e` at the same time.
unsafe { core::arch::asm!("/* {:er}", in(reg) 5i32); }
// ERROR: asm template modifier must be a single character
# }
# #[cfg(not(target_arch = "x86_64"))] core::compile_error!("Test not supported on this arch");
```

<a id="asm.template-modifiers.supported-modifiers"></a> 支持的修饰符是 LLVM（和 GCC）的 [asm template argument modifiers][llvm-argmod] 的子集，但使用的字母代码不同。

| Architecture | Register class | Modifier | Example output | LLVM modifier |
| ------------ | -------------- | -------- | -------------- | ------------- |
| x86-32 | `reg` | None | `eax` | `k` |
| x86-64 | `reg` | None | `rax` | `q` |
| x86-32 | `reg_abcd` | `l` | `al` | `b` |
| x86-64 | `reg` | `l` | `al` | `b` |
| x86 | `reg_abcd` | `h` | `ah` | `h` |
| x86 | `reg` | `x` | `ax` | `w` |
| x86 | `reg` | `e` | `eax` | `k` |
| x86-64 | `reg` | `r` | `rax` | `q` |
| x86 | `reg_byte` | None | `al` / `ah` | None |
| x86 | `xmm_reg` | None | `xmm0` | `x` |
| x86 | `ymm_reg` | None | `ymm0` | `t` |
| x86 | `zmm_reg` | None | `zmm0` | `g` |
| x86 | `*mm_reg` | `x` | `xmm0` | `x` |
| x86 | `*mm_reg` | `y` | `ymm0` | `t` |
| x86 | `*mm_reg` | `z` | `zmm0` | `g` |
| x86 | `kreg` | None | `k1` | None |
| AArch64/Arm64EC | `reg` | None | `x0` | `x` |
| AArch64/Arm64EC | `reg` | `w` | `w0` | `w` |
| AArch64/Arm64EC | `reg` | `x` | `x0` | `x` |
| AArch64/Arm64EC | `vreg` | None | `v0` | None |
| AArch64/Arm64EC | `vreg` | `v` | `v0` | None |
| AArch64/Arm64EC | `vreg` | `b` | `b0` | `b` |
| AArch64/Arm64EC | `vreg` | `h` | `h0` | `h` |
| AArch64/Arm64EC | `vreg` | `s` | `s0` | `s` |
| AArch64/Arm64EC | `vreg` | `d` | `d0` | `d` |
| AArch64/Arm64EC | `vreg` | `q` | `q0` | `q` |
| ARM | `reg` | None | `r0` | None |
| ARM | `sreg` | None | `s0` | None |
| ARM | `dreg` | None | `d0` | `P` |
| ARM | `qreg` | None | `q0` | `q` |
| ARM | `qreg` | `e` / `f` | `d0` / `d1` | `e` / `f` |
| RISC-V | `reg` | None | `x1` | None |
| RISC-V | `freg` | None | `f0` | None |
| LoongArch | `reg` | None | `$r1` | None |
| LoongArch | `freg` | None | `$f0` | None |
| s390x | `reg` | None | `%r0` | None |
| s390x | `reg_addr` | None | `%r1` | None |
| s390x | `freg` | None | `%f0` | None |
| s390x | `vreg` | None | `%v0` | None |
| PowerPC/PowerPC64 | `reg` | None | `0` | None |
| PowerPC/PowerPC64 | `reg_nonzero` | None | `3` | None |
| PowerPC/PowerPC64 | `freg` | None | `0` | None |
| PowerPC/PowerPC64 | `vreg` | None | `0` | None |
| PowerPC/PowerPC64 | `vsreg` | None | `0` | None |

> [!NOTE]
> - on ARM `e` / `f`: this prints the low or high doubleword register name of a NEON quad (128-bit) register.
> - on x86: our behavior for `reg` with no modifiers differs from what GCC does. GCC will infer the modifier based on the operand value type, while we default to the full register size.
> - on x86 `xmm_reg`: the `x`, `t` and `g` LLVM modifiers are not yet implemented in LLVM (they are supported by GCC only), but this should be a simple change.

```rust
# #[cfg(target_arch = "x86_64")] {
let mut x = 0x10u16;

// u16::swap_bytes using `xchg`
// low half of `{x}` is referred to by `{x:l}`, and the high half by `{x:h}`
unsafe { core::arch::asm!("xchg {x:l}, {x:h}", x = inout(reg_abcd) x); }
assert_eq!(x, 0x1000u16);
# }
```

<a id="asm.template-modifiers.smaller-value"></a> 如前一节所述，传递一个小于寄存器宽度的输入值会导致寄存器的高位位包含未定义的值。如果内联汇编仅访问寄存器的低位，则不会出现问题，可以通过在汇编代码中使用模板修饰符来使用子寄存器名称来实现（例如用 `ax` 代替 `rax`）。由于这是一个常见的陷阱，编译器会在适当的情况下根据输入类型建议使用模板修饰符。如果所有操作数的引用都已经具有修饰符，则对该操作数的警告将被忽略。


<a id="asm.abi-clobbers"></a>
## ABI 影响

<a id="asm.abi-clobbers.intro"></a> `clobber_abi` 关键字可用于为汇编代码应用一组默认的影响项。这将自动根据特定调用约定调用函数时插入必要的影响项约束：如果调用约定无法完全保留寄存器的数值，则会在操作数列表中隐式添加 `lateout("...") _`（其中 `...` 被寄存器名称替代）。

```rust
# #[cfg(target_arch = "x86_64")] {
extern "C" fn foo() -> i32 { 0 }

let z: i32;
// To call a function, we have to inform the compiler that we're clobbering
// callee saved registers
unsafe { core::arch::asm!("call {}", sym foo, out("rax") z, clobber_abi("C")); }
assert_eq!(z, 0);
# }
```

<a id="asm.abi-clobbers.many"></a> `clobber_abi` 可以指定任意多次。它将为所有在指定调用约定组合中唯一的寄存器插入影响项。

```rust
# #[cfg(target_arch = "x86_64")] {
extern "sysv64" fn foo() -> i32 { 0 }
extern "win64" fn bar(x: i32) -> i32 { x + 1 }

let z: i32;
// We can even call multiple functions with different conventions and
// different saved registers
unsafe {
    core::arch::asm!(
        "call {}",
        "mov ecx, eax",
        "call {}",
        sym foo,
        sym bar,
        out("rax") z,
        clobber_abi("sysv64"),
        clobber_abi("win64"),
    );
}
assert_eq!(z, 1);
# }
```

<a id="asm.abi-clobbers.must-specify"></a> 当使用 `clobber_abi` 时，通用寄存器类输出会被编译器禁止：所有输出必须指定明确的寄存器名称。

```rust,compile_fail
# #[cfg(target_arch = "x86_64")] {
extern "C" fn foo(x: i32) -> i32 { 0 }

let z: i32;
// explicit registers must be used to not accidentally overlap.
unsafe {
    core::arch::asm!(
        "mov eax, {:e}",
        "call {}",
        out(reg) z,
        sym foo,
        clobber_abi("C")
    );
    // ERROR: asm with `clobber_abi` must specify explicit registers for outputs
}
assert_eq!(z, 0);
# }
# #[cfg(not(target_arch = "x86_64"))] core::compile_error!("Test not supported on this arch");
```

<a id="asm.abi-clobbers.explicit-have-precedence"></a> 显式寄存器输出具有高于 `clobber_abi` 插入的隐式影响项的优先级：只有当某个寄存器未被用作输出时，才会为其插入影响项。

<a id="asm.abi-clobbers.supported-abis"></a> 以下 ABI 可以与 `clobber_abi` 一起使用：

| Architecture | ABI name | Clobbered registers |
| ------------ | -------- | ------------------- |
| x86-32 | `"C"`, `"system"`, `"efiapi"`, `"cdecl"`, `"stdcall"`, `"fastcall"` | `ax`, `cx`, `dx`, `xmm[0-7]`, `mm[0-7]`, `k[0-7]`, `st([0-7])` |
| x86-64 | `"C"`, `"system"` (on Windows), `"efiapi"`, `"win64"` | `ax`, `cx`, `dx`, `r[8-11]`, `xmm[0-31]`, `mm[0-7]`, `k[0-7]`, `st([0-7])`, `tmm[0-7]` |
| x86-64 | `"C"`, `"system"` (on non-Windows), `"sysv64"` | `ax`, `cx`, `dx`, `si`, `di`, `r[8-11]`, `xmm[0-31]`, `mm[0-7]`, `k[0-7]`, `st([0-7])`, `tmm[0-7]` |
| AArch64 | `"C"`, `"system"`, `"efiapi"` | `x[0-17]`, `x18`\*, `x30`, `v[0-31]`, `p[0-15]`, `ffr` |
| Arm64EC | `"C"`, `"system"` | `x[0-12]`, `x[15-17]`, `x30`, `v[0-15]` |
| ARM | `"C"`, `"system"`, `"efiapi"`, `"aapcs"` | `r[0-3]`, `r12`, `r14`, `s[0-15]`, `d[0-7]`, `d[16-31]` |
| RISC-V | `"C"`, `"system"`, `"efiapi"` | `x1`, `x[5-7]`, `x[10-17]`\*, `x[28-31]`\*, `f[0-7]`, `f[10-17]`, `f[28-31]`, `v[0-31]` |
| LoongArch | `"C"`, `"system"` | `$r1`, `$r[4-20]`, `$f[0-23]` |
| s390x | `"C"`, `"system"` | `r[0-5]`, `r14`, `f[0-7]`, `v[0-31]`, `a[2-15]` |

> [!NOTE]
> - On AArch64 `x18` only included in the clobber list if it is not considered as a reserved register on the target.
> - On RISC-V `x[16-17]` and `x[28-31]` only included in the clobber list if they are not considered as reserved registers on the target.

每个 ABI 下的受影响的寄存器列表会在 Rustc 中随着架构新增寄存器而更新：这确保了当 LLVM 在其生成的代码中开始使用这些新寄存器时，`asm!` 的影响项仍然正确。

<a id="asm.options"></a>
## 选项

<a id="asm.options.supported-options"></a> 标志用于进一步影响内联汇编代码的行为。目前定义了以下选项：

<a id="asm.options.supported-options-pure"></a> - `pure`：汇编代码没有副作用，必须最终返回结果，其输出仅依赖于直接输入值（即数值本身，而非它们所指向的对象）或从内存读取的值（除非同时设置了 `nomem` 选项）。这允许编译器在程序指定的次数之外执行该汇编代码（例如将其移出循环），或者如果输出未被使用，则完全消除该汇编代码。`pure` 选项必须与 `nomem` 或 `readonly` 选项结合使用，否则将引发编译时错误。

```rust
# #[cfg(target_arch = "x86_64")] {
let x: i32 = 0;
let z: i32;
// pure can be used to optimize by assuming the assembly has no side effects
unsafe { core::arch::asm!("inc {}", inout(reg) x => z, options(pure, nomem)); }
assert_eq!(z, 1);
# }
```

```rust,compile_fail
# #[cfg(target_arch = "x86_64")] {
let x: i32 = 0;
let z: i32;
// Either nomem or readonly must be satisfied, to indicate whether or not
// memory is allowed to be read
unsafe { core::arch::asm!("inc {}", inout(reg) x => z, options(pure)); }
// ERROR: the `pure` option must be combined with either `nomem` or `readonly`
assert_eq!(z, 0);
# }
# #[cfg(not(target_arch = "x86_64"))] core::compile_error!("Test not supported on this arch");
```

<a id="asm.options.supported-options-nomem"></a> - `nomem`：汇编代码不读取也不写入任何超出汇编代码范围的内存。这允许编译器在汇编代码执行过程中将修改过的全局变量的值缓存在寄存器中，因为编译器知道这些值不会被读取或写入。编译器还假设该汇编代码不会与其他线程进行任何形式的同步操作，例如通过内存屏障。

<!-- no_run: This test has unpredictable or undefined behavior at runtime -->
```rust,no_run
# #[cfg(target_arch = "x86_64")] {
let mut x = 0i32;
let z: i32;
// Accessing outside memory from assembly when `nomem` is
// specified is disallowed
unsafe {
    core::arch::asm!("mov {val:e}, dword ptr [{ptr}]",
        ptr = in(reg) &mut x,
        val = lateout(reg) z,
        options(nomem)
    )
}

// Writing to outside memory from assembly when `nomem` is
// specified is also undefined behaviour
unsafe {
    core::arch::asm!("mov  dword ptr [{ptr}], {val:e}",
        ptr = in(reg) &mut x,
        val = in(reg) z,
        options(nomem)
    )
}
# }
```

```rust
# #[cfg(target_arch = "x86_64")] {
let x: i32 = 0;
let z: i32;
// If we allocate our own memory, such as via `push`, however.
// we can still use it
unsafe {
    core::arch::asm!("push {x}", "add qword ptr [rsp], 1", "pop {x}",
        x = inout(reg) x => z,
        options(nomem)
    );
}
assert_eq!(z, 1);
# }
```

<a id="asm.options.supported-options-readonly"></a> - `readonly`：汇编代码不写入任何超出汇编代码范围的内存。这允许编译器在汇编代码执行过程中将未修改的全局变量的值缓存在寄存器中，因为编译器知道这些值不会被写入。编译器还假设该汇编代码不会与其他线程进行任何形式的同步操作，例如通过内存屏障。

<!-- no_run: This test has undefined behaviour at runtime -->
```rust,no_run
# #[cfg(target_arch = "x86_64")] {
let mut x = 0;
// We cannot modify outside memory when `readonly` is specified
unsafe {
    core::arch::asm!("mov dword ptr[{}], 1", in(reg) &mut x, options(readonly))
}
# }
```

```rust
# #[cfg(target_arch = "x86_64")] {
let x: i64 = 0;
let z: i64;
// We can still read from it, though
unsafe {
    core::arch::asm!("mov {x}, qword ptr [{x}]",
        x = inout(reg) &x => z,
        options(readonly)
    );
}
assert_eq!(z, 0);
# }
```

```rust
# #[cfg(target_arch = "x86_64")] {
let x: i64 = 0;
let z: i64;
// Same exception applies as with nomem.
unsafe {
    core::arch::asm!("push {x}", "add qword ptr [rsp], 1", "pop {x}",
        x = inout(reg) x => z,
        options(readonly)
    );
}
assert_eq!(z, 1);
# }
```

<a id="asm.options.supported-options-preserves_flags"></a> - `preserves_flags`：汇编代码不修改标志寄存器（在下面的规则中定义）。这允许编译器在汇编代码执行后避免重新计算条件标志。

<a id="asm.options.supported-options-noreturn"></a> - `noreturn`: 汇编代码不会中断执行；如果中断则行为未定义。它仍可能跳转到 `label` 块。如果任何 `label` 块返回单位值，则 `asm!` 块也会返回单位值。否则它将始终返回 `!`。与不返回值的函数调用类似，作用域内的局部变量在汇编代码执行前不会被丢弃。

<!-- no_run: This test aborts at runtime -->
```rust,no_run
fn main() -> ! {
# #[cfg(target_arch = "x86_64")] {
    // We can use an instruction to trap execution inside of a noreturn block
    unsafe { core::arch::asm!("ud2", options(noreturn)); }
# }
# #[cfg(not(target_arch = "x86_64"))] panic!("no return");
}
```

<!-- no_run: Test has undefined behavior at runtime -->
```rust,no_run
# #[cfg(target_arch = "x86_64")] {
// You are responsible for not falling past the end of a noreturn asm block
unsafe { core::arch::asm!("", options(noreturn)); }
# }
```

```rust
# #[cfg(target_arch = "x86_64")]
let _: () = unsafe {
    // You may still jump to a `label` block
    core::arch::asm!("jmp {}", label {
        println!();
    }, options(noreturn));
};
```

<a id="asm.options.supported-options-nostack"></a> - `nostack`: 汇编代码不会将数据压入栈或写入栈红区（如果目标支持）。如果不使用此选项，编译器保证在汇编代码开始时栈指针符合目标 ABI 的要求，以便进行函数调用。

<!-- no_run: Test has undefined behavior at runtime -->
```rust,no_run
# #[cfg(target_arch = "x86_64")] {
// `push` and `pop` are UB when used with nostack
unsafe { core::arch::asm!("push rax", "pop rax", options(nostack)); }
# }
```

<a id="asm.options.supported-options-att_syntax"></a> - `att_syntax`: 此选项仅适用于 x86 平台，使汇编器采用 GNU 汇编器的 `.att_syntax` 前缀模式。寄存器操作数前会加上 `%` 符号。

```rust
# #[cfg(target_arch = "x86_64")] {
let x: i32;
let y = 1i32;
// We need to use AT&T Syntax here. src, dest order for operands
unsafe {
    core::arch::asm!("mov {y:e}, {x:e}",
        x = lateout(reg) x,
        y = in(reg) y,
        options(att_syntax)
    );
}
assert_eq!(x, y);
# }
```

<a id="asm.options.supported-options-raw"></a> - `raw`: 此选项将模板字符串解析为原始汇编字符串，对 `{` 和 `}` 不进行特殊处理。当使用 `include_str!` 从外部文件包含原始汇编代码时，此选项非常有用。

<a id="asm.options.checks"></a> 编译器会对选项执行一些额外的检查：

<a id="asm.options.checks-mutually-exclusive"></a> - `nomem` 和 `readonly` 选项互斥：同时指定这两个选项会导致编译时错误。

```rust,compile_fail
# #[cfg(target_arch = "x86_64")] {
// nomem is strictly stronger than readonly, they can't be specified together
unsafe { core::arch::asm!("", options(nomem, readonly)); }
// ERROR: the `nomem` and `readonly` options are mutually exclusive
# }
# #[cfg(not(target_arch = "x86_64"))] core::compile_error!("Test not supported on this arch");
```

<a id="asm.options.checks-pure"></a> - 在没有任何输出或仅包含被丢弃输出的汇编块中指定 `pure` 会导致编译时错误。

```rust,compile_fail
# #[cfg(target_arch = "x86_64")] {
// pure blocks need at least one output
unsafe { core::arch::asm!("", options(pure)); }
// ERROR: asm with the `pure` option must have at least one output
# }
# #[cfg(not(target_arch = "x86_64"))] core::compile_error!("Test not supported on this arch");
```

<a id="asm.options.checks-noreturn"></a> - 在具有输出但没有标签的汇编块中指定 `noreturn` 会导致编译时错误。

```rust,compile_fail
# #[cfg(target_arch = "x86_64")] {
let z: i32;
// noreturn can't have outputs
unsafe { core::arch::asm!("mov {:e}, 1", out(reg) z, options(noreturn)); }
// ERROR: asm outputs are not allowed with the `noreturn` option
# }
# #[cfg(not(target_arch = "x86_64"))] core::compile_error!("Test not supported on this arch");
```

<a id="asm.options.checks-label-with-outputs"></a> - 在具有输出的汇编块中包含任何 `label` 块会导致编译时错误。

<a id="asm.options.naked_asm-restriction"></a> `naked_asm!` 仅支持 `att_syntax` 和 `raw` 选项。其余选项没有意义，因为内联汇编定义了整个函数体。

<a id="asm.options.global_asm-restriction"></a> `global_asm!` 仅支持 `att_syntax` 和 `raw` 选项。其余选项对全局范围的内联汇编没有意义。

```rust,compile_fail
# fn main() {}
# #[cfg(target_arch = "x86_64")]
core::arch::global_asm!("", options(nomem));
// ERROR: The `nomem` option cannot be used with `global_asm!`.
# #[cfg(not(target_arch = "x86_64"))] core::compile_error!("Test not supported on this arch");
```

<a id="asm.rules"></a>
## 内联汇编规则

<a id="asm.rules.intro"></a> 为了避免未定义行为，在使用函数范围内的内联汇编 (`asm!`) 时必须遵循这些规则：

<a id="asm.rules.reg-not-input"></a> - 任何未被指定为输入寄存器的寄存器在进入汇编代码时都将包含一个未定义的值。 - 在内联汇编的语境中，“未定义值”意味着该寄存器可以（非确定性地）具有架构允许的所有可能值之一。需要注意的是，这与 LLVM `undef` 不同，`undef` 每次读取时都可能有不同的值（因为汇编代码中不存在这一概念）。

<a id="asm.rules.reg-not-output"></a> - 任何未被指定为输出寄存器的寄存器在离开汇编代码时必须保持与进入时的相同值，否则行为将未定义。 - 此规则仅适用于可以指定为输入或输出的寄存器。其他寄存器则遵循特定目标的规定。 - 注意，`lateout` 分配给同一个寄存器时，该寄存器会被视为 `in`，此时此规则不适用。不过代码不应依赖这一点，因为它取决于注册表分配的结果。

<a id="asm.rules.unwind"></a> - 如果执行从汇编代码外部展开，则行为未定义。 - 如果汇编代码调用一个函数，然后该函数又展开，同样适用此规则。

<a id="asm.rules.mem-same-as-ffi"></a> - 汇编代码允许读取和写入的内存位置与 FFI 函数允许的相同。 - 如果设置了 `readonly` 选项，则仅允许内存读取。 - 如果设置了 `nomem` 选项，则不允许对内存进行任何读取或写入操作。 - 这些规则不适用于属于汇编代码的私有内存，例如其内部分配的栈空间。

<a id="asm.rules.black-box"></a> - 编译器不能假设汇编代码中的指令就是最终实际执行的指令。这意味着编译器必须将汇编代码视为一个黑盒，仅考虑接口规范，而不考虑指令本身。允许通过特定目标机制进行运行时代码修补。然而，无法保证源代码中每个汇编代码块都直接对应对象文件中的一个指令实例；编译器可以自由复制或去重 `asm!` 中的汇编代码。

<a id="asm.rules.stack-below-sp"></a> - 除非设置 `nostack` 选项，否则汇编代码可以使用栈指针下方的栈空间。在进入汇编代码时，栈指针必须根据目标 ABI 正确对齐，以便进行函数调用。您有责任确保不会导致栈溢出（例如，使用栈探测来确保到达保护页）。根据目标 ABI 的要求，应在分配栈内存时调整栈指针。离开汇编代码前，必须将栈指针恢复为其原始值。

<a id="asm.rules.stack-above-sp"></a> - 除非设置 `nostack` 选项，否则如果目标 ABI 要求将某些值存储在调用者的帧中，汇编代码可以修改调用者的栈帧（例如，在 PowerPC64 上保存 `lr` 时）。

<a id="asm.rules.noreturn"></a> - 如果设置 `noreturn` 选项，则如果执行代码通过汇编代码的末尾继续，行为将未定义。

<a id="asm.rules.pure"></a> - 如果设置 `pure` 选项，则如果 `asm!` 产生除直接输出之外的副作用，行为将未定义。如果两次使用相同输入的 `asm!` 代码产生不同的输出，行为也将未定义。当与 `nomem` 选项一起使用时，“输入”仅指 `asm!` 的直接输入。当与 `readonly` 选项一起使用时，“输入”包括汇编代码的直接输入以及它允许读取的任何内存。

<a id="asm.rules.preserved-registers"></a> - 如果设置了 `preserves_flags` 选项，在退出汇编代码时必须恢复这些寄存器： - x86 - `EFLAGS` 中的状态标志（CF, PF, AF, ZF, SF, OF）。 - 浮点状态字（全部）。 - `MXCSR` 中的浮点异常标志（PE, UE, OE, ZE, DE, IE）。 - ARM - `CPSR` 中的条件标志（N, Z, C, V）。 - `CPSR` 中的饱和标志（Q）。 - `CPSR` 中的大于等于标志（GE）。 - `FPSCR` 中的条件标志（N, Z, C, V）。 - `FPSCR` 中的饱和标志（QC）。 - `FPSCR` 中的浮点异常标志（IDC, IXC, UFC, OFC, DZC, IOC）。 - AArch64 和 Arm64EC - 条件标志（`NZCV` 寄存器）。 - 浮点状态（`FPSR` 寄存器）。 - RISC-V - `fcsr` 中的浮点异常标志（`fflags`）。 - 向量扩展状态（`vtype`, `vl`, `vxsat` 和 `vxrm`）。 - LoongArch - `$fcc[0-7]` 中的浮点条件标志。 - PowerPC/PowerPC64 - `fpscr` 中的浮点状态和粘性位（DRN, VE, OE, UE, ZE, XE, NI 或 RN 之外的任何字段）。 - `vscr` 中的向量状态和粘性位（NJ 之外的任何字段）。 - PowerPC SPE - `spefscr` 的粘性和状态位（FINXE, FINVE, FDBZE, FUNFE, FOVFE 或 FRMC 之外的任何字段）。 - s390x - 条件代码寄存器 `cc`。

<a id="asm.rules.x86-df"></a> - 在 x86 上，方向标志（`EFLAGS` 中的 DF）在进入汇编代码时应为清零状态，在退出时也必须保持清零。 - 如果退出汇编代码时方向标志被设置，则行为未定义。

<a id="asm.rules.x86-x87"></a> - 在 x86 上，x87 浮点寄存器栈必须保持不变，除非所有 `st([0-7])` 寄存器都通过 `out("st(0)") _, out("st(1)") _, ...` 被污染。 - 如果所有 x87 寄存器都被污染，则进入汇编代码时 x87 寄存器栈保证为空。汇编代码必须确保退出汇编代码时 x87 寄存器栈也为空。

```rust
# #[cfg(target_arch = "x86_64")]
pub fn fadd(x: f64, y: f64) -> f64 {
  let mut out = 0f64;
  let mut top = 0u16;
  // we can do complex stuff with x87 if we clobber the entire x87 stack
  unsafe { core::arch::asm!(
    "fld qword ptr [{x}]",
    "fld qword ptr [{y}])",
    "faddp",
    "fstp qword ptr [{out}]",
    "xor eax, eax",
    "fstsw ax",
    "shl eax, 11",
    x = in(reg) &x,
    y = in(reg) &y,
    out = in(reg) &mut out,
    out("st(0)") _, out("st(1)") _, out("st(2)") _, out("st(3)") _,
    out("st(4)") _, out("st(5)") _, out("st(6)") _, out("st(7)") _,
    out("eax") top
  );}

  assert_eq!(top & 0x7, 0);
  out
}

pub fn main() {
# #[cfg(target_arch = "x86_64")]{
  assert_eq!(fadd(1.0, 1.0), 2.0);
# }
}
```

<a id="asm.rules.arm64ec"></a> - 在 arm64ec 上，调用函数时必须使用具有适当 thunk 的 [调用检查器](https://learn.microsoft.com/en-us/windows/arm/arm64ec-abi#authoring-arm64ec-in-assembly)。

<a id="asm.rules.only-on-exit"></a> - 仅当退出汇编代码时，才需要将栈指针和非输出寄存器恢复为其原始值。这意味着那些没有跳转到任何 `label` 块、且未被标记为 `noreturn` 的汇编代码无需保留这些寄存器。当返回到与进入时不同的 `asm!` 块的汇编代码时（例如进行上下文切换），这些寄存器必须包含其进入 `asm!` 块时的数值，即你正在 *退出* 的 `asm!` 块中的值。你不能退出尚未进入的 `asm!` 块的汇编代码，也不能退出已经被退出过的 `asm!` 块的汇编代码（无需再次进入）。你需要负责处理任何特定目标的状态（例如线程本地存储、栈边界）。即使在同一函数或块内，也无法从一个 `asm!` 块中的地址跳转到另一个地址，除非将它们的上下文视为可能不同并需要进行上下文切换。你不能假设这些上下文中的任何特定值（例如当前栈指针或栈指针下方的临时值）会在两个 `asm!` 块之间保持不变。你可以访问的内存位置集合是所进入和退出过的 `asm!` 块允许的地址的交集。

<a id="asm.rules.not-successive"></a> - 你不能假设源代码中相邻的两个 `asm!` 块，即使之间没有其他代码，在二进制文件中也会出现在连续的地址上，且中间没有其他指令。

<a id="asm.rules.not-exactly-once"></a> - 你不能假设一个 `asm!` 块在输出二进制文件中会恰好出现一次。编译器允许创建多个 `asm!` 块的副本，例如当包含该 `asm!` 块的函数被内联到多个位置时。

<a id="asm.rules.x86-prefix-restriction"></a> - 在 x86 架构上，内联汇编不得以编译器生成的指令前缀（如 `LOCK`）结尾。- 由于内联汇编的编译方式原因，当前编译器无法检测此情况，但未来可能会发现并拒绝此类情况。

<a id="asm.rules.preserves_flags"></a> 
> [!NOTE]
> As a general rule, the flags covered by `preserves_flags` are those which are *not* preserved when performing a function call.

<a id="asm.naked-rules"></a>
## 关于裸内联汇编的规则

<a id="asm.naked-rules.intro"></a> 为了避免未定义行为，在裸函数中使用函数作用域内的内联汇编时必须遵循这些规则（`naked_asm!`）：

<a id="asm.naked-rules.reg-not-input"></a> - 根据调用约定和函数签名，未被用于函数输入的寄存器在进入 `naked_asm!` 块时将包含未定义值。- 在内联汇编语境中，“未定义值”意味着该寄存器可以（非确定性地）具有架构允许的任何可能值之一。需要注意的是，这与 LLVM `undef` 不同，`undef` 每次读取时都可能具有不同的值（因为汇编代码中不存在这一概念）。

<a id="asm.naked-rules.callee-saved-registers"></a> - 所有被调用者保存的寄存器在返回时必须保持与进入时的相同值。

<a id="asm.naked-rules.caller-saved-registers"></a> - 调用者保存的寄存器可以自由使用。

<a id="asm.naked-rules.noreturn"></a> - 如果执行代码超出汇编代码的末尾，行为将未定义。- 所有通过汇编代码的路径都应以返回指令结束或发散。

<a id="asm.naked-rules.mem-same-as-ffi"></a> - 汇编代码允许读取和写入的内存位置集与 FFI 函数允许的相同。

<a id="asm.naked-rules.black-box"></a> - 编译器不能假设 `naked_asm!` 块中的指令实际上会被执行。- 这意味着编译器必须将 `naked_asm!` 视为一个黑盒，仅考虑接口规范，而不考虑指令本身。- 通过特定目标机制允许运行时代码修补。

<a id="asm.naked-rules.unwind"></a> - 允许从 `naked_asm!` 块中展开。- 为了获得正确的行为，必须使用适当的汇编器指令来生成展开元数据。

```rust
# #[cfg(target_arch = "x86_64")] {
#[unsafe(naked)]
extern "sysv64-unwind" fn unwinding_naked() {
    core::arch::naked_asm!(
        // "CFI" here stands for "call frame information".
        ".cfi_startproc",
        // The CFA (canonical frame address) is the value of `rsp`
        // before the `call`, i.e. before the return address, `rip`,
        // was pushed to `rsp`, so it's eight bytes higher in memory
        // than `rsp` upon function entry (after `rip` has been
        // pushed).
        //
        // This is the default, so we don't have to write it.
        //".cfi_def_cfa rsp, 8",
        //
        // The traditional thing to do is to preserve the base
        // pointer, so we'll do that.
        "push rbp",
        // Since we've now extended the stack downward by 8 bytes in
        // memory, we need to adjust the offset to the CFA from `rsp`
        // by another 8 bytes.
        ".cfi_adjust_cfa_offset 8",
        // We also then annotate where we've stored the caller's value
        // of `rbp`, relative to the CFA, so that when unwinding into
        // the caller we can find it, in case we need it to calculate
        // the caller's CFA relative to it.
        //
        // Here, we've stored the caller's `rbp` starting 16 bytes
        // below the CFA.  I.e., starting from the CFA, there's first
        // the `rip` (which starts 8 bytes below the CFA and continues
        // up to it), then there's the caller's `rbp` that we just
        // pushed.
        ".cfi_offset rbp, -16",
        // As is traditional, we set the base pointer to the value of
        // the stack pointer.  This way, the base pointer stays the
        // same throughout the function body.
        "mov rbp, rsp",
        // We can now track the offset to the CFA from the base
        // pointer.  This means we don't need to make any further
        // adjustments until the end, as we don't change `rbp`.
        ".cfi_def_cfa_register rbp",
        // We can now call a function that may panic.
        "call {f}",
        // Upon return, we restore `rbp` in preparation for returning
        // ourselves.
        "pop rbp",
        // Now that we've restored `rbp`, we must specify the offset
        // to the CFA again in terms of `rsp`.
        ".cfi_def_cfa rsp, 8",
        // Now we can return.
        "ret",
        ".cfi_endproc",
        f = sym may_panic,
    )
}

extern "sysv64-unwind" fn may_panic() {
    panic!("unwind");
}
# }
```

> [!NOTE]
>
> For more information on the `cfi` assembler directives above, see these resources:
>
> - [Using `as` - CFI directives](https://sourceware.org/binutils/docs/as/CFI-directives.html)
> - [DWARF Debugging Information Format Version 5](https://dwarfstd.org/doc/DWARF5.pdf)
> - [ImperialViolet - CFI directives in assembly files](https://www.imperialviolet.org/2017/01/18/cfi.html)

<a id="asm.validity"></a>
### 正确性与有效性

<a id="asm.validity.necessary-but-not-sufficient"></a> 除了上述所有规则外，`asm!` 的字符串参数最终必须成为——在评估所有其他参数、执行格式化操作并转换操作数之后——对于目标架构来说既符合语法又具有语义有效性的汇编代码。格式化规则使编译器能够生成具有正确语法的汇编代码。关于操作数的规则允许将 Rust 操作数有效地转换为汇编代码或从汇编代码中翻译出来。遵守这些规则是必要的，但不足以确保最终扩展的汇编代码既正确又有效。例如：

- 在格式化后，参数可能位于语法错误的位置 - 一条指令可能被正确编写，但给定了架构上无效的操作数 - 一个未指定架构的指令可能被组装成未指定的代码 - 一组每个都正确且有效的指令如果连续出现，可能导致未定义行为

<a id="asm.validity.non-exhaustive"></a> 因此，这些规则是_非完整的_。编译器无需检查初始字符串或最终生成的汇编代码的正确性和有效性。汇编器可以检查正确性和有效性，但不需要这样做。使用 `asm!` 时，一个排版错误可能就足以使程序不稳定，而汇编规则可能包含数千页的架构参考手册。程序员应谨慎行事，因为调用这种 `unsafe` 能力意味着承担不违反编译器或架构规则的责任。

<a id="asm.directives"></a>
### 指令支持

<a id="asm.directives.subset-supported"></a> 内联汇编支持 GNU AS 和 LLVM 内部汇编器所支持的部分指令集，具体如下。使用其他指令的结果因汇编器而异（可能会引发错误，或按原样接受）。

<a id="asm.directives.stateful"></a> 如果内联汇编包含任何修改后续汇编处理方式的“有状态”指令，则汇编代码必须在内联汇编结束前撤销这些指令的效果。

<a id="asm.directives.supported-directives"></a> 以下指令肯定会被汇编器支持：

- `.2byte` - `.4byte` - `.8byte` - `.align` - `.alt_entry` - `.ascii` - `.asciz` - `.balign` - `.balignl` - `.balignw` - `.bss` - `.byte` - `.comm` - `.data` - `.def` - `.double` - `.endef` - `.equ` - `.equiv` - `.eqv` - `.fill` - `.float` - `.global` - `.globl` - `.inst` - `.insn` - `.lcomm` - `.long` - `.octa` - `.option` - `.p2align` - `.popsection` - `.private_extern` - `.pushsection` - `.quad` - `.scl` - `.section` - `.set` - `.short` - `.size` - `.skip` - `.sleb128` - `.space` - `.string` - `.text` - `.type` - `.uleb128` - `.word`

```rust
# #[cfg(target_arch = "x86_64")] {
let bytes: *const u8;
let len: usize;
unsafe {
    core::arch::asm!(
        "jmp 3f", "2: .ascii \"Hello World!\"",
        "3: lea {bytes}, [2b+rip]",
        "mov {len}, 12",
        bytes = out(reg) bytes,
        len = out(reg) len
    );
}

let s = unsafe { core::str::from_utf8_unchecked(core::slice::from_raw_parts(bytes, len)) };

assert_eq!(s, "Hello World!");
# }
```

<a id="asm.target-specific-directives"></a>
#### 目标特定指令支持

<a id="asm.target-specific-directives.dwarf-unwinding"></a>
##### Dwarf 展开支持

在支持 DWARF 展开信息的 ELF 目标上，以下指令被支持：

- `.cfi_adjust_cfa_offset` - `.cfi_def_cfa` - `.cfi_def_cfa_offset` - `.cfi_def_cfa_register` - `.cfi_endproc` - `.cfi_escape` - `.cfi_lsda` - `.cfi_offset` - `.cfi_personality` - `.cfi_register` - `.cfi_rel_offset` - `.cfi_remember_state` - `.cfi_restore` - `.cfi_restore_state` - `.cfi_return_column` - `.cfi_same_value` - `.cfi_sections` - `.cfi_signal_frame` - `.cfi_startproc` - `.cfi_undefined` - `.cfi_window_save`

<a id="asm.target-specific-directives.structured-exception-handling"></a>
##### 结构化异常处理

在具有结构化异常处理的目标上，以下额外指令肯定会被支持：

- `.seh_endproc` - `.seh_endprologue` - `.seh_proc` - `.seh_pushreg` - `.seh_savereg` - `.seh_setframe` - `.seh_stackalloc`

<a id="asm.target-specific-directives.x86"></a>
##### x86（32位和64位）

在x86目标上，无论是32位还是64位，以下额外指令都将被支持：- `.nops` - `.code16` - `.code32` - `.code64`

`.code16`、`.code32`和`.code64`指令仅在退出汇编代码前将状态重置为默认值时才被支持。32位x86默认使用`.code32`，而x86_64默认使用`.code64`。

<a id="asm.target-specific-directives.arm-32-bit"></a>
##### ARM（32位）

在ARM上，以下额外指令都将被支持：

- `.even` - `.fnstart` - `.fnend` - `.save` - `.movsp` - `.code` - `.thumb` - `.thumb_func`

[`asm!`]: core::arch::asm
[`naked_asm!`]: core::arch::naked_asm
[`global_asm!`]: core::arch::global_asm

[format-syntax]: std::fmt#syntax
[rfc-2795]: https://github.com/rust-lang/rfcs/pull/2795
[`cfg`]: conditional-compilation.md#the-cfg-attribute
[`cfg_attr`]: conditional-compilation.md#the-cfg_attr-attribute
[llvm-argmod]: http://llvm.org/docs/LangRef.html#asm-template-argument-modifiers
