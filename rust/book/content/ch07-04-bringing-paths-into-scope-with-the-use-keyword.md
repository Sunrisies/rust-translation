## 使用 `use` 关键字将路径引入作用域

需要手动编写调用函数的路径可能会显得不便且重复。在列表 7-7中，无论我们选择的是 `add_to_waitlist` 函数的绝对路径还是相对路径，每次调用 `add_to_waitlist` 时都必须同时指定 `front_of_house` 和 `hosting`。幸运的是，有一种方法可以简化这一过程：只需一次使用 `use` 关键字创建路径的快捷方式，然后在作用域的其他地方使用这个较短的名称即可。

在列表 7-11中，我们将 `crate::front_of_house::hosting` 模块引入 `eat_at_restaurant` 函数的作用域，这样在 `eat_at_restaurant` 中调用 `add_to_waitlist` 函数时，只需指定 `hosting::add_to_waitlist` 即可。

<Listing number="7-11" file-name="src/lib.rs" caption="Bringing a module into scope with `use`">

```rust,noplayground,test_harness
{{#rustdoc_include ../listings/ch07-managing-growing-projects/listing-07-11/src/lib.rs}}
```

</Listing>

在作用域中添加 `use` 和路径类似于在文件系统中创建符号链接。通过在 crate 根目录添加 `use crate::front_of_house::hosting`，`hosting` 现在成为该作用域中的有效名称，就像 `hosting` 模块在 crate 根目录中定义一样。通过 `use` 引入作用域的路径也遵循与其他路径相同的隐私规则。

请注意，`use` 仅为发生 `use` 的特定作用域创建快捷方式。列表 7-12中将 `eat_at_restaurant` 函数移入名为 `customer` 的新子模块，该模块与 `use` 语句属于不同的作用域，因此函数体无法编译。

<Listing number="7-12" file-name="src/lib.rs" caption="A `use` statement only applies in the scope it’s in.">

```rust,noplayground,test_harness,does_not_compile,ignore
{{#rustdoc_include ../listings/ch07-managing-growing-projects/listing-07-12/src/lib.rs}}
```

</Listing>

编译器错误表明在 `customer` 模块中不再适用该快捷方式：

```console
{{#include ../listings/ch07-managing-growing-projects/listing-07-12/output.txt}}
```

请注意还有一条警告，说明 `use` 在其作用域中不再被使用！要解决此问题，需将 `use` 也移入 `customer` 模块，或在子 `customer` 模块中使用 `super::hosting` 来引用父模块中的快捷方式。

### 创建符合惯用风格的 `use` 路径

在列表 7-11中，你可能会疑惑为什么我们指定了 `use crate::front_of_house::hosting`，然后在 `eat_at_restaurant` 中调用 `hosting::add_to_waitlist`，而不是像列表 7-13那样直接指定到 `add_to_waitlist` 函数的 `use` 路径以获得相同结果。

<Listing number="7-13" file-name="src/lib.rs" caption="Bringing the `add_to_waitlist` function into scope with `use`, which is unidiomatic">

```rust,noplayground,test_harness
{{#rustdoc_include ../listings/ch07-managing-growing-projects/listing-07-13/src/lib.rs}}
```

</Listing>

尽管清单 7-11 和清单 7-13 都实现了相同的任务，但使用 `use` 将函数引入作用域是更符合惯用的方式。使用 `use` 将函数的父模块引入作用域意味着在调用函数时必须指定该父模块。在调用函数时指定父模块可以明确表明该函数并非局部定义，同时又能减少完整路径的重复。清单 7-13 中的代码不清楚 `add_to_waitlist` 是在哪里定义的。

另一方面，当使用 `use` 引入结构体、枚举和其他项目时，指定完整路径是更符合惯用的做法。清单 7-14 展示了将标准库 `HashMap` 结构体引入二进制 crate 作用域的符合惯例的方式。

<Listing number="7-14" file-name="src/main.rs" caption="Bringing `HashMap` into scope in an idiomatic way">

```rust
{{#rustdoc_include ../listings/ch07-managing-growing-projects/listing-07-14/src/main.rs}}
```

</Listing>

这种惯用法没有充分的理由：这只是逐渐形成的惯例，人们已经习惯以这种方式阅读和编写 Rust 代码。

这种惯用的例外情况是我们使用 `use` 语句引入两个同名项目进入作用域，因为 Rust 不允许这种情况发生。清单 7-15 展示了如何引入两个具有相同名称但父模块不同的 `Result` 类型，以及如何引用它们。

