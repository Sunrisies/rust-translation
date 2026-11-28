//! 一种具有堆分配内容的连续可增长数组类型。
//! `Vec<T>`.
//!
//! 向量具有 *O*(1) 索引访问能力，平均 *O*(1) 的末尾元素插入和删除操作。
//! *O*(1) 的末尾元素弹出操作。
//!
//! Vectors ensure they never allocate more than `isize::MAX` bytes.
//!
//! # 示例
//!
//! You can explicitly create a [`Vec`] with [`Vec::new`]:
//!
//! ```
//! let v: Vec<i32> = Vec::new();
//! ```
//!
//! ...or by using the [`vec!`] macro:
//!
//! ```
//! let v: Vec<i32> = vec![];
//!
//! let v = vec![1, 2, 3, 4, 5];
//!
//! let v = vec![0; 10]; // ten zeroes
//! ```
//!
//! You can [`push`] values onto the end of a vector (which will grow the vector
//! 弹出值的方式大致相同：
//!
//! ```
//! let mut v = vec![1, 2];
//!
//! v.push(3);
//! ```
//!
//! Popping values works in much the same way:
//!
//! ```
//! let mut v = vec![1, 2];
//!
//! let two = v.pop();
//! ```
//!
//! Vectors also support indexing (through the [`Index`] and [`IndexMut`] traits):
//!
//! ```
//! let mut v = vec![1, 2, 3];
//! let three = v[2];
//! v[1] = v[1] + 5;
//! ```
//!
//! # 内存布局
//!
//! A [`Vec`] conceptually consists of a raw pointer `ptr` to the start of the allocation, a
//! length `len`, a capacity `cap`, and an allocator `alloc`.
//! While the exact fields and their order are not specified, a [`Vec`] can be converted to and
//! from these parts using [`Vec::into_raw_parts_with_allocator`], [`Vec::from_raw_parts_in`],
//! [`Vec::into_raw_parts`], and [`Vec::from_raw_parts`], as well as their [`NonNull`]-based
//! versions.
//!
//! The parts of a [`Vec`] have the following invariants:
//!
//! * If [`size_of::<T>()`](size_of) and `cap` are non-zero, then:
//!   - `ptr` must point to the start of a memory block [*currently allocated*] via `alloc`.
//!   - [`Layout::array::<T>(cap)`] must [*fit*] the memory block of `ptr`. In particular,
//!     * `T` must have the same alignment as the [`Layout`] `ptr` was allocated with, and
//!     * `size_of::<T>() * cap` must be at least the size of the [`Layout`] `ptr` was
//!       allocated with, and at most the size of the allocation returned the allocator.
//!   - `size_of::<T>() * cap` must be at most [`isize::MAX`].
//!     See the safety documentation of [`pointer::offset`].
//! * If [`size_of::<T>()`](size_of) or `cap` is zero, then `ptr` must be any sufficiently aligned non-null pointer.
//!
//!   NOTE: `ptr` will not be passed to the allocator for deallocation by the destructor of [`Vec`]
//!   in this case. Thus, it is unwise to use a pointer acquired from the allocator for this, as
//!   overallocated memory may end up being leaked. Use [`ptr::dangling`] instead.
//! * The following must always be satisfied:
//!   - `len` needs to be less than or equal to `cap`.
//!   - At `ptr`, there are at least `len` valid values of type `T`, laid out contiguously
//!     (like an array). These values are considered owned by the [`Vec`].
//!
//! It is sound to create a [`Vec`] from parts that satisfy these invariants.
//!
//! Conversely, the memory backing `ptr` obtained from [`Vec::as_mut_ptr`] or
//! [`Vec::into_raw_parts_with_allocator`]-like methods may be deallocated
//! using the allocator, with layout [`Layout::array::<T>(cap)`], provided
//! that [`size_of::<T>()`](size_of) or `cap` is non-zero.
//! 为了自动处理零大小分配的情况
//! it is recommended to use [`Vec::from_raw_parts_in`], instead of manually
//! 内存。
//!
//! [*fit*]: crate::alloc::Allocator#memory-fitting
//! [*currently allocated*]: crate::alloc::Allocator#currently-allocated-memory
//! [`allocate`]: crate::alloc::Allocator::allocate
//! [`push`]: Vec::push
//! [`ptr::NonNull::dangling`]: NonNull::dangling
//! [`Layout`]: crate::alloc::Layout
//! [`Layout::array::<T>(cap)`]: crate::alloc::Layout::array

#![stable(feature = "rust1", since = "1.0.0")]

#[cfg(not(no_global_oom_handling))]
use core::clone::TrivialClone;
use core::cmp::Ordering;
use core::hash::{Hash, Hasher};
#[cfg(not(no_global_oom_handling))]
use core::iter;
use core::marker::{Destruct, Freeze, PhantomData};
use core::mem::{self, Assume, ManuallyDrop, MaybeUninit, SizedTypeProperties, TransmuteFrom};
use core::ops::{self, Index, IndexMut, Range, RangeBounds};
use core::ptr::{self, NonNull};
use core::slice::{self, SliceIndex};
use core::{cmp, fmt, hint, intrinsics, ub_checks};

#[stable(feature = "extract_if", since = "1.87.0")]
pub use self::extract_if::ExtractIf;
use crate::alloc::{Allocator, AllocatorNightly, Global};
use crate::borrow::{Cow, ToOwned};
use crate::boxed::Box;
use crate::collections::TryReserveError;
use crate::collections::retain::retain_raw;
use crate::raw_vec::RawVec;

mod extract_if;

#[cfg(not(no_global_oom_handling))]
#[stable(feature = "vec_splice", since = "1.21.0")]
pub use self::splice::Splice;

#[cfg(not(no_global_oom_handling))]
mod splice;

#[stable(feature = "drain", since = "1.6.0")]
pub use self::drain::Drain;

mod drain;

#[cfg(not(no_global_oom_handling))]
mod cow;

#[cfg(not(no_global_oom_handling))]
pub(crate) use self::in_place_collect::AsVecIntoIter;
#[stable(feature = "rust1", since = "1.0.0")]
pub use self::into_iter::IntoIter;

mod into_iter;

#[cfg(not(no_global_oom_handling))]
use self::is_zero::IsZero;

#[cfg(not(no_global_oom_handling))]
mod is_zero;

#[cfg(not(no_global_oom_handling))]
mod in_place_collect;

mod partial_eq;

#[unstable(feature = "vec_peek_mut", issue = "122742")]
pub use self::peek_mut::PeekMut;

mod peek_mut;

#[cfg(not(no_global_oom_handling))]
use self::spec_from_elem::SpecFromElem;

#[cfg(not(no_global_oom_handling))]
mod spec_from_elem;

#[cfg(not(no_global_oom_handling))]
use self::set_len_on_drop::SetLenOnDrop;

#[cfg(not(no_global_oom_handling))]
mod set_len_on_drop;

#[cfg(not(no_global_oom_handling))]
use self::in_place_drop::{InPlaceDrop, InPlaceDstDataSrcBufDrop};

#[cfg(not(no_global_oom_handling))]
mod in_place_drop;

#[cfg(not(no_global_oom_handling))]
use self::spec_from_iter_nested::SpecFromIterNested;

#[cfg(not(no_global_oom_handling))]
mod spec_from_iter_nested;

#[cfg(not(no_global_oom_handling))]
use self::spec_from_iter::SpecFromIter;

#[cfg(not(no_global_oom_handling))]
mod spec_from_iter;

#[cfg(not(no_global_oom_handling))]
use self::spec_extend::SpecExtend;

#[cfg(not(no_global_oom_handling))]
mod spec_extend;

#[cfg(not(no_global_oom_handling))]
use self::spec_extend_with::SpecExtendWith;

#[cfg(not(no_global_oom_handling))]
mod spec_extend_with;

#[cfg(all(target_arch = "aarch64", target_feature = "sve"))]
mod sve_retain;

/// A contiguous growable array type, written as `Vec<T>`, short for 'vector'.
///
/// # 示例
///
/// ```
/// let mut vec = Vec::new();
/// vec.push(1);
/// vec.push(2);
///
/// assert_eq!(vec.len(), 2);
/// assert_eq!(vec[0], 1);
///
/// assert_eq!(vec.pop(), Some(2));
/// assert_eq!(vec.len(), 1);
///
/// vec[0] = 7;
/// assert_eq!(vec[0], 7);
///
/// vec.extend([1, 2, 3]);
///
/// for x in &vec {
///     println!("{x}");
/// }
/// assert_eq!(vec, [7, 1, 2, 3]);
/// ```
///
/// The [`vec!`] macro is provided for convenient initialization:
///
/// ```
/// let mut vec1 = vec![1, 2, 3];
/// vec1.push(4);
/// let vec2 = Vec::from([1, 2, 3, 4]);
/// assert_eq!(vec1, vec2);
/// ```
///
/// It can also initialize each element of a `Vec<T>` with a given value.
/// 这可能比分别进行分配和初始化更高效
/// 尤其是在初始化零向量时：
///
/// ```
/// let vec = vec![0; 5];
/// assert_eq!(vec, [0, 0, 0, 0, 0]);
///
/// // The following is equivalent, but potentially slower:
/// let mut vec = Vec::with_capacity(5);
/// vec.resize(5, 0);
/// assert_eq!(vec, [0, 0, 0, 0, 0]);
/// ```
///
/// 有关更多信息，请参见
/// [Capacity and Reallocation](#capacity-and-reallocation).
///
/// Use a `Vec<T>` as an efficient stack:
///
/// ```
/// let mut stack = Vec::new();
///
/// stack.push(1);
/// stack.push(2);
/// stack.push(3);
///
/// while let Some(top) = stack.pop() {
///     // Prints 3, 2, 1
///     println!("{top}");
/// }
/// ```
///
/// # 索引
///
/// The `Vec` type allows access to values by index, because it implements the
/// [`Index`] trait. An example will be more explicit:
///
/// ```
/// let v = vec![0, 2, 4, 6];
/// println!("{}", v[1]); // it will display '2'
/// ```
///
/// However be careful: if you try to access an index which isn't in the `Vec`,
/// 您的软件将会 panic！您不能这样做：
///
/// ```should_panic
/// let v = vec![0, 2, 4, 6];
/// println!("{}", v[6]); // it will panic!
/// ```
///
/// Use [`get`] and [`get_mut`] if you want to check whether the index is in
/// the `Vec`.
///
/// # 切片
///
/// A `Vec` can be mutable. On the other hand, slices are read-only objects.
/// To get a [slice][prim@slice], use [`&`]. Example:
///
/// ```
/// fn read_slice(slice: &[usize]) {
///     // ...
/// }
///
/// let v = vec![0, 1];
/// read_slice(&v);
///
/// // ... and that's all!
/// // you can also do it like this:
/// let u: &[usize] = &v;
/// // or like this:
/// let u: &[_] = &v;
/// ```
///
/// 在 Rust 中，通常更常用的是将切片作为参数传递，而不是向量
/// when you just want to provide read access. The same goes for [`String`] and
/// [`&str`].
///
/// # 容量和重新分配
///
/// 向量的容量是指为未来添加的所有元素所分配的存储空间。这不应与
/// 向量的 *长度* 混淆，后者指定了实际元素的数量。
/// 如果向量的长度超过其容量，其容量将自动增加，但元素必须被
/// 重新分配。
/// 例如，一个容量为 10、长度为 0 的向量将是一个空向量
/// 有 10 个额外元素的空间。向向量中添加 10 个或更少的元素不会改变其容量或导致重新分配。然而，
///
/// For example, a vector with capacity 10 and length 0 would be an empty vector
/// 并指定向量预期达到的大小。
/// vector will not change its capacity or cause reallocation to occur. However,
/// if the vector's length is increased to 11, it will have to reallocate, which
/// can be slow. For this reason, it is recommended to use [`Vec::with_capacity`]
/// whenever possible to specify how big the vector is expected to get.
///
/// # 保证
///
/// 以下部分应作为
/// [memory layout](self#memory-layout) section.
///
/// Due to its incredibly fundamental nature, `Vec` makes a lot of guarantees
/// 这确保了在一般情况下其开销尽可能低，并且可以被 unsafe 代码以原始方式正确操作。
/// the general case, and can be correctly manipulated in primitive ways
/// 底部部分是堆上的分配区域，即连续的内存块。
///
/// A vector containing the elements `'a'` and `'b'` with capacity 4 can be
/// visualized as below. The top part is the `Vec` struct, it contains a
/// 底部部分是堆上的分配区域，即连续的内存块。
/// The bottom part is the allocation on the heap, a contiguous memory block.
///
/// ```text
///             ptr      len  capacity
///        +--------+--------+--------+
///        | 0x0123 |      2 |      4 |
///        +--------+--------+--------+
///             |
///             v
/// Heap   +--------+--------+--------+--------+
///        |    'a' |    'b' | uninit | uninit |
///        +--------+--------+--------+--------+
/// ```
///
/// - **uninit** represents memory that is not initialized, see [`MaybeUninit`].
/// - Note: the ABI is not stable and `Vec` makes no guarantees about its memory
/// 有两个原因：
///
/// `Vec` will never perform a "small optimization" where elements are actually
/// * 这会对一般情况造成惩罚，每次访问都会增加一个分支指令。
///
/// * It would make it more difficult for unsafe code to correctly manipulate
///   a `Vec`. The contents of a `Vec` wouldn't have a stable address if it were
///   only moved, and it would be more difficult to determine if a `Vec` had
///   actually allocated memory.
///
/// * It would penalize the general case, incurring an additional branch
///   on every access.
///
/// `Vec` will never automatically shrink itself, even if completely empty. This
/// ensures no unnecessary allocations or deallocations occur. Emptying a `Vec`
/// and then filling it back up to the same [`len`] should incur no calls to
/// the allocator. If you wish to free up unused memory, use
/// [`shrink_to_fit`] or [`shrink_to`].
///
/// [`push`] and [`insert`] will never (re)allocate if the reported capacity is
/// sufficient. [`push`] and [`insert`] *will* (re)allocate if
/// <code>[len] == [capacity]</code>. That is, the reported capacity is completely
/// accurate, and can be relied on. It can even be used to manually free the memory
/// allocated by a `Vec` if desired. Bulk insertion methods *may* reallocate, even
/// when not necessary.
///
/// `Vec` does not guarantee any particular growth strategy when reallocating
/// when full, nor when [`reserve`] is called. The current strategy is basic
/// and it may prove desirable to use a non-constant growth factor. Whatever
/// strategy is used will of course guarantee *O*(1) amortized [`push`].
///
/// 为了尊重程序员的意图，可以保证
/// all of `vec![e_1, e_2, ..., e_n]`, `vec![x; n]`, and [`Vec::with_capacity(n)`] produce a `Vec`
/// that requests an allocation of the exact size needed for precisely `n` elements from the allocator,
/// 而不是其他任何大小（例如，向上取整到最近的2的幂次）。
/// 分配器将返回至少与请求大小相当，但可能更大的分配量。
///
/// It is guaranteed that the [`Vec::capacity`] method returns a value that is at least the requested capacity
/// 且不超过已分配的容量。
///
/// The method [`Vec::shrink_to_fit`] will attempt to discard excess capacity an allocator has given to a `Vec`.
/// If <code>[len] == [capacity]</code>, then a `Vec<T>` can be converted
/// to and from a [`Box<[T]>`][owned slice] without reallocating or moving the elements.
/// `Vec` exploits this fact as much as reasonable when implementing common conversions
/// such as [`into_boxed_slice`].
///
/// `Vec` will not specifically overwrite any data that is removed from it,
/// 也不会专门保留它。其未初始化的内存是
/// 随意使用的草稿空间。通常它只会做
/// 最高效或最容易实现的操作。不要依赖
/// removed data to be erased for security purposes. Even if you drop a `Vec`, its
/// buffer may simply be reused by another allocation. Even if you zero a `Vec`'s memory
/// 实际上也可能不会发生，因为优化器不认为这是必须保留的副作用。有一个情况我们不会
/// this a side-effect that must be preserved. There is one case which we will
/// not break, however: using `unsafe` code to write to the excess capacity,
/// and then increasing the length to match, is always valid.
///
/// Currently, `Vec` does not guarantee the order in which elements are dropped.
/// The order has changed in the past and may change again.
///
/// [`get`]: slice::get
/// [`get_mut`]: slice::get_mut
/// [`String`]: crate::string::String
/// [`&str`]: type@str
/// [`shrink_to_fit`]: Vec::shrink_to_fit
/// [`shrink_to`]: Vec::shrink_to
/// [capacity]: Vec::capacity
/// [`capacity`]: Vec::capacity
/// [`Vec::capacity`]: Vec::capacity
/// [size_of::\<T>]: size_of
/// [len]: Vec::len
/// [`len`]: Vec::len
/// [`push`]: Vec::push
/// [`insert`]: Vec::insert
/// [`reserve`]: Vec::reserve
/// [`Vec::with_capacity(n)`]: Vec::with_capacity
/// [`MaybeUninit`]: core::mem::MaybeUninit
/// [owned slice]: Box
/// [`into_boxed_slice`]: Vec::into_boxed_slice
#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_diagnostic_item = "Vec"]
#[rustc_insignificant_dtor]
#[doc(alias = "list")]
#[doc(alias = "vector")]
pub struct Vec<T, #[stable(feature = "allocator_api", since = "1.100.0")] A: Allocator = Global> {
    buf: RawVec<T, A>,
    len: usize,
}

////////////////////////////////////////////////////////////////////////////////
// Inherent methods
////////////////////////////////////////////////////////////////////////////////

impl<T> Vec<T> {
    /// Constructs a new, empty `Vec<T>`.
    ///
    /// 向量在元素被推入后才会分配空间。
    ///
    /// # 示例
    ///
    /// ```
    /// # #![allow(unused_mut)]
    /// let mut vec: Vec<i32> = Vec::new();
    /// ```
    #[inline]
    #[rustc_const_stable(feature = "const_vec_new", since = "1.39.0")]
    #[rustc_diagnostic_item = "vec_new"]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[must_use]
    pub const fn new() -> Self {
        Vec { buf: RawVec::new(), len: 0 }
    }

    /// Constructs a new, empty `Vec<T>` with at least the specified capacity.
    ///
    /// The vector will be able to hold at least `capacity` elements without
    /// reallocating. This method is allowed to allocate for more elements than
    /// `capacity`. If `capacity` is zero, the vector [will not allocate].
    ///
    /// It is important to note that although the returned vector has the
    /// 当指定的 *capacity* 为最小值时，向量将具有零 *length*。对于
    /// 关于 *length* 和 *capacity* 差异的说明，请参见
    /// *[Capacity and reallocation]$。
    ///
    /// If it is important to know the exact allocated capacity of a `Vec`,
    /// always use the [`capacity`] method after construction.
    ///
    /// For `Vec<T>` where `T` is a zero-sized type, the vector
    /// [will not allocate], and the capacity will always be `usize::MAX`.
    ///
    /// [Capacity and reallocation]: #capacity-and-reallocation
    /// [`capacity`]: Vec::capacity
    /// [will not allocate]: self#memory-layout
    ///
    /// # Panics
    ///
    /// Panics if the new capacity exceeds `isize::MAX` _bytes_.
    ///
    /// # Examples
    ///
    /// ```
    /// let mut vec = Vec::with_capacity(10);
    ///
    /// // The vector contains no items, even though it has capacity for more
    /// assert_eq!(vec.len(), 0);
    /// assert!(vec.capacity() >= 10);
    ///
    /// // These are all done without reallocating...
    /// for i in 0..10 {
    ///     vec.push(i);
    /// }
    /// assert_eq!(vec.len(), 10);
    /// assert!(vec.capacity() >= 10);
    ///
    /// // ...but this may make the vector reallocate
    /// vec.push(11);
    /// assert_eq!(vec.len(), 11);
    /// assert!(vec.capacity() >= 11);
    ///
    /// // A vector of a zero-sized type will always over-allocate, since no
    /// // allocation is necessary
    /// let vec_units = Vec::<()>::with_capacity(10);
    /// assert_eq!(vec_units.capacity(), usize::MAX);
    /// ```
    #[cfg(not(no_global_oom_handling))]
    #[inline]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[must_use]
    #[rustc_diagnostic_item = "vec_with_capacity"]
    #[rustc_const_unstable(feature = "const_heap", issue = "79597")]
    pub const fn with_capacity(capacity: usize) -> Self {
        Self::with_capacity_in(capacity, Global)
    }

    /// Constructs a new, empty `Vec<T>` with at least the specified capacity.
    ///
    /// The vector will be able to hold at least `capacity` elements without
    /// reallocating. This method is allowed to allocate for more elements than
    /// `capacity`. If `capacity` is zero, the vector [will not allocate].
    ///
    /// # Errors
    ///
    /// Returns an error if the capacity exceeds `isize::MAX` _bytes_,
    /// 分配器报告分配失败，则返回错误。
    ///
    /// [will not allocate]: self#memory-layout
    #[inline]
    #[unstable(feature = "try_with_capacity", issue = "91913")]
    pub fn try_with_capacity(capacity: usize) -> Result<Self, TryReserveError> {
        Self::try_with_capacity_in(capacity, Global)
    }

