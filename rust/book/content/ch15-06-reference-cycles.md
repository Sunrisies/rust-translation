## 引用循环可能导致内存泄漏

Rust 的内存安全保证使得意外创建无法被清理的内存（称为_内存泄漏_）变得困难，但并非不可能。完全防止内存泄漏并非 Rust 的保证之一，这意味着在 Rust 中仍可能存在内存泄漏。我们通过使用 `Rc<T>` 和 `RefCell<T>` 可以看到 Rust 允许内存泄漏：有可能创建相互引用的引用循环。这会导致内存泄漏，因为循环中的每个对象的引用计数永远不会变为 0，这些值也永远不会被释放。

### 如何创建引用循环

让我们先看看引用循环是如何发生的以及如何防止它，从 Listing 15-25 中的 `List` 枚举和 `tail` 方法开始。

<Listing number="15-25" file-name="src/main.rs" caption="A cons list definition that holds a `RefCell<T>` so that we can modify what a `Cons` variant is referring to">

```rust
{{#rustdoc_include ../listings/ch15-smart-pointers/listing-15-25/src/main.rs:here}}
```

</Listing>

我们使用了 Listing 15-5 中 `List` 定义的另一种变体。`Cons` 变体的第二个元素现在是 `RefCell<Rc<List>>`，这意味着我们不能像在 Listing 15-24 中那样修改 `i32` 值，而是想要修改 `Cons` 变体所指向的 `List` 值。我们还添加了 `tail` 方法，以便当我们有一个 `Cons` 变体时能够方便地访问第二个元素。

在 Listing 15-26 中，我们添加了一个使用 Listing 15-25 中定义的函数的 `main` 函数。这段代码在 `a` 中创建了一个列表，在 `b` 中创建了一个指向 `a` 中列表的列表。然后，它修改了 `a` 中的列表以指向 `b`，从而形成了引用循环。过程中有 `println!` 语句显示不同阶段的引用计数情况。

<Listing number="15-26" file-name="src/main.rs" caption="Creating a reference cycle of two `List` values pointing to each other">

```rust
{{#rustdoc_include ../listings/ch15-smart-pointers/listing-15-26/src/main.rs:here}}
```

</Listing>

我们在变量 `a` 中创建了一个包含 `5, Nil` 值的 `List` 对象的 `Rc<List>` 实例。然后，在变量 `b` 中创建了一个包含值 `10` 并指向 `a` 中列表的 `Rc<List>` 实例。

我们修改了 `a`，使其指向 `b` 而不是 `Nil`，从而形成了循环。我们通过使用 `tail` 方法获取 `a` 中 `RefCell<Rc<List>>` 的引用，并将其放入变量 `link` 来实现这一点。然后，我们在 `RefCell<Rc<List>>` 上调用 `borrow_mut` 方法，将内部值从包含 `Nil` 值的 `Rc<List>` 更改为 `b` 中的 `Rc<List>`。

当我们运行这段代码时，暂时注释掉最后的 `println!`，我们将得到以下输出：

```console
{{#include ../listings/ch15-smart-pointers/listing-15-26/output.txt}}
```

在修改了 `a` 中的列表指向 `b` 之后，`a` 和 `b` 中 `Rc<List>` 实例的引用计数均为 2。在 `main` 函数结束时，Rust 会释放变量 `b`，使得 `b` 的 `Rc<List>` 实例的引用计数从 2 降为 1。此时，`Rc<List>` 在堆上占用的内存不会被释放，因为其引用计数为 1 而非 0。接着，Rust 会释放 `a`，导致 `a` 的 `Rc<List>` 实例的引用计数也从 2 降为 1。该实例的内存同样无法被释放，因为另一个 `Rc<List>` 实例仍然指向它。分配给列表的内存将永远无法被回收。为了可视化这种引用循环，我们在图 15-4 中创建了示意图。

<img alt="A rectangle labeled 'a' that points to a rectangle containing the integer 5. A rectangle labeled 'b' that points to a rectangle containing the integer 10. The rectangle containing 5 points to the rectangle containing 10, and the rectangle containing 10 points back to the rectangle containing 5, creating a cycle." src="img/trpl15-04.svg" class="center" />

