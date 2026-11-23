<!-- Old headings. Do not remove or links may break. -->

<a id="the-match-control-flow-operator"></a>

## `match` 控制流构造器

Rust 拥有一种非常强大的控制流构造器 `match`，它允许你将一个值与一系列模式进行比较，然后根据匹配到的模式执行相应的代码。模式可以由字面值、变量名、通配符等多种元素组成；[第19章][ch19-00-patterns]<!-- ignore -->介绍了各种模式及其作用。`match` 的强大之处在于模式的表达性以及编译器会确保处理所有可能的情况。

可以将 `match` 表达式想象成一种硬币分类机：硬币沿着带有不同尺寸孔洞的轨道下滑，每枚硬币都会掉入第一个符合其形状的孔洞中。同样，`value_in_cents` 函数中的值也会经过每个模式，当遇到匹配的模式时，该值会落入对应的代码块并在执行过程中被使用。

说到硬币，让我们用 `match` 来举一个例子！我们可以编写一个函数，该函数接受一个未知的美国硬币，就像计数机一样确定硬币的类型，并返回其价值以美分为单位，如清单6-3所示。

<Listing number="6-3" caption="An enum and a `match` expression that has the variants of the enum as its patterns">

```rust
{{#rustdoc_include ../listings/ch06-enums-and-pattern-matching/listing-06-03/src/main.rs:here}}
```

</Listing>

我们来解析 `value_in_cents` 函数中的 `match` 语句。首先列出 `match` 关键字和表达式，这里就是值 `coin`。这看起来与 `if` 中的条件表达式非常相似，但有一个重要区别：在 `if` 中，条件必须评估为布尔值，而在这里可以是任何类型。本例中的 `coin` 类型是我们在第一行定义的 `Coin` 枚举。

接下来是 `match` 的分支。一个分支包含两部分：一个模式和一些代码。这里的第一个分支有一个模式为 `Coin::Penny`，然后是一个 `=>` 运算符，用于分隔模式和要执行的代码。此情况下的代码就是值 `1`。每个分支之间用逗号隔开。

当 `match` 表达式执行时，它会按顺序将结果值与每个分支的模式进行比较。如果某个模式与值匹配，则执行与该模式相关的代码。如果不匹配，则继续执行下一个分支，就像硬币分类机一样。我们可以根据需要设置任意多的分支：在列表 6-3 中，我们的 `match` 有四个分支。

每个分支对应的代码都是一个表达式，而在匹配的分支中该表达式的结果值就是整个 `match` 表达式返回的值。

如果 `match` 分支中的代码较短，通常不需要使用花括号，如列表 6-3 所示，每个分支仅返回一个值。如果您想在 `match` 分支中执行多行代码，则必须使用花括号，且分支后的逗号为可选。例如，以下代码在每次调用带有 `Coin::Penny` 的方法时都会打印“Lucky penny!”，但仍然返回该块的最后一个值 `1`。

```rust
{{#rustdoc_include ../listings/ch06-enums-and-pattern-matching/no-listing-08-match-arm-multiple-lines/src/main.rs:here}}
```

### 与值绑定的模式

`match` 分支的另一个有用特性是它们可以绑定到与模式匹配的值部分。这就是我们如何从枚举变体中提取值的方式。

例如，让我们更改其中一个枚举变体以在其中存储数据。从 1999 年到 2008 年，美国为50个州各铸造了具有不同设计的二十五分硬币。其他硬币没有州设计，因此只有二十五分硬币具有这种额外价值。我们可以通过将 `Quarter` 变体改为包含存储在其中的 `UsState` 值来向我们的 `enum` 添加此信息，正如列表 6-4 中所做的那样。

<Listing number="6-4" caption="A `Coin` enum in which the `Quarter` variant also holds a `UsState` value">

```rust
{{#rustdoc_include ../listings/ch06-enums-and-pattern-matching/listing-06-04/src/main.rs:here}}
```

</Listing>

