## `RefCell<T>` 与内部可变性模式

_内部可变性_是Rust中的一种设计模式，它允许在存在不可变引用时修改数据；通常，这种操作会被借用规则所禁止。为了修改数据，该模式会在数据结构中使用 `unsafe` 代码来打破Rust关于修改和借用的常规规则。`unsafe` 代码向编译器表明我们手动检查这些规则，而不是依赖编译器来检查它们；我们将在第20章中进一步讨论 `unsafe` 代码。

我们只能使用遵循内部可变性模式的类型，当我们能够确保在运行时遵守借用规则时，即使编译器无法保证这一点。涉及的 `unsafe` 代码会被封装在一个安全的API中，而外部类型仍然保持不可变状态。

让我们通过查看遵循内部可变性模式的 `RefCell<T>` 类型来探索这一概念。

<!-- Old headings. Do not remove or links may break. -->

<a id="enforcing-borrowing-rules-at-runtime-with-refcellt"></a>

### 在运行时强制执行借用规则

与 `Rc<T>` 不同，`RefCell<T>` 类型表示对其所持有数据的单一所有权。那么，为什么 `RefCell<T>` 与 `Box<T>` 这样的类型不同呢？请回忆你在第4章中学到的借用规则：

- 在任何时候，你可以有一个_或多个_可变引用或任意数量的不可变引用（但不能同时拥有两者）。
- 引用必须始终有效。

对于引用和 `Box<T>`，借用规则的不变量在编译时被强制执行。而对于 `RefCell<T》，这些不变量在运行时被强制执行。对于引用，如果你违反这些规则，会收到编译器错误。对于 `RefCell<T>，如果你违反这些规则，程序会崩溃并退出。

在编译时检查借用规则的优点在于，错误可以在开发过程中更早地被发现，并且由于所有分析都在之前完成，因此不会影响运行时性能。基于这些原因，在大多数情况下，在编译时检查借用规则是最佳选择，这也是Rust的默认行为。

在运行时检查借用规则的优势在于，某些内存安全场景得以允许，而这些场景在编译时检查下则会被禁止。像 Rust 编译器这样的静态分析工具本质上具有保守性。有些代码属性无法通过分析代码来检测：最著名的例子就是停机问题，这超出了本书的范围，但是一个值得研究的有趣话题。

由于某些分析是不可能的，如果 Rust 编译器无法确保代码符合所有权规则，它可能会拒绝一个正确的程序；通过这种方式，它显得很保守。如果 Rust 接受了一个错误的程序，用户将无法信任 Rust 所提供的保证。然而，如果 Rust 拒绝了一个正确的程序，程序员会感到不便，但不会发生灾难性后果。`RefCell<T>` 类型在您确定代码遵循借用规则但编译器无法理解和保证这一点时非常有用。

与 `Rc<T>` 类似，`RefCell<T>` 仅适用于单线程场景，如果您尝试在多线程环境中使用它，将会产生编译时错误。我们将在第 16 章讨论如何在多线程程序中实现 `RefCell<T>` 的功能。

以下是选择 `Box<T}`、`Rc<T}` 或 `RefCell<T}` 的原因总结：

- `Rc<T}` 允许同一数据拥有多个所有者；`Box<T}` 和 `RefCell<T}` 只有单个所有者。
- `Box<T}` 允许在编译时检查不可变或可变借用；`Rc<T}` 仅允许在编译时检查不可变借用；`RefCell<T}` 允许在运行时检查不可变或可变借用。
- 由于 `RefCell<T}` 允许在运行时检查可变借用，即使 `RefCell<T>` 是不可变的，您也可以修改其中的值。

在不可变值内部进行修改就是内部可变性模式。让我们来看一个内部可变性有用的场景，并探讨其实现方式。

<!-- Old headings. Do not remove or links may break. -->

<a id="interior-mutability-a-mutable-borrow-to-an-immutable-value"></a>

### 使用内部可变性

