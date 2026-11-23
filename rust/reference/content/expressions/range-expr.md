<a id="expr.range"></a>
# 范围表达式

<a id="expr.range.syntax"></a> 
```grammar,expressions
RangeExpression ->
      RangeExpr
    | RangeFromExpr
    | RangeToExpr
    | RangeFullExpr
    | RangeInclusiveExpr
    | RangeToInclusiveExpr

RangeExpr -> Expression `..` Expression

RangeFromExpr -> Expression `..`

RangeToExpr -> `..` Expression

RangeFullExpr -> `..`

RangeInclusiveExpr -> Expression `..=` Expression

RangeToInclusiveExpr -> `..=` Expression
```

<a id="expr.range.behavior"></a> `..` 和 `..=` 运算符将根据以下表格构造 `std::ops::Range`（或 `core::ops::Range`）变体的对象：

| Production             | Syntax        | Type                         | Range                 |
|------------------------|---------------|------------------------------|-----------------------|
| [RangeExpr]            | start`..`end  | [std::ops::Range]            | start &le; x &lt; end |
| [RangeFromExpr]        | start`..`     | [std::ops::RangeFrom]        | start &le; x          |
| [RangeToExpr]          | `..`end       | [std::ops::RangeTo]          |            x &lt; end |
| [RangeFullExpr]        | `..`          | [std::ops::RangeFull]        |            -          |
| [RangeInclusiveExpr]   | start`..=`end | [std::ops::RangeInclusive]   | start &le; x &le; end |
| [RangeToInclusiveExpr] | `..=`end      | [std::ops::RangeToInclusive] |            x &le; end |

Examples:

```rust
1..2;   // std::ops::Range
3..;    // std::ops::RangeFrom
..4;    // std::ops::RangeTo
..;     // std::ops::RangeFull
5..=6;  // std::ops::RangeInclusive
..=7;   // std::ops::RangeToInclusive
```

<a id="expr.range.equivalence"></a> 以下表达式是等价的。

```rust
let x = std::ops::Range {start: 0, end: 10};
let y = 0..10;

assert_eq!(x, y);
```

<a id="expr.range.for"></a> 范围可用于 `for` 循环中：

```rust
for i in 1..11 {
    println!("{}", i);
}
```
