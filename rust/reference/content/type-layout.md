<a id="layout"></a>
# 类型布局

<a id="layout.intro"></a> 类型的布局包括其大小、对齐方式以及字段的相对偏移量。对于枚举类型，其判别器的布局和解释也是类型布局的一部分。

<a id="layout.guarantees"></a> 类型布局可以在每次编译时更改。我们不会详细记录具体做了什么，而是只记录当前可以保证的内容。

请注意，即使布局相同的类型在跨函数边界传递时也可能有所不同。关于类型的函数调用 ABI 兼容性，请参见 [这里][fn-abi-compatibility]。

<a id="layout.properties"></a>
## 大小和对齐

<a id="layout.properties.intro"></a> 所有值都有对齐方式和大小。

<a id="layout.properties.align"></a> 值的 *对齐* 指定了哪些地址可以存储该值。对齐数为 `n` 的值只能存储在 n 的倍数地址上。例如，对齐数为 2 的值必须存储在偶数地址上，而对齐数为 1 的值可以在任何地址上存储。对齐以字节为单位，至少为 1，且总是 2 的幂。可以通过 [`align_of_val`]函数检查值的对齐情况。

<a id="layout.properties.size"></a> 值的 *大小* 是指包含对齐填充的数组中连续元素之间的字节偏移量。值的大小总是其对齐数的倍数。请注意，某些类型是 [零大小]；0 被认为是任何对齐数的倍数（例如，在某些平台上，类型 `[u16; 0]` 的大小为 0，对齐数为 2）。可以通过 [`size_of_val`]函数检查值的大小。

<a id="layout.properties.sized"></a> 所有值具有相同大小和对齐方式的类型，并且在编译时已知，则实现 [`Sized`] trait，并且可以通过 [`size_of`]和 [`align_of`]函数进行检查。不是 [`Sized`]类型的类型被称为 [动态大小类型]。由于 `Sized` 类型的所有值都具有相同的大小和对齐方式，我们将这些共享的值分别称为类型的大小和类型的对齐。

<a id="layout.primitive"></a>
## 原始数据布局

<a id="layout.primitive.size"></a> 大多数基本类型的尺寸在此表中给出。

| Type              | `size_of::<Type>()`|
|--                 |--                  |
| `bool`            | 1                  |
| `u8` / `i8`       | 1                  |
| `u16` / `i16`     | 2                  |
| `u32` / `i32`     | 4                  |
| `u64` / `i64`     | 8                  |
| `u128` / `i128`   | 16                 |
| `usize` / `isize` | See below          |
| `f32`             | 4                  |
| `f64`             | 8                  |
| `char`            | 4                  |
| `!`               | 0                  |

<a id="layout.primitive.size-minimum"></a> `usize` 和 `isize` 的尺寸足以包含目标平台上的所有地址。例如，在 32 位目标上，这是 4 字节；在 64 位目标上，这是 8 字节。

<a id="layout.primitive.size-align"></a> `usize` 和 `isize` 具有相同的尺寸和对齐方式。

<a id="layout.primitive.platform-specific-alignment"></a> 基本类型的对齐方式因平台而异。在大多数情况下，其对齐方式与尺寸相同，但可能更小。特别是 `i128` 和 `u128` 通常对齐到 4 或 8 字节，尽管它们的尺寸为 16 字节；在许多 32 位平台上，`i64`、`u64` 和 `f64` 仅对齐到 4 字节，而不是 8 字节。

<a id="layout.primitive.integer-alignment"></a> 相同指示尺寸的固定宽度有符号和无符号整数变体之间的对齐方式是相同的——即对于给定尺寸 `N`，`align_of::<uN>() == align_of::<iN>()`。

<a id="layout.pointer"></a>
## 指针和引用布局

<a id="layout.pointer.intro"></a> 指针和引用具有相同的布局。指针或引用的可变性不会改变其布局。

<a id="layout.pointer.thin"></a> 指向有尺寸类型指针的尺寸与 `usize` 相同。

<a id="layout.pointer.unsized"></a> 指向无尺寸类型的指针是有尺寸的。指向无尺寸类型指针的尺寸和对齐方式均保证大于或等于指向有尺寸类型指针的对应值。

> [!NOTE]
> Though you should not rely on this, all pointers to <abbr title="Dynamically Sized Types">DSTs</abbr> are currently twice the size of the size of `usize` and have the same alignment.

