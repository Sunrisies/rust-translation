# 构建脚本示例

以下部分展示了编写构建脚本的一些示例。

一些常见的构建脚本功能可以在 [crates.io] 上的 crates 中找到。查看 [`build-dependencies` 关键字](https://crates.io/keywords/build-dependencies) 以了解可用的功能。以下是几个热门 crates 的示例[^†]：

* [`bindgen`](https://crates.io/crates/bindgen) --- 自动生成 Rust FFI 绑定到 C 库。
* [`cc`](https://crates.io/crates/cc) --- 编译 C/C++/汇编代码。
* [`pkg-config`](https://crates.io/crates/pkg-config) --- 使用 `pkg-config` 工具检测系统库。
* [`cmake`](https://crates.io/crates/cmake) --- 运行 `cmake` 构建工具来构建原生库。
* [`autocfg`](https://crates.io/crates/autocfg)、[`rustc_version`](https://crates.io/crates/rustc_version)、[`version_check`](https://crates.io/crates/version_check) --- 这些 crates 提供根据当前 `rustc` 版本进行条件编译的方法。


## 代码生成

由于各种原因，某些 Cargo 包在编译前需要生成代码。在这里，我们将通过一个简单的示例来展示如何在构建脚本中生成库调用。

首先，让我们看看该包的目录结构：

```text
.
├── Cargo.toml
├── build.rs
└── src
    └── main.rs

1 directory, 3 files
```

可以看到我们有一个 `build.rs` 构建脚本和位于 `main.rs` 中的二进制文件。该包有一个基本的清单：

```toml
# Cargo.toml

[package]
name = "hello-from-generated-code"
version = "0.1.0"
edition = "2024"
```

让我们看看构建脚本里包含的内容：

```rust,no_run
// build.rs

use std::env;
use std::fs;
use std::path::Path;

fn main() {
    let out_dir = env::var_os("OUT_DIR").unwrap();
    let dest_path = Path::new(&out_dir).join("hello.rs");
    fs::write(
        &dest_path,
        "pub fn message() -> &'static str {
            \"Hello, World!\"
        }
        "
    ).unwrap();
    println!("cargo::rerun-if-changed=build.rs");
}
```

这里有几个需要注意的地方：

* 该脚本使用 `OUT_DIR` 环境变量来确定输出文件的位置。它可以使用进程当前工作目录来确定输入文件的位置，但在本例中没有输入文件。
* 通常，构建脚本不应修改 `OUT_DIR` 之外的任何文件。乍看之下似乎没问题，但当你将该 crate 作为依赖项使用时，确实会引发问题，因为 `.cargo/registry` 中的源文件具有*隐式*的不可变性规则。`cargo` 在打包时会不允许此类脚本运行。
* 有时，项目希望将生成的文件纳入其中并将其视为源代码。然而，在这种情况下，该文件不应由 `build.rs` 生成。相反，应编写一个测试或类似工具来验证该文件与生成的版本是否完全匹配，如果不匹配则失败，并将该测试作为 CI 的一部分运行。（测试可以生成一个临时文件用于比较，如果你希望更新生成的文件，可以将已提交的文件替换为该临时文件。） * 此脚本相对简单，因为它只是写入一个小的生成文件。人们可以想象，其他更复杂的操作也可能发生，例如从 C 头文件或其他语言定义中生成 Rust 模块等。
* [`rerun-if-changed` 指令](build-scripts.md#rerun-if-changed)告诉 `cargo`，构建脚本只有在自身发生变化时才需要重新运行。如果没有这一行，当包中的任何文件发生变化时，`cargo` 会自动运行构建脚本。如果你的代码生成使用了某些输入文件，这里就是打印这些文件的列表的地方。

接下来，让我们看看库本身：

```rust,ignore
// src/main.rs

include!(concat!(env!("OUT_DIR"), "/hello.rs"));

fn main() {
    println!("{}", message());
}
```

这就是真正的魔法发生的地方。该库使用 rustc 定义的 [`include!` 宏][include-宏]，结合 [`concat!`][concat-宏] 和 [`env!`][env-宏] 宏，将生成的文件（`hello.rs`）纳入到 crate 的编译过程中。

利用这里展示的结构，crates 可以从构建脚本本身包含任意数量的生成文件。


## 构建原生库

有时需要将某些原生 C 或 C++ 代码作为包的一部分进行构建。这是利用构建脚本在 Rust crate 之前先构建原生库的另一个优秀用例。例如，我们将创建一个调用 C 语言来打印“Hello, World!”的 Rust 库。

如上所述，首先让我们看看包的布局：

```text
.
├── Cargo.toml
├── build.rs
└── src
    ├── hello.c
    └── main.rs

1 directory, 4 files
```

与之前非常相似！接下来是清单文件：

```toml
# Cargo.toml

[package]
name = "hello-world-from-c"
version = "0.1.0"
edition = "2024"
```

目前我们不会使用任何构建依赖项，所以现在让我们看一下构建脚本：

```rust,no_run
// build.rs

use std::process::Command;
use std::env;
use std::path::Path;

fn main() {
    let out_dir = env::var("OUT_DIR").unwrap();

    // Note that there are a number of downsides to this approach, the comments
    // below detail how to improve the portability of these commands.
    Command::new("gcc").args(&["src/hello.c", "-c", "-fPIC", "-o"])
                       .arg(&format!("{}/hello.o", out_dir))
                       .status().unwrap();
    Command::new("ar").args(&["crus", "libhello.a", "hello.o"])
                      .current_dir(&Path::new(&out_dir))
                      .status().unwrap();

    println!("cargo::rustc-link-search=native={}", out_dir);
    println!("cargo::rustc-link-lib=static=hello");
    println!("cargo::rerun-if-changed=src/hello.c");
}
```

该构建脚本首先通过调用 `gcc` 将我们的 C 文件编译成对象文件，然后通过调用 `ar` 将该对象文件转换为静态库。最后一步是向 Cargo 本身反馈信息，说明输出位于 `out_dir` 中，并且编译器应通过 `-l static=hello` 标志将 crate 静态链接到 `libhello.a`。

请注意，这种硬编码方法存在许多缺点：

* `gcc` 命令本身并不跨平台可移植。例如，Windows 平台很可能没有 `gcc`，甚至并非所有 Unix 平台都有 `gcc`。`ar` 命令也处于类似情况。
* 这些命令没有考虑交叉编译。如果我们针对 Android 等平台进行交叉编译，`gcc` 不太可能生成 ARM 可执行文件。

不过不必担心，此时添加 `build-dependencies` 条目会很有帮助！Cargo 生态系统中有许多包可以使这种任务更加简单、可移植且标准化。让我们尝试从 [crates.io](https://crates.io/crates/cc) 获取 [`cc` crate]。首先将其添加到 `Cargo.toml` 中的 `build-dependencies`：

```toml
[build-dependencies]
cc = "1.0"
```

然后重写构建脚本以使用此 crate：

```rust,ignore
// build.rs

fn main() {
    cc::Build::new()
        .file("src/hello.c")
        .compile("hello");
    println!("cargo::rerun-if-changed=src/hello.c");
}
```

[`cc` crate] 抽象了 C 代码构建脚本的一系列要求：

* 它调用适当的编译器（Windows 使用 MSVC，MinGW 使用 `gcc`，Unix 平台使用 `cc）。
* 它通过向使用的编译器传递适当的标志来考虑 `目标` 变量。
* 其他环境变量，如 `OPT_LEVEL`、`DEBUG` 等，都由库自动处理。
* `cc` 库还处理了标准输出和 `OUT_DIR` 的位置。

现在我们可以看到将尽可能多的功能移交给常见的构建依赖项，而不是在所有构建脚本中重复逻辑的一些主要优势！

回到案例研究，让我们快速看一下 `src` 目录的内容：

```c
// src/hello.c

#include <stdio.h>

void hello() {
    printf("Hello, World!\n");
}
```

```rust,ignore
// src/main.rs

// Note the lack of the `#[link]` attribute. We’re delegating the responsibility
// of selecting what to link over to the build script rather than hard-coding
// it in the source file.
unsafe extern { fn hello(); }

fn main() {
    unsafe { hello(); }
}
```

就是这样！这应该完成了我们使用构建脚本从 Cargo 包构建 C 代码的示例。这也说明了在许多情况下使用构建依赖项为何至关重要，甚至更加简洁！

我们还看到了一个简短的示例，说明构建脚本如何仅将 crate 作为构建过程中的依赖项使用，而在运行时并不使用该 crate。


## 链接到系统库

这个示例展示了如何链接系统库，以及构建脚本如何支持这种使用场景。

经常会有 Rust crate 希望链接到系统上的原生库，以绑定其功能或作为实现细节的一部分使用。当需要在平台无关的方式下执行此操作时，这是一个相当复杂的问题。如果可能的话，最好将尽可能多的功能移交给依赖项，以便消费者能够轻松使用。

对于这个示例，我们将创建一个对系统 zlib 库的绑定。这是大多数类 Unix 系统上常见的提供数据压缩功能的库。它已经被 [`libz-sys` crate]封装了，但在这个示例中，我们将使用一个极其简化的版本。请查看 [源代码][libz-source]以了解完整示例。

为了便于查找库的位置，我们将使用 [`pkg-config` 包]。该包利用系统的 `pkg-config` 工具来发现关于库的信息。它会自动告诉 Cargo需要哪些依赖项来链接该库。这通常仅在安装了 `pkg-config` 的类 Unix 系统上生效。我们先设置清单文件：

```toml
# Cargo.toml

[package]
name = "libz-sys"
version = "0.1.0"
edition = "2024"
links = "z"

[build-dependencies]
pkg-config = "0.3.16"
```

请注意，我们在 `package` 表中加入了 `links` 键。这告诉 Cargo我们将链接到 `libz` 库。请参阅 ["使用其他系统包"](#using-another-sys-crate) 以了解如何利用此功能的一个示例。

构建脚本相当简单：

```rust,ignore
// build.rs

fn main() {
    pkg_config::Config::new().probe("zlib").unwrap();
    println!("cargo::rerun-if-changed=build.rs");
}
```

让我们通过基本的 FFI 绑定来完善这个示例：

```rust,ignore
// src/lib.rs

use std::os::raw::{c_uint, c_ulong};

unsafe extern "C" {
    pub fn crc32(crc: c_ulong, buf: *const u8, len: c_uint) -> c_ulong;
}

#[test]
fn test_crc32() {
    let s = "hello";
    unsafe {
        assert_eq!(crc32(0, s.as_ptr(), s.len() as c_uint), 0x3610a686);
    }
}
```

运行 `cargo build -vv` 可以查看构建脚本的输出。在已安装 `libz` 的系统上，输出可能如下所示：

```text
[libz-sys 0.1.0] cargo::rustc-link-search=native=/usr/lib
[libz-sys 0.1.0] cargo::rustc-link-lib=z
[libz-sys 0.1.0] cargo::rerun-if-changed=build.rs
```

很好！`pkg-config` 完成了查找库并告诉 Cargo其位置的工作。

包中包含库的源代码并不罕见，如果系统上没有该源文件，或者设置了特定功能或环境变量，则会将代码静态构建。例如，真实的 [`libz-sys` 包]会检查 `LIBZ_SYS_STATIC` 环境变量或启用 `static` 功能，以从源代码构建而非使用系统库。请查看 [源代码][libz-source]以获取更完整的示例。


## 使用其他 `sys` 包

当使用 `links` 键时，包可以设置元数据，这些元数据可以被依赖它的其他包读取。这提供了一种在包之间传递信息的机制。在这个示例中，我们将创建一个利用真实 [`libz-sys` 包中的 zlib]的 C 库。

如果您有一个依赖 zlib 的 C 库，可以使用 [`libz-sys` crate]来自动查找或构建该库。这对于跨平台支持非常有用，例如 Windows 系统通常没有安装 zlib。`libz-sys` [设置 `include` 元数据](https://github.com/rust-lang/libz-sys/blob/3c594e677c79584500da673f918c4d2101ac97a1/build.rs#L156)，以告诉其他包在哪里可以找到 zlib 的头文件。我们的构建脚本可以通过 `DEP_Z_INCLUDE` 环境变量读取该元数据。以下是一个示例：

```toml
# Cargo.toml

[package]
name = "z_user"
version = "0.1.0"
edition = "2024"

[dependencies]
libz-sys = "1.0.25"

[build-dependencies]
cc = "1.0.46"
```

在这里，我们引入了 `libz-sys`，这将确保最终库中只使用一个 `libz`，并且我们可以从构建脚本中访问它：

```rust,ignore
// build.rs

fn main() {
    let mut cfg = cc::Build::new();
    cfg.file("src/z_user.c");
    if let Some(include) = std::env::var_os("DEP_Z_INCLUDE") {
        cfg.include(include);
    }
    cfg.compile("z_user");
    println!("cargo::rerun-if-changed=src/z_user.c");
}
```

由于 `libz-sys` 负责所有复杂的操作，C 源代码现在可以包含 zlib 头文件，即使在没有安装该头的系统上也能找到该头文件。

```c
// src/z_user.c

#include "zlib.h"

// … rest of code that makes use of zlib.
```
## 读取目标配置

当构建脚本需要根据目标平台做出决策时，应该读取 `CARGO_CFG_*` 环境变量，而不是使用 `cfg!` 或 `#[cfg]` 属性。这是因为构建脚本是在 *主机* 机器上编译和运行的，而 `CARGO_CFG_*` 变量则反映 *目标* 平台，这是跨编译时的一个重要区别。
```rust,ignore
// build.rs

fn main() {
    // reads the TARGET configuration
    let target_os = std::env::var("CARGO_CFG_TARGET_OS").unwrap();

    if target_os == "windows" {
        println!("cargo::rustc-link-lib=userenv");
    } else if target_os == "linux" {
        println!("cargo::rustc-link-lib=pthread");
    }
}
```

请注意，某些配置值可能包含由逗号分隔的多个值（例如，`CARGO_CFG_TARGET_FAMILY` 可能是 `unix,wasm`）。检查这些值时，务必妥善处理这种情况。

为了获得更便捷、类型化的 API，可以考虑使用 [`build-rs`] crate，它会处理这些细节。


## 条件编译

构建脚本可能会输出 [`rustc-cfg` 指令]，这些指令可以启用在编译时检查的条件。在这个示例中，我们将看看 [`openssl` crate]是如何使用这些指令来支持多个版本的 OpenSSL 库的。

[`openssl-sys` 库]实现了 OpenSSL 库的构建和链接。它支持多种不同的实现（如 LibreSSL）和多个版本。该库使用 `links` 键，以便向其他构建脚本传递信息。其中传递的信息之一为 `version_number` 键，表示检测到的 OpenSSL 版本。构建脚本中的代码大致如下 [可查看](https://github.com/sfackler/rust-openssl/blob/dc72a8e2c429e46c275e528b61a733a66e7877fc/openssl-sys/build/main.rs#L216):

```rust,ignore
println!("cargo::metadata=version_number={openssl_version:x}");
```

此指令会在直接依赖 `opensl-sys` 的库中设置 `DEP_OPENSSL_VERSION_NUMBER` 环境变量。

提供更高层接口的 [`openssl` 库]将 `opensl-sys` 指定为依赖项。`openssl` 构建脚本可以通过 `DEP_OPENSSL_VERSION_NUMBER` 环境变量读取由 `opensl-sys` 构建脚本生成的版本信息，并据此生成一些 [`cfg` 值](https://github.com/sfackler/rust-openssl/blob/dc72a8e2c429e46c275e528b61a733a66e7877fc/openssl/build.rs#L18-L36):

```rust,ignore
// (portion of build.rs)

println!("cargo::rustc-check-cfg=cfg(ossl101,ossl102)");
println!("cargo::rustc-check-cfg=cfg(ossl110,ossl110g,ossl111)");

if let Ok(version) = env::var("DEP_OPENSSL_VERSION_NUMBER") {
    let version = u64::from_str_radix(&version, 16).unwrap();

    if version >= 0x1_00_01_00_0 {
        println!("cargo::rustc-cfg=ossl101");
    }
    if version >= 0x1_00_02_00_0 {
        println!("cargo::rustc-cfg=ossl102");
    }
    if version >= 0x1_01_00_00_0 {
        println!("cargo::rustc-cfg=ossl110");
    }
    if version >= 0x1_01_00_07_0 {
        println!("cargo::rustc-cfg=ossl110g");
    }
    if version >= 0x1_01_01_00_0 {
        println!("cargo::rustc-cfg=ossl111");
    }
}
```

这些 [`cfg` 值]随后可以通过 [`cfg` 属性]或 [`cfg` 宏]条件性地包含代码。例如，SHA3 支持在 OpenSSL 1.1.1 中添加，因此对于旧版本则被 [条件排除](https://github.com/sfackler/rust-opensl/blob/dc72a8e2c429e46c275e528b61a733a66e7877fc/openssl/src/hash.rs#L67-L85):

```rust,ignore
// (portion of openssl crate)

#[cfg(ossl111)]
pub fn sha3_224() -> MessageDigest {
    unsafe { MessageDigest(ffi::EVP_sha3_224()) }
}
```

当然，使用此功能时需要注意，因为它使生成的二进制文件对构建环境更加依赖。例如，如果二进制文件分发到另一个系统，它可能没有完全相同的共享库，这可能会引起问题。

[include-macro]: ../../std/macro.include.html
[concat-macro]: ../../std/macro.concat.html
[env-macro]: ../../std/macro.env.html
[`cc` crate]: https://crates.io/crates/cc
[`libz-sys` crate]: https://crates.io/crates/libz-sys
[`pkg-config` crate]: https://crates.io/crates/pkg-config
[libz-source]: https://github.com/rust-lang/libz-sys
[`build-rs`]: https://crates.io/crates/build-rs
[`cfg` attribute]: ../../reference/conditional-compilation.md#the-cfg-attribute
[`cfg` macro]: ../../std/macro.cfg.html
[`rustc-cfg` instructions]: build-scripts.md#rustc-cfg
[`openssl` crate]: https://crates.io/crates/openssl
[`openssl-sys` crate]: https://crates.io/crates/openssl-sys
[crates.io]: https://crates.io/
