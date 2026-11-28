//! 标准库宏
//!
//! 此模块包含一组从标准库中导出的宏
//! 库。每个宏在链接到标准库时均可使用
//! 库。
// ignore-tidy-file-dbg

#[cfg(test)]
mod tests;

#[doc = include_str!("../../core/src/macros/panic.md")]
#[macro_export]
#[rustc_builtin_macro(std_panic)]
#[stable(feature = "rust1", since = "1.0.0")]
#[allow_internal_unstable(edition_panic)]
#[cfg_attr(not(test), rustc_diagnostic_item = "std_panic_macro")]
macro_rules! panic {
    // Expands to either `$crate::panic::panic_2015` or `$crate::panic::panic_2021`
    // depending on the edition of the caller.
    ($($arg:tt)*) => {
        /* compiler built-in */
    };
}

/// 输出到标准输出
///
/// Equivalent to the [`println!`] macro except that a newline is not printed at
/// 。
///
/// Note that stdout is frequently line-buffered by default so it may be
/// necessary to use [`io::stdout().flush()`][flush] to ensure the output is emitted
/// 。每次调用时都会锁定标准输出。如果您在热点循环中调用
///
/// The `print!` macro will lock the standard output on each call. If you call
/// `print!` within a hot loop, this behavior may be the bottleneck of the loop.
/// To avoid this, lock stdout with [`io::stdout().lock()`][lock]:
/// ```
/// use std::io::{stdout, Write};
///
/// let mut lock = stdout().lock();
/// write!(lock, "hello world").unwrap();
/// ```
///
/// Use `print!` only for the primary output of your program. Use
/// [`eprint!`] instead to print error and progress messages.
///
/// See the formatting documentation in [`std::fmt`](crate::fmt)
/// 的格式说明文档
///
/// [flush]: crate::io::Write::flush
/// [`println!`]: crate::println
/// [`eprint!`]: crate::eprint
/// [lock]: crate::io::Stdout
///
/// # Panic
///
/// Panics if writing to `io::stdout()` fails.
///
/// 向非阻塞 stdout 写入会导致错误，这将导致
/// 此宏发生 panic
///
/// # 示例
///
/// ```
/// use std::io::{self, Write};
///
/// print!("this ");
/// print!("will ");
/// print!("be ");
/// print!("on ");
/// print!("the ");
/// print!("same ");
/// print!("line ");
///
/// io::stdout().flush().unwrap();
///
/// print!("this string has a newline, why not choose println! instead?\n");
///
/// io::stdout().flush().unwrap();
/// ```
#[macro_export]
#[stable(feature = "rust1", since = "1.0.0")]
#[cfg_attr(not(test), rustc_diagnostic_item = "print_macro")]
#[allow_internal_unstable(print_internals)]
#[rustc_diagnostic_opaque]
macro_rules! print {
    ($($arg:tt)*) => {{
        $crate::io::_print($crate::format_args!($($arg)*));
    }};
}

/// 输出到标准输出，并包含换行符
///
/// On all platforms, the newline is the LINE FEED character (`\n`/`U+000A`) alone
/// (no additional CARRIAGE RETURN (`\r`/`U+000D`)).
///
/// This macro uses the same syntax as [`format!`], but writes to the standard output instead.
/// See [`std::fmt`] for more information.
///
/// The `println!` macro will lock the standard output on each call. If you call
/// `println!` within a hot loop, this behavior may be the bottleneck of the loop.
/// To avoid this, lock stdout with [`io::stdout().lock()`][lock]:
/// ```
/// use std::io::{stdout, Write};
///
/// let mut lock = stdout().lock();
/// writeln!(lock, "hello world").unwrap();
/// ```
///
/// Use `println!` only for the primary output of your program. Use
/// [`eprintln!`] instead to print error and progress messages.
///
/// See the formatting documentation in [`std::fmt`](crate::fmt)
/// 的格式说明文档
///
/// [`std::fmt`]: crate::fmt
/// [`eprintln!`]: crate::eprintln
/// [lock]: crate::io::Stdout
///
/// # Panic
///
/// Panics if writing to [`io::stdout`] fails.
///
/// 向非阻塞 stdout 写入会导致错误，这将导致
/// 此宏发生 panic
///
/// [`io::stdout`]: crate::io::stdout
///
/// # 示例
///
/// ```
/// println!(); // prints just a newline
/// println!("hello there!");
/// println!("format {} arguments", "some");
/// let local_variable = "some";
/// println!("format {local_variable} arguments");
/// ```
#[macro_export]
#[stable(feature = "rust1", since = "1.0.0")]
#[cfg_attr(not(test), rustc_diagnostic_item = "println_macro")]
#[allow_internal_unstable(print_internals, format_args_nl)]
#[rustc_diagnostic_opaque]
macro_rules! println {
    () => {
        $crate::print!("\n")
    };
    ($($arg:tt)*) => {{
        $crate::io::_print($crate::format_args_nl!($($arg)*));
    }};
}