    /// Creates a `Vec<T>` directly from a pointer, a length, and a capacity.
    ///
    /// # Safety
    ///
    /// 各个部分必须满足 [memory layout] 部分描述的不变量。
    /// with allocator [`Global`].
    ///
    /// 违反这些不变量可能导致分配器内部数据结构损坏等问题。例如，通常**不**安全的是
    /// internal data structures. For example it is normally **not** safe
    /// to build a `Vec<u8>` from a pointer to a C `char` array with length
    /// `size_t`, doing so is only safe if the array was initially allocated by
    /// a `Vec` or `String`.
    /// It's also not safe to build one from a `Vec<u16>` and its length, because
    /// the allocator cares about the alignment, and these two types have different
    /// alignments. The buffer was allocated with alignment 2 (for `u16`), but after
    /// turning it into a `Vec<u8>` it'll be deallocated with alignment 1. To avoid
    /// these issues, it is often preferable to do casting/transmuting using
    /// [`slice::from_raw_parts`] instead.
    ///
    /// The ownership of `ptr` is effectively transferred to the
    /// `Vec<T>` which may then deallocate, reallocate or change the
    /// contents of memory pointed to by the pointer at will. Ensure
    /// # Safety
    /// 各个部分必须满足 [memory layout] 部分描述的不变量。
    ///
    /// [`String`]: crate::string::String
    /// [memory layout]: self#memory-layout
    ///
    /// # Examples
    ///
    /// ```
    /// use std::ptr;
    ///
    /// let v = vec![1, 2, 3];
    ///
    /// // Deconstruct the vector into parts.
    /// let (p, len, cap) = v.into_raw_parts();
    ///
    /// unsafe {
    ///     // Overwrite memory with 4, 5, 6
    ///     for i in 0..len {
    ///         ptr::write(p.add(i), 4 + i);
    ///     }
    ///
    ///     // Put everything back together into a Vec
    ///     let rebuilt = Vec::from_raw_parts(p, len, cap);
    ///     assert_eq!(rebuilt, [4, 5, 6]);
    /// }
    /// ```
    ///
    /// 违反这些不变量可能导致分配器内部数据结构损坏等问题。
    ///
    /// ```rust
    /// use std::alloc::{alloc, Layout};
    ///
    /// fn main() {
    ///     let layout = Layout::array::<u32>(16).expect("16 u32s take 64 bytes, so it shouldn't overflow");
    ///
    ///     let vec = unsafe {
    ///         let mem = alloc(layout).cast::<u32>();
    ///         if mem.is_null() {
    ///             return;
    ///         }
    ///
    ///         mem.write(1_000_000);
    ///
    ///         Vec::from_raw_parts(mem, 1, 16)
    ///     };
    ///
    ///     assert_eq!(vec, &[1_000_000]);
    ///     assert_eq!(vec.capacity(), 16);
    /// }
    /// ```
    #[inline]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_unstable(feature = "const_heap", issue = "79597")]
    pub const unsafe fn from_raw_parts(ptr: *mut T, length: usize, capacity: usize) -> Self {
        // SAFETY: Upheld by caller.
        unsafe { Self::from_raw_parts_in(ptr, length, capacity, Global) }
    }

    #[doc(alias = "from_non_null_parts")]
    /// Creates a `Vec<T>` directly from a `NonNull` pointer, a length, and a capacity.
    ///
    /// # Safety
    ///
    /// The parts must satisfy the invariants described in the [memory layout] section,
    /// with allocator [`Global`].
    ///
    /// Violating them may cause problems like corrupting the allocator's
    /// 内部数据结构。例如，通常**不**安全
    /// to build a `Vec<u8>` from a pointer to a C `char` array with length
    /// `size_t`, doing so is only safe if the array was initially allocated by
    /// a `Vec` or `String`.
    /// It's also not safe to build one from a `Vec<u16>` and its length, because
    /// 分配器关注对齐问题，这两种类型具有不同
    /// alignments. The buffer was allocated with alignment 2 (for `u16`), but after
    /// turning it into a `Vec<u8>` it'll be deallocated with alignment 1. To avoid
    /// 这些问题，通常更优的做法是使用
    /// [`NonNull::slice_from_raw_parts`] instead.
    ///
    /// The ownership of `ptr` is effectively transferred to the
    /// `Vec<T>` which may then deallocate, reallocate or change the
    /// 指针指向的内存内容。确保
    /// 在调用此
    /// 函数后，没有其他代码使用该指针。
    ///
    /// [`String`]: crate::string::String
    /// [memory layout]: self#memory-layout
    ///
    /// # 示例
    ///
    /// ```
    /// let v = vec![1, 2, 3];
    ///
    /// // Deconstruct the vector into parts.
    /// let (p, len, cap) = v.into_parts();
    ///
    /// unsafe {
    ///     // Overwrite memory with 4, 5, 6
    ///     for i in 0..len {
    ///         p.add(i).write(4 + i);
    ///     }
    ///
    ///     // Put everything back together into a Vec
    ///     let rebuilt = Vec::from_parts(p, len, cap);
    ///     assert_eq!(rebuilt, [4, 5, 6]);
    /// }
    /// ```
    ///
    /// 使用其他地方分配的内存：
    ///
    /// ```rust
    /// use std::alloc::{alloc, Layout};
    /// use std::ptr::NonNull;
    ///
    /// fn main() {
    ///     let layout = Layout::array::<u32>(16).expect("16 u32s take 64 bytes, so it shouldn't overflow");
    ///
    ///     let vec = unsafe {
    ///         let Some(mem) = NonNull::new(alloc(layout).cast::<u32>()) else {
    ///             return;
    ///         };
    ///
    ///         mem.write(1_000_000);
    ///
    ///         Vec::from_parts(mem, 1, 16)
    ///     };
    ///
    ///     assert_eq!(vec, &[1_000_000]);
    ///     assert_eq!(vec.capacity(), 16);
    /// }
    /// ```
    #[inline]
    #[stable(feature = "box_vec_non_null", since = "1.99.0")]
    #[rustc_const_unstable(feature = "const_heap", issue = "79597")]
    pub const unsafe fn from_parts(ptr: NonNull<T>, length: usize, capacity: usize) -> Self {
        // SAFETY: Upheld by caller.
        unsafe { Self::from_parts_in(ptr, length, capacity, Global) }
    }

    /// Creates a `Vec<T>` where each element is produced by calling `f` with
    /// that element's index while walking forward through the `Vec<T>`.
    ///
    /// 类似，只是针对 <
    ///
    /// ```text
    /// vec![f(0), f(1), f(2), …, f(length - 2), f(length - 1)]
    /// ```
    /// and is similar to `(0..i).map(f)`, just for `Vec<T>`s not iterators.
    ///
    /// If `length == 0`, this produces an empty `Vec<T>` without ever calling `f`.
    ///
    /// # <
    ///
    /// ```rust
    /// let vec = Vec::from_fn(5, |i| i);
    ///
    /// // indexes are:  0  1  2  3  4
    /// assert_eq!(vec, [0, 1, 2, 3, 4]);
    ///
    /// let vec2 = Vec::from_fn(8, |i| i * 2);
    ///
    /// // indexes are:   0  1  2  3  4  5   6   7
    /// assert_eq!(vec2, [0, 2, 4, 6, 8, 10, 12, 14]);
    ///
    /// let bool_vec = Vec::from_fn(5, |i| i % 2 == 0);
    ///
    /// // indexes are:       0     1      2     3      4
    /// assert_eq!(bool_vec, [true, false, true, false, true]);
    /// ```
    ///
    /// The `Vec<T>` is generated in ascending index order, starting from the front
    /// 将 <
    /// ```
    /// let mut state = 1;
    /// let a = Vec::from_fn(6, |_| { let x = state; state *= 2; x });
    ///
    /// assert_eq!(a, [1, 2, 4, 8, 16, 32]);
    /// ```
    #[cfg(not(no_global_oom_handling))]
    #[inline]
    #[stable(feature = "vec_from_fn", since = "1.100.0")]
    pub fn from_fn<F>(length: usize, f: F) -> Self
    where
        F: FnMut(usize) -> T,
    {
        (0..length).map(f).collect()
    }

    /// Decomposes a `Vec<T>` into its raw components: `(pointer, length, capacity)`.
    ///
    /// 调用此函数后，调用者需负责 <
    /// 使用 [<
    /// 如果 <
    /// order as the arguments to [`from_raw_parts`].
    ///
    /// # 示例
    /// memory previously managed by the `Vec`. Most often, one does
    /// 返回指向底层数据的 <
    /// into a `Vec` with the [`from_raw_parts`] function; more generally,
    /// if `T` is non-zero-sized and the capacity is nonzero, one may use
    /// any method that calls [`dealloc`] with a layout of
    /// `Layout::array::<T>(capacity)`; if `T` is zero-sized or the
    /// capacity is zero, nothing needs to be done.
    ///
    /// [`from_raw_parts`]: Vec::from_raw_parts
    /// [`dealloc`]: crate::alloc::GlobalAlloc::dealloc
    ///
    /// # Examples
    ///
    /// ```
    /// let v: Vec<i32> = vec![-1, 0, 1];
    ///
    /// let (ptr, len, cap) = v.into_raw_parts();
    ///
    /// let rebuilt = unsafe {
    ///     // We can now make changes to the components, such as
    ///     // transmuting the raw pointer to a compatible type.
    ///     let ptr = ptr as *mut u32;
    ///
    ///     Vec::from_raw_parts(ptr, len, cap)
    /// };
    /// assert_eq!(rebuilt, [4294967295, 0, 1]);
    /// ```
    #[must_use = "losing the pointer will leak memory"]
    #[stable(feature = "vec_into_raw_parts", since = "1.93.0")]
    #[rustc_const_unstable(feature = "const_heap", issue = "79597")]
    pub const fn into_raw_parts(self) -> (*mut T, usize, usize) {
        let mut me = ManuallyDrop::new(self);
        (me.as_mut_ptr(), me.len(), me.capacity())
    }

    #[doc(alias = "into_non_null_parts")]
    /// Decomposes a `Vec<T>` into its raw components: `(NonNull pointer, length, capacity)`.
    ///
    /// Returns the `NonNull` pointer to the underlying data, the length of
    /// 向量中的元素数量，以及分配的容量
    /// data (in elements). These are the same arguments in the same
    /// order as the arguments to [`from_parts`].
    ///
    /// 调用此函数后，调用者需负责
    /// memory previously managed by the `Vec`. The only way to do
    /// this is to convert the `NonNull` pointer, length, and capacity back
    /// into a `Vec` with the [`from_parts`] function, allowing
    /// the destructor to perform the cleanup.
    ///
    /// [`from_parts`]: Vec::from_parts
    ///
    /// # Examples
    ///
    /// ```
    /// let v: Vec<i32> = vec![-1, 0, 1];
    ///
    /// let (ptr, len, cap) = v.into_parts();
    ///
    /// let rebuilt = unsafe {
    ///     // We can now make changes to the components, such as
    ///     // transmuting the raw pointer to a compatible type.
    ///     let ptr = ptr.cast::<u32>();
    ///
    ///     Vec::from_parts(ptr, len, cap)
    /// };
    /// assert_eq!(rebuilt, [4294967295, 0, 1]);
    /// ```
    #[must_use = "losing the pointer will leak memory"]
    #[stable(feature = "box_vec_non_null", since = "1.99.0")]
    #[rustc_const_unstable(feature = "const_heap", issue = "79597")]
    pub const fn into_parts(self) -> (NonNull<T>, usize, usize) {
        let (ptr, len, capacity) = self.into_raw_parts();
        // SAFETY: A `Vec` always has a non-null pointer.
        (unsafe { NonNull::new_unchecked(ptr) }, len, capacity)
    }

    /// Interns the `Vec<T>`, making the underlying memory read-only. This method should be
    /// 使用提供的分配器
    ///
    /// This method must be called if the memory used by `Vec` needs to appear in the final
    /// 需要注意的是，虽然返回的向量具有指定的最小*容量*，但其*长度*为零。关于长度与容量之间的区别，请参阅*[容量和重新分配]*部分
    #[unstable(feature = "const_heap", issue = "79597")]
    #[rustc_const_unstable(feature = "const_heap", issue = "79597")]
    pub const fn const_make_global(mut self) -> &'static [T]
    where
        T: Freeze,
    {
        // `const_make_global` requires the pointer to point to the beginning of a heap allocation,
        // which is not the case when `self.capacity()` is 0, or if `T::IS_ZST`,
        // which is why we instead return a new slice in this case.
        if self.capacity() == 0 || T::IS_ZST {
            let me = ManuallyDrop::new(self);
            // ignore-tidy-undocumented-unsafe
            unsafe { slice::from_raw_parts(NonNull::<T>::dangling().as_ptr(), me.len) }
        } else {
            // ignore-tidy-undocumented-unsafe
            unsafe { core::intrinsics::const_make_global(self.as_mut_ptr().cast()) };
            let me = ManuallyDrop::new(self);
            // ignore-tidy-undocumented-unsafe
            unsafe { slice::from_raw_parts(me.as_ptr(), me.len) }
        }
    }
}

#[cfg(not(no_global_oom_handling))]
#[rustc_const_unstable(feature = "const_heap", issue = "79597")]
#[rustfmt::skip] // FIXME(fee1-dead): temporary measure before rustfmt is bumped
const impl<T, A: [const] Allocator + [const] Destruct> Vec<T, A> {
    /// Constructs a new, empty `Vec<T, A>` with at least the specified capacity
    /// with the provided allocator.
    ///
    /// The vector will be able to hold at least `capacity` elements without
    /// reallocating. This method is allowed to allocate for more elements than
    /// `capacity`. If `capacity` is zero, the vector [will not allocate].
    ///
    /// 需要注意的是，虽然返回的向量具有指定的最小*容量*，但其*长度*为零。关于长度与容量之间的区别，请参阅*[容量和重新分配]*部分
    /// minimum *capacity* specified, the vector will have a zero *length*. For
    /// an explanation of the difference between length and capacity, see
    /// # 恐慌
    ///
    /// If it is important to know the exact allocated capacity of a `Vec`,
    /// always use the [`capacity`] method after construction.
    ///
    /// For `Vec<T, A>` where `T` is a zero-sized type, the vector
    /// [will not allocate], and the capacity will always be `usize::MAX`.
    ///
    /// [Capacity and reallocation]: #capacity-and-reallocation
    /// [`capacity`]: Vec::capacity
    /// [will not allocate]: self#memory-layout
    ///
    /// # Panics
    ///
    /// Panics if the new capacity exceeds `isize::MAX` _bytes_.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::alloc::System;
    ///
    /// let mut vec = Vec::with_capacity_in(10, System);
    ///
    /// // The vector contains no items, even though it has capacity for more
    /// assert_eq!(vec.len(), 0);
    /// assert!(vec.capacity() >= 10);
    ///
    /// // These are all done without reallocating...
    /// for i in 0..10 {
    ///     vec.push(i);
    /// }
    /// assert_eq!(vec.len(), 10);
    /// assert!(vec.capacity() >= 10);
    ///
    /// // ...but this may make the vector reallocate
    /// vec.push(11);
    /// assert_eq!(vec.len(), 11);
    /// assert!(vec.capacity() >= 11);
    ///
    /// // A vector of a zero-sized type will always over-allocate, since no
    /// // allocation is necessary
    /// let vec_units = Vec::<(), System>::with_capacity_in(10, System);
    /// assert_eq!(vec_units.capacity(), usize::MAX);
    /// ```
    #[inline]
    #[stable(feature = "allocator_api", since = "1.100.0")]
    pub fn with_capacity_in(capacity: usize, alloc: A) -> Self {
        Vec { buf: RawVec::with_capacity_in(capacity, alloc), len: 0 }
    }

    /// 将元素添加到集合的末尾
    ///
    /// # 恐慌
    ///
    /// Panics if the new capacity exceeds `isize::MAX` _bytes_.
    ///
    /// # 示例
    ///
    /// ```
    /// let mut vec = vec![1, 2];
    /// vec.push(3);
    /// assert_eq!(vec, [1, 2, 3]);
    /// ```
    ///
    /// # 时间复杂度
    ///
    /// 平均需要*O*(1)时间。如果向量长度在推送后超过其
    /// 容量，则需要*O*(*capacity*)时间将向量元素复制到更大的分配空间中。这种昂贵的操作被
    /// *O*(1)插入操作所抵消
    /// 所允许的*容量*所减少
    #[inline]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_confusables("push_back", "put", "append")]
    pub fn push(&mut self, value: T) {
        let _ = self.push_mut(value);
    }

    /// 将元素添加到集合的末尾，并返回对其的引用
    ///
    /// # 恐慌
    ///
    /// Panics if the new capacity exceeds `isize::MAX` _bytes_.
    ///
    /// # 示例
    ///
    /// ```
    /// let mut vec = vec![1, 2];
    /// let last = vec.push_mut(3);
    /// assert_eq!(*last, 3);
    /// assert_eq!(vec, [1, 2, 3]);
    ///
    /// let last = vec.push_mut(3);
    /// *last += 1;
    /// assert_eq!(vec, [1, 2, 3, 4]);
    /// ```
    ///
    /// # 时间复杂度
    ///
    /// 平均需要*O*(1)时间。如果向量长度在推送后超过其
    /// 容量，则需要*O*(*capacity*)时间将向量元素复制到更大的分配空间中。这种昂贵的操作被
    /// 将向量元素分配到更大的内存中。这一昂贵的操作通过
    /// 以 *capacity* 为偏移量进行 *O*(1) 插入来实现。
    #[inline]
    #[stable(feature = "push_mut", since = "1.95.0")]
    #[must_use = "if you don't need a reference to the value, use `Vec::push` instead"]
    pub fn push_mut(&mut self, value: T) -> &mut T {
        // Inform codegen that the length does not change across grow_one().
        let len = self.len;
        // This will panic or abort if we would allocate > isize::MAX bytes
        // or if the length increment would overflow for zero-sized types.
        if len == self.buf.capacity() {
            self.buf.grow_one();
        }
        // ignore-tidy-undocumented-unsafe
        unsafe {
            let end = self.as_mut_ptr().add(len);
            ptr::write(end, value);
            self.len = len + 1;
            // SAFETY: We just wrote a value to the pointer that will live the lifetime of the reference.
            &mut *end
        }
    }
}

impl<T, A: Allocator> Vec<T, A> {
    /// Constructs a new, empty `Vec<T, A>`.
    ///
    /// 向量在元素被推入之前不会进行分配。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::alloc::System;
    ///
    /// let vec: Vec<i32, System> = Vec::new_in(System);
    /// ```
    #[inline]
    #[stable(feature = "allocator_api", since = "1.100.0")]
    #[rustc_const_unstable(feature = "allocator_ext", issue = "163177")]
    pub const fn new_in(alloc: A) -> Self {
        Vec { buf: RawVec::new_in(alloc), len: 0 }
    }

    /// Constructs a new, empty `Vec<T, A>` with at least the specified capacity
    /// 并使用提供的分配器。
    ///
    /// The vector will be able to hold at least `capacity` elements without
    /// 重新分配内存。该方法允许为超过
    /// `capacity`. If `capacity` is zero, the vector [will not allocate].
    ///
    /// # 错误
    ///
    /// Returns an error if the capacity exceeds `isize::MAX` _bytes_,
    /// 或者分配器报告分配失败，则返回错误。
    ///
    /// [will not allocate]: self#memory-layout
    #[inline]
    #[unstable(feature = "allocator_ext", issue = "163177", implied_by = "allocator_api")]
    // #[unstable(feature = "try_with_capacity", issue = "91913")]
    pub fn try_with_capacity_in(capacity: usize, alloc: A) -> Result<Self, TryReserveError> {
        Ok(Vec { buf: RawVec::try_with_capacity_in(capacity, alloc)?, len: 0 })
    }

    /// Creates a `Vec<T, A>` directly from a pointer, a length, a capacity,
    /// # 安全性
    ///
    /// # 各部分必须满足 [内存布局] 部分描述的不变量。
    ///
    /// 违反这些不变量可能导致诸如破坏分配器的
    ///
    /// Violating them may cause problems like corrupting the allocator's
    /// internal data structures. For example it is **not** safe
    /// to build a `Vec<u8>` from a pointer to a C `char` array with length `size_t`.
    /// It's also not safe to build one from a `Vec<u16>` and its length, because
    /// the allocator cares about the alignment, and these two types have different
    /// alignments. The buffer was allocated with alignment 2 (for `u16`), but after
    /// turning it into a `Vec<u8>` it'll be deallocated with alignment 1.
    ///
    /// The ownership of `ptr` is effectively transferred to the
    /// `Vec<T>` which may then deallocate, reallocate or change the
    /// 使用其他地方分配的内存：
    /// that nothing else uses the pointer after calling this
    /// # 安全性
    ///
    /// [`String`]: crate::string::String
    /// [`allocate`]: crate::alloc::Allocator::allocate
    /// [memory layout]: self#memory-layout
    ///
    /// # 各部分必须满足 [内存布局] 部分描述的不变量。
    ///
    /// ```
    /// use std::alloc::System;
    ///
    /// use std::ptr;
    ///
    /// let mut v = Vec::with_capacity_in(3, System);
    /// v.push(1);
    /// v.push(2);
    /// v.push(3);
    ///
    /// // Deconstruct the vector into parts.
    /// let (p, len, cap, alloc) = v.into_raw_parts_with_allocator();
    ///
    /// unsafe {
    ///     // Overwrite memory with 4, 5, 6
    ///     for i in 0..len {
    ///         ptr::write(p.add(i), 4 + i);
    ///     }
    ///
    ///     // Put everything back together into a Vec
    ///     let rebuilt = Vec::from_raw_parts_in(p, len, cap, alloc.clone());
    ///     assert_eq!(rebuilt, [4, 5, 6]);
    /// }
    /// ```
    ///
    /// 违反这些不变量可能导致破坏分配器的
    ///
    /// ```rust
    /// use std::alloc::{AllocError, Allocator, Global, Layout};
    ///
    /// fn main() {
    ///     let layout = Layout::array::<u32>(16).expect("16 u32s take 64 bytes, so it shouldn't overflow");
    ///
    ///     let vec = unsafe {
    ///         let mem = match Global.allocate(layout) {
    ///             Ok(mem) => mem.cast::<u32>().as_ptr(),
    ///             Err(AllocError) => return,
    ///         };
    ///
    ///         mem.write(1_000_000);
    ///
    ///         Vec::from_raw_parts_in(mem, 1, 16, Global)
    ///     };
    ///
    ///     assert_eq!(vec, &[1_000_000]);
    ///     assert_eq!(vec.capacity(), 16);
    /// }
    /// ```
    #[inline]
    #[stable(feature = "allocator_api", since = "1.100.0")]
    #[rustc_const_unstable(feature = "const_heap", issue = "79597")]
    pub const unsafe fn from_raw_parts_in(
        ptr: *mut T,
        length: usize,
        capacity: usize,
        alloc: A,
    ) -> Self {
        ub_checks::assert_unsafe_precondition!(
            check_library_ub,
            "Vec::from_raw_parts_in requires that length <= capacity",
            (length: usize = length, capacity: usize = capacity) => length <= capacity
        );
        // SAFETY: Upheld by caller.
        unsafe { Vec { buf: RawVec::from_raw_parts_in(ptr, capacity, alloc), len: length } }
    }