<a id="layout.array"></a>
## 数组布局

一个 `[T; N]` 数组的尺寸为 `size_of::<T>() * N`，其对齐方式与 `T` 相同。数组的布局使得零基索引的第 `n` 个元素距离数组起始位置有 `n * size_of::<T>()` 字节的偏移。

<a id="layout.slice"></a>
## 切片布局

切片具有与它们所切片的数组部分相同的布局。

> [!NOTE]
> This is about the raw `[T]` type, not pointers (`&[T]`, `Box<[T]>`, etc.) to slices.

<a id="layout.str"></a>
## `str` 布局

字符串切片是字符的 UTF-8 表示形式，其布局与类型 `[u8]` 的切片相同。引用 `&str` 的布局与引用 `&[u8]` 相同。

<a id="layout.tuple"></a>
## 元组布局

<a id="layout.tuple.def"></a> 元组按照 [`Rust` 表示法][`Rust`]进行布局。

<a id="layout.tuple.unit"></a> 例外情况是单元元组（`()`），它被保证为[零大小类型]，大小为0且对齐方式为1。

<a id="layout.trait-object"></a>
## Trait对象布局

Trait对象具有与Trait对象所指向的值相同的布局。

> [!NOTE]
> This is about the raw trait object types, not pointers (`&dyn Trait`, `Box<dyn Trait>`, etc.) to trait objects.

<a id="layout.闭包"></a>
## Closure布局

Closure没有布局保证。

<a id="layout.repr"></a>
## 表示法

<a id="layout.repr.intro"></a> 所有用户定义的复合类型（`struct`、`enum`和`union`）都有一个*表示法*，用于指定该类型的布局。

<a id="layout.repr.kinds"></a> 一个类型可能的表示法包括：

- [`Rust`]（默认） - [`C`] - [基本表示法] - [`透明`]

<a id="layout.repr.attribute"></a> 通过为类型应用`repr`属性可以更改其表示法。以下示例展示了一个具有`C`表示的结构体。

```rust
#[repr(C)]
struct ThreeInts {
    first: i16,
    second: i8,
    third: i32
}
```

<a id="layout.repr.align-packed"></a> 对齐方式可以通过`align`和`packed`修饰符分别提高或降低，它们会改变属性中指定的表示法。如果未指定表示法，则使用默认表示法。

```rust
// Default representation, alignment lowered to 2.
#[repr(packed(2))]
struct PackedStruct {
    first: i16,
    second: i8,
    third: i32
}

// C representation, alignment raised to 8
#[repr(C, align(8))]
struct AlignedStruct {
    first: i16,
    second: i8,
    third: i32
}
```

> [!NOTE]
> As a consequence of the representation being an attribute on the item, the representation does not depend on generic parameters. Any two types with the same name have the same representation. For example, `Foo<Bar>` and `Foo<Baz>` both have the same representation.

<a id="layout.repr.inter-field"></a> 类型的表示法可以更改字段之间的填充字符，但不会改变字段本身的布局。例如，一个具有`C`表示的结构体包含了一个具有`Rust`表示的`Inner`结构体，这不会改变`Inner`的布局。

<a id="the-default-representation"></a>
<a id="layout.repr.rust"></a>
### `Rust`表示法

<a id="layout.repr.rust.intro"></a> `Rust`表示法是没有`repr`属性的名义类型的默认表示法。通过`repr`属性显式使用此表示法与完全省略该属性是等价的。

<a id="layout.repr.rust.layout"></a> 这种表示法所提供的唯一数据布局保证是确保正确性的所需条件，包括：

 1. 字段的偏移量必须是该字段对齐数的倍数。2. 类型的对齐度至少是其字段的最大对齐度。

<a id="layout.repr.rust.结构体"></a> 对于 [结构体]，进一步保证其字段不重叠。也就是说，这些字段可以按某种顺序排列，其中每个字段的偏移量加上其大小均小于或等于下一个字段的偏移量。这种排序不必与类型声明中指定的字段顺序相同。

请注意，此保证并不意味着字段具有不同的地址：[零尺寸类型] 可能与同一结构体中的其他字段具有相同的地址。

<a id="layout.repr.rust.结构体-zst"></a> 对于没有字段或所有字段均为 [零尺寸] 的 [结构体]，进一步保证这些结构体本身也是 [零尺寸] 的。

