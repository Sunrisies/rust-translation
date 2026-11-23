<a id="items.use"></a>
# 使用声明

<a id="items.use.syntax"></a> 
```grammar,items
UseDeclaration -> `use` UseTree `;`

UseTree ->
      (SimplePath? `::`)? `*`
    | (SimplePath? `::`)? `{` (UseTree ( `,`  UseTree )* `,`?)? `}`
    | SimplePath ( `as` ( IDENTIFIER | `_` ) )?
```

<a id="items.use.intro"></a> _使用声明_ 创建一个或多个与某些其他[路径]同义的本地名称绑定。通常，`use` 声明用于缩短引用模块项所需的路径。这些声明可能出现在[modules]和[blocks]中，一般位于顶部。`use` 声明有时也被称为_导入_，如果它是公开的，则称为_重新导出_。


<a id="items.use.forms"></a> 使用声明支持多种便捷快捷方式：

<a id="items.use.forms-multiple"></a> * 同时绑定带有共同前缀的多个路径，使用花括号语法 `use a::b::{c, d, e::f, g::h::i};`

<a id="items.use.forms-self"></a> * 同时绑定带有共同前缀和它们共同的父模块中的多个路径，使用`self`关键字，例如 `use a::b::{self, c, d::e};`

<a id="items.use.forms-as"></a> * 将目标名称重新绑定为新的本地名称，使用语法 `use p::q::r as x;`。最后两种功能也可以这样使用：`use a::b::{self as ab, c as abc}。`

<a id="items.use.forms-glob"></a> * 绑定所有匹配给定前缀的路径，使用星号通配符语法 `use a::b::*;`。

<a id="items.use.forms-nesting"></a> * 多次嵌套前面功能的组，例如 `use a::b::{self as ab, c, d::{*, e::f}};`

`use` 声明的一个示例：

```rust
use std::collections::hash_map::{self, HashMap};

fn foo<T>(_: T){}
fn bar(map1: HashMap<String, usize>, map2: hash_map::HashMap<String, usize>){}

fn main() {
    // use declarations can also exist inside of functions
    use std::option::Option::{Some, None};

    // Equivalent to 'foo(vec![std::option::Option::Some(1.0f64),
    // std::option::Option::None]);'
    foo(vec![Some(1.0f64), None]);

    // Both `hash_map` and `HashMap` are in scope.
    let map1 = HashMap::new();
    let map2 = hash_map::HashMap::new();
    bar(map1, map2);
}
```

<a id="items.use.visibility"></a>
## `use` 可见性

<a id="items.use.visibility.intro"></a> 与 items 一样，`use` 声明默认情况下对包含它的模块是私有的。同样，如果由`pub`关键字标记，则 `use` 声明可以是公开的。这样的 `use` 声明用于_重新导出_一个名称。因此，公开的 `use` 声明可以_重定向_某些公共名称到不同的目标定义：甚至是在不同模块中具有私有规范路径的定义。

<a id="items.use.visibility.unambiguous"></a> 如果一系列这种重定向形成循环或无法明确解析，则代表编译时错误。

重新导出的一个示例：

```rust
mod quux {
    pub use self::foo::{bar, baz};
    pub mod foo {
        pub fn bar() {}
        pub fn baz() {}
    }
}

fn main() {
    quux::bar();
    quux::baz();
}
```

在本示例中，模块 `quux` 重新导出在 `foo` 中定义的两个公共名称。

<a id="items.use.path"></a>
## `use` 路径

<a id="items.use.path.intro"></a> 在 `use` 项中允许的 [路径] 遵循 [SimplePath] 语法，与表达式中可能使用的路径类似。它们可以创建以下类型的绑定：

* 可命名的 [项] * [枚举变体] * [内置类型] * [属性] * [派生宏] * [`macro_rules`]

<a id="items.use.path.disallowed"></a> 它们不能导入 [关联项]、[泛型参数]、[局部变量]、带有 [`Self`] 的路径或 [工具属性]。以下还有更多限制。

<a id="items.use.path.namespace"></a> `use` 将为从导入实体中得到的所有 [命名空间] 创建绑定，但 `self` 导入仅从类型命名空间导入（如下所述）。例如，以下示例说明了为两个命名空间中相同的名称创建绑定：

