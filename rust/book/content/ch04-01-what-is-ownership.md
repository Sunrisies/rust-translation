## 什么是所有权？

_所有权_是一组规则，用于规范 Rust 程序如何管理内存。所有程序在运行时都必须管理其使用的计算机内存。一些语言具有垃圾回收机制，会在程序运行时定期查找不再使用的内存；而在其他语言中，程序员必须手动分配和释放内存。Rust 则采用第三种方式：通过一套由编译器检查的规则来管理系统中的内存所有权。如果违反任何规则，程序将无法编译。所有权的所有特性都不会在程序运行时降低其性能。

由于所有权对许多程序员来说是一个新概念，因此需要一些时间才能适应。好消息是，你越熟悉 Rust 和所有权系统的规则，就越容易自然地编写安全且高效的代码。坚持努力吧！

当你理解了所有权后，你就能为理解使 Rust 与众不同的特性打下坚实的基础。在本章中，你将通过一些以字符串这一常见数据结构为重点的示例来学习所有权。

> ### 栈和堆
>
> 许多编程语言并不要求你经常考虑栈和堆。但在像 Rust 这样的系统级编程语言中，值位于栈还是堆会影响语言的行为以及你需要做出哪些决策。本章稍后部分将结合栈和堆来描述所有权的某些内容，因此这里提供一个简要说明作为准备。
>
> 栈和堆都是代码在运行时可以使用的内存部分，但它们的结构不同。栈按照数据获得的顺序存储值，并以相反的顺序删除这些值。这被称为_后进先出 (LIFO)_. 你可以把栈想象成一叠盘子：当你添加更多盘子时，把它们放在最上面；当需要一个盘子时，就从最上面取一个。如果从中间或底部添加或移除盘子，效果会差很多！向栈中添加数据称为_压入栈中_，从栈中删除数据称为_弹出栈中_。栈中存储的所有数据必须具有已知的固定大小。在编译时大小未知或可能变化的数据必须存储在堆上。
>
> 堆的结构较为松散：当你将数据放入堆时，会请求一定量的空间。内存分配器会在堆中找到足够大的空位置，将其标记为正在使用，并返回一个_指针_，即该位置的地址。这个过程称为_在堆上分配_，有时简称为_分配_（向栈中压入值不被视为分配）。由于指向堆的指针具有已知的固定大小，你可以将指针存储在栈上，但当你需要实际数据时，必须跟随指针查找。可以想象你在餐厅就座的情况：进入后，你说明团队的人数，主人会找到一个适合所有人的空桌子并带你去那里。如果团队中的某个人迟到，他们可以通过询问你的座位位置来找到你。
>
> 向栈中压入数据比在堆上分配更快，因为分配器无需搜索存储新数据的位置；该位置始终位于栈的顶部。相比之下，在堆上分配空间需要更多工作，因为分配器必须首先找到足够大的空间来容纳数据，然后进行记录操作以准备下一次分配。
>
> 访问堆中的数据通常比访问栈中的数据慢，因为需要通过指针才能到达。现代处理器如果减少在内存中的跳转次数，效率就会更高。继续这个类比，想象一家餐厅的服务器从多个桌子接收订单。最高效的方式是在处理一个桌子上的所有订单后，再处理下一个桌子。如果从桌子A获取一个订单，然后从桌子B获取一个订单，然后再从桌子A获取一个订单，最后再从桌子B获取一个订单，这个过程就会慢得多。同理，如果处理器处理的数据靠近其他数据（如栈中的情况），其性能通常更好，而不是远离其他数据的位置（如堆中的情况）。
>
> 当你的代码调用一个函数时，传入函数的参数（可能包括指向堆中数据的指针）以及函数的局部变量都会被压入栈中。当函数执行完毕时，这些值会被从栈中弹出。
>
> 跟踪代码中哪些部分使用了堆中的数据、减少堆中重复数据的数量以及清理未使用的堆数据，这些都是所有权问题需要解决的事情。一旦理解了所有权概念，你就不需要频繁考虑栈和堆了。但知道所有权的主要目的是管理堆数据，这有助于解释其运作机制。

### 所有权规则

首先，让我们看看所有权规则。在通过示例理解这些规则时，请记住以下规则：

- Rust中的每个值都有一个_所有者_。
- 同时只能有一个所有者。
- 当所有者超出作用域时，该值会被释放。

### 变量作用域

