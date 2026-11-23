
<!-- Old headings. Do not remove or links may break. -->

<a id="yielding"></a>

### 将控制权交还给运行时

从[“我们的第一个异步程序”][异步-program]<!-- ignore -->部分可知，在每次 `await` 点处，Rust 会让运行时暂停任务并切换到其他任务，除非被等待的未来结果尚未准备好。反之亦然：Rust 只会在 `await` 点处暂停异步块并将控制权交还给运行时。在 `await` 点之间的所有操作都是同步的。

这意味着如果你在异步块中执行大量工作而没有 `await` 点，该未来任务将阻止其他未来任务进行进展。有时人们会称这种现象为一个未来任务“饿死”了其他未来任务。在某些情况下，这并非问题所在。然而，如果你正在执行昂贵的设置或长时间运行的任务，或者有一个未来任务会无限期地持续执行特定任务，那么你需要考虑何时以及何处将控制权交还给运行时。

让我们模拟一个长时间运行的操作来说明“饿死”问题，然后探讨如何解决它。列表 17-14 介绍了一个 `slow` 函数。

<Listing number="17-14" caption="Using `thread::sleep` to simulate slow operations" file-name="src/main.rs">

```rust
{{#rustdoc_include ../listings/ch17-async-await/listing-17-14/src/main.rs:slow}}
```

</Listing>

此代码使用 `std::thread::sleep` 而不是 `trpl::sleep`，因此调用 `slow` 会使当前线程暂停若干毫秒。我们可以用 `slow` 来替代现实世界中既耗时又阻塞的操作。

在列表 17-15 中，我们使用 `slow` 来模拟在一对未来任务中执行这种 CPU 密集型工作。

<Listing number="17-15" caption="Calling the `slow` function to simulate slow operations" file-name="src/main.rs">

```rust
{{#rustdoc_include ../listings/ch17-async-await/listing-17-15/src/main.rs:slow-futures}}
```

</Listing>

每个未来任务只有在执行完一系列慢操作之后才会将控制权交还给运行时。如果你运行此代码，将会看到以下输出：

<!-- manual-regeneration
cd listings/ch17-异步-await/listing-17-15/ cargo run copy just the output -->

```text
'a' started.
'a' ran for 30ms
'a' ran for 10ms
'a' ran for 20ms
'b' started.
'b' ran for 75ms
'b' ran for 10ms
'b' ran for 15ms
'b' ran for 350ms
'a' finished.
```

正如清单 17-5 中我们使用 `trpl::select` 来竞争获取两个 URL 的未来时一样，`select` 在 `a` 完成后会立即完成。不过，两个未来时对 `slow` 的调用是并行的，没有交错。`a` 未来会执行其所有工作直到等待 `trpl::sleep` 调用，然后 `b` 未来也会执行其所有工作直到等待其自身的 `trpl::sleep` 调用，最后 `a` 未来完成。为了让两个未来在它们的慢任务之间取得进展，我们需要等待点，以便将控制交还给运行时。这意味着我们需要某种可以等待的东西！

我们在清单 17-15 中已经可以看到这种切换现象：如果我们移除 `a` 未来末尾的 `trpl::sleep`，它将在没有 `b` 未来运行的情况下完成。让我们尝试使用 `trpl::sleep` 函数作为让操作停止进展的起点，如清单 17-16 所示。

<Listing number="17-16" caption="Using `trpl::sleep` to let operations switch off making progress" file-name="src/main.rs">

```rust
{{#rustdoc_include ../listings/ch17-async-await/listing-17-16/src/main.rs:here}}
```

</Listing>

我们在每次调用 `slow` 后添加了带有等待点的 `trpl::sleep` 调用。现在两个未来时的工作是并行的：

<!-- manual-regeneration
cd listings/ch17-异步-await/listing-17-16 cargo run copy just the output -->

```text
'a' started.
'a' ran for 30ms
'b' started.
'b' ran for 75ms
'a' ran for 10ms
'b' ran for 10ms
'a' ran for 20ms
'b' ran for 15ms
'a' finished.
```

`a` 未来在将控制交还给 `b` 之前仍会运行一段时间，因为它在调用 `trpl::sleep` 之前就调用了 `slow`，但之后每当其中一个未来达到等待点时，两者就会交换控制。在这种情况下，我们在每次调用 `slow` 后都会进行这种切换，但我们可以根据我们的需求以最合理的方式拆分工作。

不过我们并不真的想在这里“睡眠”：我们希望尽可能快地取得进展。我们只需要将控制交还给运行时。我们可以直接使用 `trpl::yield_now` 函数来实现这一点。在清单 17-17 中，我们将所有的 `trpl::sleep` 调用替换为 `trpl::yield_now`。

<Listing number="17-17" caption="Using `yield_now` to let operations switch off making progress" file-name="src/main.rs">

```rust
{{#rustdoc_include ../listings/ch17-async-await/listing-17-17/src/main.rs:yields}}
```

</Listing>

