## 共享状态并发

消息传递是处理并发的一种好方法，但并非唯一方式。另一种方法是多个线程访问相同的共享数据。再次参考 Go 语言文档中的口号：“不要通过共享内存来交流。”

通过共享内存进行通信会是什么样子？此外，为什么消息传递支持者会警告不要使用内存共享？

从某种意义上说，任何编程语言中的通道都类似于单一所有权，因为一旦你将值通过通道传输，就不应再使用该值。共享内存并发则类似多重所有权：多个线程可以同时访问相同的内存位置。正如第 15 章中所看到的，智能指针使得多重所有权成为可能，而多重所有权可能会增加复杂性，因为这些不同的所有者需要管理。Rust 的类型系统和所有权规则极大地帮助了正确管理这些关系。以互斥锁为例，这是用于共享内存的常用并发原语之一。

<!-- Old headings. Do not remove or links may break. -->

<a id="using-mutexes-to-allow-access-to-data-from-one-thread-at-a-time"></a>

### 使用互斥锁控制访问

_Mutex_ 是 _mutual exclusion_ 的缩写，意味着互斥锁允许在任何给定时间只有一个线程访问某些数据。要访问互斥锁中的数据，线程必须首先请求获取互斥锁的锁定，以表明其希望访问该数据。_Lock_ 是一种数据结构，属于互斥锁的一部分，用于跟踪当前谁拥有对该数据的独占访问权。因此，互斥锁通过锁定系统被描述为 _保护_ 其所持有的数据。

互斥锁因其使用上的复杂性而受到批评，因为你必须记住两条规则：

1. 在使用数据之前必须尝试获取锁定。
2. 当完成对互斥锁所保护的数据的操作后，必须解锁该数据，以便其他线程可以获取锁定。

为了理解互斥锁的现实世界类比，可以想象在会议中只有一个麦克风的讨论环节。在发言者开始讲话之前，他们必须请求或示意自己想要使用麦克风。当获得麦克风后，他们可以任意长时间发言，然后将麦克风递给下一个希望发言的人。如果发言者在结束发言时忘记交还麦克风，其他人就无法发言了。如果共享麦克风的管理出现问题，讨论环节将无法按计划进行！

互斥锁的管理非常难以正确实现，这就是为什么很多人对通道更感兴趣的原因。然而，得益于 Rust 的类型系统和所有权规则，你不会在加锁和解锁方面出错。

#### `Mutex<T>` 的 API

作为使用互斥锁的一个例子，让我们从单线程环境中使用互斥锁开始，如清单 16-12 所示。

<Listing number="16-12" file-name="src/main.rs" caption="Exploring the API of `Mutex<T>` in a single-threaded context for simplicity">

```rust
{{#rustdoc_include ../listings/ch16-fearless-concurrency/listing-16-12/src/main.rs}}
```

</Listing>

与许多类型一样，我们使用关联函数 `new` 来创建 `Mutex<T>`。为了访问互斥锁内的数据，我们使用 `lock` 方法获取锁。此调用会阻塞当前线程，使其无法执行任何工作，直到轮到我们获得锁为止。

如果持有锁的其他线程发生 panic，则 `lock` 调用将会失败。在这种情况下，没有人能够获得锁，因此我们选择使用 `unwrap`，并在遇到这种情况时让该线程发生 panic。

