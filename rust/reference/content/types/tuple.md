<a id="type.tuple"></a>
# 元组类型

<a id="type.tuple.syntax"></a> 
```grammar,types
TupleType ->
      `(` `)`
    | `(` ( Type `,` )+ Type? `)`
```

<a id="type.tuple.intro"></a> *元组类型*是一系列结构型类型[^1]，用于表示其他类型的异构列表。

元组类型的语法是一个用括号括起、由逗号分隔的类型列表。

<a id="type.tuple.restriction"></a> 一元组需要在其元素类型后加逗号，以便与[括号括起来的类型]区分开。

<a id="type.tuple.field-number"></a> 元组类型中的字段数量等于类型列表的长度。这个字段数量决定了元组的*元位数*。具有 `n` 个字段的元组称为*n-元组*。例如，具有2个字段的元组是2元组。

<a id="type.tuple.field-name"></a> 元组的字段使用递增的数字名称进行命名，这些名称与它们在类型列表中的位置相对应。第一个字段为 `0`，第二个字段为 `1`，依此类推。每个字段的类型等于元组类型列表中相同位置的类型。

<a id="type.tuple.unit"></a> 出于方便和历史原因，没有字段的元组类型（`()`）通常被称为*单位类型*或*单位值*。它的一个值也被称为*单位值*。

一些元组类型的示例：

* `()` (单位) * `(i32,)` (一元组) * `(f64, f64)` * `(String, i32)` * `(i32, String)` (与上一个示例不同的类型) * `(i32, f64, Vec<String>, Option<bool>)`

<a id="type.tuple.constructor"></a> 这种类型的数值是通过[元组表达式]构造的。此外，如果没有其他有意义的值可以评估，各种表达式也会产生单位值。

<a id="type.tuple.access"></a> 元组字段可以通过[元组索引表达式]或[模式匹配]访问。

[parenthesized type]: ../types.md#parenthesized-types
[pattern matching]: ../patterns.md#tuple-patterns
[tuple expression]: ../expressions/tuple-expr.md#tuple-expressions
[tuple index expression]: ../expressions/tuple-expr.md#tuple-indexing-expressions
[tuple structs]: ./struct.md
