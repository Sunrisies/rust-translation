## 引用与借用

列表 4-5 中的元组代码存在的问题是，我们必须将 `String` 返回给调用函数，以便在调用 `calculate_length` 后仍然能够使用该 `String`，因为 `String` 已被移动到了 `calculate_length` 中。相反，我们可以提供对 `String` 值的引用。引用就像指针一样，它是一个地址，我们可以通过这个地址访问存储在该地址的数据；该数据由其他变量拥有。与指针不同，引用在整个生命周期内都保证指向特定类型的有效值。

以下是如何定义和使用一个将对象引用作为参数的 `calculate_length` 函数，而不是获取值的所有权的示例：

<Listing file-name="src/main.rs">

```rust
{{#rustdoc_include ../listings/ch04-understanding-ownership/no-listing-07-reference/src/main.rs:all}}
```

</Listing>

首先，请注意变量声明中的所有元组代码以及函数返回值都消失了。其次，注意我们在 `calculate_length` 中传递了 `&s1`，在其定义中我们使用 `&String` 而不是 `String`。这些 ampersand 表示引用，它们允许你指向某个值而不获取其所有权。图 4-6 展示了这一概念。

<img alt="Three tables: the table for s contains only a pointer to the table
for s1. s1 的表格包含 s1 的栈数据，并指向堆上的字符串数据。" src="img/trpl04-06.svg" class="center" />

<span class="caption">Figure 4-6: A diagram of `&String` `s` pointing at
`String` `s1`

> 注意：使用 `&` 进行引用的相反操作是 _解引用_，通过解引用运算符 `*` 实现。我们将在第 8 章看到解引用运算符的一些用途，并在第 15 章讨论解引用的细节。

让我们更仔细地看看这里的函数调用：

```rust
{{#rustdoc_include ../listings/ch04-understanding-ownership/no-listing-07-reference/src/main.rs:here}}
```

`&s1` 语法允许我们创建一个 _指向_ `s1` 值的引用，但不拥有它。因为引用不拥有它，当引用不再使用时，它所指向的值不会被丢弃。

同样，函数的签名使用 `&` 来表示参数 `s` 的类型是引用。让我们添加一些解释性注释：

```rust
{{#rustdoc_include ../listings/ch04-understanding-ownership/no-listing-08-reference-with-annotations/src/main.rs:here}}
```

变量 `s` 有效的作用域与任何函数参数的作用域相同，但当 `s` 不再被使用时，通过引用指向的值不会被丢弃，因为 `s` 没有所有权。当函数以引用作为参数而不是实际值时，我们不需要返回这些值来归还所有权，因为我们从未拥有过所有权。

我们称创建引用的行为为 _borrowing_。就像现实生活中一样，如果一个人拥有某物，你可以从他们那里借用它。完成后，你必须归还它。你并不拥有它。

那么，如果我们试图修改正在借用的东西会怎样呢？请查看列表 4-6 中的代码。剧透警告：它不起作用！

