<a id="type.slice"></a>
# 切片类型

<a id="type.slice.syntax"></a> 
```grammar,types
SliceType -> `[` Type `]`
```

<a id="type.slice.intro"></a> 切片是一种[动态大小的类型]，表示对类型为 `T` 的元素序列的“视图”。切片类型写作 `[T]`。

<a id="type.slice.unsized"></a> 通常通过指针类型来使用切片类型。例如：

* `&[T]`: 一种“共享切片”，通常简称为“切片”。它不拥有其指向的数据，而是借用该数据。 * `&mut [T]`: 一种“可修改的切片”。它可修改地借用其指向的数据。 * `Box<[T]>`: 一种“包装切片”

Examples:

```rust
// A heap-allocated array, coerced to a slice
let boxed_array: Box<[i32]> = Box::new([1, 2, 3]);

// A (shared) slice into an array
let slice: &[i32] = &boxed_array[..];
```

<a id="type.slice.safe"></a> 所有切片元素总是被初始化，并且在安全方法和运算符中访问切片时始终进行边界检查。

[dynamically sized type]: ../dynamically-sized-types.md
