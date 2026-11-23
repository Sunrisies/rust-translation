# 功能示例

以下展示了一些实际中功能生效的实例。

## 减少构建时间和文件大小

某些包使用特定功能，如果禁用这些功能，就能减小库的大小并缩短编译时间。以下是一些例子：

* [`syn`] 是一个用于解析 Rust 代码的流行库。由于它非常受欢迎，因此有助于缩短编译时间，因为它影响了许多项目。该库有一个[文档齐全的列表][syn-features]，可用于减少其所包含代码的数量。
* [`regex`] 具有[多个功能][regex-features]，并且这些功能[文档完善][regex-docs]。移除 Unicode 支持可以减小文件大小，因为可以删除一些大型表结构。
* [`winapi`] 具有[大量功能][winapi-features]，这些功能限制了它支持的 Windows API 绑定类型。
* [`web-sys`] 是另一个类似 `winapi` 的示例，它提供了[巨大的 API 绑定表面][web-sys-features]，这些绑定是通过使用特定功能来限制的。


## 扩展行为

[`serde_json`] 包具有 [`preserve_order` 功能][serde_json-preserve_order]，该功能[改变行为][serde_json-code]，使 JSON 映射保持键插入的顺序。请注意，启用此功能会引入一个可选的依赖项 [`indexmap`] 来实现新的行为。

当进行此类行为更改时，请确保更改符合[SemVer 规范]。也就是说，启用该功能不应破坏通常在不启用该功能时可以构建的代码。


## `no_std` 支持

某些包希望同时支持 [`no_std`] 和 `std` 环境。这对于支持嵌入式及资源受限平台很有用，但仍允许支持完整标准库的平台使用更多功能。

[`wasm-bindgen`] 包定义了 [默认启用] 的 [`std` 特性][wasm-bindgen-std]。在库顶部，它[无条件启用 `no_std` 属性][wasm-bindgen-no_std]。这确保 `std` 和 [`std` prelude] 不会自动进入作用域。然后，在代码的各个位置（[示例1][wasm-bindgen-cfg1]，[示例2][wasm-bindgen-cfg2]），它使用 `#[cfg(feature = "std")]` 属性来条件性地启用需要 `std` 的额外功能。


## 重新导出依赖特性

从依赖项中重新导出功能可能会更加方便。这样，依赖该套件的用户就可以控制这些功能，而无需直接指定那些依赖项。例如，`[regex]` 从 `[regex_syntax]` 包中 [重新导出]了 `[regex-re-export]` 功能。使用 `regex` 的用户不需要了解 `[regex_syntax]` 包，但他们仍然可以访问该包中包含的功能。


## C 库的分发

某些套件提供对常见 C 库的绑定（有时称为 ["sys" crates][sys]）。这些套件通常允许你选择使用系统上安装的 C 库，或者从源代码构建它。例如，`[openssl]` 套件具有 `[vendored]` 功能，该功能启用 `[openssl-sys]` 的相应 `[vendored]` 功能。`[openssl-sys]` 构建脚本包含一些 [条件逻辑][openssl-sys-cfg]，使其从本地复制的 OpenSSL 源代码构建，而不是使用系统版本。

`[curl-sys]` 套件是另一个例子，其中 `[static-curl]` 功能导致它从源代码构建 libcurl。请注意，它还有 `[force-system-lib-on-osx]` 功能，该功能强制 [使用系统 libcurl][curl-sys-macos-code]，从而覆盖静态-curl 设置。


## 特性优先级

某些包可能包含互斥的特性。处理此问题的一种方法是对某个特性给予优先权重。[`log`] 包就是一个例子。它拥有[多个特性][log-features]，可以在编译时选择最高的日志级别，相关说明可在[这里][log-docs]找到。它使用 [`cfg-if`] 来[确定优先级][log-cfg-if]。如果启用了多个特性，则较高的“max”级别将优先于较低的级别。


## Proc-宏 配套包

某些包包含与自身紧密相关的 proc-宏。然而，并非所有用户都需要使用该 proc-宏。通过将 proc-宏 设为可选依赖项，你可以方便地选择是否包含它。这很有帮助，因为有时 proc-宏 版本必须与父包保持同步，你不想强制用户同时指定这两个依赖项并保持同步。

