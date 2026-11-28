use crate::intrinsics::reflection::type_id;

/// 将迭代器中的所有单元项合并为单个项。
///
/// 与高级抽象概念结合使用时更为实用，例如：
/// collecting to a `Result<(), E>` where you only care about errors:
///
/// ```
/// use std::io::*;
/// let data = vec![1, 2, 3, 4, 5];
/// let res: Result<()> = data.iter()
///     .map(|x| writeln!(stdout(), "{x}"))
///     .collect();
/// assert!(res.is_ok());
/// ```
#[stable(feature = "unit_from_iter", since = "1.23.0")]
impl FromIterator<()> for () {
    fn from_iter<I: IntoIterator<Item = ()>>(iter: I) -> Self {
        iter.into_iter().for_each(|()| {})
    }
}

pub(crate) trait IsUnit {
    const IS_UNIT: bool;
}

impl<T: ?Sized> IsUnit for T {
    // `type_id` erases lifetimes, but that's OK here because "is it ()" never depends on lifetimes
    const IS_UNIT: bool = type_id::<Self>() == type_id::<()>();
}
