#![doc = include_str!("../../core/src/error.md")]
#![stable(feature = "rust1", since = "1.0.0")]

#[stable(feature = "rust1", since = "1.0.0")]
pub use core::error::Error;
#[unstable(feature = "error_generic_member_access", issue = "99301")]
pub use core::error::{Request, request_ref, request_value};

use crate::backtrace::Backtrace;
use crate::fmt::{self, Write};

/// 一个错误报告器，用于显示错误及其来源。
///
/// 报告还提供配置选项，用于格式化错误来源，可以完全以
/// 单行形式呈现，也可以以多行格式呈现，每个来源占一行。
///
/// `Report` only requires that the wrapped error implement `Error`. It doesn't require that the
/// wrapped error be `Send`, `Sync`, or `'static`.
///
/// # 示例
///
/// ```rust
/// #![feature(error_reporter)]
/// use std::error::{Error, Report};
/// use std::fmt;
///
/// #[derive(Debug)]
/// struct SuperError {
///     source: SuperErrorSideKick,
/// }
///
/// impl fmt::Display for SuperError {
///     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
///         write!(f, "SuperError is here!")
///     }
/// }
///
/// impl Error for SuperError {
///     fn source(&self) -> Option<&(dyn Error + 'static)> {
///         Some(&self.source)
///     }
/// }
///
/// #[derive(Debug)]
/// struct SuperErrorSideKick;
///
/// impl fmt::Display for SuperErrorSideKick {
///     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
///         write!(f, "SuperErrorSideKick is here!")
///     }
/// }
///
/// impl Error for SuperErrorSideKick {}
///
/// fn get_super_error() -> Result<(), SuperError> {
///     Err(SuperError { source: SuperErrorSideKick })
/// }
///
/// fn main() {
///     match get_super_error() {
///         Err(e) => println!("Error: {}", Report::new(e)),
///         _ => println!("No error"),
///     }
/// }
/// ```
///
/// 此示例产生以下输出：
///
/// ```console
/// Error: SuperError is here!: SuperErrorSideKick is here!
/// ```
///
/// ## 输出一致性
///
/// Report prints the same output via `Display` and `Debug`, so it works well with
/// [`Result::unwrap`]/[`Result::expect`] which print their `Err` variant via `Debug`:
///
/// ```should_panic
/// #![feature(error_reporter)]
/// use std::error::Report;
/// # use std::error::Error;
/// # use std::fmt;
/// # #[derive(Debug)]
/// # struct SuperError {
/// #     source: SuperErrorSideKick,
/// # }
/// # impl fmt::Display for SuperError {
/// #     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
/// #         write!(f, "SuperError is here!")
/// #     }
/// # }
/// # impl Error for SuperError {
/// #     fn source(&self) -> Option<&(dyn Error + 'static)> {
/// #         Some(&self.source)
/// #     }
/// # }
/// # #[derive(Debug)]
/// # struct SuperErrorSideKick;
/// # impl fmt::Display for SuperErrorSideKick {
/// #     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
/// #         write!(f, "SuperErrorSideKick is here!")
/// #     }
/// # }
/// # impl Error for SuperErrorSideKick {}
/// # fn get_super_error() -> Result<(), SuperError> {
/// #     Err(SuperError { source: SuperErrorSideKick })
/// # }
///
/// get_super_error().map_err(Report::new).unwrap();
/// ```
///
/// 此示例产生以下输出：
///
/// ```console
/// thread 'main' panicked at src/error.rs:34:40:
/// called `Result::unwrap()` on an `Err` value: SuperError is here!: SuperErrorSideKick is here!
/// note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace
/// ```
///
/// ## Return from `main`
///
/// `Report` also implements `From` for all types that implement [`Error`]; this when combined with
/// the `Debug` output means `Report` is an ideal starting place for formatting errors returned
/// from `main`.
///
/// ```should_panic
/// #![feature(error_reporter)]
/// use std::error::Report;
/// # use std::error::Error;
/// # use std::fmt;
/// # #[derive(Debug)]
/// # struct SuperError {
/// #     source: SuperErrorSideKick,
/// # }
/// # impl fmt::Display for SuperError {
/// #     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
/// #         write!(f, "SuperError is here!")
/// #     }
/// # }
/// # impl Error for SuperError {
/// #     fn source(&self) -> Option<&(dyn Error + 'static)> {
/// #         Some(&self.source)
/// #     }
/// # }
/// # #[derive(Debug)]
/// # struct SuperErrorSideKick;
/// # impl fmt::Display for SuperErrorSideKick {
/// #     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
/// #         write!(f, "SuperErrorSideKick is here!")
/// #     }
/// # }
/// # impl Error for SuperErrorSideKick {}
/// # fn get_super_error() -> Result<(), SuperError> {
/// #     Err(SuperError { source: SuperErrorSideKick })
/// # }
///
/// fn main() -> Result<(), Report<SuperError>> {
///     get_super_error()?;
///     Ok(())
/// }
/// ```
///
/// 此示例产生以下输出：
///
/// ```console
/// Error: SuperError is here!: SuperErrorSideKick is here!
/// ```
///
/// **Note**: `Report`s constructed via `?` and `From` will be configured to use the single line
/// output format. If you want to make sure your `Report`s are pretty printed and include backtrace
/// 您需要手动转换并启用这些标志。
///
/// ```should_panic
/// #![feature(error_reporter)]
/// use std::error::Report;
/// # use std::error::Error;
/// # use std::fmt;
/// # #[derive(Debug)]
/// # struct SuperError {
/// #     source: SuperErrorSideKick,
/// # }
/// # impl fmt::Display for SuperError {
/// #     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
/// #         write!(f, "SuperError is here!")
/// #     }
/// # }
/// # impl Error for SuperError {
/// #     fn source(&self) -> Option<&(dyn Error + 'static)> {
/// #         Some(&self.source)
/// #     }
/// # }
/// # #[derive(Debug)]
/// # struct SuperErrorSideKick;
/// # impl fmt::Display for SuperErrorSideKick {
/// #     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
/// #         write!(f, "SuperErrorSideKick is here!")
/// #     }
/// # }
/// # impl Error for SuperErrorSideKick {}
/// # fn get_super_error() -> Result<(), SuperError> {
/// #     Err(SuperError { source: SuperErrorSideKick })
/// # }
///
/// fn main() -> Result<(), Report<SuperError>> {
///     get_super_error()
///         .map_err(Report::from)
///         .map_err(|r| r.pretty(true).show_backtrace(true))?;
///     Ok(())
/// }
/// ```
///
/// 此示例产生以下输出：
///
/// ```console
/// Error: SuperError is here!
///
/// Caused by:
///       SuperErrorSideKick is here!
/// ```
#[unstable(feature = "error_reporter", issue = "90172")]
pub struct Report<E = Box<dyn Error>> {
    /// 被报告的错误。
    error: E,
    /// 报告是否应包含回溯信息。
    show_backtrace: bool,
    /// 报告是否应以漂亮格式显示。
    pretty: bool,
}

