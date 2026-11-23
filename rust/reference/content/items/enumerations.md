<a id="items.枚举"></a>
# 枚举类型

<a id="items.枚举.syntax"></a> 
```grammar,items
Enumeration ->
    `enum` IDENTIFIER GenericParams? WhereClause? `{` EnumVariants? `}`

EnumVariants -> EnumVariant ( `,` EnumVariant )* `,`?

EnumVariant ->
    OuterAttribute* Visibility?
    IDENTIFIER ( EnumVariantTuple | EnumVariantStruct )? EnumVariantDiscriminant?

EnumVariantTuple -> `(` TupleFields? `)`

EnumVariantStruct -> `{` StructFields? `}`

EnumVariantDiscriminant -> `=` Expression
```

<a id="items.枚举.intro"></a> 枚举，也称为*枚举*，同时定义了名义的[枚举类型]以及一组*构造函数*，这些构造函数可用于创建或模式匹配对应枚举类型的值。

<a id="items.枚举.decl"></a> 使用关键字`enum`来声明枚举。

<a id="items.枚举.namespace"></a> `enum`声明在模块或块中的[类型命名空间]中定义枚举类型。

一个`enum`项及其使用的示例：

```rust
enum Animal {
    Dog,
    Cat,
}

let mut a: Animal = Animal::Dog;
a = Animal::Cat;
```

<a id="items.枚举.constructor"></a> 枚举构造函数可以包含有名称的或不含名称的字段：

```rust
enum Animal {
    Dog(String, f64),
    Cat { name: String, weight: f64 },
}

let mut a: Animal = Animal::Dog("Cocoa".to_string(), 37.2);
a = Animal::Cat { name: "Spotty".to_string(), weight: 2.7 };
```

在这个示例中，`Cat`是一个_类似结构体的枚举变体_，而`Dog`则简单地被称为枚举变体。

<a id="items.枚举.fieldless"></a> 不包含字段的枚举称为*<span id="field-less-枚举">无字段枚举</span>*。例如，这是一个无字段枚举：

```rust
enum Fieldless {
    Tuple(),
    Struct{},
    Unit,
}
```

<a id="items.枚举.unit-only"></a> 如果无字段枚举仅包含单位变体，则该枚举称为*<span id="unit-only-枚举">纯单位枚举</span>*。例如：

```rust
enum Enum {
    Foo = 3,
    Bar = 2,
    Baz = 1,
}
```

<a id="items.枚举.constructor-names"></a> 变体构造函数类似于[结构体]定义，可以通过从枚举名称开始的路径来引用，包括在[使用声明]中。

<a id="items.枚举.constructor-namespace"></a> 每个变体都在[类型命名空间]中定义其类型，尽管该类型不能用作类型说明符。类似元组和纯单位变体也在[值命名空间]中定义构造函数。

<a id="items.枚举.结构体-expr"></a> 类似结构体的变体可以通过[结构体表达式]实例化。

<a id="items.枚举.tuple-expr"></a> 类似元组的变体可以通过[调用表达式]或[结构体表达式]实例化。

<a id="items.枚举.path-expr"></a> 纯单位变体可以通过[路径表达式]或[结构体表达式]实例化。例如：

```rust
enum Examples {
    UnitLike,
    TupleLike(i32),
    StructLike { value: i32 },
}

use Examples::*; // Creates aliases to all variants.
let x = UnitLike; // Path expression of the const item.
let x = UnitLike {}; // Struct expression.
let y = TupleLike(123); // Call expression.
let y = TupleLike { 0: 123 }; // Struct expression using integer field names.
let z = StructLike { value: 123 }; // Struct expression.
```

<span id="custom-discriminant-values-for-fieldless-enumerations"></span>
<a id="items.枚举.discriminant"></a>
## 区分因子

<a id="items.枚举.discriminant.intro"></a> 每个枚举实例都有一个_区分因子_:一个与之逻辑关联的整数，用于确定它属于哪个变体。

<a id="items.枚举.discriminant.type"></a> 没有 [基本类型表示] 的枚举具有 `isize` 类型的判别式。然而，编译器可能会使用更小的类型或另一种方式在实际内存布局中区分变体。

