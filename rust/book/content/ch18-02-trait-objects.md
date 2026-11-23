<!-- Old headings. Do not remove or links may break. -->

<a id="using-trait-objects-that-allow-for-values-of-different-types"></a>

## 使用特质对象来抽象共享行为

在第8章中，我们提到向量的一个限制是它们只能存储一种类型的元素。我们在清单8-9中找到了一种解决方案，其中定义了`SpreadsheetCell`枚举，该枚举包含用于存储整数、浮点数和文本的变体。这意味着我们可以在每个单元格中存储不同类型的数据，同时仍然拥有一个表示行单元格的向量。当可互换项目是已知的固定类型集合时，这是非常有效的解决方案。

然而，有时我们希望库用户能够扩展在特定情况下有效的类型集。为了展示如何实现这一点，我们将创建一个示例图形用户界面（GUI）工具，该工具遍历列表中的项目，并在每个项目上调用`draw`方法将其绘制到屏幕上——这是GUI工具的常用技术。我们将创建一个名为`gui`的库crate，其中包含GUI库的结构。这个crate可能包含一些供人们使用的类型，如`Button`或`TextField`。此外，`gui`用户还将希望创建自己可以绘制的类型：例如，一个程序员可能会添加`Image`，另一个程序员可能会添加`SelectBox`。

在编写该库时，我们无法知道并定义其他程序员可能想要创建的所有类型。但我们知道`gui`需要跟踪多种不同类型的数值，并且需要对这些不同类型的值分别调用`draw`方法。它不需要确切知道调用`draw`方法时会发生什么，只需要知道这些值都有该方法来调用即可。

在具有继承机制的语言中，我们可以定义一个名为 `Component` 的类，该类包含一个名为 `draw` 的方法。其他类，如 `Button`、`Image` 和 `SelectBox`，将从 `Component` 继承，从而继承 `draw` 方法。它们可以分别覆盖 `draw` 方法来定义自定义行为，但框架可以将所有类型视为 `Component` 实例并调用其 `draw` 方法。但由于 Rust 没有继承机制，我们需要另一种方式来构建 `gui` 库，以允许用户创建与库兼容的新类型。

### 定义通用行为的特质

为了实现 `gui` 所需的行为，我们将定义一个名为 `Draw` 的特质，该特质包含一个名为 `draw` 的方法。然后，我们可以定义一个接受特质对象的向量。_特质对象_ 既指向实现了指定特质的类型实例，也指向在运行时用于查找该类型上特质方法的表。我们通过指定某种指针来创建特质对象，例如引用或 `Box<T>` 智能指针，然后使用 `dyn` 关键字，再指定相关的特质。（我们将在第 20 章“动态大小类型与 `Sized` 特质”中讨论为什么特质对象必须使用指针的原因。）我们可以用特质对象代替泛型或具体类型。在任何使用特质对象的场景下，Rust 的类型系统会在编译时确保在该上下文中使用的所有值都实现了该特质对象的特质。因此，我们在编译时无需知道所有可能的类型。

我们提到，在 Rust 中，我们避免将结构体和枚举称为“对象”以区别于其他语言中的对象。在结构体或枚举中，结构体字段中的数据与 `impl` 块中的行为是分开的；而在其他语言中，数据和行为合并为一个概念通常被称为对象。trait 对象与其他语言中的对象不同之处在于，我们无法向 trait 对象添加数据。trait 对象不像其他语言中的对象那样具有普遍实用性：它们的具体用途在于允许对共同行为进行抽象化。

清单 18-3 展示了如何定义一个名为 `Draw` 的 trait，该 trait 包含一个名为 `draw` 的方法。

<Listing number="18-3" file-name="src/lib.rs" caption="Definition of the `Draw` trait">

```rust,noplayground
{{#rustdoc_include ../listings/ch18-oop/listing-18-03/src/lib.rs}}
```

</Listing>

