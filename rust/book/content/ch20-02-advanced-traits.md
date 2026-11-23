## 高级特性

我们在第10章的“使用特性定义共享行为”部分介绍了特性，但并未讨论更详细的细节。现在您对Rust有了更多的了解，我们可以深入探讨具体实现。

<!-- Old headings. Do not remove or links may break. -->

<a id="specifying-placeholder-types-in-trait-definitions-with-associated-types"></a>
<a id="associated-types"></a>

### 使用关联类型定义特性

_关联类型_将类型占位符与特性连接在一起，使得特性方法的定义可以在签名中使用这些占位类型。特性的实现者会指定具体的类型来替代占位类型用于特定实现。这样，我们就可以定义一个使用某些类型的特性，而无需在特性被实现之前知道这些类型的具体形式。

本章中描述的大部分高级特性都是很少使用的。关联类型则处于中间状态：它们的使用频率低于书中其他功能，但高于本章讨论的许多其他功能。

具有关联类型的特性的一个例子是标准库提供的`Iterator`特性。该关联类型名为`Item`，代表实现`Iterator`特性的类型所遍历的值的类型。`Iterator`特性的定义如清单 20-13 所示。

<Listing number="20-13" caption="The definition of the `Iterator` trait that has an associated type `Item`">

```rust,noplayground
{{#rustdoc_include ../listings/ch20-advanced-features/listing-20-13/src/lib.rs}}
```

</Listing>

类型`Item`是一个占位符，而`next`方法的定义表明它将返回类型为`Option<Self::Item>`的值。`Iterator`特性的实现者会指定`Item`的具体类型，而`next`方法则返回一个包含该具体类型的`Option`。

关联类型可能看起来与泛型类似，因为后者允许我们定义函数而不指定它能处理什么类型。为了了解这两种概念之间的区别，我们将查看在名为`Counter`的类型上实现的`Iterator`特性，该类型指定`Item`类型为`u32`：

<Listing file-name="src/lib.rs">

```rust,ignore
{{#rustdoc_include ../listings/ch20-advanced-features/no-listing-22-iterator-on-counter/src/lib.rs:ch19}}
```

</Listing>

这种语法似乎与泛型相当。那么，为什么不直接像清单 20-14 中那样使用泛型来定义`Iterator`特性呢？

<Listing number="20-14" caption="A hypothetical definition of the `Iterator` trait using generics">

```rust,noplayground
{{#rustdoc_include ../listings/ch20-advanced-features/listing-20-14/src/lib.rs}}
```

</Listing>

不同之处在于，使用泛型时，如清单 20-14 所示，我们必须为每个实现标注类型；因为我们也可以为 `Counter` 实现 `Iterator<String>` 或任何其他类型，因此可以为 `Counter` 提供多个 `Iterator` 的实现。换句话说，当一个特质具有泛型参数时，就可以多次针对该类型实现它，每次都会改变泛型类型参数的具体类型。当我们对 `Counter` 使用 `next` 方法时，就必须提供类型注释来指示我们想要使用的 `Iterator` 实现。

对于关联类型，我们不需要标注类型，因为不能多次针对一个类型实现特质。在清单 20-13 中使用关联类型的定义中，我们只能一次选择 `Item` 的类型，因为只有一个 `impl Iterator for Counter`。我们在对 `Counter` 调用 `next` 时，不需要指定想要使用 `u32` 值的迭代器。

关联类型也成为该特质的契约的一部分：实现者必须提供一个类型来替代关联类型的占位符。关联类型通常有一个名称来描述该类型的使用方式，在 API 文档中记录关联类型是一个良好的实践。

<!-- Old headings. Do not remove or links may break. -->

<a id="default-generic-type-parameters-and-operator-overloading"></a>

### 使用默认泛型参数和运算符重载

当使用泛型类型参数时，我们可以为泛型类型指定一个默认的具体类型。这样就无需实现者指定具体类型，只要默认类型有效即可。当你使用 `<PlaceholderType=ConcreteType>` 语法声明泛型类型时，就可以指定默认类型。

一个该技术非常有用的例子是 _运算符重载_，通过这种技术你可以在特定情况下自定义运算符（如 `+`）的行为。

