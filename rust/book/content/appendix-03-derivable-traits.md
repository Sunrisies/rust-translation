## 附录 C：可派生特质

在本书的多个地方，我们讨论了 `derive` 属性，您可以将该属性应用于结构体或枚举定义。`derive` 属性会生成代码，这些代码将在使用 `derive` 语法注释的类型上实现具有默认实现的特质。

在本附录中，我们提供了标准库中所有可以与 `derive` 一起使用的特质的参考信息。每个部分涵盖以下内容：

- 派生此特质的操作符和方法能启用什么功能 - `derive` 提供的特质实现具体做了什么 - 实现该特质对类型意味着什么 - 您可以在哪些条件下实现或不能实现该特质 - 需要该特质的操作示例

如果您希望获得与 `derive` 属性提供的不同行为，请查阅标准库文档](../std/index.html)<!-- ignore -->以了解如何手动实现每个特质的具体细节。

此处列出的特质是标准库中唯一可以通过 `derive` 在您的类型上实现的特质。标准库中定义的其他特质没有合理的默认行为，因此您需要根据实际需求选择合适的实现方式。

无法被派生的特质示例包括 `Display`，它负责最终用户的格式化显示。您始终应考虑向最终用户展示类型的合适方式。最终用户应该能够看到类型的哪些部分？他们认为哪些部分相关？数据的哪种格式对他们最有意义？Rust 编译器没有这种洞察力，因此无法为您提供合适的默认行为。

本附录中提供的可派生特质列表并不完整：库可以为其自身特质实现 `derive`，这使得可以使用 `derive` 的特质列表真正开放。实现 `derive` 涉及使用过程式宏，这将在第 20 章的[“自定义 `derive` 宏”][custom-derive-macros]<!-- ignore -->部分中介绍。

### 面向程序员的 `Debug`

`Debug` 特性使得在格式字符串中支持调试格式化，你只需在 `{}` 占位符中添加 `:?` 即可实现此功能。

`Debug` 特性允许你打印类型的实例以用于调试，这样你和使用该类型的其他程序员可以在程序执行过程中的特定点检查一个实例。

例如在使用 `assert_eq!` 宏时，需要启用 `Debug` 特性。如果相等性断言失败，此宏会打印作为参数给出的实例的值，从而使程序员能够了解为什么这两个实例不相等。

### 用于相等性比较的 `PartialEq` 和 `Eq`

`PartialEq` 特性允许你比较类型的实例以检查其是否相等，并启用使用 `==` 和 `!=` 运算符。

从 `PartialEq` 派生出 `eq` 方法。当在结构体上从 `PartialEq` 派生时，只有当所有字段都相等时，两个实例才相等；如果任意字段不相等，则这两个实例就不相等。当在枚举上从 `PartialEq` 派生时，每个变体等于自身，但不等于其他变体。

例如在使用 `assert_eq!` 宏时，需要启用 `Debug` 特性，因为该宏必须能够比较类型的两个实例是否相等。

`Eq` 特性没有方法。它的作用是指明被标注类型的每个值都等于自身。`Eq` 特性只能应用于也实现 `PartialEq` 的类型，尽管并非所有实现 `PartialEq` 的类型都能实现 `Eq`。一个例子是浮点数字类型：浮点数的实现规定，`NaN` 值的两个实例彼此不相等。

`Eq` 被需要的典型场景是在 `HashMap<K, V>` 中作为键，这样 `HashMap<K, V>` 就能判断两个键是否相同。

### 用于排序比较的 `PartialOrd` 和 `Ord`

`PartialOrd` 特性允许你出于排序目的比较类型的实例。实现 `PartialOrd` 的类型可以与 `<`、`>`, `<=` 和 `>=` 运算符一起使用。你只能将 `PartialOrd` 特性应用于也实现 `PartialEq` 的类型。

派生出 `PartialOrd` 实现了 `partial_cmp` 方法，该方法返回一个 `Option<Ordering>`，当给定的值无法产生排序关系时，该值为 `None`。一个无法产生排序关系的例子是 `NaN` 浮点值，尽管该类型的大多数值都可以进行比较。使用任何浮点数与 `NaN` 浮点值调用 `partial_cmp` 将返回 `None`。

在结构体上派生出 `PartialOrd` 时，会按结构体定义中字段出现的顺序比较每个字段的值来比较两个实例。在枚举上派生出 `PartialOrd` 时，枚举定义中早先声明的变体被认为小于后列出的变体。

