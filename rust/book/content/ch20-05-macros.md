## 宏

在本书中，我们使用了诸如 `println!` 这样的宏，但并未充分探讨宏是什么以及其工作原理。术语“宏”指的是 Rust 中的一系列特性——使用 `macro_rules!` 的声明性宏和三种过程式宏：

- 自定义 `#[derive]` 宏，用于指定在结构体和枚举上通过 `derive` 属性添加的代码 - 类似属性的宏，用于定义可在任何项目上使用的自定义属性 - 类似函数的宏，看起来像函数调用，但操作其参数所指定的标记

我们将依次讨论这些类型，但首先，让我们看看为什么在已有函数的情况下仍然需要宏。

### 宏与函数之间的区别

从根本上说，宏是一种编写代码来生成其他代码的方式，这被称为 _元编程_。在附录 C 中，我们讨论了 `derive` 属性，它可以为你生成各种特性的实现。我们在书中也使用了 `println!` 和 `vec!` 宏。所有这些宏都会 _展开_ 以产生比手动编写的代码更多的代码。

元编程有助于减少需要编写和维护的代码量，这也是函数的功能之一。然而，宏具有函数所没有的一些额外能力。

函数签名必须声明函数的参数数量和类型。而宏则可以接受任意数量的参数：我们可以用一个参数调用 `println!("hello")`，或者用两个参数调用 `println!("hello {}", name)`。此外，宏在编译器解释代码含义之前就展开了，因此宏可以在给定类型上实现一个特性。而函数不能，因为函数是在运行时调用的，而特性需要在编译时实现。

使用宏而不是函数的一个缺点是，宏定义比函数定义更复杂，因为你正在编写编写 Rust 代码的 Rust 代码。由于这种间接性，宏定义通常比函数定义更难以阅读、理解和维护。

宏与函数之间的另一个重要区别是，必须在文件中调用宏之前定义或将其引入作用域，而函数则可以在任何地方定义、在任意地方调用。

<!-- Old headings. Do not remove or links may break. -->

<a id="declarative-macros-with-macro_rules-for-general-metaprogramming"></a>

### 用于通用元编程的声明式宏

Rust中最常用的宏形式就是_声明式宏_。这些有时也被称为“示例式宏”、“`macro_rules!`宏”或简单的“宏”。本质上，声明式宏允许你编写类似于Rust `match`表达式的内容。如第6章所述，`match`表达式是控制结构，它接受一个表达式，比较该表达式的结果值与模式，然后执行与匹配模式相关的代码。宏也通过将值与特定代码关联的模式进行比较：在这种情况下，值是传递给宏的纯Rust源代码；模式则与该源代码的结构进行比对；当某个模式匹配时，与之关联的代码会替换传递给宏的代码。这一切都在编译过程中完成。

要定义宏，需要使用`macro_rules!`构造器。让我们通过查看`vec!`宏的定义来了解如何使用`macro_rules!`。第8章介绍了如何利用`vec!`宏创建具有特定值的新向量。例如，以下宏会创建一个包含三个整数的新向量：

```rust
let v: Vec<u32> = vec![1, 2, 3];
```

我们也可以使用`vec!`宏来创建由两个整数组成的向量或由五个字符串切片组成的向量。由于无法提前知道值的数量或类型，因此无法使用函数来实现同样的功能。

列表20-35展示了`vec!`宏的简化定义。

<Listing number="20-35" file-name="src/lib.rs" caption="A simplified version of the `vec!` macro definition">

```rust,noplayground
{{#rustdoc_include ../listings/ch20-advanced-features/listing-20-35/src/lib.rs}}
```

</Listing>

> 注意：标准库中`vec!`宏的实际定义包含预先分配正确内存量的代码。为了简化示例，我们在这里不展示该优化代码。

`#[macro_export]` 注释表示该宏在定义它的 crate 进入作用域时应当可用。如果没有此注释，则无法将宏引入作用域。

我们使用 `macro_rules!` 开始宏定义，并且定义宏的名称后面不带感叹号。在这种情况下，名称为 `vec`，其后跟着花括号来表示宏定义的主体。

`vec!` 主体中的结构类似于 `match` 表达式的结构。这里有一个分支，其模式为 `( $( $x:expr ),* )`，接着是 `=>` 以及与该模式相关的代码块。如果模式匹配成功，则会输出对应的代码块。由于这是该宏中唯一的模式，因此只有一种有效的匹配方式；其他任何模式都会导致错误。更复杂的宏会有多个分支。

