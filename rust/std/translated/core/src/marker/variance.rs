#![unstable(feature = "phantom_variance_markers", issue = "135806")]

use super::PhantomData;
use crate::any::type_name;
use crate::clone::TrivialClone;
use crate::cmp::Ordering;
use crate::fmt;
use crate::hash::{Hash, Hasher};

macro_rules! first_token {
    ($first:tt $($rest:tt)*) => {
        $first
    };
}

macro_rules! phantom_type {
    ($(
        $(#[$attr:meta])*
        pub struct $name:ident <$(#[$param_attr:meta])? $t:ident> ($($inner:tt)*);
    )*) => {$(
        $(#[$attr])*
        pub struct $name<$(#[$param_attr])? $t>($($inner)*) where $t: ?Sized;

        impl<T> $name<T>
            where T: ?Sized
        {
            /// 构造一个变异标记的新实例。
            pub const fn new() -> Self {
                Self(PhantomData)
            }
        }

        impl<T> self::private_items::PrivateItems for $name<T> where T: ?Sized {
            const VALUE: Self = Self::new();
        }
        impl<T> Variance for $name<T> where T: ?Sized {}

        impl<T> Default for $name<T>
            where T: ?Sized
        {
            fn default() -> Self {
                Self(PhantomData)
            }
        }

        impl<T> fmt::Debug for $name<T>
            where T: ?Sized
        {
            fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
                write!(f, "{}<{}>", stringify!($name), type_name::<T>())
            }
        }

        impl<T> Clone for $name<T>
            where T: ?Sized
        {
            fn clone(&self) -> Self {
                *self
            }
        }

        impl<T> Copy for $name<T> where T: ?Sized {}

        #[doc(hidden)]
        unsafe impl<T> TrivialClone for $name<T> where T: ?Sized {}

        impl<T> PartialEq for $name<T>
            where T: ?Sized
        {
            fn eq(&self, _: &Self) -> bool {
                true
            }
        }

        impl<T> Eq for $name<T> where T: ?Sized {}

        impl<T> PartialOrd for $name<T>
            where T: ?Sized
        {
            fn partial_cmp(&self, _: &Self) -> Option<Ordering> {
                Some(Ordering::Equal)
            }
        }

        impl<T> Ord for $name<T>
            where T: ?Sized
        {
            fn cmp(&self, _: &Self) -> Ordering {
                Ordering::Equal
            }
        }

        impl<T> Hash for $name<T>
            where T: ?Sized
        {
            fn hash<H: Hasher>(&self, _: &mut H) {}
        }
    )*};
}

macro_rules! phantom_lifetime {
    ($(
        $(#[$attr:meta])*
        pub struct $name:ident <$(#[$param_attr:meta])? $lt:lifetime> ($($inner:tt)*);
    )*) => {$(
        $(#[$attr])*
        #[derive(Default, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
        pub struct $name<$(#[$param_attr])? $lt>($($inner)*);

        impl $name<'_> {
            /// 构造一个变异标记的新实例。
            pub const fn new() -> Self {
                Self(first_token!($($inner)*)(PhantomData))
            }
        }

        impl self::private_items::PrivateItems for $name<'_> {
            const VALUE: Self = Self::new();
        }
        impl Variance for $name<'_> {}

        impl fmt::Debug for $name<'_> {
            fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
                write!(f, "{}", stringify!($name))
            }
        }
    )*};
}

phantom_lifetime! {
    /// 用于标记生命周期为可变性的零大小类型。
    ///
    /// 可变的生命周期必须至少与声明的一样长。更多信息请参阅[参考文档][1]。
    /// 信息。
    ///
    /// [1]: https://doc.rust-lang.org/stable/reference/subtyping.html#variance
    ///
    /// Note: If `'a` is otherwise contravariant or invariant, the resulting type is invariant.
    ///
    /// ## 布局
    ///
    /// For all `'a`, the following are guaranteed:
    /// * `size_of::<PhantomCovariantLifetime<'a>>() == 0`
    /// * `align_of::<PhantomCovariantLifetime<'a>>() == 1`
    #[rustc_pub_transparent]
    #[repr(transparent)]
    pub struct PhantomCovariantLifetime<#[rustc_assert_variance(covariant)] 'a>(PhantomCovariant<&'a ()>);
    /// 用于标记生命周期为反变的零大小类型。
    ///
    /// 反变的生命周期必须最多与声明的一样长。更多信息请参阅[参考文档][1]。
    /// 信息。
    ///
    /// [1]: https://doc.rust-lang.org/stable/reference/subtyping.html#variance
    ///
    /// Note: If `'a` is otherwise covariant or invariant, the resulting type is invariant.
    ///
    /// ## 布局
    ///
    /// For all `'a`, the following are guaranteed:
    /// * `size_of::<PhantomContravariantLifetime<'a>>() == 0`
    /// * `align_of::<PhantomContravariantLifetime<'a>>() == 1`
    #[rustc_pub_transparent]
    #[repr(transparent)]
    pub struct PhantomContravariantLifetime<#[rustc_assert_variance(contravariant)] 'a>(PhantomContravariant<&'a ()>);
    /// 用于标记生命周期为不变的零大小类型。
    ///
    /// 不变的生命周期必须按声明的长度存在，不能更短也不能更长。
    /// 更多信息请参阅[参考文档][1]。
    ///
    /// [1]: https://doc.rust-lang.org/stable/reference/subtyping.html#variance
    ///
    /// ## 布局
    ///
    /// For all `'a`, the following are guaranteed:
    /// * `size_of::<PhantomInvariantLifetime<'a>>() == 0`
    /// * `align_of::<PhantomInvariantLifetime<'a>>() == 1`
    #[rustc_pub_transparent]
    #[repr(transparent)]
    pub struct PhantomInvariantLifetime<#[rustc_assert_variance(invariant)] 'a>(PhantomInvariant<&'a ()>);
}

phantom_type! {
    /// 用于标记类型参数为可变的零大小类型。
    ///
    /// 作为函数返回值一部分使用的类型是可变的。如果该类型还作为参数传递，则它是[不变的][PhantomInvariant]。更多信息请参阅[参考文档][1]。
    /// passed as a parameter then it is [invariant][PhantomInvariant]. See [the reference][1] for
    /// ## 布局
    ///
    /// [1]: https://doc.rust-lang.org/stable/reference/subtyping.html#variance
    ///
    /// Note: If `T` is otherwise contravariant or invariant, the resulting type is invariant.
    ///
    /// ## 布局
    ///
    /// For all `T`, the following are guaranteed:
    /// * `size_of::<PhantomCovariant<T>>() == 0`
    /// * `align_of::<PhantomCovariant<T>>() == 1`
    #[rustc_pub_transparent]
    #[repr(transparent)]
    pub struct PhantomCovariant<#[rustc_assert_variance(covariant)] T>(PhantomData<fn() -> T>);
    /// 用于标记类型参数为反变的零大小类型。
    ///
    /// 作为函数参数传递的类型是反变的。如果该类型还作为函数的返回值的一部分，则它是[不变的][PhantomInvariant]。更多信息请参阅[参考文档][1]。
    /// return value from a function then it is [invariant][PhantomInvariant]. See [the
    /// ## 布局
    ///
    /// [1]: https://doc.rust-lang.org/stable/reference/subtyping.html#variance
    ///
    /// Note: If `T` is otherwise covariant or invariant, the resulting type is invariant.
    ///
    /// ## 布局
    ///
    /// For all `T`, the following are guaranteed:
    /// * `size_of::<PhantomContravariant<T>>() == 0`
    /// * `align_of::<PhantomContravariant<T>>() == 1`
    #[rustc_pub_transparent]
    #[repr(transparent)]
    pub struct PhantomContravariant<#[rustc_assert_variance(contravariant)] T>(PhantomData<fn(T)>);
    /// 用于标记类型参数为不变的零大小类型。
    ///
    /// 同时作为参数传递且作为函数返回值一部分使用的类型是不变的。更多信息请参阅[参考文档][1]。
    /// ## 布局
    ///
    /// [1]: https://doc.rust-lang.org/stable/reference/subtyping.html#variance
    ///
    /// ## 布局
    ///
    /// For all `T`, the following are guaranteed:
    /// * `size_of::<PhantomInvariant<T>>() == 0`
    /// * `align_of::<PhantomInvariant<T>>() == 1`
    #[rustc_pub_transparent]
    #[repr(transparent)]
    pub struct PhantomInvariant<#[rustc_assert_variance(invariant)] T>(PhantomData<fn(T) -> T>);
}

mod private_items {
    #[unstable(feature = "std_internals", issue = "none")]
    pub trait PrivateItems {
        const VALUE: Self;
    }
}

/// 用于幻影变异类型的标记 trait。
pub trait Variance: private_items::PrivateItems + Default {}

/// Construct a variance marker; equivalent to [`Default::default`].
///
/// 此类型可以是以上任意一种。通常不需要显式命名。
/// 类型，然而。
///
/// - [`PhantomCovariant`]
/// - [`PhantomContravariant`]
/// - [`PhantomInvariant`]
/// - [`PhantomCovariantLifetime`]
/// - [`PhantomContravariantLifetime`]
/// - [`PhantomInvariantLifetime`]
///
/// # 示例
///
/// ```rust
/// #![feature(phantom_variance_markers)]
///
/// use core::marker::{PhantomCovariant, variance};
///
/// struct BoundFn<F, P, R>
/// where
///     F: Fn(P) -> R,
/// {
///     function: F,
///     parameter: P,
///     return_value: PhantomCovariant<R>,
/// }
///
/// let bound_fn = BoundFn {
///     function: core::convert::identity,
///     parameter: 5u8,
///     return_value: variance(),
/// };
/// ```
pub const fn variance<T>() -> T
where
    T: Variance,
{
    T::VALUE
}
