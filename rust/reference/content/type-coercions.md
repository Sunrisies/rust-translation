<a id="coerce"></a>
# 类型强制转换

<a id="coerce.intro"></a> **类型强制转换**是自动改变值类型的隐式操作。它们会在特定位置自动发生，且实际被转换的类型范围非常有限。

<a id="coerce.as"></a> 任何允许进行强制转换的转换也可以通过 [类型转换运算符] `as` 显式执行。

强制转换最初在 [RFC 401] 中定义，并在 [RFC 1558] 中得到扩展。

<a id="coerce.site"></a>
## 强制转换位置

<a id="coerce.site.intro"></a> 强制转换只能在程序的特定强制转换位置发生；这些通常是类型明确或可以通过显式类型推导得出（无需类型推断）的地方。可能的强制转换位置包括：

<a id="coerce.site.let"></a> * 给出明确类型的 `let` 语句。

   例如，`&mut 42` 在以下情况下被转换为类型 `&i8`：

   ```rust
   let _: &i8 = &mut 42;
   ```

<a id="coerce.site.value"></a> * `static` 和 `const` 项声明（类似于 `let` 语句）。

<a id="coerce.site.argument"></a> * 函数调用的参数

  被强制转换的值是实际参数，它被转换为形式参数的类型。

  例如，`&mut 42` 在以下情况下被转换为类型 `&i8`：

  ```rust
  fn bar(_: &i8) { }

  fn main() {
      bar(&mut 42);
  }
  ```

  对于方法调用，接收者（`self` 参数）的类型则采用不同的方式进行强制转换，详情请参阅 [方法调用表达式] 文档。

<a id="coerce.site.constructor"></a> * 结构体、联合或枚举变体的实例化

  例如，`&mut 42` 在以下情况下被转换为类型 `&i8`：

  ```rust
  struct Foo<'a> { x: &'a i8 }

  fn main() {
      Foo { x: &mut 42 };
  }
  ```

<a id="coerce.site.return"></a> * 函数返回值——如果不是以分号结尾的块的最后一行，或者是 `return` 语句中的任何表达式

  例如，`x` 在以下情况下被转换为类型 `&dyn Display`：

  ```rust
  use std::fmt::Display;
  fn foo(x: &u32) -> &dyn Display {
      x
  }
  ```

<a id="coerce.site.assignment"></a> * 赋值表达式中的赋值操作数

  例如，`y` 在以下情况下被转换为类型 `&i8`：
  ```rust
  let mut x = &0i8;
  let y = &mut 42i8;
  x = y;
  ```

<a id="coerce.site.subexpr"></a> 如果这些强制转换位置中的表达式是一个具有传播能力的强制转换表达式，则该表达式中相关的子表达式也是强制转换位置。传播会从这些新的强制转换位置开始。具有传播能力的表达式及其相关子表达式包括：

<a id="coerce.site.array"></a> * 数组字面量，其中数组的类型为 `[U; n]`。数组字面量中的每个子表达式都是用于向类型 `U` 进行强制转换的强制转换位置。

<a id="coerce.site.repeat"></a> * 具有重复结构的数组字面量，其中数组的类型为 `[U; n]`。重复的子表达式是用于向类型 `U` 进行强制转换的强制转换位置。

<a id="coerce.site.tuple"></a> * 元组，其中元组是一个向类型 `(U_0, U_1, ..., U_n)` 进行强制转换的强制转换位置。每个子表达式都是向相应类型进行强制转换的强制转换位置，例如，零个子表达式是向类型 `U_0` 进行强制转换的强制转换位置。

<a id="coerce.site.parenthesis"></a> * 括号包裹的子表达式 (`(e)`)：如果表达式的类型为 `U`，则子表达式是向 `U` 进行强制转换的强制转换位置。

<a id="coerce.site.block"></a> * 块：如果块的类型为 `U`，则块中的最后一个表达式（如果不是以分号结尾）是向 `U` 进行强制转换的强制转换位置。这包括属于控制流语句的块，例如 `if`/`else`，前提是该块有已知的类型。

<a id="coerce.types"></a>
## 强制转换类型