<a id="layout.repr.rust.枚举-empty-zst"></a> [枚举](未指定 [基本表示类型])且没有任何变体时，是 [零尺寸] 的。

> [!NOTE]
> Such enums are [uninhabited].

<a id="layout.repr.rust.枚举-结构体-like-zst"></a> 对于具有单个 [字段-结构体类似变体]、单个 [单元-结构体类似变体] 或单个 [元组-结构体类似变体] 的 [枚举](未指定 [基本表示类型])，且该结构体类似对象没有字段或所有字段均为 [零尺寸]，则这些枚举本身也是 [零尺寸] 的。

```rust
# use core::mem::size_of;
enum E1 {
    V {},
}

enum E2 {
    V { f: () },
}

enum E3 {
    V,
}

enum E4 {
    V(),
}

enum E5 {
    V(()),
}

assert_eq!(size_of::<E1>(), 0);
assert_eq!(size_of::<E2>(), 0);
assert_eq!(size_of::<E3>(), 0);
assert_eq!(size_of::<E4>(), 0);
assert_eq!(size_of::<E5>(), 0);
```

<a id="layout.repr.rust.unspecified"></a> 此表示法不提供其他关于数据布局的保证。

<a id="layout.repr.c"></a>
### `C` 表示法

<a id="layout.repr.c.intro"></a> `C` 表示法旨在实现双重用途。一种用途是创建可与 C 语言互操作的类型；另一种用途是创建可以基于数据布局进行操作的类型，例如将值重新解释为不同的类型。

由于这种双重用途，可能会创建出对与 C 编程语言交互无用的类型。

<a id="layout.repr.c.constraint"></a> 此表示法可应用于结构体、联合体和枚举。例外是 [零变体枚举]，对于此类情况，`C` 表示法会导致错误。

<a id="layout.repr.c.结构体"></a>
#### `#[repr(C)]` 结构体

<a id="layout.repr.c.结构体.align"></a> 结构的对齐方式取决于其中最对齐的字段的对齐方式，如果没有任何字段，则采用该对齐方式。

<a id="layout.repr.c.结构体.size-field-offset"></a> 字段的大小和偏移量由以下算法确定。

从当前偏移量为0字节开始。

按照结构中声明顺序处理每个字段，首先确定该字段的大小和对齐方式。如果当前偏移量不是该字段对齐值的倍数，则向当前偏移量添加填充字节，直到成为该字段对齐值的倍数。此时该字段的偏移量即为当前偏移量。然后将当前偏移量增加该字段的大小。

最后，结构的大小为当前偏移量向上取整到最接近结构对齐值的倍数。

以下是算法说明：

```rust
# /// A field of a struct.
# #[derive(Debug)]
struct Field {
    alignment: usize,
    size: usize,
}
# /// Layout of user-defined structs.
# #[derive(Debug)]
struct MockLayout {
#     /// Fields stored in declaration order.
    fields: Vec<Field>,
#     /// Offset of each field from the start of the struct.
    field_offsets: Vec<usize>,
#     /// Overall alignment.
    alignment: usize,
#     /// Overall size.
    size: usize,
}

impl MockLayout {
    /// Returns the amount of padding needed after `offset` to ensure that the
    /// following address will be aligned to `alignment`.
    fn padding_needed_for(offset: usize, alignment: usize) -> usize {
        let misalignment = offset % alignment;
        if misalignment > 0 {
            // Round up to next multiple of `alignment`.
            alignment - misalignment
        } else {
            // Already a multiple of `alignment`.
            0
        }
    }

    /// Fields must be in declaration order. By this point, they have already
    /// had their alignments and sizes calculated.
    pub fn from_fields(fields: Vec<Field>) -> Self {
        // "The alignment of the struct is the alignment of the most-aligned
        // field in it, or one if there are no fields."
        let alignment = fields
            .iter()
            .map(|field| field.alignment)
            .max()
            .unwrap_or(1);

        // "Start with a current offset of 0 bytes."
        let mut current_offset = 0;

        let mut field_offsets = vec![];
        for field in &fields {
            // "If the current offset is not a multiple of the field's
            // alignment, then add padding bytes to the current offset until it
            // is a multiple of the field's alignment."
            current_offset += Self::padding_needed_for(
                current_offset,
                field.alignment
            );

            // "The offset for the field is what the current offset is now."
            field_offsets.push(current_offset);

            // "Then increase the current offset by the size of the field."
            current_offset += field.size;
        }

        // "Finally, the size of the struct is the current offset rounded up to
        // the nearest multiple of the struct's alignment."
        let size = current_offset + Self::padding_needed_for(
            current_offset,
            alignment
        );

        MockLayout { fields, field_offsets, alignment, size }
    }
}
#
# #[repr(C)]
# struct Demo {
#     first: u8,
#     second: u32,
#     third: u64,
# }
# macro_rules! fields {
#     ( $( $t:ty ),+ ) => {
#         vec![
#             $( Field {
#                 alignment: std::mem::align_of::<$t>(),
#                 size: std::mem::size_of::<$t>(),
#             }),+
#         ]
#     }
# }
# let fields = fields![u8, u32, u64];
# let demo_layout = MockLayout::from_fields(fields);
# assert_eq!(std::mem::align_of::<Demo>(), demo_layout.alignment);
# assert_eq!(std::mem::size_of::<Demo>(), demo_layout.size);
```