Rust 不允许你创建自己的运算符或重载任意运算符。但是，你可以通过实现与运算符相关的特质来重载 `std::ops` 中列出的操作和相应的特质。例如，在 Listing 20-15 中，我们重载了 `+` 运算符以将两个 `Point` 实例相加。我们通过在 `Point` 结构体上实现 `Add` 特质来实现这一点。

<Listing number="20-15" file-name="src/main.rs" caption="Implementing the `Add` trait to overload the `+` operator for `Point` instances">

```rust
{{#rustdoc_include ../listings/ch20-advanced-features/listing-20-15/src/main.rs}}
```

</Listing>

`add` 方法将两个 `Point` 实例的 `x` 值以及两个 `Point` 实例的 `y` 值相加，从而生成一个新的 `Point`。`Add` 特质有一个名为 `Output` 的相关类型，该类型决定了 `add` 方法返回的类型。

此代码中的默认泛型类型位于 `Add` 特质内。以下是其定义：

```rust
trait Add<Rhs=Self> {
    type Output;

    fn add(self, rhs: Rhs) -> Self::Output;
}
```

这段代码在整体上应该很熟悉：一个带有一种方法的特质和一个相关类型。新部分是 `Rhs=Self`：这种语法被称为 _默认类型参数_。`Rhs` 泛型类型参数（即“右侧”）定义了 `add` 方法中 `rhs` 参数的类型。如果我们实现 `Add` 特质时没有指定 `Rhs` 的具体类型，那么 `Rhs` 的类型将默认为 `Self`，也就是我们实现 `Add` 的类型。

当为 `Point` 实现 `Add` 特质时，我们使用了 `Rhs` 的默认值，因为我们想要将两个 `Point` 实例相加。让我们看一个实现 `Add` 特质的例子，其中我们希望自定义 `Rhs` 的类型而不是使用默认值。

我们有两个结构体，`Millimeters` 和 `Meters`，它们分别持有不同单位的数值。将现有类型嵌入到另一个结构体中这种做法被称为 _新类型模式_，我们在 [“使用新类型模式实现外部特质”][newtype]<!-- ignore --> 部分中详细描述了这一点。我们希望将毫米单位的值转换为米单位的值，并且希望 `Add` 的实现能够正确进行转换。我们可以为 `Millimeters` 实现 `Add` 特质，并将 `Meters` 作为 `Rhs`，如 Listing 20-16 所示。

<Listing number="20-16" file-name="src/lib.rs" caption="Implementing the `Add` trait on `Millimeters` to add `Millimeters` and `Meters`">

```rust,noplayground
{{#rustdoc_include ../listings/ch20-advanced-features/listing-20-16/src/lib.rs}}
```

</Listing>

为了将 `Millimeters` 和 `Meters` 相加，我们指定 `impl Add<Meters>`，以设置 `Rhs` 类型参数的值，而不是使用 `Self` 的默认值。

您将以两种主要方式使用默认类型参数：

1. 在不破坏现有代码的情况下扩展类型。
2. 允许在大多数用户不需要的特定情况下进行定制。

标准库中的 `Add` trait 是第二种用途的示例：通常，您会添加两个类似的类型，但 `Add` trait 提供了超出此范围的定制能力。在 `Add` trait 定义中使用默认类型参数意味着大多数时候无需指定额外的参数。换句话说，不需要额外的实现样板代码，从而更容易使用该 trait。

第一个用途与第二个用途类似，但方向相反：如果您想向现有 trait 添加类型参数，可以为其提供默认值，以便在不破坏现有实现代码的情况下扩展该 trait 的功能。

<!-- Old headings. Do not remove or links may break. -->

<a id="fully-qualified-syntax-for-disambiguation-calling-methods-with-the-same-name"></a>
<a id="disambiguating-between-methods-with-the-same-name"></a>

### 避免同名方法混淆

Rust 中没有任何机制阻止一个 trait 拥有与另一个 trait 的方法同名的方法，也不禁止您在一种类型上同时实现这两个 trait。您也可以直接在具有与 trait 方法相同名称的方法的类型的上实现该方法。

