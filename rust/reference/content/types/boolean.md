<a id="type.bool"></a>
# 布尔类型

<a id="type.bool.intro"></a> 
```rust
let b: bool = true;
```

*布尔类型*或*bool*是一种原始数据类型，它只能取两个值之一，即*true*和*false*。

<a id="type.bool.literal"></a> 这种类型的数值可以通过使用`true`和`false`关键字作为[字面量表达式]来创建，这些关键字对应相同名称的值。

<a id="type.bool.namespace"></a> 这种类型属于[语言预集]，其[名称为]bool。

<a id="type.bool.layout"></a> 具有布尔类型的对象具有每个为1的[大小和对齐方式]。

<a id="type.bool.repr"></a> 值false的位模式为`0x00`，值true的位模式为`0x01`。对于具有布尔类型的对象来说，其他任何位模式都是[未定义行为]。

<a id="type.bool.use"></a> 布尔类型是多种[表达式]中许多操作数的类型。

<a id="type.bool.use-in-condition"></a> * [if表达式]和[while表达式]中的条件操作数

<a id="type.bool.use-in-lazy-operator"></a> * [懒惰布尔运算符表达式][lazy]中的操作数

> [!NOTE] > 布尔类型的行为类似于[枚举类型]，但不是一个[枚举类型]。实际上，这意味着构造器不与该类型关联（例如`bool::true`）。

<a id="type.bool.traits"></a> 与所有原始类型一样，布尔类型[实现][p-实现]了[特性][p-traits] [`Clone`][p-clone]`、`[Copy'][p-copy]`、`[Sized'][p-sized]`、`[Send'][p-send]`和`[Sync'][p-sync]`。

> [!NOTE] > 有关库操作，请参阅[标准库文档](bool)。

<a id="type.bool.expr"></a>
## 对布尔值的操作

<a id="type.bool.expr.intro"></a> 当使用某些运算符表达式与布尔类型作为操作数时，它们根据[布尔逻辑]的规则进行计算。

<a id="type.bool.expr.not"></a>
### 逻辑非

| `b` | [`!b`][op-not] |
|- | - |
| `true` | `false` |
| `false` | `true` |

<a id="type.bool.expr.or"></a>
### 逻辑或

| `a` | `b` | [`a \| b`][op-or] |
|- | - | - |
| `true` | `true` | `true` |
| `true` | `false` | `true` |
| `false` | `true` | `true` |
| `false` | `false` | `false` |

<a id="type.bool.expr.and"></a>
### 逻辑与

| `a` | `b` | [`a & b`][op-and] |
|- | - | - |
| `true` | `true` | `true` |
| `true` | `false` | `false` |
| `false` | `true` | `false` |
| `false` | `false` | `false` |

<a id="type.bool.expr.xor"></a>
### 逻辑异或

| `a` | `b` | [`a ^ b`][op-xor] |
|- | - | - |
| `true` | `true` | `false` |
| `true` | `false` | `true` |
| `false` | `true` | `true` |
| `false` | `false` | `false` |

<a id="type.bool.expr.cmp"></a>
### 比较

<a id="type.bool.expr.cmp.eq"></a> 
| `a` | `b` | [`a == b`][op-compare] |
|- | - | - |
| `true` | `true` | `true` |
| `true` | `false` | `false` |
| `false` | `true` | `false` |
| `false` | `false` | `true` |

<a id="type.bool.expr.cmp.greater"></a> 
| `a` | `b` | [`a > b`][op-compare] |
|- | - | - |
| `true` | `true` | `false` |
| `true` | `false` | `true` |
| `false` | `true` | `false` |
| `false` | `false` | `false` |

<a id="type.bool.expr.cmp.not-eq"></a> * `a != b`与`!(a == b)`相同

<a id="type.bool.expr.cmp.greater-eq"></a> * `a >= b`与`a == b | a > b`相同

<a id="type.bool.expr.cmp.less"></a> * `a < b` 与 `!(a >= b)` 相同

<a id="type.bool.expr.cmp.less-eq"></a> * `a <= b` 与 `a == b | a < b` 相同

<a id="type.bool.validity"></a>
## 位有效性

`bool` 的单个字节保证被初始化（换句话说，`transmute::<bool, u8>(...)` 总是有效的——但由于某些位模式不是合法的 `bool`，其逆操作并不总是有效）。

[boolean logic]: https://en.wikipedia.org/wiki/Boolean_algebra
[enumerated type]: enum.md
[expressions]: ../expressions.md
[if expressions]: ../expressions/if-expr.md#if-expressions
[language prelude]: ../names/preludes.md#language-prelude
[lazy]: ../expressions/operator-expr.md#lazy-boolean-operators
[literal expression]: ../expressions/literal-expr.md
[name]: ../names.md
[op-and]: ../expressions/operator-expr.md#arithmetic-and-logical-binary-operators
[op-compare]: ../expressions/operator-expr.md#comparison-operators
[op-not]: ../expressions/operator-expr.md#negation-operators
[op-or]: ../expressions/operator-expr.md#arithmetic-and-logical-binary-operators
[op-xor]: ../expressions/operator-expr.md#arithmetic-and-logical-binary-operators
[p-clone]: ../special-types-and-traits.md#clone
[p-copy]: ../special-types-and-traits.md#copy
[p-impl]: ../items/implementations.md
[p-send]: ../special-types-and-traits.md#send
[p-sized]: ../special-types-and-traits.md#sized
[p-sync]: ../special-types-and-traits.md#sync
[p-traits]: ../items/traits.md
[size and alignment]: ../type-layout.md#size-and-alignment
[undefined behavior]: ../behavior-considered-undefined.md
[while expressions]: ../expressions/loop-expr.md#predicate-loops
