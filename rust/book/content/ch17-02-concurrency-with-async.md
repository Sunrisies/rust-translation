<!-- Old headings. Do not remove or links may break. -->

<a id="concurrency-with-async"></a>

## 使用异步技术处理并发

在本节中，我们将把异步技术应用于第16章中使用线程解决的一些并发问题。由于我们在那一部分已经讨论了许多关键概念，因此本节将重点介绍线程与future之间的区别。

在许多情况下，使用异步技术处理并发的API与使用线程的API非常相似。但在其他情况下则差异很大。即使线程和异步技术的API看起来相似，它们的行为往往不同，且性能特征也几乎总是不同。

<!-- Old headings. Do not remove or links may break. -->

<a id="counting"></a>

### 使用`spawn_task`创建新任务

在第16章的“使用`spawn`创建新线程”部分中，我们首先在两个独立的线程上进行计数操作。现在让我们用异步技术来重复这一操作。`trpl`库提供了`spawn_task`函数，其接口与`thread::spawn` API非常相似，还有`sleep`函数作为`thread::sleep` API的异步版本。我们可以结合使用这两个函数来实现计数示例，如清单17-6所示。

<Listing number="17-6" caption="Creating a new task to print one thing while the main task prints something else" file-name="src/main.rs">

```rust
{{#rustdoc_include ../listings/ch17-async-await/listing-17-06/src/main.rs:all}}
```

</Listing>

作为起点，我们在`main`函数中使用了`trpl::block_on`，使顶级函数能够支持异步操作。

> 注意：从本章开始，每个示例都会包含相同的包装代码，即在`main`中使用`trpl::block_on`，因此我们通常会像处理`main`一样跳过它。请确保在代码中包含该代码！

然后我们在该块内编写两个循环，每个循环都包含一个`trpl::sleep`调用，该调用会在等待半秒（500毫秒）后发送下一条消息。一个循环被放在`trpl::spawn_task`的主体中，另一个则放在顶级`for`循环中。我们在`sleep`调用之后也添加了`await`。

这段代码的行为与基于线程的实现类似——包括当你运行它时，消息在终端中的显示顺序可能会有所不同：

<!-- Not extracting output because changes to this output aren't significant;
这些变化可能是由于线程的运行方式不同，而非编译器的问题 -->

```text
hi number 1 from the second task!
hi number 1 from the first task!
hi number 2 from the first task!
hi number 2 from the second task!
hi number 3 from the first task!
hi number 3 from the second task!
hi number 4 from the first task!
hi number 4 from the second task!
hi number 5 from the first task!
```

此版本在主异步块的体内 `for` 循环结束时停止，因为由 `spawn_task` 生成的任务在 `main` 函数结束时被关闭。如果您希望它一直运行到任务完成，则需要使用 join 句柄来等待第一个任务完成。对于线程，我们使用 `join` 方法“阻塞”直到线程运行完毕。在 Listing 17-7 中，我们可以使用 `await` 来实现同样的效果，因为任务句柄本身就是一个 future。其 `Output` 类型为 `Result`，因此在 await 之后还需要将其解包。

<Listing number="17-7" caption="Using `await` with a join handle to run a task to completion" file-name="src/main.rs">

```rust
{{#rustdoc_include ../listings/ch17-async-await/listing-17-07/src/main.rs:handle}}
```

</Listing>

此更新版本会一直运行到两个循环都完成：

<!-- Not extracting output because changes to this output aren't significant;
这些更改可能是由于线程的运行时方式不同而非编译器变更所致 -->

```text
hi number 1 from the second task!
hi number 1 from the first task!
hi number 2 from the first task!
hi number 2 from the second task!
hi number 3 from the first task!
hi number 3 from the second task!
hi number 4 from the first task!
hi number 4 from the second task!
hi number 5 from the first task!
hi number 6 from the first task!
hi number 7 from the first task!
hi number 8 from the first task!
hi number 9 from the first task!
```

目前看来，异步编程和线程具有相似的结果，只是语法不同：使用 `await` 而不是对 join 句柄调用 `join`，以及等待 `sleep` 调用。

更大的区别在于我们不需要生成另一个操作系统线程来实现这一点。实际上，这里甚至不需要生成任务。由于异步块可以编译成匿名 future，我们可以将每个循环放入一个异步块中，让运行时使用 `trpl::join` 函数将其全部运行完成。

