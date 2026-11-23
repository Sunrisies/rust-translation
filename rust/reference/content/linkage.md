<a id="link"></a>
# 链接

<a id="link.intro"></a> > [!NOTE] > 本节主要从编译器角度而非语言本身进行描述。

编译器支持多种静态和动态方式将 crate 连接在一起的方法。本节将探讨这些连接方法，关于原生库的更多信息可参阅书籍中的 [FFI 部分][ffi]。


<a id="link.type"></a> 在编译过程中，通过使用命令行标志或 `crate_type` 属性，编译器可以生成多个产物。如果指定了一个或多个命令行标志，则所有 `crate_type` 属性将被忽略，仅构建由命令行指定的产物。

<a id="link.bin"></a> * `--crate-type=bin`, `#![crate_type = "bin"]` - 将生成一个可运行的可执行文件。这要求 crate 中包含 `main` 函数，在程序开始执行时调用该函数。这将链接所有 Rust 和原生依赖项，生成单个可分发二进制文件。这是默认的 crate 类型。

<a id="link.lib"></a> * `--crate-type=lib`, `#![crate_type = "lib"]` - 将生成一个 Rust 库。由于库可以有多种形式，因此具体生成什么内容具有不确定性。此通用 `lib` 选项的目的是生成“编译器推荐”风格的库。生成的库始终可被 rustc 使用，但库的实际类型可能会随时间变化。其余输出类型都是不同形式的库，`lib` 类型可视为其中一种的别名（但实际类型由编译器定义）。

<a id="link.dylib"></a> * `--crate-type=dylib`, `#![crate_type = "dylib"]` - 将生成一个动态 Rust 库。与 `lib` 输出类型不同，此选项强制生成动态库。生成的动态库可用作其他库和/或可执行文件的依赖项。这种输出类型会在 Linux 上生成 `*.so` 文件，在 macOS 上生成 `*.dylib` 文件，在 Windows 上生成 `*.dll` 文件。

<a id="link.staticlib"></a> * `--crate-type=staticlib`, `#![crate_type = "staticlib"]` - 将生成一个静态系统库。与其他库输出不同之处在于，编译器不会尝试链接到 `staticlib` 输出。这种输出类型的目的是创建一个包含所有本地 crate 代码及所有上游依赖项的静态库。在 Linux、macOS 和 Windows (MinGW) 上，此输出类型会生成 `*.a` 文件；在 Windows (MSVC) 上则生成 `*.lib` 文件。对于将 Rust 代码链接到现有的非 Rust 应用程序等场景，推荐使用这种格式，因为该库不会依赖其他 Rust 代码的动态依赖项。

  请注意，静态库可能拥有的任何动态依赖项（例如对系统库的依赖或作为动态库编译的 Rust 库的依赖）必须在从其他地方链接该静态库时手动指定。 `--print=native-static-libs` 标志可能有助于解决这一问题。

  需要注意的是，由于生成的静态库包含所有依赖项的代码，包括标准库，并且还导出这些依赖项的所有公共符号，因此将静态库链接到可执行文件或共享库中可能需要特殊处理。对于共享库而言，通过链接器或符号版本脚本、导出符号列表 (macOS) 或模块定义文件 (Windows) 来限制导出的符号列表是必要的。此外，可以删除未使用的部分以移除所有实际未使用的依赖代码（例如在 macOS 上使用 `--gc-sections` 或 `-dead_strip`）。

<a id="link.cdylib"></a> * `--crate-type=cdylib`, `#![crate_type = "cdylib"]` - 将生成一个动态系统库。此类型用于编译需要从其他语言加载的动态库。这种输出类型在 Linux 上会生成 `*.so` 文件，在 macOS 上生成 `*.dylib` 文件，在 Windows 上生成 `*.dll` 文件。

<a id="link.rlib"></a> * `--crate-type=rlib`, `#![crate_type = "rlib"]` - 将生成“Rust库”文件。该文件被用作中间产物，可以视为“静态Rust库”。与 `staticlib` 文件不同，这些 `rlib` 文件在后续链接过程中由编译器解释执行。这意味着 `rustc` 会在 `rlib` 文件中查找元数据，就像在动态库中查找一样。这种输出形式可用于生成静态链接的可执行文件以及 `staticlib` 的输出。

<a id="link.proc-宏"></a> * `--crate-type=proc-macro`, `#![crate_type = "proc-macro"]` - 产生的输出未明确指定，但如果提供 `-L` 路径，编译器会将这些输出产物识别为宏并加载用于程序。使用此 crate 类型编译的 crates 必须仅导出 [过程式宏]。编译器会自动设置 `proc_macro` [配置选项]。这些 crates 总是以与编译器本身构建时相同的目标进行编译。例如，如果您在 Linux 上使用 `x86_64` CPU 运行编译器，即使该 crate 是另一个针对不同目标构建的 crate 的依赖项，目标仍将为 `x86_64-unknown-linux-gnu`。

