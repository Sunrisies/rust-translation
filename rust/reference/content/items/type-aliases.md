<a id="items.type"></a>
# 类型别名

<a id="items.type.syntax"></a> 
```grammar,items
TypeAlias ->
    `type` IDENTIFIER GenericParams? ( `:` Bounds? )?
        WhereClause?
        ( `=` Type WhereClause?)? `;`
```

<a id="items.type.intro"></a> 类型别名为模块或块中的[类型命名空间]内现有的[类型]定义一个新的名称。使用关键字 `type` 来声明类型别名。每个值都有单一且特定的类型，但可能实现多种不同的特性，并且可能与多种不同的类型约束兼容。

例如，以下将类型 `Point` 定义为 `(u8, u8)` 的同义词，`(u8, u8)` 是无符号 8 位整数对的类型：

```rust
type Point = (u8, u8);
let p: Point = (41, 68);
```

<a id="items.type.constructor-alias"></a> 用于元组-结构或单元-结构的类型别名不能用来限定该类型的构造函数：

```rust,compile_fail
struct MyStruct(u32);

use MyStruct as UseAlias;
type TypeAlias = MyStruct;

let _ = UseAlias(5); // OK
let _ = TypeAlias(5); // Doesn't work
```

<a id="items.type.associated-type"></a> 当不作为[关联类型]使用时，类型别名必须包含[类型][语法类型]，且不得包含[边界值]。

<a id="items.type.associated-trait"></a> 当作为[关联类型]用于[特质]时，类型别名不得包含[类型][语法类型]规范，但可以包含[边界值]。

<a id="items.type.associated-实现"></a> 当作为[关联类型]用于[特质实现]时，类型别名必须包含[类型][语法类型]规范，且不得包含[边界值]。

<a id="items.type.deprecated"></a> [trait 实现]中类型别名的等于号前的where子句（如 `type TypeAlias<T> where T: Foo = Bar<T>`）已弃用。等于号后的where子句（如 `type TypeAlias<T> = Bar<T> where T: Foo`）更受推荐。

[associated type]: associated-items.md#associated-types
[trait impl]: implementations.md#trait-implementations
[trait]: traits.md
[type namespace]: ../names/namespaces.md
[type]: ../types.md