impl<E> Report<E>
where
    Report<E>: From<E>,
{
    /// Creates a new `Report` from an input error.
    #[unstable(feature = "error_reporter", issue = "90172")]
    pub fn new(error: E) -> Report<E> {
        Self::from(error)
    }
}

impl<E> Report<E> {
    /// 启用多行显示的漂亮报告格式。
    ///
    /// # 示例
    ///
    /// ```rust
    /// #![feature(error_reporter)]
    /// use std::error::Report;
    /// # use std::error::Error;
    /// # use std::fmt;
    /// # #[derive(Debug)]
    /// # struct SuperError {
    /// #     source: SuperErrorSideKick,
    /// # }
    /// # impl fmt::Display for SuperError {
    /// #     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
    /// #         write!(f, "SuperError is here!")
    /// #     }
    /// # }
    /// # impl Error for SuperError {
    /// #     fn source(&self) -> Option<&(dyn Error + 'static)> {
    /// #         Some(&self.source)
    /// #     }
    /// # }
    /// # #[derive(Debug)]
    /// # struct SuperErrorSideKick;
    /// # impl fmt::Display for SuperErrorSideKick {
    /// #     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
    /// #         write!(f, "SuperErrorSideKick is here!")
    /// #     }
    /// # }
    /// # impl Error for SuperErrorSideKick {}
    ///
    /// let error = SuperError { source: SuperErrorSideKick };
    /// let report = Report::new(error).pretty(true);
    /// eprintln!("Error: {report:?}");
    /// ```
    ///
    /// 此示例产生以下输出：
    ///
    /// ```console
    /// Error: SuperError is here!
    ///
    /// Caused by:
    ///       SuperErrorSideKick is here!
    /// ```
    ///
    /// 当存在多个来源错误时，原因将按照迭代顺序编号
    /// 从最外层的错误开始。
    ///
    /// ```rust
    /// #![feature(error_reporter)]
    /// use std::error::Report;
    /// # use std::error::Error;
    /// # use std::fmt;
    /// # #[derive(Debug)]
    /// # struct SuperError {
    /// #     source: SuperErrorSideKick,
    /// # }
    /// # impl fmt::Display for SuperError {
    /// #     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
    /// #         write!(f, "SuperError is here!")
    /// #     }
    /// # }
    /// # impl Error for SuperError {
    /// #     fn source(&self) -> Option<&(dyn Error + 'static)> {
    /// #         Some(&self.source)
    /// #     }
    /// # }
    /// # #[derive(Debug)]
    /// # struct SuperErrorSideKick {
    /// #     source: SuperErrorSideKickSideKick,
    /// # }
    /// # impl fmt::Display for SuperErrorSideKick {
    /// #     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
    /// #         write!(f, "SuperErrorSideKick is here!")
    /// #     }
    /// # }
    /// # impl Error for SuperErrorSideKick {
    /// #     fn source(&self) -> Option<&(dyn Error + 'static)> {
    /// #         Some(&self.source)
    /// #     }
    /// # }
    /// # #[derive(Debug)]
    /// # struct SuperErrorSideKickSideKick;
    /// # impl fmt::Display for SuperErrorSideKickSideKick {
    /// #     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
    /// #         write!(f, "SuperErrorSideKickSideKick is here!")
    /// #     }
    /// # }
    /// # impl Error for SuperErrorSideKickSideKick { }
    ///
    /// let source = SuperErrorSideKickSideKick;
    /// let source = SuperErrorSideKick { source };
    /// let error = SuperError { source };
    /// let report = Report::new(error).pretty(true);
    /// eprintln!("Error: {report:?}");
    /// ```
    ///
    /// 此示例产生以下输出：
    ///
    /// ```console
    /// Error: SuperError is here!
    ///
    /// Caused by:
    ///    0: SuperErrorSideKick is here!
    ///    1: SuperErrorSideKickSideKick is here!
    /// ```
    #[unstable(feature = "error_reporter", issue = "90172")]
    pub fn pretty(mut self, pretty: bool) -> Self {
        self.pretty = pretty;
        self
    }