<Listing number="7-15" file-name="src/lib.rs" caption="Bringing two types with the same name into the same scope requires using their parent modules.">

```rust,noplayground
{{#rustdoc_include ../listings/ch07-managing-growing-projects/listing-07-15/src/lib.rs:here}}
```

</Listing>

如您所见，使用父模块可以区分这两个 `Result` 类型。如果相反地指定 `use std::fmt::Result` 和 `use std::io::Result`，则会在同一作用域中有两个 `Result` 类型，而 Rust 在使用 `Result` 时不会知道我们指的是哪一个。

### 使用 `as` 关键字为新名称命名

解决使用 `use` 将两种同名类型引入同一作用域问题的另一种方法是：在路径后指定 `as` 和一个新的本地名称或_别名_。清单 7-16 展示了通过使用 `as` 重命名其中一个 `Result` 类型来编写清单 7-15 中代码的另一种方式。

<Listing number="7-16" file-name="src/lib.rs" caption="Renaming a type when it’s brought into scope with the `as` keyword">

```rust,noplayground
{{#rustdoc_include ../listings/ch07-managing-growing-projects/listing-07-16/src/lib.rs:here}}
```

</Listing>

在第二个 `use` 语句中，我们为 `std::io::Result` 类型选择了新名称 `IoResult`，这不会与我们也引入作用域中的 `std::fmt::Result` 冲突。清单 7-15 和清单 7-16 都被认为是符合惯用的做法，因此选择权在于您！

### 使用 `pub use` 重新导出名称

当我们使用 `use` 关键字将某个名称引入作用域时，该名称对导入它的作用域是私有的。为了让外部代码能够像在作用域内定义一样引用该名称，我们可以结合使用 `pub` 和 `use`。这种技术被称为 _重新导出_，因为我们不仅将某项内容引入作用域，还使其可供其他代码也引入到自己的作用域中。

列表 7-17 展示了列表 7-11 中的代码，其中根模块中的 `use` 被更改为 `pub use`。

<Listing number="7-17" file-name="src/lib.rs" caption="Making a name available for any code to use from a new scope with `pub use`">

```rust,noplayground,test_harness
{{#rustdoc_include ../listings/ch07-managing-growing-projects/listing-07-17/src/lib.rs}}
```

</Listing>

在进行此更改之前，外部代码必须使用路径 `restaurant::front_of_house::hosting::add_to_waitlist()` 来调用 `add_to_waitlist` 函数，同时还需要将 `front_of_house` 模块标记为 `pub`。现在，由于 `pub use` 从根模块重新导出了 `hosting` 模块，外部代码可以使用路径 `restaurant::hosting::add_to_waitlist()` 了。

当代码的内部结构与调用者对领域的理解不同时，重新导出非常有用。例如，在餐厅的比喻中，经营餐厅的人会考虑“前台”和“后台”这两个概念。但访问餐厅的顾客可能不会用这些术语来思考餐厅的各个部分。通过 `pub use`，我们可以以一种结构编写代码，同时暴露另一种结构。这样就能使库对于处理该库的程序员以及调用该库的程序员来说都更加有序。我们将在第 14 章的“导出便捷的公共 API”[ch14-pub-use]<!-- ignore -->中看到另一个 `pub use` 示例及其对你的 crate 文档的影响。

### 使用外部包

在第 2 章中，我们开发了一个猜谜游戏项目，该项目使用了名为 `rand` 的外部包来获取随机数。为了在项目中使用 `rand`，我们在 _Cargo.toml_ 中添加了以下行：

<!-- When updating the version of `rand` used, also update the version of
这些文件中都使用了 `rand`，因此它们是一致的：

* ch01-01-installation.md * ch02-00-guessing-game-tutorial.md * ch14-03-cargo-workspaces.md -->

<Listing file-name="Cargo.toml">

```toml
{{#include ../listings/ch02-guessing-game-tutorial/listing-02-02/Cargo.toml:9:}}
```

</Listing>

