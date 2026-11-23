## 不安全的 Rust

到目前为止，我们讨论的所有代码都遵循了 Rust 的内存安全保证，这些保证在编译时得到强制执行。然而，Rust 内部还隐藏着一种不强制内存安全保证的语言：称为 _不安全的 Rust_，它与普通 Rust 类似，但提供了额外的“超能力”。

不安全的 Rust 存在是因为静态分析本质上是保守的。当编译器试图判断代码是否遵守这些保证时，拒绝一些有效的程序比接受一些无效的程序更好。虽然代码可能没问题，但如果 Rust 编译器没有足够的信息来确信其安全性，它就会拒绝该代码。在这种情况下，你可以使用不安全代码告诉编译器：“相信我，我知道自己在做什么。”不过请注意，使用不安全的 Rust 是风险自担的：如果错误地使用不安全代码，由于内存不安全导致的问题可能会发生，例如空指针解引用。

Rust 拥有不安全的版本的另一个原因是底层计算机硬件本身就不安全。如果 Rust 不允许进行不安全的操作，你就无法完成某些任务。Rust 需要允许你进行低级系统编程，比如直接与操作系统交互或甚至编写自己的操作系统。处理低级系统编程是这种语言的目标之一。让我们来探讨一下如何使用不安全的 Rust 以及如何实现这一点。

<!-- Old headings. Do not remove or links may break. -->

<a id="unsafe-superpowers"></a>

### 使用不安全的“超能力”

要切换到不安全的 Rust，使用 `unsafe` 关键字，然后开始一个包含不安全代码的新的代码块。在不安全的 Rust 中，你可以执行在安全 Rust 中无法执行的五种操作，我们称之为 _不安全的超能力_。这些超能力包括：

1. 解引用原始指针。
2. 调用不安全的函数或方法。
3. 访问或修改可变的静态变量。
4. 实现不安全的特质。
5. 访问 `union` 的字段。

重要的是要明白，`unsafe` 并不会关闭借用检查器或禁用 Rust 的其他安全检查：如果你在 `unsafe` 代码中使用引用，它仍然会被检查。`unsafe` 关键字仅允许你访问这五个特性，而这些特性不会由编译器进行内存安全检查。你在 `unsafe` 块内仍然可以获得一定程度的安全性。

此外，`unsafe` 并不意味着块内的代码必然危险或一定会存在内存安全问题：其意图是作为程序员，你需要确保 `unsafe` 块中的代码以合法方式访问内存。

人都会犯错，错误也会发生，但通过将这五种不安全的操作放在带有 `unsafe` 注释的块中，你可以确定与内存安全相关的任何错误都必须在 `unsafe` 块内出现。保持 `unsafe` 块的小规模；当你调查内存漏洞时，你会为此感到庆幸。

为了尽可能隔离不安全的代码，最好将此类代码封装在安全的抽象结构中，并提供安全的 API，我们将在本章中讨论不安全函数和方法时进一步探讨这一点。标准库的部分内容是以经过审计的不安全代码作为安全抽象实现的。将不安全代码包裹在安全抽象结构中可以防止 `unsafe` 的使用泄露到你或你的用户可能想要使用由 `unsafe` 代码实现的功能的所有地方，因为使用安全抽象是安全的。

让我们依次看看这五种不安全的强大功能。我们还将探讨一些提供对不安全代码的安全接口的抽象结构。

### 解引用原始指针

在第4章的[“悬空引用”](dangling-references)部分中，我们提到编译器确保引用始终有效。不安全 Rust引入了两种新的类型，称为_原始指针_，它们与引用类似。与引用一样，原始指针可以是不可变的或可变的，分别表示为 `*const T` 和 `*mut T`。星号不是解引用运算符，而是类型名称的一部分。在原始指针的语境中，“_不可变_”意味着解引用后不能直接将指针赋值给其他变量。

与引用和智能指针不同，原始指针：

- 允许通过同时拥有不可变和可变指针或多个指向同一位置的可变指针来忽略借用规则 - 不保证指向有效的内存地址 - 允许为null值 - 不实现任何自动清理机制

通过放弃Rust对这些保证的强制执行，你可以放弃确定的安全性，以换取更高的性能，或者能够与不适用于Rust保证的其他语言或硬件进行交互。

清单20-1展示了如何创建不可变和可变原始指针。

