<a id="expr.block"></a>
# 块表达式

<a id="expr.block.syntax"></a> 
```grammar,expressions
BlockExpression ->
    `{`
        InnerAttribute*
        Statements?
    `}`

BlockExpressionNoInnerAttributes ->
    `{`
        Statements?
    `}`

Statements ->
      Statement+
    | Statement+ ExpressionWithoutBlock
    | ExpressionWithoutBlock
```

<a id="expr.block.intro"></a> 一个*块表达式*或*块*是一种控制流表达式，同时也是一个匿名命名空间作用域，用于项和变量声明。

<a id="expr.block.sequential-evaluation"></a> 作为控制流表达式，块会依次执行其组件的非项声明语句，然后执行其最终可选表达式。

<a id="expr.block.namespace"></a> 作为匿名命名空间作用域，项声明仅在块内部有效，而通过 `let` 语句声明的变量则从下一个语句到块末尾都处于作用域内。更多细节请参阅[scopes]章节。

<a id="expr.block.inner-attributes"></a> 块的语法为 `{`，接着是任意[内部属性]，再接任意数量的[语句]，然后是一个可选表达式，称为最终操作数，最后是一个`}`。

<a id="expr.block.statements"></a> 通常要求语句后跟一个分号，但有两个例外：

1. 项声明语句不需要后跟分号。2. 表达式语句通常需要后跟分号，除非其外部表达式是控制流表达式。

<a id="expr.block.null-statement"></a> 此外，在语句之间允许使用额外的分号，但这些分号不影响语义。

<a id="expr.block.evaluation"></a> 当评估块表达式时，除了项声明语句外的每个语句都会依次执行。

<a id="expr.block.result"></a> 然后如果提供了最终操作数，则执行该操作数。

<a id="expr.block.value-trailing-expr"></a> 当块包含[最终操作数]时，该块的类型和值即为该最终操作数的值。

```rust
let x: u8 = { 0u8 }; // `0u8` is the final operand.
assert_eq!(x, 0);
let x: u8 = { (); 0u8 }; // As above.
assert_eq!(x, 0);
```

<a id="expr.block.value-no-trailing-expr"></a> 当块不包含[最终操作数]且块没有分支时，该块具有[单位类型]和[单位值]。

```rust
let x: () = {}; // Has no final operand.
assert_eq!(x, ());
let x: () = { 0u8; }; // As above.
assert_eq!(x, ());
```

<a id="expr.block.value-diverges-no-trailing-expr"></a> 当块不包含[最终操作数]且块[分支]时，该块具有[永远类型]，且没有最终值（因为其类型为[无人居住]）。

```rust,no_run
fn f() -> ! { loop {}; } // Diverges and has no final operand.
//          ^^^^^^^^^^^^
// The body of a function is a block expression.
```

> [!NOTE]
> Observe that a block having no final operand is distinct from having an explicit final operand with unit type.  E.g., even though this block diverges, the type of the block is [unit] rather than [never].
>
> ```rust,compile_fail,E0308
> fn f() -> ! { loop {}; () } // ERROR: Mismatched types.
> //          ^^^^^^^^^^^^^^^ This block has unit type.
> ```

> [!NOTE]
> As a control flow expression, if a block expression is the outer expression of an expression statement, the expected type is `()` unless it is followed immediately by a semicolon.

<a id="expr.block.diverging"></a> 如果所有可到达的控制流路径都包含发散表达式，则该块被视为 [diverging][divergence]，除非该表达式为未从外部读取的 [place expression]。

```rust,no_run
fn no_control_flow() -> ! {
    // There are no conditional statements, so this entire function body is diverging.
    loop {}
}

fn control_flow_diverging() -> ! {
    // All paths are diverging, so this entire function body is diverging.
    if true {
        loop {}
    } else {
        loop {}
    }
}

fn control_flow_not_diverging() -> () {
    // Some paths are not diverging, so this entire block is not diverging.
    if true {
        ()
    } else {
        loop {}
    }
}

fn diverging_place_read(x: !) -> ! {
    // A read of a place expression produces a diverging block.
    let _x = x;
}
```

```rust,compile_fail,E0308
fn diverging_place_not_read(x: !) -> ! {
    // Assignment to `_` means the place is not read.
    let _ = x;
} // ERROR: Mismatched types.
```