```rust
mod stuff {
    pub struct Foo(pub i32);
}

// Imports the `Foo` type and the `Foo` constructor.
use stuff::Foo;

fn example() {
    let ctor = Foo; // Uses `Foo` from the value namespace.
    let x: Foo = ctor(123); // Uses `Foo` From the type namespace.
}
```

<a id="items.use.path.edition2018"></a> 
> [!EDITION-2018]
> In the 2015 edition, `use` paths are relative to the crate root. For example:
>
> ```rust,edition2015
> mod foo {
>     pub mod example { pub mod iter {} }
>     pub mod baz { pub fn foobaz() {} }
> }
> mod bar {
>     // Resolves `foo` from the crate root.
>     use foo::example::iter;
>     // The `::` prefix explicitly resolves `foo`
>     // from the crate root.
>     use ::foo::baz::foobaz;
> }
>
> # fn main() {}
> ```
>
> The 2015 edition does not allow use declarations to reference the [extern prelude]. Thus, [`extern crate`] declarations are still required in 2015 to reference an external crate in a `use` declaration. Beginning with the 2018 edition, `use` declarations can specify an external crate dependency the same way `extern crate` can.

<a id="items.use.as"></a>
## `as` 重命名

`as` 关键字可用于更改导入实体的名称。例如：

```rust
// Creates a non-public alias `bar` for the function `foo`.
use inner::foo as bar;

mod inner {
    pub fn foo() {}
}
```

<a id="items.use.multiple-syntax"></a>
## 花括号语法

<a id="items.use.multiple-syntax.intro"></a> 在路径的最后一个段中可以使用花括号来从前一段导入多个实体，或者如果没有前一段，则从当前作用域导入。花括号可以嵌套，形成路径树结构，其中每个分段组与其父段逻辑上结合以生成完整的路径。

```rust
// Creates bindings to:
// - `std::collections::BTreeSet`
// - `std::collections::hash_map`
// - `std::collections::hash_map::HashMap`
use std::collections::{BTreeSet, hash_map::{self, HashMap}};
```

<a id="items.use.multiple-syntax.empty"></a> 空的花括号不会导入任何内容，尽管前置路径需经过验证以确保可访问。
<!-- This is slightly wrong, see: https://github.com/rust-lang/rust/issues/61826 -->

<a id="items.use.multiple-syntax.edition2018"></a> 
> [!EDITION-2018]
> In the 2015 edition, paths are relative to the crate root, so an import such as `use {foo, bar};` will import the names `foo` and `bar` from the crate root, whereas starting in 2018, those names are relative to the current scope.

<a id="items.use.self"></a>
## `self` 导入

<a id="items.use.self.intro"></a> 关键字 `self` 可以在 [花括号语法] 中使用，以创建父实体在其自身名称下的绑定。

```rust
mod stuff {
    pub fn foo() {}
    pub fn bar() {}
}
mod example {
    // Creates a binding for `stuff` and `foo`.
    use crate::stuff::{self, foo};
    pub fn baz() {
        foo();
        stuff::bar();
    }
}
# fn main() {}
```

> [!NOTE]
> `self` may also be used as the first segment of a path. The use of `self` as the first segment and inside a `use` brace is logically the same; it means the current module of the parent segment, or the current module if there is no parent segment. See [`self`] in the paths chapter for more information on the meaning of a leading `self`.

<a id="items.use.self.trailing"></a> `self` 可以作为 `use` 路径的最后一个段出现，前面有 `::`。形式为 `P::self` 的路径等同于 `P::{self}`，而 `P::self as name` 等同于 `P::{self as name}`。

```rust
mod m {
    pub enum E { V1, V2 }
}
use m::self as _; // Equivalent to `use m::{self as _};`.
use m::E::self; // Equivalent to `use m::E::{self};`.
# fn main() {}
```

> [!NOTE]
> See [paths.qualifiers.mod-self.trailing] for restrictions on the preceding path.

<a id="items.use.self.module"></a> 当在 [花括号语法] 中使用 `self` 时，花括号前的路径必须指向一个 [模块]、[枚举] 或 [特质]。

