## 使用字符串存储UTF-8编码文本

我们在第4章中讨论了字符串，但现在我们将更深入地探讨它们。新手的Rust开发者通常会在处理字符串时遇到困难，原因有三：Rust倾向于暴露可能的错误；字符串是一种比许多程序员所认为的更复杂的数据结构；以及UTF-8编码。当从其他编程语言转过来时，这些因素结合在一起可能会显得难以应对。

我们在集合的背景下讨论字符串，因为字符串被实现为字节的集合，再加上一些方法在字节被解释为文本时提供有用的功能。在本节中，我们将讨论所有集合类型都具备的`String`操作，如创建、更新和读取。我们还将讨论`String`与其他集合的不同之处，即向`String`进行索引的操作因人和计算机对`String`数据的解释方式不同而变得复杂。

<!-- Old headings. Do not remove or links may break. -->

<a id="what-is-a-string"></a>

### 定义字符串

首先，我们将定义“字符串”这一术语的含义。Rust在核心语言中只有一种字符串类型，即通常以借用形式`&str`出现的字符串切片`str`。在第4章中，我们讨论了字符串切片，它们是对存储在其他地方的UTF-8编码字符串数据的引用。例如，字符串字面量存储在程序的二进制文件中，因此就是字符串切片。

`String`类型由Rust标准库提供，而不是编入核心语言，它是一种可增长的、可变的、拥有所有权的、UTF-8编码的字符串类型。当Rust开发者在Rust中提到“字符串”时，他们可能指的是`String`或字符串切片`&str`类型，而不仅仅是指其中一种类型。虽然本节主要讨论的是`String`，但这两种类型都在Rust标准库中被广泛使用，且`String`和字符串切片都是UTF-8编码的。

### 创建新的字符串

许多可以在 `Vec<T>` 中使用的操作也可以在 `String` 中实现，因为 `String` 实际上是一个字节向量的包装器，具有额外的保证、限制和功能。一个在 `Vec<T>` 和 `String` 上行为相同的函数示例是创建实例的函数 `new`，如清单 8-11 所示。

<Listing number="8-11" caption="Creating a new, empty `String`">

```rust
{{#rustdoc_include ../listings/ch08-common-collections/listing-08-11/src/main.rs:here}}
```

</Listing>

这行代码创建了一个新的空字符串 `s`，我们可以将其用于加载数据。通常，我们会有一些初始数据来开始使用该字符串。为此，我们使用 `to_string` 方法，该方法适用于实现 `Display` trait 的任何类型，就像字符串字面量一样。清单 8-12 展示了两个示例。

<Listing number="8-12" caption="Using the `to_string` method to create a `String` from a string literal">

```rust
{{#rustdoc_include ../listings/ch08-common-collections/listing-08-12/src/main.rs:here}}
```

</Listing>

这段代码创建了一个包含 `initial contents` 的字符串。

我们还可以使用 `String::from` 函数从字符串字面量创建 `String`。清单 8-13 中的代码等同于使用 `to_string` 的清单 8-12 中的代码。

<Listing number="8-13" caption="Using the `String::from` function to create a `String` from a string literal">

```rust
{{#rustdoc_include ../listings/ch08-common-collections/listing-08-13/src/main.rs:here}}
```

</Listing>

由于字符串用于许多用途，我们可以使用多种不同的泛型 API 来处理字符串，从而提供更多的选项。其中一些可能看起来是多余的，但它们都有各自的作用！在这种情况下，`String::from` 和 `to_string` 执行相同的功能，因此选择哪一个取决于风格和可读性。

请记住，字符串采用 UTF-8 编码，因此我们可以在其中包含任何正确编码的数据，如清单 8-14 所示。

<Listing number="8-14" caption="Storing greetings in different languages in strings">

```rust
{{#rustdoc_include ../listings/ch08-common-collections/listing-08-14/src/main.rs:here}}
```

</Listing>

所有这些都是有效的 `String` 值。

### 更新字符串

`String` 的大小可以增长，其内容也可以改变，就像 `Vec<T>` 的内容一样，如果你向其中添加更多数据。此外，你可以方便地使用 `+` 运算符或 `format!` 宏来连接 `String` 值。

