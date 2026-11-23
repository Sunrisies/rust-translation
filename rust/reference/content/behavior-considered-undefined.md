<a id="undefined"></a>
# 行为被视为未定义

<a id="undefined.intro"></a> 如果 Rust 代码出现以下列表中的任何行为，则视为错误。这包括位于 `unsafe` 块和 `unsafe` 函数中的代码。`unsafe` 仅意味着程序员需避免产生未定义行为，但这并不改变 Rust 程序绝不能引发未定义行为的事实。

<a id="undefined.soundness"></a> 在编写 `unsafe` 代码时，程序员有责任确保与 `unsafe` 代码交互的任何安全代码都不会触发这些行为。满足这一条件的 `unsafe` 代码被称为*健全*；如果 `unsafe` 代码可能被安全代码误用以产生未定义行为，则称为*不健全*。

> [!WARNING]
> The following list is not exhaustive; it may grow or shrink. There is no formal model of Rust's semantics for what is and is not allowed in unsafe code, so there may be more behavior considered unsafe. We also reserve the right to make some of the behavior in that list defined in the future. In other words, this list does not say that anything will *definitely* always be undefined in all future Rust versions (but we might make such commitments for some list items in the future).
>
> Please read the [Rustonomicon] before writing unsafe code.

<a id="undefined.race"></a> * 数据竞争。

<a id="undefined.pointer-access"></a> * 访问（从或存储到）处于[dangling]状态或基于错位指针的地址。

