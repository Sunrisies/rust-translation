<a id="const-eval"></a>
# 常量求值

<a id="const-eval.intro"></a> 常量求值是在编译过程中计算[表达式]结果的过程。只有部分表达式可以在编译时求值。

<a id="const-eval.const-expr"></a>
## 常量表达式

<a id="const-eval.const-expr.intro"></a> 某些形式的表达式被称为常量表达式，可以在编译时求值。

<a id="const-eval.const-expr.const-context"></a> [常量上下文]中的表达式必须是常量表达式。

<a id="const-eval.const-expr.evaluation"></a> [常量上下文]中的表达式总是在编译时求值。

<a id="const-eval.const-expr.runtime-context"></a> 在常量上下文之外，常量表达式*可能*在编译时求值，但无法保证一定在编译时求值。

<a id="const-eval.const-expr.error"></a> 如果值必须在编译时（即处于常量上下文）求值，则诸如超出边界的[数组索引]或[溢出]等行为属于编译器错误。否则，这些行为会引发警告，但在运行时可能会导致程序崩溃。

<a id="const-eval.const-expr.list"></a> 以下表达式都是常量表达式，只要其操作数也是常量表达式且不会触发任何 [`Drop::drop`][destructors]调用即可。

<a id="const-eval.const-expr.literal"></a> * [字面量]。

<a id="const-eval.const-expr.parameter"></a> * [常量参数]。

<a id="const-eval.const-expr.path-item"></a> * [函数]和[常量]的[路径]。不允许递归定义常量。

<a id="const-eval.const-expr.path-static"></a> * 带有以下限制的[静态函数]路径：* 在任何常量求值上下文中，对`static`项进行写入是不允许的。* 在任何常量求值上下文中，从`extern`静态函数中读取也是不允许的。* 如果求值没有在`static`项的初始化器中执行，那么从任何可变的`static`中读取也是不允许的。可变的`static`是指`static mut`项或具有内部可变类型的`static`项。

  这些要求仅在常量被求值时进行检查。换句话说，只要这些访问在语法上出现在常量上下文中但从未实际执行，就是允许的。

<a id="const-eval.const-expr.tuple"></a> * [元组表达式]。

<a id="const-eval.const-expr.array"></a> * [数组表达式]。

<a id="const-eval.const-expr.constructor"></a> * [结构体表达式]。

<a id="const-eval.const-expr.block"></a> * [块表达式]，包括 `unsafe` 和 `const` 块。* [let 语句] 以及不可辩驳的 [模式]，包括可变绑定 * [赋值表达式] * [复合赋值表达式] * [表达式语句]。

<a id="const-eval.const-expr.field"></a> * [字段表达式]。

<a id="const-eval.const-expr.index"></a> * [数组和切片索引表达式][array indexing]，其中索引为 `usize` 类型。

<a id="const-eval.const-expr.range"></a> * [范围表达式]。

<a id="const-eval.const-expr.闭包"></a> * [闭包表达式]，不会捕获环境中的变量。

<a id="const-eval.const-expr.builtin-arith-logic"></a> * 用于整数和浮点类型、`bool` 以及 `char` 上的内置 [否定]、[算术]、[逻辑]、[比较] 或 [惰性布尔] 运算符。

