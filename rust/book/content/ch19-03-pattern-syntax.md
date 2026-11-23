## 模式语法

在本节中，我们将汇总模式中有效的所有语法，并讨论为何以及何时需要使用每种语法。

### 匹配字面量

如第6章所示，你可以直接对字面量进行模式匹配。以下代码提供了一些示例：

```rust
{{#rustdoc_include ../listings/ch19-patterns-and-matching/no-listing-01-literals/src/main.rs:here}}
```

此代码输出 `one`，因为 `x` 中的值为 `1`。当你的代码需要针对特定具体值执行操作时，这种语法非常有用。

### 匹配命名变量

命名变量是不可更改的模式，可以匹配任何值，我们在本书中多次使用了它们。然而，在 `match`、`if let` 或 `while let` 表达式中使用命名变量时存在复杂性。由于这些表达式会启动新的作用域，因此在这些表达式中作为模式一部分声明的变量会覆盖这些构造外部具有相同名称的变量，就像所有变量一样。在列表19-11中，我们声明了一个名为 `x` 的变量，其值为 `Some(5)`，以及一个名为 `y` 的变量，其值为 `10`。然后我们在 `x` 的值上创建一个 `match` 表达式。请查看 `match` 分支中的模式以及最后的 `println!`，在运行此代码或继续阅读之前，尝试弄清楚代码将输出什么。

<Listing number="19-11" file-name="src/main.rs" caption="A `match` expression with an arm that introduces a new variable which shadows an existing variable `y`">

```rust
{{#rustdoc_include ../listings/ch19-patterns-and-matching/listing-19-11/src/main.rs:here}}
```

</Listing>

让我们逐步分析 `match` 表达式运行时发生的情况。第一个 `match` 分支中的模式与 `x` 的定义值不匹配，因此代码继续执行。

第二个 `match` 分支中的模式引入了一个名为 `y` 的新变量，它可以匹配 `Some` 值内的任何值。由于我们在 `match` 表达式内处于新的作用域中，这是一个新的 `y` 变量，而不是最初值为 `10` 的 `y` 变量。这个新的 `y` 绑定会匹配 `Some` 内部的值，即 `x` 中的值 `5`。因此，这个新的 `y` 与 `x` 中的 `Some` 内部值绑定在一起。该值为 `5`，所以该分支的表达式执行并输出 `Matched, y = 5`。

如果 `x` 是 `None` 值而不是 `Some(5)`，前两个分支的模式将不匹配，因此该值会匹配到下划线。我们没有在下划线的分支中引入 `x` 变量，所以表达式中的 `x` 仍然是未被遮蔽的外部 `x`。在这种假设情况下，`match` 会输出 `Default case, x = None`。

当 `match` 表达式执行完毕后，其作用域就结束了，内部 `y` 的作用域也是如此。最后的 `println!` 会输出 `at the end: x = Some(5), y = 10`。

