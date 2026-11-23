<a id="subtype"></a>
# 子类型化与变异

<a id="subtype.intro"></a> 子类型化是隐式的，可以在类型检查或推理的任何阶段发生。

<a id="subtype.kinds"></a> 子类型化仅限于两种情况：与生命周期相关的变异，以及具有更高优先级生命周期的类型的之间的变异。如果我们从类型中消除生命周期，那么唯一的子类型化将基于类型等价性。

考虑以下示例：字符串字面量始终具有 `'static` 生命周期。然而，我们可以将 `s` 赋值给 `t`：

```rust
fn bar<'a>() {
    let s: &'static str = "hi";
    let t: &'a str = s;
}
```

由于 `'static` 的寿命超过生命周期参数 `'a'`，`&'static str` 是 `&'a str` 的子类型。

<a id="subtype.higher-ranked"></a> [更高优先级]&#32;[函数指针] 和 [trait 对象] 具有另一种子类型关系。它们是由更高优先级生命周期的替换所给出的类型的子类型。一些示例：

```rust
// Here 'a is substituted for 'static
let subtype: &(for<'a> fn(&'a i32) -> &'a i32) = &((|x| x) as fn(&_) -> &_);
let supertype: &(fn(&'static i32) -> &'static i32) = subtype;

// This works similarly for trait objects
let subtype: &(dyn for<'a> Fn(&'a i32) -> &'a i32) = &|x| x;
let supertype: &(dyn Fn(&'static i32) -> &'static i32) = subtype;

// We can also substitute one higher-ranked lifetime for another
let subtype: &(for<'a, 'b> fn(&'a i32, &'b i32)) = &((|x, y| {}) as fn(&_, &_));
let supertype: &for<'c> fn(&'c i32, &'c i32) = subtype;
```

<a id="subtyping.variance"></a>
## 变异

<a id="subtyping.variance.intro"></a> 变异是泛型类型与其参数之间的一种属性。泛型类型的 *变异* 在参数上意味着参数的子类型化会影响类型的子类型化。

<a id="subtyping.variance.covariant"></a> * `F<T>` 对 `T` 是 *协变* 的，如果 `T` 是 `U` 的子类型，则意味着 `F<T>` 是 `F<U>` 的子类型（子类型化“传递”）

<a id="subtyping.variance.contravariant"></a> * `F<T>` 对 `T` 是 *反变* 的，如果 `T` 是 `U` 的子类型，则意味着 `F<U>` 是 `F<T>` 的子类型

<a id="subtyping.variance.invariant"></a> * `F<T>` 对 `T` 是 *不变量* 的（无法推导出任何子类型关系）

<a id="subtyping.variance.builtin-types"></a> 类型的变异自动按以下方式确定

| Type                          | Variance in `'a`  | Variance in `T`   |
|-------------------------------|-------------------|-------------------|
| `&'a T`                       | covariant         | covariant         |
| `&'a mut T`                   | covariant         | invariant         |
| `*const T`                    |                   | covariant         |
| `*mut T`                      |                   | invariant         |
| `[T]` and `[T; n]`            |                   | covariant         |
| `fn() -> T`                   |                   | covariant         |
| `fn(T) -> ()`                 |                   | contravariant     |
| `std::cell::UnsafeCell<T>`    |                   | invariant         |
| `std::marker::PhantomData<T>` |                   | covariant         |
| `dyn Trait<T> + 'a`           | covariant         | invariant         |

<a id="subtyping.variance.user-composite-types"></a> 其他 `struct`、`enum` 和 `union` 类型的变异取决于其字段类型的变异。如果参数在具有不同变异的位置被使用，则该参数是不变量。例如，以下结构体在 `'a` 和 `T` 中是协变的，在 `'b'`、`'c` 和 `U` 中是不变量的。

```rust
use std::cell::UnsafeCell;
struct Variance<'a, 'b, 'c, T, U: 'a> {
    x: &'a U,               // This makes `Variance` covariant in 'a, and would
                            // make it covariant in U, but U is used later
    y: *const T,            // Covariant in T
    z: UnsafeCell<&'b f64>, // Invariant in 'b
    w: *mut U,              // Invariant in U, makes the whole struct invariant

    f: fn(&'c ()) -> &'c () // Both co- and contravariant, makes 'c invariant
                            // in the struct.
}
```

<a id="subtyping.variance.builtin-composite-types"></a> 当在 `struct`、`enum` 或 `union` 之外使用时，参数的变体会在每个位置分别被检查。

```rust
# use std::cell::UnsafeCell;
fn generic_tuple<'short, 'long: 'short>(
    // 'long is used inside of a tuple in both a co- and invariant position.
    x: (&'long u32, UnsafeCell<&'long u32>),
) {
    // As the variance at these positions is computed separately,
    // we can freely shrink 'long in the covariant position.
    let _: (&'short u32, UnsafeCell<&'long u32>) = x;
}

fn takes_fn_ptr<'short, 'middle: 'short>(
    // 'middle is used in both a co- and contravariant position.
    f: fn(&'middle ()) -> &'middle (),
) {
    // As the variance at these positions is computed separately,
    // we can freely shrink 'middle in the covariant position
    // and extend it in the contravariant position.
    let _: fn(&'static ()) -> &'short () = f;
}
```

[function pointers]: types/function-pointer.md
[Higher-ranked]: ../nomicon/hrtb.html
[trait objects]: types/trait-object.md
