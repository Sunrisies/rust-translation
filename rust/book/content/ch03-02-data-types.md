## 数据类型

Rust 中的每个值都属于某种_数据类型_，这告诉 Rust 所指定的数据类型，以便它能够正确处理该数据。我们将探讨两种数据类型：标量类型和复合类型。

请记住，Rust 是一种_静态类型_语言，这意味着必须在编译时知道所有变量的类型。通常，编译器可以根据数值及其使用方式推断出要使用的类型。当存在多种可能类型的情况时，例如在第 2 章的“比较猜测与秘密数字”部分中，将 `String` 转换为数值类型时使用 `parse` 函数时，我们必须添加类型注解，如下所示：

```rust
let guess: u32 = "42".parse().expect("Not a number!");
```

如果我们不添加前面的代码中的 `: u32` 类型注解，Rust 会显示以下错误，这意味着编译器需要更多信息才能知道我们要使用的类型。

```console
{{#include ../listings/ch03-common-programming-concepts/output-only-01-no-type-annotations/output.txt}}
```

对于其他数据类型，你会看到不同的类型注解。

### 标量类型

_标量_类型表示单个值。Rust 有四种主要的标量类型：整数、浮点数、布尔值和字符。你可能从其他编程语言中熟悉这些类型。现在让我们来看看它们在 Rust 中的工作原理。

#### 整数类型

_整数_是没有小数部分的数字。我们在第 2 章中使用了一种整数类型 `u32`。这种类型声明表示与之关联的值应为无符号整数（有符号整数类型以 `i` 开头而非 `u`），占用 32 位空间。表 3-1 展示了 Rust 中的内置整数类型。我们可以使用这些变体中的任何一种来声明整数值的类型。

<span class="caption">Table 3-1: Integer Types in Rust</span>

| Length  | Signed  | Unsigned |
| ------- | ------- | -------- |
| 8-bit   | `i8`    | `u8`     |
| 16-bit  | `i16`   | `u16`    |
| 32-bit  | `i32`   | `u32`    |
| 64-bit  | `i64`   | `u64`    |
| 128-bit | `i128`  | `u128`   |
| Architecture-dependent | `isize` | `usize`  |

每种变体可以是有符号或无符号的，并且具有明确的大小。_有符号_ 和 _无符号_ 指的是数字是否可能为负——换句话说，数字是否需要带有符号（有符号）或只能为正且无需带符号即可表示（无符号）。这就像在纸上书写数字：当符号重要时，数字会加上正号或负号；然而，当可以安全地假设数字为正数时，则不显示符号。有符号数使用[二进制补码][twos-complement]<!-- ignore -->表示法存储。

每个有符号变体可以存储从 −(2<sup>n − 1</sup>) 到 2<sup>n − 1</sup> − 1（包含边界）的数字，其中 _n_ 是该变体使用的位数。因此，`i8` 可以存储从 −(2<sup>7</sup>) 到 2<sup>7</sup> − 1 的数字，即 −128 到 127。无符号变体可以存储从 0 到 2<sup>n</sup> − 1 的数字，因此 `u8` 可以存储从 0 到 2<sup>8</sup> − 1 的数字，即 0 到 255。

此外，`isize` 和 `usize` 类型取决于程序运行的计算机架构：如果是 64 位架构则使用 64 位，如果是 32 位架构则使用 32 位。

你可以以表 3-2 中展示的任何形式编写整数字面量。请注意，可以包含多种数字类型的数字字面量允许使用类型后缀，例如 `57u8`，来指定类型。数字字面量还可以使用 `_` 作为视觉分隔符，使数字更易于阅读，例如 `1_000`，其值与明确指定为 `1000` 相同。

<span class="caption">Table 3-2: Integer Literals in Rust</span>

| Number literals  | Example       |
| ---------------- | ------------- |
| Decimal          | `98_222`      |
| Hex              | `0xff`        |
| Octal            | `0o77`        |
| Binary           | `0b1111_0000` |
| Byte (`u8` only) | `b'A'`        |

