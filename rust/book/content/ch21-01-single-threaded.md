## 构建单线程 Web 服务器

我们将从让单线程 Web 服务器运行开始。在动手之前，我们先简要了解构建 Web 服务器所涉及的协议。这些协议的细节超出了本书的范围，但简单的概述能为你提供所需信息。

Web 服务器涉及的两个主要协议是 _超文本传输协议_ (HTTP) 和 _传输控制协议_ (TCP)。这两种协议都是 _请求-响应_ 协议，意味着 _客户端_ 发起请求，而 _服务器_ 监听这些请求并向客户端提供响应。请求和响应的内容由这些协议定义。

TCP 是较低级别的协议，它描述了信息如何在服务器之间传递的细节，但不指定具体是什么信息。HTTP 基于 TCP 工作，通过定义请求和响应的内容来实现。从技术上讲，可以使用 HTTP 与其他协议结合使用，但在绝大多数情况下，HTTP 通过 TCP 传输数据。我们将处理 TCP 和 HTTP 请求的原始字节。

### 监听 TCP 连接

我们的 Web 服务器需要监听 TCP 连接，这是我们首先要处理的部分。标准库提供了 `std::net` 模块来实现这一点。让我们以常规方式创建一个新项目：

```console
$ cargo new hello
     Created binary (application) `hello` project
$ cd hello
```

现在在 _src/main.rs_ 中插入清单 21-1 中的代码以开始运行。此代码将在本地地址 `127.0.0.1:7878` 上监听传入的 TCP 流。当收到传入流时，它将打印 `Connection established!`。

<Listing number="21-1" file-name="src/main.rs" caption="Listening for incoming streams and printing a message when we receive a stream">

```rust,no_run
{{#rustdoc_include ../listings/ch21-web-server/listing-21-01/src/main.rs}}
```

</Listing>

使用 `TcpListener`，我们可以在地址 `127.0.0.1:7878` 处监听 TCP 连接。在地址中，冒号前的部分是一个 IP 地址，代表你的计算机（每台计算机都是如此，并不特指作者使用的计算机），而 `7878` 是端口号。我们选择这个端口有两个原因：通常 HTTP 不会在这个端口上接收数据，因此我们的服务器不太可能与你在机器上运行的任何其他 Web 服务器冲突；此外，7878 在电话上被定义为 _rust_ 类型。

在这种情况下，`bind` 函数的工作原理与 `new` 函数类似，它会返回一个新的 `TcpListener` 实例。该函数被称为 `bind`，因为在网络技术中，连接到端口以进行监听被称为“绑定到端口”。

`bind` 函数返回 `Result<T, E)`，这表明绑定过程可能会失败，例如，如果我们运行了两个程序实例，导致两个程序同时监听同一个端口。由于我们编写这个基本服务器只是为了学习目的，因此不会担心处理这类错误；相反，如果发生错误，我们使用 `unwrap` 来终止程序。

`TcpListener` 的 `incoming` 方法返回一个迭代器，该迭代器提供一系列流（更具体地说，是 `TcpStream` 类型的流）。一个 _流_ 代表客户端与服务器之间的开放连接。_连接_ 指的是完整的请求和响应过程：客户端连接到服务器，服务器生成响应，然后关闭连接。因此，我们会从 `TcpStream` 中读取客户端发送的数据，然后将我们的响应写入该流以返回给客户端。总体而言，这个 `for` 循环会依次处理每个连接，并生成一系列流供我们处理。

目前，我们对流的处理包括调用 `unwrap` 来终止程序，如果流存在任何错误；如果没有错误，程序会打印一条消息。在下一个示例中，我们将为成功情况添加更多功能。当客户端连接到服务器时，`incoming` 方法可能会收到错误，原因是我们实际上并没有遍历连接，而是遍历了_连接尝试_。连接可能由于多种操作系统特定的原因而失败。例如，许多操作系统对同时支持的开放连接数量有限；超过该数量的新的连接尝试会产生错误，直到部分开放连接被关闭为止。