<a id="coerce.types.intro"></a> 允许在以下类型之间进行强制转换：

<a id="coerce.types.reflexive"></a> * `T` 到 `U`，如果 `T` 是 `U` 的 [子类型]（*自反情况*）

<a id="coerce.types.transitive"></a> * `T_1` 到 `T_3`，其中 `T_1` 可以转换为 `T_2`，且 `T_2` 可以转换为 `T_3`（*传递性情况*）

    请注意，此功能目前尚未完全支持。

<a id="coerce.types.mut-reborrow"></a> * `&mut T` 到 `&T`

<a id="coerce.types.mut-pointer"></a> * `*mut T` 到 `*const T`

<a id="coerce.types.ref-to-pointer"></a> * `&T` 到 `*const T`

<a id="coerce.types.mut-to-pointer"></a> * `&mut T` 到 `*mut T`

<a id="coerce.types.deref"></a> * `&T` 或 `&mut T` 到 `&U`，如果 `T` 实现了 `Deref<Target = U>`。例如：

  ```rust
  use std::ops::Deref;

  struct CharContainer {
      value: char,
  }

  impl Deref for CharContainer {
      type Target = char;

      fn deref<'a>(&'a self) -> &'a char {
          &self.value
      }
  }

  fn foo(arg: &char) {}

  fn main() {
      let x = &mut CharContainer { value: 'y' };
      foo(x); //&mut CharContainer is coerced to &char.
  }
  ```

<a id="coerce.types.deref-mut"></a> * `&mut T` 到 `&mut U`，如果 `T` 实现了 `DerefMut<Target = U>`。

