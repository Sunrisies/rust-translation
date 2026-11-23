# 编写猜谜游戏

让我们通过一起完成一个实践项目来开始学习 Rust！本章将通过展示如何在实际程序中应用一些常见的 Rust 概念，让你了解这些概念。你将学习 `let`、`match`、方法、关联函数、外部 crate 等更多内容！在接下来的章节中，我们将更详细地探讨这些概念。在本章中，你只需练习基础内容。

我们将实现一个经典的初学者编程问题：猜谜游戏。其运作方式如下：程序会生成一个1到100之间的随机整数，然后提示玩家输入猜测值。输入后，程序会告知猜测值是否过低或过高。如果猜测正确，游戏将打印祝贺信息并退出。

## 创建新项目

要创建新项目，请进入第1章中创建的 _projects_ 目录，并使用 Cargo 创建一个新项目，如下所示：

```console
$ cargo new guessing_game
$ cd guessing_game
```

第一个命令 `cargo new` 将项目名称（`guessing_game`）作为第一个参数。第二个命令则切换到新项目的目录。

查看生成的 _Cargo.toml_ 文件：

<!-- manual-regeneration
cd listings/ch02-guessing-game-tutorial rm -rf no-listing-01-cargo-new cargo new no-listing-01-cargo-new --name guessing_game cd no-listing-01-cargo-new cargo run > output.txt 2>&1 cd ../../.. -->

<span class="filename">Filename: Cargo.toml</span>

```toml
{{#include ../listings/ch02-guessing-game-tutorial/no-listing-01-cargo-new/Cargo.toml}}
```

如第1章所示，`cargo new` 会为你生成一个“Hello, world!”程序。查看 _src/main.rs_ 文件：

<span class="filename">Filename: src/main.rs</span>

```rust
{{#rustdoc_include ../listings/ch02-guessing-game-tutorial/no-listing-01-cargo-new/src/main.rs}}
```

现在让我们编译这个“Hello, world！”程序，并使用 `cargo run` 命令在同一步骤中运行它：

```console
{{#include ../listings/ch02-guessing-game-tutorial/no-listing-01-cargo-new/output.txt}}
```

当你需要快速迭代项目时，`run` 命令非常有用，就像我们在这个游戏中做的那样，可以迅速测试每次迭代，然后再进行下一步。

重新打开 _src/main.rs_ 文件。你将在这个文件中编写所有代码。

## 处理猜测值

猜谜游戏程序的第一部分将请求用户输入，处理该输入，并检查输入是否符合预期格式。首先，我们将允许玩家输入一个猜测值。在 _src/main.rs_ 中插入列表2-1中的代码。

<Listing number="2-1" file-name="src/main.rs" caption="Code that gets a guess from the user and prints it">

```rust,ignore
{{#rustdoc_include ../listings/ch02-guessing-game-tutorial/listing-02-01/src/main.rs:all}}
```

</Listing>

这段代码包含大量信息，因此让我们逐行分析。为了获取用户输入并将结果输出，我们需要引入 `io` 输入/输出库。`io` 库来自标准库，即 `std`：

```rust,ignore
{{#rustdoc_include ../listings/ch02-guessing-game-tutorial/listing-02-01/src/main.rs:io}}
```

默认情况下，Rust 拥有一些在标准库中定义的元素，这些元素被纳入每个程序的作用域中。这一集合被称为 _prelude_，你可以在标准库文档中看到其中的所有内容 [在标准库文档中][prelude]。

如果你想要使用的类型不在 `_prelude_` 中，你需要通过 `use` 语句显式将该类型引入作用域。使用 `std::io` 库可以让你获得许多有用的功能，包括接受用户输入的能力。

如第1章所述，`main` 函数是程序的入口点：

```rust,ignore
{{#rustdoc_include ../listings/ch02-guessing-game-tutorial/listing-02-01/src/main.rs:main}}
```

`fn` 语法用于声明新函数；括号 `()` 表示没有参数；花括号 `{` 则标志着函数的主体。

正如你在第1章中学习的那样，`println!` 是一个宏，用于将字符串输出到屏幕：

```rust,ignore
{{#rustdoc_include ../listings/ch02-guessing-game-tutorial/listing-02-01/src/main.rs:print}}
```

这段代码会打印一个提示信息，说明游戏的内容，并请求用户输入。

### 使用变量存储值

接下来，我们将创建一个 _变量_ 来保存用户输入，如下所示：

```rust,ignore
{{#rustdoc_include ../listings/ch02-guessing-game-tutorial/listing-02-01/src/main.rs:string}}
```

现在程序变得有趣了！这一小行中包含了很多内容。我们使用 `let` 语句创建变量。以下是另一个例子：

```rust,ignore
let apples = 5;
```