在第 16 章的“等待所有线程完成”[join-handles]<!-- ignore -->部分中，我们展示了如何对调用 `std::thread::spawn` 时返回的 `JoinHandle` 类型使用 `join` 方法。`trpl::join` 函数与之类似，但适用于 future。当给出两个 future 时，它会产生一个新的 future，其输出是一个包含传入每个 future 输出的元组。因此，在 Listing 17-8 中，我们使用 `trpl::join` 来等待 `fut1` 和 `fut2` 完成。我们并不 await `fut1` 和 `fut2`，而是 await `trpl::join` 产生的新 future。我们忽略其输出，因为它只是一个包含两个单位值的元组。

<Listing number="17-8" caption="Using `trpl::join` to await two anonymous futures" file-name="src/main.rs">

```rust
{{#rustdoc_include ../listings/ch17-async-await/listing-17-08/src/main.rs:join}}
```

</Listing>

当我们运行此代码时，可以看到两个 future 都运行到完成：

<!-- Not extracting output because changes to this output aren't significant;
这些更改可能是由于线程的运行时方式不同而非编译器变更所致 -->

```text
hi number 1 from the first task!
hi number 1 from the second task!
hi number 2 from the first task!
hi number 2 from the second task!
hi number 3 from the first task!
hi number 3 from the second task!
hi number 4 from the first task!
hi number 4 from the second task!
hi number 5 from the first task!
hi number 6 from the first task!
hi number 7 from the first task!
hi number 8 from the first task!
hi number 9 from the first task!
```

现在，你会看到每次都遵循完全相同的顺序，这与我们在列表 17-7 中看到的线程和 `trpl::spawn_task` 的情况大不相同。这是因为 `trpl::join` 函数具有_公平性_，意味着它会平等地检查每个未来任务，交替进行，当另一个任务准备好时不会让一个任务领先。对于线程来说，操作系统决定检查哪个线程以及允许该线程运行的时间长度；而对于异步 Rust，运行时决定检查哪个任务。（实际上，细节变得复杂，因为异步运行时可能在其管理并发的方式下使用操作系统线程，因此保证公平性对运行时来说可能需要更多工作——但仍然是可能的！）运行时不必为任何特定操作保证公平性，它们通常提供不同的 API 让你选择是否希望实现公平性。

尝试一些等待 futures 的变体，看看它们会产生什么效果：

- 从循环中的任意一个或两个循环处移除异步块。
- 在定义异步块后立即等待它。
- 仅将第一个循环包裹在异步块中，并在第二个循环的主体之后等待结果未来的任务。

为了增加挑战性，试着在运行代码之前就弄清楚每种情况下的输出会是什么！

<!-- Old headings. Do not remove or links may break. -->

<a id="message-passing"></a>
<a id="counting-up-on-two-tasks-using-message-passing"></a>

### 使用消息传递在两个任务之间传输数据

在 futures 之间共享数据也会很熟悉：我们将再次使用消息传递，但这次是对于类型和函数的异步版本。我们将采取与第 16 章中的[“使用消息传递在线程间传输数据”][message-passing-threads]<!-- ignore -->部分不同的方法，以说明基于线程和基于 futures 的并发之间的关键差异。在列表 17-9 中，我们将从一个单一的异步块开始——_不是_创建单独的任务，就像我们创建单独线程一样。

<Listing number="17-9" caption="Creating an async channel and assigning the two halves to `tx` and `rx`" file-name="src/main.rs">

```rust
{{#rustdoc_include ../listings/ch17-async-await/listing-17-09/src/main.rs:channel}}
```

</Listing>

在这里，我们使用 `trpl::channel`，这是我们在第16章中用于线程的异步多生产者单消费者通道API的版本。该异步版本的API与基于线程的版本只有细微差异：它使用可变的接收器 `rx` 而不是不可变的接收器，其 `recv` 方法生成的是我们需要等待的未来值，而不是直接返回数据。现在我们可以从发送者向接收者发送消息。请注意，我们不需要启动单独的线程或任务；我们只需要等待 `rx.recv` 的调用。

`std::mpsc::channel` 中的同步 `Receiver::recv` 方法会阻塞直到收到消息。而 `trpl::Receiver::recv` 方法不会阻塞，因为它属于异步操作。它不会阻塞，而是将控制权交还给运行时系统，直到收到消息或通道的发送端关闭为止。相比之下，我们不需要等待 `send` 调用，因为该调用不会阻塞。实际上也不需要阻塞，因为我们发送到的通道是无边界的。

