## 如何编写测试

_测试_是Rust函数，用于验证非测试代码是否按预期运行。测试函数的主体通常执行以下三个操作：

- 设置所需的数据或状态。
- 运行你要测试的代码。
- 断言结果符合你的期望。

让我们看看Rust为编写执行这些操作的测试提供的特性，包括`test`属性、几个宏以及`should_panic`属性。

<!-- Old headings. Do not remove or links may break. -->

<a id="the-anatomy-of-a-test-function"></a>

### 结构化测试函数

最简单地说，Rust中的测试是一个带有`test`属性的函数。属性是关于Rust代码的元数据；例如第5章中我们在结构体上使用的`derive`属性。要将一个函数转换为测试函数，请在`fn`之前的行添加 `#[test]`。当你使用`cargo test`命令运行测试时，Rust会构建一个测试运行器二进制文件，该文件会执行被注释的函数并报告每个测试函数是否通过或失败。

每当我们使用Cargo创建新的库项目时，系统会自动生成一个包含测试函数的测试模块。这个模块为你提供了编写测试的模板，这样你就不必每次开始新项目时都查找具体的结构和语法。你可以添加任意多的额外测试函数和测试模块！

在实际测试任何代码之前，我们将通过尝试使用模板测试来探索测试的工作原理。然后，我们将编写一些真实的测试，这些测试调用我们编写的某些代码，并断言其行为正确。

让我们创建一个名为`adder`的新库项目，它用于计算两个数的之和：

```console
$ cargo new adder --lib
     Created library `adder` project
$ cd adder
```

你的`adder`库的`_src/lib.rs_`文件内容应类似于列表11-1。

<Listing number="11-1" file-name="src/lib.rs" caption="The code generated automatically by `cargo new`">

<!-- manual-regeneration
cd listings/ch11-writing-automated-tests rm -rf listing-11-01 cargo new listing-11-01 --lib --name adder cd listing-11-01 echo "$ cargo test" > output.txt RUSTFLAGS="-A unused_variables -A dead_code" RUST_TEST_THREADS=1 cargo test >> output.txt 2>&1 git diff output.txt # commit any relevant changes; discard irrelevant ones cd ../../.. -->

```rust,noplayground
{{#rustdoc_include ../listings/ch11-writing-automated-tests/listing-11-01/src/lib.rs}}
```

</Listing>

该文件以一个示例 `add` 函数开始，以便我们能够进行测试。

目前，让我们仅关注 `it_works` 函数。请注意 `#[test]` 注释：此属性表明这是一个测试函数，因此测试运行器知道将该函数视为测试。在 `tests` 模块中也可能有非测试函数，用于设置常见场景或执行常见操作，因此我们必须始终标明哪些函数是测试。

示例函数的主体使用 `assert_eq!` 宏来断言 `result` 等于 4，其中 `result` 是调用 `add` 函数时输入 2 和 2 的结果。此断言展示了典型测试的格式示例。让我们运行它以验证该测试是否通过。

`cargo test` 命令会运行项目中的所有测试，如清单 11-2 所示。

<Listing number="11-2" caption="The output from running the automatically generated test">

```console
{{#include ../listings/ch11-writing-automated-tests/listing-11-01/output.txt}}
```

</Listing>

Cargo 编译并运行了测试。我们看到一行 `running 1 test`。下一行显示生成的测试函数名称 `tests::it_works`，并且该测试的结果是 `ok`。整体总结 `test result: ok.` 表示所有测试都通过，而 `1 passed; 0 failed` 部分则统计了通过或失败的测试数量。

可以将测试标记为忽略，使其在特定实例中不运行；我们将在本章后面的“除非特别要求否则忽略测试”部分讨论此功能。由于此处没有这样做，总结显示 `0 ignored`。我们还可以向 `cargo test` 命令传递参数，以仅运行名称符合特定字符串的测试；这称为_过滤_，我们将在“按名称运行子集测试”部分讨论此功能。在这里，我们没有过滤正在运行的测试，因此总结末尾显示 `0 filtered out`。

