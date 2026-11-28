#[doc = include_str!("panic.md")]
#[macro_export]
#[rustc_builtin_macro(core_panic)]
#[allow_internal_unstable(edition_panic)]
#[stable(feature = "core", since = "1.6.0")]
#[rustc_diagnostic_item = "core_panic_macro"]
macro_rules! panic {
    // Expands to either `$crate::panic::panic_2015` or `$crate::panic::panic_2021`
    // depending on the edition of the caller.
    ($($arg:tt)*) => {
        /* compiler built-in */
    };
}

/// Asserts that two expressions are equal to each other (using [`PartialEq`]).
///
/// 断言在调试和发布构建中都会被检查，且无法
/// be disabled. See [`debug_assert_eq!`] for assertions that are disabled in
/// 默认情况下，发布构建会检查这些断言。
///
/// [`debug_assert_eq!`]: crate::debug_assert_eq
///
/// 在 panic 时，此宏将输出表达式的
/// 调试表示形式的值。
///
/// Like [`assert!`], this macro has a second form, where a custom
/// panic 消息。
///
/// # 示例
///
/// ```
/// let a = 3;
/// let b = 1 + 2;
/// assert_eq!(a, b);
///
/// assert_eq!(a, b, "we are testing addition with {} and {}", a, b);
/// ```
#[macro_export]
#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_diagnostic_item = "assert_eq_macro"]
#[allow_internal_unstable(panic_internals)]
#[rustc_diagnostic_opaque]
macro_rules! assert_eq {
    ($left:expr, $right:expr $(,)?) => {{
        match (&$left, &$right) {
            (left_val, right_val) => {
                if !(*left_val == *right_val) {
                    let kind = $crate::panicking::AssertKind::Eq;
                    // The reborrows below are intentional. Without them, the stack slot for the
                    // borrow is initialized even before the values are compared, leading to a
                    // noticeable slow down.
                    $crate::panicking::assert_failed(kind, &*left_val, &*right_val, $crate::option::Option::None);
                }
            }
        }
    }};
    ($left:expr, $right:expr, $($arg:tt)+) => {{
        match (&$left, &$right) {
            (left_val, right_val) => {
                if !(*left_val == *right_val) {
                    let kind = $crate::panicking::AssertKind::Eq;
                    // The reborrows below are intentional. Without them, the stack slot for the
                    // borrow is initialized even before the values are compared, leading to a
                    // noticeable slow down.
                    $crate::panicking::assert_failed(kind, &*left_val, &*right_val, $crate::option::Option::Some($crate::format_args!($($arg)+)));
                }
            }
        }
    }};
}

/// Asserts that two expressions are not equal to each other (using [`PartialEq`]).
///
/// 断言在调试和发布构建中都会被检查，且无法
/// be disabled. See [`debug_assert_ne!`] for assertions that are disabled in
/// 默认情况下，发布构建会检查这些断言。
///
/// [`debug_assert_ne!`]: crate::debug_assert_ne
///
/// 在 panic 时，此宏将输出表达式的
/// 调试表示形式的值。
///
/// Like [`assert!`], this macro has a second form, where a custom
/// panic 消息。
///
/// # 示例
///
/// ```
/// let a = 3;
/// let b = 2;
/// assert_ne!(a, b);
///
/// assert_ne!(a, b, "we are testing that the values are not equal");
/// ```
#[macro_export]
#[stable(feature = "assert_ne", since = "1.13.0")]
#[rustc_diagnostic_item = "assert_ne_macro"]
#[allow_internal_unstable(panic_internals)]
#[rustc_diagnostic_opaque]
macro_rules! assert_ne {
    ($left:expr, $right:expr $(,)?) => {{
        match (&$left, &$right) {
            (left_val, right_val) => {
                if *left_val == *right_val {
                    let kind = $crate::panicking::AssertKind::Ne;
                    // The reborrows below are intentional. Without them, the stack slot for the
                    // borrow is initialized even before the values are compared, leading to a
                    // noticeable slow down.
                    $crate::panicking::assert_failed(kind, &*left_val, &*right_val, $crate::option::Option::None);
                }
            }
        }
    }};
    ($left:expr, $right:expr, $($arg:tt)+) => {{
        match (&($left), &($right)) {
            (left_val, right_val) => {
                if *left_val == *right_val {
                    let kind = $crate::panicking::AssertKind::Ne;
                    // The reborrows below are intentional. Without them, the stack slot for the
                    // borrow is initialized even before the values are compared, leading to a
                    // noticeable slow down.
                    $crate::panicking::assert_failed(kind, &*left_val, &*right_val, $crate::option::Option::Some($crate::format_args!($($arg)+)));
                }
            }
        }
    }};
}

/// 用于断言一个表达式是否符合提供的模式。
///
/// This macro is generally preferable to `assert!(matches!(value, pattern))`, because it can print
/// 不符合预期的实际值形状的调试表示形式。相比之下，
/// using [`assert!`] will only print that expectations were not met, but not why.
///
/// The pattern syntax is exactly the same as found in a match arm and the `matches!` macro. The
/// 如果可以使用 optional if guard，则可以添加额外的检查条件，这些条件必须对匹配的值成立，
/// 否则此宏会触发 panic。
///
/// 断言在调试和发布构建中都会被检查，且无法
/// be disabled. See [`debug_assert_matches!`] for assertions that are disabled in
/// 默认情况下，发布构建会检查这些断言。
///
/// [`debug_assert_matches!`]: crate::debug_assert_matches
///
/// 在 panic 时，此宏将输出表达式的值及其调试表示形式。
///
/// Like [`assert!`], this macro has a second form, where a custom panic message can be provided.
///
/// # 示例
///
/// ```
/// use std::assert_matches;
///
/// let a = Some(345);
/// let b = Some(56);
/// assert_matches!(a, Some(_));
/// assert_matches!(b, Some(_));
///
/// assert_matches!(a, Some(345));
/// assert_matches!(a, Some(345) | None);
///
/// // assert_matches!(a, None); // panics
/// // assert_matches!(b, Some(345)); // panics
/// // assert_matches!(b, Some(345) | None); // panics
///
/// assert_matches!(a, Some(x) if x > 100);
/// // assert_matches!(a, Some(x) if x < 100); // panics
/// ```
#[stable(feature = "assert_matches", since = "1.96.0")]
#[allow_internal_unstable(panic_internals)]
#[rustc_macro_transparency = "semiopaque"]
pub macro assert_matches {
    ($left:expr, $(|)? $( $pattern:pat_param )|+ $( if $guard: expr )? $(,)?) => {{
        match $left {
            $( $pattern )|+ $( if $guard )? => {}
            ref left_val => {
                $crate::panicking::assert_matches_failed(
                    left_val,
                    $crate::stringify!($($pattern)|+ $(if $guard)?),
                    $crate::option::Option::None
                );
            }
        }
    }},
    ($left:expr, $(|)? $( $pattern:pat_param )|+ $( if $guard: expr )?, $($arg:tt)+) => {{
        match $left {
            $( $pattern )|+ $( if $guard )? => {}
            ref left_val => {
                $crate::panicking::assert_matches_failed(
                    left_val,
                    $crate::stringify!($($pattern)|+ $(if $guard)?),
                    $crate::option::Option::Some($crate::format_args!($($arg)+))
                );
            }
        }
    }},
}

/// Selects code at compile-time based on `cfg` predicates.
///
/// This macro evaluates, at compile-time, a series of `cfg` predicates,
/// 选择第一个为真的谓词，并输出由该谓词保护的代码。其他谓词保护的代码不会被输出。
/// predicate. The code guarded by other predicates is not emitted.
///
/// An optional trailing `_` wildcard can be used to specify a fallback. If
/// none of the predicates are true, a [`compile_error`] is emitted.
///
/// # Example
///
/// ```
/// cfg_select! {
///     unix => {
///         fn foo() { /* unix specific functionality */ }
///     }
///     target_pointer_width = "32" => {
///         fn foo() { /* non-unix, 32-bit functionality */ }
///     }
///     _ => {
///         fn foo() { /* fallback implementation */ }
///     }
/// }
/// ```
///
/// The `cfg_select!` macro can also be used in expression position, with or without braces on the
/// 右侧：
///
/// ```
/// let _some_string = cfg_select! {
///     unix => "With great power comes great electricity bills",
///     _ => { "Behind every successful diet is an unwatched pizza" }
/// };
/// ```
#[stable(feature = "cfg_select", since = "1.95.0")]
#[doc(alias = "cfg_if", alias = "cfg-if")]
#[rustc_diagnostic_item = "cfg_select"]
#[rustc_builtin_macro]
pub macro cfg_select($($tt:tt)*) {
    /* compiler built-in */
}