这行代码创建了一个名为 `apples` 的新变量，并将其绑定到值 `5`。在 Rust 中，变量默认是不可变的，这意味着一旦给变量赋值，该值就不会改变。我们将在第3章的 [“变量与可变性”][variables-and-mutability]<!-- ignore --> 部分详细讨论这一概念。为了使变量可变，我们在变量名前添加 `mut`：

```rust,ignore
let apples = 5; // immutable
let mut bananas = 5; // mutable
```

> 注意：`//` 语法用于开始注释，注释会一直持续到行尾。Rust 会忽略注释中的任何内容。我们将在 [第3章][comments]<!-- ignore --> 中更详细地讨论注释。

回到猜谜游戏程序，现在你知道 `let mut guess` 会引入一个名为 `guess` 的可变变量。等号 (`=`) 告诉 Rust 我们想将某些值绑定到该变量上。等号右侧的值是 `guess` 所绑定的内容，即调用 `String::new` 的结果，`String::new` 是一个返回新 `String` 实例的函数。[`String`][string]<!-- ignore -->是标准库提供的一种可增长的、UTF-8编码的文本类型。

`::new` 行中的 `::` 语法表明 `new` 是 `String` 类型的关联函数。_关联函数_是指在某个类型上实现的函数，在本例中为 `String`。这个 `new` 函数会创建一个新的空字符串。你会发现在许多类型上都有 `new` 函数，因为这是一个表示创建某种新值的函数的常见名称。

完整来说，`let mut guess = String::new();` 这行代码创建了一个当前绑定到新空 `String` 实例的可变变量。太好了！

### 接收用户输入

请记住，我们在程序的第一行使用了 `use std::io;` 来引入标准库的输入输出功能。现在我们将调用 `io` 模块中的 `stdin` 函数，这将允许我们处理用户输入：

```rust,ignore
{{#rustdoc_include ../listings/ch02-guessing-game-tutorial/listing-02-01/src/main.rs:read}}
```

如果我们不在程序开头使用 `use std::io;` 导入 `io` 模块，仍然可以通过写成 `std::io::stdin` 来使用该函数。`stdin` 函数返回 [`std::io::Stdin`][iostdin]<!-- ignore -->的实例，这是一种表示终端标准输入句柄的类型。

接下来，这行代码 `.read_line(&mut guess)` 调用了标准输入句柄上的 [`read_line`][read_line]<!-- ignore --> 方法，以从用户处获取输入。我们还将 `&mut guess` 作为参数传递给 `read_line`，以便告诉它将用户输入存储在哪个字符串中。`read_line` 的完整功能是将用户在标准输入中输入的内容追加到一个字符串中（不会覆盖其原有内容），因此我们将该字符串作为参数传递。字符串参数需要是可变的，这样该方法才能修改字符串的内容。

`&` 表示这是一个_引用_，它允许代码的多个部分访问同一段数据，而无需多次将数据复制到内存中。引用是一个复杂的特性，Rust 的主要优势之一就是使用引用非常安全且简单。完成这个程序时，你不需要了解太多这些细节。目前，你需要知道的是，与变量一样，引用默认是不可变的。因此，你需要写成 `&mut guess` 而不是 `&guess`，使其可变。（第4章将更详细地解释引用。）

<!-- Old headings. Do not remove or links may break. -->

<a id="handling-potential-failure-with-the-result-type"></a>

### 使用 `Result` 处理潜在错误

我们仍在处理这行代码。我们现在正在讨论第三行文本，但请注意它仍然是单行代码的一部分。接下来的部分是这个方法：

```rust,ignore
{{#rustdoc_include ../listings/ch02-guessing-game-tutorial/listing-02-01/src/main.rs:expect}}
```

我们可以把这段代码写成：

```rust,ignore
io::stdin().read_line(&mut guess).expect("Failed to read line");
```

然而，长行代码难以阅读，因此最好将其拆分。在使用 `.method_name()` 语法调用方法时，引入新行和其他空白字符通常有助于分割长行。现在让我们讨论这行代码的作用。

如前所述，`read_line` 将用户输入的内容放入我们传递的字符串中，但它还会返回一个 `Result` 值。`[result]<!-- ignore -->` 是一个_枚举_，通常称为_枚举类型_，它是一种可以处于多种可能状态的类型。我们将每种可能的状态称为_变体_。

[第6章][enums]<!-- ignore -->将更详细地介绍枚举。这些`Result`类型的目的是编码错误处理信息。

`Result`的变体为`Ok`和`Err`。`Ok`变体表示操作成功，并包含生成的成功值。`Err`变体则表示操作失败，并包含关于操作失败的原因或方式的信息。