`0 measured` 统计信息用于衡量性能的基准测试。截至本文撰写时，基准测试仅适用于夜间版 Rust。有关更多信息，请参阅关于基准测试的文档。

接下来的测试输出从 `Doc-tests adder` 开始，用于显示任何文档测试的结果。目前我们还没有文档测试，但 Rust 可以编译我们在 API 文档中出现的任何代码示例。此功能有助于保持文档和代码的同步！我们将在第 14 章的“将文档注释作为测试”[doc-comments]<!-- ignore -->部分讨论如何编写文档测试。目前，我们将忽略 `Doc-tests` 的输出。

让我们开始根据需求自定义测试。首先，将 `it_works` 函数的名称改为另一个名称，例如 `exploration`，如下所示：

<span class="filename">Filename: src/lib.rs</span>

```rust,noplayground
{{#rustdoc_include ../listings/ch11-writing-automated-tests/no-listing-01-changing-test-name/src/lib.rs}}
```

然后，再次运行 `cargo test`。现在输出显示的是 `exploration` 而不是 `it_works`：

```console
{{#include ../listings/ch11-writing-automated-tests/no-listing-01-changing-test-name/output.txt}}
```

现在我们添加另一个测试，但这次我们要编写一个失败的测试！当测试函数中的某部分发生恐慌时，测试就会失败。每个测试都在新线程中运行，当主线程发现某个测试线程已死亡时，该测试就被标记为失败。在第 9 章中，我们讨论了导致恐慌的最简单方式就是调用 `panic!` 宏。将新的测试作为名为 `another` 的函数输入，这样你的 _src/lib.rs_ 文件就会像列表 11-3 那样。

<Listing number="11-3" file-name="src/lib.rs" caption="Adding a second test that will fail because we call the `panic!` macro">

```rust,panics,noplayground
{{#rustdoc_include ../listings/ch11-writing-automated-tests/listing-11-03/src/lib.rs}}
```

</Listing>

再次使用 `cargo test` 运行测试。输出应类似于列表 11-4，其中显示我们的 `exploration` 测试通过，而 `another` 测试失败。

<Listing number="11-4" caption="Test results when one test passes and one test fails">

```console
{{#include ../listings/ch11-writing-automated-tests/listing-11-03/output.txt}}
```

</Listing>

<!-- manual-regeneration
查看 `rg panicked listings/ch11-writing-automated-tests/listing-11-03/output.txt` 文件中的恐慌行号是否与下一段的行号一致

instead of `ok`，行 `test tests::another` 显示为 `FAILED`。在各个结果和总结之间出现了两个新部分：第一个部分展示了每个测试失败的详细原因。在这种情况下，我们得知 `tests::another` 失败是因为它在 _src/lib.rs_ 文件的第17行触发了 `Make this test fail` 的异常。下一个部分仅列出所有失败的测试名称，当测试数量众多且失败输出详细时非常有用。我们可以通过使用失败测试的名称来运行该测试，从而更轻松地调试问题；我们将在“控制测试运行方式”部分进一步讨论如何运行测试的方法。[“Controlling How Tests Are Run”][controlling-how-tests-are-run]<!-- ignore -->

总结行显示在最后：总体而言，我们的测试结果为 `FAILED`。有一个测试通过，一个测试失败。

现在你已经看到了不同场景下的测试结果是什么样的了，让我们来看看在测试中有用的其他宏，除了 `panic!`。

<!-- Old headings. Do not remove or links may break. -->

<a id="checking-results-with-the-assert-macro"></a>

### 使用 `assert!` 检查结果

标准库提供的 `assert!` 宏在你需要确保测试中的某个条件评估为 `true` 时非常有用。我们将一个布尔值作为参数给 `assert!` 宏。如果值为 `true`，则不会发生任何事情，测试通过；如果值为 `false`，`assert!` 宏会调用 `panic!` 导致测试失败。使用 `assert!` 宏有助于我们验证代码按预期运行。

