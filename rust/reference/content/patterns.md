<a id="patterns"></a>
# 模式

<a id="patterns.syntax"></a> 
```grammar,patterns
Pattern -> `|`? PatternNoTopAlt  ( `|` PatternNoTopAlt )*

PatternNoTopAlt ->
      PatternWithoutModernRange
    | ModernRangePattern

PatternWithoutModernRange ->
      LiteralPattern
    | IdentifierPattern
    | WildcardPattern
    | RestPattern
    | ReferencePattern
    | StructPattern
    | TupleStructPattern
    | TuplePattern
    | GroupedPattern
    | SlicePattern
    | PathPattern
    | MacroInvocation
    | ObsoleteRangePattern[^obsolete-range-edition]
```


<a id="patterns.intro"></a> 模式用于根据结构匹配值，并可选地将变量绑定到这些结构中的值。它们也用于变量声明以及函数和闭包的参数。

以下示例中的模式执行了四件事：

* 测试 `person` 是否包含填充了某些内容的 `car` 字段。 * 测试人的 `age` 字段是否在 13 到 19 之间，并将其值绑定到 `person_age` 变量。 * 将 `name` 字段的引用绑定到 `person_name` 变量。 * 忽略 `person` 的其他字段。其余字段可以具有任意值，且不绑定到任何变量。

```rust
# struct Car;
# struct Computer;
# struct Person {
#     name: String,
#     car: Option<Car>,
#     computer: Option<Computer>,
#     age: u8,
# }
# let person = Person {
#     name: String::from("John"),
#     car: Some(Car),
#     computer: None,
#     age: 15,
# };
if let
    Person {
        car: Some(_),
        age: person_age @ 13..=19,
        name: ref person_name,
        ..
    } = person
{
    println!("{} has a car and is {} years old.", person_name, person_age);
}
```

<a id="patterns.use"></a> 模式用于以下场景：

