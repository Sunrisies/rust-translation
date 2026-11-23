<a id="attributes.diagnostics"></a>
# 诊断属性

<a id="attributes.diagnostics.intro"></a> 以下 [属性] 用于在编译过程中控制或生成诊断信息。

<a id="attributes.diagnostics.lint"></a>
## lint 检查属性

<a id="attributes.diagnostics.lint.intro"></a> lint 检查会指出可能不理想的编码模式，例如无法到达的代码或省略的文档。

<a id="attributes.diagnostics.lint.level"></a> lint 属性 `allow`、`expect`、`warn`、`deny` 和 `forbid` 使用 [MetaListPaths] 语法来指定要更改该属性所应用实体的 lint 级别列表。

对于任何 lint 检查 `C`：

<a id="attributes.diagnostics.lint.allow"></a> * `#[allow(C)]` 会覆盖 `C` 的检查，使得违规情况不会被报告。

<a id="attributes.diagnostics.lint.expect"></a> * `#[expect(C)]` 表示期望 lint `C` 被输出。如果预期未满足，该属性将抑制 `C` 的输出或发出警告。

<a id="attributes.diagnostics.lint.warn"></a> * `#[warn(C)]` 会警告 `C` 的违规情况，但继续编译过程。

<a id="attributes.diagnostics.lint.deny"></a> * `#[deny(C)]` 在遇到 `C` 的违规时发出错误信号。

<a id="attributes.diagnostics.lint.forbid"></a> * `#[forbid(C)]` 与 `deny(C)` 相同，但还禁止之后更改 lint 级别。

> [!NOTE]
> The lint checks supported by `rustc` can be found via `rustc -W help`, along with their default settings and are documented in the [rustc book].

```rust
pub mod m1 {
    // Missing documentation is ignored here
    #[allow(missing_docs)]
    pub fn undocumented_one() -> i32 { 1 }

    // Missing documentation signals a warning here
    #[warn(missing_docs)]
    pub fn undocumented_too() -> i32 { 2 }

    // Missing documentation signals an error here
    #[deny(missing_docs)]
    pub fn undocumented_end() -> i32 { 3 }
}
```

<a id="attributes.diagnostics.lint.override"></a> lint 属性可以覆盖之前指定的级别，只要该级别不试图改变被禁止的 lint（除了 `deny`，在 `forbid` 上下文中是允许的，但会被忽略）。之前的属性是指语法树中更高级别的属性，或者是按源顺序从左到右列出的同一实体上的先前属性。

此示例展示了如何使用 `allow` 和 `warn` 来开启或关闭特定的检查：

```rust
#[warn(missing_docs)]
pub mod m2 {
    #[allow(missing_docs)]
    pub mod nested {
        // Missing documentation is ignored here
        pub fn undocumented_one() -> i32 { 1 }

        // Missing documentation signals a warning here,
        // despite the allow above.
        #[warn(missing_docs)]
        pub fn undocumented_two() -> i32 { 2 }
    }

    // Missing documentation signals a warning here
    pub fn undocumented_too() -> i32 { 3 }
}
```

此示例展示了如何使用 `forbid` 禁止对该 lint 检查使用 `allow` 或 `expect`：

```rust,compile_fail
#[forbid(missing_docs)]
pub mod m3 {
    // Attempting to toggle warning signals an error here
    #[allow(missing_docs)]
    /// Returns 2.
    pub fn undocumented_too() -> i32 { 2 }
}
```

> [!NOTE]
> `rustc` allows setting lint levels on the [command-line][rustc-lint-cli], and also supports [setting caps][rustc-lint-caps] on the lints that are reported.

<a id="attributes.diagnostics.lint.reason"></a>
### lint 检查原因

所有lint属性都支持额外的`reason`参数，用于说明某个属性被添加的原因。如果lint在定义的级别上被发出，该原因将作为lint消息的一部分显示。

```rust,edition2015,compile_fail
// `keyword_idents` is allowed by default. Here we deny it to
// avoid migration of identifiers when we update the edition.
#![deny(
    keyword_idents,
    reason = "we want to avoid these idents to be future compatible"
)]

// This name was allowed in Rust's 2015 edition. We still aim to avoid
// this to be future compatible and not confuse end users.
fn dyn() {}
```

这是另一个示例，其中允许带有原因的lint：