在第5章的列表5-15中，我们使用了 `Rectangle` 结构体和 `can_hold` 方法，这些在列表11-5中重复出现。我们将这段代码放入 _src/lib.rs_ 文件中，然后使用 `assert!` 宏编写一些测试。

<Listing number="11-5" file-name="src/lib.rs" caption="The `Rectangle` struct and its `can_hold` method from Chapter 5">

```rust,noplayground
{{#rustdoc_include ../listings/ch11-writing-automated-tests/listing-11-05/src/lib.rs}}
```

</Listing>

`can_hold` 方法返回布尔值，这意味着它是 `assert!` 宏的一个完美使用案例。在列表11-6中，我们编写一个测试，通过创建一个宽度为8、高度为7的 `Rectangle` 实例来调用 `can_hold` 方法，并断言它能够容纳另一个宽度为5、高度为1的 `Rectangle` 实例。

<Listing number="11-6" file-name="src/lib.rs" caption="A test for `can_hold` that checks whether a larger rectangle can indeed hold a smaller rectangle">

```rust,noplayground
{{#rustdoc_include ../listings/ch11-writing-automated-tests/listing-11-06/src/lib.rs:here}}
```

</Listing>

请注意 `tests` 模块中的 `use super::*;` 行。`tests` 模块是一个普通模块，遵循我们在[“在模块树中引用项的路径”][paths-for-referring-to-an-item-in-the-模块-tree]<!-- ignore -->章节第7章中讨论的常规可见性规则。由于 `tests` 模块是一个内部模块，我们需要将外部模块中的测试代码引入到内部模块的作用域中。这里我们使用 glob 模式，因此外部模块中定义的任何内容都可供此 `tests` 模块使用。

我们将测试命名为 `larger_can_hold_smaller`，并创建了所需的两个 `Rectangle` 实例。然后，我们调用了 `assert!` 宏，并将 `larger.can_hold(&smaller)` 的结果传递给它。该表达式应返回 `true`，因此我们的测试应该通过。让我们验证一下！

```console
{{#include ../listings/ch11-writing-automated-tests/listing-11-06/output.txt}}
```

确实通过了！现在我们来添加另一个测试，这次断言较小的矩形无法容纳较大的矩形：

<span class="filename">Filename: src/lib.rs</span>

```rust,noplayground
{{#rustdoc_include ../listings/ch11-writing-automated-tests/no-listing-02-adding-another-rectangle-test/src/lib.rs:here}}
```

因为在这种情况下 `can_hold` 函数的正确结果是 `false`，我们需要在将其传递给 `assert!` 宏之前将结果取反。因此，如果 `can_hold` 返回 `false`，我们的测试就会通过：

```console
{{#include ../listings/ch11-writing-automated-tests/no-listing-02-adding-another-rectangle-test/output.txt}}
```

两个测试都通过了！现在让我们看看当我们在代码中引入错误时测试结果会如何变化。我们将通过替换 `can_hold` 方法中的大于号（`>`）为小于号（`<`），从而改变其实现：

```rust,not_desired_behavior,noplayground
{{#rustdoc_include ../listings/ch11-writing-automated-tests/no-listing-03-introducing-a-bug/src/lib.rs:here}}
```

现在运行测试会得到以下结果：

```console
{{#include ../listings/ch11-writing-automated-tests/no-listing-03-introducing-a-bug/output.txt}}
```

我们的测试发现了这个错误！因为 `larger.width` 是 `8`，而 `smaller.width` 是 `5`，因此 `can_hold` 中的宽度比较现在返回 `false`：8 不小于 5。

<!-- Old headings. Do not remove or links may break. -->

<a id="testing-equality-with-the-assert_eq-and-assert_ne-macros"></a>

### 使用 `assert_eq!` 和 `assert_ne!` 进行相等性测试

