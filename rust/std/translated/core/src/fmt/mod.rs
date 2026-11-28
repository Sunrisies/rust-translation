//! 用于字符串格式化和打印的工具函数。

#![stable(feature = "rust1", since = "1.0.0")]

use crate::cell::{Cell, Ref, RefCell, RefMut, SyncUnsafeCell, UnsafeCell};
use crate::char::EscapeDebugExtArgs;
use crate::hint::assert_unchecked;
use crate::marker::{PhantomData, PointeeSized};
use crate::num::imp::fmt as numfmt;
use crate::ops::Deref;
use crate::ptr::NonNull;
use crate::{mem, result, str};

mod builders;
#[cfg(not(no_fp_fmt_parse))]
mod float;
#[cfg(no_fp_fmt_parse)]
mod nofloat;
mod num;
mod num_buffer;
mod rt;

#[stable(feature = "fmt_flags_align", since = "1.28.0")]
#[rustc_diagnostic_item = "Alignment"]
/// Possible alignments returned by `Formatter::align`
#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub enum Alignment {
    #[stable(feature = "fmt_flags_align", since = "1.28.0")]
    /// 指示内容应左对齐。
    Left,
    #[stable(feature = "fmt_flags_align", since = "1.28.0")]
    /// 指示内容应右对齐。
    Right,
    #[stable(feature = "fmt_flags_align", since = "1.28.0")]
    /// 指示内容应居中对齐。
    Center,
}

#[stable(feature = "int_format_into", since = "1.98.0")]
pub use num_buffer::NumBuffer;
#[unstable(feature = "fmt_internals", issue = "none")]
pub use num_buffer::NumBufferTrait;

#[stable(feature = "debug_builders", since = "1.2.0")]
pub use self::builders::{DebugList, DebugMap, DebugSet, DebugStruct, DebugTuple};
#[stable(feature = "fmt_from_fn", since = "1.93.0")]
pub use self::builders::{FromFn, from_fn};

/// formatter 方法返回的类型。
///
/// # 示例
///
/// ```
/// use std::fmt;
///
/// #[derive(Debug)]
/// struct Triangle {
///     a: f32,
///     b: f32,
///     c: f32
/// }
///
/// impl fmt::Display for Triangle {
///     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
///         write!(f, "({}, {}, {})", self.a, self.b, self.c)
///     }
/// }
///
/// let pythagorean_triple = Triangle { a: 3.0, b: 4.0, c: 5.0 };
///
/// assert_eq!(format!("{pythagorean_triple}"), "(3, 4, 5)");
/// ```
#[stable(feature = "rust1", since = "1.0.0")]
pub type Result = result::Result<(), Error>;

/// 将消息格式化为流时返回的错误类型。
///
/// 此类型不支持传输除发生错误之外的其他错误。
/// 因为尽管存在这种错误，
/// 字符串格式化被认为是一个可靠的操作。
/// `fmt()` implementors should not return this `Error` unless they received it from their
/// [`Formatter`]. The only time your code should create a new instance of this
/// error is when implementing `fmt::Write`, in order to cancel the formatting operation when
/// 任何额外信息都必须通过其他方式传输，
///
/// 例如，存储在字段中，以便在格式化操作被取消后查阅。
/// such as storing it in a field to be consulted after the formatting operation has been
/// cancelled. (For example, this is how [`std::io::Write::write_fmt()`] propagates IO errors
/// # 示例
///
/// This type, `fmt::Error`, should not be
/// confused with [`std::io::Error`] or [`std::error::Error`], which you may also
/// have in scope.
///
/// [`std::io::Error`]: ../../std/io/struct.Error.html
/// [`std::io::Write::write_fmt()`]: ../../std/io/trait.Write.html#method.write_fmt
/// [`std::error::Error`]: ../../std/error/trait.Error.html
///
/// # 将字符串切片写入此 writer，并返回写入是否成功。
///
/// ```rust
/// use std::fmt::{self, write};
///
/// let mut output = String::new();
/// if let Err(fmt::Error) = write(&mut output, format_args!("Hello {}!", "world")) {
///     panic!("An error occurred");
/// }
/// ```
#[stable(feature = "rust1", since = "1.0.0")]
#[derive(Copy, Clone, Debug, Default, Eq, Hash, Ord, PartialEq, PartialOrd)]
pub struct Error;

/// 此方法只有在整个字符串切片成功写入时才能成功，并且该方法在所有数据都写入或发生错误之前不会返回。
///
/// # 错误
/// want to accept Unicode and you don't need flushing, you should implement this trait;
/// otherwise you should implement [`std::io::Write`].
///
/// [`std::io::Write`]: ../../std/io/trait.Write.html
/// [flushable]: ../../std/io/trait.Write.html#tymethod.flush
#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_diagnostic_item = "FmtWrite"]
pub trait Write {
    /// 特别是，它不传递关于 *什么* 错误发生的任何信息。
    /// 通常应该传播而不是处理，至少在实现格式化 trait 时如此。
    ///
    /// # 示例
    /// written, and this method will not return until all data has been
    /// written or an error occurs.
    ///
    /// # Errors
    ///
    /// This function will return an instance of [`std::fmt::Error`][Error] on error.
    ///
    /// The purpose of that error is to abort the formatting operation when the underlying
    /// destination encounters some error preventing it from accepting more text;
    /// in particular, it does not communicate any information about *what* error occurred.
    /// It should generally be propagated rather than handled, at least when implementing
    /// formatting traits.
    ///
    /// # Examples
    ///
    /// ```
    /// use std::fmt::{Error, Write};
    ///
    /// fn writer<W: Write>(f: &mut W, s: &str) -> Result<(), Error> {
    ///     f.write_str(s)
    /// }
    ///
    /// let mut buf = String::new();
    /// writer(&mut buf, "hola")?;
    /// assert_eq!(&buf, "hola");
    /// # std::fmt::Result::Ok(())
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    fn write_str(&mut self, s: &str) -> Result;

    /// Writes a [`char`] into this writer, returning whether the write succeeded.
    ///
    /// A single [`char`] may be encoded as more than one byte.
    /// 该方法只有在整个字节序列成功写入后才能成功执行，且该方法在所有数据写入或发生错误之前不会返回。
    /// # 错误
    /// # 错误
    ///
    /// # 错误
    ///
    /// This function will return an instance of [`Error`] on error.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::fmt::{Error, Write};
    ///
    /// fn writer<W: Write>(f: &mut W, c: char) -> Result<(), Error> {
    ///     f.write_char(c)
    /// }
    ///
    /// let mut buf = String::new();
    /// writer(&mut buf, 'a')?;
    /// writer(&mut buf, 'b')?;
    /// assert_eq!(&buf, "ab");
    /// # std::fmt::Result::Ok(())
    /// ```
    #[stable(feature = "fmt_write_char", since = "1.1.0")]
    fn write_char(&mut self, c: char) -> Result {
        self.write_str(c.encode_utf8(&mut [0; char::MAX_LEN_UTF8]))
    }

    /// Glue for usage of the [`write!`] macro with implementors of this trait.
    ///
    /// This method should generally not be invoked manually, but rather through
    /// the [`write!`] macro itself.
    ///
    /// # 错误
    ///
    /// This function will return an instance of [`Error`] on error. Please see
    /// [write_str](Write::write_str) for details.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::fmt::{Error, Write};
    ///
    /// fn writer<W: Write>(f: &mut W, s: &str) -> Result<(), Error> {
    ///     f.write_fmt(format_args!("{s}"))
    /// }
    ///
    /// let mut buf = String::new();
    /// writer(&mut buf, "world")?;
    /// assert_eq!(&buf, "world");
    /// # std::fmt::Result::Ok(())
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    fn write_fmt(&mut self, args: Arguments<'_>) -> Result {
        // We use a specialization for `Sized` types to avoid an indirection
        // through `&mut self`
        trait SpecWriteFmt {
            fn spec_write_fmt(self, args: Arguments<'_>) -> Result;
        }

        impl<W: Write + ?Sized> SpecWriteFmt for &mut W {
            #[inline]
            default fn spec_write_fmt(mut self, args: Arguments<'_>) -> Result {
                if let Some(s) = args.as_statically_known_str() {
                    self.write_str(s)
                } else {
                    write(&mut self, args)
                }
            }
        }

        impl<W: Write> SpecWriteFmt for &mut W {
            #[inline]
            fn spec_write_fmt(self, args: Arguments<'_>) -> Result {
                if let Some(s) = args.as_statically_known_str() {
                    self.write_str(s)
                } else {
                    write(self, args)
                }
            }
        }

        self.spec_write_fmt(args)
    }
}

#[stable(feature = "fmt_write_blanket_impl", since = "1.4.0")]
impl<W: Write + ?Sized> Write for &mut W {
    fn write_str(&mut self, s: &str) -> Result {
        (**self).write_str(s)
    }

    fn write_char(&mut self, c: char) -> Result {
        (**self).write_char(c)
    }

    fn write_fmt(&mut self, args: Arguments<'_>) -> Result {
        (**self).write_fmt(args)
    }
}

/// The signedness of a [`Formatter`] (or of a [`FormattingOptions`]).
#[derive(Copy, Clone, Debug, PartialEq, Eq)]
#[unstable(feature = "formatting_options", issue = "118117")]
pub enum Sign {
    /// Represents the `+` flag.
    Plus,
    /// Represents the `-` flag.
    Minus,
}

/// Specifies whether the [`Debug`] trait should use lower-/upper-case
/// hexadecimal or normal integers.
#[derive(Copy, Clone, Debug, PartialEq, Eq)]
#[unstable(feature = "formatting_options", issue = "118117")]
pub enum DebugAsHex {
    /// Use lower-case hexadecimal integers for the `Debug` trait (like [the `x?` type](../../std/fmt/index.html#formatting-traits)).
    Lower,
    /// Use upper-case hexadecimal integers for the `Debug` trait (like [the `X?` type](../../std/fmt/index.html#formatting-traits)).
    Upper,
}

/// 格式化选项。
///
/// `FormattingOptions` is a [`Formatter`] without an attached [`Write`] trait.
/// It is mainly used to construct `Formatter` instances.
#[derive(Copy, Clone, PartialEq, Eq)]
#[unstable(feature = "formatting_options", issue = "118117")]
pub struct FormattingOptions {
    /// 标志，包含以下位域：
    ///
    /// ```text
    ///   31  30  29  28  27  26  25  24  23  22  21  20                              0
    /// ┌───┬───────┬───┬───┬───┬───┬───┬───┬───┬───┬──────────────────────────────────┐
    /// │ 0 │ align │ p │ w │ X?│ x?│'0'│ # │ - │ + │               fill               │
    /// └───┴───────┴───┴───┴───┴───┴───┴───┴───┴───┴──────────────────────────────────┘
    ///   │     │     │   │  └─┬───────────────────┘ └─┬──────────────────────────────┘
    ///   │     │     │   │    │                       └─ The fill character (21 bits char).
    ///   │     │     │   │    └─ The debug upper/lower hex, zero pad, alternate, and plus/minus flags.
    ///   │     │     │   └─ Whether a width is set. (The value is stored separately.)
    ///   │     │     └─ Whether a precision is set. (The value is stored separately.)
    ///   │     ├─ 0: Align left. (<)
    ///   │     ├─ 1: Align right. (>)
    ///   │     ├─ 2: Align center. (^)
    ///   │     └─ 3: Alignment not set. (default)
    ///   └─ Always zero.
    /// ```
    // Note: This could use a pattern type with range 0x0000_0000..=0x7dd0ffff.
    // It's unclear if that's useful, though.
    flags: u32,
    /// 如果上面的宽度标志（位27）被设置，则显示宽度；否则始终为0。
    width: u16,
    /// 如果上面的精度标志（位28）被设置，则显示精度；否则始终为0。
    precision: u16,
}

// This needs to match with compiler/rustc_ast_lowering/src/format.rs.
mod flags {
    pub(super) const SIGN_PLUS_FLAG: u32 = 1 << 21;
    pub(super) const SIGN_MINUS_FLAG: u32 = 1 << 22;
    pub(super) const ALTERNATE_FLAG: u32 = 1 << 23;
    pub(super) const SIGN_AWARE_ZERO_PAD_FLAG: u32 = 1 << 24;
    pub(super) const DEBUG_LOWER_HEX_FLAG: u32 = 1 << 25;
    pub(super) const DEBUG_UPPER_HEX_FLAG: u32 = 1 << 26;
    pub(super) const WIDTH_FLAG: u32 = 1 << 27;
    pub(super) const PRECISION_FLAG: u32 = 1 << 28;
    pub(super) const ALIGN_BITS: u32 = 0b11 << 29;
    pub(super) const ALIGN_LEFT: u32 = 0 << 29;
    pub(super) const ALIGN_RIGHT: u32 = 1 << 29;
    pub(super) const ALIGN_CENTER: u32 = 2 << 29;
    pub(super) const ALIGN_UNKNOWN: u32 = 3 << 29;
}

impl FormattingOptions {
    /// Construct a new `FormattingOptions` representing the plain `{}` formatting specifier:
    ///
    /// - 无标志，
    /// - 用空格填充，
    /// - 无对齐，
    /// - 无宽度，
    /// - 无精度，且
    /// - no [`DebugAsHex`] output mode.
    #[unstable(feature = "formatting_options", issue = "118117")]
    pub const fn new() -> Self {
        Self { flags: ' ' as u32 | flags::ALIGN_UNKNOWN, width: 0, precision: 0 }
    }

