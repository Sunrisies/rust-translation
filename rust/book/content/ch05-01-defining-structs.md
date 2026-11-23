## 定义与实例化结构体

结构体类似于元组，如[“The Tuple Type”][tuples]<!-- ignore -->章节所述，两者都包含多个相关值。与元组一样，结构体的各个部分可以是不同类型。但与元组不同的是，在结构中你需要为每个数据项命名，以便明确其含义。通过添加这些名称，使得结构体比元组更灵活：你不必依赖数据的顺序来指定或访问实例的值。

要定义结构体，我们需要使用关键字`struct`并给整个结构体命名。结构体的名称应描述所组合的数据部分的重要性。然后，在花括号内，我们定义数据部分的名称和类型，这些被称为_字段_。例如，列表 5-1 展示了一个存储用户账户信息的结构体。

<Listing number="5-1" file-name="src/main.rs" caption="A `User` struct definition">

```rust
{{#rustdoc_include ../listings/ch05-using-structs-to-structure-related-data/listing-05-01/src/main.rs:here}}
```

</Listing>

要在定义后使用结构体，我们需要为每个字段指定具体值来创建该结构体的_实例_。我们通过说明结构体名称，然后添加包含`_``key: value_`对的花括号来创建实例，其中键是字段名，值是我们要存储在这些字段中的数据。我们不必按照在结构中声明的顺序来指定字段。换句话说，结构体定义就像类型的一般模板，而实例则通过填充特定数据来生成该类型的实际值。例如，我们可以像列表 5-2 中所示那样声明一个特定的用户。

<Listing number="5-2" file-name="src/main.rs" caption="Creating an instance of the `User` struct">

```rust
{{#rustdoc_include ../listings/ch05-using-structs-to-structure-related-data/listing-05-02/src/main.rs:here}}
```

</Listing>

要获取结构体的特定值，我们使用点符号。例如，要访问此用户的电子邮件地址，我们使用`user1.email`。如果实例是可变的，我们可以通过点符号将值赋给特定字段来更改它。列表 5-3 展示了如何修改可变`User`实例的`email`字段的值。

<Listing number="5-3" file-name="src/main.rs" caption="Changing the value in the `email` field of a `User` instance">

```rust
{{#rustdoc_include ../listings/ch05-using-structs-to-structure-related-data/listing-05-03/src/main.rs:here}}
```

</Listing>

请注意，整个实例必须是可变的；Rust不允许我们仅标记某些字段为可变。与任何表达式一样，我们可以在函数体的最后表达式中构造结构体的新实例，从而隐式返回该新实例。

列表 5-4 展示了一个 `build_user` 函数，该函数返回一个具有给定电子邮件和用户名的用户实例。`active` 字段的值为 `true`，而 `sign_in_count` 的值为 `1`。

<Listing number="5-4" file-name="src/main.rs" caption="A `build_user` function that takes an email and username and returns a `User` instance">

```rust
{{#rustdoc_include ../listings/ch05-using-structs-to-structure-related-data/listing-05-04/src/main.rs:here}}
```

</Listing>

将函数参数与结构体字段同名是合理的，但重复使用 `email` 和 `username` 字段名和变量会显得有些繁琐。如果结构体包含更多字段，重复每个名称会更加令人烦恼。幸运的是，有一个方便的简写方式！

<!-- Old headings. Do not remove or links may break. -->

<a id="using-the-field-init-shorthand-when-variables-and-fields-have-the-same-name"></a>

### 使用字段初始化简写

由于列表 5-4 中的参数名称和结构体字段名称完全相同，我们可以使用 _字段初始化简写_ 语法来重写 `build_user` 函数，使其行为完全一致，但不再重复 `username` 和 `email`，如列表 5-5 所示。

<Listing number="5-5" file-name="src/main.rs" caption="A `build_user` function that uses field init shorthand because the `username` and `email` parameters have the same name as struct fields">

```rust
{{#rustdoc_include ../listings/ch05-using-structs-to-structure-related-data/listing-05-05/src/main.rs:here}}
```

</Listing>

在这里，我们正在创建 `User` 结构体的新实例，该结构体有一个名为 `email` 的字段。我们希望将 `email` 字段的值设置为 `build_user` 函数的 `email` 参数中的值。由于 `email` 字段和 `email` 参数具有相同的名称，我们只需编写 `email` 而不是 `email: email`。

