<a id="items.结构体"></a>
# 结构体

<a id="items.结构体.syntax"></a> 
```grammar,items
Struct ->
      StructStruct
    | TupleStruct

StructStruct ->
    `struct` IDENTIFIER GenericParams? WhereClause? ( `{` StructFields? `}` | `;` )

TupleStruct ->
    `struct` IDENTIFIER GenericParams? `(` TupleFields? `)` WhereClause? `;`

StructFields -> StructField (`,` StructField)* `,`?

StructField -> OuterAttribute* Visibility? IDENTIFIER `:` Type

TupleFields -> TupleField (`,` TupleField)* `,`?

TupleField -> OuterAttribute* Visibility? Type
```

<a id="items.结构体.intro"></a> 结构体是一种由 `struct` 关键字定义的名义型 [结构体类型]。

<a id="items.结构体.namespace"></a> 结构体声明在模块或块中的 [类型命名空间] 中定义其名称。

一个 `struct` 项及其使用的示例：

```rust
struct Point {x: i32, y: i32}
let p = Point {x: 10, y: 11};
let px: i32 = p.x;
```

<a id="items.结构体.tuple"></a> 元组结构体是一种名义型 [元组类型]，同样由 `struct` 关键字定义。除了定义类型外，它还在 [值命名空间] 中定义了同名构造函数。构造函数是一个可以调用以创建结构体新实例的函数。例如：

```rust
struct Point(i32, i32);
let p = Point(10, 11);
let px: i32 = match p { Point(x, _) => x };
```

<a id="items.结构体.unit"></a> 类似单元的结构体是没有任何字段的结构体，通过完全省略字段列表来定义。这样的结构体隐式地定义了其类型下的同名 [常量]。例如：

```rust
struct Cookie;
let c = [Cookie, Cookie {}, Cookie, Cookie {}];
```

等同于

```rust
struct Cookie {}
const Cookie: Cookie = Cookie {};
let c = [Cookie, Cookie {}, Cookie, Cookie {}];
```

<a id="items.结构体.layout"></a> 结构体的精确内存布局并未指定。可以使用 [`repr` 属性] 来指定特定的布局。

[`repr` attribute]: ../type-layout.md#representations
[constant]: constant-items.md
[struct type]: ../types/struct.md
[tuple type]: ../types/tuple.md
[type namespace]: ../names/namespaces.md
[value namespace]: ../names/namespaces.md