让我们尝试运行这段代码！在终端中执行 `cargo run`，然后在网页浏览器中加载 _127.0.0.1:7878_。由于服务器当前没有返回任何数据，浏览器会显示类似“连接被重置”的错误信息。但当你查看终端时，你会看到浏览器与服务器建立连接时打印出的多条消息！

```text
     Running `target/debug/hello`
Connection established!
Connection established!
Connection established!
```

有时你会看到针对同一个浏览器请求打印出多条消息；原因可能是浏览器不仅请求页面，还同时请求其他资源，例如出现在浏览器标签页中的 _favicon.ico_ 图标。

也可能是因为服务器没有返回任何数据，浏览器多次尝试连接。当 `stream` 超出作用域并在循环结束时被丢弃时，连接作为 `drop` 实现的一部分被关闭。有时浏览器会重试已关闭的连接，因为问题可能是暂时的。

有时浏览器也会在不发送任何请求的情况下向服务器打开多个连接，这样如果之后确实发送了请求，这些请求就能更快地完成。当这种情况发生时，我们的服务器会看到每个连接，无论该连接是否有任何请求。许多基于 Chrome 的浏览器都这样做；你可以通过使用隐私浏览模式或不同的浏览器来禁用这种优化。

重要的因素是我们已经成功获得了 TCP 连接的句柄！

记得在运行特定版本的代码后，按 <kbd>ctrl</kbd>-<kbd>c</kbd> 停止程序。然后，在完成所有代码更改后，执行 `cargo run` 命令重新启动程序，以确保运行的是最新代码。

### 读取请求

让我们实现从浏览器读取请求的功能！为了将建立连接和利用连接执行操作的责任分开，我们将创建一个新的函数来处理连接。在这个新的 `handle_connection` 函数中，我们会从 TCP 流中读取数据并打印出来，以便能够看到从浏览器发送的数据。请将代码修改为类似清单 21-2 的样子。

<Listing number="21-2" file-name="src/main.rs" caption="Reading from the `TcpStream` and printing the data">

```rust,no_run
{{#rustdoc_include ../listings/ch21-web-server/listing-21-02/src/main.rs}}
```

</Listing>

我们引入 `std::io::BufReader` 和 `std::io::prelude`，以便访问允许我们从流中读取和写入的特质和类型。在 `main` 函数中的 `for` 循环中，我们不再打印表示已建立连接的消息，而是调用新的 `handle_connection` 函数并将 `stream` 作为参数传递。

在 `handle_connection` 函数中，我们创建了一个新的 `BufReader` 实例，该实例封装了对 `stream` 的引用。`BufReader` 通过管理 `std::io::Read` trait 方法的调用来实现缓冲功能。

我们创建一个名为 `http_request` 的变量来收集浏览器发送给我们的服务器的请求行。我们通过添加 `Vec<_>` 类型注释来表示希望将这些行收集到向量中。

`BufReader` 实现了 `std::io::BufRead` trait，该Trait 提供了 `lines` 方法。当 `lines` 方法遇到换行符时，它会分割数据流并返回一个 `Result<String, std::io::Error>` 的迭代器。为了获取每个 `String`，我们需要使用 `map` 和 `unwrap` 来处理每个 `Result`。如果数据不是有效的 UTF-8 格式或从流中读取时出现问题，则 `Result` 可能表示错误。当然，生产级程序应该更优雅地处理这些错误，但出于简单起见，我们选择在错误情况下停止程序。

浏览器通过连续发送两个换行符来指示 HTTP 请求结束，因此要从流中获取一个请求，我们需要收集所有行，直到遇到空字符串为止。一旦将行收集到向量中，我们就使用清晰的调试格式将其打印出来，以便能够查看网络浏览器发送给我们的服务器的指令。

让我们尝试这段代码！启动程序，然后在网页浏览器中再次发起请求。请注意，在浏览器中仍然会显示错误页面，但我们的程序在终端中的输出现在看起来类似如下：