借用规则的一个结果是：当你有一个不可变值时，你不能以可修改的方式借用它。例如，以下代码无法编译：

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch15-smart-pointers/no-listing-01-cant-borrow-immutable-as-mutable/src/main.rs}}
```

如果你尝试编译此代码，将会出现以下错误：

```console
{{#include ../listings/ch15-smart-pointers/no-listing-01-cant-borrow-immutable-as-mutable/output.txt}}
```

然而，在某些情况下，一个值在自身方法中可以修改自身，但对其他代码来说却看起来是不可变的。位于该值方法之外的代码将无法修改该值。使用 `RefCell<T>` 是一种实现内部可修改性的方法，但 `RefCell<T>` 并不能完全解决借用规则问题：编译器的借用检查器允许这种内部可修改性，而借用规则则是在运行时进行检查的。如果你违反这些规则，将会出现 `panic!` 错误，而不是编译器报错。

让我们通过一个实际示例来说明如何使用 `RefCell<T>` 修改不可变值，以及为什么这样做很有用。

<!-- Old headings. Do not remove or links may break. -->

<a id="a-use-case-for-interior-mutability-mock-objects"></a>

#### 使用模拟对象进行测试

在测试过程中，程序员有时会使用一种类型替代另一种类型，以便观察特定行为并验证其是否正确实现。这种占位类型被称为 _测试替身_。可以把它想象成电影中的替身演员，即一个人代替演员出演特别复杂的场景。当我们运行测试时，测试替身会替代其他类型。_模拟对象_是一种特定的测试替身类型，它记录测试过程中的情况，从而让你能够断言正确的操作已经发生。

Rust 并不像其他语言那样拥有对象，而且 Rust 的标准库也没有像某些其他语言那样内置模拟对象功能。不过，你完全可以创建一个结构体来替代模拟对象的功能。

以下是我们将要测试的场景：我们将创建一个库，该库会跟踪一个值与最大值之间的差距，并根据当前值与最大值的接近程度发送消息。例如，这个库可以用来记录用户允许进行的 API 调用次数配额。

我们的库仅提供功能，用于跟踪某个值距离最大值有多近以及在特定时间应发送哪些消息。使用我们库的应用程序需要提供发送消息的机制：应用程序可以直接向用户显示消息、发送电子邮件、发送短信或执行其他操作。库无需了解这些细节，它只需要一个实现了我们提供的名为 `Messenger` 的 trait 的对象即可。列表 15-20 展示了库代码。

<Listing number="15-20" file-name="src/lib.rs" caption="A library to keep track of how close a value is to a maximum value and warn when the value is at certain levels">

```rust,noplayground
{{#rustdoc_include ../listings/ch15-smart-pointers/listing-15-20/src/lib.rs}}
```

</Listing>

该代码的一个重要部分是 `Messenger` trait 有一个名为 `send` 的方法，该方法接受对 `self` 的不可变引用和消息文本。这个 trait 是我们的模拟对象需要实现的接口，以便以与真实对象相同的方式使用模拟对象。另一个重要部分是我们希望测试 `LimitTracker` 上 `set_value` 方法的行为。我们可以改变传递给 `value` 参数的内容，但 `set_value` 不返回任何内容供我们断言。我们希望能够判断，如果创建一个实现了 `Messenger` trait 的 `LimitTracker`，并指定一个特定的 `max` 值，当传递不同的 `value` 值时，消息器会被指示发送相应的消息。

我们需要一个模拟对象，在调用 `send` 时不发送电子邮件或短信，而只记录被指示要发送的消息。我们可以创建新的模拟对象实例，创建一个使用该模拟对象的 `LimitTracker`，调用 `LimitTracker` 上的 `set_value` 方法，然后检查模拟对象是否包含我们期望的消息。列表 15-21 展示了尝试实现这样一个模拟对象的尝试，但借用检查器不允许这样做。

<Listing number="15-21" file-name="src/lib.rs" caption="An attempt to implement a `MockMessenger` that isn’t allowed by the borrow checker">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch15-smart-pointers/listing-15-21/src/lib.rs:here}}
```

</Listing>

此测试代码定义了一个 `MockMessenger` 结构体，该结构包含一个 `sent_messages` 字段，其中包含一组 `String` 值，用于记录它被要求发送的消息。我们还定义了一个关联函数 `new`，以便方便地创建初始消息列表为空的新的 `MockMessenger` 实例。随后我们为 `MockMessenger` 实现了 `Messenger` trait，这样就可以将 `MockMessenger` 传递给 `LimitTracker`。在 `send` 方法的定义中，我们将作为参数传入的消息存储在 `MockMessenger` 的 `sent_messages` 列表中。

在测试中，我们检验当 `LimitTracker` 被指示将 `value` 设置为超过 `max` 值 75% 的值时会发生什么。首先，我们创建一个新的 `MockMessenger`，其初始消息列表为空。然后，我们创建一个新的 `LimitTracker`，并为其提供对新 `MockMessenger` 的引用以及 `max` 值为 100。我们调用 `LimitTracker` 的 `set_value` 方法，传入值 80，这超过了 100 的 75%。接着，我们断言 `MockMessenger` 所跟踪的消息列表现在应包含一个消息。

然而，此测试存在一个问题，如下所示：

```console
{{#include ../listings/ch15-smart-pointers/listing-15-21/output.txt}}
```

我们无法修改 `MockMessenger` 以跟踪消息，因为 `send` 方法使用的是不可变的 `self` 引用。我们也无法从错误文本中得出在 `impl` 方法和 trait 定义中使用 `&mut self` 的建议。我们不想为了测试而更改 `Messenger` trait。相反，我们需要找到一种方法使我们的测试代码能够与现有设计正确运行。

在这种情况下，内部可变性可以提供帮助！我们将 `sent_messages` 存储在 `RefCell<T>` 中，这样 `send` 方法就可以修改 `sent_messages` 以保存我们看到的消息。图 15-22 展示了其实现方式。

<Listing number="15-22" file-name="src/lib.rs" caption="Using `RefCell<T>` to mutate an inner value while the outer value is considered immutable">

```rust,noplayground
{{#rustdoc_include ../listings/ch15-smart-pointers/listing-15-22/src/lib.rs:here}}
```

</Listing>

现在，`sent_messages` 字段的类型变为 `RefCell<Vec<String>>`，而不是 `Vec<String>`。在 `new` 函数中，我们在空向量周围创建一个新的 `RefCell<Vec<String>>` 实例。

对于 `send` 方法的实现，第一个参数仍然是 `self` 的不可变借用，这与特质定义一致。我们在 `self.sent_messages` 中对 `RefCell<Vec<String>>` 调用 `borrow_mut`，从而获得对 `RefCell<Vec<String>>` 内部值的可变引用，即向量。然后，我们可以对这个向量的可变引用调用 `push` 方法，以记录测试过程中发送的消息数量。

我们需要做的最后一项修改是在断言中：为了查看内部向量中有多少项，我们在 `RefCell<Vec<String>>` 上调用 `borrow`，从而获得对向量的不可变引用。

现在你已经了解了如何使用 `RefCell<T>`，让我们深入探究它的工作原理！

<!-- Old headings. Do not remove or links may break. -->

<a id="keeping-track-of-borrows-at-runtime-with-refcellt"></a>

#### 运行时跟踪借用

在创建不可变和可变引用时，我们分别使用 `&` 和 `&mut` 语法。对于 `RefCell<T>，我们使用 `borrow` 和 `borrow_mut` 方法，这些方法是属于 `RefCell<T>` 的安全 API 的一部分。`borrow` 方法返回智能指针类型 `Ref<T)`，而 `borrow_mut` 返回智能指针类型 `RefMut<T]`。这两种类型都实现了 `Deref`，因此我们可以像对待普通引用一样对待它们。

`RefCell<T>` 会记录当前有多少个 `Ref<T>` 和 `RefMut<T>` 智能指针处于活动状态。每次调用 `borrow` 时，`RefCell<T>` 都会增加不可变借用活动的数量。当 `Ref<T>` 值超出作用域时，不可变借用的数量就会减少 1。就像编译时的借用规则一样，`RefCell<T>` 允许我们在任何时候拥有多个不可变借用或一个可变借用。

如果我们试图违反这些规则，与引用不同，不是会收到编译器错误，而是 `RefCell<T>` 的实现会在运行时引发恐慌。列表 15-23 展示了列表 15-22 中 `send` 实现的修改。我们故意尝试为同一作用域创建两个可变借用，以说明 `RefCell<T>` 在运行时阻止了这种操作。

<Listing number="15-23" file-name="src/lib.rs" caption="Creating two mutable references in the same scope to see that `RefCell<T>` will panic">

```rust,ignore,panics
{{#rustdoc_include ../listings/ch15-smart-pointers/listing-15-23/src/lib.rs:here}}
```

</Listing>

我们为从 `borrow_mut` 返回的 `RefMut<T>` 智能指针创建了一个变量 `one_borrow`。然后，以相同的方式在变量 `two_borrow` 中创建另一个可修改的借用。这导致在同一个作用域中出现了两个可修改的引用，这是不允许的。当我们运行库中的测试时，列表 15-23 中的代码可以编译无错误，但测试会失败：

```console
{{#include ../listings/ch15-smart-pointers/listing-15-23/output.txt}}
```

请注意，代码因 `already borrowed: BorrowMutError` 消息而崩溃。这就是 `RefCell<T>` 在运行时处理借用规则违反情况的方式。

选择在运行时而不是编译时捕获借用错误，就像我们在这里所做的那样，意味着你可能在开发过程的后期发现代码中的错误：可能直到你的代码部署到生产环境之前都不会发现。此外，由于需要在运行时而不是编译时跟踪借用，你的代码会在运行时性能上产生轻微的损耗。然而，使用 `RefCell<T>` 使得可以创建一个模拟对象，该对象可以修改自身以记录它看到的消息，而你在只允许不可变值的上下文中使用它时也能实现这一点。尽管存在这些权衡，你仍然可以使用 `RefCell<T]`来获得比普通引用更多的功能。

<!-- Old headings. Do not remove or links may break. -->

<a id="having-multiple-owners-of-mutable-data-by-combining-rc-t-and-ref-cell-t"></a>
<a id="allowing-multiple-owners-of-mutable-data-with-rct-and-refcellt"></a>

### 允许多个所有者对可变数据拥有权

使用 `RefCell<T>` 的常见方式是与 `Rc<T>` 结合使用。回想一下，`Rc<T>` 允许某些数据的多个所有者，但它只提供不可变的访问权限。如果你有一个持有 `RefCell<T>` 的 `Rc<T)`，你可以获取一个可以有多个所有者并且可以被修改的值！

例如，回想列表 15-18 中的 cons 列表示例，我们使用 `Rc<T]`来允许多个列表共享另一个列表的所有权。因为 `Rc<T}` 只持有不可变值，一旦创建了这些值，我们就无法更改列表中的任何值了。让我们加入 `RefCell<T]`，因为它能够修改列表中的值。列表 15-24 显示，通过在 `Cons` 定义中使用 `RefCell<T]`，我们可以修改所有列表中存储的值。

<Listing number="15-24" file-name="src/main.rs" caption="Using `Rc<RefCell<i32>>` to create a `List` that we can mutate">

```rust
{{#rustdoc_include ../listings/ch15-smart-pointers/listing-15-24/src/main.rs}}
```

</Listing>

我们创建一个属于 `Rc<RefCell<i32>>` 实例的值，并将其存储在名为 `value` 的变量中，以便稍后直接访问它。然后，我们在 `a` 中创建一个包含 `value` 的 `Cons` 变体的 `List`。我们需要克隆 `value`，这样 `a` 和 `value` 都拥有内部 `5` 值的所有权，而不是将所有权从 `value` 转移到 `a`，或者让 `a` 从 `value` 借用数据。

我们将列表 `a` 包装在 `Rc<T>` 中，这样当我们创建列表 `b` 和 `c` 时，它们都可以指向 `a`，正如我们在清单 15-18 中所做的那样。

在创建了 `a`、`b` 和 `c` 的列表之后，我们希望将 `value` 中的值增加 10。我们通过调用 `value` 的 `borrow_mut` 方法来实现这一点，该方法利用我们在第 5 章中讨论的自动解引用特性，将 `Rc<T>` 解引用为内部 `RefCell<T>` 值。`borrow_mut` 方法返回一个 `RefMut<T>` 智能指针，我们对其使用解引用运算符并修改内部值。

当我们在 `a`、`b` 和 `c` 上打印时，可以看到它们都拥有了修改后的值 `15`，而不是原来的 `5`：

```console
{{#include ../listings/ch15-smart-pointers/listing-15-24/output.txt}}
```

这种技术非常巧妙！通过使用 `RefCell<T)`，我们有一个对外不可变的 `List` 值。但我们可以使用 `RefCell<T>` 上的方法来访问其内部的可变性，以便在需要时修改数据。运行时对借用规则的检查可以保护我们免受数据竞争，有时为了这种数据结构中的灵活性而牺牲一点速度也是值得的。请注意，`RefCell<T>` 不适用于多线程代码！`Mutex<T>` 是 `RefCell<T>` 的线程安全版本，我们将在第 16 章中讨论 `Mutex<T>`。

[wheres-the---operator]: ch05-03-method-syntax.html#wheres-the---operator
