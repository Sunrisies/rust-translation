## 切片类型

_Slices_ 允许你引用 [集合](ch08-00-common-collections.md)<!-- ignore -->中的连续元素序列。切片是一种引用方式，因此没有所有权。

这里有一个小的编程问题：编写一个函数，该函数接受一个由空格分隔的单词字符串，并返回该字符串中第一个出现的单词。如果函数在字符串中没有找到空格，则整个字符串应被视为一个单词，因此必须返回整个字符串。

> 注意：为了介绍切片，本节仅假设使用 ASCII 字符；关于 UTF-8 处理的更详细讨论位于第 8 章的“用字符串存储 UTF-8 编码文本”[strings]<!-- ignore -->部分。

让我们通过不使用切片来思考如何定义这个函数的签名，以便理解切片能解决什么问题：

```rust,ignore
fn first_word(s: &String) -> ?
```

`first_word` 函数有一个类型为 `&String` 的参数。我们不需要拥有该字符串，所以这是可以的。（在惯用的 Rust 中，函数除非需要，否则不会占用参数的所有权，随着后续讨论会清楚这些原因。）但我们应该返回什么？实际上我们无法表示字符串的 *部分*。不过，我们可以返回单词末尾的索引，由空格表示。让我们像列表 4-7 那样尝试这样做。

<Listing number="4-7" file-name="src/main.rs" caption="The `first_word` function that returns a byte index value into the `String` parameter">

```rust
{{#rustdoc_include ../listings/ch04-understanding-ownership/listing-04-07/src/main.rs:here}}
```

</Listing>

因为我们需要逐个遍历 `String` 元素并检查某个值是否为空格，所以我们将使用 `as_bytes` 方法将 `String` 转换为字节数组。

```rust,ignore
{{#rustdoc_include ../listings/ch04-understanding-ownership/listing-04-07/src/main.rs:as_bytes}}
```

接下来，我们使用 `iter` 方法创建一个字节数组的迭代器：

```rust,ignore
{{#rustdoc_include ../listings/ch04-understanding-ownership/listing-04-07/src/main.rs:iter}}
```

我们将在 [第 13 章][ch13]<!-- ignore -->中更详细地讨论迭代器。目前只需知道 `iter` 是一种返回集合中每个元素的方法，而 `enumerate` 则包装了 `iter` 的结果，将每个元素作为元组的一部分返回。从 `enumerate` 返回的元组的第一个元素是索引，第二个元素是对该元素的引用。这比自己计算索引更方便。

由于 `enumerate` 方法返回的是一个元组，我们可以使用模式来解构该元组。我们将在 [第6章][ch6]<!-- ignore -->中进一步讨论模式。在 `for` 循环中，我们指定一个模式，其中 `i` 表示元组中索引的值，`&item` 表示元组中的单个字节。因为我们从 `.iter().enumerate()` 得到对元素的引用，所以我们在模式中使用 `&`。

在 `for` 循环内部，我们使用字节字面量语法来查找代表空格的字节。如果找到空格，我们返回其位置；否则，我们使用 `s.len()` 返回字符串的长度。

```rust,ignore
{{#rustdoc_include ../listings/ch04-understanding-ownership/listing-04-07/src/main.rs:inside_for}}
```

我们现在有了找出字符串中第一个单词末尾索引的方法，但存在一个问题。我们单独返回一个 `usize` 类型的值，但在 `&String` 的上下文中它只是一个无意义的数字。换句话说，因为它是一个与 `String` 分离的值，无法保证将来仍然有效。请参考列表 4-8 中的程序，该程序使用了列表 4-7 中的 `first_word` 函数。

<Listing number="4-8" file-name="src/main.rs" caption="Storing the result from calling the `first_word` function and then changing the `String` contents">

```rust
{{#rustdoc_include ../listings/ch04-understanding-ownership/listing-04-08/src/main.rs:here}}
```

</Listing>

这个程序可以毫无错误地编译，如果我们调用 `s.clear()` 后使用 `word` 也同样可以编译。由于 `word` 与 `s` 的状态完全无关，`word` 仍然包含值 `5`。我们可以把这个值 `5` 与变量 `s` 一起使用，试图提取第一个单词，但这会是一个错误，因为自从我们在 `word` 中保存了 `5` 之后，`s` 的内容已经发生了变化。

