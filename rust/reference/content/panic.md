<a id="panic"></a>
# 崩溃

<a id="panic.intro"></a> Rust 提供了一种机制，防止函数正常返回，而是“崩溃”，这是对通常无法在遇到错误时恢复的错误条件的响应。

<a id="panic.lang-ops"></a> 某些语言结构，例如超出边界的 [数组索引]，会自动触发崩溃。

<a id="panic.control"></a> 还有一些语言特性可以控制崩溃行为：

* [_崩溃处理程序_][panic handler] 定义了崩溃的行为。 * [FFI ABIs](items/functions.md#unwinding) 可能会改变崩溃的行为方式。

> [!NOTE] > 标准库提供了通过 [`panic!` 宏][panic!] 显式触发崩溃的功能。

<a id="panic.panic_handler"></a>
## `panic_handler` 属性

<a id="panic.panic_handler.intro"></a> *`panic_handler` 属性* 可以应用于函数，以定义崩溃的行为。

<a id="panic.panic_handler.allowed-positions"></a> `panic_handler` 属性只能应用于具有签名 `fn(&PanicInfo) -> !` 的函数。

> [!NOTE] > [`PanicInfo`] 结构体包含有关崩溃位置的信息。

<a id="panic.panic_handler.unique"></a> 依赖图中必须存在唯一的 `panic_handler` 函数。

下面展示了一个 `panic_handler` 函数，该函数在记录崩溃消息后停止线程运行。

<!-- ignore: test infrastructure can't handle no_std -->
```rust,ignore
#![no_std]

use core::fmt::{self, Write};
use core::panic::PanicInfo;

struct Sink {
    // ..
#    _0: (),
}
#
# impl Sink {
#     fn new() -> Sink { Sink { _0: () }}
# }
#
# impl fmt::Write for Sink {
#     fn write_str(&mut self, _: &str) -> fmt::Result { Ok(()) }
# }

#[panic_handler]
fn panic(info: &PanicInfo) -> ! {
    let mut sink = Sink::new();

    // logs "panicked at '$reason', src/main.rs:27:4" to some `sink`
    let _ = writeln!(sink, "{}", info);

    loop {}
}
```

<a id="panic.panic_handler.std"></a>
### 标准行为

<a id="panic.panic_handler.std.kinds"></a> `std` 提供两种不同的崩溃处理程序：

* `unwind` --- 展开栈并可能恢复。 * `abort` ---- 终止进程且无法恢复。

并非所有目标都能提供 `unwind` 处理程序。

> [!NOTE] > 与 `std` 链接时使用的崩溃处理程序可以通过 [`-C panic`] CLI 标志来设置。大多数目标的默认设置为 `unwind`。 > > 标准库的崩溃行为可以在运行时通过 [`std::panic::set_hook`] 函数进行修改。

<a id="panic.panic_handler.std.no_std"></a> 链接 `[no_std]` 二进制文件、dylib、cdylib 或 staticlib 时，需要指定自己的崩溃处理程序。

<a id="panic.strategy"></a>
## 恐慌策略

<a id="panic.strategy.intro"></a> _恐慌策略_ 定义了库所支持类型的恐慌行为。

> [!NOTE] > 可以通过 [`-C panic`] CLI 标志在 `rustc` 中选择恐慌策略。> > 当生成二进制文件、dylib、cdylib 或 staticlib，并链接 `std` 时，`-C panic` CLI 标志也会影响使用的 [恐慌处理程序]。

> [!NOTE] > 使用 `abort` 恐慌策略编译代码时，优化器可能假设在 Rust 帧之间进行回溯是不可能的，这可以带来代码大小和运行速度的提升。

> [!NOTE] > 关于链接具有不同恐慌策略的库的限制，请参见 [link.unwinding]。这意味着使用 `unwind` 策略构建的库可以使用 `abort` 恐慌处理程序，但 `abort` 策略不能使用 `unwind` 恐慌处理程序。

<a id="panic.unwind"></a>
## 回溯

<a id="panic.unwind.intro"></a> 恐慌可能是可恢复的或不可恢复的，不过可以通过选择非回溯恐慌处理程序来始终设置为不可恢复。（反之则不成立：`unwind` 处理程序并不保证所有恐慌都是可恢复的，只保证通过 `panic!` 宏和类似标准库机制发生的恐慌是可恢复的。）

<a id="panic.unwind.destruction"></a> 当发生恐慌时，`unwind` 处理程序会“回溯”Rust 帧，就像 C++ 的 `throw` 回溯 C++ 帧一样，直到恐慌达到恢复点（例如线程边界）。这意味着当恐慌遍历 Rust 帧时，那些帧中的活对象将调用其 `drop` 方法。因此，当正常执行恢复时，不再可访问的对象将会被“清理”掉，就像它们正常超出作用域一样。

> [!NOTE] > 只要保持这种资源清理的保证，“回溯”可以无需实际使用 C++ 针对目标平台使用的机制来实现。

> [!NOTE] > 标准库提供了两种应对恐慌的机制：`std::panic::catch_unwind`（可在恐慌线程内恢复）和`std::thread::spawn`（自动为子线程设置恐慌恢复机制，使其他线程能够继续运行）。

<a id="panic.unwind.ffi"></a>
### 跨 FFI 边界的恢复

<a id="panic.unwind.ffi.intro"></a> 可以使用 [适当的 ABI 声明][unwind-abi] 在 FFI 边界之间进行恢复。虽然在某些情况下很有用，但这会引入未定义行为的风险，尤其是在涉及多种语言运行时时。

<a id="panic.unwind.ffi.undefined"></a> 使用错误的 ABI 进行恢复属于未定义行为：

* 当通过函数声明或带有非恢复性 ABI 的指针调用的外部函数导致恢复进入 Rust 代码时，例如 `"C"`、`"system"` 等（例如，当用 C++ 编写的此类函数抛出未被捕获的异常并传播到 Rust 时）。 * 调用从不支持恢复的代码中调用的 Rust `extern` 函数，例如使用 GCC 或 Clang 编译时添加 `-fno-exceptions` 选项的代码。

<a id="panic.unwind.ffi.catch-foreign"></a> 使用 [`std::panic::catch_unwind`]`、`std::thread::JoinHandle::join` 或让恢复超出 Rust `main()` 函数或线程根时，捕获外部恢复操作（如 C++ 异常），会有两种行为之一，具体哪种行为发生是未指定的：

* 进程终止。 * 函数返回包含不透明类型的 [`Result::Err`]。

> [!NOTE] > 为了满足此保证，使用不同版本的 Rust 标准库编译或链接的 Rust 代码被视为“外部异常”。因此，使用 `panic!` 并链接到某一版本 Rust 标准库的库，在使用不同版本标准库的应用程序中调用时，即使该库仅在子线程中使用，也可能导致整个应用程序终止。

<a id="panic.unwind.ffi.dispose-panic"></a> 目前无法保证当外部运行时尝试释放或重新抛出 Rust `panic` 负载时会发生什么行为。换句话说，源自 Rust 运行时的恢复机制必须导致进程终止或被同一运行时捕获。

[`PanicInfo`]: core::panic::PanicInfo

[`-C panic`]: ../rustc/codegen-options/index.html#panic
[`no_std`]: names/preludes.md#the-no_std-attribute
[array indexing]: expressions/array-expr.md#array-and-slice-indexing-expressions
[attribute]: attributes.md
[destructors]: destructors.md
[panic handler]: #the-panic_handler-attribute
[runtime]: runtime.md
[unwind-abi]: items/functions.md#unwinding