现在我们已经掌握了基本的Rust语法，因此不会在示例中包含所有的`fn main() {`代码。如果你正在跟随示例，请确保手动将以下示例放在`main`函数中。这样，我们的示例会更为简洁，使我们能够专注于实际细节而非样板代码。

作为所有权的一个初步示例，我们将研究一些变量的作用域。_作用域_是指程序中某个变量有效的范围。以以下变量为例：

```rust
let s = "hello";
```

变量 `s` 指的是一个字符串字面量，该字符串的值被硬编码在程序文本中。该变量从声明点开始到当前作用域结束都是有效的。列表 4-1 展示了一个带有注释的程序，说明变量 `s` 在何处有效。

<Listing number="4-1" caption="A variable and the scope in which it is valid">

```rust
{{#rustdoc_include ../listings/ch04-understanding-ownership/listing-04-01/src/main.rs:here}}
```

</Listing>

换句话说，这里有两个重要的时间点：

- 当 `s` 进入作用域时，它是有效的。
- 它保持有效状态直到离开作用域。

此时，作用域与变量有效性之间的关系与其他编程语言类似。现在我们将基于这一理解引入 `String` 类型。

### `String` 类型

为了说明所有权规则，我们需要一种比第3章“数据类型”部分中讨论的更复杂的数据类型。之前讨论的类型具有已知大小，可以存储在栈上，在作用域结束时从栈上弹出，并且如果其他代码部分需要在不同作用域中使用相同的值，可以快速且简单地复制以创建新的独立实例。但我们要研究存储在堆上的数据，并探索 Rust 如何知道何时清理这些数据，`String` 类型就是一个很好的例子。

我们将重点讨论与所有权相关的 `String` 特性。这些特性也适用于其他复杂数据类型，无论是标准库提供的还是由您自己创建的。我们将在[第8章][ch8]<!-- ignore -->中讨论 `String` 的非所有权特性。

我们已经看到了字符串字面量，其中字符串值被硬编码到程序中。字符串字面量很方便，但并不适用于所有需要文本的情况。原因之一是它们是不可变的；另一个原因是我们在编写代码时无法预知每个字符串值的具体内容：例如，如果我们想要获取用户输入并将其存储起来呢？正是为了应对这些情况，Rust 才提供了 `String` 类型。该类型管理堆上分配的数据，因此能够在编译时存储我们无法预知的文本量。你可以使用 `from` 函数从字符串字面量创建 `String`，如下所示：

```rust
let s = String::from("hello");
```

双冒号 `::` 运算符允许我们将这个特定的 `from` 函数归类到 `String` 类型下，而不是使用像 `string_from` 这样的名称。我们将在第五章的 [“Methods”][methods]<!-- ignore --> 部分进一步讨论这种语法，以及在第七章的 [“Paths for Referring to an Item in the 模块 Tree”][paths-模块-tree]<!-- ignore --> 中关于模块命名空间的讨论中也会涉及此内容。

这种字符串_可以_被修改：

```rust
{{#rustdoc_include ../listings/ch04-understanding-ownership/no-listing-01-can-mutate-string/src/main.rs:here}}
```

那么，这里有什么区别呢？为什么 `String` 可以被修改而字面量不能呢？区别在于这两种类型处理内存的方式。

### 内存和分配

对于字符串字面量，我们在编译时就能知道其内容，因此文本直接被硬编码到最终可执行文件中。这就是字符串字面量快速且高效的原因。但这些特性仅来自字符串字面量的不可变性。不幸的是，我们无法将大量内存放入二进制文件中，因为编译时无法预知每个文本的大小，而且程序运行时大小也可能发生变化。

对于 `String` 类型，为了支持可修改、可增长的文本，我们需要在堆上分配一份编译时未知的内存来保存内容。这意味着：

- 运行时必须从内存分配器请求内存。
- 当使用完 `String` 后，我们需要一种方式将这部分内存返回给分配器。

第一部分由我们完成：当我们调用 `String::from` 时，其实现会请求所需内存。这在各种编程语言中都是普遍现象。

然而，第二部分有所不同。在具有 _垃圾收集器 (GC)_ 的语言中，GC 会跟踪并清理不再使用的内存，我们无需考虑这一点。而在大多数没有 GC 的语言中，识别何时内存不再被使用并调用代码来显式释放它则属于我们的责任，就像我们请求分配内存一样。正确执行这一操作历来是一个复杂的编程问题。如果忘记，就会浪费内存；如果过早执行，则会产生无效变量；如果重复执行两次，也会成为错误。我们必须确保恰好一次 `allocate` 对应一次 `free`。

