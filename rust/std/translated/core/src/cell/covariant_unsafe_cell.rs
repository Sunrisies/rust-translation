use crate::cell::UnsafeCell;
use crate::fmt;
use crate::ops::CoerceUnsized;
use crate::ptr::{self, NonNull};

/// **Co**variant version of [`UnsafeCell`].
#[unstable(feature = "covariant_unsafe_cell", issue = "159735")]
#[repr(transparent)]
#[rustc_pub_transparent]
// Implementation note:
//
// We could make `CovariantUnsafeCell` be the canonical lang item and make `UnsafeCell` a wrapper
// over it, with `PhantomData<*mut T>`. That would however be a huge compiler change, without clear
// benefit.
//
// As such, `CovariantUnsafeCell` is wrapping `UnsafeCell` instead. It is a lang-item only to
// hardcode its variance to be **co**variant in `T`, even though it is wrapping `UnsafeCell` which
// is **in**variant in `T`.
#[lang = "covariant_unsafe_cell"]
pub struct CovariantUnsafeCell<#[rustc_assert_variance(covariant)] T: ?Sized>(UnsafeCell<T>);

#[unstable(feature = "covariant_unsafe_cell", issue = "159735")]
impl<T: ?Sized> !Sync for CovariantUnsafeCell<T> {}

impl<T> CovariantUnsafeCell<T> {
    /// Constructs a new instance of `CovariantUnsafeCell` which will wrap the specified value.
    ///
    /// All access to the inner value through `&CovariantUnsafeCell<T>` requires `unsafe` code.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(covariant_unsafe_cell)]
    /// use std::cell::CovariantUnsafeCell;
    ///
    /// let uc = CovariantUnsafeCell::new(5);
    /// ```
    #[unstable(feature = "covariant_unsafe_cell", issue = "159735")]
    #[rustc_const_unstable(feature = "covariant_unsafe_cell", issue = "159735")]
    #[inline(always)]
    pub const fn new(value: T) -> CovariantUnsafeCell<T> {
        CovariantUnsafeCell(UnsafeCell::new(value))
    }

    /// 解包值，消耗内存。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(covariant_unsafe_cell)]
    /// use std::cell::CovariantUnsafeCell;
    ///
    /// let uc = CovariantUnsafeCell::new(5);
    ///
    /// let five = uc.into_inner();
    /// ```
    #[inline(always)]
    #[unstable(feature = "covariant_unsafe_cell", issue = "159735")]
    #[rustc_const_unstable(feature = "covariant_unsafe_cell", issue = "159735")]
    pub const fn into_inner(self) -> T {
        self.0.into_inner()
    }
}

impl<T: ?Sized> CovariantUnsafeCell<T> {
    /// 获取对包裹值的可修改非空指针。
    ///
    /// 此指针可以转换为任意类型的指针。在创建（共享或可修改）引用时，你必须
    /// must uphold the aliasing rules; see [the `UnsafeCell` type-level docs] for more discussion
    /// 和注意事项。
    ///
    /// [the `UnsafeCell` type-level docs]: super::UnsafeCell#aliasing-rules
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(covariant_unsafe_cell)]
    /// use std::cell::CovariantUnsafeCell;
    /// use std::ptr::NonNull;
    ///
    /// let uc = CovariantUnsafeCell::new(5);
    ///
    /// let ptr: NonNull<i32> = uc.get();
    /// ```
    #[inline(always)]
    #[lint::as_ptr]
    #[lint::should_not_be_called_on_const_items]
    #[unstable(feature = "covariant_unsafe_cell", issue = "159735")]
    #[rustc_const_unstable(feature = "covariant_unsafe_cell", issue = "159735")]
    pub const fn get(&self) -> NonNull<T> {
        // We can just cast the pointer from `CovariantUnsafeCell<T>` to `T` because of
        // #[repr(transparent)].
        //
        // Note that this is also known to be allowed for user code as per
        // `#[rustc_pub_transparent]`.
        // SAFETY: the pointer is not null, as it comes from a reference
        unsafe { NonNull::new_unchecked(ptr::from_ref(self).cast_mut() as *mut T) }
    }

    /// 返回对底层数据的可修改引用。
    ///
    /// This call borrows the `CovariantUnsafeCell` mutably (at compile-time) which guarantees that
    /// 我们拥有唯一的引用。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(covariant_unsafe_cell)]
    /// use std::cell::CovariantUnsafeCell;
    ///
    /// let mut c = CovariantUnsafeCell::new(5);
    /// *c.get_mut() += 1;
    ///
    /// assert_eq!(*c.get_mut(), 6);
    /// ```
    #[inline(always)]
    #[unstable(feature = "covariant_unsafe_cell", issue = "159735")]
    #[rustc_const_unstable(feature = "covariant_unsafe_cell", issue = "159735")]
    pub const fn get_mut(&mut self) -> &mut T {
        self.0.get_mut()
    }

    /// 获取对包裹值的可修改指针。
    /// The difference from [`get`] is that this function accepts a raw pointer,
    /// 这有助于避免创建临时引用。
    ///
    /// 此指针可以转换为任意类型的指针。在创建（共享或可修改）引用时，你必须
    /// must uphold the aliasing rules; see [the `UnsafeCell` type-level docs] for more discussion
    /// 和注意事项。
    ///
    /// [`get`]: CovariantUnsafeCell::get()
    ///
    /// # 示例
    ///
    /// Gradual initialization of an `CovariantUnsafeCell` requires `raw_get`, as
    /// calling `get` would require creating a reference to uninitialized data:
    ///
    /// ```
    /// #![feature(covariant_unsafe_cell)]
    /// use std::cell::CovariantUnsafeCell;
    /// use std::mem::MaybeUninit;
    ///
    /// let m = MaybeUninit::<CovariantUnsafeCell<i32>>::uninit();
    /// unsafe { CovariantUnsafeCell::raw_get(m.as_ptr()).write(5); }
    /// // avoid below which references to uninitialized data
    /// // unsafe { CovariantUnsafeCell::get(&*m.as_ptr()).write(5); }
    /// let uc = unsafe { m.assume_init() };
    ///
    /// assert_eq!(uc.into_inner(), 5);
    /// ```
    #[inline(always)]
    #[unstable(feature = "covariant_unsafe_cell", issue = "159735")]
    #[rustc_const_unstable(feature = "covariant_unsafe_cell", issue = "159735")]
    pub const fn raw_get(this: *const Self) -> *mut T {
        // We can just cast the pointer from `UnsafeCell<T>` to `T` because of
        // #[repr(transparent)].
        //
        // Note that this is also known to be allowed for user code as per
        // `#[rustc_pub_transparent]`.
        this as *const T as *mut T
    }
}

#[unstable(feature = "coerce_unsized", issue = "18598")]
impl<T: CoerceUnsized<U>, U> CoerceUnsized<CovariantUnsafeCell<U>> for CovariantUnsafeCell<T> {}

#[unstable(feature = "covariant_unsafe_cell", issue = "159735")]
impl<T: ?Sized> fmt::Debug for CovariantUnsafeCell<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("CovariantUnsafeCell").finish_non_exhaustive()
    }
}