`Result`类型的值，如同任何类型的值一样，都拥有定义好的方法。`Result`的一个实例具有可以调用的 [`expect`方法][expect]<!-- ignore -->。如果此`Result`实例为`Err`值，`expect`会导致程序崩溃并显示您传递给`expect`的参数消息。如果`read_line`方法返回`Err`，很可能是底层操作系统产生的错误所致。如果此`Result`实例为`Ok`值，`expect`将获取`Ok`所持有的返回值，并将其返回给您使用。在这种情况下，该值即为用户输入中的字节数。

如果您不调用`expect`，程序可以编译，但会收到警告：

```console
{{#include ../listings/ch02-guessing-game-tutorial/no-listing-02-without-expect/output.txt}}
```

Rust会警告您没有使用`read_line`返回的`Result`值，表明程序没有处理可能的错误。

抑制此警告的正确方法实际上是编写错误处理代码，但在我们的案例中，我们只是希望在出现问题时让程序崩溃，因此可以使用`expect`。关于从错误中恢复的方法，您将在[第9章][recover]<!-- ignore -->中学习。

### 使用`println!`占位符打印值

除了闭合花括号外，代码中还有一行需要讨论：

```rust,ignore
{{#rustdoc_include ../listings/ch02-guessing-game-tutorial/listing-02-01/src/main.rs:print_guess}}
```

这行代码会打印包含用户输入的字符串。`{}` 这样的花括号是一个占位符：可以将 `{}` 想象成用来固定值的螃蟹钳子。当打印变量的值时，变量名可以放在花括号内；当打印表达式的结果时，在格式字符串中放置空的花括号，然后在每个空花括号占位符后按逗号分隔列出要打印的表达式。在一次 `println!` 调用中同时打印变量和表达式结果的效果如下：

```rust
let x = 5;
let y = 10;

println!("x = {x} and y + 2 = {}", y + 2);
```

这段代码会打印 `x = 5 and y + 2 = 12`。

### 测试第一部分

让我们测试猜谜游戏的第一部分，使用 `cargo run` 运行它：

<!-- manual-regeneration
cd listings/ch02-guessing-game-tutorial/listing-02-01/ cargo clean cargo run input 6 -->

```console
$ cargo run
   Compiling guessing_game v0.1.0 (file:///projects/guessing_game)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 6.44s
     Running `target/debug/guessing_game`
Guess the number!
Please input your guess.
6
You guessed: 6
```

此时，游戏的第一个部分已完成：我们从键盘获取输入并将其打印出来。

## 生成秘密数字

接下来，我们需要生成一个用户试图猜出的秘密数字。每次生成的秘密数字都应不同，这样游戏可以多次进行，增加趣味性。我们将使用1到100之间的随机数，以确保游戏不会太难。Rust的标准库目前还不包含随机数功能。不过，Rust团队提供了 [`rand` crate][randcrate]来实现这一功能。

<!-- Old headings. Do not remove or links may break. -->
<a id="using-a-crate-to-get-more-functionality"></a>

### 通过 crate 增强功能

请记住，crate 是 Rust源代码文件的集合。我们正在构建的项目是一个二进制 crate，即可执行文件。`rand` crate 则是一个库 crate，它包含用于其他程序的代码，无法独立执行。

Cargo对外部crate的协调机制是其真正出色的地方。在编写使用`rand`的代码之前，我们需要修改`_Cargo.toml`文件，将`rand` crate作为依赖项添加。现在打开该文件，在`[dependencies]`部分标题下方添加以下行。务必严格按照这里指定的版本号来指定`rand`，否则本教程中的代码示例可能无法正常工作：

<!-- When updating the version of `rand` used, also update the version of
这些文件中使用的`rand`必须保持一致：

* ch01-01-installation.md * ch07-04-bringing-paths-into-scope-with-the-use-keyword.md * ch14-03-cargo-workspaces.md -->

<span class="filename">Filename: Cargo.toml</span>

```toml
{{#include ../listings/ch02-guessing-game-tutorial/listing-02-02/Cargo.toml:8:}}
```

在`_Cargo.toml`文件中，所有以标题开头的内容都属于该部分，直到另一个部分开始为止。在 `[dependencies]` 中，你告诉Cargo你的项目依赖哪些外部crate以及需要这些crate的哪个版本。在这种情况下，我们使用语义版本规范`0.10.1`来指定`rand` crate。Cargo理解[语义版本控制][semver]<!-- ignore -->（有时称为_SemVer_），这是一种编写版本号的标准。`0.10.1`这个规范实际上是对`^0.10.1`的简写，意味着任何至少满足0.10.1但低于0.11.0的版本都适用。

Cargo认为这些版本具有与0.10.1兼容的公共API，此规范确保你能够获取最新补丁版本，并且仍然可以编译本章中的代码。任何0.11.0或更高版本的API并不保证与以下示例使用的API相同。

