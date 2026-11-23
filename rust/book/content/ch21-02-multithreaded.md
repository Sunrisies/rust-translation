<!-- Old headings. Do not remove or links may break. -->

<a id="turning-our-single-threaded-server-into-a-multithreaded-server"></a>
<a id="from-single-threaded-to-multithreaded-server"></a>

## 从单线程服务器转变为多线程服务器

目前，服务器会依次处理每个请求，这意味着在第一个连接处理完成之前，不会处理第二个连接。如果服务器接收的请求越来越多，这种串行执行方式将变得不再理想。如果服务器收到一个需要长时间处理的请求，后续请求将不得不等待该长请求完成，即使新的请求可以迅速处理。我们需要解决这个问题，但首先让我们通过实际案例来观察问题。

<!-- Old headings. Do not remove or links may break. -->

<a id="simulating-a-slow-request-in-the-current-server-implementation"></a>

### 模拟慢速请求

我们将观察一个处理缓慢的请求如何影响当前服务器实现中的其他请求。清单 21-10 展示了如何处理 _/sleep_ 请求，并使用模拟的慢响应让服务器在响应前休眠五秒。

<Listing number="21-10" file-name="src/main.rs" caption="Simulating a slow request by sleeping for five seconds">

```rust,no_run
{{#rustdoc_include ../listings/ch21-web-server/listing-21-10/src/main.rs:here}}
```

</Listing>

由于我们有了三种情况，我们从 `if` 切换到了 `match`。我们需要显式地对 `request_line` 切片进行匹配，以与字符串字面值进行模式匹配；`match` 不像相等性方法那样自动进行引用和解引用操作。

第一个分支与清单 21-9 中的 `if` 块相同。第二个分支用于匹配 _/sleep_ 请求。当收到该请求时，服务器将休眠五秒后再渲染成功的 HTML 页面。第三个分支与清单 21-9 中的 `else` 块相同。

你可以看到我们的服务器是多么的初级：真正的库会以更简洁的方式处理多个请求的识别！

使用 `cargo run` 启动服务器。然后打开两个浏览器窗口：一个用于 _http://127.0.0.1:7878_，另一个用于 _http://127.0.0.1:7878/sleep_。如果你像之前一样多次输入 _/_ URI，你会看到它迅速响应。但如果你输入 _/sleep_ 然后加载 _/_，你会发现 _/_ 会等待 `sleep` 完全休眠五秒后才加载。

我们有多种技术可以避免请求在慢速请求之后排队，包括使用异步机制，正如第17章中所做的那样；我们将实现的方案是线程池。

### 使用线程池提高吞吐量

_线程池_ 是一组已生成且准备处理任务的线程。当程序接收到新任务时，它会将线程池中的某个线程分配给该任务，该线程将处理该任务。在第一个线程处理任务期间，线程池中剩余的线程可用于处理其他传入的任务。当第一个线程完成其任务后，它会被返回到空闲线程池中，准备处理新的任务。线程池允许您并发处理连接，从而提升服务器的吞吐量。

我们将限制线程池中的线程数量在一个较小的数值，以防范 DDoS 攻击；如果我们的程序对每个请求都创建新线程，那么有人向我们的服务器发送1000万个请求就会耗尽所有服务器资源，导致请求处理停滞。

因此，我们不会生成无限数量的线程，而是有固定数量的线程在池中等待。传入的请求被发送到池中进行处理。池会维护一个传入请求的队列。池中的每个线程都会从队列中取出一个请求进行处理，然后向队列请求另一个请求。通过这种设计，我们可以并发处理多达 _`N_` 个请求，其中 _`N_` 是线程的数量。如果每个线程都在响应一个长时间运行的请求，后续的请求仍可以积压在队列中，但我们增加了能够处理的长时间运行请求的数量。

这种技术只是提高 Web 服务器吞吐量的众多方法之一。您还可以探索其他选项，如 fork/join 模型、单线程异步 I/O 模型和多线程异步 I/O 模型。如果您对这一主题感兴趣，可以阅读更多关于其他解决方案的内容并尝试实现它们；使用像 Rust 这样的低级语言，所有这些选项都是可行的。