宏定义中的有效模式语法与第19章中介绍的模式语法不同，因为宏模式是依据 Rust 代码结构来匹配的，而不是基于值。让我们来看看列表20-29中的模式部分意味着什么；关于完整的宏模式语法，请参阅 [Rust 参考手册][ref]。

首先，我们使用一组括号来包围整个模式。我们使用美元符号 (`$`) 在宏系统中声明一个变量，该变量将包含与模式匹配的 Rust 代码。使用美元符号可以明确这是宏变量而非普通的 Rust 变量。接下来是一组括号，用于捕获与模式匹配的值，以便用于替换代码。在 `$()` 内部是 `$x:expr`，它匹配任何 Rust 表达式，并为该表达式赋予名称 `$x`。

`$()` 后面的逗号表示在 `$()` 中匹配的代码实例之间必须出现一个实际的逗号分隔符。`*` 表示模式可以匹配零个或多个前面的内容。

当我们使用 `vec![1, 2, 3];` 调用此宏时，`$x` 模式会三次匹配，分别由三个表达式 `1`、`2` 和 `3` 对应。

现在让我们看看与这个分支相关的代码主体中的模式：`$()` 内部的 `temp_vec.push()` 会被生成一次，次数取决于该模式匹配的次数。每个匹配的表达式都会被替换为 `$x`。当我们将 `vec![1, 2, 3];` 调用此宏时，生成的替换宏调用的代码如下：

```rust,ignore
{
    let mut temp_vec = Vec::new();
    temp_vec.push(1);
    temp_vec.push(2);
    temp_vec.push(3);
    temp_vec
}
```

我们定义了一个可以接受任意数量任意类型参数的宏，它可以生成创建包含指定元素的向量的代码。

要了解更多关于如何编写宏的信息，可以参考在线文档或其他资源，例如 Daniel Keep 编写的《Rust 宏小书》[tlborm]，Lukas Wirth 也在其中继续讨论相关内容。

### 从属性生成代码的过程式宏

宏的第二种形式是过程式宏，它更类似于函数（也是一种过程）。_过程式宏_ 接受一些代码作为输入，对代码进行操作，然后输出一些代码，而不是像声明式宏那样与模式匹配并将代码替换为其他代码。三种类型的过程式宏分别是自定义 `derive`、类似属性式和函数式，它们的工作方式都相似。

在创建过程式宏时，定义必须位于具有特殊 crate 类型的独立 crate 中。这是出于复杂的技术原因，我们希望将来能够消除这种限制。在列表 20-36 中，我们展示了如何定义过程式宏，其中 `some_attribute` 是使用特定宏类型的占位符。

<Listing number="20-36" file-name="src/lib.rs" caption="An example of defining a procedural macro">

```rust,ignore
use proc_macro::TokenStream;

#[some_attribute]
pub fn some_name(input: TokenStream) -> TokenStream {
}
```

</Listing>

定义过程式宏的函数接受一个 `TokenStream` 作为输入，并输出一个 `TokenStream` 作为结果。`TokenStream` 类型由 Rust 中包含的 `proc_macro` crate 定义，表示一系列标记。这是宏的核心：宏所操作的源代码构成了输入 `TokenStream`，而宏生成的代码则构成输出 `TokenStream`。该函数还附带一个属性，用于指定我们正在创建的是哪种过程式宏。同一 crate 中可以包含多种类型的过程式宏。

让我们来看看不同种类的过程式宏。我们将从自定义 `derive` 宏开始，然后解释使其他形式不同的细微差异。

<!-- Old headings. Do not remove or links may break. -->

<a id="how-to-write-a-custom-derive-macro"></a>

### 自定义 `derive` 宏

让我们创建一个名为 `hello_macro` 的 crate，该 crate定义了一个名为 `HelloMacro` 的 trait，并包含一个名为 `hello_macro` 的关联函数。与其要求用户为每种类型实现 `HelloMacro` trait，我们提供了一个过程式宏，使得用户可以通过 `#[derive(HelloMacro)]` 注释他们的类型，从而获得 `hello_macro` 函数的默认实现。默认实现会输出 `Hello, Macro! My name is TypeName!`，其中 `TypeName` 是定义该 trait 时使用的类型名称。换句话说，我们将创建一个 crate，使其他程序员能够使用我们的 crate 编写类似清单 20-37 中的代码。

