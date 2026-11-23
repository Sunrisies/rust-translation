<a id="interior-mut"></a>
# 内部可变性

<a id="interior-mut.intro"></a> 有时需要修改一个类型，同时该类型具有多个别名。在 Rust 中，可以通过一种称为_内部可变性_的模式来实现这一点。

<a id="interior-mut.shared-ref"></a> 如果一个类型的内部状态可以通过[共享引用]进行更改，则该类型具有内部可变性。

<a id="interior-mut.no-constraint"></a> 这违反了通常的[要求][ub]，即通过共享引用指向的值不得被修改。

<a id="interior-mut.不安全-cell"></a> [`std::cell::UnsafeCell<T>`]类型是禁用此要求的唯一允许方式。当`UnsafeCell<T>`具有不可变别名时，仍然可以安全地进行修改或获得对其所包含`T`的可变引用。

<a id="interior-mut.mut-不安全-cell"></a> 与其他所有类型一样，拥有多个`&mut UnsafeCell<T>`别名属于未定义行为。

<a id="interior-mut.abstraction"></a> 具有内部可性的其他类型可以通过将`UnsafeCell<T>`作为字段来创建。标准库提供了多种提供安全内部可变性 API的类型。

<a id="interior-mut.ref-cell"></a> 例如，`[std::cell::RefCell<T}>`使用运行时借用检查来确保多个引用相关的常规规则得以遵守。

<a id="interior-mut.atomic"></a> [`std::sync::atomic`]模块包含一些类型，这些类型封装了仅通过原子操作访问的值，允许该值在线程间被共享和修改。

[shared reference]: types/pointer.md#shared-references-
[ub]: behavior-considered-undefined.md