/// 输出到标准错误
///
/// Equivalent to the [`print!`] macro, except that output goes to
/// [`io::stderr`] instead of [`io::stdout`]. See [`print!`] for
/// 。
///
/// Use `eprint!` only for error and progress messages. Use `print!`
/// 来作为程序的主要输出
///
/// [`io::stderr`]: crate::io::stderr
/// [`io::stdout`]: crate::io::stdout
///
/// See the formatting documentation in [`std::fmt`](crate::fmt)
/// 的格式说明文档
///
/// # 崩溃
///
/// Panics if writing to `io::stderr` fails.
///
/// 向非阻塞的 stderr 写入可能导致错误，这将导致
/// 此宏崩溃。
///
/// # 示例
///
/// ```
/// eprint!("Error: Could not complete task");
/// ```
#[macro_export]
#[stable(feature = "eprint", since = "1.19.0")]
#[cfg_attr(not(test), rustc_diagnostic_item = "eprint_macro")]
#[allow_internal_unstable(print_internals)]
macro_rules! eprint {
    ($($arg:tt)*) => {{
        $crate::io::_eprint($crate::format_args!($($arg)*));
    }};
}

/// 在标准错误中输出，并带有新行符。
///
/// Equivalent to the [`println!`] macro, except that output goes to
/// [`io::stderr`] instead of [`io::stdout`]. See [`println!`] for
/// example usage.
///
/// Use `eprintln!` only for error and progress messages. Use `println!`
/// 。
///
/// See the formatting documentation in [`std::fmt`](crate::fmt)
/// 。
///
/// [`io::stderr`]: crate::io::stderr
/// [`io::stdout`]: crate::io::stdout
/// [`println!`]: crate::println
///
/// # 崩溃
///
/// Panics if writing to `io::stderr` fails.
///
/// 向非阻塞的 stderr 写入可能导致错误，这将导致
/// 此宏崩溃。
///
/// # 示例
///
/// ```
/// eprintln!("Error: Could not complete task");
/// ```
#[macro_export]
#[stable(feature = "eprint", since = "1.19.0")]
#[cfg_attr(not(test), rustc_diagnostic_item = "eprintln_macro")]
#[allow_internal_unstable(print_internals, format_args_nl)]
macro_rules! eprintln {
    () => {
        $crate::eprint!("\n")
    };
    ($($arg:tt)*) => {{
        $crate::io::_eprint($crate::format_args_nl!($($arg)*));
    }};
}

