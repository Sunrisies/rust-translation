## 函数

函数在 Rust 代码中非常常见。你已经看到了该语言中最重要的函数之一：`main` 函数，它是许多程序的入口点。你还见过 `fn` 关键字，它用于声明新函数。

Rust 代码采用 _蛇形命名法_ 作为函数和变量命名的常规风格，即所有字母均为小写，下划线用于分隔单词。以下是一个包含示例函数定义的程序：

<span class="filename">Filename: src/main.rs</span>

```rust
{{#rustdoc_include ../listings/ch03-common-programming-concepts/no-listing-16-functions/src/main.rs}}
```

在 Rust 中定义函数时，需先输入 `fn` 后跟函数名和一组括号。花括号告诉编译器函数的主体从何处开始到何处结束。

我们可以通过输入函数名后跟一组括号来调用已定义的函数。由于 `another_function` 在程序中被定义，因此可以在 `main` 函数内部调用它。注意，我们在源代码中是在 `main` 函数之后才定义 `another_function`；也可以在其之前定义。Rust 并不关心你在哪里定义函数，只要求这些函数在可访问的作用域中即可。

让我们启动一个名为 _functions_ 的新二进制项目来进一步探索函数。将 `another_function` 示例放入 _src/main.rs_ 并运行它。你应该会看到以下输出：

```console
{{#include ../listings/ch03-common-programming-concepts/no-listing-16-functions/output.txt}}
```

这些行按照在 `main` 函数中出现的顺序执行。首先打印出“Hello, world!”消息，然后调用 `another_function` 并打印其消息。

### 参数

我们可以定义具有 _参数_ 的函数，这些参数是函数签名的一部分特殊变量。当函数有参数时，可以为这些参数提供具体值。从技术上讲，这些具体值被称为 _参数_，但在日常交流中，人们通常将 _参数_ 和 _参数值_ 混用，指代函数定义中的变量或在调用函数时传递的具体值。

在这个版本的 `another_function` 中，我们添加了一个参数：

<span class="filename">Filename: src/main.rs</span>

```rust
{{#rustdoc_include ../listings/ch03-common-programming-concepts/no-listing-17-functions-with-parameters/src/main.rs}}
```

尝试运行此程序；你应该会得到以下输出：

```console
{{#include ../listings/ch03-common-programming-concepts/no-listing-17-functions-with-parameters/output.txt}}
```

`another_function` 的声明包含一个名为 `x` 的参数。`x` 的类型被指定为 `i32`。当我们将 `5` 传递给 `another_function` 时，`println!` 宏会在格式字符串中把 `5` 放在包含 `x` 的括号对处。

在函数签名中，你必须声明每个参数的类型。这是 Rust 设计中的一个刻意选择：在函数定义中要求类型注解意味着编译器几乎不需要你在代码的其他部分使用这些注解来推断类型含义。如果编译器知道函数期望的类型，它也能提供更有用的错误提示。

当定义多个参数时，请用逗号分隔参数声明，如下所示：

<span class="filename">Filename: src/main.rs</span>

```rust
{{#rustdoc_include ../listings/ch03-common-programming-concepts/no-listing-18-functions-with-multiple-parameters/src/main.rs}}
```

这个示例创建了一个名为 `print_labeled_measurement` 的函数，包含两个参数。第一个参数名为 `value`，类型为 `i32`；第二个参数名为 `unit_label`，类型为 `char`。然后该函数会打印包含 `value` 和 `unit_label` 的文本。

让我们尝试运行这段代码。将 `_functions_` 项目中的 `_src/main.rs_` 文件里的程序替换为上述示例，然后使用 `cargo run` 运行它：

```console
{{#include ../listings/ch03-common-programming-concepts/no-listing-18-functions-with-multiple-parameters/output.txt}}
```

因为我们将 `5` 作为 `value` 的值，并将 `'h'` 作为 `unit_label` 的值调用函数，所以程序输出中包含了这些值。

### 语句和表达式

函数体由一系列可选的语句组成，这些语句可能以表达式结尾。到目前为止，我们讨论的函数没有包含结束表达式，但你已经看到过作为语句一部分的表达式。由于 Rust 是一种基于表达式的语言，理解这一区别非常重要。其他语言没有类似的区分，因此让我们看看什么是语句和表达式，以及它们的差异如何影响函数体。

- _语句_ 是执行某些操作但不返回值的指令。
- _表达式_ 则计算出一个结果值。

让我们看一些示例。

实际上，我们已经使用了语句和表达式。使用 `let` 关键字创建变量并为其赋值属于语句。在清单 3-1 中，`let y = 6;` 就是一个语句。

<Listing number="3-1" file-name="src/main.rs" caption="A `main` function declaration containing one statement">

