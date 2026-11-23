# 异步编程基础：异步、Await、Futures 和 Streams

许多我们要求计算机执行的操作可能需要一段时间才能完成。如果我们在等待这些长时间运行的进程完成时能够做其他事情，那就太好了。现代计算机提供了两种同时处理多个操作的技巧：并行性和并发性。然而，我们的程序逻辑大多是以线性方式编写的。我们希望能够指定程序应执行的操作以及函数可以暂停的节点，然后让程序的其他部分可以运行，而不需要事先明确每个代码段的具体执行顺序和方式。_异步编程_是一种抽象机制，它让我们可以用潜在的暂停点和最终结果来表达代码，从而自动处理协调细节。

本章基于第16章使用线程进行并行性和并发性处理的内容，介绍了一种编写代码的替代方法：Rust 的 futures、streams，以及 `async` 和 `await` 语法，这些语法让我们能够表达操作如何异步执行；还有实现异步运行时的第三方 crate，即管理和协调异步操作执行的代码。

让我们考虑一个例子。假设你要导出一个家庭庆祝活动的视频，这个操作可能需要几分钟到几小时的时间。视频导出会尽可能使用大量的 CPU 和 GPU 资源。如果你只有 하나的 CPU 核心，并且操作系统不会在导出完成前暂停该导出——也就是说，如果它同步执行导出——那么在任务运行时你就无法在电脑上做其他事情了。这将是一个非常令人沮丧的经历。幸运的是，你的计算机操作系统能够并且确实会频繁地隐秘中断导出过程，以便你同时处理其他工作。

现在假设你在下载他人分享的视频，这同样需要一些时间，但占用的CPU资源较少。在这种情况下，CPU必须等待网络传来的数据。虽然一旦数据开始传输就可以开始读取，但所有数据完全显示出来可能需要一段时间。即使数据已经全部到达，如果视频体积较大，加载整个视频至少也需要一两秒。听起来可能不多，但对于现代处理器来说却是非常长的时间，因为现代处理器每秒可以执行数十亿次操作。再次说明，你的操作系统会隐秘地中断程序，以便CPU在等待网络调用完成时执行其他工作。

视频导出就是一个_受CPU限制_或_计算限制_的操作示例。它受到计算机在CPU或GPU中的数据处理能力以及能够分配给该操作的性能的限制。而视频下载则是一个_I/O限制_的操作示例，因为它受到计算机_输入和输出_速度的限制；其处理速度只能达到数据通过网络传输的速度。

在这两个示例中，操作系统的隐秘中断提供了一种并发形式。不过这种并发仅发生在整个程序的层面：操作系统会中断一个程序，让其他程序能够执行工作。在许多情况下，由于我们对程序的理解比操作系统更细致，因此我们可以发现操作系统无法看到的并发机会。

例如，如果我们正在构建一种管理文件下载的工具，我们应该编写程序使得开始一次下载不会锁定用户界面，并且用户可以同时开始多次下载。然而，许多用于与网络交互的操作系统API是_阻塞的_；也就是说，它们会阻止程序的执行，直到所处理的数据完全准备好为止。

> 注意：如果你仔细思考，这就是_大多数_函数调用的工作方式。然而，“阻塞”这一术语通常用于描述与文件、网络或计算机上的其他资源交互的函数调用，因为在这些情况下，非阻塞操作对单个程序更有利。

我们可以通过创建专门的线程来下载每个文件，从而避免阻塞主线程。但是，这些线程使用的系统资源开销最终会成为一个问题。更理想的情况是，调用本身不阻塞，而是定义一系列任务，让运行时选择最佳的执行顺序和方式来完成这些任务。

这正是 Rust 的 _async_（异步）抽象机制所提供的功能。在本章中，你将学习关于 异步 的所有内容，我们将涵盖以下主题：

- 如何使用 Rust 的 `async` 和 `await` 语法，并通过运行时执行异步函数 - 如何利用 异步 模型解决我们在第 16 章中讨论的一些挑战 - 多线程和 异步 如何提供互补的解决方案，在许多情况下可以结合使用