Rust 采用了不同的方式：当拥有该内存的变量超出作用域时，内存会自动返回给分配器。以下是 Listing 4-1 中使用 `String` 而非字符串字面量的作用域示例版本：

```rust
{{#rustdoc_include ../listings/ch04-understanding-ownership/no-listing-02-string-scope/src/main.rs:here}}
```

有一个自然的点可以让我们在 `s` 超出作用域时将 `String` 所需的内存返回给分配器。当变量超出作用域时，Rust 会调用一个特殊函数。这个函数被称为 `drop`，是 `String` 的作者放置内存释放代码的地方。Rust 会在花括号闭合处自动调用 `drop`。

> 注意：在 C++ 中，这种在对象生命周期结束时释放资源的模式有时被称为 _资源获取初始化 (RAII)_. 如果你使用过 RAII 模式，那么 Rust 中的 `drop` 函数对你来说会很熟悉。

这种模式对 Rust 代码的编写方式产生了深远的影响。目前看起来可能很简单，但在更复杂的情况下，当多个变量需要使用在堆上分配的数据时，代码的行为可能会出乎意料。现在让我们来探讨一些这种情况。

<!-- Old headings. Do not remove or links may break. -->

<a id="ways-variables-and-data-interact-move"></a>

#### 变量与数据通过移动交互

在 Rust 中，多个变量可以以不同的方式与相同数据交互。Listing 4-2 展示了一个使用整数的示例。

<Listing number="4-2" caption="Assigning the integer value of variable `x` to `y`">

```rust
{{#rustdoc_include ../listings/ch04-understanding-ownership/listing-04-02/src/main.rs:here}}
```

</Listing>

我们或许可以猜到这是做什么的：“将值 `5` 绑定到 `x`；然后，复制 `x` 中的值并将其绑定到 `y`。现在我们有了两个变量，`x` 和 `y`，它们都等于 `5`。实际上确实如此，因为整数是具有已知固定大小的简单值，这两个 `5` 值被推入栈中。

现在让我们看看 `String` 版本：

```rust
{{#rustdoc_include ../listings/ch04-understanding-ownership/no-listing-03-string-move/src/main.rs:here}}
```

看起来非常相似，因此我们可能假设其工作原理也是相同的：即第二行会复制 `s1` 中的值并将其绑定到 `s2`。但实际上并非如此。

请查看图 4-1，了解 `String` 内部发生了什么。一个 `String` 由三部分组成，如左图所示：指向存储字符串内容的内存的指针、长度以及容量。这一组数据存储在栈上。右图则是堆中存储内容的内存。

<img alt="Two tables: the first table contains the representation of s1 on the
栈中包含其长度（5）、容量（5）以及指向第二个表中第一个值的指针。第二个表包含了堆上字符串数据的逐字节表示形式。

<span class="caption">Figure 4-1: The representation in memory of a `String`
其中包含值 `"hello"`，并绑定到 `s1` 上

长度是指 `String` 内容当前使用的内存大小，以字节为单位。容量是 `String` 从分配器那里获得的总内存量，以字节为单位。长度与容量之间的差值很重要，但在当前上下文中并不重要，因此目前可以忽略容量。

当我们将 `s1` 赋给 `s2` 时，`String` 数据被复制了，意味着我们复制了栈上的指针、长度和容量。我们没有复制指针所指向的堆上数据。换句话说，内存中的数据表示形式如图 4-2 所示。

<img alt="Three tables: tables s1 and s2 representing those strings on the
分别位于栈上，且都指向堆上相同的字符串数据。

<span class="caption">Figure 4-2: The representation in memory of the variable
`s2` 拥有 `s1` 的指针、长度和容量的副本

这种表示形式与图 4-3 不同，而图 4-3 展示了如果 Rust 也复制堆数据时的内存情况。如果 Rust 采用这种方式，如果堆上的数据很大，操作 `s2 = s1` 在运行时性能上可能会非常昂贵。

<img alt="Four tables: two tables representing the stack data for s1 and s2,
每个指针都指向堆上自己的字符串数据副本。” src="img/trpl04-03.svg" class="center" style="width: 50%;" />

<span class="caption">Figure 4-3: Another possibility for what `s2 = s1` might
如果 Rust 也复制了堆数据</span>

