<a id="type.闭包"></a>
# 闭包类型

<a id="type.闭包.intro"></a> 一个 [闭包表达式] 会生成一个具有独特、匿名类型的闭包值，无法被写出来。闭包类型大致相当于包含捕获值的结构体。例如，以下闭包：

```rust
#[derive(Debug)]
struct Point { x: i32, y: i32 }
struct Rectangle { left_top: Point, right_bottom: Point }

fn f<F : FnOnce() -> String> (g: F) {
    println!("{}", g());
}

let mut rect = Rectangle {
    left_top: Point { x: 1, y: 1 },
    right_bottom: Point { x: 0, y: 0 }
};

let c = || {
    rect.left_top.x += 1;
    rect.right_bottom.x += 1;
    format!("{:?}", rect.left_top)
};
f(c); // Prints "Point { x: 2, y: 1 }".
```

会生成类似以下的闭包类型：

<!-- ignore: simplified -->
```rust,ignore
// Note: This is not exactly how it is translated, this is only for
// illustration.

struct Closure<'a> {
    left_top : &'a mut Point,
    right_bottom_x : &'a mut i32,
}

impl<'a> FnOnce<()> for Closure<'a> {
    type Output = String;
    extern "rust-call" fn call_once(self, args: ()) -> String {
        self.left_top.x += 1;
        *self.right_bottom_x += 1;
        format!("{:?}", self.left_top)
    }
}
```

这样调用 `f` 就会像如下一样工作：

<!-- ignore: continuation of above -->
```rust,ignore
f(Closure{ left_top: &mut rect.left_top, right_bottom_x: &mut rect.right_bottom.x });
```

<a id="type.闭包.capture"></a>
## 捕获模式

<a id="type.闭包.capture.intro"></a> *捕获模式* 决定了来自环境的 [位置表达式] 如何被借用或移动到闭包中。捕获模式包括：

