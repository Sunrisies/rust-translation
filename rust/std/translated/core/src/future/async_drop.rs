#![unstable(feature = "async_drop", issue = "126482")]

#[allow(unused_imports)]
use core::future::Future;

#[allow(unused_imports)]
use crate::pin::Pin;
#[allow(unused_imports)]
use crate::task::{Context, Poll};

/// Drop trait 的异步版本。
///
/// 当某个值不再需要时，Rust 会对该值执行“析构函数”。
/// 值不再需要的最常见情况是指它离开
/// 作用域。析构函数在其他情况下也可能被调用，但此处我们
/// 将重点放在作用域上。要了解其他情况，请参考
/// [析构函数] 部分。
///
/// [the reference]: https://doc.rust-lang.org/reference/destructors.html
///
/// ## `Copy` and ([`Drop`]|`AsyncDrop`) are exclusive
///
/// You cannot implement both [`Copy`] and ([`Drop`]|`AsyncDrop`) on the same type. Types that
/// are `Copy` get implicitly duplicated by the compiler, making it very
/// 很难预测析构函数何时以及何频率执行。因此，
/// 这些类型不能拥有析构函数。
#[unstable(feature = "async_drop", issue = "126482")]
#[lang = "async_drop"]
pub trait AsyncDrop {
    /// 对该类型执行异步析构函数。
    ///
    /// 当值离开作用域时，此方法会隐式被调用，
    /// 但不能显式调用。
    ///
    /// When this method has been called, `self` has not yet been deallocated.
    /// 这种情况仅在方法执行完成后发生。
    ///
    /// # Panic
    #[allow(async_fn_in_trait)]
    async fn drop(self: Pin<&mut Self>);
}

/// 异步删除。
///
/// # 安全性
///
/// The pointer `_to_drop` must be valid for both reads and writes,
/// 不仅在本函数调用期间，
/// 而且直到返回的 Future 完成为止。
/// 有关其他安全问题，请参见 [ptr::drop_in_place]。
///
/// [ptr::drop_in_place]: crate::ptr::drop_in_place()
#[unstable(feature = "async_drop", issue = "126482")]
#[lang = "async_drop_in_place"]
pub async unsafe fn async_drop_in_place<T: ?Sized>(_to_drop: &mut T) {
    // Code here does not matter - this is replaced by the
    // real implementation by the compiler.
}
