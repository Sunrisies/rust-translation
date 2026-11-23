<a id="bound"></a>
# 特征与生命周期边界

<a id="bound.syntax"></a> 
```grammar,miscellaneous
Bounds -> Bound ( `+` Bound )* `+`?

Bound -> Lifetime | TraitBound | UseBound

TraitBound ->
      ( `?` | ForLifetimes )? TypePath
    | `(` ( `?` | ForLifetimes )? TypePath `)`

LifetimeBounds -> ( Lifetime `+` )* Lifetime?

Lifetime ->
      LIFETIME_OR_LABEL
    | `'static`
    | `'_`

UseBound -> `use` UseBoundGenericArgs

UseBoundGenericArgs ->
      `<` `>`
    | `<` ( UseBoundGenericArg `,`)* UseBoundGenericArg `,`? `>`

UseBoundGenericArg ->
      Lifetime
    | IDENTIFIER
    | `Self`
```

<a id="bound.intro"></a> [特征]和生命周期边界为[泛型项][generic]提供了限制其参数类型与生命周期的方式。可以在[where子句]中对任何类型施加边界约束。对于某些常见情况，也有更简洁的写法：

* 在声明[泛型参数][generic]后书写边界时：`fn f<A: Copy>() {}`等同于`fn f<A>() where A: Copy {}`。 * 在作为[继承特征]的特征声明中：`trait Circle : Shape {}`等价于`trait Circle where Self : Shape {}`。 * 在作为[关联类型]边界的特征声明中：`trait A { type B: Copy; }`等价于`trait A where Self::B: Copy { type B; }`。

<a id="bound.satisfaction"></a> 使用某个项时，该项的边界必须得到满足。在泛型项进行类型检查和借用检查时，可以使用这些边界来确定某个特征是否针对该类型实现。例如，给定`Ty: Trait`

* 在泛型函数的主体中，可以在`Ty`值上调用来自`Trait`的方法。同样也可以使用`Trait`中的关联常量。 * 可以使用`Trait`中的关联类型。 * 具有`T: Trait`边界的泛型函数和类型可以与`Ty`一起使用，其中`T`被用作`T`。

```rust
# type Surface = i32;
trait Shape {
    fn draw(&self, surface: Surface);
    fn name() -> &'static str;
}

fn draw_twice<T: Shape>(surface: Surface, sh: T) {
    sh.draw(surface);           // Can call method because T: Shape
    sh.draw(surface);
}

fn copy_and_draw_twice<T: Copy>(surface: Surface, sh: T) where T: Shape {
    let shape_copy = sh;        // doesn't move sh because T: Copy
    draw_twice(surface, sh);    // Can use generic function because T: Shape
}

struct Figure<S: Shape>(S, S);

fn name_figure<U: Shape>(
    figure: Figure<U>,          // Type Figure<U> is well-formed because U: Shape
) {
    println!(
        "Figure of two {}",
        U::name(),              // Can use associated function
    );
}
```

<a id="bound.trivial"></a> 在定义项时，不会使用该项的参数或[更高阶的生命周期]的边界会被检查。这样的边界为假是一个错误。

<a id="bound.special"></a> [`Copy`]、[`Clone`]和[`Sized`]边界在使用该项时也会被检查，即使使用方式没有提供具体类型。将`Copy`或`Clone`作为可变引用、[特征对象]或[切片]的边界是一个错误。将`Sized`作为特征对象或切片的边界也是一个错误。

```rust,compile_fail
struct A<'a, T>
where
    i32: Default,           // Allowed, but not useful
    i32: Iterator,          // Error: `i32` is not an iterator
    &'a mut T: Copy,        // (at use) Error: the trait bound is not satisfied
{
    f: &'a T,
}
struct UsesA<'a, T>(A<'a, T>);
```

<a id="bound.trait-object"></a> 特征与生命周期边界也用于命名[特征对象]。

<a id="bound.sized"></a>
## `?Sized`

`?`仅用于放宽[类型参数]或[关联类型]的隐式[`Sized`]特征的边界。`?Sized`不得作为其他类型的边界使用。

<a id="bound.生命周期"></a>
## 生命周期边界

<a id="bound.生命周期.intro"></a> 生命周期边界可以应用于类型或其他生命周期。

<a id="bound.生命周期.outlive-生命周期"></a> 边界 `'a: 'b` 通常读作 `'a` *在' b 之后* 存活。`'a: 'b` 表示 `'a` 的持续时间至少与 `'b` 相同，因此当 `&'b ()` 有效时，`&'a ()` 也是有效的。

```rust
fn f<'a, 'b>(x: &'a i32, mut y: &'b i32) where 'a: 'b {
    y = x;                      // &'a i32 is a subtype of &'b i32 because 'a: 'b
    let r: &'b &'a i32 = &&0;   // &'b &'a i32 is well formed because 'a: 'b
}
```

<a id="bound.生命周期.outlive-type"></a> `T: 'a` 表示 `T` 的所有生命周期参数都在 `'a` 之后存活。例如，如果 `'a` 是一个无约束的生命周期参数，那么 `i32: 'static` 和 `&'static str: 'a` 是满足的，但 `Vec<&'a ()>: 'static` 则不满足。

