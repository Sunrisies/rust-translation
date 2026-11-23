## 所有地方都可以使用模式

在 Rust 中，模式出现在许多地方，你可能在不经意间就大量使用了它们！本节将讨论模式适用的所有场景。

### `match` 分支

如第 6 章所述，我们在 `match` 表达式的分支中使用模式。正式来说，`match` 表达式由关键字 `match`、`要匹配的值` 以及一个或多个匹配分支组成，每个匹配分支包含一种模式以及当值符合该分支模式时执行的表达式，如下所示：

<!--
  手动格式化而非故意使用 Markdown：Markdown 不支持在块体内容中斜体显示代码！ -->

<pre><code>match <em>VALUE</em> {
    <em>PATTERN</em> => <em>EXPRESSION</em>,
    <em>PATTERN</em> => <em>EXPRESSION</em>,
    <em>PATTERN</em> => <em>EXPRESSION</em>,
}</code></pre>

例如，这是列表 6-5 中的 `match` 表达式，它匹配变量 `x` 中的 `Option<i32>` 值：

```rust,ignore
match x {
    None => None,
    Some(i) => Some(i + 1),
}
```

此 `match` 表达式中的模式是每个箭头左侧的 `None` 和 `Some(i)`。

`match` 表达式的一个要求是必须全面覆盖所有可能性，即 `match` 表达式中值的所有可能情况都必须被考虑。确保涵盖所有可能性的一种方法是为最后一个分支设置一个通用模式：例如，任何值都能匹配的变量名永远不会失败，因此可以覆盖所有剩余的情况。

特定的模式 `_` 可以匹配任何内容，但它不会绑定到变量，因此常用于最后一个匹配分支。`_` 模式在需要忽略未指定值的场景时非常有用。我们将在本章的 [“在模式中忽略值”][ignoring-values-in-a-pattern]<!-- ignore --> 部分更详细地讨论 `_` 模式。

### `let` 语句

在本章之前，我们仅明确讨论了使用 `match` 和 `if let` 中的模式，但实际上我们在其他地方也使用了模式，包括 `let` 语句中。例如，考虑这个简单的 `let` 变量赋值：

```rust
let x = 5;
```

每次你使用这样的 `let` 语句时，实际上都在使用模式，尽管你可能没有意识到！更正式地说，`let` 语句看起来如下：

<!--
  故意不使用 Markdown，而是手动格式化：由于这种块中的代码无法使用 Markdown 进行斜体处理！ -->

<pre>
<code>let <em>PATTERN</em> = <em>EXPRESSION</em>;</code>
</pre>

在类似 `let x = 5;` 的语句中，当模式槽位包含变量名时，该变量名只是一种非常简单的模式形式。Rust 会将表达式与模式进行比较，并分配找到的任何名称。因此，在 `let x = 5;` 示例中，`x` 是一个模式，表示“将此处匹配的值绑定到变量 `x`”。由于 `x` 是整个模式，这个模式实际上意味着“将所有值绑定到变量 `x`，无论其值是什么。”

为了更清晰地看到 `let` 的模式匹配特性，请参考列表 19-1，其中使用带有 `let` 的模式来解构元组。


<Listing number="19-1" caption="Using a pattern to destructure a tuple and create three variables at once">

```rust
{{#rustdoc_include ../listings/ch19-patterns-and-matching/listing-19-01/src/main.rs:here}}
```

</Listing>

在这里，我们将一个元组与模式进行匹配。Rust 会将值 `(1, 2, 3)` 与模式 `(x, y, z)` 进行比较，发现该值与模式匹配——即两个中的元素数量相同——因此 Rust 将 `1` 绑定到 `x`，`2` 绑定到 `y`，`3` 绑定到 `z`。你可以将这种元组模式视为内部嵌套了三个独立的变量模式。

如果模式中的元素数量与元组中元素的数量不匹配，整体类型就不匹配，我们将收到编译器错误。例如，列表 19-2 展示了试图将具有三个元素的元组分解为两个变量的尝试，这是无效的。

