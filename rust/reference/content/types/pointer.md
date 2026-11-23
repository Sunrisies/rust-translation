<a id="type.pointer"></a>
# 指针类型

<a id="type.pointer.intro"></a> 所有指针都是显式的第一类值。它们可以被移动或复制，存储到数据结构中，并从函数中返回。

<a id="type.pointer.reference"></a>
## 引用（`&` 和 `&mut`）

<a id="type.pointer.reference.syntax"></a> 
```grammar,types
ReferenceType -> `&` Lifetime? `mut`? TypeNoBounds
```

<a id="type.pointer.reference.shared"></a>
### 共享引用（`&`）

<a id="type.pointer.reference.shared.intro"></a> 共享引用指向由其他值拥有的内存。

<a id="type.pointer.reference.shared.constraint-mutation"></a> 当创建对值的共享引用时，它禁止直接修改该值。在某些情况下，[内部可变性] 提供了例外情况。顾名思义，可以对一个值存在任意数量的共享引用。共享引用类型写作 `&type`，或者当需要指定显式生命周期时写作 `&'a type`。

<a id="type.pointer.reference.shared.copy"></a> 复制引用是一种“浅层”操作：它仅涉及复制指针本身，即指针是 `Copy` 的。释放引用对它所指向的值没有影响，但对[临时值]的引用会在引用作用域内保持其存活。

<a id="type.pointer.reference.mut"></a>
### 可变引用（`&mut`）

<a id="type.pointer.reference.mut.intro"></a> 可变引用指向由其他值拥有的内存。可变引用类型写作 `&mut type` 或 `&'a mut type`。

<a id="type.pointer.reference.mut.copy"></a> 不可变引用（尚未被借用）是访问其所指值的唯一方式，因此不是 `Copy` 的。

<a id="type.pointer.raw"></a>
## 原始指针（`*const` 和 `*mut`）

<a id="type.pointer.raw.syntax"></a> 
```grammar,types
RawPointerType -> `*` ( `mut` | `const` ) TypeNoBounds
```

<a id="type.pointer.raw.intro"></a> 原始指针是没有安全或活性保证的指针。原始指针写作 `*const T` 或 `*mut T`。例如 `*const i32` 表示指向 32 位整数的原始指针。

<a id="type.pointer.raw.copy"></a> 复制或释放原始指针对任何其他值的生命周期没有影响。

<a id="type.pointer.raw.safety"></a> 解引用原始指针是一个[不安全]操作。

这也可以用于通过重新借用（使用 `&*` 或 `&mut *`）将原始指针转换为引用。通常不推荐使用原始指针；它们的存在是为了支持与外部代码的互操作性，以及编写性能关键或低级函数。

<a id="type.pointer.raw.cmp"></a> 当比较原始指针时，是根据其地址来比较的，而不是根据它们指向的内容。当比较原始指针与[动态大小类型]时，还会比较其附加数据。

<a id="type.pointer.raw.constructor"></a> 可以使用 `&raw const` 直接创建 `*const` 指针，使用 `&raw mut` 创建 `*mut` 指针作为原始指针。

<a id="type.pointer.smart"></a>
## 智能指针

标准库中除了引用和原始指针之外，还包含额外的“智能指针”类型。

<a id="type.pointer.validity"></a>
## 位有效性

<a id="type.pointer.validity.pointer-fragment"></a> 尽管指针和引用在大多数平台生成的机器代码中与 `usize` 类似，但目前将引用或指针类型转换为非指针类型的语义尚未确定。因此，将指针或引用类型 `P` 转换为 `[u8; size_of::<P>()]` 可能并不有效。

<a id="type.pointer.validity.raw"></a> 对于轻量级的原始指针（即 `P = *const T` 或 `P = *mut T`，其中 `T: Sized`），反向方向（从整数或整数数组转换为 `P`）总是有效的。然而，通过这种转换生成的指针可能无法被解引用（即使 `T` 具有[零大小）也是如此。

[size zero]: glossary.zst

[Interior mutability]: ../interior-mutability.md
[`unsafe` operation]: ../unsafety.md
[dynamically sized types]: ../dynamically-sized-types.md
[temporary value]: ../expressions.md#temporaries
