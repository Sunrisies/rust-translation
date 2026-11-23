<!-- Old headings. Do not remove or links may break. -->

<a id="writing-error-messages-to-standard-error-instead-of-standard-output"></a>

## 将错误重定向到标准错误

目前，我们所有的输出都通过 `println!` 宏写入终端。在大多数终端中，有两种输出方式：用于一般信息的_标准输出_（`stdout`）和用于错误信息的_标准错误_（`stderr`）。这种区分使得用户可以选择将程序的成功输出保存到文件中，同时仍然在屏幕上显示错误信息。

`println!` 宏只能向标准输出打印内容，因此我们必须使用其他方式将内容写入标准错误。

### 检查错误被写入的位置

首先，让我们观察 `minigrep` 输出的内容当前是如何被写入标准输出的，包括我们希望写入标准错误的任何错误信息。我们将通过将标准输出流重定向到文件并故意引发错误来实现这一点。我们不会重定向标准错误流，因此发送到标准错误的所有内容仍会在屏幕上显示。

命令行程序预期会将错误信息发送到标准错误流，这样即使我们将标准输出流重定向到文件，我们仍然可以在屏幕上看到错误信息。我们的程序目前表现不佳：我们将看到它实际上将错误信息保存到文件中！

为了演示这种行为，我们将使用 `>` 和我们希望将标准输出流重定向到的文件路径 `_output.txt` 来运行该程序。我们不会传递任何参数，这应该会导致错误：

```console
$ cargo run > output.txt
```

`>` 语法告诉shell将标准输出的内容写入 _output.txt_ 而不是屏幕。我们没有看到预期在屏幕上显示的错误信息，这意味着它一定被写到了文件中。这就是 _output.txt_ 中的内容：

```text
Problem parsing arguments: not enough arguments
```

是的，我们的错误信息正在被写入标准输出。对于像这样的错误信息来说，将其写入标准错误更为有用，这样只有成功运行的数据才会被保存到文件中。我们将对此进行更改。

### 将错误写入标准错误

我们将使用清单 12-24 中的代码来更改错误信息的显示方式。由于本章前面进行的重构，所有打印错误信息的代码都集中在一个名为 `main` 的函数中。标准库提供了 `eprintln!` 宏，用于向标准错误流输出信息，因此我们将调用 `println!` 的两个地方改为使用 `eprintln!`。

<Listing number="12-24" file-name="src/main.rs" caption="Writing error messages to standard error instead of standard output using `eprintln!`">

```rust,ignore
{{#rustdoc_include ../listings/ch12-an-io-project/listing-12-24/src/main.rs:here}}
```

</Listing>

现在，让我们以相同的方式再次运行程序，不提供任何参数，并通过 `>` 将标准输出重定向到文件：

```console
$ cargo run > output.txt
Problem parsing arguments: not enough arguments
```

现在我们在屏幕上看到错误，而 _output.txt_ 中没有任何内容，这正是我们预期命令行程序的行为。

让我们再次运行程序，并提供一些不会引发错误的参数，同时将标准输出重定向到文件中，如下所示：

```console
$ cargo run -- to poem.txt > output.txt
```

我们将看不到终端有任何输出，而 _output.txt_ 将包含我们的结果：

<span class="filename">Filename: output.txt</span>

```text
Are you nobody, too?
How dreary to be somebody!
```

这表明我们现在正确地使用标准输出用于成功信息，使用标准错误用于错误信息。

## 总结

本章回顾了你迄今为止学到的一些主要概念，并介绍了如何在 Rust 中执行常见的 I/O 操作。通过使用命令行参数、文件、环境变量以及 `eprintln!` 宏来打印错误信息，你现在可以准备编写命令行应用程序了。结合前几章中的概念，你的代码将具有良好的组织性，数据将在适当的数据结构中有效存储，错误处理得当，并且经过充分测试。

接下来，我们将探讨一些受函数式语言影响的 Rust 特性：闭包和迭代器。