> [!WARNING]
> This mock implementation uses a naive algorithm that ignores overflow issues for the sake of clarity. To perform memory layout computations in actual code, use [`Layout`].

> [!NOTE]
> This algorithm can produce [zero-sized] structs. In C, an empty struct declaration like `struct Foo { }` is illegal. However, both gcc and clang support options to enable such structs, and assign them size zero. C++, in contrast, gives empty structs a size of 1, unless they are inherited from or they are fields that have the `[[no_unique_address]]` attribute, in which case they do not increase the overall size of the struct.

<a id="layout.repr.c.union"></a>
#### `#[repr(C)]` 联合类型

<a id="layout.repr.c.union.intro"></a> 使用 `#[repr(C)]` 声明的联合类型，其大小和对齐方式与目标平台上的等效C语言联合声明相同。

<a id="layout.repr.c.union.size-align"></a> 该联合类型的大小为其所有字段的最大大小向上取整到其对齐值，对齐方式为其所有字段的最大对齐值。这些最大值可能来自不同的字段。每个字段位于联合开始的字节偏移量0处。

```rust
#[repr(C)]
union Union {
    f1: u16,
    f2: [u8; 4],
}

assert_eq!(std::mem::size_of::<Union>(), 4);  // From f2
assert_eq!(std::mem::align_of::<Union>(), 2); // From f1

assert_eq!(std::mem::offset_of!(Union, f1), 0);
assert_eq!(std::mem::offset_of!(Union, f2), 0);

#[repr(C)]
union SizeRoundedUp {
   a: u32,
   b: [u16; 3],
}

assert_eq!(std::mem::size_of::<SizeRoundedUp>(), 8);  // Size of 6 from b,
                                                      // rounded up to 8 from
                                                      // alignment of a.
assert_eq!(std::mem::align_of::<SizeRoundedUp>(), 4); // From a

assert_eq!(std::mem::offset_of!(SizeRoundedUp, a), 0);
assert_eq!(std::mem::offset_of!(SizeRoundedUp, b), 0);
```

<a id="layout.repr.c.枚举"></a>
#### `#[repr(C)]` 无字段枚举类型

<a id="layout.repr.c.枚举.discriminant"></a> 对于具有 `C` 表示的 [无字段枚举]，其判别值必须全部能够由目标平台C ABI中的 `int` 类型表示，或者全部能够由其 `unsigned int` 类型表示。

> [!NOTE]
> `repr(C)` enums without a primitive representation have discriminant values of type `isize`. See [items.enum.discriminant.type]. The size and alignment are determined from the discriminant values (according to the rule below) *after* they have been cast to `isize`.

> [!NOTE]
> `rustc` accepts enums whose discriminant values do not meet this requirement but lints against them. This will become an error in the future.

<a id="layout.repr.c.枚举.size-align"></a> 具有 `C` 表示的 [无字段枚举] 与其具有相同判别值的C枚举具有相同的大小和对齐方式，且没有固定的底层类型。

```rust
# use core::ffi::c_int;
# use core::mem::{align_of, size_of};
#[repr(C)]
enum E {
    V1,
    V2,
}

#[cfg(target_arch = "x86_64")]
{
    assert_eq!(size_of::<E>(), size_of::<c_int>());
    assert_eq!(align_of::<E>(), align_of::<c_int>());
}
```