不过，在了解 异步 的实际工作原理之前，我们需要简要探讨一下并行与并发之间的区别。

## 并行与并发

到目前为止，我们认为并行和并发基本上是可互换的。但现在我们需要更精确地区分它们，因为随着工作展开，这些差异将会显现出来。

考虑一个团队在软件项目中分配工作的不同方式。你可以让一名成员承担多个任务，让每个成员负责一项任务，或者混合使用这两种方法。

当一个人同时处理多个不同的任务且其中任何一个尚未完成时，这就是_并发_。实现并发的一种方式类似于在电脑上同时运行两个不同的项目，当你对其中一个项目感到无聊或陷入困境时，就会切换到另一个项目。由于你只是一个人，无法同时在两个任务上取得进展，但你可以进行多任务处理，通过在不同任务之间切换来逐步完成一个任务（参见图 17-1）。

<figure>

<img src="img/trpl17-01.svg" class="center" alt="A diagram with stacked boxes labeled Task A and Task B, with diamonds in them representing subtasks. Arrows point from A1 to B1, B1 to A2, A2 to B2, B2 to A3, A3 to A4, and A4 to B3. The arrows between the subtasks cross the boxes between Task A and Task B." />

<figcaption>Figure 17-1: A concurrent workflow, switching between Task A and Task B</figcaption>

</figure>

当团队将一组任务分配给每个成员单独处理时，这就是_并行_。团队中的每个人都可以同时取得进展（参见图 17-2）。

<figure>

<img src="img/trpl17-02.svg" class="center" alt="A diagram with stacked boxes labeled Task A and Task B, with diamonds in them representing subtasks. Arrows point from A1 to A2, A2 to A3, A3 to A4, B1 to B2, and B2 to B3. No arrows cross between the boxes for Task A and Task B." />

<figcaption>Figure 17-2: A parallel workflow, where work happens on Task A and Task B independently</figcaption>

</figure>

在这两种工作模式中，你可能需要协调不同的任务。也许你认为某个任务完全独立于其他人的工作，但实际上需要团队中的另一个人先完成他们的任务。部分工作可以并行进行，但有些工作实际上是_串行_的：它们必须按顺序依次进行，一个接一个，如图 17-3 所示。

<figure>

<img src="img/trpl17-03.svg" class="center" alt="A diagram with stacked boxes labeled Task A and Task B, with diamonds in them representing subtasks. In Task A, arrows point from A1 to A2, from A2 to a pair of thick vertical lines like a “pause” symbol, and from that symbol to A3. In task B, arrows point from B1 to B2, from B2 to B3, from B3 to A3, and from B3 to B4." />

<figcaption>Figure 17-3: A partially parallel workflow, where work happens on Task A and Task B independently until Task A3 is blocked on the results of Task B3.</figcaption>

</figure>

同样，你可能会发现自己的一个任务依赖于另一个任务。此时，你的并发工作也变成了串行工作。

并行和并发也可以相互交织。如果你得知同事因为你的某个任务未完成而陷入困境，你可能会集中所有精力在那个任务上以“解除”同事的阻碍。你和同事无法再并行工作，你也无法同时处理自己的任务了。

软件与硬件之间也遵循相同的基本工作原理。在仅有一个 CPU 核心的机器上，CPU 一次只能执行一个操作，但仍可以并行运行。通过使用线程、进程和异步等工具，计算机可以在暂停一项任务并切换至其他任务后，最终再次回到最初的任务。在具有多个 CPU 核心的机器上，则能够并行处理工作。一个核心可以执行某项任务，而另一个核心则可以执行完全不相关的任务，这些操作实际上同时发生。

在 Rust 中运行异步代码通常是以并发方式进行的。根据硬件、操作系统以及我们使用的异步运行时（关于异步运行时将在后面讨论），这种并发机制在底层也可能采用并行处理的方式。

现在，让我们深入了解一下 Rust 中的异步编程究竟是如何工作的。
