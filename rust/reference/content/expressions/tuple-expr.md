<a id="expr.tuple"></a>
# 元组与元组索引表达式

## 元组表达式

<a id="expr.tuple.syntax"></a> 
```grammar,expressions
TupleExpression -> `(` TupleElements? `)`

TupleElements -> ( Expression `,` )+ Expression?
```

<a id="expr.tuple.result"></a> 一个 *元组表达式* 构建 [元组值][tuple type]。

<a id="expr.tuple.intro"></a> 元组表达式的语法是一个用括号括起、由逗号分隔的表达式列表，称为 *元组初始化操作数*。

<a id="expr.tuple.unary-tuple-restriction"></a> 一元组表达式在其初始化操作数后需要加逗号，以与 [括号表达式] 区分。

<a id="expr.tuple.value"></a> 元组表达式是一个 [值表达式]，其计算结果是一个新构建的元组类型的值。

<a id="expr.tuple.type"></a> 元组初始化操作数的数量决定了所构建元组的参数个数。

<a id="expr.tuple.unit"></a> 没有任何初始化操作数的元组表达式会生成单位元组。

<a id="expr.tuple.fields"></a> 对于其他元组表达式，第一个写的初始化操作数初始化字段 `0`，后续操作数则初始化更高的字段。例如，在元组表达式 `('a', 'b', 'c')` 中，`'a'` 初始化字段 `0` 的值，`'b'` 初始化字段 `1` 的值，而 `'c'` 初始化字段 `2` 的值。

元组表达式及其类型的示例：

| Expression           | Type         |
| -------------------- | ------------ |
| `()`                 | `()` (unit)  |
| `(0.0, 4.5)`         | `(f64, f64)` |
| `("x".to_string(), )` | `(String, )`  |
| `("a", 4usize, true)`| `(&'static str, usize, bool)` |

<a id="expr.tuple-index"></a>
## 元组索引表达式

<a id="expr.tuple-index.syntax"></a> 
```grammar,expressions
TupleIndexingExpression -> Expression `.` TUPLE_INDEX
```

<a id="expr.tuple-index.intro"></a> 一个 *元组索引表达式* 用于访问 [元组][tuple type] 和 [元组结构体][tuple type] 的字段。

元组索引表达式的语法是一个表达式，称为 *元组操作数*，然后是一个 `.`，最后是一个元组索引。

<a id="expr.tuple-index.index-syntax"></a> *元组索引* 的语法是一个没有前导零、下划线或后缀的 [十进制字面量]。例如 `0` 和 `2` 是有效的元组索引，但 `01`、`0_` 或 `0i32` 则不是。

<a id="expr.tuple-index.required-type"></a> 元组操作数的类型必须是 [元组类型] 或 [元组结构体]。

<a id="expr.tuple-index.index-name-operand"></a> 元组索引必须是元组操作数类型的某个字段的名称。

<a id="expr.tuple-index.result"></a> 对元组索引表达式的评估不会产生除其元组操作数计算之外的任何副作用。作为 [位置表达式]，它会评估为与元组索引相同的名称的元组操作数字段的位置。

元组索引表达式的例子：

```rust
// Indexing a tuple
let pair = ("a string", 2);
assert_eq!(pair.1, 2);

// Indexing a tuple struct
# struct Point(f32, f32);
let point = Point(1.0, 0.0);
assert_eq!(point.0, 1.0);
assert_eq!(point.1, 0.0);
```

> [!NOTE] > 与字段访问表达式不同，元组索引表达式可以是 [调用表达式] 的函数操作数，因为无法将其与方法调用混淆，因为方法名称不是数字。

> [!NOTE] > 尽管数组和切片也有元素，但必须使用 [数组或切片索引表达式] 或 [切片模式] 来访问它们的元素。

[array or slice indexing expression]: array-expr.md#array-and-slice-indexing-expressions
[call expression]: ./call-expr.md
[decimal literal]: ../tokens.md#integer-literals
[field access expressions]: ./field-expr.html#field-access-expressions
[operands]: ../expressions.md
[parenthetical expression]: grouped-expr.md
[place expression]: ../expressions.md#place-expressions-and-value-expressions
[slice pattern]: ../patterns.md#slice-patterns
[tuple type]: ../types/tuple.md
[tuple struct]: ../types/struct.md
[value expression]: ../expressions.md#place-expressions-and-value-expressions
