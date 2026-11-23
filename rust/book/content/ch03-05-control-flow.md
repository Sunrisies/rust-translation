## 控制流

根据条件是否为“真”来运行某些代码，以及在条件为“真”时重复运行某些代码的能力，是大多数编程语言的基本构建块。在允许你控制 Rust 代码执行流程的最常见构造是 `if` 表达式和循环。

### `if` 表达式

`if` 表达式允许你根据条件分支代码。你提供一个条件，然后说明：“如果满足此条件，则运行此代码块；如果不满足，则不运行此代码块。”

在 `_projects_` 目录中创建一个名为 _branches_ 的新项目以探索 `if` 表达式。在 _src/main.rs_ 文件中输入以下内容：

<span class="filename">Filename: src/main.rs</span>

```rust
{{#rustdoc_include ../listings/ch03-common-programming-concepts/no-listing-26-if-true/src/main.rs}}
```

所有 `if` 表达式都以关键字 `if` 开头，后跟一个条件。在这种情况下，条件检查变量 `number` 的值是否小于 5。我们将当条件为“真”时要执行的代码块直接放在条件内部的花括号中。与 `if` 表达式中的条件相关的代码块有时被称为 _分支_，就像我们在第 2 章的 [“比较猜测与秘密数字”](comparing-the-guess-to-the-secret-number)<!-- ignore --> 部分讨论的 `match` 表达式中的 _分支_ 一样。

可选地，我们还可以包含一个 `else` 表达式，在这里我们选择这样做，以便在条件评估为“假”时提供另一个代码块让程序执行。如果你不提供 `else` 表达式且条件为“假”，程序将跳过 `if` 块并继续执行下一段代码。

尝试运行此代码；你应该会看到以下输出：

```console
{{#include ../listings/ch03-common-programming-concepts/no-listing-26-if-true/output.txt}}
```

让我们试着将 `number` 的值改为使条件变为“假”的值，看看会发生什么：

```rust,ignore
{{#rustdoc_include ../listings/ch03-common-programming-concepts/no-listing-27-if-false/src/main.rs:here}}
```

再次运行程序，并查看输出：

```console
{{#include ../listings/ch03-common-programming-concepts/no-listing-27-if-false/output.txt}}
```

还值得注意的是，此代码中的条件_必须_是 `bool` 类型。如果条件不是 `bool` 类型，我们将收到错误。例如，尝试运行以下代码：