<!-- Old headings. Do not remove or links may break. -->

<a id="creating-instances-from-other-instances-with-struct-update-syntax"></a>

### 使用结构体更新语法创建实例

通常，创建一个包含同一类型另一个实例的大部分值但修改部分值的结构体新实例是非常有用的。可以使用结构体更新语法来实现这一点。

首先，在列表 5-6 中，我们展示了如何以常规方式在 `user2` 中创建新的 `User` 实例，而不使用更新语法。我们为 `email` 设置了一个新值，但在其他方面仍使用我们在列表 5-2 中创建的 `user1` 的相同值。

<Listing number="5-6" file-name="src/main.rs" caption="Creating a new `User` instance using all but one of the values from `user1`">

```rust
{{#rustdoc_include ../listings/ch05-using-structs-to-structure-related-data/listing-05-06/src/main.rs:here}}
```

</Listing>

使用结构体更新语法，我们可以用更少的代码实现相同的效果，如列表 5-7 所示。语法 `..` 指定了未明确设置的剩余字段应具有与给定实例中的字段相同的值。

<Listing number="5-7" file-name="src/main.rs" caption="Using struct update syntax to set a new `email` value for a `User` instance but to use the rest of the values from `user1`">

```rust
{{#rustdoc_include ../listings/ch05-using-structs-to-structure-related-data/listing-05-07/src/main.rs:here}}
```

</Listing>

清单 5-7 中的代码还在 `user2` 中创建了一个实例，该实例的 `email` 值不同，但 `username`、`active` 和 `sign_in_count` 字段的值与 `user1` 相同。必须将 `..user1` 放在最后，以指定剩余字段应从 `user1` 中的对应字段获取值，但我们可以选择按任意顺序为尽可能多的字段指定值，而无需考虑结构体定义中字段的顺序。

请注意，结构体的更新语法使用 `=` 作为赋值操作；这是因为它移动数据，正如我们在 [“变量与移动操作”][move]<!-- ignore --> 部分所看到的那样。在这个例子中，在创建 `user2` 后就无法再使用 `user1` 了，因为 `user1` 中 `username` 字段的 `String` 被移到了 `user2` 中。如果我们为 `user2` 同时指定了 `email` 和 `username` 的新 `String` 值，而只使用了 `user1` 中的 `active` 和 `sign_in_count` 值，那么即使创建 `user2` 后，`user1` 仍然有效。由于 `active` 和 `sign_in_count` 都是实现了 `Copy` trait 的类型，因此我们在 [“仅栈数据：Copy”][copy]<!-- ignore --> 部分讨论的行为依然适用。在这个例子中我们仍然可以使用 `user1.email`，因为其值并未被从 `user1` 中移出。

<!-- Old headings. Do not remove or links may break. -->

<a id="using-tuple-structs-without-named-fields-to-create-different-types"></a>

### 使用元组结构定义不同类型

Rust 还支持类似于元组的结构体，称为 _元组结构_。元组结构具有结构体名称所赋予的含义，但并没有与字段关联的名称；它们只是包含字段的类型。当你希望给整个元组起一个名字，并使该元组与其他元组区分开来时，以及当为每个字段命名像普通结构体那样会显得冗长或冗余时，使用元组结构非常有用。

要定义元组结构，首先使用 `struct` 关键字和结构体名称，然后列出元组中的类型。例如，在这里我们定义了两个名为 `Color` 和 `Point` 的元组结构并使用了它们：

<Listing file-name="src/main.rs">

```rust
{{#rustdoc_include ../listings/ch05-using-structs-to-structure-related-data/no-listing-01-tuple-structs/src/main.rs}}
```

</Listing>

请注意，`black` 和 `origin` 的值属于不同类型，因为它们是不同元组结构实例。您定义的每个结构体都是独立类型，即使结构内的字段可能具有相同的类型。例如，一个接受 `Color` 类型参数的函数不能将 `Point` 作为参数传递，尽管这两种类型都由三个 `i32` 值组成。否则，元组结构实例与元组类似，您可以将其解构为各个部分，并且可以使用 `.` 后跟索引来访问单个值。与元组不同，元组结构在解构时要求您指定结构的类型。例如，我们会编写 `let Point(x, y, z) = origin;` 以将 `origin` 点中的值解构为名为 `x`、`y` 和 `z` 的变量。

<!-- Old headings. Do not remove or links may break. -->

