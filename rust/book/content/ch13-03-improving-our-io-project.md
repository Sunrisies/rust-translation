## 改进我们的 I/O 项目

通过了解迭代器的新知识，我们可以在第12章中改进I/O项目，利用迭代器使代码中的部分更清晰、更简洁。让我们看看迭代器如何改善我们对 `Config::build` 函数和 `search` 函数的实现。

### 使用迭代器移除 `clone` 调用

在列表 12-6 中，我们添加了代码，该代码接收一个 `String` 值的切片，并通过索引访问切片并克隆值来创建 `Config` 结构体的实例，从而使 `Config` 结构体拥有这些值。在列表 13-17 中，我们复现了列表 12-23 中的 `Config::build` 函数的实现。

<Listing number="13-17" file-name="src/main.rs" caption="Reproduction of the `Config::build` function from Listing 12-23">

```rust,ignore
{{#rustdoc_include ../listings/ch13-functional-features/listing-12-23-reproduced/src/main.rs:ch13}}
```

</Listing>

当时我们认为不必担心效率低下的 `clone` 调用，因为我们将在未来移除它们。但现在该做了！

这里需要 `clone`，因为参数 `args` 是一个包含 `String` 元素的切片，但 `build` 函数并不拥有 `args`。为了返回 `Config` 实例的所有权，我们必须从 `Config` 的 `query` 和 `file_path` 字段中克隆值，以便 `Config` 实例能够拥有其自身的值。

通过我们对迭代器的新了解，我们可以修改 `build` 函数，使其将迭代器作为参数来接收所有权，而不是借用切片。我们将使用迭代器功能，而不是检查切片长度并索引到特定位置的代码。这将使 `Config::build` 函数的功能更清晰，因为迭代器会直接访问值。

一旦 `Config::build` 获得迭代器的所有权并且不再使用借用的索引操作，我们就可以将迭代器中的 `String` 值直接移入 `Config`，而不是调用 `clone` 并创建新的分配。

#### 直接使用返回的迭代器

打开你的 I/O 项目的 _src/main.rs_ 文件，它应该看起来像这样：

<span class="filename">Filename: src/main.rs</span>

```rust,ignore
{{#rustdoc_include ../listings/ch13-functional-features/listing-12-24-reproduced/src/main.rs:ch13}}
```

首先，我们将列表 12-24 中的 `main` 函数的起始部分改为列表 13-18 中的代码，这次使用了迭代器。直到我们同时更新 `Config::build` 之前，这都无法编译。

<Listing number="13-18" file-name="src/main.rs" caption="Passing the return value of `env::args` to `Config::build`">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch13-functional-features/listing-13-18/src/main.rs:here}}
```

</Listing>

`env::args` 函数返回一个迭代器！与其将迭代器的值收集到向量中再传递给 `Config::build`，现在我们直接将 `env::args` 返回的迭代器的所有权交给 `Config::build`。

接下来，我们需要更新 `Config::build` 的定义。让我们将 `Config::build` 的签名改为如清单 13-19 所示。不过这仍然无法编译，因为我们必须修改函数体。

<Listing number="13-19" file-name="src/main.rs" caption="Updating the signature of `Config::build` to expect an iterator">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch13-functional-features/listing-13-19/src/main.rs:here}}
```

</Listing>

标准库中关于 `env::args` 函数的文档表明，它返回的迭代器类型为 `std::env::Args`，该类型实现了 `Iterator` trait 并返回 `String` 值。

我们已经更新了 `Config::build` 函数的签名，使得参数 `args` 具有带有 `impl Iterator<Item = String>` trait 边界的泛型类型，而不是 `&[String]`。我们在第 10 章的 [“将 Traits 作为参数使用”][实现-trait]<!-- ignore --> 部分讨论过这种 `impl Trait` 语法的使用方式，这意味着 `args` 可以是任何实现 `Iterator` trait 并返回 `String` 项的类型。

由于我们正在获取 `args` 的所有权，并且通过迭代它来修改 `args`，我们可以在 `args` 参数的说明中添加 `mut` 关键字，使其变为可变的。

<!-- Old headings. Do not remove or links may break. -->

<a id="using-iterator-trait-methods-instead-of-indexing"></a>