<!-- manual-regeneration
cd listings/ch21-web-server/listing-21-02 cargo run 向 127.0.0.1:7878 发送请求 无法自动化，因为输出取决于请求操作 -->

```console
$ cargo run
   Compiling hello v0.1.0 (file:///projects/hello)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.42s
     Running `target/debug/hello`
Request: [
    "GET / HTTP/1.1",
    "Host: 127.0.0.1:7878",
    "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:99.0) Gecko/20100101 Firefox/99.0",
    "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language: en-US,en;q=0.5",
    "Accept-Encoding: gzip, deflate, br",
    "DNT: 1",
    "Connection: keep-alive",
    "Upgrade-Insecure-Requests: 1",
    "Sec-Fetch-Dest: document",
    "Sec-Fetch-Mode: navigate",
    "Sec-Fetch-Site: none",
    "Sec-Fetch-User: ?1",
    "Cache-Control: max-age=0",
]
```

根据您使用的浏览器不同，可能会得到略有不同的输出。现在我们正在打印请求数据，通过查看请求第一行中 `GET` 之后的路径，就可以理解为什么一个浏览器请求会产生多个连接了。如果重复的连接都请求 _/_，那么说明浏览器试图反复获取 _/_，因为它没有从程序中获得响应。

让我们分析一下这些请求数据，以了解浏览器对程序的要求是什么。

<!-- Old headings. Do not remove or links may break. -->

<a id="a-closer-look-at-an-http-request"></a>
<a id="looking-closer-at-an-http-request"></a>

### 更仔细地观察 HTTP 请求

HTTP 是一种基于文本的协议，请求采用以下格式：

```text
Method Request-URI HTTP-Version CRLF
headers CRLF
message-body
```

第一行是 _请求行_，其中包含客户端所请求的信息。请求行的第一部分指示所使用的操作方式，如 `GET` 或 `POST`，这描述了客户端如何发起该请求。我们的客户端使用了 `GET` 请求，这意味着它正在获取信息。

请求行的下一部分是 _/_，表示客户端请求的 _统一资源标识符_ (URI)：URI 几乎与 _统一资源定位器_ (URL) 相同，但不完全一样。在本章中，URI 和 URL 之间的区别并不重要，但 HTTP 规范使用 _URI_ 这一术语，因此我们可以在这里将 _URI_ 视为 _URL_。

最后一部分是客户端使用的 HTTP 版本，然后请求行以 CRLF 序列结束。_CRLF_ 代表 _回车符_ 和 _换行符_，这些术语源自打字机时代！CRLF 序列也可以写作 `\r\n`，其中 `\r` 是回车符，`\n` 是换行符。_CRLF 序列_ 将请求行与请求数据其余部分分开。请注意，当打印 CRLF 时，我们看到的是新的一行开始，而不是 `\r\n`。

查看我们运行程序至今所收到的请求行数据，我们发现 `GET` 是方法，`_/_` 是请求 URI，`HTTP/1.1` 是版本。

在请求行之后，从 `Host:` 开始的其余行都是头部信息。`GET` 请求没有主体内容。

尝试使用不同的浏览器或请求不同的地址，例如 _127.0.0.1:7878/test_，以观察请求数据如何变化。

现在我们知道了浏览器请求的内容，让我们发送一些响应数据吧！

### 编写响应

我们将实现针对客户端请求发送响应的功能。响应具有以下格式：

```text
HTTP-Version Status-Code Reason-Phrase CRLF
headers CRLF
message-body
```

第一行是 _状态行_，包含响应中使用的 HTTP 版本、总结请求结果的数字状态码以及提供状态码文本描述的理由短语。CRLF 序列之后是任何头部信息、另一个 CRLF 序列和响应主体。

以下是一个使用 HTTP 1.1 版本、状态码为 200、理由短语为 OK、没有头部信息也没有主体的示例响应：

```text
HTTP/1.1 200 OK\r\n\r\n
```

状态码 200 是标准的成功响应。文本只是一个简单的成功 HTTP 响应。让我们将其写入流中，作为对成功请求的响应！从 `handle_connection` 函数中移除打印请求数据的 `println!`，并用列表 21-3 中的代码替换它。