<a id="bound.higher-ranked"></a>
## 更高级别的 trait 边界

<a id="bound.higher-ranked.syntax"></a> 
```grammar,miscellaneous
ForLifetimes -> `for` GenericParams
```

<a id="bound.higher-ranked.intro"></a> trait 边界可能是比生命周期更高的级别。这些边界指定了一个对所有生命周期都成立的边界。例如，像 `for<'a> &'a T: PartialEq<i32>` 这样的边界将需要类似以下的实现：

```rust
# struct T;
impl<'a> PartialEq<i32> for &'a T {
    // ...
#    fn eq(&self, other: &i32) -> bool {true}
}
```

然后可以用它来比较一个 `&'a T` 与任何生命周期和 `i32`。

这里只能使用更高级别的边界，因为引用生命周期比函数上的任何可能生命周期参数都短：

```rust
fn call_on_ref_zero<F>(f: F) where for<'a> F: Fn(&'a i32) {
    let zero = 0;
    f(&zero);
}
```

<a id="bound.higher-ranked.trait"></a> 更高的生命周期也可以在 trait 之前指定：唯一的区别是生命周期参数的 [scope][hrtb-scopes]，它仅扩展到下一个 trait 的末尾而不是整个边界。这个功能与上一个等价。

```rust
fn call_on_ref_zero<F>(f: F) where F: for<'a> Fn(&'a i32) {
    let zero = 0;
    f(&zero);
}
```

<a id="bound.implied"></a>
## 隐含的边界

<a id="bound.implied.intro"></a> 使类型成为合法所需的生命周期边界有时会被推断出来。

```rust
fn requires_t_outlives_a<'a, T>(x: &'a T) {}
```

对于类型 `&'a T` 来说，类型参数 `T` 必须能在 `'a` 之后存活，才能使该类型成为合法。这是通过函数签名中的 `&'a T` 来推断的，因为只有当 `T: 'a` 成立时，`&'a T` 才是有效的。

<a id="bound.implied.context"></a> 隐含边界会被添加到函数的所有参数和输出上。在 `requires_t_outlives_a` 中，即使你没有明确指定，也可以假设 `T: 'a`。

```rust
fn requires_t_outlives_a_not_implied<'a, T: 'a>() {}

fn requires_t_outlives_a<'a, T>(x: &'a T) {
    // This compiles, because `T: 'a` is implied by
    // the reference type `&'a T`.
    requires_t_outlives_a_not_implied::<'a, T>();
}
```

```rust,compile_fail,E0309
# fn requires_t_outlives_a_not_implied<'a, T: 'a>() {}
fn not_implied<'a, T>() {
    // This errors, because `T: 'a` is not implied by
    // the function signature.
    requires_t_outlives_a_not_implied::<'a, T>();
}
```

<a id="boundimplied.trait"></a> 只有生命周期边界被隐含，trait 边界仍然需要显式添加。因此，以下示例会导致错误：

```rust,compile_fail,E0277
use std::fmt::Debug;
struct IsDebug<T: Debug>(T);
// error[E0277]: `T` doesn't implement `Debug`
fn doesnt_specify_t_debug<T>(x: IsDebug<T>) {}
```

<a id="bound.implied.def"></a> 对于任何类型，类型定义和 实现 块也会推断出生命周期边界：

```rust
struct Struct<'a, T> {
    // This requires `T: 'a` to be well-formed
    // which is inferred by the compiler.
    field: &'a T,
}

enum Enum<'a, T> {
    // This requires `T: 'a` to be well-formed,
    // which is inferred by the compiler.
    //
    // Note that `T: 'a` is required even when only
    // using `Enum::OtherVariant`.
    SomeVariant(&'a T),
    OtherVariant,
}

trait Trait<'a, T: 'a> {}

// This would error because `T: 'a` is not implied by any type
// in the impl header.
//     impl<'a, T> Trait<'a, T> for () {}

// This compiles as `T: 'a` is implied by the self type `&'a T`.
impl<'a, T> Trait<'a, T> for &'a T {}
```

<a id="bound.use"></a>
## 使用边界

某些边界列表可能包含 `use<..>` 边界，用于控制哪些泛型参数被 `impl Trait` [抽象返回类型] 捕获。更多细节请参见 [精确捕获]。

[abstract return type]: types/impl-trait.md#abstract-return-types
[arrays]: types/array.md
[associated types]: items/associated-items.md#associated-types
[hrtb-scopes]: names/scopes.md#higher-ranked-trait-bound-scopes
[supertraits]: items/traits.md#supertraits
[generic]: items/generics.md
[higher-ranked lifetimes]: #higher-ranked-trait-bounds
[precise capturing]: types/impl-trait.md#precise-capturing
[slice]: types/slice.md
[Trait]: items/traits.md#trait-bounds
[trait object]: types/trait-object.md
[trait objects]: types/trait-object.md
[type parameters]: types/parameters.md
[where clause]: items/generics.md#where-clauses
