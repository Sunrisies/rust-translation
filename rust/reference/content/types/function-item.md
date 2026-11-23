<a id="type.fn-item"></a>
# 函数项类型

<a id="type.fn-item.intro"></a> 当引用一个函数项或类似元组结构或枚举变体的构造函数时，它将产生其[零大小]的[函数项类型]值。

<a id="type.fn-item.unique"></a> 该类型明确标识了函数——包括其名称、类型参数以及早期绑定生命周期参数（但不包含晚期绑定生命周期参数，后者仅在调用函数时赋值）——因此该值不需要包含实际的函数指针，在调用函数时也不需要任何间接性。

<a id="type.fn-item.name"></a> 没有直接引用函数项类型的语法，但编译器会在错误消息中显示类似`fn(u32) -> i32 {fn_name}`这样的类型信息。

由于函数项类型明确标识了函数，不同函数的项类型——不同的项或相同的项具有不同的泛型——是独立的，混合使用它们会导致类型错误：

```rust,compile_fail,E0308
fn foo<T>() { }
let x = &mut foo::<i32>;
*x = foo::<u32>; //~ ERROR mismatched types
```

<a id="type.fn-item.coercion"></a> 然而，存在从函数项到具有相同签名的[函数指针]的[强制转换]，这种转换不仅在直接期望函数指针而使用函数项时触发，也在相同`if`或`match`语句的不同分支中遇到具有相同签名的不同函数项类型时触发：

```rust
# let want_i32 = false;
# fn foo<T>() { }

// `foo_ptr_1` has function pointer type `fn()` here
let foo_ptr_1: fn() = foo::<i32>;

// ... and so does `foo_ptr_2` - this type-checks.
let foo_ptr_2 = if want_i32 {
    foo::<i32>
} else {
    foo::<u32>
};
```

<a id="type.fn-item.traits"></a> 所有函数项都实现了 [`Copy`][`Clone`][`Send`][`Sync]`。

[`Fn`][`FnMut`][`FnOnce`]等类型会被实现，除非该函数具有以下任何特性：

- 一个[unsafefn]限定符 - 一个[target_feature]属性[attributes.codegen.target_feature] - 除了`"Rust"`之外的[ABI][items.fn.extern]其他类型

[zero-sized]: glossary.zst

[`Clone`]: ../special-types-and-traits.md#clone
[`Copy`]: ../special-types-and-traits.md#copy
[`Send`]: ../special-types-and-traits.md#send
[`Sync`]: ../special-types-and-traits.md#sync
[coercion]: ../type-coercions.md
[function pointers]: function-pointer.md
