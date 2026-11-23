<a id="names.resolution"></a>
# 名称解析

<a id="names.resolution.intro"></a> _名称解析_ 是将路径和其他标识符与这些实体的声明关联的过程。名称被划分为不同的 [命名空间]，使得不同命名空间中的实体可以共享相同的名称而不会发生冲突。每个名称在 [作用域] 内是有效的，即在该名称可能被引用的源文本区域中有效。根据其 [可见性]，对名称的访问可以被限制。

名称解析在编译过程中分为三个阶段。第一阶段 *扩展时解析* 会解决所有 [`use` 声明] 和 [宏调用]。第二阶段 *主解析* 会解决尚未被解析且不需要类型信息来解析的名称。最后阶段 *类型相关解析* 会在类型信息可用后解决剩余的名称。

> [!NOTE]
> Expansion-time resolution is also known as *early resolution*. Primary resolution is also known as *late resolution*.

<a id="names.resolution.general"></a>
## 通用

<a id="names.resolution.general.intro"></a> 本部分中的规则适用于名称解析的所有阶段。

<a id="names.resolution.general.scopes"></a>
### 作用域

<a id="names.resolution.general.scopes.intro"></a> 
> [!NOTE]
> This is a placeholder for future expansion about resolution of names within various scopes.

<a id="names.resolution.expansion"></a>
## 扩展时名称解析

<a id="names.resolution.expansion.intro"></a> 扩展时名称解析是完成宏展开并完全生成 crate 的 [抽象语法树] 所需的名称解析阶段。此阶段需要解决宏调用和 `use` 声明的问题。对于通过 [基于路径的作用域] 解决的宏调用，必须解决 `use` 声明；为了展开这些宏调用，也必须解决其宏调用问题。

<a id="names.resolution.expansion.unresolved-invocations"></a> 在扩展时名称解析之后，抽象语法树中不得包含任何未展开的宏调用。每个宏调用都应转换为最终抽象语法树或外部 crate 中的有效定义。

```rust,compile_fail
m!(); // ERROR: Cannot find macro `m` in this scope.
```

<a id="names.resolution.expansion.expansion-order-stability"></a> 名称的解析必须具有稳定性。在展开之后，完全展开的 AST 中的名称无论宏如何展开以及导入如何解析，都必须指向相同的定义。

<a id="names.resolution.expansion.speculation"></a> 在宏展开过程中选出的所有名称解析候选者都被视为推测性的。一旦 crate 被完全展开，所有推测性导入解析都会被验证，以确保宏展开没有引入任何新的歧义。

> [!NOTE]
> Due to the iterative nature of macro expansion, this causes so-called time traveling ambiguities, such as when a macro or glob import introduces an item that is ambiguous with its own base path.
>
> ```rust,compile_fail,E0659
> # fn main() {}
> macro_rules! f {
>     () => {
>         mod m {
>             pub(crate) use f;
>         }
>     }
> }
> f!();
>
> const _: () = {
>     // Initially, we speculatively resolve `m` to the module in
>     // the crate root.
>     //
>     // Expansion of `f` introduces a second `m` module inside this
>     // body.
>     //
>     // Expansion-time resolution finalizes resolutions by re-
>     // resolving all imports and macro invocations, sees the
>     // introduced ambiguity and reports it as an error.
>     m::f!(); // ERROR: `m` is ambiguous.
> };
> ```

<a id="names.resolution.expansion.imports"></a>
### 导入 r[names.resolution.expansion.imports.intro] 在此阶段的所有 `use` 声明都已被完全解析。[类型相对路径] 在此阶段无法被解析，将会产生错误。

```rust,no_run
mod m {
    pub const C: () = ();
    pub enum E { V }
    pub type A = E;
    impl E {
        pub const C: () = ();
    }
}

// Valid imports resolved at expansion-time:
use m::C; // OK.
use m::E; // OK.
use m::A; // OK.
use m::E::V; // OK.

// Valid expressions resolved during type-relative resolution:
let _ = m::A::V; // OK.
let _ = m::E::C; // OK.
```

