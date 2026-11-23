<a id="variable"></a>
# 变量

<a id="variable.intro"></a> _变量_是栈帧的组成部分，可以是命名函数参数、匿名[临时变量](expressions.md#temporaries)或命名局部变量。

<a id="variable.local"></a> _局部变量_（或*栈本地*分配）直接在栈内存中分配值。该值属于栈帧的一部分。

<a id="variable.local-mut"></a> 除非另有声明，否则局部变量是不可变的。例如：`let mut x = ...`。

<a id="variable.param-mut"></a> 函数参数除非使用 `mut` 声明，否则都是不可变的。`mut` 关键字仅适用于以下参数。例如：`|mut x, y|` 和 `fn f(mut x: Box<i32>, y: Box<i32>)` 声明了一个可变变量 `x` 和一个不可变变量 `y`。

<a id="variable.init"></a> 局部变量在分配时不会进行初始化。相反，整个栈帧的局部变量在帧进入时以未初始化的状态被分配。函数内的后续语句可能也可能对局部变量进行初始化。只有在通过所有可到达的控制流路径完成初始化后，才能使用这些局部变量。

在下一个示例中，`init_after_if` 在 [`if` 表达式]之后进行初始化，而 `uninit_after_if` 则没有初始化，因为它在 `else` 情况中未初始化。

```rust
# fn random_bool() -> bool { true }
fn initialization_example() {
    let init_after_if: ();
    let uninit_after_if: ();

    if random_bool() {
        init_after_if = ();
        uninit_after_if = ();
    } else {
        init_after_if = ();
    }

    init_after_if; // ok
    // uninit_after_if; // err: use of possibly uninitialized `uninit_after_if`
}
```

[`if` expression]: expressions/if-expr.md#if-expressions