假设一个朋友试图收集所有50个州二十五分硬币。当我们根据硬币类型整理零钱时，我们还会说出每个硬币所代表的州名，这样如果朋友没有某种硬币，他们就可以将其加入收藏。

在这段代码的匹配表达式中，我们在匹配 `Coin::Quarter` 值的模式中添加了一个名为 `state` 的变量。当匹配到 `Coin::Quarter` 时，`state` 变量将绑定为该季度的状态值。然后，我们可以在对应分支的代码中使用 `state`，如下所示：

```rust
{{#rustdoc_include ../listings/ch06-enums-and-pattern-matching/no-listing-09-variable-in-pattern/src/main.rs:here}}
```

如果我们调用 `value_in_cents(Coin::Quarter(UsState::Alaska))`，则 `coin` 将为 `Coin::Quarter(UsState::Alaska)`。当我们将该值与各个匹配分支进行比较时，直到到达 `Coin::Quarter(state)` 之前都不匹配。此时，`state` 的绑定值将为 `UsState::Alaska`。然后我们可以在该 `println!` 表达式中使用这个绑定值，从而从 `Coin` 枚举的 `Quarter` 变体中获取内部状态值。

<!-- Old headings. Do not remove or links may break. -->

<a id="matching-with-optiont"></a>

### `Option<T>` 的 `match` 模式


在前一节中，我们想通过 `Option<T>` 从 `Some` 情况中获取内部的 `T` 值；我们也可以像处理 `Coin` 枚举那样使用 `match` 来处理 `Option<T>`！虽然我们比较的是硬币而不是货币，但 `match` 表达式的工作方式保持不变。

假设我们想要编写一个函数，该函数接受一个 `Option<i32>`，如果内部有值，则将该值加1；如果没有值，则函数应返回 `None` 值，并且不尝试执行任何操作。

由于使用了 `match`，这个函数的编写非常简单，其代码类似于清单 6-5。

<Listing number="6-5" caption="A function that uses a `match` expression on an `Option<i32>`">

```rust
{{#rustdoc_include ../listings/ch06-enums-and-pattern-matching/listing-06-05/src/main.rs:here}}
```

</Listing>

让我们更详细地看看 `plus_one` 的第一次执行过程。当调用 `plus_one(five)` 时，`plus_one` 主体中的变量 `x` 将具有值 `Some(5)`。然后我们将其与每个匹配分支进行比较：

```rust,ignore
{{#rustdoc_include ../listings/ch06-enums-and-pattern-matching/listing-06-05/src/main.rs:first_arm}}
```

`Some(5)` 的值不匹配模式 `None`，因此我们继续到下一个分支：

```rust,ignore
{{#rustdoc_include ../listings/ch06-enums-and-pattern-matching/listing-06-05/src/main.rs:second_arm}}
```

`Some(5)` 是否匹配 `Some(i)`？是的！我们有相同的变体。`i` 绑定到 `Some` 中包含的值，所以 `i` 取值为 `5`。然后执行匹配分支中的代码，我们将 `i` 的值加1，并创建一个包含总和 `6` 的新 `Some` 值。

现在让我们考虑清单 6-5 中 `plus_one` 的第二次调用，此时 `x` 为 `None`。我们进入 `match` 并比较第一个分支：

```rust,ignore
{{#rustdoc_include ../listings/ch06-enums-and-pattern-matching/listing-06-05/src/main.rs:first_arm}}
```

匹配成功！没有值需要添加，因此程序停止，并在 `=>` 右侧返回 `None` 值。由于第一个分支匹配了，因此不会比较其他分支。

在许多情况下，结合 `match` 和枚举非常有用。你在 Rust 代码中会经常看到这种模式：对枚举进行 `match`，将变量绑定到内部数据，然后根据该数据执行代码。一开始可能会有些棘手，但一旦习惯后，你会希望所有语言都具备这种特性。它始终是用户最喜爱的特性之一。

### 匹配必须是穷尽的

