<a id="expr.method"></a>
# 方法调用表达式

<a id="expr.method.syntax"></a> 
```grammar,expressions
MethodCallExpression -> Expression `.` PathExprSegment `(`CallParams? `)`
```

<a id="expr.method.intro"></a> 一个_方法调用_由一个表达式（即*接收者*）后跟一个点、一个表达式路径段以及一个括号中的表达式列表组成。

<a id="expr.method.target"></a> 方法调用会被解析为特定特质上的相关[方法]，如果左侧的`self`类型已知，则静态派发到该方法；如果左侧表达式是间接的[特质对象](../types/trait-object.md)，则动态派发。

```rust
let pi: Result<f32, _> = "3.14".parse();
let log_pi = pi.unwrap_or(1.0).log(2.72);
# assert!(1.14 < log_pi && log_pi < 1.15)
```

<a id="expr.method.autoref-deref"></a> 在查找方法调用时，接收者可能会自动被解引用或借用以调用方法。这比其他函数需要更复杂的查找过程，因为可能存在多种可调用方法。使用以下流程：

<a id="expr.method.candidate-receivers"></a> 第一步是构建候选接收者类型的列表。通过反复[解引用][dereference]接收者表达式的类型来获取这些类型，将遇到的每个类型添加到列表中，最后尝试进行数组[无大小强制转换]，如果成功则添加结果类型。

<a id="expr.method.candidate-receivers-refs"></a> 然后，对于每一个候选类型`T`，在`T`之后立即添加`&T`和`&mut T`。

例如，如果接收者的类型为`Box<[i32;2]>，则候选类型将包括`Box<[i32;2]>`、`&Box<[i32;2]>`、`&mut Box<[i32;2]>`、`[i32; 2]`（通过解引用）、`&[i32; 2]`、`&mut [i32; 2]`、`[i32]`（通过无大小强制转换）、`&[i32]`，最后是`&mut [i32]`。

<a id="expr.method.candidate-receivers"></a> 然后，对于每一个候选类型`T`，在以下位置查找具有该类型接收者的[可见]方法：

1. `T`自身的固有方法（直接在`T`上实现的方法）。1. `T`所实现的[可见]特质提供的任何方法。如果`T`是类型参数，则首先查找由`T`的特质边界提供的方法，然后查找作用域内的所有剩余方法。

> [!NOTE]
> The lookup is done for each type in order, which can occasionally lead to surprising results. The below code will print "In trait impl!", because `&self` methods are looked up first, the trait method is found before the struct's `&mut self` method is found.
>
> ```rust
> struct Foo {}
>
> trait Bar {
>   fn bar(&self);
> }
>
> impl Foo {
>   fn bar(&mut self) {
>     println!("In struct impl!")
>   }
> }
>
> impl Bar for Foo {
>   fn bar(&self) {
>     println!("In trait impl!")
>   }
> }
>
> fn main() {
>   let mut f = Foo{};
>   f.bar();
> }
> ```

<a id="expr.method.ambiguous-target"></a> 如果导致多个可能的候选者，则属于错误，必须将接收者 [转换为][disambiguate call] 为适当的接收者类型以完成方法调用。

<a id="expr.method.receiver-constraints"></a> 此过程不考虑接收者的可变性或生命周期，也不考虑方法是否为 `unsafe`。一旦查找到某个方法，如果因上述原因之一而无法调用，则会产生编译器错误。

<a id="expr.method.ambiguous-search"></a> 如果到达一个阶段存在多个可能的方法，例如泛型方法或特征被视为相同的情况，则属于编译器错误。这些情况需要 [消除歧义的函数调用语法] 来进行方法和函数调用。

<a id="expr.method.edition2021"></a> 
> [!EDITION-2021]
> Before the 2021 edition, during the search for visible methods, if the candidate receiver type is an [array type], methods provided by the standard library [`IntoIterator`] trait are ignored.
>
> The edition used for this purpose is determined by the token representing the method name.
>
> This special case may be removed in the future.

> [!WARNING]
> For [trait objects], if there is an inherent method of the same name as a trait method, it will give a compiler error when trying to call the method in a method call expression. Instead, you can call the method using [disambiguating function call syntax], in which case it calls the trait method, not the inherent method. There is no way to call the inherent method. Just don't define inherent methods on trait objects with the same name as a trait method and you'll be fine.

[`IntoIterator`]: std::iter::IntoIterator

[visible]: ../visibility-and-privacy.md
[array type]: ../types/array.md
[trait objects]: ../types/trait-object.md
[disambiguate call]: call-expr.md#disambiguating-function-calls
[disambiguating function call syntax]: call-expr.md#disambiguating-function-calls
[dereference]: operator-expr.md#the-dereference-operator
[methods]: ../items/associated-items.md#methods
[unsized coercion]: ../type-coercions.md#unsized-coercions
