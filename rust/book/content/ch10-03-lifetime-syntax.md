## 使用生命周期验证引用

生命周期是另一种我们已经使用的泛型。与确保类型具有我们希望的行为不同，生命周期则确保引用在我们需要时保持有效。

在第4章的[“引用和借用”][references-and-借用]<!-- ignore -->部分中，我们没有讨论的一个细节是，Rust中的每个引用都有一个生命周期，即该引用有效的范围。大多数情况下，生命周期是隐式的且被推导出来的，就像大多数情况下类型被推导出来一样。我们只需在可能存在多种类型时对类型进行标注。同样，当引用的生命周期可以以几种不同的方式关联时，我们必须对生命周期进行标注。Rust要求我们使用泛型生命周期参数来标注这些关系，以确保运行时实际使用的引用确实有效。

标注生命周期甚至不是其他大多数编程语言所拥有的概念，因此这可能会让人感到陌生。虽然本章不会全面讨论生命周期，但我们会介绍你可能遇到的常见生命周期语法方式，以便你能够熟悉这一概念。

<!-- Old headings. Do not remove or links may break. -->

<a id="preventing-dangling-references-with-lifetimes"></a>

### 悬空引用

生命周期的主要目的就是防止悬空引用，如果允许悬空引用存在，会导致程序引用到与其预期不同的数据。请考虑列表10-16中的程序，它有一个外部作用域和一个内部作用域。

