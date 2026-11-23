## 方法

方法类似于函数：我们使用 `fn` 关键字和名称来声明它们，它们可以包含参数和返回值，并且包含在从其他地方调用该方法时执行的代码。与函数不同，方法是在结构体（或枚举或特质对象）的上下文中定义的（我们将在 [第6章][enums]<!-- ignore --> 和 [第18章][trait-objects]<!-- ignore --> 中分别讨论），其第一个参数总是 `self`，表示调用该方法的结构体实例。

<!-- Old headings. Do not remove or links may break. -->

<a id="defining-methods"></a>

### 方法语法

让我们修改 `area` 函数，该函数以 `Rectangle` 实例为参数，改为在 `Rectangle` 结构体中定义 `area` 方法，如清单5-13所示。

<Listing number="5-13" file-name="src/main.rs" caption="Defining an `area` method on the `Rectangle` struct">

```rust
{{#rustdoc_include ../listings/ch05-using-structs-to-structure-related-data/listing-05-13/src/main.rs}}
```

</Listing>

为了在 `Rectangle` 的上下文中定义该函数，我们首先为 `Rectangle` 创建一个 `impl`（实现）块。此 `impl` 块中的内容都将与 `Rectangle` 类型关联。然后，我们将 `area` 函数移入 `impl` 花括号中，并在签名和代码体中将第一个参数改为 `self`。在 `main` 函数中，当我们调用 `area` 函数并传递 `rect1` 作为参数时，我们可以使用 _方法语法_ 来调用 `Rectangle` 实例的 `area` 方法。方法语法是在实例之后添加的：我们添加一个点，然后加上方法名、括号和任何参数。

在 `area` 的签名中，我们使用 `&self` 而不是 `rectangle: &Rectangle`。`&self` 实际上是 `self: &Self` 的缩写。在 `impl` 块中，`Self` 是 `impl` 块所针对类型的别名。方法必须在其第一个参数上有名为 `self` 且类型为 `Self` 的参数，因此 Rust 允许在第一个参数位置仅使用名称 `self` 来缩写此参数。请注意，我们仍然需要在 `self` 简写前使用 `&`，以表明该方法借用 `Self` 实例，就像我们在 `rectangle: &Rectangle` 中做的那样。方法可以拥有 `self` 的所有权，不可变地借用 `self`，如我们在这里所做的那样，也可以可变地借用 `self`，就像它们可以借用其他任何参数一样。

我们在这里选择使用 `&self` 的原因与在函数版本中使用 `&Rectangle` 相同：我们不希望拥有实例的所有权，只是想读取结构体中的数据，而不对其进行修改。如果我们希望在方法执行过程中改变被调用方法的实例，我们将使用 `&mut self` 作为第一个参数。仅使用 `self` 作为第一个参数的方法来拥有实例所有权的情况很少见；这种技术通常用于当该方法将 `self` 转换为其他对象时，并且我们希望防止调用者在转换后继续使用原始实例。

使用方法而非函数的主要原因除了提供方法语法以及不必在每个方法的签名中重复 `self` 的类型外，还在于组织性。我们将所有关于类型实例的操作都放在一个 `impl` 块中，这样未来的代码使用者就不需要在我们提供的库中的各个地方寻找 `Rectangle` 的功能了。

请注意，我们可以选择让方法与结构体的某个字段具有相同的名称。例如，我们可以在 `Rectangle` 上定义一个名为 `width` 的方法：

<Listing file-name="src/main.rs">

```rust
{{#rustdoc_include ../listings/ch05-using-structs-to-structure-related-data/no-listing-06-method-field-interaction/src/main.rs:here}}
```

</Listing>

在这里，我们选择让 `width` 方法在实例的 `width` 字段值大于 `0` 时返回 `true`，而在值为 `0` 时返回 `false`。我们可以出于任何目的在方法中使用同名字段。在 `main` 中，当我们用括号跟随 `rect1.width` 时，Rust 知道我们指的是方法 `width`。当不使用括号时，Rust 知道我们指的是字段 `width`。

