//! Utilities for formatting and printing `String`s.
//!
//! This module contains the runtime support for the [`format!`] syntax extension.
//! 此宏在编译器中被实现，以便在运行时将参数格式化为字符串时调用此模块。
//! 为了在运行时格式化参数为字符串。
//!
//! # 使用方式
//!
//! The [`format!`] macro is intended to be familiar to those coming from C's
//! `printf`/`fprintf` functions or Python's `str.format` function.
//!
//! Some examples of the [`format!`] extension are:
//!
//! ```
//! # #![allow(unused_must_use)]
//! format!("Hello");                 // => "Hello"
//! format!("Hello, {}!", "world");   // => "Hello, world!"
//! format!("The number is {}", 1);   // => "The number is 1"
//! format!("{:?}", (3, 4));          // => "(3, 4)"
//! format!("{value}", value=4);      // => "4"
//! let people = "Rustaceans";
//! format!("Hello {people}!");       // => "Hello Rustaceans!"
//! format!("{} {}", 1, 2);           // => "1 2"
//! format!("{:04}", 42);             // => "0042" with leading zeros
//! format!("{:#?}", (100, 200));     // => "(
//!                                   //       100,
//!                                   //       200,
//!                                   //     )"
//! ```
//!
//! 从这些示例中可以看出，第一个参数是一个格式字符串。它
//! 被编译器要求必须是字符串字面量；它不能是一个
//! 传入的变量（用于进行有效性检查）。编译器
//! 会解析格式字符串，并判断提供的参数列表是否适合传递给该格式字符串。
//! provided is suitable to pass to this format string.
//!
//! To convert a single value to a string, use the [`to_string`] method. This
//! will use the [`Display`] formatting trait.
//!
//! ## Positional parameters
//!
//! 当开始混合这两种类型的位置说明符时，情况可能会变得有些复杂。“下一个参数”说明符可以被视为参数的迭代器。每次看到“下一个参数”说明符时，
//! 迭代器就会前进。这导致如下行为：
//! example, the format string `{} {} {}` would take three parameters, and they
//! would be formatted in the same order as they're given. The format string
//! `{2} {1} {0}`, however, would format arguments in reverse order.
//!
//! 要使用所有参数，必须使用格式字符串，否则会引发编译时错误。在格式字符串中，同一个参数可以被多次引用。
//! ## 命名参数
//! iterator over the argument. Each time a "next argument" specifier is seen,
//! the iterator advances. This leads to behavior like this:
//!
//! ```
//! # #![allow(unused_must_use)]
//! format!("{1} {} {0} {}", 1, 2); // => "2 1 1 2"
//! ```
//!
//! The internal iterator over the argument has not been advanced by the time
//! the first `{}` is seen, so it prints the first argument. Then upon reaching
//! the second `{}`, the iterator has advanced forward to the second argument.
//! Essentially, parameters that explicitly name their argument do not affect
//! parameters that do not name an argument in terms of positional specifiers.
//!
//! A format string is required to use all of its arguments, otherwise it is a
//! compile-time error. You may refer to the same argument more than once in the
//! format string.
//!
//! ## Named parameters
//!
//! Rust itself does not have a Python-like equivalent of named parameters to a
//! function, but the [`format!`] macro is a syntax extension that allows it to
//! 利用命名参数。命名参数位于参数列表的末尾，其语法如下：
//! argument list and have the syntax:
//!
//! ```text
//! identifier '=' expression
//! ```
//!
//! For example, the following [`format!`] expressions all use named arguments:
//!
//! ```
//! # #![allow(unused_must_use)]
//! format!("{argument}", argument = "test");   // => "test"
//! format!("{name} {}", 1, name = 2);          // => "2 1"
//! format!("{a} {c} {b}", a="a", b='b', c=3);  // => "a 3 b"
//! ```
//!
//! If a named parameter does not appear in the argument list, `format!` will
//! # 格式参数
//!
//! ```
//! # #![allow(unused_must_use)]
//! let argument = 2 + 2;
//! format!("{argument}");   // => "4"
//!
//! fn make_string(a: u32, b: &str) -> String {
//!     format!("{b} {a}")
//! }
//! make_string(927, "label"); // => "label 927"
//! ```
//!
//! It is not valid to put positional parameters (those without names) after
//! 格式语法中的冒号将输入数据的标识符和格式选项分开，但冒号本身并不改变任何内容，只是用于引入选项。
//! ## 宽度
//!
//! # 这是“最小宽度”参数，指格式应占据的字符数。如果值的字符串无法填满这个数量，则使用 fill/alignment 指定的填充来填补所需空间。
//!
//! Each argument being formatted can be transformed by a number of formatting
//! parameters (corresponding to `format_spec` in [the syntax](#syntax)). These
//! ## Fill/Alignment
//!
//! The colon `:` in format syntax divides identifier of the input data and
//! the formatting options, the colon itself does not change anything, only
//! 不同对齐方式下的填充方式如下：
//!
//! ```
//! let a = 5;
//! let b = &a;
//! println!("{a:e} {b:p}"); // => 5e0 0x7ffe37b7273c
//! ```
//!
//! ## Width
//!
//! ```
//! // All of these print "Hello x    !"
//! println!("Hello {:5}!", "x");
//! println!("Hello {:1$}!", "x", 5);
//! println!("Hello {1:0$}!", 5, "x");
//! println!("Hello {:width$}!", "x", width = 5);
//! let width = 5;
//! println!("Hello {:width$}!", "x");
//! ```
//!
//! This is a parameter for the "minimum width" that the format should take up.
//! If the value's string does not fill up this many characters, then the
//! padding specified by fill/alignment will be used to take up the required
//! space (see below).
//!
//! The width can also be provided dynamically by referencing another argument
//! with a `$` suffix. Use `{:N$}` to reference the Nth positional argument
//! (where N is an integer), or `{:name$}` to reference a named argument. The
//! referenced argument must be of type [`usize`]. Currently formatting will
//! panic if the width exceeds [`u16::MAX`].
//!
//! Referring to an argument with the dollar syntax does not affect the "next
//! argument" counter, so it's usually a good idea to refer to arguments by
//! position, or use named arguments.
//!
//! ## Fill/Alignment
//!
//! ```
//! assert_eq!(format!("Hello {:<5}!", "x"),  "Hello x    !");
//! assert_eq!(format!("Hello {:-<5}!", "x"), "Hello x----!");
//! assert_eq!(format!("Hello {:^5}!", "x"),  "Hello   x  !");
//! assert_eq!(format!("Hello {:>5}!", "x"),  "Hello     x!");
//! ```
//!
//! The optional fill character and alignment is provided normally in conjunction with the
//! [`width`](#width) parameter. It must be defined before `width`, right after the `:`.
//! This indicates that if the value being formatted is smaller than
//! `width` some extra characters will be printed around it.
//! Filling comes in the following variants for different alignments:
//!
//! * `[fill]<` - the argument is left-aligned in `width` columns
//! * `[fill]^` - the argument is center-aligned in `width` columns
//! * `[fill]>` - the argument is right-aligned in `width` columns
//!
//! The default [fill/alignment](#fillalignment) for non-numerics is a space and
//! 数字的格式器默认使用的也是空格字符，但为右对齐。如果
//! default for numeric formatters is also a space character but with right-alignment. If
//! the `0` flag (see below) is specified for numerics, then the implicit fill character is
//! `0`.
//!
//! Note that alignment might not be implemented by some types. In particular, it
//! is not generally implemented for the `Debug` trait.  A good way to ensure
//! 以获得输出：
//! to obtain your output:
//!
//! ```
//! println!("Hello {:^15}!", format!("{:?}", Some("hi"))); // => "Hello   Some("hi")   !"
//! ```
//!
//! ## Sign/`#`/`0`
//!
//! ```
//! assert_eq!(format!("Hello {:+}!", 5), "Hello +5!");
//! assert_eq!(format!("{:#x}!", 27), "0x1b!");
//! assert_eq!(format!("Hello {:05}!", 5),  "Hello 00005!");
//! assert_eq!(format!("Hello {:05}!", -5), "Hello -0005!");
//! assert_eq!(format!("{:#010x}!", 27), "0x0000001b!");
//! ```
//!
//! These are all flags altering the behavior of the formatter.
//!
//! * `+` - This is intended for numeric types and indicates that the sign
//! 正数或无符号值的符号则被省略。
//!         is printed, and the sign of positive or unsigned values is omitted.
//!         This flag indicates that the correct sign (`+` or `-`) should always be printed.
//! * `-` - Currently not used
//! * `#` - This flag indicates that the "alternate" form of printing should
//!         be used. The alternate forms are:
//!     * `#?` - pretty-print the [`Debug`] formatting (adds linebreaks and indentation)
//!     * `#x` - precedes the argument with a `0x`
//!     * `#X` - precedes the argument with a `0x`
//!     * `#b` - precedes the argument with a `0b`
//!     * `#o` - precedes the argument with a `0o`
//!
//!   See [Formatting traits](#formatting-traits) for a description of what the `?`, `x`, `X`,
//!   `b`, and `o` flags do.
//!
//! * `0` - This is used to indicate for integer formats that the padding to `width` should
//!         both be done with a `0` character as well as be sign-aware. A format
//!         like `{:08}` would yield `00000001` for the integer `1`, while the
//!         same format would yield `-0000001` for the integer `-1`. Notice that
//!         the negative version has one fewer zero than the positive version.
//! 遵循类似的规则：填充的零被插入在前缀之后但数字之前。前缀计入总宽度中。
//!         and before the digits. When used together with the `#` flag, a similar
//! rule applies: padding zeros are inserted after the prefix but before
//! the digits. The prefix is included in the total width.
//!         This flag overrides the [fill character and alignment flag](#fillalignment).
//!
//! ## 精度
//!
//! 对于非数字类型，这可以被视为“最大宽度”。如果生成的字符串
//! 超过此宽度，则会被截断为指定数量的字符，该截断后的值
//! value is emitted with proper `fill`, `alignment` and `width` if those parameters are set.
//!
//! 对于整数类型，此参数被忽略。
//!
//! 对于浮点类型，这表示小数点后应保留多少位
//! 需要打印。
//!
//! There are three possible ways to specify the desired `precision`:
//!
//! 1. An integer `.N`:
//!
//!    the integer `N` itself is the precision.
//!
//! 2. An integer or name followed by dollar sign `.N$`:
//!
//!    use the value of format *argument* `N` (which must be a `usize`) as the precision.
//! 整数指的是位置参数，而名称指的是命名参数。
//!
//! 3. An asterisk `.*`:
//!
//!    `.*` means that this `{...}` is associated with *two* format inputs rather than one:
//!    - If a format string in the fashion of `{:<spec>.*}` is used, then the first input holds
//!      the `usize` precision, and the second holds the value to print.
//!    - If a format string in the fashion of `{<arg>:<spec>.*}` is used, then the `<arg>` part
//!      refers to the value to print, and the `precision` is taken like it was specified with an
//!      omitted positional parameter (`{}` instead of `{<arg>:}`).
//!
//! For example, the following calls all print the same thing `Hello x is 0.01000`:
//!
//! ```
//! // Hello {arg 0 ("x")} is {arg 1 (0.01) with precision specified inline (5)}
//! println!("Hello {0} is {1:.5}", "x", 0.01);
//!
//! // Hello {arg 1 ("x")} is {arg 2 (0.01) with precision specified in arg 0 (5)}
//! println!("Hello {1} is {2:.0$}", 5, "x", 0.01);
//!
//! // Hello {arg 0 ("x")} is {arg 2 (0.01) with precision specified in arg 1 (5)}
//! println!("Hello {0} is {2:.1$}", "x", 5, 0.01);
//!
//! // Hello {next arg -> arg 0 ("x")} is {second of next two args -> arg 2 (0.01) with precision
//! //                          specified in first of next two args -> arg 1 (5)}
//! println!("Hello {} is {:.*}",    "x", 5, 0.01);
//!
//! // Hello {arg 1 ("x")} is {arg 2 (0.01) with precision
//! //                          specified in next arg -> arg 0 (5)}
//! println!("Hello {1} is {2:.*}",  5, "x", 0.01);
//!
//! // Hello {next arg -> arg 0 ("x")} is {arg 2 (0.01) with precision
//! //                          specified in next arg -> arg 1 (5)}
//! println!("Hello {} is {2:.*}",   "x", 5, 0.01);
//!
//! // Hello {next arg -> arg 0 ("x")} is {arg "number" (0.01) with precision specified
//! //                          in arg "prec" (5)}
//! println!("Hello {} is {number:.prec$}", "x", prec = 5, number = 0.01);
//! ```
//!
//! 会打印三种明显不同的内容：
//!
//! ```
//! println!("{}, `{name:.*}` has 3 fractional digits", "Hello", 3, name=1234.56);
//! println!("{}, `{name:.*}` has 3 characters", "Hello", 3, name="1234.56");
//! println!("{}, `{name:>8.*}` has 3 right-aligned characters", "Hello", 3, name="1234.56");
//! ```
//!
//! print three significantly different things:
//!
//! ```text
//! Hello, `1234.560` has 3 fractional digits
//! Hello, `123` has 3 characters
//! Hello, `     123` has 3 right-aligned characters
//! ```
//!
//! When truncating these values, Rust uses [round half-to-even](https://en.wikipedia.org/wiki/Rounding#Rounding_half_to_even),
//! 例如，
//! 将会返回：
//!
//! ```
//! print!("{0:.1$e}", 12345, 3);
//! print!("{0:.1$e}", 12355, 3);
//! ```
//!
//! ## 本地化
//!
//! ```text
//! 1.234e4
//! 1.236e4
//! ```
//!
//! ## 在某些编程语言中，字符串格式化函数的行为
//!
//! 取决于操作系统的本地化设置。Rust 标准库提供的格式函数
//! 没有本地化的概念，
//! 会在所有系统上产生相同的结果，与用户
//! 配置无关。
//! 例如，以下代码即使在系统
//!
//! For example, the following code will always print `1.5` even if the system
//! # 转义
//!
//! ```
//! println!("The value is {}", 1.5);
//! ```
//!
//! # Escaping
//!
//! The literal characters `{` and `}` may be included in a string by preceding
//! them with the same character. For example, the `{` character is escaped with
//! `{{` and the `}` character is escaped with `}}`.
//!
//! ```
//! assert_eq!(format!("Hello {{}}"), "Hello {}");
//! assert_eq!(format!("{{ Hello"), "{ Hello");
//! ```
//!
//! # 语法
//!
//! 总结来说，这里可以找到格式字符串的完整语法规则。
//! 这种格式化语言的语法来源于其他语言，
//! 因此不应显得过于陌生。参数采用类似 Python 的
//! syntax, meaning that arguments are surrounded by `{}` instead of the C-like
//! `%`. The actual grammar for the formatting syntax is:
//!
//! ```text
//! format_string := text [ maybe_format text ] *
//! maybe_format := '{' '{' | '}' '}' | format
//! format := '{' [ argument ] [ ':' format_spec ] [ ws ] * '}'
//! argument := integer | identifier
//!
//! format_spec := [[fill]align][sign]['#']['0'][width]['.' precision][type]
//! fill := character
//! align := '<' | '^' | '>'
//! sign := '+' | '-'
//! width := count
//! precision := count | '*'
//! type := '?' | 'x?' | 'X?' | 'o' | 'x' | 'X' | 'p' | 'b' | 'e' | 'E'
//! count := parameter | integer
//! parameter := argument '$'
//! ```
//! 在上述语法规则中，
//! - `text` must not contain any `'{'` or `'}'` characters,
//! - `ws` is any character for which [`char::is_whitespace`] returns `true`, has no semantic
//! 即没有意义，且完全可选，
//! - `integer` is a decimal integer that may contain leading zeroes and must fit into an `usize` and
//! - `identifier` is an `IDENTIFIER_OR_KEYWORD` (not an `IDENTIFIER`) as
//! 由 [Rust 语言] 定义
//!   reference](https://doc.rust-lang.org/reference/identifiers.html), except
//!   for a bare `_`.
//!
//! # 格式化 trait
//!
//! 当要求一个参数以特定类型进行格式化时，你
//! 实际上是在要求该参数具备某种特定的 trait。
//! This allows multiple actual types to be formatted via `{:x}` (like [`i8`] as
//! well as [`isize`]). The current mapping of types to traits is:
//!
//! * *nothing* ⇒ [`Display`]
//! * `?` ⇒ [`Debug`]
//! * `x?` ⇒ [`Debug`] with lower-case hexadecimal integers
//! * `X?` ⇒ [`Debug`] with upper-case hexadecimal integers
//! * `o` ⇒ [`Octal`]
//! * `x` ⇒ [`LowerHex`]
//! * `X` ⇒ [`UpperHex`]
//! * `p` ⇒ [`Pointer`]
//! * `b` ⇒ [`Binary`]
//! * `e` ⇒ [`LowerExp`]
//! * `E` ⇒ [`UpperExp`]
//!
//! 这意味着任何实现
//! [`fmt::Binary`][`Binary`] trait can then be formatted with `{:b}`. Implementations
//! 实现，由标准库提供。
//! standard library as well. If no format is specified (as in `{}` or `{:6}`),
//! then the format trait used is the [`Display`] trait.
//!
//! 当为自己的类型实现格式 trait 时，你需要
//! 实现签名中的方法：
//!
//! ```
//! # #![allow(dead_code)]
//! # use std::fmt;
//! # struct Foo; // our custom type
//! # impl fmt::Display for Foo {
//! fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
//! # write!(f, "testing, testing")
//! # } }
//! ```
//!
//! Your type will be passed as `self` by-reference, and then the function
//! should emit output into the Formatter `f` which implements `fmt::Write`. It is up to each
//! 格式 trait 实现都有责任正确遵循所要求的格式化参数。
//! The values of these parameters can be accessed with methods of the
//! [`Formatter`] struct. In order to help with this, the [`Formatter`] struct also
//! provides some helper methods.
//!
//! Additionally, the return value of this function is [`fmt::Result`] which is a
//! type alias of <code>[Result]<(), [std::fmt::Error]></code>. Formatting implementations
//! should ensure that they propagate errors from the [`Formatter`] (e.g., when
//! calling [`write!`]). However, they should never return errors spuriously. That
//! is, a formatting implementation must and may only return an error if the
//! passed-in [`Formatter`] returns an error. This is because, contrary to what
//! the function signature might suggest, string formatting is an infallible
//! operation. This function only returns a [`Result`] because writing to the
//! 实现格式化 trait 的一个示例可能如下：
//! 这两个格式化 trait 具有不同的用途：
//!
//! An example of implementing the formatting traits would look
//! like:
//!
//! ```
//! use std::fmt;
//!
//! #[derive(Debug)]
//! struct Vector2D {
//!     x: isize,
//!     y: isize,
//! }
//!
//! impl fmt::Display for Vector2D {
//!     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
//!         // The `f` value implements the `Write` trait, which is what the
//!         // write! macro is expecting. Note that this formatting ignores the
//!         // various flags provided to format strings.
//!         write!(f, "({}, {})", self.x, self.y)
//!     }
//! }
//!
//! // Different traits allow different forms of output of a type. The meaning
//! // of this format is to print the magnitude of a vector.
//! impl fmt::Binary for Vector2D {
//!     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
//!         let magnitude = (self.x * self.x + self.y * self.y) as f64;
//!         let magnitude = magnitude.sqrt();
//!
//!         // Respect the formatting flags by using the helper method
//!         // `pad_integral` on the Formatter object. See the method
//!         // documentation for details, and the function `pad` can be used
//!         // to pad strings.
//!         let decimals = f.precision().unwrap_or(3);
//!         let string = format!("{magnitude:.decimals$}");
//!         f.pad_integral(true, "", &string)
//!     }
//! }
//!
//! fn main() {
//!     let myvector = Vector2D { x: 3, y: 4 };
//!
//!     println!("{myvector}");       // => "(3, 4)"
//!     println!("{myvector:?}");     // => "Vector2D {x: 3, y:4}"
//!     println!("{myvector:10.3b}"); // => "     5.000"
//! }
//! ```
//!
//! ### `fmt::Display` vs `fmt::Debug`
//!
//! These two formatting traits have distinct purposes:
//!
//! - [`fmt::Display`][`Display`] implementations assert that the type can be faithfully
//!   represented as a UTF-8 string at all times. It is **not** expected that
//!   all types implement the [`Display`] trait.
//! - [`fmt::Debug`][`Debug`] implementations should be implemented for **all** public types.
//!   Output will typically represent the internal state as faithfully as possible.
//!   The purpose of the [`Debug`] trait is to facilitate debugging Rust code. In
//!   most cases, using `#[derive(Debug)]` is sufficient and recommended.
//!
//! Some examples of the output from both traits:
//!
//! ```
//! assert_eq!(format!("{} {:?}", 3, 4), "3 4");
//! assert_eq!(format!("{} {:?}", 'a', 'b'), "a 'b'");
//! assert_eq!(format!("{} {:?}", "foo\n", "bar\n"), "foo\n \"bar\\n\"");
//! ```
//!
//! # Related macros
//!
//! There are a number of related macros in the [`format!`] family. The ones that
//! 。使用示例如下：
//!
//! ```ignore (only-for-syntax-highlight)
//! format!      // described above
//! write!       // first argument is either a &mut io::Write or a &mut fmt::Write, the destination
//! writeln!     // same as write but appends a newline
//! print!       // the format string is printed to the standard output
//! println!     // same as print but appends a newline
//! eprint!      // the format string is printed to the standard error
//! eprintln!    // same as eprint but appends a newline
//! format_args! // described below.
//! ```
//!
//! ### `write!`
//!
//! [`write!`] and [`writeln!`] are two macros which are used to emit the format string
//! to a specified stream. This is used to prevent intermediate allocations of
//! 流中。
//! function is actually invoking the [`write_fmt`] function defined on the
//! [`std::io::Write`] and the [`std::fmt::Write`] trait. Example usage is:
//!
//! ```
//! # #![allow(unused_must_use)]
//! use std::io::Write;
//! let mut w = Vec::new();
//! write!(&mut w, "Hello {}!", "world");
//! ```
//!
//! ### `print!`
//!
//! This and [`println!`] emit their output to stdout. Similarly to the [`write!`]
//! macro, the goal of these macros is to avoid intermediate allocations when
//! printing output. Example usage is:
//!
//! ```
//! print!("Hello {}!", "world");
//! println!("I have a newline {}", "character at the end");
//! ```
//! ### `eprint!`
//!
//! The [`eprint!`] and [`eprintln!`] macros are identical to
//! [`print!`] and [`println!`], respectively, except they emit their
//! output to stderr.
//!
//! ### `format_args!`
//!
//! [`format_args!`] is a curious macro used to safely pass around
//! an opaque object describing the format string. This object
//! does not require any heap allocations to create, and it only
//! 提供关于栈的引用信息。在底层，所有相关宏都是基于此实现的。
//! 首先，一些使用示例如下：
//! 一些示例用法是：
//!
//! ```
//! # #![allow(unused_must_use)]
//! use std::fmt;
//! use std::io::{self, Write};
//!
//! let mut some_writer = io::stdout();
//! write!(&mut some_writer, "{}", format_args!("print with a {}", "macro"));
//!
//! fn my_fmt_fn(args: fmt::Arguments<'_>) {
//!     write!(&mut io::stdout(), "{args}");
//! }
//! my_fmt_fn(format_args!(", or a {} too", "function"));
//! ```
//!
//! The result of the [`format_args!`] macro is a value of type [`fmt::Arguments`].
//! This structure can then be passed to the [`write`] and [`format`] functions
//! 在这个模块中，以处理格式字符串。
//! 这个宏的目标是进一步避免中间分配。
//! 在处理格式字符串时尤其如此。
//!
//! 例如，一个日志库可以使用标准的格式语法，但
//! 它会内部传递这个结构，直到确定输出应放置的位置。
//! where output should go to.
//!
//! [`fmt::Result`]: Result "fmt::Result"
//! [Result]: core::result::Result "std::result::Result"
//! [std::fmt::Error]: Error "fmt::Error"
//! [`write`]: write() "fmt::write"
//! [`to_string`]: crate::string::ToString::to_string "ToString::to_string"
//! [`write_fmt`]: ../../std/io/trait.Write.html#method.write_fmt
//! [`std::io::Write`]: ../../std/io/trait.Write.html
//! [`std::fmt::Write`]: ../../std/fmt/trait.Write.html
//! [`print!`]: ../../std/macro.print.html "print!"
//! [`println!`]: ../../std/macro.println.html "println!"
//! [`eprint!`]: ../../std/macro.eprint.html "eprint!"
//! [`eprintln!`]: ../../std/macro.eprintln.html "eprintln!"
//! [`format_args!`]: ../../std/macro.format_args.html "format_args!"
//! [`fmt::Arguments`]: Arguments "fmt::Arguments"
//! [`format`]: format() "fmt::format"

