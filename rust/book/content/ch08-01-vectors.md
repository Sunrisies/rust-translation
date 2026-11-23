## 使用向量存储值列表

我们将首先研究的一种集合类型是 `Vec<T)`，也称为向量。向量允许你在单一数据结构中存储多个值，所有值在内存中相邻排列。向量只能存储相同类型的元素。当你有一个项目列表时，例如文件中的文本行或购物篮中的商品价格，使用向量非常有用。

### 创建新的向量

要创建一个新的空向量，我们调用 `Vec::new` 函数，如清单 8-1 所示。

<Listing number="8-1" caption="Creating a new, empty vector to hold values of type `i32`">

```rust
{{#rustdoc_include ../listings/ch08-common-collections/listing-08-01/src/main.rs:here}}
```

</Listing>

请注意，我们在这里添加了类型注解。由于我们没有向该向量插入任何值，Rust 不知道我们要存储什么类型的元素。这是很重要的一点。向量是使用泛型实现的；我们将在第 10 章中介绍如何将自己的类型与泛型结合使用。目前只需知道标准库提供的 `Vec<T>` 类型可以容纳任何类型。当我们创建用于存储特定类型的向量时，可以在尖括号内指定该类型。在清单 8-1 中，我们告诉 Rust 中的 `Vec<T>` 将包含 `i32` 类型的元素。

通常，你会用初始值创建一个 `Vec<T)`，Rust 会自动推断你要存储的值的类型，因此很少需要添加类型注解。Rust 提供了方便的 `vec!` 宏，它可以创建一个新的向量来保存你提供的数值。清单 8-2 创建了一个新的 `Vec<i32>`，其中包含了 `1`、`2` 和 `3` 这些数值。整数类型为 `i32`，因为这是默认的整数类型，正如我们在第 3 章的“数据类型”部分所讨论的。

<Listing number="8-2" caption="Creating a new vector containing values">

```rust
{{#rustdoc_include ../listings/ch08-common-collections/listing-08-02/src/main.rs:here}}
```

</Listing>

由于我们给出了初始的 `i32` 值，Rust 可以推断出 `v` 的类型是 `Vec<i32)`，因此不需要类型注解。接下来，我们将探讨如何修改向量。

### 更新向量

要创建向量并添加元素，我们可以使用 `push` 方法，如清单 8-3 所示。

<Listing number="8-3" caption="Using the `push` method to add values to a vector">

```rust
{{#rustdoc_include ../listings/ch08-common-collections/listing-08-03/src/main.rs:here}}
```

</Listing>

与任何变量一样，如果我们希望改变其值，需要使用 `mut` 关键字使其可修改，正如第3章所讨论的。我们放入其中的数字均为 `i32` 类型，Rust 会根据数据自动推断此类型，因此不需要 `Vec<i32>` 注释。

### 读取向量元素

有两种方式可以引用存储在向量中的值：通过索引或使用 `get` 方法。在以下示例中，我们标注了这些函数返回值的类型，以便更清晰地说明。

列表 8-4 展示了访问向量中值的两种方式，包括索引语法和 `get` 方法。

<Listing number="8-4" caption="Using indexing syntax and using the `get` method to access an item in a vector">

```rust
{{#rustdoc_include ../listings/ch08-common-collections/listing-08-04/src/main.rs:here}}
```

</Listing>

这里有一些细节需要注意。我们使用索引值 `2` 来获取第三个元素，因为向量按数字索引，从零开始。使用 `&` 和 `[]` 可以获取该索引位置元素的引用。当使用 `get` 方法并传入索引作为参数时，我们将得到 `Option<&T>`，这可以与 `match` 结合使用。

Rust 提供了这两种方式来引用元素，这样你就可以选择程序在尝试访问超出现有元素范围的索引值时如何表现。例如，让我们看看当有一个包含五个元素的向量，然后分别用两种技术尝试访问索引为 100 的元素时会发生什么，如列表 8-5 所示。

<Listing number="8-5" caption="Attempting to access the element at index 100 in a vector containing five elements">

```rust,should_panic,panics
{{#rustdoc_include ../listings/ch08-common-collections/listing-08-05/src/main.rs:here}}
```

</Listing>

运行此代码时，第一个 `[]` 方法会导致程序崩溃，因为它引用了一个不存在的元素。这种方法最适合用于确保程序在试图访问超出向量末尾的元素时会崩溃的情况。

当 `get` 方法传入一个超出向量范围的索引时，它会返回 `None` 而不会崩溃。如果正常情况下偶尔会出现访问超出向量范围的元素的情况，你可以使用这种方法。这样你的代码就会包含逻辑来处理 `Some(&element)` 或 `None` 两种情况，如第6章所述。例如，该索引可能来自用户输入的数字。如果他们不小心输入了过大的数字，程序会得到 `None` 值，你可以告知用户当前向量中有多少个元素，并给它们另一个机会输入有效值。这比因拼写错误导致程序崩溃更友好！

