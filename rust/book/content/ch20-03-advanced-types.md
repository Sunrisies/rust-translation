## 高级类型

Rust 类型系统有一些我们目前提到但尚未讨论的特性。我们将首先总体介绍新类型，并探讨它们作为类型的价值所在。然后，我们会介绍类型别名，这是一种与新类型类似但语义略有不同的特性。此外，我们还将讨论 `!` 类型和动态大小类型。

<!-- Old headings. Do not remove or links may break. -->

<a id="using-the-newtype-pattern-for-type-safety-and-abstraction"></a>

### 使用新类型模式实现类型安全和抽象

本节假设您已经阅读了前面的章节[“使用新类型模式实现外部特质”][newtype]<!-- ignore -->。新类型模式对于超出目前讨论范围的任务也非常有用，包括静态确保值不会混淆以及指示值的单位。您在 Listing 20-16 中看到了使用新类型来指示单位的示例：请注意，`Millimeters` 和 `Meters` 结构体通过新类型封装了 `u32` 值。如果我们编写一个参数为 `Millimeters` 的函数，那么程序将无法编译，因为该程序可能会意外尝试用 `Meters` 类型或普通的 `u32` 调用该函数。

我们还可以使用新类型模式来抽象掉类型的某些实现细节：新类型可以暴露一个与私有内部类型不同的公共 API。

新类型还可以隐藏内部实现。例如，我们可以提供 `People` 类型来封装存储人员 ID 与其名称的 `HashMap<i32, String>`。使用 `People` 的代码只会与我们提供的公共 API 交互，比如向 `People` 集合添加姓名字符串的方法；这些代码无需知道我们在内部为名字分配了 `i32` ID。新类型模式是一种轻量级的封装方式，用于隐藏实现细节，我们在第 18 章的[“隐藏实现细节的封装”][encapsulation-that-hides-implementation-details]<!-- ignore -->章节中讨论过这一点。

<!-- Old headings. Do not remove or links may break. -->

<a id="creating-type-synonyms-with-type-aliases"></a>

### 类型同义词和类型别名

Rust 提供了声明 _类型别名_ 的能力，以便为现有类型赋予另一个名称。为此我们使用 `type` 关键字。例如，我们可以创建 `Kilometers` 别名来替代 `i32`，如下所示：

```rust
{{#rustdoc_include ../listings/ch20-advanced-features/no-listing-04-kilometers-alias/src/main.rs:here}}
```

现在，`Kilometers` 是 `i32` 的_同义词_；与我们在 Listing 20-16 中创建的 `Millimeters` 和 `Meters` 类型不同，`Kilometers` 并非一个独立的新型类型。具有 `Kilometers` 类型的数值将被视为与 `i32` 类型的数值相同：

```rust
{{#rustdoc_include ../listings/ch20-advanced-features/no-listing-04-kilometers-alias/src/main.rs:there}}
```

由于 `Kilometers` 和 `i32` 属于同一类型，我们可以添加两种类型的数值，并且可以将 `Kilometers` 值传递给接受 `i32` 参数的函数。然而，使用这种方法无法获得之前讨论的新类型模式所拥有的类型检查优势。换句话说，如果我们将 `Kilometers` 和 `i32` 的值混合在一起，编译器不会报错。

类型同义词的主要用途是减少重复。例如，我们可能有一个较长的类型定义如下：

```rust,ignore
Box<dyn Fn() + Send + 'static>
```

在函数签名中编写这种长类型以及在代码中多次标注该类型可能会非常繁琐且容易出错。想象一下 Listing 20-25 中的项目充满了这样的代码。

<Listing number="20-25" caption="Using a long type in many places">

```rust
{{#rustdoc_include ../listings/ch20-advanced-features/listing-20-25/src/main.rs:here}}
```

</Listing>

类型别名通过减少重复使代码更易于管理。在 Listing 20-26 中，我们为冗长的类型引入了名为 `Thunk` 的别名，并可以用较短的别名 `Thunk` 替换所有对该类型的使用。

<Listing number="20-26" caption="Introducing a type alias, `Thunk`, to reduce repetition">

```rust
{{#rustdoc_include ../listings/ch20-advanced-features/listing-20-26/src/main.rs:here}}
```

</Listing>

这样代码就更容易阅读和理解了！为类型别名选择有意义的名称也有助于明确表达意图（`thunk_` 是一个表示将在以后评估的代码词，因此它是存储闭包时的合适名称）。

类型别名也常用于 `Result<T, E>` 类型以减少重复。考虑标准库中的 `std::io` 模块。I/O 操作通常返回 `Result<T, E>` 来处理操作失败的情况。该库有一个 `std::io::Error` 结构体，表示所有可能的 I/O 错误。`std::io` 中的许多函数将返回 `Result<T, E>`，其中 `E` 为 `std::io::Error`，例如 `Write` trait 中的这些函数：