<a id="expr.block.value"></a> 块始终为 [value expressions]，并在 value expression 上下文中计算最后一个操作数。

> [!NOTE]
> This can be used to force moving a value if really needed. For example, the following example fails on the call to `consume_self` because the struct was moved out of `s` in the block expression.
>
> ```rust,compile_fail
> struct Struct;
>
> impl Struct {
>     fn consume_self(self) {}
>     fn borrow_self(&self) {}
> }
>
> fn move_by_block_expression() {
>     let s = Struct;
>
>     // Move the value out of `s` in the block expression.
>     (&{ s }).borrow_self();
>
>     // Fails to execute because `s` is moved out of.
>     s.consume_self();
> }
> ```

<a id="expr.block.异步"></a>
## `async` 块

<a id="expr.block.异步.syntax"></a> 
```grammar,expressions
AsyncBlockExpression -> `async` `move`? BlockExpression
```

<a id="expr.block.异步.intro"></a> *异步 块*是块表达式的一种变体，其计算结果是一个未来值。

<a id="expr.block.异步.future-result"></a> 如果存在，块的最后表达式决定了未来的结果值。

<a id="expr.block.异步.anonymous-type"></a> 执行 异步 块类似于执行闭包表达式：其直接效果是生成并返回一个匿名类型。

