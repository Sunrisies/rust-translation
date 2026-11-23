<a id="typenumeric"></a>
# 数字类型

<a id="typenumeric.int"></a>
## 整数类型

<a id="typenumeric.int.unsigned"></a> 无符号整数类型包括：

类型 | 最小值 | 最大值
-------|---------|-------------------
`u8` | 0 | 2<sup>8</sup>-1 `u16` | 0 | 2<sup>16</sup>-1 `u32` | 0 | 2<sup>32</sup>-1 `u64` | 0 | 2<sup>64</sup>-1 `u128` | 0 | 2<sup>128</sup>-1

<a id="typenumeric.int.signed"></a> 有符号二进制补码整数类型包括：

类型 | 最小值 | 最大值
-------|--------------------|-------------------
`i8` | -(2<sup>7</sup>) | 2<sup>7</sup>-1 `i16` | -(2<sup>15</sup>) | 2<sup>15</sup>-1 `i32` | -(2<sup>31</sup>) | 2<sup>31</sup>-1 `i64` | -(2<sup>63</sup>) | 2<sup>63</sup>-1 `i128` | -(2<sup>127</sup>) | 2<sup>127</sup>-1

<a id="typenumeric.float"></a>
## 浮点类型

IEEE 754-2008标准中的“binary32”和“binary64”浮点类型分别为 `f32` 和 `f64`。

<a id="typenumeric.int.size"></a>
## 与机器相关的整数类型

<a id="typenumeric.int.size.usize"></a> `usize` 类型是一个无符号整数类型，其位数与平台的指针类型相同。它可以表示进程中的每一个内存地址。

> [!NOTE] > 虽然 `usize` 可以表示每一个*地址*，但将*指针*转换为 `usize` 并不一定是可逆操作。有关更多信息，请参考[类型转换表达式][std::ptr]以及[来源][std::ptr#provenance]的相关文档。

<a id="typenumeric.int.size.isize"></a> `isize` 类型是一个有符号二进制补码整数类型，其位数与平台的指针类型相同。对象和数组大小的理论上限是最大 `isize` 值。这确保了 `isize` 可用于计算指向对象或数组的指针之间的差值，并且可以访问对象内的每个字节以及末尾之后的一个字节。

<a id="typenumeric.int.size.minimum"></a> `usize` 和 `isize` 至少具有16位宽。

> [!NOTE] > 许多 Rust 代码可能假设指针、`usize` 和 `isize` 为 32 位或 64 位。因此，16 位指针支持有限，可能需要库提供明确的支持和说明才能实现。

<a id="type.numeric.validity"></a>
## 位效度

对于每种数值类型 `T`，`T` 的位效度等同于 `[u8; size_of::<T>()]` 的位效度。未初始化的字节不是有效的 `u8`。

[type cast expressions]: ../expressions/operator-expr.md#type-cast-expressions