当调用具有相同名称的方法时，您需要告诉 Rust 您想要使用哪个方法。请参考清单 20-17 中的代码，其中我们定义了两个 trait：`Pilot` 和 `Wizard`，它们都包含名为 `fly` 的方法。然后我们在已经具有名为 `fly` 方法的类型 `Human` 上实现了这两个 trait。每个 `fly` 方法执行不同的操作。

<Listing number="20-17" file-name="src/main.rs" caption="Two traits are defined to have a `fly` method and are implemented on the `Human` type, and a `fly` method is implemented on `Human` directly.">

```rust
{{#rustdoc_include ../listings/ch20-advanced-features/listing-20-17/src/main.rs:here}}
```

</Listing>

当我们在 `Human` 的实例上调用 `fly` 时，编译器默认会调用直接在类型上实现的该方法，如清单 20-18 所示。

<Listing number="20-18" file-name="src/main.rs" caption="Calling `fly` on an instance of `Human`">

```rust
{{#rustdoc_include ../listings/ch20-advanced-features/listing-20-18/src/main.rs:here}}
```

</Listing>

运行此代码将输出 `*waving arms furiously*`，表明 Rust 直接调用了在 `Human` 上实现的 `fly` 方法。

要从 `Pilot` trait 或 `Wizard` trait 调用 `fly` 方法，我们需要使用更明确的语法来指定我们指的是哪个 `fly` 方法。清单 20-19 展示了这种语法。

<Listing number="20-19" file-name="src/main.rs" caption="Specifying which trait’s `fly` method we want to call">

```rust
{{#rustdoc_include ../listings/ch20-advanced-features/listing-20-19/src/main.rs:here}}
```

</Listing>

在方法名之前指定特质名称可以明确告知 Rust 我们想要调用 `fly` 的哪个实现。我们也可以写成 `Human::fly(&person)`，这等同于我们在清单 20-19 中使用的 `person.fly()`，但如果不需要消除歧义的话，这种写法会稍微长一些。

运行此代码会输出以下内容：

```console
{{#include ../listings/ch20-advanced-features/listing-20-19/output.txt}}
```

由于 `fly` 方法接受一个 `self` 参数，如果有两个 _类型_都实现了某个 _特质_，Rust 可以根据 `self` 的类型来确定使用哪个实现。

然而，非方法的关联函数没有 `self` 参数。当有多个类型或特质定义了具有相同函数名称的非方法函数时，除非使用完全限定语法，否则 Rust 并不总能知道你指的是哪个类型。例如，在清单 20-20 中，我们为动物收容所创建了一个特质，希望将所有幼犬命名为 Spot。我们定义了一个带有关联非方法函数 `baby_name` 的 `Animal` 特质。该 `Animal` 特质被应用于结构体 `Dog`，我们在 `Dog` 上直接提供了另一个关联非方法函数 `baby_name`。

<Listing number="20-20" file-name="src/main.rs" caption="A trait with an associated function and a type with an associated function of the same name that also implements the trait">

```rust
{{#rustdoc_include ../listings/ch20-advanced-features/listing-20-20/src/main.rs}}
```

</Listing>

我们在 `Dog` 上定义的 `baby_name` 关联函数中实现了所有幼犬命名为 Spot 的代码。`Dog` 类型还实现了特质 `Animal`，该特质描述了所有动物共有的特征。幼犬被称为 puppy，这体现在 `Dog` 上实现的 `Animal` 特质的 `baby_name` 函数中。

在 `main` 中，我们调用了 `Dog::baby_name` 函数，该函数直接调用了 `Dog` 上定义的关联函数。此代码会输出以下内容：

```console
{{#include ../listings/ch20-advanced-features/listing-20-20/output.txt}}
```

这个输出并不是我们想要的。我们希望调用属于我们在 `Dog` 上实现的 `Animal` 特质的 `baby_name` 函数，这样代码就会输出“一只幼犬被称为 puppy”。我们在清单 20-19 中使用的指定特质名称的技术在这里并不有效；如果我们将 `main` 改为清单 20-21 中的代码，将会出现编译错误。