<span class="filename">Filename: src/main.rs</span>

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch03-common-programming-concepts/no-listing-28-if-condition-must-be-bool/src/main.rs}}
```

这次 `if` 条件的评估值为 `3`，Rust 会抛出错误：

```console
{{#include ../listings/ch03-common-programming-concepts/no-listing-28-if-condition-must-be-bool/output.txt}}
```

该错误表明 Rust 期望一个 `bool` 类型，但实际得到了一个整数。与 Ruby 和 JavaScript 等语言不同，Rust 不会自动将非布尔类型转换为布尔值。你必须明确指定，并且始终让 `if` 语句的条件为布尔值。例如，如果我们希望 `if` 代码块仅在数字不等于 `0` 时运行，可以将 `if` 表达式改为如下形式：

<span class="filename">Filename: src/main.rs</span>

```rust
{{#rustdoc_include ../listings/ch03-common-programming-concepts/no-listing-29-if-not-equal-0/src/main.rs}}
```

运行此代码会输出 `number was something other than zero`。

#### 使用 `else if` 处理多个条件

你可以通过在 `else if` 表达式中结合 `if` 和 `else` 来使用多个条件。例如：

<span class="filename">Filename: src/main.rs</span>

```rust
{{#rustdoc_include ../listings/ch03-common-programming-concepts/no-listing-30-else-if/src/main.rs}}
```

该程序有四种可能的执行路径。运行后，你应该看到以下输出：

```console
{{#include ../listings/ch03-common-programming-concepts/no-listing-30-else-if/output.txt}}
```

当该程序执行时，它会依次检查每个 `if` 表达式，并执行第一个条件为 `true` 的语句体。请注意，尽管 6 可以被 2 整除，但我们没有看到 `number is divisible by 2` 的输出，也没有看到来自 `else` 块的 `number is not divisible by 4, 3, or 2` 文本。这是因为 Rust 只执行第一个 `true` 条件的语句块，一旦找到一个满足条件的条件，就不再检查其他条件。

使用过多的 `else if` 表达式会使代码变得混乱，因此如果使用了多个 `else if`，你可能需要重构代码。第 6 章介绍了一种强大的 Rust 分支结构 `match`，适用于这种情况。

#### 在 `let` 语句中使用 `if`

因为 `if` 是一个表达式，我们可以在 `let` 语句的右边使用它来将结果赋值给变量，如清单 3-2 所示。

<Listing number="3-2" file-name="src/main.rs" caption="Assigning the result of an `if` expression to a variable">

```rust
{{#rustdoc_include ../listings/ch03-common-programming-concepts/listing-03-02/src/main.rs}}
```

</Listing>

`number` 变量将根据 `if` 表达式的结果绑定到一个值。运行此代码以查看会发生什么：

```console
{{#include ../listings/ch03-common-programming-concepts/listing-03-02/output.txt}}
```

请记住，代码块的计算结果取决于其最后的表达式，而数字本身也是表达式。在这种情况下，整个 `if` 表达式的值取决于哪个代码块被执行。这意味着 `if` 的每个分支可能产生的结果必须具有相同的类型；在清单 3-2 中，`if` 分支和 `else` 分支的结果都是 `i32` 整数。如果类型不匹配，如以下示例所示，将会出现错误：

<span class="filename">Filename: src/main.rs</span>

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch03-common-programming-concepts/no-listing-31-arms-must-return-same-type/src/main.rs}}
```

当我们尝试编译这段代码时，会得到一个错误。`if` 和 `else` 分支的值类型为不兼容，Rust 会在程序中明确指出问题所在：

```console
{{#include ../listings/ch03-common-programming-concepts/no-listing-31-arms-must-return-same-type/output.txt}}
```

`if` 块中的表达式计算结果为整数，而 `else` 块中的表达式计算结果为字符串。这是不可行的，因为变量必须具有单一类型，且 Rust 需要在编译时明确知道 `number` 变量的类型。了解 `number` 的类型使得编译器能够在使用 `number` 的所有地方验证该类型是否有效。如果 `number` 的类型仅在运行时确定，Rust 将无法做到这一点；编译器会变得更加复杂，并且对于代码提供的保证也会减少，因为它必须跟踪任意变量的多种假设类型。

### 使用循环进行重复

通常执行代码块多次是有用的。对于这项任务，Rust 提供了几种_循环_，它们会在循环体内部运行到末尾后立即从开始处重新开始。为了尝试循环，让我们创建一个名为 _loops_ 的新项目。

Rust 有三种类型的循环：`loop`、`while` 和 `for`。让我们分别尝试每一种。

#### 使用 `loop` 重复代码

`loop` 关键字告诉 Rust 反复执行代码块，直到永远或直到你明确停止为止。

例如，将 _loops_ 目录中的 _src/main.rs_ 文件修改如下：

<span class="filename">Filename: src/main.rs</span>

```rust,ignore
{{#rustdoc_include ../listings/ch03-common-programming-concepts/no-listing-32-loop/src/main.rs}}
```

当我们运行这个程序时，会看到 `again!` 不断重复打印，直到我们手动停止程序。大多数终端都支持键盘快捷键
<kbd>ctrl</kbd>-<kbd>C</kbd> to interrupt a program that is stuck in a continual
loop。试试看：

<!-- manual-regeneration
cd listings/ch03-common-programming-concepts/no-listing-32-loop cargo run CTRL-C -->

```console
$ cargo run
   Compiling loops v0.1.0 (file:///projects/loops)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.08s
     Running `target/debug/loops`
again!
again!
again!
again!
^Cagain!
```

符号 `^C` 表示您按下 <kbd>ctrl</kbd>-<kbd>c</kbd> 的位置。

根据代码在循环中被中断信号触发时的位置，您可能会看到或不会看到 `again!` 这个词。

幸运的是，Rust 也提供了使用代码跳出循环的方法。您可以在循环内添加 `break` 关键字，以指示程序何时停止执行循环。回想一下，我们在第2章的“猜对后退出”部分中的猜谜游戏中使用了这种方法，当用户猜出正确数字时，通过退出程序来实现。

我们在猜谜游戏中也使用了 `continue`，在循环中告诉程序跳过本次迭代中的剩余代码，并进入下一次迭代。

#### 从循环返回值

`loop` 的一个用途是重新执行您知道可能失败的操作，例如检查线程是否完成其任务。您也可能需要在循环外将该操作的结果传递给其余代码。为此，可以在用于停止循环的 `break` 表达式之后添加您希望返回的值；该值将从循环中返回，以便您可以使用它，如下所示：

```rust
{{#rustdoc_include ../listings/ch03-common-programming-concepts/no-listing-33-return-value-from-loop/src/main.rs}}
```

在循环之前，我们声明一个名为 `counter` 的变量并将其初始化为 `0`。然后，我们声明一个名为 `result` 的变量来保存从循环返回的值。在循环的每次迭代中，我们将 `1` 加到 `counter` 变量上，然后检查 `counter` 是否等于 `10`。当等于时，我们使用 `break` 关键字并将值设为 `counter * 2`。循环结束后，我们使用分号结束将值赋给 `result` 的语句。最后，我们打印 `result` 中的值，在本例中为 `20`。

您也可以在循环内使用 `return` 退出。虽然 `break` 仅退出当前循环，`return` 则总是退出当前函数。

<!-- Old headings. Do not remove or links may break. -->
<a id="loop-labels-to-disambiguate-between-multiple-loops"></a>

#### 使用循环标签消除歧义

如果您在循环内部再套用循环，`break` 和 `continue` 仅适用于最内层的循环。您可以选择为某个循环指定一个 _循环标签_，然后利用 `break` 或 `continue` 来指定这些关键字适用于该带标签的循环而非最内层循环。循环标签必须以单引号开头。以下是一个包含两个嵌套循环的示例：

```rust
{{#rustdoc_include ../listings/ch03-common-programming-concepts/no-listing-32-5-loop-labels/src/main.rs}}
```

外层循环带有 `'counting_up'` 标签，它会从 0 计数到 2。没有标签的内层循环则从 10 递减到 9。第一个未指定标签的 `break` 仅会退出内层循环。`break 'counting_up;`` 语句则会退出外层循环。此代码将输出：

```console
{{#rustdoc_include ../listings/ch03-common-programming-concepts/no-listing-32-5-loop-labels/output.txt}}
```

<!-- Old headings. Do not remove or links may break. -->
<a id="conditional-loops-with-while"></a>

#### 使用 while 简化条件循环

程序通常需要在循环中评估某个条件。当条件为 `true` 时，循环就会执行。当条件不再为 `true` 时，程序会调用 `break`，从而停止循环。可以通过结合使用 `loop`、`if`、`else` 和 `break` 来实现这种行为；如果您愿意，现在就可以在程序中尝试这样做。不过，这种模式非常常见，Rust 提供了一种内置的语言结构称为 `while` 循环。在清单 3-3 中，我们使用 `while` 让程序重复运行三次，每次都在递减计数，然后在循环结束后打印一条消息并退出。

<Listing number="3-3" file-name="src/main.rs" caption="Using a `while` loop to run code while a condition evaluates to `true`">

```rust
{{#rustdoc_include ../listings/ch03-common-programming-concepts/listing-03-03/src/main.rs}}
```

</Listing>

这种结构消除了使用 `loop`、`if`、`else` 和 `break` 时所需的大量嵌套，并且更加清晰。当条件为 `true` 时，代码会执行；否则，就会退出循环。

#### 使用 for 遍历集合

您可以选择使用 `while` 结构来遍历集合中的元素，例如数组。例如，清单 3-4 中的循环会打印数组 `a` 中的每个元素。

<Listing number="3-4" file-name="src/main.rs" caption="Looping through each element of a collection using a `while` loop">

```rust
{{#rustdoc_include ../listings/ch03-common-programming-concepts/listing-03-04/src/main.rs}}
```

</Listing>

在这里，代码通过数组中的元素进行递增计数。它从索引 `0` 开始，然后循环直到到达数组的最后一个索引（即当 `index < 5` 不再为 `true` 时）。运行此代码将输出数组中的所有元素：

```console
{{#include ../listings/ch03-common-programming-concepts/listing-03-04/output.txt}}
```

正如预期，五个数组值都出现在终端中。尽管 `index` 最终会达到 `5` 的值，但循环在尝试从数组中获取第六个值之前就停止了执行。

然而，这种方法容易出错；如果索引值或测试条件不正确，程序可能会崩溃。例如，如果你将 `a` 数组的定义改为包含四个元素，却忘记更新条件为 `while index < 4`，代码就会崩溃。此外，这种方法也较慢，因为编译器会在每次循环迭代时添加运行时代码来检查索引是否在数组的边界内。

作为更简洁的替代方案，你可以使用 `for` 循环，并对集合中的每个项执行一些代码。`for` 循环的写法类似于清单 3-5 中的代码。

<Listing number="3-5" file-name="src/main.rs" caption="Looping through each element of a collection using a `for` loop">

```rust
{{#rustdoc_include ../listings/ch03-common-programming-concepts/listing-03-05/src/main.rs}}
```

</Listing>

运行此代码后，我们会看到与清单 3-4 中相同的输出。更重要的是，我们现在提高了代码的安全性，并消除了因超出数组末尾或未遍历足够多的项而出现的错误可能性。由 `for` 循环生成的机器码也更高效，因为每次迭代时不需要将索引与数组长度进行比较。

使用 `for` 循环时，如果数组中的值数量发生变化，无需像清单 3-4 中使用的方法那样记住修改其他代码。

`for` 循环的安全性和简洁性使其成为 Rust 中最常用的循环结构。即使在需要重复执行某些代码若干次的情况下，如清单 3-3 中使用 `while` 循环的倒计时示例，大多数 Rust 开发者也会使用 `for` 循环。实现这一点的方法是使用标准库提供的 `Range`，它生成从一个数开始到另一个数之前的所有连续数字。

以下是使用 `for` 循环和另一种我们尚未讨论的方法 `rev`（反转范围）实现的倒计时效果：

<span class="filename">Filename: src/main.rs</span>

```rust
{{#rustdoc_include ../listings/ch03-common-programming-concepts/no-listing-34-for-range/src/main.rs}}
```

这段代码看起来更简洁，不是吗？

## 总结

你成功了！这一章内容相当丰富：你学习了变量、标量与复合数据类型、函数、注释、`if` 表达式以及循环！为了练习本章所讨论的概念，尝试构建以下程序：

- 将温度从华氏度转换为摄氏度。
- 生成第 *n* 个斐波那契数。
- 利用圣诞颂歌“The Twelve Days of Christmas”中的重复结构，打印其歌词。

当你准备好继续学习时，我们将讨论 Rust 中的一个概念，这在其他编程语言中并不常见：所有权机制。

[comparing-the-guess-to-the-secret-number]: ch02-00-guessing-game-tutorial.html#comparing-the-guess-to-the-secret-number
[quitting-after-a-correct-guess]: ch02-00-guessing-game-tutorial.html#quitting-after-a-correct-guess
