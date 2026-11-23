## 使用 `if let` 和 `let...else` 实现简洁的控制流

`if let` 语法允许将 `if` 和 `let` 结合使用，以一种更简洁的方式处理符合某种模式的值，同时忽略其他值。请参考清单 6-6 中的程序，该程序在 `config_max` 变量中匹配 `Option<u8>` 值，但仅当值为 `Some` 时执行代码。

<Listing number="6-6" caption="A `match` that only cares about executing code when the value is `Some`">

```rust
{{#rustdoc_include ../listings/ch06-enums-and-pattern-matching/listing-06-06/src/main.rs:here}}
```

</Listing>

如果值为 `Some`，我们通过将值绑定到变量 `max` 来打印 `Some` 变体的值。我们不想对 `None` 值做任何操作。为了满足 `match` 表达式的要求，必须在处理完一个变体后添加 `_ => ()` 代码，这属于繁琐的样板代码。

相反，我们可以使用 `if let` 以更简洁的方式实现这一功能。以下代码与清单 6-6 中的 `match` 行为相同：

```rust
{{#rustdoc_include ../listings/ch06-enums-and-pattern-matching/no-listing-12-if-let/src/main.rs:here}}
```

`if let` 语法包含一个模式和一个由等号分隔的表达式。其工作原理与 `match` 类似，其中表达式被传递给 `match`，而模式是第一个分支。在这种情况下，模式为 `Some(max)`，且 `max` 绑定到 `Some` 内部的值。然后我们可以像在对应的 `match` 分支中使用 `max` 一样在 `if let` 块的主体中使用 `max`。只有当值符合模式时，`if let` 块中的代码才会执行。

使用 `if let` 意味着更少的输入、更少的缩进和更少的样板代码。然而，你失去了 `match` 所实现的全面检查能力，因为 `match` 会确保不会遗漏任何情况的处理。在 `match` 和 `if let` 之间选择取决于你的具体需求以及简洁性是否值得放弃全面检查。

换句话说，`if let` 可以视为一种语法糖，它让 `match` 在值符合某种模式时执行代码，然后忽略所有其他值。

我们可以在 `if let` 中加入 `else`。与 `else` 对应的代码块与 `match` 表达式中 `_` 情况下的代码块相同，相当于 `if let` 和 `else` 的组合。请回忆一下清单 6-4 中的 `Coin` 枚举定义，其中 `Quarter` 变体也包含 `UsState` 值。如果我们想要统计所有非四分之一硬币的数量，同时告知这些硬币的状态，可以使用 `match` 表达式来实现，如下所示：

```rust
{{#rustdoc_include ../listings/ch06-enums-and-pattern-matching/no-listing-13-count-and-announce-match/src/main.rs:here}}
```

或者我们可以使用 `if let` 和 `else` 表达式，如下所示：

```rust
{{#rustdoc_include ../listings/ch06-enums-and-pattern-matching/no-listing-14-count-and-announce-if-let-else/src/main.rs:here}}
```

## 使用 `let...else` 保持“正常路径”

常见的模式是在值存在时执行某些计算，而在其他情况下返回默认值。继续以带有 `UsState` 值的硬币为例，如果我们想根据硬币状态的年龄说一些有趣的话，可以在 `UsState` 上引入一个方法来检查状态的年龄，如下所示：

```rust
{{#rustdoc_include ../listings/ch06-enums-and-pattern-matching/listing-06-07/src/main.rs:state}}
```

然后，我们可以使用 `if let` 来匹配硬币的类型，在条件体内引入一个 `state` 变量，如清单 6-7 所示。

<Listing number="6-7" caption="Checking whether a state existed in 1900 by using conditionals nested inside an `if let`">

```rust
{{#rustdoc_include ../listings/ch06-enums-and-pattern-matching/listing-06-07/src/main.rs:describe}}
```

</Listing>

这样就能完成任务，但把工作推到了 `if let` 语句的主体中，如果需要执行的工作更复杂的话，就难以准确理解顶层分支之间的关系了。我们还可以利用表达式产生值的事实，要么从 `if let` 中获取 `state`，要么提前返回，如清单 6-8 所示。（你也可以用 `match` 实现类似的功能。）

<Listing number="6-8" caption="Using `if let` to produce a value or return early">

```rust
{{#rustdoc_include ../listings/ch06-enums-and-pattern-matching/listing-06-08/src/main.rs:describe}}
```

</Listing>

不过，这种写法本身有点令人困惑！`if let` 的一个分支产生一个值，另一个分支则完全从函数中返回。

为了使这种常见模式更易于表达，Rust 提供了 `let...else` 语法。`let...else` 语法在左侧有一个模式，右侧有一个表达式，与 `if let` 非常相似，但它没有 `if` 分支，只有 `else` 分支。如果模式匹配成功，它会在外部作用域中绑定模式的值。如果模式不匹配，程序将进入 `else` 分支，该分支必须从函数中返回。

在清单 6-9 中，你可以看到当使用 `let...else` 替代 `if let` 时，清单 6-8 的效果如何。

<Listing number="6-9" caption="Using `let...else` to clarify the flow through the function">

```rust
{{#rustdoc_include ../listings/ch06-enums-and-pattern-matching/listing-06-09/src/main.rs:describe}}
```

</Listing>

请注意，以这种方式在函数的主体部分保持“正常路径”，两个分支的控制流并没有像 `if let` 那样有显著的不同。

如果你遇到程序逻辑过于复杂而无法用 `match` 表达的情况，请记住 `if let` 和 `let...else` 也是你的 Rust 工具箱中的选项。

## 总结

我们现在已经介绍了如何使用枚举来创建可以从一组枚举值中选择的一种自定义类型。我们还展示了标准库中的 `Option<T>` 类型如何帮助你利用类型系统来避免错误。当枚举值包含数据时，你可以根据需要处理的案例数量使用 `match` 或 `if let` 来提取并使用这些数据。

现在，你的 Rust 程序可以使用结构体和枚举来表达你领域中的概念。在 API 中创建自定义类型可以确保类型安全：编译器会确保你的函数只接收每个函数所期望的类型的值。

为了向用户提供结构清晰、易于使用的 API，并且仅暴露用户真正需要的功能，让我们现在来了解一下 Rust 的模块机制。