```rust,noplayground
{{#rustdoc_include ../listings/ch20-advanced-features/no-listing-05-write-trait/src/lib.rs}}
```

`Result<..., Error>` 这种类型被重复使用了很多次。因此，`std::io` 有这个类型别名声明：

```rust,noplayground
{{#rustdoc_include ../listings/ch20-advanced-features/no-listing-06-result-alias/src/lib.rs:here}}
```

由于该声明位于 `std::io` 模块中，我们可以使用完全限定的别名 `std::io::Result<T>`；也就是说，`Result<T, E>` 中的 `E` 被替换为 `std::io::Error`。`Write` trait 函数的签名看起来如下：

```rust,noplayground
{{#rustdoc_include ../listings/ch20-advanced-features/no-listing-06-result-alias/src/lib.rs:there}}
```

类型别名有两个作用：它使代码更易于编写，并且它在所有 `std::io` 中提供一致的接口。因为这是一个别名，所以它只是另一个 `Result<T, E>`，这意味着我们可以使用适用于 `Result<T, E>` 的任何方法，以及像 `?` 运算符这样的特殊语法。

### 永远不返回的 Never 类型

Rust 有一个特殊的类型名为 `!`，在类型理论术语中称为_空类型_，因为它没有值。我们更喜欢称它为_never 类型_，因为它代替了函数永远不会返回时的返回类型。以下是一个示例：

```rust,noplayground
{{#rustdoc_include ../listings/ch20-advanced-features/no-listing-07-never-type/src/lib.rs:here}}
```

这段代码被理解为“函数 `bar` 永远不返回”。永远不返回的函数被称为_发散函数_。我们无法创建 `!` 类型的数值，因此 `bar` 永远不可能返回。

但是一个无法创建值的类型有什么用呢？回想一下列表 2-5 中的代码，这是数猜游戏的一部分；我们在列表 20-27 中复制了部分内容。

<Listing number="20-27" caption="A `match` with an arm that ends in `continue`">

```rust,ignore
{{#rustdoc_include ../listings/ch02-guessing-game-tutorial/listing-02-05/src/main.rs:ch19}}
```

</Listing>

