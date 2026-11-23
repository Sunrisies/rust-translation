## 使用 `Box<T>` 指向堆上的数据

最简单的智能指针就是 `Box`，其类型为 `Box<T`。`Boxes` 允许你在堆上存储数据，而不是在栈上。留在栈上的只是对堆数据的指针。请参考第4章以了解栈和堆之间的区别。

除了将数据存储在堆上而非栈上之外，`Boxes` 没有性能开销。但它们也没有太多额外功能。你会在以下情况下最常使用它们：

- 当有一个在编译时无法确定的类型大小，而你希望在需要精确大小的上下文中使用该类型的值时 - 当你有大量数据，并且希望转移所有权，但确保数据在转移过程中不会被复制时 - 当你想要拥有一个值，而只关心它是实现特定 trait 的类型而不是特定的具体类型时

我们将在[“使用 `Boxes` 启用递归类型”](#enabling-recursive-types-with-boxes)中演示第一种情况。在第二种情况下，转移大量数据的所有权可能需要很长时间，因为数据会在栈上被复制。为了改善性能，我们可以将大量数据存储在堆上的 `Box` 中。这样，只有少量的指针数据会在栈上被复制，而它引用的数据则保持在堆中的一个位置。第三种情况被称为_ trait 对象_，第18章中的[“使用 trait 对象来抽象共享行为”][trait-objects]<!-- ignore -->专门讨论这个主题。因此，你在这里学到的内容将在该章节中再次应用！

<!-- Old headings. Do not remove or links may break. -->

<a id="using-boxt-to-store-data-on-the-heap"></a>

### 在堆上存储数据

在讨论 `Box<T>` 的堆存储用例之前，我们将介绍语法以及如何与存储在 `Box<T>` 中的值进行交互。

列表 15-1展示了如何使用一个 `Box` 在堆上存储 `i32` 值。

<Listing number="15-1" file-name="src/main.rs" caption="Storing an `i32` value on the heap using a box">

```rust
{{#rustdoc_include ../listings/ch15-smart-pointers/listing-15-01/src/main.rs}}
```

</Listing>

我们定义变量 `b` 的值为一个指向值 `5` 的 `Box`，该值存储在堆上。此程序将输出 `b = 5`；在这种情况下，我们可以像访问栈上的数据一样访问盒中的数据。就像任何拥有权的值一样，当盒子超出作用域时（如 `main` 函数的末尾的 `b`），它将被释放。释放操作既针对盒子本身（存储在栈上），也针对其指向的数据（存储在堆上）。

将单个值放在堆上并没有太大用处，因此你不会经常以这种方式单独使用盒子。在大多数情况下，将像单个 `i32` 这样的值存储在栈上更为合适，因为默认就是如此存储的。让我们来看一个例子，说明有了盒子后我们可以定义一些没有盒子就无法定义的类型。

### 通过盒子实现递归类型

_递归类型_ 的值可以包含另一个相同类型的值作为其一部分。递归类型存在一个问题，因为 Rust 需要在编译时知道一个类型占用的空间大小。然而，递归类型值的嵌套理论上可以无限进行，因此 Rust 无法知道该值需要多少空间。由于盒子具有已知的大小，我们可以通过在递归类型定义中插入一个盒子来实现递归类型。

作为递归类型的例子，让我们探讨 cons 列表。这是一种常见于函数式编程语言的数据类型。我们将要定义的 cons 列表类型除了递归部分外非常简单，因此我们在示例中使用的概念将在处理涉及递归类型的更复杂情况时非常有用。

<!-- Old headings. Do not remove or links may break. -->

<a id="more-information-about-the-cons-list"></a>

#### 理解 cons 列表

_cons列表_是一种源自Lisp编程语言及其变体的数据结构，由嵌套对组成，是Lisp版本的链表。其名称来自Lisp中的`cons`函数（即_构造函数_），该函数通过两个参数构建一个新的对。通过对一个包含值与另一个对的组合调用`cons`函数，我们可以构建由递归对组成的cons列表。

例如，以下是包含列表`1, 2, 3`的cons列表的伪代码表示，其中每个对都用括号括起来：

```text
(1, (2, (3, Nil)))
```

cons列表中的每个元素包含两个元素：当前元素的值和下一个元素的值。列表中的最后一个元素仅包含一个名为`Nil`的值，没有下一个元素。cons列表是通过递归调用`cons`函数产生的。表示递归基础情况的规范名称是`Nil`。请注意，这与第6章中讨论的“空值”或“nil”概念不同，后者指的是无效或不存在的值。

在Rust中，cons列表不是常用的数据结构。大多数情况下，当需要包含多个元素的列表时，`Vec<T>`是更好的选择。其他更复杂的递归数据类型在某些情境下很有用，但通过在本章从cons列表开始，我们可以探讨如何利用盒子来定义不需要太多干扰的递归数据类型。

清单15-2中包含了cons列表的枚举定义。请注意，由于`List`类型没有已知的大小，因此这段代码目前无法编译，我们将在后续演示中展示这一点。

<Listing number="15-2" file-name="src/main.rs" caption="The first attempt at defining an enum to represent a cons list data structure of `i32` values">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch15-smart-pointers/listing-15-02/src/main.rs:here}}
```

</Listing>

> 注意：为了本示例的目的，我们实现了一个仅包含`i32`值的cons列表。正如我们在第10章中讨论的那样，我们可以使用泛型来实现它，从而定义可以存储任何类型值的cons列表类型。

使用`List`类型来存储列表`1, 2, 3`的代码类似于清单15-3中的代码。

<Listing number="15-3" file-name="src/main.rs" caption="Using the `List` enum to store the list `1, 2, 3`">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch15-smart-pointers/listing-15-03/src/main.rs:here}}
```

