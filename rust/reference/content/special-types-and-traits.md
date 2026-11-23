<a id="lang-types"></a>
# 特殊类型和特质

<a id="lang-types.intro"></a> 标准库中存在的某些类型和特质为 Rust 编译器所知。本章将介绍这些类型和特质的特殊特性。

<a id="lang-types.box"></a>
## `Box<T>`

<a id="lang-types.box.intro"></a> [`Box<T>`] 具有一些目前 Rust 不允许用户定义类型所拥有的特殊特性。

<a id="lang-types.box.deref"></a> * `Box<T>` 的 [解引用运算符] 会产生一个可以被 [移动] 的对象。这意味着 `*` 运算符和 `Box<T>` 的析构函数都是语言内置的。

<a id="lang-types.box.receiver"></a> * [方法] 可以接受 `Box<Self>` 作为接收者。

<a id="lang-types.box.fundamental"></a> * 可以在与 `T` 相同的 crate 中为 `Box<T>` 实现一个特质，而 [孤儿规则] 则禁止对其他泛型类型这样做。

<!-- Editor Note: This is nowhere close to an exhaustive list -->

<a id="lang-types.rc"></a>
## `Rc<T>`

<a id="lang-types.rc.receiver"></a> [方法] 可以接受 [`Rc<Self>`] 作为接收者。

<a id="lang-types.arc"></a>
## `Arc<T>`

<a id="lang-types.arc.receiver"></a> [方法] 可以接受 [`Arc<Self>`] 作为接收者。

<a id="lang-types.pin"></a>
## `Pin<P>`

<a id="lang-types.pin.receiver"></a> [方法] 可以接受 [`Pin<P>`] 作为接收者。

<a id="lang-types.不安全-cell"></a>
## `UnsafeCell<T>`

<a id="lang-types.不安全-cell.interior-mut"></a> [`std::cell::UnsafeCell<T>`] 用于 [内部可变性]。它确保编译器不会对此类类型进行错误的优化。

<a id="lang-types.不安全-cell.read-only-alloc"></a> 它还确保具有内部可变性的类型的 [`static` 项] 不会被存储为只读内存。

<a id="lang-types.maybe-uninit"></a>
## `MaybeUninit<T>`

<a id="lang-types.maybe-uninit.intro"></a> [`MaybeUninit<T>`] 是一种用于存放像 `T` 一样的值，但未必是有效 `T` 值的类型。在内存中分配并写入预期为 `T` 值的数据之前，当这些值在初始化时尚未成为有效的 `T` 值时，这种类型非常有用。

<a id="lang-types.maybe-uninit.validity"></a> 类型为 [`MaybeUninit<T>`] 的值始终 [有效]，无论 `T` 类型的价值有什么有效性要求。

<a id="lang-types.maybe-uninit.layout"></a> [`MaybeUninit<T>`] 保证具有与 `T` 相同的 [大小}、[对齐方式] 和 [ABI]。

<a id="lang-types.phantom-data"></a>
## `PhantomData<T>`

