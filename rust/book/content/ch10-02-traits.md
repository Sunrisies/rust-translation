<!-- Old headings. Do not remove or links may break. -->

<a id="traits-defining-shared-behavior"></a>

## 使用特质定义共享行为

_特质_定义了特定类型所具有的功能，并可以与其他类型共享。我们可以通过特质以抽象的方式定义共享行为。我们可以使用_特质边界_来指定一个通用类型可以是具有某些行为的任何类型。

> 注意：特质类似于其他语言中的_接口_功能，尽管有一些差异。

### 定义特质

类型的行为由我们可以对该类型调用的方法组成。如果所有类型都能调用相同的方法，那么不同类型就会共享相同的行为。特质定义是一种将方法签名组合在一起的方式，用于定义实现特定目的所需的一组行为。

例如，假设我们有多个结构体，它们存储各种类型和数量的文本：一个`NewsArticle`结构体存储在特定位置发布的新闻故事，而一个`SocialPost`结构体最多可以包含280个字符以及表示是否为新帖子、重新发布或是对其他帖子的回复的元数据。

我们希望创建一个名为`aggregator`的媒体聚合库crate，该库能够显示可能存储在`NewsArticle`或`SocialPost`实例中的数据摘要。为此，我们需要每个类型的摘要，我们可以通过调用实例上的`summarize`方法来获取该摘要。列表10-12展示了公共`Summary`特质的定义，该特质表达了这种行为。

<Listing number="10-12" file-name="src/lib.rs" caption="A `Summary` trait that consists of the behavior provided by a `summarize` method">

```rust,noplayground
{{#rustdoc_include ../listings/ch10-generic-types-traits-and-lifetimes/listing-10-12/src/lib.rs}}
```

</Listing>

在这里，我们使用`trait`关键字声明一个特质，然后给出特质的名称，本例中为`Summary`。我们还将特质声明为`pub`，这样依赖此crate的crate也可以使用这个特质，我们将在几个示例中看到这一点。在花括号内，我们声明了描述实现该特质的类型的行为的方法签名，本例中的方法是`fn summarize(&self) -> String`。

在方法签名之后，我们不使用花括号来提供实现，而是使用分号。每个实现该习性的类型必须为方法的主体提供自己的自定义行为。编译器会确保任何具有 `Summary` 习性的类型都严格遵循此签名定义的方法 `summarize`。

一个习性在其主体中可以包含多个方法：方法签名每行列出一个，每行以分号结尾。

### 在类型上实现习性

现在我们已经定义了 `Summary` 习性方法的期望签名，就可以在媒体聚合器中的类型上实现它。列表 10-13 展示了在 `NewsArticle` 结构体上实现 `Summary` 习性的过程，该结构体使用标题、作者和位置来生成 `summarize` 的返回值。对于 `SocialPost` 结构体，我们将 `summarize` 定义为用户名后跟帖子的完整文本，假设帖子内容已限制为 280 个字符。

<Listing number="10-13" file-name="src/lib.rs" caption="Implementing the `Summary` trait on the `NewsArticle` and `SocialPost` types">

```rust,noplayground
{{#rustdoc_include ../listings/ch10-generic-types-traits-and-lifetimes/listing-10-13/src/lib.rs:here}}
```

</Listing>

在类型上实现习性类似于实现常规方法。不同之处在于，`impl` 之后我们放置要实现的习性名称，然后使用 `for` 关键字，接着指定要实现该习性的类型名称。在 `impl` 块中，我们列出习性定义中的方法签名。我们不使用分号来分隔每个签名，而是使用花括号并填充具体行为，以规定特定类型上该习性的方法应具有的行为。

现在库已经在 `NewsArticle` 和 `SocialPost` 上实现了 `Summary` 习性，用户可以通过与调用常规方法相同的方式调用 `NewsArticle` 和 `SocialPost` 实例上的习性方法。唯一的区别是用户必须同时将习性和类型带入作用域。以下是一个二进制 crate 如何使用我们的 `aggregator` 库 crate 的示例：

```rust,ignore
{{#rustdoc_include ../listings/ch10-generic-types-traits-and-lifetimes/no-listing-01-calling-trait-method/src/main.rs}}
```

此代码输出 `1 new post: horse_ebooks: of course, as you probably already know, people`。

