<a id="type.结构体"></a>
# 结构体类型

<a id="type.结构体.intro"></a> `struct` *类型* 是其他类型的异构组合，称为该类型的 *字段*。[^structtype]

<a id="type.结构体.constructor"></a> 可以通过 [结构体表达式] 构造新的 `struct` 实例。

<a id="type.结构体.layout"></a> `struct` 的内存布局默认是未定义的，以便编译器进行诸如字段重排序之类的优化，但可以通过 [`repr` 属性] 来指定。无论哪种情况，在对应的结构体 *表达式* 中，字段可以按任意顺序排列；生成的 `struct` 值始终具有相同的内存布局。

<a id="type.结构体.field-visibility"></a> `struct` 的字段可以通过 [可见性修饰符] 进行限定，从而允许在模块之外访问该结构中的数据。

<a id="type.结构体.tuple"></a> _元组结构体* 类型与结构体类型类似，不同之处在于其字段是匿名的。

<a id="type.结构体.unit"></a> _类似单元的结构* 类型与结构体类型类似，不同之处在于它没有字段。由相关的 [结构体表达式] 构造的唯一值就是该类型的唯一值。

[`repr` attribute]: ../type-layout.md#representations
[struct expression]: ../expressions/struct-expr.md
[visibility modifiers]: ../visibility-and-privacy.md
