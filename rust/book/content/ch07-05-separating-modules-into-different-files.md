## 将模块分离到不同文件中

到目前为止，本章中的所有示例都在一个文件中定义多个模块。当模块变得庞大时，你可能希望将其定义移动到单独的文件中，以便更轻松地浏览代码。

例如，让我们从列表 7-17 中的代码开始，该代码包含多个餐厅模块。我们将这些模块提取到不同的文件中，而不是在 crate 根文件中进行定义。在这种情况下，crate 根文件是 _src/lib.rs_，但这一方法也适用于 crate 根文件为 _src/main.rs_ 的二进制 crate。

首先，我们将 `front_of_house` 模块提取到自己的文件中。移除 `front_of_house` 模块括号内的代码，只保留 `mod front_of_house;` 声明，这样 _src/lib.rs_ 就包含列表 7-21 中显示的代码。请注意，直到我们在列表 7-22 中创建 _src/front_of_house.rs_ 文件之前，这都无法编译。

<Listing number="7-21" file-name="src/lib.rs" caption="Declaring the `front_of_house` module whose body will be in *src/front_of_house.rs*">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch07-managing-growing-projects/listing-07-21-and-22/src/lib.rs}}
```

</Listing>

接下来，将括号内的代码放入名为 _src/front_of_house.rs_ 的新文件中，如列表 7-22 所示。编译器知道去查找这个文件，因为它在 crate 根文件中看到了名为 `front_of_house` 的模块声明。

<Listing number="7-22" file-name="src/front_of_house.rs" caption="Definitions inside the `front_of_house` module in *src/front_of_house.rs*">

```rust,ignore
{{#rustdoc_include ../listings/ch07-managing-growing-projects/listing-07-21-and-22/src/front_of_house.rs}}
```

</Listing>

请注意，在模块树中，你只需要使用 `mod` 声明加载一个文件一次即可。一旦编译器知道该文件是项目的一部分（并且知道代码位于模块树的哪个位置，因为你放置了 `mod` 语句），项目中的其他文件应该通过路径引用被加载文件的代码，如“在模块树中引用项目的路径”部分所述。换句话说，`mod` 不是你在其他编程语言中看到的“包含”操作。

接下来，我们将 `hosting` 模块提取到自己的文件中。这个过程略有不同，因为 `hosting` 是 `front_of_house` 的子模块，而不是根模块。我们将 `hosting` 的文件放在一个新的目录中，该目录的名称将基于模块树中的祖先模块，在这种情况下为 _src/front_of_house_。

为了开始使用 `hosting`，我们将 _src/front_of_house.rs_ 改为仅包含 `hosting` 模块的声明：

<Listing file-name="src/front_of_house.rs">

```rust,ignore
{{#rustdoc_include ../listings/ch07-managing-growing-projects/no-listing-02-extracting-hosting/src/front_of_house.rs}}
```

</Listing>

然后，我们创建 _src/front_of_house_ 目录和 _hosting.rs_ 文件，以包含 `hosting` 模块中的定义：

<Listing file-name="src/front_of_house/hosting.rs">

```rust,ignore
{{#rustdoc_include ../listings/ch07-managing-growing-projects/no-listing-02-extracting-hosting/src/front_of_house/hosting.rs}}
```

</Listing>

如果我们把 _hosting.rs_ 放在 _src_ 目录中，编译器会期望 _hosting.rs_ 代码位于 crate 根目录中声明的 `hosting` 模块内，而不是作为 `front_of_house` 模块的子模块。编译器的规则要求检查哪些文件包含哪个模块的代码，这使得目录和文件与模块树更加匹配。

> ### 其他文件路径
>
> 到目前为止，我们已经介绍了 Rust 编译器使用的最符合直觉的文件路径，但 Rust 也支持一种较旧的文件路径风格。对于在 crate 根目录中声明的 `front_of_house` 模块，编译器会在以下位置查找该模块的代码：
>
> - _src/front_of_house.rs_（我们已讨论过） - _src/front_of_house/mod.rs_（旧式路径，仍被支持）
>
> 对于作为 `front_of_house` 子模块的 `hosting` 模块，编译器会在以下位置查找该模块的代码：
>
> - _src/front_of_house/hosting.rs_（我们已讨论过） - _src/front_of_house/hosting/mod.rs_（旧式路径，仍被支持）
>
> 如果你对同一个模块使用两种不同的文件路径风格，将会引发编译器错误。在同一个项目中对不同模块使用混合风格是可以的，但可能会让项目使用者感到困惑。
>
> 使用 _mod.rs_ 命名文件的路径的主要缺点是，你的项目最终会包含许多名为 _mod.rs_ 的文件，当同时打开这些文件时可能会让人感到混乱。

我们将每个模块的代码移到了单独的文件中，而模块树保持不变。即使定义位于不同的文件中，`eat_at_restaurant` 中的函数调用仍然可以无需修改地运行。这种技术允许你在模块规模增长时将其移动到新文件中。

请注意，_src/lib.rs_ 中的 `pub use crate::front_of_house::hosting` 语句也没有改变，`use` 对哪些文件被编译为库的一部分也没有影响。`mod` 关键字用于声明模块，Rust 会查找与模块名称相同的文件以获取该模块中的代码。

## 摘要

Rust 允许你将一个包拆分为多个 crate，并将一个 crate 拆分为多个模块，这样你就可以从另一个模块引用定义在其中一个模块中的项。你可以通过指定绝对或相对路径来实现这一点。这些路径可以通过 `use` 语句引入作用域中，从而可以在该作用域中对该项进行多次使用时采用更短的路径。模块代码默认是私有的，但你可以通过添加 `pub` 关键字将其定义公开。

在下一章中，我们将介绍标准库中的一些集合数据结构，这些结构可以应用于你组织良好的代码中。

[paths]: ch07-03-paths-for-referring-to-an-item-in-the-module-tree.html
