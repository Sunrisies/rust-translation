## 未来与异步语法

Rust 中异步编程的关键元素是 _未来_ 以及 Rust 的 `async` 和 `await` 关键字。

_未来_ 是一种目前可能尚未准备好，但在未来某个时刻会准备好的值。（这一概念在许多语言中也有体现，有时被称为 _任务_ 或 _承诺_。）Rust 提供了 `Future` 特质作为构建块，使得不同的异步操作可以使用不同的数据结构实现，但具有统一的接口。在 Rust 中，未来是实现了 `Future` 特质的类型。每个未来都包含关于已进行的进度以及“准备好”含义的自身信息。

你可以将 `async` 关键字应用于代码块和函数，以指定它们可以被中断并恢复。在异步代码块或异步函数中，你可以使用 `await` 关键字 _等待一个未来_（即等待它准备好）。在异步代码块或函数中任何等待未来的地方都是该代码块或函数暂停和恢复的潜在点。通过检查未来的值是否可用的过程称为 _轮询_。

其他一些语言，如 C# 和 JavaScript，也使用 `async` 和 `await` 关键字进行异步编程。如果你熟悉这些语言，可能会注意到 Rust 处理语法的方式有一些显著差异。这是有原因的，我们将在后面看到！

在编写异步 Rust 代码时，我们大多数时间都使用 `async` 和 `await` 关键字。Rust 利用 `Future` 特质将它们编译成等效的代码，就像它利用 `Iterator` 特质将 `for` 循环编译成等效代码一样。但由于 Rust 提供了 `Future` 特质，当你需要为自己的数据类型实现它时，也可以这样做。本章中我们将看到的许多函数返回的类型都包含自己实现的 `Future`。我们在章节末尾会回到特质的定义，进一步探讨其工作原理，但目前的细节足以让我们继续前进。

这一切可能看起来有些抽象，那么让我们编写第一个异步程序：一个小型网页爬虫。我们将从命令行传入两个网址，同时获取这两个网址的内容，然后返回第一个完成后的结果。这个示例会包含很多新的语法，但不用担心——我们会边讲边解释你需要知道的一切。

## 我们的第一个异步程序

为了将本章的重点放在学习异步编程上，而不是处理生态系统中的各种组件，我们创建了 `trpl` 库（`trpl` 是 “Rust 编程语言”的缩写）。它重新导出了所有你需要的类型、特质和函数，主要来自 [`futures`][futures-crate]<!-- ignore --> 和 [`tokio`][tokio]<!-- ignore --> 库。`futures` 库是 Rust 异步代码实验的官方平台，实际上也是 `Future` 特质的起源地。`Tokio` 是当今 Rust 中最常用的异步运行时，尤其适用于 Web 应用。还有其他优秀的运行时，它们可能更适合你的需求。我们在 `trpl` 中使用了 `tokio` 库，因为它经过充分测试且被广泛使用。

在某些情况下，`trpl` 还会重命名或封装原始 API，以便你专注于与本章相关的细节。如果你想了解该库的作用，我们建议你查看 [其源代码][crate-source]。你可以看到每个被重新导出的库来自哪里，并且我们留下了大量注释来解释该库的功能。

创建一个名为 `hello-async` 的新二进制项目，并将 `trpl` 库作为依赖项添加：

```console
$ cargo new hello-async
$ cd hello-async
$ cargo add trpl
```

现在我们可以使用 `trpl` 提供的各种组件来编写我们的第一个异步程序。我们将构建一个小型命令行工具，该工具会获取两个网页，从每个网页中提取 `<title>` 元素，然后输出第一个完成整个过程的页面的标题。

### 定义 page_title 函数

让我们先编写一个函数，该函数接受一个页面 URL 作为参数，向该页面发送请求，并返回 `<title>` 元素的文本内容（参见列表 17-1）。

<Listing number="17-1" file-name="src/main.rs" caption="Defining an async function to get the title element from an HTML page">

```rust
{{#rustdoc_include ../listings/ch17-async-await/listing-17-01/src/main.rs:all}}
```

</Listing>

首先，我们定义一个名为 `page_title` 的函数，并使用 `async` 关键字标记它。然后我们使用 `trpl::get` 函数获取传入的 URL，并使用 `await` 关键字等待响应。为了获取 `response` 的文本，我们调用其 `text` 方法，再次使用 `await` 关键字等待该结果。这两个步骤都是异步的。对于 `get` 函数，我们必须等待服务器发送响应的第一部分，这部分包含 HTTP 头信息、Cookie 等，并且可以独立于响应体进行传输。特别是如果响应体非常大，可能需要一段时间才能全部加载完成。由于我们必须等待整个响应到达，因此 `text` 方法也是异步的。

