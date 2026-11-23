## 使用 `Result` 处理可恢复的错误

大多数错误并不严重到需要程序完全停止。有时函数失败是有其原因，你可以轻松理解并作出响应。例如，如果你尝试打开一个文件，但操作失败是因为该文件不存在，你可能希望创建这个文件，而不是终止进程。

从第2章的[“使用 `Result` 处理潜在错误”][handle_failure]<!-- ignore -->中可知，`Result` 枚举被定义为具有两种变体：`Ok` 和 `Err`，如下所示：

```rust
enum Result<T, E> {
    Ok(T),
    Err(E),
}
```

`T` 和 `E` 是泛型类型参数：我们将在第10章更详细地讨论泛型。目前你需要知道的是，`T` 表示在 `Ok` 变体中成功时返回的值的类型，而 `E` 表示在 `Err` 变体中失败时返回的错误值类型。由于 `Result` 具有这些泛型类型参数，我们可以在多种不同情况下使用 `Result` 类型和定义在其上的函数，此时我们需要返回的成功值和错误值可能有所不同。

让我们称一个返回 `Result` 值的函数为因可能失败的函数。在列表9-3中，我们尝试打开一个文件。

<Listing number="9-3" file-name="src/main.rs" caption="Opening a file">

```rust
{{#rustdoc_include ../listings/ch09-error-handling/listing-09-03/src/main.rs}}
```

</Listing>

`File::open` 的返回类型是一个 `Result<T, E>`。泛型参数 `T` 由 `File::open` 的实现填充，其类型为成功值 `std::fs::File`，即文件句柄。错误值中使用的 `E` 的类型为 `std::io::Error`。这种返回类型意味着 `File::open` 调用可能成功并返回一个可以读取或写入的文件句柄。函数调用也可能失败：例如，文件可能不存在，或者我们没有访问文件的权限。`File::open` 函数需要有一种方式告诉我们是否成功或失败，同时提供文件句柄或错误信息。这些信息正是 `Result` 枚举所传达的。

如果 `File::open` 成功执行，变量 `greeting_file_result` 中的值将是一个包含文件句柄的 `Ok` 实例。如果失败，则 `greeting_file_result` 中的值将是一个包含关于错误类型的更多信息的 `Err` 实例。

我们需要在清单 9-3 的代码中添加逻辑，根据 `File::open` 返回的值采取不同的操作。清单 9-4 展示了一种使用基本工具 `match` 表达式来处理 `Result` 的方法，这是我们在第 6 章中讨论过的。

<Listing number="9-4" file-name="src/main.rs" caption="Using a `match` expression to handle the `Result` variants that might be returned">

```rust,should_panic
{{#rustdoc_include ../listings/ch09-error-handling/listing-09-04/src/main.rs}}
```

</Listing>

请注意，与 `Option` 枚举 一样，`Result` 枚举 及其变体通过前导代码被引入作用域，因此我们在 `match` 分支中不需要在 `Ok` 和 `Err` 变体之前指定 `Result::`。

当结果为 `Ok` 时，此代码将从 `Ok` 变体中获取内部的 `file` 值，然后将该文件句柄值赋给变量 `greeting_file`。`match` 之后，可以使用该文件句柄进行读取或写入操作。

`match` 的另一个分支处理从 `File::open` 得到 `Err` 值的情况。在这个例子中，我们选择调用 `panic!` 宏。如果当前目录中没有名为 _hello.txt_ 的文件，并且我们运行此代码，将会看到 `panic!` 宏产生的以下输出：

```console
{{#include ../listings/ch09-error-handling/listing-09-04/output.txt}}
```

像往常一样，该输出清楚地告诉我们发生了什么问题。

### 针对不同错误进行匹配

清单 9-4 中的代码无论 `File::open` 为何失败都会触发 `panic!`。然而，我们希望针对不同的失败原因采取不同的操作。如果 `File::open` 因为文件不存在而失败，我们想创建该文件并将句柄返回给新文件。如果 `File::open` 因其他任何原因失败——例如我们没有权限打开文件——我们仍然希望代码以与清单 9-4 中相同的方式触发 `panic!`。为此，我们在清单 9-5 中添加了内部的 `match` 表达式。

