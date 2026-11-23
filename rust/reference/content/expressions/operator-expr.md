<a id="expr.operator"></a>
# 运算符表达式

<a id="expr.operator.syntax"></a> 
```grammar,expressions
OperatorExpression ->
      BorrowExpression
    | DereferenceExpression
    | TryPropagationExpression
    | NegationExpression
    | ArithmeticOrLogicalExpression
    | ComparisonExpression
    | LazyBooleanExpression
    | TypeCastExpression
    | AssignmentExpression
    | CompoundAssignmentExpression
```

<a id="expr.operator.intro"></a> 运算符由 Rust 语言为内置类型定义。

<a id="expr.operator.trait"></a> 以下许多运算符也可以通过 `std::ops` 或 `std::cmp` 中的特质来重载。

<a id="expr.operator.int-overflow"></a>
## 溢出

<a id="expr.operator.int-overflow.intro"></a> 在调试模式下编译时，整数运算符发生溢出时会引发 panic。可以使用 `-C debug-assertions` 和 `-C overflow-checks` 编译器选项更直接地控制此行为。以下情况被视为溢出：

<a id="expr.operator.int-overflow.binary-arith"></a> * 当 `+`、`*` 或二进制 `-` 产生的值大于可存储的最大值或小于最小值时。

<a id="expr.operator.int-overflow.unary-neg"></a> * 将一元 `-` 应用于任何有符号整数类型的最负值，除非操作数是 [字面表达式](#Literalexpression)（或单独出现在一个或多个 [分组表达式][grouped expression] 中的字面表达式）。

<a id="expr.operator.int-overflow.div"></a> * 使用 `/` 或 `%`，其中左操作数为有符号整数类型的最小整数值，右操作数为 `-1`。即使禁用 `-C overflow-checks`，出于历史原因这些检查仍然会进行。

<a id="expr.operator.int-overflow.shift"></a> * 使用 `<<` 或 `>>`，其中右操作数大于或等于左操作数类型的位数或为负值。

> [!NOTE]
> The exception for literal expressions behind unary `-` means that forms such as `-128_i8` or `let j: i8 = -(128)` never cause a panic and have the expected value of -128.
>
> In these cases, the literal expression already has the most negative value for its type (for example, `128_i8` has the value -128) because integer literals are truncated to their type per the description in [Integer literal expressions][literal expression].
>
> Negation of these most negative values leaves the value unchanged due to two's complement overflow conventions.
>
> In `rustc`, these most negative expressions are also ignored by the `overflowing_literals` lint check.

<a id="expr.operator.borrow"></a>
## 借用运算符

<a id="expr.operator.borrow.syntax"></a> 
```grammar,expressions
BorrowExpression ->
      (`&`|`&&`) Expression
    | (`&`|`&&`) `mut` Expression
    | (`&`|`&&`) `raw` `const` Expression
    | (`&`|`&&`) `raw` `mut` Expression
```

<a id="expr.operator.borrow.intro"></a> `&`（共享借用）和 `&mut`（可修改借用）运算符是一元前缀运算符。

<a id="expr.operator.borrow.result"></a> 当应用于 [位置表达式] 时，该表达式产生指向值所在位置的引用（指针）。

<a id="expr.operator.borrow.生命周期"></a> 在引用期间，内存位置也会被置于借用状态。对于共享借用（`&`），这意味着该位置不可被修改，但可以被读取或再次共享。对于可变借用（`&mut`），在借用过期之前，该位置不得以任何方式访问。

<a id="expr.operator.borrow.mut"></a> `&mut` 会在可变位置表达式上下文中评估其操作数。

<a id="expr.operator.borrow.temporary"></a> 如果对 [值表达式] 应用 `&` 或 `&mut` 运算符，则会创建一个 [临时值]。

这些运算符不能进行重载。

```rust
{
    // a temporary with value 7 is created that lasts for this scope.
    let shared_reference = &7;
}
let mut array = [-2, 3, 9];
{
    // Mutably borrows `array` for this scope.
    // `array` may only be used through `mutable_reference`.
    let mutable_reference = &mut array;
}
```

<a id="expr.borrow.and-and-syntax"></a> 尽管 `&&` 是一个单独的符号（[懒惰的“and”运算符](#lazy-boolean-operators)），但在借用表达式的上下文中，它实际上相当于两个借用操作。

```rust
// same meanings:
let a = &&  10;
let a = & & 10;

// same meanings:
let a = &&&&  mut 10;
let a = && && mut 10;
let a = & & & & mut 10;
```

<a id="expr.borrow.raw"></a>
### 原始借用运算符

<a id="expr.borrow.raw.intro"></a> `&raw const` 和 `&raw mut` 是 *原始借用运算符*。

<a id="expr.borrow.raw.place"></a> 这些运算符的操作数表达式在位置表达式上下文中被评估。

<a id="expr.borrow.raw.result"></a> `&raw const expr` 会创建一个类型为 `*const T` 的常量原始指针，指向给定位置；而 `&raw mut expr` 则创建一个类型为 `*mut T` 的可变原始指针。

<a id="expr.borrow.raw.invalid-ref"></a> 当位置表达式可能评估为一个未正确对齐或根据其类型无法存储有效值的位置时，或者创建引用会引入错误的别名假设时，必须使用原始借用运算符而不是借用运算符。在这种情况下，使用借用运算符会导致 [未定义行为]，因为会创建一个无效的引用，但仍然可以构造原始指针。

以下是通过 `packed` 结构体创建指向未对齐位置的原始指针的示例：

```rust
#[repr(packed)]
struct Packed {
    f1: u8,
    f2: u16,
}

let packed = Packed { f1: 1, f2: 2 };
// `&packed.f2` would create an unaligned reference, and thus be undefined behavior!
let raw_f2 = &raw const packed.f2;
assert_eq!(unsafe { raw_f2.read_unaligned() }, 2);
```

以下是创建指向不包含有效值的位置的原始指针的示例：

```rust
use std::mem::MaybeUninit;

struct Demo {
    field: bool,
}

let mut uninit = MaybeUninit::<Demo>::uninit();
// `&uninit.as_mut().field` would create a reference to an uninitialized `bool`,
// and thus be undefined behavior!
let f1_ptr = unsafe { &raw mut (*uninit.as_mut_ptr()).field };
unsafe { f1_ptr.write(true); }
let init = unsafe { uninit.assume_init() };
```

<a id="expr.deref"></a>
## 解引用运算符

<a id="expr.deref.syntax"></a> 
```grammar,expressions
DereferenceExpression -> `*` Expression
```

<a id="expr.deref.intro"></a> `*`（解引用）运算符也是一个一元前缀运算符。

<a id="expr.deref.result"></a> 当应用于 [指针](../types/pointer.md) 或 [`Box`] 时，表示被指向的位置。

<a id="expr.deref.mut"></a> 如果表达式的类型为 `&mut T`、`*mut T` 或 `Box<T`，并且是局部变量、局部变量的（嵌套）字段或可变的 [位置表达式]，则可以将结果内存位置赋值给该变量。

<a id="expr.deref.box"></a> 当应用于 [`Box`] 时，结果位置可以被 [移动]。

<a id="expr.deref.safety"></a> 对原始指针进行解引用需要 `unsafe`。

<a id="expr.deref.traits"></a> 对于非指针类型，`*x` 在 [不可变位置表达式上下文](../expressions.md#mutability) 中相当于 `*std::ops::Deref::deref(&x)`，在可变位置表达式上下文中则相当于 `*std::ops::DerefMut::deref_mut(&mut x)`。不过，当 `*x` 经历 [临时生命周期扩展] 时，解引用后的表达式 `x` 的 [临时作用域] 也会被扩展。

```rust
# struct NoCopy;
let a = &7;
assert_eq!(*a, 7);
let b = &mut 9;
*b = 11;
assert_eq!(*b, 11);
let c = Box::new(NoCopy);
let d: NoCopy = *c;
```

```rust
// The temporary holding the result of `String::new()` is extended
// to live to the end of the block, so `x` may be used in subsequent
// statements.
let x = &*String::new();
# x;
```

```rust,compile_fail,E0716
// The temporary holding the result of `String::new()` is dropped at
// the end of the statement, so it's an error to use `y` after.
let y = &*std::ops::Deref::deref(&String::new()); // ERROR
# y;
```

<a id="expr.try"></a>
## try传播表达式

<a id="expr.try.syntax"></a> 
```grammar,expressions
TryPropagationExpression -> Expression `?`
```

<a id="expr.try.intro"></a> try传播表达式利用内部表达式的值和 [`Try`] trait来决定是否生成值，如果生成，则生成什么值，或者是否向调用者返回值，如果返回，则返回什么值。

> [!EXAMPLE]
> ```rust
> # use std::num::ParseIntError;
> fn try_to_parse() -> Result<i32, ParseIntError> {
>     let x: i32 = "123".parse()?; // `x` is `123`.
>     let y: i32 = "24a".parse()?; // Returns an `Err()` immediately.
>     Ok(x + y)                    // Doesn't run.
> }
>
> let res = try_to_parse();
> println!("{res:?}");
> # assert!(res.is_err())
> ```
>
> ```rust
> fn try_option_some() -> Option<u8> {
>     let val = Some(1)?;
>     Some(val)
> }
> assert_eq!(try_option_some(), Some(1));
>
> fn try_option_none() -> Option<u8> {
>     let val = None?;
>     Some(val)
> }
> assert_eq!(try_option_none(), None);
> ```
>
> ```rust
> use std::ops::ControlFlow;
>
> pub struct TreeNode<T> {
>     value: T,
>     left: Option<Box<TreeNode<T>>>,
>     right: Option<Box<TreeNode<T>>>,
> }
>
> impl<T> TreeNode<T> {
>     pub fn traverse_inorder<B>(&self, f: &mut impl FnMut(&T) -> ControlFlow<B>) -> ControlFlow<B> {
>         if let Some(left) = &self.left {
>             left.traverse_inorder(f)?;
>         }
>         f(&self.value)?;
>         if let Some(right) = &self.right {
>             right.traverse_inorder(f)?;
>         }
>         ControlFlow::Continue(())
>     }
> }
> #
> # fn main() {
> #     let n = TreeNode {
> #         value: 1,
> #         left: Some(Box::new(TreeNode{value: 2, left: None, right: None})),
> #         right: None,
> #     };
> #     let v = n.traverse_inorder(&mut |t| {
> #         if *t == 2 {
> #             ControlFlow::Break("found")
> #         } else {
> #             ControlFlow::Continue(())
> #         }
> #     });
> #     assert_eq!(v, ControlFlow::Break("found"));
> # }
> ```

> [!NOTE]
> The [`Try`] trait is currently unstable, and thus cannot be implemented for user types.
>
> The try propagation expression is currently roughly equivalent to:
>
> ```rust
> # #![ feature(try_trait_v2) ]
> # fn example() -> Result<(), ()> {
> # let expr = Ok(());
> match core::ops::Try::branch(expr) {
>     core::ops::ControlFlow::Continue(val) => val,
>     core::ops::ControlFlow::Break(residual) =>
>         return core::ops::FromResidual::from_residual(residual),
> }
> # Ok(())
> # }
> ```

> [!NOTE]
> The try propagation operator is sometimes called *the question mark operator*, *the `?` operator*, or *the try operator*.

<a id="expr.try.restricted-types"></a> try传播运算符可以应用于具有以下类型的表达式：

- [`Result<T, E>`] - `Result::Ok(val)` 的求值结果为 `val`。- `Result::Err(e)` 返回 `Result::Err(From::from(e))`。- [`Option<T>`] - `Option::Some(val)` 的求值结果为 `val`。- `Option::None` 返回 `Option::None`。- [`ControlFlow<B, C>`][core::ops::ControlFlow] - `ControlFlow::Continue(c)` 的求值结果为 `c`。- `ControlFlow::Break(b)` 返回 `ControlFlow::Break(b)`。- [`Poll<Result<T, E>>`][core::task::Poll] - `Poll::Ready(Ok(val))` 的求值结果为 `Poll::Ready(val)`。- `Poll::Ready(Err(e))` 返回 `Poll::Ready(Err(From::from(e)))`。- `Poll::Pending` 的求值结果为 `Poll::Pending`。- [`Poll<Option<Result<T, E>>>`][`core::task::Poll`] - `Poll::Ready(Some(Ok(val)))` 的求值结果为 `Poll::Ready(Some(val))`。- `Poll::Ready(Some(Err(e)))` 返回 `Poll::Ready(Some(Err(From::from(e))))`。- `Poll::Ready(None)` 的求值结果为 `Poll::Ready(None)`。- `Poll::Pending` 的求值结果为 `Poll::Pending`。

<a id="expr.negate"></a>
## 取反运算符

<a id="expr.negate.syntax"></a> 
```grammar,expressions
NegationExpression ->
      `-` Expression
    | `!` Expression
```

<a id="expr.negate.intro"></a> 这是最后两个一元运算符。

<a id="expr.negate.results"></a> 此表总结了它们在基本类型上的行为以及哪些特性用于为其他类型重载这些运算符。请注意，有符号整数始终使用二进制补码表示。所有这些运算符的操作数都在 [值表达式上下文][value expression] 中求值，因此会被移动或复制。

| Symbol | Integer     | `bool`        | Floating Point | Overloading Trait  |
|--------|-------------|-------------- |----------------|--------------------|
| `-`    | Negation*   |               | Negation       | `std::ops::Neg`    |
| `!`    | Bitwise NOT | [Logical NOT] |                | `std::ops::Not`    |

\* 仅适用于有符号整数类型。

以下是这些运算符的一些示例

```rust
let x = 6;
assert_eq!(-x, -6);
assert_eq!(!x, -7);
assert_eq!(true, !false);
```

<a id="expr.arith-logic"></a>
## 算术和逻辑二元运算符

<a id="expr.arith-logic.syntax"></a> 
```grammar,expressions
ArithmeticOrLogicalExpression ->
      Expression `+` Expression
    | Expression `-` Expression
    | Expression `*` Expression
    | Expression `/` Expression
    | Expression `%` Expression
    | Expression `&` Expression
    | Expression `|` Expression
    | Expression `^` Expression
    | Expression `<<` Expression
    | Expression `>>` Expression
```

<a id="expr.arith-logic.intro"></a> 二元运算符表达式都采用插入式表示法书写。

<a id="expr.arith-logic.behavior"></a> 此表总结了算术和逻辑二元运算符在基本类型上的行为以及哪些特性用于为其他类型重载这些运算符。请注意，有符号整数始终使用二进制补码表示。所有这些运算符的操作数都在 [值表达式上下文][value expression] 中求值，因此会被移动或复制。

| Symbol | Integer                 | `bool`        | Floating Point | Overloading Trait  | Overloading Compound Assignment Trait |
|--------|-------------------------|---------------|----------------|--------------------| ------------------------------------- |
| `+`    | Addition                |               | Addition       | `std::ops::Add`    | `std::ops::AddAssign`                 |
| `-`    | Subtraction             |               | Subtraction    | `std::ops::Sub`    | `std::ops::SubAssign`                 |
| `*`    | Multiplication          |               | Multiplication | `std::ops::Mul`    | `std::ops::MulAssign`                 |
| `/`    | Division*†              |               | Division       | `std::ops::Div`    | `std::ops::DivAssign`                 |
| `%`    | Remainder**†            |               | Remainder      | `std::ops::Rem`    | `std::ops::RemAssign`                 |
| `&`    | Bitwise AND             | [Logical AND] |                | `std::ops::BitAnd` | `std::ops::BitAndAssign`              |
| `\|` | Bitwise OR | [Logical OR]  |                | `std::ops::BitOr`  | `std::ops::BitOrAssign`               |
| `^`    | Bitwise XOR             | [Logical XOR] |                | `std::ops::BitXor` | `std::ops::BitXorAssign`              |
| `<<`   | Left Shift              |               |                | `std::ops::Shl`    | `std::ops::ShlAssign`                 |
| `>>`   | Right Shift***          |               |                | `std::ops::Shr`    |  `std::ops::ShrAssign`                |

\* 整数除法向零方向取整。

\*\* Rust 使用由 [截断除法](https://en.wikipedia.org/wiki/Modulooperation#Variants_of_the_definition) 定义的余数。给定 `remainder = dividend % divisor`，余数的符号与被除数相同。

\*\*\* 有符号整数类型采用算术右移，无符号整数类型采用逻辑右移。

† 对于整数类型，除以零会引发恐慌。

以下是这些运算符使用的示例。

```rust
assert_eq!(3 + 6, 9);
assert_eq!(5.5 - 1.25, 4.25);
assert_eq!(-5 * 14, -70);
assert_eq!(14 / 3, 4);
assert_eq!(100 % 7, 2);
assert_eq!(0b1010 & 0b1100, 0b1000);
assert_eq!(0b1010 | 0b1100, 0b1110);
assert_eq!(0b1010 ^ 0b1100, 0b110);
assert_eq!(13 << 3, 104);
assert_eq!(-10 >> 2, -3);
```

<a id="expr.cmp"></a>
## 比较运算符

<a id="expr.cmp.syntax"></a> 
```grammar,expressions
ComparisonExpression ->
      Expression `==` Expression
    | Expression `!=` Expression
    | Expression `>` Expression
    | Expression `<` Expression
    | Expression `>=` Expression
    | Expression `<=` Expression
```

<a id="expr.cmp.intro"></a> 比较运算符也被定义为原始类型和标准库中的许多类型。

<a id="expr.cmp.paren-chaining"></a> 在链接比较运算符时需要使用括号。例如，表达式 `a == b == c` 是无效的，可以写作 `(a == b) == c`。

<a id="expr.cmp.trait"></a> 与算术和逻辑运算符不同，这些运算符的重载特征被更广泛地使用，以表明类型如何被比较，并且很可能被假设为由使用这些特征的函数定义的实际比较。标准库中的许多函数和宏就可以利用这一假设（尽管不是为了确保安全性）。

<a id="expr.cmp.place"></a> 与上述算术和逻辑运算符不同，这些运算符隐式地共享操作数的借用，并在 [位置表达式上下文][place expression] 中评估它们：

```rust
# let a = 1;
# let b = 1;
a == b;
// is equivalent to
::std::cmp::PartialEq::eq(&a, &b);
```

这意味着操作数不必被移出该上下文。

<a id="expr.cmp.behavior"></a> 

| Symbol | Meaning                  | Overloading method         |
|--------|--------------------------|----------------------------|
| `==`   | Equal                    | `std::cmp::PartialEq::eq`  |
| `!=`   | Not equal                | `std::cmp::PartialEq::ne`  |
| `>`    | Greater than             | `std::cmp::PartialOrd::gt` |
| `<`    | Less than                | `std::cmp::PartialOrd::lt` |
| `>=`   | Greater than or equal to | `std::cmp::PartialOrd::ge` |
| `<=`   | Less than or equal to    | `std::cmp::PartialOrd::le` |

以下是比较运算符使用的示例。

```rust
assert!(123 == 123);
assert!(23 != -12);
assert!(12.5 > 12.2);
assert!([1, 2, 3] < [1, 3, 4]);
assert!('A' <= 'B');
assert!("World" >= "Hello");
```

<a id="expr.bool-logic"></a>
## 惰性布尔运算符

<a id="expr.bool-logic.syntax"></a> 
```grammar,expressions
LazyBooleanExpression ->
      Expression `||` Expression
    | Expression `&&` Expression
```

<a id="expr.bool-logic.intro"></a> 运算符 `||` 和 `&&` 可以应用于布尔类型操作数。`||` 运算符表示逻辑‘或’，而 `&&` 运算符表示逻辑‘与’。

<a id="expr.bool-logic.conditional-evaluation"></a> 它们与 `|` 和 `&` 的不同之处在于，当左手操作数尚未确定表达式结果时，右手操作数才会被计算。也就是说，`||` 仅在左手操作数为 `false` 时计算其右手操作数，而 `&&` 仅在左手操作数为 `true` 时计算其右手操作数。

```rust
let x = false || true; // true
let y = false && panic!(); // false, doesn't evaluate `panic!()`
```

<a id="expr.as"></a>
## 类型转换表达式

<a id="expr.as.syntax"></a> 
```grammar,expressions
TypeCastExpression -> Expression `as` TypeNoBounds
```

<a id="expr.as.intro"></a> 类型转换表达式由二元运算符 `as` 表示。

<a id="expr.as.result"></a> 执行 `as` 表达式会将左侧的值转换为右侧的类型。

`as` 表达式的一个示例：

```rust
# fn sum(values: &[f64]) -> f64 { 0.0 }
# fn len(values: &[f64]) -> i32 { 0 }
fn average(values: &[f64]) -> f64 {
    let sum: f64 = sum(values);
    let size: f64 = len(values) as f64;
    sum / size
}
```

<a id="expr.as.coercions"></a> `as` 可用于显式执行 [强制类型转换](../type-coercions.md)，以及以下额外的转换。任何不符合强制类型规则或表格中条目类型的转换都会引发编译错误。这里 `*T` 表示 `*const T` 或 `*mut T`。`m` 代表引用类型中的可选 `mut`，指针类型中的 `mut` 或 `const`。

| Type of `e`           | `U`                   | Cast performed by `e as U`                            |
|-----------------------|-----------------------|-------------------------------------------------------|
| Integer or Float type | Integer or Float type | [Numeric cast][expr.as.numeric]                       |
| Enumeration           | Integer type          | [Enum cast][expr.as.enum]                             |
| `bool` or `char`      | Integer type          | [Primitive to integer cast][expr.as.bool-char-as-int] |
| `u8`                  | `char`                | [`u8` to `char` cast][expr.as.u8-as-char]             |
| `*T`                  | `*V` (when [compatible][expr.as.pointer]) | [Pointer to pointer cast][expr.as.pointer] |
| `*T` where `T: Sized` | Integer type          | [Pointer to address cast][expr.as.pointer-as-int]     |
| Integer type          | `*V` where `V: Sized` | [Address to pointer cast][expr.as.int-as-pointer]     |
| `&m₁ [T; n]`          | `*m₂ T` [^lessmut]    | Array to pointer cast                                 |
| `*m₁ [T; n]`          | `*m₂ T` [^lessmut]    | Array to pointer cast                                 |
| [Function item]       | [Function pointer]    | Function item to function pointer cast                |
| [Function item]       | `*V` where `V: Sized` | Function item to pointer cast                         |
| [Function item]       | Integer               | Function item to address cast                         |
| [Function pointer]    | `*V` where `V: Sized` | Function pointer to pointer cast                      |
| [Function pointer]    | Integer               | Function pointer to address cast                      |
| Closure [^no-capture] | Function pointer      | Closure to function pointer cast                      |



### Semantics

<a id="expr.as.numeric"></a>
#### 数值转换

<a id="expr.as.numeric.int-same-size"></a> * 相同大小的两个整数之间的转换（例如 i32 -> u32）是无操作的（Rust 对固定整数的负数使用补码表示法）

  ```rust
  assert_eq!(42i8 as u8, 42u8);
  assert_eq!(-1i8 as u8, 255u8);
  assert_eq!(255u8 as i8, -1i8);
  assert_eq!(-1i16 as u16, 65535u16);
  ```

<a id="expr.as.numeric.int-truncation"></a> * 从较大整数转换为较小整数（例如 u32 -> u8）会进行截断

  ```rust
  assert_eq!(42u16 as u8, 42u8);
  assert_eq!(1234u16 as u8, 210u8);
  assert_eq!(0xabcdu16 as u8, 0xcdu8);

  assert_eq!(-42i16 as i8, -42i8);
  assert_eq!(1234u16 as i8, -46i8);
  assert_eq!(0xabcdi32 as i8, -51i8);
  ```

<a id="expr.as.numeric.int-extension"></a> * 从小整数转换为大整数（例如 u8 -> u32）如果源为无符号数则进行零扩展，如果源为有符号数则进行符号扩展

  ```rust
  assert_eq!(42i8 as i16, 42i16);
  assert_eq!(-17i8 as i16, -17i16);
  assert_eq!(0b1000_1010u8 as u16, 0b0000_0000_1000_1010u16, "Zero-extend");
  assert_eq!(0b0000_1010i8 as i16, 0b0000_0000_0000_1010i16, "Sign-extend 0");
  assert_eq!(0b1000_1010u8 as i8 as i16, 0b1111_1111_1000_1010u16 as i16, "Sign-extend 1");
  ```

<a id="expr.as.numeric.float-as-int"></a> * 将浮点数转换为整数时，会将其向零方向四舍五入 * `NaN` 将返回 `0` * 大于最大整数值的值，包括 `INFINITY`，将会饱和到该整数类型的最大值。 * 小于最小整数值的值，包括 `NEG_INFINITY`，将会饱和到该整数类型的最小值。

  ```rust
  assert_eq!(42.9f32 as i32, 42);
  assert_eq!(-42.9f32 as i32, -42);
  assert_eq!(42_000_000f32 as i32, 42_000_000);
  assert_eq!(f32::NAN as i32, 0);
  assert_eq!(1_000_000_000_000_000f32 as i32, 0x7fffffffi32);
  assert_eq!(f32::NEG_INFINITY as i32, -0x80000000i32);
  ```

<a id="expr.as.numeric.int-as-float"></a> * 将整数转换为浮点数时，会生成最接近的浮点数 * * 如有必要，四舍五入遵循 `roundTiesToEven` 模式 \*\*\* * 在溢出情况下，将产生与输入符号相同的无穷大值 * 注意：在当前数值类型设置下，溢出仅可能发生在 `u128 as f32` 且值大于或等于 `f32::MAX + (0.5 ULP)` 时。

  ```rust
  assert_eq!(1337i32 as f32, 1337f32);
  assert_eq!(123_456_789i32 as f32, 123_456_790f32, "Rounded");
  assert_eq!(0xffffffff_ffffffff_ffffffff_ffffffff_u128 as f32, f32::INFINITY);
  ```

<a id="expr.as.numeric.float-widening"></a> * 将 f32 转换为 f64 是完美且无损失的。

  ```rust
  assert_eq!(1_234.5f32 as f64, 1_234.5f64);
  assert_eq!(f32::INFINITY as f64, f64::INFINITY);
  assert!((f32::NAN as f64).is_nan());
  ```

<a id="expr.as.numeric.float-narrowing"></a> * 将 f64 转换为 f32 会生成最接近的 f32 \*\* * 如有必要，四舍五入遵循 `roundTiesToEven` 模式 \*\*\* * 在溢出情况下，将产生与输入符号相同的无穷大值。

  ```rust
  assert_eq!(1_234.5f64 as f32, 1_234.5f32);
  assert_eq!(1_234_567_891.123f64 as f32, 1_234_567_890f32, "Rounded");
  assert_eq!(f64::INFINITY as f32, f32::INFINITY);
  assert!((f64::NAN as f32).is_nan());
  ```

\* 如果硬件无法原生支持这种舍入模式和溢出行为下的整数到浮点数转换，这些转换可能会比预期慢。

\*\* 如果硬件无法原生支持这种舍入模式和溢出行为下的 f64 到 f32 转换，这些转换可能会比预期慢。

\*\*\* 如 IEEE 754-2008 &sect;4.3.1 所定义：选择最近的浮点数，若两个浮点数恰好处于中间状态，则优先选择最右侧为偶数的数字。

<a id="expr.as.枚举"></a>
#### 枚举转换

<a id="expr.as.枚举.discriminant"></a> 将枚举转换为其判别式，必要时再使用数值转换。转换仅限于以下类型的枚举：

* [仅包含单位的枚举] * [无字段的枚举] 没有 [显式判别式]，或只有单位变体具有显式判别式。

```rust
enum Enum { A, B, C }
assert_eq!(Enum::A as i32, 0);
assert_eq!(Enum::B as i32, 1);
assert_eq!(Enum::C as i32, 2);
```

<a id="expr.as.枚举.no-drop"></a> 如果枚举实现了 [`Drop`] 方法，则不允许进行转换。

<a id="expr.as.bool-char-as-int"></a>
#### 原始类型到整数转换

* `false` 被转换为 `0`，`true` 被转换为 `1` * `char` 被转换为代码点的值，如果需要则进行数值转换。

```rust
assert_eq!(false as i32, 0);
assert_eq!(true as i32, 1);
assert_eq!('A' as i32, 65);
assert_eq!('Ö' as i32, 214);
```

<a id="expr.as.u8-as-char"></a>
#### `u8` 到 `char` 的转换

将值转换为对应的代码点的 `char`。

```rust
assert_eq!(65u8 as char, 'A');
assert_eq!(214u8 as char, 'Ö');
```

<a id="expr.as.pointer-as-int"></a>
#### 指针到地址的转换

从原始指针转换为整数会生成所引用内存的机器地址。如果整数类型小于指针类型，地址可能会被截断；使用 `usize` 可以避免此问题。

<a id="expr.as.int-as-pointer"></a>
#### 地址到指针的转换

从整数转换为原始指针时，会将整数解释为内存地址，并生成指向该内存的指针。

> [!WARNING]
> This interacts with the Rust memory model, which is still under development.
> A pointer obtained from this cast may suffer additional restrictions even if it is bitwise equal to a valid pointer.
> Dereferencing such a pointer may be [undefined behavior] if aliasing rules are not followed.

一个简单的有效地址算术示例：

```rust
let mut values: [i32; 2] = [1, 2];
let p1: *mut i32 = values.as_mut_ptr();
let first_address = p1 as usize;
let second_address = first_address + 4; // 4 == size_of::<i32>()
let p2 = second_address as *mut i32;
unsafe {
    *p2 += 1;
}
assert_eq!(values[1], 3);
```

<a id="expr.as.pointer"></a>
#### 指针到指针的转换

<a id="expr.as.pointer.behavior"></a> `*const T` / `*mut T` 可以转换为 `*const U` / `*mut U`，其行为如下：

<a id="expr.as.pointer.sized"></a> - 如果 `T` 和 `U` 都有大小，则指针保持原样返回。

  > [!EXAMPLE]
  > ```rust
  > let x: i32 = 42;
  > let p1: *const i32 = &x;
  > let p2: *const u8 = p1 as *const u8;
  > // The pointer address remains the same.
  > assert_eq!(p1 as usize, p2 as usize);
  > ```

<a id="expr.as.pointer.discard-metadata"></a> - 如果 `T` 没有大小而 `U` 有大小，转换会丢弃完成宽指针 `T` 的所有 [元数据]，并生成由无大小指针的数据部分组成的薄指针 `U`。

  > [!EXAMPLE]
  > ```rust
  > let slice: &[i32] = &[1, 2, 3];
  > let ptr: *const [i32] = slice as *const [i32];
  > // Cast from wide pointer (*const [i32]) to thin pointer (*const i32)
  > // discarding the length metadata.
  > let data_ptr: *const i32 = ptr as *const i32;
  > assert_eq!(unsafe { *data_ptr }, 1);
  > ```

<a id="expr.as.pointer.unsized.unchanged"></a> - 如果 `T` 和 `U` 都没有大小，则指针也保持原样返回。特别是，元数据完全保留。只有当元数据符合以下规则时才能进行转换：

<a id="expr.as.pointer.unsized.slice"></a> - 当 `T` 和 `U` 没有大小且带有切片元数据时，它们总是兼容的。切片的元数据是元素数量，因此 `*[u16] -> *[u8]` 的转换是合法的，但会导致字节数减少一半。

  > [!EXAMPLE]
  > ```rust
  > let slice: &[u16] = &[1, 2, 3];
  > let ptr: *const [u16] = slice as *const [u16];
  > let byte_ptr: *const [u8] = ptr as *const [u8];
  > assert_eq!(byte_ptr.len(), 3);
  > ```

<a id="expr.as.pointer.unsized.trait"></a> - 当 `T` 和 `U` 没有大小且带有特质对象元数据时，仅当满足以下所有条件时，元数据才兼容：1. 主特质必须相同。

     > [!EXAMPLE]
     > ```rust,compile_fail,E0606
     > trait Foo {}
     > trait Bar {}
     > impl Foo for i32 {}
     > impl Bar for i32 {}
     >
     > let x: i32 = 42;
     > let ptr_foo: *const dyn Foo = &x as *const dyn Foo;
     > // You can't cast to a different principal trait.
     > let ptr_bar: *const dyn Bar = ptr_foo as *const dyn Bar; // ERROR
     > ```


  2. Auto traits 可以被移除。

     > [!EXAMPLE]
     > ```rust
     > trait Foo {}
     > struct S;
     > impl Foo for S {}
     > unsafe impl Send for S {}
     >
     > let s = S;
     > let ptr_send: *const (dyn Foo + Send) = &s;
     > // Removing an auto trait.
     > let ptr_no_send: *const dyn Foo = ptr_send as *const dyn Foo;
     > ```


  3. Auto traits 只能作为主特质的超特质被添加。

     > [!EXAMPLE]
     > ```rust
     > trait Foo: Send {}
     > struct S;
     > impl Foo for S {}
     > unsafe impl Send for S {}
     >
     > let s = S;
     > let ptr_no_send: *const dyn Foo = &s;
     > // Adding an auto trait.
     > let ptr_send: *const (dyn Foo + Send) = ptr_no_send as *const (dyn Foo + Send);
     > ```
     >
     > ```rust,compile_fail,E0804
     > trait Foo {}
     > # struct S;
     > # impl Foo for S {}
     > # unsafe impl Send for S {}
     > #
     > # let s = S;
     > # let ptr_no_send: *const dyn Foo = &s;
     > // Same as above, except trait Foo does not have Send as a super trait.
     > let ptr_send: *const (dyn Foo + Send) = ptr_no_send as *const (dyn Foo + Send); // ERROR
     > ```


  4. 尾随生命周期只能被缩短。

     > [!EXAMPLE]
     > ```rust
     > trait Foo {}
     >
     > fn shorten_lifetime<'long: 'short, 'short>(
     >     ptr: *const (dyn Foo + 'long),
     > ) -> *const (dyn Foo + 'short) {
     >     // Shortening the lifetime is allowed.
     >     ptr as *const (dyn Foo + 'short)
     > }
     > ```
     >
     > ```rust,compile_fail
     > trait Foo {}
     >
     > fn lengthen_lifetime<'long: 'short, 'short>(
     >     ptr: *const (dyn Foo + 'short),
     > ) -> *const (dyn Foo + 'long) {
     >     // It is not allowed to cast to a longer lifetime.
     >     ptr as *const (dyn Foo + 'long) // ERROR
     > }
     > ```

  5. 泛型（包括生命周期）和关联类型必须完全匹配。

     > [!EXAMPLE]
     > ```rust,compile_fail,E0606
     > trait Generic<T> {}
     > impl Generic<i32> for () {}
     > impl Generic<u32> for () {}
     >
     > let x = ();
     > let ptr_i32: *const dyn Generic<i32> = &x;
     > // You can't cast to a different generic parameter.
     > let ptr_u32: *const dyn Generic<u32> = ptr_i32 as *const dyn Generic<u32>; // ERROR
     > ```
     >
     > ```rust
     > trait HasType {
     >     type Output;
     > }
     >
     > trait Generic<'x, T> {}
     >
     > fn cast_via_associated<'a, 'b, A, B>(
     >     ptr: *const dyn Generic<'a, A::Output>,
     > ) -> *const dyn Generic<'b, B::Output>
     > where
     >     'a: 'b,
     >     'b: 'a,
     >     A: HasType,
     >     B: HasType<Output = A::Output>, // Forces equality
     > {
     >     ptr as *const dyn Generic<'b, B::Output>
     > }
     > ```



<a id="expr.as.pointer.unsized.compound"></a> - 当 `T` 或 `U` 是一个其最后一个字段为未定义大小的结构体或元组类型时，它具有与最后一个字段相同的元数据及兼容性规则。

  > [!EXAMPLE]
  > ```rust
  > struct Wrapper(u32, [u8]);
  >
  > let slice: &[u8] = &[1, 2, 3];
  > let ptr: *const [u8] = slice;
  >
  > // The metadata (length 3) is preserved when casting to a struct
  > // where the last field is the unsized type `[u8]`.
  > let wrapper_ptr: *const Wrapper = ptr as *const Wrapper;
  >
  > // And preserved when casting back.
  > let ptr_back: *const [u8] = wrapper_ptr as *const [u8];
  > assert_eq!(ptr_back.len(), 3);
  > ```

<a id="expr.assign"></a>
## 赋值表达式

<a id="expr.assign.syntax"></a> 
```grammar,expressions
AssignmentExpression -> Expression `=` Expression
```

<a id="expr.assign.intro"></a> 一个*赋值表达式*将值移动到指定的位置。

<a id="expr.assign.assignee"></a> 赋值表达式由一个[可变的][目标表达式]，即*目标操作数*，接着是等号（`=`），以及一个[值表达式]，即*被赋的值操作数*组成。

<a id="expr.assign.behavior-basic"></a> 在其最基本的形式中，目标表达式是一个[位置表达式]，我们将首先讨论这种情况。

<a id="expr.assign.behavior-destructuring"></a> 分解赋值更一般的情况将在下文中讨论，但这种情况总是分解为对位置表达式的连续赋值，这可以被视为更基本的情形。

<a id="expr.assign.basic"></a>
### 基本赋值

<a id="expr.assign.evaluation-order"></a> 评估赋值表达式首先会评估其操作数。被赋的值操作数优先被评估，然后是目标表达式。

<a id="expr.assign.destructuring-order"></a> 对于分解赋值，目标表达式的子表达式从左到右依次被评估。

> [!NOTE]
> This is different than other expressions in that the right operand is evaluated before the left one.

<a id="expr.assign.drop-target"></a> 然后它具有先[丢弃]位于被赋位置的值的效果，除非该位置是一个未初始化的局部变量或局部变量的一个未初始化字段。

<a id="expr.assign.behavior"></a> 接下来它要么[复制或移动]被赋的值到被赋的位置。

<a id="expr.assign.result"></a> 赋值表达式总是产生[单位值][unit]。

Example:

```rust
let mut x = 0;
let y = 0;
x = y;
```

<a id="expr.assign.destructure"></a>
### 分解赋值

<a id="expr.assign.destructure.intro"></a> 解构赋值是变量声明中模式匹配解构的对应方式，允许对复杂值进行赋值，例如元组或结构体。例如，我们可以交换两个可变的变量：

```rust
let (mut a, mut b) = (0, 1);
// Swap `a` and `b` using destructuring assignment.
(b, a) = (a, b);
```

<a id="expr.assign.destructure.assignee"></a> 与使用 `let` 的解构声明不同，由于语法歧义，模式不会出现在赋值的左侧。相反，与模式对应的表达式组被指定为 [assignee expressions][assignee expression]，并允许出现在赋值的左侧。然后，这些 assignee expressions 会被转换为模式匹配，随后进行顺序赋值。

<a id="expr.assign.destructure.irrefutable"></a> 转换后的模式必须是不可变的：特别是，这意味着只有编译时已知长度的切片模式以及简单的切片 `[..]` 才允许用于解构赋值。

转换方法很简单，并通过示例来最好地说明。

```rust
# struct Struct { x: u32, y: u32 }
# let (mut a, mut b) = (0, 0);
(a, b) = (3, 4);

[a, b] = [3, 4];

Struct { x: a, y: b } = Struct { x: 3, y: 4};

// desugars to:

{
    let (_a, _b) = (3, 4);
    a = _a;
    b = _b;
}

{
    let [_a, _b] = [3, 4];
    a = _a;
    b = _b;
}

{
    let Struct { x: _a, y: _b } = Struct { x: 3, y: 4};
    a = _a;
    b = _b;
}
```

<a id="expr.assign.destructure.repeat-ident"></a> 标识符在单个 assignee expression 中多次使用是不被禁止的。

<a id="expr.assign.destructure.discard-value"></a> [下划线表达式] 和空的 [范围表达式] 可用于忽略某些值，而不将其绑定。

<a id="expr.assign.destructure.default-binding"></a> 请注意，默认绑定模式不适用于转换后的表达式。

<a id="expr.assign.destructure.tmp-scopes"></a> 
> [!NOTE]
> The desugaring restricts the [temporary scope] of the assigned value operand (the RHS) of a destructuring assignment.
>
> In a basic assignment, the [temporary] is dropped at the end of the enclosing temporary scope. Below, that's the statement. Therefore, the assignment and use is allowed.
>
> ```rust
> # fn temp() {}
> fn f<T>(x: T) -> T { x }
> let x;
> (x = f(&temp()), x); // OK
> ```
>
> Conversely, in a destructuring assignment, the temporary is dropped at the end of the `let` statement in the desugaring. As that happens before we try to assign to `x`, below, it fails.
>
> ```rust,compile_fail,E0716
> # fn temp() {}
> # fn f<T>(x: T) -> T { x }
> # let x;
> [x] = [f(&temp())]; // ERROR
> ```
>
> This desugars to:
>
> ```rust,compile_fail,E0716
> # fn temp() {}
> # fn f<T>(x: T) -> T { x }
> # let x;
> {
>     let [_x] = [f(&temp())];
>     //                     ^
>     //      The temporary is dropped here.
>     x = _x; // ERROR
> }
> ```

<a id="expr.assign.destructure.tmp-ext"></a> 
> [!NOTE]
> Due to the desugaring, the assigned value operand (the RHS) of a destructuring assignment is an [extending expression] within a newly-introduced block.
>
> Below, because the [temporary scope] is extended to the end of this introduced block, the assignment is allowed.
>
> ```rust
> # fn temp() {}
> # let x;
> [x] = [&temp()]; // OK
> ```
>
> This desugars to:
>
> ```rust
> # fn temp() {}
> # let x;
> { let [_x] = [&temp()]; x = _x; } // OK
> ```
>
> However, if we try to use `x`, even within the same statement, we'll get an error because the [temporary] is dropped at the end of this introduced block.
>
> ```rust,compile_fail,E0716
> # fn temp() {}
> # let x;
> ([x] = [&temp()], x); // ERROR
> ```
>
> This desugars to:
>
> ```rust,compile_fail,E0716
> # fn temp() {}
> # let x;
> (
>     {
>         let [_x] = [&temp()];
>         x = _x;
>     }, // <-- The temporary is dropped here.
>     x, // ERROR
> );
> ```

<a id="expr.compound-assign"></a>
## 复合赋值表达式

<a id="expr.compound-assign.syntax"></a> 
```grammar,expressions
CompoundAssignmentExpression ->
      Expression `+=` Expression
    | Expression `-=` Expression
    | Expression `*=` Expression
    | Expression `/=` Expression
    | Expression `%=` Expression
    | Expression `&=` Expression
    | Expression `|=` Expression
    | Expression `^=` Expression
    | Expression `<<=` Expression
    | Expression `>>=` Expression
```

<a id="expr.compound-assign.intro"></a> *复合赋值表达式* 将算术和逻辑二元运算符与赋值表达式组合在一起。

例如：

```rust
let mut x = 5;
x += 1;
assert!(x == 6);
```

复合赋值的语法是一个 [可变] [位置表达式]，即 *被赋值的操作数*，然后是一个运算符，接着是 `=` 作为一个单独的符号（无空格），最后是一个 [值表达式]，即 *被修改的操作数*。

<a id="expr.compound-assign.place"></a> 与其他位置操作数不同，赋值的位置操作数必须是一个位置表达式。

<a id="expr.compound-assign.no-value"></a> 尝试使用值表达式会导致编译器错误，而不是将其提升为临时变量。

<a id="expr.compound-assign.operand-order"></a> 复合赋值表达式的求值取决于操作数的类型。

<a id="expr.compound-assign.primitives"></a> 如果两个操作数的类型在单态化之前已知为基本类型，则右侧先被求值，左侧随后被求值，然后将左侧的求值结果作为位置使用，通过应用运算符来修改两侧的值。

```rust
# use core::{num::Wrapping, ops::AddAssign};
#
trait Equate {}
impl<T> Equate for (T, T) {}

fn f1(x: (u8,)) {
    let mut order = vec![];
    // The RHS is evaluated first as both operands are of primitive
    // type.
    { order.push(2); x }.0 += { order.push(1); x }.0;
    assert!(order.is_sorted());
}

fn f2(x: (Wrapping<u8>,)) {
    let mut order = vec![];
    // The LHS is evaluated first as `Wrapping<_>` is not a primitive
    // type.
    { order.push(1); x }.0 += { order.push(2); (0u8,) }.0;
    assert!(order.is_sorted());
}

fn f3<T: AddAssign<u8> + Copy>(x: (T,)) where (T, u8): Equate {
    let mut order = vec![];
    // The LHS is evaluated first as one of the operands is a generic
    // parameter, even though that generic parameter can be unified
    // with a primitive type due to the where clause bound.
    { order.push(1); x }.0 += { order.push(2); (0u8,) }.0;
    assert!(order.is_sorted());
}

fn main() {
    f1((0u8,));
    f2((Wrapping(0u8),));
    // We supply a primitive type as the generic argument, but this
    // does not affect the evaluation order in `f3` when
    // monomorphized.
    f3::<u8>((0u8,));
}
```

> [!NOTE]
> This is unusual. Elsewhere left to right evaluation is the norm.
>
> See the [eval order test] for more examples.

<a id="expr.compound-assign.trait"></a> 否则，该表达式是语法糖，用于使用对应的 trait 作为运算符（参见 [expr.arith-logic.behavior]），并将左侧作为 [接收者]，右侧作为下一个参数来调用其方法。

例如，以下两条语句是等价的：

```rust
# use std::ops::AddAssign;
fn f<T: AddAssign + Copy>(mut x: T, y: T) {
    x += y; // Statement 1.
    x.add_assign(y); // Statement 2.
}
```

> [!NOTE]
> Surprisingly, desugaring this further to a fully qualified method call is not equivalent, as there is special borrow checker behavior when the mutable reference to the first operand is taken via [autoref].
>
> ```rust
> # use std::ops::AddAssign;
> fn f<T: AddAssign + Copy>(mut x: T) {
>     // Here we used `x` as both the LHS and the RHS. Because the
>     // mutable borrow of the LHS needed to call the trait method
>     // is taken implicitly by autoref, this is OK.
>     x += x; //~ OK
>     x.add_assign(x); //~ OK
> }
> ```
>
> ```rust,compile_fail,E0503
> # use std::ops::AddAssign;
> fn f<T: AddAssign + Copy>(mut x: T) {
>     // We can't desugar the above to the below, as once we take the
>     // mutable borrow of `x` to pass the first argument, we can't
>     // pass `x` by value in the second argument because the mutable
>     // reference is still live.
>     <T as AddAssign>::add_assign(&mut x, x);
>     //~^ ERROR cannot use `x` because it was mutably borrowed
> }
> ```
>
> ```rust,compile_fail,E0503
> # use std::ops::AddAssign;
> fn f<T: AddAssign + Copy>(mut x: T) {
>     // As above.
>     (&mut x).add_assign(x);
>     //~^ ERROR cannot use `x` because it was mutably borrowed
> }
> ```

<a id="expr.compound-assign.result"></a> 与常规赋值表达式一样，复合赋值表达式总是产生 [单位值][unit]。

> [!WARNING]
> Avoid writing code that depends on the evaluation order of operands in compound assignments as it can be unusual and surprising.

[`Try`]: core::ops::Try
[autoref]: expr.method.candidate-receivers-refs
[extending expression]: destructors.scope.lifetime-extension.exprs
[metadata]: dynamic-sized.pointer-types
[moved from]: expr.move.movable-place
[temporary lifetime extension]: destructors.scope.lifetime-extension
[temporary scope]: destructors.scope.temporary
[receiver]: expr.method.intro
[temporary]: expr.temporary

[`Box`]: ../special-types-and-traits.md#boxt
[copies or moves]: ../expressions.md#moved-and-copied-types
[dropping]: ../destructors.md
[eval order test]: https://github.com/rust-lang/rust/blob/1.58.0/src/test/ui/expr/compound-assignment/eval-order.rs
[explicit discriminants]: ../items/enumerations.md#explicit-discriminants
[field-less enums]: ../items/enumerations.md#field-less-enum
[grouped expression]: grouped-expr.md
[literal expression]: literal-expr.md#integer-literal-expressions
[logical and]: ../types/boolean.md#logical-and
[logical not]: ../types/boolean.md#logical-not
[logical or]: ../types/boolean.md#logical-or
[logical xor]: ../types/boolean.md#logical-xor
[mutable]: ../expressions.md#mutability
[place expression]: ../expressions.md#place-expressions-and-value-expressions
[assignee expression]: ../expressions.md#place-expressions-and-value-expressions
[undefined behavior]: ../behavior-considered-undefined.md
[unit]: ../types/tuple.md
[Unit-only enums]: ../items/enumerations.md#unit-only-enum
[value expression]: ../expressions.md#place-expressions-and-value-expressions
[temporary value]: ../expressions.md#temporaries
[float-float]: https://github.com/rust-lang/rust/issues/15536
[Function pointer]: ../types/function-pointer.md
[Function item]: ../types/function-item.md
[undefined behavior]: ../behavior-considered-undefined.md
[Underscore expressions]: ./underscore-expr.md
[range expressions]: ./range-expr.md