那么如何确定使用哪种整数类型呢？如果你不确定，Rust 的默认设置通常是个好的起点：整数类型默认为 `i32`。使用 `isize` 或 `usize` 的主要情况是在对某种集合进行索引时。

> ##### 整数溢出
>
> 假设你有一个类型为 `u8` 的变量，它可以存储 0 到 255 之间的值。如果你试图将变量的值改变为超出该范围的值，例如 256，将会发生_整数溢出_，这可能导致两种行为之一。在调试模式下编译时，Rust 会包含对整数溢出的检查，如果发生这种情况，程序将在运行时_崩溃_。当程序因错误而退出时，Rust 使用 _崩溃_这一术语；我们将在第 9 章的“使用 `panic!` 处理无法恢复的错误”部分更深入地讨论崩溃问题。
>
> 在发布模式下使用 `--release` 标志编译时，Rust 不会包含导致崩溃的整数溢出检查。相反，如果发生溢出，Rust 会执行_二进制补码环绕_机制。简而言之，大于类型所能存储的最大值的值会“环绕”到该类型所能存储的最小值。对于 `u8` 类型，值 256 变为 0，值 257 变为 1，依此类推。程序不会崩溃，但变量的值可能不符合你的预期。依赖整数溢出的环绕行为被视为一种错误。
>
> 为了明确处理溢出的可能性，你可以使用标准库为基本数值类型提供的方法家族：
>
> - 在所有编译模式下使用 `wrapping_*` 方法进行环绕操作，例如 `wrapping_add`。- 使用 `checked_*` 方法在发生溢出时返回 `None` 值。- 使用 `overflowing_*` 方法返回值和指示是否发生溢出的布尔值。- 使用 `saturating_*` 方法在数值的最小值或最大值处饱和处理。

#### 浮点类型

Rust 还有两种用于_浮点数_的基本类型，即带有小数点的数字。Rust 的浮点类型为 `f32` 和 `f64`，分别具有 32 位和 64 位大小。默认类型为 `f64`，因为在现代 CPU 上，它的速度大致与 `f32` 相同，但精度更高。所有浮点类型都是有符号的。

以下是一个展示浮点数使用的示例：

<span class="filename">Filename: src/main.rs</span>

```rust
{{#rustdoc_include ../listings/ch03-common-programming-concepts/no-listing-06-floating-point/src/main.rs}}
```

浮点数按照 IEEE-754 标准进行表示。

#### 数值运算

Rust 支持所有数字类型预期的基本数学运算：加法、减法、乘法、除法和取余。整数除法会向零方向取整至最近的整数。以下代码展示了如何在 `let` 语句中使用每种数值运算：

<span class="filename">Filename: src/main.rs</span>

```rust
{{#rustdoc_include ../listings/ch03-common-programming-concepts/no-listing-07-numeric-operations/src/main.rs}}
```

这些语句中的每个表达式都使用一个数学运算符，并计算出一个单一值，然后该值被绑定到变量上。[附录 B][appendix_b]<!-- ignore --> 中列出了 Rust 提供的所有运算符。

#### 布尔类型

与大多数其他编程语言一样，Rust 中的布尔类型有两个可能的值：`true` 和 `false`。布尔类型占一个字节大小。Rust 中的布尔类型使用 `bool` 指定。例如：

<span class="filename">Filename: src/main.rs</span>

```rust
{{#rustdoc_include ../listings/ch03-common-programming-concepts/no-listing-08-boolean/src/main.rs}}
```

使用布尔值的主要方式是通过条件语句，如 `if` 表达式。我们将在[“控制流”][control-flow]<!-- ignore -->部分讨论 Rust 中 `if` 表达式的工作原理。

#### 字符类型

Rust 的 `char` 类型是语言中最基本的字母类型。以下是一些声明 `char` 值的示例：

<span class="filename">Filename: src/main.rs</span>

```rust
{{#rustdoc_include ../listings/ch03-common-programming-concepts/no-listing-09-char/src/main.rs}}
```