验证功能的一种常见方法是测试被测试代码的结果与预期返回值是否相等。可以通过使用 `assert!` 宏并传递使用 `==` 运算符表达的语句来实现这一点。然而，由于这种测试非常常见，标准库提供了两个宏——`assert_eq!` 和 `assert_ne!`——以便更方便地执行此测试。这些宏分别用于比较两个参数是否相等或不相等。如果断言失败，它们还会打印这两个值，从而更容易了解测试失败的原因；而 `assert!` 宏仅表明 `==` 表达式得到了 `false` 值，不会打印导致 `false` 值的数值。

在清单 11-7 中，我们编写了一个名为 `add_two` 的函数，该函数将其参数加 `2`，然后使用 `assert_eq!` 宏来测试该函数。

<Listing number="11-7" file-name="src/lib.rs" caption="Testing the function `add_two` using the `assert_eq!` macro">

```rust,noplayground
{{#rustdoc_include ../listings/ch11-writing-automated-tests/listing-11-07/src/lib.rs}}
```

</Listing>

让我们检查它是否通过！

```console
{{#include ../listings/ch11-writing-automated-tests/listing-11-07/output.txt}}
```

我们创建一个名为 `result` 的变量，用于存储调用 `add_two(2)` 的结果。然后，我们将 `result` 和 `4` 作为参数传递给 `assert_eq!` 宏。此测试的输出行为 `test tests::it_adds_two ... ok`，`ok` 文字表明我们的测试通过！

让我们在代码中引入一个错误，以观察 `assert_eq!` 在失败时的表现。将 `add_two` 函数的实现改为加 `3`：

```rust,not_desired_behavior,noplayground
{{#rustdoc_include ../listings/ch11-writing-automated-tests/no-listing-04-bug-in-add-two/src/lib.rs:here}}
```

再次运行测试：

```console
{{#include ../listings/ch11-writing-automated-tests/no-listing-04-bug-in-add-two/output.txt}}
```

我们的测试发现了错误！`tests::it_adds_two` 测试失败，消息告诉我们失败的断言是 `left == right`，以及 `left` 和 `right` 的值是什么。这个消息有助于我们开始调试：`left` 参数（即调用 `add_two(2)` 的结果）为 `5`，而 `right` 参数为 `4`。当有很多测试时，这尤其有帮助。

请注意，在某些语言和测试框架中，相等性断言函数的参数被称为 `expected` 和 `actual`，我们指定参数的顺序很重要。然而在 Rust 中，它们被称为 `left` 和 `right`，我们指定预期值与代码生成值的顺序并不重要。我们可以在测试中这样写断言：`assert_eq!(4, result)`，这将导致与 `` assertion `left == right` failed `` 相同的失败消息。

如果传递给 `assert_ne!` 宏的两个值不相等，则宏会通过；如果它们相等，则宏会失败。此宏在不确定某个值_将会_是什么，但知道该值_绝对不应该_是的情况下非常有用。例如，如果我们正在测试一个函数，该函数保证以某种方式改变其输入，而输入变化的方式取决于我们测试的星期几，那么最好的断言可能是函数的输出不等于输入。

实际上，`assert_eq!` 和 `assert_ne!` 宏分别使用 `==` 和 `!=` 运算符。当断言失败时，这些宏会使用调试格式打印其参数，这意味着被比较的值必须实现 `PartialEq` 和 `Debug` 特性。所有基本类型以及标准库中的大多数类型都实现了这些特性。对于你自己定义的结构体和枚举，你需要实现 `PartialEq` 以断言这些类型的相等性，还需要实现 `Debug` 以便在断言失败时打印值。由于这两个特性都是可派生特性，如第5章中的列表5-12所述，通常只需在结构体或枚举定义中添加 `#[derive(PartialEq, Debug)]` 注解即可。有关这些及其他可派生特性的更多细节，请参阅附录C [“可派生特性”](derivable-traits)。

### 添加自定义失败消息

您还可以添加自定义消息作为 `assert!`、`assert_eq!` 和 `assert_ne!` 宏的可选参数，以在失败消息中显示。在必需参数之后指定的任何参数都会传递给 `format!` 宏（详见第8章中的“使用 `+` 或 `format!` 进行拼接”部分），因此您可以传递包含 `{}` 占位符和对应值的格式字符串。自定义消息有助于说明断言的含义；当测试失败时，您能更清楚地了解代码中的问题所在。