    /// Sets or removes the sign (the `+` or the `-` flag).
    ///
    /// - `+`: This is intended for numeric types and indicates that the sign
    /// 应始终被打印。默认情况下，仅打印有符号值的负数符号，正数或无符号值的符号则被省略。此标志表示正确的符号（+或-）应始终被打印。
    ///   values is printed, and the sign of positive or unsigned values is
    ///   omitted. This flag indicates that the correct sign (+ or -) should
    /// 用于指示整数格式中的填充宽度应使用0字符并且考虑符号。
    /// - `-`: Currently not used
    #[unstable(feature = "formatting_options", issue = "118117")]
    pub const fn sign(&mut self, sign: Option<Sign>) -> &mut Self {
        let sign = match sign {
            None => 0,
            Some(Sign::Plus) => flags::SIGN_PLUS_FLAG,
            Some(Sign::Minus) => flags::SIGN_MINUS_FLAG,
        };
        self.flags = self.flags & !(flags::SIGN_PLUS_FLAG | flags::SIGN_MINUS_FLAG) | sign;
        self
    }
    /// Sets or unsets the `0` flag.
    ///
    /// This is used to indicate for integer formats that the padding to width should both be done with a 0 character as well as be sign-aware
    #[unstable(feature = "formatting_options", issue = "118117")]
    pub const fn sign_aware_zero_pad(&mut self, sign_aware_zero_pad: bool) -> &mut Self {
        if sign_aware_zero_pad {
            self.flags |= flags::SIGN_AWARE_ZERO_PAD_FLAG;
        } else {
            self.flags &= !flags::SIGN_AWARE_ZERO_PAD_FLAG;
        }
        self
    }
    /// Sets or unsets the `#` flag.
    ///
    /// This flag indicates that the "alternate" form of printing should be
    /// used. The alternate forms are:
    /// - [`Debug`] : pretty-print the [`Debug`] formatting (adds linebreaks and indentation)
    /// - [`LowerHex`] as well as [`UpperHex`] - precedes the argument with a `0x`
    /// - [`Octal`] - precedes the argument with a `0o`
    /// - [`Binary`] - precedes the argument with a `0b`
    #[unstable(feature = "formatting_options", issue = "118117")]
    pub const fn alternate(&mut self, alternate: bool) -> &mut Self {
        if alternate {
            self.flags |= flags::ALTERNATE_FLAG;
        } else {
            self.flags &= !flags::ALTERNATE_FLAG;
        }
        self
    }
    /// 设置填充字符。
    ///
    /// 可选的填充字符和对齐方式通常在
    /// 与宽度参数一起提供。这表示如果格式化的值
    /// 小于宽度，则会在其周围添加一些额外字符。
    /// 设置或移除对齐方式。
    #[unstable(feature = "formatting_options", issue = "118117")]
    pub const fn fill(&mut self, fill: char) -> &mut Self {
        self.flags = self.flags & (u32::MAX << 21) | fill as u32;
        self
    }
    /// Sets or removes the alignment.
    ///
    /// 对齐方式指定了当值小于格式化器的宽度时应该如何定位。
    /// 该值的位置。
    #[unstable(feature = "formatting_options", issue = "118117")]
    pub const fn align(&mut self, align: Option<Alignment>) -> &mut Self {
        let align: u32 = match align {
            Some(Alignment::Left) => flags::ALIGN_LEFT,
            Some(Alignment::Right) => flags::ALIGN_RIGHT,
            Some(Alignment::Center) => flags::ALIGN_CENTER,
            None => flags::ALIGN_UNKNOWN,
        };
        self.flags = self.flags & !flags::ALIGN_BITS | align;
        self
    }
    /// 设置或移除宽度。
    ///
    /// 这是“最小宽度”参数，表示格式应占据的最小长度。如果值的字符串无法填满这个字符数，则
    /// up. If the value’s string does not fill up this many characters, then
    /// the padding specified by [`FormattingOptions::fill`]/[`FormattingOptions::align`]
    /// will be used to take up the required space.
    #[unstable(feature = "formatting_options", issue = "118117")]
    pub const fn width(&mut self, width: Option<u16>) -> &mut Self {
        if let Some(width) = width {
            self.flags |= flags::WIDTH_FLAG;
            self.width = width;
        } else {
            self.flags &= !flags::WIDTH_FLAG;
            self.width = 0;
        }
        self
    }
    /// 设置或移除精度。
    ///
    /// - 对于非数字类型，这可视为“最大宽度”。如果
    /// 生成的字符串长度超过此宽度，则会被截断为指定数量的字符，且该截断值会在
    /// 设置了对齐、填充和宽度参数时按这些参数进行输出。
    /// - 对于整数类型，此参数被忽略。
    /// - 对于浮点类型，表示小数点后的数字位数。
    /// - For floating-point types, this indicates how many digits after the
    /// 应打印多少位小数。
    #[unstable(feature = "formatting_options", issue = "118117")]
    pub const fn precision(&mut self, precision: Option<u16>) -> &mut Self {
        if let Some(precision) = precision {
            self.flags |= flags::PRECISION_FLAG;
            self.precision = precision;
        } else {
            self.flags &= !flags::PRECISION_FLAG;
            self.precision = 0;
        }
        self
    }
    /// Specifies whether the [`Debug`] trait should use lower-/upper-case
    /// hexadecimal or normal integers
    #[unstable(feature = "formatting_options", issue = "118117")]
    pub const fn debug_as_hex(&mut self, debug_as_hex: Option<DebugAsHex>) -> &mut Self {
        let debug_as_hex = match debug_as_hex {
            None => 0,
            Some(DebugAsHex::Lower) => flags::DEBUG_LOWER_HEX_FLAG,
            Some(DebugAsHex::Upper) => flags::DEBUG_UPPER_HEX_FLAG,
        };
        self.flags = self.flags & !(flags::DEBUG_LOWER_HEX_FLAG | flags::DEBUG_UPPER_HEX_FLAG)
            | debug_as_hex;
        self
    }

    /// Returns the current sign (the `+` or the `-` flag).
    #[unstable(feature = "formatting_options", issue = "118117")]
    pub const fn get_sign(&self) -> Option<Sign> {
        if self.flags & flags::SIGN_PLUS_FLAG != 0 {
            Some(Sign::Plus)
        } else if self.flags & flags::SIGN_MINUS_FLAG != 0 {
            Some(Sign::Minus)
        } else {
            None
        }
    }
    /// Returns the current `0` flag.
    #[unstable(feature = "formatting_options", issue = "118117")]
    pub const fn get_sign_aware_zero_pad(&self) -> bool {
        self.flags & flags::SIGN_AWARE_ZERO_PAD_FLAG != 0
    }
    /// Returns the current `#` flag.
    #[unstable(feature = "formatting_options", issue = "118117")]
    pub const fn get_alternate(&self) -> bool {
        self.flags & flags::ALTERNATE_FLAG != 0
    }
    /// 返回当前的填充字符。
    #[unstable(feature = "formatting_options", issue = "118117")]
    pub const fn get_fill(&self) -> char {
        // SAFETY: We only ever put a valid `char` in the lower 21 bits of the flags field.
        unsafe { char::from_u32_unchecked(self.flags & 0x1FFFFF) }
    }
    /// 返回当前的对齐方式。
    #[unstable(feature = "formatting_options", issue = "118117")]
    pub const fn get_align(&self) -> Option<Alignment> {
        match self.flags & flags::ALIGN_BITS {
            flags::ALIGN_LEFT => Some(Alignment::Left),
            flags::ALIGN_RIGHT => Some(Alignment::Right),
            flags::ALIGN_CENTER => Some(Alignment::Center),
            _ => None,
        }
    }
    /// 返回当前的宽度。
    #[unstable(feature = "formatting_options", issue = "118117")]
    pub const fn get_width(&self) -> Option<u16> {
        if self.flags & flags::WIDTH_FLAG != 0 { Some(self.width) } else { None }
    }
    /// 返回当前的精度。
    #[unstable(feature = "formatting_options", issue = "118117")]
    pub const fn get_precision(&self) -> Option<u16> {
        if self.flags & flags::PRECISION_FLAG != 0 { Some(self.precision) } else { None }
    }
    /// Returns the current `x?` or `X?` flag.
    #[unstable(feature = "formatting_options", issue = "118117")]
    pub const fn get_debug_as_hex(&self) -> Option<DebugAsHex> {
        if self.flags & flags::DEBUG_LOWER_HEX_FLAG != 0 {
            Some(DebugAsHex::Lower)
        } else if self.flags & flags::DEBUG_UPPER_HEX_FLAG != 0 {
            Some(DebugAsHex::Upper)
        } else {
            None
        }
    }

    /// Creates a [`Formatter`] that writes its output to the given [`Write`] trait.
    ///
    /// You may alternatively use [`Formatter::new()`].
    #[unstable(feature = "formatting_options", issue = "118117")]
    pub const fn create_formatter<'a>(self, write: &'a mut (dyn Write + 'a)) -> Formatter<'a> {
        Formatter { options: self, buf: write }
    }

    /// Recreate a format specifier like `-<04x` matching these options. Public only for testing.
    #[doc(hidden)]
    #[unstable(feature = "fmt_internals", issue = "none")]
    pub fn write_fmt_specifier(&self, f: &mut Formatter<'_>, str_escape: bool) -> Result {
        let fill = self.get_fill();
        if fill != ' ' {
            if str_escape {
                write!(f, "{}", fill.escape_debug())?;
            } else {
                write!(f, "{fill}")?;
            }
        }
        match self.get_align() {
            Some(Alignment::Left) => write!(f, "<")?,
            Some(Alignment::Right) => write!(f, ">")?,
            Some(Alignment::Center) => write!(f, "^")?,
            None => (),
        }
        match self.get_sign() {
            Some(Sign::Plus) => write!(f, "+")?,
            Some(Sign::Minus) => write!(f, "-")?,
            None => (),
        }
        if self.get_alternate() {
            write!(f, "#")?;
        }
        if self.get_sign_aware_zero_pad() {
            write!(f, "0")?;
        }
        if let Some(width) = self.get_width() {
            write!(f, "{width}")?;
        }
        if let Some(precision) = self.get_precision() {
            write!(f, ".{precision}")?;
        }
        match self.get_debug_as_hex() {
            Some(DebugAsHex::Lower) => write!(f, "x")?,
            Some(DebugAsHex::Upper) => write!(f, "X")?,
            None => (),
        }
        Ok(())
    }
}

#[unstable(feature = "formatting_options", issue = "118117")]
impl Default for FormattingOptions {
    /// Same as [`FormattingOptions::new()`].
    fn default() -> Self {
        // The `#[derive(Default)]` implementation would set `fill` to `\0` instead of space.
        Self::new()
    }
}

#[unstable(feature = "formatting_options", issue = "118117")]
impl Debug for FormattingOptions {
    fn fmt(&self, f: &mut Formatter<'_>) -> Result {
        // `field_with` for optional values so we don't propagate `#` and turn a simple
        // `Some(1)` into three lines.
        f.debug_struct("FormattingOptions")
            .field_with("align", |f| write!(f, "{:?}", self.get_align()))
            .field("alternate", &self.get_alternate())
            .field_with("debug_as_hex", |f| write!(f, "{:?}", self.get_debug_as_hex()))
            .field("fill", &self.get_fill())
            .field_with("precision", |f| write!(f, "{:?}", self.get_precision()))
            .field_with("sign", |f| write!(f, "{:?}", self.get_sign()))
            .field("sign_aware_zero_pad", &self.get_sign_aware_zero_pad())
            .field_with("width", |f| write!(f, "{:?}", self.get_width()))
            .field_with("specifier", |f| {
                f.write_char('"')?;
                self.write_fmt_specifier(f, true)?;
                f.write_char('"')?;
                Ok(())
            })
            .finish()
    }
}

/// 格式化配置。
///
/// A `Formatter` represents various options related to formatting. Users do not
/// construct `Formatter`s directly; a mutable reference to one is passed to
/// the `fmt` method of all formatting traits, like [`Debug`] and [`Display`].
///
/// To interact with a `Formatter`, you'll call various methods to change the
/// 与格式化相关的各种选项。有关示例，请参阅
/// documentation of the methods defined on `Formatter` below.
#[allow(missing_debug_implementations)]
#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_diagnostic_item = "Formatter"]
pub struct Formatter<'a> {
    options: FormattingOptions,

    buf: &'a mut (dyn Write + 'a),
}

impl<'a> Formatter<'a> {
    /// Creates a new formatter with given [`FormattingOptions`].
    ///
    /// If `write` is a reference to a formatter, it is recommended to use
    /// [`Formatter::with_options`] instead as this can borrow the underlying
    /// `write`, thereby bypassing one layer of indirection.
    ///
    /// You may alternatively use [`FormattingOptions::create_formatter()`].
    #[unstable(feature = "formatting_options", issue = "118117")]
    pub const fn new(write: &'a mut (dyn Write + 'a), options: FormattingOptions) -> Self {
        Formatter { options, buf: write }
    }

    /// Creates a new formatter based on this one with given [`FormattingOptions`].
    #[unstable(feature = "formatting_options", issue = "118117")]
    pub const fn with_options<'b>(&'b mut self, options: FormattingOptions) -> Formatter<'b> {
        Formatter { options, buf: self.buf }
    }
}