其他依赖 `aggregator` crate的crate也可以将 `Summary` trait引入作用域，在其自身类型上实现 `Summary` 功能。需要注意的一个限制是：我们只能在 trait或该类型属于我们的 crate时，才在类型上实现 trait。例如，我们可以在我们的 `aggregator` crate中，在 `SocialPost` 这样的自定义类型上实现标准库中的 `Display` trait，因为 `SocialPost` 属于我们的 `aggregator` crate。同样，我们也可以在我们的 `aggregator` crate中对 `Vec<T>` 实现 `Summary` trait，因为 `Summary` trait属于我们的 `aggregator` crate。

但是我们无法在外部类型上实现外部 trait。例如，我们不能在 `aggregator` crate中对 `Vec<T>` 实现 `Display` trait，因为 `Display` 和 `Vec<T>` 都定义在标准库中，不属于我们的 `aggregator` crate。这种限制属于一种称为 _coherence_ 的特性，更具体地说就是 _orphan rule_，其名称来源于父类型不存在的情况。该规则确保其他人的代码不会破坏你的代码，反之亦然。如果没有这一规则，两个 crate可能会为同一个类型实现相同的 trait，而 Rust 将无法知道使用哪个实现。

<!-- Old headings. Do not remove or links may break. -->

<a id="default-implementations"></a>

### 使用默认实现

有时，对于 trait中的某些或所有方法采用默认行为会更有用，而不是要求每个类型对所有方法都进行实现。这样，当我们在特定类型上实现 trait时，可以保留或覆盖每个方法的默认行为。

在列表 10-14 中，我们为 `Summary` trait的 `summarize` 方法指定了默认的字符串值，而不是像列表 10-12 那样只定义方法签名。

<Listing number="10-14" file-name="src/lib.rs" caption="Defining a `Summary` trait with a default implementation of the `summarize` method">

```rust,noplayground
{{#rustdoc_include ../listings/ch10-generic-types-traits-and-lifetimes/listing-10-14/src/lib.rs:here}}
```

</Listing>

为了使用默认实现来总结 `NewsArticle` 实例，我们定义了一个空的 `impl` 块，即 `impl Summary for NewsArticle {}`。

尽管我们不再直接在 `NewsArticle` 上定义 `summarize` 方法，但我们提供了默认实现，并指定了 `NewsArticle` 实现了 `Summary` trait。因此，我们仍然可以对 `NewsArticle` 的实例调用 `summarize` 方法，如下所示：

```rust,ignore
{{#rustdoc_include ../listings/ch10-generic-types-traits-and-lifetimes/no-listing-02-calling-default-impl/src/main.rs:here}}
```

此代码会输出 `New article available! (Read more...)`。

创建默认实现不需要我们对列表 10-13 中 `SocialPost` 的 `Summary` 实现做任何更改。原因是覆盖默认实现的语法与实现没有默认实现的 trait 方法的语法相同。

默认实现可以调用同一 trait 中的其他方法，即使这些其他方法没有默认实现。通过这种方式，trait 可以提供大量有用的功能，而实现者只需指定其中一小部分。例如，我们可以定义 `Summary` trait，并包含一个必须提供的 `summarize_author` 方法，然后定义一个具有默认实现的 `summarize` 方法，该方法调用 `summarize_author` 方法：

```rust,noplayground
{{#rustdoc_include ../listings/ch10-generic-types-traits-and-lifetimes/no-listing-03-default-impl-calls-other-methods/src/lib.rs:here}}
```

要使用此版本的 `Summary`，我们在对类型实现 trait 时只需定义 `summarize_author` 即可：

```rust,ignore
{{#rustdoc_include ../listings/ch10-generic-types-traits-and-lifetimes/no-listing-03-default-impl-calls-other-methods/src/lib.rs:impl}}
```

在定义了 `summarize_author` 之后，我们可以对 `SocialPost` 结构体实例调用 `summarize` 方法，而 `summarize` 的默认实现会调用我们提供的 `summarize_author` 的定义。由于我们已经实现了 `summarize_author`，因此 `Summary` trait 已经为我们提供了 `summarize` 方法的行为，无需编写更多代码。其效果如下：

```rust,ignore
{{#rustdoc_include ../listings/ch10-generic-types-traits-and-lifetimes/no-listing-03-default-impl-calls-other-methods/src/main.rs:here}}
```

此代码会输出 `1 new post: (Read more from @horse_ebooks...)`。

