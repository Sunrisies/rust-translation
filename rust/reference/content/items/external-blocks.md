<a id="items.extern"></a>
# 外部块

<a id="items.extern.syntax"></a> 
```grammar,items
ExternBlock ->
    `unsafe`?[^unsafe-2024] `extern` Abi? `{`
        InnerAttribute*
        ExternalItem*
    `}`

ExternalItem ->
    OuterAttribute* (
        MacroInvocationSemi
      | Visibility? StaticItem
      | Visibility? Function
    )
```


<a id="items.extern.intro"></a> 外部块提供了当前crate中未定义的项的_声明_，这是Rust外部函数接口的基础。这些类似于未检查导入。

<a id="items.extern.allowed-kinds"></a> 在外部块中允许两种类型的项_声明_：[函数]和[静态函数]。

<a id="items.extern.safety"></a> 只有在`unsafe`上下文中才允许调用外部块中声明的unsafe函数或访问unsafe静态函数。

<a id="items.extern.namespace"></a> 外部块在其所在模块或块的[值命名空间]中定义其函数和静态函数。

<a id="items.extern.不安全-required"></a> 在外部块中，`extern`关键字前必须语义上出现`unsafe`关键字。

<a id="items.extern.edition2024"></a> 
> [!EDITION-2024]
> Prior to the 2024 edition, the `unsafe` keyword is optional. The `safe` and `unsafe` item qualifiers are only allowed if the external block itself is marked as `unsafe`.

<a id="items.extern.fn"></a>
## 函数

<a id="items.extern.fn.body"></a> 外部块中的函数与其他Rust函数声明方式相同，不同之处在于它们不能包含主体，而是由分号终止。

<a id="items.extern.fn.param-patterns"></a> 参数中不允许使用模式，只能使用[标识符]或`_`。

<a id="items.extern.fn.qualifiers"></a> 允许使用`safe`和`unsafe`函数限定符，但其他函数限定符（例如`const`、`async`、`extern`）则不允许。在`extern "custom"`块中拒绝使用`safe`限定符。

<a id="items.extern.fn.foreign-abi"></a> 外部块中的函数可以被Rust代码调用，就像在Rust中定义的函数一样。Rust编译器会自动在Rust ABI和外部ABI之间进行转换。

<a id="items.extern.fn.safety"></a> 如果在extern块中声明一个函数，除非使用`safe`函数限定符，否则该函数默认为`unsafe`。

<a id="items.extern.fn.fn-ptr"></a> 当被强制转换为函数指针时，在 extern 块中声明的函数具有类型 `for<'l1, ..., 'lm> extern "abi" fn(A1, ..., An) -> R`，其中 `'l1`, ... `'lm` 是其生命周期参数，`A1`, ..., `An` 是参数的声明类型，`R` 是声明的返回类型。

<a id="items.extern.static"></a>
## 静态成员

<a id="items.extern.static.intro"></a> 外部块中的静态成员与外部块外的 [statics] 一样进行声明，不同之处在于它们没有用于初始化其值的表达式。

<a id="items.extern.static.safety"></a> 除非在 extern 块中声明的静态成员被标记为 `safe`，否则无论是否可变性，访问该成员都是 `unsafe` 的，因为无法保证静态成员内存中的位模式与其声明类型一致，而初始化静态成员的任务由某些任意代码（例如 C 语言代码）负责。

<a id="items.extern.static.mut"></a> 外部静态成员可以是不可变的，也可以是可变的，就像外部块外的 [statics] 一样。

<a id="items.extern.static.read-only"></a> 不可变的静态成员必须在任何 Rust 代码执行之前进行初始化。仅仅在 Rust 代码读取该静态成员之前对其进行初始化是不够的。一旦 Rust 代码运行起来，无论是从内部还是外部对不可变静态成员进行修改都是未定义行为（UB），除非修改发生在 `UnsafeCell` 内部的字节上。

<a id="items.extern.abi"></a>
## ABI

<a id="items.extern.abi.intro"></a> `extern` 关键字后可以跟随一个可选的 [ABI] 字符串。ABI 指定了块中函数的调用约定。调用约定定义了函数的最低级接口，例如参数如何放入寄存器或栈中、返回值如何传递以及谁负责清理栈。