<Listing number="9-5" file-name="src/main.rs" caption="Handling different kinds of errors in different ways">

<!-- ignore this test because otherwise it creates hello.txt which causes other
测试会失败 lol -->

```rust,ignore
{{#rustdoc_include ../listings/ch09-error-handling/listing-09-05/src/main.rs}}
```

</Listing>

`File::open` 在 `Err` 变体中返回的值的类型是 `io::Error`，这是一个由标准库提供的结构体。该结构体有一个名为 `kind` 的方法，我们可以调用它来获取一个 `io::ErrorKind` 值。枚举 `io::ErrorKind` 由标准库提供，包含表示 `io` 操作可能产生的不同错误类型的变体。我们想要使用的变体是 `ErrorKind::NotFound`，表示我们试图打开的文件尚未存在。因此，我们在 `greeting_file_result` 上进行匹配，但也在 `error.kind()` 上进行了内部匹配。

我们在内部匹配中想要检查的条件是 `error.kind()` 返回的值是否为 `ErrorKind` 枚举中的 `NotFound` 变体。如果是，则尝试使用 `File::create` 创建文件。然而，由于 `File::create` 也可能失败，我们需要在内部 `match` 表达式中添加第二个分支。当无法创建文件时，会打印不同的错误消息。外部 `match` 的第二个分支保持不变，因此程序在除缺失文件错误之外的任何错误情况下都会崩溃。

> #### 使用 `match` 替代 `Result<T, E>`
>
> 这包含了大量的 `match`！`match` 表达式非常有用，但也是一种基础用法。在第13章中，你将学习闭包，这些闭包用于许多定义在 `Result<T, E>` 上的方法。在处理 `Result<T, E>` 值时，使用这些方法可能比使用 `match` 更简洁。
>
> 例如，以下是另一种实现列表9-5中相同逻辑的方法，这次使用闭包和 `unwrap_or_else` 方法：
>
> <!-- CAN'T EXTRACT SEE https://github.com/rust-lang/mdBook/issues/1127 -->
>
> ```rust,ignore
> use std::fs::File;
> use std::io::ErrorKind;
>
> fn main() {
>     let greeting_file = File::open("hello.txt").unwrap_or_else(|error| {
>         if error.kind() == ErrorKind::NotFound {
>             File::create("hello.txt").unwrap_or_else(|error| {
>                 panic!("Problem creating the file: {error:?}");
>             })
>         } else {
>             panic!("Problem opening the file: {error:?}");
>         }
>     });
> }
> ```
>
> 尽管此代码与列表9-5具有相同的行为，但它不包含任何 `match` 表达式，且更易于阅读。在阅读完第13章后回到这个示例，并在标准库文档中查找 `unwrap_or_else` 方法。当你处理错误时，许多此类方法可以清理复杂的嵌套 `match` 表达式。

<!-- Old headings. Do not remove or links may break. -->

<a id="shortcuts-for-panic-on-error-unwrap-and-expect"></a>

#### 处理错误的恐慌快捷方式

使用 `match` 虽然足够好用，但可能会显得有些冗长，且并不总是能清晰表达意图。`Result<T, E>` 类型定义了许多辅助方法，用于执行各种更具体的任务。`unwrap` 方法是类似于我们在清单 9-4 中编写的 `match` 表达式的快捷方法。如果 `Result` 值为 `Ok` 类型，`unwrap` 将返回 `Ok` 内部的值；如果为 `Err` 类型，`unwrap` 会调用 `panic!` 宏。以下是 `unwrap` 的实际使用示例：

<Listing file-name="src/main.rs">

```rust,should_panic
{{#rustdoc_include ../listings/ch09-error-handling/no-listing-04-unwrap/src/main.rs}}
```

</Listing>

如果我们在不包含 _hello.txt_ 文件的情况下运行此代码，将会看到 `unwrap` 方法引发的 `panic!` 调用的错误消息：

<!-- manual-regeneration
cd listings/ch09-error-handling/no-listing-04-unwrap cargo run copy and paste relevant text -->

