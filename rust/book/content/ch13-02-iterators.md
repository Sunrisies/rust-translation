## 使用迭代器处理一系列项目

迭代器模式允许你依次对序列中的项目执行某些操作。迭代器负责遍历每个项目的逻辑，并确定序列何时结束。当你使用迭代器时，无需自己重新实现该逻辑。

在 Rust 中，迭代器是_延迟执行的_，意味着在你调用消耗迭代器的方法以使用它之前，它们没有任何效果。例如，清单 13-10 中的代码通过调用 `Vec<T>` 上定义的 `iter` 方法来创建向量 `v1` 中项目的迭代器。仅此代码本身并无实际用途。

<Listing number="13-10" file-name="src/main.rs" caption="Creating an iterator">

```rust
{{#rustdoc_include ../listings/ch13-functional-features/listing-13-10/src/main.rs:here}}
```

</Listing>

迭代器被存储在 `v1_iter` 变量中。一旦创建了迭代器，就可以以多种方式使用它。在清单 3-5 中，我们使用 `for` 循环遍历数组，对每个项目执行某些操作。实际上，这隐含地创建并消耗了一个迭代器，但直到现在我们才了解其具体工作原理。

在清单 13-11 的示例中，我们在 `for` 循环中分离了迭代器的创建和使用过程。当使用 `v1_iter` 中的迭代器调用 `for` 循环时，每次循环都会使用迭代器中的一个元素，从而打印出每个值。

<Listing number="13-11" file-name="src/main.rs" caption="Using an iterator in a `for` loop">

```rust
{{#rustdoc_include ../listings/ch13-functional-features/listing-13-11/src/main.rs:here}}
```

</Listing>

在标准库未提供迭代器的语言中，你可能会通过从索引 0 开始创建一个变量，使用该变量对向量进行索引以获取值，然后在循环中递增该变量的值，直到到达向量的总项目数来实现相同的功能。

迭代器处理所有这些逻辑，减少了可能出错重复代码的风险。迭代器让你能够更灵活地使用相同逻辑于多种不同的序列上，而不仅仅用于可以索引的数据结构，如向量。让我们来看看迭代器是如何做到这一点的。

### `Iterator` 特质和 `next` 方法

所有迭代器都实现了标准库中定义的名为 `Iterator` 的特质。该特质的定义如下：

```rust
pub trait Iterator {
    type Item;

    fn next(&mut self) -> Option<Self::Item>;

    // methods with default implementations elided
}
```

请注意，此定义使用了一些新的语法：`type Item` 和 `Self::Item`，它们用于定义与此特性相关的关联类型。我们将在第20章中深入讨论关联类型。目前，你需要知道的是，此代码表明实现 `Iterator` 特性要求你同时定义一个 `Item` 类型，而该 `Item` 类型被用于 `next` 方法的返回类型。换句话说，`Item` 类型就是迭代器返回的类型。

`Iterator` 特性只要求实现者定义一个方法：即 `next` 方法，该方法每次返回一个迭代器中的项目，并包装在 `Some` 中；当迭代结束时，则返回 `None`。

我们可以直接调用迭代器的 `next` 方法；清单 13-12 展示了从向量创建的迭代器中重复调用 `next` 方法所返回的值。

<Listing number="13-12" file-name="src/lib.rs" caption="Calling the `next` method on an iterator">

```rust,noplayground
{{#rustdoc_include ../listings/ch13-functional-features/listing-13-12/src/lib.rs:here}}
```

</Listing>

请注意，我们需要使 `v1_iter` 可修改：对迭代器调用 `next` 方法会改变内部状态，而迭代器使用这些状态来跟踪其在序列中的位置。换句话说，此代码会消耗（即使用）迭代器。每次调用 `next` 都会从迭代器中获取一个项目。当使用 `for` 循环时，不需要使 `v1_iter` 可修改，因为循环会在幕后使 `v1_iter` 可修改。

另外需要注意的是，我们从 `next` 方法得到的值是对向量中值的不可变引用。`iter` 方法则产生一个基于不可变引用的迭代器。如果我们希望创建一个拥有 `v1` 的所有权并返回其拥有值 olan迭代器，可以调用 `into_iter` 而不是 `iter`。同样，如果我们要遍历可修改的引用，可以调用 `iter_mut` 而不是 `iter`。

### 消耗迭代器的方法

`Iterator` 特性包含许多由标准库提供的默认实现的不同方法；你可以通过查看 `Iterator` 特性的标准库 API 文档来了解这些方法。其中一些方法的定义中调用了 `next` 方法，这就是为什么在实现 `Iterator` 特性时必须实现 `next` 方法的原因。