<a id="const-eval.const-expr.borrows"></a> * 所有形式的 [borrow] 操作，包括原始 borrow 操作，但以下类型的 borrow 除外：* 可变的 borrow 操作。* 导致具有 [内部可变性] 值的表达式的共享 borrow 操作。

  ```rust,compile_fail,E0764
  // Due to being in tail position, this borrow extends the scope of the
  // temporary to the end of the program. Since the borrow is mutable,
  // this is not allowed in a const expression.
  const C: &u8 = &mut 0; // ERROR not allowed
  ```

  ```rust,compile_fail,E0764
  // Const blocks are similar to initializers of `const` items.
  let _: &u8 = const { &mut 0 }; // ERROR not allowed
  ```

  ```rust,compile_fail,E0492
  # use core::sync::atomic::AtomicU8;
  // This is not allowed as 1) the temporary scope is extended to the
  // end of the program and 2) the temporary has interior mutability.
  const C: &AtomicU8 = &AtomicU8::new(0); // ERROR not allowed
  ```

  ```rust,compile_fail,E0492
  # use core::sync::atomic::AtomicU8;
  // As above.
  let _: &_ = const { &AtomicU8::new(0) }; // ERROR not allowed
  ```

  ```rust
  # #![allow(static_mut_refs)]
  // Even though this borrow is mutable, it's not of a temporary, so
  // this is allowed.
  const C: &u8 = unsafe { static mut S: u8 = 0; &mut S }; // OK
  ```

  ```rust
  # use core::sync::atomic::AtomicU8;
  // Even though this borrow is of a value with interior mutability,
  // it's not of a temporary, so this is allowed.
  const C: &AtomicU8 = {
      static S: AtomicU8 = AtomicU8::new(0); &S // OK
  };
  ```

  ```rust
  # use core::sync::atomic::AtomicU8;
  // This shared borrow of an interior mutable temporary is allowed
  // because its scope is not extended.
  const C: () = { _ = &AtomicU8::new(0); }; // OK
  ```

  ```rust
  // Even though the borrow is mutable and the temporary lives to the
  // end of the program due to promotion, this is allowed because the
  // borrow is not in tail position and so the scope of the temporary
  // is not extended via temporary lifetime extension.
  const C: () = { let _: &'static mut [u8] = &mut []; }; // OK
  //                                              ~~
  //                                     Promoted temporary.
  ```

  > [!NOTE]
  > In other words --- to focus on what's allowed rather than what's not allowed --- shared borrows of interior mutable data and mutable borrows are only allowed in a [const context] when the borrowed [place expression] is *transient*, *indirect*, or *static*.
  >
  > A place expression is *transient* if it is a variable local to the current const context or an expression whose temporary scope is contained inside the current const context.
  >
  > ```rust
  > // The borrow is of a variable local to the initializer, therefore
  > // this place expression is transient.
  > const C: () = { let mut x = 0; _ = &mut x; };
  > ```
  >
  > ```rust
  > // The borrow is of a temporary whose scope has not been extended,
  > // therefore this place expression is transient.
  > const C: () = { _ = &mut 0u8; };
  > ```
  >
  > ```rust
  > // When a temporary is promoted but not lifetime extended, its
  > // place expression is still treated as transient.
  > const C: () = { let _: &'static mut [u8] = &mut []; };
  > ```
  >
  > A place expression is *indirect* if it is a [dereference expression].
  >
  > ```rust
  > const C: () = { _ = &mut *(&mut 0); };
  > ```
  >
  > A place expression is *static* if it is a `static` item.
  >
  > ```rust
  > # #![allow(static_mut_refs)]
  > const C: &u8 = unsafe { static mut S: u8 = 0; &mut S };
  > ```

  > [!NOTE]
  > One surprising consequence of these rules is that we allow this,
  >
  > ```rust
  > const C: &[u8] = { let x: &mut [u8] = &mut []; x }; // OK
  > //                                    ~~~~~~~
  > // Empty arrays are promoted even behind mutable borrows.
  > ```
  >
  > but we disallow this similar code:
  >
  > ```rust,compile_fail,E0764
  > const C: &[u8] = &mut []; // ERROR
  > //               ~~~~~~~
  > //           Tail expression.
  > ```
  >
  > The difference between these is that, in the first, the empty array is [promoted] but its scope does not undergo [temporary lifetime extension], so we consider the [place expression] to be transient (even though after promotion the place indeed lives to the end of the program). In the second, the scope of the empty array temporary does undergo lifetime extension, and so it is rejected due to being a mutable borrow of a lifetime-extended temporary (and therefore borrowing a non-transient place expression).
  >
  > The effect is surprising because temporary lifetime extension, in this case, causes less code to compile than would without it.
  >
  > See [issue #143129](https://github.com/rust-lang/rust/issues/143129) for more details.

<a id="const-eval.const-expr.borrows"></a> * 所有形式的 [borrow] 操作，包括原始 borrow 操作，但以下类型的 borrow 除外：* 临时作用域会被延长至程序结束的表达式的 borrow 操作（参见 [临时生命周期扩展]）以及：* 可变的 borrow 操作。* 导致具有 [内部可变性] 值的表达式的共享 borrow 操作。

  ```rust,no_run
  # use core::cell::UnsafeCell;
  const _: u8 = unsafe {
      let x: *mut u8 = &raw mut *&mut 0;
      //                        ^^^^^^^
      //             Dereference of mutable reference.
      *x = 1; // Dereference of mutable pointer.
      *(x as *const u8) // Dereference of constant pointer.
  };
  const _: u8 = unsafe {
      let x = &UnsafeCell::new(0);
      *x.get() = 1; // Mutation of interior mutable value.
      *x.get()
  };
  ```

<a id="const-eval.const-expr.borrows"></a> * 所有形式的 [borrow] 操作，包括原始 borrow 操作，但以下类型的 borrow 除外：* 临时作用域会被延长至程序结束的表达式的 borrow 操作（参见 [临时生命周期扩展]）以及：* 可变的 borrow 操作。* 导致具有 [内部可变性] 值的表达式的共享 borrow 操作。

* [分组] 表达式。

<a id="const-eval.const-expr.cast"></a> * [类型转换] 表达式，但 * 指针到地址类型的转换和 * 函数指针到地址类型的转换除外。

<a id="const-eval.const-expr.const-fn"></a> * [const函数] 和 const方法的调用。

<a id="const-eval.const-expr.loop"></a> * [循环] 和 [while] 表达式。

<a id="const-eval.const-expr.if-match"></a> * [if] 和 [match] 表达式。

<a id="const-eval.const-context"></a>
## Const上下文 [const context]: #const-context

<a id="const-eval.const-context.def"></a> _const上下文_ 包括以下类型：

<a id="const-eval.const-context.array-length"></a> * [数组类型长度表达式]。

<a id="const-eval.const-context.repeat-length"></a> * [数组重复长度表达式][array expressions]

<a id="const-eval.const-context.init"></a> * *[常量]* [静态值]* [枚举区分符] 的初始化器

<a id="const-eval.const-context.泛型"></a> * 一个[常量泛型参数]

<a id="const-eval.const-context.block"></a> * 一个[常量块]

<a id="const-eval.const-context.outer-generics"></a> 数组类型长度表达式、数组重复长度表达式和常量泛型参数的使用受到外部泛型参数的限制：此类表达式必须是单个常量泛型参数，或者不是引用任何泛型参数的表达式。

<a id="const-eval.const-fn"></a>
## 常量函数

<a id="const-eval.const-fn.intro"></a> _常量函数_是指可以在常量上下文下调用的函数。它使用`const`限定符定义，并且包含[元组结构][元组枚举变体]构造函数。

> [!EXAMPLE]
> ```rust
> const fn square(x: i32) -> i32 { x * x }
>
> const VALUE: i32 = square(12);
> ```

<a id="const-eval.const-fn.const-context"></a> 当从常量上下文调用时，常量函数在编译时由编译器解释。这种解释发生在编译目标的环境中，而不是宿主环境中。因此，如果您在`32`位系统上编译，`usize`就是`32`位，与您是在`64`位还是`32`位系统上构建无关。

<a id="const-eval.const-fn.outside-context"></a> 当从常量上下文之外调用常量函数时，它的行为就像没有使用`const`限定符一样。

<a id="const-eval.const-fn.body-restriction"></a> 常量函数的主体只能使用[常量表达式]。

<a id="const-eval.const-fn.异步"></a> 常量函数不允许为[异步]。

<a id="const-eval.const-fn.type-restrictions"></a> 常量函数参数的类型和返回类型的类型被限制为与常量上下文兼容的类型。
<!-- TODO: Define the type restrictions. -->

[dereference expression]: expr.deref
[dereference expressions]: expr.deref
[place expression]:     expr.place-value.place-memory-location
[temporary lifetime extension]: destructors.scope.lifetime-extension

[const context]: #const-context
[arithmetic]:           expressions/operator-expr.md#arithmetic-and-logical-binary-operators
[array expressions]:    expressions/array-expr.md
[array indexing]:       expressions/array-expr.md#array-and-slice-indexing-expressions
[array type length expressions]: types/array.md
[assignment expressions]: expressions/operator-expr.md#assignment-expressions
[async]:                items/functions.md#async-functions
[compound assignment expressions]: expressions/operator-expr.md#compound-assignment-expressions
[block expressions]:    expressions/block-expr.md
[borrow]:               expressions/operator-expr.md#borrow-operators
[cast]:                 expressions/operator-expr.md#type-cast-expressions
[closure expressions]:  expressions/closure-expr.md
[comparison]:           expressions/operator-expr.md#comparison-operators
[const block]:          expressions/block-expr.md#const-blocks
[const functions]:      items/functions.md#const-functions
[const generic argument]: items/generics.md#const-generics
[const generic parameters]: items/generics.md#const-generics
[constant expressions]: #constant-expressions
[constants]:            items/constant-items.md
[Const parameters]:     items/generics.md
[destructors]:          destructors.md
[enum discriminants]:   items/enumerations.md#discriminants
[expression statements]: statements.md#expression-statements
[expressions]:          expressions.md
[`extern` statics]:     items/external-blocks.md#statics
[field expressions]:    expressions/field-expr.md
[functions]:            items/functions.md
[grouped]:              expressions/grouped-expr.md
[interior mutability]:  interior-mutability.md
[if]:                   expressions/if-expr.md#if-expressions
[lazy boolean]:         expressions/operator-expr.md#lazy-boolean-operators
[let statements]:       statements.md#let-statements
[literals]:             expressions/literal-expr.md
[logical]:              expressions/operator-expr.md#arithmetic-and-logical-binary-operators
[loop]:                 expressions/loop-expr.md#infinite-loops
[match]:                expressions/match-expr.md
[negation]:             expressions/operator-expr.md#negation-operators
[overflow]:             expressions/operator-expr.md#overflow
[paths]:                expressions/path-expr.md
[patterns]:             patterns.md
[promoted expression]:  destructors.md#constant-promotion
[promoted]:             destructors.md#constant-promotion
[range expressions]:    expressions/range-expr.md
[statics]:              items/static-items.md
[Struct expressions]:   expressions/struct-expr.md
[tuple enum variant]:   items/enumerations.md
[tuple expressions]:    expressions/tuple-expr.md
[tuple struct]:         items/structs.md
[while]:                expressions/loop-expr.md#predicate-loops
