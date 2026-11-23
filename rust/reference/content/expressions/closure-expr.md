<a id="expr.闭包"></a>
# 闭包表达式

<a id="expr.闭包.syntax"></a> 
```grammar,expressions
ClosureExpression ->
    `async`?[^cl-async-edition]
    `move`?
    ( `||` | `|` ClosureParameters? `|` )
    (Expression | `->` TypeNoBounds BlockExpression)

ClosureParameters -> ClosureParam (`,` ClosureParam)* `,`?

ClosureParam -> OuterAttribute* PatternNoTopAlt ( `:` Type )?
```


<a id="expr.闭包.intro"></a> *闭包表达式*，也称为lambda表达式或lambda，定义了一个[闭包类型]，并评估为该类型的数值。闭包表达式的语法包括可选的`async`关键字、可选的`move`关键字，以及由管道符号（`|`）分隔的[模式]列表，称为*闭包参数*，每个参数 optionally后跟一个`:`和一种类型；再后可以是可选的`->`和一种类型，称为*返回类型*；最后是一个表达式，称为*闭包体操作数*。

<a id="expr.闭包.param-type"></a> 每个模式后的可选类型是对该模式的类型注解。

<a id="expr.闭包.explicit-type-body"></a> 如果有返回类型，则闭包体必须是一个[块]。

<a id="expr.闭包.parameter-restriction"></a> 闭包表达式表示将一个参数列表映射到其后的表达式中。与[let绑定]类似，闭包参数是不可消除的[模式]，其类型注解是可选的，如果没有给出，则从上下文中推断出来。

<a id="expr.闭包.unique-type"></a> 每个闭包表达式都有唯一的匿名类型。

<a id="expr.闭包.captures"></a> 重要的是，闭包表达式_捕获其环境_，而常规的[函数定义]则不会这样做。

<a id="expr.闭包.capture-inference"></a> 如果没有使用`move`关键字，闭包表达式[从其环境中推断如何捕获每个变量](../types/闭包.md#capture-modes)，倾向于通过共享引用来捕获，从而有效地借用闭包体内提到的所有外部变量。

<a id="expr.闭包.capture-mut-ref"></a> 如果需要，编译器将推断出应该采用可变引用，或者根据类型从环境中移动或复制值。

<a id="expr.闭包.capture-move"></a> 通过在前缀添加 `move` 关键字来复制或移动值，可以强制闭包捕获其环境。这通常用于确保闭包的生命周期为 `'static'`。

<a id="expr.闭包.trait-实现"></a>
## 闭包 trait 实现

闭包类型实现的哪些 trait 取决于变量的捕获方式、被捕获变量的类型以及是否存在 `async`。有关闭包如何及何时实现 `Fn`、`FnMut` 和 `FnOnce`，请参阅 [call traits and coercions] 章节。如果每个被捕获变量的类型也实现了该 trait，则闭包类型将实现 [`Send`] 和 [`Sync`]。

<a id="expr.闭包.异步"></a>
## 异步闭包

<a id="expr.闭包.异步.intro"></a> 带有 `async` 关键字的闭包表明它们是异步的，其方式类似于 [异步 function][items.fn.异步]。

<a id="expr.闭包.异步.future"></a> 调用异步闭包不会执行任何工作，而是评估为一个实现 [`Future`] 的值，该值对应于闭包主体的计算结果。

```rust
async fn takes_async_callback(f: impl AsyncFn(u64)) {
    f(0).await;
    f(1).await;
}

async fn example() {
    takes_async_callback(async |i| {
        core::future::ready(i).await;
        println!("done with {i}.");
    }).await;
}
```

<a id="expr.闭包.异步.edition2018"></a> > [!EDITION-2018] > 异步闭包仅从 Rust 2018 开始可用。

## Example

在这个示例中，我们定义了一个接受高阶函数参数的函数 `ten_times`，然后将其调用为一个闭包表达式作为参数，再调用一个移动其环境中的值的闭包表达式。

```rust
fn ten_times<F>(f: F) where F: Fn(i32) {
    for index in 0..10 {
        f(index);
    }
}

ten_times(|j| println!("hello, {}", j));
// With type annotations
ten_times(|j: i32| -> () { println!("hello, {}", j) });

let word = "konnichiwa".to_owned();
ten_times(move |j| println!("{}, {}", word, j));
```

## 闭包参数上的属性

<a id="expr.闭包.param-attributes"></a> 闭包参数上的属性遵循与 [常规函数参数] 相同的规则和限制。

[`let` binding]: ../statements.md#let-statements
[`Send`]: ../special-types-and-traits.md#send
[`Sync`]: ../special-types-and-traits.md#sync
[block]: block-expr.md
[call traits and coercions]: ../types/closure.md#call-traits-and-coercions
[closure type]: ../types/closure.md
[function definitions]: ../items/functions.md
[patterns]: ../patterns.md
[regular function parameters]: ../items/functions.md#attributes-on-function-parameters