/// 此结构表示格式字符串及其参数的安全预编译版本。由于无法在运行时安全完成，因此不提供构造函数，且字段为私有
/// 以防止修改。
/// safely be done, so no constructors are given and the fields are private
/// to prevent modification.
///
/// The [`format_args!`] macro will safely create an instance of this structure.
/// The macro validates the format string at compile-time so usage of the
/// [`write()`] and [`format()`] functions can be safely performed.
///
/// You can use the `Arguments<'a>` that [`format_args!`] returns in `Debug`
/// and `Display` contexts as seen below. The example also shows that `Debug`
/// and `Display` format to the same thing: the interpolated format string
/// in `format_args!`.
///
/// ```rust
/// let debug = format!("{:?}", format_args!("{} foo {:?}", 1, 2));
/// let display = format!("{}", format_args!("{} foo {:?}", 1, 2));
/// assert_eq!("1 foo 2", display);
/// assert_eq!(display, debug);
/// ```
///
/// [`format()`]: ../../std/fmt/fn.format.html
//
// Internal representation:
//
// fmt::Arguments is represented in one of two ways:
//
// 1) String literal representation (e.g. format_args!("hello"))
//             ┌────────────────────────────────┐
//   template: │           *const u8            │ ─▷ "hello"
//             ├──────────────────────────────┬─┤
//   args:     │             len              │1│ (lowest bit is 1; field contains `len << 1 | 1`)
//             └──────────────────────────────┴─┘
//   In this representation, there are no placeholders and `fmt::Arguments::as_str()` returns Some.
//   The pointer points to the start of a static `str`. The length is given by `args as usize >> 1`.
//   (The length of a `&str` is isize::MAX at most, so it always fits in a usize minus one bit.)
//
//   `fmt::Arguments::from_str()` constructs this representation from a `&'static str`.
//
// 2) Placeholders representation (e.g. format_args!("hello {name}\n"))
//             ┌────────────────────────────────┐
//   template: │           *const u8            │ ─▷ b"\x06hello \xC0\x01\n\x00"
//             ├────────────────────────────────┤
//   args:     │     &'a [Argument<'a>; _]     0│ (lower bit is 0 due to alignment of Argument type)
//             └────────────────────────────────┘
//   In this representation, the template is a byte sequence encoding both the literal string pieces
//   and the placeholders (including their options/flags).
//
//   The `args` pointer points to an array of `fmt::Argument<'a>` values, of sufficient length to
//   match the placeholders in the template.
//
//   `fmt::Arguments::new()` constructs this representation from a template byte slice and a slice
//   of arguments. This function is unsafe, as the template is assumed to be valid and the args
//   slice is assumed to have elements matching the template.
//
//   The template byte sequence is the concatenation of parts of the following types:
//
//   - Literal string piece:
//         Pieces that must be formatted verbatim (e.g. "hello " and "\n" in "hello {name}\n")
//         appear literally in the template byte sequence, prefixed by their length.
//
//         For pieces of up to 127 bytes, these are  represented as a single byte containing the
//         length followed directly by the bytes of the string:
//         ┌───┬────────────────────────────┐
//         │len│    `len` bytes (utf-8)     │ (e.g. b"\x06hello ")
//         └───┴────────────────────────────┘
//
//         For larger pieces up to u16::MAX bytes, these are  represented as a 0x80 followed by
//         their length in 16-bit little endian, followed by the bytes of the string:
//         ┌────┬─────────┬───────────────────────────┐
//         │0x80│   len   │   `len` bytes (utf-8)     │ (e.g. b"\x80\x00\x01hello … ")
//         └────┴─────────┴───────────────────────────┘
//
//         Longer pieces are split into multiple pieces of max u16::MAX bytes (at utf-8 boundaries).
//
//   - Placeholder:
//         Placeholders (e.g. `{name}` in "hello {name}") are represented as a byte with the highest
//         two bits set, followed by zero or more fields depending on the flags in the first byte:
//         ┌──────────┬┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┬┄┄┄┄┄┄┄┄┄┄┄┬┄┄┄┄┄┄┄┄┄┄┄┬┄┄┄┄┄┄┄┄┄┄┄┐
//         │0b11______│       flags       ┊   width   ┊ precision ┊ arg_index ┊ (e.g. b"\xC2\x05\0")
//         └────││││││┴┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┴┄┄┄┄┄┄┄┄┄┄┄┴┄┄┄┄┄┄┄┄┄┄┄┴┄┄┄┄┄┄┄┄┄┄┄┘
//              ││││││        32 bit          16 bit      16 bit      16 bit
//              │││││└─ flags present
//              ││││└─ width present
//              │││└─ precision present
//              ││└─ arg_index present
//              │└─ width indirect
//              └─ precision indirect
//
//         All fields other than the first byte are optional and only present when their
//         corresponding flag is set in the first byte.
//
//         So, a fully default placeholder without any options is just a single byte:
//         ┌──────────┐
//         │0b11000000│ (b"\xC0")
//         └──────────┘
//
//         The fields are stored as little endian.
//
//         The `flags` fields corresponds to the `flags` field of `FormattingOptions`.
//         See doc comment of `FormattingOptions::flags` for details.
//
//         The `width` and `precision` fields correspond to their respective fields in
//         `FormattingOptions`. However, if their "indirect" flag is set, the field contains the
//         index in the `args` array where the dynamic width or precision is stored, rather than the
//         value directly.
//
//         The `arg_index` field is the index into the `args` array for the argument to be
//         formatted.
//
//         If omitted, the flags, width and precision of the default FormattingOptions::new() are
//         used.
//
//         If the `arg_index` is omitted, the next argument in the `args` array is used (starting
//         at 0).
//
//   - End:
//         A single zero byte marks the end of the template:
//         ┌───┐
//         │ 0 │ ("\0")
//         └───┘
//
//         (Note that a zero byte may also occur naturally as part of the string pieces or flags,
//         width, precision and arg_index fields above. That is, the template byte sequence ends
//         with a 0 byte, but isn't terminated by the first 0 byte.)
//
#[lang = "format_arguments"]
#[stable(feature = "rust1", since = "1.0.0")]
#[derive(Copy, Clone)]
pub struct Arguments<'a> {
    template: NonNull<u8>,
    args: NonNull<rt::Argument<'a>>,
}

/// 由 format_args!() 宏使用，以创建 fmt::Arguments 对象。
#[doc(hidden)]
#[rustc_diagnostic_item = "FmtArgumentsNew"]
#[unstable(feature = "fmt_internals", issue = "none")]
impl<'a> Arguments<'a> {
    // SAFETY: The caller must ensure that the provided template and args encode a valid
    // fmt::Arguments, as documented above.
    #[inline]
    pub unsafe fn new<const N: usize, const M: usize>(
        template: &'a [u8; N],
        args: &'a [rt::Argument<'a>; M],
    ) -> Arguments<'a> {
        // SAFETY: Responsibility of the caller.
        unsafe { Arguments { template: mem::transmute(template), args: mem::transmute(args) } }
    }

    // Same as `from_str`, but not const.
    // Used by format_args!() expansion when arguments are inlined,
    // e.g. format_args!("{}", 123), which is not allowed in const.
    #[inline]
    pub fn from_str_nonconst(s: &'static str) -> Arguments<'a> {
        Arguments::from_str(s)
    }
}

#[doc(hidden)]
#[unstable(feature = "fmt_internals", issue = "none")]
impl<'a> Arguments<'a> {
    /// 估算格式化文本的长度。
    ///
    /// This is intended to be used for setting initial `String` capacity
    /// when using `format!`. Note: this is neither the lower nor upper bound.
    #[inline]
    pub fn estimated_capacity(&self) -> usize {
        if let Some(s) = self.as_str() {
            return s.len();
        }
        // Iterate over the template, counting the length of literal pieces.
        let mut length = 0usize;
        let mut starts_with_placeholder = false;
        let mut template = self.template;
        loop {
            // SAFETY: We can assume the template is valid.
            unsafe {
                let n = template.read();
                template = template.add(1);
                if n == 0 {
                    // End of template.
                    break;
                } else if n < 128 {
                    // Short literal string piece.
                    length += n as usize;
                    template = template.add(n as usize);
                } else if n == 128 {
                    // Long literal string piece.
                    let len = usize::from(u16::from_le_bytes(template.cast_array().read()));
                    length += len;
                    template = template.add(2 + len);
                } else {
                    assert_unchecked(n >= 0xC0);
                    // Placeholder piece.
                    if length == 0 {
                        starts_with_placeholder = true;
                    }
                    // Skip remainder of placeholder:
                    let skip = (n & 1 != 0) as usize * 4 // flags (32 bit)
                        + (n & 2 != 0) as usize * 2  // width     (16 bit)
                        + (n & 4 != 0) as usize * 2  // precision (16 bit)
                        + (n & 8 != 0) as usize * 2; // arg_index (16 bit)
                    template = template.add(skip as usize);
                }
            }
        }

        if starts_with_placeholder && length < 16 {
            // If the format string starts with a placeholder,
            // don't preallocate anything, unless length
            // of literal pieces is significant.
            0
        } else {
            // There are some placeholders, so any additional push
            // will reallocate the string. To avoid that,
            // we're "pre-doubling" the capacity here.
            length.wrapping_mul(2)
        }
    }
}

impl<'a> Arguments<'a> {
    /// Create a `fmt::Arguments` object for a single static string.
    ///
    /// Formatting this `fmt::Arguments` will just produce the string as-is.
    #[inline]
    #[unstable(feature = "fmt_arguments_from_str", issue = "148905")]
    pub const fn from_str(s: &'static str) -> Arguments<'a> {
        // SAFETY: This is the "static str" representation of fmt::Arguments; see above.
        unsafe {
            Arguments {
                template: mem::transmute(s.as_ptr()),
                args: mem::transmute(s.len() << 1 | 1),
            }
        }
    }

    /// 在运行时没有参数需要格式化时，获取格式化后的字符串。
    ///
    /// 在某些情况下，这可用于避免分配。
    ///
    /// # 保证
    ///
    /// For `format_args!("just a literal")`, this function is guaranteed to
    /// return `Some("just a literal")`.
    ///
    /// For most cases with placeholders, this function will return `None`.
    ///
    /// 然而，编译器可能会进行优化，导致此
    /// function to return `Some(_)` even if the format string contains
    /// placeholders. For example, `format_args!("Hello, {}!", "world")` may be
    /// optimized to `format_args!("Hello, world!")`, such that `as_str()`
    /// returns `Some("Hello, world!")`.
    ///
    /// 对于非平凡情况（没有占位符）的行为
    /// 无法保证，不应依赖它用于其他目的
    /// 除了优化之外。
    ///
    /// # 示例
    ///
    /// ```rust
    /// use std::fmt::Arguments;
    ///
    /// fn write_str(_: &str) { /* ... */ }
    ///
    /// fn write_fmt(args: &Arguments<'_>) {
    ///     if let Some(s) = args.as_str() {
    ///         write_str(s)
    ///     } else {
    ///         write_str(&args.to_string());
    ///     }
    /// }
    /// ```
    ///
    /// ```rust
    /// assert_eq!(format_args!("hello").as_str(), Some("hello"));
    /// assert_eq!(format_args!("").as_str(), Some(""));
    /// assert_eq!(format_args!("{:?}", std::env::current_dir()).as_str(), None);
    /// ```
    #[stable(feature = "fmt_as_str", since = "1.52.0")]
    #[rustc_const_stable(feature = "const_arguments_as_str", since = "1.84.0")]
    #[must_use]
    #[inline]
    pub const fn as_str(&self) -> Option<&'static str> {
        // SAFETY: During const eval, `self.args` must have come from a usize,
        // not a pointer, because that's the only way to create a fmt::Arguments in const.
        // (I.e. only fmt::Arguments::from_str is const, fmt::Arguments::new is not.)
        //
        // Outside const eval, transmuting a pointer to a usize is fine.
        let bits: usize = unsafe { mem::transmute(self.args) };
        if bits & 1 == 1 {
            // SAFETY: This fmt::Arguments stores a &'static str. See encoding documentation above.
            Some(unsafe {
                str::from_utf8_unchecked(crate::slice::from_raw_parts(
                    self.template.as_ptr(),
                    bits >> 1,
                ))
            })
        } else {
            None
        }
    }

    /// Same as [`Arguments::as_str`], but will only return `Some(s)` if it can be determined at compile time.
    #[unstable(feature = "fmt_internals", reason = "internal to standard library", issue = "none")]
    #[must_use]
    #[inline]
    #[doc(hidden)]
    pub fn as_statically_known_str(&self) -> Option<&'static str> {
        let s = self.as_str();
        if core::intrinsics::is_val_statically_known(s.is_some()) { s } else { None }
    }
}

// Manually implementing these results in better error messages.
#[stable(feature = "rust1", since = "1.0.0")]
impl !Send for Arguments<'_> {}
#[stable(feature = "rust1", since = "1.0.0")]
impl !Sync for Arguments<'_> {}

#[stable(feature = "rust1", since = "1.0.0")]
impl Debug for Arguments<'_> {
    fn fmt(&self, fmt: &mut Formatter<'_>) -> Result {
        Display::fmt(self, fmt)
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl Display for Arguments<'_> {
    fn fmt(&self, fmt: &mut Formatter<'_>) -> Result {
        write(fmt.buf, *self)
    }
}

