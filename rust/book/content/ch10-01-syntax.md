## 通用数据类型

我们使用泛型来为函数签名或结构体等项创建定义，然后可以将这些定义应用于多种不同的具体数据类型。首先让我们看看如何使用泛型定义函数、结构体、枚举和方法。之后，我们将讨论泛型对代码性能的影响。

### 在函数定义中

当定义使用泛型的函数时，我们将泛型放在函数的签名中，就像通常指定参数和返回值的类型一样。这样做使我们的代码更加灵活，为调用者提供更多的功能，同时避免代码重复。

继续以 `largest` 函数为例，列表 10-4 展示了两个都用于查找切片中最大值的函数。然后我们将这两个函数合并成一个使用泛型的单一函数。

<Listing number="10-4" file-name="src/main.rs" caption="Two functions that differ only in their names and in the types in their signatures">

```rust
{{#rustdoc_include ../listings/ch10-generic-types-traits-and-lifetimes/listing-10-04/src/main.rs:here}}
```

</Listing>

`largest_i32` 函数是我们在列表 10-3 中提取的，用于查找切片中的最大 `i32` 值。`largest_char` 函数则用于查找切片中的最大 `char` 值。这两个函数的代码体相同，因此我们可以通过在单个函数中引入一个泛型类型参数来消除重复。

为了在新单一函数中参数化类型，我们需要为类型参数命名，就像为函数的值参数命名一样。你可以使用任何标识符作为类型参数名。但我们将使用 `T`，因为按照惯例，Rust 中的类型参数名称通常很短，往往只是一个字母，而 Rust 的类型命名约定是 UpperCamelCase。作为 _type_ 的缩写，`T` 是大多数 Rust 程序员的默认选择。

当我们在函数体中使用参数时，必须在签名中声明该参数名，以便编译器知道该名的含义。同样，当我们在函数签名中使用类型参数名时，也必须在使用之前声明该类型参数名。为了定义泛型 `largest` 函数，我们将类型名称声明放在尖括号 `<>` 内，位于函数名称和参数列表之间。

```rust,ignore
fn largest<T>(list: &[T]) -> &T {
```

我们将这个定义理解为“函数 `largest` 是一个针对某种类型 `T` 的泛型函数”。该函数有一个名为 `list` 的参数，它是一个类型为 `T` 的值切片。`largest` 函数将返回同一个类型 `T` 值的引用。

列表 10-5 展示了使用泛型数据类型的 `largest` 函数定义。该列表还说明了如何用 `i32` 值切片或 `char` 值来调用该函数。请注意，目前这段代码无法编译。