    #[doc(alias = "from_non_null_parts_in")]
    /// Creates a `Vec<T, A>` directly from a `NonNull` pointer, a length, a capacity,
    /// and an allocator.
    ///
    /// # 分配器关注对齐问题，而这两种类型具有不同的
    ///
    /// The parts must satisfy the invariants described in the [memory layout] section.
    ///
    /// 违反这些不变量可能导致破坏分配器的
    /// internal data structures. For example it is **not** safe
    /// to build a `Vec<u8>` from a pointer to a C `char` array with length `size_t`.
    /// It's also not safe to build one from a `Vec<u16>` and its length, because
    /// the allocator cares about the alignment, and these two types have different
    /// alignments. The buffer was allocated with alignment 2 (for `u16`), but after
    /// turning it into a `Vec<u8>` it'll be deallocated with alignment 1.
    ///
    /// The ownership of `ptr` is effectively transferred to the
    /// `Vec<T>` which may then deallocate, reallocate or change the
    /// 指针所指向的内存内容。确保
    /// 调用此函数后，没有其他代码使用该指针。
    /// 
    ///
    /// [`String`]: crate::string::String
    /// [`dealloc`]: crate::alloc::GlobalAlloc::dealloc
    /// [memory layout]: self#memory-layout
    ///
    /// # 示例
    ///
    /// ```
    /// use std::alloc::System;
    ///
    /// let mut v = Vec::with_capacity_in(3, System);
    /// v.push(1);
    /// v.push(2);
    /// v.push(3);
    ///
    /// // Deconstruct the vector into parts.
    /// let (p, len, cap, alloc) = v.into_parts_with_allocator();
    ///
    /// unsafe {
    ///     // Overwrite memory with 4, 5, 6
    ///     for i in 0..len {
    ///         p.add(i).write(4 + i);
    ///     }
    ///
    ///     // Put everything back together into a Vec
    ///     let rebuilt = Vec::from_parts_in(p, len, cap, alloc.clone());
    ///     assert_eq!(rebuilt, [4, 5, 6]);
    /// }
    /// ```
    ///
    /// 使用其他地方分配的内存：
    ///
    /// ```rust
    /// use std::alloc::{AllocError, Allocator, Global, Layout};
    ///
    /// fn main() {
    ///     let layout = Layout::array::<u32>(16).expect("16 u32s take 64 bytes, so it shouldn't overflow");
    ///
    ///     let vec = unsafe {
    ///         let mem = match Global.allocate(layout) {
    ///             Ok(mem) => mem.cast::<u32>(),
    ///             Err(AllocError) => return,
    ///         };
    ///
    ///         mem.write(1_000_000);
    ///
    ///         Vec::from_parts_in(mem, 1, 16, Global)
    ///     };
    ///
    ///     assert_eq!(vec, &[1_000_000]);
    ///     assert_eq!(vec.capacity(), 16);
    /// }
    /// ```
    #[inline]
    #[stable(feature = "allocator_api", since = "1.100.0")]
    #[rustc_const_unstable(feature = "const_heap", issue = "79597")]
    pub const unsafe fn from_parts_in(
        ptr: NonNull<T>,
        length: usize,
        capacity: usize,
        alloc: A,
    ) -> Self {
        ub_checks::assert_unsafe_precondition!(
            check_library_ub,
            "Vec::from_parts_in requires that length <= capacity",
            (length: usize = length, capacity: usize = capacity) => length <= capacity
        );
        // SAFETY: Upheld by caller.
        unsafe { Vec { buf: RawVec::from_nonnull_in(ptr, capacity, alloc), len: length } }
    }

    /// Decomposes a `Vec<T>` into its raw components: `(pointer, length, capacity, allocator)`.
    ///
    /// 返回指向底层数据的原始指针、向量的长度（以元素计）、
    /// 数据的分配容量（以元素计）以及分配器。这些与
    /// arguments in the same order as the arguments to [`from_raw_parts_in`].
    ///
    /// 调用此函数后，调用者需负责
    /// memory previously managed by the `Vec`. The only way to do
    /// this is to convert the raw pointer, length, and capacity back
    /// into a `Vec` with the [`from_raw_parts_in`] function, allowing
    /// # 示例
    ///
    /// [`from_raw_parts_in`]: Vec::from_raw_parts_in
    ///
    /// # Examples
    ///
    /// ```
    /// use std::alloc::System;
    ///
    /// let mut v: Vec<i32, System> = Vec::new_in(System);
    /// v.push(-1);
    /// v.push(0);
    /// v.push(1);
    ///
    /// let (ptr, len, cap, alloc) = v.into_raw_parts_with_allocator();
    ///
    /// let rebuilt = unsafe {
    ///     // We can now make changes to the components, such as
    ///     // transmuting the raw pointer to a compatible type.
    ///     let ptr = ptr as *mut u32;
    ///
    ///     Vec::from_raw_parts_in(ptr, len, cap, alloc)
    /// };
    /// assert_eq!(rebuilt, [4294967295, 0, 1]);
    /// ```
    #[must_use = "losing the pointer will leak memory"]
    #[stable(feature = "allocator_api", since = "1.100.0")]
    #[rustc_const_unstable(feature = "const_heap", issue = "79597")]
    pub const fn into_raw_parts_with_allocator(self) -> (*mut T, usize, usize, A) {
        let mut me = ManuallyDrop::new(self);
        let len = me.len();
        let capacity = me.capacity();
        let ptr = me.as_mut_ptr();
        // ignore-tidy-undocumented-unsafe
        let alloc = unsafe { ptr::read(me.allocator()) };
        (ptr, len, capacity, alloc)
    }

    #[doc(alias = "into_non_null_parts_with_alloc")]
    /// Decomposes a `Vec<T>` into its raw components: `(NonNull pointer, length, capacity, allocator)`.
    ///
    /// Returns the `NonNull` pointer to the underlying data, the length of the vector (in elements),
    /// 数据的分配容量（以元素计）以及分配器。这些与
    /// arguments in the same order as the arguments to [`from_parts_in`].
    ///
    /// 调用此函数后，调用者需负责
    /// memory previously managed by the `Vec`. The only way to do
    /// this is to convert the `NonNull` pointer, length, and capacity back
    /// into a `Vec` with the [`from_parts_in`] function, allowing
    /// # 示例
    ///
    /// [`from_parts_in`]: Vec::from_parts_in
    ///
    /// # 返回向量在不重新分配的情况下可以容纳的元素总数。
    ///
    /// ```
    /// use std::alloc::System;
    ///
    /// let mut v: Vec<i32, System> = Vec::new_in(System);
    /// v.push(-1);
    /// v.push(0);
    /// v.push(1);
    ///
    /// let (ptr, len, cap, alloc) = v.into_parts_with_allocator();
    ///
    /// let rebuilt = unsafe {
    ///     // We can now make changes to the components, such as
    ///     // transmuting the raw pointer to a compatible type.
    ///     let ptr = ptr.cast::<u32>();
    ///
    ///     Vec::from_parts_in(ptr, len, cap, alloc)
    /// };
    /// assert_eq!(rebuilt, [4294967295, 0, 1]);
    /// ```
    #[must_use = "losing the pointer will leak memory"]
    #[stable(feature = "allocator_api", since = "1.100.0")]
    #[rustc_const_unstable(feature = "const_heap", issue = "79597")]
    pub const fn into_parts_with_allocator(self) -> (NonNull<T>, usize, usize, A) {
        let (ptr, len, capacity, alloc) = self.into_raw_parts_with_allocator();
        // SAFETY: A `Vec` always has a non-null pointer.
        (unsafe { NonNull::new_unchecked(ptr) }, len, capacity, alloc)
    }

    /// # 示例
    /// 具有零大小元素的向量总是具有 usize::MAX 的容量：
    ///
    /// # 示例
    ///
    /// ```
    /// let mut vec: Vec<i32> = Vec::with_capacity(10);
    /// vec.push(42);
    /// assert!(vec.capacity() >= 10);
    /// ```
    ///
    /// 具有零大小元素的向量总是具有 usize::MAX 的容量：
    ///
    /// ```
    /// #[derive(Clone)]
    /// struct ZeroSized;
    ///
    /// fn main() {
    ///     assert_eq!(std::mem::size_of::<ZeroSized>(), 0);
    ///     let v = vec![ZeroSized; 0];
    ///     assert_eq!(v.capacity(), usize::MAX);
    /// }
    /// ```
    #[inline]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_vec_string_slice", since = "1.87.0")]
    pub const fn capacity(&self) -> usize {
        self.buf.capacity()
    }

    /// Reserves capacity for at least `additional` more elements to be inserted
    /// in the given `Vec<T>`. The collection may reserve more space to
    /// speculatively avoid frequent reallocations. After calling `reserve`,
    /// capacity will be greater than or equal to `self.len() + additional`.
    /// # 恐慌
    ///
    /// # Panics
    ///
    /// Panics if the new capacity exceeds `isize::MAX` _bytes_.
    ///
    /// # 示例
    ///
    /// ```
    /// let mut vec = vec![1];
    /// vec.reserve(10);
    /// assert!(vec.capacity() >= 11);
    /// ```
    #[cfg(not(no_global_oom_handling))]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_diagnostic_item = "vec_reserve"]
    pub fn reserve(&mut self, additional: usize) {
        self.buf.reserve(self.len, additional);
    }

    /// Reserves the minimum capacity for at least `additional` more elements to
    /// be inserted in the given `Vec<T>`. Unlike [`reserve`], this will not
    /// deliberately over-allocate to speculatively avoid frequent allocations.
    /// After calling `reserve_exact`, capacity will be greater than or equal to
    /// `self.len() + additional`. Does nothing if the capacity is already
    /// 请注意，分配器可能会给集合提供比其
    ///
    /// 请求更多的空间。因此，不能依赖容量能够精确达到
    /// requests. Therefore, capacity can not be relied upon to be precisely
    /// minimal. Prefer [`reserve`] if future insertions are expected.
    ///
    /// [`reserve`]: Vec::reserve
    ///
    /// # 恐慌
    ///
    /// Panics if the new capacity exceeds `isize::MAX` _bytes_.
    ///
    /// # 示例
    ///
    /// ```
    /// let mut vec = vec![1];
    /// vec.reserve_exact(10);
    /// assert!(vec.capacity() >= 11);
    /// ```
    #[cfg(not(no_global_oom_handling))]
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn reserve_exact(&mut self, additional: usize) {
        self.buf.reserve_exact(self.len, additional);
    }

    /// Tries to reserve capacity for at least `additional` more elements to be inserted
    /// in the given `Vec<T>`. The collection may reserve more space to speculatively avoid
    /// frequent reallocations. After calling `try_reserve`, capacity will be
    /// greater than or equal to `self.len() + additional` if it returns
    /// `Ok(())`. Does nothing if capacity is already sufficient. This method
    /// # 错误
    ///
    /// # 错误
    ///
    /// 如果容量溢出或分配器报告失败，则返回错误。
    /// # 错误
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::TryReserveError;
    ///
    /// fn process_data(data: &[u32]) -> Result<Vec<u32>, TryReserveError> {
    ///     let mut output = Vec::new();
    ///
    ///     // Pre-reserve the memory, exiting if we can't
    ///     output.try_reserve(data.len())?;
    ///
    ///     // Now we know this can't OOM in the middle of our complex work
    ///     output.extend(data.iter().map(|&val| {
    ///         val * 2 + 5 // very complicated
    ///     }));
    ///
    ///     Ok(output)
    /// }
    /// # process_data(&[1, 2, 3]).expect("this test needs 12 bytes, so it shouldn't fail");
    /// ```
    #[stable(feature = "try_reserve", since = "1.57.0")]
    pub fn try_reserve(&mut self, additional: usize) -> Result<(), TryReserveError> {
        self.buf.try_reserve(self.len, additional)
    }

    /// Tries to reserve the minimum capacity for at least `additional`
    /// elements to be inserted in the given `Vec<T>`. Unlike [`try_reserve`],
    /// this will not deliberately over-allocate to speculatively avoid frequent
    /// allocations. After calling `try_reserve_exact`, capacity will be greater
    /// than or equal to `self.len() + additional` if it returns `Ok(())`.
    /// 如果容量已经足够，则不做任何操作。
    ///
    /// 请注意，分配器可能会给集合提供比其
    /// 请求更多的空间。因此，不能依赖容量能够精确达到
    /// minimal. Prefer [`try_reserve`] if future insertions are expected.
    ///
    /// [`try_reserve`]: Vec::try_reserve
    ///
    /// # 错误
    ///
    /// 如果容量溢出或分配器报告失败，则返回错误。
    /// # 错误
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::TryReserveError;
    ///
    /// fn process_data(data: &[u32]) -> Result<Vec<u32>, TryReserveError> {
    ///     let mut output = Vec::new();
    ///
    ///     // Pre-reserve the memory, exiting if we can't
    ///     output.try_reserve_exact(data.len())?;
    ///
    ///     // Now we know this can't OOM in the middle of our complex work
    ///     output.extend(data.iter().map(|&val| {
    ///         val * 2 + 5 // very complicated
    ///     }));
    ///
    ///     Ok(output)
    /// }
    /// # process_data(&[1, 2, 3]).expect("this test needs 12 bytes, so it shouldn't fail");
    /// ```
    #[stable(feature = "try_reserve", since = "1.57.0")]
    pub fn try_reserve_exact(&mut self, additional: usize) -> Result<(), TryReserveError> {
        self.buf.try_reserve_exact(self.len, additional)
    }