在开始实现线程池之前，让我们先讨论使用该池应该是什么样子。在设计代码时，首先编写客户端接口有助于指导设计过程。编写代码的 API 应按照你期望的调用方式进行结构化；然后在该结构内实现功能，而不是先实现功能再设计公共 API。

与第12章中使用的测试驱动开发类似，这里我们将使用编译器驱动开发。我们会编写调用所需函数的代码，然后查看编译器的错误以确定下一步需要修改什么才能使代码正常工作。但在做这些之前，我们先探索一种不会使用的技术作为起点。

<!-- Old headings. Do not remove or links may break. -->

<a id="code-structure-if-we-could-spawn-a-thread-for-each-request"></a>

#### 针对每个请求创建线程

首先，让我们看看如果为每个连接都创建新线程，我们的代码会是什么样子。如前所述，由于可能创建无限数量的线程带来的问题，这并非最终计划，但它是实现可工作的多线程服务器的起点。之后，我们会添加线程池作为改进措施，这样对比两种解决方案就会更清晰。

清单 21-11 显示了在 `main` 函数中进行的修改，以便在 `for` 循环内为每个流处理创建新线程。

<Listing number="21-11" file-name="src/main.rs" caption="Spawning a new thread for each stream">

```rust,no_run
{{#rustdoc_include ../listings/ch21-web-server/listing-21-11/src/main.rs:here}}
```

</Listing>

正如你在第16章中学到的那样，`thread::spawn` 会创建一个新线程，并在该线程中运行闭包中的代码。如果你运行这段代码并在浏览器中加载 _/sleep_，然后在另外两个浏览器标签页中加载 _/_，你会看到对 _/_ 的请求不需要等待 _/sleep_ 完成。然而，正如我们提到的，这最终会使系统不堪重负，因为你会在没有限制的情况下创建新线程。

你可能还记得第17章中的内容，这正是异步和 await 真正发挥作用的场景！在构建线程池时记住这一点，思考使用异步处理时情况会有何不同或相同。

<!-- Old headings. Do not remove or links may break. -->

<a id="creating-a-similar-interface-for-a-finite-number-of-threads"></a>

#### 创建有限数量的线程

我们希望线程池以类似且熟悉的方式运行，这样从线程切换到线程池时不需要对使用我们 API 的代码进行大量修改。清单 21-12 展示了我们想要使用的 `ThreadPool` 结构体的假设接口，以替代 `thread::spawn`。

