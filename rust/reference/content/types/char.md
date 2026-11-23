<a id="type.char"></a>
# 字符类型

<a id="type.char.intro"></a> `char` 类型表示单个 [Unicode 标量值]（即非代理码点）。

> [!EXAMPLE]
> ```rust
> let c: char = 'a';
> let emoji: char = '😀';
> let unicode: char = '\u{1F600}';
> ```

> [!NOTE]
> See [the standard library docs][`char`] for information on the impls of the `char` type.

<a id="type.char.value"></a> `char` 类型的值在 0x0000 到 0xD7FF 或 0xE000 到 0x10FFFF 范围内被表示为一个 32 位无符号字。创建超出此范围的 `char` 会导致 [未定义行为]。

<a id="type.char.layout"></a> `char` 在所有平台上的大小和对齐与 `u32` 相同。

<a id="type.char.validity"></a> `char` 的每个字节都保证被初始化。换句话说，`transmute::<char, [u8; size_of::<char>()]>(...)` 总是安全的——但由于某些位模式属于无效的 `char`，其逆操作并不总是安全。

[Unicode scalar value]: http://www.unicode.org/glossary/#unicode_scalar_value
[undefined behavior]: ../behavior-considered-undefined.md
