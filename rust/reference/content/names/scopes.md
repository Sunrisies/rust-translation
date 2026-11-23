<a id="names.scopes"></a>
# 作用域

<a id="names.scopes.intro"></a> *作用域*是指源文本中某个命名[实体]可以以其名称被引用的区域。以下章节详细介绍了与作用域规则和行为相关的内容，这些规则和行为取决于实体类型及其声明位置。关于名称如何解析为实体的过程则在[name resolution]章节中有描述。有关用于运行析构函数的“删除作用域”的更多信息可在[destructors]章节中找到。

<a id="names.scopes.items"></a>
## 项的作用域

<a id="names.scopes.items.module"></a> 直接在[模块]中声明的[项][items]具有从模块开始到模块结束的作用域。这些项也是该模块的成员，可以通过源自其模块的[路径]来引用。

<a id="names.scopes.items.statement"></a> 作为[语句]声明的项具有从该项语句所在的代码块开始到代码块结束的作用域。

<a id="names.scopes.items.duplicate"></a> 在同一模块或代码块内的同一[namespace]中引入另一个项的重复名称的项是错误的。[星号glob导入]在处理重复名称和遮蔽方面有特殊行为，更多细节请参见相关章节。

<a id="names.scopes.items.shadow-prelude"></a> 模块中的项可以遮蔽[prelude](#prelude-scopes)中的项。

<a id="names.scopes.items.nested-modules"></a> 外部模块中的项在嵌套模块中不具有作用域。可以使用[路径]来引用另一个模块中的项。

<a id="names.scopes.associated-items"></a>
### 关联项的作用域

<a id="names.scopes.associated-items.scope"></a> [关联项]没有作用域，只能通过从它们所关联的类型或特质开始的[路径]来引用。[方法]也可以通过[调用表达式]来引用。

<a id="names.scopes.associated-items.duplicate"></a> 与模块或代码块中的项类似，在同一个命名空间内的特质或实现中引入另一个项的重复名称的项是错误的。

<a id="names.scopes.pattern-bindings"></a>
## 模式绑定作用域

<a id="names.scopes.pattern-bindings.intro"></a> 局部变量 [模式] 绑定的作用域取决于其使用位置：

<a id="names.scopes.pattern-bindings.let"></a> * [`let` 语句] 的绑定范围从 `let` 语句之后直到声明该变量的代码块结束。 r[names.scopes.pattern-bindings.parameter] * [函数参数] 的绑定位于函数体内。 r[names.scopes.pattern-bindings.闭包] * [闭包参数] 的绑定位于闭包体内。 r[names.scopes.pattern-bindings.loop] * [`for` 循环] 的绑定位于循环体内。 r[names.scopes.pattern-bindings.let-chains] * [`if let`] 和 [`while let`] 的绑定在以下条件以及 consequent 代码块中也是有效的。 r[names.scopes.pattern-bindings.match-arm] * [`match` 分支] 的绑定位于 [匹配保护] 和 match 分支表达式内。 r[names.scopes.pattern-bindings.match-guard-let] * [`match` 保护 `let`] 的绑定在以下保护条件及 match 分支表达式中是有效的。

<a id="names.scopes.pattern-bindings.items"></a> 局部变量作用域不会扩展到 item 声明处。
<!-- Not entirely, see https://github.com/rust-lang/rust/issues/33118 -->

### 模式绑定遮蔽

<a id="names.scopes.pattern-bindings.shadow"></a> 模式绑定可以遮蔽作用域中的任何名称，但以下情况属于错误：

* [常量泛型参数] * [静态项] * [常量项] * [结构体] 和 [枚举] 的构造函数

以下示例说明局部绑定如何遮蔽 item 声明：

```rust
fn shadow_example() {
    // Since there are no local variables in scope yet, this resolves to the function.
    foo(); // prints `function`
    let foo = || println!("closure");
    fn foo() { println!("function"); }
    // This resolves to the local closure since it shadows the item.
    foo(); // prints `closure`
}
```

<a id="names.scopes.泛型-parameters"></a>
## 泛型参数作用域

<a id="names.scopes.泛型-parameters.param-list"></a> 泛型参数在 [GenericParams] 列表中声明。泛型参数的作用域位于其声明的 item 内部。

<a id="names.scopes.泛型-parameters.order-independent"></a> 所有参数在泛型参数列表中的作用域与它们的声明顺序无关。以下示例展示了某些参数在声明之前即可被引用的情况：

```rust
// The 'b bound is referenced before it is declared.
fn params_scope<'a: 'b, 'b>() {}

# trait SomeTrait<const Z: usize> {}
// The const N is referenced in the trait bound before it is declared.
fn f<T: SomeTrait<N>, const N: usize>() {}
```

<a id="names.scopes.泛型-parameters.bounds"></a> 泛型参数也适用于类型边界和 where 子句，例如：

```rust
# trait SomeTrait<'a, T> {}
// The <'a, U> for `SomeTrait` refer to the 'a and U parameters of `bounds_scope`.
fn bounds_scope<'a, T: SomeTrait<'a, U>, U>() {}

fn where_scope<'a, T, U>()
    where T: SomeTrait<'a, U>
{}
```

<a id="names.scopes.泛型-parameters.inner-items"></a> 在函数中声明的 [items] 引用其外部作用域中的泛型参数是一个错误。

```rust,compile_fail
fn example<T>() {
    fn inner(x: T) {} // ERROR: can't use generic parameters from outer function
}
```

### 泛型参数遮蔽

<a id="names.scopes.泛型-parameters.shadow"></a> 遮蔽泛型参数是一个错误，但函数在内声明的 items 可以遮蔽函数中的泛型参数名称。

```rust
fn example<'a, T, const N: usize>() {
    // Items within functions are allowed to shadow generic parameter in scope.
    fn inner_lifetime<'a>() {} // OK
    fn inner_type<T>() {} // OK
    fn inner_const<const N: usize>() {} // OK
}
```

```rust,compile_fail
trait SomeTrait<'a, T, const N: usize> {
    fn example_lifetime<'a>() {} // ERROR: 'a is already in use
    fn example_type<T>() {} // ERROR: T is already in use
    fn example_const<const N: usize>() {} // ERROR: N is already in use
    fn example_mixed<const T: usize>() {} // ERROR: T is already in use
}
```

<a id="names.scopes.lifetimes"></a>
### 生命周期作用域

<a id="names.scopes.lifetimes.intro"></a> 生命周期参数在 [GenericParams] 列表中以及 [更高阶的 trait 边界][hrtb] 中声明。

<a id="names.scopes.lifetimes.special"></a> `'static` 生命周期和 `[占位符生命周期] '_` 具有特殊含义，不能作为参数声明。

#### 生命周期泛型参数作用域

<a id="names.scopes.lifetimes.泛型"></a> [常量] 和 [静态] items 以及 [const contexts] 只能允许使用 `'static` 生命周期引用，因此其他生命周期无法在其内部作用域中存在。[相关 consts] 可以引用其 trait 或实现中声明的生命周期。

#### 更高阶的 trait 边界作用域

<a id="names.scopes.lifetimes.higher-ranked"></a> 作为 [更高阶的 trait 边界][hrtb] 声明的生命周期参数，其作用域取决于其使用场景。

* 作为 [TypeBoundWhereClauseItem]，声明的生命周期在类型及其类型边界中有效。 * 作为 [TraitBound]，声明的生命周期在边界类型路径中有效。 * 作为 [BareFunctionType]，声明的生命周期在函数参数和返回类型中有效。

```rust
# trait Trait<'a>{}

fn where_clause<T>()
    // 'a is in scope in both the type and the type bounds.
    where for <'a> &'a T: Trait<'a>
{}

fn bound<T>()
    // 'a is in scope within the bound.
    where T: for <'a> Trait<'a>
{}

# struct Example<'a> {
#     field: &'a u32
# }

// 'a is in scope in both the parameters and return type.
type FnExample = for<'a> fn(x: Example<'a>) -> Example<'a>;
```

#### 实现 trait 限制

<a id="names.scopes.lifetimes.实现-trait"></a> [实现 trait] 类型只能引用在函数或实现中声明的生命周期。

<!-- not able to demonstrate the scope error because the compiler panics
     https://github.com/rust-lang/rust/issues/67830 -->
```rust
# trait Trait1 {
#     type Item;
# }
# trait Trait2<'a> {}
#
# struct Example;
#
# impl Trait1 for Example {
#     type Item = Element;
# }
#
# struct Element;
# impl<'a> Trait2<'a> for Element {}
#
// The `impl Trait2` here is not allowed to refer to 'b but it is allowed to
// refer to 'a.
fn foo<'a>() -> impl for<'b> Trait1<Item = impl Trait2<'a> + use<'a>> {
    // ...
#    Example
}
```

<a id="names.scopes.loop-label"></a>
## 循环标签作用域

<a id="names.scopes.loop-label.scope"></a> [循环标签] 可以通过 [循环表达式] 来声明。循环标签的作用域从其被声明的位置开始，直到循环表达式的结束为止。该作用域不会延伸到 [项], [闭包], [异步块], [常量参数], [常量上下文] 以及定义 [`for` 循环] 的迭代表达式。

```rust
'a: for n in 0..3 {
    if n % 2 == 0 {
        break 'a;
    }
    fn inner() {
        // Using 'a here would be an error.
        // break 'a;
    }
}

// The label is in scope for the expression of `while` loops.
'a: while break 'a {}         // Loop does not run.
'a: while let _ = break 'a {} // Loop does not run.

// The label is not in scope in the defining `for` loop:
'a: for outer in 0..5 {
    // This will break the outer loop, skipping the inner loop and stopping
    // the outer loop.
    'a: for inner in { break 'a; 0..1 } {
        println!("{}", inner); // This does not run.
    }
    println!("{}", outer); // This does not run, either.
}

```

<a id="names.scopes.loop-label.shadow"></a> 循环标签可能会遮蔽外部作用域中相同名称的标签。对标签的引用会指向最近的定义。

```rust
// Loop label shadowing example.
'a: for outer in 0..5 {
    'a: for inner in 0..5 {
        // This terminates the inner loop, but the outer loop continues to run.
        break 'a;
    }
}
```

<a id="names.scopes.prelude"></a>
## Prelude 作用域

<a id="names.scopes.prelude.intro"></a> [Preludes] 将实体引入每个模块的作用域中。这些实体不是模块的成员，但在 [名称解析] 过程中会被隐式查询。

<a id="names.scopes.prelude.shadow"></a> Prelude 名称可能会被模块中的声明遮蔽。

<a id="names.scopes.prelude.layers"></a> Preludes 是分层排列的，如果它们包含相同名称的实体，则一个会遮蔽另一个。Preludes 可能遮蔽其他 Preludes 的顺序如下：较早的条目可能会遮蔽较后的条目：

1. [外部 Prelude] 2. [工具 Prelude] 3. [`macro_use` Prelude] 4. [标准库 Prelude] 5. [语言 Prelude]

<a id="names.scopes.macro_rules"></a>
## `macro_rules` 作用域

`macro_rules` 宏的作用域在 [Macros By Example] 章节中有描述。其行为取决于 [`macro_use`] 和 [`macro_export`] 属性的使用。

<a id="names.scopes.derive"></a>
## Derive 宏辅助属性

<a id="names.scopes.derive.scope"></a> [Derive 宏辅助属性] 在其对应的 [`derive` 属性] 被指定的项中处于作用域中。该作用域从 `derive` 属性之后立即开始，直到该项结束。<!-- 注意：并非绝对如此，请参考 https://github.com/rust-lang/rust/issues/79202，但这只是设计意图。 -->

<a id="names.scopes.derive.shadow"></a> 辅助属性会遮蔽作用域中相同名称的其他属性。

<a id="names.scopes.self"></a>
## `Self` 作用域

<a id="names.scopes.self.intro"></a> 尽管 [`Self`]是一个具有特殊含义的关键字，但其与名称解析的交互方式类似于普通名称。

<a id="names.scopes.self.def-scope"></a> 在定义 [结构体]、[枚举]、[union]、[trait] 或 [implementation] 时隐式的 `Self` 类型与 [泛型 parameter](#泛型-parameter-scopes) 的处理方式相同，其作用域也类似于泛型类型参数。

<a id="names.scopes.self.实现-scope"></a> [implementation] 的值 [namespace] 中的隐式 `Self` 构造函数在实现体内部（即实现的 [associated items]）具有作用域。

```rust
// Self type within struct definition.
struct Recursive {
    f1: Option<Box<Self>>
}

// Self type within generic parameters.
struct SelfGeneric<T: Into<Self>>(T);

// Self value constructor within an implementation.
struct ImplExample();
impl ImplExample {
    fn example() -> Self { // Self type
        Self() // Self value constructor
    }
}
```

[`match` guard `let`]: expr.match.guard.let

[`derive` attribute]: ../attributes/derive.md
[`for` loop]: ../expressions/loop-expr.md#iterator-loops
[`for`]: ../expressions/loop-expr.md#iterator-loops
[`if let`]: ../expressions/if-expr.md#if-let-patterns
[`while let`]: ../expressions/loop-expr.md#while-let-patterns
[`let` statement]: ../statements.md#let-statements
[`macro_export`]: ../macros-by-example.md#the-macro_export-attribute
[`macro_use` prelude]: preludes.md#macro_use-prelude
[`macro_use`]: ../macros-by-example.md#the-macro_use-attribute
[`match` arms]: ../expressions/match-expr.md
[`Self`]: ../paths.md#self-1
[Associated consts]: ../items/associated-items.md#associated-constants
[associated items]: ../items/associated-items.md
[Asterisk glob imports]: ../items/use-declarations.md
[async blocks]: ../expressions/block-expr.md#async-blocks
[call expressions]: ../expressions/call-expr.md
[Closure parameter]: ../expressions/closure-expr.md
[closures]: ../expressions/closure-expr.md
[const arguments]: ../items/generics.md#const-generics
[const contexts]: ../const_eval.md#const-context
[Const generic parameters]: ../items/generics.md#const-generics
[Const items]: ../items/constant-items.md
[Constant]: ../items/constant-items.md
[Derive macro helper attributes]: ../procedural-macros.md#derive-macro-helper-attributes
[destructors]: ../destructors.md
[entity]: ../names.md
[enum]: ../items/enumerations.mdr
[enums]: ../items/enumerations.md
[Extern prelude]: preludes.md#extern-prelude
[Function parameter]: ../items/functions.md#function-parameters
[hrtb]: ../trait-bounds.md#higher-ranked-trait-bounds
[Impl trait]: ../types/impl-trait.md
[implementation]: ../items/implementations.md
[items]: ../items.md
[Language prelude]: preludes.md#language-prelude
[loop expression]: ../expressions/loop-expr.md
[Loop labels]: ../expressions/loop-expr.md#loop-labels
[Macros By Example]: ../macros-by-example.md
[match guard]: ../expressions/match-expr.md#match-guards
[methods]: ../items/associated-items.md#methods
[module]: ../items/modules.md
[name resolution]: name-resolution.md
[namespace]: namespaces.md
[path]: ../paths.md
[pattern]: ../patterns.md
[placeholder lifetime]: ../lifetime-elision.md
[preludes]: preludes.md
[Standard library prelude]: preludes.md#standard-library-prelude
[statement]: ../statements.md
[Static items]: ../items/static-items.md
[static]: ../items/static-items.md
[struct]: ../items/structs.md
[structs]: ../items/structs.md
[Tool prelude]: preludes.md#tool-prelude
[trait]: ../items/traits.md
[union]: ../items/unions.md