[`std::marker::PhantomData<T>`] 是一种 [零大小}、[1 对齐] 的类型，在 [变异性][drop check] 和 [自动特征](#auto-traits) 方面被视为拥有 `T`。

<a id="lang-types.va-list"></a>
## `VaList<'_>`

[`VaList`] 用于 [C-variadic functions]。

> [!NOTE]
> [`VaList`] is ABI compatible with the C `va_list` type; see [items.fn.c-variadic.abi-compatibility].

<a id="lang-types.ops"></a>
## 运算符特征

[`std::ops`] 和 [`std::cmp`] 中的特征用于重载 [运算符][索引表达式] 和 [调用表达式]。

<a id="lang-types.deref"></a>
## `Deref` 和 `DerefMut`

除了重载一元 `*` 运算符，`[Deref]` 和 `[DerefMut]` 还用于 [方法解析][deref coercions]。

<a id="lang-types.drop"></a>
## `Drop`

[`Drop`] 特征提供了一个 [析构函数]，当该类型的值被销毁时，该析构函数会被调用。

<a id="lang-types.copy"></a>
## `Copy`

<a id="lang-types.copy.intro"></a> [`Copy`] 特征改变了实现它的类型的语义。

<a id="lang-types.copy.behavior"></a> 类型为 `Copy` 的值在赋值时会被复制而不是移动。

<a id="lang-types.copy.constraint"></a> `Copy` 只能用于不实现 `Drop` 且所有字段均为 `Copy` 的类型。对于枚举，这意味着所有变体中的所有字段都必须是 `Copy`。对于联合类型，这意味着所有变体都必须是 `Copy`。

<a id="lang-types.copy.builtin-types"></a> 编译器为以下类型实现了 `Copy`：

<a id="lang-types.copy.tuple"></a> * [`Copy` 类型的元组]

<a id="lang-types.copy.fn-pointer"></a> * [函数指针]

<a id="lang-types.copy.fn-item"></a> * [函数项]

<a id="lang-types.copy.闭包"></a> * 捕获无值或仅捕获 `Copy` 类型值的 [闭包]

<a id="lang-types.clone"></a>
## `Clone`

<a id="lang-types.clone.intro"></a> [`Clone`] 特征是 `Copy` 的超特征，因此也需要编译器生成的实现。

<a id="lang-types.clone.builtin-types"></a> 编译器为以下类型实现了该特性：

<a id="lang-types.clone.builtin-copy"></a> * 具有内置 `Copy` 实现的类型（参见上文）

<a id="lang-types.clone.tuple"></a> * `Clone` 类型的 [元组]

<a id="lang-types.clone.闭包"></a> * 仅捕获 `Clone` 类型值或不从环境捕获任何值的 [闭包]

<a id="lang-types.send"></a>
## `Send`

[`Send`] trait 表明该类型的数值可以从一个线程安全传输到另一个线程。

<a id="lang-types.sync"></a>
## `Sync`

<a id="lang-types.sync.intro"></a> [`Sync`] trait 表明该类型的数值可以在多个线程之间共享而不产生问题。

<a id="lang-types.sync.static-constraint"></a> 此 trait 必须对所有用于不可变 [`static` 项]的类型实现。

<a id="lang-types.termination"></a>
## `Termination`

[`Termination`] trait 指定了 [主函数] 和 [测试函数] 可接受的返回类型。

<a id="lang-types.auto-traits"></a>
## Auto traits

<a id="lang-types.auto-traits.intro"></a> [`Send`], [`Sync`], [`Unpin`], [`UnwindSafe`] 和 [`RefUnwindSafe`] trait 是 _auto traits_。Auto traits 具有特殊属性。

<a id="lang-types.auto-traits.auto-实现"></a> 如果给定类型的 auto trait 没有显式实现或负面实现，则编译器会根据以下规则自动实现它：

<a id="lang-types.auto-traits.builtin-composite"></a> * `&T`, `&mut T`, `*const T`, `*mut T`, `[T; n]` 和 `[T]` 如果 `T` 存在，则实现该 trait。

<a id="lang-types.auto-traits.fn-item-pointer"></a> * 函数项类型和函数指针自动实现该 trait。

<a id="lang-types.auto-traits.aggregate"></a> * 结构体、枚举、联合类型和元组如果其所有字段都符合要求，则实现该 trait。

<a id="lang-types.auto-traits.闭包"></a> * 如果闭包的所有捕获类型均符合要求，则实现该 trait。一个通过共享引用捕获 `T` 并通过值捕获 `U` 的闭包实现了 `&T` 和 `U` 所实现的任何 auto traits。

<a id="lang-types.auto-traits.泛型-实现"></a> 对于泛型类型（将内置类型计入上述作为 `T` 的泛型类型），如果存在泛型实现，编译器不会自动为可以使用该实现的类型实现它，除非它们满足必要的 trait 边界条件。例如，标准库为所有 `&T` 实现了 `Send`，其中 `T` 是 `Sync`；这意味着如果 `T` 是 `Send` 但不是 `Sync`，编译器不会为 `&T` 实现 `Send`。

<a id="lang-types.auto-traits.negative"></a> 自动 trait 也可以有负实现，如标准库文档中的 `impl !AutoTrait for T` 所示，这些负实现会覆盖自动实现。例如 `*mut T` 具有 `Send` 的负实现，因此即使 `T` 是 `Send`，*mut T` 也不是 `Send`。目前没有稳定的方法来指定额外的负实现；它们仅存在于标准库中。

<a id="lang-types.auto-traits.trait-object-marker"></a> 自动 trait 可以作为任何 [trait object] 的额外边界添加，尽管通常只允许一个 trait。例如，`Box<dyn Debug + Send + UnwindSafe>` 是一个有效的类型。

<a id="lang-types.sized"></a>
## `Sized`

<a id="lang-types.sized.intro"></a> [`Sized`] trait 表示该类型的大小在编译时已知；即它不是 [动态大小类型]。

<a id="lang-types.sized.implicit-sized"></a> [类型参数]（除了 traits 中的 `Self`）默认为 `Sized`，[关联类型]也是如此。

<a id="lang-types.sized.implicit-实现"></a> `Sized` 总是由编译器自动实现，而不是由 [实现项] 实现。

<a id="lang-types.sized.relaxation"></a> 这些隐式的 `Sized` 边界可以通过使用特殊的 `?Sized` 边界来放宽。

[`Arc<Self>`]: std::sync::Arc
[`Deref`]: std::ops::Deref
[`DerefMut`]: std::ops::DerefMut
[`MaybeUninit<T>`]: core::mem::MaybeUninit
[`Pin<P>`]: std::pin::Pin
[`Rc<Self>`]: std::rc::Rc
[`RefUnwindSafe`]: std::panic::RefUnwindSafe
[`Termination`]: std::process::Termination
[`UnwindSafe`]: std::panic::UnwindSafe
[`Unpin`]: std::marker::Unpin
[1-aligned]: layout.properties.align
[ABI]: glossary.abi
[alignment]: layout.properties.align
[C-variadic functions]: items.fn.c-variadic
[moved from]: expr.move.movable-place
[size]: layout.properties.size
[the standard library]: std
[valid]: undefined.validity
[`VaList`]: core::ffi::VaList
[zero-sized]: glossary.zst

[Arrays]: types/array.md
[associated types]: items/associated-items.md#associated-types
[call expressions]: expressions/call-expr.md
[deref coercions]: type-coercions.md#coercion-types
[dereference operator]: expressions/operator-expr.md#the-dereference-operator
[destructor]: destructors.md
[drop check]: ../nomicon/dropck.html
[dynamically sized type]: dynamically-sized-types.md
[Function pointers]: types/function-pointer.md
[Function items]: types/function-item.md
[implementation items]: items/implementations.md
[indexing expressions]: expressions/array-expr.md#array-and-slice-indexing-expressions
[interior mutability]: interior-mutability.md
[main function]: crates-and-source-files.md#main-functions
[Methods]: items/associated-items.md#associated-functions-and-methods
[method resolution]: expressions/method-call-expr.md
[operators]: expressions/operator-expr.md
[orphan rules]: items/implementations.md#trait-implementation-coherence
[`static` items]: items/static-items.md
[test functions]: attributes/testing.md#the-test-attribute
[trait object]: types/trait-object.md
[Tuples]: types/tuple.md
[Type parameters]: types/parameters.md
[variance]: subtyping.md#variance
[Closures]: types/closure.md