我们必须显式地等待这两个未来值，因为 Rust 中的未来值是 _延迟执行的_：除非使用 `await` 关键字请求它们执行，否则不会做任何事情。（实际上，如果不使用未来值，Rust 会显示编译器警告。）这可能会让你想起第 13 章中“使用迭代器处理一系列项目”部分的关于迭代器的讨论。除非调用它们的 `next` 方法——无论是直接调用还是通过 `for` 循环或使用底层使用 `next` 的 `map` 等方法，迭代器不会做任何事情。同样，未来值也除非显式请求，否则不会执行任何操作。这种延迟特性使得 Rust 能够避免在真正需要时运行异步代码。

> 注意：这与第 16 章“使用 spawn 创建新线程”部分中使用 `thread::spawn` 时的行为不同，在那里我们传递给另一个线程的闭包会立即开始执行。这也与其他许多语言处理异步的方式不同。但对于 Rust 来说，能够提供性能保证非常重要，就像迭代器一样。

一旦我们得到了 `response_text`，就可以使用 `Html::parse` 将其解析为 `Html` 类型的实例。与原始字符串不同，现在我们有一个数据类型，可以作为一种更丰富的数据结构来处理 HTML。特别是，我们可以使用 `select_first` 方法找到给定 CSS 选择器的第一个实例。通过传递字符串 `"title"`，我们将得到文档中的第一个 `<title>` 元素（如果有的话）。由于可能不存在匹配的元素，`select_first` 会返回一个 `Option<ElementRef>`。最后，我们使用 `Option::map` 方法，这样我们就可以在元素存在时处理该元素，而在不存在时则不做任何操作。（我们也可以使用 `match` 表达式，但 `map` 更为符合 Rust 的惯用方式。）在传递给 `map` 的函数体中，我们对 `title` 调用 `inner_html` 获取其内容，这是一个 `String`。最终我们得到了一个 `Option<String>`。

请注意，Rust 中的 `await` 关键字位于等待表达式之后，而不是之前。也就是说，它是一个后缀关键字。如果你在其他语言中使用过 `async`，可能会与你的习惯不同，但在 Rust 中，这使得方法链更易于处理。因此，我们可以将 `page_title` 的函数体改为将 `trpl::get` 和 `text` 函数调用通过 `await` 连接在一起，如清单 17-2 所示。

<Listing number="17-2" file-name="src/main.rs" caption="Chaining with the `await` keyword">

```rust
{{#rustdoc_include ../listings/ch17-async-await/listing-17-02/src/main.rs:chaining}}
```

</Listing>

至此，我们成功编写了第一个异步函数！在我们在 `main` 中添加代码来调用它之前，让我们进一步讨论一下我们所写的内容及其含义。

当 Rust 看到带有 `async` 关键字的 _块_时，它会将其编译成一种独特的匿名数据类型，该类型实现了 `Future` trait。当 Rust 看到带有 `async` 关键字的 _函数_时，它会将其编译成非异步函数，其体包含一个异步块。异步函数的返回类型就是编译器为该异步块创建的匿名数据类型的类型。

因此，编写 `async fn` 相当于编写一个返回特定返回类型_未来_的函数。对于编译器来说，像列表 17-1 中的 `async fn page_title` 这样的函数定义，大致等同于这样定义的非异步函数：

```rust
# extern crate trpl; // required for mdbook test
use std::future::Future;
use trpl::Html;

fn page_title(url: &str) -> impl Future<Output = Option<String>> {
    async move {
        let text = trpl::get(url).await.text().await;
        Html::parse(&text)
            .select_first("title")
            .map(|title| title.inner_html())
    }
}
```

让我们逐一分析转换后的版本中的每个部分：

- 它使用了我们在第 10 章的[“参数作为特征”][实现-trait]<!-- ignore -->部分讨论过的 `impl Trait` 语法。
- 返回的值实现了带有关联类型 `Output` 的 `Future` 特征。请注意，`Output` 类型是 `Option<String)`，这与 `async fn` 版本的 `page_title` 的原始返回类型相同。
- 原始函数体中的所有调用代码都被包裹在一个 `async move` 块中。记住，块是表达式。整个块就是从函数中返回的表达式。
- 这个异步块产生一个类型为 `Option<String>` 的值，正如刚才描述的那样。该值与返回类型的 `Output` 类型相匹配。这与其他你见过的块类似。
- 由于使用了 `url` 参数，新函数体是一个 `async move` 块。（我们在本章后面会详细讨论 `async` 和 `async move`。）