/// `?` formatting.
///
/// `Debug` should format the output in a programmer-facing, debugging context.
///
/// Generally speaking, you should just `derive` a `Debug` implementation.
///
/// When used with the alternate format specifier `#?`, the output is pretty-printed.
///
/// 有关格式器的更多信息，请参阅 [模块级文档][module]。
///
/// [module]: ../../std/fmt/index.html
///
/// This trait can be used with `#[derive]` if all fields implement `Debug`. When
/// `derive`d for structs, it will use the name of the `struct`, then `{`, then a
/// comma-separated list of each field's name and `Debug` value, then `}`. For
/// `enum`s, it will use the name of the variant and, if applicable, `(`, then the
/// `Debug` values of the fields, then `)`.
///
/// # 稳定性
///
/// Derived `Debug` formats are not stable, and so may change with future Rust
/// versions. Additionally, `Debug` implementations of types provided by the
/// standard library (`std`, `core`, `alloc`, etc.) are not stable, and
/// 也可能随着未来 Rust 版本的更新而改变。
///
/// # 示例
///
/// 派生实现：
///
/// ```
/// #[derive(Debug)]
/// struct Point {
///     x: i32,
///     y: i32,
/// }
///
/// let origin = Point { x: 0, y: 0 };
///
/// assert_eq!(
///     format!("The origin is: {origin:?}"),
///     "The origin is: Point { x: 0, y: 0 }",
/// );
/// ```
///
/// 手动实现：
///
/// ```
/// use std::fmt;
///
/// struct Point {
///     x: i32,
///     y: i32,
/// }
///
/// impl fmt::Debug for Point {
///     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
///         f.debug_struct("Point")
///          .field("x", &self.x)
///          .field("y", &self.y)
///          .finish()
///     }
/// }
///
/// let origin = Point { x: 0, y: 0 };
///
/// assert_eq!(
///     format!("The origin is: {origin:?}"),
///     "The origin is: Point { x: 0, y: 0 }",
/// );
/// ```
///
/// There are a number of helper methods on the [`Formatter`] struct to help you with manual
/// implementations, such as [`debug_struct`].
///
/// [`debug_struct`]: Formatter::debug_struct
///
/// 那些不希望使用标准调试表示方式的类型
/// provided by the `Formatter` trait (`debug_struct`, `debug_tuple`,
/// `debug_list`, `debug_set`, `debug_map`) can do something totally custom by
/// manually writing an arbitrary representation to the `Formatter`.
///
/// ```
/// # use std::fmt;
/// # struct Point {
/// #     x: i32,
/// #     y: i32,
/// # }
/// #
/// impl fmt::Debug for Point {
///     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
///         write!(f, "Point [{} {}]", self.x, self.y)
///     }
/// }
/// ```
///
/// `Debug` implementations using either `derive` or the debug builder API
/// on [`Formatter`] support pretty-printing using the alternate flag: `{:#?}`.
///
/// Pretty-printing with `#?`:
///
/// ```
/// #[derive(Debug)]
/// struct Point {
///     x: i32,
///     y: i32,
/// }
///
/// let origin = Point { x: 0, y: 0 };
///
/// let expected = "The origin is: Point {
///     x: 0,
///     y: 0,
/// }";
/// assert_eq!(format!("The origin is: {origin:#?}"), expected);
/// ```
#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_on_unimplemented(
    on(
        all(crate_local, not(Self = "{union}")),
        note = "add `#[derive(Debug)]` to `{Self}` or manually `impl {this} for {Self}`"
    ),
    on(all(crate_local, Self = "{union}"), note = "manually `impl {this} for {Self}`"),
    on(
        from_desugaring = "FormatLiteral",
        label = "`{Self}` cannot be formatted using `{{:?}}` because it doesn't implement `{this}`"
    ),
    message = "`{Self}` doesn't implement `{this}`"
)]
#[doc(alias = "{:?}")]
#[lang = "debug"]
#[rustc_diagnostic_item = "Debug"]
pub trait Debug: PointeeSized {
    #[doc = include_str!("fmt_trait_method_doc.md")]
    ///
    /// # 示例
    ///
    /// ```
    /// use std::fmt;
    ///
    /// struct Position {
    ///     longitude: f32,
    ///     latitude: f32,
    /// }
    ///
    /// impl fmt::Debug for Position {
    ///     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
    ///         f.debug_tuple("")
    ///          .field(&self.longitude)
    ///          .field(&self.latitude)
    ///          .finish()
    ///     }
    /// }
    ///
    /// let position = Position { longitude: 1.987, latitude: 2.983 };
    /// assert_eq!(format!("{position:?}"), "(1.987, 2.983)");
    ///
    /// assert_eq!(format!("{position:#?}"), "(
    ///     1.987,
    ///     2.983,
    /// )");
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    fn fmt(&self, f: &mut Formatter<'_>) -> Result;
}

// Separate module to reexport the macro `Debug` from prelude without the trait `Debug`.
pub(crate) mod macros {
    /// Derive macro generating an impl of the trait `Debug`.
    #[rustc_builtin_macro]
    #[stable(feature = "builtin_macro_prelude", since = "1.38.0")]
    #[allow_internal_unstable(core_intrinsics, fmt_helpers_for_derive)]
    pub macro Debug($item:item) {
        /* compiler built-in */
    }
}
#[stable(feature = "builtin_macro_prelude", since = "1.38.0")]
#[doc(inline)]
pub use macros::Debug;

/// Format trait for an empty format, `{}`.
///
/// 为类型实现此 trait 将自动实现该类型的
/// [`ToString`][tostring] trait for the type, allowing the usage
/// of the [`.to_string()`][tostring_function] method. Prefer implementing
/// the `Display` trait for a type, rather than [`ToString`][tostring].
///
/// `Display` is similar to [`Debug`], but `Display` is for user-facing
/// 输出，因此无法被派生。
///
/// 有关格式器的更多信息，请参阅 [模块级文档][module]。
///
/// [module]: ../../std/fmt/index.html
/// [tostring]: ../../std/string/trait.ToString.html
/// [tostring_function]: ../../std/string/trait.ToString.html#tymethod.to_string
///
/// # 完整性与可解析性
///
/// `Display` for a type might not necessarily be a lossless or complete representation of the type.
/// 它可能会省略类型认为不重要的内部状态、精度或其他信息。
/// for user-facing output, as determined by the type. As such, the output of `Display` might not be
/// 被解析，即使可以解析，解析结果也可能与原始值不完全一致。
/// value.
///
/// However, if a type has a lossless `Display` implementation whose output is meant to be
/// conveniently machine-parseable and not just meant for human consumption, then the type may wish
/// to accept the same format in `FromStr`, and document that usage. Having both `Display` and
/// `FromStr` implementations where the result of `Display` cannot be parsed with `FromStr` may
/// surprise users.
///
/// # 国际化
///
/// Because a type can only have one `Display` implementation, it is often preferable
/// to only implement `Display` when there is a single most "obvious" way that
/// 值可以格式化为文本。这可能意味着按照
/// “不变性”文化和“未定义”区域设置进行格式化，或者意味着该类型的
/// 显示设计针对特定的文化/区域设置，例如开发者日志。
///
/// 如果并非所有值都有合理的标准文本格式，或者您希望
/// 支持标准集合中未涵盖的替代格式
/// [格式化 trait]，最灵活的方法是使用显示适配器：方法
/// like [`str::escape_default`] or [`Path::display`] which create a wrapper
/// implementing `Display` to output the specific display format.
///
/// [formatting traits]: ../../std/fmt/index.html#formatting-traits
/// [`Path::display`]: ../../std/path/struct.Path.html#method.display
///
/// # 示例
///
/// Implementing `Display` on a type:
///
/// ```
/// use std::fmt;
///
/// struct Point {
///     x: i32,
///     y: i32,
/// }
///
/// impl fmt::Display for Point {
///     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
///         write!(f, "({}, {})", self.x, self.y)
///     }
/// }
///
/// let origin = Point { x: 0, y: 0 };
///
/// assert_eq!(format!("The origin is: {origin}"), "The origin is: (0, 0)");
/// ```
#[rustc_on_unimplemented(
    on(
        any(Self = "std::path::Path", Self = "std::path::PathBuf"),
        label = "`{Self}` cannot be formatted with the default formatter; call `.display()` on it",
        note = "call `.display()` or `.to_string_lossy()` to safely print paths, \
                as they may contain non-Unicode data",
    ),
    on(
        from_desugaring = "FormatLiteral",
        note = "in format strings you may be able to use `{{:?}}` (or `{{:#?}}` for pretty-print) instead",
        label = "`{Self}` cannot be formatted with the default formatter",
    ),
    message = "`{Self}` doesn't implement `{this}`"
)]
#[doc(alias = "{}")]
#[rustc_diagnostic_item = "Display"]
#[stable(feature = "rust1", since = "1.0.0")]
pub trait Display: PointeeSized {
    #[doc = include_str!("fmt_trait_method_doc.md")]
    ///
    /// # 示例
    ///
    /// ```
    /// use std::fmt;
    ///
    /// struct Position {
    ///     longitude: f32,
    ///     latitude: f32,
    /// }
    ///
    /// impl fmt::Display for Position {
    ///     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
    ///         write!(f, "({}, {})", self.longitude, self.latitude)
    ///     }
    /// }
    ///
    /// assert_eq!(
    ///     "(1.987, 2.983)",
    ///     format!("{}", Position { longitude: 1.987, latitude: 2.983, }),
    /// );
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    fn fmt(&self, f: &mut Formatter<'_>) -> Result;
}

/// `o` formatting.
///
/// The `Octal` trait should format its output as a number in base-8.
///
/// For primitive signed integers (`i8` to `i128`, and `isize`),
/// 负值以二进制补码形式进行格式化。
///
/// The alternate flag, `#`, adds a `0o` in front of the output.
///
/// 有关格式器的更多信息，请参阅 [模块级文档][module]。
///
/// [module]: ../../std/fmt/index.html
///
/// # 示例
///
/// Basic usage with `i32`:
///
/// ```
/// let x = 42; // 42 is '52' in octal
///
/// assert_eq!(format!("{x:o}"), "52");
/// assert_eq!(format!("{x:#o}"), "0o52");
///
/// assert_eq!(format!("{:o}", -16), "37777777760");
/// ```
///
/// Implementing `Octal` on a type:
///
/// ```
/// use std::fmt;
///
/// struct Length(i32);
///
/// impl fmt::Octal for Length {
///     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
///         let val = self.0;
///
///         fmt::Octal::fmt(&val, f) // delegate to i32's implementation
///     }
/// }
///
/// let l = Length(9);
///
/// assert_eq!(format!("l as octal is: {l:o}"), "l as octal is: 11");
///
/// assert_eq!(format!("l as octal is: {l:#06o}"), "l as octal is: 0o0011");
/// ```
#[stable(feature = "rust1", since = "1.0.0")]
pub trait Octal: PointeeSized {
    #[doc = include_str!("fmt_trait_method_doc.md")]
    #[stable(feature = "rust1", since = "1.0.0")]
    fn fmt(&self, f: &mut Formatter<'_>) -> Result;
}

/// `b` formatting.
///
/// The `Binary` trait should format its output as a number in binary.
///
/// For primitive signed integers ([`i8`] to [`i128`], and [`isize`]),
/// 负值以二进制补码形式进行格式化。
///
/// The alternate flag, `#`, adds a `0b` in front of the output.
///
/// 有关格式器的更多信息，请参阅 [模块级文档][module]。
///
/// [module]: ../../std/fmt/index.html
///
/// # 示例
///
/// Basic usage with [`i32`]:
///
/// ```
/// let x = 42; // 42 is '101010' in binary
///
/// assert_eq!(format!("{x:b}"), "101010");
/// assert_eq!(format!("{x:#b}"), "0b101010");
///
/// assert_eq!(format!("{:b}", -16), "11111111111111111111111111110000");
/// ```
///
/// Implementing `Binary` on a type:
///
/// ```
/// use std::fmt;
///
/// struct Length(i32);
///
/// impl fmt::Binary for Length {
///     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
///         let val = self.0;
///
///         fmt::Binary::fmt(&val, f) // delegate to i32's implementation
///     }
/// }
///
/// let l = Length(107);
///
/// assert_eq!(format!("l as binary is: {l:b}"), "l as binary is: 1101011");
///
/// assert_eq!(
///     // Note that the `0b` prefix added by `#` is included in the total width, so we
///     // need to add two to correctly display all 32 bits.
///     format!("l as binary is: {l:#034b}"),
///     "l as binary is: 0b00000000000000000000000001101011"
/// );
/// ```
#[stable(feature = "rust1", since = "1.0.0")]
pub trait Binary: PointeeSized {
    #[doc = include_str!("fmt_trait_method_doc.md")]
    #[stable(feature = "rust1", since = "1.0.0")]
    fn fmt(&self, f: &mut Formatter<'_>) -> Result;
}

/// `x` formatting.
///
/// The `LowerHex` trait should format its output as a number in hexadecimal, with `a` through `f`
/// 全部小写。
///
/// For primitive signed integers (`i8` to `i128`, and `isize`),
/// 负值以二进制补码形式进行格式化。
///
/// The alternate flag, `#`, adds a `0x` in front of the output.
///
/// 有关格式器的更多信息，请参阅 [模块级文档][module]。
///
/// [module]: ../../std/fmt/index.html
///
/// # 示例
///
/// Basic usage with `i32`:
///
/// ```
/// let y = 42; // 42 is '2a' in hex
///
/// assert_eq!(format!("{y:x}"), "2a");
/// assert_eq!(format!("{y:#x}"), "0x2a");
///
/// assert_eq!(format!("{:x}", -16), "fffffff0");
/// ```
///
/// Implementing `LowerHex` on a type:
///
/// ```
/// use std::fmt;
///
/// struct Length(i32);
///
/// impl fmt::LowerHex for Length {
///     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
///         let val = self.0;
///
///         fmt::LowerHex::fmt(&val, f) // delegate to i32's implementation
///     }
/// }
///
/// let l = Length(9);
///
/// assert_eq!(format!("l as hex is: {l:x}"), "l as hex is: 9");
///
/// assert_eq!(format!("l as hex is: {l:#010x}"), "l as hex is: 0x00000009");
/// ```
#[stable(feature = "rust1", since = "1.0.0")]
pub trait LowerHex: PointeeSized {
    #[doc = include_str!("fmt_trait_method_doc.md")]
    #[stable(feature = "rust1", since = "1.0.0")]
    fn fmt(&self, f: &mut Formatter<'_>) -> Result;
}

/// `X` formatting.
///
/// The `UpperHex` trait should format its output as a number in hexadecimal, with `A` through `F`
/// 全部大写。
///
/// For primitive signed integers (`i8` to `i128`, and `isize`),
/// 负值以二进制补码形式进行格式化。
///
/// The alternate flag, `#`, adds a `0x` in front of the output.
///
/// 有关格式器的更多信息，请参阅 [模块级文档][module]。
///
/// [module]: ../../std/fmt/index.html
///
/// # 示例
///
/// Basic usage with `i32`:
///
/// ```
/// let y = 42; // 42 is '2A' in hex
///
/// assert_eq!(format!("{y:X}"), "2A");
/// assert_eq!(format!("{y:#X}"), "0x2A");
///
/// assert_eq!(format!("{:X}", -16), "FFFFFFF0");
/// ```
///
/// Implementing `UpperHex` on a type:
///
/// ```
/// use std::fmt;
///
/// struct Length(i32);
///
/// impl fmt::UpperHex for Length {
///     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
///         let val = self.0;
///
///         fmt::UpperHex::fmt(&val, f) // delegate to i32's implementation
///     }
/// }
///
/// let l = Length(i32::MAX);
///
/// assert_eq!(format!("l as hex is: {l:X}"), "l as hex is: 7FFFFFFF");
///
/// assert_eq!(format!("l as hex is: {l:#010X}"), "l as hex is: 0x7FFFFFFF");
/// ```
#[stable(feature = "rust1", since = "1.0.0")]
pub trait UpperHex: PointeeSized {
    #[doc = include_str!("fmt_trait_method_doc.md")]
    #[stable(feature = "rust1", since = "1.0.0")]
    fn fmt(&self, f: &mut Formatter<'_>) -> Result;
}

/// `p` formatting.
///
/// The `Pointer` trait should format its output as a memory location. This is commonly presented
/// 十六进制形式。有关格式器的更多信息，请参阅 [模块级文档][module]。
///
/// 打印指针不是发现 Rust 程序实现方式的有效方法。
/// 读取地址的行为会改变程序本身，并可能改变数据在内存中的表示方式，还可能影响代码所应用的优化。
/// 打印的指针值不能保证稳定，也不是对象的唯一标识符。
///
/// Rust 允许将值移动到不同的内存位置，并可能重新使用相同的内存位置
/// 用于不同的目的。
/// 无法保证打印的值可以转换回指针。
///
/// # 示例
///
/// [module]: ../../std/fmt/index.html
///
/// # Examples
///
/// Basic usage with `&i32`:
///
/// ```
/// let x = &42;
///
/// let address = format!("{x:p}"); // this produces something like '0x7f06092ac6d0'
/// ```
///
/// Implementing `Pointer` on a type:
///
/// ```
/// use std::fmt;
///
/// struct Length(i32);
///
/// impl fmt::Pointer for Length {
///     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
///         // use `as` to convert to a `*const T`, which implements Pointer, which we can use
///
///         let ptr = self as *const Self;
///         fmt::Pointer::fmt(&ptr, f)
///     }
/// }
///
/// let l = Length(42);
///
/// println!("l is in memory here: {l:p}");
///
/// let l_ptr = format!("{l:018p}");
/// assert_eq!(l_ptr.len(), 18);
/// assert_eq!(&l_ptr[..2], "0x");
/// ```
#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_diagnostic_item = "Pointer"]
pub trait Pointer: PointeeSized {
    #[doc = include_str!("fmt_trait_method_doc.md")]
    #[stable(feature = "rust1", since = "1.0.0")]
    fn fmt(&self, f: &mut Formatter<'_>) -> Result;
}

/// `e` formatting.
///
/// The `LowerExp` trait should format its output in scientific notation with a lower-case `e`.
///
/// 有关格式器的更多信息，请参阅 [模块级文档][module]。
///
/// [module]: ../../std/fmt/index.html
///
/// # 示例
///
/// Basic usage with `f64`:
///
/// ```
/// let x = 42.0; // 42.0 is '4.2e1' in scientific notation
///
/// assert_eq!(format!("{x:e}"), "4.2e1");
/// ```
///
/// Implementing `LowerExp` on a type:
///
/// ```
/// use std::fmt;
///
/// struct Length(i32);
///
/// impl fmt::LowerExp for Length {
///     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
///         let val = f64::from(self.0);
///         fmt::LowerExp::fmt(&val, f) // delegate to f64's implementation
///     }
/// }
///
/// let l = Length(100);
///
/// assert_eq!(
///     format!("l in scientific notation is: {l:e}"),
///     "l in scientific notation is: 1e2"
/// );
///
/// assert_eq!(
///     format!("l in scientific notation is: {l:05e}"),
///     "l in scientific notation is: 001e2"
/// );
/// ```
#[stable(feature = "rust1", since = "1.0.0")]
pub trait LowerExp: PointeeSized {
    #[doc = include_str!("fmt_trait_method_doc.md")]
    #[stable(feature = "rust1", since = "1.0.0")]
    fn fmt(&self, f: &mut Formatter<'_>) -> Result;
}

/// `E` formatting.
///
/// The `UpperExp` trait should format its output in scientific notation with an upper-case `E`.
///
/// 有关格式化器的更多信息，请参见[模块级文档][module]。
///
/// [module]: ../../std/fmt/index.html
///
/// # 示例
///
/// Basic usage with `f64`:
///
/// ```
/// let x = 42.0; // 42.0 is '4.2E1' in scientific notation
///
/// assert_eq!(format!("{x:E}"), "4.2E1");
/// ```
///
/// Implementing `UpperExp` on a type:
///
/// ```
/// use std::fmt;
///
/// struct Length(i32);
///
/// impl fmt::UpperExp for Length {
///     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
///         let val = f64::from(self.0);
///         fmt::UpperExp::fmt(&val, f) // delegate to f64's implementation
///     }
/// }
///
/// let l = Length(100);
///
/// assert_eq!(
///     format!("l in scientific notation is: {l:E}"),
///     "l in scientific notation is: 1E2"
/// );
///
/// assert_eq!(
///     format!("l in scientific notation is: {l:05E}"),
///     "l in scientific notation is: 001E2"
/// );
/// ```
#[stable(feature = "rust1", since = "1.0.0")]
pub trait UpperExp: PointeeSized {
    #[doc = include_str!("fmt_trait_method_doc.md")]
    #[stable(feature = "rust1", since = "1.0.0")]
    fn fmt(&self, f: &mut Formatter<'_>) -> Result;
}

/// Takes an output stream and an `Arguments` struct that can be precompiled with
/// the `format_args!` macro.
///
/// 参数将根据指定的格式字符串进行格式化
/// 并写入提供的输出流中。
///
/// # 示例
///
/// 基本用法：
///
/// ```
/// use std::fmt;
///
/// let mut output = String::new();
/// fmt::write(&mut output, format_args!("Hello {}!", "world"))
///     .expect("writing to a `String` should not fail");
/// assert_eq!(output, "Hello world!");
/// ```
///
/// Please note that using [`write!`] might be preferable. Example:
///
/// ```
/// use std::fmt::Write;
///
/// let mut output = String::new();
/// write!(&mut output, "Hello {}!", "world")
///     .expect("writing to a `String` should not fail");
/// assert_eq!(output, "Hello world!");
/// ```
///
/// [`write!`]: crate::write!
#[stable(feature = "rust1", since = "1.0.0")]
pub fn write(output: &mut dyn Write, fmt: Arguments<'_>) -> Result {
    if let Some(s) = fmt.as_str() {
        return output.write_str(s);
    }

    let mut template = fmt.template;
    let args = fmt.args;

    let mut arg_index = 0;

    // See comment on `fmt::Arguments` for the details of how the template is encoded.

    // This must match the encoding from `expand_format_args` in
    // compiler/rustc_ast_lowering/src/format.rs.
    loop {
        // SAFETY: We can assume the template is valid.
        let n = unsafe {
            let n = template.read();
            template = template.add(1);
            n
        };

        if n == 0 {
            // End of template.
            return Ok(());
        } else if n < 0x80 {
            // Literal string piece of length `n`.

            // SAFETY: We can assume the strings in the template are valid.
            let s = unsafe {
                let s = crate::str::from_raw_parts(template.as_ptr(), n as usize);
                template = template.add(n as usize);
                s
            };
            output.write_str(s)?;
        } else if n == 0x80 {
            // Literal string piece with a 16-bit length.

            // SAFETY: We can assume the strings in the template are valid.
            let s = unsafe {
                let len = usize::from(u16::from_le_bytes(template.cast_array().read()));
                template = template.add(2);
                let s = crate::str::from_raw_parts(template.as_ptr(), len);
                template = template.add(len);
                s
            };
            output.write_str(s)?;
        } else if n == 0xC0 {
            // Placeholder for next argument with default options.
            //
            // Having this as a separate case improves performance for the common case.

            // SAFETY: We can assume the template only refers to arguments that exist.
            unsafe {
                args.add(arg_index)
                    .as_ref()
                    .fmt(&mut Formatter::new(output, FormattingOptions::new()))?;
            }
            arg_index += 1;
        } else {
            // SAFETY: We can assume the template is valid.
            unsafe { assert_unchecked(n > 0xC0) };

            // Placeholder with custom options.

            let mut opt = FormattingOptions::new();

            // SAFETY: We can assume the template is valid.
            unsafe {
                if n & 1 != 0 {
                    opt.flags = u32::from_le_bytes(template.cast_array().read());
                    template = template.add(4);
                }
                if n & 2 != 0 {
                    opt.width = u16::from_le_bytes(template.cast_array().read());
                    template = template.add(2);
                }
                if n & 4 != 0 {
                    opt.precision = u16::from_le_bytes(template.cast_array().read());
                    template = template.add(2);
                }
                if n & 8 != 0 {
                    arg_index = usize::from(u16::from_le_bytes(template.cast_array().read()));
                    template = template.add(2);
                }
            }
            if n & 16 != 0 {
                // Dynamic width from a usize argument.
                // SAFETY: We can assume the template only refers to arguments that exist.
                unsafe {
                    opt.width = args.add(opt.width as usize).as_ref().as_u16().unwrap_unchecked();
                }
            }
            if n & 32 != 0 {
                // Dynamic precision from a usize argument.
                // SAFETY: We can assume the template only refers to arguments that exist.
                unsafe {
                    opt.precision =
                        args.add(opt.precision as usize).as_ref().as_u16().unwrap_unchecked();
                }
            }

            // SAFETY: We can assume the template only refers to arguments that exist.
            unsafe {
                args.add(arg_index).as_ref().fmt(&mut Formatter::new(output, opt))?;
            }
            arg_index += 1;
        }
    }
}

/// Padding after the end of something. Returned by `Formatter::padding`.
#[must_use = "don't forget to write the post padding"]
pub(crate) struct PostPadding {
    fill: char,
    padding: u16,
}

impl PostPadding {
    fn new(fill: char, padding: u16) -> PostPadding {
        PostPadding { fill, padding }
    }

