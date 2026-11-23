<a id="expr"></a>
# 表达式

<a id="expr.syntax"></a> 
```grammar,expressions
Expression ->
      ExpressionWithoutBlock
    | ExpressionWithBlock

ExpressionWithoutBlock ->
    OuterAttribute* ExpressionWithoutBlockNoAttrs

ExpressionWithoutBlockNoAttrs ->
      LiteralExpression
    | PathExpression
    | OperatorExpression
    | GroupedExpression
    | ArrayExpression
    | AwaitExpression
    | IndexExpression
    | TupleExpression
    | TupleIndexingExpression
    | StructExpression
    | CallExpression
    | MethodCallExpression
    | FieldExpression
    | ClosureExpression
    | AsyncBlockExpression
    | ContinueExpression
    | BreakExpression
    | RangeExpression
    | ReturnExpression
    | UnderscoreExpression
    | MacroInvocation

ExpressionWithBlock ->
    OuterAttribute* ExpressionWithBlockNoAttrs

ExpressionWithBlockNoAttrs ->
      BlockExpression
    | ConstBlockExpression
    | UnsafeBlockExpression
    | LoopExpression
    | IfExpression
    | MatchExpression
```

<a id="expr.intro"></a> 一个表达式可以有两种作用：它总是产生一个*值*，并且可能具有*效果*（也称为“副作用”）。

<a id="expr.evaluation"></a> 一个表达式*评估为*一个值，并在*评估*过程中产生效果。

<a id="expr.operands"></a> 许多表达式包含子表达式，这些子表达式被称为该表达式的*操作数*。

<a id="expr.behavior"></a> 每种类型表达式的含义决定了若干因素：

* 在评估表达式时是否评估操作数 * 评估操作数的顺序 * 如何组合操作数的值以获得表达式的值

<a id="expr.structure"></a> 通过这种方式，表达式的结构决定了执行的结构。块也是一种类型的表达式，因此块、语句、表达式和块可以递归地嵌套到任意深度。

> [!NOTE] > 我们给表达式的操作数命名以便讨论，但这些名称并不稳定，可能会发生变化。

<a id="expr.precedence"></a>
## 表达式优先级

Rust 运算符和表达式的优先级按从强到弱的顺序排列。相同优先级级别的二元运算符按照其结合性顺序分组。