<Listing number="21-3" file-name="src/main.rs" caption="Writing a tiny successful HTTP response to the stream">

```rust,no_run
{{#rustdoc_include ../listings/ch21-web-server/listing-21-03/src/main.rs:here}}
```

</Listing>

第一段新行定义了 `response` 变量，用于保存成功消息的数据。然后，我们调用 `as_bytes` 方法将字符串数据转换为字节。`stream` 的 `write_all` 方法接受一个 `&[u8]` 参数，并将这些字节直接通过连接发送出去。由于 `write_all` 操作可能会失败，我们像之前一样对任何错误结果使用 `unwrap`。再次强调，在实际应用程序中，你应该在此处添加错误处理。

经过这些修改后，让我们运行代码并发起请求。此时不再向终端输出数据，因此除了 Cargo 的输出外不会看到其他内容。当你在浏览器中加载 _127.0.0.1:7878_ 时，你应该会看到一个空白页面而不是错误信息。你刚刚手动实现了接收 HTTP 请求并发送响应的过程！

### 返回真实的 HTML

让我们实现返回非空白页面的功能。在项目的根目录中创建新文件 _hello.html_，不要放在 _src_ 目录中。你可以输入任何想要的 HTML；列表 21-4 展示了一种可能的实现方式。

<Listing number="21-4" file-name="hello.html" caption="A sample HTML file to return in a response">

```html
{{#include ../listings/ch21-web-server/listing-21-05/hello.html}}
```

</Listing>

这是一个包含标题和一些文本的极简 HTML5 文档。当收到请求时，为了从服务器返回这个页面，我们将像列表 21-5 所示修改 `handle_connection` 函数，读取 HTML 文件，将其作为响应体发送出去。

<Listing number="21-5" file-name="src/main.rs" caption="Sending the contents of *hello.html* as the body of the response">

```rust,no_run
{{#rustdoc_include ../listings/ch21-web-server/listing-21-05/src/main.rs:here}}
```

</Listing>

我们在 `use` 语句中添加了 `fs`，从而将标准库的文件系统模块引入作用域。将文件内容读入字符串的代码应该很熟悉；在列表 12-4 中处理 I/O 项目时，我们就使用了这一功能来读取文件内容。

接下来，我们使用 `format!` 将文件内容作为成功响应的体部分别添加。为了确保得到有效的 HTTP 响应，我们添加了 `Content-Length` 头部，其值设为响应体的大小——在本例中即为 `hello.html` 的大小。

使用 `cargo run` 运行此代码，然后在浏览器中加载 _127.0.0.1:7878_，你应该会看到你的 HTML 被渲染出来！

目前，我们忽略 `http_request` 中的请求数据，直接无条件返回 HTML 文件的内容。这意味着如果您在浏览器中尝试请求 _127.0.0.1:7878/something-else_，您仍然会收到相同的 HTML 响应。目前，我们的服务器功能非常有限，无法实现大多数 Web 服务器的功能。我们希望根据请求内容自定义响应，并且仅对格式正确的请求返回 HTML 文件。

### 验证请求并选择性响应

目前，无论客户端请求什么，我们的 Web 服务器都会返回文件中的 HTML 内容。让我们添加功能来检查浏览器是否确实请求了 _/_，并在浏览器请求其他内容时返回错误。为此，我们需要修改 `handle_connection` 函数，如清单 21-6 所示。新代码会将接收到的请求内容与我们知道 _/_ 请求的格式进行比较，并添加 `if` 和 `else` 块以区分不同的请求。

<Listing number="21-6" file-name="src/main.rs" caption="Handling requests to */* differently from other requests">

```rust,no_run
{{#rustdoc_include ../listings/ch21-web-server/listing-21-06/src/main.rs:here}}
```

</Listing>

