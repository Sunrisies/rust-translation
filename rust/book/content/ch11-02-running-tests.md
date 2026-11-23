## 控制测试的运行方式

正如 `cargo run` 编译代码并运行生成的二进制文件一样，`cargo test` 在测试模式下编译代码，并运行生成的测试二进制文件。`cargo test` 生成的二进制文件的默认行为是并行运行所有测试，并捕获测试过程中的输出，从而防止输出被显示，便于阅读与测试结果相关的信息。不过，你可以指定命令行选项来更改此默认行为。

某些命令行选项传递给 `cargo test`，另一些则传递给生成的测试二进制文件。为了区分这两种类型的参数，你需要先列出传递给 `cargo test` 的参数，然后加上分隔符 `--`，再列出传递给测试二进制文件的参数。运行 `cargo test --help` 可以显示可在 `cargo test` 中使用的选项，而运行 `cargo test -- --help` 则可以显示在分隔符之后可用的选项。这些选项也在《_Rustc 手册_》的“测试”部分中有详细说明[tests]。


### 并行或连续运行测试

当你运行多个测试时，默认情况下它们会使用线程并行运行，这意味着它们会更快完成，并且你能更快地获得反馈。由于测试同时运行，你必须确保测试之间不依赖彼此，也不依赖于任何共享状态，包括共享环境，如当前工作目录或环境变量。

例如，假设每个测试都运行一些代码，在磁盘上创建一个名为 _test-output.txt_ 的文件，并将某些数据写入该文件。然后，每个测试读取该文件中的数据，并断言文件中包含特定值，这些值是每个测试中不同的。由于测试同时运行，一个测试可能会在另一个测试写入和读取文件之间的时间内覆盖文件。此时第二个测试就会失败，不是因为代码错误，而是因为测试在并行运行时相互干扰了。一种解决方案是确保每个测试写入不同的文件；另一种解决方案是逐个运行测试。

如果您不想并行运行测试，或者希望对使用的线程数有更精细的控制，可以将 `--test-threads` 标志以及您想要使用的线程数传递给测试二进制文件。请看以下示例：

```console
$ cargo test -- --test-threads=1
```

我们将测试线程的数量设置为 `1`，告诉程序不要使用并行性。使用一个线程运行测试会比并行运行耗时更长，但如果测试共享状态，它们就不会相互干扰。

### 显示函数输出

默认情况下，如果测试通过，Rust 的测试库会捕获所有打印到标准输出的内容。例如，如果在测试中调用 `println!` 并且测试通过，我们将在终端中看不到 `println!` 的输出，只会看到表示测试通过的行。如果测试失败，我们将看到打印到标准输出的内容以及失败的其余信息。

作为一个示例，列表 11-10 包含一个愚蠢的函数，该函数打印其参数的值并返回 10，以及一个通过的测试和一个失败的测试。

<Listing number="11-10" file-name="src/lib.rs" caption="Tests for a function that calls `println!`">

```rust,panics,noplayground
{{#rustdoc_include ../listings/ch11-writing-automated-tests/listing-11-10/src/lib.rs}}
```

</Listing>

当我们使用 `cargo test` 运行这些测试时，我们会看到以下输出：

```console
{{#include ../listings/ch11-writing-automated-tests/listing-11-10/output.txt}}
```

请注意，在这个输出中没有任何地方显示 `I got the value 4`，这是测试通过时打印的内容。该输出已被捕获。失败测试的输出 `I got the value 8` 出现在测试摘要输出的部分中，其中也显示了导致测试失败的原因。

如果我们还想看到用于通过测试的打印值，可以使用 `--show-output` 选项让 Rust 同时显示成功测试的输出：

```console
$ cargo test -- --show-output
```

当我们再次使用 `--show-output` 标志运行清单 11-10 中的测试时，我们看到了以下输出：

```console
{{#include ../listings/ch11-writing-automated-tests/output-only-01-show-output/output.txt}}
```

### 按名称运行部分测试

运行完整的测试套件有时可能需要很长时间。如果您正在处理某个特定领域的代码，可能只想运行与该代码相关的测试。您可以通过将 `cargo test` 加上要运行的测试的名称作为参数来选择要运行的测试。

为了演示如何运行部分测试，我们将首先创建三个针对 `add_two` 函数的测试，如清单 11-11 所示，然后选择要运行的测试。

<Listing number="11-11" file-name="src/lib.rs" caption="Three tests with three different names">

```rust,noplayground
{{#rustdoc_include ../listings/ch11-writing-automated-tests/listing-11-11/src/lib.rs}}
```

</Listing>

如果我们不传递任何参数来运行测试，正如之前看到的那样，所有测试都会并行运行：

```console
{{#include ../listings/ch11-writing-automated-tests/listing-11-11/output.txt}}
```

#### 运行单个测试

我们可以将任意测试函数的名称传递给 `cargo test` 以仅运行该测试：

```console
{{#include ../listings/ch11-writing-automated-tests/output-only-02-single-test/output.txt}}
```

只有名为 `one_hundred` 的测试被运行；其他两个测试没有匹配该名称。测试输出在最后显示 `2 filtered out`，表明还有更多未运行的测试。

我们无法以这种方式指定多个测试的名称；只会使用传递给 `cargo test` 的第一个值。但有一种方法可以运行多个测试。

#### 筛选以运行多个测试

我们可以指定测试名称的一部分，任何名称与该部分匹配的测试都会被运行。例如，因为我们的两个测试名称都包含 `add`，我们可以通过运行 `cargo test add` 来运行这两个测试：

```console
{{#include ../listings/ch11-writing-automated-tests/output-only-03-multiple-tests/output.txt}}
```

此命令运行了所有名称为 `add` 的测试，并过滤掉了名为 `one_hundred` 的测试。另外请注意，出现测试的模块也会成为该测试的名称的一部分，因此我们可以通过筛选模块名称来运行模块中的所有测试。

<!-- Old headings. Do not remove or links may break. -->

<a id="ignoring-some-tests-unless-specifically-requested"></a>

### 除非特别要求，否则忽略测试

有时某些特定的测试执行起来非常耗时，因此你可能希望在 `cargo test` 的大多数运行过程中将其排除。与其将所有要运行的测试作为参数列出，不如使用 `ignore` 属性对耗时的测试进行标注以将其排除，如下所示：

<span class="filename">Filename: src/lib.rs</span>

```rust,noplayground
{{#rustdoc_include ../listings/ch11-writing-automated-tests/no-listing-11-ignore-a-test/src/lib.rs:here}}
```

在 `#[test]` 之后，我们在想要排除的测试中添加 `#[ignore]` 行。现在当我们运行测试时，`it_works` 会执行，而 `expensive_test` 则不会：

```console
{{#include ../listings/ch11-writing-automated-tests/no-listing-11-ignore-a-test/output.txt}}
```

`expensive_test` 函数被标记为 `ignored`。如果我们只想运行被排除的测试，可以使用 `cargo test -- --ignored`：

```console
{{#include ../listings/ch11-writing-automated-tests/output-only-04-running-ignored/output.txt}}
```

通过控制哪些测试运行，你可以确保 `cargo test` 的结果能够快速返回。当有必要检查被排除的测试结果并且你有时间等待结果时，可以运行 `cargo test -- --ignored`。如果你希望无论是否被排除都运行所有测试，可以使用 `cargo test -- --include-ignored`。

[tests]: https://doc.rust-lang.org/rustc/tests/index.html