```rust
use std::path::PathBuf;

pub fn get_path() -> PathBuf {
    // The `reason` parameter on `allow` attributes acts as documentation for the reader.
    #[allow(unused_mut, reason = "this is only modified on some platforms")]
    let mut file_name = PathBuf::from("git");

    #[cfg(target_os = "windows")]
    file_name.set_extension("exe");

    file_name
}
```

<a id="attributes.diagnostics.expect"></a>
### `#[expect]` 属性

<a id="attributes.diagnostics.expect.intro"></a> `#[expect(C)]` 属性为lint `C`创建一个lint预期。如果同一位置存在 `#[warn(C)]` 属性导致lint被发出，则预期会被满足；如果由于lint `C`不会被发出而导致预期未满足，则会在该属性处发出`unfulfilled_lint_expectations` lint。

```rust
fn main() {
    // This `#[expect]` attribute creates a lint expectation, that the `unused_variables`
    // lint would be emitted by the following statement. This expectation is
    // unfulfilled, since the `question` variable is used by the `println!` macro.
    // Therefore, the `unfulfilled_lint_expectations` lint will be emitted at the
    // attribute.
    #[expect(unused_variables)]
    let question = "who lives in a pineapple under the sea?";
    println!("{question}");

    // This `#[expect]` attribute creates a lint expectation that will be fulfilled, since
    // the `answer` variable is never used. The `unused_variables` lint, that would usually
    // be emitted, is suppressed. No warning will be issued for the statement or attribute.
    #[expect(unused_variables)]
    let answer = "SpongeBob SquarePants!";
}
```

<a id="attributes.diagnostics.expect.fulfillment"></a> 只有被`expect`属性抑制的lint发出时，lint预期才会被满足。如果在该作用域中通过其他级别属性如`allow`或`warn`修改了lint级别，则lint发出行为将相应处理，预期仍保持未满足状态。

```rust
#[expect(unused_variables)]
fn select_song() {
    // This will emit the `unused_variables` lint at the warn level
    // as defined by the `warn` attribute. This will not fulfill the
    // expectation above the function.
    #[warn(unused_variables)]
    let song_name = "Crab Rave";

    // The `allow` attribute suppresses the lint emission. This will not
    // fulfill the expectation as it has been suppressed by the `allow`
    // attribute and not the `expect` attribute above the function.
    #[allow(unused_variables)]
    let song_creator = "Noisestorm";

    // This `expect` attribute will suppress the `unused_variables` lint emission
    // at the variable. The `expect` attribute above the function will still not
    // be fulfilled, since this lint emission has been suppressed by the local
    // expect attribute.
    #[expect(unused_variables)]
    let song_version = "Monstercat Release";
}
```

<a id="attributes.diagnostics.expect.independent"></a> 如果`expect`属性包含多个lint，每个lint都需单独被预期。对于lint组而言，只要组内有一个lint被发出即可：

```rust
// This expectation will be fulfilled by the unused value inside the function
// since the emitted `unused_variables` lint is inside the `unused` lint group.
#[expect(unused)]
pub fn thoughts() {
    let unused = "I'm running out of examples";
}

pub fn another_example() {
    // This attribute creates two lint expectations. The `unused_mut` lint will be
    // suppressed and with that fulfill the first expectation. The `unused_variables`
    // wouldn't be emitted, since the variable is used. That expectation will therefore
    // be unsatisfied, and a warning will be emitted.
    #[expect(unused_mut, unused_variables)]
    let mut link = "https://www.rust-lang.org/";

    println!("Welcome to our community: {link}");
}
```

> [!NOTE]
> The behavior of `#[expect(unfulfilled_lint_expectations)]` is currently defined to always generate the `unfulfilled_lint_expectations` lint.

<a id="attributes.diagnostics.lint.group"></a>
### Lint组

<a id="attributes.diagnostics.lint.group.intro"></a> Lints可以被组织成有名的组，以便一起调整相关lints的级别。

<a id="attributes.diagnostics.lint.group.equivalence"></a> 使用有名组相当于列出该组内的所有lint。

```rust,compile_fail
// This allows all lints in the "unused" group.
#[allow(unused)]
// This overrides the "unused_must_use" lint from the "unused"
// group to deny.
#[deny(unused_must_use)]
fn example() {
    // This does not generate a warning because the "unused_variables"
    // lint is in the "unused" group.
    let x = 1;
    // This generates an error because the result is unused and
    // "unused_must_use" is marked as "deny".
    std::fs::remove_file("some_file"); // ERROR: unused `Result` that must be used
}
```