1. 不可变借用 (`ImmBorrow`) --- 位置表达式作为 [共享引用] 被捕获。 2. 唯一不可变借用 (`UniqueImmBorrow`) --- 这与不可变借用类似，但必须是唯一的，如 [下文](#unique-immutable-borrows-in-captures) 所述。 3. 可变借用 (`MutBorrow`) --- 位置表达式作为 [可变引用] 被捕获。 4. 移动 (`ByValue`) --- 位置表达式通过 [移动值] 被移动到闭包中。

<a id="type.闭包.capture.precedence"></a> 来自环境的位置表达式从与闭包体内使用捕获值方式兼容的第一种模式中被捕获。该模式不受闭包周围的代码影响，例如涉及变量或字段的生命周期，或闭包本身的生命周期。


<a id="type.闭包.capture.copy"></a>
### `Copy` 值

实现 [`Copy`]并被移动到闭包中的值会以 `ImmBorrow` 模式被捕获。

```rust
let x = [0; 1024];
let c = || {
    let y = x; // x captured by ImmBorrow
};
```

<a id="type.闭包.异步.input"></a>
### 异步输入捕获

异步闭包总是捕获所有输入参数，无论它们在体内是否被使用。

## 捕获精度

<a id="type.闭包.capture.precision.capture-path"></a> *捕获路径* 是一个序列，以环境中的变量开始，随后是该变量产生的零个或多个位置投影。

<a id="type.闭包.capture.precision.place-projection"></a> *位置投影* 是指应用于变量的 [字段访问]、[元组索引]、[解引用](及自动解引用)、[数组或切片索引]表达式或[模式解构]。

> [!NOTE]
> In `rustc`, pattern destructuring desugars into a series of dereferences and field or element accesses.

<a id="type.闭包.capture.precision.intro"></a> 闭包会借用或移动捕获路径，该路径可能会根据以下规则被截断。

例如：

```rust
struct SomeStruct {
    f1: (i32, i32),
}
let s = SomeStruct { f1: (1, 2) };

let c = || {
    let x = s.f1.1; // s.f1.1 captured by ImmBorrow
};
c();
```

这里捕获路径是局部变量 `s`，随后是字段访问 `.f1`，再然后是元组索引 `.1`。这个闭包捕获了 `s.f1.1` 的不可变借用。


<a id="type.闭包.capture.precision.shared-prefix"></a>
### 共享前缀

当捕获路径及其祖先路径都被闭包捕获时，祖先路径将以两种捕获中最高的捕获模式被捕获，`CaptureMode = max(AncestorCaptureMode, DescendantCaptureMode)`，使用严格的弱排序规则：

`ImmBorrow < UniqueImmBorrow < MutBorrow < ByValue`

请注意，这可能需要递归应用。

```rust
// In this example, there are three different capture paths with a shared ancestor:
# fn move_value<T>(_: T){}
let s = String::from("S");
let t = (s, String::from("T"));
let mut u = (t, String::from("U"));

let c = || {
    println!("{:?}", u); // u captured by ImmBorrow
    u.1.truncate(0); // u.1 captured by MutBorrow
    move_value(u.0.0); // u.0.0 captured by ByValue
};
c();
```

总体而言，这个闭包将通过 `ByValue` 捕获 `u`。

<a id="type.闭包.capture.precision.dereference-shared"></a>
### 最右侧共享引用截断

如果捕获路径中的解引用应用于共享引用，则捕获路径在最右侧的解引用处被截断。

这种截断是允许的，因为通过共享引用读取的字段总是通过共享引用或副本来读取。这有助于在额外的精度无法从借用检查的角度带来任何好处时减少捕获的大小。

之所以选择*最右侧*的引用方式，是为了避免生命周期比必要时长短。请参考以下示例：

```rust
struct Int(i32);
struct B<'a>(&'a i32);

struct MyStruct<'a> {
   a: &'static Int,
   b: B<'a>,
}

fn foo<'a, 'b>(m: &'a MyStruct<'b>) -> impl FnMut() + 'static {
    let c = || drop(&m.a.0);
    c
}
```

如果它捕获了 `m`，那么闭包将不再持续存在于 `'static` 范围内，因为 `m` 被限制为 `'a'`。相反，它通过 `ImmBorrow` 捕获了 `(*(*m).a)`。

<a id="type.闭包.capture.precision.wildcard"></a>
### 通配符模式绑定

<a id="type.闭包.capture.precision.wildcard.reads"></a> 闭包仅能捕获需要读取的数据。使用[通配符模式]绑定一个值并不会读取该值，因此该位置不会被捕获。

```rust,no_run
struct S; // A non-`Copy` type.
let x = S;
let c = || {
    let _ = x;  // Does not capture `x`.
};
let c = || match x {
    _ => (), // Does not capture `x`.
};
x; // OK: `x` can be moved here.
c();
```

<a id="type.闭包.capture.precision.wildcard.destructuring"></a> 对元组、结构体和单变体枚举进行解构时，本身不会导致读取或捕获某个位置。

> [!NOTE]
> Enums marked with [`#[non_exhaustive]`][attributes.type-system.non_exhaustive] are always treated as having multiple variants. See *[type.closure.capture.precision.discriminants.non_exhaustive]*.

```rust,no_run
struct S; // A non-`Copy` type.

// Destructuring tuples does not cause a read or capture.
let x = (S,);
let c = || {
    let (..) = x; // Does not capture `x`.
};
x; // OK: `x` can be moved here.
c();

// Destructuring unit structs does not cause a read or capture.
let x = S;
let c = || {
    let S = x; // Does not capture `x`.
};
x; // OK: `x` can be moved here.
c();

// Destructuring structs does not cause a read or capture.
struct W<T>(T);
let x = W(S);
let c = || {
    let W(..) = x; // Does not capture `x`.
};
x; // OK: `x` can be moved here.
c();

// Destructuring single-variant enums does not cause a read
// or capture.
enum E<T> { V(T) }
let x = E::V(S);
let c = || {
    let E::V(..) = x; // Does not capture `x`.
};
x; // OK: `x` can be moved here.
c();
```

<a id="type.闭包.capture.precision.wildcard.fields"></a> 与[RestPattern]（`..`）或[StructPatternEtCetera]（同样为 `..`）匹配的字段不会被读取，也不会被捕获。

```rust,no_run
struct S; // A non-`Copy` type.
let x = (S, S);
let c = || {
    let (x0, ..) = x;  // Captures `x.0` by `ByValue`.
};
// Only the first tuple field was captured by the closure.
x.1; // OK: `x.1` can be moved here.
c();
```

<a id="type.闭包.capture.precision.wildcard.array-slice"></a> 不支持对数组和切片的部分捕获；即使使用通配符模式匹配、索引或子切片操作，也总是会捕获整个切片或数组。

```rust,compile_fail,E0382
struct S; // A non-`Copy` type.
let mut x = [S, S];
let c = || {
    let [x0, _] = x; // Captures all of `x` by `ByValue`.
};
let _ = &mut x[1]; // ERROR: Borrow of moved value.
```

<a id="type.闭包.capture.precision.wildcard.initialized"></a> 与通配符匹配的值仍然必须被初始化。

```rust,compile_fail,E0381
let x: u8;
let c = || {
    let _ = x; // ERROR: Binding `x` isn't initialized.
};
```


<a id="type.闭包.capture.precision.discriminants"></a>
### 用于判别器的捕获

<a id="type.闭包.capture.precision.discriminants.reads"></a> 如果模式匹配读取一个判别式，包含该判别器的位置会被 `ImmBorrow` 捕获。

<a id="type.闭包.capture.precision.discriminants.multiple-variant"></a> 针对具有多个变体的枚举变体进行匹配时读取判别式，并通过 `ImmBorrow` 捕获该位置。

```rust,compile_fail,E0502
struct S; // A non-`Copy` type.
let mut x = (Some(S), S);
let c = || match x {
    (None, _) => (),
//   ^^^^
// This pattern requires reading the discriminant, which
// causes `x.0` to be captured by `ImmBorrow`.
    _ => (),
};
let _ = &mut x.0; // ERROR: Cannot borrow `x.0` as mutable.
//           ^^^
// The closure is still live, so `x.0` is still immutably
// borrowed here.
c();
```

```rust,no_run
# struct S; // A non-`Copy` type.
# let x = (Some(S), S);
let c = || match x { // Captures `x.0` by `ImmBorrow`.
    (None, _) => (),
    _ => (),
};
// Though `x.0` is captured due to the discriminant read,
// `x.1` is not captured.
x.1; // OK: `x.1` can be moved here.
c();
```

<a id="type.闭包.capture.precision.discriminants.single-variant"></a> 对单变体枚举的唯一变体进行匹配时不会读取判别式，也不会捕获该位置。

```rust,no_run
enum E<T> { V(T) } // A single-variant enum.
let x = E::V(());
let c = || {
    let E::V(_) = x; // Does not capture `x`.
};
x; // OK: `x` can be moved here.
c();
```

<a id="type.闭包.capture.precision.discriminants.non_exhaustive"></a> 如果给一个枚举应用 [`#[non_exhaustive]`][attributes.type-system.non_exhaustive]，则在确定读取是否发生时，该枚举被视为具有多个变体，即使实际上只有一种变体。

<a id="type.闭包.capture.precision.discriminants.uninhabited-variants"></a> 即使所有与匹配相关的变体均不存在，使得模式变得[不可确定][patterns.refutable]，仍然会读取判别式，否则则不会读取。

```rust,compile_fail,E0502
let mut x = Ok::<_, !>(42);
let c = || {
    let Ok(_) = x; // Captures `x` by `ImmBorrow`.
};
let _ = &mut x; // ERROR: Cannot borrow `x` as mutable.
c();
```


<a id="type.闭包.capture.precision.range-patterns"></a>
### 捕获和范围模式

<a id="type.闭包.capture.precision.range-patterns.reads"></a> 与[范围模式][patterns.range]匹配时，即使范围包含该类型的所有可能值，也会读取被匹配的位置，并通过 `ImmBorrow` 捕获该位置。

```rust,compile_fail,E0502
let mut x = 0u8;
let c = || {
    let 0..=u8::MAX = x; // Captures `x` by `ImmBorrow`.
};
let _ = &mut x; // ERROR: Cannot borrow `x` as mutable.
c();
```

<a id="type.闭包.capture.precision.slice-patterns"></a>
### 捕获和切片模式

<a id="type.闭包.capture.precision.slice-patterns.slices"></a> 与[切片模式][patterns.slice]匹配时，除了仅包含单个[剩余模式][patterns.rest]（即 `[..]`）的情况外，均视为从切片中读取长度，并通过 `ImmBorrow` 捕获切片。

```rust,compile_fail,E0502
let x: &mut [u8] = &mut [];
let c = || match x { // Captures `*x` by `ImmBorrow`.
    &mut [] => (),
//       ^^
// This matches a slice of exactly zero elements. To know whether the
// scrutinee matches, the length must be read, causing the slice to
// be captured.
    _ => (),
};
let _ = &mut *x; // ERROR: Cannot borrow `*x` as mutable.
c();
```

```rust,no_run
let x: &mut [u8] = &mut [];
let c = || match x { // Does not capture `*x`.
    [..] => (),
//   ^^ Rest pattern.
};
let _ = &mut *x; // OK
c();
```

> [!NOTE]
> Perhaps surprisingly, even though the length is contained in the (wide) *pointer* to the slice, it is the place of the *pointee* (the slice) that is treated as read and is captured.
>
> ```rust,no_run
> fn f<'l: 's, 's>(x: &'s mut &'l [u8]) -> impl Fn() + 'l {
>     // The closure outlives `'l` because it captures `**x`. If
>     // instead it captured `*x`, it would not live long enough
>     // to satisfy the `impl Fn() + 'l` bound.
>     || match *x { // Captures `**x` by `ImmBorrow`.
>         &[] => (),
>         _ => (),
>     }
> }
> ```
>
> In this way, the behavior is consistent with dereferencing to the slice in the scrutinee.
>
> ```rust,no_run
> fn f<'l: 's, 's>(x: &'s mut &'l [u8]) -> impl Fn() + 'l {
>     || match **x { // Captures `**x` by `ImmBorrow`.
>         [] => (),
>         _ => (),
>     }
> }
> ```
>
> For details, see [Rust PR #138961](https://github.com/rust-lang/rust/pull/138961).

<a id="type.闭包.capture.precision.slice-patterns.arrays"></a> 由于数组的长度由其类型决定，因此将数组与切片模式匹配并不自动捕获位置。

```rust,no_run
let x: [u8; 1] = [0];
let c = || match x { // Does not capture `x`.
    [_] => (), // Length is fixed.
};
x; // OK: `x` can be moved here.
c();
```

<a id="type.闭包.capture.precision.move-dereference"></a>
### 在移动上下文中捕获引用

由于不允许从引用中移动字段，`move` 闭包仅会捕获捕获路径的前缀，该前缀运行到引用的第一个解引用之前但不包括该点。引用本身会被移动到闭包中。

```rust
struct T(String, String);