> [!NOTE]
> The enum representation in C is implementation defined, so this is really a "best guess". In particular, this may be incorrect when the C code of interest is compiled with certain flags.
>
> For maximum portability, prefer setting the size and alignment explicitly using a [primitive representation] on the Rust side and a fixed underlying type (introduced in C23) on the C side.

> [!WARNING]
> There are crucial differences between an `enum` in the C language and Rust's [field-less enums] with this representation. An `enum` in C is mostly a `typedef` plus some named constants; in other words, an object of an `enum` type can hold any integer value. For example, this is often used for bitflags in `C`. In contrast, Rust’s [field-less enums] can only legally hold the discriminant values, everything else is [undefined behavior]. Therefore, using a field-less enum in FFI to model a C `enum` is often wrong.

<a id="layout.repr.c.adt"></a>
#### `#[repr(C)]` 带字段的枚举类型

<a id="layout.repr.c.adt.intro"></a> 带有字段的 `repr(C)` 枚举的表示形式是一个包含两个字段的 `repr(C)` 结构，在C语言中也称为“标记联合”。

<a id="layout.repr.c.adt.tag"></a> - 一个删除了所有字段的 `repr(C)` 版本枚举（“标签”）

<a id="layout.repr.c.adt.fields"></a> - 一个 `repr(C)` 联合，由包含各变体字段的 `repr(C)` 结构体组成（“有效载荷”）

> [!NOTE]
> Due to the representation of `repr(C)` structs and unions, if a variant has a single field there is no difference between putting that field directly in the union or wrapping it in a struct; any system which wishes to manipulate such an `enum`'s representation may therefore use whichever form is more convenient or consistent for them.

```rust
// This Enum has the same representation as ...
#[repr(C)]
enum MyEnum {
    A(u32),
    B(f32, u64),
    C { x: u32, y: u8 },
    D,
 }

// ... this struct.
#[repr(C)]
struct MyEnumRepr {
    tag: MyEnumDiscriminant,
    payload: MyEnumFields,
}

// This is the discriminant enum.
#[repr(C)]
enum MyEnumDiscriminant { A, B, C, D }

// This is the variant union.
#[repr(C)]
union MyEnumFields {
    A: MyAFields,
    B: MyBFields,
    C: MyCFields,
    D: MyDFields,
}

#[repr(C)]
#[derive(Copy, Clone)]
struct MyAFields(u32);

#[repr(C)]
#[derive(Copy, Clone)]
struct MyBFields(f32, u64);

#[repr(C)]
#[derive(Copy, Clone)]
struct MyCFields { x: u32, y: u8 }

// This struct could be omitted (it is a zero-sized type), and it must be in
// C/C++ headers.
#[repr(C)]
#[derive(Copy, Clone)]
struct MyDFields;
```

<a id="layout.repr.primitive"></a>
### 基本类型表示

<a id="layout.repr.primitive.intro"></a> *基本类型表示* 是指与基本整数类型具有相同名称的表示形式。即：`u8`、`u16`、`u32`、`u64`、`u128`、`usize`、`i8`、`i16`、`i32`、`i64`、`i128` 和 `isize`。

<a id="layout.repr.primitive.constraint"></a> 基本类型表示只能应用于枚举，并且当枚举有字段时与没有字段时行为不同。对于 [零变体枚举]，拥有基本类型表示是一个错误。将两个基本类型表示合并在一起也是错误的。

<a id="layout.repr.primitive.枚举"></a>
#### 无字段枚举的基本类型表示

具有基本类型表示的 [无字段枚举] 具有与相同名称的基本类型相同的大小和对齐方式。

> [!NOTE]
> Enums with a primitive representation have discriminant values of the type named by the representation. See [items.enum.discriminant.type-primitive].

<a id="layout.repr.primitive.adt"></a>
#### 有字段枚举的基本类型表示

基本类型表示枚举的表示形式是一个 `repr(C)` 联合，由包含每个带字段变体的 `repr(C)` 结构体组成。该联合中每个结构体的第一个字段是删除了所有字段的枚举（“标签”）的基本类型表示版本，其余字段则是该变体的字段。

> [!NOTE]
> This representation is unchanged if the tag is given its own member in the union, should that make manipulation more clear for you (although to follow the C++ standard the tag member should be wrapped in a `struct`).

> [!NOTE]
> This representation is quite different from `repr(C)` for enums with fields.