<a id="attributes.diagnostics.lint.group.warnings"></a> 有一个名为“warnings”的特殊组，包含所有“warn”级别的lint。“warnings”组忽略属性顺序，适用于所有在实体内部会发出警告的lint。

```rust,compile_fail
# unsafe fn an_unsafe_fn() {}
// The order of these two attributes does not matter.
#[deny(warnings)]
// The unsafe_code lint is normally "allow" by default.
#[warn(unsafe_code)]
fn example_err() {
    // This is an error because the `unsafe_code` warning has
    // been lifted to "deny".
    unsafe { an_unsafe_fn() } // ERROR: use of `unsafe` block
}
```

<a id="attributes.diagnostics.lint.tool"></a>
### Tool lint属性

<a id="attributes.diagnostics.lint.tool.intro"></a> Tool lint允许使用范围限定的lint，以`allow`、`warn`、`deny`或`forbid`方式指定特定工具的lint。

<a id="attributes.diagnostics.lint.tool.activation"></a> 工具检查仅在相关工具处于活动状态时才会执行。如果lint 属性（如 `allow`）引用了不存在的工具，编译器不会对不存在的 lint 发出警告，直到您使用该工具为止。

否则，它们的工作原理与常规 lint 属性相同：

```rust
// set the entire `pedantic` clippy lint group to warn
#![warn(clippy::pedantic)]
// silence warnings from the `filter_map` clippy lint
#![allow(clippy::filter_map)]

fn main() {
    // ...
}

// silence the `cmp_nan` clippy lint just for this function
#[allow(clippy::cmp_nan)]
fn foo() {
    // ...
}
```

> [!NOTE]
> `rustc` currently recognizes the tool lints for "[clippy]" and "[rustdoc]".

<a id="attributes.diagnostics.deprecated"></a>
## `deprecated` 属性

<a id="attributes.diagnostics.deprecated.intro"></a> *`deprecated` 属性* 标记某个项为已弃用。`rustc` 会在使用 `#[deprecated]` 项时发出警告。`rustdoc` 会显示项的弃用信息，包括可用的 `since` 版本和 `note`。

<a id="attributes.diagnostics.deprecated.syntax"></a> `deprecated` 属性有几种形式：

- `deprecated` --- 发出通用消息。 - `deprecated = "message"` --- 在弃用消息中包含给定的字符串。 - [MetaListNameValueStr] 语法，包含两个可选字段： - `since` --- 指定该项被弃用的版本号。`rustc` 目前不解析此字符串，但像 [Clippy] 这样的外部工具可能检查值的有效性。 - `note` --- 指定应包含在弃用消息中的字符串。通常用于提供关于弃用的解释及推荐的替代方案。

<a id="attributes.diagnostics.deprecated.allowed-positions"></a> `deprecated` 属性可以应用于任何 [项][trait item][枚举变体][trait-impl][外部块项] 或 [宏定义]。它不能应用于 [trait implementation items][trait-实现]。当应用于包含其他项的项时，例如 [模块] 或 [实现]，所有子项都会继承弃用属性。
<!-- NOTE: It is only rejected for trait impl items
(AnnotationKind::Prohibited)。在其他所有位置，它被静默忽略。元组结构字段被忽略。 -->

以下是一个示例：

```rust
#[deprecated(since = "5.2.0", note = "foo was rarely used. Users should instead use bar")]
pub fn foo() {}

pub fn bar() {}
```

[RFC][1270-deprecation.md] 包含了动机和更多细节。


<!-- template:attributes -->
<a id="attributes.diagnostics.must_use"></a>
## `must_use` 属性

<a id="attributes.diagnostics.must_use.intro"></a> *`must_use` [属性]* 用于标记应被使用的变量。

<a id="attributes.diagnostics.must_use.syntax"></a> `must_use` 属性使用 [MetaWord] 和 [MetaNameValueStr] 语法。

> [!EXAMPLE]
> ```rust
> #[must_use]
> fn use_me1() -> u8 { 0 }
>
> #[must_use = "explanation of why it should be used"]
> fn use_me2() -> u8 { 0 }
> ```

<a id="attributes.diagnostics.must_use.allowed-positions"></a> `must_use` 属性可以应用于以下类型：