<a id="unit-like-structs-without-any-fields"></a>

### 定义类似单元的结构

您也可以定义没有任何字段的结构！这些被称为_类似单元的结构_，因为它们的行为类似于我们在 [“元组类型”][tuples]<!-- ignore --> 部分提到的单元类型 `()`。当您需要在某些类型上实现特征但该类型本身没有需要存储的数据时，类似单元的结构非常有用。我们将在第10章讨论特征。以下是声明和实例化名为 `AlwaysEqual` 的单元结构的示例：

<Listing file-name="src/main.rs">

```rust
{{#rustdoc_include ../listings/ch05-using-structs-to-structure-related-data/no-listing-04-unit-like-structs/src/main.rs}}
```

</Listing>

要定义 `AlwaysEqual`，我们使用 `struct` 关键字、想要的名称，然后加上分号。不需要花括号或圆括号！然后，我们可以以类似的方式在 `subject` 变量中获取 `AlwaysEqual` 的实例：使用我们定义的名称，无需任何花括号或圆括号。假设后来我们将为这种类型实现行为，使得每个 `AlwaysEqual` 实例始终等于任何其他类型的每个实例，也许是为了测试目的而获得已知结果。实现这种行为不需要任何数据！您将在第10章中看到如何定义特征并在任何类型上实现它们，包括类似单元的结构。

> ### 结构数据的所有权
>
> 在清单 5-1 中的 `User` 结构体定义中，我们使用了拥有权的 `String` 类型而非 `&str` 字符串切片类型。这是一个有意为之的选择，因为我们希望该结构体的每个实例都拥有其所有数据，并且这些数据在整个结构体有效期间都是有效的。
>
> 结构体也可以存储由其他对象拥有的数据的引用，但要做到这一点需要使用 _lifetimes_，这是 Rust 的一项特性，我们将在第 10 章中讨论。Lifetimes 确保结构体引用的数据在结构体有效期间都是有效的。假设你在 *src/main.rs* 中尝试在不指定生命周期的情况下在结构体中存储引用，这样是不行的：
>
> <Listing file-name="src/main.rs">
>
> <!-- CAN'T EXTRACT SEE https://github.com/rust-lang/mdBook/issues/1127 -->
>
> ```rust,ignore,does_not_compile
> struct User {
>     active: bool,
>     username: &str,
>     email: &str,
>     sign_in_count: u64,
> }
>
> fn main() {
>     let user1 = User {
>         active: true,
>         username: "someusername123",
>         email: "someone@example.com",
>         sign_in_count: 1,
>     };
> }
> ```
>
> </Listing>
>
> 编译器会报错指出需要生命周期说明符：
>
> ```console
> $ cargo run
>    Compiling structs v0.1.0 (file:///projects/structs)
> error[E0106]: missing lifetime specifier
>  --> src/main.rs:3:15
>   |
> 3 |     username: &str,
>   |               ^ expected named lifetime parameter
>   |
> help: consider introducing a named lifetime parameter
>   |
> 1 ~ struct User<'a> {
> 2 |     active: bool,
> 3 ~     username: &'a str,
>   |
>
> error[E0106]: missing lifetime specifier
>  --> src/main.rs:4:12
>   |
> 4 |     email: &str,
>   |            ^ expected named lifetime parameter
>   |
> help: consider introducing a named lifetime parameter
>   |
> 1 ~ struct User<'a> {
> 2 |     active: bool,
> 3 |     username: &str,
> 4 ~     email: &'a str,
>   |
>
> For more information about this error, try `rustc --explain E0106`.
> error: could not compile `structs` (bin "structs") due to 2 previous errors
> ```
>
> 在第 10 章中，我们将讨论如何修复这些错误，以便你可以在结构体中存储引用，但目前，我们会使用 `String` 这样的拥有型类型来修复这类错误，而不是使用 `&str` 这样的引用。

<!-- manual-regeneration
对于运行 update-rustc.sh 后上述错误的情况：pbcopy < listings/ch05-using-structs-to-structure-related-data/no-listing-02-reference-in-结构体/output.txt 然后在上文每行前添加 `> `

[tuples]: ch03-02-data-types.html#the-tuple-type
[move]: ch04-01-what-is-ownership.html#variables-and-data-interacting-with-move
[copy]: ch04-01-what-is-ownership.html#stack-only-data-copy