> 注意：由于所有这些异步代码都在 `trpl::block_on` 调用的异步块中运行，因此其中的一切都可以避免阻塞。然而，其外部代码会在 `block_on` 函数返回时阻塞。这就是 `trpl::block_on` 函数的意义所在：它允许你选择在哪些异步代码处进行阻塞，从而可以在同步和异步代码之间切换。

请注意这个示例中的两点。首先，消息会立即到达。其次，虽然这里使用了未来，但目前没有并发性。列表中的所有操作都是按顺序进行的，就像没有使用未来一样。

让我们通过发送一系列消息并在中间休眠来解决第一部分问题，如清单 17-10 所示。

<!-- We cannot test this one because it never stops! -->

<Listing number="17-10" caption="Sending and receiving multiple messages over the async channel and sleeping with an `await` between each message" file-name="src/main.rs">

```rust,ignore
{{#rustdoc_include ../listings/ch17-async-await/listing-17-10/src/main.rs:many-messages}}
```

</Listing>

除了发送消息外，我们还需要接收这些消息。在这种情况下，由于我们知道即将收到的消息数量，我们可以通过四次调用 `rx.recv().await` 来手动完成接收。但在实际中，我们通常会等待一个未知数量的消息，因此我们需要继续等待，直到确定没有更多消息为止。

在清单 16-10 中，我们使用 `for` 循环来处理从同步通道接收到的所有项。然而，Rust 目前还没有办法使用 `for` 循环处理异步产生的系列项，因此我们需要使用一种之前未见过的循环：`while let` 条件循环。这是 `if let` 构造的循环版本，我们在第 6 章的 [“使用 `if let` 和 `let...else` 实现简洁控制流”][if-let]<!-- ignore --> 部分中见过它。只要所指定的模式继续与值匹配，该循环就会持续执行。

`rx.recv` 调用会生成一个未来值，我们对其进行等待。运行时会在未来准备好之前暂停其执行。一旦收到消息，随着消息的到达次数，未来值将解析为 `Some(message)`。当通道关闭时，无论是否已有任何消息到达，未来值都会解析为 `None`，表示没有更多值了，因此我们应该停止轮询——即停止等待。

`while let` 循环将这一切整合在一起。如果调用 `rx.recv().await` 的结果为 `Some(message)`，我们就能访问该消息并在循环体中使用它，就像使用 `if let` 一样。如果结果为 `None`，循环就会结束。每次循环完成时，都会再次到达等待点，因此运行时会再次暂停其执行，直到收到新的消息。

现在代码能够成功发送和接收所有消息了。不幸的是，仍然存在几个问题。首先，消息不是以半秒间隔到达的，而是一次性在程序启动后 2 秒（2,000 毫秒）内全部到达。其次，这个程序也永远无法退出！它会一直等待新的消息。你需要使用 <kbd>ctrl</kbd>-<kbd>C</kbd> 来关闭它。

#### 在一个异步块内的代码按线性顺序执行

让我们先看看为什么在完整延迟后所有消息会一次性到达，而不是以间隔到达的方式。在给定的异步块中，`await` 关键字出现的顺序就是程序运行时它们的执行顺序。

列表 17-10 中只有一个异步块，因此其中的所有操作都按线性顺序执行。仍然没有并发性。所有的 `tx.send` 调用都会发生，同时伴随着所有的 `trpl::sleep` 调用及其相关的 await 点。只有在此时，`while let` 循环才会遍历 `recv` 调用中的任意一个 `await` 点。

为了获得我们期望的行为——即睡眠延迟发生在每条消息之间——我们需要将 `tx` 和 `rx` 操作放入各自的异步块中，如列表 17-11 所示。然后运行时可以分别使用 `trpl::join` 执行它们，就像在列表 17-8 中一样。再次强调，我们等待的是 `trpl::join` 的结果，而不是各个未来值。如果我们依次等待各个未来值，最终只会回到顺序流程——这正是我们试图避免的情况。

<!-- We cannot test this one because it never stops! -->

<Listing number="17-11" caption="Separating `send` and `recv` into their own `async` blocks and awaiting the futures for those blocks" file-name="src/main.rs">

```rust,ignore
{{#rustdoc_include ../listings/ch17-async-await/listing-17-11/src/main.rs:futures}}
```

</Listing>

使用列表 17-11 中的更新代码后，消息将以 500 毫秒的间隔打印出来，而不是在 2 秒后一次性打印。

#### 将所有权移入异步块

不过，程序仍然不会退出，因为 `while let` 循环与 `trpl::join` 的交互方式如下：