<Listing number="20-1" caption="Creating raw pointers with the raw borrow operators">

```rust
{{#rustdoc_include ../listings/ch20-advanced-features/listing-20-01/src/main.rs:here}}
```

</Listing>

请注意，我们在代码中没有使用`unsafe`关键字。我们可以在安全代码中使用原始指针；只是不能在不安全的代码块之外解引用这些原始指针，正如你即将看到的那样。

我们通过使用原始借用运算符来创建原始指针：`&raw const num` 创建一个 `*const i32` 的不可变原始指针，而 `&raw mut num` 则创建一个 `*mut i32` 的可变原始指针。由于我们是直接从局部变量创建的，因此我们知道这些特定的原始指针是有效的，但我们不能对任何原始指针都做出这样的假设。

为了演示这一点，接下来我们将创建一个我们无法确定其有效性的原始指针，使用 `as` 关键字将值类型转换为原始指针，而不是使用原始借用运算符。清单 20-2 展示了如何创建指向内存中任意位置的原始指针。尝试访问随机内存是未定义的：该地址可能包含数据，也可能没有；编译器可能会优化代码以消除内存访问，或者程序可能会因段错误而终止。通常没有充分的理由编写这样的代码，尤其是在可以使用原始借用运算符的情况下，但这种情况也是可能的。

<Listing number="20-2" caption="Creating a raw pointer to an arbitrary memory address">

```rust
{{#rustdoc_include ../listings/ch20-advanced-features/listing-20-02/src/main.rs:here}}
```

</Listing>

请记住，我们可以在安全代码中创建原始指针，但不能解引用原始指针来读取被指向的数据。在清单 20-3 中，我们在需要 `unsafe` 块的地方使用了解引用运算符 `*`。

<Listing number="20-3" caption="Dereferencing raw pointers within an `unsafe` block">

```rust
{{#rustdoc_include ../listings/ch20-advanced-features/listing-20-03/src/main.rs:here}}
```

</Listing>

创建指针本身不会造成伤害；只有当我们试图访问该指针所指向的值时，才可能会遇到无效值的情况。

另外请注意，在清单 20-1 和 20-3 中，我们创建了 `*const i32` 和 `*mut i32` 原始指针，它们都指向相同的内存位置，其中 `num` 存储在其中。如果我们试图创建不可变和可变对 `num` 的引用，代码将无法编译，因为 Rust 的所有权规则不允许同时拥有可变引用和任何不可变引用。对于原始指针，我们可以创建一个可变指针和一个不可变指针指向同一位置，并通过可变指针修改数据，这可能会引发数据竞争。请小心！

尽管存在这些风险，为什么还要使用原始指针呢？一个主要应用场景是与 C 代码交互，正如我们将在下一节中看到的。另一个场景是在构建 借用检查器 无法理解的安全抽象时。我们将介绍不安全的函数，然后看一个使用不安全代码的安全抽象示例。

### 调用不安全的函数或方法

在不安全代码块中，你可以执行的第二种操作是调用不安全的函数。不安全的函数和方法看起来与常规函数和方法完全相同，但在定义的其他部分前有一个`unsafe`关键字。在此上下文中，`unsafe`关键字表示该函数有我们需要遵守的要求，因为 Rust 无法保证我们已满足这些要求。通过在 `unsafe` 代码块中调用不安全函数，意味着我们已经阅读了该函数的文档，并承担履行该函数契约的责任。

这是一个名为 `dangerous` 的不安全函数，其主体内没有任何操作：

```rust
{{#rustdoc_include ../listings/ch20-advanced-features/no-listing-01-unsafe-fn/src/main.rs:here}}
```

我们必须将 `dangerous` 函数调用在独立的 `unsafe` 代码块中。如果我们在没有 `unsafe` 代码块的情况下尝试调用 `dangerous`，将会出现错误：

```console
{{#include ../listings/ch20-advanced-features/output-only-01-missing-unsafe/output.txt}}
```

通过 `unsafe` 代码块，我们向 Rust 声明我们已经阅读了函数的文档，了解如何正确使用它，并且确认自己履行了函数的契约。

要在 `unsafe` 函数的主体中执行不安全操作，你仍然需要使用 `unsafe` 代码块，就像在常规函数中的一样。如果你忘记使用该代码块，编译器会发出警告。这有助于我们将 `unsafe` 代码块保持尽可能小，因为整个函数主体中可能不需要所有不安全操作。