通常，但并非总是如此，当我们将方法与字段具有相同的名称时，我们希望它仅返回字段中的值而不做其他事情。这类方法被称为 _getter_，而 Rust 并不像某些其他语言那样自动为结构体字段实现这些 getter。Getter 很有用，因为你可以将字段设为私有但方法设为公开，从而作为类型公共 API 的一部分实现对该字段的只读访问。我们将在 [第7章][public]<!-- ignore -->中讨论什么是公共和私有，以及如何指定字段或方法为公共或私有。

> ### `->` 运算符在哪里？
>
> 在 C 和 C++ 中，调用方法使用两种不同的运算符：如果你直接对对象调用方法，则使用 `.`；如果你通过指向对象的指针调用方法且需要先解引用该指针，则使用 `->`。换句话说，如果 `object` 是一个指针，`object->something()` 类似于 `(*object).something()`。
>
> Rust 没有与 `->` 运算符对应的运算符；相反，Rust 有一个称为_自动引用和解引用_的特性。调用方法是 Rust 中少数具有此行为的地方之一。
>
> 其工作原理如下：当你使用 `object.something()` 调用方法时，Rust 会自动添加 `&`、`&mut` 或 `*`，使得 `object` 符合方法的签名。换句话说，以下两种情况是相同的：
>
> <!-- CAN'T EXTRACT SEE BUG https://github.com/rust-lang/mdBook/issues/1127 -->
>
> ```rust
> # #[derive(Debug,Copy,Clone)]
> # struct Point {
> #     x: f64,
> #     y: f64,
> # }
> #
> # impl Point {
> #    fn distance(&self, other: &Point) -> f64 {
> #        let x_squared = f64::powi(other.x - self.x, 2);
> #        let y_squared = f64::powi(other.y - self.y, 2);
> #
> #        f64::sqrt(x_squared + y_squared)
> #    }
> # }
> # let p1 = Point { x: 0.0, y: 0.0 };
> # let p2 = Point { x: 5.0, y: 6.5 };
> p1.distance(&p2);
> (&p1).distance(&p2);
> ```
>
> 第一种方式看起来更清晰。这种自动引用行为之所以有效，是因为方法有一个明确的接收者——即 `self` 的类型。根据接收者和方法名，Rust 可以明确判断该方法是读取（`&self`）、修改（`&mut self`）还是消耗（`self`）。Rust 对方法接收者隐式实现借用机制，这是使所有权设计更易于使用的重要部分。

### 参数更多的方法

让我们通过为 `Rectangle` 结构体实现第二个方法来练习使用方法。这次我们希望一个 `Rectangle` 实例接受另一个 `Rectangle` 实例，并在第二个 `Rectangle` 完全位于第一个 `Rectangle` 内时返回 `true`，否则返回 `false`。也就是说，一旦定义了 `can_hold` 方法，我们就希望能够编写列表 5-14 中展示的程序。

<Listing number="5-14" file-name="src/main.rs" caption="Using the as-yet-unwritten `can_hold` method">

```rust,ignore
{{#rustdoc_include ../listings/ch05-using-structs-to-structure-related-data/listing-05-14/src/main.rs}}
```

</Listing>

预期输出如下：因为 `rect2` 的两个维度都小于 `rect1` 的维度，但 `rect3` 的宽度大于 `rect1`，所以结果如此。

```text
Can rect1 hold rect2? true
Can rect1 hold rect3? false
```