    /// 使用漂亮输出格式时，如果可用则显示回溯信息。
    ///
    /// # 示例
    ///
    /// **Note**: Report will search for the first `Backtrace` it can find starting from the
    /// outermost error. In this example it will display the backtrace from the second error in the
    /// sources, `SuperErrorSideKick`.
    ///
    /// ```rust
    /// #![feature(error_reporter)]
    /// #![feature(error_generic_member_access)]
    /// # use std::error::Error;
    /// # use std::fmt;
    /// use std::error::Request;
    /// use std::error::Report;
    /// use std::backtrace::Backtrace;
    ///
    /// # #[derive(Debug)]
    /// # struct SuperError {
    /// #     source: SuperErrorSideKick,
    /// # }
    /// # impl fmt::Display for SuperError {
    /// #     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
    /// #         write!(f, "SuperError is here!")
    /// #     }
    /// # }
    /// # impl Error for SuperError {
    /// #     fn source(&self) -> Option<&(dyn Error + 'static)> {
    /// #         Some(&self.source)
    /// #     }
    /// # }
    /// #[derive(Debug)]
    /// struct SuperErrorSideKick {
    ///     backtrace: Backtrace,
    /// }
    ///
    /// impl SuperErrorSideKick {
    ///     fn new() -> SuperErrorSideKick {
    ///         SuperErrorSideKick { backtrace: Backtrace::force_capture() }
    ///     }
    /// }
    ///
    /// impl Error for SuperErrorSideKick {
    ///     fn provide<'a>(&'a self, request: &mut Request<'a>) {
    ///         request.provide_ref::<Backtrace>(&self.backtrace);
    ///     }
    /// }
    ///
    /// // The rest of the example is unchanged ...
    /// # impl fmt::Display for SuperErrorSideKick {
    /// #     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
    /// #         write!(f, "SuperErrorSideKick is here!")
    /// #     }
    /// # }
    ///
    /// let source = SuperErrorSideKick::new();
    /// let error = SuperError { source };
    /// let report = Report::new(error).pretty(true).show_backtrace(true);
    /// eprintln!("Error: {report:?}");
    /// ```
    ///
    /// 此示例产生类似以下输出：
    ///
    /// ```console
    /// Error: SuperError is here!
    ///
    /// Caused by:
    ///       SuperErrorSideKick is here!
    ///
    /// Stack backtrace:
    ///    0: rust_out::main::_doctest_main_src_error_rs_1158_0::SuperErrorSideKick::new
    ///    1: rust_out::main::_doctest_main_src_error_rs_1158_0
    ///    2: rust_out::main
    ///    3: core::ops::function::FnOnce::call_once
    ///    4: std::sys::backtrace::__rust_begin_short_backtrace
    ///    5: std::rt::lang_start::{{closure}}
    ///    6: std::panicking::try
    ///    7: std::rt::lang_start_internal
    ///    8: std::rt::lang_start
    ///    9: main
    ///   10: __libc_start_main
    ///   11: _start
    /// ```
    #[unstable(feature = "error_reporter", issue = "90172")]
    pub fn show_backtrace(mut self, show_backtrace: bool) -> Self {
        self.show_backtrace = show_backtrace;
        self
    }
}

