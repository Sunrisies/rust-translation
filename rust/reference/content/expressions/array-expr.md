<a id="expr.array"></a>
# 数组与数组索引表达式

## 数组表达式

<a id="expr.array.syntax"></a> 
```grammar,expressions
ArrayExpression -> `[` ArrayElements? `]`

ArrayElements ->
      Expression ( `,` Expression )* `,`?
    | Expression `;` Expression
```

<a id="expr.array.constructor"></a> *数组表达式*用于构造[数组][array]。数组表达式有两种形式。

<a id="expr.array.array"></a> 第一种形式会列出数组中的每个值。

<a id="expr.array.array-syntax"></a> 这种形式的语法是用方括号包裹的、类型一致的表达式的逗号分隔列表。

<a id="expr.array.array-behavior"></a> 它生成的数组按写入顺序包含这些值。

<a id="expr.array.repeat"></a> 第二种形式的语法是用方括号包裹的、由分号(`;`)分隔的两个表达式。

<a id="expr.array.repeat-operand"></a> `;` 之前的表达式称为*重复操作数*。

<a id="expr.array.length-operand"></a> `;` 之后的表达式称为*长度操作数*。

<a id="expr.array.length-restriction"></a> 长度操作数必须是[推断常量]，或者是类型为`usize`的[常量表达式](例如[字面量]或[常量项])。

```rust
const C: usize = 1;
let _: [u8; C] = [0; 1]; // Literal.
let _: [u8; C] = [0; C]; // Constant item.
let _: [u8; C] = [0; _]; // Inferred const.
let _: [u8; C] = [0; (((_)))]; // Inferred const.
```

> [!NOTE] > 在数组表达式中，[推断常量]被解析为[表达式]([Expression])，但在语义上被视为一种独立的[常量泛型参数]。

<a id="expr.array.repeat-behavior"></a> 这种形式的数组表达式会创建一个长度为长度操作数值的数组，每个元素都是重复操作数的副本。也就是说，`[a; b]`会生成一个包含`b`个`a`值副本的数组。

<a id="expr.array.repeat-copy"></a> 如果长度操作数的值大于1，则要求重复操作数具有实现 [`Copy`] 类型的类型，或者是一个[常量块表达式]，或者是到常量项的[路径]。

<a id="expr.array.repeat-const-item"></a> 当重复操作数为常量块或到常量项的路径时，它会按照长度操作数中指定的次数进行求值。

<a id="expr.array.repeat-evaluation-zero"></a> 如果该值为`0`，则常量块或常量项根本不会被求值。

<a id="expr.array.repeat-non-const"></a> 对于既不是 const 块也不是常量项路径的表达式，该操作会恰好执行一次，然后结果会被复制 `length` 操作数所表示的值次。

```rust
[1, 2, 3, 4];
["a", "b", "c", "d"];
[0; 128];              // array with 128 zeros
[0u8, 0u8, 0u8, 0u8,];
[[1, 0, 0], [0, 1, 0], [0, 0, 1]]; // 2D array
const EMPTY: Vec<i32> = Vec::new();
[EMPTY; 2];
```

<a id="expr.array.index"></a>
## 数组和切片索引表达式

<a id="expr.array.index.syntax"></a> 
```grammar,expressions
IndexExpression -> Expression `[` Expression `]`
```

<a id="expr.array.index.array"></a> [数组] 和 [切片]-类型值可以通过在它们后面写入一个类型为 `usize` 的方括号包裹的表达式（即索引）来进行索引。当数组是可变的时，得到的 [内存位置] 可以被赋值。

<a id="expr.array.index.trait"></a> 对于其他类型，索引表达式 `a[b]` 等同于 `*std::ops::Index::index(&a, b)` 或在可变位置表达式上下文中等同于 `*std::ops::IndexMut::index_mut(&mut a, b)`，不过当索引表达式经历 [临时生命周期扩展] 时，被索引的变量 `a` 的 [临时作用域] 也会被扩展。就像方法一样，Rust 也会反复对 `a` 执行解引用操作以寻找实现方式。

```rust
// The temporary holding the result of `vec![()]` is extended to
// live to the end of the block, so `x` may be used in subsequent
// statements.
let x = &vec![()][0];
# x;
```

```rust,compile_fail,E0716
// The temporary holding the result of `vec![()]` is dropped at the
// end of the statement, so it's an error to use `y` after.
let y = &*std::ops::Index::index(&vec![()], 0); // ERROR
# y;
```

<a id="expr.array.index.zero-index"></a> 数组和切片的索引基于零开始。

<a id="expr.array.index.const"></a> 数组访问是一个 [常量表达式]，因此可以在编译时通过常量索引值来检查边界。否则，在运行时会进行检查，如果失败则会使线程进入 [_恐慌状态_][panic]。

```rust,should_panic
// lint is deny by default.
#![warn(unconditional_panic)]

([1, 2, 3, 4])[2];        // Evaluates to 3

let b = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
b[1][2];                  // multidimensional array indexing

let x = (["a", "b"])[10]; // warning: index out of bounds

let n = 10;
let y = (["a", "b"])[n];  // panics

let arr = ["a", "b"];
arr[10];                  // warning: index out of bounds
```

<a id="expr.array.index.trait-实现"></a> 对于非数组和切片的类型，可以通过实现 [Index] 和 [IndexMut] 特质来为数组索引表达式提供实现。

[IndexMut]: std::ops::IndexMut
[Index]: std::ops::Index
[const generic argument]: items.generics.const.argument
[const block expression]: expr.block.const
[inferred const]: items.generics.const.inferred
[temporary lifetime extension]: destructors.scope.lifetime-extension
[temporary scope]: destructors.scope.temporary

[`Copy`]: ../special-types-and-traits.md#copy
[array]: ../types/array.md
[constant expression]: ../const_eval.md#constant-expressions
[constant item]: ../items/constant-items.md
[literal]: ../tokens.md#literals
[memory location]: ../expressions.md#place-expressions-and-value-expressions
[panic]: ../panic.md
[path]: path-expr.md
[slice]: ../types/slice.md
