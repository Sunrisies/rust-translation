<a id="析构函数"></a>
# 析构函数

<a id="析构函数介绍"></a> 当一个[已初始化]的[变量]或[临时对象]离开[作用域](#drop-scopes)时，其*析构函数*会被调用或被丢弃。[赋值操作]也会调用其左操作数（如果已初始化）的析构函数。如果变量部分初始化，则只有已初始化的字段会被丢弃。

<a id="析构函数的操作"></a> 类型 `T` 的析构函数包括：

1. 如果 `T: Drop`，调用 [`<T as core::ops::Drop>::drop`](core::ops::Drop::drop) 2. 递归调用其所有字段的析构函数。 * [结构体]的字段按声明顺序被丢弃。 * 活跃的[枚举变体]的字段也按声明顺序被丢弃。 * [元组]的字段按顺序被丢弃。 * [数组]或拥有的[切片]的元素从第一个元素到最后一个都被丢弃。 * [闭包]通过移动捕获的变量按未指定顺序被丢弃。 * [Trait对象]调用底层类型的析构函数。 * 其他类型不会进一步进行丢弃操作。

<a id="手动执行析构函数"></a> 如果必须手动执行析构函数，例如在实现自定义智能指针时，可以使用 [`core::ptr::drop_in_place`]。

一些示例：

```rust
struct PrintOnDrop(&'static str);

impl Drop for PrintOnDrop {
    fn drop(&mut self) {
        println!("{}", self.0);
    }
}

let mut overwritten = PrintOnDrop("drops when overwritten");
overwritten = PrintOnDrop("drops when scope ends");

let tuple = (PrintOnDrop("Tuple first"), PrintOnDrop("Tuple second"));

let moved;
// No destructor run on assignment.
moved = PrintOnDrop("Drops when moved");
// Drops now, but is then uninitialized.
moved;

// Uninitialized does not drop.
let uninitialized: PrintOnDrop;

// After a partial move, only the remaining fields are dropped.
let mut partial_move = (PrintOnDrop("first"), PrintOnDrop("forgotten"));
// Perform a partial move, leaving only `partial_move.0` initialized.
core::mem::forget(partial_move.1);
// When partial_move's scope ends, only the first field is dropped.
```

<a id="作用域的丢弃"></a>
## 作用域的丢弃

<a id="作用域介绍"></a> 每个变量或临时对象都与一个*丢弃作用域*关联。当控制流离开丢弃作用域时，与该作用域关联的所有变量按声明顺序（对于变量）或创建顺序（对于临时对象）的反序被丢弃。

<a id="描述生成中的丢弃作用域"></a> 通过用 [`match`][panic][loop]和[`break`]替换[`for`][panic][`if`][panic][`while`]表达式，可以确定丢弃作用域。

<a id="作用域的运算符"></a> 重载运算符与内置运算符无区别，[绑定模式]也不被考虑。

<a id="作用域的列表"></a> 对于一个函数或闭包，存在以下丢弃作用域：

<a id="作用域的函数"></a> * 整个函数

<a id="作用域的语句"></a> * 每个[语句]

<a id="作用域的表达式"></a> * 每个[表达式]

<a id="destructors.scope.block"></a> * 每个块，包括函数体 * 在 [块表达式] 的情况下，块的作用域与表达式的作用域相同。

<a id="destructors.scope.match-arm"></a> * `match` 表达式的每一个分支

<a id="destructors.scope.nesting"></a> Drop 作用域按以下方式嵌套：

<a id="destructors.scope.nesting-function"></a> * 整个函数作用域是 outermost 的作用域。

<a id="destructors.scope.nesting-function-body"></a> * 函数体块位于整个函数的作用域内。

<a id="destructors.scope.nesting-expr-statement"></a> * 表达式语句中的表达式父级是该语句的作用域。

<a id="destructors.scope.nesting-let-initializer"></a> * [`let` 语句] 的初始化器父级是 `let` 语句的作用域。

<a id="destructors.scope.nesting-statement"></a> * 语句作用域的父级是包含该语句的块的作用域。

<a id="destructors.scope.nesting-match-guard"></a> * `match` guard 中的表达式父级是该 guard 所针对的分支的作用域。

<a id="destructors.scope.nesting-match-arm"></a> * `match` 表达式中 `=>` 之后的表达式父级是其所在分支的作用域。

<a id="destructors.scope.nesting-match"></a> * 分支作用域的父级是它所属的 `match` 表达式的作用域。

<a id="destructors.scope.nesting-other"></a> * 所有其他作用域的父级是直接包围它的表达式的作用域。

<a id="destructors.scope.nesting-drop-order"></a> 当同时留下多个作用域时，例如从函数返回时，变量是从内到外被丢弃的。

<a id="destructors.scope.params"></a>
### 函数参数的作用域

所有函数参数都位于整个函数体的作用域内，因此在评估函数时最后被丢弃。每个实际函数参数在该参数模式引入的任何绑定之后被丢弃。

```rust
# struct PrintOnDrop(&'static str);
# impl Drop for PrintOnDrop {
#     fn drop(&mut self) {
#         println!("drop({})", self.0);
#     }
# }
// Drops `y`, then the second parameter, then `x`, then the first parameter
fn patterns_in_parameters(
    (x, _): (PrintOnDrop, PrintOnDrop),
    (_, y): (PrintOnDrop, PrintOnDrop),
) {}

// drop order is 3 2 0 1
patterns_in_parameters(
    (PrintOnDrop("0"), PrintOnDrop("1")),
    (PrintOnDrop("2"), PrintOnDrop("3")),
);
```

<a id="destructors.scope.bindings"></a>
### 局部变量的作用域

<a id="destructors.scope.bindings.let"></a> 在 `let` 语句中声明的局部变量与包含该 `let` 语句的块的作用域相关联。

```rust
# struct PrintOnDrop(&'static str);
# impl Drop for PrintOnDrop {
#     fn drop(&mut self) {
#         println!("drop({})", self.0);
#     }
# }
let declared_first = PrintOnDrop("Dropped last in outer scope");
{
    let declared_in_block = PrintOnDrop("Dropped in inner scope");
}
let declared_last = PrintOnDrop("Dropped first in outer scope");
```

<a id="destructors.scope.bindings.match-arm"></a> 在 `match` 表达式或模式匹配 `match` guard 中声明的局部变量与其所声明的 `match` arm 的作用域相关联。

```rust
# #![allow(irrefutable_let_patterns)]
# struct PrintOnDrop(&'static str);
# impl Drop for PrintOnDrop {
#     fn drop(&mut self) {
#         println!("drop({})", self.0);
#     }
# }
match PrintOnDrop("Dropped last in the first arm's scope") {
    // When guard evaluation succeeds, control-flow stays in the arm and
    // values may be moved from the scrutinee into the arm's bindings,
    // causing them to be dropped in the arm's scope.
    x if let y = PrintOnDrop("Dropped second in the first arm's scope")
        && let z = PrintOnDrop("Dropped first in the first arm's scope") =>
    {
        let declared_in_block = PrintOnDrop("Dropped in inner scope");
        // Pattern-matching guards' bindings and temporaries are dropped in
        // reverse order, dropping each guard condition operand's bindings
        // before its temporaries. Lastly, variables bound by the arm's
        // pattern are dropped.
    }
    _ => unreachable!(),
}

match PrintOnDrop("Dropped in the enclosing temporary scope") {
    // When guard evaluation fails, control-flow leaves the arm scope,
    // causing bindings and temporaries from earlier pattern-matching
    // guard condition operands to be dropped. This occurs before evaluating
    // the next arm's guard or body.
    _ if let y = PrintOnDrop("Dropped in the first arm's scope")
        && false => unreachable!(),
    // When a guard is executed multiple times due to self-overlapping
    // or-patterns, control-flow leaves the arm scope when the guard fails
    // and re-enters the arm scope before executing the guard again.
    _ | _ if let y = PrintOnDrop("Dropped in the second arm's scope twice")
        && false => unreachable!(),
    _ => {},
}
```

<a id="destructors.scope.bindings.patterns"></a> 模式中的变量按照声明顺序的相反顺序被丢弃。

```rust
# struct PrintOnDrop(&'static str);
# impl Drop for PrintOnDrop {
#     fn drop(&mut self) {
#         println!("drop({})", self.0);
#     }
# }
let (declared_first, declared_last) = (
    PrintOnDrop("Dropped last"),
    PrintOnDrop("Dropped first"),
);
```

<a id="destructors.scope.bindings.or-patterns"></a> 在丢弃顺序方面，[or-patterns] 按第一个子模式的顺序来声明绑定。

```rust
# struct PrintOnDrop(&'static str);
# impl Drop for PrintOnDrop {
#     fn drop(&mut self) {
#         println!("drop({})", self.0);
#     }
# }
// Drops `x` before `y`.
fn or_pattern_drop_order<T>(
    (Ok([x, y]) | Err([y, x])): Result<[T; 2], [T; 2]>
//   ^^^^^^^^^^   ^^^^^^^^^^^ This is the second subpattern.
//   |
//   This is the first subpattern.
//
//   In the first subpattern, `x` is declared before `y`. Since it is
//   the first subpattern, that is the order used even if the second
//   subpattern, where the bindings are declared in the opposite
//   order, is matched.
) {}

// Here we match the first subpattern, and the drops happen according
// to the declaration order in the first subpattern.
or_pattern_drop_order(Ok([
    PrintOnDrop("Declared first, dropped last"),
    PrintOnDrop("Declared last, dropped first"),
]));

// Here we match the second subpattern, and the drops still happen
// according to the declaration order in the first subpattern.
or_pattern_drop_order(Err([
    PrintOnDrop("Declared last, dropped first"),
    PrintOnDrop("Declared first, dropped last"),
]));
```

<a id="destructors.scope.temporary"></a>
### 临时作用域

<a id="destructors.scope.temporary.intro"></a> 表达式的 *临时作用域* 是在 [place context] 中使用该表达式作为临时变量时使用的作用域，除非它被 [promoted]。

<a id="destructors.scope.temporary.enclosing"></a> 除了生命周期扩展之外，表达式的临时作用域是包含该表达式的最小作用域，并且属于以下之一： * 整个函数。 * 一条语句。 * [`if`]、[`while`] 或 [`loop`] 表达式的主体。 * `if` 表达式的 `else` 块。 * `if` 或 [`while`] 表达式的非模式匹配条件表达式，或非模式匹配的 [match] guard 条件操作数。 * 如果存在，则 `match` arm 的模式匹配 guard 及其主体表达式。 * [lazy boolean expression] 的每个操作数。 * [`if`] 的模式匹配条件及其后续主体 ([destructors.scope.temporary.edition2024])。 * [`while`] 的模式匹配条件及循环主体。 * 块的尾部表达式的全部内容 ([destructors.scope.temporary.edition2024])。

* 整个函数。 * 一条语句。 * [`if`]、[`while`] 或 [`loop`] 表达式的主体。 * `if` 表达式的 `else` 块。 * `if` 或 [`while`] 表达式的非模式匹配条件，或非模式匹配的 [match] guard 条件操作数。 * 如果存在，则 `match` arm 的模式匹配 guard 及其主体表达式。 * [lazy boolean expression] 的每个操作数。 * [`if`] 的模式匹配条件及其后续主体 ([destructors.scope.temporary.edition2024])。 * [`while`] 的模式匹配条件及循环主体。 * 块的尾部表达式的全部内容 ([destructors.scope.temporary.edition2024])。

> [!NOTE] > `match` 表达式的 [scrutinee] 不是临时作用域，因此 scrubrite 中的临时变量可以在 `match` 表达式之后被丢弃。例如，在 `match 1 { ref mut z => z };` 中，用于 `1` 的临时变量会一直存在到语句结束。

> [!NOTE] > 对 [解构赋值] 的去糖化操作限制了其赋值值操作数的临时作用域（即RHS）。详情请参阅 [expr.assign.destructure.tmp-scopes]。

<a id="destructors.scope.temporary.edition2024"></a> > [!EDITION-2024] > 2024版新增了两条新的临时作用域缩小规则：`if let` 临时变量在 `else` 块之前被移除，而块中尾表达式的临时变量在尾表达式评估后立即被移除。

一些示例：

```rust
# #![allow(irrefutable_let_patterns)]
# struct PrintOnDrop(&'static str);
# impl Drop for PrintOnDrop {
#     fn drop(&mut self) {
#         println!("drop({})", self.0);
#     }
# }
let local_var = PrintOnDrop("local var");

// Dropped once the condition has been evaluated
if PrintOnDrop("If condition").0 == "If condition" {
    // Dropped at the end of the block
    PrintOnDrop("If body").0
} else {
    unreachable!()
};

if let "if let scrutinee" = PrintOnDrop("if let scrutinee").0 {
    PrintOnDrop("if let consequent").0
    // `if let consequent` dropped here
}
// `if let scrutinee` is dropped here
else {
    PrintOnDrop("if let else").0
    // `if let else` dropped here
};

while let x = PrintOnDrop("while let scrutinee").0 {
    PrintOnDrop("while let loop body").0;
    break;
    // `while let loop body` dropped here.
    // `while let scrutinee` dropped here.
}

// Dropped before the first ||
(PrintOnDrop("first operand").0 == ""
// Dropped before the )
|| PrintOnDrop("second operand").0 == "")
// Dropped before the ;
|| PrintOnDrop("third operand").0 == "";

// Scrutinee is dropped at the end of the function, before local variables
// (because this is the tail expression of the function body block).
match PrintOnDrop("Matched value in final expression") {
    // Non-pattern-matching guards' temporaries are dropped once the
    // condition has been evaluated
    _ if PrintOnDrop("guard condition").0 == "" => (),
    // Pattern-matching guards' temporaries are dropped when leaving the
    // arm's scope
    _ if let "guard scrutinee" = PrintOnDrop("guard scrutinee").0 => {
        let _ = &PrintOnDrop("lifetime-extended temporary in inner scope");
        // `lifetime-extended temporary in inner scope` is dropped here
    }
    // `guard scrutinee` is dropped here
    _ => (),
}
```

<a id="destructors.scope.operands"></a>
### 操作数

当其他操作数正在被计算时，也会创建临时变量来保存该操作数的结果。这些临时变量与使用该操作数的表达式的作用域相关联。由于临时变量在表达式评估后会被移动，因此移除它们不会产生任何影响，除非表达式的一个操作数跳出表达式、返回或[引发恐慌][panic]。

```rust
# struct PrintOnDrop(&'static str);
# impl Drop for PrintOnDrop {
#     fn drop(&mut self) {
#         println!("drop({})", self.0);
#     }
# }
loop {
    // Tuple expression doesn't finish evaluating so operands drop in reverse order
    (
        PrintOnDrop("Outer tuple first"),
        PrintOnDrop("Outer tuple second"),
        (
            PrintOnDrop("Inner tuple first"),
            PrintOnDrop("Inner tuple second"),
            break,
        ),
        PrintOnDrop("Never created"),
    );
}
```

<a id="destructors.scope.const-promotion"></a>
### 常量提升

当值表达式可以被写成一个常量并被借用时，且该借用可以在表达式原本的写法位置被解引用，而不改变运行时行为时，就会发生值表达式到`'static`槽位的提升。也就是说，提升后的表达式可以在编译时评估，其结果值不包含[内部可变性]或[destructors]（这些属性基于数值尽可能确定，例如 `&None` 总是具有类型`&'static Option<_>`，因为它不包含任何不允许的内容）。

<a id="destructors.scope.生命周期-extension"></a>
### 临时生命周期扩展

<a id="destructors.scope.生命周期-extension.intro"></a> > [!NOTE] > 临时生命周期扩展的具体规则可能会发生变化。这里仅描述当前行为。

<a id="destructors.scope.生命周期-extension.let"></a> `let`语句中的表达式的临时作用域有时会被*扩展*到包含`let`语句的块的作用域中。当根据某些语法规则，常规临时作用域太小时，就会进行这种扩展。例如：

```rust
let x = &mut 0;
// Usually a temporary would be dropped by now, but the temporary for `0` lives
// to the end of the block.
println!("{}", x);
```

<a id="destructors.scope.生命周期-extension.static"></a> 生命周期扩展同样适用于 `static` 和 `const` 项，使临时变量在程序结束前持续存在。例如：

```rust
const C: &Vec<i32> = &Vec::new();
// Usually this would be a dangling reference as the `Vec` would only
// exist inside the initializer expression of `C`, but instead the
// borrow gets lifetime-extended so it effectively has `'static` lifetime.
println!("{:?}", C);
```

<a id="destructors.scope.生命周期-extension.sub-expressions"></a> 如果 [borrow]、[dereference][dereference expression]、[field][field expression] 或 [tuple indexing expression] 具有扩展的临时作用域，则其操作数也会具有扩展的临时作用域。如果 [indexing expression] 具有扩展的临时作用域，则被索引的表达式也具有扩展的临时作用域。

<a id="destructors.scope.生命周期-extension.patterns"></a>
#### 基于模式进行扩展

<a id="destructors.scope.生命周期-extension.patterns.extending"></a> *扩展模式* 可以是以下一种：

* 通过引用或可变引用绑定的 [identifier pattern]。

  ```rust
  # fn temp() {}
  let ref x = temp(); // Binds by reference.
  # x;
  let ref mut x = temp(); // Binds by mutable reference.
  # x;
  ```

* [结构体][struct pattern][tuple pattern}、[tuple 结构体][tuple pattern][slice pattern] 或 [or-pattern][or-patterns]，其中至少一个直接子模式是扩展模式。

  ```rust
  # use core::sync::atomic::{AtomicU64, Ordering::Relaxed};
  # static X: AtomicU64 = AtomicU64::new(0);
  struct W<T>(T);
  # impl<T> Drop for W<T> { fn drop(&mut self) { X.fetch_add(1, Relaxed); } }
  let W { 0: ref x } = W(()); // Struct pattern.
  # x;
  let W(ref x) = W(()); // Tuple struct pattern.
  # x;
  let (W(ref x),) = (W(()),); // Tuple pattern.
  # x;
  let [W(ref x), ..] = [W(())]; // Slice pattern.
  # x;
  let (Ok(W(ref x)) | Err(&ref x)) = Ok(W(())); // Or pattern.
  # x;
  //
  // All of the temporaries above are still live here.
  # assert_eq!(0, X.load(Relaxed));
  ```

因此，`ref x`、`V(ref x)` 和 `[ref x, y]` 都是扩展模式，但 `x`、`&ref x` 和 `&(ref x,)` 则不是。

<a id="destructors.scope.生命周期-extension.patterns.let"></a> 如果 `let` 语句中的模式是扩展模式，则初始化表达式的临时作用域会被扩展。

```rust
# fn temp() {}
// This is an extending pattern, so the temporary scope is extended.
let ref x = *&temp(); // OK
# x;
```

```rust,compile_fail,E0716
# fn temp() {}
// This is neither an extending pattern nor an extending expression,
// so the temporary is dropped at the semicolon.
let &ref x = *&&temp(); // ERROR
# x;
```

```rust
# fn temp() {}
// This is not an extending pattern but it is an extending expression,
// so the temporary lives beyond the `let` statement.
let &ref x = &*&temp(); // OK
# x;
```

<a id="destructors.scope.生命周期-extension.exprs"></a>
#### 基于表达式进行扩展

<a id="destructors.scope.生命周期-extension.exprs.extending"></a> 对于带有初始化的 `let` 语句，*扩展表达式* 是指属于以下之一的表达式：

* 初始化器表达式。 * 扩展 [borrow] 表达式的操作数。 * 扩展 [super 宏 call] 表达式的 [super 操作数]。 * 扩展 [array][array expression][cast expression}、[braced 结构体][cast expression] 或 [tuple][tuple expression] 表达式的操作数。 * 扩展 [tuple 结构体] 或 [tuple 枚举 variant] 构造函数表达式的参数。 * 扩展 [block expression] 的最终表达式，除了 [异步 block expression]。 * 扩展 [`if`] 表达式的 consequent、`else if` 或 `else` 块的最终表达式。 * 扩展 [`match`] 表达式的臂表达式。

> [!NOTE] > [destructuring assignment] 的 desugaring 会将其赋值值操作数（RHS）变成新引入块中的扩展表达式。详情请参阅 [expr.assign.destructure.tmp-ext]。

因此，`&mut 0`、`(&1, &mut 2)` 和 `Some(&mut 3)` 中的 borrow 表达式都是扩展表达式。而 `&0 + &1` 和 `f(&mut 0)` 中的 borrows 不是。

<a id="destructors.scope.生命周期-extension.exprs.borrows"></a> 扩展 [borrow] 表达式的操作数具有其 [临时作用域][extended]。

<a id="destructors.scope.生命周期-extension.exprs.super-macros"></a> 扩展 [super 宏 call] 表达式的 [super 临时变量] 具有其 [作用域][temporary scopes][extended]。

> [!NOTE] > `rustc` 不将扩展 [array] 表达式的 [array repeat operands] 视为扩展表达式。是否如此仍是一个悬而未答的问题。 > > 详情请参阅 [Rust issue #146092](https://github.com/rust-lang/rust/issues/146092)。

#### Examples

以下是一些表达式具有扩展临时作用域的例子：

```rust,edition2024
# use core::pin::pin;
# use core::sync::atomic::{AtomicU64, Ordering::Relaxed};
# static X: AtomicU64 = AtomicU64::new(0);
# #[derive(Debug)] struct S;
# impl Drop for S { fn drop(&mut self) { X.fetch_add(1, Relaxed); } }
# const fn temp() -> S { S }
let x = &temp(); // Operand of borrow.
# x;
let x = &raw const *&temp(); // Operand of raw borrow.
# assert_eq!(X.load(Relaxed), 0);
let x = &temp() as &dyn Send; // Operand of cast.
# x;
let x = (&*&temp(),); // Operand of tuple constructor.
# x;
struct W<T>(T);
let x = W(&temp()); // Argument to tuple struct constructor.
# x;
let x = Some(&temp()); // Argument to tuple enum variant constructor.
# x;
let x = { [Some(&temp())] }; // Final expr of block.
# x;
let x = const { &temp() }; // Final expr of `const` block.
# x;
let x = unsafe { &temp() }; // Final expr of `unsafe` block.
# x;
let x = if true { &temp() } else { &temp() };
//              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//           Final exprs of `if`/`else` blocks.
# x;
let x = match () { _ => &temp() }; // `match` arm expression.
# x;
let x = pin!(temp()); // Super operand of super macro call expression.
# x;
let x = pin!({ &mut temp() }); // As above.
# x;
let x = format_args!("{:?}", temp()); // As above.
# x;
//
// All of the temporaries above are still live here.
# assert_eq!(0, X.load(Relaxed));
```

以下是一些表达式没有扩展临时作用域的例子：

```rust,compile_fail,E0716
# fn temp() {}
// Arguments to function calls are not extending expressions. The
// temporary is dropped at the semicolon.
let x = core::convert::identity(&temp()); // ERROR
# x;
```

```rust,compile_fail,E0716
# fn temp() {}
# trait Use { fn use_temp(&self) -> &Self { self } }
# impl Use for () {}
// Receivers of method calls are not extending expressions.
let x = (&temp()).use_temp(); // ERROR
# x;
```

```rust,compile_fail,E0716
# fn temp() {}
// Scrutinees of match expressions are not extending expressions.
let x = match &temp() { x => x }; // ERROR
# x;
```

```rust,compile_fail,E0515
# fn temp() {}
// Final expressions of `async` blocks are not extending expressions.
let x = async { &temp() }; // ERROR
# x;
```

```rust,compile_fail,E0515
# fn temp() {}
// Final expressions of closures are not extending expressions.
let x = || &temp(); // ERROR
# x;
```

```rust,compile_fail,E0716
# fn temp() {}
// Operands of loop breaks are not extending expressions.
let x = loop { break &temp() }; // ERROR
# x;
```

```rust,compile_fail,E0716
# fn temp() {}
// Operands of breaks to labels are not extending expressions.
let x = 'a: { break 'a &temp() }; // ERROR
# x;
```

```rust,edition2024,compile_fail,E0716
# use core::pin::pin;
# fn temp() {}
// The argument to `pin!` is only an extending expression if the call
// is an extending expression. Since it's not, the inner block is not
// an extending expression, so the temporaries in its trailing
// expression are dropped immediately.
pin!({ &temp() }); // ERROR
```

```rust,edition2024,compile_fail,E0716
# fn temp() {}
// As above.
format_args!("{:?}", { &temp() }); // ERROR
```

<a id="destructors.forget"></a>
## 未运行析构函数

<a id="destructors.manually-suppressing"></a>
### 手动抑制析构函数

[`core::mem::forget`] 可用于防止变量的析构函数被调用，而 [`core::mem::ManuallyDrop`] 则提供了一个包装器来防止变量或字段自动被丢弃。

> [!NOTE] > 即使析构函数的类型不是 `'static'，通过 [`core::mem::forget`]或其他方式阻止其执行也是安全的。除了本文档中规定的析构函数必然执行的场景外，其他情况下类型不得依赖析构函数的执行以确保正确性。