请注意，无法从覆盖该方法的实现中调用默认实现。

<!-- Old headings. Do not remove or links may break. -->

<a id="traits-as-parameters"></a>

### 将 trait 作为参数使用

现在你已经知道了如何定义和实现特质，我们可以探讨如何利用特质来定义接受多种不同类型的函数。我们将使用在清单 10-13 中针对 `NewsArticle` 和 `SocialPost` 类型实现的 `Summary` 特质，来定义一个 `notify` 函数，该函数在其 `item` 参数上调用 `summarize` 方法，而 `item` 参数属于实现了 `Summary` 特质的某种类型。为此，我们使用 `impl Trait` 语法，如下所示：

```rust,ignore
{{#rustdoc_include ../listings/ch10-generic-types-traits-and-lifetimes/no-listing-04-traits-as-parameters/src/lib.rs:here}}
```

对于 `item` 参数，我们不使用具体的类型，而是使用 `impl` 关键字和特质名称。这个参数可以接受任何实现了指定特质的类型。在 `notify` 的代码中，我们可以调用 `item` 上来自 `Summary` 特质的任何方法，例如 `summarize`。我们可以调用 `notify` 并传入任意的 `NewsArticle` 或 `SocialPost` 实例。如果代码试图使用其他类型（如 `String` 或 `i32`）来调用该函数，则无法编译，因为这些类型没有实现 `Summary`。

<!-- Old headings. Do not remove or links may break. -->

<a id="fixing-the-largest-function-with-trait-bounds"></a>

#### trait Bound Syntax

`impl Trait` 语法适用于简单的情况，但实际上它是更长形式——即 _trait bound_——的语法糖，其格式如下：

```rust,ignore
pub fn notify<T: Summary>(item: &T) {
    println!("Breaking news! {}", item.summarize());
}
```

这种更长的形式与上一节中的示例等效，但更加冗长。我们在泛型类型参数声明后加冒号，并在尖括号内放置特质边界。

`impl Trait` 语法在简单情况下方便且使代码更简洁，而完整的 trait bound 语法则能在其他情况下表达更复杂的逻辑。例如，我们可以有两个参数都实现了 `Summary`。使用 `impl Trait` 语法时，其格式如下：

```rust,ignore
pub fn notify(item1: &impl Summary, item2: &impl Summary) {
```

如果我们希望该函数允许 `item1` 和 `item2` 具有不同的类型（只要两种类型都实现了 `Summary`），那么使用 `impl Trait` 是合适的。然而，如果我们要强制两个参数具有相同的类型，则必须使用 trait bound，如下所示：

```rust,ignore
pub fn notify<T: Summary>(item1: &T, item2: &T) {
```

作为 `item1` 和 `item2` 参数的类型的泛型类型 `T`，会限制函数行为，使得传递给 `item1` 和 `item2` 的参数的具体类型必须相同。

<!-- Old headings. Do not remove or links may break. -->

<a id="specifying-multiple-trait-bounds-with-the--syntax"></a>

#### 使用 `+` 语法指定多个特质边界

我们也可以指定多个特质边界。假设我们希望 `notify` 同时使用显示格式化和对 `item` 的 `summarize`：我们在 `notify` 定义中指定 `item` 必须实现 `Display` 和 `Summary` 两个特质。可以使用 `+` 语法来实现这一点：

```rust,ignore
pub fn notify(item: &(impl Summary + Display)) {
```

对于泛型类型的特质边界，`+` 语法也是有效的：

```rust,ignore
pub fn notify<T: Summary + Display>(item: &T) {
```

在指定了这两个特质边界后，`notify` 的体部分可以调用 `summarize`，并使用 `{}` 来格式化 `item`。

#### 使用 `where` 子句使特质边界更清晰

使用过多的特质边界也有其缺点。每个泛型都有自己独特的特质边界，因此具有多个泛型类型参数的函数会在函数名和参数列表之间包含大量特质边界信息，使得函数签名难以阅读。为此，Rust 提供了在 `where` 子句内指定特质边界的替代语法。因此，我们可以不用这样写：

```rust,ignore
fn some_function<T: Display + Clone, U: Clone + Debug>(t: &T, u: &U) -> i32 {
```

而是使用 `where` 子句，如下所示：

```rust,ignore
{{#rustdoc_include ../listings/ch10-generic-types-traits-and-lifetimes/no-listing-07-where-clause/src/lib.rs:here}}
```