    /// 写入此帖子以进行填充。
    pub(crate) fn write(self, f: &mut Formatter<'_>) -> Result {
        for _ in 0..self.padding {
            f.buf.write_char(self.fill)?;
        }
        Ok(())
    }
}

impl<'a> Formatter<'a> {
    fn wrap_buf<'b, 'c, F>(&'b mut self, wrap: F) -> Formatter<'c>
    where
        'b: 'c,
        F: FnOnce(&'b mut (dyn Write + 'b)) -> &'c mut (dyn Write + 'c),
    {
        Formatter {
            // We want to change this
            buf: wrap(self.buf),

            // And preserve these
            options: self.options,
        }
    }

    // Helper methods used for padding and processing formatting arguments that
    // all formatting traits can use.

    /// 对已经
    /// 被转换为字符串的整数执行正确的填充操作。该字符串不应包含整数的符号，
    /// 该符号将由此方法添加。
    ///
    /// # 参数
    ///
    /// * is_nonnegative - 原始整数是否为正或零。
    /// * prefix - 如果提供了 '#' 字符（可选），则这是
    /// 在数字前添加的前缀。
    /// * buf - 数字被格式化的字节数组
    ///
    /// 此函数会正确考虑提供的标志以及
    /// 最小宽度。它不会考虑精度。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::fmt;
    ///
    /// struct Foo { nb: i32 }
    ///
    /// impl Foo {
    ///     fn new(nb: i32) -> Foo {
    ///         Foo {
    ///             nb,
    ///         }
    ///     }
    /// }
    ///
    /// impl fmt::Display for Foo {
    ///     fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
    ///         // We need to remove "-" from the number output.
    ///         let tmp = self.nb.abs().to_string();
    ///
    ///         formatter.pad_integral(self.nb >= 0, "Foo ", &tmp)
    ///     }
    /// }
    ///
    /// assert_eq!(format!("{}", Foo::new(2)), "2");
    /// assert_eq!(format!("{}", Foo::new(-1)), "-1");
    /// assert_eq!(format!("{}", Foo::new(0)), "0");
    /// assert_eq!(format!("{:#}", Foo::new(-1)), "-Foo 1");
    /// assert_eq!(format!("{:0>#8}", Foo::new(-1)), "00-Foo 1");
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn pad_integral(&mut self, is_nonnegative: bool, prefix: &str, buf: &str) -> Result {
        let mut width = buf.len();

        let mut sign = None;
        if !is_nonnegative {
            sign = Some('-');
            width += 1;
        } else if self.sign_plus() {
            sign = Some('+');
            width += 1;
        }

        let prefix = if self.alternate() {
            width += prefix.chars().count();
            Some(prefix)
        } else {
            None
        };

        // Writes the sign if it exists, and then the prefix if it was requested
        #[inline(never)]
        fn write_prefix(f: &mut Formatter<'_>, sign: Option<char>, prefix: Option<&str>) -> Result {
            if let Some(c) = sign {
                f.buf.write_char(c)?;
            }
            if let Some(prefix) = prefix { f.buf.write_str(prefix) } else { Ok(()) }
        }

        // The `width` field is more of a `min-width` parameter at this point.
        let min = self.options.width;
        if width >= usize::from(min) {
            // We're over the minimum width, so then we can just write the bytes.
            write_prefix(self, sign, prefix)?;
            self.buf.write_str(buf)
        } else if self.sign_aware_zero_pad() {
            // The sign and prefix goes before the padding if the fill character
            // is zero
            let old_options = self.options;
            self.options.fill('0').align(Some(Alignment::Right));
            write_prefix(self, sign, prefix)?;
            let post_padding = self.padding(min - width as u16, Alignment::Right)?;
            self.buf.write_str(buf)?;
            post_padding.write(self)?;
            self.options = old_options;
            Ok(())
        } else {
            // Otherwise, the sign and prefix goes after the padding
            let post_padding = self.padding(min - width as u16, Alignment::Right)?;
            write_prefix(self, sign, prefix)?;
            self.buf.write_str(buf)?;
            post_padding.write(self)
        }
    }