impl<E> Report<E>
where
    E: Error,
{
    fn backtrace(&self) -> Option<&Backtrace> {
        // have to grab the backtrace on the first error directly since that error may not be
        // 'static
        let backtrace = request_ref(&self.error);
        backtrace.or_else(|| {
            self.error
                .source()
                .map(|source| source.sources().find_map(|source| request_ref(source)))
                .flatten()
        })
    }

    /// 将报告格式化为单行。
    #[unstable(feature = "error_reporter", issue = "90172")]
    fn fmt_singleline(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.error)?;

        let sources = self.error.source().into_iter().flat_map(<dyn Error>::sources);

        for cause in sources {
            write!(f, ": {cause}")?;
        }

        Ok(())
    }

    /// 将报告格式化为多行，每个错误原因占一行。
    #[unstable(feature = "error_reporter", issue = "90172")]
    fn fmt_multiline(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let error = &self.error;

        write!(f, "{error}")?;

        if let Some(cause) = error.source() {
            write!(f, "\n\nCaused by:")?;

            let multiple = cause.source().is_some();

            for (ind, error) in cause.sources().enumerate() {
                writeln!(f)?;
                let mut indented = Indented { inner: f };
                if multiple {
                    write!(indented, "{ind: >4}: {error}")?;
                } else {
                    write!(indented, "      {error}")?;
                }
            }
        }

        if self.show_backtrace {
            if let Some(backtrace) = self.backtrace() {
                write!(f, "\n\nStack backtrace:\n{}", backtrace.to_string().trim_end())?;
            }
        }

        Ok(())
    }
}

#[unstable(feature = "error_reporter", issue = "90172")]
impl<E> From<E> for Report<E>
where
    E: Error,
{
    fn from(error: E) -> Self {
        Report { error, show_backtrace: false, pretty: false }
    }
}

#[unstable(feature = "error_reporter", issue = "90172")]
impl<E> fmt::Display for Report<E>
where
    E: Error,
{
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        if self.pretty { self.fmt_multiline(f) } else { self.fmt_singleline(f) }
    }
}

// This type intentionally outputs the same format for `Display` and `Debug`for
// situations where you unwrap a `Report` or return it from main.
#[unstable(feature = "error_reporter", issue = "90172")]
impl<E> fmt::Debug for Report<E>
where
    Report<E>: fmt::Display,
{
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        fmt::Display::fmt(self, f)
    }
}

/// 用于缩进内部来源的包装类型。
struct Indented<'a, D> {
    inner: &'a mut D,
}

impl<T> Write for Indented<'_, T>
where
    T: Write,
{
    fn write_str(&mut self, s: &str) -> fmt::Result {
        for (i, line) in s.split('\n').enumerate() {
            if i > 0 {
                self.inner.write_char('\n')?;
                self.inner.write_str("      ")?;
            }

            self.inner.write_str(line)?;
        }

        Ok(())
    }
}