<a id="destructors.process-termination"></a>
### 不展开程序的情况下终止进程

有一些方法可以在不 [展开程序] 的情况下终止进程，此时不会执行析构函数。

标准库提供了 [`std::process::exit`]和 [`std::process::abort`]来显式实现此功能。此外，如果 [panic handler][panic.panic_handler.std]被设置为 `abort`，则崩溃将始终在不执行析构函数的情况下终止进程。

还有一个需要注意的情况：当恐慌到达 [非展开程序 ABI边界] 时，要么不会执行任何析构函数，要么直到该 ABI边界的所有析构函数都会被执行。

[destructuring assignment]: expr.assign.destructure
[tuple struct]: type.struct.tuple
[tuple enum variant]: type.enum.declaration
[array repeat operands]: expr.array.repeat-operand
[async block expression]: expr.block.async
[borrow]: expr.operator.borrow
[extended]: destructors.scope.lifetime-extension
[super macro call]: expr.super-macros
[super operands]: expr.super-macros
[super temporaries]: expr.super-macros
[temporary scope]: destructors.scope.temporary
[temporary scopes]: destructors.scope.temporary

[Assignment]: expressions/operator-expr.md#assignment-expressions
[binding modes]: patterns.md#binding-modes
[closure]: types/closure.md
[destructors]: destructors.md
[expression]: expressions.md
[guard condition operand]: expressions/match-expr.md#match-guard-chains
[identifier pattern]: patterns.md#identifier-patterns
[initialized]: glossary.md#initialized
[interior mutability]: interior-mutability.md
[lazy boolean expression]: expressions/operator-expr.md#lazy-boolean-operators
[non-unwinding ABI boundary]: items/functions.md#unwinding
[panic]: panic.md
[place context]: expressions.md#place-expressions-and-value-expressions
[promoted]: destructors.md#constant-promotion
[scrutinee]: glossary.md#scrutinee
[statement]: statements.md
[temporary]: expressions.md#temporaries
[unwinding]: panic.md#unwinding
[variable]: variables.md
[array]: types/array.md
[enum variant]: types/enum.md
[slice]: types/slice.md
[struct]: types/struct.md
[Trait objects]: types/trait-object.md
[tuple]: types/tuple.md
[or-patterns]: patterns.md#or-patterns
[slice pattern]: patterns.md#slice-patterns
[struct pattern]: patterns.md#struct-patterns
[tuple pattern]: patterns.md#tuple-patterns
[tuple struct pattern]: patterns.md#tuple-struct-patterns
[array expression]: expressions/array-expr.md#array-expressions
[block expression]: expressions/block-expr.md
[cast expression]: expressions/operator-expr.md#type-cast-expressions
[dereference expression]: expressions/operator-expr.md#the-dereference-operator
[field expression]: expressions/field-expr.md
[indexing expression]: expressions/array-expr.md#array-and-slice-indexing-expressions
[struct expression]: expressions/struct-expr.md
[tuple expression]: expressions/tuple-expr.md#tuple-expressions
[tuple indexing expression]: expressions/tuple-expr.md#tuple-indexing-expressions
[`break`]: expressions/loop-expr.md#break-expressions
[`for`]: expressions/loop-expr.md#iterator-loops
[`if let`]: expressions/if-expr.md#if-let-patterns
[`if`]: expressions/if-expr.md#if-expressions
[`let` statement]: statements.md#let-statements
[`loop`]: expressions/loop-expr.md#infinite-loops
[`match`]: expressions/match-expr.md
[`while let`]: expressions/loop-expr.md#while-let-patterns
[`while`]: expressions/loop-expr.md#predicate-loops
