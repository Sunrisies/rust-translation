## 可证伪性：模式是否可能不匹配

模式有两种形式：可证伪的和不可证伪的。对于传入的任何可能值都能匹配的模式属于_不可证伪的_。例如，在语句 `let x = 5;` 中的 `x`，因为 `x` 可以匹配任何值，因此不可能不匹配。而对于某些可能的值可能会不匹配的模式则属于_可证伪的_。例如，在表达式 `if let Some(x) = a_value` 中的 `Some(x)`，如果 `a_value` 变量中的值为 `None` 而不是 `Some`，那么 `Some(x)` 模式就不会匹配。

函数参数、`let` 语句和 `for` 循环只能接受不可证伪的模式，因为当值不匹配时程序无法执行任何有意义的操作。`if let` 和 `while let` 表达式以及 `let...else` 语句可以接受可证伪和不可证伪的模式，但编译器会警告使用不可证伪模式，因为从定义上来看，它们旨在处理可能的失败情况：条件功能在于根据成功或失败的不同表现方式来执行不同的操作。

通常来说，不必担心可证伪和不可证伪模式的区别；然而，你需要熟悉可证伪性的概念，以便在看到错误消息时能够应对。在这种情况下，你需要根据代码的预期行为，修改模式或与之结合的构造。

让我们来看一个例子，说明当尝试使用可证伪模式而 Rust 要求不可证伪模式时会发生什么，反之亦然。列表 19-8 显示了一个 `let` 语句，但针对该模式，我们指定了 `Some(x)`，即一个可证伪模式。正如你所预期的，这段代码无法编译。

<Listing number="19-8" caption="Attempting to use a refutable pattern with `let`">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch19-patterns-and-matching/listing-19-08/src/main.rs:here}}
```

</Listing>

如果 `some_option_value` 是一个 `None` 值，它将无法匹配模式 `Some(x)`，这意味着该模式是可证伪的。然而，`let` 语句只能接受不可证伪的模式，因为对于 `None` 值，代码没有有效的处理方式。在编译时，Rust 会报错，指出我们试图使用可证伪模式而实际上需要不可证伪模式。

```console
{{#include ../listings/ch19-patterns-and-matching/listing-19-08/output.txt}}
```

由于我们没有覆盖（也无法覆盖！）所有符合 `Some(x)` 模式的合法值，Rust 因此会正确地产生编译器错误。

如果有一个可验证的模式而需要不可验证的模式，我们可以通过修改使用该模式的函数来修复它：可以使用 `let...else` 代替 `let`。这样，当模式不匹配时，花括号中的代码将处理该值。列表 19-9 展示了如何修复列表 19-8 中的代码。

<Listing number="19-9" caption="Using `let...else` and a block with refutable patterns instead of `let`">

```rust
{{#rustdoc_include ../listings/ch19-patterns-and-matching/listing-19-09/src/main.rs:here}}
```

</Listing>

我们已经给出了一个解决方案！这段代码完全有效，但这意味着在不收到警告的情况下无法使用不可验证的模式。如果我们给 `let...else` 提供一个总是匹配的模式，例如列表 19-10 中显示的 `x`，编译器将会发出警告。

<Listing number="19-10" caption="Attempting to use an irrefutable pattern with `let...else`">

```rust
{{#rustdoc_include ../listings/ch19-patterns-and-matching/listing-19-10/src/main.rs:here}}
```

</Listing>

Rust 指出，在不可验证模式下使用 `let...else` 是没有意义的，因为 `else` 永远不会被到达：

```console
{{#include ../listings/ch19-patterns-and-matching/listing-19-10/output.txt}}
```

因此，除了最后一个分支外，所有 `match` 分支必须使用可验证模式。Rust 允许在只有一个分支的 `match` 中使用不可验证模式，但这种语法并不特别有用，可以用更简单的 `let` 语句替代。

现在你知道了在哪里使用模式以及可验证与不可验证模式之间的区别，让我们来介绍所有可以用来创建模式的语法。