    /// 尽可能缩小向量的容量。
    ///
    /// When `vec.len() == vec.capacity()` the allocation is unchanged. Otherwise, the behavior of
    /// this method depends on the allocator, which may either shrink the vector in-place or
    /// # 示例
    /// is the case for [`with_capacity`]. See [`Allocator::shrink`] for more details.
    ///
    /// [`with_capacity`]: Vec::with_capacity
    ///
    /// # 示例
    ///
    /// ```
    /// let mut vec = Vec::with_capacity(10);
    /// vec.extend([1, 2, 3]);
    /// assert!(vec.capacity() >= 10);
    /// vec.shrink_to_fit();
    /// assert!(vec.capacity() >= 3);
    /// ```
    #[cfg(not(no_global_oom_handling))]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    pub fn shrink_to_fit(&mut self) {
        // The capacity is never less than the length, and there's nothing to do when
        // they are equal, so we can avoid the panic case in `RawVec::shrink_to_fit`
        // by only calling it with a greater capacity.
        if self.capacity() > self.len {
            self.buf.shrink_to_fit(self.len);
        }
    }

    /// 使用下限缩小具有下限的向量的容量。
    ///
    /// 容量将至少保持与长度和提供值相同的大小。
    /// 如果当前容量小于下限，则该方法无操作效果。
    ///
    /// # 示例
    ///
    /// # 示例
    ///
    /// ```
    /// let mut vec = Vec::with_capacity(10);
    /// vec.extend([1, 2, 3]);
    /// assert!(vec.capacity() >= 10);
    /// vec.shrink_to(4);
    /// assert!(vec.capacity() >= 4);
    /// vec.shrink_to(0);
    /// assert!(vec.capacity() >= 3);
    /// ```
    #[cfg(not(no_global_oom_handling))]
    #[stable(feature = "shrink_to", since = "1.56.0")]
    pub fn shrink_to(&mut self, min_capacity: usize) {
        if self.capacity() > min_capacity {
            self.buf.shrink_to_fit(cmp::max(self.len, min_capacity));
        }
    }

    /// 尝试尽可能缩小向量的容量。
    ///
    /// 此方法的行为取决于分配器，分配器可能会直接缩小向量或重新分配。生成的向量可能仍有一些多余的容量，就像
    /// in-place or reallocate. The resulting vector might still have some excess capacity, just as
    /// is the case for [`with_capacity`]. See [`Allocator::shrink`] for more details.
    ///
    /// [`with_capacity`]: Vec::with_capacity
    ///
    /// # 错误
    ///
    /// 如果分配器未能缩小分配空间，该函数会返回错误，
    /// 但之后的向量仍然安全使用，容量保持不变。
    /// however. See [`Allocator::shrink`].
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(vec_fallible_shrink)]
    ///
    /// let mut vec = Vec::with_capacity(10);
    /// vec.extend([1, 2, 3]);
    /// assert!(vec.capacity() >= 10);
    /// vec.try_shrink_to_fit().expect("for this test, shrink shouldn't fail");
    /// assert!(vec.capacity() >= 3);
    /// ```
    #[unstable(feature = "vec_fallible_shrink", issue = "152350")]
    #[inline]
    pub fn try_shrink_to_fit(&mut self) -> Result<(), TryReserveError> {
        if self.capacity() > self.len { self.buf.try_shrink_to_fit(self.len) } else { Ok(()) }
    }

    /// 缩小具有下界限制的向量的容量。
    ///
    /// 容量至少会保持与长度及提供值相同的水平。
    /// 如果当前容量小于下界限制，此操作无效果。
    ///
    /// If the current capacity is less than the lower limit, this is a no-op.
    ///
    /// # 错误
    ///
    /// 如果分配器未能缩小分配空间，该函数会返回错误，
    /// 但之后的向量仍然安全使用，容量保持不变。
    /// however. See [`Allocator::shrink`].
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(vec_fallible_shrink)]
    ///
    /// let mut vec = Vec::with_capacity(10);
    /// vec.extend([1, 2, 3]);
    /// assert!(vec.capacity() >= 10);
    /// vec.try_shrink_to(4).expect("for this test, shrink shouldn't fail");
    /// assert!(vec.capacity() >= 4);
    /// vec.try_shrink_to(0).expect("this is a no-op and thus the allocator isn't involved.");
    /// assert!(vec.capacity() >= 3);
    /// ```
    #[unstable(feature = "vec_fallible_shrink", issue = "152350")]
    #[inline]
    pub fn try_shrink_to(&mut self, min_capacity: usize) -> Result<(), TryReserveError> {
        if self.capacity() > min_capacity {
            self.buf.try_shrink_to_fit(cmp::max(self.len, min_capacity))
        } else {
            Ok(())
        }
    }

    /// 将向量转换为已包装的切片。
    ///
    /// This conversion is in-place if `vec.len() == vec.capacity()`.
    ///
    /// 在进行转换之前，此方法会调整向量的分配方式，
    /// 以便如果存在底层分配，返回的切片 [*符合*]该分配的布局。因此，向量原来的容量不再需要
    /// 来确定适合释放的布局。
    /// # 示例
    ///
    /// [*fits*]: crate::alloc::Allocator#memory-fitting
    ///
    /// # 向量的剩余容量不会被保留：
    ///
    /// ```
    /// let v = vec![1, 2, 3];
    ///
    /// let slice = v.into_boxed_slice();
    /// ```
    ///
    /// 将 Vec 转换为已包装的数组。此转换会丢弃任何剩余容量，
    ///
    /// ```
    /// let mut vec = Vec::with_capacity(10);
    /// vec.extend([1, 2, 3]);
    ///
    /// assert!(vec.capacity() >= 10);
    /// let slice = vec.into_boxed_slice();
    /// assert_eq!(slice.into_vec().capacity(), 3);
    /// ```
    #[cfg(not(no_global_oom_handling))]
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn into_boxed_slice(mut self) -> Box<[T], A> {
        self.shrink_to_fit();
        let me = ManuallyDrop::new(self);
        // ignore-tidy-undocumented-unsafe
        unsafe {
            let buf = ptr::read(&me.buf);
            let len = me.len();
            buf.into_box(len).assume_init()
        }
    }

    /// Converts the Vec into a boxed array. This conversion will discard any spare capacity,
    /// if there is any, see [`Vec::into_boxed_slice`].
    /// If you merely wish for a reference to an array, use [`as_array`](https://doc.rust-lang.org/stable/std/primitive.slice.html#method.as_array).
    ///
    /// # 错误
    ///
    /// Returns the original `Vec<T>` in the `Err` variant if [`Vec::len`] does not equal `N`.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(alloc_slice_into_array)]
    /// let vec: Vec<i32> = vec![1, 2, 3];
    /// let box_array: Box<[i32; 3]> = vec.clone().into_array().unwrap();
    /// let not_enough_elements: Result<Box<[i32; 4]>, Vec<i32>> = vec.into_array::<4>();
    /// assert_eq!(not_enough_elements, Err(vec![1, 2, 3]));
    /// ```
    #[cfg(not(no_global_oom_handling))]
    #[unstable(feature = "alloc_slice_into_array", issue = "148082")]
    pub fn into_array<const N: usize>(self) -> Result<Box<[T; N], A>, Self> {
        if self.len() == N {
            // SAFETY: `Box::into_array` is guaranteed to return `Ok` if the
            // length of the slice is equal to `N`.
            // `self.into_boxed_slice().len()` is equal to `self.len()`,
            // which we just checked.
            Ok(unsafe { self.into_boxed_slice().into_array().unwrap_unchecked() })
        } else {
            Err(self)
        }
    }

    /// Shortens the vector, keeping the first `len` elements and dropping
    /// 其余元素。
    ///
    /// If `len` is greater or equal to the vector's current length, this has
    /// 无效果。
    ///
    /// The [`drain`] method can emulate `truncate`, but causes the excess
    /// 元素被返回而不是被丢弃。
    ///
    /// 请注意，此方法对向量分配的容量没有影响。
    /// 所有权。
    ///
    /// # 示例
    ///
    /// 将五个元素的向量截断为两个元素：
    ///
    /// ```
    /// let mut vec = vec![1, 2, 3, 4, 5];
    /// vec.truncate(2);
    /// assert_eq!(vec, [1, 2]);
    /// ```
    ///
    /// No truncation occurs when `len` is greater than or equal to the
    /// vector's current length:
    ///
    /// ```
    /// let mut vec = vec![1, 2, 3];
    /// vec.truncate(8);
    /// assert_eq!(vec, [1, 2, 3]);
    /// ```
    ///
    /// Truncating when `len == 0` is equivalent to calling the [`clear`]
    /// 此方法。
    ///
    /// ```
    /// let mut vec = vec![1, 2, 3];
    /// vec.truncate(0);
    /// assert_eq!(vec, []);
    /// ```
    ///
    /// [`clear`]: Vec::clear
    /// [`drain`]: Vec::drain
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn truncate(&mut self, len: usize) {
        // SAFETY: `BufWriter::flush_buf` assumes that this will not
        // de-initialize any elements of the spare capacity.

        // This is safe because:
        //
        // * the slice passed to `drop_in_place` is valid; the `len >= self.len`
        //   case avoids creating an invalid slice, and
        // * the `len` of the vector is shrunk before calling `drop_in_place`,
        //   such that no value will be dropped twice in case `drop_in_place`
        //   were to panic once (if it panics twice, the program aborts).
        unsafe {
            if len >= self.len {
                return;
            }
            let remaining_len = self.len - len;
            let s = self.as_mut_ptr().add(len).cast_slice(remaining_len);
            self.len = len;
            ptr::drop_in_place(s);
        }
    }

    /// 提取包含整个向量的切片。
    ///
    /// Equivalent to `&s[..]`.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::io::{self, Write};
    /// let buffer = vec![1, 2, 3, 5, 8];
    /// io::sink().write(buffer.as_slice()).unwrap();
    /// ```
    #[inline]
    #[stable(feature = "vec_as_slice", since = "1.7.0")]
    #[rustc_diagnostic_item = "vec_as_slice"]
    #[rustc_const_stable(feature = "const_vec_string_slice", since = "1.87.0")]
    pub const fn as_slice(&self) -> &[T] {
        // SAFETY: `slice::from_raw_parts` requires pointee is a contiguous, aligned buffer of size
        // `len` containing properly-initialized `T`s. Data must not be mutated for the returned
        // lifetime. Further, `len * size_of::<T>` <= `isize::MAX`, and allocation does not
        // "wrap" through overflowing memory addresses.
        //
        // * Vec API guarantees that self.buf:
        //      * contains only properly-initialized items within 0..len
        //      * is aligned, contiguous, and valid for `len` reads
        //      * obeys size and address-wrapping constraints
        //
        // * We only construct `&mut` references to `self.buf` through `&mut self` methods; borrow-
        //   check ensures that it is not possible to mutably alias `self.buf` within the
        //   returned lifetime.
        unsafe {
            // normally this would use `slice::from_raw_parts`, but it's
            // instantiated often enough that avoiding the UB check is worth it
            &*core::intrinsics::aggregate_raw_ptr::<*const [T], _, _>(self.as_ptr(), self.len)
        }
    }

    /// 提取整个向量的可修改切片。
    ///
    /// Equivalent to `&mut s[..]`.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::io::{self, Read};
    /// let mut buffer = vec![0; 3];
    /// io::repeat(0b101).read_exact(buffer.as_mut_slice()).unwrap();
    /// ```
    #[inline]
    #[stable(feature = "vec_as_slice", since = "1.7.0")]
    #[rustc_diagnostic_item = "vec_as_mut_slice"]
    #[rustc_const_stable(feature = "const_vec_string_slice", since = "1.87.0")]
    pub const fn as_mut_slice(&mut self) -> &mut [T] {
        // SAFETY: `BufWriter::flush_buf` assumes that this will not
        // de-initialize any elements of the spare capacity.

        // SAFETY: `slice::from_raw_parts_mut` requires pointee is a contiguous, aligned buffer of
        // size `len` containing properly-initialized `T`s. Data must not be accessed through any
        // other pointer for the returned lifetime. Further, `len * size_of::<T>` <=
        // `isize::MAX` and allocation does not "wrap" through overflowing memory addresses.
        //
        // * Vec API guarantees that self.buf:
        //      * contains only properly-initialized items within 0..len
        //      * is aligned, contiguous, and valid for `len` reads
        //      * obeys size and address-wrapping constraints
        //
        // * We only construct references to `self.buf` through `&self` and `&mut self` methods;
        //   borrow-check ensures that it is not possible to construct a reference to `self.buf`
        //   within the returned lifetime.
        unsafe {
            // normally this would use `slice::from_raw_parts_mut`, but it's
            // instantiated often enough that avoiding the UB check is worth it
            &mut *core::intrinsics::aggregate_raw_ptr::<*mut [T], _, _>(self.as_mut_ptr(), self.len)
        }
    }

    /// 返回指向向量缓冲区的原始指针，或一个无效的原始指针
    /// 如果向量 [没有分配]，则适用于零大小读取的无效指针。
    ///
    /// 调用者必须确保向量在该函数返回之前一直存在，否则会导致指针悬空。
    /// 如果修改向量，其缓冲区可能会被重新分配，
    /// 这也会使指向它的任何指针变得无效。
    /// 调用者还必须确保该指针所指向的内存
    ///
    /// The caller must also ensure that the memory the pointer (non-transitively) points to
    /// is never written to (except inside an `UnsafeCell`) using this pointer or any pointer
    /// derived from it. If you need to mutate the contents of the slice, use [`as_mut_ptr`].
    ///
    /// This method guarantees that for the purpose of the aliasing model, this method
    /// does not materialize a reference to the underlying slice, and thus the returned pointer
    /// will remain valid when mixed with other calls to [`as_ptr`], [`as_mut_ptr`],
    /// and [`as_non_null`].
    /// 或生成通过此指针可以访问特定元素的可修改引用，
    /// 以及对这些元素进行写入操作，仍可能使该指针失效。
    /// 参见下面的第二个示例以了解如何应用此保证。
    /// # 示例
    ///
    ///
    /// # 示例
    ///
    /// ```
    /// let x = vec![1, 2, 4];
    /// let x_ptr = x.as_ptr();
    ///
    /// unsafe {
    ///     for i in 0..x.len() {
    ///         assert_eq!(*x_ptr.add(i), 1 << i);
    ///     }
    /// }
    /// ```
    ///
    /// 由于别名保证，以下代码是合法的：
    ///
    /// ```rust
    /// unsafe {
    ///     let mut v = vec![0, 1, 2];
    ///     let ptr1 = v.as_ptr();
    ///     let _ = ptr1.read();
    ///     let ptr2 = v.as_mut_ptr().offset(2);
    ///     ptr2.write(2);
    ///     // Notably, the write to `ptr2` did *not* invalidate `ptr1`
    ///     // because it mutated a different element:
    ///     let _ = ptr1.read();
    /// }
    /// ```
    ///
    /// [`as_mut_ptr`]: Vec::as_mut_ptr
    /// [`as_ptr`]: Vec::as_ptr
    /// [`as_non_null`]: Vec::as_non_null
    /// [didn't allocate]: self#memory-layout
    #[stable(feature = "vec_as_ptr", since = "1.37.0")]
    #[rustc_const_stable(feature = "const_vec_string_slice", since = "1.87.0")]
    #[inline]
    #[lint::as_ptr]
    #[lint::never_returns_null_ptr]
    pub const fn as_ptr(&self) -> *const T {
        // We shadow the slice method of the same name to avoid going through
        // `deref`, which creates an intermediate reference.
        self.buf.ptr()
    }

    /// 返回一个指向向量缓冲区的原始可修改指针，或一个悬空
    /// 的原始指针，如果向量 [没有分配内存]，则适用于零大小读取。
    ///
    /// 调用者必须确保向量在该函数返回之前一直存在，否则会导致指针悬空。
    /// 如果修改向量，其缓冲区可能会被重新分配，
    /// 这也会使指向它的任何指针变得无效。
    /// 这也会使指向它的任何指针变得无效。
    ///
    /// 此方法保证根据别名模型，该方法
    /// 不会生成对底层切片的引用，因此返回的指针
    /// will remain valid when mixed with other calls to [`as_ptr`], [`as_mut_ptr`],
    /// and [`as_non_null`].
    /// 仍然有效。
    /// 请注意，调用其他生成切片引用的方法，
    /// 或生成通过此指针可以访问特定元素的引用，
    /// 仍可能使该指针失效。
    ///
    /// The method also guarantees that, as long as `T` is not zero-sized and the capacity is
    /// nonzero, the pointer may be passed into [`dealloc`] with a layout of
    /// `Layout::array::<T>(capacity)` in order to deallocate the backing memory. If this is done,
    /// be careful not to run the destructor of the `Vec`, as dropping it will result in
    /// double-frees. Wrapping the `Vec` in a [`ManuallyDrop`] is the typical way to achieve this.
    ///
    /// # 示例
    ///
    /// ```
    /// // Allocate vector big enough for 4 elements.
    /// let size = 4;
    /// let mut x: Vec<i32> = Vec::with_capacity(size);
    /// let x_ptr = x.as_mut_ptr();
    ///
    /// // Initialize elements via raw pointer writes, then set length.
    /// unsafe {
    ///     for i in 0..size {
    ///         *x_ptr.add(i) = i as i32;
    ///     }
    ///     x.set_len(size);
    /// }
    /// assert_eq!(&*x, &[0, 1, 2, 3]);
    /// ```
    ///
    /// 由于别名保证，以下代码是合法的：
    ///
    /// ```rust
    /// unsafe {
    ///     let mut v = vec![0];
    ///     let ptr1 = v.as_mut_ptr();
    ///     ptr1.write(1);
    ///     let ptr2 = v.as_mut_ptr();
    ///     ptr2.write(2);
    ///     // Notably, the write to `ptr2` did *not* invalidate `ptr1`:
    ///     ptr1.write(3);
    /// }
    /// ```
    ///
    /// Deallocating a vector using [`Box`] (which uses [`dealloc`] internally):
    ///
    /// ```
    /// use std::mem::{ManuallyDrop, MaybeUninit};
    ///
    /// let mut v = ManuallyDrop::new(vec![0, 1, 2]);
    /// let ptr = v.as_mut_ptr();
    /// let capacity = v.capacity();
    /// let slice_ptr: *mut [MaybeUninit<i32>] =
    ///     std::ptr::slice_from_raw_parts_mut(ptr.cast(), capacity);
    /// drop(unsafe { Box::from_raw(slice_ptr) });
    /// ```
    ///
    /// [`as_mut_ptr`]: Vec::as_mut_ptr
    /// [`as_ptr`]: Vec::as_ptr
    /// [`as_non_null`]: Vec::as_non_null
    /// [`dealloc`]: crate::alloc::GlobalAlloc::dealloc
    /// [`ManuallyDrop`]: core::mem::ManuallyDrop
    /// [didn't allocate]: self#memory-layout
    #[stable(feature = "vec_as_ptr", since = "1.37.0")]
    #[rustc_const_stable(feature = "const_vec_string_slice", since = "1.87.0")]
    #[lint::as_ptr]
    #[lint::never_returns_null_ptr]
    #[inline]
    pub const fn as_mut_ptr(&mut self) -> *mut T {
        // We shadow the slice method of the same name to avoid going through
        // `deref_mut`, which creates an intermediate reference.
        self.buf.ptr()
    }

    /// Returns a `NonNull` pointer to the vector's buffer, or a dangling
    /// `NonNull` pointer valid for zero sized reads if the vector [didn't allocate].
    ///
    /// 调用者必须确保向量在该函数返回之前一直存在，否则指针将变为悬空。
    /// 修改向量可能会使其缓冲区被重新分配，
    /// 这也会使指向它的任何指针变得无效。
    /// which would also make any pointers to it invalid.
    ///
    /// 注意，调用其他创建切片引用的方法，
    /// 或创建通过此指针访问特定元素的引用，
    /// will remain valid when mixed with other calls to [`as_ptr`], [`as_mut_ptr`],
    /// and [`as_non_null`].
    /// 请注意，调用其他创建切片引用的方法，
    /// 或创建通过此指针访问特定元素的引用，
    /// 仍可能使该指针失效。
    /// 请参见下面的第二个示例以了解如何应用此保证。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(vec_as_non_null)]
    ///
    /// // Allocate vector big enough for 4 elements.
    /// let size = 4;
    /// let mut x: Vec<i32> = Vec::with_capacity(size);
    /// let x_ptr = x.as_non_null();
    ///
    /// // Initialize elements via raw pointer writes, then set length.
    /// unsafe {
    ///     for i in 0..size {
    ///         x_ptr.add(i).write(i as i32);
    ///     }
    ///     x.set_len(size);
    /// }
    /// assert_eq!(&*x, &[0, 1, 2, 3]);
    /// ```
    ///
    /// 由于别名保证，以下代码是合法的：
    ///
    /// ```rust
    /// #![feature(vec_as_non_null)]
    ///
    /// unsafe {
    ///     let mut v = vec![0];
    ///     let ptr1 = v.as_non_null();
    ///     ptr1.write(1);
    ///     let ptr2 = v.as_non_null();
    ///     ptr2.write(2);
    ///     // Notably, the write to `ptr2` did *not* invalidate `ptr1`:
    ///     ptr1.write(3);
    /// }
    /// ```
    ///
    /// [`as_mut_ptr`]: Vec::as_mut_ptr
    /// [`as_ptr`]: Vec::as_ptr
    /// [`as_non_null`]: Vec::as_non_null
    /// [didn't allocate]: self#memory-layout
    #[unstable(feature = "vec_as_non_null", issue = "157843")]
    #[rustc_const_unstable(feature = "vec_as_non_null", issue = "157843")]
    #[lint::as_ptr]
    #[inline]
    pub const fn as_non_null(&mut self) -> NonNull<T> {
        self.buf.non_null()
    }

    /// 返回对底层分配器的引用。
    #[stable(feature = "allocator_api", since = "1.100.0")]
    #[rustc_const_unstable(feature = "const_heap", issue = "79597")]
    #[inline]
    pub const fn allocator(&self) -> &A {
        self.buf.allocator()
    }

    /// Forces the length of the vector to `new_len`.
    ///
    /// 这是一项低级别操作，不会保持类型的常规
    /// 不变式。通常，改变向量长度应使用安全操作，例如
    /// # 安全性
    /// [`truncate`], [`resize`], [`extend`], or [`clear`].
    ///
    /// [`truncate`]: Vec::truncate
    /// [`resize`]: Vec::resize
    /// [`extend`]: Extend::extend
    /// [`clear`]: Vec::clear
    ///
    /// # Safety
    ///
    /// - `new_len` must be less than or equal to [`capacity()`].
    /// - The elements at `old_len..new_len` must be initialized.
    ///
    /// [`capacity()`]: Vec::capacity
    ///
    /// # Examples
    ///
    /// See [`spare_capacity_mut()`] for an example with safe
    /// 的示例。
    ///
    /// `set_len()` can be useful for situations in which the vector
    /// is serving as a buffer for other code, particularly over FFI:
    ///
    /// ```no_run
    /// # #![allow(dead_code)]
    /// # // This is just a minimal skeleton for the doc example;
    /// # // don't use this as a starting point for a real library.
    /// # pub struct StreamWrapper { strm: *mut std::ffi::c_void }
    /// # const Z_OK: i32 = 0;
    /// # unsafe extern "C" {
    /// #     fn deflateGetDictionary(
    /// #         strm: *mut std::ffi::c_void,
    /// #         dictionary: *mut u8,
    /// #         dictLength: *mut usize,
    /// #     ) -> i32;
    /// # }
    /// # impl StreamWrapper {
    /// pub fn get_dictionary(&self) -> Option<Vec<u8>> {
    ///     // Per the FFI method's docs, "32768 bytes is always enough".
    ///     let mut dict = Vec::with_capacity(32_768);
    ///     let mut dict_length = 0;
    ///     // SAFETY: When `deflateGetDictionary` returns `Z_OK`, it holds that:
    ///     // 1. `dict_length` elements were initialized.
    ///     // 2. `dict_length` <= the capacity (32_768)
    ///     // which makes `set_len` safe to call.
    ///     unsafe {
    ///         // Make the FFI call...
    ///         let r = deflateGetDictionary(self.strm, dict.as_mut_ptr(), &mut dict_length);
    ///         if r == Z_OK {
    ///             // ...and update the length to what was initialized.
    ///             dict.set_len(dict_length);
    ///             Some(dict)
    ///         } else {
    ///             None
    ///         }
    ///     }
    /// }
    /// # }
    /// ```
    ///
    /// While the following example is sound, there is a memory leak since
    /// the inner vectors were not freed prior to the `set_len` call:
    ///
    /// ```
    /// let mut vec = vec![vec![1, 0, 0],
    ///                    vec![0, 1, 0],
    ///                    vec![0, 0, 1]];
    /// // SAFETY:
    /// // 1. `old_len..0` is empty so no elements need to be initialized.
    /// // 2. `0 <= capacity` always holds whatever `capacity` is.
    /// unsafe {
    ///     vec.set_len(0);
    /// #   // FIXME(https://github.com/rust-lang/miri/issues/3670):
    /// #   // use -Zmiri-disable-leak-check instead of unleaking in tests meant to leak.
    /// #   vec.set_len(3);
    /// }
    /// ```
    ///
    /// Normally, here, one would use [`clear`] instead to correctly drop
    /// 这不会保留剩余元素的顺序，但时间复杂度为 *O*(1)。
    ///
    /// [`spare_capacity_mut()`]: Vec::spare_capacity_mut
    #[inline]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_unstable(feature = "const_heap", issue = "79597")]
    pub const unsafe fn set_len(&mut self, new_len: usize) {
        ub_checks::assert_unsafe_precondition!(
            check_library_ub,
            "Vec::set_len requires that new_len <= capacity()",
            (new_len: usize = new_len, capacity: usize = self.capacity()) => new_len <= capacity
        );

        self.len = new_len;
    }

    /// 从向量中移除一个元素并返回它。
    ///
    /// 被移除的元素由向量的最后一个元素替代。
    ///
    /// 这不会保留剩余元素的顺序，但时间复杂度为 *O*(1)。
    /// If you need to preserve the element order, use [`remove`] instead.
    ///
    /// [`remove`]: Vec::remove
    ///
    /// # 异常
    ///
    /// Panics if `index` is out of bounds.
    ///
    /// # 示例
    ///
    /// ```
    /// let mut v = vec!["foo", "bar", "baz", "qux"];
    ///
    /// assert_eq!(v.swap_remove(1), "bar");
    /// assert_eq!(v, ["foo", "qux", "baz"]);
    ///
    /// assert_eq!(v.swap_remove(0), "foo");
    /// assert_eq!(v, ["baz", "qux"]);
    /// ```
    #[inline]
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn swap_remove(&mut self, index: usize) -> T {
        #[cold]
        #[cfg_attr(not(panic = "immediate-abort"), inline(never))]
        #[optimize(size)]
        fn assert_failed(index: usize, len: usize) -> ! {
            panic!("swap_remove index (is {index}) should be < len (is {len})");
        }

        let len = self.len();
        if index >= len {
            assert_failed(index, len);
        }
        // ignore-tidy-undocumented-unsafe
        unsafe {
            // We replace self[index] with the last element. Note that if the
            // bounds check above succeeds there must be a last element (which
            // can be self[index] itself).
            let value = ptr::read(self.as_ptr().add(index));
            let base_ptr = self.as_mut_ptr();
            ptr::copy(base_ptr.add(len - 1), base_ptr.add(index), 1);
            self.set_len(len - 1);
            value
        }
    }

    /// Inserts an element at position `index` within the vector, shifting all
    /// 其后的元素向右移动。
    ///
    /// # 异常
    ///
    /// Panics if `index > len`.
    ///
    /// # 示例
    ///
    /// ```
    /// let mut vec = vec!['a', 'b', 'c'];
    /// vec.insert(1, 'd');
    /// assert_eq!(vec, ['a', 'd', 'b', 'c']);
    /// vec.insert(4, 'e');
    /// assert_eq!(vec, ['a', 'd', 'b', 'c', 'e']);
    /// ```
    ///
    /// # 时间复杂度
    ///
    /// Takes *O*([`Vec::len`]) time. All items after the insertion index must be
    /// 向右移动。在最坏情况下，当插入索引为 0 时，所有元素都会移动。
    /// the insertion index is 0.
    #[cfg(not(no_global_oom_handling))]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[track_caller]
    pub fn insert(&mut self, index: usize, element: T) {
        let _ = self.insert_mut(index, element);
    }

    /// Inserts an element at position `index` within the vector, shifting all
    /// # 异常
    /// element.
    ///
    /// # 异常
    ///
    /// Panics if `index > len`.
    ///
    /// # 示例
    ///
    /// ```
    /// let mut vec = vec![1, 3, 5, 9];
    /// let x = vec.insert_mut(3, 6);
    /// *x += 1;
    /// assert_eq!(vec, [1, 3, 5, 7, 9]);
    /// ```
    ///
    /// # 时间复杂度
    ///
    /// Takes *O*([`Vec::len`]) time. All items after the insertion index must be
    /// 向右移动。在最坏情况下，当插入索引为 0 时，所有元素都会移动。
    /// the insertion index is 0.
    #[cfg(not(no_global_oom_handling))]
    #[inline]
    #[stable(feature = "push_mut", since = "1.95.0")]
    #[track_caller]
    #[must_use = "if you don't need a reference to the value, use `Vec::insert` instead"]
    pub fn insert_mut(&mut self, index: usize, element: T) -> &mut T {
        #[cold]
        #[cfg_attr(not(panic = "immediate-abort"), inline(never))]
        #[track_caller]
        #[optimize(size)]
        fn assert_failed(index: usize, len: usize) -> ! {
            panic!("insertion index (is {index}) should be <= len (is {len})");
        }

        let len = self.len();
        if index > len {
            assert_failed(index, len);
        }

        // space for the new element
        if len == self.buf.capacity() {
            self.buf.grow_one();
        }

        // ignore-tidy-undocumented-unsafe
        unsafe {
            // infallible
            // The spot to put the new value
            let p = self.as_mut_ptr().add(index);
            {
                if index < len {
                    // Shift everything over to make space. (Duplicating the
                    // `index`th element into two consecutive places.)
                    ptr::copy(p, p.add(1), len - index);
                }
                // Write it in, overwriting the first copy of the `index`th
                // element.
                ptr::write(p, element);
            }
            self.set_len(len + 1);
            &mut *p
        }
    }

    /// Removes and returns the element at position `index` within the vector,
    /// shifting all elements after it to the left.
    ///
    /// Note: Because this shifts over the remaining elements, it has a
    /// # 异常
    /// to be preserved, use [`swap_remove`] instead. If you'd like to remove
    /// elements from the beginning of the `Vec`, consider using
    /// [`VecDeque::pop_front`] instead.
    ///
    /// [`swap_remove`]: Vec::swap_remove
    /// [`VecDeque::pop_front`]: crate::collections::VecDeque::pop_front
    ///
    /// # Panics
    ///
    /// Panics if `index` is out of bounds.
    ///
    /// # Examples
    ///
    /// ```
    /// let mut v = vec!['a', 'b', 'c'];
    /// assert_eq!(v.remove(1), 'b');
    /// assert_eq!(v, ['a', 'c']);
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[track_caller]
    #[rustc_confusables("delete", "take")]
    pub fn remove(&mut self, index: usize) -> T {
        #[cold]
        #[cfg_attr(not(panic = "immediate-abort"), inline(never))]
        #[track_caller]
        #[optimize(size)]
        fn assert_failed(index: usize, len: usize) -> ! {
            panic!("removal index (is {index}) should be < len (is {len})");
        }

        match self.try_remove(index) {
            Some(elem) => elem,
            None => assert_failed(index, self.len()),
        }
    }

    /// Remove and return the element at position `index` within the vector,
    /// shifting all elements after it to the left, or [`None`] if it does not
    /// exist.
    ///
    /// Note: Because this shifts over the remaining elements, it has a
    /// worst-case performance of *O*(*n*). If you'd like to remove
    /// elements from the beginning of the `Vec`, consider using
    /// [`VecDeque::pop_front`] instead.
    ///
    /// [`VecDeque::pop_front`]: crate::collections::VecDeque::pop_front
    ///
    /// # 仅保留由谓词指定的元素。
    ///
    /// ```
    /// let mut v = vec![1, 2, 3];
    /// assert_eq!(v.try_remove(0), Some(1));
    /// assert_eq!(v.try_remove(2), None);
    /// ```
    #[stable(feature = "vec_try_remove", since = "1.101.0")]
    #[rustc_confusables("delete", "take", "remove")]
    pub fn try_remove(&mut self, index: usize) -> Option<T> {
        let len = self.len();
        if index >= len {
            return None;
        }
        // infallible
        let ret;
        // ignore-tidy-undocumented-unsafe
        unsafe {
            {
                // the place we are taking from.
                let ptr = self.as_mut_ptr().add(index);
                // copy it out, unsafely having a copy of the value on
                // the stack and in the vector at the same time.
                ret = ptr::read(ptr);

                // Shift everything down to fill in that spot.
                ptr::copy(ptr.add(1), ptr, len - index - 1);
            }
            self.set_len(len - 1);
        }
        Some(ret)
    }

    /// Retains only the elements specified by the predicate.
    ///
    /// In other words, remove all elements `e` for which `f(&e)` returns `false`.
    /// # 示例
    /// 由于元素按原始顺序被恰好访问一次，
    ///
    /// # 外部状态可用于决定保留哪些元素。
    ///
    /// ```
    /// let mut vec = vec![1, 2, 3, 4];
    /// vec.retain(|&x| x % 2 == 0);
    /// assert_eq!(vec, [2, 4]);
    /// ```
    ///
    /// 仅保留由谓词指定的元素，传递其可修改的引用。
    /// external state may be used to decide which elements to keep.
    ///
    /// ```
    /// let mut vec = vec![1, 2, 3, 4, 5];
    /// let keep = [false, true, true, false, true];
    /// let mut iter = keep.iter();
    /// vec.retain(|_| *iter.next().unwrap());
    /// assert_eq!(vec, [2, 3, 5]);
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn retain<F>(&mut self, mut f: F)
    where
        F: FnMut(&T) -> bool,
    {
        self.retain_mut(|elem| f(elem));
    }

    /// 该方法原地操作，每个元素恰好被访问一次，保持原始顺序，并保留保留元素的顺序。
    ///
    /// In other words, remove all elements `e` such that `f(&mut e)` returns `false`.
    /// This method operates in place, visiting each element exactly once in the
    /// original order, and preserves the order of the retained elements.
    ///
    /// # 示例
    ///
    /// ```
    /// let mut vec = vec![1, 2, 3, 4];
    /// vec.retain_mut(|x| if *x <= 3 {
    ///     *x += 1;
    ///     true
    /// } else {
    ///     false
    /// });
    /// assert_eq!(vec, [2, 3, 4]);
    /// ```
    #[stable(feature = "vec_retain_mut", since = "1.61.0")]
    pub fn retain_mut<F>(&mut self, f: F)
    where
        F: FnMut(&mut T) -> bool,
    {
        #[cfg(all(target_arch = "aarch64", target_feature = "sve"))]
        {
            let original_len = self.len();
            let long_enough = match mem::size_of::<T>() {
                1 => original_len >= sve_retain::MIN_SVE_SIZE_1,
                2 => original_len >= sve_retain::MIN_SVE_SIZE_2,
                4 => original_len >= sve_retain::MIN_SVE_SIZE_4,
                8 => original_len >= sve_retain::MIN_SVE_SIZE_8,
                _ => false,
            };
            if long_enough {
                // SAFETY: size_of::<T>() is 1, 2, 4 or 8, matching
                // the kernel lane widths.
                return unsafe { sve_retain::chunked_retain(self, f) };
            }
        }

        let buf = self.as_mut_ptr();
        let front_len = self.len();
        // SAFETY: `buf[..len]` is initialized. `front_len == self.len`,
        // so `back` won't be accessed.
        // Specify `SINGLE_REGION` true because `front_len` always equals `self.len`.
        unsafe { retain_raw::<true, _, _>(buf, front_len, buf, &mut self.len, f) }
    }

    /// 仅保留谓词指定的元素，并传递其可修改引用。
    ///
    /// In other words, remove all elements `e` such that `f(&mut e)` returns `false`.
    /// 该方法不保持保留元素的相对顺序。如果顺序很重要，
    /// consider using [`Vec::retain_mut`] instead. However, if no items are removed, then all items
    /// 都保留在原始位置。
    ///
    /// Generally, this method is faster than [`Vec::retain_mut`] due to its weak ordering guarantees.
    ///
    /// [`Vec::retain_mut`]: crate::vec::Vec::retain_mut
    ///
    /// 时间复杂度：*O*(*n*)
    ///
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(retain_unstable)]
    /// let mut vec = vec![4, 3, 2, 1];
    /// vec.retain_unstable(|x| if *x <= 3 {
    ///     *x += 1;
    ///     true
    /// } else {
    ///     false
    /// });
    ///
    /// vec.sort(); // it might be in any order, so normalize before asserting
    /// assert_eq!(vec, [2, 3, 4]);
    /// ```
    #[unstable(feature = "retain_unstable", issue = "164152")]
    pub fn retain_unstable<F>(&mut self, mut f: F)
    where
        F: FnMut(&mut T) -> bool,
    {
        // Currently this does the following:
        // 1) Search backward until you find an element you want to remove
        // 2) Swap this element with an element that was kept in the back
        //    (or if there are no remaining elements, simply truncate the vec)
        // 3) Repeat from 1) until there's no element to iterate through

        let original_len = self.len();

        if original_len == 0 {
            // Empty case: explicit return allows better optimization, vs letting compiler infer it
            return;
        }

        let mut read_back = original_len;
        let mut hole = loop {
            if read_back == 0 {
                // All elements are kept
                return;
            }
            // SAFETY: read_back - 1 < original_len
            let cur = unsafe { &mut *self.as_mut_ptr().add(read_back - 1) };
            if hint::unlikely(!f(cur)) {
                break cur;
            }
            read_back -= 1;
        };

        if read_back < self.len {
            let swap = self.pop().unwrap();
            *hole = swap;
        } else {
            self.truncate(self.len - 1);
        }
        read_back -= 1;

        while read_back > 0 {
            // SAFETY: read_back - 1 is always less than current length of
            // the vector and the loop condition, read_back > 0, prevents
            // read_back from underflowing
            hole = unsafe { &mut *self.as_mut_ptr().add(read_back - 1) };
            if !f(hole) {
                if read_back < self.len {
                    let swap = self.pop().unwrap();
                    *hole = swap;
                } else {
                    self.truncate(self.len - 1);
                }
            }
            read_back -= 1;
        }
    }

    /// 移除向量中除第一个元素外所有连续相同
    /// 键的元素。
    ///
    /// 如果向量已排序，则移除所有重复项。
    ///
    /// # 示例
    ///
    /// ```
    /// let mut vec = vec![10, 20, 21, 30, 20];
    ///
    /// vec.dedup_by_key(|i| *i / 10);
    ///
    /// assert_eq!(vec, [10, 20, 30, 20]);
    /// ```
    #[stable(feature = "dedup_by", since = "1.16.0")]
    #[inline]
    pub fn dedup_by_key<F, K>(&mut self, mut key: F)
    where
        F: FnMut(&mut T) -> K,
        K: PartialEq,
    {
        self.dedup_by(|a, b| key(a) == key(b))
    }

    /// 移除向量中除第一个元素外所有连续元素，这些元素
    /// 根据给定谓词函数“相等”。
    ///
    /// The predicate `same_bucket(x, p)` is passed references to two elements.
    /// If it returns `true`, the element `x` is removed from the vector.
    ///
    /// The element `p` occurs *before* `x` in the vector (`[.., p, .., x, ..]`),
    /// so `same_bucket(x, p)` is receiving them in reversed order (unlike [`windows`]).
    ///
    /// 如果向量已排序，则移除所有重复项。对于更复杂的谓词
    /// 然而，顺序（升序 vs. 降序）可能很重要。
    ///
    /// [`windows`]: slice::windows
    ///
    /// # 示例
    ///
    /// ```
    /// let mut vec = vec!["foo", "bar", "Bar", "baz", "bar"];
    /// vec.dedup_by(|x, p| x.eq_ignore_ascii_case(p));
    /// assert_eq!(vec, ["foo", "bar", "baz", "bar"]);
    /// ```
    ///
    /// Both references passed to `same_bucket` are mutable.
    /// This allows merging elements by mutating `p` and returning `true`:
    ///
    /// ```
    /// let mut ranges = vec![1..2, 2..4, 2..5, 8..9];
    ///
    /// // Sort ranges by start, and if equal, by end (lexicographically)
    /// // Sorting in reverse instead (`x.start.cmp(&p.start)...`) would later fail
    /// ranges.sort_unstable_by(|p, x| p.start.cmp(&x.start).then(p.end.cmp(&x.end)));
    ///
    /// // Merge touching (`1..2` and `2..4`) and then overlapping (`1..4` and `2..5`) ranges
    /// ranges.dedup_by(|x, p| {
    ///     if p.end >= x.start {
    ///         p.end = p.end.max(x.end);
    ///         true
    ///     } else {
    ///         false
    ///     }
    /// });
    ///
    /// assert_eq!(ranges, [1..5, 8..9]);
    /// ```
    #[stable(feature = "dedup_by", since = "1.16.0")]
    pub fn dedup_by<F>(&mut self, mut same_bucket: F)
    where
        F: FnMut(&mut T, &mut T) -> bool,
    {
        let len = self.len();
        if len <= 1 {
            return;
        }

        // Check if we ever want to remove anything.
        // This allows to use copy_non_overlapping in next cycle.
        // And avoids any memory writes if we don't need to remove anything.
        let mut first_duplicate_idx: usize = 1;
        let start = self.as_mut_ptr();
        while first_duplicate_idx != len {
            let found_duplicate = {
                // SAFETY: first_duplicate always in range [1..len).
                // Note that we start iteration from 1 so we never overflow.
                let prev = unsafe { start.add(first_duplicate_idx.wrapping_sub(1)) };
                // ignore-tidy-undocumented-unsafe
                let current = unsafe { start.add(first_duplicate_idx) };
                // We explicitly say in docs that references are reversed.
                // ignore-tidy-undocumented-unsafe
                unsafe { same_bucket(&mut *current, &mut *prev) }
            };
            if found_duplicate {
                break;
            }
            first_duplicate_idx += 1;
        }
        // Don't need to remove anything.
        // We cannot get bigger than len.
        if first_duplicate_idx == len {
            return;
        }
        // SAFETY: first_duplicate_idx always in range [1..len)
        unsafe {
            self.dedup_tail(same_bucket, first_duplicate_idx);
        }
    }

    /// 在发现第一个重复项后继续去重。
    ///
    /// The function treats `self[first_duplicate]` as the first duplicated
    /// # 安全性
    ///
    /// # 追加一个元素，如果剩余空间足够，则返回该元素的引用；否则返回错误及元素本身。
    ///
    /// `1 <= first_duplicate < self.len()`
    unsafe fn dedup_tail<F>(&mut self, mut same_bucket: F, first_duplicate: usize)
    where
        F: FnMut(&mut T, &mut T) -> bool,
    {
        /* INVARIANT: vec.len() > read > write > write-1 >= 0 */
        struct FillGapOnDrop<'a, T, A: core::alloc::Allocator> {
            /* Offset of the element we want to check if it is duplicate */
            read: usize,

            /* Offset of the place where we want to place the non-duplicate
             * when we find it. */
            write: usize,

            /* The Vec that would need correction if `same_bucket` panicked */
            vec: &'a mut Vec<T, A>,
        }

        impl<'a, T, A: core::alloc::Allocator> Drop for FillGapOnDrop<'a, T, A> {
            fn drop(&mut self) {
                /* This code gets executed when `same_bucket` panics */

                // SAFETY: invariant guarantees that `read - write`
                // and `len - read` never overflow and that the copy is always
                // in-bounds.
                unsafe {
                    let ptr = self.vec.as_mut_ptr();
                    let len = self.vec.len();

                    /* How many items were left when `same_bucket` panicked.
                     * Basically vec[read..].len() */
                    let items_left = len.wrapping_sub(self.read);

                    /* Pointer to first item in vec[write..write+items_left] slice */
                    let dropped_ptr = ptr.add(self.write);
                    /* Pointer to first item in vec[read..] slice */
                    let valid_ptr = ptr.add(self.read);

                    /* Copy `vec[read..]` to `vec[write..write+items_left]`.
                     * The slices can overlap, so `copy_nonoverlapping` cannot be used */
                    ptr::copy(valid_ptr, dropped_ptr, items_left);

                    /* How many items have been already dropped
                     * Basically vec[read..write].len() */
                    let dropped = self.read.wrapping_sub(self.write);

                    self.vec.set_len(len - dropped);
                }
            }
        }

        let start = self.as_mut_ptr();
        let len = self.len();

        /* Drop items while going through Vec, it should be more efficient than
         * doing slice partition_dedup + truncate */

        // Construct gap first and then drop item to avoid memory corruption if `T::drop` panics.
        let mut gap =
            FillGapOnDrop { read: first_duplicate + 1, write: first_duplicate, vec: self };

        // SAFETY: By this function's safety contract, `first_duplicate < self.len()`.
        // If drop panics, `gap` would remove this item without drop.
        unsafe {
            ptr::drop_in_place(start.add(first_duplicate));
        }

        // SAFETY: Because of the invariant, read_ptr, prev_ptr and write_ptr
        // are always in-bounds and read_ptr never aliases prev_ptr
        unsafe {
            while gap.read < len {
                let read_ptr = start.add(gap.read);
                let prev_ptr = start.add(gap.write.wrapping_sub(1));

                // We explicitly say in docs that references are reversed.
                let found_duplicate = same_bucket(&mut *read_ptr, &mut *prev_ptr);
                if found_duplicate {
                    // Increase `gap.read` now since the drop may panic.
                    gap.read += 1;
                    /* We have found duplicate, drop it in-place */
                    ptr::drop_in_place(read_ptr);
                } else {
                    let write_ptr = start.add(gap.write);

                    /* read_ptr cannot be equal to write_ptr because at this point
                     * we guaranteed to skip at least one element (before loop starts).
                     */
                    ptr::copy_nonoverlapping(read_ptr, write_ptr, 1);

                    /* We have filled that place, so go further */
                    gap.write += 1;
                    gap.read += 1;
                }
            }

            /* Technically we could let `gap` clean up with its Drop, but
             * when `same_bucket` is guaranteed to not panic, this bloats a little
             * the codegen, so we just do it manually */
            gap.vec.set_len(gap.write);
            mem::forget(gap);
        }
    }

    /// Appends an element and returns a reference to it if there is sufficient spare capacity,
    /// otherwise an error is returned with the element.
    ///
    /// Unlike [`push`] this method will not reallocate when there's insufficient capacity.
    /// The caller should use [`reserve`] or [`try_reserve`] to ensure that there is enough capacity.
    ///
    /// [`push`]: Vec::push
    /// [`reserve`]: Vec::reserve
    /// [`try_reserve`]: Vec::try_reserve
    ///
    /// # 时间复杂度
    ///
    /// A manual, panic-free alternative to [`FromIterator`]:
    ///
    /// ```
    /// #![feature(vec_push_within_capacity)]
    ///
    /// use std::collections::TryReserveError;
    /// fn from_iter_fallible<T>(iter: impl Iterator<Item=T>) -> Result<Vec<T>, TryReserveError> {
    ///     let mut vec = Vec::new();
    ///     for value in iter {
    ///         if let Err(value) = vec.push_within_capacity(value) {
    ///             vec.try_reserve(1)?;
    ///             // this cannot fail, the previous line either returned or added at least 1 free slot
    ///             let _ = vec.push_within_capacity(value);
    ///         }
    ///     }
    ///     Ok(vec)
    /// }
    /// assert_eq!(from_iter_fallible(0..100), Ok(Vec::from_iter(0..100)));
    /// ```
    ///
    /// # Time complexity
    ///
    /// Takes *O*(1) time.
    #[inline]
    #[unstable(feature = "vec_push_within_capacity", issue = "100486")]
    pub fn push_within_capacity(&mut self, value: T) -> Result<&mut T, T> {
        if self.len == self.buf.capacity() {
            return Err(value);
        }

        // ignore-tidy-undocumented-unsafe
        let end = unsafe { self.as_mut_ptr().add(self.len) };
        // ignore-tidy-undocumented-unsafe
        unsafe { ptr::write(end, value) };
        self.len += 1;

        // SAFETY: We just wrote a value to the pointer that will live the lifetime of the reference.
        Ok(unsafe { &mut *end })
    }

    /// Removes the last element from a vector and returns it, or [`None`] if it
    /// 时间复杂度：*O*(1)。
    ///
    /// If you'd like to pop the first element, consider using
    /// [`VecDeque::pop_front`] instead.
    ///
    /// [`VecDeque::pop_front`]: crate::collections::VecDeque::pop_front
    ///
    /// # Examples
    ///
    /// ```
    /// let mut vec = vec![1, 2, 3];
    /// assert_eq!(vec.pop(), Some(3));
    /// assert_eq!(vec, [1, 2]);
    /// ```
    ///
    /// # Time complexity
    ///
    /// Takes *O*(1) time.
    #[inline]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_diagnostic_item = "vec_pop"]
    pub fn pop(&mut self) -> Option<T> {
        if self.len == 0 {
            None
        } else {
            self.len -= 1;
            // ignore-tidy-undocumented-unsafe
            unsafe {
                core::hint::assert_unchecked(self.len < self.capacity());
                Some(ptr::read(self.as_ptr().add(self.len())))
            }
        }
    }

    /// Removes and returns the last element from a vector if the predicate
    /// returns `true`, or [`None`] if the predicate returns false or the vector
    /// 为空（在这种情况下不会调用谓词）。
    ///
    /// # 示例
    ///
    /// ```
    /// let mut vec = vec![1, 2, 3, 4];
    /// let pred = |x: &mut i32| *x % 2 == 0;
    ///
    /// assert_eq!(vec.pop_if(pred), Some(4));
    /// assert_eq!(vec, [1, 2, 3]);
    /// assert_eq!(vec.pop_if(pred), None);
    /// ```
    #[stable(feature = "vec_pop_if", since = "1.86.0")]
    pub fn pop_if(&mut self, predicate: impl FnOnce(&mut T) -> bool) -> Option<T> {
        let last = self.last_mut()?;
        if predicate(last) { self.pop() } else { None }
    }

    /// 返回向量中最后一个元素的可修改引用，或者
    /// `None` if it is empty.
    ///
    /// # 示例
    ///
    /// 基本用法：
    ///
    /// ```
    /// #![feature(vec_peek_mut)]
    /// let mut vec = Vec::new();
    /// assert!(vec.peek_mut().is_none());
    ///
    /// vec.push(1);
    /// vec.push(5);
    /// vec.push(2);
    /// assert_eq!(vec.last(), Some(&2));
    /// if let Some(mut val) = vec.peek_mut() {
    ///     *val = 0;
    /// }
    /// assert_eq!(vec.last(), Some(&0));
    /// ```
    #[inline]
    #[unstable(feature = "vec_peek_mut", issue = "122742")]
    pub fn peek_mut(&mut self) -> Option<PeekMut<'_, T, A>>
    where
        A: AllocatorNightly,
    {
        PeekMut::new(self)
    }

    /// Moves all the elements of `other` into `self`, leaving `other` empty.
    ///
    /// # 异常
    ///
    /// Panics if the new capacity exceeds `isize::MAX` _bytes_.
    ///
    /// # 示例
    ///
    /// ```
    /// let mut vec = vec![1, 2, 3];
    /// let mut vec2 = vec![4, 5, 6];
    /// vec.append(&mut vec2);
    /// assert_eq!(vec, [1, 2, 3, 4, 5, 6]);
    /// assert_eq!(vec2, []);
    /// ```
    #[cfg(not(no_global_oom_handling))]
    #[inline]
    #[stable(feature = "append", since = "1.4.0")]
    pub fn append(&mut self, other: &mut Self) {
        // ignore-tidy-undocumented-unsafe
        unsafe {
            self.append_elements(other.as_slice() as _);
            other.set_len(0);
        }
    }

    /// Appends elements to `self` from other buffer.
    #[cfg(not(no_global_oom_handling))]
    #[inline]
    unsafe fn append_elements(&mut self, other: *const [T]) {
        self.reserve(other.len());
        // ignore-tidy-undocumented-unsafe
        unsafe {
            self.append_elements_unreserved(other);
        }
    }

    /// Appends elements to `self` from other buffer, returning [`TryReserveError`] on OOM.
    #[inline]
    unsafe fn try_append_elements(&mut self, other: *const [T]) -> Result<(), TryReserveError> {
        self.try_reserve(other.len())?;
        // ignore-tidy-undocumented-unsafe
        unsafe {
            self.append_elements_unreserved(other);
        }
        Ok(())
    }

    /// Appends elements to `self` from other buffer without reserving additional capacity.
    #[inline]
    unsafe fn append_elements_unreserved(&mut self, other: *const [T]) {
        let count = other.len();
        let len = self.len();
        if count > 0 {
            // ignore-tidy-undocumented-unsafe
            unsafe {
                ptr::copy_nonoverlapping(other as *const T, self.as_mut_ptr().add(len), count)
            };
        }
        self.len += count;
    }

    /// 从向量中移除由给定范围指示的切片，
    /// 返回一个对被移除切片的双端迭代器。
    ///
    /// 如果迭代器在完全消耗前被丢弃，
    /// 则丢弃剩余的被移除元素。
    ///
    /// 返回的迭代器保留对向量的可修改借用，以优化
    /// 其实现。
    ///
    /// # 异常
    ///
    /// Panics if the range has `start_bound > end_bound`, or, if the range is
    /// 在两端有边界且超过向量的长度，则引发异常。
    ///
    /// # 泄漏
    ///
    /// 如果返回的迭代器超出作用域而未被丢弃（例如由于
    /// [`mem::forget`], for example), the vector may have lost and leaked
    /// 元素，包括范围外的元素。
    ///
    /// # 示例
    ///
    /// ```
    /// let mut v = vec![1, 2, 3];
    /// let u: Vec<_> = v.drain(1..).collect();
    /// assert_eq!(v, &[1]);
    /// assert_eq!(u, &[2, 3]);
    ///
    /// // A full range clears the vector, like `clear()` does
    /// v.drain(..);
    /// assert_eq!(v, &[]);
    /// ```
    #[stable(feature = "drain", since = "1.6.0")]
    pub fn drain<R>(&mut self, range: R) -> Drain<'_, T, A>
    where
        A: AllocatorNightly,
        R: RangeBounds<usize>,
    {
        // Memory safety
        //
        // When the Drain is first created, it shortens the length of
        // the source vector to make sure no uninitialized or moved-from elements
        // are accessible at all if the Drain's destructor never gets to run.
        //
        // Drain will ptr::read out the values to remove.
        // When finished, remaining tail of the vec is copied back to cover
        // the hole, and the vector length is restored to the new length.
        //
        let len = self.len();
        let Range { start, end } = slice::range(range, ..len);

        // ignore-tidy-undocumented-unsafe
        unsafe {
            // set self.vec length's to start, to be safe in case Drain is leaked
            self.set_len(start);
            let range_slice = slice::from_raw_parts(self.as_ptr().add(start), end - start);
            Drain {
                tail_start: end,
                tail_len: len - end,
                iter: range_slice.iter(),
                vec: NonNull::from(self),
            }
        }
    }

    /// 清空向量，移除所有值。
    ///
    /// 注意，此方法对向量的分配容量没有影响。
    /// 向量。
    ///
    /// # 示例
    ///
    /// ```
    /// let mut v = vec![1, 2, 3];
    ///
    /// v.clear();
    ///
    /// assert!(v.is_empty());
    /// ```
    #[inline]
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn clear(&mut self) {
        // Though this is equivalent to `truncate(0)`, the manual version
        // optimizes better, justifying the additional complexity
        // (see #96002 and #154095 for context).

        let elems: *mut [T] = self.as_mut_slice();

        // SAFETY:
        // - `elems` comes directly from `as_mut_slice` and is therefore valid.
        // - Setting `self.len` before calling `drop_in_place` means that,
        //   if an element's `Drop` impl panics, the vector's `Drop` impl will
        //   do nothing (leaking the rest of the elements) instead of dropping
        //   some twice.
        unsafe {
            self.len = 0;
            ptr::drop_in_place(elems);
        }
    }

    /// 返回向量中的元素数量，也称为其“长度”。
    /// 。
    ///
    /// # 示例
    ///
    /// ```
    /// let a = vec![1, 2, 3];
    /// assert_eq!(a.len(), 3);
    /// ```
    #[inline]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_vec_string_slice", since = "1.87.0")]
    #[rustc_confusables("length", "size")]
    pub const fn len(&self) -> usize {
        let len = self.len;

        // SAFETY: The maximum capacity of `Vec<T>` is `isize::MAX` bytes, so the maximum value can
        // be returned is `usize::checked_div(size_of::<T>()).unwrap_or(usize::MAX)`, which
        // matches the definition of `T::MAX_SLICE_LEN`.
        unsafe { intrinsics::assume(len <= T::MAX_SLICE_LEN) };

        len
    }

    /// Returns `true` if the vector contains no elements.
    ///
    /// # 示例
    ///
    /// ```
    /// let mut v = Vec::new();
    /// assert!(v.is_empty());
    ///
    /// v.push(1);
    /// assert!(!v.is_empty());
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_diagnostic_item = "vec_is_empty"]
    #[rustc_const_stable(feature = "const_vec_string_slice", since = "1.87.0")]
    pub const fn is_empty(&self) -> bool {
        self.len() == 0
    }

    /// 在给定索引处将集合分为两部分。
    ///
    /// 返回一个新分配的向量，包含范围中的元素
    /// `[at, len)`. After the call, the original vector will be left containing
    /// the elements `[0, at)` with its previous capacity unchanged.
    ///
    /// - If you want to take ownership of the entire contents and capacity of
    ///   the vector, see [`mem::take`] or [`mem::replace`].
    /// - If you don't need the returned vector at all, see [`Vec::truncate`].
    /// - If you want to take ownership of an arbitrary subslice, or you don't
    ///   necessarily want to store the removed items in a vector, see [`Vec::drain`].
    ///
    /// # Panics
    ///
    /// Panics if `at > len`.
    ///
    /// # 示例
    ///
    /// ```
    /// let mut vec = vec!['a', 'b', 'c'];
    /// let vec2 = vec.split_off(1);
    /// assert_eq!(vec, ['a']);
    /// assert_eq!(vec2, ['b', 'c']);
    /// ```
    #[cfg(not(no_global_oom_handling))]
    #[inline]
    #[must_use = "use `.truncate()` if you don't need the other half"]
    #[stable(feature = "split_off", since = "1.4.0")]
    #[track_caller]
    pub fn split_off(&mut self, at: usize) -> Self
    where
        A: Clone,
    {
        #[cold]
        #[cfg_attr(not(panic = "immediate-abort"), inline(never))]
        #[track_caller]
        #[optimize(size)]
        fn assert_failed(at: usize, len: usize) -> ! {
            panic!("`at` split index (is {at}) should be <= len (is {len})");
        }

        if at > self.len() {
            assert_failed(at, self.len());
        }

        let other_len = self.len - at;
        let mut other = Vec::with_capacity_in(other_len, self.allocator().clone());

        // Unsafely `set_len` and copy items to `other`.
        // ignore-tidy-undocumented-unsafe
        unsafe {
            self.set_len(at);
            other.set_len(other_len);

            ptr::copy_nonoverlapping(self.as_ptr().add(at), other.as_mut_ptr(), other.len());
        }
        other
    }

    /// Resizes the `Vec` in-place so that `len` is equal to `new_len`.
    ///
    /// If `new_len` is greater than `len`, the `Vec` is extended by the
    /// difference, with each additional slot filled with the result of
    /// calling the closure `f`. The return values from `f` will end up
    /// in the `Vec` in the order they have been generated.
    ///
    /// If `new_len` is less than or equal to `len`, the `Vec` is simply
    /// 截断。
    ///
    /// 该方法使用闭包在每次推送时创建新值。如果
    /// you'd rather [`Clone`] a given value, use [`Vec::resize`]. If you
    /// want to use the [`Default`] trait to generate values, you can
    /// pass [`Default::default`] as the second argument.
    ///
    /// # Panics
    ///
    /// Panics if the new capacity exceeds `isize::MAX` _bytes_.
    ///
    /// # Examples
    ///
    /// ```
    /// let mut vec = vec![1, 2, 3];
    /// vec.resize_with(5, Default::default);
    /// assert_eq!(vec, [1, 2, 3, 0, 0]);
    ///
    /// let mut vec = vec![];
    /// let mut p = 1;
    /// vec.resize_with(4, || { p *= 2; p });
    /// assert_eq!(vec, [2, 4, 8, 16]);
    /// ```
    #[cfg(not(no_global_oom_handling))]
    #[stable(feature = "vec_resize_with", since = "1.33.0")]
    pub fn resize_with<F>(&mut self, new_len: usize, f: F)
    where
        F: FnMut() -> T,
    {
        let len = self.len();
        if new_len > len {
            self.extend_trusted(iter::repeat_with(f).take(new_len - len));
        } else {
            self.truncate(new_len);
        }
    }

    /// Consumes and leaks the `Vec`, returning a mutable reference to the contents,
    /// `&'a mut [T]`.
    ///
    /// Note that the type `T` must outlive the chosen lifetime `'a`. If the type
    /// 只有静态引用，或根本没有引用，则可以选择这种方式。
    /// `'static`.
    ///
    /// As of Rust 1.57, this method does not reallocate or shrink the `Vec`,
    /// 因此泄露的分配可能包含未使用的容量，这些容量并不属于
    /// 返回的切片。
    ///
    /// 此函数主要用于在程序剩余生命周期内存在的数据。丢弃返回的引用会导致内存
    /// 泄露。
    /// # Examples
    ///
    /// # Examples
    ///
    /// 简单用法：
    ///
    /// ```
    /// let x = vec![1, 2, 3];
    /// let static_ref: &'static mut [usize] = x.leak();
    /// static_ref[0] += 1;
    /// assert_eq!(static_ref, &[2, 2, 3]);
    /// # // FIXME(https://github.com/rust-lang/miri/issues/3670):
    /// # // use -Zmiri-disable-leak-check instead of unleaking in tests meant to leak.
    /// # drop(unsafe { Box::from_raw(static_ref) });
    /// ```
    #[stable(feature = "vec_leak", since = "1.47.0")]
    #[inline]
    pub fn leak<'a>(self) -> &'a mut [T]
    where
        A: 'a,
    {
        let mut me = ManuallyDrop::new(self);
        // ignore-tidy-undocumented-unsafe
        unsafe { slice::from_raw_parts_mut(me.as_mut_ptr(), me.len) }
    }

    /// 返回向量的剩余空闲容量作为切片
    /// `MaybeUninit<T>`.
    ///
    /// 返回的切片可用于用数据填充向量（例如从文件读取），然后使用
    /// reading from a file) before marking the data as initialized using the
    /// [`set_len`] method.
    ///
    /// [`set_len`]: Vec::set_len
    ///
    /// # Examples
    ///
    /// ```
    /// // Allocate vector big enough for 10 elements.
    /// let mut v = Vec::with_capacity(10);
    ///
    /// // Fill in the first 3 elements.
    /// let uninit = v.spare_capacity_mut();
    /// uninit[0].write(0);
    /// uninit[1].write(1);
    /// uninit[2].write(2);
    ///
    /// // Mark the first 3 elements of the vector as being initialized.
    /// unsafe {
    ///     v.set_len(3);
    /// }
    ///
    /// assert_eq!(&v, &[0, 1, 2]);
    /// ```
    #[stable(feature = "vec_spare_capacity", since = "1.60.0")]
    #[rustc_const_unstable(feature = "const_heap", issue = "79597")]
    #[inline]
    pub const fn spare_capacity_mut(&mut self) -> &mut [MaybeUninit<T>] {
        // Note:
        // This method is not implemented in terms of `split_at_spare_mut`,
        // to prevent invalidation of pointers to the buffer.
        // ignore-tidy-undocumented-unsafe
        unsafe {
            slice::from_raw_parts_mut(
                self.as_mut_ptr().add(self.len) as *mut MaybeUninit<T>,
                self.buf.capacity() - self.len,
            )
        }
    }

    /// Returns vector content as a slice of `T`, along with the remaining spare
    /// capacity of the vector as a slice of `MaybeUninit<T>`.
    ///
    /// The returned spare capacity slice can be used to fill the vector with data
    /// (e.g. by reading from a file) before marking the data as initialized using
    /// the [`set_len`] method.
    ///
    /// [`set_len`]: Vec::set_len
    ///
    /// Note that this is a low-level API, which should be used with care for
    /// optimization purposes. If you need to append data to a `Vec`
    /// you can use [`push`], [`extend`], [`extend_from_slice`],
    /// [`extend_from_within`], [`insert`], [`append`], [`resize`] or
    /// [`resize_with`], depending on your exact needs.
    ///
    /// [`push`]: Vec::push
    /// [`extend`]: Vec::extend
    /// [`extend_from_slice`]: Vec::extend_from_slice
    /// [`extend_from_within`]: Vec::extend_from_within
    /// [`insert`]: Vec::insert
    /// [`append`]: Vec::append
    /// [`resize`]: Vec::resize
    /// [`resize_with`]: Vec::resize_with
    ///
    /// # Examples
    ///
    /// ```
    /// #![feature(vec_split_at_spare)]
    ///
    /// let mut v = vec![1, 1, 2];
    ///
    /// // Reserve additional space big enough for 10 elements.
    /// v.reserve(10);
    ///
    /// let (init, uninit) = v.split_at_spare_mut();
    /// let sum = init.iter().copied().sum::<u32>();
    ///
    /// // Fill in the next 4 elements.
    /// uninit[0].write(sum);
    /// uninit[1].write(sum * 2);
    /// uninit[2].write(sum * 3);
    /// uninit[3].write(sum * 4);
    ///
    /// // Mark the 4 elements of the vector as being initialized.
    /// unsafe {
    ///     let len = v.len();
    ///     v.set_len(len + 4);
    /// }
    ///
    /// assert_eq!(&v, &[1, 1, 2, 4, 8, 12, 16]);
    /// ```
    #[unstable(feature = "vec_split_at_spare", issue = "81944")]
    #[rustc_const_unstable(feature = "const_heap", issue = "79597")]
    #[inline]
    pub const fn split_at_spare_mut(&mut self) -> (&mut [T], &mut [MaybeUninit<T>]) {
        // SAFETY:
        // - len is ignored and so never changed
        let (init, spare, _) = unsafe { self.split_at_spare_mut_with_len() };
        (init, spare)
    }

    /// Safety: changing returned .2 (&mut usize) is considered the same as calling `.set_len(_)`.
    ///
    /// This method provides unique access to all vec parts at once in `extend_from_within`.
    const unsafe fn split_at_spare_mut_with_len(
        &mut self,
    ) -> (&mut [T], &mut [MaybeUninit<T>], &mut usize) {
        let ptr = self.as_mut_ptr();
        // SAFETY:
        // - `ptr` is guaranteed to be valid for `self.len` elements
        // - but the allocation extends out to `self.buf.capacity()` elements, possibly
        // uninitialized
        let spare_ptr = unsafe { ptr.add(self.len) };
        let spare_ptr = spare_ptr.cast_uninit();
        let spare_len = self.buf.capacity() - self.len;

        // SAFETY:
        // - `ptr` is guaranteed to be valid for `self.len` elements
        // - `spare_ptr` is pointing one element past the buffer, so it doesn't overlap with `initialized`
        unsafe {
            let initialized = slice::from_raw_parts_mut(ptr, self.len);
            let spare = slice::from_raw_parts_mut(spare_ptr, spare_len);

            (initialized, spare, &mut self.len)
        }
    }

    /// Groups every `N` elements in the `Vec<T>` into chunks to produce a `Vec<[T; N]>`, dropping
    /// elements in the remainder. `N` must be greater than zero.
    ///
    /// 如果容量不是块大小的倍数，缓冲区将缩小到
    /// 具有重新分配或释放功能的最近的倍数。
    ///
    /// This function can be used to reverse [`Vec::into_flattened`].
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(vec_into_chunks)]
    ///
    /// let vec = vec![0, 1, 2, 3, 4, 5, 6, 7];
    /// assert_eq!(vec.into_chunks::<3>(), [[0, 1, 2], [3, 4, 5]]);
    ///
    /// let vec = vec![0, 1, 2, 3];
    /// let chunks: Vec<[u8; 10]> = vec.into_chunks();
    /// assert!(chunks.is_empty());
    ///
    /// let flat = vec![0; 8 * 8 * 8];
    /// let reshaped: Vec<[[[u8; 8]; 8]; 8]> = flat.into_chunks().into_chunks().into_chunks();
    /// assert_eq!(reshaped.len(), 1);
    /// ```
    #[cfg(not(no_global_oom_handling))]
    #[unstable(feature = "vec_into_chunks", issue = "142137")]
    pub fn into_chunks<const N: usize>(mut self) -> Vec<[T; N], A> {
        const {
            assert!(N != 0, "chunk size must be greater than zero");
        }

        let (len, cap) = (self.len(), self.capacity());

        let len_remainder = len % N;
        if len_remainder != 0 {
            self.truncate(len - len_remainder);
        }

        let cap_remainder = cap % N;
        if !T::IS_ZST && cap_remainder != 0 {
            self.buf.shrink_to_fit(cap - cap_remainder);
        }

        let (ptr, _, _, alloc) = self.into_raw_parts_with_allocator();

        // SAFETY:
        // - `ptr` and `alloc` were just returned from `self.into_raw_parts_with_allocator()`
        // - `[T; N]` has the same alignment as `T`
        // - `size_of::<[T; N]>() * cap / N == size_of::<T>() * cap`
        // - `len / N <= cap / N` because `len <= cap`
        // - the allocated memory consists of `len / N` valid values of type `[T; N]`
        // - `cap / N` fits the size of the allocated memory after shrinking
        unsafe { Vec::from_raw_parts_in(ptr.cast(), len / N, cap / N, alloc) }
    }

    /// This clears out this `Vec` and recycles the allocation into a new `Vec`.
    /// The item type of the resulting `Vec` needs to have the same size and
    /// alignment as the item type of the original `Vec`.
    ///
    /// # 示例
    ///
    ///  ```
    /// #![feature(vec_recycle, transmutability)]
    /// let a: Vec<u8> = vec![0; 100];
    /// let capacity = a.capacity();
    /// let addr = a.as_ptr().addr();
    /// let b: Vec<i8> = a.recycle();
    /// assert_eq!(b.len(), 0);
    /// assert_eq!(b.capacity(), capacity);
    /// assert_eq!(b.as_ptr().addr(), addr);
    /// ```
    ///
    /// The `Recyclable` bound prevents this method from being called when `T` and `U` have different sizes; e.g.:
    ///
    ///  ```compile_fail,E0277
    /// #![feature(vec_recycle, transmutability)]
    /// let vec: Vec<[u8; 2]> = Vec::new();
    /// let _: Vec<[u8; 1]> = vec.recycle();
    /// ```
    /// ...或者对齐方式不同：
    ///
    ///  ```compile_fail,E0277
    /// #![feature(vec_recycle, transmutability)]
    /// let vec: Vec<[u16; 0]> = Vec::new();
    /// let _: Vec<[u8; 0]> = vec.recycle();
    /// ```
    ///
    /// However, due to temporary implementation limitations of `Recyclable`,
    /// this method is not yet callable when `T` or `U` are slices, trait objects,
    /// or other exotic types; e.g.:
    ///
    /// ```compile_fail,E0277
    /// #![feature(vec_recycle, transmutability)]
    /// # let inputs = ["a b c", "d e f"];
    /// # fn process(_: &[&str]) {}
    /// let mut storage: Vec<&[&str]> = Vec::new();
    ///
    /// for input in inputs {
    ///     let mut buffer: Vec<&str> = storage.recycle();
    ///     buffer.extend(input.split(" "));
    ///     process(&buffer);
    ///     storage = buffer.recycle();
    /// }
    /// ```
    #[unstable(feature = "vec_recycle", issue = "148227")]
    #[expect(private_bounds)]
    pub fn recycle<U>(mut self) -> Vec<U, A>
    where
        U: Recyclable<T>,
    {
        self.clear();
        const {
            // FIXME(const-hack, 146097): compare `Layout`s
            assert!(size_of::<T>() == size_of::<U>());
            assert!(align_of::<T>() == align_of::<U>());
        };
        let (ptr, length, capacity, alloc) = self.into_parts_with_allocator();
        debug_assert_eq!(length, 0);
        // SAFETY:
        // - `ptr` and `alloc` were just returned from `self.into_raw_parts_with_allocator()`
        // - `T` & `U` have the same layout, so `capacity` does not need to be changed and we can safely use `alloc.dealloc` later
        // - the original vector was cleared, so there is no problem with "transmuting" the stored values
        unsafe { Vec::from_parts_in(ptr.cast::<U>(), length, capacity, alloc) }
    }
}