<a id="link.repetition"></a> 请注意，这些输出是可叠加的，如果指定了多个输出，则编译器无需重新编译即可生成每种形式的输出。不过，这仅适用于使用相同方法指定的输出。如果只指定了 `crate_type` 属性，则所有输出都会被构建；但如果指定了一个或多个 `--crate-type` 命令行标志，则只有这些输出会被构建。

<a id="link.dependency"></a> 由于存在多种不同的输出形式，如果 crate A 依赖于 crate B，那么编译器可能会在系统中的不同位置找到 B。然而，编译器只查找 `rlib` 格式和动态库格式两种形式。面对这两种依赖库的形式，编译器必须在其中选择一个格式。考虑到这一点，编译器在决定使用哪种依赖格式时遵循以下规则：

<a id="link.dependency-staticlib"></a> 1. 如果生成静态库，所有上游依赖项必须以 `rlib` 格式存在。这一要求源于动态库无法转换为静态格式的事实。

   请注意，无法将原生动态依赖项链接到静态库中，在这种情况下，系统会显示关于所有未链接的原生动态依赖项的警告信息。

<a id="link.dependency-rlib"></a> 

2. 如果生成 `rlib` 文件，则上游依赖项可以采用任何格式，但必须能够读取元数据。这仅仅要求所有上游依赖项都能被读取元数据。

   原因是 `rlib` 文件不包含其上游依赖项。让所有 `rlib` 文件都包含 `libstd.rlib` 的副本效率并不高！

<a id="link.dependency-prefer-dynamic"></a> 

3. 如果生成可执行程序且未指定 `-C prefer-dynamic` 标志，则首先尝试在 `rlib` 格式中找到依赖项。如果某些依赖项无法以 rlib 格式找到，则尝试动态链接（详见下文）。

<a id="link.dependency-dynamic"></a> 

4. 如果生成动态库或需要动态链接的可执行程序，编译器将尝试将可用的 `rlib` 或 dylib 格式的依赖项整合在一起以生成最终产品。

   编译器的主要目标之一是确保库在任何产物中不会出现多次。例如，如果动态库 B 和 C 都静态链接到库 A 中，那么一个 crate 就不能同时链接 B 和 C，因为这样会产生两个 A 的副本。编译器允许混合使用 rlib 和 dylib 格式，但必须遵守这一限制。

   目前，编译器没有方法提示库应该链接哪种格式。在动态链接时，编译器会尝试最大化动态依赖关系，同时仍允许部分依赖通过 rlib 进行链接。

   对于大多数情况，如果采用动态链接，建议所有库都以 dylib 形式提供。在其他情况下，如果编译器无法确定每个库应链接哪种格式，则会发出警告。

通常，`--crate-type=bin` 或 `--crate-type=lib` 足以满足所有编译需求，而其他选项仅在需要更精细控制 crate 输出格式时可用。

<a id="link.crt"></a>
## 静态和动态 C 运行时

<a id="link.crt.intro"></a> 标准库通常会在适当的目标上同时支持静态链接和动态链接的 C 运行时。例如，`x86_64-pc-windows-msvc` 和 `x86_64-unknown-linux-musl` 目标通常都包含这两种运行时，用户可以选择使用其中哪一种。编译器中的所有目标默认都会链接到 C 运行时。通常默认情况下目标以动态方式链接，但也有一些默认为静态的例外情况，例如：

* `arm-unknown-linux-musleabi` * `arm-unknown-linux-musleabihf` * `armv7-unknown-linux-musleabihf` * `i686-unknown-linux-musl` * `x86_64-unknown-linux-musl`

<a id="link.crt.crt-static"></a> C 运行时的链接配置会遵循 `crt-static` 目标特性。这些目标特性通常通过命令行标志传递给编译器来配置。例如，要启用静态运行时，可以执行以下命令：

```sh
rustc -C target-feature=+crt-static foo.rs
```

而若要动态链接到 C 运行时，则可以执行以下命令：

```sh
rustc -C target-feature=-crt-static foo.rs
```

<a id="link.crt.ineffective"></a> 那些不支持在 C 运行时链接方式之间切换的目标将忽略此标志。建议检查生成的二进制文件，以确保编译器成功后其链接方式符合预期。

<a id="link.crt.target_feature"></a> 库也可以了解 C 运行时的链接方式。例如，MSVC 上的代码需要根据所链接的运行器以不同的方式编译（如 `/MT` 或 `/MD`）。目前通过 [`cfg` 属性 `target_feature` 选项]进行导出。

