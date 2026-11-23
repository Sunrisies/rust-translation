<a id="dynamic-sized"></a>
# 动态大小类型

<a id="dynamic-sized.intro"></a> 大多数类型在编译时已知固定大小，并实现了 [`Sized`][sized] trait。仅在运行时才知道大小的类型称为_动态大小类型_ (_DST_)或非正式地称为未指定大小类型。[切片], [trait对象]和[字符串]就是<abbr title="动态大小类型">DSTs</abbr>的例子。

<a id="dynamic-sized.restriction"></a> 此类类型只能在某些情况下使用：

<a id="dynamic-sized.pointer-types"></a> * [指针类型]指向<abbr title="动态大小类型">DSTs</abbr>的大小是确定的，但其大小是指向有固定大小类型的指针的两倍，因为它们还存储*元数据*：* 指向切片的指针存储元素数量；指向[字符串]的指针存储以字节为单位的长度。* 指向trait对象的指针存储对vtable的指针。* 指向带有[未指定大小尾部]的结构或元组의指针也存储与该尾部指针相同的元数据。

<a id="dynamic-sized.question-sized"></a> * <abbr title="动态大小类型">DSTs</abbr>可以作为具有特殊`?Sized`边界的泛型类型参数的类型参数。当相应的关联类型声明具有`?Sized`边界时，它们也可以用于关联类型定义。默认情况下，任何类型参数或关联类型都具有`Sized`边界，除非使用`?Sized`进行放宽。

<a id="dynamic-sized.trait-实现"></a> * 可以为<abbr title="动态大小类型">DSTs</abbr>实现trait。与泛型类型参数不同，在trait定义中默认为`Self: ?Sized`。

<a id="dynamic-sized.结构体-field"></a> * 结构可以包含作为最后一个字段的<abbr title="动态大小类型">DST</abbr>，这使得结构本身成为<abbr title="动态大小类型">DST</abbr>。

> [!NOTE] > [变量], 函数参数, [const]项 và [static]项必须是`Sized`的。

<a id="dynamic-sized.tail"></a> 类型的*无大小尾部*是指类型指针的[元数据]所描述的动态大小组件。一个[切片](`[T]`)和一个 [`str`]各自具有由长度描述的无大小尾部；一个[trait对象](`dyn Trait`)也有其自身由指向vtable的指针描述的无大小尾部。当结构体（每个[dynamic-sized.结构体-field]）或元组具有无大小最后一个字段时，其无大小尾部就是该字段的无大小尾部。有大小类型没有无大小尾部。

[metadata]: dynamic-sized.pointer-types
[unsized tail]: dynamic-sized.tail

[sized]: special-types-and-traits.md#sized
[Slices]: types/slice.md
[slice]: types/slice.md
[str]: types/str.md
[`str`]: types/str.md
[trait objects]: types/trait-object.md
[trait object]: types/trait-object.md
[Pointer types]: types/pointer.md
[Variables]: variables.md
[const]: items/constant-items.md
[static]: items/static-items.md