<a id="undefined.place-projection"></a> * 执行违反[边界内指针运算](pointer#method.offset)要求的偏移位置投影。偏移位置投影是一种[字段表达式][project-field}、[元组索引表达式][project-tuple]或[数组/切片索引表达式][project-slice]。

<a id="undefined.alias"></a> * 破坏指针别名规则。具体的别名规则尚未确定，但以下是一般原则的大纲：

  * `&T` 必须指向在活跃期间不会被修改的内存（除了位于 [`UnsafeCell<U>`]中的数据）。 * `&mut T` 必须指向在活跃期间不会被任何非引用派生指针读取或写入，且没有其他引用指向的内存（无例外情况）。 * 对于这些规则，`Box<T>` 的处理方式与 `&'static mut T` 类似。

  这些规则适用于*所有*引用和 `Box<T)`，包括存储在私有字段中的引用（例如，如果您的类型有一个类型为 `&mut T` 的私有字段，该引用必须在上述意义上唯一，直到您类型的数值处于活跃状态）。

  具体的活跃持续时间未明确说明，但存在一些界限：

  * 关于参考，活度持续时间受 借用检查器 分配的语法生命周期限制；它不能比该生命周期更“长”地保持活跃。* 每次引用或盒子被解引用或重新借用时，均视为处于活跃状态。* 每次引用或盒子被传递给函数或从函数中返回时，均视为处于活跃状态。* 当引用（而非 `Box`！）被传递给函数时，其活跃时间至少与该函数调用相同，除非 `&T` 包含 [`UnsafeCell<U>`]。

  上述规则同样适用于这些类型的值作为复合类型的嵌套字段传递的情况，但不适用于通过指针间接传递的情况。

<a id="undefined.immutable"></a> * 修改不可变字节。所有通过 [const-promoted] 表达式可访问的字节都是不可变的，以及那些在 `static` 和 `const` 初始化器中通过借用获取且被 [生命周期-extended] 为 `'static'` 的字节也是不可变的。由不可变绑定或不可变 `static` 变量拥有的字节是不可变的，除非这些字节是 [`UnsafeCell<U>`] 的一部分。

  此外，共享引用所指向的字节，包括通过其他引用（无论是共享还是可变的）和 `Box` 传递的字节，都是不可变的；这种传递性包括存储在复合类型字段中的那些引用。

  修改是指任何超过 0 字节的写入操作，且该写入与相关字节有重叠（即使该写入并未改变内存内容）。

<a id="undefined.intrinsic"></a> * 通过编译器内联特性引发未定义行为。

<a id="undefined.target-feature"></a> * 执行使用当前平台不支持的平台特性的代码（参见 [`target_feature`]），*除非* 平台明确说明这是安全的。

<a id="undefined.call"></a> * 使用错误的 [call ABI][abi] 调用函数，或超出不允许回溯的栈帧（例如通过调用作为 `"C"` 函数或函数指针导入或转换的 `"C-unwind"` 函数）。

<a id="undefined.invalid"></a> * 生成了[无效值][invalid-values]。当值被赋给某个位置、传递给函数/基本操作或从函数/基本操作返回时，都会产生该值。

<a id="undefined.asm"></a> * 对内联汇编的误用。有关更多细节，请参阅使用内联汇编编写代码时应遵循的[规则]。

<a id="undefined.runtime"></a> * 违反了 Rust 运行时的假设。目前，Rust 运行时的大部分假设并未明确文档化。* 关于与卸载相关的假设，请参见[panic documentation][unwinding-ffi]。* 运行时假设一个 Rust 栈帧在未执行栈帧所属局部变量的析构函数之前不会被释放。像 `longjmp`这样的 C 函数可能会违反这一假设。* 对于硬浮点目标平台，运行时假设舍入模式被配置为 roundTiesToEven，并且浮点异常被禁用。通过另一种语言运行的代码（如果支持）可以临时改变舍入模式和异常行为，但在返回到 Rust 代码之前必须恢复这些设置。

> [!NOTE]
> Undefined behavior affects the entire program. For example, calling a function in C that exhibits undefined behavior of C means your entire program contains undefined behaviour that can also affect the Rust code. And vice versa, undefined behavior in Rust can cause adverse affects on code executed by any FFI calls to other languages.

<a id="undefined.pointed-to"></a>
## 指向的字节

指针或引用“指向”的字节范围由指针值以及被指类型的大小决定（使用 `size_of_val`）。

<a id="undefined.misaligned"></a>
## 基于未对齐指针的位置 [基于未对齐指针]: #基于未对齐指针的位置

<a id="undefined.misaligned.ptr"></a> 如果一个位置在计算位置时最后的 `*` 投影是在一个非对齐指针上进行的，那么该位置被称为“基于未对齐指针”。（如果位置表达式中没有 `*` 投影，则是对局部或 `static` 变量的字段的访问，Rustc 会保证正确的对齐。如果有多个 `*` 投影，每个投影都会从内存中加载指向被引用对象的指针，而每次加载都受到对齐约束的限制。请注意，在 Surface Rust 语法中，由于自动解引用，某些 `*` 投影可以被省略；这里我们考虑的是完全展开的位置表达式。）

例如，如果 `ptr` 的类型为 `*const S`，其中 `S` 的对齐数为 8，那么 `ptr` 必须是对齐为 8 的，否则 `(*ptr).f` 就是“基于未对齐指针”。即使字段 `f` 的类型为 `u8`（即对齐数为 1 的类型），这也是成立的。换句话说，对齐要求源自被解引用指针的类型，而不是被访问的字段类型。

<a id="undefined.misaligned.load-store"></a> 请注意，基于未对齐指针的位置在从内存加载或存储时只会导致未定义行为。

<a id="undefined.misaligned.raw"></a> 对于这样的位置，允许使用 `&raw const`/`&raw mut` 形式。

<a id="undefined.misaligned.reference"></a> 对位置使用 `&`/`&mut` 时，需要字段类型的对齐性（否则程序会“生成无效值”），这通常比基于对齐指针的要求更宽松。

<a id="undefined.misaligned.packed"></a> 在字段类型可能比包含它的类型更对齐的情况下（即 `repr(packed)`），使用引用会导致编译器错误。这意味着基于对齐指针总是足以确保新引用是对齐的，但并不总是必要的。

<a id="undefined.dangling"></a>
## 悬垂指针 [dangling]: #dangling-pointers

<a id="undefined.dangling.def"></a> 如果引用/指针所指向的所有字节并非来自同一次有效分配，则该引用/指针为“悬空”状态（即它们必须属于*某个*分配）。

> [!NOTE]
> This implies that the dynamic size of a Rust value (as determined by `size_of_val`) must never exceed `isize::MAX`, since it is impossible for a single allocation to be larger than `isize::MAX`.

> [!NOTE]
> This also implies that if the [size is 0][zero-sized], then the pointer is trivially never "dangling" (even if it is a null pointer).

<a id="undefined.validity"></a>
## 无效值 [invalid-values]: #invalid-values

<a id="undefined.validity.def"></a> Rust 编译器假设程序执行过程中产生的所有值都是“有效”的，因此产生无效值会立即导致未定义行为。

值的有效性取决于其类型：

<a id="undefined.validity.bool"></a> * [`bool`] 值必须是 `false`（`0`）或 `true`（`1`）。

<a id="undefined.validity.fn-pointer"></a> * `fn` 指针值必须不为空。

<a id="undefined.validity.char"></a> * `char` 值不得是代理字符（即不能位于 `0xD800..=0xDFFF` 范围内），且必须等于或小于 `char::MAX`。

<a id="undefined.validity.never"></a> * `!` 值绝不能存在。

<a id="undefined.validity.scalar"></a> * 整数（`i*`/`u*`）、浮点值（`f*`）或原始指针必须被初始化，即不能从未初始化的内存中获取。

<a id="undefined.validity.str"></a> * `str` 值应像 `[u8]` 一样处理，即它必须被初始化。

<a id="undefined.validity.枚举"></a> * `enum` 必须具有有效的判别式，且该判别式所指示的变体中的所有字段在其相应类型上必须是有效的。

<a id="undefined.validity.结构体"></a> * `struct`、`tuple` 和 `array` 要求所有字段/元素在其相应类型上都是有效的。

<a id="undefined.validity.union"></a> * 对于 `union`，具体的有效性要求尚未确定。显然，在安全代码中完全创建的所有值都是有效的。如果 `union` 有一个[零大小]字段，则所有可能的取值都是有效的。更多细节正在[讨论中](https://github.com/rust-lang/不安全-code-guidelines/issues/438)。

<a id="undefined.validity.maybe-uninit"></a> * [`MaybeUninit<T>`] 始终有效（参见 [lang-types.maybe-uninit.validity]）。

<a id="undefined.validity.reference-box"></a> * 引用或 [`Box<T>`] 必须对齐且不为空，不能处于 [悬垂状态]，并且必须指向一个有效值（对于动态大小类型，则使用由 [metadata] 确定的被指对象的实际动态类型）。注意，最后一点（关于指向有效值）仍是一个存在争议的话题。

<a id="undefined.validity.wide"></a> * 宽引用、 [`Box<T>`] 或原始指针的 [metadata] 必须与 [未指定大小的尾部] 的类型匹配：* `dyn Trait` 的 [metadata] 必须是指向 `Trait` 的编译器生成的 vtable 的指针。（对于原始指针，这一要求仍是一个存在争议的话题。）* Slice (`[T]`) 和 `str` 的 [metadata] 必须是有效的 `usize`。

  此外，对于宽引用或 [`Box<T>`]，如果其 [metadata] 导致被指值的总大小（由 `size_of_val` 确定）大于 `isize::MAX`，则该 [metadata] 无效。

  > [!NOTE]
  > This bound is on the size of the entire pointed-to value, not just its unsized tail, and it constrains `dyn Trait` metadata just as it does a slice or `str` length. A valid vtable describes an erased type no larger than `isize::MAX`, but a sized prefix can still carry the total past the limit.

<a id="undefined.validity.valid-range"></a> * 如果某种类型具有自定义的有效值范围，则有效值必须位于该范围内。在标准库中，这影响了 [`NonNull<T>`] 和 [`NonZero<T>`]。

  > [!NOTE]
  > `rustc` achieves this with the unstable `rustc_layout_scalar_valid_range_*` attributes.

<a id="undefined.validity.const-provenance"></a> * **在 [const 上下文]中**：除了上述内容外，在 const 评估过程中还适用其他与来源相关的要求。任何包含纯整数数据的值（如 `i*`/`u*`/`f*` 类型以及 `bool` 和 `char`、枚举区分符和 slice [metadata]）不得携带任何来源信息。任何包含指针数据的值（引用、原始指针、函数指针和 `dyn Trait` [metadata]）必须要么不携带来源信息，要么所有字节必须是同一原始指针值的片段且顺序正确。

  这意味着，如果指针具有来源信息，则将指针（引用、原始指针或函数指针）转换为非指针类型（如整数）的行为是未定义行为。

  > [!EXAMPLE]
  > All of the following are UB:
  >
  > ```rust,compile_fail
  > # use core::mem::MaybeUninit;
  > # use core::ptr;
  > // We cannot reinterpret a pointer with provenance as an integer,
  > // as then the bytes of the integer will have provenance.
  > const _: usize = {
  >     let ptr = &0;
  >     unsafe { (&raw const ptr as *const usize).read() }
  > };
  >
  > // We cannot rearrange the bytes of a pointer with provenance and
  > // then interpret them as a reference, as then a value holding
  > // pointer data will have pointer fragments in the wrong order.
  > const _: &i32 = {
  >     let mut ptr = &0;
  >     let ptr_bytes = &raw mut ptr as *mut MaybeUninit::<u8>;
  >     unsafe { ptr::swap(ptr_bytes.add(1), ptr_bytes.add(2)) };
  >     ptr
  > };
  > ```

<a id="undefined.validity.undef"></a> **注意：** 对于任何具有有限有效值的类型，未初始化的内存也默认视为无效。换句话说，读取未初始化内存被允许的情况仅出现在 `union` 中以及“填充”（类型的字段之间的间隙）中。

[const contexts]: const-eval.const-context
[`UnsafeCell<U>`]: std::cell::UnsafeCell
[`MaybeUninit<T>`]: core::mem::MaybeUninit
[metadata]: dynamic-sized.pointer-types
[`NonNull<T>`]: core::ptr::NonNull
[`NonZero<T>`]: core::num::NonZero
[unsized tail]: dynamic-sized.tail
[zero-sized]: glossary.zst

[based on a misaligned pointer]: #places-based-on-misaligned-pointers
[dangling]: #dangling-pointers
[invalid-values]: #invalid-values
[`bool`]: types/boolean.md
[`const`]: items/constant-items.md
[abi]: items/external-blocks.md#abi
[allocation]: core::ptr#allocation
[`target_feature`]: attributes/codegen.md#the-target_feature-attribute
[Rustonomicon]: ../nomicon/index.html
[place expression context]: expressions.md#place-expressions-and-value-expressions
[rules]: inline-assembly.md#rules-for-inline-assembly
[points to]: #pointed-to-bytes
[pointed to]: #pointed-to-bytes
[project-field]: expressions/field-expr.md
[project-tuple]: expressions/tuple-expr.md#tuple-indexing-expressions
[project-slice]: expressions/array-expr.md#array-and-slice-indexing-expressions
[unwinding-ffi]: panic.md#unwinding-across-ffi-boundaries
[const-promoted]: destructors.md#constant-promotion
[lifetime-extended]: destructors.md#temporary-lifetime-extension
