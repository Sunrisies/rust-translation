<a id="type.str"></a>
# 字符串切片类型

<a id="type.str.intro"></a> 字符串切片（`str`）类型表示一系列字符。

```rust
let greeting1: &str = "Hello, world!";
let greeting2: &str = "你好，世界";
```

> [!NOTE] > 有关 `str` 类型的实现信息，请参阅[标准库文档][`str`]。

<a id="type.str.value"></a> `str` 类型的值以与 `[u8]`（8位无符号字节的切片）相同的方式表示。

> [!NOTE] > 标准库对 `str` 有额外的假设：作用于 `str` 的方法假定并确保其包含的数据是有效的 UTF-8 格式。使用非 UTF-8 缓冲区调用 `str` 方法现在或将来可能导致[未定义行为]。

<a id="type.str.unsized"></a> `str` 是一种[动态大小类型]。它只能通过指针类型实例化，例如 `&str`。`&str` 的布局与 `&[u8]` 的布局相同。

[undefined behavior]: ../behavior-considered-undefined.md
[dynamically sized type]: ../dynamically-sized-types.md
