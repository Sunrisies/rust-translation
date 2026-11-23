<a id="生命周期省略"></a>
# 生命周期省略

<a id="生命周期省略介绍"></a> Rust 有规则允许在编译器可以推断出合理默认选择的各种地方省略生命周期。

<a id="函数中的生命周期省略"></a>
## 函数中的生命周期省略

<a id="函数中的生命周期省略介绍"></a> 为了使常见模式更易于使用，可以在 [函数项]、[函数指针] 和 [闭包特质] 签名中 *省略* 生命周期参数。以下规则用于推断被省略的生命周期参数。

<a id="无法推断的生命周期省略"></a> 无法推断的生命周期参数被省略是错误的。

<a id="显式占位符中的生命周期省略"></a> 占位符 `'_` 也可以用来以相同方式推断出生命周期。在路径中的生命周期中，建议使用 `'_`。

<a id="仅适用于函数的生命周期省略"></a> 特质对象生命周期遵循 [下方](#默认特质对象生命周期) 讨论的不同规则。

<a id="隐含生命周期参数的生命周期省略"></a> * 参数中每个被省略的生命周期都成为独立的生命周期参数。

<a id="输出生命周期的生命周期省略"></a> * 如果参数中恰好使用了一个生命周期（无论是否被省略），则该生命周期将分配给所有被省略的输出生命周期。

<a id="接收者生命周期的生命周期省略"></a> 在方法签名中有另一条规则

* 如果接收者的类型为 `&Self` 或 `&mut Self`，则对 `Self` 的引用生命周期将被分配给所有被省略的输出生命周期参数。

Examples:

```rust
# trait T {}
# trait ToCStr {}
# struct Thing<'a> {f: &'a i32}
# struct Command;
#
# trait Example {
fn print1(s: &str);                                   // elided
fn print2(s: &'_ str);                                // also elided
fn print3<'a>(s: &'a str);                            // expanded

fn debug1(lvl: usize, s: &str);                       // elided
fn debug2<'a>(lvl: usize, s: &'a str);                // expanded

fn substr1(s: &str, until: usize) -> &str;            // elided
fn substr2<'a>(s: &'a str, until: usize) -> &'a str;  // expanded

fn get_mut1(&mut self) -> &mut dyn T;                 // elided
fn get_mut2<'a>(&'a mut self) -> &'a mut dyn T;       // expanded

fn args1<T: ToCStr>(&mut self, args: &[T]) -> &mut Command;                  // elided
fn args2<'a, 'b, T: ToCStr>(&'a mut self, args: &'b [T]) -> &'a mut Command; // expanded

fn other_args1<'a>(arg: &str) -> &'a str;             // elided
fn other_args2<'a, 'b>(arg: &'b str) -> &'a str;      // expanded

fn new1(buf: &mut [u8]) -> Thing<'_>;                 // elided - preferred
fn new2(buf: &mut [u8]) -> Thing;                     // elided
fn new3<'a>(buf: &'a mut [u8]) -> Thing<'a>;          // expanded
# }

type FunPtr1 = fn(&str) -> &str;                      // elided
type FunPtr2 = for<'a> fn(&'a str) -> &'a str;        // expanded

type FunTrait1 = dyn Fn(&str) -> &str;                // elided
type FunTrait2 = dyn for<'a> Fn(&'a str) -> &'a str;  // expanded
```

```rust,compile_fail
// The following examples show situations where it is not allowed to elide the
// lifetime parameter.

# trait Example {
// Cannot infer, because there are no parameters to infer from.
fn get_str() -> &str;                                 // ILLEGAL

// Cannot infer, ambiguous if it is borrowed from the first or second parameter.
fn frob(s: &str, t: &str) -> &str;                    // ILLEGAL
# }
```

<a id="特质对象的生命周期省略"></a>
## 默认特质对象生命周期

<a id="特质对象的生命周期省略介绍"></a> [特质对象] 所持有的引用的假设生命周期称为其 _默认对象生命周期边界_。这些在 [RFC 599] 中定义，并在 [RFC 1156] 中进行了修改。

<a id="特质对象的显式边界生命周期省略"></a> 当完全省略生命周期边界时，使用这些默认对象生命周期边界规则代替上述生命周期参数省略规则。

<a id="生命周期-elision.trait-object.explicit-placeholder"></a> 如果将 `'_` 用作生命周期限制，则该限制遵循常规的省略规则。

<a id="生命周期-elision.trait-object.containing-type"></a> 如果 trait 对象作为泛型类型的类型参数使用，则首先使用包含类型来尝试推断生命周期。

<a id="生命周期-elision.trait-object.containing-type-unique"></a> * 如果包含类型有一个唯一的生命周期限制，则采用该限制作为默认情况。

<a id="生命周期-elision.trait-object.containing-type-explicit"></a> * 如果包含类型有多个生命周期限制，则必须指定明确的生命周期。

<a id="生命周期-elision.trait-object.trait-bounds"></a> 如果没有上述规则适用，则使用 trait 上的生命周期限制。

<a id="生命周期-elision.trait-object.trait-unique"></a> * 如果 trait 定义时只有一个生命周期限制，则采用该限制。

<a id="生命周期-elision.trait-object.static-生命周期"></a> * 如果任何生命周期限制使用 `'static`，则也使用 `'static`。

<a id="生命周期-elision.trait-object.default"></a> * 如果 trait 没有生命周期限制，则在表达式中推断生命周期，而在表达式之外则视为 `'static`。

```rust
// For the following trait...
trait Foo { }

// These two are the same because Box<T> has no lifetime bound on T
type T1 = Box<dyn Foo>;
type T2 = Box<dyn Foo + 'static>;

// ...and so are these:
impl dyn Foo {}
impl dyn Foo + 'static {}

// ...so are these, because &'a T requires T: 'a
type T3<'a> = &'a dyn Foo;
type T4<'a> = &'a (dyn Foo + 'a);

// std::cell::Ref<'a, T> also requires T: 'a, so these are the same
type T5<'a> = std::cell::Ref<'a, dyn Foo>;
type T6<'a> = std::cell::Ref<'a, dyn Foo + 'a>;
```

```rust,compile_fail
// This is an example of an error.
# trait Foo { }
struct TwoBounds<'a, 'b, T: ?Sized + 'a + 'b> {
    f1: &'a i32,
    f2: &'b i32,
    f3: T,
}
type T7<'a, 'b> = TwoBounds<'a, 'b, dyn Foo>;
//                                  ^^^^^^^
// Error: the lifetime bound for this object type cannot be deduced from context
```

<a id="生命周期-elision.trait-object.innermost-type"></a> 请注意，最内层的对象设定了生命周期限制，因此 `&'a Box<dyn Foo>` 仍然为 `&'a Box<dyn Foo + 'static>`。

```rust
// For the following trait...
trait Bar<'a>: 'a { }

// ...these two are the same:
type T1<'a> = Box<dyn Bar<'a>>;
type T2<'a> = Box<dyn Bar<'a> + 'a>;

// ...and so are these:
impl<'a> dyn Bar<'a> {}
impl<'a> dyn Bar<'a> + 'a {}
```

<a id="生命周期-elision.const-static"></a>
## `const` 和 `static` 的省略规则

<a id="生命周期-elision.const-static.implicit-static"></a> 无论是 [常量] 还是 [静态] 的引用类型声明，除非指定了明确的生命周期，否则都具有 *隐式* `'static` 的生命周期。因此，涉及 `'static` 的常量声明可以在不指定生命周期的情况下书写。

```rust
// STRING: &'static str
const STRING: &str = "bitstring";

struct BitsNStrings<'a> {
    mybits: [u32; 2],
    mystring: &'a str,
}

// BITS_N_STRINGS: BitsNStrings<'static>
const BITS_N_STRINGS: BitsNStrings<'_> = BitsNStrings {
    mybits: [1, 2],
    mystring: STRING,
};
```

<a id="生命周期-elision.const-static.fn-references"></a> 请注意，如果 `static` 或 `const` 项包含函数或闭包引用，而这些又包含引用，编译器将首先尝试标准的省略规则。如果无法通过常规规则解决生命周期问题，则会产生错误。例如：

```rust
# struct Foo;
# struct Bar;
# struct Baz;
# fn somefunc(a: &Foo, b: &Bar, c: &Baz) -> usize {42}
// Resolved as `for<'a> fn(&'a str) -> &'a str`.
const RESOLVED_SINGLE: fn(&str) -> &str = |x| x;

// Resolved as `for<'a, 'b, 'c> Fn(&'a Foo, &'b Bar, &'c Baz) -> usize`.
const RESOLVED_MULTIPLE: &dyn Fn(&Foo, &Bar, &Baz) -> usize = &somefunc;
```

```rust,compile_fail
# struct Foo;
# struct Bar;
# struct Baz;
# fn somefunc<'a,'b>(a: &'a Foo, b: &'b Bar) -> &'a Baz {unimplemented!()}
// There is insufficient information to bound the return reference lifetime
// relative to the argument lifetimes, so this is an error.
const RESOLVED_STATIC: &dyn Fn(&Foo, &Bar) -> &Baz = &somefunc;
//                                            ^
// this function's return type contains a borrowed value, but the signature
// does not say whether it is borrowed from argument 1 or argument 2
```

[closure trait]: types/closure.md
[constant]: items/constant-items.md
[function item]: types/function-item.md
[function pointer]: types/function-pointer.md
[RFC 599]: https://github.com/rust-lang/rfcs/blob/master/text/0599-default-object-bound.md
[RFC 1156]: https://github.com/rust-lang/rfcs/blob/master/text/1156-adjust-default-object-bounds.md
[static]: items/static-items.md
[trait object]: types/trait-object.md