- [结构体] - [Enumeration] - [Union] - [Function] - [trait]

> [!NOTE]
> `rustc` ignores use in other positions but lints against it. This may become an error in the future.

<a id="attributes.diagnostics.must_use.duplicates"></a> `must_use` 属性在某个项目上只能使用一次。

> [!NOTE]
> `rustc` lints against any use following the first. This may become an error in the future.

<a id="attributes.diagnostics.must_use.message"></a> `must_use` 属性可以通过使用 [MetaNameValueStr] 语法包含一条消息，例如 `#[must_use = "example message"]`。该消息可能会作为代码检查的一部分被输出。

<a id="attributes.diagnostics.must_use.type"></a> 当该属性应用于 [结构体]、[enumeration] 或 [union] 时，如果 [expression statement] 的 [expression] 具有该类型，则使用时会触发 `unused_must_use` 代码检查。

```rust,compile_fail
#![deny(unused_must_use)]
#[must_use]
struct MustUse();
MustUse(); // ERROR: Unused value that must be used.
```

<a id="attributes.diagnostics.must_use.type-uninhabited"></a> 作为 [attributes.diagnostics.must_use.type] 的例外情况，当 `E` 为 [uninhabited] 时，`Result<(), E>` 不会触发代码检查，当 `B` 为 [uninhabited] 时，`ControlFlow<B, ()>` 也不会触发代码检查。来自外部 crate 的 `#[non_exhaustive]` 类型不被视为非 inhabited 类型，因为未来可能会添加构造器。

```rust
#![deny(unused_must_use)]
# use core::ops::ControlFlow;
fn f1() -> Result<(), !> { Ok(()) }
f1(); // OK: `!` is uninhabited.
fn f2() -> ControlFlow<!, ()> { ControlFlow::Continue(()) }
f2(); // OK: `!` is uninhabited.
```

<a id="attributes.diagnostics.must_use.fn"></a> 如果 [expression statement] 的 [expression] 是 [call expression] 或 [method call expression]，且其函数操作数是该属性所适用的函数，则使用时会触发 `unused_must_use` 代码检查。

```rust,compile_fail
#![deny(unused_must_use)]
#[must_use]
fn f() {}
f(); // ERROR: Unused return value that must be used.
```

<a id="attributes.diagnostics.must_use.trait"></a> 如果 [expression statement] 的 [expression] 是 [call expression] 或 [method call expression]，且其函数操作数返回的是具有该属性的一个或多个 trait 类型的 [实现 trait] 或 [dyn trait]，则使用时会触发 `unused_must_use` 代码检查。

```rust,compile_fail
#![deny(unused_must_use)]
#[must_use]
trait Tr {}
impl Tr for () {}
fn f() -> impl Tr {}
f(); // ERROR: Unused implementor that must be used.
```

<a id="attributes.diagnostics.must_use.trait-function"></a> 当在 trait 声明中的函数上应用该属性时，[attributes.diagnostics.must_use.fn]中描述的规则也适用于 [call expression] 或 [method call expression] 中的函数操作数为该函数的实现时。

```rust,compile_fail
#![deny(unused_must_use)]
trait Tr {
    #[must_use]
    fn use_me(&self);
}

impl Tr for () {
    fn use_me(&self) {}
}

().use_me(); // ERROR: Unused return value that must be used.
```

```rust,compile_fail
# #![deny(unused_must_use)]
# trait Tr {
#     #[must_use]
#     fn use_me(&self);
# }
#
# impl Tr for () {
#     fn use_me(&self) {}
# }
#
<() as Tr>::use_me(&());
//          ^^^^^^^^^^^ ERROR: Unused return value that must be used.
```

<a id="attributes.diagnostics.must_use.block-expr"></a> 在检查 [expression statement] 的 [expression] 是否符合 [attributes.diagnostics.must_use.type}、[attributes.diagnostics.must_use.fn}、[attributes.diagnostics.must_use.trait] 和 [attributes.diagnostics.must_use.trait-function] 时，lint 会遍历 [block expressions][block expression]（包括 [`unsafe` blocks] 和 [labeled block expressions]）直到每个表达式的末尾。对于嵌套的 block expressions，此规则会递归应用。