当时，我们跳过了这段代码中的一些细节。在第六章的[“`match` 控制流构造”][the-匹配-control-flow-construct]<!-- ignore -->部分，我们讨论过 `match` 分支必须返回相同类型的变量。因此，例如，以下代码无法工作：

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch20-advanced-features/no-listing-08-match-arms-different-types/src/main.rs:here}}
```

在这段代码中，`guess` 的类型必须是整数和字符串，而 Rust 要求 `guess` 只能有一种类型。那么，`continue` 会返回什么？在列表 20-27 中，一个分支可以返回 `u32`，另一个分支以 `continue` 结尾，这怎么可能呢？

正如你可能已经猜到的那样，`continue` 具有 `!` 值。也就是说，当 Rust 计算 `guess` 的类型时，它会查看两个 `match` 分支：一个值为 `u32`，另一个为 `!` 值。由于 `!` 永远无法有值，Rust 决定 `guess` 的类型是 `u32`。

描述这种行为的正式方式是，类型为 `!` 的表达式可以被强制转换为任何其他类型。我们允许在 `match` 分支末尾使用 `continue`，因为 `continue` 不返回任何值；相反，它会将控制流回到循环顶部，因此在 `Err` 情况下，我们不会将任何值赋给 `guess`。

`never` 类型在 `panic!` 宏中也有用。回想一下我们在 `Option<T>` 值上调用 `unwrap` 函数以产生一个值或引发 panic 的定义：

```rust,ignore
{{#rustdoc_include ../listings/ch20-advanced-features/no-listing-09-unwrap-definition/src/lib.rs:here}}
```

在这段代码中，与清单 20-27 中的 `match` 类似：Rust 发现 `val` 的类型为 `T`，而 `panic!` 的类型为 `!`，因此整个 `match` 表达式的结果为 `T`。这段代码是有效的，因为 `panic!` 不会产生任何值，而是会终止程序。在 `None` 情况下，我们不会从 `unwrap` 返回任何值。

最后一个类型为 `!` 的表达式是一个循环：

```rust,ignore
{{#rustdoc_include ../listings/ch20-advanced-features/no-listing-10-loop-returns-never/src/main.rs:here}}
```

在这里，循环永远不会结束，因此 `!` 是表达式的类型。然而，如果我们包含 `break`，情况就不一样了，因为循环会在遇到 `break` 时终止。

### 动态大小类型与 `Sized` 特质

Rust 需要了解其类型的某些细节，例如为特定类型的值分配多少空间。这使得其类型系统的某个方面在最初看起来有些混乱：即 _动态大小类型_的概念。这些类型有时被称为 _DSTs_ 或 _未指定大小的类型_，它们允许我们编写使用仅在运行时才能确定的大小的值的代码。

让我们详细探讨一下我们在本书中一直使用的动态大小类型 `str` 的细节。没错，不是 `&str`，而是单独的 `str`，是一种动态类型系统（DST）。在许多情况下，比如存储用户输入的文本时，我们在运行时无法知道字符串的长度。这意味着我们无法创建类型为 `str` 的变量，也无法接受类型为 `str` 的参数。考虑以下代码，它无法运行：

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch20-advanced-features/no-listing-11-cant-create-str/src/main.rs:here}}
```

Rust 需要知道为特定类型的任何值分配多少内存，并且该类型的所有值必须使用相同量的内存。如果 Rust 允许我们编写这样的代码，这两个 `str` 值将需要占用相同的空间。但它们具有不同的长度：`s1` 需要12字节的存储空间，`s2` 需要15字节。这就是无法创建持有动态大小类型的变量的原因。

那么我们应该怎么做呢？在这种情况下，你已经知道答案了：我们将 `s1` 和 `s2` 的类型从 `str` 改为字符串切片（`&str`）。回想第4章中的[“字符串切片”][string-slices]<!-- ignore -->部分，切片数据结构仅存储起始位置和切片长度。因此，虽然 `&T` 是一个存储 `T` 所在内存地址的单值，但字符串切片是_两个_值：`str` 的地址及其长度。这样，我们可以在编译时知道字符串切片值的大小：它是 `usize` 长度的两倍。也就是说，无论所引用的字符串有多长，我们始终能知道字符串切片的大小。通常，这就是 Rust 中使用动态大小类型的方式：它们额外包含一些元数据来存储动态信息的大小。动态大小类型的黄金规则是，我们必须总是将动态大小类型的值放在某种指针之后。

我们可以将 `str` 与各种指针结合使用：例如 `Box<str>` 或 `Rc<str>`。实际上，你之前见过这种情况，只是使用的是不同的动态大小类型：特质（traits）。每个特质都是一种动态大小类型，我们可以通过特质名称来引用它。在第18章的“使用特质对象来抽象共享行为”部分中，我们提到要将特质作为特质对象使用，必须将其放在指针之后，如 `&dyn Trait` 或 `Box<dyn Trait>`（`Rc<dyn Trait>` 也可以）。

为了处理 DSTs，Rust 提供了 `Sized` 特质来判断类型的大小是否在编译时已知。对于大小在编译时已知的类型，该特质会自动实现。此外，Rust 会隐式地为每个泛型函数添加对 `Sized` 的约束。也就是说，像这样的泛型函数定义：

```rust,ignore
{{#rustdoc_include ../listings/ch20-advanced-features/no-listing-12-generic-fn-definition/src/lib.rs}}
```

实际上会被视为如下写法：

```rust,ignore
{{#rustdoc_include ../listings/ch20-advanced-features/no-listing-13-generic-implicit-sized-bound/src/lib.rs}}
```

默认情况下，泛型函数仅适用于在编译时已知大小的类型。但是，你可以使用以下特殊语法来放宽这一限制：

```rust,ignore
{{#rustdoc_include ../listings/ch20-advanced-features/no-listing-14-generic-maybe-sized/src/lib.rs}}
```

`?Sized` 表示“`T` 可能是或不是 `Sized`”，这种表示法会覆盖泛型类型必须在编译时已知大小的规则。具有此含义的 `?Trait` 语法仅适用于 `Sized`，不适用于其他任何特质。

另外需要注意的是，我们将 `t` 参数的类型从 `T` 更改为 `&T`。因为该类型可能不是 `Sized`，我们需要将其放在某种指针之后使用。在这种情况下，我们选择了引用形式。

接下来，我们将讨论函数和闭包！

[encapsulation-that-hides-implementation-details]: ch18-01-what-is-oo.html#encapsulation-that-hides-implementation-details
[string-slices]: ch04-03-slices.html#string-slices
[the-match-control-flow-construct]: ch06-02-match.html#the-match-control-flow-construct
[using-trait-objects-to-abstract-over-shared-behavior]: ch18-02-trait-objects.html#using-trait-objects-to-abstract-over-shared-behavior
[newtype]: ch20-02-advanced-traits.html#implementing-external-traits-with-the-newtype-pattern