    /// 接受一个切片字符串，并在应用
    /// 指定的格式化标志后将其输出到内部缓冲区中。
    ///
    /// 通用字符串识别的标志包括：
    ///
    /// * width - 要输出的最小宽度
    /// * fill/align - 要输出什么以及如果提供的字符串
    /// 需要填充时如何输出。
    /// * precision - 要输出的最大长度，如果字符串
    /// 超过此长度，则会被截断。
    ///
    /// Notably this function ignores the `flag` parameters.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::fmt;
    ///
    /// struct Foo;
    ///
    /// impl fmt::Display for Foo {
    ///     fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
    ///         formatter.pad("Foo")
    ///     }
    /// }
    ///
    /// assert_eq!(format!("{Foo:<4}"), "Foo ");
    /// assert_eq!(format!("{Foo:0>4}"), "0Foo");
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn pad(&mut self, s: &str) -> Result {
        // Make sure there's a fast path up front.
        if self.options.flags & (flags::WIDTH_FLAG | flags::PRECISION_FLAG) == 0 {
            return self.buf.write_str(s);
        }

        // The `precision` field can be interpreted as a maximum width for the
        // string being formatted.
        let (s, char_count) = if let Some(max_char_count) = self.options.get_precision() {
            let mut iter = s.char_indices();
            let remaining = match iter.advance_by(usize::from(max_char_count)) {
                Ok(()) => 0,
                Err(remaining) => remaining.get(),
            };
            // SAFETY: The offset of `.char_indices()` is guaranteed to be
            // in-bounds and between character boundaries.
            let truncated = unsafe { s.get_unchecked(..iter.offset()) };
            (truncated, usize::from(max_char_count) - remaining)
        } else {
            // Use the optimized char counting algorithm for the full string.
            (s, s.chars().count())
        };

        // The `width` field is more of a minimum width parameter at this point.
        if char_count < usize::from(self.options.width) {
            // If we're under the minimum width, then fill up the minimum width
            // with the specified string + some alignment.
            let post_padding =
                self.padding(self.options.width - char_count as u16, Alignment::Left)?;
            self.buf.write_str(s)?;
            post_padding.write(self)
        } else {
            // If we're over the minimum width or there is no minimum width, we
            // can just emit the string.
            self.buf.write_str(s)
        }
    }

    /// 写入预填充内容，并返回未写入的后填充内容。
    ///
    /// 调用者负责确保在
    /// 被填充的内容之后写入后填充内容。
    pub(crate) fn padding(
        &mut self,
        padding: u16,
        default: Alignment,
    ) -> result::Result<PostPadding, Error> {
        let align = self.options.get_align().unwrap_or(default);
        let fill = self.options.get_fill();

        let padding_left = match align {
            Alignment::Left => 0,
            Alignment::Right => padding,
            Alignment::Center => padding / 2,
        };

        for _ in 0..padding_left {
            self.buf.write_char(fill)?;
        }

        Ok(PostPadding::new(fill, padding - padding_left))
    }

    /// 获取格式化后的部分并应用填充。
    ///
    /// 假设调用者已经以所需的精度渲染了这些部分，
    /// so that `self.precision` can be ignored.
    ///
    /// # 安全性
    ///
    /// Any `numfmt::Part::Copy` parts in `formatted` must contain valid UTF-8.
    unsafe fn pad_formatted_parts(&mut self, formatted: &numfmt::Formatted<'_>) -> Result {
        if self.options.width == 0 {
            // this is the common case and we take a shortcut
            // SAFETY: Per the precondition.
            unsafe { self.write_formatted_parts(formatted) }
        } else {
            // for the sign-aware zero padding, we render the sign first and
            // behave as if we had no sign from the beginning.
            let mut formatted = formatted.clone();
            let mut width = self.options.width;
            let old_options = self.options;
            if self.sign_aware_zero_pad() {
                // a sign always goes first
                let sign = formatted.sign;
                self.buf.write_str(sign)?;

                // remove the sign from the formatted parts
                formatted.sign = "";
                width = width.saturating_sub(sign.len() as u16);
                self.options.fill('0').align(Some(Alignment::Right));
            }

            // remaining parts go through the ordinary padding process.
            let len = formatted.len();
            let ret = if usize::from(width) <= len {
                // no padding
                // SAFETY: Per the precondition.
                unsafe { self.write_formatted_parts(&formatted) }
            } else {
                // Padding widths are capped at `u16`, so reaching this branch means
                // the formatted output is also shorter than `u16::MAX`.
                let len = match u16::try_from(len) {
                    Ok(len) => len,
                    Err(_) => unreachable!(),
                };
                let post_padding = self.padding(width - len, Alignment::Right)?;
                // SAFETY: Per the precondition.
                unsafe {
                    self.write_formatted_parts(&formatted)?;
                }
                post_padding.write(self)
            };
            self.options = old_options;
            ret
        }
    }

    /// # 安全性
    ///
    /// Any `numfmt::Part::Copy` parts in `formatted` must contain valid UTF-8.
    unsafe fn write_formatted_parts(&mut self, formatted: &numfmt::Formatted<'_>) -> Result {
        unsafe fn write_bytes(buf: &mut dyn Write, s: &[u8]) -> Result {
            // SAFETY: This is used for `numfmt::Part::Num` and `numfmt::Part::Copy`.
            // It's safe to use for `numfmt::Part::Num` since every char `c` is between
            // `b'0'` and `b'9'`, which means `s` is valid UTF-8. It's safe to use for
            // `numfmt::Part::Copy` due to this function's precondition.
            buf.write_str(unsafe { str::from_utf8_unchecked(s) })
        }

        if !formatted.sign.is_empty() {
            self.buf.write_str(formatted.sign)?;
        }
        for part in formatted.parts {
            match *part {
                numfmt::Part::Zero(mut nzeroes) => {
                    const ZEROES: &str = // 64 zeroes
                        "0000000000000000000000000000000000000000000000000000000000000000";
                    while nzeroes > ZEROES.len() {
                        self.buf.write_str(ZEROES)?;
                        nzeroes -= ZEROES.len();
                    }
                    if nzeroes > 0 {
                        self.buf.write_str(&ZEROES[..nzeroes])?;
                    }
                }
                numfmt::Part::Num(mut v) => {
                    let mut s = [0; 5];
                    let len = part.len();
                    for c in s[..len].iter_mut().rev() {
                        *c = b'0' + (v % 10) as u8;
                        v /= 10;
                    }
                    // SAFETY: Per the precondition.
                    unsafe {
                        write_bytes(self.buf, &s[..len])?;
                    }
                }
                // SAFETY: Per the precondition.
                numfmt::Part::Copy(buf) => unsafe {
                    write_bytes(self.buf, buf)?;
                },
            }
        }
        Ok(())
    }

    /// 将某些数据写入此
    /// 格式化器内部包含的底层缓冲区中。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::fmt;
    ///
    /// struct Foo;
    ///
    /// impl fmt::Display for Foo {
    ///     fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
    ///         formatter.write_str("Foo")
    ///         // This is equivalent to:
    ///         // write!(formatter, "Foo")
    ///     }
    /// }
    ///
    /// assert_eq!(format!("{Foo}"), "Foo");
    /// assert_eq!(format!("{Foo:0>8}"), "Foo");
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn write_str(&mut self, data: &str) -> Result {
        self.buf.write_str(data)
    }

    /// Glue for usage of the [`write!`] macro with implementors of this trait.
    ///
    /// 通常不应手动调用此方法，而应通过
    /// the [`write!`] macro itself.
    ///
    /// 将一些格式化信息写入此实例。
    ///
    /// This method delegates to the underlying [`Write`] implementation, so
    /// 格式化输出是追加到之前写入的数据，还是替换它，取决于该写入者。
    /// # 示例
    ///
    /// # 相同的格式化代码根据底层写入器不同可能产生不同的输出：
    ///
    /// ```
    /// use std::fmt;
    ///
    /// struct Foo(i32);
    ///
    /// impl fmt::Display for Foo {
    ///     fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
    ///         formatter.write_fmt(format_args!("Foo {}", self.0))
    ///     }
    /// }
    ///
    /// assert_eq!(format!("{}", Foo(-1)), "Foo -1");
    /// assert_eq!(format!("{:0>8}", Foo(2)), "Foo 2");
    /// ```
    ///
    /// 同样的格式化代码根据底层写入器不同产生不同结果：
    /// 返回用于格式化的标志。
    ///
    /// ```
    /// use std::fmt;
    ///
    /// struct Hello;
    ///
    /// impl fmt::Display for Hello {
    ///     fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
    ///         formatter.write_fmt(format_args!("Hello"))?;
    ///         formatter.write_fmt(format_args!(" world"))
    ///     }
    /// }
    ///
    /// // A writer that replaces its contents on every write.
    /// struct Replace(String);
    ///
    /// impl fmt::Write for Replace {
    ///     fn write_str(&mut self, s: &str) -> fmt::Result {
    ///         self.0.clear();
    ///         self.0.push_str(s);
    ///         Ok(())
    ///     }
    /// }
    ///
    /// // With `String`, which appends, both writes are kept.
    /// let mut s = String::new();
    /// fmt::write(&mut s, format_args!("{Hello}"))?;
    /// assert_eq!(s, "Hello world");
    ///
    /// // With a writer that replaces, the second write replaces the first.
    /// let mut w = Replace(String::new());
    /// fmt::write(&mut w, format_args!("{Hello}"))?;
    /// assert_eq!(w.0, " world");
    /// # Ok::<(), fmt::Error>(())
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    pub fn write_fmt(&mut self, fmt: Arguments<'_>) -> Result {
        if let Some(s) = fmt.as_statically_known_str() {
            self.buf.write_str(s)
        } else {
            write(self.buf, fmt)
        }
    }

    /// 当需要对齐时，返回用作“填充”的字符。
    #[must_use]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[deprecated(
        since = "1.24.0",
        note = "use the `sign_plus`, `sign_minus`, `alternate`, \
                or `sign_aware_zero_pad` methods instead"
    )]
    pub fn flags(&self) -> u32 {
        // Extract the debug upper/lower hex, zero pad, alternate, and plus/minus flags
        // to stay compatible with older versions of Rust.
        self.options.flags >> 21 & 0x3F
    }

    /// 返回用于对齐的形式标志。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::fmt;
    ///
    /// struct Foo;
    ///
    /// impl fmt::Display for Foo {
    ///     fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
    ///         let c = formatter.fill();
    ///         if let Some(width) = formatter.width() {
    ///             for _ in 0..width {
    ///                 write!(formatter, "{c}")?;
    ///             }
    ///             Ok(())
    ///         } else {
    ///             write!(formatter, "{c}")
    ///         }
    ///     }
    /// }
    ///
    /// // We set alignment to the right with ">".
    /// assert_eq!(format!("{Foo:G>3}"), "GGG");
    /// assert_eq!(format!("{Foo:t>6}"), "tttttt");
    /// ```
    #[must_use]
    #[stable(feature = "fmt_flags", since = "1.5.0")]
    pub fn fill(&self) -> char {
        self.options.get_fill()
    }

    /// 返回指示请求了哪种对齐形式的标志。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::fmt::{self, Alignment};
    ///
    /// struct Foo;
    ///
    /// impl fmt::Display for Foo {
    ///     fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
    ///         let s = if let Some(s) = formatter.align() {
    ///             match s {
    ///                 Alignment::Left    => "left",
    ///                 Alignment::Right   => "right",
    ///                 Alignment::Center  => "center",
    ///             }
    ///         } else {
    ///             "into the void"
    ///         };
    ///         write!(formatter, "{s}")
    ///     }
    /// }
    ///
    /// assert_eq!(format!("{Foo:<}"), "left");
    /// assert_eq!(format!("{Foo:>}"), "right");
    /// assert_eq!(format!("{Foo:^}"), "center");
    /// assert_eq!(format!("{Foo}"), "into the void");
    /// ```
    #[must_use]
    #[stable(feature = "fmt_flags_align", since = "1.28.0")]
    pub fn align(&self) -> Option<Alignment> {
        self.options.get_align()
    }

    /// 返回输出应使用的可选指定整数宽度。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::fmt;
    ///
    /// struct Foo(i32);
    ///
    /// impl fmt::Display for Foo {
    ///     fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
    ///         if let Some(width) = formatter.width() {
    ///             // If we received a width, we use it
    ///             write!(formatter, "{:width$}", format!("Foo({})", self.0), width = width)
    ///         } else {
    ///             // Otherwise we do nothing special
    ///             write!(formatter, "Foo({})", self.0)
    ///         }
    ///     }
    /// }
    ///
    /// assert_eq!(format!("{:10}", Foo(23)), "Foo(23)   ");
    /// assert_eq!(format!("{}", Foo(23)), "Foo(23)");
    /// ```
    #[must_use]
    #[stable(feature = "fmt_flags", since = "1.5.0")]
    pub fn width(&self) -> Option<usize> {
        if self.options.flags & flags::WIDTH_FLAG == 0 {
            None
        } else {
            Some(self.options.width as usize)
        }
    }

