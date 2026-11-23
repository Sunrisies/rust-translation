<a id="type.union"></a>
# 联合类型

<a id="type.union.intro"></a> 一种*联合类型*是一种名义上的、异质的C风格联合，由 [`union` 项][item]的名称表示。

<a id="type.union.access"></a> 联合没有“活动字段”的概念。相反，每次访问联合时，联合中的部分内容都会被转换为所访问字段的类型。

<a id="type.union.safety"></a> 由于转换操作可能导致意外或未定义的行为，读取联合字段时必须使用`unsafe`修饰符。

<a id="type.union.constraint"></a> 联合字段类型也被限制在某一类型的子集中，从而确保它们永远不需要被删除。有关更多细节，请参阅[项]文档。

<a id="type.union.layout"></a> `union`的内存布局默认是未定义的（特别是字段不必位于偏移量0处），但可以使用 `#[repr(...)]` 属性来指定布局。

[`Copy`]: ../special-types-and-traits.md#copy
[item]: ../items/unions.md
