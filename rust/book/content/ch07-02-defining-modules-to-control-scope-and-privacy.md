<!-- Old headings. Do not remove or links may break. -->

<a id="defining-modules-to-control-scope-and-privacy"></a>

## 使用模块控制作用域和隐私性

在本节中，我们将讨论模块及模块系统中的其他部分，包括允许你为项目命名的项目路径、将路径引入作用域的 `use` 关键字，以及使项目对外可访问的 `pub` 关键字。我们还将介绍 `as` 关键字、外部包和 glob 运算符。

### 模块速查表

在深入探讨模块和路径的具体细节之前，这里提供一个关于编译器中模块、路径、`use` 关键字和 `pub` 关键字如何工作的快速参考，以及大多数开发者如何组织代码的方法。在本章中，我们将通过各种示例来讲解这些规则，但作为回顾模块工作原理的参考，这里是一个很好的位置。

- **从 crate 根目录开始**：编译一个 crate 时，编译器首先会在 crate 根文件（通常是库 crate 的 _src/lib.rs_ 和二进制 crate 的 _src/main.rs_）中查找需要编译的代码。
- **声明模块**：在 crate 根文件中，你可以声明新的模块；例如，使用 `mod garden;` 声明一个“花园”模块。编译器会在以下位置查找该模块的代码：
- 内联方式，位于替换 `mod garden` 后分号的花括号中 - 在 _src/garden.rs_ 文件中 - 在 _src/garden/mod.rs_ 文件中 - **声明子模块**：在除 crate 根文件外的任何文件中，你可以声明子模块。例如，可以在 _src/garden.rs_ 中声明 `mod vegetables;`。编译器会在以父模块命名的目录中以下列方式查找子模块的代码：
- 内联方式，直接位于 `mod vegetables` 之后，使用花括号代替分号 - 在 _src/garden/vegetables.rs_ 文件中 - 在 _src/garden/vegetables/mod.rs_ 文件中 - **模块中代码的路径**：一旦某个模块成为你的 crate 的一部分，只要隐私规则允许，你就可以从同一 crate 的其他任何位置通过代码路径引用该模块中的代码。例如，花园蔬菜模块中的 `Asparagus` 类型可以在 `crate::garden::vegetables::Asparagus` 处找到。
- **私有与公开**：默认情况下，模块内的代码对其父模块是私有的。要使一个模块成为公开的，只需使用 `pub mod` 而不是 `mod` 来声明它。若要让公共模块中的项目也变为公开，则在其声明前使用 `pub`。
- **`use` 关键字**：在作用域内，`use` 关键字创建快捷方式，减少长路径的重复。在任何可以引用 `crate::garden::vegetables::Asparagus` 的作用域中，你可以使用 `use crate::garden::vegetables::Asparagus;` 创建快捷方式，之后只需写入 `Asparagus` 即可在作用域内使用该类型。

在这里，我们创建了一个名为 `backyard` 的二进制 crate 来说明这些规则。该 crate 的目录也命名为 _backyard_，包含以下文件和目录：

```text
backyard
├── Cargo.lock
├── Cargo.toml
└── src
    ├── garden
    │   └── vegetables.rs
    ├── garden.rs
    └── main.rs
```

此情况下的 crate 根文件是 _src/main.rs_，其中包含：

<Listing file-name="src/main.rs">

```rust,noplayground,ignore
{{#rustdoc_include ../listings/ch07-managing-growing-projects/quick-reference-example/src/main.rs}}
```

</Listing>

`pub mod garden;` 这一行指示编译器包含在 _src/garden.rs_ 中发现的代码。

<Listing file-name="src/garden.rs">

```rust,noplayground,ignore
{{#rustdoc_include ../listings/ch07-managing-growing-projects/quick-reference-example/src/garden.rs}}
```

</Listing>

这里，`pub mod vegetables;` 表示也包含 _src/garden/vegetables.rs_ 中的代码。该代码内容如下：

```rust,noplayground,ignore
{{#rustdoc_include ../listings/ch07-managing-growing-projects/quick-reference-example/src/garden/vegetables.rs}}
```

现在让我们详细了解这些规则，并实际演示它们是如何应用的！

### 将相关代码分组到模块中

_模块_ 使我们能够按逻辑组织 crate 中的代码，以提高可读性并便于复用。通过模块，我们还可以控制项目的_隐私性_，因为模块内的代码默认是私有的。私有项目属于内部实现细节，外部无法使用。我们可以选择将模块及其内部项目设为公开，从而让外部代码能够使用并依赖它们。

以一个示例为例，让我们编写一个提供餐厅功能的库 crate。我们将定义函数的签名，但保持函数体为空，重点在于代码的组织方式，而非餐厅的具体实现。

在餐饮行业中，餐厅的部分区域被称为前厅，其他部分则称为后厅。_前厅_ 是顾客所在的地方，包括服务员接待顾客、上菜和收钱以及调酒师制作饮品。_后厅_ 则是厨师和烹饪人员在厨房工作、洗碗工清理以及经理处理行政事务的地方。

为了以这种方式组织我们的 crate，我们可以将函数分配到嵌套模块中。通过运行 `cargo new restaurant --lib` 创建一个名为 `restaurant` 的新库。然后，将列表 7-1 中的代码放入 _src/lib.rs_ 中，定义一些模块和函数签名；这些代码属于前厅部分。

<Listing number="7-1" file-name="src/lib.rs" caption="A `front_of_house` module containing other modules that then contain functions">

```rust,noplayground
{{#rustdoc_include ../listings/ch07-managing-growing-projects/listing-07-01/src/lib.rs}}
```

</Listing>

我们使用 `mod` 关键字定义一个模块，后面跟着模块名称（本例中为 `front_of_house`）。模块的体内容在花括号内。在模块内部，我们可以放置其他模块，如本例中的 `hosting` 和 `serving` 模块。模块还可以包含其他项目的定义，例如结构体、枚举、常量、特质，以及列表 7-1 中的函数。

通过使用模块，我们可以将相关定义组合在一起，并说明它们之间的关系。使用此代码的程序员可以根据这些组来浏览代码，而无需阅读所有定义，从而更容易找到与他们相关的定义。向此代码添加新功能的程序员也知道应将代码放在哪里，以保持程序的整洁有序。

之前提到 _src/main.rs_ 和 _src/lib.rs_ 被称为 _crate roots_。它们被如此命名是因为这两个文件的内容在 crate 的模块结构的根部形成了一个名为 `crate` 的模块，该结构被称为 _module tree_。

列表 7-2 展示了列表 7-1 中结构的 模块 tree。

<Listing number="7-2" caption="The module tree for the code in Listing 7-1">

```text
crate
 └── front_of_house
     ├── hosting
     │   ├── add_to_waitlist
     │   └── seat_at_table
     └── serving
         ├── take_order
         ├── serve_order
         └── take_payment
```

</Listing>

此树显示了某些模块如何嵌套在其他模块内部；例如，`hosting` 嵌套在 `front_of_house` 内。树还显示有些模块是 _siblings_，意味着它们定义于同一个模块中；`hosting` 和 `serving` 就是定义在 `front_of_house` 内的兄弟模块。如果模块 A 包含于模块 B 内部，我们说模块 A 是模块 B 的 _child_，而模块 B 是模块 A 的 _parent_。请注意，整个 模块 tree 都根植于名为 `crate` 的隐式模块之下。

模块 tree 可能会让你想起电脑上的文件系统目录树；这是一个非常恰当的比较！就像文件系统中的目录一样，你使用模块来组织代码。就像目录中的文件一样，我们需要一种方法来查找我们的模块。