例如，假设我们有一个根据姓名问候人的函数，我们希望测试传递给该函数的姓名是否出现在输出中：

<span class="filename">Filename: src/lib.rs</span>

```rust,noplayground
{{#rustdoc_include ../listings/ch11-writing-automated-tests/no-listing-05-greeter/src/lib.rs}}
```

目前该程序的要求尚未确定，而且我们非常确定问候语开头的 `Hello` 文本会发生变化。由于不想在需求变更时更新测试，因此我们不验证输出与 `greeting` 函数返回值是否完全相等，而是断言输出包含输入参数的文本。

现在，我们通过将 `greeting` 函数中的 `name` 排除掉来引入一个错误，以观察默认测试失败时的表现：

```rust,not_desired_behavior,noplayground
{{#rustdoc_include ../listings/ch11-writing-automated-tests/no-listing-06-greeter-with-bug/src/lib.rs:here}}
```

运行此测试会得到以下结果：

```console
{{#include ../listings/ch11-writing-automated-tests/no-listing-06-greeter-with-bug/output.txt}}
```

该结果仅表明断言失败以及失败的行号。更实用的失败消息会显示来自 `greeting` 函数的具体值。让我们添加一个由格式字符串组成的自定义失败消息，其中占位符被实际从 `greeting` 函数获取的值填充：

```rust,ignore
{{#rustdoc_include ../listings/ch11-writing-automated-tests/no-listing-07-custom-failure-message/src/lib.rs:here}}
```

现在运行测试时，我们会得到更有信息的错误提示：

```console
{{#include ../listings/ch11-writing-automated-tests/no-listing-07-custom-failure-message/output.txt}}
```

我们可以看到测试中实际得到的值，这有助于我们调试实际情况，而不是预期的情况。

### 使用 `should_panic` 检查异常

除了检查返回值之外，重要的是要确保我们的代码能够按预期处理错误情况。例如，考虑我们在第9章列表9-13中创建的`Guess`类型。使用`Guess`的其他代码依赖于一个保证，即`Guess`实例只包含1到100之间的值。我们可以编写一个测试，确保尝试创建超出该范围值的`Guess`实例时会导致恐慌。

我们通过在测试函数中添加`should_panic`属性来实现这一点。如果函数内的代码导致恐慌，则测试通过；如果函数内的代码没有导致恐慌，则测试失败。

列表11-8展示了一个测试，用于检查`Guess::new`的错误情况是否确实发生。

<Listing number="11-8" file-name="src/lib.rs" caption="Testing that a condition will cause a `panic!`">

```rust,noplayground
{{#rustdoc_include ../listings/ch11-writing-automated-tests/listing-11-08/src/lib.rs}}
```

</Listing>

我们将 `#[should_panic]` 属性放在 `#[test]` 属性之后、该测试函数之前。让我们看看这个测试通过时的结果：

```console
{{#include ../listings/ch11-writing-automated-tests/listing-11-08/output.txt}}
```

看起来很好！现在让我们通过在代码中移除当值大于100时`new`函数会导致恐慌的条件来引入一个错误。

```rust,not_desired_behavior,noplayground
{{#rustdoc_include ../listings/ch11-writing-automated-tests/no-listing-08-guess-with-bug/src/lib.rs:here}}
```

当我们运行列表11-8中的测试时，它会失败：

```console
{{#include ../listings/ch11-writing-automated-tests/no-listing-08-guess-with-bug/output.txt}}
```

在这种情况下我们不会得到非常有用的消息，但当我们查看测试函数时，发现它被标注为 `#[should_panic]`。我们的失败表明测试函数中的代码没有导致恐慌。

