## 使用环境变量

我们将通过添加一项新功能来改进 `minigrep` 二进制文件：一个不区分大小写的搜索选项，用户可以通过环境变量启用该选项。我们可以将该功能作为命令行选项，并要求用户在每次需要使用时输入它，但通过将它设为环境变量，用户可以一次设置该环境变量，从而在整个终端会话中所有搜索都保持不区分大小写。

<!-- Old headings. Do not remove or links may break. -->
<a id="writing-a-failing-test-for-the-case-insensitive-search-function"></a>

### 编写针对不区分大小写搜索的失败测试

我们首先在 `minigrep` 库中添加一个新的 `search_case_insensitive` 函数，当环境变量有值时就会调用该函数。我们将继续遵循 TDD 流程，因此第一步再次是编写一个失败的测试。我们将为新的 `search_case_insensitive` 函数添加一个新的测试，并将旧测试从 `one_result` 重命名为 `case_sensitive`，以明确两个测试之间的区别，如清单 12-20 所示。

<Listing number="12-20" file-name="src/lib.rs" caption="Adding a new failing test for the case-insensitive function we’re about to add">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch12-an-io-project/listing-12-20/src/lib.rs:here}}
```

</Listing>

请注意，我们也修改了旧测试的 `contents`。我们添加了一行包含文本 `"Duct tape."` 的新行，其中 _D_ 为大写，在区分大小写的搜索中不应与查询 `"duct"` 匹配。以这种方式修改旧测试有助于确保我们不会意外破坏已经实现的区分大小写搜索功能。现在该测试应该通过，并且随着我们不区分大小写搜索的开发，它将继续通过。

针对不区分大小写搜索的新测试使用 `"rUsT"` 作为查询。在即将添加的 `search_case_insensitive` 函数中，`"rUsT"` 查询应匹配包含大写 _R_ 的 `"Rust:"` 行，以及 `"Trust me."` 行，尽管这两行的大小写与查询不同。这是我们的失败测试，由于我们尚未定义 `search_case_insensitive` 函数，因此无法编译。你可以自由添加一个始终返回空向量的骨架实现，类似于我们在清单 12-16 中为 `search` 函数所做的那样，以观察测试能否编译和失败。

### 实现 `search_case_insensitive` 函数

列表 12-21 中所示的 `search_case_insensitive` 函数与 `search` 函数几乎相同。唯一的区别是我们将 `query` 和每个 `line` 都转换为小写，这样无论输入参数的大小写如何，在检查行是否包含查询时都会保持相同的格式。

<Listing number="12-21" file-name="src/lib.rs" caption="Defining the `search_case_insensitive` function to lowercase the query and the line before comparing them">

```rust,noplayground
{{#rustdoc_include ../listings/ch12-an-io-project/listing-12-21/src/lib.rs:here}}
```

</Listing>

首先，我们将 `query` 字符串转换为小写，并将其存储在一个同名的新变量中，从而覆盖原来的 `query`。对 `query` 调用 `to_lowercase` 是必要的，这样无论用户输入的查询是 `"rust"`、 `"RUST"`、 `"Rust"` 还是 `"rUsT"`，我们都会将其视为 `"rust"` 并忽略大小写。虽然 `to_lowercase` 可以处理基本的 Unicode 字符，但它的准确性并非 100%。如果我们在编写实际应用程序，可能需要进行更多处理，但由于这里讨论的是环境变量而非 Unicode，因此在此处保持原样即可。

请注意，`query` 现在是一个 `String` 而不是字符串切片，因为调用 `to_lowercase` 会创建新数据而不是引用现有数据。以查询 `"rUsT"` 为例：该字符串切片中不包含小写 `u` 或 `t`，因此我们必须分配一个包含 `"rust"` 的新 `String`。当我们将 `query` 作为参数传递给 `contains` 方法时，需要添加一个 & 符号，因为 `contains` 的签名定义为接受字符串切片。

接下来，我们对每个 `line` 调用 `to_lowercase` 以将所有字符转换为小写。现在我们已经将 `line` 和 `query` 转换为小写，那么无论查询的大小写如何，我们都能找到匹配项。

让我们看看这个实现是否通过测试：

```console
{{#include ../listings/ch12-an-io-project/listing-12-21/output.txt}}
```

很好！它们通过了测试。现在让我们从 `run` 函数中调用新的 `search_case_insensitive` 函数。首先，我们在 `Config` 结构中添加了一个配置选项，以在区分大小写和不区分大小写的搜索之间切换。添加此字段会导致编译器报错，因为我们目前没有初始化该字段：

<span class="filename">Filename: src/main.rs</span>

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch12-an-io-project/listing-12-22/src/main.rs:here}}
```

我们添加了 `ignore_case` 字段，该字段包含一个布尔值。接下来，我们需要 `run` 函数来检查 `ignore_case` 字段的值，并据此决定调用 `search` 函数还是 `search_case_insensitive` 函数，如清单 12-22 所示。不过目前仍然无法编译。

<Listing number="12-22" file-name="src/main.rs" caption="Calling either `search` or `search_case_insensitive` based on the value in `config.ignore_case`">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch12-an-io-project/listing-12-22/src/main.rs:there}}
```

</Listing>

最后，我们需要检查环境变量。处理环境变量的函数位于标准库中的 `env` 模块中，该模块已存在于 _src/main.rs_ 文件的顶部。我们将使用 `env` 模块中的 `var` 函数来检查是否设置了名为 `IGNORE_CASE` 的环境变量，如清单 12-23 所示。

<Listing number="12-23" file-name="src/main.rs" caption="Checking for any value in an environment variable named `IGNORE_CASE`">

```rust,ignore,noplayground
{{#rustdoc_include ../listings/ch12-an-io-project/listing-12-23/src/main.rs:here}}
```

</Listing>

在这里，我们创建了一个新的变量 `ignore_case`。要设置其值，我们调用 `env::var` 函数并传入 `IGNORE_CASE` 环境变量名。`env::var` 函数返回一个 `Result`，其中成功的 `Ok` 变体包含环境变量的实际值（如果已设置）。如果未设置该环境变量，则返回 `Err` 变体。

我们使用 `Result` 的 `is_ok` 方法来检查环境变量是否已被设置，这意味着程序应执行不区分大小写的搜索。如果 `IGNORE_CASE` 环境变量没有设置为任何值，`is_ok` 将返回 `false`，程序将执行区分大小写的搜索。我们并不关心环境变量的具体值，只关心它是否被设置或未设置，因此我们使用 `is_ok` 而不是 `unwrap`、`expect` 或其他针对 `Result` 的方法。

我们将 `ignore_case` 变量中的值传递给 `Config` 实例，以便 `run` 函数可以读取该值并决定调用 `search_case_insensitive` 还是 `search`，正如我们在清单 12-22 中实现的那样。

让我们试一试！首先，我们将程序在没有设置环境变量且查询为 `to` 的情况下运行，这应该能匹配所有全小写包含单词 _to_ 的行。

```console
{{#include ../listings/ch12-an-io-project/listing-12-23/output.txt}}
```

看起来仍然可以工作！现在让我们将程序中的 `IGNORE_CASE` 设置为 `1`，但使用相同的查询 `to`：

```console
$ IGNORE_CASE=1 cargo run -- to poem.txt
```

如果您使用 PowerShell，则需要设置环境变量并将程序作为独立命令运行：

```console
PS> $Env:IGNORE_CASE=1; cargo run -- to poem.txt
```

这样即可使 `IGNORE_CASE` 在您的 Shell 会话中持续生效。可以使用 `Remove-Item` cmdlet 取消设置该变量：

```console
PS> Remove-Item Env:IGNORE_CASE
```

我们应该得到包含 _to_ 的行，这些行可能包含大写字母：

<!-- manual-regeneration
cd listings/ch12-an-io-project/listing-12-23 IGNORE_CASE=1 cargo run -- to poem.txt can't extract because of the environment variable -->

```console
Are you nobody, too?
How dreary to be somebody!
To tell your name the livelong day
To an admiring bog!
```

很好，我们确实得到了包含 _To_ 的行！现在我们的 `minigrep` 程序可以通过环境变量进行不区分大小写的搜索。现在您知道了如何管理通过命令行参数或环境变量设置的选项。

某些程序允许相同的配置同时使用参数和环境变量。在这种情况下，程序会决定哪个优先生效。作为另一个练习，尝试通过命令行参数或环境变量来控制大小写敏感性。如果程序一组设置为区分大小写，另一组设置为忽略大小写，请判断是命令行参数还是环境变量应该具有优先级。

`std::env` 模块包含许多处理环境变量的有用功能：请查看其文档以了解可用的功能。