我们只会检查 HTTP 请求的第一行，因此不会将整个请求读入向量中，而是调用 `next` 从迭代器中获取第一个项。第一个 `unwrap` 处理 `Option`，如果迭代器没有项则停止程序。第二个 `unwrap` 处理 `Result`，其效果与清单 21-2 中 `map` 中的 `unwrap` 相同。

接下来，我们检查 `request_line` 是否等于对 _/_ 路径的 GET 请求行。如果是，则 `if` 块返回我们的 HTML 文件内容。

如果 `request_line` 不等于对 _/_ 路径的 GET 请求行，则表示我们收到了其他类型的请求。稍后我们将在 `else` 块中添加代码以响应所有其他请求。

现在运行此代码并请求 _127.0.0.1:7878_，您应该会得到 _hello.html_ 中的 HTML 内容。如果您发起其他请求，例如 _127.0.0.1:7878/something-else_，您将收到连接错误，类似于在清单 21-1 和清单 21-2 中运行代码时看到的错误。

现在我们将清单 21-7 中的代码添加到 `else` 块中，以返回状态码为 404 的响应，表示请求的内容未找到。我们还将返回一些 HTML 内容，以便在浏览器中渲染，向最终用户指示响应情况。

<Listing number="21-7" file-name="src/main.rs" caption="Responding with status code 404 and an error page if anything other than */* was requested">

```rust,no_run
{{#rustdoc_include ../listings/ch21-web-server/listing-21-07/src/main.rs:here}}
```

</Listing>

在这里，我们的响应包含带有状态码 404 和原因短语“NOT FOUND”的状态行。响应的主体将是 _404.html_ 文件中的 HTML 内容。你需要创建一个位于 _hello.html_ 旁边的 _404.html_ 文件作为错误页面；你可以自由使用任何 HTML 代码，或者直接使用清单 21-8 中的示例 HTML。

<Listing number="21-8" file-name="404.html" caption="Sample content for the page to send back with any 404 response">

```html
{{#include ../listings/ch21-web-server/listing-21-07/404.html}}
```

</Listing>

进行这些修改后，再次运行服务器。请求 _127.0.0.1:7878_ 应返回 _hello.html_ 的内容，而任何其他请求，如 _127.0.0.1:7878/foo_，则应返回 _404.html_ 中的错误 HTML。

<!-- Old headings. Do not remove or links may break. -->

<a id="a-touch-of-refactoring"></a>

### 重构

目前，`if` 和 `else` 块存在大量重复代码：它们都读取文件并将文件内容写入流中。唯一的区别是状态行和文件名。我们可以通过将这些差异提取到单独的 `if` 和 `else` 语句中，并将状态行和文件名的值赋给变量来使代码更简洁；然后我们可以在代码中无条件使用这些变量来读取文件和写入响应。清单 21-9 展示了替换大型 `if` 和 `else` 块后的结果代码。

<Listing number="21-9" file-name="src/main.rs" caption="Refactoring the `if` and `else` blocks to contain only the code that differs between the two cases">

```rust,no_run
{{#rustdoc_include ../listings/ch21-web-server/listing-21-09/src/main.rs:here}}
```

</Listing>

现在，`if` 和 `else` 块仅以元组形式返回状态行和文件名的适当值；我们使用解构赋值在 `let` 语句中使用模式将这两个值分别赋给 `status_line` 和 `filename`，正如第 19 章所讨论的。

之前重复的代码现在位于 `if` 和 `else` 块之外，并使用 `status_line` 和 `filename` 变量。这使得两种情况之间的区别更清晰，也意味着如果我们想改变文件读取和响应写入的方式，只需在一个地方更新代码即可。清单 21-9 中的代码行为与清单 21-7 中的相同。

太棒了！现在我们有一个简单的Web服务器，仅用大约40行Rust代码就实现了功能：对单个请求响应内容页面，并对所有其他请求返回404错误响应。

目前，我们的服务器运行在单线程中，这意味着一次只能处理一个请求。让我们通过模拟一些慢速请求来观察这可能会带来什么问题。然后，我们将修复它，使服务器能够同时处理多个请求。
