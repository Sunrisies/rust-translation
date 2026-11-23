<!-- Old headings. Do not remove or links may break. -->

<a id="streams"></a>

## 流：序列中的未来值

回想一下，在本章的[“消息传递”][17-02-messages]<!-- ignore -->部分中，我们如何使用接收器作为异步通道。异步 `recv` 方法会随时间产生一系列数据项。这其实是一种更通用的模式，被称为_流_。许多概念都可以自然地被表示为流：数据项在队列中变得可用、当完整数据集超出计算机内存时从文件系统中逐步获取数据块，或者数据通过网络随时间到达。由于流就是未来值，我们可以将其与其他类型的未来值结合使用，并以有趣的方式组合它们。例如，我们可以将事件批量处理以避免触发过多网络调用，对长时间运行的操作序列设置超时，或限制用户界面事件的频率以避免不必要的工作。

我们在第13章中看到了一系列数据项，当时我们研究了[“迭代器特质和 `next` 方法”][迭代器-trait]<!-- ignore -->中的迭代器特质。但迭代器和异步通道接收器之间存在两个区别。第一个区别是时间：迭代器是同步的，而通道接收器是异步的。第二个区别是 API。直接使用 `Iterator` 时，我们调用其同步的 `next` 方法。对于 `trpl::Receiver` 流来说，则调用异步的 `recv` 方法。否则，这些 API 看起来非常相似，这种相似性并非偶然。`流` 就像一种异步形式的迭代。不过，`trpl::Receiver` 专门等待接收消息，而通用流 API 范围更广：它像 `Iterator` 一样提供下一个数据项，但是以异步方式。

Rust 中迭代器和流之间的相似性意味着我们实际上可以从任何迭代器创建流。与迭代器类似，我们可以通过调用流的 `next` 方法并等待输出来处理流，如清单 17-21 所示，不过目前该代码无法编译。

<Listing number="17-21" caption="Creating a stream from an iterator and printing its values" file-name="src/main.rs">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch17-async-await/listing-17-21/src/main.rs:stream}}
```

</Listing>

我们首先有一个数字数组，将其转换为迭代器后调用 `map` 函数将所有值翻倍。然后我们使用 `trpl::stream_from_iter` 函数将迭代器转换为流。接下来，通过 `while let` 循环遍历流中的项。

不幸的是，当我们尝试运行代码时，它无法编译，而是报错称没有 `next` 方法可用：

<!-- manual-regeneration
cd listings/ch17-异步-await/listing-17-21 cargo build copy only the error output -->

```text
error[E0599]: no method named `next` found for struct `tokio_stream::iter::Iter` in the current scope
  --> src/main.rs:10:40
   |
10 |         while let Some(value) = stream.next().await {
   |                                        ^^^^
   |
   = help: items from traits can only be used if the trait is in scope
help: the following traits which provide `next` are implemented but not in scope; perhaps you want to import one of them
   |
1  + use crate::trpl::StreamExt;
   |
1  + use futures_util::stream::stream::StreamExt;
   |
1  + use std::iter::Iterator;
   |
1  + use std::str::pattern::Searcher;
   |
help: there is a method `try_next` with a similar name
   |
10 |         while let Some(value) = stream.try_next().await {
   |                                        ~~~~~~~~
```

正如此输出所解释的那样，编译器错误的原因在于我们需要在作用域中拥有正确的 trait 才能使用 `next` 方法。根据我们目前的讨论，你可能会合理地认为该 trait 是 `Stream`，但实际上它是 `StreamExt`。“Ext”是 Rust 社区中一种常见的模式，用于通过另一个 trait 扩展一个现有 trait。

`Stream` trait 定义了一种低级接口，实际上结合了 `Iterator` 和 `Future` trait。`StreamExt` 在 `Stream` 的基础上提供了更高级别的 API，包括 `next` 方法以及其他与 `Iterator` trait 提供的类似实用方法。`Stream` 和 `StreamExt` 尚未成为 Rust 标准库的一部分，但大多数生态系统 crates 使用类似的定义。

解决编译器错误的办法是添加 `use` 语句来引入 `trpl::StreamExt`，如 Listing 17-22 所示。

<Listing number="17-22" caption="Successfully using an iterator as the basis for a stream" file-name="src/main.rs">

```rust
{{#rustdoc_include ../listings/ch17-async-await/listing-17-22/src/main.rs:all}}
```

</Listing>

将所有这些部分组合在一起后，代码就能按我们的期望运行了！更重要的是，现在我们在作用域中有了 `StreamExt`，就可以使用它的所有实用方法，就像使用迭代器一样。

[17-02-messages]: ch17-02-concurrency-with-async.html#message-passing
[iterator-trait]: ch13-02-iterators.html#the-iterator-trait-and-the-next-method