    /// 返回数值类型可选的指定精度。
    /// 或者，字符串类型的最大宽度。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::fmt;
    ///
    /// struct Foo(f32);
    ///
    /// impl fmt::Display for Foo {
    ///     fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
    ///         if let Some(precision) = formatter.precision() {
    ///             // If we received a precision, we use it.
    ///             write!(formatter, "Foo({1:.*})", precision, self.0)
    ///         } else {
    ///             // Otherwise we default to 2.
    ///             write!(formatter, "Foo({:.2})", self.0)
    ///         }
    ///     }
    /// }
    ///
    /// assert_eq!(format!("{:.4}", Foo(23.2)), "Foo(23.2000)");
    /// assert_eq!(format!("{}", Foo(23.2)), "Foo(23.20)");
    /// ```
    #[must_use]
    #[stable(feature = "fmt_flags", since = "1.5.0")]
    pub fn precision(&self) -> Option<usize> {
        if self.options.flags & flags::PRECISION_FLAG == 0 {
            None
        } else {
            Some(self.options.precision as usize)
        }
    }

    /// Determines if the `+` flag was specified.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::fmt;
    ///
    /// struct Foo(i32);
    ///
    /// impl fmt::Display for Foo {
    ///     fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
    ///         if formatter.sign_plus() {
    ///             write!(formatter,
    ///                    "Foo({}{})",
    ///                    if self.0 < 0 { '-' } else { '+' },
    ///                    self.0.abs())
    ///         } else {
    ///             write!(formatter, "Foo({})", self.0)
    ///         }
    ///     }
    /// }
    ///
    /// assert_eq!(format!("{:+}", Foo(23)), "Foo(+23)");
    /// assert_eq!(format!("{:+}", Foo(-23)), "Foo(-23)");
    /// assert_eq!(format!("{}", Foo(23)), "Foo(23)");
    /// ```
    #[must_use]
    #[stable(feature = "fmt_flags", since = "1.5.0")]
    pub fn sign_plus(&self) -> bool {
        self.options.flags & flags::SIGN_PLUS_FLAG != 0
    }

    /// Determines if the `-` flag was specified.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::fmt;
    ///
    /// struct Foo(i32);
    ///
    /// impl fmt::Display for Foo {
    ///     fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
    ///         if formatter.sign_minus() {
    ///             // You want a minus sign? Have one!
    ///             write!(formatter, "-Foo({})", self.0)
    ///         } else {
    ///             write!(formatter, "Foo({})", self.0)
    ///         }
    ///     }
    /// }
    ///
    /// assert_eq!(format!("{:-}", Foo(23)), "-Foo(23)");
    /// assert_eq!(format!("{}", Foo(23)), "Foo(23)");
    /// ```
    #[must_use]
    #[stable(feature = "fmt_flags", since = "1.5.0")]
    pub fn sign_minus(&self) -> bool {
        self.options.flags & flags::SIGN_MINUS_FLAG != 0
    }

    /// Determines if the `#` flag was specified.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::fmt;
    ///
    /// struct Foo(i32);
    ///
    /// impl fmt::Display for Foo {
    ///     fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
    ///         if formatter.alternate() {
    ///             write!(formatter, "Foo({})", self.0)
    ///         } else {
    ///             write!(formatter, "{}", self.0)
    ///         }
    ///     }
    /// }
    ///
    /// assert_eq!(format!("{:#}", Foo(23)), "Foo(23)");
    /// assert_eq!(format!("{}", Foo(23)), "23");
    /// ```
    #[must_use]
    #[stable(feature = "fmt_flags", since = "1.5.0")]
    pub fn alternate(&self) -> bool {
        self.options.flags & flags::ALTERNATE_FLAG != 0
    }

    /// Determines if the `0` flag was specified.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::fmt;
    ///
    /// struct Foo(i32);
    ///
    /// impl fmt::Display for Foo {
    ///     fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
    ///         assert!(formatter.sign_aware_zero_pad());
    ///         assert_eq!(formatter.width(), Some(4));
    ///         // We ignore the formatter's options.
    ///         write!(formatter, "{}", self.0)
    ///     }
    /// }
    ///
    /// assert_eq!(format!("{:04}", Foo(23)), "23");
    /// ```
    #[must_use]
    #[stable(feature = "fmt_flags", since = "1.5.0")]
    pub fn sign_aware_zero_pad(&self) -> bool {
        self.options.flags & flags::SIGN_AWARE_ZERO_PAD_FLAG != 0
    }

    // FIXME: Decide what public API we want for these two flags.
    // https://github.com/rust-lang/rust/issues/48584
    fn debug_lower_hex(&self) -> bool {
        self.options.flags & flags::DEBUG_LOWER_HEX_FLAG != 0
    }
    fn debug_upper_hex(&self) -> bool {
        self.options.flags & flags::DEBUG_UPPER_HEX_FLAG != 0
    }

    /// Creates a [`DebugStruct`] builder designed to assist with creation of
    /// [`fmt::Debug`] implementations for structs.
    ///
    /// [`fmt::Debug`]: self::Debug
    ///
    /// # 示例
    ///
    /// ```rust
    /// use std::fmt;
    /// use std::net::Ipv4Addr;
    ///
    /// struct Foo {
    ///     bar: i32,
    ///     baz: String,
    ///     addr: Ipv4Addr,
    /// }
    ///
    /// impl fmt::Debug for Foo {
    ///     fn fmt(&self, fmt: &mut fmt::Formatter<'_>) -> fmt::Result {
    ///         fmt.debug_struct("Foo")
    ///             .field("bar", &self.bar)
    ///             .field("baz", &self.baz)
    ///             .field("addr", &format_args!("{}", self.addr))
    ///             .finish()
    ///     }
    /// }
    ///
    /// assert_eq!(
    ///     "Foo { bar: 10, baz: \"Hello World\", addr: 127.0.0.1 }",
    ///     format!("{:?}", Foo {
    ///         bar: 10,
    ///         baz: "Hello World".to_string(),
    ///         addr: Ipv4Addr::new(127, 0, 0, 1),
    ///     })
    /// );
    /// ```
    #[stable(feature = "debug_builders", since = "1.2.0")]
    pub fn debug_struct<'b>(&'b mut self, name: &str) -> DebugStruct<'b, 'a> {
        builders::debug_struct_new(self, name)
    }

    /// Shrinks `derive(Debug)` code, for faster compilation and smaller
    /// binaries. `debug_struct_fields_finish` is more general, but this is
    /// 对于单个字段更快。
    #[doc(hidden)]
    #[unstable(feature = "fmt_helpers_for_derive", issue = "none")]
    pub fn debug_struct_field1_finish<'b>(&'b mut self, names: &str, value1: &dyn Debug) -> Result {
        self.debug_struct_fields_finish(names, &[value1])
    }

    /// Shrinks `derive(Debug)` code, for faster compilation and smaller
    /// binaries. `debug_struct_fields_finish` is more general, but this is
    /// 对于两个字段更快。
    #[doc(hidden)]
    #[unstable(feature = "fmt_helpers_for_derive", issue = "none")]
    pub fn debug_struct_field2_finish<'b>(
        &'b mut self,
        names: &str,
        value1: &dyn Debug,
        value2: &dyn Debug,
    ) -> Result {
        self.debug_struct_fields_finish(names, &[value1, value2])
    }

    /// Shrinks `derive(Debug)` code, for faster compilation and smaller
    /// binaries. `debug_struct_fields_finish` is more general, but this is
    /// 对于三个字段更快。
    #[doc(hidden)]
    #[unstable(feature = "fmt_helpers_for_derive", issue = "none")]
    pub fn debug_struct_field3_finish<'b>(
        &'b mut self,
        names: &str,
        value1: &dyn Debug,
        value2: &dyn Debug,
        value3: &dyn Debug,
    ) -> Result {
        self.debug_struct_fields_finish(names, &[value1, value2, value3])
    }

    /// Shrinks `derive(Debug)` code, for faster compilation and smaller
    /// binaries. `debug_struct_fields_finish` is more general, but this is
    /// 对于四个字段更快。
    #[doc(hidden)]
    #[unstable(feature = "fmt_helpers_for_derive", issue = "none")]
    pub fn debug_struct_field4_finish<'b>(
        &'b mut self,
        names: &str,
        value1: &dyn Debug,
        value2: &dyn Debug,
        value3: &dyn Debug,
        value4: &dyn Debug,
    ) -> Result {
        self.debug_struct_fields_finish(names, &[value1, value2, value3, value4])
    }

    /// Shrinks `derive(Debug)` code, for faster compilation and smaller
    /// binaries. `debug_struct_fields_finish` is more general, but this is
    /// 对于五个字段更快。
    #[doc(hidden)]
    #[unstable(feature = "fmt_helpers_for_derive", issue = "none")]
    pub fn debug_struct_field5_finish<'b>(
        &'b mut self,
        names: &str,
        value1: &dyn Debug,
        value2: &dyn Debug,
        value3: &dyn Debug,
        value4: &dyn Debug,
        value5: &dyn Debug,
    ) -> Result {
        self.debug_struct_fields_finish(names, &[value1, value2, value3, value4, value5])
    }

    /// Shrinks `derive(Debug)` code, for faster compilation and smaller binaries.
    /// For the cases not covered by `debug_struct_field[12345]_finish`.
    /// 字段名之间应使用空格分隔。
    #[doc(hidden)]
    #[unstable(feature = "fmt_helpers_for_derive", issue = "none")]
    pub fn debug_struct_fields_finish<'b>(
        &'b mut self,
        names: &str,
        values: &[&dyn Debug],
    ) -> Result {
        // the macro generates either "Point x y" for a struct like `Point { x: u32, y: u32, }`
        // or just "Point" for a tuple struct like `Point(u32, u32)`. If there are no field names
        // (and therefore no space separator), we assume we format a tuple struct.
        // `.as_bytes()` is to avoid bringing in UTF-8 code bloat
        let is_tuple = !names.as_bytes().contains(&b' ');
        if is_tuple {
            let mut builder = builders::debug_tuple_new(self, names);
            for value in values {
                builder.field(value);
            }
            builder.finish()
        } else {
            let mut names = split_str_by_space(names);
            let mut builder = builders::debug_struct_new(self, names.next().unwrap());
            for value in values.into_iter() {
                let name = names.next().unwrap();
                builder.field(name, value);
            }
            builder.finish()
        }
    }

    /// Shrinks `derive(Debug)` code, for faster compilation and smaller binaries.
    /// 对于具有连接变体名称字符串的 C 风格枚举。
    /// 名称应使用空格分隔。
    #[doc(hidden)]
    #[unstable(feature = "fmt_helpers_for_derive", issue = "none")]
    pub fn debug_c_like_enum_write_str<'b>(
        &'b mut self,
        names: &str,
        start_index: usize,
    ) -> Result {
        // we use `get().unwrap()` instead of indexing to avoid binary size
        // bloat from the error path (`slice_error_fail_rt`)
        self.write_str(split_str_by_space(names.get(start_index..).unwrap()).next().unwrap())
    }

    /// Creates a `DebugTuple` builder designed to assist with creation of
    /// `fmt::Debug` implementations for tuple structs.
    ///
    /// # 示例
    ///
    /// ```rust
    /// use std::fmt;
    /// use std::marker::PhantomData;
    ///
    /// struct Foo<T>(i32, String, PhantomData<T>);
    ///
    /// impl<T> fmt::Debug for Foo<T> {
    ///     fn fmt(&self, fmt: &mut fmt::Formatter<'_>) -> fmt::Result {
    ///         fmt.debug_tuple("Foo")
    ///             .field(&self.0)
    ///             .field(&self.1)
    ///             .field(&format_args!("_"))
    ///             .finish()
    ///     }
    /// }
    ///
    /// assert_eq!(
    ///     "Foo(10, \"Hello\", _)",
    ///     format!("{:?}", Foo(10, "Hello".to_string(), PhantomData::<u8>))
    /// );
    /// ```
    #[stable(feature = "debug_builders", since = "1.2.0")]
    pub fn debug_tuple<'b>(&'b mut self, name: &str) -> DebugTuple<'b, 'a> {
        builders::debug_tuple_new(self, name)
    }

    /// Creates a `DebugList` builder designed to assist with creation of
    /// `fmt::Debug` implementations for list-like structures.
    ///
    /// # 示例
    ///
    /// ```rust
    /// use std::fmt;
    ///
    /// struct Foo(Vec<i32>);
    ///
    /// impl fmt::Debug for Foo {
    ///     fn fmt(&self, fmt: &mut fmt::Formatter<'_>) -> fmt::Result {
    ///         fmt.debug_list().entries(self.0.iter()).finish()
    ///     }
    /// }
    ///
    /// assert_eq!(format!("{:?}", Foo(vec![10, 11])), "[10, 11]");
    /// ```
    #[stable(feature = "debug_builders", since = "1.2.0")]
    pub fn debug_list<'b>(&'b mut self) -> DebugList<'b, 'a> {
        builders::debug_list_new(self)
    }

    /// Creates a `DebugSet` builder designed to assist with creation of
    /// `fmt::Debug` implementations for set-like structures.
    ///
    /// # 示例
    ///
    /// ```rust
    /// use std::fmt;
    ///
    /// struct Foo(Vec<i32>);
    ///
    /// impl fmt::Debug for Foo {
    ///     fn fmt(&self, fmt: &mut fmt::Formatter<'_>) -> fmt::Result {
    ///         fmt.debug_set().entries(self.0.iter()).finish()
    ///     }
    /// }
    ///
    /// assert_eq!(format!("{:?}", Foo(vec![10, 11])), "{10, 11}");
    /// ```
    ///
    /// [`format_args!`]: crate::format_args
    ///
    /// In this more complex example, we use [`format_args!`] and `.debug_set()`
    /// 来构建一组匹配分支：
    ///
    /// ```rust
    /// use std::fmt;
    ///
    /// struct Arm<'a, L, R>(&'a (L, R));
    /// struct Table<'a, K, V>(&'a [(K, V)], V);
    ///
    /// impl<'a, L, R> fmt::Debug for Arm<'a, L, R>
    /// where
    ///     L: 'a + fmt::Debug, R: 'a + fmt::Debug
    /// {
    ///     fn fmt(&self, fmt: &mut fmt::Formatter<'_>) -> fmt::Result {
    ///         L::fmt(&(self.0).0, fmt)?;
    ///         fmt.write_str(" => ")?;
    ///         R::fmt(&(self.0).1, fmt)
    ///     }
    /// }
    ///
    /// impl<'a, K, V> fmt::Debug for Table<'a, K, V>
    /// where
    ///     K: 'a + fmt::Debug, V: 'a + fmt::Debug
    /// {
    ///     fn fmt(&self, fmt: &mut fmt::Formatter<'_>) -> fmt::Result {
    ///         fmt.debug_set()
    ///         .entries(self.0.iter().map(Arm))
    ///         .entry(&Arm(&(format_args!("_"), &self.1)))
    ///         .finish()
    ///     }
    /// }
    /// ```
    #[stable(feature = "debug_builders", since = "1.2.0")]
    pub fn debug_set<'b>(&'b mut self) -> DebugSet<'b, 'a> {
        builders::debug_set_new(self)
    }

    /// Creates a `DebugMap` builder designed to assist with creation of
    /// `fmt::Debug` implementations for map-like structures.
    ///
    /// # 示例
    ///
    /// ```rust
    /// use std::fmt;
    ///
    /// struct Foo(Vec<(String, i32)>);
    ///
    /// impl fmt::Debug for Foo {
    ///     fn fmt(&self, fmt: &mut fmt::Formatter<'_>) -> fmt::Result {
    ///         fmt.debug_map().entries(self.0.iter().map(|&(ref k, ref v)| (k, v))).finish()
    ///     }
    /// }
    ///
    /// assert_eq!(
    ///     format!("{:?}",  Foo(vec![("A".to_string(), 10), ("B".to_string(), 11)])),
    ///     r#"{"A": 10, "B": 11}"#
    ///  );
    /// ```
    #[stable(feature = "debug_builders", since = "1.2.0")]
    pub fn debug_map<'b>(&'b mut self) -> DebugMap<'b, 'a> {
        builders::debug_map_new(self)
    }

    /// Returns the sign of this formatter (`+` or `-`).
    #[unstable(feature = "formatting_options", issue = "118117")]
    pub const fn sign(&self) -> Option<Sign> {
        self.options.get_sign()
    }

    /// 返回此格式化器对应的格式选项。
    #[unstable(feature = "formatting_options", issue = "118117")]
    pub const fn options(&self) -> FormattingOptions {
        self.options
    }
}

