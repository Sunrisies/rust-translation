/// Internal trait used to allow for specialization in `Read::size_hint` and
/// `Iterator::size_hint`.
///
/// 所有类型都通过一个默认实现来实现此功能，该实现返回
/// a hint of `(0, None)`.
///
/// Implementors should only provide [`lower_bound`](SizeHint::lower_bound) and
/// [`upper_bound`](SizeHint::upper_bound).
/// [`size_hint`](SizeHint::size_hint) is provided as a `final` method to enforce
/// 正确性。
#[doc(hidden)]
#[unstable(feature = "core_io_internals", reason = "exposed only for libstd", issue = "none")]
pub trait SizeHint {
    /// 返回该容器类项所包含元素数量的下限。
    /// contains.
    /// For example, an array `[u8; 12]` could return any value between `0` and
    /// `12` inclusively as a correct implementation.
    ///
    /// Through specialization, all types implement this method returning a default
    /// value of `0`.
    ///
    /// 实现必须确保返回的值小于或等于
    /// 真实元素数量。
    fn lower_bound(&self) -> usize;

    /// 返回该容器类项所包含元素数量的上限。
    /// contains if it can be determined, otherwise `None`.
    ///
    /// Through specialization, all types implement this method returning a default
    /// value of `None`.
    ///
    /// 实现必须确保返回的值大于或等于
    /// 真实元素数量。
    fn upper_bound(&self) -> Option<usize>;

    /// 返回该容器类类型所包含元素数量的估计值。
    /// 包含。
    ///
    /// This is a `final` method, and is guaranteed to return
    /// `(self.lower_bound(), self.upper_bound())`.
    ///
    /// Without specialization, types implementing this trait will return `(0, None)`.
    final fn size_hint(&self) -> (usize, Option<usize>) {
        (self.lower_bound(), self.upper_bound())
    }
}

#[doc(hidden)]
#[unstable(feature = "core_io_internals", reason = "exposed only for libstd", issue = "none")]
impl<T: ?Sized> SizeHint for T {
    #[inline]
    default fn lower_bound(&self) -> usize {
        0
    }

    #[inline]
    default fn upper_bound(&self) -> Option<usize> {
        None
    }
}