例如，`rand` crate 中的 `gen_range` 方法需要 `PartialOrd` 特性，该方法用于生成由范围表达式指定的范围内的随机值。

`Ord` 特性允许你确定任意两个被标注类型的数值之间都存在有效的排序关系。`Ord` 特性实现了 `cmp` 方法，该方法返回的是 `Ordering` 而不是 `Option<Ordering>`，因为总是存在有效的排序关系。你只能将 `Ord` 特性应用于同时实现 `PartialOrd` 和 `Eq` 的类型（且 `Eq` 需要实现 `PartialEq`）。在结构体和枚举上派生出 `PartialOrd` 后，`cmp` 的行为与 `partial_cmp` 对 `PartialOrd` 的派生实现相同。

当在 `BTreeSet<T>` 中存储值时，就需要 `Ord` 特性，因为 `BTreeSet` 是一种基于数值排序顺序存储数据的数据结构。

### 用于复制值的 `Clone` 和 `Copy` 特性

`Clone` 特性允许你显式地创建值的深度副本，复制过程可能涉及运行任意代码以及复制堆数据。有关 `Clone` 的更多信息，请参阅第4章中的“与 `Clone` 交互的变量和数据”部分。

派生 `Clone` 实现了 `clone` 方法，当为整个类型实现该方法时，会针对类型的每个部分调用 `clone`。这意味着类型中的所有字段或值也必须实现 `Clone` 才能派生出 `Clone`。

需要 `Clone` 的一个例子是在对切片调用 `to_vec` 方法时。切片并不拥有其包含的类型实例，但从 `to_vec` 返回的向量则需要拥有这些实例，因此 `to_vec` 会针对每个元素调用 `clone`。因此，存储在切片中的类型必须实现 `Clone`。

`Copy` trait 允许你仅通过复制栈上存储的位来复制值，无需执行任意代码。有关 `Copy` 的更多信息，请参阅第4章中的“仅基于栈的数据：Copy”部分。

`Copy` trait 没有定义任何方法来防止程序员重载这些方法并违反“不会运行任意代码”的假设。这样，所有程序员都可以假设复制值会非常快速。

你可以对所有部分都实现 `Copy` 的类型派生出 `Copy`。一个实现 `Copy` 的类型也必须实现 `Clone`，因为实现 `Copy` 的类型有一个简单的 `Clone` 实现，其功能与 `Copy` 相同。

`Copy` trait 很少被需要；实现 `Copy` 的类型具有优化特性，这意味着你不必调用 `clone`，从而使代码更加简洁。

使用 `Copy` 可以完成的所有事情，也可以通过 `Clone` 完成，但代码可能会更慢，或者某些地方需要使用 `clone`。

### 用于将值映射到固定大小值的 `Hash`

`Hash` trait 允许你将一个任意大小的类型实例映射为固定大小的值，使用哈希函数进行映射。派生出 `Hash` 实现了 `hash` 方法。`hash` 方法的派生实现会将对类型每个部分的 `hash` 调用结果合并起来，这意味着所有字段或值也必须实现 `Hash` 才能派生出 `Hash`。

需要 `Hash` 的一个例子是在使用 `HashMap<K, V>` 存储键以高效存储数据时。

### `Default` 用于默认值

`Default` 特质允许你为某个类型创建默认值。派生出 `Default` 的实现会实现 `default` 函数。`default` 函数的派生实现会对类型的每个部分调用 `default` 函数，这意味着类型中的所有字段或值都必须实现 `Default` 才能派生出 `Default`。

`Default::default` 函数通常与第5章中讨论的[“使用结构更新语法从其他实例创建实例”](creating-instances-from-other-instances-with-结构体-update-syntax)部分中的结构体更新语法一起使用。你可以通过使用 `..Default::default()` 来定制结构体的几个字段，然后为其余字段设置并使用默认值。

当你在 `Option<T>` 实例上使用 `unwrap_or_default` 方法时，需要启用 `Default` 特质。如果 `Option<T>` 是 `None`，则 `unwrap_or_default` 方法将返回存储在 `Option<T>` 中的类型 `T` 的 `Default::default` 结果。

[creating-instances-from-other-instances-with-struct-update-syntax]: ch05-01-defining-structs.html#creating-instances-from-other-instances-with-struct-update-syntax
[stack-only-data-copy]: ch04-01-what-is-ownership.html#stack-only-data-copy
[variables-and-data-interacting-with-clone]: ch04-01-what-is-ownership.html#variables-and-data-interacting-with-clone
[custom-derive-macros]: ch20-05-macros.html#custom-derive-macros
