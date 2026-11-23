<!-- Old headings. Do not remove or links may break. -->
<a id="developing-the-librarys-functionality-with-test-driven-development"></a>

## 通过测试驱动开发添加功能

现在，我们将搜索逻辑独立地放在 _src/lib.rs_ 中，与 `main` 函数分离，因此为代码的核心功能编写测试变得更加容易。我们可以直接调用函数并传递各种参数，同时检查返回值，而无需从命令行运行二进制文件。

在本节中，我们将使用测试驱动开发（TDD）流程将搜索逻辑添加到 `minigrep` 程序中，具体步骤如下：

1. 编写一个失败的测试并运行它，确保它按预期失败。
2. 编写或修改足够的代码以使新测试通过。
3. 重构刚刚添加或修改后的代码，并确保测试仍然通过。
4. 重复步骤 1！

虽然这只是编写软件的众多方法之一，但 TDD 可以帮助指导代码设计。在编写实现之前先编写测试，使测试通过，有助于在整个过程中保持较高的测试覆盖率。

我们将通过测试驱动开发来实现以下功能：在文件内容中搜索查询字符串，并生成匹配查询的行列表。我们将将此功能添加到一个名为 `search` 的函数中。

### 编写失败的测试

在 _src/lib.rs_ 中，我们将添加一个包含测试函数的 `tests` 模块，就像我们在 [第 11 章][ch11-anatomy]<!-- ignore -->中所做的那样。测试函数指定了我们希望 `search` 函数具有的行为：它接收查询和搜索文本，并仅返回包含查询的文本中的行。列表 12-15 展示了这个测试。

<Listing number="12-15" file-name="src/lib.rs" caption="Creating a failing test for the `search` function for the functionality we wish we had">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch12-an-io-project/listing-12-15/src/lib.rs:here}}
```

</Listing>

此测试在字符串 `"duct"` 中搜索。我们搜索的文本共有三行，其中只有一行包含 `"duct"`（注意开双引号后的反斜杠告诉 Rust 不要在该字符串字面量的开头添加新行符）。我们假设 `search` 函数返回的值仅包含我们期望的那一行。

如果我们运行这个测试，目前会失败，因为 `unimplemented!` 宏在调用函数时会引发“未实现”的恐慌。根据 TDD 原则，我们可以通过定义 `search` 函数始终返回一个空向量来添加足够的代码，使测试在调用函数时不会引发恐慌，如清单 12-16 所示。这样，测试就能编译并通过，但失败是因为空向量与包含 `"safe, fast, productive."` 这一行的向量不匹配。

<Listing number="12-16" file-name="src/lib.rs" caption="Defining just enough of the `search` function so that calling it won’t panic">

```rust,noplayground
{{#rustdoc_include ../listings/ch12-an-io-project/listing-12-16/src/lib.rs:here}}
```

</Listing>

现在让我们讨论为什么需要在 `search` 的签名中显式定义生命周期 `'a`，并将该生命周期与 `contents` 参数和返回值一起使用。回想一下 [第 10 章][ch10-lifetimes]<!-- ignore --> 中关于生命周期参数的内容，它指定了哪个参数生命周期与返回值的生命周期相关联。在这种情况下，我们表明返回的向量应包含引用 `contents` 切片中的字符串切片（而不是引用 `query` 切片）。

换句话说，我们告诉 Rust，`search` 函数返回的数据将一直存在到在 `contents` 参数中传入的数据为止。这非常重要！切片所引用的数据必须有效，才能保持引用有效；如果编译器假设我们正在创建 `query` 的字符串切片而不是 `contents` 的切片，那么它的安全性检查就会出错。

如果我们忘记添加生命周期注释并尝试编译这个函数，将会出现以下错误：

```console
{{#include ../listings/ch12-an-io-project/output-only-02-missing-lifetimes/output.txt}}
```

Rust 无法知道输出需要哪个参数，因此我们需要明确说明。请注意，帮助文本建议为所有参数和输出类型指定相同的生命周期参数，这是不正确的！因为 `contents` 是包含所有文本的参数，我们想返回与文本匹配的部分，所以我们知道只有 `contents` 应该通过生命周期语法与返回值关联。

其他编程语言不需要在函数签名中将参数与返回值关联起来，但随着时间的推移，这种做法会变得更加容易。你或许可以对比第10章中的“使用生命周期验证引用”部分中的示例。

### 编写通过测试的代码

目前，我们的测试失败是因为我们总是返回一个空的向量。为了修复这个问题并实现 `search` 功能，我们的程序需要遵循以下步骤：

1. 遍历内容的每一行。
2. 检查该行是否包含查询字符串。
3. 如果包含，将其添加到我们返回的值列表中。
4. 如果不包含，则不做任何操作。
5. 返回匹配的结果列表。

让我们从遍历行开始，逐步完成每个步骤。

#### 使用 `lines` 方法遍历行

Rust 有一个非常有用的方法来逐行处理字符串，该方法名为 `lines`，如清单 12-17 所示。请注意，目前这段代码无法编译。

<Listing number="12-17" file-name="src/lib.rs" caption="Iterating through each line in `contents`">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch12-an-io-project/listing-12-17/src/lib.rs:here}}
```

</Listing>

`lines` 方法返回一个迭代器。我们将在 [第13章][ch13-iterators]<!-- ignore -->中详细讨论迭代器。但请记住，你在 [清单 3-5][ch3-iter]<!-- ignore -->中看到过使用迭代器的方式，其中我们使用一个带有迭代器的 `for` 循环对集合中的每个项目执行某些操作。

#### 检查每行是否包含查询字符串

接下来，我们将检查当前行是否包含查询字符串。幸运的是，字符串有一个名为 `contains` 的实用方法可以帮我们完成这一点！在 `search` 函数中添加对 `contains` 方法的调用，如清单 12-18 所示。请注意，目前这段代码仍然无法编译。

<Listing number="12-18" file-name="src/lib.rs" caption="Adding functionality to see whether the line contains the string in `query`">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch12-an-io-project/listing-12-18/src/lib.rs:here}}
```

