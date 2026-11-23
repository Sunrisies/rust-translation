## 重构以提高模块化和错误处理能力

为了改进我们的程序，我们将解决与程序结构及其处理潜在错误方式相关的四个问题。首先，`main` 函数现在执行两项任务：解析参数和读取文件。随着程序的扩展，`main` 函数处理的独立任务数量会增加。当一个函数承担更多职责时，理解它变得更困难，测试也变得更难，且在不破坏其部分功能的情况下进行修改也更困难。最好将功能分离，使每个函数只负责一项任务。

这个问题也与第二个问题相关：虽然 `query` 和 `file_path` 是程序的配置变量，但像 `contents` 这样的变量用于执行程序逻辑。`main` 函数变得越长，我们需要引入的变量就越多；范围内的变量越多，跟踪每个变量的目的就越困难。最好将配置变量归组到一个结构中，以明确其用途。

第三个问题是，我们在读取文件失败时使用 `expect` 来打印错误信息，但错误信息只是显示“本应能够读取文件”。读取文件可能会因多种原因失败：例如，文件可能不存在，或者我们没有权限打开它。目前，无论情况如何，我们都会为所有情况打印相同的错误信息，这不会向用户提供任何信息！

第四，我们使用 `expect` 来处理错误，如果用户在未指定足够参数的情况下运行程序，他们将收到来自 Rust 的 `index out of bounds` 错误，但该错误无法清晰说明问题原因。最好将所有错误处理代码放在一个地方，这样未来的维护者只需在一个地方查阅代码即可，即使错误处理逻辑需要更改。将所有错误处理代码放在一个地方还能确保我们打印的信息对最终用户有意义。

让我们通过重构项目来解决这四个问题。

<!-- Old headings. Do not remove or links may break. -->

<a id="separation-of-concerns-for-binary-projects"></a>

### 在二进制项目中分离关注点

将多个任务的职责分配给 `main` 函数的组织问题在许多二进制项目中很常见。因此，当 `main` 函数变得庞大时，许多 Rust 程序员认为将二进制程序的各个关注点分开是有益的。这一过程包含以下步骤：

- 将程序拆分为 `_main.rs` 文件和 `_lib.rs` 文件，并将程序逻辑移至 `_lib.rs`。
- 只要命令行解析逻辑较简单，就可以保留在 `main` 函数中。
- 当命令行解析逻辑变得复杂时，将其从 `main` 函数中提取到其他函数或类型中。

经过此过程后，仍留在 `main` 函数中的职责应限于以下方面：

- 使用参数值调用命令行解析逻辑 - 设置其他配置 - 在 `_lib.rs` 中调用 `run` 函数 - 如果 `run` 返回错误则处理该错误

这种模式旨在分离关注点：`_main.rs` 负责运行程序，而 `_lib.rs` 负责处理当前任务的所有逻辑。由于无法直接测试 `main` 函数，这种结构允许通过将逻辑移出 `main` 函数来测试整个程序的逻辑。仍留在 `main` 函数的代码应足够小，可以通过阅读来验证其正确性。让我们按照此流程重新设计我们的程序。

#### 提取参数解析器

我们将将参数解析功能提取到一个函数，由 `main` 调用。图 12-5 展示了 `main` 函数的新开头，该函数调用一个新的函数 `parse_config`，我们将在 `_src/main.rs` 中定义该函数。

<Listing number="12-5" file-name="src/main.rs" caption="Extracting a `parse_config` function from `main`">

```rust,ignore
{{#rustdoc_include ../listings/ch12-an-io-project/listing-12-05/src/main.rs:here}}
```

</Listing>

我们仍在将命令行参数收集到一个向量中，但不再在 `main` 函数中将索引为 1 的参数值赋给变量 `query`，并将索引为 2 的参数值赋给变量 `file_path`，而是将整个向量传递给 `parse_config` 函数。随后，`parse_config` 函数负责处理逻辑，确定每个参数应存入哪个变量，并将这些值返回给 `main`。我们在 `main` 中仍然创建 `query` 和 `file_path` 变量，但 `main` 不再有决定命令行参数与变量之间对应关系的责任。

对于我们的小型程序来说，这种重构可能显得过度，但我们正在以小而逐步的方式进行重构。做出这个更改后，再次运行程序以验证参数解析功能是否正常。经常检查进度有助于在问题出现时及时识别原因。

#### 配置值分组

我们可以进一步改进 `parse_config` 函数。目前我们返回的是一个元组，但随后又立即将其拆分为多个部分。这表明可能我们还没有采用合适的抽象方式。