<a id="patterns.let"></a> * [`let` 声明](statements.md#let-statements)

<a id="patterns.param"></a> * [函数](items/functions.md)和[闭包](expressions/闭包-expr.md)参数

<a id="patterns.match"></a> * [`match` 表达式](expressions/match-expr.md)

<a id="patterns.if-let"></a> * [`if let` 表达式](expressions/if-expr.md)

<a id="patterns.while-let"></a> * [`while let` 表达式](expressions/loop-expr.md#while-let-patterns)

<a id="patterns.for"></a> * [`for` 表达式](expressions/loop-expr.md#迭代器-loops)

<a id="patterns.destructure"></a>
## 解构

<a id="patterns.destructure.intro"></a> 模式可用于*解构*[结构][枚举]和[元组]。解构将值拆分为其组成部分。所使用的语法几乎与创建此类值时相同。

<a id="patterns.destructure.wildcard"></a> 在具有 `[scrutinee]` 表达式为 `struct`、`enum` 或 `tuple` 类型的模式中，[通配符模式](#wildcard-pattern) (`_`) 代表*单个*数据字段，而[等等](#grammar-StructPatternEtCetera)或[剩余模式][patterns.rest] (`..`) 则代表特定变体的所有剩余字段。

<a id="patterns.destructure.named-field-shorthand"></a> 当对具有命名（而非编号）字段的数据结构进行解构时，允许将 `fieldname` 作为 `fieldname: fieldname` 的简写形式使用。

```rust
# enum Message {
#     Quit,
#     WriteString(String),
#     Move { x: i32, y: i32 },
#     ChangeColor(u8, u8, u8),
# }
# let message = Message::Quit;
match message {
    Message::Quit => println!("Quit"),
    Message::WriteString(write) => println!("{}", &write),
    Message::Move{ x, y: 0 } => println!("move {} horizontally", x),
    Message::Move{ .. } => println!("other move"),
    Message::ChangeColor { 0: red, 1: green, 2: _ } => {
        println!("color change, red: {}, green: {}", red, green);
    }
};
```

<a id="patterns.refutable"></a>
## 可反驳性

当一个模式有可能不被其匹配的值所匹配时，该模式被称为*可反驳的*。而*不可反驳的*模式则总是能匹配其匹配的值。示例：

```rust
let (x, y) = (1, 2);               // "(x, y)" is an irrefutable pattern

if let (a, 3) = (1, 2) {           // "(a, 3)" is refutable, and will not match
    panic!("Shouldn't reach here");
} else if let (a, 4) = (3, 4) {    // "(a, 4)" is refutable, and will match
    println!("Matched ({}, 4)", a);
}
```

<a id="patterns.literal"></a>
## 字面量模式

<a id="patterns.literal.syntax"></a> 
```grammar,patterns
LiteralPattern -> `-`? LiteralExpression
```

<a id="patterns.literal.intro"></a> _字面量模式_ 会精确匹配由字面量生成的相同值。由于负数不是[字面量]，模式中的字面量可以加上可选的负号前缀，该符号起到否定运算符的作用。

> [!WARNING]
> C string and raw C string literals are accepted in literal patterns, but `&CStr` doesn't implement structural equality (`#[derive(Eq, PartialEq)]`) and therefore any such `match` on a `&CStr` will be rejected with a type error.

<a id="patterns.literal.refutable"></a> 字面量模式总是可反驳的。

Examples:

```rust
for i in -2..5 {
    match i {
        -1 => println!("It's minus one"),
        1 => println!("It's a one"),
        2|4 => println!("It's either a two or a four"),
        _ => println!("Matched none of the arms"),
    }
}
```

<a id="patterns.ident"></a>
## 标识符模式

<a id="patterns.ident.syntax"></a> 
```grammar,patterns
IdentifierPattern -> `ref`? `mut`? IDENTIFIER ( `@` PatternNoTopAlt )?
```

<a id="patterns.ident.intro"></a> 标识符模式将匹配的值绑定到[值命名空间]中的变量。

<a id="patterns.ident.unique"></a> 标识符在模式中必须唯一。

<a id="patterns.ident.scope"></a> 该变量会覆盖同一作用域中同名的其他变量。新绑定的[作用域]取决于模式使用的上下文（例如 `let` 绑定或 `match` 分支）。

<a id="patterns.ident.bare"></a> 仅由标识符组成的模式，可能带有 `mut` 标志，可以匹配任何值并将其绑定到该标识符。这是变量声明以及函数和闭包参数中最常用的模式类型。

```rust
let mut variable = 10;
fn sum(x: i32, y: i32) -> i32 {
#    x + y
# }
```

<a id="patterns.ident.scrutinized"></a> 要将模式的匹配值绑定到变量，请使用语法 `variable @ subpattern`。例如，以下方式将值 2 绑定到 `e`（并非整个范围：这里的范围是范围子模式）。

```rust
let x = 2;

match x {
    e @ 1 ..= 5 => println!("got a range element {}", e),
    _ => println!("anything"),
}
```

<a id="patterns.ident.move"></a> 默认情况下，标识符模式根据匹配值是否实现了 [`Copy`]机制，将变量绑定到匹配值的副本或移动后的值。

<a id="patterns.ident.ref"></a> 可以通过使用 `ref` 关键字将其改为绑定到引用，或者使用 `ref mut` 将其改为绑定到可修改的引用。例如：

```rust
# let a = Some(10);
match a {
    None => (),
    Some(value) => (),
}

match a {
    None => (),
    Some(ref value) => (),
}
```

在第一个匹配表达式中，值会被复制（或移动）。而在第二个匹配中，同一个内存位置的引用被绑定到变量值上。这种语法是必要的，因为在解构子模式中无法对值的字段应用 `&` 运算符。例如，以下写法是不合法的：

```rust,compile_fail
# struct Person {
#    name: String,
#    age: u8,
# }
# let value = Person { name: String::from("John"), age: 23 };
if let Person { name: &person_name, age: 18..=150 } = value { }
```

为了使其合法，应写成如下方式：

```rust
# struct Person {
#    name: String,
#    age: u8,
# }
# let value = Person { name: String::from("John"), age: 23 };
if let Person { name: ref person_name, age: 18..=150 } = value { }
```

<a id="patterns.ident.ref-ignored"></a> 因此，`ref` 并不是用于匹配的对象。它的目的仅仅是将匹配的结果变为引用形式，而不是可能复制或移动所匹配的内容。

<a id="patterns.ident.precedent"></a> [路径模式](#path-patterns) 优先于标识符模式。

> [!NOTE]
> When a pattern is a single-segment identifier, the grammar is ambiguous whether it means an [IdentifierPattern] or a [PathPattern]. This ambiguity can only be resolved after [name resolution].
>
> ```rust
> const EXPECTED_VALUE: u8 = 42;
> //    ^^^^^^^^^^^^^^ That this constant is in scope affects how the
> //                   patterns below are treated.
>
> fn check_value(x: u8) -> Result<u8, u8> {
>     match x {
>         EXPECTED_VALUE => Ok(x),
>     //  ^^^^^^^^^^^^^^ Parsed as a `PathPattern` that resolves to
>     //                 the constant `42`.
>         other_value => Err(x),
>     //  ^^^^^^^^^^^ Parsed as an `IdentifierPattern`.
>     }
> }
>
> // If `EXPECTED_VALUE` were treated as an `IdentifierPattern` above,
> // that pattern would always match, making the function always return
> // `Ok(_) regardless of the input.
> assert_eq!(check_value(42), Ok(42));
> assert_eq!(check_value(43), Err(43));
> ```

<a id="patterns.ident.constraint"></a> 如果指定了 `ref` 或 `ref mut`，而标识符却遮蔽了常量，则属于错误。

<a id="patterns.ident.refutable"></a> 如果 `@` 子模式不可引用，或者没有指定该子模式，那么标识符模式就是不可引用的。

<a id="patterns.ident.binding"></a>
### 绑定模式

<a id="patterns.ident.binding.intro"></a> 为了更好的人体工程学设计，模式在不同的*绑定模式*下运行，以便更容易将引用绑定到值上。当非引用模式匹配到一个引用值时，它会自动被视为 `ref` 或 `ref mut` 绑定。例如：

```rust
let x: &Option<i32> = &Some(3);
if let Some(y) = x {
    // y was converted to `ref y` and its type is &i32
}
```

<a id="patterns.ident.binding.non-reference"></a> *非引用模式*包括所有非绑定模式、[通配符模式](#wildcard-pattern)（`_`）、参考类型的 [`const` 模式](#constant-patterns)以及[引用模式](#reference-patterns)。

<a id="patterns.ident.binding.default-mode"></a> 如果绑定模式没有明确指定 `ref`、`ref mut` 或 `mut`，则使用*默认绑定模式*来确定变量如何被绑定。

<a id="patterns.ident.binding.move"></a> 默认绑定模式起始于“移动”模式，该模式使用移动语义。

<a id="patterns.ident.binding.top-down"></a> 在匹配模式时，编译器从模式的外部开始，向内部进行工作。

<a id="patterns.ident.binding.auto-deref"></a> 每当使用非引用模式匹配引用时，系统会自动解引用值并更新默认绑定模式。

<a id="patterns.ident.binding.ref"></a> 引用会将默认绑定模式设置为 `ref`。

<a id="patterns.ident.binding.ref-mut"></a> 可变的引用将把模式设置为 `ref mut`，除非当前已经是 `ref` 模式，此时则保持为 `ref`。

<a id="patterns.ident.binding.nested-references"></a> 如果自动解引用后的值仍然是引用，则会再次进行解引用，此过程会重复。

<a id="patterns.ident.binding.mode-limitations-binding"></a> 绑定模式只能明确指定 `ref` 或 `ref mut` 绑定模式，或者当默认绑定模式为“move”时通过 `mut` 指定可变性。例如，以下方式是不被接受的：

```rust,edition2024,compile_fail
let [mut x] = &[()]; //~ ERROR
let [ref x] = &[()]; //~ ERROR
let [ref mut x] = &mut [()]; //~ ERROR
```

<a id="patterns.ident.binding.mode-limitations-binding-edition2024"></a> 
> [!EDITION-2024]
> Before the 2024 edition, bindings could explicitly specify a `ref` or `ref mut` binding mode even when the default binding mode was not "move", and they could specify mutability on such bindings with `mut`. In these editions, specifying `mut` on a binding set the binding mode to "move" regardless of the current default binding mode.

<a id="patterns.ident.binding.mode-limitations-reference"></a> 同样，引用模式也只能在默认绑定模式为“move”时出现。例如，以下方式也不被接受：

```rust,edition2024,compile_fail
let [&x] = &[&()]; //~ ERROR
```

<a id="patterns.ident.binding.mode-limitations-reference-edition2024"></a> 
> [!EDITION-2024]
> Before the 2024 edition, reference patterns could appear even when the default binding mode was not "move", and had both the effect of matching against the scrutinee and of causing the default binding mode to be reset to "move".

<a id="patterns.ident.binding.mixed"></a> 移动绑定和引用绑定可以在同一模式中混合使用。但这样做会导致被绑定的对象发生部分移动，之后无法继续使用该对象。这仅适用于无法复制的类型。

在下面的示例中，`name` 从 `person` 中被移动出去。试图整体使用 `person` 或使用 `person.name` 将会导致错误，因为发生了*部分移动*。

Example:

```rust
# struct Person {
#    name: String,
#    age: u8,
# }
# let person = Person{ name: String::from("John"), age: 23 };
// `name` is moved from person and `age` referenced
let Person { name, ref age } = person;
```

<a id="patterns.wildcard"></a>
## 通配符模式

<a id="patterns.wildcard.syntax"></a> 
```grammar,patterns
WildcardPattern -> `_`
```

<a id="patterns.wildcard.intro"></a> _通配符模式_（下划线符号）可以匹配任何值。它用于忽略无关的值。

<a id="patterns.wildcard.结构体-matcher"></a> 在其他模式中，它匹配单个数据字段（与 `..` 不同，`..` 匹配剩余字段）。

<a id="patterns.wildcard.no-binding"></a> 与标识符模式不同，通配符模式不会复制、移动或借用它所匹配的值。

Examples:

```rust
# let x = 20;
let (a, _) = (10, x);   // the x is always matched by _
# assert_eq!(a, 10);

// ignore a function/closure param
let real_part = |a: f64, _: f64| { a };

// ignore a field from a struct
# struct RGBA {
#    r: f32,
#    g: f32,
#    b: f32,
#    a: f32,
# }
# let color = RGBA{r: 0.4, g: 0.1, b: 0.9, a: 0.5};
let RGBA{r: red, g: green, b: blue, a: _} = color;
# assert_eq!(color.r, red);
# assert_eq!(color.g, green);
# assert_eq!(color.b, blue);

// accept any Some, with any value
# let x = Some(10);
if let Some(_) = x {}
```

<a id="patterns.wildcard.refutable"></a> 通配符模式始终是不可反推的。

<a id="patterns.rest"></a>
## 剩余模式

<a id="patterns.rest.syntax"></a> 
```grammar,patterns
RestPattern -> `..`
```

<a id="patterns.rest.intro"></a> _剩余模式_（`..` 标记）充当一种可变长度模式，可以匹配零个或多个尚未被之前或之后匹配过的元素。

<a id="patterns.rest.allowed-patterns"></a> 它只能用于 [tuple](#tuple-patterns)、[tuple 结构体](#tuple-结构体-patterns) 和 [slice](#slice-patterns) 模式中，并且在这些模式中只能出现一次作为其中一个元素。它也允许出现在 [identifier pattern](#identifier-patterns) 中，仅用于 [slice patterns](#slice-patterns)。

<a id="patterns.rest.refutable"></a> 剩余模式始终是不可反推的。

Examples:

```rust
# let words = vec!["a", "b", "c"];
# let slice = &words[..];
match slice {
    [] => println!("slice is empty"),
    [one] => println!("single element {}", one),
    [head, tail @ ..] => println!("head={} tail={:?}", head, tail),
}

match slice {
    // Ignore everything but the last element, which must be "!".
    [.., "!"] => println!("!!!"),

    // `start` is a slice of everything except the last element, which must be "z".
    [start @ .., "z"] => println!("starts with: {:?}", start),

    // `end` is a slice of everything but the first element, which must be "a".
    ["a", end @ ..] => println!("ends with: {:?}", end),

    // 'whole' is the entire slice and `last` is the final element
    whole @ [.., last] => println!("the last element of {:?} is {}", whole, last),

    rest => println!("{:?}", rest),
}

if let [.., penultimate, _] = slice {
    println!("next to last is {}", penultimate);
}

# let tuple = (1, 2, 3, 4, 5);
// The rest pattern may also be used in tuple and tuple
// struct patterns.
match tuple {
    (1, .., y, z) => println!("y={} z={}", y, z),
    (.., 5) => println!("tail must be 5"),
    (..) => println!("matches everything else"),
}
```

<a id="patterns.range"></a>
## 范围模式

<a id="patterns.range.syntax"></a> 
```grammar,patterns
ModernRangePattern ->
      RangeExclusivePattern
    | RangeInclusivePattern
    | RangeFromPattern
    | RangeToExclusivePattern
    | RangeToInclusivePattern

RangeExclusivePattern ->
      RangePatternBound `..` RangePatternBound

RangeInclusivePattern ->
      RangePatternBound `..=` RangePatternBound

RangeFromPattern ->
      RangePatternBound `..`

RangeToExclusivePattern ->
      `..` RangePatternBound

RangeToInclusivePattern ->
      `..=` RangePatternBound

ObsoleteRangePattern ->
    RangePatternBound `...` RangePatternBound

RangePatternBound ->
      LiteralPattern
    | PathExpression
```

<a id="patterns.range.intro"></a> *范围模式* 匹配由边界定义的范围内的标量值。它们由一个 *符号*（`..` 或 `..=`）和一侧或两侧的边界组成。

符号左侧的边界称为 *下界*。右侧的边界称为 *上界*。

<a id="patterns.range.exclusive"></a> *排他性范围模式* 匹配从下界到上界但不包括上界的全部值。其写法为下界，后跟 `..`，再后跟上界。

例如，模式 `'m'..'p'` 将仅匹配 `'m'`、`'n'` 和 `'o'，特别是不包括 `'p'`。

<a id="patterns.range.inclusive"></a> *包含性范围模式* 匹配从下界到上界包括上界的全部值。其写法为下界，后跟 `..=`，再后跟上界。

例如，模式 `'m'..='p'` 将仅匹配值 `'m'`、`'n'`、`'o'` 和 `'p'`。

<a id="patterns.range.from"></a> *从范围模式* 匹配大于或等于下界的全部值。其写法为下界后跟 `..`。

例如，`1..` 将匹配任何大于或等于 1 的整数，如 1、9 或 9001，或者 9007199254740991（如果具有适当的大小），但不会匹配 0，对于有符号整数的负数也不会匹配。

<a id="patterns.range.to-exclusive"></a> *to exclusive range 模式* 匹配所有小于上界的值。其格式为 `..` 后跟上界值。

例如，`..10` 将匹配所有小于 10 的整数，如 9、1、0；对于有符号整数类型，则匹配所有负值。

<a id="patterns.range.to-inclusive"></a> *to inclusive range 模式* 匹配所有小于等于上界的值。其格式为 `..=` 后跟上界值。

例如，`..=10` 将匹配所有小于等于 10 的整数，如 10、1、0；对于有符号整数类型，则匹配所有负值。

<a id="patterns.range.constraint-nonempty"></a> 范围模式必须非空；它必须在其类型的可能值集中至少包含一个值。换句话说： * 在 `a..=b` 中，`a &le; b` 必须是成立的。例如，使用范围模式 `10..=0` 是错误的，但 `10..=10` 是允许的。 * 在 `a..b` 中，`a < b` 必须是成立的。例如，使用范围模式 `10..0` 或 `10..10` 是错误的。 * 在 `..b` 中，b 不得是其类型的最小值。例如，使用范围模式 `..-128i8` 或 `..f64::NEG_INFINITY` 是错误的。

* 在 `a..=b` 中，`a &le; b` 必须是成立的。例如，使用范围模式 `10..=0` 是错误的，但 `10..=10` 是允许的。 * 在 `a..b` 中，`a < b` 必须是成立的。例如，使用范围模式 `10..0` 或 `10..10` 是错误的。 * 在 `..b` 中，b 不得是其类型的最小值。例如，使用范围模式 `..-128i8` 或 `..f64::NEG_INFINITY` 是错误的。

<a id="patterns.range.bound"></a> 界限的写法包括以下几种：

* 字符、字节、整数或浮点数字面量。 * `-` 后跟一个整数或浮点数字面量。 * [路径]。

> [!NOTE]
>
> We syntactically accept more than this for a *[RangePatternBound]*. We later reject the other things semantically.

<a id="patterns.range.constraint-bound-path"></a> 如果界限以路径形式书写，在宏解析后，该路径必须解析为 `char`、`整数类型` 或 `浮点类型` 的常量项。

<a id="patterns.range.type"></a> 范围模式与其上下界的类型相同，且两者必须是同一类型。

<a id="patterns.range.path-value"></a> 如果界限是 [路径]，则界限匹配该类型的类型，并具有该路径解析得到的 [常量值]。

<a id="patterns.range.literal-value"></a> 如果界限是字面量，则界限匹配该类型的类型，并具有相应的 [字面表达式] 的值。

<a id="patterns.range.negation"></a> 如果边界是一个以 `-` 开头的字面量，则该边界与相应的[字面量表达式]具有相同的类型，其值为该字面量表达式值的[负反义词]值。

<a id="patterns.range.float-restriction"></a> 对于浮点数范围模式，常量不得为 `NaN`。

Examples:

```rust
# let c = 'f';
let valid_variable = match c {
    'a'..='z' => true,
    'A'..='Z' => true,
    'α'..='ω' => true,
    _ => false,
};

# let ph = 10;
println!("{}", match ph {
    0..7 => "acid",
    7 => "neutral",
    8..=14 => "base",
    _ => unreachable!(),
});

# let uint: u32 = 5;
match uint {
    0 => "zero!",
    1.. => "positive number!",
};

// using paths to constants:
# const TROPOSPHERE_MIN : u8 = 6;
# const TROPOSPHERE_MAX : u8 = 20;
#
# const STRATOSPHERE_MIN : u8 = TROPOSPHERE_MAX + 1;
# const STRATOSPHERE_MAX : u8 = 50;
#
# const MESOSPHERE_MIN : u8 = STRATOSPHERE_MAX + 1;
# const MESOSPHERE_MAX : u8 = 85;
#
# let altitude = 70;
#
println!("{}", match altitude {
    TROPOSPHERE_MIN..=TROPOSPHERE_MAX => "troposphere",
    STRATOSPHERE_MIN..=STRATOSPHERE_MAX => "stratosphere",
    MESOSPHERE_MIN..=MESOSPHERE_MAX => "mesosphere",
    _ => "outer space, maybe",
});

# pub mod binary {
#     pub const MEGA : u64 = 1024*1024;
#     pub const GIGA : u64 = 1024*1024*1024;
# }
# let n_items = 20_832_425;
# let bytes_per_item = 12;
if let size @ binary::MEGA..=binary::GIGA = n_items * bytes_per_item {
    println!("It fits and occupies {} bytes", size);
}

# trait MaxValue {
#     const MAX: u64;
# }
# impl MaxValue for u8 {
#     const MAX: u64 = (1 << 8) - 1;
# }
# impl MaxValue for u16 {
#     const MAX: u64 = (1 << 16) - 1;
# }
# impl MaxValue for u32 {
#     const MAX: u64 = (1 << 32) - 1;
# }
// using qualified paths:
println!("{}", match 0xfacade {
    0 ..= <u8 as MaxValue>::MAX => "fits in a u8",
    0 ..= <u16 as MaxValue>::MAX => "fits in a u16",
    0 ..= <u32 as MaxValue>::MAX => "fits in a u32",
    _ => "too big",
});
```

<a id="patterns.range.refutable"></a> 对于固定宽度整数和`char`类型的范围模式，当它们覆盖该类型所有可能的值集合时，则为不可引用的。例如，`0u8..=255u8`是不可引用的。

<a id="patterns.range.refutable-integer"></a> 整数类型的值范围是从其最小值到最大值之间的闭区间。

<a id="patterns.range.refutable-char"></a> `char`类型的值范围正是包含所有Unicode标量值的范围：`'\u{0000}'..='\u{D7FF}'`和`'\u{E000}'..='\u{10FFFF}'`。

<a id="patterns.range.constraint-slice"></a> [RangeFromPattern]不能作为[切片模式](#slice-patterns)中子模式的顶层模式。例如，模式 `[1.., _]`不是有效的模式。

<a id="patterns.range.edition2021"></a> 
> [!EDITION-2021]
> Before the 2021 edition, range patterns with both a lower and upper bound may also be written using `...` in place of `..=`, with the same meaning.

<a id="patterns.ref"></a>
## 引用模式

<a id="patterns.ref.syntax"></a> 
```grammar,patterns
ReferencePattern -> (`&`|`&&`) `mut`? PatternWithoutModernRange
```

<a id="patterns.ref.intro"></a> 引用模式会解引用被匹配的指针，从而借用这些指针。

例如，对`x: &i32`的这两个匹配是等价的：

```rust
let int_reference = &3;

let a = match *int_reference { 0 => "zero", _ => "some" };
let b = match int_reference { &0 => "zero", _ => "some" };

assert_eq!(a, b);
```

<a id="patterns.ref.ref-ref"></a> 引用模式的语法产生式必须匹配标记`&&`，以匹配对引用的引用，因为它本身就是一个标记，而不是两个`&`标记。

<a id="patterns.ref.mut"></a> 添加`mut`关键字会解引用可变的引用。可变性必须与引用本身的可变性一致。

<a id="patterns.ref.refutable"></a> 引用模式总是不可引用的。

<a id="patterns.结构体"></a>
## 结构体模式

<a id="patterns.结构体.syntax"></a> 
```grammar,patterns
StructPattern ->
    PathInExpression `{`
        StructPatternElements?
    `}`

StructPatternElements ->
      StructPatternFields (`,` | `,` StructPatternEtCetera)?
    | StructPatternEtCetera

StructPatternFields ->
    StructPatternField (`,` StructPatternField)*

StructPatternField ->
    OuterAttribute*
    (
        TUPLE_INDEX `:` Pattern
      | IDENTIFIER `:` Pattern
      | `ref`? `mut`? IDENTIFIER
    )

StructPatternEtCetera -> `..`
```

<a id="patterns.结构体.intro"></a> 结构体模式匹配结构体、枚举和联合值，这些值满足其子模式定义的所有条件。它们还用于[解构](#destructuring)结构体、枚举或联合值。

<a id="patterns.结构体.ignore-rest"></a> 在结构体模式上，字段通过名称、索引（在元组结构体中）或使用 `..` 被忽略来引用：

```rust
# struct Point {
#     x: u32,
#     y: u32,
# }
# let s = Point {x: 1, y: 1};
#
match s {
    Point {x: 10, y: 20} => (),
    Point {y: 10, x: 20} => (),    // order doesn't matter
    Point {x: 10, ..} => (),
    Point {..} => (),
}

# struct PointTuple (
#     u32,
#     u32,
# );
# let t = PointTuple(1, 2);
#
match t {
    PointTuple {0: 10, 1: 20} => (),
    PointTuple {1: 10, 0: 20} => (),   // order doesn't matter
    PointTuple {0: 10, ..} => (),
    PointTuple {..} => (),
}

# enum Message {
#     Quit,
#     Move { x: i32, y: i32 },
# }
# let m = Message::Quit;
#
match m {
    Message::Quit => (),
    Message::Move {x: 10, y: 20} => (),
    Message::Move {..} => (),
}
```

<a id="patterns.结构体.constraint-结构体"></a> 如果不使用 `..`，用于匹配结构体的结构体模式必须指定所有字段：

```rust
# struct Struct {
#    a: i32,
#    b: char,
#    c: bool,
# }
# let mut struct_value = Struct{a: 10, b: 'X', c: false};
#
match struct_value {
    Struct{a: 10, b: 'X', c: false} => (),
    Struct{a: 10, b: 'X', ref c} => (),
    Struct{a: 10, b: 'X', ref mut c} => (),
    Struct{a: 10, b: 'X', c: _} => (),
    Struct{a: _, b: _, c: _} => (),
}
```

<a id="patterns.结构体.constraint-union"></a> 用于匹配联合体的结构体模式必须精确指定一个字段（参见[联合体上的模式匹配]）。

<a id="patterns.结构体.binding-shorthand"></a> [IDENTIFIER] 语法可以匹配任何值，并将其绑定到与给定字段同名的变量。它是 `fieldname: fieldname` 的简写形式。`ref` 和 `mut` 限定符可以与 [patterns.ident.ref] 中描述的行为一起使用。

```rust
# struct Struct {
#    a: i32,
#    b: char,
#    c: bool,
# }
# let struct_value = Struct{a: 10, b: 'X', c: false};
#
let Struct { a, b, c } = struct_value;
```

<a id="patterns.结构体.refutable"></a> 如果 [PathInExpression] 解析为具有多个变体的枚举的构造函数，或其子模式中的一个是可重构的，则结构体模式是可重构的。

<a id="patterns.结构体.namespace"></a> 结构体模式匹配在 [type namespace] 中由 [PathInExpression] 解析出的结构体、联合体或枚举变体。有关更多细节，请参阅 [patterns.tuple-结构体.namespace]。

<a id="patterns.tuple-结构体"></a>
## 元组结构体模式

<a id="patterns.tuple-结构体.syntax"></a> 
```grammar,patterns
TupleStructPattern -> PathInExpression `(` TupleStructItems? `)`

TupleStructItems -> Pattern ( `,` Pattern )* `,`?
```

<a id="patterns.tuple-结构体.intro"></a> 元组结构体模式匹配满足其子模式定义的所有条件的元组结构和枚举值。它们还用于[解构](#destructuring)元组结构或枚举值。

<a id="patterns.tuple-结构体.refutable"></a> 如果 [PathInExpression] 解析为具有多个变体的枚举的构造函数，或其子模式中的一个是可重构的，则元组结构体模式是可重构的。

<a id="patterns.tuple-结构体.namespace"></a> 元组结构体模式匹配在 [value namespace] 中由 [PathInExpression] 解析出的元组结构或[类似元组的枚举变体]。

> [!NOTE]
> Conversely, a struct pattern for a tuple struct or [tuple-like enum variant], e.g. `S { 0: _ }`, matches against the tuple struct or variant whose constructor is resolved in the [type namespace].
>
> ```rust,no_run
> enum E1 { V(u16) }
> enum E2 { V(u32) }
>
> // Import `E1::V` from the type namespace only.
> mod _0 {
>     const V: () = (); // For namespace masking.
>     pub(super) use super::E1::*;
> }
> use _0::*;
>
> // Import `E2::V` from the value namespace only.
> mod _1 {
>     struct V {} // For namespace masking.
>     pub(super) use super::E2::*;
> }
> use _1::*;
>
> fn f() {
>     // This struct pattern matches against the tuple-like
>     // enum variant whose constructor was found in the type
>     // namespace.
>     let V { 0: ..=u16::MAX } = (loop {}) else { loop {} };
>     // This tuple struct pattern matches against the tuple-like
>     // enum variant whose constructor was found in the value
>     // namespace.
>     let V(..=u32::MAX) = (loop {}) else { loop {} };
> }
> # // Required due to the odd behavior of `super` within functions.
> # fn main() {}
> ```
>
> The Lang team has made certain decisions, such as in [PR #138458], that raise questions about the desirability of using the value namespace in this way for patterns, as described in [PR #140593]. It might be prudent to not intentionally rely on this nuance in your code.

<a id="patterns.tuple"></a>
## 元组模式

<a id="patterns.tuple.syntax"></a> 
```grammar,patterns
TuplePattern -> `(` TuplePatternItems? `)`

TuplePatternItems ->
      Pattern `,`
    | RestPattern
    | Pattern (`,` Pattern)+ `,`?
```

<a id="patterns.tuple.intro"></a> 元组模式匹配满足其子模式定义的所有条件的元组值。它们还用于[解构](#destructuring)元组。

<a id="patterns.tuple.rest-syntax"></a> 带有单个 [RestPattern] 的 `(..)` 形式是一种特殊形式，不需要使用逗号，可以匹配任意大小的元组。

<a id="patterns.tuple.refutable"></a> 当其子模式中的某个子模式是可确定的时，元组模式也是可确定的。

使用元组模式的示例：

```rust
let pair = (10, "ten");
let (a, b) = pair;

assert_eq!(a, 10);
assert_eq!(b, "ten");
```

<a id="patterns.paren"></a>
## 分组模式

<a id="patterns.paren.syntax"></a> 
```grammar,patterns
GroupedPattern -> `(` Pattern `)`
```

<a id="patterns.paren.intro"></a> 将模式括在括号内可以用来明确控制复合模式的优先级。例如，在范围模式旁边使用引用模式，如 `&0..=5`，是模糊的且不允许的，但可以通过括号来表达。

```rust
let int_reference = &3;
match int_reference {
    &(0..=5) => (),
    _ => (),
}
```

<a id="patterns.slice"></a>
## 切片模式

<a id="patterns.slice.syntax"></a> 
```grammar,patterns
SlicePattern -> `[` SlicePatternItems? `]`

SlicePatternItems -> Pattern (`,` Pattern)* `,`?
```

<a id="patterns.slice.intro"></a> 切片模式可以匹配固定大小的数组和动态大小的切片。

```rust
// Fixed size
let arr = [1, 2, 3];
match arr {
    [1, _, _] => "starts with one",
    [a, b, c] => "starts with something else",
};
```
```rust
// Dynamic size
let v = vec![1, 2, 3];
match v[..] {
    [a, b] => { /* this arm will not apply because the length doesn't match */ }
    [a, b, c] => { /* this arm will apply */ }
    _ => { /* this wildcard is required, since the length is not known statically */ }
};
```

<a id="patterns.slice.refutable-array"></a> 当匹配数组时，只要每个元素都是不可确定的，则切片模式就是不可确定的。

<a id="patterns.slice.refutable-slice"></a> 在匹配切片时，只有带有单个 `..` [rest pattern][patterns.rest] 或带有 `..` rest pattern 作为子模式的 [identifier pattern](#identifier-patterns) 形式才是不可确定的。

<a id="patterns.slice.restriction"></a> 在切片中，没有下限和上限范围的范围模式必须括在括号内，如 `(a..)`，以明确其旨在匹配单个切片元素。具有上下限范围的模式，如 `a..=b`，则不需要括在括号内。

<a id="patterns.path"></a>
## 路径模式

<a id="patterns.path.syntax"></a> 
```grammar,patterns
PathPattern -> PathExpression
```

<a id="patterns.path.intro"></a> _路径模式_ 是指向常量值、结构体或没有字段的枚举变体的模式。

<a id="patterns.path.unqualified"></a> 未限定路径模式可以指向：

* 枚举变体 * 结构体 * 常量 * 相关常量

<a id="patterns.path.qualified"></a> 限定路径模式只能指向相关常量。

<a id="patterns.path.refurable"></a> 当路径模式指向结构体或枚举变体（且枚举只有一个变体）或不可变的常量时，该模式是不可修改的。当路径模式指向可修改的常量或具有多个变体的枚举的枚举变体时，该模式是可修改的。

<a id="patterns.const"></a>
### 常量模式

<a id="patterns.const.partial-eq"></a> 当使用类型为 `T` 的常量 `C` 作为模式时，首先需检查 `T: PartialEq`。

<a id="patterns.const.structural-equality"></a> 此外，还需确保 `C` 的值具有（递归）结构相等性，其定义如下：

<a id="patterns.const.primitive"></a> - 整数以及 `str`、`bool` 和 `char` 值始终具有结构相等性。

<a id="patterns.const.builtin-aggregate"></a> - 如果元组、数组和切片的所有字段/元素都具有结构相等性，则它们具有结构相等性。（特别地，`()` 和 `[]` 始终具有结构相等性。）

<a id="patterns.const.ref"></a> - 如果引用所指向的值具有结构相等性，则引用具有结构相等性。

<a id="patterns.const.aggregate"></a> - 如果 `struct` 或 `enum` 类型的值的 `PartialEq` 实例通过 `#[derive(PartialEq)]` 派生出来，并且所有字段（对于枚举：活动变体）都具有结构相等性，则该值具有结构相等性。

<a id="patterns.const.pointer"></a> - 如果原始指针被定义为常量整数（然后进行了类型转换），则它具有结构相等性。

<a id="patterns.const.float"></a> - 如果浮点值不是 `NaN`，则它具有结构相等性。

<a id="patterns.const.exhaustive"></a> - 其他任何内容均不具有结构相等性。

<a id="patterns.const.泛型"></a> 特别是，`C` 的值必须在模式构建时已知（即预泛化阶段）。这意味着涉及泛型参数的关联常量不能用作模式。

<a id="patterns.const.immutable"></a> `C` 的值不得包含对可变静态变量（`static mut` 项或内部可变 `static` 项）或 `extern` 静态变量的引用。

<a id="patterns.const.translation"></a> 在确保所有条件满足后，常量值会被转换为一种模式，此时其行为与直接编写该模式完全相同。特别地，它完全参与完整性检查。（对于原始指针，常量是编写此类模式的唯一方式。对于这些类型，只有 `_` 被视为完整性的。）

<a id="patterns.or"></a>
## 或模式

_或模式_ 是一种匹配两个或多个子模式之一的模式（例如 `A | B | C`）。它们可以任意嵌套。在语法上，或模式可以在其他模式允许的任何位置使用（由 [Pattern] 生产规则表示），但 `let` 绑定以及函数和闭包参数除外（由 [PatternNoTopAlt] 生产规则表示）。

<a id="patterns.constraints"></a>
### 静态语义

<a id="patterns.constraints.pattern"></a> 1. 给定某个深度下的模式 `p | q`，对于任意模式 `p` 和 `q`，如果满足以下情况，则该模式被视为不合法：

   + `p` 的推断类型与 `q` 的推断类型不统一；或 + `p` 和 `q` 中引入了相同的绑定集；或 + `p` 和 `q` 中相同名称的两个绑定的类型在类型或绑定模式方面不统一。

   上述所有情况下的类型统一都是精确的，且不适用 [类型强制规则]。

<a id="patterns.constraints.match-type-check"></a> 2. 当对表达式 `match e_s { a_1 => e_1, ... a_n => e_n }` 进行类型检查时，对于包含形式为 `p_i | q_i` 模式的每个匹配分支 `a_i`，如果在其存在的深度 `d` 处，`e_s` 的该片段的类型与 `p_i | q_i` 不统一，则该模式被视为不合法。

<a id="patterns.constraints.exhaustiveness-or-pattern"></a> 3. 关于完备性检查，模式 `p | q` 被认为涵盖了 `p` 和 `q`。对于某些构造函数 `c(x, ..)`，分配律适用，使得 `c(p | q, ..rest)` 覆盖的值集合与 `c(p, ..rest) | c(q, ..rest)` 相同。这种规则可以递归应用，直到没有其他形式的 `p | q` 嵌套模式存在为止。

   请注意，我们所说的“构造函数”并非指元组结构模式，而是指任何产品类型的模式。这包括枚举变体、元组结构、具有命名字段的结构、数组、元组和切片。

<a id="patterns.behavior"></a>
### 动态语义

<a id="patterns.behavior.nested-or-patterns"></a> 1. 在深度为 `d` 的情况下，将检查表达式 `e_s` 与模式 `c(p | q, ..rest)` 进行模式匹配的动态语义被定义为与 `c(p, ..rest) | c(q, ..rest)` 的语义相同。其中，`c` 是某种构造函数，`p` 和 `q` 是任意模式，而 `rest` 是 `c` 中可选的剩余潜在因素。

<a id="patterns.precedence"></a>
### 与其他未限定模式的前置性

如本章其他部分所述，存在几种在语法上未限定的模式类型，包括标识符模式、引用模式和或模式。或模式始终具有最低前置性。这为我们保留了未来类型标注功能的语法空间，同时减少了歧义。例如，`x @ A(..) | B(..)` 会导致错误，因为 `x` 并未在所有模式中都被绑定。`&A(x) | B(x)` 则会导致不同子模式中的 `x` 类型不匹配。

[tuple-like enum variant]: items.enum.tuple-expr
[type namespace]: names.namespaces.kinds
[value namespace]: names.namespaces.kinds

[PR #138458]: https://github.com/rust-lang/rust/pull/138458
[PR #140593]: https://github.com/rust-lang/rust/pull/140593#issuecomment-2972338457
[`Copy`]: special-types-and-traits.md#copy
[constant]: items/constant-items.md
[enums]: items/enumerations.md
[literals]: expressions/literal-expr.md
[literal expression]: expressions/literal-expr.md
[name resolution]: names/name-resolution.md
[negating]: expressions/operator-expr.md#negation-operators
[path]: expressions/path-expr.md
[pattern matching on unions]: items/unions.md#pattern-matching-on-unions
[range expressions]: expressions/range-expr.md
[scope]: names/scopes.md
[structs]: items/structs.md
[tuples]: types/tuple.md
[scrutinee]: glossary.md#scrutinee
[type coercions]: type-coercions.md
