## 优雅关闭与清理

清单 21-20 中的代码按照我们的预期，通过线程池异步响应请求。我们收到一些关于 `workers`、`id` 和 `thread` 字段的警告，说明这些字段并未被直接使用，这提醒我们尚未进行任何清理操作。当我们使用不太优雅的方式时，
<kbd>ctrl</kbd>-<kbd>C</kbd> method to halt the main thread, all other threads
这些线程也会立即停止，即使它们正在处理请求中。

接下来，我们将实现 `Drop` trait，在池中的每个线程上调用 `join`，使其能够在关闭前完成正在处理的请求。然后，我们实现一种方式通知线程停止接受新请求并关闭。为了看到这段代码的实际效果，我们将修改服务器，使其在优雅关闭线程池之前只处理两个请求。

在过程中需要注意的一点是：这些操作不会影响处理闭包执行的代码部分，因此如果我们使用线程池进行异步运行时，这里的所有内容都保持不变。

### 在 `ThreadPool` 上实现 `Drop` trait

让我们从在线程池上实现 `Drop` 开始。当池被关闭时，所有线程应该都加入以确保完成工作。清单 21-22 展示了第一次尝试实现 `Drop` 的方法；此代码目前无法正常工作。

<Listing number="21-22" file-name="src/lib.rs" caption="Joining each thread when the thread pool goes out of scope">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch21-web-server/listing-21-22/src/lib.rs:here}}
```

</Listing>

首先，我们遍历每个线程池 `worker`。我们使用 `&mut` 是因为 `self` 是一个可变的引用，同时我们还需要能够修改 `worker`。对于每个 `worker`，我们打印一条消息说明这个特定的 `Worker` 实例正在关闭，然后调用该 `Worker` 实例的线程上的 `join`。如果 `join` 调用失败，我们使用 `unwrap` 让 Rust 崩溃并进入非优雅的关闭状态。

这是编译此代码时得到的错误：

```console
{{#include ../listings/ch21-web-server/listing-21-22/output.txt}}
```

错误提示我们无法调用 `join`，因为我们对每个 `worker` 只有可变的借用，而 `join` 需要拥有其参数的所有权。为了解决这个问题，我们需要将线程从拥有 `thread` 的 `Worker` 实例中移出，以便 `join` 能够使用该线程。一种实现方法就是采用清单 18-15 中的方式。如果 `Worker` 持有一个 `Option<thread::JoinHandle<()>>`，我们可以调用 `Option` 的 `take` 方法，将值从 `Some` 变体中移出，并留下一个 `None` 变体。换句话说，正在运行的 `Worker` 会在 `thread` 中包含 `Some` 变体，当我们想要清理一个 `Worker` 时，会将 `Some` 替换为 `None`，这样 `Worker` 就不会有线程在运行了。

然而，这种情况只会出现在丢弃 `Worker` 的时候。作为交换，我们在访问 `worker.thread` 的任何地方都必须处理 `Option<thread::JoinHandle<()>>`。Rust 的惯用语法大量使用 `Option`，但当你发现自己需要像这样将某种肯定会出现在 `Option` 中的内容包装在 `Option` 中作为 workaround 时，最好寻找其他替代方案，以使代码更简洁、减少错误风险。

在这种情况下，更好的替代方案是 `Vec::drain` 方法。它接受一个范围参数来指定要从向量中移除的元素，并返回这些元素的迭代器。传递 `..` 范围语法将移除向量中的*所有*值。

因此，我们需要像这样更新 `ThreadPool` `drop` 实现：

<Listing file-name="src/lib.rs">

```rust
{{#rustdoc_include ../listings/ch21-web-server/no-listing-04-update-drop-definition/src/lib.rs:here}}
```

</Listing>

这解决了编译器错误，且不需要对代码进行其他更改。请注意，由于 `drop` 可以在崩溃时调用，使用 `unwrap` 也可能引发 panic，导致双重 panic，从而立即使程序崩溃并终止正在进行的清理操作。这对于示例程序是可以的，但不建议用于生产代码。

### 向线程发出停止监听任务的信号

经过所有修改后，我们的代码能够编译而没有任何警告。然而，坏消息是这段代码目前并不按我们期望的方式运行。`Worker` 实例的线程所执行的闭包中的逻辑是关键：目前我们调用了 `join`，但这不会关闭线程，因为它们会永远循环寻找任务。如果我们使用当前的 `drop` 实现来移除 `ThreadPool`，主线程将永久阻塞，等待第一个线程完成。

要解决这个问题，我们需要修改 `ThreadPool` 的 `drop` 实现，然后修改 `Worker` 的循环逻辑。

首先，我们将 `ThreadPool` 的 `drop` 实现改为在等待线程完成之前显式移除 `sender`。列表 21-23 展示了用于显式移除 `sender` 的 `ThreadPool` 更改。与线程不同，这里确实需要使用 `Option` 才能通过 `Option::take` 将 `sender` 从 `ThreadPool` 中移除。

<Listing number="21-23" file-name="src/lib.rs" caption="Explicitly dropping `sender` before joining the `Worker` threads">

```rust,noplayground,not_desired_behavior
{{#rustdoc_include ../listings/ch21-web-server/listing-21-23/src/lib.rs:here}}
```

</Listing>

移除 `sender` 会关闭通道，表示不再有消息发送。当这种情况发生时，`Worker` 实例在无限循环中对 `recv` 的所有调用都会返回错误。在列表 21-24 中，我们将 `Worker` 的循环改为在这种情况下优雅地退出循环，这意味着当 `ThreadPool` 的 `drop` 实现对线程调用 `join` 时，线程就会完成。

<Listing number="21-24" file-name="src/lib.rs" caption="Explicitly breaking out of the loop when `recv` returns an error">

```rust,noplayground
{{#rustdoc_include ../listings/ch21-web-server/listing-21-24/src/lib.rs:here}}
```

</Listing>

为了看到这段代码的实际效果，让我们修改 `main` 以仅接受两个请求后便优雅地关闭服务器，如列表 21-25 所示。

<Listing number="21-25" file-name="src/main.rs" caption="Shutting down the server after serving two requests by exiting the loop">

```rust,ignore
{{#rustdoc_include ../listings/ch21-web-server/listing-21-25/src/main.rs:here}}
```

</Listing>

你不会希望一个现实世界的 Web 服务器在只处理了两个请求后就停止运行。这段代码只是证明优雅关闭和清理功能正常工作。

`take` 方法定义在 `Iterator` trait 中，最多限制迭代到前两项元素。`ThreadPool` 将在 `main` 结束时超出作用域，此时 `drop` 实现将执行。

使用 `cargo run` 启动服务器并发送三个请求。第三个请求应该会出错，在终端中你应该看到类似以下的输出：

<!-- manual-regeneration
cd listings/ch21-web-server/listing-21-25 cargo run curl http://127.0.0.1:7878 curl http://127.0.0.1:7878 curl http://127.0.0.1:7878 第三个请求将会出错，因为服务器已经关闭 请查看下面的输出内容 无法自动化处理，因为输出结果取决于请求操作 -->

```console
$ cargo run
   Compiling hello v0.1.0 (file:///projects/hello)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.41s
     Running `target/debug/hello`
Worker 0 got a job; executing.
Shutting down.
Shutting down worker 0
Worker 3 got a job; executing.
Worker 1 disconnected; shutting down.
Worker 2 disconnected; shutting down.
Worker 3 disconnected; shutting down.
Worker 0 disconnected; shutting down.
Shutting down worker 1
Shutting down worker 2
Shutting down worker 3
```

您可能会看到 `Worker` ID 和消息的排列顺序不同。从消息中我们可以了解这段代码的运作方式：第 0 和第 3 个 `Worker` 实例收到了前两个请求。在第二个连接之后，服务器停止接受连接，而 `ThreadPool` 上的 `Drop` 实现在 `Worker 3` 开始其任务之前就启动了执行过程。丢弃 `sender` 会使所有 `Worker` 实例断开连接并指示它们关闭服务。每个 `Worker` 实例在断开连接时都会打印一条消息，然后线程池调用 `join` 等待每个 `Worker` 线程完成工作。

请注意这次执行的某个有趣现象： `ThreadPool` 丢弃了 `sender`，在任何一个 `Worker` 收到错误之前，我们试图与 `Worker 0` 进行连接。由于 `Worker 0` 尚未从 `recv` 中收到错误，主线程被阻塞，等待 `Worker 0` 完成工作。与此同时，`Worker 3` 收到了任务，然后所有线程都收到了错误。当 `Worker 0` 完成后，主线程等待其余 `Worker` 实例完成工作。此时，它们都已经结束循环并停止了运行。

恭喜！我们现在完成了项目；我们拥有一个使用线程池异步响应的基础 Web 服务器。我们可以优雅地关闭服务器，从而清理线程池中的所有线程。

以下是完整的代码供参考：

<Listing file-name="src/main.rs">

```rust,ignore
{{#rustdoc_include ../listings/ch21-web-server/no-listing-07-final-code/src/main.rs}}
```

</Listing>

<Listing file-name="src/lib.rs">

```rust,noplayground
{{#rustdoc_include ../listings/ch21-web-server/no-listing-07-final-code/src/lib.rs}}
```

</Listing>

我们还可以做更多事情！如果您想继续改进这个项目，这里有一些建议：

- 为 `ThreadPool` 及其公共方法添加更多文档。
- 增加对库功能的测试。
- 将调用改为 `unwrap` 以实现更健壮的错误处理。
- 使用 `ThreadPool` 执行除处理网络请求之外的其他任务。
- 在 [crates.io](https://crates.io/) 上查找一个线程池 crate，并使用该 crate 实现一个类似的 Web 服务器。然后，将其 API 和健壮性与我们实现的线程池进行比较。

## 总结

干得好！你已经读到了这本书的结尾。我们想感谢你参与这次 Rust 之旅。现在你可以开始实现自己的 Rust 项目并帮助他人项目了。请记住，有一个热情的 Rustacean 社区愿意在你学习 Rust 的过程中帮助你解决任何挑战。
