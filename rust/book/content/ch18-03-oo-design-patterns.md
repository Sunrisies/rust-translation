## 实现面向对象设计模式

_状态模式_是一种面向对象设计模式。该模式的精髓在于我们定义了一个值内部可能存在的状态集合。这些状态由一组_状态对象_表示，值的行为会根据其状态发生变化。我们将通过一个博客文章结构示例来说明，该结构有一个用于保存状态的字段，该状态可能是“草稿”、“审核中”或“已发布”中的某个状态对象。

状态对象具有共同的功能：在 Rust 中，我们使用结构体和特质而不是对象和继承。每个状态对象负责自己的行为，并控制何时转换为另一种状态。持有状态对象的值对状态的不同行为或状态转换时机一无所知。

使用状态模式的优势在于，当程序的业务需求发生变化时，我们不需要修改持有状态的代码或使用该值的代码。我们只需要更新其中一个状态对象中的代码以改变其规则，或者添加更多的状态对象。

首先，我们将以更传统的面向对象方式实现状态模式。然后，在 Rust 中采用一种更自然的方法。让我们逐步使用状态模式实现博客文章工作流程。

最终功能将如下所示：

1. 博客文章最初是一个空的草稿。
1. 当草稿完成时，会请求对文章的审核。
1. 当文章被批准后，它会被发布。
1. 只有已发布的博客文章才会返回内容供打印，这样未批准的文章就不会意外地被发布。

对文章进行的任何其他更改都不会产生效果。例如，如果我们试图在请求审核之前批准一个草稿博客文章，该文章应仍保持为未发布的草稿。

<!-- Old headings. Do not remove or links may break. -->

<a id="a-traditional-object-oriented-attempt"></a>

### 尝试传统面向对象风格

解决同一问题有多种不同的代码结构方式，每种方式都有不同的权衡。本节的实现采用传统的面向对象风格，这种风格在 Rust 中也是可以实现的，但未能充分利用 Rust 的一些优势。稍后，我们将展示另一种解决方案，该方案仍使用面向对象设计模式，但其结构对具有面向对象经验的程序员来说可能不太熟悉。我们将对比这两种解决方案，以体验将 Rust 代码设计与其他语言代码不同的权衡。

清单 18-11 以代码形式展示了这一工作流程：这是我们在名为 `blog` 的库 crate 中实现的 API 的一个使用示例。目前无法编译，因为我们还未实现 `blog` crate。

