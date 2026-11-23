<!-- Old headings. Do not remove or links may break. -->

<a id="digging-into-the-traits-for-async"></a>

## 更详细地了解异步特性

在本章中，我们以各种方式使用了 `Future`、`Stream` 和 `StreamExt` 特性。不过到目前为止，我们并没有深入讨论它们的工作原理或如何协同工作，这对于日常 Rust 开发来说已经足够了。然而，有时你会遇到需要深入了解这些特性细节的情况，包括 `Pin` 类型和 `Unpin` 特性。在本节中，我们将简要介绍这些内容，以便应对这些情况，而更深入的讲解则留待其他文档提供。

<!-- Old headings. Do not remove or links may break. -->

<a id="future"></a>

### `Future` 特性

让我们先更详细地了解 `Future` 特性的工作原理。Rust 是这样定义的：

```rust
use std::pin::Pin;
use std::task::{Context, Poll};

pub trait Future {
    type Output;

    fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output>;
}
```

该特性定义包含许多新类型以及一些我们之前未见过的语法，因此我们将逐部分解析这个定义。

首先，`Future` 的关联类型 `Output` 表示未来结果的内容。这类似于 `Iterator` 特性的 `Item` 关联类型。其次，`Future` 具有 `poll` 方法，该方法需要一个特殊的 `Pin` 引用作为 `self` 参数和一个可变的 `Context` 类型引用，并返回一个 `Poll<Self::Output>` 对象。我们稍后会详细讨论 `Pin` 和 `Context`。目前，让我们重点关注该方法返回的 `Poll` 类型。

```rust
pub enum Poll<T> {
    Ready(T),
    Pending,
}
```

这个 `Poll` 类型类似于 `Option`。它有一个有值的变体 `Ready(T)`，以及一个没有值的变体 `Pending`。不过，`Poll` 与 `Option` 的含义完全不同！`Pending` 变体表示未来还有工作要做，调用者需要在之后再次检查。而 `Ready` 变体则表示 `Future` 已经完成工作，`T` 值已经可用。

> 注意：直接调用 `poll` 的情况很少见，但如果你确实需要这样做，请记住：对于大多数 Future，调用者在 Future 返回 `Ready` 后不应再次调用 `poll`。如果再次调用 `poll`，许多 Future 会引发恐慌。那些可以再次被 `poll` 的 Future 会在其文档中明确说明这一点。这类似于 `Iterator::next` 的行为方式。

当你看到使用 `await` 的代码时，Rust 在内部会将其编译为调用 `poll` 的代码。如果你回顾清单 17-4，我们在某个 URL 解析后打印出页面标题，Rust 将其编译成类似如下代码（尽管不完全相同）：

```rust,ignore
match page_title(url).poll() {
    Ready(page_title) => match page_title {
        Some(title) => println!("The title for {url} was {title}"),
        None => println!("{url} had no title"),
    }
    Pending => {
        // But what goes here?
    }
}
```

当未来仍然处于 `Pending` 状态时，我们该怎么办？我们需要一种方式可以反复尝试，直到未来最终准备就绪。换句话说，我们需要一个循环：

```rust,ignore
let mut page_title_fut = page_title(url);
loop {
    match page_title_fut.poll() {
        Ready(value) => match page_title {
            Some(title) => println!("The title for {url} was {title}"),
            None => println!("{url} had no title"),
        }
        Pending => {
            // continue
        }
    }
}
```

如果 Rust 将其完全编译为那种代码，那么每个 `await` 都会导致阻塞——这与我们的目标完全相反！相反，Rust 确保循环能够将控制交给某种能够暂停当前未来的工作以处理其他未来任务，然后稍后再次检查这个未来的机制。正如我们所见，这种机制是一个异步运行时，而这种调度和协调工作正是它的主要职责之一。

在“使用消息传递在两个任务之间发送数据”部分中，我们描述了等待 `rx.recv`。`recv` 调用返回一个未来，等待该未来则进行轮询。我们注意到运行时会在通道关闭时暂停未来，直到它准备好，返回 `Some(message)` 或 `None`。通过更深入地理解 `Future` trait，特别是 `Future::poll`，我们可以明白其工作原理。当运行时返回 `Poll::Pending` 时，它知道未来尚未准备就绪；相反，当 `poll` 返回 `Poll::Ready(Some(message))` 或 `Poll::Ready(None)` 时，运行时知道未来已经准备就绪并推进它。