let mut t = T(String::from("foo"), String::from("bar"));
let t_mut_ref = &mut t;
let mut c = move || {
    t_mut_ref.0.push_str("123"); // captures `t_mut_ref` ByValue
};
c();
```

<a id="type.闭包.capture.precision.raw-pointer-dereference"></a>
### 原始指针解引用

由于解引用原始指针是[不安全的]，因此闭包仅会捕获捕获路径的前缀，该前缀运行到原始指针的第一个解引用之前但不包括该点。

```rust
struct T(String, String);

let t = T(String::from("foo"), String::from("bar"));
let t_ptr = &t as *const T;

let c = || unsafe {
    println!("{}", (*t_ptr).0); // captures `t_ptr` by ImmBorrow
};
c();
```

<a id="type.闭包.capture.precision.union"></a>
### 联合字段

因为访问联合字段是 `unsafe` 的，所以闭包只会捕获捕获路径中直到该联合本身的前缀部分。

```rust
union U {
    a: (i32, i32),
    b: bool,
}
let u = U { a: (123, 456) };

let c = || {
    let x = unsafe { u.a.0 }; // captures `u` ByValue
};
c();

// This also includes writing to fields.
let mut u = U { a: (123, 456) };

let mut c = || {
    u.b = true; // captures `u` with MutBorrow
};
c();
```

<a id="type.闭包.capture.precision.unaligned"></a>
### 对未对齐 `struct` 的引用

由于对结构中的未对齐字段创建引用属于 [未定义行为]，所以闭包只会捕获捕获路径中直到第一个字段访问之前但不包括该点的前缀部分，适用于使用 [`packed` 表示法] 的结构。这包括所有字段，即使是已对齐的字段，以防止未来结构中的任何字段发生变化时出现兼容性问题。

```rust
#[repr(packed)]
struct T(i32, i32);