另一个显示有改进空间的迹象是 `parse_config` 中的 `config` 部分，这表明我们返回的两个值之间存在关联，都是同一个配置值的一部分。目前我们在数据结构上并没有明确表达这一含义，只是将这两个值分组到元组中；我们将把这两个值放入一个结构体中，并为每个结构体字段赋予有意义的名称。这样将来维护者就能更容易理解不同值之间的关联及其作用。

列表 12-6 展示了 `parse_config` 函数的改进之处。

<Listing number="12-6" file-name="src/main.rs" caption="Refactoring `parse_config` to return an instance of a `Config` struct">

```rust,should_panic,noplayground
{{#rustdoc_include ../listings/ch12-an-io-project/listing-12-06/src/main.rs:here}}
```

</Listing>

我们添加了一个名为 `Config` 的结构体，该结构体包含名为 `query` 和 `file_path` 的字段。`parse_config` 函数的签名现在表明它返回一个 `Config` 值。在 `parse_config` 的主体中，我们过去返回的是引用 `String` 值的字符串切片，现在则定义 `Config` 包含拥有权的 `String` 值。`main` 中的 `args` 变量是参数值的拥有者，仅允许 `parse_config` 函数借用这些值，这意味着如果 `Config` 试图获取这些值的拥有权，就会违反 Rust 的借用规则。

我们有多种方式可以管理 `String` 数据；最简单但效率较低的方法是调用值的 `clone` 方法。这将为 `Config` 实例创建完整的数据副本，这比存储对字符串数据的引用需要更多时间和内存。然而，克隆数据也使代码更加简单，因为我们无需管理引用的生命周期；在这种情况下，牺牲一点性能以换取简洁性是一个值得的权衡。

> ### 使用 `clone` 的权衡
>
> 许多 Rust 开发者因为 `clone` 的运行时开销而避免用它来解决拥有权问题。在 [第 13 章][ch13]<!-- ignore -->中，你将学习如何在这种情况下使用更高效的方法。但目前，复制几个字符串以继续进展是可行的，因为你只需要复制一次这些副本，而且你的文件路径和查询字符串非常短。拥有一个稍微低效但能正常运行的程序比试图在第一次迭代中就进行过度优化更好。随着你对 Rust 的熟悉程度提高，开始使用最高效的解决方案会更容易，但现在调用 `clone` 是完全可以接受的。

我们更新了 `main` 函数，使其将 `parse_config` 返回的 `Config` 实例放入名为 `config` 的变量中，并且我们修改了之前使用单独的 `query` 和 `file_path` 变量的代码，现在使用 `Config` 结构体中的字段。

现在我们的代码更清晰地表明了 `query` 和 `file_path` 是相关的，并且它们的目的是配置程序的运行方式。任何使用这些值的代码都应在 `config` 实例中查找对应名称的字段。

#### 创建 `Config` 的构造函数

到目前为止，我们已经从 `main` 函数中提取了解析命令行参数的逻辑，并将其放入 `parse_config` 函数中。这样做让我们意识到 `query` 和 `file_path` 的值是相关的，而这种关系应该在代码中体现出来。随后我们添加了一个 `Config` 结构体来明确 `query` 和 `file_path` 的用途，并使得 `parse_config` 函数能够以结构体字段名的形式返回这些值的名称。

既然 `parse_config` 函数的目的是创建 `Config` 实例，我们可以将 `parse_config` 从普通函数改为与 `Config` 结构体关联的函数 `new`。这种改变会使代码更符合编程习惯。我们可以通过调用 `String::new` 来创建标准库中的类型实例，例如 `String`。同样，通过将 `parse_config` 改为与 `Config` 关联的 `new` 函数，我们也可以通过调用 `Config::new` 来创建 `Config` 的实例。列表 12-7 展示了我们需要进行的修改。

<Listing number="12-7" file-name="src/main.rs" caption="Changing `parse_config` into `Config::new`">

```rust,should_panic,noplayground
{{#rustdoc_include ../listings/ch12-an-io-project/listing-12-07/src/main.rs:here}}
```

</Listing>

我们已经更新了 `main` 函数，将调用 `parse_config` 改为调用 `Config::new`。我们将 `parse_config` 的名称更改为 `new`，并将其移入一个 `impl` 块中，从而将 `new` 函数与 `Config` 关联起来。请再次编译此代码以确认其正常运行。

### 修复错误处理

现在我们来修复错误处理。回想一下，如果 `args` 向量中少于三个元素，尝试访问索引为 1 或 2 的值会导致程序崩溃。试着不输入任何参数运行程序，它看起来会像这样：

```console
{{#include ../listings/ch12-an-io-project/listing-12-07/output.txt}}
```

