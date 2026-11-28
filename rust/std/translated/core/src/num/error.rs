//! 转换为整数类型时的错误类型。

use crate::error::Error;
use crate::fmt;

/// 在检查过的整数类型转换失败时返回的错误类型。
#[stable(feature = "try_from", since = "1.34.0")]
#[derive(Debug, Copy, Clone, PartialEq, Eq)]
pub struct TryFromIntError(pub(crate) IntErrorKind);

impl TryFromIntError {
    /// 输出整数转换失败的具体原因。
    #[must_use]
    #[unstable(feature = "try_from_int_error_kind", issue = "153978")]
    pub const fn kind(&self) -> IntErrorKind {
        self.0
    }
}

#[stable(feature = "try_from", since = "1.34.0")]
impl fmt::Display for TryFromIntError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self.0 {
            IntErrorKind::Empty | IntErrorKind::InvalidDigit => unreachable!(),
            IntErrorKind::PosOverflow => "number too large to fit in target type",
            IntErrorKind::NegOverflow => "number too small to fit in target type",
            IntErrorKind::Zero => "number would be zero for non-zero type",
            IntErrorKind::NotAPowerOfTwo => "number is not a power of two",
        }
        .fmt(f)
    }
}

#[stable(feature = "try_from", since = "1.34.0")]
impl Error for TryFromIntError {}

#[stable(feature = "never_type", since = "1.100.0")]
#[rustc_const_unstable(feature = "const_convert", issue = "143773")]
const impl From<!> for TryFromIntError {
    #[inline]
    fn from(never: !) -> TryFromIntError {
        never
    }
}

/// 解析整数时可能返回的错误。
///
/// For example, this error is returned by the `from_str_radix()` functions
/// on the primitive integer types (such as [`i8::from_str_radix`])
/// and is used as the error type in their [`FromStr`] implementations.
///
/// [`FromStr`]: crate::str::FromStr
///
/// # 潜在原因
///
/// Among other causes, `ParseIntError` can be thrown because of leading or trailing whitespace
/// 例如，当从标准输入获取字符串时。
/// Using the [`str::trim()`] method ensures that no whitespace remains before parsing.
///
/// # 示例
///
/// ```
/// if let Err(e) = i32::from_str_radix("a12", 10) {
///     println!("Failed conversion to i32: {e}");
/// }
/// ```
#[derive(Debug, Clone, PartialEq, Eq)]
#[stable(feature = "rust1", since = "1.0.0")]
pub struct ParseIntError {
    pub(super) kind: IntErrorKind,
}

/// 枚举用于存储可能导致解析或转换失败的各种错误类型。
/// 整数类型。
///
/// # 示例
///
/// ```
/// # fn main() {
/// if let Err(e) = i32::from_str_radix("a12", 10) {
///     println!("Failed conversion to i32: {:?}", e.kind());
/// }
/// # }
/// ```
#[stable(feature = "int_error_matching", since = "1.55.0")]
#[derive(Debug, Clone, PartialEq, Eq, Copy, Hash)]
#[non_exhaustive]
pub enum IntErrorKind {
    /// 被解析的值为空。
    ///
    /// 当解析空字符串时，将生成此变体。
    #[stable(feature = "int_error_matching", since = "1.55.0")]
    Empty,
    /// 其上下文中包含无效的数字。
    ///
    /// 其他原因包括当解析包含非 ASCII 字符的字符串时，将生成此变体。
    /// contains a non-ASCII char.
    ///
    /// This variant is also constructed when a `+` or `-` is misplaced within a string
    /// 整数太小而无法存储在目标整数类型中。
    #[stable(feature = "int_error_matching", since = "1.55.0")]
    InvalidDigit,
    /// 整数过大无法存储在目标整数类型中。
    #[stable(feature = "int_error_matching", since = "1.55.0")]
    PosOverflow,
    /// 整数过小无法存储在目标整数类型中。
    #[stable(feature = "int_error_matching", since = "1.55.0")]
    NegOverflow,
    /// 值为零。
    ///
    /// 当解析字符串或转换后的整数值为零时，将生成此变体，而非零类型不允许值为零。
    /// 值不是2的幂。
    #[stable(feature = "int_error_matching", since = "1.55.0")]
    Zero,
    /// Value is not a power of two.
    ///
    /// 输出整数解析失败的具体原因。
    /// two. This is required in some cases such as constructing an [`Alignment`].
    ///
    /// [`Alignment`]: core::mem::Alignment "mem::Alignment"
    #[unstable(feature = "try_from_int_error_kind", issue = "153978")]
    NotAPowerOfTwo,
}

impl ParseIntError {
    /// Outputs the detailed cause of parsing an integer failing.
    #[must_use]
    #[rustc_const_stable(feature = "const_int_from_str", since = "1.82.0")]
    #[stable(feature = "int_error_matching", since = "1.55.0")]
    pub const fn kind(&self) -> &IntErrorKind {
        &self.kind
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl fmt::Display for ParseIntError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self.kind {
            IntErrorKind::Empty => "cannot parse integer from empty string",
            IntErrorKind::InvalidDigit => "invalid digit found in string",
            IntErrorKind::PosOverflow => "number too large to fit in target type",
            IntErrorKind::NegOverflow => "number too small to fit in target type",
            IntErrorKind::Zero => "number would be zero for non-zero type",
            IntErrorKind::NotAPowerOfTwo => "number is not a power of two",
        }
        .fmt(f)
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl Error for ParseIntError {}
