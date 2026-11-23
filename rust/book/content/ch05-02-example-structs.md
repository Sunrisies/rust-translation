## 一个使用结构体的示例程序

为了了解何时需要使用结构体，让我们编写一个计算矩形面积的程序。我们将从使用单个变量开始，然后逐步重构程序以使用结构体。

让我们使用 Cargo 创建一个名为 _rectangles_ 的新二进制项目，该项目将接收以像素为单位指定的矩形的宽度和高度，并计算其面积。列表 5-8 展示了我们在项目的 _src/main.rs_ 中实现这一功能的简短程序。

<Listing number="5-8" file-name="src/main.rs" caption="Calculating the area of a rectangle specified by separate width and height variables">

```rust
{{#rustdoc_include ../listings/ch05-using-structs-to-structure-related-data/listing-05-08/src/main.rs:all}}
```

</Listing>

现在，使用 `cargo run` 运行此程序：

```console
{{#include ../listings/ch05-using-structs-to-structure-related-data/listing-05-08/output.txt}}
```

这段代码通过调用 `area` 函数并传入每个维度参数来成功计算矩形面积，但我们可以进一步改进代码使其更清晰易读。

该代码的问题在于 `area` 函数的签名：

```rust,ignore
{{#rustdoc_include ../listings/ch05-using-structs-to-structure-related-data/listing-05-08/src/main.rs:here}}
```

`area` 函数应该用于计算一个矩形的面积，但我们编写的该函数有两个参数，且程序中没有任何地方表明这两个参数是相关的。将宽度和高度合并在一起会更具可读性且更易管理。我们已经在第三章的 [“元组类型”][the-tuple-type]<!-- ignore --> 部分讨论过一种实现方法：使用元组。

### 使用元组进行重构

列表 5-9 展示了我们使用元组的另一种程序版本。

<Listing number="5-9" file-name="src/main.rs" caption="Specifying the width and height of the rectangle with a tuple">

```rust
{{#rustdoc_include ../listings/ch05-using-structs-to-structure-related-data/listing-05-09/src/main.rs}}
```

</Listing>

从某种意义上说，这个程序更好。元组让我们增加了一些结构性，现在只需传递一个参数即可。但从另一个角度来看，这种版本不够清晰：元组不命名其元素，因此我们必须通过索引访问元组中的各个部分，使得计算过程不太明显。

混淆宽度和高度对面积计算没有影响，但如果要在屏幕上绘制矩形，就会产生影响！我们必须记住 `width` 是元组的索引 `0`，`height` 是元组的索引 `1`。对于其他人来说，理解并记住这一点会更加困难，如果他们使用我们的代码的话。由于我们在代码中没有传达数据的含义，现在更容易出现错误。

<!-- Old headings. Do not remove or links may break. -->

<a id="refactoring-with-structs-adding-more-meaning"></a>

### 使用结构体进行重构

我们通过给数据添加标签来使用结构体以赋予其意义。我们可以把所使用的元组转换为一个结构体，该结构体既有整体名称，也有各个部分的名称，如清单 5-10 所示。

<Listing number="5-10" file-name="src/main.rs" caption="Defining a `Rectangle` struct">

```rust
{{#rustdoc_include ../listings/ch05-using-structs-to-structure-related-data/listing-05-10/src/main.rs}}
```

</Listing>

在这里，我们定义了一个结构体并命名为 `Rectangle`。在花括号内，我们将字段定义为 `width` 和 `height`，它们的类型都是 `u32`。然后，在 `main` 函数中，我们创建了一个特定实例的 `Rectangle`，其宽度为 `30`，高度为 `50`。

我们的 `area` 函数现在只有一个参数，我们将其命名为 `rectangle`，该参数的类型是结构体 `Rectangle` 的不可变借用形式。正如第 4 章所述，我们希望借用这个结构体而不是拥有它。这样，`main` 就能保留其所有权，并继续使用 `rect1`，这也是我们在函数签名中使用 `&` 以及在该处调用函数的原因。

`area` 函数访问了 `Rectangle` 实例的 `width` 和 `height` 字段（注意，访问借用结构体实例的字段不会移动字段值，这就是为什么经常看到结构体的借用形式）。现在，`area` 函数的签名正好表达了我们的意思：使用 `Rectangle` 的 `width` 和 `height` 字段来计算其面积。这表明宽度和高度是相互关联的，并且为这些值提供了描述性名称，而不是使用元组索引值 `0` 和 `1`。这对于清晰性来说是一个优势。

<!-- Old headings. Do not remove or links may break. -->

<a id="adding-useful-functionality-with-derived-traits"></a>

### 通过派生特征添加功能

在调试程序时能够打印 `Rectangle` 的实例并查看其所有字段的值会非常有用。清单 5-11 尝试使用我们在前几章中使用的 [`println!` 宏][println]<!-- ignore -->，但这样不行。