“索引超出范围：len 为 1，但索引为 1”是一条面向程序员的错误信息。这不会帮助最终用户了解他们应该做什么。现在让我们修复这个问题。

#### 改进错误信息

在清单 12-8 中，我们在 `new` 函数中添加了一个检查，用于在访问索引 1 和索引 2 之前确认切片的长度是否足够。如果切片长度不足，程序会崩溃并显示更清晰的错误信息。

<Listing number="12-8" file-name="src/main.rs" caption="Adding a check for the number of arguments">

```rust,ignore
{{#rustdoc_include ../listings/ch12-an-io-project/listing-12-08/src/main.rs:here}}
```

</Listing>

这段代码与 [清单 9-13 中编写的 `Guess::new` 函数][ch9-custom-types]<!-- ignore --> 类似，我们在 `value` 参数超出有效范围时调用 `panic!`。这里不是检查一系列值的范围，而是检查 `args` 的长度是否至少为 3，其余部分可以假设该条件已满足而继续运行。如果 `args` 中的项目少于三个，则此条件为 true，我们调用 `panic!` 宏以立即终止程序。

在 `new` 函数中添加这几行代码后，让我们再次不带任何参数运行程序，看看现在的错误信息是什么：

```console
{{#include ../listings/ch12-an-io-project/listing-12-08/output.txt}}
```

输出现在更好了：我们有了一个合理的错误信息。然而，我们也包含了一些不希望用户看到的额外信息。也许我们在清单 9-13 中使用的技术并不适合这里使用：`panic!` 调用更适合用于编程问题而非使用问题，[如第 9 章所述][ch9-error-guidelines]<!-- ignore -->。相反，我们将使用第 9 章中学到的另一种技术——[返回 `Result` [ch9-result]<!-- ignore -->]，它表示成功或错误。

<!-- Old headings. Do not remove or links may break. -->

<a id="returning-a-result-from-new-instead-of-calling-panic"></a>

#### 使用 `Result` 返回而不是调用 `panic!`

我们可以改为返回一个 `Result` 值，在成功情况下包含一个 `Config` 实例，在错误情况下描述问题。我们还将函数名从 `new` 更改为 `build`，因为许多程序员期望 `new` 函数永远不会失败。当 `Config::build` 与 `main` 通信时，我们可以使用 `Result` 类型来表明存在问题。然后，我们可以修改 `main` 将 `Err` 变体转换为对用户更有用的错误信息，而不需要关于 `thread 'main'` 和 `RUST_BACKTRACE` 的周围文本，这些是由调用 `panic!` 引起的。

列表 12-9 展示了我们需要对正在调用的 `Config::build` 函数的返回值以及需要返回 `Result` 的函数体进行的修改。请注意，除非我们同时更新 `main` 函数，否则这段代码无法编译，我们将在下一个列表中完成此操作。

<Listing number="12-9" file-name="src/main.rs" caption="Returning a `Result` from `Config::build`">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch12-an-io-project/listing-12-09/src/main.rs:here}}
```

</Listing>

我们的 `build` 函数在成功情况下返回一个包含 `Config` 实例的 `Result`，在错误情况下返回一个字符串字面量。我们的错误值始终为具有 `'static` 生命周期的字符串字面量。

我们在函数体进行了两项修改：当用户未传递足够参数时，不再调用 `panic!`，而是现在返回一个 `Err` 值；并且我们将 `Config` 的返回值包裹在 `Ok` 中。这些修改使得该函数符合其新的类型签名。

从 `Config::build` 返回 `Err` 值允许 `main` 函数处理由 `build` 函数返回的 `Result` 值，并在错误情况下更干净地退出进程。

<!-- Old headings. Do not remove or links may break. -->

<a id="calling-confignew-and-handling-errors"></a>

#### 调用 `Config::build` 并处理错误

为了处理错误情况并输出用户友好的消息，我们需要更新 `main` 以处理 `Config::build` 返回的 `Result`，如列表 12-10 所示。我们还将不再使用 `panic!` 来手动实现以非零错误代码退出命令行工具的责任，而是采用这种约定。非零退出状态是一种惯例，用于向调用我们的程序的进程表明程序以错误状态退出。

<Listing number="12-10" file-name="src/main.rs" caption="Exiting with an error code if building a `Config` fails">

```rust,ignore
{{#rustdoc_include ../listings/ch12-an-io-project/listing-12-10/src/main.rs:here}}
```

</Listing>