```rust
# use core::mem::size_of;
enum E {
    V1 = 0isize, // OK: `isize` is the discriminant type.
    V2,
}

assert!(size_of::<E>() <= size_of::<isize>());
```

```rust,compile_fail,E0308
enum E {
    V = 0u8, // ERROR: Expected `isize`, found `u8`.
}
```

<a id="items.枚举.discriminant.type-primitive"></a> 具有 [基本类型表示] 的枚举具有由该表示命名的类型作为判别式。这也适用于将 `C` 表示与基本类型表示结合使用的枚举（参见 [layout.repr.primitive-c]）。

```rust
#[repr(u8)]
enum E {
    V = 0u8, // OK: `u8` is the discriminant type.
}
```

```rust,compile_fail,E0308
#[repr(u8)]
enum E {
    V = 0isize, // ERROR: Expected `u8`, found `isize`.
}
```

### 设置判别式值

<a id="items.枚举.discriminant.explicit"></a>
#### 显式判别式

<a id="items.枚举.discriminant.explicit.intro"></a> 在两种情况下，变体的判别式可以通过在变体名称后加上 `=` 和 [常量表达式] 来显式设置：

<a id="items.枚举.discriminant.explicit.unit-only"></a> 1. 如果枚举是 “[unit-only]”。

<a id="items.枚举.discriminant.explicit.primitive-repr"></a> 2. 如果使用 [基本类型表示]。例如：

   ```rust
   #[repr(u8)]
   enum Enum {
       Unit = 3,
       Tuple(u16),
       Struct {
           a: u8,
           b: u16,
       } = 1,
   }
   ```

<a id="items.枚举.discriminant.implicit"></a>
#### 隐式判别式

如果未指定变体的判别式，则将其设置为比声明中前一个变体的判别式高一。如果声明中的第一个变体的判别式未指定，则设置为零。

```rust
enum Foo {
    Bar,            // 0
    Baz = 123,      // 123
    Quux,           // 124
}

let baz_discriminant = Foo::Baz as u32;
assert_eq!(baz_discriminant, 123);
```

<a id="items.枚举.discriminant.restrictions"></a>
#### 限制

<a id="items.枚举.discriminant.restrictions.same-discriminant"></a> 当两个变体具有相同的判别式时，这是错误的。

```rust,compile_fail
enum SharedDiscriminantError {
    SharedA = 1,
    SharedB = 1,
}

enum SharedDiscriminantError2 {
    Zero,       // 0
    One,        // 1
    OneToo = 1, // 1 (collision with previous!)
}
```

<a id="items.枚举.discriminant.restrictions.above-max-discriminant"></a> 当未指定的判别式大于该判别器的最大可能值时，这也是错误的。

```rust,compile_fail
#[repr(u8)]
enum OverflowingDiscriminantError {
    Max = 255,
    MaxPlusOne, // Would be 256, but that overflows the enum.
}

#[repr(u8)]
enum OverflowingDiscriminantError2 {
    MaxMinusOne = 254, // 254
    Max,               // 255
    MaxPlusOne,        // Would be 256, but that overflows the enum.
}
```

<a id="items.枚举.discriminant.restrictions.generics"></a> 显式枚举判别式初始化器不能使用封闭枚举中的泛型参数。

```rust,compile_fail
#[repr(u32)]
enum E<'a, T, const N: u32> {
    Lifetime(&'a T) = {
        let a: &'a (); // ERROR.
        1
    },
    Type(T) = {
        let x: T; // ERROR.
        2
    },
    Const = N, // ERROR.
}
```

### 访问判别式

#### 通过 `mem::discriminant` 访问

<a id="items.枚举.discriminant.access-opaque"></a> 

[`std::mem::discriminant`] 返回一个不可用的引用，用于访问可比较的枚举值的判别式。此引用不能用来获取判别器的具体值。

<a id="items.枚举.discriminant.coercion"></a>
#### 类型转换

