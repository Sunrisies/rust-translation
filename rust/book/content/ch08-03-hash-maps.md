## 在哈希映射中存储具有关联值的键

我们的常见集合中的最后一个是哈希映射。类型 `HashMap<K, V>` 使用_哈希函数_来保存类型为 `K` 的键与类型为 `V` 的值之间的映射关系，该函数决定了这些键和值如何存储在内存中。许多编程语言都支持这种数据结构，但它们通常使用不同的名称，如_哈希_、_映射_、_对象_、_哈希表_、_字典_或_关联数组_等。

当你希望通过任意类型的键来查找数据，而不是使用索引时，哈希映射非常有用。例如，在游戏中，你可以在哈希映射中记录每个队伍的得分，其中每个键是队伍名称，值则是该队的得分。给定一个队伍名称，你可以获取其得分。

在本节中我们将介绍哈希映射的基本 API，但标准库中定义的 `HashMap<K, V>` 函数还包含许多其他功能。如常一样，请查阅标准库文档以获取更多信息。

### 创建新的哈希映射

创建空哈希映射的一种方法是使用 `new`，并通过 `insert` 添加元素。在列表 8-20 中，我们记录了两个队伍的得分，这两个队伍的名称分别是_蓝色_和_黄色_。蓝色队以 10 分开始，黄色队以 50 分开始。

<Listing number="8-20" caption="Creating a new hash map and inserting some keys and values">

```rust
{{#rustdoc_include ../listings/ch08-common-collections/listing-08-20/src/main.rs:here}}
```

</Listing>

请注意，我们需要首先从标准库的集合部分 `use` 哈希映射。在我们的三个常见集合中，这个使用频率最低，因此它不会自动包含在预导中的功能中。哈希映射也得到标准库的较少支持；例如，没有内置的宏来构建它们。

与向量类似，哈希映射将数据存储在堆上。这个 `HashMap` 的键类型为 `String`，值类型为 `i32`。与向量一样，哈希映射是同质的：所有键必须具有相同的类型，所有值也必须具有相同的类型。

### 访问哈希映射中的值

我们可以通过将键提供给 `get` 方法来从哈希映射中获取值，如列表 8-21 所示。

<Listing number="8-21" caption="Accessing the score for the Blue team stored in the hash map">

```rust
{{#rustdoc_include ../listings/ch08-common-collections/listing-08-21/src/main.rs:here}}
```

</Listing>

在这里，`score` 将具有与蓝队相关的数值，结果将为 `10`。`get` 方法返回一个 `Option<&V>`；如果哈希映射中该键没有值，`get` 将返回 `None`。此程序通过调用 `copied` 来获取一个 `Option<i32>` 而不是 `Option<&i32>`，然后使用 `unwrap_or` 在 `scores` 中没有该键的条目时将 `score` 设置为零。

我们可以像处理向量一样使用 `for` 循环遍历哈希映射中的每对键-值对。

```rust
{{#rustdoc_include ../listings/ch08-common-collections/no-listing-03-iterate-over-hashmap/src/main.rs:here}}
```

此代码将以任意顺序打印每一对键值对。

```text
Yellow: 50
Blue: 10
```

<!-- Old headings. Do not remove or links may break. -->

<a id="hash-maps-and-ownership"></a>

### 在哈希映射中管理所有权 对于实现 `Copy` trait 的类型，如 `i32`，值会被复制到哈希映射中。对于拥有所有权的类型，如 `String`，值将被移动，而哈希映射成为这些值的所有者，如清单 8-22 所示。

对于实现 `Copy` trait 的类型，如 `i32`，其值会被复制到哈希映射中。而对于拥有所有权的类型，如 `String`，其值会被移动，而哈希映射将成为这些值的所有者，如清单 8-22 所示。

<Listing number="8-22" caption="Showing that keys and values are owned by the hash map once they’re inserted">

```rust
{{#rustdoc_include ../listings/ch08-common-collections/listing-08-22/src/main.rs:here}}
```

</Listing>

当通过 `insert` 将变量 `field_name` 和 `field_value` 移入哈希映射后，我们就无法再使用它们了。

如果我们在哈希映射中插入对值的引用，值不会被移动进去。这些引用指向的值必须至少与哈希映射的生存时间相同长才有效。我们将在第十章的“使用生命周期验证引用”部分进一步讨论这些问题。

### 更新哈希映射 尽管键和值对的数量可以增长，但每个唯一的键一次只能有一个关联的值（反之亦然：例如，蓝队和黄队都可以将值 `10` 存储在 `scores` 哈希映射中）。

尽管键与值对的数量可以增长，但每个唯一的键在任一时刻只能关联一个值（反之则不行：例如，蓝色团队和黄色团队都可以将值 `10` 存储在 `scores` 哈希映射中）。

当想要更改哈希映射中的数据时，必须决定如何处理已经分配了值的键的情况。你可以用新值替换旧值，完全忽略旧值；也可以保留旧值并忽略新值，只有在键还没有值时才添加新值。或者，你可以同时使用旧值和新值。让我们来看看如何分别实现这些操作！

#### 覆盖值

如果我们向哈希映射中插入一个键和一个值，然后再次插入同一个键但使用不同的值，与该键关联的值将被替换。尽管清单 8-23 中的代码调用了两次 `insert` 方法，但由于我们两次都插入了蓝色团队的键对应的值，哈希映射中只包含一个键值对。

<Listing number="8-23" caption="Replacing a value stored with a particular key">

