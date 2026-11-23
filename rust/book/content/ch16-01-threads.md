## 使用线程同时运行代码

在大多数当前操作系统中，执行的程序代码会在一个_进程_中运行，而操作系统会同时管理多个进程。在一个程序中，也可以有独立的部分同时运行。用于运行这些独立部分的特性被称为_线程_。例如，一个 Web 服务器可以拥有多个线程，从而能够同时响应多个请求。

将程序的计算任务拆分为多个线程以同时运行多个任务可以提高性能，但也会增加复杂性。由于线程可以同时运行，因此无法保证不同线程中的代码部分按特定顺序执行。这可能会导致以下问题：

- 竞争条件，即线程以不一致的顺序访问数据或资源 - 死锁，即两个线程互相等待，导致两个线程都无法继续运行 - 仅在特定情况下出现的错误，且难以可靠复现和修复

Rust 试图减轻使用线程带来的负面影响，但在多线程环境中编程仍然需要仔细考虑，并且需要一种与单线程程序不同的代码结构。

编程语言以几种不同的方式实现线程，许多操作系统提供了编程语言可以调用的 API 来创建新线程。Rust 标准库采用_1:1_的线程实现模型，即一个程序使用一个操作系统线程对应一个语言线程。还有一些 crate 实现了其他类型的线程模型，这些模型在 1:1 模型的基础上做出了不同的权衡。（Rust 的异步系统将在下一章中介绍，它也提供了另一种并发方法。）

### 使用 `spawn` 创建新线程

要创建新线程，我们调用 `thread::spawn` 函数并传递一个闭包（我们在第13章中讨论过闭包），该闭包包含我们希望在新线程中运行的代码。清单 16-1 中的示例从主线程打印一些文本，同时从新线程打印其他文本。

<Listing number="16-1" file-name="src/main.rs" caption="Creating a new thread to print one thing while the main thread prints something else">

```rust
{{#rustdoc_include ../listings/ch16-fearless-concurrency/listing-16-01/src/main.rs}}
```

</Listing>

请注意，当 Rust 程序的主线程完成时，所有被 spawned 的线程都会关闭，无论它们是否已完成运行。这个程序的输出可能每次都略有不同，但看起来会类似于以下情况：

<!-- Not extracting output because changes to this output aren't significant;
这些变化可能是由于线程运行方式不同而非编译器变更所致 -->

```text
hi number 1 from the main thread!
hi number 1 from the spawned thread!
hi number 2 from the main thread!
hi number 2 from the spawned thread!
hi number 3 from the main thread!
hi number 3 from the spawned thread!
hi number 4 from the main thread!
hi number 4 from the spawned thread!
hi number 5 from the spawned thread!
```

调用 `thread::sleep` 会强制一个线程在短时间内停止执行，以便另一个线程可以运行。线程可能会轮流运行，但这并非保证：这取决于你的操作系统如何调度线程。在这次运行中，主线程先打印出来，尽管来自新线程的打印语句在代码中出现在最前面。即使我们告诉新线程直到 `i` 为 `9` 才打印，它在主线程关闭之前只打印到了 `5`。

如果你运行这段代码却只看到主线程的输出，或者没有看到任何重叠现象，尝试增加范围中的数字，以便操作系统有更多机会在线程之间切换。

<!-- Old headings. Do not remove or links may break. -->

<a id="waiting-for-all-threads-to-finish-using-join-handles"></a>

### 等待所有线程完成

由于主线程结束，清单 16-1 中的代码大多数时候会过早终止新线程，而且由于无法保证线程运行的顺序，我们也无法保证新线程能够运行！

我们可以通过将 `thread::spawn` 的返回值保存到变量中来解决新线程不运行或提前终止的问题。`thread::spawn` 的返回类型为 `JoinHandle<T>`。`JoinHandle<T>` 是一个拥有值，当我们对其调用 `join` 方法时，它会等待其线程完成。清单 16-2 展示了如何使用清单 16-1 中创建的线程的 `JoinHandle<T)`，以及如何调用 `join` 以确保新线程在 `main` 退出前完成运行。

<Listing number="16-2" file-name="src/main.rs" caption="Saving a `JoinHandle<T>` from `thread::spawn` to guarantee the thread is run to completion">

```rust
{{#rustdoc_include ../listings/ch16-fearless-concurrency/listing-16-02/src/main.rs}}
```

</Listing>

对句柄调用 `join` 会阻塞当前运行的线程，直到该句柄所代表的线程终止。阻塞线程意味着该线程无法执行任务或退出。由于我们将 `join` 调用放在主线程的 `for` 循环之后，运行 Listing 16-2 应该会产生类似以下的输出：

<!-- Not extracting output because changes to this output aren't significant;
这些变化可能是由于线程运行方式不同所致，而非编译器参数的变化 -->

```text
hi number 1 from the main thread!
hi number 2 from the main thread!
hi number 1 from the spawned thread!
hi number 3 from the main thread!
hi number 2 from the spawned thread!
hi number 4 from the main thread!
hi number 3 from the spawned thread!
hi number 4 from the spawned thread!
hi number 5 from the spawned thread!
hi number 6 from the spawned thread!
hi number 7 from the spawned thread!
hi number 8 from the spawned thread!
hi number 9 from the spawned thread!
```

两个线程继续交替运行，但由于 `handle.join()` 的调用，主线程会等待，直到子线程完成才结束。

但让我们看看如果我们将 `handle.join()` 放在 `main` 中的 `for` 循环之前会发生什么：