现在，无需修改任何代码，让我们按照列表2-2所示的步骤构建项目。

<!-- manual-regeneration
cd listings/ch02-guessing-game-tutorial/listing-02-02/ rm Cargo.lock cargo clean cargo build -->

<Listing number="2-2" caption="The output from running `cargo build` after adding the `rand` crate as a dependency">

```console
$ cargo build
    Updating crates.io index
     Locking 8 packages to latest Rust 1.96.0 compatible versions
  Downloaded rand_core v0.10.1
  Downloaded chacha20 v0.10.1
  Downloaded rand v0.10.1
  Downloaded 3 crates (162.9KiB) in 0.59s
   Compiling libc v0.2.186
   Compiling rand_core v0.10.1
   Compiling getrandom v0.4.3
   Compiling cfg-if v1.0.4
   Compiling chacha20 v0.10.1
   Compiling rand v0.10.1
   Compiling guessing_game v0.1.0 (file:///projects/guessing_game)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 2.03s
```

</Listing>

你可能会看到不同的版本号（但由于SemVer，它们都兼容于代码！）和不同的行数（取决于操作系统），且这些行数的顺序也可能不同。

当我们引入外部依赖项时，Cargo会从 _registry_ 中获取该依赖项所需的所有最新版本，而 _registry_ 实际上是 [Crates.io][cratesio] 数据的副本。Crates.io 是 Rust 生态系统中的平台，人们可以在这里发布他们的开源 Rust 项目供他人使用。

更新了注册表后，Cargo会检查 `[dependencies]` 部分，并下载那些尚未下载的 crate。在这种情况下，尽管我们只将 `rand` 列为依赖项，但 Cargo 还是下载了 `rand` 所依赖的其他 crate 以使其正常工作。下载这些 crate 后，Rust 会对它们进行编译，然后利用所有可用的依赖项对项目进行编译。

如果你没有做任何更改就立即再次运行 `cargo build`，除了 `Finished` 行之外你将不会看到任何输出。Cargo知道它已经下载并编译了依赖项，而你在 `_Cargo.toml` 文件中也没有对其进行任何修改。由于你也没有对代码进行任何更改，因此 Cargo也不会重新编译这些依赖项。没有可做的事情时，它 simply 会退出。

如果你打开 _src/main.rs_ 文件，进行一个简单的更改，然后保存并再次构建，你将只会看到两行输出：

<!-- manual-regeneration
cd listings/ch02-guessing-game-tutorial/listing-02-02/ touch src/main.rs cargo build -->

```console
$ cargo build
   Compiling guessing_game v0.1.0 (file:///projects/guessing_game)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.13s
```

这些行表明 Cargo 仅通过你对 _src/main.rs_ 文件的微小更改来更新构建过程。你的依赖项没有变化，因此 Cargo知道它可以重复使用它已经下载和编译过的那些依赖项。

<!-- Old headings. Do not remove or links may break. -->
<a id="ensuring-reproducible-builds-with-the-cargo-lock-file"></a>

#### 确保可复现的构建

Cargo 具有一种机制，可以确保每次你或他人构建代码时都能重新构建相同的产物：Cargo 将仅使用你指定的依赖项版本，直到你明确指示 otherwise。例如，假设下周 `rand` crate 的 0.10.2 版本发布，该版本包含重要的错误修复，但也包含会破坏代码的回归问题。为了处理这种情况，Rust 会在你第一次运行 `cargo build` 时创建 _Cargo.lock_ 文件，因此我们现在在 _guessing_game_ 目录中有了这个文件。

当你首次构建项目时，Cargo会自动找出符合要求的所有依赖版本，并将它们写入 _Cargo.lock_ 文件。将来构建项目时，Cargo会检测到 _Cargo.lock_ 文件的存在，并直接使用其中指定的版本，而无需再次手动查找版本信息。这样就能实现自动可复现的构建过程。换句话说，由于 _Cargo.lock_ 文件的存在，你的项目将始终保持为 0.10.1 版本，直到你明确进行升级操作。因为 _Cargo.lock_ 对可复现构建至关重要，它通常会与项目中的其他代码一起提交到源代码控制中。

#### 更新 crate 以获取新版本

如果你确实想要更新某个 crate，Cargo提供了 `update` 命令，该命令会忽略 _Cargo.lock_ 文件，并在 _Cargo.toml_ 文件中找出符合你要求的所有最新版本。然后 Cargo会将这些版本写入 _Cargo.lock_ 文件。否则，默认情况下，Cargo只会寻找大于 0.10.1 且小于 0.11.0 的版本。如果 `rand` crate 发布了两个新版本：0.10.2 和 0.999.0，运行 `cargo update` 后你会看到如下输出：