<!-- Old headings. Do not remove or links may break. -->

<a id="appending-to-a-string-with-push_str-and-push"></a>

#### 使用 `push_str` 或 `push` 进行追加

我们可以通过使用 `push_str` 方法将字符串切片追加到 `String` 中，如清单 8-15 所示。

<Listing number="8-15" caption="Appending a string slice to a `String` using the `push_str` method">

```rust
{{#rustdoc_include ../listings/ch08-common-collections/listing-08-15/src/main.rs:here}}
```

</Listing>

在这两行代码之后，`s` 将包含 `foobar`。`push_str` 方法接受字符串切片，因为我们不一定希望拥有参数。例如，在清单 8-16 中的代码中，我们希望在将 `s1` 的内容追加到 `s2` 后仍然能够使用 `s2`。

<Listing number="8-16" caption="Using a string slice after appending its contents to a `String`">

```rust
{{#rustdoc_include ../listings/ch08-common-collections/listing-08-16/src/main.rs:here}}
```

</Listing>

如果 `push_str` 方法获得了 `s2` 的拥有权，我们就无法在最后一行打印其值。然而，这段代码按预期工作！

`push` 方法接受一个字符作为参数，并将其添加到 `String` 中。清单 8-17 展示了如何使用 `push` 方法将字母 _l_ 添加到 `String` 中。

<Listing number="8-17" caption="Adding one character to a `String` value using `push`">

```rust
{{#rustdoc_include ../listings/ch08-common-collections/listing-08-17/src/main.rs:here}}
```

</Listing>

因此，`s` 将包含 `lol`。

<!-- Old headings. Do not remove or links may break. -->

<a id="concatenation-with-the--operator-or-the-format-macro"></a>

#### 使用 `+` 或 `format!` 进行连接

通常，您希望合并两个现有的字符串。一种方法是使用 `+` 运算符，如清单 8-18 所示。

<Listing number="8-18" caption="Using the `+` operator to combine two `String` values into a new `String` value">

```rust
{{#rustdoc_include ../listings/ch08-common-collections/listing-08-18/src/main.rs:here}}
```

</Listing>

字符串 `s3` 将包含 `Hello, world!`。在相加之后，`s1` 不再有效，而我们使用引用指向 `s2` 的原因与调用 `+` 运算符时方法的签名有关。`+` 运算符使用 `add` 方法，其签名大致如下：

```rust,ignore
fn add(self, s: &str) -> String {
```

在标准库中，您会看到 `add` 方法是用泛型和相关类型定义的。在这里，我们使用了具体类型，当我们用 `String` 值调用此方法时就会发生这种情况。我们将在第 10 章讨论泛型。这个签名为我们提供了理解 `+` 运算符中复杂部分的线索。

首先，`s2` 有一个 `&`，意味着我们正在将第二个字符串的引用添加到第一个字符串中。这是由于 `add` 函数中的 `s` 参数：我们只能将一个字符串切片添加到 `String` 中；不能将两个 `String` 值相加。但是等等——`&s2` 的类型是 `&String`，而不是 `&str`，正如 `add` 的第二个参数所指定的那样。那么，为什么清单 8-18 可以编译呢？

我们能够使用 `&s2` 在 `add` 调用中使用的原因是，编译器可以将 `&String` 参数转换为 `&str`。当我们调用 `add` 方法时，Rust 使用解引用转换，这里将 `&s2` 转换为 `&s2[..]`。我们将在第 15 章更深入地讨论解引用转换。因为 `add` 不拥有 `s` 参数，所以经过此操作后，`s2` 仍然是一个有效的 `String`。

其次，从签名中可以看出 `add` 拥有 `self` 的所有权，因为 `self` 没有 `&` 符号。这意味着列表 8-18 中的 `s1` 会被移动到 `add` 调用中，之后将不再有效。因此，尽管 `let s3 = s1 + &s2;` 看起来像是复制两个字符串并创建一个新的字符串，实际上该语句会拥有 `s1` 的所有权，添加 `s2` 内容的副本，然后返回结果的所有权。换句话说，它看似在创建大量副本，但实际上并非如此；其实现方式比复制更高效。