<a id="coerce.types.unsize"></a> * 将类型 `T` 转换为类型 `U`，其中类型 `T` 可以是 - `&T` - `&mut T` - `*const T` - `*mut T` - `Box<T`

    并且 `U` 可以通过 [未指定大小转换](#unsized-coercions) 从 `T` 获得。

    <!--In the future, coerce_inner will be recursively extended to tuples and
    结构体。此外，从子特征到超特征的转换也将被添加。更多细节请参见 [RFC 401]。-->

<a id="coerce.types.fn"></a> * 将函数项类型转换为 `fn` 指针

<a id="coerce.types.闭包"></a> * 非捕获闭包转换为 `fn` 指针

<a id="coerce.types.never"></a> * `!` 到任何 `T`

<a id="coerce.unsize"></a>
### 未指定大小转换

<a id="coerce.unsize.intro"></a> 以下转换被称为“未指定大小转换”，因为它们涉及将类型转换为未指定大小的类型，并且在某些情况下允许使用其他转换无法使用的场景。它们仍然可以在任何可能发生转换的地方出现。

<a id="coerce.unsize.trait"></a> 两个特征 [`Unsize`]和 [`CoerceUnsized`]用于辅助此过程并供库使用。以下转换是内置的，如果 `T` 可以通过其中一个转换为 `U`，则将为 `T` 提供 `Unsize<U>` 的实现：

<a id="coerce.unsize.slice"></a> * `[T; n]` 转换为 `[T]`.

<a id="coerce.unsize.trait-object"></a> * `T` 转换为 `dyn U`，当 `T` 实现 `U + Sized` 并且 `U` 是 [动态兼容的]。

<a id="coerce.unsize.trait-upcast"></a> * `dyn T` 转换为 `dyn U`，当 `U` 是 `T` 的 [超特征]之一。* 这允许删除自动特征，即 `dyn T + Auto` 变为 `dyn U` 是被允许的。* 如果主特征具有自动特征作为超特征，则允许添加自动特征，即给定 `trait T: U + Send {}`，`dyn T` 可以转换为 `dyn T + Send` 或 `dyn U + Send` 转换。

<a id="coerce.unsized.composite"></a> * `Foo<..., T, ...>` 转换为 `Foo<..., U, ...>`，当：* `Foo` 是一个结构体。* `T` 实现 `Unsize<U>`。* `Foo` 的最后一个字段具有涉及 `T` 的类型。* 如果该字段的类型为 `Bar<T)`，则 `Bar<T` 实现 `Unsize<Bar<U>>`。* `T` 不是其他任何字段类型的一部分。

<a id="coerce.unsized.pointer"></a> 此外，当类型 `Foo<T>` 实现了 `CoerceUnsized<Foo<U>>` 时，也可以实现该接口，此时 `T` 必须实现了 `Unsize<U>` 或 `CoerceUnsized<Foo<U>>`。这允许它向 `Foo<U>` 提供未指定大小的类型转换。

> [!NOTE]
> While the definition of the unsized coercions and their implementation has been stabilized, the traits themselves are not yet stable and therefore can't be used directly in stable Rust.

<a id="coerce.least-upper-bound"></a>
## 最小上界转换

<a id="coerce.least-upper-bound.intro"></a> 在某些上下文中，编译器必须将多个类型进行转换，以尝试找到最通用的类型。这被称为“最小上界”转换。仅以下情况会使用最小上界转换：

+ 为一系列 if 分支寻找共同类型。 + 为一系列 match 分支寻找共同类型。 + 为数组元素寻找共同类型。 + 在 break 操作数和最终块操作数之间寻找共同类型。 + 在 break 操作数中寻找共同类型。 + 为具有多个 return 语句的闭包返回类型寻找类型。 + 检查具有多个 return 语句的函数的返回类型。

<a id="coerce.least-upper-bound.target"></a> 在每种情况下，都有一组类型 `T0..Tn` 需要相互转换为某个目标类型 `T_t`，而该目标类型在开始时是未知的。

<a id="coerce.least-upper-bound.computation"></a> 最小上界转换的计算是迭代完成的。目标类型 `T_t` 最初为类型 `T0`。对于每一个新的类型 `Ti`，我们检查是否：

<a id="coerce.least-upper-bound.computation-identity"></a> + 如果 `Ti` 可以转换为当前目标类型 `T_t`，则不进行任何更改。

<a id="coerce.least-upper-bound.computation-replace"></a> + 否则，检查 `T_t` 是否可以转换为 `Ti`；如果可以，则将 `T_t` 更改为 `Ti`。（此检查还取决于迄今为止考虑的所有源表达式是否具有隐式转换。）

<a id="coerce.least-upper-bound.computation-unify"></a> + 如果不行，则尝试计算 `T_t` 和 `Ti` 的相互超类型，该超类型将成为新的目标类型。

### Examples:

```rust
# let (a, b, c) = (0, 1, 2);
// For if branches
let bar = if true {
    a
} else if false {
    b
} else {
    c
};

// For match arms
let baw = match 42 {
    0 => a,
    1 => b,
    _ => c,
};

// For array elements
let bax = [a, b, c];

// For closure with multiple return statements
let clo = || {
    if true {
        a
    } else if false {
        b
    } else {
        c
    }
};
let baz = clo();

// For type checking of function with multiple return statements
fn foo() -> i32 {
    let (a, b, c) = (0, 1, 2);
    match 42 {
        0 => a,
        1 => b,
        _ => c,
    }
}
```

在这些示例中，`ba*` 的类型是通过 LUB 强制转换发现的。编译器在调用函数 `foo` 时检查 `a`、`b`、`c` 的 LUB 强制转换结果是否为 `i32`。

### Caveat

这种描述显然是非正式的。希望通过更精确的方式来表述，作为更精确地指定 Rust 类型检查器的一部分努力。

[`Unsize`]: std::marker::Unsize
[`CoerceUnsized`]: std::ops::CoerceUnsized
[labeled block expression]: expr.loop.block-labels
[`loop` expression with break expressions]: expr.loop.break-value

[RFC 401]: https://github.com/rust-lang/rfcs/blob/master/text/0401-coercions.md
[RFC 1558]: https://github.com/rust-lang/rfcs/blob/master/text/1558-closure-to-fn-coercion.md
[subtype]: subtyping.md
[dyn compatible]: items/traits.md#dyn-compatibility
[type cast operator]: expressions/operator-expr.md#type-cast-expressions
[method-call expressions]: expressions/method-call-expr.md
[supertraits]: items/traits.md#supertraits