#![stable(feature = "rust1", since = "1.0.0")]

#[stable(feature = "fmt_flags_align", since = "1.28.0")]
pub use core::fmt::Alignment;
#[stable(feature = "rust1", since = "1.0.0")]
pub use core::fmt::Error;
#[stable(feature = "fmt_numbuffer", since = "1.100.0")]
pub use core::fmt::NumBuffer;
#[stable(feature = "rust1", since = "1.0.0")]
pub use core::fmt::{Arguments, write};
#[stable(feature = "rust1", since = "1.0.0")]
pub use core::fmt::{Binary, Octal};
#[stable(feature = "rust1", since = "1.0.0")]
pub use core::fmt::{Debug, Display};
#[unstable(feature = "formatting_options", issue = "118117")]
pub use core::fmt::{DebugAsHex, FormattingOptions, Sign};
#[stable(feature = "rust1", since = "1.0.0")]
pub use core::fmt::{DebugList, DebugMap, DebugSet, DebugStruct, DebugTuple};
#[stable(feature = "rust1", since = "1.0.0")]
pub use core::fmt::{Formatter, Result, Write};
#[stable(feature = "fmt_from_fn", since = "1.93.0")]
pub use core::fmt::{FromFn, from_fn};
#[stable(feature = "rust1", since = "1.0.0")]
pub use core::fmt::{LowerExp, UpperExp};
#[stable(feature = "rust1", since = "1.0.0")]
pub use core::fmt::{LowerHex, Pointer, UpperHex};