```rust
mod m {
    pub enum E { V1, V2 }
    pub trait Tr { fn f(&self); }
}
use m::{self as _}; // OK: Modules can be parents of `self`.
use m::E::{self, V1}; // OK: Enums can be parents of `self`.
use m::Tr::{self}; // OK: Traits can be parents of `self`.
# fn main() {}
```

```rust,compile_fail,E0432
struct S {}
use S::{self as _}; // ERROR: Structs cannot be parents of `self`.
# fn main() {}
```

<a id="items.use.self.namespace"></a> `self` 仅创建来自父实体 [类型命名空间] 的绑定。例如，在以下示例中，只导入了 `foo` 模块：

```rust,compile_fail
mod bar {
    pub mod foo {}
    pub fn foo() {}
}

// This only imports the module `foo`. The function `foo` lives in
// the value namespace and is not imported.
use bar::foo::{self};

fn main() {
    foo(); //~ ERROR `foo` is a module
}
```

<a id="items.use.glob"></a>
## Glob 导入

<a id="items.use.glob.intro"></a> `*` 字符可用作 `use` 路径的最后一个段，以从前一段实体中导入所有可导入实体。例如：

```rust
// Creates a non-public alias to `bar`.
use foo::*;

mod foo {
    fn i_am_private() {}
    enum Example {
        V1,
        V2,
    }
    pub fn bar() {
        // Creates local aliases to `V1` and `V2`
        // of the `Example` enum.
        use Example::*;
        let x = V1;
    }
}
```

<a id="items.use.glob.shadowing"></a> 项目和命名导入允许在相同的 [命名空间] 中遮蔽 glob 导入中的名称。也就是说，如果同一命名空间中已有其他项目定义某个名称，则 glob 导入会被遮蔽。例如：

```rust
// This creates a binding to the `clashing::Foo` tuple struct
// constructor, but does not import its type because that would
// conflict with the `Foo` struct defined here.
//
// Note that the order of definition here is unimportant.
use clashing::*;
struct Foo {
    field: f32,
}

fn do_stuff() {
    // Uses the constructor from `clashing::Foo`.
    let f1 = Foo(123);
    // The struct expression uses the type from
    // the `Foo` struct defined above.
    let f2 = Foo { field: 1.0 };
    // `Bar` is also in scope due to the glob import.
    let z = Bar {};
}

mod clashing {
    pub struct Foo(pub i32);
    pub struct Bar {}
}
```

> [!NOTE]
> For areas where shadowing is not allowed, see [name resolution ambiguities].

<a id="items.use.glob.last-segment-only"></a> `*` 不能用作第一个或中间段。

<a id="items.use.glob.self-import"></a> `*` 不能用于将模块的内容导入到自身中（如 `use self::*;`）。

<a id="items.use.glob.edition2018"></a> 
> [!EDITION-2018]
> In the 2015 edition, paths are relative to the crate root, so an import such as `use *;` is valid, and it means to import everything from the crate root. This cannot be used in the crate root itself.

<a id="items.use.as-underscore"></a>
## 下划线导入

<a id="items.use.as-underscore.intro"></a> 可以通过使用下划线和 `use path as _` 的形式来导入项目，而无需将其绑定到某个名称。这特别适用于导入特质，以便在其方法被使用时无需导入该特质的符号，例如当该特质的符号可能与另一个符号冲突时。另一个例子是链接外部 crate，而不需要导入其名称。

```rust
mod foo {
    pub trait Zoo {
        fn zoo(&self) {}
    }

    impl<T> Zoo for T {}
}

use self::foo::Zoo as _;
struct Zoo;  // Underscore import avoids name conflict with this item.

fn main() {
    let z = Zoo;
    z.zoo();
}
```

<a id="items.use.as-underscore.glob"></a> 星号 glob 导入将导入以 `_` 形式不可命名的项目。

<a id="items.use.as-underscore.宏"></a> 独特的、不可命名的符号在宏展开后创建，这样宏就可以安全地引用多个 `_` 导入。例如，以下代码不应产生错误：

```rust
macro_rules! m {
    ($item: item) => { $item $item }
}

m!(use std as _;);
// This expands to:
// use std as _;
// use std as _;
```