</Listing>

第一个 `Cons` 值包含 `1`，另一个为 `List` 值。这个 `List` 值又是另一个 `Cons` 值，该值包含 `2` 和另一个 `List` 值。再往下一个 `Cons` 值中，包含 `3` 和一个 `List` 值，最终得到 `Nil`，即非递归变体，表示列表的结束。

如果我们尝试编译清单 15-3 中的代码，就会得到清单 15-4 中显示的错误。

<Listing number="15-4" caption="The error we get when attempting to define a recursive enum">

```console
{{#include ../listings/ch15-smart-pointers/listing-15-03/output.txt}}
```

</Listing>

错误提示该类型“具有无限大小”。原因是我们定义了具有递归特性的 `List` 变体：它直接包含自身的另一个值。因此，Rust 无法确定存储一个 `List` 值需要多少空间。让我们来解析为什么会出现此错误。首先，看看 Rust 如何确定非递归类型的值所需的空间。

#### 计算非递归类型的大小

回想一下我们在第 6 章讨论枚举定义时在清单 6-2 中定义的 `Message` 枚举：

```rust
{{#rustdoc_include ../listings/ch06-enums-and-pattern-matching/listing-06-02/src/main.rs:here}}
```

为了确定为 `Message` 值分配多少空间，Rust 会逐一检查每个变体，找出需要最多空间的变体。Rust 发现 `Message::Quit` 不需要任何空间，`Message::Move` 则需要足够的空间来存储两个 `i32` 值，依此类推。由于只有一种变体会被使用，因此 `Message` 值所需的最大空间就是其最大变体所占用空间。

与 Rust 尝试确定像清单 15-2 中的 `List` 枚举这样的递归类型需要多少空间时的情况形成对比。编译器首先查看 `Cons` 变体，该变体包含一个 `i32` 类型和一个 `List` 类型的值。因此，`Cons` 需要的空间等于 `i32` 的大小加上 `List` 的大小。为了确定 `List` 类型所需的内存量，编译器会依次检查所有变体，从 `Cons` 变体开始。`Cons` 变体包含一个 `i32` 类型和一个 `List` 类型的值，这个过程无限循环进行，如图 15-1 所示。

