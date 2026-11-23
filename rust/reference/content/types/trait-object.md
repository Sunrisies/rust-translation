<a id="type.trait-object"></a>
# 特质对象

<a id="type.trait-object.syntax"></a> 
```grammar,types
TraitObjectType -> Bounds[^bare-2021] | `dyn`[^dyn-2018] Bounds?

TraitObjectTypeOneBound -> TraitBound[^bare-2021] | `dyn`[^dyn-2018] TraitBound?
```


<a id="type.trait-object.intro"></a> *特质对象*是一种不透明的数值，它属于另一种类型并实现了一组特质。该组特质由一个 [dyn compatible] *基础特质*和任意数量的 [auto traits] 组成。

<a id="type.trait-object.impls"></a> 特质对象实现了基础特质、其 auto traits以及基础特质的任何 [supertraits]。

<a id="type.trait-object.bounds"></a> 必须至少有一个特质边界，不能有超过一个非 auto trait，也不能有超过一个生命周期，此外不允许可选边界（例如 `?Sized`）和 `use<..>` 边界。

例如，对于一个名为 `Trait` 的特质，以下都是特质对象：

* `dyn Trait` * `dyn Trait + Send` * `dyn Trait + Send + Sync` * `dyn Trait + 'static` * `dyn Trait + Send + 'static` * `dyn Trait +` * `dyn 'static + Trait`。* `dyn (Trait)`

<a id="type.trait-object.syntax-edition2021"></a> > [!EDITION-2021] > 在 2021 版之前，可以省略 `dyn` 关键字。而在 2021 版及以后，`dyn` 关键字在语义上必须保留。

<a id="type.trait-object.syntax-edition2018"></a> > [!EDITION-2018] > 在 2015 版中，`dyn` 后面必须跟随 [PathIdentSegment}、[LIFETIME_TOKEN}、`for`、`(` 或 `?`，以作为关键字而非普通标识符。> > 最值得注意的是，`dyn`、`dyn::T` 和 `dyn<T` 都将被视为类型路径。因此，如果您想要一个具有特质 `::module::Trait` 的特质对象类型，则需要将路径放在括号内并写作 `dyn (::module::Trait)`。> > 从 2018 版开始，`dyn` 成为一个真正的关键字，不允许出现在路径中，因此不需要使用括号。

<a id="type.trait-object.alias"></a> 如果两个基础特质相互别名，且 auto traits 集合相同且生命周期边界也相同，则两个特质对象类型可以互相别名。例如，`dyn Trait + Send + UnwindSafe` 与 `dyn Trait + UnwindSafe + Send` 是相同的。

<a id="type.trait-object.unsized"></a> 由于 trait 对象所包含的值的具体类型不可见，因此属于[动态大小类型]。与所有 <abbr title="动态大小类型">DSTs</abbr> 一样，trait 对象通过某种指针形式使用；例如 `&dyn SomeTrait` 或 `Box<dyn SomeTrait>`。指向 trait 对象的每个指针实例包含：

 - 一个指向实现了 `SomeTrait` 的类型 `T` 的实例的指针 - 一个_虚拟方法表_，通常称为_vtable_，其中包含了 `SomeTrait` 及其 `T` 实现的[继承特质]的每个方法的实现（即函数指针）。

trait 对象的目的是允许“延迟绑定”方法。在 trait 对象上调用方法会在运行时进行虚拟分发：也就是说，从 trait 对象的 vtable 中加载函数指针并间接调用。每个 vtable 条目的实际实现可以根据不同对象而有所差异。

trait 对象的示例：

```rust
trait Printable {
    fn stringify(&self) -> String;
}

impl Printable for i32 {
    fn stringify(&self) -> String { self.to_string() }
}

fn print(a: Box<dyn Printable>) {
    println!("{}", a.stringify());
}

fn main() {
    print(Box::new(10) as Box<dyn Printable>);
}
```

在这个示例中，`Printable` trait 作为 trait 对象出现在 `print` 的类型签名和 `main` 的类型转换表达式中。

<a id="type.trait-object.生命周期-bounds"></a>
## trait 对象生命周期限制

由于 trait 对象可以包含引用，这些引用的生命周期需要作为 trait 对象的一部分进行表达。这种生命周期以 `Trait + 'a` 的形式表示。有一些[默认设置]，允许通常能够推断出合理的生命周期选择。

[auto traits]: ../special-types-and-traits.md#auto-traits
[defaults]: ../lifetime-elision.md#default-trait-object-lifetimes
[dyn compatible]: ../items/traits.md#dyn-compatibility
[dynamically sized types]: ../dynamically-sized-types.md
[supertraits]: ../items/traits.md#supertraits