运行时具体实现这一机制的细节超出了本书的范围，但关键在于理解未来的基本机制：运行时会轮询它所负责的每个未来，当未来尚未准备好时则将其放回睡眠状态。

<!-- Old headings. Do not remove or links may break. -->

<a id="pinning-and-the-pin-and-unpin-traits"></a>
<a id="the-pin-and-unpin-traits"></a>

### `Pin` 类型与 `Unpin` trait

在列表 17-13 中，我们使用 `trpl::join!` 宏等待三个未来值。然而，通常会有像向量这样的集合包含多个未来值，这些未来值在运行时才会被知晓。让我们将列表 17-13 改为列表 17-23 中的代码，该代码将三个未来值放入一个向量中，并调用 `trpl::join_all` 函数，不过目前这段代码无法编译。

<Listing number="17-23" caption="Awaiting futures in a collection"  file-name="src/main.rs">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch17-async-await/listing-17-23/src/main.rs:here}}
```

</Listing>

我们将每个未来值放在 `Box` 中，使其成为 _trait 对象_，就像我们在第 12 章的“从 `run` 返回错误”部分所做的那样。（我们将在第 18 章详细讨论 trait 对象。）使用 trait 对象可以让我们将这些类型产生的匿名未来值视为同一类型，因为它们都实现了 `Future` trait。

这可能会令人惊讶。毕竟，所有异步块都不返回任何内容，因此每个异步块都会产生一个 `Future<Output = ()>`。请记住，`Future` 是一个 trait，并且编译器为每个异步块创建一个唯一的枚举，即使它们的输出类型相同也是如此。就像你不能将两个不同的手写结构体放入 `Vec` 中一样，也不能混合编译生成的枚举。

然后我们将未来值的集合传递给 `trpl::join_all` 函数并等待结果。然而，这段代码无法编译；以下是错误消息的相关部分。

<!-- manual-regeneration
cd listings/ch17-异步-await/listing-17-23 cargo build copy *only* the final `error` block from the errors -->

```text
error[E0277]: `dyn Future<Output = ()>` cannot be unpinned
  --> src/main.rs:48:33
   |
48 |         trpl::join_all(futures).await;
   |                                 ^^^^^ the trait `Unpin` is not implemented for `dyn Future<Output = ()>`
   |
   = note: consider using the `pin!` macro
           consider using `Box::pin` if you need to access the pinned value outside of the current scope
   = note: required for `Box<dyn Future<Output = ()>>` to implement `Future`
note: required by a bound in `futures_util::future::join_all::JoinAll`
  --> file:///home/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/futures-util-0.3.30/src/future/join_all.rs:29:8
   |
27 | pub struct JoinAll<F>
   |            ------- required by a bound in this struct
28 | where
29 |     F: Future,
   |        ^^^^^^ required by this bound in `JoinAll`
```

该错误消息中的注释告诉我们应该使用 `pin!` 宏来 _固定_ 值，这意味着将它们放入 `Pin` 类型中，以确保这些值在内存中不会被移动。错误消息指出需要固定是因为 `dyn Future<Output = ()>` 需要实现 `Unpin` trait，而它目前没有实现该特性。

`trpl::join_all` 函数返回一个名为 `JoinAll` 的结构体。该结构体是一个泛型结构，其类型 `F` 被限制为实现了 `Future` trait。直接使用 `await` 等待未来值会隐式地固定该未来值。因此，我们不需要在需要等待未来的所有地方都使用 `pin!`。

然而，我们并不是直接等待未来的结果。相反，我们通过将一系列未来任务传递给 `join_all` 函数来构造一个新的未来任务 JoinAll。`join_all` 的签名要求集合中的项目类型都实现 `Future` trait，而 `Box<T>` 只有在其包裹的类型是实现 `Unpin` trait 的未来时才能实现 `Future` trait。

这有很多内容需要理解！为了真正掌握它，让我们进一步探讨 `Future` trait 的实际工作原理，特别是关于固定（pinning）的部分。再看一下 `Future` trait 的定义：

```rust
use std::pin::Pin;
use std::task::{Context, Poll};

pub trait Future {
    type Output;