/// Like `.split(' ')`, but doesn't bloat binary size
fn split_str_by_space(s: &str) -> impl Iterator<Item = &str> {
    s.as_bytes()
        .split(|&b| b == b' ')
        // SAFETY:
        // splitting a valid UTF-8 string on an ASCII byte results in valid UTF-8 substrings
        .map(|bytes| unsafe { str::from_utf8_unchecked(bytes) })
}

#[stable(since = "1.2.0", feature = "formatter_write")]
impl Write for Formatter<'_> {
    fn write_str(&mut self, s: &str) -> Result {
        self.buf.write_str(s)
    }

    fn write_char(&mut self, c: char) -> Result {
        self.buf.write_char(c)
    }

    #[inline]
    fn write_fmt(&mut self, args: Arguments<'_>) -> Result {
        if let Some(s) = args.as_statically_known_str() {
            self.buf.write_str(s)
        } else {
            write(self.buf, args)
        }
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl Display for Error {
    fn fmt(&self, f: &mut Formatter<'_>) -> Result {
        Display::fmt("an error occurred when formatting an argument", f)
    }
}

// Implementations of the core formatting traits

macro_rules! fmt_refs {
    ($($tr:ident),*) => {
        $(
        #[stable(feature = "rust1", since = "1.0.0")]
        impl<T: PointeeSized + $tr> $tr for &T {
            fn fmt(&self, f: &mut Formatter<'_>) -> Result { $tr::fmt(&**self, f) }
        }
        #[stable(feature = "rust1", since = "1.0.0")]
        impl<T: PointeeSized + $tr> $tr for &mut T {
            fn fmt(&self, f: &mut Formatter<'_>) -> Result { $tr::fmt(&**self, f) }
        }
        )*
    }
}

fmt_refs! { Debug, Display, Octal, Binary, LowerHex, UpperHex, LowerExp, UpperExp }

#[stable(feature = "never_type", since = "1.100.0")]
impl Debug for ! {
    #[inline]
    fn fmt(&self, _: &mut Formatter<'_>) -> Result {
        *self
    }
}

#[stable(feature = "never_type", since = "1.100.0")]
impl Display for ! {
    #[inline]
    fn fmt(&self, _: &mut Formatter<'_>) -> Result {
        *self
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl Debug for bool {
    #[inline]
    fn fmt(&self, f: &mut Formatter<'_>) -> Result {
        Display::fmt(self, f)
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl Display for bool {
    fn fmt(&self, f: &mut Formatter<'_>) -> Result {
        Display::fmt(if *self { "true" } else { "false" }, f)
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl Debug for str {
    fn fmt(&self, f: &mut Formatter<'_>) -> Result {
        f.write_char('"')?;

        // substring we know is printable
        let mut printable_range = 0..0;

        fn needs_escape(b: u8) -> bool {
            b > 0x7E || b < 0x20 || b == b'\\' || b == b'"'
        }

        // the loop here first skips over runs of printable ASCII as a fast path.
        // other chars (unicode, or ASCII that needs escaping) are then handled per-`char`.
        let mut rest = self;
        while !rest.is_empty() {
            let Some(non_printable_start) = rest.as_bytes().iter().position(|&b| needs_escape(b))
            else {
                printable_range.end += rest.len();
                break;
            };

            printable_range.end += non_printable_start;
            // SAFETY: the position was derived from an iterator, so is known to be within bounds, and at a char boundary
            rest = unsafe { rest.get_unchecked(non_printable_start..) };

            let mut chars = rest.chars();
            if let Some(c) = chars.next() {
                let esc = c.escape_debug_ext(EscapeDebugExtArgs {
                    escape_single_quote: false,
                    escape_double_quote: true,
                });
                if esc.len() != 1 {
                    f.write_str(&self[printable_range.clone()])?;
                    Display::fmt(&esc, f)?;
                    printable_range.start = printable_range.end + c.len_utf8();
                }
                printable_range.end += c.len_utf8();
            }
            rest = chars.as_str();
        }

        f.write_str(&self[printable_range])?;

        f.write_char('"')
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl Display for str {
    fn fmt(&self, f: &mut Formatter<'_>) -> Result {
        f.pad(self)
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl Debug for char {
    fn fmt(&self, f: &mut Formatter<'_>) -> Result {
        f.write_char('\'')?;
        let esc = self.escape_debug_ext(EscapeDebugExtArgs {
            escape_single_quote: true,
            escape_double_quote: false,
        });
        Display::fmt(&esc, f)?;
        f.write_char('\'')
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl Display for char {
    fn fmt(&self, f: &mut Formatter<'_>) -> Result {
        if f.options.flags & (flags::WIDTH_FLAG | flags::PRECISION_FLAG) == 0 {
            f.write_char(*self)
        } else {
            f.pad(self.encode_utf8(&mut [0; char::MAX_LEN_UTF8]))
        }
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T: PointeeSized> Pointer for *const T {
    fn fmt(&self, f: &mut Formatter<'_>) -> Result {
        // Since the formatting will be identical for all pointer types, erase the pointee type and
        // metadata type to reduce the amount of codegen work needed for each distinct type.
        let ptr: *const T = *self;
        let ptr_addr = ptr.expose_provenance();
        if <<T as core::ptr::Pointee>::Metadata as core::unit::IsUnit>::IS_UNIT {
            pointer_fmt_inner(ptr_addr, f)
        } else {
            wide_pointer_fmt_inner(ptr_addr, &core::ptr::metadata(ptr), f)
        }
    }
}

/// Formats an address in `fmt::Pointer` style.
///
/// This uses `ptr_addr: usize` and not `ptr: *const ()` to be able to use this for
/// `fn(...) -> ...` without using [problematic] "Oxford Casts".
///
/// [problematic]: https://github.com/rust-lang/rust/issues/95489
pub(crate) fn pointer_fmt_inner(ptr_addr: usize, f: &mut Formatter<'_>) -> Result {
    let old_options = f.options;

    // The alternate flag is already treated by LowerHex as being special-
    // it denotes whether to prefix with 0x. We use it to work out whether
    // or not to zero extend, and then unconditionally set it to get the
    // prefix.
    if f.options.get_alternate() {
        f.options.sign_aware_zero_pad(true);

        if f.options.get_width().is_none() {
            f.options.width(Some((usize::BITS / 4) as u16 + 2));
        }
    }
    f.options.alternate(true);

    let ret = LowerHex::fmt(&ptr_addr, f);

    f.options = old_options;

    ret
}

/// Formats a wide pointer (address and type-erased metadata) in `fmt::Pointer` style.
fn wide_pointer_fmt_inner(ptr_addr: usize, metadata: &dyn Debug, f: &mut Formatter<'_>) -> Result {
    f.debug_struct("Pointer")
        .field_with("addr", move |f| pointer_fmt_inner(ptr_addr, f))
        .field("metadata", metadata)
        .finish()
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T: PointeeSized> Pointer for *mut T {
    fn fmt(&self, f: &mut Formatter<'_>) -> Result {
        Pointer::fmt(&(*self as *const T), f)
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T: PointeeSized> Pointer for &T {
    fn fmt(&self, f: &mut Formatter<'_>) -> Result {
        Pointer::fmt(&(*self as *const T), f)
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T: PointeeSized> Pointer for &mut T {
    fn fmt(&self, f: &mut Formatter<'_>) -> Result {
        Pointer::fmt(&(&**self as *const T), f)
    }
}

// Implementation of Display/Debug for various core types

#[stable(feature = "rust1", since = "1.0.0")]
impl<T: PointeeSized> Debug for *const T {
    fn fmt(&self, f: &mut Formatter<'_>) -> Result {
        Pointer::fmt(self, f)
    }
}
#[stable(feature = "rust1", since = "1.0.0")]
impl<T: PointeeSized> Debug for *mut T {
    fn fmt(&self, f: &mut Formatter<'_>) -> Result {
        Pointer::fmt(self, f)
    }
}

macro_rules! peel {
    ($name:ident, $($other:ident,)*) => (tuple! { $($other,)* })
}

macro_rules! tuple {
    () => ();
    ( $($name:ident,)+ ) => (
        maybe_tuple_doc! {
            $($name)+ @
            #[stable(feature = "rust1", since = "1.0.0")]
            impl<$($name:Debug),+> Debug for ($($name,)+) {
                #[allow(non_snake_case, unused_assignments)]
                fn fmt(&self, f: &mut Formatter<'_>) -> Result {
                    let mut builder = f.debug_tuple("");
                    let ($(ref $name,)+) = *self;
                    $(
                        builder.field(&$name);
                    )+

                    builder.finish()
                }
            }
        }
        peel! { $($name,)+ }
    )
}

macro_rules! maybe_tuple_doc {
    ($a:ident @ #[$meta:meta] $item:item) => {
        #[doc(fake_variadic)]
        #[doc = "This trait is implemented for tuples up to twelve items long."]
        #[$meta]
        $item
    };
    ($a:ident $($rest_a:ident)+ @ #[$meta:meta] $item:item) => {
        #[doc(hidden)]
        #[$meta]
        $item
    };
}

tuple! { E, D, C, B, A, Z, Y, X, W, V, U, T, }

#[stable(feature = "rust1", since = "1.0.0")]
impl<T: Debug> Debug for [T] {
    fn fmt(&self, f: &mut Formatter<'_>) -> Result {
        f.debug_list().entries(self.iter()).finish()
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl Debug for () {
    #[inline]
    fn fmt(&self, f: &mut Formatter<'_>) -> Result {
        f.pad("()")
    }
}
#[stable(feature = "rust1", since = "1.0.0")]
impl<T: ?Sized> Debug for PhantomData<T> {
    fn fmt(&self, f: &mut Formatter<'_>) -> Result {
        write!(f, "PhantomData<{}>", crate::any::type_name::<T>())
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T: Copy + Debug> Debug for Cell<T> {
    fn fmt(&self, f: &mut Formatter<'_>) -> Result {
        f.debug_struct("Cell").field("value", &self.get()).finish()
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T: ?Sized + Debug> Debug for RefCell<T> {
    fn fmt(&self, f: &mut Formatter<'_>) -> Result {
        let mut d = f.debug_struct("RefCell");
        match self.try_borrow() {
            Ok(borrow) => d.field("value", &borrow),
            Err(_) => d.field("value", &format_args!("<borrowed>")),
        };
        d.finish()
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T: ?Sized + Debug> Debug for Ref<'_, T> {
    fn fmt(&self, f: &mut Formatter<'_>) -> Result {
        Debug::fmt(&**self, f)
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T: ?Sized + Debug> Debug for RefMut<'_, T> {
    fn fmt(&self, f: &mut Formatter<'_>) -> Result {
        Debug::fmt(self.deref(), f)
    }
}

#[stable(feature = "core_impl_debug", since = "1.9.0")]
impl<T: ?Sized> Debug for UnsafeCell<T> {
    fn fmt(&self, f: &mut Formatter<'_>) -> Result {
        f.debug_struct("UnsafeCell").finish_non_exhaustive()
    }
}

#[unstable(feature = "sync_unsafe_cell", issue = "95439")]
impl<T: ?Sized> Debug for SyncUnsafeCell<T> {
    fn fmt(&self, f: &mut Formatter<'_>) -> Result {
        f.debug_struct("SyncUnsafeCell").finish_non_exhaustive()
    }
}

// If you expected tests to be here, look instead at coretests/tests/fmt/;
// it's a lot easier than creating all of the rt::Piece structures here.
// There are also tests in alloctests/tests/fmt.rs, for those that need allocations.