let t = T(2, 5);
let c = || {
    let a = t.0; // captures `t` with ImmBorrow
};
// Copies out of `t` are ok.
let (a, b) = (t.0, t.1);
c();
```

同样，获取未对齐字段的地址也会捕获整个结构体：

```rust,compile_fail,E0505
#[repr(packed)]
struct T(String, String);

let mut t = T(String::new(), String::new());
let c = || {
    let a = std::ptr::addr_of!(t.1); // captures `t` with ImmBorrow
};
let a = t.0; // ERROR: cannot move out of `t.0` because it is borrowed
c();
```

但如果不是打包形式，上述方法即可生效，因为它能精确捕获该字段：

```rust
struct T(String, String);

let mut t = T(String::new(), String::new());
let c = || {
    let a = std::ptr::addr_of!(t.1); // captures `t.1` with ImmBorrow
};
// The move here is allowed.
let a = t.0;
c();
```


<a id="type.闭包.capture.precision.box-deref"></a>
### `Box` 与其他 `Deref` 实现的区别

对于 [`Box`]的 [`Deref`] trait 实现，与其他 `Deref` 实现不同，因为它被视为一个特殊实体。

例如，让我们看看涉及 `Rc` 和 `Box` 的例子。*`rc` 会被解析为对 `Rc` 上定义的 `deref` trait 方法的调用，但由于 `*box` 的处理方式不同，因此可以精确捕获 `Box` 的内容。


<a id="type.闭包.capture.precision.box-non-move.not-moved"></a>
#### 带有非 `move` 闭包的 `Box`

在非 `move` 闭包中，如果 `Box` 的内容没有被移动到闭包体内，那么 `Box` 的内容就会被精确捕获。

```rust
struct S(String);

