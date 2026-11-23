<!-- Old headings. Do not remove or links may break. -->

<a id="extensible-concurrency-with-the-sync-and-send-traits"></a>
<a id="extensible-concurrency-with-the-send-and-sync-traits"></a>

## 通过 `Send` 和 `Sync` 实现可扩展的并发机制

有趣的是，本章中我们讨论过的几乎所有并发特性都来自标准库，而非语言本身。处理并发的方式不仅限于语言或标准库；你可以编写自己的并发特性，也可以使用他人编写的成果。

然而，那些嵌入在语言中而非标准库中的关键并发概念包括 `std::marker` 特质 `Send` 和 `Sync`。

<!-- Old headings. Do not remove or links may break. -->

<a id="allowing-transference-of-ownership-between-threads-with-send"></a>

### 线程间所有权传递

`Send` 标记特质表明实现了 `Send` 的类型的所有权可以在线程之间传递。几乎所有 Rust 类型都实现 `Send`，但有一些例外，包括 `Rc<T>`：该类型无法实现 `Send`，因为如果你克隆一个 `Rc<T>` 值并试图将克隆后的所有权传递给另一个线程，两个线程可能会同时更新引用计数。因此，`Rc<T>` 被设计为用于单线程场景，以避免承受线程安全性能的代价。

因此，Rust 的类型系统和特质边界确保你永远不会意外地不安全地将 `Rc<T>` 值跨线程传递。当我们在清单 16-14 中尝试这样做时，出现了错误 `` the trait `Send` is not implemented for `Rc<Mutex<i32>>` ``。当我们改用实现了 `Send` 的 `Arc<T)` 后，代码就能编译了。

任何完全由 `Send` 类型组成的类型也会自动被标记为 `Send`。除了原始指针外，几乎所有基本类型都实现 `Send`，我们将在第 20 章中讨论原始指针。

<!-- Old headings. Do not remove or links may break. -->

<a id="allowing-access-from-multiple-threads-with-sync"></a>

### 多线程访问

`Sync` 标记特质表明实现了 `Sync` 的类型可以从多个线程引用是安全的。换句话说，如果 `&T`（对 `T` 的不可变引用）实现 `Send`，那么任何类型 `T` 都实现 `Sync`，意味着该引用可以安全地传递给另一个线程。与 `Send` 类似，基本类型都实现 `Sync`，而完全由实现 `Sync` 的类型组成的类型也实现 `Sync`。

智能指针 `Rc<T>` 也不实现 `Sync`，原因与它不实现 `Send` 相同。`RefCell<T>` 类型（我们在第15章中讨论过）及其相关的 `Cell<T>` 类型系列也不实现 `Sync`。`RefCell<T>` 在运行时实现的借用检查机制并不线程安全。智能指针 `Mutex<T>` 则实现了 `Sync`，可以用于多个线程共享访问，如你在[“对 `Mutex<T>` 的共享访问”][shared-access]<!-- ignore -->中看到的那样。

### 手动实现 `Send` 和 `Sync` 是不安全的

因为完全由实现 `Send` 和 `Sync` 特征的其他类型组成的类型也自动实现了 `Send` 和 `Sync`，所以我们不必手动实现这些特征。作为标记特征，它们甚至没有任何需要实现的方法，只是用于强制执行与并发相关的不变量。

手动实现这些特征涉及编写不安全的 Rust 代码。我们将在第20章讨论如何使用不安全的 Rust 代码；目前重要的是，构建由 `Send` 和 `Sync` 部分组成的新的并发类型需要仔细考虑以维护安全性保证。[“The Rustonomicon”][nomicon] 提供了更多关于这些保证以及如何维护它们的信息。

## 总结

这还不是你在这本书中看到的关于并发的最后内容：下一章将重点讨论异步编程，而第21章中的项目将在比这里讨论的小例子更真实的场景中应用本章的概念。

如前所述，由于 Rust 处理并发的方式很少属于语言本身，许多并发解决方案被作为库包实现。这些库包的更新速度比标准库更快，因此确保在多线程场景中使用最新的先进库包是非常重要的。

Rust 标准库提供了用于消息传递的通道以及诸如 `Mutex<T>` 和 `Arc<T>` 这样的智能指针类型，这些在并发环境中使用是安全的。类型系统和借用检查器确保使用这些解决方案的代码不会出现数据竞争或无效引用问题。一旦你的代码能够编译，你可以放心地相信它能够在多个线程上正常运行，而不会出现其他语言中常见的难以排查的错误。并发编程不再是一个需要害怕的概念：大胆地让你的程序进行并发操作吧！

[shared-access]: ch16-03-shared-state.html#shared-access-to-mutext
[nomicon]: ../nomicon/index.html