```rust,compile_fail,E0432
# mod m {
#     pub const C: () = ();
#     pub enum E { V }
#     pub type A = E;
#     impl E {
#         pub const C: () = ();
#     }
# }
// Invalid type-relative imports that can't resolve at expansion-time:
use m::A::V; // ERROR: Unresolved import `m::A::V`.
use m::E::C; // ERROR: Unresolved import `m::E::C`.
```

<a id="names.resolution.expansion.imports.shadowing"></a> 通过 `[outer scope]` 中的 `use` 声明引入的名称，会被同一命名空间内具有相同名称的候选者覆盖，除非受到 [name resolution ambiguities] 的限制。

```rust,no_run
pub mod m1 {
    pub mod ambig {
        pub const C: u8 = 1;
    }
}

pub mod m2 {
    pub mod ambig {
        pub const C: u8 = 2;
    }
}

// This introduces the name `ambig` in the outer scope.
use m1::ambig;
const _: () = {
    // This shadows `ambig` in the inner scope.
    use m2::ambig;
    // The inner candidate is selected here
    // as the resolution of `ambig`.
    use ambig::C;
    assert!(C == 2);
};
```

<a id="names.resolution.expansion.imports.shadowing-shared-scope"></a> 在以下情况下，通过单个作用域内的 `use` 声明引入的名称可以被覆盖：

- [`use` glob shadowing] - [宏文本作用域覆盖]

<a id="names.resolution.expansion.imports.ambiguity"></a>
#### 歧义

<a id="names.resolution.expansion.imports.ambiguity.intro"></a> 在展开时解析过程中，存在多种情况：有多个宏定义、`use` 声明或模块，而导入或宏调用的名称可能指向这些项中的任何一个，编译器无法一致地确定哪个候选者应该覆盖另一个。在这种情况下不允许覆盖行为，而是会生成歧义错误。

<a id="names.resolution.expansion.imports.ambiguity.glob-vs-glob"></a> 无法通过模糊的 glob 导入来解析名称。只要该名称未被使用，glob 导入允许从同一命名空间导入冲突的名称。来自模糊 glob 导入的具有冲突候选名的名称仍可能被非 glob 导入覆盖，并在不使用时不会引发错误。错误发生在使用时，而非导入时。

```rust,compile_fail,E0659
mod m1 {
    pub struct Ambig;
}

mod m2 {
    pub struct Ambig;
}

// OK: This brings conficting names in the same namespace into scope
// but they have not been used yet.
use m1::*;
use m2::*;

const _: () = {
    // The error happens when the name with the conflicting candidates
    // is used.
    let x = Ambig; // ERROR: `Ambig` is ambiguous.
};
```

```rust,no_run
# mod m1 {
#     pub struct Ambig;
# }
#
# mod m2 {
#     pub struct Ambig;
# }
#
# use m1::*;
# use m2::*; // OK: No name conflict.
const _: () = {
    // This is permitted, since resolution is not through the
    // ambiguous globs.
    struct Ambig;
    let x = Ambig; // OK.
};
```

允许多个 glob 导入同时导入同一个名称，如果该导入属于同一项（包括重新导出），则该名称可以被使用。名称的可见性取决于所有导入的可见性。

```rust,no_run
mod m1 {
    pub struct Ambig;
}

mod m2 {
    // This reexports the same `Ambig` item from a second module.
    pub use super::m1::Ambig;
}

mod m3 {
    // These both import the same `Ambig`.
    //
    // The visibility of `Ambig` is `pub` because that is the
    // maximum visibility between these two `use` declarations.
    pub use super::m1::*;
    use super::m2::*;
}

mod m4 {
    // `Ambig` can be used through the `m3` globs and still has
    // `pub` visibility.
    pub use crate::m3::Ambig;
}

const _: () = {
    // Therefore, we can use it here.
    let _ = m4::Ambig; // OK.
};
# fn main() {}
```