```rust
#[cfg(target_feature = "crt-static")]
fn foo() {
    println!("the C runtime should be statically linked");
}

#[cfg(not(target_feature = "crt-static"))]
fn foo() {
    println!("the C runtime should be dynamically linked");
}
```

此外，Cargo 构建脚本也可以通过[环境变量][cargo]了解此功能。在构建脚本中，可以通过以下方式检测链接方式：

```rust
use std::env;

fn main() {
    let linkage = env::var("CARGO_CFG_TARGET_FEATURE").unwrap_or(String::new());

    if linkage.contains("crt-static") {
        println!("the C runtime will be statically linked");
    } else {
        println!("the C runtime will be dynamically linked");
    }
}
```


要在本地使用此功能，通常可以使用 `RUSTFLAGS` 环境变量通过 Cargo 向编译器指定标志。例如，在 MSVC 上编译静态链接的二进制文件时，应执行如下操作：

```sh
RUSTFLAGS='-C target-feature=+crt-static' cargo build --target x86_64-pc-windows-msvc
```

<a id="link.foreign-code"></a>
## 混合 Rust 和外部代码库

<a id="link.foreign-code.foreign-linkers"></a> 如果您将 Rust 与外部代码（如 C、C++）混合使用，并希望生成一个包含这两种类型代码的单一二进制文件，则有两种最终二进制链接方法：

* 使用 `rustc`。通过 `-L <directory>` 和 `-l<library>` rustc 参数，或您在 Rust 代码中使用的 `#[link]` 指令来引入任何非 Rust 库。如果您需要链接 `.o` 文件，可以使用 `-Clink-arg=file.o`。 * 使用您的外部链接器。在这种情况下，您首先需要生成 Rust `staticlib` 目标，并将其传递给外部链接器的调用。如果您需要链接多个 Rust 子系统，则可能需要生成一个_单一的_ `staticlib`，可能需要使用大量的 `extern crate` 语句来包含多个 Rust `rlib`s。多个 Rust `staticlib` 文件可能会产生冲突。

目前不支持直接将 `rlib`s 传递给外部链接器。

> [!NOTE] > 根据本节的规定，使用不同版本的 Rust 运行时编译或链接的 Rust 代码被视为“外部代码”。

<a id="link.unwinding"></a>
### 禁止的链接与展开

<a id="link.unwinding.intro"></a> 只有在按照以下规则一致构建二进制文件时，才允许使用恐慌展开。

<a id="link.unwinding.potential"></a> 如果满足以下任一条件，Rust 库被称为*可能展开*： - 该库使用了 [`unwind` 恐慌处理程序][panic.panic_handler]。 - 该库包含使用 `unwind` [恐慌策略]构建的 crate，该 crate 通过 `-unwind` ABI 调用函数。 - 该库对运行在具有独立 Rust 运行时的其他 Rust 库中的代码进行 `"Rust"` ABI 调用，且该其他库可能展开。

> [!NOTE] > 此定义决定了 Rust 库内的 `"Rust"` ABI 调用是否可能展开。

<a id="link.unwinding.prohibited"></a> 如果某个 Rust 库可能展开，则所有相关 crate 必须使用 `unwind` [恐慌策略]构建。否则，展开可能导致未定义行为。

> [!NOTE] > 如果您使用 `rustc` 进行链接，这些规则会自动执行。如果您不使用 `rustc` 进行链接，则必须确保整个二进制文件中的展开处理一致。不使用 `rustc` 的链接包括使用 `dlopen` 或类似设施，而此类链接由系统运行时在不涉及 `rustc` 的情况下完成。这种情况仅发生在混合具有不同 [`-C panic`] 标志的代码时，因此大多数用户无需担心此问题。

> [!NOTE] > 为了确保库在链接时使用任何恐慌运行时都能保持健全（并可与 `rustc` 链接），可以使用 [`ffi_unwind_calls` lint]。该 lint 会标记所有对 `-unwind` 外部函数或函数指针的调用。

[ffi]: ../book/ch20-01-unsafe-rust.html#using-extern-functions-to-call-external-code
[cargo]: ../cargo/reference/environment-variables.html#environment-variables-cargo-sets-for-build-scripts
[`cfg` attribute `target_feature` option]: conditional-compilation.md#target_feature
[`ffi_unwind_calls` lint]: ../rustc/lints/listing/allowed-by-default.html#ffi-unwind-calls
[configuration option]: conditional-compilation.md
[procedural macros]: procedural-macros.md
[panic strategy]: panic.md#panic-strategy
[`-C panic`]: ../rustc/codegen-options/index.html#panic