在 _Cargo.toml_ 中将 `rand` 添加为依赖项，告诉 Cargo 下载 `rand` 包以及来自 [crates.io](https://crates.io/) 的所有依赖项，从而使 `rand` 可用于我们的项目。

然后，为了将 `rand` 的定义纳入我们包的 Scope 中，我们在以 `rand` 为名的 crate 名称前添加 `use` 行，并列出我们希望纳入 Scope 中的项目。回想一下在第二章的 [“生成随机数”][rand]<!-- ignore --> 部分，我们将 `rand::prelude` 模块中的项目纳入 Scope，并调用了 `rand::rng` 函数。

```rust,ignore
{{#rustdoc_include ../listings/ch02-guessing-game-tutorial/listing-02-03/src/main.rs:ch07-04}}
```

Rust 社区成员已在 [crates.io](https://crates.io/) 上发布了许多包，将其中任何一个包引入到你的包中都涉及相同的步骤：在包的 _Cargo.toml_ 文件中列出这些包，并使用 `use` 将它们的项目中的项纳入 Scope。

请注意，标准 `std` 库也是一个外部 crate。由于标准库随 Rust 语言一起提供，我们无需修改 _Cargo.toml_ 来包含 `std`。但我们需要使用 `use` 将其项引入到我们包的 Scope 中。例如，对于 `HashMap`，我们会使用如下行：

```rust
use std::collections::HashMap;
```

这是一个以 `std` 为开头的绝对路径，即标准库 crate 的名称。

<!-- Old headings. Do not remove or links may break. -->

<a id="using-nested-paths-to-clean-up-large-use-lists"></a>

### 使用嵌套路径清理 `use` 列表

如果我们使用了同一 crate 或同一模块中定义的多个项目，在文件中单独列出每个项目会占用大量垂直空间。例如，在清单 2-4 中的猜谜游戏中，我们有这两个 `use` 语句，它们将 `std` 中的项目纳入 Scope：

<Listing file-name="src/main.rs">

```rust,ignore
{{#rustdoc_include ../listings/ch07-managing-growing-projects/no-listing-01-use-std-unnested/src/main.rs:here}}
```

</Listing>

相反，我们可以使用嵌套路径在一行中将相同的项目纳入 Scope。我们这样做的方法是指定路径的共同部分，然后加上两个冒号，最后用花括号包裹不同部分的列表，如清单 7-18 所示。

<Listing number="7-18" file-name="src/main.rs" caption="Specifying a nested path to bring multiple items with the same prefix into scope">

```rust,ignore
{{#rustdoc_include ../listings/ch07-managing-growing-projects/listing-07-18/src/main.rs:here}}
```

</Listing>

在更大的程序中，使用嵌套路径将同一 crate 或模块中的多个项目纳入 Scope 可以大大减少所需的单独 `use` 语句数量！

我们可以在路径的任意层级使用嵌套路径，这在结合两个共享子路径的 `use` 语句时非常有用。例如，列表 7-19 展示了两个 `use` 语句：一个将 `std::io` 引入作用域，另一个将 `std::io::Write` 引入作用域。

<Listing number="7-19" file-name="src/lib.rs" caption="Two `use` statements where one is a subpath of the other">

```rust,noplayground
{{#rustdoc_include ../listings/ch07-managing-growing-projects/listing-07-19/src/lib.rs}}
```

</Listing>

这两个路径的共同部分是 `std::io`，这就是完整的第一个路径。为了将这些两个路径合并为一个 `use` 语句，我们可以在嵌套路径中使用 `self`，如列表 7-20 所示。

<Listing number="7-20" file-name="src/lib.rs" caption="Combining the paths in Listing 7-19 into one `use` statement">

```rust,noplayground
{{#rustdoc_include ../listings/ch07-managing-growing-projects/listing-07-20/src/lib.rs}}
```

</Listing>

这行代码将 `std::io` 和 `std::io::Write` 引入作用域。

<!-- Old headings. Do not remove or links may break. -->

<a id="the-glob-operator"></a>

### 使用 Glob 运算符导入项目

如果我们希望将所有在路径中定义的公共项目引入作用域，可以指定该路径后跟 `*` Glob 运算符：

```rust
use std::collections::*;
```

这个 `use` 语句将 `std::collections` 中定义的所有公共项目引入当前作用域。使用 Glob 运算符时要小心！Glob 可能会使得难以判断哪些名称在作用域中，以及程序中使用的名称是在哪里定义的。此外，如果依赖项更改其定义，你导入的项目也会随之改变，当升级依赖项时可能会导致编译器错误，例如，如果依赖项添加了与你在同一作用域中的定义同名的定义。

在测试中经常使用 Glob 运算符将所有被测试项目引入 `tests` 模块；我们将在第 11 章的“如何编写测试”部分讨论这一点。Glob 运算符有时也作为预序模式的一部分使用：有关该模式的更多信息，请参阅 [标准库文档](../std/prelude/index.html#other-preludes)<!-- ignore -->。

[ch14-pub-use]: ch14-02-publishing-to-crates-io.html#exporting-a-convenient-public-api
[rand]: ch02-00-guessing-game-tutorial.html#generating-a-random-number
[writing-tests]: ch11-01-writing-tests.html#how-to-write-tests