let b = Box::new(S(String::new()));
let c_box = || {
    let x = &(*b).0; // captures `(*b).0` by ImmBorrow
};
c_box();

// Contrast `Box` with another type that implements Deref:
let r = std::rc::Rc::new(S(String::new()));
let c_rc = || {
    let x = &(*r).0; // captures `r` by ImmBorrow
};
c_rc();
```

<a id="type.闭包.capture.precision.box-non-move.moved"></a> 然而，如果 `Box` 的内容被移动到了闭包中，则整个 `Box` 会被捕获。这样做是为了将需要移动到闭包中的数据量降到最低。

```rust
// This is the same as the example above except the closure
// moves the value instead of taking a reference to it.

struct S(String);

let b = Box::new(S(String::new()));
let c_box = || {
    let x = (*b).0; // captures `b` with ByValue
};
c_box();
```

<a id="type.闭包.capture.precision.box-move.read"></a>
#### 带有 `move` 闭包的 `Box`

与在非`move`闭包中移动`Box`的内容类似，在`move`闭包中读取`Box`的内容会完全捕获该`Box`。

```rust
struct S(i32);

let b = Box::new(S(10));
let c_box = move || {
    let x = (*b).0; // captures `b` with ByValue
};
```

<a id="type.闭包.unique-immutable"></a>
## 被捕获的唯一不可变借用

被捕获可以通过一种特殊的借用方式——_唯一不可变借用_——来实现，这种借用在语言的其他地方无法使用，也无法显式写出。当修改可变的引用指向的对象时，就会出现这种情况，如下例所示：

```rust
let mut b = false;
let x = &mut b;
let mut c = || {
    // An ImmBorrow and a MutBorrow of `x`.
    let a = &x;
    *x = true; // `x` captured by UniqueImmBorrow
};
// The following line is an error:
// let y = &x;
c();
// However, the following is OK.
let z = &x;
```

在这种情况下，不可变地借用`x`是不可能的，因为`x`不是`mut`。但与此同时，不可变地借用`x`会使赋值操作非法，因为`& &mut`引用可能不唯一，因此不能安全地用于修改值。所以使用唯一不可变借用：它不可变地借用`x`，但像可变借用一样，必须是唯一的。

在上述示例中，取消注释`y`的声明会产生错误，因为它违反了闭包对`x`的借用唯一性；`z`的声明是有效的，因为闭包的生命周期在块结束时已终止，从而释放了借用。

<a id="type.闭包.call"></a>
## 调用特质和强制转换

<a id="type.闭包.call.intro"></a> 闭包类型都实现了 [`FnOnce`]，表明它们可以通过消耗闭包的所有权来被调用一次。此外，一些闭包还实现了更具体的调用特质：

<a id="type.闭包.call.fn-mut"></a> * 一个不移动任何被捕获变量的闭包实现 [`FnMut`]，表明它可以通过可变引用被调用。

<a id="type.闭包.call.fn"></a> * 一个不修改或移动任何被捕获变量的闭包实现 [`Fn`]，表明它可以通过共享引用被调用。

> [!NOTE]
> `move` closures may still implement [`Fn`] or [`FnMut`], even though they capture variables by move. This is because the traits implemented by a closure type are determined by what the closure does with captured values, not how it captures them.

<a id="type.闭包.non-capturing"></a> *非捕获闭包*是那些不从环境捕获任何内容的闭包。非异步、非捕获闭包可以转换为具有匹配签名的函数指针（例如 `fn()`）。

```rust
let add = |x, y| x + y;

