## 定义枚举

与结构体能够将相关字段和数据组合在一起不同，例如一个包含 `width` 和 `height` 的 `Rectangle`，枚举则用于表示某个值属于一组可能的取值之一。例如，我们可能想表示 `Rectangle` 是多种形状中的一种，这些形状还包括 `Circle` 和 `Triangle`。为此，Rust 允许我们将这些可能性编码为枚举。

让我们来看一个在代码中需要表达的情况，并了解为什么在这种情况下枚举比结构体更实用且合适。假设我们需要处理 IP 地址。目前，有两个主要标准的 IP 地址：版本四和版本六。由于这是程序将遇到的唯一 IP 地址类型，我们可以_枚举出_所有可能的变体，这就是枚举名称的由来。

任何 IP 地址都可以是版本四或版本六地址，但不能同时是两者。IP 地址的这一特性使得枚举数据结构很合适，因为枚举值只能属于其一个变体。尽管版本四和版本六地址本质上都是 IP 地址，但在处理适用于所有类型 IP 地址的情况时，它们应被视为同一类型。

我们可以通过定义 `IpAddrKind` 枚举并在其中列出 IP 地址可能的类型 `V4` 和 `V6` 来在代码中表达这一概念。这些是枚举的变体：

```rust
{{#rustdoc_include ../listings/ch06-enums-and-pattern-matching/no-listing-01-defining-enums/src/main.rs:def}}
```

`IpAddrKind` 现在是一个自定义数据类型，可以在代码的其他部分使用。

### 枚举值

我们可以像这样创建 `IpAddrKind` 的两个变体的实例：

```rust
{{#rustdoc_include ../listings/ch06-enums-and-pattern-matching/no-listing-01-defining-enums/src/main.rs:instance}}
```

请注意，枚举的变体在其标识符下具有命名空间，我们使用双冒号来分隔它们。这很有用，因为现在 `IpAddrKind::V4` 和 `IpAddrKind::V6` 都是同一类型：`IpAddrKind`。然后，我们可以定义一个接受任何 `IpAddrKind` 的函数：

```rust
{{#rustdoc_include ../listings/ch06-enums-and-pattern-matching/no-listing-01-defining-enums/src/main.rs:fn}}
```

我们可以用任一变体调用这个函数：

```rust
{{#rustdoc_include ../listings/ch06-enums-and-pattern-matching/no-listing-01-defining-enums/src/main.rs:fn_call}}
```

使用枚举还有更多的优势。以我们的 IP 地址类型为例，目前我们没有方法存储实际的 IP 地址数据；我们只知道它的类型。鉴于你刚刚在第 5 章学习了结构体，你可能会倾向于像清单 6-1 中那样使用结构体来解决这个问题。

<Listing number="6-1" caption="Storing the data and `IpAddrKind` variant of an IP address using a `struct`">

```rust
{{#rustdoc_include ../listings/ch06-enums-and-pattern-matching/listing-06-01/src/main.rs:here}}
```

</Listing>

在这里，我们定义了一个名为 `IpAddr` 的结构体，它包含两个字段：一个类型为 `IpAddrKind`（即之前定义的枚举）的 `kind` 字段，以及一个类型为 `String` 的 `address` 字段。我们有两个该结构体的实例。第一个是 `home`，其 `kind` 值为 `IpAddrKind::V4`，关联的地址数据为 `127.0.0.1`。第二个实例是 `loopback`，其 `kind` 值属于另一种 `IpAddrKind` 类型，即 `V6`，关联的地址为 `::1`。我们使用结构体将 `kind` 和 `address` 的值组合在一起，因此现在每个变体都与一个具体的值相关联。

然而，仅使用枚举来表示相同的概念更为简洁：我们不必在结构体内部使用枚举，而是可以直接将数据放入每个枚举变体中。这种对 `IpAddr` 枚举的新定义表明，`V4` 和 `V6` 变体都将具有关联的 `String` 值。

```rust
{{#rustdoc_include ../listings/ch06-enums-and-pattern-matching/no-listing-02-enum-with-data/src/main.rs:here}}
```

我们直接将数据附加到枚举的每种变体中，因此不需要额外的结构体。此外，这也更容易看出枚举的工作原理：我们定义的每个枚举变体的名称也会成为一个构造该枚举实例的函数。也就是说，`IpAddr::V4()` 是一个函数调用，它接受一个 `String` 参数并返回一个 `IpAddr` 类型的实例。这种构造函数会自动作为定义枚举的结果而存在。

使用枚举而非结构体还有另一个优势：每个变体可以具有不同的类型和不同量的关联数据。第四版 IP 地址总是包含四个数值组件，其值介于 0 到 255 之间。如果我们想将 `V4` 地址存储为四个 `u8` 值，而仍然将 `V6` 地址表示为一个 `String` 值，使用结构体则无法实现。但枚举可以轻松处理这种情况：

