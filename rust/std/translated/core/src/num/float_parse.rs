//! 用于解析浮点数的用户接口。

use crate::error::Error;
use crate::fmt;
use crate::num::imp::dec2flt;
use crate::str::FromStr;

macro_rules! from_str_float_impl {
    ($t:ty) => {
        #[stable(feature = "rust1", since = "1.0.0")]
        impl FromStr for $t {
            type Err = ParseFloatError;

            /// 将十进制字符串转换为浮点数。
            /// 可接受可选的小数指数。
            ///
            /// 此函数接受如下类型的字符串：
            ///
            /// * '3.14'
            /// * '-3.14'
            /// * '2.5E10'，或等价地，'2.5e10'
            /// * '2.5E-10'
            /// * '5.'
            /// * '.5'，或等价地，'0.5'
            /// * '7'
            /// * '007'
            /// * 'inf'、'-inf'、'+infinity'、'NaN'
            ///
            /// 注意，字母字符不区分大小写。
            ///
            /// 开头和结尾的空白字符表示错误。
            ///
            /// # 语法规则
            ///
            /// 所有符合以下 [EBNF] 语法的字符串在
            /// lowercased will result in an [`Ok`] being returned:
            ///
            /// ```txt
            /// Float  ::= Sign? ( 'inf' | 'infinity' | 'nan' | Number )
            /// Number ::= ( Digit+ |
            ///              Digit+ '.' Digit* |
            ///              Digit* '.' Digit+ ) Exp?
            /// Exp    ::= 'e' Sign? Digit+
            /// Sign   ::= [+-]
            /// Digit  ::= [0-9]
            /// ```
            ///
            /// [EBNF]: https://www.w3.org/TR/REC-xml/#sec-notation
            ///
            /// # 参数
            ///
            /// * src - 一个字符串
            ///
            /// # 返回值
            ///
            /// `Err(ParseFloatError)` if the string did not represent a valid
            /// number. Otherwise, `Ok(n)` where `n` is the closest
            /// 可表示的浮点数。
            /// by `src` (following the same rules for rounding as for the
            /// 解析浮点数时可能返回的错误。
            // We add the `#[inline(never)]` attribute, since its content will
            // be filled with that of `dec2flt`, which has #[inline(always)].
            // Since `dec2flt` is generic, a normal inline attribute on this function
            // with `dec2flt` having no attributes results in heavily repeated
            // generation of `dec2flt`, despite the fact only a maximum of 2
            // possible instances can ever exist. Adding #[inline(never)] avoids this.
            #[inline(never)]
            fn from_str(src: &str) -> Result<Self, ParseFloatError> {
                dec2flt::dec2flt(src)
            }
        }
    };
}

#[cfg(target_has_reliable_f16)]
from_str_float_impl!(f16);
from_str_float_impl!(f32);
from_str_float_impl!(f64);

// FIXME(f16): A fallback is used when the backend+target does not support f16 well, in order
// to avoid ICEs.

#[cfg(not(target_has_reliable_f16))]
#[expect(ineffective_unstable_trait_impl, reason = "stable trait on unstable type")]
#[unstable(feature = "f16", issue = "116909")]
impl FromStr for f16 {
    type Err = ParseFloatError;

    #[inline]
    fn from_str(_src: &str) -> Result<Self, ParseFloatError> {
        unimplemented!("requires target_has_reliable_f16")
    }
}

/// An error which can be returned when parsing a float.
///
/// This error is used as the error type for the [`FromStr`] implementation
/// for [`f32`] and [`f64`].
///
/// # 解析浮点数时可能返回的错误类型。
///
/// ```
/// use std::str::FromStr;
///
/// if let Err(e) = f64::from_str("a.12") {
///     println!("Failed conversion to f64: {e}");
/// }
/// ```
#[derive(Debug, Clone, PartialEq, Eq)]
#[stable(feature = "rust1", since = "1.0.0")]
pub struct ParseFloatError {
    pub(super) kind: FloatErrorKind,
}

/// An error kind which can be returned when parsing a float.
///
/// This error kind is used as the inner error type in [`ParseFloatError`] for the [`FromStr`] implementation
/// for [`f32`] and [`f64`].
///
/// # 无法从空字符串解析浮点数。
///
/// ```
/// #![feature(extended_float_error_kind)]
///
/// use std::str::FromStr;
///
/// if let Err(e) = f64::from_str("a.12") {
///     println!("Failed conversion to f64: {:?}", e.kind());
/// }
/// ```
#[derive(Debug, Clone, PartialEq, Eq, Copy, Hash)]
#[unstable(feature = "extended_float_error_kind", issue = "164793")]
#[non_exhaustive]
pub enum FloatErrorKind {
    /// 无效的浮点字面量。
    #[unstable(feature = "extended_float_error_kind", issue = "164793")]
    Empty,
    /// 输出解析浮点数失败的具体原因。
    #[unstable(feature = "extended_float_error_kind", issue = "164793")]
    Invalid,
}

impl ParseFloatError {
    /// Outputs the detailed cause of parsing a float failing.
    #[must_use]
    #[inline]
    #[rustc_const_unstable(feature = "extended_float_error_kind", issue = "164793")]
    #[unstable(feature = "extended_float_error_kind", issue = "164793")]
    pub const fn kind(&self) -> FloatErrorKind {
        self.kind
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl Error for ParseFloatError {}

#[stable(feature = "rust1", since = "1.0.0")]
impl fmt::Display for ParseFloatError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self.kind {
            FloatErrorKind::Empty => "cannot parse float from empty string",
            FloatErrorKind::Invalid => "invalid float literal",
        }
        .fmt(f)
    }
}