请注意，我们使用单引号来指定 `char` 字面量，而字符串字面量则使用双引号。Rust 中的 `char` 类型占 4 个字节大小，表示一个 Unicode 标量值，这意味着它可以表示比 ASCII 更多的内容。带重音的字母、中文、日文和韩文字符、表情符号以及零宽度空格都是有效的 `char` 值。Unicode 标量值的范围从 `U+0000` 到 `U+D7FF`，以及 `U+E000` 到 `U+10FFFF`（包含边界）。然而，在 Unicode 中“字符”并不是一个真正的概念，因此你对“字符”的理解可能与 Rust 中的 `char` 不同。我们将在第 8 章的[“使用字符串存储 UTF-8 编码文本”][strings]<!-- ignore -->中详细讨论这一主题。

### 复合类型

_复合类型_ 可以将多个值组合成一个类型。Rust 有两种基本复合类型：元组与数组。

#### 元组类型 一个_元组_是一种将多种不同类型的数值组合成单一复合类型的方式。元组具有固定的长度：一旦声明，其大小不能改变。

_元组_是一种将多种类型的值组合成一个复合类型的一般方法。元组具有固定的长度：一旦声明，其大小不能增加或减少。

我们可以通过在括号内用逗号分隔的值列表来创建元组。元组的每个位置都有一个类型，且元组中不同值的类型不必相同。在这个例子中我们添加了可选的类型注解：

<span class="filename">Filename: src/main.rs</span>

```rust
{{#rustdoc_include ../listings/ch03-common-programming-concepts/no-listing-10-tuples/src/main.rs}}
```

变量 `tup` 绑定到整个元组，因为元组被视为一个单一的复合元素。要从元组中获取各个值，可以使用模式匹配来解构元组值，如下所示：

<span class="filename">Filename: src/main.rs</span>

```rust
{{#rustdoc_include ../listings/ch03-common-programming-concepts/no-listing-11-destructuring-tuples/src/main.rs}}
```

该程序首先创建一个元组并将其绑定到变量 `tup`。然后使用 `let` 配合模式将 `tup` 转换为三个独立的变量 `x`、`y` 和 `z`。这被称为_解构_，因为它将单个元组分解为三个部分。最后，程序输出 `y` 的值，即 `6.4`。

我们也可以通过使用点 `.` 加上想要访问值的索引来直接访问元组元素。例如：

<span class="filename">Filename: src/main.rs</span>

```rust
{{#rustdoc_include ../listings/ch03-common-programming-concepts/no-listing-12-tuple-indexing/src/main.rs}}
```

该程序首先创建元组 `x`，然后利用各自的索引访问元组的每个元素。与大多数编程语言一样，元组的第一个索引为 0。

没有任何值的元组有一个特殊的名称_单位_。这个值和对应的类型都写作 `()`，表示空值或空返回类型。如果表达式不返回其他任何值，则隐式地返回单位值。

#### 数组类型 另一种组合多个值的方式是使用_数组_。与元组不同，数组中的每个元素必须具有相同的类型。与其他某些语言中的数组不同，Rust 中的数组具有固定的长度。

另一种存储多个值的集合方式是使用_数组_。与元组不同，数组中的每个元素必须属于同一类型。与某些其他语言的数组不同，Rust 中的数组具有固定的长度。

我们在数组中将值写成方括号内的逗号分隔列表：

<span class="filename">Filename: src/main.rs</span>

```rust
{{#rustdoc_include ../listings/ch03-common-programming-concepts/no-listing-13-arrays/src/main.rs}}
```

当你希望数据在栈上分配，就像我们目前看到的其他类型一样，而不是在堆上（我们将在[第4章][stack-and-heap]<!-- ignore -->中进一步讨论栈和堆）时，或者当你希望确保始终有固定数量的元素时，数组非常有用。不过，数组并不像向量那样灵活。向量是标准库提供的类似集合类型，其内容位于堆上，因此允许大小增长或缩小。如果你不确定是否应该使用数组还是向量，很可能应该使用向量。[第8章][vectors]<!-- ignore -->对向量进行了更详细的讨论。

