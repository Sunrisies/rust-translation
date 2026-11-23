<a id="type.枚举"></a>
# 枚举类型

<a id="type.枚举.intro"></a> 枚举类型是一种名义上的、异质的不相交联合类型，由 [`enum` 项]的名称表示。[^enumtype]

<a id="type.枚举.declaration"></a> [`enum` 项]同时声明了类型以及多个*变体*，每个变体都有独立的名称，其语法类似于结构体、元组结构或单元类结构体。

<a id="type.枚举.constructor"></a> `enum`的新实例可以通过[结构体表达式]来构造。

<a id="type.枚举.value"></a> 任何`enum`值所消耗的内存量取决于其对应`enum`类型中最大的变体以及存储判别式所需的大小。

<a id="type.枚举.name"></a> 枚举类型不能以*结构化的方式*作为类型表示，而必须通过指向 [`enum` 项的命名引用来表示。

[`enum` item]: ../items/enumerations.md
[struct expression]: ../expressions/struct-expr.md
