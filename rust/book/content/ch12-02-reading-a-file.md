## 读取文件

现在我们将添加功能来读取 `file_path` 参数中指定的文件。首先，我们需要一个示例文件来进行测试：我们将使用一个包含多行文本且含有重复单词的文件。列表 12-3 中的艾米莉·狄金森诗作非常适合使用！在项目的根目录下创建一个名为 _poem.txt_ 的文件，并将诗歌“I’m Nobody! Who are you?”写入其中。

<Listing number="12-3" file-name="poem.txt" caption="A poem by Emily Dickinson makes a good test case.">

```text
{{#include ../listings/ch12-an-io-project/listing-12-03/poem.txt}}
```

</Listing>

文本准备就绪后，编辑 _src/main.rs_ 文件，并添加读取文件的代码，如列表 12-4 所示。

<Listing number="12-4" file-name="src/main.rs" caption="Reading the contents of the file specified by the second argument">

```rust,should_panic,noplayground
{{#rustdoc_include ../listings/ch12-an-io-project/listing-12-04/src/main.rs:here}}
```

</Listing>

首先，我们通过 `use` 语句引入标准库中的相关模块：我们需要 `std::fs` 来处理文件操作。

在 `main` 函数中，新的 `fs::read_to_string` 语句接收 `file_path` 参数，打开该文件，并返回一个类型为 `std::io::Result<String>` 的值，其中包含文件内容。

之后，我们再次添加一个临时的 `println!` 语句，在读取文件后打印 `contents` 的值，以便检查程序目前是否正常工作。

让我们使用任何字符串作为第一个命令行参数（因为我们还未实现搜索功能），并将 _poem.txt_ 文件作为第二个参数来运行此代码：

```console
{{#rustdoc_include ../listings/ch12-an-io-project/listing-12-04/output.txt}}
```

很好！代码成功读取了文件内容并进行了打印。但代码中存在一些缺陷。目前，`main` 函数承担了多个职责：通常，如果每个函数只负责一个概念，那么函数会更清晰且更容易维护。另一个问题是我们的错误处理不够完善。由于程序规模较小，这些缺陷并不严重，但随着程序的增长，修复它们将变得更为困难。在开发程序时尽早进行重构是一个良好的习惯，因为这样更容易对少量代码进行重构。我们接下来将进行这种重构工作。