- `trpl::join` 返回的未来值仅在 _两个_ 未来值都完成之后才完成。
- `tx_fut` 未来值在发送完 `vals` 中的最后一条消息后睡眠结束即完成。
- `rx_fut` 未来值直到 `while let` 循环结束才会完成。
- `while let` 循环不会结束，直到等待 `rx.recv` 返回 `None`。
- 等待 `rx.recv` 仅当通道的另一端关闭时才会返回 `None`。
- 通道只有在我们调用 `rx.close` 或发送方 `tx` 被丢弃时才会关闭。
- 我们在任何地方都不调用 `rx.close`，而 `tx` 在最外层的异步块传递给 `trpl::block_on` 之前不会被丢弃。
- 该块无法结束，因为它被阻塞在等待 `trpl::join` 完成上，这又让我们回到列表的顶部。

目前，在发送消息的异步块中，我们只是 _借用_ `tx`，因为发送消息不需要拥有权。但如果能 _移动_ `tx` 到该异步块中，那么当该块结束时，`tx` 就会被丢弃。在第13章的“捕获引用或移动拥有权”部分中，你学习了如何使用 `move` 关键字与闭包配合，而在第16章的“使用 `move` 闭包处理线程”部分中，我们经常需要在处理线程时将数据移动到闭包中。异步块也遵循相同的基本机制，因此 `move` 关键字在异步块和闭包中同样适用。

在列表17-12中，我们将发送消息使用的块从 `async` 改为 `async move`。

<Listing number="17-12" caption="A revision of the code from Listing 17-11 that correctly shuts down when complete" file-name="src/main.rs">

```rust
{{#rustdoc_include ../listings/ch17-async-await/listing-17-12/src/main.rs:with-move}}
```

</Listing>

当我们运行此版本代码时，在最后一个消息被发送和接收后，程序会优雅地停止。接下来，让我们看看需要做哪些修改才能从多个未来线程发送数据。

#### 使用 `join!` 宏连接多个未来

这个异步通道也是一个多生产者通道，因此如果我们想从多个未来线程发送消息，可以在列表17-13中所示的情况下对 `tx` 调用 `clone`。

<Listing number="17-13" caption="Using multiple producers with async blocks" file-name="src/main.rs">

```rust
{{#rustdoc_include ../listings/ch17-async-await/listing-17-13/src/main.rs:here}}
```

</Listing>

首先，我们克隆了 `tx`，在第一个异步块之外创建了 `tx1`。就像之前使用 `tx` 一样，我们将 `tx1` 移动到该块中。然后，稍后，我们将原始的 `tx` 移动到一个_新的_异步块中，在该块中我们以稍慢的延迟发送更多消息。我们恰好将这个新异步块放在接收消息的异步块之后，但也可以放在之前。关键在于未来线程的等待顺序，而不是它们的创建顺序。

用于发送消息的两个异步块都需要是 `async move` 块，这样当这些块结束时，`tx` 和 `tx1` 都会被丢弃。否则，我们将回到最初的那个无限循环中。

最后，我们将从 `trpl::join` 替换为 `trpl::join!` 来处理额外的未来任务：`join!` 宏可以等待任意数量的未来任务，而我们在编译时就能知道未来任务的数量。我们将在本章后面讨论如何等待未知数量的未来任务集合。

现在我们可以看到来自两个发送未来的所有消息，由于发送后的发送未来使用略有不同的延迟，因此这些消息也会在不同的时间间隔被接收：

<!-- Not extracting output because changes to this output aren't significant;
这些变化可能是由于线程运行方式不同而非编译器变更所致 -->

```text
received 'hi'
received 'more'
received 'from'
received 'the'
received 'messages'
received 'future'
received 'for'
received 'you'
```

我们探讨了如何使用消息传递在未来任务之间传递数据、异步块中的代码如何顺序执行、如何将所有权移入异步块以及如何合并多个未来任务。接下来，让我们讨论如何以及为何告诉运行时可以切换到其他任务。

[thread-spawn]: ch16-01-threads.html#creating-a-new-thread-with-spawn
[join-handles]: ch16-01-threads.html#waiting-for-all-threads-to-finish
[message-passing-threads]: ch16-02-message-passing.html
[if-let]: ch06-03-if-let.html
[capture-or-move]: ch13-01-closures.html#capturing-references-or-moving-ownership
[move-threads]: ch16-01-threads.html#using-move-closures-with-threads
