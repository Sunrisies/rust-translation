<!-- Old headings. Do not remove or links may break. -->

<a id="treating-smart-pointers-like-regular-references-with-the-deref-trait"></a>
<a id="treating-smart-pointers-like-regular-references-with-deref"></a>

## 将智能指针视为普通引用处理

实现 `Deref` trait 可以让你自定义 _解引用运算符_ `*` 的行为（不要与乘法或全局运算符混淆）。通过以这样的方式实现 `Deref`，使得智能指针可以被当作普通引用处理，你可以编写针对引用的代码，并将这些代码用于智能指针。

首先让我们看看解引用运算符如何与普通引用协同工作。然后，我们将尝试定义一个行为类似于 `Box<T>` 的自定义类型，并观察为什么解引用运算符在新定义的类型上不能像对普通引用那样工作。我们将探讨实现 `Deref` trait 如何使智能指针能够以类似引用的方式运行。接着，我们将了解 Rust 的解引用强制转换特性以及它如何让我们使用引用或智能指针。

<!-- Old headings. Do not remove or links may break. -->

<a id="following-the-pointer-to-the-value-with-the-dereference-operator"></a>
<a id="following-the-pointer-to-the-value"></a>

### 跟随值的引用

普通引用是一种指针类型，可以将指针想象为指向其他位置存储值的箭头。在列表 15-6 中，我们创建了一个对 `i32` 值的引用，然后使用解引用运算符来跟随该引用到值。

<Listing number="15-6" file-name="src/main.rs" caption="Using the dereference operator to follow a reference to an `i32` value">

```rust
{{#rustdoc_include ../listings/ch15-smart-pointers/listing-15-06/src/main.rs}}
```

</Listing>

变量 `x` 保存了一个 `i32` 值 `5`。我们将 `y` 设置为对 `x` 的引用。我们可以断言 `x` 等于 `5`。然而，如果我们想对 `y` 中的值进行断言，我们必须使用 `*y` 来跟随其指向的值的引用（即 _解引用_），以便编译器能够比较实际值。一旦我们解引用了 `y`，我们就可以访问 `y` 所指向的整数值，并将其与 `5` 进行比较。

如果我们尝试编写 `assert_eq!(5, y);`，将会出现以下编译错误：

```console
{{#include ../listings/ch15-smart-pointers/output-only-01-comparing-to-reference/output.txt}}
```

比较一个数字和一个数字引用是不允许的，因为它们是不同类型。我们必须使用解引用运算符来跟随其指向的值的引用。

### 将 `Box<T>` 视为引用使用

我们可以重新编写清单 15-6 中的代码，使用 `Box<T>` 代替引用；在清单 15-7 中对 `Box<T>` 使用的解引用运算符，其功能与在清单 15-6 中对引用使用的解引用运算符相同。

<Listing number="15-7" file-name="src/main.rs" caption="Using the dereference operator on a `Box<i32>`">

```rust
{{#rustdoc_include ../listings/ch15-smart-pointers/listing-15-07/src/main.rs}}
```

</Listing>

清单 15-7 与清单 15-6 的主要区别在于，在这里我们将 `y` 设置为指向 `x` 的复制值的盒子的实例，而不是指向 `x` 值的引用。在最后的断言中，我们可以像当 `y` 是引用时一样使用解引用运算符来跟踪盒子的指针。接下来，我们将探讨 `Box<T>` 中的特殊之处，这些特性使得我们可以通过定义自己的盒子类型来使用解引用运算符。

### 定义我们自己的智能指针

让我们构建一个类似于标准库提供的 `Box<T>` 类型的包装类型，以体验智能指针类型与引用默认行为的不同。然后，我们将研究如何添加使用解引用运算符的能力。

> 注意：我们即将构建的 `MyBox<T>` 类型与真实的 `Box<T>` 之间存在一个重大区别：我们的版本不会在堆上存储数据。我们专注于这个示例中的 `Deref`，因此数据的实际存储位置不如指针类行为重要。

`Box<T>` 类型最终被定义为包含一个元素的元组结构，因此清单 15-8 以相同的方式定义了 `MyBox<T` 类型。我们还将定义一个 `new` 函数，以匹配 `Box<T>` 上定义的 `new` 函数。

<Listing number="15-8" file-name="src/main.rs" caption="Defining a `MyBox<T>` type">

```rust
{{#rustdoc_include ../listings/ch15-smart-pointers/listing-15-08/src/main.rs:here}}
```

</Listing>

我们定义了一个名为 `MyBox` 的结构，并声明了一个泛型参数 `T`，因为我们希望我们的类型能够存储任何类型的数值。`MyBox` 类型是一个包含一个类型为 `T` 元素的元组结构。`MyBox::new` 函数接受一个类型为 `T` 的参数，并返回一个包含传入值的 `MyBox` 实例。