/// Asserts that a boolean expression is `true` at runtime.
///
/// This will invoke the [`panic!`] macro if the provided expression cannot be
/// evaluated to `true` at runtime.
///
/// Like [`assert!`], this macro also has a second version, where a custom panic
/// # 使用
///
/// # Uses
///
/// Unlike [`assert!`], `debug_assert!` statements are only enabled in non
/// # 示例
/// `debug_assert!` statements unless `-C debug-assertions` is passed to the
/// compiler. This makes `debug_assert!` useful for checks that are too
/// expensive to be present in a release build but may be helpful during
/// development. The result of expanding `debug_assert!` is always type checked.
///
/// 断言两个表达式不相等。
/// 在 panic 时，该宏将输出表达式的值及其调试表示形式。
/// unsafety as long as this only happens in safe code. The performance cost
/// of assertions, however, is not measurable in general. Replacing [`assert!`]
/// with `debug_assert!` is thus only encouraged after thorough profiling, and
/// more importantly, only in safe code!
///
/// # Examples
///
/// ```
/// // the panic message for these assertions is the stringified value of the
/// // expression given.
/// debug_assert!(true);
///
/// fn some_expensive_computation() -> bool {
///     // Some expensive computation here
///     true
/// }
/// debug_assert!(some_expensive_computation());
///
/// // assert with a custom message
/// let x = true;
/// debug_assert!(x, "x wasn't true!");
///
/// let a = 3; let b = 27;
/// debug_assert!(a + b == 30, "a = {}, b = {}", a, b);
/// ```
#[macro_export]
#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_diagnostic_item = "debug_assert_macro"]
#[allow_internal_unstable(edition_panic)]
#[rustc_diagnostic_opaque]
macro_rules! debug_assert {
    ($($arg:tt)*) => {
        if $crate::cfg!(debug_assertions) {
            $crate::assert!($($arg)*);
        }
    };
}

/// Asserts that two expressions are equal to each other.
///
/// On panic, this macro will print the values of the expressions with their
/// debug representations.
///
/// Unlike [`assert_eq!`], `debug_assert_eq!` statements are only enabled in non
/// optimized builds by default. An optimized build will not execute
/// `debug_assert_eq!` statements unless `-C debug-assertions` is passed to the
/// compiler. This makes `debug_assert_eq!` useful for checks that are too
/// expensive to be present in a release build but may be helpful during
/// development. The result of expanding `debug_assert_eq!` is always type checked.
///
/// # Examples
///
/// ```
/// let a = 3;
/// let b = 1 + 2;
/// debug_assert_eq!(a, b);
/// ```
#[macro_export]
#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_diagnostic_item = "debug_assert_eq_macro"]
macro_rules! debug_assert_eq {
    ($($arg:tt)*) => {
        if $crate::cfg!(debug_assertions) {
            $crate::assert_eq!($($arg)*);
        }
    };
}

/// Asserts that two expressions are not equal to each other.
///
/// On panic, this macro will print the values of the expressions with their
/// debug representations.
///
/// Unlike [`assert_ne!`], `debug_assert_ne!` statements are only enabled in non
/// optimized builds by default. An optimized build will not execute
/// `debug_assert_ne!` statements unless `-C debug-assertions` is passed to the
/// compiler. This makes `debug_assert_ne!` useful for checks that are too
/// expensive to be present in a release build but may be helpful during
/// development. The result of expanding `debug_assert_ne!` is always type checked.
///
/// # Examples
///
/// ```
/// let a = 3;
/// let b = 2;
/// debug_assert_ne!(a, b);
/// ```
#[macro_export]
#[stable(feature = "assert_ne", since = "1.13.0")]
#[rustc_diagnostic_item = "debug_assert_ne_macro"]
macro_rules! debug_assert_ne {
    ($($arg:tt)*) => {
        if $crate::cfg!(debug_assertions) {
            $crate::assert_ne!($($arg)*);
        }
    };
}

/// Asserts that an expression matches the provided pattern.
///
/// This macro is generally preferable to `debug_assert!(matches!(value, pattern))`, because it can
/// 打印不符合预期的实际值形状的调试表示。
/// contrast, using [`debug_assert!`] will only print that expectations were not met, but not why.
///
/// The pattern syntax is exactly the same as found in a match arm and the `matches!` macro. The
/// optional if guard 可用于添加额外的检查条件，这些条件必须对匹配的值成立。
/// 否则，此宏会触发 panic。
///
/// 在触发 panic 时，此宏会打印表达式的值及其调试表示。
///
/// Like [`assert!`], this macro has a second form, where a custom panic message can be provided.
///
/// Unlike [`assert_matches!`], `debug_assert_matches!` statements are only enabled in non optimized
/// builds by default. An optimized build will not execute `debug_assert_matches!` statements unless
/// `-C debug-assertions` is passed to the compiler. This makes `debug_assert_matches!` useful for
/// checks that are too expensive to be present in a release build but may be helpful during
/// development. The result of expanding `debug_assert_matches!` is always type checked.
///
/// # 返回给定表达式是否匹配提供的模式。
///
/// ```
/// use std::debug_assert_matches;
///
/// let a = Some(345);
/// let b = Some(56);
/// debug_assert_matches!(a, Some(_));
/// debug_assert_matches!(b, Some(_));
///
/// debug_assert_matches!(a, Some(345));
/// debug_assert_matches!(a, Some(345) | None);
///
/// // debug_assert_matches!(a, None); // panics
/// // debug_assert_matches!(b, Some(345)); // panics
/// // debug_assert_matches!(b, Some(345) | None); // panics
///
/// debug_assert_matches!(a, Some(x) if x > 100);
/// // debug_assert_matches!(a, Some(x) if x < 100); // panics
/// ```
#[stable(feature = "assert_matches", since = "1.96.0")]
#[allow_internal_unstable(assert_matches)]
#[rustc_macro_transparency = "semiopaque"]
pub macro debug_assert_matches($($arg:tt)*) {
    if $crate::cfg!(debug_assertions) {
        $crate::assert_matches!($($arg)*);
    }
}

/// 返回给定表达式是否匹配提供的模式。
///
/// 模式语法与 match arm 中的相同。optional if guard 可用于
/// 添加额外的检查条件，这些条件必须对匹配的值成立；否则此宏会
/// return `false`.
///
/// 在测试值是否匹配模式时，通常建议使用
/// [`assert_matches!`] as it will print the debug representation of the value if the assertion
/// # 示例
///
/// # 解包结果或传播其错误。
///
/// ```
/// let foo = 'f';
/// assert!(matches!(foo, 'A'..='Z' | 'a'..='z'));
///
/// let bar = Some(4);
/// assert!(matches!(bar, Some(x) if x > 2));
/// ```
#[macro_export]
#[stable(feature = "matches_macro", since = "1.42.0")]
#[rustc_diagnostic_item = "matches_macro"]
#[allow_internal_unstable(non_exhaustive_omitted_patterns_lint, stmt_expr_attributes)]
#[rustc_diagnostic_opaque]
macro_rules! matches {
    ($expression:expr, $pattern:pat $(if $guard:expr)? $(,)?) => {
        #[allow(non_exhaustive_omitted_patterns)]
        match $expression {
            $pattern $(if $guard)? => true,
            _ => false
        }
    };
}

/// Unwraps a result or propagates its error.
///
/// The [`?` operator][propagating-errors] was added to replace `try!`
/// and should be used instead. Furthermore, `try` is a reserved word
/// in Rust 2018, so if you must use it, you will need to use the
/// [raw-identifier syntax][ris]: `r#try`.
///
/// [propagating-errors]: https://doc.rust-lang.org/book/ch09-02-recoverable-errors-with-result.html#a-shortcut-for-propagating-errors-the--operator
/// [ris]: ../rust-by-example/compatibility/raw_identifiers.html
///
/// `try!` matches the given [`Result`]. In case of the `Ok` variant, the
/// expression has the value of the wrapped value.
///
/// In case of the `Err` variant, it retrieves the inner error. `try!` then
/// performs conversion using `From`. This provides automatic conversion
/// # 示例
/// 将格式化数据写入缓冲区。
///
/// Because of the early return, `try!` can only be used in functions that
/// return [`Result`].
///
/// # Examples
///
/// ```
/// use std::io;
/// use std::fs::File;
/// use std::io::prelude::*;
///
/// enum MyError {
///     FileWriteError
/// }
///
/// impl From<io::Error> for MyError {
///     fn from(e: io::Error) -> MyError {
///         MyError::FileWriteError
///     }
/// }
///
/// // The preferred method of quick returning Errors
/// fn write_to_file_question() -> Result<(), MyError> {
///     let mut file = File::create("my_best_friends.txt")?;
///     file.write_all(b"This is a list of my best friends.")?;
///     Ok(())
/// }
///
/// // The previous method of quick returning Errors
/// fn write_to_file_using_try() -> Result<(), MyError> {
///     let mut file = r#try!(File::create("my_best_friends.txt"));
///     r#try!(file.write_all(b"This is a list of my best friends."));
///     Ok(())
/// }
///
/// // This is equivalent to:
/// fn write_to_file_using_match() -> Result<(), MyError> {
///     let mut file = r#try!(File::create("my_best_friends.txt"));
///     match file.write_all(b"This is a list of my best friends.") {
///         Ok(v) => v,
///         Err(e) => return Err(From::from(e)),
///     }
///     Ok(())
/// }
/// ```
#[macro_export]
#[stable(feature = "rust1", since = "1.0.0")]
#[deprecated(since = "1.39.0", note = "use the `?` operator instead")]
#[doc(alias = "?")]
macro_rules! r#try {
    ($expr:expr $(,)?) => {
        match $expr {
            $crate::result::Result::Ok(val) => val,
            $crate::result::Result::Err(err) => {
                return $crate::result::Result::Err($crate::convert::From::from(err));
            }
        }
    };
}

