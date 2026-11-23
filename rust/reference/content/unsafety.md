<a id="safety"></a>
# 不安全代码

<a id="safety.intro"></a> 不安全的操作是指那些可能违反 Rust 静态语义内存安全保证的操作。

<a id="safety.不安全-ops"></a> 以下语言层面特性无法在 Rust 的安全子集中使用：

<a id="safety.不安全-deref"></a> - 对[原始指针]进行解引用。

<a id="safety.不安全-static"></a> - 读取或写入[可变的]或不安全的[外部]静态变量。

<a id="safety.不安全-union-access"></a> - 访问[联合类型]的字段，但不用于赋值。

<a id="safety.不安全-call"></a> - 调用不安全的函数。

<a id="safety.不安全-target-feature-call"></a> - 从没有`target_feature`属性且无法启用相同特性的函数中调用带有`[attributes.codegen.target_feature]`属性的安全函数（参见[attributes.codegen.target_feature.safety-restrictions]）。

<a id="safety.不安全-实现"></a> - 实现不安全的特质。

<a id="safety.不安全-extern"></a> - 声明[extern]块[^extern-2024]。

<a id="safety.不安全-attribute"></a> - 对项目应用不安全属性。

[`extern`]: items/external-blocks.md
[`union`]: items/unions.md
[mutable]: items/static-items.md#mutable-statics
[external]: items/external-blocks.md
[raw pointer]: types/pointer.md
[unsafe trait]: items/traits.md#unsafe-traits
[unsafe attribute]: attributes.md