调用 `next` 的方法被称为 _消耗适配器_，因为调用它们会消耗迭代器。一个例子是 `sum` 方法，它占用迭代器的所有权，并通过反复调用 `next` 来遍历项目，从而消耗迭代器。在遍历过程中，它将每个项目加到总和中，并在遍历完成时返回总和。列表 13-13 中有一个测试示例展示了 `sum` 方法的使用。

<Listing number="13-13" file-name="src/lib.rs" caption="Calling the `sum` method to get the total of all items in the iterator">

```rust,noplayground
{{#rustdoc_include ../listings/ch13-functional-features/listing-13-13/src/lib.rs:here}}
```

</Listing>

在调用 `sum` 之后，我们不允许使用 `v1_iter`，因为 `sum` 占用我们在其上调用的迭代器。

### 产生其他迭代器的方法

_迭代器适配器_ 是定义在 `Iterator` trait上的方法，它们不会消耗迭代器。相反，它们通过改变原始迭代器的某些特性来生成不同的迭代器。

列表 13-14 展示了一个调用迭代器适配器方法 `map` 的例子，`map` 在遍历项目时对每个项目调用一个闭包。`map` 方法返回一个新的迭代器，该迭代器产生修改后的项目。这里的闭包创建了一个新的迭代器，其中向量中的每个项目都会增加 1。

<Listing number="13-14" file-name="src/main.rs" caption="Calling the iterator adapter `map` to create a new iterator">

```rust,not_desired_behavior
{{#rustdoc_include ../listings/ch13-functional-features/listing-13-14/src/main.rs:here}}
```

</Listing>

然而，这段代码会发出警告：

```console
{{#include ../listings/ch13-functional-features/listing-13-14/output.txt}}
```

列表 13-14 中的代码实际上没有任何操作；我们指定的闭包从未被调用。这个警告提醒了我们原因：迭代器适配器是延迟执行的，我们需要在这里消耗迭代器。

为了消除此警告并消耗迭代器，我们将使用 `collect` 方法，我们在列表 12-1 中用 `env::args` 实现了该方法。该方法会消耗迭代器并将结果值收集到集合数据类型中。

在列表 13-15 中，我们将通过 `map` 调用返回的迭代器的遍历结果收集到一个向量中。这个向量最终将包含原始向量中的每个项目，并且每个项目都增加了 1。

<Listing number="13-15" file-name="src/main.rs" caption="Calling the `map` method to create a new iterator, and then calling the `collect` method to consume the new iterator and create a vector">

```rust
{{#rustdoc_include ../listings/ch13-functional-features/listing-13-15/src/main.rs:here}}
```

</Listing>

由于 `map` 接受一个闭包，我们可以指定对每个项目执行任何想要的操作。这是一个很好的例子，说明闭包如何让我们在重用 `Iterator` trait提供的迭代行为的同时自定义某些行为。

你可以将多个迭代器适配器调用链接起来，以简洁的方式执行复杂的操作。但由于所有迭代器都是惰性加载的，你必须调用其中一个消费适配器方法，才能从迭代器适配器调用中获取结果。

<!-- Old headings. Do not remove or links may break. -->

<a id="using-closures-that-capture-their-environment"></a>

### 捕获其环境的闭包

许多迭代器适配器将闭包作为参数传递，通常我们指定给迭代器适配器的闭包会捕获其环境。

在这个示例中，我们将使用带有闭包的 `filter` 方法。该闭包从迭代器中获取一个元素，并返回一个 `bool` 值。如果闭包返回 `true`，则该值将被包含在由 `filter` 生成的迭代器中；如果闭包返回 `false`，则该值不会包含在内。

在清单 13-16 中，我们使用带有捕获了环境中的 `shoe_size` 变量的闭包的 `filter` 方法，来遍历 `Shoe` 结构体实例的集合。它只会返回指定尺寸的鞋子。

<Listing number="13-16" file-name="src/lib.rs" caption="Using the `filter` method with a closure that captures `shoe_size`">

```rust,noplayground
{{#rustdoc_include ../listings/ch13-functional-features/listing-13-16/src/lib.rs}}
```

</Listing>

`shoes_in_size` 函数接受鞋子的向量和鞋尺寸作为参数，并负责管理该向量。它返回一个仅包含指定尺寸鞋子的向量。

在 `shoes_in_size` 的体内，我们调用 `into_iter` 来创建一个负责管理向量的迭代器。然后，我们调用 `filter` 将该迭代器适配为一个新的迭代器，只包含闭包返回 `true` 的元素。

该闭包从环境中捕获 `shoe_size` 参数，并将该值与每双鞋的尺寸进行比较，仅保留指定尺寸的鞋子。最后，调用 `collect` 将适配后的迭代器返回的值收集到一个由函数返回的向量中。

测试表明，当我们调用 `shoes_in_size` 时，只返回与指定值具有相同尺寸的鞋子。
