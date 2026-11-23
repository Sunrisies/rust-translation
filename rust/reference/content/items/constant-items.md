<a id="items.const"></a>
# 常量项

<a id="items.const.syntax"></a> 
```grammar,items
ConstantItem ->
    `const` ( IDENTIFIER | `_` ) `:` Type ( `=` Expression )? `;`
```

<a id="items.const.intro"></a> 一个*常量项*是一个可选择的命名_[常量值]_，它不与程序中的特定内存位置关联。

<a id="items.const.behavior"></a> 常量在使用时基本上会被内联到相关上下文中，这意味着它们会直接被复制到该上下文中。这包括使用来自外部库의常量以及非-[`Copy`]类型。对同一个常量的引用不一定保证指向相同的内存地址。

<a id="items.const.namespace"></a> 常量声明在模块或块中的[value命名空间]中定义该常量值。

<a id="items.const.static"></a> 常量必须被显式指定类型。该类型必须具有`'static`生命周期：初始化器中的任何引用都必须具有`'static`生命周期。常量类型的引用默认采用`'static`生命周期；参见[静态生命周期省略]。

<a id="items.const.static-temporary"></a> 如果常量值适合进行[提升]，则对常量的引用将具有`'static`生命周期；否则，会创建一个临时变量。

```rust
const BIT1: u32 = 1 << 0;
const BIT2: u32 = 1 << 1;

const BITS: [u32; 2] = [BIT1, BIT2];
const STRING: &'static str = "bitstring";

struct BitsNStrings<'a> {
    mybits: [u32; 2],
    mystring: &'a str,
}

const BITS_N_STRINGS: BitsNStrings<'static> = BitsNStrings {
    mybits: BITS,
    mystring: STRING,
};
```

<a id="items.const.expr-omission"></a> 常量表达式只能在[trait定义]中省略。

<a id="items.const.destructor"></a>
## 带有析构函数的常量

常量可以包含析构函数。当值超出作用域时，析构函数会被执行。

```rust
struct TypeWithDestructor(i32);

impl Drop for TypeWithDestructor {
    fn drop(&mut self) {
        println!("Dropped. Held {}.", self.0);
    }
}

const ZERO_WITH_DESTRUCTOR: TypeWithDestructor = TypeWithDestructor(0);

fn create_and_drop_zero_with_destructor() {
    let x = ZERO_WITH_DESTRUCTOR;
    // x gets dropped at end of function, calling drop.
    // prints "Dropped. Held 0.".
}
```

<a id="items.const.unnamed"></a>
## 无名称常量

<a id="items.const.unnamed.intro"></a> 与[关联常量]不同，[自由]常量可以通过使用下划线代替名称来保持无名称状态。例如：

```rust
const _: () =  { struct _SameNameTwice; };

// OK although it is the same name as above:
const _: () =  { struct _SameNameTwice; };
```

<a id="items.const.unnamed.repetition"></a> 类似于[下划线导入]，宏可以在同一作用域中多次安全地输出相同的无名称常量。例如，以下代码不应产生错误：

```rust
macro_rules! m {
    ($item: item) => { $item $item }
}

m!(const _: () = (););
// This expands to:
// const _: () = ();
// const _: () = ();
```

<a id="items.const.eval"></a>
## 求值

[自由][free]常量总是在编译时[求值][const_eval]以触发panic。即使是在未使用的函数中也是如此。

```rust,compile_fail
// Compile-time panic
const PANIC: () = std::unimplemented!();

fn unused_generic_function<T>() {
    // A failing compile-time assertion
    const _: () = assert!(usize::BITS == 0);
}
```

[promotion]: destructors.scope.const-promotion

[const_eval]: ../const_eval.md
[associated constant]: ../items/associated-items.md#associated-constants
[constant value]: ../const_eval.md#constant-expressions
[free]: ../glossary.md#free-item
[static lifetime elision]: ../lifetime-elision.md#const-and-static-elision
[trait definition]: traits.md
[underscore imports]: use-declarations.md#underscore-imports
[`Copy`]: ../special-types-and-traits.md#copy
[value namespace]: ../names/namespaces.md