/// Denotes that an allocation of `From` can be recycled into an allocation of `Self`.
///
/// # Safety
///
/// `Self` is `Recyclable<From>` if `Layout::new::<Self>() == Layout::new::<From>()`.
unsafe trait Recyclable<From: Sized>: Sized {}

#[unstable_feature_bound(transmutability)]
// SAFETY: enforced by `TransmuteFrom`
unsafe impl<From, To> Recyclable<From> for To
where
    for<'a> &'a MaybeUninit<To>: TransmuteFrom<&'a MaybeUninit<From>, { Assume::SAFETY }>,
    for<'a> &'a MaybeUninit<From>: TransmuteFrom<&'a MaybeUninit<To>, { Assume::SAFETY }>,
{
}

impl<T: Clone> Vec<T, Global> {
    /// Create a new `Vec` that contains `elem` `n` times.
    ///
    /// This method requires `T` to implement [`Clone`],
    /// in order to be able to clone the passed value.
    ///
    /// If `n` is zero, the vector will not allocate.
    ///
    /// # Panics
    ///
    /// Panics if `size_of::<T>() * n` exceeds `isize::MAX` bytes.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(vec_repeat)]
    /// let vec = Vec::repeat(0, 3);
    /// assert_eq!(vec, [0; 3]);
    /// ```
    #[cfg(not(no_global_oom_handling))]
    #[unstable(feature = "vec_repeat", issue = "164215")]
    #[inline]
    pub fn repeat(elem: T, n: usize) -> Self {
        <T as SpecFromElem>::from_elem(elem, n, Global)
    }
}