```text
thread 'main' panicked at src/main.rs:4:49:
called `Result::unwrap()` on an `Err` value: Os { code: 2, kind: NotFound, message: "No such file or directory" }
```

同样，`expect` 方法也允许我们选择 `panic!` 错误消息。使用 `expect` 代替 `unwrap` 并提供明确的错误消息，可以更好地表达意图，并更容易追踪 panic 的来源。`expect` 的语法如下：

<Listing file-name="src/main.rs">

```rust,should_panic
{{#rustdoc_include ../listings/ch09-error-handling/no-listing-05-expect/src/main.rs}}
```

</Listing>

我们使用 `expect` 的方式与 `unwrap` 相同：返回文件句柄或调用 `panic!` 宏。`expect` 在调用 `panic!` 时使用的错误消息将作为传递给 `expect` 的参数，而不是 `unwrap` 使用的默认 `panic!` 消息。其样子如下：

<!-- manual-regeneration
cd listings/ch09-error-handling/no-listing-05-expect cargo run copy and paste relevant text -->

```text
thread 'main' panicked at src/main.rs:5:10:
hello.txt should be included in this project: Os { code: 2, kind: NotFound, message: "No such file or directory" }
```

在生产级代码中，大多数 Rustaceans 选择使用 `expect` 而非 `unwrap`，并提供更多关于操作应始终成功的背景信息。这样，如果我们的假设被证明错误，就有更多信息可用于调试。

### 传播错误

当函数的实现调用可能失败的操作时，除了在函数内部处理错误外，还可以将错误返回给调用代码，以便调用代码决定如何处理。这被称为 _传播_ 错误，给予调用代码更多的控制权，因为调用代码可能拥有更多信息或逻辑来决定如何处理错误，而这些在您的代码上下文中是无法获得的。

例如，列表 9-6 展示了一个从文件中读取用户名的函数。如果文件不存在或无法读取，该函数会将这些错误返回给调用此函数的代码。

<Listing number="9-6" file-name="src/main.rs" caption="A function that returns errors to the calling code using `match`">

<!-- Deliberately not using rustdoc_include here; the `main` function in the
文件出现恐慌。我们确实希望将其包含进来以便读者进行实验，但不建议用于 rustdoc 测试。

```rust
{{#include ../listings/ch09-error-handling/listing-09-06/src/main.rs:here}}
```

</Listing>

这个函数可以用更简短的方式编写，但我们将先手动完成大部分工作以探索错误处理机制；最后，我们会展示更简洁的写法。首先来看该函数的返回类型：`Result<String, io::Error>`。这意味着该函数返回一个类型为 `Result<T, E>` 的值，其中泛型参数 `T` 被具体化为 `String`，而泛型类型 `E` 则被具体化为 `io::Error`。

如果此函数毫无问题地成功执行，调用该函数的代码将收到一个包含 `String` 的 `Ok` 值——即该函数从文件中读取到的用户名。如果该函数遇到任何问题，调用代码将收到一个包含 `io::Error` 实例的 `Err` 值，其中包含了关于问题的更多详细信息。我们选择 `io::Error` 作为该函数的返回类型，因为恰好是该函数体内可能失败的两个操作——`File::open` 函数和 `read_to_string` 方法——返回的错误值的类型。

函数体首先调用 `File::open` 函数。然后，我们使用类似于列表 9-4 中的 `match` 语句处理 `Result` 值。如果 `File::open` 成功执行，模式变量 `file` 中的文件句柄将变为可变变量 `username_file` 的值，函数继续执行。在 `Err` 情况下，我们不使用 `panic!`，而是使用 `return` 关键字提前退出函数，并将现在位于模式变量 `e` 中的 `File::open` 错误值作为该函数的错误值返回给调用代码。

