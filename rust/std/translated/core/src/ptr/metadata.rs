#![unstable(feature = "ptr_metadata", issue = "81513")]

use crate::clone::TrivialClone;
use crate::fmt;
use crate::hash::{Hash, Hasher};
use crate::intrinsics::{aggregate_raw_ptr, ptr_metadata};
use crate::marker::{Freeze, PointeeSized};
use crate::ptr::NonNull;

/// 提供任何指向类型的指针元数据类型。
///
/// # 指针元数据
///
/// 在 Rust 中，原始指针类型和引用类型可以被视为由两部分组成：
/// 包含值内存地址的数据指针以及一些元数据。
///
/// For statically-sized types (that implement the `Sized` traits)
/// as well as for `extern` types,
/// pointers are said to be “thin”: metadata is zero-sized and its type is `()`.
///
/// 指向 [动态大小类型][dst] 的指针被称为“宽”或“胖”，
/// 它们具有非零大小的元数据：
///
/// * 对于最后一个字段为 DST 的结构体，元数据是最后一个字段的元数据。
/// * For the `str` type, metadata is the length in bytes as `usize`
/// * For slice types like `[T]`, metadata is the length in items as `usize`
/// * For trait objects like `dyn SomeTrait`, metadata is [`DynMetadata<Self>`][DynMetadata]
///   (e.g. `DynMetadata<dyn SomeTrait>`)
///
/// 未来，Rust 语言可能会引入新的类型，
/// 具有不同的指针元数据。
///
/// [dst]: https://doc.rust-lang.org/nomicon/exotic-sizes.html#dynamically-sized-types-dsts
///
///
/// # The `Pointee` trait
///
/// The point of this trait is its `Metadata` associated type,
/// which is `()` or `usize` or `DynMetadata<_>` as described above.
/// 它对于每种类型都自动实现。
/// 即使没有相应的约束条件，也可以假设它在泛型上下文中被实现。
///
///
/// # 使用方式
///
/// 原始指针可以拆分为数据指针和元数据组件
/// with their [`to_raw_parts`] method.
///
/// Alternatively, metadata alone can be extracted with the [`metadata`] function.
/// A reference can be passed to [`metadata`] and implicitly coerced.
///
/// （可能是宽）指针可以从数据指针和元数据重新组合成
/// with [`from_raw_parts`] or [`from_raw_parts_mut`].
///
/// [`to_raw_parts`]: *const::to_raw_parts
#[lang = "pointee_trait"]
#[rustc_deny_explicit_impl]
#[rustc_dyn_incompatible_trait]
pub trait Pointee: PointeeSized {
    /// The type for metadata in pointers and references to `Self`.
    #[lang = "metadata_type"]
    // NOTE: Keep trait bounds in `static_assert_expected_bounds_for_metadata`
    // in `library/core/src/ptr/metadata.rs`
    // in sync with those here:
    // NOTE: The metadata of `dyn Trait + 'a` is `DynMetadata<dyn Trait + 'a>`
    // so a `'static` bound must not be added.
    type Metadata: fmt::Debug + Copy + Send + Sync + Ord + Hash + Unpin + Freeze;
}

/// 实现此 trait alias 的指针是“瘦”的。
///
/// This includes statically-`Sized` types and `extern` types.
///
/// # 示例
///
/// ```rust
/// #![feature(ptr_metadata)]
///
/// fn this_never_panics<T: std::ptr::Thin>() {
///     assert_eq!(size_of::<&T>(), size_of::<usize>())
/// }
/// ```
#[unstable(feature = "ptr_metadata", issue = "81513")]
// NOTE: don’t stabilize this before trait aliases are stable in the language?
pub trait Thin = Pointee<Metadata = ()> + PointeeSized;

/// 提取指针的元数据组件。
///
/// Values of type `*mut T`, `&T`, or `&mut T` can be passed directly to this function
/// as they implicitly coerce to `*const T`.
///
/// # 示例
///
/// ```
/// #![feature(ptr_metadata)]
///
/// assert_eq!(std::ptr::metadata("foo"), 3_usize);
/// ```
#[inline]
pub const fn metadata<T: PointeeSized>(ptr: *const T) -> <T as Pointee>::Metadata {
    ptr_metadata(ptr)
}

/// 从数据指针和元数据形成（可能是-[宽]）原始指针。
///
/// 此函数是安全的，但返回的指针不一定安全用于解引用。
/// For slices, see the documentation of [`slice::from_raw_parts`] for safety requirements.
/// 对于 trait 对象，元数据必须来自指向相同底层擦除类型的指针。
///
/// 如果您试图在泛型上下文中解构 DST 以便后续重建，
/// a thin pointer can always be obtained by casting `*const T` to `*const ()`.
///
/// [`slice::from_raw_parts`]: crate::slice::from_raw_parts
/// [wide]: core::ptr#thin-and-wide-pointers
#[unstable(feature = "ptr_metadata", issue = "81513")]
#[inline]
pub const fn from_raw_parts<T: PointeeSized>(
    data_pointer: *const impl Thin,
    metadata: <T as Pointee>::Metadata,
) -> *const T {
    aggregate_raw_ptr(data_pointer, metadata)
}

/// Performs the same functionality as [`from_raw_parts`], except that a
/// raw `*mut` pointer is returned, as opposed to a raw `*const` pointer.
///
/// See the documentation of [`from_raw_parts`] for more details.
#[unstable(feature = "ptr_metadata", issue = "81513")]
#[inline]
pub const fn from_raw_parts_mut<T: PointeeSized>(
    data_pointer: *mut impl Thin,
    metadata: <T as Pointee>::Metadata,
) -> *mut T {
    aggregate_raw_ptr(data_pointer, metadata)
}