```rust
{{#rustdoc_include ../listings/ch06-enums-and-pattern-matching/no-listing-03-variants-with-different-data/src/main.rs:here}}
```

我们已经展示了几种不同的方法来定义数据结构，用于存储版本四和版本六的 IP 地址。然而，事实证明，存储 IP 地址并编码其类型是非常常见的做法，以至于[标准库中有一个我们可以使用的定义！][IpAddr]<!-- ignore --> 让我们看看标准库是如何定义 `IpAddr` 的。它包含了我们之前定义的 exact 枚举 和 variants，但将地址数据以两种不同结构的形式嵌入到 variants 中，每种 variant 的定义也各不相同：

```rust
struct Ipv4Addr {
    // --snip--
}

struct Ipv6Addr {
    // --snip--
}

enum IpAddr {
    V4(Ipv4Addr),
    V6(Ipv6Addr),
}
```

这段代码说明你可以将任何类型的数据放入枚举 variant 中：例如字符串、数值类型或结构体。甚至还可以包含另一个枚举！此外，标准库中的类型通常并不比你可能设计的复杂得多。

请注意，尽管标准库包含了 `IpAddr` 的定义，我们仍然可以创建并使用自己的定义而不会产生冲突，因为我们没有将标准库的定义引入到我们的作用域中。我们将在第7章进一步讨论如何将类型纳入作用域。

让我们看看列表 6-2 中的另一个枚举示例：这个枚举的 variant 中包含了多种不同的类型。

<Listing number="6-2" caption="A `Message` enum whose variants each store different amounts and types of values">

```rust
{{#rustdoc_include ../listings/ch06-enums-and-pattern-matching/listing-06-02/src/main.rs:here}}
```

</Listing>

该枚举有四种不同类型的 variant：

- `Quit`：没有任何关联数据 - `Move`：具有命名字段，类似于结构体 - `Write`：包含一个 `String` - `ChangeColor`：包含三个 `i32` 值

像列表 6-2 中的这种带有 variant 的枚举定义，与定义不同种类的结构体类似，只是枚举不使用 `struct` 关键字，且所有 variant 都归在 `Message` 类型下。以下结构体可以存储与前面的枚举 variant 相同的数据：

```rust
{{#rustdoc_include ../listings/ch06-enums-and-pattern-matching/no-listing-04-structs-similar-to-message-enum/src/main.rs:here}}
```

但如果我们使用不同的结构体，每个都有自己独特的类型，那么我们就无法像使用列表 6-2 中定义的单一类型的 `Message` 枚举那样，轻松定义一个接受这些消息的函数了。

枚举和结构体还有另一个相似之处：就像我们可以使用 `impl` 在结构体上定义方法一样，我们也可以在枚举上定义方法。以下是在 `Message` 枚举上可以定义的名为 `call` 的方法：

```rust
{{#rustdoc_include ../listings/ch06-enums-and-pattern-matching/no-listing-05-methods-on-enums/src/main.rs:here}}
```

该方法的主体会使用 `self` 来获取调用该方法时所操作的值。在这个例子中，我们创建了一个变量 `m`，其值为 `Message::Write(String::from("hello"))`，当执行 `m.call()` 时，`self` 就表示这个值。

让我们来看看标准库中另一个非常常见且有用的枚举：`Option`。

<!-- Old headings. Do not remove or links may break. -->

<a id="the-option-enum-and-its-advantages-over-null-values"></a>

### `Option` 枚举

本部分将探讨 `Option` 的一个案例研究，这是标准库定义的另一个枚举。`Option` 类型描述了一种非常常见的场景：一个值可以是某种东西，也可以什么都不是。

例如，如果你请求非空列表中的第一个元素，你将得到一个值；如果请求空列表中的第一个元素，则得不到任何值。用类型系统来表达这个概念意味着编译器可以检查你是否处理了所有应该处理的情形；这种功能能够防止其他编程语言中常见的错误。

编程语言的设计通常从所包含的功能角度来考虑，但被排除的功能同样重要。Rust 没有许多其他语言拥有的 `null` 特性。`_Null_` 是一个表示没有值的变量。在具有 `null` 的语言中，变量总是处于两种状态之一：null 或 not-null。

在 2009 年的演讲“Null References: The Billion Dollar Mistake”中，`null` 的发明者 Tony Hoare 这样说道：

> 我将其称为我的十亿美元错误。当时，我正在设计一种面向对象的语言中首个全面的引用类型系统。我的目标是确保所有对引用的使用都绝对安全，并由编译器自动进行检查。但我不禁被添加空引用这一做法所吸引，因为实现起来非常简单。这导致了无数错误、漏洞和系统崩溃，在过去的四十年里可能造成了十亿美元的损失和损害。

空值的问题在于，如果你试图将空值当作非空值使用，就会引发某种错误。由于这种非空或非空属性普遍存在，因此很容易出现此类错误。

