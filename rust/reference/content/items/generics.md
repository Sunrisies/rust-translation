<a id="items.generics"></a>
# 泛型参数

<a id="items.generics.syntax"></a> 
```grammar,items
GenericParams -> `<` ( GenericParam (`,` GenericParam)* `,`? )? `>`

GenericParam -> OuterAttribute* ( LifetimeParam | TypeParam | ConstParam )

LifetimeParam -> Lifetime ( `:` LifetimeBounds? )?

TypeParam -> IDENTIFIER ( `:` Bounds? )? ( `=` Type )?

ConstParam ->
    `const` IDENTIFIER `:` Type
    ( `=` ( BlockExpression | IDENTIFIER | `-`?LiteralExpression ) )?
```

<a id="items.generics.intro"></a> [函数], [类型别名], [结构体], [枚举], [联合], [特质]和[实现]可以通过类型、常量和生命周期进行*参数化*。这些参数通常列在<span class="parenthetical">括号（`<...>`）</span>中，一般位于项名之后及其定义之前。对于没有名称的实现，它们直接出现在`impl`之后。

<a id="items.generics.decl-order"></a> 泛型参数的顺序仅限于生命周期参数，然后才是类型和常量参数。

<a id="items.generics.duplicate-params"></a> [GenericParams]列表中不能重复声明相同的参数名。

一些包含类型、常量和生命周期参数的项示例：

```rust
fn foo<'a, T>() {}
trait A<U> {}
struct Ref<'a, T> where T: 'a { r: &'a T }
struct InnerArray<T, const N: usize>([T; N]);
struct EitherOrderWorks<const N: bool, U>(U);
```

<a id="items.generics.scope"></a> 泛型参数在定义该项的范围内有效，它们被声明的地方即为作用域。如[项声明]所述，这些参数在函数体内部声明的项中并不生效。更多细节请参见[泛型参数作用域]。

<a id="items.generics.builtin-泛型-types"></a> [引用], [原始指针], [数组], [切片], [元组]和[函数指针]也有生命周期或类型参数，但不会使用路径语法来引用它们。

<a id="items.generics.invalid-lifetimes"></a> `'_`和`'static`不是有效的生命周期参数名。

<a id="items.generics.const"></a>
### 常量泛型

<a id="items.generics.const.intro"></a> *常量泛型参数*允许项对常量值进行泛型处理。

<a id="items.generics.const.namespace"></a> const标识符会在[值命名空间]中引入一个名称用于常量参数，且所有该项的实例必须使用给定类型的值来实例化。

<a id="items.generics.const.allowed-types"></a> 常量参数的唯一允许类型为`u8`, `u16`, `u32`, `u64`, `u128`, `usize`, `i8`, `i16`, `i32`, `i64`, `i128`, `isize`, `char`和`bool`。

<a id="items.generics.const.use"></a> 常量参数可以在任何可以使用 [const item] 的地方使用，但有一个例外：当在 [type] 或 [array repeat expression] 中使用时，它必须是独立的（如下所述）。也就是说，它们允许出现在以下位置：

1. 作为应用于任何构成该 item 签名部分的类型的 const。2. 作为用于定义 [associated const] 的 const 表达式的一部分，或作为 [associated type] 的参数。3. 作为该 item 中任何函数体中的运行时表达式的值。4. 作为该 item 中任何函数体中使用的任何类型的参数。5. 作为该 item 中任何字段的类型的一部分。

```rust
// Examples where const generic parameters can be used.

// Used in the signature of the item itself.
fn foo<const N: usize>(arr: [i32; N]) {
    // Used as a type within a function body.
    let x: [i32; N];
    // Used as an expression.
    println!("{}", N * 2);
}

// Used as a field of a struct.
struct Foo<const N: usize>([i32; N]);

impl<const N: usize> Foo<N> {
    // Used as an associated constant.
    const CONST: usize = N * 4;
}

trait Trait {
    type Output;
}

impl<const N: usize> Trait for Foo<N> {
    // Used as an associated type.
    type Output = [i32; N];
}
```