```rust,compile_fail
#![deny(unused_must_use)]
#[must_use]
fn f() {}

{ f() };        // ERROR: The lint looks through block expressions.
unsafe { f() }; // ERROR: The lint looks through `unsafe` blocks.
{ { f() } };    // ERROR: The lint looks through nested blocks.
```

<a id="attributes.diagnostics.must_use.trait-实现-function"></a> 当在 trait 实现中的函数上使用该属性时，该属性不会产生任何效果。

```rust
#![deny(unused_must_use)]
trait Tr {
    fn f(&self);
}

impl Tr for () {
    #[must_use] // This has no effect.
    fn f(&self) {}
}

().f(); // OK.
```

> [!NOTE]
> `rustc` lints against use on functions in trait implementations. This may become an error in the future.

<a id="attributes.diagnostics.must_use.wrapping-suppression"></a> 
> [!NOTE]
> Wrapping the result of a `#[must_use]` function in certain expressions can suppress the [fn-based check][attributes.diagnostics.must_use.fn], because the [expression] of the [expression statement] is not a [call expression] or [method call expression] to a `#[must_use]` function.  The [type-based check][attributes.diagnostics.must_use.type] still applies if the type of the overall expression is `#[must_use]`.
>
> ```rust
> #![deny(unused_must_use)]
> #[must_use]
> fn f() {}
>
> // The fn-based check does not fire for any of these, because the
> // expression of the expression statement is not a call to a
> // `#[must_use]` function.
> (f(),);                    // Expression is a tuple, not a call.
> Some(f());                 // Callee `Some` is not `#[must_use]`.
> if true { f() } else {};   // Expression is an `if`, not a call.
> match true {               // Expression is a `match`, not a call.
>     _ => f()
> };
> ```
>
> ```rust,compile_fail
> #![deny(unused_must_use)]
> #[must_use]
> struct MustUse;
> fn g() -> MustUse { MustUse }
>
> // Despite the `if` expression not being a call, the type-based check
> // fires because the type of the expression is `MustUse`, which has
> // the `#[must_use]` attribute.
> if true { g() } else { MustUse }; // ERROR: Must be used.
> ```

<a id="attributes.diagnostics.must_use.underscore-idiom"></a> 
> [!NOTE]
> Using a [let statement] or [destructuring assignment] with a pattern of `_` when a must-used value is purposely discarded is idiomatic.
>
> ```rust
> #![deny(unused_must_use)]
> #[must_use]
> fn f() {}
> let _ = f(); // OK.
> _ = f(); // OK.
> ```

<a id="attributes.diagnostic.namespace"></a>
## `diagnostic` 工具属性命名空间

<a id="attributes.diagnostic.namespace.intro"></a> #[diagnostic] 属性命名空间是用于影响编译时错误信息的属性的集合。这些属性提供的提示并不保证会被使用。

<a id="attributes.diagnostic.namespace.unknown-invalid-syntax"></a> 该命名空间中未知的属性是被接受的，尽管它们可能会发出关于未使用属性的警告。此外，已知属性的无效输入通常也会产生警告（详情请参阅属性定义）。这样做是为了允许将来添加或删除属性以及更改输入，从而无需保持那些无意义的属性或选项继续工作。

<a id="attributes.diagnostic.on_unimplemented"></a>
### `diagnostic::on_unimplemented` 属性

<a id="attributes.diagnostic.on_unimplemented.intro"></a> `#[diagnostic::on_unimplemented]` 属性是向编译器提供的提示，用于补充在需要 trait 但在类型上未实现时通常会生成的错误信息。

<a id="attributes.diagnostic.on_unimplemented.allowed-positions"></a> 该属性应放在 [trait 声明] 上，不过它也可以出现在其他位置，这并不构成错误。

<a id="attributes.diagnostic.on_unimplemented.syntax"></a> 该属性使用 [MetaListNameValueStr] 语法来指定其参数，尽管对参数的任何格式错误也不被视为错误，以便保持前后兼容性。

<a id="attributes.diagnostic.on_unimplemented.keys"></a> 以下键具有给定的含义：* `message` --- 顶级错误信息的文本。* `label` --- 错误信息中损坏代码内显示的标签文本。* `note` --- 提供额外的说明。

<a id="attributes.diagnostic.on_unimplemented.note-repetition"></a> `note` 选项可以出现多次，从而生成多个注意消息。

<a id="attributes.diagnostic.on_unimplemented.repetition"></a> 如果其他选项出现多次，第一次出现的选项值将指定实际使用的数值，后续出现则会产生警告。