```rust
{{#rustdoc_include ../listings/ch08-common-collections/listing-08-23/src/main.rs:here}}
```

</Listing>

此代码将输出 `{"Blue": 25}`。原始值 `10` 已被覆盖。

<!-- Old headings. Do not remove or links may break. -->

<a id="only-inserting-a-value-if-the-key-has-no-value"></a>

#### 仅当键不存在时添加键和值

通常的做法是首先检查哈希映射中是否存在某个特定键及其对应的值，然后执行以下操作：如果键存在于哈希映射中，则保留现有值；如果键不存在，则插入该键并为其分配一个值。

哈希映射有一个名为 `entry` 的特殊 API，它接受要检查的键作为参数。`entry` 方法的返回值是名为 `Entry` 的枚举类型，表示可能存在也可能不存在的值。假设我们想检查黄色队的键是否关联有值。如果没有，我们希望插入值 `50`，蓝色队也是如此。使用 `entry` API，代码类似于清单 8-24。

<Listing number="8-24" caption="Using the `entry` method to only insert if the key does not already have a value">

```rust
{{#rustdoc_include ../listings/ch08-common-collections/listing-08-24/src/main.rs:here}}
```

</Listing>

`Entry` 中的 `or_insert` 方法被定义为：如果对应的键存在，则返回对该键的值的可变引用；如果不存在，则将该参数作为新值插入该键并返回对新值的可变引用。这种技术比自己编写逻辑更简洁，而且还能更好地与借用检查器兼容。

运行清单 8-24 中的代码将输出 `{"Yellow": 50, "Blue": 10}`。第一次调用 `entry` 会插入黄色队的键及其值 `50`，因为黄色队目前没有对应的值。第二次调用 `entry` 不会改变哈希映射，因为蓝色队已经拥有值 `10`。

#### 根据旧值更新值

哈希映射的另一个常见用途是查找键的值，然后根据旧值更新该值。例如，清单 8-25 展示了计算文本中每个单词出现次数的代码。我们使用以单词为键的哈希映射，并增加数值来记录该单词出现的次数。如果这是第一次看到某个单词，则首先将数值设为 `0`。

<Listing number="8-25" caption="Counting occurrences of words using a hash map that stores words and counts">

```rust
{{#rustdoc_include ../listings/ch08-common-collections/listing-08-25/src/main.rs:here}}
```

</Listing>

此代码将输出 `{"world": 2, "hello": 1, "wonderful": 1}`。您可能会看到相同的键-值对以不同的顺序打印：请回忆 [“访问哈希映射中的值”][access]<!-- ignore -->，遍历哈希映射的顺序是随机的。

`split_whitespace` 方法返回一个迭代器，该迭代器包含 `text` 中值的由空格分隔的子切片。`or_insert` 方法返回对指定键的值的可变引用 (`&mut V`)。在这里，我们将该可变引用存储在 `count` 变量中，因此要赋值给该值，必须首先使用星号 (`*`) 解引用 `count`。该可变引用在 `for` 循环结束时超出作用域，因此这些更改都是安全的，并且符合借用规则。

### 哈希函数

默认情况下，`HashMap` 使用一种名为 _SipHash_ 的哈希函数，可以抵抗涉及哈希表的拒绝服务 (DoS) 攻击[^siphash]<!-- ignore -->。这不是最快的哈希算法，但为更好的安全性而带来的性能下降值得付出代价。如果您对代码进行性能分析并发现默认哈希函数对于您的用途来说太慢，可以通过指定不同的哈希器来切换至其他函数。`hasher` 是一种实现 `BuildHasher` trait 的类型。我们将在 [第 10 章][traits]<!-- ignore -->中讨论特质以及如何实现它们。您不必从零开始实现自己的哈希器；[crates.io](https://crates.io/)<!-- ignore --> 有其他 Rust 用户共享的库，这些库提供了实现多种常见哈希算法的哈希器。


## 摘要

向量、字符串和哈希映射在程序中提供了大量功能，用于存储、访问和修改数据。以下是一些你现在应该能够解决的练习：

1. 给定一个整数列表，使用向量返回该列表的中位数（排序后位于中间位置的值）和众数（出现次数最多的数值；此处使用哈希映射会很有帮助）。
1. 将字符串转换为皮格拉丁格式。每个单词的第一个辅音被移动到单词末尾，并添加 _ay_，因此 _first_ 变为 _irst-fay_。以元音开头的单词在末尾添加 _hay_（例如 _apple_ 变为 _apple-hay_）。注意 UTF-8 编码的细节！
1. 使用哈希映射和向量创建一个文本界面，允许用户向公司部门添加员工姓名；例如“将 Sally 添加到工程部”或“将 Amir 添加到销售部”。然后，让用户按字母顺序检索该部门的所有人员列表或按部门分类的公司所有人员列表。

标准库 API 文档描述了向量、字符串和哈希映射具有的方法，这些方法对完成这些练习非常有帮助！

我们将进入更复杂的程序，其中操作可能会失败，因此现在是讨论错误处理的好时机。我们接下来会讨论这一点！

[^siphash]: [https://en.wikipedia.org/wiki/SipHash](https://en.wikipedia.org/wiki/SipHash)
[validating-references-with-lifetimes]: ch10-03-lifetime-syntax.html#validating-references-with-lifetimes
[access]: #accessing-values-in-a-hash-map
[traits]: ch10-02-traits.html