```rust,compile_fail
// Examples where const generic parameters cannot be used.
fn foo<const N: usize>() {
    // Cannot use in item definitions within a function body.
    const BAD_CONST: [usize; N] = [1; N];
    static BAD_STATIC: [usize; N] = [1; N];
    fn inner(bad_arg: [usize; N]) {
        let bad_value = N * 2;
    }
    type BadAlias = [usize; N];
    struct BadStruct([usize; N]);
}
```

<a id="items.generics.const.standalone"></a> 进一步限制是，常量参数只能作为独立的参数出现在 [type] 或 [array repeat expression] 内部。在这些上下文中，它们只能作为单个路径段使用，可能位于 [block]（如 `N` 或 `{N}`）中。也就是说，它们不能与其他表达式结合使用。

```rust,compile_fail
// Examples where const parameters may not be used.

// Not allowed to combine in other expressions in types, such as the
// arithmetic expression in the return type here.
fn bad_function<const N: usize>() -> [u8; {N + 1}] {
    // Similarly not allowed for array repeat expressions.
    [1; {N + 1}]
}
```

<a id="items.generics.const.argument"></a> [path] 中的常量参数指定了用于该 item 的常量值。

<a id="items.generics.const.argument-const-expr"></a> 该参数必须是 [inferred const] 或属于常量参数类型的 [const expression]。除非是单个路径段（[IDENTIFIER]）或 [literal]（带有可能以 `-` 开头的标记），否则 [const expression] 必须是 [block expression][block]（用大括号包围）。

> [!NOTE]
> This syntactic restriction is necessary to avoid requiring infinite lookahead when parsing an expression inside of a type.

```rust
struct S<const N: i64>;
const C: i64 = 1;
fn f<const N: i64>() -> S<N> { S }

let _ = f::<1>(); // Literal.
let _ = f::<-1>(); // Negative literal.
let _ = f::<{ 1 + 2 }>(); // Constant expression.
let _ = f::<C>(); // Single segment path.
let _ = f::<{ C + 1 }>(); // Constant expression.
let _: S<1> = f::<_>(); // Inferred const.
let _: S<1> = f::<(((_)))>(); // Inferred const.
```

> [!NOTE]
> In a generic argument list, an [inferred const] is parsed as an [inferred type][InferredType] but then semantically treated as a separate kind of [const generic argument].

<a id="items.generics.const.inferred"></a> 当期望一个常量参数时，可以使用 `_`（可选由任意数量的匹配括号包围），称为 *inferred const*（[path rules][paths.expr.complex-const-params]，[array expression rules][expr.array.length-restriction]）。这要求编译器根据周围信息尽可能推断出常量参数。

```rust
fn make_buf<const N: usize>() -> [u8; N] {
    [0; _]
    //  ^ Infers `N`.
}
let _: [u8; 1024] = make_buf::<_>();
//                             ^ Infers `1024`.
```

> [!NOTE]
> An [inferred const] is not semantically an [expression][Expression] and so is not accepted within braces.
>
> ```rust,compile_fail
> fn f<const N: usize>() -> [u8; N] { [0; _] }
> let _: [_; 1] = f::<{ _ }>();
> //                    ^ ERROR `_` not allowed here
> ```

<a id="items.generics.const.inferred-constraint"></a> 推断出的常量不能用于 item 签名中。

```rust,compile_fail
fn f<const N: usize>(x: [u8; N]) -> [u8; _] { x }
//                                       ^ ERROR not allowed
```

<a id="items.generics.const.type-ambiguity"></a> 当泛型参数可能被解析为类型或常量参数时，如果存在歧义，它总是被解析为类型。将参数放入块表达式中可以强制其被解释为常量参数。

<!-- TODO: Rewrite the paragraph above to be in terms of namespaces, once namespaces are introduced, and it is clear which namespace each parameter lives in. -->

```rust,compile_fail
type N = u32;
struct Foo<const N: usize>;
// The following is an error, because `N` is interpreted as the type alias `N`.
fn foo<const N: usize>() -> Foo<N> { todo!() } // ERROR
// Can be fixed by wrapping in braces to force it to be interpreted as the `N`
// const parameter:
fn bar<const N: usize>() -> Foo<{ N }> { todo!() } // ok
```

<a id="items.generics.const.variance"></a> 与类型和生命周期参数不同，常量参数可以在未在参数化项中使用的场景下声明，但实现方式需遵循 [泛型 implementations] 中的描述。