不得不担心 `word` 中的索引与 `s` 中的数据不同步是非常繁琐且容易出错！如果我们编写一个 `second_word` 函数，管理这些索引会更加脆弱。其签名必须如下所示：

```rust,ignore
fn second_word(s: &String) -> (usize, usize) {
```

现在我们在跟踪一个起始和结束索引，还有更多从特定状态的数据计算出来的值，但这些值根本不与该状态绑定。我们有三个无关的变量需要保持同步。

幸运的是，Rust 有解决这个问题的方法：字符串切片。

### 字符串切片

_字符串切片_ 是对 `String` 中连续元素序列的引用，其形式如下：

```rust
{{#rustdoc_include ../listings/ch04-understanding-ownership/no-listing-17-slice/src/main.rs:here}}
```

`hello` 并非对整个 `String` 的引用，而是对 `String` 中特定部分的引用，该部分由额外的 `[0..5]` 位指定。我们通过在方括号内指定 `[starting_index..ending_index]` 来创建切片，其中 _`starting_index_` 是切片中的第一个位置，_`ending_index_` 是切片中最后一个位置加一。内部而言，切片数据结构存储了起始位置和切片长度，这对应于 _`ending_index_` 减去 _`starting_index_`。因此，在 `let world = &s[6..11];` 的情况下，`world` 是一个包含指向 `s` 中索引 6 处字节的指针的切片，其长度值为 `5`。

图 4-7 以图表形式展示了这一点。

<img alt="Three tables: a table representing the stack data of s, which points
指的是堆上字符串数据 “hello world” 中索引为 0 的字节。第三个表格表示切片 world 的栈数据，其长度值为 5，指向堆数据表中索引为 6 的字节。” src="img/trpl04-07.svg" class="center" style="width: 50%;" />

<span class="caption">Figure 4-7: A string slice referring to part of a
`String`</span>

使用 Rust 的 `..` 范围语法，如果你想从索引 0 开始，可以省略两个点之前的值。换句话说，它们是相等的：

```rust
let s = String::from("hello");

let slice = &s[0..2];
let slice = &s[..2];
```

同样地，如果您的切片包含 `String` 的最后一个字节，您可以省略后面的数字。这意味着它们是相等的：

```rust
let s = String::from("hello");

let len = s.len();

let slice = &s[3..len];
let slice = &s[3..];
```

您也可以同时省略这两个值来获取整个字符串的切片。因此，它们是相等的：

```rust
let s = String::from("hello");

let len = s.len();

let slice = &s[0..len];
let slice = &s[..];
```

> 注意：字符串切片范围索引必须位于有效的 UTF-8 字符边界上。如果您尝试在多字节字符中间创建字符串切片，您的程序将因错误而退出。

有了这些信息后，让我们重新编写 `first_word` 以返回一个切片。表示“字符串切片”的类型写为 `&str`：

<Listing file-name="src/main.rs">

```rust
{{#rustdoc_include ../listings/ch04-understanding-ownership/no-listing-18-first-word-slice/src/main.rs:here}}
```

</Listing>

我们像在列表 4-7 中那样找到空格的第一次出现来获取单词末尾的索引。当找到空格时，我们使用字符串的开头位置和空格的索引作为起始和结束索引来返回一个字符串切片。

现在，当我们调用 `first_word` 时，会得到一个与底层数据相关的单一值。该值由对切片起始点的引用和切片中元素的数量组成。

对于 `second_word` 函数来说，返回切片同样可行：

```rust,ignore
fn second_word(s: &String) -> &str {
```

我们现在拥有一个简单的 API，由于编译器会确保进入 `String` 的引用始终有效，因此很难出错。请记住列表 4-8 中的程序中的错误：当我们得到第一个单词的索引后，却清空了字符串，导致索引失效。虽然这段代码在逻辑上是不正确的，但当时没有立即出现错误。如果我们继续尝试使用空字符串的第一个单词索引，问题会在之后显现出来。切片使得这种错误无法发生，并能让我们更早地发现代码中的问题。使用 `first_word` 的切片版本会引发编译时错误：