因此，如果我们在 `username_file` 中有一个文件句柄，该函数会在变量 `username` 中创建一个新的 `String`，并调用 `username_file` 中的文件句柄的 `read_to_string` 方法将文件内容读取到 `username` 中。由于 `read_to_string` 方法可能会失败，即使 `File::open` 成功执行了，它也会返回一个 `Result`。因此，我们需要另一个 `match` 来处理该 `Result`：如果 `read_to_string` 成功，则我们的函数成功完成，我们返回存储在 `username` 中的用户名，并包裹在 `Ok` 中；如果 `read_to_string` 失败，我们以与处理 `File::open` 返回值时的错误值相同的方式返回错误值。然而，我们不需要显式地写 `return`，因为这是函数的最后一条表达式。

调用此代码的代码将处理返回一个包含用户名的 `Ok` 值或一个包含 `io::Error` 的 `Err` 值的情况。由调用代码决定如何处理这些值。如果调用代码得到 `Err` 值，它可以调用 `panic!` 导致程序崩溃，使用默认用户名，或者从文件以外的来源查找用户名等。我们缺乏关于调用代码实际意图的信息，因此我们将所有成功或错误信息向上传递，以便它能够适当处理。

这种传播错误的模式在 Rust 中非常常见，因此 Rust 提供了问号运算符 `?` 来使这一过程更加简单。

<!-- Old headings. Do not remove or links may break. -->

<a id="a-shortcut-for-propagating-errors-the--operator"></a>

#### `?` 运算符的快捷方式

清单 9-7 展示了 `read_username_from_file` 的实现，其功能与清单 9-6 相同，但此实现使用了 `?` 运算符。

<Listing number="9-7" file-name="src/main.rs" caption="A function that returns errors to the calling code using the `?` operator">

<!-- Deliberately not using rustdoc_include here; the `main` function in the
文件会崩溃。我们确实希望将其包含在内以供阅读者实验使用，但不希望在 rustdoc 测试中包含它。 -->

```rust
{{#include ../listings/ch09-error-handling/listing-09-07/src/main.rs:here}}
```

</Listing>

在 `Result` 值后放置的 `?` 符号，其工作原理与我们在列表 9-6 中用于处理 `Result` 值的 `match` 表达式类似。如果 `Result` 的值为 `Ok`，则 `Ok` 内部的值将从该表达式中返回，程序将继续执行。如果值为 `Err`，则整个函数将返回 `Err`，就像使用了 `return` 关键字一样，从而将错误值传播到调用代码。

列表 9-6 中的 `match` 表达式与 `?` 运算符的行为之间存在差异：带有 `?` 运算符的错误值会经过标准库中 `From` trait 定义的 `from` 函数处理，该函数的作用是将一种类型的值转换为另一种类型。当 `?` 运算符调用 `from` 函数时，接收到的错误类型会被转换为当前函数的返回类型所定义的错误类型。当一个函数返回一种错误类型以表示所有可能的失败情况时，这种方法非常有用，即使某些部分可能因多种不同的原因失败。

例如，我们可以修改列表 9-7 中的 `read_username_from_file` 函数，使其返回我们自定义的名为 `OurError` 的错误类型。如果我们还定义 `impl From<io::Error> for OurError`，以便从 `io::Error` 构造 `OurError` 的实例，那么 `read_username_from_file` 函数体内的 `?` 运算符调用将直接调用 `from` 函数并转换错误类型，无需在函数中添加更多代码。

在列表 9-7 的上下文中，`File::open` 调用末尾的 `?` 符号会将 `Ok` 内部的值返回给变量 `username_file`。如果发生错误，则 `?` 运算符会提前从整个函数退出，并将任何 `Err` 值传递给调用代码。对于 `read_to_string` 调用末尾的 `?` 也是如此。

`?` 运算符消除了大量样板代码，使该函数的实现更加简洁。我们甚至可以通过在 `?` 之后直接链接方法调用来进一步缩短代码，如列表 9-8 所示。

<Listing number="9-8" file-name="src/main.rs" caption="Chaining method calls after the `?` operator">

<!-- Deliberately not using rustdoc_include here; the `main` function in the
文件发生恐慌。我们确实希望将其包含以供读者实验使用，但不希望用于 rustdoc 测试。 -->

```rust
{{#include ../listings/ch09-error-handling/listing-09-08/src/main.rs:here}}
```