<span class="caption">Figure 15-4: A reference cycle of lists `a` and `b`
相互指向

如果你取消注释最后的 `println!` 并运行程序，Rust 会尝试打印出这种循环结构，即 `a` 指向 `b`，`b` 又指向 `a`，如此循环直到栈溢出。

与实际程序相比，在此示例中创建引用循环的后果并不严重：创建引用循环后，程序立即结束。然而，如果一个更复杂的程序在循环中分配了大量内存并长期保留这些内存，该程序将使用超过所需的内存量，可能导致系统内存不足而崩溃。

创建引用循环并不容易实现，但也不是不可能。如果你使用包含 `Rc<T>` 值的 `RefCell<T>` 对象，或者具有内部可变性与引用计数的类似嵌套类型组合，你必须确保不会产生循环；你不能依赖 Rust 来检测这些循环。创建引用循环实际上是你程序中的逻辑错误，你应该通过自动化测试、代码审查和其他软件开发实践来减少这种问题。

避免引用循环的另一种方法是重新组织数据结构，使某些引用表示所有权，而另一些则不表示所有权。这样，循环就可以由一些所有权关系和一些非所有权关系组成，只有所有权关系才会影响值是否可以被丢弃。在列表 15-25中，我们总是希望 `Cons` 变体拥有其列表，因此无法重新组织数据结构。让我们通过一个由父节点和子节点组成的图示例来看，何时使用非所有权关系是防止引用循环的有效方法。

<!-- Old headings. Do not remove or links may break. -->

<a id="preventing-reference-cycles-turning-an-rct-into-a-weakt"></a>

### 使用 `Weak<T>` 预防引用循环

到目前为止，我们已经展示了调用 `Rc::clone` 会增加 `Rc<T>` 实例的 `strong_count`，而 `Rc<T>` 实例只有在其 `strong_count` 为 0 时才会被清理。你也可以通过调用 `Rc::downgrade` 并传递对 `Rc<T>` 的引用来创建对 `Rc<T>` 中值的弱引用。*强引用*用于共享 `Rc<T>` 实例的所有权。*弱引用*不表示所有权关系，其计数也不影响 `Rc<T>` 实例何时被清理。它们不会导致引用循环，因为任何涉及弱引用的循环在相关值的强引用计数变为 0 时就会被打破。

当调用 `Rc::downgrade` 时，你会得到一个类型为 `Weak<T>` 的智能指针。与增加 `Rc<T>` 实例中的 `strong_count` 为 1 不同，`Rc::downgrade` 会增加 `weak_count` 为 1。`Rc<T>` 类型使用 `weak_count` 来记录存在的 `Weak<T>` 引用数量，类似于 `strong_count`。区别在于 `weak_count` 不必为 0，这样 `Rc<T>` 实例才能被清理。

由于 `Weak<T>` 引用的值可能已被释放，因此要对 `Weak<T>` 指向的值进行操作时，必须确保该值仍然存在。可以通过对 `Weak<T>` 实例调用 `upgrade` 方法来实现这一点，该方法会返回一个 `Option<Rc<T>>`。如果 `Rc<T>` 值尚未被释放，将得到 `Some` 的结果；如果已被释放，则得到 `None` 的结果。由于 `upgrade` 返回的是 `Option<Rc<T>>`，Rust 会确保处理 `Some` 和 `None` 两种情况，从而不会产生无效的指针。

例如，与其使用仅知道下一个项的列表，我们不如创建一个树结构，其中每个节点都知道其子节点及其父节点。

<!-- Old headings. Do not remove or links may break. -->

<a id="creating-a-tree-data-structure-a-node-with-child-nodes"></a>

#### 创建树数据结构

首先，我们将构建一个包含知道其子节点的节点的树。我们会创建一个名为 `Node` 的结构体，该结构体持有自己的 `i32` 值以及对其子 `Node` 值的引用。

<span class="filename">Filename: src/main.rs</span>

