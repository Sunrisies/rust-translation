## 使用 `Drop` trait在清理时运行代码

智能指针模式中第二个重要的特性是 `Drop`，它允许你自定义当值即将超出作用域时发生的操作。你可以为任何类型实现 `Drop` trait，该代码可用于释放文件或网络连接等资源。

我们在智能指针的上下文中引入 `Drop`，因为 `Drop` trait的功能几乎总是在实现智能指针时被使用。例如，当 `Box<T>` 被丢弃时，它会释放堆上该盒子所指向的空间。

在某些语言中，对于某些类型，程序员必须在使用这些类型的实例结束后调用代码来释放内存或资源。例子包括文件句柄、套接字和锁。如果程序员忘记这样做，系统可能会过载并崩溃。在 Rust 中，你可以指定当值超出作用域时运行特定代码，编译器会自动插入此代码。因此，你无需担心在特定类型实例被使用完毕后程序中到处都需要放置清理代码——这样仍然不会导致资源泄漏！

你通过实现 `Drop` trait来指定当值超出作用域时要运行的代码。`Drop` trait要求你实现一个名为 `drop` 的方法，该方法接受对 `self` 的可变引用。为了了解 Rust 何时调用 `drop`，让我们暂时用 `println!` 语句来实现 `drop`。

列表 15-14 展示了一个 `CustomSmartPointer` 结构体，其唯一的自定义功能是在实例超出作用域时打印 `Dropping CustomSmartPointer!`，以显示 Rust 何时运行 `drop` 方法。

<Listing number="15-14" file-name="src/main.rs" caption="A `CustomSmartPointer` struct that implements the `Drop` trait where we would put our cleanup code">

```rust
{{#rustdoc_include ../listings/ch15-smart-pointers/listing-15-14/src/main.rs}}
```

</Listing>

`Drop` 特性被包含在预定义中，因此无需将其引入作用域。我们在 `CustomSmartPointer` 上实现 `Drop` 特性，并为 `drop` 方法提供实现，该实现调用 `println!`。`drop` 方法的主体用于放置当类型实例超出作用域时需要执行的任何逻辑。我们在这里打印一些文本，以直观地展示 Rust 何时会调用 `drop`。

在 `main` 函数中，我们创建了两个 `CustomSmartPointer` 实例，然后打印 “CustomSmartPointers created”。在 `main` 函数结束时，`CustomSmartPointer` 实例将超出作用域，Rust 将调用我们在 `drop` 方法中编写的代码，并输出最终消息。注意，我们不需要显式调用 `drop` 方法。

运行此程序时，我们将看到以下输出：

```console
{{#include ../listings/ch15-smart-pointers/listing-15-14/output.txt}}
```

当实例超出作用域时，Rust 会自动调用 `drop` 方法，执行我们指定的代码。变量按照创建顺序的相反顺序被清理，因此 `d` 在 `c` 之前被清理。本例的目的是提供一个直观的示例，说明 `drop` 方法的工作原理；通常你会指定类型需要执行的清理代码，而不是打印消息。

<!-- Old headings. Do not remove or links may break. -->

<a id="dropping-a-value-early-with-std-mem-drop"></a>

不幸的是，禁用自动 `drop` 功能并不简单。通常不需要禁用 `drop`；`Drop` 特性的意义就在于其会自动处理。然而，偶尔你可能希望提前清理某个值。一个例子是使用管理锁的智能指针时：你可能希望强制调用释放锁的 `drop` 方法，以便同一作用域中的其他代码能够获取锁。Rust 不允许手动调用 `Drop` 特性的 `drop` 方法；如果你希望在实例结束前强制清理值，则必须调用标准库提供的 `std::mem::drop` 函数。

如列表 15-15 所示，尝试通过修改列表 15-14 中的 `main` 函数来手动调用 `Drop` 特性的 `drop` 方法是无效的。

<Listing number="15-15" file-name="src/main.rs" caption="Attempting to call the `drop` method from the `Drop` trait manually to clean up early">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch15-smart-pointers/listing-15-15/src/main.rs:here}}
```

</Listing>

当我们尝试编译此代码时，我们会得到以下错误：

```console
{{#include ../listings/ch15-smart-pointers/listing-15-15/output.txt}}
```

此错误消息表明我们不允许显式调用 `drop` 函数。错误消息中使用了 _destructor_ 这一术语，这是编程中用于描述清理实例的函数的一般术语。_destructor_ 类似于 _constructor_，后者用于创建实例。Rust 中的 `drop` 函数就是一种特定的 _destructor_。

Rust 不允许我们显式调用 `drop` 函数，因为 Rust 会在 `main` 函数的末尾自动调用 `drop` 函数。这会导致双重释放错误，因为 Rust 会尝试两次清理同一个值。

我们无法禁用当变量超出作用域时自动插入的 `drop` 操作，也无法显式调用 `drop` 方法。因此，如果我们需要强制提前清理某个值，就会使用 `std::mem::drop` 函数。

`std::mem::drop` 函数与 `Drop` trait 中的 `drop` 方法不同。我们通过传递要强制释放的值作为参数来调用它。该函数位于 prelude 中，因此我们可以在清单 15-15 中修改 `main` 以调用 `drop` 函数，如清单 15-16 所示。

<Listing number="15-16" file-name="src/main.rs" caption="Calling `std::mem::drop` to explicitly drop a value before it goes out of scope">

```rust
{{#rustdoc_include ../listings/ch15-smart-pointers/listing-15-16/src/main.rs:here}}
```

</Listing>

运行此代码将输出以下内容：

```console
{{#include ../listings/ch15-smart-pointers/listing-15-16/output.txt}}
```

文本 ``正在释放包含数据 `some data` 的 CustomSmartPointer！`` 会在 ``CustomSmartPointer created`` 和 ``CustomSmartPointer dropped before the end of main`` 之间显示，表明此时调用了 `drop` 方法以清理 `c`。

你可以以多种方式使用 `Drop` trait 实现中指定的代码，使清理过程既方便又安全：例如，你可以用它来创建自己的内存分配器！借助 `Drop` trait 和 Rust 的所有权系统，你无需记得清理，因为 Rust 会自动完成此操作。

你也不必担心因意外清理仍被使用的变量而产生的问题：确保引用始终有效的所有权系统也保证了当值不再被使用时，`drop` 只会被调用一次。

现在我们已经了解了 `Box<T>` 和智能指针的一些特性，接下来让我们看看标准库中定义的其他几种智能指针。