然而，空所试图表达的概念仍然很有用：空是一个因某种原因目前无效或不存在的值。

问题并不在概念本身，而在具体的实现方式上。因此，Rust 没有空值，但它有一个枚举可以表示值存在或不存在的概念。这个枚举就是 `Option<T)`，它由标准库定义如下：

```rust
enum Option<T> {
    None,
    Some(T),
}
```

`Option<T>` 枚举非常有用，甚至被包含在预lude中；你无需显式将其引入作用域。其变体也包含在预lude中：你可以直接使用 `Some` 和 `None`，而不需要加上 `Option::` 前缀。`Option<T>` 枚举仍然只是一个普通的枚举，`Some(T)` 和 `None` 仍然是 `Option<T>` 类型的变体。

`<T>` 语法是 Rust 的一个特性，我们尚未讨论过。它是一个泛型类型参数，我们将在第10章中更详细地介绍泛型。目前，你需要知道的是 `<T>` 意味着 `Option` 枚举的 `Some` 变体可以存储任何类型的数据，而每个具体类型作为 `T` 的替代使用时，整个 `Option<T>` 类型就会变成不同的类型。以下是使用 `Option` 值存储数字类型和字符类型的一些示例：

```rust
{{#rustdoc_include ../listings/ch06-enums-and-pattern-matching/no-listing-06-option-examples/src/main.rs:here}}
```

`some_number` 的类型是 `Option<i32>`。而 `some_char` 的类型是 `Option<char)`，这是不同的类型。Rust 能够推断出这些类型，因为我们在 `Some` 变体中指定了一个值。对于 `absent_number`，Rust 要求我们对整个 `Option` 类型进行注释：仅通过查看 `None` 值，编译器无法推断出对应的 `Some` 变体将持有什么类型。在这里，我们告诉 Rust，我们希望 `absent_number` 具有 `Option<i32>` 类型。

当我们有一个 `Some` 值时，我们知道存在一个值，并且该值被存储在 `Some` 中。当我们有一个 `None` 值时，在某种意义上说它等同于 null：我们没有有效的数值。那么，为什么使用 `Option<T>` 比使用 null 更好呢？

简而言之，因为 `Option<T>` 和 `T`（其中 `T` 可以是任何类型）是不同的类型，编译器不会允许我们将 `Option<T>` 值当作绝对有效的数值来使用。例如，这段代码无法编译，因为它试图将 `i8` 加到 `Option<i8>` 上。

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch06-enums-and-pattern-matching/no-listing-07-cant-use-option-directly/src/main.rs:here}}
```

如果我们运行这段代码，会得到如下错误消息：

```console
{{#include ../listings/ch06-enums-and-pattern-matching/no-listing-07-cant-use-option-directly/output.txt}}
```

非常严重！实际上，这个错误消息意味着 Rust 不知道如何将 `i8` 和 `Option<i8>` 相加，因为它们是不同的类型。在 Rust 中，当我们有像 `i8` 这样的数值时，编译器会确保我们始终拥有有效的数值。我们可以放心地使用该值，无需在使用前检查是否为 null。只有当我们有一个 `Option<i8>`（或任何我们正在处理的类型）时，才需要担心可能没有值的情况，而编译器会在使用该值之前确保我们处理这种情况。

换句话说，在对 `Option<T>` 执行 `T` 操作之前，你必须将其转换为 `T`。通常，这有助于避免最常见的 null 问题之一：假设某物不是 null，但实际上它是。

消除错误假设非空值的风险有助于增强代码信心。为了允许存在可能为空的数值，你必须通过将该值的类型定义为 `Option<T>` 来明确选择这种可能性。然后，当你使用该值时，必须显式处理值为空的情况。在任何非 `Option<T>` 类型的位置，你可以安全地假设该值不是空的。这是 Rust 的刻意设计决策，旨在限制空值的普遍性并提升 Rust 代码的安全性。

那么当有一个类型为 `Option<T>` 的值时，如何从 `Some` 变体中提取出 `T` 值以便使用呢？`Option<T>` 枚举包含大量在多种情况下非常有用的方法；你可以查看其文档了解这些方法。熟悉 `Option<T>` 上的方法将对你的 Rust 学习过程极为有帮助。

通常，要使用 `Option<T>` 值，你需要编写能够处理每个变体的代码。有些代码仅在存在 `Some(T)` 值时运行，并且这些代码可以访问内部的 `T` 值；另一些代码则仅在存在 `None` 值时运行，且这些代码无法访问 `T` 值。`match` 表达式是一种控制流构造，当与枚举一起使用时即可实现此功能：它根据枚举的变体执行不同的代码，并且这些代码可以使用匹配值中的数据。

[IpAddr]: ../std/net/enum.IpAddr.html
[option]: ../std/option/enum.Option.html
[docs]: ../std/option/enum.Option.html