```rust
{{#rustdoc_include ../listings/ch15-smart-pointers/listing-15-27/src/main.rs:here}}
```

我们希望 `Node` 拥有其子节点，并且希望与变量共享这种所有权，以便可以直接访问树中的每个 `Node`。为此，我们将 `Vec<T>` 项定义为类型为 `Rc<Node>` 的值。我们还想修改哪些节点是其他节点的子节点，因此在 `Vec<Rc<Node>>` 周围使用 `RefCell<T>` 来封装 `children`。

接下来，我们将使用上述结构体定义创建一个名为 `leaf` 的 `Node` 实例，其值为 `3` 且没有子节点；再创建一个名为 `branch` 的实例，其值为 `5`，并且有一个 `leaf` 作为其子节点，如清单 15-27 所示。

<Listing number="15-27" file-name="src/main.rs" caption="Creating a `leaf` node with no children and a `branch` node with `leaf` as one of its children">

```rust
{{#rustdoc_include ../listings/ch15-smart-pointers/listing-15-27/src/main.rs:there}}
```

</Listing>

我们在 `leaf` 中克隆 `Rc<Node>` 并将其存储在 `branch` 中，这意味着 `leaf` 中的 `Node` 现在有两个所有者：`leaf` 和 `branch`。我们可以通过 `branch.children` 从 `branch` 访问到 `leaf`，但无法从 `leaf` 访问到 `branch`。原因是 `leaf` 没有对 `branch` 的引用，也不知道它们之间存在关联。我们希望 `leaf` 能够知道 `branch` 是它的父节点。我们将在下一步实现这一点。

#### 添加子节点对其父节点的引用

为了让子节点意识到其父节点，我们需要在 `Node` 结构体定义中添加 `parent` 字段。问题在于如何确定 `parent` 的类型。我们知道它不能包含 `Rc<T>`，因为那样会形成一个引用循环：`leaf.parent` 指向 `branch`，而 `branch.children` 又指向 `leaf`，这会导致它们的 `strong_count` 值永远不为 0。

从另一种角度思考关系，父节点应该拥有其子节点：如果父节点被删除，其子节点也应该被删除。然而，子节点不应拥有其父节点：如果我们删除一个子节点，父节点仍然应存在。这属于弱引用的情况！

因此，我们不会使用 `Rc<T>`，而是将 `parent` 的类型改为 `Weak<T)`，具体来说是一个 `RefCell<Weak<Node>>`。现在我们的 `Node` 结构体定义如下：

<span class="filename">Filename: src/main.rs</span>

```rust
{{#rustdoc_include ../listings/ch15-smart-pointers/listing-15-28/src/main.rs:here}}
```

一个节点可以引用其父节点，但不拥有其父节点。在列表 15-28 中，我们更新了 `main` 函数以使用这种新定义，这样 `leaf` 节点就有办法引用其父节点 `branch`。

<Listing number="15-28" file-name="src/main.rs" caption="A `leaf` node with a weak reference to its parent node, `branch`">

```rust
{{#rustdoc_include ../listings/ch15-smart-pointers/listing-15-28/src/main.rs:there}}
```

</Listing>

创建 `leaf` 节点的过程与列表 15-27 类似，只是多了 `parent` 字段：`leaf` 最初没有父节点，因此我们创建了一个新的、空的 `Weak<Node>` 引用实例。

此时，当我们尝试使用 `upgrade` 方法获取 `leaf` 的父节点引用时，我们得到的是 `None` 值。我们在第一个 `println!` 语句的输出中看到了这一点：

```text
leaf parent = None
```

当我们创建 `branch` 节点时，其 `parent` 字段中也会有一个新的 `Weak<Node>` 引用，因为 `branch` 没有父节点。我们仍然将 `leaf` 作为 `branch` 的子节点之一。一旦我们在 `branch` 中有了 `Node` 实例，就可以修改 `leaf`，为其父节点提供一个 `Weak<Node>` 引用。我们在 `leaf` 的 `parent` 字段中使用 `RefCell<Weak<Node>>` 的 `borrow_mut` 方法，然后使用 `Rc::downgrade` 函数从 `branch` 中的 `Rc<Node>` 创建对 `branch` 的 `Weak<Node>` 引用。