这种语法在我们在第 10 章讨论如何定义 trait 时应该很熟悉。接下来是一些新的语法：清单 18-4 定义了一个名为 `Screen` 的结构体，它包含一个名为 `components` 的向量。这个向量的类型为 `Box<dyn Draw>`，即一个 trait 对象；它是 `Box` 中实现 `Draw` trait 的任何类型的替代表示。

<Listing number="18-4" file-name="src/lib.rs" caption="Definition of the `Screen` struct with a `components` field holding a vector of trait objects that implement the `Draw` trait">

```rust,noplayground
{{#rustdoc_include ../listings/ch18-oop/listing-18-04/src/lib.rs:here}}
```

</Listing>

在 `Screen` 结构体上，我们将定义一个名为 `run` 的方法，该方法将调用每个 `component` 的 `draw` 方法，如清单 18-5 所示。

<Listing number="18-5" file-name="src/lib.rs" caption="A `run` method on `Screen` that calls the `draw` method on each component">

```rust,noplayground
{{#rustdoc_include ../listings/ch18-oop/listing-18-05/src/lib.rs:here}}
```

</Listing>

这与使用具有 trait 边界的泛型类型参数来定义结构体不同。泛型类型参数一次只能被一个具体类型替代；而 trait 对象则允许在运行时用多个具体类型填充 trait 对象。例如，我们可以像清单 18-6 中那样使用泛型类型和 trait 边界来定义 `Screen` 结构体。

<Listing number="18-6" file-name="src/lib.rs" caption="An alternate implementation of the `Screen` struct and its `run` method using generics and trait bounds">

```rust,noplayground
{{#rustdoc_include ../listings/ch18-oop/listing-18-06/src/lib.rs:here}}
```

</Listing>

这限制了我们只能创建具有所有类型为 `Button` 或所有类型为 `TextField` 的组件列表的 `Screen` 实例。如果你只会有同构集合，使用泛型和 trait 边界更为合适，因为定义将在编译时被单态化以使用具体类型。

另一方面，使用 trait 对象的方法时，一个 `Screen` 实例可以包含一个包含 `Box<Button>` 和 `Box<TextField>` 的 `Vec<T>`。让我们看看这是如何工作的，然后我们将讨论运行时性能的影响。

### 实现 trait

现在我们将添加一些实现 `Draw` 特质类型的代码。我们将提供 `Button` 类型。实际上，实现 GUI 库超出了本书的范围，因此 `draw` 方法的实现体中不会包含任何有用的内容。为了想象实现的可能形式，`Button` 结构体可能包含 `width`、`height` 和 `label` 字段，如清单 18-7 所示。

<Listing number="18-7" file-name="src/lib.rs" caption="A `Button` struct that implements the `Draw` trait">

```rust,noplayground
{{#rustdoc_include ../listings/ch18-oop/listing-18-07/src/lib.rs:here}}
```

</Listing>

`Button` 中的 `width`、`height` 和 `label` 字段与其他组件不同；例如，`TextField` 类型可能包含这些字段以及 `placeholder` 字段。我们想要在屏幕上绘制的每个类型都会实现 `Draw` 特质，但在 `draw` 方法中使用不同的代码来定义如何绘制该特定类型，就像 `Button` 一样（不包括实际的 GUI 代码）。例如，`Button` 类型可能包含一个额外的 `impl` 块，其中包含与用户点击按钮时发生的事件相关的方法。这类方法不适用于像 `TextField` 这样的类型。

如果使用我们的库的人决定实现具有 `width`、`height` 和 `options` 字段的 `SelectBox` 结构体，他们也会在 `SelectBox` 类型上实现 `Draw` 特质，如清单 18-8 所示。

<Listing number="18-8" file-name="src/main.rs" caption="Another crate using `gui` and implementing the `Draw` trait on a `SelectBox` struct">

```rust,ignore
{{#rustdoc_include ../listings/ch18-oop/listing-18-08/src/main.rs:here}}
```

</Listing>

现在，使用我们库的用户可以编写他们的 `main` 函数来创建 `Screen` 实例。对于 `Screen` 实例，他们可以通过将每个组件放入 `Box<T>` 中成为 trait 对象，从而添加 `SelectBox` 和 `Button`。然后他们可以调用 `Screen` 实例的 `run` 方法，该方法会调用每个组件的 `draw` 方法。清单 18-9 展示了这种实现方式。