让我们尝试将清单 15-7 中的 `main` 函数添加到清单 15-8 中，并将其改为使用我们定义的 `MyBox<T` 类型而不是 `Box<T>`。由于 Rust 不知道如何解引用 `MyBox`，因此清单 15-9 中的代码无法编译。

<Listing number="15-9" file-name="src/main.rs" caption="Attempting to use `MyBox<T>` in the same way we used references and `Box<T>`">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch15-smart-pointers/listing-15-09/src/main.rs:here}}
```

</Listing>

这是最终的编译错误：

```console
{{#include ../listings/ch15-smart-pointers/listing-15-09/output.txt}}
```

我们的 `MyBox<T>` 类型无法被解引用，因为我们尚未在该类型上实现此功能。为了通过 `*` 运算符实现解引用，我们实现了 `Deref` trait。

<!-- Old headings. Do not remove or links may break. -->

<a id="treating-a-type-like-a-reference-by-implementing-the-deref-trait"></a>

### 实现 `Deref` trait

如第10章中的“在类型上实现Trait”所述，要实现某个Trait，我们需要为该Trait所需的各个方法提供实现。标准库提供的 `Deref` trait要求我们实现一个名为 `deref` 的方法，该方法会借用 `self` 并返回对内部数据的引用。清单15-10中包含了用于补充 `MyBox<T>` 定义的 `Deref` 实现。

<Listing number="15-10" file-name="src/main.rs" caption="Implementing `Deref` on `MyBox<T>`">

```rust
{{#rustdoc_include ../listings/ch15-smart-pointers/listing-15-10/src/main.rs:here}}
```

</Listing>

`type Target = T;` 语法定义了 `Deref` trait使用的关联类型。关联类型是一种不同的声明泛型参数的方式，但目前不必担心它们；我们将在第20章中更详细地讨论它们。

我们在 `deref` 方法的主体中填入 `&self.0`，这样 `deref` 就能返回对通过 `*` 运算符要访问的值的引用；回想一下第5章中的“使用元组结构创建不同类型”内容，`.0` 可以访问元组结构中的第一个值。清单15-9中的 `main` 函数现在能够编译，并且断言也通过了！

如果没有 `Deref` trait，编译器只能解引用 `&` 引用。`deref` 方法让编译器能够获取任何实现 `Deref` 的类型的值，并调用 `deref` 方法以获得一个它知道如何解引用的引用。

当我们在清单15-9中写入 `*y` 时，幕后Rust实际上执行了以下代码：

```rust,ignore
*(y.deref())
```

Rust用对 `deref` 方法的调用替代 `*` 运算符，然后进行简单的解引用操作，这样我们就无需考虑是否需要调用 `deref` 方法。这一Rust特性使我们能够编写出无论使用普通引用还是实现 `Deref` 的类型，功能都相同的代码。

`deref` 方法返回对值的引用，而在 `*(y.deref())` 中在括号外直接进行解引用仍然是必要的，这与所有权系统有关。如果 `deref` 方法直接返回值而不是对值的引用，那么该值就会从 `self` 中被移动出去。在这种情况下，或者在我们使用解引用运算符的大多数情况下，我们都不希望拥有 `MyBox<T>` 内部的值的所有权。

请注意，`*` 运算符被替换为对 `deref` 方法的调用，然后再进行一次 `*` 运算符的调用，每次我们在代码中使用 `*` 时都会如此。由于 `*` 运算符的替换不会无限递归，最终我们得到的是 `i32` 类型的数据，这与列表 15-9 中 `assert_eq!` 里的 `5` 相符。

<!-- Old headings. Do not remove or links may break. -->

<a id="implicit-deref-coercions-with-functions-and-methods"></a>
<a id="using-deref-coercions-in-functions-and-methods"></a>

### 在函数和方法中使用解引用转换

_解引用转换_ 将对 `Deref` trait 实现的类型的引用转换为对另一个类型的引用。例如，解引用转换可以将 `&String` 转换为 `&str`，因为 `String` 实现了 `Deref` trait，从而返回 `&str`。解引用转换是 Rust 对函数和方法的参数进行的便利操作，它仅适用于实现 `Deref` trait 的类型。当我们将特定类型的值的引用作为函数或方法的参数传递时，如果参数类型与函数或方法定义中的类型不匹配，这种转换就会自动发生。对 `deref` 方法的多次调用会将我们提供的类型转换为参数所需的类型。

解引用转换被添加到 Rust 中，这样编写函数和方法调用的程序员就不必使用 `&` 和 `*` 来添加大量的显式引用和解引用操作。解引用转换功能还使我们能够编写更多适用于引用或智能指针的代码。

为了看到解引用转换的实际应用，让我们使用列表 15-8 中定义的 `MyBox<T` 类型以及我们在列表 15-10 中添加的 `Deref` 实现。列表 15-11 展示了一个具有字符串切片参数的函数的定义。

<Listing number="15-11" file-name="src/main.rs" caption="A `hello` function that has the parameter `name` of type `&str`">

```rust
{{#rustdoc_include ../listings/ch15-smart-pointers/listing-15-11/src/main.rs:here}}
```

</Listing>

我们可以将 `hello` 函数作为字符串切片作为参数调用，例如 `hello("Rust");`。Deref 强制转换使得可以使用对 `MyBox<String>` 类型值的引用来调用 `hello`，如清单 15-12 所示。

<Listing number="15-12" file-name="src/main.rs" caption="Calling `hello` with a reference to a `MyBox<String>` value, which works because of deref coercion">

```rust
{{#rustdoc_include ../listings/ch15-smart-pointers/listing-15-12/src/main.rs:here}}
```

</Listing>

在这里，我们使用 `&m` 作为参数调用 `hello` 函数，`&m` 是对 `MyBox<String>` 类型的引用。由于我们在清单 15-10 中实现了 `MyBox<T>` 上的 `Deref` trait，Rust 可以通过调用 `deref` 将 `&MyBox<String>` 转换为 `&String`。标准库为 `String` 提供了 `Deref` 的实现，该实现返回字符串切片，这也在 `Deref` 的 API 文档中。Rust 再次调用 `deref` 以将 `&String` 转换为 `&str`，这与 `hello` 函数的定义相匹配。

如果 Rust 不实施 Deref 强制转换，我们就必须像在清单 15-12 中那样编写代码，而不是清单 15-13 中的代码，才能使用 `&MyBox<String>` 类型值调用 `hello` 函数。

<Listing number="15-13" file-name="src/main.rs" caption="The code we would have to write if Rust didn’t have deref coercion">

```rust
{{#rustdoc_include ../listings/ch15-smart-pointers/listing-15-13/src/main.rs:here}}
```

</Listing>

`(*m)` 将 `MyBox<String>` 解引用为 `String`。然后，`&` 和 `[..]` 从 `String` 中获取一个字符串切片，该切片与整个字符串相等，从而符合 `hello` 函数的签名。没有 Deref 强制转换的这段代码由于包含这些符号而更难阅读、编写和理解。Deref 强制转换允许 Rust 自动处理这些转换。

当涉及的类型定义了 `Deref` trait 时，Rust 会分析这些类型，并根据需要多次调用 `Deref::deref`，以得到与参数类型匹配的引用。`Deref::deref` 被调用的次数在编译时确定，因此利用 Deref 强制转换不会造成运行时开销！

<!-- Old headings. Do not remove or links may break. -->

<a id="how-deref-coercion-interacts-with-mutability"></a>

### 使用可变引用处理 Deref 强制转换

类似于使用 `Deref` trait 覆盖不可变引用上的 `*` 运算符，你可以使用 `DerefMut` trait 覆盖可变引用上的 `*` 运算符。

Rust 在以下三种情况下进行 Deref 强制转换：

1. 从 `&T` 转换为 `&U`，当 `T: Deref<Target=U>` 时 2. 从 `&mut T` 转换为 `&mut U`，当 `T: DerefMut<Target=U>` 时 3. 从 `&mut T` 转换为 `&U`，当 `T: Deref<Target=U>` 时

前两种情况相同，只是第二种实现了可变性。第一种情况指出，如果你有一个 `&T`，且 `T` 实现了某个类型 `U` 的 `Deref` 接口，你可以透明地得到一个 `&U`。第二种情况指出，对于可变引用也发生相同的解引用转换。

第三种情况较为复杂：Rust 还会将可变引用转换为不可变引用。但相反的情况是不可能的：不可变引用永远无法转换为可变引用。由于借用规则的限制，如果你有一个可变引用，该可变引用必须是对该数据的唯一引用（否则程序将无法编译）。将一个可变引用转换为一个不可变引用不会违反借用规则。将不可变引用转换为可变引用则要求初始的不可变引用是对该数据的唯一不可变引用，但借用规则并不保证这一点。因此，Rust 不能假设将不可变引用转换为可变引用是可能的。

[impl-trait]: ch10-02-traits.html#implementing-a-trait-on-a-type
[tuple-structs]: ch05-01-defining-structs.html#creating-different-types-with-tuple-structs