为了创建一个比较外部 `x` 和 `y` 值的 `match` 表达式，而不是引入一个新的变量来遮蔽现有的 `y` 变量，我们需要使用匹配保护条件。我们将在 “[“添加带有匹配保护的条件”](#adding-conditionals-with-匹配-guards)”部分后面讨论匹配保护。

<!-- Old headings. Do not remove or links may break. -->
<a id="multiple-patterns"></a>

### 匹配多个模式

在 `match` 表达式中，你可以使用 `|` 语法来匹配多个模式，这是模式 _或_ 运算符。例如，在以下代码中，我们根据 `x` 的值与 `match` 分支进行匹配，第一个分支有一个 _或_ 选项，意味着如果 `x` 的值与该分支中的任何一个值匹配，该分支的代码就会执行：


```rust
{{#rustdoc_include ../listings/ch19-patterns-and-matching/no-listing-02-multiple-patterns/src/main.rs:here}}
```

这段代码会输出 `one or two`。

### 使用 `..=` 匹配值范围

`..=` 语法允许我们匹配一个包含性的值范围。在以下代码中，当某个模式与给定范围内的任何值匹配时，该分支就会执行：

```rust
{{#rustdoc_include ../listings/ch19-patterns-and-matching/no-listing-03-ranges/src/main.rs:here}}
```

如果 `x` 是 `1`、`2`、`3`、`4` 或 `5`，第一个分支会匹配。这种语法比使用 `|` 运算符表达相同的概念更方便；如果我们使用 `|`，则必须指定 `1 | 2 | 3 | 4 | 5`。指定范围更为简洁，尤其是当我们想要匹配 1 到 1,000 之间的任意数字时！

编译器在编译时会检查范围是否为空，由于 Rust 能够判断范围是否为空的类型只有 `char` 和数值类型，因此范围只能用于数值或 `char` 值。

这是一个使用 `char` 值的范围的示例：

```rust
{{#rustdoc_include ../listings/ch19-patterns-and-matching/no-listing-04-ranges-of-char/src/main.rs:here}}
```

Rust 能够识别 `'c'` 属于第一个模式的范围，并输出 `early ASCII letter`。

### 通过解构来分解值

我们还可以使用模式来解构结构体、枚举和元组中的不同部分。让我们逐一了解每个值。

<!-- Old headings. Do not remove or links may break. -->

<a id="destructuring-structs"></a>

#### 结构体

清单 19-12 展示了一个包含两个字段 `x` 和 `y` 的 `Point` 结构体，我们可以通过 `let` 语句中的模式来分解这些字段。

<Listing number="19-12" file-name="src/main.rs" caption="Destructuring a struct’s fields into separate variables">

```rust
{{#rustdoc_include ../listings/ch19-patterns-and-matching/listing-19-12/src/main.rs}}
```

</Listing>

此代码创建了变量 `a` 和 `b`，它们分别对应于 `p` 结构体中 `x` 和 `y` 字段的值。这个示例表明，模式中的变量名称不必与结构体的字段名称相同。不过，通常将变量名称与字段名称保持一致，以便更容易记住哪些变量来自哪个字段。由于这种常见的使用方式，以及编写 `let Point { x: x, y: y } = p;` 会包含大量重复代码，Rust 提供了一种简写模式，用于匹配结构体字段：只需列出结构体字段的名称，由该模式生成的变量将具有相同的名称。清单 19-13 的行为与清单 19-12 中的代码相同，但在 `let` 模式中生成的变量是 `x` 和 `y`，而不是 `a` 和 `b`。

<Listing number="19-13" file-name="src/main.rs" caption="Destructuring struct fields using struct field shorthand">

```rust
{{#rustdoc_include ../listings/ch19-patterns-and-matching/listing-19-13/src/main.rs}}
```

</Listing>

此代码创建了变量 `x` 和 `y`，它们分别对应于 `p` 变量中的 `x` 和 `y` 字段。结果就是变量 `x` 和 `y` 包含来自 `p` 结构体的值。

我们还可以使用结构体的字面值作为模式的一部分进行解构，而无需为所有字段创建变量。这样可以在创建用于解构其他字段的变量时，同时测试某些字段的特定值。

在清单 19-14 中，我们有一个 `match` 表达式将 `Point` 值分为三种情况：位于 `x` 轴上的点（当 `y = 0` 时）、位于 `y` 轴上（`x = 0`）或既不在 `x` 轴也不在 `y` 轴上。

<Listing number="19-14" file-name="src/main.rs" caption="Destructuring and matching literal values in one pattern">

```rust
{{#rustdoc_include ../listings/ch19-patterns-and-matching/listing-19-14/src/main.rs:here}}
```

</Listing>

第一个分支可以匹配位于 `x` 轴上的任意点，只需指定当 `y` 字段的值与字面量 `0` 相同时即可。该模式还会创建一个 `x` 变量，我们可以在代码中使用这个变量。

同样，第二个分支可以匹配位于 `y` 轴上的任意点，只需指定当 `x` 字段的值为 `0` 时即可，并创建一个 `y` 变量来表示 `y` 字段的值。第三个分支不指定任何字面量，因此它可以匹配任何其他 `Point`，并分别创建 `x` 和 `y` 字段的变量。

在这个例子中，值 `p` 通过 `x` 包含 `0` 来匹配第二个分支，因此这段代码将输出 `On the y axis at 7`。

请记住，`match` 表达式一旦找到第一个匹配的模式就会停止检查其他分支，因此即使 `Point { x: 0, y: 0 }` 位于 `x` 轴和 `y` 轴上，这段代码也只会输出 `On the x axis at 0`。

<!-- Old headings. Do not remove or links may break. -->

<a id="destructuring-enums"></a>

#### 枚举

我们在本书中使用了枚举的解构（例如第6章中的列表6-5），但还没有明确讨论过解构枚举的模式与枚举中存储的数据定义方式之间的关系。以列表19-15为例，我们使用来自列表6-2的 `Message` 枚举，并编写了一个包含多个模式的 `match`，这些模式可以解构每个内部值。

<Listing number="19-15" file-name="src/main.rs" caption="Destructuring enum variants that hold different kinds of values">

```rust
{{#rustdoc_include ../listings/ch19-patterns-and-matching/listing-19-15/src/main.rs}}
```

</Listing>

这段代码将输出 `Change color to red 0, green 160, and blue 255`。尝试更改 `msg` 的值，以查看其他分支的代码是否运行。

对于没有数据的枚举变体，如 `Message::Quit`，我们无法进一步解构该值。我们只能匹配字面量 `Message::Quit`，并且该模式中没有变量。

对于类似结构体的枚举变体，如 `Message::Move`，我们可以使用与匹配结构体时相同的模式。在变体名称之后，我们放置花括号，然后列出带有变量的字段，这样就可以将各个部分分开，用于此分支的代码中。这里我们使用了简写形式，就像列表19-13中那样。

对于类似元组类型的枚举变体，例如包含一个元素的 `Message::Write` 和包含三个元素的 `Message::ChangeColor`，其模式与我们用于匹配元组的模式相似。模式中的变量数量必须与所匹配的变体的元素数量一致。

<!-- Old headings. Do not remove or links may break. -->

<a id="destructuring-nested-structs-and-enums"></a>

#### 嵌套结构体和枚举

到目前为止，我们的示例都是匹配一层深的结构体或枚举，但匹配也可以应用于嵌套项！例如，我们可以重构清单 19-15 中的代码，以支持在 `ChangeColor` 消息中处理 RGB 和 HSV 颜色，如清单 19-16 所示。

<Listing number="19-16" caption="Matching on nested enums">

```rust
{{#rustdoc_include ../listings/ch19-patterns-and-matching/listing-19-16/src/main.rs}}
```

</Listing>

`match` 表达式中第一个分支的模式与包含 `Color::Rgb` 变体的 `Message::ChangeColor` 枚举变体相匹配；然后，模式绑定到三个内部的 `i32` 值。第二个分支的模式也匹配 `Message::ChangeColor` 枚举变体，但内部枚举匹配的是 `Color::Hsv`。尽管涉及两个枚举，我们仍可以在一个 `match` 表达式中指定这些复杂条件。

<!-- Old headings. Do not remove or links may break. -->

<a id="destructuring-structs-and-tuples"></a>

#### 结构体和元组

我们可以以更复杂的方式混合、匹配和嵌套解构模式。以下示例展示了一个复杂的解构过程，其中我们在元组中嵌套结构体和元组，并解构所有基本值：

```rust
{{#rustdoc_include ../listings/ch19-patterns-and-matching/no-listing-05-destructuring-structs-and-tuples/src/main.rs:here}}
```

此代码允许我们将复杂类型拆分为其组成部分，从而可以分别使用我们感兴趣的值。

使用模式进行解构是一种方便的方式，用于分别使用结构体中每个字段的值。

### 忽略模式中的值

你已经看到，有时忽略模式中的值是有用的，例如在 `match` 的最后一个分支中，这样可以得到一个不会实际执行任何操作但能涵盖所有剩余可能值的通用处理。有几种方法可以忽略模式中的整个值或部分值：使用 `_` 模式（如你已见），在另一个模式中使用 `_` 模式，使用以下划线开头的名称，或使用 `..` 来忽略值的其余部分。让我们探讨如何以及为何使用这些模式。

<!-- Old headings. Do not remove or links may break. -->

<a id="ignoring-an-entire-value-with-_"></a>

#### 使用 `_` 忽略整个值

我们已将下划线用作通配符模式，它可以匹配任何值而不绑定到该值。这在 `match` 表达式的最后一个分支中特别有用，但也可以用于任何模式中，包括函数参数，如清单 19-17 所示。

<Listing number="19-17" file-name="src/main.rs" caption="Using `_` in a function signature">

```rust
{{#rustdoc_include ../listings/ch19-patterns-and-matching/listing-19-17/src/main.rs}}
```

</Listing>

此代码将完全忽略作为第一个参数的值 `3`，并会输出 `This code only uses the y parameter: 4`。

在大多数情况下，当不再需要某个函数参数时，你会修改签名以排除未使用的参数。在实现 trait 时，如果某种类型签名是必需的，但实现中的函数体不需要该参数，那么忽略函数参数特别有用。这样就可以避免编译器关于未使用函数参数的警告，就像使用名称那样。

<!-- Old headings. Do not remove or links may break. -->

<a id="ignoring-parts-of-a-value-with-a-nested-_"></a>

#### 使用嵌套 `_` 忽略值的部分内容

我们也可以在另一个模式中使用 `_` 来忽略值的一部分内容，例如，当只想测试值的一部分，而在要运行的相应代码中不需要其他部分时。清单 19-18 展示了负责管理设置值的代码。业务要求是用户不允许覆盖现有的设置自定义项，但可以取消设置并赋予新值（如果当前未设置）。

<Listing number="19-18" caption="Using an underscore within patterns that match `Some` variants when we don’t need to use the value inside the `Some`">

```rust
{{#rustdoc_include ../listings/ch19-patterns-and-matching/listing-19-18/src/main.rs:here}}
```

</Listing>

此代码将输出 `Can't overwrite an existing customized value`，随后输出 `setting is Some(5)`。在第一个匹配分支中，我们无需匹配或使用 `Some` 变体中的值，但我们需要检测当 `setting_value` 和 `new_setting_value` 都是 `Some` 变体时的情况。在这种情况下，我们将输出不更改 `setting_value` 的原因，因此该值不会被修改。

在其他所有情况下（即 `setting_value` 或 `new_setting_value` 为 `_` 模式），在第二个分支中，我们希望允许 `new_setting_value` 变为 `setting_value`。

我们也可以在同一个模式中多次使用下划线来忽略特定值。示例 19-19 展示了如何忽略五元素元组中的第二和第四个元素。

<Listing number="19-19" caption="Ignoring multiple parts of a tuple">

```rust
{{#rustdoc_include ../listings/ch19-patterns-and-matching/listing-19-19/src/main.rs:here}}
```

</Listing>

此代码将输出 `Some numbers: 2, 8, 32`，而值 `4` 和 `16` 将被忽略。

<!-- Old headings. Do not remove or links may break. -->

<a id="ignoring-an-unused-variable-by-starting-its-name-with-_"></a>

#### 通过以 `_` 开头来避免未使用的变量 如果您创建了一个变量但从未使用它，Rust 通常会发出警告，因为未使用的变量可能是一个错误。然而，有时能够创建尚未使用的变量是有用的，例如在原型设计或项目启动阶段。在这种情况下，您可以通过在变量名前加上下划线来告诉 Rust 不要对未使用的变量发出警告。在示例 19-20 中，我们创建了两个未使用的变量，但在编译代码时，只会对其中一个产生警告。

如果你创建了一个变量但从未使用它，Rust通常会发出警告，因为未使用的变量可能是一个错误。然而，在某些情况下，能够创建一个你暂时不会使用的变量是有用的，比如在原型设计或项目启动阶段。在这种情况下，可以通过在变量名称前加上下划线来告诉Rust不要对未使用的变量发出警告。在列表 19-20 中，我们创建了两个未使用的变量，但当我们编译这段代码时，应该只得到其中一个变量的警告。

<Listing number="19-20" file-name="src/main.rs" caption="Starting a variable name with an underscore to avoid getting unused variable warnings">

```rust
{{#rustdoc_include ../listings/ch19-patterns-and-matching/listing-19-20/src/main.rs}}
```

</Listing>

在这里，我们会收到关于未使用变量 `y` 的警告，但不会收到关于未使用 `_x` 的警告。

请注意，仅使用 `_` 与以下划线开头的名称之间存在细微差异。语法 `_x` 仍然会将值绑定到变量，而 `_` 则完全不绑定。为了展示这种区别的重要性，示例 19-21 将引发错误。

<Listing number="19-21" caption="An unused variable starting with an underscore still binds the value, which might take ownership of the value.">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch19-patterns-and-matching/listing-19-21/src/main.rs:here}}
```

</Listing>

我们将收到错误，因为 `s` 的值仍会被移动到 `_s`，从而无法再次使用 `s`。然而，单独使用下划线则永远不会绑定到值。示例 19-22 可以无错误编译，因为 `s` 不会被移动到 `_`。

<Listing number="19-22" caption="Using an underscore does not bind the value.">

```rust
{{#rustdoc_include ../listings/ch19-patterns-and-matching/listing-19-22/src/main.rs:here}}
```

</Listing>

这段代码运行得非常正常，因为我们从未将 `s` 绑定到任何东西；它没有被移动。

<a id="ignoring-remaining-parts-of-a-value-with-"></a>

#### 使用 `..` 处理值的剩余部分

对于具有多个部分的值，我们可以使用 `..` 语法来使用特定部分并忽略其余部分，从而无需为每个被忽略的值列出下划线。`..` 模式会忽略任何在模式其余部分中未明确匹配的部分。在清单 19-23 中，我们有一个包含三维空间坐标的 `Point` 结构体。在 `match` 表达式中，我们希望仅操作 `x` 坐标，并忽略 `y` 和 `z` 字段的值。

<Listing number="19-23" caption="Ignoring all fields of a `Point` except for `x` by using `..`">

```rust
{{#rustdoc_include ../listings/ch19-patterns-and-matching/listing-19-23/src/main.rs:here}}
```

</Listing>

我们列出 `x` 值，然后只包含 `..` 模式。这比需要列出 `y: _` 和 `z: _` 更快捷，特别是在处理具有许多字段的结构体时，当只有一两个字段相关的情况下尤其如此。

`..` 语法会展开为所需的任意多个值。清单 19-24 展示了如何将 `..` 与元组一起使用。

<Listing number="19-24" file-name="src/main.rs" caption="Matching only the first and last values in a tuple and ignoring all other values">

```rust
{{#rustdoc_include ../listings/ch19-patterns-and-matching/listing-19-24/src/main.rs}}
```

</Listing>

在这段代码中，第一个和最后一个值分别被匹配为 `first` 和 `last`。`..` 会匹配并忽略中间的所有内容。

然而，使用 `..` 必须明确无误。如果不清楚哪些值应该被匹配，哪些应该被忽略，Rust 会给出错误。清单 19-25 展示了使用 `..` 的模糊示例，因此代码无法编译。

<Listing number="19-25" file-name="src/main.rs" caption="An attempt to use `..` in an ambiguous way">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch19-patterns-and-matching/listing-19-25/src/main.rs}}
```

</Listing>

当我们编译这个示例时，会得到以下错误：

```console
{{#include ../listings/ch19-patterns-and-matching/listing-19-25/output.txt}}
```

Rust 无法确定在用 `second` 匹配一个值之前要忽略多少个元组中的值，以及之后还要忽略多少个值。这段代码可能意味着我们想忽略 `2`，将 `second` 绑定为 `4`，然后忽略 `8`、`16` 和 `32》；或者我们想忽略 `2` 和 `4`，将 `second` 绑定为 `8`，然后忽略 `16` 和 `32`；等等。变量名 `second` 对 Rust 没有特殊含义，因此我们会得到编译器错误，因为像这样在两个地方使用 `..` 是模糊的。

<!-- Old headings. Do not remove or links may break. -->

<a id="extra-conditionals-with-match-guards"></a>

### 添加带有 匹配 Guards 的条件判断

_匹配保护_是一种额外的 `if` 条件，在 `match` 分支中的模式之后指定，该条件也必须满足才能选择该分支。匹配保护有助于表达比单一模式所能表达的更复杂的逻辑。不过请注意，它们仅存在于 `match` 表达式中，而不存在于 `if let` 或 `while let` 表达式中。

该条件可以使用在模式中创建的变量。图19-26展示了一个 `match` 表达式，其中第一个分支的模式为 `Some(x)`，并且还有一个匹配保护条件 `if x % 2 == 0`（如果数字是偶数则此条件为真）。

<Listing number="19-26" caption="Adding a match guard to a pattern">

```rust
{{#rustdoc_include ../listings/ch19-patterns-and-matching/listing-19-26/src/main.rs:here}}
```

</Listing>

这个示例将输出 `The number 4 is even`。当 `num` 与第一个分支中的模式匹配时，因为 `Some(4)` 与 `Some(x)` 相匹配，所以选择第一个分支。然后，匹配保护检查 `x` 除以 2 的余数是否等于 0，由于结果为真，因此选择第一个分支。

如果 `num` 是 `Some(5)`，则第一个分支中的匹配保护将为 `false`，因为 5 除以 2 的余数为 1，不等于 0。此时 Rust 将进入第二个分支，因为第二个分支没有匹配保护，所以会匹配任何 `Some` 变体。

无法在模式中直接表达 `if x % 2 == 0` 的条件，因此使用匹配保护可以让我们表达这种逻辑。但这种额外表达能力的一个缺点是，当涉及匹配保护表达式时，编译器不会尝试检查条件的完备性。

在讨论图19-11时，我们提到可以使用匹配保护来解决模式遮蔽问题。回想一下，我们在 `match` 表达式中在模式中创建了新的变量，而不是在 `match` 外部使用该变量。由于这个新变量无法基于外部变量的值进行测试，图19-27展示了如何使用匹配保护来解决这个问题。

<Listing number="19-27" file-name="src/main.rs" caption="Using a match guard to test for equality with an outer variable">

```rust
{{#rustdoc_include ../listings/ch19-patterns-and-matching/listing-19-27/src/main.rs}}
```

</Listing>

此代码现在将输出 `Default case, x = Some(5)`。第二个匹配分支中的模式并未引入新的变量 `y` 来遮蔽外部 `y`，因此我们可以在匹配保护中使用外部 `y`。我们没有指定 `Some(y)` 作为模式，因为那样会遮蔽外部 `y`，而是指定了 `Some(n)`。这创建了一个新的变量 `n`，由于 `match` 块外没有 `n` 变量，所以不会遮蔽任何东西。

匹配保护 `if n == y` 不是一种模式，因此不会引入新变量。这里的 `y` 就是外部 `y`，而不是一个遮蔽它的新 `y`，我们可以通过将 `n` 与 `y` 进行比较来查找与外部 `y` 具有相同值的值。

您也可以在匹配保护中使用 `_or_` 运算符 `|` 来指定多个模式；匹配保护条件将适用于所有模式。图 19-28 展示了使用 `|` 的模式与匹配保护结合时的优先级。这个示例的关键点是，即使看起来 `if y` 仅适用于 `6`，`if y` 匹配保护也适用于 `4`、`5` 和 `6`。

<Listing number="19-28" caption="Combining multiple patterns with a match guard">

```rust
{{#rustdoc_include ../listings/ch19-patterns-and-matching/listing-19-28/src/main.rs:here}}
```

</Listing>

匹配条件规定，只有当 `x` 的值等于 `4`、`5` 或 `6`，并且 `y` 为 `true` 时，该分支才会匹配。当运行此代码时，第一个分支的模式匹配成功，因为 `x` 是 `4`，但匹配保护 `if y` 为 `false`，因此不选择第一个分支。代码随后进入第二个分支，该分支确实匹配，程序输出 `no`。原因是 `if` 条件适用于整个模式 `4 | 5 | 6`，而不仅仅是最后一个值 `6`。换句话说，匹配保护与模式之间的优先级行为如下：

```text
(4 | 5 | 6) if y => ...
```

而不是这样：

```text
4 | 5 | (6 if y) => ...
```

运行代码后，优先级行为变得明显：如果仅对使用 `|` 运算符指定的值列表中的最后一个值应用匹配保护，则该分支会匹配，程序将输出 `yes`。

<!-- Old headings. Do not remove or links may break. -->

<a id="-bindings"></a>

### 使用 `@` 绑定

`_at` 运算符 `@` 允许我们创建一个变量来保存值，同时对该值进行模式匹配测试。在清单 19-29 中，我们希望测试 `Message::Hello` 的 `id` 字段是否在 `3..=7` 范围内。我们还希望将该值绑定到变量 `id`，以便在其对应的代码中使用。

<Listing number="19-29" caption="Using `@` to bind to a value in a pattern while also testing it">

```rust
{{#rustdoc_include ../listings/ch19-patterns-and-matching/listing-19-29/src/main.rs:here}}
```

</Listing>

此示例将输出 `Found an id in range: 5`。通过在范围 `3..=7` 之前指定 `id @`，我们不仅在变量 `id` 中捕获了符合该范围的任何值，还同时验证了该值符合范围模式。

在第二个分支中，由于模式中仅指定了一个范围，与该分支相关的代码没有包含实际 `id` 字段值的变量。`id` 字段的值可能是 10、11 或 12，但与该模式相关的代码并不知道具体是哪一个。模式代码无法使用 `id` 字段中的值，因为尚未将 `id` 值保存为变量。

在最后一个分支中，我们指定了一个没有范围的变量，此时确实可以在该分支的代码中通过名为 `id` 的变量使用该值。原因是我们使用了结构体字段简写语法。但是，与前两个分支不同，在这个分支中没有对该 `id` 字段的值进行任何测试——任何值都符合此模式。

使用 `@` 允许我们在一次模式中同时测试一个值并将其保存为变量。

## 总结

Rust 的模式在区分不同类型的数据方面非常有用。当用于 `match` 表达式时，Rust 会确保你的模式覆盖所有可能的值，否则程序将无法编译。在 `let` 语句和函数参数中的模式使得这些构造更加实用，能够将值分解为更小的部分，并将这些部分分配给变量。我们可以创建简单或复杂的模式以满足需求。

接下来，在本书的倒数第二章中，我们将探讨 Rust 各种特性的一些高级方面。