<Listing file-name="src/main.rs">

```rust
{{#rustdoc_include ../listings/ch16-fearless-concurrency/no-listing-01-join-too-early/src/main.rs}}
```

</Listing>

主线程将等待子线程完成，然后继续运行其 `for` 循环，因此输出将不再交错，如这里所示：

<!-- Not extracting output because changes to this output aren't significant;
这些变化可能是由于线程运行方式不同所致，而非编译器参数的变化 -->

```text
hi number 1 from the spawned thread!
hi number 2 from the spawned thread!
hi number 3 from the spawned thread!
hi number 4 from the spawned thread!
hi number 5 from the spawned thread!
hi number 6 from the spawned thread!
hi number 7 from the spawned thread!
hi number 8 from the spawned thread!
hi number 9 from the spawned thread!
hi number 1 from the main thread!
hi number 2 from the main thread!
hi number 3 from the main thread!
hi number 4 from the main thread!
```

一些细节，例如 `join` 调用的位置，会影响你的线程是否同时运行。

### 在线程中使用 `move` 闭包

我们经常会在传递给 `thread::spawn` 的闭包中使用 `move` 关键字，因为这样闭包将拥有其使用的环境中的值，从而将这些值的所有权从一个线程转移到另一个线程。在第13章的“捕获引用或转移所有权”部分中，我们讨论了闭包上下文下的 `move`。现在我们将更关注 `move` 与 `thread::spawn` 之间的交互。

请注意，在 Listing 16-1 中，我们传递给 `thread::spawn` 的闭包没有参数：我们在子线程代码中没有使用主线程的任何数据。若要在子线程中使用主线程的数据，子线程的闭包必须捕获所需的值。Listing 16-3 展示了在主线程创建向量并在子线程中使用的尝试。然而，目前这并不生效，正如你稍后会看到的那样。

<Listing number="16-3" file-name="src/main.rs" caption="Attempting to use a vector created by the main thread in another thread">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch16-fearless-concurrency/listing-16-03/src/main.rs}}
```

</Listing>

该闭包使用 `v`，因此它会捕获 `v` 并将其作为闭包的环境的一部分。由于 `thread::spawn` 在新线程中运行此闭包，我们应该能够在那个新线程中访问 `v`。但是当我们编译这个示例时，会出现以下错误：

```console
{{#include ../listings/ch16-fearless-concurrency/listing-16-03/output.txt}}
```

Rust 会推断如何捕获 `v`，因为 `println!` 只需要对 `v` 的引用，所以闭包试图借用 `v`。然而，存在一个问题：Rust 无法知道生成的线程将运行多久，因此不知道对 `v` 的引用是否始终有效。

列表 16-4 提供了一个更有可能出现无效引用的场景。

<Listing number="16-4" file-name="src/main.rs" caption="A thread with a closure that attempts to capture a reference to `v` from a main thread that drops `v`">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch16-fearless-concurrency/listing-16-04/src/main.rs}}
```

</Listing>

如果 Rust 允许我们运行此代码，那么生成的新线程可能会立即被放入后台而不执行任何操作。生成线程内部有一个对 `v` 的引用，但主线程会立即丢弃 `v`，使用我们在第 15 章中讨论的 `drop` 函数。然后，当生成线程开始执行时，`v` 不再有效，因此对它的引用也无效了。哦，不！

为了修复列表 16-3 中的编译器错误，我们可以遵循错误信息中的建议：

<!-- manual-regeneration
自动重新生成后，查看 listings/ch16-fearless-concurrency/listing-16-03/output.txt 并复制相关部分 -->

```text
help: to force the closure to take ownership of `v` (and any other referenced variables), use the `move` keyword
  |
6 |     let handle = thread::spawn(move || {
  |                                ++++
```

通过在闭包前添加 `move` 关键字，我们强制闭包拥有其使用的数值的所有权，而不是让 Rust 推断应该借用这些数值。列表 16-5 中显示的对列表 16-3 的修改将按我们的意图编译并运行。

<Listing number="16-5" file-name="src/main.rs" caption="Using the `move` keyword to force a closure to take ownership of the values it uses">

```rust
{{#rustdoc_include ../listings/ch16-fearless-concurrency/listing-16-05/src/main.rs}}
```

</Listing>

我们可能会想尝试用同样的方法修复列表 16-4 中的代码，其中主线程使用 `move` 闭包调用 `drop`。然而，这种修复不会生效，因为列表 16-4 试图做的事情因其他原因而被禁止。如果我们向闭包添加 `move`，就会将 `v` 移入闭包的环境中，我们在主线程就无法再对其调用 `drop` 了。我们会得到这个编译器错误：

```console
{{#include ../listings/ch16-fearless-concurrency/output-only-01-move-drop/output.txt}}
```

Rust 的所有权规则再次救了我们！由于 Rust 过于保守，只允许线程借用 `v`，因此我们在清单 16-3 中的代码出现了错误，这意味着主线程理论上可能使生成的线程的引用失效。通过告诉 Rust 将 `v` 的所有权转移到生成线程，我们向 Rust 保证主线程不会再使用 `v`。如果我们以相同的方式修改清单 16-4，那么在主线程尝试使用 `v` 时就会违反所有权规则。`move` 关键字会覆盖 Rust 保守的默认借用行为；它不允许我们违反所有权规则。

现在我们已经了解了线程是什么以及线程 API 提供的功能，让我们来看看可以使用线程的一些情况。

[capture]: ch13-01-closures.html#capturing-references-or-moving-ownership
