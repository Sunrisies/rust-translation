<a id="items.union"></a>
# 联合类型

<a id="items.union.syntax"></a> 
```grammar,items
Union ->
    `union` IDENTIFIER GenericParams? WhereClause? `{` StructFields? `}`
```

<a id="items.union.intro"></a> 联合声明使用与结构体声明相同的语法，只是将 `struct` 替换为 `union`。

<a id="items.union.namespace"></a> 联合声明在所在模块或块的 [类型命名空间] 中定义其名称。

```rust
#[repr(C)]
union MyUnion {
    f1: u32,
    f2: f32,
}
```

<a id="items.union.common-storage"></a> 联合类型的关键特性是所有字段共享相同的存储。因此，对联合中某个字段的修改可能会覆盖其他字段，而联合的大小由最大字段的大小决定。

<a id="items.union.field-restrictions"></a> 联合字段类型被限制为以下子集类型：

<a id="items.union.field-copy"></a> - `Copy` 类型

<a id="items.union.field-references"></a> - 引用（`&T` 和 `&mut T`，适用于任意 `T`）

<a id="items.union.field-manually-drop"></a> - `ManuallyDrop<T>`（适用于任意 `T`）

<a id="items.union.field-tuple"></a> - 仅包含允许的联合字段类型的元组和数组

<a id="items.union.drop"></a> 这一限制特别确保联合字段永远不需要被删除。与结构体和枚举类似，可以为联合实现 `impl Drop`，以手动定义其被删除时的行为。

<a id="items.union.fieldless"></a> 没有字段的联合类型不会被编译器接受，但可以被宏接受。

<a id="items.union.init"></a>
## 联合类型的初始化

<a id="items.union.init.intro"></a> 联合类型的值可以使用与结构体类型相同的语法创建，只需指定一个字段：

```rust
# union MyUnion { f1: u32, f2: f32 }
#
let u = MyUnion { f1: 1 };
```

<a id="items.union.init.result"></a> 上述表达式会创建一个 `MyUnion` 类型的值，并使用字段 `f1` 初始化存储。可以通过与结构体字段相同的语法访问该联合。

```rust
# union MyUnion { f1: u32, f2: f32 }
#
# let u = MyUnion { f1: 1 };
let f = unsafe { u.f1 };
```

<a id="items.union.fields"></a>
## 读写联合字段

<a id="items.union.fields.intro"></a> 联合没有“活动字段”的概念。相反，每次访问联合时都将其存储解释为用于访问的字段类型。

<a id="items.union.fields.read"></a> 读取联合字段就是读取该字段类型下的联合位。

<a id="items.union.fields.offset"></a> 字段可能具有非零的偏移量（除非使用 [C 表示法]）；在这种情况下，将读取从字段偏移量开始的比特。

<a id="items.union.fields.validity"></a> 程序员有责任确保数据在字段类型上有效。如果未能做到这一点，将会产生 [未定义行为]。例如，从 [布尔类型] 的字段中读取值 `3` 就是未定义行为。实际上，对具有 [C 表示法] 的联合进行写入后再读取，相当于将写入使用的类型转换为读取使用的类型进行 [`transmute`]。

<a id="items.union.fields.read-safety"></a> 因此，所有对联合字段的读取都必须放在 `unsafe` 块中：

```rust
# union MyUnion { f1: u32, f2: f32 }
# let u = MyUnion { f1: 1 };
#
unsafe {
    let f = u.f1;
}
```

通常，使用联合的代码会提供安全的包装器来封装不安全的联合字段访问。

<a id="items.union.fields.write-safety"></a> 相比之下，对联合字段的写入是安全的，因为它们只是覆盖任意数据，但不会导致未定义行为。（注意，联合字段类型永远没有“丢弃粘合剂”的功能，因此联合字段的写入永远不会隐式地丢弃任何内容。）

<a id="items.union.pattern"></a>
## 联合上的模式匹配

<a id="items.union.pattern.intro"></a> 另一种访问联合字段的方法是使用模式匹配。

<a id="items.union.pattern.one-field"></a> 对联合字段进行模式匹配使用与结构体模式相同的语法，只是模式必须明确指定一个字段。

<a id="items.union.pattern.safety"></a> 由于模式匹配类似于通过特定字段读取联合，因此它也必须放在 `unsafe` 块中。

```rust
# union MyUnion { f1: u32, f2: f32 }
#
fn f(u: MyUnion) {
    unsafe {
        match u {
            MyUnion { f1: 10 } => { println!("ten"); }
            MyUnion { f2 } => { println!("{}", f2); }
        }
    }
}
```

> [!WARNING]
> The order in which the subpatterns of a pattern are tested is not specified. A union field named in a pattern may be read even when the pattern as a whole does not match. Reading a union field is undefined behavior unless it holds a valid value of its type (see [items.union.fields.validity]). Nothing else in the pattern can be relied on to prevent the read.
>
> In particular, when implementing a C-style tagged union, avoid matching the tag and the corresponding union field within a single pattern: the union field may be read even when the tag does not match.
>
> To read a union field only when a condition holds, test the condition and read the field in separate steps whose evaluation order is specified. For a C tagged union, match on the tag first and read the union field within the matched arm:
>
> ```rust
> #[repr(u32)]
> enum Tag { I, F }
>
> #[repr(C)]
> union U {
>     i: i32,
>     f: f32,
> }
>
> #[repr(C)]
> struct Value {
>     tag: Tag,
>     u: U,
> }
>
> fn is_zero(v: Value) -> bool {
>     match v.tag {
>         Tag::I => unsafe { v.u.i == 0 },
>         Tag::F => unsafe { v.u.f == 0.0 },
>     }
> }
> ```

<a id="items.union.ref"></a>
## 对联合字段的引用

<a id="items.union.ref.intro"></a> 由于联合字段共享相同的存储空间，对一个联合中的某个字段获得写入访问权可以赋予对其所有剩余字段的写入访问权。

<a id="items.union.ref.borrow"></a> 必须调整借用检查规则以考虑这一事实。因此，如果一个联合中的某个字段被借用，其所有剩余的字段也会在相同的生命周期内被借用。

```rust,compile_fail
# union MyUnion { f1: u32, f2: f32 }
// ERROR: cannot borrow `u` (via `u.f2`) as mutable more than once at a time
fn test() {
    let mut u = MyUnion { f1: 1 };
    unsafe {
        let b1 = &mut u.f1;
//                    ---- first mutable borrow occurs here (via `u.f1`)
        let b2 = &mut u.f2;
//                    ^^^^ second mutable borrow occurs here (via `u.f2`)
        *b1 = 5;
    }
//  - first borrow ends here
    assert_eq!(unsafe { u.f1 }, 5);
}
```

<a id="items.union.ref.use"></a> 如您所见，在许多方面（布局、安全性和所有权除外），联合类型的行为与结构体完全相同，这主要是因为它们从结构体继承了语法结构。对于 Rust 语言的许多未提及的方面也是如此（例如隐私性、名称解析、类型推断、泛型、特质实现、固有实现、一致性、模式检查等）。

[`transmute`]: std::mem::transmute

[boolean type]: ../types/boolean.md
[the C representation]: ../type-layout.md#reprc-unions
[type namespace]: ../names/namespaces.md
[undefined behavior]: ../behavior-considered-undefined.md
