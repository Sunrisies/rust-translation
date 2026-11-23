<a id="不安全"></a>
# `unsafe` 关键字

<a id="不安全.intro"></a> `unsafe` 关键字用于创建或履行证明某事物安全的义务。具体表现为：

- 用于标记那些*定义*了必须在其他地方遵守的额外安全条件的代码。 - 包括 `unsafe fn`、`unsafe static` 和 `unsafe trait`。 - 用于标记程序员*断言*满足其他地方定义的安全条件的代码。 - 包括 `unsafe {}`、`unsafe impl`、`unsafe fn` 不带 [`unsafe_op_in_unsafe_fn`] 提示，以及 `unsafe extern` 和 `#[unsafe(attr)]`。

以下将逐一讨论这些情况。请参考 [关键字文档][keyword] 以了解一些示例。

<a id="不安全.positions"></a> `unsafe` 关键字可以在多种不同的上下文中出现：

- 不安全 函数 (`unsafe fn`) - 不安全 块 (`unsafe {}`) - 不安全 trait (`unsafe trait`) - 不安全 trait 实现 (`unsafe impl`) - 不安全 外部块 (`unsafe extern`) - 不安全 外部静态成员 (`unsafe static`) - 不安全 属性 (`#[unsafe(attr)]`)

<a id="不安全.fn"></a>
## 不安全 函数 (`unsafe fn`)

<a id="不安全.fn.intro"></a> 不安全 函数是指在所有上下文和/或所有可能的输入情况下都不安全的函数。我们说它们具有*额外安全条件*，即所有调用者必须遵守且编译器不会检查的条件。例如，`[get_unchecked]` 具有额外的安全条件，即索引必须在边界内。不安全 函数应附带文档说明这些额外安全条件是什么。

<a id="不安全.fn.safety"></a> 这样的函数必须以 `unsafe` 关键字开头，并且只能从 `unsafe` 块内部调用，或者从没有 [`unsafe_op_in_unsafe_fn`] lint的 `unsafe fn` 内部调用。

<a id="不安全.block"></a>
## 不安全 块 (`unsafe {}`)

<a id="不安全.block.intro"></a> 代码块可以加上 `unsafe` 关键字，以允许使用 [Unsafety] 章节中定义的 不安全 操作，例如调用其他 不安全 函数或解引用原始指针。

<a id="不安全.block.fn-body"></a> 默认情况下，不安全的函数体也被视为一个不安全的块；可以通过启用 [`unsafe_op_in_unsafe_fn`] 检查来更改此行为。

通过将操作放入不安全块中，程序员表明他们已经确保该块内所有操作的额外安全条件得到满足。

不安全块与不安全函数是逻辑上的对应物：不安全函数定义了调用者必须遵守的证明义务，而不安全块则表明被调用在块内的函数或操作的所有相关证明义务均已履行。有多种方式可以履行证明义务；例如，可以在运行时进行检查或使用数据结构不变量来确保某些属性必然成立，或者不安全块可以位于 `unsafe fn` 中，在这种情况下，该块可以使用该函数的证明义务来履行块内产生的证明义务。

不安全块用于封装外部库、直接利用硬件或实现语言中未直接提供的功能。例如，Rust提供了在语言中实现内存安全并发所需的语言特性，但标准库中对线程和消息传递的实现使用不安全块。

Rust的类型系统是对动态安全要求的保守近似，因此在某些情况下使用安全代码会有性能成本。例如，双向链表不是树结构，在安全代码中只能用引用计数指针表示。通过使用 `unsafe` 块将反向链接表示为原始指针，就可以无需引用计数来实现。（有关此示例的更深入探讨，请参阅 ["Learn Rust With Entirely Too Many Linked Lists"](https://rust-unofficial.github.io/too-many-lists/)。）


<a id="不安全.trait"></a>
## 不安全特质（`unsafe trait`）

<a id="不安全.trait.intro"></a> 不安全的特质是指带有额外安全条件的特质，这些条件必须由该特质的实现者遵守。不安全的特质应附带文档说明这些额外安全条件的具体内容。

<a id="不安全.trait.safety"></a> 此类特质必须以 `unsafe` 关键字开头，并且只能由 `unsafe impl` 块来实现。

<a id="不安全.实现"></a>
## 不安全的特质实现 (`unsafe impl`)

在实现不安全的特质时，实现必须带有 `unsafe` 关键字。通过编写 `unsafe impl`，程序员表明他们已经满足了特质所需的额外安全条件。

不安全的特质实现与不安全的特质是逻辑上的对立面：不安全的特质定义了实现者必须遵守的证明义务，而不安全的实现则表明所有相关的证明义务均已履行。


<a id="不安全.extern"></a>
## 不安全的外部块 (`unsafe extern`)

<a id="不安全.extern.intro"></a> 声明 [外部块] 的程序员必须确保其中包含的项签名正确。如果做不到这一点，可能会导致未定义行为。通过编写 `unsafe extern` 可以表明该义务已得到满足。

<a id="不安全.extern.edition2024"></a> 
> [!EDITION-2024]
> Prior to edition 2024, `extern` blocks were allowed without being qualified as `unsafe`.


<a id="不安全.attribute"></a>
## 不安全的属性 (`#[unsafe(attr)]`)

[不安全的属性] 是指带有额外安全条件的属性，在使用该属性时必须遵守这些条件。编译器无法检查这些条件是否得到遵守。为了表明已遵守，这些属性必须被包裹在 `unsafe(..)` 中，例如 `#[unsafe(no_mangle)]`。

[`get_unchecked`]: slice::get_unchecked

[Unsafety]: unsafety.md
[keyword]: ../std/keyword.unsafe.html
[`unsafe_op_in_unsafe_fn`]: ../rustc/lints/listing/allowed-by-default.html#unsafe-op-in-unsafe-fn
[external block]: items/external-blocks.md
[unsafe attribute]: attributes.md