<Listing number="19-2" caption="Incorrectly constructing a pattern whose variables don’t match the number of elements in the tuple">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch19-patterns-and-matching/listing-19-02/src/main.rs:here}}
```

</Listing>

尝试编译此代码会导致以下类型错误：

```console
{{#include ../listings/ch19-patterns-and-matching/listing-19-02/output.txt}}
```

要修复错误，我们可以使用 `_` 或 `..` 忽略元组中的一个或多个值，如“在模式中忽略值”部分所述。如果问题是模式中的变量过多，解决方案是通过移除变量使类型匹配，从而确保变量的数量等于元组中元素的数量。

### 条件性 `if let` 表达式

在第六章中，我们讨论了如何使用 `if let` 表达式，主要是作为一种更简洁的方式来表示仅匹配一个情况的 `match` 表达式。可选地，`if let` 可以有一个对应的 `else` 部分，用于在 `if let` 的模式不匹配时执行代码。

清单 19-3 显示，也可以混合使用 `if let`、`else if` 和 `else if let` 表达式。这样做比使用 `match` 表达式更加灵活，因为 `match` 只能表达一个值与模式进行比较。此外，Rust 并不要求一系列 `if let`、`else if` 和 `else if let` 分支中的条件之间具有相关性。

清单 19-3 中的代码根据多个条件的检查来确定背景颜色。在这个示例中，我们创建了带有硬编码值的变量，这些值可能是真实程序从用户输入中接收的。

<Listing number="19-3" file-name="src/main.rs" caption="Mixing `if let`, `else if`, `else if let`, and `else`">

```rust
{{#rustdoc_include ../listings/ch19-patterns-and-matching/listing-19-03/src/main.rs}}
```

</Listing>

如果用户指定了喜欢的颜色，该颜色将作为背景使用。如果没有指定喜欢的颜色且今天是星期二，背景颜色为绿色。否则，如果用户以字符串形式指定年龄并且能够成功解析为整数，颜色则根据数值的不同变为紫色或橙色。如果以上条件都不适用，背景颜色为蓝色。

这种条件结构使我们能够支持复杂的需求。由于这里使用了硬编码值，该示例将输出 `Using purple as the background color`。

可以看到，`if let` 也可以引入新的变量来遮蔽现有的变量，就像 `match` 分支一样。代码行 `if let Ok(age) = age` 引入了一个新的 `age` 变量，它包含 `Ok` 变体中的值，从而遮蔽了现有的 `age` 变量。这意味着我们需要将 `if age > 30` 条件放在该块中：我们不能将这两个条件合并为 `if let Ok(age) = age && age > 30`。在花括号开始的新作用域中，用于与 30 比较的新 `age` 值才有效。

使用 `if let` 表达式的缺点是编译器不会检查完备性，而使用 `match` 表达式则会进行检查。如果我们省略最后一个 `else` 块，从而错过某些情况的处理，编译器不会提示我们可能存在逻辑错误。

### `while let` 条件循环

与 `if let` 结构类似，`while let` 条件循环允许 `while` 循环在模式持续匹配时继续运行。在列表 19-4 中，我们展示了一个等待线程间发送消息的 `while let` 循环，但这次是检查 `Result` 而不是 `Option`。

<Listing number="19-4" caption="Using a `while let` loop to print values for as long as `rx.recv()` returns `Ok`">

```rust
{{#rustdoc_include ../listings/ch19-patterns-and-matching/listing-19-04/src/main.rs:here}}
```

</Listing>

这个示例会打印 `1`、`2`，然后打印 `3`。`recv` 方法从通道接收端取出第一条消息，并返回 `Ok(value)`。我们在第 16 章中第一次看到 `recv` 时，直接解包错误值，或者使用 `for` 循环将其作为迭代器处理。然而，如列表 19-4 所示，我们也可以使用 `while let`，因为 `recv` 方法在消息到达时每次都会返回 `Ok`，只要发送者存在；当发送端断开连接时则返回 `Err`。

### `for` 循环

在 `for` 循环中，`for` 关键字后面的值就是模式。例如，在 `for x in y` 中，`x` 就是模式。列表 19-5 展示了如何在 `for` 循环中使用模式来解构或拆分元组。


<Listing number="19-5" caption="Using a pattern in a `for` loop to destructure a tuple">

```rust
{{#rustdoc_include ../listings/ch19-patterns-and-matching/listing-19-05/src/main.rs:here}}
```

</Listing>

列表 19-5 中的代码将输出以下内容：


```console
{{#include ../listings/ch19-patterns-and-matching/listing-19-05/output.txt}}
```

我们使用 `enumerate` 方法对迭代器进行适配，使其生成值及其索引，并将它们放入一个元组中。第一个生成的元组是 `(0, 'a')`。当这个值与模式 `(index, value)` 匹配时，索引将为 `0`，值为 `'a'`，从而输出输出的第一行。


### 函数参数

函数参数也可以作为模式。列表 19-6 中的代码声明了一个名为 `foo` 的函数，它接受一个名为 `x` 的参数，类型为 `i32`，现在应该看起来很熟悉了。

<Listing number="19-6" caption="A function signature using patterns in the parameters">

```rust
{{#rustdoc_include ../listings/ch19-patterns-and-matching/listing-19-06/src/main.rs:here}}
```

</Listing>

`x` 部分是一个模式！就像我们对 `let` 所做的那样，我们可以将函数参数中的元组与模式进行匹配。清单 19-7 在我们将元组的值传递给函数时将其拆分。

<Listing number="19-7" file-name="src/main.rs" caption="A function with parameters that destructure a tuple">

```rust
{{#rustdoc_include ../listings/ch19-patterns-and-matching/listing-19-07/src/main.rs}}
```

</Listing>

此代码输出 `Current location: (3, 5)`。值 `&(3, 5)` 与模式 `&(x, y)` 匹配，因此 `x` 是值 `3`，`y` 是值 `5`。

我们也可以在闭包参数列表中使用模式，就像在函数参数列表中使用一样，因为正如第 13 章所讨论的，闭包与函数类似。

目前，你已经看到了几种使用模式的方法，但模式在不同场景下的表现并不相同。在某些场景下，模式必须是不可更改的；在其他情况下，它们则可以被更改。我们将在接下来讨论这两个概念。

[ignoring-values-in-a-pattern]: ch19-03-pattern-syntax.html#ignoring-values-in-a-pattern
