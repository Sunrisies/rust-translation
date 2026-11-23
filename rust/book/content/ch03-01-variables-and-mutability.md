## 变量与可变性

如[“使用变量存储值”](storing-values-with-variables)部分所述，默认情况下变量是不可变的。这是 Rust 为了让你以利用其安全性和便捷并发特性来编写代码而提供的诸多提示之一。不过，你仍然可以选择使变量变为可变。让我们探讨一下 Rust 为何鼓励你偏好不可变性，以及为什么有时你可能希望放弃这种可变性。

当一个变量不可变时，一旦某个值被绑定到名称上，你就无法更改该值。为了说明这一点，可以在 _projects_ 目录中使用 `cargo new variables` 创建一个名为 _variables_ 的新项目。

然后，在新的 _variables_ 目录中，打开 _src/main.rs_ 并替换其代码为以下代码（目前无法编译）：

<span class="filename">Filename: src/main.rs</span>

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch03-common-programming-concepts/no-listing-01-variables-are-immutable/src/main.rs}}
```

保存并运行程序，使用 `cargo run`。你应该会收到关于不可变性错误的错误信息，如以下输出所示：

```console
{{#include ../listings/ch03-common-programming-concepts/no-listing-01-variables-are-immutable/output.txt}}
```

这个示例展示了编译器如何帮助你发现程序中的错误。编译器错误可能会令人沮丧，但实际上它们只意味着你的程序尚未安全地执行预期功能；这并不意味着你不是优秀的程序员！有经验的 Rust 开发者仍然会遇到编译器错误。

你收到错误信息 `` cannot assign twice to immutable variable `x` ``，是因为你试图将第二个值赋给不可变的 `x` 变量。

当我们尝试修改被定义为不可变的值时，出现编译时错误非常重要，因为这种情况很容易导致错误。如果代码的一部分假设某个值永远不会改变，而另一部分则改变了该值，那么第一部分代码可能无法按设计那样执行。这种错误的原因在事后很难追踪，尤其是当第二部分代码只是_偶尔_改变该值时。Rust 编译器保证当你声明某个值不会改变时，它确实不会改变，因此你无需自己跟踪它。这样你的代码就更容易理解。

但可变性非常有用，可以使代码更易于编写。虽然变量默认是不可变的，但你可以通过在变量名前添加 `mut` 来使其可变，就像在[第2章][storing-values-with-variables]中那样。添加 `mut` 还能向未来的读者传达意图，表明代码的其他部分将会改变该变量的值。

例如，让我们将 _src/main.rs_ 改为如下内容：

<span class="filename">Filename: src/main.rs</span>

```rust
{{#rustdoc_include ../listings/ch03-common-programming-concepts/no-listing-02-adding-mut/src/main.rs}}
```

现在运行程序后，我们得到以下结果：

```console
{{#include ../listings/ch03-common-programming-concepts/no-listing-02-adding-mut/output.txt}}
```

当使用 `mut` 时，我们允许将绑定到 `x` 的值从 `5` 改为 `6`。最终是否使用可变性由你决定，取决于你认为哪种情况最清晰。

<!-- Old headings. Do not remove or links may break. -->
<a id="constants"></a>

### 声明常量

与不可变变量一样，_常量_是绑定到一个名称且不允许更改的值，但常量和变量之间存在一些差异。

首先，你不能对常量使用 `mut`。常量不仅默认是不可变的——它们总是不可变的。你使用 `const` 关键字而不是 `let` 关键字来声明常量，并且值的类型必须被标注。我们将在下一节[“数据类型”][data-types]中讨论类型和类型标注，所以现在不必担心这些细节。只需知道你必须始终标注类型即可。

常量可以在任何作用域中声明，包括全局作用域，这使得它们适用于代码多个部分需要知晓的值。

最后一个区别是，常量只能被设置为常量表达式，而不能设置为仅在运行时计算得到的值的结果。

以下是常量声明的示例：

```rust
const THREE_HOURS_IN_SECONDS: u32 = 60 * 60 * 3;
```

该常量的名称为 `THREE_HOURS_IN_SECONDS`，其值是通过将 60（一分钟中的秒数）乘以 60（一小时中的分钟数）再乘以 3（本程序中要计算的小时数）得到的结果。Rust 对常量命名的规定是全部使用大写字母，单词之间使用下划线分隔。编译器能够在编译时评估有限的操作集，这使我们能够以更易于理解和验证的方式编写该值，而不是将此常量设置为 10,800 这个值。有关在声明常量时可使用的操作的信息，请参阅 [Rust Reference 的常量评估部分][const-eval]。

只要程序在其声明的范围内运行，常量就始终有效。这一特性使得常量适用于应用程序领域中多个部分可能需要知晓的值，例如游戏中任何玩家允许获得的最大分数或光速。

将程序中使用的硬编码值命名为常量，有助于向未来的代码维护者传达该值的含义。此外，如果硬编码值将来需要更新，只需在代码中更改一个地方即可，这也很方便。

### 遮蔽

正如你在[第2章][comparing-the-guess-to-the-secret-number]中的猜谜游戏教程中看到的那样，你可以声明一个与之前变量同名的新变量。 Rust 专家说第一个变量被第二个变量_遮蔽_了，这意味着当你使用该变量名时，编译器会看到的是第二个变量。实际上，第二个变量遮蔽了第一个变量，它会将任何对变量名的使用都视为自身的使用，直到它自己被遮蔽或作用域结束为止。我们可以通过使用相同的变量名并重复使用 `let` 关键字来遮蔽一个变量：

<span class="filename">Filename: src/main.rs</span>

```rust
{{#rustdoc_include ../listings/ch03-common-programming-concepts/no-listing-03-shadowing/src/main.rs}}
```

这个程序首先将 `x` 绑定为值 `5`。然后，通过重复执行 `let x =`，它创建了一个新的变量 `x`，取原始值并加上 `1`，使得 `x` 的值变为 `6`。接着，在由花括号创建的内层作用域中，第三个 `let` 语句同样遮蔽了 `x` 并创建了一个新变量，将之前的值乘以 `2`，使 `x` 的值变为 `12`。当该作用域结束时，内部遮蔽结束，`x` 又恢复为 `6` 的值。当我们运行这个程序时，它将输出以下内容：

```console
{{#include ../listings/ch03-common-programming-concepts/no-listing-03-shadowing/output.txt}}
```

遮蔽与将变量标记为 `mut` 不同，因为如果我们不小心尝试在不使用 `let` 关键字的情况下重新赋值给这个变量，我们将在编译时遇到错误。通过使用 `let`，我们可以对值进行一些转换，但在这些转换完成后，该变量仍然是不可变的。

`mut` 和遮蔽之间的另一个区别是，当我们再次使用 `let` 关键字时，实际上是在创建一个新的变量，因此我们可以改变值的类型，但可以使用相同的名称。例如，假设我们的程序要求用户通过输入空格字符来指定某些文本之间的空格数，然后我们希望将该输入存储为一个数字：

```rust
{{#rustdoc_include ../listings/ch03-common-programming-concepts/no-listing-04-shadowing-can-change-types/src/main.rs:here}}
```

第一个 `spaces` 变量是字符串类型，第二个 `spaces` 变量是数字类型。通过遮蔽（shadowing）机制，我们无需使用不同的名称，如 `spaces_str` 和 `spaces_num`，而是可以重复使用更简单的 `spaces` 名称。然而，如果我们像这里所示尝试使用 `mut`，将会出现编译时错误：

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch03-common-programming-concepts/no-listing-05-mut-cant-change-types/src/main.rs:here}}
```

错误提示表明不允许修改变量的类型：

```console
{{#include ../listings/ch03-common-programming-concepts/no-listing-05-mut-cant-change-types/output.txt}}
```

现在我们已经了解了变量的工作原理，接下来让我们看看它们可以具有的更多数据类型。

[comparing-the-guess-to-the-secret-number]: ch02-00-guessing-game-tutorial.html#comparing-the-guess-to-the-secret-number
[data-types]: ch03-02-data-types.html#data-types
[storing-values-with-variables]: ch02-00-guessing-game-tutorial.html#storing-values-with-variables
[const-eval]: ../reference/const_eval.html
