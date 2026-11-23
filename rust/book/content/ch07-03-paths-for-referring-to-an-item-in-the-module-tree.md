## 在模块树中引用项目的路径

为了显示 Rust 中在模块树中项目的位置，我们使用路径的方式与在文件系统中导航时相同。要调用一个函数，我们需要知道其路径。

路径有两种形式：

- _绝对路径_是从 crate 根开始的完整路径；对于来自外部 crate 的代码，绝对路径以 crate 名称开头，而对于来自当前 crate 的代码，则以字面量 `crate` 开头。
- _相对路径_从当前模块开始，使用 `self`、`super` 或当前模块中的标识符。

绝对路径和相对路径后面都跟着一个或多个由双冒号 (`::`) 分隔的标识符。

回到列表 7-1，假设我们想调用 `add_to_waitlist` 函数。这相当于问：`add_to_waitlist` 函数的路径是什么？列表 7-3 包含了去掉部分模块和函数的列表 7-1。

我们将展示两种从新定义的函数 `eat_at_restaurant` 中调用 `add_to_waitlist` 函数的方式，该函数在 crate 根中定义。这些路径是正确的，但还有一个问题阻碍这个示例能够正常编译。我们稍后会解释原因。

`eat_at_restaurant` 函数是我们的库 crate 公共 API 的一部分，因此我们使用 `pub` 关键字标记它。在“使用 `pub` 关键字暴露路径”部分中，我们将详细介绍 `pub`。

