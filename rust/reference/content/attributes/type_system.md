<a id="attributes.type-system"></a>
# 类型系统属性

<a id="attributes.type-system.intro"></a> 以下 [属性] 用于改变类型的使用方式。

<a id="attributes.type-system.non_exhaustive"></a>
## `non_exhaustive` 属性

<a id="attributes.type-system.non_exhaustive.intro"></a> *`non_exhaustive` 属性* 表示类型或变体将来可能添加更多字段或变体。

<a id="attributes.type-system.non_exhaustive.allowed-positions"></a> 可应用于 [`struct`s][struct], [`enum`s][enum]和 `enum` 变体。

<a id="attributes.type-system.non_exhaustive.syntax"></a> `non_exhaustive` 属性使用 [MetaWord] 语法，因此不接收任何输入。

<a id="attributes.type-system.non_exhaustive.same-crate"></a> 在定义 crate 内，`non_exhaustive` 没有效果。

```rust
#[non_exhaustive]
pub struct Config {
    pub window_width: u16,
    pub window_height: u16,
}

#[non_exhaustive]
pub struct Token;

#[non_exhaustive]
pub struct Id(pub u64);

#[non_exhaustive]
pub enum Error {
    Message(String),
    Other,
}

pub enum Message {
    #[non_exhaustive] Send { from: u32, to: u32, contents: String },
    #[non_exhaustive] Reaction(u32),
    #[non_exhaustive] Quit,
}

// Non-exhaustive structs can be constructed as normal within the defining crate.
let config = Config { window_width: 640, window_height: 480 };
let token = Token;
let id = Id(4);

// Non-exhaustive structs can be matched on exhaustively within the defining crate.
let Config { window_width, window_height } = config;
let Token = token;
let Id(id_number) = id;

let error = Error::Other;
let message = Message::Reaction(3);

// Non-exhaustive enums can be matched on exhaustively within the defining crate.
match error {
    Error::Message(ref s) => { },
    Error::Other => { },
}

match message {
    // Non-exhaustive variants can be matched on exhaustively within the defining crate.
    Message::Send { from, to, contents } => { },
    Message::Reaction(id) => { },
    Message::Quit => { },
}
```

<a id="attributes.type-system.non_exhaustive.external-crate"></a> 在定义 crate 之外，带有 `non_exhaustive` 的类型存在限制，但在添加新字段或变体时仍能保持向后兼容性。

<a id="attributes.type-system.non_exhaustive.construction"></a> 在定义 crate 之外无法构造非 exhaustive 类型：

- 非 exhaustive 变体 ([`struct`][struct] 或 [`enum` 变体][enum]) 无法使用 [StructExpression] 进行构造（包括使用 [函数式更新语法]）。 - 单位风格结构 [结构型] 的隐式定义同名常量，或 [元组结构][struct] 的同名构造函数，其 [可见性] 不超过 `pub(crate)`。也就是说，如果结构的可见性是 `pub`，则常量或构造函数的可见性也是 `pub(crate)`，否则两个项目的可见性相同（与没有 `#[non_exhaustive]` 的情况一样）。 - [`enum`][enum] 实例可以被构造。

以下在定义 crate 之外无法编译的构造示例：

<!-- ignore: requires external crates -->
```rust,ignore
// These are types defined in an upstream crate that have been annotated as
// `#[non_exhaustive]`.
use upstream::{Config, Token, Id, Error, Message};

// Cannot construct an instance of `Config`; if new fields were added in
// a new version of `upstream` then this would fail to compile, so it is
// disallowed.
let config = Config { window_width: 640, window_height: 480 };

// Cannot construct an instance of `Token`; if new fields were added, then
// it would not be a unit-like struct any more, so the same-named constant
// created by it being a unit-like struct is not public outside the crate;
// this code fails to compile.
let token = Token;

// Cannot construct an instance of `Id`; if new fields were added, then
// its constructor function signature would change, so its constructor
// function is not public outside the crate; this code fails to compile.
let id = Id(5);

// Can construct an instance of `Error`; new variants being introduced would
// not result in this failing to compile.
let error = Error::Message("foo".to_string());

// Cannot construct an instance of `Message::Send` or `Message::Reaction`;
// if new fields were added in a new version of `upstream` then this would
// fail to compile, so it is disallowed.
let message = Message::Send { from: 0, to: 1, contents: "foo".to_string(), };
let message = Message::Reaction(0);

// Cannot construct an instance of `Message::Quit`; if this were converted to
// a tuple enum variant `upstream`, this would fail to compile.
let message = Message::Quit;
```

<a id="attributes.type-system.non_exhaustive.match"></a> 在定义 crate 之外对非 exhaustive 类型进行匹配时存在限制：

- 当对非穷尽变体（[`struct`][struct] 或 [`enum` variant][enum]）进行模式匹配时，必须使用包含 `..` 的 [StructPattern]。元组枚举变体的构造函数 [visibility] 必须限制为不超过 `pub(crate)`。 - 当对非穷尽 [`enum`][enum] 进行模式匹配时，针对某个变体的匹配并不会增加分支的穷尽性。以下示例在定义 crate 之外无法编译：

<!-- ignore: requires external crates -->
```rust, ignore
// These are types defined in an upstream crate that have been annotated as
// `#[non_exhaustive]`.
use upstream::{Config, Token, Id, Error, Message};

// Cannot match on a non-exhaustive enum without including a wildcard arm.
match error {
  Error::Message(ref s) => { },
  Error::Other => { },
  // would compile with: `_ => {},`
}

// Cannot match on a non-exhaustive struct without a wildcard.
if let Ok(Config { window_width, window_height }) = config {
    // would compile with: `..`
}

// Cannot match a non-exhaustive unit-like or tuple struct except by using
// braced struct syntax with a wildcard.
// This would compile as `let Token { .. } = token;`
let Token = token;
// This would compile as `let Id { 0: id_number, .. } = id;`
let Id(id_number) = id;

match message {
  // Cannot match on a non-exhaustive struct enum variant without including a wildcard.
  Message::Send { from, to, contents } => { },
  // Cannot match on a non-exhaustive tuple or unit enum variant.
  Message::Reaction(type) => { },
  Message::Quit => { },
}
```

此外，对于包含任何非穷尽变体的枚举，也不允许使用数字转换（`as`）。

例如，以下枚举可以进行转换，因为它不包含任何非穷尽变体：

```rust
#[non_exhaustive]
pub enum Example {
    First,
    Second,
}
```

然而，如果枚举中甚至只包含一个非穷尽变体，进行转换将会引发错误。请参考该枚举的修改版本：

```rust
#[non_exhaustive]
pub enum EnumWithNonExhaustiveVariants {
    First,
    #[non_exhaustive]
    Second,
}
```

<!-- ignore: needs multiple crates -->
```rust,ignore
use othercrate::EnumWithNonExhaustiveVariants;

// Error: cannot cast an enum with a non-exhaustive variant when it's defined in another crate
let _ = EnumWithNonExhaustiveVariants::First as u8;
```

非穷尽类型在下游 crate 中始终被视为有实例的。

[`match`]: ../expressions/match-expr.md
[attributes]: ../attributes.md
[enum]: ../items/enumerations.md
[functional update syntax]: ../expressions/struct-expr.md#functional-update-syntax
[struct]: ../items/structs.md
[visibility]: ../visibility-and-privacy.md