/// 快速且简单的调试方式，打印给定表达式的值并返回值。
/// 。
///
/// 一个示例：
///
/// ```rust
/// let a = 2;
/// let b = dbg!(a * 2) + 1;
/// //      ^-- prints: [src/main.rs:2:9] a * 2 = 4
/// assert_eq!(b, 5);
/// ```
///
/// The macro works by using the `Debug` implementation of the type of
/// 宏调用的来源位置以及表达式的源代码。
/// 在表达式上调用宏会移动并获取其所有权，然后以不变的形式返回计算后的表达式。如果
/// of the expression.
///
/// Invoking the macro on an expression moves and takes ownership of it
/// 当仅发生在发布版本中
/// of the expression does not implement `Copy` and you don't want
/// to give up ownership, you can instead borrow with `dbg!(&expr)`
/// for some expression `expr`.
///
/// The `dbg!` macro works exactly the same in release builds.
/// This is useful when debugging issues that only occur in release
/// # 稳定性
///
/// 该宏打印的具体输出不应作为依赖项，
/// 并且可能在未来发生变化。
/// 。
/// 生产代码的调试输出最好使用其他功能来完成，
/// such as the [`debug!`] macro from the [`log`] crate.
///
/// # 稳定性
///
/// 该宏打印的具体输出不应作为依赖项，
/// 并且可能在未来发生变化。
///
/// # 崩溃
///
/// Panics if writing to `io::stderr` fails.
///
/// # 更多示例
///
/// 对于方法调用：
///
/// ```rust
/// fn foo(n: usize) {
///     if let Some(_) = dbg!(n.checked_sub(4)) {
///         // ...
///     }
/// }
///
/// foo(3)
/// ```
///
/// 这会在 [stderr] 中打印：
///
/// ```text,ignore
/// [src/main.rs:2:22] n.checked_sub(4) = None
/// ```
///
/// 简单的阶乘实现：
///
/// ```rust
/// fn factorial(n: u32) -> u32 {
///     if dbg!(n <= 1) {
///         dbg!(1)
///     } else {
///         dbg!(n * factorial(n - 1))
///     }
/// }
///
/// dbg!(factorial(4));
/// ```
///
/// 这会在 [stderr] 中打印：
///
/// ```text,ignore
/// [src/main.rs:2:8] n <= 1 = false
/// [src/main.rs:2:8] n <= 1 = false
/// [src/main.rs:2:8] n <= 1 = false
/// [src/main.rs:2:8] n <= 1 = true
/// [src/main.rs:3:9] 1 = 1
/// [src/main.rs:7:9] n * factorial(n - 1) = 2
/// [src/main.rs:7:9] n * factorial(n - 1) = 6
/// [src/main.rs:7:9] n * factorial(n - 1) = 24
/// [src/main.rs:9:1] factorial(4) = 24
/// ```
///
/// The `dbg!(..)` macro moves the input:
///
/// ```compile_fail
/// /// A wrapper around `usize` which importantly is not Copyable.
/// #[derive(Debug)]
/// struct NoCopy(usize);
///
/// let a = NoCopy(42);
/// let _ = dbg!(a); // <-- `a` is moved here.
/// let _ = dbg!(a); // <-- `a` is moved again; error!
/// ```
///
/// You can also use `dbg!()` without a value to just print the
/// 文件和行号。
///
/// Finally, if you want to `dbg!(..)` multiple values, it will treat them as
/// 一个元组（并返回该元组）：
///
/// ```
/// assert_eq!(dbg!(1usize, 2u32), (1, 2));
/// ```
///
/// 然而，带有尾随逗号的单个参数仍然不会被当作元组处理，遵循了宏中忽略尾随逗号的惯例。
/// 在调用中。如果需要一个 1-元组，可以直接使用它：
/// invocations. You can use a 1-tuple directly if you need one:
///
/// ```
/// assert_eq!(1, dbg!(1u32,)); // trailing comma ignored
/// assert_eq!((1,), dbg!((1u32,))); // 1-tuple
/// ```
///
/// [stderr]: https://en.wikipedia.org/wiki/Standard_streams#Standard_error_(stderr)
/// [`debug!`]: https://docs.rs/log/*/log/macro.debug.html
/// [`log`]: https://crates.io/crates/log
#[macro_export]
#[cfg_attr(not(test), rustc_diagnostic_item = "dbg_macro")]
#[stable(feature = "dbg_macro", since = "1.32.0")]
#[rustc_diagnostic_opaque]
macro_rules! dbg {
    // NOTE: We cannot use `concat!` to make a static string as a format argument
    // of `eprintln!` because `file!` could contain a `{` or
    // `$val` expression could be a block (`{ .. }`), in which case the `eprintln!`
    // will be malformed.
    () => {
        $crate::eprintln!("[{}:{}:{}]", $crate::file!(), $crate::line!(), $crate::column!())
    };
    ($val:expr $(,)?) => {
        // Use of `match` here is intentional because it affects the lifetimes
        // of temporaries - https://stackoverflow.com/a/48732525/1063961
        match $val {
            tmp => {
                $crate::eprintln!("[{}:{}:{}] {} = {:#?}",
                    $crate::file!(),
                    $crate::line!(),
                    $crate::column!(),
                    $crate::stringify!($val),
                    // The `&T: Debug` check happens here (not in the format literal desugaring)
                    // to avoid format literal related messages and suggestions.
                    &&tmp as &dyn $crate::fmt::Debug,
                );
                tmp
            }
        }
    };
    ($($val:expr),+ $(,)?) => {
        ($($crate::dbg!($val)),+,)
    };
}