/// Writes formatted data into a buffer.
///
/// This macro accepts a 'writer', a format string, and a list of arguments. Arguments will be
/// 根据指定的格式字符串进行格式化，结果将传递给写入器。
/// The writer may be any value with a `write_fmt` method; generally this comes from an
/// implementation of either the [`fmt::Write`] or the [`io::Write`] trait. The macro
/// returns whatever the `write_fmt` method returns; commonly a [`fmt::Result`], or an
/// [`io::Result`].
///
/// See [`std::fmt`] for more information on the format string syntax.
///
/// [`std::fmt`]: ../std/fmt/index.html
/// [`fmt::Write`]: crate::fmt::Write
/// [`io::Write`]: ../std/io/trait.Write.html
/// [`fmt::Result`]: crate::fmt::Result
/// [`io::Result`]: ../std/io/type.Result.html
///
/// # 示例
///
/// ```
/// use std::io::Write;
///
/// fn main() -> std::io::Result<()> {
///     let mut w = Vec::new();
///     write!(&mut w, "test")?;
///     write!(&mut w, "formatted {}", "arguments")?;
///
///     assert_eq!(w, b"testformatted arguments");
///     Ok(())
/// }
/// ```
///
/// A module can import both `std::fmt::Write` and `std::io::Write` and call `write!` on objects
/// 实现任一者即可，因为对象通常不同时实现两者。但是，模块必须
/// avoid conflict between the trait names, such as by importing them as `_` or otherwise renaming
/// 如果还需要 trait 名称本身，例如要在类型上实现其中一个或多个 trait，
///
/// ```
/// use std::fmt::Write as _;
/// use std::io::Write as _;
///
/// fn main() -> Result<(), Box<dyn std::error::Error>> {
///     let mut s = String::new();
///     let mut v = Vec::new();
///
///     write!(&mut s, "{} {}", "abc", 123)?; // uses fmt::Write::write_fmt
///     write!(&mut v, "s = {:?}", s)?; // uses io::Write::write_fmt
///     assert_eq!(v, b"s = \"abc 123\"");
///     Ok(())
/// }
/// ```
///
/// 请导入包含模块，然后用前缀命名它们：
/// import the containing module and then name them with a prefix:
///
/// ```
/// # #![allow(unused_imports)]
/// use std::fmt::{self, Write as _};
/// use std::io::{self, Write as _};
///
/// struct Example;
///
/// impl fmt::Write for Example {
///     fn write_str(&mut self, _s: &str) -> core::fmt::Result {
///          unimplemented!();
///     }
/// }
/// ```
///
/// Note: This macro can be used in `no_std` setups as well.
/// In a `no_std` setup you are responsible for the implementation details of the components.
///
/// ```no_run
/// use core::fmt::Write;
///
/// struct Example;
///
/// impl Write for Example {
///     fn write_str(&mut self, _s: &str) -> core::fmt::Result {
///          unimplemented!();
///     }
/// }
///
/// let mut m = Example{};
/// write!(&mut m, "Hello World").expect("Writing to `Example` should succeed");
/// ```
#[macro_export]
#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_diagnostic_item = "write_macro"]
#[rustc_diagnostic_opaque]
macro_rules! write {
    ($dst:expr, $($arg:tt)*) => {
        $dst.write_fmt($crate::format_args!($($arg)*))
    };
    ($($arg:tt)*) => {
        compile_error!("requires a destination and format arguments, like `write!(dest, \"format string\", args...)`")
    };
}

/// Writes formatted data into a buffer, with a newline appended.
///
/// On all platforms, the newline is the LINE FEED character (`\n`/`U+000A`) alone
/// (no additional CARRIAGE RETURN (`\r`/`U+000D`).
///
/// For more information, see [`write!`]. For information on the format string syntax, see
/// [`std::fmt`].
///
/// [`std::fmt`]: ../std/fmt/index.html
///
/// # 示例
///
/// ```
/// use std::io::{Write, Result};
///
/// fn main() -> Result<()> {
///     let mut w = Vec::new();
///     writeln!(&mut w)?;
///     writeln!(&mut w, "test")?;
///     writeln!(&mut w, "formatted {}", "arguments")?;
///
///     assert_eq!(&w[..], "\ntest\nformatted arguments\n".as_bytes());
///     Ok(())
/// }
/// ```
#[macro_export]
#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_diagnostic_item = "writeln_macro"]
#[allow_internal_unstable(format_args_nl)]
#[rustc_diagnostic_opaque]
macro_rules! writeln {
    ($dst:expr $(,)?) => {
        $crate::write!($dst, "\n")
    };
    ($dst:expr, $($arg:tt)*) => {
        $dst.write_fmt($crate::format_args_nl!($($arg)*))
    };
    ($($arg:tt)*) => {
        compile_error!("requires a destination and format arguments, like `writeln!(dest, \"format string\", args...)`")
    };
}

/// 表示不可达代码。
///
/// 当编译器无法确定某些代码不可达时，此功能非常有用。例如：
/// 示例：
///
/// * 带有保护条件的匹配分支。
/// * 动态终止的循环。
/// * 动态终止的迭代器。
///
/// If the determination that the code is unreachable proves incorrect, the
/// program immediately terminates with a [`panic!`].
///
/// The unsafe counterpart of this macro is the [`unreachable_unchecked`] function, which
/// # Panics
///
/// [`unreachable_unchecked`]: crate::hint::unreachable_unchecked
///
/// # Panics
///
/// This will always [`panic!`] because `unreachable!` is just a shorthand for `panic!` with a
/// # 示例
///
/// Like `panic!`, this macro has a second form for displaying custom values.
///
/// # 迭代器：
///
/// 表示未实现代码，通过以“未实现”消息 panic 来显示。
///
/// ```
/// # #[allow(dead_code)]
/// fn foo(x: Option<i32>) {
///     match x {
///         Some(n) if n >= 0 => println!("Some(Non-negative)"),
///         Some(n) if n <  0 => println!("Some(Negative)"),
///         Some(_)           => unreachable!(), // compile error if commented out
///         None              => println!("None")
///     }
/// }
/// ```
///
/// 这允许您的代码进行类型检查，如果您正在原型设计或
///
/// ```
/// # #[allow(dead_code)]
/// fn divide_by_three(x: u32) -> u32 { // one of the poorest implementations of x/3
///     for i in 0.. {
///         if 3*i < i { panic!("u32 overflow"); }
///         if x < 3*i { return i-1; }
///     }
///     unreachable!("The loop should always return");
/// }
/// ```
#[macro_export]
#[rustc_builtin_macro(unreachable)]
#[allow_internal_unstable(edition_panic)]
#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_diagnostic_item = "unreachable_macro"]
macro_rules! unreachable {
    // Expands to either `$crate::panic::unreachable_2015` or `$crate::panic::unreachable_2021`
    // depending on the edition of the caller.
    ($($arg:tt)*) => {
        /* compiler built-in */
    };
}

/// 实现需要多个方法的 trait，而您不打算使用所有方法时非常有用。
///
/// This allows your code to type-check, which is useful if you are prototyping or
/// implementing a trait that requires multiple methods which you don't plan to use all of.
///
/// The difference between `unimplemented!` and [`todo!`] is that while `todo!`
/// 表示后续将实现该功能，且当前消息为“尚未实现”。
/// implemented", `unimplemented!` makes no such claims. Its message is "not implemented".
///
/// Also, some IDEs will mark `todo!`s.
///
/// # Panics
///
/// This will always [`panic!`] because `unimplemented!` is just a shorthand for `panic!` with a
/// 表示代码未完成。
///
/// Like `panic!`, this macro has a second form for displaying custom values.
///
/// [`todo!`]: crate::todo
///
/// # 示例
///
/// Say we have a trait `Foo`:
///
/// ```
/// trait Foo {
///     fn bar(&self) -> u8;
///     fn baz(&self);
///     fn qux(&self) -> Result<u64, ()>;
/// }
/// ```
///
/// We want to implement `Foo` for 'MyStruct', but for some reason it only makes sense
/// to implement the `bar()` function. `baz()` and `qux()` will still need to be defined
/// in our implementation of `Foo`, but we can use `unimplemented!` in their definitions
/// to allow our code to compile.
///
/// 后续将实现该功能，且当前消息为“尚未实现”。
/// reached.
///
/// ```
/// # trait Foo {
/// #     fn bar(&self) -> u8;
/// #     fn baz(&self);
/// #     fn qux(&self) -> Result<u64, ()>;
/// # }
/// struct MyStruct;
///
/// impl Foo for MyStruct {
///     fn bar(&self) -> u8 {
///         1 + 1
///     }
///
///     fn baz(&self) {
///         // It makes no sense to `baz` a `MyStruct`, so we have no logic here
///         // at all.
///         // This will display "thread 'main' panicked at 'not implemented'".
///         unimplemented!();
///     }
///
///     fn qux(&self) -> Result<u64, ()> {
///         // We have some logic here,
///         // We can add a message to unimplemented! to display our omission.
///         // This will display:
///         // "thread 'main' panicked at 'not implemented: MyStruct isn't quxable'".
///         unimplemented!("MyStruct isn't quxable");
///     }
/// }
///
/// fn main() {
///     let s = MyStruct;
///     s.bar();
/// }
/// ```
#[macro_export]
#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_diagnostic_item = "unimplemented_macro"]
#[allow_internal_unstable(panic_internals)]
#[rustc_diagnostic_opaque]
macro_rules! unimplemented {
    () => {
        $crate::panicking::unimplemented_default_msg()
    };
    ($($arg:tt)+) => {
        $crate::panic!("not implemented: {}", $crate::format_args!($($arg)+))
    };
}