```rust
{{#rustdoc_include ../listings/ch03-common-programming-concepts/listing-03-01/src/main.rs}}
```

</Listing>

函数定义也是语句；前面的整个示例本身就是一个语句。（不过，我们稍后会看到，调用函数并非语句。）

语句不会返回值。因此，你不能将 `let` 语句赋给另一个变量，如下代码试图这样做时就会出错：

<span class="filename">Filename: src/main.rs</span>

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch03-common-programming-concepts/no-listing-19-statements-vs-expressions/src/main.rs}}
```

运行此程序时，你遇到的错误如下所示：

```console
{{#include ../listings/ch03-common-programming-concepts/no-listing-19-statements-vs-expressions/output.txt}}
```

`let y = 6` 语句不返回值，因此 `x` 没有可绑定的内容。这与其他语言（如 C 和 Ruby）不同，在那些语言中赋值会返回赋值结果。在这些语言中，你可以写 `x = y = 6`，使得 `x` 和 `y` 都拥有值 `6`；而在 Rust 中则不是这样。

表达式会计算出一个值，并构成了你在 Rust 中编写的大部分代码。以数学运算为例，如 `5 + 6`，这是一个计算出值为 `11` 的表达式。表达式也可以作为语句的一部分：在清单 3-1 中，`let y = 6;` 中的 `6` 是一个计算出值为 `6` 的表达式。调用函数也是一个表达式。调用宏也是一个表达式。使用花括号创建的新作用域块也是表达式，例如：

<span class="filename">Filename: src/main.rs</span>

```rust
{{#rustdoc_include ../listings/ch03-common-programming-concepts/no-listing-20-blocks-are-expressions/src/main.rs}}
```

这个表达式：

```rust,ignore
{
    let x = 3;
    x + 1
}
```

就是一个在此情况下计算出值为 `4` 的块。该值作为 `let` 语句的一部分被绑定到 `y` 上。请注意没有分号的 `x + 1` 行，这与你目前看到的大多数行不同。表达式中不包含结束分号。如果你在表达式末尾添加分号，它就会变成语句，并且不会返回值。在接下来探讨函数返回值和表达式时，请记住这一点。

### 具有返回值的函数

函数可以将值返回给调用它的代码。我们不会给返回值命名，但必须在箭头（`->`）后面声明其类型。在 Rust 中，函数的返回值与函数体中的最终表达式的值相同。你可以使用 `return` 关键字并指定一个值来提前从函数中返回，但大多数函数会隐式地返回最后一个表达式。以下是返回一个值的函数的示例：

<span class="filename">Filename: src/main.rs</span>

```rust
{{#rustdoc_include ../listings/ch03-common-programming-concepts/no-listing-21-function-return-values/src/main.rs}}
```

在 `five` 函数中没有函数调用、宏或 `let` 语句——只有数字 `5`。这是 Rust 中完全有效的函数。请注意，函数的返回类型也被指定了，即 `-> i32`。尝试运行此代码，输出应如下所示：

```console
{{#include ../listings/ch03-common-programming-concepts/no-listing-21-function-return-values/output.txt}}
```

`five` 中的 `5` 是函数的返回值，因此返回类型为 `i32`。让我们更详细地分析一下。有两个重要的点：首先，`let x = five();` 这一行表明我们使用函数的返回值来初始化一个变量。因为函数 `five` 返回 `5`，所以这一行等同于以下代码：

```rust
let x = 5;
```

其次，`five` 函数没有参数，并定义了返回值的类型，但函数体中只有一个没有分号的 `5`，因为它是一个我们希望返回的表达式。

让我们看另一个示例：

<span class="filename">Filename: src/main.rs</span>

```rust
{{#rustdoc_include ../listings/ch03-common-programming-concepts/no-listing-22-function-parameter-and-return/src/main.rs}}
```

运行此代码将输出 `The value of x is: 6`。但是，如果我们把包含 `x + 1` 的行末尾加上分号，将其从表达式变为语句，会发生什么？

<span class="filename">Filename: src/main.rs</span>

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch03-common-programming-concepts/no-listing-23-statements-dont-return-values/src/main.rs}}
```

编译此代码会产生如下错误：

```console
{{#include ../listings/ch03-common-programming-concepts/no-listing-23-statements-dont-return-values/output.txt}}
```

主要错误信息 `mismatched types` 揭示了这段代码的核心问题。函数 `plus_one` 的定义表明它将返回 `i32`，但语句不会评估为值，这由 `()` 表示，即单位类型。因此，没有返回值，这与函数定义相矛盾，从而导致错误。在这个输出中，Rust 提供了一个建议来纠正这个问题：它建议移除分号，这样就能解决错误。