#[cfg(not(no_global_oom_handling))]
use crate::string;

/// Takes an [`Arguments`] struct and returns the resulting formatted string.
///
/// The [`Arguments`] instance can be created with the [`format_args!`] macro.
///
/// # 示例
///
/// 基本用法：
///
/// ```
/// use std::fmt;
///
/// let s = fmt::format(format_args!("Hello, {}!", "world"));
/// assert_eq!(s, "Hello, world!");
/// ```
///
/// Please note that using [`format!`] might be preferable.
/// 示例：
///
/// ```
/// let s = format!("Hello, {}!", "world");
/// assert_eq!(s, "Hello, world!");
/// ```
///
/// [`format_args!`]: core::format_args
/// [`format!`]: crate::format
#[cfg(not(no_global_oom_handling))]
#[must_use]
#[stable(feature = "rust1", since = "1.0.0")]
#[inline]
pub fn format(args: Arguments<'_>) -> string::String {
    fn format_inner(args: Arguments<'_>) -> string::String {
        let capacity = args.estimated_capacity();
        let mut output = string::String::with_capacity(capacity);
        output
            .write_fmt(args)
            .expect("a formatting trait implementation returned an error when the underlying stream did not");
        output
    }

    args.as_str().map_or_else(|| format_inner(args), crate::borrow::ToOwned::to_owned)
}