<Listing file-name="src/main.rs">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch04-understanding-ownership/no-listing-19-slice-error/src/main.rs:here}}
```

</Listing>

这是编译器报错信息：

```console
{{#include ../listings/ch04-understanding-ownership/no-listing-19-slice-error/output.txt}}
```

回想一下借用规则：如果我们有一个不可变的引用，就不能同时获取可变的引用。因为 `clear` 需要截断 `String`，所以它必须获得一个可变的引用。`clear` 调用后的 `println!` 使用 `word` 中的引用，因此不可变引用在那时仍然必须是有效的。Rust 不允许在 `clear` 中同时存在可变引用和 `word` 中的不可变引用，导致编译失败。不仅 Rust 使我们的 API 更易于使用，还消除了一类编译时错误！

<!-- Old headings. Do not remove or links may break. -->

<a id="string-literals-are-slices"></a>

#### 作为切片的字符串字面量

回想一下我们讨论过字符串字面量存储在二进制数据中。现在知道了切片的概念后，我们可以正确理解字符串字面量了：

```rust
let s = "Hello, world!";
```

这里的 `s` 类型是 `&str`：它是一个指向二进制中特定位置的切片。这也是为什么字符串字面量是不可变的；`&str` 是一个不可变引用。

#### 将字符串切片作为参数

知道可以接受字面量和 `String` 值的切片，使得 `first_word` 有了进一步的改进，那就是其签名：

```rust,ignore
fn first_word(s: &String) -> &str {
```

更经验丰富的 Rustacean 会使用列表 4-9 中所示的签名，因为这样我们可以同时用于 `&String` 值和 `&str` 值。

<Listing number="4-9" caption="Improving the `first_word` function by using a string slice for the type of the `s` parameter">

```rust,ignore
{{#rustdoc_include ../listings/ch04-understanding-ownership/listing-04-09/src/main.rs:here}}
```

</Listing>

如果我们有一个字符串切片，可以直接传递它。如果有一个 `String`，则可以传递该 `String` 的切片或对该 `String` 的引用。这种灵活性利用了解引用强制转换，这是我们在第 15 章的“在函数和方法中使用解引用强制转换”部分将讨论的功能。

定义一个接受字符串切片而不是对 `String` 引用的函数，可以使我们的 API 更加通用和实用，同时不会失去任何功能特性。

<Listing file-name="src/main.rs">

```rust
{{#rustdoc_include ../listings/ch04-understanding-ownership/listing-04-09/src/main.rs:usage}}
```

</Listing>

### 其他切片类型

正如你所想象的，字符串切片是特定于字符串的。但还有更通用的切片类型。考虑这个数组：

```rust
let a = [1, 2, 3, 4, 5];
```

就像我们可能想要引用字符串的一部分一样，我们也可能想要引用数组的一部分。我们可以这样实现：

```rust
let a = [1, 2, 3, 4, 5];

let slice = &a[1..3];

assert_eq!(slice, &[2, 3]);
```

这个切片的类型为 `&[i32]`。它的工作原理与字符串切片相同，即存储对第一个元素的引用和长度信息。你将使用这种切片来处理各种其他集合类型。我们在第 8 章讨论向量时将详细探讨这些集合。

## 总结

所有权、借用和切片的概念确保在编译时就能保证 Rust 程序的内存安全。Rust 语言让你能够像其他系统编程语言一样控制内存使用。但是，当数据所有者超出作用域时，所有者会自动清理该数据，这意味着你无需编写或调试额外代码来实现这种控制。

所有权影响 Rust 的许多其他部分的工作方式，因此我们在本书的其余部分将进一步讨论这些概念。让我们进入第 5 章，看看如何在 `struct` 中组合数据元素。

[ch13]: ch13-02-iterators.html
[ch6]: ch06-02-match.html#patterns-that-bind-to-values
[strings]: ch08-02-strings.html#storing-utf-8-encoded-text-with-strings
[deref-coercions]: ch15-02-deref.html#using-deref-coercions-in-functions-and-methods