获取锁后，我们可以把返回值视为对内部数据的可修改引用，这里称为 `num`。类型系统确保我们在使用 `m` 中的值时先获得锁。`m` 的类型是 `Mutex<i32>，而不是 `i32`，因此我们必须调用 `lock` 才能使用 `i32` 值。我们不能忘记：否则类型系统不允许我们访问内部的 `i32`。

调用 `lock` 后返回一种名为 `MutexGuard` 的类型，该类型被包裹在 `LockResult` 中，我们通过调用 `unwrap` 来处理它。`MutexGuard` 类型实现了 `Deref` 接口以指向内部数据；该类型还包含了一个 `Drop` 实现，当 `MutexGuard` 超出作用域时（即内部作用域结束时），会自动释放锁，因此我们不会面临忘记释放锁而导致互斥锁被其他线程使用的风险。

在释放锁之后，我们可以打印互斥锁的值，并看到内部的 `i32` 值已变为 `6`。

<!-- Old headings. Do not remove or links may break. -->

<a id="sharing-a-mutext-between-multiple-threads"></a>

#### `Mutex<T>` 的共享访问

现在让我们尝试使用 `Mutex<T>` 在多个线程之间共享一个值。我们将启动 10 个线程，让每个线程将计数器值增加 1，从而使计数器从 0 变为 10。清单 16-13 中的示例将会产生编译器错误，我们将利用这个错误来学习更多关于如何使用 `Mutex<T>` 以及 Rust 如何帮助我们正确使用它。

<Listing number="16-13" file-name="src/main.rs" caption="Ten threads, each incrementing a counter guarded by a `Mutex<T>`">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch16-fearless-concurrency/listing-16-13/src/main.rs}}
```

</Listing>

我们创建了一个 `counter` 变量，在 `Mutex<T>` 中保存一个 `i32` 值，就像我们在清单 16-12 中所做的那样。接下来，我们通过遍历一系列数字来创建 10 个线程。我们使用 `thread::spawn` 并给所有线程传递同一个闭包：该闭包将计数器移动到线程中，通过调用 `lock` 方法获取 `Mutex<T>` 的锁，然后向互斥锁中的值加 1。当某个线程完成其闭包的执行后，`num` 就会超出作用域并释放锁，以便其他线程可以获取锁。

在主线程中，我们收集所有 join 句柄。然后，如同在清单 16-2 中那样，我们对每个句柄调用 `join` 以确保所有线程完成运行。此时，主线程将获取锁并打印程序的结果。

我们之前暗示这个示例无法编译。现在让我们找出原因！

```console
{{#include ../listings/ch16-fearless-concurrency/listing-16-13/output.txt}}
```

错误信息表明在循环的上一轮迭代中，`counter` 值被移动了。Rust 告诉我们不能将锁 `counter` 的所有权移动到多个线程中。我们将使用第 15 章中讨论的多重所有权方法来修复编译器错误。

#### 多个线程的多种所有权

在第十五章中，我们通过使用智能指针 `Rc<T>` 来创建引用计数值，为多个所有者赋予一个价值。让我们在这里也做同样的事情，看看会发生什么。我们将在清单 16-14 中将 `Mutex<T>` 封装在 `Rc<T>` 中，并在将所有权转移给线程之前克隆 `Rc<T>`。