> [!EXAMPLE]
> ```rust
> // Interface to the Windows API.
> unsafe extern "system" { /* ... */ }
> ```

<a id="items.extern.abi.default"></a> 如果未指定 ABI 字符串，则默认为 `"C"`。

> [!NOTE]
> The `extern` syntax without an explicit ABI is being phased out, so it's better to always write the ABI explicitly.
>
> For more details, see [Rust issue #134986](https://github.com/rust-lang/rust/issues/134986).

<a id="items.extern.abi.standard"></a> 以下 ABI 字符串在所有平台上均被支持：

<a id="items.extern.abi.rust"></a> * `unsafe extern "Rust"` --- Rust 函数和闭包的原生调用约定。当函数未使用 [`extern fn`] 声明时，默认即为此方式。Rust ABI 不提供稳定性保证。

<a id="items.extern.abi.c"></a> * `unsafe extern "C"` --- “C” ABI 与目标平台主导的 C 编译器所选择的默认 ABI 一致。

<a id="items.extern.abi.system"></a> * `unsafe extern "system"` --- 等同于 `extern "C"`，但在 Windows x86_32 上，非变长函数相当于 `"stdcall"`，而变长函数则相当于 `"C"`。

  > [!NOTE]
  > As the correct underlying ABI on Windows is target-specific, it's best to use `extern "system"` when attempting to link Windows API functions that don't use an explicitly defined ABI.

<a id="items.extern.abi.unwind"></a> * `extern "C-unwind"` 和 `extern "system-unwind"` --- 分别等同于 `"C"` 和 `"system"`，但在被调用者展开（通过崩溃或抛出 C++ 风格异常）时具有[不同的行为][unwind-behavior]。

<a id="items.extern.abi.custom"></a> * `unsafe extern "custom"` --- 编译器未知的自定义 ABI。

<a id="items.extern.abi.platform"></a> 还有一些与平台相关的 ABI 字符串：

<a id="items.extern.abi.cdecl"></a> * `unsafe extern "cdecl"` --- 通常用于 x86_32 C 代码的调用约定。* 仅适用于 x86_32 目标。* 对应于 MSVC 的 `__cdecl` 以及 GCC 和 clang 的 `__attribute__((cdecl))`。

  > [!NOTE]
  > For details, see:
  >
  > - <https://learn.microsoft.com/en-us/cpp/cpp/cdecl>
  > - <https://en.wikipedia.org/wiki/X86_calling_conventions#cdecl>

<a id="items.extern.abi.stdcall"></a> * `unsafe extern "stdcall"` --- [Win32 API] 在 x86_32 上常用的调用约定。* 仅适用于 x86_32 目标。* 对应于 MSVC 的 `__stdcall` 以及 GCC 和 clang 的 `__attribute__((stdcall))`。

  > [!NOTE]
  > For details, see:
  >
  > - <https://learn.microsoft.com/en-us/cpp/cpp/stdcall>
  > - <https://en.wikipedia.org/wiki/X86_calling_conventions#stdcall>

<a id="items.extern.abi.win64"></a> * `unsafe extern "win64"` --- Windows x64 ABI。* 仅适用于 x86_64 目标。* “win64” 与 Windows x86_64 目标上的 “C” ABI 相同。* 对应于 GCC 和 clang 的 `__attribute__((ms_abi))`。

  > [!NOTE]
  > For details, see:
  >
  > - <https://learn.microsoft.com/en-us/cpp/build/x64-software-conventions>
  > - <https://en.wikipedia.org/wiki/X86_calling_conventions#Microsoft_x64_calling_convention>

<a id="items.extern.abi.sysv64"></a> * `unsafe extern "sysv64"` --- System V ABI。* 仅适用于 x86_64 目标。* “sysv64” 与非 Windows x86_64 目标上的 “C” ABI 相同。* 对应于 GCC 和 clang 的 `__attribute__((sysv_abi))`。

  > [!NOTE]
  > For details, see:
  >
  > - <https://wiki.osdev.org/System_V_ABI>
  > - <https://en.wikipedia.org/wiki/X86_calling_conventions#System_V_AMD64_ABI>

<a id="items.extern.abi.aapcs"></a> * `unsafe extern "aapcs"` --- ARM 软浮点 ABI。 * 仅适用于 ARM32 目标。 * “aapcs”与 soft-float ARM32 的 “C” ABI相同。 * 对应于 clang 的 `__attribute__((pcs("aapcs")))`。

  > [!NOTE]
  > For details, see:
  >
  > - [Arm Procedure Call Standard](https://developer.arm.com/documentation/107656/0101/Getting-started-with-Armv8-M-based-systems/Procedure-Call-Standard-for-Arm-Architecture--AAPCS-)

<a id="items.extern.abi.fastcall"></a> * `unsafe extern "fastcall"` --- stdcall 的 “快速”变体，某些参数通过寄存器传递。 * 仅适用于 x86_32 目标。 * 对应于 MSVC 的 `__fastcall` 以及 GCC 和 clang 的 `__attribute__((fastcall))`。

  > [!NOTE]
  > For details, see:
  >
  > - <https://learn.microsoft.com/en-us/cpp/cpp/fastcall>
  > - <https://en.wikipedia.org/wiki/X86_calling_conventions#Microsoft_fastcall>

<a id="items.extern.abi.thiscall"></a> * `unsafe extern "thiscall"` --- x86_32 MSVC 中用于 C++ 类成员函数的调用约定。 * 仅适用于 x86_32 目标。 * 对应于 MSVC 的 `__thiscall` 以及 GCC 和 clang 的 `__attribute__((thiscall))`。

  > [!NOTE]
  > For details, see:
  >
  > - <https://en.wikipedia.org/wiki/X86_calling_conventions#thiscall>
  > - <https://learn.microsoft.com/en-us/cpp/cpp/thiscall>

<a id="items.extern.abi.efiapi"></a> * `unsafe extern "efiapi"` --- [UEFI] 函数使用的 ABI。 * 仅适用于 x86 和 ARM 目标（32位和 64位）。

<a id="items.extern.abi.platform-unwind-variants"></a> 类似于 `"C"` 和 `"system"`，大多数平台特定的 ABI 字符串也包含相应的 [对应 `-unwind` 变体][unwind-behavior]；具体来说包括：

* `"aapcs-unwind"` * `"cdecl-unwind"` * `"fastcall-unwind"` * `"stdcall-unwind"` * `"sysv64-unwind"` * `"thiscall-unwind"` * `"win64-unwind"`

<a id="items.extern.variadic"></a>
## 变长函数

<a id="items.extern.variadic.syntax"></a> 外部块中的函数可以通过指定 `...` 作为最后一个参数来成为变长函数。变长参数可以用模式来指定。

```rust
unsafe extern "C" {
    unsafe fn foo(...);
    unsafe fn bar(x: i32, ...);
    unsafe fn with_name(format: *const u8, args: ...);
    // SAFETY: This function guarantees it will not access
    // variadic arguments.
    safe fn ignores_variadic_arguments(x: i32, ...);
}
```

> [!WARNING]
> The `safe` qualifier should not be used on a function in an `extern` block unless that function guarantees that it will not access the variadic arguments at all. Passing an unexpected number of arguments or arguments of unexpected type to a variadic function may lead to [undefined behavior][undefined].

<a id="items.extern.variadic.conventions"></a> 变长参数只能在带有以下 ABI 字符串或其对应 [`-unwind` 变体][items.fn.extern.unwind]的 `extern` 块中指定：

- `"aapcs"` - `"C"` - `"cdecl"` - `"efiapi"` - `"system"` - `"sysv64"` - `"win64"`

<a id="items.extern.attributes"></a>
## 外部块的属性

<a id="items.extern.attributes.intro"></a> 以下 [属性] 控制外部块的行为。

<a id="items.extern.attributes.link"></a>
### `link` 属性

<a id="items.extern.attributes.link.intro"></a> *`link` 属性* 指定了编译器在 `extern` 块中的项时应该链接的本地库名称。

<a id="items.extern.attributes.link.syntax"></a> 它使用 [MetaListNameValueStr] 语法来指定其输入。`name` 键是要链接的本地库名称。`kind` 键是一个可选值，用于指定库的类型，可能的取值包括：

<a id="items.extern.attributes.link.dylib"></a> - `dylib` --- 表示动态库。如果未指定 `kind`，则默认为此类型。

<a id="items.extern.attributes.link.static"></a> - `static` --- 表示静态库。

<a id="items.extern.attributes.link.framework"></a> - `framework` --- 表示 macOS 框架。仅适用于 macOS 目标平台。

<a id="items.extern.attributes.link.raw-dylib"></a> - `raw-dylib` --- 表示动态库，编译器将生成导入库以便链接（详情请参阅下方的 [`dylib` 与 `raw-dylib` 的区别]）。仅适用于 Windows 目标平台。

<a id="items.extern.attributes.link.name-requirement"></a> 如果指定了 `kind`，则必须包含 `name` 键。

<a id="items.extern.attributes.link.modifiers"></a> 可选的 `modifiers` 参数用于指定库链接时的修饰符。

<a id="items.extern.attributes.link.modifiers-syntax"></a> 修饰符以逗号分隔的字符串形式指定，每个修饰符前加上 `+` 或 `-` 符号，分别表示启用或禁用该修饰符。

<a id="items.extern.attributes.link.modifiers-multiple"></a> 目前不支持在单个 `link` 属性中指定多个 `modifiers` 参数，也不支持在同一 `modifiers` 参数中指定多个相同的修饰符。示例： `#[link(name = "mylib", kind = "static", modifiers = "+whole-archive")]`。

<a id="items.extern.attributes.link.wasm_import_module"></a> `wasm_import_module` 键可用于在 `extern` 块中导入来自宿主环境的符号时指定 [WebAssembly 模块] 名称。如果未指定 `wasm_import_module`，默认模块名称为 `env`。

<!-- ignore: requires extern linking -->
```rust,ignore
#[link(name = "crypto")]
unsafe extern {
    // …
}

#[link(name = "CoreFoundation", kind = "framework")]
unsafe extern {
    // …
}

#[link(wasm_import_module = "foo")]
unsafe extern {
    // …
}
```

<a id="items.extern.attributes.link.empty-block"></a> 在空的 extern 块上添加 `link` 属性是有效的。您可以使用此方式满足代码中其他 extern 块的链接要求（包括上游 crates），而无需为每个 extern 块都添加该属性。

<a id="items.extern.attributes.link.modifiers-bundle"></a>
#### 链接修饰符：`bundle`

<a id="items.extern.attributes.link.modifiers-bundle.allowed-kinds"></a> 此修饰符仅与 `static` 链接类型兼容。使用其他任何类型会导致编译器错误。

<a id="items.extern.attributes.link.modifiers-bundle.behavior"></a> 在构建 rlib 时，`+bundle` 表示原生静态库将被打包到 rlib 或 staticlib 归档中，然后在最终二进制程序的链接过程中从中检索。

<a id="items.extern.attributes.link.modifiers-bundle.behavior-negative"></a> 在构建 rlib 时，`-bundle` 表示原生静态库作为该 rlib 的“名称”依赖项进行注册，其对象文件仅在最终二进制程序的链接过程中被包含，同时按该名称进行的文件搜索也在最终链接过程中进行。在构建 staticlib 时，`-bundle` 表示原生静态库根本不包含在归档中，某些更高层次的构建系统需要在最终二进制程序的链接过程中稍后添加它。

<a id="items.extern.attributes.link.modifiers-bundle.no-effect"></a> 此修饰符在构建其他目标（如可执行文件或动态库）时没有效果。

<a id="items.extern.attributes.link.modifiers-bundle.default"></a> 此修饰器的默认值为 `+bundle`。

关于此修饰符的更多实现细节可以在 [`rustc` 的 `bundle` 文档中查找]。

<a id="items.extern.attributes.link.modifiers-whole-archive"></a>
#### 链接修饰符：`whole-archive`

<a id="items.extern.attributes.link.modifiers-whole-archive.allowed-kinds"></a> 此修饰符仅与 `static` 链接类型兼容。使用其他任何类型会导致编译器错误。

<a id="items.extern.attributes.link.modifiers-whole-archive.behavior"></a> `+whole-archive` 表示静态库作为整个归档被链接，不会丢弃任何对象文件。

<a id="items.extern.attributes.link.modifiers-whole-archive.default"></a> 该修饰符的默认值为 `-whole-archive`。

关于此修饰符的更多实现细节可以在 [`whole-archive` 文档中查找 for rustc]。

<a id="items.extern.attributes.link.modifiers-verbatim"></a>
#### 链接修饰符：`verbatim`

<a id="items.extern.attributes.link.modifiers-verbatim.allowed-kinds"></a> 该修饰符与所有链接类型兼容。

<a id="items.extern.attributes.link.modifiers-verbatim.behavior"></a> `+verbatim` 表示 rustc 本身不会在库名称中添加任何目标特定的库前缀或后缀（如 `lib` 或 `.a`），并且会尽力让链接器也添加这些前缀和后缀。

<a id="items.extern.attributes.link.modifiers-verbatim.behavior-negative"></a> `-verbatim` 表示 rustc 会在将库名称传递给链接器之前添加目标特定的前缀和后缀，或者不会阻止链接器自动添加这些前缀和后缀。

<a id="items.extern.attributes.link.modifiers-verbatim.default"></a> 该修饰符的默认值为 `-verbatim`。

关于此修饰符的更多实现细节可以在 [`verbatim` 文档中查找 for rustc]。

<a id="items.extern.attributes.link.kind-raw-dylib"></a>
#### `dylib` 与 `raw-dylib`

<a id="items.extern.attributes.link.kind-raw-dylib.intro"></a> 在 Windows 上，针对动态库进行链接时，需要向链接器提供导入库：这是一个特殊的静态库，它声明了动态库中导出的所有符号，使得链接器知道这些符号必须在运行时动态加载。

<a id="items.extern.attributes.link.kind-raw-dylib.import"></a> 指定 `kind = "dylib"` 会指示 Rust 编译器根据 `name` 键链接一个导入库。随后，链接器将使用其常规的库解析逻辑来查找该导入库。或者，指定 `kind = "raw-dylib"` 则指示编译器在编译过程中生成导入库，并将其提供给链接器。

<a id="items.extern.attributes.link.kind-raw-dylib.platform-specific"></a> `raw-dylib` 仅在 Windows 上支持。在其他平台目标下使用会导致编译器错误。

<a id="items.extern.attributes.link.import_name_type"></a>
#### `import_name_type` 键

<a id="items.extern.attributes.link.import_name_type.intro"></a> 在 x86 Windows 上，函数的名称会被“装饰”（即添加特定的前缀和/或后缀）以指示其调用约定。例如，一个没有参数的 `stdcall` 调用约定的函数名为 `fn1`，其将被装饰为 `_fn1@0`。然而，[PE 格式] 也允许函数名称没有前缀或未被装饰。此外，MSVC 和 GNU 工具链对于相同的调用约定使用不同的装饰方式，这意味着默认情况下，某些 Win32 函数无法通过 GNU 工具链使用 `raw-dylib` 链接类型。

<a id="items.extern.attributes.link.import_name_type.values"></a> 为了适应这些差异，当使用 `raw-dylib` 链接类型时，您还可以指定 `import_name_type` 键以下的值来更改生成的导入库中函数的命名方式：

* `decorated`：函数名称将采用 MSVC 工具链格式进行完全装饰。 * `noprefix`：函数名称将采用 MSVC 工具链格式进行装饰，但会跳过开头的 `?`、`@` 或可选的 `_`。 * `undecorated`：函数名称不会被装饰。

<a id="items.extern.attributes.link.import_name_type.default"></a> 如果未指定 `import_name_type` 键，则函数名称将采用目标工具链的格式进行完全装饰。

<a id="items.extern.attributes.link.import_name_type.variables"></a> 变量不会被装饰，因此 `import_name_type` 键对生成导入库中变量的命名没有影响。

<a id="items.extern.attributes.link.import_name_type.platform-specific"></a> `import_name_type` 键仅在 x86 Windows 上支持。在针对其他平台使用时会导致编译器错误。

<!-- template:attributes -->
<a id="items.extern.attributes.link_name"></a>
### `link_name` 属性

<a id="items.extern.attributes.link_name.intro"></a> *`link_name` [属性][attributes]* 可以应用于 `extern` 块中的声明，以指定为给定函数或静态成员导入的符号。

> [!EXAMPLE]
> ```rust
> unsafe extern "C" {
>     #[link_name = "actual_symbol_name"]
>     safe fn name_in_rust();
> }
> ```

<a id="items.extern.attributes.link_name.syntax"></a> `link_name` 属性使用 [MetaNameValueStr] 语法。

<a id="items.extern.attributes.link_name.invalid-names"></a> 符号名称不得为空字符串，也不得包含任何 `U+0000` (NUL) 字节。

<a id="items.extern.attributes.link_name.allowed-positions"></a> `link_name` 属性只能应用于 `extern` 块中的函数或静态项。

> [!NOTE]
> `rustc` ignores use in other positions but lints against it. This may become an error in the future.

<a id="items.extern.attributes.link_name.duplicates"></a> `link_name` 在项上的首次使用才具有效果。

> [!NOTE]
> `rustc` lints against any use following the first with a future-compatibility warning. This may become an error in the future.

<a id="items.extern.attributes.link_name.link_ordinal"></a> `link_name` 属性不得与 [`link_ordinal`] 属性一起使用。

<a id="items.extern.attributes.link_ordinal"></a>
### `link_ordinal` 属性

<a id="items.extern.attributes.link_ordinal.intro"></a> *`link_ordinal` 属性* 可以应用于 `extern` 块中的声明，以指示在生成导入库时要链接使用的数字顺序。每个符号在 Windows 动态库中都有唯一的编号，当加载该库时可以使用此编号来查找符号，而无需通过名称查找。

> [!WARNING]
> `link_ordinal` should only be used in cases where the ordinal of the symbol is known to be stable: if the ordinal of a symbol is not explicitly set when its containing binary is built then one will be automatically assigned to it, and that assigned ordinal may change between builds of the binary.

```rust
# #[cfg(all(windows, target_arch = "x86"))]
#[link(name = "exporter", kind = "raw-dylib")]
unsafe extern "stdcall" {
    #[link_ordinal(15)]
    safe fn imported_function_stdcall(i: i32);
}
```

<a id="items.extern.attributes.link_ordinal.allowed-kinds"></a> 此属性仅用于 `raw-dylib` 链接类型。使用其他类型会导致编译器错误。

<a id="items.extern.attributes.link_ordinal.exclusive"></a> 将 `link_name` 属性与此属性一起使用会导致编译器错误。

<a id="items.extern.attributes.fn-parameters"></a>
### 函数参数上的属性

外部函数参数的属性遵循与[常规函数参数]相同的规则和限制。

[ABI]: glossary.abi
[`extern fn`]: items.fn.extern
[`link_ordinal`]: items.extern.attributes.link_ordinal

[PE Format]: https://learn.microsoft.com/windows/win32/debug/pe-format#import-name-type
[UEFI]: https://uefi.org/specifications
[WebAssembly module]: https://webassembly.github.io/spec/core/syntax/modules.html
[`bundle` documentation for rustc]: ../../rustc/command-line-arguments.html#linking-modifiers-bundle
[`dylib` versus `raw-dylib`]: #dylib-versus-raw-dylib
[`unsafe` context]: ../unsafe-keyword.md
[`verbatim` documentation for rustc]: ../../rustc/command-line-arguments.html#linking-modifiers-verbatim
[`whole-archive` documentation for rustc]: ../../rustc/command-line-arguments.html#linking-modifiers-whole-archive
[attributes]: ../attributes.md
[functions]: functions.md
[regular function parameters]: functions.md#attributes-on-function-parameters
[statics]: static-items.md
[unwind-behavior]: functions.md#unwinding
[value namespace]: ../names/namespaces.md
[win32 api]: https://learn.microsoft.com/en-us/windows/win32/api/
