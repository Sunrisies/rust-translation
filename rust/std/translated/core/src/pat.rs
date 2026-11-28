//! Helper module for exporting the `pattern_type` macro

use crate::marker::{Freeze, PointeeSized, Unsize};
use crate::ops::{CoerceUnsized, DispatchFromDyn};

/// 创建一个模式类型
/// ```ignore (cannot test this from within core yet)
/// type Positive = std::pat::pattern_type!(i32 is 1..);
/// ```
#[allow_internal_unstable(internal_syntax)]
#[unstable(feature = "pattern_types", issue = "123646")]
#[diagnostic::opaque]
pub macro pattern_type($( $arg:tt )*) {
    k#pattern_type($( $arg )*)
}

/// A trait implemented for integer types and `char`.
/// 未来可用于泛型模式类型，但目前
/// 用于简化模式类型范围的 AST 降阶操作
#[unstable(feature = "pattern_type_range_trait", issue = "123646")]
#[rustc_const_unstable(feature = "pattern_type_range_trait", issue = "123646")]
#[diagnostic::on_unimplemented(
    message = "`{Self}` is not a valid base type for range patterns",
    label = "only integer types and `char` are supported"
)]
pub const trait RangePattern {
    /// Trait version of the inherent `MIN` assoc const.
    #[lang = "RangeMin"]
    const MIN: Self;

    /// Trait version of the inherent `MIN` assoc const.
    #[lang = "RangeMax"]
    const MAX: Self;

    /// 一个编译时辅助函数，用于对排他性范围减去 1
    #[lang = "RangeSub"]
    #[track_caller]
    fn sub_one(self) -> Self;
}

macro_rules! impl_range_pat {
    ($($ty:ty,)*) => {
        $(
            #[rustc_const_unstable(feature = "pattern_type_range_trait", issue = "123646")]
            const impl RangePattern for $ty {
                const MIN: $ty = <$ty>::MIN;
                const MAX: $ty = <$ty>::MAX;
                fn sub_one(self) -> Self {
                    match self.checked_sub(1) {
                        Some(val) => val,
                        None => panic!("exclusive range end at minimum value of type")
                    }
                }
            }
        )*
    }
}

impl_range_pat! {
    i8, i16, i32, i64, i128, isize,
    u8, u16, u32, u64, u128, usize,
}

#[rustc_const_unstable(feature = "pattern_type_range_trait", issue = "123646")]
const impl RangePattern for char {
    const MIN: Self = char::MIN;

    const MAX: Self = char::MAX;

    fn sub_one(self) -> Self {
        match char::from_u32(self as u32 - 1) {
            None => panic!("exclusive range to start of valid chars"),
            Some(val) => val,
        }
    }
}

impl<T: PointeeSized, U: PointeeSized> CoerceUnsized<pattern_type!(*const U is !null)> for pattern_type!(*const T is !null) where
    T: Unsize<U>
{
}

impl<T: DispatchFromDyn<U>, U> DispatchFromDyn<pattern_type!(U is !null)> for pattern_type!(T is !null) {}

impl<T: PointeeSized> Unpin for pattern_type!(*const T is !null) {}

unsafe impl<T: PointeeSized> Freeze for pattern_type!(*const T is !null) {}

unsafe impl<T: PointeeSized> Freeze for pattern_type!(*mut T is !null) {}