/// Indicates unfinished code.
///
/// # Panics
/// want a placeholder to let your code pass type analysis.
///
/// The difference between [`unimplemented!`] and `todo!` is that while `todo!` conveys
/// 后续将实现该功能，且当前消息为“尚未实现”。
/// implemented", `unimplemented!` makes no such claims. Its message is "not implemented".
///
/// Also, some IDEs will mark `todo!`s.
///
/// # Panics
///
/// This will always [`panic!`] because `todo!` is just a shorthand for `panic!` with a
/// 带有固定、具体消息。
///
/// Like `panic!`, this macro has a second form for displaying custom values.
///
/// # 示例
///
/// Here's an example of some in-progress code. We have a trait `Foo`:
///
/// ```
/// trait Foo {
///     fn bar(&self) -> u8;
///     fn baz(&self);
///     fn qux(&self) -> Result<u64, ()>;
/// }
/// ```
///
/// We want to implement `Foo` on one of our types, but we also want to work on
/// just `bar()` first. In order for our code to compile, we need to implement
/// `baz()` and `qux()`, so we can use `todo!`:
///
/// ```
/// # trait Foo {
/// #     fn bar(&self) -> u8;
/// #     fn baz(&self);
/// #     fn qux(&self) -> Result<u64, ()>;
/// # }
/// struct MyStruct;
///
/// impl Foo for MyStruct {
///     fn bar(&self) -> u8 {
///         1 + 1
///     }
///
///     fn baz(&self) {
///         // Let's not worry about implementing baz() for now
///         todo!();
///     }
///
///     fn qux(&self) -> Result<u64, ()> {
///         // We can add a message to todo! to display our omission.
///         // This will display:
///         // "thread 'main' panicked at 'not yet implemented: MyStruct is not yet quxable'".
///         todo!("MyStruct is not yet quxable");
///     }
/// }
///
/// fn main() {
///     let s = MyStruct;
///     s.bar();
///
///     // We aren't even using baz() or qux(), so this is fine.
/// }
/// ```
#[macro_export]
#[stable(feature = "todo_macro", since = "1.40.0")]
#[rustc_diagnostic_item = "todo_macro"]
#[allow_internal_unstable(panic_internals)]
#[rustc_diagnostic_opaque]
macro_rules! todo {
    () => {
        $crate::panicking::todo_default_msg()
    };
    ($($arg:tt)+) => {
        $crate::panic!("not yet implemented: {}", $crate::format_args!($($arg)+))
    };
}

/// 大多数宏属性（稳定性、可见性等）均来自这里的源代码，
///
/// 除了将宏输入转换为输出的展开函数外，
/// 这些函数由编译器提供。
/// 当遇到时会导致编译失败并输出给定错误信息。
pub(crate) mod builtin {

    /// 当遇到此宏时，会导致编译失败并输出指定错误信息。
    ///
    /// This macro should be used when a crate uses a conditional compilation strategy to provide
    /// better error messages for erroneous conditions. It's the compiler-level form of [`panic!`],
    /// but emits an error during *compilation* rather than at *runtime*.
    ///
    /// # 示例
    ///
    /// Two such examples are macros and `#[cfg]` environments.
    ///
    /// 如果传递了无效值，会生成更完善的编译器错误。如果没有最终分支，
    /// 编译器仍然会生成错误，但错误消息不会提及这两个
    /// 有效值。
    ///
    /// ```compile_fail
    /// macro_rules! give_me_foo_or_bar {
    ///     (foo) => {};
    ///     (bar) => {};
    ///     ($x:ident) => {
    ///         compile_error!("This macro only accepts `foo` or `bar`");
    ///     }
    /// }
    ///
    /// give_me_foo_or_bar!(neither);
    /// // ^ will fail at compile time with message "This macro only accepts `foo` or `bar`"
    /// ```
    ///
    /// 如果多个功能中的某个不可用，则生成编译器错误。
    ///
    /// ```compile_fail
    /// #[cfg(not(any(feature = "foo", feature = "bar")))]
    /// compile_error!("Either feature \"foo\" or \"bar\" must be enabled for this crate.");
    /// ```
    #[stable(feature = "compile_error_macro", since = "1.20.0")]
    #[rustc_builtin_macro]
    #[macro_export]
    macro_rules! compile_error {
        ($msg:expr $(,)?) => {{ /* compiler built-in */ }};
    }

