## 高级函数与闭包

本部分探讨与函数和闭包相关的一些高级特性，包括函数指针和返回闭包。

### 函数指针

我们已经讨论了如何将闭包传递给函数；你还可以将普通函数传递给函数！当你需要传递已经定义好的函数而不是创建新的闭包时，这种技术非常有用。函数会被隐式转换为 `fn` 类型（小写 _f_），不要与 `Fn` 闭包特质混淆。`fn` 类型被称为_函数指针_。使用函数指针传递函数可以让你将函数作为其他函数的参数使用。

指定参数为函数指针的语法与闭包类似，如清单 20-28 所示，我们定义了一个名为 `add_one` 的函数，该函数在其参数上增加 1。`do_twice` 函数接受两个参数：一个指向任何接受 `i32` 参数并返回 `i32` 值的函数的函数指针，以及一个 `i32` 值。`do_twice` 函数会两次调用 `f` 函数，传递 `arg` 值，然后将两个函数调用的结果相加。在 `main` 函数中，我们使用 `add_one` 和 `5` 作为参数调用 `do_twice`。

<Listing number="20-28" file-name="src/main.rs" caption="Using the `fn` type to accept a function pointer as an argument">

```rust
{{#rustdoc_include ../listings/ch20-advanced-features/listing-20-28/src/main.rs}}
```

</Listing>

这段代码会输出 `The answer is: 12`。我们在 `do_twice` 中指定参数 `f` 是一个 `fn`，它接受一个类型为 `i32` 的参数并返回一个 `i32` 值。然后我们可以在 `do_twice` 的主体中调用 `f`。在 `main` 中，我们可以将函数名 `add_one` 作为第一个参数传递给 `do_twice`。

与闭包不同，`fn` 是一种类型而非特质，因此我们直接将 `fn` 指定为参数类型，而不是使用 `Fn` 特质作为泛型类型参数来声明。

函数指针实现了所有三个闭包特质（`Fn`、`FnMut` 和 `FnOnce`），这意味着你可以始终将函数指针作为期望闭包的函数的参数。最好使用泛型类型和其中一个闭包特质来编写函数，这样你的函数就可以接受函数或闭包。

话虽如此，一个适合仅接受 `fn` 而不接受闭包的例子是当与没有闭包的外部代码交互时：C 函数可以接收函数作为参数，但 C 语言没有闭包。

作为一个可以使用内联定义的闭包或命名函数的例子，让我们看看标准库中的 `Iterator` trait 提供的 `map` 方法的应用。为了使用 `map` 方法将数字向量转换为字符串向量，我们可以像清单 20-29 中那样使用闭包。

<Listing number="20-29" caption="Using a closure with the `map` method to convert numbers to strings">

```rust
{{#rustdoc_include ../listings/ch20-advanced-features/listing-20-29/src/main.rs:here}}
```

</Listing>

或者，我们可以将函数命名为 `map` 的参数，而不是闭包。清单 20-30 展示了这种用法的情况。

<Listing number="20-30" caption="Using the `String::to_string` function with the `map` method to convert numbers to strings">

```rust
{{#rustdoc_include ../listings/ch20-advanced-features/listing-20-30/src/main.rs:here}}
```

</Listing>

请注意，我们必须使用我们在[“高级特质”][advanced-traits]<!-- ignore -->部分讨论的全限定语法，因为存在多个名为 `to_string` 的函数。

在这里，我们使用由 `ToString` trait 定义的 `to_string` 函数，标准库为实现了 `Display` 的任何类型都提供了此函数。

从第 6 章的[“枚举值”][枚举-values]<!-- ignore -->部分回忆起，我们定义的每个枚举变体的名称也成为了初始化器函数。我们可以将这些初始化器函数作为实现闭包特质的函数指针使用，这意味着我们可以把初始化器函数指定为接受闭包的方法的参数，如清单 20-31 所示。

<Listing number="20-31" caption="Using an enum initializer with the `map` method to create a `Status` instance from numbers">

```rust
{{#rustdoc_include ../listings/ch20-advanced-features/listing-20-31/src/main.rs:here}}
```

</Listing>

在这里，我们使用 `map` 所处理的范围内的每个 `u32` 值，通过 `Status::Value` 的初始化器函数来创建 `Status::Value` 实例。有些人喜欢这种风格，而有些人则更喜欢使用闭包。它们编译成相同的代码，因此选择对您更清晰的风格即可。

### 返回闭包

闭包由特质表示，这意味着你不能直接返回闭包。在大多数情况下，如果你想返回一个特质，可以改用实现该特质的具体类型作为函数的返回值。然而，对于闭包通常无法这样做，因为闭包没有可返回的具体类型；例如，如果闭包捕获了来自其作用域中的任何值，你就不能将函数指针 `fn` 用作返回类型。

相反，你通常会使用我们在第10章中学习的 `impl Trait` 语法。你可以使用 `Fn`、`FnOnce` 和 `FnMut` 来返回任何函数类型。例如，清单 20-32 中的代码可以完美编译。

<Listing number="20-32" caption="Returning a closure from a function using the `impl Trait` syntax">

```rust
{{#rustdoc_include ../listings/ch20-advanced-features/listing-20-32/src/lib.rs}}
```

</Listing>

然而，正如我们在第13章的[“推断和注释闭包类型”][闭包-types]<!-- ignore -->部分所指出的，每个闭包都是独立的类型。如果你需要处理多个具有相同签名但实现不同的函数，就需要使用特质对象。考虑一下如果像清单 20-33 中那样编写代码会发生什么。

<Listing file-name="src/main.rs" number="20-33" caption="Creating a `Vec<T>` of closures defined by functions that return `impl Fn` types">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch20-advanced-features/listing-20-33/src/main.rs}}
```

</Listing>

这里有两个函数，`returns_closure` 和 `returns_initialized_closure`，它们都返回 `impl Fn(i32) -> i32`。请注意，尽管它们实现了相同的类型，但它们返回的闭包是不同的。如果我们尝试编译这段代码，Rust 会告诉我们它无法工作：

```text
{{#include ../listings/ch20-advanced-features/listing-20-33/output.txt}}
```

错误信息表明，每当我们返回一个 `impl Trait` 时，Rust 会创建一个独特的_不透明类型_，这种类型我们无法看到 Rust 为我们构建的细节，也无法猜测 Rust 将生成的类型以让我们自己编写。因此，即使这两个函数返回的闭包实现了相同的特质 `Fn(i32) -> i32`，Rust 为每个闭包生成的不透明类型是不同的。（这类似于 Rust 为不同的异步块生成不同的具体类型，即使它们具有相同的输出类型，我们在第17章的[“`Pin` 类型和 `Unpin` 特质”][future-types]<!-- ignore -->中看到过。）我们已经多次看到解决这个问题的方法：我们可以使用特质对象，如清单 20-34 所示。

<Listing number="20-34" caption="Creating a `Vec<T>` of closures defined by functions that return `Box<dyn Fn>` so that they have the same type">

```rust
{{#rustdoc_include ../listings/ch20-advanced-features/listing-20-34/src/main.rs:here}}
```

</Listing>

这段代码可以顺利编译。关于特质对象的更多信息，请参阅第18章中的“使用特质对象来抽象共享行为”部分。

接下来，让我们来看看宏！

[advanced-traits]: ch20-02-advanced-traits.html#advanced-traits
[enum-values]: ch06-01-defining-an-enum.html#enum-values
[closure-types]: ch13-01-closures.html#closure-type-inference-and-annotation
[future-types]: ch17-03-more-futures.html
[trait-objects]: ch18-02-trait-objects.html