我们知道需要定义一个方法，因此它将位于 `impl Rectangle` 块中。该方法名为 `can_hold`，它将接受一个不可变的 `Rectangle` 的借用作为参数。通过查看调用该方法的代码，我们可以得知参数的类型：`rect1.can_hold(&rect2)` 传入了 `&rect2`，这是一个对 `rect2`（即 `Rectangle` 实例）的不可变借用。这是合理的，因为我们只需要读取 `rect2`（而不是写入，因为写入意味着需要可变的借用），并且我们希望 `main` 保留对 `rect2` 的所有权，以便在调用 `can_hold` 方法后还能再次使用它。`can_hold` 的返回值将是一个布尔值，实现中会检查 `self` 的宽度和高度是否分别大于另一个 `Rectangle` 的宽度和高度。让我们在列表 5-13 中的 `impl` 块中添加新的 `can_hold` 方法，如列表 5-15 所示。

<Listing number="5-15" file-name="src/main.rs" caption="Implementing the `can_hold` method on `Rectangle` that takes another `Rectangle` instance as a parameter">

```rust
{{#rustdoc_include ../listings/ch05-using-structs-to-structure-related-data/listing-05-15/src/main.rs:here}}
```

</Listing>

当使用列表 5-14 中的 `main` 函数运行此代码时，我们将得到期望的输出。方法可以接受多个参数，这些参数在 `self` 参数之后添加到签名中，这些参数的工作原理与函数中的参数相同。

### 关联函数

所有位于 `impl` 块中的函数都被称为_关联函数_，因为它们与 `impl` 后命名的类型相关。我们可以定义那些不以 `self` 作为第一个参数的关联函数（因此不是方法），因为它们不需要类型的实例来工作。我们已经使用了这样一个函数：定义在 `String` 类型上的 `String::from` 函数。

不是方法的关联函数通常用于构造函数，这些构造函数会返回结构体的新实例。这些通常被称为 `new`，但 `new` 并不是特殊的名称，也不是语言内置的。例如，我们可以选择提供一个名为 `square` 的关联函数，该函数有一个维度参数，并将其同时用作宽度和高度，从而更容易创建正方形 `Rectangle`，而无需重复指定相同的值。

<span class="filename">Filename: src/main.rs</span>

```rust
{{#rustdoc_include ../listings/ch05-using-structs-to-structure-related-data/no-listing-03-associated-functions/src/main.rs:here}}
```

在返回类型中以及函数体内使用的 `Self` 关键字，实际上是 `impl` 关键字后出现的类型的别名，在本例中即为 `Rectangle`。

要调用此关联函数，我们使用带有结构体名称的 `::` 语法；例如 `let sq = Rectangle::square(3);` 就是一种用法。该函数由结构体命名空间化：`::` 语法既用于关联函数，也用于由模块创建的命名空间。我们将在 [第7章][modules]<!-- ignore -->中讨论模块。

### 多个 `impl` 块

每个结构体允许包含多个 `impl` 块。例如，列表5-15与列表5-16中的代码等效，后者将每个方法放在各自的 `impl` 块中。

<Listing number="5-16" caption="Rewriting Listing 5-15 using multiple `impl` blocks">

```rust
{{#rustdoc_include ../listings/ch05-using-structs-to-structure-related-data/listing-05-16/src/main.rs:here}}
```

</Listing>

目前没有必要将这些方法分开到多个 `impl` 块中，但这属于有效的语法。我们将在第10章中看到使用多个 `impl` 块的案例，其中会讨论泛型类型和特质。

## 总结

结构体允许你创建对特定领域有意义的自定义类型。通过使用结构体，你可以将相关的数据连接在一起，并为每个部分命名以使代码更清晰。在 `impl` 块中，你可以定义与类型关联的函数，而方法则是一种关联函数，它让你能够指定结构体实例的行为。

但结构体并不是创建自定义类型的唯一方式：让我们转向Rust的枚举特性，为你提供更多工具。

[enums]: ch06-00-enums.html
[trait-objects]: ch18-02-trait-objects.md
[public]: ch07-03-paths-for-referring-to-an-item-in-the-module-tree.html#exposing-paths-with-the-pub-keyword
[modules]: ch07-02-defining-modules-to-control-scope-and-privacy.html