这段代码不仅更清晰地表达了实际意图，而且比使用 `sleep` 要快得多，因为像 `sleep` 使用的定时器通常对颗粒度有限制。例如，我们使用的 `sleep` 版本总是至少睡眠一毫秒，即使我们传入一个一纳秒的 `Duration`。再次强调，现代计算机非常_快速_：它们在一毫秒内可以完成大量工作！

这意味着异步技术甚至适用于计算密集型任务，具体取决于程序的其他操作，因为它为构建程序不同部分之间的关系提供了有用的工具（但会带来异步状态机带来的开销）。这是一种_协作多任务处理_方式，每个未来都有能力通过 `await` 点决定何时移交控制。因此，每个未来也有责任避免长时间阻塞。在某些基于 Rust 的嵌入式操作系统中，这就是_唯一_的多任务处理方式！

在实际代码中，当然不会在每一行都交替使用函数调用和 `await` 点。以这种方式让出控制相对成本较低，但并非完全免费。在许多情况下，试图拆分计算密集型任务可能会使其速度下降很多，因此有时为了_整体_性能，让操作短暂阻塞也是可以的。务必测量你的代码实际性能瓶颈。不过，如果你发现大量工作是串行进行的，而本应并发进行，那么底层动态机制就非常重要了！

### 构建我们自己的异步抽象

我们还可以将未来调用组合在一起以创建新的模式。例如，我们可以使用已有的异步构建块来构建 `timeout` 函数。完成后，结果将成为另一个构建块，我们可以用它来创建更多的异步抽象。

列表 17-18 展示了我们预期这个 `timeout` 如何与慢未来协同工作。

<Listing number="17-18" caption="Using our imagined `timeout` to run a slow operation with a time limit" file-name="src/main.rs">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch17-async-await/listing-17-18/src/main.rs:here}}
```

</Listing>

让我们实现它！首先，让我们思考一下 `timeout` 的 API：

- 它自身必须是一个异步函数，这样我们就可以等待它。
- 它的第一个参数应该是一个未来值，用于执行操作。我们可以将其设为泛型，使其适用于任何未来值。
- 它的第二个参数将是最大等待时间。如果我们使用 `Duration`，就可以轻松传递给 `trpl::sleep`。
- 它应返回一个 `Result`。如果未来值成功完成，该 `Result` 将为 `Ok`，并包含未来值产生的结果；如果超时先发生，该 `Result` 将为 `Err`，并包含超时的持续时间。

清单 17-19 展示了此声明。

<!-- This is not tested because it intentionally does not compile. -->

<Listing number="17-19" caption="Defining the signature of `timeout`" file-name="src/main.rs">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch17-async-await/listing-17-19/src/main.rs:declaration}}
```

</Listing>

这满足了我们对类型的要求。现在让我们思考一下所需的_行为_：我们希望将传入的未来值与等待时间进行竞争。我们可以使用 `trpl::sleep` 从等待时间中生成一个计时器未来值，并使用 `trpl::select` 来使用调用者传入的 future 执行该计时器。

在清单 17-20 中，我们通过等待 `trpl::select` 的结果来实现 `timeout`。

<Listing number="17-20" caption="Defining `timeout` with `select` and `sleep`" file-name="src/main.rs">

```rust
{{#rustdoc_include ../listings/ch17-async-await/listing-17-20/src/main.rs:implementation}}
```

</Listing>

`trpl::select` 的实现并不公平：它总是按照参数传入的顺序进行轮询（其他 `select` 实现会随机选择第一个要轮询的参数）。因此，我们首先将 `future_to_try` 传递给 `select`，这样即使 `max_time` 是一个非常短的时间段，它也有机会完成。如果 `future_to_try` 先完成，`select` 将返回 `Left`，并包含 `future_to_try` 的输出；如果 `timer` 先完成，`select` 将返回 `Right`，并包含计时器的输出。

如果 `future_to_try` 成功且我们得到一个 `Left(output)`，我们将返回 `Ok(output)`。如果睡眠计时器超时而我们得到一个 `Right(())`，我们将忽略 `()` 中的 `_` 并返回 `Err(max_time)`。

这样，我们就用另外两个异步辅助函数构建出了功能正常的 `timeout`。如果我们运行代码，它将在超时后打印失败模式：

```text
Failed after 2 seconds
```

由于未来值与其他未来值组合在一起，你可以利用较小的异步构建块来创建非常强大的工具。例如，你可以使用同样的方法将超时与重试结合，进而将这些与网络调用等操作（如清单 17-5 中的内容）结合使用。

在实际使用中，你通常直接处理 `async` 和 `await`，其次使用如 `select` 这样的函数以及像 `join!` 这样的宏来控制最外层未来的执行方式。

我们现在已经看到了多种同时处理多个未来值的方法。接下来，我们将探讨如何利用 _流_ 在一段时间内按顺序处理多个未来值。

[async-program]: ch17-01-futures-and-syntax.html#our-first-async-program