| Operator/Expression         | Associativity       |
|-----------------------------|---------------------|
| [Paths][expr.path]          |                     |
| [Method calls][expr.method] |                     |
| [Field expressions][expr.field] | left to right   |
| [Function calls][expr.call], [array indexing][expr.array.index] | |
| [`?`][expr.try]             |                     |
| Unary [`-`][expr.negate] [`!`][expr.negate] [`*`][expr.deref] [borrow][expr.operator.borrow] | |
| [`as`][expr.as]             | left to right       |
| [`*`][expr.arith-logic] [`/`][expr.arith-logic] [`%`][expr.arith-logic] | left to right       |
| [`+`][expr.arith-logic] [`-`][expr.arith-logic] | left to right       |
| [`<<`][expr.arith-logic] [`>>`][expr.arith-logic] | left to right     |
| [`&`][expr.arith-logic]     | left to right       |
| [`^`][expr.arith-logic]     | left to right       |
| [<code>&#124;</code>][expr.arith-logic] | left to right       |
| [`==`][expr.cmp] [`!=`][expr.cmp] [`<`][expr.cmp] [`>`][expr.cmp] [`<=`][expr.cmp] [`>=`][expr.cmp] | Require parentheses |
| [`&&`][expr.bool-logic]     | left to right       |
| [<code>&#124;&#124;</code>][expr.bool-logic] | left to right       |
| [`..`][expr.range] [`..=`][expr.range] | Require parentheses |
| [`=`][expr.assign] [`+=`][expr.compound-assign] [`-=`][expr.compound-assign] [`*=`][expr.compound-assign] [`/=`][expr.compound-assign] [`%=`][expr.compound-assign] <br> [`&=`][expr.compound-assign] [<code>&#124;=</code>][expr.compound-assign] [`^=`][expr.compound-assign] [`<<=`][expr.compound-assign] [`>>=`][expr.compound-assign] | right to left |
| [`return`][expr.return] [`break`][expr.loop.break] [closures][expr.closure]  | |

<a id="expr.operand-order"></a>
## 操作数的评估顺序

<a id="expr.operand-order.default"></a> 以下列表中的表达式都以相同的方式评估其操作数，具体说明见后文。其他表达式要么不接收操作数，要么按照各自页面中描述的条件下进行评估。

* 解引用表达式 * 错误传播表达式 * 否定表达式 * 算术和逻辑二元运算符 * 比较运算符 * 类型转换表达式 * 分组表达式 * 数组表达式 * 等待表达式 * 索引表达式 * 元组表达式 * 元组索引表达式 * 结构体表达式 * 调用表达式 * 方法调用表达式 * 字段表达式 * 断点表达式 * 范围表达式 * 返回表达式

<a id="expr.operand-order.operands-before-primary"></a> 这些表达式的操作数在应用表达式效果之前进行计算。具有多个操作数的表达式按源代码中的书写顺序从左到右进行计算。

> [!NOTE] > 哪个子表达式是表达式的操作数，由前一部分所述的表达式优先级决定。

例如，两次 `next` 方法调用总是以相同的顺序执行：

```rust
# // Using vec instead of array to avoid references
# // since there is no stable owned array iterator
# // at the time this example was written.
let mut one_two = vec![1, 2].into_iter();
assert_eq!(
    (1, 2),
    (one_two.next().unwrap(), one_two.next().unwrap())
);
```

> [!NOTE] > 由于这是递归应用的，这些表达式也从最内层到最外层进行计算，直到没有内部子表达式为止，会忽略其他同级元素。

<a id="expr.place-value"></a>
## 位置表达式和值表达式

<a id="expr.place-value.intro"></a> 表达式分为两大类：位置表达式和值表达式；还有第三类较小的表达式称为赋值表达式。在每种表达式中，操作数可以出现在位置上下文或值上下文中。表达式的计算既取决于其类别，也取决于其出现的上下文。

<a id="expr.place-value.place-memory-location"></a> *位置表达式* 是一种表示内存位置的表达式。

<a id="expr.place-value.place-expr-kinds"></a> 这些表达式是 [路径]，包括局部变量、[静态变量][dereferences][deref]（`*expr`）、[数组索引] 表达式（`expr[expr]`）、[字段] 引用（`expr.f`）以及括号中的位置表达式。

<a id="expr.place-value.value-expr-kinds"></a> 所有其他表达式都是值表达式。

<a id="expr.place-value.value-result"></a> *值表达式* 是一种表示实际值的表达式。

<a id="expr.place-value.place-context"></a> 以下上下文是 *位置表达式* 上下文：

* 复合赋值表达式的左边操作数。 * 一元[borrow]、[raw borrow]或[dereference]运算符的操作数。 * [字段表达式]的操作数。 * [数组索引表达式]的索引操作数。 * [元组索引表达式]的元组操作数。 * 任何[隐式 borrow]的操作数。 * [let语句]的初始化器。 * [`if let`)、(['match']['match])或[`while let`]表达式的[scrutinee]。 * [函数式更新]结构表达式的基础。

> [!NOTE] > 历史上，位置表达式被称为*lvalue*，值表达式被称为*rvalue*。

<a id="expr.place-value.assignee"></a> *assignee表达式*是指出现在[assignment][assign]表达式左边操作数中的表达式。具体来说，assignee表达式包括：

- 位置表达式。 - [下划线]。 - assignee表达式的[元组]。 - assignee表达式的[切片][expr.array.index]。 - assignee表达式的[元组结构]。 - 具有可选命名字段的[结构体]。 - [单元结构体]

<a id="expr.place-value.parenthesis"></a> 在assignee表达式中允许任意的括号使用。

<a id="expr.move"></a>
### 已移动和复制的类型

<a id="expr.move.intro"></a> 当位置表达式在值表达式上下文中被评估，或作为模式中的值绑定时，它表示存储在该内存位置中的值。

<a id="expr.move.copy"></a> 如果该值的类型实现了[`Copy`]，则该值将被复制。

<a id="expr.move.requires-sized"></a> 在其他情况下，如果该类型为[`Sized`]，则可能能够移动该值。

<a id="expr.move.movable-place"></a> 只有以下位置表达式可以被移出：

* 当前未被borrow的[变量]。 * [临时值](#temporaries)。 * 可以移出且未实现[`Drop`]的位置表达式的[字段][field]。 * 类型为[`Box<T>`]并可以移出的[dereferencing][deref]后的表达式的结果。

<a id="expr.move.deinitialization"></a> 当从某个位置移出后，该位置会被解构初始化，直到再次重新初始化之前无法被读取。

<a id="expr.move.place-invalid"></a> 在其他所有情况下，尝试在值表达式上下文中使用位置表达式都会引发错误。

<a id="expr.mut"></a>
### 可变性

<a id="expr.mut.intro"></a> 为了能够将位置表达式 [赋值][assign]、可变地 [借用][borrow]、[隐式地可变地借用]，或绑定到包含 `ref mut` 的模式，它必须 _可变_。我们称这些为 *可变位置表达式*。相比之下，其他位置表达式则被称为 *不可变位置表达式*。

<a id="expr.mut.valid-places"></a> 以下表达式可以作为可变位置表达式上下文：

* 当前未被借用的可变 [变量]。 * [可变的 `static` 项]。 * [临时值]。 * [字段][field]: 这会在可变位置表达式上下文中计算子表达式的值。 * `*mut T` 指针的 [解引用][deref]。 * 类型为 `&mut T` 的变量或变量的字段的解引用。注意：这是下一规则要求的例外情况。 * 实现 `DerefMut` 类型的类型的解引用：此时要求被解引用的值在可变位置表达式上下文中计算。 * 实现 `IndexMut` 类型的类型的 [数组索引]：此时会在可变位置表达式上下文中计算被索引的值，而不是索引值。

<a id="expr.temporary"></a>
### 临时变量

在大多数位置表达式上下文中使用值表达式时，会创建一个临时未命名的内存位置并初始化为该值。表达式则在该位置进行计算，除非 [提升] 为 `static`。临时变量的 [作用域释放] 通常位于包含语句的末尾。

<a id="expr.super-macros"></a>
### 超级宏

<a id="expr.super-macros.intro"></a> 某些内置宏可能会创建[临时变量]，这些[临时作用域][临时作用域]可能会被[扩展]。这些临时变量是*超级临时变量*，而这些宏是*超级宏*。[宏调用][宏调用]这些宏被称为*超级宏调用表达式*。这些宏的参数可能是*超级操作数*。

> [!NOTE] > 当一个超级宏调用表达式是一个[扩展表达式]时，其超级操作数是[扩展表达式]，而超级临时变量的[临时作用域][临时作用域]被[扩展]。请参阅[析构函数.作用域.生命周期扩展.表达式]。

<a id="expr.super-macros.format_args"></a>
#### `format_args!`

<a id="expr.super-macros.format_args.super-operands"></a> 除了格式字符串参数外，传递给 [`format_args!`]的所有参数都是*超级操作数*。

```rust,edition2024
# fn temp() -> String { String::from("") }
// Due to the call being an extending expression and the argument
// being a super operand, the inner block is an extending expression,
// so the scope of the temporary created in its trailing expression
// is extended.
let _ = format_args!("{}", { &temp() }); // OK
```

<a id="expr.super-macros.format_args.super-temporaries"></a> [`format_args!`]的超级操作数是[隐式借用]的，因此属于[位置表达式上下文]。当将[值表达式]作为参数传递时，它会创建一个*超级临时变量*。

```rust
# fn temp() -> String { String::from("") }
let x = format_args!("{}", temp());
x; // <-- The temporary is extended, allowing use here.
```

对 [`format_args!`]的调用展开有时会创建其他内部*超级临时变量*。

```rust,compile_fail,E0716
let x = {
    // This call creates an internal temporary.
    let x = format_args!("{:?}", 0);
    x // <-- The temporary is extended, allowing its use here.
}; // <-- The temporary is dropped here.
x; // ERROR
```

```rust
// This call doesn't create an internal temporary.
let x = { let x = format_args!("{}", 0); x };
x; // OK
```

> [!NOTE] > 目前尚未明确说明 [`format_args!`]何时创建内部临时变量的具体细节。

<a id="expr.super-macros.pin"></a>
#### `pin!`

<a id="expr.super-macros.pin.super-operands"></a> [`pin!`]的参数是一个*超级操作数*。

```rust,edition2024
# use core::pin::pin;
# fn temp() {}
// As above for `format_args!`.
let _ = pin!({ &temp() }); // OK
```

<a id="expr.super-macros.pin.super-temporaries"></a> [`pin!`]的参数是一个[值表达式上下文]，并创建一个*超级临时变量*。

```rust
# use core::pin::pin;
# fn temp() {}
// The argument is evaluated into a super temporary.
let x = pin!(temp());
// The temporary is extended, allowing its use here.
x; // OK
```

<a id="expr.implicit-borrow"></a>
### 隐式借用

<a id="expr.implicit-borrow-intro"></a> 某些表达式会通过隐式借用将另一个表达式视为位置表达式。例如，可以直接比较两个未指定大小的[slice][切片]，因为`==`运算符会隐式借用其操作数：

```rust
# let c = [1, 2, 3];
# let d = vec![1, 2, 3];
let a: &[i32];
let b: &[i32];
# a = &c;
# b = &d;
// ...
*a == *b;
// Equivalent form:
::std::cmp::PartialEq::eq(&*a, &*b);
```

<a id="expr.implicit-borrow.application"></a> 以下表达式中可能包含隐式借用：

* [方法调用] 表达式中的左操作数。 * [字段] 表达式中的左操作数。 * [调用表达式] 中的左操作数。 * [数组索引] 表达式中的左操作数。 * [解引用运算符][deref] (`*`) 的操作数。 * [比较] 的操作数。 * [复合赋值] 的左操作数。 * [`format_args!`] 的参数，格式字符串除外。

<a id="expr.overload"></a>
## 特征重载

许多以下运算符和表达式也可以通过 `std::ops` 或 `std::cmp` 中的特征对其他类型进行重载。这些特征同样存在于 `core::ops` 和 `core::cmp` 中，名称相同。

<a id="expr.attr"></a>
## 表达式属性

<a id="expr.attr.restriction"></a> [外部属性] 在表达式之前仅允许在少数特定情况下使用：

* 在用作[语句]的表达式之前。 * [数组表达式}、[元组表达式}、[调用表达式]和元组式[结构]表达式的元素。 * [块表达式]的尾部表达式。
<!-- Keep list in sync with block-expr.md -->

<a id="expr.attr.never-before"></a> 以下情况禁止在前面使用： * [范围] 表达式。 * 二元运算符表达式（[算术或逻辑表达式}、[比较表达式}、[延迟布尔表达式}、[类型转换表达式}、[赋值表达式}、[复合赋值表达式]）。

[`format_args!`]:       core::format_args
[`pin!`]:               core::pin::pin
[array indexing expression]: expr.array.index
[extended]:             destructors.scope.lifetime-extension
[extending expression]: destructors.scope.lifetime-extension.exprs
[extending expressions]: destructors.scope.lifetime-extension.exprs
[field expression]:     expr.field
[implicitly borrowed]:  expr.implicit-borrow
[macro invocations]:    macro.invocation
[place expression contexts]: expr.place-value
[Structs]:              expr.struct
[temporaries]:          expr.temporary
[temporary scopes]:     destructors.scope.temporary
[tuple indexing expression]: expr.tuple-index
[Tuple structs]:        items.struct.tuple
[Unit structs]:         items.struct.unit
[value expression context]: expr.place-value
[value expression]:     expr.place-value

[`Box<T>`]:             special-types-and-traits.md#boxt
[`Copy`]:               special-types-and-traits.md#copy
[`Drop`]:               special-types-and-traits.md#drop
[`if let`]:             expressions/if-expr.md#if-let-patterns
[`Sized`]:              special-types-and-traits.md#sized
[`while let`]:          expressions/loop-expr.md#while-let-patterns
[array expressions]:    expressions/array-expr.md
[array indexing]:       expressions/array-expr.md#array-and-slice-indexing-expressions
[assign]:               expressions/operator-expr.md#assignment-expressions
[block expressions]:    expressions/block-expr.md
[borrow]:               expressions/operator-expr.md#borrow-operators
[call expressions]:     expressions/call-expr.md
[comparison]:           expressions/operator-expr.md#comparison-operators
[compound assignment]:  expressions/operator-expr.md#compound-assignment-expressions
[deref]:                expressions/operator-expr.md#the-dereference-operator
[destructors]:          destructors.md
[drop scope]:           destructors.md#drop-scopes
[field]:                expressions/field-expr.md
[functional update]:    expressions/struct-expr.md#functional-update-syntax
[implicit borrow]:      #implicit-borrows
[implicitly mutably borrowed]: #implicit-borrows
[interior mutability]:  interior-mutability.md
[let statement]:        statements.md#let-statements
[match]:                expressions/match-expr.md
[method-call]:          expressions/method-call-expr.md
[Mutable `static` items]: items/static-items.md#mutable-statics
[Outer attributes]:     attributes.md
[paths]:                expressions/path-expr.md
[promoted]:             destructors.md#constant-promotion
[Range]:                expressions/range-expr.md
[raw borrow]:           expressions/operator-expr.md#raw-borrow-operators
[scrutinee]:            glossary.md#scrutinee
[slice]:                types/slice.md
[statement]:            statements.md
[static variables]:     items/static-items.md
[struct]:               expressions/struct-expr.md
[Temporary values]:     #temporaries
[tuple expressions]:    expressions/tuple-expr.md
[Tuples]:               expressions/tuple-expr.md
[Underscores]:          expressions/underscore-expr.md
[Variables]:            variables.md