let mut x = add(5,7);

type Binop = fn(i32, i32) -> i32;
let bo: Binop = add;
x = bo(5,7);
```

<a id="type.闭包.异步.traits"></a>
### 异步闭包特质

<a id="type.闭包.异步.traits.fn-family"></a> 异步闭包还有进一步的限制，即它们是否实现了 [`FnMut`]或 [`Fn`]。

异步闭包返回的 [`Future`]具有与闭包类似的捕获特性。根据使用方式的不同，它从异步闭包中捕获位置表达式。如果异步闭包具有以下任一属性，则可以说它在向其 [`Future`]“借出”了什么：

- `Future` 包含可变的捕获值。 - 异步闭包按值进行捕获，除非该值通过去引用投影访问。

如果异步闭包在向其 `Future` 中“借出”了东西，则 [`FnMut`]和 [`Fn`]不会被实现。而 [`FnOnce`]总是会被实现。

> **Example**: The first clause for a mutable capture can be illustrated with the following:
>
> ```rust,compile_fail
> fn takes_callback<Fut: Future>(c: impl FnMut() -> Fut) {}
>
> fn f() {
>     let mut x = 1i32;
>     let c = async || {
>         x = 2;  // x captured with MutBorrow
>     };
>     takes_callback(c);  // ERROR: async closure does not implement `FnMut`
> }
> ```
>
> The second clause for a regular value capture can be illustrated with the following:
>
> ```rust,compile_fail
> fn takes_callback<Fut: Future>(c: impl Fn() -> Fut) {}
>
> fn f() {
>     let x = &1i32;
>     let c = async move || {
>         let a = x + 2;  // x captured ByValue
>     };
>     takes_callback(c);  // ERROR: async closure does not implement `Fn`
> }
> ```
>
> The exception of the the second clause can be illustrated by using a dereference, which does allow `Fn` and `FnMut` to be implemented:
>
> ```rust
> fn takes_callback<Fut: Future>(c: impl Fn() -> Fut) {}
>
> fn f() {
>     let x = &1i32;
>     let c = async move || {
>         let a = *x + 2;
>     };
>     takes_callback(c);  // OK: implements `Fn`
> }
> ```

<a id="type.闭包.异步.traits.异步-family"></a> 异步闭包以与常规闭包实现 [`Fn`}、[`FnMut`]和 [`FnOnce`]类似的方式实现 [`AsyncFn`}、[`AsyncFnMut`]和 [`AsyncFnOnce`]；也就是说，取决于其主体中捕获变量的使用方式。

<a id="type.闭包.traits"></a>
### 其他特性

<a id="type.闭包.traits.intro"></a> 所有闭包类型都实现了 [`Sized]`。此外，如果允许的话，闭包类型还会实现以下特性，具体取决于其存储的捕获类型的限制：

* [`Clone`] * [`Copy`] * [`Sync`] * [`Send`]

<a id="type.闭包.traits.behavior"></a> [`Send`]和 [`Sync`]的规则与常规结构体类型相同，而 [`Clone`]和 [`Copy`]的行为则类似于[派生类型]。对于 [`Clone`]，捕获值的克隆顺序未指定。

由于捕获值通常是引用形式，因此产生以下一般规则：

* 如果所有捕获值都是 [`Sync`]，则该闭包是 [`Sync`]。 * 如果非唯一不可变引用捕获的所有值都是 [`Sync`]，而唯一不可变或可变引用、复制或移动捕获的所有值都是 [`Send`]，则该闭包是 [`Send`]。 * 如果该闭包没有通过唯一不可变或可变引用捕获任何值，并且其通过复制或移动捕获的所有值分别是 [`Clone`]或 [`Copy`]，则该闭包是 [`Clone`]或 [`Copy`]。


<a id="type.闭包.drop-order"></a>
## 丢弃顺序

如果闭包按值捕获复合类型（如结构体、元组和枚举）的字段，该字段的生命周期将与闭包绑定。因此，复合类型的独立字段可能在不同的时间被丢弃。

```rust
{
    let tuple =
      (String::from("foo"), String::from("bar")); // --+
    { //                                               |
        let c = || { // ----------------------------+  |
            // tuple.0 is captured into the closure |  |
            drop(tuple.0); //                       |  |
        }; //                                       |  |
    } // 'c' and 'tuple.0' dropped here ------------+  |
} // tuple.1 dropped here -----------------------------+
```

<a id="type.闭包.capture.precision.edition2018.entirety"></a>
## 2018版及更早版本

### 闭包类型差异

在2018版及更早版本中，闭包总是完整捕获变量，而不显示具体的捕获路径。这意味着在[闭包类型](#闭包-types)部分使用的示例中，生成的闭包类型将如下所示：

<!-- ignore: simplified -->
```rust,ignore
struct Closure<'a> {
    rect : &'a mut Rectangle,
}