在本文中，我们使用了一种尚未详细介绍的方法：`unwrap_or_else`，该方法由标准库定义在 `Result<T, E>` 上。使用 `unwrap_or_else` 允许我们定义一些自定义的、非 `panic!` 错误处理机制。如果 `Result` 是 `Ok` 值，此方法的行为类似于 `unwrap`：它返回 `Ok` 所包裹的内部值。然而，如果值是 `Err` 值，则此方法会调用闭包中的代码，即我们定义并作为参数传递给 `unwrap_or_else` 的匿名函数。我们将在 [第13章][ch13]<!-- ignore -->中更详细地讨论闭包。目前，你只需知道 `unwrap_or_else` 会将 `Err` 的内部值（在此情况下是我们在列表12-9中添加的静态字符串 `"not enough arguments"`）传递给参数 `err` 中的闭包。然后，闭包中的代码可以在运行时使用 `err` 值。

我们添加了一行新的 `use` 语句，将标准库中的 `process` 引入作用域。在错误情况下运行的闭包中的代码只有两行：我们打印 `err` 值，然后调用 `process::exit`。`process::exit` 函数会立即停止程序，并返回作为退出状态代码的数值。这类似于我们在列表12-8中使用的基于 `panic!` 的处理方式，但不再有额外的输出。让我们试试看：

```console
{{#include ../listings/ch12-an-io-project/listing-12-10/output.txt}}
```

很好！这种输出对用户更友好。

<!-- Old headings. Do not remove or links may break. -->

<a id="extracting-logic-from-the-main-function"></a>

### 从 `main` 中提取逻辑