<Listing number="4-6" file-name="src/main.rs" caption="Attempting to modify a borrowed value">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch04-understanding-ownership/listing-04-06/src/main.rs}}
```

</Listing>

这是错误信息：

```console
{{#include ../listings/ch04-understanding-ownership/listing-04-06/output.txt}}
```

正如变量默认是不可变的，引用也是不可变的。我们不允许修改通过引用访问到的内容。

### 可变引用

我们可以通过对列表 4-6 中的代码进行少量微调，使用 _mutable reference_ 来允许修改被借用的值：

<Listing file-name="src/main.rs">

```rust
{{#rustdoc_include ../listings/ch04-understanding-ownership/no-listing-09-fixes-listing-04-06/src/main.rs}}
```

</Listing>

首先，我们将 `s` 改为 `mut`。然后，我们使用 `&mut s` 创建一个可变的引用，在调用 `change` 函数时更新函数签名为 `some_string: &mut String`，这样就能明确表明 `change` 函数会修改它所借用的值。

可变引用有一个重大限制：如果你有一个对值的可变引用，你就不能再有其他对该值的引用。试图创建两个对 `s` 的可变引用的代码将会失败：

<Listing file-name="src/main.rs">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch04-understanding-ownership/no-listing-10-multiple-mut-not-allowed/src/main.rs:here}}
```

</Listing>

这是错误信息：

```console
{{#include ../listings/ch04-understanding-ownership/no-listing-10-multiple-mut-not-allowed/output.txt}}
```

此错误表明该代码无效，因为我们不能同时将 `s` 作为可变引用使用多次。第一次可变借用发生在 `r1` 中，并且必须持续到在 `println!` 中被使用为止，但在创建该可变引用及其使用之间，我们试图在 `r2` 中创建另一个可变引用，该引用借用的数据与 `r1` 相同。

防止同时拥有多个可变引用指向同一数据的限制虽然允许修改，但必须以非常可控的方式进行。这是新晋 Rust 开发者经常遇到的难题，因为大多数语言都允许随时进行修改。这种限制的优点在于，Rust 可以在编译时避免数据竞争。_数据竞争_类似于竞态条件，当以下三种情况同时发生时就会发生：

- 两个或更多指针同时访问同一数据。
- 至少有一个指针用于写入数据。
- 没有机制来同步对数据的访问。

数据竞争会导致未定义行为，在运行时试图追踪它们时可能会难以诊断和修复；Rust 通过拒绝编译包含数据竞争的代码来避免这个问题！

像往常一样，我们可以使用花括号创建新的作用域，从而允许多个可变引用存在，但不能是_同时_存在的：

```rust
{{#rustdoc_include ../listings/ch04-understanding-ownership/no-listing-11-muts-in-separate-scopes/src/main.rs:here}}
```

Rust 对结合可变和不可变引用的规则也类似。以下代码会引发错误：

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch04-understanding-ownership/no-listing-12-immutable-and-mutable-not-allowed/src/main.rs:here}}
```

这是错误提示：

```console
{{#include ../listings/ch04-understanding-ownership/no-listing-12-immutable-and-mutable-not-allowed/output.txt}}
```

哇！即使有一个不可变引用指向同一个值，也不能有可变引用存在。

使用不可变引用的用户不会期望该值突然在他们不知情的情况下发生变化！然而，多个不可变引用是允许的，因为仅读取数据的用户没有能力影响其他人的数据读取。

请注意，引用的作用域从引入它的位置开始，一直持续到最后一次使用该引用为止。例如，以下代码可以编译通过，因为不可变引用的最后使用是在 `println!` 中，在引入可变引用之前：

```rust
{{#rustdoc_include ../listings/ch04-understanding-ownership/no-listing-13-reference-scope-ends/src/main.rs:here}}
```

不可变引用 `r1` 和 `r2` 的作用域在最后一次使用 `println!` 之后结束，这发生在可変引用 `r3` 被创建之前。这些作用域不重叠，因此以下代码是允许的：编译器可以识别该引用在作用域结束之前的某个时刻不再被使用。

尽管借用错误有时令人沮丧，但请记住，是 Rust 编译器在编译时指出潜在的漏洞，并明确显示问题所在。这样你就无需去追踪为什么数据不是你预期的那样了。

### 悬空引用

在使用指针的语言中，很容易通过释放某些内存而保留指向该内存的指针，从而错误地创建出_悬空指针_——即指向可能已被他人使用的内存位置的指针。相比之下，在 Rust 中，编译器保证引用永远不会成为悬空引用：如果你有一个对数据的引用，编译器会确保数据不会在引用失效之前超出作用域。

让我们尝试创建一个悬空引用，看看 Rust 如何通过编译时错误来防止这种情况：

<Listing file-name="src/main.rs">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch04-understanding-ownership/no-listing-14-dangling-reference/src/main.rs}}
```

</Listing>

这是错误信息：

```console
{{#include ../listings/ch04-understanding-ownership/no-listing-14-dangling-reference/output.txt}}
```

这条错误信息涉及我们尚未讨论的功能：生命周期。我们将在第 10 章中详细讨论生命周期。但如果你忽略关于生命周期的部分，消息中确实包含了为什么这段代码存在问题的关键信息。

```text
this function's return type contains a borrowed value, but there is no value
for it to be borrowed from
```

让我们更仔细地看看 `dangle` 代码的每个阶段具体发生了什么：

<Listing file-name="src/main.rs">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch04-understanding-ownership/no-listing-15-dangling-reference-annotated/src/main.rs:here}}
```

</Listing>

因为 `s` 是在 `dangle` 内部创建的，当 `dangle` 代码执行完毕时，`s` 将被释放。但我们尝试返回对其的引用。这意味着这个引用将指向一个无效的 `String`。这是不可接受的！Rust 不允许我们这样做。

这里的解决方案是直接返回 `String`：

```rust
{{#rustdoc_include ../listings/ch04-understanding-ownership/no-listing-16-no-dangle/src/main.rs:here}}
```

这样就能毫无问题地运行。所有权被移出，也没有任何内存被释放。

### 引用的规则

让我们回顾一下关于引用的讨论内容：

- 在任何时候，你可以有一个_可变的引用_或任意数量的不可变引用。
- 引用必须始终有效。

接下来，我们将看看另一种类型的引用：切片。
