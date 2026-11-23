<!-- Old headings. Do not remove or links may break. -->

<a id="using-message-passing-to-transfer-data-between-threads"></a>

## 通过消息传递在线程之间传输数据

确保安全并发的一种越来越流行的方式就是消息传递，即线程或Actor通过发送包含数据的消息来交流。[Go语言文档](https://golang.org/doc/effective_go.html#concurrency)中的口号表达了这一理念：“不要通过共享内存进行通信；而是通过通信来共享内存。”

为了实现消息传递的并发功能，Rust的标准库提供了通道的实现。通道是一种通用编程概念，用于将数据从一个线程传输到另一个线程。

在编程中，你可以将通道想象成一条水流的方向性通道，比如溪流或河流。如果你把一个橡胶鸭放入河流中，它就会顺流而下到达河道的末端。

通道由两部分组成：发送端和接收端。发送端是放入橡胶鸭的源头位置，而接收端则是橡胶鸭最终到达的地方。代码的一部分调用发送端的方法来传递数据，另一部分则检查接收端是否有到达的消息。如果发送端或接收端之一被丢弃，则称通道为_关闭_。

在这里，我们将编写一个程序，其中一个线程生成值并通过通道发送这些值，另一个线程则接收这些值并输出它们。我们将使用通道在线程之间传递简单的值来演示这一功能。一旦你熟悉了这种技术，就可以将通道用于任何需要相互通信的线程，例如聊天系统或多个线程执行计算部分并将结果发送给一个汇总线程的系统。

首先，在清单 16-6 中，我们将创建一个通道但不对其做任何操作。请注意，目前这无法编译，因为 Rust 无法确定我们想通过通道传递的是什么类型的值。

<Listing number="16-6" file-name="src/main.rs" caption="Creating a channel and assigning the two halves to `tx` and `rx`">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch16-fearless-concurrency/listing-16-06/src/main.rs}}
```

</Listing>

我们使用 `mpsc::channel` 函数创建一个新通道；`mpsc` 代表 _多个生产者，一个消费者_。简而言之，Rust 标准库实现通道的方式意味着一个通道可以拥有多个 _发送端_ 来产生值，但只有一个 _接收端_ 来消费这些值。想象一下多个数据流一起流入一条大河：所有通过任何流发送的数据最终都会汇集到这条河中。目前我们从一个单一生产者开始，但在这个示例运行正常后，我们会添加多个生产者。

`mpsc::channel` 函数返回一个元组，其第一个元素是发送端——发射器，第二个元素是接收端——接收器。许多领域传统上使用 `tx` 和 `rx` 作为 _发射器_ 和 _接收器_ 的缩写，因此我们将变量命名为如此名称以区分每个端。我们使用 `let` 语句配合模式来解构元组；我们将在第 19 章讨论 `let` 语句中的模式用法和解构操作。目前只需知道，以这种方式使用 `let` 语句是一种便捷的方法，用于提取 `mpsc::channel` 返回的元组元素。

让我们将发送端移到一个子线程中，并让它发送一个字符串，这样子线程就会与主线程进行通信，如清单 16-7 所示。这就像把一只橡皮鸭放入上游的河里，或者从一个线程向另一个线程发送聊天消息一样。

<Listing number="16-7" file-name="src/main.rs" caption='Moving `tx` to a spawned thread and sending `"hi"`'>

```rust
{{#rustdoc_include ../listings/ch16-fearless-concurrency/listing-16-07/src/main.rs}}
```

</Listing>

再次使用 `thread::spawn` 创建新线程，然后使用 `move` 将 `tx` 移动到闭包中，使得子线程拥有 `tx`。子线程需要拥有发射器才能通过通道发送消息。

发送器具有一个 `send` 方法，该方法接收我们要发送的值。`send` 方法返回 `Result<T, E>` 类型，因此如果接收者已被丢弃且没有地方可以发送值，发送操作将返回错误。在示例中，我们使用 `unwrap` 以在出现错误时引发恐慌。但在实际应用中，我们会正确处理这种情况：回到第9章以回顾正确的错误处理策略。

在清单 16-8 中，我们将在主线程中从接收者获取值。这就像在河流末端从水中捞出橡皮鸭或接收聊天消息一样。

<Listing number="16-8" file-name="src/main.rs" caption='Receiving the value `"hi"` in the main thread and printing it'>

```rust
{{#rustdoc_include ../listings/ch16-fearless-concurrency/listing-16-08/src/main.rs}}
```

</Listing>

接收者有两个有用的方法：`recv` 和 `try_recv`。我们使用 `recv`，即 _receive_，它会阻塞主线程的执行，等待通道中有值发送过来。一旦有值被发送，`recv` 将返回一个 `Result<T, E>`。当发送器关闭时，`recv` 将返回错误以表明不再有值发送。

`try_recv` 方法不会阻塞，而是会立即返回 `Result<T, E>`：如果有消息可用，则返回一个 `Ok` 值；如果没有消息，则返回一个 `Err` 值。如果此线程在等待消息时有其他工作要做，`try_recv` 非常有用：我们可以编写一个循环，定期调用 `try_recv`，如果有消息则处理它，否则做其他工作一段时间后再再次检查。

为了简单起见，在示例中我们使用了 `recv`；主线程除了等待消息外没有其他工作，因此阻塞主线程是合适的。

当运行清单 16-8 中的代码时，我们将看到从主线程打印出的值：

<!-- Not extracting output because changes to this output aren't significant;
这些变化可能是由于线程运行方式不同而非编译器更改所致 -->

```text
Got: hi
```

Perfect!

<!-- Old headings. Do not remove or links may break. -->

<a id="channels-and-ownership-transference"></a>

### 通过通道传递所有权

所有权规则在消息发送中起着至关重要的作用，因为它们有助于编写安全且并发的代码。在 Rust 程序中考虑所有权可以带来避免并发编程错误的优势。让我们做一个实验来展示通道和所有权如何协同工作以预防问题：我们将尝试在通过通道发送 `val` 值后，在生成的线程中使用该值。试着编译清单 16-9 中的代码，看看为什么这段代码是不允许的。

<Listing number="16-9" file-name="src/main.rs" caption="Attempting to use `val` after we’ve sent it down the channel">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch16-fearless-concurrency/listing-16-09/src/main.rs}}
```

</Listing>

在这里，我们尝试通过 `tx.send` 将 `val` 发送到通道后，再将其打印出来。允许这样做是一个糟糕的主意：一旦值被发送到另一个线程，该线程可能会修改或丢弃它，而我们在尝试再次使用该值时却无法使用。潜在的后果是，其他线程的修改可能导致错误或不预期的结果，因为数据可能不一致或不存在。然而，如果我们尝试编译清单 16-9 中的代码，Rust 会给我们一个错误。

```console
{{#include ../listings/ch16-fearless-concurrency/listing-16-09/output.txt}}
```

我们的并发错误导致了编译时错误。`send` 函数会获取其参数的所有权，当值被移动后，接收者会获得该值的所有权。这阻止了我们在发送后意外再次使用该值；所有权系统会检查一切是否正常。

<!-- Old headings. Do not remove or links may break. -->

<a id="sending-multiple-values-and-seeing-the-receiver-waiting"></a>

### 发送多个值

清单 16-8 中的代码可以编译并运行，但它并没有清楚地显示两个独立线程通过通道进行通信。

在清单 16-10 中，我们进行了一些修改，以证明清单 16-8 中的代码是并发运行的：生成的线程现在会发送多个消息，并在每个消息之间暂停一秒。

<Listing number="16-10" file-name="src/main.rs" caption="Sending multiple messages and pausing between each one">

```rust,noplayground
{{#rustdoc_include ../listings/ch16-fearless-concurrency/listing-16-10/src/main.rs}}
```

</Listing>

这次，生成线程有一个字符串向量，我们希望将其发送到主线程。我们遍历这些字符串，逐个发送它们，并通过调用 `thread::sleep` 函数并传入一个一秒的 `Duration` 值来在每次发送之间暂停。

在主线程中，我们不再显式调用 `recv` 函数：而是将 `rx` 视为一个迭代器。对于接收到的每个值，我们都会将其打印出来。当通道关闭时，迭代就会结束。

当运行清单 16-10 中的代码时，你应该会在每行之间间隔一秒的停顿后看到以下输出：

<!-- Not extracting output because changes to this output aren't significant;
这些变化可能是由于线程运行方式不同所致，而非编译器参数的变化 -->

```text
Got: hi
Got: from
Got: the
Got: thread
```

由于我们在主线程的 `for` 循环中没有任何暂停或延迟的代码，我们可以判断主线程正在等待从子线程接收值。

<!-- Old headings. Do not remove or links may break. -->

<a id="creating-multiple-producers-by-cloning-the-transmitter"></a>

### 创建多个生产者 -->

之前提到 `mpsc` 是 _multiple producer, single consumer_ 的缩写。让我们使用 `mpsc` 来扩展清单 16-10 中的代码，创建多个线程向同一个接收器发送值。可以通过克隆传输器来实现，如清单 16-11 所示。

<Listing number="16-11" file-name="src/main.rs" caption="Sending multiple messages from multiple producers">

```rust,noplayground
{{#rustdoc_include ../listings/ch16-fearless-concurrency/listing-16-11/src/main.rs:here}}
```

</Listing>

这次，在创建第一个子线程之前，我们在传输器上调用 `clone`。这将生成一个新的传输器，可以传递给第一个子线程。我们将原始传输器传递给第二个子线程。这样我们就有了两个线程，每个线程向同一个接收器发送不同的消息。

运行代码后，你的输出应该类似如下：

<!-- Not extracting output because changes to this output aren't significant;
这些变化可能是由于线程运行方式不同所致，而非编译器参数的变化 -->

```text
Got: hi
Got: more
Got: from
Got: messages
Got: for
Got: the
Got: thread
Got: you
```

根据你的系统不同，你可能会看到值的顺序有所不同。这正是并发既有趣又具有挑战性的原因。如果你在多个线程中分别使用 `thread::sleep` 并赋予不同的参数，每次运行都会更加不可预测，并且产生不同的输出。

现在我们已经了解了通道的工作原理，接下来来看看另一种并发方法。
