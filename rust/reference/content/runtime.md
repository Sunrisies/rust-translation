<a id="runtime"></a>
# Rust 运行时

<a id="runtime.intro"></a> 本部分介绍了定义 Rust 运行时某些特性的内容。

<!-- template:attributes -->
<a id="runtime.global_allocator"></a>
## `global_allocator` 属性

<a id="runtime.global_allocator.intro"></a> *`global_allocator` [属性][attributes]* 用于选择 [内存分配器][std::alloc]。

> [!EXAMPLE]
> ```rust
> use core::alloc::{GlobalAlloc, Layout};
> use std::alloc::System;
>
> struct MyAllocator;
>
> unsafe impl GlobalAlloc for MyAllocator {
>     unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
>         unsafe { System.alloc(layout) }
>     }
>     unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) {
>         unsafe { System.dealloc(ptr, layout) }
>     }
> }
>
> #[global_allocator]
> static GLOBAL: MyAllocator = MyAllocator;
> ```

<a id="runtime.global_allocator.syntax"></a> `global_allocator` 属性使用 [MetaWord] 语法。

<a id="runtime.global_allocator.allowed-positions"></a> `global_allocator` 属性只能应用于其类型实现了 [`GlobalAlloc`] trait的[静态项]。

<a id="runtime.global_allocator.duplicates"></a> `global_allocator` 属性在一项上只能使用一次。

<a id="runtime.global_allocator.single"></a> `global_allocator` 属性在 crate 图中只能使用一次。

<a id="runtime.global_allocator.stdlib"></a> `global_allocator` 属性从 [标准库前导模块][core::prelude::v1]导出。

<!-- template:attributes -->
<a id="runtime.windows_subsystem"></a>
## `windows_subsystem` 属性

<a id="runtime.windows_subsystem.intro"></a> *`windows_subsystem` [属性][attributes]* 在 Windows 目标上链接时设置[子系统]。

> [!EXAMPLE]
> ```rust
> #![windows_subsystem = "windows"]
> ```

<a id="runtime.windows_subsystem.syntax"></a> `windows_subsystem` 属性使用 [MetaNameValueStr] 语法。接受的值为 `"console"` 和 `"windows"`。

<a id="runtime.windows_subsystem.allowed-positions"></a> `windows_subsystem` 属性只能应用于 crate 根目录。

<a id="runtime.windows_subsystem.duplicates"></a> `windows_subsystem` 的首次使用才具有效果。

> [!NOTE]
> `rustc` lints against any use following the first. This may become an error in the future.

<a id="runtime.windows_subsystem.ignored"></a> 在非 Windows 目标和非 `bin` [crate类型]上，`windows_subsystem` 属性被忽略。

<a id="runtime.windows_subsystem.console"></a> `"console"` 子系统为默认设置。如果从现有的控制台运行控制台进程，则将其附加到该控制台；否则将创建新的控制台窗口。

<a id="runtime.windows_subsystem.windows"></a> `"windows"` 子系统将在独立于任何现有控制台的情况下运行。

> [!NOTE]
> The `"windows"` subsystem is commonly used by GUI applications that do not want to display a console window on startup.

[`GlobalAlloc`]: alloc::alloc::GlobalAlloc

[crate types]: linkage.md
[static item]: items/static-items.md
[subsystem]: https://msdn.microsoft.com/en-us/library/fcc1zstk.aspx