当程序拥有有效的引用时，借用检查器会强制执行所有权和借用规则（详见第4章），以确保该引用及对向量内容的任何其他引用都保持有效。请记住，同一作用域中不能同时存在可变引用和不可变引用这一规则。这一规则适用于清单 8-6，其中我们持有对向量第一个元素的不可变引用，并试图在末尾添加元素。如果我们随后在函数中尝试引用该元素，程序将无法运行。

<Listing number="8-6" caption="Attempting to add an element to a vector while holding a reference to an item">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch08-common-collections/listing-08-06/src/main.rs:here}}
```

</Listing>

编译此代码会引发以下错误：

```console
{{#include ../listings/ch08-common-collections/listing-08-06/output.txt}}
```

清单 8-6 中的代码看起来应该能正常工作：为什么对第一个元素的引用需要关心向量末尾的变化呢？这个错误源于向量的运作方式：由于向量在内存中相邻存储值，如果向量没有足够的空间将所有元素紧密排列在当前存储位置，向向量末尾添加新元素可能需要分配新的内存并将旧元素复制到新空间。在这种情况下，对第一个元素的引用将指向已释放的内存。借用规则防止程序陷入这种状况。

> 注意：关于 `Vec<T>` 类型实现细节的更多信息，请参阅 [“The Rustonomicon”][nomicon]。

### 遍历向量中的值

为了依次访问向量中的每个元素，我们需要遍历所有元素，而不是使用索引来逐一访问。清单 8-7 展示了如何使用 `for` 循环获取 `i32` 值向量中每个元素的不可变引用并打印它们。

<Listing number="8-7" caption="Printing each element in a vector by iterating over the elements using a `for` loop">

```rust
{{#rustdoc_include ../listings/ch08-common-collections/listing-08-07/src/main.rs:here}}
```

</Listing>

我们还可以遍历可变向量中每个元素的可变引用，以便对所有元素进行修改。清单 8-8 中的 `for` 循环会将每个元素增加 `50`。

<Listing number="8-8" caption="Iterating over mutable references to elements in a vector">

```rust
{{#rustdoc_include ../listings/ch08-common-collections/listing-08-08/src/main.rs:here}}
```

</Listing>

要更改可变引用所指向的值，我们必须使用 `*` 解引用运算符来获取 `i` 中的值，然后才能使用 `+=` 运算符。我们将在第 15 章的“遵循值的引用”[deref]<!-- ignore -->部分进一步讨论解引用运算符。

无论是不可变还是可变的向量，通过借用检查器的规则，遍历它们是安全的。如果我们在清单 8-7 和清单 8-8 的 `for` 循环体中尝试插入或删除元素，将会出现类似于清单 8-6 中代码出现的编译器错误。`for` 循环所持有的向量引用防止了对整个向量的同时修改。

### 使用枚举存储多种类型

向量只能存储相同类型的数值。这可能会带来不便；确实有一些场景需要存储不同类型的项目列表。幸运的是，枚举的变体是在同一个枚举类型下定义的，因此当我们需要用一种类型来表示不同类型元素时，就可以定义并使用枚举！

例如，假设我们想从电子表格中的一行获取值，该行的某些列包含整数、浮点数和字符串。我们可以定义一个枚举，其变体将存储不同的数值类型，并且所有枚举变体都被视为同一类型：即枚举本身的类型。然后，我们可以创建一个向量来保存这个枚举，从而最终能够保存不同类型的元素。我们在清单 8-9 中展示了这一点。

<Listing number="8-9" caption="Defining an enum to store values of different types in one vector">

```rust
{{#rustdoc_include ../listings/ch08-common-collections/listing-08-09/src/main.rs:here}}
```

</Listing>

Rust 需要在编译时知道向量中将包含哪些类型，以便准确确定存储每个元素所需的堆内存大小。我们还必须明确该向量允许使用哪些类型。如果 Rust 允许向量持有任何类型，那么其中一个或多个类型可能会导致对向量元素的操作出现错误。使用枚举和 `match` 表达式意味着 Rust 会在编译时确保处理所有可能的情形，如第6章所述。

如果你不知道程序在运行时将用于存储在向量中的完整类型集合，枚举技术将无法使用。相反，你可以使用 trait object，这将在第18章中讨论。

既然我们已经讨论了一些使用向量的常见方法，请务必查看标准库为 `Vec<T>` 定义的所有有用方法的 [API 文档][vec-api]<!-- ignore -->。例如，除了 `push` 之外，`pop` 方法会移除并返回最后一个元素。

### 丢弃向量及其元素

像其他任何 `struct` 一样，当向量超出作用域时会被释放，如清单 8-10 所示。

<Listing number="8-10" caption="Showing where the vector and its elements are dropped">

```rust
{{#rustdoc_include ../listings/ch08-common-collections/listing-08-10/src/main.rs:here}}
```

</Listing>

当向量被释放时，其所有内容也会被释放，这意味着它持有的整数也会被清理。借用检查器确保对向量内容的引用仅在向量本身有效时使用。

让我们继续讨论下一个集合类型：`String`！

[data-types]: ch03-02-data-types.html#data-types
[nomicon]: ../nomicon/vec/vec.html
[vec-api]: ../std/vec/struct.Vec.html
[deref]: ch15-02-deref.html#following-the-pointer-to-the-value-with-the-dereference-operator