<!-- manual-regeneration
cd listings/ch02-guessing-game-tutorial/listing-02-02/ cargo update assuming there is a new version of rand; otherwise use another update as a guide to creating the hypothetical output shown here -->

```console
$ cargo update
    Updating crates.io index
     Locking 1 package to latest Rust 1.96.0 compatible version
    Updating rand v0.10.1 -> v0.10.2 (available: v0.999.0)
```

Cargo 会忽略 0.999.0 版本。此时，你还会注意到 _Cargo.lock_ 文件中的变化，表明你现在使用的 `rand` crate 版本为 0.10.2。如果你想要使用 `rand` 的 0.999.0 版本或 0.999._x_ 系列中的任何版本，则必须更新 _Cargo.toml_ 文件，使其看起来像这样（实际上不要进行此更改，因为以下示例假设你使用的是 `rand` 0.10 版本）。

```toml
[dependencies]
rand = "0.999.0"
```

下次运行 `cargo build` 时，Cargo会更新可用 crate 的注册表，并根据你指定的新版本重新评估你的 `rand` 需求。

关于 [Cargo][doccargo]<!-- ignore --> 及其 [生态系统][doccratesio]<!-- ignore -->，还有很多内容可以在第14章中讨论，但目前这些就是你需要了解的全部。Cargo使得库的重用变得非常容易，因此 Rustaceans 能够编写由多个包组成的较小项目。

### 生成随机数

让我们开始使用 `rand` 来生成一个用于猜测的数字。下一步是更新 _src/main.rs_，如清单 2-3 所示。

<Listing number="2-3" file-name="src/main.rs" caption="Adding code to generate a random number">

```rust,ignore
{{#rustdoc_include ../listings/ch02-guessing-game-tutorial/listing-02-03/src/main.rs:all}}
```

</Listing>

首先，我们添加行 `use rand::prelude::*;`。`prelude` 模块包含了 `rand` crate 中最常用的部分，`use` 语句使得这些项可以在程序的作用域中使用。

接下来，我们在中间添加两行代码。在第一行中，我们调用 `rand::rng` 函数，该函数提供了我们将要使用的特定随机生成器：一个属于当前执行线程的本地生成器，并由操作系统初始化。然后，我们对随机生成器调用 `random_range` 方法。该方法由 `RngExt` trait 定义，而 `RngExt` trait 属于 `rand::prelude` 模块，我们通过 `use rand::prelude::*;` 语句将其引入作用域。`random_range` 方法接受一个范围表达式作为参数，并生成该范围内的随机数字。我们这里使用的范围表达式形式为 `start..=end`，上下界都是包含的，因此我们需要指定 `1..=100` 来请求一个介于 1 和 100 之间的数字。

> 注意：你无法仅从 crate 中知道哪些内容可以引入作用域以及调用哪些方法和函数，因此每个 crate 都有使用说明文档。Cargo 的另一个便利功能是运行 `cargo doc --open` 命令可以在本地构建所有依赖项提供的文档，并在浏览器中打开它们。如果你对 `rand` crate 的其他功能感兴趣，例如，运行 `cargo doc --open` 然后点击左侧侧边栏中的 `rand`。

第二行新代码会打印出秘密数字。在开发程序以进行测试时，这很有用，但最终版本中将删除它。如果程序一启动就直接显示答案，那就不算什么游戏了！

尝试多次运行该程序：

<!-- manual-regeneration
cd listings/ch02-guessing-game-tutorial/listing-02-03/ cargo run 4 cargo run 5 -->

```console
$ cargo run
   Compiling guessing_game v0.1.0 (file:///projects/guessing_game)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.02s
     Running `target/debug/guessing_game`
Guess the number!
The secret number is: 7
Please input your guess.
4
You guessed: 4

$ cargo run
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.02s
     Running `target/debug/guessing_game`
Guess the number!
The secret number is: 83
Please input your guess.
5
You guessed: 5
```

你应该会得到不同的随机数字，且这些数字都应在1到100之间。如果看到警告，可以安全忽略它们。如果遇到错误，请检查你的 *Cargo.toml* 文件是否包含 `rand = "0.10.1"`，因为未来的 `rand` 版本可能具有不同的 API，但 `0.10` 系列中的任何版本都适用于本章中的代码。

## 将猜测与秘密数字进行比较

现在我们已经有了用户输入和随机数字，就可以进行比较了。这一步骤在清单2-4中展示。请注意，目前这段代码无法编译，我们会在后面解释原因。