然而，当你知道元素数量不会发生变化时，数组更为有用。例如，如果你在程序中使用月份名称，你可能会使用数组而不是向量，因为你知道它总是包含12个元素：

```rust
let months = ["January", "February", "March", "April", "May", "June", "July",
              "August", "September", "October", "November", "December"];
```

你使用方括号写出数组的类型，包括每个元素的类型、分号以及数组中元素的数量，如下所示：

```rust
let a: [i32; 5] = [1, 2, 3, 4, 5];
```

这里，`i32`是每个元素的类型。分号后面的数字`5`表示数组包含五个元素。

你也可以通过指定初始值、分号以及方括号内的数组长度来初始化一个数组，使其所有元素都具有相同的值，如以下所示：

```rust
let a = [3; 5];
```

名为`a`的数组将包含`5`个元素，这些元素最初都设置为值`3`。这相当于以更简洁的方式编写`let a = [3, 3, 3, 3, 3];`。

<!-- Old headings. Do not remove or links may break. -->
<a id="accessing-array-elements"></a>

#### 数组元素访问

数组是固定大小的单个内存块，可以在栈上分配。你可以使用索引来访问数组中的元素，如下所示：

<span class="filename">Filename: src/main.rs</span>

```rust
{{#rustdoc_include ../listings/ch03-common-programming-concepts/no-listing-14-array-indexing/src/main.rs}}
```

在这个示例中，名为`first`的变量将得到值`1`，因为那是数组中索引 `[0]` 的值。名为`second`的变量将从数组中索引 `[1]` 处得到值`2`。

#### 无效的数组元素访问

让我们看看如果你尝试访问数组末尾之后的元素时会发生什么。假设你运行这段代码，类似于第2章中的猜谜游戏，从用户那里获取一个数组索引：

<span class="filename">Filename: src/main.rs</span>

```rust,ignore,panics
{{#rustdoc_include ../listings/ch03-common-programming-concepts/no-listing-15-invalid-array-access/src/main.rs}}
```

这段代码可以成功编译。如果你使用 `cargo run` 运行此代码并输入 `0`、`1`、`2`、`3` 或 `4`，程序将打印出数组中对应位置的数值。然而，如果你输入的是数组末尾之后的数字，例如 `10`，你将看到如下输出：

<!-- manual-regeneration
cd listings/ch03-common-programming-concepts/no-listing-15-invalid-array-access cargo run 10 -->

```console
thread 'main' panicked at src/main.rs:19:19:
index out of bounds: the len is 5 but the index is 10
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace
```

程序在索引操作中使用无效值时产生了运行时错误。程序以错误信息退出，没有执行最后的 `println!` 语句。当你尝试通过索引访问元素时，Rust 会检查你指定的索引是否小于数组长度。如果索引大于或等于数组长度，Rust 将会崩溃。这种检查必须在运行时进行，尤其是在这种情况下，因为编译器无法知道用户稍后运行代码时会输入什么值。

这是 Rust 内存安全原则的实际应用示例。在许多低级语言中，不会进行这样的检查，当你提供错误的索引时，可能会访问无效的内存。Rust 通过立即退出而不是允许内存访问并继续运行来保护你免受此类错误。第9章将讨论更多关于 Rust 错误处理的方法，以及如何编写既可读又安全的代码，避免崩溃和允许无效内存访问。

[comparing-the-guess-to-the-secret-number]: ch02-00-guessing-game-tutorial.html#comparing-the-guess-to-the-secret-number
[twos-complement]: https://en.wikipedia.org/wiki/Two%27s_complement
[control-flow]: ch03-05-control-flow.html#control-flow
[strings]: ch08-02-strings.html#storing-utf-8-encoded-text-with-strings
[stack-and-heap]: ch04-01-what-is-ownership.html#the-stack-and-the-heap
[vectors]: ch08-01-vectors.html
[unrecoverable-errors-with-panic]: ch09-01-unrecoverable-errors-with-panic.html
[appendix_b]: appendix-02-operators.md