<Listing number="7-3" file-name="src/lib.rs" caption="Calling the `add_to_waitlist` function using absolute and relative paths">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch07-managing-growing-projects/listing-07-03/src/lib.rs}}
```

</Listing>

第一次在 `eat_at_restaurant` 中调用 `add_to_waitlist` 函数时，我们使用绝对路径。`add_to_waitlist` 函数在与 `eat_at_restaurant` 相同的 crate 中定义，这意味着我们可以使用 `crate` 关键字来开始绝对路径。然后我们依次包含每个后续模块，直到到达 `add_to_waitlist`。你可以想象一个具有相同结构的文件系统：我们会指定路径 `/front_of_house/hosting/add_to_waitlist` 来运行 `add_to_waitlist` 程序；使用 `crate` 名称从 crate 根开始就像在 shell 中使用 `/` 从文件系统根开始一样。

在 `eat_at_restaurant` 中第二次调用 `add_to_waitlist` 时，我们使用了一个相对路径。该路径以 `front_of_house` 开头，`front_of_house` 是与 `eat_at_restaurant` 处于同一模块树层级下的模块名称。在文件系统中对应的路径应为 `front_of_house/hosting/add_to_waitlist`。使用模块名作为起点意味着这是一个相对路径。

是否使用相对路径还是绝对路径取决于你的项目情况，这取决于你是否更倾向于将项定义代码与使用该项的代码分开或一起移动。例如，如果我们将 `front_of_house` 模块和 `eat_at_restaurant` 函数移动到名为 `customer_experience` 的模块中，则需要将绝对路径更新为 `add_to_waitlist`，但相对路径仍然有效。然而，如果我们将 `eat_at_restaurant` 函数单独移动到名为 `dining` 的模块中，调用 `add_to_waitlist` 的绝对路径保持不变，但相对路径需要更新。通常我们的偏好是使用绝对路径，因为更有可能需要独立移动代码定义和项调用。

让我们尝试编译清单 7-3，看看为什么目前无法编译！我们得到的错误信息显示在清单 7-4 中。

<Listing number="7-4" caption="Compiler errors from building the code in Listing 7-3">

```console
{{#include ../listings/ch07-managing-growing-projects/listing-07-03/output.txt}}
```

</Listing>

错误消息表明模块 `hosting` 是私有的。换句话说，我们有了 `hosting` 模块和 `add_to_waitlist` 函数的正确路径，但 Rust 不允许我们使用它们，因为它无法访问私有部分。在 Rust 中，所有项（函数、方法、结构体、枚举、模块和常量）默认都是对父模块私有的。如果你想将某个项（如函数或结构体）设为私有，就需要将其放入一个模块中。

父模块中的项无法使用子模块内部的私有项，但子模块中的项可以访问其祖先模块中的项。这是因为子模块隐藏了其实现细节，但子模块能够看到它们被定义的环境。用我们的比喻来说，隐私规则就像餐厅的后台办公室：那里发生的事情对顾客是私密的，但办公室经理可以看到并操作他们管理的整个餐厅。

Rust选择以这种方式实现模块系统，使得隐藏内部实现细节成为默认行为。这样，你可以知道哪些部分的内部代码可以修改而不会破坏外部代码。然而，Rust也提供了通过使用 `pub` 关键字将子模块内部的某些部分暴露给祖先模块的选项。

### 使用 `pub` 关键字暴露路径

让我们回到列表 7-4 中的错误，该错误表明 `hosting` 模块是私有的。我们希望父模块中的 `eat_at_restaurant` 函数能够访问子模块中的 `add_to_waitlist` 函数，因此我们在列表 7-5 中用 `pub` 关键字标记了 `hosting` 模块。

<Listing number="7-5" file-name="src/lib.rs" caption="Declaring the `hosting` module as `pub` to use it from `eat_at_restaurant`">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch07-managing-growing-projects/listing-07-05/src/lib.rs:here}}
```

</Listing>

不幸的是，列表 7-5 中的代码仍然会导致编译器错误，如列表 7-6 所示。

<Listing number="7-6" caption="Compiler errors from building the code in Listing 7-5">

```console
{{#include ../listings/ch07-managing-growing-projects/listing-07-05/output.txt}}
```

</Listing>

发生了什么？在 `mod hosting` 前添加 `pub` 关键字会使该模块公开。通过这一修改，如果我们能够访问 `front_of_house`，我们就能访问 `hosting`。但 `hosting` 的内容仍然是私有的；使模块公开并不能使其内容公开。`pub` 关键字只允许祖先模块中的代码引用它，而不允许访问其内部代码。由于模块是容器，仅将模块公开并不能解决太多问题；我们需要进一步选择将模块内的一个或多个项也公开。

列表 7-6 中的错误表明 `add_to_waitlist` 函数是私有的。隐私规则适用于结构体、枚举、函数、方法以及模块。

让我们通过在其定义前添加 `pub` 关键字来将 `add_to_waitlist` 函数设为公开，如清单 7-7 所示。

<Listing number="7-7" file-name="src/lib.rs" caption="Adding the `pub` keyword to `mod hosting` and `fn add_to_waitlist` lets us call the function from `eat_at_restaurant`.">

```rust,noplayground,test_harness
{{#rustdoc_include ../listings/ch07-managing-growing-projects/listing-07-07/src/lib.rs:here}}
```

</Listing>

现在代码可以编译了！为了了解为什么添加 `pub` 关键字使我们能够在 `eat_at_restaurant` 中根据隐私规则使用这些路径，让我们看看绝对路径和相对路径。

在绝对路径中，我们从 `crate` 开始，`crate` 是我们的 crate 模块树的根目录。`front_of_house` 模块定义在 crate 根目录下。虽然 `front_of_house` 不是公开的，因为 `eat_at_restaurant` 函数与 `front_of_house` 定义在同一个模块中（即 `eat_at_restaurant` 和 `front_of_house` 是兄弟模块），但我们可以从 `eat_at_restaurant` 引用 `front_of_house`。接下来是标记为 `pub` 的 `hosting` 模块。我们可以访问 `hosting` 的父模块，因此也可以访问 `hosting`。最后，`add_to_waitlist` 函数也被标记为 `pub`，我们可以访问其父模块，所以这个函数调用是有效的！

在相对路径中，逻辑与绝对路径相同，除了第一步：路径不是从 crate 根开始，而是从 `front_of_house` 开始。`front_of_house` 模块定义在与 `eat_at_restaurant` 相同的模块内，因此以 `eat_at_restaurant` 定义的模块为起点的相对路径是有效的。然后，因为 `hosting` 和 `add_to_waitlist` 都被标记为 `pub`，其余部分路径也有效，因此这个函数调用是合法的！

如果您计划共享您的库 crate，以便其他项目可以使用您的代码，那么您的公共 API 就是您与 crate 用户之间的契约，决定了他们如何与您的代码交互。在管理公共 API 的变更以方便人们依赖您的 crate 时，有许多需要考虑的因素。这些考虑因素超出了本书的范围；如果您对此感兴趣，请参考 [Rust API 指南][api-guidelines]。

> #### 具有二进制和库的包的最佳实践
>
> 我们提到，一个包可以包含 _src/main.rs_ 二进制 crate 根目录和 _src/lib.rs_ 库 crate 根目录，默认情况下这两个 crate 都会具有包名。通常，包含库和二进制 crate 的包中，二进制 crate 中的代码仅够启动可执行文件以调用库中定义的代码。这样其他项目可以充分利用该包提供的所有功能，因为库中的代码可以被共享。
>
> 模块树应定义在 _src/lib.rs_ 中。然后，任何公共项都可以通过以包名开头的方式在二进制 crate 中使用。二进制 crate 就像完全外部的 crate 一样使用库 crate：它只能使用公共 API。这有助于设计良好的 API；你不仅是作者，也是使用者！
>
> 在 [第12章][ch12]<!-- ignore -->中，我们将通过一个包含二进制 crate 和库 crate 的命令行程序来演示这种组织实践。

### 使用 `super` 开始相对路径

我们可以通过在路径开头使用 `super` 来构建从父模块开始的相对路径，而不是当前模块或 crate 根目录。这类似于使用 `..` 语法开始文件系统路径，表示进入父目录。使用 `super` 可以引用我们知道位于父模块中的项，当模块与父模块密切相关但父模块可能将来被移动到模块树的其他位置时，这样就能更容易地重新安排模块树。

请参考列表 7-8 中的代码，它模拟了厨师修正错误订单并亲自将其交给顾客的情况。在 `back_of_house` 模块中定义的函数 `fix_incorrect_order` 通过以 `super` 开头的路径指定到父模块中定义的函数 `deliver_order` 来调用它。

<Listing number="7-8" file-name="src/lib.rs" caption="Calling a function using a relative path starting with `super`">

```rust,noplayground,test_harness
{{#rustdoc_include ../listings/ch07-managing-growing-projects/listing-07-08/src/lib.rs}}
```

</Listing>

`fix_incorrect_order` 函数位于 `back_of_house` 模块中，因此我们可以使用 `super` 访问 `back_of_house` 的父模块，即这里的 `crate` 根模块。从那里可以找到 `deliver_order` 函数。成功！我们认为 `back_of_house` 模块和 `deliver_order` 函数很可能保持相同的关系，如果我们决定重组该模块的树结构，它们也会被一起移动。因此，我们使用 `super`，这样如果此代码被移动到其他模块，将来更新代码的地点就会减少。

### 将结构体与枚举设为公开

我们也可以使用 `pub` 来将结构体与枚举标记为公开，但使用 `pub` 处理结构体与枚举有一些额外的注意事项。如果在结构体定义前使用 `pub`，则使该结构体成为公开类型，但结构体的字段仍为私有。可以根据具体情况决定每个字段是否公开。在列表 7-9 中，我们定义了一个公开的 `back_of_house::Breakfast` 结构体，其中有一个公开的 `toast` 字段和一个私有的 `seasonal_fruit` 字段。这模拟了餐厅场景：顾客可以选择随餐提供的面包类型，而厨师则根据当季库存情况决定搭配哪种水果。可用水果种类变化很快，因此顾客无法选择水果，甚至无法看到他们将获得什么水果。

<Listing number="7-9" file-name="src/lib.rs" caption="A struct with some public fields and some private fields">

```rust,noplayground
{{#rustdoc_include ../listings/ch07-managing-growing-projects/listing-07-09/src/lib.rs}}
```

</Listing>

由于 `back_of_house::Breakfast` 结构体中的 `toast` 字段是公开的，在 `eat_at_restaurant` 中我们可以使用点符号来写入和读取 `toast` 字段。请注意，在 `eat_at_restaurant` 中无法使用 `seasonal_fruit` 字段，因为该字段是私有的。尝试取消注释修改 `seasonal_fruit` 字段值的行，以查看会收到什么错误！

此外，请注意由于 `back_of_house::Breakfast` 具有私有字段，该结构体需要提供一个公共关联函数来构造 `Breakfast` 的实例（我们在此将其命名为 `summer`）。如果 `Breakfast` 没有这样的函数，我们在 `eat_at_restaurant` 中就无法创建 `Breakfast` 的实例，因为无法在 `eat_at_restaurant` 中设置私有 `seasonal_fruit` 字段的值。

相比之下，如果我们将枚举公开化，其所有变体也将是公开的。我们只需在 `enum` 关键字前加上 `pub`，如清单 7-10 所示。

<Listing number="7-10" file-name="src/lib.rs" caption="Designating an enum as public makes all its variants public.">

```rust,noplayground
{{#rustdoc_include ../listings/ch07-managing-growing-projects/listing-07-10/src/lib.rs}}
```

</Listing>

由于我们将 `Appetizer` 枚举公开化，我们可以在 `eat_at_restaurant` 中使用 `Soup` 和 `Salad` 变体。

除非枚举的变体是公开的，否则枚举并不非常有用；每次都需要为所有枚举变体标注 `pub` 会很麻烦，因此默认情况下枚举变体应该是公开的。结构体通常即使其字段不是公开也是有用的，因此结构体字段遵循一般规则：除非标注 `pub`，否则默认都是私有的。

还有一种涉及 `pub` 的情况尚未涵盖，即我们的最后一个模块系统特性：`use` 关键字。我们将先单独介绍 `use` 关键字，然后展示如何结合使用 `pub` 和 `use`。

[pub]: ch07-03-paths-for-referring-to-an-item-in-the-module-tree.html#exposing-paths-with-the-pub-keyword
[api-guidelines]: https://rust-lang.github.io/api-guidelines/
[ch12]: ch12-00-an-io-project.html