现在我们已经完成了配置解析的重构，接下来我们来看程序的逻辑。正如我们在 [“二进制项目中的职责分离”](#separation-of-concerns-for-binary-projects)<!-- ignore -->中所述，我们将提取一个名为 `run` 的函数，该函数将包含当前 `main` 函数中与设置配置或处理错误无关的所有逻辑。完成后，`main` 函数将更加简洁且易于检查，我们还可以为所有其他逻辑编写测试。

列表12-11展示了提取 `run` 函数的逐步改进过程。

<Listing number="12-11" file-name="src/main.rs" caption="Extracting a `run` function containing the rest of the program logic">

```rust,ignore
{{#rustdoc_include ../listings/ch12-an-io-project/listing-12-11/src/main.rs:here}}
```

</Listing>

`run` 函数现在包含了 `main` 函数中剩余的所有逻辑，从读取文件开始。`run` 函数将 `Config` 实例作为参数传入。

<!-- Old headings. Do not remove or links may break. -->

<a id="returning-errors-from-the-run-function"></a>

#### 在 `run` 中返回错误

通过将剩余的程序逻辑分离到 `run` 函数中，我们可以改进错误处理，就像我们在列表 12-9 中的 `Config::build` 那样。不再通过调用 `expect` 让程序陷入恐慌，`run` 函数在出现问题时将返回一个 `Result<T, E>` 类型的值。这样就能更便捷地将处理错误的逻辑整合到 `main` 函数中。列表 12-12 展示了我们对 `run` 的签名和体内容作修改的内容。

<Listing number="12-12" file-name="src/main.rs" caption="Changing the `run` function to return `Result`">

```rust,ignore
{{#rustdoc_include ../listings/ch12-an-io-project/listing-12-12/src/main.rs:here}}
```

</Listing>

这里进行了三项重要的更改。首先，我们将 `run` 函数的返回类型改为 `Result<(), Box<dyn Error>>`。之前该函数返回单位类型 `()`，我们在 `Ok` 情况下仍然保留这种返回值。

对于错误类型，我们使用了 trait object `Box<dyn Error>`（并在顶部使用 `use` 语句引入了 `std::error::Error`）。我们将在 [第 18 章][ch18]<!-- ignore -->中讨论 trait object。目前只需知道 `Box<dyn Error>` 表示该函数将返回实现 `Error` trait 的类型，但我们不必指定具体是哪种类型。这使我们能够灵活地在不同错误情况下返回不同类型的错误值。`dyn` 关键字是 _dynamic_ 的缩写。

其次，我们删除了对 `expect` 的调用，转而使用 `?` 运算符，正如我们在 [第 9 章][ch9-question-mark]<!-- ignore -->中讨论的那样。而不是在出现错误时调用 `panic!`，`?` 将返回当前函数的错误值给调用者处理。

第三，`run` 函数在成功情况下现在返回 `Ok` 值。我们在签名中将 `run` 函数的成功类型声明为 `()`，这意味着我们需要用 `Ok` 值包裹单位类型值。`Ok(())` 这种语法乍看可能有些奇怪。但像这样使用 `()` 是表示仅调用 `run` 以执行副作用的标准方式；它不返回我们所需的值。

当你运行这段代码时，它可以编译，但会显示警告：

```console
{{#include ../listings/ch12-an-io-project/listing-12-12/output.txt}}
```

Rust 告诉我们，我们的代码忽略了 `Result` 值，`Result` 值可能表明发生了错误。但我们没有检查是否真的出现了错误，编译器提醒我们，我们本应该在这里添加一些错误处理代码！现在让我们解决这个问题。

#### 处理 `main` 中 `run` 返回的误差

我们将使用与清单 12-10 中的 `Config::build` 类似的技术来检测和处理错误，但有一些差异：

<span class="filename">Filename: src/main.rs</span>

```rust,ignore
{{#rustdoc_include ../listings/ch12-an-io-project/no-listing-01-handling-errors-in-main/src/main.rs:here}}
```

我们使用 `if let` 而不是 `unwrap_or_else` 来检查 `run` 是否返回 `Err` 值，如果返回则调用 `process::exit(1)`。由于 `run` 在成功情况下返回 `()`，我们只关心检测错误，因此不需要 `unwrap_or_else` 来返回解包后的值，因为那将只是 `()`。

`if let` 和 `unwrap_or_else` 函数的实现在这两种情况下都是相同的：我们打印出错误信息并退出程序。

### 将代码拆分为库 crate

我们的 `minigrep` 项目目前看起来很好！现在我们将 `_src/main.rs_` 文件拆开，并将部分代码放入 `_src/lib.rs_` 文件中。这样我们可以测试代码，并且 `_src/main.rs_` 文件的职责更少。

让我们在 `_src/lib.rs_` 中定义负责文本搜索的代码，而不是在 `_src/main.rs_` 中，这样我们或任何使用我们的 `minigrep` 库的人可以从更多上下文调用搜索函数，而不仅仅是我们的 `minigrep` 二进制程序。

首先，我们在 `_src/lib.rs_` 中定义 `search` 函数的签名，如清单 12-13 所示，并包含调用 `unimplemented!` 宏的实现体。当我们完成实现时，我们将更详细地解释该签名。

<Listing number="12-13" file-name="src/lib.rs" caption="Defining the `search` function in *src/lib.rs*">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch12-an-io-project/listing-12-13/src/lib.rs}}
```

</Listing>

我们在函数定义上使用了 `pub` 关键字，以将 `search` 指定为我们的库 crate 的公共 API 的一部分。现在我们有一个库 crate，我们可以从我们的二进制 crate 中使用并进行测试！

现在我们需要将 _src/lib.rs_ 中定义的代码引入 _src/main.rs_ 中的二进制 crate 作用域，并像清单 12-14 所示调用它。

<Listing number="12-14" file-name="src/main.rs" caption="Using the `minigrep` library crate’s `search` function in *src/main.rs*">

```rust,ignore
{{#rustdoc_include ../listings/ch12-an-io-project/listing-12-14/src/main.rs:here}}
```

</Listing>

我们添加了一行 `use minigrep::search` 语句，以将库 crate 中的 `search` 函数引入二进制 crate 的作用域。然后，在 `run` 函数中，我们没有打印文件内容，而是调用 `search` 函数并传递 `config.query` 值和 `contents` 作为参数。之后，`run` 会使用一个 `for` 循环来打印所有与查询匹配的 `search` 返回的行。这也是删除 `main` 函数中那些显示查询和文件路径的 `println!` 调用的好时机，这样我们的程序只输出搜索结果（如果没有错误发生的话）。

请注意，`search` 函数会将所有结果收集到一个向量中，然后才进行打印。当搜索大文件时，这种实现可能会显示结果较慢，因为结果不是在找到时立即打印的；我们将在第13章讨论一种使用迭代器来修复此问题的方法。

哇！这确实是一项艰巨的工作，但我们已经为未来的成功做好了准备。现在处理错误变得更加容易，代码也更加模块化。从这里开始，我们几乎所有的工作都将在 _src/lib.rs_ 中完成。

让我们利用这种新获得的模块性去做一些使用旧代码时会很困难、使用新代码却很容易的事情：我们将编写一些测试！

[ch13]: ch13-00-functional-features.html
[ch9-custom-types]: ch09-03-to-panic-or-not-to-panic.html#creating-custom-types-for-validation
[ch9-error-guidelines]: ch09-03-to-panic-or-not-to-panic.html#guidelines-for-error-handling
[ch9-result]: ch09-02-recoverable-errors-with-result.html
[ch18]: ch18-00-oop.html
[ch9-question-mark]: ch09-02-recoverable-errors-with-result.html#a-shortcut-for-propagating-errors-the--operator
