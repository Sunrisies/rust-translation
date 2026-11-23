<a id="expr.结构体"></a>
# 结构体表达式

<a id="expr.结构体.syntax"></a> 
```grammar,expressions
StructExpression ->
    PathInExpression `{` (StructExprFields | StructBase)? `}`

StructExprFields ->
    StructExprField (`,` StructExprField)* (`,` StructBase | `,`?)

StructExprField ->
    OuterAttribute*
    (
        IDENTIFIER
      | (IDENTIFIER | TUPLE_INDEX) `:` Expression
    )

StructBase -> `..` Expression
```

<a id="expr.结构体.intro"></a> 一个 *结构体表达式* 用于创建结构体、枚举或联合值。它包含对 [结构体]、[枚举变体] 或 [联合] 项的路径，后跟该项字段的值。

以下是结构体表达式的示例：

```rust
# struct Point { x: f64, y: f64 }
# struct NothingInMe { }
# mod game { pub struct User<'a> { pub name: &'a str, pub age: u32, pub score: usize } }
# enum Enum { Variant {} }
Point {x: 10.0, y: 20.0};
NothingInMe {};
let u = game::User {name: "Joe", age: 35, score: 100_000};
Enum::Variant {};
```

> [!NOTE]
> Tuple structs and tuple enum variants are typically instantiated using a [call expression][expr.call] referring to the [constructor in the value namespace][items.struct.tuple]. These are distinct from a struct expression using curly braces referring to the constructor in the type namespace.
>
> ```rust
> struct Position(i32, i32, i32);
> Position(0, 0, 0);  // Typical way of creating a tuple struct.
> let c = Position;  // `c` is a function that takes 3 arguments.
> let pos = c(8, 6, 7);  // Creates a `Position` value.
>
> enum Version { Triple(i32, i32, i32) };
> Version::Triple(0, 0, 0);
> let f = Version::Triple;
> let ver = f(8, 6, 7);
> ```
>
> The last segment of the call path cannot refer to a type alias:
>
> ```rust
> trait Tr { type T; }
> impl<T> Tr for T { type T = T; }
>
> struct Tuple();
> enum Enum { Tuple() }
>
> // <Unit as Tr>::T(); // causes an error -- `::T` is a type, not a value
> <Enum as Tr>::T::Tuple(); // OK
> ```
>
> ----
>
> Unit structs and unit enum variants are typically instantiated using a [path expression][expr.path] referring to the [constant in the value namespace][items.struct.unit].
>
> ```rust
> struct Gamma;
> // Gamma unit value, referring to the const in the value namespace.
> let a = Gamma;
> // Exact same value as `a`, but constructed using a struct expression
> // referring to the type namespace.
> let b = Gamma {};
>
> enum ColorSpace { Oklch }
> let c = ColorSpace::Oklch;
> let d = ColorSpace::Oklch {};
> ```

<a id="expr.结构体.field"></a>
## 字段结构体表达式

<a id="expr.结构体.field.intro"></a> 包含花括号的字段的结构体表达式允许以任意顺序指定每个单独字段的值。字段名与其值之间用冒号分隔。

<a id="expr.结构体.field.union-constraint"></a> [联合] 类型的值只能使用此语法创建，并且必须明确指定一个字段。

<a id="expr.结构体.update"></a>
## 函数式更新语法

<a id="expr.结构体.update.intro"></a> 用于构建结构体类型值的结构体表达式可以以 `..` 语法结束，后跟一个表达式来表示函数式更新。

<a id="expr.结构体.update.base-same-type"></a> 跟随 `..` 的表达式（基础）必须与新形成的结构体具有相同的结构体类型。

<a id="expr.结构体.update.fields"></a> 整个表达式使用指定的字段值，并将剩余字段从基础表达式中移动或复制过来。

<a id="expr.结构体.update.visibility-constraint"></a> 与所有结构体表达式一样，结构体的所有字段必须是 [可见] 的，即使未明确命名。

```rust
# struct Point3d { x: i32, y: i32, z: i32 }
let mut base = Point3d {x: 1, y: 2, z: 3};
let y_ref = &mut base.y;
Point3d {y: 0, z: 10, .. base}; // OK, only base.x is accessed
drop(y_ref);
```

<a id="expr.结构体.brace-restricted-positions"></a> 结构体表达式不能直接用于 [循环] 或 [if] 表达式的开头，也不能用于 [if let] 或 [match] 表达的 [scrutinee]。但是，如果结构体表达式位于其他表达式中，例如括号内，则可以在这些情况下使用。

<a id="expr.结构体.tuple-field"></a> 字段名可以是十进制整数值，用于指定构建元组结构体的索引。这可以与基础结构体结合使用，以填充未指定的剩余索引：

```rust
struct Color(u8, u8, u8);
let c1 = Color(0, 0, 0);  // Typical way of creating a tuple struct.
let c2 = Color{0: 255, 1: 127, 2: 0};  // Specifying fields by index.
let c3 = Color{1: 0, ..c2};  // Fill out all other fields using a base struct.
```

<a id="expr.结构体.field.named"></a>
### 结构体字段初始化简写

在初始化具有命名（而非编号）字段的数据结构（结构体、枚举、联合类型）时，允许将 `fieldname` 写作 `fieldname: fieldname` 的简写形式。这样可以实现更简洁的语法，减少重复代码。例如：

```rust
# struct Point3d { x: i32, y: i32, z: i32 }
# let x = 0;
# let y_value = 0;
# let z = 0;
Point3d { x: x, y: y_value, z: z };
Point3d { x, y: y_value, z };
```

[enum variant]: ../items/enumerations.md
[if let]: if-expr.md#if-let-patterns
[if]: if-expr.md#if-expressions
[loop]: loop-expr.md
[match]: match-expr.md
[parentheses]: grouped-expr.md
[struct]: ../items/structs.md
[union]: ../items/unions.md
[visible]: ../visibility-and-privacy.md
[scrutinee]: ../glossary.md#scrutinee