<Listing number="2-4" file-name="src/main.rs" caption="Handling the possible return values of comparing two numbers">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch02-guessing-game-tutorial/listing-02-04/src/main.rs:here}}
```

</Listing>

首先，我们添加另一个 `use` 语句，从标准库中引入一个名为 `std::cmp::Ordering` 的类型。`Ordering` 类型也是一个枚举，包含 `Less`、`Greater` 和 `Equal` 三种变体。当比较两个值时，可能只有这三种结果。

然后，我们在底部添加五行新代码来使用 `Ordering` 类型。`cmp` 方法用于比较两个值，可以应用于任何可比较的对象。它接受一个引用参数，表示你要比较的对象：这里，就是比较 `guess` 和 `secret_number`。之后，它返回与 `use` 语句中引入的 `Ordering` 枚举变体相对应的结果。我们使用 [`match`][match]<!-- ignore --> 表达式来决定下一步该做什么，这取决于从 `cmp` 调用中返回的 `Ordering` 变体以及 `guess` 和 `secret_number` 中的数值。

`match` 表达式由_分支_组成。一个分支包含用于匹配的_模式_，以及如果 `match` 所给定的值符合该分支模式时应该执行的代码。Rust 会将 `match` 所给定的值逐一检查每个分支的模式。模式和 `match` 构造是 Rust 强大的特性：它们允许你表达代码可能遇到的各种情况，并确保你能处理所有情况。这些特性将在第6章和第19章中详细讨论。

让我们通过一个使用 `match` 表达式的例子来演示。假设用户猜了50，这次随机生成的秘密数字是38。

当代码将50与38进行比较时，`cmp` 方法会返回 `Ordering::Greater`，因为50大于38。`match` 表达式得到 `Ordering::Greater` 的值后，开始检查每个分支的模式。它查看第一个分支的模式 `Ordering::Less`，发现 `Ordering::Greater` 的值不符合 `Ordering::Less`，因此忽略该分支中的代码并继续检查下一个分支。下一个分支的模式是 `Ordering::Greater`，这确实符合 `Ordering::Greater`！该分支中的相关代码将被执行，并在屏幕上输出 `Too big!`。`match` 表达式在第一个匹配成功后结束，因此在这种情况下不会检查最后一个分支。

然而，列表2-4中的代码目前无法编译。让我们尝试一下：

<!--
此输出的错误编号应该是**没有**锚点或截切注释的代码的错误 -->

```console
{{#include ../listings/ch02-guessing-game-tutorial/listing-02-04/output.txt}}
```

错误核心在于存在_类型不匹配_的问题。Rust 拥有强大的静态类型系统，但也具备类型推断功能。当我们编写 `let mut guess = String::new()` 时，Rust 能够自动推断出 `guess` 应为 `String` 类型，因此无需显式写出类型声明。而 `secret_number` 则属于数字类型。Rust 中的部分数字类型可以取值在 1 到 100 之间：如 `i32`（32 位整数）、`u32`（无符号 32 位整数）、`i64`（64 位整数）等。除非另有说明，否则默认情况下 `secret_number` 的类型为 `i32`，除非你在其他地方添加类型信息导致 Rust 推断出不同的数值类型。出现错误的原因是 Rust 无法将字符串与数字类型进行比较。

最终，我们希望将程序作为输入读取的 `String` 转换为数字类型，以便能够将其与秘密数字进行数值比较。我们通过在 `main` 函数体内添加以下代码来实现这一点：

<span class="filename">Filename: src/main.rs</span>

```rust,ignore
{{#rustdoc_include ../listings/ch02-guessing-game-tutorial/no-listing-03-convert-string-to-number/src/main.rs:here}}
```

该代码行为：

```rust,ignore
let guess: u32 = guess.trim().parse().expect("Please type a number!");
```

我们创建了一个名为 `guess` 的变量。但是，程序是否已经有一个名为 `guess` 的变量呢？确实如此，但 Rust 允许我们通过新变量来遮蔽之前的 `guess` 值。_遮蔽_ 功能使我们能够重复使用 `guess` 变量名，而无需创建两个唯一的变量，例如 `guess_str` 和 `guess`。我们将在 [第 3 章][shadowing]<!-- ignore -->中详细讨论此功能，但目前只需知道当需要从一种类型转换为另一种类型时，通常会使用这一特性。

我们将这个新变量绑定到表达式 `guess.trim().parse()` 上。表达式中的 `guess` 指的是原本包含字符串输入的 `guess` 变量。`String` 实例的 `trim` 方法会去除首尾的空白字符，这是在将字符串转换为只能包含数值数据的 `u32` 之前必须完成的步骤。用户必须按下...
<kbd>enter</kbd> to satisfy `read_line` and input their guess, which adds a
在字符串中添加换行符。例如，如果用户输入 <kbd>5</kbd> 然后按 <kbd>enter</kbd>，`guess` 将显示为 `5\n`。其中的 `\n` 表示“换行”。（在 Windows 上，按 <kbd>enter</kbd> 会生成回车符和换行符，即 `\r\n`）。`trim` 方法可以去除 `\n` 或 `\r\n`，从而只保留 `5`。

[str 的 [`parse` 方法][parse]<!-- ignore -->] 将字符串转换为其他类型。在这里，我们使用它来将字符串转换为数字。我们需要通过 `let guess: u32` 告诉 Rust 我们想要的具体数字类型。`guess` 后面的冒号 (`:`) 告诉 Rust 我们将对变量类型进行注释。Rust 有一些内置的数字类型；这里看到的 `u32` 是一个无符号的 32 位整数。对于较小的正数来说，这是很好的默认选择。您将在 [第 3 章][integers]<!-- ignore -->中了解其他数字类型。

此外，此示例程序中的 `u32` 注释以及与 `secret_number` 的比较意味着 Rust 将推断 `secret_number` 也应该是 `u32`。因此，现在比较将是两个相同类型的数值之间的比较！

`parse` 方法仅适用于可以逻辑上转换为数字且容易出错字符。例如，如果字符串包含 `A👍%`，则无法将其转换为数字。由于可能会失败，`parse` 方法返回 `Result` 类型，就像 `read_line` 方法一样（之前在 [“使用 `Result` 处理潜在错误”](#handling-potential-failure-with-result)<!-- ignore -->中讨论过）。我们将再次使用 `expect` 方法来处理这个 `Result`。如果 `parse` 返回 `Err` `Result` 变体，因为它无法从字符串创建数字，`expect` 调用将导致游戏崩溃并打印我们提供的消息。如果 `parse` 能够成功将字符串转换为数字，它将返回 `Ok` `Result` 变体，而 `expect` 将从 `Ok` 值中返回我们想要的数字。

现在让我们运行程序：

<!-- manual-regeneration
cd listings/ch02-guessing-game-tutorial/no-listing-03-convert-string-to-number/ touch src/main.rs cargo run 76 -->

```console
$ cargo run
   Compiling guessing_game v0.1.0 (file:///projects/guessing_game)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.26s
     Running `target/debug/guessing_game`
Guess the number!
The secret number is: 58
Please input your guess.
  76
You guessed: 76
Too big!
```

很好！即使在猜测之前添加了空格，程序仍然能够识别出用户猜中了 76。请多次运行该程序，以验证不同输入类型下的不同行为：正确猜测数字、猜过高的数字以及猜过低的数字。

目前大部分游戏功能已经可以正常运行了，但用户只能进行一次猜测。让我们通过添加循环来改变这一点！

## 使用循环允许多次猜测

`loop` 关键字会创建无限循环。我们将添加一个循环，以便用户有更多机会猜出数字：

<span class="filename">Filename: src/main.rs</span>

```rust,ignore
{{#rustdoc_include ../listings/ch02-guessing-game-tutorial/no-listing-04-looping/src/main.rs:here}}
```

如您所见，我们已经将所有内容从输入提示移到了循环中。请确保循环内的每一行都缩进四个空格，然后再次运行程序。现在程序将不断询问新的猜测，这实际上引入了一个新的问题。看起来用户无法退出！

用户始终可以通过使用键盘快捷键中断程序。
<kbd>ctrl</kbd>-<kbd>C</kbd>. But there’s another way to escape this insatiable
如 `[“比较猜测与秘密数字”](#comparing-the-guess-to-the-secret-number)` 中的 `parse` 讨论所述：`monster`，如果用户输入非数字答案，程序将崩溃。我们可以利用这一点让用户能够退出，如下所示：

<!-- manual-regeneration
cd listings/ch02-guessing-game-tutorial/no-listing-04-looping/ touch src/main.rs cargo run (too small guess) (too big guess) (correct guess) quit -->

```console
$ cargo run
   Compiling guessing_game v0.1.0 (file:///projects/guessing_game)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.23s
     Running `target/debug/guessing_game`
Guess the number!
The secret number is: 59
Please input your guess.
45
You guessed: 45
Too small!
Please input your guess.
60
You guessed: 60
Too big!
Please input your guess.
59
You guessed: 59
You win!
Please input your guess.
quit

thread 'main' (6694925) panicked at src/main.rs:28:47:
Please type a number!: ParseIntError { kind: InvalidDigit }
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace
```

输入 `quit` 将退出游戏，但正如您会注意到的，输入任何非数字内容也会退出。至少可以说这是次优的；我们希望在猜出正确数字时游戏也能停止。

### 猜对后退出

让我们通过添加 `break` 语句来编程使游戏在用户获胜时退出：

<span class="filename">Filename: src/main.rs</span>

```rust,ignore
{{#rustdoc_include ../listings/ch02-guessing-game-tutorial/no-listing-05-quitting/src/main.rs:here}}
```

在 `You win!` 之后添加 `break` 行，使得程序在用户正确猜测秘密数字时退出循环。退出循环也意味着退出程序，因为循环是 `main` 的最后一部分。

### 处理无效输入

为了进一步优化游戏行为，当用户输入非数字时不要导致程序崩溃，而是让游戏忽略非数字输入，这样用户就可以继续猜测。我们可以通过修改将 `guess` 从 `String` 转换为 `u32` 的那一行代码来实现这一点，如清单 2-5 所示。

<Listing number="2-5" file-name="src/main.rs" caption="Ignoring a non-number guess and asking for another guess instead of crashing the program">

```rust,ignore
{{#rustdoc_include ../listings/ch02-guessing-game-tutorial/listing-02-05/src/main.rs:here}}
```

</Listing>

我们从使用 `expect` 调用改为使用 `match` 表达式，从而从因错误而崩溃变为处理错误。请记住，`parse` 返回的是 `Result` 类型，而 `Result` 是一个枚举，包含 `Ok` 和 `Err` 两种变体。这里我们使用 `match` 表达式，就像我们对 `cmp` 方法的 `Ordering` 结果所做的那样。

如果 `parse` 能够成功将字符串转换为数字，它将返回一个包含结果的 `Ok` 值。这个 `Ok` 值会匹配第一个分支的模式，而 `match` 表达式则直接返回 `parse` 产生的 `num` 值并放入 `Ok` 值中。这个数字将会被放在我们新创建的 `guess` 变量中，正好符合我们的需求。

如果 `parse` 无法将字符串转换为数字，它将返回一个包含更多错误信息的 `Err` 值。这个 `Err` 值不匹配第一个 `match` 分支中的 `Ok(num)` 模式，但它匹配第二个分支中的 `Err(_)` 模式。下划线 `_` 是一个通用值；在这个例子中，我们表示希望匹配所有 `Err` 值，无论它们内部包含什么信息。因此，程序将执行第二个分支的代码 `continue`，这告诉程序进入 `loop` 的下一个迭代并请求另一个猜测。实际上，程序会忽略 `parse` 可能遇到的所有错误！

现在程序中的一切应该都能按预期工作。让我们试试看：

<!-- manual-regeneration
cd listings/ch02-guessing-game-tutorial/listing-02-05/ cargo run (too small guess) (too big guess) foo (correct guess) -->

```console
$ cargo run
   Compiling guessing_game v0.1.0 (file:///projects/guessing_game)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.13s
     Running `target/debug/guessing_game`
Guess the number!
The secret number is: 61
Please input your guess.
10
You guessed: 10
Too small!
Please input your guess.
99
You guessed: 99
Too big!
Please input your guess.
foo
Please input your guess.
61
You guessed: 61
You win!
```

太好了！只需一个小小的最后调整，我们就能完成猜数字游戏。请记住，程序仍然在输出秘密数字。这种方式适合测试，但会破坏游戏的体验。让我们删除输出秘密数字的 `println!` 代码。清单 2-6 展示了最终代码。

<Listing number="2-6" file-name="src/main.rs" caption="Complete guessing game code">

```rust,ignore
{{#rustdoc_include ../listings/ch02-guessing-game-tutorial/listing-02-06/src/main.rs}}
```

</Listing>

此时，你已经成功构建了猜数字游戏。恭喜你！

## 总结

这个项目是一种实践方式，让你了解许多新的 Rust 概念：`let`、`match`、函数、外部 crate 的使用等。在接下来的几章中，你将更详细地学习这些概念。第 3 章涵盖了大多数编程语言都有的概念，如变量、数据类型和函数，并展示了如何在 Rust 中使用它们。第 4 章探讨了所有权这一使 Rust 与其他语言不同的特性。第 5 章讨论了结构体和方法语法，第 6 章解释了枚举的工作原理。

[prelude]: ../std/prelude/index.html
[variables-and-mutability]: ch03-01-variables-and-mutability.html#variables-and-mutability
[comments]: ch03-04-comments.html
[string]: ../std/string/struct.String.html
[iostdin]: ../std/io/struct.Stdin.html
[read_line]: ../std/io/struct.Stdin.html#method.read_line
[result]: ../std/result/enum.Result.html
[enums]: ch06-00-enums.html
[expect]: ../std/result/enum.Result.html#method.expect
[recover]: ch09-02-recoverable-errors-with-result.html
[randcrate]: https://crates.io/crates/rand
[semver]: http://semver.org
[cratesio]: https://crates.io/
[doccargo]: https://doc.rust-lang.org/cargo/
[doccratesio]: https://doc.rust-lang.org/cargo/reference/publishing.html
[match]: ch06-02-match.html
[shadowing]: ch03-01-variables-and-mutability.html#shadowing
[parse]: ../std/primitive.str.html#method.parse
[integers]: ch03-02-data-types.html#integer-types