<Listing number="16-14" file-name="src/main.rs" caption="Attempting to use `Rc<T>` to allow multiple threads to own the `Mutex<T>`">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch16-fearless-concurrency/listing-16-14/src/main.rs}}
```

</Listing>

再次编译后，我们得到了……不同的错误！编译器教会了我们很多：

```console
{{#include ../listings/ch16-fearless-concurrency/listing-16-14/output.txt}}
```

哇，那个错误信息非常冗长！重点在于：```Rc<Mutex<i32>>`无法在线程间安全地传递 ``。编译器还告诉我们原因：```Rc<Mutex<i32>>`没有实现 `Send` 特质 ``。我们在下一节会讨论 `Send`：它是确保与线程一起使用的类型适用于并发环境的特质之一。

不幸的是，`Rc<T>` 在跨线程共享时并不安全。当 `Rc<T>` 管理引用计数时，每次调用 `clone` 都会增加计数，而每次克隆被丢弃时则减少计数。但它没有使用任何并发原语来确保计数的变化不会被其他线程中断。这可能导致错误的计数——微妙的错误可能会引发内存泄漏或值在我们完成之前被丢弃。我们需要一种与 `Rc<T>` 完全相同的类型，但能够以线程安全的方式修改引用计数。

#### 使用 `Arc<T>` 实现原子引用计数

幸运的是，`Arc<T>` 是一种类似于 `Rc<T>` 的类型，在并发环境中是安全的。_a_代表_原子_，意味着它是一种_原子性引用计数_类型。原子기는另一种并发原语，我们在这里不会详细讨论：更多细节请参考标准库文档中的 [`std::sync::atomic`][atomic]<!-- ignore -->。此时，你只需要知道原子기는像基本类型一样工作，但在跨线程共享时是安全的。

你可能会好奇，为什么所有基本类型都不是原子的，为什么标准库类型没有默认使用 `Arc<T>`。原因是线程安全性会带来性能开销，只有在实际需要时才会产生这种开销。如果你只是在单个线程内对值进行操作，如果不需要保证原子性的特性，代码运行速度会更快。

让我们回到示例：`Arc<T>` 和 `Rc<T>` 具有相同的 API，因此我们通过修改 `use` 行、`new` 调用和 `clone` 调用来修复程序。清单 16-15 中的代码最终可以编译并运行。

<Listing number="16-15" file-name="src/main.rs" caption="Using an `Arc<T>` to wrap the `Mutex<T>` to be able to share ownership across multiple threads">

```rust
{{#rustdoc_include ../listings/ch16-fearless-concurrency/listing-16-15/src/main.rs}}
```

</Listing>

这段代码会输出以下内容：

<!-- Not extracting output because changes to this output aren't significant;
这些更改可能是由于线程运行方式不同所致，而非编译器的变化 -->

```text
Result: 10
```

我们成功了！我们从 0 数到 10，虽然看起来并不令人印象深刻，但这确实让我们对 `Mutex<T>` 和线程安全性有了很多了解。你还可以利用这个程序的结构来执行更复杂的操作，而不仅仅是递增计数器。采用这种策略，你可以将计算分为独立的部分，在多个线程中分配这些部分，然后使用 `Mutex<T>` 让每个线程更新其部分的最终结果。

请注意，如果你进行简单的数值运算，标准库中的 [`std::sync::atomic` 模块][atomic]<!-- ignore -->提供了比 `Mutex<T>` 更简单的类型。这些类型提供了对基本类型的安全、并发、原子访问方式。在这个例子中，我们选择使用 `Mutex<T]` 与基本类型，以便专注于 `Mutex<T>` 的工作原理。

<!-- Old headings. Do not remove or links may break. -->

<a id="similarities-between-refcelltrct-and-mutextarct"></a>

### 比较 `RefCell<T>`/`Rc<T>` 和 `Mutex<T>`/`Arc<T>`

你可能已经注意到 `counter` 是不可变的，但我们可以得到对其内部值的可变引用；这意味着 `Mutex<T>` 提供了与 `Cell` 家族相同的内部可变性。就像我们在第 15 章中使用 `RefCell<T]` 来允许在 `Rc<T>` 内修改内容一样，我们也在 `Arc<T>` 内使用 `Mutex<T]` 来修改内容。

另一个需要注意的细节是，使用 `Mutex<T>` 时 Rust 无法防止所有类型的逻辑错误。从第15章可知，使用 `Rc<T>` 存在创建引用循环的风险，即两个 `Rc<T>` 值相互引用，导致内存泄漏。同样，`Mutex<T>` 也存在产生_死锁_的风险。当某个操作需要锁定两个资源且两个线程各自获得了其中一个锁时，会导致它们永远等待对方，从而发生死锁。如果你对死锁感兴趣，可以尝试编写一个存在死锁的 Rust 程序；然后研究任何语言中针对互斥量的死锁缓解策略，并尝试在 Rust 中实现这些策略。`Mutex<T>` 和 `MutexGuard` 的标准库 API 文档提供了有用的信息。

我们将通过讨论 `Send` 和 `Sync` 特征以及如何将它们与自定义类型结合使用来结束这一章。

[atomic]: ../std/sync/atomic/index.html