一个例子是 [`serde`），它具有 [`derive`] 特性，即 [`serde_derive`] 过程宏。`serde_derive` 库与 `serde` 紧密关联，因此使用 [等于版本要求][serde-equals] 以确保两者保持同步。


## 仅适用于夜间通道的特性

某些包希望尝试使用仅在 Rust [夜间通道] 上可用的 API 或语言特性。然而，它们可能不希望要求用户同时使用夜间通道。一个例子是 [`wasm-bindgen`），它具有 [`nightly`] 特性 [wasm-bindgen-nightly]，该特性启用了一个 [扩展 API][wasm-bindgen-unsize]，该 API 使用仅在夜间通道上可用的 [`Unsize`] 标记特质。

请注意，在库的根目录中，它使用 [`cfg_attr` 来启用夜间特性][wasm-bindgen-cfg_attr]。请记住，`[feature` 属性] 与 Cargo 特性无关，用于选择实验性语言特性。

[`rand`] 包的 [`simd_support`] 特性 [rand-simd_support] 是另一个例子，它依赖于仅在夜间通道上构建的依赖项。


## 实验性特性

一些包提供了新的功能，开发者可能希望尝试这些新功能，而无需对这些 API 的稳定性负责。这些功能通常会有说明表明它们是实验性功能，因此即使在小版本更新期间也可能发生变化或失效。[`async-std`] 包就是一个例子，它包含 [`unstable` 功能][异步-std-unstable]，该功能会[限制新的 API 的使用][异步-std-gate]，用户可以选择使用这些新 API，但可能尚未完全准备好供依赖。

[`winapi`]: https://crates.io/crates/winapi
[winapi-features]: https://github.com/retep998/winapi-rs/blob/0.3.9/Cargo.toml#L25-L431
[`regex`]: https://crates.io/crates/regex
[`syn`]: https://crates.io/crates/syn
[syn-features]: https://docs.rs/syn/1.0.54/syn/#optional-features
[regex-features]: https://github.com/rust-lang/regex/blob/1.4.2/Cargo.toml#L33-L101
[regex-docs]: https://docs.rs/regex/1.4.2/regex/#crate-features
[`web-sys`]: https://crates.io/crates/web-sys
[web-sys-features]: https://github.com/rustwasm/wasm-bindgen/blob/0.2.69/crates/web-sys/Cargo.toml#L32-L1395
[`serde_json`]: https://crates.io/crates/serde_json
[serde_json-preserve_order]: https://github.com/serde-rs/json/blob/v1.0.60/Cargo.toml#L53-L56
[SemVer compatible]: features.md#semver-compatibility
[serde_json-code]: https://github.com/serde-rs/json/blob/v1.0.60/src/map.rs#L23-L26
[`indexmap`]: https://crates.io/crates/indexmap
[`no_std`]: ../../reference/names/preludes.html#the-no_std-attribute
[`wasm-bindgen`]: https://crates.io/crates/wasm-bindgen
[`std` prelude]: ../../std/prelude/index.html
[wasm-bindgen-std]: https://github.com/rustwasm/wasm-bindgen/blob/0.2.69/Cargo.toml#L25
[wasm-bindgen-default]: https://github.com/rustwasm/wasm-bindgen/blob/0.2.69/Cargo.toml#L23
[wasm-bindgen-no_std]: https://github.com/rustwasm/wasm-bindgen/blob/0.2.69/src/lib.rs#L8
[wasm-bindgen-cfg1]: https://github.com/rustwasm/wasm-bindgen/blob/0.2.69/src/lib.rs#L270-L273
[wasm-bindgen-cfg2]: https://github.com/rustwasm/wasm-bindgen/blob/0.2.69/src/lib.rs#L67-L75
[regex-re-export]: https://github.com/rust-lang/regex/blob/1.4.2/Cargo.toml#L65-L89
[regex_syntax-features]: https://github.com/rust-lang/regex/blob/1.4.2/regex-syntax/Cargo.toml#L17-L32
[`openssl`]: https://crates.io/crates/openssl
[`openssl-sys`]: https://crates.io/crates/openssl-sys
[sys]: build-scripts.md#-sys-packages
[openssl-vendored]: https://github.com/sfackler/rust-openssl/blob/openssl-v0.10.31/openssl/Cargo.toml#L19
[build script]: build-scripts.md
[openssl-sys-cfg]: https://github.com/sfackler/rust-openssl/blob/openssl-v0.10.31/openssl-sys/build/main.rs#L47-L54
[`curl-sys`]: https://crates.io/crates/curl-sys
[curl-sys-static]: https://github.com/alexcrichton/curl-rust/blob/0.4.34/curl-sys/Cargo.toml#L49
[curl-sys-macos]: https://github.com/alexcrichton/curl-rust/blob/0.4.34/curl-sys/Cargo.toml#L52
[curl-sys-macos-code]: https://github.com/alexcrichton/curl-rust/blob/0.4.34/curl-sys/build.rs#L15-L20
[`log`]: https://crates.io/crates/log
[log-features]: https://github.com/rust-lang/log/blob/0.4.11/Cargo.toml#L29-L42
[log-docs]: https://docs.rs/log/0.4.11/log/#compile-time-filters
[log-cfg-if]: https://github.com/rust-lang/log/blob/0.4.11/src/lib.rs#L1422-L1448
[`cfg-if`]: https://crates.io/crates/cfg-if
[`serde`]: https://crates.io/crates/serde
[`serde_derive`]: https://crates.io/crates/serde_derive
[serde-derive]: https://github.com/serde-rs/serde/blob/v1.0.118/serde/Cargo.toml#L34-L35
[serde-equals]: https://github.com/serde-rs/serde/blob/v1.0.118/serde/Cargo.toml#L17
[`wasm-bindgen`]: https://crates.io/crates/wasm-bindgen
[nightly channel]: ../../book/appendix-07-nightly-rust.html
[wasm-bindgen-nightly]: https://github.com/rustwasm/wasm-bindgen/blob/0.2.69/Cargo.toml#L27
[wasm-bindgen-unsize]: https://github.com/rustwasm/wasm-bindgen/blob/0.2.69/src/closure.rs#L257-L269
[`Unsize`]: ../../std/marker/trait.Unsize.html
[wasm-bindgen-cfg_attr]: https://github.com/rustwasm/wasm-bindgen/blob/0.2.69/src/lib.rs#L11
[`feature` attribute]: ../../unstable-book/index.html
[`rand`]: https://crates.io/crates/rand
[rand-simd_support]: https://github.com/rust-random/rand/blob/0.7.3/Cargo.toml#L40
[`async-std`]: https://crates.io/crates/async-std
[async-std-unstable]: https://github.com/async-rs/async-std/blob/v1.8.0/Cargo.toml#L38-L42
[async-std-gate]: https://github.com/async-rs/async-std/blob/v1.8.0/src/macros.rs#L46