<Listing number="18-11" file-name="src/main.rs" caption="Code that demonstrates the desired behavior we want our `blog` crate to have">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch18-oop/listing-18-11/src/main.rs:all}}
```

</Listing>

我们希望允许用户通过 `Post::new` 创建新的草稿博客文章。同时，我们也希望允许向博客文章添加文本。如果我们在审核前立即获取文章的内容，将不会得到任何文本，因为该文章仍然是草稿状态。为了演示目的，我们在代码中添加了 `assert_eq!`。一个优秀的单元测试应该是确保草稿博客文章在 `content` 方法中返回空字符串，但本例中不编写测试。

接下来，我们希望启用对文章的审核请求功能，并在等待审核期间让 `content` 方法返回空字符串。当文章获得批准时，它应该被发布，也就是说，当调用 `content` 时，文章的文本将被返回。

请注意，我们从该 crate 中交互的唯一类型是 `Post` 类型。此类型将使用状态模式，并保存一个值，该值属于三种状态对象之一，分别表示帖子可能处于草稿、审核中或已发布状态。从一种状态变为另一种状态将在 `Post` 类型内部进行管理。这些状态会根据库用户对 `Post` 实例调用的方法发生变化，但用户无需直接管理状态变化。此外，用户也不会因状态错误而犯错，例如在帖子被审核之前就将其发布。

<!-- Old headings. Do not remove or links may break. -->

<a id="defining-post-and-creating-a-new-instance-in-the-draft-state"></a>

#### 定义 `Post` 并创建新实例

让我们开始实现该库吧！我们知道需要一个公共的 `Post` 结构体来保存内容，因此我们将从结构体的定义和相关的公共 `new` 函数开始，如清单 18-12 所示。我们还将定义一个私有的 `State` trait，用于定义所有 `Post` 状态对象必须具有的行为。

然后，`Post` 将在名为 `state` 的私有字段中保存一个 `Option<T>` 中的 `Box<dyn State>` 特质对象，以存储状态对象。稍后你会明白为什么需要 `Option<T>`。

<Listing number="18-12" file-name="src/lib.rs" caption="Definition of a `Post` struct and a `new` function that creates a new `Post` instance, a `State` trait, and a `Draft` struct">

```rust,noplayground
{{#rustdoc_include ../listings/ch18-oop/listing-18-12/src/lib.rs}}
```

</Listing>

`State` trait 定义了不同帖子状态共享的行为。状态对象分别为 `Draft`、`PendingReview` 和 `Published`，它们都将实现 `State` trait。目前该 trait 没有方法，我们将从定义 `Draft` 状态开始，因为这是我们希望帖子初始处于的状态。

当我们创建新的 `Post` 时，将其 `state` 字段设置为一个包含 `Box` 的 `Some` 值。这个 `Box` 指向一个新的 `Draft` 结构体实例。这确保了每当我们创建新的 `Post` 实例时，它都会以草稿状态开始。由于 `Post` 的 `state` 字段是私有的，因此无法以其他状态创建 `Post`！在 `Post::new` 函数中，我们将 `content` 字段设置为一个新的空 `String`。

#### 存储帖子内容的文本

我们在列表 18-11 中看到，我们希望能够调用名为 `add_text` 的方法，并传递一个 `&str`，然后将其作为博客文章的内容添加进去。我们将此实现为一个方法，而不是将 `content` 字段暴露为 `pub`，这样之后我们可以实现一个方法来控制如何读取 `content` 字段的数据。`add_text` 方法非常直接，因此我们将该实现添加到 `impl Post` 块中，如列表 18-13 所示。

<Listing number="18-13" file-name="src/lib.rs" caption="Implementing the `add_text` method to add text to a post’s `content`">

```rust,noplayground
{{#rustdoc_include ../listings/ch18-oop/listing-18-13/src/lib.rs:here}}
```

</Listing>

`add_text` 方法接受一个可变的 `self` 引用，因为我们在修改调用 `add_text` 的 `Post` 实例。然后我们在 `content` 中的 `String` 上调用 `push_str`，并将 `text` 参数传递给已保存的 `content`。这种行为不依赖于文章的状态，因此不属于状态模式。`add_text` 方法根本不与 `state` 字段交互，但它是我们想要支持的行为的一部分。

<!-- Old headings. Do not remove or links may break. -->

<a id="ensuring-the-content-of-a-draft-post-is-empty"></a>

#### 确保草稿文章的内容为空

即使我们调用了 `add_text` 并向文章添加了内容，我们仍然希望 `content` 方法返回一个空字符串切片，因为文章仍处于草稿状态，正如列表 18-11 中的第一个 `assert_eq!` 所示。目前，我们将使用最简单的方式实现 `content` 方法：始终返回空字符串切片。一旦实现了更改文章状态以使其发布的能力，我们稍后就会修改此行为。目前，文章只能处于草稿状态，因此内容应该始终为空。列表 18-14 展示了这个占位符实现。

<Listing number="18-14" file-name="src/lib.rs" caption="Adding a placeholder implementation for the `content` method on `Post` that always returns an empty string slice">

```rust,noplayground
{{#rustdoc_include ../listings/ch18-oop/listing-18-14/src/lib.rs:here}}
```

</Listing>

通过添加这个 `content` 方法，从列表 18-11 到第一个 `assert_eq!` 的所有操作都按预期工作。

<!-- Old headings. Do not remove or links may break. -->

<a id="requesting-a-review-of-the-post-changes-its-state"></a>
<a id="requesting-a-review-changes-the-posts-state"></a>

#### 请求审核，从而改变文章的状态

接下来，我们需要添加功能以请求对文章的审核，这应该将状态从 `Draft` 更改为 `PendingReview`。列表 18-15 展示了相关代码。

<Listing number="18-15" file-name="src/lib.rs" caption="Implementing `request_review` methods on `Post` and the `State` trait">

```rust,noplayground
{{#rustdoc_include ../listings/ch18-oop/listing-18-15/src/lib.rs:here}}
```

</Listing>

我们为 `Post` 提供了一个名为 `request_review` 的公共方法，该方法接受一个可变的 `self` 引用。然后，我们在 `Post` 当前状态上调用一个内部 `request_review` 方法，该第二个 `request_review` 方法消耗当前状态并返回一个新的状态。

我们将 `request_review` 方法添加到 `State` trait 中；所有实现该 trait 的类型现在都需要实现 `request_review` 方法。注意，该方法的第一参数不是 `self`、`&self` 或 `&mut self`，而是 `self: Box<Self>`。这种语法意味着该方法仅在作用于包含该类型的 `Box` 时有效。这种语法会拥有 `Box<Self>` 的所有权，从而使旧状态失效，使得 `Post` 的状态值能够转换为新状态。

为了消耗旧状态，`request_review` 方法需要拥有状态值的所有权。这时 `Post` 的 `state` 字段中的 `Option` 就派上用场了：我们调用 `take` 方法来从 `state` 字段中取出 `Some` 值，并留下一个 `None`，因为 Rust 不允许在结构体中保留未填充的字段。这样我们就可以将 `state` 值移出 `Post`，而不是仅借用它。然后，我们将该操作的结果设置到 `post` 的 `state` 值上。

我们需要暂时将 `state` 设置为 `None`，而不是直接使用类似 `self.state = self.state.request_review();` 的代码来拥有 `state` 值的所有权。这样就能确保 `Post` 在状态转换为新状态后无法使用旧的状态值。

`Draft` 上的 `request_review` 方法返回一个新的、被装箱的 `PendingReview` 结构体实例，该结构体表示帖子等待审核时的状态。`PendingReview` 结构体也实现了 `request_review` 方法，但不会进行任何转换。相反，它直接返回自身，因为当对已经处于 `PendingReview` 状态的帖子请求审核时，它应该保持在该状态中。

现在我们可以看到状态模式的优势：无论 `Post` 的 `state` 值如何，`request_review` 方法都是相同的。每个状态都负责自己的规则。

我们将保持 `Post` 类中的 `content` 方法不变，返回空字符串切片。现在，`Post` 可以处于 `PendingReview` 状态或 `Draft` 状态，但我们希望在 `PendingReview` 状态下具有相同的行为。列表 18-11 现在适用于第二次 `assert_eq!` 调用之前的情况！

<!-- Old headings. Do not remove or links may break. -->

<a id="adding-the-approve-method-that-changes-the-behavior-of-content"></a>
<a id="adding-approve-to-change-the-behavior-of-content"></a>

#### 为 `Change` 的 `content` 行为添加 `approve` 方法

`approve` 方法与 `request_review` 方法类似：它将把 `state` 设置为当前状态在获得批准时应该具有的值，如列表 18-16 所示。

<Listing number="18-16" file-name="src/lib.rs" caption="Implementing the `approve` method on `Post` and the `State` trait">

```rust,noplayground
{{#rustdoc_include ../listings/ch18-oop/listing-18-16/src/lib.rs:here}}
```

</Listing>

我们在 `State` trait 中添加了 `approve` 方法，并创建了一个实现 `State` 的新的结构体 `Published`。

与 `PendingReview` 上的 `request_review` 工作方式类似，如果我们在 `Draft` 上调用 `approve` 方法，则不会产生任何效果，因为 `approve` 会返回自身。当我们在 `PendingReview` 上调用 `approve` 时，它会返回一个新的、包装好的 `Published` 结构体实例。`Published` 结构体实现了 `State` trait，对于 `request_review` 方法和 `approve` 方法，它都返回自身，因为在这些情况下帖子应保持在 `Published` 状态。

现在我们需要更新 `Post` 类中的 `content` 方法。我们希望从 `content` 返回的值依赖于 `Post` 当前的状态，因此我们将让 `Post` 委托给其 `state` 上定义的 `content` 方法，如列表 18-17 所示。

<Listing number="18-17" file-name="src/lib.rs" caption="Updating the `content` method on `Post` to delegate to a `content` method on `State`">

```rust,ignore,does_not_compile
{{#rustdoc_include ../listings/ch18-oop/listing-18-17/src/lib.rs:here}}
```

</Listing>

因为目标是将所有这些规则放在实现 `State` 的结构体内部，我们在 `state` 中的值上调用 `content` 方法，并将 `Post` 实例（即 `self`）作为参数传递。然后，我们返回在 `state` 值上使用 `content` 方法所返回的值。

我们对 `Option` 调用 `as_ref` 方法，因为我们希望获得 `Option` 内部值的引用，而不是拥有权。由于 `state` 是 `Option<Box<dyn State>>`，当我们调用 `as_ref` 时，会返回一个 `Option<&Box<dyn State>>`。如果我们不调用 `as_ref`，就会出错，因为无法将 `state` 从函数参数中的借用 `&self` 中移出。

然后我们调用 `unwrap` 方法，我们知道它永远不会引发恐慌，因为我们知道 `Post` 上的方法确保当这些方法执行完成时，`state` 总是包含 `Some` 值。这是我们在第9章的“当你拥有比编译器更多的信息时”部分讨论的情况之一，当时我们知道 `None` 值是不可能出现的，尽管编译器无法理解这一点。

此时，当我们对 `&Box<dyn State>` 调用 `content` 方法时，deref 强制转换会在 `&` 和 `Box` 上生效，从而使 `content` 方法最终在实现 `State` trait 的类型上被调用。这意味着我们需要将 `content` 添加到 `State` trait 定义中，并且我们将在此处添加根据当前状态返回内容的逻辑，如清单18-18所示。

<Listing number="18-18" file-name="src/lib.rs" caption="Adding the `content` method to the `State` trait">

```rust,noplayground
{{#rustdoc_include ../listings/ch18-oop/listing-18-18/src/lib.rs:here}}
```

</Listing>

我们为 `content` 方法添加了默认实现，该实现返回一个空字符串切片。这意味着我们不需要在 `Draft` 和 `PendingReview` 结构体上实现 `content` 方法。`Published` 结构体将覆盖 `content` 方法，并返回 `post.content` 中的值。虽然方便，但让 `State` 上的 `content` 方法决定 `Post` 的内容会模糊了 `State` 与 `Post` 的责任边界。

请注意，正如我们在第10章中讨论的，此方法需要生命周期注解。我们将一个 `post` 的引用作为参数，并返回该 `post` 的一部分的引用，因此返回的引用的生命周期与 `post` 参数的生命周期相关。

就这样——所有清单18-11的内容现在都正常工作了！我们已经根据博客文章工作流程的规则实现了状态模式。与规则相关的逻辑存在于状态对象中，而不是分散在 `Post` 中。

> ### 为什么不使用枚举？
>
> 你可能想知道为什么我们没有使用枚举来作为不同的状态变体。这确实是一个可行的解决方案；尝试使用它，并比较最终效果以选择你更喜欢的方案！使用枚举的一个缺点是，在检查枚举值的所有地方都需要使用 `match` 表达式或类似机制来处理所有可能的变体。这可能会比使用 trait object 解决方案更加重复。

<!-- Old headings. Do not remove or links may break. -->

<a id="trade-offs-of-the-state-pattern"></a>

#### 评估状态模式

我们已经证明，Rust能够实现面向对象的状态模式，以封装帖子在不同状态下应具有的各种行为。`Post` 类中的方法对各种行为一无所知。由于我们的代码组织方式，我们只需在 `Published` 结构上的 `State` trait 实现中查看即可了解发布后的帖子如何表现。

如果我们创建一个不使用状态模式的替代实现，可能需要在 `Post` 类的方法中甚至使用 `main` 代码中添加 `match` 表达式来检查帖子的状态并改变行为。这意味着我们必须在多个地方查看，才能理解帖子处于发布状态的所有影响。

使用状态模式后，`Post` 类的方法和我们使用 `Post` 的地方不需要 `match` 表达式。要添加新状态，只需新增一个结构体并在一个位置实现该结构体上的 trait 方法即可。

使用状态模式的实现很容易扩展以添加更多功能。为了体验维护状态模式代码的简洁性，可以尝试以下建议： - 添加 `reject` 方法，将帖子的状态从 `PendingReview` 切换回 `Draft`。 - 要求在状态变为 `Published` 之前进行两次 `approve` 调用。 - 允许用户在帖子处于 `Draft` 状态时才添加文本内容。提示：让状态对象负责内容可能的变化，但不负责修改 `Post`。

- 添加 `reject` 方法，将帖子状态从 `PendingReview` 切换回 `Draft`。
- 在状态变为 `Published` 之前，需要调用两次 `approve`。
- 仅当帖子处于 `Draft` 状态时，允许用户添加文本内容。提示：状态对象负责内容可能发生的变化，但不负责修改 `Post` 本身。

状态模式的一个缺点是，由于各个状态实现了彼此之间的转换，因此某些状态之间存在耦合。如果我们在 `PendingReview` 和 `Published` 之间添加另一个状态，比如 `Scheduled`，那么我们就必须修改 `PendingReview` 中的代码以转换为 `Scheduled`。如果 `PendingReview` 不需要因新增状态而更改，那么工作会少一些，但这意味着需要转向另一种设计模式。

另一个缺点是某些逻辑被重复了。为了消除部分重复，我们可能会尝试为 `State` trait 上的 `request_review` 和 `approve` 方法定义默认实现，使其返回 `self`。然而，这行不通：当将 `State` 作为特质对象使用时，该特质不知道具体的 `self` 会是什么，因此返回类型在编译时无法确定。（这是之前提到的动态兼容性规则之一。）

其他重复包括 `Post` 上 `request_review` 和 `approve` 方法的类似实现。这两个方法都使用 `Option::take` 与 `Post` 的 `state` 字段，如果 `state` 是 `Some`，则委托给包装值的相同方法实现，并将新的 `state` 字段值设置为结果。如果 `Post` 上有很多遵循此模式的方法，我们可能会考虑定义宏来消除重复（参见第20章中的“宏”部分）。

通过按照面向对象语言的定义来实现状态模式，我们没有充分利用 Rust 的优势。让我们看看可以对 `blog` crate 进行的一些修改，这些修改可以将无效的状态和转换转化为编译时错误。

### 将状态和行为编码为类型

我们将向您展示如何重新思考状态模式，以获得不同的权衡。与其完全封装状态和转换，使得外部代码无法知晓它们，我们不如将状态编码到不同类型的对象中。因此，Rust的类型检查系统会阻止使用仅允许已发布文章的新草稿文章的尝试，并引发编译器错误。

让我们考虑清单 18-11 中 `main` 函数的第一部分：

<Listing file-name="src/main.rs">

```rust,ignore
{{#rustdoc_include ../listings/ch18-oop/listing-18-11/src/main.rs:here}}
```

</Listing>

我们仍然允许在草稿状态下使用 `Post::new` 创建新文章，并且可以向文章内容中添加文本。但是，我们不会在草稿文章上添加返回空字符串的 `content` 方法，而是让草稿文章根本没有 `content` 方法。这样，如果我们尝试获取草稿文章的内容，将会引发编译器错误，提示该方法不存在。因此，我们在生产环境中无法意外显示草稿文章的内容，因为该代码甚至无法编译。清单 18-19 展示了 `Post` 结构体、`DraftPost` 结构体及其各自的方法定义。

<Listing number="18-19" file-name="src/lib.rs" caption="A `Post` with a `content` method and a `DraftPost` without a `content` method">

```rust,noplayground
{{#rustdoc_include ../listings/ch18-oop/listing-18-19/src/lib.rs}}
```

</Listing>

`Post` 和 `DraftPost` 结构体都有一个私有的 `content` 字段，用于存储博客文章文本。这两个结构体不再有 `state` 字段，因为我们把状态的编码移到了结构体的类型中。`Post` 结构体表示已发布的文章，它有一个返回 `content` 的 `content` 方法。

我们仍然有 `Post::new` 函数，但它返回的不是 `Post` 实例，而是 `DraftPost` 实例。由于 `content` 是私有的，而且没有返回 `Post` 的函数，目前无法创建 `Post` 实例。

`DraftPost` 结构体有一个 `add_text` 方法，因此我们可以像以前一样向 `content` 添加文本，但请注意，`DraftPost` 并没有定义 `content` 方法！所以现在程序确保所有文章最初都是草稿状态，并且草稿文章的内容无法显示。任何试图绕过这些限制的尝试都会引发编译器错误。

<!-- Old headings. Do not remove or links may break. -->

<a id="implementing-transitions-as-transformations-into-different-types"></a>

那么，我们如何发布文章呢？我们希望强制执行一个规则：草稿文章在发布前必须经过审核并获得批准。处于待审核状态的文章仍不应显示任何内容。我们可以通过添加另一个结构体 `PendingReviewPost`，并在 `DraftPost` 上定义 `request_review` 方法以返回 `PendingReviewPost`，同时定义 `approve` 方法以返回 `Post`，如清单 18-20 所示，来实现这些约束。

<Listing number="18-20" file-name="src/lib.rs" caption="A `PendingReviewPost` that gets created by calling `request_review` on `DraftPost` and an `approve` method that turns a `PendingReviewPost` into a published `Post`">

```rust,noplayground
{{#rustdoc_include ../listings/ch18-oop/listing-18-20/src/lib.rs:here}}
```

</Listing>

`request_review` 和 `approve` 方法会拥有 `self` 的所有权，从而消耗掉 `DraftPost` 和 `PendingReviewPost` 实例，分别将其转换为 `PendingReviewPost` 和已发布的 `Post`。这样，在调用 `request_review` 之后就不会有剩余的 `DraftPost` 实例了。由于 `PendingReviewPost` 结构体没有定义 `content` 方法，尝试读取其内容会导致编译器错误，就像 `DraftPost` 一样。因为获取具有 `content` 方法的已发布 `Post` 实例的唯一方式是对 `PendingReviewPost` 调用 `approve` 方法，而获取 `PendingReviewPost` 的唯一方式是对 `DraftPost` 调用 `request_review` 方法，因此我们现在将博客文章的工作流程编码到了类型系统中。

但我们还必须对 `main` 进行一些小的修改。`request_review` 和 `approve` 方法返回新的实例，而不是修改被调用的结构体，因此我们需要添加更多的 `let post =` 遮蔽赋值来保存返回的实例。我们也不需要关于草稿和待审核文章内容为空字符串的断言，因为我们无法再编译尝试使用这些状态下文章内容的代码了。更新后的 `main` 代码如清单 18-21 所示。

<Listing number="18-21" file-name="src/main.rs" caption="Modifications to `main` to use the new implementation of the blog post workflow">

```rust,ignore
{{#rustdoc_include ../listings/ch18-oop/listing-18-21/src/main.rs}}
```

</Listing>

我们在 `main` 函数中进行的更改以重新分配 `post`，这意味着这种实现不再完全遵循面向对象状态模式：各状态之间的转换不再完全被封装在 `Post` 实现中。然而，我们的好处在于由于类型系统和编译时类型检查，无效状态现在变得不可能出现！这确保了某些错误，例如未发布文章的内容显示问题，能够在进入生产环境之前被发现。

尝试按照本节开头对 `blog` crate 的建议任务进行实践，就像清单 18-21 中那样，以了解你对这个版本代码设计的看法。请注意，有些任务可能在这个设计中已经完成。

我们已经看到，尽管 Rust 能够实现面向对象设计模式，其他模式，如将状态编码到类型系统中，在 Rust 中也是可用的。这些模式有不同的权衡。虽然你可能非常熟悉面向对象模式，但重新思考问题并利用 Rust 的特性可以带来好处，例如在编译时预防某些错误。由于某些特性，如所有权，面向对象语言没有，面向对象模式并不总是 Rust 的最佳解决方案。

## 总结

无论你读完这一章后认为 Rust 是一种面向对象语言还是不是，你现在知道可以使用特质对象来在 Rust 中获得一些面向对象特性。动态调度可以在运行时性能方面带来一定牺牲的情况下，为你的代码提供灵活性。你可以利用这种灵活性来实现有助于代码可维护性的面向对象模式。Rust 还有其他特性，如所有权，这些是面向对象语言所没有的。虽然面向对象模式并不总是利用 Rust 优势的最佳方式，但它是一个可行的选择。

接下来，我们将探讨模式，这是 Rust 的另一个特性，能够提供极大的灵活性。我们在书中简要介绍了它们，但尚未看到它们的全部功能。让我们开始吧！

[more-info-than-rustc]: ch09-03-to-panic-or-not-to-panic.html#cases-in-which-you-have-more-information-than-the-compiler
[macros]: ch20-05-macros.html#macros