<a id="items.枚举.discriminant.coercion.intro"></a> 如果枚举是 [单位型](#unit-only)（没有元组或结构变体），则可以通过 [数值转换] 直接访问其判别式；例如：

```rust
enum Enum {
    Foo,
    Bar,
    Baz,
}

assert_eq!(0, Enum::Foo as isize);
assert_eq!(1, Enum::Bar as isize);
assert_eq!(2, Enum::Baz as isize);
```

<a id="items.枚举.discriminant.coercion.fieldless"></a> [无字段枚举] 如果没有明确的判别式，或者只有单位型变体时，可以进行类型转换。

```rust
enum Fieldless {
    Tuple(),
    Struct{},
    Unit,
}

assert_eq!(0, Fieldless::Tuple() as isize);
assert_eq!(1, Fieldless::Struct{} as isize);
assert_eq!(2, Fieldless::Unit as isize);

#[repr(u8)]
enum FieldlessWithDiscriminants {
    First = 10,
    Tuple(),
    Second = 20,
    Struct{},
    Unit,
}

assert_eq!(10, FieldlessWithDiscriminants::First as u8);
assert_eq!(11, FieldlessWithDiscriminants::Tuple() as u8);
assert_eq!(20, FieldlessWithDiscriminants::Second as u8);
assert_eq!(21, FieldlessWithDiscriminants::Struct{} as u8);
assert_eq!(22, FieldlessWithDiscriminants::Unit as u8);
```

#### 指针转换

<a id="items.枚举.discriminant.access-memory"></a> 

如果枚举指定了 [基本表示形式]，则可以通过不安全的指针转换可靠地访问判别式：

```rust
#[repr(u8)]
enum Enum {
    Unit,
    Tuple(bool),
    Struct{a: bool},
}

impl Enum {
    fn discriminant(&self) -> u8 {
        unsafe { *(self as *const Self as *const u8) }
    }
}

let unit_like = Enum::Unit;
let tuple_like = Enum::Tuple(true);
let struct_like = Enum::Struct{a: false};

assert_eq!(0, unit_like.discriminant());
assert_eq!(1, tuple_like.discriminant());
assert_eq!(2, struct_like.discriminant());
```

<a id="items.枚举.empty"></a>
## 零变体枚举

<a id="items.枚举.empty.intro"></a> 具有零变体的枚举被称为 *零变体枚举*。由于它们没有有效值，因此无法实例化。

```rust
enum ZeroVariants {}
```

<a id="items.枚举.empty.uninhabited"></a> 零变体枚举等同于 [never类型]，但无法转换为其他类型。

```rust,compile_fail
# enum ZeroVariants {}
let x: ZeroVariants = panic!();
let y: u32 = x; // mismatched type error
```

<a id="items.枚举.variant-visibility"></a>
## 变体可见性

枚举变体在语法上允许使用 [Visibility] 注释，但在验证枚举时会被拒绝。这使得不同上下文中的项能够使用统一的语法进行解析。

```rust
macro_rules! mac_variant {
    ($vis:vis $name:ident) => {
        enum $name {
            $vis Unit,

            $vis Tuple(u8, u16),

            $vis Struct { f: u8 },
        }
    }
}

// Empty `vis` is allowed.
mac_variant! { E }

// This is allowed, since it is removed before being validated.
#[cfg(false)]
enum E {
    pub U,
    pub(crate) T(u8),
    pub(super) T { f: String },
}
```

[`C` representation]: ../type-layout.md#the-c-representation
[call expression]: ../expressions/call-expr.md
[constant expression]: ../const_eval.md#constant-expressions
[enumerated type]: ../types/enum.md
[Field-less enums]: #field-less-enum
[never type]: ../types/never.md
[numeric cast]: ../expressions/operator-expr.md#semantics
[path expression]: ../expressions/path-expr.md
[primitive representation]: ../type-layout.md#primitive-representations
[struct expression]: ../expressions/struct-expr.md
[struct]: structs.md
[type namespace]: ../names/namespaces.md
[unit-only]: #unit-only-enum
[use declarations]: use-declarations.md
[value namespace]: ../names/namespaces.md
