<!-- Old headings. Do not remove or links may break. -->

<a id="closures-anonymous-functions-that-can-capture-their-environment"></a>
<a id="closures-anonymous-functions-that-capture-their-environment"></a>

## 闭包

Rust 的闭包是匿名函数，你可以将其保存为变量或作为参数传递给其他函数。你可以在一个地方创建闭包，然后在其他地方调用该闭包以在不同的上下文中执行它。与函数不同，闭包可以捕获其定义环境中的值。我们将演示这些闭包特性如何允许代码复用和行为定制。

<!-- Old headings. Do not remove or links may break. -->

<a id="creating-an-abstraction-of-behavior-with-closures"></a>
<a id="refactoring-using-functions"></a>
<a id="refactoring-with-closures-to-store-code"></a>
<a id="capturing-the-environment-with-closures"></a>

### 捕获环境

首先，我们将探讨如何使用闭包来捕获其定义环境中的值以便后续使用。场景如下：我们的T恤公司偶尔会向邮件列表中的用户赠送独家限量版T恤作为促销活动。邮件列表中的用户可以选择将他们最喜欢的颜色添加到个人资料中。如果获得免费T恤的人设置了最喜欢的颜色，他们将得到该颜色的T恤；如果没有指定喜欢的颜色，则获得公司当前最丰富的颜色。

实现这一功能有多种方法。在这个示例中，我们将使用名为 `ShirtColor` 的枚举，该枚举包含 `Red` 和 `Blue` 两种变体（为了简单起见，颜色数量有限）。我们用 `Inventory` 结构体表示公司的库存，该结构体有一个名为 `shirts` 的字段，其中包含一个 `Vec<ShirtColor>` 数组，代表当前库存中的T恤颜色。`Inventory` 上定义的 `giveaway` 方法会获取免费T恤中奖者选择的颜色偏好，并返回该人将获得的T恤颜色。这种设置在清单 13-1 中展示。

<Listing number="13-1" file-name="src/main.rs" caption="Shirt company giveaway situation">

```rust,noplayground
{{#rustdoc_include ../listings/ch13-functional-features/listing-13-01/src/main.rs}}
```

</Listing>

在 `main` 中定义的 `store` 还有两件蓝色T恤和一件红色T恤可用于这次限量促销活动。我们为喜欢红色T恤的用户和没有偏好选择的用户分别调用 `giveaway` 方法。

同样，这段代码可以通过多种方式实现。在这里，为了专注于闭包的概念，我们仅使用您已经学过的概念，除了 `giveaway` 方法的主体部分使用了闭包。在 `giveaway` 方法中，我们将用户偏好作为 `Option<ShirtColor>` 类型的参数，并调用 `user_preference` 的 `unwrap_or_else` 方法。`[unwrap_or_else]` 方法是标准库提供的。它接受一个参数：一个不接收任何参数的闭包，该闭包返回一个 `T` 类型的值（即 `Option<T>` 中 `Some` 变体所存储的类型，本例中为 `ShirtColor`）。如果 `Option<T>` 是 `Some` 变体，`unwrap_or_else` 会返回 `Some` 内部的值；如果 `Option<T>` 是 `None` 变体，`unwrap_or_else` 则调用该闭包并返回其返回值。

我们将闭包表达式 `|| self.most_stocked()` 作为 `unwrap_or_else` 的参数。这是一个自身不接收参数的闭包（如果闭包有参数，它们会出现在两个竖线之间）。闭包的主体部分调用 `self.most_stocked()`。我们在这里定义这个闭包，而 `unwrap_or_else` 的实现将在需要结果时评估该闭包。

运行此代码会输出以下内容：

```console
{{#include ../listings/ch13-functional-features/listing-13-01/output.txt}}
```

这里一个有趣的点是，我们传递了一个在当前 `Inventory` 实例上调用 `self.most_stocked()` 的闭包。标准库不需要了解我们定义的 `Inventory` 或 `ShirtColor` 类型，也不需要了解在此场景中使用的逻辑。该闭包捕获了 `self` `Inventory` 实例的不可变引用，并将其与我们指定的代码一起传递给 `unwrap_or_else` 方法。而函数则无法以这种方式捕获其环境。

<!-- Old headings. Do not remove or links may break. -->

<a id="closure-type-inference-and-annotation"></a>

### 推断和注释闭包类型

函数与闭包之间存在更多差异。与 `fn` 函数不同，闭包通常不需要像函数那样对参数类型或返回值进行注解。对于函数来说，需要类型注解，因为类型属于向用户公开的明确接口的一部分。严格定义这一接口对于确保所有人都一致地理解函数的使用及返回值类型非常重要。而闭包则不会以这种方式被暴露在接口中：它们存储在变量中，在不需要命名和向库的用户公开的情况下直接使用。