<Listing number="18-9" file-name="src/main.rs" caption="Using trait objects to store values of different types that implement the same trait">

```rust,ignore
{{#rustdoc_include ../listings/ch18-oop/listing-18-09/src/main.rs:here}}
```

</Listing>

在编写库时，我们不知道可能会有人添加 `SelectBox` 类型，但我们的 `Screen` 实现能够操作新类型并绘制它，因为 `SelectBox` 实现了 `Draw` 特质，这意味着它也实现了 `draw` 方法。

这种只关注值响应的消息而非值的具体类型的概念，与动态类型语言中_鸭子类型_的概念类似：如果它像鸭一样走路且像鸭一样叫，那么它一定是鸭！在清单 18-5 中 `Screen` 的 `run` 实现中，`run` 不需要知道每个组件的具体类型。它不会检查组件是 `Button` 还是 `SelectBox` 的实例，只是调用组件的 `draw` 方法。通过将 `Box<dyn Draw>` 指定为 `components` 向量中值的类型，我们就定义了 `Screen` 需要可以调用 `draw` 方法的数值。

使用特质对象和 Rust 的类型系统来编写类似鸭子类型的代码的优势在于，我们永远不必在运行时检查值是否实现了特定方法，也无需担心如果值没有实现该方法但仍然被调用时会出现错误。如果值没有实现特质对象所需的特质，Rust 将无法编译我们的代码。

例如，清单 18-10 展示了如果我们尝试用 `String` 作为组件创建 `Screen` 会发生什么。

<Listing number="18-10" file-name="src/main.rs" caption="Attempting to use a type that doesn’t implement the trait object’s trait">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch18-oop/listing-18-10/src/main.rs}}
```

</Listing>

我们会得到这个错误，因为 `String` 没有实现 `Draw` 特质：

```console
{{#include ../listings/ch18-oop/listing-18-10/output.txt}}
```

这个错误告诉我们，要么我们向 `Screen` 传递了不希望传递的内容，应该传递不同的类型，要么我们应该在 `String` 上实现 `Draw` 特质，这样 `Screen` 就可以在其上调用 `draw` 方法。

<!-- Old headings. Do not remove or links may break. -->

<a id="trait-objects-perform-dynamic-dispatch"></a>

### 执行动态分派

在第十章《使用泛型的性能》中，我们讨论了编译器对泛型进行的单态化过程：编译器为我们用作泛型类型参数的每种具体类型生成非泛型的函数和方法实现。由单态化产生的代码进行_静态分派_，即编译器在编译时就能知道正在调用哪个方法。这与_动态分派_相对，后者是编译器在编译时无法判断正在调用哪个方法的情况。在动态分派的情况下，编译器会生成代码，使得运行时才能确定要调用哪个方法。

当我们使用特质对象时，Rust必须使用动态分派。编译器不知道使用特质对象的代码可能会用到哪些类型，因此无法确定应在哪种类型上调用哪个实现的方法。相反，在运行时，Rust通过特质对象中的指针来确定要调用哪个方法。这种查找操作会产生运行时成本，而静态分派则不会产生这种成本。动态分派还阻止了编译器选择内联方法的代码，从而也阻止了一些优化。此外，Rust有一些关于可以在何处使用动态分派的规则，称为_dyn兼容性_。这些规则超出了本次讨论的范围，但你可以阅读更多相关内容[在参考手册中][dyn-compatibility]<!-- ignore -->。不过，我们在列表 18-5 中编写的代码获得了额外的灵活性，并且能够在列表 18-9 中支持某些功能，因此这是一个需要权衡的选择。

[performance-of-code-using-generics]: ch10-01-syntax.html#performance-of-code-using-generics
[dynamically-sized]: ch20-03-advanced-types.html#dynamically-sized-types-and-the-sized-trait
[dyn-compatibility]: https://doc.rust-lang.org/reference/items/traits.html#dyn-compatibility