<a id="attributes.diagnostic.on_unimplemented.unknown-keys"></a> 任何未知键都会生成警告。

<a id="attributes.diagnostic.on_unimplemented.format-string"></a> 所有三个选项都接受字符串作为参数，并使用与 [`std::fmt`] 字符串相同的格式进行解析。

<a id="attributes.diagnostic.on_unimplemented.format-parameters"></a> 具有指定名称参数的格式参数将被以下文本替换：* `{Self}` --- 实现 trait 的类型名。* `{` *GenericParameterName* `}` --- 给定泛型参数对应的泛型参数类型名。

<a id="attributes.diagnostic.on_unimplemented.invalid-formats"></a> 任何其他格式参数都会生成警告，但其余部分将保持原样包含在字符串中。

<a id="attributes.diagnostic.on_unimplemented.invalid-string"></a> 无效的格式字符串可能会产生警告，但其他情况下允许使用，不过可能无法按预期显示。格式说明符可能会产生警告，但在其他情况下被忽略。

在这个示例中：

```rust,compile_fail,E0277
#[diagnostic::on_unimplemented(
    message = "My Message for `ImportantTrait<{A}>` implemented for `{Self}`",
    label = "My Label",
    note = "Note 1",
    note = "Note 2"
)]
trait ImportantTrait<A> {}

fn use_my_trait(_: impl ImportantTrait<i32>) {}

fn main() {
    use_my_trait(String::new());
}
```

编译器可能会生成如下样式的错误信息：

```text
error[E0277]: My Message for `ImportantTrait<i32>` implemented for `String`
  --> src/main.rs:14:18
   |
14 |     use_my_trait(String::new());
   |     ------------ ^^^^^^^^^^^^^ My Label
   |     |
   |     required by a bound introduced by this call
   |
   = help: the trait `ImportantTrait<i32>` is not implemented for `String`
   = note: Note 1
   = note: Note 2
```

<a id="attributes.diagnostic.do_not_recommend"></a>
### `diagnostic::do_not_recommend` 属性

<a id="attributes.diagnostic.do_not_recommend.intro"></a> `#[diagnostic::do_not_recommend]` 属性是向编译器发出的提示，使其不将标注的 trait 实现作为诊断消息的一部分显示。

> [!NOTE]
> Suppressing the recommendation can be useful if you know that the recommendation would normally not be useful to the programmer. This often occurs with broad, blanket impls. The recommendation may send the programmer down the wrong path, or the trait implementation may be an internal detail that you don't want to expose, or the bounds may not be able to be satisfied by the programmer.
>
> For example, in an error message about a type not implementing a required trait, the compiler may find a trait implementation that would satisfy the requirements if it weren't for specific bounds in the trait implementation. The compiler may tell the user that there is an impl, but the problem is the bounds in the trait implementation. The `#[diagnostic::do_not_recommend]` attribute can be used to tell the compiler to *not* tell the user about the trait implementation, and instead simply tell the user the type doesn't implement the required trait.

<a id="attributes.diagnostic.do_not_recommend.allowed-positions"></a> 该属性应放在 [trait implementation item][trait-实现] 上，尽管它也可以位于其他位置而不会引发错误。

<a id="attributes.diagnostic.do_not_recommend.syntax"></a> 该属性不接受任何参数，不过意外的参数也不被视为错误。

在以下示例中，有一个名为 `AsExpression` 的 trait，用于将任意类型转换为 SQL 库中使用的 `Expression` 类型。有一个名为 `check` 的方法，该方法接受一个 `AsExpression` 参数。

```rust,compile_fail,E0277
# pub trait Expression {
#     type SqlType;
# }
#
# pub trait AsExpression<ST> {
#     type Expression: Expression<SqlType = ST>;
# }
#
# pub struct Text;
# pub struct Integer;
#
# pub struct Bound<T>(T);
# pub struct SelectInt;
#
# impl Expression for SelectInt {
#     type SqlType = Integer;
# }
#
# impl<T> Expression for Bound<T> {
#     type SqlType = T;
# }
#
# impl AsExpression<Integer> for i32 {
#     type Expression = Bound<Integer>;
# }
#
# impl AsExpression<Text> for &'_ str {
#     type Expression = Bound<Text>;
# }
#
# impl<T> Foo for T where T: Expression {}

// Uncomment this line to change the recommendation.
// #[diagnostic::do_not_recommend]
impl<T, ST> AsExpression<ST> for T
where
    T: Expression<SqlType = ST>,
{
    type Expression = T;
}

trait Foo: Expression + Sized {
    fn check<T>(&self, _: T) -> <T as AsExpression<<Self as Expression>::SqlType>>::Expression
    where
        T: AsExpression<Self::SqlType>,
    {
        todo!()
    }
}

fn main() {
    SelectInt.check("bar");
}
```