impl<T: Clone, A: Allocator> Vec<T, A> {
    /// Create a new `Vec` with the provided allocator that contains `elem` `n` times.
    ///
    /// This method requires `T` to implement [`Clone`],
    /// 以便能够克隆传递的值。
    ///
    /// If `n` is zero, the vector will not allocate.
    ///
    /// # 异常
    ///
    /// Panics if `size_of::<T>() * n` exceeds `isize::MAX` bytes.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(vec_repeat)]
    /// use std::alloc::System;
    ///
    /// let vec = Vec::repeat_in(0, 3, System);
    /// assert_eq!(vec, [0; 3]);
    /// ```
    #[cfg(not(no_global_oom_handling))]
    #[unstable(feature = "vec_repeat", issue = "164215")]
    #[inline]
    pub fn repeat_in(elem: T, n: usize, alloc: A) -> Self {
        <T as SpecFromElem>::from_elem(elem, n, alloc)
    }

    /// Resizes the `Vec` in-place so that `len` is equal to `new_len`.
    ///
    /// If `new_len` is greater than `len`, the `Vec` is extended by the
    /// difference, with each additional slot filled with `value`.
    /// If `new_len` is less than or equal to `len`, the `Vec` is simply
    /// 以便能够克隆传递的值。
    ///
    /// This method requires `T` to implement [`Clone`],
    /// 以便能够克隆传递的值。
    /// If you need more flexibility (or want to rely on [`Default`] instead of
    /// [`Clone`]), use [`Vec::resize_with`].
    /// If you only need to resize to a smaller size, use [`Vec::truncate`].
    ///
    /// # 异常
    ///
    /// Panics if the new capacity exceeds `isize::MAX` _bytes_.
    ///
    /// # 示例
    ///
    /// ```
    /// let mut vec = vec!["hello"];
    /// vec.resize(3, "world");
    /// assert_eq!(vec, ["hello", "world", "world"]);
    ///
    /// let mut vec = vec!['a', 'b', 'c', 'd'];
    /// vec.resize(2, '_');
    /// assert_eq!(vec, ['a', 'b']);
    /// ```
    #[cfg(not(no_global_oom_handling))]
    #[stable(feature = "vec_resize", since = "1.5.0")]
    pub fn resize(&mut self, new_len: usize, value: T) {
        let len = self.len();

        if new_len > len {
            self.extend_with(new_len - len, value)
        } else {
            self.truncate(new_len);
        }
    }

