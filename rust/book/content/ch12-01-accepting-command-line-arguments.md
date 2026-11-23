## 接受命令行参数

让我们像往常一样使用 `cargo new` 创建一个新项目。我们将项目命名为 `minigrep`，以便与您系统中可能已存在的 `grep` 工具区分开来：

```console
$ cargo new minigrep
     Created binary (application) `minigrep` project
$ cd minigrep
```

第一个任务是让 `minigrep` 能够接受其两个命令行参数：文件路径和搜索字符串。也就是说，我们希望使用 `cargo run` 运行程序，两个连字符表示这些参数是用于我们的程序而非 `cargo`，以及一个搜索字符串和一个要搜索的文件路径，如下所示：

```console
$ cargo run -- searchstring example-filename.txt
```

目前，`cargo new` 生成的程序无法处理我们提供的参数。[crates.io](https://crates.io/) 上的一些现有库可以帮助编写能够接受命令行参数的程序，但由于您刚刚开始学习这个概念，让我们自己实现这一功能。

### 读取参数值

为了让 `minigrep` 能够读取我们传递给它的命令行参数值，我们需要使用 Rust 标准库中的 `std::env::args` 函数。该函数返回一个命令行参数的迭代器，这些参数被传递给 `minigrep`。我们将在 [第13章][ch13]<!-- ignore -->中全面介绍迭代器。目前，您只需要了解关于迭代器的两个细节：迭代器生成一系列值，我们可以通过调用迭代器的 `collect` 方法将其转换为集合，例如向量，该向量包含迭代器产生的所有元素。

清单 12-1 中的代码允许您的 `minigrep` 程序读取传递给它的任何命令行参数，然后将这些参数收集到向量中。

<Listing number="12-1" file-name="src/main.rs" caption="Collecting the command line arguments into a vector and printing them">

```rust
{{#rustdoc_include ../listings/ch12-an-io-project/listing-12-01/src/main.rs}}
```

</Listing>

首先，我们通过 `use` 语句将 `std::env` 模块引入作用域，以便使用其 `args` 函数。请注意，`std::env::args` 函数嵌套在两层模块中。正如我们在 [第7章][ch7-idiomatic-use]<!-- ignore -->中所讨论的，当所需函数嵌套在多个模块中时，我们选择将父模块引入作用域而非直接调用该函数。这样，我们可以轻松使用 `std::env` 中的其他函数。这种方式也不如添加 `use std::env::args` 然后仅用 `args` 调用该函数那样模糊，因为 `args` 很容易被误认为是当前模块中定义的函数。

> ### `args` 函数与无效的 Unicode
>
> 请注意，如果任何参数包含无效的 Unicode 字符，`std::env::args` 将会崩溃。如果你的程序需要接受包含无效 Unicode 参数的情况，请使用 `std::env::args_os`。该函数返回一个迭代器，其返回值为 `OsString` 类型而非 `String` 类型。我们在这里选择使用 `std::env::args` 是为了简化代码，因为 `OsString` 值因平台而异，且比 `String` 值更复杂。

在 `main` 函数的第一行中，我们调用 `env::args`，并立即使用 `collect` 将迭代器转换为包含所有生成值的向量。我们可以利用 `collect` 函数创建多种类型的集合，因此我们明确标注了 `args` 的类型为字符串向量。虽然在 Rust 中很少需要标注类型，但 `collect` 是一个经常需要标注的函数，因为 Rust 无法自动推断所需的集合类型。

最后，我们使用 debug 宏打印该向量。我们先尝试在没有参数的情况下运行代码，然后再尝试在有两个参数的情况下运行。

```console
{{#include ../listings/ch12-an-io-project/listing-12-01/output.txt}}
```

```console
{{#include ../listings/ch12-an-io-project/output-only-01-with-args/output.txt}}
```

请注意，向量中的第一个值是 `"target/debug/minigrep"`，这是我们的二进制文件的名称。这与 C 语言中参数列表的行为一致，允许程序在执行时使用其调用时的名称。通常，能够访问程序名称非常方便，因为你可以根据使用的命令行别名来打印它或改变程序行为。但就本章的目的而言，我们将忽略这一点，只保存我们需要的两个参数。

### 将参数值保存在变量中

目前，程序能够访问作为命令行参数指定的值。现在我们需要将这两个参数的值保存到变量中，以便在整个程序中使用这些值。我们在清单 12-2 中实现了这一功能。

<Listing number="12-2" file-name="src/main.rs" caption="Creating variables to hold the query argument and file path argument">

```rust,should_panic,noplayground
{{#rustdoc_include ../listings/ch12-an-io-project/listing-12-02/src/main.rs}}
```

</Listing>

正如我们打印向量时所看到的，程序的名称占据向量中的第一个位置 `args[0]`，因此我们从索引 1 开始处理参数。第一个参数 `minigrep` 是我们要搜索的字符串，所以我们将第一个参数的引用放入变量 `query` 中。第二个参数将是文件路径，所以我们将第二个参数的引用放入变量 `file_path` 中。

我们暂时打印这些变量的值以证明代码按我们的意图工作。让我们再次运行该程序，使用参数 `test` 和 `sample.txt`：

```console
{{#include ../listings/ch12-an-io-project/listing-12-02/output.txt}}
```

很好，程序正在正常工作！我们需要的参数值被正确保存在了相应的变量中。稍后我们将添加一些错误处理机制来处理某些潜在错误情况，例如用户未提供任何参数时；目前我们忽略这种情况，转而专注于增加文件读取功能。

[ch13]: ch13-00-functional-features.html
[ch7-idiomatic-use]: ch07-04-bringing-paths-into-scope-with-the-use-keyword.html#creating-idiomatic-use-paths