```rust,compile_fail
// ok
struct Foo<const N: usize>;
enum Bar<const M: usize> { A, B }

// ERROR: unused parameter
struct Baz<T>;
struct Biz<'a>;
struct Unconstrained;
impl<const N: usize> Unconstrained {}
```

<a id="items.generics.const.exhaustiveness"></a> 在解析特质边界约束时，在确定边界是否满足时不会考虑所有常量参数实现的完备性。例如，在以下示例中，尽管 `bool` 类型的所有可能常量值都已被实现，但特质边界未得到满足仍然会引发错误。

```rust,compile_fail
struct Foo<const B: bool>;
trait Bar {}
impl Bar for Foo<true> {}
impl Bar for Foo<false> {}

fn needs_bar(_: impl Bar) {}
fn generic<const B: bool>() {
    let v = Foo::<B>;
    needs_bar(v); // ERROR: trait bound `Foo<B>: Bar` is not satisfied
}
```

<a id="items.generics.where"></a>
## Where 子句

<a id="items.generics.where.syntax"></a> 
```grammar,items
WhereClause -> `where` ( WhereClauseItem `,` )* WhereClauseItem?

WhereClauseItem ->
      LifetimeWhereClauseItem
    | TypeBoundWhereClauseItem

LifetimeWhereClauseItem -> Lifetime `:` LifetimeBounds?

TypeBoundWhereClauseItem -> ForLifetimes? Type `:` Bounds?
```

<a id="items.generics.where.intro"></a> *Where 子句* 提供了另一种指定类型和生命周期参数边界的方法，同时也用于指定非类型参数的边界。

<a id="items.generics.where.higher-ranked-lifetimes"></a> 可以使用 `for` 关键字引入 [更高等级的生命周期]。它仅允许使用 [LifetimeParam] 类型的参数。

```rust
struct A<T>
where
    T: Iterator,            // Could use A<T: Iterator> instead
    T::Item: Copy,          // Bound on an associated type
    String: PartialEq<T>,   // Bound on `String`, using the type parameter
    i32: Default,           // Allowed, but not useful
{
    f: T,
}
```

<a id="items.generics.attributes"></a>
## 属性

泛型生命周期和类型参数允许为其添加 [属性]。目前没有内置的此类属性，不过自定义派生属性可以赋予其特定含义。

此示例展示了如何使用自定义派生属性来修改泛型参数的含义。

<!-- ignore: requires proc macro derive -->
```rust,ignore
// Assume that the derive for MyFlexibleClone declared `my_flexible_clone` as
// an attribute it understands.
#[derive(MyFlexibleClone)]
struct Foo<#[my_flexible_clone(unbounded)] H> {
    a: *const H
}
```

[const generic argument]: items.generics.const.argument
[inferred const]: items.generics.const.inferred

[array repeat expression]: ../expressions/array-expr.md
[arrays]: ../types/array.md
[slices]: ../types/slice.md
[associated const]: associated-items.md#associated-constants
[associated type]: associated-items.md#associated-types
[attributes]: ../attributes.md
[block]: ../expressions/block-expr.md
[const contexts]: ../const_eval.md#const-context
[const expression]: ../const_eval.md#constant-expressions
[const item]: constant-items.md
[enumerations]: enumerations.md
[functions]: functions.md
[function pointers]: ../types/function-pointer.md
[generic implementations]: implementations.md#generic-implementations
[generic parameter scopes]: ../names/scopes.md#generic-parameter-scopes
[higher-ranked lifetimes]: ../trait-bounds.md#higher-ranked-trait-bounds
[implementations]: implementations.md
[item declarations]: ../statements.md#item-declarations
[item]: ../items.md
[literal]: ../expressions/literal-expr.md
[path]: ../paths.md
[path expression]: ../expressions/path-expr.md
[raw pointers]: ../types/pointer.md#raw-pointers-const-and-mut
[references]: ../types/pointer.md#shared-references-
[structs]: structs.md
[tuples]: ../types/tuple.md
[trait object]: ../types/trait-object.md
[traits]: traits.md
[type aliases]: type-aliases.md
[type]: ../types.md
[unions]: unions.md
[value namespace]: ../names/namespaces.md