    // Required method
    fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output>;
}
```

`cx` 参数及其 `Context` 类型是运行时如何知道何时检查给定未来任务的同时保持惰性状态的关键。同样，其具体实现细节超出了本章的范围，通常只有在编写自定义 `Future` 实现时才需要考虑这一点。我们接下来将重点讨论 `self` 的类型，因为这是第一次看到 `self` 有类型注释的方法。对 `self` 的类型注释与其他函数参数的类型注释类似，但有两个关键区别：

- 它告诉 Rust `self` 必须是什么类型才能调用该方法。
- 它不能只是任意类型，而是限制于方法所实现的类型、对该类型的引用或智能指针，或者包裹了该类型引用的 `Pin`。

我们将在 [第18章][ch-18]<!-- ignore -->中看到更多关于这种语法的内容。目前只需知道，如果我们想轮询一个未来任务以检查它是 `Pending` 还是 `Ready(Output)`，我们需要一个包裹了 `Pin` 的可变引用指向该类型。

`Pin` 是类似指针的类型（如 `&`、`&mut`、`Box` 和 `Rc`）的包装器。（从技术上讲，`Pin` 适用于实现 `Deref` 或 `DerefMut` trait 的类型，但实际上等同于仅使用引用和智能指针。）`Pin` 本身不是指针，也不具有像 `Rc` 和 `Arc` 那样的引用计数行为；它纯粹是编译器用来强制约束指针使用的工具。

回想一下，`await`是通过调用 `poll` 来实现的，这解释了我们之前看到的错误消息，但那是基于 `Unpin`，而不是 `Pin`。那么 `Pin` 与 `Unpin` 究竟有何关系？为什么 `Future` 需要 `self` 位于 `Pin` 类型中才能调用 `poll`？

还记得本章前面提到的吗？在异步块中的一系列 `await` 点会被编译成状态机，编译器会确保该状态机遵循 Rust 关于安全性的所有规则，包括借用和所有权。为了实现这一点，Rust 会分析从一个 `await` 点到下一个 `await` 点或异步块结束之间所需的数据。然后，它在编译后的状态机中创建相应的变体。每个变体都能获得使用这些数据的必要访问权限，无论是通过获取数据的所有权还是通过获取其可变或不可变的引用。

到目前为止一切正常：如果我们在某个异步块中的所有权或引用方面出错，借用检查器会告诉我们。但当我们想要操作与该块对应的未来时——比如将其放入 `Vec` 中传递给 `join_all` ——情况就变得复杂了。

当我们移动一个未来时——无论是通过将其推入数据结构作为迭代器使用，还是通过从函数返回它——实际上意味着移动 Rust 为我们创建的状态机。与 Rust 中的大多数其他类型不同，Rust 为异步块创建的未来可能在任何变体的字段中拥有对自身的引用，如图 17-4 的简化示意图所示。

<figure>

<img alt="A single-column, three-row table representing a future, fut1, which has data values 0 and 1 in the first two rows and an arrow pointing from the third row back to the second row, representing an internal reference within the future." src="img/trpl17-04.svg" class="center" />

<figcaption>Figure 17-4: A self-referential data type</figcaption>

</figure>

不过，默认情况下，任何具有自身引用对象的移动都是不安全的，因为引用总是指向其所引用的实际内存地址（参见图 17-5）。如果你移动数据结构本身，这些内部引用将仍然指向旧的位置。然而，该内存位置现在变得无效。一方面，当你对数据结构进行更改时，其值不会更新。另一方面——更为重要的一点——计算机现在可以重新使用该内存用于其他目的！你可能会随后读取完全不相关的数据。

<figure>

<img alt="Two tables, depicting two futures, fut1 and fut2, each of which has one column and three rows, representing the result of having moved a future out of fut1 into fut2. The first, fut1, is grayed out, with a question mark in each index, representing unknown memory. The second, fut2, has 0 and 1 in the first and second rows and an arrow pointing from its third row back to the second row of fut1, representing a pointer that is referencing the old location in memory of the future before it was moved." src="img/trpl17-05.svg" class="center" />

<figcaption>Figure 17-5: The unsafe result of moving a self-referential data type</figcaption>

</figure>

理论上，Rust 编译器可以在移动时尝试更新所有对象的引用，但这可能会增加大量的性能开销，尤其是当大量引用需要更新时。如果我们能确保所涉及的数据结构在内存中不会移动，就无需更新任何引用了。这正是 Rust 的 借用检查器 的作用：在安全的代码中，它防止你移动有任何具有活跃引用的项目。

`Pin` 基于这一机制为我们提供所需的确切保证。当我们通过将指针包装在 `Pin` 中来 `_pin` 一个值时，该值就不能再被移动了。因此，如果你有 `Pin<Box<SomeType>>`，实际上是对 `SomeType` 值进行了固定，而不是对 `Box` 指针进行固定。图 17-6 展示了这一过程。

<figure>

<img alt="Three boxes laid out side by side. The first is labeled “Pin”, the second “b1”, and the third “pinned”. Within “pinned” is a table labeled “fut”, with a single column; it represents a future with cells for each part of the data structure. Its first cell has the value “0”, its second cell has an arrow coming out of it and pointing to the fourth and final cell, which has the value “1” in it, and the third cell has dashed lines and an ellipsis to indicate there may be other parts to the data structure. All together, the “fut” table represents a future which is self-referential. An arrow leaves the box labeled “Pin”, goes through the box labeled “b1” and terminates inside the “pinned” box at the “fut” table." src="img/trpl17-06.svg" class="center" />

<figcaption>Figure 17-6: Pinning a `Box` that points to a self-referential future type</figcaption>

</figure>

事实上，`Box` 指针仍然可以自由地移动。记住：我们关心的是确保最终被引用的数据保持不动。如果指针可以移动，但它所指向的数据仍位于同一位置，如图 17-7 所示，则没有潜在问题。（作为独立练习，请查看相关类型的文档以及 `std::pin` 模块，尝试找出如何用 `Pin` 包装 `Box` 来实现这一点。）关键在于自我引用的类型本身不能移动，因为它仍然被固定了。

<figure>

<img alt="Four boxes laid out in three rough columns, identical to the previous diagram with a change to the second column. Now there are two boxes in the second column, labeled “b1” and “b2”, “b1” is grayed out, and the arrow from “Pin” goes through “b2” instead of “b1”, indicating that the pointer has moved from “b1” to “b2”, but the data in “pinned” has not moved." src="img/trpl17-07.svg" class="center" />

<figcaption>Figure 17-7: Moving a `Box` which points to a self-referential future type</figcaption>

</figure>

然而，大多数类型在移动时都是完全安全的，即使它们位于 `Pin` 指针之后。我们只有在项具有内部引用时才需要考虑固定问题。像数字和布尔值这样的基本值是安全的，因为它们显然没有内部引用。Rust 中通常使用的大多数类型也是安全的。例如，`Vec` 可以移动而无需担心。根据目前所见的情况，如果你有一个 `Pin<Vec<String>>`，你必须通过 `Pin` 提供的安全但受限的 API 来处理一切，即使如果没有其他引用，`Vec<String>` 总是可以安全移动的。我们需要一种方式告诉编译器在这种情况下移动项是安全的——这就是 `Unpin` 发挥作用的地方。

`Unpin` 是一个标记特质，类似于我们在第16章中看到的 `Send` 和 `Sync` 特质，因此没有自己的功能。标记特质的存在只是为了告诉编译器在特定上下文中使用实现特定特质的类型是安全的。`Unpin` 则告知编译器某个类型不需要保证所涉及值可以安全移动。

<!--
  下一行中的内联 `<code>` 是为了允许其中的内联 `<em>`，与 NoStarch 的样式一致，并在此处强调这是不同于普通类型的东西。 -->

就像 `Send` 和 `Sync` 一样，编译器会自动为所有可以证明安全的类型实现 `Unpin`。另一个特殊情况，类似于 `Send` 和 `Sync`，是对于某些类型不实现 `Unpin`。这种表示方式为 <code>实现 !Unpin for <em>SomeType</em></code>，其中
<code><em>SomeType</em></code> is the name of a type that _does_ need to uphold
这些保证在使用指向该类型的指针作为 `Pin` 时都是安全的。

换句话说，关于 `Pin` 和 `Unpin` 之间的关系有两个需要注意的点。首先，`Unpin` 是“正常”情况，`!Unpin` 是特殊情况。其次，一个类型是否实现 `Unpin` 或 `!Unpin` 只在使用指向该类型的固定指针时重要，例如 <code>Pin<&mut
<em>SomeType</em>></code>.

具体来说，以 `String` 为例：它具有长度以及构成它的 Unicode 字符。我们可以像图 17-8 所示那样将 `String` 包裹在 `Pin` 中。然而，`String` 自动实现了 `Unpin`，Rust 中的大多数其他类型也是如此。

<figure>

<img alt="A box labeled “Pin” on the left with an arrow going from it to a box labeled “String” on the right. The “String” box contains the data 5usize, representing the length of the string, and the letters “h”, “e”, “l”, “l”, and “o” representing the characters of the string “hello” stored in this String instance. A dotted rectangle surrounds the “String” box and its label, but not the “Pin” box." src="img/trpl17-08.svg" class="center" />

<figcaption>Figure 17-8: Pinning a `String`; the dotted line indicates that the `String` implements the `Unpin` trait and thus is not pinned</figcaption>

</figure>

因此，我们可以执行一些在 `String` 实现 `!Unpin` 时将是非法的操作，例如在内存的同一位置用另一个字符串替换一个字符串，如图 17-9 所示。这并不违反 `Pin` 契约，因为 `String` 没有内部引用，使得移动它是不安全的。正因如此，它实现了 `Unpin` 而不是 `!Unpin`。

<figure>

<img alt="The same “hello” string data from the previous example, now labeled “s1” and grayed out. The “Pin” box from the previous example now points to a different String instance, one that is labeled “s2”, is valid, has a length of 7usize, and contains the characters of the string “goodbye”. s2 is surrounded by a dotted rectangle because it, too, implements the Unpin trait." src="img/trpl17-09.svg" class="center" />

<figcaption>Figure 17-9: Replacing the `String` with an entirely different `String` in memory</figcaption>

</figure>

现在我们已经了解足够多的信息，可以理解列表 17-23 中 `join_all` 调用所报告的错误。我们最初试图将异步块产生的未来值移动到 `Vec<Box<dyn Future<Output = ()>>>` 中，但正如我们所见，这些未来值可能包含内部引用，因此它们不会自动实现 `Unpin`。一旦我们将它们固定为 `Pin` 类型，就可以将结果 `Pin` 类型传递给 `Vec`，并确信未来值中的底层数据不会被移动。列表 17-24 展示了如何通过在每个三个未来值定义处调用 `pin!` 宏并调整特质对象类型来修复代码。

<Listing number="17-24" caption="Pinning the futures to enable moving them into the vector">

```rust
{{#rustdoc_include ../listings/ch17-async-await/listing-17-24/src/main.rs:here}}
```

</Listing>

这个示例现在可以编译并运行，我们可以在运行时向向量中添加或移除未来值，并将它们全部连接起来。

`Pin` 和 `Unpin` 对于构建低级库或构建运行时本身非常重要，而不是用于日常 Rust 代码。不过，当您在错误消息中看到这些特性时，您就会更清楚如何修复您的代码了！

> 注意：这种 `Pin` 与 `Unpin` 的组合使得在 Rust 中安全实现一类复杂的自引用类型成为可能，否则这些类型会非常困难。如今，需要 `Pin` 的类型在异步 Rust 中最为常见，但偶尔也会在其他上下文中出现。
>
> 关于 `Pin` 和 `Unpin` 的工作原理及其必须遵守的规则，在 `std::pin` 的 API 文档中有详细的说明，如果你有兴趣进一步了解，这里是一个很好的起点。
>
> 如果你想更详细地了解其内部机制，可以查看 [_Asynchronous Programming in Rust_][异步-book]中的第 [2][under-the-hood]<!-- ignore -->章和第 [4][pinning]<!-- ignore -->章。

### `Stream` trait

现在你已经对 `Future`、`Pin` 和 `Unpin` trait有了更深入的理解，我们可以把注意力转向 `Stream` trait。正如本章前面所学的，流与异步迭代器类似。然而，与 `Iterator` 和 `Future` 不同，截至本文撰写时，`Stream` 在标准库中没有定义，但 `futures` crate 中有一种非常常见的定义被整个生态系统广泛使用。

在探讨 `Stream` trait如何结合这两种特性之前，让我们先回顾一下 `Iterator` 和 `Future` trait的定义。从 `Iterator` 中，我们获得了序列的概念：其 `next` 方法返回一个 `Option<Self::Item>`。从 `Future` 中，我们获得了时间上的准备概念：其 `poll` 方法返回一个 `Poll<Self::Output>`。为了表示随时间变得可用的项序列，`Stream` trait将这两种特性结合在一起。

```rust
use std::pin::Pin;
use std::task::{Context, Poll};

trait Stream {
    type Item;

    fn poll_next(
        self: Pin<&mut Self>,
        cx: &mut Context<'_>
    ) -> Poll<Option<Self::Item>>;
}
```

`Stream` trait定义了一个关联类型 `Item`，用于描述流产生的项类型。这与 `Iterator` 类似，可能包含零个到多个项；但与 `Future` 不同，`Stream` 中总是有一个单一的 `Output`，即使它是单位类型 `()`。

`Stream` 还定义了获取这些项的方法。我们将其称为 `poll_next`，以明确它像 `Future::poll` 一样进行轮询，并且像 `Iterator::next` 一样生成项序列。其返回类型结合了 `Poll` 和 `Option`。外层类型是 `Poll`，因为必须检查其是否可用，就像未来一样。内层类型是 `Option`，因为它需要指示是否有更多消息，就像迭代器一样。

与这一定义非常相似的内容很可能会成为 Rust 标准库的一部分。与此同时，它也是大多数运行时工具包中的一部分，因此你可以依赖它，我们接下来讨论的所有内容通常都适用！

然而，在 [“Streams: Futures in Sequence”][streams]<!-- ignore --> 部分中看到的示例里，我们没有使用 `poll_next` _或_ `Stream`，而是使用了 `next` 和 `StreamExt`。当然，我们可以通过手动编写自己的 `Stream` 状态机来直接使用 `poll_next` API；同样，我们也可以直接通过 `poll` 方法处理未来值。不过，使用 `await` 更为方便，`StreamExt` trait 提供了 `next` 方法，因此我们可以这样做：

```rust
{{#rustdoc_include ../listings/ch17-async-await/no-listing-stream-ext/src/lib.rs:here}}
```

<!--
TODO: 如果 tokio 等库更新了他们的 MSRV，并开始在 traits 中使用异步函数，则需要更新此内容，因为目前没有这些特性正是他们没有使用的原因。 -->

> 注意：本章前面使用的实际定义与现在略有不同，因为它支持那些尚未在 traits 中使用异步函数的 Rust 版本。因此，它的样子如下：
>
> ```rust,ignore
> fn next(&mut self) -> Next<'_, Self> where Self: Unpin;
> ```
>
> 那个 `Next` 类型是一个实现了 `Future` 的 `struct`，它允许我们用 `Next<'_, Self>` 来命名对 `self` 的引用生命周期，这样 `await` 就可以与该方法协同工作。

`StreamExt` trait 也是所有可用于流操作的有用方法的归属地。`StreamExt` 会自动为所有实现 `Stream` 的类型实现这些方法，但这些 traits 是单独定义的，以便社区可以迭代便利 API，而不影响基础 trait。

在 `trpl` crate 中使用的 `StreamExt` 版本中，该 trait 不仅定义了 `next` 方法，还提供了 `next` 的默认实现，能够正确处理调用 `Stream::poll_next` 的细节。这意味着即使你需要编写自己的流数据类型，也只需实现 `Stream`，然后使用你数据类型的任何人都可以自动使用 `StreamExt` 及其方法。

这就是我们关于这些特性底层细节的所有内容。最后，让我们探讨一下未来函数（包括流）、任务和线程是如何相互关联的！

[message-passing]: ch17-02-concurrency-with-async.md#sending-data-between-two-tasks-using-message-passing
[ch-18]: ch18-00-oop.html
[async-book]: https://rust-lang.github.io/async-book/
[under-the-hood]: https://rust-lang.github.io/async-book/02_execution/01_chapter.html
[pinning]: https://rust-lang.github.io/async-book/04_pinning/01_chapter.html
[first-async]: ch17-01-futures-and-syntax.html#our-first-async-program
[any-number-futures]: ch17-03-more-futures.html#working-with-any-number-of-futures
[streams]: ch17-04-streams.html
