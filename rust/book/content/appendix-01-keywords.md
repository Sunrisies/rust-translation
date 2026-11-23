## 附录 A：关键词

以下列表包含了 Rust 语言当前或未来使用所保留的关键词。因此，这些关键词不能用作标识符（除了作为原始标识符，我们将在[“原始标识符”][raw-identifiers]<!-- ignore -->部分讨论）。_标识符_是指函数、变量、参数、结构体字段、模块、crate、常量、宏、静态值、属性、类型、特征或生命周期的名称。


### 当前使用的关键词

以下是当前正在使用的关键词列表，并附有其功能说明。

- **`as`**：进行基本类型转换，明确包含项目的特定特质，或在 `use` 语句中重命名项目。
- **`async`**：返回 `Future`，而非阻塞当前线程。
- **`await`**：暂停执行，直到 `Future` 的结果准备好。
- **`break`**：立即退出循环。
- **`const`**：定义常量项目或常量原始指针。
- **`continue`**：继续下一个循环迭代。
- **`crate`**：在模块路径中，指模块根目录。
- **`dyn`**：对特质对象的动态分派。
- **`else`**：用于 `if` 和 `if let` 控制流结构的回退选项。
- **`enum`**：定义枚举类型。
- **`extern`**：链接外部函数或变量。
- **`false`**：布尔值的假值字面量。
- **`fn`**：定义函数或函数指针类型。
- **`for`**：对迭代器中的项目进行循环，实现特质，或指定更高的生命周期。
- **`if`**：根据条件表达式的结果进行分支选择。
- **`impl`**：实现固有功能或特质功能。
- **`in`**：`for` 循环语法的一部分。
- **`let`**：绑定变量。
- **`loop`**：无条件循环。
- **`match`**：将值与模式匹配。
- **`mod`**：定义模块。
- **`move`**：使闭包拥有其捕获的所有对象的所有权。
- **`mut`**：表示引用、原始指针或模式绑定的可变性。
- **`pub`**：表示结构字段、`impl` 块或模块中的公共可见性。
- **`ref`**：通过引用绑定。
- **`return`**：从函数中返回。
- **`Self`**：我们正在定义或实现的类型的类型别名。
- **`self`**：方法主体或当前模块。
- **`static`**：全局变量或贯穿整个程序执行的生命周期。
- **`struct`**：定义结构体。
- **`super`**：当前模块的父模块。
- **`trait`**：定义特质。
- **`true`**：布尔值的真值字面量。
- **`type`**：定义类型别名或相关类型。
- **`union`**：定义 [联合][union]<!-- ignore -->；仅在联合声明中使用时才是关键字。
- **`unsafe`**：表示不安全的代码、函数、特质或实现。
- **`use`**：将符号引入作用域。
- **`where`**：表示约束类型的条款。
- **`while`**：根据表达式的结果有条件地循环。


### 为未来使用保留的关键字

以下关键字目前没有功能，但 Rust 将其保留以供未来使用：

- `abstract` - `become` - `box` - `do` - `final` - `gen` - `macro` - `override` - `priv` - `try` - `typeof` - `unsized` - `virtual` - `yield`

### 原始标识符

_原始标识符_ 是一种语法，允许你在通常不允许使用的关键字前加上 `r#` 前缀来使用它们。

例如，`match` 是一个关键字。如果你尝试编译以下使用 `match` 作为名称的函数：

<span class="filename">Filename: src/main.rs</span>

```rust,ignore,does_not_compile
fn match(needle: &str, haystack: &str) -> bool {
    haystack.contains(needle)
}
```

你会得到这个错误：

```text
error: expected identifier, found keyword `match`
 --> src/main.rs:4:4
  |
4 | fn match(needle: &str, haystack: &str) -> bool {
  |    ^^^^^ expected identifier, found keyword
```

该错误表明你不能将关键字 `match` 用作函数标识符。要将 `match` 用作函数名，你需要使用原始标识符语法，如下所示：

<span class="filename">Filename: src/main.rs</span>

```rust
fn r#match(needle: &str, haystack: &str) -> bool {
    haystack.contains(needle)
}

fn main() {
    assert!(r#match("foo", "foobar"));
}
```

这段代码可以无错误编译。请注意在定义中函数名称前的 `r#` 前缀，以及在 `main` 函数中调用函数时的用法。

原始标识符允许你使用任何你选择的单词作为标识符，即使该单词是保留关键字。这让我们更有自由选择标识符名称，同时也使我们能够与用这些词不是关键字的语言编写的程序集成。此外，原始标识符还允许你使用与你的 crate 使用的 Rust 版本不同的库。例如，`try` 在 2015 版中不是关键字，但在 2018、2021 和 2024 版中是关键字。如果你依赖一个使用 2015 版编写的库，并且该库有一个 `try` 函数，那么以后版本中从代码中调用该函数时就需要使用原始标识符语法 `r#try`。有关版本的更多信息，请参见 [附录 E][appendix-e]<!-- ignore -->。

[raw-identifiers]: #raw-identifiers
[union]: ../reference/items/unions.html
[appendix-e]: appendix-05-editions.html