#[doc(hidden)]
#[macro_export]
#[allow_internal_unstable(hash_map_internals)]
#[unstable(feature = "hash_map_internals", issue = "none")]
macro_rules! repetition_utils {
    (@count $($tokens:tt),*) => {{
        [$($crate::repetition_utils!(@replace $tokens => ())),*].len()
    }};

    (@replace $x:tt => $y:tt) => { $y }
}

/// Creates a [`HashMap`] containing the arguments.
///
/// `hash_map!` allows specifying the entries that make
/// up the [`HashMap`] where the key and value are separated by a `=>`.
///
/// 条目之间用逗号分隔，允许有尾随逗号。
///
/// It is semantically equivalent to using repeated [`HashMap::insert`]
/// on a newly created hashmap.
///
/// `hash_map!` will attempt to avoid repeated reallocations by
/// using [`HashMap::with_capacity`].
///
/// # 带有尾随逗号时
///
/// ```rust
/// #![feature(hash_map_macro)]
/// use std::hash_map;
///
/// let map = hash_map! {
///     "key" => "value",
///     "key1" => "value1"
/// };
///
/// assert_eq!(map.get("key"), Some(&"value"));
/// assert_eq!(map.get("key1"), Some(&"value1"));
/// assert!(map.get("brrrrrrooooommm").is_none());
/// ```
///
/// 键和值被移动到 HashMap 中。
///
///```rust
/// #![feature(hash_map_macro)]
/// use std::hash_map;
///
/// let map = hash_map! {
///     "key" => "value", // notice the ,
/// };
///
/// assert_eq!(map.get("key"), Some(&"value"));
/// ```
///
/// The key and value are moved into the HashMap.
///
/// [`HashMap`]: crate::collections::HashMap
/// [`HashMap::insert`]: crate::collections::HashMap::insert
/// [`HashMap::with_capacity`]: crate::collections::HashMap::with_capacity
#[macro_export]
#[allow_internal_unstable(hash_map_internals)]
#[unstable(feature = "hash_map_macro", issue = "144032")]
macro_rules! hash_map {
    () => {{
        $crate::collections::HashMap::new()
    }};

    ( $( $key:expr => $value:expr ),* $(,)? ) => {{
        let mut map = $crate::collections::HashMap::with_capacity(
            const { $crate::repetition_utils!(@count $($key),*) }
        );
        $( map.insert($key, $value); )*
        map
    }}
}

/// Attribute macro to replace a function's body with `loop {}` under rustdoc.
///
/// 即使它们的体部分引用了该目标上无法获得的项。
/// even when their bodies reference items unavailable on the target used to
/// build the documentation. Use this with `#[cfg(any(doc, ...))]` to include
/// 函数的签名必须在文档目标上仍然有效。
///
/// The function's signature must still be valid on the documentation target.
#[rustc_builtin_macro]
#[allow(unused_macros)]
pub(crate) macro rustdoc_skip_body($item:item) {
    /* compiler built-in */
}