</Listing>

我们将 `username` 函数中新 `String` 的创建移到了函数的开头；这部分没有变化。我们没有创建变量 `username_file`，而是直接将 `read_to_string` 的调用链接到 `File::open("hello.txt")?` 的结果上。我们在 `read_to_string` 调用末尾仍然保留了 `?` 符号，并且当 `File::open` 和 `read_to_string` 都成功时，仍返回包含 `username` 的 `Ok` 值，而不是返回错误。其功能与清单 9-6 和清单 9-7 中的相同；这只是一种更易于使用的写法。

清单 9-9 展示了使用 `fs::read_to_string` 使代码更简短的方法。

<Listing number="9-9" file-name="src/main.rs" caption="Using `fs::read_to_string` instead of opening and then reading the file">

<!-- Deliberately not using rustdoc_include here; the `main` function in the
文件发生恐慌。我们确实希望将其包含以供读者实验使用，但不希望用于 rustdoc 测试。 -->

```rust
{{#include ../listings/ch09-error-handling/listing-09-09/src/main.rs:here}}
```

</Listing>

将文件读取为字符串是一个相当常见的操作，因此标准库提供了方便的 `fs::read_to_string` 函数，该函数会打开文件、创建新的 `String`，读取文件内容，将内容放入该 `String` 中，并返回结果。当然，使用 `fs::read_to_string` 无法让我们详细解释所有的错误处理，所以我们首先采用更长的方式来实现。

<!-- Old headings. Do not remove or links may break. -->

<a id="where-the--operator-can-be-used"></a>

#### `?` 运算符的使用位置

`?` 运算符只能用于返回类型与 `?` 所操作值兼容的函数中。这是因为 `?` 运算符被定义为从函数中提前返回一个值，其方式与我们在清单 9-6 中定义的 `match` 表达式相同。在清单 9-6 中，`match` 使用了 `Result` 值，而提前返回分支则返回 `Err(e)` 值。函数的返回类型必须是 `Result`，以便与这种 `return` 方式兼容。

在清单 9-10 中，让我们看看如果在具有不兼容返回类型的 `main` 函数中使用 `?` 运算符时会出现的错误。

