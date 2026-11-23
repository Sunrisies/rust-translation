<a id="type.array"></a>
# 数组类型

<a id="type.array.syntax"></a> 
```grammar,types
ArrayType -> `[` Type `;` Expression `]`
```

<a id="type.array.intro"></a> 数组是一个固定大小的序列，包含 `N` 个类型为 `T` 的元素。数组类型表示为 `[T; N]`。

<a id="type.array.constraint"></a> 大小是一个[常量表达式]，其值为 [`usize`]。

Examples:

```rust
// A stack-allocated array
let array: [i32; 3] = [1, 2, 3];

// A heap-allocated array, coerced to a slice
let boxed_array: Box<[i32]> = Box::new([1, 2, 3]);
```

<a id="type.array.index"></a> 数组的所有元素总是被初始化，并且在安全的方法和运算符中访问数组时始终进行边界检查。

> [!NOTE] > 标准库类型 [`Vec<T>`] 提供了一种堆分配的可调整大小数组类型。

[`usize`]: numeric.md#machine-dependent-integer-types
[constant expression]: ../const_eval.md#constant-expressions