    /// Clones and appends all elements in a slice to the `Vec`.
    ///
    /// Iterates over the slice `other`, clones each element, and then appends
    /// it to this `Vec`. The `other` slice is traversed in-order.
    ///
    /// Note that this function is the same as [`extend`],
    /// except that it also works with slice elements that are Clone but not Copy.
    /// 如果 Rust 实现特定化，此函数可能会被弃用。
    ///
    /// # 异常
    ///
    /// Panics if the new capacity exceeds `isize::MAX` _bytes_.
    ///
    /// # 示例
    ///
    /// ```
    /// let mut vec = vec![1];
    /// vec.extend_from_slice(&[2, 3, 4]);
    /// assert_eq!(vec, [1, 2, 3, 4]);
    /// ```
    ///
    /// [`extend`]: Vec::extend
    #[cfg(not(no_global_oom_handling))]
    #[stable(feature = "vec_extend_from_slice", since = "1.6.0")]
    pub fn extend_from_slice(&mut self, other: &[T]) {
        self.spec_extend(other.iter())
    }

    /// Given a range `src`, clones a slice of elements in that range and appends it to the end.
    ///
    /// `src` must be a range that can form a valid subslice of the `Vec`.
    ///
    /// # 异常
    ///
    /// 如果起始索引大于结束索引，或者索引
    /// 大于向量的长度，或者新容量超过
    /// `isize::MAX` _bytes_.
    ///
    /// # 示例
    ///
    /// ```
    /// let mut characters = vec!['a', 'b', 'c', 'd', 'e'];
    /// characters.extend_from_within(2..);
    /// assert_eq!(characters, ['a', 'b', 'c', 'd', 'e', 'c', 'd', 'e']);
    ///
    /// let mut numbers = vec![0, 1, 2, 3, 4];
    /// numbers.extend_from_within(..2);
    /// assert_eq!(numbers, [0, 1, 2, 3, 4, 0, 1]);
    ///
    /// let mut strings = vec![String::from("hello"), String::from("world"), String::from("!")];
    /// strings.extend_from_within(1..=2);
    /// assert_eq!(strings, ["hello", "world", "!", "world", "!"]);
    /// ```
    #[cfg(not(no_global_oom_handling))]
    #[stable(feature = "vec_extend_from_within", since = "1.53.0")]
    pub fn extend_from_within<R>(&mut self, src: R)
    where
        R: RangeBounds<usize>,
    {
        let range = slice::range(src, ..self.len());
        self.reserve(range.len());

        // SAFETY:
        // - `slice::range` guarantees that the given range is valid for indexing self
        unsafe {
            self.spec_extend_from_within(range);
        }
    }
}

impl<A: Allocator> Vec<u8, A> {
    #[cfg_attr(
        not(no_global_oom_handling),
        expect(
            dead_code,
            reason = "currently only used in IO module when global OOM handling is disabled"
        )
    )]
    pub(crate) fn try_extend_from_slice_of_bytes(
        &mut self,
        other: &[u8],
    ) -> Result<(), TryReserveError> {
        // ignore-tidy-undocumented-unsafe
        unsafe { self.try_append_elements(other) }
    }
}

impl<T, A: Allocator, const N: usize> Vec<[T; N], A> {
    /// Takes a `Vec<[T; N]>` and flattens it into a `Vec<T>`.
    ///
    /// # 异常
    ///
    /// Panics if the length of the resulting vector would overflow a `usize`.
    ///
    /// 这仅在展平零尺寸数组类型的向量时可能实现，因此在实际中通常无关紧要。如果
    /// types, and thus tends to be irrelevant in practice. If
    /// `size_of::<T>() > 0`, this will never panic.
    ///
    /// # Examples
    ///
    /// ```
    /// let mut vec = vec![[1, 2, 3], [4, 5, 6], [7, 8, 9]];
    /// assert_eq!(vec.pop(), Some([7, 8, 9]));
    ///
    /// let mut flattened = vec.into_flattened();
    /// assert_eq!(flattened.pop(), Some(6));
    /// ```
    #[stable(feature = "slice_flatten", since = "1.80.0")]
    pub fn into_flattened(self) -> Vec<T, A> {
        let (ptr, len, cap, alloc) = self.into_raw_parts_with_allocator();
        let (new_len, new_cap) = if T::IS_ZST {
            (
                len.checked_mul(N).expect("the product of vec len and N shouldn't overflow"),
                usize::MAX,
            )
        } else {
            // SAFETY:
            // - `cap * N` cannot overflow because the allocation is already in
            // the address space.
            // - Each `[T; N]` has `N` valid elements, so there are `len * N`
            // valid elements in the allocation.
            unsafe { (len.unchecked_mul(N), cap.unchecked_mul(N)) }
        };
        // SAFETY:
        // - `ptr` was allocated by `self`
        // - `ptr` is well-aligned because `[T; N]` has the same alignment as `T`.
        // - `new_cap` refers to the same sized allocation as `cap` because
        // `new_cap * size_of::<T>()` == `cap * size_of::<[T; N]>()`
        // - `len` <= `cap`, so `len * N` <= `cap * N`.
        unsafe { Vec::<T, A>::from_raw_parts_in(ptr.cast(), new_len, new_cap, alloc) }
    }
}

impl<T: Clone, A: Allocator> Vec<T, A> {
    #[cfg(not(no_global_oom_handling))]
    /// Extend the vector by `n` clones of value.
    fn extend_with(&mut self, n: usize, value: T) {
        self.spec_extend_with(n, value);
    }
}

impl<T: PartialEq, A: Allocator> Vec<T, A> {
    /// 如果向量已排序，则移除所有重复元素。
    /// [`PartialEq`] trait implementation.
    ///
    /// 如果向量已排序，则移除所有重复元素。
    ///
    /// # 示例
    ///
    /// ```
    /// let mut vec = vec![1, 2, 2, 3, 2];
    ///
    /// vec.dedup();
    ///
    /// assert_eq!(vec, [1, 2, 3, 2]);
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    pub fn dedup(&mut self) {
        // Vectorize the process of finding first duplicate if possible
        if let Some(chunk_size) = dedup_simd_chunk_size::<T>() {
            // Unlike dedup_by, we don't guarantee the order
            // and time in which we call `PartialEq::eq`.
            let Some(first_duplicate) = find_first_duplicate(self.as_slice(), chunk_size) else {
                return;
            };

            // SAFETY: `1 <= first_duplicate < self.len()`
            unsafe {
                self.dedup_tail(|a, b| a == b, first_duplicate);
            }
        } else {
            self.dedup_by(|a, b| a == b);
        }
    }
}

const fn dedup_simd_chunk_size<T>() -> Option<usize> {
    // The minimal SIMD width on supported platforms
    #[allow(unused)]
    const SIMD_WIDTH: usize = 16;
    let size = size_of::<T>();

    // We only have SIMD implementations for these element sizes.
    if !matches!(size, 1 | 2 | 4 | 8) {
        return None;
    }

    let simd_width: Option<usize> = cfg_select! {
        all(target_arch = "arm", target_feature = "neon") => {
            // Packed 64-bit integer lane equality is unavailable on arm neon
            if size == 8 { None } else { Some(SIMD_WIDTH) }
        }

        all(target_arch = "aarch64", target_feature = "neon") => Some(SIMD_WIDTH),

        all(any(target_arch = "x86", target_arch = "x86_64"), target_feature = "sse4.1") => {
            Some(SIMD_WIDTH)
        }

        all(any(target_arch = "x86", target_arch = "x86_64"), target_feature = "sse2") => {
            // Packed 64-bit integer lane equality is only available on sse4.1
            if size == 8 { None } else { Some(SIMD_WIDTH) }
        }

        all(any(target_arch = "riscv32", target_arch = "riscv64"), target_feature = "v") => {
            Some(SIMD_WIDTH)
        }

        all(any(target_arch = "loongarch32", target_arch = "loongarch64"), target_feature = "lsx") => {
            Some(SIMD_WIDTH)
        }

        _ => None,
    };

    if let Some(simd_width) = simd_width { Some(simd_width * 2 / size) } else { None }
}

fn find_first_duplicate<T: PartialEq>(v: &[T], chunk_size: usize) -> Option<usize> {
    let len = v.len();
    if len <= 1 {
        return None;
    }

    let mut i = 1;

    // The scalar fallback path if the length is not long enough
    if len < chunk_size + 1 {
        while i < len {
            // It keeps the same comparison order as `dedup_tail`
            //
            // SAFETY: i always in range [1..len)
            if unsafe { v.get_unchecked(i) == v.get_unchecked(i - 1) } {
                return Some(i);
            }
            i += 1;
        }
        return None;
    }

    /// # 安全性
    /// - `start > 0` and `start + chunk_size <= v.len()`
    /// - `0 < chunk_size <= 32`
    #[inline(always)]
    unsafe fn find_duplicate<T: PartialEq>(
        v: &[T],
        start: usize,
        chunk_size: usize,
    ) -> Option<usize> {
        let mut mask: u32 = 0;
        debug_assert!(
            u32::BITS as usize >= chunk_size,
            "the bit width of mask must be greater than or equal to chunk_size"
        );
        for j in 0..chunk_size {
            // SAFETY: start + j always in range [1..v.len())
            let eq = unsafe { v.get_unchecked(start + j) == v.get_unchecked(start + j - 1) };
            mask |= (eq as u32) << j;
        }
        if mask != 0 {
            return Some(start + mask.trailing_zeros() as usize);
        }
        None
    }

    // This loop performs chunk_size comparisons in parallel without early exit,
    // which is what allows for SIMD optimization.
    while i + chunk_size <= len {
        // SAFETY: `i >= 1` and `i + chunk_size <= len`
        if let Some(duplicate) = unsafe { find_duplicate(v, i, chunk_size) } {
            return Some(duplicate);
        }
        i += chunk_size;
    }

    // This may check the same elements multiple times.
    // However we don't guarantee `PartialEq::eq` is only called once per pair.
    if i < len {
        let start = len - chunk_size;
        // SAFETY: `len - chunk_size >= 1` and `start + chunk_size <= len`
        if let Some(duplicate) = unsafe { find_duplicate(v, start, chunk_size) } {
            return Some(duplicate);
        }
    }

    None
}

////////////////////////////////////////////////////////////////////////////////
// Internal methods and functions
////////////////////////////////////////////////////////////////////////////////

// This function is no longer used internally (`from_elem_global` is used instead).
// It is only kept so as not to break a few crates who mistakenly used it at a
// time when we didn't have the ability to gate internal methods used by public macros.
#[doc(hidden)]
#[cfg(not(no_global_oom_handling))]
#[stable(feature = "rust1", since = "1.0.0")]
// NOTE: the real deprecation version is the same as the stabilization version.
// I.e. it should never have been used even in version 1.0.
#[deprecated(since = "1.101.0", note = "use the `vec!` macro instead")]
pub fn from_elem<T: Clone>(elem: T, n: usize) -> Vec<T> {
    vec![elem; n]
}

// This function is required because it ensures the `vec_from_elem` diagnostic
// item is emitted, which is consumed by Clippy to detect calls to
// `vec![elem; n]`. We cannot add the item to `Vec::repeat` because then we
// would end up confusing Clippy.
#[doc(hidden)]
#[cfg(not(no_global_oom_handling))]
#[unstable(feature = "liballoc_internals", issue = "none")]
#[rustc_diagnostic_item = "vec_from_elem"]
pub fn from_elem_global<T: Clone>(elem: T, n: usize) -> Vec<T> {
    Vec::repeat(elem, n)
}

#[cfg(not(no_global_oom_handling))]
trait ExtendFromWithinSpec {
    /// # 安全性
    ///
    /// - `src` needs to be valid index
    /// - `self.capacity() - self.len()` must be `>= src.len()`
    unsafe fn spec_extend_from_within(&mut self, src: Range<usize>);
}

#[cfg(not(no_global_oom_handling))]
impl<T: Clone, A: Allocator> ExtendFromWithinSpec for Vec<T, A> {
    default unsafe fn spec_extend_from_within(&mut self, src: Range<usize>) {
        // SAFETY:
        // - len is increased only after initializing elements
        let (this, spare, len) = unsafe { self.split_at_spare_mut_with_len() };

        // SAFETY:
        // - caller guarantees that src is a valid index
        let to_clone = unsafe { this.get_unchecked(src) };

        iter::zip(to_clone, spare)
            .map(|(src, dst)| dst.write(src.clone()))
            // Note:
            // - Element was just initialized with `MaybeUninit::write`, so it's ok to increase len
            // - len is increased after each element to prevent leaks (see issue #82533)
            .for_each(|_| *len += 1);
    }
}

#[cfg(not(no_global_oom_handling))]
impl<T: TrivialClone, A: Allocator> ExtendFromWithinSpec for Vec<T, A> {
    unsafe fn spec_extend_from_within(&mut self, src: Range<usize>) {
        let count = src.len();
        {
            let (init, spare) = self.split_at_spare_mut();

            // SAFETY:
            // - caller guarantees that `src` is a valid index
            let source = unsafe { init.get_unchecked(src) };

            // SAFETY:
            // - Both pointers are created from unique slice references (`&mut [_]`)
            //   so they are valid and do not overlap.
            // - Elements implement `TrivialClone` so this is equivalent to calling
            //   `clone` on every one of them.
            // - `count` is equal to the len of `source`, so source is valid for
            //   `count` reads
            // - `.reserve(count)` guarantees that `spare.len() >= count` so spare
            //   is valid for `count` writes
            unsafe { ptr::copy_nonoverlapping(source.as_ptr(), spare.as_mut_ptr() as _, count) };
        }

        // SAFETY:
        // - The elements were just initialized by `copy_nonoverlapping`
        self.len += count;
    }
}

////////////////////////////////////////////////////////////////////////////////
// Common trait implementations for Vec
////////////////////////////////////////////////////////////////////////////////