    /// 为其他字符串格式化宏构建参数。
    ///
    /// 该宏通过接收包含
    /// `{}` for each additional argument passed. `format_args!` prepares the
    /// 额外参数，以确保输出可以被解释为字符串
    /// 并将参数规范化为单一类型。任何实现
    /// the [`Display`] trait can be passed to `format_args!`, as can any
    /// [`Debug`] implementation be passed to a `{:?}` within the formatting string.
    ///
    /// This macro produces a value of type [`fmt::Arguments`]. This value can be
    /// passed to the macros within [`std::fmt`] for performing useful redirection.
    /// All other formatting macros ([`format!`], [`write!`], [`println!`], etc) are
    /// proxied through this one. `format_args!`, unlike its derived macros, avoids
    /// 堆分配。
    ///
    /// You can use the [`fmt::Arguments`] value that `format_args!` returns
    /// in `Debug` and `Display` contexts as seen below. The example also shows
    /// that `Debug` and `Display` format to the same thing: the interpolated
    /// format string in `format_args!`.
    ///
    /// ```rust
    /// let args = format_args!("{} foo {:?}", 1, 2);
    /// let debug = format!("{args:?}");
    /// let display = format!("{args}");
    /// assert_eq!("1 foo 2", display);
    /// assert_eq!(display, debug);
    /// ```
    ///
    /// See [the formatting documentation in `std::fmt`](../std/fmt/index.html)
    /// 的格式化文档。
    ///
    /// [`Display`]: crate::fmt::Display
    /// [`Debug`]: crate::fmt::Debug
    /// [`fmt::Arguments`]: crate::fmt::Arguments
    /// [`std::fmt`]: ../std/fmt/index.html
    /// [`format!`]: ../std/macro.format.html
    /// [`println!`]: ../std/macro.println.html
    ///
    /// # 示例
    ///
    /// ```
    /// use std::fmt;
    ///
    /// let s = fmt::format(format_args!("hello {}", "world"));
    /// assert_eq!(s, format!("hello {}", "world"));
    /// ```
    ///
    /// # 参数生命周期
    ///
    /// 除非没有使用格式化参数，
    /// the produced `fmt::Arguments` value borrows temporary values.
    /// 为了允许其被存储以供以后使用，参数的生命周期以及它们借用的
    /// temporaries they borrow, may be [extended] when `format_args!` appears in the initializer
    /// expression of a `let` statement. The syntactic rules used to determine when temporaries'
    /// 生命周期何时被扩展的语法规则在 [参考手册] 中有说明。
    ///
    /// [extended]: ../reference/destructors.html#temporary-lifetime-extension
    /// [Reference]: ../reference/destructors.html#extending-based-on-expressions
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_diagnostic_item = "format_args_macro"]
    #[allow_internal_unsafe]
    #[allow_internal_unstable(fmt_internals, fmt_arguments_from_str)]
    #[rustc_builtin_macro]
    #[macro_export]
    macro_rules! format_args {
        ($fmt:expr) => {{ /* compiler built-in */ }};
        ($fmt:expr, $($args:tt)*) => {{ /* compiler built-in */ }};
    }

    /// Same as [`format_args`], but can be used in some const contexts.
    ///
    /// This macro is used by the panic macros for the `const_panic` feature.
    ///
    /// This macro will be removed once `format_args` is allowed in const contexts.
    #[unstable(feature = "const_format_args", issue = "none")]
    #[allow_internal_unstable(fmt_internals, fmt_arguments_from_str)]
    #[rustc_builtin_macro]
    #[macro_export]
    macro_rules! const_format_args {
        ($fmt:expr) => {{ /* compiler built-in */ }};
        ($fmt:expr, $($args:tt)*) => {{ /* compiler built-in */ }};
    }

    /// Same as [`format_args`], but adds a newline in the end.
    #[unstable(
        feature = "format_args_nl",
        issue = "none",
        reason = "`format_args_nl` is only for internal \
                  language use and is subject to change"
    )]
    #[allow_internal_unstable(fmt_internals, fmt_arguments_from_str)]
    #[rustc_builtin_macro]
    #[doc(hidden)]
    #[macro_export]
    macro_rules! format_args_nl {
        ($fmt:expr) => {{ /* compiler built-in */ }};
        ($fmt:expr, $($args:tt)*) => {{ /* compiler built-in */ }};
    }

    /// 在编译时检查环境变量。
    ///
    /// 该宏将展开为指定环境变量的值。
    /// compile time, yielding an expression of type `&'static str`. Use
    /// [`std::env::var`] instead if you want to read the value at runtime.
    ///
    /// [`std::env::var`]: ../std/env/fn.var.html
    ///
    /// 如果环境变量未定义，则会引发编译错误。
    /// will be emitted. To not emit a compile error, use the [`option_env!`]
    /// 环境变量不是有效的 Unicode 字符串，同样会引发编译错误。
    /// # 示例
    ///
    /// # 可以通过将字符串作为第二个参数来自定义错误信息：
    ///
    /// ```
    /// let path: &'static str = env!("PATH");
    /// println!("the $PATH variable at the time of compiling was: {path}");
    /// ```
    ///
    /// You can customize the error message by passing a string as the second
    /// 在编译时可选地检查环境变量。
    ///
    /// ```compile_fail
    /// let doc: &'static str = env!("documentation", "what's that?!");
    /// ```
    ///
    /// If the `documentation` environment variable is not defined, you'll get
    /// the following error:
    ///
    /// ```text
    /// error: what's that?!
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_builtin_macro]
    #[macro_export]
    #[rustc_diagnostic_item = "env_macro"] // useful for external lints
    macro_rules! env {
        ($name:expr $(,)?) => {{ /* compiler built-in */ }};
        ($name:expr, $error_msg:expr $(,)?) => {{ /* compiler built-in */ }};
    }

    /// 如果环境变量不是有效的 Unicode 字符串，则会引发 panic。如果环境变量不存在，则
    ///
    /// If the named environment variable is present at compile time, this will
    /// expand into an expression of type `Option<&'static str>` whose value is
    /// `Some` of the value of the environment variable (a compilation error
    /// 如果环境变量不是有效的 Unicode 字符串，则会引发 panic。如果环境变量不存在，则
    /// string). If the environment variable is not present, then this will
    /// expand to `None`. See [`Option<T>`][Option] for more information on this
    /// type.  Use [`std::env::var`] instead if you want to read the value at
    /// runtime.
    ///
    /// [`std::env::var`]: ../std/env/fn.var.html
    ///
    /// A compile time error is only emitted when using this macro if the
    /// # 示例
    /// 将字面量连接成静态字符串切片。
    /// [`env!`] macro instead.
    ///
    /// # 将字面量连接成静态字符串切片。
    ///
    /// ```
    /// let key: Option<&'static str> = option_env!("SECRET_KEY");
    /// println!("the secret key might be: {key:?}");
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_builtin_macro]
    #[macro_export]
    #[rustc_diagnostic_item = "option_env_macro"] // useful for external lints
    macro_rules! option_env {
        ($name:expr $(,)?) => {{ /* compiler built-in */ }};
    }

    /// 将字面量连接成字节切片。
    ///
    /// 此宏接受任意数量的逗号分隔的字面量，并将它们全部连接成
    /// one, yielding an expression of type `&[u8; _]`, which represents all of the literals
    /// 连接的字面量可以是以下任意组合：
    ///
    /// - byte literals (`b'r'`)
    /// - byte strings (`b"Rust"`)
    /// - arrays of bytes/numbers (`[b'A', 66, b'C']`)
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(concat_bytes)]
    ///
    /// # fn main() {
    /// let s: &[u8; 6] = concat_bytes!(b'A', b"BC", [68, b'E', 70]);
    /// assert_eq!(s, b"ABCDEF");
    /// # }
    /// ```
    #[unstable(feature = "concat_bytes", issue = "87555")]
    #[rustc_builtin_macro]
    #[macro_export]
    macro_rules! concat_bytes {
        ($($e:literal),+ $(,)?) => {{ /* compiler built-in */ }};
    }

    /// 将字面量连接成静态字符串切片。
    ///
    /// This macro takes any number of comma-separated literals, yielding an
    /// expression of type `&'static str` which represents all of the literals
    /// concatenated left-to-right.
    ///
    /// Integer and floating point literals are [stringified](core::stringify) in order to be
    /// # 示例
    ///
    /// # 展开后显示调用时的行号。
    ///
    /// ```
    /// let s = concat!("test", 10, 'b', true);
    /// assert_eq!(s, "test10btrue");
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_builtin_macro]
    #[rustc_diagnostic_item = "macro_concat"]
    #[macro_export]
    macro_rules! concat {
        ($($e:expr),* $(,)?) => {{ /* compiler built-in */ }};
    }

    /// Expands to the line number on which it was invoked.
    ///
    /// With [`column!`] and [`file!`], these macros provide debugging information for
    /// developers about the location within the source.
    ///
    /// The expanded expression has type `u32` and is 1-based, so the first line
    /// 每个文件中的值为 1、2、3……这是一致的。
    /// 常见编译器或编辑器会输出错误信息。
    /// The returned line is *not necessarily* the line of the `line!` invocation itself,
    /// but rather the first macro invocation leading up to the invocation
    /// of the `line!` macro.
    ///
    /// # 示例
    ///
    /// ```
    /// let current_line = line!();
    /// println!("defined on line: {current_line}");
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_builtin_macro]
    #[macro_export]
    macro_rules! line {
        () => {
            /* compiler built-in */
        };
    }

    /// 展开后显示其被调用的列号。
    ///
    /// With [`line!`] and [`file!`], these macros provide debugging information for
    /// 开发者提供关于源代码中的位置信息。
    ///
    /// The expanded expression has type `u32` and is 1-based, so the first column
    /// 值为 1、2、3……这是一致的。
    /// 常见编译器或编辑器会输出错误信息。
    /// The returned column is *not necessarily* the line of the `column!` invocation itself,
    /// but rather the first macro invocation leading up to the invocation
    /// of the `column!` macro.
    ///
    /// # 示例
    ///
    /// ```
    /// let current_col = column!();
    /// println!("defined on column: {current_col}");
    /// ```
    ///
    /// `column!` counts Unicode code points, not bytes or graphemes. As a result, the first two
    /// 展开后显示其被调用的文件名。
    ///
    /// ```
    /// let a = ("foobar", column!()).1;
    /// let b = ("人之初性本善", column!()).1;
    /// let c = ("f̅o̅o̅b̅a̅r̅", column!()).1; // Uses combining overline (U+0305)
    ///
    /// assert_eq!(a, b);
    /// assert_ne!(b, c);
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_builtin_macro]
    #[macro_export]
    macro_rules! column {
        () => {
            /* compiler built-in */
        };
    }

    /// Expands to the file name in which it was invoked.
    ///
    /// With [`line!`] and [`column!`], these macros provide debugging information for
    /// developers about the location within the source.
    ///
    /// The expanded expression has type `&'static str`, and the returned file
    /// is not the invocation of the `file!` macro itself, but rather the
    /// first macro invocation leading up to the invocation of the `file!`
    /// 宏。
    ///
    /// 文件名来自传递给 Rust 编译器的 crate 根目录的源路径，
    /// and the sequence the compiler takes to get from the crate root to the
    /// module containing `file!`, modified by any flags passed to the Rust compiler (e.g.
    /// `--remap-path-prefix`).  If the crate's source path is relative, the initial base
    /// 与此类选项不兼容，可能建议不要使用这些选项。
    /// path passed to the compiler is `./src/lib.rs` which has a `mod foo;` with a source path of
    /// `src/foo/mod.rs`, then calling `file!` inside `mod foo;` will return `./src/foo/mod.rs`.
    ///
    /// Future compiler options might make further changes to the behavior of `file!`,
    /// including potentially making it entirely empty. Code (e.g. test libraries)
    /// relying on `file!` producing an openable file path would be incompatible
    /// with such options, and might wish to recommend not using those options.
    ///
    /// # 示例
    ///
    /// ```
    /// let this_file = file!();
    /// println!("defined in file: {this_file}");
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_builtin_macro]
    #[macro_export]
    macro_rules! file {
        () => {
            /* compiler built-in */
        };
    }

    /// 将其参数进行字符串化处理。
    ///
    /// This macro will yield an expression of type `&'static str` which is the
    /// 令牌的字符串化结果。对宏调用本身的语法没有限制。
    /// 任何限制。
    ///
    /// 请注意，输入令牌的展开结果在将来可能会发生变化。如果依赖输出结果，应谨慎行事。
    /// # 示例
    ///
    /// # 将 UTF-8 编码的文件作为字符串包含进来。
    ///
    /// ```
    /// let one_plus_one = stringify!(1 + 1);
    /// assert_eq!(one_plus_one, "1 + 1");
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_builtin_macro]
    #[macro_export]
    macro_rules! stringify {
        ($($t:tt)*) => {
            /* compiler built-in */
        };
    }

    /// 文件相对于当前文件定位（类似于模块查找的方式）。提供的路径在编译时以特定平台
    ///
    /// 的方式解释。因此，例如，带有反斜杠的 Windows 路径在 Unix 系统上无法正确编译。
    /// 调用将展开为表示当前模块路径的字符串。
    /// # 示例
    /// containing backslashes `\` would not compile correctly on Unix.
    ///
    /// This macro will yield an expression of type `&'static str` which is the
    /// 文件 'main.rs'：
    ///
    /// # 示例
    ///
    /// 假设同一目录中有两个文件，内容如下：
    /// 内容：
    ///
    /// 文件 'spanish.in'：
    ///
    /// ```text
    /// adiós
    /// ```
    ///
    /// 文件 'main.rs'：
    ///
    /// ```ignore (cannot-doctest-external-file-dependency)
    /// fn main() {
    ///     let my_str = include_str!("spanish.in");
    ///     assert_eq!(my_str, "adiós\n");
    ///     print!("{my_str}");
    /// }
    /// ```
    ///
    /// 编译 'main.rs' 并运行生成的二进制文件将输出 "adiós"。
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_builtin_macro]
    #[macro_export]
    #[rustc_diagnostic_item = "include_str_macro"]
    macro_rules! include_str {
        ($file:expr $(,)?) => {{ /* compiler built-in */ }};
    }

    /// 将文件作为字节数组的引用包含进来。
    ///
    /// 文件相对于当前文件定位（类似于模块查找的方式）。提供的路径在编译时以特定平台
    /// 的方式解释。因此，例如，带有反斜杠的 Windows 路径在 Unix 系统上无法正确编译。
    /// way at compile time. So, for instance, an invocation with a Windows path
    /// containing backslashes `\` would not compile correctly on Unix.
    ///
    /// This macro will yield an expression of type `&'static [u8; N]` which is
    /// 文件的内容。
    ///
    /// # 示例
    ///
    /// 假设同一目录中有两个文件，内容如下：
    /// 内容：
    ///
    /// 文件 'spanish.in'：
    ///
    /// ```text
    /// adiós
    /// ```
    ///
    /// 文件 'main.rs'：
    ///
    /// ```ignore (cannot-doctest-external-file-dependency)
    /// fn main() {
    ///     let bytes = include_bytes!("spanish.in");
    ///     assert_eq!(bytes, b"adi\xc3\xb3s\n");
    ///     print!("{}", String::from_utf8_lossy(bytes));
    /// }
    /// ```
    ///
    /// 编译 'main.rs' 并运行生成的二进制文件将输出 "adiós"。
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_builtin_macro]
    #[macro_export]
    #[rustc_diagnostic_item = "include_bytes_macro"]
    macro_rules! include_bytes {
        ($file:expr $(,)?) => {{ /* compiler built-in */ }};
    }

    /// 展开为表示当前模块路径的字符串。
    ///
    /// 当前模块路径可以被视为模块的层级结构，
    /// 回溯到 crate 根目录。路径的第一个组成部分
    /// 是当前正在编译的 crate 名称。
    ///
    /// # 示例
    ///
    /// ```
    /// mod test {
    ///     pub fn foo() {
    ///         assert!(module_path!().ends_with("test"));
    ///     }
    /// }
    ///
    /// test::foo();
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_builtin_macro]
    #[macro_export]
    macro_rules! module_path {
        () => {
            /* compiler built-in */
        };
    }

    /// 在编译时评估配置标志的布尔组合。
    ///
    /// In addition to the `#[cfg]` attribute, this macro is provided to allow
    /// 对配置标志进行布尔表达式评估。这通常
    /// 能减少代码重复。
    ///
    /// The syntax given to this macro is the same syntax as the [`cfg`]
    /// 属性相同。
    ///
    /// `cfg!`, unlike `#[cfg]`, does not remove any code and only evaluates to true or false. For
    /// example, all blocks in an if/else expression need to be valid when `cfg!` is used for
    /// the condition, regardless of what `cfg!` is evaluating.
    ///
    /// [`cfg`]: ../reference/conditional-compilation.html#the-cfg-attribute
    ///
    /// # 示例
    ///
    /// ```
    /// let my_directory = if cfg!(windows) {
    ///     "windows-specific-directory"
    /// } else {
    ///     "unix-directory"
    /// };
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_builtin_macro]
    #[macro_export]
    macro_rules! cfg {
        ($($cfg:tt)*) => {
            /* compiler built-in */
        };
    }

    /// 根据上下文将文件解析为表达式或项。
    ///
    /// **Warning**: For multi-file Rust projects, the `include!` macro is probably not what you
    /// 需要的工具。通常，多文件 Rust 项目使用
    /// [modules](https://doc.rust-lang.org/reference/items/modules.html). Multi-file projects and
    /// 模块在《Rust-by-Example》一书中有说明。
    /// [here](https://doc.rust-lang.org/rust-by-example/mod/split.html) and the module system is
    /// 《Rust 书》中有说明。
    /// [here](https://doc.rust-lang.org/book/ch07-02-defining-modules-to-control-scope-and-privacy.html).
    ///
    /// 包含的文件被放置在周围代码中。
    /// [unhygienically](https://doc.rust-lang.org/reference/macros-by-example.html#hygiene). If
    /// 包含文件被解析为表达式，且变量或函数在不同文件间共享名称，则可能导致变量或函数与
    /// 包含文件预期的不同。
    /// 包含文件相对于当前文件定位（类似于模块查找方式）。提供的路径在编译时以特定平台方式解释。因此，
    ///
    /// The included file is located relative to the current file (similarly to how modules are
    /// 正确编译。
    /// for instance, an invocation with a Windows path containing backslashes `\` would not
    /// compile correctly on Unix.
    ///
    /// # 写在单独文件中的文档，也用于包含 [构建产物]
    ///
    /// The `include!` macro is primarily used for two purposes. It is used to include
    /// documentation that is written in a separate file and it is used to include [build artifacts
    /// usually as a result from the `build.rs`
    /// script](https://doc.rust-lang.org/cargo/reference/build-scripts.html#outputs-of-the-build-script).
    ///
    /// When using the `include` macro to include stretches of documentation, remember that the
    /// # 示例
    /// use the [`include_str`] macro as `#![doc = include_str!("...")]` (at the module level) or
    /// `#[doc = include_str!("...")]` (at the item level) to include documentation from a plain
    /// 文件 'main.rs'：
    ///
    /// # 编译 'main.rs' 并运行生成的二进制文件将输出
    ///
    /// 该宏使用正向模式自动微分来生成新函数。
    ///
    /// 它只能应用于函数。新函数将计算被应用宏的函数的导数。
    ///
    /// ```ignore (only-for-syntax-highlight)
    /// ['🙈', '🙊', '🙉']
    ///     .iter()
    ///     .cycle()
    ///     .take(6)
    ///     .collect::<String>()
    /// ```
    ///
    /// 预期使用语法如下：
    ///
    /// ```ignore (cannot-doctest-external-file-dependency)
    /// fn main() {
    ///     let my_string = include!("monkeys.in");
    ///     assert_eq!("🙈🙊🙉🙈🙊🙉", my_string);
    ///     println!("{my_string}");
    /// }
    /// ```
    ///
    /// Compiling 'main.rs' and running the resulting binary will print
    /// "🙈🙊🙉🙈🙊🙉".
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_builtin_macro]
    #[macro_export]
    #[rustc_diagnostic_item = "include_macro"] // useful for external lints
    macro_rules! include {
        ($file:expr $(,)?) => {{ /* compiler built-in */ }};
    }

    /// This macro uses forward-mode automatic differentiation to generate a new function.
    /// It may only be applied to a function. The new function will compute the derivative
    /// of the function to which the macro was applied.
    ///
    /// The expected usage syntax is:
    /// `#[autodiff_forward(NAME, INPUT_ACTIVITIES, OUTPUT_ACTIVITY)]`
    ///
    /// - `NAME`: A string that represents a valid function name.
    /// - `INPUT_ACTIVITIES`: Specifies one valid activity for each input parameter.
    /// - `OUTPUT_ACTIVITY`: Must not be set if the function implicitly returns nothing
    ///   (or explicitly returns `-> ()`). Otherwise, it must be set to one of the allowed activities.
    ///
    /// ACTIVITIES might either be `Dual` or `Const`, more options will be exposed later.
    ///
    /// `Const` should be used on non-float arguments, or float-based arguments as an optimization
    /// 如果我们不关心对该参数的导数计算。
    ///
    /// `Dual` can be used for float scalar values or for references, raw pointers, or other
    /// 间接输入参数。也可以用于标量浮点返回值。
    /// 如果用于返回值，生成的函数将返回两个浮点标量的元组。
    /// 如果用于输入参数，将创建相同类型的新的阴影参数，
    /// 直接跟随原始参数。
    ///
    /// ### 使用示例：
    ///
    /// ```rust,ignore (autodiff requires a -Z flag as well as fat-lto for testing)
    /// #![feature(autodiff)]
    /// use std::autodiff::*;
    /// #[autodiff_forward(rb_fwd1, Dual, Const, Dual)]
    /// #[autodiff_forward(rb_fwd2, Const, Dual, Dual)]
    /// #[autodiff_forward(rb_fwd3, Dual, Dual, Dual)]
    /// fn rosenbrock(x: f64, y: f64) -> f64 {
    ///     (1.0 - x).powi(2) + 100.0 * (y - x.powi(2)).powi(2)
    /// }
    /// #[autodiff_forward(rb_inp_fwd, Dual, Dual, Dual)]
    /// fn rosenbrock_inp(x: f64, y: f64, out: &mut f64) {
    ///     *out = (1.0 - x).powi(2) + 100.0 * (y - x.powi(2)).powi(2);
    /// }
    ///
    /// fn main() {
    ///   let x0 = rosenbrock(1.0, 3.0); // 400.0
    ///   let (x1, dx1) = rb_fwd1(1.0, 1.0, 3.0); // (400.0, -800.0)
    ///   let (x2, dy1) = rb_fwd2(1.0, 3.0, 1.0); // (400.0, 400.0)
    ///   // When seeding both arguments at once the tangent return is the sum of both.
    ///   let (x3, dxy) = rb_fwd3(1.0, 1.0, 3.0, 1.0); // (400.0, -400.0)
    ///
    ///   let mut out = 0.0;
    ///   let mut dout = 0.0;
    ///   rb_inp_fwd(1.0, 1.0, 3.0, 1.0, &mut out, &mut dout);
    ///   // (out, dout) == (400.0, -400.0)
    /// }
    /// ```
    ///
    /// 我们可能希望跟踪一个输入浮点对一个或多个输出浮点的影响。在这种情况下，
    /// the shadow of one input should be initialized to `1.0`, while the shadows of the other
    /// inputs should be initialized to `0.0`. The shadow of the output(s) should be initialized to
    /// `0.0`. After calling the generated function, the shadow of the input will be zeroed,
    /// while the shadow(s) of the output(s) will contain the derivatives. Forward mode is generally
    /// more efficient if we have more output floats marked as `Dual` than input floats.
    /// 相关信息也可在“向量-雅可比积”（VJP）项下找到。
    #[unstable(feature = "autodiff", issue = "124509")]
    #[allow_internal_unstable(rustc_attrs)]
    #[allow_internal_unstable(core_intrinsics)]
    #[rustc_builtin_macro]
    pub macro autodiff_forward($item:item) {
        /* compiler built-in */
    }

    /// 此宏使用反向模式自动微分生成新函数。
    /// 它只能应用于函数。新函数将计算被应用宏的函数的导数。
    /// 预期使用语法为：
    ///
    /// The expected usage syntax is:
    /// `#[autodiff_reverse(NAME, INPUT_ACTIVITIES, OUTPUT_ACTIVITY)]`
    ///
    /// - `NAME`: A string that represents a valid function name.
    /// - `INPUT_ACTIVITIES`: Specifies one valid activity for each input parameter.
    /// - `OUTPUT_ACTIVITY`: Must not be set if the function implicitly returns nothing
    ///   (or explicitly returns `-> ()`). Otherwise, it must be set to one of the allowed activities.
    ///
    /// ACTIVITIES might either be `Active`, `Duplicated` or `Const`, more options will be exposed later.
    ///
    /// `Active` can be used for float scalar values.
    /// 如果用于输入参数，生成的函数的返回元组将追加一个新的浮点值。
    /// function. If the function returns a float scalar, `Active` can be used for the return as
    /// 在这种情况下，一个浮点数标量会被添加到参数列表中，作为种子值使用。
    ///
    /// `Duplicated` can be used on references, raw pointers, or other indirect input
    /// 参数。它会创建一个新的同类型影子参数，以保留原始参数。
    /// 常量引用或指针参数将获得一个可变的引用或指针作为影子参数。
    ///
    /// `Const` should be used on non-float arguments, or float-based arguments as an optimization
    /// 如果我们不希望计算关于该参数的导数。
    ///
    /// ### 使用示例：
    ///
    /// ```rust,ignore (autodiff requires a -Z flag as well as fat-lto for testing)
    /// #![feature(autodiff)]
    /// use std::autodiff::*;
    /// #[autodiff_reverse(rb_rev, Active, Active, Active)]
    /// fn rosenbrock(x: f64, y: f64) -> f64 {
    ///     (1.0 - x).powi(2) + 100.0 * (y - x.powi(2)).powi(2)
    /// }
    /// #[autodiff_reverse(rb_inp_rev, Active, Active, Duplicated)]
    /// fn rosenbrock_inp(x: f64, y: f64, out: &mut f64) {
    ///     *out = (1.0 - x).powi(2) + 100.0 * (y - x.powi(2)).powi(2);
    /// }
    ///
    /// fn main() {
    ///     let (output1, dx1, dy1) = rb_rev(1.0, 3.0, 1.0);
    ///     dbg!(output1, dx1, dy1); // (400.0, -800.0, 400.0)
    ///     let mut output2 = 0.0;
    ///     let mut seed = 1.0;
    ///     let (dx2, dy2) = rb_inp_rev(1.0, 3.0, &mut output2, &mut seed);
    ///     // (dx2, dy2, output2, seed) == (-800.0, 400.0, 400.0, 0.0)
    /// }
    /// ```
    ///
    ///
    /// 我们经常希望跟踪一个或多个输入浮点数如何影响一个输出浮点数。这个输出可以
    /// 是一个标量返回值，或者是一个可变的引用或指针参数。在后一种情况下，
    /// mutable input should be marked as duplicated and its shadow initialized to `0.0`. The shadow of
    /// the output should be marked as active or duplicated and initialized to `1.0`. After calling
    /// 生成的函数后，输入参数的影子参数将包含导数。输出的影子参数（“种子”）将被重置为零。
    /// 如果函数中有多个被标记为活动或重复的输出浮点数，用户可能希望
    /// If the function has more than one output float marked as active or duplicated, users might want to
    /// set one of them to `1.0` and the others to `0.0` to compute partial derivatives.
    /// 如果活动/重复输入多于输出浮点数，反向模式通常更高效。
    /// 相关信息也可以在“Jacobian-Vector Product”（JVP）项下找到。
    /// Reverse mode is generally more efficient if we have more active/duplicated input than
    /// 该宏并不执行卸载操作本身，它仅生成编译器卸载基础设施所需的代码。
    ///
    /// ### 使用示例：
    #[unstable(feature = "autodiff", issue = "124509")]
    #[allow_internal_unstable(rustc_attrs)]
    #[allow_internal_unstable(core_intrinsics)]
    #[rustc_builtin_macro]
    pub macro autodiff_reverse($item:item) {
        /* compiler built-in */
    }

    /// The `offload_kernel` macro is applied to a function to generate two separate
    /// 以及设备端内核：
    ///
    /// The macro does not perform the offload itself. It generates the necessary
    /// code required by the compiler's offloading infrastructure.
    ///
    /// # 使用
    ///
    /// ```rust,ignore (offload requires a -Z flag)
    /// #[offload_kernel]
    /// fn foo(a: &[f32], b: &[f32], c: *mut f32) {
    ///     *c = a[0] + b[0];
    /// }
    /// ```
    ///
    /// 断言在调试和发布构建中始终会被检查，且无法禁用。关于在
    ///
    /// ```rust,ignore (offload requires a -Z flag)
    /// #[unsafe(no_mangle)]
    /// #[inline(never)]
    /// fn foo(_: &[f32], _: &[f32], _: *mut f32) {
    ///     ::core::panicking::panic("not implemented")
    /// }
    /// ```
    ///
    /// And the device-side kernel:
    ///
    /// ```rust,ignore (offload requires a -Z flag)
    /// #[rustc_offload_kernel]
    /// #[unsafe(no_mangle)]
    /// unsafe extern "gpu-kernel" fn foo(a: &[f32], b: &[f32], c: *mut f32) {
    ///     *c = a[0] + b[0];
    /// }
    /// ```
    #[unstable(feature = "gpu_offload", issue = "131513")]
    #[allow_internal_unstable(rustc_attrs)]
    #[allow_internal_unstable(core_intrinsics)]
    #[rustc_builtin_macro]
    pub macro offload_kernel($item:item) {
        /* compiler built-in */
    }

    /// Asserts that a boolean expression is `true` at runtime.
    ///
    /// This will invoke the [`panic!`] macro if the provided expression cannot be
    /// evaluated to `true` at runtime.
    ///
    /// # Uses
    ///
    /// Assertions are always checked in both debug and release builds, and cannot
    /// be disabled. See [`debug_assert!`] for assertions that are not enabled in
    /// release builds by default.
    ///
    /// Unsafe code may rely on `assert!` to enforce run-time invariants that, if
    /// violated could lead to unsafety.
    ///
    /// Other use-cases of `assert!` include testing and enforcing run-time
    /// invariants in safe code (whose violation cannot result in unsafety).
    ///
    /// # 示例
    ///
    /// This macro has a second form, where a custom panic message can
    /// be provided with or without arguments for formatting. See [`std::fmt`]
    /// 用于为该项目定义语法。作为格式参数的表达式仅在断言失败时才会被计算。
    /// # 示例
    ///
    /// [`std::fmt`]: ../std/fmt/index.html
    ///
    /// # 示例
    ///
    /// ```
    /// // the panic message for these assertions is the stringified value of the
    /// // expression given.
    /// assert!(true);
    ///
    /// fn some_computation() -> bool {
    ///     // Some expensive computation here
    ///     true
    /// }
    ///
    /// assert!(some_computation());
    ///
    /// // assert with a custom message
    /// let x = true;
    /// assert!(x, "x wasn't true!");
    ///
    /// let a = 3; let b = 27;
    /// assert!(a + b == 30, "a = {}, b = {}", a, b);
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_builtin_macro]
    #[macro_export]
    #[rustc_diagnostic_item = "assert_macro"]
    #[allow_internal_unstable(
        core_intrinsics,
        panic_internals,
        edition_panic,
        generic_assert_internals
    )]
    macro_rules! assert {
        ($cond:expr $(,)?) => {{ /* compiler built-in */ }};
        ($cond:expr, $($arg:tt)+) => {{ /* compiler built-in */ }};
    }

    /// 将传递的令牌输出到标准输出中。
    #[unstable(
        feature = "log_syntax",
        issue = "29598",
        reason = "`log_syntax!` is not stable enough for use and is subject to change"
    )]
    #[rustc_builtin_macro]
    #[macro_export]
    macro_rules! log_syntax {
        ($($arg:tt)*) => {
            /* compiler built-in */
        };
    }

    /// 启用或禁用用于调试其他宏的追踪功能。
    #[unstable(
        feature = "trace_macros",
        issue = "29598",
        reason = "`trace_macros` is not stable enough for use and is subject to change"
    )]
    #[rustc_builtin_macro]
    #[macro_export]
    macro_rules! trace_macros {
        (true) => {{ /* compiler built-in */ }};
        (false) => {{ /* compiler built-in */ }};
    }

    /// 用于应用派生宏的属性宏。
    ///
    /// 更多详情请参见 [参考文档]。
    ///
    /// [the reference]: ../reference/attributes/derive.html
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_builtin_macro]
    pub macro derive($item:item) {
        /* compiler built-in */
    }

    /// 用于为实现 trait 的 cconst 上下文中的项目应用派生宏。
    /// # 示例
    ///
    /// 更多详情请参见 [参考文档]。
    ///
    /// [the reference]: ../../../reference/attributes/derive.html
    #[unstable(feature = "derive_const", issue = "143874")]
    #[rustc_builtin_macro]
    pub macro derive_const($item:item) {
        /* compiler built-in */
    }

    /// 用于将函数转换为单元测试的属性宏。
    ///
    /// 更多详情请参见 [参考文档]。
    ///
    /// [the reference]: ../../../reference/attributes/testing.html#the-test-attribute
    #[stable(feature = "rust1", since = "1.0.0")]
    #[allow_internal_unstable(test, rustc_attrs, coverage_attribute)]
    #[rustc_builtin_macro]
    pub macro test($item:item) {
        /* compiler built-in */
    }

    /// 用于将函数转换为基准测试的属性宏。
    #[unstable(
        feature = "test",
        issue = "50297",
        reason = "`bench` is a part of custom test frameworks which are unstable"
    )]
    #[allow_internal_unstable(test, rustc_attrs, coverage_attribute)]
    #[rustc_builtin_macro]
    pub macro bench($item:item) {
        /* compiler built-in */
    }

    /// An implementation detail of the `#[test]` and `#[bench]` macros.
    #[unstable(
        feature = "custom_test_frameworks",
        issue = "50297",
        reason = "custom test frameworks are an unstable feature"
    )]
    #[allow_internal_unstable(test, rustc_attrs)]
    #[rustc_builtin_macro]
    pub macro test_case($item:item) {
        /* compiler built-in */
    }

    /// 用于将静态类型注册为全局分配器的属性宏。
    ///
    /// See also [`std::alloc::GlobalAlloc`](../../../std/alloc/trait.GlobalAlloc.html).
    #[stable(feature = "global_allocator", since = "1.28.0")]
    #[allow_internal_unstable(rustc_attrs, ptr_alignment_type)]
    #[rustc_builtin_macro]
    pub macro global_allocator($item:item) {
        /* compiler built-in */
    }

    /// 用于给函数添加后条件的属性宏。
    ///
    /// 该属性携带一个参数令牌树，最终被解析为一个一元闭包表达式，
    /// 该表达式在对返回值的引用上调用。
    /// 用于给函数添加前条件的属性宏。
    #[unstable(feature = "contracts", issue = "128044")]
    #[allow_internal_unstable(contracts_internals)]
    #[rustc_builtin_macro]
    pub macro contracts_ensures($item:item) {
        /* compiler built-in */
    }

    /// 该属性携带一个参数令牌树，最终被解析为带有对函数形式参数访问权限的布尔表达式。
    ///
    /// 用于给函数注册为分配失败处理器的属性宏。
    /// eventually parsed as an boolean expression with access to the
    /// 如果传递的路径可访问，则保留其应用的项；否则移除该项。
    #[unstable(feature = "contracts", issue = "128044")]
    #[allow_internal_unstable(contracts_internals)]
    #[rustc_builtin_macro]
    pub macro contracts_requires($item:item) {
        /* compiler built-in */
    }

    /// Attribute macro applied to a function to register it as a handler for allocation failure.
    ///
    /// See also [`std::alloc::handle_alloc_error`](../../../std/alloc/fn.handle_alloc_error.html).
    #[unstable(feature = "alloc_error_handler", issue = "51540")]
    #[allow_internal_unstable(rustc_attrs)]
    #[rustc_builtin_macro]
    pub macro alloc_error_handler($item:item) {
        /* compiler built-in */
    }

    /// 用于定义不透明类型的隐藏类型，该列表将在主体中使用。
    #[unstable(
        feature = "cfg_accessible",
        issue = "64797",
        reason = "`cfg_accessible` is not fully implemented"
    )]
    #[rustc_builtin_macro]
    pub macro cfg_accessible($item:item) {
        /* compiler built-in */
    }

    /// Expands all `#[cfg]` and `#[cfg_attr]` attributes in the code fragment it's applied to.
    #[unstable(
        feature = "cfg_eval",
        issue = "82679",
        reason = "`cfg_eval` is a recently implemented feature"
    )]
    #[rustc_builtin_macro]
    pub macro cfg_eval($($tt:tt)*) {
        /* compiler built-in */
    }

    /// 用于为带有主体的项目提供类型别名列表和其他包含不透明类型的类型定义。该列表将在主体中使用以定义不透明的类型隐藏类型。
    /// 只能应用于具有主体的对象。
    /// 类型标注的不稳定占位符。
    /// 仅适用于具有主体的对象。
    #[unstable(
        feature = "type_alias_impl_trait",
        issue = "63063",
        reason = "`type_alias_impl_trait` has open design concerns"
    )]
    #[rustc_builtin_macro]
    pub macro define_opaque($($tt:tt)*) {
        /* compiler built-in */
    }

    /// 类型标注的不稳定占位符。
    #[allow_internal_unstable(internal_syntax)]
    #[unstable(
        feature = "type_ascription",
        issue = "101728",
        reason = "placeholder syntax for type ascription"
    )]
    #[diagnostic::opaque]
    pub macro type_ascribe($expr:expr, $ty:ty) {
        k#type_ascribe($expr, $ty)
    }

    /// 引用模式的不稳定占位符。
    #[allow_internal_unstable(internal_syntax)]
    #[unstable(
        feature = "deref_patterns",
        issue = "87121",
        reason = "placeholder syntax for deref patterns"
    )]
    #[diagnostic::opaque]
    pub macro deref($pat:pat) {
        k#deref($pat)
    }

    /// Derive macro generating an impl of the trait `From`.
    /// 目前，它仅适用于单字段结构体。
    // Note that the macro is in a different module than the `From` trait,
    // to avoid triggering an unstable feature being used if someone imports
    // `std::convert::From`.
    #[rustc_builtin_macro]
    #[unstable(feature = "derive_from", issue = "144889")]
    pub macro From($item: item) {
        /* compiler built-in */
    }

    /// 可外部实现的项：定义了一个可以覆盖该项的属性宏。
    /// 应用于此。
    #[unstable(feature = "extern_item_impls", issue = "125418")]
    #[rustc_builtin_macro]
    #[allow_internal_unstable(eii_internals, decl_macro, rustc_attrs)]
    pub macro eii($item:item) {
        /* compiler built-in */
    }

    /// 不可安全地可外部实现的项：定义了一个不可安全使用的属性宏，可以覆盖该项。
    /// 应用于此的项。
    #[unstable(feature = "extern_item_impls", issue = "125418")]
    #[rustc_builtin_macro]
    #[allow_internal_unstable(eii_internals, decl_macro, rustc_attrs)]
    pub macro unsafe_eii($item:item) {
        /* compiler built-in */
    }

    /// EII的实现细节
    #[unstable(feature = "eii_internals", issue = "none")]
    #[rustc_builtin_macro]
    pub macro eii_declaration($item:item) {
        /* compiler built-in */
    }
}