使用 `should_panic` 的测试可能不够精确。即使测试因与预期不同的原因而崩溃，`should_panic` 测试仍然会通过。为了使 `should_panic` 测试更加精确，我们可以向 `#[should_panic]` 属性添加一个可选的 `expected` 参数。测试框架将确保失败消息包含提供的文本。例如，考虑列表11-9中修改后的`Guess`代码，其中`new`函数根据值是否过小或过大而显示不同的恐慌信息。

<Listing number="11-9" file-name="src/lib.rs" caption="Testing for a `panic!` with a panic message containing a specified substring">

```rust,noplayground
{{#rustdoc_include ../listings/ch11-writing-automated-tests/listing-11-09/src/lib.rs:here}}
```

</Listing>

这个测试会通过，因为我们将 `should_panic` 属性的 `expected` 参数的值是 `Guess::new` 函数导致恐慌的消息的一个子串。我们本可以指定整个预期的恐慌消息，在这种情况下就是 `Guess value must be less than or equal to 100, got 200`。您选择指定什么取决于恐慌消息中有多少部分是唯一的或动态的，以及您希望测试有多精确。在这种情况下，恐慌消息中的一个子串就足以确保测试函数中的代码执行 `else if value > 100` 情况。

为了看看带有 `expected` 消息的 `should_panic` 测试失败时会发生什么，让我们再次通过交换 `if value < 1` 和 `else if value > 100` 块的内容来在代码中引入一个错误：

```rust,ignore,not_desired_behavior
{{#rustdoc_include ../listings/ch11-writing-automated-tests/no-listing-09-guess-with-panic-msg-bug/src/lib.rs:here}}
```

这次当我们运行 `should_panic` 测试时，它会失败：

```console
{{#include ../listings/ch11-writing-automated-tests/no-listing-09-guess-with-panic-msg-bug/output.txt}}
```

失败消息表明正如我们所预期的那样，测试确实引发了恐慌，但恐慌消息中并没有包含预期的字符串 `less than or equal to 100`。在这种情况下我们得到的恐慌消息是 `Guess value must be greater than or equal to 1, got 200`。现在我们可以开始找出我们的错误所在了！

### 在测试中使用 `Result<T, E>`

到目前为止，所有测试在失败时都会引发恐慌。我们也可以编写使用 `Result<T, E>` 的测试！这是列表 11-1 中的测试，被重写成使用 `Result<T, E>` 并返回 `Err` 而不是引发恐慌：

```rust,noplayground
{{#rustdoc_include ../listings/ch11-writing-automated-tests/no-listing-10-result-in-tests/src/lib.rs:here}}
```

`it_works` 函数的返回类型现在为 `Result<(), String>`。在函数的主体中，我们不再调用 `assert_eq!` 宏，而是在测试通过时返回 `Ok(())`，而在测试失败时返回包含 `String` 的 `Err`。

编写返回 `Result<T, E>` 的测试使得您可以在测试的主体中使用问号运算符，这是一种方便的方法，用于编写如果其中的任何操作返回 `Err` 变体则应该失败的测试。

在使用 `Result<T, E>` 的测试中，不能使用 `#[should_panic]` 注解。若要断言某个操作返回 `Err` 变体，不要在 `Result<T, E>` 值上使用问号运算符，而是使用 `assert!(value.is_err())`。

现在你已经知道了几种编写测试的方法，让我们看看运行测试时发生了什么，并探索在 `cargo test` 中可以使用的不同选项。

[concatenating]: ch08-02-strings.html#concatenating-with--or-format
[bench]: ../unstable-book/library-features/test.html
[ignoring]: ch11-02-running-tests.html#ignoring-tests-unless-specifically-requested
[subset]: ch11-02-running-tests.html#running-a-subset-of-tests-by-name
[controlling-how-tests-are-run]: ch11-02-running-tests.html#controlling-how-tests-are-run
[derivable-traits]: appendix-03-derivable-traits.html
[doc-comments]: ch14-02-publishing-to-crates-io.html#documentation-comments-as-tests
[paths-for-referring-to-an-item-in-the-module-tree]: ch07-03-paths-for-referring-to-an-item-in-the-module-tree.html