之前我们提到，当变量超出作用域时，Rust 会自动调用 `drop` 函数并清理该变量的堆内存。但图 4-2 显示两个数据指针指向同一个位置。这是一个问题：当 `s2` 和 `s1` 都超出作用域时，它们都会尝试释放相同的内存。这被称为 _双重释放_ 错误，也是我们之前提到的内存安全漏洞之一。两次释放内存可能导致内存损坏，进而可能引发安全漏洞。

为了确保内存安全，在 `let s2 = s1;` 之后，Rust 认为 `s1` 不再有效。因此，当 `s1` 超出作用域时，Rust 不需要释放任何内容。看看当你在 `s2` 创建后尝试使用 `s1` 时会发生什么；它不会生效：

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch04-understanding-ownership/no-listing-04-cant-use-after-move/src/main.rs:here}}
```

你会得到这样的错误，因为 Rust 阻止你使用已失效的引用：

```console
{{#include ../listings/ch04-understanding-ownership/no-listing-04-cant-use-after-move/output.txt}}
```

如果你在其他语言工作中听说过 _浅拷贝_ 和 _深拷贝_ 这些术语，复制指针、长度和容量而不复制数据的概念可能听起来像是进行浅拷贝。但由于 Rust 也会使第一个变量失效，它被称为 _移动_。在这个例子中，我们可以说 `s1` 被 _移动_ 到了 `s2` 中。因此，实际发生的情况如图 4-4 所示。

<img alt="Three tables: tables s1 and s2 representing those strings on the
分别位于栈上，并且都指向堆上的相同字符串数据。表 s1 被标为灰色，因为 s1 不再有效；只有 s2 可以用来访问堆数据。” src="img/trpl04-04.svg" class="center" style="width: 50%;" />

<span class="caption">Figure 4-4: The representation in memory after `s1` has
已被失效</span>

这解决了我们的问题！由于只有 `s2` 是有效的，当它超出作用域时，它会单独释放内存，我们就完成了任务。

此外，这里还隐含了一个设计选择：Rust 永远不会自动创建数据的“深度”副本。因此，任何_自动_复制在运行时性能方面都是高效的。

#### 作用域与赋值

对于作用域、所有权以及通过 `drop` 函数释放内存之间的关系，情况则相反。当你将完全新的值赋给现有变量时，Rust 会立即调用 `drop` 函数并释放原始值的内存。例如，考虑以下代码：

```rust
{{#rustdoc_include ../listings/ch04-understanding-ownership/no-listing-04b-replacement-drop/src/main.rs:here}}
```

最初我们声明一个变量 `s`，并将其绑定到一个值为 `"hello"` 的 `String`。然后，我们立即创建一个值为 `"ahoy"` 的新 `String` 并将其赋给 `s`。此时，堆上没有任何地方引用原始值。图 4-5 展示了当前栈和堆的数据情况：

<img alt="One table representing the string value on the stack, pointing to
堆上的第二个字符串数据（"ahoy"），而原始字符串数据（"hello"）则被标记为灰色，因为它无法再被访问。” src="img/trpl04-05.svg" class="center" style="width: 50%;" />

<span class="caption">Figure 4-5: The representation in memory after the initial
值已被完全替换</span>

因此，原始字符串立即超出作用域。Rust 会对其执行 `drop` 函数，其内存也会立即被释放。当我们最后打印该值时，它将变为 `"ahoy, world!"`。

<!-- Old headings. Do not remove or links may break. -->

<a id="ways-variables-and-data-interact-clone"></a>

#### 变量与数据通过克隆交互

如果我们确实想要深度复制 `String` 的堆数据而不仅仅是栈数据，可以使用一种称为 `clone` 的常见方法。我们将在第 5 章中讨论方法的语法，但由于方法在许多编程语言中都是常见特性，你可能已经见过它们了。

以下是 `clone` 方法的实际示例：

```rust
{{#rustdoc_include ../listings/ch04-understanding-ownership/no-listing-05-clone/src/main.rs:here}}
```

这种方法完全有效，并明确产生了图 4-3 中所示的行为，其中堆数据确实被复制了。

当你看到对 `clone` 的调用时，就知道有某些任意代码正在执行，而这段代码可能非常昂贵。这是一个视觉指示，表明发生了不同的事情。

#### 仅栈数据的复制

还有一个我们尚未讨论的问题。这段使用整数的代码——其中一部分在列表 4-2 中展示——是有效的且可行的：

```rust
{{#rustdoc_include ../listings/ch04-understanding-ownership/no-listing-06-copy/src/main.rs:here}}
```

但这段代码似乎与我们刚刚学到的内容相矛盾：我们没有调用 `clone` 函数，然而 `x` 仍然有效，并且没有被移动到 `y` 中。

原因是像整数这样的已知大小类型在编译时完全存储在栈上，因此实际值的副本很容易创建。这意味着没有理由阻止 `x` 在创建变量 `y` 后保持有效性。换句话说，这里深度复制和浅层复制没有区别，调用 `clone` 也不会与常规的浅层复制产生不同效果，因此可以省略它。

Rust 有一个特殊的注解称为 `Copy` trait，我们可以将其应用于存储在栈上的类型，就像整数一样（我们将在 [第 10 章][traits]<!-- ignore -->中进一步讨论 traits）。如果某个类型实现了 `Copy` trait，使用该类型的变量不会移动，而是被简单复制，因此在赋值给另一个变量后仍然有效。

如果类型或其任何部分实现了 `Drop` trait，Rust 不允许我们对该类型添加 `Copy` 注解。如果类型在值超出作用域时需要特殊操作，而我们在该类型上添加了 `Copy` 注解，我们将遇到编译时错误。要了解如何为类型添加 `Copy` 注解以实现该 trait，请参阅附录 C 中的 [“可推导的 Traits”][derivable-traits]<!-- ignore -->。

那么，哪些类型实现了 `Copy` trait？你可以查看给定类型的文档来确认，但一般来说，任何一组简单的标量值都可以实现 `Copy`，而需要分配或属于某种资源类型的类型则无法实现 `Copy`。以下是一些实现 `Copy` 的类型：

- 所有整数类型，例如 `u32`。
- 布尔类型 `bool`，其值为 `true` 和 `false`。
- 所有浮点类型，例如 `f64`。
- 字符类型 `char`。
- 元组，如果它们仅包含实现 `Copy` 的类型。例如，`(i32, i32)` 实现了 `Copy`，但 `(i32, String)` 则没有。

### 所有权与函数

将值传递给函数的机制与将值赋给变量类似。将变量传递给函数也会移动或复制该变量，就像赋值一样。列表 4-3 提供了一个示例，并带有注释说明变量何时进入作用域和离开作用域。

<Listing number="4-3" file-name="src/main.rs" caption="Functions with ownership and scope annotated">

```rust
{{#rustdoc_include ../listings/ch04-understanding-ownership/listing-04-03/src/main.rs}}
```

</Listing>

如果我们尝试在调用 `takes_ownership` 后使用 `s`，Rust 会抛出编译时错误。这些静态检查可以保护我们避免错误。试着在 `main` 中添加使用 `s` 和 `x` 的代码，以查看可以在何处使用它们，以及所有权规则在何处阻止了这种使用。

### 返回值与作用域

返回值也可以转移所有权。列表 4-4 展示了一个返回值的函数示例，其注释与列表 4-3 中的类似。

<Listing number="4-4" file-name="src/main.rs" caption="Transferring ownership of return values">

```rust
{{#rustdoc_include ../listings/ch04-understanding-ownership/listing-04-04/src/main.rs}}
```

</Listing>

变量的所有权每次都遵循相同的模式：将值赋给另一个变量会移动该值。当包含堆上数据的变量离开作用域时，除非数据所有权被转移给其他变量，否则该值会被 `drop` 清理。

虽然这样做可行，但每个函数都负责获取所有权后再返回所有权有点繁琐。如果我们希望一个函数使用某个值但不获取其所有权怎么办？如果我们要再次使用该值，除了函数体产生的数据外，所有传入的值也都需要被传递回来，这非常麻烦。

Rust 允许我们使用元组来返回多个值，如列表 4-5 所示。

<Listing number="4-5" file-name="src/main.rs" caption="Returning ownership of parameters">

```rust
{{#rustdoc_include ../listings/ch04-understanding-ownership/listing-04-05/src/main.rs}}
```

</Listing>

但对于这样一个常见的概念来说，这种繁琐和大量工作实在过多。幸运的是，Rust 有一个无需转移所有权的使用值的机制：引用。

[data-types]: ch03-02-data-types.html#data-types
[ch8]: ch08-02-strings.html
[traits]: ch10-02-traits.html
[derivable-traits]: appendix-03-derivable-traits.html
[methods]: ch05-03-method-syntax.html#methods
[paths-module-tree]: ch07-03-paths-for-referring-to-an-item-in-the-module-tree.html