这个函数的签名更简洁：函数名、参数列表和返回类型紧密排列在一起，类似于没有大量特质边界的函数。

### 返回实现特质的类型

我们也可以在返回值位置使用 `impl Trait` 语法来返回某个实现了特定特质的类型，如下所示：

```rust,ignore
{{#rustdoc_include ../listings/ch10-generic-types-traits-and-lifetimes/no-listing-05-returning-impl-trait/src/lib.rs:here}}
```

通过将返回类型定义为 `impl Summary`，我们指定了 `returns_summarizable` 函数返回了一个实现了 `Summary` 特质的类型，而无需明确具体类型。在这种情况下，`returns_summarizable` 返回的是 `SocialPost` 类型，但调用该函数的代码不需要知道这一点。

仅通过实现的特质来指定返回类型在闭包和迭代器的上下文中特别有用，我们将在第13章讨论这些内容。闭包和迭代器产生的类型只有编译器知道，或者这些类型的定义非常复杂。`impl Trait` 语法允许你简洁地指定函数返回了一个实现了 `Iterator` 特质的类型，而无需写出非常长的类型描述。

然而，如果你返回的是单一类型，只能使用 `impl Trait`。例如，以下代码返回了 `NewsArticle` 或 `SocialPost`，但返回类型为 `impl Summary`，这样是不行的：

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch10-generic-types-traits-and-lifetimes/no-listing-06-impl-trait-returns-one-type/src/lib.rs:here}}
```

由于编译器对 `impl Trait` 语法的实现有限制，返回 `NewsArticle` 或 `SocialPost` 是不允许的。我们将在第18章的“使用特质对象来抽象共享行为”部分介绍如何编写具有此行为的函数。

### 使用特质边界条件性实现方法

通过在一个包含泛型类型参数的 `impl` 块中使用特质边界，我们可以为实现了指定特质的类型条件性实现方法。例如，列表10-15中的 `Pair<T>` 类型总是实现 `new` 函数，该函数返回一个新的 `Pair<T>` 实例（回想一下第5章的“方法语法”部分，`Self` 是 `impl` 块中类型的别名，在本例中为 `Pair<T]`）。但在下一个 `impl` 块中，`Pair<T>` 仅当其内部类型 `T` 实现了允许比较的 `PartialOrd` 特质和允许打印的 `Display` 特质时，才实现 `cmp_display` 方法。

<Listing number="10-15" file-name="src/lib.rs" caption="Conditionally implementing methods on a generic type depending on trait bounds">

```rust,noplayground
{{#rustdoc_include ../listings/ch10-generic-types-traits-and-lifetimes/listing-10-15/src/lib.rs}}
```

</Listing>

我们还可以为任何实现了另一个特质的类型条件性实现该特质。对于满足特质边界的任何类型，对该特质的实现被称为_ blanket implementation_，并在 Rust 标准库中被广泛使用。例如，标准库对实现了 `Display` 特质的任何类型都实现了 `ToString` 特质。标准库中的 `impl` 块类似于以下代码：

```rust,ignore
impl<T: Display> ToString for T {
    // --snip--
}
```

由于标准库有这种 blanket 实现，我们可以对任意实现了 `Display` 特质的类型调用由 `ToString` 特质定义的 `to_string` 方法。例如，我们可以将整数转换为对应的 `String` 值，因为整数实现了 `Display` 特质。

```rust
let s = 3.to_string();
```

Blanket 实现出现在该特质的文档的“实现者”部分中。

特质和特质边界让我们能够编写使用泛型类型参数的代码来减少重复，同时向编译器表明我们希望该泛型类型具有特定的行为。然后编译器可以利用特质边界信息来检查代码中使用的所有具体类型是否具备正确的行为。在动态类型语言中，如果我们对未定义该方法的类型调用方法，会在运行时产生错误。但 Rust 将这些错误移到了编译时阶段，因此我们必须在代码能够运行之前解决这些问题。此外，我们不必编写在运行时检查行为的代码，因为我们已经在编译时进行了检查。这样做可以在不放弃泛型灵活性的情况下提升性能。

[trait-objects]: ch18-02-trait-objects.html#using-trait-objects-to-abstract-over-shared-behavior
[methods]: ch05-03-method-syntax.html#method-syntax