<a id="expr.block.异步.future"></a> 虽然闭包返回实现至少一个 [`std::ops::Fn`] trait 的类型，但 异步 块返回的类型则实现了 [`std::future::Future]` trait。

<a id="expr.block.异步.layout-unspecified"></a> 该类型的实际数据格式未指定。

> [!NOTE]
> The future type that rustc generates is roughly equivalent to an enum with one variant per `await` point, where each variant stores the data needed to resume from its corresponding point.

<a id="expr.block.异步.edition2018"></a> 
> [!EDITION-2018]
> Async blocks are only available beginning with Rust 2018.

<a id="expr.block.异步.capture"></a>
### 捕获模式

异步 块使用与闭包相同的 [capture modes] 从环境捕获变量。与闭包类似，当写成 `async { .. }` 时，每个变量的捕获模式将从块的内容中推断出来。然而，`async move { .. }` 块会将所有引用的变量移动到结果未来中。

<a id="expr.block.异步.context"></a>
### 异步 上下文

由于 异步 块构造了一个未来值，它们定义了一个 **异步 上下文**，该上下文可以包含 [`await` 表达式]。异步 上下文由 异步 块以及异步函数的主体建立，其语义是根据 异步 块来定义的。

<a id="expr.block.异步.function"></a>
### 控制流运算符

<a id="expr.block.异步.function.intro"></a> 异步 块类似于函数边界，与闭包类似。

<a id="expr.block.异步.function.return-try"></a> 因此，`?` 运算符和 `return` 表达式都会影响未来的输出，而不是包围的函数或其他上下文。也就是说，在异步块中执行 `return <expr>` 会将 `<expr>` 的结果作为未来输出的结果返回。同样，如果 `<expr>?` 引发错误，该错误也会作为未来输出的结果传播。

<a id="expr.block.异步.function.control-flow"></a> 最后，`break` 和 `continue` 关键字不能用于从异步块中分支出来。因此以下代码是无效的：

```rust,compile_fail
loop {
    async move {
        break; // error[E0267]: `break` inside of an `async` block
    }
}
```

<a id="expr.block.const"></a>
## `const` 块

<a id="expr.block.const.syntax"></a> 
```grammar,expressions
ConstBlockExpression -> `const` BlockExpression
```

<a id="expr.block.const.intro"></a> *const 块* 是一种块表达式的变体，其主体在编译时而不是运行时评估。

<a id="expr.block.const.context"></a> Const 块允许你定义常量值，而无需定义新的 [constant items]，因此有时也被称为 *inline consts*。它还支持类型推断，因此不需要像 [constant items] 那样指定类型。

<a id="expr.block.const.泛型-params"></a> Const 块能够引用作用域内的泛型参数，与 [free][free item] constant items 不同。它们会被转换为具有作用域内泛型参数的 constant items（类似于关联常量，但不需要 trait 或类型即可关联）。例如，以下代码：

```rust
fn foo<T>() -> usize {
    const { std::mem::size_of::<T>() + 1 }
}
```

相当于：

```rust
fn foo<T>() -> usize {
    {
        struct Const<T>(T);
        impl<T> Const<T> {
            const CONST: usize = std::mem::size_of::<T>() + 1;
        }
        Const::<T>::CONST
    }
}
```

<a id="expr.block.const.evaluation"></a> 

如果 const 块表达式在运行时执行，那么即使其返回值被忽略，该常量也保证会被评估：

```rust
fn foo<T>() -> usize {
    // If this code ever gets executed, then the assertion has definitely
    // been evaluated at compile-time.
    const { assert!(std::mem::size_of::<T>() > 0); }
    // Here we can have unsafe code relying on the type being non-zero-sized.
    /* ... */
    42
}
```

<a id="expr.block.const.not-executed"></a> 

如果 const 块表达式不在运行时执行，它可能被评估也可能不被评估：
```rust,compile_fail
if false {
    // The panic may or may not occur when the program is built.
    const { panic!(); }
}
```

<a id="expr.block.不安全"></a>
## `unsafe` 块

<a id="expr.block.不安全.syntax"></a> 
```grammar,expressions
UnsafeBlockExpression -> `unsafe` BlockExpression
```

<a id="expr.block.不安全.intro"></a> _有关何时使用 `unsafe` 的更多信息，请参阅 [`unsafe` 块]。

代码块可以加上 `unsafe` 关键字以允许 [不安全 操作]。示例：

```rust
unsafe {
    let b = [13u8, 17u8];
    let a = &b[0] as *const u8;
    assert_eq!(*a, 13);
    assert_eq!(*a.offset(1), 17);
}

# unsafe fn an_unsafe_fn() -> i32 { 10 }
let a = unsafe { an_unsafe_fn() };
```

<a id="expr.block.label"></a>
## 带标签的块表达式

带标签的块表达式在 [循环及其他可中断表达式] 部分有相关文档说明。

<a id="expr.block.attributes"></a>
## 块表达式的属性

<a id="expr.block.attributes.inner-attributes"></a> [内部属性] 可以在以下情况下直接位于块表达式的开头花括号之后：

* [函数] 和 [方法] 体。 * 循环体 ([`loop`], [`while`], 和 [`for`])。 * 作为 [语句] 使用的块表达式。 * 作为 [数组表达式], [元组表达式], [调用表达式] 以及元组式 [结构] 表达式元素的块表达式。 * 作为另一个块表达式尾随表达式的块表达式。
<!-- Keep list in sync with expressions.md -->

<a id="expr.block.attributes.valid"></a> 对块表达式有意义的属性是 [`cfg`]和 [lint检查属性]。

例如，此函数在 Unix 平台上返回 `true`，在其他平台上返回 `false`。

```rust
fn is_unix_platform() -> bool {
    #[cfg(unix)] { true }
    #[cfg(not(unix))] { false }
}
```

[diverges]: expr.block.diverging
[final operand]: expr.block.inner-attributes
[never type]: type.never
[never]: type.never
[place expression]: expr.place-value.place-memory-location
[uninhabited]: glossary.uninhabited
[unit type]: type.tuple.unit
[unit value]: type.tuple.unit
[unit]: type.tuple.unit
[Loops and other breakable expressions]: expr.loop.block-labels

[`await` expressions]: await-expr.md
[`cfg`]: ../conditional-compilation.md
[`for`]: loop-expr.md#iterator-loops
[`loop`]: loop-expr.md#infinite-loops
[`unsafe` blocks]: ../unsafe-keyword.md#unsafe-blocks-unsafe-
[`while`]: loop-expr.md#predicate-loops
[array expressions]: array-expr.md
[call expressions]: call-expr.md
[capture modes]: ../types/closure.md#capture-modes
[constant items]: ../items/constant-items.md
[free item]: ../glossary.md#free-item
[function]: ../items/functions.md
[inner attributes]: ../attributes.md
[method]: ../items/associated-items.md#methods
[mutable reference]: ../types/pointer.md#mutables-references-
[scopes]: ../names/scopes.md
[shared references]: ../types/pointer.md#shared-references-
[statement]: ../statements.md
[statements]: ../statements.md
[struct]: struct-expr.md
[the lint check attributes]: ../attributes/diagnostics.md#lint-check-attributes
[tuple expressions]: tuple-expr.md
[unsafe operations]: ../unsafety.md
[value expressions]: ../expressions.md#place-expressions-and-value-expressions