<Listing number="20-37" file-name="src/main.rs" caption="The code a user of our crate will be able to write when using our procedural macro">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch20-advanced-features/listing-20-37/src/main.rs}}
```

</Listing>

当我们完成之后，这段代码将输出 `Hello, Macro! My name is Pancakes!`。第一步是创建一个新的库 crate，如下所示：

```console
$ cargo new hello_macro --lib
```

接下来，在清单 20-38 中，我们将定义 `HelloMacro` trait 及其关联函数。

<Listing file-name="src/lib.rs" number="20-38" caption="A simple trait that we will use with the `derive` macro">

```rust,noplayground
{{#rustdoc_include ../listings/ch20-advanced-features/listing-20-38/hello_macro/src/lib.rs}}
```

</Listing>

我们现在有了一个 trait 和它的函数。此时，我们的 crate 用户可以像清单 20-39 中那样实现该 trait 以获得所需功能。

<Listing number="20-39" file-name="src/main.rs" caption="How it would look if users wrote a manual implementation of the `HelloMacro` trait">

```rust,ignore
{{#rustdoc_include ../listings/ch20-advanced-features/listing-20-39/pancakes/src/main.rs}}
```

</Listing>

然而，他们需要为想要使用 `hello_macro` 的每个类型编写实现代码；我们希望避免他们做这项工作。

此外，我们目前还无法提供带有默认实现的 `hello_macro` 函数，该函数能够打印该特质所实现的类型名称：Rust 没有反射功能，因此无法在运行时查询类型名称。我们需要一个宏来在编译时生成代码。

下一步是定义过程式宏。在撰写本文时，过程式宏需要属于独立的 crate。最终，这一限制可能会被取消。构建 crate 和宏 crate 的惯例如下：对于名为 `foo` 的 crate，自定义的 `derive` 过程式宏 crate 被称为 `foo_derive`。我们在 `hello_macro` 项目中创建一个名为 `hello_macro_derive` 的新 crate：

```console
$ cargo new hello_macro_derive --lib
```

我们的两个 crate 密切相关，因此我们将过程式宏 crate 创建在 `hello_macro` crate 的目录中。如果我们修改 `hello_macro` 中的特质定义，就必须同时修改 `hello_macro_derive` 中的过程式宏实现。这两个 crate 需要分别发布，使用这些 crate 的程序员需要将两者都添加为依赖项，并让它们生效。我们也可以让 `hello_macro` crate 以 `hello_macro_derive` 作为依赖项，并重新导出过程式宏代码。不过，按照我们当前的项目结构，即使程序员不希望使用 `derive` 功能，也可以直接使用 `hello_macro`。

我们需要将 `hello_macro_derive` crate 声明为过程式宏 crate。我们还需要从 `syn` 和 `quote` crate 获取功能，稍后你会看到相关代码，因此需要将它们添加为依赖项。在 `hello_macro_derive` 的 _Cargo.toml_ 文件中添加以下内容：

<Listing file-name="hello_macro_derive/Cargo.toml">

```toml
{{#include ../listings/ch20-advanced-features/listing-20-40/hello_macro/hello_macro_derive/Cargo.toml:6:12}}
```

</Listing>

要开始定义过程式宏，请将列表 20-40 中的代码放入 `hello_macro_derive` crate 的 _src/lib.rs_ 文件中。请注意，直到我们添加 `impl_hello_macro` 函数的定义之前，这段代码都无法编译。

<Listing number="20-40" file-name="hello_macro_derive/src/lib.rs" caption="Code that most procedural macro crates will require in order to process Rust code">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch20-advanced-features/listing-20-40/hello_macro/hello_macro_derive/src/lib.rs}}
```

</Listing>

请注意，我们将代码拆分为 `hello_macro_derive` 函数和 `impl_hello_macro` 函数。前者负责解析 `TokenStream`，后者则负责转换语法树。这样编写过程式宏更加方便。外部函数中的代码（本例中为 `hello_macro_derive`）对于您看到的或创建的大多数过程式宏 crate 都是相同的。内部函数中指定的代码（本例为 `impl_hello_macro`）则会根据您的过程式宏用途有所不同。

我们引入了三个新的 crate：`proc_macro`、`syn` 和 [`quote]`。`proc_macro` crate 与 Rust 一起提供，因此无需在 _Cargo.toml_ 中将其添加到依赖项中。`proc_macro` crate 是编译器的 API，允许我们从代码中读取并操作 Rust 代码。

`syn` crate 将 Rust 代码从字符串解析为我们可以操作的数据结构。而 `quote` crate 则把 `syn` 数据结构转换回 Rust 代码。这些 crate 使得处理任何类型的 Rust 代码变得更加简单：编写完整的 Rust 代码解析器并非易事。

当用户在类型上指定 `#[derive(HelloMacro)]` 时，将调用 `hello_macro_derive` 函数。这是通过我们在 `hello_macro_derive` 函数上标注 `proc_macro_derive` 并指定名称 `HelloMacro`，使其与我们的特征名匹配来实现的；这是大多数过程式宏遵循的惯例。

`hello_macro_derive` 函数首先将 `input` 从 `TokenStream` 转换为我们可以解释并操作的数据结构。此时 `syn` 发挥作用了。`syn` 中的 `parse` 函数接收 `TokenStream` 并返回一个 `DeriveInput` 结构体，该结构体表示解析后的 Rust 代码。图 20-41 展示了从解析 `struct Pancakes;` 字符串得到的 `DeriveInput` 结构体的相关部分。

<Listing number="20-41" caption="The `DeriveInput` instance we get when parsing the code that has the macro’s attribute in Listing 20-37">

```rust,ignore
DeriveInput {
    // --snip--

    ident: Ident {
        ident: "Pancakes",
        span: #0 bytes(95..103)
    },
    data: Struct(
        DataStruct {
            struct_token: Struct,
            fields: Unit,
            semi_token: Some(
                Semi
            )
        }
    )
}
```

</Listing>

该结构体的字段表明我们解析的 Rust 代码是一个单元结构体，其 `ident`（标识符）为 `Pancakes`。该结构体还包含更多字段用于描述各种 Rust 代码；有关更多信息，请查阅 [`syn` documentation for `DeriveInput`][syn-docs]。

不久我们将定义 `impl_hello_macro` 函数，该函数将用于构建我们想要包含的新 Rust 代码。但在做之前请注意，我们的 `derive` 宏的输出也是一个 `TokenStream`。返回的 `TokenStream` 会被添加到 crate 用户编写的代码中，因此当他们编译他们的 crate 时，会获得我们在修改后的 `TokenStream` 中提供的额外功能。

你可能已经注意到，如果这里的 `syn::parse` 函数调用失败，我们会使用 `unwrap` 导致 `hello_macro_derive` 函数崩溃。对于我们的过程式宏来说，在错误时崩溃是必要的，因为 `proc_macro_derive` 函数必须返回 `TokenStream` 而不是 `Result`，以符合过程式宏 API 的要求。我们通过使用 `unwrap` 简化了这个示例；在生产代码中，你应该使用 `panic!` 或 `expect` 来提供更具体的错误信息，说明发生了什么问题。

现在我们已经有了将标注后的 Rust 代码从 `TokenStream` 转换为 `DeriveInput` 实例的代码，让我们生成实现标注类型上 `HelloMacro` trait 的代码，如清单 20-42 所示。

<Listing number="20-42" file-name="hello_macro_derive/src/lib.rs" caption="Implementing the `HelloMacro` trait using the parsed Rust code">

```rust,ignore
{{#rustdoc_include ../listings/ch20-advanced-features/listing-20-42/hello_macro/hello_macro_derive/src/lib.rs:here}}
```

</Listing>

我们使用 `ast.ident` 获取包含标注类型名称的 `Ident` 结构体实例。清单 20-41 中的结构体会显示，当我们在清单 20-37 中的代码上运行 `impl_hello_macro` 函数时，我们获得的 `ident` 将具有值为 `"Pancakes"` 的 `ident` 字段。因此，清单 20-42 中的 `name` 变量将包含一个 `Ident` 结构体实例，当打印出来时，将是字符串 `"Pancakes"`，即清单 20-37 中结构的名称。

`quote!` 宏允许我们定义想要返回的 Rust 代码。编译器期望的结果与 `quote!` 宏执行的直接结果不同，因此我们需要将其转换为 `TokenStream` 类型。我们通过调用 `into` 方法来实现这一点，该方法会消耗这种中间表示并返回所需的 `TokenStream` 类型值。

`quote!` 宏还提供了一些非常有趣的模板机制：我们可以输入 `#name`，然后 `quote!` 会将它替换为变量 `name` 中的值。甚至还可以进行类似常规宏的重复操作。请查阅 [`quote` crate 文档][quote-docs]以了解详细介绍。

我们希望程序式宏能够为用户注释的类型生成 `HelloMacro` trait 的实现，而这是通过使用 `#name` 实现的。该 trait 实现包含一个名为 `hello_macro` 的函数，其体内包含我们想要提供的功能：打印 “Hello, 宏! My name is” 以及被注释类型的名称。

这里使用的 `stringify!` 宏是 Rust 内置的。它接受一个 Rust 表达式，例如 `1 + 2`，在编译时将该表达式转换为字符串字面量，例如 `"1 + 2"`。这与 `format!` 或 `println!` 不同，后两者是评估表达式然后将结果转换为 `String` 的宏。由于 `#name` 输入可能是用于直接打印的表达式，因此我们使用 `stringify!`。使用 `stringify!` 还能在编译时将 `#name` 转换为字符串字面量，从而节省内存分配。

此时，在 `hello_macro` 和 `hello_macro_derive` 中执行 `cargo build` 应能够成功完成。让我们将这些 crates 连接到清单 20-37 中的代码上，以观察过程式宏的实际效果！使用 `cargo new pancakes` 在 `_projects_` 目录中创建一个新的二进制项目。我们需要在 `pancakes` crate 的 `_Cargo.toml` 文件中将 `hello_macro` 和 `hello_macro_derive` 作为依赖项添加。如果你将 `hello_macro` 和 `hello_macro_derive` 的版本发布到 [crates.io](https://crates.io/)，它们将是常规依赖项；如果不是，你可以将其指定为 `path` 依赖项，如下所示：

```toml
{{#include ../listings/ch20-advanced-features/no-listing-21-pancakes/pancakes/Cargo.toml:6:8}}
```

将清单 20-37 中的代码放入 `_src/main.rs_` 中，然后运行 `cargo run`：它应输出 `Hello, Macro! My name is Pancakes!`。过程式宏的 `HelloMacro` trait 实现被包含在内，而无需 `pancakes` crate 实现该特性；`#[derive(HelloMacro)]` 添加了该 trait 的实现。

接下来，让我们探讨其他类型的过程式宏与自定义 `derive` 宏有何不同。

### 类似属性的宏

类似属性的宏与自定义 `derive` 宏相似，但它们不是生成 `derive` 属性对应的代码，而是允许创建新的属性。它们也更具灵活性：`derive` 仅适用于结构体和枚举；属性也可以应用于其他项目，例如函数。以下是使用类似属性的宏的一个示例。假设有一个名为 `route` 的属性，用于在使用 Web 应用框架时标注函数：

```rust,ignore
#[route(GET, "/")]
fn index() {
```

这个 `#[route]` 属性将由框架作为过程式宏定义。宏定义函数的签名如下所示：

```rust,ignore
#[proc_macro_attribute]
pub fn route(attr: TokenStream, item: TokenStream) -> TokenStream {
```

这里有两个类型为 `TokenStream` 的参数。第一个参数用于属性内容：即 `GET, "/"` 部分。第二个参数则是属性所附加项目的主体：在本例中为 `fn index() {}` 以及函数的其余部分。

除此之外，类似属性的宏与自定义 `derive` 宏的工作方式相同：你使用 `proc-macro` crate 类型创建一个 crate，并实现一个生成所需代码的函数！

### 类函数的宏

类函数的宏是看起来像函数调用的宏。与 `macro_rules!` 宏类似，它们比普通函数更灵活；例如，它们可以接受未知数量的参数。然而，`macro_rules!` 宏只能使用我们在“用于通用元编程的声明式宏”[decl]<!-- ignore -->部分讨论的匹配语法来定义。类函数的宏接受一个 `TokenStream` 参数，其定义使用 Rust 代码来操作该 `TokenStream`，就像其他两种过程性宏一样。一个类函数的宏的例子是 `sql!` 宏，其调用方式如下：

```rust,ignore
let sql = sql!(SELECT * FROM posts WHERE id=1);
```

这个宏会解析其中的 SQL 语句并验证其语法正确性，这比 `macro_rules!` 宏能完成的处理要复杂得多。`sql!` 宏的定义如下：

```rust,ignore
#[proc_macro]
pub fn sql(input: TokenStream) -> TokenStream {
```

这个定义与自定义 `derive` 宏的签名类似：我们接收括号内的标记，然后返回我们想要生成的代码。

## 总结

呼！现在你的 Rust 工具箱里有了一些你可能不常使用的特性，但在特定情况下你会知道它们的存在。我们介绍了几个复杂的主题，这样当你在错误消息建议或他人的代码中遇到这些概念时，就能识别它们和语法。将本章作为参考，帮助你找到解决方案。

接下来，我们将把本书中讨论的所有内容付诸实践，完成一个项目！

[ref]: ../reference/macros-by-example.html
[tlborm]: https://veykril.github.io/tlborm/
[syn]: https://crates.io/crates/syn
[quote]: https://crates.io/crates/quote
[syn-docs]: https://docs.rs/syn/2.0/syn/struct.DeriveInput.html
[quote-docs]: https://docs.rs/quote
[decl]: #declarative-macros-with-macro_rules-for-general-metaprogramming
