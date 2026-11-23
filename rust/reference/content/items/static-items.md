<a id="items.static"></a>
# 静态项

<a id="items.static.syntax"></a> 
```grammar,items
StaticItem ->
    ItemSafety?[^extern-safety] `static` `mut`? IDENTIFIER `:` Type ( `=` Expression )? `;`
```


<a id="items.static.intro"></a> *静态项*类似于 [常量]，不同之处在于它代表程序中的分配，并通过初始化表达式进行初始化。所有对静态项的引用和原始指针都指向同一分配。

<a id="items.static.生命周期"></a> 静态项具有 `static` 生命周期，其寿命超过 Rust 程序中所有其他生命周期。静态项在程序结束时不会调用 [`drop`]。

<a id="items.static.storage-disjointness"></a> 如果 `static` 的大小至少为 1 字节，则该分配与其他此类 `static` 分配以及堆分配和栈分配变量不重叠。然而，不可变 `static` 项的存储可能会与没有唯一地址的分配重叠，例如 [promoteds] 和 [`const` 项][constant]。

<a id="items.static.namespace"></a> 静态声明在所在模块或块的 [value 命名空间] 中定义一个静态值。

<a id="items.static.init"></a> 静态初始化器是在编译时评估的 [常量表达式]。静态初始化器可以引用并读取其他静态项。当从可变静态项读取时，它们读取该静态的初始值。

<a id="items.static.read-only"></a> 非 `mut` 静态项如果包含不是 [内部可变] 的类型，可以放在只读内存中。

<a id="items.static.safety"></a> 对静态项的所有访问都是安全的，但静态项有一些限制：

<a id="items.static.sync"></a> *类型必须具有 [`Sync`](std::marker::Sync) trait 约束以允许线程安全访问。

<a id="items.static.init-omission"></a> [外部块]中的初始化表达式必须省略，而自由静态项则必须提供初始化表达式。

<a id="items.static.safety-qualifiers"></a> `safe` 和 `unsafe` 限定符仅在 [外部块]中使用时具有语义意义。

<a id="items.static.generics"></a>
## 静态项与泛型

在通用作用域中定义的静态项（例如在默认实现中）将恰好定义一个静态项，就像该静态定义从当前作用域被提取到模块中一样。每个单态化不会产生一个独立的静态项。

此代码：

```rust
use std::sync::atomic::{AtomicUsize, Ordering};

trait Tr {
    fn default_impl() {
        static COUNTER: AtomicUsize = AtomicUsize::new(0);
        println!("default_impl: counter was {}", COUNTER.fetch_add(1, Ordering::Relaxed));
    }

    fn blanket_impl();
}

struct Ty1 {}
struct Ty2 {}

impl<T> Tr for T {
    fn blanket_impl() {
        static COUNTER: AtomicUsize = AtomicUsize::new(0);
        println!("blanket_impl: counter was {}", COUNTER.fetch_add(1, Ordering::Relaxed));
    }
}

fn main() {
    <Ty1 as Tr>::default_impl();
    <Ty2 as Tr>::default_impl();
    <Ty1 as Tr>::blanket_impl();
    <Ty2 as Tr>::blanket_impl();
}
```

prints

```text
default_impl: counter was 0
default_impl: counter was 1
blanket_impl: counter was 0
blanket_impl: counter was 1
```

<a id="items.static.mut"></a>
## 可修改的静态变量

<a id="items.static.mut.intro"></a> 如果使用 `mut` 关键字声明一个静态项，则程序可以对其进行修改。Rust 的目标之一是减少并发错误，显然这是产生竞争条件或其他错误的常见原因。

<a id="items.static.mut.safety"></a> 因此，在读取或写入可修改的静态变量时需要使用 `unsafe` 块。必须注意确保对可修改静态变量的修改对于同一进程中的其他线程是安全的。

<a id="items.static.mut.extern"></a> 不过，可修改的静态变量仍然非常有用。它们可以与 C 库一起使用，并且可以通过 `extern` 块从 C 库中引用。

```rust
# fn atomic_add(_: *mut u32, _: u32) -> u32 { 2 }

static mut LEVELS: u32 = 0;

// This violates the idea of no shared state, and this doesn't internally
// protect against races, so this function is `unsafe`
unsafe fn bump_levels_unsafe() -> u32 {
    unsafe {
        let ret = LEVELS;
        LEVELS += 1;
        return ret;
    }
}

// As an alternative to `bump_levels_unsafe`, this function is safe, assuming
// that we have an atomic_add function which returns the old value. This
// function is safe only if no other code accesses the static in a non-atomic
// fashion. If such accesses are possible (such as in `bump_levels_unsafe`),
// then this would need to be `unsafe` to indicate to the caller that they
// must still guard against concurrent access.
fn bump_levels_safe() -> u32 {
    unsafe {
        return atomic_add(&raw mut LEVELS, 1);
    }
}
```

<a id="items.static.mut.sync"></a> 可修改的静态变量具有与普通静态变量相同的限制，只是类型不需要实现 `Sync` 特性。

<a id="items.static.alternate"></a>
## 使用静态项或常量

是否应该使用常量项还是静态项可能会令人困惑。通常应优先选择常量，除非满足以下情况：

* 存储大量数据。 * 需要静态项的单地址特性。 * 需要内部可修改性。

[constant]: constant-items.md
[`drop`]: ../destructors.md
[constant expression]: ../const_eval.md#constant-expressions
[external block]: external-blocks.md
[interior mutable]: ../interior-mutability.md
[value namespace]: ../names/namespaces.md
[promoteds]: ../destructors.md#constant-promotion