<Listing number="10-5" file-name="src/main.rs" caption="The `largest` function using generic type parameters; this doesn’t compile yet">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch10-generic-types-traits-and-lifetimes/listing-10-05/src/main.rs}}
```

</Listing>

如果我们现在编译这段代码，将会出现以下错误：

```console
{{#include ../listings/ch10-generic-types-traits-and-lifetimes/listing-10-05/output.txt}}
```

帮助文本提到了 `std::cmp::PartialOrd`，这是一个特质（trait），我们将在下一节讨论特质。目前来说，这个错误表明 `largest` 函数的实现并不适用于所有可能的 `T` 类型。因为我们在函数体中需要比较类型为 `T` 的值，所以我们只能使用那些值可以排序的类型。为了支持比较操作，标准库提供了 `std::cmp::PartialOrd` 特质，你可以对这些类型实现该特质（有关此特质的更多信息，请参见附录 C）。要修复列表 10-5，我们可以遵循帮助文本的建议，将适用于 `T` 的类型限制为仅那些实现了 `PartialOrd` 的类型。这样代码就能编译了，因为标准库同时实现了 `i32` 和 `char` 的 `PartialOrd` 特质。

### 在结构体定义中

我们还可以使用 `<>` 语法在一个或多个字段中使用泛型类型参数来定义结构体。列表 10-6 定义了一个 `Point<T>` 结构体，用于存储任意类型的 `x` 和 `y` 坐标值。

<Listing number="10-6" file-name="src/main.rs" caption="A `Point<T>` struct that holds `x` and `y` values of type `T`">

```rust
{{#rustdoc_include ../listings/ch10-generic-types-traits-and-lifetimes/listing-10-06/src/main.rs}}
```

</Listing>

在结构体定义中使用泛型的语法与函数定义中的类似。首先，我们在结构体名称之后用尖括号括起类型参数的名称。然后，在结构体定义中使用该泛型类型，而原本会指定具体数据类型的地方则使用其他类型。

请注意，由于我们仅使用了一个泛型类型来定义 `Point<T)`，因此该定义表明 `Point<T>` 结构体对某个类型 `T` 是泛型的，而字段 `x` 和 `y` 都是相同的类型，无论该类型是什么。如果我们创建一个具有不同类型值的 `Point<T>` 实例，如清单 10-7 所示，我们的代码将无法编译。

<Listing number="10-7" file-name="src/main.rs" caption="The fields `x` and `y` must be the same type because both have the same generic data type `T`.">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch10-generic-types-traits-and-lifetimes/listing-10-07/src/main.rs}}
```

</Listing>

在示例中，当我们将整数值 `5` 赋给 `x` 时，我们让编译器知道对于这个 `Point<T>` 实例来说，泛型类型 `T` 将是整数。然后，当我们为 `y` 指定 `4.0`，而我们知道 `x` 具有相同的类型时，将会出现类型不匹配错误。

```console
{{#include ../listings/ch10-generic-types-traits-and-lifetimes/listing-10-07/output.txt}}
```

为了定义一个 `Point` 结构体，其中 `x` 和 `y` 都是泛型但可能具有不同的类型，我们可以使用多个泛型类型参数。例如，在清单 10-8 中，我们将 `Point` 的定义改为对类型 `T` 和 `U` 是泛型的，其中 `x` 的类型为 `T`，`y` 的类型为 `U`。

<Listing number="10-8" file-name="src/main.rs" caption="A `Point<T, U>` generic over two types so that `x` and `y` can be values of different types">

```rust
{{#rustdoc_include ../listings/ch10-generic-types-traits-and-lifetimes/listing-10-08/src/main.rs}}
```

</Listing>

现在所有显示的 `Point` 实例都是允许的！你可以在一个定义中使用任意多的泛型类型参数，但使用超过几个会使代码难以阅读。如果你发现代码中需要大量泛型类型，可能表明你的代码需要重构为更小的部分。

### 在枚举定义中

就像对结构体所做的那样，我们可以定义枚举来在其变体中包含泛型数据类型。让我们再看看标准库提供的 `Option<T>` 枚举，我们在第 6 章中使用了它：

```rust
enum Option<T> {
    Some(T),
    None,
}
```

现在这个定义应该对你更有意义了。如你所见，`Option<T>` 枚举对类型 `T` 是泛型的，并且有两个变体：`Some`，用于保存一个类型为 `T` 的值；以及 `None` 变体，不保存任何值。通过使用 `Option<T>` 枚举，我们可以表达可选值的抽象概念，由于 `Option<T>` 是泛型的，无论可选值是什么类型，我们都可以使用这种抽象。

枚举也可以使用多个泛型类型。我们在第 9 章中使用的 `Result` 枚举的定义就是一个例子：

```rust
enum Result<T, E> {
    Ok(T),
    Err(E),
}
```

`Result` 枚举是通用的，支持两种类型 `T` 和 `E`，并包含两个变体：`Ok`，用于保存类型为 `T` 的值；以及 `Err`，用于保存类型为 `E` 的值。这种定义使得在可能成功（返回类型为 `T` 的值）或失败（返回类型为 `E` 的错误）的操作中，可以方便地使用 `Result` 枚举。实际上，我们在清单 9-3 中打开文件时就是如此，当文件成功打开时，`T` 被定义为 `std::fs::File`，而当出现问题时，`E` 被定义为 `std::io::Error`。

当你在代码中看到多个结构体或枚举定义，它们仅通过所存储的值类型不同时，可以通过使用通用类型来避免重复。

### 在方法定义中

我们可以像第 5 章那样在结构体和枚举上实现方法，并在其定义中使用通用类型。清单 10-9 展示了我们在清单 10-6 中定义的 `Point<T>` 结构体，该结构体上实现了名为 `x` 的方法。

<Listing number="10-9" file-name="src/main.rs" caption="Implementing a method named `x` on the `Point<T>` struct that will return a reference to the `x` field of type `T`">

```rust
{{#rustdoc_include ../listings/ch10-generic-types-traits-and-lifetimes/listing-10-09/src/main.rs}}
```

</Listing>

在这里，我们在 `Point<T>` 上定义了一个名为 `x` 的方法，该方法返回字段 `x` 中数据的引用。

请注意，必须在 `impl` 之后声明 `T`，以便使用 `T` 来指定我们正在为 `Point<T>` 类型实现方法。通过在 `impl` 之后将 `T` 声明为通用类型，Rust 可以识别 `Point` 中的尖括号中的类型是一个通用类型而非具体类型。我们可以为这个通用参数选择与结构体定义中声明的通用参数不同的名称，但使用相同的名称是常规做法。如果你在 `impl` 中声明了通用类型的方法，那么该方法将在该类型的任何实例上被定义，无论最终替代通用类型的具体类型是什么。

我们在为类型定义方法时也可以对通用类型指定约束。例如，我们可以仅针对 `Point<f32>` 实例实现方法，而不是针对具有任意通用类型的 `Point<T>` 实例实现方法。在清单 10-10 中，我们使用了具体类型 `f32`，这意味着我们在 `impl` 之后不声明任何类型。

<Listing number="10-10" file-name="src/main.rs" caption="An `impl` block that only applies to a struct with a particular concrete type for the generic type parameter `T`">

```rust
{{#rustdoc_include ../listings/ch10-generic-types-traits-and-lifetimes/listing-10-10/src/main.rs:here}}
```

</Listing>

此代码表示类型 `Point<f32>` 将拥有 `distance_from_origin` 方法；而其他类型的 `Point<T]`（其中 `T` 不是 `f32` 类型）则不会定义此方法。该方法用于计算我们的点与坐标 (0.0, 0.0) 处的点的距离，并使用仅适用于浮点类型的数学运算。

在结构体定义中使用的泛型类型参数并不总是与该结构体方法签名中使用的类型相同。列表 10-11 使用泛型类型 `X1` 和 `Y1` 来表示 `Point` 结构体，并使用 `X2` 和 `Y2` 表示 `mixup` 方法签名，以使示例更清晰。该方法会创建一个新的 `Point` 实例，其 `x` 值来自 `self` 中的 `Point`（类型为 `X1`），而 `y` 值来自传入的 `Point`（类型为 `Y2`）。

<Listing number="10-11" file-name="src/main.rs" caption="A method that uses generic types that are different from its struct’s definition">

```rust
{{#rustdoc_include ../listings/ch10-generic-types-traits-and-lifetimes/listing-10-11/src/main.rs}}
```

</Listing>

在 `main` 函数中，我们定义了一个 `Point` 结构体，其 `x` 值为 `i32`（`5`），`y` 值为 `f64`（`10.4`）。`p2` 变量是一个 `Point` 结构体，其 `x` 值为一个字符串切片（`"Hello"`），`y` 值为一个字符（`c`）。对 `p1` 调用 `mixup` 方法并传入 `p2` 参数后，我们得到 `p3`，其 `x` 值为 `i32`，因为 `x` 来自 `p1`。`p3` 的 `y` 值为一个字符，因为 `y` 来自 `p2`。`println!` 宏调用会输出 `p3.x = 5, p3.y = c`。

此示例的目的是展示一种情况：某些泛型参数通过 `impl` 声明，而某些参数则通过方法定义声明。在这里，泛型参数 `X1` 和 `Y1` 在 `impl` 之后声明，因为它们与结构体定义相关。而泛型参数 `X2` 和 `Y2` 则在 `fn mixup` 之后声明，因为它们仅与方法相关。

### 使用泛型的代码性能

您可能想知道使用泛型类型参数是否会有运行时开销。好消息是，使用泛型类型不会使程序运行速度比使用具体类型慢。

Rust 通过在编译时使用泛型对代码进行单态化来实现这一点。_单态化_ 是将泛型代码转换为具体代码的过程，通过填充在编译时使用的具体类型来实现。在这一过程中，编译器执行的步骤与我们在列表 10-5 中创建泛型函数的步骤相反：编译器会查看所有调用泛型代码的地点，并生成用于这些泛型代码所调用的具体类型的代码。

让我们通过使用标准库中的泛型 `Option<T>` 枚举来观察其工作原理：

```rust
let integer = Some(5);
let float = Some(5.0);
```

当 Rust 编译此代码时，它会进行单态化。在过程中，编译器读取 `Option<T>` 实例中使用的数值，并识别出两种 `Option<T]`：一种为 `i32`，另一种为 `f64`。因此，它将 `Option<T>` 的泛型定义扩展为两个针对 `i32` 和 `f64` 的特殊定义，从而用具体定义替代了泛型定义。

单态化的代码版本看起来类似于以下形式（为了说明目的，编译器使用的名称与我们这里使用的不同）：

<Listing file-name="src/main.rs">

```rust
enum Option_i32 {
    Some(i32),
    None,
}

enum Option_f64 {
    Some(f64),
    None,
}

fn main() {
    let integer = Option_i32::Some(5);
    let float = Option_f64::Some(5.0);
}
```

</Listing>

泛型 `Option<T>` 被编译器创建的具体定义所替换。由于 Rust 将泛型代码编译为在每个实例中指定类型的代码，因此使用泛型在运行时不会产生任何成本。当代码运行时，其行为与我们手动复制每个定义的情况完全相同。单态化过程使得 Rust 的泛型在运行时非常高效。