#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_const_unstable(feature = "const_convert", issue = "143773")]
const impl<T, A: Allocator> ops::Deref for Vec<T, A> {
    type Target = [T];

    #[inline]
    fn deref(&self) -> &[T] {
        self.as_slice()
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_const_unstable(feature = "const_convert", issue = "143773")]
const impl<T, A: Allocator> ops::DerefMut for Vec<T, A> {
    #[inline]
    fn deref_mut(&mut self) -> &mut [T] {
        self.as_mut_slice()
    }
}

#[unstable(feature = "deref_pure_trait", issue = "87121")]
unsafe impl<T, A: Allocator> ops::DerefPure for Vec<T, A> {}

#[cfg(not(no_global_oom_handling))]
#[stable(feature = "rust1", since = "1.0.0")]
impl<T: Clone, A: Allocator + Clone> Clone for Vec<T, A> {
    /// Creates a new `Vec` by deep-copying the contents of an existing `Vec`.
    ///
    /// This method will allocate a new `Vec` and `clone` all of `self`'s contents
    /// into it. The capacity of the duplicate `Vec` is not forced to match the
    /// 原始向量的容量一致。
    fn clone(&self) -> Self {
        let alloc = self.allocator().clone();
        <[T]>::to_vec_in(self, alloc)
    }

    /// Overwrites the contents of `self` with a clone of the contents of `source`.
    ///
    /// This method is preferred over simply assigning `source.clone()` to `self`,
    /// 因为尽可能避免重新分配。此外，如果元素类型
    /// `T` overrides `clone_from()`, this will reuse the resources of `self`'s
    /// 元素资源。
    ///
    /// # 示例
    ///
    /// ```
    /// let x = vec![5, 6, 7];
    /// let mut y = vec![8, 9, 10];
    /// let yp: *const i32 = y.as_ptr();
    ///
    /// y.clone_from(&x);
    ///
    /// // The value is the same
    /// assert_eq!(x, y);
    ///
    /// // And no reallocation occurred
    /// assert_eq!(yp, y.as_ptr());
    /// ```
    fn clone_from(&mut self, source: &Self) {
        crate::slice::SpecCloneIntoVec::clone_into(source.as_slice(), self);
    }
}

/// 向量的哈希值与对应的切片相同，
/// as required by the `core::borrow::Borrow` implementation.
///
/// ```
/// use std::hash::BuildHasher;
///
/// let b = std::hash::RandomState::new();
/// let v: Vec<u8> = vec![0xa8, 0x3c, 0x09];
/// let s: &[u8] = &[0xa8, 0x3c, 0x09];
/// assert_eq!(b.hash_one(v), b.hash_one(s));
/// ```
#[stable(feature = "rust1", since = "1.0.0")]
impl<T: Hash, A: Allocator> Hash for Vec<T, A> {
    #[inline]
    fn hash<H: Hasher>(&self, state: &mut H) {
        Hash::hash(&**self, state)
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_const_unstable(feature = "const_index", issue = "143775")]
const impl<T, I: [const] SliceIndex<[T]>, A: Allocator> Index<I> for Vec<T, A> {
    type Output = I::Output;

    #[inline]
    fn index(&self, index: I) -> &Self::Output {
        Index::index(&**self, index)
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_const_unstable(feature = "const_index", issue = "143775")]
const impl<T, I: [const] SliceIndex<[T]>, A: Allocator> IndexMut<I> for Vec<T, A> {
    #[inline]
    fn index_mut(&mut self, index: I) -> &mut Self::Output {
        IndexMut::index_mut(&mut **self, index)
    }
}

/// Collects an iterator into a Vec, commonly called via [`Iterator::collect()`]
///
/// # 分配行为
///
/// In general `Vec` does not guarantee any particular growth or allocation strategy.
/// 此 trait 实现也适用。
///
/// **注意：** 本节涵盖实现细节，因此不受稳定性保证约束。
/// Vec 可能使用以下策略中的任意一种或都不使用，
///
/// 取决于提供的迭代器：
/// depending on the supplied iterator:
///
/// * preallocate based on [`Iterator::size_hint()`]
/// * and panic if the number of items is outside the provided lower/upper bounds
/// * use an amortized growth strategy similar to `pushing` one item at a time
/// * 在迭代器所依赖的原始分配空间上直接进行迭代操作
///
/// 最后一种情况需要特别注意。这是一种优化手段，在许多情况下可以减少内存峰值
/// 消耗，并改善缓存局部性。但当创建大量短寿命分配时，
/// 只有一小部分元素被收集起来，而剩余容量未被进一步利用
/// and the resulting `Vec` is moved into a longer-lived structure, then this can lead to the large
/// 分配的生命周期被不必要的延长，从而导致内存占用增加
/// footprint.
///
/// In cases where this is an issue, the excess capacity can be discarded with [`Vec::shrink_to()`],
/// [`Vec::shrink_to_fit()`] or by collecting into [`Box<[T]>`][owned slice] instead, which additionally reduces
/// 长生命周期结构的大小。
///
/// [owned slice]: Box
///
/// ```rust
/// # use std::sync::Mutex;
/// static LONG_LIVED: Mutex<Vec<Vec<u16>>> = Mutex::new(Vec::new());
///
/// for i in 0..10 {
///     let big_temporary: Vec<u16> = (0..1024).collect();
///     // discard most items
///     let mut result: Vec<_> = big_temporary.into_iter().filter(|i| i % 100 == 0).collect();
///     // without this a lot of unused capacity might be moved into the global
///     result.shrink_to_fit();
///     LONG_LIVED.lock().unwrap().push(result);
/// }
/// ```
#[cfg(not(no_global_oom_handling))]
#[stable(feature = "rust1", since = "1.0.0")]
impl<T> FromIterator<T> for Vec<T> {
    #[inline]
    fn from_iter<I: IntoIterator<Item = T>>(iter: I) -> Vec<T> {
        <Self as SpecFromIter<T, I::IntoIter>>::from_iter(iter.into_iter())
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T, A: Allocator> IntoIterator for Vec<T, A> {
    type Item = T;
    type IntoIter = IntoIter<T, A>;

    /// 创建一个消耗型迭代器，即一个将每个值移出
    /// 向量（从开始到结束）的迭代器。调用此函数后，向量无法继续使用
    /// 该迭代器。
    ///
    /// # 示例
    ///
    /// ```
    /// let v = vec!["a".to_string(), "b".to_string()];
    /// let mut v_iter = v.into_iter();
    ///
    /// let first_element: Option<String> = v_iter.next();
    ///
    /// assert_eq!(first_element, Some("a".to_string()));
    /// assert_eq!(v_iter.next(), Some("b".to_string()));
    /// assert_eq!(v_iter.next(), None);
    /// ```
    #[inline]
    fn into_iter(self) -> Self::IntoIter {
        let me = ManuallyDrop::new(self);
        // ignore-tidy-undocumented-unsafe
        unsafe {
            let alloc = ManuallyDrop::new(ptr::read(me.allocator()));
            let buf = me.buf.non_null();
            let begin = buf.as_ptr();
            let end = if T::IS_ZST {
                begin.wrapping_byte_add(me.len())
            } else {
                begin.add(me.len()) as *const T
            };
            let cap = me.buf.capacity();
            IntoIter { buf, phantom: PhantomData, cap, alloc, ptr: buf, end }
        }
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<'a, T, A: Allocator> IntoIterator for &'a Vec<T, A> {
    type Item = &'a T;
    type IntoIter = slice::Iter<'a, T>;

    fn into_iter(self) -> Self::IntoIter {
        self.iter()
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<'a, T, A: Allocator> IntoIterator for &'a mut Vec<T, A> {
    type Item = &'a mut T;
    type IntoIter = slice::IterMut<'a, T>;

    fn into_iter(self) -> Self::IntoIter {
        self.iter_mut()
    }
}

#[cfg(not(no_global_oom_handling))]
#[stable(feature = "rust1", since = "1.0.0")]
impl<T, A: Allocator> Extend<T> for Vec<T, A> {
    #[inline]
    fn extend<I: IntoIterator<Item = T>>(&mut self, iter: I) {
        <Self as SpecExtend<T, I::IntoIter>>::spec_extend(self, iter.into_iter())
    }

    #[inline]
    fn extend_one(&mut self, item: T) {
        self.push(item);
    }

    #[inline]
    fn extend_reserve(&mut self, additional: usize) {
        self.reserve(additional);
    }

    #[inline]
    unsafe fn extend_one_unchecked(&mut self, item: T) {
        // SAFETY: Our preconditions ensure the space has been reserved, and `extend_reserve` is implemented correctly.
        unsafe {
            let len = self.len();
            ptr::write(self.as_mut_ptr().add(len), item);
            self.set_len(len + 1);
        }
    }
}

impl<T, A: Allocator> Vec<T, A> {
    // leaf method to which various SpecFrom/SpecExtend implementations delegate when
    // they have no further optimizations to apply
    #[cfg(not(no_global_oom_handling))]
    fn extend_desugared<I: Iterator<Item = T>>(&mut self, mut iterator: I) {
        // This is the case for a general iterator.
        //
        // This function should be the moral equivalent of:
        //
        //      for item in iterator {
        //          self.push(item);
        //      }
        while let Some(element) = iterator.next() {
            let len = self.len();
            if len == self.capacity() {
                let (lower, _) = iterator.size_hint();
                self.reserve(lower.saturating_add(1));
            }
            // ignore-tidy-undocumented-unsafe
            unsafe {
                ptr::write(self.as_mut_ptr().add(len), element);
                // Since next() executes user code which can panic we have to bump the length
                // after each step.
                // NB can't overflow since we would have had to alloc the address space
                self.set_len(len + 1);
            }
        }
    }

    // specific extend for `TrustedLen` iterators, called both by the specializations
    // and internal places where resolving specialization makes compilation slower
    #[cfg(not(no_global_oom_handling))]
    fn extend_trusted(&mut self, iterator: impl iter::TrustedLen<Item = T>) {
        let (low, high) = iterator.size_hint();
        if let Some(additional) = high {
            debug_assert_eq!(
                low,
                additional,
                "TrustedLen iterator's size hint is not exact: {:?}",
                (low, high)
            );
            self.reserve(additional);
            let ptr = self.as_mut_ptr();
            let mut local_len = SetLenOnDrop::new(&mut self.len);
            // ignore-tidy-undocumented-unsafe
            unsafe {
                iterator.for_each(move |element| {
                    ptr::write(ptr.add(local_len.current_len()), element);
                    // Since the loop executes user code which can panic we have to update
                    // the length every step to correctly drop what we've written.
                    // NB can't overflow since we would have had to alloc the address space
                    local_len.increment_len(1);
                });
            }
        } else {
            // Per TrustedLen contract a `None` upper bound means that the iterator length
            // truly exceeds usize::MAX, which would eventually lead to a capacity overflow anyway.
            // Since the other branch already panics eagerly (via `reserve()`) we do the same here.
            // This avoids additional codegen for a fallback code path which would eventually
            // panic anyway.
            panic!("capacity overflow");
        }
    }

    /// 创建一个拼接迭代器，用于替换向量中指定范围的元素
    /// with the given `replace_with` iterator and yields the removed items.
    /// `replace_with` does not need to be the same length as `range`.
    ///
    /// `range` is removed even if the `Splice` iterator is not consumed before it is dropped.
    ///
    /// 未指定从向量中移除了多少个元素
    /// if the `Splice` value is leaked.
    ///
    /// The input iterator `replace_with` is only consumed when the `Splice` value is dropped.
    ///
    /// 如果满足以下条件，这是最优的：
    ///
    /// * The tail (elements in the vector after `range`) is empty,
    /// * or `replace_with` yields fewer or equal elements than `range`'s length
    /// * or the lower bound of its `size_hint()` is exact.
    ///
    /// 否则，会分配一个临时向量，并将尾部移动两次
    ///
    /// # Panics
    ///
    /// Panics if the range has `start_bound > end_bound`, or, if the range is
    /// # 示例
    ///
    /// # Examples
    ///
    /// ```
    /// let mut v = vec![1, 2, 3, 4];
    /// let new = [7, 8, 9];
    /// let u: Vec<_> = v.splice(1..3, new).collect();
    /// assert_eq!(v, [1, 7, 8, 9, 4]);
    /// assert_eq!(u, [2, 3]);
    /// ```
    ///
    /// Using `splice` to insert new items into a vector efficiently at a specific position
    /// 创建一个迭代器，该迭代器使用闭包来决定范围内的某个元素是否应被移除
    ///
    /// ```
    /// let mut v = vec![1, 5];
    /// let new = [2, 3, 4];
    /// v.splice(1..1, new);
    /// assert_eq!(v, [1, 2, 3, 4, 5]);
    /// ```
    #[cfg(not(no_global_oom_handling))]
    #[inline]
    #[stable(feature = "vec_splice", since = "1.21.0")]
    pub fn splice<R, I>(&mut self, range: R, replace_with: I) -> Splice<'_, I::IntoIter, A>
    where
        A: AllocatorNightly,
        R: RangeBounds<usize>,
        I: IntoIterator<Item = T>,
    {
        Splice { drain: self.drain(range), replace_with: replace_with.into_iter() }
    }

    /// Creates an iterator which uses a closure to determine if an element in the range should be removed.
    ///
    /// If the closure returns `true`, the element is removed from the vector
    /// and yielded. If the closure returns `false`, or panics, the element
    /// 保留在向量中，不会被 yielded。
    ///
    /// 仅考虑落在指定范围内的元素进行提取，但范围内的任何其他元素
    /// 如果已提取任何元素，则仍需移动这些元素。
    ///
    /// If the returned `ExtractIf` is not exhausted, e.g. because it is dropped without iterating
    /// 或者迭代短路了，那么剩余的元素将被保留。
    /// Use `extract_if().for_each(drop)` if you do not need the returned iterator,
    /// or [`retain_mut`] with a negated predicate if you also do not need to restrict the range.
    ///
    /// [`retain_mut`]: Vec::retain_mut
    ///
    /// 使用此方法与以下代码等效：
    ///
    /// ```
    /// # let some_predicate = |x: &mut i32| { *x % 2 == 1 };
    /// # let mut vec = vec![0, 1, 2, 3, 4, 5, 6];
    /// # let mut vec2 = vec.clone();
    /// # let range = 1..5;
    /// let mut i = range.start;
    /// let end_items = vec.len() - range.end;
    /// # let mut extracted = vec![];
    ///
    /// while i < vec.len() - end_items {
    ///     if some_predicate(&mut vec[i]) {
    ///         let val = vec.remove(i);
    ///         // your code here
    /// #         extracted.push(val);
    ///     } else {
    ///         i += 1;
    ///     }
    /// }
    ///
    /// # let extracted2: Vec<_> = vec2.extract_if(range, some_predicate).collect();
    /// # assert_eq!(vec, vec2);
    /// # assert_eq!(extracted, extracted2);
    /// ```
    ///
    /// But `extract_if` is easier to use. `extract_if` is also more efficient,
    /// 因为它可以批量向后移动数组中的元素。
    ///
    /// 迭代器还允许您在闭包中修改每个元素的值，
    /// 无论您选择保留还是移除它。
    ///
    /// # Panics
    ///
    /// If `range` is out of bounds.
    ///
    /// # Examples
    ///
    /// 将向量拆分为偶数和奇数值，并重新使用原始向量：
    ///
    /// ```
    /// let mut numbers = vec![1, 2, 3, 4, 5, 6, 8, 9, 11, 13, 14, 15];
    ///
    /// let evens = numbers.extract_if(.., |x| *x % 2 == 0).collect::<Vec<_>>();
    /// let odds = numbers;
    ///
    /// assert_eq!(evens, vec![2, 4, 6, 8, 14]);
    /// assert_eq!(odds, vec![1, 3, 5, 9, 11, 13, 15]);
    /// ```
    ///
    /// 使用范围参数仅处理向量的部分内容：
    ///
    /// ```
    /// let mut items = vec![0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 2, 1, 2];
    /// let ones = items.extract_if(7.., |x| *x == 1).collect::<Vec<_>>();
    /// assert_eq!(items, vec![0, 0, 0, 0, 0, 0, 0, 2, 2, 2]);
    /// assert_eq!(ones.len(), 3);
    /// ```
    #[stable(feature = "extract_if", since = "1.87.0")]
    pub fn extract_if<F, R>(&mut self, range: R, filter: F) -> ExtractIf<'_, T, F, A>
    where
        A: AllocatorNightly,
        F: FnMut(&mut T) -> bool,
        R: RangeBounds<usize>,
    {
        ExtractIf::new(self, filter, range)
    }
}

/// 扩展实现，在将其推入 Vec 之前从引用中复制元素。
///
/// This implementation is specialized for slice iterators, where it uses [`copy_from_slice`] to
/// 一次性追加整个切片。
///
/// [`copy_from_slice`]: slice::copy_from_slice
#[cfg(not(no_global_oom_handling))]
#[stable(feature = "extend_ref", since = "1.2.0")]
impl<'a, T: Copy + 'a, A: Allocator> Extend<&'a T> for Vec<T, A> {
    fn extend<I: IntoIterator<Item = &'a T>>(&mut self, iter: I) {
        self.spec_extend(iter.into_iter())
    }

    #[inline]
    fn extend_one(&mut self, &item: &'a T) {
        self.push(item);
    }

    #[inline]
    fn extend_reserve(&mut self, additional: usize) {
        self.reserve(additional);
    }

    #[inline]
    unsafe fn extend_one_unchecked(&mut self, &item: &'a T) {
        // SAFETY: Our preconditions ensure the space has been reserved, and `extend_reserve` is implemented correctly.
        unsafe {
            let len = self.len();
            ptr::write(self.as_mut_ptr().add(len), item);
            self.set_len(len + 1);
        }
    }
}

/// Implements comparison of vectors, [lexicographically](Ord#lexicographical-comparison).
#[stable(feature = "rust1", since = "1.0.0")]
impl<T, A1, A2> PartialOrd<Vec<T, A2>> for Vec<T, A1>
where
    T: PartialOrd,
    A1: Allocator,
    A2: Allocator,
{
    #[inline]
    fn partial_cmp(&self, other: &Vec<T, A2>) -> Option<Ordering> {
        PartialOrd::partial_cmp(&**self, &**other)
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T: Eq, A: Allocator> Eq for Vec<T, A> {}

/// Implements ordering of vectors, [lexicographically](Ord#lexicographical-comparison).
#[stable(feature = "rust1", since = "1.0.0")]
impl<T: Ord, A: Allocator> Ord for Vec<T, A> {
    #[inline]
    fn cmp(&self, other: &Self) -> Ordering {
        Ord::cmp(&**self, &**other)
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_const_unstable(feature = "const_heap", issue = "79597")]
const unsafe impl<#[may_dangle] T: [const] Destruct, A: [const] Allocator + [const] Destruct> Drop
    for Vec<T, A>
{
    fn drop(&mut self) {
        // ignore-tidy-undocumented-unsafe
        unsafe {
            // use drop for [T]
            // use a raw slice to refer to the elements of the vector as weakest necessary type;
            // could avoid questions of validity in certain cases
            self.as_mut_ptr().cast_slice(self.len).drop_in_place()
        }
        // RawVec handles deallocation
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_const_unstable(feature = "const_default", issue = "143894")]
const impl<T> Default for Vec<T> {
    /// Creates an empty `Vec<T>`.
    ///
    /// 向量在元素被推入之前不会分配内存。
    fn default() -> Vec<T> {
        Vec::new()
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T: fmt::Debug, A: Allocator> fmt::Debug for Vec<T, A> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        fmt::Debug::fmt(&**self, f)
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T, A: Allocator> AsRef<Vec<T, A>> for Vec<T, A> {
    fn as_ref(&self) -> &Vec<T, A> {
        self
    }
}

#[stable(feature = "vec_as_mut", since = "1.5.0")]
impl<T, A: Allocator> AsMut<Vec<T, A>> for Vec<T, A> {
    fn as_mut(&mut self) -> &mut Vec<T, A> {
        self
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T, A: Allocator> AsRef<[T]> for Vec<T, A> {
    fn as_ref(&self) -> &[T] {
        self
    }
}

#[stable(feature = "vec_as_mut", since = "1.5.0")]
impl<T, A: Allocator> AsMut<[T]> for Vec<T, A> {
    fn as_mut(&mut self) -> &mut [T] {
        self
    }
}

#[cfg(not(no_global_oom_handling))]
#[stable(feature = "rust1", since = "1.0.0")]
impl<T: Clone> From<&[T]> for Vec<T> {
    /// Allocates a `Vec<T>` and fills it by cloning `s`'s items.
    ///
    /// # Examples
    ///
    /// ```
    /// assert_eq!(Vec::from(&[1, 2, 3][..]), vec![1, 2, 3]);
    /// ```
    fn from(s: &[T]) -> Vec<T> {
        s.to_vec()
    }
}

#[cfg(not(no_global_oom_handling))]
#[stable(feature = "vec_from_mut", since = "1.19.0")]
impl<T: Clone> From<&mut [T]> for Vec<T> {
    /// Allocates a `Vec<T>` and fills it by cloning `s`'s items.
    ///
    /// # Examples
    ///
    /// ```
    /// assert_eq!(Vec::from(&mut [1, 2, 3][..]), vec![1, 2, 3]);
    /// ```
    fn from(s: &mut [T]) -> Vec<T> {
        s.to_vec()
    }
}

#[cfg(not(no_global_oom_handling))]
#[stable(feature = "vec_from_array_ref", since = "1.74.0")]
impl<T: Clone, const N: usize> From<&[T; N]> for Vec<T> {
    /// Allocates a `Vec<T>` and fills it by cloning `s`'s items.
    ///
    /// # Examples
    ///
    /// ```
    /// assert_eq!(Vec::from(&[1, 2, 3]), vec![1, 2, 3]);
    /// ```
    fn from(s: &[T; N]) -> Vec<T> {
        Self::from(s.as_slice())
    }
}

#[cfg(not(no_global_oom_handling))]
#[stable(feature = "vec_from_array_ref", since = "1.74.0")]
impl<T: Clone, const N: usize> From<&mut [T; N]> for Vec<T> {
    /// Allocates a `Vec<T>` and fills it by cloning `s`'s items.
    ///
    /// # Examples
    ///
    /// ```
    /// assert_eq!(Vec::from(&mut [1, 2, 3]), vec![1, 2, 3]);
    /// ```
    fn from(s: &mut [T; N]) -> Vec<T> {
        Self::from(s.as_mut_slice())
    }
}

#[cfg(not(no_global_oom_handling))]
#[stable(feature = "vec_from_array", since = "1.44.0")]
impl<T, const N: usize> From<[T; N]> for Vec<T> {
    /// Allocates a `Vec<T>` and moves `s`'s items into it.
    ///
    /// # Examples
    ///
    /// ```
    /// assert_eq!(Vec::from([1, 2, 3]), vec![1, 2, 3]);
    /// ```
    fn from(s: [T; N]) -> Vec<T> {
        <[T]>::into_vec(Box::new(s))
    }
}

#[stable(feature = "vec_from_cow_slice", since = "1.14.0")]
impl<'a, T> From<Cow<'a, [T]>> for Vec<T>
where
    [T]: ToOwned<Owned = Vec<T>>,
{
    /// 将写时克隆切片转换为向量。
    ///
    /// If `s` already owns a `Vec<T>`, it will be returned directly.
    /// If `s` is borrowing a slice, a new `Vec<T>` will be allocated and
    /// filled by cloning `s`'s items into it.
    ///
    /// # 通过转移所有权将盒装切片转换为向量。
    ///
    /// ```
    /// # use std::borrow::Cow;
    /// let o: Cow<'_, [i32]> = Cow::Owned(vec![1, 2, 3]);
    /// let b: Cow<'_, [i32]> = Cow::Borrowed(&[1, 2, 3]);
    /// assert_eq!(Vec::from(o), Vec::from(b));
    /// ```
    fn from(s: Cow<'a, [T]>) -> Vec<T> {
        s.into_owned()
    }
}

#[stable(feature = "vec_from_box", since = "1.18.0")]
impl<T, A: Allocator> From<Box<[T], A>> for Vec<T, A> {
    /// 将现有的堆分配转换为盒装切片。
    /// # Examples
    ///
    /// # 将向量转换为盒装切片。
    ///
    /// ```
    /// let b: Box<[i32]> = vec![1, 2, 3].into_boxed_slice();
    /// assert_eq!(Vec::from(b), vec![1, 2, 3]);
    /// ```
    fn from(s: Box<[T], A>) -> Self {
        s.into_vec()
    }
}

#[cfg(not(no_global_oom_handling))]
#[stable(feature = "box_from_vec", since = "1.20.0")]
impl<T, A: Allocator> From<Vec<T, A>> for Box<[T], A> {
    /// Converts a vector into a boxed slice.
    ///
    /// This is equivalent to [`Vec::into_boxed_slice`].
    ///
    /// # Examples
    ///
    /// ```
    /// assert_eq!(Box::from(vec![1, 2, 3]), vec![1, 2, 3].into_boxed_slice());
    /// ```
    fn from(v: Vec<T, A>) -> Self {
        v.into_boxed_slice()
    }
}

#[cfg(not(no_global_oom_handling))]
#[stable(feature = "rust1", since = "1.0.0")]
impl From<&str> for Vec<u8> {
    /// Allocates a `Vec<u8>` and fills it with a UTF-8 string.
    ///
    /// # 示例
    ///
    /// ```
    /// assert_eq!(Vec::from("123"), vec![b'1', b'2', b'3']);
    /// ```
    fn from(s: &str) -> Vec<u8> {
        From::from(s.as_bytes())
    }
}

#[stable(feature = "array_try_from_vec", since = "1.48.0")]
#[rustc_const_unstable(feature = "const_convert", issue = "143773")]
const impl<T: [const] Destruct, A: [const] Allocator + [const] Destruct, const N: usize>
    TryFrom<Vec<T, A>> for [T; N]
{
    type Error = Vec<T, A>;

    /// Gets the entire contents of the `Vec<T>` as an array,
    /// 如果其大小与所请求的数组大小完全匹配。
    ///
    /// # 示例
    ///
    /// ```
    /// assert_eq!(vec![1, 2, 3].try_into(), Ok([1, 2, 3]));
    /// assert_eq!(<Vec<i32>>::new().try_into(), Ok([]));
    /// ```
    ///
    /// If the length doesn't match, the input comes back in `Err`:
    /// ```
    /// let r: Result<[i32; 4], _> = (0..10).collect::<Vec<_>>().try_into();
    /// assert_eq!(r, Err(vec![0, 1, 2, 3, 4, 5, 6, 7, 8, 9]));
    /// ```
    ///
    /// If you're fine with just getting a prefix of the `Vec<T>`,
    /// you can call [`.truncate(N)`](Vec::truncate) first.
    /// ```
    /// let mut v = String::from("hello world").into_bytes();
    /// v.sort();
    /// v.truncate(2);
    /// let [a, b]: [_; 2] = v.try_into().unwrap();
    /// assert_eq!(a, b' ');
    /// assert_eq!(b, b'd');
    /// ```
    fn try_from(mut vec: Vec<T, A>) -> Result<[T; N], Vec<T, A>> {
        if vec.len() != N {
            return Err(vec);
        }

        // SAFETY: `.set_len(0)` is always sound.
        unsafe { vec.set_len(0) };

        // SAFETY: A `Vec`'s pointer is always aligned properly, and
        // the alignment the array needs is the same as the items.
        // We checked earlier that we have sufficient items.
        // The items will not double-drop as the `set_len`
        // tells the `Vec` not to also drop them.
        let array = unsafe { ptr::read(vec.as_ptr() as *const [T; N]) };
        Ok(array)
    }
}