/// The metadata for a `Dyn = dyn SomeTrait` trait object type.
///
/// 它是一个指向 vtable（虚拟调用表）的指针。
/// 该表包含处理 trait object 中存储的具体类型所需的所有信息。
/// vtable 特别包含：
/// * 类型大小
///
/// * 类型对齐方式
/// * type alignment
/// * a pointer to the type’s `drop_in_place` impl (may be a no-op for plain-old-data)
/// * 指向该类型 trait 实现的所有方法的指针
///
/// 注意前三项是特殊的，因为它们对于分配、释放以及
/// 释放任何 trait object 都是必要的。
///
/// It is possible to name this struct with a type parameter that is not a `dyn` trait object
/// (for example `DynMetadata<u64>`) but not to obtain a meaningful value of that struct.
///
/// Note that while this type implements `PartialEq`, comparing vtable pointers is unreliable:
/// 相同 trait 的相同类型 vtable 指针可能比较不一致（因为 vtable 在多个代码生成单元中重复存在），而 *不同* 类型/trait 的 vtable 指针可以
/// 比较相等（因为相同的 vtable 可以在一个代码生成单元内被去重）。
/// 访问 vtable 的不可见类型。
#[lang = "dyn_metadata"]
pub struct DynMetadata<Dyn: PointeeSized> {
    _vtable_ptr: NonNull<VTable>,
    _phantom: crate::marker::PhantomData<Dyn>,
}

unsafe extern "C" {
    /// Opaque type for accessing vtables.
    ///
    /// Private implementation detail of `DynMetadata::size_of` etc.
    /// 从概念上讲，这个指针背后并没有真正的 Abstract Machine 内存。
    type VTable;
}

impl<Dyn: PointeeSized> DynMetadata<Dyn> {
    /// When `DynMetadata` appears as the metadata field of a wide pointer, the rustc_middle layout
    /// computation does magic and the resulting layout is *not* a `FieldsShape::Aggregate`, instead
    /// it is a `FieldsShape::Primitive`. This means that the same type can have different layout
    /// depending on whether it appears as the metadata field of a wide pointer or as a stand-alone
    /// 返回与此 vtable 相关的类型大小。
    /// field of `DynMetadata`. To work around that issue, we use `transmute` instead of using a
    /// field projection.
    #[inline]
    fn vtable_ptr(self) -> *const VTable {
        // SAFETY: this layout assumption is hard-coded into the compiler.
        // If it's somehow not a size match, the transmute will error.
        unsafe { crate::mem::transmute::<Self, *const VTable>(self) }
    }

    /// Returns the size of the type associated with this vtable.
    #[inline]
    pub fn size_of(self) -> usize {
        // Note that "size stored in vtable" is *not* the same as "result of size_of_val_raw".
        // Consider a reference like `&(i32, dyn Send)`: the vtable will only store the size of the
        // `Send` part!
        // SAFETY: DynMetadata always contains a valid vtable pointer
        unsafe { crate::intrinsics::vtable_size(self.vtable_ptr() as *const ()) }
    }

    /// Returns the alignment of the type associated with this vtable.
    #[inline]
    pub fn align_of(self) -> usize {
        // SAFETY: DynMetadata always contains a valid vtable pointer
        unsafe { crate::intrinsics::vtable_align(self.vtable_ptr() as *const ()) }
    }

    /// Returns the size and alignment together as a `Layout`
    #[inline]
    pub fn layout(self) -> crate::alloc::Layout {
        // SAFETY: the compiler emitted this vtable for a concrete Rust type which
        // is known to have a valid layout. Same rationale as in `Layout::for_value`.
        unsafe { crate::alloc::Layout::from_size_align_unchecked(self.size_of(), self.align_of()) }
    }
}

unsafe impl<Dyn: PointeeSized> Send for DynMetadata<Dyn> {}
unsafe impl<Dyn: PointeeSized> Sync for DynMetadata<Dyn> {}

impl<Dyn: PointeeSized> fmt::Debug for DynMetadata<Dyn> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_tuple("DynMetadata").field(&self.vtable_ptr()).finish()
    }
}

// Manual impls needed to avoid `Dyn: $Trait` bounds.

impl<Dyn: PointeeSized> Unpin for DynMetadata<Dyn> {}

impl<Dyn: PointeeSized> Copy for DynMetadata<Dyn> {}

impl<Dyn: PointeeSized> Clone for DynMetadata<Dyn> {
    #[inline]
    fn clone(&self) -> Self {
        *self
    }
}

#[doc(hidden)]
unsafe impl<Dyn: PointeeSized> TrivialClone for DynMetadata<Dyn> {}

impl<Dyn: PointeeSized> Eq for DynMetadata<Dyn> {}

impl<Dyn: PointeeSized> PartialEq for DynMetadata<Dyn> {
    #[inline]
    fn eq(&self, other: &Self) -> bool {
        crate::ptr::eq::<VTable>(self.vtable_ptr(), other.vtable_ptr())
    }
}

impl<Dyn: PointeeSized> Ord for DynMetadata<Dyn> {
    #[inline]
    #[allow(ambiguous_wide_pointer_comparisons)]
    fn cmp(&self, other: &Self) -> crate::cmp::Ordering {
        <*const VTable>::cmp(&self.vtable_ptr(), &other.vtable_ptr())
    }
}

impl<Dyn: PointeeSized> PartialOrd for DynMetadata<Dyn> {
    #[inline]
    fn partial_cmp(&self, other: &Self) -> Option<crate::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

impl<Dyn: PointeeSized> Hash for DynMetadata<Dyn> {
    #[inline]
    fn hash<H: Hasher>(&self, hasher: &mut H) {
        crate::ptr::hash::<VTable, _>(self.vtable_ptr(), hasher)
    }
}