<Listing number="5-11" file-name="src/main.rs" caption="Attempting to print a `Rectangle` instance">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch05-using-structs-to-structure-related-data/listing-05-11/src/main.rs}}
```

</Listing>

当我们编译这段代码时，会出现一条带有此核心消息的错误：

```text
{{#include ../listings/ch05-using-structs-to-structure-related-data/listing-05-11/output.txt:3}}
```

`println!` 宏可以执行多种格式化处理，默认情况下，花括号指示 `println!` 使用称为 `Display` 的格式化方式：即直接供最终用户使用的输出。我们目前看到的原始类型默认实现了 `Display`，因为向用户展示 `1` 或其他原始类型只有一种方式。但对于结构体而言，`println!` 的输出格式方式就不那么明确了，因为存在多种显示选项：您希望使用逗号吗？是否要显示花括号？所有字段都应被显示吗？由于这种模糊性，Rust 不会尝试猜测我们的需求，而结构体也没有提供 `Display` 的实现供 `println!` 和 `{}` 占位符使用。

如果我们继续阅读错误信息，会找到这条有用的提示：

```text
{{#include ../listings/ch05-using-structs-to-structure-related-data/listing-05-11/output.txt:9:10}}
```

让我们试试看！现在 `println!` 宏调用将看起来像 `println!("rect1 is {rect1:?}");`。在花括号中添加 `:?` 说明符告诉 `println!` 我们希望使用名为 `Debug` 的输出格式。`Debug` trait 使我们能够以对开发者有用的方式打印结构体，从而我们在调试代码时能够看到其值。

使用这个修改编译代码。结果仍然出现错误：

```text
{{#include ../listings/ch05-using-structs-to-structure-related-data/output-only-01-debug/output.txt:3}}
```

但同样，编译器给出了一条有用的提示：

```text
{{#include ../listings/ch05-using-structs-to-structure-related-data/output-only-01-debug/output.txt:9:10}}
```

Rust 确实包含打印调试信息的功能，但我们必须显式选择使该功能对结构体可用。为此，我们在结构体定义之前添加外部属性 `#[derive(Debug)]`，如清单 5-12 所示。

<Listing number="5-12" file-name="src/main.rs" caption="Adding the attribute to derive the `Debug` trait and printing the `Rectangle` instance using debug formatting">

```rust
{{#rustdoc_include ../listings/ch05-using-structs-to-structure-related-data/listing-05-12/src/main.rs}}
```

</Listing>

现在当我们运行程序时，不会再出现错误，我们会看到以下输出：

```console
{{#include ../listings/ch05-using-structs-to-structure-related-data/listing-05-12/output.txt}}
```

很好！虽然输出并不美观，但它显示了该实例所有字段的值，这在调试过程中非常有帮助。当处理较大的结构体时，拥有更易于阅读的输出会更有用；在这种情况下，我们可以在 `println!` 字符串中使用 `{:#?}` 而不是 `{:?}`。在这个示例中，使用 `{:#?}` 风格将输出以下内容：

```console
{{#include ../listings/ch05-using-structs-to-structure-related-data/output-only-02-pretty-debug/output.txt}}
```

另一种使用 `Debug` 格式打印值的方法是使用 [`dbg!` 宏][dbg]<!-- ignore -->，该宏会获取表达式的所有权（与接受引用的 `println!` 不同），在代码中的 `dbg!` 调用位置显示文件行号，并同时输出该表达式的结果值，最后返回该值的所有权。

> 注意：调用 `dbg!` 宏会将输出发送到标准错误控制台流（`stderr`），而 `println!` 则发送到标准输出控制台流（`stdout`）。我们将在第12章的“将错误重定向到标准错误”部分进一步讨论 `stderr` 和 `stdout`。

以下是一个示例，我们关注被赋给 `width` 字段的值以及 `rect1` 中整个结构的值：

```rust
{{#rustdoc_include ../listings/ch05-using-structs-to-structure-related-data/no-listing-05-dbg-macro/src/main.rs}}
```

我们可以在表达式 `30 * scale` 周围使用 `dbg!`，由于 `dbg!` 会返回该表达式值的所有权，因此 `width` 字段将获得与没有 `dbg!` 调用时相同的值。我们不想让 `dbg!` 获取 `rect1` 的所有权，所以在下一次调用中我们使用对 `rect1` 的引用。这个示例的输出如下所示：

```console
{{#include ../listings/ch05-using-structs-to-structure-related-data/no-listing-05-dbg-macro/output.txt}}
```

我们可以看到第一部分输出来自 _src/main.rs_ 第10行，我们正在调试表达式 `30 * scale`，其结果为 `60`（针对整数的 `Debug` 格式仅显示数值）。_src/main.rs_ 第14行的 `dbg!` 调用则输出 `&rect1` 的值，即 `Rectangle` 结构。此输出使用了 `Rectangle` 类型的美观 `Debug` 格式。当你试图理解代码的功能时，`dbg!` 宏非常有帮助！

除了 `Debug` 特质之外，Rust 还提供了许多可以通过 `derive` 属性使用的特质，这些特质可以为我们的自定义类型添加有用的行为。这些特质及其行为在 [附录 C][app-c]<!-- ignore -->中列出。我们将在第 10 章中介绍如何实现这些带有自定义行为的特质以及如何创建自己的特质。除了 `derive` 之外还有许多其他属性；如需更多信息，请参阅 [Rust 参考手册中的“属性”部分][attributes]。

我们的 `area` 函数非常特定：它仅计算矩形的面积。将这种行为与 `Rectangle` 结构体更紧密地关联会更有帮助，因为该函数在其他类型上无法使用。让我们看看如何通过将 `area` 函数转换为定义在 `Rectangle` 类型上的 `area` 方法来继续重构这段代码。

[the-tuple-type]: ch03-02-data-types.html#the-tuple-type
[app-c]: appendix-03-derivable-traits.md
[println]: ../std/macro.println.html
[dbg]: ../std/macro.dbg.html
[err]: ch12-06-writing-to-stderr-instead-of-stdout.html
[attributes]: ../reference/attributes.html