<Listing number="10-16" caption="An attempt to use a reference whose value has gone out of scope">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch10-generic-types-traits-and-lifetimes/listing-10-16/src/main.rs}}
```

</Listing>

> 注意：列表10-16、10-17和10-23中的示例都没有给变量赋予初始值，因此变量名存在于外部作用域中。乍看之下，这似乎与Rust没有空值的概念冲突。然而，如果我们试图在赋值之前使用变量，将会出现编译时错误，这表明Rust确实不允许空值。

外部作用域声明了一个名为 `r` 的变量，没有初始值；内部作用域则声明了一个名为 `x` 的变量，其初始值为 `5`。在内部作用域中，我们尝试将 `r` 的值设置为对 `x` 的引用。随后，内部作用域结束，我们试图打印 `r` 中的值。这段代码无法编译，因为 `r` 所引用的数据在尝试使用它之前已经超出了作用域。以下是错误信息：

```console
{{#include ../listings/ch10-generic-types-traits-and-lifetimes/listing-10-16/output.txt}}
```

错误信息表明变量 `x` “存活时间不足”。原因是当第7行内部作用域结束时，`x` 就会超出作用域。但 `r` 对于外部作用域仍然有效；由于其作用域更大，我们称其为“存活更久”。如果 Rust 允许这段代码运行，那么 `r` 将引用在 `x` 超出作用域时已被释放的内存，任何尝试使用 `r` 的操作都将无法正确执行。那么，Rust 是如何判断这段代码无效的呢？它使用了借用检查器。

### 借用检查器

Rust 编译器具有 _借用检查器_，该检查器通过比较作用域来判断所有借用是否合法。列表 10-17 展示了与列表 10-16 相同的代码，但添加了注释以显示变量的生命周期。

<Listing number="10-17" caption="Annotations of the lifetimes of `r` and `x`, named `'a` and `'b`, respectively">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch10-generic-types-traits-and-lifetimes/listing-10-17/src/main.rs}}
```

</Listing>

在这里，我们用 `'a` 标注了 `r` 的生命周期，用 `'b` 标注了 `x` 的生命周期。如您所见，内部 `'b` 块比外部 `'a` 生命周期块要小得多。在编译时，Rust 会比较这两个生命周期的大小，发现 `r` 具有 `'a` 的生命周期，但它引用的是具有 `'b` 生命周期的内存。程序被拒绝是因为 `'b` 比 `'a` 短：引用的对象存活时间不如引用本身长。

列表 10-18 修复了代码，使其不再有悬垂引用，并且可以无错误地编译。

<Listing number="10-18" caption="A valid reference because the data has a longer lifetime than the reference">

```rust
{{#rustdoc_include ../listings/ch10-generic-types-traits-and-lifetimes/listing-10-18/src/main.rs}}
```

</Listing>

在这里，`x` 具有 `'b` 的生命周期，在这种情况下比 `'a` 大。这意味着 `r` 可以引用 `x`，因为 Rust 知道在 `x` 有效期间，`r` 中的引用始终是有效的。

现在你已经知道了引用生命周期的位置以及 Rust 如何分析生命周期以确保引用始终有效，让我们来探讨函数参数和返回值中的通用生命周期。

### 函数中的通用生命周期

我们将编写一个返回两个字符串切片中较长一个的函数。该函数接受两个字符串切片并返回一个字符串切片。在实现了 `longest` 函数后，清单 10-19 中的代码应输出 `The longest string is abcd`。

<Listing number="10-19" file-name="src/main.rs" caption="A `main` function that calls the `longest` function to find the longer of two string slices">

```rust,ignore
{{#rustdoc_include ../listings/ch10-generic-types-traits-and-lifetimes/listing-10-19/src/main.rs}}
```

</Listing>

请注意，我们希望该函数接收的是字符串切片（即引用），而不是字符串，因为我们不希望 `longest` 函数拥有其参数的所有权。关于为什么清单 10-19 中使用的参数是我们想要的，请参考第 4 章中的“将字符串切片作为参数”[string-slices-as-parameters]<!-- ignore -->。

如果我们尝试按照清单 10-20 所示的方式实现 `longest` 函数，它将无法编译。

<Listing number="10-20" file-name="src/main.rs" caption="An implementation of the `longest` function that returns the longer of two string slices but does not yet compile">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch10-generic-types-traits-and-lifetimes/listing-10-20/src/main.rs:here}}
```

</Listing>

相反，我们会得到关于生命周期的错误信息：

```console
{{#include ../listings/ch10-generic-types-traits-and-lifetimes/listing-10-20/output.txt}}
```

帮助文本表明返回类型需要一个通用生命周期参数，因为 Rust 无法确定返回的引用是指 `x` 还是 `y`。实际上，我们也不知道，因为该函数的主体中的 `if` 块返回的是对 `x` 的引用，而 `else` 块返回的是对 `y` 的引用！

在定义此函数时，我们不知道将传入的具体值，因此无法判断 `if` 情况或 `else` 情况哪个会执行。我们也不知道将要传入的引用的具体生命周期，因此无法像在清单 10-17 和 10-18 中那样查看作用域来确定返回的引用是否始终有效。借用检查器也无法确定这一点，因为它不知道 `x` 和 `y` 的生命周期与返回值的生命周期之间的关系。为了修复此错误，我们将添加定义引用之间关系的通用生命周期参数，以便借用检查器能够进行分析。

### 生命周期注解语法

生命周期注解并不会改变任何引用存在的时长，而是描述多个引用的生命周期之间的关系，而不会影响各自的寿命。就像函数可以通过签名中的泛型类型参数接受任意类型一样，函数也可以通过指定一个泛型生命周期参数来接受具有任意生命周期的引用。

生命周期注解的语法有些特殊：生命周期参数的名称必须以单引号（`'`）开头，通常都是小写且非常简短，类似于泛型类型。大多数人使用 `'a` 作为第一个生命周期注解的名称。我们将生命周期参数注解放在引用的 `&` 之后，并使用空格将注解与引用类型分开。

以下是一些示例——一个没有生命周期参数的 `i32` 引用、一个带有名为 `'a` 的生命周期参数的 `i32` 引用，以及一个具有生命周期 `'a'` 的可变 `i32` 引用。

```rust,ignore
&i32        // a reference
&'a i32     // a reference with an explicit lifetime
&'a mut i32 // a mutable reference with an explicit lifetime
```

单个生命周期注解本身并没有太多意义，因为这些注解的目的是告诉 Rust 多个引用的泛型生命周期参数之间的关系如何。让我们看看在 `longest` 函数的上下文中，各个生命周期注解之间是如何关联的。

<!-- Old headings. Do not remove or links may break. -->

<a id="lifetime-annotations-in-function-signatures"></a>

### 在函数签名中

要在函数签名中使用生命周期注解，我们需要在函数名称和参数列表之间的尖括号内声明泛型生命周期参数，就像处理泛型类型参数一样。

我们希望该签名能够表达以下约束：只要两个参数都有效，返回的引用也有效。这就是参数和返回值之间的生命周期关系。我们将这个生命周期命名为 `'a`，然后将其添加到每个引用中，如清单 10-21 所示。

<Listing number="10-21" file-name="src/main.rs" caption="The `longest` function definition specifying that all the references in the signature must have the same lifetime `'a`">

```rust
{{#rustdoc_include ../listings/ch10-generic-types-traits-and-lifetimes/listing-10-21/src/main.rs:here}}
```

</Listing>

当我们在清单 10-19 中的 `main` 函数中使用这段代码时，它应该能够编译并通过，并产生我们期望的结果。

函数签名现在向 Rust 表明：对于某个生命周期 `'a`，该函数接受两个参数，这两个参数都是至少与生命周期 `'a'` 一样长的字符串切片。函数签名还表明，从函数中返回的字符串切片也至少是与生命周期 `'a'` 一样长的。实际上，这意味着 `longest` 函数返回的引用生命周期等于函数参数所引用的值生命周期中较小的那个。这些关系正是我们希望 Rust 在分析代码时使用的。

请记住，在函数签名中指定生命周期参数时，我们并没有改变传入或返回的任何值的生命周期。相反，我们只是表明借用检查器应拒绝任何不符合这些约束条件的价值。注意，`longest` 函数不需要确切知道 `x` 和 `y` 将存活多久，只需某个作用域可以替代 `'a'`，以满足该签名即可。

在函数中注释生命周期时，这些注释应放在函数签名中，而不是函数体内。生命周期注释成为函数的契约的一部分，就像签名中的类型一样。如果函数签名包含生命周期契约，则 Rust 编译器的分析就可以更简单。如果函数的注释方式或调用方式存在问题，编译器错误可以更准确地指向我们的代码部分和约束条件。相反，如果 Rust 编译器对生命周期关系有了更多的推断，那么编译器可能只能指出我们代码中远离问题根源的某处使用问题。

当我们将具体引用传递给 `longest` 时，替代 `'a` 的具体生命周期就是 `x` 的作用域与 `y` 的作用域重叠的部分。换句话说，通用生命周期 `'a` 将获得等于 `x` 和 `y` 中较小生命周期的具体生命周期。由于我们将返回的引用标注了相同的生命周期参数 `'a'，因此该返回引用在 `x` 和 `y` 中较小的生命周期内也是有效的。

让我们看看生命周期注释如何通过传递具有不同具体生命周期的引用来限制 `longest` 函数。列表 10-22 是一个简单的示例。

<Listing number="10-22" file-name="src/main.rs" caption="Using the `longest` function with references to `String` values that have different concrete lifetimes">

```rust
{{#rustdoc_include ../listings/ch10-generic-types-traits-and-lifetimes/listing-10-22/src/main.rs:here}}
```

</Listing>

在这个示例中，`string1` 在外部作用域结束之前都是有效的，`string2` 在内层作用域结束之前都是有效的，而 `result` 引用的内容在内层作用域结束之前都是有效的。运行此代码后，你会看到借用检查器批准了它；代码可以编译并输出 `The longest string is long string is long`。

接下来，让我们尝试一个示例，展示 `result` 中引用的生命周期必须是两个参数中较小的那个。我们将 `result` 变量的声明移出内层作用域，但将值赋给 `result` 变量的赋值操作保留在带有 `string2` 的内层作用域内。然后，我们将使用 `result` 的 `println!` 输出移到内层作用域之外的位置，此时内层作用域已经结束。列表 10-23 中的代码将无法编译。

<Listing number="10-23" file-name="src/main.rs" caption="Attempting to use `result` after `string2` has gone out of scope">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch10-generic-types-traits-and-lifetimes/listing-10-23/src/main.rs:here}}
```

</Listing>

当我们尝试编译此代码时，会遇到以下错误：

```console
{{#include ../listings/ch10-generic-types-traits-and-lifetimes/listing-10-23/output.txt}}
```

该错误表明，为了使 `result` 在 `println!` 语句中有效，`string2` 必须在外部作用域结束之前保持有效性。Rust 知道这一点，因为我们使用相同的生命周期参数 `'a` 来标注函数参数和返回值的生命周期。

作为人类，我们可以查看这段代码发现 `string1` 的长度大于 `string2`，因此 `result` 将包含对 `string1` 的引用。由于 `string1` 尚未超出作用域，对 `string1` 的引用在 `println!` 语句中仍然有效。然而，编译器无法识别在这种情况下该引用是有效的。我们告诉 Rust，由 `longest` 函数返回的引用的生命周期与传入引用中的较小生命周期相同。因此，借用检查器禁止列表 10-23 中的代码可能存在无效引用。

尝试设计更多实验，改变传递给 `longest` 函数的引用的值和生命周期，以及返回的引用如何被使用。在编译之前，对您的实验是否能够通过借用检查器提出假设；然后验证您是否正确！

<!-- Old headings. Do not remove or links may break. -->

<a id="thinking-in-terms-of-lifetimes"></a>

### 关系

您需要指定生命周期参数的方式取决于函数所做的事情。例如，如果我们将 `longest` 函数的实现改为始终返回第一个参数而不是最长的字符串切片，则无需为 `y` 参数指定生命周期。以下代码可以编译通过：

<Listing file-name="src/main.rs">

```rust
{{#rustdoc_include ../listings/ch10-generic-types-traits-and-lifetimes/no-listing-08-only-one-reference-with-lifetime/src/main.rs:here}}
```

</Listing>

我们为参数 `x` 和返回类型指定了生命周期参数 `'a'，但并未为参数 `y` 指定，因为 `y` 的生命周期与 `x` 的生命周期或返回值没有关系。

当从函数返回引用时，返回类型的生命周期参数必须与其中一个参数的生命周期参数匹配。如果返回的引用不是指向其中一个参数，则必须指向该函数在内部创建的值。然而，这将是一个悬垂引用，因为该值将在函数结束时超出作用域。考虑以下无法编译的 `longest` 函数的实现：

<Listing file-name="src/main.rs">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch10-generic-types-traits-and-lifetimes/no-listing-09-unrelated-lifetime/src/main.rs:here}}
```

</Listing>

在这里，尽管我们为返回类型指定了生命周期参数 `'a'，但此实现将无法编译，因为返回值的生命周期与参数的生命周期完全无关。我们得到的错误信息如下：

```console
{{#include ../listings/ch10-generic-types-traits-and-lifetimes/no-listing-09-unrelated-lifetime/output.txt}}
```

问题在于 `result` 超出了作用域，并在 `longest` 函数的末尾被清理。我们还试图从函数中返回对 `result` 的引用。我们无法指定能够改变悬空引用的生命周期参数，而 Rust 也不允许创建悬空引用。在这种情况下，最好的解决方案是返回拥有所有权的数据类型而不是引用，这样调用函数就负责清理该值。

最终，生命周期语法旨在连接函数的各种参数和返回值的生命周期。一旦它们被连接，Rust 就有足够的信息来进行内存安全操作，并禁止那些会创建悬空指针或违反内存安全的操作。

<!-- Old headings. Do not remove or links may break. -->

<a id="lifetime-annotations-in-struct-definitions"></a>

### 在结构体定义中

到目前为止，我们定义的结构体都包含拥有所有权的类型。我们可以定义结构体来保存引用，但在这种情况下，我们需要在结构体的定义中为每个引用添加生命周期注释。列表 10-24 中有一个名为 `ImportantExcerpt` 的结构体，它包含一个字符串切片。

<Listing number="10-24" file-name="src/main.rs" caption="A struct that holds a reference, requiring a lifetime annotation">

```rust
{{#rustdoc_include ../listings/ch10-generic-types-traits-and-lifetimes/listing-10-24/src/main.rs}}
```

</Listing>

该结构体有一个单一字段 `part`，其中包含一个字符串切片，即一个引用。与通用数据类型一样，我们在结构体名称后用尖括号括起来声明通用生命周期参数的名称，以便在结构体定义的主体中使用该生命周期参数。这种注释意味着 `ImportantExcerpt` 的实例不能超出其 `part` 字段中引用的生命周期。

这里的 `main` 函数创建了一个 `ImportantExcerpt` 结构体的实例，该结构体持有对变量 `novel` 所拥有的 `String` 的第一句话的引用。在 `ImportantExcerpt` 实例创建之前，`novel` 中的数据就已经存在了。此外，`novel` 的作用域直到 `ImportantExcerpt` 的作用域结束之后才消失，因此 `ImportantExcerpt` 实例中的引用是有效的。

### 生命周期省略规则

你已经了解到每个引用都有一个生命周期，并且对于使用引用的函数或结构体，你需要指定生命周期参数。然而，在列表 4-9 中有一个函数，在列表 10-25 中再次展示，它无需生命周期注释即可编译通过。

<Listing number="10-25" file-name="src/lib.rs" caption="A function we defined in Listing 4-9 that compiled without lifetime annotations, even though the parameter and return type are references">

```rust
{{#rustdoc_include ../listings/ch10-generic-types-traits-and-lifetimes/listing-10-25/src/main.rs:here}}
```

</Listing>

这个函数无需生命周期注释即可编译通过的原因是历史原因：在 Rust 的早期版本（1.0 之前），这段代码无法编译，因为每个引用都需要显式的生命周期说明。当时，函数的签名会写成如下形式：

```rust,ignore
fn first_word<'a>(s: &'a str) -> &'a str {
```

编写了大量 Rust 代码后，Rust 团队发现 Rust 程序员在特定情况下会反复使用相同的生命周期注释。这些情况是可以预测的，并且遵循一些确定的模式。开发者将这些模式编程到编译器中，这样借用检查器就能推断出这些情况下的生命周期，无需显式注释。

这段 Rust 历史很重要，因为有可能会出现更多确定的模式并被添加到编译器中。未来，可能需要的生命周期注释会进一步减少。

被编程到 Rust 对引用分析中的模式被称为 _生命周期省略规则_。这些不是程序员需要遵循的规则；而是编译器将考虑的一组特定情况，如果你的代码符合这些情况，就无需显式写出生命周期。

省略规则并不能提供完整的推理。如果在 Rust 应用这些规则后，关于引用所拥有的生命周期仍然存在歧义，编译器不会猜测剩余引用的生命周期应该是什么。因此，编译器会直接报错，你需要通过添加生命周期注释来解决问题。

函数或方法参数上的生命周期被称为 _输入生命周期_，而返回值上的生命周期则被称为 _输出生命周期_。

当没有明确的注释时，编译器使用三条规则来确定引用的生命周期。第一条规则适用于输入生命周期，第二条和第三条规则适用于输出生命周期。如果编译器执行完这三条规则后，仍无法确定某些引用的生命周期，就会报错。这些规则同样适用于 `fn` 定义和 `impl` 块。

第一条规则是，编译器会给每个引用参数分配一个生命周期参数。换句话说，具有一个参数的函数会获得一个生命周期参数：`fn foo<'a>(x: &'a i32)`；具有两个参数的函数则获得两个独立的生命周期参数：`fn foo<'a, 'b>(x: &'a i32, y: &'b i32)`；依此类推。

第二条规则是，如果恰好有一个输入生命周期参数，那么这个生命周期会被分配给所有输出生命周期参数：`fn foo<'a>(x: &'a i32) -> &'a i32`。

第三条规则是，如果有多个输入生命周期参数，但其中一个是 `&self` 或 `&mut self`（因为这是一个方法），那么 `self` 的生命周期会被分配给所有输出生命周期参数。这条规则使得方法的读写更加简洁，因为所需的符号更少。

假设我们是编译器。我们将应用这些规则来确定列表 10-25 中 `first_word` 函数签名中引用的生命周期。该签名的开头没有与引用相关的任何生命周期：

```rust,ignore
fn first_word(s: &str) -> &str {
```

然后，编译器应用第一条规则，规定每个参数都获得自己的生命周期。我们像往常一样将其命名为 `'a`，因此现在的签名如下：

```rust,ignore
fn first_word<'a>(s: &'a str) -> &str {
```

第二条规则适用，因为恰好有一个输入生命周期。第二条规则规定，一个输入参数的生命周期会被分配给输出生命周期，因此签名现在如下：

```rust,ignore
fn first_word<'a>(s: &'a str) -> &'a str {
```

现在该函数签名中的所有引用都有生命周期，编译器可以继续进行分析，无需程序员在函数签名中标注生命周期。

让我们看另一个例子，这次使用 `longest` 函数，我们在列表 10-20 中开始处理它时它没有生命周期参数：

```rust,ignore
fn longest(x: &str, y: &str) -> &str {
```

让我们应用第一条规则：每个参数都有自己的生命周期。这次我们有两个参数而不是一个，因此有两个生命周期：

```rust,ignore
fn longest<'a, 'b>(x: &'a str, y: &'b str) -> &str {
```

你可以看到第二条规则不适用，因为有一个以上的输入生命周期。`longest` 是一个函数而不是方法，所以没有参数是 `self`。经过对三条规则的讨论后，我们仍然不知道返回类型的生命周期是什么。这就是我们在编译列表 10-20 中的代码时出现错误的原因：编译器虽然处理了生命周期省略规则，但仍然无法确定签名中引用的所有生命周期。

因为第三条规则实际上只适用于方法签名，我们将在接下来的内容中探讨该上下文中的生命周期，以了解为什么第三条规则意味着我们很少需要在方法签名中标注生命周期。

<!-- Old headings. Do not remove or links may break. -->

<a id="lifetime-annotations-in-method-definitions"></a>

### 在方法定义中

当我们在带有生命周期的结构体上实现方法时，使用与泛型类型参数相同的语法，如列表 10-11 所示。我们如何声明和使用生命周期参数取决于它们是与结构体字段相关还是与方法参数和返回值相关。

结构体字段的生命周期名称必须在 `impl` 关键字之后声明，然后在结构体名称之后使用，因为这些生命周期是结构体类型的一部分。

在 `impl` 块中的方法签名中，引用可能与结构体字段中的引用的生命周期绑定在一起，也可能相互独立。此外，生命周期省略规则通常使得在方法签名中不需要标注生命周期。让我们以清单 10-24 中定义的名为 `ImportantExcerpt` 的结构体为例来看一些示例。

首先，我们将使用一个名为 `level` 的方法，该方法的唯一参数是对 `self` 的引用，其返回值为 `i32`，而不是对任何事物的引用：

```rust
{{#rustdoc_include ../listings/ch10-generic-types-traits-and-lifetimes/no-listing-10-lifetimes-on-methods/src/main.rs:1st}}
```

在 `impl` 之后的生命周期参数声明以及在类型名称之后对其的使用是必需的，但由于第一条省略规则，我们不需要标注对 `self` 引用的生命周期。

这是一个应用了第三条生命周期省略规则的示例：

```rust
{{#rustdoc_include ../listings/ch10-generic-types-traits-and-lifetimes/no-listing-10-lifetimes-on-methods/src/main.rs:3rd}}
```

有两个输入生命周期，因此 Rust 应用了第一条生命周期省略规则，为 `&self` 和 `announcement` 分别分配了各自的生命周期。然后，由于其中一个参数是 `&self`，返回类型的生命周期也变为 `&self`，所有生命周期都得到了处理。

### 静态生命周期

我们需要讨论的一个特殊生命周期是 `'static'，表示受影响的引用可以在程序的整个运行期间存在。所有字符串字面量都具有 `'static` 生命周期，我们可以如下标注：

```rust
let s: &'static str = "I have a static lifetime.";
```

该字符串的文本直接存储在始终可用的程序二进制文件中。因此，所有字符串字面量的生命周期都是 `'static'`。

您可能会在错误消息中看到建议使用 `'static` 生命周期的提示。但在指定引用为 `'static` 生命周期之前，请考虑您所拥有的引用是否真的能贯穿整个程序的生命周期，以及您是否希望如此。大多数情况下，提示使用 `'static` 生命周期的错误消息是由于试图创建悬空引用或可用生命周期不匹配导致的。在这种情况下，解决方案是修复这些问题，而不是指定 `'static` 生命周期。

<!-- Old headings. Do not remove or links may break. -->

<a id="generic-type-parameters-trait-bounds-and-lifetimes-together"></a>

## 泛型类型参数、特质边界和生命周期

让我们简要看看在同一个函数中指定泛型类型参数、特质边界和生命周期的语法！

```rust
{{#rustdoc_include ../listings/ch10-generic-types-traits-and-lifetimes/no-listing-11-generics-traits-and-lifetimes/src/main.rs:here}}
```

这是列表 10-21 中的 `longest` 函数，它返回两个字符串切片中较长的那个。但现在它有一个额外的参数 `ann`，属于泛型类型 `T`，任何实现 `Display` 特质的类型都可以填充此参数，具体规则由 `where` 子句指定。这个额外参数将通过 `{}` 进行打印，因此需要 `Display` 特质边界来定义。由于生命周期是一种泛型，生命周期参数 `'a'` 和泛型类型参数 `T` 的声明都放在函数名后面的尖括号内列表中。

## 总结

本章我们学习了很多内容！现在你已经了解了泛型类型参数、特质和特质边界以及泛型生命周期参数，你可以编写不会重复且适用于多种情况的代码了。泛型类型参数使你能够将代码应用于不同的类型。特质和特质边界确保即使类型是泛型的，也能具备代码所需的行为。你学会了如何使用生命周期注解来避免灵活代码中出现悬垂引用。所有这些分析都在编译时完成，不会影响运行时性能！

无论你是否相信，本章讨论的主题还有更多需要学习的内容：第 18 章讨论了特质对象，这是使用特质的另一种方式。还有一些涉及生命周期注解的复杂场景，你只需要在非常高级的情况下才会用到；对于这些场景，你应该阅读 [Rust 参考手册][reference]。接下来，你将学习如何在 Rust 中编写测试，以确保代码按预期运行。

[references-and-borrowing]: ch04-02-references-and-borrowing.html#references-and-borrowing
[string-slices-as-parameters]: ch04-03-slices.html#string-slices-as-parameters
[reference]: ../reference/trait-bounds.html