当我们再次打印 `leaf` 的父节点时，这次会得到一个包含 `branch` 的 `Some` 类型值：现在 `leaf` 可以访问其父节点了！当我们打印 `leaf` 时，也避免了最终导致栈溢出的循环，就像我们在列表 15-26 中看到的那样；`Weak<Node>` 引用被显示为 `(Weak)`。

```text
leaf parent = Some(Node { value: 5, parent: RefCell { value: (Weak) },
children: RefCell { value: [Node { value: 3, parent: RefCell { value: (Weak) },
children: RefCell { value: [] } }] } })
```

没有无限输出表明这段代码没有创建引用循环。我们可以通过查看调用 `Rc::strong_count` 和 `Rc::weak_count` 得到的值来判断这一点。

#### 可视化 `strong_count` 和 `weak_count` 的变化

让我们通过创建一个新的内部作用域并将 `branch` 的创建移入该作用域，来观察 `Rc<Node>` 实例中的 `strong_count` 和 `weak_count` 值如何变化。通过这种方式，我们可以看到当 `branch` 被创建并在作用域之外时如何被丢弃。这些修改显示在列表 15-29 中。

<Listing number="15-29" file-name="src/main.rs" caption="Creating `branch` in an inner scope and examining strong and weak reference counts">

```rust
{{#rustdoc_include ../listings/ch15-smart-pointers/listing-15-29/src/main.rs:here}}
```

</Listing>

在 `leaf` 被创建后，其 `Rc<Node>` 的强计数变为 1，弱计数变为 0。在内部作用域中，我们创建 `branch` 并将其与 `leaf` 关联起来，此时当打印计数时，`branch` 中的 `Rc<Node>` 将具有强计数 1 和弱计数 1（因为 `leaf.parent` 指向带有 `Weak<Node>` 的 `branch`）。当我们从 `leaf` 中打印计数时，会看到其强计数变为 2，因为 `branch` 现在在 `branch.children` 中存储了 `leaf` 的 `Rc<Node>` 的克隆，但弱计数仍为 0。

当内部作用域结束时，`branch` 脱离作用域，`Rc<Node>` 的强计数减少至 0，因此其 `Node` 被释放。来自 `leaf.parent` 的弱计数为 1 与 `Node` 是否被释放无关，因此不会产生内存泄漏！

如果我们在作用域结束后尝试访问 `leaf` 的父对象，将会再次得到 `None`。在程序结束时，`leaf` 中的 `Rc<Node>` 具有强计数 1 和弱计数 0，因为变量 `leaf` 现在成为对 `Rc<Node>` 的唯一引用。

所有管理计数和值释放的逻辑都集成在 `Rc<T>` 和 `Weak<T>` 及其对 `Drop` trait 的实现中。通过在 `Node` 的定义中指定子节点与其父节点的关系应为 `Weak<T>` 引用，可以使得父节点指向子节点，反之亦然，而无需创建引用循环和内存泄漏。

## 总结

本章介绍了如何使用智能指针来实现与 Rust 默认使用常规引用不同的保证和权衡。`Box<T>` 类型具有已知大小，并指向堆上分配的数据。`Rc<T>` 类型跟踪堆上数据的引用数量，以便数据可以有多个所有者。`RefCell<T>` 类型因其内部可变性，提供了一种可以在需要不可变类型但需修改该类型内部值时使用的类型；它还在运行时而不是编译时强制执行借用规则。

还讨论了 `Deref` 和 `Drop` trait，这些Trait 使得智能指针的许多功能成为可能。我们探讨了可能导致内存泄漏的引用循环以及如何使用 `Weak<T>` 来防止它们。

如果本章引起了你的兴趣，并且你想实现自己的智能指针，请查阅 [“The Rustonomicon”][nomicon] 以获取更多有用信息。

接下来，我们将讨论 Rust 中的并发性。你还将学习几种新的智能指针。

[nomicon]: ../nomicon/index.html
