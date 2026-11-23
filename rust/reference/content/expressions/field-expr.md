<a id="expr.field"></a>
# 字段访问表达式

<a id="expr.field.syntax"></a> 
```grammar,expressions
FieldExpression -> Expression `.` IDENTIFIER
```

<a id="expr.field.intro"></a> 一个 *字段表达式* 是一个 [位置表达式]，其值为 [结构] 或 [联合体] 中某个字段的位置。

<a id="expr.field.mut"></a> 当操作数为 [可变的] 时，该字段表达式也是可变的。

<a id="expr.field.form"></a> 字段表达式的语法是一个称为 *容器操作数* 的表达式，然后是一个 `.`，最后是一个 [标识符]。

<a id="expr.field.not-method-call"></a> 字段表达式后面不能跟随由逗号分隔的表达式列表，因为这将被解析为 [方法调用表达式]。也就是说，它们不能成为 [调用表达式] 的函数操作数。

> [!NOTE]
> Wrap the field expression in a [parenthesized expression] to use it in a call expression.
>
> ```rust
> # struct HoldsCallable<F: Fn()> { callable: F }
> let holds_callable = HoldsCallable { callable: || () };
>
> // Invalid: Parsed as calling the method "callable"
> // holds_callable.callable();
>
> // Valid
> (holds_callable.callable)();
> ```

Examples:

<!-- ignore: needs lots of support code -->
```rust,ignore
mystruct.myfield;
foo().x;
(Struct {a: 10, b: 20}).a;
(mystruct.function_field)() // Call expression containing a field expression
```

<a id="expr.field.autoref-deref"></a>
## 自动解引用

如果容器操作数的类型实现了 [`Deref`]或 [`DerefMut`] depending on whether the operand is [mutable]，则 *自动解引用* 会按需要多次进行，以使得字段访问成为可能。这一过程也被称为 *自解引用*。

<a id="expr.field.borrow"></a>
## 借用

在借用时，结构中的字段或结构的引用被视为独立的实体。如果结构未实现 [`Drop`]并且存储在局部变量中，则对其每个字段的移动也适用此规则。但如果通过除 [`Box`]之外的用户定义类型进行自动解引用，则不适用此规则。

```rust
struct A { f1: String, f2: String, f3: String }
let mut x: A;
# x = A {
#     f1: "f1".to_string(),
#     f2: "f2".to_string(),
#     f3: "f3".to_string()
# };
let a: &mut String = &mut x.f1; // x.f1 borrowed mutably
let b: &String = &x.f2;         // x.f2 borrowed immutably
let c: &String = &x.f2;         // Can borrow again
let d: String = x.f3;           // Move out of x.f3
```

[`Box`]: ../special-types-and-traits.md#boxt
[`Deref`]: ../special-types-and-traits.md#deref-and-derefmut
[`drop`]: ../special-types-and-traits.md#drop
[identifier]: ../identifiers.md
[call expression]: call-expr.md
[method call expression]: method-call-expr.md
[mutable]: ../expressions.md#mutability
[parenthesized expression]: grouped-expr.md
[place expression]: ../expressions.md#place-expressions-and-value-expressions
[struct]: ../items/structs.md
[union]: ../items/unions.md
