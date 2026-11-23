<a id="expr.call"></a>
# 调用表达式

<a id="expr.call.syntax"></a> 
```grammar,expressions
CallExpression -> Expression `(` CallParams? `)`

CallParams -> Expression ( `,` Expression )* `,`?
```

<a id="expr.call.intro"></a> 一个*调用表达式*用于调用函数。调用表达式的语法是一个被称为*函数操作数*的表达式，后面跟着由逗号分隔的、作为*参数操作数*的表达式列表。

<a id="expr.call.convergence"></a> 如果函数最终返回，则表达式完成执行。

<a id="expr.call.trait"></a> 对于[非函数类型]，表达式 `f(...)` 会根据函数操作数使用以下 trait 中的某个方法：

- [`Fn`] 或 [`AsyncFn`] --- 共享引用。 - [`FnMut`] 或 [`AsyncFnMut`] --- 可变引用。 - [`FnOnce`] 或 [`AsyncFnOnce`] --- 值。

<a id="expr.call.autoref-deref"></a> 如果需要，将进行自动借用。函数操作数也会根据需求被[自动解引用]。

调用表达式的一些示例：

```rust
# fn add(x: i32, y: i32) -> i32 { 0 }
let three: i32 = add(1i32, 2i32);
let name: &'static str = (|| "Rust")();
```

<a id="expr.call.desugar"></a>
## 消除函数调用的歧义

<a id="expr.call.desugar.fully-qualified"></a> 所有函数调用都是更明确的[完全限定语法]的糖代码。

<a id="expr.call.desugar.ambiguity"></a> 根据调用中的模糊性以及作用域内项的情况，可能需要对函数调用进行完全限定。

> [!NOTE] > 过去，在文档、问题报告、RFC 和其他社区写作中使用了“无歧义函数调用语法”、“通用函数调用语法”或“UFCS”等术语。然而，这些术语缺乏描述性，可能会混淆当前问题。我们在此提及它们只是为了便于搜索。

<a id="expr.call.desugar.limits"></a> 经常会出现一些情况导致对方法或相关函数调用的接收者或引用对象的歧义。这些情况可能包括：

* 多个作用域内 trait 为相同类型定义了同名的方法 * 自动`deref`是不理想的；例如，区分智能指针本身上的方法与指针的引用对象 * 不接受参数的方法，如 [`default()`]，以及返回类型属性的方法，如 [`size_of()`]

<a id="expr.call.desugar.explicit-path"></a> 为了消除歧义，程序员可以使用更具体的路径、类型或特征来引用他们想要调用的方法或函数。

例如，

```rust
trait Pretty {
    fn print(&self);
}

trait Ugly {
    fn print(&self);
}

struct Foo;
impl Pretty for Foo {
    fn print(&self) {}
}

struct Bar;
impl Pretty for Bar {
    fn print(&self) {}
}
impl Ugly for Bar {
    fn print(&self) {}
}

fn main() {
    let f = Foo;
    let b = Bar;

    // we can do this because we only have one item called `print` for `Foo`s
    f.print();
    // more explicit, and, in the case of `Foo`, not necessary
    Foo::print(&f);
    // if you're not into the whole brevity thing
    <Foo as Pretty>::print(&f);

    // b.print(); // Error: multiple 'print' found
    // Bar::print(&b); // Still an error: multiple `print` found

    // necessary because of in-scope items defining `print`
    <Bar as Pretty>::print(&b);
}
```

有关更多细节和动机，请参阅 [RFC 132]。

[`default()`]: std::default::Default::default
[`size_of()`]: std::mem::size_of

[RFC 132]: https://github.com/rust-lang/rfcs/blob/master/text/0132-ufcs.md
[automatically dereferenced]: field-expr.md#automatic-dereferencing
[fully-qualified syntax]: ../paths.md#qualified-paths
[non-function types]: ../types/function-item.md