还有关于 `match` 的一个方面需要讨论：各个分支的模式必须覆盖所有可能性。考虑一下我们 `plus_one` 函数的这个版本，其中存在错误且无法编译：

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch06-enums-and-pattern-matching/no-listing-10-non-exhaustive-match/src/main.rs:here}}
```

我们没有处理 `None` 情况，因此这段代码会导致错误。幸运的是，Rust 能够捕捉到这种错误。如果我们尝试编译这段代码，将会得到以下错误：

```console
{{#include ../listings/ch06-enums-and-pattern-matching/no-listing-10-non-exhaustive-match/output.txt}}
```

Rust 知道我们没有覆盖所有可能的情况，甚至知道我们遗漏了哪种模式！在 Rust 中，匹配必须是 _穷尽的_：我们必须覆盖每一个可能性，才能使代码有效。特别是在 `Option<T>` 的情况下，Rust 阻止我们忘记显式处理 `None` 情况，从而保护我们不会假设存在值而实际上可能是 null，使得之前讨论的百万美元错误变得不可能。

### 万能模式与 `_` 占位符

使用枚举，我们还可以对某些特定值执行特殊操作，但对于其他所有值则执行一个默认操作。假设我们正在实现一个游戏，如果掷骰子得到3点，玩家不会移动，而是获得一顶新帽子；如果掷出7点，玩家就会失去一顶新帽子。对于其他所有值，玩家会在游戏棋盘上移动相应数量的格数。以下是一个实现该逻辑的 `match` 语句，骰子结果被硬编码为固定值，而非随机值，而所有其他逻辑则由无体部的函数表示，因为在此示例中实际实现这些函数超出了范围。

```rust
{{#rustdoc_include ../listings/ch06-enums-and-pattern-matching/no-listing-15-binding-catchall/src/main.rs:here}}
```

前两个分支的模式分别是字面值 `3` 和 `7`。对于最后一个覆盖所有其他可能值的分支，模式是一个我们选择的变量 `other`。用于 `other` 分支的代码通过将其传递给 `move_player` 函数来使用该变量。

即使我们没有列出 `u8` 的所有可能值，这段代码也能编译，因为最后一个模式会匹配所有未特别列出的值。这个通用模式满足 `match` 必须穷尽的要求。请注意，我们必须将通用分支放在最后，因为模式按顺序评估。如果我们将通用分支放早一些，其他分支将永远不会运行，因此如果在通用分支之后添加分支，Rust 会发出警告！

Rust 还提供了一种模式，当我们需要一个通用分支但不想使用该值时可以使用这种模式：`_` 是一种特殊模式，可以匹配任何值而不绑定到该值。这告诉 Rust 我们不会使用该值，因此 Rust 不会因未使用的变量而发出警告。

让我们改变游戏规则：现在，如果掷出的点数不是3或7，就必须重新掷一次。由于不再需要使用通用值，我们可以修改代码使用 `_` 代替名为 `other` 的变量：

```rust
{{#rustdoc_include ../listings/ch06-enums-and-pattern-matching/no-listing-16-underscore-catchall/src/main.rs:here}}
```

这个示例也满足穷尽性要求，因为我们明确忽略了最后一个分支中的所有其他值；我们没有遗漏任何内容。

最后，我们将再次修改游戏规则，使得在您掷出3或7以外的数字时，您的回合不会发生任何其他操作。我们可以通过使用单位值（我们在“元组类型”部分提到的空元组类型）作为与`_`分支对应的代码来实现这一点：

```rust
{{#rustdoc_include ../listings/ch06-enums-and-pattern-matching/no-listing-17-underscore-unit/src/main.rs:here}}
```

在这里，我们明确告诉Rust：我们不会使用与之前分支中的模式不匹配的任何其他值，并且在这种情况下我们不希望执行任何代码。

关于模式和匹配的更多内容我们将在[第19章][ch19-00-patterns]<!-- ignore -->中讨论。目前，我们将继续介绍`if let`语法，当`match`表达式有些冗长时，这种语法会非常有用。

[tuples]: ch03-02-data-types.html#the-tuple-type
[ch19-00-patterns]: ch19-00-patterns.html