<a id="names.resolution.expansion.imports.ambiguity.glob-vs-outer"></a> 当存在另一个候选名位于 [外部作用域] 中时，在 glob 导入中无法解析导入中的名称。

<a id="names.resolution.expansion.imports.ambiguity.panic-hack"></a> 
> [!NOTE]
> When one of [`core::panic!`] or [`std::panic!`] is brought into scope due to the [standard library prelude], and a user-written [glob import] brings the other into scope, `rustc` currently allows use of `panic!`, even though it is ambiguous. The user-written glob import takes precedence to resolve this ambiguity.
>
> In Rust 2021 and later, [`core::panic!`] and [`std::panic!`] operate identically. But in earlier editions, they differ; only [`std::panic!`] accepts a [`String`] as the format argument.
>
> E.g., this is an error:
>
> ```rust,edition2018,compile_fail,E0308
> extern crate core;
> use ::core::prelude::v1::*;
> fn main() {
>     panic!(std::string::String::new()); // ERROR.
> }
> ```
>
> And this is accepted:
>
> <!-- ignore: Can't test with `no_std`. -->
> ```rust,edition2018,ignore
> #![no_std]
> extern crate std;
> use ::std::prelude::v1::*;
> fn main() {
>     panic!(std::string::String::new()); // OK.
> }
> ```
>
> Don't rely on this behavior; the plan is to remove it.
>
> For details, see [Rust issue #147319](https://github.com/rust-lang/rust/issues/147319).

```rust,compile_fail,E0659
mod glob {
    pub mod ambig {
        pub struct Name;
    }
}

// Outer `ambig` candidate.
pub mod ambig {
    pub struct Name;
}

const _: () = {
    // Cannot resolve `ambig` through this glob
    // because of the outer `ambig` candidate above.
    use glob::*;
    use ambig::Name; // ERROR: `ambig` is ambiguous.
};
```

```rust,compile_fail,E0659
// As above, but with macros.
pub mod m {
    macro_rules! f {
        () => {};
    }
    pub(crate) use f;
}
pub mod glob {
    macro_rules! f {
        () => {};
    }
    pub(crate) use f as ambig;
}

use m::f as ambig;

const _: () = {
    use glob::*;
    ambig!(); // ERROR: `ambig` is ambiguous.
};
```

> [!NOTE]
> These ambiguity errors are specific to expansion-time resolution. Having multiple candidates available for a given name during later stages of resolution is not considered an error. So long as none of the imports themselves are ambiguous, there will always be a single unambiguous closest resolution.
>
> ```rust,no_run
> mod glob {
>     pub const AMBIG: u8 = 1;
> }
>
> mod outer {
>     pub const AMBIG: u8 = 2;
> }
>
> use outer::AMBIG;
>
> const C: () = {
>     use glob::*;
>     assert!(AMBIG == 1);
>     //      ^---- This `AMBIG` is resolved during primary resolution.
> };
> ```

<a id="names.resolution.expansion.imports.ambiguity.path-vs-textual-宏"></a> 无法通过模糊的宏重新导出来解析名称。当宏重新导出在 [外部作用域] 中会覆盖同名的文本宏候选名时，这种重新导出即为模糊的。

```rust,compile_fail,E0659
// Textual macro candidate.
macro_rules! ambig {
    () => {}
}

// Path-based macro candidate.
macro_rules! path_based {
    () => {}
}

pub fn f() {
    // This reexport of the `path_based` macro definition
    // as `ambig` may not shadow the `ambig` macro definition
    // which is resolved via textual macro scope.
    use path_based as ambig;
    ambig!(); // ERROR: `ambig` is ambiguous.
}
```

> [!NOTE]
> This restriction is needed due to implementation details in the compiler, specifically the current scope visitation logic and the complexity of supporting this behavior. This ambiguity error may be removed in the future.

<a id="names.resolution.expansion.macros"></a>
### 宏

<a id="names.resolution.expansion.macros.intro"></a> 宏通过遍历可用的作用域来查找可用候选项进行解析。宏被分为两个子命名空间：一个用于函数式宏，另一个用于属性和派生类型。来自错误子命名空间的解析候选项将被忽略。

<a id="names.resolution.expansion.macros.visitation-order"></a> 可用的作用域种类按以下顺序访问。每种作用域种类代表一个或多个作用域。

* [Derive helpers] * [文本作用域宏] * [基于路径的作用域宏] * [`macro_use` prelude] * [标准库预lude] * [内置属性]

> [!NOTE]
> The compiler will attempt to resolve derive helpers that are used before their associated macro introduces them into scope. This scope is visited after the scope for resolving derive helper candidates that are correctly in scope. This behavior is slated for removal.
>
> For more info see [derive helper scope].

> [!NOTE]
> This visitation order may change in the future, such as interleaving the visitation of textual and path-based scope candidates based on their lexical scopes.

> [!EDITION-2018]
> Starting in edition 2018 the `#[macro_use]` prelude is not visited when [`#[no_implicit_prelude]`][names.preludes.no_implicit_prelude] is present.

<a id="names.resolution.expansion.macros.reserved-names"></a> 在宏属性 [子命名空间] 中，`cfg` 和 `cfg_attr` 这两个名称被保留使用。

<a id="names.resolution.expansion.macros.ambiguity"></a>
#### 模糊性

<a id="names.resolution.expansion.macros.ambiguity.more-expanded-vs-outer"></a> 在宏展开过程中，名称不应通过模糊候选项被解析。当内部宏展开中的候选项会遮蔽外部相同名称的候选项时，且被调用的名称也在外部宏展开中时被调用时，这些候选项即为模糊的。

```rust,compile_fail,E0659
macro_rules! define_ambig {
    () => {
        macro_rules! ambig {
            () => {}
        }
    }
}

// Introduce outer candidate definition for `ambig` macro invocation.
macro_rules! ambig {
    () => {}
}

// Introduce a second candidate definition for `ambig` inside of a
// macro expansion.
define_ambig!();

// The definition of `ambig` from the second invocation
// of `define_ambig` is the innermost canadidate.
//
// The definition of `ambig` from the first invocation of
// `define_ambig` is the second candidate.
//
// The compiler checks that the first candidate is inside of a macro
// expansion, that the second candidate is not from within the same
// macro expansion, and that the name being resolved is not from
// within the same macro expansion.
ambig!(); // ERROR: `ambig` is ambiguous.
```

反之则不被视为模糊。

```rust,no_run
# macro_rules! define_ambig {
#     () => {
#         macro_rules! ambig {
#             () => {}
#         }
#     }
# }
// Swap order of definitions.
define_ambig!();
macro_rules! ambig {
    () => {}
}
// The innermost candidate is now less expanded so it may shadow more
// the macro expanded definition above it.
ambig!();
```

如果被解析的调用位于最内层的候选项的展开范围内，也不视为模糊。

```rust,no_run
macro_rules! ambig {
    () => {}
}

macro_rules! define_and_invoke_ambig {
    () => {
        // Define innermost candidate.
        macro_rules! ambig {
            () => {}
        }

        // Invocation of `ambig` is in the same expansion as the
        // innermost candidate.
        ambig!(); // OK
    }
}

define_and_invoke_ambig!();
```

无论两个定义是否来自同一个宏的调用，最外层的候选项仍被视为“未完全展开”，因为它不在包含最内层候选项定义的展开范围内。

```rust,compile_fail,E0659
# macro_rules! define_ambig {
#     () => {
#         macro_rules! ambig {
#             () => {}
#         }
#     }
# }
define_ambig!();
define_ambig!();
ambig!(); // ERROR: `ambig` is ambiguous.
```

这同样适用于导入情况，只要该名称的最内层候选项位于宏展开范围内即可。

```rust,compile_fail,E0659
macro_rules! define_ambig {
    () => {
        mod ambig {
            pub struct Name;
        }
    }
}

mod ambig {
    pub struct Name;
}

const _: () = {
    // Introduce innermost candidate for
    // `ambig` mod in this macro expansion.
    define_ambig!();
    use ambig::Name; // ERROR: `ambig` is ambiguous.
};
```

<a id="names.resolution.expansion.macros.ambiguity.built-in-attr"></a> 用户定义的属性或派生宏不得遮蔽内置的非宏属性（例如内联属性）。

<!-- ignore: test doesn't support proc-macro -->
```rust,ignore
// with-helper/src/lib.rs
# use proc_macro::TokenStream;
#[proc_macro_derive(WithHelperAttr, attributes(non_exhaustive))]
//                                             ^^^^^^^^^^^^^^
//                                   User-defined attribute candidate.
// ...
# pub fn derive_with_helper_attr(_item: TokenStream) -> TokenStream {
#     TokenStream::new()
# }
```

<!-- ignore: requires external crates -->
```rust,ignore
// src/lib.rs
#[derive(with_helper::WithHelperAttr)]
#[non_exhaustive] // ERROR: `non_exhaustive` is ambiguous.
struct S;
```

> [!NOTE]
> This applies regardless of the name the built-in attribute is a candidate for:
>
> <!-- ignore: test doesn't support proc-macro -->
> ```rust,ignore
> // with-helper/src/lib.rs
> # use proc_macro::TokenStream;
> #
> #[proc_macro_derive(WithHelperAttr, attributes(helper))]
> //                                             ^^^^^^
> //                                 User-defined attribute candidate.
> // ...
> # pub fn derive_with_helper_attr(_item: TokenStream) -> TokenStream {
> #     TokenStream::new()
> # }
> ```
>
> <!-- ignore: requires external crates -->
> ```rust,ignore
> // src/lib.rs
> use inline as helper;
> //            ^----- Built-in attribute candidate via reexport.
>
> #[derive(with_helper::WithHelperAttr)]
> #[helper] // ERROR: `helper` is ambiguous.
> struct S;
> ```

<a id="names.resolution.primary"></a>
## 主要名称解析
> [!NOTE]
> This is a placeholder for future expansion about primary name resolution.

<a id="names.resolution.type-relative"></a>
## 类型相对解析
> [!NOTE]
> This is a placeholder for future expansion about type-dependent resolution.

[AST]: glossary.ast
[glob import]: items.use.glob
[macro textual scope shadowing]: macro.decl.scope.textual.shadow-path-based
[type-relative paths]: names.resolution.type-relative

[Builtin attributes]: ./preludes.md#r-names.preludes.lang
[Derive helpers]: ../procedural-macros.md#r-macro.proc.derive.attributes
[Macros]: ../macros.md
[Path-based scope macros]: ../macros.md#r-macro.invocation.name-resolution
[Standard library prelude]: ./preludes.md#r-names.preludes.std
[Textual scope macros]: ../macros-by-example.md#r-macro.decl.scope.textual
[`let` bindings]: ../statements.md#let-statements
[`macro_use` prelude]: ./preludes.md#r-names.preludes.macro_use
[`use` declarations]: ../items/use-declarations.md
[`use` glob shadowing]: ../items/use-declarations.md#r-items.use.glob.shadowing
[derive helper scope]: ../procedural-macros.md#r-macro.proc.derive.attributes.scope
[item definitions]: ../items.md
[macro invocations]: ../macros.md#macro-invocation
[name resolution ambiguities]: #r-names.resolution.expansion.imports.ambiguity
[namespaces]: ../names/namespaces.md
[outer scope]: #r-names.resolution.general.scopes
[path-based scope]: ../macros.md#r-macro.invocation.name-resolution
[scope]: ../names/scopes.md
[sub-namespace]: ../names/namespaces.md#r-names.namespaces.sub-namespaces
[visibility]: ../visibility-and-privacy.md