现在我们可以在 `main` 中调用 `page_title`。

<!-- Old headings. Do not remove or links may break. -->

<a id ="determining-a-single-pages-title"></a>

### 使用运行时执行异步函数

首先，我们将获取单个页面的标题，如列表 17-3 所示。不幸的是，这段代码目前无法编译。

<Listing number="17-3" file-name="src/main.rs" caption="Calling the `page_title` function from `main` with a user-supplied argument">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch17-async-await/listing-17-03/src/main.rs:main}}
```

</Listing>

我们遵循第 12 章[“接受命令行参数”][cli-args]<!-- ignore -->部分中用于获取命令行参数的相同模式。然后我们将 URL 参数传递给 `page_title`，并等待结果。由于未来产生的值是 `Option<String>` 类型，我们使用 `match` 表达式来打印不同的消息，以处理页面是否有 `<title>` 的情况。

唯一可以使用 `await` 关键字的地方是在异步函数或块中，而 Rust 不允许我们将特殊的 `main` 函数标记为 `async`。

<!-- manual-regeneration
cd listings/ch17-异步-await/listing-17-03 cargo build copy just the compiler error -->

```text
error[E0752]: `main` function is not allowed to be `async`
 --> src/main.rs:6:1
  |
6 | async fn main() {
  | ^^^^^^^^^^^^^^^ `main` function is not allowed to be `async`
```

`main` 无法被标记为 `async` 的原因是，异步代码需要一个 _运行时_：一个管理执行异步代码细节的 Rust crate。程序的 `main` 函数可以 _初始化_ 一个运行时，但它本身并不是一个运行时。（我们稍后会看到为什么如此。）每个执行异步代码的 Rust 程序至少有一个地方设置了一个用于执行未来的运行时。

大多数支持异步的语言都会打包一个运行时，但 Rust 不会。相反，有许多不同的异步运行时可供选择，每种运行时都针对其目标应用场景做出了不同的权衡。例如，一个高吞吐量的 Web 服务器拥有许多 CPU 核心和大量 RAM，其需求与只有一个核心、少量 RAM 且无法进行堆分配的微控制器截然不同。提供这些运行时的 crate 通常还提供常见的功能如文件或网络 I/O 的异步版本。

在这里以及本章的其余部分中，我们将使用 `trpl` crate 中的 `block_on` 函数，该函数接受一个未来值作为参数，并阻塞当前线程直到该未来完成。在幕后，`block_on` 调用会设置一个使用 `tokio` crate 的运行时，用于运行传入的未来值（`trpl` crate 的 `block_on` 行为与其他运行时 crate 的 `block_on` 函数类似）。一旦未来完成，`block_on` 就会返回该未来产生的任何值。

我们可以直接将 `page_title` 返回的 Future 传递给 `block_on`，当它完成后，我们可以像在清单 17-3 中那样匹配结果中的 `Option<String>`。然而，对于本章中的大多数示例（以及现实世界中的大多数异步代码），我们将执行不止一次的异步函数调用，因此我们会传递一个 `async` 块并明确等待 `page_title` 调用的结果，如清单 17-4 所示。

<Listing number="17-4" caption="Awaiting an async block with `trpl::block_on`" file-name="src/main.rs">

<!-- should_panic,noplayground because mdbook test does not pass args -->

```rust,should_panic,noplayground
{{#rustdoc_include ../listings/ch17-async-await/listing-17-04/src/main.rs:run}}
```

</Listing>

当我们运行这段代码时，我们得到了最初预期的行为：

<!-- manual-regeneration
cd listings/ch17-异步-await/listing-17-04 cargo build # 跳过所有构建噪音 cargo run -- "https://www.rust-lang.org" # 将输出复制到此处 -->

```console
$ cargo run -- "https://www.rust-lang.org"
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.05s
     Running `target/debug/async_await 'https://www.rust-lang.org'`
The title for https://www.rust-lang.org was
            Rust Programming Language
```

呼——我们终于有了可以运行的异步代码了！但在将代码添加到同时处理两个网站之前，让我们简要回顾一下未来如何工作。

每个 _await 点——即代码中使用 `await` 关键字的每一个位置——都代表控制被交还给运行时的一次。为了实现这一点，Rust 需要跟踪异步块中涉及的状态，这样运行时就可以开始执行其他任务，然后在准备好时再次尝试推进第一个任务。这是一个看不见的状态机，就像你在每个 await 点写一个枚举来保存当前状态一样：

```rust
{{#rustdoc_include ../listings/ch17-async-await/no-listing-state-machine/src/lib.rs:enum}}
```

手动编写在每种状态之间转换的代码会非常繁琐且容易出错，尤其是在后续需要添加更多功能和状态时。幸运的是，Rust 编译器会自动创建和管理异步代码中的状态机数据结构。关于数据结构的一般借用和所有权规则仍然适用，而且编译器还会检查这些规则并提供有用的错误信息。我们在本章后面会详细讨论其中的一些内容。

最终，必须有一个东西来执行这个状态机，而那个东西就是运行时。（这就是为什么在研究运行时时可能会看到 _executor 的提及：executor 是运行时中负责执行异步代码的部分。）

现在你可以理解为什么编译器在 Listing 17-3 中阻止我们将 `main` 本身设为异步函数。如果 `main` 是一个异步函数，那么其他东西需要管理状态机，以处理未来返回的 `main`，但 `main` 是程序的起点！相反，我们在 `main` 中调用了 `trpl::block_on` 函数来设置运行时，并运行由 `async` 块返回的未来，直到其完成。

> 注意：一些运行时提供宏，让你_可以_编写异步 `main` 函数。这些宏将 `async fn main() { ... }` 重写为普通的 `fn main`，其功能与我们在 Listing 17-4 中手动做的相同：调用一个执行未来的函数直到完成，就像 `trpl::block_on` 所做的那样。

现在让我们把这些部分组合起来，看看如何编写并发代码。

<!-- Old headings. Do not remove or links may break. -->

<a id="racing-our-two-urls-against-each-other"></a>

### 同时竞争两个 URL

在清单 17-5 中，我们通过从命令行传入两个不同的 URL 来调用 `page_title`，并通过选择第一个完成的未来结果来进行竞争。

<Listing number="17-5" caption="Calling `page_title` for two URLs to see which returns first" file-name="src/main.rs">

<!-- should_panic,noplayground because mdbook does not pass args -->

```rust,should_panic,noplayground
{{#rustdoc_include ../listings/ch17-async-await/listing-17-05/src/main.rs:all}}
```

</Listing>

我们首先针对每个用户提供的 URL 调用 `page_title`。我们将得到的 future 分别保存为 `title_fut_1` 和 `title_fut_2。请记住，这些目前没有任何操作，因为 future 是延迟执行的，我们尚未等待它们完成。然后我们将这些 future 传递给 `trpl::select`，该函数会返回一个值以指示哪个 future 先完成。

> 注意：实际上，`trpl::select` 基于 `futures` crate 中定义的更通用的 `select` 函数构建。虽然 `futures` crate 的 `select` 函数可以执行许多 `trpl::select` 函数无法完成的操作，但它也包含一些额外的复杂性，我们目前可以跳过这些部分。

任何一个 future 都有可能“获胜”，因此返回 `Result` 是没有意义的。相反，`trpl::select` 返回了一个我们之前未见过的类型 `trpl::Either`。`Either` 类型与 `Result` 有些类似，因为它也有两种情况。不过与 `Result` 不同的是，`Either` 中没有成功或失败的概念，而是使用 `Left` 和 `Right` 来表示“一个或另一个”：

```rust
enum Either<A, B> {
    Left(A),
    Right(B),
}
```

如果第一个参数获胜，`select` 函数会返回该 future 的输出为 `Left`，如果第二个参数获胜则返回其输出为 `Right`。这与调用函数时参数的出现顺序一致：第一个参数在第二个参数左侧。

我们还更新了 `page_title`，使其返回传入的相同 URL。这样，即使最先返回的页面没有可解析的 `<title>`，我们仍然可以打印有意义的消息。有了这些信息后，我们最后更新 `println!` 输出，以表明哪个 URL 先完成以及该 URL 的网页 `<title>` 是什么。

你现在已经构建了一个功能正常的网页爬虫了！选择几个 URL并运行命令行工具。你可能会发现有些网站始终比其他网站运行得更快，而在其他情况下则每次运行的速度都不同。更重要的是，你已经掌握了使用 futures 的基础知识，因此现在我们可以进一步探讨如何使用 异步。


<!-- TODO: map source link version to version of Rust? -->

[impl-trait]: ch10-02-traits.html#traits-as-parameters
[iterators-lazy]: ch13-02-iterators.html
[thread-spawn]: ch16-01-threads.html#creating-a-new-thread-with-spawn
[cli-args]: ch12-01-accepting-command-line-arguments.html
[crate-source]: https://github.com/rust-lang/book/tree/main/packages/trpl
[futures-crate]: https://crates.io/crates/futures
[tokio]: https://tokio.rs