</Listing>

目前，我们正在构建功能。为了让代码能够编译，我们需要像函数签名中指示的那样从主体中返回一个值。

#### 存储匹配的行

为了完成此功能，我们需要一种方法来存储我们想要返回的匹配行。为此，我们可以在 `for` 循环之前创建一个可变的向量，并调用 `push` 方法将 `line` 存入该向量中。在 `for` 循环结束后，我们像清单 12-19 所示那样返回该向量。

<Listing number="12-19" file-name="src/lib.rs" caption="Storing the lines that match so that we can return them">

```rust,ignore
{{#rustdoc_include ../listings/ch12-an-io-project/listing-12-19/src/lib.rs:here}}
```

</Listing>

现在，`search` 函数应该只返回包含 `query` 的行，我们的测试也应该通过。让我们运行这个测试：

```console
{{#include ../listings/ch12-an-io-project/listing-12-19/output.txt}}
```

我们的测试通过了，因此我们知道它工作了！

此时，我们可以考虑在保持测试通过的情况下重构 `search` 函数的实现，以维护相同的功能。`search` 函数中的代码并不太糟糕，但它没有利用迭代器的某些有用特性。我们将在 [第 13 章][ch13-iterators]<!-- ignore -->中回到这个例子，在那里我们会详细探讨迭代器，并研究如何改进它。

现在整个程序应该可以正常运行了！让我们先尝试一个单词，该单词应该从艾米莉·狄金森的诗歌中恰好返回一行：_frog_。

```console
{{#include ../listings/ch12-an-io-project/no-listing-02-using-search-in-run/output.txt}}
```

太好了！现在让我们尝试一个会匹配多行的单词，比如 _body_：

```console
{{#include ../listings/ch12-an-io-project/output-only-03-multiple-matches/output.txt}}
```

最后，让我们确保当搜索诗歌中不存在的单词时，不会得到任何行，例如 _monomorphization_：

```console
{{#include ../listings/ch12-an-io-project/output-only-04-no-matches/output.txt}}
```

非常棒！我们构建了自己的经典工具迷你版本，并且学到了很多关于如何构建应用程序的结构知识。我们还了解了一些关于文件输入和输出、生命周期、测试和命令行解析的知识。

为了完成这个项目，我们将简要演示如何处理环境变量以及如何在标准错误中打印内容，这两点在编写命令行程序时非常有用。

[validating-references-with-lifetimes]: ch10-03-lifetime-syntax.html#validating-references-with-lifetimes
[ch11-anatomy]: ch11-01-writing-tests.html#the-anatomy-of-a-test-function
[ch10-lifetimes]: ch10-03-lifetime-syntax.html
[ch3-iter]: ch03-05-control-flow.html#looping-through-a-collection-with-for
[ch13-iterators]: ch13-02-iterators.html