闭包通常较短，且只在有限的上下文范围内具有相关性，而不是适用于任意场景。在这些有限的上下文中，编译器可以推断出参数的类型和返回类型，就像它能够推断大多数变量的类型一样（少数情况下编译器也需要对闭包类型进行注解）。

与变量类似，如果我们希望提高明确性和清晰度，就可以添加类型注解，尽管这会比严格必要的形式更冗长。为闭包添加类型注解类似于清单 13-2 中所示的定义。在这个例子中，我们定义了一个闭包并将其存储在变量中，而不是像在清单 13-1 中那样在传递参数的位置定义闭包。

<Listing number="13-2" file-name="src/main.rs" caption="Adding optional type annotations of the parameter and return value types in the closure">

```rust
{{#rustdoc_include ../listings/ch13-functional-features/listing-13-02/src/main.rs:here}}
```

</Listing>

添加了类型注解后，闭包的语法与函数的语法更为相似。这里，我们定义了一个对其参数加 1 的函数和一个具有相同行为的闭包作为对比。我们增加了一些空格以对齐相关部分。这说明了闭包语法与函数语法相似，只是使用了管道符号以及部分可选语法结构。

```rust,ignore
fn  add_one_v1   (x: u32) -> u32 { x + 1 }
let add_one_v2 = |x: u32| -> u32 { x + 1 };
let add_one_v3 = |x|             { x + 1 };
let add_one_v4 = |x|               x + 1  ;
```

第一行显示函数定义，第二行显示带有完整注释的闭包定义。在第三行中，我们删除了闭包定义中的类型注解。第四行中，我们删除了括号，因为闭包体只有一个表达式，括号是可选的。这些都是有效的定义，调用时会产生相同的行为。`add_one_v3`和`add_one_v4`这两行代码需要先评估闭包才能编译，因为类型是由其使用方式推断出来的。这类似于在 Rust 中，`let v = Vec::new();` 必须要么添加类型注解，要么将某种类型的值插入到 `Vec` 中，否则 Rust 无法推断出类型。

对于闭包定义，编译器会为每个参数和返回值推断出一个具体类型。例如，列表 13-3 展示了一种简短的闭包定义，该闭包仅返回作为参数传入的值。除了示例目的外，这种闭包并不非常实用。请注意，我们在定义中没有添加任何类型注解。由于没有类型注解，我们可以使用任何类型调用闭包，这里第一次就使用了 `String`。如果我们尝试用整数调用`example_closure`，则会出现错误。