#### 使用 `Iterator` trait 方法

接下来，我们将修复 `Config::build` 的函数体。因为 `args` 实现了 `Iterator` trait，我们知道可以对其调用 `next` 方法！清单 13-20 将代码从清单 12-23 改为使用 `next` 方法。

<Listing number="13-20" file-name="src/main.rs" caption="Changing the body of `Config::build` to use iterator methods">

```rust,ignore,noplayground
{{#rustdoc_include ../listings/ch13-functional-features/listing-13-20/src/main.rs:here}}
```

</Listing>

请记住，`env::args` 返回值的第一个值是程序名称。我们希望忽略它并获取下一个值，因此首先调用 `next` 并将返回值视为无操作。然后，再次调用 `next` 以获取要放入 `Config` 的 `query` 字段的值。如果 `next` 返回 `Some`，我们使用 `match` 提取该值。如果返回 `None`，则表示提供的参数不足，我们提前返回一个 `Err` 值。对于 `file_path` 值也执行相同的操作。

<!-- Old headings. Do not remove or links may break. -->

<a id="making-code-clearer-with-iterator-adapters"></a>

### 使用 迭代器 适配器澄清代码

我们还可以利用 I/O 项目中的 `search` 函数中的迭代器，该实现如列表 13-21 所示，与列表 12-19 相同。

<Listing number="13-21" file-name="src/lib.rs" caption="The implementation of the `search` function from Listing 12-19">

```rust,ignore
{{#rustdoc_include ../listings/ch12-an-io-project/listing-12-19/src/lib.rs:ch13}}
```

</Listing>

我们可以通过使用迭代器适配器方法以更简洁的方式编写此代码。这样做还能避免使用可变的 `results` 向量。函数式编程风格倾向于最小化可变状态，以使代码更清晰。去除可变状态可能有助于未来实现并行搜索，因为我们就无需管理对 `results` 向量的并发访问了。列表 13-22 展示了这一修改。

<Listing number="13-22" file-name="src/lib.rs" caption="Using iterator adapter methods in the implementation of the `search` function">

```rust,ignore
{{#rustdoc_include ../listings/ch13-functional-features/listing-13-22/src/lib.rs:here}}
```

</Listing>

请记住，`search` 函数的目的是返回 `contents` 中包含所有包含 `query` 的行。类似于列表 13-16 中的 `filter` 示例，此代码使用 `filter` 适配器仅保留 `line.contains(query)` 返回 `true` 的行。然后我们使用 `collect` 将匹配的行收集到另一个向量中。简单多了！你可以自由地在 `search_case_insensitive` 函数中也使用迭代器方法进行同样修改。

为了进一步改进，可以通过移除对 `collect` 的调用并将返回类型改为 `impl Iterator<Item = &'a str>`，让 `search` 函数返回一个迭代器，从而成为一个迭代器适配器。请注意，你还需要更新测试！在做出此修改之前和之后使用你的 `minigrep` 工具搜索大文件，以观察行为差异。在此修改之前，程序不会打印任何结果，直到收集完所有结果；但经过修改后，每当找到匹配行时就会打印结果，因为 `run` 函数中的 `for` 循环能够利用迭代器的惰性特性。

<!-- Old headings. Do not remove or links may break. -->

<a id="choosing-between-loops-or-iterators"></a>

### 在循环和迭代器之间选择

下一个合理的问题是：你应该在自己的代码中选择哪种风格，以及为什么——是列表 13-21 中的原始实现，还是列表 13-22 中使用迭代器的版本（假设我们在返回之前收集所有结果，而不是直接返回迭代器）。大多数 Rust 程序员更喜欢使用迭代器风格。一开始掌握它可能会有些困难，但一旦你熟悉了各种迭代器适配器及其功能后，迭代器就会更容易理解。与调整循环的各个细节和构建新向量相比，代码更注重循环的高层目标。这抽象掉了一些常见的代码，使得能够更清晰地看到该代码特有的概念，例如迭代器中每个元素必须通过的过滤条件。

但这两种实现真的等价吗？直观的假设可能是低级别的循环会更快。让我们来讨论一下性能问题。

[impl-trait]: ch10-02-traits.html#traits-as-parameters