```rust
// This enum has the same representation as ...
#[repr(u8)]
enum MyEnum {
    A(u32),
    B(f32, u64),
    C { x: u32, y: u8 },
    D,
 }

// ... this union.
#[repr(C)]
union MyEnumRepr {
    A: MyVariantA,
    B: MyVariantB,
    C: MyVariantC,
    D: MyVariantD,
}

// This is the discriminant enum.
#[repr(u8)]
#[derive(Copy, Clone)]
enum MyEnumDiscriminant { A, B, C, D }

#[repr(C)]
#[derive(Clone, Copy)]
struct MyVariantA(MyEnumDiscriminant, u32);

#[repr(C)]
#[derive(Clone, Copy)]
struct MyVariantB(MyEnumDiscriminant, f32, u64);

#[repr(C)]
#[derive(Clone, Copy)]
struct MyVariantC { tag: MyEnumDiscriminant, x: u32, y: u8 }

#[repr(C)]
#[derive(Clone, Copy)]
struct MyVariantD(MyEnumDiscriminant);
```

<a id="layout.repr.primitive-c"></a>
#### 合并有字段枚举的基本类型表示和 `#[repr(C)]`

对于有字段的枚举，也可以将 `repr(C)` 与基本类型表示（例如 `repr(C, u8)`）结合使用。这通过更改判别枚举的表示形式为所选基本类型来修改 [`repr(C)`]。因此，如果您选择了 `u8` 表示形式，则判别枚举的大小和对齐方式将为 1 字节。

> [!NOTE]
> This means `repr(C, u8)` is quite different from `repr(u8)`!
> The former is a struct with two fields (tag and a union of variants), the latter is a union where each field starts with the tag.

示例中的判别枚举 [之前][`repr(C)`] 随后变为：

```rust
#[repr(C, u8)] // `u8` was added
enum MyEnum {
    A(u32),
    B(f32, u64),
    C { x: u32, y: u8 },
    D,
 }

// ...

#[repr(u8)] // So `u8` is used here instead of `C`
enum MyEnumDiscriminant { A, B, C, D }

// ...
```

例如，使用 `repr(C, u8)` 枚举时无法拥有 257 个唯一的区分符（“标签”），而同一个仅具有 `repr(C)` 属性的枚举则可以无问题地编译通过。

除了使用 `repr(C)` 之外，使用原始表示方式可以将枚举的大小从 `repr(C)` 形式改变：

```rust
#[repr(C)]
enum EnumC {
    Variant0(u8),
    Variant1,
}

#[repr(C, u8)]
enum Enum8 {
    Variant0(u8),
    Variant1,
}

#[repr(C, u16)]
enum Enum16 {
    Variant0(u8),
    Variant1,
}

// The size of the C representation is platform dependent
assert_eq!(std::mem::size_of::<EnumC>(), 8);
// One byte for the discriminant and one byte for the value in Enum8::Variant0
assert_eq!(std::mem::size_of::<Enum8>(), 2);
// Two bytes for the discriminant and one byte for the value in Enum16::Variant0
// plus one byte of padding.
assert_eq!(std::mem::size_of::<Enum16>(), 4);
```


<a id="layout.repr.alignment"></a>
### 对齐修饰符

<a id="layout.repr.alignment.intro"></a> `align` 和 `packed` 修饰符分别用于提高或降低 `struct` 和 `union` 的对齐方式。`packed` 还会改变字段之间的填充情况（尽管它不会改变任何字段内部的填充）。单独使用 `align` 和 `packed` 无法保证 `struct` 的布局或枚举变体的布局中字段的顺序，不过它们可以与提供此类保证的表示方式（如 `C`）结合使用。

<a id="layout.repr.alignment.constraint-alignment"></a> 对齐值以 `#[repr(align(x))]` 或 `#[repr(packed(x))]` 的形式作为整数参数指定。对齐值必须是 1 到 2<sup>29</sup> 之间的2的幂。对于 `packed` 类型，如果未给出值，如 `#[repr(packed)]`，则值为 1。

<a id="layout.repr.alignment.align"></a> 对于 `align` 修饰符，如果指定的对齐方式小于无该修饰符的类型的对齐方式，则对齐不受影响。

<a id="layout.repr.alignment.packed"></a> 对于 `packed` 修饰符，如果指定的对齐方式大于无该修饰符的类型的对齐方式，则对齐和布局不受影响。

<a id="layout.repr.alignment.packed-fields"></a> 为了确定字段的位置，每个字段的对齐方式取指定对齐方式和该字段类型对齐方式的较小值。