<Listing number="9-10" file-name="src/main.rs" caption="Attempting to use the `?` in the `main` function that returns `()` won’t compile.">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch09-error-handling/listing-09-10/src/main.rs}}
```

</Listing>

此代码打开一个文件，可能会失败。`?` 运算符用于处理 `File::open` 返回的 `Result` 值，但 `main` 函数的返回类型为 `()`，而非 `Result`。当我们编译此代码时，会收到以下错误消息：

```console
{{#include ../listings/ch09-error-handling/listing-09-10/output.txt}}
```

该错误指出，我们只能在返回 `Result`、`Option` 或实现 `FromResidual` 的类型的函数中使用 `?` 运算符。

要解决此错误，有两种选择。一种是将函数的返回类型改为与 `?` 运算符所操作的数值兼容，只要没有限制阻止这样做即可。另一种方法是使用 `match` 语句或 `Result<T, E>` 方法中的某种方式来处理 `Result<T, E>`。

错误消息还提到，`?` 也可以用于 `Option<T>` 值。与在 `Result` 上使用 `?` 一样，只能在返回 `Option` 的函数中对 `Option` 使用 `?`。当对 `Option<T>` 调用 `?` 运算符时，其行为与对 `Result<T, E>` 调用 `?` 时的行为类似：如果值为 `None`，则会在该点提前从函数中返回 `None`；如果值为 `Some`，则 `Some` 中的值即为表达式的结果值，函数会继续执行。列表 9-11 提供了一个示例函数，用于查找给定文本中第一行的最后一个字符。

<Listing number="9-11" caption="Using the `?` operator on an `Option<T>` value">

```rust
{{#rustdoc_include ../listings/ch09-error-handling/listing-09-11/src/main.rs:here}}
```

</Listing>

此函数返回 `Option<char)`，因为可能存在字符，也可能不存在。该代码接受 `text` 字符串切片参数，并调用其上的 `lines` 方法，该方法返回一个包含字符串行数的迭代器。由于该函数需要检查第一行，因此通过调用迭代器的 `next` 方法获取第一个值。如果 `text` 是空字符串，则对 `next` 的调用将返回 `None`，此时我们使用 `?` 停止操作并从 `last_char_of_first_line` 返回 `None`。如果 `text` 不是空字符串，`next` 将返回一个包含 `text` 中第一行字符串切片的 `Some` 值。

`?` 运算符用于提取字符串切片，我们可以对该字符串切片调用 `chars` 来获取其字符的迭代器。我们感兴趣的是第一行的最后一个字符，因此调用 `last` 以获取迭代器的最后一项。`Option` 在此处非常重要，因为第一行可能是空字符串；例如，如果 `text` 以空白行开头，但在其他行上有字符，如 `"\nhi"`。然而，如果第一行有最后一个字符，则会在 `Some` 变体中返回。中间的 `?` 运算符提供了一种简洁的方式来表达这种逻辑，使我们能够用一行代码实现该函数。如果我们不能在 `Option` 上使用 `?` 运算符，就不得不使用更多的方法调用或 `match` 表达式来实现这种逻辑。

请注意，在返回 `Result` 的函数中可以使用 `?` 运算符，而在返回 `Option` 的函数中可以使用 `?` 运算符，但两者不能混合使用。`?` 运算符不会自动将 `Result` 转换为 `Option`，反之亦然；在这种情况下，可以使用 `Result` 的 `ok` 方法或 `Option` 的 `ok_or` 方法来显式进行转换。

到目前为止，我们使用的所有 `main` 函数都返回 `()`。`main` 函数很特殊，因为它是可执行程序的入口点和出口点，并且其返回类型有限制，以确保程序按预期运行。

幸运的是，`main` 也可以返回 `Result<(), E>`。列表 9-12 包含了列表 9-10 中的代码，但我们将 `main` 的返回类型改为 `Result<(), Box<dyn Error>>`，并在末尾添加了一个返回值 `Ok(())`。这样代码现在就可以编译了。

<Listing number="9-12" file-name="src/main.rs" caption="Changing `main` to return `Result<(), E>` allows the use of the `?` operator on `Result` values.">

```rust,ignore
{{#rustdoc_include ../listings/ch09-error-handling/listing-09-12/src/main.rs}}
```

</Listing>

`Box<dyn Error>` 类型是一种 trait object，我们将在第 18 章的“使用 trait object 抽象共享行为”中讨论这一点。目前，你可以将 `Box<dyn Error>` 理解为“任何类型的错误”。在 `main` 函数中对带有 `Box<dyn Error>` 错误类型的 `Result` 值使用 `?` 是允许的，因为这样可以允许任何 `Err` 值提前返回。尽管这个 `main` 函数的主体只会返回 `std::io::Error` 类型的错误，但通过指定 `Box<dyn Error>`，该签名仍然正确，即使在 `main` 的体内添加了更多返回其他错误的代码。

当 `main` 函数返回 `Result<(), E>` 时，如果 `main` 返回 `Ok(())`，可执行文件将以值 `0` 退出；如果 `main` 返回 `Err` 值，则将以非零值退出。用 C 编写的可执行文件在退出时返回整数：成功退出的程序返回整数 `0`，出现错误的程序返回除 `0` 之外的某个整数。Rust 也从可执行文件中返回整数，以符合这一约定。

`main` 函数可以返回任何实现 [`std::process::Termination` trait] 的类型，该 trait 包含一个返回 `ExitCode` 的 `report` 函数。有关为自定义类型实现 `Termination` trait 的更多信息，请查阅标准库文档。

现在我们已经讨论了调用 `panic!` 或返回 `Result` 的细节，让我们回到如何决定在哪些情况下使用哪种方式的主题上。

[handle_failure]: ch02-00-guessing-game-tutorial.html#handling-potential-failure-with-result
[trait-objects]: ch18-02-trait-objects.html#using-trait-objects-to-abstract-over-shared-behavior
[termination]: ../std/process/trait.Termination.html