impl<'a> FnOnce<()> for Closure<'a> {
    type Output = String;
    extern "rust-call" fn call_once(self, args: ()) -> String {
        self.rect.left_top.x += 1;
        self.rect.right_bottom.x += 1;
        format!("{:?}", self.rect.left_top)
    }
}
```

对 `f` 的调用将按以下方式工作：

<!-- ignore: continuation of above -->
```rust,ignore
f(Closure { rect: rect });
```

<a id="type.闭包.capture.precision.edition2018.composite"></a>
### 捕获精度差异

如结构体、元组和枚举这样的复合类型总是被完整捕获，而不是单独字段。因此，为了捕获单个字段，可能需要借用到局部变量中：

```rust
# use std::collections::HashSet;
#
struct SetVec {
    set: HashSet<u32>,
    vec: Vec<u32>
}

impl SetVec {
    fn populate(&mut self) {
        let vec = &mut self.vec;
        self.set.iter().for_each(|&n| {
            vec.push(n);
        })
    }
}
```

如果闭包直接使用 `self.vec`，则它会尝试通过可变引用来捕获 `self`。但由于 `self.set` 已经被借用来进行迭代，代码将无法编译。

<a id="type.闭包.capture.precision.edition2018.move"></a> 如果使用 `move` 关键字，则所有捕获都通过移动方式完成，对于 `Copy` 类型则通过复制方式完成，无论借用是否可行。`move` 关键字通常用于使闭包在捕获的值之后仍然有效，例如当闭包被返回或用于创建新线程时。

<a id="type.闭包.capture.precision.edition2018.wildcard"></a> 无论数据是否由闭包读取，即在通配符模式的情况下，如果闭包内部提到了闭包外部定义的变量，该变量将被完整捕获。

<a id="type.闭包.capture.precision.edition2018.drop-order"></a>
### 捕获顺序差异

由于复合类型被完整捕获，一个按值捕获这些复合类型之一的闭包在闭包被丢弃时，也会同时丢弃整个被捕获的变量。

```rust
{
    let tuple =
      (String::from("foo"), String::from("bar"));
    {
        let c = || { // --------------------------+
            // tuple is captured into the closure |
            drop(tuple.0); //                     |
        }; //                                     |
    } // 'c' and 'tuple' dropped here ------------+
}
```

[pattern destructuring]: patterns.destructure

[moving the value]: ../expressions.md#moved-and-copied-types
[mutable reference]: pointer.md#mutable-references-mut
[place expression]: ../expressions.md#place-expressions-and-value-expressions
[shared reference]: pointer.md#references--and-mut
[field access]: ../expressions/field-expr.md
[tuple index]: ../expressions/tuple-expr.md#tuple-indexing-expressions
[dereference]: ../expressions/operator-expr.md#the-dereference-operator
[array or slice index]: ../expressions/array-expr.md#array-and-slice-indexing-expressions
[wildcard pattern]: ../patterns.md#wildcard-pattern
[undefined behavior]: ../behavior-considered-undefined.md
[the `packed` representation]: ../type-layout.md#the-alignment-modifiers
[`Box`]: ../special-types-and-traits.md#boxt
[`Deref`]: ../special-types-and-traits.md#deref-and-derefmut
[`Clone`]: ../special-types-and-traits.md#clone
[`Copy`]: ../special-types-and-traits.md#copy
[`Send`]: ../special-types-and-traits.md#send
[`Sized`]: ../special-types-and-traits.md#sized
[`Sync`]: ../special-types-and-traits.md#sync
[closure expression]: ../expressions/closure-expr.md
[derived]: ../attributes/derive.md