#### 对不安全代码创建安全的抽象

仅仅因为某个函数包含不安全代码，并不意味着我们必须将整个函数标记为不安全。实际上，将不安全代码封装在安全函数中是一种常见的抽象方式。例如，让我们研究标准库中的 `split_at_mut` 函数，该函数需要一些不安全代码。我们将探讨如何实现它。这个安全方法定义在可变切片上：它接受一个切片，并通过按参数指定的索引分割该切片来将其分成两部分。列表 20-4 展示了如何使用 `split_at_mut`。

<Listing number="20-4" caption="Using the safe `split_at_mut` function">

```rust
{{#rustdoc_include ../listings/ch20-advanced-features/listing-20-04/src/main.rs:here}}
```

</Listing>

我们无法仅使用安全的 Rust 来实现这个函数。尝试这样的实现可能类似于清单 20-5 所示，但无法编译。为了简单起见，我们将 `split_at_mut` 作为函数而非方法实现，并且只针对 `i32` 值的切片进行实现，而不是针对通用类型 `T`。

<Listing number="20-5" caption="An attempted implementation of `split_at_mut` using only safe Rust">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch20-advanced-features/listing-20-05/src/main.rs:here}}
```

</Listing>

此函数首先获取切片的总长度。然后，通过检查参数索引是否小于或等于长度来断言该索引在切片范围内。这种断言意味着，如果我们传递一个大于拆分位置的长度的索引，函数在尝试使用该索引之前会触发 panic。

随后，我们返回一个元组中的两个可修改切片：一个从原始切片的开始到 `mid` 索引，另一个从 `mid` 到切片的末尾。

当我们尝试编译清单 20-5 中的代码时，会遇到错误：

```console
{{#include ../listings/ch20-advanced-features/listing-20-05/output.txt}}
```

Rust 的借用检查器无法理解我们正在同时借用切片的不同部分；它只知道我们两次从同一个切片中借用。借用切片的不同部分在本质上是可以接受的，因为这两个切片并不重叠，但 Rust 不够智能来识别这一点。当我们知道代码是合法的，而 Rust 却无法判断时，就到了使用不安全代码的时候了。

清单 20-6 展示了如何使用 `unsafe` 块、原始指针以及一些对不安全函数的调用来实现 `split_at_mut` 的功能。

<Listing number="20-6" caption="Using unsafe code in the implementation of the `split_at_mut` function">

```rust
{{#rustdoc_include ../listings/ch20-advanced-features/listing-20-06/src/main.rs:here}}
```

</Listing>

回想第 4 章中的 “[“The Slice Type”][the-slice-type]<!-- ignore -->”部分，切片是指向某些数据及其长度的指针。我们使用 `len` 方法获取切片的长度，使用 `as_mut_ptr` 方法访问切片的原始指针。在这种情况下，由于我们有一个针对 `i32` 值的可修改切片，`as_mut_ptr` 返回了一个类型为 `*mut i32` 的原始指针，我们将其存储在变量 `ptr` 中。

我们保持断言认为 `mid` 索引在切片范围内。然后，我们进入不安全的代码：`slice::from_raw_parts_mut` 函数接受一个原始指针和长度，并创建一个切片。我们使用此函数创建一个从 `ptr` 开始且长度为 `mid` 个元素的切片。接着，我们将 `mid` 作为参数调用 `ptr` 的 `add` 方法，得到一个以 `mid` 开始的原始指针，并使用该指针以及 `mid` 之后的剩余元素数量来创建切片。

`slice::from_raw_parts_mut` 函数是不安全的，因为它接受一个原始指针，必须相信该指针是有效的。对原始指针的 `add` 方法也是不安全的，因为必须相信偏移位置也是一个有效的指针。因此，我们在调用 `slice::from_raw_parts_mut` 和 `add` 时添加了一个 `unsafe` 块，以便能够调用它们。通过查看代码并加入断言 `mid` 必须小于或等于 `len`，我们可以确定 `unsafe` 块中使用的所有原始指针都是切片内数据的有效指针。这是使用 `unsafe` 的一种可接受且适当的做法。

请注意，我们不需要将生成的 `split_at_mut` 函数标记为 `unsafe`，并且可以在安全的 Rust 环境中调用此函数。我们为不安全代码创建了一个安全的抽象层，通过以安全方式实现使用 `unsafe` 代码的函数，因为它仅从该函数可访问的数据创建有效的指针。

相比之下，在列表 20-7 中使用 `slice::from_raw_parts_mut` 可能会在切片被使用时导致程序崩溃。此代码接受一个任意内存位置，并创建一个长度为 10,000 个元素的切片。

<Listing number="20-7" caption="Creating a slice from an arbitrary memory location">

```rust
{{#rustdoc_include ../listings/ch20-advanced-features/listing-20-07/src/main.rs:here}}
```

</Listing>

我们并不拥有该任意位置的记忆体，也没有保证此代码创建的切片包含有效的 `i32` 值。试图将 `values` 当作一个有效的切片使用会导致未定义行为。

#### 使用 `extern` 函数调用外部代码

有时你的 Rust 代码可能需要与另一种语言的代码进行交互。为此，Rust 提供了 `extern` 关键字，用于创建和使用 _外部函数接口 (FFI)_，这是一种编程语言定义函数并让其他（外部）语言调用这些函数的方式。

清单 20-8 展示了如何与 C 标准库中的 `abs` 函数进行集成。在 `extern` 块中声明的函数通常从 Rust 代码中调用是不安全的，因此 `extern` 块也必须标记为 `unsafe`。原因是其他语言不强制执行 Rust 的规则和保证，而 Rust 也无法检查这些规则，所以责任在于程序员来确保安全性。

<Listing number="20-8" file-name="src/main.rs" caption="Declaring and calling an `extern` function defined in another language">

```rust
{{#rustdoc_include ../listings/ch20-advanced-features/listing-20-08/src/main.rs}}
```

</Listing>

在 `unsafe extern "C"` 块中，我们列出想要调用的外部函数的名称和签名。 `"C"` 部分定义了外部函数使用的 _应用程序二进制接口 (ABI)_：ABI 规定了在汇编级别如何调用该函数。`"C"` ABI 是最常见的类型，遵循 C 编程语言의 ABI。关于 Rust 支持的所有 ABI 的信息可在 [Rust 参考手册][ABI] 中找到。

在 `unsafe extern` 块中声明的每个项都默认是不安全的。然而，某些 FFI 函数是可以安全调用的。例如，C 标准库中的 `abs` 函数没有内存安全性问题，我们知道它可以使用任何 `i32` 值调用。在这种情况下，我们可以使用 `safe` 关键字来表明该特定函数即使位于 `unsafe extern` 块中也是安全的。一旦做出这种修改，调用它就不再需要 `unsafe` 块了，如清单 20-9 所示。

<Listing number="20-9" file-name="src/main.rs" caption="Explicitly marking a function as `safe` within an `unsafe extern` block and calling it safely">

```rust
{{#rustdoc_include ../listings/ch20-advanced-features/listing-20-09/src/main.rs}}
```

</Listing>

将函数标记为 `safe` 并不自动使其安全！相反，这就像你向 Rust 做出的承诺，表明它是安全的。确保这个承诺得到履行仍然属于你的责任！

#### 从其他语言调用 Rust 函数

我们还可以使用 `extern` 来创建接口，使其他语言能够调用 Rust 函数。无需创建整个 `extern` 块，只需在相关函数的 `fn` 关键字之前添加 `extern` 关键字并指定要使用的 ABI。我们还需要添加 `#[unsafe(no_mangle)]` 注解，以告诉 Rust 编译器不要对该函数名称进行混淆处理。_混淆处理_是指编译器将我们给函数的名称改为包含更多信息、但可读性较低的名称，以便编译过程的其他部分使用。每种编程语言编译器对名称的混淆处理方式略有不同，因此为了让其他语言能够识别 Rust 函数，我们必须禁用 Rust 编译器的名称混淆功能。这是不安全的，因为在没有内置混淆处理的情况下，不同库之间可能会出现名称冲突，因此确保我们选择的名称在未经混淆处理时安全导出是我们的责任。

在以下示例中，我们在 C 代码被编译成共享库后，通过链接方式将其与 C 代码连接，从而使 `call_from_c` 函数对 C 代码可访问：

```
#[unsafe(no_mangle)]
pub extern "C" fn call_from_c() {
    println!("Just called a Rust function from C!");
}
```

这种使用 `extern` 的方式仅在注解中需要 `unsafe`，而 `extern` 块本身不需要。

### 访问或修改可变静态变量

在本书中，我们尚未讨论全局变量，虽然 Rust 支持全局变量，但按照 Rust 的拥有规则，这可能会带来问题。如果两个线程同时访问同一个可变全局变量，就可能导致数据竞争。

在 Rust 中，全局变量被称为_静态_变量。图 20-10 展示了以字符串切片为值的静态变量的示例声明和用法。

<Listing number="20-10" file-name="src/main.rs" caption="Defining and using an immutable static variable">

```rust
{{#rustdoc_include ../listings/ch20-advanced-features/listing-20-10/src/main.rs}}
```

</Listing>

静态变量与常量类似，我们在第 3 章的“[定义常量][constants]<!-- ignore -->”部分讨论过。按照惯例，静态变量的名称采用 `SCREAMING_SNAKE_CASE` 格式。静态变量只能存储具有 `'static` 生命周期的引用，这意味着 Rust 编译器可以自动确定生命周期，因此无需显式标注。访问不可变的静态变量是安全的。

常数与不可变的静态变量之间的一个微妙区别在于，静态变量中的值在内存中具有固定的地址。使用该值总是可以访问相同的数据。而常数则允许在使用时复制其数据。另一个区别是静态变量可以是可变的。访问和修改可变的静态变量是_不安全的_。清单 20-11 展示了如何声明、访问和修改名为 `COUNTER` 的可变静态变量。

<Listing number="20-11" file-name="src/main.rs" caption="Reading from or writing to a mutable static variable is unsafe.">

```rust
{{#rustdoc_include ../listings/ch20-advanced-features/listing-20-11/src/main.rs}}
```

</Listing>

与常规变量一样，我们使用 `mut` 关键字来指定可变性。任何从 `COUNTER` 读取或写入数据的代码必须位于 `unsafe` 块中。由于该代码是单线程的，清单 20-11 中的代码可以编译并输出 `COUNTER: 3`，正如我们所期望的那样。如果多个线程访问 `COUNTER`，则很可能导致数据竞争，因此属于未定义行为。因此，我们必须将整个函数标记为 `unsafe`，并记录安全限制，以便调用者知道他们不能安全地执行某些操作。

每当编写不安全的函数时，使用以 `SAFETY` 开头的注释来解释调用者如何安全调用该函数是符合惯例的。同样，每当执行不安全的操作时，使用以 `SAFETY` 开头的注释来解释如何遵守安全规则也是符合惯例的。

此外，编译器默认会拒绝通过编译器lint工具创建对可变静态变量的引用。您必须明确选择放弃该 lint 保护，添加 `#[allow(static_mut_refs)]` 注解，或者通过一些原始借用运算符创建的原始指针来访问可变静态变量。这包括那些不可见地创建引用的情况，例如在此代码清单中的 `println!` 用法。要求通过原始指针创建对静态可变变量的引用有助于使使用它们时的安全要求更加明显。

由于可变数据在全局范围内可访问，很难确保不会出现数据竞争，因此 Rust 认为可变静态变量是不安全的。在可能的情况下，最好使用第16章中讨论的并发技术和线程安全智能指针，以便编译器能够检查不同线程对数据的访问是安全的。

### 实现不安全的特质

我们可以使用 `unsafe` 来实现不安全的特质。当一个特质的至少一个方法具有编译器无法验证的不变量时，该特质就是不安全的。我们通过在 `trait` 前添加 `unsafe` 关键字，并将特质的实现标记为 `unsafe`，从而声明该特质为 `unsafe`，如清单 20-12 所示。

<Listing number="20-12" caption="Defining and implementing an unsafe trait">

```rust
{{#rustdoc_include ../listings/ch20-advanced-features/listing-20-12/src/main.rs:here}}
```

</Listing>

通过使用 `unsafe impl`，我们承诺会遵守编译器无法验证的不变量。

例如，回想一下第16章中的 [“利用 `Send` 和 `Sync` 实现可扩展并发”][send-and-sync]<!-- ignore --> 部分提到的 `Send` 和 `Sync` 标记特质：如果我们的类型完全由实现 `Send` 和 `Sync` 的其他类型组成，编译器会自动实现这些特质。如果我们实现一个包含未实现 `Send` 或 `Sync` 的类型的类型，例如原始指针，并且希望将该类型标记为 `Send` 或 `Sync`，则必须使用 `unsafe`。Rust 无法验证我们的类型是否能够安全地在线程间传递或从多个线程访问；因此，我们需要手动进行这些检查，并用 `unsafe` 表示出来。

### 访问联合的字段

仅适用于 `unsafe` 的最后一种操作是访问联合的字段。*联合*类似于 `struct`，但在特定实例中一次只使用一个声明的字段。联合主要用于与 C 代码中的联合进行交互。访问联合字段是不安全的，因为 Rust 无法保证当前存储在联合实例中的数据类型。您可以在 [Rust 参考手册][unions] 中了解有关联合的更多信息。

### 使用 Miri 检查不安全代码

在编写不安全的代码时，你可能希望检查所写的代码是否真正安全且正确。实现这一目的的最佳方式之一是使用 Miri，这是 Rust 官方工具，用于检测未定义行为。虽然 借用检查器 是一种在编译时工作的_静态_工具，但 Miri 是运行时的_动态_工具。它通过运行你的程序或其测试套件来检查代码，并识别你违反 Rust 运行规则的地方。

使用 Miri 需要 Rust 的 nightly 版本（我们将在[附录 G：Rust 的制造过程与“Nightly Rust”][nightly]<!-- ignore -->中进一步讨论）。你可以通过输入 `rustup +nightly component add miri` 来同时安装 nightly 版本的 Rust 和 Miri 工具。这不会改变你的项目使用的 Rust 版本；它只是将该工具添加到你的系统中，以便你在需要时使用它。你可以在项目中运行 Miri 通过输入 `cargo +nightly miri run` 或 `cargo +nightly miri test`。

作为一个实例说明其重要性，让我们看看当对 Listing 20-7 使用 Miri 时会发生什么。

```console
{{#include ../listings/ch20-advanced-features/listing-20-07/output.txt}}
```

Miri 正确地警告我们正在将整数转换为指针，这可能会出现问题，但 Miri 无法确定是否存在问题，因为它不知道指针的来源。然后，Miri 返回了一个错误，因为 Listing 20-7 存在未定义行为，因为我们有一个悬空指针。多亏了 Miri，我们现在知道存在未定义行为的风险，并且可以思考如何使代码安全。在某些情况下，Miri 甚至可以提供关于如何修复错误的建议。

Miri 无法捕捉到在编写不安全代码时可能犯的所有错误。由于 Miri 是动态分析工具，它只能捕获实际运行时的问题。这意味着你需要结合良好的测试技术来使用它，以提高对所写不安全代码的信心。此外，Miri 也无法涵盖代码所有可能出现的不良情况。

换句话说：如果 Miri 确实能捕获问题，那么显然存在错误；但仅仅因为 Miri 不能捕获问题，并不意味着没有问题。不过它确实可以捕获很多问题。尝试在本章中的其他不安全代码示例上运行它，看看它的输出是什么！

你可以在 [Miri 的 GitHub 仓库](miri) 了解更多关于 Miri 的信息。

<!-- Old headings. Do not remove or links may break. -->

<a id="when-to-use-unsafe-code"></a>

### 正确使用不安全代码

使用 `unsafe` 来利用刚才讨论的五种超能力之一并不错误，甚至也不被反对，但让 `unsafe` 代码正确运行却更为困难，因为编译器无法确保内存安全。当你有理由使用 `unsafe` 代码时，你可以这样做；加上明确的 `unsafe` 注释可以更容易地追踪问题来源。每当你编写不安全代码时，可以使用 Miri 来让你更有信心地相信所写的代码符合 Rust 的规则。

要更深入地了解如何有效处理不安全的 Rust，请阅读 Rust 关于 `unsafe` 的官方指南 [The Rustonomicon][nomicon]。

[dangling-references]: ch04-02-references-and-borrowing.html#dangling-references
[ABI]: ../reference/items/external-blocks.html#abi
[constants]: ch03-01-variables-and-mutability.html#declaring-constants
[send-and-sync]: ch16-04-extensible-concurrency-sync-and-send.html
[the-slice-type]: ch04-03-slices.html#the-slice-type
[unions]: ../reference/items/unions.html
[miri]: https://github.com/rust-lang/miri
[editions]: appendix-05-editions.html
[nightly]: appendix-07-nightly-rust.html
[nomicon]: https://doc.rust-lang.org/nomicon/