<Listing number="21-12" file-name="src/main.rs" caption="Our ideal `ThreadPool` interface">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch21-web-server/listing-21-12/src/main.rs:here}}
```

</Listing>

我们使用 `ThreadPool::new` 来创建一个具有可配置线程数（本例中为四个）的新线程池。然后，在 `for` 循环中，`pool.execute` 的接口与 `thread::spawn` 类似，它接受一个闭包，该闭包由线程池为每个流执行。我们需要实现 `pool.execute`，使其接收闭包并将它传递给线程池中的某个线程执行。这段代码目前无法编译，但我们会尝试编译，以便编译器能指导我们如何修复它。

<!-- Old headings. Do not remove or links may break. -->

<a id="building-the-threadpool-struct-using-compiler-driven-development"></a>

#### 使用编译器驱动开发构建 `ThreadPool`

在清单 21-12 中进行更改后，将其添加到 `_src/main.rs_` 中，然后利用 `cargo check` 产生的编译器错误来推动我们的开发工作。我们得到第一个错误如下：

```console
{{#include ../listings/ch21-web-server/listing-21-12/output.txt}}
```

很好！这个错误表明我们需要一个 `ThreadPool` 类型或模块，因此我们现在就构建它。我们的 `ThreadPool` 实现与我们的 Web 服务器所处理的工作类型无关。所以，我们将 `hello` crate 从二进制 crate 转换为库 crate，以存放我们的 `ThreadPool` 实现。更改后成为库 crate 后，我们还可以使用单独的线程池库来处理任何需要使用线程池的工作，而不仅仅用于服务 Web 请求。

创建一个包含以下内容的 `_src/lib.rs_` 文件，这是目前我们可以拥有的最简单的 `ThreadPool` 结构体定义：

<Listing file-name="src/lib.rs">

```rust,noplayground
{{#rustdoc_include ../listings/ch21-web-server/no-listing-01-define-threadpool-struct/src/lib.rs}}
```

</Listing>


然后，编辑 `_main.rs_` 文件，通过向 `_src/main.rs_` 顶部添加以下代码，使 `ThreadPool` 从库 crate 中可访问：

<Listing file-name="src/main.rs">

```rust,ignore
{{#rustdoc_include ../listings/ch21-web-server/no-listing-01-define-threadpool-struct/src/main.rs:here}}
```

</Listing>

这段代码仍然无法运行，但让我们再次检查以发现下一个需要解决的错误：

```console
{{#include ../listings/ch21-web-server/no-listing-01-define-threadpool-struct/output.txt}}
```

此错误表明接下来我们需要为 `ThreadPool` 创建一个名为 `new` 的关联函数。我们也知道 `new` 需要一个参数，该参数可以接受 `4` 作为参数，并应返回一个 `ThreadPool` 实例。让我们实现一个具有这些特性的最简单的 `new` 函数：

<Listing file-name="src/lib.rs">

```rust,noplayground
{{#rustdoc_include ../listings/ch21-web-server/no-listing-02-impl-threadpool-new/src/lib.rs}}
```

</Listing>

我们选择使用 `usize` 作为 `size` 参数的类型，因为我们知道负数量的线程没有意义。我们还知道我们将使用 `4` 作为线程集合中的元素数量，`usize` 类型正是用于此目的，如第3章的“整数类型”部分所述。

让我们再次检查代码：

```console
{{#include ../listings/ch21-web-server/no-listing-02-impl-threadpool-new/output.txt}}
```

现在出现错误是因为 `ThreadPool` 上没有 `execute` 方法。回想一下“创建有限数量的线程”部分，我们决定线程池应该具有类似于 `thread::spawn` 的接口。此外，我们将实现 `execute` 函数，使其接收给定的闭包并将其传递给池中空闲的线程执行。

我们将在 `ThreadPool` 上定义 `execute` 方法，以接受闭包作为参数。回想一下第13章中的“从闭包中移出捕获值”，我们可以以三种不同的方式将闭包作为参数：`Fn`、`FnMut` 和 `FnOnce`。我们需要决定使用哪种类型的闭包。我们知道最终会类似于标准库 `thread::spawn` 的实现，因此我们可以查看 `thread::spawn` 签名对参数的限制。文档中显示如下：

```rust,ignore
pub fn spawn<F, T>(f: F) -> JoinHandle<T>
    where
        F: FnOnce() -> T,
        F: Send + 'static,
        T: Send + 'static,
```

`F` 类型参数是我们这里关注的；`T` 类型参数与返回值相关，我们并不关心它。我们可以看到 `spawn` 在 `F` 上使用了 `FnOnce` 作为特质边界。这很可能也是我们希望的，因为最终我们会将 `execute` 中得到的参数传递给 `spawn`。我们可以进一步确信 `FnOnce` 就是我们要使用的特质，因为运行请求的线程只会执行该请求的闭包一次，这与 `FnOnce` 中的 `Once` 相符。

`F` 类型参数还具有 `Send` 特质边界和 `'static` 生命周期边界，这在我们的场景中非常有用：我们需要 `Send` 以便将闭包从一个线程传输到另一个线程，需要 `'static` 是因为我们不知道线程执行所需的时间。我们可以在 `ThreadPool` 上创建一个 `execute` 方法，该方法接受一个类型为 `F` 的泛型参数，并带有以下边界：

<Listing file-name="src/lib.rs">

```rust,noplayground
{{#rustdoc_include ../listings/ch21-web-server/no-listing-03-define-execute/src/lib.rs:here}}
```

</Listing>

我们在 `FnOnce` 后仍然使用 `()`，因为这个 `FnOnce` 表示一个不接收参数且返回单位类型 `()` 的闭包。就像函数定义一样，返回类型可以从签名中省略，但即使没有参数，仍然需要括号。

这又是 `execute` 方法的最简单实现：它什么都不做，但我们只是试图让代码能够编译通过。让我们再检查一次：

```console
{{#include ../listings/ch21-web-server/no-listing-03-define-execute/output.txt}}
```

它可以编译！但请注意，如果您尝试运行 `cargo run` 并在浏览器中发起请求，您会在浏览器中看到我们在章节开头看到的错误。实际上我们的库还没有调用传递给 `execute` 的闭包！

> 注意：关于使用严格编译器的语言（如 Haskell 和 Rust）有一句说法：“如果代码可以编译，它就有效。”但这句话并非普遍适用。我们的项目可以编译，但它完全不执行任何操作！如果我们正在构建一个真正的完整项目，现在正是开始编写单元测试以验证代码能够编译并且具有我们期望的行为的好时机。

思考一下：如果我们打算执行一个未来值而不是闭包，会有什么不同？

#### 在 `new` 中验证线程数量

我们对 `new` 和 `execute` 的参数不做任何处理。让我们按照所需的逻辑实现这些函数的主体代码。首先，我们来思考 `new` 函数。之前我们选择了无符号类型作为 `size` 参数，因为包含负数量线程的池没有意义。然而，包含零个线程的池同样没有意义，但零是一个完全有效的 `usize`。我们将添加代码在返回 `ThreadPool` 实例之前检查 `size` 是否大于零，如果接收到零值，将使用 `assert!` 宏使程序崩溃，如清单 21-13 所示。

<Listing number="21-13" file-name="src/lib.rs" caption="Implementing `ThreadPool::new` to panic if `size` is zero">

```rust,noplayground
{{#rustdoc_include ../listings/ch21-web-server/listing-21-13/src/lib.rs:here}}
```

</Listing>

我们还为 `ThreadPool` 添加了文档注释。请注意，我们遵循了良好的文档编写规范，在章节 14 中讨论过的情况下增加了说明函数可能崩溃的段落。尝试运行 `cargo doc --open`，然后点击 `ThreadPool` 结构体，查看 `new` 的生成文档效果！

与其像这里那样使用 `assert!` 宏，我们可以将 `new` 改为 `build` 并返回 `Result`，就像在 I/O 项目中对 `Config::build` 所做的那样，如清单 12-9 所示。但在这种情况下，尝试创建没有线程的线程池应该是一个无法修复的错误。如果你有雄心，可以编写一个名为 `build` 的函数，其签名如下，与 `new` 函数进行比较：

```rust,ignore
pub fn build(size: usize) -> Result<ThreadPool, PoolCreationError> {
```

#### 为存储线程创建空间

现在我们已经知道有有效的线程数量可以存储在池中，我们可以创建这些线程并将它们存储在 `ThreadPool` 结构中，然后再返回该结构。但是如何“存储”一个线程呢？让我们再看看 `thread::spawn` 的签名：

```rust,ignore
pub fn spawn<F, T>(f: F) -> JoinHandle<T>
    where
        F: FnOnce() -> T,
        F: Send + 'static,
        T: Send + 'static,
```

`spawn` 函数返回一个 `JoinHandle<T`，其中 `T` 是闭包返回的类型。让我们尝试使用 `JoinHandle` 看看会发生什么。在我们的案例中，传递给线程池的闭包将处理连接操作而不返回任何内容，因此 `T` 将是单位类型 `()`。

清单 21-14 中的代码可以编译，但目前并未创建任何线程。我们更改了 `ThreadPool` 的定义，使其包含一个 `thread::JoinHandle<()>` 的向量，并用 `size` 容量初始化该向量，然后设置了一个 `for` 循环来运行某些代码以创建线程，最后返回一个包含这些线程的 `ThreadPool` 实例。

<Listing number="21-14" file-name="src/lib.rs" caption="Creating a vector for `ThreadPool` to hold the threads">

```rust,ignore,not_desired_behavior
{{#rustdoc_include ../listings/ch21-web-server/listing-21-14/src/lib.rs:here}}
```

</Listing>

我们在库 crate 中将 `std::thread` 引入作用域，因为我们在 `ThreadPool` 中的向量中使用了 `thread::JoinHandle` 作为元素类型。

一旦接收到有效的容量，我们的 `ThreadPool` 就会创建一个可以容纳 `size` 个元素的向量。`with_capacity` 函数执行的任务与 `Vec::new` 相同，但有一个重要区别：它预先分配了向量中的空间。由于我们知道需要在向量中存储 `size` 个元素，这种提前分配比使用 `Vec::new` 更高效，因为后者在插入元素时会重新调整大小。

当你再次运行 `cargo check` 时，它应该会成功。

<!-- Old headings. Do not remove or links may break. -->
<a id ="a-worker-struct-responsible-for-sending-code-from-the-threadpool-to-a-thread"></a>

#### 将代码从 `ThreadPool` 发送到线程 在清单 21-14的`for`循环中，我们留下了一条关于创建线程的注释。现在，我们将看看如何实际创建线程。标准库提供了`thread::spawn`作为创建线程的方法，`thread::spawn`期望在线程创建时立即获取一些线程应运行的代码。然而，在我们的案例中，我们希望创建线程并让它们_等待_稍后发送的代码。标准库的线程实现没有提供这种功能；我们必须手动实现它。

我们在列表 21-14 中的 `for` 循环里留下了一条关于创建线程的评论。现在，我们将探讨如何实际创建线程。标准库提供了 `thread::spawn` 作为创建线程的方法，`thread::spawn` 期望在线程创建后立即执行某些代码。然而，在我们的案例中，我们希望创建线程并让它们_等待_稍后发送的代码。标准库对线程的实现没有提供这种功能；我们必须手动实现它。

我们将通过引入一个新的数据结构来实现这种行为，该数据结构位于`ThreadPool`和线程之间，用于管理这一新行为。我们将这个数据结构称为_Worker_，这是池化实现中常用的术语。`Worker`负责获取需要运行的代码并在其线程中执行这些代码。

可以想象餐厅厨房里工作的人员：工人等待顾客点单，然后他们负责接收点单并准备食物。

我们不会在线程池中存储 `JoinHandle<()>` 实例的向量，而是会存储 `Worker` 结构的实例。每个 `Worker` 都会保存一个 `JoinHandle<()>` 实例。然后，我们在 `Worker` 上实现一种方法，该方法接收要运行的代码闭包，并将其发送到正在运行的线程进行执行。我们还会给每个 `Worker` 分配一个 `id`，以便在日志记录或调试时能够区分池中的不同 `Worker` 实例。

这是当我们创建 `ThreadPool` 时会发生的新过程。我们将实现在以这种方式设置 `Worker` 后，将闭包发送到线程的代码：

1. 定义包含 `id` 和 `JoinHandle<()>` 的 `Worker` 结构。
2. 修改 `ThreadPool` 以保存 `Worker` 实例的向量。
3. 定义 `Worker::new` 函数，该函数接收 `id` 数字并返回一个包含 `id` 以及使用空闭包生成的新线程的 `Worker` 实例。
4. 在 `ThreadPool::new` 中，使用 `for` 循环计数器生成 `id`，创建具有该 `id` 的新 `Worker` 实例，并将该 `Worker` 存储到 `workers` 向量中。

如果你愿意接受挑战，可以在查看清单 21-15 中的代码之前，尝试自己实现这些更改。

准备好了吗？这是清单 21-15，其中提供了进行上述修改的一种方法。

<Listing number="21-15" file-name="src/lib.rs" caption="Modifying `ThreadPool` to hold `Worker` instances instead of holding threads directly">

```rust,noplayground
{{#rustdoc_include ../listings/ch21-web-server/listing-21-15/src/lib.rs:here}}
```

</Listing>

我们将 `ThreadPool` 上字段的名称从 `threads` 更改为 `workers`，因为现在它保存的是 `Worker` 实例而不是 `JoinHandle<()>` 实例。我们在 `for` 循环中使用计数器作为 `Worker::new` 的参数，并将每个新的 `Worker` 存储到名为 `workers` 的向量中。

外部代码（如 _src/main.rs_ 中的服务器）不需要了解在 `ThreadPool` 中使用 `Worker` 结构的具体实现细节，因此我们将 `Worker` 结构及其 `new` 函数设为私有。`Worker::new` 函数使用我们提供的 `id`，并保存一个通过使用空闭包生成新线程而创建的 `JoinHandle<()>` 实例。

> 注意：如果操作系统因系统资源不足而无法创建线程，则 `thread::spawn` 会引发恐慌。这将导致整个服务器出现恐慌，尽管某些线程的创建可能成功。为了简单起见，这种行为是可以接受的，但在生产级线程池实现中，你可能会使用 [`std::thread::Builder`][builder]<!-- ignore -->及其返回的 `Result` 类型的 [`spawn`][builder-spawn]<!-- ignore -->方法。

这段代码可以编译，并将我们作为参数传递给 `ThreadPool::new` 的 `Worker` 实例数量存储起来。但我们在 `execute` 方法中得到的闭包_仍然_没有被处理。接下来我们将探讨如何实现这一点。

#### 通过通道向线程发送请求

下一个需要解决的问题是，传递给 `thread::spawn` 的闭包实际上没有任何作用。目前，我们在 `execute` 方法中得到的是我们需要执行的闭包。但在创建 `ThreadPool` 时，当创建每个 `Worker` 时，我们需要给 `thread::spawn` 一个闭包来运行。

我们希望刚刚创建的 `Worker` 结构体从 `ThreadPool` 中持有的队列中获取要运行的代码，并将该代码发送给其线程执行。

我们在第16章中学到的通道——一种在两个线程之间通信的简单方式——非常适合这种场景。我们将使用通道作为任务队列，而 `execute` 方法会将任务从 `ThreadPool` 发送到 `Worker` 实例，后者再将任务发送到其线程。具体方案如下：

1. `ThreadPool` 将创建一个通道并持有发送者。
2. 每个 `Worker` 将持有接收者。
3. 我们将创建一个新的 `Job` 结构体，用于保存我们想要通过通道发送的闭包。
4. `execute` 方法将通过发送者发送它要执行的任务。
5. 在其线程中，`Worker` 将遍历其接收者并执行接收到的任何任务的闭包。

让我们从在 `ThreadPool::new` 中创建通道并将发送者保存在 `ThreadPool` 实例中开始，如清单 21-16 所示。目前 `Job` 结构体不保存任何内容，但将来它将作为我们通过通道传递的数据类型。

<Listing number="21-16" file-name="src/lib.rs" caption="Modifying `ThreadPool` to store the sender of a channel that transmits `Job` instances">

```rust,noplayground
{{#rustdoc_include ../listings/ch21-web-server/listing-21-16/src/lib.rs:here}}
```

</Listing>

在 `ThreadPool::new` 中，我们创建了新通道，并让池管理器保存发送者。这样就能成功编译。

让我们尝试将通道的接收者传递给每个 `Worker`，因为线程池正在创建通道。我们知道希望在 `Worker` 实例创建的线程中使用接收者，因此我们将在闭包中引用 `receiver` 参数。清单 21-17 中的代码目前无法成功编译。

<Listing number="21-17" file-name="src/lib.rs" caption="Passing the receiver to each `Worker`">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch21-web-server/listing-21-17/src/lib.rs:here}}
```

</Listing>

我们做了一些简单直接的修改：将接收者传递给 `Worker::new`，然后在闭包内部使用它。

当我们尝试检查这段代码时，会得到以下错误：

```console
{{#include ../listings/ch21-web-server/listing-21-17/output.txt}}
```

代码试图将 `receiver` 传递给多个 `Worker` 实例。这是不可行的，正如我们在第 16 章中所了解的：Rust 提供的通道实现是多个 _生产者_，单个 _消费者_。这意味着我们不能简单地克隆通道的消费端来修复这段代码。我们也不希望向多个消费者发送多次消息；我们希望有一个包含多个 `Worker` 实例的消息列表，使得每个消息只被处理一次。

此外，从通道队列中移除任务涉及修改 `receiver`，因此线程需要一种安全的方式共享和修改 `receiver`；否则可能会产生竞态条件（如第 16 章所述）。

回想一下第 16 章中提到的线程安全智能指针：为了在多个线程之间共享所有权并允许线程修改值，我们需要使用 `Arc<Mutex<T>>`。`Arc` 类型允许多个 `Worker` 实例拥有接收者，`Mutex` 则确保每次只有一个 `Worker` 从接收者获取任务。清单 21-18 显示了我们需要做的更改。

<Listing number="21-18" file-name="src/lib.rs" caption="Sharing the receiver among the `Worker` instances using `Arc` and `Mutex`">

```rust,noplayground
{{#rustdoc_include ../listings/ch21-web-server/listing-21-18/src/lib.rs:here}}
```

</Listing>

在 `ThreadPool::new` 中，我们将接收者放入 `Arc` 和 `Mutex` 中。对于每个新的 `Worker`，我们克隆 `Arc` 以增加引用计数，从而使 `Worker` 实例能够共享接收者的所有权。

经过这些修改后，代码可以编译了！我们即将成功。

#### 实现 `execute` 方法

最后让我们在 `ThreadPool` 上实现 `execute` 方法。我们还将 `Job` 从结构体改为类型别名，用于表示 `execute` 接收的闭包类型。如第20章中的[“类型同义词和类型别名”][type-aliases]<!-- ignore -->部分所述，类型别名可以让我们更简洁地表达长类型。请查看列表21-19。

<Listing number="21-19" file-name="src/lib.rs" caption="Creating a `Job` type alias for a `Box` that holds each closure and then sending the job down the channel">

```rust,noplayground
{{#rustdoc_include ../listings/ch21-web-server/listing-21-19/src/lib.rs:here}}
```

</Listing>

使用 `execute` 得到的闭包创建新的 `Job` 实例后，我们将该任务发送到通道的发送端。如果发送失败，我们在 `send` 上调用 `unwrap`。例如，如果我们停止所有线程的执行，即接收端不再接收新消息，这种情况就可能发生。目前我们无法停止线程执行：只要池存在，线程就会继续执行。我们使用 `unwrap` 的原因是我们知道失败情况不会发生，但编译器并不知晓这一点。

但我们还不完全完成！在 `Worker` 中，传递给 `thread::spawn` 的闭包仍然只是引用通道的接收端。相反，我们需要让闭包无限循环，向通道的接收端请求任务并在收到任务时执行该任务。让我们对 `Worker::new` 进行列表21-20中所示的改变。

<Listing number="21-20" file-name="src/lib.rs" caption="Receiving and executing the jobs in the `Worker` instance’s thread">

```rust,noplayground
{{#rustdoc_include ../listings/ch21-web-server/listing-21-20/src/lib.rs:here}}
```

</Listing>

在这里，我们首先在 `receiver` 上调用 `lock` 来获取互斥锁，然后调用 `unwrap` 以处理任何错误并引发恐慌。如果互斥锁处于_中毒_状态，获取锁可能会失败，这种情况可能发生在其他线程在持有锁时引发恐慌而不是释放锁时。在这种情况下，调用 `unwrap` 让该线程引发恐慌是正确的做法。你可以自由地将这个 `unwrap` 改为带有有意义错误信息的 `expect`。

如果我们成功获取了互斥锁，我们调用 `recv` 从通道接收 `Job`。最后的 `unwrap` 也处理任何错误，这些错误可能发生在持有发送端的线程关闭时，类似于 `send` 方法在接收端关闭时返回 `Err` 的情况。

`recv` 调用会阻塞，因此如果还没有任务，当前线程将等待直到有任务可用。`Mutex<T>` 确保一次只有一个 `Worker` 线程尝试请求任务。

我们的线程池现在处于工作状态！运行 `cargo run` 并发送一些请求：

<!-- manual-regeneration
cd listings/ch21-web-server/listing-21-20 cargo run 向 127.0.0.1:7878 发送一些请求 无法自动化，因为输出取决于请求的发送 -->

```console
$ cargo run
   Compiling hello v0.1.0 (file:///projects/hello)
warning: field `workers` is never read
 --> src/lib.rs:7:5
  |
6 | pub struct ThreadPool {
  |            ---------- field in this struct
7 |     workers: Vec<Worker>,
  |     ^^^^^^^
  |
  = note: `#[warn(dead_code)]` on by default

warning: fields `id` and `thread` are never read
  --> src/lib.rs:48:5
   |
47 | struct Worker {
   |        ------ fields in this struct
48 |     id: usize,
   |     ^^
49 |     thread: thread::JoinHandle<()>,
   |     ^^^^^^

warning: `hello` (lib) generated 2 warnings
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 4.91s
     Running `target/debug/hello`
Worker 0 got a job; executing.
Worker 2 got a job; executing.
Worker 1 got a job; executing.
Worker 3 got a job; executing.
Worker 0 got a job; executing.
Worker 2 got a job; executing.
Worker 1 got a job; executing.
Worker 3 got a job; executing.
Worker 0 got a job; executing.
Worker 2 got a job; executing.
```

成功！我们现在有一个可以异步执行连接的线程池。创建的线程数量永远不会超过四个，因此如果服务器收到大量请求，系统也不会过载。如果我们向 _/sleep_ 发送请求，服务器可以通过另一个线程处理其他请求来继续服务现有请求。

> 注意：如果你同时在多个浏览器窗口中打开 _/sleep_，它们可能会以五秒间隔依次加载一个实例。某些网页浏览器出于缓存原因会顺序执行相同请求的多个实例。这种限制并非由我们的 Web 服务器引起。

现在是暂停并思考一下，如果我们使用未来函数而不是闭包来完成任务，列表 21-18、21-19 和 21-20 中的代码会有何不同。哪些类型会发生变化？方法签名会有所不同吗？代码的哪些部分保持不变？

在学习了第 17 章和第 19 章中的 `while let` 循环后，你可能会好奇为什么我们没有像列表 21-21 中那样编写 `Worker` 线程代码。

<Listing number="21-21" file-name="src/lib.rs" caption="An alternative implementation of `Worker::new` using `while let`">

```rust,ignore,not_desired_behavior
{{#rustdoc_include ../listings/ch21-web-server/listing-21-21/src/lib.rs:here}}
```

</Listing>

这段代码可以编译并运行，但并未产生预期的线程行为：缓慢的请求仍会导致其他请求等待处理。原因有些微妙：`Mutex` 结构体没有公开的 `unlock` 方法，因为锁的所有权取决于 `LockResult<MutexGuard<T>>` 中 `MutexGuard<T>` 的生命周期，而该结果由 `lock` 方法返回。在编译时，借用检查器可以强制遵守规则：除非持有锁，否则无法访问由 `Mutex` 保护的资源。

清单 21-20 中的代码使用 `let job = receiver.lock().unwrap().recv().unwrap();` 是有效的，因为通过 `let`，等号右侧表达式中使用的任何临时值在 `let` 语句结束时立即被丢弃。然而，`while let`（以及 `if let` 和 `match`）不会在相关块结束前丢弃临时值。在清单 21-21 中，锁在整个调用 `job()` 的过程中保持锁定状态，这意味着其他 `Worker` 实例无法接收任务。

[type-aliases]: ch20-03-advanced-types.html#type-synonyms-and-type-aliases
[integer-types]: ch03-02-data-types.html#integer-types
[moving-out-of-closures]: ch13-01-closures.html#moving-captured-values-out-of-closures
[builder]: ../std/thread/struct.Builder.html
[builder-spawn]: ../std/thread/struct.Builder.html#method.spawn