<a id="items.use.restrictions"></a>
## 限制

<a id="items.use.restrictions.intro"></a> 以下规则是有效 `use` 声明的限制。

<a id="items.use.restrictions.crate-alias"></a> 当使用 `crate` 来导入当前 crate 时，必须使用 `as` 来定义绑定名称。

> [!EXAMPLE]
> ```rust
> use crate as root;
> use crate::{self as root2};
>
> // Not allowed:
> // use crate;
> // use crate::{self};
> ```

<a id="items.use.restrictions.宏-crate-alias"></a> 当在宏转译器中使用 [`$crate`]来导入当前 crate 时，必须使用 `as` 来定义绑定名称。

> [!EXAMPLE]
> ```rust
> macro_rules! import_crate_root {
>     () => {
>         use $crate as my_crate;
>         use $crate::{self as my_crate2};
>     };
> }
> ```

<a id="items.use.restrictions.self-alias"></a> 当使用 `self` 来导入当前模块时，必须使用 `as` 来定义绑定名称。

> [!EXAMPLE]
> ```rust
> use {self as this_module};
> use self as this_module2;
> use self::{self as this_module3};
>
> // Not allowed:
> // use {self};
> // use self;
> // use self::{self};
> ```

<a id="items.use.restrictions.super-alias"></a> 当使用 `super` 来导入父模块时，必须使用 `as` 来定义绑定名称。

> [!EXAMPLE]
> ```rust
> mod a {
>     mod b {
>         use super as parent;
>         use super::{self as parent2};
>         use self::super as parent3;
>         use super::super as grandparent;
>         use super::super::{self as grandparent2};
>
>         // Not allowed:
>         // use super;
>         // use super::{self};
>         // use self::super;
>         // use super::super;
>         // use super::super::{self};
>     }
> }
> ```

<a id="items.use.restrictions.extern-prelude"></a> `[::]` 作为 [extern prelude] 无法被导入。

> [!EXAMPLE]
> ```rust,edition2018,compile_fail
> use ::{self as root}; //~ Error
> ```

> [!EDITION-2018]
> In the 2015 edition, the prefix `::` refers to the crate root, so `use ::{self as root};` is allowed because it is same as `use crate::{self as root};`.
>
> ```rust,edition2015
> use ::{self as root}; //~ OK in the 2015 edition.
> ```
>
> Starting with the 2018 edition, the `::` prefix refers to the extern prelude, which cannot be directly imported.

<a id="items.use.restrictions.duplicate-name"></a> 与任何项定义一样，`use` 导入无法在模块或块中的同一命名空间内创建相同名称的重复绑定。

<a id="items.use.restrictions.variant"></a> `use` 路径无法通过 [type alias] 引用枚举变体。

> [!EXAMPLE]
> ```rust,compile_fail
> enum MyEnum {
>   MyVariant
> }
> type TypeAlias = MyEnum;
>
> use MyEnum::MyVariant; //~ OK
> use TypeAlias::MyVariant; //~ ERROR
> ```

[`$crate`]: paths.qualifiers.macro-crate
[brace syntax]: items.use.multiple-syntax
[Derive macros]: macro.proc.derive
[enumeration]: items.enum
[module]: items.mod
[name resolution ambiguities]: names.resolution.expansion.imports.ambiguity
[trait]: items.traits

[path]: ../paths.md
[modules]: modules.md
[blocks]: ../expressions/block-expr.md
[Attributes]: ../attributes.md
[Built-in types]: ../types.md
[Enum variants]: enumerations.md
[`extern crate`]: extern-crates.md
[`macro_rules`]: ../macros-by-example.md
[`self`]: ../paths.md#self
[associated items]: associated-items.md
[extern prelude]: ../names/preludes.md#extern-prelude
[generic parameters]: generics.md
[items]: ../items.md
[local variables]: ../variables.md
[namespace]: ../names/namespaces.md
[namespaces]: ../names/namespaces.md
[paths]: ../paths.md
[tool attributes]: ../attributes.md#tool-attributes
[type alias]: type-aliases.md
[type namespace]: ../names/namespaces.md