<Listing number="13-3" file-name="src/main.rs" caption="Attempting to call a closure whose types are inferred with two different types">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch13-functional-features/listing-13-03/src/main.rs:here}}
```

</Listing>

编译器会给出以下错误：

```console
{{#include ../listings/ch13-functional-features/listing-13-03/output.txt}}
```

第一次使用`String`值调用`example_closure`时，编译器推断出`x`的类型和闭包的返回类型为`String`。这些类型随后被锁定在`example_closure`中，当接下来尝试使用不同的类型时，就会出现类型错误。

### 捕获引用或转移所有权

闭包可以通过三种方式从环境中捕获值，这直接对应函数的三种参数接收方式：不可变借用、可变借用以及所有权获取。闭包会根据函数体对捕获值的处理方式来决定使用哪种方式。

在清单 13-4 中，我们定义了一个闭包，该闭包捕获了对名为 `list` 的向量的不可变引用，因为只需要不可变引用来打印其值。

<Listing number="13-4" file-name="src/main.rs" caption="Defining and calling a closure that captures an immutable reference">

```rust
{{#rustdoc_include ../listings/ch13-functional-features/listing-13-04/src/main.rs}}
```

</Listing>

这个示例还说明了一个变量可以绑定到闭包定义上，之后我们可以通过使用变量名称和括号来调用闭包，就像变量名称是一个函数名一样。

由于我们可以同时拥有多个对 `list` 的不可变引用，因此在闭包定义之前、闭包定义之后但在调用闭包之前以及调用闭包之后，`list` 仍然可以被访问。这段代码可以编译、运行并输出结果：

```console
{{#include ../listings/ch13-functional-features/listing-13-04/output.txt}}
```

接下来，在清单 13-5 中，我们修改了闭包体，使其向 `list` 向量添加一个元素。现在该闭包捕获了一个可变引用。

<Listing number="13-5" file-name="src/main.rs" caption="Defining and calling a closure that captures a mutable reference">

```rust
{{#rustdoc_include ../listings/ch13-functional-features/listing-13-05/src/main.rs}}
```

</Listing>

这段代码可以编译、运行并输出结果：

```console
{{#include ../listings/ch13-functional-features/listing-13-05/output.txt}}
```

请注意，在闭包定义和调用 `borrows_mutably` 闭包之间不再有 `println!`：当 `borrows_mutably` 被定义时，它捕获了对 `list` 的可变引用。我们在调用闭包后不再使用该闭包，因此可变借用结束。在闭包定义和调用闭包之间不允许使用不可变借用来打印内容，因为存在可变借用时不允许其他借用存在。尝试添加 `println!` 看看你会得到什么错误消息！

如果你想强制闭包拥有其在环境中使用的所有值，即使闭包体严格不需要所有权，你可以在参数列表前使用 `move` 关键字。

这种技术在将闭包传递给新线程以移动数据使其由新线程拥有时非常有用。我们将在第 16 章讨论并发时详细探讨线程以及为什么需要它们，但现在让我们简要探索如何使用需要 `move` 关键字的闭包来创建新线程。清单 13-6 显示了经过修改的清单 13-4，该版本在新的线程中而不是主线程中打印向量。

<Listing number="13-6" file-name="src/main.rs" caption="Using `move` to force the closure for the thread to take ownership of `list`">

```rust
{{#rustdoc_include ../listings/ch13-functional-features/listing-13-06/src/main.rs}}
```

</Listing>

我们创建一个新线程，并将一个闭包作为参数传递给该线程。闭包体负责打印列表。在清单 13-4 中，由于只需要对 `list` 进行最少的操作即可将其打印出来，因此闭包仅使用不可变引用来捕获 `list`。在这个例子中，尽管闭包体仍然只需要不可变引用，但我们需要在闭包定义的开头加上 `move` 关键字，以指定 `list` 应该被移动到闭包中。如果主线程在调用新线程的 `join` 之前执行了更多操作，新线程可能会在主线程完成之前结束，或者主线程先结束。如果主线程保持对 `list` 的所有权但在新线程结束前放弃它，那么线程中的不可变引用就会变得无效。因此，编译器要求将 `list` 移动到传递给新线程的闭包中，以确保引用有效。尝试移除 `move` 关键字或在闭包定义后在主线程中使用 `list`，以查看会遇到哪些编译错误！

<!-- Old headings. Do not remove or links may break. -->

<a id="storing-closures-using-generic-parameters-and-the-fn-traits"></a>
<a id="limitations-of-the-cacher-implementation"></a>
<a id="moving-captured-values-out-of-the-closure-and-the-fn-traits"></a>
<a id="moving-captured-values-out-of-closures-and-the-fn-traits"></a>

### 将捕获的值移出闭包

一旦闭包从定义它的环境捕获了引用或拥有了对值的所有权（从而决定了什么会被_移入_闭包），闭包体中的代码则定义了在闭包被评估时这些引用或值会发生什么变化（从而决定了什么会被_移出_闭包）。

闭包体可以执行以下操作之一：将捕获的值移出闭包，修改捕获的值，既不移动也不修改该值，或者根本不从环境捕获任何内容。

闭包捕获和处理环境中的值的方式决定了它实现了哪些特性，而特性则是函数和结构体用来指定可以使用哪种类型闭包的方式。根据闭包体对值的处理方式不同，闭包会以叠加的方式自动实现一种、两种或所有三种 `Fn` 特性。

* `FnOnce` 适用于只能调用一次的闭包。所有闭包至少实现了此特性，因为所有闭包都可以被调用。将捕获值移出其体的闭包只会实现 `FnOnce`，而不会实现其他 `Fn` 特性，因为它只能被调用一次。
* `FnMut` 适用于不移动捕获值但可能修改捕获值的闭包。这些闭包可以被调用多次。
* `Fn` 适用于既不移动捕获值也不修改捕获值的闭包，以及从环境中没有捕获任何内容的闭包。这些闭包可以在不修改其环境的情况下被调用多次，这在同时多次调用闭包的情况下非常重要。

让我们看看我们在 Listing 13-1 中使用的 `Option<T>` 的 `unwrap_or_else` 方法的定义：

```rust,ignore
impl<T> Option<T> {
    pub fn unwrap_or_else<F>(self, f: F) -> T
    where
        F: FnOnce() -> T
    {
        match self {
            Some(x) => x,
            None => f(),
        }
    }
}
```

请记住，`T` 是表示 `Option` 的 `Some` 变体中的值类型的泛型类型。该类型 `T` 也是 `unwrap_or_else` 函数的返回类型：例如，在 `Option<String>` 上调用 `unwrap_or_else` 的代码将得到一个 `String`。

接下来，请注意 `unwrap_or_else` 函数有一个额外的泛型类型参数 `F`。`F` 类型是名为 `f` 的参数类型，当调用 `unwrap_or_else` 时，我们提供的是这个闭包。

泛型类型 `F` 上指定的特性边界是 `FnOnce() -> T`，这意味着 `F` 必须能够被调用一次，不接收参数，并返回一个 `T`。在特性边界中使用 `FnOnce` 表达了这样一个约束：`unwrap_or_else` 不会多次调用 `f`。在 `unwrap_or_else` 的体中，我们可以看到如果 `Option` 是 `Some`，则不会调用 `f`；如果 `Option` 是 `None`，则会调用一次 `f`。因为所有闭包都实现了 `FnOnce`，所以 `unwrap_or_else` 接受这三种类型的闭包，并且具有最大的灵活性。

> 注意：如果我们不需要从环境捕获值，可以使用函数的名称而不是闭包，当我们需要一个实现 `Fn` 特征的方法时。例如，对于 `Option<Vec<T>>` 类型的值，如果值为 `None`，我们可以调用 `unwrap_or_else(Vec::new)` 来获取一个新的空向量。编译器会自动为函数定义实现适用的 `Fn` 特征之一。

现在让我们看看标准库中的方法 `sort_by_key`，该函数在切片上定义，以了解它与 `unwrap_or_else` 的不同之处，以及为什么 `sort_by_key` 使用 `FnMut` 而不是 `FnOnce` 作为特征约束。闭包接受一个参数，即对当前切片中项目的引用，并返回一个可排序的 `K` 类型的值。当需要根据每个项目的特定属性对切片进行排序时，此函数非常有用。在列表 13-7 中，我们有一个 `Rectangle` 实例列表，我们使用 `sort_by_key` 按它们的 `width` 属性从低到高对它们进行排序。

<Listing number="13-7" file-name="src/main.rs" caption="Using `sort_by_key` to order rectangles by width">

```rust
{{#rustdoc_include ../listings/ch13-functional-features/listing-13-07/src/main.rs}}
```

</Listing>

这段代码会输出：

```console
{{#include ../listings/ch13-functional-features/listing-13-07/output.txt}}
```

`sort_by_key` 被定义为接受 `FnMut` 闭包的原因在于它多次调用该闭包——每次针对切片中的一个项目。闭包 `|r| r.width` 不会捕获、修改或移动环境中的任何内容，因此满足特征约束的要求。

相比之下，列表 13-8 展示了一个仅实现 `FnOnce` 特征的闭包示例，因为它会移动环境中的值。编译器不允许我们将此闭包与 `sort_by_key` 一起使用。

<Listing number="13-8" file-name="src/main.rs" caption="Attempting to use an `FnOnce` closure with `sort_by_key`">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch13-functional-features/listing-13-08/src/main.rs}}
```

</Listing>

这是一种人为造作且复杂的做法（实际上无法使用），试图统计在排序 `list` 时 `sort_by_key` 调用闭包的次数。这段代码试图通过将来自闭包环境中的 `value`（一个 `String`）推入 `sort_operations` 向量来实现计数。闭包捕获 `value`，然后通过将 `value` 的所有权转移给 `sort_operations` 向量，从而将其移出闭包。这个闭包只能被调用一次；尝试第二次调用是无效的，因为 `value` 已经不在环境中，无法再次推入 `sort_operations`！因此，这个闭包只实现了 `FnOnce`。当我们尝试编译这段代码时，会遇到错误，说明无法将 `value` 移出闭包，因为闭包必须实现 `FnMut`：

```console
{{#include ../listings/ch13-functional-features/listing-13-08/output.txt}}
```

错误指向闭包体中将 `value` 移出环境的那一行代码。要解决这个问题，我们需要修改闭包体，使其不会将值从环境中移出。在环境中保留一个计数器并在闭包体中增加其值，是更直接的计数方式。列表 13-9 中的闭包可以与 `sort_by_key` 一起使用，因为它只捕获对 `num_sort_operations` 计数器的可变引用，因此可以被调用多次。

<Listing number="13-9" file-name="src/main.rs" caption="Using an `FnMut` closure with `sort_by_key` is allowed.">

```rust
{{#rustdoc_include ../listings/ch13-functional-features/listing-13-09/src/main.rs}}
```

</Listing>

当定义或使用使用闭包的函数或类型时，`Fn` 特质非常重要。在下一节中，我们将讨论迭代器。许多迭代器方法接受闭包参数，所以在继续学习时请记住这些闭包细节！

[unwrap-or-else]: ../std/option/enum.Option.html#method.unwrap_or_else