<a id="layout.repr.alignment.packed-padding"></a> 字段间填充量被保证为满足每个字段（可能已修改）对齐所需的最小值（不过请注意，`packed` 本身并不提供关于字段顺序的任何保证）。这些规则的一个重要结果是，具有 `#[repr(packed(1))]`（或 `#[repr(packed)]`）的类型将没有字段间填充。

<a id="layout.repr.alignment.constraint-exclusive"></a> `align` 和 `packed` 修饰符不能同时应用于同一个类型，且 `packed` 类型的类型不能递归包含另一个 `align` 类型的类型。`align` 和 `packed` 只能应用于 [`Rust`] 和 [`C`] 表示法。

<a id="layout.repr.alignment.枚举"></a> `align` 修饰符也可以应用于 `enum`。当应用该修饰时，对 `enum` 对齐的影响与将 `enum` 包裹在具有相同 `align` 修饰的新的类型 `struct` 中相同。

> [!NOTE]
> References to unaligned fields are not allowed because it is [undefined behavior]. When fields are unaligned due to an alignment modifier, consider the following options for using references and dereferences:
>
> ```rust
> #[repr(packed)]
> struct Packed {
>     f1: u8,
>     f2: u16,
> }
> let mut e = Packed { f1: 1, f2: 2 };
> // Instead of creating a reference to a field, copy the value to a local variable.
> let x = e.f2;
> // Or in situations like `println!` which creates a reference, use braces
> // to change it to a copy of the value.
> println!("{}", {e.f2});
> // Or if you need a pointer, use the unaligned methods for reading and writing
> // instead of dereferencing the pointer directly.
> let ptr: *const u16 = &raw const e.f2;
> let value = unsafe { ptr.read_unaligned() };
> let mut_ptr: *mut u16 = &raw mut e.f2;
> unsafe { mut_ptr.write_unaligned(3) }
> ```

<a id="layout.repr.transparent"></a>
### `transparent` 表示法

<a id="layout.repr.transparent.constraint-field"></a> `transparent` 表示法只能用于具有单一变体的 [`struct`][structs] 或 [`enum'][enumerations]，该变体包含： - 任意数量的大小为 0 且对齐方式为 1 的字段（例如 [`PhantomData<T>`]），以及 - 最多一个其他字段。

<a id="layout.repr.transparent.layout-abi"></a> 具有此表示法的结构体和枚举与唯一的非大小为 0、非对齐方式为 1 的字段（如果存在）或单位类型具有相同的布局和 ABI。

这与 `C` 表示法不同，因为具有 `C` 表示法的结构体总是具有 `C` 结构体的 ABI，而例如具有 `transparent` 表示法的结构体如果包含原始类型字段，则具有该原始类型字段的 ABI。

<a id="layout.repr.transparent.constraint-exclusive"></a> 由于此表示法将类型布局委托给其他类型，因此不能与其他任何表示法一起使用。

[`align_of_val`]: std::mem::align_of_val
[`size_of_val`]: std::mem::size_of_val
[`align_of`]: std::mem::align_of
[`size_of`]: std::mem::size_of
[`Sized`]: std::marker::Sized
[`Copy`]: std::marker::Copy
[field-less enum]: items.enum.fieldless
[field-struct-like variant]: EnumVariantStruct
[zero sized]: glossary.zst
[zero-sized]: glossary.zst
[zero-sized type]: glossary.zst
[zero-sized types]: glossary.zst
[tuple-struct-like variant]: EnumVariantTuple
[unit-struct-like variant]: EnumVariant
[`Layout`]: std::alloc::Layout
[uninhabited]: glossary.uninhabited

[`repr(C)`]: #reprc-enums-with-fields
[dynamically sized types]: dynamically-sized-types.md
[enums]: items/enumerations.md
[field-less enums]: items/enumerations.md#field-less-enum
[fn-abi-compatibility]: ../core/primitive.fn.md#abi-compatibility
[enumerations]: items/enumerations.md
[zero-variant enums]: items/enumerations.md#zero-variant-enums
[undefined behavior]: behavior-considered-undefined.md
[`PhantomData<T>`]: special-types-and-traits.md#phantomdatat
[`Rust`]: #the-rust-representation
[`C`]: #the-c-representation
[primitive representation]: #primitive-representations
[primitive representations]: #primitive-representations
[structs]: items/structs.md
[`transparent`]: #the-transparent-representation