<Listing number="20-21" file-name="src/main.rs" caption="Attempting to call the `baby_name` function from the `Animal` trait, but Rust doesn’t know which implementation to use">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch20-advanced-features/listing-20-21/src/main.rs:here}}
```

</Listing>

由于 `Animal::baby_name` 没有 `self` 参数，且可能存在实现 `Animal` trait 的其他类型，Rust 无法确定我们想要使用哪种 `Animal::baby_name` 的实现。因此会出现此编译器错误：

```console
{{#include ../listings/ch20-advanced-features/listing-20-21/output.txt}}
```

为了消除歧义并告诉 Rust，我们想要使用 `Dog` 的 `Animal` 实现，而不是其他类型的 `Animal` 实现，我们需要使用完全限定语法。列表 20-22 展示了如何使用完全限定语法。

<Listing number="20-22" file-name="src/main.rs" caption="Using fully qualified syntax to specify that we want to call the `baby_name` function from the `Animal` trait as implemented on `Dog`">

```rust
{{#rustdoc_include ../listings/ch20-advanced-features/listing-20-22/src/main.rs:here}}
```

</Listing>

我们在尖括号内提供类型注释，表明我们希望调用来自 `Animal` trait 的 `baby_name` 方法，该方法是针对 `Dog` 实现的，也就是说我们希望将 `Dog` 类型视为一个 `Animal` 用于此函数调用。这样代码就能输出我们想要的结果：

```console
{{#include ../listings/ch20-advanced-features/listing-20-22/output.txt}}
```

一般来说，完全限定语法定义如下：

```rust,ignore
<Type as Trait>::function(receiver_if_method, next_arg, ...);
```

对于非方法的关联函数，不会包含 `receiver` 参数：只有其他参数的列表。你可以在任何调用函数或方法的地方使用完全限定语法。不过，你可以省略 Rust 能从程序中的其他信息中推断出的任何部分。只有在存在多个使用相同名称的实现且 Rust 需要帮助确定你要调用哪个实现时，才需要使用这种更冗长的语法。

<!-- Old headings. Do not remove or links may break. -->

<a id="using-supertraits-to-require-one-traits-functionality-within-another-trait"></a>

### 使用超rait

有时你可能会编写一个依赖于另一个 trait 的 trait 定义：为了让一个类型实现第一个 trait，你需要要求该类型也实现第二个 trait。这样做是为了让你的 trait 定义能够利用第二个 trait 的关联项。你所依赖的 trait 被称为你 trait 的 _supertrait_。

例如，假设我们想要创建一个带有 `outline_print` 方法的 `OutlinePrint` trait，该方法会将给定值格式化为以星号包围的形式。也就是说，给定一个实现了标准库 `Display` trait 的 `Point` 结构体，其结果为 `(x, y)`，当我们在具有 `x` 为 `1` 和 `y` 为 `3` 的 `Point` 实例上调用 `outline_print` 时，它应该输出如下内容：

```text
**********
*        *
* (1, 3) *
*        *
**********
```

在实现 `outline_print` 方法时，我们希望利用 `Display` trait 的功能。因此，我们需要指定 `OutlinePrint` trait 仅适用于也实现 `Display` trait 的类型，并提供 `OutlinePrint` 所需的功能。我们可以在 trait 定义中通过指定 `OutlinePrint: Display` 来实现这一点。这种技术类似于在 trait 上添加 trait 约束。列表 20-23 展示了 `OutlinePrint` trait 的实现示例。

<Listing number="20-23" file-name="src/main.rs" caption="Implementing the `OutlinePrint` trait that requires the functionality from `Display`">

```rust
{{#rustdoc_include ../listings/ch20-advanced-features/listing-20-23/src/main.rs:here}}
```

</Listing>

因为我们已经指定了 `OutlinePrint` 需要 `Display` trait，我们可以使用任何实现 `Display` trait 的类型自动实现的 `to_string` 函数。如果我们尝试在不加冒号的情况下使用 `to_string`，并且不在 trait 名称后指定 `Display` trait，将会出现错误，提示在当前作用域中找不到名为 `to_string` 的方法用于类型 `&Self`。

让我们看看当我们在未实现 `Display` trait 的类型上尝试实现 `OutlinePrint` 时会发生什么，比如 `Point` 结构体：

<Listing file-name="src/main.rs">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch20-advanced-features/no-listing-02-impl-outlineprint-for-point/src/main.rs:here}}
```

</Listing>

我们会得到一个错误，说明需要 `Display` trait 但未被实现：

```console
{{#include ../listings/ch20-advanced-features/no-listing-02-impl-outlineprint-for-point/output.txt}}
```

为了解决这个问题，我们需要在 `Point` 上实现 `Display` trait，以满足 `OutlinePrint` 所需的约束条件，如下所示：

<Listing file-name="src/main.rs">

```rust
{{#rustdoc_include ../listings/ch20-advanced-features/no-listing-03-impl-display-for-point/src/main.rs:here}}
```

</Listing>

然后，在 `Point` 上实现 `OutlinePrint` trait 就能成功编译，我们可以在 `Point` 实例上调用 `outline_print` 来将其以星号轮廓的形式显示出来。

<!-- Old headings. Do not remove or links may break. -->

<a id="using-the-newtype-pattern-to-implement-external-traits-on-external-types"></a>
<a id="using-the-newtype-pattern-to-implement-external-traits"></a>

### 使用新类型模式实现外部 trait

在第十章的[“在类型上实现特质”](implementing-a-trait-on-a-type)<!-- ignore -->部分中，我们提到了孤儿规则，该规则规定我们只能在特质或类型属于我们的 crate 时，才可以在该类型上实现特质。通过新类型模式可以绕过这一限制，这种模式涉及在元组结构体中创建一个新的类型。（我们在第五章的[“使用元组结构体创建不同类型”](tuple-structs)<!-- ignore -->部分中介绍了元组结构体。）该元组结构体包含一个字段，作为我们要实现特质的类型的薄包装器。然后，这个包装器类型属于我们的 crate，我们可以在包装器上实现特质。“Newtype”是一个源自 Haskell 编程语言的术语。使用这种模式不会造成运行时性能损失，并且在编译时会被省略掉包装器类型。

例如，假设我们想在 `Vec<T>` 上实现 `Display` 特质，而孤儿规则禁止我们直接这样做，因为 `Display` 特质和 `Vec<T>` 类型都定义在我们的 crate 之外。我们可以创建一个包含 `Vec<T>` 实例的 `Wrapper` 结构体；然后，我们可以在 `Wrapper` 上实现 `Display` 特质，并使用 `Vec<T>` 值，如清单 20-24 所示。

<Listing number="20-24" file-name="src/main.rs" caption="Creating a `Wrapper` type around `Vec<String>` to implement `Display`">

```rust
{{#rustdoc_include ../listings/ch20-advanced-features/listing-20-24/src/main.rs}}
```

</Listing>

实现 `Display` 时，使用 `self.0` 来访问内部的 `Vec<T)`，因为 `Wrapper` 是一个元组结构体，`Vec<T>` 是元组中索引为 0 的元素。然后，我们可以在 `Wrapper` 上利用 `Display` 特质的功能。

使用这种技术的缺点在于 `Wrapper` 是一个新类型，因此它没有所存储值的所有方法。我们不得不直接在 `Wrapper` 上实现 `Vec<T>` 的所有方法，使得这些方法委托给 `self.0`，这样就能让 `Wrapper` 完全像 `Vec<T>` 一样使用。如果我们希望新类型拥有内部类型的所有方法，可以在 `Wrapper` 上实现 `Deref` trait 以返回内部类型，这就是一种解决方案（我们在第15章的“将智能指针视为常规引用”部分讨论过如何实现 `Deref` trait）。如果我们不希望 `Wrapper` 类型拥有内部类型的所有方法——例如限制 `Wrapper` 的行为——我们就必须手动实现仅需要的那些方法。

即使不涉及特质，这种新类型模式也很有用。让我们转换关注点，看看一些与 Rust 类型系统交互的高级方式。

[newtype]: ch20-02-advanced-traits.html#implementing-external-traits-with-the-newtype-pattern
[implementing-a-trait-on-a-type]: ch10-02-traits.html#implementing-a-trait-on-a-type
[traits]: ch10-02-traits.html
[smart-pointer-deref]: ch15-02-deref.html#treating-smart-pointers-like-regular-references
[tuple-structs]: ch05-01-defining-structs.html#creating-different-types-with-tuple-structs