<img alt="An infinite Cons list: a rectangle labeled 'Cons' split into two smaller rectangles. The first smaller rectangle holds the label 'i32', and the second smaller rectangle holds the label 'Cons' and a smaller version of the outer 'Cons' rectangle. The 'Cons' rectangles continue to hold smaller and smaller versions of themselves until the smallest comfortably sized rectangle holds an infinity symbol, indicating that this repetition goes on forever." src="img/trpl15-01.svg" class="center" style="width: 50%;" />

<span class="caption">Figure 15-1: An infinite `List` consisting of infinite
`Cons` 变体

<!-- Old headings. Do not remove or links may break. -->

<a id="using-boxt-to-get-a-recursive-type-with-a-known-size"></a>

#### 获取已知大小的递归类型

由于 Rust 无法确定递归定义类型所需的空间大小，编译器会给出以下有用的建议错误：

<!-- manual-regeneration
进行自动生成后，请查看 listings/ch15-smart-pointers/listing-15-03/output.txt 并复制相关行 -->

```text
help: insert some indirection (e.g., a `Box`, `Rc`, or `&`) to break the cycle
  |
2 |     Cons(i32, Box<List>),
  |               ++++    +
```

在这个建议中，_间接性_意味着我们不应直接存储值，而应通过存储指向值的指针来间接存储数据，从而改变数据结构。

因为 `Box<T>` 是一个指针，Rust 总是知道 `Box<T>` 需要多少空间：指针的大小不随其指向的数据量而变化。这意味着我们可以将 `Box<T>` 放在 `Cons` 变体中，而不是直接放在另一个 `List` 值内。此时，`Box<T>` 会指向堆上下一个 `List` 值，而非位于 `Cons` 变体中。从概念上讲，我们仍然有一个列表，由包含其他列表的列表构成，但这种实现方式更像是将元素并排放置，而不是嵌套在一起。

我们可以修改 Listing 15-2 中的 `List` 枚举定义和 Listing 15-3 中的 `List` 使用方式，使其与 Listing 15-5 中的代码兼容，从而能够编译通过。

<Listing number="15-5" file-name="src/main.rs" caption="The definition of `List` that uses `Box<T>` in order to have a known size">

```rust
{{#rustdoc_include ../listings/ch15-smart-pointers/listing-15-05/src/main.rs}}
```

</Listing>

`Cons` 变体需要一个 `i32` 的大小加上存储盒子指针数据的空间。`Nil` 变体不存储任何值，因此其在栈上的空间需求比 `Cons` 变体更少。我们现在知道任何 `List` 值都会占用一个 `i32` 的大小加上盒子指针数据的大小。通过使用盒子，我们打破了无限递归链，因此编译器可以确定存储 `List` 值所需的空间大小。图 15-2 展示了现在 `Cons` 变体的样子。

<img alt="A rectangle labeled 'Cons' split into two smaller rectangles. The first smaller rectangle holds the label 'i32', and the second smaller rectangle holds the label 'Box' with one inner rectangle that contains the label 'usize', representing the finite size of the box's pointer." src="img/trpl15-02.svg" class="center" />

<span class="caption">Figure 15-2: A `List` that is not infinitely sized,
因为 `Cons` 持有一个 `Box`

盒子仅提供间接性和堆分配功能；它们没有其他特殊能力，如我们将在其它智能指针类型中看到的那些。它们也没有这些特殊能力带来的性能开销，因此在某些情况下（例如 cons 列表）可以很有用，此时间接性是我们唯一需要的特性。我们将在第 18 章中探讨更多盒子的使用场景。

`Box<T>` 类型是一个智能指针，因为它实现了 `Deref` trait，这使得 `Box<T>` 值可以被当作引用处理。当 `Box<T>` 值超出作用域时，由于 `Drop` trait 的实现，`Box` 所指向的堆数据也会被清理。这两个 trait 对于本章后续我们将讨论的其他智能指针类型所提供的功能来说更为重要。让我们更详细地探讨这两个 trait。

[trait-objects]: ch18-02-trait-objects.html#using-trait-objects-to-abstract-over-shared-behavior
