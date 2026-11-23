# 最终项目：构建多线程 Web 服务器

这是一段漫长的旅程，但我们已经到达了书的终点。在本章中，我们将共同完成另一个项目，以演示我们在最后几章中学习的一些概念，并回顾一些之前的课程。

对于我们的最终项目，我们将构建一个在网页浏览器中显示“Hello!”的 Web 服务器，其外观如图 21-1 所示。

以下是我们构建 Web 服务器的计划：

1. 学习一些关于 TCP 和 HTTP 的知识。
2. 在 socket 上监听 TCP 连接。
3. 解析少量 HTTP 请求。
4. 生成正确的 HTTP 响应。
5. 通过线程池提高服务器的吞吐量。

<img alt="Screenshot of a web browser visiting the address 127.0.0.1:8080 displaying a webpage with the text content “Hello! Hi from Rust”" src="img/trpl21-01.png" class="center" style="width: 50%;" />

<span class="caption">Figure 21-1: Our final shared project</span>

在开始之前，我们应该提及两个细节。首先，我们将使用的方法并不是用 Rust 构建 Web 服务器的最佳方式。社区成员在 [crates.io](https://crates.io/) 上发布了许多可在生产环境中使用的 crates，它们提供了比我们将要构建的更完整的 Web 服务器和线程池实现。然而，本章的目的是帮助你学习，而不是走捷径。由于 Rust 是一种系统编程语言，我们可以选择所需的抽象级别，并达到其他语言无法实现的更低层次。

其次，这里不会使用 异步 和 await。构建线程池本身就是一个巨大的挑战，更不用说还要构建异步运行时了！不过，我们会说明 异步 和 await 如何可能适用于本章中遇到的某些问题。最终，正如我们在第 17 章中提到的，许多异步运行时使用线程池来管理其工作。

因此，我们将手动编写基本的 HTTP 服务器和线程池，以便你能够了解未来可能会使用的 crates背后的通用概念和技术。