如果我们需要合并多个字符串， `+` 运算符的行为会变得复杂：

```rust
{{#rustdoc_include ../listings/ch08-common-collections/no-listing-01-concat-multiple-strings/src/main.rs:here}}
```

此时，`s` 将会是 `tic-tac-toe`。由于包含了大量的 `+` 和 `"` 字符，很难理解发生了什么。对于更复杂的字符串组合方式，我们可以使用 `format!` 宏：

```rust
{{#rustdoc_include ../listings/ch08-common-collections/no-listing-02-format/src/main.rs:here}}
```

这段代码同样将 `s` 设置为 `tic-tac-toe`。`format!` 宏的工作原理与 `println!` 类似，但它不是将输出打印到屏幕上，而是返回一个包含内容的 `String`。使用 `format!` 的代码版本更易于阅读，且 `format!` 宏生成的代码使用引用，因此该调用不会拥有任何参数的所有权。

### 对字符串进行索引操作

在许多其他编程语言中，通过索引访问字符串中的单个字符是一种有效且常见的操作。然而，在 Rust 中尝试使用索引语法访问 `String` 的部分内容会引发错误。请参考列表 8-19 中的无效代码。

<Listing number="8-19" caption="Attempting to use indexing syntax with a `String`">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch08-common-collections/listing-08-19/src/main.rs:here}}
```

</Listing>

这段代码会导致以下错误：

```console
{{#include ../listings/ch08-common-collections/listing-08-19/output.txt}}
```

错误说明了问题所在：Rust 字符串不支持索引操作。但为什么不行呢？为了回答这个问题，我们需要讨论 Rust 如何在内存中存储字符串。

#### 内部表示

`String` 是一个 `Vec<u8>` 的包装器。让我们看看列表 8-14 中一些正确编码的 UTF-8 示例字符串。首先是这个：

```rust
{{#rustdoc_include ../listings/ch08-common-collections/listing-08-14/src/main.rs:spanish}}
```

在这种情况下，`len` 将为 `4`，这意味着存储字符串 `"Hola"` 的向量长度为 4 字节。在 UTF-8 编码中，每个字母占用 1 个字节。然而，下一行可能会让你感到惊讶（请注意，这个字符串以大写的西里尔字母 _Ze_ 开头，而不是数字 3）：

```rust
{{#rustdoc_include ../listings/ch08-common-collections/listing-08-14/src/main.rs:russian}}
```

如果你被问到字符串的长度是多少，你可能会回答 12。实际上，Rust 的答案是 24：这是将“Здравствуйте”用 UTF-8 编码所需的字节数，因为该字符串中的每个 Unicode 标量值都需要 2 个字节的存储空间。因此，对字符串字节的索引并不总是对应一个有效的 Unicode 标量值。为了说明这一点，请考虑以下无效的 Rust 代码：

```rust,ignore,does_not_compile
let hello = "Здравствуйте";
let answer = &hello[0];
```

你已经知道 `answer` 不会是第一个字母 `З`。在 UTF-8 编码中，`З` 的第一个字节是 `208`，第二个字节是 `151`，因此看起来 `answer` 实际上应该是 `208`，但 `208` 本身不是一个有效的字符。如果用户想要这个字符串的第一个字母，他们很可能不希望返回 `208`；然而，这是 Rust 在字节索引 0 上唯一拥有的数据。通常用户并不希望返回字节值，即使字符串仅包含拉丁字母：如果 `&"hi"[0]` 是返回字节值的有效代码，它将会返回 `104`，而不是 `h`。

因此，为了避免返回意外的值并导致可能无法立即发现的错误，Rust 根本不会编译这段代码，从而在开发过程中早期就防止了误解。

<!-- Old headings. Do not remove or links may break. -->

<a id="bytes-and-scalar-values-and-grapheme-clusters-oh-my"></a>

#### 字节、标量值与字形簇

关于 UTF-8 的另一个点是，从 Rust 的角度来看，实际上有三种相关的方式来看待字符串：作为字节、作为标量值以及作为字形簇（最接近我们所说的_字母_）。

如果我们看用天城体书写的印地语单词“नमस्ते”，它被存储为类似以下的 `u8` 值向量：

```text
[224, 164, 168, 224, 164, 174, 224, 164, 184, 224, 165, 141, 224, 164, 164,
224, 165, 135]
```

这是 18 个字节，计算机最终也是以这种方式存储这些数据。如果我们将它们视为 Unicode 标量值，也就是 Rust 的 `char` 类型所代表的含义，那么这些字节看起来就像这样：

```text
['न', 'म', 'स', '्', 'त', 'े']
```

这里有六个 `char` 值，但第四个和第六个不是字母：它们是独立的变音符号，单独来看没有意义。如果我们将它们视为字形簇，那么就能得到一个人所认为的构成印地语单词的四个字母。

```text
["न", "म", "स्", "ते"]
```

Rust 提供了多种解释计算机存储的原始字符串数据的方式，这样每个程序都可以选择所需的解释方式，无论数据使用的是哪种人类语言。

最后，Rust 不允许我们对 `String` 进行索引以获取字符的原因在于，索引操作期望总是以常数时间（O(1)）完成。但由于 `String` 的 contents 需要从开头到指定索引处遍历，因此无法保证性能表现。

### 字符串切片

对字符串进行索引通常不是一个好主意，因为不清楚字符串索引操作的返回类型应该是什么：一个字节值、一个字符、一个字形簇还是一个字符串切片。如果你确实需要使用索引来创建字符串切片，Rust 会要求你提供更具体的说明。

与其使用单个数字的 `[]` 进行索引，不如使用范围 `[]` 来创建一个包含特定字节的字符串切片：

```rust
let hello = "Здравствуйте";

let s = &hello[0..4];
```

这里，`s` 是一个 `&str`，它包含了字符串的前4个字节。之前提到过，每个字符都是2个字节，这意味着 `s` 将是 `Зд`。

如果我们尝试使用类似 `&hello[0..1]` 的方式只截取字符的部分字节，Rust 会在运行时引发恐慌，就像在向量中访问无效索引一样。

```console
{{#include ../listings/ch08-common-collections/output-only-01-not-char-boundary/output.txt}}
```

在使用范围创建字符串切片时应该非常谨慎，因为这样做可能会导致程序崩溃。

<!-- Old headings. Do not remove or links may break. -->

<a id="methods-for-iterating-over-strings"></a>

### 遍历字符串

操作字符串片段的最佳方式是对是想要字符还是字节明确说明。对于单个 Unicode 标量值，使用 `chars` 方法。对 “Зд” 调用 `chars` 会分离出两个类型为 `char` 的值，你可以遍历结果来访问每个元素。

```rust
for c in "Зд".chars() {
    println!("{c}");
}
```

这段代码将输出以下内容：

```text
З
д
```

或者，`bytes` 方法会返回每个原始字节，这可能对你的应用场景很合适：

```rust
for b in "Зд".bytes() {
    println!("{b}");
}
```

这段代码将打印构成该字符串的 4 个字节：

```text
208
151
208
180
```

但请记住，有效的 Unicode 标量值可能由超过 1 个字节组成。

像 Devanagari 文字一样从字符串中获取字形簇是复杂的，因此标准库并不提供此功能。如果你需要此功能，可以在 [crates.io](https://crates.io/) 上查找相关 crates。

<!-- Old headings. Do not remove or links may break. -->

<a id="strings-are-not-so-simple"></a>

### 处理字符串的复杂性

总结来说，字符串非常复杂。不同的编程语言在如何向程序员展示这种复杂性方面会有不同的选择。Rust 选择将正确处理 `String` 数据作为所有 Rust 程序的默认行为，这意味着程序员必须在前期就更多地考虑如何处理 UTF-8 数据。这种权衡使得字符串的复杂性比其他编程语言更为明显，但它可以让你在开发生命周期后期不必处理涉及非 ASCII 字符的错误。

好消息是，标准库提供了许多基于 `String` 和 `&str` 类型的功能，以帮助正确处理这些复杂情况。请务必查看文档中有关 `contains` 用于字符串搜索以及 `replace` 用于用另一个字符串替换字符串部分内容的方法。

让我们转向一种稍微简单一些的数据结构：哈希表！
