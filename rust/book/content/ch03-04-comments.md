## 注释

所有程序员都致力于让代码易于理解，但有时额外的解释也是必要的。在这种情况下，程序员会在源代码中留下_注释_，编译器会忽略这些注释，但阅读代码的人可能会发现它们很有用。

这是一个简单的注释示例：

```rust
// hello, world
```

在 Rust 中，典型的注释风格是以两个斜杠开始注释，然后继续写至行尾。对于超过一行的注释，需要在每一行前加上 `//`，如下所示：

```rust
// So we're doing something complicated here, long enough that we need
// multiple lines of comments to do it! Whew! Hopefully, this comment will
// explain what's going on.
```

注释也可以放在包含代码的行末尾：

<span class="filename">Filename: src/main.rs</span>

```rust
{{#rustdoc_include ../listings/ch03-common-programming-concepts/no-listing-24-comments-end-of-line/src/main.rs}}
```

但更常见的是以这种格式使用，即注释写在代码上方的单独一行中：

<span class="filename">Filename: src/main.rs</span>

```rust
{{#rustdoc_include ../listings/ch03-common-programming-concepts/no-listing-25-comments-above-line/src/main.rs}}
```

Rust 还有另一种类型的注释，即文档注释，我们将在第 14 章的[“将 crate 发布到 Crates.io”][publishing]<!-- ignore -->部分进行讨论。

[publishing]: ch14-02-publishing-to-crates-io.html