`SelectInt` 类型的 `check` 方法期望一个 `Integer` 类型。使用 i32 类型调用它是可行的，因为该类型会被 `AsExpression` trait 转换为 `Integer`。然而，使用字符串调用则不可行，并且会生成如下样式的错误：

```text
error[E0277]: the trait bound `&str: Expression` is not satisfied
  --> src/main.rs:53:15
   |
53 |     SelectInt.check("bar");
   |               ^^^^^ the trait `Expression` is not implemented for `&str`
   |
   = help: the following other types implement trait `Expression`:
             Bound<T>
             SelectInt
note: required for `&str` to implement `AsExpression<Integer>`
  --> src/main.rs:45:13
   |
45 | impl<T, ST> AsExpression<ST> for T
   |             ^^^^^^^^^^^^^^^^     ^
46 | where
47 |     T: Expression<SqlType = ST>,
   |        ------------------------ unsatisfied trait bound introduced here
```

通过在 `AsExpression` 的 blanket `impl` 上添加 `#[diagnostic::do_not_recommend]` 属性，错误信息会发生变化：

```text
error[E0277]: the trait bound `&str: AsExpression<Integer>` is not satisfied
  --> src/main.rs:53:15
   |
53 |     SelectInt.check("bar");
   |               ^^^^^ the trait `AsExpression<Integer>` is not implemented for `&str`
   |
   = help: the trait `AsExpression<Integer>` is not implemented for `&str`
           but trait `AsExpression<Text>` is implemented for it
   = help: for that trait implementation, expected `Text`, found `Integer`
```

第一个错误信息包含关于 `&str` 和 `Expression` 之间的关系以及 blanket 实现 中未满足的 trait 约束的较为混乱的信息。在添加 `#[diagnostic::do_not_recommend]` 后，该 blanket 实现 不再被视为推荐项。错误信息应该更清晰一些，明确指出字符串无法转换为 `Integer`。

[destructuring assignment]: expr.assign.destructure
[uninhabited]: glossary.uninhabited

[1270-deprecation.md]: https://github.com/rust-lang/rfcs/blob/master/text/1270-deprecation.md
[Clippy]: https://github.com/rust-lang/rust-clippy
[`Drop`]: ../special-types-and-traits.md#drop
[`unsafe` blocks]: ../expressions/block-expr.md#unsafe-blocks
[attribute]: ../attributes.md
[attributes]: ../attributes.md
[block expression]: ../expressions/block-expr.md
[call expression]: ../expressions/call-expr.md
[method call expression]: ../expressions/method-call-expr.md
[dyn trait]: ../types/trait-object.md
[enum variant]: ../items/enumerations.md
[enumeration]: ../items/enumerations.md
[expression statement]: ../statements.md#expression-statements
[expression]: ../expressions.md
[external block item]: ../items/external-blocks.md
[functions]: ../items/functions.md
[impl trait]: ../types/impl-trait.md
[implementation]: ../items/implementations.md
[item]: ../items.md
[labeled block expressions]: ../expressions/block-expr.md#labeled-block-expressions
[let statement]: ../statements.md#let-statements
[macro definition]: ../macros-by-example.md
[module]: ../items/modules.md
[rustc book]: ../../rustc/lints/index.html
[rustc-lint-caps]: ../../rustc/lints/levels.html#capping-lints
[rustc-lint-cli]: ../../rustc/lints/levels.html#via-compiler-flag
[rustdoc]: ../../rustdoc/lints.html
[struct field]: ../items/structs.md
[struct]: ../items/structs.md
[external block]: ../items/external-blocks.md
[trait declaration]: ../items/traits.md
[trait item]: ../items/traits.md
[trait-impl]: ../items/implementations.md#trait-implementations
[traits]: ../items/traits.md
[union]: ../items/unions.md
